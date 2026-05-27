// src/utils/authContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface AuthUser {
  id: number
  email: string
  role: 'user' | 'admin'
  plan: 'free' | 'monthly' | 'quarterly' | 'yearly'
  plan_expires_at?: string
}

interface AuthCtx {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('yiqitang_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (d.user) setUser(d.user) else logout() })
        .catch(logout)
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const saveAuth = (t: string, u: AuthUser) => {
    localStorage.setItem('yiqitang_token', t)
    setToken(t)
    setUser(u)
  }

  const login = async (email: string, password: string) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || '登录失败')
    saveAuth(d.token, d.user)
  }

  const register = async (email: string, password: string) => {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || '注册失败')
    saveAuth(d.token, d.user)
  }

  const logout = () => {
    localStorage.removeItem('yiqitang_token')
    setToken(null)
    setUser(null)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
