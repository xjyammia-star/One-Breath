// src/utils/bazi.ts
// 八字（四柱）推算
import { BaZi, TianGan, DiZhi } from '../types'

const TIAN_GAN: TianGan[] = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
const DI_ZHI: DiZhi[]  = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']

// 天干五行对应
export const GAN_WUXING: Record<TianGan, string> = {
  甲:'木', 乙:'木', 丙:'火', 丁:'火', 戊:'土',
  己:'土', 庚:'金', 辛:'金', 壬:'水', 癸:'水',
}

// 地支五行对应
export const ZHI_WUXING: Record<DiZhi, string> = {
  子:'水', 丑:'土', 寅:'木', 卯:'木', 辰:'土', 巳:'火',
  午:'火', 未:'土', 申:'金', 酉:'金', 戌:'土', 亥:'水',
}

/**
 * 根据公历年月日时推算八字
 * 此处使用简化算法（基于天干地支循环规律）
 * 精确版需用节气校正，后续可接入专业库
 */
export function getBaZi(year: number, month: number, day: number, hour: number): BaZi {
  // 年柱
  // 天干：(年 - 4) % 10
  // 地支：(年 - 4) % 12
  const yearGanIdx = ((year - 4) % 10 + 10) % 10
  const yearZhiIdx = ((year - 4) % 12 + 12) % 12

  // 月柱
  // 月干 = (年干序号 % 5) * 2 + 月支序号（简化）
  // 月支：寅月=1月，以此类推，从月=1开始偏移1
  const monthZhiIdx = ((month + 1) % 12)
  const monthGanIdx = ((yearGanIdx % 5) * 2 + monthZhiIdx) % 10

  // 日柱
  // 儒略日公式简化版
  const julianDay = getJulianDay(year, month, day)
  const dayGanIdx = ((julianDay + 49) % 10 + 10) % 10
  const dayZhiIdx = ((julianDay + 11) % 12 + 12) % 12

  // 时柱
  // 时支：子时=23-1时，序号0；以2小时为一个时辰
  const hourZhiIdx = Math.floor(((hour + 1) % 24) / 2)
  const hourGanIdx = ((dayGanIdx % 5) * 2 + hourZhiIdx) % 10

  return {
    yearGan:  TIAN_GAN[yearGanIdx],
    yearZhi:  DI_ZHI[yearZhiIdx],
    monthGan: TIAN_GAN[monthGanIdx],
    monthZhi: DI_ZHI[monthZhiIdx],
    dayGan:   TIAN_GAN[dayGanIdx],
    dayZhi:   DI_ZHI[dayZhiIdx],
    hourGan:  TIAN_GAN[hourGanIdx],
    hourZhi:  DI_ZHI[hourZhiIdx],
  }
}

function getJulianDay(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return day + Math.floor((153 * m + 2) / 5) + 365 * y +
    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045
}

/**
 * 计算五行能量分布
 */
export function getWuXingScore(bazi: BaZi): Record<string, number> {
  const score: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }

  const pillars: Array<[TianGan, DiZhi]> = [
    [bazi.yearGan, bazi.yearZhi],
    [bazi.monthGan, bazi.monthZhi],
    [bazi.dayGan, bazi.dayZhi],
    [bazi.hourGan, bazi.hourZhi],
  ]

  for (const [gan, zhi] of pillars) {
    score[GAN_WUXING[gan]] += 1.5  // 天干权重稍高
    score[ZHI_WUXING[zhi]] += 1
  }

  return score
}
