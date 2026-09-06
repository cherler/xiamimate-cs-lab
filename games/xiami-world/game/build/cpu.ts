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
import { makeKit, BRASS, STEEL, VIOLET, GOLD, GREEN, AQUA, ROSE, INK } from './kit'
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

// —— 指令集(极小,但每一条都是真 MIPS 里有的:取常数 / 加法 / 取数)——
type Instr =
  | { op: 'li'; d: number; imm: number }
  | { op: 'add'; d: number; a: number; b: number }
  | { op: 'lw'; d: number; addr: number }
  | { op: 'beq'; a: number; b: number; to: number }   // 两个寄存器相等就跳到第 to 条
const NREG = 4
const instrText = (i: Instr) => i.op === 'li' ? `li   r${i.d}, #${i.imm}`
  : i.op === 'lw' ? `lw   r${i.d}, [${i.addr}]`
    : i.op === 'beq' ? `beq  r${i.a}, r${i.b}, →${i.to}`
      : `add  r${i.d}, r${i.a}, r${i.b}`
const srcOf = (i: Instr): number[] => i.op === 'add' || i.op === 'beq' ? [i.a, i.b] : []
/** 写哪个寄存器;分支谁也不写,回 -1 —— 它既不参与写回,也永远不该被当成前递的来源。 */
const dstOf = (i: Instr) => i.op === 'beq' ? -1 : i.d

/** 参考答案:同一段程序**顺序执行**一遍(带分支,所以是按 PC 走,不是从头到尾)。 */
function runSeq(prog: Instr[], mem: number[]) {
  const r = new Array<number>(NREG).fill(0)
  let pc = 0, guard = 0
  while (pc >= 0 && pc < prog.length && guard++ < 400) {
    const ins = prog[pc]!
    if (ins.op === 'beq') { pc = r[ins.a] === r[ins.b] ? ins.to : pc + 1; continue }
    r[ins.d] = ins.op === 'li' ? ins.imm : ins.op === 'lw' ? (mem[ins.addr] ?? 0) : r[ins.a]! + r[ins.b]!
    pc++
  }
  return r
}

// —— 机器:5 个槽,每槽放一个阶段零件;槽的正上方可以放旁路线 / 冒险检测 ——
type Stage = 'if' | 'id' | 'ex' | 'mem' | 'wb'
type Top = 'wire' | 'hazard' | 'flush' | 'icache'
type Tool = Stage | Top | 'erase'
const NSLOT = 5
const STAGE_NAME: Record<Stage, string> = { if: '取指', id: '译码', ex: '执行', mem: '访存', wb: '写回' }
const toolName = (t: Tool) => t === 'wire' ? '旁路线' : t === 'hazard' ? '冒险检测' : t === 'flush' ? '分支作废' : t === 'icache' ? '指令缓存' : t === 'erase' ? '擦除' : STAGE_NAME[t]
let slots: (Stage | null)[] = new Array(NSLOT).fill(null)
let tops: (Top | null)[] = new Array(NSLOT).fill(null)

