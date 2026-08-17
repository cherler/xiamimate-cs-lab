/**
 * 验 parameter 轴 —— 四种轴里最后一个没跑过的。
 *
 * 三件事：
 *   1. 高阶内核（扫描包住 cache）能不能在现有 Kernel 接口里表达
 *   2. 命中率随相联度变化的曲线，数值对不对
 *   3. parameter 轴的轨迹能不能也满足确定性重放
 */
import { run, resume } from '../src/core/kernel.ts'
import { compareTraces, visible } from '../src/core/verify.ts'
import { cacheKernel, type CacheState } from '../src/kernels/cache.ts'
import { makeSweepKernel, SWEEP_VISIBLE } from '../src/kernels/sweep.ts'
import type { SimDocument } from '../src/core/document.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

// ── 会产生冲突缺失的访问序列：三个地址落同一组 ────────
// 16B 块 · 组数由相联度决定。0x000 / 0x100 / 0x200 在低相联度下互相踢
const SEQ = [
  0x000, 0x100, 0x200, 0x000, 0x100, 0x200,
  0x000, 0x100, 0x200, 0x000, 0x100, 0x200,
]

const sweepDoc: SimDocument = {
  kind: 'sweep:cache',
  params: {
    addressBits: 32,
    cacheSizeBytes: 256,
    blockSizeBytes: 16,
    replacement: 'LRU',
    sweepParam: 'associativity',
  },
  entities: [],
  streams: [
    { name: 'accessSequence', values: SEQ },
    { name: 'sweepValues', values: [1, 2, 4, 8, 16] },
  ],
}

const cacheSweep = makeSweepKernel<CacheState>(
  cacheKernel,
  (f, n) => `命中率 ${((f.hits / n) * 100).toFixed(1)}%（${f.hits}/${n}）`,
)

console.log('\n【parameter 轴】命中率随相联度扫描')

const model = cacheSweep.compile(sweepDoc)
const trace = run(model)

// ── 1. 轴类型正确 ────────────────────────────────────
model.axis.kind === 'parameter' && model.axis.label === 'associativity'
  ? ok(`轴 = { kind: 'parameter', label: '${model.axis.label}' }`)
  : bad(`轴不对：${JSON.stringify(model.axis)}`)

// ── 2. 高阶内核跑通，每步是一整轮内层仿真 ─────────────
for (const s of trace) console.log(`      ${s.log}`)

trace.length === 5 && trace.every(s => s.steps === SEQ.length)
  ? ok(`5 个扫描点，每点内层跑满 ${SEQ.length} 步`)
  : bad(`扫描点数或内层步数不对：${trace.map(s => s.steps).join(',')}`)

// ── 3. 数值必须对：手算基准 ───────────────────────────
// 相联度 1 → 8 组，三个地址 tag 不同但组号相同 → 每次都冲突缺失 → 0 命中
// 相联度 ≥ 4 → 同组能同时容纳三者 → 前 3 次冷缺失，后 9 次全命中 = 75%
const hitRates = trace.map(s => +(s.final.hits / s.steps * 100).toFixed(1))
console.log(`      命中率序列 = [${hitRates.join(', ')}]`)

hitRates[0] === 0
  ? ok('相联度 1：三地址同组互踢，0% 命中（冲突缺失的教学点）')
  : bad(`相联度 1 应为 0%，实际 ${hitRates[0]}%`)

hitRates[2] === 75 && hitRates[3] === 75 && hitRates[4] === 75
  ? ok('相联度 ≥4：仅 3 次冷缺失，75% 命中')
  : bad(`相联度 ≥4 应为 75%，实际 ${hitRates.slice(2).join(',')}%`)

const monotone = hitRates.every((v, i) => i === 0 || v >= hitRates[i - 1])
monotone
  ? ok('曲线单调不降 —— 相联度增加不会让命中率变差')
  : bad(`曲线非单调：${hitRates.join(',')}`)

// ── 4. parameter 轴也要满足确定性重放 ─────────────────
const k = 2
const m2 = cacheSweep.compile(sweepDoc)
const head: unknown[] = []
let prev: ReturnType<typeof run<never>>[number] | null = null
for (let i = 0; i < k; i++) {
  const r = m2.step(prev as never)
  if (!r) break
  head.push(r.state)
  prev = r.state as never
}
const revived = JSON.parse(JSON.stringify(prev))
const tail = resume(cacheSweep.compile(sweepDoc), revived)

const rejoined = [...head, ...tail].map(s => visible(s as object, SWEEP_VISIBLE))
const full = trace.map(s => visible(s, SWEEP_VISIBLE))
const v = compareTraces(rejoined, full, { kind: 'exact' }, 'sweep')
v.length === 0
  ? ok(`确定性重放：第 ${k} 步截断 → JSON 往返 → 续跑，轨迹一致`)
  : bad(`重放不一致：${v[0].location} ${v[0].message}`)

// ── 5. 自检必须能红 ──────────────────────────────────
const tampered = full.map((s, i) => (i === 1 ? { ...s, value: 999 } : s))
compareTraces(tampered, full, { kind: 'exact' }, 'sweep').length > 0
  ? ok('自检变红：篡改第 1 个扫描点被抓到')
  : bad('自检没变红 —— parameter 轴的比对形同虚设')

console.log(`\n${'─'.repeat(52)}`)
console.log(failures === 0 ? 'parameter 轴：通过' : `parameter 轴：失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
