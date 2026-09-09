/**
 * 内核：Engram / n-gram 记忆（大模型推理 · 用一张便宜的查表增强 Transformer）
 * 轴：识别 → 建表 → 查表 → 预测 → 结论
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本用的是一条**完美周期**序列 `A B C D A B C D A B C`、
 * n 写死成 3，于是**查表必然命中、预测必然对** —— 一次失败都演不出来。
 * 而它自己的正文里写着三句从没兑现过的话：
 *   ①「记忆**不受注意力窗口限制** —— 哪怕相关信息在几万 token 之前，只要那个 n-gram
 *     出现过就查得到」—— **没有窗口基线做对照**，这句话无从检验。
 *   ②「把'精确复制'从昂贵的注意力**卸载**到便宜的查表上」—— 屏幕上一个代价数都没有。
 *   ③「二者**互补**」—— 没有任何一档是"这个行那个不行"的。
 * 而且 **n-gram 最经典的那对毛病一次都没出现**：
 *   **表会 miss**（没见过的前缀）、**表会歧义**（同一个前缀后面跟过好几个不同的 token），
 *   而且 **n 越大越容易 miss、n 越小越容易歧义** —— 完美周期序列把这对权衡全绕过去了。
 *
 * 这一版：
 * ① **n 做成旋钮**（2/3/4/5），**序列也做成旋钮**（完美周期 / 带噪周期 / 自然一点的文本）。
 * ② **在整条序列上逐位置评测**，不是只看最后一个位置：命中率、歧义率、**预测准确率**。
 *    **n 越大越准但越容易 miss** 变成一张表。
 * ③ ⭐ **加一个"只看最近 W 个 token"的窗口基线** —— 那句"不受窗口限制"这才有了对照：
 *    远处出现过的 n-gram，查表拿得到、窗口基线拿不到。
 * ④ **代价上屏**：查表 O(1) vs 窗口内扫描 O(W)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const S_PERIOD = '完美周期（必然命中）'
const S_NOISY = '带噪周期（偶尔插一个别的）'
const S_TEXT = '自然一点的文本'
export const ENGRAM_SEQS = [S_PERIOD, S_NOISY, S_TEXT] as const
export const ENGRAM_NS = [2, 3, 4, 5] as const

/** 窗口基线只看最近 W 个 token —— 用来验"不受窗口限制"那句话 */
const WINDOW = 6

const SEQS: Record<string, string[]> = {
  [S_PERIOD]: 'A B C D A B C D A B C D A B C D A B C'.split(' '),
  //  周期里偶尔插一个别的 token —— 于是同一个前缀后面跟过不止一种东西（**歧义**）
  [S_NOISY]: 'A B C D A B X D A B C D A B C E A B C'.split(' '),
  //  自然一点：词有重复但没有严格周期 —— 于是**长前缀经常 miss**
  [S_TEXT]: '我 想 吃 饭 你 想 吃 面 他 想 喝 水 我 想 吃 面 你 想 吃'.split(' '),
}

const r3 = (x: number) => Math.round(x * 1000) / 1000

type Entry = { key: string; next: string; count: number }

/** 从 tokens[0..end) 建 n-gram 表 */
function buildTable(seq: string[], n: number, end: number) {
  const counts: Record<string, Record<string, number>> = {}
  for (let i = n - 1; i < end; i++) {
    const key = seq.slice(i - n + 1, i).join(' ')
    const nxt = seq[i]
    ;(counts[key] ??= {})[nxt] = (counts[key][nxt] || 0) + 1
  }
  return counts
}
const flatten = (counts: Record<string, Record<string, number>>): Entry[] => {
  const out: Entry[] = []
  for (const k in counts) for (const t in counts[k]) out.push({ key: k, next: t, count: counts[k][t] })
  return out
}
/** 查表：返回票数最高的那个 next，以及这个前缀后面**跟过几种**不同的 token（歧义度） */
function lookup(counts: Record<string, Record<string, number>>, key: string) {
  const cand = counts[key]
  if (!cand) return { hit: false, next: '', count: 0, variants: 0 }
  const ks = Object.keys(cand).sort((a, b) => cand[b] - cand[a])
  return { hit: true, next: ks[0], count: cand[ks[0]], variants: ks.length }
}