// —— 关卡(每一关都能在真 CPU 上指得到)——
/** 切级关的一条微操作:一件事 + 它要花多少「工作量」(决定拍长的那个量)。 */
type MicroOp = { name: string; short: string; work: number; role: Stage }
type Level = { name: string; story: string; hint: string; prog: Instr[]; mem: number[]; parts: Tool[]; par: { parts: number; cycles: number }; finale?: boolean
  /** 有它就是**切级关**:不摆零件了,改成在微操作之间下刀(插流水寄存器)。评分换成**总时间 = 拍数 × 拍长**。 */
  split?: { ops: MicroOp[] } }
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
    name: '真·CPU · 控制冒险(分支)',
    story: '分支要到执行级才知道跳不跳 —— 而这时候,后面两条早就被取进流水线了。',
    hint: '取指级只会一条接一条地往下取,可 beq 得等到〈执行〉级比完两个寄存器才知道跳不跳。等它知道的时候,后面两条已经在流水线里了 —— 跳了的话,它们全是走错路取进来的,再往下跑就会真的写进寄存器。放一个〈分支作废〉在〈执行〉级上方,把它们当场划掉(时空图上会看到被划掉的格子)。不放的话它们照跑不误 —— 真机器没有作废硬件时就是这样,所以早期 MIPS 干脆规定紧跟分支那一条一定执行,那就是「延迟槽」。',
    /*  走错路的那条是 `add r3,r3,r3` 而不是 `li r3,#99` —— 它**改**结果而不是**设**结果。
        第一版用的是 li:一台什么零件都不装的机器(分支操作数读到旧值→误判相等→提前跳走)
        会连那条一起跳过,于是**碰巧**得到同一组终值、判据判它通过 —— 答案对了理由是错的。
        换成 add 之后,任何一条走错路的指令都会在终值上留下痕迹。(对抗性审查抓出来的) */
    prog: [
      { op: 'li', d: 1, imm: 1 }, { op: 'li', d: 2, imm: 2 },
      { op: 'beq', a: 1, b: 2, to: 7 },   // 1≠2 → 不该跳(操作数读到旧值的机器会误判成跳)
      { op: 'li', d: 3, imm: 7 },
      { op: 'li', d: 0, imm: 3 },
      { op: 'add', d: 3, a: 3, b: 1 },    // 距分支 3 条 —— 落在「作废阴影」之外,误跳就一定漏掉它
      { op: 'beq', a: 3, b: 3, to: 8 },   // 自己等于自己 → 一定跳,下面那条不该执行
      { op: 'add', d: 3, a: 3, b: 3 },    // 走错路才会跑到的一条:它**改**结果,一定在终值上留痕
      { op: 'add', d: 0, a: 3, b: 1 },
    ],
    mem: [], parts: [...FIVE, 'wire', 'hazard', 'flush'], par: { parts: 9, cycles: 15 },
  },
  {
    name: '真·CPU · 结构冒险(一个存储器两个人抢)',
    story: 'lw 在访存级取数据的那一拍,取指级也想去同一个存储器取指令 —— 一个门,两个人。',
    hint: '这一关结果一定是对的 —— 结构冒险不会算错,只会变慢。考的是拍数:每有一条 lw 在〈访存〉级取数据,同一拍的〈取指〉就得让一让,流水线前面多一个气泡(时空图上蓝色那几拍)。真机器的办法不是排队,是「把指令和数据分成两个存储器」(哈佛结构)—— 装一个〈指令缓存〉在〈取指〉级上方,取指就有自己的门了。装与不装,拍数差几拍,自己看。',
    prog: [
      { op: 'lw', d: 1, addr: 0 }, { op: 'lw', d: 2, addr: 1 }, { op: 'lw', d: 3, addr: 2 },
      { op: 'add', d: 1, a: 3, b: 2 },   // r3 来自紧邻的 lw → 顺带还是个 load-use
      { op: 'add', d: 2, a: 1, b: 3 },
      { op: 'add', d: 3, a: 1, b: 2 },
    ],
    mem: [5, 9, 2, 4], parts: [...FIVE, 'wire', 'hazard', 'icache'], par: { parts: 9, cycles: 11 },
  },
  {
    name: '真·CPU · 切几级(拍长 vs 拍数)',
    story: '流水线不是越深越好 —— 切得越细拍长越短,可拍数和冒险的代价一起涨上来。',
    hint: '硬件这回全给你装好了(旁路 / 冒险检测 / 分支作废 / 指令缓存)—— 这一关只问一件事:「刀下在哪」。一条指令的组合逻辑要干五件事,各自的工作量写在卡片上;你在两件事之间插一个〈流水寄存器〉,就把它们切成两段。一拍的时长 =「最重那一段」(木桶),拍数 = 指令数 + 段数 − 1 + 停顿。评分不再看拍数,看「总时间 = 拍数 × 拍长」。全切开(五级)未必最快 —— 自己试。',
    prog: [
      { op: 'lw', d: 1, addr: 0 }, { op: 'add', d: 2, a: 1, b: 1 },
      { op: 'lw', d: 3, addr: 1 }, { op: 'add', d: 1, a: 3, b: 2 },
      { op: 'beq', a: 1, b: 1, to: 6 }, { op: 'li', d: 2, imm: 999 },
      { op: 'add', d: 3, a: 1, b: 2 },
    ],
    mem: [5, 9, 2, 4],
    split: {
      ops: [
        { name: '取指令', short: '取指', work: 3, role: 'if' },
        { name: '译码 + 读寄存器', short: '译码', work: 2, role: 'id' },
        { name: 'ALU 运算', short: 'ALU', work: 4, role: 'ex' },
        { name: '访存', short: '访存', work: 3, role: 'mem' },
        { name: '写回寄存器', short: '写回', work: 2, role: 'wb' },
      ],
    },
    //  评分沿用同一套字段,只是**单位换了**:parts = 用了几刀,cycles = **总时间**(拍数×拍长)。
    //  56 是引擎穷举 16 种切法跑出来的最优(全切五级:拍长 4 × 14 拍),不是我拍脑袋定的。
    parts: [], par: { parts: 4, cycles: 56 },
  },
  {
    name: '终关 · 一段真程序跑到底',
    story: '取数、加法、分支 —— 数据冒险、load-use、控制冒险、结构冒险,四样全在这一段里。',
    hint: '把学过的全用上:两条〈旁路线〉抽两条前递通路,一个〈冒险检测〉兜住 lw 后面那一拍,一个〈分支作废〉划掉跳走后还在流水线里的那几条,一个〈指令缓存〉让取指不用跟访存抢门。停顿越少越好,但结果错了再快也没用 —— 寄存器终值必须和「顺序执行一遍」的参考答案一模一样。',
    prog: [
      { op: 'lw', d: 1, addr: 0 }, { op: 'lw', d: 2, addr: 1 },
      { op: 'add', d: 3, a: 1, b: 2 },
      { op: 'beq', a: 1, b: 2, to: 7 },   // 5≠9 → 不跳
      { op: 'add', d: 1, a: 3, b: 2 },
      { op: 'beq', a: 1, b: 1, to: 7 },   // 一定跳,下面那条不该执行
      { op: 'li', d: 1, imm: 999 },       // 走错路才会跑到的一条
      { op: 'add', d: 2, a: 1, b: 3 },
    ],
    mem: [5, 9, 2, 4], parts: [...FIVE, 'wire', 'hazard', 'flush', 'icache'], par: { parts: 10, cycles: 14 }, finale: true,
  },
]
let lvl = 0
/** 切级关:每两个微操作之间要不要插一个流水寄存器。长度 = 微操作数 − 1。 */
let cuts: boolean[] = []
/** 各微操作落在第几段(前面切了几刀就是第几段)。 */
function segOf(ops: MicroOp[], cs: boolean[]) {
  let seg = 0
  return ops.map((_, i) => { if (i > 0 && cs[i - 1]) seg++; return seg })
}
/** 每段的工作量之和;**一拍的时长 = 最重那一段**(木桶原理)。 */
function segWork(ops: MicroOp[], cs: boolean[]) {
  const seg = segOf(ops, cs), out: number[] = []
  ops.forEach((o, i) => { out[seg[i]!] = (out[seg[i]!] ?? 0) + o.work })
  return out
}
function layoutFromCuts(ops: MicroOp[], cs: boolean[]): Layout {
  const seg = segOf(ops, cs), at = (r: Stage) => seg[ops.findIndex(o => o.role === r)]!
  return { nslot: Math.max(...seg) + 1, ifS: at('if'), idS: at('id'), exS: at('ex'), memS: at('mem'), wbS: at('wb'), tops: [], full: true }
}
const L = () => LEVELS[lvl]!
const REF = () => runSeq(L().prog, L().mem)

type Cyc = { slots: (number | null)[]; stalled: boolean; killed?: number[]; jam?: boolean }
type Run = { regs: number[]; cycles: number; trace: Cyc[]; overrun: boolean; jams: number }

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
/** 五件事各住在第几段。摆零件关里一段一件事;切级关里几件事可以**挤在同一段**。 */
type Layout = { nslot: number; ifS: number; idS: number; exS: number; memS: number; wbS: number; tops: (Top | null)[]
  /** 切级关:旁路 / 冒险检测 / 分支作废 / 指令缓存**全都当作已装好** —— 那几关已经让你一个个建过了,
   *  这一关要问的是另一件事:**刀下在哪**。 */
  full?: boolean }
