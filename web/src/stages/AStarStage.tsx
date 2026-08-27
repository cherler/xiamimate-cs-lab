/** 舞台：A* 寻路 —— 网格上按 f=g+h 优先展开，g=已走步数、h=到终点乐观估计，绕墙找最短路 */
import type { AStarState } from '@engine/kernels/astar.ts'
import { ASTAR_W, ASTAR_H, ASTAR_WALLS, ASTAR_START, ASTAR_GOAL } from '@engine/kernels/astar.ts'
import type { StageProps } from '../types.ts'

const k = (c: number, r: number) => `${c},${r}`

export function AStarStage({ state }: StageProps<AStarState>) {
  const { cur, curG, curH, curF, closed, open, fMap, gMap, path, act, expanded, phase } = state
  const done = phase === 'done'
  const wallSet = new Set(ASTAR_WALLS)
  const closedSet = new Set(closed)
  const openSet = new Set(open)
  const pathSet = new Set(path)
  const sk = k(...ASTAR_START), gk = k(...ASTAR_GOAL)
  const curk = k(cur[0], cur[1])

  return (
    <div className="card">
      <h3>A* 寻路 <span className="hint">f = 已走 g + 到终点估计 h，优先探最有希望的格</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? path.length - 1 : `f=${curF}`}</span><span className="scdl">{done ? '最短路步数' : `g${curG}+h${curH}`}</span></div>
          <div className="scdk"><span className="scdn">{expanded}</span><span className="scdl">已展开格</span></div>
          <div className="scdk"><span className="scdn">{open.length}</span><span className="scdl">开放集(待探)</span></div>
        </div>

        <div className="aswrap">
          <div className="asgrid" style={{ ['--cols' as string]: ASTAR_W }}>
            {Array.from({ length: ASTAR_H }, (_, r) => Array.from({ length: ASTAR_W }, (_, c) => {
              const ck = k(c, r)
              const isWall = wallSet.has(ck)
              const isStart = ck === sk, isGoal = ck === gk
              const inPath = done && pathSet.has(ck)
              const isCur = !done && ck === curk
              const inClosed = closedSet.has(ck)
              const inOpen = openSet.has(ck)
              const cls = [
                'ascell',
                isWall ? 'wall' : '',
                inPath ? 'path' : '',
                isCur ? 'cur' : '',
                !isWall && !inPath && inClosed ? 'closed' : '',
                !isWall && !inPath && !inClosed && inOpen ? 'open' : '',
                isStart ? 'start' : '', isGoal ? 'goal' : '',
              ].filter(Boolean).join(' ')
              const fv = fMap[ck]
              return (
                <div key={ck} className={cls}>
                  {isStart ? <span className="asmark">S</span> : isGoal ? <span className="asmark">G</span> : null}
                  {!isWall && fv !== undefined && !inPath && (
                    <span className="asf">{fv}<span className="asg">g{gMap[ck]}</span></span>
                  )}
                  {inPath && !isStart && !isGoal ? <span className="asdot">•</span> : null}
                </div>
              )
            }))}
          </div>
          <div className="orcap">
            {act === '' ? '按「下一步」开始:从起点 S 出发,每步展开开放集里 f=g+h 最小的格'
              : done ? `最短路 ${path.length - 1} 步:g 防走冤枉、h 把搜索拽向终点,只展开 ${expanded} 格就找到最优`
                : act === 'goal' ? `取到终点 G!g=${curG} 步、h=0 → 最短路已确定,开始回溯`
                  : `展开 (${cur[0]},${cur[1]}):f=g+h=${curG}+${curH}=${curF}——它是当前最有希望的格,邻居加进开放集`}
          </div>
        </div>

        {done
          ? <p className="scnote">A* = <b>带启发的最短路</b>。每格算两个数:<b>g</b>=从起点已走的步数、<b>h</b>=到终点的乐观估计(曼哈顿距离,把墙当不存在、永不高估)。按 <b>f=g+h</b> 优先展开:g 保证不贪近路走冤枉、h 把搜索<b>拽向终点</b>。只要 h 不高估,找到的必是<b>最短路</b>,还比 Dijkstra(只看 g、四面均匀铺)少展开很多格。h=0 就退化成 Dijkstra。游戏 NPC 寻路、地图导航都靠它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>格子里大数=<b>f=g+h</b>、角标 g=已走步数;蓝=已展开(关闭集)、浅色=开放集(待探的边界)、琥珀=正展开、深灰=墙、S/G=起终点。A* 总先探 f 最小的:沿 h 的指引直扑终点,撞墙才绕行。</p>}
      </div>
    </div>
  )
}
