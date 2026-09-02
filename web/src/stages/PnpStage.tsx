/** 舞台：PnP 6D 位姿估计 —— 成像面(观测像素+重投影+残差) + 重投影误差曲线(碗形、真值处最小) */
import type { PnpState } from '@engine/kernels/pnp.ts'
import type { StageProps } from '../types.ts'

const IMX = (u: number) => 12 + (u - 240) / 160 * 108
const IMY = (v: number) => 12 + (v - 240) / 160 * 108
const LBL = ['A', 'B', 'C', 'D']

export function PnpStage({ state }: StageProps<PnpState>) {
  const s = state
  const { scenLabel, obs, curLabel, reproj, resid, rmsCur, curve, trueVal, curVal, unit, showObs, showReproj, showCurve, showSolved } = s
  const xs = curve.map(c => c.x), rmss = curve.map(c => c.rms)
  const xlo = Math.min(...xs), xhi = Math.max(...xs), rmax = Math.max(...rmss, 1)
  const CX = (x: number) => 16 + (x - xlo) / (xhi - xlo) * 116
  const CY = (r: number) => 68 - r / rmax * 56
  const curvePath = curve.map((c, k) => `${k === 0 ? 'M' : 'L'}${CX(c.x)},${CY(c.rms)}`).join(' ')

  return (
    <div className="card">
      <h3>PnP · 6D 位姿估计 <span className="hint">已知 3D 点 + 它们的 2D 像素 + 内参 K，求 6 自由度位姿：最小化重投影误差</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{scenLabel.split('(')[0]}</span><span className="scdl">偏移自由度</span></div>
          <div className="scdk"><span className={`scdn${showReproj && !showSolved ? ' pn-bad' : ''}`}>{showReproj && !showSolved ? `${rmsCur}px` : showSolved ? '0px' : '—'}</span><span className="scdl">重投影 RMS 误差</span></div>
          <div className="scdk"><span className="scdn">{showReproj || showSolved ? (showSolved ? `真值 ${trueVal}${unit}` : `${curVal}${unit}`) : '—'}</span><span className="scdl">当前位姿</span></div>
          <div className="scdk"><span className={`scdn${showSolved ? ' pn-good' : ''}`}>{showSolved ? '残差归零 ✓' : '—'}</span><span className="scdl">PnP 解</span></div>
        </div>

        <div className="pn-panes">
          <div className="pn-pane">
            <div className="pn-cap">成像面：观测像素 vs 重投影</div>
            <svg className="pn-svg" viewBox="0 0 132 132" width="100%" height="150">
              <rect x="12" y="12" width="108" height="108" className="pn-frame" />
              {/* 观测像素 */}
              {showObs && obs.map((o, k) => <circle key={`o${k}`} cx={IMX(o[0])} cy={IMY(o[1])} r="3.4" className="pn-obs" />)}
              {showObs && obs.map((o, k) => <text key={`ol${k}`} x={IMX(o[0]) + 4} y={IMY(o[1]) - 4} className="pn-lbl">{LBL[k]}</text>)}
              {/* 重投影 + 残差 */}
              {showReproj && !showSolved && reproj.map((p, k) => (
                <g key={`r${k}`}>
                  <line x1={IMX(obs[k][0])} y1={IMY(obs[k][1])} x2={IMX(p[0])} y2={IMY(p[1])} className="pn-res" />
                  <circle cx={IMX(p[0])} cy={IMY(p[1])} r="2.6" className="pn-reproj" />
                </g>
              ))}
              {/* 解出：重投影盖住观测 */}
              {showSolved && obs.map((o, k) => <circle key={`s${k}`} cx={IMX(o[0])} cy={IMY(o[1])} r="2" className="pn-solved" />)}
            </svg>
          </div>
          <div className="pn-pane">
            <div className="pn-cap">重投影误差 vs {scenLabel.split('(')[0]}（碗形·真值处最小）</div>
            <svg className="pn-svg" viewBox="0 0 140 84" width="100%" height="150">
              <line x1="16" y1="68" x2="138" y2="68" className="pn-axis" />
              <line x1="16" y1="10" x2="16" y2="68" className="pn-axis" />
              {showCurve && <path d={curvePath} className="pn-curve" fill="none" />}
              {/* 真值(最小) */}
              {showCurve && <><line x1={CX(trueVal)} y1="10" x2={CX(trueVal)} y2="68" className="pn-truex" /><circle cx={CX(trueVal)} cy={CY(0)} r="3" className="pn-min" /><text x={CX(trueVal) - 6} y="80" className="pn-tlbl">真值 {trueVal}{unit}</text></>}
              {/* 当前偏位姿点 */}
              {showCurve && !showSolved && <circle cx={CX(curVal)} cy={CY(rmsCur)} r="3" className="pn-cur" />}
              <text x="120" y="80" className="pn-albl">{scenLabel.split('(')[1]?.replace(')', '') ?? ''}</text>
              <text x="2" y="14" className="pn-albl">RMS</text>
            </svg>
          </div>
        </div>

        <div className="pn-flow">
          <div className={`pn-blk${showObs ? '' : ' pn-off'}`}>
            <span className="pn-n">①</span> 观测：真位姿把 4 个 3D 点投到像素 {showObs ? <>{obs.map((o, k) => `${LBL[k]}(${o})`).join('、')}（这些 2D-3D 对应 + K 就是 PnP 的输入）</> : '—'}
          </div>
          {showReproj && !showSolved && (
            <div className="pn-blk"><span className="pn-n">②</span> 试一个偏位姿（{curLabel}）重投影：每点残差 [{resid.join(', ')}]px、<b className="pn-badc">RMS={rmsCur}px</b>（位姿不对→投影对不上）。<b>PnP=找位姿让 Σ‖投影−观测‖² 最小</b>。</div>
          )}
          {showCurve && !showSolved && (
            <div className="pn-blk"><span className="pn-n">③</span> 沿该自由度扫一遍，重投影误差成<b>碗形</b>、<b className="pn-goodc">真值 {trueVal}{unit} 处最小(≈0)</b>——这就是 PnP 要在 6 维位姿空间里找的最低点。</div>
          )}
          {showSolved && (
            <div className="pn-blk-g"><span className="pn-n">④</span> 解到真值：4 点重投影<b className="pn-goodc">严丝合缝盖住观测、残差归零</b>。解法：<b>P3P</b>(3 点 4 解、第 4 点消歧)、<b>DLT</b>(≥6 线性)、<b>EPnP</b>(O(n))、高斯-牛顿/LM 精修 + RANSAC 去外点。</div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>PnP = 2D-3D 对应 + K → 6D 位姿</b>：准则是最小化重投影误差 Σ‖K[R|t]X−观测‖²（真位姿处=0）；解法 P3P/DLT/EPnP + 高斯牛顿精修 + RANSAC。<b>连</b>：「视觉里程计/SLAM」建好 3D 地图后靠 PnP 用 2D-3D 快速重定位；机械臂抓取先求物体 6D 位姿；「针孔相机」给投影与 K。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
