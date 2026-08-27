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
import { getEntry, traceOf, type CatalogEntry } from './catalog.ts'
import { generate, type Principal } from './llm.ts'

export type AskResult = {
  expId: string
  answer: string
  grounding: { title: string; step: number | null; frames: number; usedTrace: string }
  billing: { metered: boolean; credits: number; tokens: number; note: string }
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

const SYSTEM =
  '你是这个交互实验的助教。下面给出的是该实验**引擎实际运行的逐步轨迹**（地面真值）。' +
  '只依据这段轨迹回答学生的问题：解释「为什么这一步这样走」时，要引用轨迹里的具体数值/状态。' +
  '轨迹里没有依据的，直接说「轨迹里看不出来」，不要编造、不要引入轨迹之外的假设。' +
  '面向考研 408 / 算法面试，讲清原理即可，简洁，不用寒暄。'

export type AskOptions = { step?: number | null; principal?: Principal; useLLM?: boolean }

export async function askAboutExperiment(
  expId: string, question: string, opts: AskOptions = {},
): Promise<AskResult> {
  const entry = getEntry(expId)
  if (!entry) throw new Error(`未知实验：${expId}（可用：见 /lab/ai/experiments）`)
  if (!question || !question.trim()) throw new Error('问题不能为空')
  const step = opts.step ?? null
  const ctx = traceContext(entry, step)

  if (opts.useLLM === false) {
    // 无模型模式：把轨迹原样返回，证明 grounding 上下文本身就是可用的地面真值。
    return {
      expId, answer: `（未调用大模型）该实验「${entry.title}」的运行轨迹如下，答案就在其中：\n${ctx}`,
      grounding: { title: entry.title, step, frames: ctx.split('\n').length, usedTrace: ctx },
      billing: { metered: false, credits: 0, tokens: 0, note: '未调用大模型' },
    }
  }

  const prompt = `实验：${entry.title}\n===== 运行轨迹（唯一依据）=====\n${ctx}\n===== 轨迹结束 =====\n\n学生的问题：${question}`
  const r = await generate({
    module: 'lab_ai', task: 'ask', system: SYSTEM, prompt,
    maxTokens: 700, provider: 'minimax', principal: opts.principal ?? null,
  })
  return {
    expId, answer: r.text.trim(),
    grounding: { title: entry.title, step, frames: ctx.split('\n').length, usedTrace: ctx },
    billing: r.billing,
  }
}
