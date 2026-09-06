/**
 * 「搭机器」第三台设备 · Cache(内存层级)—— 页面层。
 *
 * **仿真不在这儿**:全部在 game/build/cache-core.ts(纯内核,零 DOM)。这一层只管画和点。
 * 这么分是有代价换来的好处:内核能被 node 直接 import,于是那套穷举审查
 * (tests/cache.test.ts)秒级跑完并且进了 npm test,不用再隔着 playwright 打页面钩子。
 *
 * 玩法的手感刻意和前两台呼应,但考的是另一件事:
 *   · 路由器那台:在地址上下刀,切出「网络号 / 主机号」——> **这台切出「tag / index / offset」,同一个动作**
 *   · CPU 那台:在微操作之间下刀插流水寄存器 ——> 这台的两把刀也是黄铜闸,一眼认得出是同一个世界
 *   · 但**这台没有「对错」**:cache 是透明的,怎么配结果都对。你在调的是时间。
 */
import { mountHub, type Hub } from '../hub'
import { makeKit, BRASS, STEEL, VIOLET, GOLD, GREEN, AQUA, ROSE, INK } from './kit'
import { LEVELS, NBITS, runCache, sameAsFlat, COST, type Cfg, type Part, type CacheRun } from './cache-core'
import corrUrl from '../../web/assets/gen/gates/corridor.webp'

