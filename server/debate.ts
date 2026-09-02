/**
 * 会反驳的 AI 同学（辩论 / 抬杠）—— AI 学伴的第五个模式,补「主动辩护」这一关。
 *
 * 和面试官(权威提问)不同,这里 AI 扮**一个爱抬杠的同学**:它自信地抛出一个**其实错的**看法(挑战你),
 * 逼你为正确答案辩护;你反驳,它嘴硬或认输,最后引擎揭晓正解 + 小结。主动辩护比被动选选择题记得牢。
 *
 * 焊死味在两处:
 *   ① 同学坚持的"错误看法" = catalog fact 的**干扰项(distractor)**——这些干扰项本就是精心设计的"似是而非的错",
 *      不是大模型自己瞎编的立场,所以误解真实、稳定、可复现;
 *   ② 判"你反驳得对不对"的地面真值 = fact 的**钉死答案(引擎算出)**——大模型只拿你的话去对照这个答案,
 *      「哪个对」永远由引擎裁,大模型只负责演同学 + 措辞。
 */
import { getEntry, traceOf, type CatalogEntry, type Fact } from './catalog.ts'
import { generate, type Principal } from './llm.ts'

export type DebateTurn = { role: 'classmate' | 'you'; text: string }
export type DebateResult = {
  expId: string
  factId: string
  reply: string
  round: number
  done: boolean
  provenance?: { factId: string; label: string; step: number; evidence: string }  // 收尾时给,供前端做 citation chip
  billing: { metered: boolean; credits: number; tokens: number; note: string }
}

const MAX_ROUNDS = 2   // 你反驳满 2 轮后,同学收尾揭晓正解

// 优先选「选择题」的 fact——它的干扰项才是概念性误解;没有则退而取任意有干扰项的
function pickFact(entry: CatalogEntry, factId?: string): Fact | null {
  if (factId) return entry.facts.find(f => f.id === factId) ?? null
  const choice = entry.facts.filter(f => f.kind === 'choice')
  const pool = choice.length ? choice : entry.facts
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]!
}

// 引擎给出:这道题问什么、正解、同学要坚持的错误看法、出处
function groundOf(entry: CatalogEntry, fact: Fact) {
  const t = traceOf(entry)
  let answer = '', step = 0, evidence = ''
  try { const c = fact.compute(t as never); answer = c.answer; step = c.step; evidence = c.evidence } catch { /* ignore */ }
  let wrong = ''
  try { wrong = (fact.distractors(answer, t as never) ?? [])[0] ?? '' } catch { /* ignore */ }
  return { answer, step, evidence, wrong }
}

const SYS_OPEN =
  '你是一个爱抬杠、但挺聪明的同学,正在和同学讨论一道题。下面给你【这道题在问什么】和【你要坚持的看法】(注意:这个看法其实是错的,但你此刻自信地相信它、要把它当成你的观点抛出来挑战对方)。' +
  '用**一句**口语化的话,把这个看法当成你自己的主张说出来、并反问对方同不同意,像同学之间抬杠那样。**不要**承认它是错的、不要透露正确答案、不要给提示。只输出这一句。'

function sysJudge(concluding: boolean): string {
  const base =
    '你还是那个爱抬杠的同学。下面给你【这道题的正确答案(地面真值,判对错只能依据它、不许自己臆断)】、【你之前坚持的错误看法】、以及【你俩的对话】。' +
    '针对对方**最后一次反驳**:先依据正确答案判断 TA 有没有驳到点子上——'
  if (concluding) {
    return base +
      '不管这轮如何,现在**收尾**:如果 TA 说对了就痛快认输(承认你那个看法错在哪),如果没说全就补上;然后用一两句**把正确答案讲清楚**当作和解。口语化、简短,像同学讨论完达成共识。'
  }
  return base +
    '如果 TA 驳到点上了,就半认输、但再追问一句往深里想;如果 TA 没说对,就再嘴硬半句、坚持你的看法逼 TA 说清楚。**别透露完整正确答案**(还没到收尾)。一句话,口语化,像抬杠。'
}

export type DebateOptions = { factId?: string; history?: DebateTurn[]; principal?: Principal; useLLM?: boolean }

export async function debate(expId: string, opts: DebateOptions = {}): Promise<DebateResult> {
  const entry = getEntry(expId)
  if (!entry) throw new Error(`未知实验：${expId}（可用：见 /lab/ai/experiments）`)
  const fact = pickFact(entry, opts.factId)
  if (!fact) throw new Error(`实验「${entry.title}」没有可辩论的知识点`)

  const history = opts.history ?? []
  const rebuttals = history.filter(h => h.role === 'you').length
  const first = rebuttals === 0 && history.length === 0
  const concluding = rebuttals >= MAX_ROUNDS
  const g = groundOf(entry, fact)
  const prov = { factId: fact.id, label: fact.label, step: g.step, evidence: g.evidence }

  if (opts.useLLM === false) {
    const reply = first
      ? `（未调用大模型）我觉得——${g.wrong || fact.label}。你同意不?`
      : concluding ? `（未调用大模型）行吧,正解是:${g.answer}` : '（未调用大模型)可我还是觉得我说的对。'
    return { expId, factId: fact.id, reply, round: rebuttals, done: concluding, ...(concluding ? { provenance: prov } : {}), billing: { metered: false, credits: 0, tokens: 0, note: '未调用大模型' } }
  }

  let system: string, prompt: string
  if (first) {
    system = SYS_OPEN
    prompt = `实验：${entry.title}\n【这道题在问什么】${fact.label}\n【你要坚持的看法(其实是错的)】${g.wrong || '(随便挑个常见误解)'}\n\n把这个看法当成你的主张,一句话抛出来抬杠。`
  } else {
    system = sysJudge(concluding)
    const convo = history.map(h => `${h.role === 'classmate' ? '同学' : '你'}：${h.text}`).join('\n')
    prompt = `实验：${entry.title}\n【这道题在问什么】${fact.label}\n【正确答案(地面真值)】${g.answer}\n【出处证据】${g.evidence}\n【你之前坚持的错误看法】${g.wrong}\n\n===== 对话 =====\n${convo}\n=====\n\n针对对方最后一次反驳,${concluding ? '收尾:认输/补全 + 把正确答案讲清楚' : '判断对错后再抬杠/追问一句'}。`
  }

  const r = await generate({ module: 'lab_ai', task: 'debate', system, prompt, maxTokens: 400, provider: 'minimax', principal: opts.principal ?? null })
  return { expId, factId: fact.id, reply: r.text.trim(), round: rebuttals, done: concluding, ...(concluding ? { provenance: prov } : {}), billing: r.billing }
}
