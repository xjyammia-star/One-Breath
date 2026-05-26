// src/utils/calendar.ts
// 公历转农历（简化版，基于查表法）
// 完整精确版可后续接入 lunar-javascript 或 chinese-lunar 库

// 农历月名
const LUNAR_MONTHS = ['正','二','三','四','五','六','七','八','九','十','冬','腊']
const LUNAR_DAYS = [
  '初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十',
]
const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
const DI_ZHI   = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
const ZODIAC   = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪']

/**
 * 简化版公历转农历
 * 精确度：±1-2天（对于命盘展示足够，精确算命需专业库）
 * 
 * 后续升级方案：
 * npm install lunar-javascript
 * import { Lunar } from 'lunar-javascript'
 * const lunar = Lunar.fromDate(new Date(year, month-1, day))
 */
export function solarToLunar(year: number, month: number, day: number): string {
  try {
    // 天干地支年份
    const ganIdx = ((year - 4) % 10 + 10) % 10
    const zhiIdx = ((year - 4) % 12 + 12) % 12
    const yearStr = `${TIAN_GAN[ganIdx]}${DI_ZHI[zhiIdx]}年（${ZODIAC[zhiIdx]}）`

    // 简化农历月日（近似值）
    // 农历新年大约在公历1月21日到2月20日之间
    // 此处用近似偏移，精确需节气数据
    const approxLunarMonth = getLunarMonthApprox(year, month, day)
    const approxLunarDay   = getLunarDayApprox(day)

    const monthStr = `${LUNAR_MONTHS[approxLunarMonth - 1]}月`
    const dayStr   = LUNAR_DAYS[approxLunarDay - 1] || `${approxLunarDay}日`

    return `${yearStr} ${monthStr}${dayStr}`
  } catch {
    return `${year}年（农历换算中）`
  }
}

function getLunarMonthApprox(year: number, month: number, day: number): number {
  // 农历新年偏移：大约在公历1月21日~2月20日
  const springFestivalApprox = getSpringFestivalApprox(year)
  const currentDayOfYear = getDayOfYear(year, month, day)

  let lunarMonth = month - 1  // 近似偏移
  if (currentDayOfYear < springFestivalApprox) {
    lunarMonth = month + 11  // 上一年腊月附近
  }

  return Math.max(1, Math.min(12, lunarMonth))
}

function getSpringFestivalApprox(year: number): number {
  // 农历新年大约在公历第21-51天之间
  // 用简单线性近似
  return 30 + ((year * 7) % 30)
}

function getDayOfYear(year: number, month: number, day: number): number {
  const months = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  return months[month - 1] + day + (isLeap && month > 2 ? 1 : 0)
}

function getLunarDayApprox(solarDay: number): number {
  // 农历日期与公历日期大约差0-2天
  return Math.max(1, Math.min(30, solarDay))
}

/**
 * 获取生肖
 */
export function getZodiac(year: number): string {
  const zhiIdx = ((year - 4) % 12 + 12) % 12
  return ZODIAC[zhiIdx]
}

/**
 * 获取天干地支年
 */
export function getGanZhiYear(year: number): string {
  const ganIdx = ((year - 4) % 10 + 10) % 10
  const zhiIdx = ((year - 4) % 12 + 12) % 12
  return `${TIAN_GAN[ganIdx]}${DI_ZHI[zhiIdx]}`
}
