/**
 * 阶段 0 的判决：统一 schema 产出的轨迹，必须跟三个独立参考实现逐字段相同。
 * 顺带验收标准 2（确定性重放）+ 标准 2/4 的失败自检。
 */
import { run, resume, type CompiledModel } from '../src/core/kernel.ts'
import { compareTraces, visible, type Violation } from '../src/core/verify.ts'
import type { SimDocument } from '../src/core/document.ts'

import { cacheKernel, CACHE_VISIBLE, type CacheState } from '../src/kernels/cache.ts'
import { schedKernel, SCHED_VISIBLE, type SchedState } from '../src/kernels/scheduler.ts'
import { tcpKernel, TCP_VISIBLE, type TcpState } from '../src/kernels/tcp.ts'

import { runCache, type CacheDSL } from '../src/reference/cache.ts'
import { runScheduler, type SchedulerDSL } from '../src/reference/scheduler.ts'
import { runTcp, type TcpDSL } from '../src/reference/tcp.ts'

let failures = 0
function report(name: string, v: Violation[]) {
  if (v.length === 0) { console.log(`  ✅ ${name}`); return }
  failures++
  console.log(`  ❌ ${name}`)
  for (const x of v.slice(0, 3)) {
    console.log(`      ${x.location}: ${x.message}`)
    console.log(`        期望 ${JSON.stringify(x.expected)}`)
    console.log(`        实际 ${JSON.stringify(x.actual)}`)
  }
}

// ═══ 同一个实验的两种表达 ══════════════════════════════
const ACCESS = [0x00, 0x10, 0x20, 0x00, 0x110, 0x210, 0x10, 0x20]

const cacheDoc: SimDocument = {
  kind: 'cache',
  params: { addressBits: 32, cacheSizeBytes: 256, blockSizeBytes: 16, associativity: 2, replacement: 'LRU' },
  entities: [],
  streams: [{ name: 'accessSequence', values: ACCESS }],
}
const cacheRef: CacheDSL = {
  kind: 'cache', addressBits: 32, cacheSizeBytes: 256, blockSizeBytes: 16,
  associativity: 2, replacement: 'LRU', accessSequence: ACCESS,
}

const PROCS = [
  { id: 'P1', arrival: 0, burst: 7 }, { id: 'P2', arrival: 2, burst: 4 },
  { id: 'P3', arrival: 4, burst: 1 }, { id: 'P4', arrival: 5, burst: 4 },
]
const schedDoc: SimDocument = {
  kind: 'scheduler',
  params: { algorithm: 'SRTF', quantum: 2 },
  entities: PROCS.map(p => ({ id: p.id, type: 'process', at: p.arrival, attrs: { burst: p.burst } })),
  streams: [],
}
const schedRef: SchedulerDSL = { kind: 'scheduler', algorithm: 'SRTF', quantum: 2, processes: PROCS }

const LOSSES = [{ round: 7, type: 'tripleDup' as const }, { round: 11, type: 'timeout' as const }]
const tcpDoc: SimDocument = {
  kind: 'tcp',
  params: { variant: 'Reno', initialCwnd: 1, initialSsthresh: 16, rounds: 14 },
  entities: LOSSES.map((l, i) => ({ id: `L${i + 1}`, type: 'loss', at: l.round, attrs: { type: l.type } })),
  streams: [],
}
const tcpRef: TcpDSL = {
  kind: 'tcp', variant: 'Reno', initialCwnd: 1, initialSsthresh: 16, rounds: 14, lossEvents: LOSSES,
}

// ═══ 测试 1：统一管线 ≡ 独立参考实现 ═══════════════════
console.log('\n【测试 1】统一 schema 的轨迹 vs 独立参考实现（exact 比较器）')

report('Cache  8 步', compareTraces(
  run(cacheKernel.compile(cacheDoc)).map(s => visible(s, CACHE_VISIBLE)),
  runCache(cacheRef).map(s => visible(s, CACHE_VISIBLE)),
  { kind: 'exact' }, 'cache'))

report('调度   16 步', compareTraces(
  run(schedKernel.compile(schedDoc)).map(s => visible(s, SCHED_VISIBLE)),
  runScheduler(schedRef).map(s => visible(s, SCHED_VISIBLE)),
  { kind: 'exact' }, 'sched'))

