/**
 * 「搭机器」第四台设备 · 大模型推理引擎 —— 纯内核,零 DOM。
 *
 * 换造物了:前三台都在造物「电脑 / 互联网」里(路由器、CPU、Cache),这一台是造物「大模型」。
 * 但它接的正是上一台的手 —— KV Cache 就是 cache 那台在推理引擎里的下一步,
 * 分页 KV 的「页大小」和 cache 的「块大小」是同一个旋钮(取整到页 = 内部碎片)。
 *
 * 关卡照旧是从真机器里读出来的:跟着一次生成走一遍,沿途撞上什么就是一关。
 * 这条链就是 vLLM 那套东西的真实来路:
 *   每个 token 都从头重算 → KV Cache → 显存装不下 → 分页 → 页多大 →
 *   静态批的气泡 → 连续批 → 批大了延迟长(吞吐与延迟打架)→ 投机解码 → 终关
 *
 * ── 焊死的口径 ──
 * 参考解释器 `runNaive`:**不要任何优化,一个 token 一个 token 地生成**,记下每个请求吐出什么。
 * 你搭的引擎(`runEngine`)必须一字不差地吐出同一串 token。
 * 投机解码尤其要盯着这条:真系统的验收标准就是「投机后的输出必须和不投机逐字相同」。
 *
 * ── 和前三台的分工 ──
 * 路由器 / CPU:配错了会**算错**。Cache / 这一台:配错了只会**变慢**。
 * 所以这台也是「你在调时间,不是答案」——**但它头一回有两个互相打架的指标**:
 * 吞吐(每拍吐几个 token)和延迟(一个请求等多久)。批开大吞吐涨、延迟也涨。
 */

// —— 玩具模型:确定性,但「为什么要 KV Cache」这件事是真的 ——
/**
 * 词表 16 个 token。下一个 token 由**最后两个** token 决定。
 *
 * 为什么是两个而不是一个:草稿模型只看得见最后一个(见 draftNext)——
 * 于是它在「需要往回多看一步」的位置上就会猜错。真实里小模型猜不中的也正是这种位置,
 * 这不是我随手调的命中率,是从两个模型看得多远的差别里长出来的。
 */
export const V = 16
export const realNext = (a: number, b: number) => (b % 4 === 0 ? (a * 7 + b + 1) : (b * 5 + 1)) % V
/** 草稿模型:只看最后一个 token。b % 4 !== 0 的位置它必对,剩下四分之一要碰运气 —— 接受率约 3/4,和真系统一个量级。 */
export const draftNext = (b: number) => (b * 5 + 1) % V

export type Req = { prompt: number[]; out: number }

/** 参考答案:老老实实一个 token 一个 token 地生成。 */
export function runNaive(reqs: Req[]) {
  return reqs.map(r => {
    const ctx = [...r.prompt], gen: number[] = []
    for (let i = 0; i < r.out; i++) {
      const t = realNext(ctx[ctx.length - 2] ?? 0, ctx[ctx.length - 1] ?? 0)
      ctx.push(t); gen.push(t)
    }
    return gen
  })
}

/** 一步要花多少拍。写在一处,页面和判据读同一份。 */
export const COST = {
  /**
   * 固定开销:把整个模型的权重从显存读进来。**跟批大小无关** —— 批处理省的就是它。
   * ⚠️ 它必须**远大于**单个请求那点注意力开销,否则批处理在账面上就不值钱了 ——
   * 而真机器上 decode 恰恰是被权重读取卡住的(memory-bound),这一项就是主导项。
   * 第一版给了 40,于是并发几乎不省时间、页大小的曲线也压不出碗底 —— 是模型不真,不是关卡不好。
   */
  stepFix: 300,
  /** 注意力:上下文里每有一个 token 就要读一次它的 K/V。 */
  attn: 1,
  /** 算一个位置的 K/V。没有 KV Cache 时,每一步都要把整段上下文重算一遍(这就是 O(n²))。 */
  kv: 20,
  /** 草稿模型出一个 token —— 它也要读自己那份权重,不是白送的。 */
  draft: 10,
  /** 每碰一页要查一次页表 —— 页开得越小,页越多,这笔越贵。给 1 的时候碗底太浅(两档只差 0.2%),
   *  玩的人根本感觉不到「页开小了也会亏」,所以给 2。 */
  pageTax: 2,
}

