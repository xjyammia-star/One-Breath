// api/fengshui-vision.js
// 视觉分析接口：手相 + 风水照片
// 使用 Doubao Seed 2.0 Vision 模型（火山引擎）

const { getPool } = require('./_lib/db')
const { getSession, checkFeatureAccess, logUsage } = require('./_lib/auth')

const VISION_FEATURE_KEYS = ['palm_reading', 'fengshui_photo']

// 手相分析系统提示词
function buildPalmPrompt(userContext, lang) {
  const currentYear = new Date().getFullYear()
  if (lang === 'zh') {
    return `你是一炁堂的手相顾问，精通麻衣神相、手相学与五行命理。当前年份是 ${currentYear} 年。

【用户命盘信息已提供，请结合八字五行与手相进行综合分析】

${userContext}

【分析要求】
步骤一：手型五行判断
  观察手掌整体形状和手指长短，判断属于木/火/土/金/水哪种手型
  结合命局五行，说明手型与命局的契合或互补之处

步骤二：三大主线解读
  逐一分析生命线、感情线、智慧线的走向、长短、深浅、有无断裂或特殊纹路
  每条线给出具体的命运提示

步骤三：命运线与事业线
  分析命运线（若可见）的起点、走向、清晰程度
  说明对事业发展的提示

步骤四：重要丘位
  重点观察金星丘、木星丘、太阳丘的饱满程度
  结合命局五行用神，说明哪个丘位最需要关注

步骤五：特殊纹路
  指出手掌中任何特殊纹路（岛纹、星纹、十字纹等）及其含义

步骤六：手相与八字综合
  将手相特征与命局五行、日主强弱综合，给出整体命运解读
  说明手相印证或补充了八字中的哪些信息

【输出格式】
第一部分：详细分析（按步骤编号）
单独一行写：===CONCLUSION===
第三部分：综合建议（150字，简洁实用）

【写作规范】
1. 禁止任何 Markdown 符号：* ** # ## 等
2. 每个术语立即用括号加白话解释
3. 五行数值严格使用命盘中提供的数字`
  } else {
    return `You are the palm reading oracle of One Breath, expert in classical Chinese palmistry (Ma Yi Xiang Fa) and Five Elements. Current year: ${currentYear}.

【User's Ba Zi chart is provided — combine palmistry with elemental analysis】

${userContext}

Analysis steps:
Step 1: Hand shape and Five Elements — assess shape and finger proportions, link to natal chart
Step 2: Three major lines — Life, Heart, Head lines: length, depth, breaks, special markings
Step 3: Fate line and career — starting point, clarity, career implications
Step 4: Key mounts — Venus, Jupiter, Apollo mounts; link to Useful God element
Step 5: Special markings — islands, stars, crosses and their meanings
Step 6: Palm + Ba Zi synthesis — how the palm confirms or complements the natal chart

Format: Step-by-step analysis, then ===CONCLUSION===, then ~120 word summary.
No Markdown symbols. Every Chinese term explained in plain language.`
  }
}

