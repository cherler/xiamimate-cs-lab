/** 舞台：张量布局 —— 矩阵 grid + 1D 内存条，按布局摊平；末尾行/列访问步长对比 */
import type { LayoutState } from '@engine/kernels/layout.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function LayoutStage({ state }: StageProps<LayoutState>) {
  const { layout, rows, cols, A, mem, cur, rowStride, colStride, phase } = state
  const done = phase === 'done'
  //  颜色：row-major 按行分色、col-major 按列分色（凸显"谁连续"）
  const tint = (i: number, j: number) => layout === 'row-major'
    ? `color-mix(in srgb, var(--f-idx) ${12 + i * 22}%, var(--panel))`
    : `color-mix(in srgb, var(--f-tag) ${12 + j * 22}%, var(--panel))`
  return (
    <div className="card">
      <h3>张量布局 <span className="hint">二维矩阵怎么摊平进一维内存 · {layout}</span></h3>
      <div className="body">
        {/* 矩阵 */}
        <div className="lymwrap">
          <span className="lylab">矩阵 A [{rows}×{cols}]</span>
          <div className="lymat" style={{ gridTemplateColumns: `repeat(${cols}, 34px)` }}>
            {A.map((row, i) => row.map((v, j) => (
              <div key={`${i}-${j}`} className={`lycell ${cur && cur.i === i && cur.j === j ? 'cur' : ''}`}
                style={{ background: tint(i, j) }}>{v}<span className="lyij">[{i},{j}]</span></div>
            )))}
          </div>
        </div>

        {/* 1D 内存 */}
        <div className="lymemwrap">
          <span className="lylab">一维内存（按 {layout} 顺序）</span>
          <div className="lymem">
            {mem.map((m, addr) => (
              <div key={addr} className={`lymemc ${m === null ? 'pend' : ''} ${cur && cur.addr === addr ? 'cur' : ''}`}
                style={{ background: m ? tint(m.i, m.j) : undefined }}>
                <span className="lyaddr">@{addr}</span>
                <span className="lyv">{m === null ? '·' : m.v}</span>
                <span className="lyij2">{m === null ? '' : `[${m.i},${m.j}]`}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 步长对比 */}
        <div className="lystride">
          <div className={`lyst ${rowStride === 1 ? 'fast' : 'slow'}`}><span className="lystk">扫一行</span><span className="lystv">步长 {rowStride}</span><span className="lystn">{rowStride === 1 ? '连续 · 快' : '跳着 · 慢'}</span></div>
          <div className={`lyst ${colStride === 1 ? 'fast' : 'slow'}`}><span className="lystk">扫一列</span><span className="lystv">步长 {colStride}</span><span className="lystn">{colStride === 1 ? '连续 · 快' : '跳着 · 慢'}</span></div>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
