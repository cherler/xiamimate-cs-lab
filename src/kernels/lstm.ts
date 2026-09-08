/**
 * 内核：LSTM 门控（深度学习算法 · 原理：给记忆装"门"，用一条几乎不衰减的 cell 传送带扛住长距离依赖）
 * 轴：step —— 逐步处理序列。三个"门"控制一条**细胞状态 c**（记忆传送带）：
 *      **遗忘门 f** 决定留多少旧记忆、**输入门 i** 决定写多少新内容、**输出门 o** 决定放出多少。
 *      c_t = f·c_{t−1} + i·c̃（**加法**为主的近乎线性通路），h_t = o·tanh(c_t)。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本是一段 4 步的**理想化剧本**：门值全被手写成 0 或 1（存/守/守/取），
 * cell 稳在 0.8，结语说"梯度顺着它不衰减"。机制是演清楚了，可有两个问题：
 *   ① 门值是**我填的**，不是算出来的 —— 于是"传送带扛住了"更像一句宣告，不像一个结果；
 *   ② 它跟隔壁的 RNN **没法直接比**。而 LSTM 存在的全部理由就是"RNN 做不到的它做得到"，
 *      不摆在同一把尺子上，这句话就落不了地。
 *
 * 补厚做的就是这两件事：
 *   · 换成跟 RNN **同一个任务、同一把尺子**：开头喂一个脉冲、之后全 0，
 *     量**同一个量** —— 开头那个输入到此刻还剩多少影响。
 *   · 遗忘门 f 变成旋钮。于是那条链摆了出来：
 *
 *       RNN：∂h_T/∂x₁ 要乘 ∏ **wh·(1−h²)** —— tanh′ 一饱和就塌，最好也就 0.9 上下。
 *       LSTM：∂c_T/∂x₁ 只乘 ∏ **f** —— 是**纯粹的遗忘门连乘，没有 tanh′ 掺进来**。
 *
 *     所以 f=1.0 时它**一点都不衰减**（半衰期 ∞，实测影响力 50 步不变）；
 *     f=0.9 时半衰期 6.6 步，跟 RNN 的最好情形**恰好一样** —— 因为那时两条链乘的是同一个数。
 *     这两件事摆在一起，"门控到底赢在哪"就不用嘴说了：赢在**那一项能被学成 1**，而 tanh′ 不能。
 *
 * ⚠️ 老版本那段 4 步剧本原样保留成第一档（「存/守/取 剧本（可手核）」），逐步仍可手算。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r3 = (x: number) => Math.round(x * 1000) / 1000
const sig3 = (v: number) => (Math.abs(v) >= 1e-3 ? +v.toFixed(4) : +v.toPrecision(2))

type Step = { role: string; f: number; i: number; ctil: number; o: number }
//  老版本那段理想化剧本，原样留着
const SCRIPT: Step[] = [
  { role: '存', f: 0, i: 1, ctil: 0.8, o: 0 },
  { role: '守', f: 1, i: 0, ctil: 0.5, o: 0 },
  { role: '守', f: 1, i: 0, ctil: -0.3, o: 0 },
  { role: '取', f: 1, i: 0, ctil: 0.2, o: 1 },
]

//  长序列：第 1 步写入（i=1），之后一路守（i=0），末步取出（o=1）；遗忘门由旋钮定
function makeSteps(T: number, f: number): Step[] {
  return Array.from({ length: T }, (_, t) => ({
    role: t === 0 ? '存' : t === T - 1 ? '取' : '守',
    f: t === 0 ? 0 : f,          // 第 1 步没有旧记忆可留
    i: t === 0 ? 1 : 0,
    ctil: t === 0 ? 0.8 : 0,
    o: t === T - 1 ? 1 : 0,
  }))
}

export type LSTMState = {
  i: number
  step: number
  t: number
  role: string
  f: number; ig: number; ctil: number; o: number
  cPrev: number
  c: number
  h: number
  cs: (number | null)[]
  //  ── 补厚：跟 RNN 同一把尺子 ──
  grad: number                 // ∂c_t/∂（第 1 步写进去的内容）= ∏ f
  grads: (number | null)[]
  halfLife: number             // 半衰期（步）；-1 = 不衰减
  fGate: number                // 这一档的遗忘门
  rnnHalf: number              // RNN 在最好那档（wh=0.9）的半衰期 —— 并排比
  script: boolean              // 是不是"存/守/取 剧本"那一档
  compare: [number, number][]  // 三档 f 的半衰期
  phase: 'run' | 'done'
  log: string
}

export const LSTM_VISIBLE = [
  'step', 't', 'role', 'f', 'ig', 'ctil', 'o', 'cPrev', 'c', 'h', 'cs',
  'grad', 'grads', 'halfLife', 'fGate', 'rnnHalf', 'script', 'compare', 'phase', 'log',
] as const

type Frame = Omit<LSTMState, 'i'>

export const lstmKernel: Kernel<LSTMState> = {
  kind: 'lstm',

  compile(doc: SimDocument): CompiledModel<LSTMState> {
    const seqTag = doc.params.seq === undefined ? '存/守/取 剧本（可手核）' : str(doc.params, 'seq')
    const fGate = doc.params.forget === undefined ? 1 : num(doc.params, 'forget')
    const script = seqTag.startsWith('存/守/取')
    const T = script ? SCRIPT.length : seqTag.includes('50') ? 50 : 20
    const STEPS = script ? SCRIPT : makeSteps(T, fGate)

    /*  影响力：第 1 步写进 cell 的内容，到第 t 步还剩多少。
        c_t = f·c_{t−1} + i·c̃ ⇒ ∂c_t/∂c₁ = ∏_{s≥2} f_s —— **纯粹的遗忘门连乘**。
        对比 RNN 的 ∏ wh·(1−h²)：这里**没有 tanh′ 掺进来**，这就是全部的差别。 */
    const gradsOf = (steps: Step[]) => {
      const gs: number[] = []
      let g = 1
      for (let t = 0; t < steps.length; t++) { g = t === 0 ? steps[0].i : g * steps[t].f; gs.push(g) }
      return gs
    }
    const G = gradsOf(STEPS)
    const halfFrom = (f: number) => (f >= 1 ? -1 : +(Math.log(0.5) / Math.log(f)).toFixed(1))
    const halfLife = script ? -1 : halfFrom(fGate)
    const compare: [number, number][] = [0.5, 0.9, 1].map(f => [f, halfFrom(f)])
    /*  RNN 在它最好那档（wh=0.9）的半衰期，跟这里并排摆。
        它的渐近因子是 wh·(1−h²)，脉冲之后 h→0、tanh′→1，所以因子 → 0.9 —— 跟 f=0.9 一模一样。
        这不是巧合，正是这一屏要说的：**两条链只差 tanh′ 那一项**。 */
    const rnnHalf = halfFrom(0.9)

    const frames: Frame[] = []
    const cs: (number | null)[] = STEPS.map(() => null)
    const gs: (number | null)[] = STEPS.map(() => null)
    let c = 0

    for (let t = 0; t < STEPS.length; t++) {
      const s = STEPS[t]
      const cPrev = c
      const cNew = r3(s.f * cPrev + s.i * s.ctil)
      const h = r3(s.o * Math.tanh(cNew))
      cs[t] = cNew
      gs[t] = sig3(G[t])
      frames.push({
        step: frames.length, t: t + 1, role: s.role, f: s.f, ig: s.i, ctil: s.ctil, o: s.o,
        cPrev: r3(cPrev), c: cNew, h, cs: cs.slice(),
        grad: sig3(G[t]), grads: gs.slice(), halfLife, fGate, rnnHalf, script, compare, phase: 'run',
        log: `第 ${t + 1} 步（**${s.role}**）：遗忘门 f=${s.f}、输入门 i=${s.i}、输出门 o=${s.o}。`
          + `c = f·c_prev + i·c̃ = ${s.f}·${r3(cPrev)} + ${s.i}·${s.ctil} = **${cNew}**；h = o·tanh(c) = **${h}**。`
          + (s.role === '存' ? '（开输入门写入记忆）'
            : s.role === '取' ? '（开输出门，把记忆放出来）'
              : '（遗忘门守着、输入门关着 → 记忆往下传）')
          + (script ? '' : `　第 1 步写进去的东西，此刻还剩 **${sig3(G[t])}**（= ∏f，**没有 tanh′ 掺进来**）。`),
      })
      c = cNew
    }

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, step: frames.length, t: -1, role: '毕', phase: 'done',
      h: r3(Math.tanh(c)),
      log: script
        ? `**看那条传送带**：cell 状态全程稳在 ${c} —— 第 1 步存进去，中间两步遗忘门=1、输入门=0 把它`
          + `**原封不动**扛过来，末步开输出门取出 tanh(${c})=${r3(Math.tanh(c))}。`
          + `　这就是 LSTM 的核心：c_t = f·c_{t−1} + i·c̃ 是一条**加法为主、近乎线性**的记忆高速路。`
          + `　⚠️ 但这一档的门值是**手写死的**（0 和 1），"扛住了"更像一句宣告。`
          + `**把「序列」换成长序列** —— 那一档会用跟隔壁 RNN **完全一样的尺子**量同一件事，`
          + `你才看得见门控到底赢在哪。`
        : `走完 ${T} 步：第 1 步写进 cell 的内容，此刻还剩 **${sig3(G[G.length - 1])}**`
          + (halfLife < 0
            ? `　—— **一点没少**。遗忘门 f=1 时 ∂c_T/∂c₁ = ∏f = 1，半衰期是**无穷**：`
              + `这条传送带上**没有任何东西在乘除它**。`
            : `（半衰期 ${halfLife} 步）。`)
          + `　跟隔壁 RNN 摆在一起看才有意思 —— **两条链只差一项**：`
          + `　RNN 要乘 ∏ **wh·(1−h²)**，LSTM 只乘 ∏ **f**。`
          + `tanh′=1−h² 是**算出来的、且必然小于 1**（h 一饱和还会趋近 0，所以 RNN 把 wh 调大反而更糟）；`
          + `而 f 是**学出来的门，可以学成 1**。`
          + `　实测：f=0.5 → 半衰期 ${compare[0][1]} 步、f=0.9 → ${compare[1][1]} 步、f=1.0 → **不衰减**；`
          + `而 RNN 最好那档（wh=0.9）也就 ${rnnHalf} 步 —— `
          + `注意 **f=0.9 跟它一模一样**，因为那时两条链乘的正是同一个数。`
          + `　**门控赢的不是"更聪明"，而是把那一项从"必然小于 1"变成了"可以等于 1"。**`
          + `　再往后，Transformer 的注意力干脆不传了：让每个位置**直接看**全序列，连乘链一步都不用走。`,
    })

    const base0: Frame = {
      step: -1, t: 0, role: '', f: 0, ig: 0, ctil: 0, o: 0, cPrev: 0, c: 0, h: 0,
      cs: STEPS.map(() => null), grad: 0, grads: STEPS.map(() => null),
      halfLife, fGate, rnnHalf, script, compare, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '时间步(门控)' },
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
