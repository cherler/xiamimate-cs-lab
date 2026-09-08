/** 舞台：流水线并行 PP —— G 级流水线的调度表，微批填气泡，util/bubble 随 M 变 */
import type { PPState } from '@engine/kernels/pp.ts'
import type { StageProps } from '../types.ts'

const MB_COLORS = ['var(--now)', 'var(--hit)', 'var(--f-tag)', 'var(--miss)', '#7A54C9', '#2E9464', '#B26A22', '#4E46D6']

export function PPStage({ state }: StageProps<PPState>) {
  const { stages, micro, t, totalTime, filled, bubblePct, util, phase } = state
  const G = stages
  return (
    <div className="card">
      <h3>流水线并行 PP <span className="hint">按层切到多卡，用微批填掉流水线气泡</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{G}</span><span className="scdl">流水级(卡)</span></div>
          <div className="scdk"><span className="scdn">{micro}</span><span className="scdl">微批数 M</span></div>
          <div className="scdk"><span className="scdn hot">{util}%</span><span className="scdl">利用率</span></div>
          <div className="scdk"><span className="scdn" style={{ color: 'var(--miss)' }}>{bubblePct}%</span><span className="scdl">气泡</span></div>
        </div>

        {/* 调度表 stages × time */}
        <div className="ppwrap">
          <div className="ppgrid" style={{ gridTemplateColumns: `auto repeat(${totalTime}, 1fr)` }}>
            <div className="ppcorner" />
            {Array.from({ length: totalTime }, (_, tt) => (
              <div key={tt} className={`pptime ${tt === t ? 'now' : ''}`}>{tt + 1}</div>
            ))}
            {filled.map((row, s) => (
              <div key={s} className="pprow" style={{ display: 'contents' }}>
                <div className="ppstage">卡{s}</div>
                {row.map((v, tt) => (
                  <div key={tt} className={`ppcell ${v === -2 ? 'future' : v === -1 ? 'bubble' : 'busy'} ${tt === t ? 'nowcol' : ''}`}
                    style={v >= 0 ? { background: `color-mix(in srgb, ${MB_COLORS[v % 8]} 60%, var(--panel))`, borderColor: MB_COLORS[v % 8] } : undefined}>
                    {v >= 0 ? `μ${v}` : v === -1 ? '' : ''}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="orcap">
            {phase === 'done'
              ? <span>总时长 {totalTime} · 利用率 <b>{util}%</b> · 气泡 <b>{bubblePct}%</b>（(G−1)/(M+G−1)）</span>
              : t >= 0 ? <span>时刻 {t + 1}/{totalTime}：彩色格=某张卡在算某个微批 μ，灰格=气泡(空等)</span>
                : '按「下一步」看微批一个个流进流水线'}
          </div>
        </div>

        {/*  ── 甜点曲线（2026-09-08 加）──
             光看气泡会得出"M 越大越好"，而老结论里偏偏写着"M 有甜点" —— 自相矛盾。
             真相是：真实总时长 = (M+G−1)·(1/M+c)，是条 **U 形**曲线，最低点就是甜点。
             这条曲线现算，最低点标出来，旁边写着连续解 √((G−1)/c)。 */}
        <div className="mlwrap">
          <p className="gbsec"><b>微批不是越多越好</b>
            <span>纵轴=真实总时长 (M+G−1)·(1/M+c)；每个微批有固定开销 c，所以 M 太大反而更慢</span></p>
          <svg className="ppcurve" viewBox="0 0 100 100" preserveAspectRatio="none">
            {(() => {
              const cv = state.mCurve
              const hi = Math.max(...cv.map(c => c[1])) * 1.05
              const lo = Math.min(...cv.map(c => c[1])) * 0.95
              const X = (i: number) => i / (cv.length - 1) * 100
              const Y = (v: number) => 100 - (v - lo) / (hi - lo) * 88 - 6
              return <>
                <path d={cv.map(([, v], i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')}
                  className="ppcline" fill="none" vectorEffect="non-scaling-stroke" />
                {cv.map(([m, v], i) => (
                  <circle key={m} cx={X(i)} cy={Y(v)}
                    r={m === state.bestM ? 2.6 : m === micro ? 2.2 : 1.1}
                    className={m === state.bestM ? 'ppbest' : m === micro ? 'ppnow' : 'ppdot'} />
                ))}
              </>
            })()}
          </svg>
          <div className="orcap">
            {state.mCurve.map(([m, v]) => `M=${m}:${v.toFixed(2)}`).join('　')}
            　·　最低点 <b>M={state.bestM}</b>（连续解 √((G−1)/c)={state.bestMTheory}）
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">{G} 级流水线、{micro} 个微批：利用率 <b>{util}%</b>、气泡 <b>{bubblePct}%</b>（=(G−1)/(M+G−1)）。
            只喂 1 个 batch 时同时只有 1 张卡干活；<b>把 batch 切成 M 个微批</b>首尾衔接地流进来，
            稳态时 {G} 张卡同时各算一个，气泡只剩开头注入 + 结尾排空。
            　但<b>不是越多越好</b>：算上每个微批 {(state.overhead * 100).toFixed(1)}% 的固定开销，
            真实总时长是条 <b>U 形</b>曲线，最低点在 <b>M={state.bestM}</b>
            （连续解 M*=√((G−1)/c)={state.bestMTheory}）—— 这个"甜点"是<b>算出来的</b>，不是一句"太碎也划不来"。
            　另一半代价在<b>显存</b>：GPipe 要同时留着 <b>{state.peakActs}</b> 份微批的激活等反向，
            1F1B 只需 <b>{state.peak1f1b}</b> 份（≈级数 G）—— 两种调度气泡一样，差别在这儿。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{t < G - 1 ? '开头「注入」：后面的卡还没轮到、在空等 —— 这就是气泡。' : '中段「满载」：每张卡都在算一个微批，流水线跑满了。'}微批越多，注入/排空占比越小 —— 但底下那条曲线会告诉你多到什么程度就亏了。</p>}
      </div>
    </div>
  )
}
