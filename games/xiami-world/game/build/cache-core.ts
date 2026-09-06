/**
 * 「搭机器」第三台设备 · Cache(内存层级)—— **纯内核,零 DOM**。
 *
 * 为什么单独一个文件:前两台(路由器 / CPU)的仿真长在页面模块里,node 里 import 不起来,
 * 所有穷举判据只好隔着 playwright 打页面钩子 —— 慢,而且「判据测的到底是不是页面在用的那份」
 * 要靠约定。这台反过来:**内核在这儿,页面 import 它**。于是
 *   · node 能直接 import 跑穷举(tests/cache-core.test.ts,进 npm test,秒级);
 *   · playwright 那份判据只负责证明「页面用的确实是这份内核」(钩子跑出来的数一致)。
 *
 * ── 焊死的口径 ──
 * 参考解释器 `runFlat`:**不要 cache,直接对内存跑一遍**这串访存,记下每次 load 读到什么、
 * 最后内存是什么样。你搭的 cache(`runCache`)必须一字不差地给出同一组答案。
 *
 * 这台机器和前两台有个**根本不同,而且这正是要教的那句话**:
 *   **cache 是透明的 —— 无论你怎么配,结果永远对。你在调的是时间,不是答案。**
 * 所以这里的关卡全考「快不快」(周期数),不考「对不对」;而「对不对」变成了**引擎自检**:
 * 穷举所有配置 × 所有关卡,结果必须全部等于参考。脏块忘了刷、写分配漏了写 —— 都栽在这条上。
 *
 * ── 成本模型(简化,但量级取自真机器)──
 * 命中 1 拍;缺失几十拍,且**跟块大小走**(要把一整块搬过来)—— 有这一项,块才不会「越大越好」。
 */

export type Access = { op: 'ld' | 'st'; a: number }
/** 玩家搭出来的那台 cache:两刀切地址(offset/index 各几位)+ 路数 + 三个可选零件。 */
export type Cfg = { ob: number; ib: number; ways: number; lru: boolean; wb: boolean; pf: boolean }

/** 一次访存要花多少拍。写在一处,页面和判据读同一份 —— 别在两边各抄一遍。 */
export const COST = {
  hit: 1,
  missFix: 12, missPerWord: 2,   // 缺失 = 固定延迟 + 搬一整块(块越大搬得越久)
  writeThru: 8,                  // 写直达:每次 store 都打到内存
  wbFix: 10, wbPerWord: 2,       // 换出脏块:把一整块写回去
  pfFix: 4, pfPerWord: 1,        // 预取搭车:和当前那次缺失的传输重叠,所以比一次真缺失便宜
}
export const missCost = (B: number) => COST.missFix + COST.missPerWord * B
export const wbCost = (B: number) => COST.wbFix + COST.wbPerWord * B
export const pfCost = (B: number) => COST.pfFix + COST.pfPerWord * B

/** 内存初值 = 地址本身(确定性,省得再写一张表);store 写进去的值 = 1000 + 第几次访问。 */
export const initWord = (a: number) => a
export const stVal = (i: number) => 1000 + i

/** 参考答案:没有 cache,一次一个字地读写内存。 */
export function runFlat(trace: Access[]) {
  const mem = new Map<number, number>()
  const loads: number[] = []
  trace.forEach((t, i) => {
    if (t.op === 'ld') loads.push(mem.has(t.a) ? mem.get(t.a)! : initWord(t.a))
    else mem.set(t.a, stVal(i))
  })
  return { loads, mem }
}

type Line = { blk: number; dirty: boolean; data: number[]; t: number }

export type CacheRun = {
  loads: number[]; mem: Map<number, number>
  hits: number; misses: number; wbacks: number; prefetched: number
  cycles: number
  /** 每次访问是不是命中 —— 画时空条用。 */
  hitSeq: boolean[]
  /** 跑完之后 cache 里躺着什么(每组每路的块号,-1 = 空)—— 页面把阵列画出来用。 */
  snapshot: { blk: number; dirty: boolean }[][]
}

/**
 * 你搭的那台机器跑一遍。
 *
 * 地址切法(**和路由器那台的子网掩码是同一个动作**):
 *   [ ─── tag ─── | ─ index ─ | offset ]
 *   offset 位数 = 右刀右边的位数 → 块大小 B = 2^ob(一块里有几个字)
 *   index  位数 = 两刀之间     → 组数   S = 2^ib
 *   剩下的全是 tag。容量 = B × S × 路数。
 */