export type Cfg = {
  /** 一批同时跑几个请求。 */
  batch: number
  /** 分页 KV 的页有多大(几个 token 一页)。不装分页时这个旋钮没用。 */
  page: number
  /** 投机解码一次先猜几个。不装投机时没用。 */
  spec: number
  kvcache: boolean
  paged: boolean
  /** 连续批处理:一个请求跑完就立刻补新的进来;不装 = 静态批(整批一起等最慢那个)。 */
  cont: boolean
  speculate: boolean
}
export type Part = 'kvcache' | 'paged' | 'cont' | 'speculate'

export type EngineRun = {
  /** 每个请求吐出来的 token —— 要和 runNaive 一模一样。 */
  gen: number[][]
  /** 总时间(拍)。 */
  time: number
  /** 每个请求什么时候进的批。 */
  startAt: number[]
  /** 每个请求什么时候说完最后一个 token。全部 0 时刻到达,所以这就是它的延迟。 */
  finish: number[]
  /**
   * 每个请求什么时候真正**腾出位置**。
   * 静态批下它晚于 finish —— 中间那一段就是「已经说完了还占着位置陪跑」,也就是气泡。
   * 连续批下两者相等。甘特图上把这一段画成灰的,一眼就看见连续批省的是什么。
   */
  leaveAt: number[]
  /** 吞吐:每千拍吐出几个 token(整数好读)。 */
  tput: number
  /** 最坏的那个请求等了多久(从 0 时刻算起)。 */
  worst: number
  /**
   * 最坏的「吐字间隔」(TPOT):一个请求从进批到说完,平均每个 token 要等多少拍。
   *
   * ⚠️ 这个量才是和吞吐真打架的那个。第一版我拿「最坏延迟」当延迟指标,可所有请求都在 0 时刻到,
   * 最后一个的完成时刻就约等于总时间 —— 两个读数几乎是同一个数,**张力是假的**。
   * 批开大以后总时间是降了,但一步要算的东西多了、每一步更久,单个用户看到的字就是一顿一顿地往外蹦。
   */
  tpot: number
  /** 显存占用峰值(以 token 计)。 */
  peak: number
  /** 投机猜了几个、中了几个。 */
  drafted: number; accepted: number
  /** 一共走了几步 —— 静态批的气泡就体现在这儿。 */
  steps: number
}

type Slot = { r: Req; ctx: number[]; gen: number[]; done: boolean; hold: number; start: number }

/**
 * 你搭的那台引擎跑一遍。
 *
 * 显存怎么算:装了 KV Cache 才占显存(不装就什么都不存 —— 省显存,但慢得没边)。
 *   · 不分页:一个请求要按**这批里最长的那个**连续预留一整块 —— 短请求也占那么大,这就是浪费。
 *   · 分页:按它自己的最大长度、向上取整到页 —— 页开小了浪费就小,但查页表更勤。
 */