let HUB: Hub | null = null
const CORR = (() => { const i = new Image(); i.src = corrUrl; return i })()
const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
//  画布上面还有一条「虾米课堂」外壳条,所以量画布自己的尺寸 —— 读 innerHeight 会多算 36px
function resize() { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()

const CREAM = '#efe6d2', AMBER = '#e8c98a', TEAL = '#49a791', RED = '#c8452e', DIM = '#9a8a6a'
const PART_NAME: Record<Part, string> = { lru: 'LRU 替换', wb: '写回单元', pf: '预取下一块' }
const PART_SUB: Record<Part, string> = { lru: '踢最久没用的', wb: '脏位 + 攒着写', pf: '顺带捎下一块' }
const PART_SKIN: Record<Part, string[]> = { lru: VIOLET, wb: ROSE, pf: AQUA }

// —— 状态 ——
let lvl = 0
const L = () => LEVELS[lvl]!
/** 两把刀:右刀右边有 ob 位(offset),两刀之间 ib 位(index),剩下全是 tag。 */
let ob = 0, ib = 0
let ways = 1
let on: Record<Part, boolean> = { lru: false, wb: false, pf: false }
let run: CacheRun | null = null

const B = () => 1 << ob, S = () => 1 << ib
const cap = () => B() * S() * ways
const overCap = () => cap() > L().cap
const cfg = (): Cfg => ({ ob, ib, ways, ...on })

//  进度不在这儿读:课堂外壳(hub)开场就会把本机存的那份 write 回来,并接着去同步账号。
//  自己再读一个 localStorage 键只会读到永远为空的东西 —— 那是另一台机器留下的写法。
let best: Record<number, { cycles: number }> = {}
const passed = (i: number) => best[i] !== undefined
const unlocked = (i: number) => i === 0 || passed(i - 1)

function loadLevel(i: number) {
  lvl = Math.max(0, Math.min(LEVELS.length - 1, i))
  ob = 0; ib = 0; ways = L().wayOpts[0]!; on = { lru: false, wb: false, pf: false }; run = null
}

function doRun() {
  if (overCap()) { run = null; return }
  run = runCache(L().trace, cfg())
  if (run.cycles <= L().par.cycles) {
    best[lvl] = { cycles: Math.min(best[lvl]?.cycles ?? Infinity, run.cycles) }
    HUB?.save()   // 存盘交给课堂外壳:它同时管本机与账号同步
  }
}

/* 版面竖着码,别再让哪一块压到另一块上:
   关卡条 20~52 / 页眉 74~192 / 地址位条 205~267(位段标签到 296)/
   旋钮行 316~384 / cache 阵列 410~(H-232) / 时空条 (H-212)~(H-150) / 底部读数与按钮 (H-124)~ */
function geo() {
  const barX = 44, barW = W - 430
  return { barX, barW, cw: barW / NBITS, barY: 205, barH: 62, rightX: W - 356, rightW: 312 }
}
function levelBtns() { const bw = Math.min(210, (W - 48) / LEVELS.length - 8); return LEVELS.map((_, i) => ({ i, x: 24 + i * (bw + 8), y: 20, bw, bh: 32 })) }
/** 位条里离点击处最近的那道缝(0 = 最右端,NBITS = 最左端)。 */
function nearestBoundary(px: number) {
  const g = geo()
  return Math.max(0, Math.min(NBITS, Math.round((g.barX + g.barW - px) / g.cw)))
}
/**
 * 把离得近的那把刀挪到第 k 道缝上 —— 位条上的**快捷方式**。
 *
 * ⚠️ 两把刀重合的时候(index 0 位,开局就是这样),「点的是哪一把」本来就没法判:
 * 同一个位置上摞着两把刀。第一版硬定了个规矩(重合时挪左刀),结果开局第一下点出来的
 * 是 index 位而不是 offset —— 和关卡里让人做的事正好反着,而且**它不报错,只是不听话**。
 * 所以真正的控制放在读数牌上的 ± 上(块大小 = offset 位、组数 = index 位,一目了然),
 * 这里只保留「两刀分开时,挪近的那把」,重合时一律当成挪右刀(长 offset)。
 */
function moveCut(k: number) {
  const lc = ob + ib
  const dR = Math.abs(k - ob), dL = Math.abs(k - lc)
  if (dR <= dL) { ib = Math.max(0, lc - k); ob = k }
  else ib = Math.max(k, ob) - ob
  run = null
}
/** 读数牌上的 ±:d = ±1 位。加不动就不动(位数用完了),不静默换个意思。 */
function step(which: 'ob' | 'ib', d: number) {
  if (which === 'ob') { const v = ob + d; if (v < 0 || v + ib > NBITS) return; ob = v }
  else { const v = ib + d; if (v < 0 || ob + v > NBITS) return; ib = v }
  run = null
}
/** 块大小 / 组数 两块读数牌上的减号加号。 */
function stepBtns() {
  const g = geo()
  return ([['ob', g.barX] as const, ['ib', g.barX + 120] as const]).flatMap(([w, x]) =>
    [{ w, d: -1, x: x + 6, y: 356, bw: 26, bh: 24 }, { w, d: +1, x: x + 78, y: 356, bw: 26, bh: 24 }])
}
function wayBtns() {
  const g = geo(), bw = 46, gap = 8
  return L().wayOpts.map((w, i) => ({ w, x: g.barX + 372 + i * (bw + gap), y: 340, bw, bh: 34 }))
}
/** 三个零件**必须排成一行**:换行摆的话第三个会掉到下面,正好压住那块「地址走一遍」的面板。 */
function partBtns() {
  const g = geo(), gap = 8, bw = (g.rightW - 2 * gap) / 3
  return L().parts.map((p, i) => ({ p, x: g.rightX + i * (bw + gap), y: 316, bw, bh: 68 }))
}
function runBtn() { const bw = 168, bh = 52; return { x: W - bw - 24, y: H - bh - 18, bw, bh } }

/** 画布上面是「虾米课堂」外壳条,命中判断一律用画布内坐标。 */
const at = (e: { clientX: number; clientY: number }) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
const inBox = (x: number, y: number, b: { x: number; y: number; bw: number; bh: number }) => x >= b.x && x <= b.x + b.bw && y >= b.y && y <= b.y + b.bh
cv.addEventListener('pointerdown', ev => {
  if (HUB?.isPaused()) return
  const { x, y } = at(ev)
  for (const b of levelBtns()) if (unlocked(b.i) && inBox(x, y, b)) { loadLevel(b.i); return }
  if (inBox(x, y, runBtn())) { doRun(); return }
  for (const b of stepBtns()) if (inBox(x, y, b)) { step(b.w, b.d); return }
  for (const b of wayBtns()) if (inBox(x, y, b)) { ways = b.w; run = null; return }
  for (const b of partBtns()) if (inBox(x, y, b)) { on = { ...on, [b.p]: !on[b.p] }; run = null; return }
  const g = geo()
  if (x >= g.barX - 12 && x <= g.barX + g.barW + 12 && y >= g.barY - 14 && y <= g.barY + g.barH + 14) moveCut(nearestBoundary(x))
})
addEventListener('keydown', e => {
  if (HUB?.isPaused()) return
  if (e.key === ' ') { e.preventDefault(); doRun() }
  if (e.key === 'ArrowRight' && unlocked(lvl + 1)) loadLevel(lvl + 1)
  if (e.key === 'ArrowLeft') loadLevel(lvl - 1)
})

// —— 画 —— 物件即美术,和前两台同源(共用 game/build/kit.ts)
const K = makeKit(ctx)
/** 面板上的字:亮填充 + 深描边。深色字压在冷钢/黄铜上会糊成一团 —— 前一台栽过。 */
function label(t: string, x: number, y: number, size: number, fill = '#fff3dc', align: CanvasTextAlign = 'center') {
  ctx.font = `700 ${size}px ui-sans-serif,system-ui`; ctx.textAlign = align
  ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = 'rgba(18,12,6,.72)'; ctx.lineJoin = 'round'
  ctx.strokeText(t, x, y); ctx.fillStyle = fill; ctx.fillText(t, x, y)
}
const plain = (t: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = 'left', weight = 400) => {
  ctx.font = `${weight} ${size}px ui-sans-serif,system-ui`; ctx.textAlign = align; ctx.fillStyle = col; ctx.fillText(t, x, y)
}
/** 一把黄铜切刀 —— 和 CPU 切级关的流水寄存器闸同一个画法,一眼认得出是同一个世界的零件。 */
function knife(x: number, yTop: number, h: number, tint: string[]) {
  K.plate(x - 5, yTop - 10, 10, h + 20, 3, tint)
  ctx.fillStyle = 'rgba(20,14,8,.8)'; ctx.beginPath()
  ctx.moveTo(x - 9, yTop - 10); ctx.lineTo(x + 9, yTop - 10); ctx.lineTo(x, yTop - 22); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = tint[0]!; ctx.lineWidth = 1.6; ctx.stroke()
}

function frame() {
  ctx.clearRect(0, 0, W, H)
  K.coverImg(CORR, 0, 0, W, H, .78)   // 同一条走廊,压暗 —— 你还在这台机器肚子里
  const g = geo(), Lv = L()

  // 关卡条
  for (const b of levelBtns()) {
    const state = b.i === lvl ? GOLD : passed(b.i) ? GREEN : unlocked(b.i) ? STEEL : ['#2b2822', '#211e19', '#141210']
    K.panel(b.x, b.y, b.bw, b.bh, state, 6)
    const txt = `${b.i}. ${['切三段', '块多大', '冲突', '踢谁', '写策略', '预取', '终关'][b.i] ?? ''}`
    //  选中那块是亮金色,亮字压上去糊成一片 —— 这一块反过来用深字
    if (b.i === lvl) plain(txt, b.x + b.bw / 2, b.y + 21, 13, '#2c1d05', 'center', 700)
    else label(txt, b.x + b.bw / 2, b.y + 21, 13, unlocked(b.i) ? '#fff3dc' : '#6b6357')
  }

  // 页眉
  plain(Lv.name, 44, 92, 22, CREAM, 'left', 700)
  plain(Lv.story, 44, 116, 14, AMBER)
  ctx.font = '13px ui-sans-serif,system-ui'; ctx.fillStyle = DIM; ctx.textAlign = 'left'
  K.wrapText(Lv.hint, 44, 140, W - 88, 19, 4)

  // —— 地址位条:一个 12 位的地址,被两把刀切成 tag | index | offset ——
  plain('一个地址进来,先在这儿切三段(和路由器那台的子网掩码是同一个动作)——  点位条上任意一处,离得最近的那把刀就挪过去', 44, 194, 13, DIM)
  for (let bit = NBITS - 1; bit >= 0; bit--) {
    const x = g.barX + (NBITS - 1 - bit) * g.cw
    const seg = bit < ob ? 'off' : bit < ob + ib ? 'idx' : 'tag'
    K.panel(x + 2, g.barY, g.cw - 4, g.barH, seg === 'off' ? BRASS : seg === 'idx' ? VIOLET : STEEL, 5)
    label(String(bit), x + g.cw / 2, g.barY + 26, 15)
    label(seg === 'off' ? '字' : seg === 'idx' ? '组' : 'tag', x + g.cw / 2, g.barY + 48, 11, 'rgba(255,244,220,.8)')
  }
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2; K.rr(g.barX, g.barY - 3, g.barW, g.barH + 6, 7); ctx.stroke()
  knife(g.barX + g.barW - ob * g.cw, g.barY, g.barH, BRASS)
  if (ib > 0) knife(g.barX + g.barW - (ob + ib) * g.cw, g.barY, g.barH, VIOLET)
  // 三段的名字与位数
  const segLabel = (from: number, to: number, name: string, col: string) => {
    if (to <= from) return
    const x1 = g.barX + g.barW - to * g.cw, x2 = g.barX + g.barW - from * g.cw
    ctx.strokeStyle = col; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x1 + 3, g.barY + g.barH + 10); ctx.lineTo(x2 - 3, g.barY + g.barH + 10); ctx.stroke()
    plain(`${name} ${to - from} 位`, (x1 + x2) / 2, g.barY + g.barH + 28, 13, col, 'center', 700)
  }
  segLabel(ob + ib, NBITS, 'tag', '#9fb0cc'); segLabel(ob, ob + ib, 'index', '#c6adde'); segLabel(0, ob, 'offset', AMBER)

  // —— 读数牌:块大小 / 组数 / 路数 / 容量 ——
  const chip = (x: number, y: number, w: number, h: number, skin: string[], top: string, big: string) => {
    K.panel(x, y, w, h, skin, 8); label(top, x + w / 2, y + 22, 12, 'rgba(255,244,220,.85)'); label(big, x + w / 2, y + 50, 22)
  }
  chip(g.barX, 316, 110, 68, BRASS, `offset ${ob} 位`, `${B()} 字`)
  chip(g.barX + 120, 316, 110, 68, VIOLET, `index ${ib} 位`, `${S()} 组`)
  chip(g.barX + 240, 316, 110, 68, INK, '路数', `${ways} 路`)
  //  两块牌上的 ±:这才是挪刀的正经控制(位条点击只是快捷方式)
  for (const b of stepBtns()) {
    const stuck = b.w === 'ob' ? (b.d < 0 ? ob === 0 : ob + ib >= NBITS) : (b.d < 0 ? ib === 0 : ob + ib >= NBITS)
    K.panel(b.x, b.y, b.bw, b.bh, stuck ? ['#39332b', '#2a251e', '#1a1712'] : STEEL, 5)
    label(b.d < 0 ? '−' : '+', b.x + b.bw / 2, b.y + 17, 16, stuck ? '#6b6357' : '#fff3dc')
  }
  for (const b of wayBtns()) {
    K.panel(b.x, b.y, b.bw, b.bh, b.w === ways ? GOLD : STEEL, 6)
    label(String(b.w), b.x + b.bw / 2, b.y + 23, 15)
  }
  plain(Lv.wayOpts.length > 1 ? '↑ 每组放得下几块' : '(这一关只做到 1 路)', g.barX + 372, 390, 12, DIM)
  /*  容量条:三者之积不许超过芯片面积。
      ⚠️ x 起点按**最多三档路数**算死,不跟着这一关有几档走 —— 跟着走的话档位少的关卡里
      这块会左移,和左边「每组放得下几块」那行叠上(第一版就叠了)。 */
  {
    const x = g.barX + 372 + 3 * 54 + 12, w = Math.max(150, g.rightX - x - 24)
    plain(`容量 = 块 × 组 × 路 = ${cap()} 字   /   这颗芯片给 ${Lv.cap} 字`, x, 332, 13, overCap() ? RED : CREAM, 'left', 700)
    K.slab(x, 342, w, 22, 5)
    const f = Math.min(1, cap() / Lv.cap)
    ctx.fillStyle = overCap() ? RED : TEAL; K.rr(x + 3, 345, Math.max(2, (w - 6) * f), 16, 4); ctx.fill()
    if (overCap()) plain('装不下 —— 面积是给死的,加哪样都得从另一样身上匀', x, 382, 12, RED)
  }

  // —— 零件拨杆(这台机器的零件不占位置,所以是机身上的开关,不是托盘里的件)——
  for (const b of partBtns()) {
    K.panel(b.x, b.y, b.bw, b.bh, on[b.p] ? PART_SKIN[b.p] : STEEL, 8)
    label(PART_NAME[b.p], b.x + b.bw / 2, b.y + 26, 14)
    label(PART_SUB[b.p], b.x + b.bw / 2, b.y + 45, 11, 'rgba(255,244,220,.75)')
    // 拨杆:开=右、亮
    const sx = b.x + b.bw / 2 - 24, sy = b.y + b.bh - 14
    K.slab(sx, sy - 6, 48, 12, 6)
    ctx.fillStyle = on[b.p] ? '#ffe6a8' : '#5b5245'
    ctx.beginPath(); ctx.arc(sx + (on[b.p] ? 38 : 10), sy, 7, 0, 7); ctx.fill()
  }

  // —— cache 阵列:一格一块,跑完后填 tag ——
  const arrY = 410, arrBot = H - 232
  const nShow = Math.min(S(), 12)
  const rowH = Math.min(30, (arrBot - arrY - 30) / Math.max(1, nShow))
  const colW = Math.min(96, (g.barW - 60) / Math.max(1, ways))
  plain(`cache 阵列 —— ${S()} 组 × ${ways} 路`, g.barX, arrY - 8, 13, CREAM, 'left', 700)
  for (let s = 0; s < nShow; s++) {
    const y = arrY + 6 + s * rowH
    plain(`组 ${s}`, g.barX, y + rowH * .68, 12, DIM)
    for (let w = 0; w < ways; w++) {
      const x = g.barX + 48 + w * (colW + 6)
      const cell = run?.snapshot[s]?.[w]
      const filled = cell && cell.blk >= 0
      K.panel(x, y, colW, rowH - 5, filled ? (cell!.dirty ? ROSE : AQUA) : ['#332e26', '#262119', '#191510'], 4)
      if (filled) label(`tag ${cell!.blk >> ib}${cell!.dirty ? ' •脏' : ''}`, x + colW / 2, y + rowH * .58, 11)
    }
  }
  if (S() > nShow) plain(`… 下面还有 ${S() - nShow} 组`, g.barX + 48, arrY + 6 + nShow * rowH + 14, 12, DIM)
  if (!run) plain('(还没跑 —— 按「运行机器」看这段访存怎么走)', g.barX + 48, arrY + 6 + Math.max(1, nShow) * rowH + 34, 13, DIM)

  /* —— 拿这一关**真的会访问到的**几个地址,照当前这两刀切一遍 ——
     位条讲的是「怎么切」,这里讲的是「切完之后这个地址去哪儿」。数字全部现算,
     跟着刀走 —— 挪一下刀,底下的组号就变,冲突为什么发生一眼看得见。 */
  {
    const px = W - 526, py = arrY, bw = 12
    plain('这几个地址,照现在这两刀走一遍', px, py - 8, 13, CREAM, 'left', 700)
    /*  按**块**去重(不是按地址):同一块里的几个字本来就在一起搬,列出来全是一个样子,没信息。
        去重之后再均匀取 5 个,让开头和结尾的地址都露个面 —— 冲突往往就在离得最远的那两个之间。 */
    const blocks: number[] = [], firstAddr = new Map<number, number>()
    for (const t of Lv.trace) { const b = t.a >> ob; if (!firstAddr.has(b)) { firstAddr.set(b, t.a); blocks.push(b) } }
    const pick = blocks.length <= 5 ? blocks
      : [0, 1, 2, 3, 4].map(i => blocks[Math.round(i * (blocks.length - 1) / 4)]!)
    const seen = [...new Set(pick)].map(b => firstAddr.get(b)!)
    seen.forEach((a, r) => {
      const y = py + 8 + r * 44
      plain(`地址 ${a}`, px, y + 20, 13, AMBER, 'left', 700)
      for (let bit = NBITS - 1; bit >= 0; bit--) {
        const x = px + 76 + (NBITS - 1 - bit) * bw
        const seg = bit < ob ? BRASS : bit < ob + ib ? VIOLET : STEEL
        K.plate(x, y + 6, bw - 2, 20, 2, seg)
        plain(String(a >> bit & 1), x + (bw - 2) / 2, y + 21, 11, '#fff3dc', 'center')
      }
      const blk = a >> ob
      plain(`→ tag ${blk >> ib} · 第 ${blk & (S() - 1)} 组 · 块内第 ${a & (B() - 1)} 个字`, px + 76 + NBITS * bw + 12, y + 21, 12, CREAM)
    })
    /*  ⚠️ 这一句算的是**整段访存里所有不同的块**,不是上面列出来那几行。
        第一版按「地址」分组,于是把同一块里的 0/1/2/3 号字当成四个块,报出根本不存在的冲突 ——
        会互相踢的从来不是地址,是块。 */
    const perSet = new Map<number, number>()
    for (const b of blocks) { const k = b & (S() - 1); perSet.set(k, (perSet.get(k) ?? 0) + 1) }
    let worstSet = -1, worstN = 0
    for (const [k, n] of perSet) if (n > worstN) { worstN = n; worstSet = k }
    if (worstN > ways) {
      ctx.font = '13px ui-sans-serif,system-ui'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffb4a2'
      K.wrapText(`⚠️ 这段访存一共碰 ${blocks.length} 个不同的块,其中 ${worstN} 个都落在第 ${worstSet} 组 —— 那儿只有 ${ways} 个位置,它们会互相踢`,
        px, py + 8 + seen.length * 44 + 16, W - px - 32, 19, 3)
    }
  }

  // —— 时空条:每次访问一格,绿=命中 红=缺失 ——
  const tlY = H - 212
  plain(`这段访存共 ${Lv.trace.length} 次`, g.barX, tlY - 8, 13, CREAM, 'left', 700)
  {
    const n = Lv.trace.length, tw = Math.min(22, (g.barW) / n), th = 26
    for (let i = 0; i < n; i++) {
      const x = g.barX + i * tw
      const t = Lv.trace[i]!
      const hit = run?.hitSeq[i]
      K.rr(x + 1, tlY, Math.max(3, tw - 2), th, 3)
      ctx.fillStyle = hit === undefined ? 'rgba(60,54,44,.75)' : hit ? 'rgba(73,167,145,.9)' : 'rgba(200,69,46,.92)'
      ctx.fill()
      if (tw >= 14) { ctx.font = '10px ui-sans-serif,system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#efe6d2'; ctx.fillText(t.op === 'st' ? '写' : '读', x + tw / 2, tlY + 17) }
    }
    plain('绿 = 命中(1 拍)   红 = 缺失(要去下一级搬一整块)', g.barX, tlY + th + 18, 12, DIM)
  }

  // —— 底部读数 ——
  {
    const y = H - 124, bw = W - 260
    K.slab(g.barX, y, bw, 100, 10)
    const par = Lv.par.cycles
    if (overCap()) {
      label('芯片面积不够 —— 先把容量降到上限以内', g.barX + bw / 2, y + 56, 20, '#ffb4a2')
    } else if (!run) {
      plain('按「运行机器」把这段访存跑一遍。', g.barX + 20, y + 34, 15, CREAM)
      plain(`目标:${par} 拍以内。开局这台(1 个字的 cache)差得远。`, g.barX + 20, y + 62, 14, DIM)
    } else {
      const okTime = run.cycles <= par
      const rate = (100 * run.hits / (run.hits + run.misses)).toFixed(1)
      plain(`命中 ${run.hits}   缺失 ${run.misses}   命中率 ${rate}%   整块写回 ${run.wbacks} 次   预取 ${run.prefetched} 次`,
        g.barX + 20, y + 30, 15, CREAM)
      plain(`总时间 ${run.cycles} 拍`, g.barX + 20, y + 60, 22, okTime ? TEAL : AMBER, 'left', 700)
      plain(`目标 ${par} 拍`, g.barX + 210, y + 60, 15, DIM)
      //  这一行是这台机器的立场:结果永远对,你在调的是时间。它由引擎每次现对撞,不是写死的一句话。
      const same = sameAsFlat(Lv.trace, run)
      plain(same ? '✓ 读到的值与最终内存,和「不要 cache 直接跑」一模一样 —— cache 是透明的,你在调的是时间,不是答案。'
        : '✗ 结果和参考对不上 —— 这是引擎的 bug,不是你的锅,请报一声。',
        g.barX + 20, y + 86, 13, same ? TEAL : RED)
      if (okTime) label(`达标!${Lv.finale ? '整台机器搭完了' : '下一关'}`, g.barX + bw - 130, y + 60, 17, '#ffe6a8')
    }
  }
  const R = runBtn()
  K.panel(R.x, R.y, R.bw, R.bh, overCap() ? STEEL : GREEN, 9)
  label('▶ 运行机器', R.x + R.bw / 2, R.y + R.bh / 2 + 6, 17, '#f2fff0')
  requestAnimationFrame(frame)
}

