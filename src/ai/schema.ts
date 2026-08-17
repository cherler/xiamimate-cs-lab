/**
 * SimDocument 的 JSON Schema —— AI 填 DSL 的契约。
 *
 * 手写而非从 TS 类型自动生成，因为要迁就结构化输出的限制：
 *   - 不能递归            → attrs 的值只能是标量
 *   - 不能有数值约束      → "块大小必须是 2 的幂"写不进来，交给 validateDocument()
 *   - additionalProperties 必须显式 false
 *
 * 每个内核给一份收窄过的 schema（参数名写死成 enum/固定 key），
 * 比给一个通用 schema 让模型自由发挥可靠得多。
 */

export type JsonSchema = Record<string, unknown>

/** 标量：attrs / params 的值域。不允许对象和数组 —— 这就是"不能递归"的落点。 */
const SCALAR: JsonSchema = {
  anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
}

const entityArray = (typeEnum: string[], attrKeys: JsonSchema): JsonSchema => ({
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '实体标识，如 P1 / L1' },
      type: { type: 'string', enum: typeEnum },
      at: { type: 'number', description: '时间锚点：到达时刻 / 事件轮次' },
      attrs: attrKeys,
    },
    required: ['id', 'type', 'at', 'attrs'],
    additionalProperties: false,
  },
})

const streamArray = (nameEnum: string[]): JsonSchema => ({
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', enum: nameEnum },
      values: { type: 'array', items: { type: 'number' } },
    },
    required: ['name', 'values'],
    additionalProperties: false,
  },
})

// ═══ Cache ═════════════════════════════════════════════
export const CACHE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['cache'] },
    params: {
      type: 'object',
      properties: {
        addressBits: { type: 'number', description: '地址位数，通常 32' },
        cacheSizeBytes: { type: 'number', description: 'Cache 总容量，字节' },
        blockSizeBytes: { type: 'number', description: '块大小（行大小），字节' },
        associativity: { type: 'number', description: '相联度：1=直接映射，N=N路组相联' },
        replacement: { type: 'string', enum: ['LRU', 'FIFO'] },
      },
      required: ['addressBits', 'cacheSizeBytes', 'blockSizeBytes', 'associativity', 'replacement'],
      additionalProperties: false,
    },
    entities: { type: 'array', items: {}, description: 'Cache 实验不用实体，填空数组' },
    streams: streamArray(['accessSequence']),
  },
  required: ['kind', 'params', 'entities', 'streams'],
  additionalProperties: false,
}

// ═══ 进程调度 ═══════════════════════════════════════════
export const SCHED_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['scheduler'] },
    params: {
      type: 'object',
      properties: {
        algorithm: { type: 'string', enum: ['FCFS', 'SJF', 'SRTF', 'RR'] },
        quantum: { type: 'number', description: '时间片长度，仅 RR 使用；其他算法填 1' },
      },
      required: ['algorithm', 'quantum'],
      additionalProperties: false,
    },
    entities: entityArray(['process'], {
      type: 'object',
      properties: { burst: { type: 'number', description: '所需 CPU 时间' } },
      required: ['burst'],
      additionalProperties: false,
    }),
    streams: { type: 'array', items: {}, description: '调度实验不用流，填空数组' },
  },
  required: ['kind', 'params', 'entities', 'streams'],
  additionalProperties: false,
}

// ═══ TCP ═══════════════════════════════════════════════
export const TCP_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['tcp'] },
    params: {
      type: 'object',
      properties: {
        variant: { type: 'string', enum: ['Tahoe', 'Reno'] },
        initialCwnd: { type: 'number' },
        initialSsthresh: { type: 'number' },
        rounds: { type: 'number', description: '要模拟的 RTT 轮数' },
      },
      required: ['variant', 'initialCwnd', 'initialSsthresh', 'rounds'],
      additionalProperties: false,
    },
    entities: entityArray(['loss'], {
      type: 'object',
      properties: { type: { type: 'string', enum: ['timeout', 'tripleDup'] } },
      required: ['type'],
      additionalProperties: false,
    }),
    streams: { type: 'array', items: {}, description: 'TCP 实验不用流，填空数组' },
  },
  required: ['kind', 'params', 'entities', 'streams'],
  additionalProperties: false,
}

export const SCHEMAS = { cache: CACHE_SCHEMA, scheduler: SCHED_SCHEMA, tcp: TCP_SCHEMA }

// ═══ schema 管不了的规则，在这里管 ═════════════════════
// 这就是"不能有数值约束 → 验证器从可选变必需"的落点。
import type { SimDocument } from '../core/document.ts'
import type { Violation } from '../core/verify.ts'

const isPow2 = (n: number) => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0

export function validateDocument(doc: SimDocument): Violation[] {
  const v: Violation[] = []
  const err = (location: string, message: string, actual?: unknown) =>
    v.push({ severity: 'error', location, message, actual })

  if (doc.kind === 'cache') {
    const p = doc.params
    const size = p.cacheSizeBytes as number
    const block = p.blockSizeBytes as number
    const ways = p.associativity as number

    if (!isPow2(size)) err('params.cacheSizeBytes', 'Cache 容量必须是 2 的幂', size)
    if (!isPow2(block)) err('params.blockSizeBytes', '块大小必须是 2 的幂', block)
    if (!isPow2(ways)) err('params.associativity', '相联度必须是 2 的幂', ways)
    if (size % (block * ways) !== 0)
      err('params', `容量 ${size} 除不尽 块${block}×路${ways}`, size / (block * ways))
    else if (!isPow2(size / block / ways))
      err('params', '组数必须是 2 的幂', size / block / ways)

    const seq = doc.streams.find(s => s.name === 'accessSequence')
    if (!seq) err('streams', '缺少 accessSequence')
    else if (seq.values.length === 0) err('streams.accessSequence', '访问序列为空')
    else if (seq.values.some(x => typeof x !== 'number' || x < 0))
      err('streams.accessSequence', '地址必须是非负数字')
  }

  if (doc.kind === 'scheduler') {
    if (doc.entities.length === 0) err('entities', '至少要有一个进程')
    for (const e of doc.entities) {
      if ((e.attrs.burst as number) <= 0) err(`entities.${e.id}.burst`, '执行时间必须为正', e.attrs.burst)
      if ((e.at ?? 0) < 0) err(`entities.${e.id}.at`, '到达时刻不能为负', e.at)
    }
    if ((doc.params.quantum as number) <= 0) err('params.quantum', '时间片必须为正', doc.params.quantum)
  }

  if (doc.kind === 'tcp') {
    const p = doc.params
    if ((p.rounds as number) <= 0) err('params.rounds', '轮数必须为正', p.rounds)
    if ((p.initialCwnd as number) <= 0) err('params.initialCwnd', '初始 cwnd 必须为正', p.initialCwnd)
    if ((p.initialSsthresh as number) <= 1) err('params.initialSsthresh', 'ssthresh 必须 >1', p.initialSsthresh)
    for (const e of doc.entities) {
      const at = e.at ?? 0
      if (at < 1 || at > (p.rounds as number))
        err(`entities.${e.id}.at`, `丢包轮次 ${at} 超出 1..${p.rounds}`, at)
    }
  }

  return v
}
