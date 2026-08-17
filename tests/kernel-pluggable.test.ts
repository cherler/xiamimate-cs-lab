/**
 * 验收标准 5：内核可插拔。
 *
 * 检验方式：拿几个"退化到极端"的内核塞进框架，框架必须都能正常处理。
 * 框架里只要藏了对具体内核的假设，这些极端内核就会把它炸出来。
 *
 * 自检必须能红：写一个"有隐含假设"的 run() 版本，它必须在同样的输入上失败。
 */
import { run, resume, type Kernel, type CompiledModel } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

const EMPTY_DOC: SimDocument = { kind: 'x', params: {}, entities: [], streams: [] }

// ── 退化内核 A：什么都不做，零步 ───────────────────────
const emptyKernel: Kernel<{ n: number }> = {
  kind: 'empty',
  compile: () => ({
    axis: { kind: 'step', label: '无' },
    initial: () => ({ n: 0 }),
    describe: () => '',
    step: () => null,          // 立刻结束
  }),
}

// ── 退化内核 B：只有一步 ───────────────────────────────
const oneShotKernel: Kernel<{ n: number }> = {
  kind: 'oneshot',
  compile: () => ({
    axis: { kind: 'step', label: '唯一一步' },
    initial: () => ({ n: 0 }),
    describe: s => `n=${s.n}`,
    step: prev => (prev === null ? { state: { n: 1 }, done: true } : null),
  }),
}

// ── 退化内核 C：永不结束（框架必须靠 maxSteps 兜住）────
const infiniteKernel: Kernel<{ n: number }> = {
  kind: 'infinite',
  compile: () => ({
    axis: { kind: 'time', label: '永动' },
    initial: () => ({ n: 0 }),
    describe: s => `n=${s.n}`,
    step: prev => ({ state: { n: (prev?.n ?? 0) + 1 }, done: false }),
  }),
}

// ── 退化内核 D：从不置 done，但会返回 null ─────────────
const nullTerminatedKernel: Kernel<{ n: number }> = {
  kind: 'null-terminated',
  compile: () => ({
    axis: { kind: 'step', label: '靠 null 收尾' },
    initial: () => ({ n: 0 }),
    describe: s => `n=${s.n}`,
    step: prev => {
      const n = (prev?.n ?? 0) + 1
      return n > 3 ? null : { state: { n }, done: false }
    },
  }),
}

console.log('\n【验收标准 5】内核可插拔 —— 极端退化内核压力测试')

const t1 = run(emptyKernel.compile(EMPTY_DOC))
t1.length === 0 ? ok('空内核：轨迹为空，框架没崩') : bad(`空内核应为 0 步，实际 ${t1.length}`)

const t2 = run(oneShotKernel.compile(EMPTY_DOC))
t2.length === 1 && t2[0].n === 1
  ? ok('单步内核：恰好 1 步') : bad(`单步内核应为 1 步，实际 ${t2.length}`)

const t3 = run(infiniteKernel.compile(EMPTY_DOC), 50)
t3.length === 50 && t3[49].n === 50
  ? ok('无限内核：被 maxSteps=50 兜住，没有跑飞') : bad(`无限内核应被截到 50 步，实际 ${t3.length}`)

const t4 = run(nullTerminatedKernel.compile(EMPTY_DOC))
t4.length === 3 && t4[2].n === 3
  ? ok('null 收尾内核：3 步后自然结束') : bad(`应为 3 步，实际 ${t4.length}`)

// resume 也要能吃退化内核
const t5 = resume(nullTerminatedKernel.compile(EMPTY_DOC), { n: 1 })
t5.length === 2 && t5[0].n === 2
  ? ok('resume 从中间状态续跑退化内核') : bad(`resume 应为 2 步，实际 ${t5.length}`)

// ── 自检必须能红 ──────────────────────────────────────
console.log('\n  自检：一个"藏了假设"的 run() 必须在同样输入上失败')

/** 坏版本：假设"每个内核至少有一个初始状态"，把 initial() 也塞进轨迹 */
function runWithHiddenAssumption<S>(model: CompiledModel<S>, maxSteps = 1000): S[] {
  const trace: S[] = [model.initial()]      // ← 这就是那个隐含假设
  let prev: S | null = trace[0]
  for (let i = 0; i < maxSteps; i++) {
    const r = model.step(prev)
    if (r === null) break
    trace.push(r.state); prev = r.state
    if (r.done) break
  }
  return trace
}

/** 比内容，不只比长度 —— 只比长度会漏掉"步数相同但状态不同"的错 */
const differs = (a: unknown[], b: unknown[]) => JSON.stringify(a) !== JSON.stringify(b)

const badEmpty = runWithHiddenAssumption(emptyKernel.compile(EMPTY_DOC))
differs(badEmpty, t1)
  ? ok(`自检变红：坏 run() 在空内核上给出 ${badEmpty.length} 步（正确是 ${t1.length} 步）`)
  : bad('自检没变红 —— 这组极端内核区分不出好坏 run()，测试没有鉴别力')

// 单步内核：坏版本步数也是 1，但内容是 initial() 而不是第一步的结果。
// 只比长度会放过它 —— 这是"检查太弱"的现场，必须比内容。
const badOneShot = runWithHiddenAssumption(oneShotKernel.compile(EMPTY_DOC))
differs(badOneShot, t2)
  ? ok(`自检佐证：单步内核上坏 run() 给出 ${JSON.stringify(badOneShot)}，正确是 ${JSON.stringify(t2)}`
      + `（步数同为 ${t2.length}，只比长度会漏掉）`)
  : bad('自检没变红 —— 单步内核上区分不出好坏 run()')

console.log(`\n${'─'.repeat(52)}`)
console.log(failures === 0 ? '验收标准 5：通过' : `验收标准 5：失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
