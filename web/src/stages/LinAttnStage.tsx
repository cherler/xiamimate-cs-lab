/** 舞台：线性注意力 —— softmax O(N²) vs 线性 O(N) 的算量曲线 + KV缓存/固定状态显存对比 */
import type { LinAttnState } from '@engine/kernels/linattn.ts'
import type { StageProps } from '../types.ts'

const fmt = (x: number) => x >= 1e9 ? (x / 1e9).toFixed(1) + 'G' : x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'K' : `${x}`

export function LinAttnStage({ state }: StageProps<LinAttnState>) {
  const { d, n, ratio, kvMem, stateMem, crossoverN, histN, histSm, histLin, phase } = state
  const started = n > 0
  const W = 100, H = 96
  // log 轴范围
  const allF = [...histSm, ...histLin]
  const fMax = Math.max(1, ...allF), fMin = Math.min(...allF, 1e5)
  const nMax = 32768, nMin = 64
  const lx = (v: number) => (Math.log2(v) - Math.log2(nMin)) / (Math.log2(nMax) - Math.log2(nMin)) * W
  const ly = (v: number) => H - (Math.log2(Math.max(1, v)) - Math.log2(fMin)) / (Math.log2(fMax) - Math.log2(fMin)) * H
  const line = (hs: number[]) => histN.map((nn, k) => `${k ? 'L' : 'M'}${lx(nn).toFixed(1)} ${ly(hs[k]).toFixed(1)}`).join(' ')
  const memMax = Math.max(kvMem, stateMem, 1)

  return (
    <div className="card">
      <h3>线性注意力 <span className="hint">把 O(N²) 压成 O(N)、KV 缓存压成常数</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? n : '—'}</span><span className="scdl">序列长度 N</span></div>
          <div className="scdk"><span className="scdn hot">{started ? `${ratio}×` : '—'}</span><span className="scdl">算量差(softmax/线性)</span></div>
          <div className="scdk"><span className="scdn">{fmt(kvMem)}</span><span className="scdl">KV 缓存(随 N 长)</span></div>
          <div className="scdk"><span className="scdn">{fmt(stateMem)}</span><span className="scdl">线性状态(恒定)</span></div>
        </div>

        {/* 算量曲线（log-log） */}
        <div className="lawrap">
          <svg className="laplot" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {/* 交叉点竖线 N=d */}
            {started && <line x1={lx(crossoverN)} y1="0" x2={lx(crossoverN)} y2={H} className="laxover" />}
            {started && histN.length > 1 && <>
              <path d={line(histSm)} className="laline sm" vectorEffect="non-scaling-stroke" />
              <path d={line(histLin)} className="laline lin" vectorEffect="non-scaling-stroke" />
            </>}
            {started && <circle cx={lx(n)} cy={ly(histSm[histN.indexOf(n)])} r="1.8" className="ladot sm" />}
            {started && <circle cx={lx(n)} cy={ly(histLin[histN.indexOf(n)])} r="1.8" className="ladot lin" />}
          </svg>
          <div className="lalabels">
            <span className="laleg sm">■ softmax O(N²)</span>
            <span className="laleg lin">■ 线性 O(N)</span>
            <span className="laxlab">N=d={crossoverN} 交叉 →</span>
          </div>
        </div>

        {/* 显存对比 */}
        <div className="lamem">
          <div className="lamemrow">
            <span className="lamemlab">KV 缓存</span>
            <span className="lamemtrack"><span className="lamemfill kv" style={{ width: `${(kvMem / memMax) * 100}%` }}>{fmt(kvMem)}</span></span>
            <span className="lamemn">随 N 长</span>
          </div>
          <div className="lamemrow">
            <span className="lamemlab">线性状态</span>
            <span className="lamemtrack"><span className="lamemfill st" style={{ width: `${(stateMem / memMax) * 100}%` }}>{fmt(stateMem)}</span></span>
            <span className="lamemn">恒定 d×d</span>
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">N 从 64 拉到 32768:softmax 算量 O(N²) 爆到 <b>{fmt(histSm[histSm.length - 1])}</b>、KV 缓存涨到 <b>{fmt(kvMem)}</b>;线性注意力靠<b>结合律</b>先算 φ(K)ᵀV 那个 d×d 状态,算量 O(N) 只 <b>{fmt(histLin[histLin.length - 1])}</b>(差 {ratio}×)、状态<b>恒定 {fmt(stateMem)}</b>——<b>告别膨胀的 KV 缓存</b>,解码变 RNN 式递推、O(1)/步。交叉点 N=d={crossoverN}:短序列 softmax 省、长序列线性完胜。代价:φ 近似 softmax、拿一点精度换算量与显存。长上下文推理引擎绕不开的一条路。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>{n <= d ? 'N 还没超过 d，softmax 反而更省——线性注意力的常数项(d²)这时候占上风。' : '看红线(softmax N²)比蓝线(线性 N)陡得多;而右边 KV 缓存条一直在长、线性状态条纹丝不动。'}继续拉长 N。</p>}
      </div>
    </div>
  )
}
