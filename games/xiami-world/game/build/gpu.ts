/**
 * 「搭机器」第七台设备 · GPU —— 页面层。
 *
 * 仿真不在这儿:全部在 game/build/gpu-core.ts(纯内核,零 DOM)。这一层只管画和点。
 *
 * 这一屏画三样看得见的东西,每一样对着一个关卡的考点:
 *   · 一个 warp 的 32 条地址 —— 连着就并成一笔,散开就是 32 笔(访存合并)
 *   · 32 个 bank 的柱子     —— 一列上的线程全压在同一根上就是冲突(padding)
 *   · 32 个 warp 的方块     —— 发散的、驻留的、排在后面等下一波的(发散 / 占用率)
 */
import { mountHub, type Hub } from '../hub'
import { makeKit, BRASS, STEEL, GOLD, GREEN, INK } from './kit'
import {
  LEVELS, runGpu, sameAsRef, transactionsFor, demoGlobalAddrs, demoSharedBanks, warpDivergence,
  N, WARP, BANKS, COST, type Cfg, type Part, type GpuRun,
} from './gpu-core'
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
const PART_NAME: Record<Part, string> = { sync: '同步栅栏' }
const PART_SUB: Record<Part, string> = { sync: '__syncthreads' }

// —— 状态 ——
let lvl = 0
const L = () => LEVELS[lvl]!
let tile = 0, pad = 0, regs = 128
let bLayout: Cfg['bLayout'] = 'row'
let mapping: Cfg['mapping'] = 'row'
let on: Record<Part, boolean> = { sync: false }
let run: GpuRun | null = null
let calcOk = true
const cfg = (): Cfg => ({ tile, pad, bLayout, regs, mapping, ...on })

//  进度归课堂外壳管(它开场就会把存档 write 回来),这里不自己读 localStorage
let best: Record<number, { time: number }> = {}
const passed = (i: number) => best[i] !== undefined
const unlocked = (i: number) => i === 0 || passed(i - 1)

function loadLevel(i: number) {
  lvl = Math.max(0, Math.min(LEVELS.length - 1, i))
  tile = L().tileOpts[0]!; pad = L().padOpts[0]!; bLayout = L().layoutOpts[0]!
  regs = L().regOpts[0]!; mapping = L().mapOpts[0]!
  on = { sync: false }; run = null; calcOk = true
}
const meets = (r: GpuRun) => calcOk && r.time <= L().par.time
function doRun() {
  run = runGpu(cfg())
  calcOk = sameAsRef(run)
  if (meets(run)) {
    best[lvl] = { time: Math.min(best[lvl]?.time ?? Infinity, run.time) }
    HUB?.save()   // 存盘交给课堂外壳:它同时管本机与账号同步
  }
}

/* 版面竖着码,别再让哪一块压到另一块上:
   关卡条 20~52 / 页眉 74~192 / 旋钮五行 205~375(左栏)/ 右侧拨杆 205~273、读数 288~392 /
   32 条地址 410~470 / 32 个 bank 500~580 / 32 个 warp 610~(H-150) / 底部 (H-124)~ */