export function runCache(trace: Access[], cfg: Cfg): CacheRun {
  const B = 1 << cfg.ob, S = 1 << cfg.ib, ways = cfg.ways
  const mem = new Map<number, number>()
  const rd = (a: number) => mem.has(a) ? mem.get(a)! : initWord(a)
  const sets: Line[][] = Array.from({ length: S }, () =>
    Array.from({ length: ways }, () => ({ blk: -1, dirty: false, data: [], t: 0 })))
  let clock = 0
  const out: CacheRun = { loads: [], mem, hits: 0, misses: 0, wbacks: 0, prefetched: 0, cycles: 0, hitSeq: [], snapshot: [] }

  const flush = (l: Line) => { for (let k = 0; k < B; k++) mem.set(l.blk * B + k, l.data[k]!) }
  /**
   * 把某块装进它该在的那一组;组满了就按策略挑一个踢出去(脏的要先写回)。
   * `keep` 是「这一行不许动」—— 预取用得着:**绝不能把刚为当前访问搬回来的那块顶掉**。
   * 顶掉了会怎样?那条 store 就写在一块已经不在 cache 里的数据上,写丢了。
   * (真硬件也不会这么干:要么预取进单独的缓冲,要么替换逻辑跳过刚填的那行。)
   */
  const install = (blk: number, keep?: Line): Line | null => {
    const set = sets[blk & (S - 1)]!
    const cand = set.filter(l => l !== keep)
    if (!cand.length) return null                       // 一路 cache 且同组 —— 这次预取只能作罢
    let line = cand.find(l => l.blk < 0)
    if (!line) {
      //  挑 t 最小的踢。**LRU 和 FIFO 的差别只在 t 什么时候更新**:
      //  装进来时都记一次(那就是 FIFO 的「进入顺序」);装了〈LRU〉的机器命中时再记一次。
      line = cand[0]!; for (const l of cand) if (l.t < line.t) line = l
    }
    if (line.blk >= 0 && line.dirty) { flush(line); out.cycles += wbCost(B); out.wbacks++ }
    const data: number[] = []
    for (let k = 0; k < B; k++) data.push(rd(blk * B + k))
    line.blk = blk; line.dirty = false; line.data = data; line.t = ++clock
    return line
  }

  trace.forEach((t, i) => {
    const blk = t.a >> cfg.ob, off = t.a & (B - 1)
    const found = sets[blk & (S - 1)]!.find(l => l.blk === blk)
    const hit = !!found
    let line: Line
    if (found) { out.hits++; out.cycles += COST.hit; if (cfg.lru) found.t = ++clock; line = found }
    else { out.misses++; out.cycles += missCost(B); line = install(blk)! }
    out.hitSeq.push(hit)

    if (t.op === 'ld') out.loads.push(line.data[off]!)
    else {
      line.data[off] = stVal(i)
      //  写直达:同一拍也打到内存(慢,但内存永远是最新的);写回:只置脏位,换出时才刷。
      if (cfg.wb) line.dirty = true
      else { mem.set(t.a, stVal(i)); out.cycles += COST.writeThru }
    }

    /*  预取放在访问**之后**:缺失时顺带把下一块也捎回来,搭的是同一趟车,所以比一次真缺失便宜。
        它照样要占位置 —— 组少的时候要么挤掉别人(预取污染,真现象),要么根本挤不进来
        (一路 cache 且同组,keep 挡住了)。所以块开太大 = 组太少 = 预取白装。 */
    if (!hit && cfg.pf) {
      const nb = blk + 1
      if (!sets[nb & (S - 1)]!.some(l => l.blk === nb) && install(nb, line)) { out.cycles += pfCost(B); out.prefetched++ }
    }
  })
  //  程序跑完,脏块必须刷回去 —— 少了这一步,写回机器的内存映像就和参考对不上(引擎自检会当场判红)
  //  快照要在刷脏块**之前**照 —— 玩家看的是「程序跑完那一刻 cache 里躺着什么」,
  //  刷完脏位就全清了,画出来一片干净,反而看不出写回攒了多少。
  out.snapshot = sets.map(set => set.map(l => ({ blk: l.blk, dirty: l.dirty })))
  for (const set of sets) for (const l of set) if (l.blk >= 0 && l.dirty) { flush(l); out.cycles += wbCost(B); out.wbacks++ }
  return out
}

/** 你的机器和「不要 cache 直接跑」是不是一个结果。cache 是透明的,这条**永远该为真**。 */
export function sameAsFlat(trace: Access[], r: CacheRun) {
  const ref = runFlat(trace)
  if (ref.loads.length !== r.loads.length) return false
  for (let i = 0; i < ref.loads.length; i++) if (ref.loads[i] !== r.loads[i]) return false
  const addrs = new Set([...ref.mem.keys(), ...r.mem.keys()])
  for (const a of addrs) {
    const x = ref.mem.has(a) ? ref.mem.get(a)! : initWord(a)
    const y = r.mem.has(a) ? r.mem.get(a)! : initWord(a)
    if (x !== y) return false
  }
  return true
}

