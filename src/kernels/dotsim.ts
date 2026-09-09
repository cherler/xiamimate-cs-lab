/**
 * 内核：内积 = 相似度（线代 · 注意力凭什么用 Q·K 打分）
 * 轴：夹角 θ 从 0° 转到 180°（在 a、b 张成的那个平面里，**维度可以是任意的**）
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本是 **2 维、5 个手挑的角度**，而它自己的正文里写着两句从没兑现过的话：
 *   ①「无关的方向内积≈0（正对上**高维近正交** —— 随机方向几乎正交、点积≈0）」
 *     —— 在 2 维里这句话**根本不成立**：两个随机方向的余弦几乎均匀铺在 [−1,1] 上。
 *     "高维"这件事一次都没发生过。
 *   ②「内积同时编码了**长度**和**夹角**」「检索、推荐、词向量类比全靠它」
 *     —— 长度写死成 3 和 2，"长向量"和"方向对准"这两件事从来没打过架，
 *     而那正是**向量检索里最常踩的坑**。
 *
 * 这一版：
 * ① **维度做旋钮**（2 / 8 / 64 / 512）。角度扫描照旧（在 a、b 张成的平面里做，画面不变），
 *    但**另外抽 2000 对随机向量**量余弦的分布 —— **"高维近正交"变成一条测出来的曲线**：
 *    标准差 ≈ **1/√d**，跟理论值当场对。
 * ② **打分口径做旋钮**：**原始内积** vs **余弦（归一化）**。
 * ③ ⭐ **检索小演示**：一个 query 对 6 个文档向量，两种口径各排一次名 ——
 *    **原始内积会系统性地偏爱模长大的文档**（"长文档偏置"），两个排名不一样。
 *    这就是向量检索里普遍要归一化的原因，也是"内积同时编码长度和夹角"这句话的代价。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

export const DOT_DIMS = [2, 8, 64, 512] as const

const S_RAW = '原始内积 a·b'
const S_COS = '余弦（除掉长度）'
export const DOT_SCORES = [S_RAW, S_COS] as const

const MAG_A = 3, MAG_B = 2
const ANGLES = [0, 45, 90, 135, 180]
const r3 = (x: number) => Math.round(x * 1000) / 1000

/** 种子化 PRNG —— 随机向量要真随机，整个实验又必须可复现 */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** Box–Muller：标准正态 */
const gauss = (rand: () => number) => {
  const u = Math.max(1e-12, rand()), v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const dotOf = (a: number[], b: number[]) => a.reduce((s, x, k) => s + x * b[k], 0)
const norm = (a: number[]) => Math.hypot(...a)
const cosOf = (a: number[], b: number[]) => {
  const na = norm(a), nb = norm(b)
  return na && nb ? dotOf(a, b) / (na * nb) : 0
}

/**
 * ⭐ **高维近正交，量出来。**
 * 每档维度抽 `n` 对随机高斯向量，统计余弦的均值和标准差。
 * 理论上均值 0、标准差 **1/√d** —— 屏幕上跟实测并排，**别拿公式代替测量**。
 */
function orthoStats(d: number, n = 2000, seed = 20260909) {
  const rand = rng(seed + d)
  let sum = 0, sum2 = 0, big = 0
  for (let t = 0; t < n; t++) {
    const a = Array.from({ length: d }, () => gauss(rand))
    const b = Array.from({ length: d }, () => gauss(rand))
    const c = cosOf(a, b)
    sum += c; sum2 += c * c
    if (Math.abs(c) > 0.5) big++
  }
  const mean = sum / n
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean))
  return { d, n, mean: r3(mean), sd: r3(sd), theory: r3(1 / Math.sqrt(d)), bigFrac: r3(big / n) }
}

// ═══════════════════════════════════════════════════════════════
//  检索小演示：原始内积 vs 余弦
// ═══════════════════════════════════════════════════════════════

export type DocRow = { name: string; mag: number; cos: number; dot: number; rankDot: number; rankCos: number }

/**
 * 6 个"文档"向量：**方向对准程度**和**模长**特意错开。
 * 于是「方向最对的那个」和「内积最大的那个」**不是同一个** ——
 * 这正是向量检索里"长文档偏置"的最小复现。
 */
