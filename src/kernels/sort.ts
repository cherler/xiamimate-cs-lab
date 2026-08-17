/**
 * 内核：排序逐趟（数据结构）
 * 轴：step —— 但真正的考点是"趟"，所以每步都标 pass 号
 *
 * 考题几乎都问"第 N 趟排序后的结果是什么"，所以：
 *   - 每一步记录当前数组快照
 *   - 标出本步比较/交换的下标
 *   - 标出"一趟结束"的边界，以及已确定最终位置的区间
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type SortState = {
  i: number
  arr: number[]
  /**
   * 空位下标（挖坑法）。插入排序和快排搬移时，那个格子的内容是**旧副本**，
   * 真正的值被端在手里（held）。不标出来就会让学生以为数组里凭空多了一个数。
   * -1 表示没有空位。
   */
  hole: number
  /** 手里端着的值；hole = -1 时为 null */
  held: number | null
  /** 本步参与比较的下标 */
  compare: number[]
  /** 本步发生交换/写入的下标 */
  changed: number[]
  /** 第几趟（从 1 开始）；0 表示还没进入正式趟次 */
  pass: number
  /** 本步是否是一趟的结束 */
  passEnd: boolean
  /**
   * **已确定最终位置**的下标 —— 之后再也不会动。
   * 冒泡/选择/快排/堆有；插入/希尔/归并**没有**（它们的前缀只是局部有序）。
   */
  settled: number[]
  /**
   * **局部有序但还会移动**的下标区间。插入排序的"已排好的前缀"属于这里，
   * 不属于 settled —— 这正是学生最容易混的一处。
   */
  sorted: number[]
  comparisons: number
  moves: number
  log: string
}

export const SORT_VISIBLE = [
  'i', 'arr', 'hole', 'held', 'compare', 'changed', 'pass', 'passEnd',
  'settled', 'sorted', 'comparisons', 'moves', 'log',
] as const

type Frame = Omit<SortState, 'i'>

/**
 * 各算法生成完整的步骤序列。
 * 一次算完再按下标取 —— step() 仍只依赖 prev.i，确定性重放不受影响。
 */
