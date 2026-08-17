/**
 * 第三批内核：组成原理四件套 —— IEEE754 / 流水线 / 虚存+TLB / 定点乘除
 *
 * 同一条纪律：判据要么用**跟内核无关的独立算法**，要么验**性质**。
 * 这一批格外要紧的一点：浮点和乘除都是"手算位串"，
 * 而宿主 JS 自带 IEEE754 双精度和整数乘除 —— 正好拿来当独立参照。
 */
import { run, resume } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'
import { floatKernel, type FloatState } from '../src/kernels/float.ts'
import { pipelineKernel, type PipeState, STAGES } from '../src/kernels/pipeline.ts'
import { vmKernel, type VmState } from '../src/kernels/vm.ts'
import { multiplyKernel, type MulState } from '../src/kernels/multiply.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// ═══ IEEE 754 ══════════════════════════════════════════
console.log('\n【IEEE 754 浮点】')

const encode = (value: number, format = 'single') => {
  const doc: SimDocument = {
    kind: 'float', params: { format, operation: 'encode' }, entities: [],
    streams: [{ name: 'operands', values: [value] }],
  }
  const t = run(floatKernel.compile(doc)) as FloatState[]
  return { bits: t.at(-1)!.bits, trace: t }
}

/** 独立参照：用宿主的 DataView 拿到真正的 IEEE754 位串 */
const refBits = (v: number, format: string) => {
  const single = format !== 'double'
  const buf = new ArrayBuffer(8)
  const dv = new DataView(buf)
  if (single) { dv.setFloat32(0, v); return dv.getUint32(0).toString(2).padStart(32, '0') }
  dv.setFloat64(0, v)
  return (dv.getBigUint64(0)).toString(2).padStart(64, '0')
}

// ── 1. 单精度编码必须与 DataView 逐位一致 ──────────────
{
  const CASES = [0, 1, -1, 0.5, -0.5, 2, 10, -12.5, 0.1, -0.1, 3.14159, 255.75, 1e-5, 65536]
  const wrong: string[] = []
  for (const v of CASES) {
    const mine = encode(v).bits
    const ref = refBits(v, 'single')
    if (mine !== ref) wrong.push(`${v}: 我 ${mine} / 参照 ${ref}`)
  }
  wrong.length === 0
    ? ok(`${CASES.length} 个数的单精度编码与 DataView 逐位一致（含 0.1 这种无限循环的）`)
    : bad(`编码不一致：${wrong.slice(0, 2).join(' | ')}`)
}

// ── 2. 双精度同样要对 ──────────────────────────────────
{
  const CASES = [1, -1, 0.1, 12.5, -0.75, 1e10]
  const wrong = CASES.filter(v => encode(v, 'double').bits !== refBits(v, 'double'))
  wrong.length === 0
    ? ok(`${CASES.length} 个数的双精度编码与 DataView 逐位一致`)
    : bad(`双精度不一致：${wrong.join('、')}`)
}

// ── 3. 每一步都必须只增不改（位从 ? 变成 0/1，不来回改）──
{
  const t = encode(-12.5).trace
  const wrong: string[] = []
  for (let k = 1; k < t.length; k++) {
    const a = t[k - 1].bits, b = t[k].bits
    for (let p = 0; p < a.length; p++) {
      //  已经定下来的位不许再变（除了舍入那一步允许改尾数）
      if (a[p] !== '?' && a[p] !== b[p] && t[k].phase !== 'mantissa' && t[k].phase !== 'round')
        wrong.push(`第${k}步 位${p}: ${a[p]}→${b[p]}（${t[k].phase}）`)
    }
  }
  wrong.length === 0
    ? ok('编码过程单调：已确定的位不会被后面的步骤改掉（舍入除外）')
    : bad(`位被改写：${wrong.slice(0, 3).join(' / ')}`)
}

