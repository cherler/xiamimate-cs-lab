/**
 * 机关灰盒②·三段竖井查号(DNS 递归:root → TLD → 权威,一层层往下问)。blockout,状态零文字全靠色/形/位。
 *
 * 读法(一眼看得出这是台"一层层查下去"的竖井):
 *   缓存没命中的信,得走这口竖井。信带**三段地址**(三个形状章,△□○ 各代表一段)。
 *   竖井三层楼:第一层选"大类"、第二层选"分区"、第三层选"出口"——**同一根拨盘**在每层意思不同(一物多用)。
 *   信落在某层的活板门上,盘拨到**它这一段要的形状**,门就开、信掉下一层;拨错=门不开,信干等。
 *   三层全对穿到底 → 落进底部"真地址"托盘=成功,掉一枚维修素材;拨盘同一时刻只有一个形状,
 *   三层若各要不同形状,你只能一层层服务(时序/并行取舍);顶上排队满了溢出=退信(拖延的代价)。
 * 深度:①一物多用(一根拨盘,三层各读地址的不同段);②依赖(第三层要通,前两层必须先放行=锁与钥匙);
 *      ③时序/并行取舍(多封信卡在不同层各要不同形状,拨盘一次只给一个,得排序;拖延→队满→溢出退信)。
 */
import { Level, drawLegend } from './level'
import skinUrl from '../../../web/assets/gen/gates/shaft.webp'
const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
function resize() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()
const SKIN = new Image(); SKIN.src = skinUrl
function drawSkin(a = .5) { // 场景皮:递归查号竖井
  if (SKIN.complete && SKIN.naturalWidth) { const s = Math.max(W / SKIN.naturalWidth, H / SKIN.naturalHeight), dw = SKIN.naturalWidth * s, dh = SKIN.naturalHeight * s; ctx.drawImage(SKIN, (W - dw) / 2, (H - dh) / 2, dw, dh); ctx.fillStyle = `rgba(18,14,10,${a})`; ctx.fillRect(0, 0, W, H) }
  else { ctx.fillStyle = '#1e1a14'; ctx.fillRect(0, 0, W, H) }
}

const COLS = ['#e0954b', '#5b8def', '#3fa78f'] // △ □ ○
type Pk = { addr: number[]; rest: number; slide: number; flash: number }
let dial = 0
const tiers: (Pk | null)[] = [null, null, null]
let queue: Pk[] = []
const QMAX = 4
const D = Math.max(1, +(new URLSearchParams(location.search).get('d') || 1)) // 难度:信来得越快
const SPAWN_CYCLE = Math.max(1.0, 1.8 - (D - 1) * 0.35)
let success = 0, reject = 0, spawnT = 1.2, t = 0, auto = true, deliverFx = 0
const rejectBin: number[] = []      // 溢出退信堆(存首形状,纯堆叠)
const wonShards: number[] = []      // 成功掉落的维修素材
const level = new Level(10, 6)      // 目标:穿到底送对 10 封=开门赢;溢出退信攒到 6 封=输
function resetAll() { tiers[0] = tiers[1] = tiers[2] = null; queue = []; success = 0; reject = 0; dial = 0; rejectBin.length = 0; wonShards.length = 0; spawnT = 1.2; level.reset() }

function randAddr() { return [Math.floor(Math.random() * 3), Math.floor(Math.random() * 3), Math.floor(Math.random() * 3)] }
function mkPk(addr = randAddr()): Pk { return { addr, rest: 0, slide: 0, flash: 0 } }
function enqueue(addr?: number[]) { const p = mkPk(addr); if (queue.length >= QMAX) { reject++; rejectBin.push(p.addr[0]!); level.bad() } else queue.push(p) }

function L() {
  const cx = W * 0.44, halfW = 150
  const tierY = [H * 0.30, H * 0.50, H * 0.70], trayY = H * 0.88
  return { cx, halfW, tierY, trayY, queueY: H * 0.12, dialX: W * 0.76, dialY: H * 0.44, binX: W * 0.10 }
}

function hit(x: number, y: number) { // 点竖井=不管;点拨盘=循环;点某形状按钮=直设
  const g = L()
  if (Math.hypot(x - g.dialX, y - g.dialY) < 70) { dial = (dial + 1) % 3; return }
  for (let i = 0; i < 3; i++) if (Math.hypot(x - (g.dialX - 90 + i * 90), y - (g.dialY + 120)) < 26) { dial = i; return }
}
cv.addEventListener('pointerdown', e => hit(e.clientX, e.clientY))
addEventListener('keydown', e => { if (e.key >= '1' && e.key <= '3') dial = +e.key - 1; if (e.key === ' ') { e.preventDefault(); dial = (dial + 1) % 3 }; if (e.key === 'r' || e.key === 'R') resetAll() })

