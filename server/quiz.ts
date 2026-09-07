/**
 * 任务①：引擎出题。
 *
 * 分工是本文件的全部要点：
 *   引擎（catalog.ts）  —— 算出**钉死的标准答案** + 干扰项 + 出处，correctIndex 由我们设定。
 *   大模型（llm.ts）    —— 只把事实**改写成一句自然题面 + 一句讲解**，碰不到「哪个是对的」。
 *
 * 所以哪怕大模型宕了、或乱答，这道题的答案依然正确 —— 有 fallback 保底题面兜底。
 * 大模型只能让题面更好读，永远不能让答案变错。这是「焊死引擎」的实现。
 */
import { getEntry, traceOf, genreOf, type CatalogEntry, type Fact, type FactGenre } from './catalog.ts'
import { generate, type Principal } from './llm.ts'

export type Question = {
  expId: string
  title: string
  factId: string
  /** 这道题是原理题还是计数题 —— 前端可以据此标注,判据也据此配比。 */
  genre: FactGenre
  question: string
  options: string[]
  correctIndex: number       // 由引擎设定，大模型碰不到
  explanation: string
  provenance: {              // 可溯源：这道题的答案是怎么从引擎算出来的
    engineAnswer: string
    traceLen: number
    sourceStep: number
    evidence: string
    phrasedBy: 'llm' | 'fallback'
  }
}

// 洗牌（Fisher–Yates）。出题顺序无需可复现，用 Math.random 即可。
function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

// 从大模型输出里抠出 JSON（可能被 ```json 包裹或前后有废话）。
function extractJSON(text: string): { question?: string; explanation?: string } | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}

const SYSTEM_BASE =
  '你是考研 408 与算法面试的出题助手。系统会给你一条「已知事实」和它的正确答案，' +
  '你的唯一任务是把这条事实改写成一道选择题的**题面**（一句话，不要包含答案、不要出现选项字母），' +
  '再写一句**讲解**说明为什么这个答案对。' +
  '严禁自己计算或编造任何数字——答案和选项都由系统提供，你只负责把它说成人话。' +
  '只输出 JSON：{"question":"…","explanation":"…"}，不要任何多余文字。'

/*  ⚠️ 这两句以前是同一句,而且自相矛盾:一边让模型「不要罗列整个数组」,一边又出「这组数据比较了几次」
    的题 —— 结果题面写成「在快速排序对一组数据的完整排序过程中……」,哪组数据?没人答得上来。
    用户截图里那道题就是这么来的。现在按题型分开:
      · 原理题：不许把中间状态抄进题面(那是给答案)
      · 计数题：**必须**把那组数据写进题面,否则这道题根本不成立 */
const SYSTEM_CONCEPT = SYSTEM_BASE +
  '这是一道**原理题**：题面只描述要问的概念/权衡/不变量，不要罗列完整的中间状态（如整张距离表、整个数组）。'
const SYSTEM_COUNT = SYSTEM_BASE +
  '这是一道**计数题**：题面里**必须原样写出系统给你的那组输入数据**，' +
  '否则读题的人无从算起。除这组输入外，不要罗列其它中间状态。'

async function phrase(
  entry: CatalogEntry, fact: Fact, genre: FactGenre, answer: string, evidence: string,
  trace: Record<string, unknown>[], principal: Principal, useLLM: boolean,
): Promise<{ question: string; explanation: string; by: 'llm' | 'fallback' }> {
  //  计数题的保底题面也得带上数据 —— 「这个数组」在出题面板里是指不到任何东西的
  const data = genre === 'count' ? inputBrief(entry, trace) : ''
  const fallback = {
    question: askWithData(entry, fact, trace),
    explanation: `标准答案 **${answer}** 由「${entry.title}」实验引擎逐步计算得出。出处：${evidence}`,
    by: 'fallback' as const,
  }
  if (!useLLM) return fallback
  try {
    const prompt =
      `实验：${entry.title}\n` +
      `已知事实（考点）：${fact.label}\n` +
      `正确答案：${answer}\n` +
      `引擎给出的出处/证据：${evidence}\n` +
      (data ? `这道题问的是这组输入上的具体数字，题面里必须写出它：${data}\n` : '') +
      `请据此写题面与讲解。`
    const r = await generate({
      module: 'lab_ai', task: 'quiz', system: genre === 'count' ? SYSTEM_COUNT : SYSTEM_CONCEPT, prompt,
      maxTokens: 400, provider: 'minimax', principal,
    })
    const j = extractJSON(r.text)
    if (j?.question && j?.explanation) {
      const q = String(j.question)
      //  计数题的题面要是没把数据带上,就退回保底题面 —— 宁可题面呆板,也不能出一道没法答的题
      if (data && !q.includes(data.slice(1, 4))) return { ...fallback, explanation: String(j.explanation) }
      return { question: q, explanation: String(j.explanation), by: 'llm' }
    }
    return fallback
  } catch (e) {
    console.warn('[quiz] 大模型出题失败，用保底题面:', (e as Error).message)
    return fallback
  }
}

/**
 * 只认这几个字段名是「输入序列」。
 * ⚠️ 不能见数组就抓:trace 第 0 帧里也有 frames / sets / forest 这类**状态**数组,
 * 把它们当输入写进题面,那道题就是在拿错数据问人 —— 比没有数据更糟。
 */
const INPUT_FIELDS = ['arr', 'array', 'input', 'data', 'seq', 'keys', 'refs', 'values']

/**
 * 把这个实验的输入摘成一句能写进题面的话(计数题要用)。
 * 顺序:文档里的数据流 → trace 第 0 帧的输入字段 → 文档参数。都摘不出就回空串,
 * 而**摘不出输入的计数题根本不会被选进题目**(见 pickBalanced)—— 因为那种题面只能写成
 * 「对一组数据……」,读题的人无从算起。用户截图里那道题就是这么来的。
 */
