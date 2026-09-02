/**
 * 会反驳的 AI 同学（辩论 / 抬杠，选择题版）—— AI 学伴的第五个模式,补「纠正同学的误解」这一关。
 *
 * AI 扮**一个爱抬杠的同学**,自信地抛出一个**其实错的**主张挑衅你;你从几个"反驳"里**选出能驳倒 TA 的那句**。
 * 选对 = 同学认输,选错 = 同学得意。比被动做选择题多一层"纠正他人误解"的框,主动性更强、又低摩擦(点选不打字)。
 *
 * 两处焊死(比手写版更硬):
 *   ① 同学坚持的"错误主张" = catalog fact 的**干扰项**(精心设计的似是而非,非大模型瞎编);
 *   ② 反驳选项 = **引擎钉死的正解 + 其它干扰项**,`correctIndex` 由引擎设定、大模型碰不到——
 *      判对错**不经大模型**(和「出题」一个口径),零判题幻觉。大模型只负责把同学那句主张说得像人话。
 */
import { getEntry, traceOf, type CatalogEntry, type Fact } from './catalog.ts'
import { generate, type Principal } from './llm.ts'

export type DebateResult = {
  expId: string
  factId: string
  claim: string              // 同学抛出的错误主张
  options: string[]          // 反驳选项(正解 + 其它干扰项),已打乱
  correctIndex: number       // 哪个选项是能驳倒 TA 的正解——引擎设定,大模型碰不到
  answer: string             // 正解文本(= options[correctIndex])
  provenance: { factId: string; label: string; step: number; evidence: string; phrasedBy: 'llm' | 'fallback' }
  billing: { metered: boolean; credits: number; tokens: number; note: string }
}

function shuffle<T>(xs: T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j]!, a[i]!] } return a }

// 优先选「选择题」fact——它的干扰项才是概念性误解
function pickFact(entry: CatalogEntry, factId?: string): Fact | null {
  if (factId) return entry.facts.find(f => f.id === factId) ?? null
  const choice = entry.facts.filter(f => f.kind === 'choice')
  const pool = choice.length ? choice : entry.facts
  return pool.length ? pool[Math.floor(Math.random() * pool.length)]! : null
}

const SYS_OPEN =
  '你是一个爱抬杠、但挺聪明的同学,正在和同学讨论一道题。下面给你【这道题在问什么】和【你要坚持的看法】(它其实是错的,但你此刻自信地相信、要把它当成你的主张抛出来挑战对方)。' +
  '用**一句**口语化的话,把这个看法当成你自己的主张说出来、顺带挑衅一下,像同学间抬杠。' +
  '**不要**承认它是错的、不要透露正确答案、不要给提示;**不要用"我反问你""反问你"这类口头禅**,直接把看法抛出来。只输出这一句。'

export type DebateOptions = { factId?: string; principal?: Principal; useLLM?: boolean }

export async function debate(expId: string, opts: DebateOptions = {}): Promise<DebateResult> {
  const entry = getEntry(expId)
  if (!entry) throw new Error(`未知实验：${expId}（可用：见 /lab/ai/experiments）`)
  const fact = pickFact(entry, opts.factId)
  if (!fact) throw new Error(`实验「${entry.title}」没有可辩论的知识点`)

  const t = traceOf(entry)
  let answer = '', step = 0, evidence = ''
  try { const c = fact.compute(t as never); answer = c.answer; step = c.step; evidence = c.evidence } catch { /* ignore */ }
  const distractors = (() => { try { return fact.distractors(answer, t as never) ?? [] } catch { return [] } })()
  const claimWrong = distractors[0] ?? '(某个常见误解)'          // 同学坚持的错误主张
  const wrongRebuttals = distractors.length > 1 ? distractors.slice(1) : distractors  // 其它干扰项当"错误反驳"
  const options = shuffle([answer, ...wrongRebuttals])
  const correctIndex = options.indexOf(answer)

  let claim: string, by: 'llm' | 'fallback' = 'fallback'
  if (opts.useLLM === false) {
    claim = `我觉得——${claimWrong}。不同意?`
  } else {
    try {
      const r = await generate({
        module: 'lab_ai', task: 'debate',
        system: SYS_OPEN,
        prompt: `实验：${entry.title}\n【这道题在问什么】${fact.label}\n【你要坚持的看法(其实是错的)】${claimWrong}\n\n把这个看法当成你的主张,一句话抛出来抬杠。`,
        maxTokens: 120, provider: 'minimax', principal: opts.principal ?? null,
      })
      claim = r.text.trim() || `我觉得——${claimWrong}。不同意?`
      by = r.text.trim() ? 'llm' : 'fallback'
      return { expId, factId: fact.id, claim, options, correctIndex, answer, provenance: { factId: fact.id, label: fact.label, step, evidence, phrasedBy: by }, billing: r.billing }
    } catch { claim = `我觉得——${claimWrong}。不同意?` }
  }
  return { expId, factId: fact.id, claim, options, correctIndex, answer, provenance: { factId: fact.id, label: fact.label, step, evidence, phrasedBy: by }, billing: { metered: false, credits: 0, tokens: 0, note: '未调用大模型' } }
}
