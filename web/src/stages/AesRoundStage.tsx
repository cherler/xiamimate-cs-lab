/** 舞台：AES 一轮 —— 4×4 状态矩阵走过四步变换，变化的格子高亮 */
import type { AesState } from '@engine/kernels/aesround.ts'
import type { StageProps } from '../types.ts'

const hex = (n: number) => n.toString(16).padStart(2, '0')

function Matrix({ m, prev, label }: { m: number[]; prev?: number[]; label?: string }) {
  return (
    <div className="aes-mat">
      {label && <span className="aes-mlabel">{label}</span>}
      <div className="aes-grid">
        {m.map((b, j) => (
          <span key={j} className={`aes-cell ${prev && prev[j] !== b ? 'chg' : ''}`}>{hex(b)}</span>
        ))}
      </div>
    </div>
  )
}

const STEPS = [
  { op: 'addkey0', t: 'AddRoundKey', s: '⊕密钥' },
  { op: 'sub', t: 'SubBytes', s: 'S盒·混淆' },
  { op: 'shift', t: 'ShiftRows', s: '移位·扩散' },
  { op: 'mix', t: 'MixColumns', s: 'GF·扩散' },
  { op: 'addkey1', t: 'AddRoundKey', s: '⊕轮密钥' },
]

export function AesRoundStage({ state }: StageProps<AesState>) {
  const { op, mat, prev, keyMat, phase, focus } = state
  const done = phase === 'done'
  const showKey = keyMat.length === 16

  return (
    <div className="card">
      <h3>AES 一轮 <span className="hint">4×4 状态矩阵：混淆 + 扩散 + 密钥混入（FIPS-197 官方向量）</span></h3>
      <div className="body">
        <div className="aes-flow">
          {STEPS.map(st => (
            <span key={st.op} className={`aes-chip ${op === st.op ? 'on' : ''} ${done && st.op === 'addkey1' ? 'ok' : ''}`}>
              <b>{st.t}</b><i>{st.s}</i>
            </span>
          ))}
        </div>

        <div className="aes-stage">
          <Matrix m={mat} prev={op === 'intro' ? undefined : prev} label="状态" />
          {showKey && <>
            <span className="aes-op">⊕</span>
            <Matrix m={keyMat} label={op === 'addkey0' ? '初始密钥' : '轮密钥1'} />
          </>}
        </div>

        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'intro' ? '摆矩阵' : STEPS.find(s => s.op === op)?.t ?? op}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">{op === 'sub' ? '非线性' : op === 'shift' || op === 'mix' ? '扩散' : op.startsWith('addkey') ? '混入密钥' : '就绪'}</span><span className="scdl">作用</span></div>
          <div className="scdk"><span className={`scdn ${done ? 'ok' : ''}`}>{done ? '一轮完成' : '进行中'}</span><span className="scdl">进度</span></div>
        </div>

        {done
          ? <p className="scnote">一轮 = <b>SubBytes(混淆)</b> + <b>ShiftRows/MixColumns(扩散)</b> + <b>AddRoundKey(密钥混入)</b>。AES-128 共 <b>10 轮</b>（末轮省 MixColumns），几轮叠加后每个密文位都依赖全部明文位和密钥位。这批数字对标 FIPS-197 附录 B，逐字节可核（SubBytes/ShiftRows/AddRoundKey 手算，MixColumns 是 GF(2⁸) 运算）。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。盯高亮的格子看这一步改了什么：SubBytes 每格都变(查表)、ShiftRows 只搬位置、MixColumns 整列重算、AddRoundKey 和密钥逐字节异或。</p>}
      </div>
    </div>
  )
}
