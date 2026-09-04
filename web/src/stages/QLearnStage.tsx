/** 舞台：强化学习 · 值迭代 —— 走迷宫(带墙),奖励从终点靠 Bellman 一轮轮倒推成价值,策略箭头指向终点 */
import type { QLearnState } from '@engine/kernels/qlearn.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function QLearnStage({ state }: StageProps<QLearnState>) {
  const { w, h, goal, start, gamma, value, policy, walls, sweep, changed, converged, path, phase } = state
  const done = phase === 'done'
  const gk = `${goal[0]},${goal[1]}`, sk = `${start[0]},${start[1]}`
  const wallSet = new Set(walls)
  const pathSet = new Set(path)
  const maxV = Math.max(...value.map(v => v ?? 0), 0.1)
  return (
    <div className="card">
      <h3>强化学习 · 值迭代 <span className="hint">靠 Bellman 更新把未来总回报从终点倒推回每一步</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className={'scdn' + (converged ? '' : ' hot')}>{converged ? '已收敛' : `第 ${sweep} 轮`}</span><span className="scdl">Bellman 扫描</span></div>
          <div className="scdk"><span className="scdn">{done ? '0' : changed}</span><span className="scdl">本轮变了几格</span></div>
          <div className="scdk"><span className="scdn">{done ? `${path.length - 1} 步` : `γ=${gamma}`}</span><span className="scdl">{done ? '最优路线' : '折扣因子'}</span></div>
        </div>

        <div className="aswrap">
          <div className="asgrid" style={{ ['--cols' as string]: w }}>
            {Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => {
              const k = `${c},${r}`, idx = c + r * w
              const v = value[idx], pol = policy[idx]
              const isWall = wallSet.has(k)
              const isGoal = k === gk, isStart = k === sk
              const inPath = done && pathSet.has(k) && !isGoal
              const cls = [
                'qcell',
                isWall ? 'wall' : v !== null ? 'has' : '',
                isGoal ? 'goal' : '', isStart ? 'start' : '',
                inPath ? 'path' : '',
              ].filter(Boolean).join(' ')
              const bg = isWall ? undefined : v === null ? 'var(--panel)'
                : `color-mix(in srgb, var(--hit) ${Math.round((v / maxV) * 60)}%, var(--panel))`
              return (
                <div key={k} className={cls} style={{ background: isGoal ? undefined : bg }}>
                  {isWall ? null
                    : isGoal ? <span className="qmark">★</span>
                      : <>
                        {v !== null && v > 0 && <span className="qval">{v}</span>}
                        {pol && pol !== '★' && <span className="qpol">{pol}</span>}
                        {isStart && <span className="qstart">S</span>}
                      </>}
                </div>
              )
            }))}
          </div>
          <div className="orcap">
            {rich(state.log)}
          </div>
        </div>

        {done
          ? <p className="scnote">强化学习=智能体靠<b>试错</b>拿奖励、学最优<b>策略</b>。难点是奖励<b>延迟</b>(只有终点 +1),怎么知道中间哪步走对?值迭代:给每格估一个<b>价值</b>(从这出发未来总回报),反复用 <b>Bellman 规则</b>更新(价值=即时奖励+γ×最好邻居)。终点的 +1 顺规则<b>一圈圈倒推</b>、<b>自动绕过墙</b>:所以起点价值=γ^绕墙真实步数(0.478)而<b>不是</b> γ^曼哈顿(0.59)——这正是"距离公式"给不出、只有真迭代才有的。学好后<b>往价值最高的邻居走</b>=最优路线,还<b>不用提前知道地图</b>。它是 AlphaGo、机器人控制、大模型 <b>RLHF</b> 的底子。</p>
          : <p className="scnote" style={{ opacity: .85 }}>价值<b>初始全 0</b>,只有终点 ★ 有 +1。每按一次「下一步」= 做一轮 <b>Bellman 扫描</b>:每格取"γ×最好邻居的价值"。于是价值像<b>波纹</b>从终点往外传,挨着终点的先变 0.9、再外一圈 0.81……<b>遇到灰墙就绕</b>。等某轮没有格子再变(changed=0)就收敛了。</p>}
      </div>
    </div>
  )
}
