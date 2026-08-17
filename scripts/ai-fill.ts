/**
 * 内容环的核心一环：AI 读一道中文真题 → 填出 DSL → 验证器把关 → 跑出轨迹。
 *
 * 判决标准不是"AI 输出了合法 JSON"，而是：
 *   AI 填出的 doc 跑出来的轨迹，必须跟人手写的参考 doc 逐字段一致。
 *
 * 会花钱（几分钱），所以是脚本不是测试，不进 npm test。
 *   npm run ai:fill
 */
import Anthropic from '@anthropic-ai/sdk'
import { run } from '../src/core/kernel.ts'
import { compareTraces, visible } from '../src/core/verify.ts'
import type { SimDocument } from '../src/core/document.ts'
import { SCHEMAS, validateDocument } from '../src/ai/schema.ts'
import { cacheKernel, CACHE_VISIBLE } from '../src/kernels/cache.ts'
import { schedKernel, SCHED_VISIBLE } from '../src/kernels/scheduler.ts'
import { tcpKernel, TCP_VISIBLE } from '../src/kernels/tcp.ts'

process.loadEnvFile('.env')

const client = new Anthropic({
  apiKey: process.env.MINIMAX_API_KEY!,
  baseURL: process.env.MINIMAX_BASE_URL!,
})
const MODEL = process.env.MINIMAX_MODEL!

const KERNELS = { cache: cacheKernel, scheduler: schedKernel, tcp: tcpKernel } as never as
  Record<string, { compile: (d: SimDocument) => never }>
const VIS: Record<string, readonly string[]> = {
  cache: CACHE_VISIBLE, scheduler: SCHED_VISIBLE, tcp: TCP_VISIBLE,
}

const SYSTEM = `你把计算机专业课的题目转成实验配置 JSON。

规则：
1. 严格按给定 schema 输出，不要多字段也不要少字段。
2. 题目里的地址、时刻、轮次一律转成十进制数字（0x20 → 32）。
3. 用不到的数组填 []，用不到的参数填合理默认值（如非 RR 算法的 quantum 填 1）。
4. 只输出配置，不要解题，不要算答案。`

// ═══ 题目 + 人手写的参考答案 ═══════════════════════════
type Case = { name: string; kind: string; problem: string; reference: SimDocument }

const CASES: Case[] = [
  {
    name: 'Cache · 组相联与 LRU',
    kind: 'cache',
    problem:
      '某计算机主存按字节编址，地址为 32 位。Cache 数据区容量 512B，主存块大小 32B，' +
      '采用 4 路组相联映射，替换策略为 LRU。CPU 按顺序访问以下主存地址（十六进制）：' +
      '0x00、0x20、0x40、0x60、0x80、0x00、0x20。请给出每次访问的命中情况。',
    reference: {
      kind: 'cache',
      params: { addressBits: 32, cacheSizeBytes: 512, blockSizeBytes: 32, associativity: 4, replacement: 'LRU' },
      entities: [],
      streams: [{ name: 'accessSequence', values: [0x00, 0x20, 0x40, 0x60, 0x80, 0x00, 0x20] }],
    },
  },
  {
    name: '调度 · 最短剩余时间优先',
    kind: 'scheduler',
    problem:
      '系统中有 4 个进程，到达时间与所需运行时间如下：' +
      'P1 到达时刻 0，需运行 7；P2 到达时刻 2，需运行 4；' +
      'P3 到达时刻 4，需运行 1；P4 到达时刻 5，需运行 4。' +
      '采用最短剩余时间优先（SRTF）调度算法，请画出甘特图。',
    reference: {
      kind: 'scheduler',
      params: { algorithm: 'SRTF', quantum: 1 },
      entities: [
        { id: 'P1', type: 'process', at: 0, attrs: { burst: 7 } },
        { id: 'P2', type: 'process', at: 2, attrs: { burst: 4 } },
        { id: 'P3', type: 'process', at: 4, attrs: { burst: 1 } },
        { id: 'P4', type: 'process', at: 5, attrs: { burst: 4 } },
      ],
      streams: [],
    },
  },
  {
    name: 'TCP · Reno 拥塞控制',
    kind: 'tcp',
    problem:
      '某 TCP 连接采用 Reno 拥塞控制算法，初始拥塞窗口 cwnd = 1 MSS，慢启动门限 ssthresh = 16 MSS。' +
      '在第 8 个 RTT 收到三个重复 ACK，在第 13 个 RTT 发生超时。' +
      '请模拟前 20 个 RTT 的拥塞窗口变化过程。',
    reference: {
      kind: 'tcp',
      params: { variant: 'Reno', initialCwnd: 1, initialSsthresh: 16, rounds: 20 },
      entities: [
        { id: 'L1', type: 'loss', at: 8, attrs: { type: 'tripleDup' } },
        { id: 'L2', type: 'loss', at: 13, attrs: { type: 'timeout' } },
      ],
      streams: [],
    },
  },
]

