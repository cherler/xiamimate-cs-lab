/**
 * 内核：逻辑回归（机器学习算法 · 原理：把"拟合直线"改造成"分两类"）
 * 轴：step —— 两类散点，梯度下降转动一条决策边界，把它们分开；用 sigmoid 出概率、交叉熵当损失
 *
 * 线性回归拟合连续值,逻辑回归把它改造成**分类**:先算一个线性打分 z = w₁x + w₂y + b,再用 **sigmoid** 把 z 压到
 * (0,1) 当作"属于第 1 类的概率"。学习目标从 MSE 换成**交叉熵**(对数损失)——预测概率离真实标签越远,罚得越狠。
 * 同样是梯度下降调 w、b,让一条**决策边界**(z=0 那条线)转到能把两类分开的位置:边界一侧概率>0.5 判 1、另一侧判 0。
 * 它是最基础的分类器,也是**单个神经元 + sigmoid** 的样子——理解它,就摸到了神经网络最小的那块砖。
 *
 * 本实验:两类各 9 个点(大致线性可分),w、b 从 0、lr=0.3 梯度下降。看决策边界从乱位置转到两类之间、
 * 交叉熵从 0.69 降到 0.03、准确率 50%→100%。值全部现算、可核对(sigmoid、交叉熵单调降、边界分开两类)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}
const rnd = lcg(5)
const POINTS: { x: number; y: number; c: number }[] = []
for (let i = 0; i < 9; i++) POINTS.push({ x: +(-1 + rnd() * 1.6).toFixed(3), y: +(-1 + rnd() * 1.6).toFixed(3), c: 0 })
for (let i = 0; i < 9; i++) POINTS.push({ x: +(1 + rnd() * 1.6).toFixed(3), y: +(1 + rnd() * 1.6).toFixed(3), c: 1 })
const N = POINTS.length
const LR = 0.3
const STEPS = [0, 3, 8, 20, 40, 60]
const sig = (z: number) => 1 / (1 + Math.exp(-z))

export type LogRegState = {
  i: number
  step: number
  gdStep: number
  w1: number; w2: number; b: number
  loss: number
  acc: number
  points: { x: number; y: number; c: number }[]
  phase: 'run' | 'done'
  log: string
}

export const LOGREG_VISIBLE = [
  'step', 'gdStep', 'w1', 'w2', 'b', 'loss', 'acc', 'points', 'phase', 'log',
] as const

type Frame = Omit<LogRegState, 'i'>

const lossOf = (w1: number, w2: number, b: number) => {
  let L = 0
  for (const p of POINTS) { const pr = sig(w1 * p.x + w2 * p.y + b); L += -(p.c * Math.log(pr + 1e-9) + (1 - p.c) * Math.log(1 - pr + 1e-9)) }
  return L / N
}
const accOf = (w1: number, w2: number, b: number) => {
  let a = 0
  for (const p of POINTS) if ((sig(w1 * p.x + w2 * p.y + b) >= 0.5 ? 1 : 0) === p.c) a++
  return a / N
}

export const logregKernel: Kernel<LogRegState> = {
  kind: 'logreg',

  compile(_doc: SimDocument): CompiledModel<LogRegState> {
    const traj: { w1: number; w2: number; b: number }[] = []
    let w1 = 0, w2 = 0, b = 0
    for (let s = 0; s <= 60; s++) {
      traj.push({ w1, w2, b })
      let g1 = 0, g2 = 0, gb = 0
      for (const p of POINTS) { const e = sig(w1 * p.x + w2 * p.y + b) - p.c; g1 += e * p.x / N; g2 += e * p.y / N; gb += e / N }
      w1 -= LR * g1; w2 -= LR * g2; b -= LR * gb
    }

    const frames: Frame[] = []
    STEPS.forEach((gd, idx) => {
      const { w1, w2, b } = traj[gd]
      const loss = lossOf(w1, w2, b), acc = accOf(w1, w2, b)
      frames.push({
        step: idx, gdStep: gd, w1: +w1.toFixed(3), w2: +w2.toFixed(3), b: +b.toFixed(3),
        loss: +loss.toFixed(3), acc: +acc.toFixed(3), points: POINTS, phase: 'run',
        log: `第 ${gd} 步：交叉熵损失 **${loss.toFixed(3)}**、准确率 **${(acc * 100).toFixed(0)}%**。` +
          (gd === 0 ? ` 边界还没定(w=b=0),概率全 0.5、蒙对一半。` : ` 决策边界往两类中间转,分得越来越开。`),
      })
    })

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `梯度下降 60 步:交叉熵从 0.69 降到 **${lf.loss}**、准确率到 **${(lf.acc * 100).toFixed(0)}%**,决策边界把两类干净分开。` +
        `逻辑回归=线性打分 z → **sigmoid** 出概率 → **交叉熵**当损失 → 梯度下降调 w、b。它就是**单个神经元 + sigmoid**——` +
        `理解它就摸到了神经网络最小的那块砖。和线性回归同一套骨架,只是把"拟合连续值"换成了"分两类"。`,
    })

    const base0: Frame = {
      step: -1, gdStep: 0, w1: 0, w2: 0, b: 0, loss: +lossOf(0, 0, 0).toFixed(3), acc: +accOf(0, 0, 0).toFixed(3),
      points: POINTS, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '梯度下降步' },
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
