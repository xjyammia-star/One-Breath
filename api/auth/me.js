// api/auth/me.js
const { getPool } = require('../_lib/db')
const { getSession } = require('../_lib/auth')

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const pool = getPool()
  const session = await getSession(req, pool)
  if (!session) return res.status(401).json({ error: '未登录' })

  return res.status(200).json({
    user: {
      id: session.user_id,
      email: session.email,
      role: session.role,
      plan: session.plan,
      plan_expires_at: session.plan_expires_at,
    }
  })
}
