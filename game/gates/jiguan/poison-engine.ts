/**
 * 机关灰盒③·把毒当引擎(反转:①②里到处躲的紫毒,这儿是**动力**)。blockout,状态零文字全靠色/形/位/预演。
 *
 * 读法(一眼看得出这是台"配重吊"):滑轮两头——左边挂**配重桶**,右边是**升降台**驮着要救的青色核心。
 *   桶越重、左边越沉 → 右边升降台越高。把**紫毒**导进桶里增重,就能把核心顶到右边的**出闸台**(青色窗口带)。
 *   毒会慢慢渗漏(桶变轻),得**补**;但灌过头(超红线)→ 升降台撞顶、核心被甩飞 = 失败,归零重来。
 *   核心停在青窗口里稳住一会 → 滚上出闸台 = 成功,掉一枚维修素材。
 *
 * 分流阀三档(同一个阀,三种用法):灌(毒→桶,升)/ 停(不流,慢漏)/ 排(桶→废,快降)。
 * 可预演:半透明"幽灵"按当前阀档把接下来会怎样先跑给你看——会冲过红线(红)/ 到不了窗口(黄)/ 正好进窗口(青)。
 * 深度:①反转·障碍即资源(毒=动力);②因果连锁(毒→配重→滑轮→升降台→核心出闸,一处输入牵一条链);
 *      ③取舍时序(灌够但别过、顶住渗漏、过冲受罚);④可预演(先看因果链再下手,无文字谜题的命根)。
 */
import { Level, drawLegend } from './level'
import skinUrl from '../../../web/assets/gen/gates/engine.webp'
const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
function resize() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()
const SKIN = new Image(); SKIN.src = skinUrl
function drawSkin(a = .46) { // 场景皮:配重吊引擎室
  if (SKIN.complete && SKIN.naturalWidth) { const s = Math.max(W / SKIN.naturalWidth, H / SKIN.naturalHeight), dw = SKIN.naturalWidth * s, dh = SKIN.naturalHeight * s; ctx.drawImage(SKIN, (W - dw) / 2, (H - dh) / 2, dw, dh); ctx.fillStyle = `rgba(18,14,10,${a})`; ctx.fillRect(0, 0, W, H) }
  else { ctx.fillStyle = '#1e1a14'; ctx.fillRect(0, 0, W, H) }
}

const POISON = '#8b5cc0', CORE = '#3fa78f'
const WIN_LO = 70, WIN_HI = 84, CEIL = 89   // 窗口 [70,84](窄+离红线近),要顶到高位才够2秒→逼近红线,险
type Mode = 'fill' | 'hold'
let w = 0, mode: Mode = 'hold', held = 0, success = 0, fails = 0, t = 0
let flashFail = 0, deliverFx = 0, ghostOn = true
const shards: number[] = []
const RATE = { fill: 14, hold: -6 } // 只留两档:F 灌=上升 / H = 慢慢下降(兼当排,不再单设快排 D)
const level = new Level(2, 3) // 目标:顶两枚核心出闸=赢;冲过红线甩飞 3 次=输
function resetAll() { w = 0; mode = 'hold'; held = 0; success = 0; fails = 0; shards.length = 0; level.reset() }

function L() {
  const cx = W * 0.5, pulleyY = H * 0.13
  const top = H * 0.24, bot = H * 0.80
  return { cx, pulleyY, top, bot, bx: W * 0.30, ex: W * 0.70, srcX: W * 0.12, srcY: H * 0.20 }
}
const elevY = (val: number) => { const g = L(); return g.bot - (val / 100) * (g.bot - g.top) }   // 重→高
const buckY = (val: number) => { const g = L(); return g.top + (val / 100) * (g.bot - g.top) }    // 重→低
function inWin(val: number) { return val >= WIN_LO && val <= WIN_HI }

function forecast(): 'over' | 'short' | 'ok' { // 按当前阀档往前跑 ~1.2s,预告落点
  let v = w, mx = w; for (let i = 0; i < 72; i++) { v = Math.max(0, Math.min(100, v + RATE[mode] / 60)); mx = Math.max(mx, v) }
  if (mx > CEIL || v > WIN_HI + 3) return 'over'
  if (v < WIN_LO) return 'short'
  return 'ok'
}

