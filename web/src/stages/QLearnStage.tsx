/**
 * 舞台：强化学习 —— 值迭代 vs **真的 Q-learning**。
 *
 * 2026-09-09 补厚。老版本的 scnote 里写着「学好后往价值最高的邻居走 = 最优路线，
 * 还**不用提前知道地图**」—— 而它跑的是**值迭代**：每更新一格都要读四个邻居的价值，
 * 那恰恰**就是**要有地图。这个实验名字叫 Q-learning，从来没跑过 Q-learning。
 *
 * 这一屏的三个落点：
 *   ① **两张网格并排**：左边是学出来的策略，右边是**真值**（值迭代收敛后的最优策略）。
 *      学错的格子描红 —— 「学对了没有」不问算法自己。
 *   ② **没学到的格子**（Q 全 0）单独标出来：**Q-learning 只学得到它走过的地方**。
 *   ③ **两种代价并排，而且单位不一样**：值迭代要地图、Q-learning 要经验步数。
 *      这才是"免模型"的价格。
 */
import type { QLearnState } from '@engine/kernels/qlearn.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function QLearnStage({ state }: StageProps<QLearnState>) {
  const {
    w, h, goal, start, gamma, algo, eps, value, policy, truePolicy, trueValue, walls,
    sweep, changed, converged, wrongCells, unlearned, cells, updates, expSteps, hits, cmp, path, phase,
  } = state
  const done = phase === 'done'
  const isQL = algo.startsWith('Q-learning')
  const gk = `${goal[0]},${goal[1]}`, sk = `${start[0]},${start[1]}`
  const wallSet = new Set(walls)
  const pathSet = new Set(path)
  const maxV = Math.max(...value.map(v => v ?? 0), 0.1)

  /** 画一张网格。`truth` 那张画真值，不标红 */
  const grid = (vals: (number | null)[], pols: (string | null)[], truth: boolean) => (
    <div className="asgrid" style={{ ['--cols' as string]: w }}>
      {Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => {
        const k = `${c},${r}`, i = c + r * w
        const v = vals[i], pol = pols[i]
        const wall = wallSet.has(k)
        const isG = k === gk, isS = k === sk
        const inPath = done && !truth && pathSet.has(k) && !isG
        //  ⭐ 学错 = 跟真值不一样；没学到 = 压根没有箭头（Q 全 0）
        const wrong = !truth && !wall && !isG && truePolicy[i] !== null && truePolicy[i] !== '★' && pol !== truePolicy[i]
        const none = !truth && !wall && !isG && pol === null && truePolicy[i] !== null && truePolicy[i] !== '★'
        const cls = ['qcell', wall ? 'wall' : v !== null ? 'has' : '', isG ? 'goal' : '', isS ? 'start' : '',
          inPath ? 'path' : '', wrong ? 'qwrong' : '', none ? 'qnone' : ''].filter(Boolean).join(' ')
        const mv = truth ? Math.max(...trueValue.map(x => x ?? 0), 0.1) : maxV
        const bg = wall ? undefined : v === null ? 'var(--panel)'
          : `color-mix(in srgb, var(--hit) ${Math.round(((v ?? 0) / mv) * 60)}%, var(--panel))`
        return (
          <div key={k} className={cls} style={{ background: isG ? undefined : bg }}>
            {wall ? null
              : isG ? <span className="qmark">★</span>
                : <>
                  {v !== null && v > 0 && <span className="qval">{v}</span>}
                  {pol && pol !== '★' && <span className="qpol">{pol}</span>}
                  {none && <span className="qpol dimv">·</span>}
                  {isS && <span className="qstart">S</span>}
                </>}
          </div>
        )
      }))}
    </div>
  )

  return (
    <div className="card">
      <h3>强化学习 <span className="hint">{isQL ? 'Q-learning：只有经验，一次都不查地图' : '值迭代：Bellman 从终点倒推——但它手里有地图'}</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk">
            <span className={'scdn' + (converged ? '' : ' hot')}>
              {isQL ? `第 ${sweep} 轮经验` : converged ? '已收敛' : `第 ${sweep} 轮`}
            </span>
            <span className="scdl">{isQL ? 'episode（轴）' : 'Bellman 扫描（轴）'}</span>
          </div>
          {/*  ⭐ 「学对了没有」对着真值数，不问算法自己 */}
          <div className="scdk">
            <span className={`scdn ${wrongCells === 0 ? 'good' : 'bad'}`}>{wrongCells} / {cells}</span>
            <span className="scdl">策略跟最优不一样的格子</span>
          </div>
          <div className="scdk">
            <span className={`scdn ${unlearned > 0 ? 'bad' : ''}`}>{unlearned}</span>
            <span className="scdl">{isQL ? '根本没学到（走都没走过）' : '还没传到的格子'}</span>
          </div>
          {/*  ⭐ 两种代价的单位不一样，而那正是重点 */}
          <div className="scdk">
            <span className="scdn">{isQL ? `${expSteps} 步` : `${updates} 次`}</span>
            <span className="scdl">{isQL ? '经验步数（不需要地图）' : 'Bellman 更新（要求有地图）'}</span>
          </div>
          <div className="scdk">
            <span className="scdn">{isQL ? `${hits} 次` : `γ=${gamma}`}</span>
            <span className="scdl">{isQL ? `到过终点（ε=${eps}）` : '折扣因子'}</span>
          </div>
          {done && (
            <div className="scdk">
              <span className="scdn">{path.length > 1 ? `${path.length - 1} 步` : '走不到'}</span>
              <span className="scdl">从起点跟箭头走</span>
            </div>
          )}
        </div>

        <div className="aswrap">
          {/*  ⭐ 学出来的 vs 真值，两张并排 */}
          <div className="qpair">
            <div className="qpane">
              <div className="qpane-t">{isQL ? 'Q-learning 学出来的' : '值迭代算出来的'}（红=跟最优不一样，· =根本没学到）</div>
              {grid(value, policy, false)}
            </div>
            <div className="qpane">
              <div className="qpane-t">真值：最优策略（另跑一遍值迭代算的，<b>算法看不到</b>）</div>
              {grid(trueValue, truePolicy, true)}
            </div>
          </div>
          <div className="orcap">{rich(state.log)}</div>
        </div>

        {/*  ⭐ 两种算法的账 —— 代价单位不一样，"需要地图吗"那一栏才是分野 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>算法</span><span>代价</span><span>需要地图吗</span><span>学错几格</span><span>跟箭头走</span>
            </div>
            {cmp.map((x, k) => (
              <div className={`qsrow ${x.algo === algo && (x.eps === eps || x.eps === -1) ? 'mcpick' : ''}`} key={k}>
                <span>{x.eps >= 0 ? `Q-learning ε=${x.eps}` : '值迭代'}</span>
                <span className="dimv">{x.cost}</span>
                <span className={x.needsMap ? 'bad' : 'good'}>{x.needsMap ? '要' : '不要'}</span>
                <span className={x.wrongCells === 0 ? 'good' : ''}>{x.wrongCells}{x.unlearned > 0 ? `（${x.unlearned} 格没去过）` : ''}</span>
                <span>{x.pathSteps > 0 ? `${x.pathSteps} 步` : '走不到'}</span>
              </div>
            ))}
            <div className="orcap">
              ⚠️ <b>这两行的代价单位根本不一样，而那正是重点。</b>
              值迭代 {cmp[0].n} 次更新就收敛了、看着便宜得多 —— <b>但它要求你手里有一张地图</b>：
              每更新一格都要读得到四个邻居的价值。<b>真实的智能体没有地图</b>，只有一串"我在哪、做了什么、拿到多少、到了哪"。
              <b>"免模型"不是免费的，它的价格就是那几千步经验。</b>
              <br />
              而 <b>ε=0 那行值得单看</b>：它学错 {cmp[1]?.wrongCells} 格、{cmp[1]?.unlearned} 格压根没去过，
              <b>可它跟箭头走照样是 {cmp[1]?.pathSteps} 步</b>（跟最优一样）——
              <b>它只学会了那一条路</b>。「学到最优路径」和「学到最优策略」是两件事。
            </div>
          </div>
        )}

        <p className="scnote">
          强化学习 = 智能体靠<b>试错</b>拿奖励、学最优<b>策略</b>。难点是奖励<b>延迟</b>（只有终点 +1），
          怎么知道中间哪一步走对了？答案是给每格估一个<b>价值</b>（从这儿出发未来的总回报），反复用 <b>Bellman 规则</b>更新。
          终点的 +1 顺规则<b>一圈圈倒推</b>、<b>自动绕过墙</b>：所以起点价值 = γ^绕墙真实步数，<b>而不是</b> γ^曼哈顿 ——
          这正是"距离公式"给不出、只有真迭代才有的。
          <br />
          <b>而这一屏真正要说的是这两条路的分野。</b>
          <b>值迭代</b>每更新一格，都要<b>枚举它的四个邻居、读它们的价值</b> —— 那等于<b>手里有一张地图</b>。
          （老版本这里写着「不用提前知道地图」，那句话对值迭代来说是反的。）
          <b>Q-learning</b> 的更新式里<b>只有 s、a、r、s'</b>：我在哪、做了什么、拿到多少、到了哪。
          它<b>一次都不查地图</b>，撞墙也是撞了才知道 —— 代价是要走上几千步经验。
          <br />
          <b>而它只学得到自己走过的地方。</b>右边那张真值图是另跑一遍值迭代算的，
          <b>Q-learning 看不到它</b> —— 屏幕上那个"学错几格"，是我们替它数的，它自己无从得知。
          这也是为什么<b>探索率 ε 不是可调可不调的旋钮</b>：不探索就只会重复第一次撞对的那条路。
          <br />
          值迭代 = <b>有模型的规划</b>；Q-learning = 同一套 Bellman，但<b>从经验里免模型地学</b>。
          RL 是 AlphaGo、机器人控制、推荐、大模型 <b>RLHF</b> 的底子。
        </p>
      </div>
    </div>
  )
}
