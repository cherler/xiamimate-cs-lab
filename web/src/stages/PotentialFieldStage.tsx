/** 舞台：势场法 —— 2D 平面(目标/障碍+影响圈/机器人)+ 引力绿/斥力红/合力蓝三箭头；逐块现算，结局横幅 */
import type { PotState } from '@engine/kernels/potentialfield.ts'
import type { StageProps } from '../types.ts'

const SC = 25, OX = 20, OY = 92, YSC = 16
const PX = (x: number) => OX + x * SC
const PY = (y: number) => OY - y * YSC

function Arrow({ from, vec, cls, label, k = 7 }: { from: [number, number]; vec: [number, number]; cls: string; label?: string; k?: number }) {
  const x1 = PX(from[0]), y1 = PY(from[1])
  const x2 = x1 + vec[0] * k, y2 = y1 - vec[1] * k
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const ah = 5
  return (
    <g className={cls}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="po-arrline" />
      <line x1={x2} y1={y2} x2={x2 - ah * Math.cos(ang - 0.5)} y2={y2 - ah * Math.sin(ang - 0.5)} className="po-arrline" />
      <line x1={x2} y1={y2} x2={x2 - ah * Math.cos(ang + 0.5)} y2={y2 - ah * Math.sin(ang + 0.5)} className="po-arrline" />
      {label && <text x={x2 + 3} y={y2 + (vec[1] >= 0 ? -2 : 8)} className="po-arrlbl">{label}</text>}
    </g>
  )
}

export function PotentialFieldStage({ state }: StageProps<PotState>) {
  const s = state
  const { scenLabel, scen, robot, goal, obs, rho0, rhoGoal, rhoObs, fAtt, fRep, fTotal, fMag, distToGoal, stuck, showAtt, showRep, showTotal, showOut } = s

  return (
    <div className="card">
      <h3>人工势场法 · 反应式规划 <span className="hint">目标产生引力、障碍产生斥力，机器人顺合力"下山"；快，但有局部极小死穴</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{scenLabel.split('(')[0]}</span><span className="scdl">场景</span></div>
          <div className="scdk"><span className="scdn">{showTotal ? fMag : '—'}</span><span className="scdl">合力大小 |F|</span></div>
          <div className="scdk"><span className={`scdn${showOut ? (stuck ? ' po-bad' : ' po-good') : ''}`}>{showOut ? (stuck ? '卡住' : '绕过') : '—'}</span><span className="scdl">结局</span></div>
          <div className="scdk"><span className={`scdn${showOut && stuck ? ' po-bad' : ''}`}>{distToGoal}</span><span className="scdl">离目标距离</span></div>
        </div>

        <svg className="po-svg" viewBox="0 0 320 100" width="100%" height="128">
          {/* 障碍影响圈 */}
          <circle cx={PX(obs[0])} cy={PY(obs[1])} r={rho0 * SC} className="po-infl" />
          {/* 障碍 */}
          <circle cx={PX(obs[0])} cy={PY(obs[1])} r="7" className="po-obs" />
          <text x={PX(obs[0])} y={PY(obs[1]) + 3} className="po-obst">障</text>
          {/* 目标 */}
          <circle cx={PX(goal[0])} cy={PY(goal[1])} r="7" className="po-goal" />
          <text x={PX(goal[0])} y={PY(goal[1]) + 3} className="po-goalt">目</text>
          {/* 力箭头 */}
          {showAtt && <Arrow from={robot} vec={fAtt} cls="po-att" label="引力" />}
          {showRep && (fRep[0] !== 0 || fRep[1] !== 0) && <Arrow from={robot} vec={fRep} cls="po-rep" label="斥力" />}
          {showTotal && <Arrow from={robot} vec={fTotal} cls="po-tot" label="合力" k={7} />}
          {/* 机器人 */}
          <circle cx={PX(robot[0])} cy={PY(robot[1])} r="5" className="po-robot" />
          <text x={PX(robot[0]) - 2} y={PY(robot[1]) + 16} className="po-robott">机器人</text>
        </svg>

        <div className="po-flow">
          <div className={`po-blk${showAtt ? '' : ' po-off'}`}>
            <span className="po-n">①</span> 引力 F_att=k_att·(q_goal−q) {showAtt ? <>=<b className="po-g">[{fAtt.join(', ')}]</b>（指向目标、正比距离 {rhoGoal}）</> : '—'}
          </div>
          <div className={`po-blk${showRep ? '' : ' po-off'}`}>
            <span className="po-n">②</span> 斥力 F_rep=k_rep·(1/ρ−1/ρ0)·(1/ρ²)·n̂ {showRep ? (rhoObs <= rho0 ? <>=<b className="po-r">[{fRep.join(', ')}]</b>（ρ={rhoObs}≤ρ0，越近越猛）</> : <>=0（ρ={rhoObs}&gt;ρ0，影响圈外）</>) : '—'}
          </div>
          <div className={`po-blk${showTotal ? '' : ' po-off'}`}>
            <span className="po-n">③</span> 合力 F=F_att+F_rep {showTotal ? <>=[{fAtt.join(',')}]+[{fRep.join(',')}]=<b className="po-t">[{fTotal.join(', ')}]</b>，大小 {fMag}</> : '—'}
          </div>
          {showOut && (
            <div className={`po-out ${stuck ? 'po-ostuck' : 'po-oreach'}`}>
              <span className="po-n">④</span> {stuck
                ? <><b>卡在局部极小</b>：障碍正中 → 引力(+x {fAtt[0]})和斥力(−x {fRep[0]})几乎抵消、合力仅 <b>{fMag}</b>≈0，可机器人离目标还有 <b>{distToGoal}</b>——滑进障碍前的"假谷"、停住、到不了目标。这是势场法最有名的死穴。</>
                : <><b>绕过、到达</b>：障碍偏侧 → 斥力有横向分量(y {fRep[1]})，合力 [{fTotal.join(',')}] 把机器人往障碍旁边带，顺势绕过、继续下山到目标。</>}
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>势场法 = 引力+斥力顺合力下山</b>：F_att=k_att·(q_goal−q) 拉向目标、F_rep(仅 ρ≤ρ0、∝1/ρ²)推离障碍、顺合力梯度下降。极简反应式快、天然实时避障。<b>死穴=局部极小</b>：障碍正中时引力斥力抵消、卡在离目标很远的假谷。<b>解法</b>：随机扰动跳出 / 导航函数(只有目标一个极小) / 配全局规划(RRT/A* 出全局路、势场只做局部避障)。<b>连</b>：RRT/RRT* 是全局采样(无局部极小)；力控虚拟弹簧和斥力场同源。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