// ── 4. 加法结果必须与宿主的浮点加法一致 ────────────────
{
  const add = (a: number, b: number, op = 'add') => {
    const doc: SimDocument = {
      kind: 'float', params: { format: 'single', operation: op }, entities: [],
      streams: [{ name: 'operands', values: [a, b] }],
    }
    const t = run(floatKernel.compile(doc)) as FloatState[]
    return t.at(-1)!.bits
  }
  const CASES: [number, number][] = [[1, 1], [1, 0.5], [10, 2.5], [0.5, 0.25], [100, 3], [8, -2], [7, -7]]
  const wrong: string[] = []
  for (const [a, b] of CASES) {
    const mine = add(a, b)
    //  独立参照：宿主先按单精度舍入两个加数，再相加，再按单精度舍入
    const f32 = (x: number) => { const d = new DataView(new ArrayBuffer(4)); d.setFloat32(0, x); return d.getFloat32(0) }
    const ref = refBits(f32(f32(a) + f32(b)), 'single')
    if (mine !== ref) wrong.push(`${a}+${b}: 我 ${mine} / 参照 ${ref}`)
  }
  wrong.length === 0
    ? ok(`${CASES.length} 组加法（含异号相减、结果为 0）与宿主浮点逐位一致`)
    : bad(`加法不一致：${wrong.slice(0, 2).join(' | ')}`)
}

// ── 自检 ───────────────────────────────────────────────
{
  const a = encode(0.1).bits, b = encode(0.2).bits
  a !== b && encode(1).bits !== encode(2).bits
    ? ok('自检：不同的数编码不同 —— 若内核把 bits 写死，前面四条全会红')
    : bad('自检失败：不同的数编出了同一串位')
}

// ═══ 流水线 ════════════════════════════════════════════
console.log('\n【指令流水线】')

const pipeDoc = (
  insts: { id: string; op: string; rd?: string; rs?: string; rt?: string; taken?: number }[],
  forwarding: number,
): SimDocument => ({
  kind: 'pipeline',
  params: { forwarding },
  entities: insts.map(x => ({
    id: x.id, type: 'inst',
    attrs: {
      op: x.op, rd: x.rd ?? '', rs: x.rs ?? '', rt: x.rt ?? '', taken: x.taken ?? 0,
    },
  })),
  streams: [],
})
const pipeRun = (insts: Parameters<typeof pipeDoc>[0], fw: number) =>
  run(pipelineKernel.compile(pipeDoc(insts, fw)), 500) as PipeState[]

/** 无相关的四条指令 */
const INDEP = [
  { id: 'I1', op: 'add', rd: 'R1', rs: 'R2', rt: 'R3' },
  { id: 'I2', op: 'add', rd: 'R4', rs: 'R5', rt: 'R6' },
  { id: 'I3', op: 'add', rd: 'R7', rs: 'R8', rt: 'R9' },
  { id: 'I4', op: 'add', rd: 'R10', rs: 'R11', rt: 'R12' },
]

// ── 1. 无相关时：n 条指令 5 段流水恰好 n+4 个周期 ───────
{
  const t = pipeRun(INDEP, 0)
  //  判据来自公式，不是数出来的：k 段流水线跑 n 条无相关指令 = k + (n−1)
  const expect = STAGES.length + (INDEP.length - 1)
  t.length === expect
    ? ok(`无相关：4 条指令 5 段流水 = 5 + (4−1) = ${expect} 个周期，实测 ${t.length}`)
    : bad(`周期数不对：公式算 ${expect}，实测 ${t.length}`)
}

// ── 2. 每条指令必须按 IF→ID→EX→MEM→WB 依次经过，不跳段 ──
{
  const t = pipeRun(INDEP, 0)
  const wrong: string[] = []
  for (const inst of INDEP) {
    const seen = t.map(s => s.at[inst.id]).filter(x => x && x !== '-')
    //  去掉连续重复（停顿时会在同一段停多拍）
    const uniq = seen.filter((x, k) => k === 0 || x !== seen[k - 1])
    if (!eq(uniq, [...STAGES])) wrong.push(`${inst.id}: ${uniq.join('→')}`)
  }
  wrong.length === 0
    ? ok('四条指令都严格走完 IF→ID→EX→MEM→WB，不跳段不乱序')
    : bad(`段序不对：${wrong.join(' / ')}`)
}

