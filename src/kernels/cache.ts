/**
 * 内核：Cache 命中率（数据结构 / 组成原理）
 * 轴：step（每次访问一步）· 也支持 parameter 扫描
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type CacheState = {
  // ── 可见部分（进轨迹、进 UI、参与比对）
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
  log: string
  // ── 重放所需（验收标准 2：不许藏在闭包里）
  sets: ({ tag: number; stamp: number } | null)[][]
  clock: number
}

export const CACHE_VISIBLE = [
  'i', 'address', 'tag', 'setIndex', 'offset',
  'outcome', 'wayUsed', 'evictedTag', 'hits', 'misses', 'log',
] as const

const hex = (n: number) => n.toString(16).toUpperCase()

export const cacheKernel: Kernel<CacheState> = {
  kind: 'cache',

  compile(doc: SimDocument): CompiledModel<CacheState> {
    const p = doc.params
    const cacheSize = num(p, 'cacheSizeBytes')
    const blockSize = num(p, 'blockSizeBytes')
    const ways = num(p, 'associativity')
    const policy = str(p, 'replacement')

    const numSets = cacheSize / blockSize / ways
    const offsetBits = Math.log2(blockSize)
    const indexBits = Math.log2(numSets)
    const seq = (doc.streams.find(s => s.name === 'accessSequence')?.values ?? []) as number[]

    const emptySets = (): CacheState['sets'] =>
      Array.from({ length: numSets }, () => Array(ways).fill(null))

    return {
      axis: { kind: 'step', label: '访问序号' },

      initial: () => ({
        i: -1, address: 0, tag: 0, setIndex: 0, offset: 0,
        outcome: 'miss', wayUsed: 0, evictedTag: null,
        hits: 0, misses: 0, log: '',
        sets: emptySets(), clock: 0,
      }),

      describe: s => s.log,

      step(prev) {
        const base = prev ?? this.initial()
        const i = base.i + 1
        if (i >= seq.length) return null

        // 深拷贝：状态不可变，否则重放串味
        const sets = base.sets.map(set => set.map(e => (e ? { ...e } : null)))
        const clock = base.clock + 1
        const address = seq[i]

        const offset = address & ((1 << offsetBits) - 1)
        const setIndex = (address >> offsetBits) & ((1 << indexBits) - 1)
        const tag = address >>> (offsetBits + indexBits)
        const set = sets[setIndex]

        const hitWay = set.findIndex(e => e !== null && e.tag === tag)
        let outcome: 'hit' | 'miss'
        let wayUsed: number
        let evictedTag: number | null = null
        let hits = base.hits
        let misses = base.misses

        if (hitWay >= 0) {
          outcome = 'hit'
          hits++
          wayUsed = hitWay
          // LRU 命中时更新时间戳；FIFO 不更新 —— 两者唯一的区别
          if (policy === 'LRU') set[hitWay]!.stamp = clock
        } else {
          outcome = 'miss'
          misses++
          const empty = set.findIndex(e => e === null)
          if (empty >= 0) {
            wayUsed = empty
          } else {
            let victim = 0
            for (let w = 1; w < set.length; w++) {
              if (set[w]!.stamp < set[victim]!.stamp) victim = w
            }
            wayUsed = victim
            evictedTag = set[victim]!.tag
          }
          set[wayUsed] = { tag, stamp: clock }
        }

        const log = outcome === 'hit'
          ? `0x${hex(address)} → tag=0x${hex(tag)} 组号=${setIndex} → 第 ${wayUsed} 路命中`
          : `0x${hex(address)} → tag=0x${hex(tag)} 组号=${setIndex} → 缺失，${
              evictedTag === null
                ? `填入空闲的第 ${wayUsed} 路`
                : `按 ${policy} 淘汰第 ${wayUsed} 路（原 tag=0x${hex(evictedTag)}）`
            }`

        return {
          state: {
            i, address, tag, setIndex, offset,
            outcome, wayUsed, evictedTag, hits, misses, log,
            sets, clock,
          },
          done: i === seq.length - 1,
        }
      },
    }
  },
}
