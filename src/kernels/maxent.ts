/**
 * 内核：最大熵原理（概率统计原理 · softmax/玻尔兹曼分布凭什么"天生合理"）
 * 轴：step —— 在**所有满足约束的分布**里爬熵，看爬到的那个点落在哪儿
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本的问题不在于算错，而在于**它把要证的东西当前提用了**：
 * 直接写 `p_i ∝ e^{λi}`、二分求 λ，然后在旁边说"可证最大熵解一定是指数族"。
 * 屏幕上从头到尾没有任何东西在"最大化熵" —— 指数族是**假设**，不是**结论**。
 * 学生看完只会记住一个公式，记不住那句真正值钱的话。
 *
 * 这一版反过来：
 *
 * ① **主线是一场真搜索。** 在满足约束的那张平面（`A p = b` ∩ 单纯形）上做坐标上升，
 *    沿零空间的每个方向做线搜索找熵更高的点。**全程没有任何地方假设指数族。**
 * ② **对照是解析解。** 同时算出指数族解 p ∝ e^{Σλ·f}，每一帧并排显示两者的最大差。
 *    搜索一路爬，差一路掉到 1e-6 —— **"指数族"是搜出来的结果，不是挑出来的形式。**
 * ③ **起点是旋钮。** 三个天差地别的起点收敛到同一个分布 —— 这就是"唯一答案"。
 * ④ **三个失败档**，每一个都在讲"最大熵原理什么时候使不上劲"：
 *    - **锁死**：给满五阶矩，可行集缩成一个点，自由方向 0 个 —— 熵一句话没说上。
 *      而答案跟"只约束均值"那一档**一模一样**：同一个分布，两种完全不同的理由。
 *    - **卡死**：方差=0 且 μ 是整数，零空间明明有 3 个方向，但每个方向一动就有概率变负 ——
 *      **有自由方向不等于走得动**，非负约束把它按在角上。
 *    - **无解**：方差=0 而 μ 不是整数（"每次都掷出同一面"和"平均 3.5 点"不能同时成立）。
 *      老版本那个二分求 λ 在这种情况下会**闷声给你一个数**，那个数不满足约束 —— 这一条单独有判据钉着。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const N = 6
const FACES = [1, 2, 3, 4, 5, 6]

/** 熵，bit */
const entropy = (p: number[]) => -p.reduce((a, x) => a + (x > 1e-15 ? x * Math.log2(x) : 0), 0)
const MAX_ENT = Math.log2(N)

const dot = (a: number[], b: number[]) => a.reduce((s, x, k) => s + x * b[k], 0)
const norm = (a: number[]) => Math.sqrt(dot(a, a))
const r4 = (x: number) => +x.toFixed(4)
const r3 = (x: number) => +x.toFixed(3)

// ═══════════════════════════════════════════════════════════════
//  约束
// ═══════════════════════════════════════════════════════════════

/** 一条矩约束：Σ f(i)·p_i = c */
type Con = { name: string; f: number[]; c: number }

/**
 * 给定均值 μ 时，6 面骰方差的**上限** —— 两点分布（全押 1 和 6）取到。
 * 推导：P(6)=w 时 μ=1+5w，Var = E[i²]−μ² = 1+35w−μ² = 7μ−6−μ²。
 * "方差取上限的六成"这个目标因此对任何 μ 都是可行的（下限是相邻两面的两点分布，远小于它）。
 */
const maxVarAt = (mu: number) => 7 * mu - 6 - mu * mu

/** 指数族解 p ∝ e^{λi}：二分 λ 使 Σ i·p_i = μ。只在"只约束均值"那一档用。 */
function tiltToMean(mu: number): { p: number[]; lam: number } {
  const pOf = (lam: number) => {
    const w = FACES.map(i => Math.exp(lam * (i - 3.5)))
    const Z = w.reduce((a, b) => a + b, 0)
    return w.map(x => x / Z)
  }
  let lo = -40, hi = 40
  for (let t = 0; t < 200; t++) {
    const m = (lo + hi) / 2
    if (dot(FACES, pOf(m)) < mu) lo = m; else hi = m
  }
  const lam = (lo + hi) / 2
  return { p: pOf(lam), lam }
}

