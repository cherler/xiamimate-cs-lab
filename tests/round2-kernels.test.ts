/**
 * 第二批内核验证：排序 · Dijkstra · 银行家 · 滑动窗口 ARQ
 *
 * 同一条纪律：不写记忆里的教科书数字。
 * 每项要么在测试里用**跟内核无关的独立算法**算一遍，要么验**性质**。
 * 每组末尾都带一条「自检」—— 证明这条判据真的会红。
 */
import { run, resume } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'
import { sortKernel, type SortState } from '../src/kernels/sort.ts'
import { dijkstraKernel, type DijkstraState } from '../src/kernels/dijkstra.ts'
import { bankerKernel, type BankerState } from '../src/kernels/banker.ts'
import { arqKernel, type ArqState } from '../src/kernels/arq.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// ═══════════════════════════════════════════════════════
console.log('\n【排序逐趟】')

const ALGOS = ['直接插入', '希尔', '冒泡', '简单选择', '快速', '堆', '归并']
const INPUT = [49, 38, 65, 97, 76, 13, 27, 49]

const sortDoc = (algorithm: string, arr: number[]): SimDocument => ({
  kind: 'sort', params: { algorithm }, entities: [], streams: [{ name: 'array', values: arr }],
})
const sortTrace = (algorithm: string, arr = INPUT) =>
  run(sortKernel.compile(sortDoc(algorithm, arr))) as SortState[]

// ── 1. 七种算法末态都必须等于独立排序的结果 ────────────
{
  //  判据来源：JS 自带的 sort，跟被测内核完全无关
  const expect = [...INPUT].sort((a, b) => a - b)
  const wrong: string[] = []
  for (const a of ALGOS) {
    const last = sortTrace(a).at(-1)!
    if (!eq(last.arr, expect)) wrong.push(`${a} → ${last.arr.join(',')}`)
  }
  wrong.length === 0
    ? ok(`7 种算法末态一致：${expect.join(' ')}`)
    : bad(`末态不对：${wrong.join(' | ')}`)
}

// ── 2. 每一步都只能是原数组的一个排列（不许凭空造数）──
//    插入排序/快排用挖坑法：hole 那格是旧副本，真值端在 held 里。
//    所以不变式是「数组挖掉空位、补上手里端着的值」= 原多重集。
{
  const key = (x: number[]) => [...x].sort((a, b) => a - b).join(',')
  const base = key(INPUT)
  const effective = (s: SortState) => {
    if (s.hole < 0) return s.arr
    const x = [...s.arr]
    x.splice(s.hole, 1)
    if (s.held !== null) x.push(s.held)
    return x
  }
  const wrong = ALGOS.filter(a => sortTrace(a).some(s => key(effective(s)) !== base))
  wrong.length === 0
    ? ok('所有算法每一步都是原数组的排列（挖坑法按 空位+手持值 折算），无元素丢失/凭空出现')
    : bad(`这些算法中途元素集合变了：${wrong.join('/')}`)
}

// ── 2b. 挖坑必须成对：有空位就必须有手持值，反之亦然 ───
//    否则"多出来的那个数"又会以另一种形式骗过第 2 条
{
  const wrong: string[] = []
  for (const a of ALGOS) for (const s of sortTrace(a)) {
    if ((s.hole >= 0) !== (s.held !== null)) wrong.push(`${a} 第${s.i}步 hole=${s.hole} held=${s.held}`)
    if (s.hole >= s.arr.length) wrong.push(`${a} 第${s.i}步 空位越界 ${s.hole}`)
  }
  wrong.length === 0
    ? ok('空位与手持值始终成对出现，且下标不越界')
    : bad(`挖坑状态不自洽：${wrong.slice(0, 3).join(' / ')}`)
}

// ── 2c. settled 与 sorted 不是一回事，必须真的区分开 ────
//    插入/希尔/归并的中途一律没有"最终位置"，只有"局部有序"。
//    如果内核偷懒把两者写成同一个东西，这条会红。
{
  const prefixOnly = ['直接插入', '希尔', '归并']
  const bads: string[] = []
  for (const a of prefixOnly) {
    const t = sortTrace(a)
    const midHasSettled = t.slice(0, -1).some(s => s.settled.length > 0)
    const everSorted = t.some(s => s.sorted.length > 0)
    if (midHasSettled) bads.push(`${a} 中途就声称有最终位置`)
    if (!everSorted) bads.push(`${a} 从没标出局部有序区`)
  }
  //  反过来：冒泡/选择/快排/堆必须真的有中途就位
  for (const a of ['冒泡', '简单选择', '快速', '堆']) {
    if (!sortTrace(a).slice(0, -1).some(s => s.settled.length > 0)) bads.push(`${a} 中途没有任何就位标记`)
  }
  bads.length === 0
    ? ok('settled（最终位置）与 sorted（局部有序）语义分开：插入/希尔/归并只有后者')
    : bad(bads.join(' / '))
}