function setMode(m: Mode) { mode = m }
function hit(x: number, y: number) { const g = L(); for (let i = 0; i < 2; i++) if (Math.hypot(x - (g.srcX - 30 + i * 60), y - (g.srcY + 150)) < 26) setMode((['fill', 'hold'] as const)[i]!) }
cv.addEventListener('pointerdown', e => hit(e.clientX, e.clientY))
addEventListener('keydown', e => { if (e.key === 'f') setMode('fill'); if (e.key === 'h') setMode('hold'); if (e.key === 'g') ghostOn = !ghostOn; if (e.key === 'r' || e.key === 'R') resetAll() })

function step() {
  w = Math.max(0, Math.min(100, w + RATE[mode] / 60))
  if (w > CEIL) { fails++; flashFail = 1; w = 0; held = 0; mode = 'hold'; level.bad(); return } // 过冲:撞顶甩飞
  if (inWin(w)) { held += 1 / 60; if (held >= 2.0) { success++; shards.push(0); deliverFx = 1; w = 0; held = 0; mode = 'hold'; level.good() } }
  else held = Math.max(0, held - 1 / 60 * 0.6)
}

function drawCore(x: number, y: number, col: string, a = 1) {
  ctx.globalAlpha = a; ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(x, y - 16); ctx.lineTo(x + 14, y); ctx.lineTo(x, y + 16); ctx.lineTo(x - 14, y); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1
}

