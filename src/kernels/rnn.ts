/**
 * 内核：循环神经网络 RNN（深度学习算法 · 原理：一个隐藏状态沿时间流动,把"过去"记在里面）
 * 轴：step —— 逐个读入序列 x₁,x₂,…,每步用**同一套权重**更新隐藏状态 h_t=tanh(wx·x_t + wh·h_{t-1} + b)。
 *      h 像一条记忆的传送带:每步既看**当前输入** x_t、又带着**上一刻的 h**,所以 h_t 浓缩了到此为止的整段历史。
 *
 * 前面的网络(感知机/CNN)一次看一个固定大小的输入,处理不了**变长序列**(一句话、一段语音、一串股价)。
 * RNN 的巧思:引入一个**隐藏状态 h**(记忆),**沿时间一步步传递**。每读入一个元素 x_t,就用一套**共享的权重**
 * 把"当前输入 + 上一刻记忆"揉进新的记忆:h_t = tanh(wx·x_t + wh·h_{t-1} + b)。权重在所有时刻**共享**(和 CNN 的权重共享异曲同工),
 * 所以能处理任意长的序列;而 h_t 里**藏着全部过去**——同样的当前输入,历史不同,h 就不同。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本只有一条写死的短序列 [2,−1,3,−2]，逐步算 h。前向机制是讲清楚了，
 * 但它把 RNN 讲成了"一个会累加的公式"——而 RNN 在历史上的位置，是由它**做不到**的事定义的：
 *
 *   **它记不住远处的东西。** 沿时间回传的梯度是 ∂h_T/∂h₁ = ∏ wh·(1−h_t²)，
 *   又是一串**连乘** —— 跟「反向传播」那一屏沿深度的连乘、跟「残差」那一屏是**同一件事**，
 *   只不过这里乘的方向是**时间**。这正是 LSTM 的门控、以及后来注意力存在的理由。
 *
 * 补厚补两个旋钮，正好把这条链摆出来：
 *   · **序列**：短序列（原来那条，可手核）／开头一个脉冲之后全 0（T=20 / T=50）——
 *     脉冲那两档专门用来量"开头那个输入还剩多少影响"。
 *   · **循环权重 wh**：0.5 / 0.9 / 1.5。
 *
 * 屏幕上多两个量：**影响力** ∂h_t/∂x₁（开头那个输入对此刻还有多少影响）和它的**半衰期**。
 * 而最反直觉的一条是：**把 wh 调大救不回来**。因为 wh 一大，h 很快饱和到 ±1，
 * tanh′=1−h² 就趋近 0，每步的因子 |wh·(1−h²)| 照样小于 1 —— 实测三档 wh 的半衰期都在个位数。
 * 这条正是"必须换结构（门控/注意力）、调参数没用"的硬凭据。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const SHORT = [2, -1, 3, -2]
const WX = 0.5, B = 0
const r3 = (x: number) => Math.round(x * 1000) / 1000
const sig3 = (v: number) => (Math.abs(v) >= 1e-3 ? +v.toFixed(4) : +v.toPrecision(2))

function makeSeq(tag: string): number[] {
  if (tag.startsWith('短序列')) return SHORT
  //  开头一个脉冲、之后全 0：专门用来量"开头那个输入还剩多少影响"
  const T = tag.includes('50') ? 50 : 20
  return Array.from({ length: T }, (_, k) => (k === 0 ? 2 : 0))
}

export type RNNState = {
  i: number
  step: number
  xs: number[]
  wx: number; wh: number; b: number
  t: number                    // 当前时刻（1-based；-1=收官）
  xt: number
  hPrev: number
  pre: number                  // wx·x_t + wh·h_{t-1} + b
  ht: number
  hs: (number | null)[]        // 各时刻的 h（逐步填）
  //  ── 补厚：沿时间的那串连乘 ──
  grad: number                 // ∂h_t/∂x₁ —— 开头那个输入对此刻还剩多少影响
  grads: (number | null)[]     // 各时刻的影响力（画曲线）
  factor: number               // 这一步的因子 |wh·(1−h²)|
  halfLife: number             // 半衰期（步）：由**渐近**的每步因子算出，不是从第 0 步往下数
  factorAsymp: number          // 链稳定之后每步乘的那个数 —— "记多久"由它定
  seqTag: string
  short: boolean
  //  三档 wh 的半衰期对照 —— "调 wh 救不回来"这句话的凭据，不写死
  compare: [number, number][]
  log: string
  phase: 'run' | 'done'
}

export const RNN_VISIBLE = [
  'step', 'xs', 'wx', 'wh', 'b', 't', 'xt', 'hPrev', 'pre', 'ht', 'hs',
  'grad', 'grads', 'factor', 'halfLife', 'factorAsymp', 'seqTag', 'short', 'compare', 'phase', 'log',
] as const

type Frame = Omit<RNNState, 'i'>

export const rnnKernel: Kernel<RNNState> = {
  kind: 'rnn',

  compile(doc: SimDocument): CompiledModel<RNNState> {
    const seqTag = doc.params.seq === undefined ? '短序列 [2,−1,3,−2]（可手核）' : str(doc.params, 'seq')
    const WH = doc.params.wh === undefined ? 0.8 : num(doc.params, 'wh')
    const XS = makeSeq(seqTag)
    const short = seqTag.startsWith('短序列')

    /*  跑一遍序列，同时算两样东西：
        · h_t（前向）
        · ∂h_t/∂x₁ = wx · ∏_{s=2..t} wh·(1−h_s²)  ——「开头那个输入到此刻还剩多少影响」
        后者就是 BPTT 里那串连乘，跟「反向传播」沿深度、「残差」沿层数是同一件事。 */
    const runWith = (wh: number) => {
      let h = 0, g = 0
      const hs: number[] = [], gs: number[] = [], fs: number[] = []
      for (let t = 0; t < XS.length; t++) {
        const pre = WX * XS[t] + wh * h + B
        const hn = Math.tanh(pre)
        const dtanh = 1 - hn * hn
        //  第一步：影响力就是 wx·tanh′；之后每步乘 wh·tanh′
        g = t === 0 ? WX * dtanh : g * wh * dtanh
        fs.push(Math.abs(wh * dtanh))
        h = hn; hs.push(h); gs.push(g)
      }
      return { hs, gs, fs }
    }
    const { hs: H, gs: G, fs: F } = runWith(WH)

    /*  半衰期要从**渐近**的每步因子算，不能从第 0 步的影响力往下数。
        ⚠️ 第一版就是那么写的，结果三档 wh 的半衰期全是 1~2 步，看不出任何差别 ——
        因为脉冲那一刻 h 很大、tanh′ 很小，头一两步就掉掉一大半，把后面的规律全盖住了。
        真正决定"记多久"的是链稳定之后每步乘的那个数：取后 40% 步的几何平均。 */
    const asympOf = (fs: number[]) => {
      const tail = fs.slice(Math.floor(fs.length * 0.6))
      const use = tail.length ? tail : fs
      return Math.exp(use.reduce((a, v) => a + Math.log(Math.max(1e-30, v)), 0) / use.length)
    }
    const halfFrom = (f: number) => (f >= 1 ? -1 : Math.log(0.5) / Math.log(f))
    const factorAsymp = asympOf(F)
    const halfLife = +halfFrom(factorAsymp).toFixed(1)
    //  三档 wh 的渐近因子与半衰期对照 —— 结论里要用，别写死
    const compare: [number, number][] = [0.5, 0.9, 1.5].map(w => {
      const f = asympOf(runWith(w).fs)
      return [w, +halfFrom(f).toFixed(1)]
    })

    const frames: Frame[] = []
    const hsShown: (number | null)[] = XS.map(() => null)
    const gsShown: (number | null)[] = XS.map(() => null)
    let h = 0

    for (let t = 0; t < XS.length; t++) {
      const xt = XS[t]
      const hPrev = h
      const pre = WX * xt + WH * hPrev + B
      const ht = r3(H[t])
      hsShown[t] = ht
      gsShown[t] = sig3(G[t])
      frames.push({
        step: frames.length, xs: XS, wx: WX, wh: WH, b: B, t: t + 1, xt, hPrev: r3(hPrev), pre: r3(pre), ht,
        hs: hsShown.slice(), grad: sig3(G[t]), grads: gsShown.slice(), factor: +F[t].toFixed(4),
        halfLife, factorAsymp: +factorAsymp.toFixed(4), seqTag, short, compare, phase: 'run',
        log: `第 ${t + 1} 步：读入 x=${xt}，带着上一刻记忆 h=${r3(hPrev)}。`
          + `pre = wx·x + wh·h = ${WX}·${xt} + ${WH}·${r3(hPrev)} = ${r3(pre)} → **h_${t + 1} = tanh(${r3(pre)}) = ${ht}**。`
          + (t === 0
            ? `　同时记下**开头那个输入的影响力** ∂h/∂x₁ = ${sig3(G[0])}，往后每步它要乘一个 |wh·(1−h²)|。`
            : `　影响力 ∂h_${t + 1}/∂x₁ = 上一步 × |wh·(1−h²)| = **${sig3(G[t])}**`
              + `（这一步的因子 ${F[t].toFixed(3)}${F[t] < 1 ? '，小于 1 —— 越乘越小' : ''}）。`),
      })
      h = H[t]
    }

    const gm = F.slice(1).reduce((p, v) => p * v, 1) ** (1 / Math.max(1, F.length - 1))
    frames.push({
      step: frames.length, xs: XS, wx: WX, wh: WH, b: B, t: -1, xt: 0, hPrev: 0, pre: 0,
      ht: r3(H[H.length - 1]), hs: hsShown.slice(), grad: sig3(G[G.length - 1]), grads: gsShown.slice(),
      factor: +F[F.length - 1].toFixed(4), halfLife, factorAsymp: +factorAsymp.toFixed(4), seqTag, short, compare, phase: 'done',
      log: short
        ? `**读完整段**：隐藏状态一路演化 ${H.map(r3).join(' → ')}，末态浓缩了整个序列。`
          + `关键有二：① **权重在所有时刻共享**，所以能吃任意长的序列；`
          + `② h_t **藏着全部过去** —— 同样的当前输入，历史不同，h 就不同。`
          + `　但这条序列只有 4 步，看不出 RNN 真正的软肋。`
          + `**把「序列」换成"开头一个脉冲之后全 0"** —— 那时才看得见它记不记得住。`
        : `走完 ${XS.length} 步：开头那个输入的影响力从 ${sig3(G[0])} 掉到 **${sig3(G[G.length - 1])}**`
          + `（${(Math.abs(G[G.length - 1] / (G[0] || 1e-30))).toExponential(1)} 倍），`
          + `链稳下来之后每步乘 **${factorAsymp.toFixed(3)}**，`
          + (halfLife > 0 ? `**半衰期只有 ${halfLife} 步**。` : `因子不小于 1，不衰减。`)
          + `　原因跟「反向传播」那一屏一模一样，只是乘的方向换成了**时间**：每往前一步要乘 |wh·(1−h²)|。`
          + `　⚠️ 而**把 wh 调大救不回来，甚至更糟**：wh 一大，h 很快被推到饱和区（这条链上 h 稳在 `
          + `${Math.abs(H[H.length - 1]).toFixed(2)} 附近），tanh′=1−h² 就趋近 0，乘积照样小于 1。`
          + `实测三档：` + compare.map(([w, hl]) => `wh=${w} → 半衰期 ${hl > 0 ? `${hl} 步` : '不衰减'}`).join('、')
          + `　—— **wh=1.5 比 wh=0.9 记得还短**。`
          + `**这不是调参能解决的问题，得换结构** —— LSTM 的门控给记忆另开一条近乎线性的传送带`
          + `（c_t = f·c_{t−1} + i·c̃，f≈1 时不衰减），再往后就是注意力：干脆让每一步**直接看**所有历史，不再逐级传递。`,
    })

    const base0: Frame = {
      step: -1, xs: XS, wx: WX, wh: WH, b: B, t: 0, xt: 0, hPrev: 0, pre: 0, ht: 0,
      hs: XS.map(() => null), grad: 0, grads: XS.map(() => null), factor: 0,
      halfLife, factorAsymp: +factorAsymp.toFixed(4), seqTag, short, compare, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '时间步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b2 = prev ?? this.initial()
        const idx = b2.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
