/** 可嵌入机关共用的 HUD:目标/容错条 + 赢输覆盖 + 操作说明面板,全部相对 rect 画。 */
import type { Level } from './level'
export type Rect = { x: number; y: number; w: number; h: number }
const TEAL = '#49a791'

export function drawHudRect(ctx: CanvasRenderingContext2D, rect: Rect, L: Level) {
  const c = ctx, cx = rect.x + rect.w / 2, pip = 18, gap = 5
  const gw = L.goal * (pip + gap), gx0 = cx - gw / 2 - 34, gy = rect.y + 24
  for (let i = 0; i < L.goal; i++) { const x = gx0 + i * (pip + gap), on = i < L.progress; c.fillStyle = on ? TEAL : '#26332e'; c.strokeStyle = '#3a5a50'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, gy, pip / 2, 0, 7); c.fill(); c.stroke() }
  const dx = gx0 + L.goal * (pip + gap) + 6, open = L.state === 'win'; c.strokeStyle = open ? '#7fe8c0' : '#5a6a60'; c.lineWidth = 3; c.strokeRect(dx - 2 - (open ? 8 : 0), gy - 12, 10, 24); c.strokeRect(dx + 6 + (open ? 8 : 0), gy - 12, 10, 24)
  const fx0 = cx - (L.failMax * (pip + gap)) / 2 + 6, fy = rect.y + 50
  for (let i = 0; i < L.failMax; i++) { const x = fx0 + i * (pip + gap), on = i < L.fail; c.fillStyle = on ? '#c8452e' : '#332624'; c.strokeStyle = '#5a3a34'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, fy - pip / 2); c.lineTo(x + pip / 2, fy + pip / 2); c.lineTo(x - pip / 2, fy + pip / 2); c.closePath(); c.fill(); c.stroke() }
  if (L.state !== 'play') {
    c.fillStyle = L.state === 'win' ? 'rgba(40,90,74,.4)' : 'rgba(90,26,22,.42)'; c.fillRect(rect.x, rect.y, rect.w, rect.h)
    const mx = cx, my = rect.y + rect.h / 2; c.lineWidth = 10; c.lineCap = 'round'
    if (L.state === 'win') { c.strokeStyle = '#7fe8c0'; c.beginPath(); c.moveTo(mx - 40, my); c.lineTo(mx - 7, my + 34); c.lineTo(mx + 46, my - 38); c.stroke() }
    else { c.strokeStyle = '#ff9a80'; c.beginPath(); c.moveTo(mx - 34, my - 34); c.lineTo(mx + 34, my + 34); c.moveTo(mx + 34, my - 34); c.lineTo(mx - 34, my + 34); c.stroke() }
    c.lineCap = 'butt'
  }
}

export function legendRect(ctx: CanvasRenderingContext2D, rect: Rect, rule: string, rows: { k: string; t: string }[]) {
  const c = ctx, lh = 22, padx = 11, pady = 9, w = Math.min(340, rect.w - 24), h = pady * 2 + 20 + rows.length * lh
  const x = rect.x + 14, y = rect.y + rect.h - h - 14
  c.fillStyle = 'rgba(20,16,12,.8)'; c.fillRect(x, y, w, h); c.strokeStyle = '#4a4030'; c.lineWidth = 1; c.strokeRect(x, y, w, h)
  c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = '13px system-ui'; c.fillStyle = '#e8c98a'; c.fillText(rule, x + padx, y + pady + 10)
  rows.forEach((r, i) => { const ry = y + pady + 20 + i * lh + lh / 2; c.font = 'bold 12px ui-monospace, monospace'; const kw = Math.max(28, c.measureText(r.k).width + 12); c.fillStyle = '#3a342a'; c.fillRect(x + padx, ry - 9, kw, 18); c.strokeStyle = '#6a5a3a'; c.strokeRect(x + padx, ry - 9, kw, 18); c.fillStyle = '#efe6d2'; c.fillText(r.k, x + padx + 6, ry); c.font = '13px system-ui'; c.fillStyle = '#c8bfa8'; c.fillText(r.t, x + padx + kw + 9, ry) })
  c.textBaseline = 'alphabetic'
}
