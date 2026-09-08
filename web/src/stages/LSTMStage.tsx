/**
 * 舞台：LSTM —— cell 传送带 + 三个门；长序列那两档再加一条**跟 RNN 并排的影响力条**
 *
 * 2026-09-08 补厚时加的下半截。剧本那一档（4 步）还是原来的传送带方格。
 * 长序列那两档要回答的是另一个问题 —— **门控到底比 RNN 赢在哪** ——
 * 所以画的是两条并排的横条：LSTM 的 ∏f 和 RNN 的 ∏wh·(1−h²)。
 * f=1 时前者纹丝不动，后者一路掉光。这比任何一句"扛住了长距离依赖"都直接。
 */
import type { LSTMState } from '@engine/kernels/lstm.ts'
import type { StageProps } from '../types.ts'

const gate = (v: number, name: string) => (
  <span className={`lstmgate ${v >= 0.5 ? 'open' : 'shut'}`} title={name}>{name}<b>{v}</b></span>
)

export function LSTMStage({ state }: StageProps<LSTMState>) {
  const { t, role, f, ig, ctil, o, cPrev, c, h, cs, phase,
    grad, grads, halfLife, fGate, rnnHalf, script, compare } = state
  const done = phase === 'done'
  const started = t > 0 || done
  const T = cs.length
  //  RNN 在最好那档的同尺子对照：每步乘 0.9（脉冲之后 h→0、tanh′→1，因子就是 wh）
  const rnnAt = (k: number) => 0.9 ** k
  return (
    <div className="card">
      <h3>LSTM 门控 <span className="hint">给记忆装门，一条几乎不衰减的 cell 传送带扛住长距离依赖</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{started ? c : '—'}</span><span className="scdl">细胞状态 c(记忆)</span></div>
          <div className="scdk"><span className="scdn">{started ? h : '—'}</span><span className="scdl">隐藏输出 h</span></div>
          <div className="scdk"><span className="scdn">{done ? '取出' : t > 0 ? role : '—'}</span><span className="scdl">本步动作</span></div>
        </div>

        <div className="lstmwrap">
          {/* cell 传送带 */}
          <div className="lstmbelt">
            <span className="lstmbeltlbl">cell 记忆传送带 c：</span>
            <div className="lstmcells">
              <div className="lstmc c0">0</div>
              {(script ? cs : cs.slice(0, 10)).map((v, k) => (
                <div key={k} className={`lstmc ${v !== null ? 'on' : ''} ${k + 1 === t && !done ? 'cur' : ''}`}>
                  {v === null ? '·' : v}
                </div>
              ))}
            </div>
          </div>

          {/* 当前步的门 */}
          {started && (
            <div className="lstmgates">
              {gate(f, '遗忘门 f')}
              {gate(ig, '输入门 i')}
              {gate(o, '输出门 o')}
              <span className="lstmctil">候选 c̃={ctil}</span>
            </div>
          )}

          <div className="orcap">
            {!started ? '按「下一步」开始：三个门控制一条 cell 记忆传送带的留/写/放'
              : done ? (script ? `传送带全程稳在 ${c} —— 存进去后被原封不动扛到末尾，再取出 tanh(${c})=${h}`
                : `走完 ${T} 步（上面只画了前 10 格传送带）`)
                : role === '存' ? `存：开输入门（i=1）→ c = 0·${cPrev}+1·${ctil} = ${c}，把记忆写进传送带`
                  : role === '守' ? `守：遗忘门 f=${f}、输入门 i=0 → c = ${f}·${cPrev}+0 = ${c}，记忆往下传`
                    : `取：开输出门（o=1）→ h = 1·tanh(${c}) = ${h}，把记忆放出来`}
          </div>
        </div>

        {/*  ── 补厚：跟 RNN 并排的同尺子对照 ── */}
        {!script && (
          <div className="lscmp">
            <span className="lsct">开头写进去的东西，走过 {T} 步之后还剩多少（两边用同一把尺子）</span>
            <span className={`lscbar ${halfLife < 0 ? 'best' : ''}`}>
              <b>LSTM ∏f</b>
              <i style={{ width: `${Math.max(1.5, Math.abs(grad) * 100)}%` }} />
              <em>{grad}</em>
            </span>
            <span className="lscbar rnn">
              <b>RNN ∏wh·(1−h²)</b>
              <i style={{ width: `${Math.max(1.5, rnnAt(T - 1) * 100)}%` }} />
              <em>{rnnAt(T - 1) < 1e-3 ? rnnAt(T - 1).toExponential(1) : rnnAt(T - 1).toFixed(4)}</em>
            </span>
            <span className="lscfn">
              两条链<b>只差一项</b>：LSTM 乘的是 <b>f</b>（学出来的门，<b>可以等于 1</b>），
              RNN 乘的是 <b>wh·(1−h²)</b>（tanh′ 算出来，<b>必然小于 1</b>）。
              {halfLife < 0
                ? ' 这一档 f=1，所以 ∏f=1 —— 走多远都不掉。'
                : ` 这一档 f=${fGate}，半衰期 ${halfLife} 步；RNN 最好那档（wh=0.9）是 ${rnnHalf} 步。`}
            </span>
          </div>
        )}

        {done
          ? (script
            ? <p className="scnote">普通 RNN 的记忆每步都过 tanh、反复挤压，长序列很快忘光（<b>梯度消失</b>）。
              LSTM 另开一条<b>细胞状态 c</b> 当传送带：<b>c_t = f·c_{'{'}t-1{'}'} + i·c̃</b> ——
              一条<b>加法为主、近乎线性</b>的高速路。f≈1、i≈0 时旧记忆就能原封不动传很远。
              　⚠️ 但这一档的门值是<b>手写死的</b>（0 和 1），"扛住了"更像一句宣告。
              <b>把「序列」换成长序列</b> —— 那一档会用跟隔壁 RNN <b>完全一样的尺子</b>量同一件事。</p>
            : <p className="scnote">走完 {T} 步，开头写进 cell 的东西还剩 <b>{grad}</b>
              {halfLife < 0 ? <> —— <b>一点没少</b>。</> : <>（半衰期 {halfLife} 步）。</>}
              　跟隔壁 RNN 摆在一起才有意思：<b>两条链只差一项</b>。
              RNN 要乘 ∏ <b>wh·(1−h²)</b>，tanh′ 是<b>算出来的、必然小于 1</b>（h 一饱和还趋近 0，
              所以 RNN 把 wh 调大反而更糟）；LSTM 只乘 ∏ <b>f</b>，而 f 是<b>学出来的门，可以学成 1</b>。
              　实测：{compare.map(([g, hl]) => `f=${g} → ${hl < 0 ? '不衰减' : `${hl} 步`}`).join('、')}；
              RNN 最好那档（wh=0.9）是 {rnnHalf} 步 —— 注意 <b>f=0.9 跟它一模一样</b>，
              因为那时两条链乘的正是同一个数。
              　<b>门控赢的不是"更聪明"，是把那一项从"必然小于 1"变成了"可以等于 1"。</b>
              　再往后，Transformer 的注意力干脆不传了：每个位置<b>直接看</b>全序列，连乘链一步都不用走。</p>)
          : <p className="scnote" style={{ opacity: .85 }}>上排=cell 记忆传送带 c(琥珀=当前步);它全程稳在 0.8——这是 RNN 做不到的。下排=三个门:<b>遗忘门 f</b>(留多少旧记忆)、<b>输入门 i</b>(写多少新内容)、<b>输出门 o</b>(放多少出来),绿=开、灰=关。核心公式 c=f·c_prev+i·c̃、h=o·tanh(c)。(门值这里理想化成 0/1,真实是 0~1 的 sigmoid)</p>}
      </div>
    </div>
  )
}