/** 从「一段一个零件」的摆法读出布局 —— 摆零件那七关用它。 */
const layoutFromSlots = (): Layout => ({
  nslot: NSLOT, ifS: slots.indexOf('if'), idS: slots.indexOf('id'),
  exS: slots.indexOf('ex'), memS: slots.indexOf('mem'), wbS: slots.indexOf('wb'), tops,
})
function runPipe(prog: Instr[], mem: number[], lay: Layout): Run {
  const NS = lay.nslot, ifSlot = lay.ifS, idSlot = lay.idS, exSlot = lay.exS, memSlot = lay.memS, wbSlot = lay.wbS
  const tops = lay.tops
  /** 这条指令**取回来了吗**:只有走到〈取指〉那一段(或更后面)的,才该被后面几级处理。
   *  少了这一条,取指就是个纯摆设 —— 把它摆到最后、甚至摆在译码后面,机器照样算对,
   *  而关卡文案却说「顺序是仿真自己认的」。那就是画面在撒谎。(对抗性审查抓出来的)
   *  用 `>=` 而不是 `>`:切级关里取指和译码可以**在同一段**,那一段里当然是先取后译。 */
  const fetched = (slot: number) => ifSlot >= 0 && slot >= ifSlot
  const bornAt = (j: number) => prog[j]!.op === 'lw' ? memSlot : exSlot   // 这条指令的结果在哪一级出炉
  const regs = new Array<number>(NREG).fill(0)
  const pipe: (number | null)[] = new Array(NS).fill(null)
  const readVal: number[][] = prog.map(() => [0, 0])   // 译码那一拍读到的两个操作数
  const val: number[] = prog.map(() => 0)              // 这条指令的结果(加法在执行级填、lw 在访存级填)
  const trace: Cyc[] = []
  let pc = 0, cycles = 0, overrun = false, jams = 0
  const fetch = () => (pc >= 0 && pc < prog.length ? pc++ : null)
  pipe[0] = fetch()   // 第 1 拍取指级里就该站着第 0 条,不然白空转一拍

  while (cycles < 60) {
    cycles++
    /** 写回。**只有当写回段比译码段靠后时,它才该排在译码前面**——那时写回的是一条
     *  更老的指令,对应真 MIPS「寄存器堆前半拍写、后半拍读」。切级关里两者可能挤在
     *  同一段(极端是全不切=单周期),那就是**同一条指令**,顺序必须按数据通路来:
     *  先译码、算完、访存完,最后才写回。写死成「写回永远最先」的话,单周期机器会把
     *  还没算出来的东西写回去 —— 十六种切法里有一多半因此算错,而它们本该都是对的。 */
    const doWB = () => { if (wbSlot >= 0 && fetched(wbSlot) && pipe[wbSlot] !== null) { const i = pipe[wbSlot]!, d = dstOf(prog[i]!); if (d >= 0) regs[d] = val[i]! } }
    //  判据是「写回段是否**严格**在访存段之后」——微操作顺序固定,所以 wbS ≥ memS ≥ exS ≥ idS,
    //  这一条同时管住了两种同段情形:写回和译码同段(同一条指令)、写回和访存同段(lw 的值还没取到)。
    //  只写 wbSlot > idSlot 会漏掉后者:十六种切法里有八种因此把 lw 的值丢了,而且**丢得静悄悄**。
    const wbFirst = wbSlot > memSlot
    if (wbFirst) doWB()
    // ② 译码:此刻寄存器堆里是什么就读什么 —— 读到旧值正是「冒险」本身
    if (idSlot >= 0 && fetched(idSlot) && pipe[idSlot] !== null) {
      const i = pipe[idSlot]!, s = srcOf(prog[i]!)
      readVal[i] = [s[0] === undefined ? 0 : regs[s[0]]!, s[1] === undefined ? 0 : regs[s[1]]!]
    }
    // ③ 执行:旁路线送来的新值在这里顶掉刚才读到的旧值
    /** 取这条指令在执行级实际拿到的两个操作数:译码读到的旧值,被旁路线送来的新值顶掉。 */
    const operands = (i: number, s: [number, number]) => {
      const v = [readVal[i]![0]!, readVal[i]![1]!]
      for (let k = 0; k < 2; k++) {
        for (let sl = NS - 1; sl > exSlot; sl--) {             // 从最靠后的槽找起 = 取最新的那份
          if (!lay.full && tops[sl] !== 'wire') continue
          const j = pipe[sl]; if (j === null || j === undefined) continue
          if (sl <= bornAt(j)) continue                            // 它的结果还没出炉,这根线抽的是空的
          if (dstOf(prog[j]!) === s[k]) { v[k] = val[j]!; break }
        }
      }
      return v as [number, number]
    }
    let taken = -1   // 这一拍在执行级判出「要跳」的那条分支,-1 = 没有
    if (exSlot >= 0 && fetched(exSlot) && pipe[exSlot] !== null) {
      const i = pipe[exSlot]!, ins = prog[i]!
      if (ins.op === 'li') val[i] = ins.imm
      else if (ins.op === 'add') { const v = operands(i, [ins.a, ins.b]); val[i] = v[0] + v[1] }
      else if (ins.op === 'beq') {
        //  分支在执行级才判得出跳不跳 —— 而这时候后面两条早就取进流水线了。控制冒险就是这么来的。
        const v = operands(i, [ins.a, ins.b])
        if (v[0] === v[1]) { pc = ins.to; taken = i }
      }
    }
    // ④ 访存:lw 的数据到这一级末尾才出来(排在执行后面 = 同拍的执行级拿不到它)
    if (memSlot >= 0 && fetched(memSlot) && pipe[memSlot] !== null) { const i = pipe[memSlot]!, ins = prog[i]!; if (ins.op === 'lw') val[i] = mem[ins.addr] ?? 0 }
    if (!wbFirst) doWB()   // 写回和译码同段(同一条指令)时,写回排在最后
    trace.push({ slots: [...pipe], stalled: false })
    // ⑤ 冒险检测:译码级那条指令的源值,下一拍到得了执行级吗?到不了就停一拍
    let stall = false
    if (idSlot >= 0 && (lay.full || tops[idSlot] === 'hazard') && pipe[idSlot] !== null) {
      const i = pipe[idSlot]!
      for (const s of srcOf(prog[i]!)) {
        for (let sl = idSlot + 1; sl < NS; sl++) {
          const j = pipe[sl]; if (j === null || j === undefined || j >= i) continue
          if (dstOf(prog[j]!) !== s) continue
          //  「它这一拍已经写回、读得到」这条捷径**只在写回排在译码之前时成立**(wbFirst)。
          //  切级关里写回可能排在最后(和访存/译码同段),那时译码读的是**没写回之前**的值 ——
          //  少了 wbFirst 这个前提,机器不停顿也不前递,静静地读到旧值、结果全错。
          if (wbFirst && wbSlot >= 0 && sl >= wbSlot) break
          //  「下一拍它挪到哪」——**要走几拍取决于译码到执行有多远**,不是固定一拍。
          //  切级关里译码和执行可能挤在同一段(距离 0):那这条指令是**同一拍**被译码又被执行的,
          //  前递必须**当拍**就到位,而不是「下一拍」。写死成 sl+1 的话,机器会以为来得及、
          //  于是不停顿也拿不到值 —— 静静地算错。
          const ns = sl + (exSlot - idSlot)
          if (ns < NS && (lay.full || tops[ns] === 'wire') && ns > exSlot && ns > bornAt(j)) break // 那时旁路抽得到
          stall = true; break
        }
        if (stall) break
      }
    }
    if (stall) trace[trace.length - 1]!.stalled = true
    // ⑥ 分支作废:跳定了,那么执行级**前面**那几条全是走错路取进来的,得当场划掉。
    //    没装〈分支作废〉的话它们照样往下跑、照样写寄存器 —— 真机器没有作废硬件时就是这样,
    //    所以早期 MIPS 干脆规定紧跟分支那一条一定执行(延迟槽),把这件事写进了指令集。
    if (taken >= 0 && (lay.full || tops[exSlot] === 'flush')) {
      const killed: number[] = []
      for (let s = 0; s < exSlot; s++) { const j = pipe[s]; if (j !== null && j !== undefined) killed.push(j); pipe[s] = null }
      if (killed.length) trace[trace.length - 1]!.killed = killed
      stall = false   // 前面都空了,没什么可停的
    }
    // ⑦ 推进一格(停顿时:译码级及之前冻住,往执行级塞一个气泡)
    for (let s = NS - 1; s > 0; s--) {
      if (stall && s <= idSlot) continue
      pipe[s] = (stall && s === idSlot + 1) ? null : pipe[s - 1]!
    }
    //  结构冒险:整台机器只有**一个存储器**。lw 正在〈访存〉级取数据的那一拍,
    //  〈取指〉级也想去同一个存储器取指令 —— 两个人抢一个门,取指只能让一拍(前面多一个气泡)。
    //  真机器的办法不是等,而是**把指令和数据分成两个缓存**(哈佛结构):装上〈指令缓存〉就不用抢了。
    //  注意:抢门只会让机器变慢,**不会算错** —— 所以这一关的考点是拍数,不是对错。
    const memBusy = memSlot >= 0 && fetched(memSlot) && pipe[memSlot] !== null && prog[pipe[memSlot]!]!.op === 'lw'
    const jam = !stall && memBusy && ifSlot >= 0 && !lay.full && tops[ifSlot] !== 'icache' && pc < prog.length
    if (jam) { jams++; trace[trace.length - 1]!.jam = true }
    if (!stall) { pipe[0] = jam ? null : fetch() }
    if (pc >= prog.length && pipe.every(x => x === null)) break
    if (cycles >= 60) overrun = true
  }
  return { regs, cycles, trace, overrun, jams }
}

