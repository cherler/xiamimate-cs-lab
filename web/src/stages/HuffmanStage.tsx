/** 舞台：哈夫曼树 —— 森林合并 + 编码表 */
import { NIL } from '@engine/core/tree.ts'
import type { HuffState } from '@engine/kernels/huffman.ts'
import type { StageProps } from '../types.ts'
import { TreeView, type NodeTone } from '../shell/TreeView.tsx'

export function HuffmanStage({ trace, index, state, tab }: StageProps<HuffState>) {
  if (tab === 'codes') return <Codes state={state} trace={trace} />
  return <Forest state={state} />
}

function Forest({ state }: { state: HuffState }) {
  const picked = new Set(state.picked)
  return (
    <div className="card">
      <h3>森林 <span className="hint">每次取权值最小的两棵合并，直到只剩一棵</span></h3>
      <div className="body">
        <TreeView
          nodes={state.nodes} roots={state.forest}
          toneOf={n => (n === state.merged ? 'merged'
            : picked.has(n) ? 'picked'
            : 'plain') as NodeTone}
          labelOf={n => String(state.nodes[n].w ?? state.nodes[n].key)}
          subOf={n => state.nodes[n].label ?? ''}
          caption={`森林里还有 ${state.forest.length} 棵树`
            + (state.forest.length === 1 ? ' —— 哈夫曼树构造完成' : '')}
        />
        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
        </div>
      </div>
    </div>
  )
}

/** 编码表 + WPL 的算式 */
function Codes({ state, trace }: { state: HuffState; trace: HuffState[] }) {
  const done = trace.at(-1)!
  const leaves = done.nodes
    .map((n, k) => ({ n, k }))
    .filter(x => x.n.left === NIL && x.n.right === NIL)
  const ready = Object.keys(state.codes).length > 0

  return (
    <div className="card">
      <h3>编码表与 WPL <span className="hint">走到最后一步才出结果</span></h3>
      <div className="body">
        {!ready && (
          <p className="tnote">还没构造完 —— 把时间轴拖到最后一步，编码表就出来了。</p>
        )}
        <table className="ptab">
          <thead><tr><th>字符</th><th>权值 w</th><th>编码</th><th>码长 L</th><th>w × L</th></tr></thead>
          <tbody>
            {leaves.map(({ n, k }) => {
              const code = done.codes[n.label ?? ''] ?? ''
              return (
                <tr key={k} className={ready ? '' : 'future'}>
                  <th>{n.label}</th>
                  <td>{n.w}</td>
                  <td className="seq"><span style={{ color: 'var(--now)' }}>{ready ? code : '—'}</span></td>
                  <td>{ready ? code.length : '—'}</td>
                  <td>{ready ? n.w! * code.length : '—'}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr><th colSpan={4}>WPL（带权路径长度）</th>
              <td className="work">{ready ? done.wpl : '—'}</td></tr>
          </tfoot>
        </table>
        <p className="tnote">
          <b>为什么是前缀码</b>：所有字符都在叶子上，任何一个编码都不可能是另一个的前缀 ——
          所以解码时不需要分隔符，从头顺着树走就行。<br />
          <b>另一条捷径</b>：WPL 也等于所有<b>内部结点</b>权值之和 —— 因为每次合并，
          那两棵子树里的每个叶子都往下深了一层。
        </p>
      </div>
    </div>
  )
}
