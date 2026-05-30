// src/pages/Admin.tsx
import { useState, useEffect } from 'react'
import { useAuth } from '../utils/authContext'
import { Lang } from '../types'

interface Props { lang: Lang; onBack: () => void }

interface User {
  id: number; email: string; role: string; plan: string
  plan_expires_at: string | null; created_at: string
}

interface Feature {
  feature_key: string; feature_name_zh: string; feature_name_en: string
  module: string; is_enabled: boolean; free_daily_limit: number; is_paid: boolean
}

const PLAN_LABELS: Record<string, string> = {
  free: '免费', monthly: '包月', quarterly: '包季', yearly: '包年'
}

const PLAN_COLORS: Record<string, string> = {
  free: '#9a8f82', monthly: '#3d7d6e', quarterly: '#9b7d3a', yearly: '#c0392b'
}

const MODULE_LABELS: Record<string, string> = {
  self: '与己', people: '与人', world: '与世界'
}

export default function Admin({ lang, onBack }: Props) {
  const { token } = useAuth()
  const [tab, setTab] = useState<'users' | 'features'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [newPlan, setNewPlan] = useState('')
  const [newExpiry, setNewExpiry] = useState('')
  const [msg, setMsg] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  useEffect(() => { fetchUsers(); fetchFeatures() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const r = await fetch('/api/admin/users', { headers })
    const d = await r.json()
    setUsers(d.users || [])
    setLoading(false)
  }

  const fetchFeatures = async () => {
    const r = await fetch('/api/admin/features', { headers })
    const d = await r.json()
    setFeatures(d.features || [])
  }

  const updateUser = async () => {
    if (!editUser) return
    const body: any = {}
    if (newPlan) body.plan = newPlan
    if (newPassword) body.new_password = newPassword
    if (newExpiry) body.plan_expires_at = newExpiry
    await fetch(`/api/admin/users?id=${editUser.id}`, { method: 'PUT', headers, body: JSON.stringify(body) })
    setMsg('已更新')
    setEditUser(null)
    setNewPassword(''); setNewPlan(''); setNewExpiry('')
    fetchUsers()
    setTimeout(() => setMsg(''), 3000)
  }

  const updateFeature = async (key: string, field: string, value: any) => {
    await fetch('/api/admin/features', {
      method: 'PUT', headers,
      body: JSON.stringify({ feature_key: key, [field]: value })
    })
    fetchFeatures()
  }

  // 按模块分组功能
  const featuresByModule = features.reduce((acc, f) => {
    const mod = f.module || 'other'
    if (!acc[mod]) acc[mod] = []
    acc[mod].push(f)
    return acc
  }, {} as Record<string, Feature[]>)

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="text-btn" onClick={onBack}>← 返回</button>
        <h1 className="admin-title">管理后台</h1>
        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>用户</button>
          <button className={`admin-tab ${tab === 'features' ? 'active' : ''}`} onClick={() => setTab('features')}>功能</button>
        </div>
      </header>

      <div className="admin-body">
        {msg && <div className="admin-msg">{msg}</div>}

        {/* ── 用户管理（卡片式）── */}
        {tab === 'users' && (
          <div className="admin-cards">
            {loading && <div className="admin-loading">加载中…</div>}
            {users.map(u => (
              <div key={u.id} className="admin-user-card">
                <div className="auc-top">
                  <div className="auc-email">{u.email}</div>
                  <span className={`badge badge-${u.role}`}>{u.role}</span>
                </div>
                <div className="auc-mid">
                  <span className="auc-plan" style={{ color: PLAN_COLORS[u.plan] || '#9a8f82' }}>
                    {PLAN_LABELS[u.plan] || u.plan}
                  </span>
                  {u.plan_expires_at && (
                    <span className="auc-expiry">
                      到期：{new Date(u.plan_expires_at).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                  <span className="auc-date">
                    注册：{new Date(u.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <button className="admin-btn auc-edit" onClick={() => { setEditUser(u); setNewPlan(u.plan) }}>
                  编辑
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── 功能开关（按模块分组）── */}
        {tab === 'features' && (
          <div className="admin-features">
            {Object.entries(featuresByModule).map(([mod, fList]) => (
              <div key={mod} className="admin-feature-group">
                <div className="afg-title">{MODULE_LABELS[mod] || mod}</div>
                {fList.map(f => (
                  <div key={f.feature_key} className="admin-feature-card">
                    <div className="afc-header">
                      <div className="afc-name">{f.feature_name_zh}</div>
                      <label className="toggle">
                        <input type="checkbox" checked={f.is_enabled}
                          onChange={e => updateFeature(f.feature_key, 'is_enabled', e.target.checked)} />
                        <span className="toggle-slider" />
                      </label>
                    </div>
                    <div className="afc-body">
                      <div className="afc-row">
                        <span className="afc-label">需付费</span>
                        <label className="toggle">
                          <input type="checkbox" checked={f.is_paid}
                            onChange={e => updateFeature(f.feature_key, 'is_paid', e.target.checked)} />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                      <div className="afc-row">
                        <span className="afc-label">免费次数/天</span>
                        <input className="admin-number-input" type="number" min={0} max={99}
                          value={f.free_daily_limit}
                          onChange={e => updateFeature(f.feature_key, 'free_daily_limit', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 编辑用户弹窗 */}
      {editUser && (
        <div className="admin-modal-overlay" onClick={() => setEditUser(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-title">编辑用户</div>
            <div className="admin-modal-email">{editUser.email}</div>

            <div className="form-row">
              <label className="form-label">套餐</label>
              <select className="form-input" value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                <option value="free">免费</option>
                <option value="monthly">包月</option>
                <option value="quarterly">包季</option>
                <option value="yearly">包年</option>
              </select>
            </div>

            <div className="form-row">
              <label className="form-label">套餐到期日（留空=永久）</label>
              <input className="form-input" type="date" value={newExpiry}
                onChange={e => setNewExpiry(e.target.value)} />
            </div>

            <div className="form-row">
              <label className="form-label">重置密码（留空不改）</label>
              <input className="form-input" type="password" placeholder="新密码"
                value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>

            <div className="modal-footer">
              <button className="submit-btn" onClick={updateUser}>保存</button>
              <button className="text-btn" onClick={() => setEditUser(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
