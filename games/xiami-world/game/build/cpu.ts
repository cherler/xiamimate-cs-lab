/**
 * 「搭机器」第二台设备 · CPU 五级流水线(**灰盒竖切**,先验机制、不做美术)。
 *
 * 为什么是它:路由器那台机器的零件已经把「按址转发」读干净了,而流水线是另一类真机器 ——
 * 指令是令牌、五级是零件、**冒险与旁路是真谜题**、优化轴天生就是拍数。
 *
 * 这一版要验的三件事:
 *   ① 流水线仿真是真的(终值由真解释器算,不是写死的答案);
 *   ② 冒险看得见(不接旁路就会读到旧值,寄存器面板当场变红);
 *   ③ 「旁路 vs 停顿」是一道真的设计题(两条路都能对,一条快一条省件)。
 *
 * 焊死引擎的口径:**参考答案 = 同一段程序顺序执行一遍**(runSeq),不是我写在关卡里的常数。
 * 你搭的机器跑出来的寄存器终值必须和它一模一样 —— 判据由两个真解释器对撞产生。
 */
const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
function resize() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()

const CREAM = '#efe6d2', AMBER = '#e8c98a', TEAL = '#49a791', RED = '#c8452e', DIM = '#9a8a6a'

// —— 指令集(极小,但是真的:一条取常数、一条加法;寄存器 r0~r3)——
type Instr = { op: 'li'; d: number; imm: number } | { op: 'add'; d: number; a: number; b: number }
const NREG = 4
const PROG: Instr[] = [
  { op: 'li', d: 1, imm: 3 },          // r1 = 3
  { op: 'li', d: 2, imm: 4 },          // r2 = 4
  { op: 'add', d: 3, a: 1, b: 2 },     // r3 = r1 + r2   ← 离 r2 只差 1 条、离 r1 差 2 条
  { op: 'add', d: 1, a: 3, b: 2 },     // r1 = r3 + r2   ← 离 r3 只差 1 条
]
const instrText = (i: Instr) => i.op === 'li' ? `li   r${i.d}, #${i.imm}` : `add  r${i.d}, r${i.a}, r${i.b}`
const srcOf = (i: Instr): number[] => i.op === 'li' ? [] : [i.a, i.b]
const dstOf = (i: Instr) => i.d

/** 参考答案:同一段程序**顺序执行**一遍。流水线跑出来的终值必须和它一致。 */
function runSeq(prog: Instr[]) {
  const r = new Array<number>(NREG).fill(0)
  for (const ins of prog) r[ins.d] = ins.op === 'li' ? ins.imm : r[ins.a]! + r[ins.b]!
  return r
}

// —— 机器:5 个槽,每槽放一个阶段零件;槽的正上方可以放旁路线 / 冒险检测 ——
type Stage = 'if' | 'id' | 'ex' | 'mem' | 'wb'
type Top = 'wire' | 'hazard'
const NSLOT = 5
const STAGE_NAME: Record<Stage, string> = { if: '取指', id: '译码', ex: '执行', mem: '访存', wb: '写回' }
const STAGE_DESC: Record<Stage, string> = {
  if: '把下一条指令取进来',
  id: '读出它要用的两个寄存器(此刻读到什么就是什么)',
  ex: '算(旁路线送来的新值在这一级顶掉刚才读到的旧值)',
  mem: '访存(加法在这一级什么都不做 —— 真 MIPS 也是空转)',
  wb: '把结果写回寄存器堆(写在前半拍,所以同拍译码读得到)',
}
let slots: (Stage | null)[] = new Array(NSLOT).fill(null)
let tops: (Top | null)[] = new Array(NSLOT).fill(null)

type Cyc = { slots: (number | null)[]; stalled: boolean }
type Run = { regs: number[]; cycles: number; trace: Cyc[]; overrun: boolean }

