/**
 * 预置串的「说法」必须为真。
 *
 * 每个预置按钮下面挂着一句 note，说的都是关于行为的主张：
 *   "FIFO 在这串上会出现 Belady 异常"、"SSTF 下远端请求最后才被服务"……
 * 这些是**能被证伪的断言**，不是宣传语。凭记忆写就等于假数据。
 *
 * 这套测试逐条验它们。验不过的，要么改串，要么改说法 —— 不许留着。
 */
import { run } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'
import { cacheKernel, type CacheState } from '../src/kernels/cache.ts'
import { pageKernel, type PageState } from '../src/kernels/page.ts'
import { diskKernel, type DiskState } from '../src/kernels/disk.ts'
import { sortKernel, type SortState } from '../src/kernels/sort.ts'
import {
  CACHE_PRESETS, PAGE_PRESETS, DISK_PRESETS, SORT_PRESETS, type Preset,
} from '../src/presets/sequences.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }
const pick = (list: Preset[], label: string) => {
  const p = list.find(x => x.label === label)
  if (!p) throw new Error(`预置「${label}」不存在 —— 改名了就要同步改测试`)
  return p
}

// ═══ Cache ═════════════════════════════════════════════
console.log('\n【Cache 访问序列】')

const cacheRun = (values: number[], over: Record<string, number | string> = {}) => {
  const doc: SimDocument = {
    kind: 'cache',
    params: {
      addressBits: 32, cacheSizeBytes: 256, blockSizeBytes: 16,
      associativity: 2, replacement: 'LRU', ...over,
    },
    entities: [],
    streams: [{ name: 'accessSequence', values }],
  }
  const t = run(cacheKernel.compile(doc)) as CacheState[]
  const last = t.at(-1)!
  return { hits: last.hits, n: t.length, rate: last.hits / t.length }
}
const pctf = (r: number) => (r * 100).toFixed(0) + '%'

// 「顺序访问 → 空间局部性：块越大命中率越高」
//  原来写的是"命中率最高"，实测被"局部性好"压过（75% vs 80%）——
//  它演示的本来就是**空间**局部性，不是绝对最高。说法和判据一起改。
{
  const v = pick(CACHE_PRESETS, '顺序访问').values
  const b16 = cacheRun(v, { blockSizeBytes: 16 }).rate
  const b32 = cacheRun(v, { blockSizeBytes: 32 }).rate
  b32 > b16
    ? ok(`顺序访问：块 16B ${pctf(b16)} → 32B ${pctf(b32)}，块越大命中率越高 —— 空间局部性成立`)
    : bad(`加大块没提升命中率：16B ${pctf(b16)}，32B ${pctf(b32)}`)

  // 对照：同组冲突串是"组内装不下"，加大块救不了它
  const c = pick(CACHE_PRESETS, '同组冲突').values
  const c16 = cacheRun(c, { blockSizeBytes: 16 }).rate
  const c32 = cacheRun(c, { blockSizeBytes: 32 }).rate
  c32 <= c16 + 0.001
    ? ok(`对照：同组冲突串加大块仍是 ${pctf(c32)} —— 说明上面那条真的在验空间局部性，不是"块大就都好"`)
    : bad(`冲突串也被加大块救了：${pctf(c16)} → ${pctf(c32)}，判据不专一`)
}

// 「同组冲突 → 提高相联度就能救」
{
  const v = pick(CACHE_PRESETS, '同组冲突').values
  const w2 = cacheRun(v, { associativity: 2 }).rate
  const w4 = cacheRun(v, { associativity: 4 }).rate
  w4 > w2
    ? ok(`同组冲突：2 路 ${pctf(w2)} → 4 路 ${pctf(w4)}，提高相联度确实能救`)
    : bad(`提高相联度没用：2 路 ${pctf(w2)}，4 路 ${pctf(w4)}`)
}

