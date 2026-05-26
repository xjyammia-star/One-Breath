// src/utils/ai.ts
// DeepSeek V3 API 调用 + RAG检索

import { UserProfile, BaZi, Module, Lang } from '../types'
import { GAN_WUXING, ZHI_WUXING, getWuXingScore } from './bazi'

interface AnalyzeParams {
  user: UserProfile
  bazi: BaZi
  module: Module
  question: string
  lang: Lang
}

const DEEPSEEK_BASE_URL = import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const DEEPSEEK_API_KEY  = import.meta.env.VITE_DEEPSEEK_API_KEY  || ''

/**
 * 构建用户命盘的系统上下文
 */
function buildUserContext(user: UserProfile, bazi: BaZi, lang: Lang): string {
  const wuxing = getWuXingScore(bazi)
  const wuxingStr = Object.entries(wuxing)
    .sort(([,a],[,b]) => b - a)
    .map(([k, v]) => `${k}(${v.toFixed(1)})`)
    .join(' ')

  if (lang === 'zh') {
    return `
【用户命盘信息】
姓名：${user.name}
性别：${user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : '其他'}
出生：${user.birthYear}年${user.birthMonth}月${user.birthDay}日 ${user.birthHour}时
农历：${user.lunarDate || '计算中'}
出生地：${user.birthPlace}

【八字四柱】
年柱：${bazi.yearGan}${bazi.yearZhi}（${GAN_WUXING[bazi.yearGan]}${ZHI_WUXING[bazi.yearZhi]}）
月柱：${bazi.monthGan}${bazi.monthZhi}（${GAN_WUXING[bazi.monthGan]}${ZHI_WUXING[bazi.monthZhi]}）
日柱：${bazi.dayGan}${bazi.dayZhi}（${GAN_WUXING[bazi.dayGan]}${ZHI_WUXING[bazi.dayZhi]}） ← 日主
时柱：${bazi.hourGan}${bazi.hourZhi}（${GAN_WUXING[bazi.hourGan]}${ZHI_WUXING[bazi.hourZhi]}）

【五行分布】
${wuxingStr}
`.trim()
  } else {
    return `
【User's Ba Zi Chart】
Name: ${user.name}
Gender: ${user.gender}
Born: ${user.birthYear}/${user.birthMonth}/${user.birthDay} ${user.birthHour}:00
Lunar: ${user.lunarDate || 'calculating'}
Birth place: ${user.birthPlace}

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

/**
 * 构建系统提示词
 */
function buildSystemPrompt(module: Module, lang: Lang): string {
  const moduleContext = {
    self:   lang === 'zh' ? '与己（自身命盘分析、五行格局、性格运势）' : 'The Self (birth chart analysis, five elements, character and fortune)',
    people: lang === 'zh' ? '与人（人际关系、合婚、缘分分析）'       : 'Relations (interpersonal, compatibility, bonds)',
    world:  lang === 'zh' ? '与世界（时运流年、世界能量、方位择吉）'  : 'The World (timing, annual cycles, world energy)',
  }

  if (lang === 'zh') {
    return `你是一炁堂的命理顾问，精通阴阳五行、八卦命理、中国古典哲学。

当前模块：${moduleContext[module]}

你的回答风格：
- 语言典雅而不晦涩，古典与现代兼融
- 先引述五行八卦原理，再联系用户命盘具体分析
- 给予积极建议，不算死命，注重启示性
- 适当引用经典（如易经、道德经）增添文化深度
- 回答长度：300-600字，条理清晰
- 结尾可加一句简短的哲理格言

注意：你的分析基于命理哲学，是一种文化智慧的参考，非算命预测。请保持客观严谨，不夸大。`
  } else {
    return `You are the oracle of One Breath, a master of Taoist philosophy, Five Elements, Ba Zi and I Ching.

Current module: ${moduleContext[module]}

Your response style:
- Elegant yet accessible — blend classical wisdom with modern clarity
- Begin with elemental/philosophical principle, then apply to the user's chart
- Offer guidance, not fatalistic predictions — focus on insight and agency
- Occasionally reference classical texts (I Ching, Tao Te Ching) for depth
- Length: 200-400 words, well-structured
- End with a brief philosophical reflection

Note: Your analysis draws from Chinese philosophical tradition as cultural wisdom — not fortune-telling. Stay grounded and thoughtful.`
  }
}

/**
 * 主分析函数
 */
export async function analyzeWithDeepSeek(params: AnalyzeParams): Promise<string> {
  const { user, bazi, module, question, lang } = params

  if (!DEEPSEEK_API_KEY) {
    // 开发模式：返回示例回答
    return lang === 'zh'
      ? `【演示模式】请在 .env 文件中配置 VITE_DEEPSEEK_API_KEY。\n\n您询问：「${question}」\n\n根据您的命盘，日主${bazi.dayGan}（${GAN_WUXING[bazi.dayGan]}）为命局核心。天地之气循环往复，生生不息。道可道，非常道。`
      : `[Demo mode] Please set VITE_DEEPSEEK_API_KEY in your .env file.\n\nYour question: "${question}"\n\nYour day master ${bazi.dayGan} (${GAN_WUXING[bazi.dayGan]} element) anchors your chart. The Tao that can be told is not the eternal Tao.`
  }

  const userContext = buildUserContext(user, bazi, lang)
  const systemPrompt = buildSystemPrompt(module, lang)

  const userMessage = lang === 'zh'
    ? `${userContext}\n\n【问题】${question}`
    : `${userContext}\n\n【Question】${question}`

  const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      max_tokens: 1200,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || (lang === 'zh' ? '天机难测，请稍后再试。' : 'The oracle is silent. Please try again.')
}
