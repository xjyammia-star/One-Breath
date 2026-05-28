// src/types/lunar-javascript.d.ts
// lunar-javascript 的类型声明文件

declare module 'lunar-javascript' {
  class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    getLunar(): Lunar
  }

  class Lunar {
    getYear(): number
    getMonth(): number   // 闰月为负数
    getDay(): number
    getPrevJieQi(): JieQi | null
  }

  class JieQi {
    getName(): string
  }

  export { Solar, Lunar, JieQi }
}
