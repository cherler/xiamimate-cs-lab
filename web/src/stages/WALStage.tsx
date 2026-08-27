/** 舞台：预写日志 WAL —— 先写日志后改数据，崩溃靠重放恢复 */
import type { WALState } from '@engine/kernels/wal.ts'
import type { StageProps } from '../types.ts'

export function WALStage({ state }: StageProps<WALState>) {
  const { data, wal, applied, act, crashed, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>预写日志 WAL <span className="hint">改数据前先写日志，崩溃能恢复</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className={`scdn ${crashed ? 'miss' : 'hot'}`}>{crashed ? '💥 宕机' : act === 'replay' ? '重放恢复' : act === 'done' ? '完成' : act === 'log' ? '写日志' : '改数据'}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">x = {data}</span><span className="scdl">数据页</span></div>
          <div className="scdk"><span className="scdn">{wal.length} / {applied}</span><span className="scdl">日志/已应用</span></div>
        </div>
        <div className="wal-cols">
          <div className="wal-log">
            <span className="cx-lbl">WAL 日志（顺序追加、先落盘）</span>
            {wal.length === 0 ? <span className="cx-gempty" style={{ fontSize: 12, color: 'var(--faint)' }}>空</span>
              : wal.map((e, i) => <div key={i} className={`wal-entry ${i < applied ? 'applied' : 'pending'}`}>{e}{i < applied ? ' ✓已应用' : ' ·待应用'}</div>)}
          </div>
          <div className={`wal-data ${crashed ? 'crashed' : ''}`}>
            <span className="cx-lbl">数据页</span>
            <div className="wal-x">x = {data}</div>
          </div>
        </div>
        {done
          ? <p className="scnote">恢复完成：x={data}，崩溃前记入日志的写全部还在。WAL 铁律「<b>先日志后数据</b>」：只要日志落了盘，哪怕数据页没刷、机器宕机，重放日志就能补上——这就是持久性(D)。顺带把随机写变顺序写、还提速。MySQL redo log、PostgreSQL WAL、etcd 都靠它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{act === 'log' ? '先把操作追加到日志并 fsync，此刻数据页还没动。' : act === 'apply' ? '日志落盘后，再慢慢改数据页。' : act === 'crash' ? '就在数据页还没改到时宕机——但日志里已经记着。' : act === 'replay' ? '重启扫日志，把记了没应用的操作重放一遍。' : '任何修改都先写日志。'}</p>}
      </div>
    </div>
  )
}
