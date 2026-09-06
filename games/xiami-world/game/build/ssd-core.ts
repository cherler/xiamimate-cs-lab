/**
 * 「搭机器」第五台设备 · 固态硬盘(闪存 + FTL)—— 纯内核,零 DOM。
 *
 * 一切都从闪存的一条物理事实长出来:
 *   **读和写按「页」,擦除按「块」(一块几十上百页);而且一页写过之后不能原地再写,
 *   非要重写不可的话,得把它所在的整块先擦干净。**
 * 这一条一立,后面全是它的连锁反应,关卡顺序就是这串反应:
 *   原地改不了 → 逻辑地址和物理位置分家(FTL 映射)→ 旧页变垃圾 → 垃圾回收 →
 *   回收要搬有效页(写放大)→ 多留点空块(预留空间)→ 回收先挑谁 →
 *   写缓存很快但断电就丢 → 块会擦坏(磨损均衡)→ 终关
 *
 * ── 焊死的口径 ──
 * 参考解释器 `runIdeal`:一块**理想的盘** —— 每次写立刻落盘,读永远返回「最后写进去的那个值」,
 * 断电也不丢。你搭的盘(`runSSD`)每一次读都必须和它读到同一个值。
 *
 * ⚠️ 这台和 Cache / 推理引擎不一样:**它真的会读错**。
 * 写缓存把数据攒在 DRAM 里还没落盘,这时候断电,那些数据就没了 —— 后面再读就是旧值。
 * 所以这台机器同时有「对不对」和「快不快」两条轴,像路由器和 CPU 那样。
 */

export type Op =
  | { op: 'w'; a: number }
  | { op: 'r'; a: number }
  /** 拔电源。写缓存里还没落盘的东西,除非有掉电保护,否则就没了。 */
  | { op: 'power' }

/** 一次操作要多久。真盘上这三者差着数量级:读 ~50µs、编程 ~500µs、擦除 ~3ms。 */
export const COST = { read: 1, prog: 10, erase: 60, flush: 2 }

export type Cfg = {
  /** 对外声称的容量(逻辑页数)。声称得越大,留给周转的空块越少 —— 这就是预留空间那个旋钮。 */
  capacity: number
  /** 垃圾回收先挑哪个块:有效页最少的(贪心),还是按块号轮着来。 */
  victim: 'greedy' | 'round'
  ftl: boolean
  wcache: boolean
  plp: boolean
  wear: boolean
}
export type Part = 'ftl' | 'wcache' | 'plp' | 'wear'

export type SSDRun = {
  /** 每次读读到了什么 —— 要和理想盘一模一样。 */
  reads: number[]
  time: number
  /** 用户要求写了几页 / 闪存实际编程了几页。写放大 = 后者除以前者。 */
  hostWrites: number; flashWrites: number
  erases: number
  /** 最惨那个块被擦了多少次 —— 闪存块的擦写次数是有限的。 */
  maxErase: number
  /** 掉电时丢掉了多少页还没落盘的数据(装了掉电保护就是 0)。 */
  lost: number
  gcRuns: number
  /** 跑完之后闪存长什么样(每块每页的状态 + 这块被擦了几次)—— 页面把块阵列画出来用。 */
  snapshot: { pages: ('free' | 'valid' | 'invalid')[]; erases: number }[]
}
export const wa = (r: SSDRun) => r.hostWrites ? r.flashWrites / r.hostWrites : 1

/** 写进去的值:第几次操作就写几 —— 确定性,而且各不相同,「读到旧值」一眼看得出来。 */
export const wval = (i: number) => 1000 + i

/** 参考答案:一块理想的盘。 */
export function runIdeal(trace: Op[]) {
  const disk = new Map<number, number>(), reads: number[] = []
  trace.forEach((t, i) => {
    if (t.op === 'w') disk.set(t.a, wval(i))
    else if (t.op === 'r') reads.push(disk.get(t.a) ?? 0)
    //  理想盘上拔电源什么也不会发生 —— 每次写都已经落盘了
  })
  return reads
}

type Page = { state: 'free' | 'valid' | 'invalid'; lpn: number; val: number }
type Blk = { pages: Page[]; erases: number }

