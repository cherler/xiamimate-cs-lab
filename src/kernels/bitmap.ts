/**
 * 内核：位示图管理空闲盘块（操作系统 · 文件系统）
 * 轴：step —— 每步是一次分配或回收
 *
 * 全部考点就两条换算公式（这里按字号、位号都从 0 起编）：
 *   盘块号 = 字号 × 字长 + 位号
 *   字号 = 盘块号 ÷ 字长（取整）， 位号 = 盘块号 mod 字长
 *
 * 教材若约定从 1 开始编号，公式要各加/减 1 —— 这正是最容易错的地方，
 * 所以这里把两种约定都算出来摆在一起。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type BitmapState = {
  i: number
  /** 位示图：bits[字号][位号]，1 表示已占用 */
  bits: number[][]
  act: 'alloc' | 'free' | 'fail'
  /** 本步涉及的盘块号 */
  blocks: number[]
  /** 本步的字号 / 位号（对应 blocks[0]） */
  word: number
  bit: number
  freeCount: number
  log: string
}

export const BITMAP_VISIBLE =
  ['i', 'bits', 'act', 'blocks', 'word', 'bit', 'freeCount', 'log'] as const

export const bitmapKernel: Kernel<BitmapState> = {
  kind: 'bitmap',

  compile(doc: SimDocument): CompiledModel<BitmapState> {
    const words = num(doc.params, 'words')          // 多少个字
    const wordBits = num(doc.params, 'wordBits')    // 每个字多少位
    const total = words * wordBits
    /** 请求：{ type:'req', attrs:{ count, free, block } } */
    const reqs = doc.entities.filter(e => e.type === 'req').map(e => ({
      id: e.id,
      count: Number(e.attrs.count ?? 1),
      isFree: Number(e.attrs.free ?? 0) === 1,
      block: Number(e.attrs.block ?? -1),
    }))

    const initial = (): BitmapState => ({
      i: -1,
      bits: Array.from({ length: words }, () => new Array(wordBits).fill(0)),
      act: 'alloc', blocks: [], word: 0, bit: 0, freeCount: total, log: '',
    })

    return {
      axis: { kind: 'step', label: '请求序号' },
      initial,
      describe: s => s.log,

      step(prev) {
        const base = prev ?? initial()
        const i = base.i + 1
        if (i >= reqs.length) return null

        const req = reqs[i]
        const bits = base.bits.map(w => [...w])
        const blocks: number[] = []
        let act: BitmapState['act'] = req.isFree ? 'free' : 'alloc'
        let log: string

        if (req.isFree) {
          //  回收：由盘块号反算字号、位号
          for (let k = 0; k < req.count; k++) {
            const b = req.block + k
            if (b < 0 || b >= total) continue
            bits[Math.floor(b / wordBits)][b % wordBits] = 0
            blocks.push(b)
          }
          const b0 = blocks[0] ?? 0
          log = blocks.length === 0
            ? `回收 ${req.id}：盘块号超出范围，忽略`
            : `回收盘块 ${blocks.join('、')}：`
              + `字号 = ${b0} ÷ ${wordBits} = ${Math.floor(b0 / wordBits)}，`
              + `位号 = ${b0} mod ${wordBits} = ${b0 % wordBits} → 把对应位清 0`
        } else {
          //  分配：顺序扫描找第一个 0 位
          for (let w = 0; w < words && blocks.length < req.count; w++) {
            for (let b = 0; b < wordBits && blocks.length < req.count; b++) {
              if (bits[w][b] === 0) { bits[w][b] = 1; blocks.push(w * wordBits + b) }
            }
          }
          if (blocks.length < req.count) {
            //  不够就全部回滚 —— 半分配的状态没有意义
            for (const b of blocks) bits[Math.floor(b / wordBits)][b % wordBits] = 0
            blocks.length = 0
            act = 'fail'
            log = `${req.id} 申请 ${req.count} 块：空闲块不够，分配失败`
          } else {
            const b0 = blocks[0]
            log = `${req.id} 申请 ${req.count} 块 → 分到盘块 ${blocks.join('、')}；`
              + `以第一块为例：字号 ${Math.floor(b0 / wordBits)}、位号 ${b0 % wordBits}，`
              + `盘块号 = ${Math.floor(b0 / wordBits)} × ${wordBits} + ${b0 % wordBits} = ${b0}`
          }
        }

        const freeCount = bits.reduce((s, w) => s + w.filter(x => x === 0).length, 0)
        const b0 = blocks[0] ?? 0

        return {
          state: {
            i, bits, act, blocks,
            word: Math.floor(b0 / wordBits), bit: b0 % wordBits,
            freeCount, log,
          },
          done: i === reqs.length - 1,
        }
      },
    }
  },
}
