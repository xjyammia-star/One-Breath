// src/pages/Setup.tsx
import { useState } from 'react'
import { UserProfile, Lang } from '../types'
import { solarToLunar } from '../utils/calendar'

interface Props {
  lang: Lang
  onSave: (profile: UserProfile) => void
  onBack: () => void
}

const text = {
  zh: {
    title: '建立命盘',
    subtitle: '请输入您的生辰信息，以起算八字命盘',
    name: '姓名（可选）',
    namePlaceholder: '如：王芳',
    gender: '性别',
    male: '男',
    female: '女',
    other: '其他',
    birthDate: '出生日期（公历）',
    year: '年',
    month: '月',
    day: '日',
    hour: '出生时辰',
    hourNote: '不知时辰可选正午（12时）',
    birthPlace: '出生地',
    birthPlaceholder: '如：北京市',
    lunarLabel: '农历换算',
    submit: '起卦入堂',
    back: '← 返回',
    privacy: '您的信息仅存于本机，不上传任何服务器。',
    hours: [
      '子时 23-1时','丑时 1-3时','寅时 3-5时','卯时 5-7时',
      '辰时 7-9时','巳时 9-11时','午时 11-13时','未时 13-15时',
      '申时 15-17时','酉时 17-19时','戌时 19-21时','亥时 21-23时',
    ],
  },
  en: {
    title: 'Create Your Chart',
    subtitle: 'Enter your birth details to calculate your Ba Zi chart',
    name: 'Name (optional)',
    namePlaceholder: 'e.g. Jamie',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    birthDate: 'Date of Birth (Solar calendar)',
    year: 'Year',
    month: 'Month',
    day: 'Day',
    hour: 'Birth Hour',
    hourNote: 'If unknown, noon (12:00) is conventional',
    birthPlace: 'Birth Place',
    birthPlaceholder: 'e.g. Shanghai',
    lunarLabel: 'Lunar Date',
    submit: 'Begin Reading',
    back: '← Back',
    privacy: 'Your data is stored locally only — nothing is uploaded.',
    hours: [
      'Zi 23-1h','Chou 1-3h','Yin 3-5h','Mao 5-7h',
      'Chen 7-9h','Si 9-11h','Wu 11-13h','Wei 13-15h',
      'Shen 15-17h','You 17-19h','Xu 19-21h','Hai 21-23h',
    ],
  },
}

const currentYear = new Date().getFullYear()

export default function Setup({ lang, onSave, onBack }: Props) {
  const t = text[lang]

  const [name, setName] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('female')
  const [year, setYear] = useState(1990)
  const [month, setMonth] = useState(6)
  const [day, setDay] = useState(15)
  const [hourIndex, setHourIndex] = useState(6) // 午时=12h
  const [birthPlace, setBirthPlace] = useState('')

  // 计算农历
  const lunarDate = solarToLunar(year, month, day)

  // 时辰对应小时
  const hourMap = [23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]

  const handleSubmit = () => {
    onSave({
      name: name.trim() || (lang === 'zh' ? '访客' : 'Guest'),
      gender,
      birthYear: year,
      birthMonth: month,
      birthDay: day,
      birthHour: hourMap[hourIndex],
      birthPlace: birthPlace.trim() || (lang === 'zh' ? '未知' : 'Unknown'),
      lunarDate,
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <div className="setup-page">
      <div className="setup-panel">
        {/* 头部 */}
        <div className="setup-header">
          <button className="back-btn" onClick={onBack}>{t.back}</button>
          <div className="setup-title-area">
            <div className="setup-glyph">⊕</div>
            <h2 className="setup-title">{t.title}</h2>
            <p className="setup-subtitle">{t.subtitle}</p>
          </div>
        </div>

        {/* 表单 */}
        <div className="setup-form">
          {/* 姓名 */}
          <div className="form-row">
            <label className="form-label">{t.name}</label>
            <input
              className="form-input"
              type="text"
              placeholder={t.namePlaceholder}
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
            />
          </div>

          {/* 性别 */}
          <div className="form-row">
            <label className="form-label">{t.gender}</label>
            <div className="gender-group">
              {(['female', 'male', 'other'] as const).map(g => (
                <button
                  key={g}
                  className={`gender-btn ${gender === g ? 'active' : ''}`}
                  onClick={() => setGender(g)}
                >
                  {g === 'male' ? t.male : g === 'female' ? t.female : t.other}
                </button>
              ))}
            </div>
          </div>

          {/* 出生日期 */}
          <div className="form-row">
            <label className="form-label">{t.birthDate}</label>
            <div className="date-group">
              <div className="date-field">
                <input
                  className="form-input date-input"
                  type="number"
                  min={1900}
                  max={currentYear}
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                />
                <span className="date-unit">{t.year}</span>
              </div>
              <div className="date-field">
                <input
                  className="form-input date-input"
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={e => setMonth(Number(e.target.value))}
                />
                <span className="date-unit">{t.month}</span>
              </div>
              <div className="date-field">
                <input
                  className="form-input date-input"
                  type="number"
                  min={1}
                  max={31}
                  value={day}
                  onChange={e => setDay(Number(e.target.value))}
                />
                <span className="date-unit">{t.day}</span>
              </div>
            </div>

            {/* 农历显示 */}
            {lunarDate && (
              <div className="lunar-display">
                <span className="lunar-label">{t.lunarLabel}：</span>
                <span className="lunar-value">{lunarDate}</span>
              </div>
            )}
          </div>

          {/* 出生时辰 */}
          <div className="form-row">
            <label className="form-label">{t.hour}</label>
            <div className="hour-grid">
              {t.hours.map((h, i) => (
                <button
                  key={i}
                  className={`hour-btn ${hourIndex === i ? 'active' : ''}`}
                  onClick={() => setHourIndex(i)}
                >
                  {h}
                </button>
              ))}
            </div>
            <p className="form-note">{t.hourNote}</p>
          </div>

          {/* 出生地 */}
          <div className="form-row">
            <label className="form-label">{t.birthPlace}</label>
            <input
              className="form-input"
              type="text"
              placeholder={t.birthPlaceholder}
              value={birthPlace}
              onChange={e => setBirthPlace(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* 提交 */}
          <div className="form-footer">
            <p className="privacy-note">{t.privacy}</p>
            <button className="submit-btn" onClick={handleSubmit}>
              <span>{t.submit}</span>
              <span className="submit-glyph">卦</span>
            </button>
          </div>
        </div>
      </div>

      {/* 背景装饰 */}
      <div className="setup-bg-deco" aria-hidden="true">
        <div className="deco-circle deco-circle-1" />
        <div className="deco-circle deco-circle-2" />
      </div>
    </div>
  )
}
