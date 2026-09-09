/**
 * 内核：二叉堆 Heap（经典算法 · 一棵"父永远 ≥ 子"的完全二叉树，堆顶永远是最大）
 * 轴：step —— 建堆、取堆顶、下沉复原
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本写死 7 个数、一种建法、只取一次堆顶。
 * 而它自己的注释里写着这句：
 *   「**建堆** = 从最后一个非叶节点起、倒着对每个节点 sift-down，**O(n)** 就能把乱序数组整成堆」
 * **O(n) 是这一屏最反直觉的一件事** —— 直觉上"整成堆"怎么也得 n log n。
 * 而屏幕上既没有第二种建法可比，也从没数过一次比较。**那句 O(n) 等于没讲。**
 *
 * 这一版：
 * ① **两种建法做成旋钮**：
 *    - **自底向上 sift-down（Floyd）**：从最后一个非叶节点倒着往前，每个都往下沉。**O(n)**。
 *    - **逐个插入 sift-up**：一个个 push 进去、每个都往上浮。**O(n log n)**。
 *    同一份数据、同一个堆，只差"从哪头开始"。
 *
 *    ⚠️ 实测之后发现比"O(n) vs O(n log n)"这句话**更有意思**：**差多少取决于数据形状**。
 *    - **升序输入**：n=512 时 **1006 vs 3595**（差 3.6 倍，指数 1.10 vs 1.35）——
 *      逐个插入时每个新元素都是当前最大，**一路浮到根**，最惨的一档。
 *    - **随机**：953 vs 1125（只差 1.18 倍）—— 渐进差别是真的，但常数把它盖住了大半。
 *    - **完全逆序**：511 vs 511，**一模一样** —— 降序输入本来就是个最大堆，插入一次都不浮。
 *
 *    所以屏幕上不写死"差 X 倍"，而是**按当前数据形状读那张表**。
 * ② **"堆不是排好序的"**：建完堆之后数组**不是有序的**，只有堆顶是最大。
 *    这是最常见的误解之一，屏幕上直接印"当前数组有序吗：否"。
 * ③ **堆排序**：把"取堆顶"反复做到底。总比较次数跟 n log₂n 并排。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const B_FLOYD = '自底向上 sift-down（Floyd）'
const B_INSERT = '逐个插入 sift-up'
export const HEAP_BUILDS = [B_FLOYD, B_INSERT] as const

const A_BUILD = '只建堆'
const A_ONE = '再取一次堆顶'
const A_SORT = '堆排序（全取完）'
export const HEAP_AFTERS = [A_BUILD, A_ONE, A_SORT] as const

const D_RANDOM = '随机打乱'
const D_SORTED = '已经排好序'
const D_REVERSE = '完全逆序'
export const HEAP_DATA = [D_RANDOM, D_SORTED, D_REVERSE] as const

export const HEAP_SCALE_NS = [8, 16, 32, 64, 128, 256, 512] as const

const N_ANIM = 12
/** 逐帧画得下的上限；超出只计数，屏幕上明说 */
const MAX_FRAMES = 95

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function makeData(kind: string, n: number): number[] {
  if (kind === D_SORTED) return Array.from({ length: n }, (_, k) => k + 1)
  if (kind === D_REVERSE) return Array.from({ length: n }, (_, k) => n - k)
  const r = rng(20260909 + n)
  const a = Array.from({ length: n }, (_, k) => k + 1)
  for (let k = n - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [a[k], a[j]] = [a[j], a[k]] }
  return a
}

// ═══════════════════════════════════════════════════════════════

type Counts = { compares: number; swaps: number; buildCompares: number; buildSwaps: number; arr: number[] }

type Emit = (info: {
  node: number; child: number; act: string; stage: string; heapN: number; sortedFrom: number; log: string
}, arr: number[], c: Counts) => void

/**
 * 建堆 + 可选的取堆顶 / 堆排序。`emit` 给了就出帧，不给就只计数 —— **同一份代码**。
 *
 * ⚠️ 比较次数把**每一次父子比较**都算上（挑较大孩子那一次也算），
 * 两种建法用的是同一把尺，否则"O(n) vs O(n log n)"根本比不了。
 */