export function runEngine(reqs: Req[], cfg: Cfg, vram: number, maxLen: number): EngineRun {
  /**
   * 一个请求要占多少显存。
   *
   * ⚠️ 这里第一版算错了,而且错得很像对的:不分页时我按「**这一批里最长的那个**」预留,
   * 于是请求长度接近的关卡里,不分页几乎不浪费,〈分页 KV〉反倒因为查页表成了负收益 ——
   * 七关里有五关最优解是「别装分页」。那关卡就成了陷阱。
   *
   * 真机器不是这样的:一个请求刚进来时,**没人知道它要生成多长**,所以连续预留只能按
   * 模型的最大上下文长度 maxLen 来留(vLLM 那篇论文的出发点就是这件事)。
   * 按 maxLen 预留,分页省下来的就不是零头,是绝大部分。
   */
  const hold = (r: Req) => {
    if (!cfg.kvcache) return 0
    return cfg.paged ? Math.ceil((r.prompt.length + r.out) / cfg.page) * cfg.page : maxLen
  }

  const slots: Slot[] = []
  const queue = reqs.map((r, i) => ({ i, r }))
  const out: EngineRun = {
    gen: reqs.map(() => []), time: 0, startAt: reqs.map(() => 0), finish: reqs.map(() => 0),
    leaveAt: reqs.map(() => 0), tput: 0, worst: 0, tpot: 0,
    peak: 0, drafted: 0, accepted: 0, steps: 0,
  }
  const idxOf = new Map<Slot, number>()
  let used = 0

  /** 把队列里能进的请求放进来。静态批只在**整批空了**的时候换人。 */
  const admit = () => {
    if (!cfg.cont && slots.length > 0) return
    while (slots.length < cfg.batch && queue.length) {
      const { i, r } = queue[0]!
      const h = hold(r)
      //  显存不够就等下一轮。`slots.length > 0` 是防死锁的活门:一个请求大到单独都放不下时
      //  也得让它进去跑,否则队列永远排不动 —— 真引擎这时会报「超出上下文」,本作不做这条。
      if (used + h > vram && slots.length > 0) break
      queue.shift()
      const s: Slot = { r, ctx: [...r.prompt], gen: [], done: false, hold: h, start: out.time }
      slots.push(s); idxOf.set(s, i); used += h; out.startAt[i] = out.time
      //  prefill:把 prompt 那一段的 K/V 先算出来存下 —— 只有装了 KV Cache 才值得做
      if (cfg.kvcache) out.time += COST.kv * r.prompt.length
    }
    out.peak = Math.max(out.peak, used)
  }

  admit()
  let guard = 0
  while (slots.length && guard++ < 20000) {
    let cost = COST.stepFix
    for (const s of slots) {
      const t = s.ctx.length
      //  ⚠️ 跑完的请求**还占着位置、还在被算**(padding)—— 静态批的气泡就是这么来的。
      cost += COST.attn * t
      cost += cfg.kvcache ? COST.kv : COST.kv * t
      if (cfg.kvcache && cfg.paged) cost += COST.pageTax * Math.ceil(t / cfg.page)
      if (cfg.speculate && !s.done) { cost += COST.draft * cfg.spec + COST.attn * cfg.spec }
    }
    out.time += cost; out.steps++

    for (const s of slots) {
      if (s.done) continue
      let advance = 1
      if (cfg.speculate) {
        /*  投机解码:草稿先猜 spec 个,大模型一次把它们全验一遍。
            接受到**第一个猜错的地方为止**,然后验证那一步本身还会正确地吐出一个。
            所以吐出来的 token 恒等于不投机的那一串 —— 这条是真系统的验收标准,不是我加的规矩。 */
        const draftToks: number[] = []
        //  草稿模型只看得见最后一个 token,所以往下猜时只需要顺着 b 走
        let b = s.ctx[s.ctx.length - 1] ?? 0
        for (let k = 0; k < cfg.spec; k++) { const d = draftNext(b); draftToks.push(d); b = d }
        out.drafted += cfg.spec
        let acc = 0
        let ca = s.ctx[s.ctx.length - 2] ?? 0, cb = s.ctx[s.ctx.length - 1] ?? 0
        for (const d of draftToks) {
          if (realNext(ca, cb) !== d) break
          acc++; ca = cb; cb = d
        }
        out.accepted += acc
        advance = acc + 1
      }
      for (let k = 0; k < advance && !s.done; k++) {
        const t = realNext(s.ctx[s.ctx.length - 2] ?? 0, s.ctx[s.ctx.length - 1] ?? 0)
        s.ctx.push(t); s.gen.push(t)
        if (s.gen.length >= s.r.out) {
          s.done = true
          const i = idxOf.get(s)!
          out.gen[i] = s.gen; out.finish[i] = out.time
          out.tpot = Math.max(out.tpot, Math.round((out.time - s.start) / s.r.out))
        }
      }
    }

    //  连续批:谁跑完谁就走,位置立刻腾出来。静态批:全批跑完才一起走。
    if (cfg.cont) {
      for (let k = slots.length - 1; k >= 0; k--) if (slots[k]!.done) {
        used -= slots[k]!.hold; out.leaveAt[idxOf.get(slots[k]!)!] = out.time; slots.splice(k, 1)
      }
    } else if (slots.every(s => s.done)) {
      for (const s of slots) { used -= s.hold; out.leaveAt[idxOf.get(s)!] = out.time }
      slots.length = 0
    }
    admit()
  }

  const total = reqs.reduce((n, r) => n + r.out, 0)
  out.tput = out.time ? Math.round(1000 * total / out.time) : 0
  out.worst = Math.max(...out.finish)
  return out
}

