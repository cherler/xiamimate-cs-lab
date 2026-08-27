/** 舞台：Chunked Prefill —— 时间线甘特图，prefill 块与 decode 交错，B 首字延迟 */
import type { ChunkPrefillState } from '@engine/kernels/chunkprefill.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function ChunkPrefillStage({ state }: StageProps<ChunkPrefillState>) {
  const { chunk, prefillLen, timeline, cursor, firstDecodeAt, totalTime, phase } = state
  const done = phase === 'done'
  let acc = 0
  const naiveLatency = prefillLen + 1
  return (
    <div className="card">
      <h3>Chunked Prefill <span className="hint">长 prefill 切块 · 和别的 decode 交错</span></h3>
      <div className="body">
        {/* 时间线甘特 */}
        <div className="cpgantt">
          {timeline.map((op, k) => {
            const left = acc; acc += op.cost
            const w = (op.cost / totalTime) * 100
            const isFirstDec = op.kind === 'decode' && (left + op.cost) === firstDecodeAt
            return (
              <div key={k} className={`cpop ${op.kind} ${k === cursor && !done ? 'cur' : k < cursor || done ? 'past' : ''} ${isFirstDec ? 'firstdec' : ''}`}
                style={{ width: `${w}%` }} title={op.label}>
                <span className="cplab">{op.kind === 'prefill' ? `P${op.cost}` : 'D'}</span>
              </div>
            )
          })}
        </div>
        <div className="cpaxis"><span>t=0</span><span>t={totalTime}</span></div>
        <div className="cplegend">
          <span className="cpleg"><i className="cpsw prefill" />A 的 prefill 块</span>
          <span className="cpleg"><i className="cpsw decode" />B 的 decode</span>
          <span className="cpleg"><i className="cpsw firstdec" />B 首字吐出</span>
        </div>

        {/* 首字延迟对比 */}
        <div className="cpcmp">
          <div className="cpcol ok"><span className="cpn">{firstDecodeAt}</span><span className="cpl">块大小 {chunk} · B 首字延迟</span></div>
          <div className="cpcol bad"><span className="cpn">{naiveLatency}</span><span className="cpl">整块跑（不切）· B 要等到</span></div>
          <div className="cpcol"><span className="cpn">{totalTime}</span><span className="cpl">总时间（两种一样）</span></div>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
