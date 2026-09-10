/**
 * 任务②：实验答疑。
 *
 * 焊死味在「grounding」：用户问「第3步为什么往右半找?」时，我们不是让大模型凭空解释，
 * 而是把**引擎实际跑出来的每一步**（每帧的 log）当作唯一上下文喂进去，要求它只依据轨迹回答、
 * 轨迹里没有依据就说不知道。轨迹本身是内核确定性生成的地面真值，所以答疑不会飘。
 *
 * 与 NotebookLM 的「闭卷 RAG」同形：只答给定源。差别是我们的「源」不是用户上传的文档，
 * 而是**引擎当场算出的运行轨迹** —— 比任何文档都更硬。
 */
import { getEntry, traceOf, genreOf, type CatalogEntry } from './catalog.ts'
import { servableFacts, askWithData } from './quiz.ts'
import { generate, type Principal, type Billing } from './llm.ts'

export type AskResult = {
  expId: string
  answer: string
  grounding: { title: string; step: number | null; frames: number; usedTrace: string }
  provenance?: { step: number; evidence: string }   // 点选"常见疑问"来的问题→对应 fact 的出处,给 citation chip
  billing: Billing
}

/*  常见疑问:直接用每个 fact 自带的"这在考什么"当可点问题——用户不用打字,点一个就问。
    ⚠️ 走 servableFacts 过一道:和出题用同一条纪律。以前这里直接铺 entry.facts,于是
    「把这个数组快速排序完成,一共比较了多少次?」也会被端上来当可点问题 —— 面板里根本没有
    那个数组,点了也是白点。原理题优先排在前面。 */
export function suggestQuestions(expId: string): { factId: string; ask: string }[] {
  const entry = getEntry(expId)
  if (!entry) return []
  const t = traceOf(entry) as Record<string, unknown>[]
  const fs = servableFacts(entry, t)
  return [...fs.filter(f => genreOf(f, t) === 'concept'), ...fs.filter(f => genreOf(f, t) !== 'concept')]
    .map(f => ({ factId: f.id, ask: askWithData(entry, f, t) }))
}

// 把 trace 摊成「第i步：log」文本。给了 step 就聚焦它附近 ±3 帧，否则给全程（本仓 trace 都很短）。
function traceContext(entry: CatalogEntry, step: number | null): string {
  const t = traceOf(entry) as Record<string, unknown>[]
  const lines = t.map((f, i) => `第${i}步：${String(f.log ?? '(无日志)')}`)
  if (step == null || t.length <= 10) return lines.join('\n')
  const lo = Math.max(0, step - 3), hi = Math.min(t.length, step + 4)
  const window = lines.slice(lo, hi)
  return `（聚焦第${step}步附近；完整轨迹共${t.length}步）\n` + window.join('\n')
}

// 实验的钉死要点（facts 的答案）—— 让助教也能答"概念"类问题，不止"第k步"。
function keyPoints(entry: CatalogEntry): string {
  const t = traceOf(entry)
  return entry.facts.map(f => {
    try { return `- ${f.label}：${f.compute(t as never).answer}` } catch { return `- ${f.label}` }
  }).join('\n')
}

const SYSTEM =
  '你是这个交互实验的**助教**，耐心、鼓励，像学长带学弟——但讲原理时严谨、不打太极。' +
  '下面给你该实验**引擎实际运行的逐步轨迹**和**钉死要点**（都是地面真值）。依据它们回答学生的问题：' +
  '解释「为什么这一步这样走」要引用轨迹里的具体数值/状态；问概念就用要点讲清。' +
  '若学生问得含糊或有误解，先温和点一句再讲透。**轨迹和要点里都找不到依据的，老实说「这个实验的轨迹里看不出来」**，不要编造、不要引入实验之外的假设。' +
  '面向考研 408 / 算法面试，讲清原理即可，简洁但别冷冰冰。'

export type AskOptions = { step?: number | null; factId?: string; principal?: Principal; useLLM?: boolean }

export async function askAboutExperiment(
  expId: string, question: string, opts: AskOptions = {},
): Promise<AskResult> {
  const entry = getEntry(expId)
  if (!entry) throw new Error(`未知实验：${expId}（可用：见 /cslab/ai/experiments）`)
  if (!question || !question.trim()) throw new Error('问题不能为空')
  // 点选常见疑问带来的 factId → 定位该 fact 的出处(step/evidence),既聚焦轨迹上下文、又给 citation chip
  let prov: { step: number; evidence: string } | undefined
  const fact = opts.factId ? entry.facts.find(f => f.id === opts.factId) : undefined
  if (fact) { try { const c = fact.compute(traceOf(entry) as never); prov = { step: c.step, evidence: c.evidence } } catch { /* ignore */ } }
  const step = opts.step ?? prov?.step ?? null
  const ctx = traceContext(entry, step)

  if (opts.useLLM === false) {
    // 无模型模式：把轨迹原样返回，证明 grounding 上下文本身就是可用的地面真值。
    return {
      expId, answer: `（未调用大模型）该实验「${entry.title}」的运行轨迹如下，答案就在其中：\n${ctx}`,
      grounding: { title: entry.title, step, frames: ctx.split('\n').length, usedTrace: ctx },
      billing: { metered: false, credits: 0, tokens: 0, note: '未调用大模型' },
    }
  }

  const prompt = `实验：${entry.title}\n===== 运行轨迹（依据）=====\n${ctx}\n===== 钉死要点（依据）=====\n${keyPoints(entry)}\n===== 依据结束 =====\n\n学生的问题：${question}`
  const r = await generate({
    module: 'lab_ai', task: 'ask', system: SYSTEM, prompt,
    maxTokens: 700, provider: 'minimax', principal: opts.principal ?? null,
  })
  return {
    expId, answer: r.text.trim(),
    grounding: { title: entry.title, step, frames: ctx.split('\n').length, usedTrace: ctx },
    ...(prov ? { provenance: prov } : {}),
    billing: r.billing,
  }
}