/**
 * 你搭的那块盘跑一遍。
 *
 * 没装〈FTL 映射〉时,逻辑页号就直接当物理页号用 —— 于是重写一页只能走
 * 「把整块读出来 → 擦掉 → 整块写回去」这条路(早期的闪存卡真是这么干的),慢得吓人。
 * 装了 FTL 之后,写永远写到一个干净的新位置,旧的那份就地作废 —— 快,但垃圾会攒起来。
 */
export function runSSD(trace: Op[], cfg: Cfg, nblk: number, ppb: number): SSDRun {
  const blks: Blk[] = Array.from({ length: nblk }, () => ({
    pages: Array.from({ length: ppb }, () => ({ state: 'free' as const, lpn: -1, val: 0 })),
    erases: 0,
  }))
  const out: SSDRun = { reads: [], time: 0, hostWrites: 0, flashWrites: 0, erases: 0, maxErase: 0, lost: 0, gcRuns: 0, snapshot: [] }
  /** 逻辑页 → 物理页(块号 × ppb + 页号)。没装 FTL 的话这张表就是恒等映射。 */
  const map = new Map<number, number>()
  /** 写缓存:还没落盘的逻辑页。拔电源时它就是要丢的那部分。 */
  const cache = new Map<number, number>()
  const at = (p: number) => blks[Math.floor(p / ppb)]!.pages[p % ppb]!
  const erase = (b: Blk) => {
    for (const pg of b.pages) { pg.state = 'free'; pg.lpn = -1 }
    b.erases++; out.erases++; out.time += COST.erase
    out.maxErase = Math.max(out.maxErase, b.erases)
  }
  const freeCount = () => blks.reduce((n, b) => n + b.pages.filter(p => p.state === 'free').length, 0)

  /** 挑一个干净页写。装了磨损均衡就优先挑擦得最少的那个块 —— 别老可着一块用。 */
  const alloc = (): number => {
    let bi = -1
    for (let i = 0; i < nblk; i++) {
      if (!blks[i]!.pages.some(p => p.state === 'free')) continue
      if (bi < 0) { bi = i; continue }
      if (cfg.wear && blks[i]!.erases < blks[bi]!.erases) bi = i
    }
    if (bi < 0) return -1
    const pi = blks[bi]!.pages.findIndex(p => p.state === 'free')
    return bi * ppb + pi
  }
  let roundPtr = 0
  /**
   * 回收一个块:把里面还有效的页搬走,再擦掉。搬走的那些就是写放大的来源。
   *
   * ⚠️ 候选**只能是已经写满的块**。第一版把「还有空页的块」也算进候选,而贪心恰恰挑
   * 有效页最少的 —— 于是它一次次挑中那个刚开始写、几乎全是空页的块,搬家没地方落,
   * 整台机器卡死在「腾不出页」上。真盘也是只在写满(封块)的块里挑受害者。
   */
  const gc = () => {
    const sealed = blks.map((b, i) => ({ b, i })).filter(({ b }) => !b.pages.some(p => p.state === 'free'))
    if (!sealed.length) return false
    const validOf = (b: Blk) => b.pages.filter(p => p.state === 'valid').length
    let pick = sealed[0]!
    if (cfg.victim === 'greedy') { for (const c of sealed) if (validOf(c.b) < validOf(pick.b)) pick = c }
    else { pick = sealed[roundPtr % sealed.length]!; roundPtr++ }
    /*  磨损均衡的另一半:哪个块擦得特别少,说明它上头压着一坨冷数据、一直轮不到它。
        把那坨冷数据搬走,让这块低磨损的块也进入流通 —— 不然热数据永远在啃那几个块。 */
    if (cfg.wear) {
      const lo = sealed.reduce((a, c) => c.b.erases < a.b.erases ? c : a)
      const hiE = blks.reduce((a, b) => b.erases > a.erases ? b : a).erases
      if (hiE - lo.b.erases > 3) pick = lo
    }
    /*  搬家得有落脚点。轮转(和磨损均衡的强制挑选)可能正好挑中一个几乎全是有效页的块,
        搬不动 —— 这时候退回「挑有效页最少的那个」。策略只管**优先挑谁**,
        它不能把机器逼到一页也腾不出来:那是物理约束,不是偏好。 */
    const roomFor = (k: number) => blks.reduce((n, b, i) => i === k ? n : n + b.pages.filter(p => p.state === 'free').length, 0)
    if (roomFor(pick.i) < validOf(pick.b)) {
      let alt = sealed[0]!
      for (const c of sealed) if (validOf(c.b) < validOf(alt.b)) alt = c
      pick = alt
      if (roomFor(pick.i) < validOf(pick.b)) return false   // 真的一点周转空间都没有了
    }
    out.gcRuns++
    for (let pi = 0; pi < ppb; pi++) {
      const pg = pick.b.pages[pi]!
      if (pg.state !== 'valid') continue
      out.time += COST.read
      let dst = -1
      for (let i = 0; i < nblk; i++) {
        if (i === pick.i) continue
        const k = blks[i]!.pages.findIndex(p => p.state === 'free')
        if (k >= 0) { dst = i * ppb + k; break }
      }
      if (dst < 0) return false
      const d = at(dst)
      d.state = 'valid'; d.lpn = pg.lpn; d.val = pg.val
      map.set(pg.lpn, dst)
      out.time += COST.prog; out.flashWrites++     // 这一页是 GC 自己造出来的写 —— 写放大
      pg.state = 'invalid'
    }
    erase(pick.b)
    return true
  }

  /** 真的把一个逻辑页写进闪存。 */
  const persist = (lpn: number, val: number) => {
    if (!cfg.ftl) {
      /*  没有映射层:逻辑页号就是物理页号,想改它只能把整块擦一遍再写回去。
          这就是「原地改不了」最笨的活法 —— 一次改动要付一整块的读 + 擦 + 写。 */
      const bi = Math.floor(lpn / ppb), b = blks[bi]!
      const keep = b.pages.map(p => ({ ...p }))
      for (const p of keep) if (p.state === 'valid') out.time += COST.read
      erase(b)
      for (let pi = 0; pi < ppb; pi++) {
        const src = keep[pi]!
        const isTarget = bi * ppb + pi === lpn
        if (!isTarget && src.state !== 'valid') continue
        const pg = b.pages[pi]!
        pg.state = 'valid'; pg.lpn = bi * ppb + pi; pg.val = isTarget ? val : src.val
        out.time += COST.prog; out.flashWrites++
      }
      map.set(lpn, lpn)
      return
    }
    //  空页少于一整块就先回收 —— 等到只剩一页再动手,搬家就没落脚点了
    let guard = 0
    while (freeCount() < ppb && guard++ < 400) if (!gc()) break
    const dst = alloc()
    /*  ⚠️ 走到这儿说明连一页干净的都腾不出来 —— 预留空间给得太少,GC 搬不动了。
        第一版在这里悄悄 `return`,于是这次写**凭空消失**,后面读出来是旧值,
        而「丢了几页」那个读数还是 0 —— 一个不声不响的错。真盘不会落到这一步:
        对外容量本来就不许贴着物理容量报(至少留出两个整块的周转余地),
        所以这是引擎的不变量被破坏了,得炸出来让判据抓到。 */
    if (dst < 0) throw new Error(`预留空间不够周转:对外容量 ${cfg.capacity} 对这颗芯片(${nblk * ppb} 页)报太满了`)
    const old = map.get(lpn)
    if (old !== undefined) at(old).state = 'invalid'    // 旧的那份就地作废,变成垃圾
    const pg = at(dst)
    pg.state = 'valid'; pg.lpn = lpn; pg.val = val
    map.set(lpn, dst)
    out.time += COST.prog; out.flashWrites++
  }

  trace.forEach((t, i) => {
    if (t.op === 'w') {
      out.hostWrites++
      if (cfg.wcache) {
        //  写缓存:先记在 DRAM 里,同一页反复写就地覆盖(合并),攒到一定量再一起落盘
        cache.set(t.a, wval(i)); out.time += COST.flush
        if (cache.size > 4) { for (const [l, v] of cache) persist(l, v); cache.clear() }
      } else persist(t.a, wval(i))
    } else if (t.op === 'r') {
      out.time += COST.read
      if (cache.has(t.a)) { out.reads.push(cache.get(t.a)!); return }
      const p = map.get(t.a)
      out.reads.push(p === undefined ? 0 : at(p).val)
    } else {
      /*  拔电源。装了掉电保护(那颗电容)就还来得及把缓存刷下去;
          没装的话缓存里的东西**就是丢了** —— 后面再读那几页,读到的是旧值。
          这是这台机器唯一真正会「算错」的地方,也是真盘上真会发生的事。 */
      if (cfg.plp) { for (const [l, v] of cache) { persist(l, v); out.time += COST.flush } }
      else out.lost += cache.size
      cache.clear()
    }
  })
  //  跑完把缓存刷干净(正常关机)—— 断电那次已经算过账了
  for (const [l, v] of cache) persist(l, v)
  out.snapshot = blks.map(b => ({ pages: b.pages.map(p => p.state), erases: b.erases }))
  return out
}

