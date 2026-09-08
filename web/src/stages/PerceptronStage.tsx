/** 舞台：感知机 —— 平面两类点，一条线 w·x+b=0，分错就纠(w+=y·x)，扫到零错误即收敛 */
import type { PerceptronState } from '@engine/kernels/perceptron.ts'
import type { StageProps } from '../types.ts'

const CPOS = '#3b82f6', CNEG = 'var(--now)'
const LO = -0.5, HI = 5.5
const px = (x: number) => (x - LO) / (HI - LO) * 100
const py = (y: number) => 100 - (y - LO) / (HI - LO) * 100

export function PerceptronStage({ state }: StageProps<PerceptronState>) {
  const { pts, w, b, pass, ptIdx, score, ok, updated, updates, act, phase , dataTag, converged, passes, mistakesNow, bestMistakes, bestW, bestB, cycleAt } = state
  const done = phase === 'done'
  const hasLine = Math.abs(w[0]) + Math.abs(w[1]) > 1e-6
  const yb = (x: number) => -(w[0] * x + b) / (w[1] || 1e-6)
  const cur = ptIdx >= 0 ? pts[ptIdx] : null
  return (
    <div className="card">
      <h3>感知机 <span className="hint">一个神经元靠"错了就纠"学出分界线</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">({w.join(',')})</span><span className="scdl">权重 w</span></div>
          <div className="scdk"><span className="scdn">{b}</span><span className="scdl">偏置 b</span></div>
          <div className="scdk"><span className="scdn">{updates}</span><span className="scdl">纠正次数</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {hasLine && <line x1={px(LO)} y1={py(yb(LO))} x2={px(HI)} y2={py(yb(HI))} className="mlline" vectorEffect="non-scaling-stroke" />}
            {pts.map((p, k) => {
              const isCur = k === ptIdx && !done
              return (
                <g key={k}>
                  {isCur && <circle cx={px(p.x[0])} cy={py(p.x[1])} r="3.6" fill="none"
                    stroke={updated ? 'var(--miss)' : 'var(--hit)'} strokeWidth="1" vectorEffect="non-scaling-stroke" />}
                  <circle cx={px(p.x[0])} cy={py(p.x[1])} r={isCur ? 2.4 : 1.9}
                    fill={p.y > 0 ? CPOS : CNEG} opacity={isCur ? 1 : 0.9} />
                </g>
              )
            })}
          </svg>
          <div className="orcap">
            {act === '' ? '按「下一步」开始:一条还没定的线,逐点检查、分错就纠'
              : act === 'converged' ? `第 ${pass} 轮零错误 → 收敛!线 w=(${w.join(',')})、b=${b} 把两类分开`
                : done ? `学好了:w=(${w.join(',')})、b=${b},共 ${updates} 次纠正`
                  : cur ? `点 (${cur.x.join(',')}) 类${cur.y > 0 ? '正' : '负'}:score=${score}${ok ? ' → 符号对,分对了' : ` → 符号错,纠正:w→(${w.join(',')})、b→${b}(线转一下)`}` : ''}
          </div>
        </div>

        {done
          ? (converged
            ? <p className="scnote">感知机 = <b>一个神经元</b>：算 w·x+b 看正负判类别，几何上就是一条<b>分界线</b>；
              学法是<b>"错了就纠"</b>（w += y·x）。数据<b>线性可分</b>时保证有限步收敛（这里 {updates} 次）。
              它是逻辑回归、SVM 和整个深度网络里每个神经元的<b>祖先</b>（激活换成硬阈值 sign）。
              　⚠️ 但<b>收敛定理有前提</b>：把「数据」换成<b>异或</b>或<b>一个噪声点</b>再看 ——
              同一套算法会<b>永远停不下来</b>。</p>
            : <p className="scnote"><b>{passes} 轮跑完了，还没收敛</b> —— 此刻仍错 {mistakesNow}/{pts.length} 个，共纠了 {updates} 次。
              {cycleAt && <>　而且它不是"还差一点"：<b>第 {cycleAt[0]} 轮和第 {cycleAt[1]} 轮的 (w, b) 一模一样</b> ——
                它已经<b>陷进循环</b>了，再跑一万轮也是这几个状态来回转。</>}
              {dataTag.startsWith('异或')
                ? <>　异或的四个点<b>怎么画一条直线都分不开</b>，而感知机能表达的全部就是一条直线。
                  这不是没训练够，是<b>模型的表达能力不够</b> —— 1969 年 Minsky 和 Papert 摁住感知机、
                  直接带来第一次 AI 寒冬的，就是这个例子。出路是<b>多层 + 非线性激活</b>。</>
                : <>　数据本来可分，只是混进了<b>一个标错的点</b>（它夹在两个负例正中间，任何直线都分不开）。
                  收敛定理要求"存在一条线把所有点都分对"，一个噪声点就把这个前提破了。
                  　⚠️ 这比异或更常见：<b>真实数据总有噪声，所以感知机在实践中几乎不能直接用</b>。</>}
              {bestMistakes < mistakesNow && <>　　还有一处值得看：此刻错 <b>{mistakesNow}</b> 个，
                而历史最好只错 <b>{bestMistakes}</b> 个（w=({bestW.join(',')})、b={bestB}）。
                <b>感知机不记得最好的那次</b> —— 它只有"当前的 w"，停在哪儿全看运气。
                把见过的最好权重揣兜里，就是 <b>pocket algorithm</b>。</>}</p>)
          : <p className="scnote" style={{ opacity: .85 }}>蓝=正类、琥珀=负类；那条线是当前的 w·x+b=0。
            逐点看：符号和真实类一致=分对（绿圈），不一致=分错（红圈）→ 把线朝该点纠一下（w+=y·x、b+=y）。
            扫到某一整轮零错误就学好了。
            　盯读数条上「此刻错几个 / 历史最好」这两栏：它俩<b>不一定相等</b> —— 感知机不记得自己最好的时候。</p>}
      </div>
    </div>
  )
}
