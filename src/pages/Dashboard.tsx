// src/pages/Dashboard.tsx
import { useState } from 'react'
import { useAuth } from '../utils/authContext'
import { UserProfile, Lang, Module, AnalysisResult } from '../types'
import { analyzeWithDeepSeek, ApiError, FeatureKey, ParsedResponse } from '../utils/ai'
import { getBaZi } from '../utils/bazi'

interface Props {
  lang: Lang
  setLang: (l: Lang) => void
  user: UserProfile
  onBack: () => void
  onReset: () => void
  onAdmin?: () => void
  onLogin?: () => void
}

// 扩展 AnalysisResult，增加推理字段
interface ExtendedResult extends AnalysisResult {
  reasoning?: string
}

const MODULE_FEATURES: Record<Module, { basic: FeatureKey; deep: FeatureKey }> = {
  self:   { basic: 'self_basic',   deep: 'self_deep'    },
  people: { basic: 'people_basic', deep: 'people_deep'  },
  world:  { basic: 'world_year',   deep: 'world_timing' },
}

const LOGIN_REQUIRED_MODULES: Module[] = ['people', 'world']
const PAID_PLANS = ['monthly', 'quarterly', 'yearly']

const text = {
  zh: {
    greeting: (name: string) => `${name}的命盘`,
    modules: [
      { id: 'self' as Module,   icon: '☲', name: '与己',   sub: '自身命盘·五行·格局',  locked: false },
      { id: 'people' as Module, icon: '☯', name: '与人',   sub: '关系·合婚·人际',       locked: true  },
      { id: 'world' as Module,  icon: '☰', name: '与世界', sub: '时运·流年·世界能量',   locked: true  },
    ],
    depthTabs: { basic: '基础', deep: '深度' },
    depthDesc: {
      self:   { basic: '五行概况·性格·今年运势', deep: '十神格局·用神·大运流年·深度解析' },
      people: { basic: '五行相合·关系优劣', deep: '日柱配对·婚姻宫·合冲·走势预判' },
      world:  { basic: '流年五行·今年影响', deep: '择吉时机·方位·行业·避忌' },
    },
    birthInfo: '生辰', lunarLabel: '农历', bazi: '八字',
    askPlaceholder: '在此输入您的问题，天地之气为您指引……',
    send: '问卦', sending: '推算中…',
    quickQ: {
      self_basic:   ['我的命局五行如何？', '我的性格优势与弱点是什么？', '今年整体运势如何？'],
      self_deep:    ['帮我分析十神格局', '我的用神是什么？', '当前大运对我有何影响？'],
      people_basic: ['我与对方的五行相合吗？', '我们的关系格局如何？', '如何改善与某人的关系？'],
      people_deep:  ['帮我做详细合婚分析', '我们的日柱配对如何？', '这段关系未来走势如何？'],
      world_year:   ['当前世界能量场是什么状态？', '今年的年运有何提示？', '哪个方向有利于我的发展？'],
      world_timing: ['今年哪个月最适合重大决策？', '我适合往哪个方向发展？', '今年有哪些时间需要避忌？'],
    },
    reset: '重置命盘', langSwitch: 'EN', back: '← 主页',
    login: '登录', logout: '退出', admin: '管理后台',
    genderMap: { male: '男', female: '女', other: '其他' },
    loginRequired: '此功能需要登录',
    loginRequiredDesc: '登录后即可使用「与人」「与世界」模块，并获得每日免费次数。',
    paidRequired: '深度解读需要订阅',
    paidRequiredDesc: '深度解读功能需要订阅会员后使用，包含十神格局、用神忌神、大运流年等专业分析。',
    goLogin: '登录 / 注册', goSubscribe: '了解订阅套餐', cancel: '暂不',
    limitReached: '今日次数已用完',
    limitDesc: '您今日的免费次数已用完。登录账号后可获得更多次数，订阅会员可无限使用。',
    goLoginForMore: '登录获取更多次数',
    showReasoning: '展开推理过程',
    hideReasoning: '收起推理过程',
    reasoningTitle: '命理推演过程',
    reasoningNote: '以下为详细推演，供参考验证',
    conclusionTitle: '解读与建议',
    noReasoning: '（基础模式不含推演过程，切换至深度模式可查看完整推算）',
  },
  en: {
    greeting: (name: string) => `${name}'s Chart`,
    modules: [
      { id: 'self' as Module,   icon: '☲', name: 'The Self',    sub: 'Birth chart · Elements · Pattern',  locked: false },
      { id: 'people' as Module, icon: '☯', name: 'Relations',   sub: 'Compatibility · Bonds · People',    locked: true  },
      { id: 'world' as Module,  icon: '☰', name: 'The World',   sub: 'Timing · Annual cycle · Energy',    locked: true  },
    ],
    depthTabs: { basic: 'Basic', deep: 'Deep' },
    depthDesc: {
      self:   { basic: 'Elements · Character · This Year', deep: 'Ten Gods · Useful God · Da Yun · Full Analysis' },
      people: { basic: 'Elemental Fit · Relationship', deep: 'Day Pillar · Marriage Palace · Cycles' },
      world:  { basic: 'Annual Elements · Year Impact', deep: 'Timing · Directions · Industries · Cautions' },
    },
    birthInfo: 'Birth', lunarLabel: 'Lunar', bazi: 'Ba Zi',
    askPlaceholder: 'Ask the oracle anything — heaven and earth shall answer…',
    send: 'Consult', sending: 'Reading…',
    quickQ: {
      self_basic:   ['What are my dominant elements?', 'What are my core strengths and challenges?', 'What does this year hold for me?'],
      self_deep:    ['Analyze my Ten Gods pattern', 'What is my useful god?', 'How does my current Da Yun affect me?'],
      people_basic: ['Are we elementally compatible?', 'What is the nature of our bond?', 'How can I improve this relationship?'],
      people_deep:  ['Give me a full compatibility reading', 'How do our Day Pillars pair?', "What's the trajectory of this relationship?"],
      world_year:   ['What is the current world energy?', 'What guidance does this year offer?', 'Which direction favors my growth?'],
      world_timing: ['Which month is best for major decisions?', 'Which direction should I focus on?', 'What periods should I avoid?'],
    },
    reset: 'Reset Chart', langSwitch: '中文', back: '← Home',
    login: 'Login', logout: 'Logout', admin: 'Admin',
    genderMap: { male: 'Male', female: 'Female', other: 'Other' },
    loginRequired: 'Login Required',
    loginRequiredDesc: 'Sign in to access Relations and The World modules, plus daily free readings.',
    paidRequired: 'Subscription Required',
    paidRequiredDesc: 'Deep readings require a subscription. Includes Ten Gods, Useful God, Da Yun cycles, and more.',
    goLogin: 'Login / Register', goSubscribe: 'View Plans', cancel: 'Maybe Later',
    limitReached: 'Daily Limit Reached',
    limitDesc: "You've used your free readings for today. Login for more, or subscribe for unlimited access.",
    goLoginForMore: 'Login for More',
    showReasoning: 'Show Reasoning',
    hideReasoning: 'Hide Reasoning',
    reasoningTitle: 'Reasoning Process',
    reasoningNote: 'Detailed derivation for verification',
    conclusionTitle: 'Reading & Guidance',
    noReasoning: '(Basic mode does not include full reasoning. Switch to Deep mode for complete derivation.)',
  },
}

