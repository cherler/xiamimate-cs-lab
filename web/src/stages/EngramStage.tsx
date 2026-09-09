/**
 * 舞台：Engram / n-gram 记忆 —— 建「前缀→下一个」表，O(1) 查表补全重复模式。
 *
 * 2026-09-09 补厚。老版本用的是一条**完美周期**序列、n 写死 3 ——
 * **查表必然命中、预测必然对，一次失败都演不出来**。而 n-gram 最经典的那对毛病
 * （**会 miss**、**会歧义**）恰恰全被那条序列绕过去了。
 *
 * 这一屏加了两块：
 *   ① **逐位置评测表**：各档 n 的命中率 / 歧义率 / 准确率 —— **n 越大越 miss、n 越小越歧义**。
 *   ② ⭐ **窗口基线对照**：只看最近 W 个 token 的基线。那句"不受注意力窗口限制"这才有证据。
 *      ⚠️ 而在**完美周期**那条序列上两条线一样齐 —— 那条序列根本演不出这件事，屏幕上直说。
 */
import type { EngramState } from '@engine/kernels/engram.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function EngramStage({ state }: StageProps<EngramState>) {
  const {
    seq, seqName, ngram, window, stage, table, queryKey, prediction, matchCount,
    variants, hit, winHit, winPred, rows, row,
  } = state
  const showTable = stage !== 'id'
  const showPred = stage === 'predict' || stage === 'done'
  const lookedUp = stage === 'lookup' || showPred
  const done = stage === 'done'
  const gap = rows.reduce((a, x) => ((x.acc - x.winAcc) > (a.acc - a.winAcc) ? x : a), rows[0])
  return (
    <div className="card">
      <h3>Engram · n-gram 记忆 <span className="hint">用一张便宜的查表增强 Transformer</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{ngram}-gram</span><span className="scdl">记忆粒度（{seqName}）</span></div>
          <div className="scdk"><span className="scdn">{queryKey ? `「${queryKey}」` : '—'}</span><span className="scdl">查询前缀</span></div>
          <div className="scdk">
            <span className={`scdn hot ${lookedUp && !hit ? 'bad' : ''}`}>{showPred ? (hit ? prediction : 'miss') : '?'}</span>
            <span className="scdl">预测下一个{lookedUp && hit && variants > 1 ? `（⚠️ 跟过 ${variants} 种）` : ''}</span>
          </div>
          {/*  ⭐ 逐位置评测：命中率 / 歧义率 / 准确率 —— 不是只看最后一个位置 */}
          <div className="scdk">
            <span className={`scdn ${row.hitRate < 0.5 ? 'bad' : ''}`}>{(row.hitRate * 100).toFixed(0)}%</span>
            <span className="scdl">整条序列上的命中率（n={ngram}）</span>
          </div>
          <div className="scdk">
            <span className={`scdn ${row.ambRate > 0.2 ? 'bad' : ''}`}>{(row.ambRate * 100).toFixed(0)}%</span>
            <span className="scdl">命中里有歧义的比例</span>
          </div>
          <div className="scdk">
            <span className="scdn">{(row.acc * 100).toFixed(0)}% / {(row.winAcc * 100).toFixed(0)}%</span>
            <span className="scdl">预测准确率：查表 / 只看最近 {window} 个</span>
          </div>
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
            {stage === 'lookup' && (hit
              ? <span>取当前 {ngram - 1}-gram「{queryKey}」→ O(1) 查表<b>命中</b>（历史出现 {matchCount} 次
                {variants > 1 ? <>，⚠️ <b>但后面跟过 {variants} 种不同的 token（歧义）</b></> : '，后面都跟着同一个'}）</span>
              : <span>⚠️ 取「{queryKey}」去查 —— <b>miss</b>：这个前缀从来没出现过。<b>n 越大越容易 miss。</b></span>)}
            {showPred && (hit
              ? <span>表里「{queryKey}」→ <b>{prediction}</b>（×{matchCount}）→ 一次查表搞定，没动注意力</span>
              : <span>查不到，<b>这一位 Engram 给不出预测</b> —— 得交回给注意力</span>)}
          </div>
        </div>

        {done && <div className="orcap">{rich(state.log)}</div>}

        {/*  ⭐ 逐位置评测 + 窗口基线对照 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>n</span><span>命中率</span><span>命中里有歧义的</span><span>预测准确率</span>
              <span>只看最近 {window} 个（基线）</span>
            </div>
            {rows.map(x => (
              <div className={`qsrow ${x.n === ngram ? 'mcpick' : ''}`} key={x.n}>
                <span>n={x.n}{x.n === ngram ? ' ◀' : ''}</span>
                <span className={x.hitRate < 0.5 ? 'bad' : ''}>{(x.hitRate * 100).toFixed(0)}%</span>
                <span className={x.ambRate > 0.2 ? 'bad' : 'dimv'}>{(x.ambRate * 100).toFixed(0)}%</span>
                <span className={x.acc === Math.max(...rows.map(y => y.acc)) ? 'good' : ''}>{(x.acc * 100).toFixed(0)}%</span>
                <span className="dimv">{(x.winAcc * 100).toFixed(0)}%（命中 {(x.winHitRate * 100).toFixed(0)}%）</span>
              </div>
            ))}
            <div className="orcap">
              每个位置都<b>只拿"它之前"的历史</b>建表、预测、跟真实的下一个 token 比 ——
              <b>不是只看最后一个位置</b>（老版本就是只看那一个，而那个位置在完美周期序列上必然对）。
              <br />
              ⚠️ <b>n 越大越容易 miss、n 越小越容易歧义</b> —— 这是 n-gram 的老权衡，
              <b>老版本那条完美周期序列一点都看不出来</b>。
              <br />
              {gap.acc - gap.winAcc > 0.05
                ? <>⭐ <b>"不受注意力窗口限制"这句话，看最右那一列</b>：差得最多的是 n={gap.n}
                  （<b>{(gap.acc * 100).toFixed(0)}%</b> vs {(gap.winAcc * 100).toFixed(0)}%）——
                  <b>远处出现过的 n-gram，查表拿得到、窗口基线够不着</b>。</>
                : <>⚠️ <b>这一档两条线几乎一样齐</b> —— 因为这条序列的周期只有 4，而窗口有 {window} 个 token，
                  <b>该抄的东西就在窗口里，查表没占到便宜</b>。
                  <b>所以"不受窗口限制"这句话，在这条序列上根本演不出来</b> —— 这正是老版本的盲区，它用的就是这条序列。
                  <b>换成「带噪周期」或「自然一点的文本」再看。</b></>}
            </div>
          </div>
        )}

        {done
          ? <p className="scnote">
            <b>n-gram 记忆</b>：把出现过的 n-gram 统计存成一张「前缀 → 下一个」的表，推理时 <b>O(1) 查表</b>，
            直接拿到"上次/历次它后面跟了什么"。<b>不受注意力窗口限制</b>（只要那个 n-gram 出现过就查得到），
            把"精确复制重复模式"从昂贵的注意力<b>卸载</b>到便宜的查表上。
            <br />
            <b>而这一屏也让你看清它便宜在哪、又贵在哪。</b>
            老版本用的是一条<b>完美周期</b>序列、n 写死 3 —— 查表必然命中、预测必然对，
            <b>一次失败都演不出来</b>。可 n-gram 最经典的那对毛病恰恰是：
            <b>表会 miss</b>（前缀没见过）、<b>表会歧义</b>（同一个前缀后面跟过好几种）。
            而且这对毛病是<b>此消彼长</b>的：n 越大越准但越容易 miss，n 越小越总能命中但越容易歧义。
            <br />
            <b>它只会"照抄见过的"</b> —— 一旦 miss 或歧义，就得把活交回给注意力。
            它和<b>归纳头</b>目标像（都在回头找"上次它之后是什么"），但机制相反：
            归纳头是<b>学出来的软注意力</b>、贵；Engram 是<b>显式非参数化查表</b>、便宜。
            <b>这才是"二者互补"那句话的意思 —— 不是客套话，是分工。</b>
          </p>
          : <p className="scnote" style={{ opacity: .85 }}>{stage === 'id' ? 'Engram 的思路：把出现过的 n-gram 统计存成表，推理时直接查"上次它后面跟了什么"。' : stage === 'build' ? '每个前缀记下它后面跟过的 token 及次数。这张表查一次是常数时间，和上下文多长无关。' : '命中的这一行，就是"上次/历次这个前缀之后跟的 token"——直接复制过来当预测。'}</p>}
      </div>
    </div>
  )
}
