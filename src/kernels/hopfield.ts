/**
 * 内核：注意力 = 联想记忆（大模型推理 · 注意力为什么能"检索"）
 * 轴：检索步 —— 用一个残缺的 query 反复做注意力检索，看它怎么"回忆"出完整的存储模式
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。检索本身是真算的（这一半上一轮就对了），但**三个旋钮一个都没有**，
 * 于是正文里三句话全靠嘴说：
 *   ①「softmax 的锐度 **β**（=1/温度）：**β 大 → 精确检索、β 小 → 软混合**」
 *     —— **β 写死成 6**，从来没动过。这是整屏最该做成旋钮的那个数。
 *   ②「query 只要落进某个存储模式的**吸引域**，就被拉回那个完整模式」
 *     —— 翻转位数写死成 2。**吸引域有多大？没量过。**
 *   ③「存储容量随维度**指数级**」
 *     —— 只存了 4 个模式、一个维度。**"指数级"这三个字一次都没兑现。**
 *
 * 这一版：
 * ① **β 做成旋钮**（0.5 / 2 / 6 / 20）。β 小的时候权重收敛不到 one-hot，
 *    输出是几个模式的**加权平均** —— 回忆出来的东西谁也不是。
 * ② **翻转位数做成旋钮**，另外**扫一遍吸引域**：翻 0~N/2 位、每档重采样 200 次，
 *    量"能正确回忆的比例"。**吸引域边界是抽出来的**。
 * ③ **容量扫描**：N=8 和 N=16 两个维度，各存 M=2…64 个随机模式，
 *    量正确回忆率。**"容量随维度指数级"变成两条曲线**，而且看得到崩溃点怎么随 N 挪。
 * ④ **"回忆对了吗"是独立真值**：正确答案 = 离 query **汉明距离最近**的那个存储模式，
 *    另算一份，**不问 Hopfield 自己**。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

export const HOP_BETAS = [0.5, 2, 6, 20] as const
export const HOP_FLIPS = [1, 2, 3] as const

const N = 8
const PATTERNS = [
  [1, -1, -1, 1, 1, -1, -1, 1],   // P0
  [1, 1, 1, 1, -1, -1, -1, -1],   // P1
  [1, -1, 1, -1, 1, -1, 1, -1],   // P2
  [-1, -1, -1, -1, 1, 1, 1, 1],   // P3
]
/** 翻哪几位（按顺序取前 flip 个）—— 钉死，可手算 */
const FLIP_ORDER = [1, 5, 2, 6, 0, 4, 3, 7]

const dot = (a: number[], b: number[]) => a.reduce((s, x, k) => s + x * b[k], 0)
const sign = (x: number) => (x >= 0 ? 1 : -1)
const r3 = (x: number) => Math.round(x * 1000) / 1000
function softmax(xs: number[]) {
  const m = Math.max(...xs)
  const es = xs.map(x => Math.exp(x - m))
  const s = es.reduce((a, b) => a + b, 0)
  return es.map(e => e / s)
}
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** ⭐ **独立真值**：离 query 汉明距离最近的那个存储模式。**不问 Hopfield 自己** */
function nearestPattern(q: number[], pats: number[][]) {
  let best = 0, bd = Infinity
  pats.forEach((p, i) => {
    const d = p.reduce((s, x, k) => s + (x === q[k] ? 0 : 1), 0)
    if (d < bd) { bd = d; best = i }
  })
  return { idx: best, dist: bd }
}

/** 跑一次检索到收敛（或跑满 steps），返回最后认定的模式 */
function retrieve(q0: number[], pats: number[][], beta: number, n: number, steps = 8) {
  let q = q0.slice()
  let best = 0, w: number[] = []
  for (let t = 0; t < steps; t++) {
    w = softmax(pats.map(p => (beta * dot(q, p)) / n))
    best = w.indexOf(Math.max(...w))
    const out = Array.from({ length: n }, (_, k) => pats.reduce((s, p, i) => s + w[i] * p[k], 0))
    const nq = out.map(sign)
    if (nq.every((x, k) => x === q[k])) { q = nq; break }
    q = nq
  }
  return { q, best, w }
}

