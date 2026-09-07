/**
 * 「搭机器」第七台设备 · GPU(一个 SM 上跑一个真 kernel)—— 纯内核,零 DOM。
 *
 * 这台不像前六台那样从「一条物理事实」出发,它从**一条执行规则**出发:
 *   **32 个线程绑成一个 warp,锁步执行同一条指令(SIMT)。**
 * 一旦接受这条,后面全是它的后果:
 *   一个 warp 里的 32 个地址不连着,就得发 32 笔访存(合并)→
 *   同一块数据反复从显存读太亏,搬进共享内存(分块)→
 *   搬完不打招呼就用,读到的是上一轮的残渣(同步栅栏)→
 *   共享内存分 32 个 bank,一列上的线程全撞同一个 bank(padding)→
 *   访存要等两百拍,只有让别的 warp 顶上才藏得住(占用率)→
 *   一个 warp 里的线程走了不同分支,两条路都得走一遍(发散)→ 终关
 *
 * 跑的是一个真 kernel:C = A × B(32×32),外加「(i+j) 是偶数的那些格子多算一笔」——
 * 最后那一条是为了让分支发散有地方发生,真 kernel 里的掩码运算就长这样。
 *
 * ── 焊死的口径 ──
 * 参考解释器 `refC`:CPU 上老老实实三重循环算一遍。你在 GPU 上算出来的 C 必须一格不差。
 *
 * ⚠️ 这台**真的会算错**:分块之后不打同步栅栏,一个线程就会去读别的线程还没写完的那块共享内存。
 * 本作把这件事确定化成「读到上一轮 tile 的残渣」—— 真机器上它是不确定的,但错的方式一样:
 * 你用的不是这一轮的数据。
 */

export const N = 32          // 矩阵边长,正好等于一个 warp 的宽度 —— 一个 warp 管一行
export const WARP = 32
export const BANKS = 32      // 共享内存的 bank 数

/**
 * 一个 SM 的寄存器总量(以「多少个线程份」计)。每线程用得越多,能同时驻留的 warp 越少。
 * ⚠️ 给小了的话驻留数只能在 1 和 2 之间动,占用率那一关就没考头 —— 现在的档位是 1 / 4 / 16 个 warp。
 */
export const REGFILE = 16384
export const MAX_WARPS = 16  // 硬件上限:一个 SM 最多驻留这么多 warp

/** 各种操作要多少拍。量级取自真 GPU:显存延迟几百拍,共享内存几拍,ALU 一拍。 */
export const COST = {
  alu: 1,
  /** 一笔显存事务占住访存端口多久(不是延迟,是吞吐)。 */
  trans: 4,
  /** 显存延迟 —— 只有让别的 warp 顶上才藏得住。 */
  lat: 200,
  /** 共享内存一「路」冲突多少拍。撞 k 路就是 k 倍。 */
  smem: 2,
}

export type Cfg = {
  /** 分块边长;0 = 不分块(每次乘法都直接从显存取)。 */
  tile: number
  /** 共享内存每行多留几个字。留 1 个就能把「一列全撞同一个 bank」错开。 */
  pad: number
  /** B 在显存里怎么摆:'row' 一行连着放(一个 warp 取一行 = 一笔事务);'col' 一列连着放(散成 32 笔)。 */
  bLayout: 'row' | 'col'
  /** 每个线程用几个寄存器 —— 它决定一个 SM 上能同时驻留几个 warp。 */
  regs: number
  /** 线程怎么分到格子上:'row' 按行铺(一个 warp 里奇偶交错);'sorted' 按「要不要多算那一笔」分好组。 */
  mapping: 'row' | 'sorted'
  sync: boolean
}
export type Part = 'sync'

export type GpuRun = {
  C: number[]
  time: number
  /** 一共发了多少笔显存事务(合并得好这个数就小)。 */
  trans: number
  /** 共享内存最严重撞了几路。 */
  worstConflict: number
  /** 同时驻留几个 warp,一共要跑几波。 */
  resident: number; waves: number
  /** 有几个 warp 里的线程走了不同分支(两条路都得走一遍)。 */
  divergent: number
  /** 花在「干等显存」上的拍数 —— 占用率够不够,看这个。 */
  stalled: number
}

