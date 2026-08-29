/**
 * B-light 样张:连续侧视世界 + 角色在场 + 镜头平滑框住机器。
 * 虾米君沿路由器内部剖面走 → 走到缓存机跟前按 E → 镜头推近框住这台机器、他站到机器底座旁(不消失)→
 * 你就地操作(真 CacheMachine,玩法不变)→ 解完镜头拉回、他欢呼 → 往深处走到下一台(占位)。
 * 目的:让你感受「一个连续空间、角色始终在、进机器无硬切换」的手感。
 */
import { CacheMachine } from '../gates/jiguan/cache-machine'
import bgUrl from '../../web/assets/gen/dns/bg-hall.webp'
import botUrl from '../../web/assets/gen/dns/drone.webp'
import slotUrl from '../../web/assets/gen/gates/obj/slot.webp'
import { sfx } from './sfx'

const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
function resize() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()
const mk = (u: string) => { const i = new Image(); i.src = u; return i }
const BG = mk(bgUrl), BOT = mk(botUrl), SLOT = mk(slotUrl)
const rdy = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0
const TEAL = '#49a791', AMBER = '#e8c98a', CREAM = '#efe6d2'

const WORLD = 3000, STATION_X = 1150, NEXT_X = 2450
let px = 140, pvx = 0, face = 1, camX = 0, bob = 0, t = 0, stepT = 0
let mode: 'walk' | 'operate' = 'walk'
let zoom = 0, winHold = -1, solved = false
const keys: Record<string, boolean> = {}
const machine = new CacheMachine(ctx)
let bubble: { text: string; t: number } | null = { text: '沿着剖面往里走,走到那台缓存机跟前按 E 修它。', t: 0 }
function say(s: string) { bubble = { text: s, t: 0 } }
function floorY() { return H * 0.80 }
function framed() { return { x: W * 0.13, y: H * 0.10, w: W * 0.74, h: H * 0.60 } }

function enter() { if (solved) return; mode = 'operate'; machine.reset(); winHold = -1; sfx.dive(); say('虾米君跳上操作台 —— 紫的清掉,好信送够就修好了。') }
function leave(won: boolean) { mode = 'walk'; if (won) { solved = true; sfx.chime(); say('修好了!信号往深处走 —— 去下一台。') } }
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true
  if (mode === 'walk') { if (k === 'e' && !solved && Math.abs(px - STATION_X) < 150) enter() }
  else { if (k === 'q' || k === 'escape') leave(false); else machine.key(e.key) }
  if (k === ' ' && mode === 'operate') { e.preventDefault(); machine.key(' ') }
})
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false })
cv.addEventListener('pointerdown', e => { if (mode === 'operate' && zoom > 0.9) machine.pointer(e.clientX, e.clientY) })

function drawBot(x: number, footY: number, h: number, f: number) {
  if (!rdy(BOT)) { ctx.fillStyle = '#8bd3c8'; ctx.fillRect(x - h * 0.2, footY - h, h * 0.4, h); return }
  const w = h * (BOT.naturalWidth / BOT.naturalHeight)
  ctx.save(); ctx.translate(x, footY - h / 2); ctx.scale(f, 1); ctx.drawImage(BOT, -w / 2, -h / 2, w, h); ctx.restore()
}
function tileBg(scroll: number) {
  if (!rdy(BG)) { ctx.fillStyle = '#1c1710'; ctx.fillRect(0, 0, W, H); return }
  const bw = H * (BG.naturalWidth / BG.naturalHeight); let idx = Math.floor(scroll / bw), x = -(scroll - idx * bw)
  for (; x < W; x += bw, idx++) { const flip = Math.abs(idx) % 2 === 1; ctx.save(); ctx.translate(x + (flip ? bw : 0), 0); ctx.scale(flip ? -1 : 1, 1); ctx.drawImage(BG, 0, 0, bw, H); ctx.restore() }
}
function facade(sx: number) { // 世界里的缓存机"门面"(走路时看到的实体机器)
  const fy = floorY(), fw = 300, fh = 210, x = sx - fw / 2, y = fy - fh - 10
  ctx.fillStyle = 'rgba(20,16,10,.72)'; ctx.strokeStyle = solved ? TEAL : AMBER; ctx.lineWidth = 4
  ctx.fillRect(x, y, fw, fh); ctx.strokeRect(x, y, fw, fh)
  for (let i = 0; i < 3; i++) { const dx = sx - 90 + i * 90; if (rdy(SLOT)) { const w = 78, h = w * (SLOT.naturalHeight / SLOT.naturalWidth); ctx.drawImage(SLOT, dx - w / 2, y + fh / 2 - h / 2, w, h) } }
  ctx.fillStyle = solved ? TEAL : CREAM; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText(solved ? '查号缓存 ✓' : '查号缓存', sx, y - 12)
  if (!solved && Math.abs(px - sx) < 150) { ctx.fillStyle = CREAM; ctx.font = 'bold 20px system-ui'; ctx.fillText('按 E 修', sx, y - 40) }
  ctx.strokeStyle = '#3a342a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, y + fh); ctx.lineTo(x + fw, y + fh); ctx.stroke()
}
function bubbleBox() {
  if (!bubble) return; bubble.t += 1
  const bw = Math.min(600, W - 40), bh = 56, bx = 20, by = H - 92
  ctx.fillStyle = 'rgba(15,12,8,.9)'; ctx.strokeStyle = TEAL; ctx.lineWidth = 2; ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh)
  ctx.fillStyle = TEAL; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('虾米君', bx + 16, by + bh / 2)
  ctx.fillStyle = CREAM; ctx.font = '16px system-ui'; ctx.fillText(bubble.text, bx + 74, by + bh / 2); ctx.textBaseline = 'alphabetic'
}
function hint(s: string) { ctx.fillStyle = 'rgba(20,16,12,.7)'; ctx.font = '15px system-ui'; ctx.textAlign = 'center'; const w = ctx.measureText(s).width + 24; ctx.fillRect(W / 2 - w / 2, 22, w, 28); ctx.fillStyle = AMBER; ctx.textBaseline = 'middle'; ctx.fillText(s, W / 2, 36); ctx.textBaseline = 'alphabetic' }