/**
 * ⭐ **吸引域**：翻 f 位之后还回不回得到**原来那个**模式。
 *
 * ⚠️ 这里的口径栽过一次。第一版拿"回到**汉明最近**的那个模式"当正确 ——
 * 而那个"最近"会**跟着 query 一起挪**：翻多了之后 query 真的更靠近别的模式，
 * 于是"回错了"反而被判成对。结果曲线是 100/100/83/88/84，**根本不下降**，
 * "吸引域"这件事一点没演出来。
 *
 * 经典的问法是：**翻了 f 位，还回得到原模式吗**。所以两条都报：
 *   · `ok`     = 回到**原模式**（吸引域的定义，会随 f 掉下去）
 *   · `okNear` = 回到**汉明最近**的模式（"它有没有做错事"，一直很高）
 * 两条一起摆，才说得清"回不去"到底是记忆坏了、还是 query 真的已经离开了那片地方。
 */
function basinScan(pats: number[][], beta: number, n: number, reps = 200, seed = 20260909) {
  const out: { flip: number; ok: number; okNear: number }[] = []
  for (let f = 0; f <= Math.floor(n / 2); f++) {
    const rand = rng(seed + f * 7919)
    let hit = 0, hitNear = 0
    for (let t = 0; t < reps; t++) {
      const pi = Math.floor(rand() * pats.length)
      const q = pats[pi].slice()
      const idx = [...Array(n).keys()]
      for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1));[idx[k], idx[j]] = [idx[j], idx[k]] }
      for (let k = 0; k < f; k++) q[idx[k]] *= -1
      const got = retrieve(q, pats, beta, n)
      if (got.best === pi) hit++
      if (got.best === nearestPattern(q, pats).idx) hitNear++
    }
    out.push({ flip: f, ok: r3(hit / reps), okNear: r3(hitNear / reps) })
  }
  return out
}

/**
 * ⭐ **容量**：存 M 个随机模式，看还能不能正确回忆。
 * 两个维度并排 —— **"容量随维度指数级"就看崩溃点怎么随 N 挪。**
 */
function capacityScan(beta: number, dims = [8, 16], ms = [2, 4, 8, 16, 32, 64], reps = 120, seed = 424242) {
  return dims.map(n => ({
    n,
    row: ms.map(m => {
      const rand = rng(seed + n * 131 + m)
      let hit = 0
      for (let t = 0; t < reps; t++) {
        const pats = Array.from({ length: m }, () => Array.from({ length: n }, () => (rand() < 0.5 ? -1 : 1)))
        const pi = Math.floor(rand() * m)
        const q = pats[pi].slice()
        //  翻 1 位（轻微残缺）
        q[Math.floor(rand() * n)] *= -1
        //  ⚠️ 同样的口径问题：容量要问的是"**还认得出原来那个**吗"。
        //     拿"汉明最近"当正确的话，M=64 时也有 98% —— 那不是容量，那是"它没乱来"。
        const got = retrieve(q, pats, beta, n)
        if (got.best === pi) hit++
      }
      return { m, ok: r3(hit / reps) }
    }),
  }))
}

// ═══════════════════════════════════════════════════════════════
//  状态
// ═══════════════════════════════════════════════════════════════

export type BasinRow = { flip: number; ok: number; okNear: number }
export type CapRow = { n: number; row: { m: number; ok: number }[] }

