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

// ═══ L2 组合：并排对比 ═════════════════════════════════
/**
 * 把一份基础 schema 升成对比版：加 varyParam，streams 里加 variants。
 * 这是 L2 的关键 —— 组合原语用的还是 SimDocument，没有新增顶层概念。
 */
function toCompareSchema(base: JsonSchema, kind: string, varyEnum: string[]): JsonSchema {
  const baseProps = (base.properties as Record<string, JsonSchema>)
  const params = JSON.parse(JSON.stringify(baseProps.params)) as JsonSchema
  const pp = params.properties as Record<string, JsonSchema>
  pp.varyParam = { type: 'string', enum: varyEnum, description: '被对比的参数名' }
  ;(params.required as string[]).push('varyParam')

  return {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: [kind] },
      params,
      entities: baseProps.entities,
      streams: {
        type: 'array',
        description: '除内层原有的流之外，必须额外给一条 name="variants" 的流，列出要对比的取值',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            values: { type: 'array', items: { anyOf: [{ type: 'number' }, { type: 'string' }] } },
          },
          required: ['name', 'values'],
          additionalProperties: false,
        },
      },
    },
    required: ['kind', 'params', 'entities', 'streams'],
    additionalProperties: false,
  }
}

export const COMPARE_CACHE_SCHEMA = toCompareSchema(
  CACHE_SCHEMA, 'compare:cache', ['replacement', 'associativity', 'blockSizeBytes', 'cacheSizeBytes'])
export const COMPARE_SCHED_SCHEMA = toCompareSchema(
  SCHED_SCHEMA, 'compare:scheduler', ['algorithm', 'quantum'])
export const COMPARE_TCP_SCHEMA = toCompareSchema(
  TCP_SCHEMA, 'compare:tcp', ['variant', 'initialSsthresh', 'initialCwnd'])

export const SCHEMAS = {
  cache: CACHE_SCHEMA,
  scheduler: SCHED_SCHEMA,
  tcp: TCP_SCHEMA,
  'compare:cache': COMPARE_CACHE_SCHEMA,
  'compare:scheduler': COMPARE_SCHED_SCHEMA,
  'compare:tcp': COMPARE_TCP_SCHEMA,
}

// ═══ schema 管不了的规则，在这里管 ═════════════════════
// 这就是"不能有数值约束 → 验证器从可选变必需"的落点。
import type { SimDocument } from '../core/document.ts'
import type { Violation } from '../core/verify.ts'

const isPow2 = (n: number) => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0

/**
 * 每个 kind 必须存在的 params 及其类型。
 *
 * 为什么不能只靠 schema 的 required：实测发现第三方 Anthropic 兼容端点
 * **不强制 required**（"Cache 没说替换策略"那道题，模型直接省掉了 replacement）。
 * schema 是给模型的提示，不是给我们的保证 —— 落地校验必须自己做。
 */
const REQUIRED: Record<string, Record<string, 'number' | 'string'>> = {
  cache: {
    addressBits: 'number', cacheSizeBytes: 'number', blockSizeBytes: 'number',
    associativity: 'number', replacement: 'string',
  },
  scheduler: { algorithm: 'string', quantum: 'number' },
  page: { algorithm: 'string', frames: 'number' },
  disk: { algorithm: 'string', headStart: 'number', maxTrack: 'number', direction: 'number' },
  tcp: { variant: 'string', initialCwnd: 'number', initialSsthresh: 'number', rounds: 'number' },
  sort: { algorithm: 'string' },
  dijkstra: { source: 'string', directed: 'number' },
  banker: { resources: 'string' },
  arq: {
    protocol: 'string', windowSize: 'number', totalFrames: 'number',
    delay: 'number', timeout: 'number',
  },
}