// —— 数据:确定性,好对账 ——
export const A = (i: number, j: number) => (i * 3 + j * 7) % 17
export const B = (i: number, j: number) => (i * 5 + j * 11) % 13
/** (i+j) 是偶数的格子要多算一笔 —— 真 kernel 里的掩码运算,也是分支发散的由来。 */
export const masked = (i: number, j: number) => (i + j) % 2 === 0
export const extra = (i: number) => A(i, i)

/** 参考答案:CPU 上三重循环。 */
export function refC(): number[] {
  const C = new Array<number>(N * N).fill(0)
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    let s = 0
    for (let k = 0; k < N; k++) s += A(i, k) * B(k, j)
    C[i * N + j] = s + (masked(i, j) ? extra(i) : 0)
  }
  return C
}

/**
 * 你搭的这台 GPU 算出来的 C。
 *
 * 不分块、或者分块且打了同步栅栏 —— 都是对的。
 * 分块却没打栅栏:一个线程把这一轮的 tile 写进共享内存,别的线程还没写完它就读了,
 * 读到的是**上一轮留在那儿的残渣**(第一轮就是 0)。本作把它确定化成这个样子,
 * 真机器上具体读到什么是不确定的,但错法一样:你用的不是这一轮的数据。
 */
function computeC(cfg: Cfg): number[] {
  const C = new Array<number>(N * N).fill(0)
  const add = (i: number, j: number, v: number) => { C[i * N + j] = (C[i * N + j] ?? 0) + v }
  if (!cfg.tile) {
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      let s = 0
      for (let k = 0; k < N; k++) s += A(i, k) * B(k, j)
      add(i, j, s)
    }
  } else {
    const T = cfg.tile, nt = N / T
    for (let bi = 0; bi < nt; bi++) for (let bj = 0; bj < nt; bj++) {
      //  这一块输出用到的两块共享内存。没有栅栏时,读的是上一轮提交的那份
      let seenA = new Array<number>(T * T).fill(0), seenB = new Array<number>(T * T).fill(0)
      for (let kb = 0; kb < nt; kb++) {
        const curA: number[] = [], curB: number[] = []
        for (let a = 0; a < T; a++) for (let b = 0; b < T; b++) {
          curA[a * T + b] = A(bi * T + a, kb * T + b)
          curB[a * T + b] = B(kb * T + a, bj * T + b)
        }
        const useA = cfg.sync ? curA : seenA, useB = cfg.sync ? curB : seenB
        for (let a = 0; a < T; a++) for (let b = 0; b < T; b++) {
          let s = 0
          for (let t = 0; t < T; t++) s += (useA[a * T + t] ?? 0) * (useB[t * T + b] ?? 0)
          add(bi * T + a, bj * T + b, s)
        }
        seenA = curA; seenB = curB
      }
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (masked(i, j)) add(i, j, extra(i))
  return C
}

// —— 一个 warp 要执行的指令流 ——
type Op =
  | { k: 'alu'; n: number }
  | { k: 'gload'; trans: number }
  | { k: 'sload'; conf: number }
  | { k: 'sync' }

/** 一个 warp 的 32 条地址落在几个 32 字的段里 —— 这就是「合并成几笔事务」。 */
export function transactionsFor(addrs: number[]) {
  return new Set(addrs.map(a => a >> 5)).size
}
/** 一个 warp 的 32 条共享内存地址,最挤的那个 bank 上压了几条 —— 那就是冲突路数。 */
export function conflictFor(addrs: number[]) {
  const cnt = new Array<number>(BANKS).fill(0)
  for (const a of addrs) cnt[a % BANKS] = (cnt[a % BANKS] ?? 0) + 1
  return Math.max(...cnt)
}

/** 线程编号 → 它负责哪个格子。'sorted' 把「要多算那一笔」的格子排到一起,好让分支在 warp 内一致。 */
export function cellOf(t: number, mapping: Cfg['mapping']) {
  if (mapping === 'row') return { i: Math.floor(t / N), j: t % N }
  //  先把所有「要多算」的格子排在前面,再排剩下的 —— 于是一个 warp 里要么全做要么全不做
  const half = (N * N) / 2
  const idx = t < half ? t : t - half
  const want = t < half
  let seen = -1
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (masked(i, j) !== want) continue
    if (++seen === idx) return { i, j }
  }
  return { i: 0, j: 0 }
}

