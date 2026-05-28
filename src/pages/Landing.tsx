// src/pages/Landing.tsx
import { Lang } from '../types'
import { useAuth } from '../utils/authContext'

interface Props {
  lang: Lang
  setLang: (l: Lang) => void
  onEnter: () => void
  onLogin: () => void
  hasUser: boolean
}

const text = {
  zh: {
    title: '一炁堂',
    subtitle: '阴阳·五行·八卦',
    tagline: '天地人三才，以炁通玄',
    desc: '以古典命理之道，洞见自身、关系与世界的深层律动',
    enter: '入堂',
    return: '返回命盘',
    modules: ['与己', '与人', '与世界'],
    moduleSubs: ['自身命盘·五行分析', '合婚·人际关系', '时运·世界能量'],
    login: '登录 / 注册',
    logout: '退出',
    hi: '好，',
    sideLeft: ['天', '地', '人', '和', '道', '德', '仁', '义'],
    sideRight: ['乾', '坤', '震', '巽', '坎', '离', '艮', '兑'],
    quote: '道可道，非常道。名可名，非常名。',
    credit: '一炁堂 · 传统命理与现代智慧',
  },
  en: {
    title: 'One Breath',
    subtitle: 'Yin · Yang · Five Elements · Bagua',
    tagline: 'Heaven, Earth, Human — united through Qi',
    desc: 'Ancient wisdom meets modern insight: know yourself, your relations, and the world',
    enter: 'Enter',
    return: 'Return to Chart',
    modules: ['The Self', 'Relations', 'The World'],
    moduleSubs: ['Birth chart · Five elements', 'Compatibility · Bonds', 'Timing · World energy'],
    login: 'Login / Register',
    logout: 'Logout',
    hi: 'Hi, ',
    sideLeft: ['天', '地', '人', '和', '道', '德', '仁', '义'],
    sideRight: ['乾', '坤', '震', '巽', '坎', '离', '艮', '兑'],
    quote: 'The Tao that can be told is not the eternal Tao.',
    credit: 'One Breath · Ancient Wisdom, Modern Insight',
  },
}

// 八卦数据：符号 + 名称
const BAGUA = [
  { gua: '☰', name: '乾', en: 'Heaven' },
  { gua: '☱', name: '兑', en: 'Lake' },
  { gua: '☲', name: '离', en: 'Fire' },
  { gua: '☳', name: '震', en: 'Thunder' },
  { gua: '☴', name: '巽', en: 'Wind' },
  { gua: '☵', name: '坎', en: 'Water' },
  { gua: '☶', name: '艮', en: 'Mountain' },
  { gua: '☷', name: '坤', en: 'Earth' },
]

