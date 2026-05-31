// src/pages/Dashboard.tsx
import { useState, useMemo, useRef } from 'react'
import { useAuth } from '../utils/authContext'
import { UserProfile, Lang, Module, AnalysisResult } from '../types'
import { analyzeWithDeepSeek, analyzeWithVision, ApiError, FeatureKey, ParsedResponse, CorpusSource, PartnerProfile, VisionFeatureKey } from '../utils/ai'
import { getBaZi, getDaYun } from '../utils/bazi'
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

const MODULE_FEATURES: Record<Module, { basic: FeatureKey; deep: FeatureKey; extra?: FeatureKey }> = {
  self:   { basic: 'self_basic',   deep: 'self_deep',    extra: 'palm_reading'   },
  people: { basic: 'people_basic', deep: 'people_deep'                           },
  world:  { basic: 'world_year',   deep: 'world_timing', extra: 'world_fengshui' },
}

const MODULE_IDS: Module[] = ['self', 'people', 'world']
const LOGIN_REQUIRED_MODULES: Module[] = ['people', 'world']
const PAID_PLANS = ['monthly', 'quarterly', 'yearly']

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
const ZHI_WUXING: Record<string, string> = {
  子:'水', 丑:'土', 寅:'木', 卯:'木', 辰:'土', 巳:'火',
  午:'火', 未:'土', 申:'金', 酉:'金', 戌:'土', 亥:'水',
}
const ZHI_CANGGAN: Record<string, Record<string, number>> = {
  子:{水:1.0}, 丑:{土:1.0,金:0.5,水:0.25}, 寅:{木:1.0,火:0.5,土:0.25},
  卯:{木:1.0}, 辰:{土:1.0,木:0.5,水:0.25}, 巳:{火:1.0,土:0.5,金:0.25},
  午:{火:1.0,土:0.5}, 未:{土:1.0,火:0.5,木:0.25}, 申:{金:1.0,水:0.5,土:0.25},
  酉:{金:1.0}, 戌:{土:1.0,火:0.5,金:0.25}, 亥:{水:1.0,木:0.5},
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

// 五行相生相克
const SHENG: Record<string, string> = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' }
const KE:   Record<string, string> = { 木:'土', 火:'金', 土:'水', 金:'木', 水:'火' }

function calcWuxingDist(bazi: ReturnType<typeof getBaZi>) {
  const dist: Record<string, number> = { 木:0, 火:0, 土:0, 金:0, 水:0 }
  const gans = [bazi.yearGan, bazi.monthGan, bazi.dayGan, bazi.hourGan]
  const zhis = [bazi.yearZhi, bazi.monthZhi, bazi.dayZhi, bazi.hourZhi]
  for (const g of gans) { const wx = GAN_WUXING[g]; if (wx) dist[wx] += 1 }
  for (const z of zhis) { const wx = ZHI_WUXING[z]; if (wx) dist[wx] += 1 }
  return dist
}

// ── 今日卦象计算（纯前端）──────────────────────────────
function getTodayOracle(bazi: ReturnType<typeof getBaZi>, wuxingDist: Record<string,number>, lang: 'zh'|'en') {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()+1, d = now.getDate()

  // 今日日柱干支（用儒略日公式）
  const a = Math.floor((14-m)/12), yy = y+4800-a, mm = m+12*a-3
  const jd = d + Math.floor((153*mm+2)/5) + 365*yy +
    Math.floor(yy/4) - Math.floor(yy/100) + Math.floor(yy/400) - 32045
  const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
  const DI_ZHI   = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
  const todayGan = TIAN_GAN[((jd+49)%10+10)%10]
  const todayZhi = DI_ZHI[((jd+11)%12+12)%12]
  const todayWx  = GAN_WUXING[todayGan]

  // 今日五行与命主日主的关系
  const dayMasterWx = GAN_WUXING[bazi.dayGan]
  const userWeakest = Object.entries(wuxingDist).sort(([,a],[,b]) => a-b)[0][0]
  const userStrongest = Object.entries(wuxingDist).sort(([,a],[,b]) => b-a)[0][0]

  let relation = ''
  let score = 3 // 1-5星
  let yi = ''   // 宜
  let ji = ''   // 忌
  let quote = ''

  if (todayWx === dayMasterWx) {
    relation = lang === 'zh' ? '比和' : 'Resonance'
    score = 4
    yi  = lang === 'zh' ? '展示自我、主动出击' : 'Self-expression, taking initiative'
    ji  = lang === 'zh' ? '过于自我、固执己见' : 'Over-asserting, stubbornness'
    quote = lang === 'zh' ? '知己知彼，百战不殆' : 'Know yourself and you will win all battles'
  } else if (SHENG[todayWx] === dayMasterWx) {
    relation = lang === 'zh' ? '生扶' : 'Nourishing'
    score = 5
    yi  = lang === 'zh' ? '开展新项目、建立关系、投资' : 'New projects, building connections, investment'
    ji  = lang === 'zh' ? '过于依赖他人' : 'Over-relying on others'
    quote = lang === 'zh' ? '顺势而为，事半功倍' : 'Ride the tide and double your results'
  } else if (SHENG[dayMasterWx] === todayWx) {
    relation = lang === 'zh' ? '泄秀' : 'Expression'
    score = 3
    yi  = lang === 'zh' ? '创作、表达、分享' : 'Creative work, expression, sharing'
    ji  = lang === 'zh' ? '过度消耗精力' : 'Overextending energy'
    quote = lang === 'zh' ? '厚积薄发，水到渠成' : 'Deep roots bear great fruit'
  } else if (KE[todayWx] === dayMasterWx) {
    relation = lang === 'zh' ? '克制' : 'Challenge'
    score = 2
    yi  = lang === 'zh' ? '低调行事、整理内务' : 'Keep low profile, internal organization'
    ji  = lang === 'zh' ? '重大决策、冲突争执' : 'Major decisions, conflicts'
    quote = lang === 'zh' ? '曲则全，枉则直' : 'Yield and overcome; bend and be straight'
  } else if (KE[dayMasterWx] === todayWx) {
    relation = lang === 'zh' ? '克出' : 'Overcoming'
    score = 4
    yi  = lang === 'zh' ? '执行计划、解决问题' : 'Execute plans, solve problems'
    ji  = lang === 'zh' ? '强行推进、树敌' : 'Forcing progress, making enemies'
    quote = lang === 'zh' ? '刚柔并济，方为上策' : 'Balance strength with flexibility'
  }

  // 今日整体气场描述
  const wxNameZh: Record<string,string> = {木:'木',火:'火',土:'土',金:'金',水:'水'}
  const wxNameEn: Record<string,string> = {木:'Wood',火:'Fire',土:'Earth',金:'Metal',水:'Water'}
  const wxDesc: Record<string, [string,string]> = {
    木: ['生发之气旺盛，适合开创与生长', 'Wood energy rises — ideal for growth and new beginnings'],
    火: ['光明热烈，思维活跃，人际运佳', 'Fire energy blazes — sharp mind, social connections flourish'],
    土: ['厚重稳健，利于积累与守成', 'Earth energy grounds — steady progress, consolidation favored'],
    金: ['收敛精准，执行力强，利于决断', 'Metal energy focuses — decisive action, precision at its peak'],
    水: ['智慧流动，直觉敏锐，利于谋划', 'Water energy flows — intuition sharp, planning and strategy favored'],
  }

  const dateStr = lang === 'zh'
    ? `${y}年${m}月${d}日`
    : `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} ${d}, ${y}`

  return {
    dateStr,
    todayGan, todayZhi, todayWx,
    relation, score, yi, ji, quote,
    desc: wxDesc[todayWx]?.[lang === 'zh' ? 0 : 1] || '',
    wxColor: WUXING_COLORS[todayWx] || '#9b7d3a',
    wxStroke: WUXING_STROKE[todayWx] || '#9b7d3a',
  }
}

// 星级显示
function Stars({ score }: { score: number }) {
  return (
    <span className="oracle-stars">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`oracle-star${i <= score ? ' lit' : ''}`}>◆</span>
      ))}
    </span>
  )
}

