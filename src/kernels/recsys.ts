/**
 * 内核：推荐系统 · 矩阵分解（机器学习算法 · 评分 ≈ 用户隐向量 · 物品隐向量）
 * 轴：step —— 交替最小二乘（ALS）真训练，每一轮先更新所有用户向量、再更新所有物品向量
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本**隐向量是手写在代码里的**：
 *   USERS = [{ n: '小明', v: [1, 0] }, …]   MOVIES = [{ n: '复仇者', v: [5, 0] }, …]
 * 然后一路算内积。可矩阵分解的**全部内容就是"这些向量是从已知评分里学出来的"** ——
 * 学习这一步整个没有发生，屏幕上演的是"给定两个向量做乘法"。
 *
 * 而且那套标注本身是**误导**的：把两维说成"爱动作 / 爱文艺"。真学出来的隐向量
 * **没有这种含义** —— 它们只在内积的意义下确定，随便乘一个可逆矩阵、再给另一边
 * 乘它的逆，预测**一个数都不变**。这一版把这件事直接量出来。
 *
 * 这一版的三件事：
 * ① **真学**：ALS 从已知评分学 P、Q，轴上走的是训练轮次，训练/留出 RMSE 一路变。
 * ② **隐向量不可解释**：训练完随机取一个可逆矩阵旋转 P、逆旋转 Q，
 *    两个矩阵长得完全不一样，而**所有预测逐格相等**。"第一维是爱动作"这种话讲不得。
 * ③ **三个会垮的地方**：
 *    - **冷启动**：一个新用户一条评分都没有 → 他的隐向量没有任何约束，
 *      正则把它压成 0，预测全是 0。这是推荐系统第一号现实问题，**加维度、加轮次都救不了**。
 *    - **隐维度太大**：k 一大，训练 RMSE 掉到 0 而留出 RMSE 反弹 —— 又是"训练误差 0 是个陷阱"。
 *    - **正则 λ 是解药**，但调过头会欠拟合。三个 λ 摆在一起才看得出那条 U 形。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r3 = (x: number) => +x.toFixed(3)
const r2 = (x: number) => +x.toFixed(2)

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const S_NORMAL = '正常（每人都打过分）'
const S_COLD = '有冷启动用户（一条评分都没有）'
const S_SPARSE = '非常稀疏（只有三成打过分）'
export const RS_SCENES = [S_NORMAL, S_COLD, S_SPARSE] as const

export const RS_DIMS = [1, 2, 5, 10] as const
export const RS_LAMBDAS = [0, 0.05, 0.5] as const

const USERS = ['小明', '小红', '阿强', '大伟', '小雨', '老陈', '阿珍', '阿杰', '小柯', '大凯', '小婷', '阿福', '小敏', '老周', '新来的']
const MOVIES = ['复仇者', '小森林', '盗梦空间', '教父', '曼彻斯特', '疾速追杀', '让子弹飞', '海街日记', '星际穿越', '楚门的世界', '寄生虫', '爱在黎明']
const NU = USERS.length, NM = MOVIES.length

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}
/** 标准正态（Box–Muller），造隐因子用 */
function gauss(r: () => number) {
  const u = Math.max(1e-12, r())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}

/** 全局基准分。**真模型 = 这个常数 + 一个秩 2 的项**，所以学习时要先把它减掉。 */
const MU = 3.2

/**
 * 造一张评分表。真模型是 `MU + p·q + 噪声`，p、q 都是 2 维 ——
 * 于是"k 取多少才够"有一个客观答案（2），k 更大就是在拟合噪声。
 *
 * ⚠️ **常数项必须单独拿出来。** 第一版把 MU 揉进了矩阵里，于是"秩 2"这个说法不成立
 * （常数 + 秩2 = 秩3），而且 ALS 要用隐向量的内积去表示一个 3.2 的底 ——
 * 学出来的向量全在为这件事服务，剩不下多少容量给真正的偏好。
 * 实测留出 RMSE 一度是 **2.3**，而评分总共才 1~5 分：**那不叫学得不好，那叫没学**。
 */
