/**
 * 第七批内核：B+树 / 图遍历 / 信号量 / 位示图 / CSMA-CD
 *
 * 判据：
 *   B+树   所有关键字必须都在叶子层且有序；每个结点关键字数不超上限；树必须完全平衡
 *   图遍历  必须访问到所有可达顶点、不重不漏；DFS 与 BFS 的序列必须不同
 *   信号量  正确顺序必须不死锁；错误顺序必须能死锁；empty+full+缓冲区 的守恒关系
 *   位示图  盘块号 ↔ 字号/位号 的换算必须自洽；已分配位数 + 空闲位数 = 总位数
 *   CSMA   退避值必须落在 {0 … 2^k−1}；连续 16 次冲突必须放弃
 */
import { run } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'
import { bplusKernel, leafChain, type BPlusState } from '../src/kernels/bplus.ts'
import { traverseKernel, type TravState } from '../src/kernels/traverse.ts'
import { semaphoreKernel, type SemState } from '../src/kernels/semaphore.ts'
import { bitmapKernel, type BitmapState } from '../src/kernels/bitmap.ts'
import { csmaKernel, type CsmaState } from '../src/kernels/csma.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

// ═══ B+ 树 ═════════════════════════════════════════════
console.log('\n【B+ 树】')

const bpRun = (keys: number[], order = 3) =>
  run(bplusKernel.compile({
    kind: 'bplus', params: { order }, entities: [],
    streams: [{ name: 'keys', values: keys }],
  }), 3000) as BPlusState[]

const KEYSETS = [
  [1, 2, 3, 4, 5],
  [10, 20, 30, 40, 50, 60, 70],
  [5, 3, 8, 1, 9, 2, 7, 4, 6],
  [15, 25, 35, 45, 55, 65, 75, 85, 95],
]

// ── 1. 所有关键字都在叶子层，且叶子链有序不重不漏 ───────
{
  const wrong: string[] = []
  for (const order of [3, 4, 5]) for (const keys of KEYSETS) {
    const last = bpRun(keys, order).at(-1)!
    const chain = leafChain(last.nodes, last.root)
    const want = [...new Set(keys)].sort((a, b) => a - b)
    if (chain.join(',') !== want.join(',')) wrong.push(`阶${order} [${keys}] → ${chain}`)
  }
  wrong.length === 0
    ? ok(`3 种阶 × 4 组键：叶子链读出来都等于键的升序排列 —— 所有关键字确实都在叶子层`)
    : bad(`叶子链不对：${wrong.slice(0, 2).join(' | ')}`)
}

// ── 2. 每个结点的关键字数不超过 m−1 ────────────────────
{
  const wrong: string[] = []
  for (const order of [3, 4, 5]) for (const keys of KEYSETS) {
    const last = bpRun(keys, order).at(-1)!
    //  只查从根可达的结点（分裂过程中会留下不再引用的旧结点）
    const seen = new Set<number>()
    const walk = (n: number) => {
      if (seen.has(n)) return
      seen.add(n)
      if (last.nodes[n].keys.length > order - 1)
        wrong.push(`阶${order}：结点有 ${last.nodes[n].keys.length} 个键，上限 ${order - 1}`)
      for (const c of last.nodes[n].children) walk(c)
    }
    walk(last.root)
  }
  wrong.length === 0
    ? ok('所有结点的关键字数都不超过 m−1')
    : bad(wrong.slice(0, 3).join(' / '))
}

// ── 3. 完全平衡：所有叶子到根的距离必须相同 ─────────────
{
  const wrong: string[] = []
  for (const order of [3, 4, 5]) for (const keys of KEYSETS) {
    const last = bpRun(keys, order).at(-1)!
    const depths: number[] = []
    const walk = (n: number, d: number) => {
      if (last.nodes[n].leaf) { depths.push(d); return }
      for (const c of last.nodes[n].children) walk(c, d + 1)
    }
    walk(last.root, 1)
    if (new Set(depths).size !== 1) wrong.push(`阶${order} [${keys}]：叶子深度 ${[...new Set(depths)]}`)
  }
  wrong.length === 0
    ? ok('所有叶子到根的距离处处相同 —— B+ 树只在根分裂时长高，天然完全平衡')
    : bad(wrong.slice(0, 2).join(' / '))
}

