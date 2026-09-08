/**
 * 内核：反向传播（深度学习算法 · 原理：链式法则怎么把"误差"逐层回传成每个权重的梯度）
 * 轴：step —— 先前向逐层算到损失，再让梯度从损失出发、顺着链式法则一站站往回传
 *
 * 反向传播是训练神经网络的**发动机**。它分两趟：**前向**——数据从输入流到输出、算出损失 L；
 * **反向**——从 L 出发，用**链式法则**把"L 对每个中间量的偏导"一站接一站往回算，
 * 最后得到 **L 对每个权重的梯度**，交给梯度下降去更新。核心就一句：
 * **下游的梯度 × 本站的局部导数 = 上游的梯度**。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本只有**一个神经元**：x=1、w=0.8、b=0.2 → σ → 平方损失，四帧走完。
 * 链式法则本身是讲清楚了，可"反向传播"这件事真正的分量在**深度**上——
 * 一个神经元根本演不出它最重要的那个后果：
 *
 *   **梯度回传是一长串数连乘。每层乘一个 w·f′(z)，链一长，它要么塌成 0，要么炸上天。**
 *
 * 这是深度学习从 1990 年代卡到 2010 年代的那道坎，也是 ReLU、BN、残差连接**全部**要解决的
 * 同一个问题。补厚就补这个：三个旋钮（层数 / 激活函数 / 权重尺度），外加一条
 * **逐层梯度大小的柱状图** —— 第一层的梯度比最后一层小多少倍，是**看**出来的。
 *
 * 各激活函数的 f′ 上界写在这儿，因为它就是答案本身：
 *   · sigmoid：f′=a(1−a) ≤ **0.25** —— 光这一项每层就至少缩 4 倍，跟权重多小无关；
 *   · tanh：   f′=1−a² ≤ **1**，比 sigmoid 好，但在饱和区照样塌；
 *   · ReLU：   f′ ∈ {0, 1} —— 正半轴**一点不缩**，这就是它替换 sigmoid 的全部理由。
 * 于是"每层的缩放因子 ≈ w·f′"这句话能在屏幕上跟实测逐层比值直接对上。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

/*  ⚠️ b 原来是 0.2，扫参数时发现它会踩一个**退化**：ReLU 的链有不动点 a*=b/(1−w)，
    b=0.2、w=0.8 时 a*=1.0 —— 正好等于目标 t=1。于是损失恒为 0、所有梯度全是 0，
    整屏都是 0.000，什么都演不出来。改成 0.1 之后 a*=0.5，三档 w 一个都不撞 t。 */
const X = 1, B = 0.1, T = 1
const r3 = (v: number) => +v.toFixed(3)
//  小数量级的梯度用有效数字表示，否则 toFixed(3) 全是 0.000，屏幕上看不出差别
const sig4 = (v: number) => {
  if (v === 0) return 0
  const a = Math.abs(v)
  return a >= 1e-3 ? +v.toFixed(4) : +v.toPrecision(2)
}

type Act = { f: (z: number) => number; d: (z: number, a: number) => number; cap: number; note: string }
const ACTS: Record<string, Act> = {
  sigmoid: { f: z => 1 / (1 + Math.exp(-z)), d: (_z, a) => a * (1 - a), cap: 0.25,
    note: 'f′=a(1−a)，最大只有 **0.25**（a=0.5 时取到）——光这一项每层就至少缩 4 倍' },
  tanh: { f: z => Math.tanh(z), d: (_z, a) => 1 - a * a, cap: 1,
    note: 'f′=1−a²，最大 **1**（z=0 时取到），比 sigmoid 强；但 |z| 一大就迅速塌向 0' },
  ReLU: { f: z => Math.max(0, z), d: z => (z > 0 ? 1 : 0), cap: 1,
    note: 'f′ 只有 0 和 **1** 两个值：正半轴**一点都不缩**——这就是它替掉 sigmoid 的全部理由' },
}

