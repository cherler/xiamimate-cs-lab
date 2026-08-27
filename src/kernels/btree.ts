/**
 * 内核：二叉树遍历（数据结构）
 * 轴：step —— 每步输出遍历序列里的一个结点
 *
 * 树由 `keys` 插入序列建成一棵**二叉搜索树**（复用 core/tree 的扁平数组表示），
 * 再按选定的次序遍历。四种次序：
 *   前序（根左右）· 中序（左根右）· 后序（左右根）· 层序（一层一层）
 *
 * 教学重点有两层：
 *   1. 三种深度优先次序**只差"根在什么时候输出"**；中序遍历 BST 得到的正好是有序序列。
 *   2. 深度优先靠**栈**（这里显示从根到当前的路径 = 递归调用栈的深度），
 *      层序靠**队列**（显示当前排队等待的结点）—— 容器不同，走法就不同。
 *
 * 状态全部可 JSON 往返：结点用下标不用指针引用（验收标准 2）。
 */
import { str, type SimDocument } from '../core/document.ts'
import { NIL, cloneNodes, type TreeNode } from '../core/tree.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type BtreeState = {
  i: number
  nodes: TreeNode[]
  root: number
  order: 'pre' | 'in' | 'post' | 'level'
  /** 本步输出的结点下标 */
  cur: number
  /** 已按次序输出的结点下标序列 */
  visited: number[]
  /** 辅助容器：深度优先=从根到当前的路径（调用栈）；层序=当前队列 */
  aux: number[]
  auxKind: 'stack' | 'queue'
  act: 'visit' | 'done'
  log: string
}

export const BTREE_VISIBLE = [
  'i', 'nodes', 'root', 'order', 'cur', 'visited', 'aux', 'auxKind', 'act', 'log',
] as const

type Frame = Omit<BtreeState, 'i'>

const ORDER_KEY: Record<string, BtreeState['order']> = {
  前序: 'pre', 中序: 'in', 后序: 'post', 层序: 'level',
}
const ORDER_CN: Record<BtreeState['order'], string> = {
  pre: '前序（根 → 左 → 右）',
  in: '中序（左 → 根 → 右）',
  post: '后序（左 → 右 → 根）',
  level: '层序（自上而下、自左而右）',
}

export const btreeKernel: Kernel<BtreeState> = {
  kind: 'btree',

  compile(doc: SimDocument): CompiledModel<BtreeState> {
    const order = ORDER_KEY[str(doc.params, 'order')] ?? 'pre'
    const keys = (doc.streams.find(s => s.name === 'keys')?.values ?? []) as number[]

    //  ── 先静默建一棵二叉搜索树（不进轨迹，第 0 步起整棵树就在那）──
    const nodes: TreeNode[] = []
    let root = NIL
    const parent: number[] = []
    for (const k of keys) {
      const idx = nodes.length
      nodes.push({ key: k, left: NIL, right: NIL })
      parent[idx] = NIL
      if (root === NIL) { root = idx; continue }
      let cur = root
      for (;;) {
        if (k < nodes[cur].key) {
          if (nodes[cur].left === NIL) { nodes[cur].left = idx; parent[idx] = cur; break }
          cur = nodes[cur].left
        } else {
          if (nodes[cur].right === NIL) { nodes[cur].right = idx; parent[idx] = cur; break }
          cur = nodes[cur].right
        }
      }
    }

    //  从根到某结点的路径（含自身）—— 深度优先访问它时的调用栈
    const pathTo = (n: number): number[] => {
      const out: number[] = []
      for (let c = n; c !== NIL; c = parent[c]) out.push(c)
      return out.reverse()
    }

    const frames: Frame[] = []
    const RULE: Record<BtreeState['order'], string> = {
      pre: '**先访问根**，再递归左子树，再递归右子树',
      in: '先递归左子树，**再访问根**，再递归右子树',
      post: '先递归左子树，再递归右子树，**最后访问根**',
      level: '按层入队：出队一个就访问它，再把它的左、右孩子入队',
    }

    const push = (cur: number, visited: number[], aux: number[], auxKind: Frame['auxKind'], log: string) =>
      frames.push({ nodes: cloneNodes(nodes), root, order, cur, visited: [...visited], aux: [...aux], auxKind, act: 'visit', log })

    if (order === 'level') {
      //  层序：真的用一个队列，每次出队即访问，快照当时的队列
      const visited: number[] = []
      const queue: number[] = root === NIL ? [] : [root]
      let n = 0
      while (queue.length) {
        const cur = queue.shift()!
        visited.push(cur)
        n++
        //  先把孩子入队，快照里就能看到"接下来轮到谁"
        if (nodes[cur].left !== NIL) queue.push(nodes[cur].left)
        if (nodes[cur].right !== NIL) queue.push(nodes[cur].right)
        push(cur, visited, queue, 'queue',
          `层序第 ${n} 个：出队 **${nodes[cur].key}**，访问它，` +
          (queue.length ? `再把它的孩子入队 → 队列：${queue.map(x => nodes[x].key).join(' ')}` : '队列已空'))
      }
    } else {
      //  深度优先：递归定次序，访问一个结点时快照从根到它的路径（= 调用栈）
      const visited: number[] = []
      let n = 0
      const visit = (cur: number) => {
        visited.push(cur); n++
        const where = order === 'pre' ? '刚下到' : order === 'in' ? '左子树走完，回到' : '左右都走完，回到'
        push(cur, visited, pathTo(cur), 'stack',
          `${ORDER_CN[order].split('（')[0]}第 ${n} 个：${where} **${nodes[cur].key}** → 输出它`)
      }
      const walk = (cur: number) => {
        if (cur === NIL) return
        if (order === 'pre') visit(cur)
        walk(nodes[cur].left)
        if (order === 'in') visit(cur)
        walk(nodes[cur].right)
        if (order === 'post') visit(cur)
      }
      walk(root)
    }

    const seq = frames.length ? frames[frames.length - 1].visited.map(x => nodes[x].key).join(' ') : ''
    frames.push({
      nodes: cloneNodes(nodes), root, order, cur: NIL, visited: frames.at(-1)?.visited ?? [],
      aux: [], auxKind: order === 'level' ? 'queue' : 'stack', act: 'done',
      log: `${ORDER_CN[order]}遍历完毕：${seq}` +
        (order === 'in' ? '　—— 中序遍历二叉搜索树，得到的正是从小到大的有序序列' : ''),
    })

    return {
      axis: { kind: 'step', label: '遍历序号' },
      initial: () => ({
        i: -1, nodes: cloneNodes(nodes), root, order,
        cur: NIL, visited: [], aux: [], auxKind: order === 'level' ? 'queue' : 'stack',
        act: 'visit', log: `规则：${RULE[order]}`,
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
