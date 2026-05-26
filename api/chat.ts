export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const { messages, system } = await req.json()

  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
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

  const data = await response.json()
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