let run: Run | null = null
const isSplit = () => !!L().split
const machineOk = () => isSplit() || (['if', 'id', 'ex', 'mem', 'wb'] as Stage[]).every(s => slots.includes(s))
/** 切级关的两个读数:拍长(最重那一段)与总时间(拍数 × 拍长)。 */
const tickLen = () => { const sp = L().split; return sp ? Math.max(...segWork(sp.ops, cuts)) : 1 }
const totalTime = () => run ? run.cycles * tickLen() : 0
const resultOk = () => { const r = REF(); return !!run && !run.overrun && run.regs.every((v, i) => v === r[i]) }
const partCount = () => slots.filter(Boolean).length + tops.filter(Boolean).length
let best: Record<number, { parts: number; cycles: number }> = {}
try { best = JSON.parse(localStorage.getItem('cpugame.best') || '{}') } catch { }
const passed = (i: number) => best[i] !== undefined
const unlocked = (i: number) => i === 0 || passed(i - 1)

// —— 交互 ——
const levelTools = (): Tool[] => [...L().parts, 'erase']
let tool: Tool = 'if'
function loadLevel(i: number) {
  lvl = Math.max(0, Math.min(LEVELS.length - 1, i))
  slots = new Array(NSLOT).fill(null); tops = new Array(NSLOT).fill(null); run = null
  const sp = L().split
  cuts = sp ? new Array(sp.ops.length - 1).fill(false) : []   // 切级关一开始一刀不切 = 单周期
  tool = L().parts[0] ?? 'if'
}

/* 版面竖着码,别再让哪一块压到另一块上:
   关卡条 20~52 / 页眉 74~150 / 机器 176~358(上排旁路 176、下排五级 274)/ 时空图 400 起。
   左栏(程序+存储器+参考)和右栏(寄存器)只占 172~380,和时空图错开。 */
