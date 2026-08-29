/** 舞台：模仿学习 BC —— 车道偏移vs步图：专家(绿,留道内)vs BC(红,漂出示范区→冲出车道);示范区/车道边界高亮 */
import type { BCState } from '@engine/kernels/bc.ts'
import type { StageProps } from '../types.ts'

const W = 380, H = 240, PAD = 34
const KMAX = 14, YMIN = -0.4, YMAX = 2

export function BCStage({ state }: StageProps<BCState>) {
  const { phase, op, demoBound, roadBound, expert, bc, shown, bcY, expertY, bcOff, bcCrashed, focus } = state
  const done = phase === 'done'
  const sx = (k: number) => PAD + (k / KMAX) * (W - 2 * PAD)
  const sy = (y: number) => H - PAD - ((y - YMIN) / (YMAX - YMIN)) * (H - 2 * PAD)
  const ePath = expert.slice(0, shown + 1).map((y, k) => `${sx(k)},${sy(y)}`).join(' ')
  const bPath = bc.slice(0, shown + 1).map((y, k) => `${sx(k)},${sy(y)}`).join(' ')

  return (
    <div className="card">
      <h3>模仿学习 · 行为克隆 BC <span className="hint">从专家示范学策略；漂出示范区→欠修正→复合误差→冲出车道</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">第 {shown} 步</span><span className="scdl">滚动</span></div>
          <div className="scdk"><span className="scdn km-dn">{expertY}</span><span className="scdl">专家偏移（道内）</span></div>
          <div className="scdk"><span className={`scdn ${bcCrashed ? 'sk-neg' : bcOff ? 'km-up' : ''}`}>{bcY}</span><span className="scdl">BC 偏移{bcCrashed ? '（冲出！）' : bcOff ? '（漂出示范区）' : ''}</span></div>
        </div>

        <svg className="fk-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ marginBottom: 8 }}>
          {/* 示范区（|y|≤demoBound） */}
          <rect x={sx(0)} y={sy(demoBound)} width={W - 2 * PAD} height={sy(-demoBound) - sy(demoBound)} className="bc-demo" />
          {/* 车道边界 */}
          <line x1={sx(0)} y1={sy(roadBound)} x2={sx(KMAX)} y2={sy(roadBound)} className="bc-road" />
          <text x={sx(KMAX)} y={sy(roadBound) - 3} className="bc-lbl" textAnchor="end">车道边界 {roadBound}</text>
          <line x1={sx(0)} y1={sy(demoBound)} x2={sx(KMAX)} y2={sy(demoBound)} className="bc-demoline" />
          <text x={sx(0) + 3} y={sy(demoBound) - 3} className="bc-lbl">示范区 {demoBound}</text>
          {/* 中线 */}
          <line x1={sx(0)} y1={sy(0)} x2={sx(KMAX)} y2={sy(0)} className="fk-axis" />
          <text x={sx(0) - 6} y={sy(0) + 3} className="km-axlbl" textAnchor="end">0</text>
          {[0, 4, 8, 12].map(k => <text key={k} x={sx(k)} y={H - PAD + 13} className="km-axlbl" textAnchor="middle">{k}</text>)}
          {/* 专家 */}
          {shown > 0 && <polyline points={ePath} className="bc-expert" />}
          {expert.slice(0, shown + 1).map((y, k) => <circle key={'e' + k} cx={sx(k)} cy={sy(y)} r={2.5} className="bc-edot" />)}
          {/* BC */}
          {shown > 0 && <polyline points={bPath} className="bc-bc" />}
          {bc.slice(0, shown + 1).map((y, k) => <circle key={'b' + k} cx={sx(k)} cy={sy(y)} r={2.5} className={`bc-bdot ${Math.abs(y) > demoBound ? 'off' : ''}`} />)}
        </svg>

        <div className="bc-info">
          <div className="km-legend">
            <span><i className="km-dot" style={{ background: 'var(--hit)' }} />专家(留道内)</span>
            <span><i className="km-dot" style={{ background: 'var(--miss)' }} />BC(漂出→冲出)</span>
            <span><i className="km-dot" style={{ background: 'color-mix(in srgb,var(--hit) 20%,transparent)' }} />示范区</span>
          </div>
          {op === 'step' && <div className={`bc-row ${bcOff ? 'off' : ''}`}>第 {shown} 步：专家 {expertY}、BC {bcY} {bcOff ? '→ BC 漂出示范区、欠修正、误差复合' : '→ 都在示范区、几乎一样'}</div>}
        </div>

        {done
          ? <p className="scnote">BC 是<b>一步监督</b>(状态→动作回归)，简单可扩展(VLA 就这么训)。但它有<b>分布漂移/复合误差</b>：只在专家示范过的状态学得好，自己的小误差把它带到没示范过的状态→欠修正→错上加错(代价 O(εT²))。这不是拟合不够，是<b>训练分布≠自己走出的分布</b>。解法：<b>DAgger</b>(在 BC 走出的新状态补标注)、覆盖含纠错的示范、RL 微调——这正是 VLA 要海量多样数据的原因。下一课：Diffusion Policy、VLA。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{bcOff ? 'BC 漂出示范区(绿带)后就没学过怎么办，欠修正、压不住扰动、每步再漂一点——复合误差。专家修正不封顶、稳稳拉住。' : '两者都在示范区内、几乎一样；注意扰动在把偏移往外推。'}</p>}
      </div>
    </div>
  )
}