// ═══ 逐级降级：探测这个端点支持哪种结构化输出 ══════════
type Mode = 'output_config' | 'forced_tool' | 'prompt_json'
const modeName: Record<Mode, string> = {
  output_config: '结构化输出 output_config.format',
  forced_tool: '强制工具调用 tool_choice',
  prompt_json: '提示词要求 JSON（最弱）',
}

async function fill(problem: string, schema: object, mode: Mode): Promise<SimDocument> {
  const messages = [{ role: 'user' as const, content: problem }]

  if (mode === 'output_config') {
    const r = await client.messages.create({
      model: MODEL, max_tokens: 4096, system: SYSTEM, messages,
      // @ts-expect-error 端点可能不认这个字段 —— 这正是要探测的
      output_config: { format: { type: 'json_schema', schema } },
    })
    return JSON.parse(textOf(r))
  }

  if (mode === 'forced_tool') {
    const r = await client.messages.create({
      model: MODEL, max_tokens: 4096, system: SYSTEM, messages,
      tools: [{
        name: 'emit_document',
        description: '输出实验配置',
        input_schema: schema as never,
      }],
      tool_choice: { type: 'tool', name: 'emit_document' },
    })
    const tu = r.content.find(b => b.type === 'tool_use')
    if (!tu) throw new Error('没有 tool_use 块')
    return (tu as { input: SimDocument }).input
  }

  const r = await client.messages.create({
    model: MODEL, max_tokens: 4096,
    system: `${SYSTEM}\n\n只输出 JSON，不要 markdown 代码块。schema：\n${JSON.stringify(schema)}`,
    messages,
  })
  return JSON.parse(textOf(r).replace(/^```(?:json)?\n?|\n?```$/g, '').trim())
}

const textOf = (r: Anthropic.Message) =>
  r.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('')

// ═══ 主流程 ════════════════════════════════════════════
console.log(`模型 ${MODEL} @ ${process.env.MINIMAX_BASE_URL}\n`)
console.log('═'.repeat(58))
console.log('【第一步】探测端点支持哪种结构化输出')

let mode: Mode | null = null
for (const m of ['output_config', 'forced_tool', 'prompt_json'] as Mode[]) {
  try {
    await fill(CASES[0].problem, SCHEMAS.cache, m)
    console.log(`  ✅ ${modeName[m]} —— 可用`)
    mode = m
    break
  } catch (e) {
    console.log(`  ✕  ${modeName[m]} —— ${(e as Error).message.slice(0, 90)}`)
  }
}
if (!mode) { console.log('\n三种方式全部失败，中止'); process.exit(1) }
console.log(`\n采用：${modeName[mode]}`)

console.log(`\n${'═'.repeat(58)}`)
console.log('【第二步】三道真题 → AI 填 DSL → 验证器 → 轨迹比对')