function makeRatings() {
  const r = rng(20260909)
  const pTrue = Array.from({ length: NU }, () => [gauss(r) * 0.62, gauss(r) * 0.62])
  /*  ⚠️ 最后一位（"新来的"，冷启动那一档里一条训练评分都没有）口味要**鲜明**。
      第一版没管，他的真实评分恰好都贴着基准分 3.2 —— 于是"隐向量被压成 0、只会猜基准分"
      这个失败反而给出了 **0.126** 的漂亮 RMSE，比全表还好。**演失败要挑演得出来的样本。** */
  pTrue[NU - 1] = [1.35, -1.15]
  const qTrue = Array.from({ length: NM }, () => [gauss(r) * 0.62, gauss(r) * 0.62])
  const full: number[][] = pTrue.map(p => qTrue.map(q => {
    const v = MU + p[0] * q[0] + p[1] * q[1] + gauss(r) * 0.14
    return r2(Math.min(5, Math.max(1, v)))
  }))
  return full
}

type Cell = { u: number; m: number; r: number }

/**
 * 把评分表按场景拆成 训练 / 留出 / 完全没打分 三部分。
 *
 * ⚠️ **「正常」那一档必须保证每个用户都有训练评分。** 第一版按概率独立采样，
 * 结果「正常」档里也随机冒出了一个零评分用户 —— 于是"冷启动"那一档跟对照档
 * 得到的是同一个毛病，参数根本没在起作用。这里显式保底 3 条。
 */
function split(full: number[][], scene: string) {
  const r = rng(771003)
  const train: Cell[] = [], test: Cell[] = []
  const density = scene === S_SPARSE ? 0.32 : 0.6
  for (let u = 0; u < NU; u++) {
    //  冷启动那一档：最后一个用户（"新来的"）**一条训练评分都不给**，
    //  但留出集里有他的评分 —— "预测得准不准"这个问题对他仍然成立，只是答不上来。
    const cold = scene === S_COLD && u === NU - 1
    const mine: Cell[] = []
    for (let m = 0; m < NM; m++) {
      if (r() > density) continue
      mine.push({ u, m, r: full[u][m] })
    }
    if (cold) { test.push(...mine); continue }
    /*  ⚠️ 保底只补"这个用户一条训练评分都没有"这一种情况，**不能按名额硬塞**。
        第一版给每人硬留 2~3 条训练评分，稀疏档每人本来才 3 条多，于是留出集只剩 **6 格** ——
        一个 6 格的留出集算出来的 RMSE 说明不了任何事，而它正是这一档的全部结论所在。 */
    const mineTrain: Cell[] = [], mineTest: Cell[] = []
    for (const c of mine) (r() < 0.75 ? mineTrain : mineTest).push(c)
    if (mineTrain.length === 0 && mineTest.length > 0) mineTrain.push(mineTest.shift()!)
    train.push(...mineTrain); test.push(...mineTest)
  }
  return { train, test }
}

// ═══════════════════════════════════════════════════════════════
//  ALS
// ═══════════════════════════════════════════════════════════════

/** k×k 线性方程组，列主元高斯–若尔当。奇异时回 null。 */
function solveSquare(M: number[][], v: number[]): number[] | null {
  const n = M.length
  const a = M.map((row, k) => [...row, v[k]])
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
  return a.map((row, k) => row[n] / a[k][k])
}

/**
 * 一侧的最小二乘更新：p_u = (Σ q q^T + λ·|I_u|·I)^{-1} Σ q·r
 *
 * ⚠️ 恒加一个 1e-9 的岭。λ=0 且某个用户的评分条数少于 k 时，那个矩阵是**奇异的** ——
 * 没有这一项时 `solveSquare` 回 null，这一侧就"这一轮不更新"，看起来像收敛了。
 * 加了岭它仍然会解出一个（几乎不受约束的）向量，**那个向量有多离谱要让人看见**，
 * 而不是被一个静默的 null 藏起来。
 */
function leastSquares(rows: { v: number[]; r: number }[], k: number, lam: number): number[] {
  const A = Array.from({ length: k }, () => new Array(k).fill(0))
  const b = new Array(k).fill(0)
  for (const { v, r } of rows) {
    for (let a2 = 0; a2 < k; a2++) {
      b[a2] += v[a2] * r
      for (let b2 = 0; b2 < k; b2++) A[a2][b2] += v[a2] * v[b2]
    }
  }
  for (let a2 = 0; a2 < k; a2++) A[a2][a2] += lam * Math.max(1, rows.length) + 1e-9
  return solveSquare(A, b) ?? new Array(k).fill(0)
}

/** 预测 = 基准分 + 两个隐向量的内积 */
const predict1 = (P: number[][], Q: number[][], u: number, m: number) =>
  MU + P[u].reduce((a, x, t) => a + x * Q[m][t], 0)

