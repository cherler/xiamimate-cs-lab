/**
 * 内核：并查集 Union-Find（经典算法 · 把"谁和谁一伙"变成一棵树，认祖归宗只看根）
 * 轴：step —— 一串 union 把散点并成树，再用 find 顺父指针找根
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本自己的注释里写着两句话：
 *   「朴素合并会长出长链，find 要爬很久」
 *   「配合路径压缩 + 按秩合并，均摊近乎 O(1)」
 * 而屏幕上：**按秩合并一次都没出现过**，"近乎 O(1)"也**从没量过**；
 * 7 个点、链深 4，"爬很久"这件事根本疼不起来。只演成功的样子，等于没演。
 *
 * 这一版把两个优化各做成一个旋钮，再加一条**最坏操作序列**，然后：
 *
 * ① **屏幕上一直印着两个数**：当前最大树深、以及**全程 find 爬过的总步数** ——
 *    后者才是"快不快"的硬指标，深度只是它的表象。
 * ② **静默规模验证**：n = 8/16/32/64/128/256 各跑一遍同一串操作（只计数、不出帧），
 *    四种组合各得一条曲线，最小二乘出**实测增长指数**。
 *    朴素 + 不压缩 + 最坏序列是 **n²**；任一个优化就掉到近线性；两个都上最快。
 *    **"均摊近乎 O(1)"是那一列量出来的，不是写上去的。**
 * ③ 两个优化**各自都够用、但理由不同**：按秩合并从**源头**不让树长高，
 *    路径压缩是**事后**把爬过的链拍平。屏幕上把"最大深度"和"总步数"并排，
 *    才看得出这两件事不是一回事 —— 压缩后深度立刻塌，而按秩合并的深度从一开始就没高过。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const U_NAIVE = '朴素（谁在前挂谁）'
const U_RANK = '按秩合并（矮的挂高的）'
export const UF_UNIONS = [U_NAIVE, U_RANK] as const

const C_OFF = '不压缩'
const C_ON = '路径压缩（find 时全挂到根）'
export const UF_COMPRESS = [C_OFF, C_ON] as const

const S_CHAIN = '最坏序列（故意串成一条链）'
const S_RANDOM = '随机配对'
const S_PAIR = '两两归并（按秩合并的最坏情况）'
export const UF_SEQS = [S_CHAIN, S_RANDOM, S_PAIR] as const

/** 规模验证跑的这几个 n */
export const UF_SCALE_NS = [8, 16, 32, 64, 128, 256] as const

const N_ANIM = 10

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

/**
 * 造一串操作：先 n−1 次 union 把所有点并成一团，再对每个点各 find 一次。
 *
 * `最坏序列` 是 union(0,1), union(1,2), union(2,3)… —— 朴素合并下它会长成
 * **一条 n−1 深的链**，然后 n 次 find 每次都要从底爬到顶。这就是 O(n²)。
 */
function makeOps(seq: string, n: number): { unions: [number, number][]; finds: number[] } {
  if (seq === S_CHAIN) {
    return {
      unions: Array.from({ length: n - 1 }, (_, k) => [k, k + 1] as [number, number]),
      //  从最深的那一头开始查 —— 每次都爬满整条链
      finds: Array.from({ length: n }, (_, k) => k),
    }
  }
  if (seq === S_PAIR) {
    /*  两两归并：先 (0,1)(2,3)(4,5)… 再 (0,2)(4,6)… 再 (0,4)… 每一轮合并的都是**两棵一样高的树**。
        这是按秩合并的**最坏情况** —— 秩每轮 +1，树深长到 log₂n。
        加这一档是因为前两条序列里 union 的一边永远是个单点，
        按秩合并下所有点都直接挂到根上、**树深恒等于 1**：
        「按秩合并的树深是 O(log n)」这句话在那两条序列上根本量不出来，
        看着像"按秩合并 = 深度 1"，那是序列的巧合，不是算法的性质。 */
    const unions: [number, number][] = []
    for (let k = 1; k < n; k *= 2) for (let i = 0; i + k < n; i += 2 * k) unions.push([i, i + k])
    return { unions, finds: Array.from({ length: n }, (_, k) => n - 1 - k) }
  }
  const r = rng(20260909 + n)
  const perm = [...Array(n).keys()]
  for (let k = n - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [perm[k], perm[j]] = [perm[j], perm[k]] }
  const unions: [number, number][] = []
  for (let k = 1; k < n; k++) unions.push([perm[Math.floor(r() * k)], perm[k]])
  const finds = [...Array(n).keys()].sort(() => r() - 0.5)
  return { unions, finds }
}

