// api/chat.js
const { getPool } = require('./_lib/db')
const { getSession, checkFeatureAccess, logUsage } = require('./_lib/auth')

const MODULE_FEATURE_MAP = {
  self:   'self_basic',
  people: 'people_basic',
  world:  'world_year',
}

// 无需登录即可使用的功能
const FREE_FEATURES = ['self_basic']

// 匿名用户每日限次（用 IP 计）
const ANON_DAILY_LIMIT = 3

function extractKeywords(question) {
  const stopWords = ['怎么','如何','什么','为什么','哪些','吗','呢','啊','的','了','吧',
                     'what','how','why','is','are','the','a','an','my','me','i']
  const words = question
    .replace(/[？?！!。，,]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopWords.includes(w.toLowerCase()))
  return [...new Set(words)].slice(0, 6)
}

async function searchCorpus(question, pool) {
  try {
    const keywords = extractKeywords(question)
    if (keywords.length === 0) return ''
    const conditions = keywords.map((_, i) => `text ILIKE $${i + 1}`).join(' OR ')
    const params = keywords.map(k => `%${k}%`)
    const result = await pool.query(
      `SELECT text, title FROM corpus_chunks WHERE ${conditions}
       ORDER BY CASE WHEN source_type = 'corpus' THEN 0 ELSE 1 END LIMIT 5`,
      params
    )
    if (result.rows.length === 0) return ''
    return '\n\n【相关古籍参考】\n' + result.rows.map(r => `【${r.title || '古籍'}】${r.text}`).join('\n\n')
  } catch (err) {
    return ''
  }
}

// 匿名用户限次：用 IP + 日期作为 key，存在 usage_logs 表
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
    // 查询失败时允许通过，避免数据库问题影响用户体验
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
  } catch (err) {
    // 记录失败不影响主流程
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const pool = getPool()

  try {
    const { messages, system, module: mod } = req.body
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Missing DEEPSEEK_API_KEY' })

    const featureKey = MODULE_FEATURE_MAP[mod] || 'self_basic'
    const isFreeFeature = FREE_FEATURES.includes(featureKey)

    // 尝试获取登录用户
    const session = await getSession(req, pool)

    if (session) {
      // ── 已登录用户：走原有权限校验逻辑 ──
      const access = await checkFeatureAccess(session.user_id, featureKey, pool)
      if (!access.allowed) {
        const msg = access.reason === 'daily_limit_reached'
          ? '今日免费次数已用完，明日再来'
          : access.reason === 'paid_required'
          ? '此功能需要订阅后使用'
          : '功能暂不可用'
        return res.status(403).json({ error: msg, reason: access.reason })
      }
      await logUsage(session.user_id, featureKey, pool)

    } else {
      // ── 未登录用户：只允许免费功能 ──
      if (!isFreeFeature) {
        return res.status(401).json({
          error: '此功能需要登录后使用',
          code: 'LOGIN_REQUIRED',
        })
      }

      // 匿名限次检查（用 IP）
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

    // 检索古籍
    const lastMsg = messages[messages.length - 1]?.content || ''
    const corpusRef = await searchCorpus(lastMsg, pool)
    const messagesWithRef = messages.map((m, i) =>
      i === messages.length - 1 && corpusRef ? { ...m, content: m.content + corpusRef } : m
    )

    // 调用 DeepSeek
    const arkRes = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'ep-20260516000733-j969v',
        messages: [{ role: 'system', content: system }, ...messagesWithRef],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    })

    const text = await arkRes.text()
    if (!arkRes.ok) return res.status(500).json({ error: `Upstream ${arkRes.status}`, detail: text })

    const data = JSON.parse(text)
    return res.status(200).json({ ...data })

  } catch (err) {
    return res.status(500).json({ error: 'Handler error', detail: err.message })
  }
}
