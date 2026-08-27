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
 * 本实验:序列 [2,−1,3,−2],wx=0.5、wh=0.8、b=0,h₀=0。逐步算 h:tanh(1)=0.762 → 0.109 → 0.92 → −0.258,
 * 每步都可手算核对。末尾演示"记忆":同样最后输入 +2,历史 [2] 得 h=0.923、历史 [−3] 得 h=0.269——h 确实记着过去。
 * 它是语言模型、机器翻译、语音识别的早期主力;长序列会**梯度消失**,于是有了 LSTM/GRU 的门控,再到 Transformer 的注意力。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const XS = [2, -1, 3, -2]
const WX = 0.5, WH = 0.8, B = 0
const r3 = (x: number) => Math.round(x * 1000) / 1000

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
  phase: 'run' | 'done'
  log: string
}

export const RNN_VISIBLE = [
  'step', 'xs', 'wx', 'wh', 'b', 't', 'xt', 'hPrev', 'pre', 'ht', 'hs', 'phase', 'log',
] as const

type Frame = Omit<RNNState, 'i'>

export const rnnKernel: Kernel<RNNState> = {
  kind: 'rnn',

  compile(_doc: SimDocument): CompiledModel<RNNState> {
    const frames: Frame[] = []
    const hs: (number | null)[] = XS.map(() => null)
    let h = 0

    for (let t = 0; t < XS.length; t++) {
      const xt = XS[t]
      const hPrev = h
      const pre = WX * xt + WH * hPrev + B
      const ht = r3(Math.tanh(pre))
      hs[t] = ht
      frames.push({
        step: frames.length, xs: XS, wx: WX, wh: WH, b: B, t: t + 1, xt, hPrev: r3(hPrev), pre: r3(pre), ht,
        hs: hs.slice(), phase: 'run',
        log: `第 ${t + 1} 步:读入 x=${xt},带着上一刻记忆 h=${r3(hPrev)}。` +
          `pre = wx·x + wh·h = 0.5·${xt} + 0.8·${r3(hPrev)} = ${r3(pre)} → **h_${t + 1} = tanh(${r3(pre)}) = ${ht}**。记忆更新,传给下一步。`,
      })
      h = ht
    }

    frames.push({
      step: frames.length, xs: XS, wx: WX, wh: WH, b: B, t: -1, xt: 0, hPrev: 0, pre: 0, ht: h, hs: hs.slice(), phase: 'done',
      log: `**读完整段**:隐藏状态一路演化 0.762 → 0.109 → 0.92 → −0.258,末态 ${h} 浓缩了整个序列。` +
        `关键有二:① **权重在所有时刻共享**,所以能吃任意长的序列;② h_t **藏着全部过去**——同样最后输入 +2,历史 [2] 得 0.923、历史 [−3] 得 0.269,记忆不同结果就不同。` +
        `RNN 是语言模型、翻译、语音的早期主力;长序列会梯度消失,于是有了 LSTM/GRU 的门控、再到 Transformer 的注意力。`,
    })

    const base0: Frame = {
      step: -1, xs: XS, wx: WX, wh: WH, b: B, t: 0, xt: 0, hPrev: 0, pre: 0, ht: 0, hs: XS.map(() => null), phase: 'run', log: '',
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
