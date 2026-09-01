/** 舞台：记忆检索打分 —— 记忆表逐列算出(最近/重要/相关→得分)，排序后 top-k 高亮捞回 */
import type { MRState, Scored } from '@engine/kernels/memretrieve.ts'
import type { StageProps } from '../types.ts'

export function MemRetrieveStage({ state }: StageProps<MRState>) {
  const { stage, weights, wr, wl, wi, query, topK, mems } = state
  const showSig = stage !== 'intro'
  const showScore = stage === 'score' || stage === 'rank' || stage === 'done'
  const ranked = stage === 'rank' || stage === 'done'

  return (
    <div className="card">
      <h3>记忆检索打分 <span className="hint">查询来了，从记忆流里按 最近×重要×相关 打分、捞 top-{topK}</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{weights}</span><span className="scdl">权重设置</span></div>
          <div className="scdk"><span className="scdn">top-{topK}</span><span className="scdl">捞回条数</span></div>
          <div className="scdk"><span className="scdn">{mems.filter(m => m.retrieved && ranked).length}</span><span className="scdl">已捞回</span></div>
        </div>

        <div className="mr-q">🔍 查询：<b>{query}</b></div>
        <div className={`mr-formula ${showScore ? 'on' : ''}`}>
          得分 = <b>{wr}</b>·最近度 + <b>{wl}</b>·相关度 + <b>{wi}</b>·重要度
        </div>

        <div className="mr-tablewrap">
          <table className="mr-table">
            <thead>
              <tr>
                <th className="l">记忆{ranked ? '（按得分排序）' : ''}</th>
                <th>龄</th>
                <th className={showSig ? '' : 'off'}>最近度</th>
                <th className={showSig ? '' : 'off'}>重要度</th>
                <th className={showSig ? '' : 'off'}>相关度</th>
                <th className={showScore ? 'hot' : 'off'}>得分</th>
              </tr>
            </thead>
            <tbody>
              {mems.map((m: Scored) => (
                <tr key={m.id} className={ranked ? (m.retrieved ? 'in' : 'out') : ''}>
                  <td className="l">
                    {ranked && <span className="mr-rk">{m.retrieved ? `✓${m.rank}` : m.rank}</span>}
                    {m.text}
                  </td>
                  <td>{m.ageH}h</td>
                  <td>{showSig ? m.recency.toFixed(2) : '—'}</td>
                  <td>{showSig ? <>{m.imp01.toFixed(1)}<em className="mr-raw"> ({m.importance})</em></> : '—'}</td>
                  <td>{showSig ? m.rel01.toFixed(2) : '—'}</td>
                  <td className={showScore ? 'hot' : ''}>{showScore ? <b>{m.score.toFixed(2)}</b> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {stage === 'done'
          ? <p className="scnote"><b>捞回上下文：{mems.filter(m => m.retrieved).map(m => m.text).join(' / ')}</b>。检索=最近度(decay^龄)+重要度(LLM 1~10)+相关度(余弦)加权排序取 top-{topK}——<b>不是关键词匹配</b>。权重翻则排名翻：论文等权、Generative Agents 代码是 0.5·3·2(相关最重)——切「权重」看 m3「VIP」进/出。GA 实际还会把三列各自 min-max 归一化再加权(这里为看清用原值)。延伸：向量/BM25/混合+rerank、检索不准会污染上下文。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。{stage === 'signals' && '注意三个信号各说各话——有的很新但不相关、有的很重要但不相关。'}{stage === 'rank' && '换「权重」参数，捞回的这几条会变。'}</p>}
      </div>
    </div>
  )
}
