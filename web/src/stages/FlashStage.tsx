/** 舞台：FlashAttention —— 分数行分块扫描 + running(m,l,O) 收敛到真值 + HBM 流量对比 */
import type { FlashState } from '@engine/kernels/flash.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function FlashStage({ state }: StageProps<FlashState>) {
  const { scores, block, m, l, acc, out, naive, err, phase } = state
  const N = scores.length
  const inBlock = (k: number) => block.includes(k)
  const converged = phase === 'done'
  return (
    <div className="card">
      <h3>FlashAttention <span className="hint">分块在线 softmax · 分数矩阵不落 HBM</span></h3>
      <div className="body">
        {/* 分数行：一块一块扫过 */}
        <div className="flrow">
          <span className="fllab">分数 S = Q·K/√d</span>
          <div className="flscores">
            {scores.map((s, k) => (
              <div key={k} className={`fltok ${inBlock(k) ? 'cur' : converged ? 'seen' : ''}`}>
                <span className="flsv">{s.toFixed(1)}</span>
                <span className="flidx">k{k}</span>
              </div>
            ))}
          </div>
        </div>

        {/* running 三滚动量 */}
        <div className="flacc">
          <div className="flcell"><span className="flk">m<i>滚动最大</i></span><span className="flv">{m === -Infinity ? '−∞' : m.toFixed(2)}</span></div>
          <div className="flcell"><span className="flk">l<i>exp 之和</i></span><span className="flv">{l.toFixed(2)}</span></div>
          <div className="flcell"><span className="flk">O<i>加权和(未归一)</i></span><span className="flv">{acc.toFixed(1)}</span></div>
        </div>

        {/* 收敛：O/l → 真值 */}
        <div className="flconv">
          <div className="flconvrow">
            <span className="flconvlab">当前输出 O / l</span>
            <span className={`flconvval ${converged ? 'ok' : ''}`}>{out.toFixed(4)}</span>
          </div>
          <div className="flconvrow">
            <span className="flconvlab">一次性 softmax 真值</span>
            <span className="flconvval ref">{naive.toFixed(4)}</span>
          </div>
          <div className="flconvbar">
            {converged
              ? <span className="flok">✓ 相对误差 {(err * 1e9).toFixed(2)}e-9 —— 分块与一次性完全等价</span>
              : <span className="flnote">相对误差 {(err * 100).toFixed(2)}% · 再扫一块继续对齐</span>}
          </div>
        </div>

        {/* HBM 流量对比 */}
        <div className="flio">
          <div className="fliocol bad"><span className="flion">3N = {3 * N}</span><span className="fliol">朴素 · 分数向量 HBM 搬运趟数<br/>（写 S → 读做 softmax → 读算 ×V）</span></div>
          <div className="fliocol ok"><span className="flion">0</span><span className="fliol">Flash · 分数向量落 HBM 趟数<br/>（全程在 SRAM 里累加）</span></div>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
