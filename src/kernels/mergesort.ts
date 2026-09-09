/**
 * 内核：归并排序 Merge Sort（经典算法 · 分到不能再分，再两两有序地合并回去）
 * 轴：step —— 自底向上，一轮轮把相邻两段归并成更长的有序段
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本一组 7 个互不相同的数、一种归并策略，从头顺到尾。
 * 而它自己的注释里写着三句话：
 *   「它**稳定**（相等元素不换序）」
 *   「最坏也稳稳 **O(n log n)**」
 *   「代价是要一块**额外缓冲区**」
 * 三句都没兑现：数据里**一个重复值都没有**（稳定性无从谈起）、
 * 没有第二种数据可比（"最坏也一样"无从谈起）、缓冲区从没被数过。
 *
 * 归并排序跟快排是**对照**关系，所以这一版特意跟快排那一屏用同一把尺：
 *
 * ① **「稳定」是一个字符的事，做成旋钮。** 归并里那一行 `left[i] <= right[j]`
 *    只要把 `<=` 改成 `<`，相等时就先取右段 —— 排序结果一模一样，**但稳定性没了**。
 *    屏幕上等值元素带 a/b/c 角标，一眼看得见 3a 跑到了 3b 后面。
 *    **课本里"归并排序是稳定的"这句话，稳的其实是这一个字符。**
 * ② **「最坏也一样」拿数据形状扫出来。** 四种数据 × 几个 n，比较次数几乎不动 ——
 *    而快排那一屏上同样的对照是 **1137 → 12720**（差 11 倍）。两屏并排才有意义。
 * ③ **「代价是额外空间」要数出来。** 缓冲区峰值逐帧记录：归并要 O(n)，
 *    而快排是原地的、只花 O(log n) 的递归栈。**这就是快排在实践中更常用的理由。**
 * ④ **自然归并**：先找出数据里**现成的有序段**再归并。已排好序的数据上，
 *    它只要 n−1 次比较就收工 —— 归并排序**能**利用有序性，只是教科书那版没利用。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const D_RANDOM = '随机打乱'
const D_SORTED = '已经排好序'
const D_REVERSE = '完全逆序'
const D_DUP = '大量重复（考稳定性）'
export const MS_DATA = [D_RANDOM, D_SORTED, D_REVERSE, D_DUP] as const

const T_LEFT = '相等时取左段（≤，稳定）'
const T_RIGHT = '相等时取右段（<，不稳定）'
export const MS_TIES = [T_LEFT, T_RIGHT] as const

const P_POW2 = '固定倍增（1→2→4…）'
const P_NATURAL = '自然归并（先找现成的有序段）'
export const MS_PASSES = [P_POW2, P_NATURAL] as const

export const MS_SCALE_NS = [8, 16, 32, 64, 128] as const

const N_ANIM = 12

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function makeData(kind: string, n: number): number[] {
  if (kind === D_SORTED) return Array.from({ length: n }, (_, k) => k + 1)
  if (kind === D_REVERSE) return Array.from({ length: n }, (_, k) => n - k)
  const r = rng(20260909 + n)
  if (kind === D_DUP) {
    //  只有 4 种值 —— 等值元素多到能一眼看出"稳不稳定"
    const a = Array.from({ length: n }, (_, k) => (k % 4) * 2 + 1)
    for (let k = n - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [a[k], a[j]] = [a[j], a[k]] }
    return a
  }
  const a = Array.from({ length: n }, (_, k) => k + 1)
  for (let k = n - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [a[k], a[j]] = [a[j], a[k]] }
  return a
}

// ═══════════════════════════════════════════════════════════════
//  归并本体：出帧和只计数走的是同一份代码
// ═══════════════════════════════════════════════════════════════

type Counts = { compares: number; moves: number; bufPeak: number; passes: number }

type Emit = (info: {
  width: number; lo: number; mid: number; hi: number; li: number; rj: number
  out: number[]; took: number; from: string; focus: number; act: string; log: string
}, c: Counts, arr: number[], tags: number[]) => void

/**
 * 跑一遍归并排序。`emit` 给了就出帧，不给就只计数。
 * **两条路必须是同一份代码** —— 分开写的话，屏幕上演的和曲线上量的可以悄悄变成两个算法。
 */
