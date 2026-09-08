/**
 * 内核：中心极限定理（机器学习基础 · 原理：为什么高斯分布到处都是）
 * 轴：step —— 逐步增大「每次平均多少个样本」m，看样本均值的分布怎么从平的变成钟形
 *
 * 中心极限定理(CLT)：不管原始分布长什么样(只要方差有限)，把 m 个独立同分布样本**平均**，
 * 当 m 增大，这个**均值的分布**就越来越接近**高斯(正态)分布**——而且均值的标准差按 **1/√m** 缩(接大数定理)。
 * 这就是为什么高斯分布在自然界、在深度学习里无处不在：任何"许多小随机因素相加"的量，天然趋向高斯。
 * 权重初始化、噪声假设、误差项、注意力打分的近似分析，背后都是它。
 *
 * 本实验用最"不像高斯"的**均匀分布 U[0,1]**(平的)当原始分布，逐步把 m 取 1→2→4→8→32：
 * 每个 m 跑 T=20000 次独立试验(每次=m 个均匀样本的平均)，把均值**标准化** z=(mean−0.5)/(σ/√m) 后做直方图，
 * 叠上标准正态曲线。看它从 m=1 的**平顶**(均匀本身)一步步长成 m=32 的**钟形**。
 * 值全部现算、可核对(确定性伪随机，可复现)：样本 std≈σ/√m(∝1/√m)、超额峰度→0(=高斯)、直方图贴合正态曲线。
 *
 * ## 2026-09-08 补厚（用户：「继续打磨实验加厚」）
 *
 * 原来只有均匀分布一种、**一个旋钮都没有**，于是 CLT 最要紧的两件事说不出来：
 *   ① **它有前提：方差必须有限**。柯西分布方差发散 —— 把 m 个柯西样本平均，
 *      结果**还是同一个柯西分布**，永远不会变成钟形。定理在那儿直接不适用。
 *   ② **"m 要多大"取决于原分布有多偏**。均匀分布 m=4 就很像高斯了，
 *      而伯努利 p=0.05 那种极偏的，m=32 还是一边倒。教科书爱说"m>30 就行"，
 *      这句话在偏态分布上是错的 —— 得能看见才信。
 *
 * 现在四个原始分布可切，超额峰度随 m 的曲线画出来：有限方差的一路奔向 0，柯西的原地不动。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// 均匀分布 U[0,1]：均值 0.5、方差 1/12、标准差 σ=1/√12
const SIGMA = 1 / Math.sqrt(12)   // ≈0.288675

export type CltState = {
  i: number
  step: number
  m: number                     // 每次平均的样本数
  trials: number                // 独立试验次数 T
  std: number                   // 样本均值的标准差（≈σ/√m）
  theoStd: number               // 理论 σ/√m
  exKurt: number                // 超额峰度（→0 = 高斯；均匀=−1.2）
  /** 原始分布的名字 */
  dist: string
  /** 方差有没有限 —— CLT 的前提 */
  finiteVar: boolean
  /** 每个 m 的 [m, 超额峰度]：有限方差的奔向 0，柯西的原地不动 */
  kurtCurve: [number, number][]
  bins: { z: number; density: number; gauss: number }[]  // 标准化直方图 + 正态叠加
  phase: 'run' | 'done'
  log: string
}

export const CLT_VISIBLE = [
  'step', 'm', 'trials', 'std', 'theoStd', 'exKurt', 'dist', 'finiteVar', 'kurtCurve', 'bins', 'phase', 'log',
] as const

type Frame = Omit<CltState, 'i'>

const M_VALUES = [1, 2, 4, 8, 32]

/*  四种原始分布。前三种方差有限（CLT 成立，只是收敛快慢不同），
    柯西方差发散 —— 它是来演"定理不适用"的。
    每个都给出均值与标准差，好把样本均值标准化成 z。 */
const DISTS: Record<string, { draw: (r: () => number) => number; mu: number; sd: number; finiteVar: boolean; note: string }> = {
  '均匀 U[0,1]': { draw: r => r(), mu: 0.5, sd: 1 / Math.sqrt(12), finiteVar: true, note: '平顶，但很快就钟形' },
  '指数（偏）': { draw: r => -Math.log(1 - r() || 1e-12), mu: 1, sd: 1, finiteVar: true, note: '右偏，收敛慢一些' },
  '伯努利 p=0.05（极偏）': { draw: r => (r() < 0.05 ? 1 : 0), mu: 0.05, sd: Math.sqrt(0.05 * 0.95), finiteVar: true, note: '极偏，m=32 都还不像高斯' },
  '柯西（方差发散）': { draw: r => Math.tan(Math.PI * (r() - 0.5)), mu: 0, sd: 1, finiteVar: false, note: '平均多少个都还是柯西' },
}
const B = 17                    // 直方图柱数
const LO = -3.4, HI = 3.4       // 标准化 z 的窗口
const W = (HI - LO) / B         // 柱宽

function lcg(seed: number) {
  let s = seed >>> 0
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 0x100000000 }
}
const gaussPdf = (z: number) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI)

