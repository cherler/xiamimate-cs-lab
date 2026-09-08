/**
 * 内核：主成分分析 PCA（机器学习算法 · 原理：找数据"最铺开"的方向，把高维压成低维）
 * 轴：step —— 找出方差最大的主轴，把点投影上去，看 2D 怎么压成 1D
 *
 * 一堆数据里各维往往**相关**、真正"有效"的维度没那么多。PCA 就是找**方差最大的那个方向**（主成分 PC1），
 * 再找与它正交、次大方差的 PC2……把点**投影**到前几个主成分上，就用更少的维度保住大部分信息。
 * 数学上：主成分 = **协方差矩阵的特征向量**，对应特征值 = 那个方向上的方差。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本只有一团写死的点云、四帧、一个结论「PC1 保留 96%」。看着挺好，问题是**它只演了 PCA 成功的样子**。
 * 而 PCA 在实际用起来时，绝大多数的坑都在"它什么时候不该用/ 用了会错"上，那些一个都没演。
 * 补厚补的是三个旋钮，每个旋钮都通向一个**具体的坑**：
 *
 *   · **数据形状**
 *       「拉长的云」——PCA 教科书样子，主方向明确。
 *       「两团（类别方向≠主方向）」——**这是 PCA 最著名的失手**。两类分开的方向方差很小，
 *         云拉长的方向方差很大，于是 PC1 指着"拉长"、把两类**压成一堆**。屏幕上会把
 *         "投到 PC1 之后两类还分得开吗"和"投到 PC2 呢"两个数并排摆出来。
 *         PCA 是**无监督**的，它根本不知道有类别这回事 —— 这就是 LDA 存在的理由。
 *       「各向同性（没有主方向）」——λ1≈λ2，PC1 的方向基本是噪声决定的。
 *         "主成分"这个概念此刻**没有意义**，但 PCA 照样会给你一个方向、一个角度、一个百分比。
 *   · **单位** —— 把 x 轴换个单位（×10，比如"米"改成"分米"）。**数据一点没变，PC1 却掉头去追 x 轴**。
 *     PCA 吃的是协方差，而协方差**带量纲**。这是所有 PCA 教程都要讲、但很少演的一条。
 *   · **要不要先标准化** —— 上一条的解药：z-score 之后再做，PC1 就回来了。
 *
 * 另外补了一个**能手核的恒等式**：丢掉 PC2 的重构误差（每点到主轴的垂距平方均值）
 * **正好等于 λ2**。屏幕上两个数并排放着，可以逐位核对 —— 这比"信息损失很小"这种话实在得多。
 */
import { str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}
//  近似正态：12 个均匀之和（Irwin–Hall），减掉均值 —— 比单个均匀更像真实数据
const gauss = (r: () => number) => Array.from({ length: 6 }, r).reduce((a, b) => a + b, 0) / Math.sqrt(0.5)

type Pt = { x: number; y: number; c: number }

/*  ⚠️ "这团点有没有主方向"不能拿一个拍脑袋的阈值判。
    实测：各向同性的 28 个点，样本 λ1/λ2 也有 1.7 —— 纯抽样噪声就能造出"63.5% 的方差在 PC1 上"。
    所以这里现算一条**噪声地板**：同样点数的各向同性数据，λ1/λ2 的中位数是多少。
    观测值只有明显超过这条线，"主方向"才算真的存在（统计上这叫平行分析 / Horn 法）。 */
function nullRatioFor(n: number, reps = 200): number {
  const r = lcg(97)
  const out: number[] = []
  for (let k = 0; k < reps; k++) {
    let ca = 0, cb = 0, cd = 0, mx = 0, my = 0
    const xs: number[] = [], ys: number[] = []
    for (let i = 0; i < n; i++) { const a = gauss(r), b = gauss(r); xs.push(a); ys.push(b); mx += a; my += b }
    mx /= n; my /= n
    for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; ca += dx * dx; cb += dx * dy; cd += dy * dy }
    ca /= n; cb /= n; cd /= n
    const tr = ca + cd, root = Math.sqrt(Math.max(0, tr * tr / 4 - (ca * cd - cb * cb)))
    out.push((tr / 2 + root) / Math.max(1e-12, tr / 2 - root))
  }
  out.sort((a, b) => a - b)
  return +out[Math.floor(out.length / 2)].toFixed(2)
}