function frame() {
  t += 1 / 60; if (level.state === 'play') step()
  flashFail = Math.max(0, flashFail - .03); deliverFx = Math.max(0, deliverFx - .03)
  const g = L(), fc = forecast()

  drawSkin()
  if (flashFail > 0) { ctx.fillStyle = `rgba(120,30,22,${.4 + flashFail * .45})`; ctx.fillRect(0, 0, W, H) } // 过冲甩飞红闪

  // 毒源 + 分流阀三档
  ctx.fillStyle = '#3a2b4a'; ctx.fillRect(g.srcX - 34, g.srcY - 40, 68, 54); ctx.fillStyle = POISON; ctx.fillRect(g.srcX - 28, g.srcY - 12, 56, 20)
  for (let i = 0; i < 2; i++) { const m = (['fill', 'hold'] as const)[i]!, bx = g.srcX - 30 + i * 60, by = g.srcY + 150
    ctx.fillStyle = mode === m ? '#3a342a' : '#241d16'; ctx.beginPath(); ctx.arc(bx, by, 24, 0, 7); ctx.fill()
    ctx.strokeStyle = mode === m ? '#fff' : '#5a4e3a'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = m === 'fill' ? POISON : '#8a9a8a'
    if (m === 'fill') { ctx.beginPath(); ctx.moveTo(bx, by - 8); ctx.lineTo(bx + 8, by + 6); ctx.lineTo(bx - 8, by + 6); ctx.closePath(); ctx.fill() }  // ▲灌=升
    else { ctx.beginPath(); ctx.moveTo(bx, by + 8); ctx.lineTo(bx + 8, by - 6); ctx.lineTo(bx - 8, by - 6); ctx.closePath(); ctx.fill() }               // ▼停=慢降
  }
  // 灌时:毒从源流向桶(动线)
  if (mode === 'fill') { for (let i = 0; i < 5; i++) { const p = ((t * 2 + i / 5) % 1); ctx.fillStyle = POISON; ctx.beginPath(); ctx.arc(g.srcX + (g.bx - g.srcX) * p, g.srcY + 24 + Math.sin(p * 3) * 8, 4, 0, 7); ctx.fill() } }

  // 滑轮 + 两根绳
  ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(g.cx, g.pulleyY, 26, 0, 7); ctx.stroke()
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(g.cx - 26, g.pulleyY); ctx.lineTo(g.bx, buckY(w)); ctx.moveTo(g.cx + 26, g.pulleyY); ctx.lineTo(g.ex, elevY(w)); ctx.stroke()

  // 配重桶(左)——装紫毒,越满越沉越低
  const bw = 92, bh = 110, by0 = buckY(w)
  ctx.fillStyle = '#241d16'; ctx.fillRect(g.bx - bw / 2, by0, bw, bh); ctx.strokeStyle = '#5a4e3a'; ctx.lineWidth = 3; ctx.strokeRect(g.bx - bw / 2, by0, bw, bh)
  const fh = (bh - 8) * (w / 100); ctx.fillStyle = POISON; ctx.fillRect(g.bx - bw / 2 + 4, by0 + bh - 4 - fh, bw - 8, fh)

  // 升降台轨道(右)+ 窗口带 + 红线 + 出闸台
  ctx.strokeStyle = '#3a342a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.ex, g.top - 20); ctx.lineTo(g.ex, g.bot + 30); ctx.stroke()
  ctx.fillStyle = 'rgba(73,167,145,.16)'; ctx.fillRect(g.ex - 60, elevY(WIN_HI), 120, elevY(WIN_LO) - elevY(WIN_HI)) // 窗口带
  ctx.strokeStyle = '#49a791'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1; ctx.strokeRect(g.ex - 60, elevY(WIN_HI), 120, elevY(WIN_LO) - elevY(WIN_HI)); ctx.setLineDash([])
  ctx.strokeStyle = '#a83c2e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.ex - 70, elevY(CEIL)); ctx.lineTo(g.ex + 70, elevY(CEIL)); ctx.stroke() // 红线
  ctx.fillStyle = '#20302a'; ctx.fillRect(g.ex + 60, elevY(WIN_HI) - 6, 90, elevY(WIN_LO) - elevY(WIN_HI) + 12); ctx.strokeStyle = '#49a791'; ctx.lineWidth = 2; ctx.strokeRect(g.ex + 60, elevY(WIN_HI) - 6, 90, elevY(WIN_LO) - elevY(WIN_HI) + 12) // 出闸台

  // 幽灵预演:半透明升降台落点 + 颜色判词
  if (ghostOn) {
    let v = w, mx = w; for (let i = 0; i < 72; i++) { v = Math.max(0, Math.min(100, v + RATE[mode] / 60)); mx = Math.max(mx, v) }
    const gy = elevY(mode === 'fill' && mx > CEIL ? CEIL : v)
    const col = fc === 'ok' ? '73,167,145' : fc === 'over' ? '200,60,46' : '224,180,80'
    ctx.globalAlpha = .32; ctx.fillStyle = `rgb(${col})`; ctx.fillRect(g.ex - 52, gy - 6, 104, 12)
    ctx.strokeStyle = `rgba(${col},.8)`; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(g.ex - 60, gy); ctx.lineTo(g.ex + 150, gy); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1
    drawCore(g.ex, gy - 18, `rgb(${col})`, .4)
  }

  // 升降台 + 核心(在窗口里稳住时,进度环)
  const ey = elevY(w)
  ctx.fillStyle = '#4a4030'; ctx.fillRect(g.ex - 52, ey - 6, 104, 12)
  drawCore(g.ex, ey - 20, deliverFx > 0 ? '#bff5e4' : CORE)
  if (inWin(w) && held > 0) { ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(g.ex, ey - 20, 26, -Math.PI / 2, -Math.PI / 2 + (held / 2.0) * Math.PI * 2); ctx.stroke() }

  // 素材堆(成功)
  for (let i = 0; i < Math.min(shards.length, 24); i++) { ctx.fillStyle = '#ffd27a'; const sx = g.ex + 66 + (i % 4) * 20, sy = g.bot + 10 - Math.floor(i / 4) * 18; ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 5, sy); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 5, sy); ctx.closePath(); ctx.fill() }
  drawLegend(ctx, W, H, '灌毒→配重把青核心顶进右边窗口带→稳住一会=出闸。看红色幽灵别冲过红线', [
    { k: 'F', t: '灌毒(核心上升)' },
    { k: 'H', t: '松开(核心慢慢下降)' },
    { k: 'G', t: '预演开关   R  重来' },
  ])
  level.render(ctx, W, H, t)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

;(window as unknown as { __state: () => object }).__state = () => ({ w: Math.round(w), mode, held: +held.toFixed(2), success, fails, inWin: inWin(w), forecast: forecast(), shards: shards.length, ghost: ghostOn, level: level.snapshot() })
;(window as unknown as { __mode: (m: Mode) => void }).__mode = (m) => setMode(m)
;(window as unknown as { __set: (val: number, m?: Mode) => void }).__set = (val, m) => { w = Math.max(0, Math.min(100, val)); if (m) mode = m; held = 0 }
;(window as unknown as { __reset: () => void }).__reset = () => resetAll()
;(window as unknown as { __ghost: (on: boolean) => void }).__ghost = (on) => { ghostOn = on }

export {}
;(window as unknown as { __level: (g: number, f: number) => void }).__level = (g, f) => { level.goal = g; level.failMax = f; level.reset() }