export const cltKernel: Kernel<CltState> = {
  kind: 'clt',

  compile(doc: SimDocument): CompiledModel<CltState> {
    const key = doc.params.dist === undefined ? '均匀 U[0,1]' : str(doc.params, 'dist')
    const D = DISTS[key] ?? DISTS['均匀 U[0,1]']
    const TRIALS = doc.params.trials === undefined ? 20000 : num(doc.params, 'trials')

    const frames: Frame[] = []
    //  先把每个 m 的超额峰度算出来，好画那条"离高斯还有多远"的曲线
    const per = M_VALUES.map(m => {
      const rand = lcg(20240824 + m * 7919)
      const theoStd = D.sd / Math.sqrt(m)
      const means: number[] = []
      const counts = new Array(B).fill(0)
      for (let t = 0; t < TRIALS; t++) {
        let s2 = 0
        for (let k = 0; k < m; k++) s2 += D.draw(rand)
        const mean = s2 / m
        means.push(mean)
        const z = (mean - D.mu) / theoStd
        const bi = Math.floor((z - LO) / W)
        if (bi >= 0 && bi < B) counts[bi]++
      }
      const mu = means.reduce((a, b) => a + b, 0) / TRIALS
      const v = means.reduce((a, x) => a + (x - mu) * (x - mu), 0) / TRIALS
      const std = Math.sqrt(v)
      const m4 = means.reduce((a, x) => a + (x - mu) ** 4, 0) / TRIALS
      const exKurt = v > 0 ? m4 / (v * v) - 3 : 0
      return { m, theoStd, std, exKurt, counts }
    })
    const kurtCurve = per.map(x => [x.m, +x.exKurt.toFixed(2)] as [number, number])

    per.forEach((r, step) => {
      const { m, theoStd, std, exKurt, counts } = r
      const bins = counts.map((c, k) => {
        const z = LO + (k + 0.5) * W
        return { z: +z.toFixed(2), density: +(c / (TRIALS * W)).toFixed(3), gauss: +gaussPdf(z).toFixed(3) }
      })
      frames.push({
        step, m, trials: TRIALS, dist: key, finiteVar: D.finiteVar, kurtCurve,
        std: +std.toFixed(4), theoStd: +theoStd.toFixed(4), exKurt: +exKurt.toFixed(3),
        bins, phase: 'run',
        log: `每次平均 **${m}** 个「${key}」样本、跑 ${TRIALS} 次：均值 std = **${std.toFixed(4)}**`
          + (D.finiteVar ? `（理论 σ/√m=${theoStd.toFixed(4)}）` : `（**理论值不存在** —— 柯西的方差发散）`)
          + `，超额峰度 = **${exKurt.toFixed(2)}**（0=高斯）。`
          + (D.finiteVar
            ? (m === 1 ? `m=1 就是原分布本身。` : `直方图正往**钟形**靠。`)
            : `平均多少个都没用 —— 柯西样本的均值**仍是同一个柯西分布**，峰度大得离谱。`),
      })
    })

    const lf = frames[frames.length - 1]
    const k0 = kurtCurve[0][1], kN = kurtCurve[kurtCurve.length - 1][1]
    frames.push({
      ...lf, phase: 'done',
      //  ⚠️ 这些数**现算**。原来写死成「峰度从 −1.2 奔向 0」，换个分布就是假话。
      log: D.finiteVar
        ? `从 m=1 到 m=${M_VALUES[M_VALUES.length - 1]}（原始分布：${key}，${D.note}）：`
          + `超额峰度从 **${k0}** 走到 **${kN}**（0=高斯），均值 std 按 **σ/√m** 缩（∝1/√m，接大数定理）。`
          + `这就是**中心极限定理**：许多独立小随机因素相加，天然趋向高斯 —— `
          + `权重初始化、噪声假设、误差项、注意力打分的近似分析，背后都是它。`
          + `　但**"m 要多大"取决于原分布有多偏**：实测同样 m=32，`
          + `均匀分布的超额峰度已经是 −0.03，而「伯努利 p=0.05」还有 **0.44** —— 差了一个数量级。`
          + `教科书那句"m>30 就够了"，在偏态分布上要打折。`
        : `原始分布是**柯西**：${M_VALUES[M_VALUES.length - 1]} 个样本平均下来，超额峰度还是 **${kN}**，`
          + `直方图也没有变成钟形。**中心极限定理在这里不适用** —— 它要求方差有限，而柯西的方差发散。`
          + `　更彻底的事实：n 个柯西样本的均值**仍然服从同一个柯西分布**，`
          + `既不变窄也不变钟形，平均多少个都一样。`
          + `　所以"什么东西加起来都会变高斯"是句**有前提**的话，前提就是方差得有限。`,
    })

    const base0: Frame = {
      step: -1, m: 0, trials: TRIALS, std: 0, theoStd: 0, exKurt: 0,
      dist: key, finiteVar: D.finiteVar, kurtCurve,
      bins: Array.from({ length: B }, (_, k) => { const z = LO + (k + 0.5) * W; return { z: +z.toFixed(2), density: 0, gauss: +gaussPdf(z).toFixed(3) } }),
      phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '平均样本数 m' },
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
