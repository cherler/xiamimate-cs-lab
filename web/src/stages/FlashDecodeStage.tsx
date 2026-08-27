/** 舞台：Flash Decode —— 1 个 query 对长 KV，切 C 块并行算局部注意力，online softmax 无损合并 */
import type { FlashDecodeState } from '@engine/kernels/flashdecode.ts'
import type { StageProps } from '../types.ts'

const CHUNK_COLORS = ['var(--now)', 'var(--hit)', 'var(--f-tag)', 'var(--miss)']

export function FlashDecodeStage({ state }: StageProps<FlashDecodeState>) {
  const { n, chunks, chunkSize, phase, curChunk, parts, output, fullOutput, seqLatency, parLatency } = state
  const combined = phase === 'combine' || phase === 'done'
  const match = combined && Math.abs(output - fullOutput) < 1e-3
  return (
    <div className="card">
      <h3>Flash Decode <span className="hint">解码时切开长 KV 并行，压低时延</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">1 × {n}</span><span className="scdl">query × KV</span></div>
          <div className="scdk"><span className="scdn">{chunks}</span><span className="scdl">KV 分块 C</span></div>
          <div className="scdk"><span className="scdn hot">{seqLatency}→{parLatency}</span><span className="scdl">时延 顺序→并行</span></div>
          <div className="scdk"><span className="scdn">{combined ? output.toFixed(3) : '?'}</span><span className="scdl">输出</span></div>
        </div>

        {/* KV 分块 */}
        <div className="fdwrap">
          <div className="fdkv">
            {Array.from({ length: chunks }, (_, c) => {
              const done = phase !== 'chunk' || c <= curChunk
              const p = parts[c]
              return (
                <div key={c} className={`fdchunk ${phase === 'chunk' && c === curChunk ? 'now' : ''} ${done ? 'done' : ''}`}
                  style={{ borderColor: done ? CHUNK_COLORS[c % 4] : 'var(--line)' }}>
                  <div className="fdkeys">
                    {Array.from({ length: chunkSize }, (_, k) => (
                      <span key={k} className="fdkey" style={{ background: done ? `color-mix(in srgb, ${CHUNK_COLORS[c % 4]} 22%, var(--panel))` : 'var(--panel)' }}>{c * chunkSize + k}</span>
                    ))}
                  </div>
                  {p && done
                    ? <div className="fdpart">mᶜ {p.mc}<br />lᶜ {p.lc}<br />oᶜ {p.oc}</div>
                    : <div className="fdpart dim">待算</div>}
                </div>
              )
            })}
          </div>
          <div className="orcap">
            {phase === 'chunk' ? `第 ${curChunk + 1}/${chunks} 块并行算局部 (mᶜ, lᶜ, oᶜ)——各块互不依赖`
              : combined ? <span>合并:各块 exp(mᶜ−M) 重缩放相加 → 输出 <b>{output.toFixed(4)}</b> {match ? <b style={{ color: 'var(--hit)' }}>= 一次性 softmax {fullOutput.toFixed(4)} ✓</b> : ''}</span>
              : '按「下一步」逐块并行算'}
          </div>

          {/* 时延对比 */}
          <div className="fdlat">
            <div className="fdlatrow"><span className="fdlatlab">顺序扫</span><span className="fdlattrack"><span className="fdlatfill seq" style={{ width: '100%' }}>~{seqLatency}</span></span></div>
            <div className="fdlatrow"><span className="fdlatlab">Flash Decode</span><span className="fdlattrack"><span className="fdlatfill par" style={{ width: `${(parLatency / seqLatency) * 100}%` }}>~{parLatency}</span></span></div>
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">decode 每步只有 1 个 query、却要扫 {n} 个 KV。Flash Decode 把 KV 切 <b>{chunks}</b> 块<b>并行</b>算局部注意力,再用 <b>online softmax</b> 无损合并:时延从顺序 ~{seqLatency} 降到并行 <b>~{parLatency}</b>,输出和一次性 softmax <b>分毫不差</b>(不是近似)。这就是长上下文<b>解码提速</b>的关键——<b>prefill 切 query、decode 切 KV</b>,合并公式和 FlashAttention 同源。把上面「KV 分块」调大,看时延再降。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{phase === 'chunk' ? '每块只看自己那几个 key，算出局部最大/和/加权——互不依赖，所以能同时算。' : '合并不是简单相加：要用全局最大 M 把各块的 exp 重新缩放对齐，才无损。这就是 online softmax。'}</p>}
      </div>
    </div>
  )
}
