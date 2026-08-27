/**
 * 内核：张量布局 row/col-major（机器学习基础 · 矩阵乘的地基补充）
 * 轴：step —— 按内存顺序逐个地址，看它存的是矩阵的哪个 [i][j]；末尾对比行/列访问的步长
 *
 * 矩阵是二维的，内存是一维的 —— 二维怎么摊平到一维，就是"布局"。
 *   row-major（C/NumPy 默认）：一行的元素连续存，[i][j] 在地址 i·cols+j。
 *   col-major（Fortran/BLAS）：一列的元素连续存，[i][j] 在地址 j·rows+i。
 * 同一个矩阵、同样的值，两种布局在内存里的**顺序完全不同**。谁连续，谁的访问就快（顺着 cache 行）：
 *   row-major 里"扫一行"步长 1（连续、快），"扫一列"步长 cols（跳着、慢）；col-major 正好反过来。
 * 这就是为什么矩阵乘、转置、reshape 都要在意布局 —— 是「矩阵乘法」这块地基的另一半。
 *
 * 值全部现算：每个地址存哪个 [i][j] 由公式定，可核对。状态可 JSON 往返（验收标准 2）。
 */
import { str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type LayoutState = {
  i: number
  layout: 'row-major' | 'col-major'
  rows: number; cols: number
  A: number[][]
  /** 内存里的线性顺序：每格 {addr,i,j,v}，未到的为 null */
  mem: ({ i: number; j: number; v: number } | null)[]
  cur: { addr: number; i: number; j: number; v: number } | null
  rowStride: number        // 顺着"同一行"走，地址步长
  colStride: number        // 顺着"同一列"走，地址步长
  phase: 'lay' | 'done'
  log: string
}

export const LAYOUT_VISIBLE = [
  'i', 'layout', 'rows', 'cols', 'A', 'mem', 'cur', 'rowStride', 'colStride', 'phase', 'log',
] as const

type Frame = Omit<LayoutState, 'i'>

const A = [[1, 2, 3], [4, 5, 6]]

export const layoutKernel: Kernel<LayoutState> = {
  kind: 'layout',

  compile(doc: SimDocument): CompiledModel<LayoutState> {
    const rows = A.length, cols = A[0].length
    const lm = doc.params.layout
    const layout: LayoutState['layout'] = (typeof lm === 'string' && lm === 'col-major') ? 'col-major' : 'row-major'
    const N = rows * cols

    //  地址 → [i][j]
    const addrToIJ = (addr: number): [number, number] =>
      layout === 'row-major' ? [Math.floor(addr / cols), addr % cols] : [addr % rows, Math.floor(addr / rows)]
    const rowStride = layout === 'row-major' ? 1 : rows   // 同一行内相邻列的地址差
    const colStride = layout === 'row-major' ? cols : 1   // 同一列内相邻行的地址差

    const frames: Frame[] = []
    const mem: ({ i: number; j: number; v: number } | null)[] = Array(N).fill(null)

    for (let addr = 0; addr < N; addr++) {
      const [i, j] = addrToIJ(addr)
      const v = A[i][j]
      mem[addr] = { i, j, v }
      frames.push({
        layout, rows, cols, A, mem: mem.map(m => (m ? { ...m } : null)),
        cur: { addr, i, j, v }, rowStride, colStride, phase: 'lay',
        log: `地址 ${addr} 存 A[${i}][${j}]=${v}。` +
          (layout === 'row-major' ? `（row-major：地址 = i·${cols}+j = ${i}·${cols}+${j}）` : `（col-major：地址 = j·${rows}+i = ${j}·${rows}+${i}）`),
      })
    }

    frames.push({
      layout, rows, cols, A, mem: mem.map(m => (m ? { ...m } : null)),
      cur: null, rowStride, colStride, phase: 'done',
      log: `${layout} 摊平完。同一个矩阵，内存顺序是 [${mem.map(m => m!.v).join('、')}]。` +
        `扫**一行**步长 ${rowStride}${rowStride === 1 ? '（连续、快）' : '（跳着、慢）'}，扫**一列**步长 ${colStride}${colStride === 1 ? '（连续、快）' : '（跳着、慢）'} —— ` +
        `谁连续谁快，这就是布局要紧的原因。`,
    })

    const base0: Frame = {
      layout, rows, cols, A, mem: Array(N).fill(null), cur: null, rowStride, colStride, phase: 'lay', log: '',
    }
    void str

    return {
      axis: { kind: 'step', label: '内存地址' },
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