function mergesort(
  a: number[], t: number[], tie: string, pass: string, emit?: Emit,
): Counts {
  const n = a.length
  const c: Counts = { compares: 0, moves: 0, bufPeak: 0, passes: 0 }
  const preferLeft = tie === T_LEFT

  /** 把 [lo,mid) 与 [mid,hi) 归并成一段 */
  const mergeOne = (lo: number, mid: number, hi: number, width: number) => {
    const left = a.slice(lo, mid), right = a.slice(mid, hi)
    const lt = t.slice(lo, mid), rt = t.slice(mid, hi)
    let i = 0, j = 0
    const out: number[] = [], outT: number[] = []
    //  ⚠️ 缓冲区峰值：归并要**额外**一块跟当前段一样大的地方。快排是原地的，这一栏它是 0。
    c.bufPeak = Math.max(c.bufPeak, left.length + right.length)

    const take = (val: number, tag: number, from: string, focus: number, act: string) => {
      out.push(val); outT.push(tag); c.moves++
      emit?.({
        width, lo, mid, hi, li: lo + i, rj: mid + j, out: out.slice(), took: val, from, focus, act,
        log: (from === 'L' ? `左段队首 ${val}` : `右段队首 ${val}`) +
          (act === 'drain'
            ? ` —— 另一段空了，${from === 'L' ? '左' : '右'}段剩下的直接接上（**不用再比**）。`
            : ` ${from === 'L' ? (preferLeft ? '≤' : '<') : (preferLeft ? '<' : '≤')} 另一段队首 → **取小的**放进输出。`),
      }, c, a, t)
    }
    while (i < left.length && j < right.length) {
      c.compares++
      /*  ⭐ **稳定性就在这一个字符上。**
          `preferLeft`（`<=`）：相等时先取**左**段 —— 左段在原数组里本来就在前面，原序保住。
          否则（`<`）：相等时先取**右**段 —— 结果照样有序，**但等值元素的原序被打乱了**。 */
      const takeLeft = preferLeft ? left[i] <= right[j] : left[i] < right[j]
      if (takeLeft) { take(left[i], lt[i], 'L', lo + i, 'emit'); i++ }
      else { take(right[j], rt[j], 'R', mid + j, 'emit'); j++ }
    }
    while (i < left.length) { take(left[i], lt[i], 'L', lo + i, 'drain'); i++ }
    while (j < right.length) { take(right[j], rt[j], 'R', mid + j, 'drain'); j++ }
    for (let k = 0; k < out.length; k++) { a[lo + k] = out[k]; t[lo + k] = outT[k] }
    emit?.({
      width, lo, mid, hi, li: mid, rj: hi, out: out.slice(), took: -1, from: '', focus: -1, act: 'merged',
      log: `两段归并完成 → [${out.join(',')}]。宽 ${mid - lo} + 宽 ${hi - mid} 拼成了宽 ${out.length} 的有序段。`,
    }, c, a, t)
  }

  if (pass === P_NATURAL) {
    /*  自然归并：先扫一遍找出数据里**现成的**有序段（run），再两两归并这些段。
        已排好序的数据上，第一趟扫描就发现"整个数组本来就是一段"，**一次归并都不用做**。
        教科书那版固定倍增，看不见有序性，照样跑满 log n 趟。 */
    for (;;) {
      //  找出当前所有的自然有序段
      const runs: [number, number][] = []
      let s0 = 0
      for (let k = 1; k <= n; k++) {
        if (k === n || (c.compares++, a[k] < a[k - 1])) { runs.push([s0, k]); s0 = k }
      }
      /*  ⚠️ 每一趟都出一帧"扫描结果"。
          不出的话，**已排好序 + 自然归并**那一档一次归并都不做 → 轴上 0 步，
          屏幕上是个空壳（浏览器里量到的就是 `0 步`）。而"扫一遍发现整个数组
          本来就是一段、于是收工"这件事，正是这一档最该被看见的东西。 */
      emit?.({
        width: 0, lo: 0, mid: 0, hi: n, li: -1, rj: -1, out: [], took: -1, from: '', focus: -1, act: 'scan',
        log: `**扫一遍找现成的有序段**：这一趟找到 **${runs.length}** 段` +
          `（${runs.slice(0, 6).map(([x, y]) => `[${x},${y})`).join(' ')}${runs.length > 6 ? ' …' : ''}）。` +
          (runs.length <= 1
            ? `\n\n**整个数组本来就是一段有序的** —— 一次归并都不用做，收工。` +
              `固定倍增那一版看不见这一点，照样要跑满 ${Math.ceil(Math.log2(n))} 趟。`
            : `接下来把它们两两归并。`),
      }, c, a, t)
      if (runs.length <= 1) break
      c.passes++
      for (let k = 0; k + 1 < runs.length; k += 2) {
        mergeOne(runs[k][0], runs[k][1], runs[k + 1][1], runs[k][1] - runs[k][0])
      }
    }
    return c
  }

  for (let w = 1; w < n; w *= 2) {
    c.passes++
    for (let lo = 0; lo < n; lo += 2 * w) {
      const mid = Math.min(lo + w, n), hi = Math.min(lo + 2 * w, n)
      if (mid >= hi) continue          //  落单的段，本轮不动
      mergeOne(lo, mid, hi, w)
    }
  }
  return c
}