export default function Landing({ lang, setLang, onEnter, onLogin, hasUser }: Props) {
  const t = text[lang]
  const { user: authUser, logout } = useAuth()

  return (
    <div className="landing">

      {/* ── 多层背景 ── */}
      <div className="ink-bg">
        <div className="ink-layer ink-mountains" />
        <div className="ink-layer ink-mist" />
        <div className="ink-layer ink-texture" />
      </div>

      {/* ── 网格纹路 ── */}
      <div className="landing-grid" aria-hidden="true" />

      {/* ── 竖排装饰文字（左侧）── */}
      <div className="deco-vert deco-vert-left" aria-hidden="true">
        {t.sideLeft.map((c, i) => (
          <span key={i} className="deco-vert-char" style={{ animationDelay: `${i * 0.15}s` }}>{c}</span>
        ))}
      </div>

      {/* ── 竖排装饰文字（右侧）── */}
      <div className="deco-vert deco-vert-right" aria-hidden="true">
        {t.sideRight.map((c, i) => (
          <span key={i} className="deco-vert-char" style={{ animationDelay: `${i * 0.15 + 0.5}s` }}>{c}</span>
        ))}
      </div>

      {/* ── 角落纹饰 ── */}
      <div className="corner-deco corner-tl" aria-hidden="true" />
      <div className="corner-deco corner-tr" aria-hidden="true" />
      <div className="corner-deco corner-bl" aria-hidden="true" />
      <div className="corner-deco corner-br" aria-hidden="true" />

      {/* ── 浮动粒子 ── */}
      <div className="particles" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="particle" style={{
            left: `${5 + (i * 37 + i * i * 3) % 90}%`,
            top: `${10 + (i * 53 + i * 7) % 80}%`,
            animationDelay: `${(i * 0.7) % 6}s`,
            animationDuration: `${4 + (i * 1.3) % 5}s`,
          }} />
        ))}
      </div>

      {/* ── 顶栏 ── */}
      <div className="landing-topbar">
        <div className="lang-switcher">
          <button className={lang === 'zh' ? 'active' : ''} onClick={() => setLang('zh')}>中文</button>
          <span className="divider">|</span>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
        </div>
        <div className="landing-auth-area">
          {authUser ? (
            <>
              <span className="landing-username">{t.hi}{authUser.email?.split('@')[0]}</span>
              <button className="landing-login-btn" onClick={() => logout()}>{t.logout}</button>
            </>
          ) : (
            <button className="landing-login-btn" onClick={onLogin}>{t.login}</button>
          )}
        </div>
      </div>

      {/* ── 太极图 ── */}
      <div className="taiji-container">
        <div className="taiji-glow" />
        <svg viewBox="0 0 200 200" className="taiji-svg" aria-hidden="true">
          <circle cx="100" cy="100" r="90" className="taiji-outer" />
          <path d="M100,10 A90,90 0 0,0 100,190 A45,45 0 0,0 100,100 A45,45 0 0,1 100,10 Z" className="taiji-yin" />
          <path d="M100,10 A90,90 0 0,1 100,190 A45,45 0 0,1 100,100 A45,45 0 0,0 100,10 Z" className="taiji-yang" />
          <circle cx="100" cy="55"  r="12" className="taiji-yang-dot" />
          <circle cx="100" cy="145" r="12" className="taiji-yin-dot" />
        </svg>
        {/* 外圈八卦 */}
        <div className="taiji-bagua-ring">
          {BAGUA.map((b, i) => (
            <div
              key={i}
              className="taiji-bagua-item"
              style={{ '--i': i } as React.CSSProperties}
            >
              <span className="tbg-gua">{b.gua}</span>
              <span className="tbg-name">{b.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 主标题区 ── */}
      <div className="hero">
        {/* 顶部装饰线 */}
        <div className="hero-ornament hero-ornament-top" aria-hidden="true">
          <span className="orn-line" /><span className="orn-diamond">◆</span><span className="orn-line" />
        </div>

        <h1 className="hero-title">
          <span className="title-zh">{lang === 'zh' ? t.title : 'One Breath'}</span>
          {lang === 'en' && <span className="title-en-small">One Breath</span>}
        </h1>
        <p className="hero-subtitle">{t.subtitle}</p>

        <div className="hero-divider" aria-hidden="true">
          <span /><span className="divider-gua">☯</span><span />
        </div>

        <p className="hero-tagline">{t.tagline}</p>
        <p className="hero-desc">{t.desc}</p>

        {/* 底部装饰线 */}
        <div className="hero-ornament hero-ornament-bottom" aria-hidden="true">
          <span className="orn-line" /><span className="orn-diamond">◆</span><span className="orn-line" />
        </div>

        <button className="enter-btn" onClick={onEnter}>
          <span className="enter-text">{hasUser ? t.return : t.enter}</span>
          <span className="enter-glyph">☯</span>
        </button>
      </div>

      {/* ── 三大模块预览 ── */}
      <div className="modules-preview">
        {t.modules.map((mod, i) => (
          <div key={i} className={`module-card module-${i}`} onClick={onEnter}>
            <div className="module-card-inner">
              <div className="module-gua">{['☰', '☷', '☯'][i]}</div>
              <div className="module-name">{mod}</div>
              <div className="module-sub">{t.moduleSubs[i]}</div>
              <div className="module-card-deco" aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>

      {/* ── 八卦符文环（右下角装饰）── */}
      <div className="bagua-ring" aria-hidden="true">
        {BAGUA.map((b, i) => (
          <span
            key={i}
            className="bagua-char"
            style={{ '--angle': `${i * 45}deg` } as React.CSSProperties}
          >{b.gua}</span>
        ))}
      </div>

      {/* ── 底部水平装饰纹 ── */}
      <div className="landing-bottom-band" aria-hidden="true">
        <div className="band-inner">
          {['一生二', '二生三', '三生萬物', '道法自然', '天人合一', '知行合一'].map((s, i) => (
            <span key={i} className="band-phrase">{s}</span>
          ))}
        </div>
      </div>

      {/* ── 页脚 ── */}
      <footer className="landing-footer">
        <p className="footer-quote">{t.quote}</p>
        <p className="footer-credit">{t.credit}</p>
      </footer>

    </div>
  )
}
