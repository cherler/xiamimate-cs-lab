/**
 * 内核：AVL 平衡二叉树（数据结构）
 * 轴：step —— 每步是一次比较下降、插入、或一次旋转
 *
 * 四种失衡与对应的旋转，是这个内容里唯一真正难的地方：
 *   LL 右旋 · RR 左旋 · LR 先左后右 · RL 先右后左
 * 所以每次旋转都单独占一步，并明确标出**是哪个结点失衡、往哪边转**。
 */
import { str, type SimDocument } from '../core/document.ts'
import { NIL, cloneNodes, type TreeNode } from '../core/tree.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type AvlState = {
  i: number
  nodes: TreeNode[]
  root: number
  /** 本步正在处理的键 */
  key: number
  /** 本步高亮的结点下标 */
  focus: number[]
  /** 本步动作 */
  act: 'descend' | 'insert' | 'update' | 'rotate' | 'done'
  /** 旋转类型 */
  rotation: '' | 'LL' | 'RR' | 'LR' | 'RL'
  /** 失衡结点 */
  pivot: number
  /** 已插入的键数 */
  inserted: number
  /** 累计旋转次数 */
  rotations: number
  log: string
}

export const AVL_VISIBLE = [
  'i', 'nodes', 'root', 'key', 'focus', 'act', 'rotation', 'pivot', 'inserted', 'rotations', 'log',
] as const

type Frame = Omit<AvlState, 'i'>

