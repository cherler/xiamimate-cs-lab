/** 舞台：happens-before —— flag/data 例子，无 volatile 读到旧值、volatile 建立可见有序 */
import type { HBState } from '@engine/kernels/happensbefore.ts'
import type { StageProps } from '../types.ts'

export function HBStage({ state }: StageProps<HBState>) {
  const { act, who, data, ready, isVolatile, readerData, hazard, phase } = state
  const done = phase === 'done'
  const read0 = readerData === 0
  const read42 = readerData === 42

  return (
    <div className="card">
      <h3>happens-before · 内存可见性 <span className="hint">写了就能看见？多线程下是错觉</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{act === 'intro' ? '引入' : act === 'plain' ? '① 无 volatile' : '② volatile'}</span><span className="scdl">当前</span></div>
          <div className="scdk"><span className={`scdn ${isVolatile ? 'ok' : ''}`}>{isVolatile ? 'happens-before' : '无屏障'}</span><span className="scdl">同步</span></div>
          <div className="scdk"><span className={`scdn ${read0 ? 'miss' : read42 ? 'ok' : ''}`}>{readerData < 0 ? '—' : `读到 ${readerData}`}</span><span className="scdl">reader 读 data</span></div>
        </div>

        {/* 共享内存 */}
        <div className="hb-mem">
          <span className="hb-mlbl">共享内存</span>
          <span className={`hb-var ${who === 'writer' && data === 42 ? 'set' : ''}`}>data = <b>{data}</b></span>
          <span className={`hb-var ${ready ? 'set' : ''} ${isVolatile ? 'vol' : ''}`}>{isVolatile ? 'volatile ' : ''}ready = <b>{String(ready)}</b></span>
        </div>

        {/* 两线程 */}
        <div className="hb-threads">
          <div className={`hb-thread ${who === 'writer' ? 'on' : ''}`}>
            <span className="hb-tname">✍ Writer</span>
            <span className={`hb-op ${data === 42 ? 'done' : ''}`}>1. data = 42</span>
            <span className={`hb-op ${ready ? 'done' : ''} ${hazard && who === 'writer' ? 'hazard' : ''}`}>2. ready = true{isVolatile ? ' (释放屏障)' : ''}</span>
          </div>
          <div className={`hb-thread ${who === 'reader' ? 'on' : ''}`}>
            <span className="hb-tname">👁 Reader</span>
            <span className={`hb-op ${ready && who === 'reader' ? 'done' : ''}`}>3. while(!ready){isVolatile ? ' (获取屏障)' : ''}</span>
            <span className={`hb-op ${readerData >= 0 ? (read0 ? 'bad' : 'done') : ''}`}>4. read data → {readerData < 0 ? '?' : readerData}</span>
          </div>
        </div>

        {read0 && <div className="hb-alert bad">✗ 看到 ready=true 却读到 data=<b>0</b>（旧值）——ready 先被看见/重排，data=42 还没同步。偶发、极难查的可见性 bug。</div>}
        {read42 && <div className="hb-alert ok">✓ happens-before 保证：data=42 先于 reader 读 data → 必读到 <b>42</b>。</div>}

        {done
          ? <p className="scnote">多线程下"写了就能看见"是错觉——编译器/CPU 会重排、值会滞留缓存。要靠 <b>happens-before</b> 才有可见性 + 有序性：volatile、synchronized/锁、final、线程 start/join、原子类都能建立它。这就是 Java 内存模型(JMM) 的核心，也是"为什么加个 volatile 就好了"的原理。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。盯 reader 第 4 步读到什么：无 volatile 时 ready 和 data 的顺序对 reader 不保证，可能读到 data=0；加 volatile 建立 happens-before 后，data=42 一定先于 reader 读到，必是 42。</p>}
      </div>
    </div>
  )
}