function runHeap(src: number[], build: string, after: string, emit?: Emit): Counts {
  const a = src.slice()
  const n = a.length
  const c: Counts = { compares: 0, swaps: 0, buildCompares: 0, buildSwaps: 0, arr: [] }
  let heapN = 0

  const swap = (x: number, y: number) => { [a[x], a[y]] = [a[y], a[x]]; c.swaps++ }

  const siftDown = (root: number, size: number, stage: string) => {
    let i = root
    for (;;) {
      const l = 2 * i + 1, r = l + 1
      if (l >= size) break
      let big = l
      if (r < size) { c.compares++; if (a[r] > a[l]) big = r }
      c.compares++
      if (a[i] >= a[big]) {
        emit?.({ node: i, child: -1, act: 'settle', stage, heapN: size, sortedFrom: n - (n - size),
          log: `#${i}（${a[i]}）已经不小于孩子 ${a[big]} —— **到位**，不用再沉。` }, a, c)
        break
      }
      emit?.({ node: i, child: big, act: 'sift', stage, heapN: size, sortedFrom: n - (n - size),
        log: `#${i}（${a[i]}）比更大的那个孩子 #${big}（${a[big]}）小 → **交换、继续下沉**。` }, a, c)
      swap(i, big)
      i = big
    }
  }

  const siftUp = (start: number) => {
    let i = start
    while (i > 0) {
      const p = (i - 1) >> 1
      c.compares++
      if (a[p] >= a[i]) {
        emit?.({ node: i, child: p, act: 'settle', stage: 'build', heapN: i + 1, sortedFrom: n,
          log: `#${i}（${a[i]}）不大于父亲 #${p}（${a[p]}）—— **到位**，不用再浮。` }, a, c)
        break
      }
      emit?.({ node: i, child: p, act: 'sift', stage: 'build', heapN: i + 1, sortedFrom: n,
        log: `#${i}（${a[i]}）比父亲 #${p}（${a[p]}）大 → **交换、继续上浮**。` }, a, c)
      swap(i, p)
      i = p
    }
  }

  //  ── 建堆 ──
  if (build === B_FLOYD) {
    /*  自底向上：从最后一个非叶节点倒着往前，每个都 sift-down。
        **为什么是 O(n)**：越靠近叶子的节点越多，而它们能下沉的高度越小 ——
        Σ (每层节点数 × 该层高度) 收敛到 O(n)，不是 O(n log n)。 */
    heapN = n
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) siftDown(i, n, 'build')
  } else {
    //  逐个插入：一个个进堆、每个往上浮。每次上浮最多 log(当前堆大小)，加起来是 O(n log n)。
    for (let i = 0; i < n; i++) { heapN = i + 1; siftUp(i) }
    heapN = n
  }
  c.buildCompares = c.compares
  c.buildSwaps = c.swaps

  //  ── 取堆顶 ──
  const takes = after === A_ONE ? 1 : after === A_SORT ? n - 1 : 0
  for (let t = 0; t < takes; t++) {
    const size = n - t
    swap(0, size - 1)
    emit?.({ node: 0, child: size - 1, act: 'extract', stage: 'extract', heapN: size - 1, sortedFrom: size - 1,
      log: `**取堆顶**：把最大的 ${a[size - 1]} 跟末尾对调、堆缩小到 ${size - 1} —— 最大值就排到了数组尾。` }, a, c)
    siftDown(0, size - 1, 'extract')
  }
  c.arr = a.slice()
  return c
}

/** 对 (log n, log 比较次数) 做最小二乘 */
function slopeOf(rows: { n: number; compares: number }[]): number {
  const lx = rows.map(r => Math.log(r.n))
  const ly = rows.map(r => Math.log(Math.max(1, r.compares)))
  const mx = lx.reduce((a, b) => a + b, 0) / lx.length
  const my = ly.reduce((a, b) => a + b, 0) / ly.length
  return +(lx.reduce((a, x, k) => a + (x - mx) * (ly[k] - my), 0)
    / lx.reduce((a, x) => a + (x - mx) ** 2, 0)).toFixed(2)
}

// ═══════════════════════════════════════════════════════════════

