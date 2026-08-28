/** 舞台：缓冲池 midpoint-LRU —— young|中点|old 两段，扫描页只进 old、热点毫发无损 */
import type { BufPoolState } from '@engine/kernels/bufferpool.ts'
import type { StageProps } from '../types.ts'

export function BufferPoolStage({ state }: StageProps<BufPoolState>) {
  const { op, young, old, loaded, evicted, scanned, phase } = state
  const done = phase === 'done'
  const scanning = op === 'scan'

  return (
    <div className="card">
      <h3>缓冲池 midpoint-LRU <span className="hint">全表扫描冲不掉热点页（MySQL InnoDB）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'intro' ? '看问题' : op === 'init' ? '初始' : scanning ? `装载 ${loaded}` : '扫描完'}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className={`scdn ${scanning ? 'miss' : ''}`}>{scanning ? `淘汰 ${evicted}` : `已扫 ${scanned.length}`}</span><span className="scdl">{scanning ? 'old 尾淘汰' : '扫描页'}</span></div>
          <div className="scdk"><span className={`scdn ${done ? 'ok' : ''}`}>[{young.join(',')}]</span><span className="scdl">young 热点</span></div>
        </div>

        {/* LRU 链：young | 中点 | old */}
        <div className="bfp-lru">
          <div className="bfp-seg young">
            <span className="bfp-slbl">young 热区</span>
            <div className="bfp-chips">
              {young.map(p => <span key={p} className="bfp-chip hot">{p}</span>)}
            </div>
          </div>
          <div className="bfp-mid"><span>中点</span><i>新页从这进 ↓</i></div>
          <div className="bfp-seg old">
            <span className="bfp-slbl">old 冷区</span>
            <div className="bfp-chips">
              {old.map((p, i) => <span key={p} className={`bfp-chip cold ${loaded === p && i === 0 ? 'new' : ''}`}>{p}</span>)}
              {scanning && <span className="bfp-evicted">↦ 淘汰 {evicted}</span>}
            </div>
          </div>
        </div>

        {scanning && (
          <div className="bfp-note">扫描页 <b>{loaded}</b> 插到中点（old 头，不碰 young）、只用一次、没升 young → 很快从 old 尾淘汰。<b>young 热点没动。</b></div>
        )}
        {done && (
          <div className="bfp-note ok">✓ 扫描 {scanned.join('/')} 全在 old 段进出，<b>young 热点 [{young.join(',')}] 毫发无损</b>。普通 LRU 早把它们挤没了。</div>
        )}

        {done
          ? <p className="scnote"><b>midpoint 插入 + "二次访问才升 young"</b>，让一次性的扫描页进不了热区，保护真正被反复访问的热点。这就是 innodb_old_blocks_pct（old 段占比）和 innodb_old_blocks_time（升 young 的时间窗）背后的机制。面试讲：普通 LRU 的扫描污染、midpoint 怎么解、和 LRU-K / 2Q 思想相通。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。LRU 链分两段：young 是热点区、old 是冷区，交界是"中点"。全表扫描的页从中点进 old、用一次就没人再碰、从 old 尾淘汰——全程<b>碰不到 young</b>，所以热点不会被扫描冲走。</p>}
      </div>
    </div>
  )
}