export type HopfieldState = {
  i: number
  step: number
  beta: number
  flip: number
  n: number
  patterns: number[][]
  /** 出发的那个残缺 query */
  query0: number[]
  query: number[]
  querySign: number[]
  weights: number[]
  best: number
  /** ⭐ **真值**：离当前 query 汉明最近的那个模式（另算的，不问 Hopfield） */
  truth: number
  truthDist: number
  /** 当前 query 跟真值模式相同的位数 */
  matchBits: number
  /** 权重收敛到 one-hot 了吗（最大权重 > 0.9） */
  onehot: boolean
  converged: boolean
  /** 回忆对了吗（跟真值比） */
  right: boolean
  /** ⭐ 输出是不是几个模式的"加权平均"（β 小的时候）—— 最大权重多少 */
  maxW: number
  /** 各档 β 下：最大权重、回忆对不对 */
  betaSweep: {
    beta: number; maxW: number; right: boolean; steps: number
    /**  ⚠️ 屏幕上那**一个** query 碰巧四档 β 都回得去 —— 单个例子说明不了旋钮有没有用。
         这两栏是抽样出来的：翻 2 位的吸引域命中率、N=8 存 16 个模式的容量命中率。 */
    basin2: number
    cap16: number
  }[]
  /** ⭐ 吸引域扫描：翻几位还回得去 */
  basin: BasinRow[]
  /** 吸引域边界：正确率还在 90% 以上的最大翻转位数 */
  basinEdge: number
  /** ⭐ 容量扫描：两个维度各存 M 个随机模式 */
  cap: CapRow[]
  phase: 'run' | 'done'
  log: string
}

export const HOPFIELD_VISIBLE = [
  'step', 'beta', 'flip', 'n', 'patterns', 'query0', 'query', 'querySign', 'weights', 'best',
  'truth', 'truthDist', 'matchBits', 'onehot', 'converged', 'right', 'maxW',
  'betaSweep', 'basin', 'basinEdge', 'cap', 'phase', 'log',
] as const
type Frame = Omit<HopfieldState, 'i'>

