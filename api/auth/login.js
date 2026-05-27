// api/auth/login.js
const { getPool } = require('../_lib/db')
const { verifyPassword, generateToken } = require('../_lib/auth')

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: '邮箱和密码不能为空' })

  const pool = getPool()

  try {
    const userRes = await pool.query(
      'SELECT id, email, password_hash, role, plan, plan_expires_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    )
    const user = userRes.rows[0]
    if (!user) return res.status(401).json({ error: '邮箱或密码错误' })

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: '邮箱或密码错误' })
    }

    // 清除旧的过期session
    await pool.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at < NOW()', [user.id])

    // 创建新 session
    const token = generateToken()
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expires]
    )

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
        plan_expires_at: user.plan_expires_at,
      }
    })
  } catch (err) {
    return res.status(500).json({ error: '登录失败', detail: err.message })
  }
}
