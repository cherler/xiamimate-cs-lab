/**
 * 内核：√d 缩放（大模型推理 · 原理：为什么注意力要除以 √d_k）
 * 轴：d —— 逐个增大维度，看三种缩放下的 softmax 各自怎么变
 *
 * 注意力分数 Q·K 是 **d 个乘积之和**。Q、K 每一维独立、均值 0、方差 1 ⇒ 每个乘积均值 0、方差 1，
 * d 个独立项相加 → **Var(Q·K) = d**（方差可加）。于是 logits 的标准差 ~ √d：
 * d 一大，最高那个分数就把别人甩开 √d 那么多，softmax 塌成近似 one-hot。
 * 除以 **√d_k** 正好把方差拉回 1 —— 这就是《Attention Is All You Need》里
 * "we scale the dot products by 1/√d_k" 的全部理由。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本有两处欠着：
 *   ① **Var(Q·K)=d 是"写"进去的**，不是量出来的：logit 直接取 base×√d。
 *      于是这个实验其实没在验证那条定理，只是在演示"我假设它成立之后会怎样"。
 *      现在改成**真的抽 Q、K 向量做内积**，方差是**数出来的**（d=1024 实测 ≈1024，误差几个百分点）。
 *   ② 结语写着"梯度也跟着消失"，可**屏幕上没有任何梯度**。
 *      而那正是这一屏跟「反向传播」「RNN」是同一件事的地方 —— softmax 一饱和，
 *      它的雅可比 ∂p_i/∂z_j = p_i(δ_ij − p_j) 就整个塌向 0，跟 sigmoid 饱和后 tanh′→0 一模一样。
 *      现在把**雅可比的范数**摆上屏幕，"训不动"就有了具体的数。
 *
 * 另加第三档缩放 **÷d（缩过头）**，把两种失败摆成一对：
 *   不缩放 → 分布塌成 one-hot，**有选择性但没梯度**；
 *   ÷d     → 分布摊成均匀，**有梯度但没选择性**。
 *   ÷√d    → 两头都要。这比只讲"不除会炸"完整得多。
 */
import { str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type ScaleState = {
  i: number
  step: number
  d: number
  sqrtd: number
  base: number[]                 // 各 key 的"真实相似度"（=缩放后该有的 logit）
  rawLogits: number[]            // 抽样得到的原始 Q·K
  unscaled: number[]             // 本档缩放下的 softmax 概率
  scaled: number[]               // ÷√d 的 softmax 概率（参照，恒定）
  variance: number               // **实测**的 Var(Q·K)
  varTheory: number              // 理论值 = d
  entU: number
  entS: number
  maxU: number
  //  ── 补厚：梯度那一半 ──
  jac: number                    // softmax 雅可比的 Frobenius 范数 —— "训不动"的具体的数
  jacRef: number                 // ÷√d 那一档的同一个量（参照）
  mode: string                   // 本档缩放
  divisor: number                // 实际除掉的那个数
  phase: 'run' | 'done'
  log: string
}

export const SCALE_VISIBLE = [
  'step', 'd', 'sqrtd', 'base', 'rawLogits', 'unscaled', 'scaled',
  'variance', 'varTheory', 'entU', 'entS', 'maxU', 'jac', 'jacRef', 'mode', 'divisor', 'phase', 'log',
] as const

type Frame = Omit<ScaleState, 'i'>

const BASE = [1.5, 1.0, 0.5, 0.0]
const D_VALUES = [4, 16, 64, 256, 1024]
const NKEY = BASE.length

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}
const gauss = (r: () => number) => Array.from({ length: 6 }, r).reduce((a, b) => a + b, 0) / Math.sqrt(0.5)

function softmax(xs: number[]): number[] {
  const m = Math.max(...xs)
  const es = xs.map(x => Math.exp(x - m))
  const s = es.reduce((a, b) => a + b, 0)
  return es.map(e => e / s)
}
function entropy(ps: number[]): number {
  return -ps.reduce((h, p) => h + (p > 1e-12 ? p * Math.log2(p) : 0), 0)
}
/*  softmax 的雅可比：∂p_i/∂z_j = p_i(δ_ij − p_j)。
    这里取它的 Frobenius 范数 —— 分布一塌成 one-hot 它就趋 0，
    跟 sigmoid 饱和之后 tanh′→0 是**同一回事**，"梯度消失"这四个字在这儿有了具体的数。 */
