/**
 * 舞台：思维树 ToT —— 生成 → 评估 → 剪枝 → 逐条深入（可回溯）→ 结论。
 *
 * 2026-09-09 补厚。老版本画的是一棵**写死的**两层树（5 个手挑的想法、3 个都能到 24 的叶子、
 * 一句预先写好的解），用绝对定位把 5 个节点摆在固定百分比上。
 *
 * 现在第一层是**全部枚举**出来的（10~18 条），所以布局换成**分支列表** ——
 * 摆得下、也才看得见剪枝到底剪掉了多少。
 *
 * 这一屏的三个落点：
 *   ① **评估器判的 sure/impossible，旁边永远摆着真值**。判错的那条描红 ——
 *      **剪掉的枝再也回不来**，回溯救不了它。
 *   ② **ToT 声称的结论 vs 独立穷举出的真值**：它剪错了也会一口咬定"无解"。
 *   ③ **代价三栏**：展开了多少节点、评估器内部又走了多少、总账。
 *      完美评估器那一栏的总账会告诉你为什么"现实里没有完美评估器"。
 */
import type { ToTState } from '@engine/kernels/tot.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const STAGE_CN: Record<ToTState['stage'], string> = {
  root: '根', generate: '生成分支', evaluate: '评估前景', prune: '剪枝', expand: '深入（可回溯）', done: '结论',
}

