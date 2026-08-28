/**
 * 内核：手写 LRU 缓存 —— HashMap + 双向链表，get/put 都 O(1)（算法 · 项目实战 / 求职）
 * 轴：step —— 容量 2 的缓存跑一串 put/get，看链表怎么按"最近使用"排序、满了怎么淘汰
 *
 * LRU(最近最少使用)是面试最高频的手写题(LeetCode 146)。要求 get/put 都 **O(1)**。
 * 招式：**HashMap**(key→节点，O(1) 定位) + **双向链表**(维护使用顺序，头=最近、尾=最久)。
 *   · get(k)：命中就把节点**移到头部**(它刚被用)，返回值；未命中返回 -1。
 *   · put(k,v)：已存在则更新+移到头；不存在则插到头，若**超容量**就淘汰**尾部**(最久没用的)。
 * 两个结构配合：HashMap 负责"找得快"，双向链表负责"知道谁最久没用、能 O(1) 摘除"。
 * 本例 capacity=2，跑 LeetCode 146 的经典序列。值:每步链表顺序/淘汰/返回值可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Node = { k: number; v: number }
export type LRUState = {
  i: number
  step: number
  op: 'intro' | 'put' | 'get'
  opDesc: string
  list: Node[]             // 头在前（最近使用），尾在后（最久未用）
  result: number           // get 的返回值（-2 表示非 get / 无返回）
  hit: boolean             // 本次 get/put 是否命中已有 key
  evicted: number | null   // 本步淘汰的 key
  moved: number | null     // 本步被移到头部的 key
  capacity: number
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<LRUState, 'i'>

type Op = { t: 'put'; k: number; v: number } | { t: 'get'; k: number }
const OPS: Op[] = [
  { t: 'put', k: 1, v: 1 }, { t: 'put', k: 2, v: 2 }, { t: 'get', k: 1 },
  { t: 'put', k: 3, v: 3 }, { t: 'get', k: 2 }, { t: 'put', k: 4, v: 4 },
  { t: 'get', k: 1 }, { t: 'get', k: 3 }, { t: 'get', k: 4 },
]
const CAP = 2

export const lrucacheKernel: Kernel<LRUState> = {
  kind: 'lrucache',
  compile(_doc: SimDocument): CompiledModel<LRUState> {
    let list: Node[] = []
    const find = (k: number) => list.findIndex(n => n.k === k)
    const show = () => list.map(n => `${n.k}:${n.v}`).join(' → ')
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'capacity' | 'list'>) => frames.push({ step: frames.length, capacity: CAP, list: list.map(n => ({ ...n })), ...f })

    push({ op: 'intro', opDesc: '', result: -2, hit: false, evicted: null, moved: null, phase: 'run', focus: 'HashMap 找得快 + 双向链表管顺序，get/put 都 O(1)',
      log: `**手写 LRU 缓存（容量 ${CAP}）**\n要 get/put 都 **O(1)**：\n· **HashMap** key→节点，O(1) 定位；\n· **双向链表**维护使用顺序：**头=最近用、尾=最久没用**。\nget 命中就把节点移到头；put 满了就淘汰尾。看一串操作怎么走。` })

    OPS.forEach((op, idx) => {
      const last = idx === OPS.length - 1
      if (op.t === 'put') {
        const i = find(op.k)
        let evicted: number | null = null, hit = false
        if (i >= 0) { hit = true; list.splice(i, 1) }
        else if (list.length >= CAP) { evicted = list[list.length - 1]!.k; list.pop() }
        list.unshift({ k: op.k, v: op.v })
        push({ op: 'put', opDesc: `put(${op.k},${op.v})`, result: -2, hit, evicted, moved: op.k, phase: last ? 'done' : 'run',
          focus: `put(${op.k},${op.v})：${hit ? '已存在→更新并移到头' : evicted !== null ? `满了→淘汰尾部 ${evicted}，新节点插到头` : '插到头部'}`,
          log: `**put(${op.k},${op.v})**\n${hit ? `key ${op.k} 已存在 → 更新值、移到头部。` : list.length > CAP || evicted !== null ? `缓存已满(${CAP}) → **淘汰尾部 ${evicted}**(最久没用的)，新节点 ${op.k}:${op.v} 插到头部。` : `新节点插到头部。`}\n链表：[${show()}]（头=最近）` })
      } else {
        const i = find(op.k)
        const hit = i >= 0
        let result = -1, moved: number | null = null
        if (hit) { const n = list[i]!; result = n.v; list.splice(i, 1); list.unshift(n); moved = op.k }
        push({ op: 'get', opDesc: `get(${op.k})`, result, hit, evicted: null, moved, phase: last ? 'done' : 'run',
          focus: `get(${op.k})：${hit ? `命中→返回 ${result}，移到头部` : '未命中→返回 -1'}`,
          log: `**get(${op.k})**\n${hit ? `命中！返回 **${result}**，并把 ${op.k} **移到头部**（它刚被用，成了最近的）。` : `key ${op.k} 不在缓存（已被淘汰）→ 返回 **-1**。`}\n链表：[${show()}]` })
      }
    })

    const last = frames[frames.length - 1]!
    last.log += `\n\n**小结**：HashMap 给 O(1) 定位、双向链表给 O(1) 摘除和头插，两者配合让 get/put 都 O(1)。淘汰永远从尾部（最久没用）。这是 Redis 近似 LRU、各种本地缓存、MySQL 缓冲池(改进版)的基础。面试讲这个项目：为什么要双向链表(单链表删节点找不到前驱)、为什么要 HashMap(不然定位是 O(n))、怎么处理容量满——一套下来就是"我实现过 O(1) 的 LRU"。`

    const base0: Frame = { op: 'intro', step: -1, opDesc: '', list: [], result: -2, hit: false, evicted: null, moved: null, capacity: CAP, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '操作步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
