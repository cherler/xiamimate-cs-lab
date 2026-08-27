/**
 * 内核：反向传播（深度学习算法 · 原理：链式法则怎么把"误差"逐层回传成每个权重的梯度）
 * 轴：step —— 一个神经元先前向算出损失，再让梯度从损失出发、顺着链式法则一站站往回传到每个参数
 *
 * 反向传播是训练神经网络的**发动机**。它分两趟:**前向**——数据从输入流到输出、算出损失 L;**反向**——从 L 出发,
 * 用**链式法则**把"L 对每个中间量的偏导"一站接一站地往回算,最后得到 **L 对每个权重的梯度**,交给梯度下降去更新。
 * 关键就一句话:**下游的梯度 × 本站的局部导数 = 上游的梯度**。sigmoid 这站的局部导数是 a(1−a),乘法这站是"另一个数"……
 * 每站只管自己那点局部导数,链一串就把梯度从损失一路送回了最前面的权重。**一次反向传播就把网络里所有权重的梯度
 * 全算出来了**,和参数量成正比、极高效——这正是深度学习能训练上亿参数的底层原因。
 *
 * 本实验:一个神经元 x=1、w=0.8、b=0.2 → z=wx+b → a=σ(z) → L=(a−t)²(t=1)。前向算出 L=0.072;反向逐站回传:
 * dL/da=2(a−t)=−0.54 → 过 sigmoid ×a(1−a) → dL/dz=−0.11 → dL/dw=dL/dz·x、dL/db=dL/dz。值全部现算、可核对。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const X = 1, W = 0.8, B = 0.2, T = 1
const sig = (v: number) => 1 / (1 + Math.exp(-v))
const Z = W * X + B
const A = sig(Z)
const L = (A - T) ** 2
const dLda = 2 * (A - T)
const dadz = A * (1 - A)
const dLdz = dLda * dadz
const dLdw = dLdz * X
const dLdb = dLdz
const r3 = (v: number) => +v.toFixed(3)

export type BackpropState = {
  i: number
  step: number
  phase: 'forward' | 'back' | 'done'
  x: number; w: number; b: number; t: number
  z: number; a: number; loss: number
  // 已揭示的梯度（反向逐站）
  gLda: number | null
  gLdz: number | null
  gLdw: number | null
  gLdb: number | null
  stage: string              // 当前站
  log: string
}

export const BACKPROP_VISIBLE = [
  'step', 'phase', 'x', 'w', 'b', 't', 'z', 'a', 'loss', 'gLda', 'gLdz', 'gLdw', 'gLdb', 'stage', 'log',
] as const

type Frame = Omit<BackpropState, 'i'>

export const backpropKernel: Kernel<BackpropState> = {
  kind: 'backprop',

  compile(_doc: SimDocument): CompiledModel<BackpropState> {
    const base = { x: X, w: W, b: B, t: T, z: r3(Z), a: r3(A), loss: r3(L) }
    const frames: Frame[] = [
      { step: 0, phase: 'forward', ...base, gLda: null, gLdz: null, gLdw: null, gLdb: null, stage: '前向',
        log: `**前向**:数据从输入流到输出。z=wx+b=**${r3(Z)}**,a=σ(z)=**${r3(A)}**,损失 L=(a−t)²=**${r3(L)}**(t=${T})。` },
      { step: 1, phase: 'back', ...base, gLda: r3(dLda), gLdz: null, gLdw: null, gLdb: null, stage: 'L→a',
        log: `**反向**从损失出发:dL/da = 2(a−t) = **${r3(dLda)}**。这是"损失对输出 a 的敏感度"。` },
      { step: 2, phase: 'back', ...base, gLda: r3(dLda), gLdz: r3(dLdz), gLdw: null, gLdb: null, stage: 'a→z(过 sigmoid)',
        log: `过 **sigmoid** 这站:局部导数 da/dz=a(1−a)=${r3(dadz)}。链式法则:dL/dz = dL/da × da/dz = ${r3(dLda)}×${r3(dadz)} = **${r3(dLdz)}**。` },
      { step: 3, phase: 'back', ...base, gLda: r3(dLda), gLdz: r3(dLdz), gLdw: r3(dLdw), gLdb: r3(dLdb), stage: 'z→w,b',
        log: `到权重:z=wx+b,对 w 的局部导数是 x、对 b 是 1。dL/dw = dL/dz·x = **${r3(dLdw)}**,dL/db = dL/dz = **${r3(dLdb)}**。` },
      { step: 4, phase: 'done', ...base, gLda: r3(dLda), gLdz: r3(dLdz), gLdw: r3(dLdw), gLdb: r3(dLdb), stage: '完成',
        log: `一次反向传播,把 L 对每个权重的梯度全算出来了:dL/dw=${r3(dLdw)}、dL/db=${r3(dLdb)}(都是负的→梯度下降会**增大** w、b,` +
          `把 a 往 t=1 推、损失降)。核心就一句:**下游梯度 × 本站局部导数 = 上游梯度**,链一串把误差从损失回传到最前面的权重。` +
          `一趟就出全部梯度、和参数量成正比——这就是深度学习能训上亿参数的发动机。它和「梯度下降」「残差=梯度高速路」是一条线。`,
      },
    ]

    const base0: Frame = {
      step: -1, phase: 'forward', ...base, gLda: null, gLdz: null, gLdw: null, gLdb: null, stage: '', log: '',
    }

    return {
      axis: { kind: 'step', label: '前向/反向' },
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
