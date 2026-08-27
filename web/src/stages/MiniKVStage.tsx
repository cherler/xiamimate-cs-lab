/** 舞台：迷你 KV 存储 —— WAL/memtable/SSTable/布隆 五个零件一屏看协同 */
import type { MiniKVState } from '@engine/kernels/minikv.ts'
import type { StageProps } from '../types.ts'

export function MiniKVStage({ state }: StageProps<MiniKVState>) {
  const { wal, memtable, sstables, bloom, op, key, val, result, bloomHit, foundIn, phase } = state
  const done = phase === 'done'
  const isGet = op === 'get'
  return (
    <div className="card">
      <h3>迷你 KV 存储 <span className="hint">WAL+跳表+LSM+布隆 拼成一个数据库</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'put' ? `put(${key},${val})` : op === 'get' ? `get(${key})` : op === 'flush' ? '刷盘' : '完成'}</span><span className="scdl">本步操作</span></div>
          <div className="scdk"><span className="scdn">{isGet ? (bloomHit ? `查:${foundIn}` : '布隆挡下') : `WAL ${wal.length}条`}</span><span className="scdl">路径</span></div>
          <div className="scdk"><span className={`scdn ${isGet && result ? (result === '不存在' ? 'miss' : 'ok') : ''}`}>{isGet ? result : '—'}</span><span className="scdl">get 结果</span></div>
        </div>

        <div className="kv-grid">
          <div className="kv-comp"><span className="kv-lbl">① WAL 日志<em>持久</em></span>
            <div className="kv-list">{wal.length ? wal.slice(-3).map((e, i) => <span key={i} className="kv-item mono">{e}</span>) : <span className="kv-empty">空</span>}</div>
          </div>
          <div className={`kv-comp ${op === 'put' ? 'active' : ''}`}><span className="kv-lbl">② memtable<em>跳表·内存</em></span>
            <div className="kv-list">{memtable.length ? memtable.map(([k, v]) => <span key={k} className="kv-item">{k}={v}</span>) : <span className="kv-empty">空</span>}</div>
          </div>
          <div className={`kv-comp ${op === 'flush' ? 'active' : ''}`}><span className="kv-lbl">③ SSTable<em>LSM·磁盘</em></span>
            <div className="kv-list">{sstables.length ? sstables.map((s, i) => <span key={i} className="kv-item sst">SST{i + 1}:[{s.map(e => e[0]).join(',')}]</span>) : <span className="kv-empty">空</span>}</div>
          </div>
          <div className={`kv-comp ${isGet ? 'active' : ''}`}><span className="kv-lbl">④ 布隆过滤器<em>读加速</em></span>
            <div className="kv-list">
              <span className="kv-item">{bloom.join(' ')}</span>
              {isGet && <span className={`kv-bloom ${bloomHit ? 'hit' : 'block'}`}>{bloomHit ? `"${key}"可能在→查盘` : `"${key}"一定不在→挡下`}</span>}
            </div>
          </div>
        </div>

        {done
          ? <p className="scnote">一条 put/get 流水把五个零件咬合起来——WAL 保证不丢、memtable(跳表)吃写、LSM 顺序刷盘、布隆挡住不存在的键、（多机时）一致性哈希分片。这就是 <b>LevelDB/RocksDB 的骨架</b>。<b>面试讲这个项目</b>：写路径为什么快（内存+顺序刷）、读路径为什么用布隆（挡无效磁盘查）、WAL 怎么保证持久——一套讲下来，"懂原理"就变成了"造过系统"。</p>
          : <p className="scnote" style={{ opacity: .85 }}>
              写：先写 WAL（持久）→ 进 memtable → 满了刷成 SSTable、键入布隆。读：先问布隆（说"不在"就不查盘）→ 查 memtable → 从新到旧查 SSTable。这五个零件你都单独学过，这里看它们怎么组成一个真数据库。
            </p>}
      </div>
    </div>
  )
}