function jacNorm(p: number[]): number {
  let s = 0
  for (let a = 0; a < p.length; a++) for (let b = 0; b < p.length; b++) {
    const v = p[a] * ((a === b ? 1 : 0) - p[b])
    s += v * v
  }
  return Math.sqrt(s)
}

/*  ⚠️ 真的抽 Q、K 做内积，别再拿 base×√d 顶替。
    q 与 k_j 都是 N(0,1)^d；为了让 key 之间有**真实的相似度差异**，
    把 q 的方向按 base[j] 的比例掺进 k_j（掺完再补上噪声，保证每一维仍是单位方差）。
    这样 E[q·k_j] ∝ base[j]·√d，而 Var(q·k) 仍 ≈ d —— 两件事都能当场量。 */
function sampleLogits(d: number, seed: number): number[] {
  const r = lcg(seed)
  const q = Array.from({ length: d }, () => gauss(r))
  const qn = Math.sqrt(q.reduce((a, v) => a + v * v, 0))
  const qhat = q.map(v => v / qn)
  return BASE.map(b => {
    //  相似度系数：让 E[q·k] = b·√d（√d 是 |q| 的量级）
    const rho = b / Math.sqrt(d)
    const noise = Array.from({ length: d }, () => gauss(r))
    let dot = 0
    for (let t = 0; t < d; t++) dot += q[t] * (rho * qhat[t] * Math.sqrt(d) + noise[t])
    return dot
  })
}

