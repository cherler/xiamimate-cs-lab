/** 舞台：梯度下降 —— 碗形损失面的等高线 + 顺负梯度走的下降轨迹 */
import type { GradDescState } from '@engine/kernels/graddesc.ts'
import type { StageProps } from '../types.ts'

const R = 5           // 坐标范围 [-R, R]
const SC = 100 / (2 * R)  // 世界坐标 → viewBox(100×100)
const cx = (x: number) => 50 + x * SC
const cy = (y: number) => 50 - y * SC   // y 向上

export function GradDescStage({ state }: StageProps<GradDescState>) {
  const { step, x, y, loss, gx, gy, lr, path, phase } = state
  const started = step >= 0
  const levels = [96, 50, 20, 5, 1]   // L=x²+5y² 的等高线
  return (
    <div className="card">
      <h3>梯度下降 <span className="hint">模型怎么"学"：顺着负梯度走到谷底</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? step : 0}</span><span className="scdl">迭代步</span></div>
          <div className="scdk"><span className="scdn hot">{started ? loss.toFixed(2) : '96.00'}</span><span className="scdl">损失 L</span></div>
          <div className="scdk"><span className="scdn">({started ? x.toFixed(2) : '4.00'}, {started ? y.toFixed(2) : '4.00'})</span><span className="scdl">位置 (x,y)</span></div>
          <div className="scdk"><span className="scdn">{lr}</span><span className="scdl">学习率</span></div>
        </div>

        {/* 损失面等高线 + 轨迹 */}
        <div className="gdwrap">
          <svg className="gdplot" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            {/* 坐标轴 */}
            <line x1="50" y1="4" x2="50" y2="96" className="gdaxis" />
            <line x1="4" y1="50" x2="96" y2="50" className="gdaxis" />
            {/* 等高线椭圆：x²+5y²=c → 半轴 √c(x)、√(c/5)(y) */}
            {levels.map((c, k) => (
              <ellipse key={k} cx="50" cy="50" rx={Math.sqrt(c) * SC} ry={Math.sqrt(c / 5) * SC} className="gdlevel" />
            ))}
            {/* 轨迹 */}
            {started && path.length > 1 && (
              <polyline points={path.map(p => `${cx(p.x)},${cy(p.y)}`).join(' ')} className="gdpath" vectorEffect="non-scaling-stroke" />
            )}
            {started && path.map((p, k) => (
              <circle key={k} cx={cx(p.x)} cy={cy(p.y)} r={k === path.length - 1 ? 2.4 : 1.4}
                className={k === path.length - 1 ? 'gddot now' : 'gddot'} />
            ))}
            {/* 谷底 */}
            <circle cx="50" cy="50" r="1.6" className="gdmin" />
          </svg>
          <div className="orcap">
            {started ? `等高线=损失 L=x²+5y² 的等值圈；顺负梯度 −(${gx.toFixed(1)}, ${gy.toFixed(1)}) 往谷底 (0,0) 走`
              : '按「下一步」从 (4,4) 开始下降'}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">损失从 96 单调降到 <b>{loss.toFixed(2)}</b>，逼近谷底。这就是神经网络"训练"的核心——沿负梯度 <b>θ ← θ − lr·∇L</b> 把损失一点点降下去。注意 y 方向更陡(曲率大)，步子容易迈过头、来回震荡:<b>学习率与曲率(条件数)的博弈</b>——太大发散、太小太慢。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>梯度指向上升最快方向，取负号朝下降最快走一步(步长=学习率)。看轨迹拐向谷底；y 方向陡，点在中轴两侧来回跳。</p>}
      </div>
    </div>
  )
}
