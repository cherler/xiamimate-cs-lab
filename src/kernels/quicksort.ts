/**
 * 内核：快速排序 Quicksort（经典算法 · 分治：挑基准、分区、左右各自递归）
 * 轴：step —— 一次分区里的每一步扫描都是一帧，看基准怎么归位、区间怎么切
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本只有一组数 [5,2,8,1,9,3,7]、只有 Lomuto、只挑末元素当基准，
 * **从头到尾一切顺利**。而讲解卡里明明写着「挑得好不好是快排唯一的命门 —— 每次都挑到最小的，
 * 就退化成 n²」「std::sort 递归太深就切换成堆排序保底」—— 这两句话在屏幕上一次都没兑现过。
 * 只演成功的样子，等于没演。
 *
 * 这一版把三件事摆上来：
 *
 * ① **最坏情况就在手边，而且反直觉**：数据**已经排好序**时，末元素当基准的教科书快排
 *    退化成 O(n²)、递归深度 = n。"数据已经有序"是最慢的那一档 —— 这是快排最该记住的一件事。
 * ② **修法也在手边**：把「选基准」换成三数取中或随机，同一份有序数据立刻回到 O(n log n)。
 *    **命门和解药并排放着，才知道那句"实际实现会取三个数的中位数"是在躲什么。**
 * ③ **全相等数据是另一条独立的退化路径**，换基准救不了 —— 得换分区。三路分区（荷兰国旗）
 *    一趟把等于基准的全部锁定，比较次数从 n²/2 掉到 O(n)。
 *
 * 另外两样只有把数摆出来才看得见：
 * - **静默的规模验证**：同一档参数在 n=10/20/40/80/160 上各跑一遍（只计数、不出帧），
 *   把比较次数跟 n·log₂n 和 n(n−1)/2 并排 —— "退化成 n²"是量出来的，不是写上去的。
 * - **不稳定**：值相等的元素带着原始下标一起搬家，排完看它们的次序有没有被打乱。
 *   快排不稳定这句话，屏幕上看得见 3a 跑到 3b 后面。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const N_ANIM = 10

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const D_RANDOM = '随机打乱'
const D_SORTED = '已经排好序'
const D_REVERSE = '完全逆序'
const D_SAME = '全都一样'
const D_DUP = '大量重复（3 种值）'
export const QS_DATA = [D_RANDOM, D_SORTED, D_REVERSE, D_SAME, D_DUP] as const

const P_LAST = '末元素（教科书）'
const P_MED3 = '三数取中'
const P_RAND = '随机'
export const QS_PIVOTS = [P_LAST, P_MED3, P_RAND] as const

const Q_LOMUTO = 'Lomuto 两路'
const Q_THREE = '三路（等于基准的单独一堆）'
export const QS_PARTS = [Q_LOMUTO, Q_THREE] as const

/** 规模验证跑的这几个 n —— 只计数、不出帧 */
export const QS_SCALE_NS = [10, 20, 40, 80, 160] as const

/** 定死的伪随机：换台机器、换一次刷新，结果必须一模一样 */
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

/** 按档生成长度 n 的数据 */
function makeData(kind: string, n: number): number[] {
  if (kind === D_SORTED) return Array.from({ length: n }, (_, k) => k + 1)
  if (kind === D_REVERSE) return Array.from({ length: n }, (_, k) => n - k)
  if (kind === D_SAME) return new Array(n).fill(5)
  const r = rng(20260909 + n)
  if (kind === D_DUP) {
    //  只有 3 种值，随机排列 —— 等值元素多到能看出"稳不稳定"和"三路分区值不值"
    const a = Array.from({ length: n }, (_, k) => (k % 3) * 3 + 1)
    for (let k = n - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [a[k], a[j]] = [a[j], a[k]] }
    return a
  }
  const a = Array.from({ length: n }, (_, k) => k + 1)
  for (let k = n - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [a[k], a[j]] = [a[j], a[k]] }
  return a
}

// ═══════════════════════════════════════════════════════════════
//  排序本体：出帧和只计数走的是**同一份代码**
// ═══════════════════════════════════════════════════════════════

type Counts = { compares: number; swaps: number; maxDepth: number }

/**
 * 出一帧。⚠️ **运行计数由这里带出去，不能让外面自己数** ——
 * 第一版让调用方在 emit 里维护一份平行的计数，结果那份计数根本没跟上内部的 `c`
 * （比较发生在分支里、交换发生在 swap 里，外面看不见），只能是死代码。
 * 计数只有一个真源：`quicksort` 内部的 `c`，走到这一步是多少就带多少。
 */