export type BackpropState = {
  i: number
  step: number
  phase: 'forward' | 'back' | 'done'
  x: number; w: number; b: number; t: number
  depth: number
  act: string
  actNote: string
  fpCap: number              // f′ 的上界 —— "每层至少缩多少"的解析来源
  zs: number[]; as: number[] // 各层的 z 与 a（前向逐层揭示）
  fwdAt: number              // 前向走到第几层（-1=还没开始）
  backAt: number             // 反向回到第几层（depth=还没开始）
  loss: number
  gA: (number | null)[]      // dL/da_l
  gZ: (number | null)[]      // dL/dz_l
  gW: (number | null)[]      // dL/dw_l —— 这一排就是"逐层梯度大小"
  gwAll: number[]            // 全部层的 dL/dw（结论用，不参与逐步揭示）
  layerFactor: number[]      // 每层的实测缩放因子 |w·f′(z_l)|
  /*  ⚠️ 判"塌了还是炸了"要用 chain，不能用 ratio。
      chain = |dL/da 在最前面一层| / |在最后一层| = Π|w·f′| —— 这是**回传信号**本身的放大倍数。
      ratio 是首末两层**权重梯度**之比，它还乘着各层的输入 a；ReLU + w=1.5 时
      信号放大 17 倍、而 a 也同步放大，两头几乎抵消，ratio 只有 0.73 —— 拿它判就会漏报爆炸。 */
  chain: number              // Π|w·f′| —— 回传信号穿过整条链后的放大倍数
  ratio: number              // |第一层权重梯度| / |最后一层权重梯度|
  vanish: boolean; explode: boolean
  // 单神经元那档保留的旧字段（老快照/讲解还在读）
  z: number; a: number
  gLda: number | null; gLdz: number | null; gLdw: number | null; gLdb: number | null
  stage: string
  log: string
}

export const BACKPROP_VISIBLE = [
  'step', 'phase', 'x', 'w', 'b', 't', 'depth', 'act', 'actNote', 'fpCap', 'zs', 'as',
  'fwdAt', 'backAt', 'loss', 'gA', 'gZ', 'gW', 'gwAll', 'layerFactor', 'chain', 'ratio', 'vanish', 'explode',
  'z', 'a', 'gLda', 'gLdz', 'gLdw', 'gLdb', 'stage', 'log',
] as const

type Frame = Omit<BackpropState, 'i'>