/**
 * ⭐ **窗口基线**：只准看最近 W 个 token。
 * 在窗口里找当前 (n−1)-gram **最近一次**出现，抄它后面那个。
 * 这就是"不受窗口限制"那句话的对照组 —— 远处的模式它够不着。
 */
function windowBaseline(seq: string[], n: number, at: number, w: number) {
  const key = seq.slice(at - n + 1, at).join(' ')
  const lo = Math.max(n - 1, at - w)
  for (let i = at - 1; i >= lo; i--) {
    if (seq.slice(i - n + 1, i).join(' ') === key) return { hit: true, next: seq[i], scanned: at - i }
  }
  return { hit: false, next: '', scanned: at - lo }
}

/**
 * ⭐ **逐位置评测**：对每个位置都用"它之前的历史"建表、预测、跟真实的下一个 token 比。
 * ⚠️ **不是只看最后一个位置** —— 老版本就是只看那一个，而那个位置在完美周期序列上必然对。
 */
function evaluate(seq: string[], n: number, w: number) {
  let hits = 0, amb = 0, right = 0, tot = 0
  let winHits = 0, winRight = 0, winScan = 0
  //  ⚠️ 从"表里至少能有一条"的位置开始；再早的位置没有历史可查，算进去只是拉低所有档
  for (let at = n; at < seq.length; at++) {
    tot++
    const counts = buildTable(seq, n, at)
    const r = lookup(counts, seq.slice(at - n + 1, at).join(' '))
    if (r.hit) { hits++; if (r.variants > 1) amb++; if (r.next === seq[at]) right++ }
    const wb = windowBaseline(seq, n, at, w)
    winScan += wb.scanned
    if (wb.hit) { winHits++; if (wb.next === seq[at]) winRight++ }
  }
  return {
    n, tot,
    hitRate: r3(hits / tot), ambRate: r3(hits ? amb / hits : 0), acc: r3(right / tot),
    winHitRate: r3(winHits / tot), winAcc: r3(winRight / tot), winScan: r3(winScan / tot),
  }
}

export type EvalRow = ReturnType<typeof evaluate>

export type EngramState = {
  i: number
  step: number
  seq: string[]
  seqName: string
  ngram: number
  window: number
  stage: 'id' | 'build' | 'lookup' | 'predict' | 'done'
  table: Entry[]
  queryKey: string
  hitKey: string
  prediction: string
  matchCount: number
  /** 这个前缀后面跟过几种不同的 token —— >1 就是**歧义** */
  variants: number
  /** 最后那个位置：查表命中了吗 */
  hit: boolean
  /** ⭐ 窗口基线在同一个位置上的结果 */
  winHit: boolean
  winPred: string
  /** ⭐ 逐位置评测：各档 n 的命中率 / 歧义率 / 准确率，以及窗口基线 */
  rows: EvalRow[]
  /** 当前档那一行 */
  row: EvalRow
  log: string
}

export const ENGRAM_VISIBLE = [
  'step', 'seq', 'seqName', 'ngram', 'window', 'stage', 'table', 'queryKey', 'hitKey',
  'prediction', 'matchCount', 'variants', 'hit', 'winHit', 'winPred', 'rows', 'row', 'log',
] as const

type Frame = Omit<EngramState, 'i'>

