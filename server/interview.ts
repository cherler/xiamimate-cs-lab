/**
 * AI 面试官（模拟面试）—— AI 学伴的第四个模式，补「面试临场」这一关。
 *
 * 和出题/答疑/复习不同,这是**多轮对话**:AI 扮演资深面试官,就当前实验的知识点问一道题,
 * 学生自由作答,AI 点评对错、指出遗漏、追问更深一层;几轮后给总评 + 评分。
 *
 * 焊死味在 grounding:把实验的**钉死要点(catalog facts 的答案)**当作判卷的地面真值喂给面试官——
 * 于是它点评「你这里说错了」时,底气来自引擎算出的正确答案,而不是模型自己的臆断。
 * 出题机会骗人,判卷的标准答案不会。
 */
import { getEntry, traceOf, type CatalogEntry } from './catalog.ts'
import { generate, type Principal } from './llm.ts'

export type Turn = { role: 'interviewer' | 'candidate'; text: string }

export type InterviewResult = {
  expId: string
  reply: string
  round: number
  done: boolean          // 是否已到总评环节
  billing: { metered: boolean; credits: number; tokens: number; note: string }
}

const MAX_ROUNDS = 3     // 学生答满 3 轮后进入总评

function keyPoints(entry: CatalogEntry): string {
  const t = traceOf(entry)
  return entry.facts.map(f => {
    try { return `- ${f.label}：${f.compute(t as never).answer}` } catch { return `- ${f.label}` }
  }).join('\n')
}

function traceGist(entry: CatalogEntry): string {
  const t = traceOf(entry) as Record<string, unknown>[]
  return t.map((f, i) => `第${i}步：${String(f.log ?? '')}`).slice(0, 12).join('\n')
}

const SYS_ASK =
  '你是一位资深的后端/算法技术面试官，正在面一位应届候选人。下面给你这道题所属实验的知识点与运行轨迹（判卷的地面真值，你可以据此判断对错）。' +
  '请**只问一道**该主题下的面试题（一句话，口语化，像真面试官开口那样），不要给提示、不要自问自答、不要透露答案。只输出这一句问题。'

function sysEvaluate(concluding: boolean): string {
  const base =
    '你是资深技术面试官。下面是这道题的知识点与轨迹（判卷地面真值）+ 到目前为止的对话。' +
    '针对候选人**最后一次回答**：先一句话点评（对/部分对/不对，对照要点指出**漏了什么或错在哪**，判断依据来自给定要点，别臆断），'
  if (concluding) {
    return base +
      '然后给**总评**：这几轮整体表现的一句话总结 + 一个 1~5 分的评分（5=优秀）+ 一条最该补的建议。' +
      '格式自然、简短，像面试官收尾。'
  }
  return base + '然后**追问更深一层**（一句话，往原理/边界/权衡上问），逼候选人再想。简短，别长篇大论、别把答案讲完。'
}

export type InterviewOptions = { history?: Turn[]; principal?: Principal; useLLM?: boolean }

export async function interview(expId: string, opts: InterviewOptions = {}): Promise<InterviewResult> {
  const entry = getEntry(expId)
  if (!entry) throw new Error(`未知实验：${expId}（可用：见 /lab/ai/experiments）`)
  const history = opts.history ?? []
  const answered = history.filter(h => h.role === 'candidate').length
  const first = answered === 0 && history.length === 0
  const concluding = answered >= MAX_ROUNDS

  if (opts.useLLM === false) {
    return { expId, reply: first ? `（未调用大模型）关于「${entry.title}」，请谈谈你的理解。` : '（未调用大模型）收到。', round: answered, done: concluding, billing: { metered: false, credits: 0, tokens: 0, note: '未调用大模型' } }
  }

  const ground = `实验：${entry.title}\n===== 判卷要点（地面真值）=====\n${keyPoints(entry)}\n===== 运行轨迹 =====\n${traceGist(entry)}\n=====`
  let system: string, prompt: string
  if (first) {
    system = SYS_ASK
    prompt = `${ground}\n\n请就「${entry.title}」问候选人一道面试题。`
  } else {
    system = sysEvaluate(concluding)
    const convo = history.map(h => `${h.role === 'interviewer' ? '面试官' : '候选人'}：${h.text}`).join('\n')
    prompt = `${ground}\n\n===== 对话 =====\n${convo}\n=====\n\n请点评候选人最后一次回答${concluding ? '，并给出总评与评分' : '，然后追问更深一层'}。`
  }

  const r = await generate({ module: 'lab_ai', task: 'interview', system, prompt, maxTokens: 500, provider: 'minimax', principal: opts.principal ?? null })
  return { expId, reply: r.text.trim(), round: answered, done: concluding, billing: r.billing }
}