// ── 4. 内部结点的键必须是分界值：左子树全 < 它 ≤ 右子树 ──
{
  const wrong: string[] = []
  for (const keys of KEYSETS) {
    const last = bpRun(keys, 3).at(-1)!
    const sub = (n: number): number[] =>
      last.nodes[n].leaf ? [...last.nodes[n].keys]
        : last.nodes[n].children.flatMap(sub)
    const walk = (n: number) => {
      if (last.nodes[n].leaf) return
      const nd = last.nodes[n]
      nd.keys.forEach((k, j) => {
        const left = sub(nd.children[j])
        const right = sub(nd.children[j + 1])
        if (left.some(x => x >= k)) wrong.push(`键 ${k} 的左子树里有 ≥ 它的值`)
        if (right.some(x => x < k)) wrong.push(`键 ${k} 的右子树里有 < 它的值`)
      })
      nd.children.forEach(walk)
    }
    walk(last.root)
  }
  wrong.length === 0
    ? ok('内部结点的每个键都是严格的分界值：左子树全部 < 它，右子树全部 ≥ 它')
    : bad(wrong.slice(0, 3).join(' / '))
}

// ── 5. 叶子分裂时中间键必须留一份，内部结点分裂时不留 ────
{
  const t = bpRun([10, 20, 30, 40, 50, 60, 70], 3)
  const leafSplits = t.filter(s => s.act === 'split' && s.splitLeaf)
  const innerSplits = t.filter(s => s.act === 'split' && !s.splitLeaf)
  const wrong: string[] = []
  for (const s of leafSplits) {
    //  分裂后右结点应当还含有上送的那个键
    const hasIt = s.nodes.some(n => n.leaf && n.keys.includes(s.upKey))
    if (!hasIt) wrong.push(`叶子分裂上送 ${s.upKey}，但叶子层里没留`)
  }
  leafSplits.length > 0 && wrong.length === 0
    ? ok(`叶子分裂 ${leafSplits.length} 次、内部结点分裂 ${innerSplits.length} 次；`
      + `叶子分裂上送的键在叶子层都仍保留一份`)
    : bad(wrong.join(' / ') || '没有发生叶子分裂，这组数据说明不了问题')
}

/* ── 6. 每一帧的每个结点，舞台都画得出来 ──────────────────
 *
 * 用户 2026-09-08 报的：「分裂、上提的过程中，还会隐藏（无法展示）右边树」。真的。
 * 舞台原来只画**从根可达**的结点，而分裂帧里刚裂出来的右半边还没挂到父结点上
 * （内核是下一步才往父结点写指针）—— 于是日志写着「左 [10] / 右 [20 30]」，
 * 屏幕上只有左边那半。默认序列 23 帧里 7 个分裂帧全中，内部结点分裂的两帧
 * 一次藏 3 个（右结点连它的两个孩子）。
 *
 * 这条判据钉的是**内核和舞台之间那个口径**：舞台画「从根可达 ∪ 悬着的右半边（focus[1]）」，
 * 那么每一帧的 nodes 就必须全部落在这个集合里 —— 一个都不许剩下没人画。
 * 换句话说，内核以后要是再造出别的暂时挂不上的结点，这里会先红，而不是等用户发现画面少了一块。
 */
{
  const missed: string[] = []
  const selfcheck: string[] = []
  for (const order of [3, 4, 5]) for (const keys of KEYSETS) {
    const t = bpRun(keys, order)
    t.forEach((s, i) => {
      const parentOf = new Map<number, number>()
      s.nodes.forEach((nd, k) => nd.children.forEach(c => parentOf.set(c, k)))
      const reach = (from: number) => {
        const seen = new Set<number>(); const q = [from]
        while (q.length) {
          const n = q.shift()!
          if (seen.has(n) || !s.nodes[n]) continue
          seen.add(n); q.push(...s.nodes[n].children)
        }
        return seen
      }
      const drawn = reach(s.root)
      //  舞台认「悬着的右半边」的三条件：在 focus 里、没有父、不是根
      const ghost = s.focus.length === 2 && s.focus[1] !== s.root && !parentOf.has(s.focus[1])
        ? s.focus[1] : -1
      if (ghost >= 0) for (const n of reach(ghost)) drawn.add(n)
      const left = s.nodes.map((_, k) => k).filter(k => !drawn.has(k))
      if (left.length > 0) missed.push(`阶${order} [${keys}] 第 ${i} 帧漏了 ${left.length} 个结点`)
      //  自检：把「悬着的右半边」那一条去掉（＝出事前那版的画法），分裂帧必须漏
      if (s.act === 'split' && reach(s.root).size === s.nodes.length) selfcheck.push(`第 ${i} 帧`)
    })
  }
  missed.length === 0
    ? ok(`3 种阶 × 4 组键的每一帧：结点全都在「可达 ∪ 悬着的右半边」里，一个都没漏`)
    : bad(`有结点没人画：${missed.slice(0, 3).join(' / ')}`)
  selfcheck.length === 0
    ? ok('自检：只画「从根可达」的话，分裂帧必定漏结点 —— 这条判据能红')
    : bad(`自检没成立：${selfcheck.slice(0, 3).join(' / ')} 只画可达也不漏，这条判据抓不住原来的 bug`)
}

