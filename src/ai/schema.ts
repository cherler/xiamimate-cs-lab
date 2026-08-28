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
  float: { format: 'string', operation: 'string' },
  pipeline: { forwarding: 'number' },
  vm: { virtualBits: 'number', pageSizeBytes: 'number', tlbEntries: 'number' },
  multiply: { algorithm: 'string', bits: 'number' },
  crc: { generator: 'string', operation: 'string', errorAt: 'number' },
  hamming: { operation: 'string', errorAt: 'number', evenParity: 'number' },
  subnet: { operation: 'string', prefix: 'number', splitBits: 'number' },
  handshake: { scenario: 'string', clientSeq: 'number', serverSeq: 'number' },
  avl: { mode: 'string' },
  hash: { size: 'number', method: 'string', rehashStep: 'number' },
  huffman: {},
  kmp: { text: 'string', pattern: 'string', showMatch: 'number' },
  mst: { algorithm: 'string', start: 'string' },
  topo: { operation: 'string' },
  partition: { algorithm: 'string', memorySize: 'number' },
  inode: { blockSizeBytes: 'number', pointerSizeBytes: 'number', directCount: 'number' },
  bplus: { order: 'number' },
  btree: { order: 'string' },
  addsub: { operation: 'string', bits: 'number' },
  rip: { scenario: 'string' },
  expr: { expr: 'string' },
  radix: { requests: 'string', budget: 'number' },
  paged: { schedule: 'string', blockSize: 'number', totalBlocks: 'number' },
  softmax: { temperature: 'number', logits: 'string' },
  attention: { sentence: 'string' },
  llmsize: { model: 'string', dtype: 'string', seq: 'number' },
  sampling: { temperature: 'number', topK: 'number', topP: 'number', logits: 'string' },
  bpe: { text: 'string' },
  batching: { mode: 'string', slots: 'number' },
  mha: { variant: 'string', heads: 'number', groups: 'number' },
  kvcache: { prompt: 'number', total: 'number' },
  flash: { block: 'number' },
  scaledmask: { d: 'number', causal: 'number' },
  specdec: { k: 'number' },
  quant: { bits: 'number' },
  moe: { topk: 'number' },
  rope: { theta: 'number' },
  roofline: { d: 'number' },
  rmsnorm: { gain: 'string' },
  forward: {},
  matmul: {},
  layout: { layout: 'string' },
  tensorpar: { gpus: 'number' },
  collective: { gpus: 'number' },
  chunkprefill: { chunk: 'number' },
  kvoffload: { slots: 'number' },
  engine: { pool: 'number' },
  scale: {},
  ortho: {},
  hopfield: {},
  lln: {},
  clt: {},
  xent: {},
  bayes: {},
  bloom: {},
  graddesc: {},
  residual: {},
  induction: {},
  editdist: {},
  lowrank: {},
  dotsim: {},
  greedy: {},
  jl: {},
  maxent: {},
  condnum: {},
  linattn: {},
  engram: {},
  flashdecode: { chunks: 'number' },
  dpattn: { gpus: 'number' },
  ep: { gpus: 'number' },
  pp: { micro: 'number' },
  linreg: {},
  conv: { kernel: 'string' },
  binsearch: {},
  nqueens: {},
  unionfind: {},
  heap: {},
  quicksort: {},
  mergesort: {},
  fastpow: {},
  mvcc: {},
  iso: { level: 'string' },
  cas: {},
  mesi: {},
  deadlock: {},
  raft: {},
  caesar: {},
  vigenere: {},
  xor: {},
  modpow: {},
  diffiehellman: {},
  rsa: {},
  extgcd: {},
  signature: {},
  hashaval: {},
  merkle: {},
  crt: {},
  fermat: {},
  salt: {},
  tokenbucket: {},
  consistenthash: {},
  skiplist: {},
  twopc: {},
  otpreuse: {},
  wal: {},
  lsm: {},
  minikv: {},
  urlshortener: {},
  seckill: {},
  minisearch: {},
  mqdesign: {},
  ecbcbc: {},
  birthday: {},
  aesround: {},
  hmac: {},
  totp: {},
  snowflake: {},
  vectorclock: {},
  quorum: {},
  circuitbreaker: {},
  joins: {},
  compositeindex: {},
  rwlock: {},
  aba: {},
  happensbefore: {},
  lrucache: {},
  topk: {},
  reactagent: {},
  lfucache: {},
  trie: {},
  quickselect: {},
  lockstrategy: {},
  bufferpool: {},
  feed: {},
  wildcard: {},
  astar: {},
  perceptron: {},
  pooling: { kind: 'string' },
  beam: {},
  rag: {},
  selfconsist: {},
  bestofn: {},
  tot: {},
  mcts: {},
  collision: {},
  gcn: {},
  diffusion: {},
  gan: {},
  pagerank: {},
  qlearn: {},
  recsys: {},
  rnn: {},
  wordvec: {},
  lstm: {},
  norm: { kind: 'string' },
  backprop: {},
  logreg: {},
  dtree: {},
  gbdt: {},
  svm: {},
  pca: {},
  kmeans: {},
  knn: { k: 'number' },
  traverse: { algorithm: 'string', start: 'string', directed: 'number' },
  semaphore: { bufferSize: 'number', order: 'string' },
  bitmap: { words: 'number', wordBits: 'number' },
  csma: { maxAttempts: 'number' },
}

