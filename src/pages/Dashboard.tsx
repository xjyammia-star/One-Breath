// src/pages/Dashboard.tsx
import { useState } from 'react'
import { useAuth } from '../utils/authContext'
import { UserProfile, Lang, Module, AnalysisResult } from '../types'
import { analyzeWithDeepSeek, ApiError, FeatureKey, ParsedResponse, CorpusSource } from '../utils/ai'
import { getBaZi, getDaYun, formatDaYun } from '../utils/bazi'
import OracleLoader from '../components/OracleLoader'

interface Props {
  lang: Lang
  setLang: (l: Lang) => void
  user: UserProfile
  initialModule: number
  onBack: () => void
  onReset: () => void
  onAdmin?: () => void
  onLogin?: () => void
}

interface ExtendedResult extends AnalysisResult {
  reasoning?: string
  sources?: Array<{ title: string; excerpt: string }>
}

const MODULE_FEATURES: Record<Module, { basic: FeatureKey; deep: FeatureKey }> = {
  self:   { basic: 'self_basic',   deep: 'self_deep'    },
  people: { basic: 'people_basic', deep: 'people_deep'  },
  world:  { basic: 'world_year',   deep: 'world_timing' },
}

const MODULE_IDS: Module[] = ['self', 'people', 'world']
const LOGIN_REQUIRED_MODULES: Module[] = ['people', 'world']
const PAID_PLANS = ['monthly', 'quarterly', 'yearly']

// 五行颜色（加深，确保可读性）
const WUXING_COLORS: Record<string, string> = {
  木: '#2d6e45', 火: '#b52a1e', 土: '#7a5f1a', 金: '#5a7a9e', 水: '#1e6657',
}
const WUXING_STROKE: Record<string, string> = {
  木: '#3a8a56', 火: '#d03525', 土: '#9b7a20', 金: '#6a8fb5', 水: '#26837a',
}

const GAN_WUXING: Record<string, string> = {
  甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',
  庚:'金',辛:'金',壬:'水',癸:'水',
}

// 地支主气五行（与 AI 保持一致：每个地支只算主气=1整数）
const ZHI_WUXING: Record<string, string> = {
  子:'水', 丑:'土', 寅:'木', 卯:'木', 辰:'土', 巳:'火',
  午:'火', 未:'土', 申:'金', 酉:'金', 戌:'土', 亥:'水',
}

// 地支藏干（仅用于地支文字颜色着色，不参与计数）
const ZHI_CANGGAN: Record<string, Record<string, number>> = {
  子: { 水: 1.0 },
  丑: { 土: 1.0, 金: 0.5, 水: 0.25 },
  寅: { 木: 1.0, 火: 0.5, 土: 0.25 },
  卯: { 木: 1.0 },
  辰: { 土: 1.0, 木: 0.5, 水: 0.25 },
  巳: { 火: 1.0, 土: 0.5, 金: 0.25 },
  午: { 火: 1.0, 土: 0.5 },
  未: { 土: 1.0, 火: 0.5, 木: 0.25 },
  申: { 金: 1.0, 水: 0.5, 土: 0.25 },
  酉: { 金: 1.0 },
  戌: { 土: 1.0, 火: 0.5, 金: 0.25 },
  亥: { 水: 1.0, 木: 0.5 },
}