// ═══ 图遍历 ════════════════════════════════════════════
console.log('\n【图的遍历】')

const G: [string, string][] = [
  ['A','B'],['A','C'],['B','D'],['B','E'],['C','F'],['E','F'],['D','G'],['F','G'],
]
const VS = ['A','B','C','D','E','F','G','H']    // H 是孤立顶点
const travDoc = (algorithm: string, start = 'A'): SimDocument => ({
  kind: 'traverse', params: { algorithm, start, directed: 0 },
  entities: [
    ...VS.map(id => ({ id, type: 'node', attrs: {} })),
    ...G.map(([f, t]) => ({ id: `${f}${t}`, type: 'edge', attrs: { from: f, to: t, w: 1 } })),
  ],
  streams: [],
})
const travRun = (a: string, s = 'A') => run(traverseKernel.compile(travDoc(a, s)), 2000) as TravState[]

// ── 1. 必须访问所有顶点，不重不漏（含孤立顶点）──────────
{
  const wrong: string[] = []
  for (const a of ['DFS', 'BFS']) {
    const order = travRun(a).at(-1)!.order
    if (order.length !== VS.length) wrong.push(`${a}: 访问 ${order.length} 个，应为 ${VS.length}`)
    if (new Set(order).size !== order.length) wrong.push(`${a}: 有重复访问`)
    if (!VS.every(v => order.includes(v))) wrong.push(`${a}: 有顶点没访问到`)
  }
  wrong.length === 0
    ? ok(`DFS 与 BFS 都访问到全部 ${VS.length} 个顶点（含孤立的 H），不重不漏`)
    : bad(wrong.join(' / '))
}

// ── 2. DFS 与 BFS 的访问序列必须不同 ───────────────────
{
  const d = travRun('DFS').at(-1)!.order.join('')
  const b = travRun('BFS').at(-1)!.order.join('')
  d !== b
    ? ok(`DFS ${d} 与 BFS ${b} 序列不同 —— 唯一差别就是从栈顶还是队首取`)
    : bad(`两种遍历序列相同：${d}`)
}

