/** 舞台：事务隔离级别 —— T1 三次读的值序列 + 每次读的现象标签，切 level 看现象出现/消失 */
import type { IsoState } from '@engine/kernels/iso.ts'
import type { StageProps } from '../types.ts'

const OP_LABEL: Record<string, string> = {
  '': '未开始', begin: '开始', read: '读 x', write: '写 x', commit: '提交', done: '完成',
}
const isBad = (a: string) => a === '脏读' || a === '不可重复读'

export function IsoStage({ state }: StageProps<IsoState>) {
  const { level, committedX, uncommittedX, hasUncommitted, curTx, op, anomaly, reads, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>事务隔离级别 <span className="hint">切级别，看「读现象」出现或消失</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{level}</span><span className="scdl">隔离级别</span></div>
          <div className="scdk"><span className="scdn">{OP_LABEL[op] ?? op}{curTx ? ` · T${curTx}` : ''}</span><span className="scdl">本步</span></div>
          <div className="scdk">
            <span className={`scdn ${isBad(anomaly) ? 'miss' : ''}`}>{anomaly || '—'}</span>
            <span className="scdl">本次现象</span>
          </div>
        </div>

        {/* x 的当前状态 */}
        <div className="iso-x">
          <span className="iso-x-lbl">x</span>
          <span className="iso-x-val committed">已提交 {committedX}</span>
          {hasUncommitted && <span className="iso-x-val uncommitted">未提交 {uncommittedX}（T2）</span>}
        </div>

        {/* T1 读到的值序列 */}
        <div className="iso-reads">
          <span className="iso-lbl">T1 依次读到</span>
          <div className="iso-seq">
            {reads.length === 0 && <span className="iso-empty">还没读</span>}
            {reads.map((r, i) => (
              <div key={i} className={`iso-read ${isBad(r.a) ? 'bad' : r.a === '正常' ? 'ok' : 'base'}`}>
                <span className="iso-rv">{r.v}</span>
                <span className="iso-ra">{r.a}</span>
              </div>
            ))}
          </div>
        </div>

        {done
          ? <p className="scnote">
              同一段并发调度，<b>隔离级别越高，挡掉的读现象越多</b>：读未提交挡不住脏读；读已提交挡住脏读、挡不住不可重复读；可重复读(MySQL 默认)两个都挡住。代价是级别越高并发越低——这就是那张「级别 × 现象」表背后的机制。改上面的<b>隔离级别</b>参数，看现象即刻出现或消失。
            </p>
          : <p className="scnote" style={{ opacity: .85 }}>
              红色=读出了异常（脏读/不可重复读），绿色=一致。T1 在事务里读同一行 x 三次；中间 T2 改了 x 并提交。当前级别 <b>{level}</b> 决定 T1 每次读到什么。
            </p>}
      </div>
    </div>
  )
}
