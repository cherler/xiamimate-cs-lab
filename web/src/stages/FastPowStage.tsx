/**
 * 舞台：快速幂 —— 指数拆二进制，反复平方得 a^(2^k)，某位是 1 就把它乘进结果。
 *
 * ⚠️ 老版本在这里**自己重算** `a ** (2 ** kk)` 来显示每一列的幂值。
 * 2026-09-09 补厚把指数放开到 1000 之后，`3 ** 512` 直接是 **Infinity**，
 * 整排列会印满 Infinity。而且那是**第二份实现** —— 屏幕上显示的数
 * 跟内核真正算的数可以悄悄不一样。现在一律读内核给的字段。
 *
 * 补厚后这一屏的落点是**下面那块对照**：Number 算出来的 vs BigInt 独立算出来的真值。
 * 「算出来了」和「算对了」是两件事。
 */
import type { FastPowState } from '@engine/kernels/fastpow.ts'
import type { StageProps } from '../types.ts'

const SAFE = Number.MAX_SAFE_INTEGER

export function FastPowStage({ state }: StageProps<FastPowState>) {
  const {
    a, n, op, bitsMSB, k, result, mults, squares, picked, act, phase,
    powK, mat, resMat, totalOps, naiveOps, truth, got, exact, maxInter, overflowed, scale,
  } = state
  const done = phase === 'done'
  const nbits = bitsMSB.length
  const isMatrix = op.startsWith('矩阵')
  const short = (s: string) => (s.length > 34 ? `${s.slice(0, 16)}…${s.slice(-12)}（${s.length} 位）` : s)

  return (
    <div className="card">
      <h3>快速幂 <span className="hint">指数拆二进制：反复平方 + 挑位相乘</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{isMatrix ? `F(${n})` : `${a}^${n}`}</span><span className="scdl">要算的</span></div>
          <div className="scdk">
            <span className="scdn">{totalOps} / {naiveOps}</span>
            <span className="scdl">乘法次数 / 朴素要几次</span>
          </div>
          {/*  ⭐ 补厚的落点：「算出来了」和「算对了」是两件事 */}
          <div className="scdk">
            <span className={`scdn ${done ? (exact ? 'good' : 'bad') : ''}`}>{done ? (exact ? '对得上' : '对不上') : '—'}</span>
            <span className="scdl">跟 BigInt 真值逐位比</span>
          </div>
          <div className="scdk">
            <span className={`scdn ${overflowed ? 'bad' : ''}`}>{maxInter === Infinity ? '∞' : maxInter.toExponential(2)}</span>
            <span className="scdl">最大中间量（2⁵³≈{SAFE.toExponential(1)}）</span>
          </div>
        </div>

        <div className="fpwrap">
          <div className="fpidentity">
            {n} = {bitsMSB.join('')}<sub>2</sub> = {bitsMSB.map((b, j) => b ? 2 ** (nbits - 1 - j) : null).filter(x => x != null).join(' + ')}
          </div>

          <div className="fprow">
            {bitsMSB.map((b, j) => {
              const kk = nbits - 1 - j
              const isCur = kk === k && !done
              const isPicked = b === 1 && picked.includes(2 ** kk)
              const cls = ['fpbit', b === 1 ? 'one' : 'zero', isCur ? 'cur' : '', isPicked ? 'picked' : ''].filter(Boolean).join(' ')
              return (
                <div key={j} className={cls}>
                  <span className="fpb">{b}</span>
                  <span className="fpplace">位 {kk} · 值 {2 ** kk}</span>
                  {/*  只在当前列印真实的平方幂 —— 别再自己重算（会 Infinity，而且是第二份实现） */}
                  <span className="fppow">{isCur ? (isMatrix ? `矩阵 ${mat[0]}…` : `${powK}`) : '—'}</span>
                  <span className="fptake">{b === 1 ? (isPicked ? '✓ 乘入' : '待乘') : '— 跳过'}</span>
                </div>
              )
            })}
          </div>

          <div className="fpresult">
            {isMatrix
              ? <>结果矩阵右上角（也就是 F 那一项） = <b>{resMat[1]}</b></>
              : <>结果 = {picked.length === 0 ? '1' : `${a}^(${picked.join('+')})`} = <b>{Number.isFinite(result) ? result : 'Infinity'}</b></>}
          </div>

          <div className="orcap">
            {act === '' ? `按「下一步」开始：把指数 ${n} 拆成二进制，逐位处理。运算用「${op}」`
              : act === 'done' ? `只用了 ${mults} 次挑位相乘 + ${squares} 次平方 = ${totalOps} 次，朴素要 ${naiveOps} 次`
                : act === 'mul' ? `第 ${k} 位 = 1 → 把当前平方幂乘进结果`
                  : `第 ${k} 位 = 0 → 跳过，结果不变（但仍要平方一次，为高位备好）`}
          </div>
        </div>

        {/*  ⭐ 得到 vs 真值：整个补厚的落点 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead"><span>来源</span><span>结果</span><span></span><span></span><span></span></div>
            <div className="qsrow">
              <span>这一趟算的</span>
              <span className={exact ? '' : 'bad'} style={{ textAlign: 'left', gridColumn: 'span 4' }}>{short(got)}</span>
            </div>
            <div className="qsrow">
              <span>BigInt 真值</span>
              <span className="dimv" style={{ textAlign: 'left', gridColumn: 'span 4' }}>{short(truth)}</span>
            </div>
            <div className="orcap">
              {exact
                ? <>两者<b className="good">逐位相同</b> ✓</>
                : <>⚠️ <b className="bad">不是同一个数</b> —— 最大中间量到过 {maxInter === Infinity ? '∞' : maxInter.toExponential(3)}，
                  超过了 2⁵³ ≈ {SAFE.toExponential(3)}，之后每一次乘法都在悄悄丢低位，<b>一句错都不报</b>。</>}
            </div>
          </div>
        )}

        {/*  规模表：乘法次数 vs 朴素 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead"><span>指数 n</span><span>快速幂乘法次数</span><span>朴素要几次</span><span>省了几倍</span><span></span></div>
            {scale.map(r => (
              <div className="qsrow" key={r.n}>
                <span>{r.n}{r.n === n ? ' ◀' : ''}</span>
                <span className="good">{r.ops}</span>
                <span className="dimv">{r.naive}</span>
                <span>{(r.naive / Math.max(1, r.ops)).toFixed(1)}×</span>
                <span />
              </div>
            ))}
            <div className="orcap">乘法次数只跟 <b>log₂n</b> 走，所以 n 越大省得越多。n=10⁹ 也就 ~45 次。</div>
          </div>
        )}

        {done
          ? <p className="scnote">
            把指数写成<b>二进制</b>，幂就拆成几个"反复平方"得来的幂相乘 —— <b>O(log n)</b> 而非 O(n)。
            <br />
            {/*  ⚠️ 这段话得**按当前档说**。原来一律印「{a}^{n} 有 {truth.length} 位，任何定宽整数都装不下」——
                 而取了模之后 truth 只有 9 位，屏幕上就成了"9 位装不下"，**自相矛盾**。 */}
            {op.startsWith('整数')
              ? <><b>但这一屏真正要说的是下一句：不取模的快速幂在真实场景里根本用不了。</b>
                {a}^{n} 有 <b>{truth.length}</b> 位，任何定宽整数都装不下；RSA 里的指数是几百上千位。
                <b>所以现实中永远是"模幂"，不是"幂"。</b></>
              : isMatrix
                ? <><b>而这一档换掉的只是"乘法"两个字</b> —— 骨架一动没动，就 O(log n) 求出了 F({n})。
                  <b>快速幂要的只是"可结合"</b>，跟被乘的是不是数没关系。</>
                : <><b>取模把结果压回了 {truth.length} 位</b>，这才是真实场景里的用法（RSA 的加解密就是 mᵉ mod n）——
                  而不取模的话 {a}^{n} 有几十上百位，任何定宽整数都装不下。</>}
            <br />
            ⚠️ <b>而取了模也不够</b>：取模治的是<b>结果</b>太大，治不了<b>中间量</b>太大 ——
            两个 10⁹ 量级的数相乘就是 10¹⁸，而 2⁵³ ≈ 9×10¹⁵，
            <b>在取模之前那一次乘法就已经丢精度了</b>。这一环最容易被漏掉。
            四个「运算」档挨个走一遍，就把这三级看全了。
          </p>
          : <p className="scnote" style={{ opacity: .85 }}>
            每一位对应一个"反复平方"得来的幂（琥珀=当前位）。这位是 <b>1</b> 就把该幂乘进结果（绿✓）、是 <b>0</b> 就跳过。
            log₂{n}≈{Math.ceil(Math.log2(n))} 步，不是老实乘 {n} 次。
            <b>盯着读数里的「最大中间量」</b>：它一旦越过 2⁵³，后面的数就全是错的，而屏幕上不会有任何提示。
          </p>}
      </div>
    </div>
  )
}
