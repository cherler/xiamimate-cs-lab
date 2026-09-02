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

// 跨轨:把整条职业线若干实验的要点汇成地面真值。取每个实验的**首条 fact**(确定性、跨轮稳定),
// 每条标注所属主题;上限 ~18 条(超了确定性均匀抽),既有广度又不撑爆提示。
function trackKeyPoints(expIds: string[]): { text: string; count: number } {
  const entries = expIds.map(getEntry).filter((e): e is CatalogEntry => !!e)
  const lines: string[] = []
  for (const e of entries) {
    const f = e.facts[0]; if (!f) continue
    try { lines.push(`- [${e.title}] ${f.label}：${f.compute(traceOf(e) as never).answer}`) } catch { lines.push(`- [${e.title}] ${f.label}`) }
  }
  const cap = 18
  const sel = lines.length <= cap ? lines : lines.filter((_, i) => i % Math.ceil(lines.length / cap) === 0).slice(0, cap)
  return { text: sel.join('\n'), count: sel.length }
}

function traceGist(entry: CatalogEntry): string {
  const t = traceOf(entry) as Record<string, unknown>[]
  return t.map((f, i) => `第${i}步：${String(f.log ?? '')}`).slice(0, 12).join('\n')
}

const SYS_ASK =
  '你是一位资深的后端/算法技术面试官，正在面一位应届候选人。下面给你这道题所属实验的知识点与运行轨迹（判卷的地面真值，你可以据此判断对错）。' +
  '请**只问一道**该主题下的面试题（一句话，口语化，像真面试官开口那样），不要给提示、不要自问自答、不要透露答案。只输出这一句问题。'

function sysAskTrack(title: string): string {
  return `你是一位资深技术面试官，正在面一位应届候选人，面试覆盖【${title}】这条职业线的多个主题（下面给你这条线的知识点池当判卷地面真值，每条标了所属主题）。` +
    '请**只问一道**面试题（一句话，口语化，像真面试官开口那样），从其中挑一个主题问；不要给提示、不要自问自答、不要透露答案。只输出这一句问题。'
}

function sysEvaluate(concluding: boolean, track = false): string {
  const base =
    '你是资深技术面试官。下面是判卷地面真值（要点' + (track ? '池，跨多个主题' : '与轨迹') + '）+ 到目前为止的对话。' +
    '针对候选人**最后一次回答**：先一句话点评（对/部分对/不对，对照要点指出**漏了什么或错在哪**，判断依据来自给定要点，别臆断），'
  if (concluding) {
    return base +
      '然后给**总评**：这几轮整体表现的一句话总结 + 一个 1~5 分的评分（5=优秀）+ 一条最该补的建议。' +
      '格式自然、简短，像面试官收尾。'
  }
  return base + (track
    ? '然后**换一个主题**再问一道（考察知识面的广度，一句话）。简短，别把答案讲完。'
    : '然后**追问更深一层**（一句话，往原理/边界/权衡上问），逼候选人再想。简短，别长篇大论、别把答案讲完。')
}

// 构建判卷地面真值块(单实验=要点+轨迹;整轨=跨主题要点池)。interview 和"看参考答案"共用。
function buildGround(track: boolean, entry: CatalogEntry | null, expIds: string[] | undefined, scopeName: string): string {
  return track
    ? (() => { const kp = trackKeyPoints(expIds!); return `面试范围：${scopeName}，覆盖 ${kp.count} 个主题\n===== 判卷要点池（地面真值，含所属主题）=====\n${kp.text}\n=====` })()
    : `实验：${entry!.title}\n===== 判卷要点（地面真值）=====\n${keyPoints(entry!)}\n===== 运行轨迹 =====\n${traceGist(entry!)}\n=====`
}

export type InterviewOptions = { expIds?: string[]; trackTitle?: string; history?: Turn[]; principal?: Principal; useLLM?: boolean }

// 看参考答案:给面试官刚问的那道题一个**基于钉死要点**的参考答案(不是模型自由发挥,只用给定要点)。
export async function interviewAnswer(expId: string, opts: InterviewOptions = {}): Promise<{ answer: string; billing: { metered: boolean; credits: number; tokens: number; note: string } }> {
  const track = !!(opts.expIds && opts.expIds.length > 1)
  const entry = track ? null : getEntry(expId)
  if (!track && !entry) throw new Error(`未知实验：${expId}（可用：见 /lab/ai/experiments）`)
  const history = opts.history ?? []
  const lastQ = [...history].reverse().find(h => h.role === 'interviewer')?.text ?? '（上一题）'
  if (opts.useLLM === false) return { answer: '（未调用大模型）参考答案见实验要点。', billing: { metered: false, credits: 0, tokens: 0, note: '未调用大模型' } }
  const scopeName = track ? `${opts.trackTitle ?? '这条职业线'}（跨主题）` : entry!.title
  const ground = buildGround(track, entry, opts.expIds, scopeName)
  const system =
    '你是资深技术面试官，现在给出这道面试题的**参考答案**。下面是判卷要点（地面真值）。' +
    '请**只依据这些要点**组织答案：简洁、有条理（3~6 句或分点），点出关键机制/取舍，别引入要点之外的假设、别啰嗦、别复述题目。'
  const prompt = `${ground}\n\n面试官刚问的问题：${lastQ}\n\n请给出参考答案。`
  const r = await generate({ module: 'lab_ai', task: 'interview_answer', system, prompt, maxTokens: 500, provider: 'minimax', principal: opts.principal ?? null })
  return { answer: r.text.trim(), billing: r.billing }
}

export async function interview(expId: string, opts: InterviewOptions = {}): Promise<InterviewResult> {
  const track = !!(opts.expIds && opts.expIds.length > 1)
  const entry = track ? null : getEntry(expId)
  if (!track && !entry) throw new Error(`未知实验：${expId}（可用：见 /lab/ai/experiments）`)
  const scopeName = track ? `${opts.trackTitle ?? '这条职业线'}（跨主题）` : entry!.title

  const history = opts.history ?? []
  const answered = history.filter(h => h.role === 'candidate').length
  const first = answered === 0 && history.length === 0
  const concluding = answered >= MAX_ROUNDS

  if (opts.useLLM === false) {
    return { expId, reply: first ? `（未调用大模型）关于「${scopeName}」，请谈谈你的理解。` : '（未调用大模型）收到。', round: answered, done: concluding, billing: { metered: false, credits: 0, tokens: 0, note: '未调用大模型' } }
  }

  const ground = buildGround(track, entry, opts.expIds, scopeName)

  let system: string, prompt: string
  if (first) {
    system = track ? sysAskTrack(opts.trackTitle ?? '这条职业线') : SYS_ASK
    prompt = `${ground}\n\n请就「${scopeName}」问候选人一道面试题。`
  } else {
    system = sysEvaluate(concluding, track)
    const convo = history.map(h => `${h.role === 'interviewer' ? '面试官' : '候选人'}：${h.text}`).join('\n')
    prompt = `${ground}\n\n===== 对话 =====\n${convo}\n=====\n\n请点评候选人最后一次回答${concluding ? '，并给出总评与评分' : (track ? '，然后换一个主题再问一道' : '，然后追问更深一层')}。`
  }

  const r = await generate({ module: 'lab_ai', task: 'interview', system, prompt, maxTokens: 500, provider: 'minimax', principal: opts.principal ?? null })
  return { expId, reply: r.text.trim(), round: answered, done: concluding, billing: r.billing }
}