const DOCS: { name: string; cos: number; mag: number }[] = [
  { name: 'D1 短·方向最准', cos: 0.95, mag: 1.0 },
  { name: 'D2 长·方向一般', cos: 0.55, mag: 2.4 },
  { name: 'D3 中·方向较准', cos: 0.80, mag: 1.3 },
  { name: 'D4 很长·方向差', cos: 0.30, mag: 4.0 },
  { name: 'D5 短·方向差', cos: 0.25, mag: 0.8 },
  { name: 'D6 中·方向中', cos: 0.60, mag: 1.6 },
]

function retrieval() {
  //  query 是单位向量，所以 a·b = |b|·cosθ —— 两个口径的差别只来自模长
  const rows = DOCS.map(x => ({ ...x, dot: r3(x.mag * x.cos) }))
  const byDot = [...rows].sort((a, b) => b.dot - a.dot).map(x => x.name)
  const byCos = [...rows].sort((a, b) => b.cos - a.cos).map(x => x.name)
  return rows.map(x => ({
    name: x.name, mag: x.mag, cos: x.cos, dot: x.dot,
    rankDot: byDot.indexOf(x.name) + 1, rankCos: byCos.indexOf(x.name) + 1,
  })) as DocRow[]
}

// ═══════════════════════════════════════════════════════════════
//  状态
// ═══════════════════════════════════════════════════════════════

export type OrthoRow = { d: number; n: number; mean: number; sd: number; theory: number; bigFrac: number }

export type DotSimState = {
  i: number
  step: number
  dim: number
  scoreName: string
  angleDeg: number
  /** 画面用：a、b 在它们张成的那个平面里的坐标（维度再高，两个向量也只张成一个平面） */
  ax: number; ay: number
  bx: number; by: number
  dot: number
  magA: number; magB: number
  cosSim: number
  /** b 在 a 上的标量投影 = |b|cosθ */
  proj: number
  /** ⭐ 高维近正交：各档维度下随机向量对的余弦分布（实测 vs 理论 1/√d） */
  ortho: OrthoRow[]
  /** 当前维度那一行 */
  orthoNow: OrthoRow
  /** ⭐ 检索演示：两种口径各排一次名 */
  docs: DocRow[]
  /** 两个排名的第一名分别是谁 */
  topDot: string
  topCos: string
  phase: 'run' | 'done'
  log: string
}

export const DOTSIM_VISIBLE = [
  'step', 'dim', 'scoreName', 'angleDeg', 'ax', 'ay', 'bx', 'by', 'dot', 'magA', 'magB',
  'cosSim', 'proj', 'ortho', 'orthoNow', 'docs', 'topDot', 'topCos', 'phase', 'log',
] as const
type Frame = Omit<DotSimState, 'i'>

