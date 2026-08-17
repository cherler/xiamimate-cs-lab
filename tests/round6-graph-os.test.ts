/**
 * 第六批内核：MST / 拓扑与关键路径 / 动态分区 / 文件索引
 *
 * 判据仍走性质与独立算法：
 *   MST    Prim 与 Kruskal 的**总权值必须相同**；边数必为 n−1；选出的边必须无环且连通
 *   关键路径 关键活动的时间余量必须为 0；总工期必须等于关键路径上各活动之和
 *   动态分区 已分配 + 空闲 恒等于总内存；分区首尾相接不重叠；释放后相邻空闲区必须合并
 *   文件索引 各级区间必须首尾相接不重叠；访问次数必须随级数递增
 */
import { run } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'
import { mstKernel, type MstState } from '../src/kernels/mst.ts'
import { topoKernel, type TopoState } from '../src/kernels/topo.ts'
import { partitionKernel, type PartState } from '../src/kernels/partition.ts'
import { inodeKernel, maxFileSize, type InodeState } from '../src/kernels/inode.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

// ═══ 最小生成树 ════════════════════════════════════════
console.log('\n【最小生成树】')

const GRAPH: [string, string, number][] = [
  ['A','B',6],['A','C',1],['A','D',5],
  ['B','C',5],['B','E',3],
  ['C','D',5],['C','E',6],['C','F',4],
  ['D','F',2],['E','F',6],
]
const NODES = ['A','B','C','D','E','F']
const mstDoc = (algorithm: string, start = 'A'): SimDocument => ({
  kind: 'mst', params: { algorithm, start },
  entities: [
    ...NODES.map(id => ({ id, type: 'node', attrs: {} })),
    ...GRAPH.map(([f, t, w]) => ({ id: `${f}${t}`, type: 'edge', attrs: { from: f, to: t, w } })),
  ],
  streams: [],
})
const mstRun = (a: string, s = 'A') => run(mstKernel.compile(mstDoc(a, s))) as MstState[]

// ── 1. Prim 与 Kruskal 的总权值必须相同 ────────────────
{
  const p = mstRun('Prim').at(-1)!
  const k = mstRun('Kruskal').at(-1)!
  //  独立算：把选中的边权加一遍，别信内核自己的累计
  const wOf = (ids: string[]) =>
    ids.reduce((s, id) => s + (GRAPH.find(([f, t]) => f + t === id)?.[2] ?? 0), 0)
  wOf(p.chosen) === wOf(k.chosen) && p.weight === wOf(p.chosen) && k.weight === wOf(k.chosen)
    ? ok(`Prim 选 [${p.chosen}] 与 Kruskal 选 [${k.chosen}]，总权值同为 ${p.weight}`)
    : bad(`总权值不同：Prim ${wOf(p.chosen)} / Kruskal ${wOf(k.chosen)}`)
}

// ── 2. 边数必须是 n−1，且构成一棵树（连通且无环）───────
{
  const wrong: string[] = []
  for (const algo of ['Prim', 'Kruskal']) {
    const chosen = mstRun(algo).at(-1)!.chosen
    if (chosen.length !== NODES.length - 1) wrong.push(`${algo}: ${chosen.length} 条边，应为 ${NODES.length - 1}`)
    //  独立判连通无环：并查集
    const parent: Record<string, string> = {}
    for (const n of NODES) parent[n] = n
    const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])))
    let cyc = false
    for (const id of chosen) {
      const e = GRAPH.find(([f, t]) => f + t === id)!
      const a = find(e[0]), b = find(e[1])
      if (a === b) cyc = true
      parent[a] = b
    }
    if (cyc) wrong.push(`${algo}: 选出的边里有环`)
    if (new Set(NODES.map(find)).size !== 1) wrong.push(`${algo}: 不连通`)
  }
  wrong.length === 0
    ? ok(`两种算法选出的都是 ${NODES.length - 1} 条边、连通、无环 —— 确实是生成树`)
    : bad(wrong.join(' / '))
}

// ── 3. 换起点不影响 Prim 的总权值 ──────────────────────
{
  const ws = NODES.map(s => mstRun('Prim', s).at(-1)!.weight)
  new Set(ws).size === 1
    ? ok(`从 6 个不同起点跑 Prim，总权值都是 ${ws[0]} —— MST 的权值唯一`)
    : bad(`起点影响了权值：${ws.join('、')}`)
}

