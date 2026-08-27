/** 舞台：Raft 共识 —— 3 个节点的角色/任期/日志，看选主 + 日志复制到多数派提交 */
import type { RaftState } from '@engine/kernels/raft.ts'
import type { StageProps } from '../types.ts'

const ROLE: Record<string, string> = { follower: 'Follower', candidate: 'Candidate', leader: 'Leader' }

export function RaftStage({ state }: StageProps<RaftState>) {
  const { nodes, term, votes, majority, committed, cur, op, msg, phase } = state
  const electing = op === 'timeout' || op === 'requestVote' || op === 'grantVote' || op === 'becomeLeader'
  return (
    <div className="card">
      <h3>Raft 共识 <span className="hint">过半票当选，日志复制到过半即提交</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{msg || (op === 'done' ? '完成' : '—')}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">{term}</span><span className="scdl">任期 term</span></div>
          {electing
            ? <div className="scdk"><span className="scdn">{votes}/{majority}</span><span className="scdl">候选人票数</span></div>
            : <div className="scdk"><span className={`scdn ${committed ? 'ok' : ''}`}>{committed}</span><span className="scdl">已提交日志</span></div>}
        </div>

        {/* 三个节点 */}
        <div className="raft-nodes">
          {nodes.map(n => (
            <div key={n.id} className={`raft-node r-${n.role} ${cur === n.id ? 'cur' : ''}`}>
              <div className="raft-head">
                <b className="raft-nid">N{n.id}</b>
                <span className={`raft-role r-${n.role}`}>{ROLE[n.role]}</span>
                <span className="raft-term">term {n.term}</span>
              </div>
              <div className="raft-log">
                {n.log.length === 0
                  ? <span className="raft-logempty">日志空</span>
                  : n.log.map((e, k) => (
                      <span key={k} className={`raft-entry ${k < committed ? 'committed' : ''}`}>
                        {e.cmd}<small>t{e.term}{k < committed ? ' ✓' : ''}</small>
                      </span>
                    ))}
              </div>
            </div>
          ))}
        </div>

        {cur === -1 && <div className="raft-client">客户端 → Leader：提交命令</div>}

        {phase === 'done'
          ? <p className="scnote">N1 靠<b>过半票</b>当选 Leader，一条日志复制到<b>多数派({majority}/3)</b>即<b>提交</b>。Raft 的灵魂是「过半」——任何两个多数派必有交集，于是永远不会有两个主、不会提交冲突日志。这就是 etcd、Consul、TiKV 底下那台共识机。</p>
          : <p className="scnote" style={{ opacity: .85 }}>
              角色：<b>Follower</b> 跟随、<b>Candidate</b> 拉票、<b>Leader</b> 主。选举要拿过半票；客户端命令只发给 Leader，复制到过半节点(≥{majority})才提交(✓)。
            </p>}
      </div>
    </div>
  )
}