// 「容量不足 → 加大容量能救，加大相联度救不了」
{
  const v = pick(CACHE_PRESETS, '容量不足').values
  const base = cacheRun(v).rate
  const bigger = cacheRun(v, { cacheSizeBytes: 1024 }).rate
  const wider = cacheRun(v, { associativity: 8 }).rate      // 容量不变，只加相联度
  bigger > base
    ? ok(`容量不足：256B ${pctf(base)} → 1024B ${pctf(bigger)}，加大容量能救`)
    : bad(`加大容量没救回来：${pctf(base)} → ${pctf(bigger)}`)
  wider <= base + 0.001
    ? ok(`容量不足：容量不变只把相联度提到 8 路仍是 ${pctf(wider)} —— 相联度救不了容量失效`)
    : bad(`相联度居然救回来了：${pctf(base)} → ${pctf(wider)}，说法站不住`)
}

// 「局部性好 → 这才是 Cache 起作用的前提」：命中率要明显高于容量不足串
{
  const good = cacheRun(pick(CACHE_PRESETS, '局部性好').values).rate
  const thrash = cacheRun(pick(CACHE_PRESETS, '容量不足').values).rate
  good > thrash
    ? ok(`局部性好 ${pctf(good)} 明显高于容量不足 ${pctf(thrash)}`)
    : bad(`局部性好没体现出来：${pctf(good)} vs ${pctf(thrash)}`)
}

// ═══ 页面置换 ══════════════════════════════════════════
console.log('\n【页面引用串】')

const pageRun = (values: number[], algorithm: string, frames: number) => {
  const doc: SimDocument = {
    kind: 'page', params: { algorithm, frames }, entities: [],
    streams: [{ name: 'referenceString', values }],
  }
  const t = run(pageKernel.compile(doc)) as PageState[]
  return { faults: t.at(-1)!.faults, hits: t.at(-1)!.hits, n: t.length }
}

// 「Belady 经典串 → 3 块增到 4 块，缺页反而更多」
{
  const v = pick(PAGE_PRESETS, 'Belady 经典串').values
  const f3 = pageRun(v, 'FIFO', 3).faults
  const f4 = pageRun(v, 'FIFO', 4).faults
  f4 > f3
    ? ok(`Belady：FIFO 3 块 ${f3} 次缺页 → 4 块 ${f4} 次，块变多反而更差`)
    : bad(`Belady 异常没出现：3 块 ${f3}，4 块 ${f4}`)
}

// 「抖动 → FIFO 与 LRU 全部缺页，一次都不命中」
{
  const v = pick(PAGE_PRESETS, '抖动').values
  const bads: string[] = []
  for (const algo of ['FIFO', 'LRU']) {
    const r = pageRun(v, algo, 3)
    if (r.hits !== 0 || r.faults !== v.length) bads.push(`${algo} 命中 ${r.hits} 缺页 ${r.faults}/${v.length}`)
  }
  bads.length === 0
    ? ok(`抖动：3 块下 FIFO / LRU 各 ${v.length} 次访问全部缺页，命中 0 次`)
    : bad(`抖动串没抖起来：${bads.join('，')}`)
}

// 「局部性好 → 缺页率明显低于抖动串」
{
  const good = pageRun(pick(PAGE_PRESETS, '局部性好').values, 'LRU', 3)
  const thrash = pageRun(pick(PAGE_PRESETS, '抖动').values, 'LRU', 3)
  const gr = good.faults / good.n, tr = thrash.faults / thrash.n
  gr < tr
    ? ok(`局部性好：LRU 缺页率 ${pctf(gr)} 低于抖动串的 ${pctf(tr)}`)
    : bad(`局部性没体现：${pctf(gr)} vs ${pctf(tr)}`)
}

// 「OPT 优势明显 → OPT 缺页严格少于 LRU 和 FIFO」
{
  const v = pick(PAGE_PRESETS, 'OPT 优势明显').values
  const o = pageRun(v, 'OPT', 3).faults
  const l = pageRun(v, 'LRU', 3).faults
  const f = pageRun(v, 'FIFO', 3).faults
  o < l && o < f
    ? ok(`OPT 优势：OPT ${o} 次 < LRU ${l} 次、FIFO ${f} 次`)
    : bad(`OPT 没显出优势：OPT ${o} / LRU ${l} / FIFO ${f}`)
}

