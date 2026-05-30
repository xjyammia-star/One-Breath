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
    yearError: '请输入1900-2025之间的年份',
    monthError: '请输入1-12之间的月份',
    dayError: '请输入1-31之间的日期',
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
    yearError: 'Enter a year between 1900-2025',
    monthError: 'Enter a month between 1-12',
    dayError: 'Enter a day between 1-31',
  },
}

const currentYear = new Date().getFullYear()

// 把字符串转成合法的数字，不合法返回 null
function parseIntSafe(s: string, min: number, max: number): number | null {
  const n = parseInt(s, 10)
  if (isNaN(n)) return null
  if (n < min || n > max) return null
  return n
}

export default function Setup({ lang, onSave, onBack }: Props) {
  const t = text[lang]

  const [name, setName] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('female')

  // 用字符串存储，允许用户随时清空再输入
  const [yearStr, setYearStr] = useState('1990')
  const [monthStr, setMonthStr] = useState('6')
  const [dayStr, setDayStr] = useState('15')

  const [hourIndex, setHourIndex] = useState(6)
  const [birthPlace, setBirthPlace] = useState('')

  const hourMap = [23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]

  const year  = parseIntSafe(yearStr,  1900, currentYear)
  const month = parseIntSafe(monthStr, 1, 12)
  const day   = parseIntSafe(dayStr,   1, 31)

  const lunarDate = (year && month && day) ? solarToLunar(year, month, day) : ''

  const canSubmit = year !== null && month !== null && day !== null

  const handleSubmit = () => {
    if (!canSubmit) return
    onSave({
      name: name.trim() || (lang === 'zh' ? '访客' : 'Guest'),
      gender,
      birthYear:  year!,
      birthMonth: month!,
      birthDay:   day!,
      birthHour:  hourMap[hourIndex],
      birthPlace: birthPlace.trim() || (lang === 'zh' ? '未知' : 'Unknown'),
      lunarDate,
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <div className="setup-page">
      <div className="setup-panel">
        <div className="setup-header">
          <button className="back-btn" onClick={onBack}>{t.back}</button>
          <div className="setup-title-area">
            <div className="setup-glyph">⊕</div>
            <h2 className="setup-title">{t.title}</h2>
            <p className="setup-subtitle">{t.subtitle}</p>
          </div>
        </div>

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

              {/* 年份：text + inputmode="numeric"，支持随意清空 */}
              <div className="date-field">
                <input
                  className={`form-input date-input date-input-year${year === null && yearStr.length > 0 ? ' input-error' : ''}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="1990"
                  value={yearStr}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9]/g, '')
                    if (v.length <= 4) setYearStr(v)
                  }}
                />
                <span className="date-unit">{t.year}</span>
              </div>

              {/* 月份 */}
              <div className="date-field">
                <input
                  className={`form-input date-input${month === null && monthStr.length > 0 ? ' input-error' : ''}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="6"
                  value={monthStr}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9]/g, '')
                    if (v.length <= 2) setMonthStr(v)
                  }}
                />
                <span className="date-unit">{t.month}</span>
              </div>

              {/* 日期 */}
              <div className="date-field">
                <input
                  className={`form-input date-input${day === null && dayStr.length > 0 ? ' input-error' : ''}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="15"
                  value={dayStr}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9]/g, '')
                    if (v.length <= 2) setDayStr(v)
                  }}
                />
                <span className="date-unit">{t.day}</span>
              </div>
            </div>

            {/* 错误提示 */}
            {year === null && yearStr.length > 0 && (
              <p className="input-error-msg">{t.yearError}</p>
            )}

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
            <button
              className={`submit-btn${!canSubmit ? ' submit-btn-disabled' : ''}`}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              <span>{t.submit}</span>
              <span className="submit-glyph">卦</span>
            </button>
          </div>
        </div>
      </div>

      <div className="setup-bg-deco" aria-hidden="true">
        <div className="deco-circle deco-circle-1" />
        <div className="deco-circle deco-circle-2" />
      </div>
    </div>
  )
}
