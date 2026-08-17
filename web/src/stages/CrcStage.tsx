/** 舞台：CRC —— 模 2 长除法竖式 */
import type { CrcState } from '@engine/kernels/crc.ts'
import type { StageProps } from '../types.ts'

export function CrcStage({ doc, trace, index, state, tab }: StageProps<CrcState>) {
  const gen = String(doc.params.generator)
  if (tab === 'result') return <Result doc={doc} state={state} gen={gen} />
  return <LongDiv trace={trace} index={index} state={state} gen={gen} />
}

/**
 * 竖式：跟考卷上手写的一模一样。
 * 每一步把生成多项式对齐到当前最高位下方，异或的结果写在下一行。
 */
function LongDiv({ trace, index, state, gen }: {
  trace: CrcState[]; state: CrcState; index: number; gen: string
}) {
  const rows = trace.filter(s => s.phase === 'divide' && s.i <= index)
  const width = state.dividend.length || 1
  const cell = (ch: string, k: number, cls = '') =>
    <span key={k} className={`cbit ${cls}`}>{ch}</span>

  return (
    <div className="card">
      <h3>模 2 长除法 <span className="hint">减法换成异或，不借位 —— 只差这一点</span></h3>
      <div className="body scroll">
        <div className="crcdiv" style={{ ['--n' as string]: width }}>
          {/* 商 */}
          <div className="crow q">
            <span className="clab">商</span>
            <div className="cbits">
              {Array.from({ length: width }, (_, k) => {
                const qi = k
                const ch = qi < state.quotient.length ? state.quotient[qi] : ''
                return <span key={k} className={`cbit ${ch ? 'on' : 'blank'}`}>{ch}</span>
              })}
            </div>
          </div>

          {/* 被除数与每一步的异或 */}
          <div className="crow head">
            <span className="clab">被除数</span>
            <div className="cbits">
              {(trace[0]?.dividend ?? '').split('').map((b, k) => cell(b, k))}
            </div>
          </div>

          {rows.map(s => (
            <div className="cgroup" key={s.i}>
              <div className={`crow gen ${s.q === '0' ? 'skip' : ''}`}>
                <span className="clab">{s.q === '1' ? `⊕ ${gen}` : '不异或'}</span>
                <div className="cbits">
                  {Array.from({ length: width }, (_, k) => {
                    const inside = s.q === '1' && k >= s.at && k < s.at + gen.length
                    return <span key={k} className={`cbit ${inside ? 'gen' : 'blank'}`}>
                      {inside ? gen[k - s.at] : ''}
                    </span>
                  })}
                </div>
              </div>
              <div className={`crow res ${s.i === index ? 'cur' : ''}`}>
                <span className="clab">{s.i === index ? '← 本步' : ''}</span>
                <div className="cbits">
                  {s.dividend.split('').map((b, k) => (
                    <span key={k}
                      className={`cbit ${s.touched.includes(k) && s.q === '1' ? 'hot' : ''} ${k < s.at ? 'done' : ''}`}
                    >{b}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {state.remainder && (
          <p className="tnote">
            余数（FCS）= <b>{state.remainder}</b> —— 它就是接在数据后面发出去的校验码。
          </p>
        )}
      </div>
    </div>
  )
}

/** 结论页：码字构成 / 校验结果 */
function Result({ doc, state, gen }: { doc: StageProps<CrcState>['doc']; state: CrcState; gen: string }) {
  const r = gen.length - 1
  const isCheck = doc.params.operation === 'check'
  const clean = /^0*$/.test(state.remainder || '')
  const code = state.dividend
  return (
    <div className="card">
      <h3>{isCheck ? '接收端校验' : '发送的码字'} <span className="hint">生成多项式 {gen}</span></h3>
      <div className="body">
        <div className="crccode">
          {code.split('').map((b, k) => (
            <span key={k} className={`ccb ${k >= code.length - r ? 'fcs' : 'data'}`}>{b}</span>
          ))}
        </div>
        <div className="crclegend">
          <span><i className="cw data" />数据位 {code.length - r} 位</span>
          <span><i className="cw fcs" />校验位 FCS {r} 位</span>
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">生成多项式</span><span className="v">{gen}（{gen.length} 位）</span></div>
          <div className="pr"><span className="k">余数</span><span className="v">{state.remainder || '—'}</span></div>
          {isCheck && (
            <div className="pr"><span className="k">判定</span>
              <span className="v" style={{ color: clean ? 'var(--hit)' : 'var(--miss)' }}>
                {clean ? '余数全 0 → 无差错' : '余数非 0 → 检出差错，丢弃'}
              </span></div>
          )}
        </div>
        <p className="tnote">
          CRC 靠的是：发送端让「数据 + FCS」恰好能被生成多项式整除。
          接收端再除一次，余数不为 0 就说明传输中出了错。
          <b>能检错但不能纠错</b> —— 余数只告诉你「错了」，不告诉你「错在哪」。
        </p>
      </div>
    </div>
  )
}
