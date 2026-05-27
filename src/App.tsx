// src/App.tsx
import { useState } from 'react'
import { AuthProvider, useAuth } from './utils/authContext'
import Landing from './pages/Landing'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import Auth from './pages/Auth'
import Admin from './pages/Admin'
import { UserProfile } from './types'

export type Page = 'landing' | 'auth' | 'setup' | 'dashboard' | 'admin'

function AppInner() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState<Page>('landing')
  const [lang, setLang] = useState<'zh' | 'en'>('zh')
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('yiqitang_user')
    return saved ? JSON.parse(saved) : null
  })

  const saveProfile = (p: UserProfile) => {
    localStorage.setItem('yiqitang_user', JSON.stringify(p))
    setProfile(p)
    setPage('dashboard')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0ead8' }}>
        <div style={{ fontSize: '2rem', color: '#9b7d3a', letterSpacing: '0.3em' }}>一炁堂</div>
      </div>
    )
  }

  const handleEnter = () => {
    if (!user) { setPage('auth'); return }
    if (profile) setPage('dashboard')
    else setPage('setup')
  }

  return (
    <div className={`app lang-${lang}`}>
      {page === 'landing' && (
        <Landing lang={lang} setLang={setLang} onEnter={handleEnter} hasUser={!!profile} />
      )}
      {page === 'auth' && (
        <Auth lang={lang} setLang={setLang} onBack={() => setPage('landing')} />
      )}
      {page === 'setup' && user && (
        <Setup lang={lang} onSave={saveProfile} onBack={() => setPage('landing')} />
      )}
      {page === 'dashboard' && user && profile && (
        <Dashboard
          lang={lang} setLang={setLang} user={profile}
          onBack={() => setPage('landing')}
          onAdmin={() => setPage('admin')}
          onReset={() => {
            localStorage.removeItem('yiqitang_user')
            setProfile(null)
            setPage('setup')
          }}
        />
      )}
      {page === 'admin' && user?.role === 'admin' && (
        <Admin lang={lang} onBack={() => setPage('dashboard')} />
      )}
      {/* 登录成功后自动跳转 */}
      {user && page === 'auth' && (() => {
        setTimeout(() => setPage(profile ? 'dashboard' : 'setup'), 0)
        return null
      })()}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