function shapeMark(x: number, y: number, r: number, shape: number, col: string, hl = false) {
  ctx.fillStyle = col; ctx.strokeStyle = hl ? '#fff' : 'rgba(0,0,0,.35)'; ctx.lineWidth = hl ? 3 : 2; ctx.beginPath()
  if (shape === 0) { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath() }
  else if (shape === 1) ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7)
  else ctx.arc(x, y, r, 0, 7)
  ctx.fill(); ctx.stroke()
}
function drawPk(p: Pk, x: number, y: number, curTier: number) {
  ctx.fillStyle = '#efe6d2'; ctx.strokeStyle = '#9c7f56'; ctx.lineWidth = 2; ctx.beginPath(); ctx.rect(x - 46, y - 15, 92, 30); ctx.fill(); ctx.stroke()
  for (let i = 0; i < 3; i++) shapeMark(x - 26 + i * 26, y, 8, p.addr[i]!, COLS[p.addr[i]!]!, i === curTier) // 三段地址,当前层高亮
}

function step() {
  // 进料:tier0 空且有队 → 落入
  if (!tiers[0] && queue.length) { tiers[0] = queue.shift()!; tiers[0]!.rest = 0 }
  // 自底向上结算:门开=拨盘匹配该层该段 且 该层信已停稳
  for (let k = 2; k >= 0; k--) {
    const p = tiers[k]; if (!p) continue
    p.rest += 1 / 60
    if (p.rest < 0.28) continue                       // 停稳一小拍才可放行(看得清)
    if (dial !== p.addr[k]) continue                  // 拨盘没对上这一段=门不开
    if (k === 2) { tiers[2] = null; success++; wonShards.push(p.addr[0]!); deliverFx = 1; level.good() } // 穿到底=成功
    else if (!tiers[k + 1]) { tiers[k + 1] = p; tiers[k] = null; p.rest = 0; p.slide = 1; p.flash = 1 } // 依赖:下层空才放行
  }
}