const GAN_YIN_YANG: Record<string, string> = {
  甲:'阳',乙:'阴',丙:'阳',丁:'阴',戊:'阳',己:'阴',
  庚:'阳',辛:'阴',壬:'阳',癸:'阴',
}
const ZHI_ZODIAC: Record<string, string> = {
  子:'鼠',丑:'牛',寅:'虎',卯:'兔',辰:'龙',巳:'蛇',
  午:'马',未:'羊',申:'猴',酉:'鸡',戌:'狗',亥:'猪',
}
const ZHI_ZODIAC_EN: Record<string, string> = {
  子:'Rat',丑:'Ox',寅:'Tiger',卯:'Rabbit',辰:'Dragon',巳:'Snake',
  午:'Horse',未:'Goat',申:'Monkey',酉:'Rooster',戌:'Dog',亥:'Pig',
}
const NAYIN: Record<string, string> = {
  甲子:'海中金',乙丑:'海中金',丙寅:'炉中火',丁卯:'炉中火',戊辰:'大林木',己巳:'大林木',
  庚午:'路旁土',辛未:'路旁土',壬申:'剑锋金',癸酉:'剑锋金',甲戌:'山头火',乙亥:'山头火',
  丙子:'涧下水',丁丑:'涧下水',戊寅:'城头土',己卯:'城头土',庚辰:'白蜡金',辛巳:'白蜡金',
  壬午:'杨柳木',癸未:'杨柳木',甲申:'泉中水',乙酉:'泉中水',丙戌:'屋上土',丁亥:'屋上土',
  戊子:'霹雳火',己丑:'霹雳火',庚寅:'松柏木',辛卯:'松柏木',壬辰:'长流水',癸巳:'长流水',
  甲午:'沙中金',乙未:'沙中金',丙申:'山下火',丁酉:'山下火',戊戌:'平地木',己亥:'平地木',
  庚子:'壁上土',辛丑:'壁上土',壬寅:'金箔金',癸卯:'金箔金',甲辰:'覆灯火',乙巳:'覆灯火',
  丙午:'天河水',丁未:'天河水',戊申:'大驿土',己酉:'大驿土',庚戌:'钗钏金',辛亥:'钗钏金',
  壬子:'桑柘木',癸丑:'桑柘木',甲寅:'大溪水',乙卯:'大溪水',丙辰:'沙中土',丁巳:'沙中土',
  戊午:'天上火',己未:'天上火',庚申:'石榴木',辛酉:'石榴木',壬戌:'大海水',癸亥:'大海水',
}

// 五行计算：与 AI 保持完全一致
// 天干=1分（取其五行），地支=1分（只取主气）
// 共8个字，最高8分，全部整数
function calcWuxingDist(bazi: ReturnType<typeof getBaZi>) {
  const dist: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  const gans = [bazi.yearGan, bazi.monthGan, bazi.dayGan, bazi.hourGan]
  const zhis = [bazi.yearZhi, bazi.monthZhi, bazi.dayZhi, bazi.hourZhi]
  for (const g of gans) {
    const wx = GAN_WUXING[g]
    if (wx) dist[wx] += 1
  }
  for (const z of zhis) {
    const wx = ZHI_WUXING[z]
    if (wx) dist[wx] += 1
  }
  return dist
}

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
    birthInfo: '生辰', lunarLabel: '农历', bazi: '四柱八字',
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
    showReasoning: '展开推理过程', hideReasoning: '收起推理过程',
    reasoningTitle: '命理推演过程', reasoningNote: '以下为详细推演，供参考验证',
    conclusionTitle: '解读与建议',
    noReasoning: '（基础模式不含推演过程，切换至深度模式可查看完整推算）',
    wuxing: '五行分布', dayMaster: '日主', nayin: '纳音', zodiac: '生肖', place: '地点',
  },
  en: {
    greeting: (name: string) => `${name}'s Chart`,
    modules: [
      { id: 'self' as Module,   icon: '☲', name: 'The Self',  sub: 'Birth chart · Elements · Pattern', locked: false },
      { id: 'people' as Module, icon: '☯', name: 'Relations', sub: 'Compatibility · Bonds · People',   locked: true  },
      { id: 'world' as Module,  icon: '☰', name: 'The World', sub: 'Timing · Annual cycle · Energy',   locked: true  },
    ],
    depthTabs: { basic: 'Basic', deep: 'Deep' },
    depthDesc: {
      self:   { basic: 'Elements · Character · This Year', deep: 'Ten Gods · Useful God · Da Yun · Full Analysis' },
      people: { basic: 'Elemental Fit · Relationship', deep: 'Day Pillar · Marriage Palace · Cycles' },
      world:  { basic: 'Annual Elements · Year Impact', deep: 'Timing · Directions · Industries · Cautions' },
    },
    birthInfo: 'Birth', lunarLabel: 'Lunar', bazi: 'Four Pillars',
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
    showReasoning: 'Show Reasoning', hideReasoning: 'Hide Reasoning',
    reasoningTitle: 'Reasoning Process', reasoningNote: 'Detailed derivation for verification',
    conclusionTitle: 'Reading & Guidance',
    noReasoning: '(Basic mode does not include full reasoning. Switch to Deep mode for complete derivation.)',
    wuxing: 'Five Elements', dayMaster: 'Day Master', nayin: 'Nayin', zodiac: 'Zodiac', place: 'Place',
  },
}

