/**
 * 内核：扩散模型 Diffusion（深度学习算法 · 原理：前向加噪把图变噪声，反向去噪从噪声生成图）
 * 轴：step —— 前向 T 步把图淹进噪声；反向 T 步把它"磨"回来
 *
 * ## 2026-09-08 重写：原来的**反向过程是假的**
 *
 * 老版本的反向是这么写的：`for (t = T-1; t >= 0; t--) frames.push(mk(t, 'reverse', …))`
 * —— `mk(t)` 返回的就是**前向第 t 帧那张图**。也就是说它把前向的带子**倒着放了一遍**，
 * 而日志上写着「训练好的网络预测这一步掺了多少噪声、把它减掉」。**什么都没算。**
 * 倒放一盘录像叫不了生成：换个噪声种子，它还是那颗心 —— 因为它根本没在采样。
 * 这跟本仓「仿真才是核心：求解器必须是可探索的状态空间，不是返回答案的函数」直接冲突。
 *
 * 现在反向是**真算的**，而且算的是有名有姓的东西：
 *
 * ### 去噪器：这个先验下的**贝叶斯最优**估计（不是"假装有个网络"）
 *
 * 真实扩散模型训练一个网络去预测噪声 ε。这里不训练网络，而是取一个**小到能精确求解**的先验：
 * 图像只可能是三个图案之一（❤ / ✚ / ▲）。在这个先验下，`E[x₀ | x_t]` 有闭式解：
 *
 *   w_k ∝ exp( −‖x_t − √ᾱ_t·p_k‖² / (2(1−ᾱ_t)) )   ← 后验权重（softmax）
 *   x̂₀  = Σ_k w_k · p_k                              ← 干净图的期望
 *   ε̂   = (x_t − √ᾱ_t·x̂₀) / √(1−ᾱ_t)                ← 反解出的噪声
 *   x_{t−1} = √ᾱ_{t−1}·x̂₀ + √(1−ᾱ_{t−1})·ε̂          ← DDIM(η=0) 那一步
 *
 * 这套式子就是**训练充分的网络会逼近的那个东西**。好处是每一步都能手算核对，
 * 而且 w_k 本身就是屏幕上最好看的一件事：**"网络"此刻觉得它有 62% 像 ❤、31% 像 ✚** ——
 * 生成的决策过程直接摊开在你面前。
 *
 * ### 于是这些以前演不出来的，现在都能演
 *   · **换个噪声种子 → 生成另一张图**。这才叫生成；倒放录像永远只有那一张。
 *   · **步数太少 → 磨不干净**（真实 DDPM 的老毛病，也是 DDIM/蒸馏要解决的问题）。
 *   · **调度换成余弦** → 中段噪声加得慢，信息保留更久。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const N = 8
/** 先验：图像只可能是这三个图案之一 —— 小到能精确求后验，这正是它能"真算"的原因 */
const PATTERNS: { name: string; px: number[] }[] = [
  { name: '❤', px: [
    [0, 1, 1, 0, 0, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 0], [0, 0, 1, 1, 1, 1, 0, 0], [0, 0, 0, 1, 1, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0],
  ].flat() },
  { name: '✚', px: [
    [0, 0, 0, 1, 1, 0, 0, 0], [0, 0, 0, 1, 1, 0, 0, 0], [0, 0, 0, 1, 1, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1], [0, 0, 0, 1, 1, 0, 0, 0], [0, 0, 0, 1, 1, 0, 0, 0], [0, 0, 0, 1, 1, 0, 0, 0],
  ].flat() },
  { name: '▲', px: [
    [0, 0, 0, 1, 1, 0, 0, 0], [0, 0, 0, 1, 1, 0, 0, 0], [0, 0, 1, 1, 1, 1, 0, 0], [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0], [0, 1, 1, 1, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1],
  ].flat() },
]

const r3 = (x: number) => Math.round(x * 1000) / 1000