// —— 关卡 —— 每一关都能在真 cache 上指得到,顺序就是「跟着一次访存走一遍」撞上的东西
export type Part = 'lru' | 'wb' | 'pf'
export type Level = {
  name: string; story: string; hint: string
  trace: Access[]
  /** 芯片面积给死:块大小 × 组数 × 路数 ≤ 它。真硬件就是这样,你只能在三者之间分配。 */
  cap: number
  wayOpts: number[]
  parts: Part[]
  par: { cycles: number }
  finale?: boolean
}

const ld = (a: number): Access => ({ op: 'ld', a })
const st = (a: number): Access => ({ op: 'st', a })
/** 顺序扫一段(空间局部性最强的那种访存)。 */
const scan = (n: number, base = 0) => Array.from({ length: n }, (_, i) => ld(base + i))
const rep = <T,>(n: number, f: (k: number) => T[]) => Array.from({ length: n }, (_, k) => f(k)).flat()
/** 一串**低位不整齐**的散点:没有空间局部性,块搬得再大也只用得上一个字。 */
const SCATTER = [100, 201, 302, 403, 504, 605, 706, 807]

export const NBITS = 12   // 地址 12 位(4096 个字)—— 位条画得下,也够摆开 tag/index/offset

export const LEVELS: Level[] = [
  {
    name: '真·Cache · 地址切三段',
    story: '一个地址进来,cache 先把它切成三段:哪一块、放哪组、块里第几个字。切法就是你下的两刀。',
    hint: '这是你在路由器那台机器上做过的同一个动作 —— 在地址上下刀。那边切出「网络号 / 主机号」,这边切出「tag / index / offset」。右边那刀右侧的位数 = 块里有几个字(块大小),两刀之间 = 有几组。这一关是一条从头扫到尾的顺序流,谁也不重复访问 —— 唯一能省事的办法是一次多搬几个字回来(缺失一次就把一整块带回来,后面那几个字就都白捡了)。把「块大小」那块牌上的 + 按几下(位条上 offset 那段会跟着变宽),看缺失次数怎么掉。',
    trace: scan(64), cap: 64, wayOpts: [1], parts: [], par: { cycles: 203 },
  },
  {
    name: '真·Cache · 块不是越大越好',
    story: '搬一整块是要时间的。如果块里的字根本用不上,那就是白搬 —— 而且块越大,组就越少。',
    hint: '这一段访存是「前半截顺序、后半截乱跳」:顺序那截喜欢大块,乱跳那截讨厌大块(搬回来 8 个字只用 1 个)。容量是给死的,块变大组就变少,乱跳的那几个地址还会开始互相挤。所以最优不在两头,在中间某处 —— 一格一格挪那把刀,把周期数的曲线走一遍,你会看到一个碗底。',
    trace: [...scan(32), ...rep(4, () => SCATTER.map(ld))], cap: 64, wayOpts: [1], parts: [], par: { cycles: 424 },
  },
  {
    name: '真·Cache · 冲突缺失(明明装得下)',
    story: '只有两个字来回读,64 个字的 cache 却次次都缺失 —— 因为这两个地址算出来是同一组。',
    hint: '这一关只访问两个地址,容量却给了 256 个字 —— 装得下有余。可它们相隔 512,而 512 比「块大小 × 组数」还大,所以不管你两刀怎么下,它们的 index 都一模一样,一定落进同一组。一组只有一个位置,两个块就只能轮流把对方踢出去(这叫「乒乓」)。真机器的解法不是加大容量,是让一组能放下不止一个块 —— 把路数调上去。',
    trace: rep(8, () => [ld(64), ld(576)]), cap: 256, wayOpts: [1, 2, 4], parts: [], par: { cycles: 42 },
  },
  {
    name: '真·Cache · 该踢谁(LRU vs 先进先出)',
    story: '一组里放得下两个,来的却是三个 —— 那就得挑一个踢。挑错了,下一拍它就回来了。',
    hint: '三个地址(相隔都很远,注定同组)按 A B A C 的节奏轮着来,而这颗芯片只做到 2 路。默认的踢法是「先进先出」:谁先进来踢谁 —— 于是天天在踢 A,可 A 恰恰是访问得最勤的那个。装上〈LRU 替换〉,改成「踢最久没被用过的那个」,A 每次命中都会把自己的位置刷新,就再也轮不到它了。两种踢法结果都对,差的是拍数 —— 自己切换着跑一遍。',
    trace: rep(6, () => [ld(0), ld(512), ld(0), ld(1024)]), cap: 256, wayOpts: [1, 2], parts: ['lru'], par: { cycles: 193 },
  },
  {
    name: '真·Cache · 写下去,还是先记着',
    story: '每写一个字都老老实实打到内存,慢;先记在块上、等它被换出去时再一起写回,快。',
    hint: '这一段是「写多读少」:同几个字反复改。默认是写直达 —— 每次 store 都要往内存打一发,一发 8 拍,写多少次就付多少次。装上〈写回单元〉之后,写只落在块上、顺手把「脏位」立起来,等这块真的要被换出去了才整块写回;程序结束时剩下的脏块也会一并刷掉(不刷的话内存就和参考对不上了 —— 引擎每次都在对撞,你可以自己盯着那行字)。',
    trace: [...rep(8, () => Array.from({ length: 8 }, (_, j) => st(j))), ...scan(8)],
    cap: 64, wayOpts: [1], parts: ['wb'], par: { cycles: 125 },
  },
  {
    name: '真·Cache · 预取(还没要就先搬)',
    story: '顺序流的缺失是躲不掉的「强制缺失」—— 除非在你开口之前就把下一块搬过来。',
    hint: '又是一条顺序流,但这回容量小得多,块开不大。剩下的缺失全是强制缺失:每块头一次访问必缺 —— 除非有人提前搬。装上〈预取下一块〉:每次缺失的时候顺带把下一块也捎回来,搭的是同一趟车,所以比一次真缺失便宜。⚠️ 但预取回来的块也得有地方放:如果你把块开到最大、组只剩一个,那么「下一块」和「这一块」是同一组,而替换逻辑绝不会动你刚搬回来的那块 —— 于是预取根本挤不进来,装了等于没装。所以这一关不是把块开到最大,是给组留位置。',
    trace: scan(64), cap: 16, wayOpts: [1], parts: ['pf'], par: { cycles: 220 },
  },
  {
    name: '终关 · 一段真程序的访存流',
    story: '顺序遍历一个数组、反复读一小张表、两个远隔的地址来回、还要往回写 —— 一段真程序就长这样。',
    hint: '把学过的全用上:两刀切出合适的块大小和组数、路数够不够躲开冲突、〈LRU〉挑对该踢的那个、〈写回单元〉把写攒起来、〈预取〉吃掉顺序那截的强制缺失。容量还是给死的,加哪样都得从另一样身上匀。⚠️ 这一关的访存是混着的,〈预取〉第一次真的会咬人:它捎回来的块要占位置,可能把那张反复读的小表挤出去 —— 装上它反而变慢的配法这里是真实存在的(这就是「预取污染」)。结果一定是对的(cache 是透明的),比的只有拍数。',
    trace: [
      ...scan(24),                                   // 顺序遍历:吃空间局部性
      ...rep(5, () => [ld(300), ld(301), ld(302)]),  // 一小张表反复读:吃时间局部性
      //  三个远隔地址按 A B A C 轮转:低 7 位全一样 → 不管怎么下刀都同组,而这颗芯片只到 2 路
      //  → 冲突缺失(要路数)**和**该踢谁(要 LRU)两件事同时压在这一段上
      ...rep(4, () => [ld(64), ld(1600), ld(64), ld(2624)]),
      ...rep(3, () => [st(300), st(301), st(302)]),  // 往回写:写策略
    ],
    cap: 128, wayOpts: [1, 2], parts: ['lru', 'wb', 'pf'], par: { cycles: 385 }, finale: true,
  },
]

// —— 穷举:给定一关,枚举它**真的给了**的所有配法 ——
export type Combo = { cfg: Cfg; cycles: number; ok: boolean; misses: number }
export function allConfigs(L: Level): Cfg[] {
  const out: Cfg[] = []
  const partSets = (ps: Part[]) => {
    const s: Record<Part, boolean>[] = []
    for (let m = 0; m < 1 << ps.length; m++) {
      const o = { lru: false, wb: false, pf: false }
      ps.forEach((p, i) => { if (m >> i & 1) o[p] = true })
      s.push(o)
    }
    return s
  }
  for (const ways of L.wayOpts)
    for (let ob = 0; ob <= NBITS; ob++)
      for (let ib = 0; ob + ib <= NBITS; ib++) {
        if ((1 << ob) * (1 << ib) * ways > L.cap) continue    // 芯片面积不够
        for (const p of partSets(L.parts)) out.push({ ob, ib, ways, ...p })
      }
  return out
}
export function sweep(L: Level): Combo[] {
  return allConfigs(L).map(cfg => {
    const r = runCache(L.trace, cfg)
    return { cfg, cycles: r.cycles, misses: r.misses, ok: sameAsFlat(L.trace, r) }
  })
}
