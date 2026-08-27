/**
 * 内核：卷积 CNN（深度学习算法 · 原理：一个小窗口滑过图像，就能"看见"特征）
 * 轴：step —— 一个 3×3 卷积核在图上一格格滑，每处算加权和，生成特征图
 * 参数：kernel（边缘/模糊/锐化）—— 改了立即重跑，看不同核提取不同特征
 *
 * 卷积神经网络(CNN)的核心操作:拿一个小小的 **卷积核**(几组权重),在整张图上**滑窗**,每滑到一处就把核和
 * 底下那块像素做**加权和(点积)**,得到一个数,拼起来就是**特征图**。妙处在于:同一个核**共享权重**扫全图——
 * 参数极少,还**平移不变**(图上哪儿有这个特征都认得)。不同的核提取不同特征:边缘核在明暗交界处响应最强、
 * 模糊核求邻域平均、锐化核突出中心。深层网络把很多层卷积叠起来,浅层看边缘/纹理、深层拼出物体——这就是
 * CNN "看图"的底,图像分类、检测、分割全靠它。
 *
 * 本实验:5×5 输入(左暗右亮,一条竖直边缘),3×3 卷积核在上面滑 9 个位置,逐格填出 3×3 特征图。
 * 换核看:边缘核在边缘处响应最强、模糊核抹平、锐化核提中心。值全部现算、可核对(每格=核⊙窗口的加权和)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// 5×5 输入：左两列暗(0)、右三列亮(9) —— 一条竖直边缘
const IMG = Array.from({ length: 5 }, () => [0, 0, 9, 9, 9])
const KERNELS: Record<string, number[][]> = {
  '边缘': [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]],
  '模糊': [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]],
  '锐化': [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
}
const OUT = 3   // 5-3+1

export type ConvState = {
  i: number
  step: number
  kernelName: string
  img: number[][]
  kernel: number[][]
  out: (number | null)[][]   // 特征图，null=还没算
  ci: number; cj: number      // 当前窗口左上
  curVal: number
  phase: 'run' | 'done'
  log: string
}

export const CONV_VISIBLE = [
  'step', 'kernelName', 'img', 'kernel', 'out', 'ci', 'cj', 'curVal', 'phase', 'log',
] as const

type Frame = Omit<ConvState, 'i'>

export const convKernel: Kernel<ConvState> = {
  kind: 'conv',

  compile(doc: SimDocument): CompiledModel<ConvState> {
    const kname = String(doc.params?.kernel ?? '边缘')
    const ker = KERNELS[kname] ?? KERNELS['边缘']
    const round2 = (x: number) => +x.toFixed(2)

    const frames: Frame[] = []
    const out: (number | null)[][] = Array.from({ length: OUT }, () => new Array(OUT).fill(null))
    let step = 0
    for (let i = 0; i < OUT; i++) {
      for (let j = 0; j < OUT; j++) {
        let s = 0
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s += IMG[i + a][j + b] * ker[a][b]
        out[i][j] = round2(s)
        const isLast = i === OUT - 1 && j === OUT - 1
        frames.push({
          step: step++, kernelName: kname, img: IMG, kernel: ker.map(r => r.map(round2)),
          out: out.map(r => r.slice()), ci: i, cj: j, curVal: round2(s), phase: 'run',
          log: `核滑到 (${i},${j})：把 3×3 核和底下那块像素**逐位相乘再相加** = **${round2(s)}**,填进特征图。` +
            (kname === '边缘' ? (Math.abs(s) > 5 ? `(这里正好压在边缘上,响应强)` : `(平坦区,响应≈0)`) : ``),
        })
      }
    }

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `${kname}核滑完 9 个位置,生成 3×3 特征图。` +
        (kname === '边缘' ? `**边缘核在明暗交界那两列响应最强(±27)、平坦区≈0**——它"看见"了竖直边缘。`
          : kname === '模糊' ? `模糊核求邻域平均,把边缘**抹平**了。`
            : `锐化核突出中心、压邻域,把边缘**提得更亮**。`) +
        `同一个核**共享权重**扫全图:参数极少、还平移不变(图上哪都认)。把很多层卷积叠起来,浅层看边缘纹理、深层拼物体——` +
        `这就是 CNN 看图的底。换上面的核,看不同特征怎么被提取。`,
    })

    const base0: Frame = {
      step: -1, kernelName: kname, img: IMG, kernel: ker.map(r => r.map(round2)),
      out: Array.from({ length: OUT }, () => new Array(OUT).fill(null)), ci: -1, cj: -1, curVal: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '滑窗位置' },
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
