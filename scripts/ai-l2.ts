/**
 * L2 组合级验证：给模型全部 6 个原语工具，让它自己判断该用哪个。
 *
 * 判据两层：
 *   1. 选对原语（单实验 vs 并排对比）—— 这是 L2 独有的
 *   2. 填对参数 —— 轨迹 ≡ 手写参考 doc
 *
 * 关键是**混着考**：如果只给对比题，模型全选 compare 也能满分。
 * 必须掺进单实验题，才知道它是真会判断还是在蒙。
 *
 *   npm run ai:l2          跑一遍
 *   npm run ai:l2 -- 3     每题 3 次
 */
import { run } from '../src/core/kernel.ts'
import { compareTraces, visible } from '../src/core/verify.ts'
import type { SimDocument } from '../src/core/document.ts'
import { SCHEMAS, validateDocument, normalizeDocument } from '../src/ai/schema.ts'
import { makeClient, fillMultiTool } from '../src/ai/fill.ts'
import { cacheKernel, CACHE_VISIBLE } from '../src/kernels/cache.ts'
import { schedKernel, SCHED_VISIBLE } from '../src/kernels/scheduler.ts'
import { tcpKernel, TCP_VISIBLE } from '../src/kernels/tcp.ts'
import { makeCompareKernel, COMPARE_VISIBLE } from '../src/kernels/compare.ts'
import { L2_CASES } from './cases-l2.ts'

process.loadEnvFile('.env')

const REPEATS = Number(process.argv[2] ?? 1)
const CONCURRENCY = 3
const client = makeClient()
const MODEL = process.env.MINIMAX_MODEL!

const BASE = { cache: cacheKernel, scheduler: schedKernel, tcp: tcpKernel } as never as
  Record<string, Parameters<typeof makeCompareKernel>[0]>
const BASE_VIS: Record<string, readonly string[]> = {
  cache: CACHE_VISIBLE, scheduler: SCHED_VISIBLE, tcp: TCP_VISIBLE,
}

function kernelFor(kind: string) {
  if (kind.startsWith('compare:')) {
    const inner = kind.slice('compare:'.length)
    return {
      k: makeCompareKernel(BASE[inner], (l, s) => `${l} ${JSON.stringify(s)}`),
      vis: COMPARE_VISIBLE as readonly string[],
    }
  }
  return { k: BASE[kind], vis: BASE_VIS[kind] }
}

const traceOf = (kind: string, doc: SimDocument) => {
  const { k, vis } = kernelFor(kind)
  return run(k.compile(doc)).map(s => visible(s as object, vis))
}

// ═══ 第零步：自检参考答案 ══════════════════════════════
console.log('═'.repeat(62))
console.log('【第零步】自检 —— 参考答案本身对不对')
let refBad = 0
for (const c of L2_CASES) {
  const v = validateDocument(c.reference)
  if (v.length > 0) { refBad++; console.log(`  ❌ ${c.name}：${v[0].location} ${v[0].message}`); continue }
  try {
    if (traceOf(c.expectKind, c.reference).length === 0) {
      refBad++; console.log(`  ❌ ${c.name}：跑出空轨迹`)
    }
  } catch (e) { refBad++; console.log(`  ❌ ${c.name}：${(e as Error).message.slice(0, 70)}`) }
}
if (refBad > 0) { console.log(`\n参考答案有 ${refBad} 个有问题，先修好。`); process.exit(1) }
console.log(`  ✅ ${L2_CASES.length} 个参考答案全部合法`)

// ═══ 跑 ════════════════════════════════════════════════
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i]) }
  }))
  return out
}

type Res = { pickedRight: boolean; traceRight: boolean; picked: string; note: string; ms: number }

async function attempt(c: typeof L2_CASES[number]): Promise<Res> {
  try {
    const { kind, doc: raw, ms } = await fillMultiTool(client, MODEL, c.problem, SCHEMAS)
    const doc = normalizeDocument(raw)
    const pickedRight = kind === c.expectKind
    if (!pickedRight)
      return { pickedRight, traceRight: false, picked: kind, ms, note: `选错原语（该用 ${c.expectKind}）` }
    const bad = validateDocument(doc)
    if (bad.length > 0)
      return { pickedRight, traceRight: false, picked: kind, ms, note: `验证器拦下 ${bad[0].location}: ${bad[0].message}` }
    const diff = compareTraces(traceOf(kind, doc), traceOf(kind, c.reference), { kind: 'exact' }, kind)
    return diff.length === 0
      ? { pickedRight, traceRight: true, picked: kind, ms, note: '' }
      : { pickedRight, traceRight: false, picked: kind, ms, note: `轨迹差 ${diff.length} 处；AI params=${JSON.stringify(doc.params)}` }
  } catch (e) {
    return { pickedRight: false, traceRight: false, picked: '(失败)', ms: 0, note: `调用失败 ${(e as Error).message.slice(0, 60)}` }
  }
}

console.log(`\n${'═'.repeat(62)}`)
console.log(`【L2】${L2_CASES.length} 道题 × ${REPEATS} 次 —— 6 个工具混着给，模型自己选`)

const jobs = L2_CASES.flatMap(c => Array.from({ length: REPEATS }, () => c))
const results = await pool(jobs, CONCURRENCY, attempt)

const byCase = new Map<string, { c: typeof L2_CASES[number]; runs: Res[] }>()
jobs.forEach((c, i) => {
  const e = byCase.get(c.name) ?? { c, runs: [] }
  e.runs.push(results[i]); byCase.set(c.name, e)
})

let pickPass = 0, tracePass = 0, total = 0
const latencies: number[] = []
for (const [name, { c, runs }] of byCase) {
  const p = runs.filter(r => r.pickedRight).length
  const t = runs.filter(r => r.traceRight).length
  pickPass += p; tracePass += t; total += runs.length
  runs.forEach(r => r.ms && latencies.push(r.ms))
  const mark = t === runs.length ? '✅' : t === 0 ? '❌' : '⚠️ '
  const rate = REPEATS > 1 ? ` ${t}/${runs.length}` : ''
  console.log(`  ${mark} [${c.shape}]${rate} ${name}  → 选了 ${runs[0].picked}`)
  if (t < runs.length) {
    const f = runs.find(r => !r.traceRight)!
    console.log(`        ${f.note}`)
    console.log(`        参考 kind=${c.expectKind} params=${JSON.stringify(c.reference.params)}`)
  }
}

latencies.sort((a, b) => a - b)
const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0

console.log(`\n${'═'.repeat(62)}`)
console.log('【汇总】')
console.log(`  选对原语  ${pickPass}/${total}  ${(pickPass / total * 100).toFixed(1)}%`)
console.log(`  填对参数  ${tracePass}/${total}  ${(tracePass / total * 100).toFixed(1)}%   ← L2 真实通过率`)
console.log(`  延迟 中位 ${(pct(0.5) / 1000).toFixed(1)}s · P90 ${(pct(0.9) / 1000).toFixed(1)}s`)
