// src/utils/ai.ts
import { UserProfile, BaZi, Module, Lang } from '../types'
import { GAN_WUXING, ZHI_WUXING, getWuXingScore } from './bazi'

interface AnalyzeParams {
  user: UserProfile
  bazi: BaZi
  module: Module
  question: string
  lang: Lang
}

function buildUserContext(user: UserProfile, bazi: BaZi, lang: Lang): string {
  const wuxing = getWuXingScore(bazi)
  const wuxingStr = Object.entries(wuxing)
    .sort(([,a],[,b]) => b - a)
    .map(([k, v]) => `${k}(${v.toFixed(1)})`)
    .join(' ')

  const currentYear = new Date().getFullYear()

  if (lang === 'zh') {
    return `
【用户命盘信息】
姓名：${user.name}
性别：${user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : '其他'}
出生：${user.birthYear}年${user.birthMonth}月${user.birthDay}日 ${user.birthHour}时
农历：${user.lunarDate || '计算中'}
出生地：${user.birthPlace}
当前年份：${currentYear}年

【八字四柱】
年柱：${bazi.yearGan}${bazi.yearZhi}（${GAN_WUXING[bazi.yearGan]}${ZHI_WUXING[bazi.yearZhi]}）
月柱：${bazi.monthGan}${bazi.monthZhi}（${GAN_WUXING[bazi.monthGan]}${ZHI_WUXING[bazi.monthZhi]}）
日柱：${bazi.dayGan}${bazi.dayZhi}（${GAN_WUXING[bazi.dayGan]}${ZHI_WUXING[bazi.dayZhi]}） ← 日主
时柱：${bazi.hourGan}${bazi.hourZhi}（${GAN_WUXING[bazi.hourGan]}${ZHI_WUXING[bazi.hourZhi]}）

【五行分布】
${wuxingStr}
`.trim()
  } else {
    const currentYear = new Date().getFullYear()
    return `
【User's Ba Zi Chart】
Name: ${user.name}
Gender: ${user.gender}
Born: ${user.birthYear}/${user.birthMonth}/${user.birthDay} ${user.birthHour}:00
Lunar: ${user.lunarDate || 'calculating'}
Birth place: ${user.birthPlace}
Current year: ${currentYear}

【Four Pillars】
Year: ${bazi.yearGan}${bazi.yearZhi} (${GAN_WUXING[bazi.yearGan]}-${ZHI_WUXING[bazi.yearZhi]})
Month: ${bazi.monthGan}${bazi.monthZhi} (${GAN_WUXING[bazi.monthGan]}-${ZHI_WUXING[bazi.monthZhi]})
Day: ${bazi.dayGan}${bazi.dayZhi} (${GAN_WUXING[bazi.dayGan]}-${ZHI_WUXING[bazi.dayZhi]}) ← Day Master
Hour: ${bazi.hourGan}${bazi.hourZhi} (${GAN_WUXING[bazi.hourGan]}-${ZHI_WUXING[bazi.hourZhi]})

【Five Elements Distribution】
${wuxingStr}
`.trim()
  }
}

function buildSystemPrompt(module: Module, lang: Lang): string {
  const currentYear = new Date().getFullYear()

  const moduleContext = {
    self:   lang === 'zh' ? '与己（自身命盘分析、五行格局、性格运势）' : 'The Self (birth chart, five elements, character)',
    people: lang === 'zh' ? '与人（人际关系、合婚、缘分分析）'        : 'Relations (compatibility, bonds, people)',
    world:  lang === 'zh' ? '与世界（时运流年、世界能量、方位择吉）'   : 'The World (timing, annual cycles, world energy)',
  }

  if (lang === 'zh') {
    return `你是一炁堂的命理顾问，精通阴阳五行、八卦命理、中国古典哲学。
当前年份是 ${currentYear} 年，回答涉及"今年"时请以此为准。

当前模块：${moduleContext[module]}

【回答格式要求——严格遵守】
1. 禁止使用任何 Markdown 符号，包括 * ** # ## ### > --- 等，一律不用
2. 用普通文字分段，段与段之间空一行
3. 先用日常语言说清楚结论和建议，让普通人一读就懂
4. 再适当补充命理依据，简短解释原理即可，不要堆砌术语
5. 语气亲切自然，像朋友聊天，不要像古文教材
6. 回答长度 300 字左右，不要过长
7. 结尾一句话总结，简短有力

【内容要求】
- 结论要具体，避免模糊套话如"运势平稳，宜谨慎"
- 给出 1-2 个实际可操作的建议
- 适当引用一句经典，但要用白话解释其含义`
  } else {
    return `You are the oracle of One Breath, a guide in Taoist philosophy, Five Elements, Ba Zi and I Ching.
The current year is ${currentYear}. When the user asks about "this year", use this year.

Current module: ${moduleContext[module]}

【Format rules — strictly follow】
1. No Markdown symbols at all — no * ** # ## > --- etc.
2. Use plain paragraphs with a blank line between them
3. Lead with plain-language conclusions that anyone can understand
4. Follow with a brief explanation of the elemental reasoning — keep it short
5. Warm and conversational tone, like a knowledgeable friend
6. Around 200 words total, not too long
7. End with one short, memorable closing thought

【Content rules】
- Be specific — avoid vague platitudes like "exercise caution"
- Give 1-2 concrete, actionable suggestions
- One classical reference is fine, but always explain it in plain language`
  }
}

export async function analyzeWithDeepSeek(params: AnalyzeParams): Promise<string> {
  const { user, bazi, module, question, lang } = params

  const userContext = buildUserContext(user, bazi, lang)
  const systemPrompt = buildSystemPrompt(module, lang)

  const userMessage = lang === 'zh'
    ? `${userContext}\n\n【问题】${question}`
    : `${userContext}\n\n【Question】${question}`

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content
    || (lang === 'zh' ? '天机难测，请稍后再试。' : 'The oracle is silent. Please try again.')
}