/** 画面上那一屏用的:一个 warp 取 B 的那一下,32 个 lane 各要哪个地址(页面把它画成 32 个格子)。 */
export function demoGlobalAddrs(cfg: Cfg) {
  const cells = Array.from({ length: WARP }, (_, l) => cellOf(l, cfg.mapping))
  return cells.map(c => cfg.bLayout === 'row' ? 0 * N + c.j : c.j * N + 0)
}
/** 画面上那一屏用的:按列读共享内存那一下,32 个 lane 分别落在哪个 bank 上。 */
export function demoSharedBanks(cfg: Cfg) {
  const stride = (cfg.tile || N) + cfg.pad
  return Array.from({ length: WARP }, (_, l) => (l * stride) % BANKS)
}
/** 画面上那一屏用的:每个 warp 里的 32 个线程,判定一不一致(不一致就是发散)。 */
export function warpDivergence(cfg: Cfg) {
  return Array.from({ length: (N * N) / WARP }, (_, w) => {
    const want = Array.from({ length: WARP }, (_, l) => { const c = cellOf(w * WARP + l, cfg.mapping); return masked(c.i, c.j) })
    return { any: want.some(Boolean), all: want.every(Boolean) }
  })
}

/** 把一个 warp 要干的活翻成指令流。 */
function warpOps(w: number, cfg: Cfg): Op[] {
  const ops: Op[] = []
  const cells = Array.from({ length: WARP }, (_, l) => cellOf(w * WARP + l, cfg.mapping))
  /** B 的地址:按行摆的话同一行连着;按列摆的话跨一整行,32 个 lane 全散开。 */
  const bAddr = (k: number, j: number) => cfg.bLayout === 'row' ? k * N + j : j * N + k

  if (!cfg.tile) {
    for (let k = 0; k < N; k++) {
      ops.push({ k: 'gload', trans: transactionsFor(cells.map(c => c.i * N + k)) })   // A[i][k]
      ops.push({ k: 'gload', trans: transactionsFor(cells.map(c => bAddr(k, c.j))) }) // B[k][j]
      ops.push({ k: 'alu', n: COST.alu })
    }
  } else {
    const T = cfg.tile, stride = T + cfg.pad
    for (let kb = 0; kb < N / T; kb++) {
      /*  往共享内存里搬:每个 lane 搬一个字。
          A 那块:lane 沿着 k 方向取,地址连着 → 一笔。
          B 那块:这个 warp 负责 B tile 的某一行,32 个 lane 沿着 j 方向取 ——
          B 按行摆的话地址连着(一笔),按列摆的话每个 lane 隔一整行(32 笔)。
          ⚠️ 第一版两处都写成了 c.j % T,于是行摆和列摆算出来的地址一模一样,
          「访存合并」这个旋钮在分块之后成了摆设。 */
      ops.push({ k: 'gload', trans: transactionsFor(cells.map((c, l) => c.i * N + kb * T + (l % T))) })
      ops.push({ k: 'gload', trans: transactionsFor(cells.map(c => bAddr(kb * T + (w % T), c.j))) })
      if (cfg.sync) ops.push({ k: 'sync' })
      for (let t = 0; t < T; t++) {
        /*  读 A 的那一块是**按列读**的(tile 转置着存,真 kernel 里常这么干)——
            32 个 lane 的地址相差一整行,行宽正好等于 bank 数时全撞同一个 bank。
            每行多留一个字(padding)就把它们错开了。 */
        ops.push({ k: 'sload', conf: conflictFor(cells.map((_, l) => l * stride + t)) })
        ops.push({ k: 'sload', conf: conflictFor(cells.map((_, l) => t * stride + l)) })   // 读 B 那块是按行,本来就不撞
        ops.push({ k: 'alu', n: COST.alu })
      }
      if (cfg.sync) ops.push({ k: 'sync' })
    }
  }
  /*  掩码那一笔:一个 warp 里只要有人要做、有人不做,两条路都得走一遍(发散)。
      ⚠️ 这一笔得够重。第一版只给 4 拍,结果「按分支分组」省下的那点还抵不上它自己
      在访存合并上亏掉的(把格子打散重排,地址就不连着了)—— 于是修了发散反而更慢,
      那一关的结论整个是反的。真 kernel 里的掩码分支本来就是一段活,不是一条指令。 */
  const want = cells.map(c => masked(c.i, c.j))
  if (want.some(Boolean)) ops.push({ k: 'alu', n: 32 * COST.alu })
  return ops
}
const isDivergent = (w: number, cfg: Cfg) => {
  const want = Array.from({ length: WARP }, (_, l) => { const c = cellOf(w * WARP + l, cfg.mapping); return masked(c.i, c.j) })
  return want.some(Boolean) && !want.every(Boolean)
}