// ── 3. 有 RAW 相关时，开前递必须比不开少用周期 ──────────
{
  //  I2 用 I1 刚算出来的 R1
  const RAW = [
    { id: 'I1', op: 'add', rd: 'R1', rs: 'R2', rt: 'R3' },
    { id: 'I2', op: 'add', rd: 'R4', rs: 'R1', rt: 'R5' },
    { id: 'I3', op: 'add', rd: 'R6', rs: 'R4', rt: 'R7' },
  ]
  const no = pipeRun(RAW, 0).length
  const yes = pipeRun(RAW, 1).length
  const ideal = STAGES.length + (RAW.length - 1)
  yes < no && yes === ideal
    ? ok(`RAW 相关：不开前递 ${no} 周期，开前递 ${yes} 周期（= 理想的 ${ideal}，气泡全消）`)
    : bad(`前递没起作用：不开 ${no}，开 ${yes}，理想 ${ideal}`)
}

// ── 4. load-use 相关：即使开了前递也省不掉那一拍 ────────
{
  const LOADUSE = [
    { id: 'I1', op: 'lw', rd: 'R1', rs: 'R2' },
    { id: 'I2', op: 'add', rd: 'R3', rs: 'R1', rt: 'R4' },
  ]
  const yes = pipeRun(LOADUSE, 1)
  const ideal = STAGES.length + (LOADUSE.length - 1)
  yes.length > ideal && yes.some(s => s.stalled.length > 0)
    ? ok(`load-use：开了前递仍要 ${yes.length} 周期（理想 ${ideal}）—— 数据要等 MEM 段才出来`)
    : bad(`load-use 没停顿：${yes.length} 周期，理想 ${ideal}`)
}

// ── 5. 分支跳转必须冲刷掉后面已取的指令 ────────────────
{
  const BR = [
    { id: 'I1', op: 'beq', rs: 'R1', rt: 'R2', taken: 1 },
    { id: 'I2', op: 'add', rd: 'R3', rs: 'R4', rt: 'R5' },
    { id: 'I3', op: 'add', rd: 'R6', rs: 'R7', rt: 'R8' },
  ]
  const t = pipeRun(BR, 1)
  const flushed = new Set(t.flatMap(s => s.flushed))
  flushed.size > 0
    ? ok(`分支跳转：冲刷掉 ${[...flushed].join('、')} —— 控制冒险的代价`)
    : bad('分支跳转没冲刷任何指令')
}

// ── 自检 ───────────────────────────────────────────────
{
  const RAW = [
    { id: 'I1', op: 'add', rd: 'R1', rs: 'R2', rt: 'R3' },
    { id: 'I2', op: 'add', rd: 'R4', rs: 'R1', rt: 'R5' },
  ]
  const dep = pipeRun(RAW, 0).length
  const indep = pipeRun([
    { id: 'I1', op: 'add', rd: 'R1', rs: 'R2', rt: 'R3' },
    { id: 'I2', op: 'add', rd: 'R4', rs: 'R9', rt: 'R5' },
  ], 0).length
  dep > indep
    ? ok(`自检：把 I2 的源寄存器换成无关的，周期从 ${dep} 降到 ${indep} —— 判据认得出相关`)
    : bad(`自检失败：有无相关都是 ${dep} 周期`)
}

// ═══ 虚存 + TLB ════════════════════════════════════════
console.log('\n【虚拟地址转换 + TLB】')

const vmDoc = (
  addrs: number[], tlbEntries = 4, pageSizeBytes = 4096, virtualBits = 16,
  pt: [number, number, number][] = [],
): SimDocument => ({
  kind: 'vm',
  params: { virtualBits, pageSizeBytes, tlbEntries },
  entities: pt.map(([page, frame, valid]) =>
    ({ id: String(page), type: 'pte', attrs: { frame, valid } })),
  streams: [{ name: 'virtualAddresses', values: addrs }],
})
const PT: [number, number, number][] = [
  [0, 5, 1], [1, 9, 1], [2, 3, 1], [3, 0, 0], [4, 7, 1], [5, 2, 1],
]
const vmRun = (addrs: number[], tlbEntries = 4) =>
  run(vmKernel.compile(vmDoc(addrs, tlbEntries, 4096, 16, PT))) as VmState[]

