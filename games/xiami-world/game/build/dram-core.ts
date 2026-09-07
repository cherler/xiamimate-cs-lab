/**
 * 「搭机器」第六台设备 · 内存条(DRAM 控制器)—— 纯内核,零 DOM。
 *
 * 又是从一条物理事实长出来的:
 *   **DRAM 的存储单元排成一行一行的。要读其中一个字,得先把它所在的**整行**「激活」出来
 *   搬进行缓冲(ACT),才能取那个字(CAS);想换一行,还得先把当前这行关掉(PRE)。**
 * 于是同一行的连续访问只花一次 CAS(行命中),换行则要 PRE+ACT+CAS(行冲突)—— 差三倍。
 *
 * 关卡就是这条事实的连锁反应:
 *   行命中 → 关页反而更快(没有局部性时)→ 多个 bank 并行 → 地址怎么切(bank 交织)→
 *   调度器把同一行的凑一起 → 可重排会读错 → 终关
 *
 * ── 焊死的口径 ──
 * 参考解释器 `runInOrder`:请求**按到达顺序**一个个做,读永远返回最后写进去的值。
 * 你搭的控制器可以重排请求(那正是它变快的办法),但每一次读读到的值必须和参考一模一样。
 *
 * ⚠️ 这台和固态硬盘一样,**真的会读错**:调度器为了凑行命中,可能把一个读提到同地址的写前面。
 * 真控制器靠「同地址不许重排」挡住这件事 —— 那就是本作里的〈内存序保护〉。
 */

export type Req = { op: 'r' | 'w'; a: number }

/**
 * DRAM 时序,单位取真芯片的量级(tRCD/tCL/tRP 都在十几个 ns 上下,这里就用 15)。
 * turn = 总线掉头:数据总线刚才在往外读、这会儿要往里写,得留出一段空档(真芯片的 tWTR/tRTW)。
 */
export const T = { act: 15, cas: 15, pre: 15, turn: 20 }
/** 写缓冲攒到几条就一次排干净。 */
export const WQ_DEPTH = 4

/** 一行有 2^COLBITS 个字。真条子一行几 KB,这里缩到 16 个字,画得下也数得清。 */
export const COLBITS = 4
export const NBITS = 12          // 地址 12 位(4096 个字)

export type Cfg = {
  /** 几个 bank。不同 bank 各有各的行缓冲,激活可以重叠着来。 */
  banks: number
  /**
   * bank 位从地址的哪一头取。
   *   'low'  = 紧挨着列号(交织):相邻的行落到不同 bank,顺序流能摊开
   *   'high' = 取最高几位:一大片连续地址全压在同一个 bank 上
   */
  bankBits: 'low' | 'high'
  /** 调度器往后看几个请求(1 = 不重排,老老实实按到达顺序)。 */
  window: number
  /**
   * 取完数之后那一行留着还是关掉。
   *   'open'   = 留着(开页):下次还落在同一行就只要一个 CAS
   *   'closed' = 关掉(关页):顺手自动预充电,下次固定 ACT+CAS,再也没有行命中
   * ⚠️ 它是个**旋钮,不是零件**:没有哪一档「装上就好」,得看这段访存有没有局部性。
   * 做成布尔零件的话总有一关的正解是「什么都别装」—— 开局状态直接达标,玩家没事可做。
   */
  page: 'open' | 'closed'
  sched: boolean
  /** 写缓冲:把写攒起来批量排掉,省下总线来回掉头的空档。 */
  wbuf: boolean
  /** 写回读转发:读之前先翻一眼写缓冲里有没有它 —— 没有这一步就会读到旧值。 */
  fwd: boolean
}
export type Part = 'sched' | 'wbuf' | 'fwd'

export type DramRun = {
  /**
   * 每次读读到了什么 —— **按请求发出的顺序排**,不是按控制器服务的顺序。
   *
   * ⚠️ 第一版按服务顺序 push,于是控制器只要重排,这个数组的顺序就变了,
   * 哪怕每个读拿到的值都对也会被判成「读错」—— 整条对错轴当场变成噪音,
   * 连「纯读之间的重排」都判红。可 CPU 发出的是第 k 个读,它等的就是第 k 个读的值,
   * 控制器什么时候去做那是控制器的事。所以必须按请求下标归位。
   */
  reads: number[]
  time: number
  hits: number; conflicts: number; empties: number
  /** 被调度器提到前面去的请求数 —— 重排真的发生了没有。 */
  reordered: number
  /** 总线掉头了几次(每次都是一段白等的空档)。 */
  turns: number
  /** 有几次读,要的东西正躺在写缓冲里还没排下去 —— 没有转发的话,这几次全读到旧值。 */
  hazards: number
  /** 每个 bank 忙了多久(画 bank 并行度用)。 */
  busy: number[]
  /**
   * 逐条记录:第几个请求、落在哪个 bank / 哪一行、是命中还是冲突、什么时候做的。
   * bankStart 是这个 bank 开始为它忙活的时刻(要先 PRE/ACT),start 才是真正取数那一下 ——
   * 两者之间那段就是「开销」,画出来一眼看得见行命中省掉了什么。
   */
  timeline: { i: number; op: 'r' | 'w'; bank: number; row: number; kind: 'hit' | 'conflict' | 'empty'; bankStart: number; start: number; end: number }[]
}

