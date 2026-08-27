/**
 * 内核：残差连接 = 梯度高速路（深度学习 · 原理：为什么深网络能训得动）
 * 轴：step —— 让梯度从输出层往输入层一层层倒着传，对比"有残差 vs 没残差"它衰减成什么样
 *
 * 深层网络训练靠反向传播:梯度从损失出发、乘着每一层的局部导数往回传。链式法则=**连乘**。
 * 没有残差:每层局部导数常小于 1(比如 0.8)，N 层连乘 → 0.8^N，**指数衰减**到几乎 0——**梯度消失**，
 *   深层根本收不到有效梯度、学不动(这正是 2015 年前深网络难训的核心)。
 * 残差连接 y = x + f(x):这一层的导数变成 **1 + f'(x)**——那个 **+1 是一条"恒等高速路"**，
 *   让梯度即使 f'(x) 很小也能**原样穿过**，连乘不再塌向 0。于是几十上百层也训得动。
 * ResNet、Transformer 的每个子层(注意力/FFN)都裹着残差,就是这个道理;它也是 LayerNorm 前/后接残差的原因。
 *
 * 本实验:N=16 层,梯度从输出(=1)往回传。没残差每层 ×0.8;有残差每层 ×(1+小扰动)≈1(恒等路兜底)。
 * 你会看到没残差的梯度一路塌到 ~0.03、有残差的稳在 ~1。值全部现算、可核对(连乘、单调衰减 vs 守住)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const N = 16
const PLAIN_FACTOR = 0.8        // 没残差：每层局部导数 <1

function lcg(seed: number) {
  let s = seed >>> 0
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 0x100000000 }
}
// 残差每层因子 = 1 + 小扰动（恒等路给 +1，f'(x) 小且有正负）
const rand = lcg(1234567)
const RES_FACTORS = Array.from({ length: N }, () => 1 + (rand() - 0.5) * 0.3)

export type ResidualState = {
  i: number
  step: number
  layer: number              // 当前倒传到第几层（从 N 到 1）
  depth: number
  gradPlain: number          // 没残差：到这一层的梯度大小
  gradRes: number            // 有残差：到这一层的梯度大小
  plainFactor: number
  resFactor: number          // 这一层的残差因子（1+f'）
  histPlain: number[]        // 历史（画曲线）
  histRes: number[]
  phase: 'run' | 'done'
  log: string
}

export const RESIDUAL_VISIBLE = [
  'step', 'layer', 'depth', 'gradPlain', 'gradRes', 'plainFactor', 'resFactor', 'histPlain', 'histRes', 'phase', 'log',
] as const

type Frame = Omit<ResidualState, 'i'>

export const residualKernel: Kernel<ResidualState> = {
  kind: 'residual',

  compile(_doc: SimDocument): CompiledModel<ResidualState> {
    const frames: Frame[] = []
    let gradPlain = 1, gradRes = 1
    const histPlain = [1], histRes = [1]

    for (let k = 0; k < N; k++) {
      const layer = N - k               // 从第 N 层倒传
      const resFactor = RES_FACTORS[k]
      gradPlain *= PLAIN_FACTOR
      gradRes *= resFactor
      histPlain.push(+gradPlain.toFixed(4))
      histRes.push(+gradRes.toFixed(4))
      frames.push({
        step: k, layer, depth: N,
        gradPlain: +gradPlain.toFixed(4), gradRes: +gradRes.toFixed(4),
        plainFactor: PLAIN_FACTOR, resFactor: +resFactor.toFixed(3),
        histPlain: histPlain.slice(), histRes: histRes.slice(), phase: 'run',
        log: `梯度倒传穿过第 ${layer} 层：没残差 ×${PLAIN_FACTOR} → **${gradPlain.toFixed(3)}**；` +
          `有残差 ×(1+f')=×${resFactor.toFixed(2)} → **${gradRes.toFixed(3)}**。` +
          (gradPlain < 0.1 ? ` 没残差的梯度已经快没了(消失)，有残差的还稳着。` : ``),
      })
    }

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `梯度穿过全部 ${N} 层：**没残差** 每层 ×0.8、连乘塌到 **${lf.gradPlain}**(≈0.8^${N}，梯度消失,深层学不动)；` +
        `**有残差** 因为 y=x+f(x)、导数=1+f'，那条 **+1 恒等高速路**让梯度原样穿过,稳在 **${lf.gradRes}**。` +
        `这就是为什么 ResNet、Transformer 的每个子层都裹残差——它把"连乘衰减"变成"连加穿过",几十上百层才训得动。`,
    })

    const base0: Frame = {
      step: -1, layer: N + 1, depth: N, gradPlain: 1, gradRes: 1, plainFactor: PLAIN_FACTOR, resFactor: 1,
      histPlain: [1], histRes: [1], phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '倒传层数' },
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
