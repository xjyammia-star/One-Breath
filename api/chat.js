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
          ...messages,
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    })

    const data = await arkRes.json()

    if (!arkRes.ok) {
      return res.status(500).json({ error: `Upstream ${arkRes.status}`, detail: data })
    }

    return res.status(200).json(data)

  } catch (err) {
    return res.status(500).json({ error: 'Handler error', detail: err.message })
  }
}
