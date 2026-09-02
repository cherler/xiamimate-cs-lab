/** 舞台：GJK 碰撞检测 —— 左世界空间(两凸形+当前支撑顶点) / 右 Minkowski 差空间(原点+单纯形演化+搜索方向) */
import type { GjkState } from '@engine/kernels/gjk.ts'
import type { StageProps } from '../types.ts'

// 世界空间变换 x∈[0,10] y∈[0,6]
const WX = (x: number) => 6 + x * 13
const WY = (y: number) => 88 - y * 13
// Minkowski 空间变换（原点居中偏右）
const MX = (x: number) => 90 + x * 11
const MY = (y: number) => 58 - y * 11
const poly = (pts: [number, number][], fx: (x: number) => number, fy: (y: number) => number) => pts.map(p => `${fx(p[0])},${fy(p[1])}`).join(' ')
const eq = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1]

export function GjkStage({ state }: StageProps<GjkState>) {
  const s = state
  const { A, B, mink, dir, a, sA, sB, adot, passed, simplex, contained, collide, scenLabel, iterNo } = s
  const showSup = s.stage === 'support' || s.stage === 'simplex' || s.stage === 'result'
  const dlen = Math.hypot(dir[0], dir[1]) || 1
  const dux = dir[0] / dlen, duy = dir[1] / dlen

  return (
    <div className="card">
      <h3>GJK 碰撞检测 <span className="hint">两凸形碰不碰 = 原点在不在 Minkowski 差 A⊖B 里；支撑函数懒惰围原点建单纯形</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{scenLabel.split('(')[0]}</span><span className="scdl">场景</span></div>
          <div className="scdk"><span className="scdn">{iterNo || '—'}</span><span className="scdl">GJK 轮次</span></div>
          <div className="scdk"><span className={`scdn${showSup ? (passed ? '' : ' gk-bad') : ''}`}>{showSup ? `${adot}` : '—'}</span><span className="scdl">a·d(≥0 越过原点)</span></div>
          <div className="scdk"><span className={`scdn${collide == null ? '' : collide ? ' gk-good' : ' gk-bad'}`}>{s.stage === 'done' ? (collide ? '碰撞' : '不碰') : contained ? '含原点·碰' : '—'}</span><span className="scdl">结论</span></div>
        </div>

        <div className="gk-panes">
          {/* 世界空间 */}
          <div className="gk-pane">
            <div className="gk-cap">世界空间：两凸形 A、B</div>
            <svg className="gk-svg" viewBox="0 0 150 95" width="100%" height="120">
              <polygon points={poly(A, WX, WY)} className="gk-A" />
              <polygon points={poly(B, WX, WY)} className="gk-B" />
              <text x={WX(2.5)} y={WY(2.5)} className="gk-lbl">A</text>
              <text x={WX(B[0][0] + 1.5)} y={WY(B[0][1] + 1.5)} className="gk-lbl">B</text>
              {showSup && <>
                <circle cx={WX(sA[0])} cy={WY(sA[1])} r="3" className="gk-supA" />
                <circle cx={WX(sB[0])} cy={WY(sB[1])} r="3" className="gk-supB" />
              </>}
            </svg>
          </div>
          {/* Minkowski 差空间 */}
          <div className="gk-pane">
            <div className="gk-cap">Minkowski 差 A⊖B：原点在里=碰</div>
            <svg className="gk-svg" viewBox="0 0 150 116" width="100%" height="146">
              <polygon points={poly(mink, MX, MY)} className="gk-mink" />
              {/* 单纯形 */}
              {simplex.length === 3 && <polygon points={poly(simplex as [number, number][], MX, MY)} className={contained ? 'gk-simfill-hit' : 'gk-simfill'} />}
              {simplex.length === 2 && <line x1={MX(simplex[0][0])} y1={MY(simplex[0][1])} x2={MX(simplex[1][0])} y2={MY(simplex[1][1])} className="gk-simline" />}
              {simplex.map((p, k) => <circle key={k} cx={MX(p[0])} cy={MY(p[1])} r="2.6" className="gk-simpt" />)}
              {/* 当前支撑点 a */}
              {showSup && <circle cx={MX(a[0])} cy={MY(a[1])} r="3.4" className={passed ? 'gk-anew' : 'gk-anew-bad'} />}
              {/* 搜索方向 */}
              {showSup && <line x1={MX(0)} y1={MY(0)} x2={MX(0) + dux * 20} y2={MY(0) - duy * 20} className="gk-dir" />}
              {/* 原点 */}
              <line x1={MX(0) - 4} y1={MY(0)} x2={MX(0) + 4} y2={MY(0)} className="gk-orig" />
              <line x1={MX(0)} y1={MY(0) - 4} x2={MX(0)} y2={MY(0) + 4} className="gk-orig" />
              <text x={MX(0) + 5} y={MY(0) - 5} className="gk-origlbl">O</text>
            </svg>
          </div>
        </div>

        <div className="gk-read">
          {s.stage === 'intro'
            ? <span>GJK 把「两凸形碰不碰」变成「原点在不在 Minkowski 差里」，用<b>支撑函数</b>懒惰地围原点建单纯形。当前场景 <b>{scenLabel}</b>。</span>
            : s.stage === 'done'
              ? <span><b>结论：{collide ? '两形相交（碰）' : '两形分离（不碰）'}</b>（{iterNo} 轮）。{collide ? '单纯形围住原点=原点∈A⊖B；求穿透深度可接 EPA。' : '某轮 a·d<0、最远都没越过原点=原点在 A⊖B 外，GJK 提前停。'}</span>
              : showSup && !passed
                ? <span>第 {iterNo} 轮：朝 d=[{dir.join(',')}] 取支撑点 a=[{a.join(',')}]，<b className="gk-badc">a·d={adot}&lt;0</b> —— 沿 d 最远都没越过原点 → 原点在外、<b>不碰</b>。</span>
                : contained
                  ? <span>第 {iterNo} 轮：单纯形成三角形 [{simplex.map(p => `(${p})`).join(', ')}] 且<b className="gk-goodc">含原点</b> → 原点∈A⊖B → <b>碰！</b></span>
                  : <span>第 {iterNo} 轮：a=support_A−support_B=[{sA.join(',')}]−[{sB.join(',')}]=[{a.join(',')}]，a·d={adot}≥0 越过原点；{s.stage === 'simplex' ? <>doSimplex 后单纯形=[{simplex.map(p => `(${p})`).join(', ')}]、方向重新指向原点。</> : '把 a 加进单纯形。'}</span>}
        </div>

        {s.stage === 'done' && <p className="scnote"><b>GJK = Minkowski 差 + 支撑函数 + 单纯形</b>：两凸形碰 ⟺ 原点∈A⊖B；每轮只朝一个方向取一个最远点(不显式建整个差集)、懒惰围原点建三角形；<b>三角形含原点→碰</b>、<b>某轮 a·d&lt;0→不碰</b>(提前停)。<b>连</b>：「运动规划」每采点/连边都要碰撞检测、GJK 是最常用的凸-凸检测；求穿透深度接 EPA；对任意凸形只需支撑函数。</p>}
      </div>
    </div>
  )
}
