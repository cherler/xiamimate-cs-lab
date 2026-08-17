/**
 * 内核：图的遍历（数据结构）
 * 轴：step —— 每步访问一个顶点或做一次入栈/入队
 *
 * DFS 与 BFS 的差别只有一处：**下一个从哪儿取** —— 栈顶还是队首。
 * 所以这个实验把栈/队列的内容全程摆出来，差别就是它。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type TravState = {
  i: number
  /** 已访问序列 */
  order: string[]
  /** 待处理容器：DFS 是栈（末尾为栈顶），BFS 是队列（开头为队首） */
  pending: string[]
  at: string
  act: 'visit' | 'push' | 'skip' | 'done'
  /** 生成树上的边（谁把谁带进来的） */
  treeEdges: string[]
  log: string
}

export const TRAV_VISIBLE =
  ['i', 'order', 'pending', 'at', 'act', 'treeEdges', 'log'] as const

type Frame = Omit<TravState, 'i'>

export const traverseKernel: Kernel<TravState> = {
  kind: 'traverse',

  compile(doc: SimDocument): CompiledModel<TravState> {
    const algorithm = str(doc.params, 'algorithm')     // 'DFS' | 'BFS'
    const start = str(doc.params, 'start')
    const directed = num(doc.params, 'directed') === 1
    const nodes = doc.entities.filter(e => e.type === 'node').map(e => e.id)
    const edges = doc.entities.filter(e => e.type === 'edge')

    const adj: Record<string, string[]> = {}
    for (const n of nodes) adj[n] = []
    for (const e of edges) {
      adj[String(e.attrs.from)]?.push(String(e.attrs.to))
      if (!directed) adj[String(e.attrs.to)]?.push(String(e.attrs.from))
    }
    for (const n of nodes) adj[n].sort()

    const frames: Frame[] = []
    const order: string[] = []
    const treeEdges: string[] = []
    const visited = new Set<string>()
    const dfs = algorithm === 'DFS'
    let pending: string[] = [start]
    /** 记住每个待访顶点是被谁带进来的，用来画生成树 */
    const from: Record<string, string> = {}

    const put = (f: Partial<Frame> & { act: Frame['act']; log: string }) => frames.push({
      order: [...order], pending: [...pending], at: '', treeEdges: [...treeEdges], ...f,
    })

    put({ act: 'push', log: `${algorithm}：起点 ${start} 放进${dfs ? '栈' : '队列'}` })

    let guard = 0
    while (guard++ < 500) {
      /*
       * 换连通分量的检查必须放在**循环顶部**。
       * 第一版放在"压栈"之后，可 pending 也可能是被 skip 分支（重复顶点）排空的，
       * 那条路径直接 continue，压根走不到检查 —— 孤立顶点就永远访问不到。
       */
      if (pending.length === 0) {
        const rest = nodes.find(n => !visited.has(n))
        if (!rest) break
        pending = [rest]
        put({ act: 'push', log: `这个连通分量走完了，还有 ${rest} 没访问 → 换它当新起点` })
      }
      //  DFS 取栈顶（末尾），BFS 取队首（开头）—— 两者唯一的差别
      const at = dfs ? pending.pop()! : pending.shift()!
      if (visited.has(at)) {
        put({ act: 'skip', at, log: `取出 ${at}：已经访问过，跳过` })
        continue
      }
      visited.add(at)
      order.push(at)
      if (from[at]) treeEdges.push(`${from[at]}-${at}`)
      put({
        act: 'visit', at,
        log: `从${dfs ? '栈顶' : '队首'}取出 ${at} 并访问 → 序列 ${order.join(' ')}`,
      })

      const nbrs = adj[at].filter(x => !visited.has(x))
      //  DFS 逆序压栈，出栈时才是字典序 —— 这一步不做的话遍历序会反
      const toPush = dfs ? [...nbrs].reverse() : nbrs
      for (const x of toPush) {
        if (!from[x]) from[x] = at
        pending.push(x)
      }
      if (nbrs.length) {
        put({
          act: 'push', at,
          log: `${at} 的未访问邻接点 ${nbrs.join('、')} 全部${dfs ? '压栈' : '入队'}`
            + `${dfs ? '（逆序压入，弹出时才是字典序）' : ''} → ${dfs ? '栈' : '队列'} [${pending.join(' ')}]`,
        })
      }

    }

    put({
      act: 'done',
      log: `${algorithm} 遍历完成：${order.join(' → ')}`
        + `（共 ${order.length} 个顶点，生成树 ${treeEdges.length} 条边）`,
    })

    return {
      axis: { kind: 'step', label: '操作序号' },
      initial: () => ({
        i: -1, order: [], pending: [], at: '', act: 'push', treeEdges: [], log: '',
      }),
      describe: s => s.log,
      step(prev) {
        const base = prev ?? this.initial()
        const i = base.i + 1
        if (i >= frames.length) return null
        return { state: { i, ...frames[i] }, done: i === frames.length - 1 }
      },
    }
  },
}