function geo() { return { x0: 44, rightX: W - 372, rightW: 328 } }
function levelBtns() { const bw = Math.min(210, (W - 48) / LEVELS.length - 8); return LEVELS.map((_, i) => ({ i, x: 24 + i * (bw + 8), y: 20, bw, bh: 32 })) }
function partBtns() {
  const g = geo()
  return L().parts.map((p, i) => ({ p, x: g.rightX + i * 178, y: 205, bw: 168, bh: 68 }))
}
type KnobKey = 'tile' | 'pad' | 'bLayout' | 'regs' | 'mapping'
function knobRows() {
  const g = geo(), Lv = L()
  const cand: [KnobKey, string, (string | number)[], string | number][] = [
    ['tile', '分块边长', Lv.tileOpts, tile],
    ['pad', '共享内存每行多留', Lv.padOpts, pad],
    ['bLayout', 'B 在显存里怎么摆', Lv.layoutOpts, bLayout],
    ['regs', '每线程寄存器数', Lv.regOpts, regs],
    ['mapping', '线程怎么分到格子上', Lv.mapOpts, mapping],
  ]
  const out: { key: KnobKey; label: string; opts: (string | number)[]; val: string | number; y: number }[] = []
  let r = 0
  for (const [key, label, opts, val] of cand) {
    if (opts.length <= 1) continue
    if ((key === 'pad') && !tile) continue          // 不分块就没有共享内存,padding 无从谈起
    out.push({ key, label, opts, val, y: 205 + r++ * 34 })
  }
  void g
  return out
}
const knobText = (k: KnobKey, v: string | number) =>
  k === 'tile' ? (v === 0 ? '不分块' : `${v}×${v}`)
    : k === 'pad' ? (v === 0 ? '不留' : `${v} 个字`)
      : k === 'bLayout' ? (v === 'row' ? '按行摆' : '按列摆')
        : k === 'mapping' ? (v === 'row' ? '按行铺' : '按分支分组') : String(v)
function knobBtns() {
  const g = geo()
  return knobRows().flatMap(r => r.opts.map((v, i) => {
    const bw = r.key === 'bLayout' || r.key === 'mapping' ? 108 : r.key === 'tile' || r.key === 'pad' ? 74 : 58
    return { r, v, x: g.x0 + 176 + i * (bw + 8), y: r.y, bw, bh: 28 }
  }))
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
  for (const b of partBtns()) if (inBox(x, y, b)) { on = { ...on, [b.p]: !on[b.p] }; run = null; calcOk = true; return }
  for (const b of knobBtns()) if (inBox(x, y, b)) {
    if (b.r.key === 'tile') { tile = b.v as number; if (!tile) on = { sync: false } }
    else if (b.r.key === 'pad') pad = b.v as number
    else if (b.r.key === 'bLayout') bLayout = b.v as Cfg['bLayout']
    else if (b.r.key === 'regs') regs = b.v as number
    else mapping = b.v as Cfg['mapping']
    run = null; calcOk = true; return
  }
})
addEventListener('keydown', e => {
  if (HUB?.isPaused()) return
  if (e.key === ' ') { e.preventDefault(); doRun() }
  if (e.key === 'ArrowRight' && unlocked(lvl + 1)) loadLevel(lvl + 1)
  if (e.key === 'ArrowLeft') loadLevel(lvl - 1)
})

// —— 画 —— 物件即美术,和前六台同源(共用 game/build/kit.ts)
const K = makeKit(ctx)
/** 面板上的字:亮填充 + 深描边。深色字压在冷钢/黄铜上会糊成一团 —— 前面栽过。 */
function label(t: string, x: number, y: number, size: number, fill = '#fff3dc', align: CanvasTextAlign = 'center') {
  ctx.font = `700 ${size}px ui-sans-serif,system-ui`; ctx.textAlign = align
  ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = 'rgba(18,12,6,.72)'; ctx.lineJoin = 'round'
  ctx.strokeText(t, x, y); ctx.fillStyle = fill; ctx.fillText(t, x, y)
}
const plain = (t: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = 'left', weight = 400) => {
  ctx.font = `${weight} ${size}px ui-sans-serif,system-ui`; ctx.textAlign = align; ctx.fillStyle = col; ctx.fillText(t, x, y)
}
/** 32 个 lane 一排小格,用来画地址 / bank / warp —— 这一屏三处都是这个形状。 */
const SEG_COL = ['#49a791', '#e8c98a', '#bda0dd', '#9fd8e8', '#e6a898', '#aad79b', '#9fb0cc', '#c8452e']

