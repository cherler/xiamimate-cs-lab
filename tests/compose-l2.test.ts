/**
 * L2 组合级：用已有原语组装新实验。
 *
 * compare 是并排对比原语。这里验三件事：
 *   1. 组合出来的实验结果正确（拿手算基准对）
 *   2. 组合内核照样满足验收标准（可插拔 / 确定性重放 / DSL 唯一入口）
 *   3. 自检必须能红
 */
import { run, resume } from '../src/core/kernel.ts'
import { compareTraces, visible } from '../src/core/verify.ts'
import type { SimDocument } from '../src/core/document.ts'
import { cacheKernel, type CacheState } from '../src/kernels/cache.ts'
import { tcpKernel, type TcpState } from '../src/kernels/tcp.ts'
import { makeCompareKernel, COMPARE_VISIBLE, type CompareState } from '../src/kernels/compare.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

// ── 经典反例：同一序列上 FIFO 反而比 LRU 命中率高 ──────
// 128B / 16B 块 / 2 路 → 4 组。0、64、128、192 全部落在第 0 组。
const SEQ = [0, 64, 0, 128, 64]

const cmpCache = makeCompareKernel<CacheState>(
  cacheKernel,
  (label, s) => `${label} ${s.outcome === 'hit' ? '命中' : '缺失'}(${s.hits}/${s.i + 1})`,
)

const doc: SimDocument = {
  kind: 'compare:cache',
  params: {
    addressBits: 32, cacheSizeBytes: 128, blockSizeBytes: 16, associativity: 2,
    varyParam: 'replacement',
  },
  entities: [],
  streams: [
    { name: 'accessSequence', values: SEQ },
    { name: 'variants', values: ['LRU', 'FIFO'] },
  ],
}

console.log('\n【L2 组合】compare 原语 —— LRU vs FIFO 并排')

const model = cmpCache.compile(doc)
const trace = run(model)

// ── 1. 轴跟内层一致（这是 compare 与 sweep 的分野）───────
model.axis.kind === 'step'
  ? ok(`轴沿用内层：${JSON.stringify(model.axis)}（sweep 会变成 parameter，compare 不变）`)
  : bad(`轴应沿用内层 step，实际 ${JSON.stringify(model.axis)}`)

// ── 2. 结果正确：手算基准 ──────────────────────────────
for (const s of trace) console.log(`      [${s.i}] ${s.log}`)

const finalLanes = trace[trace.length - 1].lanes
const hitsOf = (label: string) =>
  (finalLanes.find(l => l.label.endsWith(label))?.state as CacheState | null)?.hits

trace.length === SEQ.length
  ? ok(`${SEQ.length} 步，两道对齐`)
  : bad(`应为 ${SEQ.length} 步，实际 ${trace.length}`)

// 手算：
//   LRU  0miss 64miss 0hit(刷新时戳) 128miss(淘汰64) 64miss  → 1 命中
//   FIFO 0miss 64miss 0hit(不刷时戳) 128miss(淘汰0)  64hit   → 2 命中
hitsOf('LRU') === 1 && hitsOf('FIFO') === 2
  ? ok(`FIFO 2 命中 > LRU 1 命中 —— "LRU 未必更优"的经典反例，教学点成立`)
  : bad(`命中数不对：LRU=${hitsOf('LRU')}（应 1）FIFO=${hitsOf('FIFO')}（应 2）`)

// ── 3. 组合内核照样满足确定性重放 ──────────────────────
const k = 2
const m2 = cmpCache.compile(doc)
const head: CompareState<CacheState>[] = []
let prev: CompareState<CacheState> | null = null
for (let i = 0; i < k; i++) {
  const r = m2.step(prev)
  if (!r) break
  head.push(r.state); prev = r.state
}
const revived = JSON.parse(JSON.stringify(prev)) as CompareState<CacheState>
const tail = resume(cmpCache.compile(doc), revived)
compareTraces(
  [...head, ...tail].map(s => visible(s, COMPARE_VISIBLE)),
  trace.map(s => visible(s, COMPARE_VISIBLE)),
  { kind: 'exact' }, 'compare',
).length === 0
  ? ok(`确定性重放：第 ${k} 步截断 → JSON 往返 → 续跑一致`)
  : bad('组合内核的重放不一致')

// ── 4. DSL 唯一入口：改 variants 必须改结果 ────────────
const oneOnly: SimDocument = JSON.parse(JSON.stringify(doc))
oneOnly.streams[1].values = ['LRU']
const t1 = run(cmpCache.compile(oneOnly))
t1[0].lanes.length === 1 && trace[0].lanes.length === 2
  ? ok('改 variants 列表，并排道数跟着变（2 → 1）')
  : bad(`道数没跟着变：${trace[0].lanes.length} → ${t1[0].lanes.length}`)

// ── 5. 换内核也能组合（可插拔）─────────────────────────
const cmpTcp = makeCompareKernel<TcpState>(
  tcpKernel, (label, s) => `${label} cwnd=${s.cwnd}`,
)
const tcpDoc: SimDocument = {
  kind: 'compare:tcp',
  params: { initialCwnd: 1, initialSsthresh: 16, rounds: 12, varyParam: 'variant' },
  entities: [{ id: 'L1', type: 'loss', at: 6, attrs: { type: 'tripleDup' } }],
  streams: [{ name: 'variants', values: ['Reno', 'Tahoe'] }],
}
const tcpTrace = run(cmpTcp.compile(tcpDoc))
const r6 = tcpTrace[5].lanes
const renoAt6 = (r6[0].state as TcpState).cwnd
const tahoeAt6 = (r6[1].state as TcpState).cwnd
console.log(`      第 6 轮（丢包轮）：Reno cwnd=${renoAt6}  Tahoe cwnd=${tahoeAt6}`)
tcpTrace.length === 12 && renoAt6 === 8 && tahoeAt6 === 1
  ? ok('同一 compare 原语套 TCP 内核：Reno 快恢复到 8，Tahoe 砍到 1 —— 两者分野正是考点')
  : bad(`TCP 对比不对：${tcpTrace.length} 步，Reno=${renoAt6}(应8) Tahoe=${tahoeAt6}(应1)`)

// ── 6. 自检必须能红 ────────────────────────────────────
console.log('\n  自检：')
const tampered = trace.map((s, i) => (i === 2 ? { ...visible(s, COMPARE_VISIBLE), log: 'X' } : visible(s, COMPARE_VISIBLE)))
compareTraces(tampered, trace.map(s => visible(s, COMPARE_VISIBLE)), { kind: 'exact' }, 'c').length > 0
  ? ok('篡改第 2 步被抓到')
  : bad('篡改没被抓到')

// 两个 variant 填成一样，两道轨迹必须完全相同 —— 否则说明 varyParam 没生效
const same: SimDocument = JSON.parse(JSON.stringify(doc))
same.streams[1].values = ['LRU', 'LRU']
const st = run(cmpCache.compile(same))
JSON.stringify(st.map(s => (s.lanes[0].state as CacheState)?.outcome))
  === JSON.stringify(st.map(s => (s.lanes[1].state as CacheState)?.outcome))
  ? ok('两道填同一策略时轨迹完全相同 —— varyParam 确实只改那一个参数')
  : bad('两道填同一策略却跑出不同结果 —— varyParam 泄漏到别处了')

console.log(`\n${'─'.repeat(52)}`)
console.log(failures === 0 ? 'L2 组合原语：通过' : `L2 组合原语：失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
