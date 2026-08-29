/** 舞台：卡尔曼滤波 —— 图上画真值/融合估计(带±√P不确定带)/GPS观测；侧栏走 predict(方差涨)+update(增益K融合、方差缩) */
import type { KalmanState } from '@engine/kernels/kalman.ts'
import type { StageProps } from '../types.ts'

const W = 380, H = 300, PAD = 34
const XMAX = 4, YMIN = 0, YMAX = 5
const sx = (step: number) => PAD + (step / XMAX) * (W - 2 * PAD)
const sy = (pos: number) => H - PAD - ((pos - YMIN) / (YMAX - YMIN)) * (H - 2 * PAD)

export function KalmanStage({ state }: StageProps<KalmanState>) {
  const { phase, op, Q, R, stepNo, x, P, truePos, z, K, innov, xPred, history, focus } = state
  const done = phase === 'done'
  const predicting = phase === 'predict'
  const sd = Math.round(Math.sqrt(P) * 1000) / 1000

  const gy = [0, 1, 2, 3, 4, 5]
  const truePath = history.map(h => `${sx(h.step)},${sy(h.truePos)}`).join(' ')
  const estPath = history.map(h => `${sx(h.step)},${sy(h.x)}`).join(' ')

  return (
    <div className="card">
      <h3>卡尔曼滤波 <span className="hint">predict(里程计,方差涨) + update(GPS,增益K融合,方差缩)</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'predict' ? 'Predict' : op === 'update' || op === 'summary' ? 'Update' : '就绪'}</span><span className="scdl">本拍</span></div>
          <div className="scdk"><span className="scdn">{x}</span><span className="scdl">估计 x（真值 {truePos}）</span></div>
          <div className="scdk"><span className={`scdn ${predicting ? 'km-up' : 'km-dn'}`}>{P}</span><span className="scdl">方差 P（±{sd}）</span></div>
        </div>

        <div className="fk-wrap">
          <svg className="fk-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
            {gy.map(v => <line key={'g' + v} x1={sx(0)} y1={sy(v)} x2={sx(XMAX)} y2={sy(v)} className="fk-grid" />)}
            {[0, 1, 2, 3, 4].map(s => <text key={'sx' + s} x={sx(s)} y={H - PAD + 15} className="km-axlbl" textAnchor="middle">{s}</text>)}
            {gy.map(v => <text key={'sy' + v} x={sx(0) - 10} y={sy(v) + 3} className="km-axlbl" textAnchor="end">{v}</text>)}
            {/* 真值线 + 估计线 */}
            {history.length > 1 && <polyline points={truePath} className="km-trueline" />}
            {history.length > 1 && <polyline points={estPath} className="km-estline" />}
            {/* 每个已完成步：观测、真值、估计+误差棒 */}
            {history.map(h => (
              <g key={'h' + h.step}>
                <line x1={sx(h.step)} y1={sy(h.x - h.sd)} x2={sx(h.step)} y2={sy(h.x + h.sd)} className="km-band" />
                <circle cx={sx(h.step)} cy={sy(h.z)} r={4} className="km-meas" />
                <circle cx={sx(h.step)} cy={sy(h.truePos)} r={3.5} className="km-true" />
                <circle cx={sx(h.step)} cy={sy(h.x)} r={4.5} className="km-est" />
              </g>
            ))}
            {/* predict 帧：当前步的预测点（大不确定带、待观测校正） */}
            {predicting && (
              <g>
                <line x1={sx(stepNo)} y1={sy(xPred - sd)} x2={sx(stepNo)} y2={sy(xPred + sd)} className="km-band pred" />
                <circle cx={sx(stepNo)} cy={sy(xPred)} r={4.5} className="km-est pred" />
                <circle cx={sx(stepNo)} cy={sy(truePos)} r={3.5} className="km-true" />
              </g>
            )}
          </svg>

          <div className="fk-side">
            <div className="km-legend">
              <span><i className="km-dot true" />真值</span>
              <span><i className="km-dot meas" />GPS观测</span>
              <span><i className="km-dot est" />融合估计±√P</span>
            </div>
            {op === 'predict' && (
              <div className="km-math pred">
                <div className="km-mh">Predict（预测·方差涨）</div>
                <div className="km-ml">x' = x + u = <b>{xPred}</b></div>
                <div className="km-ml">P' = P + Q({Q}) = <b>{P}</b> ↑</div>
              </div>
            )}
            {(op === 'update' || op === 'summary') && K !== null && (
              <div className="km-math upd">
                <div className="km-mh">Update（校正·方差缩）</div>
                <div className="km-ml">K = P'/(P'+R) = <b>{K}</b></div>
                <div className="km-ml">新息 z−x' = {z}−{xPred} = <b>{innov}</b></div>
                <div className="km-ml">x = x'+K·新息 = <b>{x}</b></div>
                <div className="km-ml">P = (1−K)·P' = <b>{P}</b> ↓</div>
              </div>
            )}
          </div>
        </div>

        {done
          ? <p className="scnote">卡尔曼把<b>预测</b>(运动模型,方差随 Q 涨)和<b>观测</b>(传感器,方差 R)用<b>增益 K=P/(P+R)</b>最优融合——K 是"信谁多一点"的权重(观测准→K 大→多信观测)。融合估计<b>比单独预测或观测都准</b>；方差 predict 涨、update 缩，收敛到稳态(K→~0.5)。估计一路贴着真值走。是里程计+GPS/IMU 融合定位、EKF、SLAM 的地基。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{predicting ? '只靠里程计推进：位置往前挪、但不确定度(方差)涨——预测点的误差棒变长，需要观测拉回。' : op === 'update' ? '增益 K 按方差权衡：把预测和观测融合成更准的估计，误差棒变短(更确定)。' : '两拍循环：predict 用运动模型前推(方差涨)、update 用观测校正(方差缩)。'}</p>}
      </div>
    </div>
  )
}