// ═══════════════════════════════════════════════════════════════
//  并查集本体：出帧和只计数走同一份代码
// ═══════════════════════════════════════════════════════════════

/**
 * 出一帧。⚠️ **父指针由这里带出去。**
 * 第一版让调用方在外面**照着同样的规则手抄一遍**重放（为了拿到 parent 画树）——
 * 那正是快排那一轮刚警告过的坑：两条路一旦分开写，屏幕上画的树和曲线上量的步数
 * 可以悄悄变成两个算法，而没有任何东西会报错。真源只有 `runUF` 里的那个 `parent`。
 */
type Emit = (act: string, info: {
  a: number; b: number; ra: number; rb: number; path: number[]; root: number; merged: boolean; log: string
}, stat: { findSteps: number; maxDepth: number }, parent: number[]) => void

function runUF(n: number, unionKind: string, compress: string, seq: string, emit?: Emit) {
  const parent = Array.from({ length: n }, (_, i) => i)
  const rank = new Array(n).fill(0)
  const stat = { findSteps: 0, maxDepth: 0 }
  const byRank = unionKind === U_RANK
  const doCompress = compress === C_ON

  const depthOf = (x: number) => { let d = 0; while (parent[x] !== x) { x = parent[x]; d++ } return d }
  const refreshDepth = () => { stat.maxDepth = Math.max(...[...Array(n).keys()].map(depthOf)) }

  /**  find：顺父指针爬到根。**每爬一步都记一次** —— 这个计数是整个实验的硬指标。 */
  const find = (x: number, count: boolean) => {
    const path: number[] = []
    while (parent[x] !== x) { path.push(x); x = parent[x]; if (count) stat.findSteps++ }
    if (doCompress) for (const q of path) parent[q] = x
    return { root: x, path }
  }

  const { unions, finds } = makeOps(seq, n)
  for (const [a, b] of unions) {
    /*  ⚠️ union 内部的 find 也要**计入总步数**。不计的话「按秩合并」会白白占便宜：
        它省下的正是这些爬树的步数，而账不记在它头上，两档就比不出差别。 */
    const { root: ra, path: pa } = find(a, true)
    const { root: rb, path: pb } = find(b, true)
    const merged = ra !== rb
    if (merged) {
      if (byRank) {
        //  矮的挂高的；一样高就随便挂一个、被挂的那棵秩 +1
        if (rank[ra] < rank[rb]) parent[ra] = rb
        else if (rank[rb] < rank[ra]) parent[rb] = ra
        else { parent[rb] = ra; rank[ra]++ }
      } else {
        parent[ra] = rb          //  朴素：谁在前挂谁 —— 最坏序列下正好长成一条链
      }
    }
    refreshDepth()
    emit?.('union', { a, b, ra, rb, path: [...pa, ...pb], root: merged ? (parent[ra] === ra ? ra : rb) : ra, merged,
      log: `**union(${a},${b})**：${a} 的根是 ${ra}、${b} 的根是 ${rb}。` +
        (merged
          ? (byRank
            ? `按秩合并：秩 ${rank[ra]} vs ${rank[rb]}，**矮的挂高的**。`
            : `朴素合并：直接把根 ${ra} 挂到根 ${rb} 下 —— **不看谁高谁矮**。`) +
            `当前最大树深 **${stat.maxDepth}**。`
          : `已经同一个根，本就是一伙。`),
    }, stat, parent)
  }

  for (const x of finds) {
    const before = stat.findSteps
    const { root, path } = find(x, true)
    refreshDepth()
    emit?.(doCompress ? 'compress' : 'find', { a: x, b: -1, ra: root, rb: -1, path, root, merged: false,
      log: `**find(${x})**：顺父指针爬 ${stat.findSteps - before} 步到根 **${root}**` +
        (doCompress && path.length > 1
          ? `，再把沿途的 ${path.join('、')} **全部直接挂到根下** —— 链一下拍平，最大树深 ${stat.maxDepth}。`
          : `。${doCompress ? '' : '**不压缩**：这条链下次还得再爬一遍。'}`),
    }, stat, parent)
  }
  return { parent, findSteps: stat.findSteps, maxDepth: stat.maxDepth }
}

// ═══════════════════════════════════════════════════════════════

export type UnionFindState = {
  i: number
  step: number
  n: number
  parent: number[]
  act: string
  a: number; b: number
  ra: number; rb: number
  path: number[]
  root: number
  comps: number
  roots: number[]
  depths: number[]
  merged: boolean
  /** 到这一步为止 find 一共爬了多少步 —— "快不快"的硬指标 */
  findSteps: number
  /** 当前最大树深 */
  maxDepth: number
  unionKind: string
  compress: string
  seq: string
  /** 全程总步数 / 最终最大深度 */
  totalSteps: number
  finalDepth: number
  /** 规模验证：四种组合 × 几个 n，只计数不出帧 */
  scale: { unionKind: string; compress: string; rows: { n: number; steps: number; depth: number }[]; slope: number }[]
  /** 当前这一档的实测增长指数 */
  slope: number
  degraded: boolean
  phase: 'run' | 'done'
  log: string
}