export type HeapState = {
  i: number
  step: number
  arr: number[]
  heapN: number
  node: number
  child: number
  act: string
  stage: string
  sortedFrom: number
  build: string
  after: string
  dataKind: string
  n: number
  /** 到这一步为止的比较 / 交换次数 */
  compares: number
  swaps: number
  /** 建堆阶段的总计（全量精确） */
  buildCompares: number
  buildSwaps: number
  /** 全程总计 */
  totalCompares: number
  /** 建完堆之后数组是不是刚好有序 —— **常见误解：堆不是排好序的** */
  heapSorted: boolean
  /** 建完堆之后的数组（用来看"不是有序的"） */
  builtArr: number[]
  /** 两种建法在几个 n 上的建堆比较次数 + 增长指数 */
  buildSweep: { build: string; rows: { n: number; compares: number }[]; slope: number }[]
  nlogn: number
  drawn: number
  omitted: number
  phase: 'run' | 'done'
  log: string
}

export const HEAP_VISIBLE = [
  'step', 'arr', 'heapN', 'node', 'child', 'act', 'stage', 'sortedFrom',
  'build', 'after', 'dataKind', 'n', 'compares', 'swaps', 'buildCompares', 'buildSwaps',
  'totalCompares', 'heapSorted', 'builtArr', 'buildSweep', 'nlogn', 'drawn', 'omitted', 'phase', 'log',
] as const

type Frame = Omit<HeapState, 'i'>

