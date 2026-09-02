/** 舞台：手眼标定 AX=XB —— 夹爪↔相机固定变换 X 的示意 + 运动对/角度自检/解 R_X/解 t_X 逐块 */
import type { HandEyeState } from '@engine/kernels/handeye.ts'
import type { StageProps } from '../types.ts'

function Mat({ m, hot }: { m: number[][]; hot?: boolean }) {
  return (
    <span className={`he-mat${hot ? ' he-mat-hot' : ''}`}>
      {m.map((row, i) => <span key={i} className="he-mrow">{row.map((x, j) => <span key={j} className="he-mcell">{x}</span>)}</span>)}
    </span>
  )
}

export function HandEyeStage({ state }: StageProps<HandEyeState>) {
  const s = state
  const { scenLabel, RXtrue, tXtrue, motions, RXrec, tXrec, angleMatch, rotOK, transOK, showMotions, showAngle, showRot, showTrans } = s

  return (
    <div className="card">
      <h3>手眼标定 AX=XB <span className="hint">相机装在夹爪上，求相机↔夹爪的固定变换 X：先解旋转、再解平移</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{scenLabel.replace('真值 ', '')}</span><span className="scdl">真值 X 旋转</span></div>
          <div className="scdk"><span className={`scdn${showAngle ? (angleMatch ? ' he-good' : ' he-bad') : ''}`}>{showAngle ? (angleMatch ? 'θ_A=θ_B ✓' : '不符') : '—'}</span><span className="scdl">角度自检</span></div>
          <div className="scdk"><span className={`scdn${showRot ? (rotOK ? ' he-good' : ' he-bad') : ''}`}>{showRot ? (rotOK ? 'R_X ✓' : '✗') : '—'}</span><span className="scdl">还原旋转</span></div>
          <div className="scdk"><span className={`scdn${showTrans ? (transOK ? ' he-good' : ' he-bad') : ''}`}>{showTrans ? (transOK ? 't_X ✓' : '✗') : '—'}</span><span className="scdl">还原平移</span></div>
        </div>

        <svg className="he-svg" viewBox="0 0 300 74" width="100%" height="82">
          {/* 夹爪 */}
          <rect x="24" y="30" width="46" height="22" rx="3" className="he-grip" />
          <text x="47" y="44" className="he-ilbl">夹爪</text>
          <text x="47" y="64" className="he-slbl">A=夹爪相对运动(FK)</text>
          {/* X 变换箭头 */}
          <line x1="70" y1="41" x2="150" y2="41" className="he-xarr" markerEnd="url(#he-ah)" />
          <text x="98" y="34" className="he-xlbl">X（未知·固定）</text>
          {/* 相机 */}
          <rect x="150" y="30" width="46" height="22" rx="3" className="he-cam" />
          <text x="173" y="44" className="he-ilbl">相机</text>
          <text x="173" y="64" className="he-slbl">B=相机相对运动(看标定板)</text>
          {/* 方程 */}
          <text x="228" y="45" className="he-eq">A·X = X·B</text>
          <defs><marker id="he-ah" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" className="he-ahf" /></marker></defs>
        </svg>

        <div className="he-flow">
          <div className={`he-blk${showMotions ? '' : ' he-off'}`}>
            <span className="he-n">①</span> 采两组运动对 {showMotions ? <>：A₁绕x90°→B₁绕[{motions[0].axB}]{motions[0].angB}°、A₂绕y90°→B₂绕[{motions[1].axB}]{motions[1].angB}°（≥2 组不共线）</> : '—'}
          </div>
          <div className={`he-blk${showAngle ? '' : ' he-off'}`}>
            <span className="he-n">②</span> 角度自检 {showAngle ? <>：θ_A=θ_B（{motions.map(m => `${m.angA}=${m.angB}`).join('、')}）<b className={angleMatch ? 'he-goodc' : 'he-badc'}>{angleMatch ? ' ✓ 数据可用' : ' ✗'}</b>（R_A、R_B 相似、旋转角必相等，是硬约束+自检）</> : '—'}
          </div>
          {showRot && (
            <div className="he-blk-r">
              <span className="he-n">③</span> 解旋转：n_A=R_X·n_B（轴对应），两组定出 R_X。
              <span className="he-cmp">还原 <Mat m={RXrec} hot /> {rotOK ? '=' : '≠'} 真值 <Mat m={RXtrue} /> <b className={rotOK ? 'he-goodc' : 'he-badc'}>{rotOK ? '✓' : '✗'}</b></span>
            </div>
          )}
          {showTrans && (
            <div className="he-blk-r">
              <span className="he-n">④</span> 解平移：(R_A−I)t_X=R_X·t_B−t_A（线性方程，两组凑满秩）。
              <span className="he-cmp">还原 t_X=<b className="he-hotc">[{tXrec.join(', ')}]</b> {transOK ? '=' : '≠'} 真值 [{tXtrue.join(', ')}] <b className={transOK ? 'he-goodc' : 'he-badc'}>{transOK ? '✓' : '✗'}</b></span>
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>手眼标定 AX=XB</b>：机器人动几下，A=夹爪相对运动(FK 算)、B=相机相对运动(看标定板)；先解旋转（R_A/R_B 角相等自检、R_X 把 n_B 转到 n_A、≥2 组定出）、再解平移（(R_A−I)t_X=R_X t_B−t_A 线性方程）。生成→还原闭环，X {rotOK && transOK ? '完全还原 ✓' : '✗'}。<b>连</b>：「正运动学 FK」算 A、「相机标定/针孔」是 B 的前提；结果喂给视觉引导抓取（相机看到目标乘 X 换算到夹爪去抓）。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