// 风水照片分析系统提示词
function buildFengshuiPrompt(userContext, lang) {
  const currentYear = new Date().getFullYear()
  if (lang === 'zh') {
    return `你是一炁堂的风水顾问，精通五行风水、钦定协纪辨方书与居家环境调理。当前年份是 ${currentYear} 年。

【用户命盘信息已提供，请结合命局五行与照片中的居家环境进行分析】

${userContext}

【分析要求】
步骤一：照片环境识别
  描述照片中可见的空间类型（卧室/客厅/书房/厨房等）
  识别主要家具摆放、颜色基调、光线情况

步骤二：五行能量评估
  分析空间中各五行元素的强弱：
  木元素（植物、木质家具、绿色）、火元素（灯光、红色、尖锐造型）
  土元素（陶瓷、黄色、方形）、金元素（金属、白色、圆形）、水元素（镜子、黑色、流线型）

步骤三：与命局的契合度
  对照用户命局的用神五行（最需要的五行）
  分析当前空间五行是否支持命主的用神
  指出空间中哪些元素对命主有利，哪些需要调整

步骤四：布局风水判断
  观察家具摆放是否符合风水原则（床位朝向、沙发背靠、门口动线等）
  指出明显的风水问题

步骤五：具体调整建议
  针对照片中的实际情况，给出3-5条具体可操作的调整建议
  包括：可以增加的物品、需要移除的东西、颜色调整、植物摆放等

步骤六：今年特别注意
  结合 ${currentYear} 年干支，说明今年对这个空间的特别提示

【输出格式】
第一部分：详细分析（按步骤编号）
单独一行写：===CONCLUSION===
第三部分：综合建议（200字，分优先级给出可操作方案）

【写作规范】
1. 禁止任何 Markdown 符号
2. 基于照片中实际可见的内容分析，不要臆测看不到的部分
3. 五行数值严格使用命盘中提供的数字`
  } else {
    return `You are the Feng Shui oracle of One Breath, expert in Five Elements feng shui and classical Chinese spatial harmony. Current year: ${currentYear}.

【User's Ba Zi chart is provided — analyze the photo in relation to their elemental needs】

${userContext}

Analysis steps:
Step 1: Space identification — room type, furniture layout, colors, lighting
Step 2: Five Elements assessment — identify Wood/Fire/Earth/Metal/Water elements present
Step 3: Alignment with natal chart — does the space support the Useful God element?
Step 4: Layout feng shui — furniture placement, flow, directional issues
Step 5: Specific adjustments — 3-5 concrete actionable suggestions based on the photo
Step 6: This year's notes — ${currentYear} stem-branch specific considerations

Format: Step-by-step analysis, then ===CONCLUSION===, then ~150 word prioritized action plan.
No Markdown symbols. Base analysis only on what is visible in the photo.`
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const pool = getPool()

  try {
    const { imageBase64, imageType, featureKey: rawKey, userContext, lang } = req.body

    if (!imageBase64) return res.status(400).json({ error: '缺少图片数据' })

    const featureKey = VISION_FEATURE_KEYS.includes(rawKey) ? rawKey : 'palm_reading'
    const mimeType = imageType || 'image/jpeg'

    // 权限校验
    const session = await getSession(req, pool)
    if (!session) {
      return res.status(401).json({ error: '此功能需要登录后使用', code: 'LOGIN_REQUIRED' })
    }

    const access = await checkFeatureAccess(session.user_id, featureKey, pool)
    if (!access.allowed) {
      const msg = access.reason === 'paid_required' || access.reason === 'feature_not_found'
        ? '此功能需要订阅后使用'
        : '今日次数已用完，明日再来'
      return res.status(403).json({
        error: msg,
        reason: access.reason,
        code: (access.reason === 'paid_required' || access.reason === 'feature_not_found')
          ? 'PAID_REQUIRED' : 'DAILY_LIMIT_REACHED'
      })
    }

    await logUsage(session.user_id, featureKey, pool)

    // 构建系统提示词
    const systemPrompt = featureKey === 'palm_reading'
      ? buildPalmPrompt(userContext || '', lang || 'zh')
      : buildFengshuiPrompt(userContext || '', lang || 'zh')

    // 用户提示词
    const userPromptText = featureKey === 'palm_reading'
      ? (lang === 'zh' ? '请分析这张手相照片，结合我的八字命盘进行综合解读。' : 'Please analyze this palm photo in combination with my Ba Zi chart.')
      : (lang === 'zh' ? '请分析这张居家照片的风水情况，结合我的八字命盘给出调整建议。' : 'Please analyze the feng shui of this home photo in relation to my Ba Zi chart.')

    const apiKey = process.env.DEEPSEEK_API_KEY
    const visionModel = process.env.DOUBAO_VISION_MODEL

    if (!visionModel) {
      return res.status(500).json({ error: '视觉模型未配置，请联系管理员' })
    }

    // 调用 Doubao Vision API（火山引擎，OpenAI 兼容格式）
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: visionModel,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: 'text',
                text: userPromptText,
              },
            ],
          },
        ],
        max_tokens: 3000,
        temperature: 0.7,
      }),
    })

    const text = await response.text()
    if (!response.ok) {
      console.error('[vision api error]', text)
      return res.status(500).json({ error: `视觉模型调用失败: ${response.status}`, detail: text })
    }

    const data = JSON.parse(text)
    return res.status(200).json(data)

  } catch (err) {
    console.error('[fengshui-vision handler error]', err)
    return res.status(500).json({ error: 'Handler error', detail: err.message })
  }
}