/** 你的引擎和「老老实实一个一个生成」是不是吐了同一串 token。 */
export function sameAsNaive(reqs: Req[], r: EngineRun) {
  const ref = runNaive(reqs)
  if (ref.length !== r.gen.length) return false
  return ref.every((g, i) => g.length === r.gen[i]!.length && g.every((t, k) => t === r.gen[i]![k]))
}

// —— 关卡 ——
export type Level = {
  name: string; short: string; story: string; hint: string
  reqs: Req[]
  /** 显存上限(以 token 计)—— HBM 是给死的,和 cache 那台的芯片面积一个道理。 */
  vram: number
  /** 模型的最大上下文长度。不分页时,一个请求进来就得按它连续预留一整块(没人知道它会说多长)。 */
  maxLen: number
  batchOpts: number[]; pageOpts: number[]; specOpts: number[]
  parts: Part[]
  /** 目标:总时间要压到这以内;有的关还卡「最坏吐字间隔」(吞吐和延迟打架的那一关)。 */
  par: { time: number; tpot?: number }
  finale?: boolean
}

/** 造一段 prompt:确定性,长度不同,内容不同。 */
const prm = (n: number, seed: number) => Array.from({ length: n }, (_, i) => (seed * 3 + i * 5) % V)
const req = (p: number, o: number, seed: number): Req => ({ prompt: prm(p, seed), out: o })

