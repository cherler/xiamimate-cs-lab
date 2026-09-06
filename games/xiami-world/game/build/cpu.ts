/**
 * 「搭机器」第二台设备 · CPU 五级流水线(灰盒,先验机制、不做美术)。
 *
 * **关卡也是从真机器里「读」出来的,不是编的** —— 跟着一条指令在真 CPU 里走一遍,
 * 沿途会撞上哪些事,每件事就是一关:
 *   分成五级(为什么要分) → 数据冒险隔一条 → 隔两条 → load-use(旁路救不了的那一个) → 串起来跑
 * 难度递增也来自真机器本身:前递通路真的有两条(EX/MEM→EX、MEM/WB→EX),
 * 而 lw 的数据真的要到访存末尾才出来 —— 所以它后面那条真的**必须停一拍**,这不是我加的坡度。
 *
 * 焊死引擎的口径:**参考答案 = 同一段程序顺序执行一遍**(runSeq),不是我写在关卡里的常数。
 * 你搭的机器跑出来的寄存器终值必须和它一模一样 —— 判据由两个真解释器对撞产生。
 */
import { mountHub, type Hub } from '../hub'
let HUB: Hub | null = null
const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
//  画布上面还有一条「虾米课堂」外壳条,所以量画布自己的尺寸 —— 读 innerHeight 会多算 36px
function resize() { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()

const CREAM = '#efe6d2', AMBER = '#e8c98a', TEAL = '#49a791', RED = '#c8452e', DIM = '#9a8a6a'

// —— 指令集(极小,但每一条都是真 MIPS 里有的:取常数 / 加法 / 取数)——
type Instr =
  | { op: 'li'; d: number; imm: number }
  | { op: 'add'; d: number; a: number; b: number }
  | { op: 'lw'; d: number; addr: number }
const NREG = 4
const instrText = (i: Instr) => i.op === 'li' ? `li   r${i.d}, #${i.imm}` : i.op === 'lw' ? `lw   r${i.d}, [${i.addr}]` : `add  r${i.d}, r${i.a}, r${i.b}`
const srcOf = (i: Instr): number[] => i.op === 'add' ? [i.a, i.b] : []
const dstOf = (i: Instr) => i.d

/** 参考答案:同一段程序**顺序执行**一遍。流水线跑出来的终值必须和它一致。 */
function runSeq(prog: Instr[], mem: number[]) {
  const r = new Array<number>(NREG).fill(0)
  for (const ins of prog) r[ins.d] = ins.op === 'li' ? ins.imm : ins.op === 'lw' ? (mem[ins.addr] ?? 0) : r[ins.a]! + r[ins.b]!
  return r
}

// —— 机器:5 个槽,每槽放一个阶段零件;槽的正上方可以放旁路线 / 冒险检测 ——
type Stage = 'if' | 'id' | 'ex' | 'mem' | 'wb'
type Top = 'wire' | 'hazard'
type Tool = Stage | Top | 'erase'
const NSLOT = 5
const STAGE_NAME: Record<Stage, string> = { if: '取指', id: '译码', ex: '执行', mem: '访存', wb: '写回' }
const toolName = (t: Tool) => t === 'wire' ? '旁路线' : t === 'hazard' ? '冒险检测' : t === 'erase' ? '擦除' : STAGE_NAME[t]
let slots: (Stage | null)[] = new Array(NSLOT).fill(null)
let tops: (Top | null)[] = new Array(NSLOT).fill(null)

// —— 关卡(每一关都能在真 CPU 上指得到)——
type Level = { name: string; story: string; hint: string; prog: Instr[]; mem: number[]; parts: Tool[]; par: { parts: number; cycles: number }; finale?: boolean }
const FIVE: Tool[] = ['if', 'id', 'ex', 'mem', 'wb']
const LEVELS: Level[] = [
  {
    name: '真·CPU · 分成五级',
    story: '一条指令要做五件事:取指令、读寄存器、算、访存、写回。分成五级摆开,它们就能重叠着跑。',
    hint: '把五个阶段按真 CPU 的顺序摆进五个槽。顺序不是我规定的,是仿真自己认的:〈译码〉得在〈执行〉前面(不然还没读到操作数就开算)、〈写回〉得在〈执行〉后面(不然写回去的是还没算出来的东西)。这一关没有访存指令,所以〈访存〉摆哪儿都不影响结果 —— 等第 4 关来了 lw,你就知道它为什么非得在〈执行〉后面。',
    prog: [{ op: 'li', d: 1, imm: 3 }, { op: 'li', d: 2, imm: 4 }, { op: 'li', d: 3, imm: 5 }, { op: 'add', d: 0, a: 1, b: 1 }],
    mem: [], parts: FIVE, par: { parts: 5, cycles: 8 },
  },
  {
    name: '真·CPU · 数据冒险(隔一条)',
    story: '后一条要用前一条刚算出的结果 —— 可它还在流水线里没写回,译码级读到的是旧值。',
    hint: '〈译码〉此刻读到什么就是什么。前一条的结果这会儿还卡在流水线中间,寄存器堆里还是旧的。接一条〈旁路线〉,把它从中间直接抽出来送回〈执行〉—— 「接在哪一级上方,就是从哪一级的流水寄存器上抽」,只有一个位置抽得到。',
    prog: [{ op: 'li', d: 1, imm: 3 }, { op: 'add', d: 2, a: 1, b: 1 }, { op: 'li', d: 3, imm: 9 }],
    mem: [], parts: [...FIVE, 'wire'], par: { parts: 6, cycles: 7 },
  },
  {
    name: '真·CPU · 数据冒险(隔两条)',
    story: '隔两条的依赖,得从更后面那一级抽 —— 真 CPU 的前递通路本来就有两条。',
    hint: '这一段里既有隔一条的依赖、也有隔两条的。真 CPU 的前递单元有「两条通路」(EX/MEM→EX 和 MEM/WB→EX),对应两个抽取位置。少接哪一条,就有一个寄存器读到旧值 —— 看寄存器面板哪个变红,就知道该补哪一条。',
    prog: [{ op: 'li', d: 1, imm: 3 }, { op: 'li', d: 2, imm: 4 }, { op: 'add', d: 3, a: 1, b: 2 }, { op: 'add', d: 1, a: 3, b: 2 }],
    mem: [], parts: [...FIVE, 'wire'], par: { parts: 7, cycles: 8 },
  },
  {
    name: '真·CPU · load-use(旁路救不了的那一个)',
    story: 'lw 的数据要到访存级末尾才从存储器里出来 —— 而紧跟其后那条在执行级开头就要用它。',
    hint: '这是真 CPU 里「唯一躲不掉的停顿」:前面几关的加法在〈执行〉级就算出结果了,旁路抽得到;可 lw 的数据是在〈访存〉级末尾才到的,同一拍里在〈执行〉级的那条指令根本等不到它。放一个〈冒险检测〉在〈译码〉级上方 —— 值还没到就停一拍,停完再靠旁路接上。',
    prog: [{ op: 'lw', d: 1, addr: 2 }, { op: 'add', d: 2, a: 1, b: 1 }, { op: 'li', d: 3, imm: 1 }],
    mem: [7, 8, 5, 9], parts: [...FIVE, 'wire', 'hazard'], par: { parts: 8, cycles: 8 },
  },
  {
    name: '终关 · 一段真程序跑到底',
    story: '两条取数、三条加法,隔一条的、隔两条的、load-use 的冒险全在里面 —— 用最少的拍数跑对。',
    hint: '把学过的全用上:两条〈旁路线〉抽两条通路,一个〈冒险检测〉兜住 lw 后面那一拍。停顿越少越好,但结果错了再快也没用 —— 寄存器终值必须和「顺序执行一遍」的参考答案一模一样。',
    prog: [{ op: 'lw', d: 1, addr: 0 }, { op: 'lw', d: 2, addr: 1 }, { op: 'add', d: 3, a: 1, b: 2 }, { op: 'add', d: 1, a: 3, b: 2 }, { op: 'add', d: 2, a: 1, b: 3 }],
    mem: [5, 9, 2, 4], parts: [...FIVE, 'wire', 'hazard'], par: { parts: 8, cycles: 10 }, finale: true,
  },
]
let lvl = 0
const L = () => LEVELS[lvl]!
const REF = () => runSeq(L().prog, L().mem)

type Cyc = { slots: (number | null)[]; stalled: boolean }
type Run = { regs: number[]; cycles: number; trace: Cyc[]; overrun: boolean }

/**
 * 流水线仿真。规矩全部写在这里,画面只是把它画出来:
 * - 指令每拍前进一个槽;槽里放的是哪个零件,就在那一拍做那件事(所以顺序摆错=真的会算错)。
 * - **一拍之内的次序:写回 → 译码读 → 执行算 → 访存取数。**
 *   写回排在最前,所以「隔 3 条」的依赖天生没事(真 MIPS 靠寄存器堆前半拍写、后半拍读)。
 *   访存排在执行**后面**,所以 lw 的数据同一拍里给不了执行级 —— **load-use 冒险就是从这一条长出来的**。
 * - 旁路线放在第 k 槽上方 = 把此刻站在第 k 槽那条指令**已经出炉**的结果送到执行级。
 *   加法在〈执行〉级出炉、lw 在〈访存〉级出炉,所以同一条线对两者的效果不一样。
 * - 冒险检测放在译码级上方 = 下一拍还拿不到值就停一拍,给执行级塞一个气泡。
 */
function runPipe(prog: Instr[], mem: number[]): Run {
  const exSlot = slots.indexOf('ex'), idSlot = slots.indexOf('id'), wbSlot = slots.indexOf('wb'), memSlot = slots.indexOf('mem')
  const bornAt = (j: number) => prog[j]!.op === 'lw' ? memSlot : exSlot   // 这条指令的结果在哪一级出炉
  const regs = new Array<number>(NREG).fill(0)
  const pipe: (number | null)[] = new Array(NSLOT).fill(null)
  const readVal: number[][] = prog.map(() => [0, 0])   // 译码那一拍读到的两个操作数
  const val: number[] = prog.map(() => 0)              // 这条指令的结果(加法在执行级填、lw 在访存级填)
  const trace: Cyc[] = []
  let next = 0, cycles = 0, overrun = false
  pipe[0] = next < prog.length ? next++ : null   // 第 1 拍取指级里就该站着第 0 条,不然白空转一拍

  while (cycles < 60) {
    cycles++
    // ① 写回(前半拍)
    if (wbSlot >= 0 && pipe[wbSlot] !== null) { const i = pipe[wbSlot]!; regs[dstOf(prog[i]!)] = val[i]! }
    // ② 译码:此刻寄存器堆里是什么就读什么 —— 读到旧值正是「冒险」本身
    if (idSlot >= 0 && pipe[idSlot] !== null) {
      const i = pipe[idSlot]!, s = srcOf(prog[i]!)
      readVal[i] = [s[0] === undefined ? 0 : regs[s[0]]!, s[1] === undefined ? 0 : regs[s[1]]!]
    }
    // ③ 执行:旁路线送来的新值在这里顶掉刚才读到的旧值
    if (exSlot >= 0 && pipe[exSlot] !== null) {
      const i = pipe[exSlot]!, ins = prog[i]!
      if (ins.op === 'li') val[i] = ins.imm
      else if (ins.op === 'add') {
        const v = [readVal[i]![0]!, readVal[i]![1]!], s = [ins.a, ins.b]
        for (let k = 0; k < 2; k++) {
          for (let sl = NSLOT - 1; sl > exSlot; sl--) {           // 从最靠后的槽找起 = 取最新的那份
            if (tops[sl] !== 'wire') continue
            const j = pipe[sl]; if (j === null || j === undefined) continue
            if (sl <= bornAt(j)) continue                          // 它的结果还没出炉,这根线抽的是空的
            if (dstOf(prog[j]!) === s[k]) { v[k] = val[j]!; break }
          }
        }
        val[i] = v[0]! + v[1]!
      }
    }
    // ④ 访存:lw 的数据到这一级末尾才出来(排在执行后面 = 同拍的执行级拿不到它)
    if (memSlot >= 0 && pipe[memSlot] !== null) { const i = pipe[memSlot]!, ins = prog[i]!; if (ins.op === 'lw') val[i] = mem[ins.addr] ?? 0 }
    trace.push({ slots: [...pipe], stalled: false })
    // ⑤ 冒险检测:译码级那条指令的源值,下一拍到得了执行级吗?到不了就停一拍
    let stall = false
    if (idSlot >= 0 && tops[idSlot] === 'hazard' && pipe[idSlot] !== null) {
      const i = pipe[idSlot]!
      for (const s of srcOf(prog[i]!)) {
        for (let sl = idSlot + 1; sl < NSLOT; sl++) {
          const j = pipe[sl]; if (j === null || j === undefined || j >= i) continue
          if (dstOf(prog[j]!) !== s) continue
          if (wbSlot >= 0 && sl >= wbSlot) break                   // 它这一拍(或更早)已经写回,读得到
          const ns = sl + 1                                        // 下一拍它挪到哪
          if (ns < NSLOT && tops[ns] === 'wire' && ns > exSlot && ns > bornAt(j)) break // 那时旁路抽得到
          stall = true; break
        }
        if (stall) break
      }
    }
    if (stall) trace[trace.length - 1]!.stalled = true
    // ⑥ 推进一格(停顿时:译码级及之前冻住,往执行级塞一个气泡)
    for (let s = NSLOT - 1; s > 0; s--) {
      if (stall && s <= idSlot) continue
      pipe[s] = (stall && s === idSlot + 1) ? null : pipe[s - 1]!
    }
    if (!stall) { pipe[0] = next < prog.length ? next++ : null }
    if (next >= prog.length && pipe.every(x => x === null)) break
    if (cycles >= 60) overrun = true
  }
  return { regs, cycles, trace, overrun }
}

let run: Run | null = null
const machineOk = () => (['if', 'id', 'ex', 'mem', 'wb'] as Stage[]).every(s => slots.includes(s))
const resultOk = () => { const r = REF(); return !!run && !run.overrun && run.regs.every((v, i) => v === r[i]) }
const partCount = () => slots.filter(Boolean).length + tops.filter(Boolean).length
let best: Record<number, { parts: number; cycles: number }> = {}
try { best = JSON.parse(localStorage.getItem('cpugame.best') || '{}') } catch { }
const passed = (i: number) => best[i] !== undefined
const unlocked = (i: number) => i === 0 || passed(i - 1)

// —— 交互 ——
const levelTools = (): Tool[] => [...L().parts, 'erase']
let tool: Tool = 'if'
function loadLevel(i: number) { lvl = Math.max(0, Math.min(LEVELS.length - 1, i)); slots = new Array(NSLOT).fill(null); tops = new Array(NSLOT).fill(null); run = null; tool = L().parts[0]! }

/* 版面竖着码,别再让哪一块压到另一块上:
   关卡条 20~52 / 页眉 74~150 / 机器 176~358(上排旁路 176、下排五级 274)/ 时空图 400 起。
   左栏(程序+存储器+参考)和右栏(寄存器)只占 172~380,和时空图错开。 */
function geo() {
  const cw = Math.min(150, (W - 560) / NSLOT), ch = 84
  return { cw, ch, x0: 300, y0: 274, topY: 176 }
}
function levelBtns() { const bw = Math.min(210, (W - 48) / LEVELS.length - 8); return LEVELS.map((_, i) => ({ i, x: 24 + i * (bw + 8), y: 20, bw, bh: 32 })) }
function hit(px: number, py: number) {
  const g = geo()
  for (let s = 0; s < NSLOT; s++) {
    const x = g.x0 + s * (g.cw + 10)
    if (px >= x && px <= x + g.cw) {
      if (py >= g.y0 && py <= g.y0 + g.ch) return { slot: s, row: 'stage' as const }
      if (py >= g.topY && py <= g.topY + g.ch) return { slot: s, row: 'top' as const }
    }
  }
  return null
}
function trayGeo() { const ts = 78, gap = 10, y = H - ts - 18, x0 = 24; return { ts, gap, y, x0 } }
function runBtn() { const bw = 168, bh = 52; return { x: W - bw - 24, y: H - bh - 18, bw, bh } }

/** 画布上面是「虾米课堂」外壳条,命中判断一律用画布内坐标。 */
const at = (e: { clientX: number; clientY: number }) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
cv.addEventListener('pointerdown', ev => {
  if (HUB?.isPaused()) return
  const q = at(ev), e = { clientX: q.x, clientY: q.y }
  for (const b of levelBtns()) if (unlocked(b.i) && e.clientX >= b.x && e.clientX <= b.x + b.bw && e.clientY >= b.y && e.clientY <= b.y + b.bh) { loadLevel(b.i); return }
  const R = runBtn()
  if (e.clientX >= R.x && e.clientX <= R.x + R.bw && e.clientY >= R.y && e.clientY <= R.y + R.bh) { doRun(); return }
  const T = trayGeo(), items = levelTools()
  if (e.clientY >= T.y && e.clientY <= T.y + T.ts) {
    for (let i = 0; i < items.length; i++) { const x = T.x0 + i * (T.ts + T.gap); if (e.clientX >= x && e.clientX <= x + T.ts) { tool = items[i]!; return } }
  }
  const c = hit(e.clientX, e.clientY); if (!c) return
  if (c.row === 'stage') slots[c.slot] = tool === 'erase' ? null : (tool === 'wire' || tool === 'hazard' ? slots[c.slot]! : tool)
  else tops[c.slot] = tool === 'erase' ? null : (tool === 'wire' || tool === 'hazard' ? tool : tops[c.slot]!)
  run = null
})
addEventListener('keydown', e => {
  if (HUB?.isPaused()) return
  if (e.key === ' ') { e.preventDefault(); doRun() }
  if (e.key === 'ArrowRight' && unlocked(lvl + 1)) loadLevel(lvl + 1)
  if (e.key === 'ArrowLeft') loadLevel(lvl - 1)
})
function doRun() {
  run = machineOk() ? runPipe(L().prog, L().mem) : null
  if (run && resultOk()) {
    const b = best[lvl] || { parts: Infinity, cycles: Infinity }
    best[lvl] = { parts: Math.min(b.parts, partCount()), cycles: Math.min(b.cycles, run.cycles) }
    HUB?.save()   // 存盘交给课堂外壳:它同时管本机与账号同步
  }
}

// —— 画(灰盒:方块 + 字,先不上美术)——
function box(x: number, y: number, w: number, h: number, fill: string, stroke: string, lw = 2) {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h)
}
function text(s: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = 'left', bold = false) {
  ctx.fillStyle = col; ctx.font = `${bold ? 'bold ' : ''}${size}px system-ui`; ctx.textAlign = align; ctx.fillText(s, x, y); ctx.textAlign = 'left'
}
/** 长提示按可用宽度折行 —— 直接 fillText 会顶出右边界被切掉。 */
function wrap(s: string, x: number, y: number, maxw: number, lh: number, maxLines: number, size: number, col: string) {
  ctx.fillStyle = col; ctx.font = `${size}px system-ui`; ctx.textAlign = 'left'
  let line = '', ln = 0
  for (const ch of [...s]) {
    if (ctx.measureText(line + ch).width > maxw) { ctx.fillText(line, x, y + ln * lh); ln++; line = ch; if (ln >= maxLines) return }
    else line += ch
  }
  if (ln < maxLines) ctx.fillText(line, x, y + ln * lh)
}
function frame() {
  ctx.fillStyle = '#141019'; ctx.fillRect(0, 0, W, H)
  const lv = L(), ref = REF()
  // 关卡条
  for (const b of levelBtns()) {
    const on = b.i === lvl, ul = unlocked(b.i)
    box(b.x, b.y, b.bw, b.bh, on ? '#2a2340' : ul ? '#1b1622' : '#151119', on ? '#d8c4ff' : ul ? '#4a4158' : '#262030', on ? 2.5 : 1.5)
    text(`${passed(b.i) ? '✓ ' : ul ? '' : '🔒 '}${b.i}. ${lv && LEVELS[b.i]!.name.replace('真·CPU · ', '').replace('终关 · ', '终关:')}`,
      b.x + b.bw / 2, b.y + 21, 12, on ? CREAM : ul ? DIM : '#3f3850', 'center', on)
  }
  text(lv.name, 24, 78, 19, CREAM, 'left', true)
  text(lv.story, 24, 100, 13, '#c8bfa8')
  wrap(lv.hint, 24, 124, W - 48, 19, 2, 13, AMBER)

  // 左栏:程序 / 存储器 / 参考
  text('程序', 24, 172, 13, DIM)
  lv.prog.forEach((ins, i) => {
    const y = 194 + i * 24
    const active = run?.trace.some(c => c.slots.some(s => s === i))
    text(`${i}`, 26, y, 12, DIM)
    ctx.font = '14px ui-monospace, monospace'; ctx.fillStyle = active ? CREAM : '#7a6f5a'; ctx.fillText(instrText(ins), 48, y)
  })
  let ly = 194 + lv.prog.length * 24 + 14
  if (lv.mem.length) {
    text('数据存储器', 24, ly, 12, DIM)
    text(lv.mem.map((v, i) => `[${i}]=${v}`).join('  '), 24, ly + 20, 13, '#8fb4ff'); ly += 44
  }
  text('参考答案 = 同一段程序顺序执行一遍', 24, ly, 12, DIM)
  text(ref.map((v, i) => `r${i}=${v}`).join('  '), 24, ly + 22, 14, TEAL)

  // 机器:上排旁路/冒险检测,下排五级
  const g = geo()
  text('旁路线 / 冒险检测', g.x0, g.topY - 10, 12, DIM)
  const exSlot = slots.indexOf('ex')
  for (let s = 0; s < NSLOT; s++) {
    const x = g.x0 + s * (g.cw + 10), t = tops[s]
    box(x, g.topY, g.cw, g.ch, t ? (t === 'wire' ? '#1d3a34' : '#3a2f1a') : '#1b1622', t ? (t === 'wire' ? TEAL : AMBER) : '#332c40')
    if (t) {
      text(t === 'wire' ? '旁路线' : '冒险检测', x + g.cw / 2, g.topY + 34, 15, t === 'wire' ? '#8fe0c8' : AMBER, 'center', true)
      const useful = t === 'wire' ? (exSlot >= 0 && s > exSlot) : slots[s] === 'id'
      text(useful ? (t === 'wire' ? '↩ 送回执行级' : '值没到就停一拍') : '接在这里没用', x + g.cw / 2, g.topY + 58, 11, useful ? DIM : RED, 'center')
    }
  }
  for (let s = 0; s < NSLOT; s++) {
    const x = g.x0 + s * (g.cw + 10), st = slots[s]
    box(x, g.y0, g.cw, g.ch, st ? '#241d33' : '#1b1622', st ? '#7d5fa8' : '#332c40')
    text(`第 ${s + 1} 槽`, x + 8, g.y0 + 18, 11, DIM)
    if (st) { text(STAGE_NAME[st], x + g.cw / 2, g.y0 + 46, 18, '#d8c4ff', 'center', true); text(st.toUpperCase(), x + g.cw / 2, g.y0 + 68, 11, DIM, 'center') }
    else text('空', x + g.cw / 2, g.y0 + 50, 14, '#4a4158', 'center')
  }
  if (exSlot >= 0) for (let s = exSlot + 1; s < NSLOT; s++) if (tops[s] === 'wire') { // 旁路线画成一条真的绕回去的线
    const xa = g.x0 + s * (g.cw + 10) + g.cw / 2, xb = g.x0 + exSlot * (g.cw + 10) + g.cw / 2
    ctx.strokeStyle = TEAL; ctx.lineWidth = 2.5; ctx.beginPath()
    ctx.moveTo(xa, g.topY + g.ch); ctx.lineTo(xa, g.topY + g.ch + 10); ctx.lineTo(xb, g.topY + g.ch + 10); ctx.lineTo(xb, g.y0); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(xb - 5, g.y0 - 8); ctx.lineTo(xb, g.y0); ctx.lineTo(xb + 5, g.y0 - 8); ctx.stroke()
  }

  // 时空图 —— 课本上那张斜梯形,是这台机器自己跑出来的。
  // 起点要**同时**让开机器和左栏:左栏会随指令条数/有没有存储器面板变高,写死就会被压上。
  const ty = Math.max(g.y0 + g.ch + 46, ly + 56)
  text('时空图(每一拍,哪条指令在哪一级;红=被停顿卡住)', 24, ty - 12, 13, DIM)
  if (run) {
    const cwid = Math.min(52, (W - 80) / Math.max(1, run.trace.length)), rh = 28
    lv.prog.forEach((_, i) => {
      text(`#${i}`, 24, ty + 20 + i * rh, 12, DIM)
      run!.trace.forEach((c, t) => {
        const s = c.slots.indexOf(i); if (s < 0) return
        const st = slots[s], x = 56 + t * cwid, held = c.stalled && s <= slots.indexOf('id')
        box(x, ty + 4 + i * rh, cwid - 4, rh - 6, held ? '#3a2118' : '#22304a', held ? RED : '#4a6fb0', 1.5)
        text(st ? STAGE_NAME[st] : '·', x + (cwid - 4) / 2, ty + 22 + i * rh, 12, CREAM, 'center')
      })
    })
    run.trace.forEach((_, t) => text(String(t + 1), 56 + t * cwid + (cwid - 4) / 2, ty + 4 + lv.prog.length * rh + 14, 11, DIM, 'center'))
  } else text(machineOk() ? '按「运行机器」看它跑' : '五级还没摆齐(取指/译码/执行/访存/写回,一个都不能少)', 56, ty + 24, 14, machineOk() ? DIM : RED)

  // 右栏:寄存器 实际 vs 参考
  const rx = W - 250
  text('寄存器终值', rx, 172, 13, DIM)
  for (let i = 0; i < NREG; i++) {
    const y = 196 + i * 26, got = run ? run.regs[i]! : null, want = ref[i]!
    text(`r${i}`, rx, y, 14, DIM)
    ctx.font = '15px ui-monospace, monospace'
    ctx.fillStyle = got === null ? '#4a4158' : got === want ? TEAL : RED
    ctx.fillText(got === null ? '—' : String(got), rx + 34, y)
    text(`应为 ${want}`, rx + 96, y, 12, DIM)
  }
  text(`目标 ≤${lv.par.parts} 件 · ≤${lv.par.cycles} 拍`, rx, 316, 12, DIM)
  if (run) {
    const okk = resultOk(), mp = partCount() <= lv.par.parts, mc = run.cycles <= lv.par.cycles
    text(okk ? '✓ 结果对了' : run.overrun ? '✕ 机器空转(五级摆得不成样子)' : '✕ 有寄存器读到了旧值', rx, 342, 16, okk ? TEAL : RED, 'left', true)
    text(`用了 ${run.cycles} 拍 · ${partCount()} 件${okk ? `  ${mp ? '🏅省料 ' : ''}${mc ? '🏅飞快' : ''}` : ''}`, rx, 364, 13, CREAM)
    const stalls = run.trace.filter(c => c.stalled).length
    text(stalls ? `其中停顿 ${stalls} 拍` : '一拍都没停', rx, 384, 12, stalls ? AMBER : TEAL)
  }

  // 零件盘
  const T = trayGeo(), items = levelTools()
  text(`零件盘 · 点一个,再点槽位放下${tool === 'wire' ? '(旁路线放在结果已经出炉的那一级上方)' : tool === 'hazard' ? '(冒险检测放在译码级上方)' : ''}`, T.x0, T.y - 10, 12, AMBER)
  items.forEach((t, i) => {
    const x = T.x0 + i * (T.ts + T.gap), on = tool === t
    box(x, T.y, T.ts, T.ts, on ? '#3a342a' : '#20190f', on ? '#ffe6a8' : '#5a4e3a', on ? 3 : 1.5)
    text(toolName(t), x + T.ts / 2, T.y + T.ts / 2 + 5, 13, on ? CREAM : DIM, 'center', on)
  })
  const R = runBtn()
  box(R.x, R.y, R.bw, R.bh, '#2f5a3f', '#7fe8c0', 2.5)
  text('▶ 运行机器', R.x + R.bw / 2, R.y + R.bh / 2 + 6, 17, CREAM, 'center', true)
  requestAnimationFrame(frame)
}
loadLevel(0)
requestAnimationFrame(frame)

