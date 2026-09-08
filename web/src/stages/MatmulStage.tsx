/**
 * 舞台：矩阵乘 C = A·B
 *   · 「2×3 · 3×2」那一档：原来那张 A/B/C 三宫格 + 点积展开，逐格可手核（一个字没改）；
 *   · 16/32/64 那几档：换成**访存视图** —— 三种循环顺序的缺失对比条 + 本档的缺失曲线。
 *
 * 2026-09-08 补厚时分的家。原来的三宫格给每个元素画一个格子，
 * 64×64 就是 3×4096 = 一万两千个节点，每帧重画一次 —— 又卡又读不出东西。
 * 而大矩阵那几档真正要看的也不是那些数字，是**同样的浮点数、差一个数量级的缺失**。
 */
import type { MatmulState } from '@engine/kernels/matmul.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function MatmulStage({ state }: StageProps<MatmulState>) {
  const { A, B, C, M, K, N, row, col, terms, value, flops, totalFlops, phase,
    small, order, tile, cacheTag, cacheCap, miss, totalMiss, hitRate, fitsInCache, compare, intensity } = state
  const done = phase === 'done'
  const cur = (i: number, j: number) => !done && i === row && j === col
  const worst = Math.max(...compare.map(c => c[1]), 1)
  const doneCells = C.reduce((a, r) => a + r.filter(v => v !== null).length, 0)

  return (
    <div className="card">
      <h3>矩阵乘法 C = A·B <span className="hint">{small ? '每格 = A 一行 · B 一列' : '同样的浮点数，差一个数量级的访存'}</span></h3>
      <div className="body">
        {small ? (
          <>
            <div className="mmlayout">
              <div className="mmcorner">A[{M}×{K}]<br />·B[{K}×{N}]</div>
              <div className="mmB" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
                {B.map((brow, k) => brow.map((v, j) => (
                  <div key={`${k}-${j}`} className={`mmcell b ${!done && j === col ? 'colhi' : ''}`}>{v}</div>
                )))}
              </div>
              <div className="mmA" style={{ gridTemplateColumns: `repeat(${K}, 1fr)` }}>
                {A.map((arow, i) => arow.map((v, k) => (
                  <div key={`${i}-${k}`} className={`mmcell a ${!done && i === row ? 'rowhi' : ''}`}>{v}</div>
                )))}
              </div>
              <div className="mmC" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
                {C.map((crow, i) => crow.map((v, j) => (
                  <div key={`${i}-${j}`} className={`mmcell c ${v === null ? 'pend' : ''} ${cur(i, j) ? 'cur' : ''}`}>
                    {v === null ? '·' : v}
                  </div>
                )))}
              </div>
            </div>

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
            <div className="mmflops">
              <div className="mmftrack"><div className="mmffill" style={{ width: `${(flops / totalFlops) * 100}%` }} /></div>
              <span className="mmflab">浮点运算 {flops} / {totalFlops}（= 2·M·N·K）</span>
            </div>
            {done && (
              <p className="scnote">{M}×{K} · {K}×{N} = {M}×{N}，每格是一行点一列，共 <b>{totalFlops}</b> 次浮点（2·M·N·K）。
                　这一档是给手核用的。<b>矩阵乘真正的难处不在算术</b> —— 把「矩阵规模」拧到 32×32 或 64×64 再看：
                同样的浮点数，换个循环顺序，缓存缺失能差一个数量级。</p>
            )}
          </>
        ) : (
          <>
            <div className="scdim">
              <div className="scdk"><span className="scdn">{totalFlops.toLocaleString()}</span><span className="scdl">浮点运算（三种顺序一样）</span></div>
              <div className="scdk"><span className={`scdn ${hitRate > 90 ? 'hot' : ''}`}>{miss.toLocaleString()}</span><span className="scdl">缓存缺失（本档 · 累计）</span></div>
              <div className="scdk"><span className="scdn">{hitRate}%</span><span className="scdl">命中率</span></div>
              <div className="scdk"><span className="scdn">{intensity}</span><span className="scdl">算术强度（浮点/缺失）</span></div>
            </div>

            {/*  这一屏的题眼：同一个乘法、三种顺序，浮点一样多，缺失差一个数量级 */}
            <div className="mmcmp">
              <span className="mmct">同一个乘法，三种循环顺序的缓存缺失（缓存 {cacheTag}，共 {cacheCap} 个元素）</span>
              {compare.map(([o, m]) => (
                <span key={o} className={`mmcbar ${o === order ? 'on' : ''} ${m === Math.min(...compare.map(c => c[1])) ? 'best' : ''}`}>
                  <b>{o}</b>
                  <i style={{ width: `${Math.max(2, m / worst * 100)}%` }} />
                  <em>{m.toLocaleString()}</em>
                </span>
              ))}
              <span className="mmcfn">
                浮点运算三者<b>完全相同</b>（{totalFlops.toLocaleString()} 次）——
                {fitsInCache
                  ? ` 但这一档 ${M * K + K * N + M * N} 个元素整个塞得进缓存，所以拉不开差距。把规模拧大再看。`
                  : ` 差别全在"下一个要读的数在不在缓存里"。`}
              </span>
            </div>

            <div className="mmprog">
              <div className="mmftrack"><div className="mmffill" style={{ width: `${(flops / totalFlops) * 100}%` }} /></div>
              <span className="mmflab">
                已走完访存流的 {Math.round(flops / totalFlops * 100)}%；
                已结清 <b>{doneCells}</b> / {M * N} 个输出格
                {!order.startsWith('i-j-k') && doneCells < M * N * 0.5 && flops > totalFlops * 0.5
                  ? '（这个顺序把每格的 K 项拆散在各处累加，输出格要到很后面才批量完成 —— 中途是空的很正常）' : ''}
              </span>
            </div>

            {done && (
              <p className="scnote">
                {M}×{K} · {K}×{N}：共 <b>{totalFlops.toLocaleString()}</b> 次浮点，<b>这个数跟循环顺序无关</b>。
                可缓存缺失从 <b>{Math.min(...compare.map(c => c[1])).toLocaleString()}</b> 到
                <b> {worst.toLocaleString()}</b> —— 差 <b>{(worst / Math.max(1, Math.min(...compare.map(c => c[1])))).toFixed(1)} 倍</b>，
                而<b>一次浮点都没省</b>。
                {fitsInCache
                  ? <>　不过这一档整个塞得进缓存，三者拉不开。<b>放得下的时候怎么循环都无所谓</b> ——
                    这正说明分块不是玄学，是<b>放不下</b>才需要的。把规模拧大再看。</>
                  : <>　道理只有一句：行优先存储里 B[k][j] <b>沿 j 是连着的、沿 k 是跳着的</b>。
                    教科书那个 i-j-k 的最内层恰好在沿 k 跳 B，每次跨一整行；i-k-j 把它换成沿 j 连着走；
                    分块再进一步，让<b>三块 {tile}×{tile} 的小方阵同时待在缓存里</b>
                    （块边长是算出来的：3T² ≤ {cacheCap}）。</>}
                　FlashAttention 在做的、张量并行切矩阵时要小心的，都是这件事：<b>不改结果，只改访存</b>。
              </p>
            )}
          </>
        )}

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
