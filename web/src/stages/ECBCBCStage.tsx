/** 舞台：ECB vs CBC —— 重复明文块在两种模式下的下场，颜色相同=值相同 */
import type { EcbCbcState } from '@engine/kernels/ecbcbc.ts'
import type { StageProps } from '../types.ts'

const bin = (n: number) => n.toString(2).padStart(4, '0')
// 值→颜色：相同的块必得相同颜色（ECB 泄露的可视化核心）
const hue = (n: number) => `hsl(${(n * 23) % 360} 62% 52%)`

function Block({ v, active, ghost }: { v: number | null; active?: boolean; ghost?: boolean }) {
  if (v === null) return <span className="ec-blk ec-ghost">····</span>
  return <span className={`ec-blk ${active ? 'act' : ''}`} style={{ background: hue(v), color: '#fff' }}>{bin(v)}</span>
}

export function ECBCBCStage({ state }: StageProps<EcbCbcState>) {
  const { mode, blockIdx, P, ecbC, cbcC, expr, ecbLeak, cbcSafe, phase } = state
  const done = phase === 'done'
  const cell = (arr: number[], i: number) => (i < arr.length ? arr[i]! : null)

  return (
    <div className="card">
      <h3>ECB vs CBC <span className="hint">为什么 ECB 会泄露明文 pattern（颜色相同=值相同）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{mode === 'intro' ? '看明文' : mode.toUpperCase()}</span><span className="scdl">当前模式</span></div>
          <div className="scdk"><span className={`scdn ${ecbLeak ? 'miss' : ''}`}>{ecbC.length === 4 ? (ecbLeak ? 'C1=C3 泄露' : '—') : '…'}</span><span className="scdl">ECB 重复块</span></div>
          <div className="scdk"><span className={`scdn ${cbcSafe ? 'ok' : ''}`}>{cbcC.length === 4 ? (cbcSafe ? 'C1≠C3 安全' : '—') : (mode === 'cbc' ? '…' : '待')}</span><span className="scdl">CBC 重复块</span></div>
        </div>

        <div className="ec-rows">
          <div className="ec-row">
            <span className="ec-lbl">明文 P<em>P1 = P3</em></span>
            <div className="ec-blks">
              {P.map((v, i) => <Block key={i} v={v} />)}
              <span className="ec-eq" title="P1 与 P3 相等">↑ 第1、3块相同</span>
            </div>
          </div>

          <div className={`ec-row ${mode === 'ecb' ? 'on' : ''} ${ecbLeak ? 'leak' : ''}`}>
            <span className="ec-lbl">ECB 密文<em>C=E(P)</em></span>
            <div className="ec-blks">
              {[0, 1, 2, 3].map(i => <Block key={i} v={cell(ecbC, i)} active={mode === 'ecb' && blockIdx === i} />)}
              {ecbC.length === 4 && ecbLeak && <span className="ec-badge bad">⚠ C1=C3 → pattern 泄露</span>}
            </div>
          </div>

          <div className={`ec-row ${mode === 'cbc' ? 'on' : ''} ${done && cbcSafe ? 'safe' : ''}`}>
            <span className="ec-lbl">CBC 密文<em>C=E(P⊕C₋₁)</em></span>
            <div className="ec-blks">
              {[0, 1, 2, 3].map(i => <Block key={i} v={cell(cbcC, i)} active={mode === 'cbc' && blockIdx === i} />)}
              {cbcC.length === 4 && cbcSafe && <span className="ec-badge good">✓ C1≠C3 → 打散了</span>}
            </div>
          </div>
        </div>

        {expr && !done && <div className="ec-expr mono">{expr}</div>}

        {done
          ? <p className="scnote">明文相同 <b>P1=P3=1010</b>：ECB 块独立、确定性 → 相同明文块必得相同密文（<b>C1=C3</b>，pattern 泄露，这就是「ECB 企鹅」）；CBC 靠 <b>链接</b>（前一块密文参与异或）把重复打散（<b>C1≠C3</b>）。所以现实里 ECB 基本禁用，要用 CBC/CTR/GCM 这类模式，还得配随机 IV。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。ECB 每块独立加密（相同明文块 → 相同密文块）；CBC 每块先和上一块密文异或再加密（链接打散重复）。看第 1、3 块（明文相同）在两行里长成什么样。</p>}
      </div>
    </div>
  )
}
