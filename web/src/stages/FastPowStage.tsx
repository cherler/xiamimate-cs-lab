/** 舞台：快速幂 —— 指数拆二进制，base 反复平方得 a^(2^k)，某位是1就把它乘进结果，O(log n) */
import type { FastPowState } from '@engine/kernels/fastpow.ts'
import type { StageProps } from '../types.ts'

export function FastPowStage({ state }: StageProps<FastPowState>) {
  const { a, n, bitsMSB, k, result, mults, squares, picked, act, phase } = state
  const done = phase === 'done'
  const nbits = bitsMSB.length
  return (
    <div className="card">
      <h3>快速幂 <span className="hint">指数拆二进制：反复平方 + 挑位相乘</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{a}^{n}</span><span className="scdl">要算的幂</span></div>
          <div className="scdk"><span className="scdn">{result}</span><span className="scdl">当前结果</span></div>
          <div className="scdk"><span className="scdn">{mults}+{squares}</span><span className="scdl">乘+平方 次数</span></div>
        </div>

        <div className="fpwrap">
          <div className="fpidentity">
            {n} = {bitsMSB.join('')}<sub>2</sub> = {bitsMSB.map((b, j) => b ? 2 ** (nbits - 1 - j) : null).filter(x => x != null).join(' + ')}
            <span className="fparrow"> ⟹ </span>
            {a}<sup>{n}</sup> = {bitsMSB.map((b, j) => b ? `${a}^${2 ** (nbits - 1 - j)}` : null).filter(Boolean).join(' · ')}
          </div>

          <div className="fprow">
            {bitsMSB.map((b, j) => {
              const kk = nbits - 1 - j          // 该列的位序（LSB=0）
              const powK = a ** (2 ** kk)
              const isCur = kk === k && !done
              const isPicked = b === 1 && picked.includes(2 ** kk)
              const cls = ['fpbit', b === 1 ? 'one' : 'zero', isCur ? 'cur' : '', isPicked ? 'picked' : ''].filter(Boolean).join(' ')
              return (
                <div key={j} className={cls}>
                  <span className="fpb">{b}</span>
                  <span className="fpplace">位 {kk} · 值 {2 ** kk}</span>
                  <span className="fppow">{a}<sup>{2 ** kk}</sup>={powK}</span>
                  <span className="fptake">{b === 1 ? (isPicked ? '✓ 乘入' : '待乘') : '— 跳过'}</span>
                </div>
              )
            })}
          </div>

          <div className="fpresult">
            结果 = {picked.length === 0 ? '1' : picked.map(e => `${a}^${e}`).join(' · ')}
            {picked.length > 0 && <span className="fpeq"> = {picked.map(e => a ** e).join(' · ')} = <b>{result}</b></span>}
          </div>

          <div className="orcap">
            {act === '' ? `按「下一步」开始:算 ${a}^${n},把指数 ${n} 拆成二进制,逐位处理`
              : act === 'done' ? `${a}^${n} = ${a}^(${picked.join('+')}) = ${result}——只用 ${mults} 乘 + ${squares} 平方,朴素要 ${n} 次`
                : act === 'mul' ? `第 ${k} 位=1 → 把 ${a}^${2 ** k}=${a ** (2 ** k)} 乘进结果 = ${result}`
                  : `第 ${k} 位=0 → 跳过,结果不变(base 仍在平方,为高位备好)`}
          </div>
        </div>

        {done
          ? <p className="scnote">把指数写成<b>二进制</b>({n}={bitsMSB.join('')}₂={picked.join('+')}),幂就拆成 <b>{a}^{n}={picked.map(e => `${a}^${e}`).join('·')}</b>。而 {a}¹,{a}²,{a}⁴,{a}⁸ 这些幂每个由上一个<b>平方</b>得来(只需 log n 次平方),再挑二进制是 1 的位把对应幂乘起来——<b>O(log n)</b> 而非 O(n),n=10⁹ 也就 ~30 步。<b>模幂</b>(RSA 加解密)、<b>矩阵快速幂</b>(O(log n) 求斐波那契等线性递推)都是它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>把 {a}^{n} 的指数 {n} 拆成二进制。每一位对应一个"反复平方"得来的幂 {a}^(2^k)(琥珀=当前位)。这位是 <b>1</b> 就把该幂乘进结果(绿✓)、是 <b>0</b> 就跳过。log₂{n}≈{Math.ceil(Math.log2(n))} 步,不是老实乘 {n} 次。</p>}
      </div>
    </div>
  )
}