// ═══ 磁盘调度 ══════════════════════════════════════════
console.log('\n【磁盘请求队列】')

const diskRun = (values: number[], algorithm: string) => {
  const doc: SimDocument = {
    kind: 'disk',
    params: { algorithm, headStart: 53, maxTrack: 199, direction: 1 },
    entities: [], streams: [{ name: 'requests', values }],
  }
  const t = run(diskKernel.compile(doc)) as DiskState[]
  return { total: t.at(-1)!.total, order: t.map(s => s.served) }
}

// 「两端来回 → FCFS 总寻道远大于 SSTF」
{
  const v = pick(DISK_PRESETS, '两端来回').values
  const f = diskRun(v, 'FCFS').total
  const s = diskRun(v, 'SSTF').total
  f > s * 1.5
    ? ok(`两端来回：FCFS ${f} 个磁道，SSTF ${s} 个 —— FCFS 是它的 ${(f / s).toFixed(1)} 倍`)
    : bad(`差距没拉开：FCFS ${f} vs SSTF ${s}`)
}

// 「SCAN 的空跑 → SCAN 要走到边界 199 才折返，LOOK 到最远请求就回头」
//  原来那串请求全在磁头一侧，SCAN 服务完就没事了，根本不用走到边界 → SCAN==LOOK。
//  判据是对的，数据是错的。现在另一侧留了一个请求逼它折返。
{
  const v = pick(DISK_PRESETS, 'SCAN 的空跑').values
  const scan = diskRun(v, 'SCAN').total
  const look = diskRun(v, 'LOOK').total
  const far = Math.max(...v)
  const waste = 2 * (199 - far)   // 独立算：白跑的就是"边界到最远请求"的来回
  scan - look === waste
    ? ok(`SCAN ${scan} − LOOK ${look} = ${scan - look}，正好等于 2×(199−${far}) = ${waste} 的空跑`)
    : bad(`空跑对不上：SCAN ${scan} LOOK ${look} 差 ${scan - look}，独立算应为 ${waste}`)
}

// 「SSTF 饥饿 → 远端那个是最后一个被服务的」
{
  const p = pick(DISK_PRESETS, 'SSTF 饥饿')
  const far = Math.max(...p.values)
  const order = diskRun(p.values, 'SSTF').order
  const at = order.indexOf(far)
  at === order.length - 1
    ? ok(`SSTF 饥饿：远端磁道 ${far} 排在第 ${at + 1} 位（共 ${order.length} 个），确实被推到最后`)
    : bad(`远端请求没被饿到最后：磁道 ${far} 排在第 ${at + 1} 位`)
}

