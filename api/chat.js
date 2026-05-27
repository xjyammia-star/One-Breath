// api/chat.js
const { getPool } = require('./_lib/db')
const { getSession, checkFeatureAccess, logUsage } = require('./_lib/auth')

const MODULE_FEATURE_MAP = {
  self:   'self_basic',
  people: 'people_basic',
  world:  'world_year',
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const pool = getPool()

  try {
    const { messages, system, module: mod } = req.body
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Missing DEEPSEEK_API_KEY' })

    // 验证登录
    const session = await getSession(req, pool)
    if (!session) return res.status(401).json({ error: '请先登录', code: 'NOT_LOGGED_IN' })

    // 检查功能权限
    const featureKey = MODULE_FEATURE_MAP[mod] || 'self_basic'
    const access = await checkFeatureAccess(session.user_id, featureKey, pool)
    if (!access.allowed) {
      const msg = access.reason === 'daily_limit_reached' ? '今日免费次数已用完，明日再来'
                : access.reason === 'paid_required'       ? '此功能需要订阅后使用'
                : '功能暂不可用'
      return res.status(403).json({ error: msg, reason: access.reason })
    }

    // 记录使用
    await logUsage(session.user_id, featureKey, pool)

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
    return res.status(200).json({ ...data, remaining: access.remaining })

  } catch (err) {
    return res.status(500).json({ error: 'Handler error', detail: err.message })
  }
}
