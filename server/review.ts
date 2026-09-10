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
import { generate, QuotaRefused, type Principal, type Billing } from './llm.ts'

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
  '只依据轨迹，不编造。只输出 JSON 数组：[{"front":"…","back":"…"}, …]，不要多余文字。' +
  //  ⚠️ 这一句是补丁：模型写中文引文时爱用英文双引号（如 "当前最小即最终最小"），
  //     没转义就把 JSON 打断了 —— JSON.parse 抛错、卡片静默变空、钱照扣。
  //     下面的解析器已经容错，但从源头少产生一次总是更好。
  '值里**不要出现英文双引号**；要引用就用中文引号「」。'

/**
 * 从模型输出里抠出概念卡。
 *
 * ⚠️ **这里原来是 `catch { return [] }` —— 一个静默的洞。**
 * 模型写中文引文时爱用英文双引号（`"当前最小即最终最小"`），不转义就把 JSON 打断了：
 * `JSON.parse` 抛错 → 返回空数组 → 前端 `conceptCards.length > 0 &&` 整块不渲染 ——
 * **屏幕上不报错、不提示，用户只当没这功能，而这次调用的钱照扣。**
 * 实测 bpe 两次两次都空、dijkstra 一次一次就空（`stop_reason=end_turn`，不是截断）。
 *
 * 所以分两层：先按标准 JSON 解，解不动就用一个**容忍裸双引号**的抠法 ——
 * 靠 `","back":` 和 `"}` 这两个锚点定界，值里出现多少个 `"` 都不影响。
 * 两层都空才认输，而且**必须把原因打出来**：这类失败以前一句日志都没有。
 */
/** 判据用的导出口 —— 见 tests/review-cards.test.ts。解析逻辑只有这一份。 */
export const extractCardsForTest = (text: string): Card[] => extractCards(text)

function extractCards(text: string): Card[] {
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) { console.warn('[review] 概念卡：输出里找不到 JSON 数组'); return [] }
  const mk = (front: string, back: string): Card => ({ front, back, source: 'llm' as const })
  try {
    const arr = JSON.parse(m[0]) as { front?: unknown; back?: unknown }[]
    return arr.filter(c => c.front && c.back).map(c => mk(String(c.front), String(c.back)))
  } catch (e) {
    //  锚点定界：值一直取到 `","back":` / `"}` 之前，中间的裸双引号原样留在文本里
    const loose = [...m[0].matchAll(/\{\s*"front"\s*:\s*"([\s\S]*?)"\s*,\s*"back"\s*:\s*"([\s\S]*?)"\s*\}/g)]
      .map(x => mk(x[1].trim(), x[2].trim()))
      .filter(c => c.front && c.back)
    if (loose.length) {
      console.warn('[review] 概念卡：JSON 不合法（%s），用容错抠法救回 %d 张',
        (e as Error).message.slice(0, 60), loose.length)
      return loose
    }
    console.warn('[review] 概念卡：解析失败且救不回来（%s）；原文前 120 字：%s',
      (e as Error).message.slice(0, 60), m[0].slice(0, 120))
    return []
  }
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

  /**
   * ⚠️ **额度被拒必须原样抛出去，不能被 allSettled 吞掉。**
   *
   * `allSettled` 的本意是「一个失败不拖垮另一个」，那对模型抖动是对的。
   * 但 `QuotaRefused` 不是"这次调用失败"，是闸口明确说「你没额度了」——
   * 它被 settled 接住之后冒不到 index.ts 的 402 分支，于是复习**回 200**、
   * `billings` 是空的、`combineBilling([])` 给出 `metered:false`，
   * 前端落进兜底分支，屏幕上跳出 **「⚠️ 调用了大模型但没能计费」** ——
   * 可模型根本没调、一分没花。真正的额度提示被埋进正文。
   * 其余三个模式（出题/答疑/面试）都正确回 402，只有复习这条路两边不一致。
   *
   * 两次都被拒才算「没额度」；只有一次被拒（另一次成功）说明额度是够的，
   * 那次失败按普通失败处理，不该把整屏顶掉。
   */
  const refusals = [sumRes, cardRes]
    .filter(r => r.status === 'rejected')
    .map(r => (r as PromiseRejectedResult).reason)
    .filter(e => e instanceof QuotaRefused) as QuotaRefused[]
  if (refusals.length === 2) throw refusals[0]

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


/**
 * 复习一屏要发两次调用，账要合成一笔给用户看。两处坑：
 *
 * ① **note 不能用 Set 去重。** 两次调用的文案常常一模一样（都是「本次消耗 1 积分」），
 *    一去重就并成一条 —— `credits` 是 2，`note` 却说 1。界面用的是 credits 所以
 *    显示对了，错的是 API 字段本身；谁照着 note 对账谁踩坑。改成按合计重写一句。
 *
 * ② **游客那三个字段不能丢。** 原来只合并 metered/credits/tokens/note，
 *    `guest/used/limit` 被扔掉，于是游客在复习模式看不到「今日额度还剩 N 积分」，
 *    只有页眉胶囊在动 —— 同一屏，一个说话一个不说。其余三个模式都带着。
 */
function combineBilling(bs: Billing[]): Billing {
  if (bs.length === 0) return { metered: false, credits: 0, tokens: 0, note: '未接入积分' }
  const credits = bs.reduce((a, b) => a + b.credits, 0)
  const tokens = bs.reduce((a, b) => a + b.tokens, 0)
  const metered = bs.some(b => b.metered)
  //  游客那一格取最后一次的（used 是累计值，后一次更新）
  const g = bs.filter(b => b.guest).at(-1)
  const note = !metered
    ? [...new Set(bs.map(b => b.note))].join('；')          // 没计上费时保留原话（多是同一句提示）
    : g
      ? `本次消耗 ${credits} 积分（今日游客额度 ${g.used} / ${g.limit} 积分）`
      : `本次消耗 ${credits} 积分`
  const out: Billing = { metered, credits, tokens, note }
  return g ? { ...out, guest: true, used: g.used, limit: g.limit } : out
}