export const heapKernel: Kernel<HeapState> = {
  kind: 'heap',

  compile(doc: SimDocument): CompiledModel<HeapState> {
    const build = String(doc.params.build ?? B_FLOYD)
    const after = String(doc.params.after ?? A_BUILD)
    const dataKind = String(doc.params.data ?? D_RANDOM)

    const init = makeData(dataKind, N_ANIM)
    const N = init.length
    const totals = runHeap(init, build, after)

    /*  ⭐ 两种建法各扫一遍。**"建堆是 O(n)"这句话就量在这两条曲线的斜率上。** */
    const buildSweep = HEAP_BUILDS.map(b => {
      const rows = HEAP_SCALE_NS.map(n => ({ n, compares: runHeap(makeData(dataKind, n), b, A_BUILD).buildCompares }))
      return { build: b, rows, slope: slopeOf(rows) }
    })

    /*  建完堆之后的数组（不含取堆顶）—— 拿它看"堆不是有序的"。
        ⚠️ 第一版是在 emit 回调里往外抄一份，而 **emit 是在交换之前调的** ——
        抄到的永远差一步，抄出来的数组**根本不满足堆序**（判据当场抓住：#2(1) < #5(6)）。
        真源只有 runHeap 内部那个 `a`，所以让它直接把最终数组返回出来。 */
    const builtArr = runHeap(init, build, A_BUILD).arr
    const heapSorted = builtArr.every((v, k) => k === 0 || builtArr[k - 1] <= v)

    const frames: Frame[] = []
    const shared = {
      build, after, dataKind, n: N,
      buildCompares: totals.buildCompares, buildSwaps: totals.buildSwaps,
      totalCompares: totals.compares, heapSorted, builtArr,
      buildSweep, nlogn: +(N * Math.log2(N)).toFixed(1), drawn: 0, omitted: 0,
    }

    runHeap(init, build, after, (info, arr, c) => {
      if (frames.length >= MAX_FRAMES) return
      frames.push({
        ...shared, step: frames.length, arr: arr.slice(),
        compares: c.compares, swaps: c.swaps,
        ...info, phase: 'run',
      })
    })
    const drawn = frames.length
    for (const f of frames) f.drawn = drawn

    const mine = buildSweep.find(x => x.build === build)!
    const other = buildSweep.find(x => x.build !== build)!
    const bigN = HEAP_SCALE_NS[HEAP_SCALE_NS.length - 1]
    const sweepText = buildSweep.map(x =>
      `${x.build}：n=${bigN} 时 ${x.rows[x.rows.length - 1].compares} 次比较，增长指数 **${x.slope.toFixed(2)}**`).join('\n')

    const lf = frames[frames.length - 1]
    frames.push({
      ...shared, step: frames.length,
      arr: lf ? lf.arr.slice() : init.slice(),
      heapN: after === A_SORT ? 0 : N, node: -1, child: -1, act: 'done', stage: 'done',
      sortedFrom: after === A_SORT ? 0 : N,
      compares: totals.compares, swaps: totals.swaps, drawn, omitted: 0, phase: 'done',
      log: `**走完了**（${dataKind}，${build}，${after}）：建堆用了 **${totals.buildCompares}** 次比较、${totals.buildSwaps} 次交换` +
        (after === A_BUILD ? '。' : `，全程共 **${totals.compares}** 次比较（对照 n·log₂n = ${(N * Math.log2(N)).toFixed(1)}）。`) + `\n\n` +
        `**① 建堆到底是 O(n) 还是 O(n log n)？** 两种建法各在 n=${HEAP_SCALE_NS.join('/')} 上扫一遍（只计数不出帧）：\n${sweepText}\n\n` +
        `自底向上（Floyd）的指数是 **${buildSweep[0].slope.toFixed(2)}** —— 线性；逐个插入是 **${buildSweep[1].slope.toFixed(2)}**。\n\n` +
        `为什么 Floyd 能是线性？**越靠近叶子的节点越多，而它们能下沉的高度越小**：一半的节点是叶子、根本不用沉，` +
        `四分之一只沉一层……加起来收敛到 O(n)。而逐个插入正好反过来 —— **越晚进来的越可能一路浮到根**。\n\n` +
        /*  ⚠️ **别写死"差 X 倍"。** 实测下来这个倍数**取决于数据形状**：
            升序差 3.6 倍、随机只差 1.18 倍、完全逆序**一模一样**（降序输入本来就是最大堆）。
            写死一个数在另外两档上就是假话，所以这里按当前那张表读。 */
        (() => {
          const a = mine.rows[mine.rows.length - 1].compares
          const b = other.rows[other.rows.length - 1].compares
          const ratio = Math.max(a, b) / Math.max(1, Math.min(a, b))
          return `在**这一档数据**（${dataKind}）上，n=${bigN} 时当前建法用 **${a}** 次、另一种用 **${b}** 次 —— ` +
            (ratio < 1.05
              ? `**几乎一模一样**。\n\n⚠️ 这不矛盾：**${dataKind}**恰好本来就是个最大堆，逐个插入时一次都不用上浮 —— ` +
                `渐进上的差别在这一档被数据"送"没了。**换成「已经排好序」再看，那才是逐个插入最惨的一档。**`
              : ratio < 1.5
                ? `差 **${ratio.toFixed(2)} 倍**。\n\n⚠️ 只差这么点，是因为**渐进差别真实存在、但常数把它盖住了大半**。` +
                  `**换成「已经排好序」再看** —— 那一档每个新元素都是当前最大、一路浮到根，差距会拉到 3 倍以上。`
                : `**差 ${ratio.toFixed(1)} 倍**。\n\n这一档正是逐个插入最惨的情形：**升序输入时每个新元素都是当前最大，一路浮到根**。` +
                  `换成「完全逆序」再看 —— 那一档两种建法**一模一样**，因为降序输入本来就是个最大堆。`)
        })() + `\n\n` +
        `**② 一个常见的误解：堆不是排好序的。** 建完堆之后数组是 [${builtArr.join(',')}] —— ` +
        (heapSorted
          ? `这一档**碰巧**是升序的 —— 但那是巧合，堆本身不保证这件事。`
          : `**它不是有序的**。堆只保证"每个父亲 ≥ 它的孩子"，也就是**只有堆顶是全体最大** —— ` +
            `兄弟之间、隔房的叔侄之间**完全没有大小关系**。`) + `\n\n` +
        `想要有序，得反复"取堆顶"：每取一次就把当前最大值换到数组尾、堆缩小一格 —— **那就是堆排序**。` +
        (after === A_SORT
          ? `\n\n这一档取完了：数组现在是 [${lf ? lf.arr.join(',') : ''}]，**有序**。全程 ${totals.compares} 次比较。`
          : `\n\n**把「之后做什么」换成「堆排序（全取完）」**再看。`),
    })
    //  画不下的部分（只有堆排序档才会超）
    const omitted = Math.max(0, totals.compares - drawn)
    for (const f of frames) f.omitted = drawn >= MAX_FRAMES ? omitted : 0

    const base0: Frame = {
      ...shared, step: -1, arr: init.slice(), heapN: N, node: -1, child: -1, act: '', stage: '',
      sortedFrom: N, compares: 0, swaps: 0, drawn, omitted: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '下沉 / 取顶' },
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
