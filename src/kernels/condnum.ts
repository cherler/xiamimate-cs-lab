/**
 * 内核：条件数（线代/优化 · 原理：为什么"病态"的问题又慢又难算）
 * 轴：κ —— 把同一个问题越拉越病态，看它**同时**在两个地方变坏
 *
 * 条件数 κ = 最大特征值 / 最小特征值。它有**两张脸**，而它们是同一个数：
 *   · **优化的脸**：梯度下降每步误差最多缩 (κ−1)/(κ+1)。κ 越大越接近 1、收敛越慢。
 *   · **数值的脸**：解 Ax=b 时，b 上的相对误差会被放大到 **κ 倍**传给 x。
 *     ‖Δx‖/‖x‖ ≤ κ·‖Δb‖/‖b‖ —— 这其实才是条件数的**定义式**。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本只演了优化那张脸（收敛步数），数值那张脸只在文字里提了一句
 * 「κ 大还意味着解对噪声极敏感」—— **屏幕上没有任何东西能看见它**。
 * 而那句话才是"条件数"这个名字的来源：它衡量的是**这个问题本身有多不稳**，
 * 跟你用什么算法无关。梯度下降慢只是它的一个后果。
 *
 * 补厚补三样：
 *   1. **数值那张脸**：同一个 A，解一次 Ax=b，再给 b 加一点扰动重解，量 ‖Δx‖/‖x‖ ÷ ‖Δb‖/‖b‖。
 *      最坏方向上它会**顶到 κ**；随便挑个方向通常远够不着 —— κ 是**上界**，不是每次都发生的事。
 *   2. **预处理**（对角缩放 / Jacobi）：把两张脸**同时**修好一部分。
 *      ⚠️ 而且它不是万能的：这里的 A 是**旋转过的**（主轴不平行于坐标轴），
 *      对角缩放只能修"各维尺度不一"那部分病态，修不了"方向相关"那部分。
 *      实测 κ=50 时它只把 κ 降到 38 —— 这一条比"归一化一下就好了"实在得多。
 *   3. 老版本结语里 `1→12→47→${steps}` 是**三个写死的数加一个现算的数**拼起来的。
 *      现在整条序列都由本次运行收集，改了参数不会说错话。
 *
 * A 取 Rᵀ·diag(1, κ)·R（θ=30°），于是 κ(A) 精确等于旋钮上那个 κ，可核对。
 */
