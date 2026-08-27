/** 舞台：张量并行 —— W 按列切给 G 张 GPU，各算 Y 片，all-gather 拼回；== 单卡 */
import type { TensorParState } from '@engine/kernels/tensorpar.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const GCOL = ['var(--f-idx)', 'var(--f-tag)', 'var(--hit)', 'var(--now)']

export function TensorParStage({ state }: StageProps<TensorParState>) {
  const { X, W, K, N, G, gpu, cols, Y, full, fraction, phase } = state
  const per = Math.ceil(N / G)
  const ownerOf = (j: number) => Math.min(G - 1, Math.floor(j / per))
  const done = phase === 'done'
  const gathering = phase === 'gather' || done
  return (
    <div className="card">
      <h3>张量并行 <span className="hint">W 按列切到 {G} 张 GPU · 各算一片 Y</span></h3>
      <div className="body">
        {/* X · W 布局 */}
        <div className="tplayout">
          <div className="tprow"><span className="tplab">X [1×{K}]</span>
            {X.map((v, k) => <span key={k} className="tpc x">{v}</span>)}
          </div>
          <div className="tpwwrap">
            <span className="tplab">W [{K}×{N}]（按列分卡）</span>
            <div className="tpw" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
              {W.map((wrow, k) => wrow.map((v, j) => {
                const owner = ownerOf(j)
                const active = !gathering && j >= cols[0] && j < cols[1]
                return <span key={`${k}-${j}`} className={`tpc w ${active ? 'on' : ''}`}
                  style={{ borderTopColor: k === 0 ? GCOL[owner % 4] : undefined, boxShadow: active ? `inset 0 0 0 1.5px ${GCOL[owner % 4]}` : undefined }}>{v}</span>
              }))}
            </div>
            <div className="tpgpulabels" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
              {Array.from({ length: N }, (_, j) => (
                <span key={j} className="tpgl" style={{ color: GCOL[ownerOf(j) % 4] }}>{j % per === 0 ? `GPU${ownerOf(j)}` : ''}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Y 片 → 拼接 */}
        <div className="tpyrow">
          <span className="tplab">{gathering ? 'all-gather → 完整 Y' : `Y 片（GPU ${gpu}）`}</span>
          {Y.map((v, j) => (
            <span key={j} className={`tpc y ${v === null ? 'pend' : ''}`}
              style={{ color: v !== null ? GCOL[ownerOf(j) % 4] : undefined, borderColor: v !== null ? `color-mix(in srgb, ${GCOL[ownerOf(j) % 4]} 40%, var(--line))` : undefined }}>
              {v === null ? '·' : v}
            </span>
          ))}
        </div>

        {/* 校验 + 占比 */}
        <div className="tpfoot">
          <div className="tpfrac"><span className="tpfn">1/{G}</span><span className="tpfl">每卡显存 · 算力占比</span></div>
          {done && <div className="tpcheck ok">✓ 拼出的 Y = [{full.join(', ')}] 和单卡整算完全一样 · 代价：all-gather 跨卡通信</div>}
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
