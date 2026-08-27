/** 舞台：k-NN —— 待判点找最近 k 个邻居投票，2D 散点 + 连线 + 票数 */
import type { KNNState } from '@engine/kernels/knn.ts'
import type { StageProps } from '../types.ts'

const CA = 'var(--now)', CB = 'var(--miss)'
const LO = -3, HI = 3
const px = (x: number) => (x - LO) / (HI - LO) * 100
const py = (y: number) => 100 - (y - LO) / (HI - LO) * 100

export function KNNStage({ state }: StageProps<KNNState>) {
  const { k, seen, query, points, neighbors, voteA, voteB, predict, phase } = state
  const seenIdx = new Set(neighbors.map(n => n.idx))
  const reach = neighbors.length ? neighbors[neighbors.length - 1].dist : 0
  return (
    <div className="card">
      <h3>k-近邻 k-NN <span className="hint">不训练，直接看邻居投票来分类</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{k}</span><span className="scdl">看几个最近邻</span></div>
          <div className="scdk"><span className="scdn" style={{ color: CA }}>{voteA}</span><span className="scdl">A 票</span></div>
          <div className="scdk"><span className="scdn" style={{ color: CB }}>{voteB}</span><span className="scdl">B 票</span></div>
          <div className="scdk"><span className="scdn hot">{predict === 0 ? 'A' : predict === 1 ? 'B' : '?'}</span><span className="scdl">判为</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 覆盖半径圈 */}
            {reach > 0 && <circle cx={px(query.x)} cy={py(query.y)} r={reach / (HI - LO) * 100} fill="none" stroke="var(--dim)" strokeWidth="0.5" strokeDasharray="2 2" opacity=".5" />}
            {/* 连线到已揭示邻居 */}
            {neighbors.map((n, j) => {
              const p = points[n.idx]
              return <line key={j} x1={px(query.x)} y1={py(query.y)} x2={px(p.x)} y2={py(p.y)} stroke={n.c === 0 ? CA : CB} strokeWidth="0.7" vectorEffect="non-scaling-stroke" opacity=".7" />
            })}
            {/* 点 */}
            {points.map((p, i) => (
              <circle key={i} cx={px(p.x)} cy={py(p.y)} r={seenIdx.has(i) ? 2.1 : 1.5}
                fill={p.c === 0 ? CA : CB} opacity={seenIdx.has(i) ? 1 : 0.5}
                stroke={seenIdx.has(i) ? 'var(--ink)' : 'none'} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
            ))}
            {/* 待判点：星形用菱形代替 */}
            <rect x={px(query.x) - 2} y={py(query.y) - 2} width="4" height="4" transform={`rotate(45 ${px(query.x)} ${py(query.y)})`} fill="var(--hit)" stroke="var(--ink)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="orcap">
            {seen === 0 ? '◆=待判点;蓝=A 类、红=B 类。按「下一步」逐个找最近邻'
              : `已找最近 ${seen} 个邻居(虚线圈=覆盖半径);A ${voteA} 票 vs B ${voteB} 票`}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">k={k}:最近 {k} 个邻居投票 A {voteA} : B {voteB} → 判 <b>{predict === 0 ? 'A' : 'B'}</b>。k-NN <b>不训练</b>,靠"按距离找最近邻 + 多数表决"当场分类。这个点在<b>边界附近</b>,把 k 从 1 调到 7,判断会 A→B→A 来回翻——<b>k 小敏感(边界毛糙)、k 大平滑(更稳但糊细节)</b>,正是偏差-方差权衡的直观版。它和注意力"近的权重大"一脉相承。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{seen === 0 ? 'k-NN 没有"训练"这一步——预测时才现算距离、找最近的几个邻居。' : '每多看一个邻居,票数就更新一次;够 k 个了就按多数表决定类。调上面的 k 看判断变不变。'}</p>}
      </div>
    </div>
  )
}