export const avlKernel: Kernel<AvlState> = {
  kind: 'avl',

  compile(doc: SimDocument): CompiledModel<AvlState> {
    const mode = str(doc.params, 'mode')          // 'avl' | 'bst'（关掉旋转做对照）
    const keys = (doc.streams.find(s => s.name === 'keys')?.values ?? []) as number[]

    const nodes: TreeNode[] = []
    let root = NIL
    let rotations = 0
    const frames: Frame[] = []

    const h = (n: number) => (n === NIL ? 0 : nodes[n].h ?? 0)
    const upd = (n: number) => { nodes[n].h = 1 + Math.max(h(nodes[n].left), h(nodes[n].right)) }
    const bf = (n: number) => (n === NIL ? 0 : h(nodes[n].left) - h(nodes[n].right))

    const put = (f: Partial<Frame> & { act: Frame['act']; log: string }) => frames.push({
      nodes: cloneNodes(nodes), root, key: 0, focus: [], rotation: '', pivot: NIL,
      inserted: frames.at(-1)?.inserted ?? 0, rotations, ...f,
    })

    /** 右旋：左孩子上位 —— 治 LL */
    const rotR = (y: number) => {
      const x = nodes[y].left
      nodes[y].left = nodes[x].right
      nodes[x].right = y
      upd(y); upd(x)
      return x
    }
    /** 左旋：右孩子上位 —— 治 RR */
    const rotL = (y: number) => {
      const x = nodes[y].right
      nodes[y].right = nodes[x].left
      nodes[x].left = y
      upd(y); upd(x)
      return x
    }

    for (const key of keys) {
      // ── 1. 从根往下找位置，每一层记一步 ──────────────
      const path: number[] = []
      let cur = root
      let dup = false
      while (cur !== NIL) {
        path.push(cur)
        if (key === nodes[cur].key) {
          put({ act: 'descend', key, focus: [cur],
            log: `插入 ${key}：与 ${nodes[cur].key} 相等 —— AVL 不存重复键，跳过` })
          dup = true
          break
        }
        put({
          act: 'descend', key, focus: [cur],
          log: `插入 ${key}：与 ${nodes[cur].key} 比较，${key < nodes[cur].key ? '更小 → 走左子树' : '更大 → 走右子树'}`,
        })
        cur = key < nodes[cur].key ? nodes[cur].left : nodes[cur].right
      }
      if (dup) continue

      // ── 2. 挂上去 ───────────────────────────────────
      const idx = nodes.length
      nodes.push({ key, left: NIL, right: NIL, h: 1 })
      if (path.length === 0) root = idx
      else {
        const p = path[path.length - 1]
        if (key < nodes[p].key) nodes[p].left = idx
        else nodes[p].right = idx
      }
      put({
        act: 'insert', key, focus: [idx],
        inserted: (frames.at(-1)?.inserted ?? 0) + 1,
        log: path.length === 0
          ? `树是空的 → ${key} 成为根结点`
          : `把 ${key} 挂在 ${nodes[path[path.length - 1]].key} 的${key < nodes[path[path.length - 1]].key ? '左' : '右'}边`,
      })

      // ── 3. 自底向上更新高度并检查平衡 ────────────────
      for (let k = path.length - 1; k >= 0; k--) {
        const n = path[k]
        upd(n)
        const b = bf(n)
        if (Math.abs(b) <= 1) {
          put({
            act: 'update', key, focus: [n],
            log: `回溯到 ${nodes[n].key}：高度更新为 ${h(n)}，平衡因子 ${b > 0 ? '+' : ''}${b} —— 仍平衡`,
          })
          continue
        }
        if (mode === 'bst') {
          put({
            act: 'update', key, focus: [n],
            log: `结点 ${nodes[n].key} 的平衡因子是 ${b > 0 ? '+' : ''}${b}，已经失衡 —— `
              + `但当前是普通 BST 模式，不做旋转（正好用来对照）`,
          })
          continue
        }

        // ── 4. 判断是哪一种失衡，转 ──────────────────
        const parent = k > 0 ? path[k - 1] : NIL
        const wasLeftChild = parent !== NIL && nodes[parent].left === n
        const before = nodes[n].key
        let rotation: AvlState['rotation']
        let newSub: number

        if (b > 1 && bf(nodes[n].left) >= 0) {
          rotation = 'LL'; newSub = rotR(n)
        } else if (b > 1) {
          rotation = 'LR'
          nodes[n].left = rotL(nodes[n].left)
          newSub = rotR(n)
        } else if (b < -1 && bf(nodes[n].right) <= 0) {
          rotation = 'RR'; newSub = rotL(n)
        } else {
          rotation = 'RL'
          nodes[n].right = rotR(nodes[n].right)
          newSub = rotL(n)
        }
        rotations++

        if (parent === NIL) root = newSub
        else if (wasLeftChild) nodes[parent].left = newSub
        else nodes[parent].right = newSub

        const HOW: Record<string, string> = {
          LL: '左孩子的左子树太高 → 对失衡结点做一次**右旋**',
          RR: '右孩子的右子树太高 → 对失衡结点做一次**左旋**',
          LR: '左孩子的右子树太高 → 先对左孩子**左旋**，再对失衡结点**右旋**',
          RL: '右孩子的左子树太高 → 先对右孩子**右旋**，再对失衡结点**左旋**',
        }
        put({
          act: 'rotate', key, focus: [newSub], pivot: newSub, rotation, rotations,
          log: `结点 ${before} 的平衡因子是 ${b > 0 ? '+' : ''}${b} → **${rotation} 型失衡**：`
            + `${HOW[rotation]}。转完由 ${nodes[newSub].key} 顶上来`,
        })
        //  一次插入最多需要一次旋转，转完整棵树就平衡了
        break
      }
    }

    put({
      act: 'done', log: mode === 'bst'
        ? `插入完毕：共 ${keys.length} 个键，未做任何旋转（普通 BST）`
        : `插入完毕：共 ${keys.length} 个键，做了 ${rotations} 次旋转，树始终保持平衡`,
    })

    return {
      axis: { kind: 'step', label: '操作序号' },
      initial: () => ({
        i: -1, nodes: [], root: NIL, key: 0, focus: [], act: 'descend',
        rotation: '', pivot: NIL, inserted: 0, rotations: 0, log: '',
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