const rmse = (cells: Cell[], P: number[][], Q: number[][]) => {
  if (!cells.length) return 0
  let s = 0
  for (const c of cells) s += (predict1(P, Q, c.u, c.m) - c.r) ** 2
  return r3(Math.sqrt(s / cells.length))
}

/** 对照：什么都不学，一律猜基准分。**模型至少得赢过它**，否则这一档白学。 */
const baselineRmse = (cells: Cell[]) =>
  cells.length ? r3(Math.sqrt(cells.reduce((a, c) => a + (MU - c.r) ** 2, 0) / cells.length)) : 0

// ═══════════════════════════════════════════════════════════════

export type RecSysState = {
  i: number
  step: number
  users: string[]
  movies: string[]
  /** 完整的真实评分表（只用来对照，模型看不到留出格和空格） */
  full: number[][]
  /** 每一格的身份：'train' | 'test' | 'none' */
  role: string[][]
  /** 当前模型对每一格的预测 */
  pred: number[][]
  P: number[][]
  Q: number[][]
  round: number
  trainRmse: number
  testRmse: number
  /** 每一轮的两个 RMSE —— 训练那条一路降，留出那条才说明问题 */
  curve: { round: number; train: number; test: number }[]
  /** 冷启动用户（一条训练评分都没有）的下标，没有就是 -1 */
  coldUser: number
  /** 冷启动用户的隐向量范数 —— 正则会把它压成 0 */
  coldNorm: number
  /** 冷启动用户在留出集上的 RMSE */
  coldRmse: number
  /** 旋转 P、逆旋转 Q 之后，所有预测的最大逐格变化（应当是 0） */
  rotGap: number
  /** 旋转之后 P 自己变了多少 —— 跟上一条并排看：向量全变了，预测一个不变 */
  rotPGap: number
  nTrain: number
  nTest: number
  /** 对照：什么都不学、一律猜基准分，在留出集上的 RMSE。模型至少得赢过它 */
  baseRmse: number
  /** 预测值的量程。评分只有 1~5 分 —— 飞出去多少，比 RMSE 更直观 */
  predMin: number
  predMax: number
  scene: string
  dim: number
  lambda: number
  /** 固定当前 λ、只换 k：训练/留出 RMSE 随隐维度怎么变 */
  dimSweep: { k: number; train: number; test: number }[]
  /** k × λ 的二维网格 —— 两个旋钮是一对，只扫一个会挑错 */
  grid: { k: number; lam: number; train: number; test: number }[]
  /** 全网格里留出 RMSE 最低的那一格 */
  bestK: number
  bestLam: number
  /** 只固定当前 λ 时挑出来的 k */
  bestKAtLam: number
  phase: 'run' | 'done'
  log: string
}

export const RECSYS_VISIBLE = [
  'step', 'users', 'movies', 'full', 'role', 'pred', 'P', 'Q', 'round',
  'trainRmse', 'testRmse', 'curve', 'coldUser', 'coldNorm', 'coldRmse',
  'rotGap', 'rotPGap', 'nTrain', 'nTest', 'baseRmse', 'predMin', 'predMax', 'scene', 'dim', 'lambda',
  'dimSweep', 'grid', 'bestK', 'bestLam', 'bestKAtLam', 'phase', 'log',
] as const

type Frame = Omit<RecSysState, 'i'>