type Emit = (act: string, info: {
  lo: number; hi: number; pivotVal: number; iPtr: number; jPtr: number; swapWith: number; log: string
}, c: Counts) => void

/**
 * 跑一遍快排。`emit` 给的话每一步出一帧，不给就只计数 —— 规模验证那几个 n 走的正是后者。
 * **两条路必须是同一份代码**：分开写的话，屏幕上演的和曲线上量的可以悄悄变成两个算法。
 */
function quicksort(
  values: number[], tags: number[], pivotRule: string, partRule: string,
  locked: boolean[], emit?: Emit,
): Counts {
  const a = values, t = tags
  const n = a.length
  const c: Counts = { compares: 0, swaps: 0, maxDepth: 0 }
  const r = rng(20260909 ^ n)
  const swap = (x: number, y: number) => {
    if (x === y) return
    ;[a[x], a[y]] = [a[y], a[x]]
    ;[t[x], t[y]] = [t[y], t[x]]
    c.swaps++
  }

  /** 挑基准并换到区间末尾（Lomuto 与三路都从末尾取，好比较） */
  const choosePivot = (lo: number, hi: number) => {
    if (pivotRule === P_MED3) {
      const mid = (lo + hi) >> 1
      //  三个数的中位数换到末尾。这 3 次比较也要计进去 —— 不然"三数取中更省"就是白捡的
      c.compares += 3
      const [x, y, z] = [a[lo], a[mid], a[hi]]
      const med = Math.max(Math.min(x, y), Math.min(Math.max(x, y), z))
      const at = a[lo] === med ? lo : a[mid] === med ? mid : hi
      swap(at, hi)
    } else if (pivotRule === P_RAND) {
      swap(lo + Math.floor(r() * (hi - lo + 1)), hi)
    }
    return a[hi]
  }

  const stack: [number, number, number][] = [[0, n - 1, 1]]
  while (stack.length) {
    const [lo, hi, depth] = stack.pop()!
    if (lo > hi) continue
    c.maxDepth = Math.max(c.maxDepth, depth)
    if (lo === hi) {
      locked[lo] = true
      emit?.('single', { lo, hi, pivotVal: -1, iPtr: -1, jPtr: lo, swapWith: -1,
        log: `区间只剩 1 个数（#${lo}=${a[lo]}）—— 天然有序，**直接归位**。` }, c)
      continue
    }
    const pivot = choosePivot(lo, hi)
    emit?.('pivot', { lo, hi, pivotVal: pivot, iPtr: lo - 1, jPtr: hi, swapWith: -1,
      log: `新区间 [${lo},${hi}]（长 ${hi - lo + 1}），按「${pivotRule}」挑出基准 **${pivot}**。` }, c)

    if (partRule === Q_THREE) {
      /*  三路分区（荷兰国旗）：小的甩左、大的甩右，**等于基准的全留中间并一次性锁定**。
          全相等数据上 Lomuto 会退化成 n²，而这里一趟就收工 —— 这一档换基准救不了、只能换分区。 */
      let lt = lo, i = lo, gt = hi
      while (i <= gt) {
        c.compares++
        if (a[i] < pivot) {
          swap(lt, i)
          emit?.('swap', { lo, hi, pivotVal: pivot, iPtr: lt, jPtr: i, swapWith: lt,
            log: `${a[lt]} < ${pivot} → 甩到左堆（#${lt}）。` }, c)
          lt++; i++
        } else {
          c.compares++
          if (a[i] > pivot) {
            swap(i, gt)
            emit?.('swap', { lo, hi, pivotVal: pivot, iPtr: lt, jPtr: i, swapWith: gt,
              log: `${a[gt]} > ${pivot} → 甩到右堆（#${gt}）。右边界收到 #${gt - 1}。` }, c)
            gt--
          } else {
            emit?.('keep', { lo, hi, pivotVal: pivot, iPtr: lt, jPtr: i, swapWith: -1,
              log: `${a[i]} = ${pivot} → **留在中间那堆**，不用再动它。` }, c)
            i++
          }
        }
      }
      for (let k = lt; k <= gt; k++) locked[k] = true
      emit?.('place', { lo, hi, pivotVal: pivot, iPtr: lt, jPtr: gt, swapWith: -1,
        log: `分区完：#${lt}~#${gt} 一共 **${gt - lt + 1}** 个都等于 ${pivot}，**一次全部归位**。` +
          `${gt - lt + 1 > 1 ? '两路分区一次只能定一个，这就是三路的全部好处。' : ''}` }, c)
      stack.push([gt + 1, hi, depth + 1])
      stack.push([lo, lt - 1, depth + 1])
    } else {
      let i = lo - 1
      for (let j = lo; j < hi; j++) {
        c.compares++
        if (a[j] < pivot) {
          i++
          const same = i === j
          swap(i, j)
          emit?.(same ? 'grow' : 'swap', { lo, hi, pivotVal: pivot, iPtr: i, jPtr: j, swapWith: same ? -1 : i,
            log: same ? `${a[i]} < ${pivot} → 本就在左区边界，原地并入，<区扩到 #${i}。`
              : `${a[i]} < ${pivot} → 换到左区，和 #${i} 交换。<区扩到 #${i}。` }, c)
        } else {
          emit?.('keep', { lo, hi, pivotVal: pivot, iPtr: i, jPtr: j, swapWith: -1,
            log: `${a[j]} ≥ ${pivot} → 不动，留在右边。` }, c)
        }
      }
      const p = i + 1
      swap(p, hi)
      locked[p] = true
      const leftLen = p - lo, rightLen = hi - p
      emit?.('place', { lo, hi, pivotVal: pivot, iPtr: i, jPtr: p, swapWith: hi,
        log: `扫描完：基准 ${pivot} 和分界位 #${p} 对调 → **归位**，此位永久锁定。` +
          `左段 ${leftLen} 个、右段 ${rightLen} 个。` +
          (leftLen === 0 || rightLen === 0
            ? `\n\n⚠️ **一边是空的** —— 这一趟只定下了 1 个数，问题规模只缩小了 1。这正是快排退化成 n² 的样子。`
            : '') }, c)
      stack.push([p + 1, hi, depth + 1])
      stack.push([lo, p - 1, depth + 1])
    }
  }
  return c
}

