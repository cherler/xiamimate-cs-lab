/**
 * 内核：布隆过滤器（算法 · 原理：用一点点空间换"几乎不出错"的成员判断）
 * 轴：step —— 先往一个 bit 数组里插几个词(每个词点亮 k 个位)，再查若干词，看它怎么判"在/不在"
 *
 * 布隆过滤器：一个 m 位的 bit 数组 + k 个哈希函数。插入一个元素：算 k 个哈希、把对应的 k 个位全置 1。
 * 查询一个元素：算它的 k 个位——**只要有一位是 0，就一定不在**(因为插入时会把它们都置 1)；
 * **k 位全是 1，则"可能在"**——也可能是别的元素恰好把这几位都点亮了(**假阳性**)。
 * 所以布隆过滤器：**绝不漏报(no false negative)、但可能误报(false positive)**，用极小的空间换极快的判断。
 * 缓存前置(先问布隆再查慢存储)、爬虫去重、数据库防穿透，全靠它。假阳性率≈(1−e^(−kn/m))^k，位越多/元素越少越低。
 *
 * 本实验:m=24 位、k=3。先插 cat/dog/sun，再查一串词。你会看到 owl 明明没插过，却因为它的 3 个位
 * 恰好和 dog 撞在一起、全是 1，被判成"可能在"——一次真实的**假阳性**。值全部现算、可核对(位、命中判断、真伪)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const M = 24
const K = 3
const SEEDS = [0x9e37, 0x85eb, 0xc2b2]
const MEMBERS = ['cat', 'dog', 'sun']
const QUERIES = ['cat', 'fox', 'owl', 'sun']   // owl = 假阳性（撞 dog）

function h(str: string, seed: number): number {
  let x = seed >>> 0
  for (const c of str) x = (x * 31 + c.charCodeAt(0)) >>> 0
  return x % M
}
const posOf = (w: string) => SEEDS.map(s => h(w, s))

export type BloomState = {
  i: number
  step: number
  m: number
  k: number
  bits: number[]
  op: 'add' | 'query' | ''
  word: string
  idx: number[]              // 本次触碰的 k 个位
  verdict: '' | 'set' | '可能在' | '一定不在'
  truth: boolean             // 该词是否真的插过
  falsePositive: boolean
  members: string[]
  phase: 'insert' | 'query' | 'done'
  log: string
}

export const BLOOM_VISIBLE = [
  'step', 'm', 'k', 'bits', 'op', 'word', 'idx', 'verdict', 'truth', 'falsePositive', 'members', 'phase', 'log',
] as const

type Frame = Omit<BloomState, 'i'>

export const bloomKernel: Kernel<BloomState> = {
  kind: 'bloom',

  compile(_doc: SimDocument): CompiledModel<BloomState> {
    const frames: Frame[] = []
    const bits = new Array(M).fill(0)
    let step = 0

    // 插入阶段
    MEMBERS.forEach(w => {
      const idx = posOf(w)
      idx.forEach(i => { bits[i] = 1 })
      frames.push({
        step: step++, m: M, k: K, bits: bits.slice(), op: 'add', word: w, idx,
        verdict: 'set', truth: true, falsePositive: false, members: MEMBERS.slice(), phase: 'insert',
        log: `插入 **${w}**：哈希到 3 个位 [${idx.join(', ')}]，全部置 1。（插入=点亮 k 个位）`,
      })
    })

    // 查询阶段
    QUERIES.forEach(w => {
      const idx = posOf(w)
      const allSet = idx.every(i => bits[i] === 1)
      const truth = MEMBERS.includes(w)
      const fp = allSet && !truth
      frames.push({
        step: step++, m: M, k: K, bits: bits.slice(), op: 'query', word: w, idx,
        verdict: allSet ? '可能在' : '一定不在', truth, falsePositive: fp, members: MEMBERS.slice(), phase: 'query',
        log: `查询 **${w}**：看它的 3 个位 [${idx.join(', ')}] → ` +
          (allSet
            ? `全是 1 → **可能在**${fp ? `。但 ${w} 根本没插过——这三位恰好被别的词(dog)点亮了，是一次**假阳性**！` : `（确实插过 ✓）`}`
            : `有位是 0 → **一定不在**（没插过就至少有一位没被点亮，绝不漏报）。`),
      })
    })

    const fpWord = QUERIES.find(w => { const idx = posOf(w); return idx.every(i => bits[i] === 1) && !MEMBERS.includes(w) })
    frames.push({
      step, m: M, k: K, bits: bits.slice(), op: '', word: '', idx: [], verdict: '', truth: false, falsePositive: false,
      members: MEMBERS.slice(), phase: 'done',
      log: `插了 ${MEMBERS.length} 个词、查了 ${QUERIES.length} 个。规律:**有一位是 0 → 一定不在**(绝不漏报)；` +
        `**全是 1 → 可能在**——可能真在，也可能是撞位造成的**假阳性**(如 ${fpWord})。` +
        `这就是布隆过滤器:用 ${M} 个 bit 换"绝不漏报、极少误报"的极快判断，假阳性率≈(1−e^(−kn/m))^k。` +
        `缓存前置、爬虫去重、数据库防穿透都靠它。`,
    })

    const base0: Frame = {
      step: -1, m: M, k: K, bits: new Array(M).fill(0), op: '', word: '', idx: [], verdict: '',
      truth: false, falsePositive: false, members: MEMBERS.slice(), phase: 'insert', log: '',
    }

    return {
      axis: { kind: 'step', label: '第几步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
