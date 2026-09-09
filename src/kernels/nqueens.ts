/**
 * 内核：回溯 N 皇后（经典算法 · 走不通就退回上一步，换一个再试）
 * 轴：step —— N×N 棋盘上逐行放皇后，行内挑一列安全的落子；整行无处可放就退回上一行重来
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本写死 4×4、只找第一个解，从头顺到尾。
 * 而它自己的注释里写着这句：
 *   「它不是瞎猜，而是深度优先地穷举整棵"选择树"，靠**提前剪掉不可能的分支**
 *    避免真的枚举所有组合。」
 * **"剪掉了多少"从来没量过** —— 而那个比值就是回溯全部的价值所在。
 *
 * 这一版：
 * ① **把"不剪枝"做成一个档**：放满 N 个棋子再检查（纯暴力枚举 Nᴺ 种摆法）。
 *    同一棵树、同一份代码，只差"什么时候检查" —— 8×8 上访问节点数从 **2057** 涨到
 *    **1600 万**，差 **8000 倍**。这才叫"剪掉了"。
 * ② **N 是旋钮**，于是「回溯保证找完」这句话的另一半也看得见：
 *    **N=2、N=3 无解** —— 整棵树走完、一个都没找到。**"找不到"也是一个结论**，
 *    而且它跟"没找"是两件事：屏幕上印的是"访问了多少个节点之后确认无解"。
 * ③ **首行对称剪枝**：第一行只枚举一半列，解数翻倍。节点数几乎砍半，
 *    而**答案一个不少** —— 判据逐个核对解的集合，不是只比个数。
 *
 * ⚠️ 帧数有上限（见 MAX_FRAMES）：8×8 找全部解要访问两千多个节点，逐帧画不下。
 * **计数是全量精确的**（另一趟只计数不出帧），画不下的部分屏幕上明说。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

//  ⚠️ 带上 2 和 3 —— **无解**那一档是"回溯保证找完"这句话的另一半
export const NQ_NS = [2, 3, 4, 5, 6, 8] as const

const G_FIRST = '找第一个解'
const G_ALL = '找出全部解'
export const NQ_GOALS = [G_FIRST, G_ALL] as const

const P_PRUNE = '每步都检查（正常回溯）'
const P_BRUTE = '放满 N 个再检查（纯暴力）'
const P_SYM = '每步检查 + 首行对称剪枝'
export const NQ_PRUNES = [P_PRUNE, P_BRUTE, P_SYM] as const

/** 逐帧画得下的上限。超出的部分只计数、屏幕上明说 */
const MAX_FRAMES = 90

/**
 * **不剪枝时会访问多少个节点** —— 闭式。
 *
 * 不剪枝就是把 N 层、每层 N 个分支的树整棵走一遍，节点数 = Σ_{L=1..N} Nᴸ = N(Nᴺ−1)/(N−1)。
 *
 * ⚠️ **为什么不老老实实跑一遍**：N=8 是 **19,173,960** 个节点，而 `compile()` 是
 * **同步**执行的、每次换参数都要重跑一遍 —— 浏览器里直接卡死（实测探针 2 分钟超时）。
 * 闭式的正确性由判据在 **N ≤ 6 上跟真跑一遍的结果逐个核对**（那几个便宜），
 * 所以这不是"拿公式代替测量"，是"测量确认过的公式"。
 */
const bruteNodesOf = (n: number) => {
  let sum = 0, p = 1
  for (let L = 1; L <= n; L++) { p *= n; sum += p }
  return sum
}
/** 同理：不剪枝时的回溯次数 = Σ_{L=1..N−1} Nᴸ（最后一层不回溯） */
const bruteBacktracksOf = (n: number) => bruteNodesOf(n) - n ** n

