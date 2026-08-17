/** 舞台：海明码 —— 位号覆盖图 + 校验分组 */
import type { HammingState } from '@engine/kernels/hamming.ts'
import type { StageProps } from '../types.ts'

export function HammingStage({ doc, trace, index, state, tab }: StageProps<HammingState>) {
  if (tab === 'groups') return <Groups trace={trace} state={state} />
  return <Code state={state} />
}

const isParity = (pos: number) => (pos & (pos - 1)) === 0

/**
 * 码字视图：校验位与数据位分色，位号的二进制单列出来 ——
 * 「为什么校验子等于出错位号」的答案就写在那一列里。
 */
function Code({ state }: { state: HammingState }) {
  const n = state.bits.length
  const width = Math.max(...Array.from({ length: n }, (_, k) => (k + 1).toString(2).length))
  const hot = new Set(state.touched)
  const covers = new Set(state.covers)

  return (
    <div className="card">
      <h3>码字与位号 <span className="hint">P 位放在 1、2、4、8… 这些 2 的幂次位</span></h3>
      <div className="body scroll">
        <div className="hgrid" style={{ ['--n' as string]: n }}>
          <div className="hrow">
            <span className="hlab">位号</span>
            {Array.from({ length: n }, (_, k) => (
              <span key={k} className={`hcell num ${hot.has(k) ? 'hot' : ''}`}>{k + 1}</span>
            ))}
          </div>
          <div className="hrow">
            <span className="hlab">名称</span>
            {Array.from({ length: n }, (_, k) => (
              <span key={k} className={`hcell name ${isParity(k + 1) ? 'p' : 'd'}`}>
                {isParity(k + 1) ? `P${k + 1}` : 'D'}
              </span>
            ))}
          </div>
          <div className="hrow">
            <span className="hlab">码字</span>
            {state.bits.split('').map((b, k) => (
              <span key={k}
                className={`hcell bit ${isParity(k + 1) ? 'p' : 'd'} ${hot.has(k) ? 'hot' : ''} ${covers.has(k + 1) ? 'cov' : ''} ${b === '?' ? 'unk' : ''}`}
              >{b}</span>
            ))}
          </div>
          <div className="hrow bin">
            <span className="hlab">位号二进制</span>
            {Array.from({ length: n }, (_, k) => {
              const b = (k + 1).toString(2).padStart(width, '0')
              return (
                <span key={k} className="hcell binv">
                  {b.split('').map((c, j) => (
                    <em key={j} className={c === '1' ? 'one' : ''}>{c}</em>
                  ))}
                </span>
              )
            })}
          </div>
        </div>
        <p className="tnote">
          最后一行是位号的二进制。<b>P1 管所有二进制末位为 1 的位，P2 管倒数第二位为 1 的位</b>，以此类推。
          所以出错位的位号，恰好等于那些「不通过的校验位号」之和 —— 这是设计出来的，不是巧合。
        </p>
        {state.syndrome > 0 && (
          <p className="hsyn">校验子 = {state.syndrome} → 第 {state.syndrome} 位出错</p>
        )}
      </div>
    </div>
  )
}

/** 分组视图：每个校验位管哪些位，一目了然 */
function Groups({ trace, state }: { trace: HammingState[]; state: HammingState }) {
  const n = state.bits.length
  const parities = trace.filter(s => s.phase === 'parity')
  const checks = trace.filter(s => s.phase === 'check')
  const shown = checks.length && state.i >= checks[0].i ? checks : parities

  return (
    <div className="card">
      <h3>校验分组 <span className="hint">每个 P 管哪些位</span></h3>
      <div className="body">
        {shown.map(s => {
          const seen = s.i <= state.i
          return (
            <div key={s.i} className={`hgroup ${seen ? '' : 'future'} ${s.i === state.i ? 'cur' : ''}`}>
              <div className="ghead">
                <b>P{s.p}</b>
                <span>管第 {s.covers.join('、')} 位</span>
                {s.ok !== null && (
                  <em className={s.ok ? 'pass' : 'fail'}>{s.ok ? '通过' : `不通过 → 累加 ${s.p}`}</em>
                )}
              </div>
              <div className="gbits">
                {Array.from({ length: n }, (_, k) => {
                  const inGroup = s.covers.includes(k + 1)
                  return (
                    <span key={k} className={`gb ${inGroup ? 'in' : 'out'} ${k + 1 === s.p ? 'self' : ''}`}>
                      {inGroup ? s.bits[k] : '·'}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