export const wval = (i: number) => 1000 + i
const log2 = (n: number) => Math.round(Math.log2(n))

/** 地址切三段:[ row | bank | col ] 或 [ bank | row | col ] —— 这一刀切在哪儿,并行度天差地别。 */
export function decode(a: number, cfg: Cfg) {
  const bb = log2(cfg.banks)
  if (bb === 0) return { bank: 0, row: a >> COLBITS, col: a & ((1 << COLBITS) - 1) }
  if (cfg.bankBits === 'low')
    return { bank: (a >> COLBITS) & (cfg.banks - 1), row: a >> (COLBITS + bb), col: a & ((1 << COLBITS) - 1) }
  return {
    bank: (a >> (NBITS - bb)) & (cfg.banks - 1),
    row: (a >> COLBITS) & ((1 << (NBITS - COLBITS - bb)) - 1),
    col: a & ((1 << COLBITS) - 1),
  }
}

/** 参考答案:请求按到达顺序一个个做。 */
export function runInOrder(reqs: Req[]) {
  const mem = new Map<number, number>(), reads: number[] = []
  reqs.forEach((q, i) => {
    if (q.op === 'w') mem.set(q.a, wval(i))
    else reads.push(mem.get(q.a) ?? q.a)
  })
  return reads
}

/**
 * 你搭的那个控制器跑一遍。
 *
 * 时间是这么算的:每个 bank 有自己的「忙到什么时候」,PRE/ACT 在各自 bank 上走,**可以互相重叠**;
 * 但取数那一下(CAS)要占公共的数据总线,只能排队。多 bank 的好处全在前一半 —— 这就是真机器的样子。
 */
