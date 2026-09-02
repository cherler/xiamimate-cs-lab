/** 舞台：针孔相机 —— 像平面(主点/理想像素/畸变像素+偏移线) + 透视/内参/畸变/结果 逐块 */
import type { PinState } from '@engine/kernels/pinhole.ts'
import type { StageProps } from '../types.ts'

const IW = 640, IH = 480, OX = 40, OY = 12, SC = 220 / IW
const PX = (u: number) => OX + u * SC
const PY = (v: number) => OY + v * SC

export function PinholeStage({ state }: StageProps<PinState>) {
  const s = state
  const { distLabel, dist, P, fx, cx, cy, k1, k2, xn, yn, r2v, uIdeal, vIdeal, xd, yd, uDist, vDist, shift, showPersp, showIntr, showDist, showResult } = s

  return (
    <div className="card">
      <h3>针孔相机 · 投影与畸变 <span className="hint">3D 点怎么变成 2D 像素：透视除以深度 + 内参 + 径向畸变</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{distLabel.split('(')[0]}</span><span className="scdl">畸变</span></div>
          <div className="scdk"><span className="scdn">{showPersp ? `${xn},${yn}` : '—'}</span><span className="scdl">归一化 x_n,y_n</span></div>
          <div className="scdk"><span className={`scdn${showIntr ? ' ph-hot' : ''}`}>{showIntr ? `${uIdeal},${vIdeal}` : '—'}</span><span className="scdl">理想像素</span></div>
          <div className="scdk"><span className={`scdn${showResult ? (dist === 'on' ? ' ph-bad' : ' ph-good') : ''}`}>{showResult ? (dist === 'on' ? `${uDist},${vDist}` : `${uIdeal},${vIdeal}`) : '—'}</span><span className="scdl">最终像素</span></div>
        </div>

        {showIntr && (
          <svg className="ph-svg" viewBox="0 0 300 120" width="100%" height="130">
            {/* 像平面 */}
            <rect x={PX(0)} y={PY(0)} width={IW * SC} height={IH * SC} className="ph-img" />
            <text x={PX(0)} y={PY(0) - 3} className="ph-imgt">像平面 {IW}×{IH}</text>
            {/* 主点 */}
            <line x1={PX(cx) - 4} y1={PY(cy)} x2={PX(cx) + 4} y2={PY(cy)} className="ph-axis" />
            <line x1={PX(cx)} y1={PY(cy) - 4} x2={PX(cx)} y2={PY(cy) + 4} className="ph-axis" />
            <text x={PX(cx) + 5} y={PY(cy) - 3} className="ph-cxlbl">主点({cx},{cy})</text>
            {/* 理想像素 */}
            <circle cx={PX(uIdeal)} cy={PY(vIdeal)} r="3.5" className="ph-ideal" />
            <text x={PX(uIdeal) - 4} y={PY(vIdeal) - 6} className="ph-ideallbl">理想</text>
            {/* 畸变像素 + 偏移 */}
            {showDist && <>
              <line x1={PX(uIdeal)} y1={PY(vIdeal)} x2={PX(uDist)} y2={PY(vDist)} className="ph-shift" />
              <circle cx={PX(uDist)} cy={PY(vDist)} r="3.5" className="ph-dist" />
              <text x={PX(uDist) + 5} y={PY(vDist) + 3} className="ph-distlbl">畸变(+{shift}px)</text>
            </>}
          </svg>
        )}

        <div className="ph-flow">
          <div className={`ph-blk${showPersp ? '' : ' ph-off'}`}>
            <span className="ph-n">①</span> 透视 x_n=X/Z、y_n=Y/Z {showPersp ? <>=({P[0]}/{P[2]}, {P[1]}/{P[2]})=(<b>{xn}, {yn}</b>)——除以深度、近大远小、丢深度</> : '—'}
          </div>
          <div className={`ph-blk${showIntr ? '' : ' ph-off'}`}>
            <span className="ph-n">②</span> 内参 u=fx·x_n+cx、v=fy·y_n+cy {showIntr ? <>=({fx}·{xn}+{cx}, {fx}·{yn}+{cy})=(<b className="ph-h">{uIdeal}, {vIdeal}</b>)</> : '—'}<em className="ph-sub">fx,fy 焦距(像素)；cx,cy 主点≈图心</em>
          </div>
          <div className={`ph-blk${showDist ? '' : ' ph-off'}`}>
            <span className="ph-n">③</span> 径向畸变 x_d=x_n(1+k1 r²+k2 r⁴) {showDist ? <>：r²={r2v}，x_d={xd}、y_d={yd} → 像素(<b className="ph-r">{uDist}, {vDist}</b>)，偏 <b>{shift}px</b></> : '—'}<em className="ph-sub">k1={k1}/k2={k2}；离中心越远越弯（桶形）</em>
          </div>
          {showResult && (
            <div className="ph-result">
              <span className="ph-n">④</span> {dist === 'on'
                ? <><b>有畸变</b>：最终像素 (<b className="ph-r">{uDist}, {vDist}</b>)，比理想 ({uIdeal},{vIdeal}) 偏 {shift}px（边缘明显、中心几乎不偏）；用图前要<b>去畸变</b>纠回。</>
                : <><b>无畸变(理想针孔)</b>：像素 (<b className="ph-h">{uIdeal}, {vIdeal}</b>)。</>}
              <span className="ph-cal">　标定：拍棋盘格、从已知 3D↔2D 反求 fx,fy,cx,cy,k1,k2（张正友法）。</span>
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>针孔相机 = 透视 + 内参 + 畸变</b>：外参[R|t]世界→相机；透视 x_n=X/Z(除以深度、近大远小、丢深度)；内参 K u=fx x_n+cx；径向畸变 x_d=x_n(1+k1 r²+k2 r⁴)(边缘更弯)。<b>标定</b>拍棋盘格反求参数、用图前去畸变。<b>连</b>：是所有视觉几何的地基——「ICP/SLAM」反投影像素成 3D 射线、立体视觉求深度、「6D 位姿/手眼标定」都要精确的 K。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