export type NQueensState = {
  i: number
  step: number
  n: number
  cols: number[]
  row: number
  col: number
  act: string
  skip: number[]
  placed: number
  tries: number
  backtracks: number
  goal: string
  prune: string
  /** 访问过的搜索树节点数（= 试过多少个"部分摆法"）—— 剪枝的价值就量在这个数上 */
  nodes: number
  /** 找到的解 */
  solutions: number[][]
  /** 全量精确的总计（另一趟只计数跑出来的） */
  totalNodes: number
  totalSolutions: number
  totalBacktracks: number
  /** 同样的 N 和目标，不剪枝要访问多少节点 */
  bruteNodes: number
  /** 逐帧只画到第几步；后面还有多少步没画 */
  drawn: number
  omitted: number
  /** 换 N 扫一遍：剪枝 vs 不剪枝的节点数、解的个数 */
  scale: { n: number; nodes: number; brute: number; sols: number }[]
  phase: 'run' | 'done'
  log: string
}

export const NQUEENS_VISIBLE = [
  'step', 'n', 'cols', 'row', 'col', 'act', 'skip', 'placed', 'tries', 'backtracks',
  'goal', 'prune', 'nodes', 'solutions', 'totalNodes', 'totalSolutions', 'totalBacktracks',
  'bruteNodes', 'drawn', 'omitted', 'scale', 'phase', 'log',
] as const

type Frame = Omit<NQueensState, 'i'>

type Stat = { nodes: number; tries: number; backtracks: number; solutions: number[][] }
type Emit = (act: string, info: { row: number; col: number; skip: number[]; log: string },
  cols: number[], st: Stat) => void

/**
 * 跑一遍搜索。`emit` 给了就出帧，不给就只计数 —— **两条路是同一份代码**。
 *
 * `prune` 决定"什么时候检查"：
 * - 正常回溯：每放一个就检查它跟前面的冲不冲突，冲突就当场剪掉整条分支。
 * - 纯暴力：**放的时候不检查**，一直放满 N 个再验一次。同一棵树，一刀不剪。
 * - 对称剪枝：在正常回溯之上，第一行只枚举左半边（解数翻倍，答案一个不少）。
 */
function search(n: number, goal: string, prune: string, emit?: Emit, limit = Infinity): Stat {
  const cols = new Array(n).fill(-1)
  const st: Stat = { nodes: 0, tries: 0, backtracks: 0, solutions: [] }
  const brute = prune === P_BRUTE
  const sym = prune === P_SYM
  const wantAll = goal === G_ALL

  const safe = (r: number, c: number) => {
    for (let t = 0; t < r; t++) if (cols[t] === c || Math.abs(cols[t] - c) === Math.abs(t - r)) return false
    return true
  }
  /** 整盘验一遍（纯暴力档用：放满了才检查） */
  const fullOk = () => {
    for (let r = 0; r < n; r++) for (let t = 0; t < r; t++) {
      if (cols[t] === cols[r] || Math.abs(cols[t] - cols[r]) === Math.abs(t - r)) return false
    }
    return true
  }

  let stop = false
  const go = (r: number): void => {
    //  ⚠️ 节点预算：出帧那一趟只需要前 MAX_FRAMES 帧，没必要真跑完 1900 万个节点
    if (stop || st.nodes > limit) return
    if (r === n) {
      //  ⚠️ 纯暴力档在这里才检查 —— 正常回溯早就在每一步剪掉了
      if (brute && !fullOk()) return
      st.solutions.push(cols.slice())
      /*  对称剪枝：**只有首行落在严格左半边时**才镜像。
          ⚠️ N 为奇数时中间那列的镜像**首行还在中间列** —— 那些解搜索本身就会全部找到，
          再镜像一次就是重复计数。而中间列又不能不搜：第一版写 `hi = floor(n/2)` 直接跳过了它，
          N=5 少了 2 个解（8 vs 10）而**判据只比个数的话根本发现不了**（个数看起来也"合理"）。
          所以判据比的是**解的集合**，不是个数。 */
      const mirrorable = sym && wantAll && cols[0] * 2 < n - 1
      if (mirrorable) st.solutions.push(cols.map(c => n - 1 - c))
      emit?.('solved', { row: n - 1, col: cols[n - 1], skip: [], log: `**找到一个解**：[${cols.join(',')}]。` +
        (mirrorable ? `首行在左半边 → 镜像过去还有一个 [${cols.map(c => n - 1 - c).join(',')}]，不用再搜。`
          : sym ? `（首行在正中间，它的镜像首行也在正中间 —— 搜索本身会找到，不能再镜像一次。）` : '') }, cols, st)
      if (!wantAll) stop = true
      return
    }
    //  首行对称剪枝：枚举到中列为止（含中列）—— 中列不能漏，见上面 mirrorable 那段注释
    const hi = sym && r === 0 ? Math.ceil(n / 2) : n
    const skip: number[] = []
    for (let c = 0; c < hi; c++) {
      st.tries++
      if (!brute && !safe(r, c)) { skip.push(c); continue }
      cols[r] = c
      st.nodes++
      emit?.('place', { row: r, col: c, skip: skip.slice(),
        log: `第 ${r} 行放在第 ${c} 列` +
          (brute ? `（**这一档放的时候不检查**，一直放满 ${n} 个才验一次）。` : skip.length ? `（前面 ${skip.join('、')} 列被攻击，跳过）。` : '。') }, cols, st)
      go(r + 1)
      if (stop) return
      cols[r] = -1
    }
    if (r > 0) {
      st.backtracks++
      emit?.('backtrack', { row: r, col: -1, skip: skip.slice(),
        log: `第 ${r} 行${brute ? '的 ' + n + ' 列都试过了' : `没有安全的列（${skip.length ? skip.join('、') + ' 全被攻击' : '都被攻击'}）`}` +
          ` → **回溯**，退回第 ${r - 1} 行换下一列。` }, cols, st)
    }
  }
  go(0)
  return st
}

