/**
 * 独立设计 #1：Cache 命中率
 * 不预设任何统一抽象，让它长成本来该长的样子。
 */

// ─── DSL ───────────────────────────────────────────────
export type CacheDSL = {
  kind: 'cache'
  addressBits: number
  cacheSizeBytes: number
  blockSizeBytes: number
  associativity: number          // 1 = 直接映射
  replacement: 'LRU' | 'FIFO'
  accessSequence: number[]       // 地址序列 —— 密集，每步消费一个
}

// ─── 每步状态 ───────────────────────────────────────────
export type CacheStep = {
  i: number
  address: number
  tag: number
  setIndex: number
  offset: number
  outcome: 'hit' | 'miss'
  wayUsed: number
  evictedTag: number | null
  hits: number
  misses: number
  // 逐步日志（内容标准第 3 条）
  log: string
}

// ─── 参考实现 ───────────────────────────────────────────
export function runCache(d: CacheDSL): CacheStep[] {
  const numSets = d.cacheSizeBytes / d.blockSizeBytes / d.associativity
  const offsetBits = Math.log2(d.blockSizeBytes)
  const indexBits = Math.log2(numSets)

  // sets[setIndex][way] = { tag, stamp } | null
  const sets: ({ tag: number; stamp: number } | null)[][] =
    Array.from({ length: numSets }, () => Array(d.associativity).fill(null))

  let clock = 0, hits = 0, misses = 0
  const trace: CacheStep[] = []

  d.accessSequence.forEach((address, i) => {
    clock++
    const offset = address & ((1 << offsetBits) - 1)
    const setIndex = (address >> offsetBits) & ((1 << indexBits) - 1)
    const tag = address >>> (offsetBits + indexBits)
    const set = sets[setIndex]

    const hitWay = set.findIndex(e => e !== null && e.tag === tag)
    let outcome: 'hit' | 'miss', wayUsed: number, evictedTag: number | null = null

    if (hitWay >= 0) {
      outcome = 'hit'; hits++; wayUsed = hitWay
      if (d.replacement === 'LRU') set[hitWay]!.stamp = clock
    } else {
      outcome = 'miss'; misses++
      const emptyWay = set.findIndex(e => e === null)
      if (emptyWay >= 0) {
        wayUsed = emptyWay
      } else {
        // LRU 与 FIFO 都是"最小 stamp 淘汰"，区别只在命中时更不更新 stamp
        let victim = 0
        for (let w = 1; w < set.length; w++)
          if (set[w]!.stamp < set[victim]!.stamp) victim = w
        wayUsed = victim
        evictedTag = set[victim]!.tag
      }
      set[wayUsed] = { tag, stamp: clock }
    }

    const log = outcome === 'hit'
      ? `0x${address.toString(16).toUpperCase()} → tag=0x${tag.toString(16).toUpperCase()} 组号=${setIndex} → 第 ${wayUsed} 路命中`
      : `0x${address.toString(16).toUpperCase()} → tag=0x${tag.toString(16).toUpperCase()} 组号=${setIndex} → 缺失，${
          evictedTag === null ? `填入空闲的第 ${wayUsed} 路`
          : `按 ${d.replacement} 淘汰第 ${wayUsed} 路（原 tag=0x${evictedTag.toString(16).toUpperCase()}）` }`

    trace.push({ i, address, tag, setIndex, offset, outcome, wayUsed, evictedTag, hits, misses, log })
  })

  return trace
}

// ─── 跑一个 ─────────────────────────────────────────────
if (import.meta.filename === process.argv[1]) {
  const dsl: CacheDSL = {
    kind: 'cache',
    addressBits: 32,
    cacheSizeBytes: 256,
    blockSizeBytes: 16,
    associativity: 2,
    replacement: 'LRU',
    accessSequence: [0x00, 0x10, 0x20, 0x00, 0x110, 0x210, 0x10, 0x20],
  }
  const trace = runCache(dsl)
  console.log('── Cache 轨迹 ──')
  for (const s of trace) console.log(`  [${s.i}] ${s.outcome.padEnd(4)} ${s.log}`)
  const last = trace[trace.length - 1]
  console.log(`  命中率 ${(last.hits / trace.length * 100).toFixed(1)}%  (${last.hits}/${trace.length})`)
}