export function runDram(reqs: Req[], cfg: Cfg): DramRun {
  const nb = cfg.banks
  const openRow = new Array<number>(nb).fill(-1)
  const bankFree = new Array<number>(nb).fill(0)
  const busy = new Array<number>(nb).fill(0)
  let bus = 0
  const mem = new Map<number, number>()
  const out: DramRun = { reads: [], time: 0, hits: 0, conflicts: 0, empties: 0, reordered: 0, turns: 0, hazards: 0, busy, timeline: [] }
  //  第几个请求 → 它是第几个读(按发出顺序)。读到的值要归到这个位置上去
  const readSlot = new Map<number, number>()
  { let k = 0; reqs.forEach((q, i) => { if (q.op === 'r') readSlot.set(i, k++) }) }
  out.reads = new Array<number>(readSlot.size).fill(0)

  /** 还没做的请求,按到达顺序排着。 */
  const queue = reqs.map((q, i) => ({ ...q, i }))
  /** 写缓冲:被挪出主队列、还没真正写下去的那些写。 */
  type Pend = { op: 'r' | 'w'; a: number; i: number }
  const wq: Pend[] = []
  let lastOp: 'r' | 'w' | null = null

  /*  装了〈写缓冲〉:写不占主队列的位置,先攒着 —— 读就能一路往下走,不用为了一条写让总线掉一次头。
      攒到 WQ_DEPTH 条(或者读全做完了)再一次性排干净,那一整批只掉一次头。 */
  const drainDue = () => cfg.wbuf && (wq.length >= WQ_DEPTH || queue.every(q => q.op === 'w'))

  while (queue.length || wq.length) {
    if (cfg.wbuf) {
      //  把队首的写挪进写缓冲(不占服务位),直到队首是个读为止
      while (queue.length && queue[0]!.op === 'w' && wq.length < WQ_DEPTH) wq.push(queue.shift()!)
      if (!queue.length && !wq.length) break
    }
    //  该排写缓冲了(攒够了,或者读已经做完了),就把它整批排掉 —— 只掉一次头
    const fromWq = cfg.wbuf && (drainDue() || !queue.length)
    const pool = fromWq ? wq : queue
    const w = cfg.sched && !fromWq ? Math.min(cfg.window, pool.length) : 1
    let pickIdx = 0
    if (w > 1) {
      /*  FR-FCFS:在往后看的那几个里,优先挑「正好命中某个 bank 当前打开的那一行」的 ——
          它只要一次 CAS,最便宜。挑不到就还是做最老的那个。 */
      for (let k = 0; k < w; k++) {
        const q = pool[k]!
        const d = decode(q.a, cfg)
        if (openRow[d.bank] !== d.row) continue
        /*  ⚠️ 越过前面的请求之前得先问一句:前面有没有**同一个地址**的请求?
            有的话把它提前就等于把读写顺序换了 —— 读会读到还没被覆盖的旧值。
            真控制器就是靠这条挡住的;本作把它做成〈内存序保护〉,不装就真的会读错。 */
        pickIdx = k; break
      }
    }
    if (pickIdx > 0) out.reordered++
    const q = pool.splice(pickIdx, 1)[0]!
    const d = decode(q.a, cfg)

    const kind = openRow[d.bank] === d.row ? 'hit' : openRow[d.bank]! < 0 ? 'empty' : 'conflict'
    const pre = kind === 'conflict' ? T.pre : 0
    const act = kind === 'hit' ? 0 : T.act
    //  PRE/ACT 在自己 bank 上走(和别的 bank 重叠),CAS 要抢公共的数据总线
    const bankStart = bankFree[d.bank]!
    const ready = bankStart + pre + act
    //  总线刚才在读、这会儿要写(或者反过来),中间得留一段空档
    const turn = lastOp !== null && lastOp !== q.op ? T.turn : 0
    if (turn) out.turns++
    lastOp = q.op
    const start = Math.max(ready, bus + turn)
    const end = start + T.cas
    bus = end; bankFree[d.bank] = end
    busy[d.bank] = busy[d.bank]! + pre + act + T.cas
    out.time = Math.max(out.time, end)
    if (kind === 'hit') out.hits++; else if (kind === 'conflict') out.conflicts++; else out.empties++
    out.timeline.push({ i: q.i, op: q.op, bank: d.bank, row: d.row, kind, bankStart, start, end })

    if (q.op === 'w') mem.set(q.a, wval(q.i))
    else {
      /*  ⚠️ 这台机器唯一会读错的地方。
          写缓冲里可能正躺着一条**对同一个地址**的、还没排下去的写 —— 内存里还是旧值。
          装了〈写回读转发〉就先翻一眼缓冲、把最新那条的值直接给出去;
          不装的话就老老实实去读内存 —— 读到的是旧的。真控制器必须做这一步。 */
      const pendW = [...wq].reverse().find(e => e.a === q.a)
      if (pendW) out.hazards++
      out.reads[readSlot.get(q.i)!] = pendW && cfg.fwd ? wval(pendW.i) : (mem.get(q.a) ?? q.a)
    }

    /*  没装〈开页策略〉= 关页:取数命令一发出去就顺带把这一行关掉(真芯片的「自动预充电」),
        那次 PRE 是**和数据往外传的那一段重叠着做完的**,所以不占这个 bank 后面的时间。
        于是每次访问固定 ACT+CAS = 30;而开页碰上换行要 PRE+ACT+CAS = 45、碰上同行只要 CAS = 15。
        → 有局部性开页赚,东一榔头西一棒子关页赚。这就是真控制器要做的那个选择。

        ⚠️ 「PRE 藏在传输里」是本作的简化,但少了它这一关就不存在:第一版把 PRE 记在
        bank 时间线上(bankFree = end + PRE),那么开页 PRE+ACT、关页 ACT 再补一个 PRE,
        两条路的每次访问都是 45 —— **开页和关页在算式上一模一样**,跑出来的数字分毫不差。 */
    if (cfg.page === 'closed') { openRow[d.bank] = -1 }
    else openRow[d.bank] = d.row
  }
  return out
}

/** 你的控制器读到的,和「按到达顺序一个个做」是不是同一串值。 */
export function sameAsInOrder(reqs: Req[], r: DramRun) {
  const ref = runInOrder(reqs)
  return ref.length === r.reads.length && ref.every((v, i) => v === r.reads[i])
}

// —— 关卡 ——
export type Level = {
  name: string; short: string; story: string; hint: string
  reqs: Req[]
  /** 页策略的档位。**第一档是开局的默认值** —— 一律摆那个「天真的选择」,别把正解摆在开局。 */
  pageOpts: Cfg['page'][]
  bankOpts: number[]
  bankBitOpts: Cfg['bankBits'][]
  winOpts: number[]
  parts: Part[]
  par: { time: number }
  finale?: boolean
}

