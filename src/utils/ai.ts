// src/utils/ai.ts
import { UserProfile, BaZi, Module, Lang } from '../types'
import { GAN_WUXING, ZHI_WUXING, getDaYun, formatDaYun, getBaZi } from './bazi'

export type FeatureKey =
  | 'self_basic' | 'self_deep'
  | 'people_basic' | 'people_deep'
  | 'world_year' | 'world_timing' | 'world_fengshui'
  | 'palm_reading' | 'fengshui_photo'

// 对方信息（合盘用）
export interface PartnerProfile {
  name: string
  gender: 'male' | 'female' | 'other'
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number
}

interface AnalyzeParams {
  user: UserProfile
  bazi: BaZi
  module: Module
  featureKey: FeatureKey
  question: string
  lang: Lang
  partner?: PartnerProfile   // 合盘时传入
}

export interface CorpusSource {
  title: string
  excerpt: string
}

export interface ParsedResponse {
  reasoning: string
  conclusion: string
  sources: CorpusSource[]
}

export class ApiError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

function calcWuxing(bazi: BaZi): Record<string, number> {
  const dist: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  const gans = [bazi.yearGan, bazi.monthGan, bazi.dayGan, bazi.hourGan]
  const zhis = [bazi.yearZhi, bazi.monthZhi, bazi.dayZhi, bazi.hourZhi]
  for (const g of gans) { const wx = GAN_WUXING[g]; if (wx) dist[wx] += 1 }
  for (const z of zhis) { const wx = ZHI_WUXING[z]; if (wx) dist[wx] += 1 }
  return dist
}