/** 只计数，不出帧 —— 规模验证用 */
function countOnly(kind: string, n: number, pivotRule: string, partRule: string): Counts {
  const a = makeData(kind, n)
  return quicksort(a, a.map((_, k) => k), pivotRule, partRule, new Array(n).fill(false))
}

// ═══════════════════════════════════════════════════════════════

export type ScaleRow = { n: number; compares: number; depth: number; nlogn: number; nsq: number }

export type QuickSortState = {
  i: number
  step: number
  arr: number[]
  /** 每个元素的原始下标 —— 值相等时用它看次序有没有被打乱（快排不稳定） */
  tags: number[]
  n: number
  lo: number; hi: number
  pivotVal: number
  iPtr: number
  jPtr: number
  swapWith: number
  act: string
  locked: boolean[]
  sortedCount: number
  /** 到这一步为止的比较 / 交换次数，以及最深递归 */
  compares: number
  swaps: number
  maxDepth: number
  dataKind: string
  pivotRule: string
  partRule: string
  /** 全程总计（末帧才有意义，但每帧都带着好写判据） */
  totalCompares: number
  totalDepth: number
  /** n·log₂n 与 n(n−1)/2，拿来跟实测比较次数对照 */
  nlogn: number
  nsq: number
  /** 实测增长指数：对 (log n, log 比较次数) 最小二乘的斜率。≈2 是 O(n²)，≈1.3 是 O(n log n) */
  slope: number
  /** 斜率 > 1.5，也就是这一档退化成了平方级 */
  degraded: boolean
  /** 规模验证：同一档参数在几个 n 上只计数跑一遍 */
  scale: ScaleRow[]
  /** 等值元素排完之后原始次序还在不在 */
  stable: boolean
  /** 有没有等值元素可判（全不同就无从谈起） */
  hasTies: boolean
  phase: 'run' | 'done'
  log: string
}

export const QUICKSORT_VISIBLE = [
  'step', 'arr', 'tags', 'n', 'lo', 'hi', 'pivotVal', 'iPtr', 'jPtr', 'swapWith', 'act', 'locked',
  'sortedCount', 'compares', 'swaps', 'maxDepth', 'dataKind', 'pivotRule', 'partRule',
  'totalCompares', 'totalDepth', 'nlogn', 'nsq', 'slope', 'degraded', 'scale', 'stable', 'hasTies', 'phase', 'log',
] as const

type Frame = Omit<QuickSortState, 'i'>

