/**
 * 舞台：MCTS —— 根 + 5 个走法，每轮 选择(UCB)→模拟→回传。
 *
 * 2026-09-09 补厚。老版本的落点是"访问次数集中到 A"，而 A 是被一张**写死的脚本表**
 * 安排成每次都赢的 —— 屏幕上看不到任何统计，只看得到一个已知答案。
 *
 * 这一屏改成三个落点：
 *   ① **UCB 拆成两项摆出来**：利用（实测胜率）+ 探索（c·√(ln N / n)）。
 *      「兼顾探索与利用」这句话，得能指着屏幕说是哪一项在起作用。
 *   ② **真实胜率和实测胜率并排**：真实胜率**算法看不到**，只有屏幕上看得到。
 *      「选对了吗」因此有独立答案，不用问算法自己。
 *   ③ **选对率曲线**：单场就是抛硬币，重跑 500 次的概率才是"多花算力有多大用"的答案。
 *
 * ⚠️ 老版本的 scnote 里写了 `**选择**` 这类星号 —— `.scnote` 不走 rich()，
 * 星号会原样印在屏幕上。这一版一律用 <b>。
 */
import type { MctsState } from '@engine/kernels/mcts.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const W = 400, H = 128
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

export function MctsStage({ state }: StageProps<MctsState>) {
  const {
    moves, trueP, best, n, w, picks, picksN, picksW, chosen, win, iter, budget, c,
    byVisit, byRate, final, right, pRight, sweep, cSweep, ruleCmp, phase,
  } = state
  const done = phase === 'done'
  const K = moves.length
  const maxN = Math.max(...n, 1)
  //  当前预算这一列的跨度，和两条决策规则的差 —— 屏幕上的话得跟着这两个数走，不能写死
  //  这个预算下谁垫底 vs 加满预算后谁垫底 —— 两者不一致，就说明这一列排不出 c 的高下
  const worstNow = cSweep.reduce((a, x) => (x.pRight < a.pRight ? x : a), cSweep[0]).c
  const worstMax = cSweep.reduce((a, x) => (x.pMax < a.pMax ? x : a), cSweep[0]).c
  const ruleGap = Math.abs(ruleCmp[0].pRight - ruleCmp[1].pRight)
  //  预算被平摊 = "访问最多"整个是平局，那一列不携带信息
  const flatAlloc = Math.max(...n) - Math.min(...n) <= 1
  const rad = (k: number) => 11 + (n[k] / maxN) * 11
  const bx = (k: number) => 40 + k * ((W - 80) / (K - 1))

  //  选对率曲线：横轴取 log2(预算)，不然 10 和 320 挤在一起
  const cw = 340, ch = 118, cl = 30, cr = 12, ct = 12, cb = 24
  const lx = (b: number) => cl + (Math.log2(b) - Math.log2(sweep[0].budget))
    / (Math.log2(sweep[sweep.length - 1].budget) - Math.log2(sweep[0].budget)) * (cw - cl - cr)
  const ly = (p: number) => ct + (1 - p) * (ch - ct - cb)

  return (
    <div className="card">
      <h3>蒙特卡洛树搜索 MCTS <span className="hint">随机模拟 + UCB，把思考花在最有希望的走法上</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk">
            <span className="scdn hot">{done ? `选 ${moves[final]}` : iter === 0 ? '起步' : `第 ${iter}/${budget} 轮`}</span>
            <span className="scdl">模拟轮（轴）</span>
          </div>
          <div className="scdk">
            <span className="scdn">{chosen >= 0 && !done ? moves[chosen] : '—'}</span>
            <span className="scdl">本轮选中{win === 1 ? ' · 赢' : win === 0 ? ' · 输' : ''}</span>
          </div>
          {/*  ⭐ 「选对了吗」有独立答案：真实胜率是我们设的，算法看不到 */}
          <div className="scdk">
            <span className={`scdn ${done ? (right ? 'good' : 'bad') : ''}`}>{done ? (right ? '选对了' : '选错了') : '—'}</span>
            <span className="scdl">真实最优是 {moves[best]}（真实胜率 {trueP[best]}）</span>
          </div>
          {/*  ⭐ 单看这一次是运气，概率才是答案 */}
          <div className="scdk">
            <span className={`scdn ${pRight >= 0.9 ? 'good' : pRight < 0.6 ? 'bad' : ''}`}>{pct(pRight)}</span>
            <span className="scdl">这个配置选对的概率（重跑 500 次）</span>
          </div>
        </div>

        <div className="mctswrap">
          <svg className="gcntree" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            <circle cx={W / 2} cy="20" r="13" fill="color-mix(in srgb,var(--now) 16%,var(--panel))" stroke="var(--now)" strokeWidth="1.2" />
            <text x={W / 2} y="24" textAnchor="middle" fontSize="8" fontWeight={700} fill="var(--ink)">根</text>
            {moves.map((m, k) => {
              const isPick = k === chosen && !done
              const isBest = done && k === final
              const isTrue = k === best
              const r = rad(k)
              return (
                <g key={k}>
                  <line x1={W / 2} y1="33" x2={bx(k)} y2={70 - r}
                    stroke={isPick || isBest ? 'var(--hit)' : 'var(--line)'} strokeWidth={isPick || isBest ? 2 : 1} />
                  <circle cx={bx(k)} cy="70" r={r}
                    fill={isBest ? 'color-mix(in srgb,var(--hit) 22%,var(--panel))' : n[k] > 0 ? 'color-mix(in srgb,var(--hit) 10%,var(--panel))' : 'var(--panel)'}
                    stroke={isPick ? 'var(--now)' : isBest ? 'var(--hit)' : 'var(--line)'} strokeWidth={isPick || isBest ? 2.4 : 1} />
                  <text x={bx(k)} y="69" textAnchor="middle" fontSize="11" fontWeight={800} fill="var(--ink)">{m}</text>
                  <text x={bx(k)} y="78" textAnchor="middle" fontSize="6" fill="var(--dim)">{n[k]}访/{w[k]}赢</text>
                  {/*  ⭐ 真实胜率：算法看不到它，只有屏幕上看得到。★=真正的最优 */}
                  <text x={bx(k)} y={70 + r + 12} textAnchor="middle" fontSize="7.5"
                    fill={isTrue ? 'var(--hit)' : 'var(--faint)'} fontWeight={isTrue ? 700 : 400}>
                    真实 {trueP[k]}{isTrue ? ' ★' : ''}
                  </text>
                  <text x={bx(k)} y={70 + r + 21} textAnchor="middle" fontSize="7.5" fill="var(--dim)">
                    实测 {n[k] ? (w[k] / n[k]).toFixed(2) : '—'}
                  </text>
                </g>
              )
            })}
          </svg>

          {/*  ⭐ UCB 拆成两项 —— 「兼顾探索与利用」得能指着屏幕说是哪一项在起作用 */}
          <div className="qsscale">
            {/*  ⚠️ 表头得说清这是**哪个时点**的账。中间帧里它是"本轮开始时"的，
                 而上面树上的实测胜率已经是这一轮跑完之后的 —— 两个数对不上是正常的，
                 但屏幕上不写清楚，读的人只会觉得有一个是错的。 */}
            <div className="qsrow qshead">
              <span>{done ? '最终' : '本轮开始时'}</span><span>利用（那时的胜率）</span><span>+ 探索（c·√(lnN/n)）</span><span>= UCB</span><span></span>
            </div>
            {picks.map(p => (
              <div className={`qsrow ${p.k === chosen && !done ? 'mcpick' : ''}`} key={p.k}>
                <span>{moves[p.k]}{p.k === best ? ' ★' : ''}<span className="dimv"> {picksW[p.k]}/{picksN[p.k]}</span></span>
                <span className="dimv">{p.ucb === null ? '—' : p.exploit.toFixed(3)}</span>
                <span className={c === 0 ? 'dimv' : ''}>{p.ucb === null ? '—' : `+ ${p.explore.toFixed(3)}`}</span>
                <span className={p.k === chosen && !done ? 'good' : ''}>{p.ucb === null ? '∞（没试过）' : p.ucb.toFixed(3)}</span>
                <span>{p.k === chosen && !done ? '◀ 挑它' : ''}</span>
              </div>
            ))}
            <div className="orcap">
              {c === 0
                ? <>⚠️ <b>c=0：探索项整列都是 0</b>，UCB 退化成"只看实测胜率" —— 开局各试一次之后，
                  谁碰巧赢了就一直押谁，其余的<b>再也没有机会翻案</b>。</>
                : <>没试过的一律 <b>∞</b> 先试；试过的按 <b>利用 + 探索</b> 排。试得越少，探索项越大 ——
                  <b>这就是"给冷门一个翻案的机会"</b>。</>}
            </div>
          </div>

          <div className="orcap">{rich(state.log)}</div>
        </div>

        {/*  ⭐ 选对率 vs 预算 —— "靠大量随机对局的统计说话"这句话的落点 */}
        {done && (
          <div className="bncurvewrap">
            <div className="bncurve-t">选对率随<b>模拟预算</b>变化（每档重跑 500 次；横轴对数）</div>
            <svg className="bncurve" viewBox={`0 0 ${cw} ${ch}`} preserveAspectRatio="none">
              {[0, 0.5, 1].map(v => (
                <g key={v}>
                  <line x1={cl} y1={ly(v)} x2={cw - cr} y2={ly(v)} className="bng" vectorEffect="non-scaling-stroke" />
                  <text x={cl - 4} y={ly(v) + 3} className="bnax" textAnchor="end">{pct(v)}</text>
                </g>
              ))}
              {/*  瞎猜的基线：5 个走法随机挑一个 = 20% */}
              <line x1={cl} y1={ly(1 / K)} x2={cw - cr} y2={ly(1 / K)} className="bnpeak" vectorEffect="non-scaling-stroke" />
              <text x={cw - cr} y={ly(1 / K) - 3} className="bnax" textAnchor="end">瞎猜 {pct(1 / K)}</text>
              {sweep.map(s => <text key={s.budget} x={lx(s.budget)} y={ch - 6} className="bnax" textAnchor="middle">{s.budget}</text>)}
              <polyline points={sweep.map(s => `${lx(s.budget)},${ly(s.pRight)}`).join(' ')} className="bncurveline" vectorEffect="non-scaling-stroke" />
              {sweep.map(s => (
                <g key={s.budget}>
                  <circle cx={lx(s.budget)} cy={ly(s.pRight)} r={s.budget === budget ? 4.2 : 2.6} className={s.budget === budget ? 'bndot cur' : 'bndot'} />
                  {s.budget === budget && <text x={lx(s.budget)} y={ly(s.pRight) - 8} className="bndotlbl" textAnchor="middle">{pct(s.pRight)}</text>}
                </g>
              ))}
            </svg>
          </div>
        )}

        {/*  ⭐ 探索常数：两列。小预算那一列分不出高下，这件事本身要说出来 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>探索常数 c</span><span>{budget} 轮选对率</span><span>320 轮选对率</span><span>什么毛病</span><span></span>
            </div>
            {cSweep.map(x => (
              <div className={`qsrow ${x.c === c ? 'mcpick' : ''}`} key={x.c}>
                <span>c={x.c}{x.c === c ? ' ◀' : ''}</span>
                <span className="dimv">{pct(x.pRight)}</span>
                <span className={x.pMax >= 0.95 ? 'good' : 'bad'}>{pct(x.pMax)}</span>
                <span style={{ textAlign: 'left', gridColumn: 'span 2' }} className="dimv">
                  {x.c === 0 ? '纯利用 —— 锁死，加多少预算都不收敛'
                    : x.c >= 4 ? '探索过头 —— 几乎均匀撒钱，差的也照样反复试'
                      : '兼顾 —— 差的很快被压下去，好的拿到大部分预算'}
                </span>
              </div>
            ))}
            {/*  ⚠️ 这句话我先写成了"四档的差距还没噪声大" —— 而屏幕上跨度 11.6 个点、
                 旁边写着噪声 ±2 点，**自己打自己**。真正量得到的不是"差距是噪声"，
                 而是**这一列把 c 排错了**：c=0 在小预算下看着中游，右边那一列才露馅。 */}
            <div className="orcap">
              {worstNow !== worstMax
                ? <>⚠️ <b>别拿「{budget} 轮」那一列去排 c 的高下 —— 它排错了。</b>
                  这一列垫底的是 <b>c={worstNow}</b>（{pct(cSweep.find(x => x.c === worstNow)!.pRight)}），
                  而真正有毛病的是 <b>c={worstMax}</b>：它在这一列有 {pct(cSweep.find(x => x.c === worstMax)!.pRight)}、看着还行，
                  可<b>加到 320 轮也只有 {pct(cSweep.find(x => x.c === worstMax)!.pMax)}</b>。
                  <b>小预算下大家都还没来得及收敛，看不出谁根本收敛不了。</b></>
                : <>这一列垫底的和加满预算那一列垫底的都是 <b>c={worstNow}</b>，排序对得上。
                  但差距要到右边那一列才拉得开：{pct(cSweep.find(x => x.c === worstMax)!.pMax)}
                  {' vs '}{pct(Math.max(...cSweep.map(x => x.pMax)))}。</>}
            </div>
          </div>
        )}

        {/*  ⭐ 量不到的那件事也摆出来 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead"><span>最终怎么选</span><span>选对率</span><span></span><span></span><span></span></div>
            {ruleCmp.map(x => (
              <div className="qsrow" key={x.rule}>
                <span>{x.rule}</span>
                <span className="dimv">{pct(x.pRight)}</span>
                <span style={{ textAlign: 'left', gridColumn: 'span 3' }} className="dimv">
                  {x.rule.startsWith('访问') ? `此刻会选 ${moves[byVisit] ?? '—'}` : `此刻会选 ${moves[byRate] ?? '—'}`}
                </span>
              </div>
            ))}
            {/*  ⚠️ 同样不能写死成"几乎一样" —— c=4/预算10 那档实测 17.0% vs 43.6%，差 26 个点。 */}
            <div className="orcap">
              {ruleGap < 0.08
                ? <>⚠️ <b>这一屏量不出这两条规则的差别。</b>MCTS 最后取的是"访问次数最多"而不是"胜率最高"，
                  理由通常说成"胜率会被只试过一两次、碰巧全赢的走法骗走"。但在这个<b>扁平的 {K} 选一</b>上，
                  实测两者<b>几乎一样</b>（{pct(ruleCmp[0].pRight)} vs {pct(ruleCmp[1].pRight)}）。
                  真实 MCTS 里取访问次数的理由在<b>树</b>上（深层节点的价值估计方差更大、还被对手挑剔过），
                  而这一屏根本没有树。<b>量不到就说量不到</b> —— 别把"看起来一样"当成"两者等价"。</>
                : <>⚠️ <b>这一档两条规则差得很远</b>（{pct(ruleCmp[0].pRight)} vs {pct(ruleCmp[1].pRight)}）。
                  {flatAlloc
                    ? <>　原因就摆在上面的访问次数上：<b>预算被平摊成 {n.join('/')}，"访问最多"整个是平局</b>，
                      只能随机拆 —— 于是它退化成瞎猜（{pct(1 / K)}）。
                      <b>这不是"胜率规则更好"，是"访问计数在均匀分配下根本没携带信息"。</b>
                      真实 MCTS 敢用访问次数，前提正是 UCB 已经把预算拉开了差距；<b>c 调过头，这个前提就没了</b>。</>
                    : <>　访问次数是 {n.join('/')}。</>}</>}
            </div>
          </div>
        )}

        {done
          ? <p className="scnote">
            下棋走法爆炸，没法全搜。MCTS 每轮四步：<b>选择</b>（从根按 <b>UCB = 胜率 + c·√(ln N_父/n_子)</b> 挑分支）→
            <b>扩展</b>→<b>模拟</b>（随机走到底看输赢）→<b>回传</b>（把结果更新回沿途节点）。
            <br />
            <b>这一屏真正要说的是：单场模拟就是抛一次硬币，它什么都不说明。</b>
            {moves[best]} 的真实胜率 {trueP[best]}、{moves[1]} 是 {trueP[1]}，只差 {(trueP[best] - trueP[1]).toFixed(2)} ——
            {budget} 轮下来选对的概率只有 <b>{pct(pRight)}</b>，
            要到 {sweep[sweep.length - 1].budget} 轮才 <b>{pct(sweep[sweep.length - 1].pRight)}</b>。
            <b>"靠大量随机对局的统计说话"里，"大量"两个字不是修辞。</b>
            <br />
            而 <b>c 决定了它到底收不收敛</b>：c=0 只利用不探索，开局那一次输赢就把它锁死了，
            加到 320 轮也只有 {pct(cSweep[0].pMax)}；<b>它不是收敛得慢，是压根不收敛</b>。
            <br />
            MCTS 是 <b>AlphaGo/AlphaZero 的引擎</b>（配神经网络给出先验和价值），和<b>思维树 ToT</b> 一脉相承 ——
            都是带评估的树搜索。
          </p>
          : <p className="scnote" style={{ opacity: .85 }}>
            圆越大 = 被访问越多。每轮：①<b>选择</b> —— 挑 <b>UCB 最大</b>的走法（没试过的 UCB=∞ 先试）；
            ②<b>模拟</b> —— 照那个走法的<b>真实胜率</b>抛一次硬币；③<b>回传</b> —— 更新它的访问数和胜数。
            <br />
            <b>盯着上面那张表的两列</b>：左边"利用"是它已经知道的，右边"探索"是"这条试得太少、给它个机会"。
            <b>真实胜率那一行算法是看不到的</b> —— 它只能靠一次次抛硬币去估，而 {moves[best]} 和 {moves[1]} 只差 {(trueP[best] - trueP[1]).toFixed(2)}。
          </p>}
      </div>
    </div>
  )
}
