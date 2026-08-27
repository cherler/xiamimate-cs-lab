/** 舞台：LSM-Tree —— 写进内存表，满了整块刷成 SSTable */
import type { LSMState } from '@engine/kernels/lsm.ts'
import type { StageProps } from '../types.ts'

export function LSMStage({ state }: StageProps<LSMState>) {
  const { cap, memtable, sstables, cur, act, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>LSM-Tree <span className="hint">写进内存、批量顺序刷盘，写吞吐暴涨</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{act === 'flush' ? '刷盘' : act === 'write' ? `写 ${cur}` : '完成'}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">{memtable.length}/{cap}</span><span className="scdl">memtable</span></div>
          <div className="scdk"><span className="scdn">{sstables.length}</span><span className="scdl">SSTable 数</span></div>
        </div>
        <div className="lsm-mem">
          <span className="cx-lbl">memtable（内存·有序·极快）</span>
          <div className="lsm-slots">
            {Array.from({ length: cap }, (_, k) => <span key={k} className={`lsm-slot ${k < memtable.length ? 'on' : ''}`}>{memtable[k] ?? ''}</span>)}
          </div>
        </div>
        <div className="lsm-disk">
          <span className="cx-lbl">磁盘 · 不可变 SSTable（顺序写）</span>
          <div className="lsm-ssts">
            {sstables.length === 0 ? <span style={{ fontSize: 12, color: 'var(--faint)' }}>还没刷盘</span>
              : sstables.map((s, k) => <div key={k} className="lsm-sst"><b>SST{k + 1}</b><span>[{s.join(',')}]</span></div>)}
          </div>
        </div>
        {done
          ? <p className="scnote">{sstables.length} 个 SSTable 落盘 + memtable 剩 [{memtable.join(',')}]。LSM 把随机写换成「<b>内存收集 + 整块顺序刷</b>」，写吞吐暴涨——这就是 LevelDB/RocksDB/Cassandra 写得快的原因。代价：读要从新到旧查各层（布隆过滤器加速），后台还要归并压实（compaction）去旧值。写多读少是它的主场。</p>
          : <p className="scnote" style={{ opacity: .85 }}>写入直接进内存表 memtable（不去改磁盘 B+树那种随机写）。memtable 满了就整块顺序写成一个不可变 SSTable，然后清空重新收。</p>}
      </div>
    </div>
  )
}
