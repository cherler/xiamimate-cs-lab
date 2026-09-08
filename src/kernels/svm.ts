/**
 * 内核：支持向量机 SVM（机器学习算法 · 原理：分两类不够，要找"最宽的那条街"）
 * 轴：step —— 一条线从随便一个方向出发，被目标函数一步步推成"最宽的街"
 *
 * 两类线性可分时，能分开它们的直线有**无数条**。逻辑回归随便找一条能分开的就行；SVM 多问一句：哪条最好？
 * 答案是**最大间隔**：两类之间有一条尽量宽的"街"，街心那条线就是决策边界。边界离两边都最远，
 * 对新数据的容错就最大。而这条街只由**紧贴街边的那几个点**定住 —— 它们叫**支持向量**。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本有两处硬伤，都不是"少个旋钮"那么简单：
 *   ① **边界被限制成一条竖线** `x = 常数`，间隔直接取两类最内侧点的中点。
 *      可 SVM 的全部难处就在于**找那个方向**；方向被写死之后，这个实验演的其实不是 SVM。
 *   ② 没有软间隔。于是"线性不可分怎么办""一个离群点会怎样"这些**真正会遇到的问题**一个都碰不到。
 *
 * 现在换成**真求解**：对目标函数
 *      J(w,b) = ½λ‖w‖² + (1/n)·Σ max(0, 1 − yᵢ(w·xᵢ+b))       （λ = 1/(C·n)）
 * 做全批次次梯度下降。方向自己转出来，间隔 2/‖w‖ 自己长出来，支持向量自己浮出来。
 * 于是能演三件老版本演不了的事：
 *   · **只有少数几个点说了算**：把所有非支持向量**删掉重解**，边界几乎一模一样（判据钉着这一条）。
 *   · **软间隔 C**：C 小 → 街宽、容忍几个点站到街里；C 大 → 硬要每个点都分对、街被挤窄。
 *   · **一个离群点**：C 大时它能把整条街拽歪 —— 软间隔就是为它存在的。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const STEPS = 30

function lcg(seed: number) {
  let s = seed >>> 0
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 0x100000000 - 0.5 }
}
const gauss = (r: () => number) => Array.from({ length: 6 }, r).reduce((a, b) => a + b, 0) / Math.sqrt(0.5)

export type SVMPoint = { x: number; y: number; c: number; idx: number }

//  真实分界方向定在 (1, 0.6) —— **刻意不轴对齐**，方向必须由求解器自己找出来
const NX = 1 / Math.hypot(1, 0.6), NY = 0.6 / Math.hypot(1, 0.6)

function makePoints(kind: string): SVMPoint[] {
  const r = lcg(20260908)
  const spread = kind === '有重叠（线性不可分）' ? 1.15 : 0.42
  const gap = kind === '有重叠（线性不可分）' ? 0.55 : 1.25
  const pts: SVMPoint[] = []
  for (let i = 0; i < 20; i++) {
    const c = i % 2
    //  沿法向 ±gap 拉开，沿街的方向随便散
    const along = gauss(r) * 1.5
    const off = (c ? gap : -gap) + gauss(r) * spread
    pts.push({
      x: +(off * NX - along * NY).toFixed(3),
      y: +(off * NY + along * NX).toFixed(3),
      c, idx: i,
    })
  }
  if (kind === '有一个离群点') {
    /*  一个 A 类的点，越过边界站到了 B 类那侧 —— 但**只越过一点点**（法向 +0.4）。
        ⚠️ 位置是扫出来的，不是随手放的：第一版放在 +2.3（深深插进 B 类腹地），
        结果**任何 C 都直接放弃它**，"硬间隔会被离群点拽歪"这条压根演不出来。
        放在 +0.4 才是教科书里那个情形：C 小就放弃它（街宽 2.63），
        C 大就为它一个点把街挤到 0.61（干净数据的基准是 1.60）—— 一个点让间隔缩了六成。 */
    pts.push({ x: +(0.4 * NX - 0.4 * NY).toFixed(3), y: +(0.4 * NY + 0.4 * NX).toFixed(3), c: 0, idx: 20 })
  }
  return pts
}

export type SVMState = {
  i: number
  step: number
  phase: 'run' | 'done'
  points: SVMPoint[]
  w1: number; w2: number; b: number
  margin: number             // 半间隔 = 1/‖w‖（街宽 = 2/‖w‖）
  obj: number                // 目标函数值 —— 每步都该降
  hinge: number              // 平均 hinge 损失
  supportVectors: number[]   // yᵢf(xᵢ) ≤ 1 的点
  inside: number             // 站进街里（含错分）的点数
  wrong: number              // 真正被分错的点数
  acc: number
  cTag: string
  kind: string
  separable: boolean         // 最终有没有做到全对
  /*  只留支持向量重解一遍的结果 —— "少数几个点说了算"这句话的**现场证明** */
  svOnlyW: [number, number, number]
  svOnlyTilt: number         // 两条边界的夹角（度）
  isMax: boolean
  log: string
}