export const quicksortKernel: Kernel<QuickSortState> = {
  kind: 'quicksort',

  compile(doc: SimDocument): CompiledModel<QuickSortState> {
    const dataKind = String(doc.params.data ?? D_RANDOM)
    const pivotRule = String(doc.params.pivot ?? P_LAST)
    const partRule = String(doc.params.part ?? Q_LOMUTO)

    const init = makeData(dataKind, N_ANIM)
    const arr = init.slice()
    const tags = init.map((_, k) => k)
    const N = arr.length
    const locked = new Array(N).fill(false)

    const nlogn = +(N * Math.log2(N)).toFixed(1)
    const nsq = (N * (N - 1)) / 2

    //  规模验证先跑（只计数），好把整条曲线摆进每一帧
    const scale: ScaleRow[] = QS_SCALE_NS.map(n => {
      const c = countOnly(dataKind, n, pivotRule, partRule)
      return { n, compares: c.compares, depth: c.maxDepth, nlogn: +(n * Math.log2(n)).toFixed(1), nsq: (n * (n - 1)) / 2 }
    })

    //  全程总计也先跑一遍 —— 每一帧都带着它，读数不用等到最后才有数
    const totals = countOnly(dataKind, N_ANIM, pivotRule, partRule)
    const big = scale[scale.length - 1]
    /*  **实测增长指数**：对 (log n, log 比较次数) 做最小二乘，斜率就是"实际是几次方"。
        ≈2 是 O(n²)，≈1.3 是 O(n log n)（这一段 n 上 n·log₂n 的斜率就是 1.28），≈1 是线性。

        ⚠️ 别用"比较次数更贴 n²/2 还是更贴 n·log₂n"来判 —— 第一版就是这么写的，
        而「大量重复」那一档在 n=160 时是 4348，夹在 1171 和 12720 中间两头不靠，
        判出来是"退化"（对的，它确实是 Θ(n²)），可屏幕上跟着印一句"比较次数贴着 n(n−1)/2 走"
        —— 那是**假话**，差着三倍。斜率是量出来的，不用挑边站。 */
    const lx = scale.map(r => Math.log(r.n))
    const ly = scale.map(r => Math.log(Math.max(1, r.compares)))
    const mx = lx.reduce((a, b) => a + b, 0) / lx.length
    const my = ly.reduce((a, b) => a + b, 0) / ly.length
    const slope = +(lx.reduce((a, x, k) => a + (x - mx) * (ly[k] - my), 0)
      / lx.reduce((a, x) => a + (x - mx) ** 2, 0)).toFixed(2)
    const degraded = slope > 1.5

    const frames: Frame[] = []
    const shared = {
      n: N, dataKind, pivotRule, partRule,
      totalCompares: totals.compares, totalDepth: totals.maxDepth,
      nlogn, nsq, slope, degraded, scale,
    }
    /*  ⚠️ 帧里印的计数是**走完这一步之后**的数 —— `c` 由内核在比较/交换发生时当场更新，
        emit 拿到的就是新值。（「字段的时点」那条纪律：读状态字段先问它是这一步之前还是之后的。） */
    const counted = quicksort(arr, tags, pivotRule, partRule, locked, (act, info, c) => {
      frames.push({
        ...shared, step: frames.length, arr: arr.slice(), tags: tags.slice(),
        locked: locked.slice(), sortedCount: locked.filter(Boolean).length,
        compares: c.compares, swaps: c.swaps, maxDepth: c.maxDepth,
        act, ...info, stable: true, hasTies: false, phase: 'run',
      })
    })

    /*  等值元素的相对次序还在不在 —— 快排**不稳定**这句话的实测版。
        没有等值元素时这件事无从谈起（`hasTies` 为假），别硬报一个"稳定"。 */
    let hasTies = false, stable = true
    for (let k = 1; k < N; k++) {
      if (arr[k] === arr[k - 1]) { hasTies = true; if (tags[k] < tags[k - 1]) stable = false }
    }
    for (const fr of frames) { fr.stable = stable; fr.hasTies = hasTies }

    const dupNote = !hasTies ? ''
      : stable ? `\n\n这一档等值元素的原始次序**碰巧**没被打乱 —— 但那是运气，快排不保证。`
        : `\n\n**注意等值元素的角标**：排完之后它们的原始次序被打乱了。快排**不稳定** —— 按多关键字排序（先按成绩再按姓名）时这一点直接决定结果对不对。`

    frames.push({
      ...shared, step: frames.length, arr: arr.slice(), tags: tags.slice(),
      lo: 0, hi: N - 1, pivotVal: -1, iPtr: -1, jPtr: -1, swapWith: -1, act: 'done',
      locked: new Array(N).fill(true), sortedCount: N,
      compares: counted.compares, swaps: counted.swaps, maxDepth: counted.maxDepth,
      stable, hasTies, phase: 'done',
      log: `**排好了**：[${arr.join(',')}]。\n\n` +
        `n=${N} 一共比较 **${counted.compares}** 次、交换 ${counted.swaps} 次，最深递归 **${counted.maxDepth}** 层。` +
        `对照：n·log₂n = ${nlogn}，n(n−1)/2 = ${nsq}。\n\n` +
        (degraded
          ? `⚠️ **这一档退化了。** 规模表上 n 从 ${QS_SCALE_NS[0]} 涨到 ${big.n}，比较次数 ${scale[0].compares} → **${big.compares}**，` +
            `实测增长指数 **${slope.toFixed(2)}**（O(n log n) 在这一段是 1.28，O(n²) 是 2.0）—— 快排最引以为傲的那个"平均 O(n log n)"在这里不成立。\n\n` +
            `递归深度 ${counted.maxDepth} 层（理想是 log₂${N}≈${Math.log2(N).toFixed(1)} 层）：**规模再大一点就是爆栈**。` +
            `这也是 C++ std::sort 用 introsort 的理由 —— 快排打底，**递归太深就自动切换成堆排序保底**。\n\n` +
            `退化的原因看每一趟的「左段/右段」：**总有一边是空的**，一趟只定下 1 个数，问题规模只缩小 1。\n\n` +
            (pivotRule === P_LAST && dataKind !== D_SAME
              ? `**修法就在旁边**：把「选基准」换成三数取中或随机，同一份数据立刻回到 O(n log n)。这就是"实际实现会取首中尾三个数的中位数"在躲的东西。`
              : dataKind === D_SAME || dataKind === D_DUP
                ? `**这一档换基准救不了** —— 元素全都相等，挑哪个当基准都一样。得换**分区**：三路分区一趟把等于基准的全部锁定，比较次数从 n² 掉到 O(n)。`
                : `换一档「选基准」或「分区」再看。`)
          : slope <= 1.1
            ? `规模表上 n 从 ${QS_SCALE_NS[0]} 涨到 ${big.n}，比较次数 ${scale[0].compares} → ${big.compares}，实测增长指数 **${slope.toFixed(2)}** —— **线性**。\n\n` +
              `三路分区一趟就把等于基准的**整堆**锁定，递归只有 ${counted.maxDepth} 层。` +
              `这已经比"快排该有的样子"（n log n）还快 —— 因为这份数据里不同的值本来就没几个，排序要做的事本来就少。` +
              `**两路分区看不见这一点**，它一次只能定一个，于是把等值元素反复搬来搬去。`
            /*  ⚠️ 这一支原来只有一句"每趟把区间大致切成两半，深度 N 层接近 log₂n"，
                而三路分区在全相等数据上深度是 **1**、log₂10 是 3.3 —— 屏幕上直接印
                "深度 1 层接近 3.3"。判据全绿，是文案自己在说假话（"判据全绿也得把文案逐句念一遍"）。 */
            : `规模表上 n 从 ${QS_SCALE_NS[0]} 涨到 ${big.n}，比较次数 ${scale[0].compares} → ${big.compares}，实测增长指数 **${slope.toFixed(2)}**` +
              `（O(n log n) 在这一段是 1.28）—— 这才是快排该有的样子：每趟把区间大致切成两半，深度 ${counted.maxDepth} 层接近 log₂${N}≈${Math.log2(N).toFixed(1)}。`)
        + `\n\n那张规模表是**另外静默跑的**：同一档参数在 n=${QS_SCALE_NS.join('/')} 上各排一遍、只计数不出帧，` +
        `走的跟屏幕上这一趟是**同一份代码**。"退化成 n²"是那一列量出来的，不是写在这儿的。` +
        (partRule === Q_THREE
          ? `\n\n⚠️ 三路分区**每个元素最多比两次**（先问"小于吗"、不是再问"大于吗"），所以它的比较次数可以超过 n(n−1)/2 —— 两种分区的比较次数不是同一把尺，看增长指数才公平。`
          : '')
        + dupNote,
    })

    const base0: Frame = {
      ...shared, step: -1, arr: init.slice(), tags: init.map((_, k) => k),
      lo: 0, hi: N - 1, pivotVal: -1, iPtr: -1, jPtr: -1, swapWith: -1, act: '',
      locked: new Array(N).fill(false), sortedCount: 0,
      compares: 0, swaps: 0, maxDepth: 0, stable, hasTies, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '分区/归位' },
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
