// api/chat.js
const { getPool } = require('./_lib/db')
const { getSession, checkFeatureAccess, logUsage } = require('./_lib/auth')

const VALID_FEATURE_KEYS = [
  'self_basic', 'self_deep',
  'people_basic', 'people_deep',
  'world_year', 'world_timing', 'world_fengshui',
]

const FREE_FEATURES = ['self_basic']
const ANON_DAILY_LIMIT = 3

// 命理核心典籍（检索时优先返回这些书）
const MINGLI_TITLES = [
  '滴天髓', '子平真诠', '穷通宝鉴', '渊海子平',
  '三命通会', '神峰通考', '九龙道长八字', '张正照神策梅花',
  '钦定协纪辨方书',
]

function extractKeywords(question) {
  const stopWords = ['怎么','如何','什么','为什么','哪些','吗','呢','啊','的','了','吧',
                     '我','你','他','她','它','这','那','有','没','是','在',
                     'what','how','why','is','are','the','a','an','my','me','i']
  const singleCharAllowlist = new Set([
    '木','火','土','金','水',
    '甲','乙','丙','丁','戊','己','庚','辛','壬','癸',
    '子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥',
    '阴','阳','乾','坤','震','巽','坎','离','艮','兑',
  ])
  const words = question
    .replace(/[？?！!。，,【】]/g, ' ')
    .split(/\s+/)
    .filter(w => {
      if (singleCharAllowlist.has(w)) return true
      return w.length >= 2 && !stopWords.includes(w.toLowerCase())
    })
  return [...new Set(words)].slice(0, 8)
}

async function searchCorpus(question, pool) {
  try {
    const keywords = extractKeywords(question)
    if (keywords.length === 0) return { ref: '', sources: [] }

    const conditions = keywords.map((_, i) => `text ILIKE $${i + 1}`).join(' OR ')
    const params = keywords.map(k => `%${k}%`)

    // 命理典籍列表（用于 SQL 排序）
    const mingliList = MINGLI_TITLES.map(t => `'${t}'`).join(',')

    // 优先返回命理典籍，其次其他 corpus，最后知识图谱
    // 同优先级内用 random() 避免总返回同一条
    const result = await pool.query(
      `SELECT text, title, source_type FROM corpus_chunks
       WHERE (${conditions})
       ORDER BY
         CASE
           WHEN title IN (${mingliList}) THEN 0
           WHEN source_type = 'corpus' THEN 1
           ELSE 2
         END,
         random()
       LIMIT 6`,
      params
    )

    if (result.rows.length === 0) return { ref: '', sources: [] }

    const ref = '\n\n【相关古籍参考】\n' +
      result.rows.map(r => `【${r.title || '古籍'}】${r.text}`).join('\n\n')

    const seen = new Set()
    const sources = []
    for (const row of result.rows) {
      const title = row.title || '古籍'
      if (!seen.has(title)) {
        seen.add(title)
        sources.push({ title, excerpt: row.text.slice(0, 120) })
      }
    }

    return { ref, sources }
  } catch (err) {
    console.error('[corpus search error]', err)
    return { ref: '', sources: [] }
  }
}

async function checkAnonLimit(ip, featureKey, pool) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const result = await pool.query(
      `SELECT COUNT(*) as cnt FROM usage_logs
       WHERE user_id IS NULL AND ip_address = $1
       AND feature_key = $2 AND DATE(created_at) = $3`,
      [ip, featureKey, today]
    )
    const count = parseInt(result.rows[0].cnt, 10)
    return {
      allowed: count < ANON_DAILY_LIMIT,
      remaining: Math.max(0, ANON_DAILY_LIMIT - count),
      count,
    }
  } catch (err) {
    return { allowed: true, remaining: ANON_DAILY_LIMIT, count: 0 }
  }
}

async function logAnonUsage(ip, featureKey, pool) {
  try {
    await pool.query(
      `INSERT INTO usage_logs (user_id, feature_key, ip_address, created_at)
       VALUES (NULL, $1, $2, NOW())`,
      [featureKey, ip]
    )
  } catch (err) {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const pool = getPool()

  try {
    const { messages, system, featureKey: rawKey } = req.body
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Missing DEEPSEEK_API_KEY' })

    const featureKey = VALID_FEATURE_KEYS.includes(rawKey) ? rawKey : 'self_basic'
    const isFreeFeature = FREE_FEATURES.includes(featureKey)

    const session = await getSession(req, pool)

    if (session) {
      const access = await checkFeatureAccess(session.user_id, featureKey, pool)
      if (!access.allowed) {
        const msg = access.reason === 'daily_limit_reached'
          ? '今日免费次数已用完，明日再来'
          : access.reason === 'paid_required'
          ? '此功能需要订阅后使用'
          : '功能暂不可用'
        return res.status(403).json({
          error: msg,
          reason: access.reason,
          code: access.reason === 'paid_required' ? 'PAID_REQUIRED' : 'DAILY_LIMIT_REACHED'
        })
      }
      await logUsage(session.user_id, featureKey, pool)

    } else {
      if (!isFreeFeature) {
        return res.status(401).json({ error: '此功能需要登录后使用', code: 'LOGIN_REQUIRED' })
      }
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
               || req.socket?.remoteAddress
               || 'unknown'
      const anonAccess = await checkAnonLimit(ip, featureKey, pool)
      if (!anonAccess.allowed) {
        return res.status(403).json({
          error: '今日免费次数已用完，登录后可获得更多次数',
          code: 'ANON_LIMIT_REACHED',
          remaining: 0,
        })
      }
      await logAnonUsage(ip, featureKey, pool)
    }

    const lastMsg = messages[messages.length - 1]?.content || ''

    let questionOnly = lastMsg
    if (lastMsg.includes('【问题】')) {
      questionOnly = lastMsg.split('【问题】').pop()?.trim() || lastMsg
    } else if (lastMsg.includes('【Question】')) {
      questionOnly = lastMsg.split('【Question】').pop()?.trim() || lastMsg
    } else {
      questionOnly = lastMsg.slice(-200)
    }

    const baziKeywords = []
    const ganMap = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'}
    for (const [gan, wx] of Object.entries(ganMap)) {
      if (lastMsg.includes(gan)) baziKeywords.push(wx)
    }
    const combinedSearch = questionOnly + ' ' + [...new Set(baziKeywords)].join(' ')

    console.log('[corpus search] question:', questionOnly.slice(0, 80))
    const { ref: corpusRef, sources: corpusSources } = await searchCorpus(combinedSearch, pool)
    console.log('[corpus result] sources:', corpusSources.map(s => s.title).join(', '))

    const messagesWithRef = messages.map((m, i) =>
      i === messages.length - 1 && corpusRef ? { ...m, content: m.content + corpusRef } : m
    )

    const isDeep = featureKey.endsWith('_deep') || featureKey === 'world_timing'
    const maxTokens = isDeep ? 3500 : 2000

    const arkRes = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'ep-20260516000733-j969v',
        messages: [{ role: 'system', content: system }, ...messagesWithRef],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    })

    const text = await arkRes.text()
    if (!arkRes.ok) return res.status(500).json({ error: `Upstream ${arkRes.status}`, detail: text })

    const data = JSON.parse(text)
    return res.status(200).json({ ...data, sources: corpusSources })

  } catch (err) {
    return res.status(500).json({ error: 'Handler error', detail: err.message })
  }
}
