/** 舞台：RRT* —— 2D 树图(节点+父边、x_new+邻域半径)，选父边绿/重连边橙；采样/选父/重连/对比逐块 */
import type { RRTSState, Node } from '@engine/kernels/rrtstar.ts'
import type { StageProps } from '../types.ts'

const SC = 42, OX = 30, OY = 110
const PX = (x: number) => OX + x * SC
const PY = (y: number) => OY - y * SC

export function RrtStarStage({ state }: StageProps<RRTSState>) {
  const s = state
  const { algo, algoLabel, nodes, xnew, radius, neighbors, nearestId, rrtCost, chosenParent, starCost, rewired, showSample, showParent, showRewire, showCompare } = s
  const rewiredIds = new Set(rewired.map(r => r.id))
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

  return (
    <div className="card">
      <h3>RRT* · 渐近最优采样规划 <span className="hint">在 RRT 上加「选最优父 + 重连」两步，让树随采样收敛到最短路</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{algoLabel.split('(')[0]}</span><span className="scdl">算法</span></div>
          <div className="scdk"><span className={`scdn${showParent ? ' rs-hot' : ''}`}>{showParent ? chosenParent : '—'}</span><span className="scdl">x_new 的父(选父)</span></div>
          <div className="scdk"><span className={`scdn${showParent ? ' rs-good' : ''}`}>{showParent ? starCost : '—'}</span><span className="scdl">x_new 代价(RRT*)</span></div>
          <div className="scdk"><span className={`scdn${showCompare ? ' rs-cmp' : ''}`}>{showCompare ? rrtCost : '—'}</span><span className="scdl">对比 RRT 代价</span></div>
        </div>

        <svg className="rs-svg" viewBox="0 0 280 130" width="100%" height="150">
          {/* 邻域半径圈 */}
          {showSample && <circle cx={PX(xnew.x)} cy={PY(xnew.y)} r={radius * SC} className="rs-radius" />}
          {/* 父边 */}
          {nodes.filter(n => n.parent).map((n: Node) => {
            const p = nodeMap[n.parent!]!
            const toN = n.id === 'N' || n.parent === 'N'
            const isRewire = n.id !== 'N' && n.parent === 'N' && showRewire
            const isChosen = n.id === 'N' && showParent
            return <line key={n.id} x1={PX(n.x)} y1={PY(n.y)} x2={PX(p.x)} y2={PY(p.y)} className={`rs-edge${isChosen ? ' rs-chosen' : ''}${isRewire ? ' rs-rewire' : ''}${!toN ? ' rs-tree' : ''}`} />
          })}
          {/* RRT 的最近边(对比、灰虚线) */}
          {showCompare && algo === 'star' && <line x1={PX(xnew.x)} y1={PY(xnew.y)} x2={PX(nodeMap[nearestId]!.x)} y2={PY(nodeMap[nearestId]!.y)} className="rs-nearest" />}
          {/* 节点 */}
          {nodes.map((n: Node) => {
            const isNew = n.id === 'N'
            if (isNew && !showSample) return null
            return <g key={n.id}>
              <circle cx={PX(n.x)} cy={PY(n.y)} r={isNew ? 6 : 5} className={isNew ? 'rs-new' : n.id === 'S' ? 'rs-start' : rewiredIds.has(n.id) && showRewire ? 'rs-rw' : 'rs-node'} />
              <text x={PX(n.x)} y={PY(n.y) - 9} className="rs-lbl">{isNew ? 'x_new' : n.id}</text>
              {(showParent || n.id !== 'N') && <text x={PX(n.x) + 8} y={PY(n.y) + 4} className="rs-cost">c={n.cost}</text>}
            </g>
          })}
        </svg>

        <div className="rs-flow">
          <div className={`rs-blk${showSample ? '' : ' rs-off'}`}>
            <span className="rs-n">①</span> 采样 x_new=({xnew.x},{xnew.y})、邻域半径 r={radius} {showSample ? <>→ 邻居 {neighbors.map(n => <span key={n.id} className="rs-chip">{n.id}(d{n.dist})</span>)}（最近={nearestId}）</> : ''}
          </div>
          <div className={`rs-blk${showParent ? '' : ' rs-off'}`}>
            <span className="rs-n">②</span> 选父：cost[邻居]+dist {showParent ? <>→ {neighbors.map(n => <span key={n.id} className="rs-chip">经{n.id}={n.viaCost}</span>)} 取最小 → 父=<b className="rs-hot2">{chosenParent}</b>、代价 <b className="rs-good2">{starCost}</b>（最近的 {nearestId} 反而贵：{rrtCost}）</> : '—'}
          </div>
          <div className={`rs-blk${showRewire ? '' : ' rs-off'}`}>
            <span className="rs-n">③</span> 重连：邻居经 x_new 更省则改接 {showRewire ? (rewired.length ? <>→ {rewired.map(r => <span key={r.id} className="rs-rwchip">{r.id}: {r.oldCost}→{r.newCost}</span>)}（搭便车变便宜）</> : '本例无邻居可改善') : '—'}
          </div>
          {showCompare && (
            <div className="rs-cmpbox">
              <span className="rs-n">④</span> <b>RRT</b> 接最近 {nearestId} → x_new 代价 <b className="rs-cmp2">{rrtCost}</b>、不重连；<b>RRT*</b> 选父 {chosenParent} → 代价 <b className="rs-good2">{starCost}</b>{rewired.length ? <>、还重连 {rewired.map(r => r.id).join('、')}</> : ''}。随采样增多，选父+重连不断抄近道 → <b>渐近逼近最优</b>。
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>RRT* = RRT + 选父 + 重连</b>：①选父(邻域里挑代价最小的父、不是最近的)②重连(邻域里"经新点更省"的邻居改接到新点)。这两步让树随采样<b>渐近收敛到最优</b>(RRT 只保证概率完备、找到一条)。邻域半径按 (γ·log n/n)^(1/d) 收缩。代价：每步查邻域、算多条代价、可能重连，比 RRT 慢。<b>连</b>：是「RRT」的最优化升级；和「A* 寻路」都求最优(A* 离散栅格/RRT* 连续采样)；求出的路再由「轨迹规划」平滑。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