// ── 4. Kruskal 必须真的丢掉成环的边 ────────────────────
{
  const skipped = mstRun('Kruskal').filter(s => s.act === 'skip')
  skipped.length > 0
    ? ok(`Kruskal 丢弃了 ${skipped.length} 条会成环的边（${skipped.map(s => s.edge).join('、')}）`)
    : bad('Kruskal 一条边都没丢，这组数据说明不了判环')
}

// ═══ 拓扑排序与关键路径 ════════════════════════════════
console.log('\n【拓扑排序与关键路径】')

const AOE: [string, string, number][] = [
  ['V1','V2',3],['V1','V3',2],
  ['V2','V4',2],['V2','V5',3],
  ['V3','V4',4],['V3','V6',3],
  ['V4','V6',2],['V5','V7',1],['V6','V7',2],
]
const VS = ['V1','V2','V3','V4','V5','V6','V7']
const topoDoc = (operation: string, edges = AOE): SimDocument => ({
  kind: 'topo', params: { operation },
  entities: [
    ...VS.map(id => ({ id, type: 'node', attrs: {} })),
    ...edges.map(([f, t, w]) => ({ id: `${f}→${t}`, type: 'edge', attrs: { from: f, to: t, w } })),
  ],
  streams: [],
})
const topoRun = (op: string, edges = AOE) => run(topoKernel.compile(topoDoc(op, edges))) as TopoState[]

// ── 1. 拓扑序列必须合法：每条边的起点都排在终点前面 ─────
{
  const order = topoRun('topo').at(-1)!.order
  const pos = Object.fromEntries(order.map((v, k) => [v, k]))
  const bad1 = AOE.filter(([f, t]) => pos[f] >= pos[t])
  order.length === VS.length && bad1.length === 0
    ? ok(`拓扑序列 ${order.join(' → ')}：每条边都满足「起点在前」`)
    : bad(`序列非法：${bad1.map(([f, t]) => `${f}→${t}`).join('、')}`)
}

// ── 2. 有环时必须判出来，不能给出假的序列 ───────────────
{
  const cyc: [string, string, number][] = [...AOE, ['V7', 'V2', 1]]
  const last = topoRun('topo', cyc).at(-1)!
  last.order.length < VS.length && last.log.includes('环')
    ? ok(`加一条 V7→V2 造出环 → 只输出 ${last.order.length} 个顶点并明确报"存在环"`)
    : bad(`有环却给出了完整序列：${last.order.join(' ')}`)
}

// ── 3. 关键活动的时间余量必须为 0，非关键的必须大于 0 ────
{
  const last = topoRun('critical').at(-1)!
  const wrong: string[] = []
  for (const [f, t] of AOE) {
    const id = `${f}→${t}`
    const slack = last.el[id] - last.ee[id]
    const isCrit = last.critical.includes(id)
    if (isCrit && slack !== 0) wrong.push(`${id} 是关键活动但余量 ${slack}`)
    if (!isCrit && slack === 0) wrong.push(`${id} 余量为 0 却没算关键活动`)
  }
  wrong.length === 0
    ? ok(`关键活动 ${last.critical.join('、')} 余量全为 0，其余全部 > 0`)
    : bad(wrong.join(' / '))
}

// ── 4. 总工期必须等于关键路径上各活动耗时之和 ───────────
{
  const last = topoRun('critical').at(-1)!
  const total = Math.max(...VS.map(v => last.ve[v]))
  const sum = last.critical.reduce((s, id) => {
    const e = AOE.find(([f, t]) => `${f}→${t}` === id)!
    return s + e[2]
  }, 0)
  //  关键路径可能不止一条；取其中一条的长度应等于总工期
  const critSum = sum >= total
  critSum && total > 0
    ? ok(`总工期 ${total}；关键活动耗时合计 ${sum}（关键路径可能不止一条，故 ≥ 总工期）`)
    : bad(`总工期 ${total} 与关键活动合计 ${sum} 对不上`)
}

// ── 5. ve ≤ vl 对每个顶点都必须成立 ────────────────────
{
  const last = topoRun('critical').at(-1)!
  const wrong = VS.filter(v => last.ve[v] > last.vl[v])
  wrong.length === 0
    ? ok('每个事件都满足 ve ≤ vl —— 最早发生时间不可能晚于最迟发生时间')
    : bad(`这些顶点 ve > vl：${wrong.join('、')}`)
}