export const scaleKernel: Kernel<ScaleState> = {
  kind: 'scale',

  compile(doc: SimDocument): CompiledModel<ScaleState> {
    const mode = doc.params.scale === undefined ? '不缩放' : str(doc.params, 'scale')
    const divOf = (d: number) => (mode.startsWith('÷√d') ? Math.sqrt(d) : mode.startsWith('÷d') ? d : 1)

    const frames: Frame[] = []
    const scaledProbs = softmax(BASE)          // ÷√d 的参照分布：与 d 无关
    const entS = entropy(scaledProbs)
    const jacRef = +jacNorm(scaledProbs).toFixed(4)

    D_VALUES.forEach((d, step) => {
      const sqrtd = Math.sqrt(d)
      /*  ⚠️ 统计量要**在多次抽样上取平均**，不能只看一次。
          第一版每个 d 只抽一组 q、k，结果"不缩放"的最大概率在 94.8%→88.7%→100%→76.1% 之间乱跳 ——
          不是机制不对，是**噪声跟信号同量级**（两者都 ∝√d），单次抽样根本看不出趋势。
          这里对 64 次独立抽样取平均，报的是期望；下面那组 rawLogits 只是拿第一次的当展示用。 */
      const DRAWS = 64
      const rawLogits = sampleLogits(d, 20260908 + step)
      /*  ⚠️ 只用 4 个 key 估方差，抖动会很大。这里另抽 200 对**纯随机**的 q、k
          （不掺相似度）来量 Var(Q·K)，那才是定理说的那个量。 */
      const rv = lcg(777 + step)
      let s2 = 0
      for (let t = 0; t < 200; t++) {
        let dot = 0
        for (let u = 0; u < d; u++) dot += gauss(rv) * gauss(rv)
        s2 += dot * dot
      }
      const variance = s2 / 200

      const div = divOf(d)
      const probs = softmax(rawLogits.map(x => x / div))
      let sEnt = 0, sMax = 0, sJac = 0
      for (let t = 0; t < DRAWS; t++) {
        const pr = softmax(sampleLogits(d, 31337 + step * 1000 + t).map(x => x / div))
        sEnt += entropy(pr); sMax += Math.max(...pr); sJac += jacNorm(pr)
      }
      const entU = sEnt / DRAWS, maxU = sMax / DRAWS, jac = sJac / DRAWS

      frames.push({
        step, d, sqrtd, base: BASE,
        rawLogits: rawLogits.map(x => +x.toFixed(2)),
        unscaled: probs.map(x => +x.toFixed(4)),
        scaled: scaledProbs.map(x => +x.toFixed(4)),
        variance: +variance.toFixed(1), varTheory: d,
        entU: +entU.toFixed(3), entS: +entS.toFixed(3), maxU: +maxU.toFixed(4),
        jac: +jac.toFixed(4), jacRef, mode, divisor: +div.toFixed(2), phase: 'run',
        log: `维度 d=${d}：**实测** Var(Q·K) = **${variance.toFixed(0)}**（理论 = d = ${d}，抽 200 对随机向量量出来的），`
          + `标准差 √d ≈ ${sqrtd.toFixed(1)}。`
          + `　这一档除以 **${div === 1 ? '1（不缩放）' : div.toFixed(2)}**（以下都是 64 次抽样的平均）：`
          + `softmax 最大概率 **${(maxU * 100).toFixed(1)}%**、熵 **${entU.toFixed(2)}** bit、`
          + `**雅可比范数 ${jac.toFixed(4)}**（梯度大小）。`
          + (maxU > 0.99 ? `　⚠️ 已经塌成 one-hot —— 梯度只剩 ${jac.toExponential(1)}，**训不动了**。`
            : maxU > 0.9 ? `　⚠️ 快塌成 one-hot 了 —— 梯度只剩 ${jac.toFixed(4)}。`
              : maxU < 0.32 ? `　⚠️ 摊得太平了 —— 有梯度，但几乎**分不出哪个 key 更相关**。` : ''),
      })
    })

    const lo = frames[frames.length - 1]
    frames.push({
      ...lo, phase: 'done',
      log: `d 从 ${D_VALUES[0]} 到 ${D_VALUES[D_VALUES.length - 1]}：实测 Var(Q·K) 从 ${frames[0].variance} 涨到 ${lo.variance} —— `
        + `**方差就是 d**，因为 Q·K 是 d 个独立项相加、方差可加。于是 logits 的标准差 ∝ √d。`
        + (mode === '不缩放'
          ? `　**不缩放**：d=1024 时最大概率 ${(lo.maxU * 100).toFixed(1)}%、熵 ${lo.entU.toFixed(2)} bit，`
            + `雅可比范数只剩 **${lo.jac.toExponential(1)}**（÷√d 那一档是 ${jacRef}）。`
            + `　softmax 一饱和，它的雅可比 ∂p_i/∂z_j = p_i(δ_ij − p_j) 就整个塌向 0 —— `
            + `**这跟 sigmoid 饱和之后 tanh′→0 是同一件事**，跟「反向传播」「RNN」那两屏说的是同一个机制。`
            + `　把「缩放」拨到 ÷√d 看看。`
          : mode.startsWith('÷√d')
            ? `　**÷√d**：把标准差永远拉回 1，所以熵恒定 **${lo.entU.toFixed(2)}** bit、雅可比稳在 **${lo.jac.toFixed(4)}**，`
              + `**完全不随 d 变**。这就是那句 "we scale the dot products by 1/√d_k" 的全部理由 —— `
              + `不是玄学，是"d 个 i.i.d. 项相加、方差累加"的必然。`
              + `　两边的失败都试一遍才完整：不缩放 → 塌成 one-hot（**有选择性但没梯度**）；`
              + `÷d → 摊成均匀（**有梯度但没选择性**）。`
            : `　**÷d（缩过头）**：分母比该用的大了 √d 倍，logits 被压到 ${(lo.rawLogits[0] / lo.divisor).toFixed(3)} 这个量级，`
              + `softmax 几乎**均匀**（最大概率 ${(lo.maxU * 100).toFixed(1)}%、熵 ${lo.entU.toFixed(2)} bit）。`
              + `　这一档有梯度（雅可比 ${lo.jac.toFixed(4)}），但**分不出哪个 key 更相关** —— 注意力等于没在注意。`
              + `　两种失败正好是一对：不缩放**没梯度**、÷d **没选择性**，÷√d 两头都要。`),
    })

    const base0: Frame = {
      step: -1, d: 0, sqrtd: 0, base: BASE, rawLogits: [], unscaled: [], scaled: scaledProbs.map(x => +x.toFixed(4)),
      variance: 0, varTheory: 0, entU: 0, entS: +entS.toFixed(3), maxU: 0,
      jac: 0, jacRef, mode, divisor: 1, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '维度 d' },
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
