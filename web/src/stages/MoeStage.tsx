/** 舞台：MoE 路由 —— 当前 token 选 top-k 专家 + 门控 + 每专家负载条 */
import type { MoeState } from '@engine/kernels/moe.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function MoeStage({ state }: StageProps<MoeState>) {
  const { experts, topk, tokens, cursor, gates, chosen, chosenGates, load, activeFrac, phase } = state
  const done = phase === 'done'
  const maxLoad = Math.max(...load, 1)
  const gateOf = (e: number) => { const idx = chosen.indexOf(e); return idx >= 0 ? chosenGates[idx] : 0 }
  return (
    <div className="card">
      <h3>FFN 与 MoE 路由 <span className="hint">每个 token 只选 top-{topk} 个专家来算</span></h3>
      <div className="body">
        {/* 当前 token */}
        <div className="moehdr">
          <span className="moehl">当前 token</span>
          <span className="moetok">{done ? '全部路由完' : tokens[cursor]}</span>
          <span className="moeactive">活跃参数 {Math.round(activeFrac * 100)}%（{topk}/{experts} 专家）</span>
        </div>

        {/* 专家 + 门控 */}
        <div className="moeexperts">
          {Array.from({ length: experts }, (_, e) => {
            const on = !done && chosen.includes(e)
            const g = gateOf(e)
            return (
              <div key={e} className={`moeexp ${on ? 'on' : done ? '' : 'off'}`}>
                <span className="moeen">专家 {e}</span>
                {on && <span className="moeeg">{Math.round(g * 100)}%</span>}
                {!done && !on && <span className="moeeg skip">跳过</span>}
                {!done && (
                  <div className="moegatebar"><div className="moegatefill" style={{ width: `${(gates[e] ?? 0) * 100}%` }} /></div>
                )}
              </div>
            )
          })}
        </div>

        {/* 每专家负载 */}
        <div className="moeload">
          <div className="moeloadh">每个专家接了几个 token（负载）</div>
          {load.map((c, e) => (
            <div key={e} className="moelrow">
              <span className="moell">专家 {e}</span>
              <div className="moeltrack"><div className={`moelfill ${c === maxLoad && maxLoad > Math.min(...load) ? 'hot' : ''}`} style={{ width: `${(c / maxLoad) * 100}%` }}>{c}</div></div>
            </div>
          ))}
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
