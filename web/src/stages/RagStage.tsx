/** 舞台：RAG —— 问题变向量，在知识库按相似度检索 top-k，拼进上下文，模型据此作答 */
import type { RagState } from '@engine/kernels/rag.ts'
import type { StageProps } from '../types.ts'

export function RagStage({ state }: StageProps<RagState>) {
  const { query, docs, stage, topK, retrieved, answer, phase,
    hit, hasAnswerInKb, hallucinated, answerRank } = state
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
          <div className="scdk"><span className="scdn">{showRetr ? retrieved.length : '—'}</span><span className="scdl">检索到几篇</span></div>
          {/*  这一栏才是关键：检索**永远有输出**，问题是里面有没有能回答的那篇 */}
          {showRetr && <div className="scdk"><span className={`scdn ${hit ? 'hot' : ''}`}>{hit ? '有' : '没有'}</span>
            <span className="scdl">里面有能答的吗</span></div>}
          {showRetr && <div className="scdk"><span className="scdn">{answerRank > 0 ? `第 ${answerRank}` : '库里没有'}</span>
            <span className="scdl">含答案那篇排第几</span></div>}
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
              {done && (hallucinated
                ? <div className="raganswer bad">⚠️ 据此作答：<b>{answer}</b> —— <b>这是编的</b>：
                  检索到的 {topK} 篇里没有一篇能回答这个问题</div>
                : hit
                  ? <div className="raganswer">✓ 据此作答：<b>{answer}</b>（有出处，来自检索到的那篇）</div>
                  : <div className="raganswer">— 模型老实交代：<b>{answer}</b></div>)}
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
          ? (hit
            ? <p className="scnote">RAG 给模型外挂"开卷考试"：问题编码成查询向量 → 按<b>相似度检索</b> top-k
              （这一步就是<b>向量最近邻</b>）→ 拼进上下文<b>增强</b> → 模型<b>据此生成</b>。
              这一档答对了，答案<b>有出处</b>。
              　⚠️ 但它的上限<b>全卡在检索这一步</b>：把「问题」换成另外两档看看会怎样。</p>
            : hallucinated
              ? <p className="scnote"><b>这是 RAG 最典型的失败。</b>检索到的 {topK} 篇里<b>没有一篇能回答这个问题</b>，
                模型却照着最像的那篇给了个肯定答案 —— <b>错得理直气壮，而且还带着"出处"</b>。
                　根子在检索：<b>检索永远有输出，它不会说"我没有"，只会给你最像的。</b>
                {hasAnswerInKb
                  ? <>　这一档的答案<b>其实在库里</b>（排第 {answerRank}），只是被 top-{topK} 挡在外面 ——
                    <b>把 k 调大就能救</b>。真实系统里的重排序、切块、混合检索，救的都是这一步。</>
                  : <>　这一档的答案<b>根本不在库里</b> —— 调 k 也没用，得先把资料补上。
                    <b>RAG 不能凭空变出知识，它只能把已有的资料递给模型。</b></>}</p>
              : <p className="scnote">检索到的 {topK} 篇里没有能回答这个问题的，模型<b>没硬答</b>。这是对的行为 ——
                但注意：<b>能不能做到这一点，取决于模型的脾气和提示词，不取决于 RAG 本身</b>。
                　把「模型脾气」拨到<b>爱编</b>，同样的检索结果会得出一个理直气壮的错答案。
                {hasAnswerInKb && <>　另外这一档的答案其实在库里（排第 {answerRank}），<b>把 k 调大就能捞回来</b>。</>}</p>)
          : <p className="scnote" style={{ opacity: .85 }}>三步：①<b>检索</b> —— 问题变向量，和库里每篇比相似度（点积），取 top-k；
            ②<b>增强</b> —— 拼进提示词当上下文；③<b>生成</b> —— 模型带着资料作答。
            相似度条越长越相关，绿=被检索。
            　⚠️ 盯住一件事：<b>相似度排的是"像不像"，不是"有没有答案"</b> —— 这两件事马上就要分家。</p>}
      </div>
    </div>
  )
}
