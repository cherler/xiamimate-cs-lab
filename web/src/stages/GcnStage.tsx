/** 舞台：图卷积 GCN —— 图上每个节点聚合(自己+邻居)的特征做平均，信息沿边渗一跳 */
import type { GcnState } from '@engine/kernels/gcn.ts'
import type { StageProps } from '../types.ts'

const W = 340, H = 220
const heat = (v: number | null) => v === null ? 'var(--panel)'
  : `color-mix(in srgb, #3b82f6 ${Math.round(Math.min(1, v) * 74)}%, var(--panel))`

export function GcnStage({ state }: StageProps<GcnState>) {
  const { pos, edges, feat, newFeat, cur, agg, result, phase } = state
  const done = phase === 'done'
  const px = (x: number) => 24 + x * (W - 48)
  const py = (y: number) => 20 + y * (H - 40)
  const aggSet = new Set(agg)
  const show = done ? newFeat : feat.map((f, i) => newFeat[i] ?? f)
  return (
    <div className="card">
      <h3>图卷积 GCN <span className="hint">每个节点聚合邻居的特征更新自己，信息沿边传播</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{cur >= 0 ? `节点 ${cur}` : done ? '一层完成' : '5 节点'}</span><span className="scdl">当前聚合</span></div>
          <div className="scdk"><span className="scdn">{cur >= 0 && !done ? result : '—'}</span><span className="scdl">新特征值</span></div>
          <div className="scdk"><span className="scdn">1 跳</span><span className="scdl">一层的感受野</span></div>
        </div>

        <div className="gcnwrap">
          <svg className="gcntree" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            {edges.map(([a, b], k) => {
              const lit = !done && cur >= 0 && (a === cur || b === cur)
              return <line key={k} x1={px(pos[a].x)} y1={py(pos[a].y)} x2={px(pos[b].x)} y2={py(pos[b].y)}
                stroke={lit ? 'var(--now)' : 'var(--line)'} strokeWidth={lit ? 2.4 : 1.2} />
            })}
            {pos.map((p, v) => {
              const isCur = v === cur && !done
              const inAgg = !done && aggSet.has(v) && v !== cur
              const fv = done ? newFeat[v] : (newFeat[v] ?? feat[v])
              return (
                <g key={v}>
                  {isCur && <circle cx={px(p.x)} cy={py(p.y)} r="20" fill="none" stroke="var(--now)" strokeWidth="2" />}
                  <circle cx={px(p.x)} cy={py(p.y)} r="15" fill={heat(fv)}
                    stroke={isCur ? 'var(--now)' : inAgg ? 'var(--hit)' : 'var(--line)'} strokeWidth={isCur || inAgg ? 2 : 1} />
                  <text x={px(p.x)} y={py(p.y) - 1} textAnchor="middle" fontSize="8" fontWeight={700} fill={(fv ?? 0) > 0.5 ? 'var(--panel)' : 'var(--ink)'}>{fv === null ? '' : fv}</text>
                  <text x={px(p.x)} y={py(p.y) + 26} textAnchor="middle" fontSize="7" fill="var(--faint)">节点{v}</text>
                </g>
              )
            })}
          </svg>
          <div className="orcap">
            {cur < 0 && !done ? '按「下一步」开始:每个节点把 自己+邻居 的特征平均成新特征'
              : done ? `一层完成:新特征 [${newFeat.join(', ')}]——信息沿边渗了一跳,相连节点变相似`
                : `节点 ${cur}:聚合{自己${agg.length > 1 ? '+邻居' + agg.slice(1).join('、') : ''}} → (${agg.map(u => feat[u]).join('+')})/${agg.length} = ${result}`}
          </div>
        </div>

        {done
          ? <p className="scnote">社交网络、分子、知识图谱都是<b>图</b>——节点数不定、邻居数还不一样,普通网络吃不了。<b>图卷积 GCN</b> 让每个节点<b>聚合邻居的信息</b>更新自己:最简单一层就是把<b>自己+所有邻居</b>的特征<b>平均</b>(再乘可学权重 W、过激活)。于是节点表示融进了<b>一跳邻居</b>;叠 L 层信息传 L 跳,第 L 层每个节点概括它 L 跳内的子图。它是<b>节点分类、推荐、分子性质预测</b>的核心,和词向量、注意力同属"表示学习"。</p>
          : <p className="scnote" style={{ opacity: .85 }}>颜色深=特征值大(有信息)。逐个节点看:<b>琥珀圈</b>=正在更新的节点、<b>绿圈</b>=它的邻居;把自己+邻居的特征<b>平均</b>就是它的新特征。节点 0、4 的"1"会顺着边分给邻居——这就是"信息沿边传播"。</p>}
      </div>
    </div>
  )
}
