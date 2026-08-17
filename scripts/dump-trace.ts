/** 把真实轨迹导成 JSON，供前端草稿/离线渲染使用 */
import { run } from '../src/core/kernel.ts'
import { cacheKernel } from '../src/kernels/cache.ts'
import type { SimDocument } from '../src/core/document.ts'

const doc: SimDocument = {
  kind: 'cache',
  params: { addressBits: 32, cacheSizeBytes: 256, blockSizeBytes: 16, associativity: 2, replacement: 'LRU' },
  entities: [],
  streams: [{ name: 'accessSequence', values:
    [0x000, 0x010, 0x020, 0x000, 0x110, 0x210, 0x010, 0x020, 0x110, 0x000, 0x030, 0x210] }],
}

const trace = run(cacheKernel.compile(doc)).map(s => ({
  i: s.i, address: s.address, tag: s.tag, setIndex: s.setIndex, offset: s.offset,
  outcome: s.outcome, wayUsed: s.wayUsed, evictedTag: s.evictedTag,
  hits: s.hits, misses: s.misses, log: s.log,
  sets: s.sets.map(set => set.map(e => (e ? { tag: e.tag, stamp: e.stamp } : null))),
}))

console.log(JSON.stringify({ doc, trace }))
