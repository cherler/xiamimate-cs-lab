/** 舞台：Diffusion Policy —— 动作轴上双峰分布(±1)、BC均值落0(撞)、两个噪声样本去噪分别收敛到右/左模态 */
import type { DiffPolicyState } from '@engine/kernels/diffpolicy.ts'
import type { StageProps } from '../types.ts'

const W = 380, H = 200, PAD = 34
const AMIN = -1.6, AMAX = 1.6

export function DiffPolicyStage({ state }: StageProps<DiffPolicyState>) {
  const { phase, op, bcAction, seedA, seedB, shown, aVal, bVal, focus } = state
  const done = phase === 'done'
  const ax = (a: number) => PAD + ((a - AMIN) / (AMAX - AMIN)) * (W - 2 * PAD)
  const showBc = phase !== 'intro'
  const showDenoise = phase === 'denoise' || done
  // 双峰概率密度（在 ±1 高、0 低）：用两个高斯峰画曲线
  const dens = (a: number) => Math.exp(-((a - 1) ** 2) / 0.12) + Math.exp(-((a + 1) ** 2) / 0.12)
  const curve = () => { const pts = []; for (let a = AMIN; a <= AMAX; a += 0.05) { const y = H - PAD - dens(a) * 46; pts.push(`${ax(a)},${y}`) } return pts.join(' ') }

  return (
    <div className="card">
      <h3>Diffusion Policy <span className="hint">建多峰动作分布、从噪声去噪采一个模态；治 BC 把多解平均成撞</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'bc' ? 'BC 回归' : done ? '各落一模态' : phase === 'denoise' ? `去噪 ${shown} 步` : '就绪'}</span><span className="scdl">当前</span></div>
          <div className="scdk"><span className="scdn sk-neg">{bcAction}</span><span className="scdl">BC 均值(直行→撞)</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '13px' }}>{showDenoise ? `${aVal} / ${bVal}` : '—'}</span><span className="scdl">扩散样本 A / B</span></div>
        </div>

        <svg className="fk-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ marginBottom: 8 }}>
          {/* 动作轴 */}
          <line x1={ax(AMIN)} y1={H - PAD} x2={ax(AMAX)} y2={H - PAD} className="fk-axis" />
          <text x={ax(-1)} y={H - PAD + 14} className="km-axlbl" textAnchor="middle">−1 向左</text>
          <text x={ax(0)} y={H - PAD + 14} className="km-axlbl" textAnchor="middle">0 直行</text>
          <text x={ax(1)} y={H - PAD + 14} className="km-axlbl" textAnchor="middle">+1 向右</text>
          {/* 双峰分布 */}
          <polyline points={curve()} className="dp-dist" />
          <text x={ax(1)} y={H - PAD - 52} className="dp-lbl" textAnchor="middle">模态·右绕</text>
          <text x={ax(-1)} y={H - PAD - 52} className="dp-lbl" textAnchor="middle">模态·左绕</text>
          {/* BC 均值（撞） */}
          {showBc && (
            <g>
              <line x1={ax(0)} y1={H - PAD} x2={ax(0)} y2={PAD + 6} className="dp-bcline" />
              <circle cx={ax(0)} cy={PAD + 10} r={6} className="dp-bc" />
              <text x={ax(0)} y={PAD} className="dp-bclbl" textAnchor="middle">BC=0 撞!</text>
            </g>
          )}
          {/* 去噪样本 A/B 及尾迹 */}
          {showDenoise && (
            <>
              <polyline points={seedA.slice(0, shown + 1).map((a, i) => `${ax(a)},${H - PAD - 26 - i * 1.5}`).join(' ')} className="dp-trailA" />
              <polyline points={seedB.slice(0, shown + 1).map((a, i) => `${ax(a)},${H - PAD - 26 - i * 1.5}`).join(' ')} className="dp-trailB" />
              <circle cx={ax(aVal)} cy={H - PAD - 26 - shown * 1.5} r={5} className="dp-a" />
              <circle cx={ax(bVal)} cy={H - PAD - 26 - shown * 1.5} r={5} className="dp-b" />
            </>
          )}
        </svg>

        <div className="dp-info">
          {op === 'bc' && <div className="dp-warn">BC 回归求均值：左(−1)+右(+1) 平均 = <b>0(直行)</b> → 正好撞障碍。两个正确解平均出一个错解。</div>}
          {(op === 'step' || op === 'summary') && <div className="dp-row">去噪第 {shown} 步：样本从噪声出发、沿能量往<b>某个峰</b>拉——A→{aVal}(右)、B→{bVal}(左)，不是拉向平均 0。</div>}
        </div>

        {done
          ? <p className="scnote">Diffusion Policy 不预测单个动作、而是<b>建整个动作分布(可多峰)、从噪声去噪采样</b>：不同噪声→不同模态(左/右都有效)，不被平均成撞。还让一整段动作序列<b>内部连贯</b>。代价：采样要迭代多步(用 DDIM/一致性/流匹配加速)。这正是现代 <b>VLA</b> 动作头广用扩散(RT、π0)的原因。和 BC：都从示范学，但扩散建分布不建均值，天然治多峰。下一课：VLA。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{op === 'bc' ? '回归的最优单点预测是均值——多峰(左/右)一平均就落到中间(直行)、撞障碍。' : op === 'step' ? '去噪=从噪声沿学到的能量往高概率区拉，落到某一个峰而非平均。不同噪声给不同模态=多解。' : 'BC 把左右平均成撞；扩散建多峰分布、去噪采一个模态。'}</p>}
      </div>
    </div>
  )
}