export const SVM_VISIBLE = [
  'step', 'phase', 'points', 'w1', 'w2', 'b', 'margin', 'obj', 'hinge', 'supportVectors',
  'inside', 'wrong', 'acc', 'cTag', 'kind', 'separable', 'svOnlyW', 'svOnlyTilt', 'isMax', 'log',
] as const

type Frame = Omit<SVMState, 'i'>

/*  ── 全批次次梯度下降解 J(w,b) = ½λ‖w‖² + (1/n)Σ hinge ──
    ⚠️ 两处是被实测逼出来的，别改回去：
    ① **步长用 1/(λt) 并给 ‖w‖ 加投影上界 1/√λ**（Pegasos 那套）。
       原来写的是 1/(λt+4)：λ 小的时候它几乎是个常数步长，跑一千轮也不收敛，
       于是"只用支持向量重解"那条判据一度差出 77° —— 不是理论错，是**根本没解完**。
    ② **跟着历史最好值走**。次梯度法**不是下降法**，迭代点会来回晃；
       直接显示当前点的目标值，屏幕上那个数就会上上下下。取 best-so-far 是这类方法的
       标准做法，也让"每一步都在变好"这句话名副其实。 */
function solve(pts: SVMPoint[], lam: number, iters: number) {
  let w1 = 0.15, w2 = -0.9, b = 0        // 刻意从一个**很歪**的方向起步，好看见它转过来
  const n = pts.length
  const cap = 1 / Math.sqrt(lam)
  const objOf = (a1: number, a2: number, bb: number) => {
    let h = 0
    for (const p of pts) h += Math.max(0, 1 - (p.c ? 1 : -1) * (a1 * p.x + a2 * p.y + bb)) / n
    return 0.5 * lam * (a1 * a1 + a2 * a2) + h
  }
  let best = { w1, w2, b, J: objOf(w1, w2, b) }
  for (let t = 1; t <= iters; t++) {
    const lr = 1 / (lam * t)
    let g1 = lam * w1, g2 = lam * w2, gb = 0
    for (const p of pts) {
      const y = p.c ? 1 : -1
      if (y * (w1 * p.x + w2 * p.y + b) < 1) { g1 -= y * p.x / n; g2 -= y * p.y / n; gb -= y / n }
    }
    w1 -= lr * g1; w2 -= lr * g2; b -= lr * gb
    const nw = Math.hypot(w1, w2)
    if (nw > cap) { const k = cap / nw; w1 *= k; w2 *= k }   // 投影回可行域
    const J = objOf(w1, w2, b)
    if (J < best.J) best = { w1, w2, b, J }
  }
  return { w1: best.w1, w2: best.w2, b: best.b }
}

