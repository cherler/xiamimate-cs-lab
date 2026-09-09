/**
 * 舞台：完整前向拼装 —— 输入序列 → 10 段流水 → 预测下一个 token；每段真实向量。
 *
 * 2026-09-09 补厚。前向本身是真算的，但**只跑了一次、只有贪心**，
 * 而正文写着「→ softmax → **采样**」「这就是每次 **decode** 真正跑的链 ——
 * **KV 缓存** / Flash / 量化，优化的都是它」—— 采样没做过、decode 只跑了一步、优化一个没演。
 *
 * 这一屏末尾加了三块：
 *   ① **连续 decode 4 步**（把预测出来的 token 接回去再跑）—— **这才叫 decode**。
 *   ② ⭐ **KV 缓存对照**：不用缓存 vs 用缓存，乘加次数差一截，而**输出必须逐位相同** ——
 *      「优化的都是这条链」这才有了实例。
 *   ③ **解码方式对照**：贪心 / T=0.7 / T=1.5。⚠️ 单个种子说明不了温度有没有用
 *      （T=0.7 和 T=1.5 在这个种子上碰巧抽出同一条），所以另抽 200 个种子量"跟贪心不一样"的比例。
 */
import type { ForwardState } from '@engine/kernels/forward.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const STAGES = ['① 词嵌入', '② RMSNorm', '③ 自注意力', '④ 残差', '⑤ RMSNorm', '⑥ FFN', '⑦ 残差', '⑧ 末层 RMSNorm', '⑨ LM 头', '⑩ softmax→采样']

