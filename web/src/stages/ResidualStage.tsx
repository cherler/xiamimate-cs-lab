/** 舞台：残差=梯度高速路 —— 梯度倒传穿层，没残差指数衰减 vs 有残差守在 ~1 */
import type { ResidualState } from '@engine/kernels/residual.ts'
import type { StageProps } from '../types.ts'

export function ResidualStage({ state }: StageProps<ResidualState>) {
  const { layer, depth, gradPlain, gradRes, resFactor, histPlain, histRes, phase } = state
  const started = histPlain.length > 1
  const H = 110, W = 100
  const n = depth + 1
  const px = (k: number) => (k / (n - 1)) * W
  const py = (v: number) => H - Math.max(0, Math.min(1.3, v)) / 1.3 * H
  const line = (h: number[]) => h.map((v, k) => `${k ? 'L' : 'M'}${px(k).toFixed(1)} ${py(v).toFixed(1)}`).join(' ')
  return (
    <div className="card">
      <h3>残差 = 梯度高速路 <span className="hint">为什么深网络能训得动</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{depth}</span><span className="scdl">层数 N</span></div>
          <div className="scdk"><span className="scdn" style={{ color: 'var(--miss)' }}>{started ? gradPlain.toFixed(3) : '1.000'}</span><span className="scdl">没残差 梯度</span></div>
          <div className="scdk"><span className="scdn hot">{started ? gradRes.toFixed(3) : '1.000'}</span><span className="scdl">有残差 梯度</span></div>
        </div>

        {/* 两条梯度衰减曲线 */}
        <div className="rswrap">
          <svg className="rsplot" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {/* 参考线 y=1 和 y=0.1(消失阈) */}
            <line x1="0" y1={py(1)} x2={W} y2={py(1)} className="rsref" />
            <line x1="0" y1={py(0.1)} x2={W} y2={py(0.1)} className="rsref dim" />
            {started && <path d={line(histRes)} className="rsline res" vectorEffect="non-scaling-stroke" />}
            {started && <path d={line(histPlain)} className="rsline plain" vectorEffect="non-scaling-stroke" />}
          </svg>
          <div className="rslabels">
            <span className="rsleg res">■ 有残差 ≈1（守住）</span>
            <span className="rsleg plain">■ 没残差 →0（消失）</span>
          </div>
          <div className="orcap">
            {started ? `倒传到第 ${layer} 层：没残差 ×0.8 连乘衰减；有残差 ×(1+f')=×${resFactor.toFixed(2)}≈1，恒等路兜底`
              : '按「下一步」让梯度从输出往输入倒传'}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">梯度穿过 {depth} 层:<b style={{ color: 'var(--miss)' }}>没残差</b>每层 ×0.8、连乘塌到 <b>{gradPlain.toFixed(3)}</b>(≈0.8^{depth}，梯度消失、深层学不动);<b>有残差</b> y=x+f(x)、导数=1+f'，那条 <b>+1 恒等高速路</b>让梯度原样穿过、稳在 <b>{gradRes.toFixed(3)}</b>。这就是 ResNet、Transformer 每个子层都裹残差的原因——把"连乘衰减"变成"连加穿过"，几十上百层才训得动。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>链式法则=连乘。没残差每层乘个 &lt;1 的数,越乘越小(指数衰减);有残差每层导数是 1+f'，那个 +1 让梯度几乎原样通过。看红线守在 1、灰线往 0 塌。</p>}
      </div>
    </div>
  )
}
