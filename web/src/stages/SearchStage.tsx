/** 舞台：mini 搜索引擎 —— 倒排索引一屏建起来，查询走 TF-IDF 打分排序 */
import type { SearchState } from '@engine/kernels/minisearch.ts'
import type { StageProps } from '../types.ts'

const r2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2)

export function SearchStage({ state }: StageProps<SearchState>) {
  const { stage, focus, reading, indexed, index, query, candidates, idf, scores, phase } = state
  const done = phase === 'done'
  const maxScore = Math.max(1e-9, ...scores.map(s => s.score))
  const DOCTEXT: Record<string, string> = { D1: '猫 爱 吃 鱼', D2: '狗 爱 吃 肉', D3: '猫 猫 玩 鱼' }

  return (
    <div className="card">
      <h3>mini 搜索引擎 <span className="hint">倒排索引 + TF-IDF 打分</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{stage.replace(/^[①②③④⑤⑥⑦]\s*/, '') || '就绪'}</span><span className="scdl">当前阶段</span></div>
          <div className="scdk"><span className="scdn">{query.length ? `候选 ${candidates.length}` : `索引 ${index.length} 词`}</span><span className="scdl">{query.length ? '命中文档' : '倒排规模'}</span></div>
          <div className="scdk"><span className={`scdn ${done ? 'ok' : ''}`}>{scores.length ? scores[0].id : '—'}</span><span className="scdl">最相关</span></div>
        </div>

        <div className="ms-grid">
          {/* 左：语料 + 倒排索引 */}
          <section className="ms-col">
            <div className="ms-cap">语料库</div>
            <div className="ms-docs">
              {(['D1', 'D2', 'D3']).map(id => (
                <span key={id} className={`ms-doc ${reading === id ? 'reading' : ''} ${indexed.includes(id) ? 'in' : ''} ${scores[0]?.id === id && done ? 'top' : ''}`}>
                  <b>{id}</b> {DOCTEXT[id]}
                </span>
              ))}
            </div>
            <div className="ms-cap">倒排索引 <em>词 → 出现在哪些文档(×词频)</em></div>
            <div className="ms-index">
              {index.length ? index.map(e => (
                <div key={e.term} className={`ms-row ${query.includes(e.term) ? 'q' : ''}`}>
                  <span className="ms-term">{e.term}</span>
                  <span className="ms-arrow">→</span>
                  <span className="ms-posts">
                    {e.postings.map(([d, tf]) => (
                      <span key={d} className={`ms-post ${tf > 1 ? 'multi' : ''}`}>{d}<i>×{tf}</i></span>
                    ))}
                    <span className="ms-df">df={e.postings.length}</span>
                  </span>
                </div>
              )) : <span className="kv-empty">空 —— 逐篇读入后长出来</span>}
            </div>
          </section>

          {/* 右：查询 → idf → 打分排序 */}
          <section className="ms-col">
            <div className="ms-cap">查询</div>
            <div className="ms-query">{query.length ? query.map(t => <span key={t} className="ms-qterm">{t}</span>) : <span className="kv-empty">待接收</span>}</div>

            {idf.length > 0 && (
              <>
                <div className="ms-cap">idf = ln(N/df) <em>稀有词权重更高</em></div>
                <div className="ms-idf">
                  {idf.map(r => (
                    <div key={r.term} className="ms-idfrow">
                      <span className="ms-term sm">{r.term}</span>
                      <span className="ms-idfexpr">ln(3/{r.df})</span>
                      <span className={`ms-idfval ${r.df === 1 ? 'rare' : ''}`}>{r2(r.idf)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {scores.length > 0 && (
              <>
                <div className="ms-cap">TF-IDF 打分 <em>score = Σ tf × idf</em></div>
                <div className="ms-scores">
                  {scores.map((s, i) => (
                    <div key={s.id} className={`ms-score ${done && i === 0 ? 'win' : ''}`}>
                      <span className="ms-srank">{done ? `#${i + 1}` : ''}</span>
                      <span className="ms-sid">{s.id}</span>
                      <span className="ms-sbar"><i style={{ width: `${(s.score / maxScore) * 100}%` }} /></span>
                      <span className="ms-sval">{r2(s.score)}</span>
                      <span className="ms-sparts">{s.parts}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        {done
          ? <p className="scnote"><b>D2 排第一</b>——它只含一个查询词"狗"，但"狗"稀有(idf 高)，稀有词命中更相关；<b>D3 排在 D1 前</b>——都含"猫"，但"猫"在 D3 出现两次(tf=2)，词频高更相关。<b>面试讲这个项目</b>：倒排索引让查询不扫全库；TF-IDF 用「词频高更相关 + 稀有词更值钱」两条直觉打分。真实引擎(Lucene/ES)在此之上加 BM25、字段权重、向量召回。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。逐篇读入建倒排索引 → 收到查询查倒排取候选 → 算 idf → TF-IDF 打分 → 按分排序返回。</p>}
      </div>
    </div>
  )
}