type ModalType = 'login_required' | 'limit_reached' | 'paid_required' | null
type DepthMode = 'basic' | 'deep'

// 单个结果卡片组件（含展开/收起推理）
function ResultCard({ result, lang }: { result: ExtendedResult; lang: 'zh' | 'en' }) {
  const [showReasoning, setShowReasoning] = useState(false)
  const t = text[lang]

  return (
    <div className="result-card">
      <div className="result-header">
        <span className="result-q">「{result.query}」</span>
        <span className="result-time">{new Date(result.timestamp).toLocaleTimeString()}</span>
      </div>

      {/* 结论区（始终显示）*/}
      <div className="result-section result-conclusion">
        <div className="result-section-label">{t.conclusionTitle}</div>
        <div className="result-body">{result.response}</div>
      </div>

      {/* 推理区（可展开）*/}
      <div className="result-reasoning-toggle">
        {result.reasoning ? (
          <>
            <button
              className="reasoning-toggle-btn"
              onClick={() => setShowReasoning(v => !v)}
            >
              <span className="reasoning-toggle-icon">{showReasoning ? '▲' : '▼'}</span>
              {showReasoning ? t.hideReasoning : t.showReasoning}
            </button>
            {showReasoning && (
              <div className="result-section result-reasoning">
                <div className="result-section-label">
                  {t.reasoningTitle}
                  <span className="reasoning-note">{t.reasoningNote}</span>
                </div>
                <div className="result-body reasoning-body">{result.reasoning}</div>
              </div>
            )}
          </>
        ) : (
          <p className="reasoning-unavailable">{t.noReasoning}</p>
        )}
      </div>
    </div>
  )
}

