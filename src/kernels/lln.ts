/**
 * 内核：大数定理 / 蒙特卡洛（机器学习基础 · 原理：为什么"多采样就准"）
 * 轴：step —— 逐步增大撒点数 n，用蒙特卡洛估 π，看估计怎么收敛、误差怎么随 1/√n 缩
 *
 * 大数定理：独立同分布样本的**均值**，随样本数 n 增大**收敛到期望**；而估计的**误差随 √n 缩小**
 * （标准误 ∝ 1/√n，来自方差可加——n 个独立项相加、方差涨 n 倍、std 涨 √n，均值的 std 就 ∝ 1/√n）。
 * 这是采样、蒙特卡洛、dropout、MoE 路由"平均下来对"的底：单次随机不可靠，多次平均就稳。
 *
 * 经典演示——蒙特卡洛估 π：在单位正方形里随机撒 n 个点，落进 1/4 圆(x²+y²≤1)的比例 × 4 ≈ π。
 * 逐步把 n 从 50 加到 12800。**单条随机路径太吵**，说明不了"1/√n"，所以每个 n 跑 T=40 次**独立**试验、
 * 报告 **RMS 误差**（√(均方误差)）。理论上单次估计 4·p̂ 的方差 = 16·p(1-p)/n（p=π/4），于是
 * RMS 误差 ≈ 4·√(p(1-p)) / √n ≈ **1.64/√n**——所以 **RMS误差×√n ≈ 1.64 恒定**，把"误差∝1/√n"钉死。
 * 场上同时展示第 0 次试验的散点(可视化)。值全部现算、可核对（确定性伪随机，可复现）。
 *
 * ## 2026-09-08 补厚（用户：「继续往下做」）
 *
 * 统计这一半原来就写得不错（40 次独立试验、RMS 误差、×√n 恒定），但**一个旋钮都没有**，
 * 于是最要紧的一件事没法问：**大数定理有前提**。它要求样本的**期望存在**。
 * 柯西分布（重尾到没有期望）会当场违背它 —— 样本均值**不收敛**，
 * 你采一百万个点，均值照样在乱跳，RMS×√n 不但不恒定，还会**一路涨**。
 * 老版本只演"多采就准"，等于把这条定理讲成了无条件的。
 *
 * 现在三个分布可切：
 *   · **蒙特卡洛估 π**（有界，方差有限）—— ×√n 恒定，教科书样子；
 *   · **正态均值**（方差有限）—— 同样恒定，换个量再确认一遍；
 *   · **柯西均值**（**没有期望**）—— 均值不收敛、×√n 一路涨。定理的前提第一次露面。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const PI = Math.PI

export type LlnState = {
  i: number
  step: number
  n: number                    // 每次试验的撒点数
  trials: number               // 独立试验次数 T
  /** 在估什么：π / 正态均值 / 柯西均值（没有期望） */
  target: string
  /** 真值（柯西没有期望，这里放 0 只是画线用，日志里说清楚） */
  truth: number
  /** 这个分布**有没有期望** —— 大数定理的前提 */
  hasMean: boolean
  /** 每个 n 的 [n, RMS×√n]，画那条"是不是恒定"的曲线 */
  ratioCurve: [number, number][]
  estimate: number             // 第 0 次试验的 π 估计（与散点一致）
  meanEst: number              // T 次估计的均值（≈π，体现无偏）
  rmsError: number             // T 次的 RMS 误差 = √(mean((est-π)²))
  rmsErrSqrtN: number          // RMS误差×√n（≈1.64 恒定，体现 1/√n）
  inside: number               // 第 0 次试验落进 1/4 圆的点数
  points: { x: number; y: number; in: boolean }[]  // 第 0 次试验的散点（截断展示）
  phase: 'run' | 'done'
  log: string
}

export const LLN_VISIBLE = [
  'step', 'n', 'trials', 'target', 'truth', 'hasMean', 'ratioCurve',
  'estimate', 'meanEst', 'rmsError', 'rmsErrSqrtN', 'inside', 'points', 'phase', 'log',
] as const

type Frame = Omit<LlnState, 'i'>

const N_VALUES = [50, 200, 800, 3200, 12800]
const SHOW_MAX = 400 // 散点最多画这么多（大 n 只抽样展示）

function lcg(seed: number) {
  let s = seed >>> 0
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 0x100000000 }
}

/*  三种被估的量。前两种期望存在（大数定理成立），第三种**没有期望** —— 它是来砸场子的。
    柯西：用 tan(π(u−0.5)) 生成；它的尾巴重到积分发散，样本均值本身还是柯西分布，
    **不随 n 变窄**，所以怎么采都不收敛。这正是"大数定理有前提"最干净的反例。 */
const TARGETS: Record<string, { truth: number; draw: (r: () => number) => number; unit: string }> = {
  '蒙特卡洛估 π': { truth: Math.PI, unit: 'π', draw: r => { const x = r(), y = r(); return x * x + y * y <= 1 ? 4 : 0 } },
  '正态均值': { truth: 0, unit: '均值', draw: r => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()) },
  '柯西均值（没有期望）': { truth: 0, unit: '均值', draw: r => Math.tan(Math.PI * (r() - 0.5)) },
}

