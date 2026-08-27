/** 舞台：RAG —— 问题变向量，在知识库按相似度检索 top-k，拼进上下文，模型据此作答 */
import type { RagState } from '@engine/kernels/rag.ts'
import type { StageProps } from '../types.ts'

export function RagStage({ state }: StageProps<RagState>) {
  const { query, docs, stage, topK, retrieved, answer, phase } = state
  const done = phase === 'done'
  const scored = stage === 'score' || stage === 'retrieve' || stage === 'augment' || done
  const showRetr = stage === 'retrieve' || stage === 'augment' || done
  const showAug = stage === 'augment' || done
  const retSet = new Set(retrieved)
  const maxSim = Math.max(...docs.map(d => d.sim ?? 0), 0.001)
  return (
    <div className="card">
      <h3>RAG 检索增强生成 <span className="hint">先按相似度检索资料塞进上下文，再据此作答</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{docs.length} 篇</span><span className="scdl">知识库</span></div>
          <div className="scdk"><span className="scdn">top-{topK}</span><span className="scdl">检索数</span></div>
          <div className="scdk"><span className="scdn">{showRetr ? retrieved.length : '—'}</span><span className="scdl">已命中</span></div>
        </div>

        <div className="ragwrap">
          <div className="ragq">🔎 问题：<b>{query}</b>{scored && <span className="ragqv"> → 查询向量</span>}</div>

          <div className="raglib">
            {docs.map((d, k) => {
              const hit = showRetr && retSet.has(k)
              const dim = showRetr && !hit
              return (
                <div key={k} className={`ragdoc ${hit ? 'hit' : ''} ${dim ? 'dim' : ''}`}>
                  <span className="ragtext">{d.t}</span>
                  {scored && d.sim !== null && (
                    <span className="ragbar"><span className="ragbarfill" style={{ width: `${(d.sim / maxSim) * 100}%` }} /></span>
                  )}
                  <span className="ragsim">{d.sim === null ? '' : d.sim}</span>
                  <span className="ragtag">{hit ? '✓检索' : dim ? '略' : ''}</span>
                </div>
              )
            })}
          </div>

          {showAug && (
            <div className="ragaug">
              <div className="ragauglbl">增强的提示词（检索到的 {topK} 篇当上下文）：</div>
              <div className="ragprompt">
                <span className="ragctx">已知：{retrieved.map(i => docs[i].t).join('；')}。</span>
                <span className="ragask">问：{query}</span>
              </div>
              {done && <div className="raganswer">✓ 据此作答：<b>{answer}</b>（有出处，来自检索到的两篇）</div>}
            </div>
          )}

          <div className="orcap">
            {stage === '' ? '按「下一步」开始:RAG 不直接答,先去知识库找相关资料'
              : stage === 'query' ? '手头一个知识库(5 篇);把问题编码成查询向量,准备检索'
                : stage === 'score' ? '问题 vs 每篇文档算相似度(点积):讲"猫吃"的最高、无关的接近 0'
                  : stage === 'retrieve' ? `检索 top-${topK}:取最相关的 ${topK} 篇(绿),无关的丢掉——这就是向量最近邻`
                    : stage === 'augment' ? '把检索到的 2 篇拼进提示词当上下文,模型开卷作答'
                      : `据此作答:「${answer}」——答案有出处、不靠瞎记`}
          </div>
        </div>

        {done
          ? <p className="scnote">大模型的知识冻结在参数里:会过时、记不住私有资料、爱<b>编造(幻觉)</b>。RAG 给它外挂"开卷考试":把问题编码成查询向量→在知识库按<b>相似度检索</b>最相关的 top-k(这一步就是<b>向量最近邻</b>,和词向量/k-NN 同源)→拼进上下文<b>增强</b>→模型<b>据此生成</b>。于是答案<b>有据可查、可溯源、随库更新、少幻觉</b>,不用重训模型。是问答、客服、企业搜索的主流范式;检索质量决定上限,常配重排序、切块等。</p>
          : <p className="scnote" style={{ opacity: .85 }}>三步:①<b>检索</b>——问题变向量,和库里每篇比相似度(点积/余弦),取最相关的 top-k;②<b>增强</b>——把它们拼进提示词当上下文;③<b>生成</b>——模型带着资料作答。相似度条越长越相关,绿=被检索。无关的(汽车、植物)相似度接近 0、落选。</p>}
      </div>
    </div>
  )
}