/** 确定性标准高斯（Box–Muller + LCG）—— 换种子就换一团噪声，也就换一张生成图 */
function gauss(seed: number, n: number): number[] {
  let s = (seed * 2654435761) >>> 0
  const nxt = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return ((s % 100000) + 0.5) / 100000 }
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(Math.sqrt(-2 * Math.log(nxt())) * Math.cos(2 * Math.PI * nxt()))
  return out
}

/** 噪声调度：ᾱ_t，t=0..T。线性 vs 余弦（余弦中段加得慢，是 improved-DDPM 的做法） */
function abarOf(T: number, kind: string): number[] {
  const out: number[] = []
  for (let t = 0; t <= T; t++) {
    const u = t / T
    out.push(kind === '余弦'
      ? Math.max(1e-4, Math.cos((u + 0.008) / 1.008 * Math.PI / 2) ** 2)
      : Math.max(1e-4, 1 - u * 0.995))
  }
  return out
}

export type DiffusionState = {
  i: number
  step: number
  n: number
  /** 当前这张图（前向是加噪结果，反向是采样中的 x_t） */
  img: number[]
  /** 去噪器当前估计的"干净图" x̂₀ —— 反向时才有 */
  x0hat: number[] | null
  /** 后验权重：此刻觉得它像哪个图案（和为 1） */
  weights: number[]
  names: string[]
  t: number
  T: number
  dir: 'forward' | 'reverse' | 'done'
  sqrtA: number
  sqrtN: number
  /** 生成完之后，落在哪个图案上、有多像 */
  landed: string
  landedW: number
  /** 前向用的是哪一张原图（反向不知道它，只有我们知道，用来对照） */
  truth: string
  phase: 'run' | 'done'
  log: string
}

export const DIFFUSION_VISIBLE = [
  'step', 'n', 'img', 'x0hat', 'weights', 'names', 't', 'T', 'dir',
  'sqrtA', 'sqrtN', 'landed', 'landedW', 'truth', 'phase', 'log',
] as const
type Frame = Omit<DiffusionState, 'i'>

