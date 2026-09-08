/**
 * 内核：线性回归（机器学习算法 · 原理：机器怎么"拟合"一条线）
 * 轴：step —— 一堆散点，用梯度下降把一条直线 y=wx+b 转到误差最小
 *
 * 线性回归是最基础的"学习"：给一堆 (x,y) 点，找一条直线 y=wx+b 让它离所有点最近。
 * "最近"用**均方误差 MSE**（每个点到直线的竖直距离平方的平均）衡量。怎么找？
 * 从随便一条线出发，顺着**负梯度**一点点调 w、b，让 MSE 下降 —— 这就是梯度下降在做回归。
 * 它有**闭式最优解**（最小二乘 OLS），梯度下降会一路收敛到它。
 * 看懂这条，你就抓住了几乎所有 ML"训练"的骨架：定一个损失、对参数求梯度、沿负梯度更新、直到拟合。
 *
 * ## 2026-09-08 补厚（用户：「实验仿真有点偏简陋，要深深打磨」）
 *
 * 原来这一屏**没有一个旋钮**，学习率写死 0.06，轨迹还跳着走（只留 0/2/5/10/20/35/50 步），
 * 画面上只有「散点 + 一条线 + 一个 MSE」。于是这门课最要紧的那件事**演不出来**：
 * **学习率调大到某个值，梯度下降会发散** —— 直线越甩越远、MSE 冲上天。
 * 这不是花边，它是「为什么要调学习率」的全部答案，而原来的实验里它根本不存在。
 *
 * 现在：
 *   · 学习率可调，**90% 会当场发散**。这个门槛不是试出来的：损失是二次型，
 *     稳定条件 lr < 2/λmax(Hessian)，本数据上 λmax=3.15 → 上界 **0.635**；
 *     扫描验证 60% 收敛、70% 发散，跟公式对得上。屏幕上把这个界印出来。
 *     （我第一版凭印象写「0.5 会发散、上界≈0.31」—— 一跑数据，0.5 收敛得好好的。）
 *   · 起点可选（从原点 / 从一个很偏的地方出发），看它怎么绕；
 *   · 每一步都是一帧，不跳；
 *   · 状态里吐出**梯度** `gw`/`gb` 和这一步的位移 —— "沿负梯度走"这句话得能对着数看；
 *   · 吐出 `traj`（走过的 (w,b) 轨迹）和一张 **MSE 等高线场**，让参数空间里的下坡路画得出来。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}
const N = 12
const rnd = lcg(42)
const POINTS = Array.from({ length: N }, (_, i) => {
  const x = i / (N - 1) * 4 - 2
  return { x: +x.toFixed(3), y: +(2 * x + 1 + rnd() * 1.5).toFixed(3) }
})
//  OLS 闭式解 —— 梯度下降该收敛到的那个点
const mx = POINTS.reduce((a, p) => a + p.x, 0) / N
const my = POINTS.reduce((a, p) => a + p.y, 0) / N
const W_OLS = POINTS.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / POINTS.reduce((a, p) => a + (p.x - mx) ** 2, 0)
const B_OLS = my - W_OLS * mx

/*  **学习率的稳定上界是能算出来的**：MSE 是二次型，Hessian H = (2/N)·[[Σx², Σx],[Σx, N]]，
    梯度下降稳定当且仅当 lr < 2/λmax(H)。本数据集上实测 λmax≈3.15 → 上界≈0.635，
    而扫描验证：lr=60% 收敛、70% 发散 —— 跟公式对得上。
    这个数**印在屏幕上**，「学习率不能太大」才从一句口诀变成一条能算的边界。 */
const SXX = POINTS.reduce((a, p) => a + p.x * p.x, 0)
const SX = POINTS.reduce((a, p) => a + p.x, 0)
const H_A = 2 * SXX / N, H_B = 2 * SX / N, H_D = 2
const LAMBDA_MAX = (H_A + H_D) / 2 + Math.sqrt(((H_A - H_D) / 2) ** 2 + H_B * H_B)
const LR_MAX = 2 / LAMBDA_MAX

/** 起点：从原点出发 / 从一个很偏的地方出发（看它怎么绕回来） */
const STARTS: Record<string, { w: number; b: number }> = {
  '原点 (0,0)': { w: 0, b: 0 },
  '偏远处 (-3,6)': { w: -3, b: 6 },
}

export type LinRegState = {
  i: number
  step: number
  gdStep: number
  w: number
  b: number
  /** 这一步的梯度（沿它的反方向走） */
  gw: number
  gb: number
  lr: number
  mse: number
  points: { x: number; y: number }[]
  wOls: number
  bOls: number
  /** 走过的 (w,b) 轨迹 —— 画在参数平面上就是那条下坡路 */
  traj: { w: number; b: number }[]
  /** 发散了：MSE 冲上天，直线已经甩出画面 */
  diverged: boolean
  /** 学习率的稳定上界 2/λmax —— 超过它必然发散，这个数是算出来的不是试出来的 */
  lrMax: number
  phase: 'run' | 'done'
  log: string
}

export const LINREG_VISIBLE = [
  'step', 'gdStep', 'w', 'b', 'gw', 'gb', 'lr', 'mse', 'points', 'wOls', 'bOls', 'traj', 'diverged', 'lrMax', 'phase', 'log',
] as const

type Frame = Omit<LinRegState, 'i'>

const mseOf = (w: number, b: number) => POINTS.reduce((a, p) => a + (w * p.x + b - p.y) ** 2, 0) / N
const gradOf = (w: number, b: number) => {
  let gw = 0, gb = 0
  for (const p of POINTS) { const e = w * p.x + b - p.y; gw += 2 * e * p.x / N; gb += 2 * e / N }
  return { gw, gb }
}