/**
 * 流水线仿真。规矩全部写在这里,画面只是把它画出来:
 * - 指令每拍前进一个槽;槽里放的是哪个零件,就在那一拍做那件事(所以顺序摆错=真的会错)。
 * - 一拍之内的次序:**写回 → 译码读 → 执行算**。写回在前,所以「隔 3 条」的依赖天生没事
 *   (真 MIPS 靠寄存器堆前半拍写、后半拍读拿到同样的效果)。
 * - 旁路线放在第 k 槽上方 = 把「此刻在第 k 槽那条指令已经算出来的结果」直接送到执行级的输入。
 *   只有 k 在执行级后面才有意义(前面的还没算出来呢)。
 * - 冒险检测放在译码级上方 = 值还拿不到就停顿一拍,给执行级塞一个气泡。
 */
function runPipe(prog: Instr[]): Run {
  const exSlot = slots.indexOf('ex'), idSlot = slots.indexOf('id'), wbSlot = slots.indexOf('wb')
  const regs = new Array<number>(NREG).fill(0)
  const pipe: (number | null)[] = new Array(NSLOT).fill(null)
  const readVal: number[][] = prog.map(() => [0, 0])   // 译码那一拍读到的两个操作数
  const exRes: number[] = prog.map(() => 0)            // 执行级算出来的结果
  const doneEx = new Set<number>()                     // 已经过执行级的指令(旁路只能取到这些)
  const trace: Cyc[] = []
  let next = 0, cycles = 0, overrun = false
  pipe[0] = next < prog.length ? next++ : null   // 第 1 拍取指级里就该站着第 0 条,不然白空转一拍

  while (cycles < 60) {
    cycles++
    // ① 写回(前半拍)
    if (wbSlot >= 0 && pipe[wbSlot] !== null) { const i = pipe[wbSlot]!; regs[dstOf(prog[i]!)] = exRes[i]! }
    // ② 译码:此刻寄存器堆里是什么就读什么 —— 读到旧值正是「冒险」本身
    if (idSlot >= 0 && pipe[idSlot] !== null) {
      const i = pipe[idSlot]!, s = srcOf(prog[i]!)
      readVal[i] = [s[0] === undefined ? 0 : regs[s[0]]!, s[1] === undefined ? 0 : regs[s[1]]!]
    }
    // ③ 执行:旁路线送来的新值在这里顶掉刚才读到的旧值
    if (exSlot >= 0 && pipe[exSlot] !== null) {
      const i = pipe[exSlot]!, ins = prog[i]!
      if (ins.op === 'li') exRes[i] = ins.imm
      else {
        const v = [readVal[i]![0]!, readVal[i]![1]!]
        const s = [ins.a, ins.b]
        for (let k = 0; k < 2; k++) {
          for (let sl = NSLOT - 1; sl > exSlot; sl--) {           // 从最靠后的槽找起 = 取最新的那份
            if (tops[sl] !== 'wire') continue
            const j = pipe[sl]; if (j === null || j === undefined || !doneEx.has(j)) continue
            if (dstOf(prog[j]!) === s[k]) { v[k] = exRes[j]!; break }
          }
        }
        exRes[i] = v[0]! + v[1]!
      }
      doneEx.add(i)
    }
    trace.push({ slots: [...pipe], stalled: false })
    // ④ 冒险检测:译码级那条指令的源值,下一拍到得了执行级吗?到不了就停一拍
    let stall = false
    if (idSlot >= 0 && tops[idSlot] === 'hazard' && pipe[idSlot] !== null) {
      const i = pipe[idSlot]!
      for (const s of srcOf(prog[i]!)) {
        for (let sl = idSlot + 1; sl < NSLOT; sl++) {
          const j = pipe[sl]; if (j === null || j === undefined || j >= i) continue
          if (dstOf(prog[j]!) !== s) continue
          if (wbSlot >= 0 && sl === wbSlot) break                  // 这一拍它已经写回了,读得到
          const nextSlot = sl + 1                                  // 下一拍它挪到哪
          if (nextSlot < NSLOT && tops[nextSlot] === 'wire' && nextSlot > exSlot) break // 旁路接得上
          stall = true; break
        }
        if (stall) break
      }
    }
    if (stall) trace[trace.length - 1]!.stalled = true
    // ⑤ 推进一格(停顿时:译码级及之前冻住,往执行级塞一个气泡)
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

const REF = runSeq(PROG)
let run: Run | null = null
const machineOk = () => (['if', 'id', 'ex', 'mem', 'wb'] as Stage[]).every(s => slots.includes(s))
const resultOk = () => !!run && !run.overrun && run.regs.every((v, i) => v === REF[i])
const partCount = () => slots.filter(Boolean).length + tops.filter(Boolean).length

// —— 交互 ——
type Tool = Stage | Top | 'erase'
const TOOLS: Tool[] = ['if', 'id', 'ex', 'mem', 'wb', 'wire', 'hazard', 'erase']
const toolName = (t: Tool) => t === 'wire' ? '旁路线' : t === 'hazard' ? '冒险检测' : t === 'erase' ? '擦除' : STAGE_NAME[t]
let tool: Tool = 'if'

/* 版面是竖着码的,别再让哪一块压到另一块上:
   页眉 34~130 / 机器 164~346(上排旁路 164、下排五级 262)/ 时空图 380 起。
   左栏(程序+参考)和右栏(寄存器)只占 158~350,和时空图错开。 */
function geo() {
  const cw = Math.min(150, (W - 560) / NSLOT), ch = 84
  const x0 = 300, y0 = 262
  return { cw, ch, x0, y0, topY: 164 }
}
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

cv.addEventListener('pointerdown', e => {
  const R = runBtn()
  if (e.clientX >= R.x && e.clientX <= R.x + R.bw && e.clientY >= R.y && e.clientY <= R.y + R.bh) { doRun(); return }
  const T = trayGeo()
  if (e.clientY >= T.y && e.clientY <= T.y + T.ts) {
    for (let i = 0; i < TOOLS.length; i++) { const x = T.x0 + i * (T.ts + T.gap); if (e.clientX >= x && e.clientX <= x + T.ts) { tool = TOOLS[i]!; return } }
  }
  const c = hit(e.clientX, e.clientY); if (!c) return
  if (c.row === 'stage') slots[c.slot] = tool === 'erase' ? null : (tool === 'wire' || tool === 'hazard' ? slots[c.slot]! : tool)
  else tops[c.slot] = tool === 'erase' ? null : (tool === 'wire' || tool === 'hazard' ? tool : tops[c.slot]!)
  run = null
})
addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); doRun() } })
function doRun() { run = machineOk() ? runPipe(PROG) : null }

