/** 舞台：PCA —— 点云 + 主轴 PC1 + 投影，2D 压 1D 保住大部分方差 */
import type { PCAState } from '@engine/kernels/pca.ts'
import type { StageProps } from '../types.ts'

const LO = -3.2, HI = 3.2
const px = (x: number) => (x - LO) / (HI - LO) * 100
const py = (y: number) => 100 - (y - LO) / (HI - LO) * 100

export function PCAStage({ state }: StageProps<PCAState>) {
  const { phase, points, mean, pc1, angle, proj, var1 } = state
  const showAxis = phase !== 'cloud'
  const showProj = phase === 'project' || phase === 'done'
  // 主轴两端（沿 pc1 方向从 mean 延伸）
  const ext = 4
  const a0 = { x: mean.x - pc1.x * ext, y: mean.y - pc1.y * ext }
  const a1 = { x: mean.x + pc1.x * ext, y: mean.y + pc1.y * ext }
  return (
    <div className="card">
      <h3>主成分分析 PCA <span className="hint">找数据"最铺开"的方向，把高维压成低维</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{showAxis ? `${angle}°` : '?'}</span><span className="scdl">主轴 PC1 方向</span></div>
          <div className="scdk"><span className="scdn hot">{var1}%</span><span className="scdl">PC1 保留方差</span></div>
          <div className="scdk"><span className="scdn">2D→1D</span><span className="scdl">压维,丢 {(100 - var1).toFixed(1)}%</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 投影垂线 */}
            {showProj && points.map((p, k) => (
              <line key={'pr' + k} x1={px(p.x)} y1={py(p.y)} x2={px(proj[k].x)} y2={py(proj[k].y)} className="mlresid" vectorEffect="non-scaling-stroke" />
            ))}
            {/* 主轴 PC1 */}
            {showAxis && <line x1={px(a0.x)} y1={py(a0.y)} x2={px(a1.x)} y2={py(a1.y)} className="mlline" vectorEffect="non-scaling-stroke" />}
            {/* 原始点 */}
            {points.map((p, k) => (
              <circle key={k} cx={px(p.x)} cy={py(p.y)} r="1.7" fill="var(--hit)" opacity={showProj ? 0.45 : 0.9} />
            ))}
            {/* 投影点（落在主轴上） */}
            {showProj && proj.map((p, k) => (
              <circle key={'p' + k} cx={px(p.x)} cy={py(p.y)} r="1.6" fill="var(--now)" />
            ))}
            {/* 均值 */}
            {showAxis && <circle cx={px(mean.x)} cy={py(mean.y)} r="1.4" fill="var(--miss)" />}
          </svg>
          <div className="orcap">
            {phase === 'cloud' ? '点云沿对角线拉长(两坐标相关)——哪个方向铺得最开?'
              : phase === 'axis' ? `主轴 PC1(${angle}°)=方差最大的方向=协方差最大特征向量`
              : `把点投影到 PC1 轴(垂线落下);原 2D 坐标 → 轴上位置这一个数`}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">PC1 保留了 <b>{var1}%</b> 的方差——<b>2D 压到 1D 只丢 {(100 - var1).toFixed(1)}%</b>。这就是降维:找数据主轴、去冗余,用更少维度保住大部分信息。主成分=协方差的<b>特征向量</b>、特征值=该方向方差、越大越该留。它是高维可视化、压缩、去噪的底,和 <b>LoRA/低秩</b>"抓主方向"是一家。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{phase === 'cloud' ? '各维相关时,信息其实集中在少数几个方向上——PCA 就是把这些主方向找出来。' : phase === 'axis' ? 'PC1 是点铺得最开(方差最大)的方向;和它正交、次大方差的是 PC2。' : '投影后每个点只剩"在轴上的位置"一个数,却保住了绝大部分差异。'}</p>}
      </div>
    </div>
  )
}
