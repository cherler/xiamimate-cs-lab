/** 舞台：Dubins 曲线 —— 世界里起点/终点位姿(带朝向箭头)+两端转向圆+最优 Dubins 路径 + 四词长度对比 */
import type { DubinsState } from '@engine/kernels/dubins.ts'
import type { StageProps } from '../types.ts'

const DX = (x: number) => 40 + x * 24
const DY = (y: number) => 95 - y * 24
const R = 24
type WordKey = 'LSL' | 'RSR' | 'LSR' | 'RSL'
const WORDS: WordKey[] = ['LSL', 'RSR', 'LSR', 'RSL']

function arrow(x: number, y: number, thDeg: number) {
  const th = thDeg * Math.PI / 180, len = 16
  return { x2: DX(x) + len * Math.cos(th), y2: DY(y) - len * Math.sin(th) }
}

export function DubinsStage({ state }: StageProps<DubinsState>) {
  const s = state
  const { start, goal, words, bestType, t, p, q, len, segs, pathPts, c1, c2, headingDeg, showCircles, showWords, showBest, showPath } = s
  const ga = arrow(goal[0], goal[1], headingDeg)
  const sa = arrow(start[0], start[1], 0)
  const pathD = pathPts.map((pt, k) => `${k === 0 ? 'M' : 'L'}${DX(pt[0])},${DY(pt[1])}`).join(' ')

  return (
    <div className="card">
      <h3>Dubins 曲线 <span className="hint">只能前进、有最小转弯半径的车，两位姿间最短路 = 转-直-转三段（6 种词取最短）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{s.scenLabel.split('(')[0]}</span><span className="scdl">终点朝向</span></div>
          <div className="scdk"><span className={`scdn${showBest ? ' du-hot' : ''}`}>{showBest ? bestType : '—'}</span><span className="scdl">最优词</span></div>
          <div className="scdk"><span className={`scdn${showBest ? ' du-good' : ''}`}>{showBest ? len : '—'}</span><span className="scdl">最短总长</span></div>
          <div className="scdk"><span className="scdn">{showBest ? `${t}+${p}+${q}` : '—'}</span><span className="scdl">三段(转+直+转)</span></div>
        </div>

        <svg className="du-svg" viewBox="0 0 150 118" width="100%" height="150">
          {/* 转向圆 */}
          {showCircles && <>
            <circle cx={DX(c1[0])} cy={DY(c1[1])} r={R} className="du-circ" />
            <circle cx={DX(c2[0])} cy={DY(c2[1])} r={R} className="du-circ" />
          </>}
          {/* Dubins 路径 */}
          {showPath && <path d={pathD} className="du-path" fill="none" />}
          {/* 起点位姿 */}
          <line x1={DX(start[0])} y1={DY(start[1])} x2={sa.x2} y2={sa.y2} className="du-arr" markerEnd="url(#du-ah)" />
          <circle cx={DX(start[0])} cy={DY(start[1])} r="3" className="du-start" />
          <text x={DX(start[0]) - 4} y={DY(start[1]) + 12} className="du-plbl">起</text>
          {/* 终点位姿 */}
          <line x1={DX(goal[0])} y1={DY(goal[1])} x2={ga.x2} y2={ga.y2} className="du-arr" markerEnd="url(#du-ah)" />
          <circle cx={DX(goal[0])} cy={DY(goal[1])} r="3" className="du-goal" />
          <text x={DX(goal[0]) + 5} y={DY(goal[1])} className="du-plbl">终</text>
          <defs><marker id="du-ah" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" className="du-ahf" /></marker></defs>
        </svg>

        {showWords && (
          <div className="du-words">
            {WORDS.map(k => (
              <div key={k} className={`du-word${showBest && k === bestType ? ' du-wbest' : ''}${words[k] == null ? ' du-winvalid' : ''}`}>
                <span className="du-wk">{k}</span>
                <span className="du-wbar" style={{ width: `${words[k] == null ? 0 : Math.min(100, (words[k]! / 16) * 100)}%` }} />
                <span className="du-wlen">{words[k] == null ? '不可行' : words[k]}</span>
              </div>
            ))}
            <div className="du-wnote">{showBest ? <>四种 CSC 词里 <b className="du-hotc">{bestType}={len}</b> 最短（{segs[0] === 'L' ? '左转' : '右转'} {t} → 直 {p} → {segs[2] === 'L' ? '左转' : '右转'} {q}）；同起终位置、只改终点朝向，最优词就会变（LSL↔LSR）。</> : '每种 CSC 词用闭式几何直接算三段长度，取最短。'}</div>
          </div>
        )}

        {s.stage === 'done'
          ? <p className="scnote"><b>Dubins = 非完整车的最短路</b>：车不能横走、有最小转弯半径 R；最短路一定是 6 种词之一（CSC：LSL/RSR/LSR/RSL；CCC：RLR/LRL），每种词闭式算三段、取最短；最优词由位姿决定。<b>连</b>：给车式机器人做规划，「RRT/PRM」的两点转移要换成 Dubins（拐不过直线）；「混合 A*」用它作启发与末端接入；「Reeds-Shepp」是可倒车的推广。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