const R = (a: number): Req => ({ op: 'r', a })
const Wq = (a: number): Req => ({ op: 'w', a })
const rep = <T,>(n: number, f: (k: number) => T[]) => Array.from({ length: n }, (_, k) => f(k)).flat()
/** 一行 16 个字,所以「跨一行」就是 +16。 */
const ROW = 1 << COLBITS

export const LEVELS: Level[] = [
  {
    name: '真·内存条 · 先把整行搬出来',
    short: '行命中',
    story: '要读一个字,得先把它所在的一整行激活出来。好消息是:接着读同一行的邻居,就不用再激活了。',
    hint: '这一关顺着读一整行里的 16 个字。把页策略拨到「开页」:取完一个字之后把这一行留在行缓冲里开着,后面 15 次访问都落在同一行 —— 每次只要一个 CAS,不用再 ACT。拨到「关页」的话取完就关,下一次哪怕还是同一行也得重新激活一遍。盯着「行命中」那个读数。',
    reqs: Array.from({ length: 16 }, (_, i) => R(i)),
    pageOpts: ['closed', 'open'], bankOpts: [1], bankBitOpts: ['low'], winOpts: [1], parts: [],
    par: { time: 255 },
  },
  {
    name: '真·内存条 · 关页反而更快',
    short: '关页',
    story: '两个地址在同一个 bank 的不同两行上来回读 —— 开着的那一行每次都得先关掉。',
    hint: '⚠️ 这一关会推翻上一关的结论,而这正是真控制器要面对的那个选择。开页只有在「下一次还落在同一行」的时候才赚;这一段访存在两行之间来回,每次都是行冲突:PRE 关掉当前行、ACT 激活新行、再 CAS —— 关掉那一下就卡在关键路径上。把页策略拨到关页:取完数的同时顺手预充电(真芯片的自动预充电),那一下和数据往外传的那段重叠着做完了,下次固定 ACT+CAS。所以它是个旋钮不是零件,得看这段访存长什么样。',
    //  开局摆的就是上一关刚学会的「开页」—— 这一关它恰恰是错的
    reqs: rep(14, () => [R(0), R(1024)]),
    pageOpts: ['open', 'closed'], bankOpts: [1], bankBitOpts: ['low'], winOpts: [1], parts: [],
    par: { time: 840 },
  },
  {
    name: '真·内存条 · 多来几个 bank',
    short: 'bank 并行',
    story: '一个 bank 忙着激活的时候,别的 bank 可以同时激活自己的行 —— 挤在一个 bank 上就只能排队。',
    hint: '真条子里有好几个 bank,每个 bank 有自己的行缓冲和自己的时序。激活(ACT)和预充电(PRE)是各干各的,可以重叠;只有取数那一下(CAS)要抢公共的数据总线。所以两股数据流如果落在不同 bank 上,前半截的时间就藏起来了。这一关两股流的地址正好隔着一行,把 bank 数调上去 —— 它们会被分到不同 bank 上。',
    reqs: rep(16, () => [R(0), R(ROW), R(1), R(ROW + 1)]),
    pageOpts: ['open', 'closed'], bankOpts: [1, 2, 4], bankBitOpts: ['low'], winOpts: [1], parts: [],
    par: { time: 975 },
  },
  {
    name: '真·内存条 · bank 位切在哪儿',
    short: '地址交织',
    story: 'bank 号是从地址里取几位算出来的。取低位,连续的行摊到各个 bank;取高位,一大片地址全压在一个 bank 上。',
    hint: '你在路由器那台切过网络号、在 Cache 那台切过 tag/index —— 这回切的是 bank。这一段访存一行一行地往下走(每次跨一整行)。把 bank 位取在紧挨着列号的位置(交织),相邻的行就轮流落到不同 bank,一路摊开;取在最高位,那这几十行全在同一个 bank 里,bank 加得再多也是摆设。两种切法都试一遍,看 bank 忙碌条的差别。',
    //  开局摆的是「取高位」—— 看着也是四个 bank,其实全压在一个上
    reqs: Array.from({ length: 32 }, (_, i) => R(i * ROW)),
    pageOpts: ['open', 'closed'], bankOpts: [4], bankBitOpts: ['high', 'low'], winOpts: [1], parts: [],
    par: { time: 495 },
  },
  {
    name: '真·内存条 · 把同一行的凑一起',
    short: '调度器',
    story: '请求是乱着来的。可要是往后多看几个,把落在已经打开那一行上的先做了,就能省下一堆开关行的钱。',
    hint: '真控制器不会死板地按到达顺序做。它有一个请求队列,每次挑的是「正好命中某个 bank 当前开着那一行」的那个 —— 这叫 FR-FCFS(行命中优先)。装上〈调度器〉并把往后看的窗口调大,交错着来的请求就会被重新拢成一簇一簇的同行访问,行命中率立刻上去。',
    reqs: rep(12, k => [R(k), R(512 + k), R(k + 1), R(512 + k + 1)]),
    pageOpts: ['open', 'closed'], bankOpts: [1, 2], bankBitOpts: ['low'], winOpts: [1, 4, 8, 16], parts: ['sched'],
    par: { time: 795 },
  },
  {
    name: '真·内存条 · 写攒起来,读就绕过去了',
    short: '写缓冲',
    story: '数据总线刚往外读完又要往里写,中间得空一拍。于是控制器把写攒起来批量排 —— 可读就绕到写前面去了。',
    hint: '总线掉一次头是要空档的(真芯片的 tWTR/tRTW)。读写一条条交替着来,那一路全在掉头。真控制器的办法是装〈写缓冲〉:写先攒着不占服务位,读一路往下走,攒够一批再一次性排干净 —— 一整批只掉一次头。⚠️ 但这就出事了:一条读要的地址,可能正躺在写缓冲里还没排下去,内存里还是旧的。装上〈写回读转发〉,读之前先翻一眼缓冲、把最新那条的值直接给出去。不装的话,光看时间你会以为自己赢了 —— 底下那行「读到的值对不对」会告诉你真相。',
    reqs: rep(10, k => [Wq(k), R(512 + k), R(k), Wq(512 + k), R(512 + k)]),
    pageOpts: ['open', 'closed'], bankOpts: [1, 2], bankBitOpts: ['low'], winOpts: [1, 4], parts: ['sched', 'wbuf', 'fwd'],
    par: { time: 1655 },
  },
  {
    name: '终关 · 一段真程序的访存流',
    short: '终关',
    story: '一段顺着走的、一段来回跳的、还夹着读写配对 —— 一条内存总线上跑的就是这个。',
    hint: '把学过的全用上:页策略在有局部性的那一段要拨到开页、bank 数和 bank 位的切法决定几股流能不能摊开、〈调度器〉把同一行的凑到一起、〈写缓冲〉省下总线来回掉头的空档、〈写回读转发〉保证攒着写的时候读不到旧值。结果必须和「按到达顺序一个个做」一模一样,比的是总时间。',
    reqs: [
      ...Array.from({ length: 16 }, (_, i) => R(i)),                 // 顺着走:吃行命中
      ...rep(8, () => [R(0), R(2048)]),                              // 来回跳:行冲突
      ...rep(6, k => [Wq(k), R(1024 + k), R(k)]),                    // 读写交替:总线掉头 + 写缓冲的 hazard
      ...Array.from({ length: 12 }, (_, i) => R(i * ROW)),           // 一行一行走:吃 bank 交织
    ],
    pageOpts: ['open', 'closed'], bankOpts: [1, 2, 4], bankBitOpts: ['high', 'low'], winOpts: [1, 4, 8, 16],
    parts: ['sched', 'wbuf', 'fwd'],
    par: { time: 1205 }, finale: true,
  },
]