// ── 2d. sorted 标注的区间必须真的是有序的 ───────────────
{
  const wrong: string[] = []
  for (const a of ALGOS) for (const s of sortTrace(a)) {
    if (s.hole >= 0) continue           // 搬移进行中，区间内允许有旧副本
    const vals = s.sorted.map(k => s.arr[k])
    if (vals.some((v, k) => k > 0 && v < vals[k - 1])) wrong.push(`${a} 第${s.i}步：${vals.join(',')}`)
  }
  wrong.length === 0
    ? ok('标为局部有序的区间，取出来确实非递减')
    : bad(`sorted 撒谎：${wrong.slice(0, 3).join(' / ')}`)
}

// ── 3. settled 标记必须诚实：标为就位的下标，末态必须一致 ──
{
  const wrong: string[] = []
  for (const a of ALGOS) {
    const t = sortTrace(a)
    const final = t.at(-1)!.arr
    for (const s of t) for (const k of s.settled) {
      if (s.arr[k] !== final[k]) { wrong.push(`${a} 第${s.i}步 下标${k}`); break }
    }
  }
  wrong.length === 0
    ? ok('settled 标记诚实：标为就位的位置在末态确实没变')
    : bad(`settled 撒谎：${wrong.slice(0, 3).join(' / ')}`)
}

// ── 4. 冒泡的"第 p 趟后"必须等于独立写的冒泡 p 趟 ──────
{
  const bubblePass = (arr: number[], passes: number) => {
    const a = [...arr]
    for (let p = 1; p <= passes; p++)
      for (let j = 0; j < a.length - p; j++)
        if (a[j] > a[j + 1]) [a[j], a[j + 1]] = [a[j + 1], a[j]]
    return a
  }
  const t = sortTrace('冒泡')
  const wrong: number[] = []
  for (const s of t.filter(x => x.passEnd)) {
    if (!eq(s.arr, bubblePass(INPUT, s.pass))) wrong.push(s.pass)
  }
  wrong.length === 0
    ? ok(`冒泡每一趟末尾与独立实现逐趟吻合（共 ${t.filter(x => x.passEnd).length} 趟）`)
    : bad(`第 ${wrong.join('/')} 趟结果对不上`)
}

// ── 自检：判据得会红 ───────────────────────────────────
{
  const t = sortTrace('冒泡')
  const tampered = t.map(s => ({ ...s, arr: [...s.arr] }))
  tampered[0].arr[0] = 999
  const key = (x: number[]) => [...x].sort((a, b) => a - b).join(',')
  key(tampered[0].arr) !== key(INPUT)
    ? ok('自检：把某一步改掉一个元素，第 2 条判据会红 → 有鉴别力')
    : bad('自检失败：改了元素判据还不红')
}

// ═══════════════════════════════════════════════════════
console.log('\n【Dijkstra 最短路】')

/** 无向图；边权都为正 */
const GRAPH: [string, string, number][] = [
  ['A', 'B', 4], ['A', 'C', 6], ['A', 'D', 6],
  ['B', 'C', 1], ['B', 'E', 7],
  ['C', 'D', 2], ['C', 'E', 6], ['C', 'F', 4],
  ['D', 'F', 5], ['E', 'F', 1], ['E', 'G', 6], ['F', 'G', 8],
]
const NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const dijDoc = (source: string): SimDocument => ({
  kind: 'dijkstra',
  params: { source, directed: 0 },
  entities: [
    ...NODES.map(id => ({ id, type: 'node', attrs: {} })),
    ...GRAPH.map(([f, t, w]) => ({ id: `${f}${t}`, type: 'edge', attrs: { from: f, to: t, w } })),
  ],
  streams: [],
})
const dijFinal = (source: string) =>
  (run(dijkstraKernel.compile(dijDoc(source))) as DijkstraState[]).at(-1)!

