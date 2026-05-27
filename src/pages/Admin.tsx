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
  }

  const updateFeature = async (key: string, field: string, value: any) => {
    await fetch('/api/admin/features', {
      method: 'PUT', headers,
      body: JSON.stringify({ feature_key: key, [field]: value })
    })
    fetchFeatures()
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="text-btn" onClick={onBack}>← 返回</button>
        <h1 className="admin-title">管理后台</h1>
        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>用户管理</button>
          <button className={`admin-tab ${tab === 'features' ? 'active' : ''}`} onClick={() => setTab('features')}>功能开关</button>
        </div>
      </header>

      <div className="admin-body">
        {msg && <div className="admin-msg">{msg}</div>}

        {/* 用户管理 */}
        {tab === 'users' && (
          <div className="admin-section">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>邮箱</th><th>角色</th><th>套餐</th><th>到期时间</th><th>注册时间</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                    <td><span className={`badge badge-${u.plan}`}>{PLAN_LABELS[u.plan] || u.plan}</span></td>
                    <td>{u.plan_expires_at ? new Date(u.plan_expires_at).toLocaleDateString() : '—'}</td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="admin-btn" onClick={() => { setEditUser(u); setNewPlan(u.plan) }}>编辑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 编辑用户弹窗 */}
            {editUser && (
              <div className="admin-modal-overlay" onClick={() => setEditUser(null)}>
                <div className="admin-modal" onClick={e => e.stopPropagation()}>
                  <h3 className="modal-title">编辑用户：{editUser.email}</h3>

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
                    <label className="form-label">套餐到期日</label>
                    <input className="form-input" type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} />
                  </div>

                  <div className="form-row">
                    <label className="form-label">重置密码（留空不改）</label>
                    <input className="form-input" type="password" placeholder="新密码" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  </div>

                  <div className="modal-footer">
                    <button className="submit-btn" onClick={updateUser}>保存</button>
                    <button className="text-btn" onClick={() => setEditUser(null)}>取消</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 功能开关 */}
        {tab === 'features' && (
          <div className="admin-section">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>功能</th><th>模块</th><th>总开关</th><th>需要付费</th><th>免费次数/天</th>
                </tr>
              </thead>
              <tbody>
                {features.map(f => (
                  <tr key={f.feature_key}>
                    <td>{f.feature_name_zh}</td>
                    <td>{f.module}</td>
                    <td>
                      <label className="toggle">
                        <input type="checkbox" checked={f.is_enabled}
                          onChange={e => updateFeature(f.feature_key, 'is_enabled', e.target.checked)} />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                    <td>
                      <label className="toggle">
                        <input type="checkbox" checked={f.is_paid}
                          onChange={e => updateFeature(f.feature_key, 'is_paid', e.target.checked)} />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                    <td>
                      <input className="admin-number-input" type="number" min={0} max={99}
                        value={f.free_daily_limit}
                        onChange={e => updateFeature(f.feature_key, 'free_daily_limit', parseInt(e.target.value))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