type ModalType = 'login_required' | 'limit_reached' | 'paid_required' | null
type DepthMode = 'basic' | 'deep'

function SourceModal({ source, lang, onClose }: { source: CorpusSource; lang: 'zh'|'en'; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="source-modal-box" onClick={e => e.stopPropagation()}>
        <div className="source-modal-header">
          <span className="source-modal-title">《{source.title}》</span>
          <button className="source-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="source-modal-label">{lang === 'zh' ? 'AI 参考的原文片段' : 'Referenced passage'}</div>
        <div className="source-modal-text">{source.excerpt}</div>
        <p className="source-modal-note">
          {lang === 'zh'
            ? '以上为古籍知识库中与您问题最相关的片段，AI 以此为据进行推演。'
            : 'This passage from our classical text library was referenced in the analysis above.'}
        </p>
      </div>
    </div>
  )
}

function ResultCard({ result, lang }: { result: ExtendedResult; lang: 'zh'|'en' }) {
  const [showReasoning, setShowReasoning] = useState(false)
  const [activeSource, setActiveSource] = useState<CorpusSource | null>(null)
  const t = text[lang]
  return (
    <div className="result-card">
      {activeSource && <SourceModal source={activeSource} lang={lang} onClose={() => setActiveSource(null)} />}
      <div className="result-header">
        <span className="result-q">「{result.query}」</span>
        <span className="result-time">{new Date(result.timestamp).toLocaleTimeString()}</span>
      </div>
      <div className="result-section result-conclusion">
        <div className="result-section-label">{t.conclusionTitle}</div>
        <div className="result-body">{result.response}</div>
      </div>
      {result.sources && result.sources.length > 0 && (
        <div className="result-sources">
          <span className="result-sources-label">{lang === 'zh' ? '参考古籍：' : 'Sources: '}</span>
          {result.sources.map((s, i) => (
            <button key={i} className="result-source-tag" onClick={() => setActiveSource(s)}>《{s.title}》</button>
          ))}
        </div>
      )}
      <div className="result-reasoning-toggle">
        {result.reasoning ? (
          <>
            <button className="reasoning-toggle-btn" onClick={() => setShowReasoning(v => !v)}>
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

// ── 五行五边形图（颜色加深，填充清晰）──
function WuxingChart({ dist, lang }: { dist: Record<string, number>; lang: 'zh'|'en' }) {
  const keys = ['木','火','土','金','水']
  const cx = 72, cy = 72, r = 50
  const angles = keys.map((_, i) => (i * 72 - 90) * Math.PI / 180)
  const pts = angles.map(a => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }))
  const maxVal = Math.max(...Object.values(dist), 1)
  const valuePts = keys.map((k, i) => {
    const ratio = Math.min(dist[k] / maxVal, 1)
    return { x: cx + r * ratio * Math.cos(angles[i]), y: cy + r * ratio * Math.sin(angles[i]) }
  })
  const valuePoly = valuePts.map(p => `${p.x},${p.y}`).join(' ')
  const lp = angles.map(a => ({ x: cx + (r + 14) * Math.cos(a), y: cy + (r + 14) * Math.sin(a) }))
  const enLabels = ['Wood','Fire','Earth','Metal','Water']

  return (
    <svg viewBox="0 0 144 144" className="wuxing-svg">
      {/* 背景网格 */}
      {[0.33, 0.66, 1].map(ratio => (
        <polygon key={ratio}
          points={pts.map(p => `${cx+(p.x-cx)*ratio},${cy+(p.y-cy)*ratio}`).join(' ')}
          fill="none" stroke="rgba(90,70,30,0.25)" strokeWidth="0.8"
        />
      ))}
      {pts.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(90,70,30,0.2)" strokeWidth="0.8" />)}
      {/* 数值多边形 - 填充色加深 */}
      <polygon points={valuePoly} fill="rgba(90,70,30,0.22)" stroke="rgba(90,70,30,0.7)" strokeWidth="1.5" />
      {/* 各顶点用对应五行颜色的圆点 */}
      {valuePts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={WUXING_STROKE[keys[i]]} />
      ))}
      {/* 标签 */}
      {lp.map((p, i) => (
        <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fill={WUXING_COLORS[keys[i]]} fontFamily="Noto Serif SC, serif" fontWeight="600">
          {lang === 'zh' ? keys[i] : enLabels[i]}
        </text>
      ))}
    </svg>
  )
}

export default function Dashboard({ lang, setLang, user, initialModule, onBack, onReset, onAdmin, onLogin }: Props) {
  const t = text[lang]
  const { user: authUser, logout } = useAuth()
  const [activeModule, setActiveModule] = useState<Module>(MODULE_IDS[initialModule] ?? 'self')
  const [depthMode, setDepthMode] = useState<DepthMode>('basic')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ExtendedResult[]>([])
  const [modal, setModal] = useState<ModalType>(null)

  const bazi = getBaZi(user.birthYear, user.birthMonth, user.birthDay, user.birthHour)
  const wuxingDist = calcWuxingDist(bazi)
  const currentYear = new Date().getFullYear()
  const daYun = getDaYun(bazi, user.birthYear, user.birthMonth, user.birthDay, user.birthHour, user.gender)
  const currentAge = currentYear - user.birthYear
  const currentDaYun = daYun.pillars.find(p => currentAge >= p.fromAge && currentAge <= p.toAge)
  const dayMasterWx = GAN_WUXING[bazi.dayGan] || ''
  const dayMasterYY = GAN_YIN_YANG[bazi.dayGan] || ''
  const zodiac = lang === 'zh' ? ZHI_ZODIAC[bazi.yearZhi] : ZHI_ZODIAC_EN[bazi.yearZhi]
  const nayin = NAYIN[bazi.yearGan + bazi.yearZhi] || ''

  const currentMod = t.modules.find(m => m.id === activeModule)!
  const featureKey: FeatureKey = MODULE_FEATURES[activeModule][depthMode]
  const quickQ = (t.quickQ as any)[featureKey] || []
  const currentDesc = (t.depthDesc as any)[activeModule][depthMode]
  const hasPaid = authUser && PAID_PLANS.includes(authUser.plan)

  const handleModuleSwitch = (modId: Module) => {
    if (LOGIN_REQUIRED_MODULES.includes(modId) && !authUser) { setModal('login_required'); return }
    setActiveModule(modId); setDepthMode('basic')
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
    if (LOGIN_REQUIRED_MODULES.includes(activeModule) && !authUser) { setModal('login_required'); return }
    if (depthMode === 'deep' && !hasPaid) { setModal('paid_required'); return }
    setLoading(true); setQuery('')
    try {
      const parsed: ParsedResponse = await analyzeWithDeepSeek({ user, bazi, module: activeModule, featureKey, question, lang })
      setResults(prev => [{
        module: activeModule, query: question,
        response: parsed.conclusion, reasoning: parsed.reasoning,
        sources: parsed.sources, timestamp: new Date().toISOString(),
      }, ...prev])
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'LOGIN_REQUIRED')      { setModal('login_required');  setLoading(false); return }
        if (err.code === 'ANON_LIMIT_REACHED')  { setModal('limit_reached');   setLoading(false); return }
        if (err.code === 'DAILY_LIMIT_REACHED') { setModal('limit_reached');   setLoading(false); return }
        if (err.code === 'PAID_REQUIRED')       { setModal('paid_required');   setLoading(false); return }
      }
      setResults(prev => [{
        module: activeModule, query: question,
        response: lang === 'zh' ? '天机难测，请稍后再试。' : 'The oracle is momentarily silent. Please try again.',
        reasoning: '', timestamp: new Date().toISOString(),
      }, ...prev])
    }
    setLoading(false)
  }

  return (
    <div className="dashboard">
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">☯</div>
            <h3 className="modal-title">
              {modal === 'login_required' ? t.loginRequired : modal === 'paid_required' ? t.paidRequired : t.limitReached}
            </h3>
            <p className="modal-desc">
              {modal === 'login_required' ? t.loginRequiredDesc : modal === 'paid_required' ? t.paidRequiredDesc : t.limitDesc}
            </p>
            <div className="modal-actions">
              <button className="modal-btn-primary" onClick={() => { setModal(null); onLogin?.() }}>
                {modal === 'paid_required' ? t.goSubscribe : modal === 'limit_reached' ? t.goLoginForMore : t.goLogin}
              </button>
              <button className="modal-btn-secondary" onClick={() => setModal(null)}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      <header className="dash-header">
        <div className="dash-header-left">
          <button className="text-btn" onClick={onBack}>{t.back}</button>
          <h1 className="dash-title">{t.greeting(user.name)}</h1>
        </div>
        <div className="dash-header-right">
          <button className="text-btn" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>{t.langSwitch}</button>
          {authUser?.role === 'admin' && onAdmin && <button className="text-btn" onClick={onAdmin}>{t.admin}</button>}
          {authUser
            ? <button className="text-btn" onClick={() => { logout(); onBack() }}>{t.logout}</button>
            : <button className="text-btn" onClick={onLogin}>{t.login}</button>
          }
          <button className="text-btn danger" onClick={onReset}>{t.reset}</button>
        </div>
      </header>

      <div className="dash-body">
        {/* ── 左侧星盘面板 ── */}
        <aside className="dash-sidebar">

          {/* 个人信息：紧凑版 */}
          <div className="profile-card">
            <div className="profile-avatar-row">
              <div className="profile-avatar-sm">
                <span className="avatar-glyph-sm">
                  {user.gender === 'male' ? '乾' : user.gender === 'female' ? '坤' : '中'}
                </span>
              </div>
              <div className="profile-info-col">
                <div className="profile-name">{user.name}</div>
                <div className="profile-gender">{t.genderMap[user.gender]}</div>
              </div>
            </div>
            <div className="profile-dates-compact">
              <div className="date-row-sm">
                <span className="date-label-sm">{t.birthInfo}</span>
                <span className="date-val-sm">{user.birthYear}/{user.birthMonth}/{user.birthDay} {user.birthHour}:00 · {user.birthPlace}</span>
              </div>
              {user.lunarDate && (
                <div className="date-row-sm">
                  <span className="date-label-sm">{t.lunarLabel}</span>
                  <span className="date-val-sm">{user.lunarDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* 四柱八字：紧凑版 */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">{t.bazi}</div>
            <div className="bazi-pillars-v2">
              {[
                { top: bazi.yearGan,  bot: bazi.yearZhi,  lbl: lang === 'zh' ? '年' : 'Y' },
                { top: bazi.monthGan, bot: bazi.monthZhi, lbl: lang === 'zh' ? '月' : 'M' },
                { top: bazi.dayGan,   bot: bazi.dayZhi,   lbl: lang === 'zh' ? '日' : 'D' },
                { top: bazi.hourGan,  bot: bazi.hourZhi,  lbl: lang === 'zh' ? '时' : 'H' },
              ].map((p, i) => (
                <div key={i} className={`bazi-pillar-v2${i === 2 ? ' day-pillar' : ''}`}>
                  <div className="pillar-lbl">{p.lbl}</div>
                  <div className="pillar-gan-v2" style={{ color: WUXING_COLORS[GAN_WUXING[p.top]] || 'var(--ink)' }}>{p.top}</div>
                  <div className="pillar-zhi-v2" style={{ color: WUXING_COLORS[GAN_WUXING[p.top] && ZHI_CANGGAN[p.bot] ? Object.keys(ZHI_CANGGAN[p.bot])[0] : ''] || '#5a4f42' }}>{p.bot}</div>
                  {i === 2 && <div className="day-pillar-label">{lang === 'zh' ? '日主' : 'DM'}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* 五行分布：图+条形横排 */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">{t.wuxing}</div>
            <div className="wuxing-layout">
              <WuxingChart dist={wuxingDist} lang={lang} />
              <div className="wuxing-bars">
                {['木','火','土','金','水'].map(wx => (
                  <div key={wx} className="wuxing-bar-row">
                    <span className="wuxing-bar-label" style={{ color: WUXING_COLORS[wx] }}>{wx}</span>
                    <span className="wuxing-bar-eq">=</span>
                    <span className="wuxing-bar-count" style={{ color: wuxingDist[wx] > 0 ? WUXING_COLORS[wx] : '#9a8f82' }}>
                      {wuxingDist[wx]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 命主信息：日主+纳音一行 */}
          <div className="sidebar-section sidebar-section-last">
            <div className="chart-info-row-single">
              <div className="chart-info-inline">
                <span className="chart-info-label">{t.dayMaster}</span>
                <span className="chart-info-value" style={{ color: WUXING_COLORS[dayMasterWx] }}>
                  {bazi.dayGan}{dayMasterWx && `（${dayMasterYY}${dayMasterWx}）`}
                </span>
              </div>
              {nayin && (
                <div className="chart-info-inline">
                  <span className="chart-info-label">{t.nayin}</span>
                  <span className="chart-info-value">{nayin}</span>
                </div>
              )}
            </div>
          </div>

          {/* 大运 */}
          {daYun.pillars.length > 0 && (
            <div className="sidebar-section sidebar-section-last">
              <div className="sidebar-section-title">{lang === 'zh' ? '大运' : 'Da Yun'}</div>
              <div className="dayun-start">
                {lang === 'zh'
                  ? `${daYun.startAge}岁起运 · 当前${currentAge}岁`
                  : `Starts age ${daYun.startAge} · Now ${currentAge}`}
              </div>
              <div className="dayun-list">
                {daYun.pillars.slice(0, 6).map((p, i) => {
                  const isCurrent = currentAge >= p.fromAge && currentAge <= p.toAge
                  return (
                    <div key={i} className={`dayun-item${isCurrent ? ' dayun-current' : ''}`}>
                      <span className="dayun-pillar">{p.gan}{p.zhi}</span>
                      <span className="dayun-age">{p.fromAge}–{p.toAge}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </aside>

        {/* ── 右侧主内容 ── */}
        <main className="dash-main">
          <div className="module-tabs-bar">
            <div className="module-tabs-group">
              {t.modules.map(mod => {
                const isLocked = mod.locked && !authUser
                return (
                  <button
                    key={mod.id}
                    className={`module-tab${activeModule === mod.id ? ' active' : ''}${isLocked ? ' locked' : ''}`}
                    onClick={() => handleModuleSwitch(mod.id)}
                  >
                    <span className="module-tab-icon">{mod.icon}</span>
                    <span className="module-tab-name">{mod.name}</span>
                    {isLocked && <span className="module-tab-lock">🔒</span>}
                  </button>
                )
              })}
            </div>
            <div className="depth-tabs">
              <button className={`depth-tab${depthMode === 'basic' ? ' active' : ''}`} onClick={() => handleDepthSwitch('basic')}>{t.depthTabs.basic}</button>
              <button className={`depth-tab${depthMode === 'deep' ? ' active' : ''}${!hasPaid ? ' depth-tab-locked' : ''}`} onClick={() => handleDepthSwitch('deep')}>
                {t.depthTabs.deep}{!hasPaid && <span className="depth-lock-icon">🔒</span>}
              </button>
            </div>
          </div>

          <div className="module-subtitle-bar">
            <span className="module-subtitle-icon">{currentMod.icon}</span>
            <span className="module-subtitle-text">{currentDesc}</span>
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
            <button className={`ask-btn${loading ? ' loading' : ''}`} onClick={() => handleSend()} disabled={loading}>
              {loading ? t.sending : t.send}
            </button>
          </div>

          <div className="results-area">
            {results.length === 0 && !loading && (
              <div className="results-empty">
                <div className="empty-glyph">☯</div>
                <p>{lang === 'zh' ? '天地静待，问则应。' : 'Heaven and Earth await your question.'}</p>
              </div>
            )}
            {loading && <OracleLoader lang={lang} />}
            {results.map((r, i) => <ResultCard key={i} result={r} lang={lang} />)}
          </div>
        </main>
      </div>
    </div>
  )
}