let pass = 0
for (const c of CASES) {
  console.log(`\n▶ ${c.name}`)
  try {
    const t0 = Date.now()
    const doc = await fill(c.problem, SCHEMAS[c.kind as keyof typeof SCHEMAS], mode)
    const ms = Date.now() - t0

    // 关卡 1：schema 管不了的规则
    const bad = validateDocument(doc)
    if (bad.length > 0) {
      console.log(`  ❌ 验证器拦下（${ms}ms）：`)
      for (const b of bad.slice(0, 3)) console.log(`     ${b.location}: ${b.message}  实际 ${JSON.stringify(b.actual)}`)
      continue
    }
    console.log(`  ✅ 验证器放行（${ms}ms，${JSON.stringify(doc).length} 字节）`)

    // 关卡 2：轨迹必须跟人写的参考 doc 完全一致
    const kernel = KERNELS[c.kind]
    const vis = VIS[c.kind]
    const aiTrace = run(kernel.compile(doc)).map(s => visible(s as object, vis))
    const refTrace = run(kernel.compile(c.reference)).map(s => visible(s as object, vis))
    const diff = compareTraces(aiTrace, refTrace, { kind: 'exact' }, c.kind)

    if (diff.length === 0) {
      console.log(`  ✅ 轨迹与参考 doc 逐字段一致（${aiTrace.length} 步）`)
      pass++
    } else {
      console.log(`  ❌ 轨迹不一致（${diff.length} 处）`)
      console.log(`     ${diff[0].location}: ${diff[0].message}`)
      console.log(`     AI  填的 params: ${JSON.stringify(doc.params)}`)
      console.log(`     参考的 params:  ${JSON.stringify(c.reference.params)}`)
    }
  } catch (e) {
    console.log(`  ❌ 调用/解析失败：${(e as Error).message.slice(0, 160)}`)
  }
}

console.log(`\n小计：${pass}/${CASES.length} 道正常题填对`)

// ═══ 第三步：陷阱题 —— 验证器必须拦下来 ════════════════
// 三道都过了不能说明验证器有用。必须证明它在该红的时候会红。
console.log(`\n${'═'.repeat(58)}`)
console.log('【第三步】陷阱题 —— 题目本身不合法，验证器必须拦下')

const TRAPS: { name: string; kind: string; problem: string; expect: string }[] = [
  {
    name: 'Cache 容量不是 2 的幂',
    kind: 'cache',
    problem: '某 Cache 数据区容量 500B，主存块大小 32B，4 路组相联，LRU 替换。' +
      'CPU 依次访问地址 0、32、64。请分析命中情况。',
    expect: 'cacheSizeBytes',
  },
  {
    name: '相联度不是 2 的幂',
    kind: 'cache',
    problem: '某 Cache 数据区容量 512B，主存块大小 32B，采用 6 路组相联映射，LRU 替换。' +
      'CPU 依次访问地址 0、32、64。请分析命中情况。',
    expect: 'associativity',
  },
  {
    name: '丢包轮次超出模拟范围',
    kind: 'tcp',
    problem: '某 TCP 连接采用 Reno 算法，初始 cwnd=1，ssthresh=16。' +
      '在第 25 个 RTT 发生超时。请模拟前 10 个 RTT 的窗口变化。',
    expect: 'at',
  },
]

let caught = 0
for (const t of TRAPS) {
  console.log(`\n▶ ${t.name}`)
  try {
    const doc = await fill(t.problem, SCHEMAS[t.kind as keyof typeof SCHEMAS], mode)
    const bad = validateDocument(doc)
    if (bad.length === 0) {
      console.log(`  ❌ 验证器放行了！AI 填的：${JSON.stringify(doc.params)}`)
      console.log(`     期望在 ${t.expect} 上报错 —— 验证器有漏洞，或 AI 悄悄改成了合法值`)
    } else {
      const hit = bad.some(b => b.location.includes(t.expect))
      console.log(`  ${hit ? '✅' : '⚠️ '} 验证器拦下 ${bad.length} 条${hit ? '' : '（但不在预期字段上）'}`)
      for (const b of bad.slice(0, 2))
        console.log(`     ${b.location}: ${b.message}  实际 ${JSON.stringify(b.actual)}`)
      if (hit) caught++
    }
  } catch (e) {
    console.log(`  ❌ 调用失败：${(e as Error).message.slice(0, 120)}`)
  }
}

console.log(`\n${'═'.repeat(58)}`)
console.log(`正常题：${pass}/${CASES.length} 填对`)
console.log(`陷阱题：${caught}/${TRAPS.length} 被验证器拦下`)
console.log(pass === CASES.length && caught === TRAPS.length
  ? '\n内容环成立：AI 能填对，验证器能拦错。'
  : '\n有未通过项，见上。')