// 「均匀分布 → 各算法差距最容易比出来」：至少三种算法结果两两不同
{
  const v = pick(DISK_PRESETS, '均匀分布').values
  const totals = ['FCFS', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK']
    .map(a => ({ a, t: diskRun(v, a).total }))
  const distinct = new Set(totals.map(x => x.t)).size
  distinct >= 3
    ? ok(`均匀分布：五种算法跑出 ${distinct} 种不同总寻道（${totals.map(x => `${x.a} ${x.t}`).join('、')}）`)
    : bad(`算法之间分不开：只有 ${distinct} 种结果`)
}

// ═══ 排序 ══════════════════════════════════════════════
console.log('\n【待排序数组】')

const sortRun = (values: number[], algorithm: string) => {
  const doc: SimDocument = {
    kind: 'sort', params: { algorithm }, entities: [],
    streams: [{ name: 'array', values }],
  }
  const t = run(sortKernel.compile(doc)) as SortState[]
  const last = t.at(-1)!
  return { comparisons: last.comparisons, moves: last.moves, passes: t.filter(s => s.passEnd).length }
}

// 「教材经典 → 带两个 49」
{
  const v = pick(SORT_PRESETS, '教材经典').values
  const dup = v.length !== new Set(v).size
  dup && v.filter(x => x === 49).length === 2
    ? ok(`教材经典：确实有两个 49（${v.join(' ')}）`)
    : bad(`没有重复的 49：${v.join(' ')}`)
}

// 「已经有序 → 插入排序比较次数最少；快排划分次数最多」
{
  const sorted = pick(SORT_PRESETS, '已经有序').values
  const cmpOf = (p: Preset) => sortRun(p.values, '直接插入').comparisons
  const mine = cmpOf(pick(SORT_PRESETS, '已经有序'))
  const worse = SORT_PRESETS.filter(p => p.label !== '已经有序').filter(p => cmpOf(p) <= mine)
  worse.length === 0
    ? ok(`已经有序：直接插入比较 ${mine} 次，少于其余三串（${SORT_PRESETS
        .filter(p => p.label !== '已经有序').map(p => `${p.label} ${cmpOf(p)}`).join('、')}）`)
    : bad(`插入排序不是最省：${worse.map(p => `${p.label} ${cmpOf(p)}`).join('、')}`)

  //  快排在"已经有序"上退化 —— 但它跟"完全逆序"是**并列**最坏，不是独占。
  //  原来写成"划分次数最多"，实测两者都是 7 次，说法站不住。
  const passOf = (p: Preset) => sortRun(p.values, '快速').passes
  const mp = sortRun(sorted, '快速').passes
  const maxPass = Math.max(...SORT_PRESETS.map(passOf))
  const beatsTypical = mp > passOf(pick(SORT_PRESETS, '教材经典'))
  const degenerate = mp === sorted.length - 1     // 每次划分只切掉一个元素 = 完全退化
  mp === maxPass && beatsTypical && degenerate
    ? ok(`已经有序：快排划分 ${mp} 次 = n−1，完全退化（与完全逆序 ${passOf(pick(SORT_PRESETS, '完全逆序'))} 次并列最坏，教材经典只要 ${passOf(pick(SORT_PRESETS, '教材经典'))} 次）`)
    : bad(`快排退化说法不成立：本串 ${mp}，最大 ${maxPass}，n−1=${sorted.length - 1}`)
}

// 「完全逆序 → 插入排序移动次数比其余任何一串都多」
{
  const movOf = (p: Preset) => sortRun(p.values, '直接插入').moves
  const mine = movOf(pick(SORT_PRESETS, '完全逆序'))
  const more = SORT_PRESETS.filter(p => p.label !== '完全逆序').filter(p => movOf(p) >= mine)
  more.length === 0
    ? ok(`完全逆序：直接插入移动 ${mine} 次，多于其余三串（${SORT_PRESETS
        .filter(p => p.label !== '完全逆序').map(p => `${p.label} ${movOf(p)}`).join('、')}）`)
    : bad(`不是最坏情况：${more.map(p => `${p.label} ${movOf(p)}`).join('、')} ≥ ${mine}`)
}

// 「大量重复 → 只有三种取值」
{
  const v = pick(SORT_PRESETS, '大量重复').values
  const kinds = new Set(v).size
  kinds === 3
    ? ok(`大量重复：${v.length} 个元素只有 ${kinds} 种取值（${[...new Set(v)].sort().join('/')}）`)
    : bad(`取值种类不是 3 种，而是 ${kinds} 种：${v.join(' ')}`)
}

// ═══ 自检：这套判据得会红 ══════════════════════════════
console.log('\n【自检】')
{
  // 拿一串明摆着不满足"顺序访问"的数据去跑同一条判据，必须判负
  const fake = cacheRun([0x000, 0x100, 0x200, 0x000, 0x100, 0x200]).rate
  const real = cacheRun(pick(CACHE_PRESETS, '顺序访问').values).rate
  fake < real
    ? ok(`把顺序串换成冲突串，命中率 ${pctf(real)} → ${pctf(fake)} —— 判据认得出差别`)
    : bad(`换成冲突串命中率没降，说明这条判据没鉴别力`)
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
