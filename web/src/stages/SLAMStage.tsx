/** 舞台：SLAM 回环校正 —— 真实回路(虚线)、里程计漂移轨迹(蓝,不闭合)、校正后轨迹(绿,闭合)；回环缺口高亮 */
import type { SLAMState } from '@engine/kernels/slam.ts'
import type { StageProps } from '../types.ts'

const SZ = 330, PAD = 24
const XMIN = -3, XMAX = 7, YMIN = -1, YMAX = 9
const SC = Math.min((SZ - 2 * PAD) / (XMAX - XMIN), (SZ - 2 * PAD) / (YMAX - YMIN))
const sx = (x: number) => PAD + (x - XMIN) * SC
const sy = (y: number) => SZ - PAD - (y - YMIN) * SC
const poly = (pts: [number, number][]) => pts.map(p => `${sx(p[0])},${sy(p[1])}`).join(' ')

export function SLAMStage({ state }: StageProps<SLAMState>) {
  const { phase, op, truePath, odom, corrected, poseNo, drift, driftMag, errOdom, errCorr, focus } = state
  const done = phase === 'done'
  const showLoop = phase === 'loopclose' || done
  const end = odom[odom.length - 1]!

  return (
    <div className="card">
      <h3>SLAM 回环校正 <span className="hint">里程计漂移→轨迹不闭合；回环把误差分摊回去、拉闭合</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? '已闭环' : phase === 'loopclose' ? '检测回环' : `位姿 ${poseNo}`}</span><span className="scdl">进度</span></div>
          <div className="scdk"><span className={`scdn ${driftMag > 0 ? 'sk-neg' : ''}`}>{driftMag || '—'}</span><span className="scdl">回环漂移</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '13px' }}>{done ? `${errOdom}→${errCorr}` : '—'}</span><span className="scdl">{done ? '轨迹误差(校正)' : '误差'}</span></div>
        </div>

        <div className="fk-wrap">
          <svg className="fk-svg" viewBox={`0 0 ${SZ} ${SZ}`} width={SZ} height={SZ}>
            {[-2, 0, 2, 4, 6].map(x => <line key={'gx' + x} x1={sx(x)} y1={sy(YMIN)} x2={sx(x)} y2={sy(YMAX)} className="fk-grid" />)}
            {[0, 2, 4, 6, 8].map(y => <line key={'gy' + y} x1={sx(XMIN)} y1={sy(y)} x2={sx(XMAX)} y2={sy(y)} className="fk-grid" />)}
            {/* 真实回路（虚线参考） */}
            <polyline points={poly(truePath)} className="slam-true" />
            {/* 里程计轨迹（漂移） */}
            <polyline points={poly(odom)} className={`slam-odom ${done ? 'dim' : ''}`} />
            {odom.map((p, i) => <circle key={'o' + i} cx={sx(p[0])} cy={sy(p[1])} r={2.5} className={`slam-odot ${done ? 'dim' : ''}`} />)}
            {/* 校正后轨迹 */}
            {corrected && <polyline points={poly(corrected)} className="slam-corr" />}
            {corrected && corrected.map((p, i) => <circle key={'c' + i} cx={sx(p[0])} cy={sy(p[1])} r={2.8} className="slam-cdot" />)}
            {/* 回环缺口 */}
            {showLoop && drift && !done && <line x1={sx(end[0])} y1={sy(end[1])} x2={sx(truePath[0]![0])} y2={sy(truePath[0]![1])} className="slam-gap" />}
            {/* 起点 */}
            <rect x={sx(0) - 5} y={sy(0) - 5} width={10} height={10} className="slam-start" />
            {/* 当前位姿 */}
            {phase === 'walk' && <circle cx={sx(end[0])} cy={sy(end[1])} r={5} className="slam-cur" />}
          </svg>

          <div className="fk-side">
            <div className="km-legend">
              <span><i className="km-dot" style={{ border: '1.5px dashed var(--faint)' }} />真实回路</span>
              <span><i className="km-dot" style={{ background: 'var(--miss)' }} />里程计(漂移)</span>
              {corrected && <span><i className="km-dot" style={{ background: 'var(--hit)' }} />校正后(闭合)</span>}
            </div>
            {op === 'loopclose' && drift && (
              <div className="slam-info lc">
                <div className="km-mh">回环检测</div>
                <div className="km-ml">终点 ({end[0]}, {end[1]}) ≠ 起点 (0,0)</div>
                <div className="km-ml brake">漂移 = ({drift[0]}, {drift[1]})，大小 {driftMag}</div>
              </div>
            )}
            {done && (
              <div className="slam-info ok">
                <div className="km-mh">位姿图优化（分摊校正）</div>
                <div className="km-ml">漂移按 i/N 分摊回整条轨迹</div>
                <div className="km-ml ok">终点回到 (0,0)、环闭合</div>
                <div className="km-ml ok">轨迹误差 {errOdom} → <b>{errCorr}</b></div>
              </div>
            )}
            {phase === 'walk' && <div className="slam-info"><div className="km-ml">里程计每步累积系统漂移，轨迹越走越偏、回不到起点。</div></div>}
          </div>
        </div>

        {done
          ? <p className="scnote">单靠里程计必然漂移(越走越偏)；<b>回环检测</b>认出旧地、加一条"这里=那里"约束，<b>位姿图优化</b>把误差分摊回整条轨迹、一次拉正——误差 {errOdom}→{errCorr}，环闭合。这是 SLAM 精度的关键一跃。本例用按比例分摊演示直觉；真实是 SE(2)/SE(3) 非线性最小二乘(g2o/GTSAM)，同时优化位姿和地标。前端找回环靠 ICP 扫描匹配/视觉词袋。扫地机、自动驾驶、无人机建图的地基。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{phase === 'walk' ? '里程计的系统误差每步累积，蓝线越走越偏离真实回路(虚线)、回不到起点。' : op === 'loopclose' ? '走完一圈，里程计终点和起点差一个缺口=累计漂移。机器人认出回到旧地，就能用这个约束校正。' : '机器人沿闭合回路走，看里程计怎么漂、回环怎么拉回。'}</p>}
      </div>
    </div>
  )
}