export const recsysKernel: Kernel<RecSysState> = {
  kind: 'recsys',

  compile(doc: SimDocument): CompiledModel<RecSysState> {
    const scene = String(doc.params.scene ?? S_NORMAL)
    const dim = Number(doc.params.dim ?? 2)
    const lambda = Number(doc.params.lambda ?? 0.05)

    const full = makeRatings()
    const { train, test } = split(full, scene)

    const role: string[][] = Array.from({ length: NU }, () => new Array(NM).fill('none'))
    for (const c of train) role[c.u][c.m] = 'train'
    for (const c of test) role[c.u][c.m] = 'test'

    const byUser = (cells: Cell[]) => { const m = new Map<number, Cell[]>(); for (const c of cells) { const g = m.get(c.u) ?? []; g.push(c); m.set(c.u, g) } return m }
    const byMovie = (cells: Cell[]) => { const m = new Map<number, Cell[]>(); for (const c of cells) { const g = m.get(c.m) ?? []; g.push(c); m.set(c.m, g) } return m }
    const tu = byUser(train), tm = byMovie(train)

    //  一条训练评分都没有的用户 —— 冷启动
    const coldUser = [...Array(NU).keys()].find(u => !(tu.get(u)?.length)) ?? -1

    /** 跑 `rounds` 轮 ALS，返回 P、Q 和每轮的两个 RMSE */
    function als(k: number, lam: number, rounds: number) {
      const r = rng(424242 + k)
      /*  ⚠️ 初始化必须**零均值**。第一版写的是 `r()*0.2 + 0.1` —— 全是同号的小数，
          各维几乎平行，ALS 在 k=2 上破不掉这个对称、收敛到一个坏的局部解
          （留出 RMSE 1.05，比什么都不学的 0.52 还差，而 k=5 是 0.33）。
          真模型明明是秩 2 的，"k=2 最好"这句话因此量不出来 —— 病在初始化，不在模型。 */
      let P = Array.from({ length: NU }, () => Array.from({ length: k }, () => gauss(r) * 0.3))
      let Q = Array.from({ length: NM }, () => Array.from({ length: k }, () => gauss(r) * 0.3))
      const curve: { round: number; train: number; test: number }[] = []
      const snaps: { P: number[][]; Q: number[][] }[] = []
      /*  ⚠️ 学的是**减掉基准分之后的残差** `r − μ`，预测时再加回来。
          直接拿原始评分去学，隐向量会被"表示 3.2 这个底"占满。 */
      for (let it = 1; it <= rounds; it++) {
        P = P.map((_, u) => leastSquares((tu.get(u) ?? []).map(c => ({ v: Q[c.m], r: c.r - MU })), k, lam))
        Q = Q.map((_, m) => leastSquares((tm.get(m) ?? []).map(c => ({ v: P[c.u], r: c.r - MU })), k, lam))
        curve.push({ round: it, train: rmse(train, P, Q), test: rmse(test, P, Q) })
        snaps.push({ P: P.map(x => x.slice()), Q: Q.map(x => x.slice()) })
      }
      return { P, Q, curve, snaps }
    }

    const ROUNDS = 12
    const { P, Q, curve, snaps } = als(dim, lambda, ROUNDS)
    const trainRmse = curve[curve.length - 1].train
    const testRmse = curve[curve.length - 1].test

    /*  ⭐ **隐向量不可解释**：取一个随机可逆矩阵 R，把 P 换成 P·R、Q 换成 Q·(R^{-1})^T。
        预测 P·Qᵀ 一个数都不变，而 P 自己面目全非。
        "第一维是爱动作、第二维是爱文艺"这种话讲不得 —— 那两维根本不是定下来的东西。 */
    let rotGap = 0, rotPGap = 0
    {
      const r = rng(31337)
      let R: number[][] | null = null
      for (let tryN = 0; tryN < 20 && !R; tryN++) {
        const cand = Array.from({ length: dim }, () => Array.from({ length: dim }, () => r() * 2 - 1))
        //  用解方程求逆：能解出来就说明它可逆
        const inv: number[][] = []
        let ok = true
        for (let c = 0; c < dim; c++) {
          const e = new Array(dim).fill(0); e[c] = 1
          const col = solveSquare(cand.map(row => row.slice()), e)
          if (!col) { ok = false; break }
          inv.push(col)
        }
        if (!ok) continue
        //  inv 现在是按列存的 R^{-1}；P' = P·R，Q' = Q·(R^{-1})^T ⇒ P'·Q'^T = P·R·R^{-1}·Q^T = P·Q^T
        const P2 = P.map(p => Array.from({ length: dim }, (_, j) => p.reduce((a, x, t) => a + x * cand[t][j], 0)))
        const Q2 = Q.map(q => Array.from({ length: dim }, (_, j) => q.reduce((a, x, t) => a + x * inv[t][j], 0)))
        for (let u = 0; u < NU; u++) for (let m = 0; m < NM; m++) {
          const a = P[u].reduce((s, x, t) => s + x * Q[m][t], 0)
          const b = P2[u].reduce((s, x, t) => s + x * Q2[m][t], 0)
          rotGap = Math.max(rotGap, Math.abs(a - b))
        }
        for (let u = 0; u < NU; u++) for (let t = 0; t < dim; t++) rotPGap = Math.max(rotPGap, Math.abs(P[u][t] - P2[u][t]))
        R = cand
      }
    }

    /*  ⭐ **k × λ 的二维网格**（各自重训，只算 RMSE、不出帧）。
        只扫 k 是不够的：真模型明明是秩 2 的，而固定 λ=0.05 扫出来的最佳 k 是 5 ——
        这个结论**单独看没法解释**，会逼着人去编一句话。摆成网格就清楚了：
        λ 大的时候 k=2 最好，λ 小的时候得靠更大的 k 才不至于飞掉，
        **两个旋钮是一对，必须一起挑**；而"真秩是 2"这件事在真实场景里你根本不知道。 */
    const grid = RS_LAMBDAS.flatMap(lam => RS_DIMS.map(k => {
      const c = als(k, lam, ROUNDS).curve
      return { k, lam, train: c[c.length - 1].train, test: c[c.length - 1].test }
    }))
    const bestCell = grid.reduce((a, b) => (b.test < a.test ? b : a), grid[0])
    const bestK = bestCell.k, bestLam = bestCell.lam
    //  固定当前 λ 时的那一行，屏幕上单列一行给人看"只调 k 会怎样"
    const dimSweep = grid.filter(g => g.lam === lambda).map(({ k, train, test }) => ({ k, train, test }))
    const bestKAtLam = dimSweep.reduce((a, b) => (b.test < a.test ? b : a), dimSweep[0]).k

    const predOf = (Pp: number[][], Qq: number[][]) =>
      Pp.map((_, u) => Qq.map((__, m) => r2(predict1(Pp, Qq, u, m))))

    //  预测值的量程 —— 评分只有 1~5 分，飞出去多少比 RMSE 更直观
    const finalPred = predOf(P, Q)
    const predMin = r2(Math.min(...finalPred.flat()))
    const predMax = r2(Math.max(...finalPred.flat()))

    const coldNorm = coldUser >= 0 ? r3(Math.sqrt(P[coldUser].reduce((a, x) => a + x * x, 0))) : 0
    const coldRmse = coldUser >= 0 ? rmse(test.filter(c => c.u === coldUser), P, Q) : 0

    const shared = {
      users: USERS, movies: MOVIES, full, role, P, Q, trainRmse, testRmse, curve,
      coldUser, coldNorm, coldRmse, rotGap: r3(rotGap), rotPGap: r3(rotPGap),
      nTrain: train.length, nTest: test.length, baseRmse: baselineRmse(test),
      predMin, predMax,
      scene, dim, lambda, dimSweep, grid, bestK, bestLam, bestKAtLam,
    }

    const frames: Frame[] = []
    frames.push({
      ...shared, step: 0, round: 0, pred: predOf(snaps[0].P.map(p => p.map(() => 0)), snaps[0].Q), phase: 'run',
      log: `一张 ${NU}×${NM} 的评分表，**${train.length} 格是训练评分**（模型只看这些）、` +
        `**${test.length} 格是留出评分**（模型一格都不看，最后拿它算分）、其余是真没打过分。\n\n` +
        `矩阵分解要做的事：给每个用户一个 ${dim} 维隐向量、每部电影一个 ${dim} 维隐向量，` +
        `让 **评分 ≈ 两个向量的内积**。这些向量**不是写死的，是从那 ${train.length} 格里学出来的**。` +
        (coldUser >= 0 ? `\n\n⚠️ 注意「${USERS[coldUser]}」那一行：**一条训练评分都没有**。` : ''),
    })

    for (let it = 0; it < ROUNDS; it++) {
      const c = curve[it]
      const prev = it > 0 ? curve[it - 1] : null
      frames.push({
        ...shared, step: frames.length, round: c.round,
        P: snaps[it].P, Q: snaps[it].Q, pred: predOf(snaps[it].P, snaps[it].Q),
        trainRmse: c.train, testRmse: c.test, phase: 'run',
        log: `**第 ${c.round} 轮 ALS**：先把每个用户的向量按"让它的已知评分误差最小"重解一遍（电影向量当已知），` +
          `再反过来重解每部电影的向量。\n\n` +
          `训练 RMSE ${prev ? `${prev.train} → ` : ''}**${c.train}**，留出 RMSE ${prev ? `${prev.test} → ` : ''}**${c.test}**。` +
          (c.test > (prev?.test ?? Infinity) ? '\n\n⚠️ 留出 RMSE **涨了** —— 这一轮学到的东西只对训练格有用。' : ''),
      })
    }

    const gapBig = testRmse - trainRmse > 0.5
    const sweepText = dimSweep.map(d => `k=${d.k}: 训练 ${d.train} / 留出 ${d.test}`).join('　')
    frames.push({
      ...shared, step: frames.length, round: ROUNDS, pred: predOf(P, Q), phase: 'done',
      log: `**训完了**（k=${dim}、λ=${lambda}、${ROUNDS} 轮）：训练 RMSE **${trainRmse}**、留出 RMSE **${testRmse}**。\n\n` +
        `对照：什么都不学、一律猜基准分 ${MU}，留出 RMSE 是 **${baselineRmse(test)}** —— ` +
        `模型${testRmse < baselineRmse(test) ? `**赢了它 ${r3(baselineRmse(test) - testRmse)}**` : `**还没赢过它**`}。\n\n` +
        `**固定 λ=${lambda}、只换 k**（各自重训、只算 RMSE）：\n${sweepText}\n这一行的最低点在 k=${bestKAtLam}。\n\n` +
        `**但只扫一个旋钮会挑错。** 把 k × λ 摆成网格再看，全场最低在 **k=${bestK}、λ=${bestLam}**（留出 ${bestCell.test}）。\n\n` +
        `这份数据的真模型是**秩 2** 的 —— ${bestK === 2 ? '网格挑出来的正是 2。' : `而网格挑出来的是 ${bestK}。这不奇怪：数据只有 ${train.length} 格、还带噪声，**更大的 k 配上足够的正则**同样稳。`} ` +
        `而且**真实场景里你根本不知道真秩是多少**，k 只能靠留出集挑，还得跟 λ 一起挑。\n\n` +
        (predMax > 5.5 || predMin < 0.5
          ? `⚠️ **预测值已经飞出量程**：评分只有 1~5 分，而模型给出的预测落在 **${predMin} ~ ${predMax}**。` +
            `λ=${lambda} 时隐向量的长度没有任何约束，ALS 可以把向量拉到任意大 —— ` +
            `训练格上正负相消看不出来，一到没见过的格子就原形毕露。\n\n` +
            `⚠️ 而且这**不是**教科书那种"更贴合训练集但不泛化"的画面：k 小的时候，λ=0 连**训练误差**都更大` +
            `（方程组接近奇异，ALS 在两侧之间来回甩）—— **两头都更差**。**正则不是锦上添花，是这个模型能不能用的前提。**\n\n`
          : '') +
        (coldUser >= 0
          ? `⚠️ **冷启动**：「${USERS[coldUser]}」一条训练评分都没有，他的隐向量**没有任何约束** —— ` +
            `正则把它压到范数 **${coldNorm}**，于是给他的所有预测都是 ${coldNorm < 0.01 ? '**0 分**' : '几乎相同的一个数'}，` +
            `他那几格留出评分上的 RMSE 是 **${coldRmse}**（全表 ${testRmse}）。\n\n` +
            `**加维度、加轮次、调正则都救不了这一条** —— 没有数据就是没有数据。真实系统的办法是走别的路：` +
            `问一句"你喜欢什么类型"（显式冷启动）、拿注册信息/设备/地域做先验、或者先推热门内容换取第一批反馈。`
          : gapBig
            ? `⚠️ 训练和留出差了 **${r3(testRmse - trainRmse)}** —— k=${dim} 对这份数据太大了，多出来的维度在拟合噪声。` +
              `看扫描那一行：k 从 ${bestK} 涨到 ${dimSweep[dimSweep.length - 1].k} 时训练 RMSE 一路降，而留出 RMSE 反弹。` +
              `**又是"训练误差小不等于学会了"。** 把 λ 调大能压住它。`
            : `训练和留出差 ${r3(testRmse - trainRmse)}，没有明显过拟合。` +
              `换 k=10 或把 λ 调到 0 看看它什么时候垮，换成「有冷启动用户」看看它什么时候**根本答不上来**。`) +
        `\n\n⭐ **最后一件事，也是最容易被讲错的**：把 P 乘上一个随机可逆矩阵 R、Q 乘上 R⁻¹，` +
        `隐向量整个面目全非（最大变化 **${r3(rotPGap)}**），而**所有预测逐格最大变化只有 ${r3(rotGap)}**。\n\n` +
        `**所以"第一维是爱动作、第二维是爱文艺"这种话讲不得** —— 隐向量本身不是定下来的东西，` +
        `只有内积（也就是预测）才是模型。学出来的维度没有名字，也不该被硬安一个。`,
    })

    const base0: Frame = {
      ...shared, step: -1, round: 0, pred: full.map(row => row.map(() => 0)), phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: 'ALS 轮次' },
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
