// src/types.ts

export interface UserProfile {
  name: string
  gender: 'male' | 'female' | 'other'
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number   // 0-23
  birthPlace: string
  lunarDate?: string  // 农历，由公历转换
  createdAt: string
}

export type Lang = 'zh' | 'en'

export type Module = 'self' | 'people' | 'world'

export interface AnalysisResult {
  module: Module
  query: string
  response: string
  timestamp: string
  tags?: string[]
}

// 五行
export type WuXing = '木' | '火' | '土' | '金' | '水'

// 八卦
export type Bagua = '乾' | '坤' | '震' | '巽' | '坎' | '离' | '艮' | '兑'

// 天干
export type TianGan = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸'

// 地支
export type DiZhi = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥'

export interface BaZi {
  yearGan: TianGan
  yearZhi: DiZhi
  monthGan: TianGan
  monthZhi: DiZhi
  dayGan: TianGan
  dayZhi: DiZhi
  hourGan: TianGan
  hourZhi: DiZhi
}
