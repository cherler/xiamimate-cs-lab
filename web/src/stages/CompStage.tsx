/** 舞台：互补滤波 —— 倾角刻度尺(陀螺/加速度/融合三标记) + 陀螺积分/加速度/融合/取舍 逐块 */
import type { CompState } from '@engine/kernels/complementary.ts'
import type { StageProps } from '../types.ts'

export function CompStage({ state }: StageProps<CompState>) {
  const s = state
  const { blendLabel, blend, thetaPrev, omega, dt, thetaAcc, alpha, gyroPred, fused, driftPerSec, showGyro, showAccel, showFuse, showBehav } = s
  const LO = 29, HI = 33
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - LO) / (HI - LO)) * 100))}%`

  return (
    <div className="card">
      <h3>互补滤波 · IMU 姿态 <span className="hint">陀螺仪(短期准·长期漂) + 加速度计(绝对·但抖) 各取所长，融出倾角</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{blendLabel.split('(')[0]}</span><span className="scdl">混合 α={alpha}</span></div>
          <div className="scdk"><span className={`scdn${showGyro ? '' : ''}`}>{showGyro ? gyroPred : '—'}<em className="cc-u">°</em></span><span className="scdl">陀螺积分(漂)</span></div>
          <div className="scdk"><span className="scdn">{showAccel ? thetaAcc : '—'}<em className="cc-u">°</em></span><span className="scdl">加速度绝对(抖)</span></div>
          <div className="scdk"><span className={`scdn${showFuse ? ' co-hot' : ''}`}>{showFuse ? fused : '—'}<em className="cc-u">°</em></span><span className="scdl">融合倾角</span></div>
        </div>

        <div className="co-scale">
          <div className="co-track" />
          {[LO, 30, 31, 32, HI].map(t => <span key={t} className="co-gtick" style={{ left: pct(t) }}>{t}°</span>)}
          {showGyro && <div className="co-mark co-gyro" style={{ left: pct(gyroPred) }}><span>陀螺 {gyroPred}</span></div>}
          {showAccel && <div className="co-mark co-accel" style={{ left: pct(thetaAcc) }}><span>加速度 {thetaAcc}</span></div>}
          {showFuse && <div className="co-mark co-fused" style={{ left: pct(fused) }}><span>融合 {fused}</span></div>}
        </div>

        <div className="co-flow">
          <div className={`co-blk${showGyro ? '' : ' co-off'}`}>
            <span className="co-n">①</span> 陀螺积分 θ_gyro=θ_prev+ω·dt {showGyro ? <>={thetaPrev}+{omega}×{dt}=<b>{gyroPred}°</b></> : ''}<em className="co-sub">短期准、平滑；但 bias 逐秒漂 {driftPerSec}°（长期无限漂）</em>
          </div>
          <div className={`co-blk${showAccel ? '' : ' co-off'}`}>
            <span className="co-n">②</span> 加速度算绝对倾角 θ_acc=atan2(重力分量) {showAccel ? <>=<b>{thetaAcc}°</b></> : ''}<em className="co-sub">绝对、不漂（重力是天然参考）；但噪声大、抖，运动时线加速度污染</em>
          </div>
          <div className={`co-blk${showFuse ? '' : ' co-off'}`}>
            <span className="co-n">③</span> 互补融合 θ=α·陀螺+(1−α)·加速度 {showFuse ? <>={alpha}×{gyroPred}+{Math.round((1 - alpha) * 100) / 100}×{thetaAcc}=<b className="co-hot2">{fused}°</b></> : ''}<em className="co-sub">α·陀螺=高通(信短期)、(1−α)·加速度=低通(纠漂)</em>
          </div>
          {showBehav && (
            <div className="co-behav">
              <span className="co-n">④</span> <b>α 的取舍</b>：只陀螺(α=1)→平滑但<b className="co-bad">无限漂</b>；只加速度(α=0)→不漂但<b className="co-bad">抖得没法用</b>；互补(0&lt;α&lt;1)两全——α 大(≈0.98)平滑抗抖、纠漂慢，α 小跟加速度紧、压漂快但抖。工程常取 <b>α≈0.98</b>。
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>互补滤波 = 高通陀螺 + 低通加速度</b>：陀螺短期准长期漂→高通信短期；加速度绝对不漂但抖→低通信长期纠漂；α(定增益)权衡(大→平滑纠漂慢/小→纠漂快但抖，≈0.98 常用)。<b>vs 卡尔曼</b>：互补滤波就是<b>定增益的简化卡尔曼</b>(卡尔曼增益随不确定度自适应、这里固定成 1−α)。进阶：Mahony/Madgwick(3D 四元数上做、还在线估 bias)或 EKF。<b>连</b>：是「卡尔曼滤波」的简化版；3D 姿态用「位姿与四元数」。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
