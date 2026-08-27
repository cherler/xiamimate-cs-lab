/** 舞台：Merkle 树 —— 4 数据块自底向上两两哈希汇成根 */
import type { MerkleState } from '@engine/kernels/merkle.ts'
import type { StageProps } from '../types.ts'

export function MerkleStage({ state }: StageProps<MerkleState>) {
  const { data, leaves, parents, root, act, focus, phase } = state
  const done = phase === 'done'
  const node = (val: number, label: string, on: boolean) => (
    <div className={`mk-node ${val >= 0 ? 'filled' : ''} ${on ? 'cur' : ''}`}>
      <span className="mk-lbl">{label}</span><span className="mk-val">{val >= 0 ? val : '·'}</span>
    </div>
  )
  return (
    <div className="card">
      <h3>Merkle 树 <span className="hint">一个根哈希守住一堆数据</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{act === 'leaf' ? '算叶子' : act === 'parent' ? '算父节点' : act === 'root' ? '算根' : '完成'}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">{data.length}</span><span className="scdl">数据块</span></div>
          <div className="scdk"><span className={`scdn ${root >= 0 ? 'ok' : ''}`}>{root >= 0 ? root : '?'}</span><span className="scdl">根哈希</span></div>
        </div>
        <div className="mk-tree">
          <div className="mk-level">{node(root, 'Root', act === 'root')}</div>
          <div className="mk-level">{parents.map((p, k) => node(p, `P${k}`, act === 'parent' && focus === k))}</div>
          <div className="mk-level">{leaves.map((l, k) => node(l, `L${k}`, act === 'leaf' && focus === k))}</div>
          <div className="mk-level mk-data">{data.map((d, k) => <div key={k} className="mk-data-box">块{k}<b>{d}</b></div>)}</div>
        </div>
        {done
          ? <p className="scnote">根哈希 = <b>{root}</b>。任何一个数据块被改，它的叶子→父→根都会变，根一对就露馅；而验证某个块只需 O(log n) 个兄弟哈希，不用下载全部数据。<b>区块链、Git、IPFS、BitTorrent</b> 的完整性校验全靠它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>每个数据块先算叶子哈希，相邻两个哈希拼起来再哈希成父节点，层层向上汇成一个根哈希。改任何一块，根就变。</p>}
      </div>
    </div>
  )
}
