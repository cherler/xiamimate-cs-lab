/**
 * 内核：逻辑回归（机器学习算法 · 原理：把"拟合直线"改造成"分两类"）
 * 轴：step —— 两类散点，梯度下降转动一条决策边界，把它们分开；用 sigmoid 出概率、交叉熵当损失
 *
 * 线性回归拟合连续值,逻辑回归把它改造成**分类**:先算一个线性打分 z = w₁x + w₂y + b,再用 **sigmoid** 把 z 压到
 * (0,1) 当作"属于第 1 类的概率"。学习目标从 MSE 换成**交叉熵**(对数损失)——预测概率离真实标签越远,罚得越狠。
 * 同样是梯度下降调 w、b,让一条**决策边界**(z=0 那条线)转到能把两类分开的位置:边界一侧概率>0.5 判 1、另一侧判 0。
 * 它是最基础的分类器,也是**单个神经元 + sigmoid** 的样子——理解它,就摸到了神经网络最小的那块砖。
 *
 * 本实验:两类散点,w、b 从 0 出发梯度下降。看决策边界从乱位置转到两类之间、交叉熵降、准确率升。
 * 值全部现算、可核对(sigmoid、交叉熵单调降、边界分开两类)。
 *
 * ## 2026-09-08 补厚（用户：「继续打磨实验加厚」）
 *
 * 原来数据写死成"大致线性可分"的两团、**一个旋钮都没有**。于是这个模型最要紧的两件事演不出来：
 *
 *   ① **它只会画直线。** 换成**异或**那种排布，怎么练都分不开 —— 实测准确率**卡在 50%**（＝瞎猜），
 *      ‖w‖ 只涨到 0.19 就不动了：往任何方向转都不会更好，模型自己"放弃"了。
 *      这不是没练够，是**线性模型的天花板**，也正是神经网络要加隐藏层的原因。
 *      老版本只给可分数据，等于让人以为逻辑回归什么都能分。
 *      （⚠️ 我原本按印象在这儿写"卡在 75%"，一跑数据是 50% —— 又一次「别按记忆填数」。）
 *
 *   ② **完全可分 + 不加正则 → 权重一直涨。** 数据能被完全分开时最大似然解**不存在**：
 *      边界越推越陡、损失趋近 0 但永远到不了，‖w‖ 没有上界。
 *      实测 140 步后 λ=0 时 ‖w‖=3.03 还在涨；λ=0.05 停在 1.81、λ=0.2 停在 1.13。
 *      把 ‖w‖ 画出来，"正则项到底在管什么"才第一次看得见。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}
const sig = (z: number) => 1 / (1 + Math.exp(-z))
const STEPS = [0, 3, 8, 20, 40, 60, 90, 140]

/*  三种数据。前两种线性（可）分，第三种是**异或** —— 逻辑回归的天花板就在那儿。 */
function makePoints(kind: string): { x: number; y: number; c: number }[] {
  const rnd = lcg(5)
  const P: { x: number; y: number; c: number }[] = []
  const r3 = (v: number) => +v.toFixed(3)
  if (kind === '异或（线性不可分）') {
    //  四个角：左下/右上一类，左上/右下另一类。没有任何一条直线能分开它们
    const corners: [number, number, number][] = [[-1.2, -1.2, 0], [1.2, 1.2, 0], [-1.2, 1.2, 1], [1.2, -1.2, 1]]
    for (const [cx, cy, c] of corners) for (let i = 0; i < 5; i++) P.push({ x: r3(cx + rnd() * 0.9), y: r3(cy + rnd() * 0.9), c })
    return P
  }
  //  '有重叠' 把两团往中间挪，制造几个分不开的点
  const gap = kind === '有重叠' ? 0.35 : 1
  for (let i = 0; i < 9; i++) P.push({ x: r3(-gap + rnd() * 1.6), y: r3(-gap + rnd() * 1.6), c: 0 })
  for (let i = 0; i < 9; i++) P.push({ x: r3(gap + rnd() * 1.6), y: r3(gap + rnd() * 1.6), c: 1 })
  return P
}

export type LogRegState = {
  i: number
  step: number
  gdStep: number
  w1: number; w2: number; b: number
  loss: number
  acc: number
  /** ‖w‖ —— 完全可分且没有正则时它会一直涨（最大似然解不存在） */
  wNorm: number
  /** 数据形状 / L2 系数 */
  data: string
  l2: number
  /** 每一帧的 [步, 准确率] 和 [步, ‖w‖]，画两条曲线 */
  accCurve: [number, number][]
  normCurve: [number, number][]
  /** 这份数据线性可分吗（异或那档为 false）—— 决定"练不出来"是模型问题还是训练问题 */
  separable: boolean
  points: { x: number; y: number; c: number }[]
  phase: 'run' | 'done'
  log: string
}

export const LOGREG_VISIBLE = [
  'step', 'gdStep', 'w1', 'w2', 'b', 'loss', 'acc', 'wNorm', 'data', 'l2',
  'accCurve', 'normCurve', 'separable', 'points', 'phase', 'log',
] as const

type Frame = Omit<LogRegState, 'i'>



