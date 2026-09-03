/** 舞台：自注意力 —— 查询→键 注意力连线 + 注意力矩阵热力图 + Q·K→softmax→加权和 */
import type { AttnState } from '@engine/kernels/attention.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function AttentionStage({ state }: StageProps<AttnState>) {
  const { tokens, qi, scores, attn, phase } = state
  const w = qi >= 0 ? attn[qi] : []
  const showW = w.length > 0                     // softmax 之后才有权重
  const topKey = showW ? w.indexOf(Math.max(...w)) : -1

  return (
    <div className="card">
      <h3>自注意力 <span className="hint">每个查询 token 关注全句，按权重汇总信息</span></h3>
      <div className="body">
        {/* 左=查询列 · 中=注意力矩阵 · 右=键/值列（三栏并排，矩阵坐正中间）*/}
        <div className="atrow">
          <div className="atside">
            <div className="atlabel">查询</div>
            {tokens.map((t, i) => (
              <div key={i} className={`attok q ${i === qi ? 'cur' : ''}`}>{t}</div>
            ))}
          </div>

          <div className="atmatwrap">
            <div className="atsect">注意力矩阵 <span className="atcap">行=查询 · 列=键 · 深浅=权重</span></div>
            <table className="atmat">
              <thead><tr><th></th>{tokens.map((t, j) => <th key={j}>{t}</th>)}</tr></thead>
              <tbody>
                {tokens.map((tq, i) => (
                  <tr key={i} className={i === qi ? 'cur' : ''}>
                    <th>{tq}</th>
                    {tokens.map((_, j) => {
                      const filled = attn[i].length > 0
                      const v = filled ? attn[i][j] : 0
                      // 当前查询行用琥珀热(=「当前」语义色)，其余行用蓝热；当前行的最大权重格加琥珀环
                      const heat = i === qi ? 'var(--now)' : 'var(--f-tag)'
                      const isPeak = i === qi && filled && j === topKey
                      return (
                        <td key={j} className={`${filled ? '' : 'empty'} ${isPeak ? 'peak' : ''}`}
                          style={filled ? { background: `color-mix(in srgb, ${heat} ${Math.round(v * 90)}%, transparent)`, color: v > 0.55 ? '#fff' : 'var(--ink)' } : undefined}>
                          {filled ? `${(v * 100).toFixed(0)}` : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="atside">
            <div className="atlabel">键 / 值</div>
            {tokens.map((t, j) => (
              <div key={j} className={`attok k ${j === topKey ? 'top' : ''}`}>{t}
                {showW && <span className="atw">{(w[j] * 100).toFixed(0)}%</span>}
              </div>
            ))}
          </div>
        </div>

        {/* 当前查询的算式：分数 → softmax → 加权和 */}
        {qi >= 0 && (
          <div className="atcalc">
            <span className="atck">「{tokens[qi]}」</span>
            <span className="atcstep">分数 Q·K/√d<b>[{scores.map(x => x.toFixed(1)).join(' ')}]</b></span>
            {showW && <><span className="atarr">→</span><span className="atcstep hit">softmax<b>[{w.map(x => (x * 100).toFixed(0) + '%').join(' ')}]</b></span></>}
            {phase === 'sum' && state.out.length > 0 && <><span className="atarr">→</span><span className="atcstep out">加权和 V<b>[{state.out.map(x => x.toFixed(1)).join(' ')}]</b></span></>}
          </div>
        )}

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
