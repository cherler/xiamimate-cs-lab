/** 舞台：贪心 —— 每步拿最大的币找零，走完对比动态规划的最优解 */
import type { GreedyState } from '@engine/kernels/greedy.ts'
import type { StageProps } from '../types.ts'

export function GreedyStage({ state }: StageProps<GreedyState>) {
  const { coins, target, rem, pick, picked, greedyCount, optimal, phase } = state
  const started = picked.length > 0
  const suboptimal = phase === 'done' && greedyCount > optimal
  return (
    <div className="card">
      <h3>贪心算法 <span className="hint">"每步拿最好"什么时候能=全局最优</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{target}</span><span className="scdl">要凑的钱</span></div>
          <div className="scdk"><span className="scdn">{coins.join(' ')}</span><span className="scdl">币值</span></div>
          <div className="scdk"><span className="scdn hot">{started ? greedyCount : 0}</span><span className="scdl">贪心用了几枚</span></div>
        </div>

        {/* 贪心已拿的币 */}
        <div className="grwrap">
          <div className="grcoins">
            {picked.map((c, k) => (
              <div key={k} className={`grcoin ${phase === 'run' && k === picked.length - 1 ? 'now' : ''}`}>{c}</div>
            ))}
            {picked.length === 0 && <span className="grempty">（还没开始）</span>}
          </div>
          <div className="orcap">
            {phase === 'run' && pick > 0 ? <span>剩 {rem}，贪心拿当下最大的币 <b>{pick}</b> → 已拿 [{picked.join('+')}]</span>
              : phase === 'done' ? <span>贪心结果：{picked.join('+')} = <b>{greedyCount}</b> 枚</span>
              : '按「下一步」开始贪心找零'}
          </div>

          {/* 对比条 */}
          {phase === 'done' && (
            <div className="grcompare">
              <div className="grbar">
                <span className="grlab">贪心</span>
                <span className="grtrack"><span className="grfill greedy" style={{ width: `${(greedyCount / Math.max(greedyCount, optimal)) * 100}%` }}>{greedyCount} 枚</span></span>
              </div>
              <div className="grbar">
                <span className="grlab">最优(DP)</span>
                <span className="grtrack"><span className="grfill opt" style={{ width: `${(optimal / Math.max(greedyCount, optimal)) * 100}%` }}>{optimal} 枚 (3+3)</span></span>
              </div>
            </div>
          )}
        </div>

        {phase === 'done'
          ? <p className="scnote">贪心凑 {target}:{picked.join('+')} = <b>{greedyCount}</b> 枚,可最优是 <b>{optimal}</b> 枚(3+3)!贪心被"先拿了 4"的局部最优带偏、回不到 3+3。它快又简单,但<b>只有问题具备"贪心选择性质"时才最优</b>——哈夫曼、Dijkstra、最小生成树吃这条所以对;找零这种币制不具备,贪心就栽。要保证最优得用<b>动态规划</b>枚举子问题。{suboptimal ? '' : ''}</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>贪心的规矩:每步都拿"当下能拿的最大币",不回头。看着很合理——但先拿了 4,就把 3+3 那条更优的路堵死了。</p>}
      </div>
    </div>
  )
}