/**
 * 一波 warp 在一个 SM 上跑。
 *
 * 发射端口一次只能发一条指令,所以指令本身是排队的;而**显存的延迟是可以藏的** ——
 * 一个 warp 发完访存就得等两百拍,这段时间里别的 warp 照样能发指令。
 * 驻留的 warp 越多,藏得越干净;少了就只能干等 —— 这就是占用率。
 */
function runWave(warps: Op[][]): { time: number; stalled: number } {
  const n = warps.length
  const pc = new Array<number>(n).fill(0)
  const readyAt = new Array<number>(n).fill(0)
  const atBarrier = new Array<boolean>(n).fill(false)
  let now = 0, stalled = 0, rr = 0, guard = 0
  const done = (w: number) => pc[w]! >= warps[w]!.length
  while (guard++ < 500000) {
    if (Array.from({ length: n }, (_, w) => w).every(done)) break
    //  所有还没跑完的都卡在栅栏上 → 一起放行
    const live = Array.from({ length: n }, (_, w) => w).filter(w => !done(w))
    if (live.length && live.every(w => atBarrier[w])) {
      for (const w of live) { atBarrier[w] = false; pc[w]!++ }
      continue
    }
    let picked = -1
    for (let k = 0; k < n; k++) {
      const w = (rr + k) % n
      if (done(w) || atBarrier[w] || readyAt[w]! > now) continue
      picked = w; rr = (w + 1) % n; break
    }
    if (picked < 0) {
      //  没有 warp 能发指令 —— 全在等显存。往前跳到最早那个醒来的时刻,这段就是暴露出来的延迟
      const next = Math.min(...live.filter(w => !atBarrier[w]).map(w => readyAt[w]!))
      if (!isFinite(next) || next <= now) break
      stalled += next - now; now = next; continue
    }
    const op = warps[picked]![pc[picked]!]!
    if (op.k === 'sync') { atBarrier[picked] = true; continue }
    pc[picked]!++
    if (op.k === 'alu') now += op.n
    else if (op.k === 'sload') now += op.conf * COST.smem
    else { now += op.trans * COST.trans; readyAt[picked] = now + COST.lat }
  }
  return { time: now, stalled }
}

export function runGpu(cfg: Cfg): GpuRun {
  const nWarps = (N * N) / WARP
  const resident = Math.max(1, Math.min(MAX_WARPS, Math.floor(REGFILE / (cfg.regs * WARP))))
  const all = Array.from({ length: nWarps }, (_, w) => warpOps(w, cfg))
  let time = 0, stalled = 0
  //  驻留不下的 warp 排到下一波 —— 真 GPU 也是一波一波调度块的
  const waves = Math.ceil(nWarps / resident)
  for (let s = 0; s < nWarps; s += resident) {
    const r = runWave(all.slice(s, s + resident))
    time += r.time; stalled += r.stalled
  }
  const trans = all.flat().reduce((n2, o) => n2 + (o.k === 'gload' ? o.trans : 0), 0)
  const worstConflict = Math.max(1, ...all.flat().map(o => o.k === 'sload' ? o.conf : 1))
  const divergent = Array.from({ length: nWarps }, (_, w) => w).filter(w => isDivergent(w, cfg)).length
  return { C: computeC(cfg), time, trans, worstConflict, resident, waves, divergent, stalled }
}

