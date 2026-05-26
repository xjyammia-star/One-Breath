// src/App.tsx
import { useState } from 'react'
import Landing from './pages/Landing'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import { UserProfile } from './types'

export type Page = 'landing' | 'setup' | 'dashboard'

function App() {
  const [page, setPage] = useState<Page>('landing')
  const [lang, setLang] = useState<'zh' | 'en'>('zh')
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('yiqitang_user')
    return saved ? JSON.parse(saved) : null
  })

  const saveUser = (profile: UserProfile) => {
    localStorage.setItem('yiqitang_user', JSON.stringify(profile))
    setUser(profile)
    setPage('dashboard')
  }

  return (
    <div className={`app lang-${lang}`}>
      {page === 'landing' && (
        <Landing
          lang={lang}
          setLang={setLang}
          onEnter={() => setPage(user ? 'dashboard' : 'setup')}
          hasUser={!!user}
        />
      )}
      {page === 'setup' && (
        <Setup lang={lang} onSave={saveUser} onBack={() => setPage('landing')} />
      )}
      {page === 'dashboard' && user && (
        <Dashboard
          lang={lang}
          setLang={setLang}
          user={user}
          onBack={() => setPage('landing')}
          onReset={() => {
            localStorage.removeItem('yiqitang_user')
            setUser(null)
            setPage('setup')
          }}
        />
      )}
    </div>
  )
}

export default App