// ── 1. 物理地址必须等于 页框×页大小 + 页内偏移 ─────────
{
  const addrs = [0x0000, 0x0FFF, 0x1000, 0x2ABC, 0x4001, 0x5FFF]
  const t = vmRun(addrs)
  const wrong: string[] = []
  t.forEach((s, k) => {
    //  独立算一遍，跟内核内部怎么拆位无关
    const page = Math.floor(addrs[k] / 4096)
    const off = addrs[k] % 4096
    const e = PT.find(p => p[0] === page)
    const want = e && e[2] === 1 ? e[1] * 4096 + off : null
    if (s.paddr !== want) wrong.push(`${addrs[k].toString(16)}: ${s.paddr} ≠ ${want}`)
    if (s.vpn !== page || s.offset !== off) wrong.push(`${addrs[k].toString(16)} 拆位错`)
  })
  wrong.length === 0
    ? ok(`${addrs.length} 个地址的 VPN/偏移/物理地址与独立公式一致`)
    : bad(`地址转换不对：${wrong.slice(0, 3).join(' / ')}`)
}

// ── 2. 无效页表项必须判缺页，不能算出物理地址 ──────────
{
  const t = vmRun([0x3000, 0x3ABC])
  t.every(s => s.outcome === 'fault' && s.paddr === null)
    ? ok('页 3 的有效位为 0 → 两次访问都判缺页，物理地址为 null')
    : bad(`无效页没判缺页：${t.map(s => `${s.outcome}/${s.paddr}`).join(' ')}`)
}

// ── 3. TLB 必须真的起作用：重复访问同一页第二次要命中 ───
{
  const t = vmRun([0x0000, 0x0001, 0x0002])
  t[0].outcome === 'ptHit' && t[1].outcome === 'tlbHit' && t[2].outcome === 'tlbHit'
    ? ok(`同一页连访三次：第 1 次查页表回填，后两次 TLB 命中（命中率 ${t.at(-1)!.tlbHits}/3）`)
    : bad(`TLB 没起作用：${t.map(s => s.outcome).join(' ')}`)
}

// ── 4. TLB 容量满了要按 LRU 换出，且换出的确实是最久未用的 ──
{
  //  4 项 TLB，依次访问页 0,1,2,4,5 → 装第 5 个时应换掉最久未用的页 0
  const t = vmRun([0, 4096, 8192, 16384, 20480], 4)
  const last = t.at(-1)!
  last.evicted === 0 && last.tlb.length === 4 && !last.tlb.some(x => x[0] === 0)
    ? ok(`TLB 满（4 项）装第 5 页：按 LRU 换出页 0，当前 TLB = [${last.tlb.map(x => x[0]).join(' ')}]`)
    : bad(`LRU 换出不对：换出 ${last.evicted}，TLB = ${JSON.stringify(last.tlb)}`)
}

// ── 5. 标准 2：JSON 往返后续跑一致 ─────────────────────
{
  const model = vmKernel.compile(vmDoc([0, 4096, 0, 8192, 4096, 0], 2, 4096, 16, PT))
  const full = run(model) as VmState[]
  const mid = Math.floor(full.length / 2)
  const revived = JSON.parse(JSON.stringify(full[mid])) as VmState
  eq(resume(model, revived), full.slice(mid + 1))
    ? ok(`从第 ${mid} 步 JSON 往返后续跑，与原轨迹逐字节一致（TLB 状态自足）`)
    : bad('续跑不一致 —— TLB 可能漏在闭包里')
}

// ── 自检 ───────────────────────────────────────────────
{
  const small = vmRun([0, 4096, 8192, 0], 1).at(-1)!.tlbHits
  const big = vmRun([0, 4096, 8192, 0], 4).at(-1)!.tlbHits
  big > small
    ? ok(`自检：TLB 从 1 项加到 4 项，命中 ${small} → ${big} —— 判据认得出容量差别`)
    : bad(`自检失败：TLB 大小对命中没影响（${small} vs ${big}）`)
}

// ═══ 定点乘除 ══════════════════════════════════════════
console.log('\n【定点乘除】')

