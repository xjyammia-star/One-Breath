// src/pages/Dashboard.tsx
import { useState } from 'react'
import { useAuth } from '../utils/authContext'
import { UserProfile, Lang, Module, AnalysisResult } from '../types'
import { analyzeWithDeepSeek } from '../utils/ai'
import { getBaZi } from '../utils/bazi'

interface Props {
  lang: Lang
  setLang: (l: Lang) => void
  user: UserProfile
  onBack: () => void
  onReset: () => void
  onAdmin?: () => void
}

const text = {
  zh: {
    greeting: (name: string) => `${name}的命盘`,
    modules: [
      { id: 'self' as Module,   icon: '☲', name: '与己',   sub: '自身命盘·五行·格局' },
      { id: 'people' as Module, icon: '☯', name: '与人',   sub: '关系·合婚·人际' },
      { id: 'world' as Module,  icon: '☰', name: '与世界', sub: '时运·流年·世界能量' },
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
    genderMap: { male: '男', female: '女', other: '其他' },
  },
  en: {
    greeting: (name: string) => `${name}'s Chart`,
    modules: [
      { id: 'self' as Module,   icon: '☲', name: 'The Self',    sub: 'Birth chart · Elements · Pattern' },
      { id: 'people' as Module, icon: '☯', name: 'Relations',   sub: 'Compatibility · Bonds · People' },
      { id: 'world' as Module,  icon: '☰', name: 'The World',   sub: 'Timing · Annual cycle · Energy' },
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
    genderMap: { male: 'Male', female: 'Female', other: 'Other' },
  },
}

export default function Dashboard({ lang, setLang, user, onBack, onReset, onAdmin }: Props) {
  const t = text[lang]
  const { user: authUser, logout } = useAuth()
  const [activeModule, setActiveModule] = useState<Module>('self')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<AnalysisResult[]>([])

  const bazi = getBaZi(user.birthYear, user.birthMonth, user.birthDay, user.birthHour)
  const currentMod = t.modules.find(m => m.id === activeModule)!
  const quickQ = activeModule === 'self' ? t.selfQuestions
               : activeModule === 'people' ? t.peopleQuestions
               : t.worldQuestions

  const handleSend = async (q?: string) => {
    const question = q || query
    if (!question.trim()) return

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
    } catch {
      setResults(prev => [{
        module: activeModule,
        query: question,
        response: lang === 'zh'
          ? '天机难测，请稍后再试。（API连接失败）'
          : 'The oracle is momentarily silent. Please try again.',
        timestamp: new Date().toISOString(),
      }, ...prev])
    }

    setLoading(false)
  }

  return (
    <div className="dashboard">
      {/* 顶栏 */}
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
            <button className="text-btn" onClick={onAdmin}>
              {lang === 'zh' ? '管理后台' : 'Admin'}
            </button>
          )}
          <button className="text-btn" onClick={() => { logout(); onBack() }}>
            {lang === 'zh' ? '退出' : 'Logout'}
          </button>
          <button className="text-btn danger" onClick={onReset}>{t.reset}</button>
        </div>
      </header>

      <div className="dash-body">
        {/* 左侧：用户信息 + 模块选择 */}
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

          {/* 模块选择 */}
          <nav className="module-nav">
            {t.modules.map(mod => (
              <button
                key={mod.id}
                className={`module-nav-btn ${activeModule === mod.id ? 'active' : ''}`}
                onClick={() => setActiveModule(mod.id)}
              >
                <span className="module-nav-icon">{mod.icon}</span>
                <div className="module-nav-text">
                  <span className="module-nav-name">{mod.name}</span>
                  <span className="module-nav-sub">{mod.sub}</span>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        {/* 右侧：问答区 */}
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