//  主方向固定在 33°，让"拉长"这件事跨数据集是同一个方向，好对照
const TH = 33 * Math.PI / 180
const UX = Math.cos(TH), UY = Math.sin(TH)          // 拉长方向（大方差）
const WX = -Math.sin(TH), WY = Math.cos(TH)         // 与它正交（小方差）

function makePoints(kind: string): Pt[] {
  const r = lcg(3)
  if (kind === '两团（类别方向≠主方向）') {
    /*  两类的中心差在**小方差**那个方向上（±0.9），而云沿大方差方向拉开（±2.2）。
        于是 PC1 会指着"拉长"，把两类压成一堆 —— PCA 最著名的失手。 */
    return Array.from({ length: 28 }, (_, i) => {
      const c = i % 2
      const t = gauss(r) * 2.2, n = gauss(r) * 0.35 + (c ? 0.9 : -0.9)
      return { x: +(t * UX + n * WX).toFixed(3), y: +(t * UY + n * WY).toFixed(3), c }
    })
  }
  if (kind === '各向同性（没有主方向）') {
    //  两个方向方差一样 —— "主成分"此刻没有意义
    return Array.from({ length: 28 }, () => {
      const a = gauss(r) * 1.4, b = gauss(r) * 1.4
      return { x: +(a * UX + b * WX).toFixed(3), y: +(a * UY + b * WY).toFixed(3), c: 0 }
    })
  }
  //  默认：拉长的云
  return Array.from({ length: 28 }, () => {
    const t = gauss(r) * 2.2, n = gauss(r) * 0.45
    return { x: +(t * UX + n * WX).toFixed(3), y: +(t * UY + n * WY).toFixed(3), c: 0 }
  })
}

export type PCAState = {
  i: number
  step: number
  phase: 'cloud' | 'axis' | 'project' | 'done'
  points: Pt[]
  mean: { x: number; y: number }
  pc1: { x: number; y: number }
  pc2: { x: number; y: number }
  angle: number
  angleTrue: number          // 数据被"造"出来时的拉长方向（33°）——单位一换，PC1 就离开它
  proj: { x: number; y: number }[]
  lam1: number; lam2: number
  var1: number
  ratio: number              // λ1/λ2 —— 主方向到底有多"主"
  nullRatio: number          // 同样点数的**纯噪声**能给出多大的 λ1/λ2（噪声地板）
  real: boolean              // 观测比值明显超过噪声地板 —— "主方向"才算真的存在
  recErr: number             // 丢掉 PC2 的重构误差（垂距平方均值）= λ2，可逐位核对
  sep1: number; sep2: number // 两类中心在 PC1 / PC2 上分开多少个标准差（只有两团那档有意义）
  hasClass: boolean
  kind: string
  unit: string
  prep: string
  scaled: boolean
  stdized: boolean
  log: string
}

export const PCA_VISIBLE = [
  'step', 'phase', 'points', 'mean', 'pc1', 'pc2', 'angle', 'angleTrue', 'proj',
  'lam1', 'lam2', 'var1', 'ratio', 'nullRatio', 'real', 'recErr', 'sep1', 'sep2', 'hasClass',
  'kind', 'unit', 'prep', 'scaled', 'stdized', 'log',
] as const

type Frame = Omit<PCAState, 'i'>