// —— 虾米课堂外壳:返回主页 / 暂停 / 关卡进度(本机 + 账号同步)——
HUB = mountHub({
  title: '搭机器 · CPU 流水线',
  key: 'cpu',
  //  回房子 = 回同目录的首页(/lab/world/ 或本地 dev 的 /),相对当前文档解析
  links: [{ label: '← 回房子 · 路由器', href: new URL('./', location.href).href }],
  read: () => best,
  write: d => { if (d && typeof d === 'object') best = d as Record<number, { parts: number; cycles: number }> },
  reset: () => { best = {}; loadLevel(0) },
  summary: () => {
    const done = LEVELS.filter((_, i) => passed(i)).length
    const lines = [`通过 ${done} / ${LEVELS.length} 关`]
    LEVELS.forEach((L, i) => {
      const b = best[i]
      lines.push(b ? `${i}. ${L.name} —— 最好 ${b.parts} 件 ${b.cycles} 拍` : `${i}. ${L.name} —— ${unlocked(i) ? '还没通' : '未解锁'}`)
    })
    return lines
  },
})

// dev 钩子(冒烟脚本按这些来)
type Win = Record<string, unknown>
;(window as unknown as Win).__cpuLevels = () => LEVELS.map(l => l.name)
;(window as unknown as Win).__cpuPlay = (i: number) => { loadLevel(i); return { prog: L().prog.map(instrText), mem: L().mem, ref: REF(), parts: L().parts, par: L().par } }
;(window as unknown as Win).__cpuSet = (st: (Stage | null)[], tp: (Top | null)[]) => { slots = [...st]; tops = [...tp]; run = null }
;(window as unknown as Win).__cpuRun = () => { doRun(); return run ? { regs: run.regs, ref: REF(), cycles: run.cycles, stalls: run.trace.filter(c => c.stalled).length, overrun: run.overrun, ok: resultOk(), parts: partCount() } : null }
