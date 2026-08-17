/**
 * 验收标准 6：DSL 是唯一入口。
 *
 * 检验方式：把 doc 序列化成 JSON 字符串、丢掉原对象、从字符串重建，
 * 产出的轨迹必须逐字段一致 —— 说明实验完全由 JSON 决定。
 *
 * 更强的一步：改 JSON 里的任一参数，轨迹必须跟着变。
 * 不变就说明那个参数其实没起作用（配置藏在代码里了）。
 *
 * 自检必须能红：造一个"从模块常量读配置"的内核，改 doc 对它无效，必须被抓住。
 */
import { run } from '../src/core/kernel.ts'
import { compareTraces, visible } from '../src/core/verify.ts'
import { num, str, type SimDocument } from '../src/core/document.ts'
import type { Kernel, CompiledModel } from '../src/core/kernel.ts'
import { cacheKernel, CACHE_VISIBLE } from '../src/kernels/cache.ts'
import { schedKernel, SCHED_VISIBLE } from '../src/kernels/scheduler.ts'
import { tcpKernel, TCP_VISIBLE } from '../src/kernels/tcp.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

const DOCS: Record<string, SimDocument> = {
  cache: {
    kind: 'cache',
    params: { addressBits: 32, cacheSizeBytes: 256, blockSizeBytes: 16, associativity: 2, replacement: 'LRU' },
    entities: [],
    streams: [{ name: 'accessSequence', values: [0x00, 0x10, 0x20, 0x00, 0x110, 0x210, 0x10, 0x20] }],
  },
  sched: {
    kind: 'scheduler',
    params: { algorithm: 'SRTF', quantum: 2 },
    entities: [
      { id: 'P1', type: 'process', at: 0, attrs: { burst: 7 } },
      { id: 'P2', type: 'process', at: 2, attrs: { burst: 4 } },
      { id: 'P3', type: 'process', at: 4, attrs: { burst: 1 } },
      { id: 'P4', type: 'process', at: 5, attrs: { burst: 4 } },
    ],
    streams: [],
  },
  tcp: {
    kind: 'tcp',
    params: { variant: 'Reno', initialCwnd: 1, initialSsthresh: 16, rounds: 14 },
    entities: [
      { id: 'L1', type: 'loss', at: 7, attrs: { type: 'tripleDup' } },
      { id: 'L2', type: 'loss', at: 11, attrs: { type: 'timeout' } },
    ],
    streams: [],
  },
}

const KERNELS = { cache: cacheKernel, sched: schedKernel, tcp: tcpKernel } as never as
  Record<string, Kernel<object>>
const VIS: Record<string, readonly string[]> = {
  cache: CACHE_VISIBLE, sched: SCHED_VISIBLE, tcp: TCP_VISIBLE,
}

console.log('\n【验收标准 6】DSL 是唯一入口')

// ── 1. JSON 往返后轨迹必须一致 ────────────────────────
for (const [name, doc] of Object.entries(DOCS)) {
  const original = run(KERNELS[name].compile(doc)).map(s => visible(s, VIS[name]))
  const wire = JSON.stringify(doc)               // ← 丢掉原对象，只剩字符串
  const rebuilt = run(KERNELS[name].compile(JSON.parse(wire))).map(s => visible(s, VIS[name]))
  const v = compareTraces(rebuilt, original, { kind: 'exact' }, name)
  v.length === 0
    ? ok(`${name.padEnd(6)} JSON 往返重建，轨迹一致（${wire.length} 字节完整描述该实验）`)
    : bad(`${name} JSON 往返后轨迹变了：${v[0].location}`)
}

// ── 2. 改 JSON 里的参数，轨迹必须跟着变 ────────────────
console.log('\n  每个参数都要真的起作用：')

const MUTATIONS: [string, string, (d: SimDocument) => void][] = [
  ['cache', 'associativity 2→1',  d => { d.params.associativity = 1 }],
  ['cache', 'replacement LRU→FIFO', d => { d.params.replacement = 'FIFO' }],
  ['cache', 'blockSizeBytes 16→32', d => { d.params.blockSizeBytes = 32 }],
  ['sched', 'algorithm SRTF→FCFS', d => { d.params.algorithm = 'FCFS' }],
  ['sched', 'P2 到达 2→0',         d => { d.entities[1].at = 0 }],
  ['tcp',   'variant Reno→Tahoe',  d => { d.params.variant = 'Tahoe' }],
  ['tcp',   '丢包轮次 7→5',        d => { d.entities[0].at = 5 }],
]

for (const [name, label, mutate] of MUTATIONS) {
  const base = run(KERNELS[name].compile(DOCS[name])).map(s => visible(s, VIS[name]))
  const mutated: SimDocument = JSON.parse(JSON.stringify(DOCS[name]))
  mutate(mutated)
  const after = run(KERNELS[name].compile(mutated)).map(s => visible(s, VIS[name]))
  const diff = compareTraces(after, base, { kind: 'exact' }, name)
  diff.length > 0
    ? ok(`${label.padEnd(22)} → 轨迹变了（首处 ${diff[0].location}）`)
    : bad(`${label} → 轨迹没变！这个参数其实没起作用`)
}

// ── 3. 自检必须能红 ───────────────────────────────────
console.log('\n  自检：配置藏在代码里的内核必须被抓住')

/** 坏内核：轮次写死在模块常量里，不读 doc.params.rounds */
const HARDCODED_ROUNDS = 6
const leakyKernel: Kernel<{ round: number; cwnd: number }> = {
  kind: 'leaky',
  compile(doc: SimDocument): CompiledModel<{ round: number; cwnd: number }> {
    const initialCwnd = num(doc.params, 'initialCwnd')   // 这个读了 doc
    void str(doc.params, 'variant')
    return {
      axis: { kind: 'time', label: '轮次' },
      initial: () => ({ round: 0, cwnd: initialCwnd }),
      describe: s => `第 ${s.round} 轮`,
      step(prev) {
        const base = prev ?? this.initial()
        const round = base.round + 1
        if (round > HARDCODED_ROUNDS) return null        // ← 但轮次写死了
        return { state: { round, cwnd: base.cwnd * 2 }, done: round === HARDCODED_ROUNDS }
      },
    }
  },
}

const leakyBase = run(leakyKernel.compile(DOCS.tcp))
const leakyDoc: SimDocument = JSON.parse(JSON.stringify(DOCS.tcp))
leakyDoc.params.rounds = 30                              // 改 doc
const leakyAfter = run(leakyKernel.compile(leakyDoc))

leakyAfter.length === leakyBase.length
  ? ok(`自检变红：改 rounds 14→30，坏内核轨迹长度纹丝不动（都是 ${leakyBase.length} 步）—— 抓到配置泄漏`)
  : bad('自检没变红 —— 泄漏检测没有鉴别力')

// 对照：好内核改了就会变
const goodBase = run(tcpKernel.compile(DOCS.tcp))
const goodDoc: SimDocument = JSON.parse(JSON.stringify(DOCS.tcp))
goodDoc.params.rounds = 30
const goodAfter = run(tcpKernel.compile(goodDoc))
goodAfter.length === 30 && goodBase.length === 14
  ? ok(`对照：真内核 rounds 14→30 轨迹从 ${goodBase.length} 步变 ${goodAfter.length} 步`)
  : bad(`对照失败：${goodBase.length} → ${goodAfter.length}`)

console.log(`\n${'─'.repeat(52)}`)
console.log(failures === 0 ? '验收标准 6：通过' : `验收标准 6：失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
