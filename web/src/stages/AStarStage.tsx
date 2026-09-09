/**
 * 舞台：A* 寻路 —— 网格上按 f = g + w·h 优先展开。
 *
 * 补厚之后这一屏有三块要看的：
 * ① 网格：蓝=已展开、浅=开放集、深灰=墙、**斜纹=沼泽（走一格要 4 的代价）**。
 * ② 读数：展开格数 / 代价 / **真正的最小代价**（另一次反向 Dijkstra 算的真值）/ 可采纳性。
 * ③ 底下的权重表：同一张图四个 w 各跑一遍 —— w=0 就是 Dijkstra，w 越大越快、也越可能走冤枉路。
 */
import type { AStarState } from '@engine/kernels/astar.ts'
import { ASTAR_W, ASTAR_H, ASTAR_START, ASTAR_GOAL } from '@engine/kernels/astar.ts'
import type { StageProps } from '../types.ts'

const k = (c: number, r: number) => `${c},${r}`

export function AStarStage({ state }: StageProps<AStarState>) {
  const {
    cur, curG, curH, curF, closed, open, fMap, gMap, path, act, expanded, phase,
    walls, swamp, swampCost, mapName, weight, hName,
    admissible, maxOver, overAt, pathLen, steps, optimalLen, optimal, sweep, freeCells,
  } = state
  const done = phase === 'done'
  const wallSet = new Set(walls)
  const swampSet = new Set(swamp)
  const closedSet = new Set(closed)
  const openSet = new Set(open)
  const pathSet = new Set(path)
  const sk = k(...ASTAR_START), gk = k(...ASTAR_GOAL)
  const curk = k(cur[0], cur[1])
  const dij = sweep.find(s => s.w === 0)
  const std = sweep.find(s => s.w === 1)

  return (
    <div className="card">
      <h3>A* 寻路 <span className="hint">f = 已走代价 g + 权重 w × 到终点的估计 h</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk">
            <span className="scdn hot">{done ? pathLen : `f=${curF}`}</span>
            <span className="scdl">{done ? `路的代价（${steps} 步）` : `g${curG}+${weight}×h${curH}`}</span>
          </div>
          {/*  ⭐ 真值来自另一次反向 Dijkstra —— 「找到的是不是最优」不能问算法自己 */}
          <div className="scdk">
            <span className={`scdn ${done ? (optimal ? 'good' : 'bad') : ''}`}>{optimalLen}</span>
            <span className="scdl">真正的最小代价{done && (optimal ? '（追平）' : `（贵了 ${+(pathLen - optimalLen).toFixed(2)}）`)}</span>
          </div>
          <div className="scdk"><span className="scdn">{expanded}/{freeCells}</span><span className="scdl">已展开 / 可走格</span></div>
          <div className="scdk">
            <span className={`scdn ${admissible ? 'good' : 'bad'}`}>{admissible ? '不高估' : `超 ${maxOver}`}</span>
            <span className="scdl">{admissible ? 'w·h 可采纳' : `w·h 在 (${overAt}) 高估`}</span>
          </div>
          <div className="scdk"><span className="scdn">{open.length}</span><span className="scdl">开放集（待探）</span></div>
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
                swampSet.has(ck) ? 'swamp' : '',
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
                    <span className="asf">{+fv.toFixed(1)}<span className="asg">g{gMap[ck]}</span></span>
                  )}
                  {inPath && !isStart && !isGoal ? <span className="asdot">•</span> : null}
                </div>
              )
            }))}
          </div>
          <div className="orcap">
            {act === '' ? `按「下一步」开始：地图「${mapName}」，h 用${hName}，权重 w=${weight}${weight === 0 ? '（这就是 Dijkstra）' : ''}`
              : done ? `代价 ${pathLen}（${steps} 步），展开 ${expanded} 格${optimal ? '，追平了最小代价' : `，而最小代价是 ${optimalLen} —— 走了冤枉路`}`
                : act === 'goal' ? `取到终点 G！g=${curG}、h=0 → 开始回溯`
                  : `展开 (${cur[0]},${cur[1]})：f = g + ${weight}×h = ${curG} + ${weight}×${curH} = ${curF}`}
            {swamp.length > 0 && <>　斜纹格 = 沼泽，走一格付 <b>{swampCost}</b> 的代价（别的格是 1）</>}
          </div>
        </div>

        {/*  同一张图四个权重各跑一遍：w=0 就是 Dijkstra，w 越大越快、也越可能走冤枉路 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead"><span>w</span><span>展开格</span><span>路的代价</span><span>步数</span><span>是最优吗</span></div>
            {sweep.map(s => (
              <div className="qsrow" key={s.w}>
                <span>{s.w}{s.w === weight ? ' ◀' : ''}{s.w === 0 ? ' Dij' : ''}</span>
                <span className={s.expanded >= freeCells * 0.9 ? 'bad' : ''}>{s.expanded}</span>
                <span className={s.optimal ? '' : 'bad'}>{s.pathLen}</span>
                <span className="dimv">{s.steps}</span>
                <span className={s.optimal ? 'good' : 'bad'}>{s.optimal ? '是' : '否'}</span>
              </div>
            ))}
            <div className="orcap">
              <b>w=0 就是 Dijkstra</b>：不看终点在哪，四面均匀铺开，展开 {dij?.expanded}/{freeCells} 格。
              {std && dij && (std.expanded < dij.expanded
                ? <>　标准 A*（w=1）只展开 {std.expanded} 格 —— <b>h 把搜索拽向了终点</b>。</>
                : <>　⚠️ 而标准 A*（w=1）展开了 {std.expanded} 格，<b>并不比它少</b> —— 这张图上启发把搜索拽进了死胡同。</>)}
            </div>
          </div>
        )}

        {done
          ? (
            <p className="scnote">
              <b>可采纳性是量出来的，不是引用的。</b>另一次反向 Dijkstra 先算出每一格到终点的<b>真实最小代价</b>，
              再拿 w×h 逐格去比：{admissible
                ? <>一格都没超过，<b>w·h 可采纳</b> —— 定理说可采纳就保证最优，这一趟正好印证。</>
                : <>在 (<b>{overAt}</b>) 这一格超了 <b>{maxOver}</b>，<b>不可采纳</b>。
                  定理的保证在这里撤掉了，而这一趟{optimal
                    ? <>还是<b>碰巧</b>找到了最优路 —— <b>不保证 ≠ 一定错</b>。</>
                    : <><b>确实走了冤枉路</b>（代价 {pathLen}，最优 {optimalLen}）。</>}</>}
              <br />
              {swamp.length > 0
                ? <><b>这张图上 g 记的是代价不是步数</b>：穿沼泽步数少但贵，绕开步数多但便宜。
                  w 一大，f 被 h 主导，搜索一头扎进沼泽 —— <b>展开得更少，路却更贵</b>。游戏寻路里的地形权重就是这么回事。</>
                : <>换成「沼泽」那张图再看：均匀代价的网格上曼哈顿是<b>一致</b>启发，w 拉到 5 也照样找得到最优路，
                  <b>构造不出反例</b>；加上地形代价之后，高估才真的会让它走冤枉路。</>}
            </p>
          )
          : <p className="scnote" style={{ opacity: .85 }}>
            格子里大数 = <b>f = g + w·h</b>、角标 g = 已走代价；蓝 = 已展开（关闭集）、浅色 = 开放集（待探的边界）、
            琥珀 = 正展开、深灰 = 墙{swamp.length > 0 && <>、斜纹 = 沼泽</>}、S/G = 起终点。
            A* 总先探 f 最小的那一格。
          </p>}
      </div>
    </div>
  )
}