function cleanText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[\*\-\+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/^[-\*]{3,}\s*$/gm, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^第[一二三四五六七八九十\d]+部分[：:]\s*.{0,20}\n?/gm, '')
    .replace(/^Part\s+\d+[：:]\s*.{0,30}\n?/gim, '')
    .replace(/^(推理过程|结论与建议|结论|建议|Reasoning|Conclusion)[：:：]?\s*\n/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function parseResponse(raw: string): ParsedResponse {
  const cleaned = cleanText(raw)
  const marker = '===CONCLUSION==='
  const idx = cleaned.indexOf(marker)
  if (idx !== -1) {
    return { reasoning: cleaned.slice(0, idx).trim(), conclusion: cleaned.slice(idx + marker.length).trim(), sources: [] }
  }
  const fallbackMarkers = ['【结论】', '【建议】', '【总结】', 'Conclusion', 'In summary']
  for (const m of fallbackMarkers) {
    const fi = cleaned.indexOf(m)
    if (fi !== -1 && fi > cleaned.length * 0.4) {
      return { reasoning: cleaned.slice(0, fi).trim(), conclusion: cleaned.slice(fi).trim(), sources: [] }
    }
  }
  return { reasoning: '', conclusion: cleaned, sources: [] }
}

export function buildUserContext(user: UserProfile, bazi: BaZi, lang: Lang, partner?: PartnerProfile): string {
  const wuxing = calcWuxing(bazi)
  const currentYear = new Date().getFullYear()
  const wuxingSorted = Object.entries(wuxing).sort(([,a],[,b]) => b - a)
  const daYun = getDaYun(bazi, user.birthYear, user.birthMonth, user.birthDay, user.birthHour, user.gender)
  const daYunStr = formatDaYun(daYun, currentYear, user.birthYear, lang)

  // 对方信息（合盘）
  let partnerCtx = ''
  if (partner) {
    const pb = getBaZi(partner.birthYear, partner.birthMonth, partner.birthDay, partner.birthHour)
    const pw = calcWuxing(pb)
    const pwSorted = Object.entries(pw).sort(([,a],[,b]) => b - a)
    if (lang === 'zh') {
      const pwLines = pwSorted.map(([k, v]) => `  ${k}：${v} 个`).join('\n')
      partnerCtx = `

【对方命盘信息——合盘分析用】
姓名：${partner.name || '对方'}
性别：${partner.gender === 'male' ? '男' : partner.gender === 'female' ? '女' : '其他'}
出生：${partner.birthYear}年${partner.birthMonth}月${partner.birthDay}日 ${partner.birthHour}时

对方四柱：
年柱：${pb.yearGan}${pb.yearZhi}（${GAN_WUXING[pb.yearGan]}${ZHI_WUXING[pb.yearZhi]}）
月柱：${pb.monthGan}${pb.monthZhi}（${GAN_WUXING[pb.monthGan]}${ZHI_WUXING[pb.monthZhi]}）
日柱：${pb.dayGan}${pb.dayZhi}（${GAN_WUXING[pb.dayGan]}${ZHI_WUXING[pb.dayZhi]}） ← 对方日主
时柱：${pb.hourGan}${pb.hourZhi}（${GAN_WUXING[pb.hourGan]}${ZHI_WUXING[pb.hourZhi]}）

对方五行分布——系统精确计算，禁止重新计算：
${pwLines}`
    } else {
      const enNames: Record<string,string> = {木:'Wood',火:'Fire',土:'Earth',金:'Metal',水:'Water'}
      const pwLinesEn = pwSorted.map(([k, v]) => `  ${enNames[k]}: ${v}`).join('\n')
      partnerCtx = `

【Partner's Chart — for compatibility analysis】
Name: ${partner.name || 'Partner'}
Gender: ${partner.gender}
Born: ${partner.birthYear}/${partner.birthMonth}/${partner.birthDay} ${partner.birthHour}:00

Partner's Four Pillars:
Year: ${pb.yearGan}${pb.yearZhi} (${GAN_WUXING[pb.yearGan]}-${ZHI_WUXING[pb.yearZhi]})
Month: ${pb.monthGan}${pb.monthZhi} (${GAN_WUXING[pb.monthGan]}-${ZHI_WUXING[pb.monthZhi]})
Day: ${pb.dayGan}${pb.dayZhi} (${GAN_WUXING[pb.dayGan]}-${ZHI_WUXING[pb.dayZhi]}) ← Partner's Day Master
Hour: ${pb.hourGan}${pb.hourZhi} (${GAN_WUXING[pb.hourGan]}-${ZHI_WUXING[pb.hourZhi]})

Partner's Five Elements — pre-calculated, do not recalculate:
${pwLinesEn}`
    }
  }

  if (lang === 'zh') {
    const wuxingLines = wuxingSorted.map(([k, v]) => `  ${k}：${v} 个`).join('\n')
    return `
【用户命盘信息】
姓名：${user.name}
性别：${user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : '其他'}
出生：${user.birthYear}年${user.birthMonth}月${user.birthDay}日 ${user.birthHour}时
农历：${user.lunarDate || '计算中'}
出生地：${user.birthPlace}
当前年份：${currentYear}年

【八字四柱】
年柱：${bazi.yearGan}${bazi.yearZhi}（天干${bazi.yearGan}属${GAN_WUXING[bazi.yearGan]}，地支${bazi.yearZhi}属${ZHI_WUXING[bazi.yearZhi]}）
月柱：${bazi.monthGan}${bazi.monthZhi}（天干${bazi.monthGan}属${GAN_WUXING[bazi.monthGan]}，地支${bazi.monthZhi}属${ZHI_WUXING[bazi.monthZhi]}）
日柱：${bazi.dayGan}${bazi.dayZhi}（天干${bazi.dayGan}属${GAN_WUXING[bazi.dayGan]}，地支${bazi.dayZhi}属${ZHI_WUXING[bazi.dayZhi]}） ← 日主
时柱：${bazi.hourGan}${bazi.hourZhi}（天干${bazi.hourGan}属${GAN_WUXING[bazi.hourGan]}，地支${bazi.hourZhi}属${ZHI_WUXING[bazi.hourZhi]}）

【五行分布——系统已精确计算，严格以此为准，禁止重新计算】
计算规则：天干每字=1分，地支按主气=1分，共8字合计8分
${wuxingLines}

【大运排盘——系统已精确计算，严格以此为准，禁止重新计算】
${daYunStr}${partnerCtx}
`.trim()
  } else {
    const enNames: Record<string,string> = {木:'Wood',火:'Fire',土:'Earth',金:'Metal',水:'Water'}
    const wuxingLinesEn = wuxingSorted.map(([k, v]) => `  ${enNames[k]}: ${v}`).join('\n')
    return `
【User's Ba Zi Chart】
Name: ${user.name}
Gender: ${user.gender}
Born: ${user.birthYear}/${user.birthMonth}/${user.birthDay} ${user.birthHour}:00
Lunar: ${user.lunarDate || 'calculating'}
Birth place: ${user.birthPlace}
Current year: ${currentYear}

【Four Pillars】
Year: ${bazi.yearGan}${bazi.yearZhi} (${bazi.yearGan}=${GAN_WUXING[bazi.yearGan]}, ${bazi.yearZhi}=${ZHI_WUXING[bazi.yearZhi]})
Month: ${bazi.monthGan}${bazi.monthZhi} (${bazi.monthGan}=${GAN_WUXING[bazi.monthGan]}, ${bazi.monthZhi}=${ZHI_WUXING[bazi.monthZhi]})
Day: ${bazi.dayGan}${bazi.dayZhi} (${bazi.dayGan}=${GAN_WUXING[bazi.dayGan]}, ${bazi.dayZhi}=${ZHI_WUXING[bazi.dayZhi]}) ← Day Master
Hour: ${bazi.hourGan}${bazi.hourZhi} (${bazi.hourGan}=${GAN_WUXING[bazi.hourGan]}, ${bazi.hourZhi}=${ZHI_WUXING[bazi.hourZhi]})

【Five Elements — pre-calculated, use EXACTLY these values, DO NOT recalculate】
Rule: each Heavenly Stem = 1 point, each Earthly Branch main qi = 1 point, total 8 points
${wuxingLinesEn}

【Da Yun — pre-calculated, use EXACTLY these values, DO NOT recalculate】
${daYunStr}${partnerCtx}
`.trim()
  }
}

const FORMAT_ZH = `
【输出格式——严格遵守，不得偏差】

第一部分：推理过程（详细展开，按步骤编号）
第二部分：在推理结束后，单独一行写：===CONCLUSION===
第三部分：结论与建议（简洁，普通人一读就懂）

【全局写作规范】
1. 禁止任何 Markdown 符号：* ** # ## > --- 等一律不用
2. 用普通文字和数字编号分段
3. 每一个命理术语后面必须立刻用括号或破折号加白话解释
4. 每个推理步骤要说明「是什么 → 对应什么 → 意味着什么」的完整链条
5. 五行数值必须严格使用【五行分布】里提供的数字，禁止自行重新计算或修改
6. 结论部分简洁有力，不重复推理内容`

const FORMAT_EN = `
【Output format — strictly follow】

Part 1: Reasoning (detailed, numbered steps)
Part 2: On its own line, write exactly: ===CONCLUSION===
Part 3: Conclusion & suggestions (concise, accessible)

【Writing rules】
1. No Markdown symbols — no * ** # ## > --- etc.
2. Use plain text and numbered steps
3. Every technical term must be immediately explained in plain language
4. Each reasoning step must follow: what it is → what it corresponds to → what it means
5. Five Elements values MUST use exactly the numbers provided — do not recalculate
6. Conclusion should be concise and not repeat the reasoning`

function buildSystemPrompt(featureKey: FeatureKey, lang: Lang): string {
  const currentYear = new Date().getFullYear()

  if (lang === 'zh') {
    const year = `当前年份是 ${currentYear} 年。`

    switch (featureKey) {
      case 'self_basic':
        return `你是一炁堂的命理顾问，精通阴阳五行、八字命理、中国古典哲学。${year}
当前模块：与己·基础分析
【重要规则】五行分布数值已由系统精确计算，必须直接使用，禁止重新计算。
【推理步骤要求】
步骤一：阴阳属性——说明日主天干阴阳，解释其在此人身上的含义
步骤二：五行分析——直接引用【五行分布】数值，说明强弱及对性格运势的影响
步骤三：八卦对应——说明日主对应卦象及其自然象征
步骤四：日主强弱——根据月令判断，生活化语言解释
步骤五：今年运势——${currentYear}年干支五行与日主生克关系
${FORMAT_ZH}
结论：150字，给出2个具体可操作建议`

      case 'self_deep':
        return `你是一炁堂的深度命理顾问，精通子平八字、十神体系、大运流年。${year}
当前模块：与己·深度解读
【重要规则】五行分布数值已由系统精确计算，必须直接使用，禁止重新计算。
【推理步骤要求】
步骤一：阴阳五行图谱——引用数值，分析生克，每行用自然意象解释
步骤二：十神逐一推演——七字与日主的十神关系，每个含：名称+阴阳+生克+生活含义
步骤三：格局定性——月令司令天干，判断命局格局，说明优劣
步骤四：用神忌神——推断用神忌神，给出颜色/方位/职业/物品建议
步骤五：八卦互动——主要卦象关系，用自然意象解释命运走向
步骤六：大运推算——当前大运干支五行与命局生克
步骤七：流年叠加——${currentYear}年与大运、命局叠加效应，指出机遇与注意事项
${FORMAT_ZH}
结论：200字，分事业/感情/健康三方向给出建议`

      case 'people_basic':
        return `你是一炁堂的命理顾问，精通合婚配对与人际关系分析。${year}
当前模块：与人·基础合婚
【重要规则】双方五行数值均已由系统精确计算，必须直接使用，禁止重新计算。
【推理步骤要求】
步骤一：用户日主五行——阴阳、八卦对应，在关系中的天然角色倾向
步骤二：双方五行生克——分析生（滋养）克（约束）比和（共鸣）关系，说明对感情的意义
步骤三：日主十神关系——两人日干的十神关系，说明相处模式
步骤四：关系优势与摩擦——天然契合点和潜在张力
步骤五：八卦互动——双方日主卦象关系（如乾坤相合、水火既济等）
${FORMAT_ZH}
结论：150字，给出1-2个改善关系的具体建议`

      case 'people_deep':
        return `你是一炁堂的深度命理顾问，精通六爻合婚、日柱配对、婚姻宫分析。${year}
当前模块：与人·深度关系
【重要规则】双方五行数值均已由系统精确计算，必须直接使用，禁止重新计算。
【推理步骤要求】
步骤一：双方五行完整对比——引用双方数值，分析互补程度
步骤二：日柱十神关系——双方日干十神，说明相处动态
步骤三：婚姻宫分析——双方日支五行和八卦，理想伴侣特质
步骤四：六合六冲三刑——地支组合，用生活化语言说明影响
步骤五：八卦卦象关系——双方卦象的哲学本质，用自然意象描述
步骤六：大运叠加——双方当前大运，判断关系3-5年走势
${FORMAT_ZH}
结论：200字，分析关系本质，给出具体相处建议`

      case 'world_year':
        return `你是一炁堂的命理顾问，精通流年五行、岁运推算与世界能量场分析。${year}
当前模块：与世界·流年运势
【重要规则】五行分布数值已由系统精确计算，必须直接使用，禁止重新计算。
【推理步骤要求】
步骤一：${currentYear}年干支解析——天干地支五行属性和自然意象
步骤二：今年五行主题——天干地支组合形成的能量场
步骤三：八卦对应——年干支对应卦象及社会趋势预示
步骤四：与命局关系——引用【五行分布】分析今年与日主的生克
步骤五：各领域运势——事业/财运/感情/健康具体分析
${FORMAT_ZH}
结论：200字，给出今年核心主题和3个顺势建议`

      case 'world_timing':
        return `你是一炁堂的深度命理顾问，精通择日择时、方位风水、五行时机分析。${year}
当前模块：与世界·择吉时机
【重要规则】五行分布数值已由系统精确计算，必须直接使用，禁止重新计算。
【推理步骤要求】
步骤一：用神忌神确认——引用【五行分布】数值推断用神和忌神
步骤二：今年月份五行——12个月月支五行，标出最有利月份
步骤三：方位能量——用神五行对应方位，给出居住/出行/办公建议
步骤四：行业匹配——五行对应行业，说明最契合的方向
步骤五：八卦方位——今年有利卦象对应方向及原因
步骤六：时机窗口——2-3个最佳决策时间窗口，及需避忌的月份
${FORMAT_ZH}
结论：200字，给出择时/择向/择业核心建议`

      case 'world_fengshui':
        return `你是一炁堂的风水顾问，精通五行风水、方位能量、居家环境调理。${year}
当前模块：与世界·居家风水

【重要规则】五行分布数值已由系统精确计算，必须直接使用，禁止重新计算。

参考典籍：钦定协纪辨方书（方位、时令宜忌）、易经（卦象方位）

【推理步骤要求】
步骤一：命局五行诊断
  引用【五行分布】数值，找出最旺、最弱的五行
  说明五行失衡对居住环境的潜在影响

步骤二：用神方位推算
  根据命局用神（最需要补充的五行）对应方位：
  木=东方、火=南方、土=中央/西南/东北、金=西方/西北、水=北方
  说明这些方位对此人的重要性

步骤三：居家布局建议
  主卧朝向：哪个方向对命主最有利
  书房/工作区：有利于事业的方位
  财位：根据命局推算财星方位
  厨房/火位：火与命局的关系

步骤四：颜色与材质
  根据用神五行推荐有利颜色：
  木=绿色/青色、火=红色/紫色、土=黄色/米色、金=白色/金色、水=黑色/蓝色
  忌用颜色（克用神的五行对应颜色）
  材质建议（木质、金属、陶瓷等）

步骤五：植物与物品
  有利植物（根据五行属性）
  推荐摆件（水晶、铜器、木雕等）
  需要避开的物品

步骤六：今年特别注意
  结合${currentYear}年干支，说明今年居家风水的特别提示

${FORMAT_ZH}
结论：200字，分主卧/工作区/整体氛围三个方向给出具体可操作建议`

      default:
        return ''
    }

  } else {
    const year = `The current year is ${currentYear}.`

    switch (featureKey) {
      case 'self_basic':
        return `You are the oracle of One Breath, a guide in Taoist philosophy and Ba Zi. ${year}
Module: The Self · Basic Reading
IMPORTANT: Five Elements values are pre-calculated. Use these exact values — do not recalculate.
Steps: 1) Yin-Yang of Day Master  2) Five Elements using provided values  3) Trigram symbolism  4) Day Master strength  5) ${currentYear} outlook
${FORMAT_EN}
Conclusion: ~120 words, 2 actionable suggestions`

      case 'self_deep':
        return `You are the oracle of One Breath, expert in Ten Gods, Da Yun, advanced Ba Zi. ${year}
Module: The Self · Deep Reading
IMPORTANT: Five Elements values are pre-calculated. Use these exact values — do not recalculate.
Steps: 1) Full Five Elements map  2) Ten Gods one by one  3) Chart pattern  4) Useful/Taboo God  5) Trigram interactions  6) Da Yun  7) ${currentYear} overlay
${FORMAT_EN}
Conclusion: ~150 words, cover career/relationships/health`

      case 'people_basic':
        return `You are the oracle of One Breath, guide in compatibility and relationships. ${year}
Module: Relations · Basic Compatibility
IMPORTANT: Both parties' Five Elements values are pre-calculated. Use these exact values.
Steps: 1) User's Day Master profile  2) Elemental generating/controlling between Day Masters  3) Ten Gods relationship  4) Natural fit and friction  5) Trigram interaction
${FORMAT_EN}
Conclusion: ~100 words, 1-2 specific suggestions`

      case 'people_deep':
        return `You are the oracle of One Breath, expert in marriage analysis and relationship dynamics. ${year}
Module: Relations · Deep Analysis
IMPORTANT: Both parties' Five Elements values are pre-calculated. Use these exact values.
Steps: 1) Full Five Elements comparison  2) Ten Gods between Day Masters  3) Marriage palace analysis  4) Branch combinations (harmonies/clashes)  5) Trigram philosophical nature  6) Da Yun overlay 3-5 years
${FORMAT_EN}
Conclusion: ~150 words, relationship nature and specific advice`

      case 'world_year':
        return `You are the oracle of One Breath, guide in annual cycles and world energy. ${year}
Module: The World · Annual Fortune
IMPORTANT: Five Elements values are pre-calculated. Use these exact values.
Steps: 1) ${currentYear} stem-branch decoded  2) Year's elemental theme  3) Trigram/social themes  4) Interaction with user's chart  5) Domain outlook: career/wealth/relationships/health
${FORMAT_EN}
Conclusion: ~150 words, core theme and 3 aligned suggestions`

      case 'world_timing':
        return `You are the oracle of One Breath, expert in auspicious timing and feng shui. ${year}
Module: The World · Auspicious Timing
IMPORTANT: Five Elements values are pre-calculated. Use these exact values.
Steps: 1) Useful God confirmation  2) Monthly map for ${currentYear}  3) Directional energy  4) Industry alignment  5) Trigram directions  6) 2-3 timing windows
${FORMAT_EN}
Conclusion: ~150 words, timing/direction/industry advice`

      case 'world_fengshui':
        return `You are the oracle of One Breath, a Feng Shui guide rooted in Five Elements and classical Chinese wisdom. ${year}
Module: The World · Home Feng Shui

IMPORTANT: Five Elements values are pre-calculated. Use these exact values — do not recalculate.

Reference texts: Qin Ding Xie Ji Bian Fang Shu (auspicious directions), I Ching (trigram directions)

Steps:
Step 1: Five Elements diagnosis — use provided values, identify dominant and deficient elements, explain their effect on living environment
Step 2: Useful God directions — map the needed element to compass direction (Wood=East, Fire=South, Earth=Center/SW/NE, Metal=West/NW, Water=North), explain why these directions matter
Step 3: Home layout — master bedroom orientation, workspace direction, wealth corner, kitchen/fire placement
Step 4: Colors and materials — favorable colors (Wood=green, Fire=red/purple, Earth=yellow/beige, Metal=white/gold, Water=black/blue), avoid colors that clash with Useful God, material recommendations
Step 5: Plants and objects — favorable plants, recommended crystals/items, things to avoid
Step 6: This year's special notes — ${currentYear} stem-branch specific feng shui considerations

${FORMAT_EN}
Conclusion: ~150 words, specific actionable advice for bedroom/workspace/overall atmosphere`

      default:
        return ''
    }
  }
}

export async function analyzeWithDeepSeek(params: AnalyzeParams): Promise<ParsedResponse> {
  const { user, bazi, featureKey, question, lang, partner } = params

  const userContext = buildUserContext(user, bazi, lang, partner)
  const systemPrompt = buildSystemPrompt(featureKey, lang)

  const userMessage = lang === 'zh'
    ? `${userContext}\n\n【问题】${question}`
    : `${userContext}\n\n【Question】${question}`

  const token = localStorage.getItem('yiqitang_token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      featureKey,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new ApiError(
      err.error || `API error: ${response.status}`,
      err.code || (response.status === 401 ? 'LOGIN_REQUIRED' : 'UNKNOWN')
    )
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content
    || (lang === 'zh' ? '天机难测，请稍后再试。' : 'The oracle is silent. Please try again.')

  const parsed = parseResponse(raw)
  parsed.sources = data.sources || []
  return parsed
}

// ── 视觉分析（手相 / 风水照片）──────────────────────────
export type VisionFeatureKey = 'palm_reading' | 'fengshui_photo'

export interface VisionAnalyzeParams {
  imageBase64: string
  imageType: string
  featureKey: VisionFeatureKey
  user: UserProfile
  bazi: BaZi
  lang: Lang
}

export async function analyzeWithVision(params: VisionAnalyzeParams): Promise<ParsedResponse> {
  const { imageBase64, imageType, featureKey, user, bazi, lang } = params

  // 复用 buildUserContext 传入命盘信息
  const userContext = buildUserContext(user, bazi, lang)

  const token = localStorage.getItem('yiqitang_token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch('/api/fengshui-vision', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imageBase64,
      imageType,
      featureKey,
      userContext,
      lang,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new ApiError(
      err.error || `API error: ${response.status}`,
      err.code || (response.status === 401 ? 'LOGIN_REQUIRED' : 'UNKNOWN')
    )
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content
    || (lang === 'zh' ? '天机难测，请稍后再试。' : 'The oracle is silent. Please try again.')

  const parsed = parseResponse(raw)
  parsed.sources = []
  return parsed
}
