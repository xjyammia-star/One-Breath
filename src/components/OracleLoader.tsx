// src/components/OracleLoader.tsx
// 推算中动画组件 — 八卦旋转 + 字符散发

import { useEffect, useState, useRef } from 'react'

interface Props {
  lang: 'zh' | 'en'
}

// 散发的字符池
const CHARS_ZH = [
  '乾','坤','震','巽','坎','离','艮','兑',
  '甲','乙','丙','丁','戊','己','庚','辛','壬','癸',
  '子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥',
  '金','木','水','火','土',
  '阴','阳','道','炁','玄',
  '☰','☱','☲','☳','☴','☵','☶','☷','☯',
]

const CHARS_EN = [
  'Qi','Yin','Yang','Tao','Wu',
  '☰','☱','☲','☳','☴','☵','☶','☷','☯',
  '乾','坤','离','坎','震','巽',
  'Metal','Wood','Water','Fire','Earth',
]

// 推算进度文字
const STEPS_ZH = [
  '排列四柱，定立命盘…',
  '推演天干，察阴阳之势…',
  '观地支藏干，寻五行根基…',
  '论十神格局，辨生克制化…',
  '参古籍印证，以验命理…',
  '天机推演中，稍候…',
]

const STEPS_EN = [
  'Arranging the Four Pillars…',
  'Reading the Heavenly Stems…',
  'Tracing the Earthly Branches…',
  'Calculating Ten Gods…',
  'Consulting the ancient texts…',
  'The oracle is speaking…',
]

const BAGUA = ['☰','☱','☲','☳','☴','☵','☶','☷']
const BAGUA_NAMES_ZH = ['乾','兑','离','震','巽','坎','艮','坤']
const BAGUA_NAMES_EN = ['Heaven','Lake','Fire','Thunder','Wind','Water','Mountain','Earth']

interface FloatingChar {
  id: number
  char: string
  x: number
  y: number
  size: number
  opacity: number
  duration: number
  delay: number
  angle: number
  distance: number
}

export default function OracleLoader({ lang }: Props) {
  const [stepIdx, setStepIdx] = useState(0)
  const [chars, setChars] = useState<FloatingChar[]>([])
  const counterRef = useRef(0)
  const steps = lang === 'zh' ? STEPS_ZH : STEPS_EN
  const charPool = lang === 'zh' ? CHARS_ZH : CHARS_EN

  // 步骤文字轮播
  useEffect(() => {
    const t = setInterval(() => {
      setStepIdx(i => (i + 1) % steps.length)
    }, 1800)
    return () => clearInterval(t)
  }, [steps.length])

  // 持续生成散发字符
  useEffect(() => {
    const spawn = () => {
      const id = counterRef.current++
      const char = charPool[Math.floor(Math.random() * charPool.length)]
      const angle = Math.random() * 360
      const distance = 80 + Math.random() * 120

      setChars(prev => [
        ...prev.slice(-24), // 最多保留24个，避免过多DOM
        {
          id,
          char,
          x: 50,
          y: 50,
          size: 10 + Math.random() * 14,
          opacity: 0.15 + Math.random() * 0.55,
          duration: 1.8 + Math.random() * 2.2,
          delay: 0,
          angle,
          distance,
        }
      ])
    }

    // 每300ms生成一个字符
    const t = setInterval(spawn, 300)
    return () => clearInterval(t)
  }, [charPool])

  return (
    <div className="oracle-loader">
      {/* 散发字符层 */}
      <div className="oracle-chars-field">
        {chars.map(c => (
          <span
            key={c.id}
            className="oracle-float-char"
            style={{
              fontSize: `${c.size}px`,
              '--angle': `${c.angle}deg`,
              '--distance': `${c.distance}px`,
              '--duration': `${c.duration}s`,
              '--opacity': c.opacity,
            } as React.CSSProperties}
          >
            {c.char}
          </span>
        ))}
      </div>

      {/* 主体：八卦 + 太极 */}
      <div className="oracle-diagram">

        {/* 最外圈：缓慢反转的八卦符文环 */}
        <div className="oracle-ring oracle-ring-outer">
          {BAGUA.map((gua, i) => (
            <div
              key={i}
              className="oracle-ring-item"
              style={{ '--i': i, '--total': 8 } as React.CSSProperties}
            >
              <span className="oracle-ring-gua">{gua}</span>
              <span className="oracle-ring-name">
                {lang === 'zh' ? BAGUA_NAMES_ZH[i] : BAGUA_NAMES_EN[i]}
              </span>
            </div>
          ))}
        </div>

        {/* 中间圈：天干环（顺转） */}
        <div className="oracle-ring oracle-ring-mid">
          {['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((gan, i) => (
            <div
              key={i}
              className="oracle-ring-item oracle-ring-item-sm"
              style={{ '--i': i, '--total': 10 } as React.CSSProperties}
            >
              <span className="oracle-ring-gan">{gan}</span>
            </div>
          ))}
        </div>

        {/* 内圈：地支环（反转） */}
        <div className="oracle-ring oracle-ring-inner">
          {['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].map((zhi, i) => (
            <div
              key={i}
              className="oracle-ring-item oracle-ring-item-xs"
              style={{ '--i': i, '--total': 12 } as React.CSSProperties}
            >
              <span className="oracle-ring-zhi">{zhi}</span>
            </div>
          ))}
        </div>

        {/* 核心：太极图 */}
        <div className="oracle-taiji-core">
          <svg viewBox="0 0 100 100" className="oracle-taiji-svg">
            <circle cx="50" cy="50" r="45" fill="#1a1612" />
            <path d="M50,5 A45,45 0 0,1 50,95 L50,50 Z" fill="#f5f0e8" />
            <circle cx="50" cy="27.5" r="22.5" fill="#f5f0e8" />
            <circle cx="50" cy="72.5" r="22.5" fill="#1a1612" />
            <circle cx="50" cy="27.5" r="6" fill="#1a1612" />
            <circle cx="50" cy="72.5" r="6" fill="#f5f0e8" />
            <circle cx="50" cy="50" r="44.5" fill="none" stroke="rgba(155,125,58,0.4)" strokeWidth="1" />
          </svg>
          {/* 发光脉冲 */}
          <div className="oracle-core-glow" />
        </div>
      </div>

      {/* 推算步骤文字 */}
      <div className="oracle-steps">
        <div className="oracle-step-text" key={stepIdx}>
          {steps[stepIdx]}
        </div>
        <div className="oracle-step-dots">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`oracle-step-dot ${i === stepIdx ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
