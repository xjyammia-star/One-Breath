// api/_lib/auth.js
const crypto = require('crypto')

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return verify === hash
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

async function getSession(req, pool) {
  const auth = req.headers.authorization || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null

  const result = await pool.query(
    `SELECT s.*, u.id as user_id, u.email, u.role, u.plan, u.plan_expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  )
  return result.rows[0] || null
}

async function checkFeatureAccess(userId, featureKey, pool) {
  // 1. 获取功能配置
  const featureRes = await pool.query(
    'SELECT * FROM feature_flags WHERE feature_key = $1',
    [featureKey]
  )
  const feature = featureRes.rows[0]
  if (!feature) return { allowed: false, reason: 'feature_not_found' }
  if (!feature.is_enabled) return { allowed: false, reason: 'feature_disabled' }

  // 2. 获取用户信息
  const userRes = await pool.query(
    'SELECT plan, plan_expires_at FROM users WHERE id = $1',
    [userId]
  )
  const user = userRes.rows[0]
  if (!user) return { allowed: false, reason: 'user_not_found' }

  // 3. 付费用户判断：
  //    - plan 不是 free
  //    - 且 plan_expires_at 为空（永久有效）或未过期
  const isPaidPlan = user.plan !== 'free'
  const isExpired = user.plan_expires_at
    ? new Date(user.plan_expires_at) <= new Date()
    : false  // 没有到期时间 = 永久有效

  if (isPaidPlan && !isExpired) {
    return { allowed: true, reason: 'paid_user', remaining: -1 }
  }

  // 4. 免费用户：检查每日次数限制
  //    先看后台设置的 free_daily_limit
  if (feature.free_daily_limit === 0) {
    // 后台设为 0 次：付费功能，免费用户不可用
    return { allowed: false, reason: 'paid_required', remaining: 0 }
  }

  const today = new Date().toISOString().split('T')[0]
  const usageRes = await pool.query(
    'SELECT COUNT(*) as count FROM usage_logs WHERE user_id = $1 AND feature_key = $2 AND date_key = $3',
    [userId, featureKey, today]
  )
  const used = parseInt(usageRes.rows[0].count)
  const remaining = feature.free_daily_limit - used

  if (remaining <= 0) return { allowed: false, reason: 'daily_limit_reached', remaining: 0 }
  return { allowed: true, reason: 'free_quota', remaining }
}

async function logUsage(userId, featureKey, pool) {
  const today = new Date().toISOString().split('T')[0]
  await pool.query(
    'INSERT INTO usage_logs (user_id, feature_key, date_key) VALUES ($1, $2, $3)',
    [userId, featureKey, today]
  )
}

module.exports = { hashPassword, verifyPassword, generateToken, getSession, checkFeatureAccess, logUsage }
