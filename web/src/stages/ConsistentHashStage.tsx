/** 舞台：一致性哈希 —— 环(0..99)上的节点与键，加节点只搬少量键 */
import type { ConsistentHashState } from '@engine/kernels/consistenthash.ts'
import type { StageProps } from '../types.ts'

export function ConsistentHashStage({ state }: StageProps<ConsistentHashState>) {
  const { ring, nodes, keys, cur, act, remapped, phase } = state
  const done = phase === 'done'
  const pct = (p: number) => `${(p / ring) * 100}%`
  return (
    <div className="card">
      <h3>一致性哈希 <span className="hint">键归顺时针最近节点；加节点只搬一小段</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{nodes.length} 节点</span><span className="scdl">环上节点</span></div>
          <div className="scdk"><span className="scdn">{act === 'addnode' ? '新增 D' : act === 'remap' ? '重新归属' : act === 'assign' ? `分配 ${cur}` : act === 'done' ? '完成' : '布置'}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className={`scdn ${remapped ? 'ok' : ''}`}>{remapped || '—'}</span><span className="scdl">本步搬动的键</span></div>
        </div>
        {/* 环用一条 0..99 的线表示 */}
        <div className="ch-ring">
          {nodes.map(n => (
            <div key={n.id} className={`ch-node ${cur === n.id ? 'cur' : ''}`} style={{ left: pct(n.pos) }}>
              <span className="ch-node-dot" /><span className="ch-node-id">{n.id}</span><span className="ch-node-pos">@{n.pos}</span>
            </div>
          ))}
          {keys.map(k => (
            <div key={k.id} className={`ch-key ${cur === k.id ? 'cur' : ''} ${remapped === k.id ? 'moved' : ''}`} style={{ left: pct(k.pos) }}>
              <span className="ch-key-id">{k.id}</span><span className="ch-key-node">→{k.node}</span>
            </div>
          ))}
          <div className="ch-axis"><span>0</span><span>环 (0..{ring - 1})</span><span>{ring - 1}</span></div>
        </div>
        {done
          ? <p className="scnote">加入节点 D 后，4 个键里<b>只有 1 个（{keys.find(k => k.id === 'k2')?.id}）</b>需要搬。对比 hash%N——N 从 3 变 4，几乎所有键归属都变、缓存全体失效。一致性哈希把扩容/宕机的数据搬动降到最小，是 <b>Redis Cluster、Cassandra、CDN</b> 分片的地基。</p>
          : <p className="scnote" style={{ opacity: .85 }}>节点和键都哈希到环上。每个键归给<b>顺时针方向第一个节点</b>（超过最后一个就绕回环首）。加节点只影响它到前一个节点之间的那段键。</p>}
      </div>
    </div>
  )
}
