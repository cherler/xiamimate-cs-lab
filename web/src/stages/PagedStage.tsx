/** 舞台：PagedAttention —— 物理块池 + 每请求块表（逻辑→物理映射）*/
import type { PagedState } from '@engine/kernels/paged.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

//  给每个请求一个稳定的配色
const HUES: Record<string, string> = { A: 'var(--f-tag)', B: 'var(--f-idx)', C: 'var(--f-off)', D: 'var(--hit)' }
const hue = (r: string) => HUES[r] ?? 'var(--dim)'

export function PagedStage({ state }: StageProps<PagedState>) {
  const { blocks, tables, focus, blockSize } = state
  const reqs = Object.keys(tables)

  return (
    <div className="card">
      <h3>KV 分页 <span className="hint">KV 不连续存放，切成固定块；块表把逻辑块映射到物理块</span></h3>
      <div className="body">
        {/* 物理块池 */}
        <div className="pgsect">物理块池 <span className="pgcap">每块存 {blockSize} 个 token 的 KV · 共 {state.totalBlocks} 块 · 空闲 {state.freeCount}</span></div>
        <div className="pgpool">
          {blocks.map((b, i) => (
            <div key={i} className={`pgblk ${b ? 'used' : 'free'} ${i === focus ? 'cur' : ''}`}
              style={b ? { borderColor: hue(b.owner), background: `color-mix(in srgb, ${hue(b.owner)} 14%, transparent)`, color: hue(b.owner) } : undefined}>
              <span className="pgi">块 {i}</span>
              <span className="pgo">{b ? `${b.owner}·逻辑${b.logical}` : '空闲'}</span>
            </div>
          ))}
        </div>

        {/* 每请求块表 */}
        <div className="pgsect" style={{ marginTop: 16 }}>块表（block table）<span className="pgcap">逻辑块号 → 物理块号；物理块不必连续</span></div>
        {reqs.length === 0
          ? <div className="pgempty">还没有请求</div>
          : reqs.map(r => (
            <div className="pgtrow" key={r}>
              <span className="pgtreq" style={{ color: hue(r), borderColor: hue(r) }}>请求 {r}</span>
              <span className="pgttok">{state.lens[r]} token</span>
              <span className="pgtmap">
                {(tables[r] ?? []).map((pb, logical) => (
                  <span key={logical} className="pgtcell">
                    <span className="pgtl">逻辑{logical}</span>
                    <span className="pgtarrow">→</span>
                    <span className="pgtp" style={{ color: hue(r), borderColor: hue(r) }}>物理{pb}</span>
                  </span>
                ))}
              </span>
            </div>
          ))}

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