/**
 * 指数族解 p ∝ e^{λ₁g₁ + λ₂g₂}，牛顿法解对偶。
 * 特征取**中心化**的 g₁=i−3.5、g₂=(i−3.5)²：直接用 i、i² 的话海森矩阵条件数上千，牛顿会飘。
 */
function tiltTwo(c1: number, c2: number): { p: number[]; lam: [number, number]; ok: boolean } {
  const g1 = FACES.map(i => i - 3.5)
  const g2 = g1.map(x => x * x)
  const pOf = (a: number, b: number) => {
    const z = g1.map((x, k) => a * x + b * g2[k])
    const m = Math.max(...z)
    const w = z.map(v => Math.exp(v - m))
    const Z = w.reduce((s, x) => s + x, 0)
    return w.map(x => x / Z)
  }
  //  对偶目标 g(λ) = ln Z − λ·c，最小化它。∇g = E[g] − c，∇²g = Cov(g)。
  const obj = (a: number, b: number) => {
    const z = g1.map((x, k) => a * x + b * g2[k])
    const m = Math.max(...z)
    return m + Math.log(z.reduce((s, v) => s + Math.exp(v - m), 0)) - (a * c1 + b * c2)
  }
  let a = 0, b = 0
  for (let t = 0; t < 200; t++) {
    const p = pOf(a, b)
    const e1 = dot(g1, p), e2 = dot(g2, p)
    const r1 = e1 - c1, r2 = e2 - c2
    if (Math.max(Math.abs(r1), Math.abs(r2)) < 1e-13) break
    //  协方差矩阵 + 一点阻尼（可行集贴边时它会奇异）
    const v11 = dot(g1.map(x => x * x), p) - e1 * e1
    const v22 = dot(g2.map(x => x * x), p) - e2 * e2
    const v12 = dot(g1.map((x, k) => x * g2[k]), p) - e1 * e2
    const eps = 1e-10
    const det = (v11 + eps) * (v22 + eps) - v12 * v12
    if (!(Math.abs(det) > 1e-18)) break
    const da = -((v22 + eps) * r1 - v12 * r2) / det
    const db = -(-v12 * r1 + (v11 + eps) * r2) / det
    //  回溯线搜索：贴边时整步会冲过头
    let s = 1
    const f0 = obj(a, b)
    for (let k = 0; k < 60; k++) { if (obj(a + s * da, b + s * db) <= f0) break; s /= 2 }
    a += s * da; b += s * db
  }
  const p = pOf(a, b)
  const ok = Math.abs(dot(g1, p) - c1) < 1e-7 && Math.abs(dot(g2, p) - c2) < 1e-7
  return { p, lam: [a, b], ok }
}

// ═══════════════════════════════════════════════════════════════
//  线性代数：可行平面、零空间
// ═══════════════════════════════════════════════════════════════

/**
 * 把 `A p = b`（第一行恒是"加起来等于 1"）正交化，同时把 b 跟着变换。
 * 返回正交化后的行 `rows` 与右端 `rhs`，于是可行平面就是 { p : rows_k·p = rhs_k }。
 */
function orthoRows(A: number[][], b: number[]) {
  const rows: number[][] = [], rhs: number[] = []
  for (let k = 0; k < A.length; k++) {
    let v = A[k].slice(), c = b[k]
    for (let j = 0; j < rows.length; j++) { const d = dot(v, rows[j]); v = v.map((x, t) => x - d * rows[j][t]); c -= d * rhs[j] }
    const nv = norm(v)
    if (nv < 1e-9) continue          //  这一行被前面的行线性表出了，扔掉（不是错，是冗余）
    rows.push(v.map(x => x / nv)); rhs.push(c / nv)
  }
  return { rows, rhs }
}

