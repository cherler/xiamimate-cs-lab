/**
 * 内核：LSTM 门控（深度学习算法 · 原理：给记忆装"门",用一条几乎不衰减的 cell 传送带扛住长距离依赖)
 * 轴：step —— 逐步处理序列。每步三个"门"(0~1 的开关)控制一条**细胞状态 c**(记忆传送带):
 *      **遗忘门 f** 决定留多少旧记忆、**输入门 i** 决定写多少新内容、**输出门 o** 决定放出多少。
 *      c_t = f·c_{t-1} + i·c̃(近乎线性的加法更新,不像 RNN 每步都被 tanh 挤压),h_t = o·tanh(c_t)。
 *
 * 普通 RNN 的记忆每步都过一次 tanh,反复挤压,早期信号很快被冲淡——长序列**梯度消失**、学不到长距离依赖。
 * LSTM 的解法:另开一条**细胞状态 c** 作"传送带",它的更新是 **c_t = f·c_{t-1} + i·c̃**——一个**加法**为主的近乎线性通路。
 * 只要遗忘门 f≈1、输入门 i≈0,旧记忆就能**原封不动地传很远**(梯度也顺着这条高速路不衰减);要写新东西就开 i、要读就开 o。
 * 门是数据算出来的 sigmoid(0~1),LSTM 因此学会了"何时记、何时忘、何时说"。
 *
 * 本实验:一个"记住开头、末尾取出"的任务,标量 LSTM 走 4 步(门值理想化成 0/1 以看清机制):
 * 第1步**存**(i=1,c̃=0.8→c=0.8)、第2、3步**守**(f=1,i=0→c 一直是 0.8,传送带扛住了)、第4步**取**(o=1→h=tanh(0.8)=0.664)。
 * 每步的 c、h 都可手算核对。cell 状态全程稳在 0.8,正是 RNN 做不到的长期记忆。LSTM/GRU 是 Transformer 之前的序列建模主力。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r3 = (x: number) => Math.round(x * 1000) / 1000
type Step = { role: string; f: number; i: number; ctil: number; o: number }
const STEPS: Step[] = [
  { role: '存', f: 0, i: 1, ctil: 0.8, o: 0 },
  { role: '守', f: 1, i: 0, ctil: 0.5, o: 0 },
  { role: '守', f: 1, i: 0, ctil: -0.3, o: 0 },
  { role: '取', f: 1, i: 0, ctil: 0.2, o: 1 },
]

export type LSTMState = {
  i: number
  step: number
  t: number
  role: string
  f: number; ig: number; ctil: number; o: number      // 三个门 + 候选（ig=输入门，避开 i 字段名）
  cPrev: number
  c: number
  h: number
  cs: (number | null)[]        // 各步 cell（传送带轨迹）
  phase: 'run' | 'done'
  log: string
}

export const LSTM_VISIBLE = [
  'step', 't', 'role', 'f', 'ig', 'ctil', 'o', 'cPrev', 'c', 'h', 'cs', 'phase', 'log',
] as const

type Frame = Omit<LSTMState, 'i'>

export const lstmKernel: Kernel<LSTMState> = {
  kind: 'lstm',

  compile(_doc: SimDocument): CompiledModel<LSTMState> {
    const frames: Frame[] = []
    const cs: (number | null)[] = STEPS.map(() => null)
    let c = 0

    for (let t = 0; t < STEPS.length; t++) {
      const s = STEPS[t]
      const cPrev = c
      const cNew = r3(s.f * cPrev + s.i * s.ctil)
      const h = r3(s.o * Math.tanh(cNew))
      cs[t] = cNew
      frames.push({
        step: frames.length, t: t + 1, role: s.role, f: s.f, ig: s.i, ctil: s.ctil, o: s.o,
        cPrev: r3(cPrev), c: cNew, h, cs: cs.slice(), phase: 'run',
        log: `第 ${t + 1} 步(**${s.role}**):遗忘门 f=${s.f}、输入门 i=${s.i}、输出门 o=${s.o}。` +
          `c = f·c_prev + i·c̃ = ${s.f}·${r3(cPrev)} + ${s.i}·${s.ctil} = **${cNew}**;h = o·tanh(c) = ${s.o}·tanh(${cNew}) = **${h}**。` +
          (s.role === '存' ? '(开输入门写入记忆)' : s.role === '守' ? '(遗忘门=1、输入门=0 → 记忆原样传下去)' : '(开输出门,把记忆放出来)'),
      })
      c = cNew
    }

    frames.push({
      step: frames.length, t: -1, role: '毕', f: 1, ig: 0, ctil: 0, o: 1, cPrev: c, c, h: r3(Math.tanh(c)), cs: cs.slice(), phase: 'done',
      log: `**看那条传送带**:cell 状态全程稳在 ${c}——第 1 步存进去,中间两步遗忘门=1、输入门=0 把它**原封不动**扛过来,末步开输出门取出 tanh(${c})=${r3(Math.tanh(c))}。` +
        `这就是 LSTM 的核心:c_t=f·c_{t-1}+i·c̃ 是一条**加法为主、近乎线性**的记忆高速路,梯度顺着它不衰减——扛住了 RNN 做不到的长距离依赖。` +
        `门(f/i/o)是数据算出的 sigmoid,LSTM 学会"何时记、何时忘、何时说"。GRU 是它的简化;后来 Transformer 的注意力让每个位置直接看全序列。`,
    })

    const base0: Frame = {
      step: -1, t: 0, role: '', f: 0, ig: 0, ctil: 0, o: 0, cPrev: 0, c: 0, h: 0, cs: STEPS.map(() => null), phase: 'run', log: '',
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
