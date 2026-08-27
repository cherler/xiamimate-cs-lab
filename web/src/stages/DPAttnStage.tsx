/** 舞台：DP Attention —— TP(切头,每层 all-reduce) vs DP(切请求,零通信) 的多卡分工对比 */
import type { DPAttnState } from '@engine/kernels/dpattn.ts'
import type { StageProps } from '../types.ts'

export function DPAttnStage({ state }: StageProps<DPAttnState>) {
  const { gpus, b, h, phase, headsPerGpu, reqPerGpu, tpComm, tpWeight, dpWeight } = state
  const G = gpus
  const showTP = phase === 'tp' || phase === 'done' || phase === 'setup'
  const showDP = phase === 'dp' || phase === 'done' || phase === 'setup'
  const gpuList = Array.from({ length: G }, (_, g) => g)
  return (
    <div className="card">
      <h3>DP Attention <span className="hint">多卡服务时，注意力按请求切、零通信</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{G}</span><span className="scdl">卡数 G</span></div>
          <div className="scdk"><span className="scdn">{b} · {h}</span><span className="scdl">请求 · 头</span></div>
          <div className="scdk"><span className="scdn hot">{phase === 'tp' ? tpComm : phase === 'dp' ? 0 : '对比'}</span><span className="scdl">注意力通信</span></div>
        </div>

        <div className="dpwrap">
          {/* TP */}
          <div className={`dppanel ${phase === 'tp' ? 'active' : ''} ${phase === 'dp' ? 'faded' : ''}`}>
            <div className="dphead"><b>张量并行 TP</b>：切头 · 权重 {tpWeight}</div>
            <div className="dpgpus">
              {gpuList.map(g => (
                <div key={g} className="dpgpu tp">
                  <span className="dpgn">卡{g}</span>
                  <span className="dpgc">头 {g * headsPerGpu}–{g * headsPerGpu + headsPerGpu - 1}</span>
                  <span className="dpgc dim">× 全部 {b} 请求</span>
                </div>
              ))}
            </div>
            <div className="dpcomm bad">↻ 每层 all-reduce 拼头 · 通信 {tpComm}/token</div>
          </div>

          {/* DP */}
          <div className={`dppanel ${phase === 'dp' ? 'active' : ''} ${phase === 'tp' ? 'faded' : ''}`}>
            <div className="dphead"><b>数据并行 DP</b>：切请求 · 权重 {dpWeight}</div>
            <div className="dpgpus">
              {gpuList.map(g => (
                <div key={g} className="dpgpu dp">
                  <span className="dpgn">卡{g}</span>
                  <span className="dpgc">全部 {h} 头</span>
                  <span className="dpgc dim">× 请求 {g * reqPerGpu}–{g * reqPerGpu + reqPerGpu - 1}</span>
                </div>
              ))}
            </div>
            <div className="dpcomm good">✓ 注意力零通信 · 各卡自己算完</div>
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">权衡:<b>TP</b> 省权重显存(每卡 {tpWeight})但<b>每层都要 all-reduce</b>;<b>DP</b> <b>零通信</b>但复制整套权重。注意力权重其实很小、复制得起;而 <b>MoE 的专家权重巨大</b>才真需要切。所以现代 MoE 服务常用 <b>DP Attention + EP(专家并行)</b>:便宜的注意力用 DP 避开每层 all-reduce、昂贵的专家用 EP 分片——各切各的,把通信花在刀刃上。调「卡数」看分工变化。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{phase === 'tp' ? '切头:每卡只有一部分头,算完得跨卡 all-reduce 把头拼回来——每层都通信。' : phase === 'dp' ? '切请求:每卡拿全部头、只管自己那几个请求,从头算到尾——注意力这段零通信。' : '同一批注意力,两种铺法:TP 切头(通信换省显存)、DP 切请求(复制权重换零通信)。'}</p>}
      </div>
    </div>
  )
}
