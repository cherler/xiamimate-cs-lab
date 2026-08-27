/** 舞台：中国剩余定理 —— 从几个余数条件拼出唯一 x */
import type { CRTState } from '@engine/kernels/crt.ts'
import type { StageProps } from '../types.ts'

export function CRTStage({ state }: StageProps<CRTState>) {
  const { ns, as, N, idx, Ni, yi, term, acc, x, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>中国剩余定理 <span className="hint">除 3 余 2、除 5 余 3、除 7 余 2 的数是几</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">N={N}</span><span className="scdl">总模</span></div>
          <div className="scdk"><span className="scdn">{acc}</span><span className="scdl">累加和</span></div>
          <div className="scdk"><span className={`scdn ${x >= 0 ? 'ok' : ''}`}>{x >= 0 ? x : '?'}</span><span className="scdl">解 x</span></div>
        </div>
        <div className="cx-kv">
          {ns.map((n, k) => (
            <div key={k} className={`cx-box ${idx === k ? 'hot' : ''}`}><span className="cx-bk">x mod {n}</span><span className="cx-bv">= {as[k]}</span></div>
          ))}
          <div className={`cx-box ${x >= 0 ? 'ok' : ''}`}><span className="cx-bk">解 x</span><span className="cx-bv">{x >= 0 ? x : '?'}</span></div>
        </div>
        {idx >= 0 && !done && <div className="cx-calc">第{idx + 1}条：N{idx}=N/{ns[idx]}=<b>{Ni}</b>，逆 y=<b>{yi}</b>，贡献 {as[idx]}×{Ni}×{yi}=<b className="cx-out">{term}</b></div>}
        {done
          ? <p className="scnote">唯一解 x = <b>{x}</b>：{x}÷3余{x % 3}、÷5余{x % 5}、÷7余{x % 7}，全对。只要模两两互质，这组同余式在 0..{N - 1} 内有唯一解。<b>RSA 解密</b>用它拆成模 p、模 q 两个小幂，快 3~4 倍。</p>
          : <p className="scnote" style={{ opacity: .85 }}>对每个条件算 N_i=N/n_i、它模 n_i 的逆 y_i，则 x = Σ a_i·N_i·y_i mod N。每一项只在自己那个模下"生效"、对别的模贡献 0。</p>}
      </div>
    </div>
  )
}