/** 同名参数在不同 kind 下取值不同 —— 所以按 kind 分表，不能只按字段名 */
const ENUMS: Record<string, Record<string, string[]>> = {
  cache:     { replacement: ['LRU', 'FIFO'] },
  scheduler: { algorithm: ['FCFS', 'SJF', 'SRTF', 'RR'] },
  tcp:       { variant: ['Tahoe', 'Reno'] },
  page:      { algorithm: ['FIFO', 'LRU', 'OPT', 'CLOCK'] },
  disk:      { algorithm: ['FCFS', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK'] },
  sort:      { algorithm: ['直接插入', '希尔', '冒泡', '简单选择', '快速', '堆', '归并'] },
  arq:       { protocol: ['SW', 'GBN', 'SR'] },
}

/**
 * 归一化：把"省略的空集合"补成 `[]`。
 *
 * 为什么要区别对待：缺 `replacement` 是缺一个有语义的值，猜不得，必须拒；
 * 缺 `entities: []` 是缺一个空集合，信息量为零，拒绝没道理。
 * 实测里模型经常直接省掉用不到的数组 —— 这不算错，归一化掉就行。
 */
export function normalizeDocument(doc: SimDocument): SimDocument {
  return {
    ...doc,
    entities: Array.isArray(doc?.entities) ? doc.entities : [],
    streams: Array.isArray(doc?.streams) ? doc.streams : [],
  }
}

/**
 * 组合 doc（compare:xxx）的校验：拆成内层 doc 再走同一套规则。
 * 组合原语没有自己的合法性规则 —— 它的合法性就是"每个变体都合法"。
 */
function validateCompare(raw: SimDocument): Violation[] {
  const v: Violation[] = []
  const innerKind = raw.kind.slice('compare:'.length)
  const vary = raw.params?.varyParam
  if (typeof vary !== 'string')
    return [{ severity: 'error', location: 'params.varyParam', message: '组合实验必须指定被对比的参数名', actual: vary }]

  const streams = Array.isArray(raw.streams) ? raw.streams : []
  const variants = streams.find(s => s.name === 'variants')?.values
  if (!Array.isArray(variants) || variants.length < 2)
    v.push({ severity: 'error', location: 'streams.variants', message: '对比至少要两个取值', actual: variants })

  for (const val of variants ?? []) {
    const params = { ...raw.params, [vary]: val }
    delete params.varyParam
    const inner: SimDocument = {
      kind: innerKind, params,
      entities: raw.entities, streams: streams.filter(s => s.name !== 'variants'),
    }
    for (const e of validateDocument(inner))
      v.push({ ...e, location: `variants[${String(val)}].${e.location}` })
  }
  return v
}

export function validateDocument(raw: SimDocument): Violation[] {
  const v: Violation[] = []
  const err = (location: string, message: string, actual?: unknown) =>
    v.push({ severity: 'error', location, message, actual })

  // ── 关卡 0：结构 —— 字段在不在、类型对不对、枚举合不合法 ──
  if (!raw || typeof raw !== 'object') { err('', '不是对象', raw); return v }
  if (typeof raw.kind === 'string' && raw.kind.startsWith('compare:')) {
    if (!(raw.kind.slice('compare:'.length) in REQUIRED)) {
      err('kind', '未知的内层实验类型', raw.kind); return v
    }
    return validateCompare(raw)
  }
  if (typeof raw.kind !== 'string' || !(raw.kind in REQUIRED)) {
    err('kind', `未知的实验类型`, raw.kind); return v
  }
  if (raw.entities !== undefined && !Array.isArray(raw.entities))
    err('entities', '存在但不是数组', raw.entities)
  if (raw.streams !== undefined && !Array.isArray(raw.streams))
    err('streams', '存在但不是数组', raw.streams)
  if (!raw.params || typeof raw.params !== 'object') {
    err('params', '缺失或不是对象', raw.params); return v
  }
  const doc = normalizeDocument(raw)

  for (const [key, want] of Object.entries(REQUIRED[doc.kind])) {
    const got = doc.params[key]
    if (got === undefined || got === null) {
      err(`params.${key}`, '必填字段缺失', got)
    } else if (typeof got !== want) {
      err(`params.${key}`, `类型应为 ${want}`, got)
    } else {
      const allowed = ENUMS[doc.kind]?.[key]
      if (allowed && !allowed.includes(got as string))
        err(`params.${key}`, `取值必须是 ${allowed.join(' / ')}`, got)
    }
  }
  // 结构不过关就别往下查数值规则了，报错会串
  if (v.length > 0) return v

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
    //  进程表可编辑之后，重名成了真实可达的状态：甘特图会把两个 P1 画成一个
    const ids = doc.entities.map(e => e.id)
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i)
    if (dup.length) err('entities', `进程名重复：${[...new Set(dup)].join('、')}`, dup[0])
    for (const e of doc.entities) {
      if ((e.attrs.burst as number) <= 0) err(`entities.${e.id}.burst`, '执行时间必须为正', e.attrs.burst)
      if ((e.at ?? 0) < 0) err(`entities.${e.id}.at`, '到达时刻不能为负', e.at)
    }
    if ((doc.params.quantum as number) <= 0) err('params.quantum', '时间片必须为正', doc.params.quantum)
  }

  if (doc.kind === 'page') {
    if ((doc.params.frames as number) < 1) err('params.frames', '物理块数至少为 1', doc.params.frames)
    const ref = doc.streams.find(s => s.name === 'referenceString')
    if (!ref) err('streams', '缺少 referenceString')
    else if (ref.values.length === 0) err('streams.referenceString', '引用串为空')
    else if (ref.values.some(x => typeof x !== 'number' || x < 0))
      err('streams.referenceString', '页号必须是非负数字')
  }

  if (doc.kind === 'disk') {
    const p = doc.params
    const maxT = p.maxTrack as number
    const head = p.headStart as number
    if (maxT < 1) err('params.maxTrack', '最大磁道号至少为 1', maxT)
    if (head < 0 || head > maxT) err('params.headStart', `磁头初始位置须在 0..${maxT}`, head)
    const req = doc.streams.find(s => s.name === 'requests')
    if (!req) err('streams', '缺少 requests')
    else if (req.values.length === 0) err('streams.requests', '请求队列为空')
    else {
      const bad = req.values.filter(x => typeof x !== 'number' || x < 0 || x > maxT)
      if (bad.length) err('streams.requests', `有磁道号超出 0..${maxT}`, bad.slice(0, 3))
    }
  }

  if (doc.kind === 'sort') {
    const arr = doc.streams.find(s => s.name === 'array')
    if (!arr) err('streams', '缺少 array')
    else if (arr.values.length < 2) err('streams.array', '待排序数组至少要 2 个元素', arr.values)
    else if (arr.values.some(x => typeof x !== 'number')) err('streams.array', '元素必须是数字')
    else if (arr.values.length > 24) err('streams.array', '超过 24 个元素逐趟展示会失去可读性', arr.values.length)
  }

  if (doc.kind === 'dijkstra') {
    const nodes = doc.entities.filter(e => e.type === 'node').map(e => e.id)
    const edges = doc.entities.filter(e => e.type === 'edge')
    if (nodes.length < 2) err('entities', '至少要有 2 个顶点', nodes.length)
    if (edges.length === 0) err('entities', '至少要有 1 条边')
    if (!nodes.includes(doc.params.source as string))
      err('params.source', '源点不在顶点表里', doc.params.source)
    if (new Set(nodes).size !== nodes.length) err('entities', '顶点 id 有重复')
    const seen = new Set<string>()
    for (const e of edges) {
      const { from, to, w } = e.attrs
      if (from === to) err(`entities.${e.id}`, `自环（${from}→${to}）：最短路里没有意义`, from)
      //  无向图下 A-B 与 B-A 是同一条；重边会让"松弛一次"变成松弛两次，步骤对不上教材
      const key = doc.params.directed === 1
        ? `${from}>${to}` : [String(from), String(to)].sort().join('-')
      if (seen.has(key)) err(`entities.${e.id}`, `与已有的边重复（${from}–${to}）`, key)
      seen.add(key)
      if (!nodes.includes(from as string)) err(`entities.${e.id}.from`, '端点不在顶点表里', from)
      if (!nodes.includes(to as string)) err(`entities.${e.id}.to`, '端点不在顶点表里', to)
      // Dijkstra 不接受负权 —— 这是算法前提，不是实现限制
      if (typeof w !== 'number' || w < 0)
        err(`entities.${e.id}.w`, 'Dijkstra 要求边权非负，负权请用 Bellman-Ford', w)
    }
  }

  if (doc.kind === 'banker') {
    const res = String(doc.params.resources).split(',').map(s => s.trim()).filter(Boolean)
    const resEnts = doc.entities.filter(e => e.type === 'resource')
    const procs = doc.entities.filter(e => e.type === 'process')
    if (res.length === 0) err('params.resources', '至少要有一类资源')
    if (procs.length === 0) err('entities', '至少要有一个进程')
    const pid = procs.map(e => e.id)
    const pdup = pid.filter((x, i) => pid.indexOf(x) !== i)
    if (pdup.length) err('entities', `进程名重复：${[...new Set(pdup)].join('、')}`, pdup[0])
    for (const r of res)
      if (!resEnts.some(e => e.id === r)) err(`entities.${r}`, `资源 ${r} 没有给出总量`)
    for (const p of procs) for (const r of res) {
      const mx = p.attrs[`max_${r}`], al = p.attrs[`alloc_${r}`]
      if (typeof mx !== 'number' || typeof al !== 'number') {
        err(`entities.${p.id}`, `缺少 max_${r} / alloc_${r}`); continue
      }
      if (al > mx) err(`entities.${p.id}.alloc_${r}`, `已分配 ${al} 超过最大需求 ${mx}`, al)
      if (al < 0 || mx < 0) err(`entities.${p.id}.max_${r}`, '需求量不能为负')
    }
    // 已分配总和不能超过系统总量 —— 这是状态本身就不合法，不是"不安全"
    for (const r of res) {
      const total = Number(resEnts.find(e => e.id === r)?.attrs.total ?? 0)
      const used = procs.reduce((s, p) => s + Number(p.attrs[`alloc_${r}`] ?? 0), 0)
      if (used > total) err(`entities.${r}.total`, `资源 ${r} 已分配 ${used} 超过总量 ${total}`, total)
    }
  }

  if (doc.kind === 'arq') {
    const p = doc.params
    const W = p.windowSize as number, N = p.totalFrames as number
    if (N < 1) err('params.totalFrames', '至少要发 1 帧', N)
    if (W < 1) err('params.windowSize', '窗口至少为 1', W)
    if (p.protocol === 'SW' && W !== 1) err('params.windowSize', '停止等待的窗口只能是 1', W)
    if (W > N) err('params.windowSize', `窗口 ${W} 超过总帧数 ${N}，看不出滑动`, W)
    if ((p.delay as number) < 1) err('params.delay', '传播时延至少 1 个时隙', p.delay)
    // 超时必须大于一个往返，否则每帧都会在 ACK 回来之前先超时 —— 协议永远收敛不了
    if ((p.timeout as number) <= 2 * (p.delay as number))
      err('params.timeout', `超时 ${p.timeout} 必须大于往返 ${2 * (p.delay as number)}，否则 ACK 还没回来就重传`, p.timeout)
    for (const e of doc.entities) {
      const seq = Number(e.attrs.seq)
      if (!['frame', 'ack'].includes(String(e.attrs.target)))
        err(`entities.${e.id}.target`, '丢失对象只能是 frame 或 ack', e.attrs.target)
      if (seq < 0 || seq >= N) err(`entities.${e.id}.seq`, `序号 ${seq} 超出 0..${N - 1}`, seq)
    }
  }

  if (doc.kind === 'tcp') {
    const p = doc.params
    if ((p.rounds as number) <= 0) err('params.rounds', '轮数必须为正', p.rounds)
    if ((p.initialCwnd as number) <= 0) err('params.initialCwnd', '初始 cwnd 必须为正', p.initialCwnd)
    if ((p.initialSsthresh as number) <= 1) err('params.initialSsthresh', 'ssthresh 必须 >1', p.initialSsthresh)
    const lid = doc.entities.map(e => e.id)
    const ldup = lid.filter((x, i) => lid.indexOf(x) !== i)
    if (ldup.length) err('entities', `事件编号重复：${[...new Set(ldup)].join('、')}`, ldup[0])
    for (const e of doc.entities) {
      const at = e.at ?? 0
      if (at < 1 || at > (p.rounds as number))
        err(`entities.${e.id}.at`, `丢包轮次 ${at} 超出 1..${p.rounds}`, at)
    }
  }

  return v
}
