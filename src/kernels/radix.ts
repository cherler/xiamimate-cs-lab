/**
 * 内核：前缀缓存 / Radix Cache（大模型推理栈）
 * 轴：step —— 逐个 token 走前缀树：命中就复用 KV，未命中就计算并挂进树
 *
 * 推理服务里，很多请求共享同一段前缀（同一个 system prompt、同一段few-shot）。
 * 前缀那段的 KV cache 可以**跨请求复用**，不必重算 —— 省掉的正是 prefill。
 * 一棵 radix（前缀）树存着已缓存的 token 路径：
 *   新请求逐 token 往下走，能匹配的前缀直接复用（命中），
 *   走到树上没有的 token 就开始"计算并延长树"（未命中）。
 *   缓存的 token 总数超预算时，LRU 淘汰最久没用的叶子。
 *
 * 值全部靠逻辑/公式现算：省下的 prefill 比例 = 命中 token 数 / 请求 token 数。
 * 状态可 JSON 往返（验收标准 2）：树用扁平数组 + 下标，不用引用。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type RadixNode = {
  token: string
  parent: number
  depth: number
  /** 最近一次被命中/建立的时刻 —— LRU 用 */
  lru: number
  /** 是否是某个请求的终点 */
  terminal: boolean
}

export type RadixState = {
  i: number
  /** 请求编号（从 1 数），0 表示还没开始 */
  req: number
  reqTokens: string[]
  /** 本请求已处理到第几个 token（下标） */
  pos: number
  nodes: RadixNode[]
  /** 本步高亮的结点 */
  focus: number
  /** 本请求已命中 / 已计算的 token 数 */
  hit: number
  compute: number
  /** 缓存里的 token 总数（= 结点数）与预算 */
  cached: number
  budget: number
  /** 累计省下的 prefill token 数、累计请求 token 数 */
  savedTotal: number
  seenTotal: number
  act: 'match' | 'compute' | 'evict' | 'reqdone' | 'done'
  log: string
}

export const RADIX_VISIBLE = [
  'i', 'req', 'reqTokens', 'pos', 'nodes', 'focus', 'hit', 'compute',
  'cached', 'budget', 'savedTotal', 'seenTotal', 'act', 'log',
] as const

type Frame = Omit<RadixState, 'i'>

//  内置几组请求：共享前缀越多，省得越多
const REQ_SETS: Record<string, string[][]> = {
  //  同一个 system 前缀 + 不同任务
  '共享 system 前缀': [
    ['系统', '请', '翻译', '成', '英文'],
    ['系统', '请', '翻译', '成', '日文'],
    ['系统', '请', '总结'],
    ['系统', '你好'],
  ],
  '各不相同': [
    ['天气', '如何'],
    ['股票', '走势'],
    ['讲个', '笑话'],
  ],
  '层层加深': [
    ['A'],
    ['A', 'B'],
    ['A', 'B', 'C'],
    ['A', 'B', 'C', 'D'],
  ],
}

export const radixKernel: Kernel<RadixState> = {
  kind: 'radix',

  compile(doc: SimDocument): CompiledModel<RadixState> {
    const budget = num(doc.params, 'budget') || 10
    const setName = String(doc.params.requests ?? '共享 system 前缀')
    const requests = REQ_SETS[setName] ?? REQ_SETS['共享 system 前缀']

    //  radix 树：nodes[0] 是虚拟根（token=''）
    const nodes: RadixNode[] = [{ token: '', parent: -1, depth: 0, lru: 0, terminal: false }]
    const childOf = (parent: number, token: string): number =>
      nodes.findIndex(n => n.parent === parent && n.token === token)

    let clock = 0
    let savedTotal = 0, seenTotal = 0
    const frames: Frame[] = []
    const clone = (): RadixNode[] => nodes.map(n => ({ ...n }))
    const base = (): Frame => ({
      req: 0, reqTokens: [], pos: -1, nodes: clone(), focus: 0, hit: 0, compute: 0,
      cached: nodes.length - 1, budget, savedTotal, seenTotal, act: 'reqdone', log: '',
    })

    const put = (f: Partial<Frame> & { act: Frame['act']; log: string }) =>
      frames.push({ ...base(), ...f, nodes: clone(), cached: nodes.length - 1, savedTotal, seenTotal })

    requests.forEach((toks, ri) => {
      const req = ri + 1
      let cur = 0                     // 从根开始
      let hit = 0, compute = 0
      let matching = true            // 还在命中已缓存前缀

      toks.forEach((tk, pos) => {
        clock++
        if (matching) {
          const child = childOf(cur, tk)
          if (child >= 0) {
            //  命中：复用这一段 KV，刷新 LRU
            nodes[child].lru = clock
            cur = child; hit++
            put({ req, reqTokens: toks, pos, focus: child, hit, compute, act: 'match',
              log: `请求 ${req} 第 ${pos + 1} 个 token「${tk}」**命中**前缀树 —— KV 直接复用，不重算` })
            return
          }
          matching = false           // 从这里起，后面都是新的
        }
        //  未命中：计算 KV，挂一个新结点
        const idx = nodes.length
        nodes.push({ token: tk, parent: cur, depth: nodes[cur].depth + 1, lru: clock, terminal: false })
        cur = idx; compute++
        put({ req, reqTokens: toks, pos, focus: idx, hit, compute, act: 'compute',
          log: `请求 ${req} 第 ${pos + 1} 个 token「${tk}」**未命中** —— 计算它的 KV 并挂进树` })
      })
      if (cur > 0) nodes[cur].terminal = true

      savedTotal += hit; seenTotal += toks.length
      put({ req, reqTokens: toks, pos: toks.length - 1, focus: cur, hit, compute, act: 'reqdone',
        log: `请求 ${req} 完成：${toks.length} 个 token 里 **命中 ${hit}、计算 ${compute}** —— `
          + `省下 ${hit} 个 token 的 prefill（${pct(hit, toks.length)}）` })

      //  ── 超预算就 LRU 淘汰叶子 ──
      while (nodes.length - 1 > budget) {
        //  叶子 = 没有子结点的非根结点；挑 lru 最小的
        const isLeaf = (k: number) => k > 0 && !nodes.some(n => n.parent === k)
        let victim = -1, best = Infinity
        for (let k = 1; k < nodes.length; k++) {
          if (isLeaf(k) && nodes[k].lru < best) { best = nodes[k].lru; victim = k }
        }
        if (victim < 0) break
        const vtok = nodes[victim].token
        //  删除：把该结点抹掉，后面结点前移，parent 下标跟着修
        nodes.splice(victim, 1)
        for (const n of nodes) if (n.parent > victim) n.parent--
        put({ req, reqTokens: toks, focus: 0, hit, compute, act: 'evict',
          log: `缓存超预算（${nodes.length - 1 + 1} > ${budget}）→ LRU 淘汰最久没用的叶子「${vtok}」` })
      }
    })

    put({ act: 'done', focus: 0,
      log: `全部 ${requests.length} 个请求处理完：累计 ${seenTotal} 个 token，`
        + `靠前缀复用省下 ${savedTotal} 个的 prefill（${pct(savedTotal, seenTotal)}）` })

    return {
      axis: { kind: 'step', label: '处理步骤' },
      initial: () => ({ i: -1, ...base(), nodes: [{ token: '', parent: -1, depth: 0, lru: 0, terminal: false }], cached: 0, savedTotal: 0, seenTotal: 0, log: '' }),
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

function pct(a: number, b: number): string {
  return b ? ((a / b) * 100).toFixed(0) + '%' : '0%'
}
