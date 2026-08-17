/** 舞台：定点乘除 —— 部分积/余数与乘数/商的寄存器逐轮变化 */
import type { MulState } from '@engine/kernels/multiply.ts'
import type { StageProps } from '../types.ts'

const ACT: Record<string, string> = {
  init: '初始化', add: '加', sub: '减', none: '不加不减',
  shift: '移位', correct: '修正', done: '完成',
}

export function MultiplyStage({ doc, trace, index, state, tab }: StageProps<MulState>) {
  const isDiv = String(doc.params.algorithm) === '加减交替'
  if (tab === 'table') return <Table trace={trace} index={index} isDiv={isDiv} />
  return <Regs state={state} isDiv={isDiv} algorithm={String(doc.params.algorithm)} />
}

/** 寄存器视图：两个寄存器并排，看着位怎么一格格挤过去 */
function Regs({ state, isDiv, algorithm }: { state: MulState; isDiv: boolean; algorithm: string }) {
  return (
    <div className="card">
      <h3>寄存器 <span className="hint">{isDiv ? '余数 / 商' : '部分积 / 乘数'}</span></h3>
      <div className="body">
        <div className="mregs">
          <div className="mreg">
            <span className="k">{isDiv ? '余数 R' : '部分积（高位）'}</span>
            <div className="mbits">
              {state.hi.split('').map((b, k) => <span key={k} className="mb">{b}</span>)}
            </div>
          </div>
          <div className="mreg">
            <span className="k">{isDiv ? '商 Q' : '乘数（低位）'}</span>
            <div className="mbits">
              {state.lo.split('').map((b, k) => (
                <span key={k} className={`mb ${!isDiv && k === state.lo.length - 1 ? 'judge' : ''}`}>{b}</span>
              ))}
            </div>
          </div>
          {state.extra !== '' && (
            <div className="mreg narrow">
              <span className="k">附加位</span>
              <div className="mbits"><span className="mb judge">{state.extra}</span></div>
            </div>
          )}
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">算法</span><span className="v">{algorithm}</span></div>
          <div className="pr"><span className="k">轮次</span><span className="v">{state.round || '—'}</span></div>
          <div className="pr"><span className="k">本步动作</span>
            <span className="v">{ACT[state.act] ?? state.act}</span></div>
          {state.judge && (
            <div className="pr"><span className="k">判断位</span><span className="v">{state.judge}</span></div>
          )}
          {isDiv && state.q !== null && (
            <div className="pr"><span className="k">当前商 / 余数</span>
              <span className="v">{state.q} / {state.rem}</span></div>
          )}
        </div>
      </div>
    </div>
  )
}

/** 逐轮表 —— 考卷上要求"写出每一步的部分积"，这张表就是答案 */
function Table({ trace, index, isDiv }: { trace: MulState[]; index: number; isDiv: boolean }) {
  return (
    <div className="card">
      <h3>逐轮表 <span className="hint">考题要求写出每一步的{isDiv ? '余数与商' : '部分积'}</span></h3>
      <div className="body scroll">
        <table className="ptab">
          <thead>
            <tr>
              <th>步</th><th>轮</th><th>动作</th>
              <th>{isDiv ? '余数' : '部分积'}</th>
              <th>{isDiv ? '商' : '乘数'}</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {trace.map(s => (
              <tr key={s.i} className={s.i === index ? 'past' : s.i > index ? 'future' : ''}>
                <td>{s.i + 1}</td>
                <td>{s.round || '—'}</td>
                <td>{ACT[s.act] ?? s.act}</td>
                <td className="seq"><span>{s.hi}</span></td>
                <td className="seq"><span>{s.lo}{s.extra ? ` ${s.extra}` : ''}</span></td>
                <td className="dim" style={{ textAlign: 'left', whiteSpace: 'normal', minWidth: 260 }}>{s.log}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
