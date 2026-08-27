/** 舞台：Engram / n-gram 记忆 —— 建「前缀→下一个」表，O(1) 查表补全重复模式 */
import type { EngramState } from '@engine/kernels/engram.ts'
import type { StageProps } from '../types.ts'

export function EngramStage({ state }: StageProps<EngramState>) {
  const { seq, ngram, stage, table, queryKey, prediction, matchCount } = state
  const showTable = stage !== 'id'
  const showPred = stage === 'predict' || stage === 'done'
  const lookedUp = stage === 'lookup' || showPred
  return (
    <div className="card">
      <h3>Engram · n-gram 记忆 <span className="hint">用一张便宜的查表增强 Transformer</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{ngram}-gram</span><span className="scdl">记忆粒度</span></div>
          <div className="scdk"><span className="scdn">{queryKey ? `「${queryKey}」` : '—'}</span><span className="scdl">查询前缀</span></div>
          <div className="scdk"><span className="scdn hot">{showPred ? prediction : '?'}</span><span className="scdl">预测下一个</span></div>
        </div>

        {/* 序列 */}
        <div className="egwrap">
          <div className="egseq">
            {seq.map((t, j) => {
              const inQuery = lookedUp && j >= seq.length - (ngram - 1)
              return <span key={j} className={`egtok ${inQuery ? 'q' : ''}`}>{t}</span>
            })}
            {showPred && <span className="egtok pred">{prediction}</span>}
          </div>

          {/* n-gram 记忆表 */}
          {showTable && (
            <div className="egtable">
              <div className="egth">n-gram 记忆表（前 {ngram - 1} 个 → 下一个）</div>
              {table.map((e, k) => {
                const hit = lookedUp && e.key === queryKey
                return (
                  <div key={k} className={`egrow ${hit ? 'hit' : ''}`}>
                    <span className="egkey">「{e.key}」</span>
                    <span className="egarrow">→</span>
                    <span className="egnext">{e.next}</span>
                    <span className="egcount">×{e.count}</span>
                    {hit && <span className="eghit">← 命中</span>}
                  </div>
                )
              })}
            </div>
          )}

          <div className="orcap">
            {stage === 'id' && <span>问下一个 token——Engram 不靠注意力，查一张 {ngram}-gram 记忆表</span>}
            {stage === 'build' && <span>扫一遍序列建表：{table.length} 个前缀，O(1) 可查、不受注意力窗口限制</span>}
            {stage === 'lookup' && <span>取当前 {ngram - 1}-gram「{queryKey}」→ O(1) 查表命中（历史出现 {matchCount} 次）</span>}
            {showPred && <span>表里「{queryKey}」→ <b>{prediction}</b>（×{matchCount}）→ 一次查表搞定，没动注意力</span>}
          </div>
        </div>

        {stage === 'done'
          ? <p className="scnote"><b>{seq.join(' ')} → {prediction}</b>：n-gram 记忆用 <b>O(1) 查表</b>补全重复模式,不受上下文窗口限制,把"精确复制"从昂贵的注意力<b>卸载</b>到便宜的查表。它和<b>归纳头</b>目标像(都回头找"上次它之后是什么"),但机制相反:归纳头是学出来的软注意力、贵;Engram 是显式非参数化查表、便宜。二者互补——这就是 <b>n-gram 记忆增强 Transformer</b>,让注意力腾出手干更难的语义活,也是长上下文省算力的一条路。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{stage === 'id' ? 'Engram 的思路:把出现过的 n-gram 统计存成表,推理时直接查"上次它后面跟了什么"。' : stage === 'build' ? '每个前缀记下它后面跟过的 token 及次数。这张表查一次是常数时间,和上下文多长无关。' : '命中的这一行,就是"上次/历次这个前缀之后跟的 token"——直接复制过来当预测。'}</p>}
      </div>
    </div>
  )
}