// ── 1. 与独立写的 Bellman-Ford 比对（不同算法，同一答案）──
{
  //  判据来源：Bellman-Ford，跟 Dijkstra 完全不同的算法
  const bellman = (src: string) => {
    const d: Record<string, number> = Object.fromEntries(
      NODES.map(n => [n, n === src ? 0 : Infinity]))
    for (let r = 0; r < NODES.length - 1; r++)
      for (const [f, t, w] of GRAPH) {
        if (d[f] + w < d[t]) d[t] = d[f] + w
        if (d[t] + w < d[f]) d[f] = d[t] + w
      }
    return d
  }
  const wrong: string[] = []
  for (const src of NODES) {
    const mine = dijFinal(src).dist, ref = bellman(src)
    for (const n of NODES) if (mine[n] !== ref[n]) wrong.push(`${src}→${n}: ${mine[n]} vs ${ref[n]}`)
  }
  wrong.length === 0
    ? ok('7 个源点 × 7 个终点全部与 Bellman-Ford 一致')
    : bad(`与 Bellman-Ford 不一致：${wrong.slice(0, 3).join(' / ')}`)
}

// ── 2. 前驱链必须真的走得通，且长度等于 dist ───────────
{
  const w = new Map(GRAPH.flatMap(([f, t, x]) => [[`${f}|${t}`, x], [`${t}|${f}`, x]] as const))
  const f = dijFinal('A')
  const wrong: string[] = []
  for (const n of NODES) {
    if (n === 'A') continue
    let cur = n, sum = 0, guard = 0
    while (cur !== 'A' && guard++ < 20) {
      const p = f.prev[cur]
      if (!p) { sum = NaN; break }
      sum += w.get(`${p}|${cur}`)!
      cur = p
    }
    if (sum !== f.dist[n]) wrong.push(`${n}: 链长 ${sum} ≠ dist ${f.dist[n]}`)
  }
  wrong.length === 0
    ? ok('前驱链可回溯到源点，且累计边权 = dist')
    : bad(`前驱链对不上：${wrong.join(' / ')}`)
}

// ── 3. 确定顺序必须按 dist 非递减（Dijkstra 的核心性质）──
{
  const f = dijFinal('A')
  const ds = f.settled.map(n => f.dist[n])
  ds.every((v, k) => k === 0 || v >= ds[k - 1])
    ? ok(`确定顺序 dist 非递减：${f.settled.map((n, k) => `${n}(${ds[k]})`).join(' → ')}`)
    : bad(`确定顺序不是非递减：${ds.join(',')}`)
}

// ── 自检 ───────────────────────────────────────────────
{
  const f = dijFinal('A')
  f.dist.G > f.dist.F
    ? ok(`自检：dist(G)=${f.dist.G} > dist(F)=${f.dist.F}，若内核把 dist 写死为 0 上面三条都会红`)
    : bad('自检失败：距离全相等，判据可能没鉴别力')
}

// ═══════════════════════════════════════════════════════
console.log('\n【银行家算法】')

const RES = ['A', 'B', 'C']
type PRow = { id: string; max: number[]; alloc: number[] }
const bankDoc = (total: number[], rows: PRow[]): SimDocument => ({
  kind: 'banker',
  params: { resources: RES.join(',') },
  entities: [
    ...RES.map((r, k) => ({ id: r, type: 'resource', attrs: { total: total[k] } })),
    ...rows.map(p => ({
      id: p.id, type: 'process',
      attrs: Object.fromEntries([
        ...RES.map((r, k) => [`max_${r}`, p.max[k]]),
        ...RES.map((r, k) => [`alloc_${r}`, p.alloc[k]]),
      ]) as Record<string, number>,
    })),
  ],
  streams: [],
})
const bankFinal = (total: number[], rows: PRow[]) =>
  (run(bankerKernel.compile(bankDoc(total, rows))) as BankerState[]).at(-1)!

/** 经典安全状态样例 */
const SAFE_ROWS: PRow[] = [
  { id: 'P0', max: [7, 5, 3], alloc: [0, 1, 0] },
  { id: 'P1', max: [3, 2, 2], alloc: [2, 0, 0] },
  { id: 'P2', max: [9, 0, 2], alloc: [3, 0, 2] },
  { id: 'P3', max: [2, 2, 2], alloc: [2, 1, 1] },
  { id: 'P4', max: [4, 3, 3], alloc: [0, 0, 2] },
]
const SAFE_TOTAL = [10, 5, 7]

