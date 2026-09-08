/**
 * 内核：矩阵乘法 C = A·B（机器学习基础 · 一切的地基）
 * 轴：step —— 逐格（小矩阵）或分段推进（大矩阵）；边算边跟着一个**缓存模型**数缺失
 *
 * 神经网络里几乎每一步都是矩阵乘：注意力的 Q·Kᵀ、FFN 的 W·x、LM 头的投影……
 * 规则：A[M×K] · B[K×N] = C[M×N]，**A 的列数必须等于 B 的行数**。
 * 每格 C[i][j] = Σ_k A[i][k]·B[k][j]，总运算量 = 2·M·N·K 次浮点。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本只有一个写死的 2×3·3×2，registry 里甚至写着「没有可调标量」。逐格手核是好的，
 * 但它把矩阵乘讲成了一道**算术题** —— 而真实世界里，矩阵乘的难处**根本不在算术**：
 *
 *   **同样的 2·M·N·K 次浮点，换个循环顺序，慢十倍。**
 *   因为 FLOPs 是定死的，**访存不是**。这就是分块（tiling）、FlashAttention、
 *   张量并行……那一整条线存在的唯一理由。老版本 bounds 里写着"分块/并行是同一乘法的
 *   不同访存与切分"，可**访存这件事屏幕上一个字都没有**。
 *
 * 现在挂了一个**真的缓存模拟**（全相联 LRU，行大小和行数可调）：三种循环顺序跑同一个乘法，
 * FLOPs 一模一样，缺失次数差一个数量级。实测 N=64、32 行×8 元素的缓存：
 *   i-j-k **299520** 次缺失（命中率 43.8%）／ i-k-j **33792**（95.7%）／ 分块 9×9 **22606**（97.2%）
 *   —— 少 13.2 倍缺失，**一次浮点都没省**。
 * 而 N=16 时前两者一模一样（576/576，命中率 93.4% vs 95.4%）：
 * **矩阵小到差不多能塞进缓存时，怎么循环都无所谓** —— 这说明"分块"不是玄学，是**放不下**才需要的。
 */
