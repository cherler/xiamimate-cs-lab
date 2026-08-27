/** 舞台：RoPE —— 单位圆上按位置旋转的向量 + 轨迹 + 模长不变 + 与位置0点积=cos */
import type { RopeState } from '@engine/kernels/rope.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function RopeStage({ state }: StageProps<RopeState>) {
  const { thetaDeg, pos, angleDeg, x, y, norm, dotWith0, trail, phase } = state
  const C = 96, R = 74          // 圆心、半径（viewBox 坐标）
  const px = C + x * R, py = C - y * R   // y 轴翻转（屏幕向下为正）
  return (
    <div className="card">
      <h3>RoPE 旋转位置编码 <span className="hint">位置 = 旋转角度 · 旋转不改模长</span></h3>
      <div className="body">
        <div className="ropewrap">
          {/* 单位圆 */}
          <svg className="ropesvg" viewBox="0 0 192 192" aria-hidden="true">
            <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line)" strokeWidth="1" />
            <line x1={C - R - 6} y1={C} x2={C + R + 6} y2={C} stroke="var(--line-soft)" strokeWidth="1" />
            <line x1={C} y1={C - R - 6} x2={C} y2={C + R + 6} stroke="var(--line-soft)" strokeWidth="1" />
            {/* 轨迹点 */}
            {trail.map((t, k) => (
              <circle key={k} cx={C + t.x * R} cy={C - t.y * R} r={k === trail.length - 1 ? 0 : 3.2}
                fill="var(--f-tag)" opacity={0.22 + 0.5 * (k / Math.max(trail.length - 1, 1))} />
            ))}
            {/* 位置0 参考向量 */}
            <line x1={C} y1={C} x2={C + R} y2={C} stroke="var(--line)" strokeWidth="1.4" strokeDasharray="3 3" />
            <text x={C + R - 4} y={C - 5} fontSize="8" fill="var(--faint)">位置0</text>
            {/* 当前向量 */}
            {pos >= 0 && <>
              <line x1={C} y1={C} x2={px} y2={py} stroke="var(--now)" strokeWidth="2.4" markerEnd="url(#rparr)" />
              <circle cx={px} cy={py} r="4.5" fill="var(--now)" />
            </>}
            <defs><marker id="rparr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--now)" /></marker></defs>
          </svg>

          {/* 读数 */}
          <div className="ropestats">
            <div className="ropest"><span className="rk">位置 p</span><span className="rv">{phase === 'done' ? '—' : pos}</span></div>
            <div className="ropest"><span className="rk">旋转角 p·θ</span><span className="rv">{angleDeg}°</span></div>
            <div className="ropest ok"><span className="rk">模长 |v|</span><span className="rv">{norm.toFixed(3)}</span><span className="rnote">旋转保范</span></div>
            <div className="ropest"><span className="rk">与位置0 点积</span><span className="rv">{dotWith0.toFixed(3)}</span><span className="rnote">= cos(p·{thetaDeg}°)，只看相对位置</span></div>
          </div>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