const mulRun = (algorithm: string, a: number, b: number, bits = 8) => {
  const doc: SimDocument = {
    kind: 'multiply', params: { algorithm, bits }, entities: [],
    streams: [{ name: 'operands', values: [a, b] }],
  }
  return run(multiplyKernel.compile(doc)) as MulState[]
}
const fromComp = (s: string) => {
  const v = parseInt(s, 2)
  return s[0] === '1' ? v - Math.pow(2, s.length) : v
}

// ── 1. Booth 的乘积必须等于宿主的整数乘法 ──────────────
{
  const CASES: [number, number][] = [
    [5, 3], [-5, 3], [5, -3], [-5, -3], [7, 7], [0, 9], [-1, -1], [12, -6], [15, 8],
  ]
  const wrong: string[] = []
  for (const [a, b] of CASES) {
    const last = mulRun('Booth', a, b).at(-1)!
    const got = fromComp(last.hi + last.lo)
    if (got !== a * b) wrong.push(`${a}×${b}: ${got} ≠ ${a * b}`)
  }
  wrong.length === 0
    ? ok(`Booth 算法 ${CASES.length} 组（含四种正负组合）乘积与宿主整数乘法一致`)
    : bad(`Booth 出错：${wrong.slice(0, 3).join(' / ')}`)
}

// ── 2. 原码一位乘同样要对 ──────────────────────────────
{
  const CASES: [number, number][] = [[5, 3], [-5, 3], [5, -3], [-5, -3], [9, 0], [11, 7]]
  const wrong: string[] = []
  for (const [a, b] of CASES) {
    const t = mulRun('原码一位乘', a, b)
    //  原码乘的符号在日志里，数值在寄存器里 —— 从末条日志取最终结论
    const m = t.at(-1)!.log.match(/= (-?\d+)$/)
    const got = m ? Number(m[1]) : NaN
    if (got !== a * b) wrong.push(`${a}×${b}: ${got} ≠ ${a * b}`)
  }
  wrong.length === 0
    ? ok(`原码一位乘 ${CASES.length} 组乘积正确（符号单独算）`)
    : bad(`原码乘出错：${wrong.join(' / ')}`)
}

// ── 3. 两种乘法轮数必须都等于位数 ──────────────────────
{
  const b = mulRun('Booth', 5, 3, 8).at(-1)!.round
  const y = mulRun('原码一位乘', 5, 3, 8).at(-1)!.round
  b === 8 && y === 8
    ? ok('8 位乘法：Booth 与原码乘都恰好 8 轮 —— 一位乘每轮处理一位')
    : bad(`轮数不对：Booth ${b} 轮，原码 ${y} 轮`)
}

// ── 4. 补码除法：商 × 除数 + 余数 = 被除数 ──────────────
{
  //  验的是除法的定义式，不是记住的某个商
  //  含四种正负组合 —— 商与余数的符号规则是独立的考点
  const CASES: [number, number][] = [
    [11, 3], [20, 5], [7, 2], [30, 4], [100, 7], [1, 9],
    [-11, 3], [11, -3], [-11, -3],
  ]
  const wrong: string[] = []
  for (const [a, b] of CASES) {
    const last = mulRun('加减交替', a, b, 8).at(-1)!
    const q = last.q!, r = last.rem!
    if (q * b + r !== a) wrong.push(`${a}÷${b}: 商${q} 余${r} → ${q * b + r} ≠ ${a}`)
  }
  wrong.length === 0
    ? ok(`加减交替法 ${CASES.length} 组（含四种正负组合）满足 商×除数+余数=被除数`)
    : bad(`除法定义式不成立：${wrong.join(' / ')}`)
}

// ── 自检 ───────────────────────────────────────────────
{
  const a = mulRun('Booth', 5, 3).at(-1)!
  const b = mulRun('Booth', 6, 3).at(-1)!
  fromComp(a.hi + a.lo) !== fromComp(b.hi + b.lo)
    ? ok('自检：换一个乘数结果就不同 —— 判据没有被写死的常量糊弄')
    : bad('自检失败：不同输入得到相同乘积')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