// ── 1. 报告的安全序列必须真的可执行（独立重放一遍）─────
{
  const f = bankFinal(SAFE_TOTAL, SAFE_ROWS)
  //  判据：拿它给的序列，用独立的一段代码从头模拟资源收放
  const work = RES.map((_, k) =>
    SAFE_TOTAL[k] - SAFE_ROWS.reduce((s, p) => s + p.alloc[k], 0))
  let feasible = f.sequence.length === SAFE_ROWS.length
  for (const pid of f.sequence) {
    const p = SAFE_ROWS.find(x => x.id === pid)!
    if (RES.some((_, k) => p.max[k] - p.alloc[k] > work[k])) { feasible = false; break }
    RES.forEach((_, k) => { work[k] += p.alloc[k] })
  }
  feasible && f.act === 'safe'
    ? ok(`安全序列 ${f.sequence.join('→')} 独立重放可行，末态判为安全`)
    : bad(`序列不可行或末态不对：${f.sequence.join('→')} act=${f.act}`)
}

// ── 2. 不安全状态必须判为不安全 ────────────────────────
{
  //  把 P0 的已分配抬到几乎耗尽 A 资源，故意造死局
  const rows: PRow[] = [
    { id: 'P0', max: [10, 5, 7], alloc: [5, 2, 3] },
    { id: 'P1', max: [10, 5, 7], alloc: [5, 3, 4] },
  ]
  const f = bankFinal([10, 5, 7], rows)
  f.act === 'unsafe' && f.sequence.length < rows.length
    ? ok(`双方都还需要资源但可用量为 0 → 判为不安全（序列 ${f.sequence.length}/${rows.length}）`)
    : bad(`死局没被判出来：act=${f.act} 序列=${f.sequence.join('→')}`)
}

// ── 3. Work 单调不减，且末态 Work = 系统总量 ───────────
{
  const t = run(bankerKernel.compile(bankDoc(SAFE_TOTAL, SAFE_ROWS))) as BankerState[]
  const mono = t.every((s, k) => k === 0 || RES.every(r => s.work[r] >= t[k - 1].work[r]))
  const back = RES.every((r, k) => t.at(-1)!.work[r] === SAFE_TOTAL[k])
  mono && back
    ? ok(`Work 单调不减，末态归还为系统总量 (${SAFE_TOTAL.join(' ')})`)
    : bad(`Work 单调=${mono} 归还完整=${back}`)
}

// ── 自检 ───────────────────────────────────────────────
{
  const f = bankFinal(SAFE_TOTAL, SAFE_ROWS)
  //  拿它的序列反过来跑，如果反序也"可行"，说明第 1 条判据没鉴别力
  const rev = [...f.sequence].reverse()
  const work = RES.map((_, k) =>
    SAFE_TOTAL[k] - SAFE_ROWS.reduce((s, p) => s + p.alloc[k], 0))
  let revFeasible = true
  for (const pid of rev) {
    const p = SAFE_ROWS.find(x => x.id === pid)!
    if (RES.some((_, k) => p.max[k] - p.alloc[k] > work[k])) { revFeasible = false; break }
    RES.forEach((_, k) => { work[k] += p.alloc[k] })
  }
  !revFeasible
    ? ok('自检：把安全序列倒过来就不可行了 → 第 1 条判据确实在验顺序，不是走过场')
    : bad('自检失败：序列倒过来也可行，说明该样例区分不出顺序')
}

// ═══════════════════════════════════════════════════════
console.log('\n【滑动窗口 ARQ】')

const arqDoc = (
  protocol: string, windowSize: number, losses: { target: string; seq: number }[] = [],
): SimDocument => ({
  kind: 'arq',
  params: { protocol, windowSize, totalFrames: 8, delay: 2, timeout: 8 },
  entities: losses.map((l, k) => ({
    id: `L${k}`, type: 'loss', attrs: { target: l.target, seq: l.seq, nth: 1 },
  })),
  streams: [],
})
const arqRun = (p: string, w: number, l: { target: string; seq: number }[] = []) =>
  run(arqKernel.compile(arqDoc(p, w, l)), 4000) as ArqState[]