/** 只计数不出帧 —— 规模验证用 */
function countOnly(kind: string, n: number, tie: string, pass: string): Counts {
  const a = makeData(kind, n)
  return mergesort(a, a.map((_, k) => k), tie, pass)
}

// ═══════════════════════════════════════════════════════════════

export type MergeSortState = {
  i: number
  step: number
  arr: number[]
  /** 每个元素的原始下标 —— 值相等时用它看次序有没有被打乱 */
  tags: number[]
  n: number
  width: number
  lo: number; mid: number; hi: number
  li: number; rj: number
  out: number[]
  took: number
  from: string
  focus: number
  act: string
  /** 到这一步为止的比较 / 搬运次数、缓冲区峰值、已走趟数 */
  compares: number
  moves: number
  bufPeak: number
  passes: number
  dataKind: string
  tie: string
  passKind: string
  totalCompares: number
  totalMoves: number
  totalBuf: number
  totalPasses: number
  /** 等值元素排完之后原始次序还在不在；没有等值元素时 hasTies 为假 */
  stable: boolean
  hasTies: boolean
  /** 四种数据形状 × 几个 n 的比较次数（只计数不出帧） */
  shapeSweep: { data: string; rows: { n: number; compares: number }[]; slope: number }[]
  /** 同一档数据下，最多的一形状比最少的多多少倍 —— 归并的这个数应当接近 1 */
  shapeSpread: number
  /** n·log₂n，拿来跟实测比较次数对照 */
  nlogn: number
  phase: 'run' | 'done'
  log: string
}

export const MERGESORT_VISIBLE = [
  'step', 'arr', 'tags', 'n', 'width', 'lo', 'mid', 'hi', 'li', 'rj', 'out', 'took', 'from', 'focus', 'act',
  'compares', 'moves', 'bufPeak', 'passes', 'dataKind', 'tie', 'passKind',
  'totalCompares', 'totalMoves', 'totalBuf', 'totalPasses', 'stable', 'hasTies',
  'shapeSweep', 'shapeSpread', 'nlogn', 'phase', 'log',
] as const

type Frame = Omit<MergeSortState, 'i'>

function slopeOf(rows: { n: number; compares: number }[]): number {
  const lx = rows.map(r => Math.log(r.n))
  const ly = rows.map(r => Math.log(Math.max(1, r.compares)))
  const mx = lx.reduce((a, b) => a + b, 0) / lx.length
  const my = ly.reduce((a, b) => a + b, 0) / ly.length
  return +(lx.reduce((a, x, k) => a + (x - mx) * (ly[k] - my), 0)
    / lx.reduce((a, x) => a + (x - mx) ** 2, 0)).toFixed(2)
}

