/** 舞台：死锁检测 —— 三个线程持有/等待锁，等待图一步步长出环 → 死锁 */
import type { DeadlockState } from '@engine/kernels/deadlock.ts'
import type { StageProps } from '../types.ts'

const OP_LABEL: Record<string, string> = { '': '未开始', acquire: '加锁', request: '申请(阻塞)', done: '完成' }

export function DeadlockStage({ state }: StageProps<DeadlockState>) {
  const { threads, cur, op, waitFor, deadlock, cycle, phase } = state
  const inCycle = (id: number) => cycle.includes(id)
  return (
    <div className="card">
      <h3>死锁检测 <span className="hint">等待图成环 = 死锁</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{OP_LABEL[op] ?? op}{cur ? ` · T${cur}` : ''}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">{waitFor.length}</span><span className="scdl">等待边</span></div>
          <div className="scdk"><span className={`scdn ${deadlock ? 'miss' : ''}`}>{deadlock ? '死锁' : '正常'}</span><span className="scdl">状态</span></div>
        </div>

        {/* 三个线程：持有 / 等待 */}
        <div className="dl-threads">
          {threads.map(t => (
            <div key={t.id} className={`dl-th ${inCycle(t.id) ? 'incycle' : ''} ${t.blocked ? 'blocked' : ''} ${cur === t.id ? 'cur' : ''}`}>
              <b className="dl-tid">T{t.id}</b>
              <span className="dl-hold">持有 {t.holds.length ? t.holds.join('、') : '—'}</span>
              <span className="dl-want">等待 {t.wants || '—'}</span>
            </div>
          ))}
        </div>

        {/* 等待图的边 */}
        <div className="dl-graph">
          <span className="dl-glbl">等待图</span>
          {waitFor.length === 0
            ? <span className="dl-gempty">还没有等待边</span>
            : <div className="dl-edges">
                {waitFor.map(([u, v], i) => (
                  <span key={i} className={`dl-edge ${inCycle(u) && inCycle(v) ? 'incycle' : ''}`}>T{u}→T{v}</span>
                ))}
              </div>}
        </div>

        {deadlock && (
          <div className="dl-banner">🔴 循环等待 T{[...cycle, cycle[0]].join('→')} —— {cycle.length} 个线程首尾相等，<b>检测到死锁</b>！</div>
        )}

        {phase === 'done'
          ? <p className="scnote">死锁的本质就是等待图里的<b>循环等待</b>：环上 {cycle.length || 0} 个线程各攥着一把锁、又都在等下一个人手里的锁，谁也不肯放、谁也进不去。破掉这个环最实用的办法是<b>所有线程按固定顺序加锁</b>（就不会出现反向边），这也是死锁四条件里最好打破的一条。</p>
          : <p className="scnote" style={{ opacity: .85 }}>
              节点=线程，边 T<i>i</i>→T<i>j</i> 表示「T<i>i</i> 正等着一把被 T<i>j</i> 攥着的锁」。加锁成功就持有；要一把别人攥着的锁就阻塞、加一条等待边。等待图一旦<b>成环</b>就是死锁。
            </p>}
      </div>
    </div>
  )
}