/** 你的盘和理想盘读到的是不是同一串值。 */
export function sameAsIdeal(trace: Op[], r: SSDRun) {
  const ref = runIdeal(trace)
  return ref.length === r.reads.length && ref.every((v, i) => v === r.reads[i])
}

// —— 关卡 ——
export type Level = {
  name: string; short: string; story: string; hint: string
  /**
   * 负载**跟着对外容量走** —— 你声称多大,用户就把它填多满。
   *
   * ⚠️ 第一版把 trace 写死了,于是「对外容量」那个旋钮在引擎里根本没参与计算,
   * 调它什么也不会变 —— 一个假旋钮。真盘上的因果是:声称 512G 用户就填 512G,
   * 盘满到 100%,写放大爆炸;声称 480G,用户最多填 480G,剩下那 32G 永远是干净的周转空间。
   * 所以预留空间的效果必须从「负载的地址范围 = 声称容量」里长出来。
   */
  trace: (cap: number) => Op[]
  nblk: number; ppb: number
  /** 对外容量至少要有这么多逻辑页 —— 「盘再小就卖不出去了」。预留空间的张力全在这儿。 */
  minCap: number
  capOpts: number[]
  parts: Part[]
  victimOpts: Cfg['victim'][]
  /** 目标:时间要够;有的关还卡最大擦除次数。 */
  par: { time: number; maxErase?: number }
  finale?: boolean
}

