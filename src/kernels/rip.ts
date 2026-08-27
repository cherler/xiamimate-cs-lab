/**
 * 内核：距离矢量路由（RIP / 分布式 Bellman-Ford）（计算机网络）
 * 轴：step —— 每步是一个「交换轮」：所有路由器同时用邻居的矢量更新自己的
 *
 * 距离矢量的核心更新式（分布式 Bellman-Ford）：
 *   D_x(y) = min over 邻居 v of [ c(x,v) + D_v(y) ]
 * 每台路由器只跟**直接邻居**交换整张距离表，一轮一轮逼近全局最短。
 *
 * 两个场景：
 *   收敛 —— 从只知道直连邻居，逐轮扩散到全网最短，直到不再变化。
 *   断链 —— 收敛后切断一条链，重现 RIP 著名的**无穷计数**：坏消息一跳一跳
 *           慢慢加大（+1、+2…），直到达到"无穷"（RIP 取 16）才认定不可达。
 *
 * 图用 entities 表达（跟 dijkstra 一致）；状态全部可 JSON 往返（验收标准 2）。
 */
import { str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

/** RIP 的"无穷" —— 到这个跳数就认定不可达 */
export const RIP_INF = 16

export type RipState = {
  i: number
  round: number
  routers: string[]
  /** 每台路由器的距离矢量：dist[x][y] = x 到 y 的当前代价 */
  dist: Record<string, Record<string, number>>
  /** 下一跳：via[x][y] = x 去 y 先发给谁 */
  via: Record<string, Record<string, string>>
  /** 本轮变了的格子，'x→y' */
  changed: string[]
  /** 断链场景里断掉的边（'AB'），未断为 '' */
  broken: string
  act: 'init' | 'exchange' | 'break' | 'converged' | 'capped'
  log: string
}

export const RIP_VISIBLE = [
  'i', 'round', 'routers', 'dist', 'via', 'changed', 'broken', 'act', 'log',
] as const

type Frame = Omit<RipState, 'i'>

export const ripKernel: Kernel<RipState> = {
  kind: 'rip',

  compile(doc: SimDocument): CompiledModel<RipState> {
    const scenario = str(doc.params, 'scenario') === '断链' ? 'break' : 'converge'
    const routers = doc.entities.filter(e => e.type === 'node').map(e => e.id).sort()
    type E = { a: string; b: string; w: number }
    let edges: E[] = doc.entities.filter(e => e.type === 'edge').map(e => ({
      a: String(e.attrs.from), b: String(e.attrs.to), w: Number(e.attrs.w),
    }))

    //  邻接（无向）
    const neighbors = (x: string, es: E[]) =>
      es.flatMap(e => (e.a === x ? [{ v: e.b, w: e.w }] : e.b === x ? [{ v: e.a, w: e.w }] : []))

    //  一台路由器只知道自己到直连邻居的代价，其余为无穷
    const freshDist = (es: E[]): Record<string, Record<string, number>> => {
      const d: Record<string, Record<string, number>> = {}
      const v: Record<string, Record<string, string>> = {}
      for (const x of routers) {
        d[x] = {}; v[x] = {}
        for (const y of routers) { d[x][y] = x === y ? 0 : RIP_INF; v[x][y] = x === y ? x : '' }
        for (const { v: nb, w } of neighbors(x, es)) { d[x][nb] = w; v[x][nb] = nb }
      }
      return d
    }

    const dist = freshDist(edges)
    const via: Record<string, Record<string, string>> = {}
    for (const x of routers) { via[x] = {}; for (const y of routers) via[x][y] = x === y ? x : (dist[x][y] < RIP_INF ? y : '') }

    const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o))
    const frames: Frame[] = []
    const put = (f: Partial<Frame> & { act: Frame['act']; log: string }) => frames.push({
      round: 0, routers, dist: clone(dist), via: clone(via), changed: [], broken: '', ...f,
    })

    put({ act: 'init', log: `初始：每台路由器只知道到直连邻居的代价，到其余目的地都是"无穷"（RIP 记作 ${RIP_INF}）` })

    //  一轮同步交换：每台路由器**从邻居的上一轮矢量重新算**自己的（分布式 Bellman-Ford）
    //  ⚠️ 必须每轮重算、不能拿上一轮当地板：否则一台路由器失去全部邻居后，
    //     它那些经由已失效下一跳的旧路由永远降不回无穷。而正是"从邻居重算 c + 邻居的旧值"
    //     这一步，让邻居广播的陈旧值一格格加大 —— 无穷计数就是这么来的。
    const exchange = (es: E[]): string[] => {
      const prev = clone(dist)
      const changed: string[] = []
      for (const x of routers) {
        const nbs = neighbors(x, es)
        for (const y of routers) {
          if (x === y) continue
          let best = RIP_INF, bestVia = ''
          for (const { v: nb, w } of nbs) {
            const cand = Math.min(RIP_INF, w + prev[nb][y])
            if (cand < best) { best = cand; bestVia = nb }
          }
          if (best !== dist[x][y]) changed.push(`${x}→${y}`)
          dist[x][y] = best; via[x][y] = best >= RIP_INF ? '' : bestVia
        }
      }
      return changed
    }

    //  ── 阶段一：收敛 ──
    let round = 0
    for (let guard = 0; guard < 20; guard++) {
      round++
      const changed = exchange(edges)
      if (changed.length === 0) {
        put({ round, act: 'converged', log: `第 ${round} 轮没有任何路由器的距离表发生变化 —— 全网收敛，每台都掌握了到所有目的地的最短代价` })
        break
      }
      put({ round, act: 'exchange', changed,
        log: `第 ${round} 轮交换：${changed.length} 个表项被更新（${changed.slice(0, 6).join('、')}${changed.length > 6 ? '…' : ''}）` })
    }

    //  ── 阶段二（断链场景）：切一条边，重现无穷计数 ──
    if (scenario === 'break' && edges.length) {
      const dead = edges[0]
      edges = edges.slice(1)
      //  直接把断边两端的直连代价打回无穷，再逐轮扩散
      for (const [x, y] of [[dead.a, dead.b], [dead.b, dead.a]] as [string, string][]) {
        if (via[x][y] === y) { dist[x][y] = RIP_INF; via[x][y] = '' }
      }
      put({ round, act: 'break', broken: `${dead.a}${dead.b}`,
        log: `链路 ${dead.a}—${dead.b} 断了！两端把这条直连代价设为无穷 —— 但别的路由器还不知道，坏消息要一跳一跳传` })

      const baseRound = round
      for (let guard = 0; guard < RIP_INF + 4; guard++) {
        round++
        const changed = exchange(edges)
        //  是否有表项已经爬到"无穷"
        const anyInf = routers.some(x => routers.some(y => x !== y && dist[x][y] >= RIP_INF))
        if (changed.length === 0) {
          put({ round, act: 'converged',
            log: `第 ${round - baseRound} 轮（断链后）不再变化 —— 那些真正不可达的目的地，代价都停在了无穷 ${RIP_INF}` })
          break
        }
        const climbing = changed.filter(c => {
          const [x, y] = c.split('→'); return dist[x][y] > 1 && dist[x][y] <= RIP_INF
        })
        put({ round, act: anyInf && climbing.length ? 'capped' : 'exchange', changed,
          log: `断链后第 ${round - baseRound} 轮：${changed.length} 个表项在变`
            + (climbing.length ? ` —— 通往断点的代价在一格格往上爬（无穷计数），要一直加到 ${RIP_INF} 才认定不可达` : '') })
      }
    }

    return {
      axis: { kind: 'step', label: '交换轮' },
      initial: () => ({
        i: -1, round: 0, routers, dist: freshDist(edges), via: {}, changed: [], broken: '',
        act: 'init', log: '',
      }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const i = b.i + 1
        if (i >= frames.length) return null
        return { state: { i, ...frames[i] }, done: i === frames.length - 1 }
      },
    }
  },
}
