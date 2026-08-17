/** 舞台：Cache 命中率 —— 地址位域拆解 + 组织矩阵 / 相联度扫描 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { run } from '@engine/core/kernel.ts'
import { cacheKernel, type CacheState } from '@engine/kernels/cache.ts'
import { makeSweepKernel } from '@engine/kernels/sweep.ts'
import type { SimDocument } from '@engine/core/document.ts'
import type { StageProps } from '../types.ts'

const hex = (n: number) => '0x' + n.toString(16).toUpperCase()
const SHOW_BITS = 16

export function CacheStage({ doc, state, trace, tab }: StageProps<CacheState>) {
  if (tab === 'sweep') return <Sweep doc={doc} />
  return <Organization doc={doc} state={state} trace={trace} />
}

// ═══ 视图一：位域拆解 + 组织矩阵 ════════════════════════
function Organization({ doc, state }: { doc: SimDocument; state: CacheState; trace: CacheState[] }) {
  const blockSize = doc.params.blockSizeBytes as number
  const ways = doc.params.associativity as number
  const cacheSize = doc.params.cacheSizeBytes as number
  const numSets = cacheSize / blockSize / ways
  const offsetBits = Math.log2(blockSize)
  const indexBits = Math.log2(numSets)

  const svgRef = useRef<SVGSVGElement>(null)
  const idxRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const [, force] = useState(0)

  // 正交走线：index 三位 → 目标组。原理图惯例，不是装饰性曲线。
  useLayoutEffect(() => {
    const svg = svgRef.current, a = idxRef.current, b = rowRef.current
    if (!svg || !a || !b) return
    const box = svg.getBoundingClientRect()
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
    const x1 = ra.left + ra.width / 2 - box.left
    const x2 = rb.left - box.left - 6
    const y2 = rb.top + rb.height / 2 - box.top
    svg.innerHTML =
      `<path d="M ${x1} 0 V 11 H ${x2} V ${y2}" fill="none" stroke="var(--f-idx)"
         stroke-width="1.2" stroke-dasharray="2.5 3" opacity=".9"/>
       <circle cx="${x1}" cy="0" r="2.2" fill="var(--f-idx)"/>
       <path d="M ${x2 - 3.2} ${y2 - 4} L ${x2 + 3.2} ${y2 - 4} L ${x2} ${y2 + 1.5} Z" fill="var(--f-idx)"/>`
  })

  useLayoutEffect(() => {
    const on = () => force(n => n + 1)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  const bits = state.address.toString(2).padStart(SHOW_BITS, '0').split('')
  const tagBits = bits.slice(0, SHOW_BITS - indexBits - offsetBits)
  const idxBits = bits.slice(SHOW_BITS - indexBits - offsetBits, SHOW_BITS - offsetBits)
  const offBits = bits.slice(SHOW_BITS - offsetBits)

  return (
    <div className="card">
      <h3>地址如何落到某一组某一路</h3>

      <div className="bits">
        <div className="bitrow">
          <Seg cls="s-tag" k="tag" bits={tagBits} v={hex(state.tag)} truncated />
          <Seg cls="s-idx" k="index" bits={idxBits} v={String(state.setIndex)} innerRef={idxRef} />
          <Seg cls="s-off" k="offset" bits={offBits} v={String(state.offset)} />
        </div>
        <div className="bitnote">
          当前访问 <span className="a">{hex(state.address)}</span>
          {' · '}仅显示低 {SHOW_BITS} 位（tag 实际 {32 - indexBits - offsetBits} 位，高位在本例中全为 0）
        </div>
      </div>

      <div className="stage">
        <svg ref={svgRef} />
        <div className="sets">
          {state.sets.map((set, si) => {
            const active = si === state.setIndex
            const vacant = !active && set.every(e => e === null)
            return (
              <div key={si} className={`setrow ${active ? 'active' : ''} ${vacant ? 'vacant' : ''}`}>
                <div className="setlbl" ref={active ? rowRef : undefined}>组 {si}</div>
                {set.map((e, wi) => {
                  const touched = active && wi === state.wayUsed
                  const replaced = touched && state.evictedTag !== null
                  return (
                    <div key={wi} className={`cell ${e ? '' : 'empty'} ${touched ? 'touched' : ''}`}>
                      <span className="t">{e ? hex(e.tag) : '空'}</span>
                      <span className="m">
                        {replaced
                          ? <span className="ev">挤掉 {hex(state.evictedTag!)}</span>
                          : e ? `stamp ${e.stamp}` : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Seg({ cls, k, bits, v, innerRef, truncated }: {
  cls: string; k: string; bits: string[]; v: string
  innerRef?: React.Ref<HTMLDivElement>; truncated?: boolean
}) {
  return (
    <div className={`seg ${cls}`} ref={innerRef}>
      <div className="bl">
        {truncated && <b className="ell">…</b>}
        {bits.map((b, i) => <b key={i}>{b}</b>)}
      </div>
      <div className="cap"><span className="k">{k}</span><span className="v">{v}</span></div>
    </div>
  )
}

// ═══ 视图二：命中率随相联度扫描（parameter 轴）══════════
function Sweep({ doc }: { doc: SimDocument }) {
  const points = useMemo(() => {
    const ways = [1, 2, 4, 8].filter(w => {
      const sets = (doc.params.cacheSizeBytes as number) / (doc.params.blockSizeBytes as number) / w
      return Number.isInteger(sets) && sets >= 1 && (sets & (sets - 1)) === 0
    })
    const sweep = makeSweepKernel<CacheState>(cacheKernel, () => '')
    const sweepDoc: SimDocument = {
      kind: 'sweep:cache',
      params: { ...doc.params, sweepParam: 'associativity' },
      entities: doc.entities,
      streams: [...doc.streams, { name: 'sweepValues', values: ways }],
    }
    return run(sweep.compile(sweepDoc)).map(s => ({
      way: s.value as number,
      rate: s.final.hits / s.steps,
      hits: s.final.hits,
      steps: s.steps,
    }))
  }, [doc])

  const cur = doc.params.associativity as number
  const max = Math.max(0.0001, ...points.map(p => p.rate))

  return (
    <div className="card">
      <h3>命中率随相联度变化 <span className="hint">同一访问序列，只改相联度</span></h3>
      <div className="body">
        <div className="sweep">
          {points.map(p => (
            <div key={p.way} className={`bar ${p.way === cur ? 'cur' : ''}`}>
              <div className="v">{(p.rate * 100).toFixed(1)}%</div>
              <div className="track"><i style={{ height: `${(p.rate / max) * 100}%` }} /></div>
              <div className="x">{p.way} 路</div>
              <div className="n">{p.hits}/{p.steps}</div>
            </div>
          ))}
        </div>
        <p className="sweepnote">
          相联度提高只会减少<b>冲突缺失</b>，减不掉<b>强制缺失</b>（第一次访问必缺）——
          所以曲线单调不降，但会在某个点之后拉平。
        </p>
      </div>
    </div>
  )
}
