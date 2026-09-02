/** 舞台：CHOMP —— 2D 轨迹(初始直线+更新后曲线)+障碍/影响圈+q2 梯度箭头；轨迹/避障/平滑/下降 逐块 */
import type { ChompState } from '@engine/kernels/chomp.ts'
import type { StageProps } from '../types.ts'

const SC = 62, OX = 34, OY = 56, YS = 34
const PX = (x: number) => OX + x * SC
const PY = (y: number) => OY - y * YS

export function ChompStage({ state }: StageProps<ChompState>) {
  const s = state
  const { wLabel, w, kObs, d0, obs, traj, distToObs, gObs, gSmooth, q2New, trajNew, showTraj, showObs, showSmooth, showStep } = s
  const q2 = traj[2]!
  const line = (pts: [number, number][]) => pts.map(p => `${PX(p[0])},${PY(p[1])}`).join(' ')

  return (
    <div className="card">
      <h3>CHOMP · 轨迹优化 <span className="hint">把整条轨迹当变量，梯度下降降"平滑 + 避障"代价（优化式规划）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{wLabel.split('(')[0]}</span><span className="scdl">权重(k_obs={kObs})</span></div>
          <div className="scdk"><span className={`scdn${showObs ? (distToObs < d0 ? ' cm-bad' : '') : ''}`}>{showTraj ? distToObs : '—'}</span><span className="scdl">q2 离障碍（&lt;d0={d0} 危险）</span></div>
          <div className="scdk"><span className="scdn">{showObs ? `[${gObs}]` : '—'}</span><span className="scdl">避障梯度</span></div>
          <div className="scdk"><span className={`scdn${showStep ? ' cm-hot' : ''}`}>{showStep ? `(${q2New})` : '—'}</span><span className="scdl">q2 更新后</span></div>
        </div>

        {showTraj && (
          <svg className="cm-svg" viewBox="0 0 320 100" width="100%" height="120">
            {/* 障碍 + 影响圈 */}
            {showObs && <circle cx={PX(obs[0])} cy={PY(obs[1])} r={d0 * ((SC + YS) / 2)} className="cm-infl" />}
            <circle cx={PX(obs[0])} cy={PY(obs[1])} r="6" className="cm-obs" />
            <text x={PX(obs[0]) + 8} y={PY(obs[1]) + 3} className="cm-obst">障碍</text>
            {/* 初始轨迹 */}
            <polyline points={line(traj)} className="cm-traj0" fill="none" />
            {/* 更新后轨迹 */}
            {showStep && <polyline points={line(trajNew)} className="cm-traj1" fill="none" />}
            {/* 路点 */}
            {traj.map((p, k) => <circle key={k} cx={PX(p[0])} cy={PY(p[1])} r={k === 0 || k === 4 ? 4 : 3} className={k === 0 || k === 4 ? 'cm-end' : 'cm-wp'} />)}
            {/* q2 梯度箭头(向下=避障) */}
            {showObs && gObs[1] !== 0 && <>
              <line x1={PX(q2[0])} y1={PY(q2[1])} x2={PX(q2[0])} y2={PY(q2[1]) - gObs[1] * YS * 1.2} className="cm-garrow" />
              <text x={PX(q2[0]) + 5} y={PY(q2[1]) + 14} className="cm-glbl">避障梯度</text>
            </>}
            {/* q2 更新后位置 */}
            {showStep && <circle cx={PX(q2New[0])} cy={PY(q2New[1])} r="4" className="cm-q2new" />}
          </svg>
        )}

        <div className="cm-flow">
          <div className={`cm-blk${showTraj ? '' : ' cm-off'}`}>
            <span className="cm-n">①</span> 初始直线轨迹 5 路点 {showTraj ? <>；代价 U=平滑项+避障项；中点 q2=({q2}) 离障碍仅 <b className={distToObs < d0 ? 'cm-r' : ''}>{distToObs}</b>&lt;d0={d0}</> : '—'}
          </div>
          <div className={`cm-blk${showObs ? '' : ' cm-off'}`}>
            <span className="cm-n">②</span> 避障梯度 ∝(d0−dist)·远离方向 {showObs ? <>=k_obs·({d0}−{distToObs})·(离障碍) = <b className="cm-r2">[{gObs}]</b>（往下推、离开上方障碍；越近越猛）</> : '—'}
          </div>
          <div className={`cm-blk${showSmooth ? '' : ' cm-off'}`}>
            <span className="cm-n">③</span> 平滑梯度 = 邻居中点−q2 {showSmooth ? <>=<b>[{gSmooth}]</b>（直线上 q2 正在邻居中点、平滑梯度=0；被推偏后才出现、带邻居跟随）</> : '—'}
          </div>
          {showStep && (
            <div className="cm-step">
              <span className="cm-n">④</span> 下降一步 q2←q2+α(避障+平滑)=({q2})+[{gObs}] → <b className="cm-h">({q2New})</b>：{w === 'avoid' ? '避障优先、推得狠(y=−0.8)、明显绕下去' : '平滑优先、推得轻(y=−0.2)、更直但擦障碍'}，避障代价下降。迭代→整条平滑绕过。
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>CHOMP = 对一整条轨迹做梯度下降</b>：代价 U=平滑项(惩罚急转)+避障项(近障碍罚)；避障梯度推离障碍、平滑梯度拉向邻居中点；ξ←ξ−α∇U 整条协同变形、绕障碍且平滑。协变(用度量矩阵)更稳。<b>死穴=局部极小</b>(同势场，常从多初值或先 RRT 出初值再 CHOMP)。<b>vs 其它</b>：采样(RRT)/搜索(A*)/反应(势场)/优化(CHOMP)——CHOMP 直接产出平滑可执行轨迹。<b>连</b>：RRT 可当初值、势场同为梯度思路、轨迹规划配时间。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
