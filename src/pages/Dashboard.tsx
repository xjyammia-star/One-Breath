// src/pages/Dashboard.tsx
import { useState } from 'react'
import { useAuth } from '../utils/authContext'
import { UserProfile, Lang, Module, AnalysisResult } from '../types'
import { analyzeWithDeepSeek, ApiError } from '../utils/ai'
import { getBaZi } from '../utils/bazi'

interface Props {
  lang: Lang
  setLang: (l: Lang) => void
  user: UserProfile
  onBack: () => void
  onReset: () => void
  onAdmin?: () => void
  onLogin?: () => void    // 跳转登录页
}

// 需要登录才能使用的模块
const LOGIN_REQUIRED_MODULES: Module[] = ['people', 'world']

const text = {
  zh: {
    greeting: (name: string) => `${name}的命盘`,
    modules: [
      { id: 'self' as Module,   icon: '☲', name: '与己',   sub: '自身命盘·五行·格局',  locked: false },
      { id: 'people' as Module, icon: '☯', name: '与人',   sub: '关系·合婚·人际',       locked: true  },
      { id: 'world' as Module,  icon: '☰', name: '与世界', sub: '时运·流年·世界能量',   locked: true  },
    ],
    birthInfo: '生辰',
    lunarLabel: '农历',
    bazi: '八字',
    askPlaceholder: '在此输入您的问题，天地之气为您指引……',
    send: '问卦',
    sending: '推算中…',
    selfQuestions: [
      '我的命局五行如何？',
      '我的性格优势与弱点是什么？',
      '今年整体运势如何？',
    ],
    peopleQuestions: [
      '我与对方的五行相合吗？',
      '我们的关系格局如何？',
      '如何改善与某人的关系？',
    ],
    worldQuestions: [
      '当前世界能量场是什么状态？',
      '今年的年运有何提示？',
      '哪个方向有利于我的发展？',
    ],
    reset: '重置命盘',
    langSwitch: 'EN',
    back: '← 主页',
    login: '登录',
    logout: '退出',
    admin: '管理后台',
    genderMap: { male: '男', female: '女', other: '其他' },
    // 浮层文字
    loginRequired: '此功能需要登录',
    loginRequiredDesc: '登录后即可使用「与人」「与世界」模块，并获得每日免费次数。',
    goLogin: '登录 / 注册',
    cancel: '暂不登录',
    limitReached: '今日次数已用完',
    limitDesc: '您今日的免费次数已用完。登录账号后可获得更多次数，订阅会员可无限使用。',
    goLoginForMore: '登录获取更多次数',
  },
  en: {
    greeting: (name: string) => `${name}'s Chart`,
    modules: [
      { id: 'self' as Module,   icon: '☲', name: 'The Self',    sub: 'Birth chart · Elements · Pattern',  locked: false },
      { id: 'people' as Module, icon: '☯', name: 'Relations',   sub: 'Compatibility · Bonds · People',    locked: true  },
      { id: 'world' as Module,  icon: '☰', name: 'The World',   sub: 'Timing · Annual cycle · Energy',    locked: true  },
    ],
    birthInfo: 'Birth',
    lunarLabel: 'Lunar',
    bazi: 'Ba Zi',
    askPlaceholder: 'Ask the oracle anything — heaven and earth shall answer…',
    send: 'Consult',
    sending: 'Reading…',
    selfQuestions: [
      'What are my dominant elements?',
      'What are my core strengths and challenges?',
      'What does this year hold for me?',
    ],
    peopleQuestions: [
      'Are we elementally compatible?',
      'What is the nature of our bond?',
      'How can I improve this relationship?',
    ],
    worldQuestions: [
      'What is the current world energy?',
      'What guidance does this year offer?',
      'Which direction favors my growth?',
    ],
    reset: 'Reset Chart',
    langSwitch: '中文',
    back: '← Home',
    login: 'Login',
    logout: 'Logout',
    admin: 'Admin',
    genderMap: { male: 'Male', female: 'Female', other: 'Other' },
    // modal text
    loginRequired: 'Login Required',
    loginRequiredDesc: 'Sign in to access Relations and The World modules, plus daily free readings.',
    goLogin: 'Login / Register',
    cancel: 'Maybe Later',
    limitReached: 'Daily Limit Reached',
    limitDesc: "You've used your free readings for today. Login for more, or subscribe for unlimited access.",
    goLoginForMore: 'Login for More',
  },
}

