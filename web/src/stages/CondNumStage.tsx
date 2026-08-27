/** 舞台：条件数 —— κ 越大碗越扁，梯度下降从"一步到位"变成"之字形爬半天" */
import type { CondNumState } from '@engine/kernels/condnum.ts'
import type { StageProps } from '../types.ts'

// 视图：x∈[-0.2,1.15] y∈[-1.15,1.15] → viewBox 100×100
const cx = (x: number) => 18 + x * 70
const cy = (y: number) => 50 - y * 38

export function CondNumStage({ state }: StageProps<CondNumState>) {
  const { kappa, steps, rate, path, phase } = state
  const started = kappa > 0
  // 椭圆 L=x²+κy²=c 的半轴：rx=√c, ry=√(c/κ)
  const levels = [1, 0.5, 0.2, 0.05]
  return (
    <div className="card">
      <h3>条件数 <span className="hint">为什么"病态"的问题又慢又难算</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? kappa : '—'}</span><span className="scdl">条件数 κ</span></div>
          <div className="scdk"><span className="scdn hot">{started ? steps : '—'}</span><span className="scdl">收敛步数</span></div>
          <div className="scdk"><span className="scdn">{started ? rate.toFixed(2) : '—'}</span><span className="scdl">每步误差缩 (κ−1)/(κ+1)</span></div>
        </div>

        <div className="cnwrap">
          <svg className="cnplot" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            {/* 轴 */}
            <line x1="6" y1={cy(0)} x2="96" y2={cy(0)} className="cnaxis" />
            <line x1={cx(0)} y1="8" x2={cx(0)} y2="92" className="cnaxis" />
            {/* 椭圆等高线：κ 大 → 竖直方向被压扁成细椭圆 */}
            {started && levels.map((c, k) => (
              <ellipse key={k} cx={cx(0)} cy={cy(0)} rx={Math.sqrt(c) * 70} ry={Math.sqrt(c / kappa) * 38} className="cnlevel" />
            ))}
            {/* 之字形轨迹 */}
            {started && path.length > 1 && (
              <polyline points={path.map(p => `${cx(p.x)},${cy(p.y)}`).join(' ')} className="cnpath" vectorEffect="non-scaling-stroke" />
            )}
            {started && path.slice(0, 24).map((p, k) => (
              <circle key={k} cx={cx(p.x)} cy={cy(p.y)} r={k === 0 ? 2.2 : 1.2} className={k === 0 ? 'cndot start' : 'cndot'} />
            ))}
            <circle cx={cx(0)} cy={cy(0)} r="1.6" className="cnmin" />
          </svg>
          <div className="orcap">
            {started
              ? `损失 L=x²+${kappa}y² 的等高线${kappa === 1 ? '(正圆)' : '(κ 越大越扁)'}；梯度下降轨迹 ${steps} 步到谷底`
              : '按「下一步」把条件数 κ 从 1 加到 50'}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">κ 从 1→50:收敛步数 1→12→47→<b>{steps}</b>——<b>问题越病态(κ 越大)、越慢越难算</b>。κ 大时碗被拉成细长椭圆,梯度几乎垂直于通往谷底的方向、只能<b>之字形</b>慢挪,每步误差只缩 (κ−1)/(κ+1)(κ 大→接近 1→几乎不降)。所以要<b>预处理/归一化/Adam</b>把 κ 拉回接近 1;数值上 κ 大还意味着解对噪声极敏感。这是「梯度下降」那条的深层解释。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>{kappa === 1 ? '正圆碗:梯度直指圆心,一步到位。' : '椭圆越扁,梯度越偏离"通往谷底"的方向;陡的 y 方向步子迈过头、平的方向挪不动,于是来回之字形。'}</p>}
      </div>
    </div>
  )
}
