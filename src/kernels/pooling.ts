/**
 * 内核：池化 Pooling（深度学习算法 · 原理：拿小窗口把特征图缩小,只留每块最强/平均的信号）
 * 轴：step —— 2×2 窗口不重叠地扫过 4×4 特征图,每块取**最大**(或**平均**)写进输出 → 图缩成 2×2。
 *      参数可切最大池化/平均池化,改了立即重跑。
 *
 * 卷积后的特征图往往很大、还带位置冗余。**池化**用一个小窗口(这里 2×2)在图上**不重叠地滑**,
 * 每滑到一块就把这 4 个数**汇总成一个**:**最大池化**取最大(留住最强的响应)、**平均池化**取平均(留整体强度)。
 * 于是图的边长减半、面积变 1/4——**降采样**。好处有三:参数和计算量骤减;对小的平移**更鲁棒**(窗口里挪一格,最大值常不变);
 * 感受野变大(高层每个点概括更大范围)。它没有可学参数,就是个固定的汇总操作。
 *
 * 本实验:4×4 特征图,2×2 最大池化 → 输出 2×2 = [[6,4],[7,9]](每块的最大);切平均池化 → [[3.75,2.25],[4,5]]。
 * 每个输出都可对着窗口手算核对。池化是 CNN 里紧跟卷积的标准一环(LeNet、VGG),后来也常被步长卷积替代。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const IMG = [[1, 3, 2, 4], [5, 6, 1, 2], [7, 2, 9, 1], [3, 4, 2, 8]]
const round2 = (x: number) => Math.round(x * 100) / 100

export type PoolState = {
  i: number
  step: number
  img: number[][]
  kindName: string             // '最大' | '平均'
  out: (number | null)[][]     // 2×2，逐格填
  wr: number; wc: number       // 当前窗口（输出坐标 0/1）
  vals: number[]               // 窗口内 4 个数
  result: number
  phase: 'run' | 'done'
  log: string
}

export const POOL_VISIBLE = [
  'step', 'img', 'kindName', 'out', 'wr', 'wc', 'vals', 'result', 'phase', 'log',
] as const

type Frame = Omit<PoolState, 'i'>

export const poolingKernel: Kernel<PoolState> = {
  kind: 'pooling',

  compile(doc: SimDocument): CompiledModel<PoolState> {
    const kindName = String(doc.params?.kind ?? '最大')
    const isMax = kindName !== '平均'
    const frames: Frame[] = []
    const out: (number | null)[][] = [[null, null], [null, null]]

    for (let wr = 0; wr < 2; wr++) {
      for (let wc = 0; wc < 2; wc++) {
        const vals = [IMG[2 * wr][2 * wc], IMG[2 * wr][2 * wc + 1], IMG[2 * wr + 1][2 * wc], IMG[2 * wr + 1][2 * wc + 1]]
        const result = isMax ? Math.max(...vals) : round2(vals.reduce((a, b) => a + b, 0) / 4)
        out[wr][wc] = result
        frames.push({
          step: frames.length, img: IMG, kindName, out: out.map(r => r.slice()), wr, wc, vals, result, phase: 'run',
          log: `窗口 (${wr},${wc}) 盖住 [${vals.join(', ')}] → ${isMax ? `**最大** = ${result}` : `**平均** = (${vals.join('+')})/4 = ${result}`},写进输出 (${wr},${wc})。`,
        })
      }
    }

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, step: frames.length, phase: 'done',
      log: `**${kindName}池化完成**:4×4 缩成 2×2 = ${JSON.stringify(out).replace(/"/g, '')}。每块 2×2 汇总成一个数 → 边长减半、面积变 1/4(降采样)。` +
        `${isMax ? '最大池化留住每块最强的响应,对小平移更鲁棒' : '平均池化留整体强度、更平滑'};计算量骤减、感受野变大。CNN 里紧跟卷积(LeNet/VGG),没有可学参数。`,
    })

    const base0: Frame = {
      step: -1, img: IMG, kindName, out: [[null, null], [null, null]], wr: -1, wc: -1, vals: [], result: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '窗口' },
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