export const pcaKernel: Kernel<PCAState> = {
  kind: 'pca',

  compile(doc: SimDocument): CompiledModel<PCAState> {
    const kind = doc.params.data === undefined ? '拉长的云' : str(doc.params, 'data')
    const unit = doc.params.unit === undefined ? 'x、y 同单位' : str(doc.params, 'unit')
    const prep = doc.params.prep === undefined ? '直接做' : str(doc.params, 'prep')
    const scaled = unit !== 'x、y 同单位'
    const stdized = prep !== '直接做'

    let pts = makePoints(kind)
    //  ① 换单位：x 乘 10。数据本身**一点没变**，只是"用分米记的"
    if (scaled) pts = pts.map(p => ({ ...p, x: +(p.x * 10).toFixed(3) }))

    const N = pts.length
    let mx = pts.reduce((a, p) => a + p.x, 0) / N
    let my = pts.reduce((a, p) => a + p.y, 0) / N
    //  ② 标准化：每维减均值除标准差 —— 上一条的解药
    if (stdized) {
      const sx = Math.sqrt(pts.reduce((a, p) => a + (p.x - mx) ** 2, 0) / N) || 1
      const sy = Math.sqrt(pts.reduce((a, p) => a + (p.y - my) ** 2, 0) / N) || 1
      pts = pts.map(p => ({ ...p, x: +((p.x - mx) / sx).toFixed(3), y: +((p.y - my) / sy).toFixed(3) }))
      mx = 0; my = 0
    }

    //  协方差 + 2×2 特征分解（闭式，可手核）
    let ca = 0, cb = 0, cd = 0
    for (const p of pts) { const dx = p.x - mx, dy = p.y - my; ca += dx * dx; cb += dx * dy; cd += dy * dy }
    ca /= N; cb /= N; cd /= N
    const tr = ca + cd, det = ca * cd - cb * cb
    const root = Math.sqrt(Math.max(0, tr * tr / 4 - det))
    const lam1 = tr / 2 + root, lam2 = tr / 2 - root
    let vx = cb, vy = lam1 - ca
    if (Math.hypot(vx, vy) < 1e-12) { vx = 1; vy = 0 }      // 完全各向同性时的退化保护
    const nn = Math.hypot(vx, vy); vx /= nn; vy /= nn
    const angle = Math.round(((Math.atan2(vy, vx) * 180 / Math.PI) + 180) % 180)
    const var1 = +(100 * lam1 / (lam1 + lam2)).toFixed(1)
    const ratio = +(lam1 / (lam2 || 1e-12)).toFixed(2)

    const proj = pts.map(p => {
      const t = (p.x - mx) * vx + (p.y - my) * vy
      return { x: +(mx + t * vx).toFixed(3), y: +(my + t * vy).toFixed(3) }
    })
    //  ⚠️ 重构误差 = 每点到主轴的垂距平方均值。理论上它**正好等于 λ2**，屏幕上并排核对。
    const recErr = pts.reduce((a, p, k) => a + (p.x - proj[k].x) ** 2 + (p.y - proj[k].y) ** 2, 0) / N

    //  两类在某个方向上分开几个标准差（Fisher 判别比的一维版）
    const hasClass = pts.some(p => p.c === 1)
    const sepOn = (ax: number, ay: number) => {
      if (!hasClass) return 0
      const g = [0, 1].map(c => pts.filter(p => p.c === c).map(p => (p.x - mx) * ax + (p.y - my) * ay))
      const m = g.map(v => v.reduce((a, b) => a + b, 0) / v.length)
      const sd = Math.sqrt(g.reduce((a, v, i) => a + v.reduce((s, t) => s + (t - m[i]) ** 2, 0), 0) / N) || 1e-12
      return +(Math.abs(m[0] - m[1]) / sd).toFixed(2)
    }
    const sep1 = sepOn(vx, vy), sep2 = sepOn(-vy, vx)

    const nullRatio = nullRatioFor(N)
    const real = ratio > nullRatio * 1.5

    const common = {
      points: pts, mean: { x: +mx.toFixed(3), y: +my.toFixed(3) },
      pc1: { x: +vx.toFixed(3), y: +vy.toFixed(3) }, pc2: { x: +(-vy).toFixed(3), y: +vx.toFixed(3) },
      angle, angleTrue: 33, lam1: +lam1.toFixed(4), lam2: +lam2.toFixed(4), var1, ratio, nullRatio, real,
      recErr: +recErr.toFixed(4), sep1, sep2, hasClass, kind, unit, prep, scaled, stdized,
    }

    //  屏幕上那句"这次到底出了什么事"，按三种坑分开说
    const verdict =
      !real
        ? `⚠️ λ1/λ2 只有 **${ratio}**，而同样 ${N} 个点的**纯噪声**就能给出 **${nullRatio}** —— 观测值压根没超出噪声地板。`
          + `　所以屏幕上那个"${var1}% 的方差在 PC1 上"**不是信号，是抽样噪声**：`
          + `各向同性的数据本来就不该有主方向，但有限样本一定会给出一个不完全相等的 λ1、λ2，`
          + `PCA 照样会交给你一个角度和一个漂亮的百分比。`
          + `　**光看"保留了百分之多少"没法判断该不该降维**，得跟噪声地板比 —— 这就是平行分析（Horn 法）在做的事。`
        : scaled && !stdized
          ? `⚠️ x 轴换了个单位（×10），**数据一个点都没动**，PC1 却掉到了 **${angle}°** —— 追着 x 轴去了，`
            + `而 λ1/λ2 被抬到 ${ratio}，"${var1}% 的方差"看着比原来还漂亮。`
            + `　因为 PCA 吃的是协方差，而协方差**带量纲**：谁的数值大谁就"方差大"。`
            + `身高用毫米记、体重用吨记，PC1 就只会讲身高。`
            + `　把"要不要先标准化"拨到 z-score 再看：换不换单位，结果**完全一样**。`
          : hasClass && sep2 > sep1
            ? `⚠️ **PC1 把两类压成了一堆。** 投影到 PC1 之后，两类中心只差 **${sep1}** 个标准差；`
              + `而投影到被丢掉的 PC2 上，它们差 **${sep2}** 个 —— 差着 ${(sep2 / (sep1 || 1e-9)).toFixed(1)} 倍。`
              + `PCA 是**无监督**的：它找的是"铺得最开"，根本不知道有类别这回事。`
              + `想保住类别信息得用 LDA（有监督）—— 这就是那类方法存在的理由。`
            : `PC1 保留了 **${var1}%** 的方差（λ1=${lam1.toFixed(2)} vs λ2=${lam2.toFixed(2)}，差 ${ratio} 倍，`
              + `而纯噪声只能给到 ${nullRatio} —— 这个主方向是**真的**）。2D 压到 1D 只丢 ${(100 - var1).toFixed(1)}%，`
              + `丢掉的那部分正好是 λ2=${lam2.toFixed(3)}。`
              + (stdized
                ? `　注意标准化**本身也会转动 PC1**（把两轴尺度拉平，等于换了个"每维同等重要"的问题来解）——`
                  + `它给你的不是"真方向"，而是**跟单位无关**的方向：×10 与否，这一档的结果分毫不差。`
                : ``)

    const frames: Frame[] = [
      { step: 0, phase: 'cloud', ...common, proj: [],
        log: `${N} 个 2D 点（${kind}${scaled ? '，x 轴按 ×10 的单位记' : ''}${stdized ? '，已 z-score 标准化' : ''}）。`
          + `PCA 想问的只有一句：**哪个方向，点铺得最开？**` },
      { step: 1, phase: 'axis', ...common, proj: [],
        log: `算协方差矩阵 [[${ca.toFixed(2)}, ${cb.toFixed(2)}], [${cb.toFixed(2)}, ${cd.toFixed(2)}]]，`
          + `取**最大特征向量**当 PC1 —— 方向 **${angle}°**，特征值 λ1=**${lam1.toFixed(3)}** 就是这个方向上的方差；`
          + `与它正交的 PC2 上是 λ2=**${lam2.toFixed(3)}**。两者之比 ${ratio}：这个数才是"主方向有多主"。` },
      { step: 2, phase: 'project', ...common, proj,
        log: `把每个点**投影**到 PC1 上（垂线落下）——原来的两个坐标，现在用"在这条轴上的位置"这**一个数**近似表示。`
          + `　丢掉的正是那些垂线：重构误差（垂距平方的均值）= **${recErr.toFixed(4)}**，`
          + `跟 λ2=**${lam2.toFixed(4)}** 一模一样 —— 这不是巧合，"丢掉一个主成分的代价就是它的特征值"。` },
      { step: 3, phase: 'done', ...common, proj, log: verdict },
    ]

    const base0: Frame = { step: -1, phase: 'cloud', ...common, proj: [], log: '' }

    return {
      axis: { kind: 'step', label: '降维步骤' },
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
