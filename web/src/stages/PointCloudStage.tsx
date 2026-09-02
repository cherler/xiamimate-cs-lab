/** 舞台：点云预处理 —— 2D 散点(原始/下采样/查询点+邻域/法线切向箭头) + 体素/近邻/协方差/PCA 逐块 */
import type { CloudState } from '@engine/kernels/pointcloud.ts'
import type { StageProps } from '../types.ts'

const SC = 30, OX = 22, OY = 108
const PX = (x: number) => OX + x * SC
const PY = (y: number) => OY - y * SC

export function PointCloudStage({ state }: StageProps<CloudState>) {
  const s = state
  const { resLabel, L, raw, voxels, query, nbrs, cov, lamBig, lamSmall, normal, tangent, showVoxel, showNbr, showCov, showPca } = s
  const nbrSet = new Set(nbrs.map(p => `${p[0]},${p[1]}`))

  return (
    <div className="card">
      <h3>点云预处理 · 下采样 + 法线 <span className="hint">体素下采样降密度 + PCA 求表面法线：配准/建图前必做</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{resLabel.split('(')[0]}<em className="cc-u"> L={L}</em></span><span className="scdl">下采样分辨率</span></div>
          <div className="scdk"><span className="scdn">{raw.length}→{showVoxel ? voxels.length : '—'}</span><span className="scdl">点数(下采样)</span></div>
          <div className="scdk"><span className="scdn">{showPca ? `${lamSmall}/${lamBig}` : '—'}</span><span className="scdl">λ小/λ大</span></div>
          <div className="scdk"><span className={`scdn${showPca ? ' pc-hot' : ''}`}>{showPca ? `[${normal}]` : '—'}</span><span className="scdl">法线(小λ特征向量)</span></div>
        </div>

        <svg className="pc-svg" viewBox="0 0 160 120" width="100%" height="140">
          {/* 原始点 */}
          {raw.map((p, k) => <circle key={k} cx={PX(p[0])} cy={PY(p[1])} r="2.5" className={showNbr && nbrSet.has(`${p[0]},${p[1]}`) ? 'pc-nbr' : 'pc-raw'} />)}
          {/* 下采样体素质心 */}
          {showVoxel && voxels.map((v, k) => <circle key={k} cx={PX(v[0])} cy={PY(v[1])} r="4" className="pc-vox" />)}
          {/* 查询点 */}
          {showNbr && <circle cx={PX(query[0])} cy={PY(query[1])} r="3.5" className="pc-query" />}
          {/* 法线 + 切向 */}
          {showPca && <>
            <line x1={PX(query[0]) - tangent[0] * 22} y1={PY(query[1]) + tangent[1] * 22} x2={PX(query[0]) + tangent[0] * 22} y2={PY(query[1]) - tangent[1] * 22} className="pc-tan" />
            <line x1={PX(query[0])} y1={PY(query[1])} x2={PX(query[0]) + normal[0] * 26} y2={PY(query[1]) - normal[1] * 26} className="pc-norm" />
            <text x={PX(query[0]) + normal[0] * 30} y={PY(query[1]) - normal[1] * 30} className="pc-normlbl">法线</text>
          </>}
        </svg>

        <div className="pc-flow">
          <div className={`pc-blk${showVoxel ? '' : ' pc-off'}`}>
            <span className="pc-n">①</span> 体素下采样 L={L}、每格取质心 {showVoxel ? <>→ {raw.length} 点降到 <b>{voxels.length}</b>（密度均匀、L 越大越粗）</> : '—'}
          </div>
          <div className={`pc-blk${showNbr ? '' : ' pc-off'}`}>
            <span className="pc-n">②</span> 找 k 近邻 {showNbr ? <>对点 ({query}) 取 <b>{nbrs.length}</b> 个最近邻（法线是局部性质、要邻域）</> : '—'}
          </div>
          <div className={`pc-blk${showCov ? '' : ' pc-off'}`}>
            <span className="pc-n">③</span> 邻域协方差 C {showCov ? <>=[[{cov[0].join(', ')}],[{cov[1].join(', ')}]]（描述点云往哪散、散多大）</> : '—'}
          </div>
          {showPca && (
            <div className="pc-pca">
              <span className="pc-n">④</span> PCA：λ大={lamBig}→<b className="pc-tanc">切向 [{tangent}]</b>（点云铺开方向）；λ小={lamSmall}→<b className="pc-normc">法线 [{normal}]</b>（方差最小⊥面）。<b>法线=最小特征值的特征向量</b>；λ小/λ大≈{Math.round((lamSmall / lamBig) * 100) / 100} 很小→局部很平、法线可靠（两 λ 都不小=边/角）。
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>点云预处理 = 体素下采样 + 法线估计</b>：下采样(边长 L 网格取质心、降密度均匀化)；法线(k 近邻→协方差→PCA，<b>最小特征值的特征向量=法线</b>、最大的=切向、λ 比判平面/边/角)。<b>连</b>：「ICP」配准前先下采样(快稳)、点到面 ICP 的误差要法线、法向一致性剔外点；PCA 和「PCA 降维」同一套特征分解。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