export const UNIONFIND_VISIBLE = [
  'step', 'n', 'parent', 'act', 'a', 'b', 'ra', 'rb', 'path', 'root', 'comps', 'roots', 'depths',
  'findSteps', 'maxDepth', 'unionKind', 'compress', 'seq', 'totalSteps', 'finalDepth',
  'scale', 'slope', 'degraded', 'phase', 'log',
] as const

type Frame = Omit<UnionFindState, 'i'>

/** 对 (log n, log 步数) 做最小二乘，斜率就是"实际是几次方" */
function slopeOf(rows: { n: number; steps: number }[]): number {
  const lx = rows.map(r => Math.log(r.n))
  const ly = rows.map(r => Math.log(Math.max(1, r.steps)))
  const mx = lx.reduce((a, b) => a + b, 0) / lx.length
  const my = ly.reduce((a, b) => a + b, 0) / ly.length
  return +(lx.reduce((a, x, k) => a + (x - mx) * (ly[k] - my), 0)
    / lx.reduce((a, x) => a + (x - mx) ** 2, 0)).toFixed(2)
}

export const unionfindKernel: Kernel<UnionFindState> = {
  kind: 'unionfind',

  compile(doc: SimDocument): CompiledModel<UnionFindState> {
    const unionKind = String(doc.params.union ?? U_NAIVE)
    const compress = String(doc.params.compress ?? C_OFF)
    const seq = String(doc.params.seq ?? S_CHAIN)

    /*  ⭐ 规模验证：四种组合各跑一遍同一串操作。
        "均摊近乎 O(1)"和"朴素退化成 n²"都在这四条曲线上，不在旁白里。 */
    const scale = UF_UNIONS.flatMap(u => UF_COMPRESS.map(c => {
      const rows = UF_SCALE_NS.map(n => {
        const r = runUF(n, u, c, seq)
        return { n, steps: r.findSteps, depth: r.maxDepth }
      })
      return { unionKind: u, compress: c, rows, slope: slopeOf(rows) }
    }))
    const mine = scale.find(s => s.unionKind === unionKind && s.compress === compress)!
    const slope = mine.slope
    const degraded = slope > 1.5

    const N = N_ANIM
    const frames: Frame[] = []
    const shared = {
      n: N, unionKind, compress, seq, scale, slope, degraded,
      totalSteps: 0, finalDepth: 0,
    }
    //  先跑一遍拿总数（每一帧都带着，读数不用等到最后）
    const totals = runUF(N, unionKind, compress, seq)

    const findRoot = (p: number[], x: number) => { while (p[x] !== x) x = p[x]; return x }
    const depthIn = (p: number[], x: number) => { let d = 0; while (p[x] !== x) { x = p[x]; d++ } return d }

    runUF(N, unionKind, compress, seq, (act, info, stat, parent) => {
      frames.push({
        ...shared, totalSteps: totals.findSteps, finalDepth: totals.maxDepth,
        step: frames.length, parent: parent.slice(), act, ...info,
        depths: [...Array(N).keys()].map(x => depthIn(parent, x)),
        roots: [...Array(N).keys()].filter(x => parent[x] === x),
        comps: new Set([...Array(N).keys()].map(x => findRoot(parent, x))).size,
        findSteps: stat.findSteps, maxDepth: stat.maxDepth,
        phase: 'run', log: info.log,
      })
    })

    const lf = frames[frames.length - 1]
    const best = scale.reduce((a, b) => (last(b.rows).steps < last(a.rows).steps ? b : a), scale[0])
    const worst = scale.reduce((a, b) => (last(b.rows).steps > last(a.rows).steps ? b : a), scale[0])
    const bigN = UF_SCALE_NS[UF_SCALE_NS.length - 1]
    const table = scale.map(s =>
      `${s.unionKind === U_RANK ? '按秩' : '朴素'} + ${s.compress === C_ON ? '压缩' : '不压缩'}：` +
      `n=${bigN} 时 ${last(s.rows).steps} 步、树深 ${last(s.rows).depth}，增长指数 ${s.slope.toFixed(2)}`).join('\n')

    frames.push({
      ...shared, totalSteps: totals.findSteps, finalDepth: totals.maxDepth,
      step: frames.length, parent: lf ? lf.parent.slice() : [], act: 'done',
      a: -1, b: -1, ra: -1, rb: -1, path: [], root: lf ? lf.root : -1, merged: false,
      comps: lf ? lf.comps : 1, roots: lf ? lf.roots : [], depths: lf ? lf.depths : [],
      findSteps: totals.findSteps, maxDepth: totals.maxDepth, phase: 'done',
      log: `**走完了**（${unionKind} + ${compress}，${seq}）：n=${N} 时 find 一共爬了 **${totals.findSteps}** 步，最终最大树深 **${totals.maxDepth}**。\n\n` +
        `**规模验证**（同一串操作，n=${UF_SCALE_NS.join('/')} 各跑一遍，只计数不出帧）：\n${table}\n\n` +
        (degraded
          ? `⚠️ **这一档退化了**：实测增长指数 **${slope.toFixed(2)}**（线性是 1.0）—— 也就是 **O(n²)**。\n\n` +
            `原因就在树深那一列：朴素合并**不看谁高谁矮**，最坏序列下正好把树长成一条 ${last(mine.rows).depth} 深的链，` +
            `而每次 find 都要从底爬到顶。**"并查集很快"这句话，前提是这两个优化至少上一个。**\n\n` +
            `把「按秩合并」或「路径压缩」任意打开一个再看 —— 指数立刻掉到 1 附近。`
          : `实测增长指数 **${slope.toFixed(2)}**，接近线性 —— n 个操作总共 ${last(mine.rows).steps} 步，` +
            `**均摊下来每次操作是常数级**。这就是"近乎 O(1)"的实际含义。\n\n` +
            `⚠️ 注意它不是"每次 find 都一步到根"：${compress === C_ON ? '压缩是**事后**把爬过的链拍平，第一次爬那条链的钱照付；' : ''}` +
            `${unionKind === U_RANK ? '按秩合并是从**源头**不让树长高，' : ''}摊到 n 次操作上才是常数。`) + `\n\n` +
        `四种组合里最省的是 **${best.unionKind === U_RANK ? '按秩' : '朴素'} + ${best.compress === C_ON ? '压缩' : '不压缩'}**` +
        `（n=${bigN} 时 ${last(best.rows).steps} 步），最费的是 **${worst.unionKind === U_RANK ? '按秩' : '朴素'} + ${worst.compress === C_ON ? '压缩' : '不压缩'}**` +
        `（${last(worst.rows).steps} 步）—— 差 **${Math.round(last(worst.rows).steps / Math.max(1, last(best.rows).steps))} 倍**。\n\n` +
        /*  ⚠️ **这个实验量不到的那一格，要自己说出来。**
            课本说"只用一个优化是 O(log n)，两个都用才降到近乎常数"。而这张表上，
            开一个和开两个的步数**几乎一模一样** —— 因为 log₂256 = 8、α(256) ≤ 4，
            差距在这个规模上被常数吃掉了。**量不到就别假装量到了。** */
        (() => {
          const one = scale.filter(x => (x.unionKind === U_RANK) !== (x.compress === C_ON))
          const both = scale.find(x => x.unionKind === U_RANK && x.compress === C_ON)!
          const oneSteps = one.map(x => last(x.rows).steps)
          const close = Math.abs(Math.min(...oneSteps) - last(both.rows).steps) < last(both.rows).steps * 0.15
          return close
            ? `⚠️ **有一格这个实验量不出来**：课本说"只用一个优化是 O(log n)、两个都用才降到近乎常数"，` +
              `而表上开**一个**（${oneSteps.join(' / ')} 步）和开**两个**（${last(both.rows).steps} 步）几乎一模一样。\n\n` +
              `不是课本错了，是**规模不够**：log₂${bigN} = ${Math.log2(bigN)}，而反阿克曼 α(${bigN}) ≤ 4 —— ` +
              `这点差距被常数吃掉了。**量不到的东西就说量不到，别拿"看起来一样"当结论。**\n\n`
            : ''
        })() +
        `**两个优化各自都够用，但理由不同**：按秩合并从源头不让树长高（看树深那一列），路径压缩是事后把爬过的链拍平。` +
        `并查集是 Kruskal 最小生成树、网络连通性、账号合并、图像连通域的核心零件。`,
    })

    const base0: Frame = {
      ...shared, totalSteps: totals.findSteps, finalDepth: totals.maxDepth,
      step: -1, parent: Array.from({ length: N }, (_, i) => i), act: '', a: -1, b: -1, ra: -1, rb: -1,
      path: [], root: -1, comps: N, roots: [...Array(N).keys()], depths: new Array(N).fill(0),
      merged: false, findSteps: 0, maxDepth: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: 'union / find' },
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

const last = <T>(a: T[]) => a[a.length - 1]
