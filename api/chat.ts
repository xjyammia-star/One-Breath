export const config = { runtime: 'nodejs' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { messages, system } = await req.json()

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing API key' }), { status: 500 })
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

    const text = await arkRes.text()

    if (!arkRes.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream error ${arkRes.status}`, detail: text }),
        { status: 500 }
      )
    }

    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: 'Handler error', detail: msg }), { status: 500 })
  }
}
