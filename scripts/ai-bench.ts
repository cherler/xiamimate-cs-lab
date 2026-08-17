/**
 * AI 填 DSL 的基准测试 —— 统计填对率，不看单点。
 *
 *   npm run ai:bench            跑一遍
 *   npm run ai:bench -- 3       每题跑 3 次，看稳定性
 *
 * 会花钱。跑之前先自检参考答案 —— 参考答案错了，整个基准就是在量错的东西。
 */
import { run } from '../src/core/kernel.ts'
import { compareTraces, visible } from '../src/core/verify.ts'
import type { SimDocument } from '../src/core/document.ts'
import { SCHEMAS, validateDocument, normalizeDocument } from '../src/ai/schema.ts'
import { makeClient, fillWithRetry, probeMode, type Mode } from '../src/ai/fill.ts'
import { cacheKernel, CACHE_VISIBLE } from '../src/kernels/cache.ts'
import { schedKernel, SCHED_VISIBLE } from '../src/kernels/scheduler.ts'
import { tcpKernel, TCP_VISIBLE } from '../src/kernels/tcp.ts'
import { EXACT_CASES, TRAPS, AMBIGUOUS } from './cases.ts'

process.loadEnvFile('.env')

const REPEATS = Number(process.argv[2] ?? 1)
const CONCURRENCY = 3

const client = makeClient()
const MODEL = process.env.MINIMAX_MODEL!

const KERNELS = { cache: cacheKernel, scheduler: schedKernel, tcp: tcpKernel } as never as
  Record<string, { compile: (d: SimDocument) => never }>
const VIS: Record<string, readonly string[]> = {
  cache: CACHE_VISIBLE, scheduler: SCHED_VISIBLE, tcp: TCP_VISIBLE,
}

const traceOf = (kind: string, doc: SimDocument) =>
  run(KERNELS[kind].compile(doc)).map(s => visible(s as object, VIS[kind]))

// ═══ 第零步：自检参考答案 ══════════════════════════════
console.log('═'.repeat(60))
console.log('【第零步】自检 —— 我手写的参考答案本身对不对')

let refBad = 0
for (const c of EXACT_CASES) {
  const v = validateDocument(c.reference)
  if (v.length > 0) {
    refBad++
    console.log(`  ❌ ${c.name}：参考答案自己就非法 —— ${v[0].location} ${v[0].message}`)
    continue
  }
  try {
    const t = traceOf(c.kind, c.reference)
    if (t.length === 0) { refBad++; console.log(`  ❌ ${c.name}：参考答案跑出空轨迹`) }
  } catch (e) {
    refBad++
    console.log(`  ❌ ${c.name}：参考答案跑不起来 —— ${(e as Error).message.slice(0, 70)}`)
  }
}
if (refBad > 0) {
  console.log(`\n参考答案有 ${refBad} 个有问题，先修好再花钱跑 AI。`)
  process.exit(1)
}
console.log(`  ✅ ${EXACT_CASES.length} 个参考答案全部合法且能跑出非空轨迹`)

// ═══ 探测可用的结构化输出方式 ══════════════════════════
console.log(`\n${'═'.repeat(60)}`)
console.log(`【探测】${MODEL} @ ${process.env.MINIMAX_BASE_URL}`)
const mode: Mode | null = await probeMode(
  client, MODEL, EXACT_CASES[0].problem, SCHEMAS.cache, s => console.log(s))
if (!mode) { console.log('三种方式全部失败'); process.exit(1) }


// ═══ 并发跑 ════════════════════════════════════════════
async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  }))
  return out
}

type Outcome = { okDoc: boolean; okTrace: boolean; ms: number; note: string; doc?: SimDocument }

async function attempt(c: typeof EXACT_CASES[number]): Promise<Outcome> {
  const t0 = Date.now()
  try {
    const { doc: rawDoc, attempts } = await fillWithRetry(client, MODEL, c.problem, SCHEMAS[c.kind], mode!)
    const doc = normalizeDocument(rawDoc)
    const ms = Date.now() - t0
    const retryNote = attempts > 1 ? `（重试 ${attempts} 次）` : ''
    const bad = validateDocument(doc)
    if (bad.length > 0)
      return { okDoc: false, okTrace: false, ms, note: `验证器拦下 ${bad[0].location}: ${bad[0].message}`, doc }
    const diff = compareTraces(traceOf(c.kind, doc), traceOf(c.kind, c.reference), { kind: 'exact' }, c.kind)
    return diff.length === 0
      ? { okDoc: true, okTrace: true, ms, note: retryNote, doc }
      : { okDoc: true, okTrace: false, ms, note: `轨迹差 ${diff.length} 处，首处 ${diff[0].location}`, doc }
  } catch (e) {
    return { okDoc: false, okTrace: false, ms: Date.now() - t0, note: `调用失败 ${(e as Error).message.slice(0, 60)}` }
  }
}

console.log(`\n${'═'.repeat(60)}`)
console.log(`【A/B/C】${EXACT_CASES.length} 道精确题 × ${REPEATS} 次，并发 ${CONCURRENCY}`)

const jobs = EXACT_CASES.flatMap(c => Array.from({ length: REPEATS }, () => c))
const results = await pool(jobs, CONCURRENCY, attempt)

const byCase = new Map<string, { c: typeof EXACT_CASES[number]; runs: Outcome[] }>()
jobs.forEach((c, i) => {
  const e = byCase.get(c.name) ?? { c, runs: [] }
  e.runs.push(results[i]); byCase.set(c.name, e)
})

const catStat: Record<string, { pass: number; total: number }> = {}
const latencies: number[] = []

