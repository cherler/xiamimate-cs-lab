/** 舞台：集合通信 Ring All-Reduce —— GPU×块 网格，reduce-scatter → all-gather → 人人拿到总和 */
import type { CollectiveState } from '@engine/kernels/collective.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function CollectiveStage({ state }: StageProps<CollectiveState>) {
  const { G, bufs, target, reduced, phase, round, moves, totalSteps } = state
  const done = phase === 'done'
  const stepNo = phase === 'reduce' ? round : phase === 'gather' ? (G - 1) + round : totalSteps
  const involved = (g: number, c: number) => moves.some(m => (m.src === g || m.dst === g) && m.chunk === c)
  return (
    <div className="card">
      <h3>集合通信 · Ring All-Reduce <span className="hint">环形传递 · 人人拿到逐元素总和</span></h3>
      <div className="body">
        <div className="coph">
          <span className={`cophtag ${phase === 'reduce' ? 'on' : 'past'}`}>reduce-scatter</span>
          <span className="cophar">→</span>
          <span className={`cophtag ${phase === 'gather' ? 'on' : done ? 'past' : ''}`}>all-gather</span>
          <span className="cophstep">第 {Math.min(stepNo, totalSteps)} / {totalSteps} 步</span>
        </div>

        {/* GPU × 块 网格 */}
        <div className="cogrid" style={{ gridTemplateColumns: `44px repeat(${G}, 1fr)` }}>
          <div className="cohc"></div>
          {Array.from({ length: G }, (_, c) => <div key={c} className="cohc">块{c}</div>)}
          {bufs.map((row, g) => (
            <div key={g} style={{ display: 'contents' }}>
              <div className="corh">GPU{g}</div>
              {row.map((v, c) => (
                <div key={c} className={`cocell ${reduced[g][c] ? 'sum' : ''} ${involved(g, c) && !done ? 'move' : ''}`}>
                  {v}{reduced[g][c] && <span className="cochk">✓</span>}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 目标 / 校验 */}
        <div className="cofoot">
          <span className="cotl">逐元素总和</span>
          <div className="cotarget">{target.map((v, c) => <span key={c} className="cotc">{v}</span>)}</div>
          {done && <span className="cook">✓ 每张卡都拿到它 · {totalSteps} 步 · 每步每卡只收发一个块（带宽最优）</span>}
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