// —— 画(灰盒:方块 + 字,先不上美术)——
function box(x: number, y: number, w: number, h: number, fill: string, stroke: string, lw = 2) {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h)
}
function text(s: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = 'left', bold = false) {
  ctx.fillStyle = col; ctx.font = `${bold ? 'bold ' : ''}${size}px system-ui`; ctx.textAlign = align; ctx.fillText(s, x, y); ctx.textAlign = 'left'
}
function frame() {
  ctx.fillStyle = '#141019'; ctx.fillRect(0, 0, W, H)
  text('第二台机器 · CPU 五级流水线', 24, 34, 20, CREAM, 'left', true)
  text('灰盒竖切 —— 只验机制,美术后补', 24, 56, 12, DIM)
  text('把五级按顺序摆好,让四条指令流过去。译码级此刻读到什么就是什么 —— 前一条还没写回,你读到的就是旧值,这就是「冒险」。', 24, 84, 13, AMBER)
  text('① 接〈旁路线〉:放在还没写回的那一级上方,把刚算出的结果直接送回执行级 —— 不多花一拍。', 24, 106, 13, AMBER)
  text('② 放〈冒险检测〉:放在译码级上方,值还没到就停一拍 —— 省线,但慢。两条路都能对,这就是那道设计题。', 24, 126, 13, AMBER)

  // 程序
  text('程序', 24, 158, 13, DIM)
  PROG.forEach((ins, i) => {
    const y = 180 + i * 24
    const active = run?.trace.some(c => c.slots.some(s => s === i))
    text(`${i}`, 26, y, 12, DIM)
    ctx.font = '14px ui-monospace, monospace'; ctx.fillStyle = active ? CREAM : '#7a6f5a'; ctx.fillText(instrText(ins), 48, y)
  })
  text('参考答案 = 同一段程序顺序执行一遍', 24, 300, 12, DIM)
  text(REF.map((v, i) => `r${i}=${v}`).join('  '), 24, 322, 14, TEAL)

  // 机器:上排旁路/冒险检测,下排五级
  const g = geo()
  text('旁路线 / 冒险检测', g.x0, g.topY - 10, 12, DIM)
  for (let s = 0; s < NSLOT; s++) {
    const x = g.x0 + s * (g.cw + 10)
    const t = tops[s]
    box(x, g.topY, g.cw, g.ch, t ? (t === 'wire' ? '#1d3a34' : '#3a2f1a') : '#1b1622', t ? (t === 'wire' ? TEAL : AMBER) : '#332c40')
    if (t) {
      text(t === 'wire' ? '旁路线' : '冒险检测', x + g.cw / 2, g.topY + 34, 15, t === 'wire' ? '#8fe0c8' : AMBER, 'center', true)
      const exSlot = slots.indexOf('ex')
      const useful = t === 'wire' ? (exSlot >= 0 && s > exSlot) : slots[s] === 'id'
      text(useful ? (t === 'wire' ? '↩ 送回执行级' : '值没到就停一拍') : '接在这里没用', x + g.cw / 2, g.topY + 58, 11, useful ? DIM : RED, 'center')
    }
  }
  for (let s = 0; s < NSLOT; s++) {
    const x = g.x0 + s * (g.cw + 10), st = slots[s]
    box(x, g.y0, g.cw, g.ch, st ? '#241d33' : '#1b1622', st ? '#7d5fa8' : '#332c40')
    text(`第 ${s + 1} 槽`, x + 8, g.y0 + 18, 11, DIM)
    if (st) {
      text(STAGE_NAME[st], x + g.cw / 2, g.y0 + 44, 18, '#d8c4ff', 'center', true)
      text(st.toUpperCase(), x + g.cw / 2, g.y0 + 66, 11, DIM, 'center')
    } else text('空', x + g.cw / 2, g.y0 + 48, 14, '#4a4158', 'center')
  }
  const exSlot = slots.indexOf('ex')
  if (exSlot >= 0) for (let s = exSlot + 1; s < NSLOT; s++) if (tops[s] === 'wire') { // 旁路线画成一条真的绕回去的线
    const xa = g.x0 + s * (g.cw + 10) + g.cw / 2, xb = g.x0 + exSlot * (g.cw + 10) + g.cw / 2
    ctx.strokeStyle = TEAL; ctx.lineWidth = 2.5; ctx.beginPath()
    ctx.moveTo(xa, g.topY + g.ch); ctx.lineTo(xa, g.topY + g.ch + 10); ctx.lineTo(xb, g.topY + g.ch + 10); ctx.lineTo(xb, g.y0); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(xb - 5, g.y0 - 8); ctx.lineTo(xb, g.y0); ctx.lineTo(xb + 5, g.y0 - 8); ctx.stroke()
  }

  // 时空图 —— 课本上那张斜梯形,是这台机器自己跑出来的
  const ty = g.y0 + g.ch + 46
  text('时空图(每一拍,哪条指令在哪一级)', 24, ty - 12, 13, DIM)
  if (run) {
    const cwid = Math.min(52, (W - 80) / Math.max(1, run.trace.length)), rh = 28
    PROG.forEach((_, i) => {
      text(`#${i}`, 24, ty + 20 + i * rh, 12, DIM)
      run!.trace.forEach((c, t) => {
        const s = c.slots.indexOf(i); if (s < 0) return
        const st = slots[s]
        const x = 56 + t * cwid
        box(x, ty + 4 + i * rh, cwid - 4, rh - 6, c.stalled && s <= slots.indexOf('id') ? '#3a2118' : '#22304a', c.stalled && s <= slots.indexOf('id') ? RED : '#4a6fb0', 1.5)
        text(st ? STAGE_NAME[st] : '·', x + (cwid - 4) / 2, ty + 22 + i * rh, 12, CREAM, 'center')
      })
    })
    run.trace.forEach((_, t) => text(String(t + 1), 56 + t * cwid + (cwid - 4) / 2, ty + 4 + PROG.length * rh + 14, 11, DIM, 'center'))
  } else text(machineOk() ? '按「运行机器」看它跑' : '五级还没摆齐(取指/译码/执行/访存/写回,一个都不能少)', 56, ty + 24, 14, machineOk() ? DIM : RED)

  // 寄存器:实际 vs 参考
  const rx = W - 250
  text('寄存器终值', rx, 158, 13, DIM)
  for (let i = 0; i < NREG; i++) {
    const y = 182 + i * 26, got = run ? run.regs[i]! : null, want = REF[i]!
    text(`r${i}`, rx, y, 14, DIM)
    ctx.font = '15px ui-monospace, monospace'
    ctx.fillStyle = got === null ? '#4a4158' : got === want ? TEAL : RED
    ctx.fillText(got === null ? '—' : String(got), rx + 34, y)
    text(`应为 ${want}`, rx + 96, y, 12, DIM)
  }
  if (run) {
    text(resultOk() ? '✓ 结果对了' : run.overrun ? '✕ 机器空转(五级摆得不成样子)' : '✕ 有寄存器读到了旧值', rx, 310, 16, resultOk() ? TEAL : RED, 'left', true)
    text(`用了 ${run.cycles} 拍 · ${partCount()} 件`, rx, 334, 13, CREAM)
    const stalls = run.trace.filter(c => c.stalled).length
    text(stalls ? `其中停顿 ${stalls} 拍` : '一拍都没停', rx, 354, 12, stalls ? AMBER : TEAL)
  }

  // 零件盘
  const T = trayGeo()
  text(`零件盘 · 点一个,再点槽位放下${tool === 'wire' ? '(旁路线放在「还没写回」那一级的上方)' : tool === 'hazard' ? '(冒险检测放在译码级上方)' : ''}`, T.x0, T.y - 10, 12, AMBER)
  TOOLS.forEach((t, i) => {
    const x = T.x0 + i * (T.ts + T.gap), on = tool === t
    box(x, T.y, T.ts, T.ts, on ? '#3a342a' : '#20190f', on ? '#ffe6a8' : '#5a4e3a', on ? 3 : 1.5)
    text(toolName(t), x + T.ts / 2, T.y + T.ts / 2 + 5, 13, on ? CREAM : DIM, 'center', on)
  })
  const R = runBtn()
  box(R.x, R.y, R.bw, R.bh, '#2f5a3f', '#7fe8c0', 2.5)
  text('▶ 运行机器', R.x + R.bw / 2, R.y + R.bh / 2 + 6, 17, CREAM, 'center', true)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// dev 钩子(冒烟脚本按这些来)
type Win = Record<string, unknown>
;(window as unknown as Win).__cpuSet = (st: (Stage | null)[], tp: (Top | null)[]) => { slots = [...st]; tops = [...tp]; run = null }
;(window as unknown as Win).__cpuRun = () => { doRun(); return run ? { regs: run.regs, cycles: run.cycles, stalls: run.trace.filter(c => c.stalled).length, overrun: run.overrun, ok: resultOk(), parts: partCount() } : null }
;(window as unknown as Win).__cpuRef = () => REF
;(window as unknown as Win).__cpuProg = () => PROG.map(instrText)
;(window as unknown as Win).__cpuDesc = () => STAGE_DESC