function buildFrames(algorithm: string, input: number[], gapSeq: number[]): Frame[] {
  const out: Frame[] = []
  const a = [...input]
  let comparisons = 0, moves = 0

  const push = (f: Partial<Frame> & { log: string }) => out.push({
    arr: [...a], hole: -1, held: null, compare: [], changed: [],
    pass: 0, passEnd: false, settled: [], sorted: [],
    comparisons, moves, ...f,
  })

  if (algorithm === '冒泡') {
    const n = a.length
    for (let p = 1; p < n; p++) {
      let swapped = false
      for (let j = 0; j < n - p; j++) {
        comparisons++
        const settled = Array.from({ length: p - 1 }, (_, k) => n - 1 - k)
        if (a[j] > a[j + 1]) {
          ;[a[j], a[j + 1]] = [a[j + 1], a[j]]; moves++; swapped = true
          push({ compare: [j, j + 1], changed: [j, j + 1], pass: p, settled,
            log: `第 ${p} 趟：a[${j}]=${a[j + 1]} > a[${j + 1}]=${a[j]}，交换` })
        } else {
          push({ compare: [j, j + 1], pass: p, settled,
            log: `第 ${p} 趟：a[${j}]=${a[j]} ≤ a[${j + 1}]=${a[j + 1]}，不动` })
        }
      }
      const settled = Array.from({ length: p }, (_, k) => n - 1 - k)
      push({ pass: p, passEnd: true, settled,
        log: `第 ${p} 趟结束：最大的 ${p} 个已就位${swapped ? '' : '；本趟无交换，可提前结束'}` })
      if (!swapped) break
    }
  }

  else if (algorithm === '简单选择') {
    const n = a.length
    for (let p = 0; p < n - 1; p++) {
      let min = p
      for (let j = p + 1; j < n; j++) {
        comparisons++
        if (a[j] < a[min]) min = j
        push({ compare: [min, j], pass: p + 1, settled: range(0, p),
          log: `第 ${p + 1} 趟：扫描到 a[${j}]=${a[j]}，当前最小是 a[${min}]=${a[min]}` })
      }
      if (min !== p) { [a[p], a[min]] = [a[min], a[p]]; moves++ }
      push({ changed: min !== p ? [p, min] : [], pass: p + 1, passEnd: true, settled: range(0, p + 1),
        log: `第 ${p + 1} 趟结束：最小值 ${a[p]} 换到位置 ${p}` })
    }
  }

  else if (algorithm === '直接插入') {
    for (let p = 1; p < a.length; p++) {
      const key = a[p]
      let j = p - 1
      // 取出 a[p] 端在手里 —— 从这一刻起 p 号格子是空位，里面是旧副本
      push({ compare: [p], pass: p, hole: p, held: key, sorted: range(0, p),
        log: `第 ${p} 趟：取出 a[${p}]=${key} 暂存，前 ${p} 个已局部有序（注意：还没定最终位置）` })
      while (j >= 0 && a[j] > key) {
        comparisons++
        a[j + 1] = a[j]; moves++; j--
        push({ compare: [j + 1], changed: [j + 2], pass: p, hole: j + 1, held: key,
          sorted: range(0, p),
          log: `第 ${p} 趟：${key} < ${a[j + 2]}，把它后移一位，空位左移到 ${j + 1}` })
      }
      if (j >= 0) comparisons++
      a[j + 1] = key
      push({ changed: [j + 1], pass: p, passEnd: true, sorted: range(0, p + 1),
        log: `第 ${p} 趟结束：${key} 落进空位 ${j + 1}，前 ${p + 1} 个局部有序` })
    }
    // 最后一趟走完，整体有序 —— 此时才谈得上"最终位置"
    if (out.length) out[out.length - 1].settled = range(0, a.length)
  }

  else if (algorithm === '希尔') {
    const n = a.length
    const gaps = gapSeq.length ? gapSeq : defaultGaps(n)
    let p = 0
    for (const gap of gaps) {
      p++
      for (let s = gap; s < n; s++) {
        const key = a[s]
        let j = s - gap
        while (j >= 0 && a[j] > key) {
          comparisons++
          a[j + gap] = a[j]; moves++; j -= gap
        }
        if (j >= 0) comparisons++
        a[j + gap] = key
        //  希尔的"有序区"不是连续区间，而是同增量下的跳跃子序列 —— 这正是它的可视化重点。
        //  每一趟都不确定最终位置，连子序列有序也会被下一趟重新洗牌。
        const group: number[] = []
        for (let k = s % gap; k <= s; k += gap) group.push(k)
        push({ compare: [s], changed: [j + gap], pass: p, sorted: group,
          log: `增量 ${gap}：把 a[${s}]=${key} 插进第 ${s % gap} 组子序列（下标 ${group.join(',')}）的位置 ${j + gap}` })
      }
      push({ pass: p, passEnd: true,
        log: `增量 ${gap} 的一趟结束：各子序列内部已有序${gap === 1 ? '，增量为 1 即整体有序' : '，但整体还没有序' }` })
    }
    if (out.length) out[out.length - 1].settled = range(0, n)
  }

  else if (algorithm === '快速') {
    const n = a.length
    let p = 0
    const fixed: number[] = []   // 已归位的基准，累积 —— 快排的 settled 是真的最终位置
    const qs = (lo: number, hi: number) => {
      if (lo > hi) return
      if (lo === hi) {
        fixed.push(lo)
        push({ settled: [...fixed], pass: p, log: `区间 [${lo}] 只剩一个元素，${a[lo]} 就位` })
        return
      }
      p++
      const pivot = a[lo]
      let i = lo, j = hi
      //  基准被端出来 —— lo 号格子成了空位
      push({ compare: [lo], pass: p, hole: lo, held: pivot, settled: [...fixed],
        log: `第 ${p} 次划分：区间 [${lo}..${hi}]，取出基准 ${pivot}，lo 处留下空位` })
      while (i < j) {
        while (i < j && a[j] >= pivot) { comparisons++; j-- }
        if (i < j) {
          a[i] = a[j]; moves++
          push({ compare: [j], changed: [i], pass: p, hole: j, held: pivot, settled: [...fixed],
            log: `从右往左找到 ${a[i]} < ${pivot}，填进左边的空位 ${i}，空位移到 ${j}` })
        }
        while (i < j && a[i] <= pivot) { comparisons++; i++ }
        if (i < j) {
          a[j] = a[i]; moves++
          push({ compare: [i], changed: [j], pass: p, hole: i, held: pivot, settled: [...fixed],
            log: `从左往右找到 ${a[j]} > ${pivot}，填进右边的空位 ${j}，空位移到 ${i}` })
        }
      }
      a[i] = pivot
      fixed.push(i)
      push({ changed: [i], settled: [...fixed], pass: p, passEnd: true,
        log: `第 ${p} 次划分结束：基准 ${pivot} 落进空位 ${i}，左边都比它小、右边都比它大，位置已定` })
      qs(lo, i - 1); qs(i + 1, hi)
    }
    qs(0, n - 1)
  }

  else if (algorithm === '堆') {
    const n = a.length
    const sift = (lo: number, hi: number, p: number, phase: string) => {
      let k = lo
      while (2 * k + 1 <= hi) {
        let c = 2 * k + 1
        if (c + 1 <= hi) { comparisons++; if (a[c + 1] > a[c]) c++ }
        comparisons++
        if (a[k] >= a[c]) break
        ;[a[k], a[c]] = [a[c], a[k]]; moves++
        push({ compare: [k, c], changed: [k, c], pass: p,
          log: `${phase}：${a[c]} < ${a[k]}，下沉交换 a[${k}] ↔ a[${c}]` })
        k = c
      }
    }
    for (let k = Math.floor(n / 2) - 1; k >= 0; k--) sift(k, n - 1, 1, '建堆')
    push({ pass: 1, passEnd: true, log: `建初始大根堆完成，堆顶是最大值 ${a[0]}` })
    for (let hi = n - 1; hi > 0; hi--) {
      ;[a[0], a[hi]] = [a[hi], a[0]]; moves++
      const p = n - hi + 1
      push({ changed: [0, hi], settled: range(hi, n), pass: p,
        log: `第 ${p - 1} 趟：堆顶 ${a[hi]} 与末尾交换，${a[hi]} 就位` })
      sift(0, hi - 1, p, `第 ${p - 1} 趟调整`)
      push({ pass: p, passEnd: true, settled: range(hi, n), log: `第 ${p - 1} 趟结束：重新调整为大根堆` })
    }
  }

  else if (algorithm === '归并') {
    const n = a.length
    let p = 0
    for (let width = 1; width < n; width *= 2) {
      p++
      for (let lo = 0; lo < n; lo += 2 * width) {
        const mid = Math.min(lo + width, n), hi = Math.min(lo + 2 * width, n)
        if (mid >= hi) continue
        const merged: number[] = []
        let x = lo, y = mid
        while (x < mid && y < hi) { comparisons++; merged.push(a[x] <= a[y] ? a[x++] : a[y++]) }
        while (x < mid) merged.push(a[x++])
        while (y < hi) merged.push(a[y++])
        for (let k = 0; k < merged.length; k++) { a[lo + k] = merged[k]; moves++ }
        //  归并的每一段只是局部有序，下一趟还会被整体搬走 —— 不是 settled
        push({ compare: range(lo, hi), changed: range(lo, hi), pass: p, sorted: range(lo, hi),
          log: `${width} 路归并：合并 [${lo}..${mid - 1}] 与 [${mid}..${hi - 1}] → ${merged.join(' ')}` })
      }
      push({ pass: p, passEnd: true, sorted: range(0, Math.min(2 * width, n)),
        log: `第 ${p} 趟（子序列长 ${width}）归并结束，每 ${Math.min(2 * width, n)} 个一组内部有序` })
    }
    if (out.length) out[out.length - 1].settled = range(0, n)
  }

  if (out.length === 0) push({ log: '数组长度不足，无需排序' })
  return out
}

const range = (lo: number, hi: number) => Array.from({ length: Math.max(0, hi - lo) }, (_, k) => lo + k)
const defaultGaps = (n: number) => {
  const g: number[] = []
  for (let d = Math.floor(n / 2); d >= 1; d = Math.floor(d / 2)) g.push(d)
  return g
}

export const sortKernel: Kernel<SortState> = {
  kind: 'sort',

  compile(doc: SimDocument): CompiledModel<SortState> {
    const algorithm = str(doc.params, 'algorithm')
    const input = (doc.streams.find(s => s.name === 'array')?.values ?? []) as number[]
    void num
    const frames = buildFrames(algorithm, input, [])

    return {
      axis: { kind: 'step', label: '操作序号' },
      initial: () => ({
        i: -1, arr: [...input], hole: -1, held: null, compare: [], changed: [],
        pass: 0, passEnd: false, settled: [], sorted: [], comparisons: 0, moves: 0, log: '',
      }),
      describe: s => s.log,
      step(prev) {
        const base = prev ?? this.initial()
        const i = base.i + 1
        if (i >= frames.length) return null
        return { state: { i, ...frames[i] }, done: i === frames.length - 1 }
      },
    }
  },
}
