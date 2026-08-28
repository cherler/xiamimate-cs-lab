/** 舞台：Snowflake —— 64 位切三段(时间/机器/序号)，逐个生成看 ID 怎么拼、怎么递增 */
import type { SnowflakeState } from '@engine/kernels/snowflake.ts'
import type { StageProps } from '../types.ts'

const bin = (n: number, w: number) => n.toString(2).padStart(w, '0')

export function SnowflakeStage({ state }: StageProps<SnowflakeState>) {
  const { op, t, machine, dc, worker, seq, id, ids, phase } = state
  const done = phase === 'done'
  const has = op !== 'intro'

  return (
    <div className="card">
      <h3>Snowflake 分布式 ID <span className="hint">64 位 = 时间戳 + 机器码 + 序号，各机自己拼、全局唯一</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{has ? `${t}ms` : '布局'}</span><span className="scdl">时间戳</span></div>
          <div className="scdk"><span className="scdn">{has ? `#${seq}` : `机器${machine}`}</span><span className="scdl">{has ? '毫秒内序号' : '机器码'}</span></div>
          <div className="scdk"><span className={`scdn ${op === 'same' ? 'ok' : op === 'next' ? 'ok' : ''}`}>{has ? id : '—'}</span><span className="scdl">生成的 ID</span></div>
        </div>

        {/* 位布局：三段 */}
        <div className="sf-layout">
          <div className="sf-seg sign"><span className="sf-w">1</span><span className="sf-v">0</span><span className="sf-n">符号</span></div>
          <div className={`sf-seg ts ${op === 'next' ? 'chg' : ''}`}><span className="sf-w">41 位</span><span className="sf-v">{has ? t : '时间戳'}</span><span className="sf-n">毫秒时间戳</span></div>
          <div className="sf-seg mc"><span className="sf-w">10 位</span><span className="sf-v mono">{bin(machine, 10)}</span><span className="sf-n">机器码 dc{dc}·w{worker}</span></div>
          <div className={`sf-seg sq ${op === 'same' ? 'chg' : ''}`}><span className="sf-w">12 位</span><span className="sf-v mono">{has ? bin(seq, 12) : '序号'}</span><span className="sf-n">毫秒内序号</span></div>
        </div>

        {has && (
          <div className="sf-calc mono">
            ID = {t}×2²² + {machine}×2¹² + {seq} = <b>{id}</b>
          </div>
        )}

        {/* 生成历史 */}
        {ids.length > 0 && (
          <div className="sf-hist">
            <span className="sf-hcap">已发 ID</span>
            {ids.map((x, i) => (
              <span key={i} className={`sf-hitem ${i === ids.length - 1 ? 'cur' : ''} ${i > 0 && ids[i - 1]!.t === x.t ? 'seqchain' : ''}`}>
                <i>t{x.t}·#{x.seq}</i><b>{x.id}</b>
              </span>
            ))}
          </div>
        )}

        {done
          ? <p className="scnote"><b>全局唯一</b>（机器码不同→不同机器绝不相撞，零协调）+ <b>趋势递增</b>（时间戳在高位→越晚越大，对 B+树索引友好）+ <b>高吞吐</b>（本地生成，4096 个/毫秒/机）。<b>要防时钟回拨</b>：ID 靠"时间戳只增"，机器时钟往回跳会生成重复 ID——实现里要检测回拨、拒发或等待。微博 Snowflake、美团 Leaf、百度 UidGenerator 都是这套。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。三段拼一个 64 位整数：时间戳在高位保证递增、机器码保证不同机不撞、序号保证同毫秒不撞。看同一毫秒里 ID 只 +1、跨毫秒序号归零而 ID 跳一大截。</p>}
      </div>
    </div>
  )
}