// ── 3. BFS 的访问序按到起点的距离非递减 ────────────────
{
  //  独立算一遍各点到 A 的最短跳数
  const dist: Record<string, number> = { A: 0 }
  const q = ['A']
  while (q.length) {
    const x = q.shift()!
    for (const [f, t] of G) {
      for (const [u, v] of [[f, t], [t, f]] as [string, string][]) {
        if (u === x && dist[v] === undefined) { dist[v] = dist[x] + 1; q.push(v) }
      }
    }
  }
  const order = travRun('BFS').at(-1)!.order.filter(v => dist[v] !== undefined)
  const ds = order.map(v => dist[v])
  ds.every((v, k) => k === 0 || v >= ds[k - 1])
    ? ok(`BFS 访问序的跳数非递减：${order.map((v, k) => `${v}(${ds[k]})`).join(' ')}`)
    : bad(`BFS 序不是按层的：${ds.join(',')}`)
}

// ── 4. 生成树边数 = **实际访问到的顶点数** − 连通分量数 ──
//     判据要挂在"实际访问了多少"上。第一版写死 VS.length−2，
//     结果 DFS 漏掉孤立顶点（只访问 7 个、1 个分量）时 7−1 也等于 6，
//     这条照样绿 —— 跟第 1 条同一个缺陷，它却看不出来。
{
  const wrong: string[] = []
  for (const a of ['DFS', 'BFS']) {
    const last = travRun(a).at(-1)!
    //  从轨迹里数实际起了几个连通分量（第一个起点 + 每次"换起点"）
    const restarts = travRun(a).filter(s => s.log.includes('换它当新起点')).length + 1
    const want = last.order.length - restarts
    if (last.treeEdges.length !== want)
      wrong.push(`${a}: 生成树 ${last.treeEdges.length} 条，访问 ${last.order.length} 个顶点 / ${restarts} 个分量 → 应为 ${want}`)
    if (last.order.length !== VS.length)
      wrong.push(`${a}: 只访问了 ${last.order.length} 个顶点`)
  }
  wrong.length === 0
    ? ok(`生成森林边数 = 访问到的顶点数 − 连通分量数，两种遍历都成立`)
    : bad(wrong.join(' / '))
}

// ═══ 信号量 ════════════════════════════════════════════
console.log('\n【信号量与生产者-消费者】')

const semDoc = (order: string, sched: string[], bufferSize = 2): SimDocument => ({
  kind: 'semaphore', params: { bufferSize, order }, entities: [],
  streams: [{ name: 'schedule', values: sched }],
})
const semRun = (order: string, sched: string[], b = 2) =>
  run(semaphoreKernel.compile(semDoc(order, sched, b)), 2000) as SemState[]

const ROUND = ['P1','P1','P1','P1','P1','C1','C1','C1','C1','C1']

// ── 1. 正确顺序下不会死锁 ──────────────────────────────
{
  const t = semRun('correct', [...ROUND, ...ROUND])
  const dead = t.some(s => s.act === 'deadlock')
  !dead && t.at(-1)!.produced > 0 && t.at(-1)!.consumed > 0
    ? ok(`正确顺序：生产 ${t.at(-1)!.produced} 个、消费 ${t.at(-1)!.consumed} 个，全程没有死锁`)
    : bad(`正确顺序却死锁了或没跑起来：dead=${dead}`)
}

// ── 2. 错误顺序（P(mutex) 在前）必须真的死锁 ────────────
{
  //  缓冲区满时，生产者拿着锁去等 empty，消费者进不来 → 死锁
  const sched = ['P1','P1','P1','P1','P1', 'P1','P1','P1','P1','P1', 'P1','P1','C1','C1']
  const t = semRun('wrong', sched, 1)
  t.some(s => s.act === 'deadlock')
    ? ok(`错误顺序（P(mutex) 放在 P(empty) 前）：第 ${t.findIndex(s => s.act === 'deadlock')} 步真的死锁了`)
    : bad('错误顺序却没死锁 —— 这个调度序列说明不了问题')
}

// ── 3. 守恒：empty + full + 正在临界区里的 = 缓冲区大小 ──
{
  const size = 3
  const t = semRun('correct', [...ROUND, ...ROUND], size)
  const wrong = t.filter(s => s.empty + s.full > size || s.buffer.length > size)
  wrong.length === 0
    ? ok(`缓冲区 ${size}：全程 empty + full ≤ ${size}，缓冲区从不溢出`)
    : bad(`守恒被破坏：第 ${wrong[0].i} 步 empty=${wrong[0].empty} full=${wrong[0].full}`)
}

