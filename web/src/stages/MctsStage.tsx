/** 舞台：MCTS —— 根+3走法，四阶段(选择UCB/模拟/回传)，访问次数集中到最好的走法 */
import type { MctsState } from '@engine/kernels/mcts.ts'
import type { StageProps } from '../types.ts'

const W = 340, H = 220
export function MctsStage({ state }: StageProps<MctsState>) {
  const { moves, n, w, ucb, pick, win, iter, best, phase } = state
  const done = phase === 'done'
  const maxN = Math.max(...n, 1)
  const rad = (k: number) => 16 + (n[k] / maxN) * 12
  const bx = (k: number) => 60 + k * 110
  return (
    <div className="card">
      <h3>蒙特卡洛树搜索 MCTS <span className="hint">随机模拟 + UCB，把思考花在最有希望的走法上</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? `选 ${moves[best]}` : iter === 0 ? '起步' : `第 ${iter} 轮`}</span><span className="scdl">模拟</span></div>
          <div className="scdk"><span className="scdn">{pick >= 0 && !done ? moves[pick] : '—'}</span><span className="scdl">本轮选中</span></div>
          <div className="scdk"><span className="scdn">{win === 1 ? '赢' : win === 0 ? '输' : '—'}</span><span className="scdl">模拟结果</span></div>
        </div>

        <div className="mctswrap">
          <svg className="gcntree" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            <circle cx={W / 2} cy="30" r="16" fill="color-mix(in srgb,var(--now) 16%,var(--panel))" stroke="var(--now)" strokeWidth="1.2" />
            <text x={W / 2} y="34" textAnchor="middle" fontSize="9" fontWeight={700} fill="var(--ink)">根</text>
            {moves.map((m, k) => {
              const isPick = k === pick && !done
              const isBest = done && k === best
              const r = rad(k)
              return (
                <g key={k}>
                  <line x1={W / 2} y1="46" x2={bx(k)} y2={90 - r} stroke={isPick || isBest ? 'var(--hit)' : 'var(--line)'} strokeWidth={isPick || isBest ? 2 : 1} />
                  <circle cx={bx(k)} cy="90" r={r}
                    fill={isBest ? 'color-mix(in srgb,var(--hit) 22%,var(--panel))' : n[k] > 0 ? 'color-mix(in srgb,var(--hit) 10%,var(--panel))' : 'var(--panel)'}
                    stroke={isPick ? 'var(--now)' : isBest ? 'var(--hit)' : 'var(--line)'} strokeWidth={isPick || isBest ? 2.4 : 1} />
                  <text x={bx(k)} y="88" textAnchor="middle" fontSize="12" fontWeight={800} fill="var(--ink)">{m}</text>
                  <text x={bx(k)} y="98" textAnchor="middle" fontSize="6.5" fill="var(--dim)">{n[k]}访/{w[k]}赢</text>
                  <text x={bx(k)} y={90 + r + 14} textAnchor="middle" fontSize="8" fill={ucb[k] === null ? 'var(--now)' : 'var(--faint)'}>
                    UCB {ucb[k] === null ? '∞' : ucb[k]}
                  </text>
                  {isPick && win >= 0 && <text x={bx(k)} y={90 + r + 24} textAnchor="middle" fontSize="8" fontWeight={700} fill={win ? 'var(--hit)' : 'var(--miss)'}>{win ? '模拟→赢' : '模拟→输'}</text>}
                </g>
              )
            })}
          </svg>
          <div className="orcap">
            {iter === 0 && !done ? '按「下一步」开始:每轮按 UCB 选一个走法、随机模拟到底、把输赢回传'
              : done ? `搜索结束:访问次数 ${moves.map((m, k) => `${m}=${n[k]}`).join(' ')} → 选访问最多的 ${moves[best]}`
                : `第 ${iter} 轮:UCB 最大的是 ${moves[pick]}(${ucb[pick] === null ? '没试过,先探索' : '值得试'})→ 模拟${win ? '赢' : '输'}→ 回传更新`}
          </div>
        </div>

        {done
          ? <p className="scnote">下棋走法爆炸,没法全搜。MCTS 每轮四步:**选择**(从根按 <b>UCB=胜率+c·√(ln N_父/N_子)</b> 挑分支——胜率高的多<b>利用</b>、试得少的多<b>探索</b>)→**扩展**→**模拟**(随机走到底看输赢)→**回传**(把结果更新回沿途节点)。反复几千轮,好走法被反复模拟、<b>访问数飙升</b>,最后选访问最多的。不需要评估函数,靠大量随机对局的统计说话。它是 <b>AlphaGo/AlphaZero 的引擎</b>(配神经网络给先验和价值),和你建的<b>思维树 ToT</b> 一脉相承。</p>
          : <p className="scnote" style={{ opacity: .85 }}>圆越大=被访问越多(越受重视)。每轮:①<b>选择</b>——挑 <b>UCB 最大</b>的走法(没试过的 UCB=∞ 先试,试过的按 胜率+探索项);②<b>模拟</b>——随机走到底,赢或输;③<b>回传</b>——更新它的访问数和胜数。好走法(A 总赢)会被越选越多——探索与利用的平衡。</p>}
      </div>
    </div>
  )
}