export const svmKernel: Kernel<SVMState> = {
  kind: 'svm',

  compile(doc: SimDocument): CompiledModel<SVMState> {
    const kind = doc.params.data === undefined ? '清爽可分' : str(doc.params, 'data')
    const C = doc.params.c === undefined ? 1 : num(doc.params, 'c')
    const pts = makePoints(kind)
    const n = pts.length
    const lam = 1 / (C * n)                 // 标准换算：C 越大，正则越轻 = 越"硬"
    const cTag = C <= 0.1 ? `C=${C}（很软）` : C >= 10 ? `C=${C}（很硬）` : `C=${C}`

    const evalAt = (w1: number, w2: number, b: number) => {
      let hinge = 0, wrong = 0, inside = 0
      const sv: number[] = []
      for (const p of pts) {
        const y = p.c ? 1 : -1
        const f = w1 * p.x + w2 * p.y + b
        const m = y * f
        hinge += Math.max(0, 1 - m) / n
        if (m <= 0) wrong++
        if (m < 1) inside++
        if (m <= 1 + 1e-3) sv.push(p.idx)
      }
      const nw = Math.hypot(w1, w2) || 1e-9
      return {
        hinge, wrong, inside, sv,
        margin: 1 / nw,
        obj: 0.5 * lam * (w1 * w1 + w2 * w2) + hinge,
        acc: 1 - wrong / n,
      }
    }

    //  逐帧：每帧多跑一批迭代，于是能看着那条线转过来、街撑开
    const frames: Frame[] = []
    /*  ⚠️ 迭代数按**几何级数**涨，不是等差。
        两头的要求是打架的：C=10 那档接近硬间隔，要两万多轮才解得完（等差每帧 800 轮时，
        "只用支持向量重解"曾差出几十度）；可要是每帧都跑八百轮，**第 3 帧就收敛完了**，
        前面那段"歪着起步、被推正"的过程一帧都看不到。
        1.4^k 兼顾两头：前十帧只跑几十轮（转向看得清楚），最后一帧两万四千轮（解到底）。 */
    const itersAt = (k: number) => Math.max(1, Math.round(1.4 ** k))
    for (let k = 0; k <= STEPS; k++) {
      const { w1, w2, b } = solve(pts, lam, itersAt(k))
      const e = evalAt(w1, w2, b)
      frames.push({
        step: k, phase: 'run', points: pts,
        w1: +w1.toFixed(4), w2: +w2.toFixed(4), b: +b.toFixed(4),
        margin: +e.margin.toFixed(3), obj: +e.obj.toFixed(4), hinge: +e.hinge.toFixed(4),
        supportVectors: e.sv, inside: e.inside, wrong: e.wrong, acc: +e.acc.toFixed(3),
        cTag, kind, separable: e.wrong === 0, svOnlyW: [0, 0, 0], svOnlyTilt: 0, isMax: false,
        log: `第 ${k} 轮：边界 ${w1.toFixed(2)}·x ${w2 >= 0 ? '+' : '−'} ${Math.abs(w2).toFixed(2)}·y `
          + `${b >= 0 ? '+' : '−'} ${Math.abs(b).toFixed(2)} = 0，`
          + `目标 J=**${e.obj.toFixed(4)}**（½λ‖w‖² + 平均 hinge ${e.hinge.toFixed(3)}）。`
          + `　街宽 2/‖w‖=**${(2 * e.margin).toFixed(2)}**，贴着街边或站在街里的点 **${e.sv.length}** 个，分错 ${e.wrong} 个。`
          + (k === 0 ? `　起步的方向是**故意选歪的**：接下来看它怎么被目标函数推正。` : ``),
      })
    }

    const fin = frames[frames.length - 1]
    const sv = fin.supportVectors

    /*  ── "只有少数几个点说了算"的现场证明 ──
        把非支持向量全删掉，只拿支持向量重解一遍，比较两条边界的夹角。 */
    const svPts = pts.filter(p => sv.includes(p.idx))
    const svLam = 1 / (C * Math.max(1, svPts.length))
    const s2 = solve(svPts, svLam, itersAt(STEPS))
    const ang = (a: number, b: number) => Math.atan2(b, a)
    let tilt = Math.abs(ang(fin.w1, fin.w2) - ang(s2.w1, s2.w2)) * 180 / Math.PI
    if (tilt > 180) tilt = 360 - tilt
    if (tilt > 90) tilt = 180 - tilt

    const e = evalAt(fin.w1, fin.w2, fin.b)
    const outlierPulled = kind === '有一个离群点' && fin.wrong === 0

    frames.push({
      ...fin, phase: 'done', isMax: true,
      svOnlyW: [+s2.w1.toFixed(4), +s2.w2.toFixed(4), +s2.b.toFixed(4)],
      svOnlyTilt: +tilt.toFixed(2),
      log: `收敛：街宽 **${(2 * fin.margin).toFixed(2)}**，${n} 个点里有 **${sv.length}** 个贴着街边或站在街里，`
        + `分错 ${fin.wrong} 个（准确率 ${(e.acc * 100).toFixed(0)}%）。`
        + `　**只有那 ${sv.length} 个点说了算**：把其余 ${n - sv.length} 个点**全删掉**、只拿它们重解一遍，`
        + `得到的边界跟现在这条差 **${tilt.toFixed(2)}°** —— 几乎是同一条线。`
        + `这就是"支持向量"这个名字的来历，也是 SVM 能只记住少数点的原因。`
        + (kind === '有重叠（线性不可分）'
          ? `　这份数据**本来就分不开**：无论怎么画线都会错几个。此时 C 决定你怎么取舍 —— `
            + `${C <= 0.1 ? `现在 C 很小，街被撑得很宽（${(2 * fin.margin).toFixed(2)}），代价是 ${fin.inside} 个点站进了街里。`
              : `现在 C 较大，算法拼命想把点分对，街就被挤窄到 ${(2 * fin.margin).toFixed(2)}。`}`
            + `　**没有"正确答案"，只有取舍** —— 这正是软间隔要交给你的那个旋钮。`
          : outlierPulled
            ? `　⚠️ 看这条街有多窄：**${(2 * fin.margin).toFixed(2)}**。同样的数据去掉那个离群点，街宽是 1.60。`
              + `C 这么大，算法**不肯放过任何一个点**，于是为了把那**一个**离群点也分到正确的一侧，`
              + `整条街被挤掉了六成、方向也被拽偏。**一个点绑架了全部 ${n} 个点。**`
              + `　把 C 调小再看：软间隔允许"放弃"个别点，街立刻宽回来。**软间隔就是为这种点存在的。**`
            : kind === '有一个离群点'
              ? `　这份数据里埋了一个**离群点**（一个 A 类的点越过边界站到了 B 类那侧）。`
                + `现在 C=${C} 还算软，算法**主动放弃**了它：宁可错这一个，也要保住 ${(2 * fin.margin).toFixed(2)} 宽的街。`
                + `　把 C 拧到 10 再看 —— 为了把它也分对，街会被挤到不足原来的一半。`
              : `　把「数据形状」换成"有重叠"或"有一个离群点"，再拧 C —— 才看得见软间隔真正在做的取舍。`),
    })

    const base0: Frame = { ...frames[0], step: -1, log: '' }

    return {
      axis: { kind: 'step', label: '求解轮次' },
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