// 今日卦象卡片
function TodayOracle({ bazi, wuxingDist, lang }: {
  bazi: ReturnType<typeof getBaZi>
  wuxingDist: Record<string,number>
  lang: 'zh'|'en'
}) {
  const [expanded, setExpanded] = useState(false)
  const oracle = useMemo(() => getTodayOracle(bazi, wuxingDist, lang), [lang])

  return (
    <div className="today-oracle" style={{ borderLeftColor: oracle.wxStroke }}>
      <div className="oracle-header" onClick={() => setExpanded(v => !v)}>
        <div className="oracle-header-left">
          <span className="oracle-date">{oracle.dateStr}</span>
          <span className="oracle-pillar" style={{ color: oracle.wxColor }}>
            {oracle.todayGan}{oracle.todayZhi}
          </span>
          <span className="oracle-relation" style={{ color: oracle.wxColor }}>
            {oracle.relation}
          </span>
          <Stars score={oracle.score} />
        </div>
        <span className="oracle-toggle">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="oracle-body">
          <p className="oracle-desc">{oracle.desc}</p>
          <div className="oracle-yi-ji">
            <div className="oracle-yi">
              <span className="oracle-yi-label">{lang === 'zh' ? '宜' : 'Do'}</span>
              <span className="oracle-yi-text">{oracle.yi}</span>
            </div>
            <div className="oracle-ji">
              <span className="oracle-ji-label">{lang === 'zh' ? '忌' : 'Avoid'}</span>
              <span className="oracle-ji-text">{oracle.ji}</span>
            </div>
          </div>
          <p className="oracle-quote">「{oracle.quote}」</p>
        </div>
      )}
    </div>
  )
}

