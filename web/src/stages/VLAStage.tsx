/** 舞台：VLA —— 流水线 图像+指令→预训练VLM骨干→动作token→反解执行；token化表 + 泛化到没训过物体 */
import type { VLAState } from '@engine/kernels/vla.ts'
import type { StageProps } from '../types.ts'

const PIPE = [
  { key: 0, label: '图像 + 指令', sub: '视觉token+文本token' },
  { key: 1, label: '预训练 VLM 骨干', sub: '懂 红/碗/放进（网络知识）' },
  { key: 2, label: '动作 token', sub: '像吐单词一样生成' },
  { key: 3, label: '反解 → 执行', sub: 'token→Δpose→机械臂' },
]

export function VLAStage({ state }: StageProps<VLAState>) {
  const { phase, op, instruction, dims, tokens, gripTok, stage, novelObj, focus } = state
  const done = phase === 'done'
  const showTokens = stage >= 2
  const isGen = phase === 'generalize' || done

  return (
    <div className="card">
      <h3>VLA 视觉-语言-动作 <span className="hint">预训练大模型吃图像+指令、直接吐机器人动作；动作被 token 化</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot" style={{ fontSize: '12px' }}>「{instruction}」</span><span className="scdl">语言指令</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '12px' }}>[{tokens.join(',')}]</span><span className="scdl">动作 token 序列</span></div>
          <div className="scdk"><span className="scdn">VLM+动作头</span><span className="scdl">架构</span></div>
        </div>

        {/* 流水线 */}
        <div className="vla-pipe">
          {PIPE.map((p, i) => (
            <div key={p.key} className="vla-pwrap">
              <div className={`vla-box ${stage === p.key ? 'on' : stage > p.key ? 'done' : ''}`}>
                <b>{p.label}</b><em>{p.sub}</em>
              </div>
              {i < PIPE.length - 1 && <span className="vla-arrow">→</span>}
            </div>
          ))}
        </div>

        {/* token 化表 */}
        {showTokens && (
          <div className="vla-tok">
            <div className="fk-chead">动作 token 化（连续 Δpose → 256 格 → token → 反解）</div>
            {dims.map(d => (
              <div key={d.name} className="vla-trow">
                <span className="vla-tn">{d.name} = {d.val}</span>
                <span className="vla-tarr">→ 格 {d.bin}</span>
                <span className="vla-ttok">token {d.bin}</span>
                <span className="vla-tback">→ 反解 {d.back}</span>
              </div>
            ))}
            <div className="vla-trow"><span className="vla-tn">夹爪 = 合</span><span className="vla-tarr">→</span><span className="vla-ttok">token {gripTok}</span><span className="vla-tback">→ 合</span></div>
          </div>
        )}

        {/* 泛化 */}
        {isGen && (
          <div className="vla-gen">🌐 泛化：换成「拿起那个 <b>{novelObj}</b>」——机器人数据从没出现过，但骨干在网络图文里见过无数紫色的、杯子 → 直接接到动作、伸手去拿。从零训练的策略做不到。</div>
        )}

        {done
          ? <p className="scnote">VLA = 网络预训练<b>视觉-语言大模型</b>当骨干 + 接<b>动作输出</b> + 机器人示范微调。动作头两种：<b>离散 token 化</b>(RT-2，动作当词、复用自回归生成) / <b>连续动作头</b>(π0，扩散/流匹配=上一课 Diffusion Policy)。强在骨干带<b>网络知识</b>、能泛化到没训过的物体和自由指令。代表：RT-2 / OpenVLA / π0 / RDT。把前面运动学/感知/控制/模仿学习统进一个通才机器人策略。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{op === 'backbone' ? '骨干是网络图文预训练的，早就懂"红/碗/放进"——世界知识不是从机器人数据现学的。' : op === 'tokenize' ? '把连续动作每维离散成 256 格、映射成 token id，动作就变成一串"词"、和语言共用词表。' : op === 'execute' ? 'VLM 像吐单词一样自回归吐动作 token，机器人端反 token 化回连续位姿执行。' : op === 'generalize' ? '骨干见过无数网络图文，能把没训过的新概念接到动作上——这是 VLA 泛化的本钱。' : 'VLA 吃图像+语言、直接产动作；一路走这条流水线。'}</p>}
      </div>
    </div>
  )
}