export const logregKernel: Kernel<LogRegState> = {
  kind: 'logreg',

  compile(doc: SimDocument): CompiledModel<LogRegState> {
    const kind = doc.params.data === undefined ? '线性可分' : str(doc.params, 'data')
    const LR = doc.params.lr === undefined ? 0.3 : num(doc.params, 'lr') / 100
    const L2 = doc.params.l2 === undefined ? 0 : num(doc.params, 'l2') / 1000
    const POINTS = makePoints(kind)
    const N = POINTS.length
    const separable = kind !== '异或（线性不可分）'

    const lossOf = (w1: number, w2: number, b: number) => {
      let L = 0
      for (const p of POINTS) {
        const pr = sig(w1 * p.x + w2 * p.y + b)
        L += -(p.c * Math.log(pr + 1e-9) + (1 - p.c) * Math.log(1 - pr + 1e-9))
      }
      //  L2 那一项也算进损失里，否则"加了正则损失反而更低"会让人看糊涂
      return L / N + L2 / 2 * (w1 * w1 + w2 * w2)
    }
    const accOf = (w1: number, w2: number, b: number) => {
      let a = 0
      for (const p of POINTS) if ((sig(w1 * p.x + w2 * p.y + b) >= 0.5 ? 1 : 0) === p.c) a++
      return a / N
    }

    const MAXS = STEPS[STEPS.length - 1]
    const traj: { w1: number; w2: number; b: number }[] = []
    let w1 = 0, w2 = 0, b = 0
    for (let s2 = 0; s2 <= MAXS; s2++) {
      traj.push({ w1, w2, b })
      let g1 = 0, g2 = 0, gb = 0
      for (const p of POINTS) {
        const e = sig(w1 * p.x + w2 * p.y + b) - p.c
        g1 += e * p.x / N; g2 += e * p.y / N; gb += e / N
      }
      //  L2 的梯度：+λw（只罚权重不罚偏置，跟常见实现一致）
      w1 -= LR * (g1 + L2 * w1); w2 -= LR * (g2 + L2 * w2); b -= LR * gb
    }

    const normOf = (t: { w1: number; w2: number }) => Math.hypot(t.w1, t.w2)
    const accCurve = STEPS.map(g => [g, +accOf(traj[g].w1, traj[g].w2, traj[g].b).toFixed(3)] as [number, number])
    const normCurve = STEPS.map(g => [g, +normOf(traj[g]).toFixed(2)] as [number, number])

    const frames: Frame[] = []
    STEPS.forEach((gd, idx) => {
      const t = traj[gd]
      const loss = lossOf(t.w1, t.w2, t.b), acc = accOf(t.w1, t.w2, t.b)
      frames.push({
        step: idx, gdStep: gd, w1: +t.w1.toFixed(3), w2: +t.w2.toFixed(3), b: +t.b.toFixed(3),
        loss: +loss.toFixed(3), acc: +acc.toFixed(3), wNorm: +normOf(t).toFixed(2),
        data: kind, l2: L2, accCurve, normCurve, separable, points: POINTS, phase: 'run',
        log: `第 ${gd} 步：交叉熵 **${loss.toFixed(3)}**、准确率 **${(acc * 100).toFixed(0)}%**、‖w‖ = **${normOf(t).toFixed(2)}**。`
          + (gd === 0 ? ` 边界还没定（w=b=0），概率全 0.5、蒙对一半。`
            : separable ? ` 决策边界往两类中间转，分得越来越开。`
            : ` 边界还在转，但**这份数据一条直线分不开** —— 准确率上不去。`),
      })
    })

    const lf = frames[frames.length - 1]
    const n0 = normCurve[0][1], nN = normCurve[normCurve.length - 1][1]
    frames.push({
      ...lf, phase: 'done',
      //  ⚠️ 这些数**现算**。原来写死成「交叉熵从 0.69 降到…准确率到 100%」，换份数据就是假话。
      log: separable
        ? `梯度下降 ${MAXS} 步（数据「${kind}」、学习率 ${LR}、L2 ${L2}）：`
          + `交叉熵降到 **${lf.loss}**、准确率 **${(lf.acc * 100).toFixed(0)}%**。`
          + `逻辑回归 = 线性打分 z → **sigmoid** 出概率 → **交叉熵**当损失 → 梯度下降调 w、b。`
          + `它就是**单个神经元 + sigmoid**，理解它就摸到了神经网络最小的那块砖。`
          + (L2 === 0 && lf.acc >= 0.999
            ? `　⚠️ 顺带看一个经典现象：数据被**完全分开**时，最大似然解**不存在** —— `
              + `‖w‖ 从 ${n0} 一路涨到 **${nN}** 还在涨（边界越推越陡，损失趋近 0 但永远到不了）。`
              + `把 L2 调到 0.2 再看：‖w‖ 会稳在 1.13 左右不再涨，而准确率照样 100% —— 正则项管的就是这个。`
            : L2 > 0
              ? `　这一档开了 L2=${L2}：‖w‖ 稳在 **${nN}** 不再乱涨 —— 正则项就是干这个的。`
              : ``)
        : `数据是**异或**排布：练了 ${MAXS} 步，准确率卡在 **${(lf.acc * 100).toFixed(0)}%** 就上不去了。`
          + `这**不是没练够**，是**线性模型的天花板** —— 逻辑回归的决策边界永远是一条直线，`
          + `而异或的两类互相插花，任何一条直线都分不开。`
          + `　这正是神经网络要加**隐藏层**的原因：先把点非线性地搬到另一个空间，再在那儿画直线。`
          + `单个神经元做不到的事，两层就能做到 —— 这条边界是 1969 年 Minsky 那本书里的著名论断。`,
    })

    const base0: Frame = {
      step: -1, gdStep: 0, w1: 0, w2: 0, b: 0, loss: +lossOf(0, 0, 0).toFixed(3), acc: +accOf(0, 0, 0).toFixed(3),
      wNorm: 0, data: kind, l2: L2, accCurve, normCurve, separable, points: POINTS, phase: 'run', log: '',
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