import { str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const KAPPAS = [1, 5, 20, 50, 200]
const MAX_ITERS = 4000
const TH = 30 * Math.PI / 180
const C = Math.cos(TH), S = Math.sin(TH)

//  A = Rᵀ diag(1, κ) R —— 主轴转了 30°，特征值就是 1 和 κ
function matFor(kappa: number) {
  return {
    a: C * C + kappa * S * S,
    b: (1 - kappa) * S * C,        // 非对角项：主轴不平行坐标轴，这一项才不为 0
    d: S * S + kappa * C * C,
  }
}
//  2×2 对称阵的特征值（闭式，可手核）
function eig(m: { a: number; b: number; d: number }) {
  const tr = m.a + m.d, root = Math.sqrt(Math.max(0, (m.a - m.d) ** 2 / 4 + m.b * m.b))
  return { hi: tr / 2 + root, lo: tr / 2 - root }
}
const solve = (m: { a: number; b: number; d: number }, r: number[]) => {
  const det = m.a * m.d - m.b * m.b
  return [(m.d * r[0] - m.b * r[1]) / det, (-m.b * r[0] + m.a * r[1]) / det]
}
const norm = (v: number[]) => Math.hypot(v[0], v[1])

export type CondNumState = {
  i: number
  step: number
  kappa: number              // 旋钮上标称的 κ
  kappaEff: number           // 实际在解的那个矩阵的 κ（预处理之后会变小）
  precond: string
  dirMode: string
  steps: number              // 优化：收敛到千分之一所需迭代数
  rate: number               // 优化：理论收敛率 (κ−1)/(κ+1)
  amp: number                // 数值：实测的相对误差放大倍数
  ampCap: number             // 数值：理论上界 = κ
  path: { x: number; y: number }[]
  lossCurve: number[]
  stepsSoFar: [number, number][]   // 已走过的 (κ, 步数)，结语里要用它、不写死
  ampSoFar: [number, number][]
  phase: 'run' | 'done'
  log: string
}

export const CONDNUM_VISIBLE = [
  'step', 'kappa', 'kappaEff', 'precond', 'dirMode', 'steps', 'rate', 'amp', 'ampCap',
  'path', 'lossCurve', 'stepsSoFar', 'ampSoFar', 'phase', 'log',
] as const

type Frame = Omit<CondNumState, 'i'>

export const condnumKernel: Kernel<CondNumState> = {
  kind: 'condnum',

  compile(doc: SimDocument): CompiledModel<CondNumState> {
    const precond = doc.params.precond === undefined ? '不预处理' : str(doc.params, 'precond')
    const dirMode = doc.params.dir === undefined ? '最坏方向' : str(doc.params, 'dir')
    const jacobi = precond !== '不预处理'

    const frames: Frame[] = []
    const stepsSoFar: [number, number][] = []
    const ampSoFar: [number, number][] = []

    KAPPAS.forEach((kappa, step) => {
      let m = matFor(kappa)
      //  Jacobi 预处理：D = diag(1/√a_ii)，解 (DAD)(D⁻¹x) = Db
      if (jacobi) {
        const s1 = 1 / Math.sqrt(m.a), s2 = 1 / Math.sqrt(m.d)
        m = { a: m.a * s1 * s1, b: m.b * s1 * s2, d: m.d * s2 * s2 }
      }
      const { hi, lo } = eig(m)
      const kappaEff = hi / lo

      // ── 优化那张脸：在 L = xᵀAx 上跑梯度下降（步长取该 κ 的稳定值）──
      const lr = 1 / (hi + lo)
      let x = 1, y = 1
      const L = (px: number, py: number) => m.a * px * px + 2 * m.b * px * py + m.d * py * py
      const start = L(x, y)
      const path: { x: number; y: number }[] = [{ x, y }]
      const lossCurve: number[] = [start]
      let steps = 0
      while (L(x, y) > 1e-4 * start && steps < MAX_ITERS) {
        const gx = 2 * (m.a * x + m.b * y), gy = 2 * (m.b * x + m.d * y)
        x -= lr * gx; y -= lr * gy
        steps++
        if (path.length < 120) path.push({ x: +x.toFixed(4), y: +y.toFixed(4) })
        if (lossCurve.length < 120) lossCurve.push(+L(x, y).toPrecision(4))
      }
      const rate = (kappaEff - 1) / (kappaEff + 1)

      /*  ── 数值那张脸：解 Ax=b，再扰动 b 重解，量相对误差被放大了多少 ──
          放大倍数跟扰动大小**无关**（线性系统），所以扰动幅度不做成旋钮。
          最坏方向：b 取最大特征向量、Δb 取最小特征向量 —— 这时才顶到 κ。 */
      const ang = 0.5 * Math.atan2(2 * m.b, m.a - m.d)          // 最大特征向量的方向
      const vHi = [Math.cos(ang), Math.sin(ang)]
      const vLo = [-Math.sin(ang), Math.cos(ang)]
      const bb = dirMode === '最坏方向' ? vHi : [0.6, 0.8]
      const db = (dirMode === '最坏方向' ? vLo : [0.8, -0.6]).map(v => v * 1e-3)
      const x0 = solve(m, bb), x1 = solve(m, [bb[0] + db[0], bb[1] + db[1]])
      const relB = norm(db) / norm(bb)
      const relX = norm([x1[0] - x0[0], x1[1] - x0[1]]) / norm(x0)
      const amp = relX / relB

      stepsSoFar.push([kappa, steps])
      ampSoFar.push([kappa, +amp.toPrecision(4)])

      frames.push({
        step, kappa, kappaEff: +kappaEff.toPrecision(4), precond, dirMode,
        steps, rate: +rate.toFixed(3),
        amp: +amp.toPrecision(4), ampCap: +kappaEff.toPrecision(4),
        path, lossCurve,
        stepsSoFar: stepsSoFar.slice(), ampSoFar: ampSoFar.slice(), phase: 'run',
        log: `**κ=${kappa}**${jacobi ? `（对角缩放之后实际是 **${kappaEff.toPrecision(3)}**）` : ''}：`
          + `　**优化的脸** —— 梯度下降收敛到千分之一用了 **${steps}** 步，每步误差最多缩 (κ−1)/(κ+1)=**${rate.toFixed(3)}**。`
          + `　**数值的脸** —— 给 b 加一点扰动重解，x 的相对误差被放大了 **${amp.toPrecision(3)} 倍**`
          + `（上界就是 κ=${kappaEff.toPrecision(3)}${dirMode === '最坏方向' ? '，最坏方向上顶满' : '，这个方向远够不着'}）。`
          + (kappa === 1 ? `　κ=1 是正圆碗：梯度直指谷底，解也对扰动完全不敏感。` : ``),
      })
    })

    const lf = frames[frames.length - 1]
    const worst = dirMode === '最坏方向'
    frames.push({
      ...lf, phase: 'done',
      log: `κ 从 ${KAPPAS[0]} 拉到 ${KAPPAS[KAPPAS.length - 1]}，**同一个数**在两个地方同时变坏：`
        + `　**收敛步数** ${stepsSoFar.map(([, v]) => v).join(' → ')}；`
        + `　**误差放大倍数** ${ampSoFar.map(([, v]) => (v >= 100 ? v.toFixed(0) : v.toPrecision(3))).join(' → ')}。`
        + `　这两件事看着不相干，其实是一个 κ 的两张脸：碗被拉扁，梯度就几乎垂直于通往谷底的方向（只能之字形挪）；`
        + `矩阵被拉扁，最小特征值就贴近 0，**b 上一点点误差除以它就会炸开** —— `
        + `‖Δx‖/‖x‖ ≤ κ·‖Δb‖/‖b‖ 才是条件数的定义式，梯度下降慢只是它的一个后果。`
        + (worst
          ? `　这一档取的是**最坏方向**，所以放大倍数正好顶到 κ。换成"随便一个方向"再看：通常远够不着 —— `
            + `**κ 是上界，不是每次都会发生的事**。`
          : `　这一档是随便挑的方向，放大倍数远小于 κ。换成"最坏方向"再看：那时才顶满 —— κ 描述的是**最坏情况**。`)
        + (jacobi
          ? `　⚠️ 已经开了**对角缩放**，可 κ=${KAPPAS[KAPPAS.length - 1]} 那档实际只降到 ${lf.kappaEff}。`
            + `因为这里的 A 是**旋转过的**（主轴不平行于坐标轴）：对角缩放只能修"各维尺度不一"那部分病态，`
            + `修不了"方向相关"那部分。**"归一化一下就好了"是不成立的** —— 真要修得靠更强的预处理（不完全 Cholesky、多重网格…）。`
          : `　把「预处理」拨到对角缩放看看能修回多少 —— 会发现它有用，但远不是万能。`),
    })

    const base0: Frame = {
      step: -1, kappa: 0, kappaEff: 0, precond, dirMode, steps: 0, rate: 0, amp: 0, ampCap: 0,
      path: [], lossCurve: [], stepsSoFar: [], ampSoFar: [], phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '条件数 κ' },
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
