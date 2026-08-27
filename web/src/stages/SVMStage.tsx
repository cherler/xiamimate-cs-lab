/** 舞台：SVM —— 最大间隔边界 + 间隔"街道" + 支持向量高亮 */
import type { SVMState } from '@engine/kernels/svm.ts'
import type { StageProps } from '../types.ts'

const CA = 'var(--now)', CB = 'var(--miss)'
const LO = -3, HI = 3
const px = (x: number) => (x - LO) / (HI - LO) * 100
const py = (y: number) => 100 - (y - LO) / (HI - LO) * 100

export function SVMStage({ state }: StageProps<SVMState>) {
  const { phase, points, boundaryX, margin, supportVectors, isMax } = state
  const svSet = new Set(supportVectors)
  const showLine = phase !== 'setup'
  return (
    <div className="card">
      <h3>支持向量机 SVM <span className="hint">分两类不够，要找"最宽的那条街"</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{phase === 'setup' ? '?' : phase === 'naive' ? '随便一条' : 'SVM'}</span><span className="scdl">哪条边界</span></div>
          <div className="scdk"><span className="scdn hot">{showLine ? margin : '—'}</span><span className="scdl">间隔(单侧)</span></div>
          <div className="scdk"><span className="scdn">{supportVectors.length || '—'}</span><span className="scdl">支持向量</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* 间隔街道 */}
            {showLine && margin > 0 && (
              <rect x={px(boundaryX - margin)} y="0" width={px(boundaryX + margin) - px(boundaryX - margin)} height="100"
                fill={isMax ? 'var(--now)' : 'var(--miss)'} opacity="0.08" />
            )}
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 街边虚线 */}
            {showLine && margin > 0 && <>
              <line x1={px(boundaryX - margin)} y1="0" x2={px(boundaryX - margin)} y2="100" className="svmmargin" vectorEffect="non-scaling-stroke" />
              <line x1={px(boundaryX + margin)} y1="0" x2={px(boundaryX + margin)} y2="100" className="svmmargin" vectorEffect="non-scaling-stroke" />
            </>}
            {/* 决策边界 */}
            {showLine && <line x1={px(boundaryX)} y1="0" x2={px(boundaryX)} y2="100" className="mlline" vectorEffect="non-scaling-stroke" />}
            {/* 点 */}
            {points.map((p, k) => (
              <g key={k}>
                {svSet.has(p.idx) && <circle cx={px(p.x)} cy={py(p.y)} r="3.2" fill="none" stroke="var(--ink)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />}
                <circle cx={px(p.x)} cy={py(p.y)} r="1.8" fill={p.c === 0 ? CA : CB} opacity="0.92" />
              </g>
            ))}
          </svg>
          <div className="orcap">
            {phase === 'setup' ? '两类线性可分——能分开的线有无数条,哪条最好?'
              : phase === 'naive' ? '随便一条(x=−0.5):贴着左类、间隔只 0.5——离一类太近,泛化差'
              : `SVM 最大间隔:边界居中、街道最宽(间隔 ${margin});圈出的 4 个=支持向量`}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">SVM 选的是<b>离两边都最远</b>的那条线(最大间隔 {margin} &gt; 随便那条的 0.5),对新数据容错最大、泛化最好。而且它<b>只记得支持向量</b>那少数几个关键点(圈出的 4 个)——其余全可丢。线性不可分时,用<b>核函数</b>把点映到高维再找最大间隔。这就是 SVM:不满足于"能分开",而要"<b>分得最稳</b>"。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{phase === 'setup' ? '逻辑回归随便找一条能分开的就行;SVM 多问一句:哪条最好?' : phase === 'naive' ? '这条线能分开,但贴着一类,间隔窄、不稳。' : '最宽的街只由紧贴街边的几个点(支持向量)定住,其余点再远都不影响。'}</p>}
      </div>
    </div>
  )
}