export const llnKernel: Kernel<LlnState> = {
  kind: 'lln',

  compile(doc: SimDocument): CompiledModel<LlnState> {
    const key = doc.params.target === undefined ? '蒙特卡洛估 π' : str(doc.params, 'target')
    const TG = TARGETS[key] ?? TARGETS['蒙特卡洛估 π']
    const TRIALS = doc.params.trials === undefined ? 40 : num(doc.params, 'trials')
    const isPi = key === '蒙特卡洛估 π'
    const hasMean = !key.startsWith('柯西')

    const frames: Frame[] = []
    //  先把每个 n 的 RMS×√n 都算出来，好画那条"是不是恒定"的曲线
    const stats = N_VALUES.map(n => {
      const ests: number[] = []
      for (let t = 0; t < TRIALS; t++) {
        const rand = lcg(20240824 + t * 2654435761)
        let sum = 0
        for (let k = 0; k < n; k++) sum += TG.draw(rand)
        ests.push(sum / n)
      }
      const meanEst = ests.reduce((a, b) => a + b, 0) / TRIALS
      const rms = Math.sqrt(ests.reduce((a, e) => a + (e - TG.truth) ** 2, 0) / TRIALS)
      return { n, ests, meanEst, rms, ratio: rms * Math.sqrt(n) }
    })
    const ratioCurve = stats.map(x => [x.n, +x.ratio.toFixed(2)] as [number, number])

    stats.forEach((st, step) => {
      const { n, ests, meanEst, rms, ratio } = st
      //  散点只有 π 那一档有意义（它本来就是在正方形里撒点）
      let firstInside = 0
      let firstPoints: { x: number; y: number; in: boolean }[] = []
      if (isPi) {
        const rand = lcg(20240824)
        const showEvery = Math.max(1, Math.floor(n / SHOW_MAX))
        for (let k = 0; k < n; k++) {
          const x = rand(), y = rand()
          const isIn = x * x + y * y <= 1
          if (isIn) firstInside++
          if (k % showEvery === 0 && firstPoints.length < SHOW_MAX) firstPoints.push({ x: +x.toFixed(3), y: +y.toFixed(3), in: isIn })
        }
      }
      frames.push({
        step, n, trials: TRIALS, target: key, truth: TG.truth, hasMean, ratioCurve,
        estimate: +ests[0].toFixed(4), meanEst: +meanEst.toFixed(4),
        rmsError: +rms.toFixed(4), rmsErrSqrtN: +ratio.toFixed(2),
        inside: firstInside, points: firstPoints, phase: 'run',
        log: `每次取 **${n}** 个样本、跑 ${TRIALS} 次独立试验：均值估计 **${meanEst.toFixed(3)}**`
          + (hasMean ? `（≈真值 ${TG.truth.toFixed(3)}，无偏）` : `（**没有真值可言** —— 柯西分布的期望积分发散）`)
          + `，RMS 误差 **${rms.toFixed(3)}**，RMS×√n = **${ratio.toFixed(2)}**。`
          + (hasMean
            ? `n 越大误差越小，而 ×√n 后≈常数 —— 误差按 **1/√n** 缩。`
            : `注意 ×√n **不是常数、还在涨** —— 大数定理在这里**不成立**。`),
      })
    })

    const lastN = N_VALUES[N_VALUES.length - 1]
    const lf = frames[frames.length - 1]
    const r0 = ratioCurve[0][1], rN = ratioCurve[ratioCurve.length - 1][1]
    frames.push({
      ...lf, phase: 'done',
      //  ⚠️ 这几个数**现算**。原来写死成「≈3.14159」「×√n ≈ 1.64」，换个分布就全是假话。
      log: hasMean
        ? `从 50 个样本到 ${lastN} 个：均值估计始终 ≈真值（无偏），RMS 误差一路变小。`
          + `关键看 **RMS×√n 基本恒定**（${r0} → ${rN}）—— 这就是"误差 ∝ 1/√n"：样本翻 4 倍、误差才减半。`
          + `大数定理 + 方差可加的直接体现，也是采样、蒙特卡洛、dropout、MoE 路由"多次平均就稳"的底。`
          + `　**但它有前提**：样本的期望得存在。把「在估什么」换成**柯西均值**试试 —— 那条曲线会当场翻脸。`
        : `从 50 个样本到 ${lastN} 个：**均值根本没有收敛**。RMS×√n 从 ${r0} 涨到 ${rN}，`
          + `完全不是常数 —— 大数定理在这里**不成立**。`
          + `　原因：柯西分布的尾巴重到**期望的积分发散**，它压根没有"平均值"这个东西可收敛；`
          + `而且 n 个柯西样本的均值**仍然是同一个柯西分布**，不随 n 变窄，采一百万个也一样在跳。`
          + `　这就是为什么"多采样就准"是一条**有条件**的定理，而不是一句口号。`,
    })

    const base0: Frame = {
      step: -1, n: 0, trials: TRIALS, target: key, truth: TG.truth, hasMean, ratioCurve,
      estimate: 0, meanEst: 0, rmsError: 0, rmsErrSqrtN: 0, inside: 0, points: [], phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '撒点数 n' },
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
