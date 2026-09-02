/** 舞台：双目立体视觉 —— 左右图像条(点在 x_L/x_R)+视差括号 → 深度 Z=fb/d → 精度 ΔZ∝Z² */
import type { StereoState } from '@engine/kernels/stereo.ts'
import type { StageProps } from '../types.ts'

const SX = (px: number) => Math.max(8, Math.min(292, (px - 300) * 1.8 + 20))

export function StereoStage({ state }: StageProps<StereoState>) {
  const s = state
  const { scenLabel, f, b, cx, X, Ztrue, xL, xR, disp, Zrec, dZ, dZnear, dZfar, showProj, showDisp, showDepth, showPrec } = s
  const cxx = SX(cx)

  return (
    <div className="card">
      <h3>双目立体视觉 · 视差求深度 <span className="hint">两个平行相机把针孔丢掉的深度找回来：视差 d=f·b/Z，深度 Z=f·b/d</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{scenLabel.split('(')[0]}</span><span className="scdl">场景</span></div>
          <div className="scdk"><span className={`scdn${showDisp ? ' st-hot' : ''}`}>{showDisp ? `${disp}px` : '—'}</span><span className="scdl">视差 d=x_L−x_R</span></div>
          <div className="scdk"><span className={`scdn${showDepth ? ' st-good' : ''}`}>{showDepth ? `${Zrec}m` : '—'}</span><span className="scdl">深度 Z=f·b/d</span></div>
          <div className="scdk"><span className={`scdn${showPrec ? ' st-bad' : ''}`}>{showPrec ? `±${dZ}m` : '—'}</span><span className="scdl">1px 深度误差 ΔZ</span></div>
        </div>

        <svg className="st-svg" viewBox="0 0 300 96" width="100%" height="126">
          {/* 左图条 */}
          <rect x="8" y="8" width="284" height="18" className="st-strip" />
          <text x="12" y="20" className="st-slbl">左图</text>
          {/* 右图条 */}
          <rect x="8" y="40" width="284" height="18" className="st-strip" />
          <text x="12" y="52" className="st-slbl">右图</text>
          {/* 主点 cx 参考虚线 */}
          <line x1={cxx} y1="6" x2={cxx} y2="60" className="st-cx" />
          <text x={cxx + 2} y="70" className="st-cxlbl">cx</text>
          {showProj && <>
            <circle cx={SX(xL)} cy="17" r="3.4" className="st-ptL" />
            <text x={SX(xL) - 6} y="6" className="st-pxlbl">x_L={xL}</text>
            <circle cx={SX(xR)} cy="49" r="3.4" className="st-ptR" />
            <text x={SX(xR) - 6} y="38" className="st-pxlbl">x_R={xR}</text>
            {/* 竖引导线，方便看出左右横坐标差 */}
            <line x1={SX(xL)} y1="17" x2={SX(xL)} y2="80" className="st-guide" />
            <line x1={SX(xR)} y1="49" x2={SX(xR)} y2="80" className="st-guide" />
          </>}
          {showDisp && <>
            <line x1={SX(xR)} y1="80" x2={SX(xL)} y2="80" className="st-disp" />
            <text x={(SX(xL) + SX(xR)) / 2 - 20} y="92" className="st-displbl">视差 d={disp}px</text>
          </>}
        </svg>

        <div className="st-flow">
          <div className={`st-blk${showProj ? '' : ' st-off'}`}>
            <span className="st-n">①</span> 左右投影 {showProj ? <>x_L=f·X/Z+cx=<b>{xL}</b>、x_R=f·(X−b)/Z+cx=<b>{xR}</b>（右相机偏基线 b={b}m、点偏左）</> : '—'}
          </div>
          <div className={`st-blk${showDisp ? '' : ' st-off'}`}>
            <span className="st-n">②</span> 视差 {showDisp ? <>d=x_L−x_R=<b className="st-hotc">{disp}px</b> = f·b/Z（∝1/Z、<b>近大远小</b>）</> : '—'}
          </div>
          <div className={`st-blk${showDepth ? '' : ' st-off'}`}>
            <span className="st-n">③</span> 深度 {showDepth ? <>Z=f·b/d={f}·{b}/{disp}=<b className="st-goodc">{Zrec}m</b>（还原真实深度 {Ztrue}m；逐像素→深度图）</> : '—'}
          </div>
          {showPrec && (
            <div className="st-prec">
              <span className="st-n">④</span> 精度 ΔZ≈Z²/(f·b)·Δd <b>∝Z²</b>：1px 视差误差 → 近处(Z=2)ΔZ=<b className="st-goodc">{dZnear}m</b>、远处(Z=5)ΔZ=<b className="st-badc">{dZfar}m</b>（差 {Math.round(dZfar / dZnear * 100) / 100} 倍，<b>远处极不准</b>；加大 b/f 或亚像素视差可改善）。
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>双目 = 视差 → 深度</b>：视差 d=x_L−x_R=f·b/Z（∝1/Z、近大远小）；深度 Z=f·b/d（测出视差就得深度、逐像素得深度图）；精度 ΔZ∝Z²（远处极不准）。<b>连</b>：把「针孔相机」丢掉的深度找回来（单目→双目=从测不了绝对尺度到能测绝对深度）；深度图→点云→「ICP/SLAM」；找对应用极线（「对极几何」）。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
