/** 舞台：LSTM —— cell 状态像传送带扛住长期记忆，三个门(遗忘/输入/输出)控制记忆的留/写/放 */
import type { LSTMState } from '@engine/kernels/lstm.ts'
import type { StageProps } from '../types.ts'

const gate = (v: number, name: string) => (
  <span className={`lstmgate ${v >= 0.5 ? 'open' : 'shut'}`} title={name}>{name}<b>{v}</b></span>
)

export function LSTMStage({ state }: StageProps<LSTMState>) {
  const { t, role, f, ig, ctil, o, cPrev, c, h, cs, phase } = state
  const done = phase === 'done'
  const started = t > 0 || done
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
              {cs.map((v, k) => (
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
            {!started ? '按「下一步」开始:三个门控制一条 cell 记忆传送带的留/写/放'
              : done ? `传送带全程稳在 ${c}——存进去后被原封不动扛到末尾,再取出 tanh(${c})=${h}`
                : role === '存' ? `存:开输入门(i=1) → c = 0·${cPrev}+1·${ctil} = ${c},把记忆写进传送带`
                  : role === '守' ? `守:遗忘门 f=1、输入门 i=0 → c = 1·${cPrev}+0 = ${c},记忆原样传下去(h 仍 0)`
                    : `取:开输出门(o=1) → h = 1·tanh(${c}) = ${h},把记忆放出来`}
          </div>
        </div>

        {done
          ? <p className="scnote">普通 RNN 的记忆每步都过 tanh、反复挤压,长序列很快忘光(<b>梯度消失</b>)。LSTM 另开一条<b>细胞状态 c</b> 当传送带:更新是 <b>c_t = f·c_{'{'}t-1{'}'} + i·c̃</b>——一条<b>加法为主、近乎线性</b>的高速路。遗忘门 f≈1、输入门 i≈0 时,旧记忆(和梯度)就能<b>原封不动传很远</b>;开输入门写新、开输出门读出。门是数据算出的 sigmoid(0~1),LSTM 因此学会"何时记、何时忘、何时说"。GRU 是它的简化;后来 Transformer 注意力让每个位置直接看全序列。</p>
          : <p className="scnote" style={{ opacity: .85 }}>上排=cell 记忆传送带 c(琥珀=当前步);它全程稳在 0.8——这是 RNN 做不到的。下排=三个门:<b>遗忘门 f</b>(留多少旧记忆)、<b>输入门 i</b>(写多少新内容)、<b>输出门 o</b>(放多少出来),绿=开、灰=关。核心公式 c=f·c_prev+i·c̃、h=o·tanh(c)。(门值这里理想化成 0/1,真实是 0~1 的 sigmoid)</p>}
      </div>
    </div>
  )
}