// ── 1. 无丢包时三种协议都必须完成，且传输次数 = 帧数 ────
{
  const cases: [string, number][] = [['SW', 1], ['GBN', 4], ['SR', 4]]
  const wrong: string[] = []
  for (const [p, w] of cases) {
    const last = arqRun(p, w).at(-1)!
    if (last.delivered !== 8 || last.transmissions !== 8)
      wrong.push(`${p}: 交付${last.delivered} 传输${last.transmissions}`)
  }
  wrong.length === 0
    ? ok('无丢包：SW/GBN/SR 都交付 8 帧，各传输 8 次（零重传）')
    : bad(`无丢包却不干净：${wrong.join(' | ')}`)
}

// ── 2. 关键性质：同一次丢包下 SR 的重传数严格少于 GBN ──
{
  //  这是两个协议存在意义的差别，比任何具体数字都本质
  const loss = [{ target: 'frame', seq: 2 }]
  const g = arqRun('GBN', 4, loss).at(-1)!
  const s = arqRun('SR', 4, loss).at(-1)!
  g.delivered === 8 && s.delivered === 8 && s.transmissions < g.transmissions
    ? ok(`丢第 2 帧：GBN 传 ${g.transmissions} 次，SR 传 ${s.transmissions} 次 —— SR 更省`)
    : bad(`SR 没比 GBN 省：GBN ${g.transmissions} / SR ${s.transmissions}（交付 ${g.delivered}/${s.delivered}）`)
}

// ── 3. 交付必须严格按序、不重不漏 ──────────────────────
{
  const wrong: string[] = []
  for (const [p, w] of [['SW', 1], ['GBN', 4], ['SR', 4]] as [string, number][]) {
    const t = arqRun(p, w, [{ target: 'frame', seq: 1 }, { target: 'ack', seq: 3 }])
    // delivered 只能单调增，每次至多按序推进；expected 必须等于 delivered
    const monotone = t.every((s, k) => k === 0 || s.delivered >= t[k - 1].delivered)
    const aligned = t.every(s => s.expected === s.delivered)
    if (!monotone || !aligned || t.at(-1)!.delivered !== 8)
      wrong.push(`${p}: 单调=${monotone} 对齐=${aligned} 末态=${t.at(-1)!.delivered}`)
  }
  wrong.length === 0
    ? ok('帧+ACK 同时丢：三种协议都按序交付满 8 帧，无重复无跳号')
    : bad(`交付不干净：${wrong.join(' | ')}`)
}

// ── 4. 窗口不变式：base ≤ next ≤ base + W ──────────────
{
  const t = arqRun('GBN', 4, [{ target: 'frame', seq: 2 }])
  const bad1 = t.find(s => !(s.base <= s.next && s.next <= s.base + 4))
  !bad1
    ? ok('GBN 窗口不变式全程成立：base ≤ next ≤ base + 4')
    : bad(`窗口越界：第 ${bad1.i} 步 base=${bad1.base} next=${bad1.next}`)
}

// ── 5. 标准 2：ARQ 是真·逐步内核，必须能中途续跑 ───────
{
  const model = arqKernel.compile(arqDoc('GBN', 4, [{ target: 'frame', seq: 2 }]))
  const full = run(model, 4000) as ArqState[]
  const mid = Math.floor(full.length / 2)
  //  JSON 往返 —— 逼出任何藏在闭包里的可变状态
  const revived = JSON.parse(JSON.stringify(full[mid])) as ArqState
  const tail = resume(model, revived, 4000) as ArqState[]
  eq(tail, full.slice(mid + 1))
    ? ok(`从第 ${mid} 步 JSON 往返后续跑，剩余 ${tail.length} 步与原轨迹逐字节一致`)
    : bad(`续跑不一致：续跑 ${tail.length} 步 vs 原 ${full.length - mid - 1} 步`)
}

// ── 自检 ───────────────────────────────────────────────
{
  const clean = arqRun('GBN', 4).at(-1)!.transmissions
  const lossy = arqRun('GBN', 4, [{ target: 'frame', seq: 2 }]).at(-1)!.transmissions
  lossy > clean
    ? ok(`自检：丢包后传输次数 ${clean} → ${lossy}，若内核忽略丢包配置第 2 条会红`)
    : bad('自检失败：丢包没有任何影响，说明 loss 配置根本没生效')
}

// ═══════════════════════════════════════════════════════
console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
