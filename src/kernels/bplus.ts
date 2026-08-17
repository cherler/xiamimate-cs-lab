/**
 * 内核：B+ 树的插入与分裂（数据结构）
 * 轴：step
 *
 * B+ 树相对 B 树的两点差别，也是考点所在：
 *   1. **所有关键字都出现在叶子层**，内部结点只当索引用
 *   2. 叶子之间用指针串成有序链表 —— 范围查询靠它
 *
 * 分裂时：叶子分裂要把中间键**复制**到父结点（叶子自己也留一份），
 * 内部结点分裂则是把中间键**上移**（自己不留）—— 这一处最容易记反。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type BNode = {
  keys: number[]
  /** 内部结点的孩子下标；叶子为空 */
  children: number[]
  leaf: boolean
  /** 叶子链表的下一个叶子；−1 表示没有 */
  next: number
}

export type BPlusState = {
  i: number
  nodes: BNode[]
  root: number
  /** 本步插入的键 */
  key: number
  /** 本步涉及的结点 */
  focus: number[]
  act: 'descend' | 'insert' | 'split' | 'grow' | 'done'
  /** 分裂时上送/复制的中间键 */
  upKey: number
  /** 分裂是叶子还是内部结点 —— 这决定中间键是复制还是上移 */
  splitLeaf: boolean
  height: number
  splits: number
  log: string
}

export const BPLUS_VISIBLE = [
  'i', 'nodes', 'root', 'key', 'focus', 'act', 'upKey', 'splitLeaf', 'height', 'splits', 'log',
] as const

type Frame = Omit<BPlusState, 'i'>

export const bplusKernel: Kernel<BPlusState> = {
  kind: 'bplus',

  compile(doc: SimDocument): CompiledModel<BPlusState> {
    const m = num(doc.params, 'order')          // 阶：每个结点最多 m−1 个关键字
    const keys = (doc.streams.find(s => s.name === 'keys')?.values ?? []) as number[]
    const MAXK = m - 1

    const nodes: BNode[] = [{ keys: [], children: [], leaf: true, next: -1 }]
    let root = 0
    let splits = 0
    const frames: Frame[] = []

    const clone = () => nodes.map(n => ({ ...n, keys: [...n.keys], children: [...n.children] }))
    const heightOf = (): number => {
      let h = 1, cur = root
      while (!nodes[cur].leaf) { cur = nodes[cur].children[0]; h++ }
      return h
    }
    const put = (f: Partial<Frame> & { act: Frame['act']; log: string }) => frames.push({
      nodes: clone(), root, key: 0, focus: [], upKey: 0, splitLeaf: true,
      height: heightOf(), splits, ...f,
    })

    for (const key of keys) {
      // ── 1. 从根往下找叶子 ────────────────────────────
      const path: number[] = []
      let cur = root
      while (!nodes[cur].leaf) {
        path.push(cur)
        let k = 0
        while (k < nodes[cur].keys.length && key >= nodes[cur].keys[k]) k++
        put({
          act: 'descend', key, focus: [cur],
          log: `插入 ${key}：内部结点 [${nodes[cur].keys.join(' ')}] → `
            + `${key} 落在第 ${k} 个分支，往下走`,
        })
        cur = nodes[cur].children[k]
      }

      // ── 2. 插进叶子（保持有序）──────────────────────
      const leaf = nodes[cur]
      let pos = 0
      while (pos < leaf.keys.length && leaf.keys[pos] < key) pos++
      if (leaf.keys[pos] === key) {
        put({ act: 'insert', key, focus: [cur], log: `插入 ${key}：叶子里已有，跳过` })
        continue
      }
      leaf.keys.splice(pos, 0, key)
      put({
        act: 'insert', key, focus: [cur],
        log: `把 ${key} 插进叶子 → [${leaf.keys.join(' ')}]`
          + (leaf.keys.length > MAXK ? `，超过上限 ${MAXK} 个，要分裂` : `（未超上限 ${MAXK}）`),
      })

      // ── 3. 自底向上分裂 ─────────────────────────────
      let node = cur
      let parentPath = [...path]
      while (nodes[node].keys.length > MAXK) {
        splits++
        const n = nodes[node]
        const mid = Math.floor(n.keys.length / 2)
        const isLeaf = n.leaf

        const right: BNode = { keys: [], children: [], leaf: isLeaf, next: -1 }
        let upKey: number
        if (isLeaf) {
          //  叶子分裂：中间键**复制**上去，右叶子自己也留着
          upKey = n.keys[mid]
          right.keys = n.keys.slice(mid)
          n.keys = n.keys.slice(0, mid)
          right.next = n.next
        } else {
          //  内部结点分裂：中间键**上移**，自己不留
          upKey = n.keys[mid]
          right.keys = n.keys.slice(mid + 1)
          right.children = n.children.slice(mid + 1)
          n.keys = n.keys.slice(0, mid)
          n.children = n.children.slice(0, mid + 1)
        }
        const ri = nodes.length
        nodes.push(right)
        if (isLeaf) n.next = ri

        put({
          act: 'split', key, focus: [node, ri], upKey, splitLeaf: isLeaf, splits,
          log: `${isLeaf ? '叶子' : '内部结点'}分裂：左 [${n.keys.join(' ')}] / 右 [${right.keys.join(' ')}]，`
            + (isLeaf
              ? `中间键 ${upKey} **复制**到父结点（叶子里仍保留一份 —— B+ 树所有键都在叶子层）`
              : `中间键 ${upKey} **上移**到父结点（内部结点自己不再保留）`),
        })

        if (parentPath.length === 0) {
          //  分裂到根 → 长高一层
          const newRoot: BNode = { keys: [upKey], children: [node, ri], leaf: false, next: -1 }
          nodes.push(newRoot)
          root = nodes.length - 1
          put({
            act: 'grow', key, focus: [root], upKey,
            log: `分裂的是根结点 → 新建一个根 [${upKey}]，树高变成 ${heightOf()} 层`
              + `（B+ 树只在根分裂时长高，所以始终**完全平衡**）`,
          })
          break
        }
        const parent = parentPath.pop()!
        const p = nodes[parent]
        let k = 0
        while (k < p.keys.length && p.keys[k] < upKey) k++
        p.keys.splice(k, 0, upKey)
        p.children.splice(k + 1, 0, ri)
        node = parent
      }
    }

    put({
      act: 'done',
      log: `插入完毕：${keys.length} 个键，分裂 ${splits} 次，树高 ${heightOf()} 层`
        + `；所有关键字都在叶子层，叶子之间串成有序链表`,
    })

    return {
      axis: { kind: 'step', label: '操作序号' },
      initial: () => ({
        i: -1, nodes: [{ keys: [], children: [], leaf: true, next: -1 }], root: 0,
        key: 0, focus: [], act: 'descend', upKey: 0, splitLeaf: true,
        height: 1, splits: 0, log: '',
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

/** 叶子链上的全部关键字 —— 用来验"所有键都在叶子层且有序" */
export function leafChain(nodes: BNode[], root: number): number[] {
  let cur = root
  while (!nodes[cur].leaf) cur = nodes[cur].children[0]
  const out: number[] = []
  while (cur !== -1) { out.push(...nodes[cur].keys); cur = nodes[cur].next }
  return out
}
