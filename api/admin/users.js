// api/admin/users.js
const { getPool } = require('../_lib/db')
const { getSession, hashPassword } = require('../_lib/auth')

export default async function handler(req, res) {
  const pool = getPool()
  const session = await getSession(req, pool)
  if (!session) return res.status(401).json({ error: '未登录' })
  if (session.role !== 'admin') return res.status(403).json({ error: '无权限' })

  // GET：获取用户列表
  if (req.method === 'GET') {
    const page = parseInt(req.query.page) || 1
    const limit = 20
    const offset = (page - 1) * limit

    const result = await pool.query(
      `SELECT id, email, role, plan, plan_expires_at, created_at
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    )
    const countRes = await pool.query('SELECT COUNT(*) FROM users')
    return res.status(200).json({
      users: result.rows,
      total: parseInt(countRes.rows[0].count),
      page,
    })
  }

  // PUT：修改用户
  if (req.method === 'PUT') {
    const { id } = req.query
    const { plan, role, new_password, plan_expires_at } = req.body

    const updates = []
    const params = []
    let i = 1

    if (plan) { updates.push(`plan = $${i++}`); params.push(plan) }
    if (role) { updates.push(`role = $${i++}`); params.push(role) }
    if (plan_expires_at) { updates.push(`plan_expires_at = $${i++}`); params.push(plan_expires_at) }
    if (new_password) {
      updates.push(`password_hash = $${i++}`)
      params.push(hashPassword(new_password))
    }

    if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' })

    updates.push(`updated_at = NOW()`)
    params.push(id)

    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`,
      params
    )
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
