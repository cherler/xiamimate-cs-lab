/** 舞台：IEEE 754 浮点 —— 位域拆解 + 逐步中间量 */
import type { FloatState } from '@engine/kernels/float.ts'
import type { StageProps } from '../types.ts'
import { BitField, type BitSeg } from '../shell/BitField.tsx'

const FMT: Record<string, { expBits: number; manBits: number }> = {
  single: { expBits: 8, manBits: 23 },
  double: { expBits: 11, manBits: 52 },
}

export function FloatStage({ doc, trace, state, tab }: StageProps<FloatState>) {
  const f = FMT[String(doc.params.format)] ?? FMT.single
  const segs: BitSeg[] = [
    { label: '符号 S', from: 0, len: 1, tone: 'tag' },
    { label: '阶码 E（移码）', from: 1, len: f.expBits, tone: 'idx' },
    { label: '尾数 M（隐含首位 1）', from: 1 + f.expBits, len: f.manBits, tone: 'off' },
  ]
  if (tab === 'steps') return <Steps trace={trace} state={state} />
  return (
    <div className="card">
      <h3>位域拆解 <span className="hint">高亮 = 本步确定的位</span></h3>
      <div className="body">
        <BitField
          bits={state.bits} segments={segs} touched={state.touched}
          caption={state.bits.includes('?')
            ? '问号表示这一位还没定下来 —— 按时间轴往后走，位会一段一段填满'
            : `十六进制 0x${bigHex(state.bits)}`}
        />
        <div className="phasenow">
          {Object.entries(state.detail).map(([k, v]) => (
            <div className="pr" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
          ))}
          {Object.keys(state.detail).length === 0
            ? <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
            : null}
        </div>
      </div>
    </div>
  )
}

const bigHex = (bits: string) =>
  bits.includes('?') ? '—' : BigInt('0b' + bits).toString(16).toUpperCase().padStart(bits.length / 4, '0')

/** 步骤清单 —— 把整条推导链摊平，考场上写的就是这几行 */
function Steps({ trace, state }: { trace: FloatState[]; state: FloatState }) {
  const NAME: Record<string, string> = {
    sign: '定符号位', int: '整数部分除二取余', frac: '小数部分乘二取整',
    normalize: '规格化', exponent: '阶码加偏置', mantissa: '尾数截取与舍入',
    assemble: '拼装', align: '对阶', addsub: '尾数加减', round: '舍入',
    special: '特殊值 / 准备', done: '完成',
  }
  return (
    <div className="card">
      <h3>推导链 <span className="hint">考场上手写的就是这几行</span></h3>
      <div className="body">
        <ol className="fsteps">
          {trace.map(s => (
            <li key={s.i} className={s.i === state.i ? 'cur' : s.i < state.i ? 'past' : ''}>
              <span className="ph">{NAME[s.phase] ?? s.phase}</span>
              <span className="tx">{s.log}</span>
              {Object.keys(s.detail).length > 0 && (
                <div className="fdet">
                  {Object.entries(s.detail).map(([k, v]) => (
                    <span key={k}><b>{k}</b>{v}</span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
