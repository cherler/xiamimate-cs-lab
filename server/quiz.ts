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
import { prompt } from './prompts/loader.ts'

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
    /** 题面从来不过模型:'engine' = 我们写的 ask（计数题注入了数据）。 */
    phrasedBy: 'engine'
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

/**
 * 题面**不过大模型**。
 *
 * 原来这里有一步「让模型把 fact.ask 改写成题面」,删了,两个原因:
 *   1. 它是纯减分项。1004 条 ask 本来就是手写的完整问句;模型改写只会引入偏差 ——
 *      用户截图里那句「在快速排序对**某组关键字**进行排序的过程中……」,
 *      就是模型把我们写的「把这个数组快速排序完成」改没了数据指代的结果。
 *   2. 它是延迟的全部来源。引擎出一套题 13 毫秒,三次并行的改写调用要 10 秒 ——
 *      而讲解**只在用户答完那道题之后才显示**,提前给三道题都生成多半是白生成。
 *
 * 现在:题面 = askWithData(我们写的 ask,计数题再注入数据),讲解交给 explainQuestion 按需生成。
 */
function engineExplanation(entry: CatalogEntry, answer: string, evidence: string): string {
  return `标准答案 **${answer}**。依据：${evidence}（来自「${entry.title}」实验引擎）`
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
 * 一套题里最多放几道计数题 —— **零**。
 *
 * 一开始定的是 1（「408 真题也会问比较次数,留一道压阵」）。看完真实界面才明白这个类比不成立:
 * 真题给的是完整的数组和一趟一趟的过程,问的是「写出第一趟划分后的序列」这种**看得见过程**的东西;
 * 我们这儿是四个相邻整数让人在里面挑,不手推一遍根本不可能答。
 * 保留计数事实做地面真值,但不出成题目。
 */
export const MAX_COUNT_QUESTIONS = 0

export async function buildQuiz(expId: string, opts: BuildOptions = {}): Promise<Question[]> {
  const entry = getEntry(expId)
  if (!entry) throw new Error(`未知实验：${expId}（可用：见 /lab/ai/experiments）`)
  const trace = traceOf(entry)
  if (trace.length === 0) throw new Error(`实验 ${expId} 跑不出 trace`)

  //  factId 定向:只出这一条事实的题（「去练最弱那条」用）。事实过期(找不到)就退回整套,不至于空。
  const targeted = opts.factId ? entry.facts.filter(f => f.id === opts.factId) : null
  const picks = targeted && targeted.length > 0 ? targeted : pickBalanced(entry, trace, opts.count)

  //  全同步:引擎算答案、我们写的题面、洗牌。一套题 10 毫秒级,不等任何网络。
  return picks.map((fact): Question => {
    const genre = genreOf(fact, trace)
    const { answer, step, evidence } = fact.compute(trace)      // ← 引擎算出的钉死答案
    const distractors = fact.distractors(answer, trace).filter(d => d !== answer)
    const options = shuffle([answer, ...distractors])
    const correctIndex = options.indexOf(answer)                // ← 我们设定，模型碰不到
    return {
      expId, title: entry.title, factId: fact.id, genre,
      question: askWithData(entry, fact, trace),
      options, correctIndex,
      explanation: engineExplanation(entry, answer, evidence),
      provenance: { engineAnswer: answer, traceLen: trace.length, sourceStep: step, evidence, phrasedBy: 'engine' },
    }
  })
}

/**
 * 答完一道题之后,按需生成讲解。
 *
 * 讲解要做两件事:说清正确答案为什么对、**逐个驳倒其余三个选项**。
 * 所以三个干扰项必须一起传给模型 —— 以前根本没传,那句要求在结构上就做不到。
 * 答案由引擎/人工钉死,模型碰不到,它只是把「为什么」说成人话。
 */
export async function explainQuestion(
  expId: string, factId: string, opts: { principal?: Principal; useLLM?: boolean } = {},
): Promise<{ explanation: string; source: 'llm' | 'engine'; billing?: Billing }> {
  const entry = getEntry(expId)
  if (!entry) throw new Error(`未知实验：${expId}`)
  const fact = entry.facts.find(f => f.id === factId)
  if (!fact) throw new Error(`实验 ${expId} 里没有事实 ${factId}`)
  const trace = traceOf(entry)
  const { answer, evidence } = fact.compute(trace)
  const distractors = fact.distractors(answer, trace).filter(d => d !== answer)
  const fallback = { explanation: engineExplanation(entry, answer, evidence), source: 'engine' as const }
  if (opts.useLLM === false) return fallback
  try {
    const r = await generate({
      module: 'lab_ai', task: 'quiz_explain', system: prompt('quiz-explain'),
      prompt: `实验：${entry.title}\n题面：${askWithData(entry, fact, trace)}\n` +
        `正确答案：${answer}\n三个干扰项（都是错的，逐个驳倒）：\n${distractors.map(d => `  · ${d}`).join('\n')}\n` +
        `引擎给出的出处：${evidence}\n\n请写讲解。`,
      maxTokens: 400, provider: 'minimax', principal: opts.principal ?? null,
    })
    const text = r.text.trim()
    return text ? { explanation: text, source: 'llm', billing: r.billing } : fallback
  } catch (e) {
    console.warn('[quiz] 讲解生成失败，用引擎兜底:', (e as Error).message)
    return fallback
  }
}
type Billing = { metered: boolean; credits: number; tokens: number; note: string }

/**
 * 端给用户看的事实(出题 / 答疑的可点问题 / 复习闪卡)。
 *
 * **计数题一律不端出去。**
 *
 * 这一条是被同一个投诉逼到第二次才改对的,过程值得写下来:
 * 用户第一次说「这种肤浅的实操问题有什么意义?肯定是问理论知识啊」,我只做到「至多出一道、
 * 题面必须自带那组数据」—— 治标。第二次他看着题问:「谁特么知道一个数组是啥、怎么划分、
 * 怎么比较」。他是对的:就算把 [49,38,65,97,76,13,27,49] 印在题面上,要在 12/13/14/15
 * 里挑一个,你也得拿笔把整趟快排手推一遍。**那考的是耐心,不是理解。**
 * 四个相邻整数当选项,既推不出来也蒙不对 —— 这种题没有出的价值。
 *
 * 计数事实本身**留着**:它们是引擎能重算验证的地面真值,答疑和面试判卷都靠它们
 * (那两处走 entry.facts 全量,不走这里)。只是不再当题目端给人做。
 *
 * 兜底:万一某个实验一条原理题都没有,还是让计数题顶上 —— 总比出不了题强。
 * 不过 tests/fact-genre.test.ts 卡死了「没有实验可以全是计数题」,所以这条兜底走不到。
 */
export function servableFacts(entry: CatalogEntry, trace: Record<string, unknown>[]): Fact[] {
  const concept = entry.facts.filter(f => genreOf(f, trace) === 'concept')
  if (concept.length > 0) return concept
  //  没有原理题的实验(判据保证不存在)才退回计数题,而且仍要求题面写得出那组数据
  return inputBrief(entry, trace) !== '' ? entry.facts : []
}

/**
 * 挑题。**只从 servableFacts 里取** —— 那一关已经把计数题挡在外面了。
 *
 * ⚠️ 这里原来是从 entry.facts 直接筛的,还留了一句「概念题不够铺满时拿计数题补位」。
 * 把上限调成 0 之后判据当场抓到:dijkstra / mergesort / knn 这些只有两条原理题的实验,
 * 照样从后门漏出一道计数题。补位这条路本身就是错的 —— **三道题里有一道没法答,
 * 不如只出两道。** 现在取料口只有一个,漏不了。
 */
export function pickBalanced(entry: CatalogEntry, trace: Record<string, unknown>[], want?: number): Fact[] {
  const pool = shuffle(servableFacts(entry, trace))
  const n = want && want > 0 ? want : pool.length
  return pool.slice(0, n)
}