const w = (a: number): Op => ({ op: 'w', a })
const rd = (a: number): Op => ({ op: 'r', a })
const pw: Op = { op: 'power' }
const rep = <T,>(n: number, f: (k: number) => T[]) => Array.from({ length: n }, (_, k) => f(k)).flat()
/**
 * 先把盘灌满,再打一串**冷热不均**的随机写 —— SSD 基准测试的标准做法(预处理 + 随机写)。
 *
 * ⚠️ 第一版用的是「等间隔轮转」的假随机(地址每次 +29 取模),结果每个块都会整块变成垃圾,
 * GC 一页都不用搬,写放大**恒等于 1** —— 整台机器最核心的那个数字是死的,我还差点就那么发了。
 * 真实的写放大来自冷热不均:一个块里混着刚作废的热页和还活着的冷页,GC 非把冷的搬走不可。
 * 默认 90% 的写落在 10% 的地址上(这就是真实负载的样子)。
 */
const bench = (cap: number, n: number, seed = 1, hotPct = 90, hotShare = 0.1): Op[] => {
  const out: Op[] = Array.from({ length: cap }, (_, i) => w(i))
  const hotN = Math.max(1, Math.floor(cap * hotShare))
  for (let i = 0; i < n; i++) {
    const h = (seed * 2654435761 + i * 40503) >>> 0
    out.push(w((h % 100) < hotPct ? (h >>> 7) % hotN : hotN + (h >>> 7) % (cap - hotN)))
  }
  return out
}
/** 抽几个地址读回来验一验(取模保证落在容量内)。 */
const checks = (cap: number, ...xs: number[]) => xs.map(x => rd(x % cap))

