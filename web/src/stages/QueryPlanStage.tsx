/** 舞台：执行计划 —— 候选访问路径 + 估扫描行数代价条，优化器选最省，输出 EXPLAIN */
import type { QPlanState } from '@engine/kernels/queryplan.ts'
import type { StageProps } from '../types.ts'

const TYPE_TONE: Record<string, string> = { ALL: 'bad', ref: 'good', range: '' }

export function QueryPlanStage({ state }: StageProps<QPlanState>) {
  const { op, query, paths, revealed, cur, chosen, phase } = state
  const done = phase === 'done'
  const maxRows = Math.max(...paths.map(p => p.rows), 1)

  return (
    <div className="card">
      <h3>执行计划 · 优化器选路 <span className="hint">按"估扫多少行"选访问路径（读懂 EXPLAIN）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'intro' ? '看查询' : done ? '选定' : `候选 ${cur + 1}`}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">{revealed}/{paths.length}</span><span className="scdl">候选路径</span></div>
          <div className="scdk"><span className={`scdn ${done ? 'ok' : ''}`}>{done ? `${paths[chosen]!.rows} 行` : cur >= 0 ? `${paths[cur].rows} 行` : '—'}</span><span className="scdl">估扫描</span></div>
        </div>

        <div className="qp-query"><span className="qp-qlbl">SQL</span> <code>{query}</code></div>

        <div className="qp-paths">
          {paths.slice(0, revealed).map((p, idx) => (
            <div key={idx} className={`qp-path ${idx === cur && !done ? 'cur' : ''} ${done && idx === chosen ? 'chosen' : ''} ${done && idx !== chosen ? 'dim' : ''}`}>
              <span className="qp-pname">{p.name}</span>
              <span className={`qp-type ${TYPE_TONE[p.type] ?? ''}`}>type={p.type}</span>
              <span className="qp-bar"><i style={{ width: `${(p.rows / maxRows) * 100}%` }} /></span>
              <span className="qp-rows">{p.rows} 行</span>
              {done && idx === chosen && <span className="qp-pick">✓ 选它</span>}
            </div>
          ))}
        </div>

        {cur >= 0 && !done && <div className="qp-note">{paths[cur].note}</div>}

        {done && (
          <div className="qp-explain">
            <span className="qp-elbl">EXPLAIN 结果</span>
            <div className="qp-erow"><span>type</span><b className={TYPE_TONE[paths[chosen]!.type] === 'good' ? 'ok' : ''}>{paths[chosen]!.type}</b></div>
            <div className="qp-erow"><span>key</span><b>{paths[chosen]!.key}</b></div>
            <div className="qp-erow"><span>rows</span><b>≈{paths[chosen]!.rows}</b></div>
          </div>
        )}

        {done
          ? <p className="scnote">优化器不看"哪个索引最新"，而是<b>估代价（扫多少行）选最省的</b>。读懂 EXPLAIN：<b>type</b>（ALL 全表扫=危险 / ref 等值索引 / range 范围索引）、<b>key</b>（实际用哪个索引）、<b>rows</b>（估扫描行数）。"建了索引却不走"往往是优化器算出走索引反而更贵（命中太多、回表成本高），或<b>统计信息过期</b>估错。面试讲：CBO 怎么估代价、type 各档、索引失效原因、用 EXPLAIN 调优。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。同一个查询有多条访问路径：全表扫描要扫最多行；走某个索引先命中一部分、再回表过滤剩下的条件。优化器估每条要扫多少行，选行数最少（代价最低）的那条。</p>}
      </div>
    </div>
  )
}
