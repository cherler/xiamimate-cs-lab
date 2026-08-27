/** 舞台：PageRank —— 有向图,重要性顺着链接流动,幂迭代收敛,节点大小=rank */
import type { PageRankState } from '@engine/kernels/pagerank.ts'
import type { StageProps } from '../types.ts'

const W = 320, H = 240
export function PageRankStage({ state }: StageProps<PageRankState>) {
  const { pos, edges, nodes, rank, prev, iter, ranked, phase } = state
  const done = phase === 'done'
  const px = (x: number) => 26 + x * (W - 52)
  const py = (y: number) => 24 + y * (H - 48)
  const maxR = Math.max(...rank, 0.1)
  const rad = (r: number) => 10 + (r / maxR) * 18
  return (
    <div className="card">
      <h3>PageRank 网页排名 <span className="hint">重要性顺着链接流动，被重要页面链到的也重要</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? '收敛' : iter === 0 ? '初始' : `第 ${iter} 轮`}</span><span className="scdl">幂迭代</span></div>
          <div className="scdk"><span className="scdn">{ranked[0]?.name}</span><span className="scdl">当前最高</span></div>
          <div className="scdk"><span className="scdn">{ranked[0]?.r}</span><span className="scdl">最高 rank</span></div>
        </div>

        <div className="prwrap">
          <svg className="gcntree" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            <defs><marker id="prarr" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="var(--faint)" /></marker></defs>
            {edges.map(([a, b], k) => {
              const A = pos[a], B = pos[b]
              const dx = px(B.x) - px(A.x), dy = py(B.y) - py(A.y), len = Math.hypot(dx, dy)
              const ux = dx / len, uy = dy / len
              const x1 = px(A.x) + ux * rad(rank[a]), y1 = py(A.y) + uy * rad(rank[a])
              const x2 = px(B.x) - ux * (rad(rank[b]) + 6), y2 = py(B.y) - uy * (rad(rank[b]) + 6)
              return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--faint)" strokeWidth="1.2" markerEnd="url(#prarr)" opacity="0.7" />
            })}
            {pos.map((p, v) => {
              const up = !done && iter > 0 && rank[v] > prev[v] + 1e-4
              return (
                <g key={v}>
                  <circle cx={px(p.x)} cy={py(p.y)} r={rad(rank[v])}
                    fill={`color-mix(in srgb, var(--now) ${Math.round((rank[v] / maxR) * 60)}%, var(--panel))`}
                    stroke={v === nodes.indexOf(ranked[0]?.name) ? 'var(--hit)' : 'var(--now)'} strokeWidth={v === nodes.indexOf(ranked[0]?.name) ? 2.4 : 1.2} />
                  <text x={px(p.x)} y={py(p.y) - 1} textAnchor="middle" fontSize="11" fontWeight={800} fill="var(--ink)">{nodes[v]}</text>
                  <text x={px(p.x)} y={py(p.y) + 10} textAnchor="middle" fontSize="7" fill="var(--dim)">{rank[v]}</text>
                  {up && <text x={px(p.x) + rad(rank[v]) + 2} y={py(p.y) - rad(rank[v]) + 4} fontSize="8" fill="var(--hit)">↑</text>}
                </g>
              )
            })}
          </svg>

          <div className="prbars">
            {ranked.map((x, k) => (
              <div key={x.name} className={`prbar ${k === 0 ? 'top' : ''}`}>
                <span className="prn">{x.name}</span>
                <span className="prtrack"><span className="prfill" style={{ width: `${(x.r / maxR) * 100}%` }} /></span>
                <span className="prv">{x.r}</span>
              </div>
            ))}
          </div>

          <div className="orcap">
            {iter === 0 && !done ? '按「下一步」开始:初始每页 rank=0.25,幂迭代让重要性顺链接流动'
              : done ? `收敛:${ranked.map(x => x.name).join(' > ')}——${ranked[0].name} 最高(最多、最重要的页面链到它)`
                : `第 ${iter} 轮:每页把 rank 平分给链出页、收方求和;重要性在页面间流动、逐渐稳定`}
          </div>
        </div>

        {done
          ? <p className="scnote">网页海量,怎么排重要性?PageRank 的洞见:<b>一个页面的重要性,取决于有多少、以及多重要的页面链到它</b>——重要页面的"投票"更值钱。做法是<b>幂迭代</b>:每页把 rank <b>平分</b>给链出的页面(链接=投票),收方求和,再混入一点随机跳转(阻尼 d=0.85 防死循环)。反复迭代收敛到稳定值,等价于"随机上网者"无穷点击后停在各页的概率——<b>图上随机游走的稳态</b>。是搜索引擎排序、影响力分析、推荐的基石。</p>
          : <p className="scnote" style={{ opacity: .85 }}>节点<b>越大=rank 越高</b>(越重要),箭头=链接(=投票)。每轮每页把自己的 rank 平分给它链出的页面,收到越多、来源越重要,分越高。重要性在图里<b>流动</b>,几轮后稳定——被最多、最重要的页面链到的 C 会胜出。</p>}
      </div>
    </div>
  )
}