export function ToTStage({ state }: StageProps<ToTState>) {
  const {
    root, nums, l1, l2, stage, kept, trying, backtracks, solL1, solution, target,
    evalKind, claimFound, trulySolvable, truePath, wrongPrunes, nodes, evals, evalNodes, costs, phase,
  } = state
  const done = phase === 'done'
  const showEval = stage !== 'root' && stage !== 'generate'
  const total = nodes + evalNodes
  //  一致：ToT 说的和真值对不对得上
  const agrees = claimFound === trulySolvable

  return (
    <div className="card">
      <h3>思维树 ToT <span className="hint">生成→评估→剪枝→深入，一棵真的搜索树</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk">
            <span className="scdn hot" style={{ fontSize: '14px' }}>{STAGE_CN[stage]}</span>
            <span className="scdl">当前步 · {root} 凑 {target}</span>
          </div>
          <div className="scdk">
            <span className="scdn">{showEval ? `${kept} / ${l1.length}` : '—'}</span>
            <span className="scdl">剪枝后留下 / 一共生成</span>
          </div>
          {/*  ⭐ 补厚的落点①：评估器剪错了几条。剪掉的枝再也回不来 */}
          <div className="scdk">
            <span className={`scdn ${wrongPrunes > 0 ? 'bad' : showEval ? 'good' : ''}`}>{showEval ? wrongPrunes : '—'}</span>
            <span className="scdl">评估器<b>剪错</b>了几条（对着真值数的）</span>
          </div>
          <div className="scdk">
            <span className="scdn">{backtracks}</span>
            <span className="scdl">回溯次数（走不通退回来换一条）</span>
          </div>
          {/*  ⭐ 补厚的落点②：ToT 说的 vs 真值 */}
          <div className="scdk">
            <span className={`scdn ${done ? (agrees ? 'good' : 'bad') : ''}`}>
              {done ? (claimFound ? '有解' : '无解') : '—'}
            </span>
            <span className="scdl">ToT 说的（真值：{trulySolvable ? '有解' : '无解'}）</span>
          </div>
          <div className="scdk">
            <span className="scdn">{total}</span>
            <span className="scdl">总账（展开 {nodes} + 评估器内部 {evalNodes}）</span>
          </div>
        </div>

        <div className="totlist">
          <div className="totroot">根 <b>{root}</b>　目标 <b>{target}</b>　评估器：<b>{evalKind}</b></div>
          {l1.length === 0
            ? <div className="orcap">按「下一步」开始：先把 {nums.length} 个数里"挑两个做一次运算"的<b>全部</b>可能列出来。</div>
            : l1.map((n, k) => {
              //  ⚠️ 剪错 = 评估器判 impossible，而真值说这条能到 24
              const wrong = n.pruned && n.trulySure
              const cls = ['totrow',
                n.onPath ? 'onpath' : '',
                wrong ? 'wrong' : n.pruned ? 'pruned' : '',
                k === trying && !done ? 'trying' : '',
                n.visited ? 'visited' : ''].filter(Boolean).join(' ')
              return (
                <div className={cls} key={k}>
                  <span className="totop">{n.op}</span>
                  <span className="totst">→ {n.state}</span>
                  <span className="totjudge">
                    {!n.evaluated ? <span className="dimv">待评估</span>
                      : n.sure ? <span className="good">✓ sure</span> : <span className="dimv">✗ impossible</span>}
                  </span>
                  {/*  ⭐ 评估器说的旁边永远摆着真值 */}
                  <span className="tottrue">
                    {n.evaluated ? (n.trulySure ? '真值：能到 24' : '真值：到不了') : ''}
                  </span>
                  <span className="totmark">
                    {wrong ? <b className="bad">⚠️ 剪错了</b>
                      : n.onPath ? <b className="good">★ 解在这条</b>
                        : n.visited ? <span className="dimv">试过，走不通</span> : ''}
                  </span>
                </div>
              )
            })}
          {/*  正在深入 / 已深入过的那条的叶子 */}
          {trying >= 0 && l2.filter(lf => lf.parent === trying).length > 0 && (
            <div className="totleaves">
              {l2.filter(lf => lf.parent === trying).map((lf, k) => (
                <span key={k} className={`totleaf ${lf.solves ? 'solve' : ''} ${lf.onPath ? 'onpath' : ''}`}>
                  {lf.op}{lf.solves ? ' ✓' : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="orcap">{rich(state.log)}</div>

        {/*  ⭐ 补厚的落点③：三档评估器的账，含**评估器内部**那一栏 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>评估器</span><span>展开节点</span><span>评估器内部</span><span>总账</span><span>结论</span>
            </div>
            {costs.map(c => (
              <div className={`qsrow ${c.evalKind === evalKind ? 'mcpick' : ''}`} key={c.evalKind}>
                <span>{c.evalKind}{c.evalKind === evalKind ? ' ◀' : ''}</span>
                <span className="dimv">{c.nodes}</span>
                <span className={c.evalNodes > 0 ? 'bad' : 'dimv'}>{c.evalNodes}</span>
                <span className={c.total === Math.min(...costs.map(x => x.total)) ? 'good' : ''}>{c.total}</span>
                <span className={c.found === trulySolvable ? '' : 'bad'}>
                  {c.found ? '找到解' : '说无解'}{c.found === trulySolvable ? '' : ' ✗错'}
                </span>
              </div>
            ))}
            <div className="orcap">
              ⚠️ <b>「评估器内部」那一栏是关键。</b>完美评估器每判一次前景，内部都真的把剩下的数穷举了一遍 ——
              它展开的节点少，只是因为<b>省下来的那些是在评估器里面走完的</b>。
              总账一摆出来，它常常<b>比不剪枝还贵</b>。
              <b>能完美判断中间状态有没有希望，本来就等于已经把题解了一遍</b> ——
              这就是"现实里没有完美评估器"的算术版本。
            </div>
          </div>
        )}

        {/*  ⭐ 真值：ToT 说无解的时候，把真解摆出来 */}
        {done && !agrees && (
          <div className="qsscale">
            <div className="qsrow qshead"><span>真值（独立穷举算的）</span><span></span><span></span><span></span><span></span></div>
            <div className="qsrow">
              <span className={trulySolvable ? 'good' : ''}>{trulySolvable ? '有解' : '无解'}</span>
              <span style={{ textAlign: 'left', gridColumn: 'span 4' }}>{truePath.join('，') || '整棵树走完，没有一条到 24'}</span>
            </div>
            <div className="orcap">
              ⚠️ <b>ToT 的结论和真值对不上</b>：它说「{claimFound ? '有解' : '无解'}」，而真值是「{trulySolvable ? '有解' : '无解'}」。
              错在评估器把 <b>{wrongPrunes}</b> 条有希望的枝当死路剪了 ——
              <b>剪掉的枝再也回不来</b>，后面回溯了 {backtracks} 次也没用，因为<b>回溯只能在"留下的枝"之间换</b>。
            </div>
          </div>
        )}

        <p className="scnote">
          <b>思维树 ToT = 把推理组织成一棵搜索树</b>：每步<b>生成多个想法（分支）</b>、<b>评估</b>每个分支能不能通向解、
          <b>剪掉</b>没希望的、沿有希望的<b>再往深处展开一层</b>，走不通还能<b>回溯</b>换分支。
          比思维链（一条道走到黑、错了没回头）、自洽（多条独立线投票、每条内部还是直线）更进一步。
          <br />
          <b>而这一屏真正要说的是它的天花板在哪：不在搜索，在评估器。</b>
          回溯只能在"留下的枝"之间换 —— <b>被剪掉的那条，回溯是够不着的</b>。
          评估器判错一次，ToT 就会一口咬定"无解"，而且它<b>没有任何办法知道自己错了</b>
          （屏幕上那个真值是另跑一遍不剪枝的穷举算的，ToT 看不到）。
          <br />
          导览里那句「<b>评估中间状态往往比解题本身还难</b>」不是修辞：
          把上面那张表的「评估器内部」一栏加进总账，<b>完美评估器常常比不剪枝还贵</b>。
          所以真实 ToT 只能用<b>便宜但会判错</b>的那种 —— 在 24 点、字谜这类中间状态好坏容易判断的问题上效果显著，
          在开放式推理上收益就很有限。
        </p>
      </div>
    </div>
  )
}