export const dotsimKernel: Kernel<DotSimState> = {
  kind: 'dotsim',

  compile(doc: SimDocument): CompiledModel<DotSimState> {
    const dim = Number(doc.params.dim ?? 64)
    const scoreName = String(doc.params.score ?? S_RAW)
    const useCos = scoreName === S_COS

    //  ⭐ 高维近正交：**扫出来的**，不是断言
    const ortho = DOT_DIMS.map(d => orthoStats(d))
    const orthoNow = ortho.find(x => x.d === dim)!
    const docs = retrieval()
    const topDot = docs.find(x => x.rankDot === 1)!.name
    const topCos = docs.find(x => x.rankCos === 1)!.name

    const shared = { dim, scoreName, ortho, orthoNow, docs, topDot, topCos, magA: MAG_A, magB: MAG_B }
    const frames: Frame[] = []
    const ax = MAG_A, ay = 0

    ANGLES.forEach(deg => {
      const r = deg * Math.PI / 180
      const bx = MAG_B * Math.cos(r), by = MAG_B * Math.sin(r)
      //  ⚠️ 维度再高，两个向量也只张成一个平面 —— 所以这几个数在任何 d 下都一样，
      //     画面也不用变。**维度真正影响的是下面那批随机向量。**
      const dotv = ax * bx + ay * by
      const cosSim = dotv / (MAG_A * MAG_B)
      const proj = MAG_B * Math.cos(r)
      const tag = deg === 0 ? '同向 → 最相似' : deg === 90 ? '正交 → 不相关（内积 0）'
        : deg === 180 ? '反向 → 最负' : deg < 90 ? '夹角小 → 正相关' : '夹角大 → 负相关'
      frames.push({
        ...shared, step: frames.length, angleDeg: deg, ax, ay, bx: r3(bx), by: r3(by),
        dot: r3(dotv), cosSim: r3(cosSim), proj: r3(proj), phase: 'run',
        log: `夹角 θ=**${deg}°**：a·b = |a||b|cosθ = ${MAG_A}×${MAG_B}×${Math.cos(r).toFixed(2)} = **${r3(dotv)}**，`
          + `余弦 = ${r3(cosSim)}。**${tag}**。（内积也 = |a| × b 在 a 上的投影 ${r3(proj)}）\n\n`
          + (deg === 0
            ? `⚠️ **这几个数跟维度无关** —— 两个向量不管在几维空间里，都只张成一个平面，`
              + `夹角和内积就在那个平面里算。**维度真正影响的是另一件事**，下一屏见。`
            : deg === 90
              ? `正交 = 内积 0 = "毫无关系"。**记住这个 0** —— 下一屏你会看到，`
                + `在高维空间里，随便抓两个方向，内积**几乎总是接近 0**。`
              : ''),
      })
    })

    const lf = frames[frames.length - 1]
    const swap = docs.filter(x => x.rankDot !== x.rankCos).length
    frames.push({
      ...lf, step: frames.length, phase: 'done',
      log: `θ 从 0° 转到 180°：内积 6 → 4.24 → **0**（正交）→ −4.24 → −6，余弦 1 → 0.71 → 0 → −0.71 → −1。\n\n`
        + `内积 **a·b = |a||b|cosθ**。长度固定时它就纯粹量"方向多一致" —— 这就是**注意力用 Q·K 打分**的根据：`
        + `query 与 key 越方向一致（相关），内积越大、softmax 权重越高。\n\n`
        + `⭐ **但"无关的方向内积≈0"这句话，得高维才成立。** 另抽 **${orthoNow.n}** 对随机向量量一遍：\n`
        + ortho.map(x => `　d=${x.d}：余弦均值 ${x.mean}、标准差 **${x.sd}**（理论 1/√d = ${x.theory}）`
          + `　|余弦|>0.5 的占 ${(x.bigFrac * 100).toFixed(1)}%`).join('\n')
        + `\n\n**实测标准差跟 1/√d 逐档对得上** —— 这不是我算的公式，是抽出来的。\n\n`
        + `**在 2 维里，随便抓两个方向，有 ${(ortho[0].bigFrac * 100).toFixed(0)}% 的机会余弦超过 0.5** —— `
        + `"随机方向几乎正交"在低维是**假的**。而 d=512 时这个比例是 ${(ortho[3].bigFrac * 100).toFixed(1)}%。\n\n`
        + `**这就是"高维近正交"**：维度一高，随机方向之间几乎必然接近垂直，于是"无关"这件事有了可靠的数值表示（≈0）。`
        + `大模型的 embedding 动辄几百上千维，靠的就是这个 —— **不相关的东西能稳稳地打出接近 0 的分**。\n\n`
        + `⭐ **还有一件事：内积同时编码了长度和夹角，而这在检索里是个坑。**\n`
        + `拿一个 query 去打 6 个"文档"向量（query 是单位向量，所以 a·b = |b|·cosθ）：\n`
        + docs.map(x => `　${x.name}：模长 ${x.mag}、余弦 ${x.cos} → 内积 ${x.dot}`
          + `　（按内积排第 ${x.rankDot}、按余弦排第 ${x.rankCos}）`).join('\n')
        + `\n\n**按原始内积排第一的是「${topDot}」，按余弦排第一的是「${topCos}」** —— `
        + `${swap} 个文档的名次不一样。\n\n`
        + `**原始内积会系统性地偏爱模长大的向量**：D4 的方向差得远（余弦才 0.30），可它够长（模长 4.0），`
        + `内积就把方向最准的 D1（余弦 0.95、但模长只有 1.0）压下去了。`
        + `**这就是向量检索里的"长文档偏置"**，也是为什么实践中普遍要**先归一化再算内积**（那就是余弦）。\n\n`
        + `所以「内积 = 相似度」这句话要加一个前提：**长度得先处理掉**。`
        + `归一化掉长度就是**余弦相似度** cosθ ∈ [−1,1] —— 纯方向的相似度。检索、推荐、词向量类比，用的都是它。`
        + (useCos ? `\n\n（当前口径：**${scoreName}** —— 长度已经除掉了。）` : `\n\n（当前口径：**${scoreName}** —— 长度还在里面，所以有上面那个偏置。）`),
    })

    const base0: Frame = {
      ...shared, step: -1, angleDeg: -1, ax, ay, bx: MAG_B, by: 0,
      dot: MAG_A * MAG_B, cosSim: 1, proj: MAG_B, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '夹角 θ' },
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
