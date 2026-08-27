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

        {phase === 'done'
          ? <p className="scnote">{G} 级流水线、{micro} 个微批:利用率 <b>{util}%</b>、气泡 <b>{bubblePct}%</b>。只喂 1 个 batch 时同时只有 1 张卡干活(气泡 (G−1)/G=75%);<b>把 batch 切成 M 个微批</b>首尾衔接地流进来,稳态时 {G} 张卡同时各算一个,气泡只剩开头注入 + 结尾排空,占比 <b>(G−1)/(M+G−1)</b>——微批越多越小。调「micro」看气泡缩小(但微批太碎也划不来,M 有甜点)。这就是 GPipe/1F1B 流水线调度的核心。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{t < G - 1 ? '开头「注入」:后面的卡还没轮到、在空等——这就是气泡。' : '中段「满载」:每张卡都在算一个微批,流水线跑满了。'}微批越多,注入/排空占比越小。</p>}
      </div>
    </div>
  )
}
