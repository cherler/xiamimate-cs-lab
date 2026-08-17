/** 共享面板：逐步日志 · 参数 · 读数 · 违规 · 边界 */
import { useEffect, useRef } from 'react'
import type { Violation } from '@engine/core/verify.ts'
import type { AnyExperiment, ParamSpec, Readout } from '../types.ts'

// ── 逐步日志：跟轴联动 ─────────────────────────────────
export function StepLog({
  exp, trace, index, onSeek,
}: { exp: AnyExperiment; trace: never[]; index: number; onSeek: (i: number) => void }) {
  const ref = useRef<HTMLLIElement | null>(null)
  useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest' }) }, [index])

  const model = exp.kernel.compile(exp.defaultDoc)

  return (
    <div className="card log">
      <h3>逐步日志 <span className="hint">点击跳到该步</span></h3>
      <ul>
        {trace.map((s, i) => {
          const tone = exp.tone(s)
          return (
            <li
              key={i} ref={i === index ? ref : undefined}
              className={i === index ? 'cur' : ''}
              onClick={() => onSeek(i)}
            >
              <span className="i">{i + 1}</span>
              <span className={`r ${tone.key}`}>{tone.label}</span>
              <span className="x">{model.describe(s)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── 参数：改了就重跑 ───────────────────────────────────
export function ParamPanel({
  specs, values, onChange, emptyNote,
}: {
  specs: ParamSpec[]
  values: Record<string, number | string | boolean>
  onChange: (key: string, v: number | string) => void
  /** 有些实验的自由度不在标量参数上（如银行家在资源矩阵里）—— 空面板要说明白，不能只留一个空盒子 */
  emptyNote?: string
}) {
  if (specs.length === 0) {
    return (
      <div className="card">
        <h3>参数</h3>
        <div className="body"><p className="pempty">{emptyNote ?? '本实验没有可调参数。'}</p></div>
      </div>
    )
  }
  return (
    <div className="card">
      <h3>参数 <span className="hint">改了立即重跑</span></h3>
      <div className="body params">
        {specs.map(sp => (
          <div className="param" key={sp.key}>
            <div className="k">
              <span>{sp.label}</span>
              {sp.kind === 'number' && sp.unit && <span className="u">{sp.unit}</span>}
            </div>
            <div className="opts">
              {(sp.options as (number | string)[]).map(o => (
                <button
                  key={String(o)}
                  className={values[sp.key] === o ? 'on' : ''}
                  onClick={() => onChange(sp.key, o)}
                  aria-pressed={values[sp.key] === o}
                >{o}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 读数 ──────────────────────────────────────────────
export function Readouts({ items }: { items: Readout[] }) {
  return (
    <div className="card">
      <h3>读数</h3>
      <div className="body">
        {items.map((r, i) => (
          <div className="pr" key={i}>
            <span className="k">{r.label}</span>
            <span className={`v ${r.tone ?? ''}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 违规：验证器直接接到 UI 上 ─────────────────────────
export function Violations({ items }: { items: Violation[] }) {
  if (items.length === 0) return null
  return (
    <div className="viol">
      <div className="t">配置不合法 · {items.length} 项</div>
      {items.slice(0, 3).map((v, i) => (
        <p key={i}><code>{v.location}</code> {v.message}
          {v.actual !== undefined && <> —— 实际 <code>{JSON.stringify(v.actual)}</code></>}
        </p>
      ))}
    </div>
  )
}

// ── 边界：内容标准 #2 ──────────────────────────────────
export function Bounds({ items }: { items: string[] }) {
  return (
    <div className="bounds">
      <div className="t">边界</div>
      <p>{items.join(' · ')}</p>
    </div>
  )
}