loadLevel(0)
requestAnimationFrame(frame)

// —— 虾米课堂外壳:返回主页 / 暂停 / 关卡进度(本机 + 账号同步)——
HUB = mountHub({
  title: '搭机器 · Cache 内存层级',
  key: 'cache',
  links: [
    { label: '← 回房子 · 路由器', href: new URL('./', location.href).href },
    { label: '← CPU 流水线', href: new URL('cpu.html', location.href).href },
    //  KV Cache 就是这台 cache 在推理引擎里的下一步 —— 换个造物,同一个动作
    { label: '大模型推理引擎 →', href: new URL('infer.html', location.href).href },
  ],
  read: () => best,
  write: d => { if (d && typeof d === 'object') best = d as Record<number, { cycles: number }> },
  reset: () => { best = {}; loadLevel(0) },
  summary: () => {
    const done = LEVELS.filter((_, i) => passed(i)).length
    const lines = [`通过 ${done} / ${LEVELS.length} 关`]
    LEVELS.forEach((Lv, i) => {
      const b = best[i]
      lines.push(b ? `${i}. ${Lv.name} —— 最好 ${b.cycles} 拍(目标 ${Lv.par.cycles})` : `${i}. ${Lv.name} —— ${unlocked(i) ? '还没通' : '未解锁'}`)
    })
    return lines
  },
})