export const LEVELS: Level[] = [
  {
    name: '真·推理引擎 · 每个 token 都从头重算',
    short: 'KV Cache',
    story: '生成第 100 个 token 的时候,前面 99 个的 K/V 又被从头算了一遍 —— 每一步都是。',
    hint: '注意力要读上下文里每一个位置的 K/V。没地方存的话,每生成一个 token 就得把整段上下文的 K/V 重算一遍 —— 生成 n 个 token 就是 n² 的账。装上〈KV Cache〉:算过的 K/V 存下来,每一步只算新来的那一个位置,n² 就塌成 n。代价是显存,不过这一关显存管够,先把这笔账看清楚。',
    reqs: [req(16, 32, 1)],
    vram: 4096, maxLen: 64, batchOpts: [1], pageOpts: [8], specOpts: [0], parts: ['kvcache'],
    par: { time: 11568 },
  },
  {
    name: '真·推理引擎 · 静态批的气泡',
    short: '连续批',
    story: '一批里有人 6 个 token 就说完了,有人要说 60 个 —— 说完的那几个还占着位置陪跑。',
    hint: '一步的大头是把整个模型的权重读一遍,这笔钱按步收,不按人收 —— 所以几个请求凑一步跑是划算的。可静态批处理是「整批一起进、整批一起出」:短请求早早生成完了,它的位置却要等最长那个也完事才腾出来,这中间每一步都在给它做无用功(padding)。装上〈连续批处理〉:谁跑完谁立刻走,队列里下一个马上补进来,位置一刻不空。盯着「走了几步」那个读数 —— 装和不装差的就是那些空转的步。',
    reqs: [req(8, 6, 1), req(8, 60, 2), req(8, 7, 3), req(8, 8, 4), req(8, 6, 5), req(8, 9, 6), req(8, 7, 7), req(8, 8, 8)],
    vram: 4096, maxLen: 96, batchOpts: [1, 2, 4], pageOpts: [8], specOpts: [0], parts: ['kvcache', 'cont'],
    par: { time: 24322 },
  },
  {
    name: '真·推理引擎 · 显存装不下',
    short: '分页 KV',
    story: '一个请求刚进来,没人知道它要说多长 —— 于是只能按「模型能吃下的最长上下文」给它连续留一整块。',
    hint: '装了 KV Cache 就得给它显存,而不分页的话,每个请求都要一整块连续空间。麻烦在于:请求刚到时谁也不知道它会生成多少个 token,所以只能按模型的最大上下文长度来留 —— 于是一屋子短请求也把显存占满了,并发上不去,吞吐就上不去。装上〈分页 KV〉:KV 拆成一页一页地放,不用连着,一个请求只按它自己需要的那么多页占。同样的显存,能同时跑的请求一下子多起来 —— 记得把批大小也跟着调上去。',
    reqs: [req(8, 8, 1), req(8, 10, 2), req(12, 8, 3), req(8, 12, 4), req(10, 8, 5), req(8, 40, 6)],
    vram: 192, maxLen: 64, batchOpts: [1, 2, 4, 6], pageOpts: [4, 8, 16, 32], specOpts: [0],
    parts: ['kvcache', 'paged', 'cont'],
    par: { time: 16791 },
  },
  {
    name: '真·推理引擎 · 页开多大',
    short: '页多大',
    story: '页开大了,每个请求最后那一页大半是空的;页开小了,页多得查不过来。',
    hint: '这和 Cache 那台的「块大小」是同一个旋钮:向上取整到页,取整浪费掉的那部分就是内部碎片。页大 → 碎片大 → 同样的显存塞不下几个请求 → 并发低;页小 → 碎片小,可每一步都要把更多页查一遍(页表不是白查的)。所以最优不在两头 —— 一档一档挪过去,把总时间的曲线走一遍,你会看到一个碗底。',
    reqs: [req(10, 25, 1), req(8, 28, 2), req(12, 24, 3), req(10, 27, 4), req(8, 26, 5), req(11, 25, 6), req(9, 26, 7), req(10, 24, 8)],
    vram: 256, maxLen: 96, batchOpts: [1, 2, 4, 6, 8], pageOpts: [1, 2, 4, 8, 16, 32, 64], specOpts: [0],
    parts: ['kvcache', 'paged', 'cont'],
    par: { time: 26222 },
  },
  {
    name: '真·推理引擎 · 批大了,字就一顿一顿地蹦',
    short: '吞吐 vs 延迟',
    story: '批开得越大,每拍吐出的 token 越多 —— 可对坐在屏幕前的那一个人来说,字反而蹦得越慢。',
    hint: '这一关头一回有两个目标,而且它们互相打架。批越大,读权重那笔固定开销摊得越薄,总时间越短、吞吐越高;可一步要算的东西也越多,每一步都更久 —— 而一个用户看到的字,就是一步蹦一个。所以这一关同时卡两条线:总时间要够快,而且最坏的「吐字间隔」不能超过上限。一档一档试过去,能同时满足两条的只有中间那几档。',
    reqs: [req(8, 12, 1), req(8, 14, 2), req(8, 12, 3), req(8, 16, 4), req(8, 12, 5), req(8, 14, 6), req(8, 12, 7), req(8, 15, 8)],
    vram: 4096, maxLen: 96, batchOpts: [1, 2, 4, 8], pageOpts: [8], specOpts: [0], parts: ['kvcache', 'cont'],
    par: { time: 14247, tpot: 492 },
  },
  {
    name: '真·推理引擎 · 投机解码',
    short: '投机解码',
    story: '让一个便宜的小模型先抢答几个,大模型一次把它们全批改 —— 答对的白赚,答错的丢掉。',
    hint: '读权重那笔钱是按「一步」收的,不是按「这一步吐了几个 token」收的 —— 所以一步里能多吐几个就是白赚。装上〈投机解码〉:草稿模型先猜 k 个,大模型一次前向把这 k 个全验一遍,从第一个猜错的地方截断,再顺带正确地吐一个。⚠️ 猜错的那些是白猜,草稿的钱照付,所以 k 不是越大越好:k 太小赚不到,k 太大全赔在草稿上。本作的草稿模型只看得见最后一个 token,遇到要往回多看一步的位置就必错,而且一错后面全废 —— 找那个甜点。',
    reqs: [req(8, 24, 1), req(8, 24, 2), req(8, 28, 3), req(8, 24, 4)],
    vram: 4096, maxLen: 96, batchOpts: [1, 2, 4], pageOpts: [8], specOpts: [0, 1, 2, 3, 4, 6, 8],
    parts: ['kvcache', 'cont', 'speculate'],
    par: { time: 5835 },
  },
  {
    name: '终关 · 一批真请求跑到底',
    short: '终关',
    story: '长短不一的一批请求、给死的显存、要吞吐也要不让人等 —— 一台真引擎每天面对的就是这个。',
    hint: '把学过的全用上:〈KV Cache〉把 n² 压成 n、〈连续批处理〉不让位置空转、〈分页 KV〉把显存省出并发、页大小找碗底、批大小在吞吐和吐字间隔之间找平衡、〈投机解码〉再抠一层。显存是给死的,加哪样都得从另一样身上匀。结果一定是对的(吐出来的 token 恒等于老老实实生成一遍),比的是时间和吐字间隔。',
    reqs: [req(8, 8, 1), req(12, 30, 2), req(8, 10, 3), req(8, 48, 4), req(10, 9, 5), req(8, 12, 6), req(8, 8, 7), req(14, 20, 8), req(8, 11, 9), req(8, 9, 10)],
    vram: 384, maxLen: 128, batchOpts: [1, 2, 4, 6, 8], pageOpts: [2, 4, 8, 16, 32], specOpts: [0, 1, 2, 3, 4],
    parts: ['kvcache', 'paged', 'cont', 'speculate'],
    par: { time: 11104, tpot: 342 }, finale: true,
  },
]

