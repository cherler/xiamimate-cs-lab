/** 舞台：注意力=联想记忆 —— 残缺 query 反复检索，一步步"回忆"回存储的模式 */
import type { HopfieldState } from '@engine/kernels/hopfield.ts'
import type { StageProps } from '../types.ts'

const PLAB = ['P0', 'P1', 'P2', 'P3']

function Bits({ bits, ref }: { bits: number[]; ref?: number[] }) {
  return (
    <div className="hfbits">
      {bits.map((b, k) => {
        const diff = ref && ref[k] !== b
        return <span key={k} className={`hfcell ${b > 0 ? 'pos' : 'neg'} ${diff ? 'diff' : ''}`} />
      })}
    </div>
  )
}

export function HopfieldStage({ state }: StageProps<HopfieldState>) {
  const { patterns, querySign, weights, best, matchBits, beta, converged, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>注意力 = 联想记忆 <span className="hint">残缺 query 反复检索，回忆出完整存储模式（Hopfield）</span></h3>
      <div className="body">
        {/* 存储的记忆 */}
        <div className="hfrow">
          <span className="hflab">存储的记忆（keys · β={beta}）</span>
          <div className="hfmem">
            {patterns.map((p, i) => (
              <div key={i} className={`hfpat ${i === best && !done ? 'win' : ''}`}>
                <span className="hfpn">{PLAB[i]}</span>
                <Bits bits={p} />
                <span className="hfw" style={{ opacity: 0.4 + weights[i] * 0.6 }}>{(weights[i] * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* query */}
        <div className="hfrow">
          <span className="hflab">当前 query（红框=和 P0 不一致的位）</span>
          <div className="hfquery">
            <Bits bits={querySign} ref={patterns[0]} />
            <span className={`hfmatch ${matchBits === 8 ? 'ok' : ''}`}>与 P0 相同 {matchBits}/8</span>
          </div>
        </div>

        {/* 检索权重 */}
        <div className="hfrow">
          <span className="hflab">检索权重 = softmax(β · query·keys)</span>
          <div className="hfweights">
            {weights.map((w, i) => (
              <div className="hfwrow" key={i}>
                <span className="hfwl">{PLAB[i]}</span>
                <span className="hfwtrack"><span className="hfwfill" style={{ width: `${Math.max(1.5, w * 100)}%`, background: i === best ? 'var(--now)' : 'var(--f-tag)' }} /></span>
                <span className="hfwp">{(w * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {done
          ? <p className="scnote">从一个翻了 2 位的残缺 query，几步注意力检索就把它<b>"回忆"回了完整的 P0</b>，权重收敛到 one-hot（认定=P0）。<b>注意力 = 联想记忆</b>：一次注意力就是一步 Hopfield 检索——query 只要落进某个记忆的吸引域，就被拉回那个完整模式。这是注意力能"从上下文回忆相关信息"的底；容量随维度指数级，正对上「高维近正交」。</p>
          : converged ? <p className="scnote" style={{ opacity: .85 }}>已回忆出完整 P0（8/8）、权重 one-hot。这就是"按内容检索"：残缺输入被拉回完整记忆。</p>
          : <p className="scnote" style={{ opacity: .85 }}>query 现在还残缺（红框位和 P0 不一致）。按「下一步」做一次检索：output=Σ权重·记忆，取符号当新 query——它会被拉向最像的那个记忆。</p>}
      </div>
    </div>
  )
}
