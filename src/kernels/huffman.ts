/**
 * 内核：哈夫曼树与哈夫曼编码（数据结构）
 * 轴：step —— 每步合并两棵权值最小的树
 *
 * 考点三件：构造过程、WPL、以及"为什么哈夫曼编码是前缀码"。
 * 前两件靠逐步合并看得见；第三件在编码表里 —— 所有字符都在叶子上，
 * 没有任何一个编码是另一个的前缀。
 */
import { type SimDocument } from '../core/document.ts'
import { NIL, cloneNodes, type TreeNode } from '../core/tree.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type HuffState = {
  i: number
  nodes: TreeNode[]
  /** 当前森林里各棵树的根 */
  forest: number[]
  /** 本步选中的两棵（权值最小的） */
  picked: number[]
  /** 本步新建的父结点 */
  merged: number
  /** 当前的带权路径长度 */
  wpl: number
  /** 编码表（只有走完才有） */
  codes: Record<string, string>
  act: 'init' | 'merge' | 'done'
  log: string
}

export const HUFF_VISIBLE = [
  'i', 'nodes', 'forest', 'picked', 'merged', 'wpl', 'codes', 'act', 'log',
] as const

type Frame = Omit<HuffState, 'i'>

export const huffmanKernel: Kernel<HuffState> = {
  kind: 'huffman',

  compile(doc: SimDocument): CompiledModel<HuffState> {
    const weights = (doc.streams.find(s => s.name === 'weights')?.values ?? []) as number[]
    /** 字符标签由实体给（可选）；没有就用 A B C… */
    const labels = doc.entities.filter(e => e.type === 'symbol').map(e => e.id)

    const nodes: TreeNode[] = weights.map((w, k) => ({
      key: w, w, left: NIL, right: NIL,
      label: labels[k] ?? String.fromCharCode(65 + k),
    }))
    let forest = weights.map((_, k) => k)
    const frames: Frame[] = []

    const put = (f: Partial<Frame> & { act: Frame['act']; log: string }) => frames.push({
      nodes: cloneNodes(nodes), forest: [...forest], picked: [], merged: NIL,
      wpl: frames.at(-1)?.wpl ?? 0, codes: {}, ...f,
    })

    put({
      act: 'init',
      log: `初始森林：${forest.map(k => `${nodes[k].label}(${nodes[k].w})`).join('、')}`
        + ` —— 每个字符各成一棵单结点树`,
    })

    while (forest.length > 1) {
      //  取权值最小的两棵；权值相同时取先出现的，保证结果可复现
      const sorted = [...forest].sort((a, b) =>
        (nodes[a].w! - nodes[b].w!) || (a - b))
      const [x, y] = sorted
      const idx = nodes.length
      nodes.push({
        key: nodes[x].w! + nodes[y].w!, w: nodes[x].w! + nodes[y].w!,
        left: x, right: y, label: '',
      })
      forest = forest.filter(k => k !== x && k !== y).concat(idx)

      put({
        act: 'merge', picked: [x, y], merged: idx,
        log: `取权值最小的两棵：${nodes[x].label || nodes[x].w}(${nodes[x].w})`
          + ` 与 ${nodes[y].label || nodes[y].w}(${nodes[y].w})`
          + ` → 合并成权值 ${nodes[idx].w} 的新结点，放回森林（还剩 ${forest.length} 棵）`,
      })
    }

    // ── 生成编码表并算 WPL ────────────────────────────
    const root = forest[0] ?? NIL
    const codes: Record<string, string> = {}
    let wpl = 0
    if (root !== NIL) {
      const walk = (n: number, code: string) => {
        if (nodes[n].left === NIL && nodes[n].right === NIL) {
          //  只有一个字符时编码为 "0"，不能是空串
          codes[nodes[n].label!] = code || '0'
          wpl += nodes[n].w! * Math.max(1, code.length)
          return
        }
        walk(nodes[n].left, code + '0')
        walk(nodes[n].right, code + '1')
      }
      walk(root, '')
    }
    put({
      act: 'done', wpl, codes,
      log: `构造完成：WPL = ${Object.entries(codes)
        .map(([c, code]) => `${c}×${code.length}`).join(' + ')} = ${wpl}`,
    })

    return {
      axis: { kind: 'step', label: '合并次序' },
      initial: () => ({
        i: -1, nodes: [], forest: [], picked: [], merged: NIL,
        wpl: 0, codes: {}, act: 'init', log: '',
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
