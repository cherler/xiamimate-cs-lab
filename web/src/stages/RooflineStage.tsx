/** 舞台：Roofline —— log-log 屋顶线图（带宽斜坡→算力平顶）+ 批大小的点逐个爬上来 */
import type { RooflineState } from '@engine/kernels/roofline.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function RooflineStage({ state }: StageProps<RooflineState>) {
  const { ridge, peakTFLOPs, bwTBs, batch, ai, bound, attainTFLOPs, util, points, phase } = state
  //  log-log 画布
  const W = 340, H = 210, mL = 40, mR = 14, mT = 12, mB = 30
  const pw = W - mL - mR, ph = H - mT - mB
  const aiMin = 0.5, aiMax = 512, pMin = 1, pMax = 400
  const lx = (a: number) => mL + (Math.log10(a) - Math.log10(aiMin)) / (Math.log10(aiMax) - Math.log10(aiMin)) * pw
  const ly = (p: number) => mT + ph - (Math.log10(p) - Math.log10(pMin)) / (Math.log10(pMax) - Math.log10(pMin)) * ph
  //  屋顶：带宽斜坡 perf=AI*bw(=2) 到脊点，再算力平顶 peak
  const roofBW = [aiMin, ridge].map(a => `${lx(a)},${ly(a * bwTBs)}`)
  const roofC = [ridge, aiMax].map(a => `${lx(a)},${ly(peakTFLOPs)}`)
  const aiTicks = [1, 10, 100]
  const pTicks = [1, 10, 100]
  return (
    <div className="card">
      <h3>Roofline 性能建模 <span className="hint">算术强度 vs 屋顶：卡带宽还是卡算力</span></h3>
      <div className="body">
        <div className="rfwrap">
          <svg className="rfsvg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            {/* 网格 */}
            {aiTicks.map(t => <g key={`x${t}`}><line x1={lx(t)} y1={mT} x2={lx(t)} y2={mT + ph} stroke="var(--line-soft)" strokeWidth="1" /><text x={lx(t)} y={H - 12} textAnchor="middle" fontSize="9" fill="var(--faint)" fontFamily="var(--mono)">{t}</text></g>)}
            {pTicks.map(t => <g key={`y${t}`}><line x1={mL} y1={ly(t)} x2={mL + pw} y2={ly(t)} stroke="var(--line-soft)" strokeWidth="1" /><text x={mL - 5} y={ly(t) + 3} textAnchor="end" fontSize="9" fill="var(--faint)" fontFamily="var(--mono)">{t}</text></g>)}
            <text x={mL + pw / 2} y={H - 1} textAnchor="middle" fontSize="9" fill="var(--dim)">算术强度 AI（FLOP/字节，log）</text>
            <text x={10} y={mT + ph / 2} textAnchor="middle" fontSize="9" fill="var(--dim)" transform={`rotate(-90 10 ${mT + ph / 2})`}>TFLOP/s（log）</text>
            {/* 屋顶线 */}
            <polyline points={roofBW.join(' ')} fill="none" stroke="var(--miss)" strokeWidth="2" />
            <polyline points={roofC.join(' ')} fill="none" stroke="var(--hit)" strokeWidth="2" />
            {/* 脊点竖线 */}
            <line x1={lx(ridge)} y1={mT} x2={lx(ridge)} y2={mT + ph} stroke="var(--now)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={lx(ridge)} y={mT + 8} textAnchor="middle" fontSize="8.5" fill="var(--now)">脊点 {ridge}</text>
            {/* 区域标注 */}
            <text x={lx(3)} y={mT + ph - 6} fontSize="8.5" fill="var(--miss)">卡带宽</text>
            <text x={lx(230)} y={mT + 14} fontSize="8.5" fill="var(--hit)">卡算力</text>
            {/* 已走过的点 */}
            {points.map((pt, k) => {
              const cur = k === points.length - 1 && phase !== 'done'
              return <g key={k}>
                <circle cx={lx(pt.ai)} cy={ly(pt.attain)} r={cur ? 5 : 3.4} fill={cur ? 'var(--now)' : 'var(--f-tag)'} opacity={cur ? 1 : 0.7} />
                <text x={lx(pt.ai)} y={ly(pt.attain) - 8} textAnchor="middle" fontSize="8" fill={cur ? 'var(--now)' : 'var(--faint)'}>b{pt.batch}</text>
              </g>
            })}
          </svg>

          <div className="rfstats">
            <div className="rfst"><span className="rk">批大小</span><span className="rv">{phase === 'done' ? '—' : batch}</span></div>
            <div className="rfst"><span className="rk">算术强度 AI</span><span className="rv">{ai.toFixed(1)}</span><span className="rnote">脊点 {ridge}</span></div>
            <div className={`rfst ${bound === 'memory' ? 'bad' : 'ok'}`}><span className="rk">瓶颈</span><span className="rv">{bound === 'memory' ? '带宽' : '算力'}</span><span className="rnote">{bound === 'memory' ? 'AI < 脊点' : 'AI ≥ 脊点'}</span></div>
            <div className="rfst"><span className="rk">可达性能</span><span className="rv">{attainTFLOPs}<i>TF/s</i></span></div>
            <div className="rfst"><span className="rk">算力利用率</span><span className="rv">{Math.round(util * 100)}%</span><span className="rnote">峰值 {Math.round(peakTFLOPs)} TF · 带宽 {bwTBs} TB/s</span></div>
          </div>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
