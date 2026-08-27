/** 舞台：RNN —— 展开成时间链，隐藏状态 h 沿时间流动，每步 h_t=tanh(wx·x_t+wh·h_{t-1}+b) */
import type { RNNState } from '@engine/kernels/rnn.ts'
import type { StageProps } from '../types.ts'

const hcol = (h: number) => h >= 0
  ? `color-mix(in srgb, #3b82f6 ${Math.round(Math.abs(h) * 60)}%, var(--panel))`
  : `color-mix(in srgb, var(--now) ${Math.round(Math.abs(h) * 60)}%, var(--panel))`

export function RNNStage({ state }: StageProps<RNNState>) {
  const { xs, wx, wh, b, t, xt, hPrev, pre, ht, hs, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>循环神经网络 RNN <span className="hint">一个隐藏状态沿时间流动，把"过去"记在里面</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? ht : t > 0 ? `h_${t}` : 'h'}</span><span className="scdl">{done ? '末态记忆' : '当前记忆'}</span></div>
          <div className="scdk"><span className="scdn">{done ? '—' : t > 0 ? ht : '—'}</span><span className="scdl">h 值</span></div>
          <div className="scdk"><span className="scdn">wx={wx} wh={wh}</span><span className="scdl">共享权重</span></div>
        </div>

        <div className="rnnwrap">
          <div className="rnnchain">
            <div className="rnncol h0">
              <div className="rnnh" style={{ background: 'var(--panel)' }}>0</div>
              <div className="rnnlbl">h₀</div>
            </div>
            {xs.map((x, k) => {
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
            {t === 0 && !done ? '按「下一步」开始:隐藏状态 h₀=0,逐个读入序列,每步更新记忆'
              : done ? `读完整段:记忆一路演化到末态 ${ht}——它浓缩了整个序列 [${xs.join(',')}]`
                : `第 ${t} 步:h_${t} = tanh(${wx}·${xt} + ${wh}·${hPrev} + ${b}) = tanh(${pre}) = ${ht}`}
          </div>
        </div>

        {done
          ? <p className="scnote">RNN 用一个<b>隐藏状态 h(记忆)沿时间传递</b>来处理变长序列:每读一个 x_t,就用<b>同一套共享权重</b>把"当前输入 + 上一刻记忆"揉进新记忆 h_t=tanh(wx·x_t+wh·h_{'{'}t-1{'}'}+b)。权重<b>所有时刻共享</b>(能吃任意长序列),而 h_t <b>藏着全部过去</b>——同样最后输入 +2,历史 [2] 得 0.923、历史 [−3] 得 0.269。它是语言模型、翻译、语音的早期主力;长序列会<b>梯度消失</b>,于是有了 LSTM/GRU 的门控、再到 Transformer 的注意力。</p>
          : <p className="scnote" style={{ opacity: .85 }}>横着展开:上排是记忆 h 沿时间流动的<b>传送带</b>(蓝=正、琥珀=负、越深越大),下排是每步喂进来的输入 x。每个 h_t 都同时吃<b>当前 x_t</b> 和<b>上一刻 h</b>——所以它记得历史。权重 wx、wh 每步都一样(共享)。</p>}
      </div>
    </div>
  )
}