function geo() {
  const cw = Math.min(150, (W - 560) / NSLOT), ch = 84
  return { cw, ch, x0: 300, y0: 274, topY: 176 }
}
function levelBtns() { const bw = Math.min(210, (W - 48) / LEVELS.length - 8); return LEVELS.map((_, i) => ({ i, x: 24 + i * (bw + 8), y: 20, bw, bh: 32 })) }
/** 切级关的板子:一排微操作卡片,卡片之间是可点的「下刀口」。 */
function splitGeo() {
  const ops = L().split!.ops
  const cw = Math.min(140, (W - 620) / ops.length), gap = 28, ch = 96
  return { ops, cw, gap, ch, x0: 300, y0: 230 }
}
/** 点在第几个刀口上(卡片之间那条缝),没点中回 -1。 */
function hitCut(px: number, py: number) {
  const g = splitGeo()
  for (let i = 0; i < g.ops.length - 1; i++) {
    const x = g.x0 + (i + 1) * g.cw + i * g.gap
    if (px >= x - 4 && px <= x + g.gap + 4 && py >= g.y0 - 10 && py <= g.y0 + g.ch + 10) return i
  }
  return -1
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
  if (isSplit()) {   // 切级关:点刀口,不摆零件
    const k = hitCut(q.x, q.y); if (k >= 0) { cuts[k] = !cuts[k]; run = null }
    return
  }
  const c = hit(e.clientX, e.clientY); if (!c) return
  //  上排只收「旁路线/冒险检测/分支作废」,下排只收五个阶段 —— 放错排就什么也不做
  const isTop = (t: Tool): t is Top => t === 'wire' || t === 'hazard' || t === 'flush' || t === 'icache'
  if (c.row === 'stage') slots[c.slot] = tool === 'erase' ? null : (isTop(tool) ? slots[c.slot]! : tool)
  else tops[c.slot] = tool === 'erase' ? null : (isTop(tool) ? tool : tops[c.slot]!)
  run = null
})
addEventListener('keydown', e => {
  if (HUB?.isPaused()) return
  if (e.key === ' ') { e.preventDefault(); doRun() }
  if (e.key === 'ArrowRight' && unlocked(lvl + 1)) loadLevel(lvl + 1)
  if (e.key === 'ArrowLeft') loadLevel(lvl - 1)
})
function doRun() {
  const sp = L().split
  run = !machineOk() ? null : runPipe(L().prog, L().mem, sp ? layoutFromCuts(sp.ops, cuts) : layoutFromSlots())
  if (run && resultOk()) {
    const b = best[lvl] || { parts: Infinity, cycles: Infinity }
    //  切级关的成绩是**总时间**(拍数×拍长),不是拍数 —— 深流水拍数多但每拍短,只比拍数会得出反的结论
    best[lvl] = isSplit()
      ? { parts: Math.min(b.parts, cuts.filter(Boolean).length), cycles: Math.min(b.cycles, totalTime()) }
      : { parts: Math.min(b.parts, partCount()), cycles: Math.min(b.cycles, run.cycles) }
    HUB?.save()   // 存盘交给课堂外壳:它同时管本机与账号同步
  }
}

// —— 画 —— 物件即美术,和路由器那台同源(共用 game/build/kit.ts)
const K = makeKit(ctx)
/** 各阶段的金属配色:一眼能认出是哪一级,而不是靠读字。 */
const STAGE_SKIN: Record<Stage, string[]> = { if: INK, id: VIOLET, ex: BRASS, mem: AQUA, wb: GREEN }
const TOP_SKIN: Record<Top, string[]> = { wire: GREEN, hazard: GOLD, flush: ROSE, icache: AQUA }
const TOP_LINE: Record<Top, string> = { wire: '#8fe0c8', hazard: '#f0d485', flush: '#ff9e8a', icache: '#9ec2ff' }

function text(s: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = 'left', bold = false) {
  ctx.fillStyle = col; ctx.font = `${bold ? 'bold ' : ''}${size}px system-ui`; ctx.textAlign = align; ctx.fillText(s, x, y); ctx.textAlign = 'left'
}
function wrap(s: string, x: number, y: number, maxw: number, lh: number, maxLines: number, size: number, col: string) {
  ctx.fillStyle = col; ctx.font = `${size}px system-ui`; ctx.textAlign = 'left'; K.wrapText(s, x, y, maxw, lh, maxLines)
}
/** 画在**金属面板上**的字。面板有渐变、深浅不一,单一颜色的字总有一块背景吃掉它 ——
 *  所以一律「亮字 + 深描边」:先描一圈暗边再填亮色,黄铜、冷钢、玫红上都读得清。
 *  (第一版用深色字画在中等亮度的面板上,取指那块冷灰上几乎看不见。) */
