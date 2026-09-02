/** 舞台：PRM —— 2D 路图(障碍矩形+节点+边)，路图边灰/被挡边红虚/最短路绿；采样/连边/查询/结局逐块 */
import type { PrmState, PrmEdge } from '@engine/kernels/prm.ts'
import type { StageProps } from '../types.ts'

const SC = 28, OX = 22, OY = 92, YSC = 13
const PX = (x: number) => OX + x * SC
const PY = (y: number) => OY - y * YSC

export function PrmStage({ state }: StageProps<PrmState>) {
  const s = state
  const { densLabel, dens, nodes, obstacle, edges, roadmap, path, pathLen, connected, showSample, showConnect, showQuery, showOut } = s
  const at = (id: string) => nodes.find(n => n.id === id)!
  const pathEdges = new Set<string>()
  for (let k = 0; k + 1 < path.length; k++) pathEdges.add([path[k], path[k + 1]].sort().join('-'))
  const blockedN = edges.filter(e => e.blocked).length

  return (
    <div className="card">
      <h3>PRM 概率路图 · 多查询 <span className="hint">先撒点连成无碰路图，再在图上搜路；建一次路图、答多次查询</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{densLabel.split('(')[0]}</span><span className="scdl">采样密度</span></div>
          <div className="scdk"><span className="scdn">{showConnect ? roadmap.length : '—'}</span><span className="scdl">路图边(被挡 {showConnect ? blockedN : '—'})</span></div>
          <div className="scdk"><span className={`scdn${showOut ? (connected ? ' pm-good' : ' pm-bad') : ''}`}>{showOut ? (connected ? '连通' : '断开') : '—'}</span><span className="scdl">路图连通性</span></div>
          <div className="scdk"><span className={`scdn${showQuery && connected ? ' pm-hot' : ''}`}>{showQuery ? (connected ? pathLen : '无路') : '—'}</span><span className="scdl">最短路长</span></div>
        </div>

        <svg className="pm-svg" viewBox="0 0 320 100" width="100%" height="120">
          {/* 障碍 */}
          <rect x={PX(obstacle.x0)} y={PY(obstacle.y1)} width={(obstacle.x1 - obstacle.x0) * SC} height={(obstacle.y1 - obstacle.y0) * YSC} className="pm-obs" />
          <text x={PX((obstacle.x0 + obstacle.x1) / 2)} y={PY((obstacle.y0 + obstacle.y1) / 2) + 3} className="pm-obst">障碍</text>
          {/* 边 */}
          {showConnect && edges.map((e: PrmEdge, k: number) => {
            const a = at(e.a), b = at(e.b)
            const key = [e.a, e.b].sort().join('-')
            const isPath = showQuery && pathEdges.has(key)
            return <line key={k} x1={PX(a.x)} y1={PY(a.y)} x2={PX(b.x)} y2={PY(b.y)} className={e.blocked ? 'pm-blocked' : isPath ? 'pm-path' : 'pm-edge'} />
          })}
          {/* 节点 */}
          {showSample && nodes.map(n => (
            <g key={n.id}>
              <circle cx={PX(n.x)} cy={PY(n.y)} r={n.id === 'S' || n.id === 'G' ? 6 : 4.5} className={n.id === 'S' ? 'pm-start' : n.id === 'G' ? 'pm-goal' : 'pm-node'} />
              <text x={PX(n.x)} y={PY(n.y) - 8} className="pm-lbl">{n.id}</text>
            </g>
          ))}
        </svg>

        <div className="pm-flow">
          <div className={`pm-blk${showSample ? '' : ' pm-off'}`}>
            <span className="pm-n">①</span> 采样 {showSample ? <>自由空间撒 <b>{nodes.length}</b> 个无碰构型当节点（避开障碍）{dens === 'sparse' ? '——太稀，少了障碍上方的 C' : ''}</> : '—'}
          </div>
          <div className={`pm-blk${showConnect ? '' : ' pm-off'}`}>
            <span className="pm-n">②</span> 连 k 近邻 + 碰撞检测 {showConnect ? <>候选 {edges.length} 条，<b className="pm-r">{blockedN} 条穿障被挡</b>（{edges.filter(e => e.blocked).map(e => `${e.a}-${e.b}`).join('、') || '无'}），保留路图 <b>{roadmap.length}</b> 条</> : '—'}
          </div>
          <div className={`pm-blk${showQuery ? '' : ' pm-off'}`}>
            <span className="pm-n">③</span> 查询 起终点接入 + Dijkstra {showQuery ? (connected ? <>→ 最短路 <b className="pm-g">{path.join(' → ')}</b>（长 {pathLen}，绕障碍上方）</> : <>→ <b className="pm-r">S、G 断成两块、找不到路</b></>) : '—'}
          </div>
          {showOut && (
            <div className={`pm-out ${connected ? 'pm-oreach' : 'pm-obad'}`}>
              <span className="pm-n">④</span> {connected
                ? <><b>连通、找到路</b>：多查询优势——这张路图建好后换任何起终点(如 A→D)都能<b>直接复用</b>、再搜一次图，不用重建。这是 PRM 相对 RRT(单查询、每次重长树)的最大价值。</>
                : <><b>断开、找不到路</b>：采样太稀，路图在障碍附近断成两块——不是没有路、是<b>路图没覆盖到</b>。解法：加采样(尤其窄通道)。这就是 PRM 的核心难点<b>窄通道问题</b>。</>}
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>PRM = 建路图 + 图搜索，多查询</b>：采样自由构型→连 k 近邻(边碰撞检测、最贵)→Dijkstra/A* 搜路。<b>vs RRT</b>：RRT 单查询(朝一目标长树、用完即弃)；PRM 多查询(建一次路图答多次、适合固定环境反复规划)。<b>难点=窄通道</b>(采样概率低、路图易断)，对策：加采样/桥采样/PRM*。<b>连</b>：查询阶段就是「A* 寻路」/Dijkstra；找到的路再配「梯形速度曲线」执行。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
