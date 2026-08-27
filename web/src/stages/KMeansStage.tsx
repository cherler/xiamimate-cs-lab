/** 舞台：k-means —— 点按最近重心染色、重心移到均值，簇自己浮现 */
import type { KMeansState } from '@engine/kernels/kmeans.ts'
import type { StageProps } from '../types.ts'

const CL = ['var(--now)', 'var(--hit)', 'var(--miss)']
const LO = -3.2, HI = 3.2
const px = (x: number) => (x - LO) / (HI - LO) * 100
const py = (y: number) => 100 - (y - LO) / (HI - LO) * 100

export function KMeansStage({ state }: StageProps<KMeansState>) {
  const { iter, k, phase, points, assign, centroids, inertia, converged } = state
  const started = assign.some(a => a >= 0)
  return (
    <div className="card">
      <h3>k-means 聚类 <span className="hint">无标签的点，怎么自己分成几堆</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{iter + 1}</span><span className="scdl">第几轮</span></div>
          <div className="scdk"><span className="scdn">{k}</span><span className="scdl">簇数 k</span></div>
          <div className="scdk"><span className="scdn hot">{inertia}</span><span className="scdl">簇内平方和</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 点，按归属染色 */}
            {points.map((p, i) => (
              <circle key={i} cx={px(p[0])} cy={py(p[1])} r="1.7"
                fill={started && assign[i] >= 0 ? CL[assign[i] % 3] : 'var(--faint)'} opacity="0.9" />
            ))}
            {/* 重心，用 ✕ */}
            {centroids.map((c, k2) => (
              <g key={k2}>
                <line x1={px(c[0]) - 2.4} y1={py(c[1]) - 2.4} x2={px(c[0]) + 2.4} y2={py(c[1]) + 2.4} stroke={CL[k2 % 3]} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                <line x1={px(c[0]) - 2.4} y1={py(c[1]) + 2.4} x2={px(c[0]) + 2.4} y2={py(c[1]) - 2.4} stroke={CL[k2 % 3]} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                <circle cx={px(c[0])} cy={py(c[1])} r="3.4" fill="none" stroke={CL[k2 % 3]} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </svg>
          <div className="orcap">
            {!started ? '按「下一步」开始:先按最近重心分堆'
              : phase === 'assign' ? '分配:每个点归给离它最近的重心(✕)，按颜色分堆'
              : phase === 'move' || converged ? '更新:每个重心 ✕ 移到自己那堆点的平均位置'
              : ''}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">k-means 收敛:重心从乱初始 <b>march</b> 到三堆中心、簇内平方和从 54 降到 <b>{inertia}</b>、点的归属稳定。全程<b>没用任何标签</b>——纯靠"分给最近重心 → 重心移到均值"两步交替,让结构自己浮现。这就是<b>无监督聚类</b>,向量量化、图像分割、用户分群都用它。软肋:结果依赖初始重心、k 得人定。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{phase === 'assign' ? '只看"谁离哪个 ✕ 近",不看真实标签——所以叫无监督。' : '重心跳到自己那堆的中心后,下一轮点的归属可能又变——两步一直跳到不再变为止。'}簇内平方和每步都在降。</p>}
      </div>
    </div>
  )
}