// dev 钩子(冒烟脚本按这些来)—— 仿真本身在 cache-core.ts 里,这里只是把页面状态露出来
type Win = Record<string, unknown>
;(window as unknown as Win).__cacheLevels = () => LEVELS.map(l => l.name)
;(window as unknown as Win).__cacheTexts = () => LEVELS.flatMap(l => [l.name, l.story, l.hint])
;(window as unknown as Win).__cachePlay = (i: number) => { loadLevel(i); return { n: L().trace.length, cap: L().cap, wayOpts: L().wayOpts, parts: L().parts, par: L().par } }
;(window as unknown as Win).__cacheSet = (c: Partial<Cfg>) => {
  if (c.ob !== undefined) ob = c.ob; if (c.ib !== undefined) ib = c.ib; if (c.ways !== undefined) ways = c.ways
  on = { lru: !!c.lru, wb: !!c.wb, pf: !!c.pf }; run = null
}
;(window as unknown as Win).__cacheRun = () => {
  doRun()
  return run ? { cycles: run.cycles, hits: run.hits, misses: run.misses, wbacks: run.wbacks, prefetched: run.prefetched, transparent: sameAsFlat(L().trace, run), ok: run.cycles <= L().par.cycles, cap: cap(), over: overCap() } : { over: overCap(), cap: cap() }
}
;(window as unknown as Win).__cacheCut = (px: number) => { moveCut(nearestBoundary(px)); return { ob, ib } }
//  ± 按钮的真实位置 —— 冒烟脚本按这些坐标真的去点,而不是绕过 UI 直接改状态
;(window as unknown as Win).__cacheNow = () => ({ ob, ib, ways, ...on })
;(window as unknown as Win).__cacheUI = () => ({ steps: stepBtns(), ways: wayBtns(), parts: partBtns(), runBtn: runBtn(), top: cv.getBoundingClientRect().top })
;(window as unknown as Win).__cacheGeo = () => ({ ...geo(), NBITS, cost: COST })