export const engramKernel: Kernel<EngramState> = {
  kind: 'engram',

  compile(doc: SimDocument): CompiledModel<EngramState> {
    const seqName = String(doc.params.seq ?? S_NOISY)
    const n = Number(doc.params.n ?? 3)
    const seq = SEQS[seqName] ?? SEQS[S_PERIOD]

    //  ⭐ 逐位置评测（各档 n）—— 不是只看最后一个位置
    const rows = ENGRAM_NS.map(k => evaluate(seq, k, WINDOW))
    const row = rows.find(r => r.n === n)!

    //  屏幕上走的这一趟：拿整条序列建表，预测"下一个"
    const counts = buildTable(seq, n, seq.length)
    const table = flatten(counts)
    const queryKey = seq.slice(-(n - 1)).join(' ')
    const r = lookup(counts, queryKey)
    const wb = windowBaseline([...seq, ''], n, seq.length, WINDOW)

    const shared = {
      seq, seqName, ngram: n, window: WINDOW, rows, row,
      variants: r.variants, hit: r.hit, winHit: wb.hit, winPred: wb.next,
    }
    const mk = (step: number, stage: EngramState['stage'], extra: Partial<Frame>, log: string): Frame => ({
      ...shared, step, stage, table: [], queryKey: '', hitKey: '', prediction: '', matchCount: 0, log, ...extra,
    })

    const frames: Frame[] = [
      mk(0, 'id', {}, `序列 **${seq.join(' ')}**（${seqName}），问下一个 token 是什么？\n\n`
        + `Engram 的办法：不靠注意力全局打分，而是查一张便宜的 **n-gram 记忆表**`
        + `（这一档 n=**${n}**：前 ${n - 1} 个 token → 下一个）。`),
      mk(1, 'build', { table }, `扫一遍序列建表，一共 **${table.length}** 条：`
        + table.slice(0, 8).map(e => `「${e.key}」→${e.next}(×${e.count})`).join('、')
        + (table.length > 8 ? `…` : '')
        + `\n\n这张表 **O(1) 可查**，而且**不受注意力窗口限制** —— 下一屏拿一个只看最近 ${WINDOW} 个 token 的基线来比。`),
      mk(2, 'lookup', { table, queryKey, hitKey: r.hit ? queryKey : '', matchCount: r.count },
        `取当前的 ${n - 1}-gram key =「**${queryKey}**」去表里 **O(1) 查** —— `
        + (r.hit
          ? `**命中**！它在历史里出现过 ${r.count} 次`
            + (r.variants > 1
              ? `，⚠️ **但后面跟过 ${r.variants} 种不同的 token（歧义）** —— 只能按票数挑一个。`
              : `，后面都跟着同一个 token。`)
          : `⚠️ **miss**：这个前缀从来没出现过。**n 越大越容易 miss。**`)),
      mk(3, 'predict', { table, queryKey, hitKey: r.hit ? queryKey : '', prediction: r.next, matchCount: r.count },
        r.hit
          ? `表里「${queryKey}」→ **${r.next}**（×${r.count}）→ 预测下一个 = **${r.next}**。一次查表搞定，没动用任何注意力打分。`
          : `查不到，**这一位 Engram 给不出预测** —— 得交回给注意力。`),
    ]

    //  ── 末帧：三张对照
    const best = rows.reduce((a, x) => (x.acc > a.acc ? x : a), rows[0])
    const gapRow = rows.reduce((a, x) => ((x.acc - x.winAcc) > (a.acc - a.winAcc) ? x : a), rows[0])
    frames.push({
      ...shared, step: 4, stage: 'done', table, queryKey, hitKey: r.hit ? queryKey : '',
      prediction: r.next, matchCount: r.count,
      log: `⚠️ **先说清楚老版本的问题**：它用的是一条**完美周期**序列、n 写死 3 —— `
        + `**查表必然命中、预测必然对，一次失败都演不出来**。而 n-gram 最经典的那对毛病`
        + `（**会 miss**、**会歧义**）恰恰全被那条序列绕过去了。\n\n`
        + `⭐ **① 在整条序列上逐位置评测**（每个位置都只拿"它之前"的历史建表）：\n`
        + rows.map(x => `　n=${x.n}：命中率 **${(x.hitRate * 100).toFixed(0)}%**`
          + `　命中里有歧义的 **${(x.ambRate * 100).toFixed(0)}%**`
          + `　→ 预测准确率 **${(x.acc * 100).toFixed(0)}%**`).join('\n')
        + `\n\n**n 越大越容易 miss、n 越小越容易歧义** —— 这一档序列上最好的是 **n=${best.n}（${(best.acc * 100).toFixed(0)}%）**。`
        + `**这对权衡是 n-gram 的老问题，老版本那条完美周期序列一点都看不出来。**\n\n`
        + `⭐ **② "不受注意力窗口限制"——拿一个只看最近 ${WINDOW} 个 token 的基线来比**：\n`
        + rows.map(x => `　n=${x.n}：查表准确率 **${(x.acc * 100).toFixed(0)}%** vs 窗口基线 **${(x.winAcc * 100).toFixed(0)}%**`
          + `（窗口命中率才 ${(x.winHitRate * 100).toFixed(0)}%）`).join('\n')
        /*  ⚠️ 完美周期那档窗口基线跟查表**一模一样**（周期只有 4，窗口 6 够得着）——
            那条序列根本演不出"不受窗口限制"。**量不到就说量不到。** */
        + (gapRow.acc - gapRow.winAcc > 0.05
          ? `\n\n差得最多的是 **n=${gapRow.n}**（${(gapRow.acc * 100).toFixed(0)}% vs ${(gapRow.winAcc * 100).toFixed(0)}%）。`
            + `**远处出现过的 n-gram，查表拿得到、窗口基线够不着** —— 这就是那句"不受窗口限制"的证据。\n\n`
          : `\n\n⚠️ **这一档两条线几乎一样齐** —— 因为这条序列的周期只有 4，`
            + `而窗口有 ${WINDOW} 个 token，**该抄的东西就在窗口里，查表没占到便宜**。\n\n`
            + `**所以"不受窗口限制"这句话，在这条序列上根本演不出来。** 这正是老版本的盲区：`
            + `它就用的这条完美周期序列。**换成「带噪周期」或「自然一点的文本」再看** —— 那时候相关的 n-gram`
            + `常常落在窗口之外，两条线才拉得开。\n\n`)
        + `⭐ **③ 代价**：查表是 **O(1)**（哈希一次）；窗口基线平均要往回扫 **${row.winScan.toFixed(1)}** 个位置，`
        + `而真正的注意力是 **O(N)**（每个 token 都要打一次分）。`
        + `**把"精确复制重复模式"从昂贵的注意力卸载到便宜的查表上**，说的就是这笔账。\n\n`
        + (r.hit
          ? `屏幕上这一趟：「${queryKey}」→ **${r.next}**`
            + (r.variants > 1 ? `（⚠️ 这个前缀后面跟过 ${r.variants} 种，按票数挑的）` : '')
          : `屏幕上这一趟 **miss 了** —— 得交回给注意力`)
        + `；同一位置窗口基线${wb.hit ? `给的是 **${wb.next}**` : `**够不着**`}。\n\n`
        + `它和**归纳头**目标像（都在回头找"上次它之后是什么"），但机制相反：`
        + `归纳头是**学出来的软注意力**、贵；Engram 是**显式非参数化查表**、便宜。`
        + `**而这一屏也让你看清了它便宜在哪、又贵在哪**：`
        + `它只会"照抄见过的"，一旦前缀没见过（miss）或者见过好几种（歧义），就得把活交回给注意力。`
        + `**这才是"二者互补"那句话的意思** —— 不是客套话，是分工。`,
    })

    const base0: Frame = mk(-1, 'id', {}, '')

    return {
      axis: { kind: 'step', label: '建表→查表→预测' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