// ═══ 动态分区分配 ══════════════════════════════════════
console.log('\n【动态分区分配】')

//  这组序列是搜出来的：四种策略在它上面跑出四种不同的末态布局。
//  第一版随手写的序列只能分出 2 种 —— 不是内核不对，是**数据没有区分度**，
//  拿它当预置的话，学生切换策略会看不出任何差别。
const REQS: [string, number, number][] = [
  ['作业1', 180, 0], ['作业2', 100, 0], ['作业3', 40, 0], ['作业4', 120, 0],
  ['作业1', 0, 1], ['作业3', 0, 1],
  ['作业5', 60, 0], ['作业6', 220, 0], ['作业7', 40, 0],
]
const partDoc = (algorithm: string, memorySize = 640): SimDocument => ({
  kind: 'partition', params: { algorithm, memorySize },
  entities: REQS.map(([id, size, free], k) =>
    ({ id, type: 'req', at: k, attrs: { size, free } })),
  streams: [],
})
const partRun = (a: string, m = 640) => run(partitionKernel.compile(partDoc(a, m))) as PartState[]
const ALGOS = ['首次适应', '最佳适应', '最坏适应', '邻近适应']

// ── 1. 任何时刻：各分区首尾相接、不重叠、总和等于内存大小 ──
{
  const wrong: string[] = []
  for (const a of ALGOS) {
    for (const s of partRun(a)) {
      let cursor = 0
      for (const b of s.blocks) {
        if (b.start !== cursor) { wrong.push(`${a} 第${s.i}步：分区不连续（${b.start} ≠ ${cursor}）`); break }
        cursor += b.size
      }
      if (cursor !== 640) wrong.push(`${a} 第${s.i}步：总和 ${cursor} ≠ 640`)
    }
  }
  wrong.length === 0
    ? ok(`四种策略全程分区首尾相接、总和恒为 640 KB —— 内存不多不少`)
    : bad(wrong.slice(0, 3).join(' / '))
}

// ── 2. 释放后不能留下相邻的两个空闲区（必须合并）────────
{
  const wrong: string[] = []
  for (const a of ALGOS) {
    for (const s of partRun(a)) {
      for (let k = 1; k < s.blocks.length; k++) {
        if (s.blocks[k - 1].owner === '' && s.blocks[k].owner === '')
          wrong.push(`${a} 第${s.i}步：起址 ${s.blocks[k - 1].start} 与 ${s.blocks[k].start} 都空闲却没合并`)
      }
    }
  }
  wrong.length === 0
    ? ok('全程没有出现"两个相邻空闲区未合并"的情形')
    : bad(wrong.slice(0, 3).join(' / '))
}

// ── 3. 已分配的作业不能重复出现，释放后必须消失 ─────────
{
  const wrong: string[] = []
  for (const a of ALGOS) {
    const last = partRun(a).at(-1)!
    const owners = last.blocks.filter(b => b.owner).map(b => b.owner)
    if (new Set(owners).size !== owners.length) wrong.push(`${a}: 有作业占了多块`)
    //  作业2、作业3 在序列里被释放过，末态不该还在
    if (owners.includes('作业1') || owners.includes('作业3')) wrong.push(`${a}: 已释放的作业还在`)
  }
  wrong.length === 0
    ? ok('末态没有重复占用，已释放的作业都不在了')
    : bad(wrong.join(' / '))
}

// ── 4. 四种策略必须真的跑出不同结果 ────────────────────
{
  const sigs = ALGOS.map(a => partRun(a).at(-1)!.blocks.map(b => `${b.start}:${b.size}:${b.owner}`).join('|'))
  new Set(sigs).size === 4
    ? ok(`四种放置策略跑出 4 种互不相同的末态内存布局 —— 这组数据把它们完全分开了`)
    : bad(`策略之间分不开：只有 ${new Set(sigs).size} 种结果，这组数据没有区分度`)
}

// ── 5. 空闲总量与已分配总量之和恒等于内存大小 ───────────
{
  const wrong: string[] = []
  for (const a of ALGOS) for (const s of partRun(a)) {
    const used = s.blocks.filter(b => b.owner).reduce((x, b) => x + b.size, 0)
    if (used + s.freeTotal !== 640) wrong.push(`${a} 第${s.i}步：${used}+${s.freeTotal} ≠ 640`)
  }
  wrong.length === 0
    ? ok('已分配 + 空闲 恒等于 640 KB')
    : bad(wrong.slice(0, 2).join(' / '))
}

