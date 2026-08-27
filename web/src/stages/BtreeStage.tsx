/** 舞台：二叉树遍历 —— 树形（结点标访问序号）+ 辅助容器 · 四种次序对照 */
import { NIL, type TreeNode } from '@engine/core/tree.ts'
import type { BtreeState } from '@engine/kernels/btree.ts'
import type { StageProps } from '../types.ts'
import { TreeView, type NodeTone } from '../shell/TreeView.tsx'
import { rich } from '../shell/rich.tsx'

export function BtreeStage({ trace, index, state, tab }: StageProps<BtreeState>) {
  if (tab === 'orders') return <Orders state={state} />
  return <Tree state={state} />
}

function Tree({ state }: { state: BtreeState }) {
  //  访问序号：visited 数组里的位置 + 1
  const rank = new Map<number, number>()
  state.visited.forEach((n, k) => rank.set(n, k + 1))

  return (
    <div className="card">
      <h3>遍历树 <span className="hint">结点下方是它被输出的次序</span></h3>
      <div className="body">
        <TreeView
          nodes={state.nodes} roots={[state.root]}
          toneOf={n => (n === state.cur ? 'focus' : rank.has(n) ? 'picked' : 'plain') as NodeTone}
          subOf={n => (rank.has(n) ? `#${rank.get(n)}` : '')}
          caption={state.root === NIL ? '空树' : `已输出 ${state.visited.length} / ${state.nodes.length} 个结点`}
        />

        {/* 辅助容器：深度优先=栈（根→当前路径）· 层序=队列 */}
        <div className="btaux">
          <span className="btauxk">
            {state.auxKind === 'stack' ? '调用栈（根 → 当前）' : '队列（等待出队）'}
          </span>
          <div className="btauxrow">
            {state.aux.length === 0
              ? <span className="btempty">空</span>
              : state.aux.map((n, k) => (
                <span key={k} className={`btcell ${n === state.cur ? 'cur' : ''}`}>{state.nodes[n].key}</span>
              ))}
          </div>
        </div>

        {/* 输出序列：按次序长出来 */}
        <div className="btseq">
          <span className="btseqk">输出序列</span>
          <div className="btseqrow">
            {state.visited.length === 0
              ? <span className="btempty">还没输出</span>
              : state.visited.map((n, k) => (
                <span key={k} className={`btout ${n === state.cur ? 'cur' : ''}`}>{state.nodes[n].key}</span>
              ))}
          </div>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}

/** 四种次序对照：同一棵树，四条序列摆一起 —— 只差"根什么时候输出" */
function Orders({ state }: { state: BtreeState }) {
  const { nodes, root } = state
  const seq = (kind: BtreeState['order']): number[] => {
    const out: number[] = []
    if (kind === 'level') {
      const q = root === NIL ? [] : [root]
      while (q.length) { const c = q.shift()!; out.push(nodes[c].key); if (nodes[c].left !== NIL) q.push(nodes[c].left); if (nodes[c].right !== NIL) q.push(nodes[c].right) }
      return out
    }
    const walk = (c: number) => {
      if (c === NIL) return
      if (kind === 'pre') out.push(nodes[c].key)
      walk(nodes[c].left)
      if (kind === 'in') out.push(nodes[c].key)
      walk(nodes[c].right)
      if (kind === 'post') out.push(nodes[c].key)
    }
    walk(root)
    return out
  }
  const ROWS: [BtreeState['order'], string, string][] = [
    ['pre', '前序', '根 → 左 → 右'],
    ['in', '中序', '左 → 根 → 右'],
    ['post', '后序', '左 → 右 → 根'],
    ['level', '层序', '一层一层，从左到右'],
  ]

  return (
    <div className="card">
      <h3>四种次序对照 <span className="hint">同一棵树，只差"根在什么时候输出"</span></h3>
      <div className="body">
        <table className="btorders">
          <tbody>
            {ROWS.map(([k, name, rule]) => (
              <tr key={k} className={k === state.order ? 'on' : ''}>
                <th>{name}</th>
                <td className="rule">{rule}</td>
                <td className="seq">{seq(k).join(' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="gd-note" style={{ marginTop: 12 }}>
          中序遍历二叉搜索树，输出恰好是 <b>从小到大</b> 的有序序列 —— 这是 BST 最常被考的性质。
        </div>
      </div>
    </div>
  )
}

//  给 registry 用：读一个树结点的键（避免到处 import TreeNode）
export const keyOf = (nodes: TreeNode[], n: number) => (n === NIL ? '' : String(nodes[n].key))
