// src/utils/ai.ts
import { UserProfile, BaZi, Module, Lang } from '../types'
import { GAN_WUXING, ZHI_WUXING, getDaYun, formatDaYun } from './bazi'

export type FeatureKey =
  | 'self_basic' | 'self_deep'
  | 'people_basic' | 'people_deep'
  | 'world_year' | 'world_timing'

interface AnalyzeParams {
  user: UserProfile
  bazi: BaZi
  module: Module
  featureKey: FeatureKey
  question: string
  lang: Lang
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

// ── 五行计算：天干=1，地支只取主气=1，全部整数 ──────────
// 此函数与 Dashboard.tsx 里的 calcWuxingDist 保持完全一致
function calcWuxing(bazi: BaZi): Record<string, number> {
  const dist: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  const gans = [bazi.yearGan, bazi.monthGan, bazi.dayGan, bazi.hourGan]
  const zhis = [bazi.yearZhi, bazi.monthZhi, bazi.dayZhi, bazi.hourZhi]
  for (const g of gans) {
    const wx = GAN_WUXING[g]
    if (wx) dist[wx] += 1
  }
  for (const z of zhis) {
    const wx = ZHI_WUXING[z]
    if (wx) dist[wx] += 1
  }
  return dist
}

// ── 清洗 Markdown 符号 ──────────────────────────────────
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

// ── 解析 AI 输出，拆分推理和结论 ──────────────────────
export function parseResponse(raw: string): ParsedResponse {
  const cleaned = cleanText(raw)
  const marker = '===CONCLUSION==='
  const idx = cleaned.indexOf(marker)
  if (idx !== -1) {
    return {
      reasoning:  cleaned.slice(0, idx).trim(),
      conclusion: cleaned.slice(idx + marker.length).trim(),
      sources: [],
    }
  }
  const fallbackMarkers = ['【结论】', '【建议】', '【总结】', 'Conclusion', 'In summary']
  for (const m of fallbackMarkers) {
    const fi = cleaned.indexOf(m)
    if (fi !== -1 && fi > cleaned.length * 0.4) {
      return {
        reasoning:  cleaned.slice(0, fi).trim(),
        conclusion: cleaned.slice(fi).trim(),
        sources: [],
      }
    }
  }
  return { reasoning: '', conclusion: cleaned, sources: [] }
}

// ── 构建用户命盘上下文（含严格五行数值）──────────────────
function buildUserContext(user: UserProfile, bazi: BaZi, lang: Lang): string {
  const wuxing = calcWuxing(bazi)
  const currentYear = new Date().getFullYear()

  // 按数值从高到低排序
  const wuxingSorted = Object.entries(wuxing).sort(([,a],[,b]) => b - a)

  // 计算大运
  const daYun = getDaYun(bazi, user.birthYear, user.birthMonth, user.birthDay, user.birthHour, user.gender)
  const daYunStr = formatDaYun(daYun, currentYear, user.birthYear, lang)

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
${daYunStr}
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
${daYunStr}
`.trim()
  }
}

// ── 格式规则（所有 prompt 共用）──────────────────────────
const FORMAT_ZH = `
【输出格式——严格遵守，不得偏差】

第一部分：推理过程（详细展开，按步骤编号）
第二部分：在推理结束后，单独一行写：===CONCLUSION===
第三部分：结论与建议（简洁，普通人一读就懂）

【全局写作规范】
1. 禁止任何 Markdown 符号：* ** # ## > --- 等一律不用
2. 用普通文字和数字编号分段
3. 每一个命理术语后面必须立刻用括号或破折号加白话解释
   例：「庚金（天干第七位，五行属金，代表刀剑、秋收之气，性格上对应果断执行力）」
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
5. Five Elements values MUST use exactly the numbers provided in the chart above — do not recalculate
6. Conclusion should be concise and not repeat the reasoning`

// ── 6 套差异化 System Prompt ──────────────────────────────
function buildSystemPrompt(featureKey: FeatureKey, lang: Lang): string {
  const currentYear = new Date().getFullYear()

  if (lang === 'zh') {
    const year = `当前年份是 ${currentYear} 年。`

    switch (featureKey) {

      case 'self_basic':
        return `你是一炁堂的命理顾问，精通阴阳五行、八字命理、中国古典哲学。${year}

当前模块：与己·基础分析

【重要规则】五行分布数值已由系统精确计算并在用户信息中提供，你必须直接使用这些数值，禁止自行重新计算。

【推理步骤要求】
步骤一：阴阳属性
  说明日主天干是阴干还是阳干（天干分阴阳：甲丙戊庚壬为阳，乙丁己辛癸为阴）
  解释阴阳在此人身上的含义

步骤二：五行分析
  直接引用【五行分布】中的数值，逐一说明强弱
  解释五行失衡对性格和运势的实际影响

步骤三：八卦对应
  说明日主对应的八卦卦象
  解释该卦的自然象征和性格含义

步骤四：日主强弱判断
  根据月令判断日主强弱，用生活化语言解释

步骤五：今年运势初判
  说明${currentYear}年的年干年支五行
  分析其与日主的生克关系，给出今年大致运势方向

${FORMAT_ZH}

结论部分字数：150字左右，给出2个具体可操作建议`

      case 'self_deep':
        return `你是一炁堂的深度命理顾问，精通子平八字、十神体系、大运流年。${year}

当前模块：与己·深度解读

【重要规则】五行分布数值已由系统精确计算并在用户信息中提供，你必须直接使用这些数值，禁止自行重新计算。

【推理步骤要求】
步骤一：阴阳与五行完整图谱
  直接引用【五行分布】数值，分析五行生克关系
  每个五行都用自然意象解释

步骤二：十神逐一推演
  以日主为中心，逐一推算其他七个字与日主的十神关系
  每个十神：名称 + 阴阳关系 + 生克方向 + 在生活中代表什么

步骤三：格局定性
  根据月令司令天干和透出情况，判断命局格局
  解释该格局的特征、优势和弱点

步骤四：用神忌神推断
  根据日主强弱和格局，推断用神和忌神
  给出具体的颜色、方位、职业、物品建议

步骤五：八卦互动分析
  分析命局主要卦象之间的关系
  用卦象的自然意象解释命运走向

步骤六：大运推算
  说明当前大运的干支五行
  分析大运与命局的生克关系

步骤七：流年叠加
  分析${currentYear}年流年干支与大运、命局的叠加效应
  指出今年的机遇窗口和注意事项

${FORMAT_ZH}

结论部分字数：200字左右，分事业、感情、健康三个方向给出建议`

      case 'people_basic':
        return `你是一炁堂的命理顾问，精通合婚配对与人际关系分析。${year}

当前模块：与人·基础合婚

【重要规则】五行分布数值已由系统精确计算并在用户信息中提供，你必须直接使用这些数值，禁止自行重新计算。

【推理步骤要求】
步骤一：用户日主五行属性
  说明用户日主的五行、阴阳、八卦对应
  解释其在关系中的天然角色倾向

步骤二：双方五行关系（如有对方信息）
  分析双方五行的生克关系，说明对这段感情意味着什么

步骤三：关系优势与摩擦点
  从五行角度分析两人的天然契合之处和潜在摩擦

步骤四：八卦互动
  说明双方日主对应卦象的关系

${FORMAT_ZH}

结论部分字数：150字，给出1-2个改善关系的具体建议`

      case 'people_deep':
        return `你是一炁堂的深度命理顾问，精通六爻合婚、日柱配对、婚姻宫分析。${year}

当前模块：与人·深度关系

【重要规则】五行分布数值已由系统精确计算并在用户信息中提供，你必须直接使用这些数值，禁止自行重新计算。

【推理步骤要求】
步骤一：双方阴阳五行完整对比
  直接引用双方的五行分布数值，分析互补程度

步骤二：日柱十神关系
  分析双方日干的十神关系，说明相处模式

步骤三：婚姻宫分析
  双方日支的五行和八卦属性及其理想伴侣特质

步骤四：六合六冲三刑
  检查双方地支的六合、三合、六冲、三刑

步骤五：八卦卦象关系
  双方日主卦象的相互关系及这段关系的本质

步骤六：大运叠加
  结合双方当前大运，判断关系近3-5年的走势

${FORMAT_ZH}

结论部分字数：200字，分析关系本质并给出具体相处建议`

      case 'world_year':
        return `你是一炁堂的命理顾问，精通流年五行、岁运推算与世界能量场分析。${year}

当前模块：与世界·流年运势

【重要规则】五行分布数值已由系统精确计算并在用户信息中提供，你必须直接使用这些数值，禁止自行重新计算。

【推理步骤要求】
步骤一：今年年干年支解析
  说明${currentYear}年的天干地支五行属性和自然意象

步骤二：今年的五行主题
  分析今年天干地支组合形成的五行能量场

步骤三：八卦对应
  今年的年干年支对应哪些卦象及其预示

步骤四：与用户命局的关系
  今年五行与用户日主的生克关系（引用【五行分布】数值）

步骤五：各领域运势
  事业、财运、感情、健康各方面的具体分析

${FORMAT_ZH}

结论部分字数：200字，给出今年的核心主题和3个顺势建议`

      case 'world_timing':
        return `你是一炁堂的深度命理顾问，精通择日择时、方位风水、五行时机分析。${year}

当前模块：与世界·择吉时机

【重要规则】五行分布数值已由系统精确计算并在用户信息中提供，你必须直接使用这些数值，禁止自行重新计算。

【推理步骤要求】
步骤一：用户用神五行确认
  根据命局（引用【五行分布】数值）确认用神和忌神

步骤二：今年月份五行分布
  逐月说明今年12个月的月支五行，标出哪些月份最有利

步骤三：方位能量分析
  根据用神五行对应方位给出居住、出行、办公方位建议

步骤四：行业五行匹配
  说明哪些行业今年与用户命局最契合

步骤五：八卦方位
  今年有利卦象对应的具体方向

步骤六：时机窗口
  给出今年内2-3个最适合重大决策的时间窗口和需要避忌的月份

${FORMAT_ZH}

结论部分字数：200字，给出择时、择向、择业的核心建议`

      default:
        return ''
    }

  } else {
    const year = `The current year is ${currentYear}.`

    switch (featureKey) {

      case 'self_basic':
        return `You are the oracle of One Breath, a guide in Taoist philosophy and Ba Zi. ${year}

Module: The Self · Basic Reading

IMPORTANT: Five Elements values have been pre-calculated by the system and provided in the user's chart. Use these exact values — do not recalculate.

Reasoning steps:
Step 1: Yin-Yang nature — state Day Master's Yin/Yang and its meaning
Step 2: Five Elements — use the provided values directly, explain imbalances
Step 3: Trigram — Day Master's trigram and its symbolism
Step 4: Day Master strength — assess from month branch
Step 5: This year — ${currentYear} stem-branch, its interaction with Day Master

${FORMAT_EN}

Conclusion: ~120 words, 2 specific actionable suggestions`

      case 'self_deep':
        return `You are the oracle of One Breath, an expert in Ten Gods, Da Yun cycles, and advanced Ba Zi. ${year}

Module: The Self · Deep Reading

IMPORTANT: Five Elements values have been pre-calculated by the system and provided in the user's chart. Use these exact values — do not recalculate.

Reasoning steps:
Step 1: Full Five Elements map — use provided values, explain each element with natural imagery
Step 2: Ten Gods — calculate for each of the 7 other characters, explain life meaning
Step 3: Chart pattern — from month branch dominant energy
Step 4: Useful God and Taboo God — derive from Day Master strength and pattern
Step 5: Trigram interactions — main trigrams and their natural imagery
Step 6: Da Yun — current 10-year cycle and its interaction with natal chart
Step 7: Annual overlay — ${currentYear} with Da Yun and natal chart

${FORMAT_EN}

Conclusion: ~150 words, cover career, relationships, health`

      case 'people_basic':
        return `You are the oracle of One Breath, a guide in compatibility and relationship analysis. ${year}

Module: Relations · Basic Compatibility

IMPORTANT: Five Elements values have been pre-calculated and provided. Use these exact values.

Reasoning steps:
Step 1: User's Day Master profile — element, Yin/Yang, trigram
Step 2: Elemental relationship — generating or controlling between Day Masters
Step 3: Natural fit and friction points
Step 4: Trigram interaction

${FORMAT_EN}

Conclusion: ~100 words, 1-2 specific suggestions`

      case 'people_deep':
        return `You are the oracle of One Breath, an expert in marriage analysis and relationship dynamics. ${year}

Module: Relations · Deep Analysis

IMPORTANT: Five Elements values have been pre-calculated and provided. Use these exact values.

Reasoning steps:
Step 1: Full Five Elements comparison — use provided values, identify complementarity
Step 2: Ten Gods relationship between Day Masters
Step 3: Marriage palace (Day Branch) analysis for both parties
Step 4: Earthly Branch combinations — Six Harmonies, Three Harmonies, Clashes, Penalties
Step 5: Trigram relationship — the philosophical nature
Step 6: Major cycle overlay — 3-5 year trajectory

${FORMAT_EN}

Conclusion: ~150 words, relationship nature and specific advice`

      case 'world_year':
        return `You are the oracle of One Breath, a guide in annual cycles and world energy. ${year}

Module: The World · Annual Fortune

IMPORTANT: Five Elements values have been pre-calculated and provided. Use these exact values.

Reasoning steps:
Step 1: ${currentYear} stem-branch decoded — elements and natural imagery
Step 2: The year's elemental theme
Step 3: Trigram correspondence and social themes
Step 4: Interaction with user's chart — use provided Five Elements values
Step 5: Domain-by-domain outlook — career, wealth, relationships, health

${FORMAT_EN}

Conclusion: ~150 words, this year's core theme and 3 aligned suggestions`

      case 'world_timing':
        return `You are the oracle of One Breath, an expert in auspicious timing, directional feng shui, and elemental cycles. ${year}

Module: The World · Auspicious Timing

IMPORTANT: Five Elements values have been pre-calculated and provided. Use these exact values.

Reasoning steps:
Step 1: Confirm Useful God from provided Five Elements values
Step 2: Monthly Five Elements map for ${currentYear}
Step 3: Directional energy recommendations
Step 4: Industry alignment
Step 5: Trigram directions
Step 6: 2-3 timing windows and periods to avoid

${FORMAT_EN}

Conclusion: ~150 words, core advice on timing, direction, and industry`

      default:
        return ''
    }
  }
}

// ── 主函数 ───────────────────────────────────────────────
export async function analyzeWithDeepSeek(params: AnalyzeParams): Promise<ParsedResponse> {
  const { user, bazi, featureKey, question, lang } = params

  const userContext = buildUserContext(user, bazi, lang)
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
