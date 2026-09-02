/** 舞台：D* Lite 增量重规划 —— 栅格 g 值表 + 最短路 + 障碍 + 增量修复只重算的少数格高亮 */
import type { DStarState } from '@engine/kernels/dstarlite.ts'
import type { StageProps } from '../types.ts'

const CS = 30, PAD = 6

export function DStarLiteStage({ state }: StageProps<DStarState>) {
  const s = state
  const { W, H, start, goal, block, grid, path, obstacleOn, changed, gGoal, expInit, expInc, expFull, reused, showChanged } = s
  const cs = new Set(changed)
  const pathSet = new Set(path.map(p => `${p[0]},${p[1]}`))
  const cx = (x: number) => PAD + x * CS + CS / 2
  const cy = (y: number) => PAD + y * CS + CS / 2
  const isStart = (x: number, y: number) => x === start[0] && y === start[1]
  const isGoal = (x: number, y: number) => x === goal[0] && y === goal[1]

  return (
    <div className="card">
      <h3>D* Lite 增量重规划 <span className="hint">地图变了只局部修复旧计划、不从头重搜：g/rhs + 只重算受影响的格</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{gGoal}</span><span className="scdl">终点 g（路径代价）</span></div>
          <div className="scdk"><span className={`scdn${showChanged ? ' ds-hot' : ''}`}>{showChanged ? changed.length : '—'}</span><span className="scdl">受影响格数</span></div>
          <div className="scdk"><span className={`scdn${showChanged ? ' ds-good' : ''}`}>{showChanged ? expInc : '—'}</span><span className="scdl">增量修复展开</span></div>
          <div className="scdk"><span className={`scdn${showChanged ? ' ds-bad' : ''}`}>{showChanged ? expFull : '—'}</span><span className="scdl">从头重搜展开</span></div>
        </div>

        <svg className="ds-svg" viewBox={`0 0 ${W * CS + 2 * PAD} ${H * CS + 2 * PAD}`} width={W * CS + 2 * PAD} height={H * CS + 2 * PAD}>
          {grid.map((row, y) => row.map((v, x) => {
            const k = `${x},${y}`
            const obs = v === null
            const onPath = pathSet.has(k)
            const chg = showChanged && cs.has(k) && !obs
            return (
              <g key={k}>
                <rect x={PAD + x * CS} y={PAD + y * CS} width={CS - 1} height={CS - 1}
                  className={obs ? 'ds-obs' : chg ? 'ds-chg' : onPath ? 'ds-path' : 'ds-cell'} />
                {!obs && <text x={cx(x)} y={cy(y) + 3.5} className={`ds-g${chg ? ' ds-gchg' : ''}`}>{v}</text>}
                {obs && <text x={cx(x)} y={cy(y) + 4} className="ds-x">✕</text>}
              </g>
            )
          }))}
          {/* 路径线 */}
          {path.length > 1 && <polyline points={path.map(p => `${cx(p[0])},${cy(p[1])}`).join(' ')} className="ds-pline" fill="none" />}
          {/* 起点/终点 */}
          <rect x={PAD + start[0] * CS} y={PAD + start[1] * CS} width={CS - 1} height={CS - 1} className="ds-start" />
          <rect x={PAD + goal[0] * CS} y={PAD + goal[1] * CS} width={CS - 1} height={CS - 1} className="ds-goal" />
          {obstacleOn && <rect x={PAD + block[0] * CS - 1} y={PAD + block[1] * CS - 1} width={CS + 1} height={CS + 1} className="ds-blockmark" />}
        </svg>

        <div className="ds-legend">
          <span><i className="km-dot" style={{ background: 'var(--hit)' }} />起点</span>
          <span><i className="km-dot" style={{ background: 'var(--miss)' }} />终点</span>
          <span><i className="km-dot" style={{ background: 'var(--now)' }} />受影响·重算</span>
          <span>格内数字 = 从起点到该格的最优代价 g</span>
        </div>

        {s.stage === 'compare' || s.stage === 'done'
          ? <p className="scnote"><b>D* Lite = g/rhs + 增量修复</b>：障碍出现 → 只有 <b className="ds-hotc">{changed.length} 格</b> g 值变（高亮）、其余 <b>{reused} 格原样复用</b>；增量修复只展开 <b className="ds-goodc">{expInc}</b> 格，从头重搜要 <b className="ds-badc">{expFull}</b> 格（≈{Math.round(expFull / Math.max(1, expInc) * 10) / 10}× 少）。地图越大、改动越局部，优势越夸张——<b>机器人边走边发现障碍</b>（接 SLAM）就靠它省下巨量计算。<b>连</b>：「A*」(h&gt;0 即 A* 制导)、「RRT/RRT-Connect」(采样式)、「SLAM」。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
