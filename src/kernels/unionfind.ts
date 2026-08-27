/**
 * 内核：并查集 Union-Find（经典算法 · 原理：把"谁和谁一伙"变成一棵树，认祖归宗只看根）
 * 轴：step —— 一串 union 把散点并成集团(树)，再用 find 顺着父指针找根、路径压缩把链拍平
 *
 * 并查集回答一类问题:一堆元素不断两两"结盟",随时要问"这俩现在是不是一伙的"。
 * 它用**树**表示集合:每个元素有个**父指针**,顺着往上走到**根**——根就是这个集团的代表。
 * **find(x)**=顺父指针爬到根;**union(a,b)**=找到两人的根,把一个根挂到另一个根下面,两棵树就并成一棵。
 * "是不是一伙"只需比较两人的根是否相同。
 *
 * 朴素合并会长出**长链**(a←b←c←…),find 要爬很久。**路径压缩**是点睛之笔:find 爬到根后,
 * 把沿途每个节点**直接指向根**,链一下拍平,后续再问几乎 O(1)。配合按秩合并,整体近乎常数。
 *
 * 本实验:7 个点。先 6 次 union 并成一个集团(故意长出一条 0←1←2←3 的链),再 find(0):
 * 看它顺链爬到根 6、再把 0/1/2/3 全**直接挂到 6 下**——深度从 4 塌到 1。连通分量数、每点深度都可核对。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const N = 7
const UNIONS: [number, number][] = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [0, 4]]

export type UnionFindState = {
  i: number
  step: number
  n: number
  parent: number[]
  act: string           // 'union' | 'find' | 'compress' | 'done'
  a: number; b: number  // 本步操作数
  ra: number; rb: number
  path: number[]        // find 走过的路径
  root: number
  comps: number         // 连通分量数
  roots: number[]       // 当前所有根
  depths: number[]      // 每点到根的深度
  merged: boolean
  phase: 'run' | 'done'
  log: string
}

export const UNIONFIND_VISIBLE = [
  'step', 'n', 'parent', 'act', 'a', 'b', 'ra', 'rb', 'path', 'root', 'comps', 'roots', 'depths', 'phase', 'log',
] as const

type Frame = Omit<UnionFindState, 'i'>

export const unionfindKernel: Kernel<UnionFindState> = {
  kind: 'unionfind',

  compile(_doc: SimDocument): CompiledModel<UnionFindState> {
    const parent = Array.from({ length: N }, (_, i) => i)
    const findRoot = (x: number) => { while (parent[x] !== x) x = parent[x]; return x }
    const depthOf = (x: number) => { let d = 0; while (parent[x] !== x) { x = parent[x]; d++ } return d }
    const rootsNow = () => [...Array(N).keys()].filter(i => parent[i] === i)
    const depthsNow = () => [...Array(N).keys()].map(depthOf)
    const compsNow = () => new Set([...Array(N).keys()].map(findRoot)).size

    const frames: Frame[] = []
    const snap = (extra: Partial<Frame>) => frames.push({
      step: frames.length, n: N, parent: parent.slice(), act: '', a: -1, b: -1, ra: -1, rb: -1,
      path: [], root: -1, comps: compsNow(), roots: rootsNow(), depths: depthsNow(), merged: false,
      phase: 'run', log: '', ...extra,
    })

    // 6 次 union
    for (const [a, b] of UNIONS) {
      const ra = findRoot(a), rb = findRoot(b)
      const merged = ra !== rb
      if (merged) parent[ra] = rb   // 朴素合并：把 a 的根挂到 b 的根下（故意长链）
      snap({
        act: 'union', a, b, ra, rb, merged,
        log: `**union(${a},${b})**:${a} 的根是 ${ra}、${b} 的根是 ${rb}。` +
          (merged ? `不同伙 → 把根 ${ra} 挂到根 ${rb} 下,两棵树并成一棵。现在 **${compsNow()}** 个连通分量。`
            : `已经同一个根 ${ra},本就是一伙,无需合并。`),
      })
    }

    // find(0)：走链
    let x = 0; const path: number[] = []
    while (parent[x] !== x) { path.push(x); x = parent[x] }
    const root = x
    snap({
      act: 'find', a: 0, root, path: path.slice(),
      log: `**find(0)**:顺父指针往上爬 —— ${[...path, root].join(' → ')},到根 **${root}**。这条链深 ${path.length},` +
        `爬了 ${path.length} 步。链越长、find 越慢。`,
    })

    // 路径压缩
    for (const q of path) parent[q] = root
    snap({
      act: 'compress', a: 0, root, path: path.slice(),
      log: `**路径压缩**:把刚才路径上的 ${path.join('、')} **全部直接挂到根 ${root}** 下。链一下拍平 —— ` +
        `这几个点深度从原来的 4/3/2/1 一起塌到 1,下次再 find 几乎一步到根。`,
    })

    // done
    const lastRoot = root
    snap({
      act: 'done', a: 0, root: lastRoot, phase: 'done',
      log: `**并查集完成**:6 次 union 把 7 个散点并成 1 个集团、find 认祖归宗只看根、路径压缩把链拍平。` +
        `"是不是一伙"就是"根同不同"。它是 Kruskal 最小生成树、网络连通性、账号合并、图像连通域的核心零件,` +
        `配合路径压缩+按秩合并,均摊近乎 O(1)。`,
    })

    const base0: Frame = {
      step: -1, n: N, parent: Array.from({ length: N }, (_, i) => i), act: '', a: -1, b: -1, ra: -1, rb: -1,
      path: [], root: -1, comps: N, roots: [...Array(N).keys()], depths: Array(N).fill(0), merged: false,
      phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: 'union / find' },
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
