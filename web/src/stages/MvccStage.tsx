/** 舞台：MVCC 快照读 —— x 的版本链 + 两个事务各自的快照，看每次读命中哪个版本 */
import type { MvccState } from '@engine/kernels/mvcc.ts'
import type { StageProps } from '../types.ts'

const OP_LABEL: Record<string, string> = {
  '': '未开始', begin: '开始事务', read: '读 x', write: '写 x', commit: '提交', done: '完成',
}
const TX_STATUS: Record<string, string> = { idle: '未开始', active: '进行中', committed: '已提交' }

export function MvccStage({ state }: StageProps<MvccState>) {
  const { versions, txns, curTx, op, readValue, readVersion, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>MVCC 快照读 <span className="hint">写追加版本，读按快照挑版本</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{OP_LABEL[op] ?? op}{curTx ? ` · T${curTx}` : ''}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">{readValue >= 0 ? readValue : '—'}</span><span className="scdl">读到的值</span></div>
          <div className="scdk"><span className="scdn">{versions.length}</span><span className="scdl">x 的版本数</span></div>
        </div>

        {/* x 的版本链：新版本追加在右边 */}
        <div className="mvcc-chain">
          <span className="mvcc-key">x 的版本链</span>
          <div className="mvcc-vers">
            {versions.map((v, i) => {
              const cls = ['mvcc-ver', v.committed ? 'committed' : 'uncommitted', i === readVersion ? 'seen' : ''].filter(Boolean).join(' ')
              return (
                <div key={i} className={cls}>
                  <span className="mvcc-vval">{v.value}</span>
                  <span className="mvcc-vmeta">v{i} · T{v.by}{v.committed ? '✓' : ' 未提交'}</span>
                  {i === readVersion && <span className="mvcc-seen-tag">← 本次读到</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* 两个事务及其快照 */}
        <div className="mvcc-txns">
          {txns.map(t => {
            const cls = ['mvcc-tx', t.status, curTx === t.id ? 'cur' : ''].filter(Boolean).join(' ')
            return (
              <div key={t.id} className={cls}>
                <b className="mvcc-txid">T{t.id}</b>
                <span className="mvcc-txstat">{TX_STATUS[t.status]}</span>
                <span className="mvcc-snap">
                  快照 {t.snapshot.length ? `{${t.snapshot.map(x => `T${x}`).join(', ')}}` : '—'}
                </span>
              </div>
            )
          })}
        </div>

        {done
          ? <p className="scnote">招牌时刻：<b>T1 前后两次读 x 都读到 100</b>，尽管中间 T2 把它改成 200 并提交——因为 T1 用的是开始那一刻拍下的<b>快照</b>(可重复读)。写<b>追加版本</b>、读<b>挑版本</b>，读写互不阻塞，这就是 InnoDB / PostgreSQL 扛高并发的地基。</p>
          : <p className="scnote" style={{ opacity: .85 }}>
              绿色=已提交版本、灰色=未提交(只有写它的事务自己看得见)。每个事务开始时拍下一张快照(能看见哪些已提交事务)；读 x 时按自己的快照从新到旧挑第一个可见版本。
            </p>}
      </div>
    </div>
  )
}