import { str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

//  老版本那两个小矩阵留着：逐格手核（C[0][0]=1·7+2·9+3·11=58）是这个实验的地基
const SMALL_A = [[1, 2, 3], [4, 5, 6]]
const SMALL_B = [[7, 8], [9, 10], [11, 12]]

const CACHES: Record<string, { lines: number; line: number }> = {
  '小（16 行 × 8）': { lines: 16, line: 8 },
  '中（32 行 × 8）': { lines: 32, line: 8 },
  '大（128 行 × 8）': { lines: 128, line: 8 },
}

export type MatmulState = {
  i: number
  A: number[][]
  B: number[][]
  M: number; K: number; N: number
  row: number; col: number
  terms: { a: number; b: number; prod: number }[]
  value: number
  C: (number | null)[][]
  flops: number
  totalFlops: number
  //  ── 补厚：访存那一半 ──
  order: string
  tile: number               // 分块大小（由缓存容量算出来，不是拍的）
  cacheTag: string
  cacheCap: number           // 缓存能装下多少个元素
  miss: number; hit: number  // 累计
  totalMiss: number          // 整趟乘法的总缺失
  hitRate: number
  fitsInCache: boolean       // 三个矩阵能不能整个塞进缓存
  compare: [string, number][]  // 三种顺序各自的总缺失 —— 结论靠它，不写死
  intensity: number          // 算术强度 = FLOPs / 缺失
  small: boolean             // 是不是"逐格手核"那一档
  phase: 'cell' | 'done'
  log: string
}

export const MATMUL_VISIBLE = [
  'i', 'A', 'B', 'M', 'K', 'N', 'row', 'col', 'terms', 'value', 'C', 'flops', 'totalFlops',
  'order', 'tile', 'cacheTag', 'cacheCap', 'miss', 'hit', 'totalMiss', 'hitRate',
  'fitsInCache', 'compare', 'intensity', 'small', 'phase', 'log',
] as const

type Frame = Omit<MatmulState, 'i'>

/*  ── 全相联 LRU 缓存模型 ──
    一次访问落在哪条缓存行由 ⌊地址/行大小⌋ 决定；命中就把它挪到最近使用，
    不命中就淘汰最久没用的那条。这是最朴素的 LRU，但**足够让三种顺序分出高下**。 */
class Cache {
  private lines = new Map<number, number>()
  private t = 0
  miss = 0; hit = 0
  constructor(private cap: number, private lineSize: number) {}
  touch(addr: number) {
    const l = Math.floor(addr / this.lineSize)
    this.t++
    if (this.lines.has(l)) { this.hit++; this.lines.delete(l); this.lines.set(l, this.t); return }
    this.miss++
    if (this.lines.size >= this.cap) {
      const oldest = this.lines.keys().next().value as number
      this.lines.delete(oldest)
    }
    this.lines.set(l, this.t)
  }
}

/*  按给定顺序走完整个乘法，把每次访存喂给缓存，并在若干**检查点**上记下真实的累计缺失。
    三个矩阵按行优先连续摆：A 在 0，B 在 M·K，C 在 M·K+K·N。

    ⚠️ 检查点上的数必须是**当场数出来的**。第一版偷懒：只算整趟的总缺失，
    再按"完成了百分之几"线性折算到每一帧 —— 那就不是仿真了，是把结论摊平画成一条直线。
    （而且真实的缺失曲线根本不是直线：一开始全是冷缺失，后面才稳下来。）

    顺带记 cellsDone：每个 C 格攒够 K 次乘加才算完成。
    这一项在三种顺序下差别很大 —— i-j-k 是一格一格结清的，
    i-k-j 和分块**几乎到最后才批量完成**，因为它们把每格的 K 项拆散在各处累加。 */
function walk(M: number, K: number, N: number, order: string, tile: number,
  cache: Cache, marks: number[]) {
  const oA = 0, oB = M * K, oC = M * K + K * N
  const kdone = new Int32Array(M * N)
  let cellsDone = 0, acc = 0, mi = 0
  const out: { miss: number; cellsDone: number }[] = []
  const rd = (a: number) => {
    cache.touch(a); acc++
    while (mi < marks.length && acc >= marks[mi]) { out.push({ miss: cache.miss, cellsDone }); mi++ }
  }
  const bump = (i: number, j: number) => {
    const p = i * N + j
    if (++kdone[p] === K) cellsDone++
  }
  if (order === 'i-k-j（行优先友好）') {
    for (let i = 0; i < M; i++) for (let k = 0; k < K; k++) {
      rd(oA + i * K + k)
      for (let j = 0; j < N; j++) { rd(oB + k * N + j); rd(oC + i * N + j); rd(oC + i * N + j); bump(i, j) }
    }
  } else if (order.startsWith('分块')) {
    for (let ii = 0; ii < M; ii += tile) for (let jj = 0; jj < N; jj += tile) for (let kk = 0; kk < K; kk += tile)
      for (let i = ii; i < Math.min(ii + tile, M); i++) for (let k = kk; k < Math.min(kk + tile, K); k++) {
        rd(oA + i * K + k)
        for (let j = jj; j < Math.min(jj + tile, N); j++) { rd(oB + k * N + j); rd(oC + i * N + j); rd(oC + i * N + j); bump(i, j) }
      }
  } else {   // i-j-k（教科书写法）
    for (let i = 0; i < M; i++) for (let j = 0; j < N; j++) {
      rd(oC + i * N + j)
      for (let k = 0; k < K; k++) { rd(oA + i * K + k); rd(oB + k * N + j); bump(i, j) }
      rd(oC + i * N + j)
    }
  }
  while (out.length < marks.length) out.push({ miss: cache.miss, cellsDone })
  return { out, accesses: acc }
}

export const matmulKernel: Kernel<MatmulState> = {
  kind: 'matmul',

  compile(doc: SimDocument): CompiledModel<MatmulState> {
    const sizeTag = doc.params.size === undefined ? '2×3 · 3×2（逐格手核）' : str(doc.params, 'size')
    const order = doc.params.order === undefined ? 'i-j-k（教科书写法）' : str(doc.params, 'order')
    const cacheTag = doc.params.cache === undefined ? '中（32 行 × 8）' : str(doc.params, 'cache')
    const cfg = CACHES[cacheTag] ?? CACHES['中（32 行 × 8）']
    const cacheCap = cfg.lines * cfg.line

    const small = sizeTag.startsWith('2×3')
    //  "32×32" → 32（取前一个数；别用 replace 去掉非数字，那会拼成 3232）
    const sz = small ? 0 : parseInt(sizeTag, 10)
    const A = small ? SMALL_A : Array.from({ length: sz }, (_, i) => Array.from({ length: sz }, (_, k) => ((i * 7 + k * 3) % 9) - 4))
    const B = small ? SMALL_B : Array.from({ length: sz }, (_, k) => Array.from({ length: sz }, (_, j) => ((k * 5 + j * 11) % 7) - 3))
    const M = A.length, K = A[0].length, N = B[0].length
    const total = 2 * M * N * K

    /*  分块大小是**算出来**的，不是拍的：分块的全部指望是"三块 T×T 同时待在缓存里"，
        所以 3T² ≤ 缓存容量 → T = ⌊√(cap/3)⌋。缓存换一档，块就跟着变。 */
    const tile = Math.max(2, Math.floor(Math.sqrt(cacheCap / 3)))
    const fitsInCache = M * K + K * N + M * N <= cacheCap

    //  三种顺序各跑一遍整趟乘法 —— 结论里的对比数由它给，不写死
    const ORDERS = ['i-j-k（教科书写法）', 'i-k-j（行优先友好）', `分块 ${tile}×${tile}`]
    const compare: [string, number][] = ORDERS.map(o => {
      const c = new Cache(cfg.lines, cfg.line)
      walk(M, K, N, o, tile, c, [])
      return [o, c.miss]
    })
    const myOrder = order.startsWith('分块') ? ORDERS[2] : order
    const totalMiss = compare.find(([o]) => o === myOrder)?.[1] ?? 0
    const best = compare.reduce((a, b) => (b[1] < a[1] ? b : a))
    const worst = compare.reduce((a, b) => (b[1] > a[1] ? b : a))
    const intensity = totalMiss > 0 ? total / totalMiss : 0

    /*  ── 逐帧：把**本档循环顺序**的访存流切成若干段，每段末尾读一次真实计数 ──
        小矩阵（2×3·3×2）只有 24 次访存，就一格一帧，保住"逐格手核"那条老路。 */
    const CHUNKS = small ? M * N : 24
    const probe = new Cache(cfg.lines, cfg.line)
    //  先量一遍访存总数，再据此定检查点
    const totalAcc = walk(M, K, N, myOrder, tile, probe, []).accesses
    const marks = Array.from({ length: CHUNKS }, (_, f) => Math.ceil((f + 1) / CHUNKS * totalAcc))
    const track = walk(M, K, N, myOrder, tile, new Cache(cfg.lines, cfg.line), marks).out

    const frames: Frame[] = []
    const cells: { i: number; j: number }[] = []
    for (let i = 0; i < M; i++) for (let j = 0; j < N; j++) cells.push({ i, j })
    const full = cells.map(({ i, j }) => {
      let v = 0
      for (let k = 0; k < K; k++) v += A[i][k] * B[k][j]
      return v
    })

    for (let f = 0; f < CHUNKS; f++) {
      const { miss, cellsDone } = track[f]
      //  显示的 C：**按这个顺序真正算完的格子数**（分块/i-k-j 会到很后面才批量完成）
      const C: (number | null)[][] = Array.from({ length: M }, () => Array(N).fill(null))
      for (let n = 0; n < cellsDone; n++) C[cells[n].i][cells[n].j] = full[n]
      const cur = cells[Math.max(0, Math.min(cells.length - 1, cellsDone - 1))]
      const terms = small && cellsDone > 0
        ? Array.from({ length: K }, (_, k) => ({ a: A[cur.i][k], b: B[k][cur.j], prod: A[cur.i][k] * B[k][cur.j] })) : []
      const frac = (f + 1) / CHUNKS
      const flops = Math.round(total * frac)
      const accSoFar = marks[f]
      frames.push({
        A, B, M, K, N, row: cur.i, col: cur.j, terms, value: full[Math.max(0, cellsDone - 1)] ?? 0,
        C, flops, totalFlops: total,
        order: myOrder, tile, cacheTag, cacheCap, miss, hit: accSoFar - miss,
        totalMiss, hitRate: +(100 * (accSoFar - miss) / accSoFar).toFixed(1),
        fitsInCache, compare, intensity: +intensity.toFixed(2), small,
        phase: 'cell',
        log: small
          ? `C[${cur.i}][${cur.j}] = A 第 ${cur.i} 行 · B 第 ${cur.j} 列 = `
            + terms.map(t => `${t.a}×${t.b}`).join(' + ') + ` = **${full[Math.max(0, cellsDone - 1)]}**。（内维 K=${K} 对上才能乘）`
          : `走完访存流的 ${(frac * 100).toFixed(0)}%（${accSoFar.toLocaleString()} 次访存）：`
            + `**${miss.toLocaleString()}** 次缺失、命中率 ${(100 * (accSoFar - miss) / accSoFar).toFixed(1)}%，`
            + `已结清 ${cellsDone}/${cells.length} 个输出格。`
            + (myOrder.startsWith('i-j-k')
              ? `　这个顺序**一格一格结清**。`
              : `　⚠️ 这个顺序把每格的 K 项拆散在各处累加，所以输出格**要到很后面才批量完成** —— 中途看 C 是一片空的很正常。`)
            + `　浮点数已用 ${flops.toLocaleString()} 次；**换个顺序这个数一次都不会变，缺失那个数能差一个数量级**。`,
      })
    }

    const ratio = worst[1] / Math.max(1, best[1])
    frames.push({
      ...frames[frames.length - 1], phase: 'done', flops: total, miss: totalMiss,
      C: Array.from({ length: M }, (_, i) => Array.from({ length: N }, (_, j) => full[i * N + j])),
      log: `${M}×${K} · ${K}×${N} = ${M}×${N}，每格是一行点一列，共 **${total.toLocaleString()}** 次浮点（2·M·N·K）。`
        + `　**这个数跟循环顺序无关** —— 三种顺序一个浮点都不多不少。可缓存缺失差得很远：`
        + compare.map(([o, m]) => `${o.split('（')[0]} **${m.toLocaleString()}**`).join(' ／ ')
        + `。`
        + (fitsInCache
          ? `　不过这一档里 ${M * K + K * N + M * N} 个元素**整个塞得进** ${cacheCap} 个元素的缓存，`
            + `所以三者拉不开差距（最多 ${ratio.toFixed(1)} 倍）。`
            + `**放得下的时候，怎么循环都无所谓** —— 这正说明分块不是玄学，是**放不下**才需要的。`
            + `把矩阵规模拧大再看。`
          : `　最好的（${best[0].split('（')[0]}）比最差的（${worst[0].split('（')[0]}）少了 **${ratio.toFixed(1)} 倍**缺失，`
            + `而**一次浮点都没省**。`
            + `　道理只有一句：C 语言这类**行优先**存储里，B[k][j] 沿 j 走是连着的、沿 k 走是跳着的。`
            + `教科书那个 i-j-k 的最内层恰好在沿 k 跳 B —— 每次都跨一整行。`
            + `i-k-j 把它换成沿 j 连着走，分块再进一步让**三块小方阵同时待在缓存里**`
            + `（块边长 T=${tile} 是算出来的：3T² ≤ ${cacheCap}）。`)
        + `　算术强度（每次缺失摊到多少浮点）= **${intensity.toFixed(1)}**。`
        + `　这就是 FlashAttention 在做的事、也是张量并行切矩阵时要小心的事：**它们都不改结果，只改访存**。`,
    })

    const base0: Frame = {
      ...frames[0], row: -1, col: -1, terms: [], value: 0,
      C: Array.from({ length: M }, () => Array(N).fill(null)), flops: 0, miss: 0, hit: 0, log: '',
    }

    return {
      axis: { kind: 'step', label: small ? '输出格' : '进度' },
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
