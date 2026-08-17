/**
 * 图视图 —— 共享视觉原语（Dijkstra 已经自带一份，这里给 MST / 拓扑 / 关键路径用）。
 * 顶点坐标由 doc 给（attrs.x / attrs.y，0..100），让文档定布局。
 */
import { useLayoutEffect, useRef, useState } from 'react'
import type { SimDocument } from '@engine/core/document.ts'

export type EdgeTone = 'plain' | 'active' | 'chosen' | 'dropped' | 'critical'
export type VertTone = 'plain' | 'active' | 'done' | 'dim'

export function GraphView({
  doc, edgeTone, vertTone, vertSub, edgeLabel, directed, legend,
}: {
  doc: SimDocument
  edgeTone?: (id: string) => EdgeTone
  vertTone?: (id: string) => VertTone
  vertSub?: (id: string) => string
  edgeLabel?: (id: string, w: number) => string
  directed?: boolean
  legend?: [EdgeTone, string][]
}) {
  /**
   * 关键：SVG 的坐标系必须与结点的百分比定位**严格重合**。
   *
   * 第一版 viewBox 写死 "0 0 100 100" 配 preserveAspectRatio="none" ——
   * 于是 SVG 把方形视口居中放进长方形元素里（左右留白），
   * 而结点用的是元素宽高的百分比。两套坐标系不重合，
   * 连线离结点中心差了 50~125px。图"看着像那么回事"，所以一直没人发现。
   *
   * 现在按容器实际宽高算 viewBox 的高度，做到 1:1 映射 ——
   * 这样既对齐，又保持等比缩放（文字和箭头不会被拉歪）。
   */
  const boxRef = useRef<HTMLDivElement>(null)
  const [vbH, setVbH] = useState(100)
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const sync = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0) setVbH((r.height / r.width) * 100)
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  /** 把 0..100 的百分比 y 折算成 viewBox 里的 y */
  const vy = (y: number) => (y / 100) * vbH

  const nodes = doc.entities.filter(e => e.type === 'node')
  const edges = doc.entities.filter(e => e.type === 'edge')
  const pos = Object.fromEntries(nodes.map((n, k) => {
    const a = 2 * Math.PI * k / nodes.length - Math.PI / 2
    return [n.id, {
      x: typeof n.attrs.x === 'number' ? n.attrs.x : 50 + 34 * Math.cos(a),
      y: typeof n.attrs.y === 'number' ? n.attrs.y : 50 + 34 * Math.sin(a),
    }]
  }))

  return (
    <div className="gvwrap">
      <div className="gwrap" ref={boxRef}>
        <svg viewBox={`0 0 100 ${vbH}`} preserveAspectRatio="none" aria-hidden="true">
          {directed && (
            <defs>
              <marker id="arw" viewBox="0 0 8 8" refX="7" refY="4"
                      markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0,1 L7,4 L0,7 z" fill="currentColor" />
              </marker>
            </defs>
          )}
          {edges.map(e => {
            const f = pos[String(e.attrs.from)], t = pos[String(e.attrs.to)]
            if (!f || !t) return null
            const tone = edgeTone?.(e.id) ?? 'plain'
            //  有向图把线缩短一点，箭头才不会戳进结点里
            //  端点往回缩一点，箭头才不会戳进结点里；在 viewBox 坐标里算
            const fx = f.x, fy = vy(f.y), tx = t.x, ty = vy(t.y)
            const dx = tx - fx, dy = ty - fy
            const len = Math.hypot(dx, dy) || 1
            const pad = directed ? 4.5 : 0
            return (
              <g key={e.id} className={`gedge ${tone}`}>
                <line
                  x1={fx + (dx / len) * pad} y1={fy + (dy / len) * pad}
                  x2={tx - (dx / len) * pad} y2={ty - (dy / len) * pad}
                  vectorEffect="non-scaling-stroke"
                  markerEnd={directed ? 'url(#arw)' : undefined} />
              </g>
            )
          })}
        </svg>
        {/* 边权标签走 HTML 而不是 SVG <text> —— viewBox 非等比时 SVG 文字会被拉歪，
            这跟当初时间轴那个"圆点变椭圆"是同一个坑 */}
        {edges.map(e => {
          const f = pos[String(e.attrs.from)], t = pos[String(e.attrs.to)]
          if (!f || !t) return null
          const tone = edgeTone?.(e.id) ?? 'plain'
          return (
            <div key={`lb-${e.id}`} className={`gvlab ${tone}`}
                 style={{ left: `${(f.x + t.x) / 2}%`, top: `${(f.y + t.y) / 2}%` }}>
              {edgeLabel ? edgeLabel(e.id, Number(e.attrs.w)) : String(e.attrs.w)}
            </div>
          )
        })}
        {nodes.map(n => {
          const p = pos[n.id]
          const tone = vertTone?.(n.id) ?? 'plain'
          return (
            <div key={n.id} className={`gnode ${tone}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <b>{n.id}</b>
              {vertSub?.(n.id) ? <em>{vertSub(n.id)}</em> : null}
            </div>
          )
        })}
      </div>
      {legend?.length ? (
        <div className="gvlegend">
          {legend.map(([tone, text]) => (
            <span key={tone}><i className={`gvw ${tone}`} />{text}</span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
