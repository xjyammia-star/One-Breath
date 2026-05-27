// src/pages/Auth.tsx
import { useState } from 'react'
import { useAuth } from '../utils/authContext'
import { Lang } from '../types'

interface Props {
  lang: Lang
  setLang: (l: Lang) => void
  onBack: () => void
}

const text = {
  zh: {
    login: '登录', register: '注册', email: '邮箱', password: '密码',
    confirmPassword: '确认密码', loginBtn: '登录', registerBtn: '注册',
    switchToRegister: '没有账号？注册', switchToLogin: '已有账号？登录',
    back: '← 返回', passwordMismatch: '两次密码不一致',
    tagline: '以炁通玄，洞见天命',
  },
  en: {
    login: 'Login', register: 'Register', email: 'Email', password: 'Password',
    confirmPassword: 'Confirm Password', loginBtn: 'Sign In', registerBtn: 'Create Account',
    switchToRegister: "Don't have an account? Register", switchToLogin: 'Already have an account? Login',
    back: '← Back', passwordMismatch: 'Passwords do not match',
    tagline: 'Seek the Tao, know your destiny',
  },
}

export default function Auth({ lang, setLang, onBack }: Props) {
  const t = text[lang]
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!email || !password) { setError('请填写邮箱和密码'); return }
    if (mode === 'register' && password !== confirm) { setError(t.passwordMismatch); return }

    setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="ink-mountains" />
      </div>

      <div className="lang-switcher">
        <button className={lang === 'zh' ? 'active' : ''} onClick={() => setLang('zh')}>中文</button>
        <span className="divider">|</span>
        <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
      </div>

      <div className="auth-panel">
        <div className="auth-header">
          <button className="back-btn" onClick={onBack}>{t.back}</button>
          <div className="auth-logo">
            <div className="auth-taiji">☯</div>
            <h1 className="auth-title-zh">一炁堂</h1>
            <p className="auth-tagline">{t.tagline}</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>
            {t.login}
          </button>
          <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>
            {t.register}
          </button>
        </div>

        <div className="auth-form">
          <div className="form-row">
            <label className="form-label">{t.email}</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div className="form-row">
            <label className="form-label">{t.password}</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {mode === 'register' && (
            <div className="form-row">
              <label className="form-label">{t.confirmPassword}</label>
              <input
                className="form-input"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
            <span>{loading ? '请稍候…' : mode === 'login' ? t.loginBtn : t.registerBtn}</span>
          </button>

          <button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? t.switchToRegister : t.switchToLogin}
          </button>
        </div>
      </div>
    </div>
  )
}
