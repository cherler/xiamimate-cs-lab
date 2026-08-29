/** 舞台：ICP 点云配准 —— 目标点云(空心)与源点云(实心)，对应连线，源云逐轮转到目标上、误差缩小 */
import type { ICPState } from '@engine/kernels/icp.ts'
import type { StageProps } from '../types.ts'

const SZ = 320, PAD = 26
const XMIN = -1, XMAX = 5, YMIN = -1, YMAX = 4
const SC = Math.min((SZ - 2 * PAD) / (XMAX - XMIN), (SZ - 2 * PAD) / (YMAX - YMIN))
const sx = (x: number) => PAD + (x - XMIN) * SC
const sy = (y: number) => SZ - PAD - (y - YMIN) * SC

export function ICPStage({ state }: StageProps<ICPState>) {
  const { phase, op, target, cur, corr, iterNo, iterRot, cumRot, error, trueRot, focus } = state
  const done = phase === 'done'

  return (
    <div className="card">
      <h3>ICP 点云配准 <span className="hint">找最近点对应 → 算最佳刚体变换 → 迭代对齐（激光 SLAM 前端）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">第 {iterNo} 轮</span><span className="scdl">迭代</span></div>
          <div className="scdk"><span className={`scdn ${error < 0.1 ? 'km-dn' : ''}`}>{error}</span><span className="scdl">点对平均误差</span></div>
          <div className="scdk"><span className="scdn">{cumRot}°</span><span className="scdl">累计旋转（真值 {trueRot}°）</span></div>
        </div>

        <div className="fk-wrap">
          <svg className="fk-svg" viewBox={`0 0 ${SZ} ${SZ}`} width={SZ} height={SZ}>
            {[-1, 0, 1, 2, 3, 4, 5].map(x => <line key={'gx' + x} x1={sx(x)} y1={sy(YMIN)} x2={sx(x)} y2={sy(YMAX)} className="fk-grid" />)}
            {[-1, 0, 1, 2, 3, 4].map(y => <line key={'gy' + y} x1={sx(XMIN)} y1={sy(y)} x2={sx(XMAX)} y2={sy(y)} className="fk-grid" />)}
            {/* 对应连线 */}
            {cur.map((p, i) => {
              const t = target[corr[i]!]!
              return <line key={'c' + i} x1={sx(p[0])} y1={sy(p[1])} x2={sx(t[0])} y2={sy(t[1])} className="icp-corr" />
            })}
            {/* 目标点云（空心） */}
            {target.map((t, i) => <circle key={'t' + i} cx={sx(t[0])} cy={sy(t[1])} r={5} className="icp-tgt" />)}
            {/* 源点云（实心，会动） */}
            {cur.map((p, i) => <circle key={'s' + i} cx={sx(p[0])} cy={sy(p[1])} r={4} className="icp-src" />)}
          </svg>

          <div className="fk-side">
            <div className="km-legend">
              <span><i className="km-dot" style={{ border: '1.5px solid var(--now)' }} />目标点云</span>
              <span><i className="km-dot" style={{ background: 'var(--hit)' }} />源点云(动)</span>
            </div>
            {op !== 'intro' && (
              <div className="icp-iter">
                <div className="km-mh">第 {iterNo} 轮</div>
                <div className="km-ml">① 找最近点对应</div>
                <div className="km-ml">② 算最佳旋转 = <b>{iterRot}°</b>（累计 {cumRot}°）</div>
                <div className="km-ml ok">③ 搬过去 → 误差 <b>{error}</b></div>
              </div>
            )}
            {op === 'intro' && <div className="icp-iter"><div className="km-ml">目标 = 源转 {trueRot}°+平移。<br />初始误差 {error}，看几轮收敛。</div></div>}
          </div>
        </div>

        {done
          ? <p className="scnote">ICP 把"不知道点怎么对应"拆成两步反复迭代：<b>猜最近点当对应</b> + <b>用点对求最佳刚体变换(Kabsch)</b>，对应和变换互相改进、误差单调降到 ~0，还原出 {cumRot}° 旋转。是激光 SLAM 前端、深度重建、抓取物体位姿的核心。局限：<b>依赖初值</b>(差太多→对应全错→局部最优)，实际先粗配准(特征/IMU)再 ICP 精配。配四元数(表示变换)+卡尔曼(多帧融合)成定位建图链。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{op === 'intro' ? '两片点云没对齐；ICP 不知道哪个点对哪个点，靠"最近点"猜对应、再迭代修正。' : '连线是当前的点对；源点云(实心)每轮朝目标(空心)靠一点，对应越来越准、误差越来越小。'}</p>}
      </div>
    </div>
  )
}
