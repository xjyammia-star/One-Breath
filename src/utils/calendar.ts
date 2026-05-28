// src/utils/calendar.ts
// 公历转农历 — 使用 lunar-javascript 精确版

// 说明：lunar-javascript 已在 package.json 中添加
// 如遇到 TypeScript 报错，在 tsconfig.json 的 compilerOptions 里加：
// "moduleResolution": "bundler" 或 "node16"

const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
const DI_ZHI   = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
const ZODIAC   = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪']
const LUNAR_MONTHS = ['正','二','三','四','五','六','七','八','九','十','冬','腊']
const LUNAR_DAYS = [
  '初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十',
]

/**
 * 公历转农历（精确版）
 * 使用 lunar-javascript 库，精度高，支持节气判断
 */
export function solarToLunar(year: number, month: number, day: number): string {
  try {
    // 动态导入，避免 SSR 问题
    const { Lunar, Solar } = require('lunar-javascript')
    const solar = Solar.fromYmd(year, month, day)
    const lunar = solar.getLunar()

    // 农历年干支 + 生肖
    const lunarYear  = lunar.getYear()
    const ganIdx = ((lunarYear - 4) % 10 + 10) % 10
    const zhiIdx = ((lunarYear - 4) % 12 + 12) % 12
    const yearStr = `${TIAN_GAN[ganIdx]}${DI_ZHI[zhiIdx]}年（${ZODIAC[zhiIdx]}）`

    // 农历月（处理闰月）
    const lunarMonthNum = Math.abs(lunar.getMonth())  // 闰月为负数
    const isLeapMonth   = lunar.getMonth() < 0
    const monthStr = `${isLeapMonth ? '闰' : ''}${LUNAR_MONTHS[lunarMonthNum - 1]}月`

    // 农历日
    const lunarDayNum = lunar.getDay()
    const dayStr = LUNAR_DAYS[lunarDayNum - 1] || `${lunarDayNum}日`

    return `${yearStr} ${monthStr}${dayStr}`
  } catch {
    // lunar-javascript 加载失败时，降级到简化版
    return solarToLunarFallback(year, month, day)
  }
}

/**
 * 获取节气名称（用于命理分析的月柱判断）
 * 返回当前日期所在或最近的节气
 */
export function getJieQi(year: number, month: number, day: number): string {
  try {
    const { Solar } = require('lunar-javascript')
    const solar = Solar.fromYmd(year, month, day)
    const lunar = solar.getLunar()
    const jieQi = lunar.getPrevJieQi()  // 上一个节气
    return jieQi ? jieQi.getName() : ''
  } catch {
    return ''
  }
}

/**
 * 获取生肖（精确：按农历年）
 */
export function getZodiac(year: number, month: number, day: number): string {
  try {
    const { Solar } = require('lunar-javascript')
    const solar = Solar.fromYmd(year, month, day)
    const lunar = solar.getLunar()
    const lunarYear = lunar.getYear()
    const zhiIdx = ((lunarYear - 4) % 12 + 12) % 12
    return ZODIAC[zhiIdx]
  } catch {
    // 降级：直接用公历年（春节前后会差一年，但影响小）
    const zhiIdx = ((year - 4) % 12 + 12) % 12
    return ZODIAC[zhiIdx]
  }
}

/**
 * 获取天干地支年（按农历年，精确）
 */
export function getGanZhiYear(year: number, month?: number, day?: number): string {
  try {
    if (month && day) {
      const { Solar } = require('lunar-javascript')
      const solar = Solar.fromYmd(year, month, day)
      const lunar = solar.getLunar()
      const lunarYear = lunar.getYear()
      const ganIdx = ((lunarYear - 4) % 10 + 10) % 10
      const zhiIdx = ((lunarYear - 4) % 12 + 12) % 12
      return `${TIAN_GAN[ganIdx]}${DI_ZHI[zhiIdx]}`
    }
  } catch {}
  // 降级
  const ganIdx = ((year - 4) % 10 + 10) % 10
  const zhiIdx = ((year - 4) % 12 + 12) % 12
  return `${TIAN_GAN[ganIdx]}${DI_ZHI[zhiIdx]}`
}

// ── 降级版（lunar-javascript 不可用时使用）──────────────
function solarToLunarFallback(year: number, month: number, day: number): string {
  const ganIdx = ((year - 4) % 10 + 10) % 10
  const zhiIdx = ((year - 4) % 12 + 12) % 12
  const yearStr = `${TIAN_GAN[ganIdx]}${DI_ZHI[zhiIdx]}年（${ZODIAC[zhiIdx]}）`
  const approxMonth = Math.max(1, Math.min(12, month - 1 || 12))
  const approxDay   = Math.max(1, Math.min(30, day))
  return `${yearStr} ${LUNAR_MONTHS[approxMonth - 1]}月${LUNAR_DAYS[approxDay - 1]}`
}