function label(s: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = 'center', bold = true) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px system-ui`; ctx.textAlign = align
  ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(18,12,6,.62)'; ctx.lineWidth = Math.max(2.5, size * .22)
  ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left'
}
/** 时空图/关卡条那类小方块:圆角 + 内亮描边,比纯填色有厚度。 */
function chip(x: number, y: number, w: number, h: number, fill: string, stroke: string, lw = 1.6, r = 5) {
  K.rr(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill()
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; K.rr(x, y, w, h, r); ctx.stroke()
}

/** 上排零件画成真机械件:外壳 + 一条送回执行级的通道 + 名字。 */
function drawTopPart(t: Top, x: number, y: number, w: number, h: number, useful: boolean) {
  K.panel(x, y, w, h, TOP_SKIN[t])
  const cx = x + w / 2, line = TOP_LINE[t]
  if (t === 'wire') { K.channel(x + 14, y + h - 20, cx, y + h - 20, 6, line); K.channel(cx, y + h - 20, cx, y + 16, 6, line); K.chevron(cx, y + 26, 7, line, 2.6) }
  if (t === 'hazard') { K.channel(x + 14, y + h - 20, x + w - 14, y + h - 20, 6, line); K.hub(cx, y + h - 20, 7, line) }
  if (t === 'flush') {   // 作废 = 把路封死:一个红叉
    ctx.strokeStyle = line; ctx.lineWidth = 4; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(cx - 11, y + h - 28); ctx.lineTo(cx + 11, y + h - 14); ctx.moveTo(cx + 11, y + h - 28); ctx.lineTo(cx - 11, y + h - 14); ctx.stroke(); ctx.lineCap = 'butt'
  }
  if (t === 'icache') { K.channel(x + 14, y + h - 20, x + w - 14, y + h - 20, 6, line); K.channel(x + 14, y + h - 32, x + w - 14, y + h - 32, 4, '#2a3a52') }
  label(toolName(t), cx, y + 26, 15, '#fff6e4')
  text(useful ? '' : '接在这里没用', cx, y + h - 6, 10, RED, 'center')
}

function frame() {
  //  你在机器内部 —— 和路由器那台同一张走廊底图,一眼是同一个世界
  K.coverImg(CORR, 0, 0, W, H, 0.78)
  const lv = L(), ref = REF()

  // 关卡条
  for (const b of levelBtns()) {
    const on = b.i === lvl, ul = unlocked(b.i)
    if (on) K.panel(b.x, b.y, b.bw, b.bh, BRASS, 7)
    else chip(b.x, b.y, b.bw, b.bh, ul ? 'rgba(30,24,16,.82)' : 'rgba(18,14,9,.8)', ul ? '#6a5a3a' : '#332c1e', 1.5, 7)
    const cap = `${passed(b.i) ? '✓ ' : ul ? '' : '🔒 '}${b.i}. ${LEVELS[b.i]!.name.replace('真·CPU · ', '').replace('终关 · ', '终关:')}`
    if (on) label(cap, b.x + b.bw / 2, b.y + 21, 12, '#fff6e4')
    else text(cap, b.x + b.bw / 2, b.y + 21, 12, ul ? '#c8bfa8' : '#6a5a3a', 'center')
  }
  text(lv.name, 24, 78, 19, CREAM, 'left', true)
  text(lv.story, 24, 100, 13, '#c8bfa8')
  wrap(lv.hint, 24, 124, W - 48, 19, 2, 13, AMBER)

  // 左栏:程序 / 存储器 / 参考 —— 压在一块底板上,别浮在背景图上
  const leftH = 44 + lv.prog.length * 24 + (lv.mem.length ? 44 : 0) + 46
  K.slab(14, 158, 254, leftH)
  text('程序', 26, 180, 13, DIM)
  lv.prog.forEach((ins, i) => {
    const y = 202 + i * 24
    const active = run?.trace.some(c => c.slots.some(s => s === i))
    text(`${i}`, 28, y, 12, DIM)
    ctx.font = '14px ui-monospace, monospace'; ctx.fillStyle = active ? CREAM : '#7a6f5a'; ctx.fillText(instrText(ins), 50, y)
  })
  let ly = 202 + lv.prog.length * 24 + 14
  if (lv.mem.length) {
    text('数据存储器', 26, ly, 12, DIM)
    text(lv.mem.map((v, i) => `[${i}]=${v}`).join('  '), 26, ly + 20, 13, '#8fb4ff'); ly += 44
  }
  text('参考答案 = 同一段程序顺序执行一遍', 26, ly, 12, DIM)
  text(ref.map((v, i) => `r${i}=${v}`).join('  '), 26, ly + 22, 14, TEAL)

  const g = geo()   // 时空图也要用它的坐标,所以提到分支外面
  // —— 切级关:换一块板 ——
  if (lv.split) {
    const sg = splitGeo(), segs = segWork(sg.ops, cuts), seg = segOf(sg.ops, cuts)
    const tick = Math.max(...segs)
    text('一条指令的组合逻辑 · 在两件事之间下刀(点缝隙)插一个流水寄存器', sg.x0, sg.y0 - 34, 12, DIM)
    sg.ops.forEach((o, i) => {
      const x = sg.x0 + i * (sg.cw + sg.gap), heavy = segs[seg[i]!] === tick
      K.panel(x, sg.y0, sg.cw, sg.ch, STAGE_SKIN[o.role])
      //  工作量画成一根「多长的活」——比只写数字直观:条越长这一段越重
      const bw = (sg.cw - 32) * (o.work / 5)
      K.channel(x + 16, sg.y0 + sg.ch - 13, x + 16 + bw, sg.y0 + sg.ch - 13, 7, heavy ? '#ffcf7a' : 'rgba(20,14,8,.55)')
      label(o.short, x + sg.cw / 2, sg.y0 + 34, 17, '#fff6e4')
      label(o.name, x + sg.cw / 2, sg.y0 + 54, 10, 'rgba(255,246,228,.86)', 'center', false)
      label(`工作量 ${o.work}`, x + sg.cw / 2, sg.y0 + 72, 12, heavy ? '#ffdf9a' : '#fff6e4')
      if (i === 0 || seg[i] !== seg[i - 1]) {
        const w = segs[seg[i]!]!
        text(`第 ${seg[i]! + 1} 段 · 合计 ${w}${w === tick ? ' ←定拍长' : ''}`, x, sg.y0 - 12, 11, w === tick ? AMBER : DIM)
      }
    })
    //  刀口:切了就竖一道黄铜闸(流水寄存器),没切画一条虚线提示可以下刀
    for (let i = 0; i < sg.ops.length - 1; i++) {
      const x = sg.x0 + (i + 1) * sg.cw + i * sg.gap + sg.gap / 2
      if (cuts[i]) {
        K.plate(x - 6, sg.y0 - 4, 12, sg.ch + 8, 3, BRASS)
        K.rivet(x, sg.y0 + 6, 2.2); K.rivet(x, sg.y0 + sg.ch - 6, 2.2)
        text('寄存器', x, sg.y0 + sg.ch + 22, 10, AMBER, 'center', true)
      } else {
        ctx.strokeStyle = '#5a5170'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4])
        ctx.beginPath(); ctx.moveTo(x, sg.y0 - 6); ctx.lineTo(x, sg.y0 + sg.ch + 6); ctx.stroke(); ctx.setLineDash([])
        text('+', x, sg.y0 + sg.ch + 24, 15, '#7a6f8a', 'center', true)
      }
    }
    const cutN = cuts.filter(Boolean).length
    K.slab(sg.x0 - 10, sg.y0 + sg.ch + 34, Math.min(700, W - sg.x0 - 270), 78)
    text(`拍长 = 最重那一段 = ${tick}`, sg.x0, sg.y0 + sg.ch + 60, 14, AMBER, 'left', true)
    if (run) {
      text(`拍数 ${run.cycles}(其中停顿 ${run.trace.filter(c => c.stalled).length})`, sg.x0 + 200, sg.y0 + sg.ch + 60, 14, CREAM)
      const t = totalTime(), okk = resultOk()
      text(`总时间 = ${run.cycles} × ${tick} = ${t}`, sg.x0 + 400, sg.y0 + sg.ch + 60, 15, t <= lv.par.cycles ? TEAL : CREAM, 'left', true)
      text(okk ? (t <= lv.par.cycles ? '✓ 结果对 · 已达目标' : '✓ 结果对 —— 但还能更快') : '✕ 结果错了', sg.x0, sg.y0 + sg.ch + 84, 13, okk ? (t <= lv.par.cycles ? TEAL : AMBER) : RED)
    } else text('按「运行机器」看它跑', sg.x0 + 200, sg.y0 + sg.ch + 60, 13, DIM)
    text(`目标:总时间 ≤ ${lv.par.cycles}   ·   现在切了 ${cutN} 刀 = ${cutN + 1} 段`, sg.x0 + 320, sg.y0 + sg.ch + 84, 12, DIM)
  } else {
  // 机器:上排旁路/冒险检测,下排五级
  text('旁路线 / 冒险检测 / 分支作废 / 指令缓存', g.x0, g.topY - 10, 12, DIM)
  const exSlot = slots.indexOf('ex')
  for (let s = 0; s < NSLOT; s++) {
    const x = g.x0 + s * (g.cw + 10), t = tops[s]
    if (!t) { chip(x, g.topY, g.cw, g.ch, 'rgba(22,17,10,.6)', '#3a3226', 1.5, 9); text('空', x + g.cw / 2, g.topY + g.ch / 2 + 5, 13, '#4a4158', 'center'); continue }
    const useful = t === 'wire' ? (exSlot >= 0 && s > exSlot) : t === 'flush' ? slots[s] === 'ex' : t === 'icache' ? slots[s] === 'if' : slots[s] === 'id'
    drawTopPart(t, x, g.topY, g.cw, g.ch, useful)
  }
  for (let s = 0; s < NSLOT; s++) {
    const x = g.x0 + s * (g.cw + 10), st = slots[s]
    if (!st) { chip(x, g.y0, g.cw, g.ch, 'rgba(22,17,10,.6)', '#3a3226', 1.5, 9); text(`第 ${s + 1} 槽`, x + 10, g.y0 + 18, 11, DIM); text('空', x + g.cw / 2, g.y0 + g.ch / 2 + 6, 14, '#4a4158', 'center'); continue }
    K.panel(x, g.y0, g.cw, g.ch, STAGE_SKIN[st])
    //  一条贯穿的通道:指令就是从这儿流过去的
    //  贯穿通道压在副标下面一点 —— 同一个 y 会把 IF/ID/EX 那行字盖掉
    K.channel(x + 10, g.y0 + g.ch - 11, x + g.cw - 10, g.y0 + g.ch - 11, 6, 'rgba(20,14,8,.5)')
    K.chevron(x + g.cw - 18, g.y0 + g.ch - 11, 7, 'rgba(255,240,210,.55)', 2.4)
    label(`第 ${s + 1} 槽`, x + 10, g.y0 + 18, 11, 'rgba(255,246,228,.8)', 'left', false)
    label(STAGE_NAME[st], x + g.cw / 2, g.y0 + 48, 18, '#fff6e4')
    label(st.toUpperCase(), x + g.cw / 2, g.y0 + 66, 11, 'rgba(255,246,228,.7)', 'center', false)
  }
  if (exSlot >= 0) for (let s = exSlot + 1; s < NSLOT; s++) if (tops[s] === 'wire') { // 旁路线画成一条真的绕回去的线
    const xa = g.x0 + s * (g.cw + 10) + g.cw / 2, xb = g.x0 + exSlot * (g.cw + 10) + g.cw / 2
    ctx.strokeStyle = TEAL; ctx.lineWidth = 3; ctx.beginPath()
    ctx.moveTo(xa, g.topY + g.ch); ctx.lineTo(xa, g.topY + g.ch + 10); ctx.lineTo(xb, g.topY + g.ch + 10); ctx.lineTo(xb, g.y0); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(xb - 5, g.y0 - 8); ctx.lineTo(xb, g.y0); ctx.lineTo(xb + 5, g.y0 - 8); ctx.stroke()
  }
  }   // ← 切级关 / 摆零件关,两块板到此分开

  // 时空图 —— 课本上那张斜梯形,是这台机器自己跑出来的。
  // 起点要**同时**让开机器和左栏:左栏会随指令条数/有没有存储器面板变高,写死就会被压上。
  const ty = Math.max(g.y0 + g.ch + (lv.split ? 128 : 46), ly + 56)
  text(`时空图(每一拍,哪条指令在哪一${lv.split ? '段' : '级'};红=被停顿卡住,紫色划掉=被分支作废${lv.split ? '' : ',蓝色拍号=取指抢不到存储器'})`, 24, ty - 12, 13, DIM)
  if (run) {
    const cwid = Math.min(52, (W - 80) / Math.max(1, run.trace.length)), rh = 28
    K.slab(14, ty - 2, Math.min(W - 28, 56 + run.trace.length * cwid + 12), lv.prog.length * rh + 34)
    lv.prog.forEach((_, i) => {
      text(`#${i}`, 26, ty + 20 + i * rh, 12, DIM)
      run!.trace.forEach((c, t) => {
        const s = c.slots.indexOf(i); if (s < 0) return
        const st = slots[s], x = 56 + t * cwid
        const held = c.stalled && s <= (lv.split ? layoutFromCuts(lv.split.ops, cuts).idS : slots.indexOf('id'))
        const killed = !!c.killed?.includes(i)   // 这一拍被分支作废划掉:它到此为止,后面不再出现
        chip(x, ty + 4 + i * rh, cwid - 4, rh - 6,
          killed ? '#2a1030' : held ? '#3a2118' : '#1c2a42',
          killed ? '#c07adf' : held ? RED : '#4a6fb0')
        text(lv.split ? `${s + 1}段` : st ? STAGE_NAME[st] : '·', x + (cwid - 4) / 2, ty + 22 + i * rh, 12, killed ? '#e0bfff' : CREAM, 'center')
        if (killed) { // 真的划一道:走错路取进来的,当场废掉
          ctx.strokeStyle = '#e07adf'; ctx.lineWidth = 2; ctx.beginPath()
          ctx.moveTo(x + 3, ty + rh - 5 + i * rh); ctx.lineTo(x + cwid - 7, ty + 7 + i * rh); ctx.stroke()
        }
      })
    })
    //  抢门那几拍:取指级空着,所以时空图里没有格子画得出来 —— 在拍号那一行标出来
    run.trace.forEach((c, t) => {
      const cx = 56 + t * cwid + (cwid - 4) / 2, cy = ty + 4 + lv.prog.length * rh + 14
      if (c.jam) { ctx.fillStyle = '#1d3350'; ctx.fillRect(56 + t * cwid, cy - 12, cwid - 4, 16) }
      text(String(t + 1), cx, cy, 11, c.jam ? '#9ec2ff' : DIM, 'center', !!c.jam)
    })
    if (run.jams) text(`蓝色 ${run.jams} 拍 = 取指跟访存抢同一个存储器,取指让了一拍`, 56, ty + 4 + lv.prog.length * rh + 34, 11, '#9ec2ff')
  } else text(machineOk() ? '按「运行机器」看它跑' : '五级还没摆齐(取指/译码/执行/访存/写回,一个都不能少)', 56, ty + 24, 14, machineOk() ? DIM : RED)

  // 右栏:寄存器 实际 vs 参考
  const rx = W - 250
  K.slab(rx - 16, 158, 236, 250)
  text('寄存器终值', rx, 180, 13, DIM)
  for (let i = 0; i < NREG; i++) {
    const y = 206 + i * 26, got = run ? run.regs[i]! : null, want = ref[i]!
    text(`r${i}`, rx, y, 14, DIM)
    ctx.font = '15px ui-monospace, monospace'
    ctx.fillStyle = got === null ? '#4a4158' : got === want ? TEAL : RED
    ctx.fillText(got === null ? '—' : String(got), rx + 34, y)
    text(`应为 ${want}`, rx + 96, y, 12, DIM)
  }
  //  切级关的单位不一样:件→刀、拍→总时间。共用一套字段但**显示要跟着换**,不然读数在骗人。
  const sp2 = lv.split
  text(sp2 ? `目标 ≤${lv.par.parts} 刀 · 总时间 ≤${lv.par.cycles}` : `目标 ≤${lv.par.parts} 件 · ≤${lv.par.cycles} 拍`, rx, 326, 12, DIM)
  if (run) {
    const okk = resultOk()
    const used = sp2 ? cuts.filter(Boolean).length : partCount()
    const score = sp2 ? totalTime() : run.cycles
    const mp = used <= lv.par.parts, mc = score <= lv.par.cycles
    text(okk ? '✓ 结果对了' : run.overrun ? '✕ 机器空转(五级摆得不成样子)' : '✕ 有寄存器读到了旧值', rx, 352, 16, okk ? TEAL : RED, 'left', true)
    text(sp2 ? `总时间 ${score} · 切了 ${used} 刀${okk ? `  ${mp ? '🏅省刀 ' : ''}${mc ? '🏅最快' : ''}` : ''}`
      : `用了 ${score} 拍 · ${used} 件${okk ? `  ${mp ? '🏅省料 ' : ''}${mc ? '🏅飞快' : ''}` : ''}`, rx, 374, 13, CREAM)
    const stalls = run.trace.filter(c => c.stalled).length
    text(stalls || run.jams ? `停顿 ${stalls} 拍${sp2 ? '' : ` · 抢门 ${run.jams} 拍`}` : '一拍都没停', rx, 394, 12, stalls || run.jams ? AMBER : TEAL)
  }

  // 零件盘
  const T = trayGeo(), items = isSplit() ? [] : levelTools()   // 切级关不摆零件,盘子就别画了
  text(isSplit() ? '这一关不摆零件 —— 点微操作之间的缝隙下刀(再点一下撤销)' : `零件盘 · 点一个,再点槽位放下${tool === 'wire' ? '(旁路线放在结果已经出炉的那一级上方)' : tool === 'hazard' ? '(冒险检测放在译码级上方)' : tool === 'flush' ? '(分支作废放在执行级上方 —— 分支在哪一级判出跳不跳,就装在哪一级)' : tool === 'icache' ? '(指令缓存放在取指级上方 —— 让取指有自己的存储器,不用再跟访存抢)' : ''}`, T.x0, T.y - 10, 12, AMBER)
  if (items.length) {
    ctx.fillStyle = 'rgba(30,24,16,.6)'; ctx.fillRect(T.x0 - 6, T.y - 4, (T.ts + T.gap) * items.length + 6, T.ts + 8)
    items.forEach((t, i) => {
      const x = T.x0 + i * (T.ts + T.gap), on = tool === t
      const skin = t === 'erase' ? STEEL : (['wire', 'hazard', 'flush', 'icache'] as Tool[]).includes(t) ? TOP_SKIN[t as Top] : STAGE_SKIN[t as Stage]
      K.panel(x, T.y, T.ts, T.ts, skin, 8)
      if (t === 'erase') {
        ctx.strokeStyle = RED; ctx.lineWidth = 3.5; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(x + 26, T.y + 22); ctx.lineTo(x + T.ts - 26, T.y + T.ts - 34)
        ctx.moveTo(x + T.ts - 26, T.y + 22); ctx.lineTo(x + 26, T.y + T.ts - 34); ctx.stroke(); ctx.lineCap = 'butt'
      }
      label(toolName(t), x + T.ts / 2, T.y + T.ts - 10, 12, '#fff6e4')
      if (on) { ctx.strokeStyle = '#ffe6a8'; ctx.lineWidth = 3; K.rr(x - 2, T.y - 2, T.ts + 4, T.ts + 4, 9); ctx.stroke() }
    })
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
;(window as unknown as Win).__cpuTexts = () => LEVELS.flatMap(l => [l.name, l.story, l.hint])
;(window as unknown as Win).__cpuPlay = (i: number) => { loadLevel(i); return { prog: L().prog.map(instrText), mem: L().mem, ref: REF(), parts: L().parts, par: L().par } }
;(window as unknown as Win).__cpuSet = (st: (Stage | null)[], tp: (Top | null)[]) => { slots = [...st]; tops = [...tp]; run = null }
;(window as unknown as Win).__cpuCuts = (cs: boolean[]) => { cuts = [...cs]; run = null }
;(window as unknown as Win).__cpuRun = () => { doRun(); return run ? { regs: run.regs, ref: REF(), cycles: run.cycles, stalls: run.trace.filter(c => c.stalled).length, jams: run.jams, overrun: run.overrun, ok: resultOk(), parts: partCount(), tick: tickLen(), time: totalTime(), segs: L().split ? segWork(L().split!.ops, cuts) : [] } : null }
