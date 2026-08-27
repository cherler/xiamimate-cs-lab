/** 舞台：矩阵乘 —— A·B→C 经典布局，当前格高亮 + 一行点一列的点积展开 + FLOPs */
import type { MatmulState } from '@engine/kernels/matmul.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function MatmulStage({ state }: StageProps<MatmulState>) {
  const { A, B, C, M, K, N, row, col, terms, value, flops, totalFlops, phase } = state
  const done = phase === 'done'
  const cur = (i: number, j: number) => !done && i === row && j === col
  return (
    <div className="card">
      <h3>矩阵乘法 C = A·B <span className="hint">每格 = A 一行 · B 一列</span></h3>
      <div className="body">
        <div className="mmlayout">
          {/* 左上留白 */}
          <div className="mmcorner">A[{M}×{K}]<br/>·B[{K}×{N}]</div>
          {/* B 在右上 */}
          <div className="mmB" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
            {B.map((brow, k) => brow.map((v, j) => (
              <div key={`${k}-${j}`} className={`mmcell b ${!done && j === col ? 'colhi' : ''}`}>{v}</div>
            )))}
          </div>
          {/* A 在左下 */}
          <div className="mmA" style={{ gridTemplateColumns: `repeat(${K}, 1fr)` }}>
            {A.map((arow, i) => arow.map((v, k) => (
              <div key={`${i}-${k}`} className={`mmcell a ${!done && i === row ? 'rowhi' : ''}`}>{v}</div>
            )))}
          </div>
          {/* C 在右下 */}
          <div className="mmC" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
            {C.map((crow, i) => crow.map((v, j) => (
              <div key={`${i}-${j}`} className={`mmcell c ${v === null ? 'pend' : ''} ${cur(i, j) ? 'cur' : ''}`}>
                {v === null ? '·' : v}
              </div>
            )))}
          </div>
        </div>

        {/* 点积展开 */}
        {!done && terms.length > 0 && (
          <div className="mmdot">
            <span className="mmdl">C[{row}][{col}] =</span>
            <span className="mmterms">
              {terms.map((t, k) => (
                <span key={k} className="mmterm">{t.a}×{t.b}{k < terms.length - 1 ? ' +' : ''}</span>
              ))}
            </span>
            <span className="mmeq">= <b>{value}</b></span>
          </div>
        )}

        {/* FLOPs */}
        <div className="mmflops">
          <div className="mmftrack"><div className="mmffill" style={{ width: `${(flops / totalFlops) * 100}%` }} /></div>
          <span className="mmflab">浮点运算 {flops} / {totalFlops}（= 2·M·N·K）</span>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
