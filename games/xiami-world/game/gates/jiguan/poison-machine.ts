/** 引擎机关·可嵌入版(渲染进 rect,给 B-light 连续世界用)。逻辑同 poison-engine.ts。 */
import { Level } from './level'
import { drawHudRect, legendRect, type Rect } from './embed-hud'
import skinUrl from '../../../web/assets/gen/gates/engine.webp'
const POISON = '#8b5cc0', CORE = '#3fa78f', TEAL = '#49a791'
const WIN_LO = 70, WIN_HI = 84, CEIL = 89, RATE = { fill: 14, hold: -6 }
const SKIN = new Image(); SKIN.src = skinUrl
const rdy = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0
type Mode = 'fill' | 'hold'

export class PoisonMachine {
  ctx: CanvasRenderingContext2D; rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
  w = 0; mode: Mode = 'hold'; held = 0; success = 0; fails = 0; t = 0
  flashFail = 0; deliverFx = 0; ghostOn = true; shards = 0; level: Level
  constructor(ctx: CanvasRenderingContext2D, d = 1) { this.ctx = ctx; this.level = new Level(1 + d, 3) }
  get state() { return this.level.state }
  reset() { this.w = 0; this.mode = 'hold'; this.held = 0; this.success = 0; this.fails = 0; this.shards = 0; this.level.reset() }
  L() { const { x, y, w, h } = this.rect; return { cx: x + w * 0.5, pulleyY: y + h * 0.13, top: y + h * 0.24, bot: y + h * 0.80, bx: x + w * 0.30, ex: x + w * 0.70, srcX: x + w * 0.12, srcY: y + h * 0.20 } }
  elevY(v: number) { const g = this.L(); return g.bot - (v / 100) * (g.bot - g.top) }
  buckY(v: number) { const g = this.L(); return g.top + (v / 100) * (g.bot - g.top) }
  inWin(v: number) { return v >= WIN_LO && v <= WIN_HI }
  forecast(): 'over' | 'short' | 'ok' { let v = this.w, mx = this.w; for (let i = 0; i < 72; i++) { v = Math.max(0, Math.min(100, v + RATE[this.mode] / 60)); mx = Math.max(mx, v) } if (mx > CEIL || v > WIN_HI + 3) return 'over'; if (v < WIN_LO) return 'short'; return 'ok' }
  pointer(px: number, py: number) { const g = this.L(); for (let i = 0; i < 2; i++) if (Math.hypot(px - (g.srcX - 30 + i * 60), py - (g.srcY + 150)) < 26) this.mode = (['fill', 'hold'] as const)[i]! }
  key(k: string) { if (k === 'f') this.mode = 'fill'; if (k === 'h') this.mode = 'hold'; if (k === 'g') this.ghostOn = !this.ghostOn; if (k === 'r' || k === 'R') this.reset() }
  step() {
    this.w = Math.max(0, Math.min(100, this.w + RATE[this.mode] / 60))
    if (this.w > CEIL) { this.fails++; this.flashFail = 1; this.w = 0; this.held = 0; this.mode = 'hold'; this.level.bad(); return }
    if (this.inWin(this.w)) { this.held += 1 / 60; if (this.held >= 2.0) { this.success++; this.shards++; this.deliverFx = 1; this.w = 0; this.held = 0; this.mode = 'hold'; this.level.good() } }
    else this.held = Math.max(0, this.held - 1 / 60 * 0.6)
  }
  update(active: boolean) { this.t += 1 / 60; if (active && this.level.state === 'play') this.step(); this.flashFail = Math.max(0, this.flashFail - .03); this.deliverFx = Math.max(0, this.deliverFx - .03) }
  private core(x: number, y: number, col: string, a = 1) { const c = this.ctx; c.globalAlpha = a; c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 16); c.lineTo(x + 14, y); c.lineTo(x, y + 16); c.lineTo(x - 14, y); c.closePath(); c.fill(); c.stroke(); c.globalAlpha = 1 }
  render(rect: Rect) {
    this.rect = rect; const c = this.ctx, g = this.L(), fc = this.forecast()
    c.save(); c.beginPath(); c.rect(rect.x, rect.y, rect.w, rect.h); c.clip()
    if (rdy(SKIN)) { const s = Math.max(rect.w / SKIN.naturalWidth, rect.h / SKIN.naturalHeight); c.drawImage(SKIN, rect.x + (rect.w - SKIN.naturalWidth * s) / 2, rect.y + (rect.h - SKIN.naturalHeight * s) / 2, SKIN.naturalWidth * s, SKIN.naturalHeight * s); c.fillStyle = 'rgba(16,12,8,.5)'; c.fillRect(rect.x, rect.y, rect.w, rect.h) } else { c.fillStyle = '#1e1a14'; c.fillRect(rect.x, rect.y, rect.w, rect.h) }
    if (this.flashFail > 0) { c.fillStyle = `rgba(120,30,22,${.4 + this.flashFail * .45})`; c.fillRect(rect.x, rect.y, rect.w, rect.h) }
    // 毒源 + 两档阀
    c.fillStyle = '#3a2b4a'; c.fillRect(g.srcX - 34, g.srcY - 40, 68, 54); c.fillStyle = POISON; c.fillRect(g.srcX - 28, g.srcY - 12, 56, 20)
    for (let i = 0; i < 2; i++) { const m = (['fill', 'hold'] as const)[i]!, bx = g.srcX - 30 + i * 60, by = g.srcY + 150; c.fillStyle = this.mode === m ? '#3a342a' : '#241d16'; c.beginPath(); c.arc(bx, by, 24, 0, 7); c.fill(); c.strokeStyle = this.mode === m ? '#fff' : '#5a4e3a'; c.lineWidth = 2; c.stroke(); c.fillStyle = m === 'fill' ? POISON : '#8a9a8a'; if (m === 'fill') { c.beginPath(); c.moveTo(bx, by - 8); c.lineTo(bx + 8, by + 6); c.lineTo(bx - 8, by + 6); c.closePath(); c.fill() } else { c.beginPath(); c.moveTo(bx, by + 8); c.lineTo(bx + 8, by - 6); c.lineTo(bx - 8, by - 6); c.closePath(); c.fill() } }
    if (this.mode === 'fill') for (let i = 0; i < 5; i++) { const p = ((this.t * 2 + i / 5) % 1); c.fillStyle = POISON; c.beginPath(); c.arc(g.srcX + (g.bx - g.srcX) * p, g.srcY + 24 + Math.sin(p * 3) * 8, 4, 0, 7); c.fill() }
    // 滑轮 + 绳
    c.strokeStyle = '#6a5a3a'; c.lineWidth = 5; c.beginPath(); c.arc(g.cx, g.pulleyY, 26, 0, 7); c.stroke(); c.lineWidth = 3; c.beginPath(); c.moveTo(g.cx - 26, g.pulleyY); c.lineTo(g.bx, this.buckY(this.w)); c.moveTo(g.cx + 26, g.pulleyY); c.lineTo(g.ex, this.elevY(this.w)); c.stroke()
    // 配重桶
    const bw = 88, bh = 104, by0 = this.buckY(this.w); c.fillStyle = '#241d16'; c.fillRect(g.bx - bw / 2, by0, bw, bh); c.strokeStyle = '#5a4e3a'; c.lineWidth = 3; c.strokeRect(g.bx - bw / 2, by0, bw, bh); const fh = (bh - 8) * (this.w / 100); c.fillStyle = POISON; c.fillRect(g.bx - bw / 2 + 4, by0 + bh - 4 - fh, bw - 8, fh)
    // 升降轨 + 窗口 + 红线 + 出闸台
    c.strokeStyle = '#3a342a'; c.lineWidth = 2; c.beginPath(); c.moveTo(g.ex, g.top - 20); c.lineTo(g.ex, g.bot + 30); c.stroke()
    c.fillStyle = 'rgba(73,167,145,.16)'; c.fillRect(g.ex - 56, this.elevY(WIN_HI), 112, this.elevY(WIN_LO) - this.elevY(WIN_HI)); c.strokeStyle = TEAL; c.setLineDash([6, 6]); c.lineWidth = 1; c.strokeRect(g.ex - 56, this.elevY(WIN_HI), 112, this.elevY(WIN_LO) - this.elevY(WIN_HI)); c.setLineDash([])
    c.strokeStyle = '#a83c2e'; c.lineWidth = 2; c.beginPath(); c.moveTo(g.ex - 66, this.elevY(CEIL)); c.lineTo(g.ex + 66, this.elevY(CEIL)); c.stroke()
    c.fillStyle = '#20302a'; c.fillRect(g.ex + 56, this.elevY(WIN_HI) - 6, 84, this.elevY(WIN_LO) - this.elevY(WIN_HI) + 12); c.strokeStyle = TEAL; c.lineWidth = 2; c.strokeRect(g.ex + 56, this.elevY(WIN_HI) - 6, 84, this.elevY(WIN_LO) - this.elevY(WIN_HI) + 12)
    // 幽灵预演
    if (this.ghostOn) { let v = this.w, mx = this.w; for (let i = 0; i < 72; i++) { v = Math.max(0, Math.min(100, v + RATE[this.mode] / 60)); mx = Math.max(mx, v) } const gy = this.elevY(this.mode === 'fill' && mx > CEIL ? CEIL : v); const col = fc === 'ok' ? '73,167,145' : fc === 'over' ? '200,60,46' : '224,180,80'; c.globalAlpha = .32; c.fillStyle = `rgb(${col})`; c.fillRect(g.ex - 48, gy - 6, 96, 12); c.strokeStyle = `rgba(${col},.8)`; c.lineWidth = 1; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(g.ex - 56, gy); c.lineTo(g.ex + 140, gy); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; this.core(g.ex, gy - 18, `rgb(${col})`, .4) }
    // 升降台 + 核心 + 进度环
    const ey = this.elevY(this.w); c.fillStyle = '#4a4030'; c.fillRect(g.ex - 48, ey - 6, 96, 12); this.core(g.ex, ey - 20, this.deliverFx > 0 ? '#bff5e4' : CORE)
    if (this.inWin(this.w) && this.held > 0) { c.strokeStyle = '#ffd27a'; c.lineWidth = 4; c.beginPath(); c.arc(g.ex, ey - 20, 26, -Math.PI / 2, -Math.PI / 2 + (this.held / 2.0) * Math.PI * 2); c.stroke() }
    for (let i = 0; i < Math.min(this.shards, 20); i++) { c.fillStyle = '#ffd27a'; const sx = g.ex + 62 + (i % 4) * 18, sy = g.bot + 8 - Math.floor(i / 4) * 16; c.beginPath(); c.moveTo(sx, sy - 6); c.lineTo(sx + 5, sy); c.lineTo(sx, sy + 6); c.lineTo(sx - 5, sy); c.closePath(); c.fill() }
    c.restore()
    legendRect(c, rect, '灌毒→配重把青核心顶进右边窗口带→稳住一会=出闸。看红色幽灵别冲过红线', [{ k: 'F', t: '灌毒(核心上升)' }, { k: 'H', t: '松开(慢慢下降)' }, { k: 'G / Q', t: '预演开关 / 走开' }])
    drawHudRect(c, rect, this.level)
  }
}
