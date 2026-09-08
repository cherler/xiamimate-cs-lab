/**
 * 舞台：RNN —— 展开成时间链；短序列画方格链，长序列画**影响力衰减曲线**
 *
 * 2026-09-08 补厚时分的家。短序列（4 步）还是原来那条方格链，逐格可手核。
 * 但补厚补上的是 RNN 真正的软肋 ——「开头那个输入到此刻还剩多少影响」——
 * 那是个跨几十步、掉十几个数量级的量，**方格链根本画不下**（50 个格子也读不出东西）。
 * 长序列那两档换成一条 **log 纵轴的衰减曲线**：指数衰减在 log 轴上是条直线，
 * 斜率就是每步乘的那个 |wh·(1−h²)|。
 */
import type { RNNState } from '@engine/kernels/rnn.ts'
import type { StageProps } from '../types.ts'

const hcol = (h: number) => h >= 0
  ? `color-mix(in srgb, #3b82f6 ${Math.round(Math.abs(h) * 60)}%, var(--panel))`
  : `color-mix(in srgb, var(--now) ${Math.round(Math.abs(h) * 60)}%, var(--panel))`

export function RNNStage({ state }: StageProps<RNNState>) {
  const { xs, wx, wh, b, t, xt, hPrev, pre, ht, hs, phase,
    grad, grads, factor, halfLife, factorAsymp, short, compare } = state
  const done = phase === 'done'
  //  影响力跨十几个数量级，只能用 log 轴；下界按整条链的末值定，免得走一半跳刻度
  const known = grads.filter((g): g is number => g !== null && g !== 0).map(Math.abs)
  const gTop = known.length ? Math.max(...known) : 1
  const BOT = Math.floor(Math.log10(Math.min(...(known.length ? known : [1e-6])))) - 1
  const gy = (v: number) => {
    const d = Math.log10(Math.max(10 ** BOT, Math.abs(v)))
    return 100 - (d - BOT) / (Math.log10(gTop) - BOT) * 100
  }
  return (
    <div className="card">
      <h3>循环神经网络 RNN <span className="hint">一个隐藏状态沿时间流动，把"过去"记在里面</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? ht : t > 0 ? `h_${t}` : 'h'}</span><span className="scdl">{done ? '末态记忆' : '当前记忆'}</span></div>
          <div className="scdk"><span className="scdn">{done ? '—' : t > 0 ? ht : '—'}</span><span className="scdl">h 值</span></div>
          <div className="scdk"><span className="scdn">wx={wx} wh={wh}</span><span className="scdl">共享权重</span></div>
          {!short && <>
            {/*  这两栏才是补厚补上的东西：开头那个输入还剩多少影响、每步乘多少 */}
            <div className="scdk"><span className={`scdn ${Math.abs(grad) < 1e-3 ? '' : 'hot'}`}>{grad}</span>
              <span className="scdl">开头那个输入的影响力 ∂h/∂x₁</span></div>
            <div className="scdk"><span className="scdn">{factorAsymp}</span>
              <span className="scdl">每步乘 |wh·(1−h²)|（渐近）</span></div>
            <div className="scdk"><span className="scdn">{halfLife > 0 ? `${halfLife} 步` : '不衰减'}</span>
              <span className="scdl">记忆半衰期</span></div>
          </>}
        </div>

        {!short && (
          <div className="rnndecay">
            <span className="rndt">开头那个输入的影响力 ∂h_t/∂x₁（纵轴 log，每格一个数量级）</span>
            <svg className="rnplot" viewBox="0 0 100 60" preserveAspectRatio="none">
              {Array.from({ length: Math.max(2, Math.min(7, Math.ceil(Math.log10(gTop) - BOT))) }, (_, r) => {
                const d = Math.log10(gTop) - r * (Math.log10(gTop) - BOT) / 4
                return <line key={r} x1="0" y1={gy(10 ** d) * 0.6} x2="100" y2={gy(10 ** d) * 0.6} className="rnref" />
              })}
              <polyline className="rnline" fill="none" vectorEffect="non-scaling-stroke"
                points={grads.map((g, k) => (g === null ? null : `${k / Math.max(1, xs.length - 1) * 100},${(gy(g) * 0.6).toFixed(1)}`))
                  .filter(Boolean).join(' ')} />
            </svg>
            <span className="rndf">
              指数衰减在 log 轴上是条<b>直线</b>，斜率就是每步乘的 {factorAsymp}。
              {halfLife > 0 && <> 半衰期 <b>{halfLife}</b> 步 —— 再往前的东西，它基本记不住了。</>}
            </span>
          </div>
        )}

        <div className="rnnwrap">
          <div className="rnnchain">
            <div className="rnncol h0">
              <div className="rnnh" style={{ background: 'var(--panel)' }}>0</div>
              <div className="rnnlbl">h₀</div>
            </div>
            {(short ? xs : xs.slice(0, 12)).map((x, k) => {
              const hv = hs[k]
              const isCur = k + 1 === t && !done
              const filled = hv !== null
              return (
                <div key={k} className={`rnncol ${isCur ? 'cur' : ''}`}>
                  <div className="rnnarrow">→</div>
                  <div className={`rnnh ${filled ? 'on' : ''}`} style={filled ? { background: hcol(hv) } : undefined}>
                    {filled ? hv : '·'}
                  </div>
                  <div className="rnnlbl">h<sub>{k + 1}</sub></div>
                  <div className="rnnup">↑</div>
                  <div className={`rnnx ${isCur ? 'cur' : ''}`}>{x}</div>
                  <div className="rnnlbl2">x<sub>{k + 1}</sub></div>
                </div>
              )
            })}
          </div>

          <div className="orcap">
            {t === 0 && !done ? '按「下一步」开始：隐藏状态 h₀=0，逐个读入序列，每步更新记忆'
              : done ? (short ? `读完整段：记忆一路演化到末态 ${ht} —— 它浓缩了整个序列 [${xs.join(',')}]`
                : `读完 ${xs.length} 步（上面只画了前 12 步的链）`)
                : `第 ${t} 步：h_${t} = tanh(${wx}·${xt} + ${wh}·${hPrev} + ${b}) = tanh(${pre}) = ${ht}`
                  + (short ? '' : `；影响力再乘 ${factor}`)}
          </div>
        </div>

        {done
          ? (short
            ? <p className="scnote">RNN 用一个<b>隐藏状态 h（记忆）沿时间传递</b>来处理变长序列：每读一个 x_t，
              就用<b>同一套共享权重</b>把"当前输入 + 上一刻记忆"揉进新记忆。权重<b>所有时刻共享</b>（能吃任意长序列），
              而 h_t <b>藏着全部过去</b> —— 同样的当前输入，历史不同，h 就不同。
              　但这条序列只有 4 步，看不出 RNN 真正的软肋。<b>把「序列」换成"开头一个脉冲之后全 0"</b> ——
              那时才看得见它到底记不记得住。</p>
            : <p className="scnote">走完 {xs.length} 步：开头那个输入的影响力掉到 <b>{grad}</b>，
              链稳下来之后<b>每步乘 {factorAsymp}</b>，半衰期 <b>{halfLife > 0 ? `${halfLife} 步` : '—'}</b>。
              　这跟「反向传播」那一屏是<b>同一件事</b>，只是连乘的方向换成了<b>时间</b>：每往前一步乘 |wh·(1−h²)|。
              　⚠️ 而<b>把 wh 调大救不回来，甚至更糟</b>：wh 一大，h 很快被推到饱和区，tanh′=1−h² 就趋近 0。
              实测三档 —— {compare.map(([w, hl]) => `wh=${w} 半衰期 ${hl > 0 ? `${hl} 步` : '不衰减'}`).join('、')}：
              <b>wh=1.5 比 wh=0.9 记得还短</b>。
              　<b>这不是调参能解决的问题，得换结构</b> —— LSTM 给记忆另开一条近乎线性的传送带
              （c_t = f·c_{'{'}t−1{'}'} + i·c̃，f≈1 时不衰减），再往后就是注意力：干脆让每一步<b>直接看</b>所有历史，
              不再逐级传递。</p>)
          : <p className="scnote" style={{ opacity: .85 }}>横着展开:上排是记忆 h 沿时间流动的<b>传送带</b>(蓝=正、琥珀=负、越深越大),下排是每步喂进来的输入 x。每个 h_t 都同时吃<b>当前 x_t</b> 和<b>上一刻 h</b>——所以它记得历史。权重 wx、wh 每步都一样(共享)。</p>}
      </div>
    </div>
  )
}
