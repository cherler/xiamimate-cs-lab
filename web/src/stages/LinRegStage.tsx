/** 舞台：线性回归 —— 散点 + 拟合直线 + 残差竖线，梯度下降让 MSE 降到最小 */
import type { LinRegState } from '@engine/kernels/linreg.ts'
import type { StageProps } from '../types.ts'

const XLO = -2.6, XHI = 2.6, YLO = -5, YHI = 7
const px = (x: number) => (x - XLO) / (XHI - XLO) * 100
const py = (y: number) => 100 - (y - YLO) / (YHI - YLO) * 100

export function LinRegStage({ state }: StageProps<LinRegState>) {
  const { gdStep, w, b, mse, points, wOls, bOls, phase } = state
  const yAt = (x: number) => w * x + b
  return (
    <div className="card">
      <h3>线性回归 <span className="hint">机器怎么"拟合"一条线：梯度下降 + 最小二乘</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{gdStep}</span><span className="scdl">梯度下降步</span></div>
          <div className="scdk"><span className="scdn hot">{mse.toFixed(2)}</span><span className="scdl">均方误差 MSE</span></div>
          <div className="scdk"><span className="scdn">y={w.toFixed(2)}x+{b.toFixed(2)}</span><span className="scdl">当前直线</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* 轴 */}
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 残差竖线 */}
            {points.map((p, k) => (
              <line key={k} x1={px(p.x)} y1={py(p.y)} x2={px(p.x)} y2={py(yAt(p.x))} className="mlresid" vectorEffect="non-scaling-stroke" />
            ))}
            {/* 拟合直线 */}
            <line x1={px(XLO)} y1={py(yAt(XLO))} x2={px(XHI)} y2={py(yAt(XHI))} className="mlline" vectorEffect="non-scaling-stroke" />
            {/* 散点 */}
            {points.map((p, k) => (
              <circle key={k} cx={px(p.x)} cy={py(p.y)} r="1.6" className="mldot" />
            ))}
          </svg>
          <div className="orcap">
            {gdStep === 0 ? '起点 w=b=0：直线还平、残差(竖线)很长'
              : `直线 y=${w.toFixed(2)}x+${b.toFixed(2)} 往点云里转，残差变短；MSE=${mse.toFixed(2)}`}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">梯度下降 {gdStep} 步:MSE 从 8.8 降到 <b>{mse.toFixed(2)}</b>,直线稳穿点云。它正好收敛到<b>最小二乘闭式解</b> w={wOls}、b={bOls}——梯度下降找到的就是数学最优线。这就是机器"学习"最朴素的样子:<b>定损失(MSE)→对参数求梯度→沿负梯度更新→拟合</b>,几乎所有 ML 训练都是这个骨架。</p>
          : <p className="scnote" style={{ opacity: .85 }}>每个点到直线的<b>竖直距离</b>就是残差,平方再平均就是 MSE。梯度下降每步都朝"让 MSE 更小"的方向微调 w、b,于是直线一点点转到最贴合的位置。</p>}
      </div>
    </div>
  )
}
