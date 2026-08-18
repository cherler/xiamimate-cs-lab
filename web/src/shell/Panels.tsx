/** 共享面板：逐步日志 · 参数 · 读数 · 违规 · 边界 */
import { useEffect, useRef } from 'react'
import type { Violation } from '@engine/core/verify.ts'
import type { AnyExperiment, ParamSpec, Readout } from '../types.ts'

// ── 逐步日志：跟轴联动 ─────────────────────────────────
export function StepLog({
  exp, trace, index, onSeek,
}: { exp: AnyExperiment; trace: never[]; index: number; onSeek: (i: number) => void }) {
  const ref = useRef<HTMLLIElement | null>(null)
  const box = useRef<HTMLDivElement | null>(null)

  /**
   * 让当前步进入可视范围 —— **只滚日志自己那个框，不许动整页。**
   *
   * 原来写的是 `scrollIntoView({ block: 'nearest' })`。`nearest` 听起来很克制，
   * 其实它会把**每一层**可滚动祖先都调整到位，包括视口本身：
   * 日志卡片在首屏之下时，浏览器就把整页往下滚一段。
   *
   * 单看本仓时这只是"开页面自己往下挪了 28px"，没人在意。并入主站之后
   * 挪的量变成 80px（多出来的正好是平台页眉那 52px）—— **打开 /lab/ 的第一眼，
   * 平台页眉已经被滚出屏幕了**，而它存在的全部意义就是让人一眼看出这是虾米伙伴。
   *
   * 所以改成自己算：只加减 `box.scrollTop`，窗口一次都不碰。
   */
  useEffect(() => {
    const li = ref.current, b = box.current
    if (!li || !b) return
    const l = li.getBoundingClientRect(), r = b.getBoundingClientRect()
    if (l.top < r.top) b.scrollTop += l.top - r.top
    else if (l.bottom > r.bottom) b.scrollTop += l.bottom - r.bottom
  }, [index])

  const model = exp.kernel.compile(exp.defaultDoc)

  return (
    <div className="card log" ref={box}>
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
    <div className="card readouts">
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