function frame() {
  ctx.clearRect(0, 0, W, H)
  K.coverImg(CORR, 0, 0, W, H, .78)   // 同一条走廊,压暗 —— 你还在这台机器肚子里
  const g = geo(), Lv = L()

  // 关卡条
  for (const b of levelBtns()) {
    const state = b.i === lvl ? GOLD : passed(b.i) ? GREEN : unlocked(b.i) ? STEEL : ['#2b2822', '#211e19', '#141210']
    K.panel(b.x, b.y, b.bw, b.bh, state, 6)
    const txt = `${b.i}. ${LEVELS[b.i]!.short}`
    //  选中那块是亮金色,亮字压上去糊成一片 —— 这一块反过来用深字
    if (b.i === lvl) plain(txt, b.x + b.bw / 2, b.y + 21, 13, '#2c1d05', 'center', 700)
    else label(txt, b.x + b.bw / 2, b.y + 21, 13, unlocked(b.i) ? '#fff3dc' : '#6b6357')
  }

  // 页眉
  plain(Lv.name, 44, 92, 22, CREAM, 'left', 700)
  plain(Lv.story, 44, 116, 14, AMBER)
  ctx.font = '13px ui-sans-serif,system-ui'; ctx.fillStyle = DIM; ctx.textAlign = 'left'
  K.wrapText(Lv.hint, 44, 140, W - 88, 19, 4)

  // —— 旋钮 ——
  for (const r of knobRows()) plain(r.label, g.x0, r.y + 19, 13, CREAM)
  for (const b of knobBtns()) {
    const cur = b.r.val === b.v
    K.panel(b.x, b.y, b.bw, b.bh, cur ? GOLD : STEEL, 5)
    const t = knobText(b.r.key, b.v)
    if (cur) plain(t, b.x + b.bw / 2, b.y + 19, 13, '#2c1d05', 'center', 700)
    else label(t, b.x + b.bw / 2, b.y + 19, 13)
  }
  if (!knobRows().length) plain('(这一关没有旋钮可调 —— 只看那个栅栏打不打)', g.x0, 224, 13, DIM)

  // —— 拨杆 ——
  for (const b of partBtns()) {
    K.panel(b.x, b.y, b.bw, b.bh, on[b.p] ? GREEN : STEEL, 8)
    label(PART_NAME[b.p], b.x + b.bw / 2, b.y + 26, 15)
    label(PART_SUB[b.p], b.x + b.bw / 2, b.y + 45, 11, 'rgba(255,244,220,.75)')
    const sx = b.x + b.bw / 2 - 24, sy = b.y + b.bh - 13
    K.slab(sx, sy - 6, 48, 12, 6)
    ctx.fillStyle = on[b.p] ? '#ffe6a8' : '#5b5245'
    ctx.beginPath(); ctx.arc(sx + (on[b.p] ? 38 : 10), sy, 7, 0, 7); ctx.fill()
  }
  if (!tile && L().parts.includes('sync')) plain('(不分块就没有共享内存,栅栏也就无从谈起)', g.rightX, 292, 12, DIM)

  // —— 右侧读数 ——
  {
    const x = g.rightX, w = g.rightW
    K.panel(x, 300, w, 96, INK, 8)
    if (!run) plain('(还没跑 —— 按「运行机器」)', x + 20, 334, 13, DIM)
    else {
      plain(`显存事务 ${run.trans} 笔 · 最狠撞 ${run.worstConflict} 路`, x + 20, 326, 13, CREAM)
      plain(`驻留 ${run.resident} 个 warp(共 ${(N * N) / WARP} 个,跑 ${run.waves} 波)· 发散 ${run.divergent} 个`, x + 20, 350, 12, CREAM)
      plain(`干等显存 ${run.stalled} 拍(占 ${Math.round(100 * run.stalled / Math.max(1, run.time))}%)`, x + 20, 374, 12, run.stalled > run.time / 2 ? '#ffb4a2' : DIM)
    }
  }

  // —— ① 一个 warp 的 32 条地址 ——
  {
    const y = 410
    const addrs = demoGlobalAddrs(cfg()), tr = transactionsFor(addrs)
    plain(`一个 warp 取 B 的那一下,32 个 lane 各要一个地址`, g.x0, y - 8, 13, CREAM, 'left', 700)
    const bw = Math.min(26, (W - g.x0 - 300) / WARP)
    for (let l = 0; l < WARP; l++) {
      const seg = addrs[l]! >> 5
      const x = g.x0 + l * (bw + 2)
      K.panel(x, y, bw, 26, [SEG_COL[seg % SEG_COL.length]!, '#3a332a', '#241f18'], 3)
    }
    plain(tr === 1 ? `→ 32 条地址落在同一个 32 字的段里,合并成 1 笔事务`
      : `→ 落在 ${tr} 个不同的段里,得发 ${tr} 笔事务`,
      g.x0 + WARP * (bw + 2) + 16, y + 18, 13, tr === 1 ? TEAL : '#ffb4a2')
    plain('(同一个颜色 = 同一段 = 能并成一笔)', g.x0, y + 44, 11, DIM)
  }

  // —— ② 32 个 bank ——
  {
    const y = 500, h = 60
    const banks = demoSharedBanks(cfg())
    const cnt = new Array<number>(BANKS).fill(0)
    for (const b of banks) cnt[b] = (cnt[b] ?? 0) + 1
    const worst = Math.max(...cnt)
    plain('按列读共享内存的那一下,32 条地址落在哪些 bank 上', g.x0, y - 8, 13, CREAM, 'left', 700)
    const bw = Math.min(26, (W - g.x0 - 300) / BANKS)
    for (let b = 0; b < BANKS; b++) {
      const x = g.x0 + b * (bw + 2), n = cnt[b] ?? 0
      K.slab(x, y, bw, h, 3)
      if (n) {
        ctx.fillStyle = n > 1 ? 'rgba(200,69,46,.92)' : 'rgba(73,167,145,.92)'
        //  按「最狠那根」归一化,而不是按 32 —— 不然均匀摊开时每根都只剩 4 像素,看着像没画
        const bh = Math.max(6, h * Math.min(1, n / Math.max(4, worst)))
        K.rr(x + 2, y + h - bh, bw - 4, bh - 2, 2); ctx.fill()
      }
    }
    plain(worst === 1 ? '→ 32 条地址分在 32 个不同的 bank 上,一次就取完'
      : `→ ${worst} 条压在同一个 bank 上,这一次访问被拆成 ${worst} 次`,
      g.x0 + BANKS * (bw + 2) + 16, y + h / 2 + 5, 13, worst === 1 ? TEAL : '#ffb4a2')
  }

  // —— ③ 32 个 warp:发散的、驻留的 ——
  {
    const y = 610
    const div = warpDivergence(cfg())
    const res = run?.resident ?? 0
    plain('这个 kernel 的 32 个 warp', g.x0, y - 8, 13, CREAM, 'left', 700)
    const bw = Math.min(26, (W - g.x0 - 300) / div.length)
    for (let w = 0; w < div.length; w++) {
      const x = g.x0 + w * (bw + 2), d = div[w]!
      const diverge = d.any && !d.all
      K.panel(x, y, bw, 26, diverge ? ['#e08c78', '#b8564a', '#5a1f18'] : d.all ? BRASS : STEEL, 3)
      if (res && w < res) { ctx.strokeStyle = '#ffe6a8'; ctx.lineWidth = 2; K.rr(x - 1, y - 1, bw + 2, 28, 4); ctx.stroke() }
    }
    plain(`红 = 里面的线程走了两条路(发散)   黄铜 = 整个 warp 都要做   钢 = 整个 warp 都跳过`
      + (res ? `   金框 = 第一波驻留的 ${res} 个` : ''),
      g.x0, y + 44, 11, DIM)
  }

  // —— 底部读数 ——
  {
    const y = H - 124, bw = W - 260
    K.slab(g.x0, y, bw, 100, 10)
    if (!run) {
      plain('按「运行机器」把这个 kernel 跑一遍。', g.x0 + 20, y + 34, 15, CREAM)
      plain(`目标:${Lv.par.time} 拍以内,而且算出来的 C 要和 CPU 三重循环一格不差。`, g.x0 + 20, y + 62, 14, DIM)
    } else {
      plain(`总时间 ${run.time} 拍`, g.x0 + 20, y + 42, 21, run.time <= Lv.par.time ? TEAL : AMBER, 'left', 700)
      plain(`目标 ${Lv.par.time}`, g.x0 + 230, y + 42, 13, DIM)
      plain(calcOk ? '✓ 算出来的 C 和 CPU 三重循环一格不差'
        : '✗ 算错了 —— 有线程去读别人还没搬完的那块共享内存,读到的是上一轮的残渣',
        g.x0 + 20, y + 76, 14, calcOk ? TEAL : RED)
      if (meets(run)) label(`达标!${Lv.finale ? '这个 kernel 调到头了' : '下一关'}`, g.x0 + bw - 130, y + 42, 17, '#ffe6a8')
    }
  }
  const R = runBtn()
  K.panel(R.x, R.y, R.bw, R.bh, GREEN, 9)
  label('▶ 运行机器', R.x + R.bw / 2, R.y + R.bh / 2 + 6, 17, '#f2fff0')
  requestAnimationFrame(frame)
}

