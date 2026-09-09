/**
 * 舞台：词向量 —— 数共现 → PPMI → 降维 → 做类比。
 *
 * 2026-09-09 补厚。老版本把词**手摆在平面上**（国王(1,0)、男人(0,0)、女人(0,1)、王后(1,1)），
 * 于是"国王−男人+女人=王后、距离 0"当然成立 —— **那不是学出来的，是摆出来的**。
 *
 * 这一屏的三个落点：
 *   ① **坐标是学出来的**：屏幕上先摆共现计数和 PPMI，向量从那儿降维来。
 *      散点图的横纵轴不再是"王室度/性别"这种我编的名字，而是**前两个特征方向**。
 *   ② **两种口径并排**：排除输入词 / 不排除。不排除的话最近邻常常就是「国王」自己 ——
 *      这是词类比评测里一个几乎没人提、却决定这个著名例子有多硬的细节。
 *   ③ ⭐ **"成立"和"分得开"是两件事**：少语料 / 低维那几档，前三名相似度**全是 1.000**，
 *      "最近邻是王后"只是排序碰巧。**差距那一栏才是真正该看的。**
 */
import type { WordVecState } from '@engine/kernels/wordvec.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function WordVecStage({ state }: StageProps<WordVecState>) {
  const {
    words, stage, a, b, c, expected, resultXY, ranked, rankedKeep, nearest, nearestKeep,
    ok, okKeep, margin, sweep, coRows, sents, tokens, window, vocab, corpusName, dim, phase,
  } = state
  const done = phase === 'done'
  const showPlot = stage === 'embed' || stage === 'analogy' || done
  const showRes = stage === 'analogy' || done

  //  散点范围跟着学出来的向量走 —— 不再是写死的 [-1.25, 1.4]
  const xs = words.map(w => w.xy[0]).concat(showRes ? [resultXY[0]] : [])
  const ys = words.map(w => w.xy[1]).concat(showRes ? [resultXY[1]] : [])
  const pad = 0.15
  const xlo = Math.min(...xs) - pad, xhi = Math.max(...xs) + pad
  const ylo = Math.min(...ys) - pad, yhi = Math.max(...ys) + pad
  const px = (x: number) => ((x - xlo) / (xhi - xlo || 1)) * 100
  const py = (y: number) => 100 - ((y - ylo) / (yhi - ylo || 1)) * 100
  const at = (n: string) => words.find(w => w.name === n)?.xy ?? [0, 0]

  const row = (list: typeof ranked, n = 5) => list.slice(0, n)

  return (
    <div className="card">
      <h3>词向量 Word2Vec <span className="hint">从共现里学出来的位置——而不是我摆上去的</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk">
            <span className="scdn hot">{a}−{b}+{c}</span>
            <span className="scdl">要算的类比（期望 {expected}）</span>
          </div>
          <div className="scdk">
            <span className="scdn">{sents} 句 / {tokens} 词</span>
            <span className="scdl">语料（{corpusName}）· 词表 {vocab.length}</span>
          </div>
          {/*  ⭐ 排除输入词之后的答案 —— 标准做法 */}
          <div className="scdk">
            <span className={`scdn ${done ? (ok ? 'good' : 'bad') : ''}`}>{done ? nearest : '?'}</span>
            <span className="scdl">最近的词（排除输入词）</span>
          </div>
          {/*  ⭐ 不排除的话往往就是输入词自己 */}
          <div className="scdk">
            <span className={`scdn ${done && nearestKeep !== nearest ? 'bad' : ''}`}>{done ? nearestKeep : '?'}</span>
            <span className="scdl">不排除输入词的话</span>
          </div>
          {/*  ⭐ "成立"和"分得开"是两件事 */}
          <div className="scdk">
            <span className={`scdn ${done ? (margin < 0.02 ? 'bad' : 'good') : ''}`}>{done ? margin : '—'}</span>
            <span className="scdl">跟第二名差多少{done && margin < 0.02 ? '（分不开！）' : ''}</span>
          </div>
        </div>

        {/*  ⭐ 共现 + PPMI：向量的来源摆在屏幕上 */}
        {(stage === 'count' || stage === 'ppmi') && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>{stage === 'ppmi' ? 'PPMI' : '共现次数'}</span>
              {coRows[0].cells.map(c2 => <span key={c2.ctx}>{c2.ctx}</span>)}
            </div>
            {coRows.map(r => (
              <div className="qsrow wvco" key={r.word}>
                <span>{r.word}</span>
                {r.cells.map(c2 => (
                  <span key={c2.ctx} className={(stage === 'ppmi' ? c2.ppmi : c2.n) > 0 ? 'good' : 'dimv'}>
                    {stage === 'ppmi' ? c2.ppmi : c2.n}
                  </span>
                ))}
              </div>
            ))}
            <div className="orcap">
              {stage === 'count'
                ? <>窗口 ±{window} 个词。<b>分布假设</b>就是这一步的全部依据：<b>出现在相似上下文里的词，意思也相近</b>。
                  注意「{a}」跟「他」、「{expected}」跟「她」的差别 —— <b>性别方向就藏在这一列里</b>。</>
                : <><b>PPMI = max(0, log( p(a,b) / (p(a)·p(b)) ))</b>：共现得比随机撞上更频繁才算信息。
                  这一步把「在」「很」这类到处都出现的词<b>自动压掉</b>，只留下真正有指向的搭配。</>}
            </div>
          </div>
        )}

        {/*  散点：坐标是学出来的，不是摆出来的 */}
        {showPlot && (
          <div className="mlwrap">
            <div className="wvplotbox">
              <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
                {showRes && (
                  <>
                    <line x1={px(at(b)[0])} y1={py(at(b)[1])} x2={px(at(a)[0])} y2={py(at(a)[1])}
                      className="wvarrow" vectorEffect="non-scaling-stroke" />
                    <line x1={px(at(c)[0])} y1={py(at(c)[1])} x2={px(resultXY[0])} y2={py(resultXY[1])}
                      className="wvarrow" vectorEffect="non-scaling-stroke" />
                    <circle cx={px(resultXY[0])} cy={py(resultXY[1])} r="2.4" className="wvres" />
                  </>
                )}
                {words.map(w => {
                  const isIn = w.name === a || w.name === b || w.name === c
                  const isAns = done && w.name === nearest
                  return (
                    <g key={w.name}>
                      <circle cx={px(w.xy[0])} cy={py(w.xy[1])} r={isAns ? 2.6 : 1.8}
                        className={`wvdot ${isIn ? 'in' : ''} ${isAns ? 'ans' : ''}`} />
                      <text x={px(w.xy[0])} y={py(w.xy[1]) - 3.5} className={`wvlbl ${isIn ? 'in' : ''} ${isAns ? 'ans' : ''}`}
                        textAnchor="middle">{w.name}</text>
                    </g>
                  )
                })}
              </svg>
            </div>
            <div className="orcap">
              画的是学出来的向量的<b>前两个方向</b>（一共 {dim} 维）——
              <b>横纵轴没有名字</b>，它不是我编的"王室度/性别"，是 PPMI 矩阵最大的两个特征方向。
              ✕ = {a}−{b}+{c} 的结果。
            </div>
          </div>
        )}

        <div className="orcap">{rich(state.log)}</div>

        {/*  ⭐ 两种口径并排 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>口径</span><span>第 1</span><span>第 2</span><span>第 3</span><span>结论</span>
            </div>
            <div className="qsrow mcpick">
              <span>排除输入词</span>
              {row(ranked, 3).map(x => <span key={x.name} className={x.name === expected ? 'good' : 'dimv'}>{x.name} {x.sim}</span>)}
              <span className={ok ? 'good' : 'bad'}>{ok ? '成立 ✓' : '没成立 ✗'}</span>
            </div>
            <div className="qsrow">
              <span>不排除</span>
              {row(rankedKeep, 3).map(x => (
                <span key={x.name} className={x.isInput ? 'bad' : x.name === expected ? 'good' : 'dimv'}>
                  {x.name}{x.isInput ? '(输入)' : ''} {x.sim}
                </span>
              ))}
              <span className={okKeep ? 'good' : 'bad'}>{okKeep ? '成立 ✓' : '没成立 ✗'}</span>
            </div>
            <div className="orcap">
              {nearestKeep !== nearest
                ? <>⭐ <b>不排除输入词的话，最近的居然是「{nearestKeep}」自己。</b>
                  这不是 bug —— a−b+c 这个向量离 a 和 c 本来就很近（毕竟只挪了一小步），
                  所以标准评测都要<b>把 a、b、c 三个输入词排除掉</b>再取最近邻。
                  <b>「{a}−{b}+{c}={expected}」这个著名例子有多硬，很大程度上取决于这一步。</b>（Linzen 2016 专门写过。）</>
                : <>这一档两种口径答案一样 —— 输入词没有挡路。
                  <b>换个语料/维度档再看</b>，很多档下不排除输入词的话，最近的就是「{a}」自己。</>}
            </div>
          </div>
        )}

        {/*  ⭐ 语料 × 维度扫描：成立 vs 分得开 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>语料 / 维度</span>{[2, 4, 8].map(d => <span key={d}>{d} 维</span>)}<span></span>
            </div>
            {[...new Set(sweep.map(x => x.corpus))].map(cn => (
              <div className={`qsrow ${cn === corpusName ? 'mcpick' : ''}`} key={cn}>
                <span>{cn}</span>
                {[2, 4, 8].map(d => {
                  const x = sweep.find(y => y.corpus === cn && y.dim === d)!
                  const solid = x.ok && x.margin >= 0.02
                  return (
                    <span key={d} className={solid ? 'good' : x.ok ? 'bad' : 'dimv'}>
                      {x.nearest}{x.ok ? '✓' : '✗'}<span className="dimv"> 差{x.margin}</span>
                      {x.ok && x.margin < 0.02 ? '⚠️' : ''}
                    </span>
                  )
                })}
                <span />
              </div>
            ))}
            <div className="orcap">
              ⚠️ <b>"最近邻是「{expected}」"和"真的分得开"是两件事。</b>
              打 ⚠️ 的那几档，第一名和第二名的余弦相似度<b>差不多是 0</b> ——
              也就是说 {expected}、王子、公主<b>挤成一团分不开</b>，"最近邻是 {expected}"只是排序碰巧。
              <b>只看"排第一"会把这种情况判成成功。</b>
              <br />
              {sweep.length} 档里 <b>{sweep.filter(x => x.ok).length}</b> 档最近邻是「{expected}」，
              可其中 <b>{sweep.filter(x => x.ok && x.margin < 0.02).length}</b> 档是"分不开"的假成立 ——
              真正<b>又对又分得开</b>的只有 <b>{sweep.filter(x => x.ok && x.margin >= 0.02).length}</b> 档。
            </div>
          </div>
        )}

        <p className="scnote">
          词向量把"意思"变成<b>位置</b>、把"语义关系"变成<b>方向</b>。它靠<b>分布假设</b>学出来：
          出现在相似上下文里的词（"猫"和"狗"都常跟"宠物""喂食"共现），向量就相近。
          <br />
          <b>这一屏的向量是真从语料里算出来的</b>：数共现 → 算 PPMI → 对 PPMI 矩阵做特征分解取前 {dim} 个方向。
          （Levy &amp; Goldberg 2014 证明过：<b>skip-gram 本质上就是在隐式分解 PMI 矩阵</b>；
          这里用特征分解而不是 SGD，是为了<b>确定性</b> —— 同一份语料每次跑出同一组向量。）
          <br />
          <b>上一版这一屏的坐标是手摆的</b>：国王(1,0)、男人(0,0)、女人(0,1)、王后(1,1)，
          于是"国王−男人+女人=王后、距离 0"当然成立。
          <b>而"惊人的性质"如果是构造出来的，那就一点都不惊人。</b>
          <br />
          <b>别把类比当成词向量的证明。</b>它在精心挑的例子上很漂亮，
          换一批关系（反义词、动词时态）成功率就掉得厉害；
          而且"排第一"和"分得开"是两件事。词向量是 NLP 从符号迈向语义的关键一步，
          也是所有大模型<b>输入层</b>的地基。
        </p>
      </div>
    </div>
  )
}