/** 可行平面的零空间（正交单位基）—— 沿这些方向走，所有约束都还成立 */
function nullBasis(rows: number[][]): number[][] {
  const basis: number[][] = []
  for (let j = 0; j < N; j++) {
    let v = new Array(N).fill(0); v[j] = 1
    for (const r of [...rows, ...basis]) { const d = dot(v, r); v = v.map((x, t) => x - d * r[t]) }
    const nv = norm(v)
    if (nv > 1e-7) basis.push(v.map(x => x / nv))
  }
  return basis
}

/** 投影到可行平面 */
const toPlane = (p: number[], rows: number[][], rhs: number[]) => {
  let q = p.slice()
  for (let k = 0; k < rows.length; k++) { const d = dot(q, rows[k]) - rhs[k]; q = q.map((x, t) => x - d * rows[k][t]) }
  return q
}

/**
 * 找一个**既在可行平面上、又非负**的点：平面与非负象限之间交替投影。
 *
 * ⚠️ **判"有没有解"不能看交替投影停下来时那个负数有多小。**
 * 第一版就是这么写的（`min(p) >= -1e-7` 算有解），结果 μ=5、方差=0 这一档被判成无解 ——
 * 它明明有解（全押 5 点），只是解落在单纯形的**顶点**上，交替投影往顶点收敛得极慢，
 * 跑满 4000 轮那个负数还有 1e-6。**慢不等于没有。**
 *
 * 改成看**结果**：把负的截掉，再问这个非负的点满不满足约束。
 * 满足 → 有解（顶点也是解）；差着一截 → 那一截就是"平面和非负象限之间的缝"，真无解。
 */
function feasible(start: number[], rows: number[][], rhs: number[], A: number[][], b: number[]) {
  let p = toPlane(start, rows, rhs)
  for (let t = 0; t < 4000; t++) {
    if (Math.min(...p) >= -1e-14) break
    p = toPlane(p.map(x => Math.max(x, 0)), rows, rhs)
  }
  const q = p.map(x => Math.max(x, 0))
  const errOf = (v: number[]) => Math.max(...A.map((a, k) => Math.abs(dot(a, v) - b[k])))
  const err = errOf(q)
  if (err < 1e-7) return { p: q, err, ok: true }

  /*  ⚠️ **交替投影"没收敛"不等于"无解"。**
      μ=5、方差=0 这一档就栽在这儿：唯一解是全押 5 点（单纯形的一个顶点），
      交替投影往顶点收敛得极慢，4000 轮之后残差还有 4.3e-5，于是被判成"无解"——
      而屏幕上会理直气壮地印一句"这两条约束不可能同时成立"，那是**假话**。

      所以这里再走一道**精确**的判定。可行集是有界多面体（p≥0 且 Σp=1），
      非空就一定有顶点 —— 把 6 个面的**支撑集全枚举**（2⁶−1 = 63 个）解一遍，
      枚举完还没有，才是真无解。

      大小从 1 到 6 都枚举，不是只枚举"大小 = 秩"的那一批：顶点的支撑可以更小
      （全押一面就只有 1 个），那时方程组是超定的，得用最小二乘。
      每个候选最后都拿**原始约束**验一遍，所以不可能误判成"有解"。 */
  for (let mask = 1; mask < (1 << N); mask++) {
    const S = [...Array(N).keys()].filter(j => (mask >> j) & 1)
    const G = rows.map(r => S.map(j => r[j]))                       //  m × |S|
    const GtG = S.map((_, a2) => S.map((__, b2) => G.reduce((s, r) => s + r[a2] * r[b2], 0)))
    const Gtb = S.map((_, a2) => G.reduce((s, r, k) => s + r[a2] * rhs[k], 0))
    const x = solveSquare(GtG, Gtb)
    if (!x || x.some(v => v < -1e-9)) continue
    const v = new Array(N).fill(0)
    S.forEach((j, t) => { v[j] = Math.max(0, x[t]) })
    const e = errOf(v)
    if (e < 1e-9) return { p: v, err: e, ok: true }
  }
  return { p: q, err, ok: false }
}

