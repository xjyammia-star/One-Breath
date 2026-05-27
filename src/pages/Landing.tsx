// src/pages/Landing.tsx
import { Lang } from '../types'
import { useAuth } from '../utils/authContext'

interface Props {
  lang: Lang
  setLang: (l: Lang) => void
  onEnter: () => void
  onLogin: () => void      // 跳转登录页
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
  },
}

export default function Landing({ lang, setLang, onEnter, onLogin, hasUser }: Props) {
  const t = text[lang]
  const { user: authUser, logout } = useAuth()

  return (
    <div className="landing">
      {/* 右上角：语言切换 + 登录按钮 */}
      <div className="landing-topbar">
        <div className="lang-switcher">
          <button
            className={lang === 'zh' ? 'active' : ''}
            onClick={() => setLang('zh')}
          >中文</button>
          <span className="divider">|</span>
          <button
            className={lang === 'en' ? 'active' : ''}
            onClick={() => setLang('en')}
          >EN</button>
        </div>

        {/* 登录状态区域 */}
        <div className="landing-auth-area">
          {authUser ? (
            // 已登录：显示用户名 + 退出
            <>
              <span className="landing-username">
                {t.hi}{authUser.email?.split('@')[0]}
              </span>
              <button className="landing-login-btn" onClick={() => logout()}>
                {t.logout}
              </button>
            </>
          ) : (
            // 未登录：显示登录按钮
            <button className="landing-login-btn" onClick={onLogin}>
              {t.login}
            </button>
          )}
        </div>
      </div>

      {/* 水墨山水背景层 */}
      <div className="ink-bg">
        <div className="ink-layer ink-mountains" />
        <div className="ink-layer ink-mist" />
      </div>

      {/* 太极图 */}
      <div className="taiji-container">
        <svg viewBox="0 0 200 200" className="taiji-svg" aria-hidden="true">
          {/* 外圆 */}
          <circle cx="100" cy="100" r="90" className="taiji-outer" />
          {/* 阴半 */}
          <path d="M100,10 A90,90 0 0,0 100,190 A45,45 0 0,0 100,100 A45,45 0 0,1 100,10 Z" className="taiji-yin" />
          {/* 阳半 */}
          <path d="M100,10 A90,90 0 0,1 100,190 A45,45 0 0,1 100,100 A45,45 0 0,0 100,10 Z" className="taiji-yang" />
          {/* 小圆点 */}
          <circle cx="100" cy="55"  r="12" className="taiji-yang-dot" />
          <circle cx="100" cy="145" r="12" className="taiji-yin-dot" />
        </svg>
      </div>

      {/* 主标题区 */}
      <div className="hero">
        <h1 className="hero-title">
          <span className="title-zh">{t.title}</span>
          {lang === 'en' && <span className="title-en-small">One Breath</span>}
        </h1>
        <p className="hero-subtitle">{t.subtitle}</p>
        <p className="hero-tagline">{t.tagline}</p>
        <p className="hero-desc">{t.desc}</p>

        <button className="enter-btn" onClick={onEnter}>
          <span className="enter-text">{hasUser ? t.return : t.enter}</span>
          <span className="enter-glyph">☯</span>
        </button>
      </div>

      {/* 三大模块预览 */}
      <div className="modules-preview">
        {t.modules.map((mod, i) => (
          <div key={i} className={`module-card module-${i}`} onClick={onEnter}>
            <div className="module-gua">{['☰', '☷', '☯'][i]}</div>
            <div className="module-name">{mod}</div>
            <div className="module-sub">{t.moduleSubs[i]}</div>
          </div>
        ))}
      </div>

      {/* 装饰性八卦符文 */}
      <div className="bagua-ring" aria-hidden="true">
        {['☰','☱','☲','☳','☴','☵','☶','☷'].map((gua, i) => (
          <span
            key={i}
            className="bagua-char"
            style={{ '--angle': `${i * 45}deg` } as React.CSSProperties}
          >{gua}</span>
        ))}
      </div>

      {/* 页脚 */}
      <footer className="landing-footer">
        <p className="footer-quote">
          {lang === 'zh'
            ? '道可道，非常道。名可名，非常名。'
            : 'The Tao that can be told is not the eternal Tao.'}
        </p>
        <p className="footer-credit">
          {lang === 'zh' ? '一炁堂 · 传统命理与现代智慧' : 'One Breath · Ancient Wisdom, Modern Insight'}
        </p>
      </footer>
    </div>
  )
}