export const mergesortKernel: Kernel<MergeSortState> = {
  kind: 'mergesort',

  compile(doc: SimDocument): CompiledModel<MergeSortState> {
    const dataKind = String(doc.params.data ?? D_DUP)
    const tie = String(doc.params.tie ?? T_LEFT)
    const passKind = String(doc.params.pass ?? P_POW2)

    const init = makeData(dataKind, N_ANIM)
    const arr = init.slice()
    const tags = init.map((_, k) => k)
    const N = arr.length

    /*  ⭐ **"最坏也一样"拿数据形状扫出来。** 四种形状 × 几个 n，
        比较次数几乎不动 —— 而快排那一屏上同样的对照是 1137 → 12720。 */
    const shapeSweep = MS_DATA.map(d => {
      const rows = MS_SCALE_NS.map(n => ({ n, compares: countOnly(d, n, tie, passKind).compares }))
      return { data: d, rows, slope: slopeOf(rows) }
    })
    const bigs = shapeSweep.map(s => s.rows[s.rows.length - 1].compares)
    const shapeSpread = +(Math.max(...bigs) / Math.max(1, Math.min(...bigs))).toFixed(2)

    const totals = countOnly(dataKind, N_ANIM, tie, passKind)
    const nlogn = +(N * Math.log2(N)).toFixed(1)

    const frames: Frame[] = []
    const shared = {
      n: N, dataKind, tie, passKind,
      totalCompares: totals.compares, totalMoves: totals.moves,
      totalBuf: totals.bufPeak, totalPasses: totals.passes,
      shapeSweep, shapeSpread, nlogn,
    }

    mergesort(arr, tags, tie, passKind, (info, c, a, t) => {
      frames.push({
        ...shared, step: frames.length, arr: a.slice(), tags: t.slice(),
        compares: c.compares, moves: c.moves, bufPeak: c.bufPeak, passes: c.passes,
        stable: true, hasTies: false, phase: 'run', ...info,
      })
    })

    /*  等值元素的相对次序还在不在。没有等值元素时这件事无从谈起 —— 别硬报一个"稳定"。 */
    let hasTies = false, stable = true
    for (let k = 1; k < N; k++) {
      if (arr[k] === arr[k - 1]) { hasTies = true; if (tags[k] < tags[k - 1]) stable = false }
    }
    for (const f of frames) { f.stable = stable; f.hasTies = hasTies }

    const other = tie === T_LEFT ? T_RIGHT : T_LEFT
    const shapeText = shapeSweep.map(s =>
      `${s.data}：n=${MS_SCALE_NS[MS_SCALE_NS.length - 1]} 时比较 ${s.rows[s.rows.length - 1].compares} 次（指数 ${s.slope.toFixed(2)}）`).join('\n')

    frames.push({
      ...shared, step: frames.length, arr: arr.slice(), tags: tags.slice(),
      width: 0, lo: 0, mid: 0, hi: N, li: -1, rj: -1, out: arr.slice(), took: -1, from: '', focus: -1,
      act: 'done', compares: totals.compares, moves: totals.moves, bufPeak: totals.bufPeak, passes: totals.passes,
      stable, hasTies, phase: 'done',
      log: `**排好了**：[${arr.join(',')}]。\n\n` +
        `n=${N}：走了 **${totals.passes}** 趟、比较 **${totals.compares}** 次、往缓冲区搬了 ${totals.moves} 次，` +
        `**缓冲区峰值 ${totals.bufPeak}** 个元素（对照 n·log₂n = ${nlogn}）。\n\n` +
        `**① 换数据形状会怎样。** 四种形状各扫一遍（只计数不出帧）：\n${shapeText}\n` +
        `最费的比最省的多 **${shapeSpread} 倍**。\n\n` +
        (shapeSpread < 3
          ? `**归并排序没有坏情况** —— 它不看数据长什么样，照着 log n 趟一趟趟扫，代价永远是那么多。\n\n` +
            `⚠️ **拿它跟隔壁快排那一屏对照**：同样是换数据形状，快排在 n=160 上是 **1137 → 12720**（差 11 倍、指数 2.03）。\n\n`
          : `⚠️ **注意这一档已经不是"最坏也一样"了** —— 差 ${shapeSpread} 倍。自然归并有了"好情况"（已排好序），` +
            `也就等于承认了"坏情况"。固定倍增那一版才是四种形状几乎不动的那个。\n\n`) +
        /*  ⚠️ 缓冲区那句话得按**实测值**说。自然归并 + 已排好序时一次归并都不做，
            峰值是 **0** —— 照着模板印"0 个元素，也就是 O(n)"是自相矛盾的。 */
        (totals.bufPeak > 0
          ? `**② 而这个代价是空间。** 缓冲区峰值 **${totals.bufPeak}** 个元素（n=${N}），也就是 **O(n)**；` +
            `快排是**原地**的，只花 O(log n) 的递归栈。**这就是实践中快排更常用的理由** —— ` +
            `而数据大到装不下内存时（外部排序），反倒只有归并做得了：分块排好、再多路归并。\n\n`
          : `**② 这一趟一次归并都没做，所以缓冲区峰值是 0。** 但归并排序一般要 **O(n)** 的额外缓冲 —— ` +
            `换个数据形状（或换回固定倍增）就看得见了。快排是**原地**的，那一栏永远是 0，` +
            `**这就是实践中快排更常用的理由**；反过来，数据大到装不下内存时只有归并做得了。\n\n`) +
        (hasTies
          ? `**③ "归并排序是稳定的"，稳的其实是一个字符。** 当前是「${tie}」：` +
            (stable
              ? `相等时先取**左**段，而左段在原数组里本来就在前面 —— 等值元素的角标 a/b/c **原序保住了**。\n\n` +
                `**把「取小的规则」换成「${other}」再看**：只把 \`<=\` 改成 \`<\`，排序结果一模一样，而角标会乱。`
              : `相等时先取**右**段。排序结果照样正确，**但等值元素的角标被打乱了** —— 稳定性没了。\n\n` +
                `**换回「${other}」**：同一份数据、同一个算法，只差这一个字符，角标就回来了。` +
                `按多关键字排序（先按成绩再按姓名）时，这一个字符决定结果对不对。`)
          : `**③ 这一档数据里没有等值元素**，"稳不稳定"无从谈起 —— 换成「${D_DUP}」那一档才看得见。`) +
        (passKind === P_NATURAL
          ? `\n\n**④ 自然归并**：不按固定的 1→2→4 切，而是先扫一遍找出数据里**现成的**有序段再两两归并。` +
            `已排好序的数据上它一趟就发现"整个数组本来就是一段"，**一次归并都不做**（0 趟、缓冲区 0）。\n\n` +
            `⚠️ **但这笔账不是白捡的**：每一趟都得**重新扫一遍**找有序段，那些也是比较。` +
            `随机数据上它反而更亏 —— 比较 ${countOnly(D_RANDOM, N_ANIM, tie, P_NATURAL).compares} 次，而固定倍增只要 ` +
            `${countOnly(D_RANDOM, N_ANIM, tie, P_POW2).compares} 次。**自然归并赌的是"数据里本来就有长的有序段"**，` +
            `赌不中就白扫。真实世界的数据常常局部有序，所以这个赌大多时候划算 —— Python 和 Java 用的 **Timsort** 就是这条路走到底的产物。\n\n` +
            `还要注意一件事：**这一档它不再"最坏也一样"了** —— 四种形状之间差 ${shapeSpread} 倍（固定倍增只差 ` +
            `${(() => { const b = MS_DATA.map(d => countOnly(d, MS_SCALE_NS[MS_SCALE_NS.length - 1], tie, P_POW2).compares); return +(Math.max(...b) / Math.min(...b)).toFixed(2) })()} 倍）。` +
            `**有了"好情况"，就等于承认了"坏情况"。**`
          : `\n\n**④ 注意它没有利用有序性**：这一版按固定的 1→2→4… 切，不管数据本来有多有序，都跑满 ${totals.passes} 趟。` +
            `换成「${P_NATURAL}」再看已排好序那一档 —— 0 趟、一次归并都不做。（代价是每趟要重扫一遍找有序段，随机数据上反而更亏。）`),
    })

    const base0: Frame = {
      ...shared, step: -1, arr: init.slice(), tags: init.map((_, k) => k),
      width: 1, lo: 0, mid: 0, hi: 0, li: -1, rj: -1, out: [], took: -1, from: '', focus: -1, act: '',
      compares: 0, moves: 0, bufPeak: 0, passes: 0, stable, hasTies, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '归并' },
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
