/**
 * 舞台：PCA —— 点云 + 主轴 PC1 + 投影，2D 压 1D
 *
 * 2026-09-08 跟着内核一起重画。老版本画的是"PCA 成功的样子"：一团拉长的云、一条主轴、
 * 一个 96%。补厚之后要画的是**三个坑**，所以多了三样东西：
 *   · 点按**类别**上色（只有两团那档有类别）—— PC1 把两类压成一堆，是**看**出来的，不是读数字读出来的；
 *   · **PC2 画成虚线** —— 被丢掉的那个方向。两团那档里，判别信息全在这条虚线上；
 *   · **λ1/λ2 跟噪声地板并排的横条** —— "保留了 96%"到底算不算多，只有跟纯噪声能给出的比值比才知道。
 */
import type { PCAState } from '@engine/kernels/pca.ts'
import type { StageProps } from '../types.ts'

export function PCAStage({ state }: StageProps<PCAState>) {
  const { phase, points, mean, pc1, pc2, angle, proj, var1, lam1, lam2, ratio, nullRatio, real,
    recErr, sep1, sep2, hasClass, scaled, stdized } = state
  const showAxis = phase !== 'cloud'
  const showProj = phase === 'project' || phase === 'done'
  /*  ⚠️ 取景框必须跟着数据走：x 换单位（×10）之后点全跑到框外去了。
      老版本写死 [-3.2, 3.2]，一开那个旋钮就是一张空图。 */
  const span = Math.max(1e-6, ...points.flatMap(p => [Math.abs(p.x - mean.x), Math.abs(p.y - mean.y)])) * 1.18
  const px = (x: number) => (x - (mean.x - span)) / (2 * span) * 100
  const py = (y: number) => 100 - (y - (mean.y - span)) / (2 * span) * 100
  const ext = span * 1.05
  const a0 = { x: mean.x - pc1.x * ext, y: mean.y - pc1.y * ext }
  const a1 = { x: mean.x + pc1.x * ext, y: mean.y + pc1.y * ext }
  const b0 = { x: mean.x - pc2.x * ext, y: mean.y - pc2.y * ext }
  const b1 = { x: mean.x + pc2.x * ext, y: mean.y + pc2.y * ext }
  const squashed = hasClass && sep2 > sep1
  return (
    <div className="card">
      <h3>主成分分析 PCA <span className="hint">找数据"最铺开"的方向，把高维压成低维</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{showAxis ? `${angle}°` : '?'}</span><span className="scdl">主轴 PC1 方向</span></div>
          <div className="scdk"><span className={`scdn ${real ? 'hot' : ''}`}>{var1}%</span><span className="scdl">PC1 保留方差</span></div>
          <div className="scdk"><span className="scdn">λ1={lam1} λ2={lam2}</span><span className="scdl">两个方向上的方差</span></div>
          {showProj && <div className="scdk"><span className="scdn">{recErr}</span>
            <span className="scdl">重构误差（= λ2 {Math.abs(recErr - lam2) < 5e-4 ? '✓ 对上了' : ''}）</span></div>}
          {hasClass && showProj && <div className="scdk">
            <span className={`scdn ${squashed ? '' : 'hot'}`}>{sep1}σ / {sep2}σ</span>
            <span className="scdl">两类分开（PC1 / 被丢的 PC2）</span></div>}
        </div>

        {/*  λ1/λ2 跟噪声地板并排：这一条回答"这个主方向是真的吗" */}
        {showAxis && (
          <div className="pcafloor">
            <span className="pcaft">主方向有多"主"</span>
            <span className={`pcabar ${real ? 'on' : 'off'}`}>
              <b>λ1/λ2</b><i style={{ width: `${Math.min(100, Math.log10(Math.max(1, ratio)) / 2 * 100)}%` }} /><em>{ratio}</em>
            </span>
            <span className="pcabar null">
              <b>纯噪声</b><i style={{ width: `${Math.min(100, Math.log10(Math.max(1, nullRatio)) / 2 * 100)}%` }} /><em>{nullRatio}</em>
            </span>
            <span className="pcafn">
              {/*  ⚠️ 换了单位时不能只说"超过地板就是真的"：那个比值是**单位造出来的**。
                   地板算在原始单位下，×10 之后两边不再可比 —— 这一支必须单独说。 */}
              {scaled && !stdized
                ? '⚠️ 这个比值是**换单位换出来的**（x 轴 ×10 把它整个抬高了），跟噪声地板已经不可比 —— 先标准化再看。'
                : real ? '观测值明显高过噪声地板 —— 这个主方向是真的。'
                  : '⚠️ 观测值没超出噪声地板 —— 这团点没有主方向，那个百分比是抽样噪声。'}
            </span>
          </div>
        )}

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 投影垂线 */}
            {showProj && points.map((p, k) => (
              <line key={'pr' + k} x1={px(p.x)} y1={py(p.y)} x2={px(proj[k].x)} y2={py(proj[k].y)} className="mlresid" vectorEffect="non-scaling-stroke" />
            ))}
            {/* 被丢掉的 PC2：两团那档里，判别信息全在这条虚线上 */}
            {showAxis && <line x1={px(b0.x)} y1={py(b0.y)} x2={px(b1.x)} y2={py(b1.y)}
              className="pcapc2" vectorEffect="non-scaling-stroke" />}
            {/* 主轴 PC1 */}
            {showAxis && <line x1={px(a0.x)} y1={py(a0.y)} x2={px(a1.x)} y2={py(a1.y)} className="mlline" vectorEffect="non-scaling-stroke" />}
            {/* 原始点（有类别时按类上色 —— "两类被压成一堆"要看得见） */}
            {points.map((p, k) => (
              <circle key={k} cx={px(p.x)} cy={py(p.y)} r="1.7"
                fill={hasClass ? (p.c ? 'var(--now)' : 'var(--miss)') : 'var(--hit)'}
                opacity={showProj ? 0.5 : 0.9} />
            ))}
            {/* 投影点（落在主轴上） */}
            {showProj && proj.map((p, k) => (
              <circle key={'p' + k} cx={px(p.x)} cy={py(p.y)} r="1.6"
                fill={hasClass ? (points[k].c ? 'var(--now)' : 'var(--miss)') : 'var(--now)'} />
            ))}
            {/* 均值 */}
            {showAxis && <circle cx={px(mean.x)} cy={py(mean.y)} r="1.4" fill="var(--miss)" />}
          </svg>
          <div className="orcap">
            {phase === 'cloud' ? `${points.length} 个点${hasClass ? '，两种颜色是两个类别（PCA 看不见颜色）' : ''}——哪个方向铺得最开？`
              : phase === 'axis' ? `实线 = PC1（${angle}°，方差最大）；虚线 = 与它正交的 PC2，降到 1 维时被丢掉的就是它`
              : hasClass
                ? `投影后两种颜色${squashed ? '**混到了一起**——判别信息全在被丢掉的那条虚线上' : '仍然分得开'}`
                : `把点投影到 PC1 轴（垂线落下）；原 2D 坐标 → 轴上位置这一个数`}
          </div>
        </div>

        {phase === 'done'
          ? (!real
            ? <p className="scnote"><b>这团点没有主方向。</b>λ1/λ2 只有 <b>{ratio}</b>，而同样 {points.length} 个点的
              <b>纯噪声</b>就能给出 <b>{nullRatio}</b> —— 观测值压根没超出噪声地板。
              　所以那个"{var1}% 的方差在 PC1 上"<b>不是信号，是抽样噪声</b>：各向同性的数据本来就不该有主方向，
              但有限样本一定会给出不完全相等的 λ1、λ2，PCA 照样会交给你一个角度和一个漂亮的百分比。
              　<b>光看"保留了百分之多少"没法判断该不该降维</b> —— 得跟噪声地板比。这就是平行分析（Horn 法）在做的事。</p>
            : scaled && !stdized
              ? <p className="scnote"><b>PC1 被单位带跑了。</b>x 轴换了个记法（×10，好比米改成分米），
                <b>数据一个点都没动</b>，PC1 却掉到了 <b>{angle}°</b> —— 追着 x 轴去了，
                λ1/λ2 还被抬到 {ratio}，"{var1}%" 看着比原来更漂亮。
                　因为 PCA 吃的是<b>协方差</b>，而协方差<b>带量纲</b>：谁的数值大谁就"方差大"。
                身高用毫米记、体重用吨记，PC1 就只会讲身高。
                　把"预处理"拨到 z-score 再看：换不换单位，结果<b>完全一样</b>。</p>
              : squashed
                ? <p className="scnote"><b>PC1 把两类压成了一堆。</b>投到 PC1 之后两类中心只差 <b>{sep1}σ</b>，
                  而投到<b>被丢掉的</b> PC2 上差 <b>{sep2}σ</b> —— 差着 {(sep2 / (sep1 || 1e-9)).toFixed(1)} 倍。
                  　原因不在实现，在定义：PCA 是<b>无监督</b>的，它找的是"哪个方向铺得最开"，
                  <b>根本不知道有类别这回事</b>。而这份数据里，"分得开"的方向恰恰是方差小的那个。
                  　想保住类别信息，要用有监督的 <b>LDA</b>（最大化类间/类内方差比）—— 这就是那一类方法存在的理由。
                  「方差大 = 有用」是个假设，不是定理。</p>
                : <p className="scnote">PC1 保留了 <b>{var1}%</b> 的方差（λ1={lam1} vs λ2={lam2}，差 <b>{ratio}</b> 倍，
                  而纯噪声只能给到 {nullRatio} —— 这个主方向是<b>真的</b>）。2D 压到 1D 只丢 {(100 - var1).toFixed(1)}%。
                  　丢掉的那部分不是个含糊的说法：重构误差 <b>{recErr}</b> 正好等于 <b>λ2={lam2}</b> ——
                  <b>丢掉一个主成分的代价，就是它的特征值</b>。
                  {stdized && <>　注意标准化<b>本身也会转动 PC1</b>（把两轴尺度拉平，等于换了个"每维同等重要"的问题来解）——
                    它给的不是"真方向"，而是<b>跟单位无关</b>的方向。</>}
                  　主成分=协方差的<b>特征向量</b>、特征值=该方向方差。它是高维可视化、压缩、去噪的底，
                  和 <b>LoRA/低秩</b>"抓主方向"是一家。</p>)
          : <p className="scnote" style={{ opacity: .85 }}>{phase === 'cloud' ? '各维相关时,信息其实集中在少数几个方向上——PCA 就是把这些主方向找出来。' : phase === 'axis' ? 'PC1 是点铺得最开(方差最大)的方向;和它正交、次大方差的是 PC2。' : '投影后每个点只剩"在轴上的位置"一个数,却保住了绝大部分差异。'}</p>}
      </div>
    </div>
  )
}