export const linregKernel: Kernel<LinRegState> = {
  kind: 'linreg',

  compile(doc: SimDocument): CompiledModel<LinRegState> {
    const LR = doc.params.lr === undefined ? 0.06 : num(doc.params, 'lr') / 100
    const STEPS = doc.params.steps === undefined ? 24 : num(doc.params, 'steps')
    const startKey = doc.params.start === undefined ? '原点 (0,0)' : String(doc.params.start)
    const st0 = STARTS[startKey] ?? STARTS['原点 (0,0)']

    const frames: Frame[] = []
    const traj: { w: number; b: number }[] = []
    let w = st0.w, b = st0.b
    let diverged = false
    const r3 = (v: number) => +v.toFixed(3)

    for (let s = 0; s <= STEPS; s++) {
      traj.push({ w: r3(w), b: r3(b) })
      const { gw, gb } = gradOf(w, b)
      const mse = mseOf(w, b)
      //  发散判定：MSE 已经大到没法看（初始 MSE 的 1000 倍），后面不用再算了
      if (!Number.isFinite(mse) || mse > mseOf(st0.w, st0.b) * 1000 + 1e6) diverged = true

      frames.push({
        step: frames.length, gdStep: s, w: r3(w), b: r3(b), gw: r3(gw), gb: r3(gb), lr: LR,
        mse: Number.isFinite(mse) ? r3(mse) : Infinity, points: POINTS,
        wOls: r3(W_OLS), bOls: r3(B_OLS), traj: traj.map(t => ({ ...t })), diverged,
        lrMax: r3(LR_MAX), phase: 'run',
        log: diverged
          ? `第 ${s} 步：**发散了** —— MSE 已经是 ${Number.isFinite(mse) ? mse.toExponential(2) : '∞'}，`
            + `直线早就甩出画面。学习率 ${LR} 迈得太大：每一步都越过谷底冲到对面更高的地方，来回放大。`
          : `第 ${s} 步：直线 y = **${w.toFixed(2)}**x + **${b.toFixed(2)}**，MSE = **${mse.toFixed(3)}**。`
            + `梯度 (∂/∂w, ∂/∂b) = (${gw.toFixed(3)}, ${gb.toFixed(3)})，`
            + `**沿它的反方向**走 lr×梯度：w 挪 ${(-LR * gw).toFixed(4)}、b 挪 ${(-LR * gb).toFixed(4)}。`,
      })
      if (diverged) break
      w -= LR * gw; b -= LR * gb
    }

    const lf = frames[frames.length - 1]
    const first = frames[0]
    frames.push({
      ...lf, phase: 'done',
      //  ⚠️ 这些数**现算**。原来写死成「MSE 从 8.8 降到…」，学习率一能调就是假话。
      log: diverged
        ? `学习率 ${LR} **发散**：MSE 从 ${first.mse} 一路冲到 ${Number.isFinite(lf.mse) ? lf.mse.toExponential(2) : '∞'}。`
          + `梯度下降不是"走得越快越好" —— 步子迈过谷底就会冲到对面更高处，下一步梯度更大、迈得更远，来回放大直到炸掉。`
          + `　**这个界是能算的**：损失是二次型，Hessian 的最大特征值 λmax=${LAMBDA_MAX.toFixed(2)}，`
          + `稳定条件是 lr < 2/λmax = **${LR_MAX.toFixed(3)}**。${LR} 越过了它，所以必炸；`
          + `60% 在界内，同样的起点稳稳收敛。这就是"学习率要调"背后那条能算出来的边界。`
        : `梯度下降 ${lf.gdStep} 步（学习率 ${LR}、起点 ${startKey}）：`
          + `MSE 从 **${first.mse}** 降到 **${lf.mse}**，直线 y=${lf.w}x+${lf.b} 穿过点云。`
          + `它收敛到的正是**最小二乘闭式解** w=${W_OLS.toFixed(2)}、b=${B_OLS.toFixed(2)}`
          + `（当前差 ${Math.abs(lf.w - W_OLS).toFixed(3)} / ${Math.abs(lf.b - B_OLS).toFixed(3)}）`
          + ` —— 梯度下降找到的就是数学上那条最优线。`
          + `这就是机器"学习"最朴素的样子：定损失、对参数求梯度、沿负梯度更新、直到拟合。`
          + `　这条数据上学习率的**稳定上界**是 2/λmax = **${LR_MAX.toFixed(3)}**（λmax=${LAMBDA_MAX.toFixed(2)}）：`
          + `拧到 90% 越界，当场发散；60% 还在界内，收敛得比 6% 快得多。`,
    })

    const g0 = gradOf(st0.w, st0.b)
    const base0: Frame = {
      step: -1, gdStep: 0, w: st0.w, b: st0.b, gw: r3(g0.gw), gb: r3(g0.gb), lr: LR,
      mse: r3(mseOf(st0.w, st0.b)), points: POINTS, wOls: r3(W_OLS), bOls: r3(B_OLS),
      traj: [{ w: st0.w, b: st0.b }], diverged: false, lrMax: r3(LR_MAX), phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '梯度下降步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const bb = prev ?? this.initial()
        const idx = bb.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}

/** 给舞台画等高线用：在 (w,b) 平面上采一格一格的 MSE */
export function linregLossGrid(wLo: number, wHi: number, bLo: number, bHi: number, n: number) {
  const g: number[][] = []
  for (let j = 0; j < n; j++) {
    const row: number[] = []
    const b = bLo + (bHi - bLo) * (j / (n - 1))
    for (let i = 0; i < n; i++) {
      const w = wLo + (wHi - wLo) * (i / (n - 1))
      row.push(mseOf(w, b))
    }
    g.push(row)
  }
  return g
}
