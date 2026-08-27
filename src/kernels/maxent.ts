/**
 * 内核：最大熵原理（信息论 · 原理：softmax/玻尔兹曼分布凭什么"天生合理"）
 * 轴：step —— 给一颗 6 面骰逐步加"期望点数=μ"的约束，求满足约束里**最不武断**(熵最大)的分布
 *
 * 最大熵原理:在所有满足已知约束的概率分布里,选**熵最大**的那个——它对没被约束的部分**不做任何多余假设**,
 * 是"最诚实/最不武断"的分布。数学上可证:给定若干"期望值"约束,最大熵解一定是**指数族**形式 p_i ∝ e^{Σλ·特征},
 * 而给定一个"期望能量"约束时,它正是 **softmax / 玻尔兹曼分布** p_i ∝ e^{λ·E_i}。这就是 softmax、逻辑回归、
 * 玻尔兹曼机"天生合理"的根:它们不是随手一挑,而是**在约束下最大熵**的唯一答案。
 *
 * 本实验:一颗 6 面骰。没有约束时,最大熵=**均匀分布**(熵 log2(6)=2.585,最大)。逐步把"期望点数 μ"从 3.5(公平)
 * 抬到 5.5:最大熵解变成 p_i ∝ e^{λi}(用二分求 λ 使 Σi·p_i=μ),分布往 6 偏、熵一路降(2.585→1.375),
 * 但**每一步都是该约束下熵最高**的分布(对比"两点极端"分布,熵明显更低)。值全部现算、可核对。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const FACES = [1, 2, 3, 4, 5, 6]
const MUS = [3.5, 4.0, 4.5, 5.0, 5.5]

const entropy = (p: number[]) => -p.reduce((a, x) => a + (x > 0 ? x * Math.log2(x) : 0), 0)

// 最大熵解：p_i ∝ e^{λi}，二分 λ 使 Σ i·p_i = μ
function boltzmann(mu: number): number[] {
  const meanOf = (lam: number) => {
    const w = FACES.map(i => Math.exp(lam * i))
    const Z = w.reduce((a, b) => a + b, 0)
    const p = w.map(x => x / Z)
    return { mean: FACES.reduce((a, i, k) => a + i * p[k], 0), p }
  }
  let lo = -3, hi = 3
  for (let t = 0; t < 60; t++) { const m = (lo + hi) / 2; if (meanOf(m).mean < mu) lo = m; else hi = m }
  return meanOf((lo + hi) / 2).p
}
// 对照：同均值的"两点"分布（集中在 ⌊μ⌋、⌈μ⌉），熵会低很多
function twoPoint(mu: number): number[] {
  const lo = Math.floor(mu), hi = Math.ceil(mu)
  const p = new Array(6).fill(0)
  if (lo === hi) { p[lo - 1] = 1; return p }
  const wHi = (mu - lo) / (hi - lo)
  p[lo - 1] = 1 - wHi; p[hi - 1] = wHi
  return p
}

export type MaxEntState = {
  i: number
  step: number
  mu: number
  probs: number[]
  ent: number
  naiveProbs: number[]
  naiveEnt: number
  maxEnt: number             // 均匀分布熵 = log2(6)
  phase: 'run' | 'done'
  log: string
}

export const MAXENT_VISIBLE = [
  'step', 'mu', 'probs', 'ent', 'naiveProbs', 'naiveEnt', 'maxEnt', 'phase', 'log',
] as const

type Frame = Omit<MaxEntState, 'i'>

export const maxentKernel: Kernel<MaxEntState> = {
  kind: 'maxent',

  compile(_doc: SimDocument): CompiledModel<MaxEntState> {
    const frames: Frame[] = []
    const maxEnt = Math.log2(6)

    MUS.forEach((mu, step) => {
      const probs = boltzmann(mu)
      const ent = entropy(probs)
      const naiveProbs = twoPoint(mu)
      const naiveEnt = entropy(naiveProbs)
      frames.push({
        step, mu, probs: probs.map(x => +x.toFixed(3)), ent: +ent.toFixed(3),
        naiveProbs: naiveProbs.map(x => +x.toFixed(3)), naiveEnt: +naiveEnt.toFixed(3), maxEnt: +maxEnt.toFixed(3),
        phase: 'run',
        log: `约束:期望点数 μ=**${mu}**${mu === 3.5 ? '(=公平骰,无额外信息)' : ''}。最大熵解 p_i ∝ e^{λi}:` +
          `熵 = **${ent.toFixed(2)}** bit。` +
          (mu === 3.5 ? `没有约束 → **均匀分布**,熵到顶(${maxEnt.toFixed(2)})。` :
            `分布往 6 偏了,但这仍是所有"均值=${mu}"分布里熵最高的(对比同均值的两点分布只有 ${naiveEnt.toFixed(2)} bit)。`),
      })
    })

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `约束从 μ=3.5 收紧到 5.5:最大熵解从**均匀**(熵 ${maxEnt.toFixed(2)})一路变尖(熵→${lf.ent})——` +
        `**信息越多、可选的最诚实分布越集中**。关键:每一步都是"满足约束里最不武断"的那个分布,形式恒为指数族 p∝e^{λ·特征}。` +
        `给"期望能量"约束时它就是 **softmax/玻尔兹曼分布**——这就是 softmax、逻辑回归、玻尔兹曼机天生合理的根:` +
        `不是随手一挑,是**约束下最大熵**的唯一答案。`,
    })

    const base0: Frame = {
      step: -1, mu: 3.5, probs: new Array(6).fill(1 / 6), ent: maxEnt, naiveProbs: new Array(6).fill(0),
      naiveEnt: 0, maxEnt: +maxEnt.toFixed(3), phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '期望约束 μ' },
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
