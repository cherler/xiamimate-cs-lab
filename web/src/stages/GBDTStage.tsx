/** 舞台：GBDT —— 1D 数据 + 预测阶梯，每轮加一棵小树拟合残差，阶梯贴近数据、MSE 降 */
import type { GBDTState } from '@engine/kernels/gbdt.ts'
import type { StageProps } from '../types.ts'

const XLO = -0.05, XHI = 1.05, YLO = 0, YHI = 4
const px = (x: number) => (x - XLO) / (XHI - XLO) * 100
const py = (y: number) => 100 - (y - YLO) / (YHI - YLO) * 100

export function GBDTStage({ state }: StageProps<GBDTState>) {
  const { round, points, pred, mse, splitT, phase } = state
  // 预测折线（按 x 顺序，点本身已按 i=x 递增）
  const line = points.map((p, k) => `${k ? 'L' : 'M'}${px(p.x).toFixed(1)} ${py(pred[k]).toFixed(1)}`).join(' ')
  return (
    <div className="card">
      <h3>梯度提升树 GBDT <span className="hint">一棵棵小树接力，每棵只补上一棵的"错"</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{round}</span><span className="scdl">提升了几轮</span></div>
          <div className="scdk"><span className="scdn hot">{mse.toFixed(3)}</span><span className="scdl">均方误差 MSE</span></div>
          <div className="scdk"><span className="scdn">{round}</span><span className="scdl">用了几棵小树</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 残差竖线 */}
            {points.map((p, k) => (
              <line key={'r' + k} x1={px(p.x)} y1={py(p.y)} x2={px(p.x)} y2={py(pred[k])} className="mlresid" vectorEffect="non-scaling-stroke" />
            ))}
            {/* 预测折线（阶梯） */}
            <path d={line} className="mlline" vectorEffect="non-scaling-stroke" fill="none" />
            {/* 数据点 */}
            {points.map((p, k) => (
              <circle key={k} cx={px(p.x)} cy={py(p.y)} r="1.5" className="mldot" />
            ))}
          </svg>
          <div className="orcap">
            {round === 0 ? '第 0 轮:预测=一条平线(所有 y 的均值),残差(竖线)很长'
              : `第 ${round} 轮:又加一棵只切一刀(x≈${splitT})的小树拟合残差;预测阶梯更贴数据、残差变短`}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">boosting {round} 轮:MSE 从 0.75 降到 <b>{mse.toFixed(3)}</b>,预测阶梯稳稳贴上数据。每棵小树都只补"前面还没拟合掉的<b>残差</b>"——<b>一堆弱学习器接力 = 一个强学习器</b>。因为每棵拟合的是残差/梯度,故名<b>梯度提升</b>。它和随机森林(并行投票)并称集成学习两大路线;GBDT/XGBoost/LightGBM 至今是表格数据主力。它坐在决策树之上,把很多棵串起来。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{round === 0 ? '起点只有一个常数预测(均值),什么规律都没学,残差很大。' : '每一轮不是重新拟合,而是拟合"当前还差多少"(残差)——弱小的一刀树,一棵棵叠起来就越来越准。'}</p>}
      </div>
    </div>
  )
}
