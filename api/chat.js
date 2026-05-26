const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
})

/**
 * 从问题中提取关键词
 */
function extractKeywords(question) {
  // 移除常见疑问词和停用词
  const stopWords = ['怎么','如何','什么','为什么','哪些','吗','呢','啊','的','了','吧',
                     'what','how','why','is','are','the','a','an','my','me','i']
  const words = question
    .replace(/[？?！!。，,]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopWords.includes(w.toLowerCase()))
  return [...new Set(words)].slice(0, 6)
}

/**
 * 关键词检索古籍片段
 */
async function searchCorpus(question) {
  try {
    const keywords = extractKeywords(question)
    if (keywords.length === 0) return ''

    // 构建 ILIKE 查询，每个关键词都搜
    const conditions = keywords.map((_, i) => `text ILIKE $${i + 1}`).join(' OR ')
    const params = keywords.map(k => `%${k}%`)

    const result = await pool.query(
      `SELECT text, title, source_type
       FROM corpus_chunks
       WHERE ${conditions}
       ORDER BY CASE WHEN source_type = 'corpus' THEN 0 ELSE 1 END
       LIMIT 5`,
      params
    )

    if (result.rows.length === 0) return ''

    const refs = result.rows
      .map(r => `【${r.title || '古籍'}】${r.text}`)
      .join('\n\n')

    return `\n\n【相关古籍参考】\n${refs}`
  } catch (err) {
    console.error('数据库检索失败:', err.message)
    return ''
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { messages, system } = req.body

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing DEEPSEEK_API_KEY' })
    }

    // 从最后一条用户消息里提取问题，检索古籍
    const lastMessage = messages[messages.length - 1]?.content || ''
    const corpusRef = await searchCorpus(lastMessage)

    // 把古籍参考拼接到用户消息末尾
    const messagesWithRef = messages.map((m, i) => {
      if (i === messages.length - 1 && corpusRef) {
        return { ...m, content: m.content + corpusRef }
      }
      return m
    })

    const arkRes = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'ep-20260516000733-j969v',
        messages: [
          { role: 'system', content: system },
          ...messagesWithRef,
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    })

    const text = await arkRes.text()

    if (!arkRes.ok) {
      return res.status(500).json({ error: `Upstream ${arkRes.status}`, detail: text })
    }

    return res.status(200).json(JSON.parse(text))

  } catch (err) {
    return res.status(500).json({ error: 'Handler error', detail: err.message })
  }
}
