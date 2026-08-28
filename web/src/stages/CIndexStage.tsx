/** 舞台：复合索引最左前缀+覆盖 —— idx(a,b,c) 上逐条查询判走不走索引、要不要回表 */
import type { CIndexState } from '@engine/kernels/compositeindex.ts'
import type { StageProps } from '../types.ts'

const IDX = ['a', 'b', 'c']

export function CIndexStage({ state }: StageProps<CIndexState>) {
  const { op, qi, where, select, prefix, usesIndex, covering, history, phase } = state
  const done = phase === 'done'
  const isQuery = op === 'query'

  return (
    <div className="card">
      <h3>复合索引 · 最左前缀 + 覆盖 <span className="hint">idx(a,b,c) 能被哪些查询用上、要不要回表</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{isQuery ? `Q${qi + 1}` : done ? '两规则' : 'idx(a,b,c)'}</span><span className="scdl">当前</span></div>
          <div className="scdk"><span className={`scdn ${isQuery ? (usesIndex ? 'ok' : 'miss') : ''}`}>{isQuery ? (usesIndex ? `用(${prefix.join(',')})` : '全表扫') : '—'}</span><span className="scdl">最左前缀</span></div>
          <div className="scdk"><span className={`scdn ${isQuery && usesIndex ? (covering ? 'ok' : 'miss') : ''}`}>{isQuery && usesIndex ? (covering ? '覆盖·不回表' : '要回表') : '—'}</span><span className="scdl">覆盖索引</span></div>
        </div>

        {/* 索引三列，命中前缀高亮 */}
        <div className="ci-index">
          <span className="ci-ilabel">idx</span>
          {IDX.map(col => (
            <span key={col} className={`ci-col ${isQuery && prefix.includes(col) ? 'used' : isQuery && usesIndex ? 'dim' : ''}`}>{col}</span>
          ))}
          {isQuery && !usesIndex && <span className="ci-scan">✗ 用不上 → 全表扫描</span>}
        </div>

        {isQuery && (
          <div className="ci-query">
            <span className="ci-sql"><b>WHERE</b> {where.map(c => `${c}=?`).join(' AND ') || '—'}　<b>SELECT</b> {select.join(', ')}</span>
            <div className="ci-verdicts">
              <span className={`ci-vtag ${usesIndex ? 'ok' : 'bad'}`}>{usesIndex ? `走索引 (${prefix.join(',')})` : '违反最左前缀·全表扫'}</span>
              {usesIndex && <span className={`ci-vtag ${covering ? 'ok' : 'warn'}`}>{covering ? '覆盖索引·不回表' : '非覆盖·要回表'}</span>}
            </div>
          </div>
        )}

        {/* 结果表 */}
        {history.length > 0 && (
          <div className="ci-hist">
            <div className="ci-hhead"><span>查询</span><span>用到前缀</span><span>回表?</span></div>
            {history.map((h, i) => (
              <div key={i} className={`ci-hrow ${i === qi && isQuery ? 'cur' : ''}`}>
                <span className="ci-hq">{h.label}</span>
                <span className={`ci-hp ${h.usesIndex ? 'ok' : 'bad'}`}>{h.usesIndex ? `(${h.prefix.join(',')})` : '全表扫'}</span>
                <span className={`ci-hc ${!h.usesIndex ? '' : h.covering ? 'ok' : 'warn'}`}>{!h.usesIndex ? '—' : h.covering ? '不回表' : '回表'}</span>
              </div>
            ))}
          </div>
        )}

        {done
          ? <p className="scnote"><b>最左前缀</b>：条件必须从最左列 a 起、连续；跳列或断层，后面的列就用不上——所以复合索引<b>列顺序</b>极讲究，最常用/区分度高的放左边。<b>覆盖索引</b>：SELECT 的列都在索引里就免回表。看懂这两条，就知道 EXPLAIN 里为什么有的 key=idx、有的 type=ALL——SQL 索引调优最核心的一课。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。盯索引三列：绿色是这条查询能用来定位的"最左前缀"。跳过 a 就整个用不上；SELECT 里出现索引外的列（d）就要回表。</p>}
      </div>
    </div>
  )
}