for (const [name, { c, runs }] of byCase) {
  const passed = runs.filter(r => r.okTrace).length
  catStat[c.cat] ??= { pass: 0, total: 0 }
  catStat[c.cat].pass += passed
  catStat[c.cat].total += runs.length
  runs.forEach(r => latencies.push(r.ms))

  const mark = passed === runs.length ? '✅' : passed === 0 ? '❌' : '⚠️ '
  const rate = REPEATS > 1 ? ` ${passed}/${runs.length}` : ''
  const rn = runs.find(r => r.note.startsWith('（重试'))?.note ?? ''
  console.log(`  ${mark} [${c.cat}]${rate} ${name}${rn}`)
  if (passed < runs.length) {
    const f = runs.find(r => !r.okTrace)!
    console.log(`        ${f.note}`)
    if (f.doc) {
      console.log(`        AI  : ${JSON.stringify(f.doc.params)}`)
      console.log(`        参考: ${JSON.stringify(c.reference.params)}`)
      if (c.kind === 'cache') {
        const a = f.doc.streams.find(s => s.name === 'accessSequence')?.values
        const b = c.reference.streams.find(s => s.name === 'accessSequence')?.values
        if (JSON.stringify(a) !== JSON.stringify(b))
          console.log(`        序列 AI ${JSON.stringify(a)} vs 参考 ${JSON.stringify(b)}`)
      } else if (JSON.stringify(f.doc.entities) !== JSON.stringify(c.reference.entities)) {
        console.log(`        实体 AI ${JSON.stringify(f.doc.entities)}`)
        console.log(`             参考 ${JSON.stringify(c.reference.entities)}`)
      }
    }
  }
}

// ═══ D · 陷阱题 ════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`)
console.log(`【D】${TRAPS.length} 道陷阱题 —— 验证器必须拦下`)

const trapOut = await pool(TRAPS, CONCURRENCY, async t => {
  try {
    const { doc: rawDoc } = await fillWithRetry(client, MODEL, t.problem, SCHEMAS[t.kind], mode!)
    const doc = normalizeDocument(rawDoc)
    return { t, bad: validateDocument(doc), doc, err: undefined as string | undefined }
  } catch (e) { return { t, bad: [], doc: undefined, err: (e as Error).message } }
})

let caught = 0
let trapErrored = 0
for (const { t, bad, doc, err } of trapOut) {
  if (err !== undefined) {
    // 调用失败 ≠ 验证器放行。这两件事必须分开报，否则会把网络抖动当成验证器有洞。
    trapErrored++
    console.log(`  ⛔ ${t.name} —— 调用失败，本题无结论：${err.slice(0, 70)}`)
  } else if (bad.length === 0) {
    console.log(`  ❌ ${t.name} —— 放行了！AI 填的 ${JSON.stringify(doc?.params)}`)
  } else {
    const hit = bad.some(b => b.location.includes(t.expectField))
    if (hit) caught++
    console.log(`  ${hit ? '✅' : '⚠️ '} ${t.name} —— 拦下 ${bad.length} 条：${bad[0].location} ${bad[0].message}`)
  }
}

// ═══ E · 歧义题（只记录）═══════════════════════════════
console.log(`\n${'═'.repeat(60)}`)
console.log(`【E】${AMBIGUOUS.length} 道歧义题 —— 不判对错，只看模型怎么补`)

const ambOut = await pool(AMBIGUOUS, CONCURRENCY, async a => {
  try {
    const { doc: rawDoc } = await fillWithRetry(client, MODEL, a.problem, SCHEMAS[a.kind], mode!)
    const doc = normalizeDocument(rawDoc)
    return { a, doc, bad: validateDocument(doc) }
  } catch (e) { return { a, doc: undefined, bad: [], err: (e as Error).message } }
})

for (const { a, doc, bad } of ambOut) {
  const picked = a.watch.map(w => {
    const [top, key] = w.split('.')
    const v = key ? (doc as never as Record<string, Record<string, unknown>>)?.[top]?.[key]
                  : (doc as never as Record<string, unknown>)?.[top]
    return `${w}=${JSON.stringify(v)}`
  }).join('  ')
  console.log(`  · ${a.name}`)
  console.log(`      模型补了：${picked}`)
  if (bad.length > 0) console.log(`      验证器：拦下 ${bad[0].location} ${bad[0].message}`)
}

// ═══ 汇总 ══════════════════════════════════════════════
latencies.sort((x, y) => x - y)
const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))]

console.log(`\n${'═'.repeat(60)}`)
console.log('【汇总】')
const CATNAME: Record<string, string> = { A: '标准题', B: '变体题', C: '表述变体' }
let allPass = 0, allTotal = 0
for (const cat of ['A', 'B', 'C']) {
  const s = catStat[cat]
  if (!s) continue
  allPass += s.pass; allTotal += s.total
  console.log(`  ${cat} ${CATNAME[cat]}   ${s.pass}/${s.total}  ${(s.pass / s.total * 100).toFixed(0)}%`)
}
console.log(`  ─────────────────────`)
console.log(`  精确题合计 ${allPass}/${allTotal}  ${(allPass / allTotal * 100).toFixed(1)}%`)
console.log(`  陷阱题拦下 ${caught}/${TRAPS.length - trapErrored}` +
  (trapErrored ? `（另有 ${trapErrored} 道因调用失败无结论）` : ''))
console.log(`  延迟 中位 ${(pct(0.5) / 1000).toFixed(1)}s · P90 ${(pct(0.9) / 1000).toFixed(1)}s · 最慢 ${(latencies[latencies.length - 1] / 1000).toFixed(1)}s`)