export function sameAsRef(r: GpuRun) {
  const ref = refC()
  return ref.length === r.C.length && ref.every((v, i) => v === r.C[i])
}

// —— 关卡 ——
export type Level = {
  name: string; short: string; story: string; hint: string
  tileOpts: number[]
  padOpts: number[]
  layoutOpts: Cfg['bLayout'][]
  regOpts: number[]
  mapOpts: Cfg['mapping'][]
  parts: Part[]
  par: { time: number }
  finale?: boolean
}

export const LEVELS: Level[] = [
  {
    name: '真·GPU · 一个 warp 的 32 条地址',
    short: '访存合并',
    story: '32 个线程锁步走同一条指令。它们要的 32 个地址要是连着,一笔就取回来了;散开的话,得发 32 笔。',
    hint: '这一关不分块,每次乘法都直接从显存取。一个 warp 里的 32 个线程负责同一行上相邻的 32 个格子,所以取 A 的时候大家要的是同一个字(广播,一笔)、取 B 的时候要的是连着的 32 个字 —— 前提是 B 按行摆。把 B 改成按列摆试试:同样的 32 个线程,地址一下子隔开了一整行,一笔变 32 笔。盯着「显存事务」那个读数。',
    tileOpts: [0], padOpts: [0], layoutOpts: ['col', 'row'], regOpts: [128], mapOpts: ['row'], parts: [],
    par: { time: 105752 },
  },
  {
    name: '真·GPU · 搬进共享内存',
    short: '分块',
    story: '同一块数据被几十个线程反复从显存里取 —— 不如一次搬进片上的共享内存,大家在那儿反复用。',
    hint: '不分块的话,算一行输出要把整个 B 走一遍,而隔壁那行输出又把 B 走一遍。分块之后:一小块 A、一小块 B 先搬进共享内存(显存只读一次),块里的乘加全在片上完成 —— 共享内存比显存快两个数量级。把分块打开,再挑一个块边长。⚠️ 分块之后结果可能是错的,下一关会讲为什么;这一关先把「显存事务」压下来。',
    tileOpts: [0, 8, 16], padOpts: [1], layoutOpts: ['row'], regOpts: [128], mapOpts: ['row'], parts: ['sync'],
    par: { time: 12864 },
  },
  {
    name: '真·GPU · 搬完得打个招呼',
    short: '同步栅栏',
    story: '你把自己那一格搬进了共享内存,可隔壁线程还没搬完 —— 你就去读了。读到的是上一轮的残渣。',
    hint: '⚠️ 这是这台机器唯一会算错的地方,也是 CUDA 新手最经典的那个 bug。一个块里的线程各搬一格进共享内存,然后大家一起读整块 —— 可它们是并行跑的,谁也不知道别人搬完没有。装上〈同步栅栏〉(__syncthreads):所有线程都搬完了才往下走。光看时间会以为不装更快,底下那行「算出来的 C 对不对」会告诉你真相。',
    tileOpts: [8, 16], padOpts: [1], layoutOpts: ['row'], regOpts: [128], mapOpts: ['row'], parts: ['sync'],
    par: { time: 12864 },
  },
  {
    name: '真·GPU · 一列全撞同一个 bank',
    short: 'bank 冲突',
    story: '共享内存分成 32 个 bank。一个 warp 的 32 个线程要是全落在同一个 bank 上,就只能一个一个来。',
    hint: '共享内存是按 bank 交叉编址的:地址 % 32 就是 bank 号。这个 kernel 有一次是按列读那块共享内存 —— 32 个线程的地址正好相差一整行。行宽要是正好 32(等于 bank 数),那 32 条地址的 bank 号全一样,一次访问被拆成 32 次。解法在真 CUDA 里就一个字:每行多留一个字(padding),行宽变成 33,32 条地址的 bank 号就全错开了。盯着「最严重撞了几路」。',
    tileOpts: [32], padOpts: [0, 1], layoutOpts: ['row'], regOpts: [128], mapOpts: ['row'], parts: ['sync'],
    par: { time: 9504 },
  },
  {
    name: '真·GPU · 拿别的 warp 把延迟填上',
    short: '占用率',
    story: '一次显存访问要等两百拍。GPU 不是靠等得快取胜的,是靠这段时间里还有别的 warp 能干活。',
    hint: 'GPU 藏延迟的办法不是缓存,是换人:一个 warp 发完访存就挂起,SM 立刻去发别的 warp 的指令。能同时驻留几个 warp,取决于每个线程占多少寄存器 —— 寄存器堆就那么大,每线程用得越多,驻留的越少,延迟就越藏不住。把「每线程寄存器数」调下来,看「干等显存」那个读数怎么掉。⚠️ 真 GPU 上寄存器少了会往显存上溢出,本作不做那一层,所以这一关是「越少越好」。',
    tileOpts: [16], padOpts: [1], layoutOpts: ['row'], regOpts: [128, 64, 32], mapOpts: ['row'], parts: ['sync'],
    par: { time: 8016 },
  },
  {
    name: '真·GPU · 一个 warp 里走了两条路',
    short: '分支发散',
    story: '锁步的代价:一个 warp 里只要有人走 if、有人走 else,两条路都得走一遍,各走各的时候另一半干等着。',
    hint: '这个 kernel 里有一笔掩码运算:只有 (i+j) 是偶数的格子才要多算。按行铺线程的话,一个 warp 里的 32 个格子奇偶交错 —— 每个 warp 都发散,那一笔谁也躲不掉。真 CUDA 里的解法是让分支和 warp 对齐:把「要做」的格子先归到一起再分线程,于是每个 warp 要么全做要么全不做,不做的那些整个 warp 直接跳过。把线程映射从「按行铺」换成「按分支分组」,看「发散的 warp」那个读数。',
    tileOpts: [16], padOpts: [1], layoutOpts: ['row'], regOpts: [32], mapOpts: ['row', 'sorted'], parts: ['sync'],
    par: { time: 7760 },
  },
  {
    name: '终关 · 把这个 kernel 调到最快',
    short: '终关',
    story: '合并、分块、同步、padding、占用率、发散 —— 一个 kernel 上全都要顾到。',
    hint: '把学过的全用上:B 按行摆让访存合并、分块把显存读降下来、〈同步栅栏〉保证算得对、padding 错开 bank、寄存器压低换驻留 warp、线程映射按分支分组避开发散。算出来的 C 必须和 CPU 三重循环一格不差,比的是拍数。',
    tileOpts: [0, 8, 16, 32], padOpts: [0, 1], layoutOpts: ['col', 'row'], regOpts: [512, 128, 32],
    mapOpts: ['row', 'sorted'], parts: ['sync'],
    par: { time: 6696 }, finale: true,
  },
]

// —— 穷举 ——
export type Combo = { cfg: Cfg; time: number; trans: number; worstConflict: number; resident: number; divergent: number; stalled: number; ok: boolean }
export function allConfigs(L: Level): Cfg[] {
  const out: Cfg[] = []
  const syncs = L.parts.includes('sync') ? [false, true] : [false]
  for (const tile of L.tileOpts)
    for (const pad of L.padOpts)
      for (const bLayout of L.layoutOpts)
        for (const regs of L.regOpts)
          for (const mapping of L.mapOpts)
            for (const sync of syncs) {
              if (!tile && (pad !== L.padOpts[0] || sync)) continue   // 不分块就没有共享内存,padding 和栅栏都无从谈起
              out.push({ tile, pad, bLayout, regs, mapping, sync })
            }
  return out
}
export function sweep(L: Level): Combo[] {
  return allConfigs(L).map(cfg => {
    const r = runGpu(cfg)
    return { cfg, time: r.time, trans: r.trans, worstConflict: r.worstConflict, resident: r.resident, divergent: r.divergent, stalled: r.stalled, ok: sameAsRef(r) }
  })
}
