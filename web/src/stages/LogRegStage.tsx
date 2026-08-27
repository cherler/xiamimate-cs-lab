/** 舞台：逻辑回归 —— 两类散点 + 决策边界(z=0)转到中间，概率场按 sigmoid 渐变 */
import type { LogRegState } from '@engine/kernels/logreg.ts'
import type { StageProps } from '../types.ts'

const CA = 'var(--now)', CB = 'var(--miss)'
const LO = -3, HI = 3
const px = (x: number) => (x - LO) / (HI - LO) * 100
const py = (y: number) => 100 - (y - LO) / (HI - LO) * 100

export function LogRegStage({ state }: StageProps<LogRegState>) {
  const { gdStep, w1, w2, b, loss, acc, points, phase } = state
  const hasLine = Math.abs(w1) + Math.abs(w2) > 1e-6
  // 边界 w1·x+w2·y+b=0 → y = -(w1 x + b)/w2
  const yb = (x: number) => -(w1 * x + b) / (w2 || 1e-6)
  // 概率场：沿 (w1,w2) 方向的线性渐变（近似 sigmoid 场）
  const nrm = Math.hypot(w1, w2) || 1
  const gx = w1 / nrm, gy = w2 / nrm
  return (
    <div className="card">
      <h3>逻辑回归 <span className="hint">把"拟合直线"改造成"分两类"</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{gdStep}</span><span className="scdl">梯度下降步</span></div>
          <div className="scdk"><span className="scdn hot">{loss.toFixed(3)}</span><span className="scdl">交叉熵损失</span></div>
          <div className="scdk"><span className="scdn">{(acc * 100).toFixed(0)}%</span><span className="scdl">准确率</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lrprob" x1={`${50 - gx * 50}%`} y1={`${50 + gy * 50}%`} x2={`${50 + gx * 50}%`} y2={`${50 - gy * 50}%`}>
                <stop offset="0%" stopColor={CA} stopOpacity="0.14" />
                <stop offset="50%" stopColor="var(--panel)" stopOpacity="0" />
                <stop offset="100%" stopColor={CB} stopOpacity="0.14" />
              </linearGradient>
            </defs>
            {hasLine && <rect x="0" y="0" width="100" height="100" fill="url(#lrprob)" />}
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 决策边界 */}
            {hasLine && <line x1={px(LO)} y1={py(yb(LO))} x2={px(HI)} y2={py(yb(HI))} className="mlline" vectorEffect="non-scaling-stroke" />}
            {/* 点 */}
            {points.map((p, k) => (
              <circle key={k} cx={px(p.x)} cy={py(p.y)} r="1.8" fill={p.c === 0 ? CA : CB} opacity="0.92" />
            ))}
          </svg>
          <div className="orcap">
            {gdStep === 0 ? '起点 w=b=0：还没有边界,概率全 0.5、蒙对一半'
              : `决策边界(z=0 那条线)转到两类之间;两侧按 sigmoid 概率渐变染色;准确率 ${(acc * 100).toFixed(0)}%`}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">梯度下降 {gdStep} 步:交叉熵从 0.69 降到 <b>{loss.toFixed(3)}</b>、准确率 <b>{(acc * 100).toFixed(0)}%</b>,决策边界把两类干净分开。逻辑回归=线性打分 z → <b>sigmoid</b> 出概率 → <b>交叉熵</b>当损失 → 梯度下降调 w、b。它就是<b>单个神经元 + sigmoid</b>——理解它就摸到了神经网络最小的那块砖。和线性回归同一套骨架,只是把"拟合连续值"换成了"分两类"。</p>
          : <p className="scnote" style={{ opacity: .85 }}>线性打分 z=w₁x+w₂y+b,sigmoid 把 z 压成"属于第 1 类的概率";边界(z=0)一侧判 1、另一侧判 0。梯度下降沿交叉熵下降方向调 w、b,把边界转到分得开的位置。</p>}
      </div>
    </div>
  )
}