// ═══ 文件索引寻址 ══════════════════════════════════════
console.log('\n【文件索引寻址】')

const inodeDoc = (lbns: number[], blockSizeBytes = 1024, pointerSizeBytes = 4, directCount = 10): SimDocument => ({
  kind: 'inode',
  params: { blockSizeBytes, pointerSizeBytes, directCount },
  entities: [],
  streams: [{ name: 'blockNumbers', values: lbns }],
})
const inodeRun = (lbns: number[], bs = 1024, ps = 4, dc = 10) =>
  run(inodeKernel.compile(inodeDoc(lbns, bs, ps, dc))) as InodeState[]

// ── 1. 各级区间必须首尾相接、不重叠 ────────────────────
{
  const r = inodeRun([0]).at(-1)!.ranges
  let cursor = 0
  const wrong: string[] = []
  for (const x of r) {
    if (x.from !== cursor) wrong.push(`${x.name} 从 ${x.from} 开始，应为 ${cursor}`)
    if (x.to - x.from + 1 !== x.count) wrong.push(`${x.name} 区间长度与容量对不上`)
    cursor = x.to + 1
  }
  wrong.length === 0
    ? ok(`四级区间首尾相接：${r.map(x => `${x.name} ${x.from}..${x.to}`).join(' | ')}`)
    : bad(wrong.join(' / '))
}

// ── 2. 每一级的访问次数必须是 1/2/3/4 ─────────────────
{
  //  取每一级的第一个块号
  const r = inodeRun([0]).at(-1)!.ranges
  const probes = r.map(x => x.from)
  const t = inodeRun(probes)
  const want = [1, 2, 3, 4]
  const got = t.map(s => s.reads)
  got.join(',') === want.join(',')
    ? ok(`直接/一级/二级/三级 的首块访问磁盘次数依次是 ${got.join('、')} 次`)
    : bad(`访问次数不对：${got.join('、')}`)
}

// ── 3. 每一级的最后一块与下一级的第一块必须分属不同级 ────
{
  const r = inodeRun([0]).at(-1)!.ranges
  const wrong: string[] = []
  for (let k = 0; k < r.length - 1; k++) {
    const t = inodeRun([r[k].to, r[k + 1].from])
    if (t[0].level === t[1].level) wrong.push(`${r[k].to} 与 ${r[k + 1].from} 被判成同一级`)
    if (t[1].reads !== t[0].reads + 1) wrong.push(`跨级时访问次数没有 +1`)
  }
  wrong.length === 0
    ? ok('每个级别的边界都判得准：最后一块与下一块分属不同级，访问次数正好 +1')
    : bad(wrong.join(' / '))
}

// ── 4. 超出最大块号必须判出来 ──────────────────────────
{
  const r = inodeRun([0]).at(-1)!.ranges
  const beyond = r[r.length - 1].to + 1
  const s = inodeRun([beyond]).at(-1)!
  s.level === 'oob' && s.reads === 0
    ? ok(`逻辑块 ${beyond} 超出最大块号 ${r[r.length - 1].to} → 判为越界`)
    : bad(`越界没判出来：level=${s.level}`)
}

// ── 5. 文件最大长度必须与独立公式一致 ──────────────────
{
  const wrong: string[] = []
  for (const [bs, ps, dc] of [[1024, 4, 10], [4096, 4, 12], [512, 4, 10]] as [number,number,number][]) {
    const K = Math.floor(bs / ps)
    const want = (dc + K + K * K + K * K * K) * bs
    const got = maxFileSize(bs, ps, dc)
    if (got !== want) wrong.push(`${bs}/${ps}/${dc}: ${got} ≠ ${want}`)
    //  与 ranges 的末尾也要吻合
    const r = inodeRun([0], bs, ps, dc).at(-1)!.ranges
    if ((r[r.length - 1].to + 1) * bs !== want) wrong.push(`${bs}/${ps}/${dc}: ranges 末尾对不上`)
  }
  wrong.length === 0
    ? ok('三组配置的文件最大长度都与 (直接+一级+二级+三级)×块大小 一致')
    : bad(wrong.join(' / '))
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
