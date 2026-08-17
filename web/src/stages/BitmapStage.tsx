/** 舞台：位示图 —— 位矩阵 + 换算公式 */
import type { BitmapState } from '@engine/kernels/bitmap.ts'
import type { StageProps } from '../types.ts'

export function BitmapStage({ doc, state, tab }: StageProps<BitmapState>) {
  const wordBits = doc.params.wordBits as number
  if (tab === 'calc') return <Calc state={state} wordBits={wordBits} />
  return <Grid state={state} wordBits={wordBits} />
}

function Grid({ state, wordBits }: { state: BitmapState; wordBits: number }) {
  const touched = new Set(state.blocks)
  return (
    <div className="card">
      <h3>位示图 <span className="hint">每行一个字（{wordBits} 位）· 1 = 已占用</span></h3>
      <div className="body scroll">
        <div className="bmgrid">
          <div className="bmhead">
            <span className="wl">字号</span>
            {Array.from({ length: wordBits }, (_, b) => <span key={b} className="bh">{b}</span>)}
          </div>
          {state.bits.map((w, wi) => (
            <div className="bmrow" key={wi}>
              <span className="wl">{wi}</span>
              {w.map((v, bi) => {
                const blk = wi * wordBits + bi
                return (
                  <span key={bi}
                    className={`bm ${v ? 'used' : 'free'} ${touched.has(blk) ? 'hot' : ''}`}
                    title={`盘块 ${blk}（字 ${wi}、位 ${bi}）`}>{v}</span>
                )
              })}
            </div>
          ))}
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
          <div className="pr"><span className="k">空闲块数</span><span className="v">{state.freeCount}</span></div>
        </div>
      </div>
    </div>
  )
}

/** 换算公式：这个内容全部的考点 */
function Calc({ state, wordBits }: { state: BitmapState; wordBits: number }) {
  const b = state.blocks[0] ?? 0
  const w = Math.floor(b / wordBits), bit = b % wordBits
  return (
    <div className="card">
      <h3>换算公式 <span className="hint">这个内容的考点全在这两条式子上</span></h3>
      <div className="body">
        <div className="bmcalc">
          <div className="bmc">
            <span className="k">由字号、位号求盘块号</span>
            <b>盘块号 = 字号 × 字长 + 位号</b>
            <em>{w} × {wordBits} + {bit} = {b}</em>
          </div>
          <div className="bmc">
            <span className="k">由盘块号求字号、位号</span>
            <b>字号 = 盘块号 ÷ 字长（取整）　位号 = 盘块号 mod 字长</b>
            <em>{b} ÷ {wordBits} = {w} …… {bit}</em>
          </div>
        </div>
        <p className="tnote">
          上面按<b>字号、位号都从 0 起编</b>。若教材约定从 1 开始编号，两条式子要各减/加 1：<br />
          盘块号 = (字号 − 1) × 字长 + 位号，　字号 = ⌊盘块号 ÷ 字长⌋ + 1，位号 = 盘块号 mod 字长。<br />
          <b>看清题目用哪种约定</b> —— 这一处是这类题最主要的失分点。
        </p>
        <div className="phasenow">
          <div className="pr"><span className="k">本步盘块</span>
            <span className="v">{state.blocks.length ? state.blocks.join('、') : '—'}</span></div>
          <div className="pr"><span className="k">动作</span>
            <span className="v">{state.act === 'alloc' ? '分配' : state.act === 'free' ? '回收' : '失败'}</span></div>
        </div>
      </div>
    </div>
  )
}
