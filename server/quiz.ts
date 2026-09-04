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
import { getEntry, traceOf, type CatalogEntry, type Fact } from './catalog.ts'
import { generate, type Principal } from './llm.ts'

export type Question = {
  expId: string
  title: string
  factId: string
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

const SYSTEM =
  '你是考研 408 与算法面试的出题助手。系统会给你一条「已知事实」和它的正确答案，' +
  '你的唯一任务是把这条事实改写成一道选择题的**题面**（一句话，不要包含答案、不要出现选项字母），' +
  '再写一句**讲解**说明为什么这个答案对。' +
  '严禁自己计算或编造任何数字——答案和选项都由系统提供，你只负责把它说成人话。' +
  '题面里不要罗列完整的中间状态（如整张距离表、整个数组），也不要写出答案本身，只描述要问的问题。' +
  '只输出 JSON：{"question":"…","explanation":"…"}，不要任何多余文字。'

async function phrase(
  entry: CatalogEntry, fact: Fact, answer: string, evidence: string,
  principal: Principal, useLLM: boolean,
): Promise<{ question: string; explanation: string; by: 'llm' | 'fallback' }> {
  const fallback = {
    question: fact.ask,
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
      `请据此写题面与讲解。`
    const r = await generate({
      module: 'lab_ai', task: 'quiz', system: SYSTEM, prompt,
      maxTokens: 400, provider: 'minimax', principal,
    })
    const j = extractJSON(r.text)
    if (j?.question && j?.explanation) {
      return { question: String(j.question), explanation: String(j.explanation), by: 'llm' }
    }
    return fallback
  } catch (e) {
    console.warn('[quiz] 大模型出题失败，用保底题面:', (e as Error).message)
    return fallback
  }
}

export type BuildOptions = { count?: number; useLLM?: boolean; principal?: Principal; factId?: string }

export async function buildQuiz(expId: string, opts: BuildOptions = {}): Promise<Question[]> {
  const entry = getEntry(expId)
  if (!entry) throw new Error(`未知实验：${expId}（可用：见 /lab/ai/experiments）`)
  const trace = traceOf(entry)
  if (trace.length === 0) throw new Error(`实验 ${expId} 跑不出 trace`)

  const useLLM = opts.useLLM !== false
  //  factId 定向:只出这一条事实的题（「去练最弱那条」用）。事实过期(找不到)就退回整套,不至于空。
  const targeted = opts.factId ? entry.facts.filter(f => f.id === opts.factId) : null
  const picks = targeted && targeted.length > 0
    ? targeted
    : opts.count && opts.count < entry.facts.length
      ? shuffle(entry.facts).slice(0, opts.count)
      : entry.facts

  const out: Question[] = []
  for (const fact of picks) {
    const { answer, step, evidence } = fact.compute(trace)      // ← 引擎算出的钉死答案
    const distractors = fact.distractors(answer, trace).filter(d => d !== answer)
    const options = shuffle([answer, ...distractors])
    const correctIndex = options.indexOf(answer)                // ← 我们设定，模型碰不到
    const { question, explanation, by } = await phrase(entry, fact, answer, evidence, opts.principal ?? null, useLLM)
    out.push({
      expId, title: entry.title, factId: fact.id,
      question, options, correctIndex, explanation,
      provenance: { engineAnswer: answer, traceLen: trace.length, sourceStep: step, evidence, phrasedBy: by },
    })
  }
  return out
}
