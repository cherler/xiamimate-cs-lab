/**
 * 内核：页面置换（操作系统）
 * 轴：step（每次页面访问一步）
 *
 * 四种算法：FIFO / LRU / OPT / CLOCK。
 * OPT 需要"看未来" —— 内核拿到整条引用串，所以能前瞻。这是它作为理论下界的前提。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type Frame = {
  page: number
  /** FIFO 用装入时刻；LRU 用最近访问时刻 */
  stamp: number
  /** CLOCK 的使用位 */
  use: boolean
}

export type PageState = {
  // ── 可见部分
  i: number
  page: number
  outcome: 'hit' | 'fault'
  frameUsed: number
  evictedPage: number | null
  faults: number
  hits: number
  log: string
  frames: (Frame | null)[]
  /** CLOCK 指针位置；其他算法恒为 0 */
  hand: number
  // ── 重放所需
  clock: number
}

export const PAGE_VISIBLE = [
  'i', 'page', 'outcome', 'frameUsed', 'evictedPage', 'faults', 'hits', 'log', 'frames', 'hand',
] as const

export const pageKernel: Kernel<PageState> = {
  kind: 'page',

  compile(doc: SimDocument): CompiledModel<PageState> {
    const nFrames = num(doc.params, 'frames')
    const algo = str(doc.params, 'algorithm')
    const seq = (doc.streams.find(s => s.name === 'referenceString')?.values ?? []) as number[]

    return {
      axis: { kind: 'step', label: '访问序号' },

      initial: () => ({
        i: -1, page: 0, outcome: 'fault', frameUsed: 0, evictedPage: null,
        faults: 0, hits: 0, log: '',
        frames: Array(nFrames).fill(null),
        hand: 0, clock: 0,
      }),

      describe: s => s.log,

      step(prev) {
        const base = prev ?? this.initial()
        const i = base.i + 1
        if (i >= seq.length) return null

        const frames = base.frames.map(f => (f ? { ...f } : null))
        const clock = base.clock + 1
        const page = seq[i]
        let hand = base.hand
        let hits = base.hits
        let faults = base.faults

        const at = frames.findIndex(f => f !== null && f.page === page)
        let outcome: 'hit' | 'fault'
        let frameUsed: number
        let evictedPage: number | null = null
        let why = ''

        if (at >= 0) {
          outcome = 'hit'; hits++; frameUsed = at
          frames[at]!.use = true
          if (algo === 'LRU') frames[at]!.stamp = clock
        } else {
          outcome = 'fault'; faults++
          const free = frames.findIndex(f => f === null)
          if (free >= 0) {
            frameUsed = free
            why = `装入空闲的第 ${free} 块`
          } else {
            const v = pickVictim(algo, frames as Frame[], seq, i, hand)
            frameUsed = v.index
            hand = v.hand
            evictedPage = frames[frameUsed]!.page
            why = v.why
          }
          frames[frameUsed] = { page, stamp: clock, use: true }
        }

        const log = outcome === 'hit'
          ? `访问页 ${page} → 命中，在第 ${frameUsed} 块`
          : `访问页 ${page} → 缺页，${why}${evictedPage === null ? '' : `（换出页 ${evictedPage}）`}`

        return {
          state: { i, page, outcome, frameUsed, evictedPage, faults, hits, log, frames, hand, clock },
          done: i === seq.length - 1,
        }
      },
    }
  },
}

/** 选淘汰哪一块 —— 四种算法唯一的差别就在这个函数里 */
function pickVictim(
  algo: string, frames: Frame[], seq: number[], now: number, hand: number,
): { index: number; hand: number; why: string } {
  if (algo === 'OPT') {
    // 最优：淘汰"最久之后才会再用到"的那页。用不到的直接淘汰。
    let best = 0, bestNext = -1
    for (let k = 0; k < frames.length; k++) {
      const next = seq.indexOf(frames[k].page, now + 1)
      if (next === -1) return { index: k, hand, why: `按 OPT 淘汰第 ${k} 块（页 ${frames[k].page} 后续不再使用）` }
      if (next > bestNext) { bestNext = next; best = k }
    }
    return { index: best, hand, why: `按 OPT 淘汰第 ${best} 块（页 ${frames[best].page} 要到第 ${bestNext + 1} 次访问才用）` }
  }

  if (algo === 'CLOCK') {
    // 第二次机会：沿环扫描，use=1 的清零放过，遇到 use=0 的淘汰
    let h = hand
    for (let guard = 0; guard < frames.length * 2 + 1; guard++) {
      if (!frames[h].use) {
        const victim = h
        return {
          index: victim, hand: (victim + 1) % frames.length,
          why: `按 CLOCK 淘汰第 ${victim} 块（使用位为 0）`,
        }
      }
      frames[h].use = false
      h = (h + 1) % frames.length
    }
    return { index: hand, hand: (hand + 1) % frames.length, why: `按 CLOCK 淘汰第 ${hand} 块` }
  }

  // FIFO 与 LRU 都是"最小 stamp 淘汰"，区别只在命中时更不更新 stamp
  let v = 0
  for (let k = 1; k < frames.length; k++) if (frames[k].stamp < frames[v].stamp) v = k
  return { index: v, hand, why: `按 ${algo} 淘汰第 ${v} 块` }
}
