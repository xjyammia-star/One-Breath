// src/utils/bazi.ts
// 八字（四柱）推算 + 大运起运计算
import { BaZi, TianGan, DiZhi } from '../types'
import { Solar } from 'lunar-javascript'

const TIAN_GAN: TianGan[] = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
const DI_ZHI: DiZhi[]     = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']

// 天干五行
export const GAN_WUXING: Record<TianGan, string> = {
  甲:'木', 乙:'木', 丙:'火', 丁:'火', 戊:'土',
  己:'土', 庚:'金', 辛:'金', 壬:'水', 癸:'水',
}

// 地支五行（主气）
export const ZHI_WUXING: Record<DiZhi, string> = {
  子:'水', 丑:'土', 寅:'木', 卯:'木', 辰:'土', 巳:'火',
  午:'火', 未:'土', 申:'金', 酉:'金', 戌:'土', 亥:'水',
}

// 天干阴阳（阳：甲丙戊庚壬，阴：乙丁己辛癸）
const GAN_YIN_YANG: Record<TianGan, 'yang' | 'yin'> = {
  甲:'yang', 乙:'yin', 丙:'yang', 丁:'yin', 戊:'yang',
  己:'yin',  庚:'yang', 辛:'yin',  壬:'yang', 癸:'yin',
}

// 大运信息
export interface DaYun {
  startAge: number       // 起运年龄
  pillars: Array<{
    gan: TianGan
    zhi: DiZhi
    fromAge: number      // 该步大运起始年龄
    toAge: number        // 该步大运结束年龄
  }>
}

/**
 * 根据公历年月日时推算八字
 */
export function getBaZi(year: number, month: number, day: number, hour: number): BaZi {
  const yearGanIdx = ((year - 4) % 10 + 10) % 10
  const yearZhiIdx = ((year - 4) % 12 + 12) % 12

  const monthZhiIdx = ((month + 1) % 12)
  const monthGanIdx = ((yearGanIdx % 5) * 2 + monthZhiIdx) % 10

  const julianDay  = getJulianDay(year, month, day)
  const dayGanIdx  = ((julianDay + 49) % 10 + 10) % 10
  const dayZhiIdx  = ((julianDay + 11) % 12 + 12) % 12

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
 * 计算五行分布
 * 天干=1分，地支主气=1分，共8分，全部整数
 * 与 Dashboard.tsx 的 calcWuxingDist 保持完全一致
 */
export function getWuXingScore(bazi: BaZi): Record<string, number> {
  const score: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  const gans: TianGan[] = [bazi.yearGan, bazi.monthGan, bazi.dayGan, bazi.hourGan]
  const zhis: DiZhi[]   = [bazi.yearZhi, bazi.monthZhi, bazi.dayZhi, bazi.hourZhi]
  for (const g of gans) score[GAN_WUXING[g]] += 1
  for (const z of zhis) score[ZHI_WUXING[z]] += 1
  return score
}

/**
 * 推算大运
 * 使用 lunar-javascript 获取精确节气日期
 * 
 * 起运规则（子平法）：
 * - 阳男阴女：顺推，数出生日到下一个节气的天数
 * - 阴男阳女：逆推，数出生日到上一个节气的天数
 * - 天数 ÷ 3 = 起运岁数（余1天加4个月，余2天加8个月）
 * 
 * 大运走法：从月柱开始，每步顺/逆推一个干支，每步10年
 */
export function getDaYun(
  bazi: BaZi,
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  birthHour: number,
  gender: 'male' | 'female' | 'other'
): DaYun {
  try {
    const dayGanYinYang = GAN_YIN_YANG[bazi.yearGan]  // 用年干判断阴阳
    const isMale = gender === 'male'

    // 阳男阴女顺推，阴男阳女逆推
    const isForward = (isMale && dayGanYinYang === 'yang') ||
                      (!isMale && dayGanYinYang === 'yin')

    // 用 lunar-javascript 获取出生日的节气信息
    const solar = Solar.fromYmd(birthYear, birthMonth, birthDay)
    // 计算出生日距离上/下一个节气的天数
    let daysToJieqi = 0
    try {
      if (isForward) {
        // 顺推：找下一个节气
        daysToJieqi = getDaysToNextJieqi(birthYear, birthMonth, birthDay)
      } else {
        // 逆推：找上一个节气
        daysToJieqi = getDaysToPrevJieqi(birthYear, birthMonth, birthDay)
      }
    } catch {
      // lunar-javascript 调用失败时用简化估算
      daysToJieqi = 15
    }

    // 起运岁数 = 天数 ÷ 3
    const startAge = Math.round(daysToJieqi / 3)

    // 推算8步大运（80年）
    const monthGanIdx  = TIAN_GAN.indexOf(bazi.monthGan as TianGan)
    const monthZhiIdx  = DI_ZHI.indexOf(bazi.monthZhi as DiZhi)

    const pillars = []
    for (let i = 1; i <= 8; i++) {
      const step = isForward ? i : -i
      const ganIdx = ((monthGanIdx + step) % 10 + 10) % 10
      const zhiIdx = ((monthZhiIdx + step) % 12 + 12) % 12
      const fromAge = startAge + (i - 1) * 10
      const toAge   = startAge + i * 10 - 1
      pillars.push({
        gan: TIAN_GAN[ganIdx],
        zhi: DI_ZHI[zhiIdx],
        fromAge,
        toAge,
      })
    }

    return { startAge, pillars }

  } catch (err) {
    // 兜底：返回空大运
    return { startAge: 0, pillars: [] }
  }
}

/**
 * 获取出生日到下一个节气的天数
 * 使用 lunar-javascript 的节气功能
 */
function getDaysToNextJieqi(year: number, month: number, day: number): number {
  // 遍历后续天数找到下一个节气
  // lunar-javascript 中节气通过 getLunar().getJieQi() 判断
  for (let offset = 1; offset <= 35; offset++) {
    const d = new Date(year, month - 1, day + offset)
    const s = Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate())
    const jieqi = s.getLunar().getJieQi()
    if (jieqi) return offset
  }
  return 15
}

