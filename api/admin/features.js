// api/admin/features.js
const { getPool } = require('../_lib/db')
const { getSession } = require('../_lib/auth')

export default async function handler(req, res) {
  const pool = getPool()
  const session = await getSession(req, pool)
  if (!session) return res.status(401).json({ error: '未登录' })
  if (session.role !== 'admin') return res.status(403).json({ error: '无权限' })

  // GET：获取所有功能开关
  if (req.method === 'GET') {
    const result = await pool.query('SELECT * FROM feature_flags ORDER BY module, id')
    return res.status(200).json({ features: result.rows })
  }

  // PUT：修改功能开关
  if (req.method === 'PUT') {
    const { feature_key, is_enabled, free_daily_limit, is_paid } = req.body
    if (!feature_key) return res.status(400).json({ error: '缺少 feature_key' })

    const updates = []
    const params = []
    let i = 1

    if (is_enabled !== undefined) { updates.push(`is_enabled = $${i++}`); params.push(is_enabled) }
    if (free_daily_limit !== undefined) { updates.push(`free_daily_limit = $${i++}`); params.push(free_daily_limit) }
    if (is_paid !== undefined) { updates.push(`is_paid = $${i++}`); params.push(is_paid) }

    if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' })

    updates.push(`updated_at = NOW()`)
    params.push(feature_key)

    await pool.query(
      `UPDATE feature_flags SET ${updates.join(', ')} WHERE feature_key = $${i}`,
      params
    )
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
