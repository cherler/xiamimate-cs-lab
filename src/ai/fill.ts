/**
 * AI 填 DSL 的调用层。
 *
 * 两件事是实测逼出来的，不是设计出来的：
 *   1. 第三方 Anthropic 兼容端点不一定支持 output_config.format —— 所以要逐级降级探测
 *   2. 强制 tool_choice 也不是 100% 出 tool_use 块 —— 所以要重试
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SimDocument } from '../core/document.ts'

export type Mode = 'output_config' | 'forced_tool' | 'prompt_json'

export const MODE_NAME: Record<Mode, string> = {
  output_config: '结构化输出 output_config.format',
  forced_tool: '强制工具调用 tool_choice',
  prompt_json: '提示词要求 JSON（最弱）',
}

export const SYSTEM = `你把计算机专业课的题目转成实验配置 JSON。

规则：
1. 严格按给定 schema 输出，required 里的字段一个都不能少。
2. 题目里的地址、时刻、轮次一律转成十进制数字（0x20 → 32，1KB → 1024）。
3. 用不到的数组填 []，用不到的参数填合理默认值（如非 RR 算法的 quantum 填 1）。
4. 题目没明说的必填项，按该领域最常见的约定补一个，不要留空。
5. 只输出配置，不要解题，不要算答案。`

export function makeClient() {
  return new Anthropic({
    apiKey: process.env.MINIMAX_API_KEY!,
    baseURL: process.env.MINIMAX_BASE_URL!,
  })
}

const textOf = (r: Anthropic.Message) =>
  r.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('')

/** 单次调用，不重试 */
async function fillOnce(
  client: Anthropic, model: string, problem: string, schema: object, mode: Mode,
): Promise<SimDocument> {
  const messages = [{ role: 'user' as const, content: problem }]

  if (mode === 'output_config') {
    const r = await client.messages.create({
      model, max_tokens: 4096, system: SYSTEM, messages,
      // @ts-expect-error 端点可能不认这个字段 —— 这正是要探测的
      output_config: { format: { type: 'json_schema', schema } },
    })
    return JSON.parse(textOf(r))
  }

  if (mode === 'forced_tool') {
    const r = await client.messages.create({
      model, max_tokens: 4096, system: SYSTEM, messages,
      tools: [{ name: 'emit_document', description: '输出实验配置', input_schema: schema as never }],
      tool_choice: { type: 'tool', name: 'emit_document' },
    })
    const tu = r.content.find(b => b.type === 'tool_use')
    if (!tu) throw new Error(`没有 tool_use 块（stop_reason=${r.stop_reason}）`)
    return (tu as { input: SimDocument }).input
  }

  const r = await client.messages.create({
    model, max_tokens: 4096,
    system: `${SYSTEM}\n\n只输出 JSON，不要 markdown 代码块。schema：\n${JSON.stringify(schema)}`,
    messages,
  })
  return JSON.parse(textOf(r).replace(/^```(?:json)?\n?|\n?```$/g, '').trim())
}

export type FillResult = { doc: SimDocument; attempts: number; ms: number }

/**
 * 带重试的填充。
 * 实测：强制 tool_choice 偶发不出 tool_use 块（20 道题里撞上 1 次）。
 * 这是调用层的偶发失败，不是模型答错 —— 重试是对的处理方式。
 */
export async function fillWithRetry(
  client: Anthropic, model: string, problem: string, schema: object, mode: Mode,
  maxAttempts = 3,
): Promise<FillResult> {
  const t0 = Date.now()
  let last: Error | null = null
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const doc = await fillOnce(client, model, problem, schema, mode)
      return { doc, attempts: i, ms: Date.now() - t0 }
    } catch (e) {
      last = e as Error
      if (i < maxAttempts) await new Promise(r => setTimeout(r, 400 * i))
    }
  }
  throw new Error(`${maxAttempts} 次均失败，最后一次：${last?.message}`)
}