export function ForwardStage({ state }: StageProps<ForwardState>) {
  const {
    seq, vocab, stageIdx, stageName, stageLink, vec, attn, logits, probs, predicted, detail, phase,
    cacheName, decodeName, gen, genText, macWith, macWithout, sameOut, sameLogits, decodeCmp,
  } = state
  const done = phase === 'done'
  const saved = macWithout - macWith
  const bestIdx = probs ? probs.reduce((bi, p, i, a) => (p > a[bi] ? i : bi), 0) : -1
  return (
    <div className="card">
      <h3>完整前向拼装 <span className="hint">一次真实推理 · 把学过的零件串起来</span></h3>
      <div className="body">
        {/* 顶部：序列 → 预测 */}
        <div className="fwhdr">
          <div className="fwseq">{seq.map((t, k) => <span key={k} className="fwtok">{t}</span>)}</div>
          <span className="fwarrow">→</span>
          <span className={`fwpred ${done || predicted ? 'on' : ''}`}>{predicted ?? '？'}</span>
          {(done || predicted) && probs && <span className="fwprob">{Math.round(probs[bestIdx] * 100)}%</span>}
        </div>

        {/* 流水段进度 */}
        <div className="fwflow">
          {STAGES.map((nm, k) => (
            <span key={k} className={`fwstep ${k === stageIdx ? 'cur' : k < stageIdx || done ? 'done' : ''}`}>{nm}</span>
          ))}
        </div>

        {/* 当前段详情 */}
        <div className="fwdetail">
          <div className="fwdh">
            <span className="fwdn">{done ? '✓ 前向完成' : stageName}</span>
            {stageLink && stageLink !== '—' && <span className="fwlink">↳ {stageLink}</span>}
          </div>

          {/* 向量 */}
          {vec.length > 0 && (
            <div className="fwvec">
              <span className="fwvl">向量</span>
              {vec.map((v, k) => <span key={k} className="fwvc">{v.toFixed(2)}</span>)}
            </div>
          )}

          {/* 注意力权重 */}
          {attn && (
            <div className="fwsub">
              <span className="fwvl">注意力权重</span>
              {attn.map((w, k) => (
                <div key={k} className="fwbar"><span className="fwbl">看 {seq[k]}</span><div className="fwtrack"><div className="fwfill" style={{ width: `${w * 100}%` }}>{Math.round(w * 100)}%</div></div></div>
              ))}
            </div>
          )}

          {/* logits / 概率 */}
          {(logits || probs) && (
            <div className="fwsub">
              <span className="fwvl">{probs ? '词表概率' : 'logits（每个词的打分）'}</span>
              {vocab.map((t, k) => {
                const val = probs ? probs[k] : 0
                const lg = logits ? logits[k] : 0
                return (
                  <div key={k} className={`fwbar ${k === bestIdx && probs ? 'win' : ''}`}>
                    <span className="fwbl">{t}</span>
                    <div className="fwtrack">
                      {probs
                        ? <div className="fwfill p" style={{ width: `${val * 100}%` }}>{Math.round(val * 100)}%</div>
                        : <div className="fwfill l" style={{ width: `${Math.max(4, (lg + 1) / 3 * 100)}%` }}>{lg.toFixed(2)}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {detail && !done && <p className="fwtext">{detail}</p>}
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>

        {/*  ⭐ ① 连续 decode + ② KV 缓存对照 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>decode 第几步</span><span>生成的 token</span><span>这一步的乘加次数</span><span></span><span></span>
            </div>
            {gen.map(g => (
              <div className="qsrow" key={g.step}>
                <span>第 {g.step} 步</span>
                <span className="good">「{g.token}」</span>
                <span className="dimv">{g.mac}</span>
                <span /><span />
              </div>
            ))}
            <div className="qsrow mcpick">
              <span>合计</span>
              <span className="good">「{genText}」</span>
              <span>{cacheName.startsWith('用') ? macWith : macWithout}</span>
              <span style={{ textAlign: 'left', gridColumn: 'span 2' }}>
                用缓存 {macWith} vs 不用 {macWithout} —— 省 {saved}（{((saved / macWithout) * 100).toFixed(0)}%）
              </span>
            </div>
            <div className="orcap">
              ⚠️ <b>一步不叫 decode。</b>老版本到"预测下一个 token"就收了 ——
              而正文写着"这就是推理引擎<b>每次 decode</b> 真正跑的那条链"。
              <br />
              ⭐ <b>KV 缓存是这条链上唯一"能省"的地方</b>：不用缓存每步要把<b>全部</b>位置的 K/V 重算一遍，
              用缓存只算<b>新来的那一个</b>。
              <b>而"优化"的前提是输出不能变</b> —— 两条路生成的文本
              {sameOut ? <> <b>都是「{genText}」，一样 ✓</b></> : <> ⚠️ <b>不一样</b></>}，
              每一步的 logits {sameLogits ? <b>逐位相同 ✓</b> : <b className="bad">对不上 ✗</b>}。
              <b>同一个答案、更少的算量 —— 这才叫优化，不是"换了个算法"。</b>
              <br />
              （这里序列才 {seq.length}+{gen.length} 个 token，只省 {((saved / macWithout) * 100).toFixed(0)}%；
              真实推理里上下文动辄几千几万 token，<b>每步重算全部 K/V 是完全不可行的</b> ——
              <b>KV 缓存不是优化，是前提</b>。）
            </div>
          </div>
        )}

        {/*  ⭐ ③ 解码方式对照 —— 单个种子说明不了温度有没有用 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>解码方式</span><span>这一个种子生成的</span><span>抽 200 个种子：跟贪心不一样的比例</span><span></span><span></span>
            </div>
            {decodeCmp.map(x => (
              <div className={`qsrow ${x.name === decodeName ? 'mcpick' : ''}`} key={x.name}>
                <span>{x.name}{x.name === decodeName ? ' ◀' : ''}</span>
                <span className="dimv">「{x.text}」</span>
                <span className={x.differ > 0.5 ? 'bad' : ''}>{(x.differ * 100).toFixed(0)}%</span>
                <span /><span />
              </div>
            ))}
            <div className="orcap">
              ⭐ <b>"采样"那句话兑现了</b>：老版本代码里是 <code>bestIdx</code>、<b>只有贪心</b>，
              而正文写着"softmax → <b>采样</b>"、还链到「采样解码」那一屏。
              <br />
              ⚠️ <b>注意 T=0.7 和 T=1.5 在这一个种子上碰巧抽出了同一条</b> ——
              <b>单个种子说明不了温度有没有用</b>，得看右边那一列：
              贪心 <b>{(decodeCmp[0].differ * 100).toFixed(0)}%</b>（定义上就是 0）、
              T=0.7 <b>{(decodeCmp[1].differ * 100).toFixed(0)}%</b>、
              T=1.5 <b>{(decodeCmp[2].differ * 100).toFixed(0)}%</b> —— <b>温度越高，跑偏得越多</b>。
            </div>
          </div>
        )}

        {done && (
          <p className="scnote">
            这就是<b>推理引擎每一步 decode 真正跑的那条链</b>：
            embed → RMSNorm → 自注意力 → 残差 → RMSNorm → FFN → 残差 → 末层 RMSNorm → LM 头 → softmax → 采样。
            每一段都对应前面一个实验。
            <br />
            <b>而这一屏补上的是"然后呢"。</b>老版本只跑了一步、只有贪心，
            于是"每次 decode"和"采样"这两句都停在字面上。
            现在连续跑了 {gen.length} 步、三种解码并排，
            <b>KV 缓存也真的对照了一遍</b>：<b>{macWithout} → {macWith} 次乘加，而输出逐位相同</b>。
            <br />
            <b>「KV 缓存、FlashAttention、量化、连续批处理，优化的都是这条链」</b> ——
            这句话现在有了一个可以自己验的实例：<b>省算量而不改答案</b>。
            一旦答案变了，那就不是优化，是换了个模型。
          </p>
        )}
      </div>
    </div>
  )
}
