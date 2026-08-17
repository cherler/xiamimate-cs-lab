/** 舞台：AVL —— 树形 + 旋转说明 */
import { NIL, trueHeight } from '@engine/core/tree.ts'
import type { AvlState } from '@engine/kernels/avl.ts'
import type { StageProps } from '../types.ts'
import { TreeView, type NodeTone } from '../shell/TreeView.tsx'

export function AvlStage({ doc, trace, index, state, tab }: StageProps<AvlState>) {
  if (tab === 'rotations') return <Rotations trace={trace} index={index} />
  return <Tree state={state} />
}

function Tree({ state }: { state: AvlState }) {
  const focus = new Set(state.focus)
  const bf = (n: number) =>
    trueHeight(state.nodes, state.nodes[n].left) - trueHeight(state.nodes, state.nodes[n].right)

  return (
    <div className="card">
      <h3>平衡二叉树 <span className="hint">结点下方是平衡因子（左高 − 右高）</span></h3>
      <div className="body">
        <TreeView
          nodes={state.nodes} roots={[state.root]}
          toneOf={n => (n === state.pivot ? 'pivot' : focus.has(n) ? 'focus' : 'plain') as NodeTone}
          subOf={n => {
            const b = bf(n)
            return Math.abs(b) > 1 ? `${b > 0 ? '+' : ''}${b} ⚠` : `${b > 0 ? '+' : ''}${b}`
          }}
          caption={state.root === NIL ? '还没有插入任何键'
            : `树高 ${trueHeight(state.nodes, state.root)} · 结点数 ${state.inserted}`}
        />
        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
        </div>
      </div>
    </div>
  )
}

/** 旋转清单：四种失衡各是什么样，发生了哪些 */
function Rotations({ trace, index }: { trace: AvlState[]; index: number }) {
  const rots = trace.filter(s => s.act === 'rotate')
  type Rot = AvlState['rotation']
  const TYPES: [Rot, string, string][] = [
    ['LL', '左孩子的左子树太高', '对失衡结点右旋一次'],
    ['RR', '右孩子的右子树太高', '对失衡结点左旋一次'],
    ['LR', '左孩子的右子树太高', '先对左孩子左旋，再对失衡结点右旋'],
    ['RL', '右孩子的左子树太高', '先对右孩子右旋，再对失衡结点左旋'],
  ]
  const happened = new Set(rots.filter(r => r.i <= index).map(r => r.rotation))

  return (
    <div className="card">
      <h3>四种失衡 <span className="hint">本次插入序列里发生过的会亮起来</span></h3>
      <div className="body">
        <div className="rotgrid">
          {TYPES.map(([t, why, how]) => (
            <div key={t} className={`rotcard ${happened.has(t) ? 'on' : ''}`}>
              <b>{t}</b>
              <span className="why">{why}</span>
              <span className="how">{how}</span>
            </div>
          ))}
        </div>
        <div className="entcap" style={{ marginTop: 14 }}>本次发生的旋转</div>
        <ol className="rotlist">
          {rots.map(r => (
            <li key={r.i} className={r.i === index ? 'cur' : r.i < index ? 'past' : 'future'}>
              <span className="tp">{r.rotation}</span>
              <span className="tx">{r.log}</span>
            </li>
          ))}
          {rots.length === 0 ? <li className="none">这个插入序列没有触发任何旋转</li> : null}
        </ol>
      </div>
    </div>
  )
}