// ═══ L2：多工具模式 —— 由模型自己选用哪个原语 ══════════
/**
 * 把全部原语作为工具一起给出去，`tool_choice: {type:'any'}` 强制调用但不指定调哪个。
 *
 * 这是 L2 的真考题：如果直接把 compare schema 递过去，等于人替它组装好了。
 * L2 要求的是模型**自己判断**这题该用单实验还是并排对比。
 */
export const SYSTEM_L2 = `${SYSTEM}

你有多个工具，每个对应一种实验形态：
- 单实验（cache / scheduler / tcp）：题目只要求分析一种配置
- 并排对比（compare_*）：题目要求"分别采用 X 和 Y""比较…""对比…"两种或多种配置

先判断题目属于哪一种，再调用对应的工具。
用并排对比时：varyParam 填被对比的参数名，并在 streams 里加一条 name="variants" 的流列出取值。`

/** 工具名不能带冒号，跟 kind 之间做个映射 */
export const toolNameOf = (kind: string) => kind.replace(':', '_')
export const kindOfTool = (tool: string) =>
  tool.startsWith('compare_') ? `compare:${tool.slice('compare_'.length)}` : tool

const TOOL_DESC: Record<string, string> = {
  cache: '单个 Cache 命中率实验',
  scheduler: '单个进程调度甘特图实验',
  tcp: '单个 TCP 拥塞窗口实验',
  'compare:cache': '并排对比多种 Cache 配置（如 LRU vs FIFO、不同相联度）',
  'compare:scheduler': '并排对比多种调度算法（如 FCFS vs SJF）',
  'compare:tcp': '并排对比多种 TCP 配置（如 Reno vs Tahoe）',
}

export type MultiResult = { kind: string; doc: SimDocument; attempts: number; ms: number }

export async function fillMultiTool(
  client: Anthropic, model: string, problem: string,
  schemas: Record<string, object>, maxAttempts = 3,
): Promise<MultiResult> {
  const tools = Object.entries(schemas).map(([kind, schema]) => ({
    name: toolNameOf(kind),
    description: TOOL_DESC[kind] ?? kind,
    input_schema: schema as never,
  }))

  const t0 = Date.now()
  let last: Error | null = null
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const r = await client.messages.create({
        model, max_tokens: 4096, system: SYSTEM_L2,
        messages: [{ role: 'user', content: problem }],
        tools,
        tool_choice: { type: 'any' },   // 必须调一个，但调哪个由模型定
      })
      const tu = r.content.find(b => b.type === 'tool_use')
      if (!tu) throw new Error(`没有 tool_use 块（stop_reason=${r.stop_reason}）`)
      const t = tu as { name: string; input: SimDocument }
      const kind = kindOfTool(t.name)

      // doc.kind 是模型生成的文本，不可靠 —— 实测里它会填错（端点同样不强制 enum）。
      // 权威来源是被调用的工具名：那是 API 的路由结果，映射由我们控制。
      // 所以不去校验 doc.kind，直接以工具名覆盖。
      return { kind, doc: { ...t.input, kind }, attempts: i, ms: Date.now() - t0 }
    } catch (e) {
      last = e as Error
      if (i < maxAttempts) await new Promise(r => setTimeout(r, 400 * i))
    }
  }
  throw new Error(`${maxAttempts} 次均失败，最后一次：${last?.message}`)
}

/** 逐级降级探测端点支持哪种结构化输出 */
export async function probeMode(
  client: Anthropic, model: string, problem: string, schema: object,
  log: (s: string) => void = () => {},
): Promise<Mode | null> {
  for (const m of ['output_config', 'forced_tool', 'prompt_json'] as Mode[]) {
    try {
      await fillOnce(client, model, problem, schema, m)
      log(`  ✅ ${MODE_NAME[m]}`)
      return m
    } catch (e) {
      log(`  ✕  ${MODE_NAME[m]} —— ${(e as Error).message.slice(0, 70)}`)
    }
  }
  return null
}