export const backpropKernel: Kernel<BackpropState> = {
  kind: 'backprop',

  compile(doc: SimDocument): CompiledModel<BackpropState> {
    const depth = doc.params.depth === undefined ? 1 : num(doc.params, 'depth')
    const actName = doc.params.act === undefined ? 'sigmoid' : str(doc.params, 'act')
    const W = doc.params.w === undefined ? 0.8 : num(doc.params, 'w')
    const act = ACTS[actName] ?? ACTS.sigmoid

    //  ── 前向：一条 depth 层的链，每层同样的 w 和 b（好让"每层乘同一个因子"这件事干净）──
    const zs: number[] = [], as: number[] = []
    let a = X
    for (let l = 0; l < depth; l++) {
      const z = W * a + B
      a = act.f(z)
      zs.push(r3(z)); as.push(r3(a))
    }
    const aL = as[depth - 1]
    const loss = (aL - T) ** 2

    //  ── 反向：从损失出发，一站站回传 ──
    const gA = new Array<number>(depth), gZ = new Array<number>(depth), gW = new Array<number>(depth)
    const layerFactor = new Array<number>(depth)
    let g = 2 * (aL - T)                       // dL/da_L
    for (let l = depth - 1; l >= 0; l--) {
      gA[l] = g
      const fp = act.d(zs[l], as[l])
      gZ[l] = g * fp
      gW[l] = gZ[l] * (l === 0 ? X : as[l - 1])
      layerFactor[l] = Math.abs(W * fp)        // 再往上走一层，梯度要乘的就是它
      g = gZ[l] * W                            // dL/da_{l−1}
    }

    const first = Math.abs(gW[0]), lastG = Math.abs(gW[depth - 1])
    const ratio = lastG > 0 ? first / lastG : 0
    const chain = Math.abs(gA[depth - 1]) > 0 ? Math.abs(gA[0]) / Math.abs(gA[depth - 1]) : 0
    const vanish = depth > 1 && chain < 0.1
    const explode = depth > 1 && chain > 10

    const common = {
      x: X, w: W, b: B, t: T, depth, act: actName, actNote: act.note, fpCap: act.cap,
      zs, as, loss: r3(loss), gwAll: gW.map(sig4),
      layerFactor: layerFactor.map(v => +v.toFixed(3)),
      chain: +chain.toPrecision(3), ratio: +ratio.toPrecision(3), vanish, explode,
      z: zs[0], a: as[0],
    }
    const nulls = () => ({ gA: gA.map(() => null), gZ: gZ.map(() => null), gW: gW.map(() => null) })
    const upto = (l: number) => ({
      gA: gA.map((v, k) => (k >= l ? sig4(v) : null)),
      gZ: gZ.map((v, k) => (k >= l ? sig4(v) : null)),
      gW: gW.map((v, k) => (k >= l ? sig4(v) : null)),
    })
    //  单神经元那档，旧字段照旧填（讲解和老快照还在读它们）
    const legacy = (back: number) => ({
      gLda: back <= 0 ? sig4(gA[0]) : null,
      gLdz: back <= 0 ? sig4(gZ[0]) : null,
      gLdw: back <= 0 ? sig4(gW[0]) : null,
      gLdb: back <= 0 ? sig4(gZ[0]) : null,
    })

    const frames: Frame[] = []

    //  前向：逐层揭示
    for (let l = 0; l < depth; l++) {
      frames.push({
        step: frames.length, phase: 'forward', ...common, fwdAt: l, backAt: depth, ...nulls(), ...legacy(depth),
        stage: depth === 1 ? '前向' : `前向 · 第 ${l + 1} 层`,
        log: `**前向**${depth > 1 ? `（第 ${l + 1}/${depth} 层）` : ''}：`
          + `z${depth > 1 ? `${l + 1}` : ''}=w·${l === 0 ? 'x' : `a${l}`}+b=${W}×${l === 0 ? X : as[l - 1]}+${B}=**${zs[l]}**，`
          + `a=${actName}(z)=**${as[l]}**。`
          + (l === depth - 1 ? `　到顶了：损失 L=(a−t)²=**${r3(loss)}**（t=${T}）。` : ''),
      })
    }

    //  反向：逐层回传
    for (let l = depth - 1; l >= 0; l--) {
      const fp = act.d(zs[l], as[l])
      frames.push({
        step: frames.length, phase: 'back', ...common, fwdAt: depth - 1, backAt: l, ...upto(l), ...legacy(l),
        stage: depth === 1 ? 'L→a→z→w,b' : `反向 · 第 ${l + 1} 层`,
        log: (l === depth - 1
          ? `**反向**从损失出发：dL/da = 2(a−t) = **${sig4(gA[l])}**（损失对输出的敏感度）。`
          : `下游传来 dL/da${l + 1} = **${sig4(gA[l])}**。`)
          + `　过 ${actName} 这站：局部导数 f′=${r3(fp)}，于是 dL/dz = ${sig4(gA[l])}×${r3(fp)} = **${sig4(gZ[l])}**；`
          + `再乘上这一层的输入 ${l === 0 ? `x=${X}` : `a${l}=${as[l - 1]}`}，得 **dL/dw${depth > 1 ? l + 1 : ''} = ${sig4(gW[l])}**。`
          + (l > 0
            ? `　继续往上传时还要再乘 w=${W}：合起来每往上一层，梯度乘 |w·f′| = **${layerFactor[l].toFixed(3)}**`
              + (layerFactor[l] < 0.5 ? `（不到 ½ —— 再走几层就没了）` : layerFactor[l] > 1.2 ? `（大于 1 —— 越传越大）` : ``) + `。`
            : `　这已经是最前面一层。`),
      })
    }

    //  收尾
    const gm = layerFactor.reduce((p, v) => p * v, 1) ** (1 / depth)
    const verdict = depth === 1
      ? `一次反向传播就把所有梯度算完了：dL/dw=${sig4(gW[0])}、dL/db=${sig4(gZ[0])}`
        + `（都是负的 → 梯度下降会**增大** w、b，把 a 往 t=1 推、损失降）。`
        + `　核心只有一句：**下游梯度 × 本站局部导数 = 上游梯度**。`
        + `　现在把「层数」拧到 4 或 8 —— 同一条链式法则会演出一件完全不同的事。`
      : vanish
        ? `**梯度消失了。** 回传信号穿过这 ${depth} 层之后只剩 **${chain.toExponential(1)}** 倍，`
          + `第 1 层的权重梯度是 ${sig4(gW[0])}，最后一层还有 ${sig4(gW[depth - 1])}。`
          + `　原因全在那串连乘：每往上传一层要乘 |w·f′|，这条链上平均每层乘 **${gm.toFixed(3)}**，`
          + `${depth} 层下来就是 ${gm.toFixed(3)}^${depth - 1} ≈ ${(gm ** (depth - 1)).toExponential(1)}。`
          + `　${actName === 'sigmoid' ? `而 sigmoid 的 f′=a(1−a) **最大只有 0.25**：哪怕 w 取到 4，w·f′ 也才勉强到 1。`
            : `${actName} 的 f′ 上界是 ${act.cap}，但这条链落在了它塌下去的那一段。`}`
          + `　后果不是"训练慢一点"，是**前面几层几乎收不到任何更新信号** —— 深层网络从 1990 年代卡到 2010 年代，卡的就是这个。`
          + `　换成 ReLU 再看：f′ 在正半轴恒等于 1，这一项就不缩了。`
        : explode
          ? `**梯度爆炸了。** 回传信号穿过这 ${depth} 层被放大了 **${chain.toPrecision(3)} 倍**：`
            + `每层乘 |w·f′|≈${gm.toFixed(3)} **大于 1**，${depth} 层连乘就是 ${(gm ** (depth - 1)).toExponential(1)}。`
            + `看权重梯度的绝对大小：${sig4(gW[depth - 1])} —— 一步更新就能把权重掀翻、损失变 NaN。`
            + `　⚠️ 注意这一档里**首末两层的权重梯度差不多大**（比 ${ratio.toPrecision(2)}）：`
            + `dL/dw 还要乘上这一层的输入 a，而 a 正沿着同一个 w 同步放大，两头几乎抵消。`
            + `**所以判断塌没塌、炸没炸，要看回传信号 Π|w·f′|，不能看首末权重梯度之比。**`
            + `　实践里的解法是**梯度裁剪**（把梯度范数截到上限）和更谨慎的初始化 —— 跟梯度消失是同一根链条的两端。`
          : `${depth} 层的链，一趟反向就把每层的梯度全算出来了。`
            + `回传信号穿过整条链后是 **${chain.toPrecision(3)}** 倍 —— `
            + `这一档**既没塌也没炸**：每层乘的 |w·f′| 平均 ${gm.toFixed(3)}，还算贴着 1。`
            + `　这正是各种初始化方法（Xavier / He）刻意追求的状态：**让每层的缩放因子尽量接近 1**。`
            + `　${act.note}`
    frames.push({
      step: frames.length, phase: 'done', ...common, fwdAt: depth - 1, backAt: 0, ...upto(0), ...legacy(0),
      stage: '完成', log: verdict,
    })

    const base0: Frame = {
      step: -1, phase: 'forward', ...common, fwdAt: -1, backAt: depth, ...nulls(),
      gLda: null, gLdz: null, gLdw: null, gLdb: null, stage: '', log: '',
    }

    return {
      axis: { kind: 'step', label: '前向/反向' },
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