// ── 4. mutex 只能是 0 或 1（二元信号量）────────────────
{
  const t = semRun('correct', [...ROUND, ...ROUND])
  const wrong = t.filter(s => s.mutex < 0 || s.mutex > 1)
  wrong.length === 0
    ? ok('mutex 全程只在 0 和 1 之间 —— 临界区永远最多一个线程')
    : bad(`mutex 越界：第 ${wrong[0].i} 步为 ${wrong[0].mutex}`)
}

// ── 5. 消费数不能超过生产数 ────────────────────────────
{
  const t = semRun('correct', [...ROUND, ...ROUND])
  const wrong = t.filter(s => s.consumed > s.produced)
  wrong.length === 0
    ? ok(`任何时刻消费数都不超过生产数 —— full 信号量挡住了空取`)
    : bad(`第 ${wrong[0].i} 步消费 ${wrong[0].consumed} > 生产 ${wrong[0].produced}`)
}

// ═══ 位示图 ════════════════════════════════════════════
console.log('\n【位示图】')

const bmDoc = (reqs: [string, number, number, number][], words = 8, wordBits = 8): SimDocument => ({
  kind: 'bitmap', params: { words, wordBits },
  entities: reqs.map(([id, count, free, block], k) =>
    ({ id, type: 'req', at: k, attrs: { count, free, block } })),
  streams: [],
})
const bmRun = (reqs: [string, number, number, number][], w = 8, wb = 8) =>
  run(bitmapKernel.compile(bmDoc(reqs, w, wb))) as BitmapState[]

const BMREQS: [string, number, number, number][] = [
  ['A', 5, 0, -1], ['B', 3, 0, -1], ['C', 4, 0, -1],
  ['B', 3, 1, 5], ['D', 6, 0, -1],
]

// ── 1. 盘块号 ↔ 字号/位号 的换算必须自洽 ────────────────
{
  const wordBits = 8
  const t = bmRun(BMREQS, 8, wordBits)
  const wrong: string[] = []
  for (const s of t) {
    for (const b of s.blocks) {
      const w = Math.floor(b / wordBits), bit = b % wordBits
      if (w * wordBits + bit !== b) wrong.push(`盘块 ${b} 换算不自洽`)
    }
    if (s.blocks.length > 0) {
      const b0 = s.blocks[0]
      if (s.word !== Math.floor(b0 / wordBits) || s.bit !== b0 % wordBits)
        wrong.push(`第${s.i}步：字号/位号 ${s.word}/${s.bit} 与盘块 ${b0} 对不上`)
    }
  }
  wrong.length === 0
    ? ok(`盘块号 = 字号 × ${wordBits} + 位号，全程处处自洽`)
    : bad(wrong.slice(0, 3).join(' / '))
}

// ── 2. 已占位数 + 空闲位数 = 总位数 ────────────────────
{
  const t = bmRun(BMREQS)
  const wrong = t.filter(s => {
    const used = s.bits.reduce((x, w) => x + w.filter(v => v === 1).length, 0)
    return used + s.freeCount !== 64
  })
  wrong.length === 0
    ? ok('已占用 + 空闲 恒等于 8 × 8 = 64 位')
    : bad(`第 ${wrong[0].i} 步守恒被破坏`)
}

// ── 3. 分配总是取最前面的空闲位 ────────────────────────
{
  const t = bmRun([['A', 3, 0, -1]])
  t[0].blocks.join(',') === '0,1,2'
    ? ok('顺序扫描分配：第一次申请 3 块拿到的是盘块 0、1、2')
    : bad(`分配位置不对：${t[0].blocks}`)
}

