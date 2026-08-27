/** 舞台：内积=相似度 —— a 固定、b 转角，内积=|a||b|cosθ 从最大→0→最负 */
import type { DotSimState } from '@engine/kernels/dotsim.ts'
import type { StageProps } from '../types.ts'

const SC = 14                  // 世界 → 像素
const OX = 60, OY = 60         // 原点在 viewBox 里的位置
const px = (x: number) => OX + x * SC
const py = (y: number) => OY - y * SC

export function DotSimStage({ state }: StageProps<DotSimState>) {
  const { angleDeg, ax, ay, bx, by, dot, magA, magB, cosSim, proj, phase } = state
  const started = angleDeg >= 0
  // 投影点在 a 方向（a 沿 +x），投影长度 = proj
  const projX = proj
  const ppos = ((cosSim + 1) / 2) * 100
  return (
    <div className="card">
      <h3>内积 = 相似度 <span className="hint">注意力凭什么用 Q·K 打分</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? `${angleDeg}°` : '—'}</span><span className="scdl">夹角 θ</span></div>
          <div className="scdk"><span className="scdn hot">{started ? dot.toFixed(2) : '—'}</span><span className="scdl">内积 a·b</span></div>
          <div className="scdk"><span className="scdn">{started ? cosSim.toFixed(2) : '—'}</span><span className="scdl">余弦相似度</span></div>
        </div>

        <div className="dswrap">
          <svg className="dsplot" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet">
            {/* 轴 */}
            <line x1="6" y1={OY} x2="114" y2={OY} className="dsaxis" />
            <line x1={OX} y1="6" x2={OX} y2="114" className="dsaxis" />
            {/* 投影：b 尖到 a 的垂线 + a 上的投影段 */}
            {started && (
              <>
                <line x1={px(bx)} y1={py(by)} x2={px(projX)} y2={py(0)} className="dsproj" />
                <line x1={OX} y1={OY} x2={px(projX)} y2={py(0)} className="dsprojseg" />
              </>
            )}
            {/* a 向量 */}
            <line x1={OX} y1={OY} x2={px(ax)} y2={py(ay)} className="dsvec a" markerEnd="url(#ds-a)" />
            {/* b 向量 */}
            {started && <line x1={OX} y1={OY} x2={px(bx)} y2={py(by)} className="dsvec b" markerEnd="url(#ds-b)" />}
            <text x={px(ax) + 2} y={py(ay) + 4} className="dslab a">a</text>
            {started && <text x={px(bx) + (bx < 0 ? -8 : 2)} y={py(by) - 2} className="dslab b">b</text>}
            <defs>
              <marker id="ds-a" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--dim)" /></marker>
              <marker id="ds-b" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--now)" /></marker>
            </defs>
          </svg>

          {/* 余弦相似度尺 */}
          <div className="dsmeter">
            <span className="dsmend">−1<br /><i>反向</i></span>
            <div className="dsmtrack">
              <span className="dsmmid" />
              {started && <span className="dsmmark" style={{ left: `${ppos}%` }}>▲</span>}
            </div>
            <span className="dsmend r">+1<br /><i>同向</i></span>
          </div>
          <div className="orcap">
            {started ? `a·b = |a||b|cosθ = ${magA}×${magB}×${(cosSim).toFixed(2)} = ${dot.toFixed(2)}；也 = |a| × (b 在 a 上的投影 ${proj.toFixed(2)})`
              : '按「下一步」让 b 从与 a 同向转到反向'}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">θ 从 0°转到 180°:内积 6→<b>0</b>(正交)→−6，余弦 1→0→−1。内积 a·b=|a||b|cosθ,长度固定时它纯粹量"<b>方向多一致</b>":同向最大、正交为 0、反向最负。这就是<b>注意力用 Q·K 打分</b>的根据——query 与 key 越方向一致(相关),内积越大、softmax 权重越高;无关方向内积≈0(接「高维近正交」)。检索、推荐、词向量类比全靠它。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>看 b 尖投到 a 上的那一段:内积 = |a| × 这个投影。b 越"倒向 a"投影越长、内积越大;转到垂直(90°)投影为 0、内积为 0;继续转过去投影变负、内积变负。</p>}
      </div>
    </div>
  )
}