function frame() {
  t += 1 / 60; const playing = level.state === 'play'
  if (playing && auto) { spawnT -= 1 / 60; if (spawnT <= 0) { spawnT = SPAWN_CYCLE; enqueue() } }
  if (playing) step()
  deliverFx = Math.max(0, deliverFx - .03)
  for (const p of [...tiers, ...queue]) { if (p) { p.slide = Math.max(0, p.slide - .08); p.flash = Math.max(0, p.flash - .05) } }
  const g = L()

  drawSkin()

  // 竖井外壳 + 三层活板门
  ctx.fillStyle = '#241d16'; ctx.fillRect(g.cx - g.halfW, g.tierY[0]! - 60, g.halfW * 2, g.trayY - g.tierY[0]! + 40)
  ctx.strokeStyle = '#4a4030'; ctx.lineWidth = 4; ctx.strokeRect(g.cx - g.halfW, g.tierY[0]! - 60, g.halfW * 2, g.trayY - g.tierY[0]! + 40)
  for (let k = 0; k < 3; k++) {
    const y = g.tierY[k]! + 26, p = tiers[k]
    const open = !!p && p.rest >= 0.28 && dial === p.addr[k]!
    // 活板门:开=分向两侧(青),关=闭合(暗)
    ctx.strokeStyle = open ? '#49a791' : '#5a4e3a'; ctx.lineWidth = 6
    const gap = open ? 40 : 6
    ctx.beginPath(); ctx.moveTo(g.cx - g.halfW + 8, y); ctx.lineTo(g.cx - gap, y + (open ? 26 : 0)); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(g.cx + g.halfW - 8, y); ctx.lineTo(g.cx + gap, y + (open ? 26 : 0)); ctx.stroke()
    // 该层"锁孔":这封信在这层要的形状;把拨盘转成它=门开(匹配→青;没对上→琥珀色脉冲提醒你去转)
    if (p && p.rest >= 0.28) {
      const kx = g.cx - g.halfW + 40, ky = g.tierY[k]!, matched = dial === p.addr[k]!
      ctx.globalAlpha = matched ? 1 : 0.5 + 0.28 * Math.sin(t * 6)
      ctx.strokeStyle = matched ? '#7fe8c0' : '#e8c98a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(kx, ky, 23, 0, 7); ctx.stroke(); ctx.globalAlpha = 1
      shapeMark(kx, ky, 13, p.addr[k]!, matched ? '#7fe8c0' : COLS[p.addr[k]!]!, matched)
    }
  }

  // 顶部排队(满了闪红警示)+ 溢出退信桶(左)
  for (let i = 0; i < queue.length; i++) drawPk(queue[i]!, g.cx - g.halfW + 60 + i * 100, g.queueY, -1)
  if (queue.length >= QMAX) { ctx.strokeStyle = `rgba(200,60,46,${.4 + .3 * Math.sin(t * 8)})`; ctx.lineWidth = 4; ctx.strokeRect(g.cx - g.halfW + 10, g.queueY - 22, QMAX * 100, 44) }
  ctx.fillStyle = '#3a2b26'; ctx.fillRect(g.binX - 40, g.queueY + 40, 80, 120); ctx.strokeStyle = '#7a5a44'; ctx.lineWidth = 3; ctx.strokeRect(g.binX - 40, g.queueY + 40, 80, 120)
  rejectBin.slice(-15).forEach((s, i) => shapeMark(g.binX - 22 + (i % 3) * 22, g.queueY + 140 - Math.floor(i / 3) * 22, 8, s, '#8a6a5a'))

  // 三层里的信
  for (let k = 0; k < 3; k++) { const p = tiers[k]; if (p) drawPk(p, g.cx, g.tierY[k]! - p.slide * (g.tierY[1]! - g.tierY[0]!), k) }

  // 底部真地址托盘(成功)+ 素材堆
  ctx.fillStyle = deliverFx > 0 ? `rgba(73,167,145,${.25 + deliverFx * .5})` : '#20302a'; ctx.fillRect(g.cx - g.halfW, g.trayY - 6, g.halfW * 2, 40)
  ctx.strokeStyle = '#49a791'; ctx.lineWidth = 3; ctx.strokeRect(g.cx - g.halfW, g.trayY - 6, g.halfW * 2, 40)
  for (let i = 0; i < Math.min(wonShards.length, 30); i++) { ctx.fillStyle = '#ffd27a'; const sx = g.cx - g.halfW + 16 + (i % 10) * 26, sy = g.trayY + 14 - Math.floor(i / 10) * 22; ctx.beginPath(); ctx.moveTo(sx, sy - 7); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx, sy + 7); ctx.lineTo(sx - 6, sy); ctx.closePath(); ctx.fill() }

  // 拨盘(同一根,三层复用)+ 三形状直选钮
  ctx.fillStyle = '#2c261e'; ctx.beginPath(); ctx.arc(g.dialX, g.dialY, 66, 0, 7); ctx.fill(); ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 5; ctx.stroke()
  shapeMark(g.dialX, g.dialY, 30, dial, COLS[dial]!)
  // 指针:指向"当前有信在等这个形状"的层,提示这一拨会放谁
  ctx.strokeStyle = '#9c7f56'; ctx.lineWidth = 3
  for (let k = 0; k < 3; k++) { const p = tiers[k]; if (p && p.rest >= 0.28 && p.addr[k] === dial) { ctx.beginPath(); ctx.moveTo(g.dialX - 66, g.dialY); ctx.lineTo(g.cx + g.halfW, g.tierY[k]! + 20); ctx.stroke() } }
  for (let i = 0; i < 3; i++) { const bx = g.dialX - 90 + i * 90, by = g.dialY + 120; ctx.fillStyle = i === dial ? '#3a342a' : '#241d16'; ctx.beginPath(); ctx.arc(bx, by, 24, 0, 7); ctx.fill(); ctx.strokeStyle = i === dial ? '#fff' : '#5a4e3a'; ctx.lineWidth = 2; ctx.stroke(); shapeMark(bx, by, 12, i, COLS[i]!) }

  drawLegend(ctx, W, H, '把拨盘(右)转成"哪层锁孔亮起的形状"→那层门开、信落下一层;穿到底=送达', [
    { k: '1 2 3', t: '拨盘转到 △ / □ / ○' },
    { k: '点拨盘', t: '循环换形状' },
    { k: 'R', t: '重来' },
  ])
  level.render(ctx, W, H, t)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

;(window as unknown as { __state: () => object }).__state = () => ({ dial, tiers: tiers.map(p => p ? p.addr : null), queue: queue.length, success, reject, level: level.snapshot() })
;(window as unknown as { __dial: (s: number) => void }).__dial = (s) => { dial = s }
;(window as unknown as { __spawn: (a?: number[]) => void }).__spawn = (a) => enqueue(a)
;(window as unknown as { __auto: (on: boolean) => void }).__auto = (on) => { auto = on }
;(window as unknown as { __reset: () => void }).__reset = () => resetAll()

export {}
;(window as unknown as { __level: (g: number, f: number) => void }).__level = (g, f) => { level.goal = g; level.failMax = f; level.reset() }