report('TCP    14 步', compareTraces(
  run(tcpKernel.compile(tcpDoc)).map(s => visible(s, TCP_VISIBLE)),
  runTcp(tcpRef).map(s => visible(s, TCP_VISIBLE)),
  { kind: 'exact' }, 'tcp'))

// ═══ 测试 2：验收标准 2 —— 确定性重放 ══════════════════
console.log('\n【测试 2】验收标准 2：中途 dump → JSON 往返 → 续跑')

function replayTest<S extends object>(
  name: string, model: CompiledModel<S>, fresh: () => CompiledModel<S>,
  visKeys: readonly string[], k: number,
) {
  const full = run(model)
  const m2 = fresh()
  const head: S[] = []
  let prev: S | null = null
  for (let i = 0; i < k; i++) {
    const r = m2.step(prev)
    if (!r) break
    head.push(r.state); prev = r.state
  }
  const revived = JSON.parse(JSON.stringify(prev)) as S   // ← 真的过一遍 JSON
  const tail = resume(fresh(), revived)
  report(`${name}（第 ${k} 步截断）`, compareTraces(
    [...head, ...tail].map(s => visible(s, visKeys)),
    full.map(s => visible(s, visKeys)),
    { kind: 'exact' }, name))
}

replayTest<CacheState>('Cache 重放', cacheKernel.compile(cacheDoc), () => cacheKernel.compile(cacheDoc), CACHE_VISIBLE, 4)
replayTest<SchedState>('调度 重放', schedKernel.compile(schedDoc), () => schedKernel.compile(schedDoc), SCHED_VISIBLE, 7)
replayTest<TcpState>('TCP 重放', tcpKernel.compile(tcpDoc), () => tcpKernel.compile(tcpDoc), TCP_VISIBLE, 6)

// ═══ 测试 3：自检必须能红 ══════════════════════════════
console.log('\n【测试 3】失败自检 —— 故意做错的版本必须被抓住')

const tcpTrace = run(tcpKernel.compile(tcpDoc)).map(s => visible(s, TCP_VISIBLE))

// 3a. 标准 4：末态对、中间过程错
const tampered = tcpTrace.map((s, i) =>
  i > 0 && i < tcpTrace.length - 1 ? { ...s, cwnd: 999 } : s)
const v4 = compareTraces(tampered, tcpTrace, { kind: 'exact' }, 'tcp')
v4.length > 0
  ? console.log(`  ✅ 标准4自检变红：中间过程被篡改，抓到 ${v4.length} 处（首处 ${v4[0].location}）`)
  : (failures++, console.log('  ❌ 标准4自检没变红 —— 比对只看了末态'))

// 3b. 标准 2：往 step 里塞随机源
function dirtyRun() {
  const m = tcpKernel.compile(tcpDoc)
  const orig = m.step.bind(m)
  m.step = p => { const r = orig(p); return r && { ...r, state: { ...r.state, cwnd: r.state.cwnd + Math.random() } } }
  return run(m).map(s => visible(s, TCP_VISIBLE))
}
const v2 = compareTraces(dirtyRun(), dirtyRun(), { kind: 'exact' }, 'tcp')
v2.length > 0
  ? console.log(`  ✅ 标准2自检变红：step 里有随机源，两次运行对不上（首处 ${v2[0].location}）`)
  : (failures++, console.log('  ❌ 标准2自检没变红 —— 确定性检查形同虚设'))

// 3c. tolerance 比较器：放过噪声，抓住真差异
const base = [{ x: 1.0 }, { x: 2.0 }]
const okNoise = compareTraces([{ x: 1.0000001 }, { x: 2.0000001 }], base, { kind: 'tolerance', eps: 1e-5 }, 'f').length === 0
const catchReal = compareTraces([{ x: 1.0 }, { x: 2.5 }], base, { kind: 'tolerance', eps: 1e-5 }, 'f').length > 0
okNoise && catchReal
  ? console.log('  ✅ tolerance 比较器：放过 1e-7 噪声，抓住 0.5 真差异')
  : (failures++, console.log('  ❌ tolerance 比较器行为不对'))

// ═══ 判决 ══════════════════════════════════════════════
console.log(`\n${'─'.repeat(52)}`)
console.log(failures === 0
  ? '阶段 0 收敛：通过 —— 一个 schema 表达三个实验，轨迹逐字段一致'
  : `阶段 0 收敛：失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
