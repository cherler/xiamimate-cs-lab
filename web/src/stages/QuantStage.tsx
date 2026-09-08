/**
 * 舞台：权重量化 —— 256 个权重一根一根竖着摆，被压成 0 的标红
 *
 * 2026-09-08 跟着内核一起重画。老版本给每个权重列一行表格（w / q / ŵ / 误差），
 * 8 个权重时挺好，256 个就是 256 行 —— 而且**表格恰恰看不见这个实验最该看见的事**：
 *
 *   异常值把 scale 撑大之后，**一大片小权重集体变成 0**。
 *
 * 那是个"一片"的现象，得用一片东西来画。所以主视图换成 256 根细条：
 * 高度 = |w|，**被压成 0 的标红**，组的分界画竖线，异常值单独标出来。
 * int4 + 整张 scale + 有异常值那一档，屏幕上会红掉一大片 —— 212/256。
 * 表格只留前 8 行，保住"能手核"这条老路。
 */
import type { QuantState } from '@engine/kernels/quant.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function QuantStage({ state }: StageProps<QuantState>) {
  const { bits, qmax, scale, scales, groups, groupSize, weights, ints, deq, errs,
    maxErr, relErr, zeroed, zeroedAt4, zeroedFlat4, bytesFp32, bytesQ, effBits, kind, gTag, phase } = state
  const saved = Math.round((1 - bytesQ / bytesFp32) * 100)
  const N = weights.length
  const wMax = Math.max(...weights.map(Math.abs)) || 1
  const outlierAt = (w: number) => Math.abs(w) > 2      // 造数据时埋的异常值都在 5 以上
  const crushed = (k: number) => ints[k] === 0 && Math.abs(weights[k]) > 1e-6

  return (
    <div className="card">
      <h3>权重量化 <span className="hint">位宽省显存，异常值毁 scale</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">int{bits}</span><span className="scdl">量化位数（±{qmax}）</span></div>
          <div className="scdk"><span className={`scdn ${relErr > 0.15 ? '' : 'hot'}`}>{(relErr * 100).toFixed(1)}%</span>
            <span className="scdl">相对误差（RMS）</span></div>
          <div className="scdk"><span className={`scdn ${zeroed > N * 0.3 ? '' : ''}`}>{zeroed} / {N}</span>
            <span className="scdl">被压成 0 的权重</span></div>
          <div className="scdk"><span className="scdn">{effBits}</span><span className="scdl">等效 bit/权重（含 scale）</span></div>
          <div className="scdk"><span className="scdn good">{saved}%</span><span className="scdl">省显存</span></div>
        </div>

        {zeroed > N * 0.3 && (
          <div className="qzWarn">
            🩸 <b>{zeroed}/{N}（{Math.round(100 * zeroed / N)}%）的权重被四舍五入压成了 0。</b>
            {groups === 1 && kind.startsWith('有异常值')
              ? ' scale 由 max|w| 定，而这里有几个异常值把它整个撑大了 —— 剩下的小权重全落在同一个量化格里。'
              : ' 量化格太粗，小权重落不进任何一格。'}
            {' '}位宽省下的显存，<b>换来的是存了一堆 0</b>。
          </div>
        )}

        {/*  主视图：一根条一个权重。红=被压成 0，橙=异常值，竖线=组边界 */}
        <div className="qzbars">
          {weights.map((w, k) => (
            <span key={k}
              className={`qzb ${crushed(k) ? 'zero' : ''} ${outlierAt(w) ? 'out' : ''} ${groups > 1 && k % groupSize === 0 && k > 0 ? 'gsep' : ''}`}
              style={{ height: `${Math.max(2, Math.abs(w) / wMax * 100)}%` }} />
          ))}
        </div>
        <div className="orcap">
          每根条 = 一个权重（高 = |w|）。<span className="qzlg zero">红 = 被压成 0</span>
          <span className="qzlg out">橙 = 异常值</span>
          {groups > 1 ? `；竖线是组边界（分 ${groups} 组、每组 ${groupSize} 个，各自一个 scale）` : `；整张只有一个 scale = ${scale}`}
        </div>

        {/*  各组 scale：异常值那几组会明显更大 */}
        {groups > 1 && (
          <div className="qzscales">
            <span className="qzst">各组 scale（越大 = 那一组的量化格越粗）</span>
            <span className="qzsrow">
              {scales.map((sc, g) => (
                <span key={g} className={`qzsc ${sc > Math.min(...scales) * 3 ? 'big' : ''}`}
                  style={{ height: `${Math.max(8, sc / Math.max(...scales) * 100)}%` }} title={`第 ${g} 组 scale=${sc}`} />
              ))}
            </span>
          </div>
        )}

        {/*  前 8 个权重的明细：保住"能手核"这条老路 */}
        <div className="qztab">
          <div className="qzhead"><span>w (fp32)</span><span>q = round(w/scale)</span><span>ŵ = q·scale</span><span>误差</span></div>
          {weights.slice(0, 8).map((w, k) => (
            <div key={k} className={`qzr ${crushed(k) ? 'pend' : ''}`}>
              <span className="qzw">{w}</span>
              <span className="qzq">{ints[k]}</span>
              <span className="qzd">{(deq[k] ?? 0).toFixed(3)}</span>
              <span className="qze">{(errs[k] ?? 0).toFixed(3)}</span>
            </div>
          ))}
          <div className="qzmore">…共 {N} 个（上面那排条是全部）</div>
        </div>

        <div className="qzfoot">
          <div className="qzmem">
            <div className="qzbar"><span className="qzbl">fp32</span><div className="qztrack"><div className="qzfill bad" style={{ width: '100%' }}>{bytesFp32} B</div></div></div>
            <div className="qzbar"><span className="qzbl">int{bits}</span><div className="qztrack"><div className="qzfill ok" style={{ width: `${(bytesQ / bytesFp32) * 100}%` }}>{bytesQ} B</div></div></div>
          </div>
          <div className="qzsave"><span className="qzsaven">省 {saved}%</span>
            <span className="qzsavel">显存　·　等效 {effBits} bit/权重{groups > 1 ? `（含 ${groups} 个 fp16 scale）` : ''}　·　最大误差 {maxErr.toFixed(3)}</span></div>
        </div>

        {phase === 'done' && bits === 2 && (
          <p className="scnote">
            {gTag}、{kind}：int8 到 int2 一路扫下来，等效位宽降到 <b>{effBits}</b> bit/权重，
            相对误差涨到 <b>{(relErr * 100).toFixed(1)}%</b>。
            {kind.startsWith('有异常值') && groups === 1
              ? <>　⚠️ 但这一档真正的问题<b>不在位宽</b>：三个异常值把整张的 scale 撑大了，
                int4 就已经有 <b>{zeroedAt4}/{N}</b> 个权重被压成 0。<b>省下的显存全用来存 0 了。</b>
                　把「量化粒度」拨到分组再看 —— 异常值的破坏会被关进它自己那一组。
                这就是 GPTQ / AWQ / LLM.int8() 那一整条线在做的事。</>
              : kind.startsWith('有异常值')
                ? <>　分 {groups} 组之后，异常值只污染自己那几组，别的组的 scale 不受连累：
                  int4 下被压成 0 的从整张 scale 的 <b>{zeroedFlat4}</b> 个降到 <b>{zeroedAt4}</b> 个。
                  代价在"等效位宽"那一栏：每组多存一个 fp16 的 scale。
                  <b>组越小误差越小、开销也越大</b> —— 论文里"4-bit group128"那个 128 就是在这条线上挑的。</>
                : <>　换成<b>有异常值</b>那一档再看，那才是真实 LLM 权重的样子。</>}
          </p>
        )}

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