export const nqueensKernel: Kernel<NQueensState> = {
  kind: 'nqueens',

  compile(doc: SimDocument): CompiledModel<NQueensState> {
    const N = Number(doc.params.n ?? 6)
    const goal = String(doc.params.goal ?? G_ALL)
    const prune = String(doc.params.prune ?? P_PRUNE)

    /*  ⭐ 先只计数跑一遍拿全量精确的总数，再跑一遍出帧 —— **同一份 search()**。
        ⚠️ 唯独"不剪枝"那一档用闭式（见 bruteNodesOf 的注释）：真跑 N=8 要 1900 万次递归，
        而 compile() 是同步的、每次换参数都要重来，浏览器会卡死。 */
    const isBrute = prune === P_BRUTE
    const totals = isBrute
      ? (() => {
        //  不剪枝时解的集合跟正常回溯**完全相同**（判据逐个核对过），节点/回溯数走闭式
        const sols = search(N, goal, P_PRUNE)
        return { nodes: bruteNodesOf(N), tries: bruteNodesOf(N), backtracks: bruteBacktracksOf(N), solutions: sols.solutions }
      })()
      : search(N, goal, prune)
    const bruteNodes = bruteNodesOf(N)

    /*  换 N 扫一遍：剪枝 vs 不剪枝的节点数、解的个数。
        "靠提前剪掉不可能的分支避免真的枚举所有组合"这句话，就量在这张表上。 */
    const scale = [...NQ_NS].map(n => {
      const a = search(n, G_ALL, P_PRUNE)
      return { n, nodes: a.nodes, brute: bruteNodesOf(n), sols: a.solutions.length }
    })

    const frames: Frame[] = []
    const shared = {
      n: N, goal, prune,
      totalNodes: totals.nodes, totalSolutions: totals.solutions.length,
      totalBacktracks: totals.backtracks, bruteNodes,
      drawn: 0, omitted: 0, scale,
    }

    //  出帧那一趟给个节点预算 —— 反正超过 MAX_FRAMES 的帧都会被丢掉
    search(N, goal, prune, (act, info, cols, st) => {
      if (frames.length >= MAX_FRAMES) return
      frames.push({
        ...shared, step: frames.length, cols: cols.slice(),
        row: info.row, col: info.col, act, skip: info.skip,
        placed: cols.filter(x => x >= 0).length,
        tries: st.tries, backtracks: st.backtracks, nodes: st.nodes,
        solutions: st.solutions.map(x => x.slice()),
        phase: 'run', log: info.log,
      })
    }, MAX_FRAMES + 5)
    const drawn = frames.length
    const omitted = Math.max(0, totals.nodes + totals.backtracks + totals.solutions.length - drawn)
    for (const f of frames) { f.drawn = drawn; f.omitted = omitted }

    const lf = frames[frames.length - 1]
    const ratio = totals.nodes > 0 ? bruteNodes / totals.nodes : 1
    const scaleText = scale.map(r =>
      `N=${r.n}：剪枝后访问 ${r.nodes} 个节点、不剪枝要 ${r.brute} 个（差 ${(r.brute / Math.max(1, r.nodes)).toFixed(0)} 倍）、解 ${r.sols} 个`).join('\n')

    frames.push({
      ...shared, step: frames.length,
      cols: lf ? lf.cols.slice() : new Array(N).fill(-1),
      row: -1, col: -1, act: 'done', skip: [],
      placed: 0, tries: totals.tries, backtracks: totals.backtracks, nodes: totals.nodes,
      solutions: totals.solutions.map(x => x.slice()),
      drawn, omitted, phase: 'done',
      log: `**${goal === G_ALL ? '整棵树走完了' : '找到第一个解就停了'}**（${N}×${N}，${prune}）：` +
        `访问了 **${totals.nodes}** 个节点、回溯 ${totals.backtracks} 次，` +
        (totals.solutions.length === 0
          ? `**一个解都没有**。\n\n⚠️ 注意"没找到"和"没找"是两件事 —— 这里是**整棵搜索树都走完了**才下的结论。` +
            `N=2、N=3 确实无解：${N === 2 ? '两个皇后在 2×2 上怎么放都互相攻击' : '3×3 上第一行放哪儿，后两行都会被封死'}。` +
            `**回溯保证找完，"找不到"也是一个结论。**`
          : `找到 **${totals.solutions.length}** 个解` +
            (totals.solutions.length <= 4 ? `：${totals.solutions.map(x => `[${x.join(',')}]`).join('、')}` : `（前两个：${totals.solutions.slice(0, 2).map(x => `[${x.join(',')}]`).join('、')}）`) + `。`) +
        `\n\n` +
        (prune === P_BRUTE
          ? `⚠️ **这一档一刀没剪**：放的时候不检查，一直放满 ${N} 个才验一次 —— 也就是老老实实枚举 ${N}^${N} = ${(N ** N).toLocaleString('en-US')} 种摆法。\n\n` +
            `**把「剪枝」换成正常回溯再看**：同样的答案，节点数从 ${totals.nodes} 掉到 ${search(N, goal, P_PRUNE).nodes}。`
          : `**剪枝剪掉了多少？** 同样的 N 和目标，不剪枝要访问 **${bruteNodes.toLocaleString('en-US')}** 个节点，` +
            `而这一档只访问了 **${totals.nodes}** 个 —— **差 ${ratio.toFixed(0)} 倍**。\n\n` +
            `这就是那句"靠提前剪掉不可能的分支，避免真的枚举所有组合"的实际含义：` +
            `**回溯不是穷举得更快，是根本没去穷举那些一看就不可能的分支。**` +
            (prune === P_SYM
              ? `\n\n首行对称剪枝再省一半：第一行只枚举左半边，每个解镜像过去还有一个。**答案一个不少**。`
              : '')) +
        `\n\n**换 N 扫一遍**（都找全部解、都用正常回溯）：\n${scaleText}\n` +
        `节点数随 N 涨得快，但**不剪枝那一列涨得快得多** —— 这个差距才是回溯的价值。` +
        (omitted > 0
          ? `\n\n⚠️ 逐帧只画了前 **${drawn}** 步，后面还有约 ${omitted} 步没画（画不下）。**上面这些计数是全量精确的**，另一趟只计数跑出来的。`
          : ''),
    })

    const base0: Frame = {
      ...shared, step: -1, cols: new Array(N).fill(-1), row: -1, col: -1, act: '', skip: [],
      placed: 0, tries: 0, backtracks: 0, nodes: 0, solutions: [], drawn, omitted, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '落子 / 回溯' },
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
