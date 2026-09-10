/**
 * 任务③：复习卡 + 总结（NotebookLM 的「闭卷 RAG」那一路，但源是引擎轨迹）。
 *
 * 产出一份复习包 = { summary, factCards, conceptCards }：
 *   factCards（钉死）  —— 直接复用 catalog 的可核算 facts：正面=问题，背面=**引擎算出的答案**。保证对。
 *   conceptCards（grounded）—— 大模型依据轨迹生成的概念问答，标注为模型生成，供理解用。
 *   summary（grounded）—— 大模型依据轨迹写的一段复习小结。
 *
 * 事实卡是我们独有的：闪卡的答案本身由验题机钉死，背错了都能当场对峙。
 */
import { getEntry, traceOf, type CatalogEntry } from './catalog.ts'
import { servableFacts, askWithData } from './quiz.ts'
import { generate, type Principal, type Billing } from './llm.ts'

export type Card = { front: string; back: string; source: 'engine' | 'llm' }
export type ReviewPack = {
  expId: string
  title: string
  summary: string
  factCards: Card[]
  conceptCards: Card[]
  billing: Billing
}

function traceText(entry: CatalogEntry): string {
  const t = traceOf(entry) as Record<string, unknown>[]
  return t.map((f, i) => `第${i}步：${String(f.log ?? '')}`).join('\n')
}

/*  钉死事实卡：正面=fact.ask，背面=引擎答案 + 出处。
    和出题走同一条纪律(servableFacts)：摘不出数据的计数题不做成卡片 ——
    「这个数组一共比较了多少次」印在卡片正面，翻过来看到一个数字，背了也没用。 */
function factCards(entry: CatalogEntry): Card[] {
  const t = traceOf(entry) as Record<string, unknown>[]
  return servableFacts(entry, t).map(f => {
    const { answer, evidence } = f.compute(t)
    return { front: askWithData(entry, f, t), back: `${answer}\n\n（引擎依据：${evidence.slice(0, 120)}）`, source: 'engine' as const }
  })
}

const SUMMARY_SYSTEM =
  '你是考研 408 / 算法面试的复习助教。下面是某实验**引擎实际运行的逐步轨迹**（地面真值）。' +
  '据此写一段 3~5 句的复习小结：这个算法在做什么、每步的核心不变量、为什么复杂度是这个量级。' +
  '只依据轨迹，不编造数字。直接给小结正文，不要标题、不要寒暄。'

const CARDS_SYSTEM =
  '你是复习卡片作者。下面是某实验引擎实际运行的逐步轨迹（地面真值）。' +
  '据此出 3 张**概念理解**闪卡（不是计算题，计算题另有来源），考查对原理/不变量/适用条件的理解。' +
  '只依据轨迹，不编造。只输出 JSON 数组：[{"front":"…","back":"…"}, …]，不要多余文字。'

function extractCards(text: string): Card[] {
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) return []
  try {
    const arr = JSON.parse(m[0]) as { front?: unknown; back?: unknown }[]
    return arr
      .filter(c => c.front && c.back)
      .map(c => ({ front: String(c.front), back: String(c.back), source: 'llm' as const }))
  } catch { return [] }
}

export type ReviewOptions = { principal?: Principal; useLLM?: boolean }

export async function buildReview(expId: string, opts: ReviewOptions = {}): Promise<ReviewPack> {
  const entry = getEntry(expId)
  if (!entry) throw new Error(`未知实验：${expId}（可用：见 /cslab/ai/experiments）`)
  const facts = factCards(entry)

  if (opts.useLLM === false) {
    return {
      expId, title: entry.title,
      summary: '（未调用大模型）', factCards: facts, conceptCards: [],
      billing: { metered: false, credits: 0, tokens: 0, note: '未调用大模型' },
    }
  }

  const ctx = traceText(entry)
  const base = `实验：${entry.title}\n===== 运行轨迹 =====\n${ctx}\n===== 轨迹结束 =====`
  // 小结与概念卡是两次**独立**调用——并行发,互不阻塞;allSettled 保证一个失败不拖垮另一个。
  const [sumRes, cardRes] = await Promise.allSettled([
    generate({
      module: 'lab_ai', task: 'summary', system: SUMMARY_SYSTEM,
      prompt: base + '\n\n请写复习小结。', maxTokens: 400, provider: 'minimax', principal: opts.principal ?? null,
    }),
    generate({
      module: 'lab_ai', task: 'cards', system: CARDS_SYSTEM,
      prompt: base + '\n\n请出 3 张概念卡。', maxTokens: 700, provider: 'minimax', principal: opts.principal ?? null,
    }),
  ])

  let summary: string
  let conceptCards: Card[] = []
  const billings: Billing[] = []
  if (sumRes.status === 'fulfilled') { summary = sumRes.value.text.trim(); billings.push(sumRes.value.billing) }
  else summary = `（小结生成失败：${(sumRes.reason as Error).message}）`
  if (cardRes.status === 'fulfilled') { conceptCards = extractCards(cardRes.value.text); billings.push(cardRes.value.billing) }
  else console.warn('[review] 概念卡生成失败:', (cardRes.reason as Error).message)

  // 两次调用都要计费:之前只记了小结那次,概念卡的 token 白漏了。
  return { expId, title: entry.title, summary, factCards: facts, conceptCards, billing: combineBilling(billings) }
}


function combineBilling(bs: Billing[]): Billing {
  if (bs.length === 0) return { metered: false, credits: 0, tokens: 0, note: '未接入积分' }
  return {
    metered: bs.some(b => b.metered),
    credits: bs.reduce((a, b) => a + b.credits, 0),
    tokens: bs.reduce((a, b) => a + b.tokens, 0),
    note: [...new Set(bs.map(b => b.note))].join('；'),
  }
}