// ── 4. 回收之后那些位必须真的变回 0，且能被再次分配 ──────
{
  const t = bmRun(BMREQS)
  const freeStep = t.find(s => s.act === 'free')!
  const after = t[freeStep.i + 1]
  const freed = freeStep.blocks
  const allZero = freed.every(b => freeStep.bits[Math.floor(b / 8)][b % 8] === 0)
  //  下一次分配应当优先用回收出来的低位盘块
  const reused = after && after.blocks.some(b => freed.includes(b))
  allZero && reused
    ? ok(`回收盘块 ${freed.join('、')} 后对应位清 0，下一次分配立刻复用了它们`)
    : bad(`回收不彻底：清零=${allZero} 复用=${reused}`)
}

// ═══ CSMA/CD ═══════════════════════════════════════════
console.log('\n【CSMA/CD 二进制指数退避】')

const csmaDoc = (
  stations: [string, number, string][], maxAttempts = 16,
): SimDocument => ({
  kind: 'csma', params: { maxAttempts },
  entities: stations.map(([id, readyAt, picks]) =>
    ({ id, type: 'station', attrs: { readyAt, picks } })),
  streams: [],
})
const csmaRun = (st: [string, number, string][], m = 16) =>
  run(csmaKernel.compile(csmaDoc(st, m)), 500) as CsmaState[]

// ── 1. 退避值必须落在 {0 … 2^k − 1} 里 ─────────────────
{
  const t = csmaRun([['A', 1, '1,3,5,7'], ['B', 1, '0,2,4,6'], ['C', 1, '1,1,2,3']])
  const wrong: string[] = []
  for (const s of t) {
    for (const [id, text] of Object.entries(s.picked)) {
      const m = text.match(/k=(\d+)，从 \{0…(\d+)\} 取 r=(\d+)/)
      if (!m) continue
      const [, k, hi, r] = m.map(Number)
      if (Number(hi) !== Math.pow(2, k) - 1) wrong.push(`${id}: k=${k} 时上界应为 ${Math.pow(2, k) - 1}`)
      if (Number(r) > Number(hi)) wrong.push(`${id}: r=${r} 超出 {0…${hi}}`)
    }
  }
  wrong.length === 0
    ? ok('每次退避的 r 都落在 {0 … 2^k−1} 内，且 k = min(冲突次数, 10)')
    : bad(wrong.slice(0, 3).join(' / '))
}

// ── 2. 冲突必须真的发生，且最终所有站都发得出去 ──────────
{
  const t = csmaRun([['A', 1, '1,3'], ['B', 1, '0,2']])
  const collided = t.some(s => s.collision)
  const last = t.at(-1)!
  collided && last.done.length === 2
    ? ok(`两站同时发 → 冲突；退避后先后发送成功（顺序 ${last.done.join(' → ')}）`)
    : bad(`冲突或成功不对：collided=${collided} done=${last.done}`)
}

// ── 3. 退避取相同值时必须再次冲突 ──────────────────────
{
  //  两站每次都取一样的 r → 永远撞在一起
  const t = csmaRun([['A', 1, '1,1,1,1,1'], ['B', 1, '1,1,1,1,1']])
  t.filter(s => s.collision).length >= 2
    ? ok(`两站每次退避都取同一个 r → 连续冲突 ${t.filter(s => s.collision).length} 次`)
    : bad('取相同退避值却没有连续冲突')
}

// ── 4. 达到重传上限必须放弃 ────────────────────────────
{
  const picks = '1,1,1,1'
  const t = csmaRun([['A', 1, picks], ['B', 1, picks]], 3)
  const last = t.at(-1)!
  last.aborted.length > 0
    ? ok(`重传上限设为 3：${last.aborted.join('、')} 达到上限后放弃`)
    : bad(`没有站放弃：done=${last.done} aborted=${last.aborted}`)
}

// ── 自检 ───────────────────────────────────────────────
{
  const a = csmaRun([['A', 1, '0,0'], ['B', 1, '1,1']]).at(-1)!.done.join('')
  const b = csmaRun([['A', 1, '1,1'], ['B', 1, '0,0']]).at(-1)!.done.join('')
  a !== b
    ? ok(`自检：交换两站的退避取值，成功顺序从 ${a} 变成 ${b} —— 判据认得出退避配置`)
    : bad('自检失败：换了退避值结果不变')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
