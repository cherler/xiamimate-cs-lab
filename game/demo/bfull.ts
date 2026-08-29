/**
 * B-full 样张:角色**就是**输入。框住缓存机,虾米君在槽前跑位(A/D),跑到某个槽前按 F 亲手拍掉它。
 * 跟 B-light 对比:B-light 你点任意槽秒冲;B-full 你得先跑过去——远处冒毒就得冲刺。逻辑同真缓存机。
 */
import { CacheMachine } from '../gates/jiguan/cache-machine'
import botUrl from '../../web/assets/gen/dns/drone.webp'
import { sfx } from './sfx'
const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
function resize() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()
const BOT = new Image(); BOT.src = botUrl
const rdy = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0
const AMBER = '#e8c98a', CREAM = '#efe6d2', TEAL = '#49a791'
const m = new CacheMachine(ctx)
const keys: Record<string, boolean> = {}
let hx = 0, hvx = 0, face = 1, t = 0, initd = false, flashF = 0
function rect() { return { x: W * 0.08, y: H * 0.07, w: W * 0.84, h: H * 0.80 } }
addEventListener('keydown', e => { const k = e.key.toLowerCase(); keys[k] = true; if (k === 'f' || k === ' ') { e.preventDefault(); act() }; if (k === 'r') { m.reset(); } })
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false })
function nearest() { const g = m.L(); let bi = 0, bd = 1e9; for (let i = 0; i < 3; i++) { const d = Math.abs(hx - g.slotX[i]!); if (d < bd) { bd = d; bi = i } } return { i: bi, d: bd } }
function act() { const g = m.L(); const n = nearest(); if (n.d < g.slotX[1]! - g.slotX[0]! - 20 || n.d < 70) { m.doFlush(n.i); flashF = 1; sfx.blip() } }
function drawBot(x: number, footY: number, h: number, f: number) { if (!rdy(BOT)) { ctx.fillStyle = '#8bd3c8'; ctx.fillRect(x - h * .2, footY - h, h * .4, h); return } const w = h * (BOT.naturalWidth / BOT.naturalHeight); ctx.save(); ctx.translate(x, footY - h / 2); ctx.scale(f, 1); ctx.drawImage(BOT, -w / 2, -h / 2, w, h); ctx.restore() }
function tick() {
  t += 1 / 60; flashF = Math.max(0, flashF - .06)
  const r = rect(); m.update(true); m.render(r)
  const g = m.L()
  if (!initd && rdy(BOT)) { hx = g.slotX[1]!; initd = true }
  // 走位(在槽这一排前面的走道)
  let dir = 0; if (keys['a'] || keys['arrowleft']) dir = -1; if (keys['d'] || keys['arrowright']) dir = 1
  hvx += (dir * 6 - hvx) * 0.2; hx = Math.max(g.slotX[0]! - 50, Math.min(g.slotX[2]! + 50, hx + hvx)); if (dir) face = dir
  const walkY = g.slotY + 120
  // 站在哪个槽前的高亮
  const n = nearest(), reach = n.d < 70 || n.d < (g.slotX[1]! - g.slotX[0]!) - 20
  const sx = g.slotX[n.i]!
  ctx.strokeStyle = reach ? TEAL : '#5a4e3a'; ctx.lineWidth = 3; ctx.globalAlpha = .5 + .3 * Math.sin(t * 6)
  ctx.beginPath(); ctx.moveTo(sx, walkY - 34); ctx.lineTo(sx - 8, walkY - 46); ctx.lineTo(sx + 8, walkY - 46); ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1
  // 走道
  ctx.strokeStyle = '#3a342a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(g.slotX[0]! - 60, walkY + 30); ctx.lineTo(g.slotX[2]! + 60, walkY + 30); ctx.stroke()
  drawBot(hx, walkY + 30 + Math.sin(t * 6) * 3, 96, face)
  if (flashF > 0) { ctx.globalAlpha = flashF; ctx.fillStyle = '#fff'; ctx.font = '28px system-ui'; ctx.textAlign = 'center'; ctx.fillText('✊', hx + 22 * face, walkY - 6); ctx.globalAlpha = 1 }
  // 说明
  ctx.fillStyle = 'rgba(15,12,8,.85)'; ctx.fillRect(0, 0, W, 30); ctx.fillStyle = AMBER; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText('B-full 样张 · 虾米君亲手操作:A/D 跑到槽前 → F 拍掉这一格(远处冒毒得冲过去)', W / 2, 20)
  ctx.textAlign = 'left'; ctx.fillStyle = CREAM
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
;(window as unknown as { __bf: () => object }).__bf = () => ({ hx: Math.round(hx), near: nearest(), state: m.state })
;(window as unknown as { __m: () => CacheMachine }).__m = () => m