// —— 穷举 ——
export type Combo = { cfg: Cfg; time: number; hits: number; conflicts: number; reordered: number; turns: number; hazards: number; ok: boolean }
export function allConfigs(L: Level): Cfg[] {
  const out: Cfg[] = []
  const bools = (p: Part) => L.parts.includes(p) ? [false, true] : [false]
  for (const banks of L.bankOpts)
    for (const bankBits of L.bankBitOpts)
      for (const window of L.winOpts)
        for (const page of L.pageOpts)
          for (const sched of bools('sched'))
            for (const wbuf of bools('wbuf'))
              for (const fwd of bools('fwd')) {
                if (banks === 1 && bankBits !== L.bankBitOpts[0]) continue   // 只有一个 bank,切法没意义
                if (!sched && window !== L.winOpts[0]) continue              // 不重排,窗口大小没意义
                if (sched && window === 1) continue                         // 窗口 1 等于没装调度器
                if (!wbuf && fwd) continue                                  // 没有写缓冲就没什么可转发的
                out.push({ banks, bankBits, window, page, sched, wbuf, fwd })
              }
  return out
}
export function sweep(L: Level): Combo[] {
  return allConfigs(L).map(cfg => {
    const r = runDram(L.reqs, cfg)
    return { cfg, time: r.time, hits: r.hits, conflicts: r.conflicts, reordered: r.reordered, turns: r.turns, hazards: r.hazards, ok: sameAsInOrder(L.reqs, r) }
  })
}