export const diffusionKernel: Kernel<DiffusionState> = {
  kind: 'diffusion',

  compile(doc: SimDocument): CompiledModel<DiffusionState> {
    const T = doc.params.steps === undefined ? 8 : num(doc.params, 'steps')
    const seed = doc.params.seed === undefined ? 1 : num(doc.params, 'seed')
    const sched = doc.params.schedule === undefined ? '线性' : str(doc.params, 'schedule')
    const AB = abarOf(T, sched)
    const NAMES = PATTERNS.map(p => p.name)
    const x0 = PATTERNS[0].px                       // 前向拿 ❤ 当原图
    const eps = gauss(seed, N * N)                  // 这一次的噪声（换种子＝换一次生成）

    /** 后验权重 w_k ∝ exp(−‖x_t − √ᾱ·p_k‖²/(2(1−ᾱ)))：这个先验下的精确解 */
    function posterior(xt: number[], abar: number): number[] {
      const sa = Math.sqrt(abar), v = Math.max(1e-6, 1 - abar)
      const lg = PATTERNS.map(p => {
        let d = 0
        for (let i = 0; i < xt.length; i++) { const e = xt[i] - sa * p.px[i]; d += e * e }
        return -d / (2 * v)
      })
      const m = Math.max(...lg)
      const ex = lg.map(v2 => Math.exp(v2 - m))
      const z = ex.reduce((a, b) => a + b, 0)
      return ex.map(v2 => v2 / z)
    }
    const mix = (w: number[]) => {
      const out = new Array(N * N).fill(0)
      PATTERNS.forEach((p, k) => { for (let i = 0; i < out.length; i++) out[i] += w[k] * p.px[i] })
      return out
    }

    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step'>) => frames.push({ ...f, step: frames.length })
    const common = { n: N, T, names: NAMES, truth: PATTERNS[0].name }

    // ── 前向：x_t = √ᾱ·x₀ + √(1−ᾱ)·ε ───────────────────
    for (let t = 0; t <= T; t++) {
      const sa = Math.sqrt(AB[t]), sn = Math.sqrt(1 - AB[t])
      const img = x0.map((v, i) => r3(sa * v + sn * eps[i]))
      push({
        ...common, img, x0hat: null, weights: [1, 0, 0], t, dir: 'forward',
        sqrtA: r3(sa), sqrtN: r3(sn), landed: '', landedW: 0, phase: 'run',
        log: t === 0
          ? `**前向 · 第 0 步**：原图 ${PATTERNS[0].name}（√ᾱ=1，还没有噪声）。扩散先学"破坏"。`
          : `**前向 · 第 ${t}/${T} 步**：x = √ᾱ·x₀ + √(1−ᾱ)·ε = **${r3(sa)}**·原图 + **${r3(sn)}**·噪声。`
            + (t === T ? ' 信号只剩这么点 —— 几乎是**纯噪声**了。' : ' 信号越来越弱。'),
      })
    }

    // ── 反向：从纯噪声出发，DDIM(η=0) 一步步采样 ──────────
    //  ⚠️ 这里**不知道** x₀ 是什么。起点只有一团噪声，之后每一步都由上面那组式子算出来。
    let xt = eps.map(e => r3(e * Math.sqrt(1 - AB[T]) + Math.sqrt(AB[T]) * 0.5))
    for (let t = T; t >= 1; t--) {
      const abar = AB[t], abarPrev = AB[t - 1]
      const sa = Math.sqrt(abar), sn = Math.sqrt(1 - abar)
      const w = posterior(xt, abar)
      const x0h = mix(w)
      const ehat = xt.map((v, i) => (v - sa * x0h[i]) / Math.max(1e-6, sn))
      const next = x0h.map((v, i) => r3(Math.sqrt(abarPrev) * v + Math.sqrt(1 - abarPrev) * ehat[i]))
      const top = w.indexOf(Math.max(...w))
      push({
        ...common, img: xt.map(r3), x0hat: x0h.map(r3), weights: w.map(r3), t, dir: 'reverse',
        sqrtA: r3(sa), sqrtN: r3(sn), landed: '', landedW: 0, phase: 'run',
        log: `**反向 · 从 t=${t} 走到 ${t - 1}**：去噪器先问"这团东西像哪个图案" → `
          + NAMES.map((n, k) => `${n} ${(w[k] * 100).toFixed(0)}%`).join('、')
          + `；据此估出干净图 x̂₀（此刻最像 **${NAMES[top]}**），再反解出噪声 ε̂ 并走一步 DDIM。`
          + (t === T ? '　注意：这一步**只看得见噪声**，前向那张原图它一无所知。' : ''),
      })
      xt = next
    }

    const wEnd = posterior(xt, AB[0])
    const top = wEnd.indexOf(Math.max(...wEnd))
    push({
      ...common, img: xt.map(r3), x0hat: mix(wEnd).map(r3), weights: wEnd.map(r3), t: 0, dir: 'done',
      sqrtA: 1, sqrtN: 0, landed: NAMES[top], landedW: r3(wEnd[top]), phase: 'done',
      log: `**生成完成**：从一团纯噪声出发、走了 ${T} 步 DDIM，"磨"出了 **${NAMES[top]}**`
        + `（把握 ${(wEnd[top] * 100).toFixed(1)}%）。`
        + `扩散 = **前向加噪（固定、可手算）+ 反向去噪（学出来的那部分）**；把加噪反着走，噪声就成了创作。`
        + `　这一屏的去噪器不是"假装有个网络"：图像只可能是三个图案之一，这个先验下 `
        + `E[x₀|x_t] 有**闭式解**（后验权重 softmax + 加权平均），每一步都能手算核对 —— `
        + `训练充分的网络逼近的就是它。`
        + `　**换个噪声种子再跑一次**：同样的模型、同样的步数，会磨出另一张图 —— 这才叫生成。`
        + `真实模型在几十~上千步、上亿张图上训练，还能按文字条件生成。Stable Diffusion / Sora 的底层就是这套。`,
    })

    const base0: Frame = {
      ...common, step: -1, img: x0.slice(), x0hat: null, weights: [1, 0, 0], t: 0, dir: 'forward',
      sqrtA: 1, sqrtN: 0, landed: '', landedW: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '加噪/去噪' },
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
