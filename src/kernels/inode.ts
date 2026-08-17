/**
 * 内核：文件索引寻址（操作系统 · 文件系统）
 * 轴：step —— 每步是一次"给定逻辑块号，求物理块号"的查找
 *
 * 混合索引（UNIX inode）的核心：
 *   前 N 个是**直接**地址；再往后依次是一级、二级、三级间接。
 * 考点永远是两问：**这一块落在哪一级** 和 **要访问几次磁盘**。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type InodeState = {
  i: number
  /** 本次查的逻辑块号 */
  lbn: number
  /** 落在哪一级 */
  level: 'direct' | 'single' | 'double' | 'triple' | 'oob'
  /** 走过的索引层级说明 */
  path: string[]
  /** 访问磁盘次数（含最后取数据块那一次） */
  reads: number
  /** 各级能覆盖的块数与区间 */
  ranges: { name: string; from: number; to: number; count: number }[]
  log: string
}

export const INODE_VISIBLE = ['i', 'lbn', 'level', 'path', 'reads', 'ranges', 'log'] as const

export const inodeKernel: Kernel<InodeState> = {
  kind: 'inode',

  compile(doc: SimDocument): CompiledModel<InodeState> {
    const blockSize = num(doc.params, 'blockSizeBytes')
    const pointerSize = num(doc.params, 'pointerSizeBytes')
    const direct = num(doc.params, 'directCount')
    const lbns = (doc.streams.find(s => s.name === 'blockNumbers')?.values ?? []) as number[]

    /** 一个索引块能装多少个指针 —— 间接寻址的"扇出" */
    const K = Math.floor(blockSize / pointerSize)
    const single = K
    const double = K * K
    const triple = K * K * K

    const ranges = [
      { name: '直接地址', from: 0, to: direct - 1, count: direct },
      { name: '一级间接', from: direct, to: direct + single - 1, count: single },
      { name: '二级间接', from: direct + single, to: direct + single + double - 1, count: double },
      { name: '三级间接', from: direct + single + double, to: direct + single + double + triple - 1, count: triple },
    ]

    const initial = (): InodeState => ({
      i: -1, lbn: 0, level: 'direct', path: [], reads: 0, ranges, log: '',
    })

    return {
      axis: { kind: 'step', label: '查找序号' },
      initial,
      describe: s => s.log,

      step(prev) {
        const base = prev ?? initial()
        const i = base.i + 1
        if (i >= lbns.length) return null

        const lbn = lbns[i]
        let level: InodeState['level']
        const path: string[] = []
        let reads: number
        let log: string

        if (lbn < direct) {
          level = 'direct'
          reads = 1
          path.push(`inode 里第 ${lbn} 个直接地址`, '数据块')
          log = `逻辑块 ${lbn} < ${direct} → 落在**直接地址**区，`
            + `inode 本身就存着物理块号 → 只需 1 次磁盘访问`
        } else if (lbn < direct + single) {
          level = 'single'
          reads = 2
          const off = lbn - direct
          path.push('inode 里的一级间接指针', `一级索引块第 ${off} 项`, '数据块')
          log = `逻辑块 ${lbn} 落在**一级间接**区（第 ${off} 项）→ `
            + `先读一级索引块，再读数据块 → 2 次磁盘访问`
        } else if (lbn < direct + single + double) {
          level = 'double'
          reads = 3
          const off = lbn - direct - single
          path.push('inode 里的二级间接指针',
            `一级索引块第 ${Math.floor(off / K)} 项`,
            `二级索引块第 ${off % K} 项`, '数据块')
          log = `逻辑块 ${lbn} 落在**二级间接**区（偏移 ${off}）→ `
            + `${Math.floor(off / K)} 号一级项、${off % K} 号二级项 → 3 次磁盘访问`
        } else if (lbn < direct + single + double + triple) {
          level = 'triple'
          reads = 4
          const off = lbn - direct - single - double
          path.push('inode 里的三级间接指针',
            `一级索引块第 ${Math.floor(off / (K * K))} 项`,
            `二级索引块第 ${Math.floor(off / K) % K} 项`,
            `三级索引块第 ${off % K} 项`, '数据块')
          log = `逻辑块 ${lbn} 落在**三级间接**区（偏移 ${off}）→ 4 次磁盘访问`
        } else {
          level = 'oob'
          reads = 0
          path.push('超出文件最大长度')
          log = `逻辑块 ${lbn} 超过这种 inode 能表示的最大块号 `
            + `${direct + single + double + triple - 1} → 文件不可能这么大`
        }

        return { state: { i, lbn, level, path, reads, ranges, log }, done: i === lbns.length - 1 }
      },
    }
  },
}

/** 文件最大长度，供视图与题目共用 */
export const maxFileSize = (blockSize: number, pointerSize: number, direct: number) => {
  const K = Math.floor(blockSize / pointerSize)
  return (direct + K + K * K + K * K * K) * blockSize
}