/** 同名参数在不同 kind 下取值不同 —— 所以按 kind 分表，不能只按字段名 */
const ENUMS: Record<string, Record<string, string[]>> = {
  cache:     { replacement: ['LRU', 'FIFO'] },
  iso:       { level: ['读未提交', '读已提交', '可重复读', '串行化'] },
  scheduler: { algorithm: ['FCFS', 'SJF', 'SRTF', 'RR'] },
  tcp:       { variant: ['Tahoe', 'Reno'] },
  page:      { algorithm: ['FIFO', 'LRU', 'OPT', 'CLOCK'] },
  disk:      { algorithm: ['FCFS', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK'] },
  sort:      { algorithm: ['直接插入', '希尔', '冒泡', '简单选择', '快速', '堆', '归并'] },
  arq:       { protocol: ['SW', 'GBN', 'SR'] },
  float:     { format: ['single', 'double'], operation: ['encode', 'add', 'sub'] },
  multiply:  { algorithm: ['原码一位乘', 'Booth', '加减交替'] },
  crc:       { operation: ['encode', 'check'] },
  hamming:   { operation: ['encode', 'check'] },
  subnet:    { operation: ['subnet', 'lpm'] },
  handshake: { scenario: ['connect', 'close', 'both'] },
  avl:       { mode: ['avl', 'bst'] },
  hash:      { method: ['拉链', '线性探测', '平方探测', '再散列'] },
  mst:       { algorithm: ['Prim', 'Kruskal'] },
  topo:      { operation: ['topo', 'critical'] },
  partition: { algorithm: ['首次适应', '最佳适应', '最坏适应', '邻近适应'] },
  traverse:  { algorithm: ['DFS', 'BFS'] },
  semaphore: { order: ['correct', 'wrong'] },
  btree:     { order: ['前序', '中序', '后序', '层序'] },
  addsub:    { operation: ['加', '减'] },
  rip:       { scenario: ['收敛', '断链'] },
  radix:     { requests: ['共享 system 前缀', '各不相同', '层层加深'] },
  paged:     { schedule: ['两请求交错', '一请求增长', '释放后复用'] },
  softmax:   { logits: ['天气续写', '接近平局', '一枝独秀'] },
  rmsnorm:   { gain: ['全 1', '放大末维'] },
  layout:    { layout: ['row-major', 'col-major'] },
  attention: { sentence: ['它爱吃鱼', '猫追老鼠'] },
  llmsize:   { model: ['GPT-2 (124M)', 'GPT-2 Medium (350M)', '7B 级'], dtype: ['fp32', 'fp16', 'int8'] },
  sampling:  { logits: ['长尾一堆', '两强争锋'] },
  bpe:       { text: ['英文 lowest', '重复串 abab', '中文 你好'] },
  batching:  { mode: ['连续', '静态'] },
  mha:       { variant: ['MHA', 'MQA', 'GQA'] },
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

  if (doc.kind === 'float') {
    const ops = doc.streams.find(s => s.name === 'operands')
    const need = doc.params.operation === 'encode' ? 1 : 2
    if (!ops) err('streams', '缺少 operands')
    else if (ops.values.length < need)
      err('streams.operands', `${doc.params.operation === 'encode' ? '编码' : '加减'}需要 ${need} 个操作数`, ops.values.length)
    else if (ops.values.some(v => typeof v !== 'number' || !Number.isFinite(v)))
      err('streams.operands', '操作数必须是有限的数字')
  }

  if (doc.kind === 'pipeline') {
    const insts = doc.entities.filter(e => e.type === 'inst')
    if (insts.length === 0) err('entities', '至少要有一条指令')
    if (insts.length > 12) err('entities', '超过 12 条指令时空图会看不过来', insts.length)
    const ids = insts.map(e => e.id)
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i)
    if (dup.length) err('entities', `指令编号重复：${[...new Set(dup)].join('、')}`, dup[0])
    const OPS = ['add', 'sub', 'and', 'or', 'lw', 'sw', 'beq', 'bne', 'j']
    for (const e of insts) {
      if (!OPS.includes(String(e.attrs.op)))
        err(`entities.${e.id}.op`, `未知指令：合法的有 ${OPS.join(' / ')}`, e.attrs.op)
      //  写回自己的源寄存器不算错，但写 R0 之类的常零寄存器在多数体系里是无效写
      if (String(e.attrs.rd) === 'R0')
        err(`entities.${e.id}.rd`, 'R0 恒为零，不能作为目的寄存器', e.attrs.rd)
    }
  }

  if (doc.kind === 'vm') {
    const p = doc.params
    const page = p.pageSizeBytes as number
    const vb = p.virtualBits as number
    if (!isPow2(page)) err('params.pageSizeBytes', '页大小必须是 2 的幂', page)
    if (vb < 1 || vb > 32) err('params.virtualBits', '虚地址位数须在 1..32', vb)
    else if (page > Math.pow(2, vb)) err('params.pageSizeBytes', `页大小超过整个虚地址空间`, page)
    if ((p.tlbEntries as number) < 1) err('params.tlbEntries', 'TLB 至少 1 项', p.tlbEntries)
    const pages = Math.pow(2, vb) / page
    const ptes = doc.entities.filter(e => e.type === 'pte')
    if (ptes.length === 0) err('entities', '页表不能为空')
    const pids = ptes.map(e => e.id)
    const pdup = pids.filter((x, i) => pids.indexOf(x) !== i)
    if (pdup.length) err('entities', `页号重复：${[...new Set(pdup)].join('、')}`, pdup[0])
    for (const e of ptes) {
      const pn = Number(e.id)
      if (!Number.isInteger(pn) || pn < 0 || pn >= pages)
        err(`entities.${e.id}`, `页号超出 0..${pages - 1}`, e.id)
    }
    const seq = doc.streams.find(s => s.name === 'virtualAddresses')
    if (!seq) err('streams', '缺少 virtualAddresses')
    else if (seq.values.length === 0) err('streams.virtualAddresses', '访问序列为空')
    else {
      const oob = seq.values.filter(v => typeof v !== 'number' || v < 0 || v >= Math.pow(2, vb))
      if (oob.length) err('streams.virtualAddresses', `有地址超出 0..2^${vb}−1`, oob.slice(0, 3))
    }
  }

  if (doc.kind === 'multiply') {
    const bits = doc.params.bits as number
    if (![4, 8, 16].includes(bits)) err('params.bits', '位数只支持 4 / 8 / 16', bits)
    const ops = doc.streams.find(s => s.name === 'operands')
    if (!ops) err('streams', '缺少 operands')
    else if (ops.values.length < 2) err('streams.operands', '需要两个操作数', ops.values.length)
    else {
      const [a, b] = ops.values as number[]
      const lim = Math.pow(2, bits - 1)
      if (!Number.isInteger(a) || a < -lim || a >= lim)
        err('streams.operands', `第 1 个操作数须在 ${-lim}..${lim - 1}（${bits} 位补码）`, a)
      if (!Number.isInteger(b) || b < -lim || b >= lim)
        err('streams.operands', `第 2 个操作数须在 ${-lim}..${lim - 1}`, b)
      if (doc.params.algorithm === '加减交替' && b === 0)
        err('streams.operands', '除数不能为 0', b)
    }
  }

  if (doc.kind === 'crc') {
    const g = String(doc.params.generator)
    if (!/^[01]+$/.test(g)) err('params.generator', '生成多项式只能由 0/1 组成', g)
    else if (g.length < 2) err('params.generator', '生成多项式至少 2 位（1 位校验码）', g)
    //  首位必须是 1，否则最高次项系数为 0，等价于一个更短的多项式
    else if (g[0] !== '1') err('params.generator', '生成多项式最高位必须是 1', g)
    const d = doc.streams.find(s => s.name === 'dataBits')
    if (!d) err('streams', '缺少 dataBits')
    else if (d.values.length === 0) err('streams.dataBits', '数据不能为空')
    else if (d.values.some(v => v !== 0 && v !== 1)) err('streams.dataBits', '数据位只能是 0 或 1')
    else if (d.values.length > 32) err('streams.dataBits', '超过 32 位除法步骤会看不过来', d.values.length)
  }

  if (doc.kind === 'hamming') {
    const d = doc.streams.find(s => s.name === 'dataBits')
    if (!d) err('streams', '缺少 dataBits')
    else if (d.values.length === 0) err('streams.dataBits', '数据不能为空')
    else if (d.values.some(v => v !== 0 && v !== 1)) err('streams.dataBits', '数据位只能是 0 或 1')
    else if (d.values.length > 16) err('streams.dataBits', '超过 16 位校验分组会看不清', d.values.length)
    else {
      const k = d.values.length
      let r = 0
      while (Math.pow(2, r) < k + r + 1) r++
      const at = doc.params.errorAt as number
      if (at < 0 || at > k + r)
        err('params.errorAt', `出错位号须在 0..${k + r}（0 表示不注入）`, at)
    }
  }

  if (doc.kind === 'subnet') {
    const p = doc.params
    const prefix = p.prefix as number
    const split = p.splitBits as number
    if (p.operation === 'subnet') {
      if (prefix < 0 || prefix > 32) err('params.prefix', '前缀长度须在 0..32', prefix)
      if (split < 0) err('params.splitBits', '借位数不能为负', split)
      else if (prefix + split > 32)
        err('params.splitBits', `前缀 ${prefix} 再借 ${split} 位超过 32 位`, split)
    } else {
      const routes = doc.entities.filter(e => e.type === 'route')
      if (routes.length === 0) err('entities', '路由表不能为空')
      for (const r of routes) {
        const pl = Number(r.attrs.prefix)
        if (!Number.isInteger(pl) || pl < 0 || pl > 32)
          err(`entities.${r.id}.prefix`, '前缀长度须在 0..32', r.attrs.prefix)
        const nw = Number(r.attrs.network)
        if (!Number.isInteger(nw) || nw < 0 || nw > 0xFFFFFFFF)
          err(`entities.${r.id}.network`, '网络号超出 32 位地址范围', r.attrs.network)
        //  网络号的主机位必须为 0，否则这条路由项本身写错了
        else if (pl > 0 && pl < 32) {
          const m = (0xFFFFFFFF << (32 - pl)) >>> 0
          if (((nw & m) >>> 0) !== nw)
            err(`entities.${r.id}.network`, `网络号的主机位不为 0，与 /${pl} 不自洽`, r.attrs.network)
        }
      }
    }
    const a = doc.streams.find(s => s.name === 'addresses')
    if (!a) err('streams', '缺少 addresses')
    else if (a.values.length === 0) err('streams.addresses', '地址不能为空')
    else if (a.values.some(v => typeof v !== 'number' || v < 0 || v > 0xFFFFFFFF))
      err('streams.addresses', '地址必须在 0..2^32−1')
  }

  if (doc.kind === 'handshake') {
    const p = doc.params
    if ((p.clientSeq as number) < 0) err('params.clientSeq', '初始序号不能为负', p.clientSeq)
    if ((p.serverSeq as number) < 0) err('params.serverSeq', '初始序号不能为负', p.serverSeq)
    for (const e of doc.entities) {
      const nth = Number(e.attrs.nth)
      if (!Number.isInteger(nth) || nth < 1)
        err(`entities.${e.id}.nth`, '丢失的报文段序号从 1 起', e.attrs.nth)
    }
  }

  if (doc.kind === 'avl') {
    const k = doc.streams.find(s => s.name === 'keys')
    if (!k) err('streams', '缺少 keys')
    else if (k.values.length === 0) err('streams.keys', '插入序列为空')
    else if (k.values.some(v => typeof v !== 'number' || !Number.isInteger(v)))
      err('streams.keys', '键必须是整数')
    else if (k.values.length > 20) err('streams.keys', '超过 20 个键树会画不下', k.values.length)
  }

  if (doc.kind === 'hash') {
    const size = doc.params.size as number
    if (size < 1) err('params.size', '表长至少为 1', size)
    else if (size > 31) err('params.size', '表长超过 31 槽位表会看不过来', size)
    const step = doc.params.rehashStep as number
    if (step < 1) err('params.rehashStep', '再散列步长至少为 1', step)
    //  步长与表长不互质时，再散列探查不到所有槽 —— 这是个真实的坑
    else if (doc.params.method === '再散列') {
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
      if (gcd(step, size) !== 1)
        err('params.rehashStep', `步长 ${step} 与表长 ${size} 不互质，探查不到所有槽`, step)
    }
    const k = doc.streams.find(s => s.name === 'keys')
    if (!k) err('streams', '缺少 keys')
    else if (k.values.length === 0) err('streams.keys', '键序列为空')
    else if (k.values.some(v => typeof v !== 'number' || v < 0)) err('streams.keys', '键必须是非负整数')
    else if (doc.params.method !== '拉链' && k.values.length > size)
      err('streams.keys', `开放定址下键数 ${k.values.length} 超过表长 ${size}，必然装不下`, k.values.length)
  }

  if (doc.kind === 'huffman') {
    const w = doc.streams.find(s => s.name === 'weights')
    if (!w) err('streams', '缺少 weights')
    else if (w.values.length === 0) err('streams.weights', '权值不能为空')
    else if (w.values.some(v => typeof v !== 'number' || v <= 0))
      err('streams.weights', '权值必须为正数')
    else if (w.values.length > 12) err('streams.weights', '超过 12 个叶子树会画不下', w.values.length)
  }

  if (doc.kind === 'kmp') {
    const t = String(doc.params.text)
    const p = String(doc.params.pattern)
    if (p.length === 0) err('params.pattern', '模式串不能为空')
    else if (p.length > 24) err('params.pattern', '模式串过长，next 表会看不过来', p.length)
    if (t.length === 0) err('params.text', '主串不能为空')
    else if (t.length > 48) err('params.text', '主串过长，对齐图会看不过来', t.length)
  }

  if (doc.kind === 'mst' || doc.kind === 'topo') {
    const nodes = doc.entities.filter(e => e.type === 'node').map(e => e.id)
    const edges = doc.entities.filter(e => e.type === 'edge')
    if (nodes.length < 2) err('entities', '至少要有 2 个顶点', nodes.length)
    if (edges.length === 0) err('entities', '至少要有 1 条边')
    if (doc.kind === 'mst' && !nodes.includes(String(doc.params.start)))
      err('params.start', '起点不在顶点表里', doc.params.start)
    for (const e of edges) {
      if (!nodes.includes(String(e.attrs.from))) err(`entities.${e.id}.from`, '端点不在顶点表里', e.attrs.from)
      if (!nodes.includes(String(e.attrs.to))) err(`entities.${e.id}.to`, '端点不在顶点表里', e.attrs.to)
      if (e.attrs.from === e.attrs.to) err(`entities.${e.id}`, '自环在这两个算法里没有意义', e.attrs.from)
      const w = Number(e.attrs.w)
      if (!Number.isFinite(w)) err(`entities.${e.id}.w`, '权值必须是数字', e.attrs.w)
      else if (doc.kind === 'topo' && w < 0) err(`entities.${e.id}.w`, '活动耗时不能为负', w)
    }
  }

  if (doc.kind === 'partition') {
    const total = doc.params.memorySize as number
    if (total < 1) err('params.memorySize', '内存大小必须为正', total)
    const reqs = doc.entities.filter(e => e.type === 'req')
    if (reqs.length === 0) err('entities', '请求序列不能为空')
    for (const r of reqs) {
      const size = Number(r.attrs.size)
      const isFree = Number(r.attrs.free ?? 0) === 1
      if (!isFree) {
        if (!Number.isInteger(size) || size <= 0)
          err(`entities.${r.id}.size`, '申请大小必须为正整数', r.attrs.size)
        else if (size > total)
          err(`entities.${r.id}.size`, `申请 ${size} KB 超过内存总量 ${total} KB`, size)
      }
    }
  }

  if (doc.kind === 'inode') {
    const bs = doc.params.blockSizeBytes as number
    const ps = doc.params.pointerSizeBytes as number
    const dc = doc.params.directCount as number
    if (!isPow2(bs)) err('params.blockSizeBytes', '块大小必须是 2 的幂', bs)
    if (ps < 1) err('params.pointerSizeBytes', '指针至少 1 字节', ps)
    else if (ps > bs) err('params.pointerSizeBytes', '指针比一个块还大，索引块放不下任何指针', ps)
    if (dc < 0) err('params.directCount', '直接地址个数不能为负', dc)
    const b = doc.streams.find(s => s.name === 'blockNumbers')
    if (!b) err('streams', '缺少 blockNumbers')
    else if (b.values.length === 0) err('streams.blockNumbers', '逻辑块号序列为空')
    else if (b.values.some(v => typeof v !== 'number' || v < 0 || !Number.isInteger(v)))
      err('streams.blockNumbers', '逻辑块号必须是非负整数')
  }

  if (doc.kind === 'bplus') {
    const m = doc.params.order as number
    //  B+ 树的阶至少是 3：阶为 2 时每个结点只能放 1 个键，分裂永远收敛不了
    if (!Number.isInteger(m) || m < 3) err('params.order', 'B+ 树的阶至少为 3', m)
    else if (m > 8) err('params.order', '阶超过 8 时结点太宽，画不下', m)
    const k = doc.streams.find(s => s.name === 'keys')
    if (!k) err('streams', '缺少 keys')
    else if (k.values.length === 0) err('streams.keys', '插入序列为空')
    else if (k.values.some(v => typeof v !== 'number' || !Number.isInteger(v)))
      err('streams.keys', '键必须是整数')
    else if (k.values.length > 24) err('streams.keys', '超过 24 个键树会画不下', k.values.length)
  }

  if (doc.kind === 'traverse') {
    const nodes = doc.entities.filter(e => e.type === 'node').map(e => e.id)
    if (nodes.length < 2) err('entities', '至少要有 2 个顶点', nodes.length)
    if (!nodes.includes(String(doc.params.start)))
      err('params.start', '起点不在顶点表里', doc.params.start)
    for (const e of doc.entities.filter(x => x.type === 'edge')) {
      if (!nodes.includes(String(e.attrs.from))) err(`entities.${e.id}.from`, '端点不在顶点表里', e.attrs.from)
      if (!nodes.includes(String(e.attrs.to))) err(`entities.${e.id}.to`, '端点不在顶点表里', e.attrs.to)
    }
  }

  if (doc.kind === 'semaphore') {
    const b = doc.params.bufferSize as number
    if (b < 1) err('params.bufferSize', '缓冲区至少 1 个位置', b)
    else if (b > 8) err('params.bufferSize', '缓冲区超过 8 个位置就看不清了', b)
    const sc = doc.streams.find(s => s.name === 'schedule')
    if (!sc) err('streams', '缺少 schedule')
    else if (sc.values.length === 0) err('streams.schedule', '调度序列为空')
    else {
      const bad2 = sc.values.filter(v => !/^[PC]\d+$/.test(String(v)))
      if (bad2.length) err('streams.schedule', '线程名必须形如 P1 / C1（P 生产者、C 消费者）', bad2.slice(0, 3))
      const kinds = new Set(sc.values.map(v => String(v)[0]))
      if (kinds.size < 2) err('streams.schedule', '生产者和消费者都要有，否则演示不出协作', [...kinds])
    }
  }

  if (doc.kind === 'bitmap') {
    const w = doc.params.words as number
    const wb = doc.params.wordBits as number
    if (w < 1) err('params.words', '至少 1 个字', w)
    else if (w > 16) err('params.words', '超过 16 个字画不下', w)
    if (![8, 16, 32].includes(wb)) err('params.wordBits', '字长只支持 8 / 16 / 32 位', wb)
    for (const r of doc.entities.filter(e => e.type === 'req')) {
      const c = Number(r.attrs.count)
      if (!Number.isInteger(c) || c < 1) err(`entities.${r.id}.count`, '块数必须是正整数', r.attrs.count)
      if (Number(r.attrs.free ?? 0) === 1) {
        const b = Number(r.attrs.block)
        if (!Number.isInteger(b) || b < 0 || b >= w * wb)
          err(`entities.${r.id}.block`, `回收的起始盘块号须在 0..${w * wb - 1}`, r.attrs.block)
      }
    }
  }

  if (doc.kind === 'csma') {
    const m = doc.params.maxAttempts as number
    if (m < 1) err('params.maxAttempts', '重传上限至少为 1', m)
    const st = doc.entities.filter(e => e.type === 'station')
    if (st.length < 1) err('entities', '至少要有 1 个站')
    for (const s of st) {
      if (Number(s.attrs.readyAt ?? 0) < 1)
        err(`entities.${s.id}.readyAt`, '就绪时刻从第 1 个争用期起', s.attrs.readyAt)
      const picks = String(s.attrs.picks ?? '').split(/[,\s]+/).filter(Boolean)
      if (picks.some(x => !/^\d+$/.test(x)))
        err(`entities.${s.id}.picks`, '退避取值必须是用逗号分隔的非负整数', s.attrs.picks)
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
