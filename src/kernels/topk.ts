/**
 * 内核：海量数据 Top-K · 哈希分片 + 小顶堆真仿真 —— 内存装不下全量计数，怎么求出现最多的 K 个（后端 · 系统设计）
 * 轴：step —— 原始流经哈希分片落到各片计数（同词必同片），再用大小 K 的小顶堆求 Top-K（堆顶=第 K 大，新词比堆顶大才替换）
 *
 * "10 亿条里求出现最多的 K 个"(热搜词/热门商品/高频 IP)难在**内存装不下全部计数**。两个真机制:
 *   · **哈希分片**:hash(词) % N 把数据切成 N 片。因为哈希确定,**同一个词一定落同一片** ——
 *     所以一个词的计数绝不会被拆到两片(否则求和就错),每片能独立统计。这是"分而治之"能成立的前提。
 *   · **大小 K 的小顶堆**:要 Top-K 不必全排序(O(n㏒n))。维护一个只装 K 个的小顶堆,堆顶是这 K 个里最小的
 *     (= 目前的第 K 大 = 门槛)。新词计数 ≤ 堆顶就直接扔(进不了前 K),> 堆顶就**淘汰堆顶、换上它**,O(㏒K)。
 * 本仿真真跑:原始流逐词哈希分片(看同词同片)、再把各词计数喂进小顶堆(看淘汰/门槛怎么变),最后堆里就是 Top-K。
 * 分片/计数/堆的淘汰全部真算,可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type WC = { word: string; count: number }
export type TopkState = {
  i: number
  step: number
  phase: 'intro' | 'shard' | 'heap' | 'done'
  op: 'intro' | 'route' | 'insert' | 'replace' | 'skip' | 'summary'
  K: number
  N: number                                     // 分片数
  shards: { id: number; items: WC[] }[]         // 各片的计数表（累积）
  route: { word: string; hash: number; shard: number; count: number } | null  // 本步路由的词
  heap: WC[]                                     // 小顶堆（数组，heap[0]=堆顶=最小）
  consider: WC | null                           // 本步在考察的（词,计数）
  evicted: WC | null                            // 本步被淘汰的堆顶
  threshold: number                             // 堆满时的堆顶计数（=第 K 大），未满 = -1
  topk: WC[]                                     // 最终 Top-K（降序）
  focus: string
  log: string
}
type Frame = Omit<TopkState, 'i'>

const K = 3
const N = 2
// 原始流（模拟海量数据的一小段）——真做流式聚合，counts 由它数出来
const STREAM = ['苹果', '香蕉', '苹果', '橙子', '苹果', '香蕉', '葡萄', '橙子', '苹果', '香蕉', '梨', '橙子', '苹果', '香蕉', '葡萄', '桃']
const hashWord = (w: string): number => [...w].reduce((a, c) => a + c.codePointAt(0)!, 0)   // 确定性哈希

// 小顶堆：数组表示，heap[0]=最小。为可读，插入/替换后重排（K 很小，成本无所谓；语义等价于 sift）
const heapReorder = (h: WC[]) => h.sort((a, b) => a.count - b.count)

export const topkKernel: Kernel<TopkState> = {
  kind: 'topk',
  compile(_doc: SimDocument): CompiledModel<TopkState> {
    const frames: Frame[] = []
    const snapShards = (s: { id: number; items: WC[] }[]) => s.map(x => ({ id: x.id, items: x.items.map(w => ({ ...w })) }))
    const snapHeap = (h: WC[]) => h.map(w => ({ ...w }))
    const push = (f: Omit<Frame, 'step' | 'K' | 'N'>) => frames.push({ step: frames.length, K, N, ...f })

    // —— 真流式聚合：数出每个词的总计数、记录首次出现顺序 ——
    const counts = new Map<string, number>()
    const order: string[] = []
    for (const w of STREAM) { if (!counts.has(w)) order.push(w); counts.set(w, (counts.get(w) ?? 0) + 1) }

    // —— 开场 ——
    push({
      phase: 'intro', op: 'intro', shards: [{ id: 0, items: [] }, { id: 1, items: [] }], route: null,
      heap: [], consider: null, evicted: null, threshold: -1, topk: [],
      focus: '内存装不下全量计数 → 哈希分片（同词同片）+ 大小 K 的小顶堆',
      log: `**海量 Top-K：两个真机制**\n"${STREAM.length} 条流里求出现最多的 K=${K} 个"，难在数据大到**内存装不下全部计数**。\n① **哈希分片**：\`hash(词) % ${N}\` 切成 ${N} 片，同一个词一定落同一片 → 计数不被拆、每片独立统计。\n② **小顶堆**：维护只装 ${K} 个的小顶堆，堆顶=第 K 大=门槛；新词 > 门槛才挤进来。\n先把原始流分片计数，再把计数喂进堆。`,
    })

    // —— 第一幕：哈希分片计数（按首次出现顺序，逐个"词"路由，展示同词同片 + 计数）——
    const shards: { id: number; items: WC[] }[] = [{ id: 0, items: [] }, { id: 1, items: [] }]
    order.forEach(word => {
      const h = hashWord(word)
      const sid = h % N
      const count = counts.get(word)!
      shards[sid]!.items.push({ word, count })
      push({
        phase: 'shard', op: 'route', shards: snapShards(shards), route: { word, hash: h, shard: sid, count },
        heap: [], consider: null, evicted: null, threshold: -1, topk: [],
        focus: `词「${word}」hash%${N}=${sid} → 落 shard${sid}（计数 ${count}）`,
        log: `**分片：「${word}」→ shard${sid}**\n\`hash("${word}")=${h}，% ${N} = ${sid}\` → 落 **shard${sid}**，该词共出现 **${count}** 次。\n关键：哈希是确定的，所以「${word}」的每一次出现都算到 **同一片**，计数不会被拆开求和才不出错。（若用轮询/随机分片，同一个词散到两片、各数一半，全局计数就错了。）`,
      })
    })

    // —— 第二幕：小顶堆求 Top-K（把各词计数喂进堆，看门槛与淘汰）——
    // 喂入顺序：按分片顺序合并（先 shard0 再 shard1 的词），制造"大词晚到→触发淘汰"的真实情况
    const feed: WC[] = [...shards[0]!.items, ...shards[1]!.items]
    const heap: WC[] = []
    feed.forEach(wc => {
      let op: TopkState['op'], evicted: WC | null = null, focus: string, log: string
      if (heap.length < K) {
        heap.push({ ...wc }); heapReorder(heap)
        op = 'insert'; focus = `堆未满(${heap.length}/${K}) → 直接放入「${wc.word}」(${wc.count})`
        log = `**入堆：「${wc.word}」计数 ${wc.count}**\n堆还没满（${heap.length}/${K}）→ 直接放入。当前堆顶（最小）= **${heap[0]!.count}**（「${heap[0]!.word}」）。堆里现在是：${heap.map(x => `${x.word}${x.count}`).join('、')}。`
      } else if (wc.count > heap[0]!.count) {
        evicted = { ...heap[0]! }
        heap[0] = { ...wc }; heapReorder(heap)
        op = 'replace'; focus = `${wc.count} > 门槛 ${evicted.count} → 淘汰「${evicted.word}」换上「${wc.word}」`
        log = `**替换：「${wc.word}」${wc.count} > 门槛 ${evicted.count}**\n堆已满，新词计数 **${wc.count}** > 堆顶门槛 **${evicted.count}** → **淘汰堆顶「${evicted.word}」(${evicted.count})**、换上「${wc.word}」，O(㏒K) 下沉。新门槛 = **${heap[0]!.count}**。堆里：${heap.map(x => `${x.word}${x.count}`).join('、')}。`
      } else {
        op = 'skip'; focus = `${wc.count} ≤ 门槛 ${heap[0]!.count} → 「${wc.word}」进不了前 ${K}，扔`
        log = `**跳过：「${wc.word}」${wc.count} ≤ 门槛 ${heap[0]!.count}**\n计数不超过堆顶门槛 → 它连当前第 ${K} 名都挤不掉，**直接扔**、堆不动。这就是小顶堆省事的地方：绝大多数元素一比就扔，不用排序。`
      }
      const threshold = heap.length >= K ? heap[0]!.count : -1
      push({
        phase: 'heap', op, shards: snapShards(shards), route: null, heap: snapHeap(heap),
        consider: { ...wc }, evicted, threshold, topk: [], focus, log,
      })
    })

    // —— 收尾：堆里就是 Top-K ——
    const topk = [...heap].sort((a, b) => b.count - a.count)
    push({
      phase: 'done', op: 'summary', shards: snapShards(shards), route: null, heap: snapHeap(heap),
      consider: null, evicted: null, threshold: heap[0]!.count, topk,
      focus: `Top-${K} = ${topk.map(x => `${x.word}(${x.count})`).join('、')}`,
      log: `**Top-${K} 求出**：${topk.map(x => `${x.word}=${x.count}`).join('、')}（门槛/第 ${K} 大 = ${heap[0]!.count}）。\n\n**两个机制回顾**：① **哈希分片**让上亿 key 的计数装进内存——同词同片、各片独立数，本质是 MapReduce 的 map；② **大小 K 小顶堆**让"取前 K"不必全排序：O(n㏒K) 远小于 O(n㏒n)，且只需 K 个的内存。分片各自求局部 Top-K、再归并成全局 Top-K（本例为看清算法把计数合并后走一个堆）。面试延伸：为什么小顶堆而不是大顶堆（要淘汰最小、堆顶就该是最小）、精确 vs 近似（数据再大用 Count-Min Sketch 概率计数省内存）、分片数 N 怎么定（每片能进内存）、热点 key 倾斜怎么办（二次分片/加盐）。`,
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, K, N, shards: [{ id: 0, items: [] }, { id: 1, items: [] }], route: null, heap: [], consider: null, evicted: null, threshold: -1, topk: [], focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'Top-K 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