loadLevel(0)
requestAnimationFrame(frame)

// —— 虾米课堂外壳:返回主页 / 暂停 / 关卡进度(本机 + 账号同步)——
HUB = mountHub({
  title: '搭机器 · GPU',
  key: 'gpu',
  links: [
    { label: '← 回房子 · 路由器', href: new URL('./', location.href).href },
    { label: '← 大模型推理引擎', href: new URL('infer.html', location.href).href },
  ],
  read: () => best,
  write: d => { if (d && typeof d === 'object') best = d as Record<number, { time: number }> },
  reset: () => { best = {}; loadLevel(0) },
  summary: () => {
    const done = LEVELS.filter((_, i) => passed(i)).length
    const lines = [`通过 ${done} / ${LEVELS.length} 关`]
    LEVELS.forEach((Lv, i) => {
      const b = best[i]
      lines.push(b ? `${i}. ${Lv.short} —— 最好 ${b.time} 拍(目标 ${Lv.par.time})` : `${i}. ${Lv.short} —— ${unlocked(i) ? '还没通' : '未解锁'}`)
    })
    return lines
  },
})

// dev 钩子(冒烟脚本按这些来)—— 仿真本身在 gpu-core.ts 里,这里只把页面状态露出来
type Win = Record<string, unknown>
;(window as unknown as Win).__gpuLevels = () => LEVELS.map(l => l.name)
;(window as unknown as Win).__gpuTexts = () => LEVELS.flatMap(l => [l.name, l.short, l.story, l.hint])
;(window as unknown as Win).__gpuPlay = (i: number) => { loadLevel(i); return { tileOpts: L().tileOpts, padOpts: L().padOpts, layoutOpts: L().layoutOpts, regOpts: L().regOpts, mapOpts: L().mapOpts, parts: L().parts, par: L().par } }
;(window as unknown as Win).__gpuSet = (c: Partial<Cfg>) => {
  if (c.tile !== undefined) tile = c.tile
  if (c.pad !== undefined) pad = c.pad
  if (c.bLayout !== undefined) bLayout = c.bLayout
  if (c.regs !== undefined) regs = c.regs
  if (c.mapping !== undefined) mapping = c.mapping
  on = { sync: !!c.sync }; run = null; calcOk = true
}
;(window as unknown as Win).__gpuNow = () => ({ tile, pad, bLayout, regs, mapping, ...on })
;(window as unknown as Win).__gpuRun = () => {
  doRun()
  return run ? { time: run.time, trans: run.trans, worstConflict: run.worstConflict, resident: run.resident, waves: run.waves, divergent: run.divergent, stalled: run.stalled, calcOk, ok: meets(run) } : null
}
;(window as unknown as Win).__gpuUI = () => ({ parts: partBtns(), knobs: knobBtns().map(b => ({ key: b.r.key, v: b.v, x: b.x, y: b.y, bw: b.bw, bh: b.bh })), runBtn: runBtn(), top: cv.getBoundingClientRect().top, cost: COST })