// 浮层类型
type ModalType = 'login_required' | 'limit_reached' | null

export default function Dashboard({ lang, setLang, user, onBack, onReset, onAdmin, onLogin }: Props) {
  const t = text[lang]
  const { user: authUser, logout } = useAuth()
  const [activeModule, setActiveModule] = useState<Module>('self')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [modal, setModal] = useState<ModalType>(null)

  const bazi = getBaZi(user.birthYear, user.birthMonth, user.birthDay, user.birthHour)
  const currentMod = t.modules.find(m => m.id === activeModule)!
  const quickQ = activeModule === 'self' ? t.selfQuestions
               : activeModule === 'people' ? t.peopleQuestions
               : t.worldQuestions

  // 切换模块时检查是否需要登录
  const handleModuleSwitch = (modId: Module) => {
    if (LOGIN_REQUIRED_MODULES.includes(modId) && !authUser) {
      setModal('login_required')
      return
    }
    setActiveModule(modId)
  }

  const handleSend = async (q?: string) => {
    const question = q || query
    if (!question.trim()) return

    // 当前模块需要登录但未登录
    if (LOGIN_REQUIRED_MODULES.includes(activeModule) && !authUser) {
      setModal('login_required')
      return
    }

    setLoading(true)
    setQuery('')

    try {
      const response = await analyzeWithDeepSeek({
        user,
        bazi,
        module: activeModule,
        question,
        lang,
      })

      setResults(prev => [{
        module: activeModule,
        query: question,
        response,
        timestamp: new Date().toISOString(),
      }, ...prev])

    } catch (err) {
      // 根据错误码显示不同浮层
      if (err instanceof ApiError) {
        if (err.code === 'LOGIN_REQUIRED') {
          setModal('login_required')
          setLoading(false)
          return
        }
        if (err.code === 'ANON_LIMIT_REACHED') {
          setModal('limit_reached')
          setLoading(false)
          return
        }
      }
      // 其他错误正常显示在结果区
      setResults(prev => [{
        module: activeModule,
        query: question,
        response: lang === 'zh'
          ? '天机难测，请稍后再试。（连接失败）'
          : 'The oracle is momentarily silent. Please try again.',
        timestamp: new Date().toISOString(),
      }, ...prev])
    }

    setLoading(false)
  }

  return (
    <div className="dashboard">

      {/* ── 提示浮层 ── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">☯</div>
            <h3 className="modal-title">
              {modal === 'login_required' ? t.loginRequired : t.limitReached}
            </h3>
            <p className="modal-desc">
              {modal === 'login_required' ? t.loginRequiredDesc : t.limitDesc}
            </p>
            <div className="modal-actions">
              <button
                className="modal-btn-primary"
                onClick={() => { setModal(null); onLogin?.() }}
              >
                {modal === 'login_required' ? t.goLogin : t.goLoginForMore}
              </button>
              <button
                className="modal-btn-secondary"
                onClick={() => setModal(null)}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 顶栏 ── */}
      <header className="dash-header">
        <div className="dash-header-left">
          <button className="text-btn" onClick={onBack}>{t.back}</button>
          <h1 className="dash-title">{t.greeting(user.name)}</h1>
        </div>
        <div className="dash-header-right">
          <button className="text-btn" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
            {t.langSwitch}
          </button>
          {authUser?.role === 'admin' && onAdmin && (
            <button className="text-btn" onClick={onAdmin}>{t.admin}</button>
          )}
          {authUser ? (
            <button className="text-btn" onClick={() => { logout(); onBack() }}>
              {t.logout}
            </button>
          ) : (
            <button className="text-btn" onClick={onLogin}>
              {t.login}
            </button>
          )}
          <button className="text-btn danger" onClick={onReset}>{t.reset}</button>
        </div>
      </header>

      <div className="dash-body">

        {/* ── 左侧：用户信息 + 模块选择 ── */}
        <aside className="dash-sidebar">

          {/* 命盘信息 */}
          <div className="profile-card">
            <div className="profile-avatar">
              <span className="avatar-glyph">
                {user.gender === 'male' ? '乾' : user.gender === 'female' ? '坤' : '中'}
              </span>
            </div>
            <div className="profile-name">{user.name}</div>
            <div className="profile-gender">{t.genderMap[user.gender]}</div>

            <div className="profile-dates">
              <div className="date-row">
                <span className="date-label">{t.birthInfo}：</span>
                <span className="date-val">
                  {user.birthYear}/{user.birthMonth}/{user.birthDay} {user.birthHour}:00
                </span>
              </div>
              {user.lunarDate && (
                <div className="date-row">
                  <span className="date-label">{t.lunarLabel}：</span>
                  <span className="date-val">{user.lunarDate}</span>
                </div>
              )}
              <div className="date-row">
                <span className="date-label">{lang === 'zh' ? '地点' : 'Place'}：</span>
                <span className="date-val">{user.birthPlace}</span>
              </div>
            </div>

            {/* 八字显示 */}
            <div className="bazi-display">
              <div className="bazi-label">{t.bazi}</div>
              <div className="bazi-pillars">
                {[
                  { top: bazi.yearGan,  bot: bazi.yearZhi,  lbl: lang === 'zh' ? '年' : 'Year' },
                  { top: bazi.monthGan, bot: bazi.monthZhi, lbl: lang === 'zh' ? '月' : 'Month' },
                  { top: bazi.dayGan,   bot: bazi.dayZhi,   lbl: lang === 'zh' ? '日' : 'Day' },
                  { top: bazi.hourGan,  bot: bazi.hourZhi,  lbl: lang === 'zh' ? '时' : 'Hour' },
                ].map((p, i) => (
                  <div key={i} className="bazi-pillar">
                    <div className="pillar-label">{p.lbl}</div>
                    <div className="pillar-gan">{p.top}</div>
                    <div className="pillar-zhi">{p.bot}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 模块选择：锁定的模块显示锁图标 */}
          <nav className="module-nav">
            {t.modules.map(mod => {
              const isLocked = mod.locked && !authUser
              return (
                <button
                  key={mod.id}
                  className={`module-nav-btn ${activeModule === mod.id ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                  onClick={() => handleModuleSwitch(mod.id)}
                >
                  <span className="module-nav-icon">{mod.icon}</span>
                  <div className="module-nav-text">
                    <span className="module-nav-name">{mod.name}</span>
                    <span className="module-nav-sub">{mod.sub}</span>
                  </div>
                  {isLocked && <span className="module-lock">🔒</span>}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* ── 右侧：问答区 ── */}
        <main className="dash-main">

          {/* 模块标题 */}
          <div className="module-header">
            <span className="module-header-icon">{currentMod.icon}</span>
            <div>
              <h2 className="module-header-name">{currentMod.name}</h2>
              <p className="module-header-sub">{currentMod.sub}</p>
            </div>
          </div>

          {/* 快捷问题 */}
          <div className="quick-questions">
            {quickQ.map((q, i) => (
              <button key={i} className="quick-q-btn" onClick={() => handleSend(q)}>
                {q}
              </button>
            ))}
          </div>

          {/* 输入区 */}
          <div className="ask-area">
            <textarea
              className="ask-textarea"
              placeholder={t.askPlaceholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              rows={3}
            />
            <button
              className={`ask-btn ${loading ? 'loading' : ''}`}
              onClick={() => handleSend()}
              disabled={loading}
            >
              {loading ? t.sending : t.send}
            </button>
          </div>

          {/* 结果区 */}
          <div className="results-area">
            {results.length === 0 && !loading && (
              <div className="results-empty">
                <div className="empty-glyph">☯</div>
                <p>{lang === 'zh' ? '天地静待，问则应。' : 'Heaven and Earth await your question.'}</p>
              </div>
            )}
            {loading && (
              <div className="result-loading">
                <div className="loading-dots">
                  <span /><span /><span />
                </div>
                <p>{lang === 'zh' ? '天机推演中…' : 'Reading the signs…'}</p>
              </div>
            )}
            {results.map((r, i) => (
              <div key={i} className="result-card">
                <div className="result-header">
                  <span className="result-q">「{r.query}」</span>
                  <span className="result-time">
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="result-body">{r.response}</div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