// —— 穷举:一关里所有真的给了的配法 ——
export type Combo = { cfg: Cfg; time: number; worst: number; tpot: number; tput: number; ok: boolean; peak: number }
export function allConfigs(L: Level): Cfg[] {
  const out: Cfg[] = []
  const has = (p: Part) => L.parts.includes(p)
  const bools = (p: Part) => has(p) ? [false, true] : [false]
  for (const batch of L.batchOpts)
    for (const page of L.pageOpts)
      for (const spec of L.specOpts)
        for (const kvcache of bools('kvcache'))
          for (const paged of bools('paged'))
            for (const cont of bools('cont'))
              for (const speculate of bools('speculate')) {
                //  没装分页时页大小没有意义,没装投机时草稿长度也没有 —— 只留一份,免得同一台机器被数很多遍
                if (!paged && page !== L.pageOpts[0]) continue
                if (!speculate && spec !== L.specOpts[0]) continue
                if (speculate && spec === 0) continue
                out.push({ batch, page, spec, kvcache, paged, cont, speculate })
              }
  return out
}
export function sweep(L: Level): Combo[] {
  return allConfigs(L).map(cfg => {
    const r = runEngine(L.reqs, cfg, L.vram, L.maxLen)
    return { cfg, time: r.time, worst: r.worst, tpot: r.tpot, tput: r.tput, peak: r.peak, ok: sameAsNaive(L.reqs, r) }
  })
}
