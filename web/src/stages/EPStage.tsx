/** 舞台：专家并行 EP —— token 路由挑专家、all-to-all 派到专家所在卡，看分片省显存与负载不均 */
import type { EPState } from '@engine/kernels/ep.ts'
import type { StageProps } from '../types.ts'

export function EPStage({ state }: StageProps<EPState>) {
  const { gpus, tokens, experts, expertsPerGpu, phase, route, gpuOf, load, maxLoad, minLoad } = state
  const G = gpus
  const dispatched = phase === 'dispatch' || phase === 'compute' || phase === 'done'
  const routed = phase !== 'setup'
  return (
    <div className="card">
      <h3>专家并行 EP <span className="hint">MoE 的巨大专家分到多卡，代价是 all-to-all</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{experts} → {G}</span><span className="scdl">专家 → 卡</span></div>
          <div className="scdk"><span className="scdn">{expertsPerGpu}</span><span className="scdl">每卡专家数</span></div>
          <div className="scdk"><span className="scdn hot">{dispatched ? `${maxLoad}/${minLoad}` : '—'}</span><span className="scdl">负载 最忙/最闲</span></div>
        </div>

        {/* token → 专家 */}
        <div className="epwrap">
          <div className="eptokens">
            {route.map((e, t) => (
              <div key={t} className={`eptok ${e === 3 ? 'hot' : ''}`}>
                <span className="eptn">t{t}</span>
                {routed && <span className="epte">→专家{e}</span>}
              </div>
            ))}
          </div>

          {/* GPU 盒子 + 负载 */}
          <div className="epgpus">
            {Array.from({ length: G }, (_, g) => {
              const experts_here = Array.from({ length: expertsPerGpu }, (_, k) => g * expertsPerGpu + k)
              const toks = dispatched ? route.map((_, t) => t).filter(t => gpuOf[t] === g) : []
              const over = dispatched && load[g] === maxLoad && maxLoad > minLoad
              return (
                <div key={g} className={`epgpu ${over ? 'over' : ''}`}>
                  <span className="epgn">卡{g}</span>
                  <span className="epgx">专家 {experts_here.join(',')}</span>
                  <div className="epgtrack"><div className="epgfill" style={{ width: `${dispatched ? (load[g] / Math.max(1, maxLoad)) * 100 : 0}%` }} /></div>
                  <span className="epgl">{dispatched ? `${load[g]} token` : '待派'}{over ? ' · 过载' : ''}</span>
                  {dispatched && <span className="epgt">{toks.map(t => `t${t}`).join(' ')}</span>}
                </div>
              )
            })}
          </div>

          <div className="orcap">
            {phase === 'setup' && <span>{experts} 个专家太大放不下一张卡 → 分到 {G} 卡,每卡 {expertsPerGpu} 个</span>}
            {phase === 'route' && <span>路由:每个 token 挑一个专家(top-1);专家 3 被挑 3 次(偏热)</span>}
            {phase === 'dispatch' && <span>all-to-all 派发:每个 token 送到它专家所在的卡（跨卡通信）</span>}
            {phase === 'compute' && <span>各卡算收到的 token 再收回;负载 [{load.join(', ')}]——热专家那张卡过载</span>}
            {phase === 'done' && <span>专家分片省显存,代价=all-to-all + 负载不均(要负载均衡)</span>}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">EP 把巨大的专家权重<b>分片</b>到 {G} 卡(每卡 {expertsPerGpu} 个)→省显存,代价是 <b>all-to-all</b>(token 跳到专家所在卡)+ <b>负载不均</b>(热专家 {maxLoad} vs 闲 {minLoad},要靠限容量/辅助损失做负载均衡)。所以现代 MoE 服务把 <b>DP Attention(零通信)+ EP(专家分片)</b>配在一起:便宜的注意力不通信、昂贵的专家才分片走 all-to-all。调「卡数」看每卡专家数与负载怎么变。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{phase === 'setup' ? 'MoE 的专家又多又大,单卡放不下——EP 就是把它们摊到多卡。' : phase === 'route' ? '稀疏激活:每 token 只走少数专家,所以参数量爆大、算量不涨。' : phase === 'compute' ? '热专家被很多 token 挑中,它那张卡就忙、别的闲——这就是 MoE 服务要做负载均衡的原因。' : '专家在别的卡上,token 就得先 all-to-all 跳过去——通信是分片的代价。'}</p>}
      </div>
    </div>
  )
}
