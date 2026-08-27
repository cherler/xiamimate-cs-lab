/** 舞台：强化学习 Q-learning —— 走迷宫，奖励从终点一圈圈倒推成价值，策略箭头指向终点 */
import type { QLearnState } from '@engine/kernels/qlearn.ts'
import type { StageProps } from '../types.ts'

export function QLearnStage({ state }: StageProps<QLearnState>) {
  const { w, h, goal, start, gamma, value, policy, ring, path, phase } = state
  const done = phase === 'done'
  const gk = `${goal[0]},${goal[1]}`, sk = `${start[0]},${start[1]}`
  const pathSet = new Set(path)
  const maxV = Math.max(...value.map(v => v ?? 0), 0.1)
  const dist = (c: number, r: number) => Math.abs(c - goal[0]) + Math.abs(r - goal[1])
  return (
    <div className="card">
      <h3>强化学习 Q-learning <span className="hint">靠试错拿奖励，把未来总回报倒推回每一步</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{ring < 0 && !done ? '试错中' : done ? '学好了' : `第 ${ring} 圈`}</span><span className="scdl">价值倒推</span></div>
          <div className="scdk"><span className="scdn">γ={gamma}</span><span className="scdl">折扣因子</span></div>
          <div className="scdk"><span className="scdn">{done ? `${path.length - 1} 步` : '—'}</span><span className="scdl">最优路线</span></div>
        </div>

        <div className="aswrap">
          <div className="asgrid" style={{ ['--cols' as string]: w }}>
            {Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => {
              const k = `${c},${r}`, idx = c + r * w
              const v = value[idx], pol = policy[idx]
              const isGoal = k === gk, isStart = k === sk
              const inPath = done && pathSet.has(k)
              const onRing = !done && dist(c, r) === ring && ring >= 0
              const cls = [
                'qcell',
                v !== null ? 'has' : '',
                isGoal ? 'goal' : '', isStart ? 'start' : '',
                inPath ? 'path' : '', onRing ? 'ring' : '',
              ].filter(Boolean).join(' ')
              const bg = v === null ? 'var(--panel)' : `color-mix(in srgb, var(--hit) ${Math.round((v / maxV) * 60)}%, var(--panel))`
              return (
                <div key={k} className={cls} style={{ background: isGoal ? undefined : bg }}>
                  {isGoal ? <span className="qmark">★</span>
                    : <>
                      {v !== null && <span className="qval">{v}</span>}
                      {pol && pol !== '★' && <span className="qpol">{pol}</span>}
                      {isStart && <span className="qstart">S</span>}
                    </>}
                </div>
              )
            }))}
          </div>
          <div className="orcap">
            {ring < 0 && !done ? '按「下一步」开始:只有终点 ★ 有 +1 奖励,价值从终点往外倒推'
              : done ? `学好了:价值满图,跟着策略箭头从 S 走到 ★——最优 ${path.length - 1} 步`
                : ring === 0 ? '终点 ★:拿到 +1,价值从这里开始往外倒推'
                  : `离终点 ${ring} 步的格子:价值=γ×下一格=0.9^${ring}=${Math.round(Math.pow(gamma, ring) * 1000) / 1000};箭头指向价值更高处`}
          </div>
        </div>

        {done
          ? <p className="scnote">强化学习=智能体靠<b>试错</b>拿奖励、学最优<b>策略</b>。难点是奖励**延迟**(只有终点 +1),怎么知道中间哪步走对?Q-learning:给每格估一个<b>价值</b>(从这出发未来总回报),用 <b>Bellman 规则</b>更新(价值=即时奖励+γ×下一格价值)。于是终点的 +1 顺规则<b>一圈圈倒推</b>:0.9→0.81→0.729…每远一步打 γ 折。学好后<b>往价值最高的邻居走</b>=最优路线,还<b>不用提前知道地图</b>。它是 AlphaGo、机器人控制、推荐、大模型 <b>RLHF</b> 的底子——AI 求职大热门。</p>
          : <p className="scnote" style={{ opacity: .85 }}>格子越绿=价值越高(越接近终点越值钱);箭头=策略(该往哪走)。看价值像<b>波纹</b>一样从终点 ★ 往外倒推:挨着终点的格 0.9、再外一圈 0.81……每远一步 ×γ=0.9。这就是"把延迟的奖励倒推回每一步"。跟着箭头走就是最优路线。</p>}
      </div>
    </div>
  )
}
