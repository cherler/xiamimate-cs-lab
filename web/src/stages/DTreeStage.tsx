/** 舞台：决策树 —— 每次挑信息增益最大的一刀切平面，直到每块纯净；叶子按主类上色 */
import type { DTreeState } from '@engine/kernels/dtree.ts'
import type { StageProps } from '../types.ts'

const CA = 'var(--now)', CB = 'var(--miss)'
const LO = -3, HI = 3
const px = (x: number) => (x - LO) / (HI - LO) * 100
const py = (y: number) => 100 - (y - LO) / (HI - LO) * 100

export function DTreeStage({ state }: StageProps<DTreeState>) {
  const { phase, points, splits, leaves, curGini, gain, depth } = state
  return (
    <div className="card">
      <h3>决策树 <span className="hint">靠一刀刀"切平面"把类别分开</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{splits.length}</span><span className="scdl">切了几刀</span></div>
          <div className="scdk"><span className="scdn hot">{curGini}</span><span className="scdl">当前不纯度 Gini</span></div>
          <div className="scdk"><span className="scdn">{gain || '—'}</span><span className="scdl">本刀信息增益</span></div>
          <div className="scdk"><span className="scdn">{leaves.length}</span><span className="scdl">纯叶子数</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* 叶子区块上色 */}
            {leaves.map((lf, k) => (
              <rect key={k} x={px(lf.box[0])} y={py(lf.box[3])} width={px(lf.box[2]) - px(lf.box[0])} height={py(lf.box[1]) - py(lf.box[3])}
                fill={lf.c === 0 ? CA : CB} opacity="0.1" />
            ))}
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 切线 */}
            {splits.map((sp, k) => (
              <line key={k} x1={px(sp.seg[0])} y1={py(sp.seg[1])} x2={px(sp.seg[2])} y2={py(sp.seg[3])} className="dtcut" vectorEffect="non-scaling-stroke" />
            ))}
            {/* 点 */}
            {points.map((p, k) => (
              <circle key={k} cx={px(p.x)} cy={py(p.y)} r="1.7" fill={p.c === 0 ? CA : CB} opacity="0.92" />
            ))}
          </svg>
          <div className="orcap">
            {phase === 'root' ? '根节点:16 个点混在一起(不纯)。按「下一步」挑最好的一刀'
              : splits.length === 1 ? '第 1 刀 x<0?：左半全第 0 类(纯，浅蓝叶子);右半还混着'
              : phase === 'done' ? '三刀两下全部切纯:左=第0类、右上=第1类、右下=第0类'
              : '第 2 刀 y<0?(只切右半):右上=第1类、右下=第0类,都纯了'}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">决策树建好:深 <b>{depth}</b>、<b>{leaves.length}</b> 个纯叶子。每条路径就是一串 if-else:<b>x&lt;0→第0类;x≥0且y≥0→第1类;x≥0且y&lt;0→第0类</b>。它挑信息增益最大的刀、递归切到纯,天生<b>可解释</b>,还能用<b>多刀轴对齐</b>拼出非线性边界。它是<b>随机森林、GBDT</b> 的积木。</p>
          : <p className="scnote" style={{ opacity: .85 }}>怎么选每一刀?看哪一刀让子集<b>最纯</b>——基尼不纯度(0=全同类)下降最多的那刀(信息增益最大)。切出纯净的一块就成叶子,不纯的继续切。</p>}
      </div>
    </div>
  )
}
