/** 舞台：delta_timestamps —— episode 条 + 两窗口(观测/动作块)表格逐列算出(秒→帧→钳→pad) */
import type { DTState, Cell } from '@engine/kernels/deltats.ts'
import type { StageProps } from '../types.ts'

function Win({ title, cells, s }: { title: string; cells: Cell[]; s: DTState }) {
  return (
    <div className="dt-win">
      <div className="dt-h">{title}</div>
      <div className="dt-tablewrap">
        <table className="dt-table">
          <thead><tr><th className="l">偏移(秒)</th><th className={s.showIdx ? '' : 'off'}>帧偏移</th><th className={s.showClamp ? '' : 'off'}>目标帧</th><th className={s.showClamp ? '' : 'off'}>取到帧</th><th className={s.showPad ? 'hot' : 'off'}>pad</th></tr></thead>
          <tbody>
            {cells.map((c: Cell, i: number) => (
              <tr key={i} className={s.showPad && c.pad ? 'padded' : ''}>
                <td className="l">{c.deltaS}s</td>
                <td>{s.showIdx ? c.deltaIdx : '—'}</td>
                <td>{s.showClamp ? c.raw : '—'}</td>
                <td>{s.showClamp ? (c.query !== c.raw ? <><b>{c.query}</b><em className="dt-clamped"> 钳</em></> : c.query) : '—'}</td>
                <td className={s.showPad ? 'hot' : ''}>{s.showPad ? (c.pad ? <b className="dt-pad">True</b> : 'False') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DeltaTsStage({ state }: StageProps<DTState>) {
  const { stage, pos, fps, epStart, epEnd, absIdx, obs, act } = state
  const span = epEnd - epStart
  const pctOf = (f: number) => `${((f - epStart) / span) * 100}%`

  return (
    <div className="card">
      <h3>delta_timestamps · 时序窗口 <span className="hint">策略要的历史观测/未来动作块，从扁平表里怎么取</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{fps}<em className="cc-u"> fps</em></span><span className="scdl">采集频率</span></div>
          <div className="scdk"><span className="scdn">{absIdx}</span><span className="scdl">当前采样帧</span></div>
          <div className="scdk"><span className="scdn">{pos}</span><span className="scdl">位置</span></div>
        </div>

        {/* episode 条 */}
        <div className="dt-ep">
          <div className="dt-epbar"><div className="dt-cur" style={{ left: pctOf(absIdx) }} title={`当前帧 ${absIdx}`} /></div>
          <div className="dt-epscale"><span>episode 起 {epStart}</span><span className="dt-curl" style={{ left: pctOf(absIdx) }}>当前 {absIdx}</span><span>止 {epEnd}</span></div>
        </div>

        <Win title={`历史观测窗口（往回几帧）`} cells={obs} s={state} />
        <Win title={`未来动作块（ACT chunk）`} cells={act} s={state} />

        {stage === 'done'
          ? <p className="scnote"><b>delta_timestamps = "要窗口"到"取哪些帧"的桥</b>：① 秒→帧 <b>round(偏移·fps)</b>(fps 换算让不同频率数据集通用)；② <b>clamp 进本 episode</b>[{epStart},{epEnd})、越界钳到边界帧、不跨轨迹；③ <b>pad 掩码</b>越界标 True、喂 loss 排除、不污染训练。<b>ACT 的动作块正是 action_delta_indices=range(K)=[0..K-1]</b>——这课就是"那块动作在数据侧怎么取出来的"。面试延伸：parquet 存低维 / mp4 存图像、episode 边界钳+掩码、fps 记进 meta。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。</p>}
      </div>
    </div>
  )
}