export const LEVELS: Level[] = [
  {
    name: '真·固态硬盘 · 原地改不了',
    short: '改不了',
    story: '闪存一页写过之后就不能再写了。想改它?先把它所在的整块擦干净 —— 邻居的数据也一起没。',
    hint: '这一关反复改同几页。不装〈FTL 映射〉的话,逻辑页号直接当物理位置用:每改一页,都得把整块先读出来、擦掉、再整块写回去 —— 一次改动付一整块的钱。装上〈FTL 映射〉:让逻辑地址和物理位置分家,写永远写到一个干净的新位置去,旧的那份就地作废。改一页就只是写一页。',
    trace: () => [...rep(6, () => [w(0), w(1), w(2), w(0), w(1)]), rd(0), rd(1), rd(2)],
    nblk: 8, ppb: 8, minCap: 8, capOpts: [8], parts: ['ftl'], victimOpts: ['greedy'],
    par: { time: 303 },
  },
  {
    name: '真·固态硬盘 · 垃圾回收与写放大',
    short: '写放大',
    story: '旧数据作废了却还占着位置。要腾地方,就得挑一个块、把里面还有用的页搬走、再擦掉它。',
    hint: '写到新位置很快,可作废的旧页会越攒越多,干净页迟早用完。这时候只能回收:挑一个块,把里面还有效的页一页页搬到别处(读一次、写一次),然后擦掉整块。搬家搬出来的那些写,用户根本没要求过 —— 用户写 1 页、闪存实际写了两三页,这个比值就叫写放大。这一关先把这笔账看见:盯着「写放大」那个读数跑一遍,再看看总时间里有多少是花在擦上的。',
    trace: cap => [...bench(cap, 260, 3), ...checks(cap, 0, 7, 13, 29)],
    nblk: 8, ppb: 8, minCap: 40, capOpts: [40], parts: ['ftl'], victimOpts: ['greedy'],
    par: { time: 9337 },
  },
  {
    name: '真·固态硬盘 · 预留空间',
    short: '预留空间',
    story: '同一块闪存,对外少声称一点容量,写放大就掉一大截 —— 厂商标 480G 而不是 512G,就是这个道理。',
    hint: '关键在于:你声称多大,用户就把它填多满。声称到顶,盘就被填到 100%,每个块里全是有效数据,回收一次要搬走一大半 —— 写放大爆炸。留一手:物理上有这么多闪存,对外只声称一部分,剩下的永远是干净的周转空间,回收时随手就能找到几乎全是垃圾的块。这一关让你调「对外容量」:声称得越小盘越快,但客户要求它至少装得下那么多页,低于那个数就别卖了。两头都试一遍。',
    trace: cap => [...bench(cap, 400, 5), ...checks(cap, 1, 11, 23, 37, 47)],
    //  对外容量最高只到 64:再往上就贴着物理容量了,GC 连搬家的落脚点都没有(至少留两个整块)
    nblk: 10, ppb: 8, minCap: 48, capOpts: [48, 56, 64], parts: ['ftl'], victimOpts: ['greedy'],
    par: { time: 13203 },
  },
  {
    name: '真·固态硬盘 · 回收先挑谁',
    short: '挑哪块',
    story: '要擦一块,当然挑里头有用的东西最少的那块 —— 搬得最少,擦得最值。',
    hint: '回收哪个块是可以挑的。「按块号轮着来」最省事,可轮到谁就是谁,常常挑中一个还塞满有效数据的块,白搬一堆。「挑有效页最少的那个」(贪心)就聪明多了:同样擦一块,搬家的活儿少得多。两种都试一遍,看写放大和总时间的差 —— 顺便再想想容量该声称多少。',
    //  冷热拉得更开(95% 的写压在 5% 的地址上):贪心一挑一个准,轮转就常常撞上还满是有效页的冷块
    trace: cap => [...bench(cap, 400, 7, 95, 0.05), ...checks(cap, 3, 17, 31, 43)],
    nblk: 10, ppb: 8, minCap: 56, capOpts: [56, 64], parts: ['ftl'], victimOpts: ['greedy', 'round'],
    par: { time: 17804 },
  },
  {
    name: '真·固态硬盘 · 断电那一下',
    short: '断电',
    story: '写缓存把数据先攒在内存里,快得很 —— 直到有人拔了电源。',
    hint: '装上〈写缓存〉:写先落在 DRAM 里,同一页反复改就地覆盖(根本不用惊动闪存),攒够一批再一起写下去。快是真快。可这一关的操作流里插着「拔电源」—— 那一刻还在缓存里没落盘的页,就真的没了,后面再读它就是旧值。⚠️ 这是这台机器唯一会读错的地方:光看时间会以为自己赢了,底下那行「读到的值和理想盘一致吗」会告诉你真相。真盘上的解法是板子上焊一颗电容,掉电的瞬间还够把缓存刷完 —— 那就是〈掉电保护〉。',
    trace: () => [...rep(4, k => [w(k), w(k + 1), w(k), rd(k)]), pw,
      ...rep(3, k => [w(k + 2), w(k + 3), rd(k + 2)]), pw, rd(0), rd(1), rd(2), rd(3), rd(4), rd(5)],
    nblk: 8, ppb: 8, minCap: 16, capOpts: [16], parts: ['ftl', 'wcache', 'plp'], victimOpts: ['greedy'],
    par: { time: 159 },
  },
  {
    name: '真·固态硬盘 · 别可着一块擦',
    short: '磨损均衡',
    story: '闪存块的擦写次数是有数的。老挑同几个块下手,盘还剩一大半好块呢,它先坏了。',
    hint: '贪心回收有个副作用:总有那么几个块装的是热数据(反复被改),它们的有效页总是最少,于是一次次被挑中、一次次被擦;而另一头压着冷数据的块一次都轮不到 —— 盘报废的时候一大半块还是新的。这一关除了时间还卡一条:最惨那个块的擦除次数不许超上限。装上〈磨损均衡〉:分配新页时优先用擦得少的块,回收时也主动去动那些一直没轮到的块(把冷数据挪开,让低磨损的块进入流通)。',
    //  热数据死盯着极少几页反复改 —— 贪心回收会一直啃住那几个块,擦爆它们
    trace: cap => [...bench(cap, 400, 11, 92, 0.08), ...checks(cap, 0, 1, 2, 3)],
    nblk: 10, ppb: 8, minCap: 48, capOpts: [48], parts: ['ftl', 'wear'], victimOpts: ['greedy', 'round'],
    par: { time: 10253, maxErase: 12 },
  },
  {
    name: '终关 · 一块能卖的盘',
    short: '终关',
    story: '有冷有热的真实负载、中途还断一次电、容量不能太小、块也不许擦坏 —— 一块能卖的盘得同时扛住这些。',
    hint: '把学过的全用上:〈FTL 映射〉让写落在新位置、贪心回收少搬家、对外容量往下压出预留空间、〈写缓存〉合并那些反复改的热页、〈掉电保护〉保证断电不丢、〈磨损均衡〉不让某几块先坏。对外容量不许低于客户要求,最大擦除次数不许超上限,读到的值必须和理想盘一模一样 —— 三条都过了,这块盘才算能卖。',
    /*  断电前特意写三页**之后再也不碰的冷数据**,最后把它们读回来。
        ⚠️ 不这么摆的话,丢掉的那几页后面又被覆盖了一遍,错误就被盖住 —— 一台没装掉电保护的盘
        照样「读对」,那这一关的对错轴就是假的。所以断电后的负载只铺到 cap-4,把顶上三页留干净。 */
    trace: cap => [...bench(cap, 220, 13), w(cap - 1), w(cap - 2), w(cap - 3), pw,
      ...rep(24, () => [w(3), w(4)]), ...bench(cap - 4, 180, 17).slice(cap - 4),
      ...checks(cap, 0, 3, 4, 19, 41), rd(cap - 1), rd(cap - 2), rd(cap - 3)],
    nblk: 12, ppb: 8, minCap: 56, capOpts: [56, 64, 72], parts: ['ftl', 'wcache', 'plp', 'wear'],
    victimOpts: ['greedy', 'round'],
    par: { time: 10056, maxErase: 6 }, finale: true,
  },
]

