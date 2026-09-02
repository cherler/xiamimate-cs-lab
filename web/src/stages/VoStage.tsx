/** 舞台：视觉里程计/对极几何 —— 帧1(x1)/帧2(x2+对极线+极点) 两图 + E 矩阵/对极约束/尺度 逐块 */
import type { VoState } from '@engine/kernels/vo.ts'
import type { StageProps } from '../types.ts'

const X0 = -0.5, X1 = 0.7, Y0 = -0.4, Y1 = 0.4
const IX = (x: number) => 12 + (x - X0) / (X1 - X0) * 106
const IY = (y: number) => 46 - (y - 0) / (Y1 - Y0) * 76

// 对极线 l=[a,b,c] 在 [X0,X1] 上取两端点（归一化坐标）
function lineEnds(l: number[]): [[number, number], [number, number]] | null {
  const [a, b, c] = l as [number, number, number]
  if (Math.abs(b) > 1e-6) return [[X0, -(a * X0 + c) / b], [X1, -(a * X1 + c) / b]]
  if (Math.abs(a) > 1e-6) { const x = -c / a; return [[x, Y0], [x, Y1]] }
  return null
}
const mvl = (E: number[][], x: number, y: number): number[] => E.map(r => r[0]! * x + r[1]! * y + r[2]! * 1)

function Mat({ m }: { m: number[][] }) {
  return <span className="vo-mat">{m.map((row, i) => <span key={i} className="vo-mrow">{row.map((x, j) => <span key={j} className="vo-mcell">{x}</span>)}</span>)}</span>
}

const COLORS = ['a', 'b', 'c']

export function VoStage({ state }: StageProps<VoState>) {
  const s = state
  const { scenLabel, E, epipole, corrs, epiIdx, epiLine, onLine, scaleC, showE, showConstraint, showEpi, showRecover } = s

  const Frame = ({ which }: { which: 1 | 2 }) => (
    <svg className="vo-svg" viewBox="0 0 130 92" width="100%" height="118">
      <rect x="10" y="8" width="110" height="76" className="vo-frame" />
      <text x="14" y="18" className="vo-flbl">{which === 1 ? '帧 1（上一帧）x1' : '帧 2（这一帧）x2'}</text>
      {/* 帧2：对极线（全部，highlight EPI）+ 极点 */}
      {which === 2 && showEpi && corrs.map((c, k) => {
        const l = mvl(E, c.x1[0], c.x1[1]); const e = lineEnds(l); if (!e) return null
        return <line key={k} x1={IX(e[0][0])} y1={IY(e[0][1])} x2={IX(e[1][0])} y2={IY(e[1][1])} className={k === epiIdx ? 'vo-epi-hot' : 'vo-epi'} />
      })}
      {which === 2 && showEpi && epipole && (
        <><circle cx={IX(epipole[0])} cy={IY(epipole[1])} r="3" className="vo-epole" /><text x={IX(epipole[0]) + 4} y={IY(epipole[1]) - 4} className="vo-elbl">极点 FOE</text></>
      )}
      {/* 点 */}
      {corrs.map((c, k) => { const p = which === 1 ? c.x1 : c.x2; return <circle key={k} cx={IX(p[0])} cy={IY(p[1])} r="2.6" className={which === 2 && k === epiIdx ? 'vo-pt-hot' : 'vo-pt'} /> })}
      {corrs.map((c, k) => { const p = which === 1 ? c.x1 : c.x2; return <text key={`l${k}`} x={IX(p[0]) + 4} y={IY(p[1]) + 3} className="vo-ptlbl">{COLORS[k]}</text> })}
    </svg>
  )

  return (
    <div className="card">
      <h3>视觉里程计 · 对极几何 <span className="hint">单目两帧恢复相机运动：本质矩阵 E=[t]×R、对极约束 x2ᵀE x1=0、分解出 (R,t)</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{scenLabel.split('(')[0]}</span><span className="scdl">相机运动</span></div>
          <div className="scdk"><span className={`scdn${showConstraint ? ' vo-good' : ''}`}>{showConstraint ? 'x2ᵀEx1≈0 ✓' : '—'}</span><span className="scdl">对极约束</span></div>
          <div className="scdk"><span className={`scdn${showEpi ? ' vo-hot' : ''}`}>{showEpi ? (epipole ? `(${epipole})` : '∞ 水平') : '—'}</span><span className="scdl">极点 e2</span></div>
          <div className="scdk"><span className={`scdn${showRecover ? ' vo-hot' : ''}`}>{showRecover ? '方向定·尺度不定' : '—'}</span><span className="scdl">单目恢复 (R,t)</span></div>
        </div>

        <div className="vo-panes">
          <div className="vo-pane"><Frame which={1} /></div>
          <div className="vo-pane"><Frame which={2} /></div>
        </div>

        <div className="vo-flow">
          {showE && (
            <div className="vo-blk"><span className="vo-n">①</span> 本质矩阵 E=[t]×R（本例 R=I）= <Mat m={E} />（打包相对旋转+平移方向；秩 2、尺度未定）</div>
          )}
          {showConstraint && (
            <div className="vo-blk"><span className="vo-n">②</span> 对极约束 x2ᵀE·x1=0：三对匹配 {corrs.map((c, k) => <span key={k} className="vo-cc">{COLORS[k]}:<b className="vo-goodc">≈0</b></span>)}（对 E 线性 → <b>8 点法</b>从 ≥8 对解 E）</div>
          )}
          {showEpi && (
            <div className="vo-blk"><span className="vo-n">③</span> 对极线 l2=E·x1=[{epiLine.join(', ')}]，x2 落在线上（l2·x2={Math.abs(onLine) < 1e-9 ? '≈0 ✓' : onLine}）；{epipole ? '所有线过极点（图心 FOE）、放射状' : '极点在无穷远、线水平（y1=y2、双目校正）'}——匹配只沿一条线搜</div>
          )}
          {showRecover && (
            <div className="vo-blk-r"><span className="vo-n">④</span> 分解 E→(R,t)：SVD 得 <b>4 组候选</b>，手性（点在两相机前方）选唯一；<b className="vo-badc">单目 t 只定方向、不定尺度</b>（E 与 2E 同约束 x2ᵀ(2E)x1={Math.abs(scaleC) < 1e-9 ? '≈0' : scaleC}）——单目 SLAM 的尺度不确定。</div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>对极几何 = 单目 VO 的核心</b>：E=[t]×R；对极约束 x2ᵀE x1=0（8 点法解 E）；对极线 l2=E x1 + 极点（匹配只沿一条线搜、横向→水平=双目校正、前进→从 FOE 放射）；SVD 分解 (R,t)、手性选唯一、<b>单目无绝对尺度</b>。<b>连</b>：「针孔」(归一化)、「双目」(对极线水平=校正且能定尺度)、「ICP/SLAM」(后端)、「PnP」(有 3D 点后 2D-3D 求位姿)。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
