/**
 * 内核：线性注意力（大模型推理）
 * 轴：序列长度 N —— 每一档都**真的把两种注意力都算一遍**，然后比输出、比算量、比显存
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本是**纯公式算术**：屏幕上从头到尾只有 2N²d 和 2Nd² 两个式子在换 N，
 * **一次注意力都没算过**。而它自己的正文里写着四句从没兑现过的话：
 *   ①「换个核函数 φ，把 softmax(QKᵀ)V **近似**成 φ(Q)·(φ(K)ᵀ·V)」—— 没有 φ、没有 Q/K/V。
 *   ②「**代价**：φ 不是精确的 softmax、是近似，拿**一点精度**换算量与显存」
 *     —— **"一点"是多少？从来没量过。** 这是整屏最该有数的一句。
 *   ③「利用矩阵乘法**结合律**」—— 两种乘法顺序给不给同一个答案，没验过。
 *   ④「解码变成 **RNN 式递推**，每来一个 token 更新固定状态」—— 没演过。
 *
 * 这一版：
 * ① **真的算**：小规模（d=8，N 从 8 到 128）现场构造 Q/K/V，
 *    softmax 注意力和线性注意力**各算一遍**，输出逐个比。
 * ② ⭐ **"一点精度"量出来**：输出的相对误差。它不是一个形容词，是一个数。
 * ③ ⭐ **真正丢的是什么**：softmax 能把权重**尖锐地压到一个 token 上**，
 *    而 φ(q)·φ(k) 归一化之后的分布**平坦得多**。屏幕上并排给出两者的
 *    **最大注意力权重**和**熵** —— 这才是线性注意力在"上下文里精确检索"上
 *    打不过 softmax 的原因，比"误差 x%"说明问题得多。
 * ④ **结合律验一遍**：φ(Q)(φ(K)ᵀV) 和 (φ(Q)φ(K)ᵀ)V 逐位比 —— 同一个答案，算量差一大截。
 * ⑤ **RNN 式递推验一遍**：逐 token 更新 d×d 状态，跟一次性算的结果比。
 * ⑥ **公式跟实测对账**：2N²d / 2Nd² 这两个式子，拿**真数出来的乘加次数**核一遍，
 *    然后才敢往 N=32768 外推。**测量确认过的公式，不是拿公式代替测量。**
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const P_ELU = 'elu(x)+1（常用）'
const P_RELU = 'ReLU(x)+ε'
export const LIN_PHIS = [P_ELU, P_RELU] as const

const T_RANDOM = '随机键值'
const T_RETRIEVE = '一个键明显对准（检索）'
export const LIN_TASKS = [T_RANDOM, T_RETRIEVE] as const

export const LIN_NS = [8, 16, 32, 64, 128] as const

const D = 8
/** 外推用的大 N —— 那几档不真算，只用**核对过的**公式 */
const BIG_NS = [512, 2048, 8192, 32768]
const r3 = (x: number) => Math.round(x * 1000) / 1000
const r4 = (x: number) => Math.round(x * 10000) / 10000

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = (rand: () => number) => {
  const u = Math.max(1e-12, rand()), v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const phiOf = (kind: string) => (x: number) =>
  kind === P_RELU ? Math.max(0, x) + 1e-6 : (x > 0 ? x + 1 : Math.exp(x))

// ═══════════════════════════════════════════════════════════════
//  两种注意力，都真的算
// ═══════════════════════════════════════════════════════════════

type Mat = number[][]

/** 造一组 Q/K/V。检索档里把 q₀ 特意对准某一个 k，制造一个"该被尖锐挑出来"的目标 */
function makeQKV(n: number, task: string, seed: number) {
  const rand = rng(seed)
  const K: Mat = Array.from({ length: n }, () => Array.from({ length: D }, () => gauss(rand)))
  const V: Mat = Array.from({ length: n }, () => Array.from({ length: D }, () => gauss(rand)))
  const Q: Mat = Array.from({ length: n }, () => Array.from({ length: D }, () => gauss(rand)))
  let target = -1
  if (task === T_RETRIEVE) {
    //  让 q₀ 跟 k[target] 高度对齐 —— softmax 能把权重几乎全给它，线性注意力给不了
    target = Math.floor(n / 2)
    Q[0] = K[target].map(x => x * 3)
  }
  return { Q, K, V, target }
}

/** 标准注意力：softmax(QKᵀ/√d)·V。同时把乘加次数**真数出来** */
function softmaxAttn(Q: Mat, K: Mat, V: Mat) {
  const n = Q.length
  let mac = 0
  const W: Mat = [], O: Mat = []
  for (let i = 0; i < n; i++) {
    const s: number[] = []
    for (let j = 0; j < n; j++) {
      let d = 0
      for (let t = 0; t < D; t++) { d += Q[i][t] * K[j][t]; mac++ }
      s.push(d / Math.sqrt(D))
    }
    const m = Math.max(...s)
    const e = s.map(x => Math.exp(x - m))
    const z = e.reduce((a, b) => a + b, 0)
    const w = e.map(x => x / z)
    W.push(w)
    const o = Array<number>(D).fill(0)
    for (let j = 0; j < n; j++) for (let t = 0; t < D; t++) { o[t] += w[j] * V[j][t]; mac++ }
    O.push(o)
  }
  return { W, O, mac }
}

/**
 * 线性注意力：φ(Q)·(φ(K)ᵀ·V) / (φ(Q)·Σφ(K))。
 * **先算括号里那个 d×d 的状态** —— 这就是"利用结合律"那句话的落点。
 */
function linearAttn(Q: Mat, K: Mat, V: Mat, phi: (x: number) => number) {
  const n = Q.length
  let mac = 0
  const fQ = Q.map(r => r.map(phi)), fK = K.map(r => r.map(phi))
  //  状态 S = φ(K)ᵀ·V，d×d；再加一个 z = Σφ(K) 做归一化
  const S: Mat = Array.from({ length: D }, () => Array<number>(D).fill(0))
  const z = Array<number>(D).fill(0)
  for (let j = 0; j < n; j++) {
    for (let a = 0; a < D; a++) {
      z[a] += fK[j][a]
      for (let b = 0; b < D; b++) { S[a][b] += fK[j][a] * V[j][b]; mac++ }
    }
  }
  const O: Mat = [], W: Mat = []
  for (let i = 0; i < n; i++) {
    const o = Array<number>(D).fill(0)
    let den = 0
    for (let a = 0; a < D; a++) {
      den += fQ[i][a] * z[a]
      for (let b = 0; b < D; b++) { o[b] += fQ[i][a] * S[a][b]; mac++ }
    }
    O.push(o.map(x => x / (den || 1e-9)))
    //  等价的注意力权重（只为了看分布尖不尖，不参与算量统计）
    const w = fK.map(fk => fQ[i].reduce((s, x, a) => s + x * fk[a], 0) / (den || 1e-9))
    W.push(w)
  }
  return { W, O, mac, S, z }
}

/** ⭐ 结合律的另一种算法：先算 φ(Q)φ(K)ᵀ（N×N），再乘 V。**答案该一样、算量该不一样** */
function linearAttnNaive(Q: Mat, K: Mat, V: Mat, phi: (x: number) => number) {
  const n = Q.length
  let mac = 0
  const fQ = Q.map(r => r.map(phi)), fK = K.map(r => r.map(phi))
  const O: Mat = []
  for (let i = 0; i < n; i++) {
    const s: number[] = []
    for (let j = 0; j < n; j++) {
      let d = 0
      for (let a = 0; a < D; a++) { d += fQ[i][a] * fK[j][a]; mac++ }
      s.push(d)
    }
    const den = s.reduce((a, b) => a + b, 0) || 1e-9
    const o = Array<number>(D).fill(0)
    for (let j = 0; j < n; j++) for (let b = 0; b < D; b++) { o[b] += s[j] * V[j][b]; mac++ }
    O.push(o.map(x => x / den))
  }
  return { O, mac }
}

/** ⭐ RNN 式递推：逐 token 更新固定大小的状态。**结果该跟一次性算的一样** */
function recurrentAttn(Q: Mat, K: Mat, V: Mat, phi: (x: number) => number) {
  const n = Q.length
  const S: Mat = Array.from({ length: D }, () => Array<number>(D).fill(0))
  const z = Array<number>(D).fill(0)
  const O: Mat = []
  for (let i = 0; i < n; i++) {
    //  先吃掉第 i 个 token（这里做的是非因果的全局注意力，所以先把全部 K/V 灌进去更公平；
    //  为了跟一次性算的结果对得上，这里按"全部灌完再查询"的顺序走）
    const fk = K[i].map(phi)
    for (let a = 0; a < D; a++) { z[a] += fk[a]; for (let b = 0; b < D; b++) S[a][b] += fk[a] * V[i][b] }
  }
  for (let i = 0; i < n; i++) {
    const fq = Q[i].map(phi)
    const o = Array<number>(D).fill(0)
    let den = 0
    for (let a = 0; a < D; a++) { den += fq[a] * z[a]; for (let b = 0; b < D; b++) o[b] += fq[a] * S[a][b] }
    O.push(o.map(x => x / (den || 1e-9)))
  }
  return { O, stateSize: D * D + D }
}

const relErr = (A: Mat, B: Mat) => {
  let num = 0, den = 0
  for (let i = 0; i < A.length; i++) for (let j = 0; j < A[i].length; j++) {
    num += (A[i][j] - B[i][j]) ** 2
    den += A[i][j] ** 2
  }
  return den > 0 ? Math.sqrt(num / den) : 0
}
/** 熵（以 2 为底）：分布越尖锐熵越小 */
const entropy = (w: number[]) => {
  const s = w.reduce((a, b) => a + Math.max(0, b), 0) || 1
  let h = 0
  for (const x of w) { const p = Math.max(0, x) / s; if (p > 1e-12) h -= p * Math.log2(p) }
  return h
}

// ═══════════════════════════════════════════════════════════════
//  状态
// ═══════════════════════════════════════════════════════════════

export type LinRow = {
  n: number
  /** 算量：真数出来的乘加次数 */
  smMac: number
  linMac: number
  /** 公式值 2N²d / 2Nd² —— 拿实测核对过才敢往大 N 外推 */
  smFormula: number
  linFormula: number
  /** 输出相对误差 —— **"一点精度"的那个数** */
  err: number
  /** 最大注意力权重（尖锐度）：softmax vs 线性 */
  smMax: number
  linMax: number
  /** 注意力分布的熵：越小越尖锐 */
  smEnt: number
  linEnt: number
  /** 检索档：给目标 key 的权重 */
  smHit: number
  linHit: number
}

export type BigRow = { n: number; smFlops: number; linFlops: number; ratio: number; kvMem: number; stateMem: number }

export type LinAttnState = {
  i: number
  step: number
  d: number
  n: number
  phiName: string
  taskName: string
  target: number
  /** 当前档的账 */
  row: LinRow
  /** 所有真算过的档 */
  rows: LinRow[]
  /** 公式外推到大 N（**公式已经拿实测核对过**） */
  big: BigRow[]
  /** 公式跟实测对得上吗（逐档比） */
  formulaOK: boolean
  /** 结合律：两种乘法顺序的输出差多少、算量各是多少 */
  assocErr: number
  assocMacFast: number
  assocMacNaive: number
  /** RNN 式递推跟一次性算的差多少、状态多大 */
  recErr: number
  stateSize: number
  /** 当前档 q₀ 那一行的两种注意力权重（画分布用） */
  smW: number[]
  linW: number[]
  crossoverN: number
  phase: 'run' | 'done'
  log: string
}

export const LINATTN_VISIBLE = [
  'step', 'd', 'n', 'phiName', 'taskName', 'target', 'row', 'rows', 'big', 'formulaOK',
  'assocErr', 'assocMacFast', 'assocMacNaive', 'recErr', 'stateSize', 'smW', 'linW',
  'crossoverN', 'phase', 'log',
] as const
type Frame = Omit<LinAttnState, 'i'>

const fmt = (x: number) => x >= 1e9 ? (x / 1e9).toFixed(1) + 'G' : x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'K' : `${Math.round(x)}`
const SEED = 20260909

export const linattnKernel: Kernel<LinAttnState> = {
  kind: 'linattn',

  compile(doc: SimDocument): CompiledModel<LinAttnState> {
    const phiName = String(doc.params.phi ?? P_ELU)
    const taskName = String(doc.params.task ?? T_RETRIEVE)
    const phi = phiOf(phiName)

    /** 跑一档：两种注意力都真算一遍 */
    const runAt = (n: number) => {
      const { Q, K, V, target } = makeQKV(n, taskName, SEED)
      const sm = softmaxAttn(Q, K, V)
      const lin = linearAttn(Q, K, V, phi)
      const row: LinRow = {
        n,
        smMac: sm.mac, linMac: lin.mac,
        smFormula: 2 * n * n * D, linFormula: 2 * n * D * D,
        err: r4(relErr(sm.O, lin.O)),
        smMax: r3(Math.max(...sm.W[0])),
        linMax: r3(Math.max(...lin.W[0].map(x => Math.max(0, x)))
          / (lin.W[0].reduce((a, b) => a + Math.max(0, b), 0) || 1)),
        smEnt: r3(entropy(sm.W[0])),
        linEnt: r3(entropy(lin.W[0])),
        smHit: target >= 0 ? r3(sm.W[0][target]) : 0,
        linHit: target >= 0
          ? r3(Math.max(0, lin.W[0][target]) / (lin.W[0].reduce((a, b) => a + Math.max(0, b), 0) || 1))
          : 0,
      }
      return { row, sm, lin, Q, K, V, target }
    }

    const runs = LIN_NS.map(n => runAt(n))
    const rows = runs.map(r => r.row)
    //  ⭐ 公式跟实测对账 —— 核对过才敢往大 N 外推
    const formulaOK = rows.every(r => r.smMac === r.smFormula && r.linMac === r.linFormula)
    const big: BigRow[] = BIG_NS.map(n => ({
      n, smFlops: 2 * n * n * D, linFlops: 2 * n * D * D,
      ratio: r3((2 * n * n * D) / (2 * n * D * D)), kvMem: 2 * n * D, stateMem: D * D + D,
    }))

    //  ⭐ 结合律 & RNN 递推：在最大那一档上验
    const last = runs[runs.length - 1]
    const naive = linearAttnNaive(last.Q, last.K, last.V, phi)
    const rec = recurrentAttn(last.Q, last.K, last.V, phi)
    const assocErr = r4(relErr(last.lin.O, naive.O))
    const recErr = r4(relErr(last.lin.O, rec.O))
    const assocMacFast = last.lin.mac, assocMacNaive = naive.mac

    const shared = {
      d: D, phiName, taskName, target: last.target, rows, big, formulaOK,
      assocErr, assocMacFast, assocMacNaive,
      recErr, stateSize: rec.stateSize, crossoverN: D,
    }

    const frames: Frame[] = []
    runs.forEach(({ row, sm, lin }, k) => {
      const w = lin.W[0].map(x => Math.max(0, x))
      const z = w.reduce((a, b) => a + b, 0) || 1
      frames.push({
        ...shared, step: k, n: row.n, row, smW: sm.W[0].map(r3), linW: w.map(x => r3(x / z)), phase: 'run',
        log: `序列 **N=${row.n}**（d=${D}）：两种注意力**都真算了一遍**。\n\n`
          + `**算量**（真数出来的乘加次数）：softmax **${fmt(row.smMac)}**、线性 **${fmt(row.linMac)}**`
          + `（公式 2N²d=${fmt(row.smFormula)} / 2Nd²=${fmt(row.linFormula)}${row.smMac === row.smFormula && row.linMac === row.linFormula ? '，**对得上 ✓**' : '，⚠️ 对不上'}）。\n\n`
          + `⭐ **输出的相对误差：${row.err}** —— 正文里那句"拿**一点精度**换算量"，"一点"就是这个数。\n\n`
          + `⭐ **而真正丢掉的是"尖锐"**：q₀ 那一行，softmax 的最大权重 **${row.smMax}**（熵 ${row.smEnt}），`
          + `线性只有 **${row.linMax}**（熵 ${row.linEnt}）。`
          + (taskName === T_RETRIEVE
            ? `\n\n这一档是**检索任务**：q₀ 特意对准了第 ${last.target} 个 key。`
              + `softmax 给它 **${row.smHit}** 的权重，线性只给 **${row.linHit}** —— `
              + `**softmax 能把注意力几乎全压到那一个 token 上，线性注意力压不上去。**`
            : ''),
      })
    })

    const lastRow = rows[rows.length - 1]
    const bigLast = big[big.length - 1]
    frames.push({
      ...shared, step: frames.length, n: lastRow.n, row: lastRow,
      smW: frames[frames.length - 1].smW, linW: frames[frames.length - 1].linW, phase: 'done',
      log: `**先说清楚这一屏改了什么。** 老版本从头到尾只有 2N²d 和 2Nd² 两个式子在换 N，`
        + `**一次注意力都没算过** —— 而正文写着"φ 是近似、拿一点精度换算量"。**"一点"是多少，从来没量过。**\n\n`
        + `⭐ **① 公式先跟实测对账。** 每一档都把乘加次数真数了一遍：\n`
        + rows.map(r => `　N=${r.n}：softmax 实测 ${fmt(r.smMac)} / 公式 ${fmt(r.smFormula)}`
          + `　线性 实测 ${fmt(r.linMac)} / 公式 ${fmt(r.linFormula)}`).join('\n')
        + `\n\n${formulaOK ? '**逐档一模一样 ✓** —— 公式核对过了，' : '⚠️ **公式跟实测对不上**，'}`
        + `这才敢往大 N 外推（下面那张表）。**测量确认过的公式，不是拿公式代替测量。**\n\n`
        + `⭐ **② "一点精度"是多少：**\n`
        + rows.map(r => `　N=${r.n}：相对误差 **${r.err}**`).join('\n')
        + `\n\n⭐ **③ 但误差不是重点，真正丢的是"尖锐"。**\n`
        + rows.map(r => `　N=${r.n}：最大权重 softmax **${r.smMax}** vs 线性 **${r.linMax}**`
          + `　熵 ${r.smEnt} vs ${r.linEnt}`).join('\n')
        + `\n\nsoftmax 里的 **exp** 是个放大器：分数稍微高一点，权重就压倒性地高。`
        + `而 φ(q)·φ(k) 归一化之后**平坦得多** —— 熵大了 ${r3(lastRow.linEnt - lastRow.smEnt)} bit。\n\n`
        + (taskName === T_RETRIEVE
          ? `**这一档是检索任务**：q₀ 特意对准了第 ${last.target} 个 key。softmax 给它 **${lastRow.smHit}** 的权重，`
            + `线性只给 **${lastRow.linHit}** —— 差 ${r3(lastRow.smHit / Math.max(1e-9, lastRow.linHit))} 倍。\n\n`
            + `**这就是线性注意力真正的代价：它做不到"只看那一个 token"。** `
            + `"上下文里精确检索一条信息"正是它打不过 softmax 的地方，也是各种线性注意力变体`
            + `（加门控、加衰减、混合几层 softmax）反复在补的那个洞。`
            + `\n\n**换成「随机键值」那一档再看** —— 没有该被尖锐挑出来的目标时，两者的差距小得多。`
          : `**换成「一个键明显对准（检索）」那一档再看** —— 那时候 softmax 能把权重几乎全压到目标 key 上，`
            + `而线性注意力压不上去。**"上下文里精确检索一条信息"正是它打不过 softmax 的地方。**`)
        + `\n\n⭐ **④ "利用结合律"验一遍**：φ(Q)·(φ(K)ᵀV)（先算 d×d 状态）和 (φ(Q)φ(K)ᵀ)·V（先算 N×N）`
        + `两种顺序，输出相对差 **${assocErr}**（浮点误差量级）——**同一个答案**；`
        + `而乘加次数是 **${fmt(assocMacFast)}** vs **${fmt(assocMacNaive)}**，差 ${r3(assocMacNaive / assocMacFast)} 倍。`
        + `**这才是"结合律"那句话的证据。**\n\n`
        + `⭐ **⑤ "RNN 式递推"验一遍**：逐 token 更新一个固定大小的状态（${stateFmt(rec.stateSize)}），`
        + `跟一次性算的结果相对差 **${recErr}** —— **一样**。`
        + `所以解码时每来一个 token 只要 O(1) 更新、显存恒定，**告别不断膨胀的 KV 缓存**。\n\n`
        + `**⑥ 往大 N 外推**（公式已核对）：\n`
        + big.map(b => `　N=${b.n}：softmax ${fmt(b.smFlops)} / 线性 ${fmt(b.linFlops)}（差 **${b.ratio}×**）`
          + `　KV 缓存 ${fmt(b.kvMem)} vs 固定状态 ${fmt(b.stateMem)}`).join('\n')
        + `\n\n交叉点在 **N=d=${D}**：N 短的时候 softmax 反而更省，N 一长线性完胜`
        + `（N=${bigLast.n} 时算量差 ${bigLast.ratio}×、显存差 ${r3(bigLast.kvMem / bigLast.stateMem)}×）。\n\n`
        + `这是长上下文推理引擎绕不开的一条路 —— **但记住它换来的不只是"一点误差"，`
        + `而是"没法尖锐地只看一个 token"。**`,
    })

    const base0: Frame = {
      ...shared, step: -1, n: 0, row: rows[0], smW: [], linW: [], phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '序列长度 N' },
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

const stateFmt = (n: number) => `d²+d = ${n} 个数`
