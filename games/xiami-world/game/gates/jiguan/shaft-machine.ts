/** 竖井机关·可嵌入版(渲染进 rect,给 B-light 连续世界用)。逻辑同 shaft-lookup.ts。 */
import { Level } from './level'
import { drawHudRect, legendRect, type Rect } from './embed-hud'
import skinUrl from '../../../web/assets/gen/gates/shaft.webp'
const COLS = ['#e0954b', '#5b8def', '#3fa78f'], TEAL = '#49a791'
const SKIN = new Image(); SKIN.src = skinUrl
const rdy = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0
type Pk = { addr: number[]; rest: number; slide: number }

export class ShaftMachine {
  ctx: CanvasRenderingContext2D; rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
  dial = 0; tiers: (Pk | null)[] = [null, null, null]; queue: Pk[] = []; QMAX = 4
  success = 0; reject = 0; spawnT = 1.4; deliverFx = 0; t = 0
  rejectBin: number[] = []; wonShards: number[] = []; level = new Level(10, 6); cyc: number
  constructor(ctx: CanvasRenderingContext2D, d = 1) { this.ctx = ctx; this.cyc = Math.max(1.0, 1.8 - (d - 1) * 0.35) }
  get state() { return this.level.state }
  reset() { this.tiers = [null, null, null]; this.queue = []; this.success = 0; this.reject = 0; this.dial = 0; this.rejectBin.length = 0; this.wonShards.length = 0; this.spawnT = 1.4; this.level.reset() }
  randAddr() { return [Math.floor(Math.random() * 3), Math.floor(Math.random() * 3), Math.floor(Math.random() * 3)] }
  enqueue(addr = this.randAddr()) { const p: Pk = { addr, rest: 0, slide: 0 }; if (this.queue.length >= this.QMAX) { this.reject++; this.rejectBin.push(p.addr[0]!); this.level.bad() } else this.queue.push(p) }
  L() { const { x, y, w, h } = this.rect; return { cx: x + w * 0.42, halfW: Math.min(150, w * 0.12), tierY: [y + h * 0.28, y + h * 0.50, y + h * 0.72], trayY: y + h * 0.9, queueY: y + h * 0.12, dialX: x + w * 0.76, dialY: y + h * 0.46, binX: x + w * 0.1 } }
  pointer(px: number, py: number) { const g = this.L(); if (Math.hypot(px - g.dialX, py - g.dialY) < 66) { this.dial = (this.dial + 1) % 3; return } for (let i = 0; i < 3; i++) if (Math.hypot(px - (g.dialX - 90 + i * 90), py - (g.dialY + 120)) < 26) { this.dial = i; return } }
  key(k: string) { if (k >= '1' && k <= '3') this.dial = +k - 1; if (k === ' ') this.dial = (this.dial + 1) % 3; if (k === 'r' || k === 'R') this.reset() }
  step() {
    if (!this.tiers[0] && this.queue.length) { this.tiers[0] = this.queue.shift()!; this.tiers[0]!.rest = 0 }
    for (let k = 2; k >= 0; k--) { const p = this.tiers[k]; if (!p) continue; p.rest += 1 / 60; if (p.rest < 0.28) continue; if (this.dial !== p.addr[k]) continue; if (k === 2) { this.tiers[2] = null; this.success++; this.wonShards.push(p.addr[0]!); this.deliverFx = 1; this.level.good() } else if (!this.tiers[k + 1]) { this.tiers[k + 1] = p; this.tiers[k] = null; p.rest = 0; p.slide = 1 } }
  }
  update(active: boolean) {
    this.t += 1 / 60; const playing = active && this.level.state === 'play'
    if (playing) { this.spawnT -= 1 / 60; if (this.spawnT <= 0) { this.spawnT = this.cyc; this.enqueue() } this.step() }
    this.deliverFx = Math.max(0, this.deliverFx - .03)
    for (const p of [...this.tiers, ...this.queue]) if (p) p.slide = Math.max(0, p.slide - .08)
  }
  private shapeMark(x: number, y: number, r: number, shape: number, col: string, hl = false) {
    const c = this.ctx; c.fillStyle = col; c.strokeStyle = hl ? '#fff' : 'rgba(0,0,0,.35)'; c.lineWidth = hl ? 3 : 2; c.beginPath()
    if (shape === 0) { c.moveTo(x, y - r); c.lineTo(x + r, y + r * 0.8); c.lineTo(x - r, y + r * 0.8); c.closePath() } else if (shape === 1) c.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7); else c.arc(x, y, r, 0, 7)
    c.fill(); c.stroke()
  }
  private drawPk(p: Pk, x: number, y: number, cur: number) { const c = this.ctx; c.fillStyle = '#efe6d2'; c.strokeStyle = '#9c7f56'; c.lineWidth = 2; c.beginPath(); c.rect(x - 46, y - 15, 92, 30); c.fill(); c.stroke(); for (let i = 0; i < 3; i++) this.shapeMark(x - 26 + i * 26, y, 8, p.addr[i]!, COLS[p.addr[i]!]!, i === cur) }
  render(rect: Rect) {
    this.rect = rect; const c = this.ctx, g = this.L()
    c.save(); c.beginPath(); c.rect(rect.x, rect.y, rect.w, rect.h); c.clip()
    if (rdy(SKIN)) { const s = Math.max(rect.w / SKIN.naturalWidth, rect.h / SKIN.naturalHeight); c.drawImage(SKIN, rect.x + (rect.w - SKIN.naturalWidth * s) / 2, rect.y + (rect.h - SKIN.naturalHeight * s) / 2, SKIN.naturalWidth * s, SKIN.naturalHeight * s); c.fillStyle = 'rgba(16,12,8,.55)'; c.fillRect(rect.x, rect.y, rect.w, rect.h) } else { c.fillStyle = '#1e1a14'; c.fillRect(rect.x, rect.y, rect.w, rect.h) }
    c.fillStyle = '#241d16'; c.fillRect(g.cx - g.halfW, g.tierY[0]! - 56, g.halfW * 2, g.trayY - g.tierY[0]! + 36); c.strokeStyle = '#4a4030'; c.lineWidth = 4; c.strokeRect(g.cx - g.halfW, g.tierY[0]! - 56, g.halfW * 2, g.trayY - g.tierY[0]! + 36)
    for (let k = 0; k < 3; k++) {
      const yy = g.tierY[k]! + 24, p = this.tiers[k], open = !!p && p.rest >= 0.28 && this.dial === p.addr[k]!
      c.strokeStyle = open ? TEAL : '#5a4e3a'; c.lineWidth = 6; const gap = open ? 40 : 6
      c.beginPath(); c.moveTo(g.cx - g.halfW + 8, yy); c.lineTo(g.cx - gap, yy + (open ? 24 : 0)); c.stroke(); c.beginPath(); c.moveTo(g.cx + g.halfW - 8, yy); c.lineTo(g.cx + gap, yy + (open ? 24 : 0)); c.stroke()
      if (p && p.rest >= 0.28) { const kx = g.cx - g.halfW + 40, ky = g.tierY[k]!, m = this.dial === p.addr[k]!; c.globalAlpha = m ? 1 : .5 + .28 * Math.sin(this.t * 6); c.strokeStyle = m ? '#7fe8c0' : '#e8c98a'; c.lineWidth = 3; c.beginPath(); c.arc(kx, ky, 23, 0, 7); c.stroke(); c.globalAlpha = 1; this.shapeMark(kx, ky, 13, p.addr[k]!, m ? '#7fe8c0' : COLS[p.addr[k]!]!, m) }
    }
    for (let i = 0; i < this.queue.length; i++) this.drawPk(this.queue[i]!, g.cx - g.halfW + 56 + i * 96, g.queueY, -1)
    if (this.queue.length >= this.QMAX) { c.strokeStyle = `rgba(200,60,46,${.4 + .3 * Math.sin(this.t * 8)})`; c.lineWidth = 4; c.strokeRect(g.cx - g.halfW + 8, g.queueY - 20, this.QMAX * 96, 40) }
    c.fillStyle = '#3a2b26'; c.fillRect(g.binX - 36, g.queueY + 36, 72, 108); c.strokeStyle = '#7a5a44'; c.lineWidth = 3; c.strokeRect(g.binX - 36, g.queueY + 36, 72, 108)
    this.rejectBin.slice(-12).forEach((s, i) => this.shapeMark(g.binX - 20 + (i % 3) * 20, g.queueY + 126 - Math.floor(i / 3) * 20, 8, s, '#8a6a5a'))
    for (let k = 0; k < 3; k++) { const p = this.tiers[k]; if (p) this.drawPk(p, g.cx, g.tierY[k]! - p.slide * (g.tierY[1]! - g.tierY[0]!), k) }
    c.fillStyle = this.deliverFx > 0 ? `rgba(73,167,145,${.25 + this.deliverFx * .5})` : '#20302a'; c.fillRect(g.cx - g.halfW, g.trayY - 6, g.halfW * 2, 36); c.strokeStyle = TEAL; c.lineWidth = 3; c.strokeRect(g.cx - g.halfW, g.trayY - 6, g.halfW * 2, 36)
    for (let i = 0; i < Math.min(this.wonShards.length, 24); i++) { c.fillStyle = '#ffd27a'; const sx = g.cx - g.halfW + 14 + (i % 9) * 26, sy = g.trayY + 12 - Math.floor(i / 9) * 20; c.beginPath(); c.moveTo(sx, sy - 6); c.lineTo(sx + 5, sy); c.lineTo(sx, sy + 6); c.lineTo(sx - 5, sy); c.closePath(); c.fill() }
    // 拨盘
    c.fillStyle = '#2c261e'; c.beginPath(); c.arc(g.dialX, g.dialY, 62, 0, 7); c.fill(); c.strokeStyle = '#6a5a3a'; c.lineWidth = 5; c.stroke(); this.shapeMark(g.dialX, g.dialY, 28, this.dial, COLS[this.dial]!)
    for (let k = 0; k < 3; k++) { const p = this.tiers[k]; if (p && p.rest >= 0.28 && p.addr[k] === this.dial) { c.strokeStyle = '#9c7f56'; c.lineWidth = 3; c.beginPath(); c.moveTo(g.dialX - 62, g.dialY); c.lineTo(g.cx + g.halfW, g.tierY[k]! + 18); c.stroke() } }
    for (let i = 0; i < 3; i++) { const bx = g.dialX - 90 + i * 90, by = g.dialY + 120; c.fillStyle = i === this.dial ? '#3a342a' : '#241d16'; c.beginPath(); c.arc(bx, by, 24, 0, 7); c.fill(); c.strokeStyle = i === this.dial ? '#fff' : '#5a4e3a'; c.lineWidth = 2; c.stroke(); this.shapeMark(bx, by, 12, i, COLS[i]!) }
    c.restore()
    legendRect(c, rect, '把拨盘转成"哪层锁孔亮起的形状"→那层门开、信落下一层;穿到底=送达', [{ k: '1 2 3', t: '拨盘转到 △/□/○' }, { k: '点拨盘', t: '循环换形状' }, { k: 'Q', t: '走开' }])
    drawHudRect(c, rect, this.level)
  }
}