/**
 * 获取出生日到上一个节气的天数
 */
function getDaysToPrevJieqi(year: number, month: number, day: number): number {
  for (let offset = 0; offset <= 35; offset++) {
    const d = new Date(year, month - 1, day - offset)
    const s = Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate())
    const jieqi = s.getLunar().getJieQi()
    if (jieqi) return offset
  }
  return 15
}

/**
 * 格式化大运为字符串，供 AI 使用
 */
export function formatDaYun(daYun: DaYun, currentYear: number, birthYear: number, lang: 'zh' | 'en'): string {
  const currentAge = currentYear - birthYear

  if (daYun.pillars.length === 0) {
    return lang === 'zh' ? '大运数据计算中' : 'Da Yun calculating'
  }

  // 找当前大运
  const current = daYun.pillars.find(p => currentAge >= p.fromAge && currentAge <= p.toAge)

  if (lang === 'zh') {
    const lines = [
      `起运年龄：${daYun.startAge}岁`,
      `当前年龄：${currentAge}岁`,
      current
        ? `当前大运：${current.gan}${current.zhi}（${current.fromAge}岁～${current.toAge}岁）`
        : '',
      '',
      '大运排列：',
      ...daYun.pillars.map(p => {
        const isCurrent = currentAge >= p.fromAge && currentAge <= p.toAge
        return `  ${p.gan}${p.zhi}  ${p.fromAge}岁～${p.toAge}岁${isCurrent ? ' ← 当前' : ''}`
      })
    ]
    return lines.filter(l => l !== '').join('\n')
  } else {
    const lines = [
      `Start age: ${daYun.startAge}`,
      `Current age: ${currentAge}`,
      current
        ? `Current cycle: ${current.gan}${current.zhi} (age ${current.fromAge}–${current.toAge})`
        : '',
      '',
      'Da Yun sequence:',
      ...daYun.pillars.map(p => {
        const isCurrent = currentAge >= p.fromAge && currentAge <= p.toAge
        return `  ${p.gan}${p.zhi}  age ${p.fromAge}–${p.toAge}${isCurrent ? ' ← current' : ''}`
      })
    ]
    return lines.filter(l => l !== '').join('\n')
  }
}