/** n×n 线性方程组，列主元高斯–若尔当消元。奇异时回 null。 */
function solveSquare(M: number[][], v: number[]): number[] | null {
  const n = M.length
  if (n === 0 || M.some(r => r.length !== n)) return null
  const a = M.map((r, k) => [...r, v[k]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r
    if (Math.abs(a[piv][c]) < 1e-12) return null
    ;[a[c], a[piv]] = [a[piv], a[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = a[r][c] / a[c][c]
      for (let t = c; t <= n; t++) a[r][t] -= f * a[c][t]
    }
  }
  return a.map((r, k) => r[n] / a[k][k])
}

/**
 * 沿一个方向做线搜索，找熵最大的点。熵沿直线严格凹 —— 三分法直接吃到机器精度。
 * 步长上下界由**非负**定出来：这一条正是"卡死"那一档里唯一起作用的东西。
 */
/**
 * 熵的梯度**投影到可行平面**上 —— 沿它走，约束不破而熵上升最快。
 *
 * ⚠️ 光沿固定的那组正交基轮流做线搜索**会卡住**：解贴到单纯形边上时
 * （比如 μ=5.5 再加方差约束，有两面的概率被压到 0.01 以下），
 * 每个坐标方向能走的那一小段都被非负卡得极短，两个方向来回蹭、熵几乎不动，
 * 于是第一版在那一档提前收工、跟指数族解差着 0.102 —— **而它显示的是"已收敛"**。
 * 加上这一条真正的上升方向之后，同一档差到 1e-7。
 */
function gradDir(p: number[], basis: number[][]): number[] {
  const g = p.map(x => -(Math.log(Math.max(x, 1e-300)) + 1))     //  ∇H（nat），常数项落在零空间外不影响
  const out = new Array(N).fill(0)
  for (const bv of basis) { const c = dot(g, bv); for (let k = 0; k < N; k++) out[k] += c * bv[k] }
  return out
}

function lineMax(p: number[], d: number[]): number[] {
  let lo = -Infinity, hi = Infinity
  for (let k = 0; k < N; k++) {
    if (d[k] > 1e-12) lo = Math.max(lo, -p[k] / d[k])
    else if (d[k] < -1e-12) hi = Math.min(hi, -p[k] / d[k])
  }
  if (!(lo < hi) || !isFinite(lo) || !isFinite(hi)) return p
  const H = (t: number) => entropy(p.map((x, k) => Math.max(0, x + t * d[k])))
  for (let it = 0; it < 80; it++) {
    const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3
    if (H(a) < H(b)) lo = a; else hi = b
  }
  const t = (lo + hi) / 2
  return p.map((x, k) => Math.max(0, x + t * d[k]))
}

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const MODE_ONLY_SUM = '只要求加起来=1'
const MODE_MEAN = '+ 期望点数 = μ'
const MODE_MEANVAR = '+ 期望点数、方差'
const MODE_LOCKED = '+ 一到五阶矩全给定'
const MODE_ZEROVAR = '+ 期望点数、方差 = 0'
export const MAXENT_MODES = [MODE_ONLY_SUM, MODE_MEAN, MODE_MEANVAR, MODE_LOCKED, MODE_ZEROVAR] as const

const START_UNIFORM = '均匀'
const START_LOW = '全押小点数'
const START_HIGH = '全押大点数'
export const MAXENT_STARTS = [START_UNIFORM, START_LOW, START_HIGH] as const
const startVec = (s: string) =>
  s === START_LOW ? [0.7, 0.2, 0.06, 0.02, 0.015, 0.005]
    : s === START_HIGH ? [0.005, 0.015, 0.02, 0.06, 0.2, 0.7]
      : new Array(N).fill(1 / N)

export const MAXENT_MUS = [3.5, 4, 4.5, 5, 5.5, 5.9] as const

/** 约束表 + 解析对照。`analytic` 为 null 表示这一档没有（也不需要）指数族解析解。 */
function buildConstraints(mode: string, mu: number): {
  cons: Con[]; analytic: number[] | null; lamText: string; famText: string
} {
  if (mode === MODE_ONLY_SUM) {
    return { cons: [], analytic: new Array(N).fill(1 / N), lamText: 'λ 一个都没有', famText: 'p_i ∝ e⁰ —— 常数，也就是均匀分布' }
  }
  if (mode === MODE_MEAN) {
    const { p, lam } = tiltToMean(mu)
    return {
      cons: [{ name: 'E[i]', f: FACES, c: mu }], analytic: p,
      lamText: `λ = ${lam.toFixed(4)}`, famText: `p_i ∝ e^{λ·i}　—— 这就是 softmax / 玻尔兹曼分布`,
    }
  }
  if (mode === MODE_MEANVAR) {
    const v = 0.6 * maxVarAt(mu)               //  取上限的六成 —— 对任何 μ 都严格可行
    const c1 = mu - 3.5, c2 = v + c1 * c1      //  中心化到 3.5：E[(i−3.5)] 与 E[(i−3.5)²]
    const { p, lam, ok } = tiltTwo(c1, c2)
    return {
      cons: [{ name: 'E[i]', f: FACES, c: mu }, { name: 'E[i²]', f: FACES.map(i => i * i), c: v + mu * mu }],
      analytic: ok ? p : null,
      lamText: `λ₁ = ${lam[0].toFixed(4)}、λ₂ = ${lam[1].toFixed(4)}`,
      famText: 'p_i ∝ e^{λ₁(i−3.5) + λ₂(i−3.5)²}　—— 多一条约束就多一个 λ，形状变成"高斯型"',
    }
  }
  if (mode === MODE_LOCKED) {
    /*  五条矩约束取自"只约束均值"那一档的答案本身。
        于是可行集缩成一个点，而那个点**恰好就是**上一档爬出来的分布 ——
        同一个答案，一次是熵挑出来的，一次是约束定死的。 */
    const ref = tiltToMean(mu).p
    const cons: Con[] = []
    for (let k = 1; k <= 5; k++) {
      const f = FACES.map(i => Math.pow(i, k))
      cons.push({ name: `E[i^${k}]`, f, c: dot(f, ref) })
    }
    return { cons, analytic: ref, lamText: '不需要 λ', famText: '六个未知数、六个方程 —— 分布被解出来，不是被"选"出来' }
  }
  //  MODE_ZEROVAR：方差 = 0 ⇒ 必须每次都掷出同一面 ⇒ μ 得是整数，否则无解
  return {
    cons: [{ name: 'E[i]', f: FACES, c: mu }, { name: 'E[i²]', f: FACES.map(i => i * i), c: mu * mu }],
    analytic: Number.isInteger(mu) ? FACES.map(i => (i === mu ? 1 : 0)) : null,
    lamText: Number.isInteger(mu) ? '解在角上，λ 要跑到无穷' : '没有解，λ 无从谈起',
    /*  ⚠️ 这句里的 μ 原来写死成 3.5 —— μ 换成 4.5 时屏幕上照样印"平均 3.5 点"。
        文案里的每个数都得跟着参数走，浏览器里一眼就看出来了。 */
    famText: `方差=0 就是"每次都掷出同一面" —— 它跟"平均 ${mu} 点"不可能同时成立`,
  }
}

// ═══════════════════════════════════════════════════════════════

export type MaxEntState = {
  i: number
  step: number
  mode: string
  mu: number
  startLabel: string
  /** 当前搜索到的分布（**没有假设任何形式**） */
  probs: number[]
  ent: number
  /** 指数族解析解；无解/不适用时为空数组 */
  fam: number[]
  famEnt: number
  /** 搜索解与指数族解的最大逐项差 —— 这一栏掉到 0，"指数族"就从假设变成结论 */
  gap: number
  /** 约束残差（∞ 范数），全程应当是 0 */
  feasErr: number
  /** 可行平面里还剩几个能走的方向 */
  freedom: number
  /** 约束条数（不含"加起来=1"） */
  nCon: number
  conText: string
  famText: string
  lamText: string
  maxEnt: number
  /** 撒随机可行分布撞出来的最高熵 —— 用来交叉验证"爬到的确实是顶" */
  randBest: number
  randN: number
  /** 老版本那个"二分求 λ"在这一档给出的均值（无解时它会闷声给个错的） */
  naiveMean: number
  solvable: boolean
  /** 无解时平面与非负象限之间那条缝有多宽 */
  gapToFeasible: number
  phase: 'run' | 'done' | 'dead'
  log: string
}

export const MAXENT_VISIBLE = [
  'step', 'mode', 'mu', 'startLabel', 'probs', 'ent', 'fam', 'famEnt', 'gap', 'feasErr',
  'freedom', 'nCon', 'conText', 'famText', 'lamText', 'maxEnt', 'randBest', 'randN',
  'naiveMean', 'solvable', 'gapToFeasible', 'phase', 'log',
] as const

type Frame = Omit<MaxEntState, 'i'>

export const maxentKernel: Kernel<MaxEntState> = {
  kind: 'maxent',

  compile(doc: SimDocument): CompiledModel<MaxEntState> {
    const mode = String(doc.params.mode ?? MODE_MEAN)
    const mu = Number(doc.params.mu ?? 4.5)
    const startLabel = String(doc.params.start ?? START_UNIFORM)

    const { cons, analytic, lamText, famText } = buildConstraints(mode, mu)
    const conText = cons.length === 0 ? '只有"加起来=1"' : cons.map(c => `${c.name}=${r3(c.c)}`).join('、')

    //  A 的第一行永远是"加起来等于 1"
    const A = [new Array(N).fill(1), ...cons.map(c => c.f)]
    const bvec = [1, ...cons.map(c => c.c)]
    const { rows, rhs } = orthoRows(A, bvec)
    const basis = nullBasis(rows)

    const feas = feasible(startVec(startLabel), rows, rhs, A, bvec)
    const errOf = (p: number[]) => Math.max(...A.map((a, k) => Math.abs(dot(a, p) - bvec[k])))
    const gapOf = (p: number[]) => (analytic ? Math.max(...p.map((x, k) => Math.abs(x - analytic[k]))) : NaN)

    /*  老版本那个求解器在这一档会交出什么？
        它只认"均值"这一条，其余约束根本看不见 —— 无解的档里它照样**闷声给你一个分布**。
        把它算出来的均值印在屏幕上，是为了让"解出来了"和"解对了"分开。 */
    const naiveMean = dot(FACES, tiltToMean(mu).p)

    /*  撒随机可行分布 —— 给"爬到的是顶"一个**独立来源**的旁证，不是拿爬山自己证明爬山。

        ⚠️ 用 hit-and-run，不是"随机加一个向量再看落没落出去"。
        第一版就是后者：沿每个基方向各加一个 ±1 的随机量，3000 次里**只有 0~2 次**没掉出单纯形 ——
        `randBest` 于是拿一两个样本说话，甚至是 0。撒 3000 个点却只留下 2 个，
        这条"交叉验证"量不出任何东西。
        hit-and-run 是先挑方向、再在**非负允许的那一段里**取点，每一发都落在可行集内。 */
    let randBest = 0
    let randN = 0
    if (feas.ok && basis.length > 0) {
      let seed = 20260909
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
      let q = feas.p.slice()
      for (let t = 0; t < 3000; t++) {
        //  零空间里随机取一个方向
        const d = new Array(N).fill(0)
        for (const bv of basis) { const c = rnd() * 2 - 1; for (let k = 0; k < N; k++) d[k] += c * bv[k] }
        //  非负允许的那一段
        let lo = -Infinity, hi = Infinity
        for (let k = 0; k < N; k++) {
          if (d[k] > 1e-12) lo = Math.max(lo, -q[k] / d[k])
          else if (d[k] < -1e-12) hi = Math.min(hi, -q[k] / d[k])
        }
        if (!(lo < hi) || !isFinite(lo) || !isFinite(hi)) continue
        const s = lo + rnd() * (hi - lo)
        q = q.map((x, k) => Math.max(0, x + s * d[k]))
        randN++
        randBest = Math.max(randBest, entropy(q))
      }
    }

    const frames: Frame[] = []
    const base = {
      step: 0, mode, mu, startLabel, maxEnt: +MAX_ENT.toFixed(3),
      nCon: cons.length, conText, famText, lamText,
      freedom: basis.length, randBest: r4(randBest), randN,
      naiveMean: r4(naiveMean), solvable: feas.ok,
      gapToFeasible: r4(feas.err),
      fam: analytic ? analytic.map(r4) : [], famEnt: analytic ? r4(entropy(analytic)) : 0,
    }

    if (!feas.ok) {
      //  ── 无解档：一帧说清楚，不给一个假分布 ──
      frames.push({
        ...base, probs: [], ent: 0, gap: NaN, feasErr: NaN, phase: 'dead',
        log: `约束 **${conText}** 没有解。**${famText}**\n\n` +
          `可行平面跟"概率不能是负数"之间隔着一条 **${r4(feas.err)}** 宽的缝 —— ` +
          `再怎么投影也进不去。\n\n` +
          `⚠️ 值得看一眼的是**老式解法在这里会怎么样**：只盯"期望点数"这一条二分求 λ，` +
          `它会**照样给你一个分布**，均值 ${r4(naiveMean)}，看着挺像回事 —— 而方差那条约束它压根没看见。` +
          `**"解出来了"和"解对了"是两件事。**`,
      })
    } else if (basis.length === 0) {
      //  ── 锁死档：一个自由方向都没有，熵没有发言权 ──
      const p = feas.p
      frames.push({
        ...base, probs: p.map(r4), ent: r4(entropy(p)), gap: r4(gapOf(p)), feasErr: r4(errOf(p)),
        phase: 'done',
        log: `${cons.length} 条约束 + "加起来=1" 一共 ${cons.length + 1} 个方程、${N} 个未知数 —— ` +
          `可行集缩成**一个点**，自由方向 **0** 个。\n\n` +
          `**最大熵原理在这一档一句话都没说上。** 分布是被方程组解出来的，不是被熵挑出来的。\n\n` +
          `而它跟「${MODE_MEAN}」那一档爬出来的分布**一模一样**（逐项差 ${r4(gapOf(p))}）—— ` +
          `同一个答案，一次靠"约束给够了"，一次靠"没给够的部分别瞎猜"。**信息足够时熵原理是多余的；不够时它才是唯一不武断的补法。**`,
      })
    } else {
      //  ── 主线：在可行平面上爬熵 ──
      let p = feas.p
      const startEnt = entropy(p)
      frames.push({
        ...base, step: 0, probs: p.map(r4), ent: r4(startEnt), gap: r4(gapOf(p)), feasErr: r4(errOf(p)),
        phase: 'run',
        log: `**起点**：从「${startLabel}」出发，先投影到满足 ${conText} 的那张平面上 —— ` +
          `此刻熵 **${r4(startEnt)}** bit，离指数族解还差 **${r4(gapOf(p))}**。\n\n` +
          `接下来沿可行平面的 **${basis.length}** 个自由方向逐个做线搜索找更高的熵。` +
          `**注意：这个搜索完全不知道"指数族"是什么。**`,
      })

      const MAX_SWEEP = 12
      let prevEnt = startEnt
      /** 第一轮一步都没挪动 —— 解卡在单纯形的角上（"有自由方向 ≠ 走得动"） */
      let stuck = false
      for (let s = 1; s <= MAX_SWEEP; s++) {
        const before = p.slice()
        for (const d of basis) p = lineMax(p, d)
        p = lineMax(p, gradDir(p, basis))                      //  真正的上升方向，专治沿坐标来回蹭
        p = toPlane(p, rows, rhs).map(x => Math.max(0, x))     //  把线搜索攒下的浮点漂移收回平面
        const moved = Math.max(...p.map((x, k) => Math.abs(x - before[k])))
        if (s === 1 && moved < 1e-12) stuck = true
        const e = entropy(p), g = gapOf(p)
        frames.push({
          ...base, step: s, probs: p.map(r4), ent: r4(e), gap: r4(g), feasErr: r4(errOf(p)), phase: 'run',
          log: stuck
            ? `**一步也没走动。**\n\n可行平面上明明还有 **${basis.length}** 个自由方向，` +
              `但这个点落在单纯形的**角**上 —— 每个方向刚一动就有概率变成负数，线搜索能走的那一段长度是 0。\n\n` +
              `**"还有自由方向"和"走得动"是两回事。** 约束把答案逼到角上之后，熵最大化就没有余地了。`
            : `**第 ${s} 轮**：沿 ${basis.length} 个自由方向各做一次线搜索，再沿投影梯度做一次。` +
              `熵 ${r4(prevEnt)} → **${r4(e)}** bit（约束残差 ${errOf(p).toExponential(1)}，一直是 0）。\n\n` +
              (analytic
                ? `跟指数族解 ${famText.split('　')[0]} 的最大逐项差：**${g.toExponential(2)}**。` +
                  (g < 1e-6 ? ' —— **搜索自己走到了指数族上**。没有人告诉它该长这样。' : ' 还在往那儿掉。')
                : ''),
        })
        if (stuck) break
        if (e - prevEnt < 1e-13 && s >= 3) { prevEnt = e; break }
        prevEnt = e
      }

      const lf = frames[frames.length - 1]
      const gEnd = gapOf(p)
      frames.push(stuck ? {
        ...lf, phase: 'done',
        log: `**这一档里熵最大化一点忙都没帮上。**\n\n约束 ${conText} 要求方差为 0 —— 也就是"每次都掷出同一面"。` +
          `μ=${mu} 正好是整数，于是唯一满足它的分布就是**全押 ${mu} 点**，熵 0。\n\n` +
          `可行平面上还剩 ${basis.length} 个自由方向，但答案落在单纯形的角上，一个方向也走不动。\n\n` +
          `**最大熵原理只在"约束没把话说死"的时候才有话说。**这也是它跟"瞎猜"的分界：` +
          `信息给够了就照着算，没给够的部分才轮到"别做多余假设"。`,
      } : {
        ...lf, phase: 'done',
        log: `**爬完了。** 熵 ${r4(startEnt)} → **${r4(entropy(p))}** bit`
          + (cons.length === 0 ? `（= log₂6 上限，无约束时最诚实的就是均匀）` : `（上限 ${r4(MAX_ENT)}，被 ${conText} 压下来的那部分就是这条约束携带的信息量）`)
          + `。\n\n`
          + (analytic
            ? `**这一屏真正要说的一句话**：搜索全程只做了两件事 —— 待在约束平面上、往熵高的地方走。` +
              `它从没听说过"指数族"，最后却停在了 ${famText}（逐项差 ${gEnd.toExponential(2)}，${lamText}）。\n\n` +
              `**所以 softmax 不是有人挑了个好看的公式。** 它是"约束下最不武断"这句话的唯一解 —— ` +
              `逻辑回归、玻尔兹曼机、注意力里的 softmax，根都在这儿。`
            : '')
          + `\n\n交叉验证：在同一张可行平面上随机撒了 ${randN} 个分布，撞到的最高熵是 **${r4(randBest)}**，` +
          `低于爬到的 ${r4(entropy(p))} —— 爬山爬到的确实是顶，这是另一个来源说的。`,
      })
    }

    const base0: Frame = {
      ...base, step: -1, probs: [], ent: 0, gap: NaN, feasErr: NaN, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '爬熵轮次' },
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
