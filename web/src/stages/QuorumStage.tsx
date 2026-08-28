/** 舞台：Quorum NWR —— 5 副本，写 W 份读 R 份，W+R>N 时读写集必重叠 */
import type { QuorumState } from '@engine/kernels/quorum.ts'
import type { StageProps } from '../types.ts'

export function QuorumStage({ state }: StageProps<QuorumState>) {
  const { op, N, W, R, reps, writeSet, readSet, overlap, readVer, readVal, phase } = state
  const done = phase === 'done'
  const ineqOk = W + R > N
  const inWrite = (i: number) => writeSet.includes(i)
  const inRead = (i: number) => readSet.includes(i)
  const isOverlap = (i: number) => overlap.includes(i)

  return (
    <div className="card">
      <h3>Quorum NWR <span className="hint">可调一致性：W+R&gt;N 保证读到最新写</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'counter' ? `${W}+2` : `${W}+${R}`} vs {N}</span><span className="scdl">W+R vs N</span></div>
          <div className="scdk"><span className={`scdn ${overlap.length ? 'ok' : op === 'counter' ? 'miss' : ''}`}>{op === 'counter' ? '无重叠' : overlap.length ? `重叠 R${overlap[0]}` : '—'}</span><span className="scdl">读写重叠</span></div>
          <div className="scdk"><span className={`scdn ${readVer === 2 ? 'ok' : readVer === 1 ? 'miss' : ''}`}>{readVer > 0 ? `v${readVer}(${readVal})` : '—'}</span><span className="scdl">读到的版本</span></div>
        </div>

        <div className="qm-knobs">
          <span className="qm-knob">N = {N}<em>副本数</em></span>
          <span className="qm-knob w">W = {op === 'counter' ? W : W}<em>写份数</em></span>
          <span className="qm-knob r">R = {op === 'counter' ? 2 : R}<em>读份数</em></span>
          <span className={`qm-ineq ${op === 'counter' ? 'bad' : ineqOk ? 'ok' : 'bad'}`}>
            W+R = {op === 'counter' ? W + 2 : W + R} {op === 'counter' ? '≤' : ineqOk ? '>' : '≤'} N={N} {op === 'counter' ? '→ 可能读到旧值' : ineqOk ? '→ 必重叠' : ''}
          </span>
        </div>

        <div className="qm-reps">
          {reps.map((rp, i) => (
            <div key={i} className={`qm-rep v${rp.ver} ${inWrite(i) ? 'w' : ''} ${inRead(i) ? 'r' : ''} ${isOverlap(i) ? 'ov' : ''}`}>
              <span className="qm-rname">R{i}</span>
              <span className="qm-rval">{rp.val}</span>
              <span className="qm-rver">v{rp.ver}</span>
              <span className="qm-rtags">
                {inWrite(i) && <i className="w">写</i>}
                {inRead(i) && <i className="r">读</i>}
              </span>
            </div>
          ))}
        </div>

        {overlap.length > 0 && op !== 'counter' && (
          <div className="qm-hit">✅ 读集里有重叠副本 R{overlap[0]}（带最新 v2）→ 读到 <b>v{readVer}（{readVal}）</b>，最新写没漏</div>
        )}
        {op === 'counter' && (
          <div className="qm-miss">✗ 读集 {'{R3,R4}'} 和写集零重叠 → 读到旧值 <b>v1（A）</b>，漏掉了新写的 B</div>
        )}

        {done
          ? <p className="scnote"><b>W+R&gt;N 保证强一致读</b>（读写集必重叠、总读到最新）。三个旋钮按需调：W 大读快写慢、R 大反之、W=R=N 最强一致但最慢、W=R=1 最快但可能读旧。这就是 Dynamo/Cassandra <b>「可调一致性」</b>——一致性和延迟之间的旋钮握在你手里。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。写只等 W 份确认、读只取 R 份里最新版本。当 W+R&gt;N，读集和写集在 N 份里必然有交集（鸽巢），那份带着最新写，读就一定不漏。</p>}
      </div>
    </div>
  )
}
