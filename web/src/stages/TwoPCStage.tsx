/** 舞台：两阶段提交 —— 协调者两阶段，参与者状态推进 */
import type { TwoPCState } from '@engine/kernels/twopc.ts'
import type { StageProps } from '../types.ts'

const ST: Record<string, string> = { idle: '空闲', prepared: 'Yes·已准备', committed: '已提交' }

export function TwoPCStage({ state }: StageProps<TwoPCState>) {
  const { parts, coord, cur, yesVotes, decision, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>两阶段提交 2PC <span className="hint">先问「能提交吗」，都答能才真提交</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{coord || '就绪'}</span><span className="scdl">协调者</span></div>
          <div className="scdk"><span className="scdn">{yesVotes}/3</span><span className="scdl">Yes 票</span></div>
          <div className="scdk"><span className={`scdn ${decision === 'commit' ? 'ok' : decision === 'abort' ? 'miss' : ''}`}>{decision || '未决'}</span><span className="scdl">决定</span></div>
        </div>
        <div className="pc-coord">协调者 Coordinator</div>
        <div className="pc-parts">
          {parts.map(p => (
            <div key={p.id} className={`pc-part s-${p.state} ${cur === p.id ? 'cur' : ''}`}>
              <b className="pc-pid">{p.id}</b>
              <span className="pc-pstate">{ST[p.state]}</span>
            </div>
          ))}
        </div>
        {done
          ? <p className="scnote">3 个参与者一起提交，<b>原子性达成</b>（要么全成、要么全败）。2PC 的硬伤：参与者投 Yes 后就<b>锁着资源等</b>，若协调者在阶段二宕机，它们会一直阻塞——这也是 3PC、以及 Raft/Paxos 更抗故障的原因。分布式事务、XA、TCC 的底子都是它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>阶段一（投票）：协调者发 Prepare，参与者干到就差落盘、锁资源，回 Yes/No。阶段二（提交）：全 Yes 才 Commit，只要有一个 No 或超时就全体 Abort。</p>}
      </div>
    </div>
  )
}
