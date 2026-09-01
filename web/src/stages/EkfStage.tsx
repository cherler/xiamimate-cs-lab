/** 舞台：EKF —— 1D 数轴+地标示意图 + 预测/非线性观测/雅可比线性化/更新 逐块现算 */
import type { EkfState } from '@engine/kernels/ekf.ts'
import type { StageProps } from '../types.ts'

export function EkfStage({ state }: StageProps<EkfState>) {
  const s = state
  const { trustLabel, xPrior, PPrior, u, Q, R, L, d, xPred, PPred, hPred, z, innov, H, S, K, xPost, PPost, showPred, showMeas, showJac, showUpd } = s
  // SVG 数轴 0..12 → 20..300px
  const W = 300, X0 = 20, SC = (W - X0 - 10) / 12
  const px = (v: number) => X0 + v * SC
  const yAx = 70, yLm = 24

  return (
    <div className="card">
      <h3>扩展卡尔曼滤波 EKF <span className="hint">卡尔曼的非线性扩展：在估计点用雅可比 H=∂h/∂x 把非线性观测就地线性化</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{trustLabel.split('(')[0]}</span><span className="scdl">测量信任</span></div>
          <div className="scdk"><span className={`scdn${showJac ? ' ek-hot' : ''}`}>{showJac ? H : '—'}</span><span className="scdl">雅可比 H=∂h/∂x</span></div>
          <div className="scdk"><span className={`scdn${showUpd ? ' ek-hot' : ''}`}>{showUpd ? xPost : xPred}</span><span className="scdl">位置估计 x̂</span></div>
          <div className="scdk"><span className={`scdn${showUpd ? ' ek-good' : ''}`}>{showUpd ? PPost : PPred}</span><span className="scdl">方差 P（越小越准）</span></div>
        </div>

        <svg className="ek-svg" viewBox="0 0 320 90" width="100%" height="96">
          {/* 地标 */}
          <circle cx={px(L)} cy={yLm} r="4" className="ek-lm" />
          <text x={px(L) + 7} y={yLm + 3} className="ek-lmt">地标({L},{d})</text>
          {/* 轴 */}
          <line x1={X0} y1={yAx} x2={W} y2={yAx} className="ek-axis" />
          {[0, 5, 10].map(t => <text key={t} x={px(t)} y={yAx + 15} className="ek-tick">{t}</text>)}
          {/* 距离连线(预测) */}
          {showMeas && <line x1={px(xPred)} y1={yAx} x2={px(L)} y2={yLm} className="ek-range" />}
          {showMeas && <text x={(px(xPred) + px(L)) / 2 - 6} y={(yAx + yLm) / 2 - 4} className="ek-ranget">h={hPred}</text>}
          {/* 机器人:先验/预测/后验 */}
          <circle cx={px(xPrior)} cy={yAx} r="3" className="ek-prior" /><text x={px(xPrior) - 4} y={yAx - 6} className="ek-lbl">先验{xPrior}</text>
          {showPred && <><circle cx={px(xPred)} cy={yAx} r="4" className="ek-pred" /><text x={px(xPred) - 4} y={yAx - 6} className="ek-lbl2">预测{xPred}</text></>}
          {showUpd && <><circle cx={px(xPost)} cy={yAx} r="4" className="ek-post" /><text x={px(xPost) - 4} y={yAx + 26} className="ek-lbl3">后验{xPost}</text></>}
        </svg>

        <div className="ek-flow">
          <div className={`ek-blk${showPred ? '' : ' ek-off'}`}>
            <span className="ek-n">①</span> 预测 {showPred ? <>x̂←x̂+u={xPrior}+{u}=<b>{xPred}</b>，P←P+Q={PPrior}+{Q}=<b>{PPred}</b></> : '—'}<em className="ek-sub">运动一步、不确定度增长</em>
          </div>
          <div className={`ek-blk${showMeas ? '' : ' ek-off'}`}>
            <span className="ek-n">②</span> 非线性观测 h(x̂)=√((L−x̂)²+d²){showMeas ? <>=<b>{hPred}</b>，实测 z={z} → 创新 y=z−h=<b>{innov}</b></> : ' —'}<em className="ek-sub">传感器测「距离」，对 x 非线性</em>
          </div>
          <div className={`ek-blk${showJac ? '' : ' ek-off'}`}>
            <span className="ek-n">③</span> <b className="ek-jt">雅可比 H=∂h/∂x=−(L−x̂)/h</b>{showJac ? <>=<b className="ek-jt">{H}</b>（EKF 精髓：在估计点就地线性化）</> : ' —'}<em className="ek-sub">x 增大 1、距离变多少；负=往右离地标更近</em>
          </div>
          <div className={`ek-blk${showUpd ? '' : ' ek-off'}`}>
            <span className="ek-n">④</span> 更新 {showUpd ? <>S=H²P+R=<b>{S}</b>，K=PH/S=<b>{K}</b>，x←x̂+Ky=<b>{xPost}</b>，P←(1−KH)P=<b>{PPost}</b></> : '—'}<em className="ek-sub">{s.trust === 'tight' ? 'R 小→信测量、K 大、P 收得狠' : 'R 大→信预测、K 小、P 收得少'}</em>
          </div>
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>EKF = 雅可比线性化 + 卡尔曼</b>：和线性卡尔曼唯一的不同——<b>在当前估计点对非线性 f/h 求雅可比(F/H)、就地线性化</b>，其余预测-更新照旧。<b>失效</b>：只做一阶线性化，强非线性 / 估计点离真值远 → 协方差失真甚至发散，改用 <b>UKF</b>(sigma 点、不求雅可比) 或<b>粒子滤波</b>(多峰/非高斯)。<b>连</b>：是「卡尔曼滤波」的非线性版(机器人定位/EKF-SLAM 主力)；求 H 用「雅可比矩阵」的偏导思想。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