const text = {
  zh: {
    greeting: (name: string) => `${name}的命盘`,
    modules: [
      { id: 'self' as Module,   icon: '☲', name: '与己',   sub: '自身命盘·五行·手相',  locked: false },
      { id: 'people' as Module, icon: '☯', name: '与人',   sub: '关系·合婚·人际',       locked: true  },
      { id: 'world' as Module,  icon: '☰', name: '与世界', sub: '时运·流年·风水·世界能量', locked: true  },
    ],
    depthTabs: { basic: '基础', deep: '深度', extra: '风水' },
    depthDesc: {
      self:   { basic: '五行概况·性格·今年运势', deep: '十神格局·用神·大运流年·深度解析', extra: '手相分析·纹路·丘位·与命局结合' },
      people: { basic: '五行相合·关系优劣', deep: '日柱配对·婚姻宫·合冲·走势预判' },
      world:  { basic: '流年五行·今年影响', deep: '择吉时机·方位·行业·避忌', extra: '居家风水·方位·颜色·物品' },
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
      world_fengshui: ['我家哪个方位最适合我？', '我适合什么颜色的家居？', '我的财位在哪个方向？'],
      palm_reading:   ['分析我的生命线', '我的感情线如何？', '我的命运线显示什么？'],
      fengshui_photo: ['分析这个空间的风水', '这个房间的五行能量如何？', '我需要做哪些风水调整？'],
    },
    reset: '重置命盘', langSwitch: 'EN', back: '← 主页',
    partnerTitle: '对方生辰', partnerName: '对方姓名', partnerNamePh: '可选',
    partnerGender: '性别', partnerDate: '出生日期', partnerHour: '出生时辰',
    partnerClear: '清除对方信息', partnerSet: '设置对方生辰',
    partnerHint: '填写对方生辰后，AI 将进行双人合盘分析',
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
      { id: 'self' as Module,   icon: '☲', name: 'The Self',  sub: 'Birth chart · Elements · Palm', locked: false },
      { id: 'people' as Module, icon: '☯', name: 'Relations', sub: 'Compatibility · Bonds · People',   locked: true  },
      { id: 'world' as Module,  icon: '☰', name: 'The World', sub: 'Timing · Annual cycle · Feng Shui', locked: true  },
    ],
    depthTabs: { basic: 'Basic', deep: 'Deep', extra: 'Feng Shui' },
    depthDesc: {
      self:   { basic: 'Elements · Character · This Year', deep: 'Ten Gods · Useful God · Da Yun · Full Analysis', extra: 'Palm Reading · Lines · Mounts · With Ba Zi' },
      people: { basic: 'Elemental Fit · Relationship', deep: 'Day Pillar · Marriage Palace · Cycles' },
      world:  { basic: 'Annual Elements · Year Impact', deep: 'Timing · Directions · Industries · Cautions', extra: 'Home Feng Shui · Directions · Colors · Objects' },
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
      world_fengshui: ['Which direction is best for my home?', 'What colors suit my energy?', 'Where is my wealth corner?'],
      palm_reading:   ['Analyze my life line', 'What does my heart line reveal?', 'What does my fate line show?'],
      fengshui_photo: ['Analyze the feng shui of this space', 'What are the Five Elements here?', 'What adjustments should I make?'],
    },
    reset: 'Reset Chart', langSwitch: '中文', back: '← Home',
    partnerTitle: "Partner's Chart", partnerName: 'Name', partnerNamePh: 'optional',
    partnerGender: 'Gender', partnerDate: 'Birth Date', partnerHour: 'Birth Hour',
    partnerClear: 'Clear partner', partnerSet: "Set partner's birth info",
    partnerHint: "Add your partner's birth info for a compatibility reading",
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
type DepthMode = 'basic' | 'deep' | 'extra'

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
        <div className="result-body" style={{ whiteSpace: 'pre-wrap' }}>{result.response}</div>
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
                <div className="result-body reasoning-body" style={{ whiteSpace: 'pre-wrap' }}>{result.reasoning}</div>
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
      {[0.33, 0.66, 1].map(ratio => (
        <polygon key={ratio}
          points={pts.map(p => `${cx+(p.x-cx)*ratio},${cy+(p.y-cy)*ratio}`).join(' ')}
          fill="none" stroke="rgba(90,70,30,0.25)" strokeWidth="0.8"
        />
      ))}
      {pts.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(90,70,30,0.2)" strokeWidth="0.8" />)}
      <polygon points={valuePoly} fill="rgba(90,70,30,0.22)" stroke="rgba(90,70,30,0.7)" strokeWidth="1.5" />
      {valuePts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={WUXING_STROKE[keys[i]]} />
      ))}
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
  // 视觉分析：图片上传
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [photoLoading, setPhotoLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 合盘：对方信息
  const [partner, setPartner] = useState<PartnerProfile | null>(null)
  const [showPartnerForm, setShowPartnerForm] = useState(false)
  const [pName, setPName] = useState('')
  const [pGender, setPGender] = useState<'male'|'female'|'other'>('female')
  const [pYear, setPYear] = useState(1990)
  const [pMonth, setPMonth] = useState(6)
  const [pDay, setPDay] = useState(15)
  const [pHour, setPHour] = useState(12)

  const bazi = getBaZi(user.birthYear, user.birthMonth, user.birthDay, user.birthHour)
  const wuxingDist = calcWuxingDist(bazi)
  const currentYear = new Date().getFullYear()
  const daYun = getDaYun(bazi, user.birthYear, user.birthMonth, user.birthDay, user.birthHour, user.gender)
  const currentAge = currentYear - user.birthYear
  const dayMasterWx = GAN_WUXING[bazi.dayGan] || ''
  const dayMasterYY = GAN_YIN_YANG[bazi.dayGan] || ''
  const zodiac = lang === 'zh' ? ZHI_ZODIAC[bazi.yearZhi] : ZHI_ZODIAC_EN[bazi.yearZhi]
  const nayin = NAYIN[bazi.yearGan + bazi.yearZhi] || ''

  const currentMod = t.modules.find(m => m.id === activeModule)!
  const featureKey: FeatureKey = depthMode === 'extra'
    ? (MODULE_FEATURES[activeModule].extra || MODULE_FEATURES[activeModule].deep)
    : MODULE_FEATURES[activeModule][depthMode as 'basic'|'deep']
  const quickQ = (t.quickQ as any)[featureKey] || []
  const currentDesc = (t.depthDesc as any)[activeModule][depthMode] || ''
  const hasPaid = authUser && PAID_PLANS.includes(authUser.plan)

  const handleModuleSwitch = (modId: Module) => {
    if (LOGIN_REQUIRED_MODULES.includes(modId) && !authUser) { setModal('login_required'); return }
    setActiveModule(modId); setDepthMode('basic')
  }
  const handleDepthSwitch = (mode: DepthMode) => {
    if (mode === 'deep' || mode === 'extra') {
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
      const parsed: ParsedResponse = await analyzeWithDeepSeek({
        user, bazi, module: activeModule, featureKey, question, lang,
        partner: (activeModule === 'people' && partner) ? partner : undefined,
      })
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

  const handlePhotoAnalyze = async () => {
    if (!photoFile) return
    if (!authUser) { setModal('login_required'); return }
    setPhotoLoading(true)
    try {
      const visionKey: VisionFeatureKey = activeModule === 'self' ? 'palm_reading' : 'fengshui_photo'
      // 压缩图片再传（手机照片可能很大）
      const compressImage = (file: File, maxSizePx = 1280): Promise<{base64: string, mimeType: string}> => {
        return new Promise((resolve) => {
          const img = new Image()
          const url = URL.createObjectURL(file)
          img.onload = () => {
            URL.revokeObjectURL(url)
            const canvas = document.createElement('canvas')
            let w = img.width, h = img.height
            if (w > maxSizePx || h > maxSizePx) {
              if (w > h) { h = Math.round(h * maxSizePx / w); w = maxSizePx }
              else       { w = Math.round(w * maxSizePx / h); h = maxSizePx }
            }
            canvas.width = w; canvas.height = h
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
            resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
          }
          img.src = url
        })
      }

      const { base64, mimeType } = await compressImage(photoFile)
      const reader = { onload: null }  // placeholder
      const processAnalysis = async () => {
        try {
          const parsed = await analyzeWithVision({ imageBase64: base64, imageType: mimeType, featureKey: visionKey, user, bazi, lang })
          const queryLabel = visionKey === 'palm_reading'
            ? (lang === 'zh' ? '手相分析' : 'Palm Reading')
            : (lang === 'zh' ? '风水照片分析' : 'Feng Shui Photo Analysis')
          // 手相分析自动引用麻衣神相
          const visionSources = visionKey === 'palm_reading'
            ? [{ title: '麻衣神相', excerpt: '掌纹者，天地之文也。手为一身之末，然五脏六腑之气皆达于掌。观掌知命，须察纹路之深浅、长短、曲直、断续，综合判之。' }]
            : [{ title: '钦定协纪辨方书', excerpt: '方位者，五行所主也。东方木，南方火，西方金，北方水，中央土。居家布局，须顺五行之气，方能化煞迎祥。' }]
          setResults(prev => [{
            module: activeModule, query: queryLabel,
            response: parsed.conclusion, reasoning: parsed.reasoning,
            sources: visionSources, timestamp: new Date().toISOString(),
          }, ...prev])
          setPhotoFile(null); setPhotoPreview('')
          if (fileInputRef.current) fileInputRef.current.value = ''
        } catch (err) {
          if (err instanceof ApiError) {
            if (err.code === 'LOGIN_REQUIRED')  { setModal('login_required'); return }
            if (err.code === 'PAID_REQUIRED')   { setModal('paid_required');  return }
            if (err.code === 'DAILY_LIMIT_REACHED') { setModal('limit_reached'); return }
          }
        } finally { setPhotoLoading(false) }
      }
      await processAnalysis()
    } catch { setPhotoLoading(false) }
  }

  // 是否显示图片上传区（手相 or 风水照片 tab）
  const isPhotoMode = depthMode === 'extra' &&
    (activeModule === 'self' || activeModule === 'world')

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
        <aside className="dash-sidebar">
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
                  <div className="pillar-zhi-v2" style={{ color: WUXING_COLORS[ZHI_CANGGAN[p.bot] ? Object.keys(ZHI_CANGGAN[p.bot])[0] : ''] || '#5a4f42' }}>{p.bot}</div>
                  {i === 2 && <div className="day-pillar-label">{lang === 'zh' ? '日主' : 'DM'}</div>}
                </div>
              ))}
            </div>
          </div>

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
              {(activeModule === 'world' || activeModule === 'self') && MODULE_FEATURES[activeModule].extra && (
                <button className={`depth-tab${depthMode === 'extra' ? ' active' : ''}${!hasPaid ? ' depth-tab-locked' : ''}`} onClick={() => handleDepthSwitch('extra' as any)}>
                  {activeModule === 'self'
                    ? (lang === 'zh' ? '手相' : 'Palm')
                    : t.depthTabs.extra}
                  {!hasPaid && <span className="depth-lock-icon">🔒</span>}
                </button>
              )}
            </div>
          </div>

          {/* ── 今日卦象 ── */}
          <TodayOracle bazi={bazi} wuxingDist={wuxingDist} lang={lang} />

          {/* ── 合盘：对方信息（与人模块显示）── */}
          {activeModule === 'people' && (
            <div className="partner-area">
              {partner ? (
                <div className="partner-set">
                  <span className="partner-set-icon">☯</span>
                  <span className="partner-set-name">{partner.name || (lang === 'zh' ? '对方' : 'Partner')}</span>
                  <span className="partner-set-info">
                    {partner.birthYear}/{partner.birthMonth}/{partner.birthDay}
                  </span>
                  <button className="partner-clear-btn" onClick={() => { setPartner(null); setShowPartnerForm(false) }}>
                    {t.partnerClear}
                  </button>
                </div>
              ) : (
                <button className="partner-add-btn" onClick={() => setShowPartnerForm(v => !v)}>
                  {showPartnerForm ? '▲' : '+'} {t.partnerSet}
                </button>
              )}
              {showPartnerForm && !partner && (
                <div className="partner-form">
                  <div className="partner-form-row">
                    <input className="partner-input" placeholder={t.partnerNamePh}
                      value={pName} onChange={e => setPName(e.target.value)} maxLength={20} />
                    <select className="partner-select" value={pGender} onChange={e => setPGender(e.target.value as any)}>
                      <option value="female">{lang === 'zh' ? '女' : 'Female'}</option>
                      <option value="male">{lang === 'zh' ? '男' : 'Male'}</option>
                      <option value="other">{lang === 'zh' ? '其他' : 'Other'}</option>
                    </select>
                  </div>
                  <div className="partner-form-row">
                    <input className="partner-input partner-input-sm" type="number" min={1900} max={2010}
                      value={pYear} onChange={e => setPYear(Number(e.target.value))} />
                    <span className="partner-sep">/</span>
                    <input className="partner-input partner-input-xs" type="number" min={1} max={12}
                      value={pMonth} onChange={e => setPMonth(Number(e.target.value))} />
                    <span className="partner-sep">/</span>
                    <input className="partner-input partner-input-xs" type="number" min={1} max={31}
                      value={pDay} onChange={e => setPDay(Number(e.target.value))} />
                    <input className="partner-input partner-input-xs" type="number" min={0} max={23}
                      value={pHour} onChange={e => setPHour(Number(e.target.value))} placeholder="时" />
                  </div>
                  <button className="partner-confirm-btn" onClick={() => {
                    setPartner({ name: pName, gender: pGender, birthYear: pYear, birthMonth: pMonth, birthDay: pDay, birthHour: pHour })
                    setShowPartnerForm(false)
                  }}>
                    {lang === 'zh' ? '确认' : 'Confirm'}
                  </button>
                  <p className="partner-hint">{t.partnerHint}</p>
                </div>
              )}
            </div>
          )}

          <div className="module-subtitle-bar">
            <span className="module-subtitle-icon">{currentMod.icon}</span>
            <span className="module-subtitle-text">{currentDesc}</span>
          </div>

          {/* 手相/风水照片模式下隐藏快捷问题，只显示上传区 */}
          {!isPhotoMode && (
            <div className="quick-questions">
              {quickQ.map((q: string, i: number) => (
                <button key={i} className="quick-q-btn" onClick={() => handleSend(q)}>{q}</button>
              ))}
            </div>
          )}
          {isPhotoMode && (
            <div className="photo-upload-area">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setPhotoFile(file)
                  setPhotoPreview(URL.createObjectURL(file))
                }}
              />
              {photoFile ? (
                <div className="photo-ready-wrap">
                  <div className="photo-ready-info">
                    <span className="photo-ready-icon">✓</span>
                    <span className="photo-ready-text">
                      {lang === 'zh' ? '照片已成功上传' : 'Photo uploaded successfully'}
                    </span>
                    <span className="photo-ready-name">{photoFile.name}</span>
                  </div>
                  <div className="photo-ready-actions">
                    <button className="photo-retake-btn" onClick={() => {
                      setPhotoFile(null)
                      setPhotoPreview('')
                      // 重置 input，确保可以重新选择同一张图片
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}>
                      {lang === 'zh' ? '重新选择' : 'Change'}
                    </button>
                    <button
                      className={`photo-analyze-btn${photoLoading ? ' loading' : ''}`}
                      onClick={handlePhotoAnalyze}
                      disabled={photoLoading}
                    >
                      {photoLoading
                        ? (lang === 'zh' ? '分析中…' : 'Analyzing…')
                        : (lang === 'zh' ? '开始分析' : 'Analyze')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="photo-upload-empty" onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                    fileInputRef.current.click()
                  }
                }}>
                  <div className="photo-upload-icon">☯</div>
                  <div className="photo-upload-label">
                    {activeModule === 'self'
                      ? (lang === 'zh' ? '拍摄或上传手掌照片' : 'Take or upload a palm photo')
                      : (lang === 'zh' ? '拍摄或上传居家照片' : 'Take or upload a home photo')}
                  </div>
                  <div className="photo-upload-hint">
                    {activeModule === 'self'
                      ? (lang === 'zh' ? '建议右手掌心朝上，光线充足' : 'Right palm facing up, good lighting')
                      : (lang === 'zh' ? '建议拍摄整个房间，包含主要家具' : 'Capture the whole room including main furniture')}
                  </div>
                </div>
              )}
            </div>
          )}


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
            {/* 手相/风水模式：结果顶部显示重新上传按钮 */}
            {isPhotoMode && results.length > 0 && !loading && (
              <button className="photo-reupload-btn" onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                  fileInputRef.current.click()
                }
              }}>
                {activeModule === 'self'
                  ? (lang === 'zh' ? '+ 上传新手相照片' : '+ Upload new palm photo')
                  : (lang === 'zh' ? '+ 上传新居家照片' : '+ Upload new home photo')}
              </button>
            )}
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