export function inputBrief(entry: CatalogEntry, trace?: Record<string, unknown>[]): string {
  const st = entry.doc.streams?.[0]
  if (st && Array.isArray(st.values) && st.values.length) return `[${st.values.join(', ')}]`
  const f0 = trace?.[0]
  if (f0) for (const k of INPUT_FIELDS) {
    const v = f0[k]
    if (Array.isArray(v) && v.length >= 2 && v.length <= 24 && v.every(x => typeof x === 'number' || typeof x === 'string'))
      return `[${v.join(', ')}]`
  }
  const ps = Object.entries(entry.doc.params ?? {})
  if (ps.length) return ps.map(([k, v]) => `${k}=${v}`).join(', ')
  return ''
}

/**
 * 把数据注进题面。
 * 计数题的 `ask` 大多写着「这个数组」「这组数据」—— 那是站在实验页面里说的话,
 * 可出题/答疑/复习面板里根本没有那个数组。所以端出去之前一律换成真数据;
 * 换不上(题面里压根没提数据)就在前面补一句「在序列 […] 中，」。
 */
export function askWithData(entry: CatalogEntry, fact: Fact, trace: Record<string, unknown>[]): string {
  if (genreOf(fact, trace) !== 'count') return fact.ask
  const data = inputBrief(entry, trace)
  if (!data) return fact.ask
  const swapped = fact.ask.replace(/这个数组|这组数据|一组数据/g, `序列 ${data} `)
  return swapped === fact.ask ? `在序列 ${data} 中，${fact.ask}` : swapped
}

export type BuildOptions = { count?: number; useLLM?: boolean; principal?: Principal; factId?: string }

/**
 * 一套题里最多放几道计数题。
 *
 * 不是零 —— 408 真题确实会问「写出第一趟划分结果」「比较了多少次」,那是正经题型。
 * 但它**不该是全部**:一套三道题全在数「比了几次、移了几次」,考的是耐心不是理解。
 * 所以原理题优先,计数题至多一道压阵。
 */
export const MAX_COUNT_QUESTIONS = 1

export async function buildQuiz(expId: string, opts: BuildOptions = {}): Promise<Question[]> {
  const entry = getEntry(expId)
  if (!entry) throw new Error(`未知实验：${expId}（可用：见 /lab/ai/experiments）`)
  const trace = traceOf(entry)
  if (trace.length === 0) throw new Error(`实验 ${expId} 跑不出 trace`)

  const useLLM = opts.useLLM !== false
  //  factId 定向:只出这一条事实的题（「去练最弱那条」用）。事实过期(找不到)就退回整套,不至于空。
  const targeted = opts.factId ? entry.facts.filter(f => f.id === opts.factId) : null
  const picks = targeted && targeted.length > 0 ? targeted : pickBalanced(entry, trace, opts.count)

  //  每条 fact 的题面改写是一次独立大模型调用,彼此无依赖——并行发,别串行等。
  //  Promise.all 保留 picks 顺序,题目顺序不变;引擎钉死答案在 compute 里(同步)先算好。
  const out = await Promise.all(picks.map(async (fact): Promise<Question> => {
    const genre = genreOf(fact, trace)
    const { answer, step, evidence } = fact.compute(trace)      // ← 引擎算出的钉死答案
    const distractors = fact.distractors(answer, trace).filter(d => d !== answer)
    const options = shuffle([answer, ...distractors])
    const correctIndex = options.indexOf(answer)                // ← 我们设定，模型碰不到
    const { question, explanation, by } = await phrase(entry, fact, genre, answer, evidence, trace, opts.principal ?? null, useLLM)
    return {
      expId, title: entry.title, factId: fact.id, genre,
      question, options, correctIndex, explanation,
      provenance: { engineAnswer: answer, traceLen: trace.length, sourceStep: step, evidence, phrasedBy: by },
    }
  }))
  return out
}

/**
 * 端给用户的事实(出题 / 答疑的可点问题 / 复习闪卡 / 面试题都走这一关)。
 * 摘不出输入数据的计数题一律滤掉 —— 那种题面写出来就是「对一组数据比较了多少次」,没法答。
 */
export function servableFacts(entry: CatalogEntry, trace: Record<string, unknown>[]): Fact[] {
  const statable = inputBrief(entry, trace) !== ''
  return entry.facts.filter(f => statable || genreOf(f, trace) === 'concept')
}

/**
 * 挑题:原理题优先铺满,计数题至多留一道压阵。
 * **摘不出输入数据的计数题直接不选** —— 那种题写出来就是「对一组数据比较了多少次」,没法答。
 */
export function pickBalanced(entry: CatalogEntry, trace: Record<string, unknown>[], want?: number): Fact[] {
  const n = want && want > 0 ? want : entry.facts.length
  const statable = inputBrief(entry, trace) !== ''
  const concept = shuffle(entry.facts.filter(f => genreOf(f, trace) === 'concept'))
  const counting = statable ? shuffle(entry.facts.filter(f => genreOf(f, trace) === 'count')) : []
  const keepCount = Math.min(counting.length, MAX_COUNT_QUESTIONS, Math.max(0, n - Math.min(concept.length, n - 1)))
  const out = [...concept.slice(0, n - keepCount), ...counting.slice(0, keepCount)]
  //  概念题不够铺满时才拿计数题补位 —— 补位是退路,不是常态(判据会盯着「不许全是计数题」)
  if (out.length < n) out.push(...counting.slice(keepCount, keepCount + (n - out.length)))
  return shuffle(out).slice(0, n)
}