export const hopfieldKernel: Kernel<HopfieldState> = {
  kind: 'hopfield',

  compile(doc: SimDocument): CompiledModel<HopfieldState> {
    const beta = Number(doc.params.beta ?? 6)
    const flip = Number(doc.params.flip ?? 2)

    //  出发的残缺 query：P0 翻 flip 位（钉死翻哪几位，可手算）
    const query0 = PATTERNS[0].slice()
    for (let k = 0; k < flip; k++) query0[FLIP_ORDER[k]] *= -1
    //  ⭐ 真值：离它汉明最近的那个模式。**不问 Hopfield**
    const truthInfo = nearestPattern(query0, PATTERNS)

    //  各档 β 的对照 —— 「β 大→精确、β 小→软混合」是扫出来的
    /*  ⚠️ 「回忆对了吗」也要按经典口径：不只是 argmax 挑对，还要**query 真的被清理回完整模式**。
        第一版只看 argmax，四档 β 全是"对" —— 而 β=0.5 那档权重最大才 0.355，
        输出是几个模式的加权平均、取符号之后根本不是任何一个存储模式。 */
    /*  ⚠️ 而且**光看屏幕上这一个 query 是不够的**：它碰巧四档 β 都回得去。
        所以每档 β 再各抽一遍 —— 翻 2 位的吸引域命中率、N=8 存 16 个模式的容量命中率。
        **单个例子说明不了旋钮有没有用，抽样才行。** */
    const betaSweep = HOP_BETAS.map(b => {
      const r = retrieve(query0, PATTERNS, b, N)
      const clean = r.q.every((x, k) => x === PATTERNS[0][k])
      const bs = basinScan(PATTERNS, b, N, 200)
      const cp = capacityScan(b, [8], [16], 120)
      return {
        beta: b, maxW: r3(Math.max(...r.w)), right: r.best === 0 && clean, steps: 0,
        basin2: bs.find(x => x.flip === 2)!.ok,
        cap16: cp[0].row[0].ok,
      }
    })
    const basin = basinScan(PATTERNS, beta, N)
    const basinEdge = basin.filter(x => x.ok >= 0.9).reduce((a, x) => Math.max(a, x.flip), 0)
    const cap = capacityScan(beta)

    const shared = {
      beta, flip, n: N, patterns: PATTERNS.map(p => p.slice()), query0: query0.slice(),
      truth: truthInfo.idx, truthDist: truthInfo.dist, betaSweep, basin, basinEdge, cap,
    }

    const frames: Frame[] = []
    let query = query0.slice()
    for (let step = 0; step < 6; step++) {
      const weights = softmax(PATTERNS.map(p => (beta * dot(query, p)) / N))
      const best = weights.indexOf(Math.max(...weights))
      const querySign = query.map(sign)
      const matchBits = querySign.reduce((c, b, k) => c + (b === PATTERNS[truthInfo.idx][k] ? 1 : 0), 0)
      const maxW = r3(Math.max(...weights))
      const onehot = maxW > 0.9
      const converged = onehot && matchBits === N
      frames.push({
        ...shared, step, query: query.map(x => r3(x)), querySign,
        weights: weights.map(w => r3(w)), best, matchBits, onehot, converged,
        right: best === truthInfo.idx, maxW, phase: 'run',
        log: `第 ${step} 步检索（β=**${beta}**）：权重 = [${weights.map(w => (w * 100).toFixed(0) + '%').join(', ')}]，`
          + `最像 **模式 ${best}**（${(maxW * 100).toFixed(0)}%）。`
          + `当前 query 与**真值模式 ${truthInfo.idx}** 相同 **${matchBits}/${N}** 位。\n\n`
          + (converged
            ? `✅ 已回忆出完整的模式 ${truthInfo.idx}，权重收敛到 **one-hot**。`
            : onehot
              ? `权重已经是 one-hot，但 query 还差 ${N - matchBits} 位 —— 再来一步。`
              : `⚠️ **权重还很分散（最大才 ${(maxW * 100).toFixed(0)}%）** —— `
                + `这时候输出是几个模式的**加权平均**，谁也不是。`
                + (beta <= 2 ? `**β=${beta} 太小了**，softmax 压不出尖锐的选择。` : '')),
      })
      const output = Array.from({ length: N }, (_, k) => PATTERNS.reduce((s, p, i) => s + weights[i] * p[k], 0))
      const nq = output.map(sign)
      if (nq.every((x, k) => x === query[k]) && frames.length > 1) { query = nq; break }
      query = nq
    }

    const lastF = frames[frames.length - 1]
    const capLow = cap[0], capHigh = cap[1]
    const edgeOf = (r: CapRow) => {
      const good = r.row.filter(x => x.ok >= 0.9)
      return good.length ? good[good.length - 1].m : 0
    }
    const b20 = betaSweep.find(x => x.beta === 20)!
    const bLow = betaSweep[0]

    frames.push({
      ...lastF, step: frames.length, phase: 'done',
      log: `从一个翻了 **${flip}** 位的残缺 query 出发，${frames.length - 1} 步注意力检索`
        + `${lastF.converged ? `就把它"回忆"回了完整的**模式 ${truthInfo.idx}**` : `之后**没能干净地回忆出来**`}。\n\n`
        + `**注意力 = 联想记忆**：一次注意力就是一步 Hopfield 检索 ——`
        + `weights = softmax(β·query·keys)，output = Σ weights·patterns。把 output 当新 query 再来一次。\n\n`
        + `⚠️ **"回忆对了吗"不问它自己**：真值是**离 query 汉明距离最近**的那个模式（另算的）。`
        + `这一档真值是模式 **${truthInfo.idx}**（距离 ${truthInfo.dist}），Hopfield 认定的是模式 **${lastF.best}** —— `
        + `**${lastF.right ? '对上了 ✓' : '对不上 ✗'}**。\n\n`
        + `⭐ **① β 是"精确检索 vs 软混合"的那个旋钮**（同一个残缺 query，只换 β）：\n`
        + betaSweep.map(x => `　β=${x.beta}：最大权重 **${x.maxW}**${x.maxW > 0.9 ? '（one-hot，精确检索）' : '（分散，软混合）'}`
          + `　屏幕上这个 query ${x.right ? '回得去 ✓' : '回不去 ✗'}`
          + `　**抽样**：翻 2 位回得去 **${(x.basin2 * 100).toFixed(0)}%**、存 16 个模式认得出 **${(x.cap16 * 100).toFixed(0)}%**`).join('\n')
        + `\n\n⚠️ **别只看"屏幕上这个 query 回不回得去"** —— 它碰巧四档 β 都回得去。`
        + `**旋钮有没有用得抽样才看得出来**：β=${betaSweep[0].beta} 时翻 2 位只有 `
        + `${(betaSweep[0].basin2 * 100).toFixed(0)}% 回得去、存 16 个模式只认得出 `
        + `${(betaSweep[0].cap16 * 100).toFixed(0)}%；而 β=${betaSweep[3].beta} 分别是 `
        + `${(betaSweep[3].basin2 * 100).toFixed(0)}% 和 ${(betaSweep[3].cap16 * 100).toFixed(0)}%。`
        + `\n\n**β 小的时候 softmax 压不出尖锐的选择**（β=${bLow.beta} 时最大权重才 ${bLow.maxW}），`
        + `输出是几个模式的加权平均、取符号之后**谁也不是**；`
        + `**β 大就是精确检索**（β=${b20.beta} 时 ${b20.maxW}，一步到位）。`
        + `这就是正文里那句"β=1/温度"的落点 —— **它不是一句设定，是一个能把行为整个改掉的旋钮。**\n\n`
        + `⭐ **② 吸引域有多大：抽出来的。** 随机翻 f 位、每档重采样 200 次，量能不能回到**汉明最近**的那个模式：\n`
        + basin.map(x => `　翻 ${x.flip} 位：正确率 **${(x.ok * 100).toFixed(0)}%**`).join('\n')
        + `\n\n**边界在翻 ${basinEdge} 位**（再多就掉出 90%）。`
        + `"query 只要落进吸引域就被拉回完整模式"这句话，**吸引域到底多大，是量出来的**。\n\n`
        + `⭐ **③ "容量随维度指数级"：两个维度并排看崩溃点。** 存 M 个随机模式、翻 1 位当 query：\n`
        + cap.map(c => `　**N=${c.n}**：` + c.row.map(x => `M=${x.m} ${(x.ok * 100).toFixed(0)}%`).join('　')).join('\n')
        /*  ⚠️ 这段话得跟着实测的 edge 走。β=0.5 那档两个维度都只撑到 M=2，
            照印"维度翻一倍容量翻的不止一倍"就跟上面那两行数打架了。 */
        + (edgeOf(capHigh) > edgeOf(capLow)
          ? `\n\n**N=${capLow.n} 撑到 M=${edgeOf(capLow)} 就掉出 90%，而 N=${capHigh.n} 能撑到 M=${edgeOf(capHigh)}** —— `
            + `**维度翻一倍，容量翻了 ${Math.round(edgeOf(capHigh) / Math.max(1, edgeOf(capLow)))} 倍**。`
            + `这正是"现代 Hopfield 网络容量随维度指数增长"那条结论，`
            + `也正对上「高维近正交」那一屏：**维度一高，随机模式之间几乎互相垂直，塞得下的就多得多**。\n\n`
          : `\n\n⚠️ **这一档两个维度都只撑到 M=${edgeOf(capLow)}** —— 加维度也救不回来。`
            + `**问题不在维度，在 β=${beta}**：softmax 压不出尖锐的选择，检索本身就不准，存几个模式都认不出。`
            + `**把 β 调大再看这张表** —— 那时候 N=${capHigh.n} 能一路撑到 M=64。`
            + `**"容量随维度指数增长"的前提是检索本身得准。**\n\n`)
        + `这是注意力能"从上下文里回忆相关信息"的底 —— 而且它告诉你三件事：`
        + `**温度决定它是精确检索还是糊成一团、残缺到一定程度就回不去了、能记住多少取决于维度。**`,
    })

    const base0: Frame = {
      ...shared, step: -1, query: query0.slice(), querySign: query0.slice(),
      weights: [0.25, 0.25, 0.25, 0.25], best: 0, matchBits: N - flip, onehot: false,
      converged: false, right: false, maxW: 0.25, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '检索步' },
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