function tick() {
  t += 1 / 60
  const targetZoom = mode === 'operate' ? 1 : 0
  zoom += (targetZoom - zoom) * 0.14
  // walk 世界更新
  if (mode === 'walk') {
    let dir = 0; if (keys['a'] || keys['arrowleft']) dir = -1; if (keys['d'] || keys['arrowright']) dir = 1
    pvx += (dir * 4 - pvx) * 0.16; px = Math.max(60, Math.min(WORLD - 60, px + pvx)); if (dir) face = dir
    bob = Math.sin(t * 6) * 4; if (Math.abs(pvx) > 1) { stepT -= 1; if (stepT <= 0) { stepT = 18; sfx.step() } }
  }
  camX = Math.max(0, Math.min(WORLD - W, px - W * 0.42))

  // —— 画:连续世界 ——
  ctx.fillStyle = '#1c1710'; ctx.fillRect(0, 0, W, H)
  tileBg(camX * 0.5)
  ctx.fillStyle = 'rgba(18,11,6,.35)'; ctx.fillRect(0, floorY(), W, H - floorY()); ctx.strokeStyle = '#3a342a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, floorY()); ctx.lineTo(W, floorY()); ctx.stroke()
  facade(STATION_X - camX)
  // 下一台(占位)
  const nx = NEXT_X - camX; if (nx > -160 && nx < W + 160) { ctx.strokeStyle = solved ? AMBER : '#5a4e3a'; ctx.lineWidth = 4; ctx.globalAlpha = solved ? 1 : .5; ctx.strokeRect(nx - 130, floorY() - 200, 260, 190); ctx.fillStyle = solved ? CREAM : '#8a7a5a'; ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('递归查号 · 下一台 →', nx, floorY() - 210); ctx.globalAlpha = 1 }
  // 走路时的虾米君
  if (zoom < 0.5) { ctx.globalAlpha = 1 - zoom * 1.6 > 0 ? 1 - zoom * 1.6 : 0; drawBot(px - camX, floorY() + bob, 120, face); ctx.globalAlpha = 1 }

  // —— 操作:镜头框住机器 ——
  if (zoom > 0.02) {
    ctx.fillStyle = `rgba(10,8,5,${zoom * 0.72})`; ctx.fillRect(0, 0, W, H) // 压暗周围
    const fr = framed(), ez = zoom
    // facade→framed 的插值矩形(推近感)
    const sf = { x: STATION_X - camX - 150, y: floorY() - 220, w: 300, h: 210 }
    const r = { x: sf.x + (fr.x - sf.x) * ez, y: sf.y + (fr.y - sf.y) * ez, w: sf.w + (fr.w - sf.w) * ez, h: sf.h + (fr.h - sf.h) * ez }
    if (mode === 'operate' && zoom > 0.9) machine.update(true)
    machine.render(r)
    // 虾米君站在机器底座(在场)
    drawBot(r.x + 46, r.y + r.h + 24, 96, 1)
    // 通关检测
    if (mode === 'operate') { if (winHold >= 0) { winHold++; if (winHold > 70) leave(true) } else if (machine.state === 'win') winHold = 0 }
    if (mode === 'operate' && zoom > 0.9) { ctx.fillStyle = 'rgba(20,16,12,.7)'; ctx.font = '13px system-ui'; ctx.textAlign = 'right'; ctx.fillStyle = AMBER; ctx.fillText('按 Q 走开', W - 20, H - 18) }
  }

  if (mode === 'walk') { bubbleBox(); hint(solved ? '← → / A D 走路   ·   往右走到下一台' : '← → / A D 走路   ·   走到缓存机按 E') }
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

// dev 钩子
;(window as unknown as { __bl: () => object }).__bl = () => ({ mode, zoom: +zoom.toFixed(2), px: Math.round(px), solved, mstate: machine.state })
;(window as unknown as { __walkTo: (x: number) => void }).__walkTo = (x) => { px = x }
;(window as unknown as { __enter: () => void }).__enter = () => { if (mode === 'walk') enter() }
;(window as unknown as { __m: () => CacheMachine }).__m = () => machine
