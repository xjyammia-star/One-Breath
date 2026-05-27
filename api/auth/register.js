// api/auth/register.js
const { getPool } = require('../_lib/db')
const { hashPassword, generateToken } = require('../_lib/auth')

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: '邮箱和密码不能为空' })
  if (password.length < 6) return res.status(400).json({ error: '密码至少6位' })

  const pool = getPool()

  try {
    // 检查邮箱是否已注册
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existing.rows.length > 0) return res.status(400).json({ error: '该邮箱已注册' })

    // 创建用户
    const hash = hashPassword(password)
    const userRes = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role, plan',
      [email.toLowerCase(), hash]
    )
    const user = userRes.rows[0]

    // 创建 session
    const token = generateToken()
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expires]
    )

    return res.status(200).json({ token, user: { id: user.id, email: user.email, role: user.role, plan: user.plan } })
  } catch (err) {
    return res.status(500).json({ error: '注册失败', detail: err.message })
  }
}
