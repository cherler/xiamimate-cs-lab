/**
 * 舞台：反向传播
 *   · depth=1 —— 还是原来那张计算图（w、x、b → z → a → L），梯度逐站标在节点下；
 *   · depth>1 —— 换成**逐层视图**：每层一根柱子，柱高 = 该层权重梯度的量级（对数），
 *     梯度消失长什么样，就是这排柱子从右到左一路矮下去、矮到看不见。
 *
 * 2026-09-08 补厚时加的。一个神经元讲得清链式法则，但讲不了反向传播真正的分量：
 * **梯度回传是一长串数连乘，链一长要么塌成 0、要么炸上天**。那件事只能靠深度演。
 */
import type { BackpropState } from '@engine/kernels/backprop.ts'
import type { StageProps } from '../types.ts'

export function BackpropStage({ state }: StageProps<BackpropState>) {
  const { phase, x, w, b, t, z, a, loss, gLda, gLdz, gLdw, gLdb, stage,
    depth, act, actNote, fpCap, as, zs, gW, gwAll, layerFactor, chain, ratio, vanish, explode, backAt } = state
  const back = phase === 'back' || phase === 'done'
  const deep = depth > 1

  const Node = ({ nx, ny, label, val, grad }: { nx: number; ny: number; label: string; val: number; grad: number | null }) => (
    <g>
      <rect x={nx - 11} y={ny - 8} width="22" height="16" rx="3" className="bpnode" />
      <text x={nx} y={ny - 1.5} textAnchor="middle" className="bplabel">{label}</text>
      <text x={nx} y={ny + 5} textAnchor="middle" className="bpval">{val}</text>
      {grad !== null && grad !== undefined && (
        <text x={nx} y={ny + 15} textAnchor="middle" className="bpgrad">∂L={grad}</text>
      )}
    </g>
  )

  /*  柱高用**对数**：梯度跨了七八个数量级，线性刻度只会画出"一根柱子 + 一排看不见的"。
      以最大的那层为 0dB，往下每掉一个数量级降一截。 */
  const mags = gwAll.map(v => Math.abs(v))
  const top = Math.max(...mags, 1e-30)
  const DECADES = 8
  const barH = (v: number) => {
    if (v <= 0) return 0
    const dec = Math.log10(v / top)          // ≤ 0
    return Math.max(0, Math.min(1, 1 + dec / DECADES)) * 100
  }
  const fmt = (v: number) => (Math.abs(v) >= 1e-3 ? v.toFixed(4) : v.toExponential(1))

  return (
    <div className="card">
      <h3>反向传播 <span className="hint">{deep ? '链一长，梯度要么塌成 0，要么炸上天' : '链式法则把"误差"逐层回传成每个权重的梯度'}</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{phase === 'forward' ? '前向' : phase === 'done' ? '完成' : '反向'}</span><span className="scdl">当前趟</span></div>
          <div className="scdk"><span className="scdn hot">{loss}</span><span className="scdl">损失 L</span></div>
          {deep
            ? <>
              <div className="scdk"><span className="scdn">{depth} 层 · {act}</span><span className="scdl">链长 · 每站的 f′ ≤ {fpCap}</span></div>
              <div className="scdk"><span className={`scdn ${vanish || explode ? '' : 'hot'}`}>
                {chain < 1e-3 || chain > 1e3 ? chain.toExponential(1) : chain}×</span>
                <span className="scdl">回传信号穿过整条链后</span></div>
            </>
            : <div className="scdk"><span className="scdn">{stage || '—'}</span><span className="scdl">回传到</span></div>}
        </div>

        {deep && phase === 'done' && (vanish || explode) && (
          <div className={`bpWarn ${explode ? 'boom' : ''}`}>
            {explode ? '💥' : '🫥'} <b>梯度{explode ? '爆炸' : '消失'}</b>：
            回传信号穿过 {depth} 层之后变成了 <b>{chain < 1e-3 ? chain.toExponential(1) : chain}</b> 倍
            —— 每层要乘 |w·f′|，这条链上大约是 {layerFactor[1] ?? layerFactor[0]}，{depth - 1} 次连乘就是这个数。
            {explode
              ? ' 一步更新就能把权重掀翻、损失变 NaN。'
              : ' 最前面几层几乎收不到任何更新信号 —— 深层网络卡了二十年，卡的就是这个。'}
          </div>
        )}

        {deep ? (
          <div className="bpwrap">
            {/*  逐层柱状图：柱高=该层权重梯度的量级（对数）。梯度消失就是这排柱子一路矮下去 */}
            <div className="bplayers">
              {gwAll.map((g, l) => {
                const known = gW[l] !== null && gW[l] !== undefined
                return (
                  <div key={l} className={`bpcol ${known ? 'on' : ''} ${l === backAt ? 'now' : ''}`}>
                    <span className="bpbarv">{known ? fmt(g) : ''}</span>
                    <span className="bpbarwrap">
                      <i className="bpbar" style={{ height: `${known ? barH(mags[l]) : 0}%` }} />
                    </span>
                    <span className="bpbarl">第 {l + 1} 层</span>
                    {l > 0 && <span className="bpfac">×{layerFactor[l]}</span>}
                  </div>
                )
              })}
            </div>
            <div className="orcap">
              {phase === 'forward'
                ? `前向逐层算：a${state.fwdAt + 1}=${act}(z)=${as[Math.max(0, state.fwdAt)]}，一路算到损失`
                : `柱高 = 该层权重梯度的量级（对数刻度，每格一个数量级）；`
                  + `柱子之间那个 ×${layerFactor[1] ?? layerFactor[0]} 就是往上传一层要乘的 |w·f′|`}
            </div>
          </div>
        ) : (
          <div className="bpwrap">
            <svg className="bpplot" viewBox="0 0 100 56" preserveAspectRatio="xMidYMid meet">
              <g className="bpedge">
                <line x1="19" y1="14" x2="31" y2="28" /><line x1="19" y1="28" x2="31" y2="28" /><line x1="19" y1="42" x2="31" y2="28" />
                <line x1="49" y1="28" x2="61" y2="28" /><line x1="73" y1="28" x2="85" y2="28" />
              </g>
              {back && <path d="M92 48 L10 48" className="bpback" markerEnd="url(#bp-a)" />}
              <defs><marker id="bp-a" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 L5 3 L0 6" fill="var(--miss)" /></marker></defs>
              {back && <text x="50" y="46" textAnchor="middle" className="bpbacklab">梯度回传方向</text>}
              <Node nx={12} ny={14} label="w" val={w} grad={back ? gLdw : null} />
              <Node nx={12} ny={28} label="x" val={x} grad={null} />
              <Node nx={12} ny={42} label="b" val={b} grad={back ? gLdb : null} />
              <Node nx={40} ny={28} label="z=wx+b" val={z} grad={gLdz} />
              <Node nx={66} ny={28} label={`a=${act}(z)`} val={a} grad={gLda} />
              <Node nx={90} ny={28} label={`L(t=${t})`} val={loss} grad={back ? 1 : null} />
            </svg>
            <div className="orcap">
              {phase === 'forward' ? '前向：数据 w,x,b → z → a → L，一路算到损失'
                : phase === 'done' ? '反向完成：每个权重的梯度都算出来了（∂L 标在节点下）'
                  : `反向：${stage} —— 下游梯度 × 本站局部导数 = 上游梯度`}
            </div>
          </div>
        )}

        {phase === 'done'
          ? (!deep
            ? <p className="scnote">一次反向传播，把 L 对每个权重的梯度全算出来：dL/dw=<b>{gLdw}</b>、dL/db=<b>{gLdb}</b>。
              核心就一句：<b>下游梯度 × 本站局部导数 = 上游梯度</b>。一趟就出全部梯度、和参数量成正比 ——
              这就是深度学习能训上亿参数的<b>发动机</b>。
              　现在把「层数」拧到 4 或 8：<b>同一条链式法则会演出一件完全不同的事</b>。</p>
            : vanish
              ? <p className="scnote"><b>梯度消失了。</b>第 1 层的权重梯度 <b>{fmt(gwAll[0])}</b>，
                最后一层还有 <b>{fmt(gwAll[depth - 1])}</b>；回传信号穿过整条链只剩 <b>{chain.toExponential(1)}</b> 倍。
                　原因全在那串连乘：每往上一层乘 |w·f′|≈{layerFactor[1]}，{depth - 1} 次连乘就是这个数。
                {act === 'sigmoid' && <>　而 sigmoid 的 <b>f′=a(1−a) 最大只有 0.25</b> —— 哪怕 w 取到 4，w·f′ 也才勉强够到 1。
                  这不是"调参没调好"，是这个激活函数<b>自带</b>的天花板。</>}
                　后果不是训练慢一点，是<b>最前面几层几乎收不到任何更新信号</b>：网络名义上有 {depth} 层，
                实际在学的只有靠近输出的那几层。深层网络从 1990 年代卡到 2010 年代，卡的就是这个。
                　把激活换成 <b>ReLU</b> 再看同样的层数 —— f′ 在正半轴恒等于 1，这一项就不缩了。</p>
              : explode
                ? <p className="scnote"><b>梯度爆炸了。</b>回传信号穿过 {depth} 层被放大了 <b>{chain}</b> 倍，
                  末层权重梯度已经到 <b>{fmt(gwAll[depth - 1])}</b> —— 一步更新就能把权重掀翻、损失变 NaN。
                  　⚠️ 注意柱状图上<b>首末两层差不多高</b>（比 {ratio}）：dL/dw 还要乘这一层的输入 a，
                  而 a 正沿着同一个 w 同步放大，两头几乎抵消。<b>所以判断塌没塌、炸没炸，要看回传信号 Π|w·f′|，
                  不能看首末权重梯度之比</b> —— 这两个数在这一档上会给出相反的结论。
                  　实践里的解法是<b>梯度裁剪</b>和更谨慎的初始化，跟梯度消失是同一根链条的两端。</p>
                : <p className="scnote">{depth} 层的链，一趟反向就把每层的梯度全算出来了；
                  回传信号穿过整条链后是 <b>{chain}</b> 倍 —— 这一档<b>既没塌也没炸</b>，
                  每层乘的 |w·f′| 大约 {layerFactor[1]}，还算贴着 1。
                  　这正是 Xavier / He 这些初始化方法刻意追求的状态：<b>让每层的缩放因子尽量接近 1</b>。
                  　{actNote.replace(/\*\*/g, '')}。</p>)
          : <p className="scnote" style={{ opacity: .85 }}>
            {phase === 'forward'
              ? deep ? `先前向逐层算到损失 L（这一步 z=${zs[Math.max(0, state.fwdAt)]}、a=${as[Math.max(0, state.fwdAt)]}）。走完再从 L 出发往回传。`
                : '先前向：把输入一路算到损失 L。下一步开始反向，从 L 出发往回传梯度。'
              : `每站只管自己那点局部导数（${act} 这站是 f′），链式法则一乘就把梯度接着往上游传。`
                + (deep ? `　盯住柱子：每往左一根，就多乘一次 |w·f′|。` : '')}
          </p>}
      </div>
    </div>
  )
}
