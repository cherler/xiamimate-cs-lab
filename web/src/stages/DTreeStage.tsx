/** 舞台：决策树 —— 每步在候选切法里"搜"出信息增益最大的一刀,再落刀切纯;叶子按主类上色 */
import type { DTreeState } from '@engine/kernels/dtree.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const CA = 'var(--now)', CB = 'var(--miss)'
const LO = -3, HI = 3
const px = (x: number) => (x - LO) / (HI - LO) * 100
const py = (y: number) => 100 - (y - LO) / (HI - LO) * 100

export function DTreeStage({ state }: StageProps<DTreeState>) {
  const { phase, points, cands, nCands, best, splits, leaves, curGini, depth } = state
  const searching = phase === 'search'
  const maxGain = Math.max(...cands.map(c => c.gain), 0.001)
  //  一个候选切法在平面上的预览线(x→竖线、y→横线)
  const candLine = (c: { feat: 'x' | 'y'; t: number }) => c.feat === 'x'
    ? { x1: px(c.t), y1: 0, x2: px(c.t), y2: 100 }
    : { x1: 0, y1: py(c.t), x2: 100, y2: py(c.t) }

  return (
    <div className="card">
      <h3>决策树 <span className="hint">搜出信息增益最大的一刀,再落刀切纯</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{splits.length}</span><span className="scdl">已落几刀</span></div>
          <div className="scdk"><span className="scdn hot">{curGini}</span><span className="scdl">当前不纯度 Gini</span></div>
          <div className="scdk"><span className="scdn good" style={{ fontSize: '13px' }}>{best ? `${best.feat}<${best.t}` : '—'}</span><span className="scdl">{best ? `选中·增益 ${best.gain}` : '选中的刀'}</span></div>
          <div className="scdk"><span className="scdn">{leaves.length}</span><span className="scdl">纯叶子数</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            {leaves.map((lf, k) => (
              <rect key={k} x={px(lf.box[0])} y={py(lf.box[3])} width={px(lf.box[2]) - px(lf.box[0])} height={py(lf.box[1]) - py(lf.box[3])}
                fill={lf.c === 0 ? CA : CB} opacity="0.1" />
            ))}
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 搜索时:候选切法预览(浅) + 选中的那刀(高亮虚线) */}
            {searching && cands.map((c, k) => {
              const l = candLine(c)
              const isBest = best && c.feat === best.feat && c.t === best.t
              return <line key={`c${k}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className={isBest ? 'dtcand best' : 'dtcand'} vectorEffect="non-scaling-stroke" />
            })}
            {/* 已落下的刀 */}
            {splits.map((sp, k) => (
              <line key={k} x1={px(sp.seg[0])} y1={py(sp.seg[1])} x2={px(sp.seg[2])} y2={py(sp.seg[3])} className="dtcut" vectorEffect="non-scaling-stroke" />
            ))}
            {points.map((p, k) => (
              <circle key={k} cx={px(p.x)} cy={py(p.y)} r="1.7" fill={p.c === 0 ? CA : CB} opacity="0.92" />
            ))}
          </svg>
        </div>

        {/* 候选切法搜索:列出增益最高的几个,选中的高亮 —— 这才是"挑最大增益" */}
        {searching && cands.length > 0 && (
          <div className="dtsearch">
            <div className="dtsearch-t">搜候选切法（共 {nCands} 个，按信息增益取最大）：</div>
            {cands.map((c, k) => {
              const isBest = best && c.feat === best.feat && c.t === best.t
              return (
                <div key={k} className={`dtcandrow ${isBest ? 'best' : ''}`}>
                  <span className="dtcr-lbl">{c.feat} &lt; {c.t}</span>
                  <span className="dtcr-bar"><span className="dtcr-fill" style={{ width: `${(c.gain / maxGain) * 100}%` }} /></span>
                  <span className="dtcr-g">增益 {c.gain}</span>
                  <span className="dtcr-mk">{isBest ? '★ 选它' : ''}</span>
                </div>
              )
            })}
          </div>
        )}

        <div className="orcap">{rich(state.log)}</div>

        <p className="scnote">
          <b>决策树 = 一刀刀"切平面"把类别分开</b>,关键在<b>每步怎么选那一刀</b>:
          <b>枚举</b>所有候选切法(每个特征相邻取值的中点)、算每个的<b>信息增益</b>(切前 Gini − 切后加权 Gini)、<b>取增益最大</b>的那刀落下——
          切出纯净(Gini=0)的一块就成叶子,不纯的递归再切。它天生<b>可解释</b>(每条路径=一串 if-else)、用<b>多刀轴对齐</b>拼出非线性边界,
          是<b>随机森林、GBDT</b> 的积木。深 {depth}、{leaves.length || 3} 个纯叶子。
        </p>
      </div>
    </div>
  )
}
