/** 舞台：词向量 —— 词摆进平面(王室度×性别)，国王−男人+女人 的向量运算落到王后 */
import type { WordVecState } from '@engine/kernels/wordvec.ts'
import type { StageProps } from '../types.ts'

const XLO = -1.25, XHI = 1.4, YLO = -0.75, YHI = 1.35
const px = (x: number) => (x - XLO) / (XHI - XLO) * 100
const py = (y: number) => 100 - (y - YLO) / (YHI - YLO) * 100

export function WordVecStage({ state }: StageProps<WordVecState>) {
  const { words, stage, dir, result, ranked, nearest, phase } = state
  const done = phase === 'done'
  const get = (n: string) => words.find(w => w.name === n)!.v
  const man = get('男人'), king = get('国王'), woman = get('女人')
  const showSub = stage === 'sub' || stage === 'add' || stage === 'find' || done
  const showRes = stage === 'add' || stage === 'find' || done
  const showNear = stage === 'find' || done
  return (
    <div className="card">
      <h3>词向量 Word2Vec <span className="hint">意思变成位置，语义关系变成可加减的方向</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">国王−男人+女人</span><span className="scdl">要算的类比</span></div>
          <div className="scdk"><span className="scdn">({result.join(',')})</span><span className="scdl">结果向量</span></div>
          <div className="scdk"><span className="scdn">{showNear ? nearest : '?'}</span><span className="scdl">最近的词</span></div>
        </div>

        <div className="mlwrap">
          <div className="wvplotbox">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 国王-男人 方向箭头 */}
            {showSub && <line x1={px(man[0])} y1={py(man[1])} x2={px(king[0])} y2={py(king[1])} stroke="var(--now)" strokeWidth="1.4" markerEnd="url(#wvar)" vectorEffect="non-scaling-stroke" />}
            {/* 女人 + 同方向 → result（平行边） */}
            {showRes && <line x1={px(woman[0])} y1={py(woman[1])} x2={px(result[0])} y2={py(result[1])} stroke="var(--now)" strokeWidth="1.4" strokeDasharray="3 2" markerEnd="url(#wvar)" vectorEffect="non-scaling-stroke" />}
            <defs><marker id="wvar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--now)" /></marker></defs>
            {/* 结果点 */}
            {showRes && <g>
              <circle cx={px(result[0])} cy={py(result[1])} r="2.4" fill="none" stroke="var(--hit)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
              <line x1={px(result[0]) - 3} y1={py(result[1])} x2={px(result[0]) + 3} y2={py(result[1])} stroke="var(--hit)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
              <line x1={px(result[0])} y1={py(result[1]) - 3} x2={px(result[0])} y2={py(result[1]) + 3} stroke="var(--hit)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
            </g>}
            {/* 词点 */}
            {words.map((w, k) => {
              const isNear = showNear && w.name === nearest
              return (
                <g key={k}>
                  <circle cx={px(w.v[0])} cy={py(w.v[1])} r={isNear ? 2.6 : 1.8} fill={isNear ? 'var(--hit)' : 'var(--ink)'} opacity={isNear ? 1 : 0.8} />
                </g>
              )
            })}
          </svg>
          {/* 词标签（HTML 覆盖层，避免 SVG 非等比缩放拉伸文字） */}
          <div className="wvlabels">
            {words.map((w, k) => {
              const isNear = showNear && w.name === nearest
              return <span key={k} className={`wvlab ${isNear ? 'near' : ''}`} style={{ left: `${px(w.v[0])}%`, top: `${py(w.v[1])}%` }}>{w.name}</span>
            })}
            <span className="wvax wvaxx">王室度→</span>
            <span className="wvax wvaxy">性别↑</span>
          </div>
          </div>
        </div>

        <div className="orcap">
          {stage === 'show' ? '横轴=王室度、纵轴=性别;相近的词离得近。按「下一步」做向量类比'
            : stage === 'sub' ? `国王(1,0) − 男人(0,0) = (${dir.join(',')})——这就是"王室"方向(琥珀箭头)`
              : stage === 'add' ? `+ 女人(0,1) = (${result.join(',')})——从女人沿同一"王室"方向走一格(虚线),落到 ⊕`
                : `离 ⊕(${result.join(',')}) 最近的词是 ${nearest}(距离 ${ranked[0]?.d})——类比成立!`}
        </div>

        {done
          ? <p className="scnote">词向量把每个词变成空间里的<b>向量</b>:意思相近→位置相近,而<b>语义关系变成方向</b>。<b>国王 − 男人</b> 得到的正是"王室"方向,<b>+ 女人</b> 就落到<b>王后</b>——"男→女""平民→王室"两个方向能像箭头一样加减。这靠<b>分布假设</b>学出来(共现的词向量相互靠近,skip-gram/CBOW)。近义、类比、聚类都靠向量运算。词向量是 NLP 从符号迈向语义的关键一步,也是所有大模型<b>输入层</b>的地基。</p>
          : <p className="scnote" style={{ opacity: .85 }}>每个词一个坐标(这里用两条可解释的轴:王室度、性别)。看"国王−男人"这个箭头=王室方向;把它接到"女人"上(虚线,平行四边形),终点 ⊕ 落在哪个词附近,那个词就是类比答案。真实词向量是几百维、从海量文本自动学的。</p>}
      </div>
    </div>
  )
}
