/**
 * 内核：手写 LFU 缓存 —— 按"使用频率"淘汰，频率相同再看"最久未用"（算法 · 项目实战 / 求职）
 * 轴：step —— 容量 2 的缓存跑一串 put/get，看频率怎么涨、满了淘汰谁
 *
 * LFU(Least Frequently Used)是 LRU 的进阶版、面试常问的 follow-up(LeetCode 460)。淘汰规则不同:
 *   · LRU 淘汰"最久没用的"(只看时间);
 *   · LFU 淘汰"用得最少的"(看**访问频率**);**频率相同时**再按"最久没用"(LRU)打破平手。
 * get/put 都要 O(1):经典实现用"频率桶 + 每桶一个双向链表"(freq→该频率的 key 链表),
 *   再维护最小频率 minFreq,淘汰时从 minFreq 桶的尾部摘。
 * 本例 capacity=2,跑 LeetCode 460 序列:put(3)淘汰频率最低的 2、put(4)在两个同频里淘汰最久未用的 1。
 * 值:每步的频率、淘汰谁都可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Entry = { k: number; v: number; freq: number; time: number }
export type LFUState = {
  i: number
  step: number
  op: 'intro' | 'put' | 'get'
  opDesc: string
  entries: { k: number; v: number; freq: number }[]  // 当前缓存（按 key）
  result: number           // get 返回（-2 非 get）
  hit: boolean
  evicted: number | null
  evictReason: string      // '最低频' | '同频·最久未用'
  bumped: number | null    // 本步频率 +1 的 key
  capacity: number
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<LFUState, 'i'>

type Op = { t: 'put'; k: number; v: number } | { t: 'get'; k: number }
const OPS: Op[] = [
  { t: 'put', k: 1, v: 1 }, { t: 'put', k: 2, v: 2 }, { t: 'get', k: 1 },
  { t: 'put', k: 3, v: 3 }, { t: 'get', k: 2 }, { t: 'get', k: 3 },
  { t: 'put', k: 4, v: 4 }, { t: 'get', k: 1 }, { t: 'get', k: 3 }, { t: 'get', k: 4 },
]
const CAP = 2

export const lfucacheKernel: Kernel<LFUState> = {
  kind: 'lfucache',
  compile(_doc: SimDocument): CompiledModel<LFUState> {
    const m = new Map<number, Entry>()
    let clock = 0
    const frames: Frame[] = []
    const snapshot = () => [...m.values()].sort((a, b) => a.k - b.k).map(e => ({ k: e.k, v: e.v, freq: e.freq }))
    const push = (f: Omit<Frame, 'step' | 'entries' | 'capacity'>) => frames.push({ step: frames.length, entries: snapshot(), capacity: CAP, ...f })

    // 挑淘汰对象：最低频；同频里 time 最小（最久没用）
    const pickEvict = () => { let best: Entry | null = null; for (const e of m.values()) { if (!best || e.freq < best.freq || (e.freq === best.freq && e.time < best.time)) best = e } return best! }

    push({ op: 'intro', opDesc: '', result: -2, hit: false, evicted: null, evictReason: '', bumped: null, phase: 'run', focus: '按频率淘汰，频率相同再按最久未用（LRU 打平手）',
      log: `**手写 LFU 缓存（容量 ${CAP}）**\n和 LRU 的区别在**淘汰规则**：\n· LRU 淘汰"最久没用的"（只看时间）；\n· **LFU 淘汰"用得最少的"（看访问频率）**，频率相同时再按"最久没用"打破平手。\n每次 get/put 命中都让该 key 频率 +1。看一串操作怎么走。` })

    OPS.forEach((op, idx) => {
      const last = idx === OPS.length - 1
      if (op.t === 'put') {
        let evicted: number | null = null, reason = '', hit = false
        if (m.has(op.k)) { const e = m.get(op.k)!; e.v = op.v; e.freq++; e.time = ++clock; hit = true }
        else {
          if (m.size >= CAP) {
            const victim = pickEvict()
            // 判断淘汰原因：是否有同 freq 的其它项
            const sameMin = [...m.values()].filter(e => e.freq === victim.freq)
            reason = sameMin.length > 1 ? '同频·最久未用' : '最低频'
            evicted = victim.k; m.delete(victim.k)
          }
          m.set(op.k, { k: op.k, v: op.v, freq: 1, time: ++clock })
        }
        push({ op: 'put', opDesc: `put(${op.k},${op.v})`, result: -2, hit, evicted, evictReason: reason, bumped: op.k, phase: last ? 'done' : 'run',
          focus: `put(${op.k},${op.v})：${hit ? '已存在→更新、频率+1' : evicted !== null ? `满了→淘汰 ${evicted}(${reason})，新 key 频率=1` : '插入，频率=1'}`,
          log: `**put(${op.k},${op.v})**\n${hit ? `key ${op.k} 已存在 → 更新值、频率 +1。` : evicted !== null ? `缓存满 → 淘汰 **${evicted}**（${reason === '最低频' ? '它频率最低' : '和别人同频但最久没用'}），新 key ${op.k} 频率=1。` : `新 key，频率=1。`}\n当前：${snapshot().map(e => `${e.k}:${e.v}(f${e.freq})`).join('  ')}` })
      } else {
        const hit = m.has(op.k)
        let result = -1, bumped: number | null = null
        if (hit) { const e = m.get(op.k)!; e.freq++; e.time = ++clock; result = e.v; bumped = op.k }
        push({ op: 'get', opDesc: `get(${op.k})`, result, hit, evicted: null, evictReason: '', bumped, phase: last ? 'done' : 'run',
          focus: `get(${op.k})：${hit ? `命中→返回 ${result}，频率+1` : '未命中→-1'}`,
          log: `**get(${op.k})**\n${hit ? `命中！返回 **${result}**，${op.k} 的**频率 +1**（用得越多越不容易被淘汰）。` : `key ${op.k} 不在缓存 → 返回 **-1**。`}\n当前：${snapshot().map(e => `${e.k}:${e.v}(f${e.freq})`).join('  ')}` })
      }
    })

    const last = frames[frames.length - 1]!
    last.log += `\n\n**小结**：LFU 按**频率**淘汰、同频再按最久未用。O(1) 实现 = 频率桶(freq→双向链表) + minFreq。面试讲这个项目：和 LRU 的区别(频率 vs 时间)、为什么要 minFreq(O(1) 找到要淘汰的桶)、同频怎么打破平手(桶内维护 LRU 顺序)、LFU 的缺点(老热点频率高、赖着不走——真实系统常用带衰减的近似 LFU，如 Redis 的 LFU 淘汰)。`

    const base0: Frame = { op: 'intro', step: -1, opDesc: '', entries: [], result: -2, hit: false, evicted: null, evictReason: '', bumped: null, capacity: CAP, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '操作步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
