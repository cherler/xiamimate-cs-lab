/** 舞台：CAS 无锁自增 —— 共享 x + 3 个线程的本地值/状态，看竞争→失败→重试 */
import type { CasState } from '@engine/kernels/cas.ts'
import type { StageProps } from '../types.ts'

const STATUS: Record<string, string> = {
  idle: '待命', read: '已读取', won: '✓ 写入成功', retry: '✗ 被抢先·重试', done: '完成',
}

export function CasStage({ state }: StageProps<CasState>) {
  const { x, threads, cur, op, expected, next, casOk, fails, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>CAS 无锁自增 <span className="hint">读到旧值就 CAS，被抢先就重试</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{x}</span><span className="scdl">共享 x</span></div>
          <div className="scdk"><span className="scdn">{op === 'read' ? `T${cur} 读` : op === 'cas' ? `T${cur} CAS` : op === 'done' ? '完成' : '—'}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className={`scdn ${fails ? 'miss' : ''}`}>{fails}</span><span className="scdl">失败重试</span></div>
        </div>

        {/* 共享变量 */}
        <div className="cas-shared">
          <span className="cas-shared-lbl">内存里的 x</span>
          <span className="cas-shared-val">{x}</span>
        </div>

        {/* 当前 CAS 尝试 */}
        {op === 'cas' && (
          <div className={`cas-attempt ${casOk ? 'ok' : 'fail'}`}>
            T{cur}：CAS(期望 <b>{expected}</b> → 新值 <b>{next}</b>) &nbsp;比一比&nbsp; 内存 x=<b>{x}</b>
            &nbsp;→&nbsp;{casOk ? '相等，写入成功 ✓' : '不等，失败，得重读 ✗'}
          </div>
        )}

        {/* 三个线程 */}
        <div className="cas-threads">
          {threads.map(t => {
            const cls = ['cas-th', t.status, cur === t.id ? 'cur' : ''].filter(Boolean).join(' ')
            return (
              <div key={t.id} className={cls}>
                <b className="cas-tid">T{t.id}</b>
                <span className="cas-local">本地读到 {t.local >= 0 ? t.local : '—'}</span>
                <span className="cas-st">{STATUS[t.status]}</span>
              </div>
            )
          })}
        </div>

        {done
          ? <p className="scnote">T1、T2 都读到过 x=0 想写 1，但 CAS 让先到的赢、后到的<b>失败重试</b>——三个 ++ 一个没丢，最终 <b>x={x}</b>（不是丢更新后的 2）。代价是失败线程自旋重试了 <b>{fails}</b> 次。这条原子指令换掉了锁，是 AtomicInteger、自旋锁、无锁队列的地基。</p>
          : <p className="scnote" style={{ opacity: .85 }}>
              每个线程先把 x 读进本地，再 CAS(期望=读到的值 → 新值+1)。只有内存 x 仍等于期望值时才写得进；否则说明被别人抢先了，失败、重读、再试。绿=写入成功，红=失败重试。
            </p>}
      </div>
    </div>
  )
}