export default function Dashboard({ lang, setLang, user, onBack, onReset, onAdmin, onLogin }: Props) {
  const t = text[lang]
  const { user: authUser, logout } = useAuth()
  const [activeModule, setActiveModule] = useState<Module>('self')
  const [depthMode, setDepthMode] = useState<DepthMode>('basic')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ExtendedResult[]>([])
  const [modal, setModal] = useState<ModalType>(null)

  const bazi = getBaZi(user.birthYear, user.birthMonth, user.birthDay, user.birthHour)
  const currentMod = t.modules.find(m => m.id === activeModule)!
  const featureKey: FeatureKey = MODULE_FEATURES[activeModule][depthMode]
  const quickQ = (t.quickQ as any)[featureKey] || []
  const currentDesc = (t.depthDesc as any)[activeModule][depthMode]
  const hasPaid = authUser && PAID_PLANS.includes(authUser.plan)

  const handleModuleSwitch = (modId: Module) => {
    if (LOGIN_REQUIRED_MODULES.includes(modId) && !authUser) {
      setModal('login_required'); return
    }
    setActiveModule(modId)
    setDepthMode('basic')
  }

  const handleDepthSwitch = (mode: DepthMode) => {
    if (mode === 'deep') {
      if (!authUser) { setModal('login_required'); return }
      if (!hasPaid)  { setModal('paid_required');  return }
    }
    setDepthMode(mode)
  }

  const handleSend = async (q?: string) => {
    const question = q || query
    if (!question.trim()) return

    if (LOGIN_REQUIRED_MODULES.includes(activeModule) && !authUser) {
      setModal('login_required'); return
    }
    if (depthMode === 'deep' && !hasPaid) {
      setModal('paid_required'); return
    }

    setLoading(true)
    setQuery('')

    try {
      const parsed: ParsedResponse = await analyzeWithDeepSeek({
        user, bazi, module: activeModule, featureKey, question, lang,
      })

      setResults(prev => [{
        module: activeModule,
        query: question,
        response: parsed.conclusion,
        reasoning: parsed.reasoning,
        timestamp: new Date().toISOString(),
      }, ...prev])

    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'LOGIN_REQUIRED')     { setModal('login_required');  setLoading(false); return }
        if (err.code === 'ANON_LIMIT_REACHED') { setModal('limit_reached');   setLoading(false); return }
        if (err.code === 'PAID_REQUIRED')      { setModal('paid_required');   setLoading(false); return }
      }
      setResults(prev => [{
        module: activeModule,
        query: question,
        response: lang === 'zh' ? '天机难测，请稍后再试。（连接失败）' : 'The oracle is momentarily silent. Please try again.',
        reasoning: '',
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
              {modal === 'login_required' ? t.loginRequired
               : modal === 'paid_required' ? t.paidRequired
               : t.limitReached}
            </h3>
            <p className="modal-desc">
              {modal === 'login_required' ? t.loginRequiredDesc
               : modal === 'paid_required' ? t.paidRequiredDesc
               : t.limitDesc}
            </p>
            <div className="modal-actions">
              <button className="modal-btn-primary" onClick={() => { setModal(null); onLogin?.() }}>
                {modal === 'paid_required' ? t.goSubscribe
                 : modal === 'limit_reached' ? t.goLoginForMore
                 : t.goLogin}
              </button>
              <button className="modal-btn-secondary" onClick={() => setModal(null)}>{t.cancel}</button>
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
          <button className="text-btn" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>{t.langSwitch}</button>
          {authUser?.role === 'admin' && onAdmin && (
            <button className="text-btn" onClick={onAdmin}>{t.admin}</button>
          )}
          {authUser ? (
            <button className="text-btn" onClick={() => { logout(); onBack() }}>{t.logout}</button>
          ) : (
            <button className="text-btn" onClick={onLogin}>{t.login}</button>
          )}
          <button className="text-btn danger" onClick={onReset}>{t.reset}</button>
        </div>
      </header>

      <div className="dash-body">
        {/* ── 左侧 ── */}
        <aside className="dash-sidebar">
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
                <span className="date-val">{user.birthYear}/{user.birthMonth}/{user.birthDay} {user.birthHour}:00</span>
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

        {/* ── 右侧 ── */}
        <main className="dash-main">
          <div className="module-header">
            <span className="module-header-icon">{currentMod.icon}</span>
            <div className="module-header-info">
              <h2 className="module-header-name">{currentMod.name}</h2>
              <p className="module-header-sub">{currentDesc}</p>
            </div>
            <div className="depth-tabs">
              <button
                className={`depth-tab ${depthMode === 'basic' ? 'active' : ''}`}
                onClick={() => handleDepthSwitch('basic')}
              >{t.depthTabs.basic}</button>
              <button
                className={`depth-tab ${depthMode === 'deep' ? 'active' : ''} ${!hasPaid ? 'depth-tab-locked' : ''}`}
                onClick={() => handleDepthSwitch('deep')}
              >
                {t.depthTabs.deep}
                {!hasPaid && <span className="depth-lock-icon">🔒</span>}
              </button>
            </div>
          </div>

          <div className="quick-questions">
            {quickQ.map((q: string, i: number) => (
              <button key={i} className="quick-q-btn" onClick={() => handleSend(q)}>{q}</button>
            ))}
          </div>

          <div className="ask-area">
            <textarea
              className="ask-textarea"
              placeholder={t.askPlaceholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              rows={3}
            />
            <button
              className={`ask-btn ${loading ? 'loading' : ''}`}
              onClick={() => handleSend()}
              disabled={loading}
            >{loading ? t.sending : t.send}</button>
          </div>

          <div className="results-area">
            {results.length === 0 && !loading && (
              <div className="results-empty">
                <div className="empty-glyph">☯</div>
                <p>{lang === 'zh' ? '天地静待，问则应。' : 'Heaven and Earth await your question.'}</p>
              </div>
            )}
            {loading && (
              <div className="result-loading">
                <div className="loading-dots"><span /><span /><span /></div>
                <p>{lang === 'zh' ? '天机推演中…' : 'Reading the signs…'}</p>
              </div>
            )}
            {results.map((r, i) => (
              <ResultCard key={i} result={r} lang={lang} />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
