/**
 * 内核：残差连接 = 梯度高速路（深度学习 · 原理：为什么深网络能训得动）
 * 轴：step —— 梯度从输出层往输入层一层层倒着传，对比"有残差 vs 没残差"它衰减成什么样
 *
 * 深层网络训练靠反向传播：梯度从损失出发、乘着每一层的局部导数往回传。链式法则 = **连乘**。
 *   · 普通块 y = f(x)，这一层的因子是 **f′**；
 *   · 残差块 y = x + f(x)，因子变成 **1 + f′** —— 那个 **+1 是一条恒等高速路**。
 * 两者用的是**同一个 f**，差别只在那个 +1。ResNet、Transformer 的每个子层都裹着残差，就是为它。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本把两条曲线的因子**直接写死**：没残差每层 ×0.8，有残差 ×(1+小扰动)≈1。
 * 于是这个实验变成了"我说它塌它就塌、我说它稳它就稳"——**两条曲线都是我编的**，
 * 而不是从"同一个 f、差一个 +1"推出来的。它演示了结论，却没有演示**为什么**。
 *
 * 补厚之后：每层现抽一个支路导数 f′（随机正负、量级由旋钮定），
 * 两条链**用同一批 f′**，普通链乘 |f′|、残差链乘 |1+f′| —— 差别只剩那个 +1。
 * 于是能看见一件老版本永远看不见、而且相当反直觉的事：
 *
 *   **残差不是万能的。那个 +1 只有在支路 f′ 足够小的时候才是"高速路"。**
 *   实测：f′≈0.1 时 50 层的残差链还剩 0.22（普通链 1.6e-50）；
 *   f′≈0.6 时残差链 16 层就掉到 0.013、50 层剩 3.4e-10 —— 仍比普通链好几十倍，但**也塌了**。
 *   因为 1+f′ 在 1.6 和 0.4 之间跳，log 的均值仍然是负的。
 *   这正是 ResNet-v2 的预激活 / Fixup / LayerScale / Transformer 残差缩放这一整条线
 *   要解决的同一件事：**把支路压小，让 1+f′ 真的贴着 1**。
 *
 * 屏幕上还并排摆着**理论衰减率与实测**：每层 log 因子的期望能算出来，
 * N 层之后的量级就是 exp(N·E[log])，跟实测逐位对。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function lcg(seed: number) {
  let s = seed >>> 0
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 0x100000000 }
}

export type ResidualState = {
  i: number
  step: number
  layer: number              // 当前倒传到第几层（从 N 到 1）
  depth: number
  branch: number             // 支路导数 f′ 的量级
  gradPlain: number          // 没残差：到这一层的梯度大小
  gradRes: number            // 有残差：到这一层的梯度大小
  plainFactor: number        // 这一层的 |f′|
  resFactor: number          // 这一层的 |1+f′|
  histPlain: number[]
  histRes: number[]
  //  理论：每层 log 因子的期望 → N 层之后该是多少（跟实测并排核对）
  thPlain: number
  thRes: number
  resHolds: boolean          // 残差链是不是真的守住了（末端 > 0.1）
  plainDead: boolean
  gain: number               // 残差末端 / 普通末端 —— "+1 到底值多少"
  phase: 'run' | 'done'
  log: string
}

export const RESIDUAL_VISIBLE = [
  'step', 'layer', 'depth', 'branch', 'gradPlain', 'gradRes', 'plainFactor', 'resFactor',
  'histPlain', 'histRes', 'thPlain', 'thRes', 'resHolds', 'plainDead', 'gain', 'phase', 'log',
] as const

type Frame = Omit<ResidualState, 'i'>

export const residualKernel: Kernel<ResidualState> = {
  kind: 'residual',

  compile(doc: SimDocument): CompiledModel<ResidualState> {
    const N = doc.params.depth === undefined ? 16 : num(doc.params, 'depth')
    const btag = doc.params.branch === undefined ? '中 f′≈0.4' : str(doc.params, 'branch')
    /*  ⚠️ "强"这一档取 0.6，不取 0.8，是**算过的**：
        这是个一维标量模型，普通链每层 log 因子是 log|f′|，残差链是 E[log|1±f′|]=½log(1−f′²)。
        两者在 f′=1/√2≈0.707 处交叉 —— 超过它，标量模型会给出"残差比普通还差"的结论。
        那是**一维的假象**（真网络的雅可比是矩阵，加单位阵之后谱的行为不是这么回事），
        照搬到屏幕上就成了教错东西。0.6 落在交叉点以内：残差仍然明显更好，但**也会塌**，
        这才是这一档真正要演的机制。 */
    const branch = btag.startsWith('弱') ? 0.1 : btag.startsWith('强') ? 0.6 : 0.4

    /*  每层抽一个支路导数 f′：量级在 branch 附近抖动，**正负各半**。
        正负是关键 —— 真网络里 f′ 没道理总是同号，而 1+f′ 的好坏全看它落在 1 的哪一边。 */
    const rand = lcg(1234567)
    const fp = Array.from({ length: N }, () => {
      const mag = branch * (0.7 + 0.6 * rand())     // 0.7~1.3 倍的量级抖动
      return rand() < 0.5 ? -mag : mag
    })

    //  ⚠️ 两条链**用同一批 f′**：普通乘 |f′|、残差乘 |1+f′|，差别只剩那个 +1。
    const pf = fp.map(v => Math.abs(v))
    const rf = fp.map(v => Math.abs(1 + v))

    //  理论：每层 log 因子的期望（对这批 f′ 现算），N 层之后就是 exp(N·E[log])
    const meanLog = (a: number[]) => a.reduce((s, v) => s + Math.log(Math.max(1e-300, v)), 0) / a.length
    const thPlain = Math.exp(N * meanLog(pf))
    const thRes = Math.exp(N * meanLog(rf))

    const frames: Frame[] = []
    let gradPlain = 1, gradRes = 1
    const histPlain = [1], histRes = [1]
    /*  ⚠️ 阈值原来写的是 1e-4：2.29e-4 会被 toFixed(4) 磨成 0.0002 —— 只剩一位有效数字，
      屏幕上和理论值就对不上了（判据当场抓到）。小于 0.01 一律走有效数字。 */
    const keep = (v: number) => (v >= 0.01 ? +v.toFixed(4) : +v.toPrecision(3))

    for (let k = 0; k < N; k++) {
      const layer = N - k
      gradPlain *= pf[k]
      gradRes *= rf[k]
      histPlain.push(keep(gradPlain))
      histRes.push(keep(gradRes))
      frames.push({
        step: k, layer, depth: N, branch,
        gradPlain: keep(gradPlain), gradRes: keep(gradRes),
        plainFactor: +pf[k].toFixed(3), resFactor: +rf[k].toFixed(3),
        histPlain: histPlain.slice(), histRes: histRes.slice(),
        thPlain: +thPlain.toPrecision(3), thRes: +thRes.toPrecision(3),
        resHolds: false, plainDead: false, gain: 0, phase: 'run',
        log: `梯度倒传穿过第 ${layer} 层，这一层抽到的支路导数 f′=**${fp[k].toFixed(3)}**：`
          + `　**没残差**乘 |f′|=${pf[k].toFixed(3)} → ${gradPlain < 1e-4 ? gradPlain.toExponential(2) : gradPlain.toFixed(4)}；`
          + `　**有残差**乘 |1+f′|=${rf[k].toFixed(3)} → ${gradRes < 1e-4 ? gradRes.toExponential(2) : gradRes.toFixed(4)}。`
          + (gradPlain < 0.01 && gradRes > 0.1 ? `　没残差的已经快没了，有残差的还稳着 —— 差的就是那个 **+1**。` : ``),
      })
    }

    const endP = gradPlain, endR = gradRes
    const plainDead = endP < 0.01
    const resHolds = endR > 0.1
    const gain = endP > 0 ? endR / endP : Infinity
    const fmt = (v: number) => (v >= 1e-4 ? v.toFixed(4) : v.toExponential(2))

    const verdict =
      `梯度穿过全部 ${N} 层：**没残差**塌到 **${fmt(endP)}**`
      + `（每层乘的 |f′| 平均 ${branch}，${N} 层连乘，理论值 ${thPlain.toExponential(2)} —— 实测对得上）；`
      + `**有残差**是 **${fmt(endR)}**。`
      + (resHolds
        ? `　差别只有一个 **+1**：普通块 y=f(x) 的导数是 f′，残差块 y=x+f(x) 的导数是 **1+f′**。`
          + `f′ 再小，那条恒等路也把梯度**原样递了过去**，连乘不再塌向 0。`
          + `　这一档残差比普通强 **${gain > 1e4 ? gain.toExponential(1) : gain.toFixed(0)} 倍** —— `
          + `ResNet、Transformer 的每个子层都裹残差，几十上百层才训得动，就是为这个。`
          + `　⚠️ 但别把它当万能：把「支路强度」拧到"强 f′≈0.6"再看同样的深度。`
        : `　**注意：残差这次也没守住。** 支路导数量级到了 ${branch}，1+f′ 就在 ${(1 + branch).toFixed(1)} 和 ${(1 - branch).toFixed(1)} 之间跳，`
          + `log 的均值仍然是负的（每层平均 ${Math.exp(meanLog(rf)).toFixed(3)}），${N} 层连乘照样塌到 ${fmt(endR)}。`
          + `　那个 +1 只有在 **f′ 足够小**、让 1+f′ 真的贴着 1 的时候，才是一条高速路。`
          + `　它比普通链仍然好 ${gain > 1e4 ? gain.toExponential(1) : gain.toFixed(0)} 倍，但"深就完事了"是不成立的。`
          + `　这正是 ResNet-v2 的预激活、Fixup、LayerScale、以及 Transformer 里各种残差缩放要解决的同一件事：`
          + `**把支路压小**。把旋钮拧回"弱 f′≈0.1"，高速路就回来了。`)

    frames.push({
      ...frames[frames.length - 1], phase: 'done',
      resHolds, plainDead, gain: +(gain > 1e9 ? gain.toPrecision(3) : gain.toFixed(1)), log: verdict,
    })

    const base0: Frame = {
      step: -1, layer: N + 1, depth: N, branch, gradPlain: 1, gradRes: 1,
      plainFactor: branch, resFactor: 1, histPlain: [1], histRes: [1],
      thPlain: +thPlain.toPrecision(3), thRes: +thRes.toPrecision(3),
      resHolds: false, plainDead: false, gain: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '倒传层数' },
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