// —— 穷举 ——
export type Combo = { cfg: Cfg; time: number; maxErase: number; wa: number; ok: boolean; lost: number }
export function allConfigs(L: Level): Cfg[] {
  const out: Cfg[] = []
  const bools = (p: Part) => L.parts.includes(p) ? [false, true] : [false]
  for (const capacity of L.capOpts)
    for (const victim of L.victimOpts)
      for (const ftl of bools('ftl'))
        for (const wcache of bools('wcache'))
          for (const plp of bools('plp'))
            for (const wear of bools('wear')) {
              if (!wcache && plp) continue          // 没有写缓存就没有「掉电丢缓存」这回事,掉电保护无从谈起
              if (L.victimOpts.length > 1 && !ftl && victim !== L.victimOpts[0]) continue   // 没有 FTL 就没有回收,别把同一台机器数两遍
              out.push({ capacity, victim, ftl, wcache, plp, wear })
            }
  return out
}
export function sweep(L: Level): Combo[] {
  return allConfigs(L).map(cfg => {
    const tr = L.trace(cfg.capacity)
    const r = runSSD(tr, cfg, L.nblk, L.ppb)
    return { cfg, time: r.time, maxErase: r.maxErase, wa: wa(r), lost: r.lost, ok: sameAsIdeal(tr, r) }
  })
}
/** 预留空间:物理页数减去对外声称的容量。 */
export const opPages = (L: Level, cfg: Cfg) => L.nblk * L.ppb - cfg.capacity
