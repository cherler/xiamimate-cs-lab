/**
 * 实验单：**这个实验是什么、要我做什么、为什么要做。**
 *
 * ## 为什么要有这一层
 *
 * 用户原话：「实验是什么？我还是不知道。不知道要做什么？为什么要做？」——
 * 说这话的是个计算机研究生。讲解浮层已经能回答"屏幕上这块是什么"，
 * 但那是**站在实验里面**的解释；站在外面的人缺的是另外三个答案：
 * 我为什么该在乎、我该动手做什么、做完算得出什么结论。
 *
 * ## 四段
 *
 *   ① 为什么在乎   不懂这个东西，会在哪儿吃亏
 *   ② 先猜一下     动手之前先押一个 —— 押过的人才会在意结果
 *   ③ 动手        两三条**具体动作**，不是"随便玩玩"
 *   ④ 结论        **从当前轨迹现算**，不是一句写死的话
 *
 * ④ 是这一层的立身之本，理由和整个仓库一样（`docs/standards.md`）：
 * 屏幕上每个数都从验过的内核轨迹派生。写死一句"相联度越高命中率越高"，
 * 学生换一串地址就会发现它是假的 —— 而那句话正好印在一个保证正确的仿真旁边，
 * 那是最坏的位置。所以结论**必须**是拿他此刻的配置重跑出来的。
 *
 * ## 猜测记在本机，不进同步
 *
 * 进度（错题本、已掌握）走后端同步，是因为那是**学习成果**；
 * "我当时猜的是哪个"是一次性的心理锚，跨设备搬过去没有意义，
 * 而且会把 `sync.ts` 里那套已经验过的合并规则搅浑。放 localStorage。
 */
import type { TryStep } from './guide.ts'

/** 结论要重算，就得能拿到"跑一遍任意配置"的能力 —— App 里的 `runDoc` 正是它 */
export type VerdictCtx = {
  doc: { params: Record<string, unknown>; [k: string]: unknown }
  trace: unknown[]
  runDoc: (d: unknown) => unknown[]
}

export type Verdict = {
  /** ② 的哪个选项是对的（下标）。-1 = 这次算不出对错，只给数 */
  pick: number
  /** 一句话结论，**里面的数都是现算的** */
  say: string
  /** 再补一句"为什么是这样"，同样从数据推出来 */
  why: string
}

/** 目标此刻的状态。null = 现在算不出来（配置不合法、轨迹为空） */
export type GoalState = {
  /** 现在到哪儿了，一句短的：「整串命中率 25.0%」 */
  now: string
  /** 达成没有 */
  met: boolean
  /**
   * 没达成时，**差在哪儿**。
   *
   * 磁盘那条的目标是「不用 SSTF，累计寻道 ≤ 300」，而页眉只印了 `SSTF · 累计 236` ——
   * 读起来像"目标就是 SSTF，目标值 236"，正好跟真实条件反着。
   * 数达标了但**别的条件没满足**时，光看那个数会以为自己赢了。
   */
  miss?: string
}

/**
 * 目标：这个实验里"算做到了"的那件事。
 *
 * 实验单的 ③ 是照着做的动作、④ 是事后结论 —— 中间缺一个**「你还没达成 / 你达成了」
 * 的持续状态**。目标补的就是它。
 *
 * 它是整个仓库里唯一一处让**验证器直接面向用户**的地方：
 * 别的教育产品做不了这一层不是不想做，是判不了 —— 判不了就只能发徽章。
 * 所以目标只能是"能从轨迹里算出来的事"，不能是"读完了""看懂了"这种没法判的东西。
 *
 * 复用 `VerdictCtx`，和 ④ 共用同一份 `trace` / `runDoc` —— 不为一个目标多跑一遍引擎。
 */
export type Goal = {
  /** 要做到什么，一句话。写"把 X 弄到 Y"，别写"理解 X" */
  say: string
  /** 拿此刻的配置现算 */
  state: (ctx: VerdictCtx) => GoalState | null
}

export type Brief = {
  /**
   * ① **先搞懂几个词** —— 这个实验的机制底子。
   *
   * ⚠️ 这一段换过一次口径。原来写的是「为什么在乎」（动机：不懂这个会在哪儿吃亏），
   * 用户的原话是：「实验单『为什么在乎』的内容，应该变成基础解释说明的部分……
   * 现在的实验单没头没尾不知道在做什么」。
   *
   * 症结是**缺的不是动机，是定义**：三层文字（实验单 / 推演 / 讲解卡）
   * 都在**用** tag、index、组、路这些词，没有一层在**定义**它们。
   * 于是这一段改成："这一屏出现的几个词分别是什么、它们怎么接上"。
   *
   * 写的时候有一条线：**只解释这个实验特有的机制**，
   * 别去补通识（进制、字节这种）—— 用户是计算机专业毕业的，
   * 补通识既没用又冒犯（他为此专门说过一次）。
   */
  care: string
  /** ② 先猜一下 */
  guess: { q: string; opts: string[] }
  /** ③ 动手 —— 和导览共用 TryStep，param/preset 会被冒烟拿去核对页面上真有 */
  tasks: TryStep[]
  /** ④ 结论。返回 null = 现在还算不出来（配置不合法、轨迹为空） */
  verdict: (ctx: VerdictCtx) => Verdict | null
  /** 常驻目标。可选 —— 有些实验没有一个"做到了"的单一指标，硬安一个还不如不安 */
  goal?: Goal
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

/**
 * Cache **整串跑完**的命中率：末态的 hits / (i+1)。轨迹为空返回 null。
 *
 * ⚠️ 这和右边读数栏里的「命中率」不是同一个数 —— 那个是**滚动值**，
 * 只算到你此刻停的那一步。两个数摆在同一屏上，不写清楚就会打架，
 * 所以结论里的说法一律带"整串跑完"。
 */
function hitRate(trace: unknown[]): number | null {
  const s = trace[trace.length - 1] as { hits?: number; i?: number } | undefined
  if (!s || typeof s.hits !== 'number' || typeof s.i !== 'number') return null
  return s.hits / (s.i + 1)
}

/** 页面置换：整串跑完的缺页次数 */
function faults(trace: unknown[]): number | null {
  const s = trace[trace.length - 1] as { faults?: number } | undefined
  return typeof s?.faults === 'number' ? s.faults : null
}

/** 磁盘调度：整串跑完的累计寻道距离 */
function seekTotal(trace: unknown[]): number | null {
  const s = trace[trace.length - 1] as { total?: number } | undefined
  return typeof s?.total === 'number' ? s.total : null
}

/**
 * 进程调度：平均周转时间 = Σ(完成时刻 − 到达时刻) / 进程数。
 *
 * 完成时刻不在读数里，得从轨迹里刨：某个进程**第一次**出现在 `completed` 的那个 t。
 * 所以这个数只有拿到整条轨迹才算得出来 —— 正好是这一层要的东西
 * （右边读数栏只能告诉你"此刻完成了几个"，回答不了"这套算法整体好不好"）。
 */
function avgTurnaround(trace: unknown[], doc: VerdictCtx['doc']): number | null {
  const ents = (doc.entities as { id: string; type: string; at: number }[] | undefined)
    ?.filter(e => e?.type === 'process')
  if (!ents?.length) return null
  const fin: Record<string, number> = {}
  for (const st of trace as { t?: number; completed?: string[] }[]) {
    if (!st || typeof st.t !== 'number' || !Array.isArray(st.completed)) return null
    for (const id of st.completed) if (fin[id] === undefined) fin[id] = st.t
  }
  //  有进程没跑完就别编一个数出来
  if (ents.some(e => fin[e.id] === undefined)) return null
  return ents.reduce((a, e) => a + (fin[e.id] - e.at), 0) / ents.length
}

/** 流水线：整条跑完用了几个周期 */
function cycles(trace: unknown[]): number | null {
  const s = trace[trace.length - 1] as { cycle?: number } | undefined
  return typeof s?.cycle === 'number' ? s.cycle : null
}

/** 虚地址：整串跑完的 TLB 命中 / 查页表 / 缺页 */
function vmCounts(trace: unknown[]): { tlb: number; pt: number; fault: number } | null {
  const s = trace[trace.length - 1] as { tlbHits?: number; ptHits?: number; faults?: number } | undefined
  if (!s || typeof s.tlbHits !== 'number') return null
  return { tlb: s.tlbHits, pt: s.ptHits ?? 0, fault: s.faults ?? 0 }
}

/**
 * 从 IEEE 754 位串还原出**实际存进去的那个数**。
 *
 * 为什么要还原：讲"0.1 存不准"最有力的方式不是说一句"二进制存不下"，
 * 而是把机器里那个数原样念出来 —— 0.100000001490116119384765625。
 * 这个数只能从位串算，写死在文案里就等于又造了一个真源。
 */
function fromBits(bits: string): number | null {
  const n = bits.length
  if ((n !== 32 && n !== 64) || /[^01]/.test(bits)) return null
  const expBits = n === 32 ? 8 : 11
  const bias = n === 32 ? 127 : 1023
  const sign = bits[0] === '1' ? -1 : 1
  const e = parseInt(bits.slice(1, 1 + expBits), 2)
  const manStr = bits.slice(1 + expBits)
  let man = 0
  for (let k = 0; k < manStr.length; k++) if (manStr[k] === '1') man += 2 ** (-(k + 1))
  if (e === 0) return sign * man * 2 ** (1 - bias)          // 非规格化
  if (e === (1 << expBits) - 1) return man === 0 ? sign * Infinity : NaN
  return sign * (1 + man) * 2 ** (e - bias)
}

/**
 * 末步里取一个数字字段。上面那些取数器都是同一个形状，
 * 计网七个再各写一份就是七遍重复 —— 从这里开始统一走它。
 *
 * ⚠️ 取不到时返回 null，**不要退回 0**：0 是一个合法的读数
 * （零次重传、零个报文段），把"没有值"混进"值是 0"，
 * 结论会理直气壮地说错话。
 */
function tail(trace: unknown[], key: string): number | null {
  const s = trace[trace.length - 1] as Record<string, unknown> | undefined
  const v = s?.[key]
  return typeof v === 'number' ? v : null
}

/** 末步里取一个字符串字段（阶段名、状态名） */
function tailStr(trace: unknown[], key: string): string | null {
  const s = trace[trace.length - 1] as Record<string, unknown> | undefined
  const v = s?.[key]
  return typeof v === 'string' ? v : null
}

/**
 * ARQ：整串跑完的**累计传输次数**（含重传）。
 *
 * 内核把它记在 `transmissions` 上。为什么用它而不是"时隙数"当效率指标：
 * 时隙数量的是**快不快**，传输次数量的是**费不费** —— 这个实验要讲的
 * 恰恰是两者可以分开（SR 拿窗口 4 的速度跑出窗口 1 的传输次数）。
 */
function arqCost(trace: unknown[]): { sent: number; resent: number } | null {
  const s = trace[trace.length - 1] as { transmissions?: number; sent?: Record<string, number> } | undefined
  if (!s || typeof s.transmissions !== 'number' || !s.sent) return null
  //  重传 = 每个序号被发的次数减一，加起来
  const resent = Object.values(s.sent).reduce((a, n) => a + Math.max(0, n - 1), 0)
  return { sent: s.transmissions, resent }
}

/** CSMA：整串跑完各站的成功 / 放弃 / 冲突次数 */
function csmaEnd(trace: unknown[]):
  { done: number; aborted: number; total: number; worst: number } | null {
  const s = trace[trace.length - 1] as
    { done?: string[]; aborted?: string[]; attempts?: Record<string, number> } | undefined
  if (!s || !s.done || !s.aborted || !s.attempts) return null
  const ids = Object.keys(s.attempts)
  return { done: s.done.length, aborted: s.aborted.length, total: ids.length,
           worst: ids.length ? Math.max(...ids.map(k => s.attempts![k]!)) : 0 }
}

/**
 * 乘除法：整条轨迹里**真正做了一次加或减**的步数。
 *
 * 移位不算 —— 移位在硬件上几乎不花代价，而 Booth 省下来的正是加减。
 * 这个数就是"Booth 到底值不值"的唯一答案。
 */
function addSubs(trace: unknown[]): number | null {
  if (trace.length === 0) return null
  let n = 0
  for (const st of trace) {
    const a = (st as { act?: string }).act
    if (a === 'add' || a === 'sub') n++
  }
  return n
}

/** 信号量：整条轨迹里有没有走到死锁，以及末态谁卡在哪个信号量上 */
function semEnd(trace: unknown[]): { dead: boolean; blocked: Record<string, string> } | null {
  if (trace.length === 0) return null
  const last = trace[trace.length - 1] as { blocked?: Record<string, string> }
  if (!last.blocked) return null
  return {
    dead: trace.some(x => (x as { act?: string }).act === 'deadlock'),
    blocked: last.blocked,
  }
}

/** 取末步的位串 */
function finalBits(trace: unknown[]): string | null {
  const s = trace[trace.length - 1] as { bits?: string } | undefined
  return typeof s?.bits === 'string' ? s.bits : null
}

/* ── 下面 14 个实验的末态取数：只读整条轨迹的**最后一帧**里那几个标量 ──
   跟上面几个（faults / seekTotal…）同一个规矩：拿不到就返回 null，绝不编一个数。 */
const last = <T>(trace: unknown[]): T | undefined => trace[trace.length - 1] as T | undefined
type Num = number
const sortCost = (t: unknown[]) => { const s = last<{ comparisons?: Num; moves?: Num }>(t)
  return s && typeof s.comparisons === 'number' ? { cmp: s.comparisons, mv: s.moves ?? 0 } : null }
const reachCount = (t: unknown[]) => { const s = last<{ dist?: Record<string, number> }>(t)
  return s?.dist ? Object.values(s.dist).filter(d => Number.isFinite(d)).length : null }
const bankerSafe = (t: unknown[]) => { const s = last<{ act?: string; sequence?: string[] }>(t)
  return s && s.act ? { safe: s.act === 'safe', seq: s.sequence ?? [] } : null }
const avlRot = (t: unknown[]) => { const s = last<{ rotations?: Num; nodes?: unknown[] }>(t)
  return s && typeof s.rotations === 'number' ? { rot: s.rotations, n: s.nodes?.length ?? 0 } : null }
const hashASL = (t: unknown[]) => { const s = last<{ totalCompares?: Num; count?: Num }>(t)
  return s && typeof s.totalCompares === 'number' && s.count ? s.totalCompares / s.count : null }
const huffWPL = (t: unknown[]) => { const s = last<{ wpl?: Num }>(t)
  return typeof s?.wpl === 'number' ? s.wpl : null }
const kmpAdv = (t: unknown[]) => { const s = last<{ textAdvances?: Num; found?: number[] }>(t)
  return s && typeof s.textAdvances === 'number' ? { adv: s.textAdvances, found: s.found?.length ?? 0 } : null }
const mstWeight = (t: unknown[]) => { const s = last<{ weight?: Num; chosen?: string[] }>(t)
  return s && typeof s.weight === 'number' ? { w: s.weight, edges: s.chosen?.length ?? 0 } : null }
const topoSpan = (t: unknown[]) => { const s = last<{ ve?: Record<string, number>; critical?: string[] }>(t)
  if (!s?.ve) return null; const span = Math.max(0, ...Object.values(s.ve)); return { span, critical: s.critical ?? [] } }
const partFree = (t: unknown[]) => { const s = last<{ freeTotal?: Num; external?: Num }>(t)
  return s && typeof s.freeTotal === 'number' ? { free: s.freeTotal, ext: s.external ?? 0 } : null }
const inodeReads = (t: unknown[]) => { const s = last<{ reads?: Num; level?: string }>(t)
  return s && typeof s.reads === 'number' ? { reads: s.reads, level: s.level ?? '' } : null }
const bplusShape = (t: unknown[]) => { const s = last<{ height?: Num; splits?: Num }>(t)
  return s && typeof s.height === 'number' ? { h: s.height, sp: s.splits ?? 0 } : null }
const travCount = (t: unknown[]) => { const s = last<{ order?: string[]; treeEdges?: string[] }>(t)
  return s?.order ? { n: s.order.length, edges: s.treeEdges?.length ?? 0 } : null }
const bitmapFree = (t: unknown[]) => { const s = last<{ freeCount?: Num }>(t)
  return typeof s?.freeCount === 'number' ? s.freeCount : null }

export const BRIEFS: Record<string, Brief> = {
  tokenbucket: {
    care: '后端网关最常用的限流算法。一个**桶**，容量 C；每个时间单位匀速放 r 个令牌进去（满了溢出丢弃）；每个请求要拿走 1 个令牌才放行，拿不到就拒绝。\n\n妙处：**既能限住平均速率(=r)，又允许短时突发**（桶里攒的令牌能一次放出去）——这正是真实流量的样子。\n\n对比漏桶（恒定速率、不容突发），令牌桶更适合「平时限速、偶尔放突发」的接口。',
    guess: { q: '桶容量 5、速率 1/tick，到达 [3,4,2,1,5]，共放行多少？', opts: ['9', '15', '5'] },
    tasks: [{ act: '按「下一步」看每刻', watch: '开局突发 3 全放行，之后限到约每 tick 1 个。' }, { act: '想突发', watch: '桶里攒的令牌=突发额度。' }],
    verdict: ctx => { const t = ctx.trace as { totalAllowed?: number; totalRejected?: number }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `共放行 ${l.totalAllowed}、拒绝 ${l.totalRejected}。`, why: '开局桶满容突发，之后按补令牌速率限流。' } : null },
  },
  consistenthash: {
    care: '分布式缓存/分片要把键分到 N 台机器。最朴素的 **hash(key)%N** 有致命伤：加/减一台机器，N 变了，几乎所有键的归属都变，缓存全体失效、数据大搬家。\n\n**一致性哈希**：把 0..M-1 想成一个**环**，节点和键都哈希到环上某点，每个键归给**顺时针方向第一个节点**。加一个节点，只有它和前一节点之间的那一小段键要搬，其它全不动。\n\n真实系统还加「虚拟节点」让分布更均。Redis Cluster、Cassandra、CDN 分片都用它。',
    guess: { q: '一致性哈希加一个节点，需要搬动多少键？', opts: ['只搬一小段', '几乎全部（同 hash%N）', '全部'] },
    tasks: [{ act: '按「下一步」布节点分键', watch: '键归给顺时针最近节点。' }, { act: '看加节点', watch: '加 D 后只有 k2 搬家。' }],
    verdict: ctx => { const t = ctx.trace as { keys?: { id: string; node: string }[] }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: '加入 D 后，4 个键只有 1 个(k2)需要搬。', why: '只有新节点到前一节点之间的键才重新归属，抖动极小。' } : null },
  },
  skiplist: {
    care: '有序链表查一个数要一个个走 O(n)。**跳表**给它加**多层索引**：底层是完整有序链表，上面每层随机挑一部分节点建"快车道"。\n\n查找从最高层开始：能往右就往右（下一个还 ≤ 目标），到头了就下一层，层层逼近，平均 **O(log n)**。\n\n用空间换时间，还比平衡树好写（插入靠抛硬币定层数，不用旋转）。Redis 的 zset、LevelDB 的 memtable 都用它。',
    guess: { q: '跳表查找的平均时间复杂度是？', opts: ['O(log n)', 'O(n)', 'O(1)'] },
    tasks: [{ act: '按「下一步」查找', watch: '能右就右、右不动就下沉，逼近 7。' }, { act: '数比较', watch: '4 次命中——O(log n)。' }],
    verdict: ctx => { const t = ctx.trace as { compares?: number; target?: number }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `找到 ${l.target}，只比较 ${l.compares} 次。`, why: '高层快车道跳过大段节点，平均 O(log n)。' } : null },
  },
  twopc: {
    care: '一个事务跨多个库/服务，要么全提交、要么全回滚。**2PC** 由**协调者**统一指挥：\n\n阶段一(投票)：协调者发 Prepare，参与者干到「就差落盘」、锁住资源，回 Yes/No。\n\n阶段二(提交)：**只要有一个 No 或超时就全体 Abort**；全 Yes 才广播 Commit，大家一起落盘。\n\n它保证原子性，但有硬伤：协调者在阶段二**宕机**，参与者会一直锁着资源干等（阻塞）——所以才有 3PC、以及 Raft/Paxos 这类更抗故障的共识。',
    guess: { q: '2PC 什么情况下才提交？', opts: ['所有参与者都投 Yes', '多数投 Yes', '协调者自己定'] },
    tasks: [{ act: '按「下一步」走两阶段', watch: '先收票，全 Yes 才广播提交。' }, { act: '想硬伤', watch: '参与者投 Yes 后锁资源等，协调者宕机就阻塞。' }],
    verdict: ctx => { const t = ctx.trace as { decision?: string }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `3 票全 Yes → 决定 ${l.decision === 'commit' ? 'Commit' : l.decision}，全体提交。`, why: '只要有一个 No 或超时就 Abort；这保证了原子性。' } : null },
  },
  crt: {
    care: '「物不知数」：一个数除 3 余 2、除 5 余 3、除 7 余 2，问这数是几？\n\n**中国剩余定理**：只要模两两互质，这组同余式在 0..N-1(N=∏n_i) 内有**唯一解**。\n\n构造：对每个条件算 N_i=N/n_i、它模 n_i 的逆 y_i，则 x = Σ a_i·N_i·y_i mod N——每项只在自己那个模下"生效"、对别的模贡献 0。RSA 解密用 CRT 拆成模 p、模 q 两个小幂，快 3~4 倍。',
    guess: { q: '除 3 余 2、除 5 余 3、除 7 余 2 的数(0~104)是？', opts: ['23', '17', '52'] },
    tasks: [{ act: '按「下一步」逐条合并', watch: '每条算出一个贡献项，累加。' }, { act: '验证', watch: 'x=23：÷3余2、÷5余3、÷7余2。' }],
    verdict: ctx => { const t = ctx.trace as { x?: number }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `唯一解 x = ${l.x}。`, why: '模两两互质保证唯一解；构造法把三个条件的贡献加起来取模。' } : null },
  },
  fermat: {
    care: 'RSA 要选大素数，可几百位的数没法试除。\n\n**费马小定理**：若 p 是素数，则对任意 1<a<p 有 a^(p-1)≡1 (mod p)。反过来当检测：算 a^(n-1) mod n，**若 ≠1，n 一定是合数**(铁证)；若 =1，n 很可能是素数(概率判定)。\n\n极少数「卡迈克尔数」会骗过它，所以实用中用更强的米勒-拉宾，但骨架就是这个模幂。',
    guess: { q: '2^14 mod 15 = 4 ≠ 1，说明 15 是？', opts: ['一定是合数', '一定是素数', '可能是素数'] },
    tasks: [{ act: '按「下一步」算模幂', watch: '快速模幂算 2^14 mod 15。' }, { act: '看判定', watch: '结果=4≠1 → 15 一定是合数。' }],
    verdict: ctx => { const t = ctx.trace as { result?: number; verdict?: string }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `2^14 mod 15 = ${l.result} → ${l.verdict}。`, why: '结果 ≠1 是合数的铁证；素数一定满足 a^(p-1)≡1。' } : null },
  },
  salt: {
    care: '密码不能明文存，得存哈希。但**只哈希不加盐**有大漏洞：两个人用同一个密码，存下的哈希就一样——攻击者拿一张「常见密码→哈希」的**彩虹表**一撞，一批人同时沦陷；还一眼看出谁和谁密码相同。\n\n**加盐**：每个用户配一个随机盐，存 hash(盐+密码)。同一密码因盐不同→哈希不同，彩虹表失效，必须对每个盐单独暴力。\n\n盐不用保密，随哈希一起存即可，作用是**打散**。真实系统再叠 bcrypt/argon2 故意放慢哈希。',
    guess: { q: '加盐（每人配随机盐再哈希）的作用是？', opts: ['让相同密码哈希也不同，彩虹表失效', '让哈希更快', '让密码可解密还原'] },
    tasks: [{ act: '按「下一步」对比', watch: '不加盐两人哈希一样，加盐就不一样。' }, { act: '想意义', watch: '盐打散哈希，让批量破解失效。' }],
    verdict: ctx => { const t = ctx.trace as { saltedA?: number; saltedB?: number }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `加盐后两人哈希 ${l.saltedA} ≠ ${l.saltedB}。`, why: '同一密码因盐不同而哈希不同，彩虹表和批量破解都失效。' } : null },
  },
  extgcd: {
    care: 'RSA 生成私钥那一步（求 d 使 e·d≡1 mod φ），以及一切「模运算里的除法」，都要**模逆**。\n\n求法是扩展欧几里得：一边辗转相除求 gcd，一边**回带系数**。gcd=1（e 与 m 互质）才有逆。\n\n迭代版每步记 (商 q、余数、系数 t)，最后系数取模 m 就是逆元。',
    guess: { q: '3 关于模 20 的逆元 d（3·d≡1 mod 20）是？', opts: ['7', '3', '13'] },
    tasks: [{ act: '按「下一步」迭代', watch: '每步一个商，系数跟着回带。' }, { act: '看结果', watch: 'gcd=1，系数取模就是 d=7。' }],
    verdict: ctx => { const t = ctx.trace as { result?: number }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `3⁻¹ mod 20 = ${l.result}。`, why: '辗转相除 gcd=1，回带的系数取模 20 即逆元；3×7=21≡1。' } : null },
  },
  signature: {
    care: '加密是「公钥加密、私钥解密」；签名反过来——**私钥签名、公钥验证**。\n\n发送方对消息算哈希 h，用**私钥**算 s=h^d mod n 作为签名。接收方对收到的消息重算哈希 h′，用**公钥**算 s^e mod n，若 ==h′ 就通过。\n\n这证明：消息没被改（完整性）、且确实来自私钥持有者（不可抵赖，别人没私钥签不出）。',
    guess: { q: '数字签名用哪个钥签名？', opts: ['私钥', '公钥', '共享密钥'] },
    tasks: [{ act: '按「下一步」签名+验证', watch: '私钥签出 s，公钥验证 s^e=哈希。' }, { act: '想篡改', watch: '消息一改 h′ 就变，对不上原 h。' }],
    verdict: ctx => { const t = ctx.trace as { ok?: boolean; verified?: number }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: l.ok ? `验证通过（s^e mod n = ${l.verified} = 哈希）。` : '验证失败。', why: '私钥签、公钥验；改消息则重算哈希变，验证结果对不上。' } : null },
  },
  hashaval: {
    care: '密码学哈希（SHA-256 等）要有**雪崩效应**：输入哪怕只改 1 位，输出也要有约**一半**的位翻转，且改法不可预测。\n\n这样才防篡改——改一点点，指纹就面目全非，攻击者没法一点点凑出想要的哈希（碰撞）。\n\n反例：输入小改、输出也小改，就能被逐步逼近攻破。',
    guess: { q: '"cat"→"cot"（一字母之差），16 位哈希大约翻转多少位？', opts: ['约一半(8位)', '1 位', '全部 16 位'] },
    tasks: [{ act: '按「下一步」逐位比', watch: '一个字母之差，哈希翻了 8/16 位。' }, { act: '想意义', watch: '改一点就面目全非——防篡改的根基。' }],
    verdict: ctx => { const t = ctx.trace as { flipped?: number }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `一个字母之差，翻转了 ${l.flipped}/16 位。`, why: '雪崩效应：输入微小变化引起约一半输出位翻转。' } : null },
  },
  merkle: {
    care: '怎么用一个小指纹保证一大堆数据没被改？**Merkle 树**：每块先算叶子哈希，相邻两哈希拼起来再哈希成父节点，层层向上汇成一个**根哈希**。\n\n任何一块被改，它的叶子→父→…→根都会变，根一对就知道。\n\n而且验证某个块只需 O(log n) 个兄弟哈希，不用下载全部数据。区块链、Git、IPFS、BitTorrent 全靠它。',
    guess: { q: '验证某一个块没被改，需要多少个哈希（n 个块）？', opts: ['O(log n) 个', '全部 n 个', '只要根 1 个'] },
    tasks: [{ act: '按「下一步」自底向上', watch: '4 叶子→2 父→1 根。' }, { act: '想篡改', watch: '改任何一块，根就变。' }],
    verdict: ctx => { const t = ctx.trace as { root?: number }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `根哈希 = ${l.root}。`, why: '自底向上两两哈希汇成根；改任何块根都变，验证只需 O(log n) 个兄弟哈希。' } : null },
  },
  caesar: {
    care: '最古老的替换密码：把每个字母在字母表上**向后移 k 位**，超过 Z 就绕回 A(mod 26)。解密反着移 k 位。\n\n骨架是「字母↔数字、加密钥、取模绕回」——后面维吉尼亚乃至一切对称加密都从这儿长出来。\n\n弱点两条：密钥只有 26 种(暴力可破)；不改字母频率(频率分析可破)。',
    guess: { q: '明文 HELLO 用 k=3 加密，结果是？', opts: ['KHOOR', 'EBIIL', 'IFMMP'] },
    tasks: [{ act: '按「下一步」逐字母移位', watch: 'A→D、越过 Z 绕回；HELLO→KHOOR。' }, { act: '想怎么破', watch: '只有 26 种密钥，暴力一遍就出。' }],
    verdict: ctx => { const t = ctx.trace as { cipher?: string }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `HELLO → ${l.cipher}。`, why: '每个字母后移 3 位，越过 Z 绕回 A。' } : null },
  },
  vigenere: {
    care: '凯撒的升级：不用固定位移，而用一个**关键词**，关键词每个字母给一个位移，循环套在明文上。\n\n于是同一个明文字母在不同位置加密成不同字母——**频率分析失效**，几百年没被破，人称「不可破译」。\n\n直到发现关键词**周期重复**：找出周期就能拆成几个凯撒分别破。它是「一次一密」的前身。',
    guess: { q: 'HELLO 用关键词 KEY 加密，两个 L 会？', opts: ['变成不同字母', '变成相同字母', '保持不变'] },
    tasks: [{ act: '按「下一步」看多表替换', watch: '同一字母 L 在不同位置加密成不同字母。' }, { act: '想弱点', watch: '关键词周期重复，可被卡西斯基法破。' }],
    verdict: ctx => { const t = ctx.trace as { cipher?: string }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `HELLO → ${l.cipher}，两个 L 变成了不同字母。`, why: '不同位置用不同关键词字母做位移，所以频率被打散。' } : null },
  },
  xor: {
    care: '计算机里最基础的加密原语：**密文 = 明文 XOR 密钥**。异或**自反**：再异或一次同一密钥就还原(c⊕k⊕k=m)——加解密同一套代码。\n\n流密码(RC4、ChaCha20)、一次一密(OTP)全靠它。\n\n安全**完全取决于密钥**：真随机 + 和明文等长 + 只用一次(OTP)=理论不可破；密钥一重复或有规律就漏底。',
    guess: { q: '密文=明文XOR密钥，怎么解回明文？', opts: ['密文再 XOR 同一密钥', '密文减密钥', '密文再加密一次'] },
    tasks: [{ act: '按「下一步」逐位异或', watch: '相同得 0、不同得 1。' }, { act: '想解密', watch: '密文再 XOR 同一密钥就还原。' }],
    verdict: ctx => { const t = ctx.trace as { cBits?: number[] }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `密文 = ${l.cBits?.join('')}。`, why: '逐位异或；再异或同一密钥即还原(自反)。' } : null },
  },
  modpow: {
    care: 'RSA、DH、椭圆曲线全在算 **a^b mod n**，而 b 动辄几百上千位，直接乘会爆炸。\n\n快速模幂(平方-乘)：把指数拆二进制，底数每步**平方**(a→a²→a⁴…)，指数这一位是 1 就把当前底数**乘进结果**，全程对 n 取模。\n\nO(log b) 次乘法搞定——这是公钥密码能在大数上跑起来的前提。',
    guess: { q: '快速模幂算 3^13 mod 7 = ？', opts: ['3', '2', '5'] },
    tasks: [{ act: '按「下一步」平方-乘', watch: '底数逐步平方，指数位是 1 才乘进结果。' }, { act: '数乘法次数', watch: '不是连乘 13 次，而是几次——这才跑得动 RSA。' }],
    verdict: ctx => { const t = ctx.trace as { result?: number }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `3^13 mod 7 = ${l.result}。`, why: '13=1101₂，= 3^1·3^4·3^8 mod 7，逐位平方-乘。' } : null },
  },
  diffiehellman: {
    care: '怎么在**所有人都能偷听**的信道上，商量出只有你俩知道的密钥？\n\n公开 p、g；Alice 私选 a、公布 A=g^a mod p；Bob 私选 b、公布 B=g^b mod p；各自算「对方公钥^自己私钥 mod p」，都等于 **g^(ab) mod p**，一致！\n\n偷听者只见 p、g、A、B，想反推私钥要解**离散对数**——大数下算不动，这就是安全根基。TLS 握手就用它。',
    guess: { q: 'p=23,g=5,a=6,b=15，双方的共享密钥是？', opts: ['2', '8', '19'] },
    tasks: [{ act: '按「下一步」看协商', watch: 'A、B 公开，共享密钥双方各自算、从不上信道。' }, { act: '想安全根基', watch: '从 A=g^a 反推 a = 解离散对数，算不动。' }],
    verdict: ctx => { const t = ctx.trace as { aliceShared?: number }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `双方得到共享密钥 ${l.aliceShared}。`, why: 'B^a 与 A^b 都等于 g^(ab) mod p，所以一致，且从不在信道上传。' } : null },
  },
  rsa: {
    care: '第一个实用的公钥体制：公钥加密、私钥解密，加密的人不需要知道解密的钥。基于「大数分解难」。\n\n选素数 p、q → n=pq(公开)、φ=(p-1)(q-1)(保密)；选 e 与 φ 互质(公钥)；求 d 使 e·d≡1(mod φ)(私钥)；加密 c=m^e mod n、解密 m=c^d mod n。\n\n公开的 n 谁都看得见，但从 n 反推 p、q(才能算 d)= 大数分解，几百位就算不动了。',
    guess: { q: 'p=3,q=11,e=3，私钥 d(满足 e·d≡1 mod φ)=？', opts: ['7', '3', '11'] },
    tasks: [{ act: '按「下一步」走完 RSA', watch: '生成密钥→公钥加密 4→31→私钥解密回 4。' }, { act: '想安全', watch: '反推 p、q = 大数分解，所以 d 算不出。' }],
    verdict: ctx => { const t = ctx.trace as { c?: number; dec?: number; d?: number }[]; const l = t[t.length - 1]; return l ? { pick: 0, say: `私钥 d=${l.d}；明文 4→密文 ${l.c}→解回 ${l.dec}。`, why: 'd 满足 e·d≡1(mod φ)；公开 n 难分解出 p、q，故 d 算不出。' } : null },
  },
  mvcc: {
    care:
      'MVCC = 多版本并发控制，MySQL(InnoDB)/PostgreSQL 扛高并发的地基。两条铁律：\n\n'
      + '**写不覆盖旧值** —— 而是给这一行**追加一个新版本**，每个版本带「谁创建的、是否已提交」。\n\n'
      + '**读不加锁** —— 而是按自己的**快照(read-view)**，从新到旧挑第一个「已提交、且创建者在快照里(或就是自己)」的版本。\n\n'
      + '快照在**事务开始那一刻**拍定：之后别人提交的新版本不在这张快照里，于是同一事务反复读同一行，读到的永远是同一个值——这就是「可重复读」。',
    guess: { q: 'T2 把 x 改成 200 并提交后，先前已开始的 T1 再读 x，读到几？', opts: ['100', '200', '报错'] },
    tasks: [
      { act: '按「下一步」走完调度', watch: 'T1 前后两次读 x 都是 100——尽管中间 T2 已把它改成 200 并提交。' },
      { act: '盯住版本链', watch: '写 x 追加未提交版本(灰)、提交后变绿；T1 读的始终是它快照里那个旧版本。' },
    ],
    verdict: ctx => { const t = ctx.trace as { readValue?: number }[]; if (!t.length) return null; return { pick: 0, say: 'T1 两次读 x 都是 100，尽管中间 T2 已提交 200。', why: '快照在事务开始时拍定，T2 不在 T1 的快照里，所以读不可见——可重复读。' } },
  },
  iso: {
    care:
      '隔离级别是并发事务「互相能看到多少」的旋钮，后端面试必考。同一段调度，级别不同，读到的就不同：\n\n'
      + '**读未提交(RU)** —— 读最新值(含别人没提交的) → 会**脏读**、也会**不可重复读**。\n\n'
      + '**读已提交(RC)** —— 只读最新已提交值 → 挡住脏读，挡不住不可重复读。\n\n'
      + '**可重复读(RR，MySQL 默认)** —— 读事务开始时的快照 → 两个都挡住。\n\n'
      + '**串行化** —— 最严，还能挡幻读(本例无区间查询，表现同 RR)。级别越高越安全、并发越低。',
    guess: { q: '读已提交(RC) 挡住了脏读，但挡不住哪种读现象？', opts: ['不可重复读', '脏读', '三种都能挡'] },
    tasks: [
      { act: '把「隔离级别」调到读未提交走一遍', watch: 'T1 第二次读到 200(脏读)、第三次也不一致(不可重复读)。', param: '隔离级别' },
      { act: '再调到可重复读', watch: 'T1 三次读全是 100——现象消失了。', param: '隔离级别' },
    ],
    verdict: ctx => { const lv = String((ctx.doc.params as { level?: string })?.level ?? '读已提交'); return { pick: 0, say: `当前「${lv}」下，T1 的三次读现象已定。`, why: '级别越高挡掉的读现象越多：RU 全放、RC 只挡脏读、RR 全挡。' } },
  },
  cas: {
    care:
      'CAS(compare-and-swap，比较并交换)是无锁并发的原子地基：AtomicInteger、自旋锁、无锁队列全靠它。\n\n'
      + '一条硬件原子指令 **CAS(地址, 期望值, 新值)**：当且仅当内存里还等于期望值时，才写入新值、返回成功；否则说明有人先改了，返回失败，由调用者**自旋重试**。\n\n'
      + '于是「读-改-写」不会丢更新：两个线程同时读到 0 都想写 1，先到的 CAS 成功，后到的发现值变了、CAS 失败，只能重读再来。',
    guess: { q: '3 个线程各用 CAS 做一次 x++（x 初值 0），最终 x = ？', opts: ['3', '2', '1'] },
    tasks: [
      { act: '按「下一步」看竞争', watch: 'T1、T2 都读到 0，T1 先 CAS 成功，T2 CAS 就失败了。' },
      { act: '数失败次数', watch: '每次被抢先就重读再 CAS，最终三个 ++ 一个不丢、x=3、重试 2 次。' },
    ],
    verdict: ctx => { const t = ctx.trace as { x?: number; fails?: number }[]; const last = t[t.length - 1]; if (!last) return null; return { pick: 0, say: `最终 x=${last.x ?? 3}，一个更新都没丢。`, why: `CAS 让被抢先的线程失败重试(共 ${last.fails ?? 2} 次)，而不是覆盖别人的写。` } },
  },
  mesi: {
    care:
      '多核各有自己的缓存，同一个变量 x 可能在好几个核里都有副本——谁改了别人怎么知道？MESI 给每个缓存行标四态：\n\n'
      + '**M**(Modified)已改·脏·独占　**E**(Exclusive)干净·独占　**S**(Shared)共享·只读　**I**(Invalid)失效。\n\n'
      + '规则：读未命中要上总线找(别人有 M 先回写、大家降 S；没人有则我独占 E)；**写之前把其它核的副本全失效(I)、自己升 M**。\n\n'
      + '所以「一个核的写，另一个核不会自动立刻看见」——它的副本被置为 I 了，下次读得重新加载。这正是 volatile / 内存屏障存在的理由。',
    guess: { q: 'C1 写 x 时，C2 手里的那份副本会变成什么状态？', opts: ['I 失效', 'S 共享', '不变'] },
    tasks: [
      { act: '按「下一步」看两核读写', watch: 'C1 独占→C2 来读变共享→C1 一写就把 C2 的副本置为 I。' },
      { act: '盯 I 状态', watch: '被失效的核下次读只能重新加载——一个核的写另一个核不会自动看见。' },
    ],
    verdict: ctx => { const t = ctx.trace as { invalidated?: number }[]; const last = t[t.length - 1]; if (!last) return null; return { pick: 0, say: `全程副本被失效 ${last.invalidated ?? 2} 次。`, why: '每次有核写 x，其它核的副本立刻置 I，得重新加载才看得到新值。' } },
  },
  deadlock: {
    care:
      '和银行家算法(死锁**避免**：分配前先判安全)不同，这里是死锁**检测**：先让它发生，再用**等待图**找出来。\n\n'
      + '节点是线程，边 **Ti→Tj** 表示「Ti 正等一把被 Tj 攥着的锁」。等待图一旦出现**环**，环上的线程互相等、谁也动不了 = 死锁。\n\n'
      + '本例经典循环等待：T1 持 A 等 B、T2 持 B 等 C、T3 持 C 等 A，边 1→2→3→1 闭合成环。\n\n'
      + '破环最实用的办法是**所有线程按固定顺序加锁**——这也是死锁四条件(互斥/占有并等待/不可抢占/循环等待)里最好打破的一条。',
    guess: { q: 'T1持A等B、T2持B等C、T3持C等A，会发生什么？', opts: ['死锁', '正常跑完', '其中一个报错'] },
    tasks: [
      { act: '按「下一步」逐个加锁', watch: 'T1/T2/T3 各拿一把、又都去要下一把，等待边一条条加。' },
      { act: '看环闭合那一刻', watch: '最后一条边 3→1 补上，等待图成环，当场判死锁。' },
    ],
    verdict: ctx => { const t = ctx.trace as { deadlock?: boolean; cycle?: number[] }[]; const last = t[t.length - 1]; if (!last) return null; return { pick: 0, say: last.deadlock ? `等待图成环，${last.cycle?.length ?? 3} 个线程死锁。` : '未死锁。', why: '每个线程都攥着一把、又在等下一把，形成循环等待，谁也进不去。' } },
  },
  raft: {
    care:
      '分布式系统里多台机器要对「谁是主、日志长什么样」达成一致，又不能有单点——Raft 是最主流的答案。两件事：\n\n'
      + '**选主** —— 节点默认 Follower；选举超时→变 Candidate、任期+1、给自己投票、向别人拉票；**拿到过半票**当选 Leader。任期号保证一个任期最多一个 Leader。\n\n'
      + '**日志复制** —— 客户端命令只发 Leader；Leader 追加到自己日志，再复制给 Follower；**一旦复制到过半**，这条日志就**提交**、可安全应用。\n\n'
      + '「过半」是灵魂：任何两个多数派必有交集，于是不会有两个主、不会提交冲突日志。etcd、Consul、TiKV 底下都是它。',
    guess: { q: 'Raft 3 节点集群，一条日志复制到几个节点才算提交？', opts: ['2（过半）', '3（全部）', '1（Leader 自己）'] },
    tasks: [
      { act: '按「下一步」看选主', watch: 'N1 超时参选→拿到 2/2 票→当选 Leader。' },
      { act: '看日志复制', watch: '客户端命令由 Leader 复制到过半节点，就打勾提交了。' },
    ],
    verdict: ctx => { const t = ctx.trace as { committed?: number; majority?: number }[]; const last = t[t.length - 1]; if (!last) return null; return { pick: 0, say: `N1 过半票当选，日志复制到过半(${last.majority ?? 2}/3)即提交。`, why: '任何两个多数派必有交集，所以不会有两个主、不会提交冲突日志。' } },
  },
  cache: {
    care:
      '地址 = **Tag** + **Index** + **Offset**；Index 决定去哪组，Tag 决定是不是它，'
      + 'Offset 决定取块里的哪个字节。围绕这一句，先明确三个概念：\n\n'
      + '**内存块** —— 主存按块大小（此处 16B）划分为等长的块，调入调出均以块为单位：'
      + '访问 0x210 将把 0x210~0x21F 整块调入。地址 ÷ 块大小即该地址所属的**块号**。\n\n'
      + '**组**（set） —— Cache 划分为若干组，图中一行即一组。'
      + '内存块映射到哪一组由「块号 % 组数」唯一确定，不可选择。\n\n'
      + '**路**（way） —— 同一组内并列的若干存储位置，每一路存放一个内存块。'
      + '"2 路"即每组有两个位置；实际处理器中常见 4 路、8 路。\n\n'
      + 'tag 的必要性在于：**多个不同的内存块会映射到同一组**'
      + '（0x10、0x110、0x210 的组号均为 1），它们共用同一组的若干路，'
      + '只能依据 tag 判定某一路当前存放的是否为目标块。'
      + 'tag = 块号 ÷ 组数，是**编号**而非地址，故界面上不加 0x 前缀。',
    guess: {
      q: '把「相联度」降到 1 路（直接映射），你现在这串地址的命中率会怎样？',
      opts: ['变高', '不变', '变低'],
    },
    tasks: [
      {
        act: '先把「相联度」拧到 1，再拧回去',
        watch: '读数里的「命中率」是不是真的变了 —— 变没变、变多少，先记住这个数',
        param: '相联度',
      },
      {
        act: '换成「同组冲突」这串地址，再把相联度在 1 和 4 之间来回拧',
        watch: '这串地址的三个块组号相同：1 路时它们互相挤，4 路时挤不动了',
        preset: '同组冲突',
      },
      {
        act: '换成「容量不足」这串地址，再拧一次相联度',
        watch: '这次相联度救不了 —— 装不下就是装不下，只有加大「Cache 容量」有用',
        preset: '容量不足',
      },
    ],
    goal: {
      say: '把整串跑完的命中率拉到 50% 以上',
      /*
       * 50% 不是拍的，是逐档量出来的（默认那串地址）：
       *
       *   1 路 25.0% · 2 路 25.0% · 4 路 50.0% · 8 路 50.0%
       *
       * 正好卡在"必须动相联度"那一档上 —— 和 ② 问的是同一件事，
       * 只不过 ② 让你押注、目标让你真的把它拧过去。
       *
       * 「顺序访问」75.0%、「局部性好」80.0%，一进来就是达成 —— 这不是漏洞：
       * **命中率首先是地址串的性质，不是配置的性质**，① 讲的就是这个。
       * 而「容量不足」那串反过来 —— 1 路 38.9%、8 路 0.0%，相联度越高越差，
       * 得靠加大容量才够得着 50.0%。同一个目标，三串地址三条路。
       */
      state: ({ trace }) => {
        const cur = hitRate(trace)
        if (cur === null) return null
        return { now: `整串命中率 ${pct(cur)}`, met: cur >= 0.5 }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      const cur = hitRate(trace)
      if (cur === null) return null
      const a = Number(doc.params.associativity) || 1
      const at = (n: number) =>
        hitRate(runDoc({ ...doc, params: { ...doc.params, associativity: n } }))
      /*
       * 已经是 1 路时没法"再降"，那就换个方向问同一件事：升到 2 路会怎样。
       * 反过来读一遍结论，对错判定跟着翻 —— 不能因为起点不同就答非所问。
       */
      const down = a > 1
      const other = at(down ? 1 : 2)
      const full = at(8)
      if (other === null || full === null) return null

      const pick = other > cur ? 0 : other === cur ? 1 : 2
      const say = down
        ? `这串地址整串跑完：${a} 路的命中率是 ${pct(cur)}，降到 1 路（直接映射）是 ${pct(other)}`
          + ` —— 所以「${['变高', '不变', '变低'][pick]}」。`
        : `这串地址整串跑完：1 路（你现在就在这儿）的命中率是 ${pct(cur)}，升到 2 路是 ${pct(other)}。`
                  + `（题面问的是"降到 1 路"，你已经在那儿了，所以反过来读：升上去${other > cur ? '有用' : '也没用'}。）`
      /*
       * 为什么是这样 —— 也现算，不写死。
       * 拿 8 路（这一屏能给的最高）当参照：还能再涨，说明剩的缺失里有**冲突缺失**，
       * 是相联度救得了的；涨不动，说明缺的不是"路数"，加相联度白搭。
       */
      const why = full > cur
        ? `再往上拧到 8 路，整串命中率还能到 ${pct(full)} —— 说明你这串地址里还剩着**冲突缺失**：`
          + '几个块抢同一个组，路数不够就互相挤掉。这种缺失，提高相联度救得了。'
        : `拧到 8 路，整串命中率仍然是 ${pct(full)}，一点没涨 —— 说明剩下的缺失**不是路数的问题**：`
          + '要么是第一次访问必然的强制缺失，要么是要用的块本来就比 Cache 装得下的多。'
          + '这两种，加相联度都白搭。'
      return { pick, say, why }
    },
  },
  page: {
    care:
      '内存装不下整个程序，所以只把用到的页搬进来。要用的页不在内存里就是**缺页** —— '
      + '这一下要去磁盘搬一趟，比访存慢几个数量级，是程序卡顿最常见的来源之一。'
      + '装不下的时候得挑一页扔掉，挑谁就是"置换算法"。这一屏把每一次访问摊开：'
      + '哪次命中、哪次缺页、缺页时把谁换了出去，以及**换错人的代价**。',
    guess: {
      q: '物理块数从 3 加到 4（内存变大了），这串引用的缺页次数会怎样？',
      opts: ['变少', '不变', '变多'],
    },
    tasks: [
      { act: '保持 FIFO，把「物理块数」从 3 拧到 4', watch: '缺页次数 —— 内存变大了，它是不是真的变少了', param: '物理块数' },
      { act: '换成 LRU，再把物理块数在 3 和 4 之间拧一次', watch: 'LRU 加块就真的变少 —— FIFO 才有那个毛病', param: '置换算法' },
      { act: '换成 OPT（预知未来的那个）', watch: '它是缺页次数的**下界** —— 任何真实算法都到不了比它更低', param: '置换算法' },
    ],
    goal: {
      say: '把缺页次数压到 8 次或更少',
      /*
       * 默认串（就是 Belady 经典串）逐档量过：
       *   FIFO 3块 9 · 4块 10   LRU 3块 10 · 4块 8   OPT 3块 7 · 4块 6   CLOCK 3块 9 · 4块 10
       * 8 次这条线有两条路够得着：LRU 加到 4 块（8），或者换 OPT（7 / 6）。
       * 一进来是 FIFO 3 块 = 9 次，差一点 —— 而"差的那一点"恰好只能靠换算法拿，
       * 加块反而更糟。这就是 ② 问的事。
       */
      state: ({ trace }) => {
        const f = faults(trace)
        if (f === null) return null
        return { now: `缺页 ${f} 次`, met: f <= 8 }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      if (faults(trace) === null) return null
      const alg = String(doc.params.algorithm ?? 'FIFO')
      const at = (n: number) => faults(runDoc({ ...doc, params: { ...doc.params, frames: n } }))
      const f3 = at(3), f4 = at(4)
      if (f3 === null || f4 === null) return null
      const pick = f4 < f3 ? 0 : f4 === f3 ? 1 : 2
      const say = `你这串引用、用 ${alg}：3 块缺页 ${f3} 次，4 块缺页 ${f4} 次`
        + ` —— 所以「${['变少', '不变', '变多'][pick]}」。`
      /*
       * 为什么 —— 拿 OPT 当参照。OPT 预知未来，是这一串的缺页下界，
       * 现实里做不到，但它能告诉你"现在这套还差多少"是算法的锅还是串本身就难。
       */
      const opt3 = faults(runDoc({ ...doc, params: { ...doc.params, algorithm: 'OPT', frames: 3 } }))
      const why = opt3 === null
        ? '（OPT 这一档没算出来）'
        : pick === 2
          ? `加内存反而更差，这叫 **Belady 异常** —— 只有 FIFO 这类"按进来的顺序赶人"的算法会犯：`
            + `块变多之后队列变长，反而把马上要用的页排到了前面先赶走。LRU 和 OPT 不会。`
            + `同样 3 块，OPT 只要 ${opt3} 次，说明这串本身没那么难。`
          : `同样 3 块，OPT 只要 ${opt3} 次 —— ${alg} 比下界多出的那 ${f3 - opt3} 次，`
            + `就是"不知道未来"要付的钱。真实系统只能靠猜（LRU 猜"最近用过的还会再用"）。`
      return { pick, say, why }
    },
  },

  disk: {
    care:
      '磁盘上换一次磁道要几毫秒，比在内存里做同一件事慢几万倍。所以一堆请求来了，'
      + '**先服务谁**直接决定这块盘一秒钟能干多少活 —— 顺序不同，磁头跑的总距离能差好几倍。'
      + '这一屏把磁头的移动轨迹画出来：每一步从哪跑到哪、跑了多远、还剩谁在等。'
      + '要看的不只是总距离，还有**谁被一直晾着**。',
    guess: {
      q: 'SCAN（电梯算法）比 SSTF（每次挑最近的）更省磁头行程吗？',
      opts: ['SCAN 更省', '差不多', 'SSTF 更省'],
    },
    tasks: [
      { act: '在 FCFS / SSTF / SCAN / C-SCAN / LOOK 之间挨个切一遍', watch: '「累计寻道」这个数 —— 记下哪个最小、哪个最大', param: '调度算法' },
      { act: '切到 SCAN，看轨迹末尾', watch: '它会一路跑到 0 号或最大磁道才掉头，哪怕那边一个请求都没有 —— 这段叫**空跑**', param: '调度算法' },
      { act: '换成「SSTF 饥饿」那串请求，用 SSTF 跑', watch: '最远的那个请求排到了多后面 —— 总距离最短不等于每个人都等得起', preset: 'SSTF 饥饿' },
    ],
    goal: {
      say: '不用 SSTF，把累计寻道压到 300 以内',
      /*
       * 默认队列（磁头 53、向上）逐档量过：
       *   FCFS 640 · SSTF 236 · SCAN 331 · C-SCAN 382 · LOOK 299
       * 唯一够得着的是 **LOOK 299**，只差 1。
       *
       * 为什么把 SSTF 排除掉 —— 不是为了刁难：SSTF 总距离确实最短，
       * 但它按"离我最近"贪心，远端请求可能一直排不上（预置串就叫「SSTF 饥饿」）。
       * **总距离最短 ≠ 可用**，这一条比"哪个数最小"重要得多。
       */
      state: ({ doc, trace }) => {
        const t = seekTotal(trace)
        if (t === null) return null
        const alg = String(doc.params.algorithm ?? '')
        const okAlg = alg !== 'SSTF', okDist = t <= 300
        return {
          now: `${alg || '?'} · 累计 ${t}`,
          met: okAlg && okDist,
          miss: !okAlg ? '这条不算 —— SSTF 会饿死远端请求' : !okDist ? `还差 ${t - 300}` : undefined,
        }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      if (seekTotal(trace) === null) return null
      const at = (a: string) => seekTotal(runDoc({ ...doc, params: { ...doc.params, algorithm: a } }))
      const sstf = at('SSTF'), scan = at('SCAN'), look = at('LOOK'), fcfs = at('FCFS')
      if (sstf === null || scan === null || look === null || fcfs === null) return null
      const pick = scan < sstf ? 0 : scan === sstf ? 1 : 2
      const say = `你这串请求：SSTF 累计寻道 ${sstf}，SCAN 累计 ${scan}`
        + ` —— 所以「${['SCAN 更省', '差不多', 'SSTF 更省'][pick]}」。（FCFS 要 ${fcfs}，LOOK 要 ${look}。）`
      const why = look < scan
        ? `SCAN 比 LOOK 多花的 ${scan - look} 个磁道，全花在**空跑**上 —— 它非要跑到磁道尽头才掉头，`
          + `哪怕那边没有请求。LOOK 就是"看一眼，没人就掉头"，所以它是 SCAN 系里最省的那个。`
          + `而 SSTF 总距离常常更小，代价是**远端请求可能一直排不上**。`
        : `这一串上 LOOK 和 SCAN 一样 ${scan} —— 说明请求本来就铺到了磁道两端，`
          + `SCAN 那段"跑到头才掉头"没白跑。空跑的代价只在请求都挤在中间时才显出来。`
      return { pick, say, why }
    },
  },

  scheduler: {
    care:
      '一个 CPU、一堆进程，谁先跑谁后跑由调度算法定。**同样一批活、同样的总工作量**，'
      + '换个顺序，用户感觉到的等待时间能差一倍以上 —— 这就是"平均周转时间"要量的东西。'
      + '而它和"公平"经常打架：让每个人都轮一小会儿（时间片轮转）感觉上更公平，'
      + '算下来平均周转反而更长。这一屏把甘特图摊开，让你看见每一秒 CPU 在谁手上。',
    guess: {
      q: 'RR（时间片轮转）把时间片从 2 调到 1，平均周转时间会怎样？',
      opts: ['变短', '不变', '变长'],
    },
    tasks: [
      { act: '把「调度算法」切成 RR，时间片留 2，走完整条轴', watch: '甘特图上进程被切成一段一段 —— 谁都不用等太久才第一次上 CPU', param: '调度算法' },
      { act: '把「时间片」从 2 拧到 1', watch: '切得更碎了。看最后完成时刻 —— 每个人第一次上 CPU 更快，但**做完**更慢', param: '时间片' },
      { act: '切回 SRTF，对比甘特图', watch: '它总是让"剩得最少"的先跑，所以平均周转最短 —— 代价是它得预知还要跑多久', param: '调度算法' },
    ],
    goal: {
      say: '不用 SJF / SRTF（真实 OS 预知不了运行时间），把平均周转压到 9.0 以下',
      /*
       * 默认进程表逐档量过：
       *   FCFS 8.75 · SJF 8.00 · SRTF 7.00 · RR(q=2) 9.00 · RR(q=1) 9.50
       * 去掉两个"开天眼"的之后，唯一够得着的是 **FCFS 8.75** ——
       * 而 RR 无论时间片怎么调都过不去（9.00 / 9.50）。
       *
       * 这条线正是要把那个反直觉的事实顶到脸上：**RR 拿周转换响应**。
       * 它让每个进程更早第一次上 CPU，代价是每个进程都更晚做完。
       */
      state: ({ doc, trace }) => {
        const a = avgTurnaround(trace, doc)
        if (a === null) return null
        const alg = String(doc.params.algorithm ?? '')
        const open = alg !== 'SJF' && alg !== 'SRTF'
        return {
          now: `${alg || '?'} · 平均周转 ${a.toFixed(2)}`,
          met: open && a < 9,
          miss: !open ? '这条不算 —— 真实 OS 预知不了运行时间' : a >= 9 ? `还差 ${(a - 9).toFixed(2)}` : undefined,
        }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      if (avgTurnaround(trace, doc) === null) return null
      const at = (alg: string, q: number) => {
        const d = { ...doc, params: { ...doc.params, algorithm: alg, quantum: q } }
        return avgTurnaround(runDoc(d), d)
      }
      const rr2 = at('RR', 2), rr1 = at('RR', 1), srtf = at('SRTF', 2), fcfs = at('FCFS', 2)
      if (rr2 === null || rr1 === null || srtf === null || fcfs === null) return null
      const f = (x: number) => x.toFixed(2)
      const pick = rr1 < rr2 ? 0 : rr1 === rr2 ? 1 : 2
      const say = `你这张进程表：RR 时间片 2 的平均周转是 ${f(rr2)}，时间片 1 是 ${f(rr1)}`
        + ` —— 所以「${['变短', '不变', '变长'][pick]}」。`
      const why = pick === 2
        ? `时间片越小切换越频繁，每个进程都被拖得更晚做完 —— **RR 换来的不是周转，是响应**：`
          + `它保证你很快能第一次上 CPU，不保证你早点做完。`
          + `对照一下：SRTF ${f(srtf)}、FCFS ${f(fcfs)}，连最朴素的 FCFS 都比 RR 的周转短。`
        : `这张表上时间片调小没吃亏 —— 换一张服务时间差距更大的表（比如「护航效应」）再看一次，`
          + `RR 拿周转换响应的代价才显出来。对照：SRTF ${f(srtf)}、FCFS ${f(fcfs)}。`
      return { pick, say, why }
    },
  },
  pipeline: {
    care:
      '一条指令要走取指、译码、执行、访存、写回五段。流水线让五条指令**同时各占一段**，'
      + '理论上每个周期就能完成一条 —— 但只要后一条要用到前一条刚算出的结果，它就得**等**，'
      + '这一等就是一个气泡。这一屏把每个周期每条指令在哪一段摊开：'
      + '你能看见气泡从哪儿冒出来、前递怎么把它填掉，以及哪一种相关**前递也救不了**。',
    guess: {
      q: '打开「数据前递」，这四条指令跑完的总周期会少几个？',
      opts: ['一个都不少', '少 1～2 个', '少 5 个以上'],
    },
    tasks: [
      { act: '先关着前递走完整条轴', watch: '甘特图上一格一格的「气泡」—— 数一数有几个', param: '数据前递' },
      { act: '把「数据前递」打开，再走一遍', watch: '气泡少了多少，总周期从几变到几', param: '数据前递' },
      { act: '换成「load-use」那组指令，再开一次前递', watch: '这一个气泡**填不掉** —— lw 的结果要到访存段才出来，前递也来不及', preset: 'load-use' },
    ],
    goal: {
      say: '把这段指令的总周期压到 10 个以内',
      /*
       * 默认那张指令表量过（浏览器里读的真实那一屏）：
       *   不前递 14 周期 · 开前递 8 周期
       * 10 这条线只有开前递才够得着，而且余量不小 —— 它要的不是"调到最优"，
       * 是"知道该拧哪个旋钮"。
       */
      state: ({ trace }) => {
        const c = cycles(trace)
        if (c === null) return null
        return { now: `${c} 个周期`, met: c <= 10 }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      if (cycles(trace) === null) return null
      const at = (f: number) => cycles(runDoc({ ...doc, params: { ...doc.params, forwarding: f } }))
      const off = at(0), on = at(1)
      if (off === null || on === null) return null
      const saved = off - on
      const pick = saved === 0 ? 0 : saved <= 2 ? 1 : 2
      const say = `你这段指令：不前递要 ${off} 个周期，开前递要 ${on} 个`
        + ` —— 省了 ${saved} 个，所以「${['一个都不少', '少 1～2 个', '少 5 个以上'][pick]}」。`
      const why = saved === 0
        ? '这组指令互不依赖，本来就没有气泡 —— 前递是用来填气泡的，没有气泡它就没活干。'
          + '周期数这时等于 段数 + (指令数 − 1)，那是流水线的理论下限。'
        : `省下的每一个周期都是一个被填掉的气泡：前递把结果**从算完的那一段直接接到要用的那一段**，`
          + `不用等它先写回寄存器。但有一种救不了 —— \`lw\` 的结果要到访存段才出来，`
          + `紧接着就用它的那条指令必须停一拍，那个气泡是硬的。`
      return { pick, say, why }
    },
  },

  vm: {
    care:
      '程序里写的地址是**虚**的，真正去内存拿数据得先translate成物理地址 —— 这一步每次访存都要做。'
      + '要是每次都去内存查页表，一次访存就变成两次 —— 先取页表项，再取数据。'
      + 'TLB 就是为此存在的：一个很小的、专门缓存"虚页号 → 物理页框"的表。'
      + '这一屏把每一次地址转换摊开：命中 TLB、退回查页表、还是干脆缺页要去磁盘搬。',
    guess: {
      q: 'TLB 从 2 项加到 4 项，这串地址的 TLB 命中次数会变多吗？',
      opts: ['会变多', '不变', '反而变少'],
    },
    tasks: [
      { act: '把「TLB 项数」从 1 一路拧到 8', watch: '读数里的「TLB 命中」和「查页表」—— 哪一档开始变，哪一档之后不再变', param: 'TLB 项数' },
      { act: '换成「TLB 抖动」那串地址', watch: '每次都刚好把上一次要用的那项挤掉 —— TLB 再大一点就能救', preset: 'TLB 抖动' },
      { act: '把「页大小」从 4096 改成 1024', watch: '同一串地址落到更多的页上，TLB 要装的东西变多了', param: '页大小' },
    ],
    goal: {
      say: '让 TLB 命中达到 2 次或更多',
      /*
       * 默认那串地址逐档量过（浏览器里读的真实那一屏）：
       *   TLB 1 项 → 命中 1 · 2 项 → 命中 1 · 4 项 → 命中 2 · 8 项 → 命中 2
       * 所以 2 这条线卡在 2 项和 4 项之间 —— 正是 ② 问的那一档。
       * 1 项和 2 项一样，是因为这串地址的复用距离超过 2：**加一点点没用，得加过那个坎**。
       */
      state: ({ trace }) => {
        const c = vmCounts(trace)
        if (c === null) return null
        return { now: `TLB 命中 ${c.tlb} 次`, met: c.tlb >= 2 }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      if (vmCounts(trace) === null) return null
      const at = (n: number) => vmCounts(runDoc({ ...doc, params: { ...doc.params, tlbEntries: n } }))
      const a2 = at(2), a4 = at(4), a8 = at(8)
      if (!a2 || !a4 || !a8) return null
      const pick = a4.tlb > a2.tlb ? 0 : a4.tlb === a2.tlb ? 1 : 2
      const say = `你这串地址：TLB 2 项时命中 ${a2.tlb} 次，4 项时命中 ${a4.tlb} 次`
        + ` —— 所以「${['会变多', '不变', '反而变少'][pick]}」。`
      const why = a8.tlb > a4.tlb
        ? `再加到 8 项还能涨到 ${a8.tlb} 次 —— 说明这串地址的**复用距离**还超过 4：`
          + '一个页被再次用到之前，中间隔了太多别的页，小 TLB 装不住。'
        : `加到 8 项仍是 ${a8.tlb} 次，不再涨了 —— 剩下的缺失不是"装不下"，`
          + '是**第一次访问必然要查一次页表**。这一类靠加大 TLB 救不了，'
          + '就像 Cache 的强制缺失靠加相联度救不了一样。'
      return { pick, say, why }
    },
  },

  multiply: {
    care:
      '这一屏模拟的是**串行乘法器**：没有一次算完的乘法电路，只能用加法和移位一位一位地凑。'
      + '（现代 CPU 当然有乘法指令，底下是流水线阵列乘法器 —— 但它的原理仍然是把这些部分积一次并行加起来。）'
      + '所以两个数相乘要**一位一位地判、加、移**，'
      + '判断乘数的这一位是 1 就加、是 0 就不加，然后整体右移，做多少位就转多少轮。'
      + '负数更麻烦：原码乘要把符号单拎出来算，Booth 则靠一个"附加位"让正负数走同一套流程。'
      + '这一屏把寄存器里每一轮的部分积摊开 —— 你会看见"乘法"其实就是一串加法。',
    guess: {
      q: 'Booth 算法比原码一位乘，轮数会少吗？',
      opts: ['Booth 更少', '一样多', 'Booth 更多'],
    },
    tasks: [
      { act: '用「正 × 正」把原码一位乘走完', watch: '每一轮：先看判断位，再决定加不加，最后整体右移', preset: '正 × 正' },
      { act: '切到 Booth，同一组数再走一遍', watch: '轮数一样，但它多了一个「附加位」—— 判断的是**相邻两位**', param: '算法' },
      { act: '换成「负 × 正」，两种算法各走一遍', watch: 'Booth 全程不用管符号；原码乘得把符号位单独拿出来算', preset: '负 × 正' },
    ],
    goal: {
      say: '找一对操作数，让 Booth 的加减次数**少于**原码一位乘',
      /*
       * 量过默认那一对（5 × 3，8 位）：两种算法都是 **2 次**加减 —— 目标不达成。
       * 这是故意的：Booth 不是"永远更快"，它省的是**连续的 1**。
       *   3 = 0011，只有一段 1，Booth 一减一加，跟逐位加没差别；
       *   15 = 1111 这种才是它的主场（原码要 4 次加，Booth 只要 1 减 1 加）。
       * 目标写成"比得过"而不是"少于 N 次"，是因为次数随位数和操作数变，
       * 钉死一个数就变成了考默认配置的记性。
       */
      state: ({ doc, runDoc }) => {
        const at = (alg: string) => addSubs(runDoc({ ...doc, params: { ...doc.params, algorithm: alg } }))
        const boo = at('Booth'), plain = at('原码一位乘')
        if (boo === null || plain === null) return null
        return {
          now: `Booth ${boo} 次 · 原码一位乘 ${plain} 次`,
          met: boo < plain,
          miss: boo < plain ? undefined : '还没拉开差距',
        }
      },
    },

    verdict: ({ doc, trace, runDoc }) => {
      const rounds = (t: unknown[]) => {
        const s = t[t.length - 1] as { round?: number } | undefined
        return typeof s?.round === 'number' ? s.round : null
      }
      if (rounds(trace) === null) return null
      const at = (a: string) => {
        const t = runDoc({ ...doc, params: { ...doc.params, algorithm: a } })
        return { r: rounds(t), steps: t.length }
      }
      const yuan = at('原码一位乘'), booth = at('Booth')
      if (yuan.r === null || booth.r === null) return null
      const pick = booth.r < yuan.r ? 0 : booth.r === yuan.r ? 1 : 2
      const say = `原码一位乘 ${yuan.r} 轮，Booth ${booth.r} 轮`
        + ` —— 所以「${['Booth 更少', '一样多', 'Booth 更多'][pick]}」。`
      const why = pick === 1
        ? '**Booth 的好处不在轮数**，在于它把负数的处理并进了同一套流程：'
          + '原码乘要先取绝对值、算完再单独定符号，Booth 靠一个附加位判断"相邻两位"，'
          + '正负数走的是同一条路。轮数是位数决定的，谁也省不掉。'
        : `轮数确实不同（${yuan.r} vs ${booth.r}）—— 这一组数上 Booth 的连续 1 段被合并了，`
          + '那是它另一个好处：一串连着的 1 可以用"一次减 + 一次加"代替多次加。'
      return { pick, say, why }
    },
  },

  float: {
    care:
      '`0.1 + 0.2 !== 0.3` 这件事，几乎每个写过代码的人都撞过。原因不在语言，在**存法**：'
      + '浮点数用「符号 + 阶码 + 尾数」三段来存，而十进制的 0.1 换成二进制是个**无限循环小数**，'
      + '尾数只有 23 位（单精度），存不下就得截断。'
      + '这一屏把编码的七个步骤逐步摊开，最后把机器里真正存进去的那个数**原样念给你听**。',
    guess: {
      q: '把 0.1 用单精度存进去，再原样读出来，还是 0.1 吗？',
      opts: ['是，正好 0.1', '不是，有误差'],
    },
    tasks: [
      { act: '装上「0.1」这个预置，走完七步', watch: '尾数那一段被截断的位置 —— 二进制里它是循环的', preset: '0.1' },
      { act: '把「精度」从单精度切到双精度', watch: '尾数从 23 位变成 52 位，误差小了但**没有消失**', param: '精度' },
      { act: '换成「−12.5」再走一遍', watch: '这个数的二进制是有限的，所以存得进去、误差为 0', preset: '−12.5' },
    ],
    goal: {
      say: '找一个数，让它**存进去再读出来就变了**（亲眼看见精度损失）',
      /*
       * 默认是 −12.5 —— 二进制有限（−1100.1），存进去读出来分毫不差，目标不达成。
       * 这是故意的：这个实验真正要教的一课是"十进制有限 ≠ 二进制有限"，
       * 而它只有在**自己动手换一个数**、亲眼看到 0.1 变成 0.100000001490116…
       * 的时候才立得住。目标因此不写"算对"，写"把它弄错给我看"。
       */
      state: ({ doc, trace }) => {
        const bits = finalBits(trace)
        const want = Number((doc.streams as { name: string; values: number[] }[] | undefined)
          ?.find(x => x.name === 'operands')?.values?.[0])
        if (bits === null) return null
        const got = fromBits(bits)
        if (got === null || !Number.isFinite(want)) return null
        const lost = got !== want
        return {
          now: lost ? `${want} → ${got}` : `${want} 存回来还是 ${want}`,
          met: lost,
          miss: lost ? undefined : '这个数是存得下的',
        }
      },
    },

    verdict: ({ doc, trace, runDoc }) => {
      const bits = finalBits(trace)
      if (!bits) return null
      const want = Number((doc.streams as { name: string; values: number[] }[] | undefined)
        ?.find(s => s.name === 'operands')?.values?.[0])
      const got = fromBits(bits)
      if (got === null || !Number.isFinite(want)) return null
      const err = Math.abs(got - want)
      const pick = err === 0 ? 0 : 1
      /*  把机器里那个数原样念出来 —— 这一句是整个实验的落点，
          而它只能从位串算，写死在文案里就等于又造了一个真源。 */
      const say = err === 0
        ? `${want} 存进去再读出来，还是 ${want} —— 这个数的二进制是有限的，一位没丢。`
        : `${want} 存进去，机器里实际是 **${got}** —— 误差 ${err.toExponential(3)}。`
      const other = fromBits(
        finalBits(runDoc({ ...doc, params: { ...doc.params, format: doc.params.format === 'double' ? 'single' : 'double' } })) ?? '')
      const otherName = doc.params.format === 'double' ? '单精度' : '双精度'
      const why = other === null
        ? '（另一档精度这次没算出来）'
        : err === 0
          ? `换成${otherName}也是 ${other} —— 有限小数在哪一档都存得下。`
            + '会出问题的是 0.1 那种：十进制有限、二进制无限。'
          : `换成${otherName}存，实际是 ${other}，误差 ${Math.abs(other - want).toExponential(3)} —— `
            + '**小了很多，但仍然不是 0**。位数只能把误差往后推，推不到没有：'
            + '二进制里除不尽的数，给多少位都除不尽。'
      return { pick, say, why }
    },
  },

  // ═══════════════════════════════════════════════════════
  //  计算机网络
  // ═══════════════════════════════════════════════════════

  tcp: {
    care:
      '网络会堵，而没有谁会告诉发送方"慢一点"。TCP 只能自己猜：**丢包就是堵了**。'
      + '于是它把发送窗口一点点试大，一丢包就砍。砍多狠、之后怎么再涨，'
      + '决定了这条连接实际能用上多少带宽 —— 也决定了你下载时那条速度曲线为什么是锯齿状的。'
      + '这一屏把 cwnd 每一轮的涨落画出来，两种丢包的处置差别一眼能看见。',
    guess: {
      q: '同样这两次丢包，Reno 和 Tahoe 跑完 20 轮，谁的窗口更大？',
      opts: ['Reno 更大', '一样大', 'Tahoe 更大'],
    },
    tasks: [
      { act: '先按默认走完 20 轮', watch: '曲线两次往下砍的位置 —— 第 8 轮和第 13 轮，砍法**不一样**' },
      { act: '把算法版本换成 Tahoe', watch: '第 8 轮那次由"腰斩"变成"直接回到 1"，后面整条线都低了一截', param: '算法版本' },
      { act: '把慢启动门限从 16 改成 4', watch: '指数涨的那一段被砍短，很早就进了拥塞避免 —— 末窗口反而更小', param: '慢启动门限' },
    ],
    goal: {
      say: '让跑完 20 轮时的 cwnd 达到 12 MSS 以上',
      /*
       * 量过的真实数（默认那两次丢包，20 轮）：
       *   算法版本  Reno 9 · Tahoe 8
       *   慢启动门限 4→8 · 8→8 · 16→9 · 32→12
       * 12 这条线只有把门限拉到 32 才够得着，而且不多不少正好压线 ——
       * 它要的是"看懂门限决定指数段能跑多远"，不是碰运气。
       */
      state: ({ trace }) => {
        const c = tail(trace, 'cwnd')
        if (c === null) return null
        return { now: `cwnd ${c} MSS`, met: c >= 12 }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      if (tail(trace, 'cwnd') === null) return null
      const at = (v: string) => tail(runDoc({ ...doc, params: { ...doc.params, variant: v } }), 'cwnd')
      const reno = at('Reno'), tahoe = at('Tahoe')
      if (reno === null || tahoe === null) return null
      const pick = reno > tahoe ? 0 : reno === tahoe ? 1 : 2
      const say = `你这组丢包事件：Reno 跑完是 ${reno} MSS，Tahoe 是 ${tahoe} MSS`
        + ` —— 所以「${['Reno 更大', '一样大', 'Tahoe 更大'][pick]}」。`
      const why = reno === tahoe
        ? '这组事件里两者没拉开差距 —— 快恢复只在**三次重复 ACK** 那种丢包上才和 Tahoe 分道扬镳；'
          + '如果丢包全是超时，两个版本的处置本来就一样。'
        : '差别只在**三次重复 ACK** 那一次：收到三个重复 ACK 说明后续的包还在到达，'
          + '路还通着，Reno 因此只把 cwnd 腰斩、留在较高的位置继续线性涨（快恢复）；'
          + 'Tahoe 不区分，一律回到 1 重新慢启动。**超时那一次两者一样惨** —— '
          + '超时意味着连重复 ACK 都收不到，没有理由认为路还通。'
      return { pick, say, why }
    },
  },

  arq: {
    care:
      '帧会丢，而发送方只能靠"该来的 ACK 没来"发现。发现之后重发**哪些**，'
      + '是回退 N 和选择重传的全部分歧：一个把丢掉那帧之后的统统重来，'
      + '一个只补那一帧。窗口开得越大，这个分歧的代价就越大 —— '
      + '这一屏把每一帧的去向画成时空图，重发了几次直接数得出来。',
    guess: {
      q: '同一组丢包，窗口都是 4，GBN 和 SR 谁的总传输次数少？',
      opts: ['GBN 少', '一样多', 'SR 少'],
    },
    tasks: [
      { act: '按默认（GBN · 窗口 4）走完', watch: '时空图上丢掉那一帧之后，**后面几帧也跟着重画了一遍**' },
      { act: '换成 SR，别的不动', watch: '同样的丢包，只有那一帧被补发 —— 累计传输从 12 掉到 9', param: '协议' },
      { act: '回到 GBN，把窗口从 4 拧到 6', watch: '时隙数从 20 降到 15（更快），但传输次数从 12 涨到 14（更费）', param: '发送窗口' },
    ],
    goal: {
      say: '在 20 个时隙内送完 8 帧，且累计传输不超过 10 次',
      /*
       * 量过的真实数（默认丢包，8 帧）：
       *   GBN 窗口 1/2/4/6 → 41/26/20/15 时隙 · 9/10/12/14 次传输
       *   SR  窗口 4       → 20 时隙 · 9 次传输
       *   SW（窗口定为 1）  → 41 时隙 · 9 次传输
       * 两条线是**故意互相拉扯**的：光求快（GBN 窗口 6）传输次数超标，
       * 光求省（窗口 1）时隙超标。同时满足只有 SR ——
       * 这正是"选择重传把速度和代价解耦"那句话本身。
       */
      state: ({ trace }) => {
        const c = arqCost(trace)
        if (c === null) return null
        const slots = trace.length
        const met = slots <= 20 && c.sent <= 10
        return {
          now: `${slots} 个时隙 · 传输 ${c.sent} 次`,
          met,
          miss: met ? undefined : slots > 20 ? '还是太慢' : '传输次数超了',
        }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      if (arqCost(trace) === null) return null
      const at = (v: string) => arqCost(runDoc({ ...doc, params: { ...doc.params, protocol: v } }))
      const g = at('GBN'), r = at('SR')
      if (!g || !r) return null
      const pick = g.sent < r.sent ? 0 : g.sent === r.sent ? 1 : 2
      const say = `你这组丢包、窗口 ${doc.params.windowSize}：GBN 传输 ${g.sent} 次（重传 ${g.resent}），`
        + `SR 传输 ${r.sent} 次（重传 ${r.resent}）—— 所以「${['GBN 少', '一样多', 'SR 少'][pick]}」。`
      const why = g.sent === r.sent
        ? '这组事件下两者一样 —— 窗口是 1 的时候本来就没有"后面几帧"可回退，'
          + 'GBN 和 SR 退化成同一个东西（那就是停止等待）。'
        : `差出来的 ${g.sent - r.sent} 次全是 GBN 的**无谓重传**：接收方只认按序到达，`
          + `一帧丢了，它后面那些即使收到了也一律丢弃，发送方只能从丢的那个开始全部重来。`
          + `SR 让接收方**先缓存**乱序到达的帧，于是只补缺的那一个。`
          + `代价是接收方要多一块缓存、还要按序号逐个确认 —— 省下的重传是拿内存换的。`
      return { pick, say, why }
    },
  },

  crc: {
    care:
      '一帧数据在线上跑，某一位被噪声翻了，收端凭什么知道？CRC 的办法是：'
      + '发送前拿数据除以一个**约定好的生成多项式**，把余数附在后面；'
      + '收端把整串再除一遍，余数是 0 就认为没错。这一屏把那个模 2 除法的竖式一步步摊开 —— '
      + '每一步都只是异或，不进位也不借位，看懂之后手算也不难。',
    guess: {
      q: '收端把收到的整串（数据 + 校验位）再除一遍，没出错的话余数是多少？',
      opts: ['等于校验位', '等于 0', '说不准'],
    },
    tasks: [
      { act: '先按默认（encode）走完竖式', watch: '最后一行的余数 —— 它就是要附在数据后面的**校验位 1110**' },
      { act: '把"做什么"换成 check', watch: '同一个生成多项式，除的是"数据 + 校验位"，余数变成 **0000**', param: '做什么' },
      { act: '在码字里翻一位再 check', watch: '余数不再是 0 —— 检出。这就是"余数为 0 才算通过"的全部含义' },
    ],
    goal: {
      say: '让收端算出的余数是 0（即这串码字校验通过）',
      /*
       * 量过：默认生成多项式 10011（4 位校验位）
       *   encode → 余数 1110（这是要附上去的校验位）
       *   check  → 余数 0000（码字完整）
       * 目标故意不是"算对校验位"，而是**站到收端那一侧看结果** ——
       * 编码那一档永远达不成，因为那时候还没把校验位附上去。
       */
      state: ({ trace }) => {
        const r = tailStr(trace, 'remainder')
        if (r === null || r === '') return null
        const zero = /^0+$/.test(r)
        return { now: `余数 ${r}`, met: zero, miss: zero ? undefined : '还不是全 0' }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      if (tailStr(trace, 'remainder') === null) return null
      const at = (v: string) => tailStr(runDoc({ ...doc, params: { ...doc.params, operation: v } }), 'remainder')
      const enc = at('encode'), chk = at('check')
      if (enc === null || chk === null) return null
      const pick = chk === enc ? 0 : /^0+$/.test(chk) ? 1 : 2
      const say = `你这个生成多项式：编码时余数是 ${enc}（这就是校验位），`
        + `把它附上去之后收端再除，余数是 ${chk} —— 所以「${['等于校验位', '等于 0', '说不准'][pick]}」。`
      const why = '因为附校验位这一步做的事情正是**把被除数补成能整除的样子**：'
        + '数据左移 n 位之后减去（模 2 就是异或）刚才的余数，得到的码字必然被生成多项式整除。'
        + '所以收端只要余数不为 0，就一定是路上被改过 —— '
        + '**反过来不成立**：余数为 0 也可能是错误恰好落在多项式的倍数上，那种错 CRC 查不出来。'
      return { pick, say, why }
    },
  },

  hamming: {
    care:
      'CRC 只能告诉你"这帧坏了，重传吧"。可有些场景没法重传 —— 内存里的一位翻了，'
      + '你找谁重传去？海明码多花几位校验，换来的是**直接指出是第几位错了**，就地改回来。'
      + '这一屏把校验位怎么摆、每一位管哪些位、以及那个"校验子恰好等于错位位号"的巧合，'
      + '一步步摆出来 —— 那不是巧合，是设计出来的。',
    guess: {
      q: '收端把三个校验位各算一遍，得到的校验子 101（十进制 5）意味着什么？',
      opts: ['第 3 位错了', '第 5 位错了', '错了 5 位'],
    },
    tasks: [
      { act: '先看位序表怎么排', watch: '1、2、4 这些 **2 的幂次位**放校验位，其余位置才放数据' },
      { act: '看每个校验位覆盖哪几位', watch: 'P1 管位号二进制**末位是 1** 的那些，P2 管倒数第二位是 1 的 —— 规律就在位号里' },
      { act: '把"做什么"切到 check，改出错位', watch: '校验子的十进制值**就是**出错的位号，不用查表', param: '做什么' },
    ],
    goal: {
      say: '让校验子非零并把出错位号指出来（即真的定位到一位错）',
      /*
       * 量过：4 位数据 / 3 位校验 / 码长 7
       *   做什么=encode → 校验子 0（编码阶段还没有错可查）
       *   做什么=check（默认 errorAt=5）→ 校验子 5 → 「第 5 位出错」
       * 目标定成"非零"而不是"等于某个数"：出错位是可改的，
       * 钉死一个数就变成了考默认配置的记性。
       */
      state: ({ trace }) => {
        const sy = tail(trace, 'syndrome')
        if (sy === null) return null
        return {
          now: sy === 0 ? '校验子 0（没查出错）' : `校验子 ${sy} → 第 ${sy} 位`,
          met: sy > 0,
        }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      if (tail(trace, 'syndrome') === null) return null
      const sy = tail(runDoc({ ...doc, params: { ...doc.params, operation: 'check' } }), 'syndrome')
      if (sy === null) return null
      const at = Number(doc.params.errorAt)
      const pick = sy === 0 ? 2 : sy === at ? 1 : 2
      const say = sy === 0
        ? '你这次没注入错误，三个校验位全通过，校验子是 0 —— 校验子为 0 才是"没错"。'
        : `你把第 ${at} 位翻了，收端算出的校验子是 ${sy} —— 两个数相等，所以是「第 ${sy} 位错了」。`
      const why = '校验子的**每一个二进制位**都是一次奇偶检查的结果：'
        + 'P1 管所有位号末位为 1 的位，P2 管倒数第二位为 1 的位，P4 管倒数第三位…… '
        + '某一位翻了，凡是覆盖它的校验位都会失败，凡是不覆盖它的都通过 —— '
        + '把失败的那些校验位按权重加起来，拼出来的正好就是**这一位的位号**。'
        + '所以它不是"查出有错"，是"把位号算了出来"。**代价是只对一位错有效**：'
        + '两位同时翻，校验子会指向一个无辜的位置。'
      return { pick, say, why }
    },
  },

  subnet: {
    care:
      '拿到一个网段和掩码，要能立刻回答两件事：这里面能划几个子网、每个子网能插多少台机器。'
      + '这是配网络时天天要算的，也是考试里最容易在"减 2"上翻车的地方。'
      + '这一屏把 32 位地址和掩码并排摊开 —— 哪几位是网络号、哪几位归主机，'
      + '以及那两个**不能分给主机的地址**分别长什么样。',
    guess: {
      q: '把前缀从 /24 改成 /26，每个子网可用的主机数变成原来的几分之几？',
      opts: ['四分之一还多一点', '正好四分之一', '一半'],
    },
    tasks: [
      { act: '先看位域那一行', watch: '掩码里连续的 1 划出网络号，剩下的 0 才是主机位' },
      { act: '把前缀长度在 24 / 25 / 26 之间来回拧', watch: '可用主机数 254 → 126 → 62，每借一位就**少掉一半再多一个**', param: '前缀长度' },
      { act: '把前缀拧到 30', watch: '只剩 2 个可用地址 —— 这正是点对点链路常用的那一档', param: '前缀长度' },
    ],
    goal: {
      say: '划出一个可用主机数正好是 62 的子网',
      /*
       * 量过（可用主机 = 2^(32−前缀) − 2）：
       *   /8 16777214 · /16 65534 · /24 254 · /25 126 · /26 62 · /30 2
       * 62 只有 /26 这一档，而且它是"减 2"体现得最清楚的一档 ——
       * 64 个地址里能给主机的只有 62 个。
       */
      state: ({ trace }) => {
        const s = trace[trace.length - 1] as { detail?: Record<string, string> } | undefined
        const v = s?.detail?.['可用主机数']
        if (v === undefined) return null
        const n = Number(v)
        return { now: `可用主机 ${v}`, met: n === 62 }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      const hosts = (d: typeof doc) => {
        const t = runDoc(d)
        const s = t[t.length - 1] as { detail?: Record<string, string> } | undefined
        const v = s?.detail?.['可用主机数']
        return v === undefined ? null : Number(v)
      }
      if (hosts(doc) === null) return null
      const a = hosts({ ...doc, params: { ...doc.params, prefix: 24 } })
      const b = hosts({ ...doc, params: { ...doc.params, prefix: 26 } })
      if (a === null || b === null || a === 0) return null
      const ratio = b / a
      //  正好四分之一要求 b*4 === a；实际 62*4 = 248 ≠ 254，所以是"还多一点"
      const pick = b * 4 > a ? 0 : b * 4 === a ? 1 : 2
      const say = `/24 能放 ${a} 台，/26 能放 ${b} 台 —— ${b} × 4 = ${b * 4}，`
        + `比 ${a} ${b * 4 > a ? '多' : b * 4 === a ? '正好等于' : '少'} ${Math.abs(b * 4 - a)}，`
        + `所以「${['四分之一还多一点', '正好四分之一', '一半'][pick]}」（实际 ${(ratio * 100).toFixed(1)}%）。`
      const why = '**地址总数**确实是正好四分之一：借 2 位划子网，2^8 变 2^6。'
        + '但可用主机数是"地址总数 − 2" —— 每个子网都要单独扣掉自己的网络地址（主机位全 0）'
        + '和广播地址（主机位全 1）。原来只扣一次 2，现在四个子网各扣一次，一共扣掉 8。'
        + '所以子网划得越细，被"减 2"吃掉的地址越多 —— 这是划分子网的隐性成本。'
      return { pick, say, why }
    },
  },

  handshake: {
    care:
      '建连接要三次握手，断连接要四次挥手 —— 这两个数背地里问的是同一件事：'
      + '**双方各自的"我要发/我发完了"是独立的**。建连时两个方向的同步能捎带在一个报文里，'
      + '所以三次；断连时一方发完了另一方还可能没发完，捎带不了，所以四次。'
      + '这一屏把每个报文段的标志位、序号、以及两端状态的变化逐个走一遍。',
    guess: {
      q: '连上再断开，一共要交换几个报文段？',
      opts: ['6 个', '7 个', '8 个'],
    },
    tasks: [
      { act: '把场景切到 connect', watch: '三个报文段：SYN → SYN+ACK → ACK，中间那个是**两件事捎带在一起**', param: '场景' },
      { act: '切到 close', watch: '四个报文段：FIN → ACK → FIN → ACK，中间那两个**分开了**', param: '场景' },
      { act: '切回 both 走完整条', watch: '3 + 4 = 7 —— 两段合起来的总数，以及末尾那个 TIME_WAIT', param: '场景' },
    ],
    goal: {
      say: '走完整条：把两端都送回 CLOSED',
      /*
       * 量过：场景 connect 8 步 / 3 个报文段（末态两端 ESTABLISHED）
       *      场景 close   12 步 / 4 个报文段（两端 CLOSED）
       *      场景 both    20 步 / 7 个报文段（两端 CLOSED）
       * 目标要的是"两端都回到 CLOSED"而不是"报文段数等于 7" ——
       * 前者是状态机真的走完了，后者只是数数。
       */
      state: ({ trace }) => {
        const c = tailStr(trace, 'client'), sv = tailStr(trace, 'server')
        if (c === null || sv === null) return null
        const met = c === 'CLOSED' && sv === 'CLOSED'
        return { now: `客户端 ${c} · 服务器 ${sv}`, met, miss: met ? undefined : '还没回到 CLOSED' }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      const segs = (v: string) => {
        const t = runDoc({ ...doc, params: { ...doc.params, scenario: v } })
        const s = t[t.length - 1] as { history?: unknown[] } | undefined
        return s?.history?.length ?? null
      }
      if (segs(String(doc.params.scenario)) === null) return null
      const c = segs('connect'), d = segs('close')
      if (c === null || d === null) return null
      const n = c + d
      const pick = n === 6 ? 0 : n === 7 ? 1 : 2
      const say = `建连 ${c} 个 + 断连 ${d} 个 = ${n} 个 —— 所以「${['6 个', '7 个', '8 个'][pick]}」。`
      const why = '建连是 3 不是 4，是因为服务器的「我收到了你的 SYN」和「我也要发」'
        + '**捎带在同一个报文段**里（SYN+ACK）。断连没法这么捎带：'
        + '收到对方的 FIN 只说明**它**发完了，自己可能还有数据要发，'
        + '所以先单独回一个 ACK，等自己也发完再发自己的 FIN —— 这就多出一个报文段。'
        + '中间那段（一方已 FIN、另一方还在发）就是 CLOSE_WAIT，'
        + '生产上大量 CLOSE_WAIT 堆积，说明程序收到 FIN 之后忘了关自己那一头。'
      return { pick, say, why }
    },
  },

  semaphore: {
    care:
      '生产者往缓冲区放、消费者从缓冲区取，中间要靠三个信号量协调：'
      + '`empty` 数空位、`full` 数产品、`mutex` 管互斥。'
      + '这三句 P 操作的**先后顺序**看着无关紧要，写反一次就可能整个系统卡死 —— '
      + '而且不是每次都卡，得**赶上特定的调度**才卡。这一屏把两段代码、三个信号量、'
      + '每个线程执行到第几行全摆出来，让"错了会死锁"这句话真的发生一次给你看。',
    guess: {
      q: '把 P(mutex) 提到 P(empty) 前面，是不是一定会死锁？',
      opts: ['一定会', '看调度，未必', '一定不会'],
    },
    tasks: [
      { act: '按默认（交替执行 · 正确）走完', watch: '三个信号量的值一直在动，谁都没被阻塞过 —— 这是正常协作的样子' },
      { act: '只把「P 的顺序」改成错误，别的不动', watch: '**照样走完，一次都没卡** —— 交替调度根本走不到会抢锁的地方', param: 'P 的顺序' },
      { act: '把「调度序列」换成「消费者先跑」，保持错误顺序', watch: '第 5 步就死锁：消费者攥着 mutex 等 full，生产者要 mutex 才能放产品', param: '调度序列' },
    ],
    goal: {
      say: '造出一次真的死锁（所有线程都卡住）',
      /*
       * 量过的六种组合（浏览器里读的真实那一屏）：
       *   交替执行  · 正确 22 步 无阻塞 2/2   · 错误 22 步 无阻塞 2/2
       *   生产者连跑 · 正确 19 步 无阻塞 2/1   · 错误 15 步 **死锁** P1@empty C1@mutex
       *   消费者先跑 · 正确 13 步 无阻塞 1/1   · 错误  5 步 **死锁** C1@full  P1@mutex
       * 也就是说：光把顺序改错**不够**，还得赶上一条会抢锁的调度 ——
       * 目标要的正是让人自己撞出这个"两个条件缺一不可"。
       */
      state: ({ trace }) => {
        const e = semEnd(trace)
        if (e === null) return null
        const who = Object.entries(e.blocked).map(([k, v]) => `${k}@${v}`).join(' ')
        return {
          now: e.dead ? `死锁 · ${who}` : who ? `有人阻塞 · ${who}` : '一路畅通',
          met: e.dead,
          miss: e.dead ? undefined : '还没卡死',
        }
      },
    },
    verdict: ({ doc, trace, runDoc }) => {
      if (semEnd(trace) === null) return null
      const at = (o: string) => semEnd(runDoc({ ...doc, params: { ...doc.params, order: o } }))
      const right = at('correct'), wrong = at('wrong')
      if (!right || !wrong) return null
      //  正确顺序永远不死锁；错误顺序**在这条调度上**死不死，才是答案
      const pick = wrong.dead && !right.dead ? 1 : wrong.dead ? 0 : 1
      const sched = String(doc.params.schedule ?? '当前这条')
      const say = wrong.dead
        ? `在「${sched}」这条调度上：正确顺序走得通，错误顺序**死锁**了。`
          + `但换成「交替执行」，同样是错误顺序却一路畅通 —— 所以「看调度，未必」。`
        : `在「${sched}」这条调度上：两种顺序都走得通，错误顺序**也没卡** —— 所以「看调度，未必」。`
      const why = '死锁要四个条件同时成立，这里凑齐的是**占有并等待**加**循环等待**：'
        + '错误顺序让线程**先攥住 mutex 再去等资源**，而能放出那个资源的另一方，'
        + '偏偏也要 mutex 才动得了 —— 两边各攥着对方要的东西。'
        + '正确顺序把 P(mutex) 放在后面，等资源的时候手里**什么都没攥**，'
        + '所以另一方随时进得了临界区，循环等待成立不了。'
        + '**这也是为什么错误的代码能在测试里跑很久不出事**：'
        + '它要赶上一条恰好让两边同时开工的调度才现形。'
      return { pick, say, why }
    },
  },

  csma: {
    care:
      '一根共享的线，两台机器同时开口就撞车。CSMA/CD 的办法是：**先听再说，边说边听**，'
      + '撞了就都闭嘴、各自等一段随机时间再来。关键在"随机" —— '
      + '如果两台机器每次等的时间一样长，它们会一直撞到放弃。'
      + '这一屏把每个时隙谁在发、撞没撞、各自退避多久摆出来，退避取值的作用一眼能看见。',
    guess: {
      q: '两个站每次退避都取同一个 r，最后会怎样？',
      opts: ['迟早错开，都成功', '一直撞到双双放弃', '其中一个先成功'],
    },
    tasks: [
      { act: '先跑「两站争用」', watch: '撞一次之后两站取了不同的 r，随后各自错开 —— 5 个时隙全部发完', preset: '两站争用' },
      { act: '换成「退避撞车」', watch: '两站每次取同一个 r，于是每次都一起回来、又一起撞 —— 撞到上限双双放弃', preset: '退避撞车' },
      { act: '撞车状态下把重传上限从 16 拧到 3', watch: '时隙从 24 缩到 7 —— 上限只决定**撞多少次才认输**，救不了撞车本身', param: '重传上限' },
    ],
    goal: {
      say: '让所有站都发送成功（一个放弃的都没有）',
      /*
       * 量过：
       *   两站争用           5 时隙 · 成功 2/2 · 各撞 1 次
       *   退避撞车 上限 3    7 时隙 · 成功 0/2 · 两站都放弃 · 各撞 3 次
       *   退避撞车 上限 16  24 时隙 · 成功 0/2 · 两站都放弃 · 各撞 16 次
       *   三站争用           9 时隙 · 成功 3/3 · 撞 A:2 B:1 C:2
       * 目标盯"没有放弃的"而不是"时隙数少"：这个实验要教的是
       * **退避取值必须岔开**，而不是调参调出一个更快的数。
       */
      state: ({ trace }) => {
        const e = csmaEnd(trace)
        if (e === null) return null
        const met = e.aborted === 0 && e.done === e.total
        return {
          now: `成功 ${e.done} / ${e.total}${e.aborted ? ` · 放弃 ${e.aborted}` : ''}`,
          met,
          miss: met ? undefined : e.aborted ? '有站放弃了' : '还没都发完',
        }
      },
    },
    verdict: ({ trace }) => {
      const e = csmaEnd(trace)
      if (e === null) return null
      const pick = e.aborted === 0 ? 0 : e.aborted === e.total ? 1 : 2
      const say = `你这组站：${e.done} 个成功、${e.aborted} 个放弃，撞得最多的那个撞了 ${e.worst} 次`
        + ` —— 所以「${['迟早错开，都成功', '一直撞到双双放弃', '其中一个先成功'][pick]}」。`
      const why = e.aborted === 0
        ? '各站取的 r 不一样，撞一次之后就错开了 —— 这正是二进制指数退避要的效果：'
          + '退避区间随冲突次数翻倍（0~1、0~3、0~7…），撞得越多、可选的值越多，撞在一起的概率越低。'
        : '两个站每次取同一个 r，就等于**约好了一起回来** —— 一起退避、一起重发、一起再撞。'
          + '退避区间再大也没用，因为它们没有真的在里面独立地取值。'
          + '重传上限只决定撞到第几次认输：上限 3 撞 3 次就放弃，上限 16 就撞满 16 次，'
          + '**结局一样，只是浪费的时隙不同**。真实网卡靠的是各站独立的随机数，'
          + '这一屏把 r 摊成一列可以手填，正是为了让"随机"这件事变得看得见。'
      return { pick, say, why }
    },
  },

  sort: {
    care:
      '七种排序算法，考的从来不是"能不能排好"，而是**每一趟之后数组长什么样**、'
      + '哪些位置**真的定了**、哪些只是**暂时有序**还会再动。冒泡/选择/快排/堆每趟能确定'
      + '某个元素的最终位置；插入/希尔/归并的"已排好前缀"只是局部有序，后面还会被挤动 —— '
      + '这两类在图上用不同颜色分开。比较次数和移动次数也差得远：冒泡跟数据无关恒为 n(n−1)/2 次比较，'
      + '快排平均最少，但**遇到已经有序的数组会退化**。这一屏把每一趟摊开，让你看清代价花在哪。',
    guess: {
      q: '同一个数组，用快速排序和冒泡排序各排一遍，谁的比较次数少？',
      opts: ['快排少', '一样多', '冒泡少'],
    },
    tasks: [
      { act: '在「排序算法」里切到快速，再切到冒泡', watch: '比较次数差多少 —— 冒泡跟数据无关，快排看运气', param: '排序算法' },
      { act: '把待排序数组改成**已经从小到大排好**的，再跑快排', watch: '快排的比较次数不降反升 —— 划分退化到最坏' },
      { act: '切到直接插入，再切到冒泡', watch: '插入的前缀是"暂时有序"、冒泡的后缀才是"真的定了" —— 图上颜色不同', param: '排序算法' },
    ],
    verdict: ({ doc, trace, runDoc }) => {
      if (sortCost(trace) === null) return null
      const q = sortCost(runDoc({ ...doc, params: { ...doc.params, algorithm: '快速' } }))
      const b = sortCost(runDoc({ ...doc, params: { ...doc.params, algorithm: '冒泡' } }))
      if (!q || !b) return null
      const pick = q.cmp < b.cmp ? 0 : q.cmp === b.cmp ? 1 : 2
      const say = `你这个数组：快排比较 ${q.cmp} 次、冒泡比较 ${b.cmp} 次 —— 所以「${['快排少', '一样多', '冒泡少'][pick]}」。`
      const why = pick === 2
        ? `快排反而更多，说明这串**接近有序** —— 快排一旦每次只划出一头，就退化成 O(n²)，`
          + `和冒泡一个量级。冒泡的 ${b.cmp} 次是恒定的，跟数据长什么样无关。`
        : `快排靠"分而治之"把比较次数从冒泡的 ${b.cmp} 次压到 ${q.cmp} 次；`
          + `但这只是**平均**情况 —— 把数组换成已排好序的，它会退化到跟冒泡一样甚至更糟。`
      return { pick, say, why }
    },
  },

  dijkstra: {
    care:
      '从一个源点出发，到每个点的最短路是怎么**一步步定下来**的。核心动作叫**松弛**：'
      + '如果"经过刚确定的点再到 v"比 v 现在记的距离更短，就更新它。每一轮从**还没确定**的点里'
      + '挑当前距离最小的那个**定死** —— 因为边权非负，绕远路只会更长，所以它之后再也不会更短。'
      + '每个点还记住"我是从谁那儿被松弛到最短的"，这些前驱边连起来就是**最短路径树**。'
      + '换个源点，整棵树就是另一副样子 —— 它是"从这个源点看"的树，不是图的固有属性。',
    guess: {
      q: '把这个图从无向改成有向（每条边只能单向走），从源点能到达的点会变少吗？',
      opts: ['变少（有些点走不到了）', '完全不变'],
    },
    tasks: [
      { act: '在「图的类型」里从无向切到有向', watch: '能到达的点是不是少了 —— 有向图里回不了头', param: '图的类型' },
      { act: '换一个「源点」', watch: '加粗的最短路径树整棵变样 —— 它是从源点看的，不是图固有的', param: '源点' },
    ],
    verdict: ({ doc, trace, runDoc }) => {
      if (reachCount(trace) === null) return null
      const un = reachCount(runDoc({ ...doc, params: { ...doc.params, directed: 0 } }))
      const di = reachCount(runDoc({ ...doc, params: { ...doc.params, directed: 1 } }))
      if (un === null || di === null) return null
      const pick = di < un ? 0 : 1
      const say = `无向时能到达 ${un} 个点，改成有向后能到达 ${di} 个 —— 所以「${['变少（有些点走不到了）', '完全不变'][pick]}」。`
      const why = pick === 0
        ? `有向图里边不能倒着走，于是有 ${un - di} 个点从源点再也够不着 —— 它们的距离是 ∞，画不进最短路径树。`
        : `这张图的每条边正反都通到同一批点，所以方向没改变可达范围；但**具体的最短路**可能已经换了一条。`
      return { pick, say, why }
    },
  },

  banker: {
    care:
      '一组进程各自还差一些资源才能跑完。银行家算法在**每次分配前先推演一遍**：'
      + '假装把资源给出去，看还找不找得到一个顺序，让每个进程都能拿到它还差的、跑完、'
      + '把资源全还回来。找得到这样一个**安全序列**，这次分配就安全；找不到就拒绝，宁可让它等。'
      + '关键是理解"安全"不等于"没有死锁风险"，而是**存在**一条大家都能善终的路 —— '
      + '哪怕现在看着资源紧张。这一屏把这条推演逐个进程摊开：谁能满足、谁被跳过、最后排不排得成一列。',
    guess: {
      q: '当前这组请求下，系统处于安全状态吗？',
      opts: ['安全（存在安全序列）', '不安全'],
    },
    tasks: [
      { act: '在右边「资源矩阵」里把某个进程的 Need 调大，超过当前可用量', watch: '安全序列可能就排不出来了 —— 变成不安全' },
      { act: '把可用资源（Available）调小一两个', watch: '哪个进程先被"卡住"、整条序列在哪一步断掉' },
    ],
    verdict: ({ trace }) => {
      const r = bankerSafe(trace)
      if (r === null) return null
      const pick = r.safe ? 0 : 1
      const say = r.safe
        ? `这组请求**安全** —— 找到了一条安全序列：${r.seq.join(' → ')}。`
        : `这组请求**不安全** —— 无论从哪个进程试起，都排不出一条让所有进程善终的顺序。`
      const why = r.safe
        ? `注意"安全"只是说**存在**这一条路；真跑起来只要按这个顺序放行就不会死锁。`
          + `换个分配次序未必安全，所以每次请求都要重新推演一遍。`
        : `不安全**不等于**已经死锁 —— 它是"再往下走可能锁死"的预警，银行家算法就是靠拒绝这次分配来避免走进去。`
      return { pick, say, why }
    },
  },

  avl: {
    care:
      '普通二叉搜索树按大小往下挂，遇到有序的插入序列会退化成一根链，查找从 O(log n) 掉到 O(n)。'
      + 'AVL 用**平衡因子**（左子树高 − 右子树高）盯着每个结点：插完从插入点往上回溯，'
      + '谁的绝对值超过 1，谁就是失衡结点，对它**旋转**。旋转按"失衡结点往下两步的方向"命名 —— '
      + '同向（LL/RR）转一次，异向（LR/RL）要先把下面掰同向再转，一共两次。'
      + '代价是每次插入多做点功，换来的是**树高始终 O(log n)**，查找永远不退化。',
    guess: {
      q: '按当前这串键插进 AVL 树，中途会发生旋转吗？',
      opts: ['会（至少一次）', '不会'],
    },
    tasks: [
      { act: '在「模式」里从 AVL 切到 BST（不旋转）', watch: '同一串键，BST 长得更高、更歪 —— 那正是 AVL 要治的', param: '模式' },
      { act: '把插入序列改成**递增**的（如 1 2 3 4 5）', watch: 'BST 退化成一根链；AVL 每插几个就转一次，始终矮胖' },
    ],
    verdict: ({ trace }) => {
      const r = avlRot(trace)
      if (r === null) return null
      const pick = r.rot > 0 ? 0 : 1
      const say = r.rot > 0
        ? `这串键插完，一共旋转了 **${r.rot}** 次 —— 所以「会」。`
        : `这串键插完一次也没旋转 —— 它们本来就插得比较平衡。`
      const why = r.rot > 0
        ? `每次旋转都是在某个结点失衡（平衡因子到了 ±2）的一瞬间把它掰回来；`
          + `${r.n} 个结点转了 ${r.rot} 次，换来的是树高始终 O(log n)。换成 BST 模式，这些旋转全省了，但树会长歪。`
        : `没旋转不代表 AVL 没用 —— 换一串递增的键（1 2 3 4…），BST 会退化成链，而 AVL 会立刻开始旋转。`
      return { pick, say, why }
    },
  },

  forward: {
    care:
      '前面你一个个拆开学的零件 —— 词嵌入、RMSNorm、自注意力、缩放与掩码、FFN、softmax、采样 —— 现在把它们**串成一次真实推理**，看数据怎么从一个词流到"下一个词"。'
      + '流程是一条固定的链：**词嵌入**把 token 变成向量 → **RMSNorm** 稳住尺度 → **自注意力**让它融入上下文（Q·Kᵀ/√d → 因果掩码 → softmax → 加权求和 V）→ **残差**加回 → 再 **RMSNorm** → **FFN** 做非线性变换 → **残差**加回（一层 Transformer 块到此结束）→ '
      + '真实模型把这样的块**叠几十上百层** → **末层 RMSNorm** → **LM 头**把末向量投影到词表得到每个词的 **logit** → **softmax** 成概率 → **采样**选出下一个 token。'
      + '本实验用一个 d=4、单头单层、词表只有 4 个词的迷你模型，把「猫 吃」喂进去，逐段展示真实向量怎么被改写，最后 softmax 出概率、预测下一个词是「鱼」（47%）——「猫吃鱼」。'
      + '每一段旁边都标着它对应之前哪个实验，你会看到那些孤立的机制原来是同一条流水线上的工位。'
      + '**最关键的认知**：这条 embed→注意力→FFN→norm→采样 的链，就是推理引擎每走一步 decode 真正在跑的东西。'
      + '你之前学的所有优化 —— KV 缓存（别重算前文的 K/V）、FlashAttention（注意力那段别把分数落显存）、量化（权重存小一点）、连续批处理（多条链一起跑）、投机解码（一次多吐几段）—— '
      + '**优化的全是这条链的速度，没有一个改变它算出来的结果**。看懂这一屏，前面 20 个实验就从"一堆知识点"变成了"一台机器"。',
    guess: {
      q: '推理引擎里的 KV 缓存、FlashAttention、量化这些优化，改变的是什么？',
      opts: ['只改这条前向链的速度，不改结果', '会让输出更准或更好'],
    },
    tasks: [
      { act: '一步步点"下一步"走完 10 段', watch: '同一个向量在每段被改写：归一化拉尺度、注意力融入上下文、FFN 变换、残差叠加，最后变成 logits' },
      { act: '走到最后看词表概率条', watch: 'logits 过 softmax 成概率，最高的「鱼」被选中 —— 这就是模型吐出下一个字的瞬间' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; predicted?: string; probs?: number[]; seq?: string[] }>(trace)
      if (!s || s.phase !== 'done' || !s.predicted) return null
      const probs = s.probs ?? []
      const bi = probs.length ? probs.reduce((b, p, i, a) => (p > a[b] ? i : b), 0) : -1
      const pct = bi >= 0 ? Math.round(probs[bi] * 100) : 0
      return {
        pick: 0,
        say: `「${(s.seq ?? []).join('')}」走完整条前向链，softmax 后预测下一个 token 是「**${s.predicted}**」（${pct}%）。`,
        why: `这条 embed→RMSNorm→注意力→残差→FFN→残差→norm→LM头→softmax→采样 的链，就是每步 decode 真正跑的东西。KV 缓存、FlashAttention、量化、连续批处理、投机解码，优化的都是它的速度，都不改变这个结果 —— 这就是把前面所有零件拼成一台机器的样子。`,
      }
    },
  },

  rmsnorm: {
    care:
      'Transformer 是很多层叠起来的，每一层都会改变数值的大小。若不管控，信号会越叠越大或越叠越小，梯度爆炸或消失、根本训不动 —— 所以**每个子层前都要做一次归一化**，把数值拉回统一尺度。'
      + '经典做法是 **LayerNorm**：先减去均值、再除以标准差，最后用两组可学习参数（缩放 + 偏置）调回来。'
      + '**RMSNorm** 把它简化：**不减均值**，只用**均方根 RMS = √(各维平方的平均)** 把向量整体缩放到单位尺度，再乘一个可学习增益 g（每维一个，没有偏置）：x̂ᵢ = xᵢ / RMS · gᵢ。'
      + '本实验里 x=[2,−4,1,3]，均方 = (4+16+1+9)/4 = 7.5，RMS = √7.5 ≈ 2.739，除下去得到 [0.73, −1.46, 0.37, 1.10] —— '
      + '这个新向量的均方根**恰好是 1**（尺度被拉齐了），这就是"归一化"的含义。'
      + 'RMSNorm 比 LayerNorm 少一次求均值、少一组偏置参数，计算更省、实现更简，效果却几乎一样 —— 所以 **LLaMA、Qwen、DeepSeek 等主流大模型都改用了它**。'
      + '别小看这一步：它不改变向量的"方向"（相对大小关系），只统一"尺度"，是让几十上百层能稳定叠起来的幕后功臣，也和 softmax 里"除 √d 防饱和"一样，都是在管住数值的量程。',
    guess: {
      q: 'RMSNorm 和 LayerNorm 最主要的区别是什么？',
      opts: ['RMSNorm 不减均值（更省一步）', 'RMSNorm 精度更高但更慢'],
    },
    tasks: [
      { act: '把增益 g 改成"放大末维"', watch: '前几维输出不变，最后一维翻倍 —— 增益 g 是每维一个的可学习缩放', param: '可学习增益 g' },
      { act: '盯住底部校验行', watch: '不管输入是什么，归一化后（未乘增益）向量的 RMS 永远是 1 —— 尺度被拉齐', param: '可学习增益 g' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; rms?: number; outRms?: number; x?: number[] }>(trace)
      if (!s || s.phase !== 'done' || s.rms === undefined) return null
      return {
        pick: 0,
        say: `x=[${(s.x ?? []).join(', ')}] 的 RMS = **${s.rms}**，每维除以它之后向量的 RMS 恰好是 **${s.outRms}**（单位尺度）。`,
        why: `RMSNorm 用均方根把向量缩到统一尺度、不减均值、不带偏置，比 LayerNorm 少一步计算和一组参数。它统一数值量程、不改方向，是几十上百层 Transformer 能稳定叠起来的关键，也是主流大模型的标配。`,
      }
    },
  },

  rope: {
    care:
      '注意力有个"缺陷"：它对**词序无感** —— 把句子里的词打乱，算出来的注意力权重一模一样（它只看两两之间的相关性，不看谁在前谁在后）。'
      + '所以必须额外把"每个词在第几位"这个信息喂进去。**RoPE（旋转位置编码）**的做法很巧：'
      + '把每一对相邻维度 (x₂ᵢ, x₂ᵢ₊₁) 看成平面上的一个 **2D 向量**，按 **位置 × 频率 θ** 的角度去**旋转**它 —— 位置越靠后、转得越多。'
      + '旋转是正交变换，**只改方向、不改模长**（本实验里走遍 8 个位置，模长始终是 1.000）。这比"直接加一个位置向量"高明：加法会改变向量大小、干扰原来的语义，旋转不会。'
      + '最关键的性质：位置 m 的 query 和位置 n 的 key 各自旋转后做点积，结果**只依赖夹角差 (m−n)·θ** —— '
      + '也就是只和**相对位置**有关、与绝对位置无关。这带来两个好处：模型天然理解"相隔多远"，而且能**泛化到训练时没见过的更长上下文**（外推）。'
      + '真实 RoPE 给每一对维度一个**不同的频率** θᵢ = base^(−2i/d)：转得快的那些编码精细位置、转得慢的编码粗位置，像时钟的秒针和时针一起读出精确时间。'
      + 'LLaMA、Qwen、DeepSeek 等主流模型全用 RoPE —— 它是长上下文能力的地基之一。',
    guess: {
      q: 'RoPE 旋转向量之后，向量的模长（大小）会怎样？',
      opts: ['不变（旋转只改方向，是正交变换）', '变大或变小（取决于位置）'],
    },
    tasks: [
      { act: '把 θ 从 30° 调到 60°', watch: '每个位置转得更多、绕圈更快 —— θ 就是这对维度的旋转频率', param: '每位旋转角 θ' },
      { act: '盯住"模长 |v|"这一行', watch: '走遍所有位置，模长始终是 1.000 —— 旋转保范，加法位置编码做不到', param: '每位旋转角 θ' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; norm?: number; thetaDeg?: number; dotWith0?: number }>(trace)
      if (!s || s.phase !== 'done' || s.norm === undefined) return null
      return {
        pick: 0,
        say: `走遍所有位置，向量模长始终是 **${(s.norm).toFixed(3)}** —— 旋转只改方向不改大小，且位置 m、n 的点积只依赖 (m−n)·θ（只看相对位置）。`,
        why: `RoPE 用旋转（正交变换）编码位置，保范所以不干扰语义大小；点积只由相对角差决定，所以模型天然懂"相隔多远"、还能外推到更长上下文。这就是它比加法位置编码更强、被主流大模型普遍采用的原因。`,
      }
    },
  },

  moe: {
    care:
      'Transformer 每一层有两个大块：注意力，和 **FFN（前馈网络）**。FFN 往往是**参数量最大**的部分（见「参数量与显存」，每层 FFN ≈ 2·ffn·d²）。'
      + '稠密模型里，每个 token 都要**过同一个大 FFN**，全部参数都参与计算 —— 想让模型更聪明就得把 FFN 做大，但那样每个 token 的算力也跟着涨。'
      + '**MoE（专家混合）**换了个思路：把那个大 FFN 拆成 **E 个小专家**，再加一个 **router** 给每个 token 打分；'
      + '门控 = softmax(router 分数)，只挑门控最高的 **top-k 个专家**来算，输出是这 k 个专家结果按门控**加权求和**。'
      + '妙处在于：模型的**总参数随专家数 E 增长**（容量变大、更能记东西），但每个 token 只激活 k 个专家、**算力只随 k 走**（活跃参数 ∝ k/E）。'
      + '这就是"总参数几百 B、推理却只激活几十 B"的来历 —— Mixtral、DeepSeek-V3、Qwen-MoE 都是这么又大又省的。'
      + '代价是**负载可能不均**：router 偏爱某些专家，热门专家排长队、冷门专家闲置（本实验里 4 个专家负载 [3,1,3,1] 就不均），'
      + '所以真实 MoE 要靠负载均衡损失、专家容量上限等手段把 token 摊匀。这是"稀疏激活换容量"的典型工程。',
    guess: {
      q: 'MoE 把 top-k 从 2 调到 1，每个 token 的计算量会怎样？',
      opts: ['减半（只激活 1 个专家而非 2 个）', '不变（总参数一样）'],
    },
    tasks: [
      { act: '把 top-k 从 2 调到 1', watch: '活跃参数从 50% 降到 25%，更省算力；但每个 token 能用的专家更少、表达力下降', param: '每 token 选几个专家' },
      { act: '盯住底部负载条', watch: '有的专家一直被选（红色最忙）、有的没人光顾 —— 这就是 MoE 要做负载均衡的原因', param: '每 token 选几个专家' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; topk?: number; experts?: number; activeFrac?: number; load?: number[] }>(trace)
      if (!s || s.phase !== 'done' || s.activeFrac === undefined) return null
      const load = s.load ?? []
      const uneven = load.length ? Math.max(...load) !== Math.min(...load) : false
      return {
        pick: 0,
        say: `每个 token 只激活 **${s.topk}/${s.experts}** 个专家（活跃参数 **${Math.round((s.activeFrac ?? 0) * 100)}%**），负载 [${load.join('、')}]${uneven ? '，忙闲不均' : '，正好均衡'}。`,
        why: `总参数随专家数 E 涨（容量大），但每 token 只算 top-k 个专家、算力只随 k 走 —— 这就是 MoE"参数几百 B、推理只激活几十 B"的稀疏激活。代价是路由容易偏心，需要负载均衡把 token 摊匀。`,
      }
    },
  },

  quant: {
    care:
      '大模型的显存几乎全被权重吃掉（见「参数量与显存」：7B 的 fp16 权重就要 ~13G）。'
      + '**量化**的想法很直接：权重不用那么高精度存 —— 把 fp32/fp16 压成**低位整数**，一个权重从 4 字节缩到 1 字节甚至 0.5 字节。'
      + '做法是**对称量化**：先按一组权重里绝对值最大的那个定一个步长 **scale = max|w| ÷ (2^(bits−1)−1)**（int8 除以 127、int4 除以 7）；'
      + '再把每个权重 **q = round(w ÷ scale)** 四舍五入成整数存起来；用的时候**反量化** ŵ = q × scale 还原。'
      + '因为整数只有有限格、scale 一格代表固定大小，还原值和原值会差一点点（**舍入误差**）。'
      + 'int8 每权重 1 字节、显存省 75%，误差极小（本实验 0.008）；int4 每权重 0.5 字节、显存省 87.5%，但 scale 翻倍、格子变粗，误差明显变大（0.14）。'
      + '这就是「7B 换 int8 只要 ~7G」的来历，也是 **W8A8 / W4A16 量化推理**的地基 —— 拿一点点精度，换回成倍的显存和访存带宽。'
      + '它和 IEEE754 浮点、补码那两屏是同一条线：都是在问"一个数用多少位、怎么编码、会差多少"。',
    guess: {
      q: '从 int8 换成 int4，显存和误差会怎样？',
      opts: ['显存再省一半，但舍入误差明显变大', '两者都基本不变'],
    },
    tasks: [
      { act: '在 int8 / int4 之间切', watch: 'int4 显存再省一半（32B→4B），但 scale 变大、整数格变粗，最大误差从 0.008 跳到 0.14', param: '量化位数' },
      { act: '盯绝对值最大的权重 −2.10', watch: '它总被映射到 ±qmax（int8 的 −127 / int4 的 −7），误差几乎为 0 —— scale 就是照它定的', param: '量化位数' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; bits?: number; bytesFp32?: number; bytesQ?: number; maxErr?: number }>(trace)
      if (!s || s.phase !== 'done' || s.bytesQ === undefined || s.bytesFp32 === undefined) return null
      const saved = Math.round((1 - (s.bytesQ) / (s.bytesFp32)) * 100)
      return {
        pick: 0,
        say: `int${s.bits} 把权重从 ${s.bytesFp32} 字节压到 **${s.bytesQ} 字节**（省 **${saved}%** 显存），最大误差只有 **${(s.maxErr ?? 0).toFixed(3)}**。`,
        why: `每个权重从 4 字节的浮点变成 int${s.bits} 的 ${(s.bits ?? 8)/8} 字节整数，靠 scale 在整数格和实数之间换算。位越少格越粗、误差越大，但显存和访存带宽省得越多。这就是量化推理的核心权衡，也是「7B 塞进消费级显卡」的关键一招。`,
      }
    },
  },

  specdec: {
    care:
      '大模型解码有个恼人的事实：它一次只能吐一个字，而**每吐一个字都要把整个模型跑一遍前向**（贵，还是显存带宽瓶颈）。'
      + '生成 100 个字就要 100 次大模型前向，慢就慢在这。**投机解码**的巧思：请一个又小又快的**草稿模型**先一口气**猜 K 个**后续 token，'
      + '再让大模型**一次前向并行验证**这 K+1 个位置 —— 一次前向验证多个位置，和验证一个位置几乎一样便宜（本来就是带宽瓶颈）。'
      + '验证规则：从头比对，**接受草稿猜对的最长前缀**，遇到第一个猜错的用大模型**自己的真值纠正**，后面作废；如果 K 个**全中**，还**白送** 1 个大模型 token。'
      + '于是**一次大模型前向能落地好几个字**：草稿准的时候一次吐 K+1 个，草稿错了也至少纠正着吐 1 个、绝不倒退。'
      + '最关键的一点 —— 落地的每个 token 都由大模型定夺，所以**最终输出和只用大模型逐字生成一模一样**（本实验里三轮生成 8 个字，结果始终是「深度学习真有意思」），'
      + '省的是大模型前向次数，不是质量。K 越大、草稿越准，接受得越多，加速比越高。这就是 Medusa、EAGLE、以及各家推理引擎"又快又不掉点"背后的同一招。',
    guess: {
      q: '投机解码生成出来的文本，和只用大模型逐字生成相比会怎样？',
      opts: ['完全一样（大模型定夺每个字，只是更快）', '略有差别（用了小模型所以质量下降）'],
    },
    tasks: [
      { act: '把草稿步数 K 从 1 加到 4', watch: 'K 越大一次猜得越多，草稿命中时接受越多、加速比越高（本例到 2.67×）', param: '草稿步数 K' },
      { act: '看每轮"接受几个"', watch: '草稿猜对就多吐几个字只花 1 次大模型前向；猜错处被大模型真值纠正，输出始终等于逐字结果', param: '草稿步数 K' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; tokensOut?: number; targetPasses?: number; speedup?: number }>(trace)
      if (!s || s.phase !== 'done' || s.speedup === undefined) return null
      return {
        pick: 0,
        say: `${s.tokensOut} 个 token 只跑了 **${s.targetPasses}** 次大模型前向（逐字要 ${s.tokensOut} 次）→ 加速 **${(s.speedup ?? 0).toFixed(2)}×**，输出与只用大模型完全一致。`,
        why: `每个落地的 token 都由大模型验证/定夺，草稿只负责提议、不改变结果。一次大模型前向能并行验证多个位置，草稿命中就一次吐多个字 —— 省前向次数、不省质量。这就是投机解码能"又快又不掉点"的原因。`,
      }
    },
  },

  scaledmask: {
    care:
      '注意力给每个词打完分（Q·K 点积）之后，还有两步不起眼、却决定模型能不能训练、能不能自回归生成的小处理：'
      + '**① 除 √d。** 点积是 d 个乘积相加，向量维度 d 越大、分数越容易变得很大。分数一大，softmax 就落进**饱和区** —— '
      + '一个权重≈1、其余≈0，分布几乎处处平坦、梯度接近 0，模型学不动。把所有分数**除以 √d**，正好抵消维度带来的放大，'
      + '让 softmax 停在"软硬适中"的地方（本实验里 d=1 最大权重 95%、d=4 降到 82%、d=64 只有 59%，一眼能看出越除越平）。'
      + '**② 因果掩码（causal mask）。** 自回归生成时第 i 个词只能看自己和前面的词、不能偷看未来。做法是把第 i 行里所有 j>i 的分数设成 −∞，'
      + 'softmax 之后这些位权重**恰好为 0**，整张注意力矩阵变成严格**下三角**。训练时加上它，模型预测每个位置时才只依赖左侧上下文，'
      + '和推理时逐字生成的可见范围一致 —— 这正是 GPT（单向）和 BERT（双向、无掩码）的分水岭。'
      + '两步都不改变"谁和谁算注意力"，只调整**分数的量程**和**能看见谁**，却是让 Transformer 真正跑起来的关键细节。',
    guess: {
      q: '把头维度 d 从 4 调到 64，同一行 softmax 的最大权重会怎样？',
      opts: ['变小（分布更平，因为除以更大的 √d）', '变大（维度高更确定）'],
    },
    tasks: [
      { act: '把头维度 d 在 1 / 4 / 64 之间切', watch: '同一行的最大权重从 95% → 82% → 59%，分布越来越平 —— √d 越大去饱和越明显', param: '头维度 d' },
      { act: '关掉因果掩码', watch: '注意力矩阵从下三角变成全满：每个词都能看到未来（双向，像 BERT）', param: '因果掩码' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; d?: number; peak?: number; peakUnscaled?: number; causal?: boolean }>(trace)
      if (!s || s.phase !== 'done' || s.peak === undefined) return null
      return {
        pick: 0,
        say: `除 √${s.d} 后本行最大权重 **${Math.round((s.peak ?? 0) * 100)}%**${(s.d ?? 1) > 1 ? `，若不除 √d 会到 **${Math.round((s.peakUnscaled ?? 0) * 100)}%**（更饱和）` : ''}；因果掩码让矩阵成${s.causal ? '**下三角**' : '**双向满**'}。`,
        why: `点积随维度放大，除 √d 把量程拉回来、避免 softmax 饱和到梯度消失；d 越大除得越多、分布越平。因果掩码把未来位设 −∞ → 权重恰为 0 → 下三角，保证生成时只看得见左侧。两步是 Transformer 能训练、能自回归的前提。`,
      }
    },
  },

  roofline: {
    care:
      '一个 GPU kernel 到底快不快，很多人只盯着"要算多少次"（FLOPs），但其实还有另一半：**要从显存搬多少数据**（字节）。'
      + '**Roofline 模型**把这两件事放一起看：**算术强度 AI = FLOPs ÷ 搬运字节数**（每搬一个字节，能顺带做几次浮点运算）。'
      + '机器有两个硬上限 —— 峰值算力 P（每秒多少 FLOP）和峰值带宽 B（每秒搬多少字节），它俩之比 P/B 叫**脊点**（本实验里 312÷2 = 156）。'
      + '可达性能 = min(P, AI·B)：**AI 小于脊点**时，性能被带宽卡死（memory-bound，算力大把闲着、就是喂不进数据）；**AI 大于脊点**才被算力卡住（compute-bound）。'
      + '画成图就是一条"先斜坡（带宽屋顶）、后平顶（算力屋顶）"的线，每个 kernel 是上面一个点。'
      + '**大模型解码的要命之处**：它是矩阵×向量，把整个权重矩阵从显存读出来、每个权重只用一次，AI≈1 —— 深深卡在带宽屋顶的最左边，'
      + '哪怕 GPU 有 312 TFLOP/s 的算力，实际只用到不到 1%（本实验批 1 时利用率 0.6%）。这就是"解码慢在搬权重、不在算"。'
      + '怎么办？**把 AI 往右推、贴近算力屋顶**：连续批处理把很多请求凑成大 batch（同一份权重摊给更多请求算，AI≈batch，本实验批 128 时利用率升到 77%）、'
      + 'KV 缓存少搬重复的 K/V、FlashAttention 让中间量不落显存 —— 你之前学的这些优化，本质上**都是在抬高算术强度**。Roofline 就是看懂它们为什么有用的那把尺子。',
    guess: {
      q: '大模型解码单条（batch=1）时，GPU 的算力利用率大概是多少？',
      opts: ['不到 1%（深陷带宽瓶颈）', '接近 100%（大模型很吃算力）'],
    },
    tasks: [
      { act: '一步步加大批（1 → 128）', watch: 'AI 从 ~1 涨到 ~120，点沿红斜坡往上爬，算力利用率从 0.6% 升到 77%', param: '模型维度 d' },
      { act: '对照你学过的优化', watch: '连续批处理抬 batch、KV 缓存少搬 K/V、FlashAttention 不落中间量 —— 全是在把 AI 往右推', param: '模型维度 d' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; util?: number; ai?: number; ridge?: number; bound?: string }>(trace)
      if (!s || s.phase !== 'done' || s.util === undefined) return null
      return {
        pick: 0,
        say: `批从 1 到 128，算术强度 AI 从 ~1 涨到 ~${(s.ai ?? 0).toFixed(0)}，算力利用率从不到 1% 爬到 **${Math.round((s.util ?? 0) * 100)}%** —— 但仍没越过脊点 ${s.ridge}，还在带宽这边。`,
        why: `解码单条 AI≈1，权重读一遍只用一次，被带宽死死卡住，几百 TFLOP 的算力几乎全闲着。加大 batch 让同一份权重摊给更多请求算，AI 随 batch 升高、点往算力屋顶爬。连续批处理、KV 缓存、FlashAttention 的共同本质就是抬高算术强度。`,
      }
    },
  },

  flash: {
    care:
      '注意力算一个查询对 N 个键的关注时，标准做法是先把一整行分数 S = Q·Kᵀ（N 个数）**写进 HBM 显存**，'
      + '再读回来做 softmax，再读一遍去和 V 相乘 —— 那条长度 N 的分数向量在慢速的 HBM 里来回搬好几趟。'
      + '序列越长，这条向量越长（长上下文里其实是 N×N 的分数矩阵），**瓶颈根本不在算力，而在访存**。'
      + '**FlashAttention** 的招数：把 K/V 切成小块，一块一块搬进极快的片上 SRAM 里算，用**在线 softmax** 维护三个滚动量 —— '
      + 'm（目前最大分数）、l（exp 之和）、O（加权和）。每来一个新块，先把旧的 l、O 按 exp(旧max − 新max) 缩放对齐到新的最大值，再加上本块贡献。'
      + '因为 softmax 对所有分数同减一个常数结果不变，这样**分块累加出来的结果，和一次性 softmax 分毫不差** —— '
      + '你改块大小，最终输出一个小数点都不变（本实验里相对误差 ~1e-9，就是浮点噪声）。'
      + '关键收益：那条完整的分数向量**从头到尾没写进 HBM**，省掉的正是它反复搬运的访存流量。'
      + '这和 CPU 用缓存分块（blocking）优化矩阵乘是**同一招** —— 让数据尽量待在快的那层存储里算完，别反复往慢的那层倒。它是现代推理引擎里最关键的算子级优化。',
    guess: {
      q: '把块大小从 2 改成 1 或 3，最终的注意力输出会怎样？',
      opts: ['分毫不变（分块只改怎么算，不改算什么）', '会略有不同（分块是近似）'],
    },
    tasks: [
      { act: '把块大小在 1 / 2 / 3 之间切', watch: '扫描步数变了，但末步的 O 一个小数点都不变 —— 相对误差始终 ~1e-9', param: '块大小' },
      { act: '盯住"当前输出 O/l"这一行', watch: '每扫一块，它就朝下面的真值挪近一步，扫完正好相等', param: '块大小' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; out?: number; naive?: number; err?: number }>(trace)
      if (!s || s.phase !== 'done' || s.out === undefined || s.naive === undefined) return null
      return {
        pick: 0,
        say: `分块在线 softmax 的结果 **${s.out.toFixed(4)}** 和一次性 softmax 的真值 **${s.naive.toFixed(4)}** 完全相等（相对误差 ${((s.err ?? 0) * 1e9).toFixed(1)}e-9，纯浮点噪声）。`,
        why: `在线 softmax 每来一块就把旧累加按 exp(Δm) 缩放对齐再加新贡献，数学上等价于一次性算。所以分块只改变"怎么算"（能塞进 SRAM、分数向量不落 HBM），不改变"算出什么"。省的是访存不是精度 —— 这正是它能大幅加速却不掉点的原因。`,
      }
    },
  },

  kvcache: {
    care:
      '自回归解码是"看着前面所有字，吐下一个字"。注意力算下一个 token 时，要用到**前面每个 token 的 K 向量和 V 向量**。'
      + '最朴素的做法是每生成一个字，就把整段前缀的 K/V **从头重算一遍** —— 第 j 步要算 j+1 次，'
      + '总量随长度**二次**增长（~L²/2），序列一长就慢到不可用。'
      + '**KV 缓存**的招数很简单：每个 token 的 K/V 只算一次就**存起来**，下一步直接读缓存，本步只算**新 token 那一个** —— '
      + '每步都是常数，总量降到 L 次（线性）。这就是为什么长文本生成不会越来越卡。'
      + '天下没有免费的午餐：缓存要占显存，大小**正比于序列长度**（每个 token 存一份 K 和 V，还要乘层数、维度、字节数，见「参数量与显存」）。'
      + '正因为这块显存在长上下文、高并发时会撑爆，才有了后面一整套省它的办法 —— GQA 让多个头共享 KV、PagedAttention 分页省碎片、KV 卸载把缓存挪到 CPU。**它是理解整个推理引擎内存问题的起点。**',
    guess: {
      q: '序列长度翻倍，无缓存的总计算量大约会怎样？',
      opts: ['涨到约 4 倍（二次增长）', '也翻倍（线性）'],
    },
    tasks: [
      { act: '把总长度从 5 拉到 8', watch: '无缓存累计按 ~L²/2 猛涨、有缓存只按 L 涨，省下的百分比一路走高', param: '总长度' },
      { act: '改提示词长度', watch: '预填充一次把提示词那段 K/V 算完；提示词越长，缓存起步就越大，之后每步照样只算 1 个', param: '提示词长度' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; cumCached?: number; cumNaive?: number; savedPct?: number; cacheSize?: number }>(trace)
      if (!s || s.phase !== 'done' || s.savedPct === undefined) return null
      return {
        pick: 0,
        say: `有缓存共算 **${s.cumCached}** 次 K/V、无缓存要 **${s.cumNaive}** 次，缓存省下 **${s.savedPct}%** 的计算。`,
        why: `有缓存每步只算 1 个新 token，总量是 L（线性）；无缓存每步重算整段前缀，总量 ~L²/2（二次）。所以序列越长，缓存省得越多 —— 代价是它要占 ${s.cacheSize} 对 K/V 的显存，这块正是后面 GQA / 分页 / 卸载要省的。`,
      }
    },
  },

  mha: {
    care:
      '注意力分成多个"头"并行，每个头看一种关系。**MHA / MQA / GQA** 这三种变体，差别只在**KV 头怎么共享**：'
      + '**MHA**（原版）每个 query 头配一个自己的 KV 头，表达力最强，但 KV 缓存也最大；'
      + '**MQA** 让所有 query 头共享唯一 1 个 KV 头，KV 缓存缩到最小，代价是可能掉点；'
      + '**GQA** 折中 —— query 头分成几组，每组共享一个 KV 头，用一点表达力换来 KV 缓存大减。'
      + 'KV 缓存大小**正比于 KV 头数**，所以 8 头的模型用 MHA 要存 8 份 KV、用 GQA(2组) 只存 2 份、用 MQA 只存 1 份。'
      + '正因为 KV 缓存是长上下文、高并发时的显存瓶颈（见「参数量与显存」），现在主流大模型（LLaMA2、Qwen 等）几乎都改用 GQA —— **它是把注意力和 KV 显存放一起权衡的产物**。',
    guess: {
      q: '从 MHA 换成 MQA，KV 缓存会怎样？',
      opts: ['大幅变小（KV 头从 h 个降到 1 个）', '基本不变'],
    },
    tasks: [
      { act: '在 MHA / MQA / GQA 之间切', watch: '同样 8 个 query 头，KV 头从 8→2→1，KV 缓存从 100% 降到十几 %', param: '变体' },
      { act: '看 GQA 分组数', watch: '组越多越接近 MHA（KV 大、表达力高），越少越接近 MQA（省显存）', param: 'GQA 分组' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ act?: string; variant?: string; heads?: number; kvHeads?: number; kvRatio?: number }>(trace)
      if (!s || s.act !== 'done' || s.kvRatio === undefined) return null
      return {
        pick: 0,
        say: `${s.variant} 下 ${s.heads} 个 query 头共用 **${s.kvHeads}** 个 KV 头，KV 缓存是 MHA 的 **${Math.round(s.kvRatio * 100)}%**。`,
        why: `KV 缓存正比于 KV 头数。MHA 有 h 个 KV 头，MQA 只有 1 个，GQA 介于中间。头共享得越狠，每个 token 要缓存的 KV 越少 —— 这就是为什么显存吃紧的大模型都往 GQA/MQA 走。`,
      }
    },
  },

  batching: {
    care:
      '推理引擎把多个请求凑成一个 **batch** 一起过 GPU（并行、省算力）。难点是请求**长短不一、到达时间也不同**：'
      + '**静态批处理**等凑满一批一起跑，全部等最慢的那个吐完才收，新请求只能干等 —— 空出来的槽白白浪费、GPU 空转多。'
      + '**连续批处理**每个 decode 步都动态调整 batch：有请求吐完就**立刻离场**，腾出的槽**马上**补进排队的请求，不等整批跑完。'
      + '于是 GPU 几乎不空转、利用率接近满，同样的卡能服务更多请求、吞吐更高。'
      + '它的本质就是把操作系统的**进程调度**搬到 GPU 上：槽位=CPU、请求=进程、decode 步=时间片 —— 学过进程调度，这一屏就是老朋友换了身衣服。',
    guess: {
      q: '请求长短不一时，连续批处理和静态批处理相比，GPU 利用率会怎样？',
      opts: ['更高（空槽随时补满）', '差不多'],
    },
    tasks: [
      { act: '在「连续」和「静态」之间切', watch: '静态每批等最慢的跑完、空槽闲置；连续吐完就补，利用率高得多、总步数更少', param: '批处理方式' },
      { act: '把槽数调大', watch: '能同时跑更多请求，但更吃显存 —— 槽数受 KV 缓存约束', param: 'batch 槽数' },
    ],
    verdict: ({ trace }) => {
      const runs = (trace as { act?: string; active?: string[]; done?: string[] }[]).filter(f => f.act === 'run')
      const last2 = last<{ act?: string; mode?: string; step?: number }>(trace)
      if (!runs.length || !last2 || last2.act !== 'done') return null
      const slots = (trace[0] as { slots?: number })?.slots ?? 2
      const avg = runs.reduce((a, f) => a + ((f.active?.length ?? 0) + (f.done?.length ?? 0)), 0) / runs.length
      const pct = Math.round((avg / slots) * 100)
      const cont = last2.mode === 'cont'
      return {
        pick: 0,
        say: `${cont ? '连续' : '静态'}批处理下，平均利用率 **${pct}%**（${avg.toFixed(1)} / ${slots} 槽），总共 **${last2.step}** 步。`,
        why: `静态批处理要等整批里最慢的请求跑完，中间吐完的请求腾出的槽只能空着；连续批处理把空槽随时补上，`
          + `所以利用率更高、总步数更少。请求越参差，这个差距越大 —— 这就是所有现代推理引擎都用连续批处理的原因。`,
      }
    },
  },

  bpe: {
    care:
      'BPE（字节对编码）是主流大模型的分词法。先把文本拆成最小单位（字符/字节），'
      + '再按训练好的 **merge 表**（一串"把哪两个符号合成一个"的规则，按学到的先后排序），'
      + '一步步把**高频相邻对**合并成一个 token。合并的过程和哈夫曼"两个并一个"很像。'
      + '关键在于 merge 表是在**以英文为主**的语料上统计出来的：英文常见词的组合都在表里，'
      + '能一路合并成一两个 token；而中文很多字的组合不在表里、甚至先被拆成 2-3 个 UTF-8 字节，**合并不动**，'
      + '于是同一句话中文的 token 数往往是英文的好几倍。大模型按 token 计费、上下文也按 token 算长度 ——'
      + '**这就是"中文更贵、也更占上下文"的技术原因**，不是玄学，是分词器合并不动。',
    guess: {
      q: '一段中文和意思相同的英文，哪个分出来的 token 通常更多？',
      opts: ['中文（合并不动，token 更多）', '英文'],
    },
    tasks: [
      { act: '看「英文 lowest」', watch: '6 个字符一路合并成 1 个 token —— 英文常见词在 merge 表里，压得很短', param: '例子' },
      { act: '换成「中文 你好」', watch: 'merge 表里没有它们的组合，合并不动，每个字各算一个 token', param: '例子' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ act?: string; toks?: string[]; start?: number }>(trace)
      if (!s || s.act !== 'done' || !s.toks || s.start === undefined) return null
      const merged = s.toks.length < s.start
      return {
        pick: 0,
        say: merged
          ? `这个例子从 ${s.start} 个符号压到 **${s.toks.length}** 个 token —— 合并很充分，说明它的组合都在 merge 表里（典型是英文）。`
          : `这个例子 ${s.start} 个符号一个也没合并、还是 **${s.toks.length}** 个 token —— 合并不动，正是中文常遇到的情况。`,
        why: `merge 表主要在英文语料上学。英文常见组合优先进表、能一路合并；中文的组合大多不在表里，`
          + `合并不动、token 就多。同样意思，中文 token 数往往是英文几倍 —— 按 token 计费当然更贵。`,
      }
    },
  },

  sampling: {
    care:
      '大模型吐字前，softmax 出的分布往往有一条**长尾** —— 一堆低概率 token 加起来也不少，直接采容易蹦出离谱的词。'
      + '于是先用两把"截断刀"把候选缩小，只在剩下的里随机采：'
      + '**top-k**：只留概率最高的 k 个，按**个数**截断，简单但固定；'
      + '**top-p（核采样）**：把概率从大到小累加，留累计刚超过 p 的一小撮（"核"），按**累计概率**截断 —— '
      + '分布尖时只留一两个（不采长尾）、分布平时自动多留几个（保多样性），比 top-k 更自适应。'
      + '砍完**重新归一化**（除以留下的概率之和）再采样。它俩常和**温度**配合：温度定分布多平、top-k/top-p 定砍多狠。'
      + '三个旋钮一起决定下一个字"多稳 / 多野"：要严谨就低温 + 小 p，要有创意就高温 + 大 p。',
    guess: {
      q: '同一个分布，top-p=0.9 和 top-k=2 相比，谁更可能随分布自动多留或少留候选？',
      opts: ['top-p（按累计概率自适应）', 'top-k（固定留 k 个）'],
    },
    tasks: [
      { act: '把 top-p 从 1 调到 0.5', watch: '只留累计到 50% 的那一两个 —— 越保守越稳', param: 'top-p' },
      { act: '换「两强争锋」再比 top-k=1 和 top-p=0.9', watch: '两个概率接近时，top-k=1 只留一个、top-p 自动两个都留 —— 这时 top-p 更合理', param: 'logits 组' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; kept?: boolean[]; tokens?: string[]; k?: number; p?: number }>(trace)
      if (!s || (s.phase !== 'done' && s.phase !== 'renorm') || !s.kept || !s.tokens) return null
      const keptN = s.kept.filter(Boolean).length
      return {
        pick: 0,
        say: `这组设置（top-k=${s.k && s.k > 0 ? s.k : '关'}、top-p=${s.p && s.p < 1 ? s.p : '关'}）最后从 **${keptN} / ${s.tokens.length}** 个候选里采样。`,
        why: `top-k 按个数固定截断，top-p 按累计概率自适应：分布尖时核很小、分布平时核变大。`
          + `所以谁"自动多留或少留"是 top-p —— 它跟着分布形状走；top-k 永远恰好留 k 个。`,
      }
    },
  },

  llmsize: {
    care:
      '"7B 为什么要十几 G 显存"这个问题，拆开算一遍就再也不会忘。**参数量**按标准 Transformer 结构现算：'
      + 'embedding = vocab×d；每层注意力 = 4d²（Q/K/V/O 四个投影）；每层 FFN = 2·ffn·d²（升维+降维，通常是大头）；'
      + '总数 = embedding + 层数×两者之和（GPT-2 small 这么一算恰好 124M）。'
      + '**权重显存** = 总参数 × 每参数字节：fp16 每参数 2 字节，所以 7B×2 ≈ 14G；fp32 翻倍、int8 减半 —— 量化省的就是这块。'
      + '还有**第二块显存 KV 缓存** = 2·层·序列·d·字节，它是每序列的额外开销，随序列长度和并发数线性涨。'
      + '一句话：**权重是固定开销，KV 随上下文和并发涨** —— 这就是推理显存的两大块，也是为什么长上下文、高并发这么烧显存。',
    guess: {
      q: '把精度从 fp16 换成 int8，同一个模型的权重显存会怎样？',
      opts: ['减半（省一半显存）', '基本不变'],
    },
    tasks: [
      { act: '把精度从 fp16 切到 int8', watch: '权重显存直接减半 —— 量化省显存的原理', param: '精度' },
      { act: '把序列长度从 512 拉到 8192', watch: '权重一点没变，但 KV 缓存翻十几倍 —— 长上下文贵在 KV', param: '序列长度' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; total?: number; weightBytes?: number; bytes?: number; dtype?: string }>(trace)
      if (!s || (s.phase !== 'done' && s.phase !== 'weight' && s.phase !== 'kv') || !s.weightBytes) return null
      const gb = (s.weightBytes / 1e9).toFixed(1)
      const low = (s.bytes ?? 2) <= 1
      return {
        pick: 0,
        say: `当前 ${s.dtype}（每参数 ${s.bytes} 字节）下，${((s.total ?? 0) / 1e9).toFixed(2)}B 参数占 **${gb} GB**。` +
          (low ? '已经是 int8，比 fp16 省了一半。' : '换成 int8 会再减半。'),
        why: `权重显存 = 参数量 × 每参数字节。字节数只跟精度有关：fp32=4、fp16=2、int8=1。`
          + `所以从 fp16 换 int8，字节数从 2 到 1，显存正好减半 —— 参数量一个没少，只是每个存得更省。量化推理就是靠这个把大模型塞进小显存。`,
      }
    },
  },

  attention: {
    care:
      '自注意力是 Transformer 的心脏，一句话：**每个词都根据全句重新理解自己**。每个 token 投影出三个向量 ——'
      + '**Q**（query，我要找什么）、**K**（key，我能被谁找到）、**V**（value，我携带的信息）。'
      + '一个查询 token 更新自己时分三步：① **分数** = 它的 Q 和每个 token 的 K 做点积、再除以 √d'
      + '（点积衡量相关性，除 √d 防 softmax 饱和）；② **权重** = 对分数做 softmax，得到一个和为 1 的"注意力分配"；'
      + '③ **输出** = 按权重把所有 token 的 V 加权求和。注意力矩阵的一行，就是一个词对全句的关注分配。'
      + '正因为每个词都能直接"看"到任意远的词并按相关性汇总，Transformer 才能捕捉长距离依赖 —— 这是它取代 RNN 的根本原因。',
    guess: {
      q: '一个查询 token 算出注意力权重后，它的新表示主要由谁决定？',
      opts: ['它最关注的那个 token 的 V', '永远是它自己的 V'],
    },
    tasks: [
      { act: '逐步走完一个查询', watch: '和每个 K 点积得分数 → softmax 成权重 → 按权重把各 V 加起来，一次注意力就完成了' },
      { act: '换成「猫追老鼠」例句', watch: 'Q/K/V 变了，整张注意力矩阵完全不同 —— 关注谁由向量相似度决定', param: '例句' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; tokens?: string[]; attn?: number[][] }>(trace)
      if (!s || !s.attn || !s.tokens) return null
      //  找任意一个算完的查询，看它最关注谁、是不是自己
      const done = s.attn.map((r, i) => ({ r, i })).filter(x => x.r.length > 0)
      if (!done.length) return null
      const { r, i } = done[done.length - 1]
      const topj = r.indexOf(Math.max(...r))
      const self = topj === i
      return {
        pick: 0,
        say: `「${s.tokens[i]}」最关注「**${s.tokens[topj]}**」（${(r[topj] * 100).toFixed(0)}%）` +
          (self ? ' —— 恰好是它自己。' : ' —— 是别的 token，它的新表示主要来自那个词的信息。'),
        why: `输出 = Σ 权重 × V。权重最大的那个 token，它的 V 在加权和里占比最大，所以新表示主要由"最关注的对象"决定。`
          + `${self ? '这次碰巧关注自己，但换个例句/向量就会指向别处 —— ' : ''}这正是注意力的意义：让每个词吸收它最相关的上下文。`,
      }
    },
  },

  chunkprefill: {
    care:
      '推理分两段：**prefill**（把整段输入 prompt 过一遍、算出每个 token 的 KV，算得多、耗时长）和 **decode**（之后逐字吐，每步很短）。'
      + '问题来了：如果一个用户发来**超长 prompt**，它的 prefill 一整块跑起来要很久，而这段时间里，**正在解码的其它用户只能干等** —— 他们的下一个字迟迟出不来，首字延迟被拉爆。'
      + '**chunked prefill** 的办法：把这个长 prefill **切成小块**，块与块之间**插进其它请求的 decode 步**。'
      + '本实验里 A 的 prefill 长 8、B 要 decode：整块跑时 B 要等到 t=9 才吐第一个字；切成大小 2 的块后，时间线变成"prefill块-decode-prefill块-decode…"，B 在 **t=3** 就吐出首字，而**总时间还是 12，一点没多**。'
      + '本质是把大颗粒的"整块 prefill"拆成细颗粒、和 decode **交错调度** —— 和操作系统让多个进程轮流上处理器、避免一个长任务饿死别人，是同一个思想。它坐在你学过的**进程调度**上。'
      + '块越小、别人等得越短（延迟越公平），但切太碎也有额外调度开销，所以块大小是个权衡。真实系统还常配合 PD 分离（prefill 和 decode 分到不同资源）。这是把"长请求不拖垮短请求"落地的关键调度手段。',
    guess: {
      q: '把长 prefill 切成小块、和别的 decode 交错，总时间会怎样？',
      opts: ['几乎不变，但别人的首字延迟大降', '总时间会变长'],
    },
    tasks: [
      { act: '把块大小从 8 减到 2', watch: 'B 的首字延迟从 9 降到 3；总时间始终是 12 —— 切得越碎别人等得越短', param: 'prefill 块大小' },
      { act: '看甘特图的颜色怎么排', watch: '块大小 8 是一整条蓝挡在最前面；块小了就蓝绿相间，B 的绿块早早插进来', param: 'prefill 块大小' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; chunk?: number; firstDecodeAt?: number; prefillLen?: number; totalTime?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `块大小 ${s.chunk} 时，B 的首字在 t=**${s.firstDecodeAt}** 吐出（整块跑要等到 t=${(s.prefillLen ?? 8) + 1}），而总时间还是 **${s.totalTime}**，没多花。`,
        why: `长 prefill 切块后和 decode 交错，等待的请求能很快插进来拿到下一个字，首字延迟大降；因为只是把同样的活重新排了个序，总时间几乎不变。这是进程调度"别让长任务饿死短任务"在推理里的应用。`,
      }
    },
  },

  knn: {
    care:
      '前面的算法都要"训练"出一组参数。k-NN 偏不——它是最"懒"的分类器,**根本不训练**。要判一个新点属于哪类,它就现场找离这个点**最近的 k 个已知点**,让这几个邻居**投票**,票最多的类别就是答案。全部力气都花在"预测时按距离找最近邻"上。'
      + '它极其直观,还点破了一个朴素而深刻的道理:很多"智能"其实就是**按相似度检索 + 多数表决**——这和注意力、联想记忆是一脉的(离得近的邻居,权重就大)。'
      + '参数 **k** 是 k-NN 的灵魂。k 小(比如 1),模型很敏感,容易被个别噪声点带偏、决策边界毛糙;k 大,模型更平滑更稳,但可能糊掉细节。最有意思的是**边界附近**的点:本实验那个待判点,k=1 判 A、k=3 翻成 B、k=7 又翻回 A——同一个点,判断随 k 来回摇摆。这正是"偏差-方差权衡"最直观的一幕。'
      + '本实验:两类各 8 个点(蓝 A、红 B),一个落在两类交界处的待判点(◆)。逐个揭示最近邻、累计投票,你能亲眼看着票数变化、判断翻转。看懂这条,你就理解了"基于实例"的学习、距离度量的重要性,以及 k 这个超参数为什么要小心调。它坐在"内积/距离=相似度"之上。',
    guess: {
      q: '边界附近的待判点，把 k 从 1 调到 7，它的类别判断会？',
      opts: ['可能来回翻(k 小敏感、k 大平滑)', '一直不变(邻居就在那)'],
    },
    tasks: [
      { act: '按「下一步」逐个找最近邻', watch: '覆盖圈变大、票数累加,够 k 个就定类' },
      { act: '把 k 从 1 调到 7', watch: '同一个点判断 A→B→A 翻转' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; k?: number; voteA?: number; voteB?: number; predict?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `k=${s.k}:最近 ${s.k} 个邻居投票 A ${s.voteA} : B ${s.voteB} → 判 **${s.predict === 0 ? 'A' : 'B'}**。边界附近判断随 k 翻。`,
        why: `k-NN 不训练,靠"按距离找最近邻 + 多数表决"当场分类。k 小敏感(边界毛糙)、k 大平滑(更稳但糊细节)——偏差-方差权衡的直观版,和注意力"近的权重大"一脉。`,
      }
    },
  },
  kmeans: {
    care:
      '前面的线性回归是**有监督**(每个点都带着正确答案 y)。可现实里常常一堆数据**没有标签**,你只想知道"它们大致能分成几群"——这就是**无监督聚类**,k-means 是它最经典的算法。'
      + '它的思路简单得像绕口令,却出奇有效,就两步反复跳:①**分配**——每个点归给离它最近的那个"重心";②**更新**——每个重心移动到"分给它的那些点"的平均位置。分配完点就有了颜色(堆),更新完重心就往堆中心挪了一点;再分配、再更新……重心一步步 march 到各堆的正中央,点的归属也稳定下来。'
      + '衡量好坏用**簇内平方和 inertia**(每个点到自己重心的距离平方和),它每一轮都单调下降,几步就收敛。本实验 18 个点(其实来自 3 个簇)、k=3,重心故意放歪。你会看到重心从乱位置一路挪到三堆中心、inertia 从 54 降到 4、几步稳定。'
      + '看懂这条,你就理解了"没有老师、靠数据自己找结构"是怎么回事——向量量化、图像分割、用户分群背后都是它。也别忘了它的两个软肋:结果依赖初始重心的位置、簇数 k 得你自己定。',
    guess: {
      q: 'k-means 反复做"分配→更新重心"，簇内平方和(inertia)会怎样？',
      opts: ['单调下降，几步收敛', '上下波动，不一定收敛'],
    },
    tasks: [
      { act: '一步步走「分配→移动」', watch: '点按最近 ✕ 染色 → ✕ 跳到自己那堆中心' },
      { act: '盯 inertia', watch: '每步降(54→4)，重心不再动=收敛' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; inertia?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `重心 march 到三堆中心、簇内平方和从 54 降到 **${s.inertia}**、归属稳定——全程没用任何标签。`,
        why: `"分给最近重心 → 重心移到均值"两步交替,inertia 单调降、几步收敛,让结构自己浮现。这就是无监督聚类,向量量化/图像分割/用户分群都用它。软肋:依赖初始化、k 需人定。`,
      }
    },
  },
  pca: {
    care:
      '真实的高维数据有个特点:很多维是**相关**的、彼此重复,真正"有用"的方向没那么多。**PCA(主成分分析)**就是把这些主方向找出来,好把数据从高维压到低维,还尽量不丢信息。'
      + '它的做法:找数据**方差最大的那个方向**,叫第一主成分 PC1——沿这个方向点铺得最开、承载的差异最多;再找与 PC1 正交、方差次大的 PC2……然后把所有点**投影**到前几个主成分上,用更少的坐标近似原来的高维坐标。'
      + '数学上很干净:主成分就是**协方差矩阵的特征向量**,对应的**特征值**就是那个方向上的方差——特征值越大,说明这个方向越"重要"、越该保留。'
      + '本实验:14 个明显沿对角线拉长的 2D 点(两个坐标高度相关)。你会看到 PCA 算出主轴 PC1(约 33°方向,方差最大),把每个点垂直投影到这条轴上——原来需要两个坐标 (x,y) 描述的点,现在只用"在这条轴上的位置"**一个数**就近似表示了,而且保留了 **96%** 的方差,2D 压到 1D 只丢 4%。'
      + '看懂这条,你就理解了降维的核心:去掉冗余、抓住主轴。它是高维数据可视化(压到 2D 画出来)、数据压缩、去噪的基础,也和「低秩·LoRA」是一家人——都是"信息集中在少数主方向上,抓大放小"。',
    guess: {
      q: '一团沿对角线拉长的点，PCA 的第一主成分(PC1)会指向？',
      opts: ['点铺得最开(方差最大)的对角线方向', '垂直于点云拉伸的方向'],
    },
    tasks: [
      { act: '走 点云→主轴→投影', watch: '找到 33°主轴(方差最大),把点垂直投影到轴上' },
      { act: '看保留方差', watch: 'PC1 一条轴就保住 96%,2D→1D 几乎不丢' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; var1?: number; angle?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `PC1(约 ${s.angle}°、方差最大方向)保留 **${s.var1}%** 方差——2D 压到 1D 只丢 ${(100 - s.var1!).toFixed(1)}%。`,
        why: `PCA 找方差最大的主轴(=协方差最大特征向量)、投影降维,去冗余抓主轴。特征值=该方向方差、越大越该留。它是高维可视化/压缩/去噪的底,和 LoRA/低秩抓主方向一家。`,
      }
    },
  },
  svm: {
    care:
      '两类线性可分的时候,能把它们分开的直线有**无数条**。逻辑回归随便找一条能分开的就收工,SVM 却多问一句:这么多条,哪一条最好?'
      + 'SVM 的答案是**最大间隔**。想象两类点之间有一条尽量宽的"街道",街道正中间那条线就是决策边界,SVM 要让这条**街道最宽**。道理很直白:边界离两边都最远,新来的点稍微偏一点也不容易越界,所以**泛化最好、最稳**。'
      + '更妙的是:这条最宽的街,只由**紧贴街道两边的那几个点**决定——它们叫**支持向量**;其余的点,不管有多少、离得多远,都**不影响**边界的位置。这意味着 SVM"只记得"边界附近的少数关键点,模型异常精简。'
      + '本实验:两类各 5 个点。你会先看到一条随便分开的线(贴着左边这类、间隔只有 0.5),再看到 SVM 的最大间隔线(居中、间隔 1、街道最宽),4 个支持向量被圈出来。'
      + '看懂这条,你就理解了 SVM 为什么在小样本、高维数据上一度是王者:它把"分得开"升级成了"分得最稳"。而当数据线性不可分时,SVM 还有另一半威力——用**核函数**把点偷偷映到高维空间,在那儿再找最大间隔(本实验先看线性这一半)。它靠内积几何工作,和"内积=相似度"一脉。',
    guess: {
      q: 'SVM 从无数条能分开的线里，挑哪一条？',
      opts: ['离两边都最远的那条(最大间隔)，最稳', '离得越近越好，贴着数据'],
    },
    tasks: [
      { act: '走 随便一条 → SVM 两步', watch: '随便那条贴着一类(间隔 0.5);SVM 居中、街最宽(间隔 1)' },
      { act: '看支持向量', watch: '最宽的街只由 4 个点定住,其余不影响' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; margin?: number; supportVectors?: number[] }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `SVM 最大间隔 **${s.margin}** > 随便那条 0.5,只由 **${s.supportVectors!.length}** 个支持向量定边界——泛化最稳。`,
        why: `SVM 挑离两边都最远的最大间隔边界,容错最大、泛化最好;而且只记得紧贴街边的支持向量,其余点不影响。线性不可分时用核函数映到高维再找最大间隔。`,
      }
    },
  },
  gbdt: {
    care:
      '单棵决策树又容易过拟合、又拟合不了平滑的东西。**梯度提升树(GBDT)**换了个聪明玩法:不追求一棵完美的树,而让**一串小树接力**,每棵只干一件小事——**补上前面所有树合起来还没拟合掉的那点误差**。'
      + '具体做:先用一个常数(所有 y 的均值)当初始预测,显然很粗。然后每一轮,算出当前的**残差**(真值 − 当前预测),再训一棵小树专门去拟合这个残差,把它乘上学习率加进预测里。残差一轮轮变小,预测一轮轮变准。因为每棵树拟合的都是"残差"(其实就是损失的负梯度),所以叫**梯度提升**。'
      + '本实验:20 个 1D 点,呈阶梯状加噪声。你会看到预测从一条平线开始,每加一棵只切一刀的"树桩",预测的阶梯就多长出一段、更贴近数据,MSE 从 0.75 一路降到 0.08、0.03。'
      + '看懂这条,你就理解了集成学习最厉害的一招:**把一堆各自很弱的学习器串起来,能拼成一个非常强的模型**。GBDT 走的是"接力补错"的 boosting 路线,和随机森林"很多棵树并行投票"的 bagging 路线并称集成两大法门。它的现代实现 XGBoost、LightGBM,至今是表格/结构化数据竞赛和工业界的主力。它坐在决策树之上,把很多棵串起来;而"拟合残差=拟合负梯度",又和梯度下降一脉。',
    guess: {
      q: 'GBDT 每加一棵新树，这棵树去拟合什么？',
      opts: ['当前的残差(前面还没拟合掉的误差)', '重新拟合原始数据'],
    },
    tasks: [
      { act: '一轮一轮加树', watch: '预测阶梯从平线长出、越来越贴数据、残差变短' },
      { act: '盯 MSE', watch: '每轮都降(0.75→0.03)' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; round?: number; mse?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `boosting ${s.round} 轮:MSE 从 0.75 降到 **${s.mse}**,预测阶梯贴上数据——每棵小树只补前面没拟合掉的残差。`,
        why: `弱学习器接力=强学习器:每轮拟合残差(=负梯度)、乘学习率加进预测,故名梯度提升。和随机森林(并行投票)并称集成两大路线,XGBoost/LightGBM 是表格数据主力。`,
      }
    },
  },
  dtree: {
    care:
      '逻辑回归、SVM 都在找一条(超)平面来分类。决策树走另一条路,更像人做判断:**连续问是非题**。每个节点问一个"某特征 ≷ 某阈值?"(比如 x<0?),把数据一分为二;顺着答案往下走,直到落进一个**纯净**的叶子——里面几乎全是同一类。'
      + '关键是怎么选每一刀。看哪一刀切完子集**最纯**:用**基尼不纯度**(Gini,越接近 0 越纯)衡量,挑让不纯度下降最多(**信息增益**最大)的那一刀。然后对还不纯的子集**递归**地继续切,直到每块都纯。'
      + '本实验:16 个点分布在四象限,只有右上角是第 1 类。你会看到它先竖着切一刀 **x=0**(左半 8 个全是第 0 类,纯了、成叶子),再在右半横着切一刀 **y=0**(右上第 1 类、右下第 0 类),三刀两下,整个平面被切成三块纯净区域。'
      + '看懂这条,你就理解了决策树两个突出的好处:**天生可解释**(从根到叶的每条路径,就是一串 if-else 规则,能直接读)、用**多刀轴对齐**就能拼出弯弯曲曲的非线性边界。它也是**随机森林、GBDT** 这些最能打的模型的基本积木——把很多棵树组合起来,就是集成学习。它靠贪心选刀,和树结构、贪心算法一脉。',
    guess: {
      q: '决策树每次该在哪里"切一刀"？',
      opts: ['挑让子集最纯(基尼下降最多)的那一刀', '随便切，切够多次就行'],
    },
    tasks: [
      { act: '一刀一刀切', watch: '竖切 x=0(左纯)、横切右半 y=0——每块变纯、Gini→0' },
      { act: '看信息增益', watch: '挑的都是让子集最纯的那刀' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; leaves?: unknown[] }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `三刀两下切出 **${s.leaves!.length}** 个纯叶子:左=第0类、右上=第1类、右下=第0类,每条路径=一串 if-else。`,
        why: `每刀挑让子集最纯(基尼下降最多=信息增益最大)的那一刀,递归切到纯。天生可解释、能用多刀轴对齐拼非线性边界,是随机森林/GBDT 的积木。`,
      }
    },
  },
  logreg: {
    care:
      '线性回归输出一个连续值(比如房价)。可很多任务是**分类**:是/否、猫/狗。逻辑回归只在线性回归上加两处改造,就把它变成了最基础的分类器。'
      + '第一处:先像线性回归一样算一个线性打分 z=w₁x+w₂y+b,再用 **sigmoid** 函数把 z 压进 (0,1),当作"属于第 1 类的概率"。第二处:损失从均方误差换成**交叉熵**(对数损失)——预测概率离真实标签越远,惩罚越狠(这正是「交叉熵·困惑度」那条)。'
      + '剩下的和线性回归一模一样:梯度下降调 w、b 让损失最小。几何上,它在学一条**决策边界**(z=0 那条线):边界一侧概率>0.5 判第 1 类、另一侧判第 0 类。学习的过程,就是把这条边界转到能把两类分开的位置。'
      + '本实验:两类各 9 个点(大致线性可分)。你会看到决策边界从无到有、转到两类中间,交叉熵从 0.69 降到 0.03、准确率从蒙一半到 100%,两侧还按 sigmoid 概率渐变染色。'
      + '看懂这条,你就发现一个大秘密:逻辑回归其实**就是一个神经元 + sigmoid**——理解它,你就摸到了神经网络最小的那块砖。它和线性回归共用"定损失→求梯度→沿负梯度更新"的骨架,只是把"拟合连续值"换成了"分两类"。',
    guess: {
      q: '逻辑回归靠什么把线性打分变成"属于某类的概率"？',
      opts: ['sigmoid 把打分压到 (0,1)，交叉熵当损失', '四舍五入取整'],
    },
    tasks: [
      { act: '按「下一步」推进', watch: '决策边界转到两类中间;准确率 50%→100%、交叉熵降' },
      { act: '对比线性回归', watch: '同一套骨架,MSE 换交叉熵、直线换 sigmoid 概率' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; loss?: number; acc?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `梯度下降后交叉熵 **${s.loss}**、准确率 **${(s.acc! * 100).toFixed(0)}%**,决策边界把两类干净分开。`,
        why: `逻辑回归=线性打分→sigmoid 出概率→交叉熵当损失→梯度下降调 w、b。它就是单个神经元+sigmoid,神经网络最小的砖。和线性回归同骨架,只是拟合连续值换成分两类。`,
      }
    },
  },
  backprop: {
    care:
      '梯度下降要用梯度,可一个神经网络有上亿个权重——怎么高效地把"损失对每一个权重的梯度"都算出来?答案是**反向传播**,它是训练神经网络的发动机。'
      + '它分两趟。**前向**:数据从输入一层层流到输出,算出损失 L(模型错得多重)。**反向**:从 L 出发,用**链式法则**把"L 对每个中间量的偏导"一站接一站地往回算,最后落到每个权重上,得到它的梯度。'
      + '核心就一句话:**下游的梯度 × 本站的局部导数 = 上游的梯度**。每一站(乘法、加法、sigmoid……)只需要知道自己那一点点局部导数——sigmoid 这站是 a(1−a)、乘法这站是"另一个乘数"——把它和从下游传来的梯度一乘,就得到往上游传的梯度。这样一路链下去,梯度就从损失被送回了最前面的权重。'
      + '本实验:一个神经元 x=1、w=0.8、b=0.2 → z=wx+b → a=σ(z) → L=(a−t)²(t=1)。你会看到前向算出 L=0.072;然后梯度从 L 往回传:dL/da=2(a−t)=−0.54,过 sigmoid 乘上 a(1−a),得 dL/dz=−0.11,再到 dL/dw、dL/db。每个数都能手算核对。'
      + '看懂这条,你就理解了深度学习最关键的算法:**一次反向传播,就把网络里所有权重的梯度全算出来了**,代价只和参数量成正比,极其高效——这正是我们能训练上亿、上千亿参数模型的底层原因。它把梯度下降真正落到了大网络上,和「残差=梯度高速路」(让梯度传得回去)是同一条主线。',
    guess: {
      q: '反向传播靠什么把梯度从损失一路传回每个权重？',
      opts: ['链式法则:下游梯度 × 本站局部导数 = 上游梯度', '对每个权重单独重算一遍整个网络'],
    },
    tasks: [
      { act: '一步步走', watch: '前向算到 L;再从 L 往回,dL/da→过 sigmoid→dL/dz→dL/dw、dL/db' },
      { act: '盯每站', watch: '下游梯度 × 本站局部导数 = 上游梯度' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; gLdw?: number | null; gLdb?: number | null }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `反向传播一趟,把每个权重的梯度都算出来:dL/dw=**${s.gLdw}**、dL/db=**${s.gLdb}**,交给梯度下降更新。`,
        why: `链式法则:下游梯度×本站局部导数=上游梯度,从损失一站站回传到每个权重。一趟出全部梯度、和参数量成正比——这是深度学习能训上亿参数的发动机。`,
      }
    },
  },
  binsearch: {
    care:
      '在一堆数里找一个数,最笨的办法是从头扫到尾,平均要看一半、最坏看完全部(n 次)。但只要数组是**排好序**的,就有一招快得多的:**二分查找**。'
      + '它每次都看**正中间**那个数。如果正好等于目标,找到了;如果目标比它**大**,那目标只可能在**右半**(左半连中点都比目标小,全排除);比它**小**就只可能在**左半**。一次比较,就**砍掉了一半**候选。'
      + '于是搜索区间 [lo,hi] 反复对折:n → n/2 → n/4 → …,每步减半。所以它只需要 **log₂n** 次比较——13 个数 4 次、一百万个数也才 20 步、十亿个数 30 步。这就是"有序结构 + 每次排除一半"的惊人效率。'
      + '本实验:13 个有序数,找 63。你会看到灰掉的格子(已排除的候选)越来越多、区间越缩越小,mid 指针跳几下就命中。'
      + '看懂这条,你就理解了两件事:一是**排序的价值**——先花力气排好序,后续无数次查询都能享受 log 级的快;二是这套"对折排除"的思想无处不在,数据库的 B+树索引、用二分定位是哪次提交引入了 bug(git bisect)、甚至猜数字游戏,底子都是它。它要求数组有序,所以常和排序配套。',
    guess: {
      q: '有序数组里二分查找，13 个数最多要比较几次？',
      opts: ['约 4 次(log₂13)', '约 13 次(得挨个看)'],
    },
    tasks: [
      { act: '按「下一步」二分', watch: '每步看中点、砍掉一半灰掉,区间越缩越小' },
      { act: '数比较次数', watch: '13 个数只要 4 次——log₂n' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; compares?: number; found?: number; target?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `只用 **${s.compares}** 次比较就在 13 个数里定位了 ${s.target}(下标 ${s.found})——每次砍掉一半。`,
        why: `有序 + 每次看中点排除一半 = log₂n:百万个数也才 ~20 步,远快于挨个扫的 n 次。B+树索引、git bisect、猜数游戏都是它。代价是要求数组有序。`,
      }
    },
  },
  nqueens: {
    care:
      '有些问题没有公式直接算,只能**一个个试**:把 N 个皇后摆上 N×N 棋盘,要求任意两个都不能同行、同列、同对角线(互相攻击)。硬枚举所有摆法会爆炸,而**回溯**给了一套系统化试错的骨架。'
      + '思路是把问题拆成一连串**选择**:一行放一个皇后。在当前行从左到右找一个**不被已放皇后攻击**的列——找到就落子,进入下一行继续;如果**整行都没有安全位**(走进死胡同),就**回溯**:撤掉上一行的那枚皇后,把它挪到下一个安全列,重新往下试。'
      + '这就像走迷宫:遇到死胡同不慌,原路退回上一个岔口换一条走。它本质是**深度优先地穷举一棵"选择树"**,但每走一步都检查约束、**提前剪掉**不可能的分支(被攻击的列直接跳过),所以远不用真的枚举全部 4⁴=256 种摆法。'
      + '本实验:4×4 棋盘找第一个解。你会看到皇后一个个落下(绿),撞到死胡同又被撤回(红),换个位置再试,几番进退后拼出无冲突的布局 [1,3,0,2]。每一步的 safe 判定、回溯时机都可对着棋盘核对。'
      + '看懂这条,你就握住了一大类问题的通用解法:数独、全排列/组合枚举、正则表达式匹配、编译器的类型求解、图着色——凡是"做一串选择、走不通就退一步换一个"的,骨架都是回溯。它和贪心正相反:贪心一条道走到黑不回头,回溯则允许悔棋、系统地把选择空间走遍。',
    guess: {
      q: '回溯放皇后时，某一行所有列都被攻击了，怎么办？',
      opts: ['退回上一行、把那枚皇后挪到下一列重试(回溯)', '就放在被攻击的位置、继续往下'],
    },
    tasks: [
      { act: '按「下一步」逐行落子', watch: '安全列绿格落子;整行没位就红格撤回、回上一行' },
      { act: '盯皇后进出', watch: '一落一撤、换位再来——回溯 4 次后拼出 [1,3,0,2]' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; act?: string; cols?: number[]; backtracks?: number }>(trace)
      if (!s || (s.phase !== 'done' && s.act !== 'solved')) return null
      return {
        pick: 0,
        say: `一路"试→撞死胡同→撤回→换一个",回溯 **${s.backtracks}** 次后拼出无冲突布局 [${(s.cols ?? []).join(',')}]。`,
        why: `回溯=深度优先穷举选择树 + 约束剪枝:被攻击的列直接跳过,不用真枚举全部 256 种。数独、排列组合、正则匹配、图着色,骨架都是它。它和贪心相反——允许悔棋、系统走遍选择空间。`,
      }
    },
  },
  unionfind: {
    care:
      '想象一张社交网:人一个个建立好友关系,你随时要问"这两个人现在属不属于同一个圈子"。或者一张地图:道路一条条修通,要问"这两座城通不通"。**并查集**(Union-Find)就是干这个的——维护一堆元素的**分组**,支持两件事:把两组**合并**、查某两个元素**是不是一组**。'
      + '它的巧思是用**树**表示每个组:组里每个元素记一个**父指针**,顺着往上走到**根**,根就是这个组的"代表"。于是——**find(x)** 就是顺父指针爬到根;判断 a、b 是不是一伙,只要看 find(a) 和 find(b) 是不是**同一个根**;**union(a,b)** 就是找到两人的根,把一个根挂到另一个根下面,两棵树合成一棵。简单得惊人。'
      + '但朴素合并有个坑:如果每次都把新点串在链尾,树会退化成一条**长链**(a←b←c←d←…),find 得从头爬到尾,慢。**路径压缩**是点睛之笔:每次 find 爬到根之后,顺手把**沿途每个节点都直接改指向根**——这条链一下被拍平,下次再问几乎一步到根。配合"按秩合并"(总把矮树挂到高树下),整体效率**均摊近乎常数** O(α(n)),α 是增长极慢的反阿克曼函数,现实中不超过 4。'
      + '本实验:7 个点。你会先看 6 次 union 把它们并成一个集团(其中故意长出一条 0←1←2←3 的链),再看 **find(0)**:它顺着链一格格爬到根 6,然后**路径压缩**把 0、1、2、3 全部直接挂到 6 下面——最深的链从 4 一下塌到 1。每步的连通分量数、每个点的深度都可以对着格子数。'
      + '看懂这条,你就握住了一个又小又快的"连通性"零件:Kruskal 求最小生成树时用它判断"这条边会不会成环"、判断网络/电路是否连通、把同一个人的多个账号合并、图像里找连通区域、编译器的等价类合并——处处都是它。它和图的 DFS/BFS 互补:后者能给出具体路径,前者只回答"通不通"但快得多。',
    guess: {
      q: '并查集判断两个元素是不是一组，靠什么？',
      opts: ['各自顺父指针爬到根，看根同不同', '直接比较两个元素的编号大小'],
    },
    tasks: [
      { act: '按「下一步」做 union', watch: '两棵树并成一棵,连通分量从 7 一路减到 1' },
      { act: '看 find(0)+压缩', watch: '顺链爬到根 6,再把沿途点直挂根下,最深链 4→1' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; comps?: number; depths?: number[] }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `6 次 union 把 7 个散点并成 **${s.comps}** 个集团;find 认祖归宗只看根,路径压缩把最深链拍到 ${Math.max(...(s.depths ?? [1]))}。`,
        why: `"是不是一伙"='根同不同'。用树+父指针表示分组,union 挂根、find 爬根,配路径压缩+按秩合并均摊近乎 O(1)。Kruskal 最小生成树、网络连通、账号合并、图像连通域,核心零件都是它。`,
      }
    },
  },
  heap: {
    care:
      '很多场景要反复问同一个问题:"现在优先级最高(或值最大/最小)的是谁?"——任务调度里挑最紧急的任务、Dijkstra 里挑当前最近的点、从海量数据里找 Top-K。用普通数组每次扫一遍是 O(n),太慢。**堆**(优先队列)专治这个:取最值快到 **O(1) 看、O(log n) 拿走**。'
      + '它的秘密是一棵**完全二叉树**加一条**堆序**规则:每个父节点都 ≥ 它的两个孩子(最大堆)。这条规则不要求左右谁大,只管父子——但它足以保证一件事:**根(堆顶)一定是全体最大**。而且完全二叉树能**紧凑地压进一个数组**,下标 i 的两个孩子就在 2i+1、2i+2,父亲在 (i-1)/2,靠下标算,连指针都不用。'
      + '维护堆序的核心动作叫 **sift-down(下沉)**:一个节点如果比孩子小,就和**更大的那个孩子**交换,换下去后继续比、一路沉到不再违反规则为止。有了它:**建堆**就是从最后一个非叶节点起、倒着对每个节点 sift-down,整个乱序数组 O(n) 就变成堆;**取最大**就是把堆顶和末尾元素对调(最大值于是排到了数组尾、就位),把堆的大小减一,再对新的堆顶 sift-down 复原。'
      + '把"取最大"反复做到底,数组就从小到大排好了——这就是 **堆排序**,O(n log n)、原地、不需要额外空间。本实验:7 个数 [3,9,2,1,7,5,8]。你会先看它建成最大堆(节点一个个下沉到位),再看取一次堆顶 9(和末尾对调、排到尾),补位后新堆顶下沉复原。树形和数组两个视图同步,每步的父子比较、交换都能对着数。'
      + '看懂这条,你就掌握了优先队列这个到处都在的零件:操作系统的任务调度、Dijkstra/Prim 里"取当前最优"、哈夫曼编码每次合并两个最小、事件驱动仿真的时间轮、从数据流里维护 Top-K、合并 K 路有序流……底层几乎都是堆。它和排序、和图算法都咬合在一起。',
    guess: {
      q: '最大堆里，值最大的元素一定在哪？',
      opts: ['根(堆顶)——父都≥子，所以根最大', '最底层最右边的叶子'],
    },
    tasks: [
      { act: '按「下一步」建堆', watch: '节点比孩子小就下沉,整棵树变成父≥子、堆顶最大' },
      { act: '看取最大', watch: '堆顶和末尾对调、最大排到尾,新顶下沉复原' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; arr?: number[]; sortedFrom?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      const out = s.arr && s.sortedFrom !== undefined ? s.arr[s.sortedFrom] : '?'
      return {
        pick: 0,
        say: `建成最大堆后堆顶就是全体最大;取一次把 **${out}** 排到了尾,新堆顶 ${s.arr?.[0]} 是剩下的最大。`,
        why: `完全二叉树+父≥子 ⇒ 堆顶永远最大。sift-down 维护堆序,建堆 O(n)、取最大 O(log n),反复取=堆排序 O(n log n)。任务调度、Dijkstra、哈夫曼、Top-K,优先队列底子都是它;下标 2i+1/2i+2 定位孩子,不用指针。`,
      }
    },
  },
  quicksort: {
    care:
      '排序是最基础的操作之一。冒泡/插入那样两两相邻交换是 O(n²),数据一大就慢。**快速排序**用一个绝妙的**分治**思路把平均复杂度压到 O(n log n),而且**原地**排、不需要额外数组,常数因子还特别小——是实践中最快的通用排序。'
      + '它的核心是一趟 **partition(分区)**:在当前区间里挑一个**基准 pivot**(本实验取区间末元素),然后扫一遍,把**比基准小**的都甩到左边、**不小于**的留在右边。这趟扫完,基准就被放到了它**最终该在的位置**——因为它左边全比它小、右边全不小于它,这个位置从此**永久锁定**、再不用动。'
      + '妙处在于:一次 partition 只确定了**一个**元素的最终位置,但它同时把问题**切成了两半**——基准左边的一段、右边的一段,彼此独立。于是对这两段**各自递归**地做同样的事:挑基准、分区、再切两半……段越切越短,直到长度为 1(单个元素天然有序),整个数组就排好了。这就是"分而治之":把一个大问题拆成同类的小问题,分别解决。'
      + '本实验:7 个数 [5,2,8,1,9,3,7]。你会看到基准(琥珀)被选定,扫描指针 j(蓝)一路走过、把比基准小的收进左区,扫完基准归位(绿=最终位置、永久锁定),然后区间一切为二,再对左右两段重复。每步的比较、交换、基准落点都能对着数,结果 [1,2,3,5,7,8,9]。'
      + '看懂这条,你就掌握了分治这个最重要的算法范式,也理解了"排序为什么值得先做":排好序后,二分查找、找中位数、去重、求交集都变快。快排也有软肋——若每次都挑到最大/最小(比如对近乎有序的数据取末元素当基准),分区就切得极不均衡,退化成 O(n²);实践中用**随机基准**或**三数取中**来规避。它和归并排序(稳定、O(n log n) 但要额外空间)、堆排序(原地、最坏也 O(n log n))是三大经典比较排序,各有取舍。',
    guess: {
      q: '快排一趟 partition 之后，基准 pivot 的位置怎样了？',
      opts: ['落到最终排好序的位置，永久锁定', '还要在后续几趟里继续挪动'],
    },
    tasks: [
      { act: '按「下一步」分区', watch: 'j 扫过:小的收左、大的留右,扫完基准归位、区间一切为二' },
      { act: '数已归位', watch: '每趟只定死一个基准的最终位置,段越切越短直到全锁定' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; arr?: number[]; sortedCount?: number; n?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `分而治之排好了 [${(s.arr ?? []).join(',')}]:每趟 partition 定死一个基准的最终位置(共 ${s.n} 个),段越切越短。`,
        why: `分治:挑基准→比它小的甩左、不小于的留右→基准归位并锁定→左右两段各自递归。平均 O(n log n)、原地、常数小,实践最快;最坏 O(n²) 用随机/三数取中基准避。和归并(稳定要空间)、堆排序(最坏也 O(n log n))是三大经典排序。`,
      }
    },
  },
  mergesort: {
    care:
      '快排是分治的一种走法(先分区、再递归),**归并排序**是另一种走法——**先分到底,再合并回去**。它的核心是一个简单到令人愉悦的操作:**合并两个已经排好序的段**。'
      + '为什么合并这么快?因为两段各自**已经有序**,那么各自的**队首就是各自的最小值**。要把它们合成一个大有序段,只需反复比较两个队首、把**较小的那个先取走**放进输出——取走谁,谁那段的队首就前移一格。一趟**线性扫描**(两段总长 n,就看 n 次)就能把两段无缝拼成一个更长的有序段。这正是归并的全部秘密。'
      + '有了"合并"这块积木,排序就水到渠成:把数组不断**对半拆**,拆到每段只剩 1 个元素(单个元素天生有序);然后**两两归并**——1 和 1 合成 2、2 和 2 合成 4、4 和 4 合成 8……段宽每轮翻倍,共 log n 轮、每轮扫一遍 n,总共 **O(n log n)**。而且不管原始数据长什么样,它**最坏也是 O(n log n)**(不像快排会退化),还**稳定**(相等的元素保持原来的先后)。代价是合并时需要一块**额外的缓冲区**来暂存输出。'
      + '本实验用自底向上的方式:7 个数 [5,2,8,1,9,3,7]。你会看到长度 1 的段两两归并成长度 2、再成 4……每次归并时,蓝色是左段、琥珀是右段,▸ 标着各自队首,比一下就把小的接进下面的输出缓冲。最终拼出 [1,2,3,5,7,8,9]。'
      + '看懂这条,你就集齐了分治的两种典型姿态(先分 vs 后合),也理解了**外部排序**的原理——当数据大到内存装不下,就把它切成能装下的块、各自排好,再用"多路归并"把这些有序块合成最终结果,靠的就是"合并有序段只需比队首"。稳定排序、链表排序(归并特别适合链表)也都用它。它和快排、堆排序并称三大经典比较排序,各有取舍:快排平均最快但最坏 O(n²)、原地;归并稳定且最坏也 O(n log n) 但要额外空间;堆排序原地且最坏 O(n log n) 但不稳定、常数略大。',
    guess: {
      q: '归并两个已排好序的段，为什么一趟线性扫描就够？',
      opts: ['两段各自队首就是各自最小，比一下取小的即可', '还得把两段合起来重新排一遍'],
    },
    tasks: [
      { act: '按「下一步」归并', watch: '比两段队首、把小的先接进输出;一段空了另一段整段接上' },
      { act: '看段宽翻倍', watch: '长度 1→2→4… 每轮合成更长的有序段,直到全有序' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; arr?: number[]; n?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      const passes = s.n ? Math.ceil(Math.log2(s.n)) : 3
      return {
        pick: 0,
        say: `分到长度 1、再两两归并回去,${passes} 轮拼出 [${(s.arr ?? []).join(',')}]:每次归并只比两段队首、取小的接上。`,
        why: `合并两个有序段只需比队首取小的(各自队首=各自最小),一趟线性。段宽 1→2→4… 翻倍共 log n 轮 ⇒ O(n log n),稳定、最坏也 O(n log n),代价是额外缓冲。外部排序、稳定排序、链表排序都靠它。`,
      }
    },
  },
  fastpow: {
    care:
      '算 a 的 n 次方,最直白的办法是把 a 连乘 n 次——n 大起来(比如密码学里 n 是几百位的大数)就慢得没法用。**快速幂**用一个漂亮的分治思路把它压到 **O(log n)**:关键是把**指数**写成**二进制**。'
      + '看个例子:13 的二进制是 1101,也就是 13 = 8+4+1。指数一相加、幂就相乘,所以 a¹³ = a⁸⁺⁴⁺¹ = a⁸ · a⁴ · a¹。现在只需要 a¹、a²、a⁴、a⁸ 这几个"2 的幂次"的幂——而它们有个绝妙的性质:**每一个都是上一个的平方**(a² = a·a、a⁴ = a²·a²、a⁸ = a⁴·a⁴)。于是只用 **log n 次平方**就能把这一串幂全算出来。'
      + '算法就成了:一边让 base 从 a 开始**不断平方**(a → a² → a⁴ → a⁸ …),一边从低位到高位扫指数的二进制;**遇到是 1 的位,就把当前的 base 乘进结果**,是 0 的位就跳过。指数有 log n 个二进制位,所以总共 log n 次平方 + 至多 log n 次乘法就得到答案,而不是 n 次。'
      + '本实验:算 3¹³。你会看到 base 反复平方 3 → 9 → 81 → 6561,指数 13=1101₂ 的四位里,bit0=1 取 3、bit1=0 跳过、bit2=1 取 81、bit3=1 取 6561,把取到的乘起来:3 · 81 · 6561 = 1594323。只用了 3 次乘法 + 3 次平方,而朴素要乘 13 次。每个数都能手算核对。'
      + '看懂这条,你就理解了"用二进制拆解来加速"这个反复出现的套路,也摸到了现代密码学的一块基石:RSA、Diffie-Hellman 里要算 a^n mod m,n 是几百上千位的大数,正是靠**模幂**(快速幂每步取模)才可行——没有它,公钥加密根本跑不动。同样的思想还能推广成**矩阵快速幂**:把线性递推(如斐波那契)写成矩阵的幂,就能 O(log n) 求第 n 项。它和二分查找是一对好朋友——都是"每一步把规模砍掉一半",所以都是 log n。',
    guess: {
      q: '快速幂算 a^13，为什么只要 ~4 步而不是 13 步？',
      opts: ['13=8+4+1，a¹³=a⁸·a⁴·a¹，而这些幂靠反复平方 log n 步就得到', '因为它跳过了偶数次幂'],
    },
    tasks: [
      { act: '按「下一步」逐位', watch: 'base 反复平方得 a^(2^k);二进制这位是 1 就把它乘进结果' },
      { act: '数乘法次数', watch: '3¹³ 只用 3 乘+3 平方,不是老实乘 13 次——log n vs n' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; a?: number; n?: number; result?: number; mults?: number; squares?: number; picked?: number[] }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `${s.a}^${s.n} = ${s.a}^(${(s.picked ?? []).join('+')}) = ${s.result}:只用 ${s.mults} 次乘 + ${s.squares} 次平方,朴素要 ${s.n} 次。`,
        why: `把指数拆二进制(${s.n}=${(s.picked ?? []).join('+')}),幂就拆成对应的"平方幂"相乘;这些幂每个由上一个平方得来(log n 次)。O(log n) vs O(n)。模幂(RSA)、矩阵快速幂(线性递推)都是它;和二分查找同理——每步砍一半。`,
      }
    },
  },
  astar: {
    care:
      '在一张有障碍的地图上,从起点找到终点的**最短路**——游戏里 NPC 绕过墙走向你、导航软件算最快路线,都是这个问题。最朴素的 BFS/Dijkstra 能找到最短路,但它**没有方向感**:像水波一样从起点向四面八方均匀铺开,把大量根本不朝终点的格子也探了个遍,慢。**A\*** 给这个搜索装上了"方向感"。'
      + '它的核心是给每个格子算一个分数 **f = g + h**,并总是优先展开 f 最小的那个。其中 **g** 是"从起点走到这里已经花的真实步数"——它保证你不会为了眼前近而走了冤枉路;**h** 是"从这里到终点大概还要多远"的**估计**(本实验用曼哈顿距离,即横竖格子差之和,把墙当作不存在)——它像一个指南针,把搜索**拽向终点**的方向。'
      + '两者一加,f 就同时兼顾了"已经走了多少"和"还差多少",于是 A* 会优先探那些**看起来最有希望**通向终点的格子,而不是四面乱铺。这里有个关键条件:h **不能高估**真实距离(专业叫 admissible,曼哈顿距离忽略墙,只会低估、不会高估)——只要满足,A* 找到的**一定是最短路**。而且 h 越接近真实、搜索越集中、越快;当 h 恒等于 0 时,f 就只剩 g,A* 正好**退化成 Dijkstra**。'
      + '本实验:8×5 网格,起点在左、终点在右,中间竖着一堵墙、只在下方留了个缺口。你会看到 A* 先沿着 h 的指引一路向右直扑终点(那一串格子 f=7),直到撞上墙;然后被迫向下绕行(f 升到 9),从缺口穿过、再拐上去够到终点。全程只展开了 19 个格子就找到 9 步的最短路,每格的 g、h、f 都能对着数核对。蓝=已展开、浅虚线=待探的开放集、琥珀=当前格、绿=最终路径。'
      + '看懂这条,你就理解了"启发式搜索"这个大家族的精髓——用一个廉价的估计(启发函数)给盲目的搜索装上方向,在保证最优的前提下大幅剪掉无用探索。它是游戏 AI 寻路、机器人路径规划、地图导航的标准工具;换更强或更弱的 h,就在"更快但可能不最优"和"更慢但保证最优"之间滑动。它和 Dijkstra 是连续谱的两端,开放集通常用堆(优先队列)来快速取 f 最小的格。',
    guess: {
      q: 'A* 用 f=g+h 排序，其中 h（到终点的估计）起什么作用？',
      opts: ['给搜索装方向感，把探索拽向终点，少走冤枉格', '它是已经走过的真实距离，防止绕远'],
    },
    tasks: [
      { act: '按「下一步」展开', watch: 'A* 先探 f 最小的:沿 h 指引直扑终点,撞墙才绕行' },
      { act: '看展开范围', watch: '只在起点→终点走廊附近展开,不像 Dijkstra 四面均匀铺' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; path?: string[]; expanded?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `A* 用 f=g+h 导航,只展开 ${s.expanded} 格就找到 ${(s.path?.length ?? 1) - 1} 步的最短路。`,
        why: `f=g+h:g(已走步数)防走冤枉、h(到终点乐观估计)把搜索拽向终点。h 不高估就保证最短路,且比 Dijkstra(只看 g、四面均匀铺)省很多展开;h=0 就退化成 Dijkstra。游戏寻路、机器人规划、地图导航都靠它;开放集常用堆取 f 最小。`,
      }
    },
  },
  perceptron: {
    care:
      '深度学习听着高深,但它的**最小零件**其实很朴素:一个**神经元**。感知机就是这个零件的原型——它给每个输入配一个**权重** w、再加一个**偏置** b,把它们线性组合成一个分数 score = w·x + b,然后看这个分数的**正负**来判类别。几何上,score=0 就是一条**分界线**(二维是线、高维是超平面),线的一侧判正、另一侧判负。'
      + '真正有意思的是它**怎么学**——一条最开始乱猜的线,如何自己调整到能把两类点分开?规则简单得惊人:**错了就纠**。逐个看训练点,如果当前的线把某个点分对了(判的符号和真实类别一致),什么都不做;如果分错了,就把权重朝"下次能分对这个点"的方向挪一小步:**w += y·x、b += y**(y=+1 或 −1 是这个点的真实类别)。直觉上,这一步就是把分界线朝着这个被冤枉的点**转一下**,让它落到正确的一侧。'
      + '反复扫过所有点,只要两类数据**线性可分**(存在一条线能分开),**感知机收敛定理**保证:有限步之内,一定会扫到某一整轮**零错误**——线就学好了。本实验:平面上 6 个点(3 正 3 负)。你会看到那条线从乱猜开始,每遇到一个分错的点(红圈)就纠一下、慢慢转到位,5 次纠正之后某一轮全部分对,收敛到 w=(−3,2)、b=1。每一步的 score、每次纠正后的 w/b 都能手算核对。'
      + '看懂这条,你就摸到了整个神经网络的地基。感知机是**逻辑回归**(把硬阈值 sign 换成平滑的 sigmoid、输出概率)、**SVM**(同样找分界线,但要"最大间隔")、乃至**深度网络里每一个神经元**的共同祖先——深层网络不过是把成千上万个这样的神经元分层堆叠、用非线性激活连起来。它也暴露了单个神经元的极限:遇到**线性不可分**的问题(经典的异或 XOR),一条直线怎么都分不开——正是这个局限,催生了多层感知机和反向传播,把 AI 从"一条线"推向了"任意复杂的边界"。',
    guess: {
      q: '感知机遇到一个被分错的点，怎么调整？',
      opts: ['把权重朝该点挪：w += y·x、b += y，让分界线转向它', '删掉这个点，继续看下一个'],
    },
    tasks: [
      { act: '按「下一步」逐点', watch: '符号对就跳过、符号错就纠(w+=y·x),线朝分错的点转一下' },
      { act: '看它收敛', watch: '5 次纠正后某一整轮零错误——线学好了,两类干净分开' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; w?: number[]; b?: number; updates?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `一条乱猜的线,靠"错了就纠"学到 w=(${(s.w ?? []).join(',')})、b=${s.b},共 ${s.updates} 次纠正后把两类分开。`,
        why: `神经元 score=w·x+b 看符号判类;分错就把权重朝该点挪(w+=y·x),线转向它。线性可分时感知机收敛定理保证有限步学好。它是逻辑回归、SVM 和深度网络每个神经元的祖先;线性不可分(异或)才需要多层+非线性。`,
      }
    },
  },
  pooling: {
    care:
      '卷积层扫完一张图,会得到一张(常常很大的)**特征图**。但相邻的位置往往高度冗余——一个特征在这里响应强,挪一两个像素多半还强。**池化**就是用来**缩小**这张图、同时**保住关键信号**的操作。'
      + '做法极简单:用一个小窗口(本实验是 2×2)在特征图上**不重叠地滑**,每滑到一块,就把窗口里的 4 个数**汇总成 1 个**。有两种常见汇总:**最大池化**取这 4 个里的**最大值**(留住最强的那个响应)、**平均池化**取**平均**(保留整体强度)。窗口不重叠、步长等于窗口边长,所以图的**边长减半、面积变成 1/4**——这叫**降采样**。'
      + '这么做有三个好处:一是**计算和参数骤减**,后面的层要处理的数据少了 3/4;二是对小的**平移更鲁棒**——目标在窗口里挪动一格,最大值常常不变,于是网络对物体的精确位置不那么敏感;三是**感受野变大**,越往高层,每个点概括的原图范围越大,越能看"全局"。要注意:池化本身**没有可学参数**,它就是个固定的汇总规则。'
      + '本实验:一张 4×4 的特征图,2×2 最大池化 → 输出 2×2 = [[6,4],[7,9]](每块取最大);把上面的参数切成平均池化 → [[3.75,2.25],[4,5]](每块取平均)。窗口一块块扫过去,每个输出都能对着那 4 个数手算核对。'
      + '看懂这条,你就补齐了 CNN 的另一半:**卷积**提取特征、**池化**压缩并稳住特征,一层层叠起来,图越缩越小、通道越来越多、语义越来越高级,最后接上分类头。经典网络 LeNet、VGG 都是"卷积+池化"反复堆。不过近年也有把池化换成**步长卷积**(让下采样也可学)或用全局平均池化收尾的做法——但"用小窗口汇总来降采样"这个思想始终在。它和卷积是一对:卷积看细节,池化抓要点。',
    guess: {
      q: '2×2 最大池化，把窗口里的 4 个数变成几个、取什么？',
      opts: ['变成 1 个，取 4 个里的最大值', '还是 4 个，只是重新排序'],
    },
    tasks: [
      { act: '按「下一步」扫窗口', watch: '2×2 窗口不重叠扫 4 个位置,每块汇总成 1 个数填进输出' },
      { act: '切「汇总方式」', watch: '最大池化留最强(6/4/7/9)、平均池化留整体(3.75…);改了立即重跑' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; kindName?: string }>(trace)
      if (!s || s.phase !== 'done') return null
      const avg = s.kindName === '平均'
      return {
        pick: 0,
        say: `${s.kindName}池化把 4×4 缩成 2×2 = ${avg ? '[[3.75,2.25],[4,5]]' : '[[6,4],[7,9]]'}:每块 2×2 汇总成一个数,边长减半、面积变 1/4。`,
        why: `小窗口不重叠地滑,每块取${avg ? '平均(留整体强度)' : '最大(留最强响应)'}=降采样。计算量骤减、对小平移更鲁棒、感受野变大;无可学参数。CNN 里紧跟卷积(LeNet/VGG),后来常被步长卷积替代。`,
      }
    },
  },
  beam: {
    care:
      '大模型是**逐词生成**的:每一步给出下一个词的概率分布,一句话的概率就是这一串词各步概率的**连乘**。问题来了——想让**整句**概率最大,该怎么选词?'
      + '最直接的是**贪心**:每步都挑当前概率最高的那个词。但这常常掉坑,因为**局部最优 ≠ 全局最优**——某一步看着最好的词,后面可能接不出好句子;而另一个当下略差的词,却能引出一整句高概率的话。可另一个极端——**全搜索**枚举所有可能的词序列——数量随句子长度指数爆炸,根本算不动。'
      + '**束搜索**是二者之间的黄金折中。它维护 **k 条**最有希望的候选序列(k 叫**束宽**)。每一步,把这 k 条各自扩展一个词,得到 k×词表 那么多新候选,按**累积概率**(到目前为止的连乘)排个序,**只保留前 k 条**继续,其余全部剪掉。这样既不像贪心那样一条道走到黑,也不像全搜索那样爆炸——每步的工作量固定在 k×词表。**k=1 时它就退化成贪心,k 趋于无穷就逼近全搜索**,k 越大越可能找到更优的整句、但越慢。'
      + '本实验:一个玩具语言模型,束宽 k=2,生成 3 个词。你会清楚看到:贪心第一步就贪了 A(0.5＞0.4),结果被锁死在平庸的 AB⟨end⟩,整句概率只有 0.10;而束搜索因为**同时留着 B 这条**,在下一步发现了 B→C 的高概率通路,最终走出 BC⟨end⟩、概率 **0.288**,近 3 倍地赢过贪心。每一步保留了哪几条、它们的累积概率是多少,都能对着连乘手算核对。'
      + '看懂这条,你就理解了大模型**解码**这一侧的核心权衡。束搜索是机器翻译、文本摘要、语音识别、受限生成(要求输出满足某种格式)的标准做法,实践里还会配上**长度归一化**(防止偏爱短句)、**覆盖惩罚**等技巧。它和另一条路——**随机采样**(按概率掷骰子,配温度、top-k、top-p)——形成对照:束搜索追求"最高概率、更确定",适合有标准答案的任务;采样追求"多样、有创意",适合开放式写作。理解了这对取舍,你就明白了为什么同一个模型,换个解码策略,输出气质就完全不同。',
    guess: {
      q: '束搜索(束宽 k=2)每一步保留几条候选序列？',
      opts: ['按累积概率排序后保留最好的 2 条，其余剪掉', '保留全部候选，最后再一起比'],
    },
    tasks: [
      { act: '按「下一步」解码', watch: '每步 k 条各扩一词→排序→只留前 k 条(绿),其余剪掉' },
      { act: '看末步对照', watch: '贪心第一步贪 A 被锁进 0.10,束搜索留住 B 发现 0.288——近 3 倍胜出' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; best?: { seq: string; p: number }; greedy?: { seq: string; p: number }; k?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      const d = (x: string) => x.replace('·', '⟨end⟩')
      const ratio = s.greedy && s.greedy.p > 0 ? Math.round((s.best!.p / s.greedy.p) * 10) / 10 : 0
      return {
        pick: 0,
        say: `束搜索(k=${s.k})走出 ${d(s.best!.seq)}(${s.best!.p}),比贪心 ${d(s.greedy!.seq)}(${s.greedy!.p}) 高 ${ratio} 倍——赢在同时保留了 B 那条。`,
        why: `整句概率=各步连乘。贪心每步只取最高易掉坑(局部≠全局)、全搜索爆炸;束搜索维护 k 条、每步各扩一词按累积概率留前 k。k=1 退化成贪心、k=∞ 逼近全搜索。机器翻译/摘要/受限生成标配(配长度归一化);对照随机采样(要多样)。`,
      }
    },
  },
  rnn: {
    care:
      '前面的网络——感知机、CNN——都有个共同的假设:输入是**固定大小**的(一张图、一组特征)。可现实里有大量**变长序列**:一句话可长可短、一段语音、一串股价、一段传感器读数。这些数据一个接一个地来,而且**前后有关联**(这个词是什么,取决于前面说了啥)。**循环神经网络 RNN** 就是为序列而生的。'
      + '它的核心巧思是引入一个**隐藏状态 h**,你可以把它想成一条**记忆的传送带**,沿着时间一步步往前传。每读入序列里的一个元素 x_t,网络就用**同一套权重**,把"**当前输入 x_t**"和"**上一刻的记忆 h_{t-1}**"揉在一起,算出新的记忆:h_t = tanh(wx·x_t + wh·h_{t-1} + b)。然后 h_t 再传给下一步。就这样,记忆随着序列不断被更新、往前流动。'
      + '这个设计有两个关键点。其一,**权重在所有时刻共享**——不管序列多长,来来回回用的都是同一组 wx、wh、b(和 CNN 用同一个卷积核扫全图异曲同工),所以它能处理**任意长度**的输入。其二,也是最重要的,**h_t 里藏着到此为止的全部历史**——它不只看当前这个词,而是带着前面所有词的"浓缩印象"。这意味着:**同样一个当前输入,如果前面读到的东西不同,算出的 h 也不同**。这就是"记忆"。'
      + '本实验:序列 [2, −1, 3, −2],取 wx=0.5、wh=0.8、b=0,记忆从 h₀=0 出发。你会一步步看到记忆被更新:h₁=tanh(1)=0.762 → h₂=0.109 → h₃=0.92 → h₄=−0.258,每一步的 tanh 输入都能手算核对。末尾还演示了"记忆"的意义:同样最后输入 +2,历史是 [2] 时末态 h=0.923、历史是 [−3] 时 h=0.269——历史不同,记忆就不同。'
      + '看懂这条,你就理解了 AI 处理序列的第一代主力思路。RNN 曾是语言模型、机器翻译、语音识别的标配。但它有个硬伤:序列一长,记忆要经过很多步 tanh 反复挤压,早期的信息会被冲淡——训练时表现为**梯度消失**,学不到长距离依赖。为解决它,人们给记忆装上了**门控**(LSTM、GRU 用"忘记门/输入门"控制记忆的读写),再后来,**Transformer 的注意力**干脆抛弃了顺序递归、让每个位置直接看全序列——但"用一个状态承载上下文"的思想,一直流淌在其中。',
    guess: {
      q: 'RNN 每一步算新的隐藏状态 h_t，用到什么？',
      opts: ['当前输入 x_t + 上一刻记忆 h_{t-1}（共享权重）', '只用当前输入 x_t，跟历史无关'],
    },
    tasks: [
      { act: '按「下一步」读序列', watch: '每步 h_t=tanh(wx·x+wh·h_prev),记忆沿时间更新、往右传' },
      { act: '想记忆的作用', watch: '同样最后输入 +2,历史 [2] 得 0.923、[−3] 得 0.269——h 记着过去' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; ht?: number; xs?: number[] }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `隐藏状态沿时间流动,把序列 [${(s.xs ?? []).join(',')}] 浓缩进末态记忆 ${s.ht}——每步都同时吃当前输入和上一刻记忆。`,
        why: `h_t=tanh(wx·x_t+wh·h_{t-1}+b),权重所有时刻共享(吃任意长序列)、h_t 藏全部历史(同样末输入历史不同 h 就不同)。语言模型/翻译/语音的早期主力;长序列梯度消失 → LSTM/GRU 门控 → Transformer 注意力。`,
      }
    },
  },
  wordvec: {
    care:
      '计算机怎么"懂"一个词的意思?最早只能把词当**符号**——"猫"就是一个编号、"狗"是另一个,彼此毫无关系,机器看不出"猫"和"狗"比"猫"和"汽车"更像。**词向量(Word2Vec)** 换了个思路:把每个词映射成一个**稠密向量**(几百个数),让"意思"变成空间里的"**位置**"。'
      + '它靠一个朴素而深刻的假设学出来——**分布假设**:一个词的意思,由它常出现的**上下文**决定。"猫"和"狗"都经常挨着"宠物""喂食""可爱"出现,所以它们该有相近的向量;"汽车"的邻居是"发动机""公路",就离得远。Word2Vec 的 skip-gram/CBOW 就是拿海量文本,不断把**共现的词的向量相互拉近**,训练完,语义相近的词自然聚成一团。'
      + '真正让人惊叹的是学完之后的一个性质:**语义关系变成了向量的方向**。最著名的例子:**国王 − 男人 + 女人 ≈ 王后**。这不是巧合——"国王减男人"这个向量,恰好指向"**王室**"这个语义方向(把一个普通男人变成国王,要往王室走);再加上"女人",就等于沿着"女性"方向再走一步,终点正好落在"王后"附近。同理"巴黎−法国+日本≈东京"。类比、近义、聚类,都能用简单的向量运算做出来。'
      + '本实验为了看得清,用两条**可解释的语义轴**——横轴"王室度"(0 平民 → 1 王室)、纵轴"性别"(0 男 → 1 女)——给几个词定了坐标:男人(0,0)、女人(0,1)、国王(1,0)、王后(1,1)。你会现场看到:国王−男人=(1,0) 是"王室"方向(琥珀箭头),把它接到"女人"上(虚线,凑成一个平行四边形),终点 ⊕ 落在 (1,1),离它最近的词正是**王后**,距离 0。每一步的向量加减都能手算核对。'
      + '看懂这条,你就理解了现代 NLP 的起点。词向量是语言从"离散符号"迈向"连续语义"的关键一步——有了它,神经网络才能对文字做数学。真实的词向量是从海量语料自动学出的几百维向量(不像这里手工指定的两维),但思想一样。今天所有大模型的**第一层就是一张巨大的词向量表**(embedding),把每个 token 变成向量再送进 Transformer;后来的 BERT、GPT 更进一步,让同一个词在不同句子里有不同的"上下文向量"。但"把词变成向量、让意思可计算"这个奠基性的想法,始于 Word2Vec。',
    guess: {
      q: '为什么「国王 − 男人 + 女人」算出来会接近「王后」？',
      opts: ['因为语义关系在词向量里体现为方向，「王室」「性别」两个方向可加减', '因为这四个词的编号刚好连续'],
    },
    tasks: [
      { act: '按「下一步」做类比', watch: '国王−男人得"王室"方向→接到女人上→终点落在王后附近' },
      { act: '想方向的含义', watch: '"男→女""平民→王室"是两个方向,能像箭头一样加减——语义算术' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; nearest?: string; result?: number[]; ranked?: { name: string; d: number }[] }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `国王−男人+女人 = (${(s.result ?? []).join(',')}),离它最近的词是 ${s.nearest}(距离 ${s.ranked?.[0]?.d})——类比成立。`,
        why: `词向量把词变成向量:意思相近→位置相近、语义关系→方向。靠分布假设学出(共现的词向量相互靠近,skip-gram/CBOW)。近义/类比/聚类都靠向量运算。它是 NLP 从符号迈向语义的关键一步,也是所有大模型输入层(embedding)的地基。`,
      }
    },
  },
  lstm: {
    care:
      '普通 RNN 有个致命伤:它的记忆(隐藏状态)**每一步都要过一次 tanh**,反复挤压之下,很早以前的信息几步就被冲淡了。训练时这表现为**梯度消失**——网络学不到"隔了很远的两个词其实有关系"这种长距离依赖。**LSTM**(长短期记忆网络)专门来治这个病。'
      + '它的核心发明是:除了会被反复挤压的隐藏状态,**另开一条"细胞状态"c 作为记忆的传送带**。这条传送带的更新方式很特别——**c_t = f · c_{t-1} + i · c̃**,是一个**以加法为主、几乎线性**的通路。关键就在这个加法:只要**遗忘门 f ≈ 1、输入门 i ≈ 0**,上一刻的记忆 c_{t-1} 就被**原封不动地搬到**这一刻,信息(以及反向传播的梯度)能顺着这条高速路传得很远而不衰减。'
      + '控制这条传送带的,是三个**门**——每个都是一个取值 0~1 的开关(由数据算出的 sigmoid):**遗忘门 f** 决定"旧记忆留多少"、**输入门 i** 决定"新内容写多少"、**输出门 o** 决定"这一刻放多少记忆出来":h_t = o · tanh(c_t)。于是 LSTM 能**学会**在合适的时刻记住、忽略、或说出——比如读到关键信息就开输入门存起来,中间无关的词就关上输入门、开着遗忘门守住记忆,需要用时再开输出门。'
      + '本实验演示一个"记住开头、末尾取出"的任务(为看清机制,把门值理想化成 0 或 1;真实的门是 0~1 的软值)。标量 LSTM 走 4 步:第 1 步**存**——开输入门(i=1),c̃=0.8 写入,c=0.8;第 2、3 步**守**——遗忘门 f=1、输入门 i=0,c 保持 0.8 纹丝不动;第 4 步**取**——开输出门(o=1),h=tanh(0.8)=0.664。你会看到那条 cell 传送带**全程稳稳停在 0.8**,而这正是普通 RNN 会一路丢掉的。'
      + '看懂这条,你就理解了序列建模里"如何对抗遗忘"的关键一招,也会发现它和别处的思想相通:那条"加法为主的记忆高速路",本质上和残差连接(ResNet)让梯度直通的思路是一家人——都是给信息/梯度开一条不衰减的近路。LSTM 和它的简化版 GRU,曾是机器翻译、语音识别、文本生成的绝对主力。直到 Transformer 用注意力让每个位置**直接**访问全序列、彻底摆脱了逐步递归的瓶颈——但"用门控精细地读写一段记忆"这个洞见,至今仍在各种带状态的模型里回响。',
    guess: {
      q: 'LSTM 靠什么让记忆能稳稳传很远、不像 RNN 那样很快忘光？',
      opts: ['细胞状态 c 是加法为主的传送带，遗忘门≈1 就原样传下去', '把 tanh 换成了更强的激活函数'],
    },
    tasks: [
      { act: '按「下一步」走 4 步', watch: '存(开输入门)→守守(f=1 i=0,c 不变)→取(开输出门)' },
      { act: '盯 cell 传送带', watch: 'c 全程稳在 0.8——记忆被原封不动扛过来,这正是 RNN 会丢的' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; c?: number; h?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `cell 记忆传送带全程稳在 ${s.c}:第 1 步存进去、中间遗忘门=1 守住、末步开输出门取出 ${s.h}——RNN 做不到的长期记忆。`,
        why: `c_t=f·c_{t-1}+i·c̃ 是加法为主、近乎线性的记忆高速路,f≈1/i≈0 时旧记忆和梯度原样传很远,治 RNN 的梯度消失。三个门(0~1 sigmoid)控制记/忘/说。和残差同源(给梯度开近路);GRU 是简化,后被 Transformer 注意力取代。`,
      }
    },
  },
  norm: {
    care:
      '深层网络训练时有个隐蔽的麻烦:每一层的激活值分布,会随着前面各层参数的更新而不停漂移(有人叫它 internal covariate shift)。分布飘忽不定,优化就像在移动的靶子上打靶——学习率难调、收敛慢、还容易发散。**归一化**是治这个病的一剂良方:在网络内部,把一批激活**拉回到零均值、单位方差**的标准状态,让后面的层始终面对一个稳定的输入分布。'
      + '公式很朴素:对一片激活,算出它的均值 μ 和标准差 σ,做 **x̂ = (x − μ) / √(σ² + ε)**(ε 是防止除零的极小数),就把它标准化了。为了不因此丧失表达能力,再乘上一个**可学习的缩放 γ**、加一个**可学习的偏移 β**——网络若需要,可以把分布再调回去。'
      + '真正的分水岭,不在公式,而在**沿哪条轴去统计 μ 和 σ**。把激活想成一张"**样本 × 特征**"的表:**BatchNorm(批归一化)** 对**每一个特征**、在**一个 mini-batch 里的所有样本**上算 μ、σ——也就是沿着"**样本**"这条轴(表的每一列);**LayerNorm(层归一化)** 则对**每一个样本**、在**它自己的所有特征**上算——沿着"**特征**"这条轴(表的每一行)。同一个 (x−μ)/σ,统计的方向一换,性质就全变了。'
      + '本实验:一张 4 样本 × 3 特征的激活表。切到批归一化,它就一**列列**地做(每个特征跨 4 个样本)——这里三个特征恰好标准差都是 2,归一化后干净地变成 ±1;切到层归一化,它就一**行行**地做(每个样本跨 3 个特征)。每一片的 μ、σ 和归一化结果都能手算核对,琥珀色高亮的那一条,就是当前正沿之归一化的轴。'
      + '这个"沿哪条轴"的差别,决定了它们各自的地盘。**BatchNorm** 因为要跨样本统计,**依赖 batch**:训练时用当前 batch、推理时得用训练期攒的滑动平均,行为不一致;batch 一小(甚至为 1)统计就不稳。它在 CNN 图像任务里如鱼得水。**LayerNorm** 只看样本自己、**完全不依赖 batch**,天然适合每个样本长度不一的序列,于是成了 **Transformer 和 RNN 的标配**——你在 CS 学科见过的 **RMSNorm**,正是 LayerNorm 更省的变体(它连均值都不减、只按均方根缩放)。理解了"沿样本轴还是沿特征轴"这一刀,你就分清了现代网络里这一整族归一化。',
    guess: {
      q: 'BatchNorm 和 LayerNorm 最本质的区别是什么？',
      opts: ['沿哪条轴统计 μ/σ：BatchNorm 跨样本(每列)、LayerNorm 跨特征(每行)', '一个减均值、一个不减'],
    },
    tasks: [
      { act: '按「下一步」逐片归一', watch: 'BatchNorm 一列列(每个特征跨样本)、LayerNorm 一行行(每个样本跨特征)' },
      { act: '切「归一化方式」', watch: '同一个 (x−μ)/σ,只是统计的轴不同——BatchNorm 沿列、LayerNorm 沿行' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; kindName?: string; axis?: string }>(trace)
      if (!s || s.phase !== 'done') return null
      const isB = s.axis === 'col'
      return {
        pick: 0,
        say: `${s.kindName}沿"${isB ? '样本' : '特征'}"轴,给每${isB ? '个特征(列)' : '个样本(行)'}做 (x−μ)/σ,拉成零均值、单位方差。`,
        why: `都是 x̂=(x−μ)/√(σ²+ε)+可学 γ、β,治激活分布漂移、让深层网络更好训练。区别只在沿哪条轴统计:BatchNorm 跨样本(依赖 batch,CNN 常用)、LayerNorm 跨特征(不依赖 batch,Transformer/RNN 标配;RMSNorm 是它的简化)。`,
      }
    },
  },
  rag: {
    care:
      '大模型很能说,但它的知识**冻结在训练那一刻的参数里**,带来三个真问题:会**过时**(训练后发生的事它不知道)、记不住你的**私有资料**(公司文档、个人笔记从没进过训练集)、而且遇到不知道的还爱**一本正经地编造**——这就是"幻觉"。**RAG(检索增强生成)** 用一个朴素的办法治它:别让模型闭卷硬答,给它一场**开卷考试**。'
      + '它分三步。第一步**检索**:把用户的问题编码成一个**查询向量**,拿它去一个**向量化的知识库**里,和每一篇资料的向量比**相似度**(内积或余弦),挑出最相关的几篇(top-k)。注意——这一步本质就是**向量最近邻搜索**,和你学过的词向量、k-NN 是一脉相承的。第二步**增强**:把检索到的这几篇原文,拼进提示词里当作**上下文**。第三步**生成**:模型带着这些"参考资料"来回答。'
      + '本实验:用户问「猫爱吃什么?」,知识库里有 5 篇短文(讲猫、狗、汽车、植物…)。你会看到系统把问题和每篇算相似度——两篇讲猫吃东西的分数最高(0.9、0.74),而讲汽车(0)、植物(0.02)的几乎为零;于是 top-2 被检索出来,拼成「已知:猫是肉食动物…;猫爱吃鱼、鸡肉…。问:猫爱吃什么?」喂给模型,模型据此答出「肉和鱼」。每一步的相似度、检索结果都能手算核对。'
      + '看懂这条,你就理解了当下最主流的大模型落地范式。RAG 的好处几乎全是工程上梦寐以求的:答案**有出处、可溯源**(能指出是根据哪篇资料说的)、知识**随库更新**(改文档就行,不用重新训练几十亿参数的模型)、**大幅减少幻觉**(有资料兜底就不容易瞎编)、还能接入**私有/实时**数据。它是企业问答、智能客服、文档助手、搜索引擎"AI 概览"的底座。当然它也有讲究:检索质量决定答案上限(检索错了,生成再好也白搭),所以实践里常配上**文档切块、重排序(rerank)、多路召回、查询改写**等技巧。它和微调是两条互补的路——微调改变模型"本身会什么",RAG 则给模型"外挂一个随时可查的图书馆"。',
    guess: {
      q: 'RAG 让大模型答得有据可查，靠的第一步是什么？',
      opts: ['把问题变向量、在知识库按相似度检索最相关的几篇（向量最近邻）', '把整个知识库都塞进提示词一起喂给模型'],
    },
    tasks: [
      { act: '按「下一步」跑三步', watch: '算相似度→检索 top-2(绿)→拼进上下文→据此作答' },
      { act: '看无关文档', watch: '汽车、植物相似度接近 0、落选——检索只留跟问题最相关的' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; answer?: string; retrieved?: number[] }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `检索出最相关的 2 篇当上下文,模型据此答「${s.answer}」——答案有出处,不靠模型瞎记。`,
        why: `RAG=检索(把问题变向量、按相似度取 top-k,本质是向量最近邻)+ 增强(拼进上下文)+ 生成(据此作答)。答案可溯源、随库更新、少幻觉,不用重训模型;是问答/客服/搜索的主流范式,检索质量决定上限。`,
      }
    },
  },
  selfconsist: {
    care:
      '让大模型做数学题、推理题,最直接的办法是让它"一步步想"(思维链 CoT),然后取它想出来的那**一条**推理路径的答案。但这有个脆弱之处:单条推理链**一步错就步步错**,而且没有回头路——中间某步算错,整个答案就毁了。**自洽(Self-Consistency)** 用一个朴素却出奇有效的办法来加固它。'
      + '它的洞见很妙:对于一道**有唯一正确答案**的推理题,**正确的推法往往有很多条,但它们最后都会通向同一个答案**;而错误的推法则五花八门、彼此还常常不一致。既然如此,那就别只信一条链——让模型对同一道题,用带随机性的**采样**(温度采样制造多样性)生成**多条**不同的推理链,每条独立地推到自己的答案,最后**看哪个答案出现的次数最多**(多数投票),就采纳它。'
      + '本实验:一道应用题「5 个苹果 + 3 袋×每袋 4 个」(正解 17)。系统采样出 5 条推理链:有 3 条虽然算式写法不同(有的先乘后加、有的直接写 5+12),但都正确地得到 17;另外 2 条则各自出错——一条把括号加错算成 (5+3)×4=32,一条乘错算成 5×3+4=19。投票结果 17 得 3 票、32 和 19 各 1 票,于是**多数票 17 胜出**,正好是对的。而如果用贪心只采一条链,万一恰好采到那条算成 32 的,就直接答错了——自洽用"多采几条 + 多数投票"把它救了回来。每条链的答案、每个票数都能手数核对。'
      + '看懂这条,你就理解了一个反直觉但重要的道理:在推理任务上,**采样的随机性不是敌人,反而是工具**。适度的多样性让模型探索出多条独立的推理路径,而"多条独立路径的共识"比"单条路径的自信"要可靠得多——这本质上是一种集成(ensemble)思想在推理上的体现,和随机森林靠多棵树投票、和"三个臭皮匠"是一个道理。自洽是提升大模型数学、常识推理准确率最简单有效的技巧之一,常和思维链 CoT 搭配使用。它的代价也很直白:要把同一道题跑 N 遍,更慢、更贵——所以是拿算力换准确率。它和束搜索形成有趣的对照:束搜索求的是**单一最优**序列,自洽要的是**多条独立答案的共识**。',
    guess: {
      q: '自洽(Self-Consistency)靠什么提升推理准确率？',
      opts: ['采样多条推理链、对它们的答案多数投票', '让模型把唯一那条推理链算得更仔细'],
    },
    tasks: [
      { act: '按「下一步」采样', watch: '一条条推理链冒出来,票数实时累加' },
      { act: '看多数投票', watch: '3 条殊途同归到 17、2 条各自算错——多数票 17 胜出' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; winner?: number; correct?: number; tally?: [number, number][]; n?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `采样 ${s.n} 条推理链、多数投票:${s.winner} 得 ${s.tally?.[0]?.[1]} 票胜出(正解 ${s.correct}${s.winner === s.correct ? '✓' : ''})——救回了单链可能算错的答案。`,
        why: `正确推法多条且一致、错法各异,所以采样 N 条链 + 多数投票能把少数错链淹没,显著提升数学/常识推理准确率。是集成思想在推理上的体现,配思维链 CoT;代价是多跑 N 次。对照束搜索求单一最优,自洽要多条答案的共识。`,
      }
    },
  },
  bestofn: {
    care:
      '大模型生成有随机性,同一个提示采样一次,质量时好时坏——有时灵光乍现,有时平庸甚至跑偏。**Best-of-N**(也叫拒绝采样)用一个朴素到近乎"作弊"的办法稳定质量:**别只采一次,采 N 个候选,然后挑最好的那个**。'
      + '这里的关键角色是一个**打分器**:它给每个候选打一个分,你就照着分数取最高(argmax)。打分器有两种常见形态。一种是训练好的**奖励模型**(Reward Model)——它学过人类偏好,能给一段回答的"有用性、质量、安全性"打分,这正是 RLHF 流水线里的核心部件;另一种是**可计算的验证器**——对有客观对错的任务,直接验算(数学题算结果对不对)、跑单元测试(代码能不能通过),把通过程度当分数。'
      + '本实验用后一种(验证器,好手算):任务是「用 3、8、5 拼一个算式,结果尽量接近 24」。系统采样出 5 个候选算式,验证器按接近程度打分(奖励 = 10 − |24 − 结果|,越接近 24 分越高):3+8+5=16 得 2 分、5×3+8=23 得 9 分、8×5=40 得 0 分、3×8=24 得满分 10、3×8−5=19 得 5 分。一路采样、一路更新"当前最高分",最后取分数最高的 **3×8=24**。每个结果、每个奖励都能手算核对。'
      + '看懂这条,你就理解了"用采样多样性 + 择优"提升输出质量的通用套路,也看清了它和自洽的分工。两者都先采样多个候选,但**合成方式不同**:**自洽**用**多数投票**——适合有唯一离散答案、正确路径会自然聚集的推理题;**Best-of-N** 用**外部打分器选单个最好**——适合开放式生成(写作、对话、代码),这类任务没有"多数答案"可投,只能靠一个评价标准来挑。Best-of-N 是 RLHF 数据合成、推理时增强(test-time scaling)、蒸馏出更好训练数据的常用招。它的软肋也很明确:N 越大质量上限越高,但成本线性上涨(要多生成 N 倍);而且它**只和打分器一样好**——打分器有偏差或能被钻空子,择出来的"最优"就可能是投机取巧的结果(reward hacking)。',
    guess: {
      q: 'Best-of-N 采样 N 个候选后，靠什么选出最终输出？',
      opts: ['一个打分器(奖励模型或验证器)给每个打分，取最高分', '让这 N 个候选互相投票选出多数'],
    },
    tasks: [
      { act: '按「下一步」采样', watch: '候选一个个冒出、各自打分,★最高分实时更新' },
      { act: '想它和自洽的区别', watch: '自洽数票(多数投票)、Best-of-N 看分(打分器择优)' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; cands?: { e: string; reward: number }[]; bestIdx?: number; n?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      const best = s.cands?.[s.bestIdx ?? 0]
      return {
        pick: 0,
        say: `采样 ${s.n} 个候选、逐个打分,取最高分「${best?.e}」(${best?.reward} 分)——多采几个、挑最好的。`,
        why: `Best-of-N=采样 N 个 + 打分器(奖励模型/验证器)评分 + argmax 取最高,用算力换质量。和自洽的多数投票不同:靠外部打分器选单个最好,适合开放式生成。是 RLHF/推理增强常用招;N 越大越好但越贵,还只和打分器一样好(小心 reward hacking)。`,
      }
    },
  },
  tot: {
    care:
      '前面几种增强推理的办法,都还没跳出"线"的框架:思维链(CoT)让模型一步步想,但只走**一条**线,中间错一步就步步错、没有回头路;自洽采**多条**推理链再投票,可每条链**内部仍是一条直线**,互不干涉。面对真正需要**探索和试错**的难题(24 点、字谜、走迷宫、规划),这还不够——你需要能"想几条路、比一比、走最有希望的,走不通再退回来换一条"。**思维树(Tree of Thoughts, ToT)** 就是把推理从"线"升级成"树"。'
      + '它的做法是把问题的**中间状态**当作树的**节点**,然后在三件事上做文章:**生成**——每一步不只产生一个想法,而是**扩展出多个候选分支**;**评估**——引入一个**评估器**给每个分支判断前景(这条路还有没有希望通向解:sure / maybe / impossible),给分支打分;**搜索**——像经典的树搜索那样广度或深度优先地推进,**剪掉**没希望的分支、沿有希望的往下展开,走进死胡同还能**回溯**换另一条。这几乎就是人下棋时"在脑子里推演好几步、砍掉臭棋、只深算有前途的变化"的过程。'
      + '本实验用一个 24 点小例子:用 [4, 3, 2] 凑出 24。从根节点出发,ToT 生成 5 个想法(各挑两个数做一次运算):4×3=12 剩 {12,2}、4×2=8 剩 {8,3}、3×2=6 剩 {6,4} 这三条,剩下的两个数还能乘到 24,评估为**有希望(sure)**;而 4+3=7 剩 {7,2}、4−3=1 剩 {1,2} 这两条,两个数怎么都凑不出 24,评估为**死路(impossible)**。于是把两条死路**剪掉**,沿一条有希望的往下展开——{12,2} → 12×2=24,**找到解**,完整路径 4×3=12、12×2=24。要是这条走不通,还能回溯去试 {8,3} 那条。每一步的算式和评估都能手算核对。'
      + '看懂这条,你就理清了增强大模型推理的一条清晰阶梯:从 CoT 的**单条线**,到自洽的**多条独立线 + 投票**,再到 ToT 的**带评估与回溯的搜索树**——一步步把"探索、比较、剪枝、回溯"这些人类解难题时的思维动作,显式地交给了搜索过程。它本质上就是把经典的树搜索(BFS/DFS,乃至你学过的 A\* 那种带评估函数的搜索)搬到了"想法"这个层面,让大模型既当**生成器**(产出想法分支)、又借一个评估器当**启发函数**。它擅长那些答案不能一蹴而就、需要规划和试错的问题;代价也很实在:分支多、每个分支都要评估,调用模型的次数远多于一条链,更慢更贵。所以它是"拿大量算力换难题上的成功率"——和 Best-of-N、自洽一样,都是推理时用计算换性能的思路,只是 ToT 把这份计算花在了**结构化的搜索**上。',
    guess: {
      q: '思维树 ToT 相比思维链(CoT)最关键的新增能力是什么？',
      opts: ['每步生成多个想法分支，评估前景、剪掉死路、还能回溯搜索', '把每一步都算得更慢更仔细'],
    },
    tasks: [
      { act: '按「下一步」建树', watch: '生成分支→评估前景→剪掉死路→沿有希望的搜到解' },
      { act: '对比 CoT/自洽', watch: 'CoT 一条线、自洽独立多线,ToT 是能评估+剪枝+回溯的树' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; solution?: string; target?: number; thoughts?: { pruned: boolean }[] }>(trace)
      if (!s || s.phase !== 'done') return null
      const pruned = s.thoughts?.filter(t => t.pruned).length ?? 0
      return {
        pick: 0,
        say: `展开想法树、评估各分支、剪掉 ${pruned} 条死路,沿有希望的搜到解:${s.solution}=${s.target}。`,
        why: `ToT 把推理组织成树:每步生成多个想法分支→评估器判前景→剪掉没希望的→沿有希望的搜索(可回溯)。比 CoT 单线、自洽独立多线更进一步,本质是把想法层面的树搜索(BFS/DFS/带评估的搜索)交给模型+评估器。擅长探索/试错/规划的难题;代价是分支多、更贵更慢。`,
      }
    },
  },
  mcts: {
    care:
      '围棋被称为 AI 的圣杯,难就难在**走法爆炸**:每一步有几百种选择,一盘棋走到底的可能性比宇宙原子还多。国际象棋能靠"暴力搜索+评估函数"硬算,可围棋没人写得出好的评估函数,minimax 那套也算不动。**蒙特卡洛树搜索(MCTS)** 是破局的关键——它不靠人类的棋理,而是靠**随机模拟 + 统计**,把有限的算力,花在最有希望的走法上。'
      + '它维护一棵搜索树,每个节点(局面)记两个数:被**访问了多少次 N**、其中**赢了多少**。然后一轮一轮地做四件事:①**选择**——从根节点出发,按一个叫 **UCB** 的公式往下挑分支,直到一个还没充分展开的节点;②**扩展**——给它添一个新的子节点(一步新走法);③**模拟(rollout)**——从这个新局面开始,**随机地**把棋走到分出胜负;④**回传(backprop)**——把这盘的输赢,更新回刚才走过的每一个节点的 N 和胜数。'
      + '灵魂在第①步的 UCB 公式:**UCB = 胜率 + c·√(ln N_父 / N_子)**。前一项是"**利用**"——胜率高的走法值得多试;后一项是"**探索**"——被试得少的走法,这项会很大,提醒你别漏了它(还没试过的,UCB 直接是 ∞,必被先试一次)。两项一加,就在"多用已知的好走法"和"多探没试过的走法"之间取得平衡。反复几千上万轮之后,真正好的走法会被**反复模拟、访问数飙升**,而差的走法自然被冷落;最后,**选访问次数最多的那个走法**落子。'
      + '本实验用一个最小的例子看清这套逻辑:根节点有 3 个候选走法 A、B、C(设定 A 是好棋、B/C 是坏棋)。你会看到 UCB 先逼着把三个都试一遍(未访问=∞),然后因为 A 总能模拟出"赢",它的 UCB 一直最高,火力**集中到 A**;6 轮之后 A 被访问了 4 次(全赢)、B 和 C 各只 1 次(输)——于是选 A。每一步的 UCB 都能手算核对。'
      + '看懂这条,你就摸到了 **AlphaGo / AlphaZero 的引擎**。真实的 AlphaGo 在 MCTS 的基础上,用神经网络替代了两处:一个"策略网络"给出每步的**先验概率**(该往哪些方向探),一个"价值网络"替代随机 rollout 直接**估局面胜率**(不用真的走到底)——但骨架仍是这套"选择-扩展-模拟-回传"的树搜索。它和你建过的**思维树 ToT** 是一家人(都是带评估的树搜索),也和强化学习血脉相连(都在做"序列决策、从结果反推价值")。从下棋到机器人规划,凡是"步数太多、要在庞大的可能性里聪明地搜索"的问题,背后常常站着 MCTS。',
    guess: {
      q: 'MCTS 的 UCB 公式(胜率 + c·√(ln N父/N子))在平衡什么？',
      opts: ['利用(胜率高的多试)与探索(试得少的也要试)', '只挑当前胜率最高的走法反复走'],
    },
    tasks: [
      { act: '按「下一步」模拟', watch: '每轮挑 UCB 最大的走法(没试过=∞先试)、随机模拟、回传更新访问数' },
      { act: '看火力集中', watch: 'A 总赢 → 被越选越多、圆越来越大;探索与利用的平衡' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; moves?: string[]; n?: number[]; best?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `靠随机模拟+UCB,几轮就把访问集中到好走法:${(s.moves ?? []).map((m, k) => `${m}=${s.n?.[k]}`).join(' ')} → 选 ${s.moves?.[s.best ?? 0]}。`,
        why: `MCTS 每轮:选择(UCB=胜率+c·√(ln N父/N子),平衡利用与探索)→扩展→模拟(随机走到底)→回传(更新 N、胜数)。好走法被反复模拟、访问飙升,选访问最多的。不需评估函数、靠统计说话。AlphaGo/AlphaZero 引擎(配策略/价值网络),和思维树 ToT 一脉相承。`,
      }
    },
  },
  collision: {
    care:
      '这是**物理学科的第一个实验**,也是一次可视化方式的升级——前面算法学科的实验是"一步一步、每个数都能手算"的静态图解,而物理世界是**连续、实时、会动**的。所以这个实验不再预先算好逐帧轨迹,而是直接在你面前**实时运行一个开源物理引擎(Matter.js)**:一盒小球,自由地弹来弹去。'
      + '它讲的物理原理,是最深刻也最优雅的一条——**守恒律**。盒子里的小球做**弹性碰撞**(无摩擦、四壁完美反弹)。每一次碰撞,都会把**动能**和**动量**在两个球之间重新分配:被撞的球加速、撞人的球减速,单看任何一个球,它的速度杂乱无章、时快时慢。但奇妙的是——如果你把**所有球的动能加起来、把所有球的动量(带方向)加起来**,这两个总量**始终不变**。乱中有恒,这就是能量守恒和动量守恒。'
      + '上方的读数会**实时**显示这两个总量:不管小球怎么碰、碰多少次,总动能和总动量的数字基本纹丝不动(引擎用数值积分,会有极小的漂移,这也是真实仿真的诚实之处)。你可以**拖动**任意一个球把它甩出去,看它把动量传递下去;可以**加球**看多体碰撞有多热闹;可以打开**重力**,这时竖直方向不再守恒、小球会一颗颗落到底部堆叠起来。'
      + '看懂这条,你收获的不只是一个物理知识点,更是一种看世界的眼光:纷繁变化的表象之下,往往藏着不变的守恒量,而物理学的力量,正在于找到这些"不管怎么折腾都不变"的东西。而从做法上,它也回答了一个问题——像粒子先生、NB 实验室那样**可交互的实时仿真**,我们用开源物理引擎就能做到,不必从零手写物理。这正是物理、化学、生物这些空间性、连续性的学科该走的可视化路子:把看不见的规律(守恒律、场、分子运动),变成看得见、摸得着、能上手拨弄的沙盘。',
    guess: {
      q: '一盒小球做无摩擦弹性碰撞，单个球速度乱变，什么量始终不变？',
      opts: ['所有球的总动能、总动量（守恒）', '每个球各自的速度'],
    },
    tasks: [
      { act: '拖一个球甩出去', watch: '它撞到别的球把动能/动量传过去,但上方总动能读数基本不变' },
      { act: '加球 / 开重力', watch: '多体碰撞更热闹;开重力则球落到底部堆叠、竖直方向不再守恒' },
    ],
    verdict: () => null,
  },
  gcn: {
    care:
      '前面见过的网络,吃的都是**规整**的数据:一张图是固定网格、一句话是有序的词。可现实里有大量数据是**图**——社交网络(人是节点、好友是边)、分子(原子是节点、化学键是边)、知识图谱、交通网。图的麻烦在于:节点数不固定、每个节点的**邻居数还各不相同**,没有整齐的行列,普通卷积/全连接根本套不上。**图卷积网络(GCN)** 就是把神经网络搬到图上的办法。'
      + '它的核心思想朴素而有力:**每个节点通过聚合邻居的信息,来更新自己的表示**。最简单的一层就是**邻域平均**——把"**自己 + 所有邻居**"的特征取平均,当作这个节点的新特征(真实的 GCN 还会把平均后的结果乘上一个可学习的权重矩阵 W、再过一个激活函数,但"聚合邻居"这一步是灵魂)。这样一来,每个节点的新表示里,就融进了它**一跳邻居**的信息。'
      + '本实验:一张 5 个节点的小图,一开始只有节点 0 和 4 带着特征值 1(可以想成"这两个点是已知的、有标签的"),其余为 0。你会看到 GCN 一层是怎么逐个节点做的:节点 0 把自己(1)和邻居(1、2 的特征)平均、节点 2 把自己和三个邻居平均……每个平均值都能手算。做完一层,那两个"1"就顺着边**渗**给了邻居,相连的节点变得相似——信息沿边传播了一跳。'
      + '关键在于**叠层**:一层传一跳,叠 L 层信息就传 L 跳,第 L 层每个节点的表示,概括了它 L 跳以内的整个子图结构。这正是 GCN 的威力所在——它让"图上的结构"变成了可以学习的特征。它是**节点分类**(判断一个用户/分子节点属于哪类)、**推荐系统**(用户-商品图)、**分子性质预测**(药物发现)的核心工具,和词向量、注意力同属"**表示学习**"这一大家族:都是把离散的东西(词、节点)嵌进连续向量空间,让机器能对它们做运算。理解了"聚合邻居"这一下,你就握住了整个图神经网络(GNN)的钥匙。',
    guess: {
      q: 'GCN 一层，每个节点的新特征怎么来的？',
      opts: ['把自己+所有邻居的特征聚合（如求平均）', '只看自己原来的特征、跟邻居无关'],
    },
    tasks: [
      { act: '按「下一步」逐个聚合', watch: '每个节点把自己+邻居的特征平均;节点 0、4 的"1"顺边分给邻居' },
      { act: '想叠多层', watch: '一层传一跳,叠 L 层传 L 跳——节点表示概括越来越大的邻域' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; newFeat?: (number | null)[] }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `一层聚合后,信息沿边渗了一跳:新特征 [${(s.newFeat ?? []).join(', ')}]——节点 0、4 的"1"分给了邻居,相连节点变相似。`,
        why: `GCN=每个节点聚合(自己+邻居)的特征更新自己(如邻域平均,再乘权重 W 过激活)。一层传一跳、叠 L 层传 L 跳,节点表示概括 L 跳子图。是节点分类、推荐、分子性质预测的核心;和词向量、注意力同属表示学习。`,
      }
    },
  },
  pagerank: {
    care:
      '互联网上有亿万个网页,搜索时怎么决定哪个排在前面?光看"包含关键词的次数"太容易作弊了。Google 靠一个叫 **PageRank** 的算法起家,它的洞见极其漂亮:**一个网页的重要性,取决于有多少、以及多重要的网页链接到它**。链接就像投票——但不是一人一票,**重要网页投出的票更值钱**。这是一种"重要性会传染"的循环定义:重要的页面链接你,你也变重要;而你重要了,你链接的页面也跟着沾光。'
      + '这种"你中有我、我中有你"的循环,靠**幂迭代**来解开。做法是:先给每个页面一个相同的初始分(rank),然后一轮轮更新——每个页面把自己当前的 rank **平分**给它链出去的所有页面(把票投出去),每个页面的新 rank,就是**所有投给它的票之和**。为了防止重要性陷进一个小圈子里出不来(比如两个页面互相链、把分越滚越高),还要混入一点"随机跳转"——用**阻尼系数 d=0.85** 调和:85% 顺着链接走、15% 随机跳到任意页面。这样反复迭代,每个页面的 rank 会**收敛到一个稳定值**。'
      + '本实验:4 个网页 A、B、C、D 互相链接(箭头就是链接)。一开始每页 rank 都是 0.25,你会看到幂迭代每一轮把重要性顺着箭头**流动、重新分配**——节点越大代表 rank 越高。重要性会在互链的页面间来回**荡**几下(这很正常),几轮后稳定下来:**C 最高**,因为 A、B、D 三个页面都链到它、而且来源本身也重要;**D 最低**(0.038),因为没有任何页面链接它。每一轮的 rank 都能对着"平分求和"手算核对。'
      + '看懂这条,你收获的远不止一个搜索算法。PageRank 有一个深刻的等价解释:想象一个"**随机上网者**",他从某页出发,不停地随机点击链接(偶尔随机跳到别处),那么无穷次点击之后,他停留在每个页面的**概率**,恰好就是该页的 PageRank——它是**图上随机游走的稳态分布**。这个"用随机游走的稳态来度量节点重要性"的思想威力无穷:社交网络里找影响力最大的人、学术引用网络里评估论文/期刊、推荐系统、甚至自然语言里给句子中的词排重要性(TextRank 做关键词提取),用的都是同一台引擎。它和你在图算法里学的图遍历是近亲——只不过遍历是确定地走遍,PageRank 是**随机地游走求稳态**。',
    guess: {
      q: 'PageRank 判断一个网页重要不重要，主要看什么？',
      opts: ['有多少、多重要的页面链接到它（重要页面的票更值钱）', '这个页面本身包含关键词的次数'],
    },
    tasks: [
      { act: '按「下一步」迭代', watch: '每轮重要性顺箭头流动、重新分配;节点大小实时变' },
      { act: '看谁胜出', watch: 'C 被最多、最重要的页面链到 → 收敛后 rank 最高;D 没人链 → 最低' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; ranked?: { name: string; r: number }[] }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `幂迭代收敛,排名 ${(s.ranked ?? []).map(x => x.name).join(' > ')}:${s.ranked?.[0].name} 最高——被最多、最重要的页面链到。`,
        why: `PageRank:页面重要性=有多少、多重要的页面链它(链接=加权投票)。幂迭代:每页把 rank 平分给链出页、收方求和+阻尼 d=0.85(混随机跳转防死循环)。收敛值=随机上网者停在各页的概率(图上随机游走稳态)。搜索排序、影响力分析、TextRank 都是它。`,
      }
    },
  },
  qlearn: {
    care:
      '前面的机器学习,都是"给了标准答案再学"(监督学习)。但很多问题没有标准答案,只有**一连串决策后的好坏反馈**:下棋、开车、机器人走路、玩游戏——你不知道"这一步的正确落子",只知道最后是赢是输。**强化学习(RL)** 就是为这类问题而生的:让一个**智能体**在环境里**试错**,做对了给**奖励**、做错了给惩罚,目标是学会一套能拿到最多奖励的**策略**。'
      + '它最核心的难点,是**奖励往往是延迟的**。走迷宫,只有走到终点才 +1 分,中间几十步全都没有任何反馈——那你怎么知道,是哪一步走对了、才最终拿到了这 +1?这就是"信用分配"问题。**Q-learning** 给了一个漂亮的答案:不要只盯着眼前的即时奖励,而是给每一个**状态**(这里是每个格子)估一个**价值**——从这里出发,未来总共能拿到多少回报。'
      + '价值靠一条叫 **Bellman** 的规则来更新:一个格子的价值 = 走一步的即时奖励 + γ ×（走到的下一格的价值）。这里的 **γ(折扣因子,取 0.9)** 意思是"未来的奖励要打折"——离终点越远、要走的步数越多,拿到那 +1 就越"打折"。于是终点的那个 +1,会顺着这条规则**一圈一圈地倒推**开来:紧挨终点的格子价值 0.9、再外一圈 0.81、再外 0.729……每远一步乘一次 γ。本实验你会看到这个过程:价值像**波纹**一样从终点扩散出来,填满整张地图。'
      + '价值一旦学好,**策略**就是显然的:站在任何一个格子,**往价值最高的那个邻居走**——你会看到每格的箭头都自动指向了通往终点的方向,从起点跟着箭头走,就是最优路线。最妙的是:Q-learning 靠**反复走迷宫、用 Bellman 规则一点点更新**,就能自己学出这套价值和策略,**完全不需要提前知道地图长什么样**——它是在试错中"悟"出来的。'
      + '看懂这条,你就握住了强化学习的核心直觉:**用"未来总回报的估计"来指导当下的每一步,让延迟的奖励能倒推回来影响早期的决策。**它是当今 AI 最热的方向之一:AlphaGo 用它战胜人类围棋冠军(把落子当动作、胜负当奖励)、机器人靠它学会走路和抓取、推荐系统用它优化长期留存,而你天天用的**大模型,也是靠 RLHF(基于人类反馈的强化学习)对齐**的——把"人类更喜欢哪个回答"当奖励信号。理解了这个走迷宫的小例子,你就摸到了这一切背后共同的那套逻辑,也踩在了 AI 求职最热的一块门槛上。',
    guess: {
      q: 'Q-learning 里，一个格子的"价值"指什么？',
      opts: ['从这里出发、未来总共能拿到的回报（打折后）', '当前这一步立刻拿到的奖励'],
    },
    tasks: [
      { act: '按「下一步」看倒推', watch: '价值从终点一圈圈往外传,每远一步×γ=0.9(0.9→0.81→0.729…)' },
      { act: '看策略箭头', watch: '每格箭头指向价值更高的邻居——跟着走就是最优路线,不用提前知道地图' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; path?: string[]; gamma?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `没人教、靠试错 + Bellman 倒推,自己学出了价值和策略:跟着箭头从起点走到终点=最优 ${(s.path?.length ?? 1) - 1} 步。`,
        why: `强化学习=智能体试错拿奖励、学最优策略。奖励延迟(只有终点+1),Q-learning 给每状态估价值(未来总回报),用 Bellman(价值=即时奖励+γ×下一格价值)把奖励一圈圈倒推,策略=往价值高处走,不用提前知道地图。AlphaGo、机器人、推荐、大模型 RLHF 都是它。`,
      }
    },
  },
  recsys: {
    care:
      '刷抖音、逛淘宝、开 Netflix,首页那一排"猜你喜欢"是怎么来的?核心难题是:每个用户只对**极少数**物品打过分/点过赞,那张"用户 × 物品"的评分表**大半都是空的**——平台要猜的,正是这些空缺:你**没看过**的电影,你会打几分?**矩阵分解(协同过滤)** 是解这个问题最经典的办法。'
      + '它的洞见很漂亮:一个人的喜好、一部电影的属性,其实都能压进一个**低维的"隐空间"**。给每个用户学一个**隐向量**(表示他各方面口味有多重),给每部电影也学一个**隐向量**(表示它各方面属性有多强),然后让 **评分 ≈ 用户隐向量 · 电影隐向量**(两个向量的内积)。内积大,说明用户的口味和电影的属性"对得上",分就高;对不上,分就低。'
      + '本实验为了看得清,把隐向量取成两条**可解释**的轴——用户是(爱动作,爱文艺)、电影是(动作度,文艺度)。于是:小明=(1,0) 只爱动作,复仇者=(5,0) 纯动作,内积=5 分(满分);小明看小森林=(0,5) 纯文艺,内积=0(不对味)。这些**已知评分都能被内积复现**,说明这套隐向量抓对了。那么小明**没看过**的盗梦空间=(4,3)(动作+烧脑)呢?内积 = (1,0)·(4,3) = 1×4+0×3 = **4 分**——预测出来了。每一个预测都是一次内积,能手算核对。'
      + '看懂这条,你就理解了推荐系统的心脏。真实的系统里,隐向量不是手工指定的两维,而是**几十上百维、从海量评分里自动学出来**的(用梯度下降让内积尽量对上已知评分),那些维度没有名字,但机器自己发现了"口味/属性"的结构。这一步和你学过的**词向量**是同一种精神——都是**把离散的对象(用户、物品、词)嵌进一个连续的低维空间**,让"相似/合拍"变成可计算的几何(内积/距离),也和 PCA 那种"低维分解"一脉相承。Netflix Prize、淘宝、抖音、Spotify 的推荐,底子里都有它;后来的深度推荐、双塔模型,也都是这个"学隐向量、算内积"思想的延伸。',
    guess: {
      q: '矩阵分解怎么预测你对没看过的电影的评分？',
      opts: ['用你的隐向量 · 电影的隐向量（内积）', '取所有人对这部电影评分的平均'],
    },
    tasks: [
      { act: '按「下一步」分解', watch: '露出用户口味向量、电影属性向量;已知评分=它们的内积' },
      { act: '看预测空缺', watch: '小明·盗梦=(1,0)·(4,3)=4 分;口味和属性合拍就推荐' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; rating?: (number | null)[][]; pr?: number; pc?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `把用户和电影都嵌进隐空间,用内积补全评分表:小明·盗梦=4 分(推荐)、小明·小森林=0(不推)。`,
        why: `矩阵分解=给用户/物品各学一个隐向量,让 评分≈内积;已知评分学隐向量、空缺内积预测。口味和属性对得上=内积大=推荐。和词向量同属把对象嵌进隐空间的表示学习、和 PCA 同是低维分解。Netflix/淘宝/抖音"猜你喜欢"的经典底子。`,
      }
    },
  },
  diffusion: {
    care:
      'AI 是怎么"画"出一张从没存在过的图的?文生图(Stable Diffusion、DALL·E)、文生视频(Sora)背后,大多是**扩散模型**。它的思路绝妙,可以一句话概括:**先教会 AI 破坏,再教会它修复;然后让它反着来。**'
      + '分两个过程。**前向过程**很简单、而且不用学:拿一张真实图片,一小步一小步地往里掺**高斯噪声**——每一步 x = √ᾱ·原图 + √(1−ᾱ)·噪声,ᾱ 从 1 慢慢降到接近 0,于是"信号"越来越弱、"噪声"越来越强,几十步之后,原图彻底变成了一团**纯噪声**。这一步是固定的数学操作,你能手算每一步保留了多少信号(√ᾱ)、掺了多少噪声(√1−ᾱ)。'
      + '**反向过程**才是真本事、需要训练:让一个神经网络专门学一件事——**看着某一步的带噪图,预测里面掺了多少噪声,然后把它减掉**,还原出更清晰的上一步。把这个"去噪一步"反复做,网络就能从一团**纯随机噪声**出发,一步步把噪声"磨"掉,最后浮现出一张**清晰、且以前不存在**的新图。加噪是死板的、可算的;去噪是网络从百万张图里学来的。**沿着加噪的路反着走,噪声就变成了创作。**'
      + '本实验用一张 8×8 的小图(一颗 ❤)让你看清这条路:前向,你会看到它一步步被噪声淹没,√ᾱ 从 1 降到 0.14、图渐渐糊成噪点;反向,从噪声出发,网络一步步去噪,❤ 又慢慢浮现出来。前向的每一步都能手算核对,反向这里演示的是恢复过程(真实里由训练好的网络完成)。'
      + '看懂这条,你就摸到了当今生成式 AI 图像/视频这一支的心脏。真实的扩散模型跑几十到上千步、在**上亿张图**上训练,而且能**按条件生成**——给它一句"一只戴帽子的猫",它就在去噪的每一步都朝"猫 + 帽子"的方向修正,于是生成出符合描述的图,这就是文生图。它和你学过的采样解码是一家人(都是"生成"——从分布里造出新样本),也用到了你熟悉的高斯噪声和反向传播(去噪网络就是靠它训练的)。从 Stable Diffusion 到 Sora,这套"加噪—去噪—反着生成"的框架,是这几年 AI 最耀眼、也是求职最热的方向之一。',
    guess: {
      q: '扩散模型是怎么"生成"一张新图的？',
      opts: ['从纯噪声出发，让网络一步步去噪，图像浮现', '把训练集里最像的一张图直接复制出来'],
    },
    tasks: [
      { act: '按「下一步」看加噪', watch: '前向每步 x=√ᾱ·原图+√(1−ᾱ)·噪声,图渐渐变纯噪声' },
      { act: '看反向去噪', watch: '网络一步步去噪,图像从噪声里浮现——这就是生成' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `前向把图加噪成纯噪声(可算),反向让网络一步步去噪、从噪声里"磨"出一张新图——这就是生成。`,
        why: `扩散=前向加噪(x=√ᾱ·x₀+√(1−ᾱ)·ε,固定不用学)+ 反向去噪(网络预测并减掉噪声,学来的)。从随机噪声去噪就=生成新图,还能按文字条件生成。和采样解码同属生成、用高斯噪声与反向传播。Stable Diffusion/DALL·E/Sora 底层。`,
      }
    },
  },
  gan: {
    care:
      '扩散模型是靠"加噪—去噪"来生成的,而在它之前,另一个绝妙的生成思路统治了好几年——**生成对抗网络(GAN)**。它的核心是一场**博弈**:让两个神经网络当对手,在互相较劲中把彼此逼强。'
      + '两个角色。**生成器 G**:一个"造假者",从随机噪声出发,努力生成看起来像真数据的假样本。**判别器 D**:一个"鉴定师",看到一个样本,判断它是**真数据**还是 **G 造的假货**。关键在于它们的目标**完全对立**:G 想方设法**骗过 D**(让 D 把假的当成真的),D 则拼命**抓住 G**(把假的挑出来)。训练时两者轮流进步——D 抓得越准,就逼着 G 造得越逼真;G 造得越逼真,又逼着 D 练就更毒的眼力。这是一场你追我赶的**军备竞赛**。'
      + '这场竞赛会走向一个漂亮的**均衡**:当 G 造的假数据的分布,和真数据的分布**完全一样**时,D 就再也没办法区分了——它的判别准确率会掉到 **50%**,也就是只能**瞎猜**。到了这一步,G 生成的东西已经以假乱真,GAN 就训练成功了。'
      + '本实验把这个过程画出来:真数据(蓝点)聚在一处,G 造的假数据(红点)一开始**乱撒**在别处,D 一眼就能看穿(准确率高)。随着对抗训练,你会看到红点一轮轮**逼近**蓝点的分布、混进"D 认作真的"那个圈里,骗过 D 的假数据越来越多,D 的准确率就从 100% 一路往 **50%** 掉。每一轮的准确率 =(真的被判真 + 假的被判假)/ 总数,能手算核对。'
      + '看懂这条,你就理解了生成式 AI 的另一条主线,也见识了"对抗"这个威力巨大的思想。GAN 是深度学习图像生成的**里程碑**:逼真到吓人的假人脸(thispersondoesnotexist)、图像风格迁移、老照片修复、超分辨率,早期大多出自 GAN。它训练起来有名地难(两个网络容易失衡、模式崩溃),后来在图像生成的王座上被更稳定的**扩散模型**接替——但"两个网络对抗着一起变强"的思想,已经渗进了 AI 的许多角落。它和你学过的分类器是近亲(判别器 D 本质就是个真假二分类器),也和扩散模型同属"生成模型"大家族,是 AI 求职绕不开的经典。',
    guess: {
      q: 'GAN 训练成功(G 学会以假乱真)的标志是什么？',
      opts: ['判别器 D 再也分不出真假、准确率掉到 50%（瞎猜）', '判别器 D 的准确率升到 100%'],
    },
    tasks: [
      { act: '按「下一步」对抗', watch: 'G 造的红点逐轮逼近蓝点,混进虚线圈骗过 D' },
      { act: '看 D 准确率', watch: '假越像真,D 越难分,准确率从 100% 掉到 50%——掉到 50% 就是 G 赢了' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; acc?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `G 和 D 对抗到均衡:假数据逼近真分布、D 准确率掉到 ${s.acc}%(瞎猜)——G 学会了以假乱真。`,
        why: `GAN=生成器 G(造假骗 D)+ 判别器 D(鉴真假)对抗博弈,目标完全对立、轮流进步。均衡处 G 的假分布=真分布、D 准确率→50%(瞎猜)=G 赢。判别器就是个真假二分类器;和扩散同属生成模型。早期图像生成里程碑(逼真人脸/风格迁移),训练难、后被扩散接替。`,
      }
    },
  },
  conv: {
    care:


      '一张图有成千上万个像素。要是像全连接那样给每个像素配一个权重,参数会爆炸,而且换个位置的同一个物体就不认得了。**卷积**用一个绝妙的办法绕开这两个问题。'
      + '它拿一个很小的**卷积核**(比如 3×3 的一组权重),在整张图上**滑窗**:每滑到一处,就把核和底下那一小块像素**逐位相乘再相加**(一个点积),得到一个数;把所有位置的结果拼起来,就是一张**特征图**。关键有二:同一个核**共享权重**扫遍全图,所以参数极少;而且它**平移不变**——图上不管哪个位置出现了这个特征,都会被同一个核认出来。'
      + '不同的核提取不同的特征:**边缘核**在明暗交界处响应最强、**模糊核**求邻域平均把图抹平、**锐化核**突出中心压低四周。本实验:一张 5×5 的图(左暗右亮,一条竖直边缘),你可以换核,看 3×3 卷积核滑过 9 个位置、逐格填出特征图——边缘核会在那条边缘上亮起来。'
      + '看懂这条,你就理解了 CNN"看图"的底层:把很多层卷积叠起来,浅层的核学到边缘、纹理,深层的核把这些拼成眼睛、轮子、物体。图像分类、目标检测、语义分割,全都建在这个"小窗口滑过图像"的操作上。它本质就是点积/内积在图像上的批量应用。',
    guess: {
      q: '卷积核在图上滑窗，每滑到一处做什么？',
      opts: ['核和底下像素逐位相乘再相加(点积)', '取窗口里的最大像素'],
    },
    tasks: [
      { act: '按「下一步」让核滑窗', watch: '蓝框在输入图上移,特征图逐格填出' },
      { act: '换「卷积核」', watch: '边缘核交界处亮、模糊抹平、锐化提中心' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; kernelName?: string }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `${s.kernelName}核滑完 9 处、生成特征图:${s.kernelName === '边缘' ? '在明暗交界响应最强、平坦≈0,"看见"了边缘' : s.kernelName === '模糊' ? '把边缘抹平' : '把边缘提亮'}。`,
        why: `卷积=小核滑窗做点积生成特征图。同一个核共享权重扫全图:参数少、平移不变。多层叠起来浅层看边缘、深层拼物体——这就是 CNN 看图的底。`,
      }
    },
  },
  linreg: {
    care:
      '"机器学习"听着玄,最基础的那一步其实就是**拟合一条线**。给你一堆散点 (x,y),找一条直线 y=wx+b,让它离所有点尽量近。'
      + '"近"怎么量?用**均方误差 MSE**:每个点到直线的**竖直距离**(残差)平方,再求平均。于是"学习"变成一个明确的优化问题:调 w、b 让 MSE 最小。'
      + '怎么调?从随便一条线出发(w=b=0),对 MSE 求梯度,**沿负梯度**一点点挪 w、b——这就是梯度下降在做回归。妙的是线性回归有**闭式最优解**(最小二乘 OLS),梯度下降会稳稳收敛到它。'
      + '本实验:12 个散点(真线约 y=2x+1 加噪声)。你会看到直线从平的一步步转进点云、每个点的残差(红竖线)一根根变短、MSE 从 8.8 降到 0.14,w→2.22、b→0.92,正好等于最小二乘算出来的最优线。'
      + '看懂这条,你就抓住了几乎所有 ML 训练的**骨架**:定一个损失、对参数求梯度、沿负梯度更新、直到拟合。后面的逻辑回归、神经网络,都是这套骨架换更复杂的模型和损失而已。它坐在「梯度下降」之上。',
    guess: {
      q: '一堆散点，怎么找"最贴合"的直线？',
      opts: ['让点到线的竖直距离平方和(MSE)最小，梯度下降调 w、b', '连接首尾两点即可'],
    },
    tasks: [
      { act: '按「下一步」推进梯度下降', watch: '直线转进点云、残差变短、MSE 降' },
      { act: '看收敛', watch: 'w→2.22、b→0.92 = 最小二乘闭式解' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; w?: number; b?: number; mse?: number; wOls?: number; bOls?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `梯度下降后直线 y=${s.w}x+${s.b}、MSE **${s.mse}**,正好=最小二乘 OLS(w=${s.wOls} b=${s.bOls})。`,
        why: `损失=MSE、沿负梯度调 w、b,收敛到数学最优线。这就是机器学习最朴素的骨架:定损失→求梯度→沿负梯度更新→拟合。逻辑回归、神经网络都是它的加强版。`,
      }
    },
  },
  pp: {
    care:
      '模型太大放不下一张卡,除了切注意力头(TP)、切专家(EP),还有一条最直观的路:**按层切**。把连续的几层放一张卡,首尾接成一条 **G 级流水线**——卡0 算前几层、卡1 算中间几层、…、卡G-1 算最后几层。'
      + '问题来了:如果只喂**一个 batch**,它在流水线里一级一级往下走,**同一时刻只有一张卡在干活**,其余全在干等。利用率只有 **1/G**,大量时间浪费在**流水线气泡**(空闲)上——G=4 时气泡高达 75%。'
      + '解法和工厂流水线一模一样:**把 batch 切成 M 个微批**,让它们首尾衔接地流进来。这样稳态时 G 张卡**同时**各处理一个微批,气泡只剩开头"注满流水线"和结尾"排空流水线"那一点点。气泡占比 = **(G−1)/(M+G−1)**:微批越多,气泡越小、利用率越高(M=4→43%,M=8→27%)。当然微批太小会让单次算量太碎、划不来,所以 M 有个甜点。'
      + '本实验:G=4 级流水线,你可以调微批数 M。逐时刻看那张调度表——彩色格是某张卡在算某个微批,灰格就是气泡。你会看到开头的"注入"、中段的"满载"、结尾的"排空"。看懂这条,你就理解了 GPipe/1F1B 这类流水线调度到底在填什么,以及它和指令流水线(同一个"填满流水线"的道理)、张量并行(另一种切法)的关系。',
    guess: {
      q: '4 级流水线只喂 1 个 batch，同一时刻有几张卡在干活？把 batch 切成微批后呢？',
      opts: ['只 1 张（气泡大）→ 切微批后能同时 4 张（气泡小）', '一直都是 4 张都在忙'],
    },
    tasks: [
      { act: '一步步走完一轮', watch: '开头几张卡空等(注入气泡)、中段满载、结尾排空' },
      { act: '把「微批数」调到 8', watch: '气泡从 43% 降到 27%——微批越多越省' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; stages?: number; micro?: number; util?: number; bubblePct?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `${s.stages} 级流水线、${s.micro} 微批:利用率 **${s.util}%**、气泡 **${s.bubblePct}%**((G−1)/(M+G−1))。`,
        why: `只喂 1 个 batch 时同时只有 1 张卡干活、气泡 (G−1)/G;把 batch 切 M 个微批首尾衔接流进来,稳态 G 卡同时各算一个,气泡缩到 (G−1)/(M+G−1)。这就是 GPipe/1F1B 填气泡的核心。`,
      }
    },
  },
  ep: {
    care:
      'MoE(混合专家)把一层里那个巨大的 FFN 换成 **E 个专家**,每个 token 经**路由**只挑其中少数几个来算(稀疏激活)。好处是参数量可以爆炸式增大、而每个 token 的算量几乎不涨。但随之而来一个硬问题:E 个专家的权重**加起来极其庞大**,一张卡根本放不下。'
      + '**专家并行 EP** 的办法:把 E 个专家**分片**到 G 张卡上(每卡放 E/G 个)——显存问题解决了。但代价接踵而至:一个 token 路由挑中的专家,可能在**别的卡**上,于是得先把每个 token **all-to-all 派发**到它专家所在的卡、算完再 all-to-all 收回来(通信);而且路由常常**不均**——某个"热"专家被很多 token 挑中,那张卡就**过载**、别的卡闲着,所以 EP 还得配**负载均衡**(限制每个专家的容量、加辅助损失把 token 摊匀)。'
      + '本实验:8 个 token、8 个专家(top-1 路由,故意让专家 3 偏热),你可以调卡数 G。看 token 怎么路由挑专家、怎么 all-to-all 派到专家所在的卡、每卡负载有多不均。'
      + '看懂这条,你就明白了为什么现代 MoE 大模型服务(如 DeepSeek)把 **DP Attention + EP** 配在一起:注意力权重小、用 DP 零通信;专家权重大、用 EP 分片走 all-to-all——**各切各的,把显存和通信都花在刀刃上**。它坐在 MoE(专家路由)和集合通信(all-to-all)之上,和「DP Attention」是一对搭档。',
    guess: {
      q: 'EP 把专家分到多卡后，一个 token 挑中的专家在别的卡上，会发生什么？',
      opts: ['all-to-all 把 token 派到专家所在的卡（通信）', '就近算，不用跨卡'],
    },
    tasks: [
      { act: '走 路由→派发→算 三步', watch: 'token 按专家 all-to-all 跳到对应卡;热专家那卡负载最高' },
      { act: '调「卡数」', watch: '每卡专家数变(E/G)、负载分布跟着变' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; gpus?: number; expertsPerGpu?: number; maxLoad?: number; minLoad?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `专家分到 ${s.gpus} 卡(每卡 ${s.expertsPerGpu} 个):省显存,代价=all-to-all + 负载不均(最忙 ${s.maxLoad} vs 最闲 ${s.minLoad})。`,
        why: `EP 分片巨大的专家权重省显存,代价是 token 得 all-to-all 跳到专家所在卡 + 热专家造成负载不均(要负载均衡)。所以 MoE 服务常用 DP Attention(零通信)+ EP(分片)——各切各的。`,
      }
    },
  },
  dpattn: {
    care:
      '一台多卡机器同时服务一批请求,注意力这块运算怎么摊到 G 张卡上?有两条路,权衡完全不同。'
      + '**张量并行 TP**:把 H 个注意力头**切开**分到各卡(每卡 H/G 个头),每卡都算**全部请求**。好处是注意力权重也跟着切成 1/G、省显存;坏处是每张卡只算出了一部分头,得**每一层都做一次 all-reduce**把头拼回来——**每层都要跨卡通信**,而通信往往是分布式训练/推理里最贵的一环。'
      + '**数据并行 DP Attention**:反过来,把**请求**切开分到各卡(每卡 B/G 个请求),每卡都算**全部的头**。这样每张卡拿着自己那几个请求,从头到尾独立算完——**注意力这一段零通信**。代价是注意力的权重要**整套复制**到每张卡上。'
      + '关键的取舍在这:TP 用"每层通信"换"省权重显存",DP 用"复制权重"换"零通信"。而**注意力的权重其实很小**(相比整个模型),复制得起;真正巨大、真正需要切的是 **MoE 的专家权重**。所以现代 MoE 服务(比如 DeepSeek 那套)常用 **DP Attention + EP(专家并行)**的组合:便宜的注意力用 DP 避开每层昂贵的 all-reduce、把巨大的专家用 EP 分片——**各切各的,把通信花在刀刃上**。'
      + '本实验固定 B=8 请求、H=8 头,你可以调卡数 G(2/4),对比 TP 和 DP 的每卡分工与通信量。看懂这条,你就明白了为什么"并行策略"不是一刀切,而要看哪块权重大、哪块通信贵。它坐在张量并行和集合通信之上。',
    guess: {
      q: '把注意力按"请求"切到各卡(DP)，而不是按"头"切(TP)，注意力这段的跨卡通信是？',
      opts: ['零（各卡独立算完自己的请求）', '更多（请求多了要同步）'],
    },
    tasks: [
      { act: '走 TP → DP 两步', watch: 'TP 切头要每层 all-reduce;DP 切请求注意力零通信' },
      { act: '调「卡数」', watch: 'TP 每卡头更少(权重更省)、DP 每卡请求更少' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; gpus?: number; tpComm?: number; tpWeight?: string }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `${s.gpus} 卡:TP 切头(权重 ${s.tpWeight})每层 all-reduce ${s.tpComm}/token;DP 切请求注意力**零通信**、复制权重。`,
        why: `TP 省显存但每层通信、DP 零通信但复制权重。注意力权重小复制得起、MoE 专家权重大才需切——所以 DeepSeek 那套用 DP Attention + EP,把通信花在刀刃上。`,
      }
    },
  },
  flashdecode: {
    care:
      'FlashAttention 大家都知道——它在 **prefill**(一次性读进整段 prompt)时,把注意力按 **query** 切块并行:几百上千个 query 一起算,GPU 吃得饱。可到了 **decode**(逐 token 生成),每一步**只有 1 个 query**、却要对**一长串 KV**(几万个历史 token)做注意力。只切 query 就只有 1 份活、GPU 大量闲置,时延被这条长 KV 死死拖住。'
      + '**Flash Decode** 换一个切法:既然 query 只有 1 个,那就切 **KV/序列维**——把长 KV 分成 C 块,C 块**并行**各算一份"局部注意力"(局部最大 mᶜ、局部和 lᶜ、局部加权输出 oᶜ),再用 **online softmax**(拿全局最大 M 把各块的 exp 重新缩放对齐)把 C 份局部结果**无损合并**成全局结果。'
      + '本实验:1 个 query 对 N=8 个 key,切成 C 块(可调 2/4/8)。你会看到每块并行算出局部 (mᶜ,lᶜ,oᶜ),合并后输出和一次性 softmax·V **分毫不差**(不是近似);而时延从顺序扫 ~N 降到并行 **~N/C**。把「KV 分块」调大,时延再降。'
      + '看懂这条,你就明白了长上下文**解码为什么慢、又怎么救**:prefill 切 query、decode 切 KV,合并公式和 FlashAttention 同源。它坐在 FlashAttention 和 KV 缓存之上,是推理引擎压低生成时延(尤其长上下文)的关键一招。',
    guess: {
      q: 'decode 每步只有 1 个 query，把长 KV 切成 C 块并行算再合并，结果会？',
      opts: ['和一次性 softmax 完全相等，且时延降到 ~N/C', '是近似，切越多误差越大'],
    },
    tasks: [
      { act: '把「KV 分块」调到 8', watch: '时延 ~8→~1；合并输出始终 = 一次性 softmax' },
      { act: '看合并那步', watch: '要用全局最大 M 重缩放各块 exp 才无损(online softmax)' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; chunks?: number; output?: number; fullOutput?: number; seqLatency?: number; parLatency?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `KV 切 ${s.chunks} 块并行:时延 ~${s.seqLatency}→~${s.parLatency}，输出 **${s.output}** = 一次性 softmax **${s.fullOutput}**(无损)。`,
        why: `decode 只有 1 个 query，改切 KV 维并行算局部注意力、再 online softmax 无损合并。prefill 切 query、decode 切 KV，合并公式和 FlashAttention 同源——长上下文解码提速的关键。`,
      }
    },
  },
  engram: {
    care:
      '注意力要"回头看"上文,靠的是 QKᵀ 全局打分——又贵(O(N²))、又受上下文窗口限制。可很多"回头看"其实是**重复模式的精确复制**(某个词组后面总跟同一个词),用整套注意力去做太浪费。**Engram 这类 n-gram 记忆模块**给了一条便宜旁路。'
      + '做法很朴素:把出现过的 **n-gram 统计**存成一张哈希表——键是前 n−1 个 token,值是"下一个 token 的计数"。推理时,用当前的 (n−1)-gram 去 **O(1) 查表**,直接拿到"上次/历次它后面跟了什么",再把这个便宜的预测**融合**进模型输出。它的好处很鲜明:查表是常数时间、不随上下文长度变;记忆**不受注意力窗口限制**——哪怕相关信息在几万 token 之前,只要那个 n-gram 出现过就查得到;它把"精确复制"从昂贵的注意力**卸载**到便宜的查表,让注意力腾出手去干更难的语义活。'
      + '本实验:序列 A B C D A B C D A B C,用 trigram(前 2 个→下一个)建表。你会看到表里「A B」→C、「B C」→D…;查询当前 2-gram「B C」→ O(1) 命中 → 预测 D。'
      + '看懂这条,你就明白了为什么它和**归纳头**是"一体两面":两者目标一样(回头找"上次它之后是什么"),但机制相反——归纳头是**学出来的软注意力**(表达力强但贵),Engram 是**显式的非参数化查表**(便宜但只会精确匹配),二者互补。这就是"n-gram 记忆增强 Transformer",也是长上下文里省算力的一条实用路子。',
    guess: {
      q: '序列 …A B C D A B C，用 trigram 记忆表查当前「B C」，预测下一个是？',
      opts: ['D（表里 B C→D，O(1) 查表命中）', '需要跑一遍注意力才知道'],
    },
    tasks: [
      { act: '一步步走', watch: '建表 → 取当前 2-gram「B C」→ O(1) 命中 → 复制出 D' },
      { act: '对比归纳头', watch: '同是"回头找上次它之后"，但这是便宜查表、不是贵的注意力' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ stage?: string; prediction?: string; queryKey?: string; matchCount?: number }>(trace)
      if (!s || s.stage !== 'done') return null
      return {
        pick: 0,
        say: `查表「${s.queryKey}」→ **${s.prediction}**（历史 ${s.matchCount} 次）：一次 O(1) 查表补全重复模式，没动注意力。`,
        why: `n-gram 记忆把"精确复制"从贵的注意力卸载到便宜的查表,O(1)、不受窗口限制。它和归纳头目标像但机制相反(软注意力 vs 显式查表),互补——这就是 n-gram 记忆增强 Transformer。`,
      }
    },
  },
  linattn: {
    care:
      '标准注意力有个致命的规模问题:softmax(QKᵀ)V 要算一个 N×N 的注意力矩阵,**算量是 O(N²)**;而自回归生成还得把每个 token 的 K、V 都缓存下来(**KV 缓存 O(N)**、随上下文线性膨胀)。上下文一长(几万 token),算量和显存双双爆炸——这正是长上下文推理引擎最头疼的地方。'
      + '**线性注意力**换一个思路:用一个核函数 φ 把 softmax(QKᵀ)V 近似成 **φ(Q)·(φ(K)ᵀ·V)**,然后利用**矩阵乘法结合律**——先算括号里的 φ(K)ᵀ·V,它是一个 **d×d 的"状态"矩阵**,概括了到目前为止的全部历史,再让 φ(Q) 去乘它。于是:算量变成 O(N·d²)、随 N **线性**;状态是 **固定大小 d×d**、和序列多长无关;解码时它就是一个 **RNN 式的递推**——每来一个 token 更新固定状态、O(1)/步、常数显存,**再也不用不断膨胀的 KV 缓存**。'
      + '本实验固定 d=64,把 N 从 64 拉到 32768。你会看到 softmax 的算量曲线(N²)陡峭飙升,线性(N)缓缓上抬;右边 KV 缓存条一路膨胀到 4M,线性状态条纹丝不动稳在 4K。交叉点在 N=d:N 短时 softmax 反而省(线性的 d² 常数占上风),N 一长线性完胜(N=32768 时算量差 512×、显存差 1000×)。'
      + '看懂这条,你就明白了 Mamba、RWKV、GLA 这些"线性/状态空间"模型为什么能吃超长上下文、为什么它们的推理是常数显存;代价是 φ 只是 softmax 的近似,拿一点精度换来了算量和显存的量级优势。它坐在注意力和 KV 缓存之上,是长上下文推理绕不开的一条路。',
    guess: {
      q: '序列 N 拉到很长(远超头维度 d),softmax vs 线性注意力,谁的算量和显存更省?',
      opts: ['线性完胜(算量 O(N)、显存恒定)', 'softmax 更省(矩阵一次算完)'],
    },
    tasks: [
      { act: '按「下一步」拉长 N', watch: '红线(N²)越翘越高、蓝线(N)缓;KV 缓存条一直长、线性状态不动' },
      { act: '看 N=32768', watch: '算量差 512×、KV 4M vs 状态 4K' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; ratio?: number; kvMem?: number; stateMem?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      const f = (x: number) => x >= 1e6 ? (x/1e6).toFixed(1)+'M' : (x/1e3).toFixed(0)+'K'
      return {
        pick: 0,
        say: `N=32768:softmax O(N²) 算量与 KV 缓存 ${f(s.kvMem!)} 都爆;线性靠结合律算量差 **${s.ratio}×**、状态恒定 ${f(s.stateMem!)}。`,
        why: `线性注意力用结合律先算 φ(K)ᵀV 的 d×d 固定状态,算量 O(N)、显存恒定、解码变 RNN 式递推——告别膨胀 KV 缓存。代价是 φ 近似 softmax。这是 Mamba/RWKV 吃超长上下文的底。`,
      }
    },
  },
  condnum: {
    care:
      '同样是梯度下降,为什么有的损失几步就到谷底,有的却要来回震荡爬几百步?差别常常在一个数上:**条件数 κ**。'
      + '条件数 = 最大曲率 / 最小曲率(对二次型就是最大特征值/最小特征值),它衡量一个问题有多"病态"。κ=1 时,损失碗是个正圆——梯度直直指向谷底,一步到位。κ 大时,碗被拉成又细又长的椭圆——某些方向很陡、某些方向很平,梯度几乎垂直于"通往谷底"的方向,只能**之字形**慢慢挪。'
      + '梯度下降的收敛速度由 κ 决定:每步误差最多缩一个因子 **(κ−1)/(κ+1)**——κ 越大越接近 1,收敛越慢。本实验 L=x²+κy²,κ 取 1→5→20→50:收敛步数 1→12→47→116,轨迹从"一条直线"变成"剧烈之字形"。'
      + '看懂这条,你就明白了为什么要做**特征归一化、预处理、以及 Adam 这类自适应方法**——它们本质都是在把 κ 拉回接近 1,让各个方向一样好走。你也就懂了「梯度下降」里 y 方向为什么会震荡:那正是条件数在作怪。数值线代里,κ 大还意味着方程组"病态"——解对输入噪声极其敏感。',
    guess: {
      q: '损失碗被拉得越扁(条件数 κ 越大),梯度下降会?',
      opts: ['越慢、之字形震荡(步数暴涨)', '越快(椭圆更好找方向)'],
    },
    tasks: [
      { act: '按「下一步」加大 κ', watch: '碗越拉越扁、轨迹从直线变之字形、步数暴涨' },
      { act: '对比 κ=1 vs 50', watch: '正圆一步到位,κ=50 要 100 多步' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; steps?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `κ 从 1→50:收敛步数 1→12→47→**${s.steps}**——问题越病态(κ 越大)越慢越难算。`,
        why: `κ 大时碗被拉成细长椭圆,梯度偏离谷底方向、只能之字形慢挪,每步误差只缩 (κ−1)/(κ+1)。所以要归一化/Adam 把 κ 拉回 1。这是梯度下降 y 方向震荡的深层原因。`,
      }
    },
  },
  maxent: {
    care:
      'softmax 在深度学习里无处不在——分类头、注意力、策略网络。它凭什么是"对的"选择,而不是随手一挑的归一化?答案是**最大熵原理**。'
      + '最大熵原理说:在所有满足你已知约束的概率分布里,应该选**熵最大**的那个。为什么?因为熵最大=对没被约束的部分**不做任何多余假设**,是最诚实、最不武断的分布——你只承诺你知道的,其余保持最大的不确定。'
      + '这有个漂亮的数学结论:给定若干"期望值"约束,最大熵解一定是**指数族** p_i ∝ e^{Σλ·特征};而给一个"期望能量"约束时,它正好是 **softmax / 玻尔兹曼分布** p_i ∝ e^{λ·E_i}。所以 softmax、逻辑回归、玻尔兹曼机都不是拍脑袋,它们是"在约束下最大熵"推出来的唯一答案。'
      + '本实验用一颗 6 面骰:没有约束时,最大熵分布就是**均匀**(熵 log₂6=2.585,到顶)。逐步把"期望点数 μ"从 3.5 抬到 5.5,最大熵解 p_i∝e^{λi} 就往 6 偏、熵一路降到 1.375——但每一步它都是所有满足该均值的分布里熵最高的(同均值的"两点"分布熵低得多)。'
      + '看懂这条,你就明白了 softmax 为什么"天生合理"、温度为什么控制的是熵,以及"最大熵=最少假设"这条贯穿统计推断、物理、机器学习的思想。它和交叉熵、softmax 是一家。',
    guess: {
      q: '一颗骰子,你只知道"它是六面的",最诚实(最大熵)的分布是?',
      opts: ['均匀分布(每面 1/6,熵到顶)', '集中在某几面(先猜个大概)'],
    },
    tasks: [
      { act: '按「下一步」收紧 μ', watch: '分布从均匀往 6 偏、熵一路降;但每步都最不武断' },
      { act: '看 μ=3.5', watch: '没有约束时最大熵=均匀、熵到顶' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; ent?: number; maxEnt?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `无约束时最大熵=均匀(熵 ${s.maxEnt});收紧到 μ=5.5 后熵降到 **${s.ent}**——但每步都是该约束下最不武断的分布。`,
        why: `最大熵=对未知不做多余假设,最诚实。给期望约束时解恒为指数族 p∝e^{λ·特征},即 softmax/玻尔兹曼——这就是 softmax、逻辑回归天生合理的根,不是随手一挑。`,
      }
    },
  },
  jl: {
    care:
      '嵌入动辄几百上千维,存储和计算都贵。能不能压到几十维、还不破坏"谁离谁近"这个几何结构?**Johnson–Lindenstrauss 引理**给了一个惊人的肯定回答:能,而且用一个**随机**线性投影就行。'
      + 'JL 说:N 个高维点,只要投影到 k ~ O(log N / ε²) 维,就能把所有两两距离保持在 (1±ε) 倍以内。最反直觉的一点是:所需维度 k **只跟点数 N 和精度 ε 有关,和原始维度 D 完全无关**——不管你原来是 500 维还是 50000 维,压到同样的几十维都够。'
      + '本实验:6 个 256 维随机点,用高斯随机矩阵投到 K=16→32→64→128 维。你会看到 15 对点的"低维距离/高维距离"随 K 增大越挤越紧地贴向 1,最大偏差从 ~31% 收到 ~11%——距离几乎原样保留。'
      + '看懂这条,你就明白了随机投影降维、近似最近邻搜索(ANN)、特征哈希这些技术为什么成立,以及"嵌入维度不用开得特别大也够用"的底气。它和 LoRA/低秩、高维近正交是一家人:高维空间其实很"空",信息可以被大幅压缩而几乎不失真。',
    guess: {
      q: '把 256 维的点投到 K 维,K 越大,两两距离保得?',
      opts: ['越准(偏差随 K 减小,贴近 1)', '越差(维度越低才越准)'],
    },
    tasks: [
      { act: '按「下一步」加大 K', watch: '点越挤越紧贴向 1、灰带越缩越窄' },
      { act: '想一想', watch: '所需 K 只跟点数 N、精度有关,和原始 256 维无关' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; d?: number; maxDev?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `K 从 16→128:距离最大偏差收到 **${(s.maxDev! * 100).toFixed(0)}%**、平均比≈1——${s.d} 维压到几十维,距离几乎原样。`,
        why: `JL 引理:随机投影到 k~O(log N/ε²) 维即保距,且与原维度 D 无关、只看 N 和 ε。这是随机投影降维、近似最近邻、特征哈希的理论支撑,也和 LoRA/低秩、高维近正交一家。`,
      }
    },
  },
  greedy: {
    care:
      '"每一步都拿当下最好的",这个策略又快又符合直觉,叫**贪心算法**。它有时是最优解的保证(哈夫曼编码、Dijkstra 最短路、最小生成树都靠它),有时却会栽——关键看问题有没有"**贪心选择性质**":局部最优能不能拼成全局最优。'
      + '最干净的反例是**找零**:币值 {1,3,4},要凑出 6。贪心"每步拿最大的币":先拿 4(剩 2)、再拿 1、再拿 1,一共 **3** 枚。可最优明明是 3+3 = **2** 枚!贪心被"先拿了 4"这个局部最优带偏,就再也回不到 3+3 那条更省的路了。'
      + '本实验让你一步步看贪心怎么拿币,走完再和动态规划的最优解对比:贪心 3 枚 vs 最优 2 枚。'
      + '看懂这条,你就明白了一个重要判断:**贪心对不对,取决于问题的结构,不取决于它跑得快**。同样是贪心,Dijkstra 和 Huffman 对(它们的问题具备贪心选择性质),找零这种币制就错。要保证最优,就得像动态规划那样枚举子问题、不放过更优的组合。它和「动态规划(编辑距离)」正好是一对照。',
    guess: {
      q: '币值 {1,3,4} 凑 6,贪心(每步拿最大)会用几枚?最优呢?',
      opts: ['贪心 3 枚(4+1+1),最优 2 枚(3+3)——贪心次优', '贪心就是最优,永远 2 枚'],
    },
    tasks: [
      { act: '按「下一步」贪心找零', watch: '每步拿最大币:4→1→1,共 3 枚' },
      { act: '看对比条', watch: '最优只要 2 枚(3+3)——先拿 4 堵死了更优路' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; picked?: number[]; greedyCount?: number; optimal?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `贪心 [${s.picked!.join('+')}]=**${s.greedyCount}** 枚,最优 **${s.optimal}** 枚(3+3)——贪心栽了。`,
        why: `贪心被"先拿了 4"的局部最优带偏、回不到 3+3。贪心对不对取决于问题有没有"贪心选择性质"——Dijkstra/Huffman 有所以对,找零这币制没有就错。要最优得用动态规划。`,
      }
    },
  },
  dotsim: {
    care:
      '注意力的核心动作是拿 query 和 key 做**内积** Q·K 当分数,分数越高越"关注"。可一个简单的乘加,凭什么就能量出两个东西"相关不相关"?答案藏在内积的几何里:**a·b = |a||b|cosθ**。'
      + '这个式子同时编码了两件事:两个向量的**长度**,以及它们的**夹角**。当长度固定,内积就纯粹地量"**方向有多一致**":同向(θ=0)最大、正交(θ=90°)恰好为 0、反向(θ=180°)最负。把长度归一化掉(除以 |a||b|)就是**余弦相似度** cosθ∈[−1,1],一个纯方向的相似度。'
      + '本实验固定 |a|=3、|b|=2,让夹角 θ 从 0°转到 180°:内积 6→4.24→0→−4.24→−6,余弦 1→0.71→0→−0.71→−1。图里能看到内积就等于 |a| 乘上"b 在 a 上的投影"——b 越倒向 a,投影越长、内积越大。'
      + '看懂这条,你就明白了注意力为什么用 Q·K 打分:query 和 key 越"方向一致"(语义相关),内积越大、softmax 后权重越高;无关的方向内积≈0(正接「高维近正交」——随机方向几乎正交、点积≈0)。检索、推荐、词向量类比(king−man+woman≈queen),底层都是这把"内积=相似度"的尺子。',
    guess: {
      q: '两个向量正交(夹角 90°)时,它们的内积是多少?',
      opts: ['0(正交=不相关)', '最大(垂直=最不同=最大)'],
    },
    tasks: [
      { act: '按「下一步」转 b', watch: '同向内积最大→90°为 0→反向最负;投影段跟着变' },
      { act: '盯 90°那步', watch: '正交时内积=0=不相关' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; dot?: number; cosSim?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `θ 从 0°→180°:内积 6→0(正交)→−6、余弦 1→0→−1——方向越一致内积越大。`,
        why: `内积 a·b=|a||b|cosθ,长度固定时纯量方向一致度。这就是注意力用 Q·K 打分的根据:相关方向内积大、softmax 权重高;无关方向内积≈0(接高维近正交)。`,
      }
    },
  },
  lowrank: {
    care:
      '微调一个大模型,按说要改动整块整块的 d×d 权重矩阵,参数量惊人。可 **LoRA** 只训练一小撮参数就能把模型调到新任务上、效果还不太掉。凭什么?答案是**低秩**。'
      + '任何矩阵都能拆成一串"奇异分量"的叠加:A = Σ σ_i·u_i·v_iᵀ,奇异值 σ 从大到小排。**大部分信息集中在前几个大 σ 上**。只留前 k 个分量(低秩近似 A_k),就用 2·d·k 个数近似了原来的 d² 个;而 Eckart–Young 定理保证 A_k 是所有秩-k 矩阵里最接近 A 的,重建误差正好等于被丢掉的那些奇异值 √(Σσ²)。'
      + '本实验:一个 8×8 矩阵由 4 个奇异分量搭成(σ=10,5,2,1)。逐步把秩 k 从 1 提到 4:右边的重建越来越像原图,误差 5.48→2.24→1.0→0、保留能量 88%→98%→99.6%→100%。留前 2 个就 98% 像,参数却从 64 掉到 32。'
      + '看懂这条,你就明白了 LoRA 为什么成立:微调时不动原权重 W,而是给它加一个**低秩**更新 ΔW=B·A(秩 r≪d),只训 2·d·r 个参数——省显存、省算力、还能存很多套"技能包"随时切换。图像压缩、PCA、推荐系统降维,底子也全是它。它坐在矩阵乘法之上,和量化一样是"省显存"的一路。',
    guess: {
      q: '8×8 矩阵由 4 个奇异分量搭成,只留前 2 个(秩 2),能保留多少信息?',
      opts: ['约 98%(信息集中在大奇异值上)', '约 50%(留一半分量=留一半信息)'],
    },
    tasks: [
      { act: '按「下一步」加大秩 k', watch: '右边重建越来越像、能量 88%→100%' },
      { act: '看秩 2', watch: '只留 2 个分量就 98% 像、参数 64→32' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; energyPct?: number; lowrankParams?: number; fullParams?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `秩 2 就保 98% 能量、参数从 ${s.fullParams} 降到一半——信息集中在大奇异值上。`,
        why: `A=Σσ·u·vᵀ,大部分信息在前几个大 σ 上,留前 k 个即最优近似(Eckart–Young)。这就是 LoRA:低秩更新 ΔW=B·A 只训 2·d·r 参数,省显存省算力还能存多套技能包。`,
      }
    },
  },
  editdist: {
    care:
      '把 "horse" 改成 "ros" 最少几步(每步可插入/删除/替换一个字符)?直接递归会把同一个子问题(比如"前 2 个字符怎么改")重复算指数级多次,慢到不可用。**动态规划**用一句话破局:**记住每个子问题的答案,别重算**。'
      + '做法是填一张表 dp[i][j]=把 a 的前 i 个字符改成 b 的前 j 个字符的最少步数。每一格只看三个已经算好的邻居就能 O(1) 推出:a[i]==b[j] 时不用动,dp=左上;否则 dp=1+min(左上=替换, 上=删除, 左=插入)。于是 O(n·m) 就把整张表填满,右下角就是答案。'
      + '本实验 a=horse→b=ros,一格一格填,每步高亮当前格和它依赖的三个邻居。你会看到它稳稳地把子问题一层层拼起来,最后右下角=**3**。'
      + '看懂这条,你就抓住了动态规划的两个内核——**最优子结构**(大问题的最优解由子问题的最优解拼成)和**重叠子问题**(同一子问题被反复用到,所以值得记下来)。序列比对、最短路(Bellman-Ford)、背包、DNA/语音对齐,底子都是这一套。',
    guess: {
      q: '把 horse 改成 ros(插/删/替),最少几步?',
      opts: ['3 步(DP 表右下角)', '5 步(逐个字符替换)'],
    },
    tasks: [
      { act: '按「下一步」逐格填', watch: '每格由左上/上/左三个已算邻居 O(1) 推出' },
      { act: '填到右下角', watch: 'horse→ros 编辑距离 = 3' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; a?: string; b?: string; val?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `整张表填完:把 **${s.a}** 改成 **${s.b}** 最少 **${s.val}** 步(右下角)。`,
        why: `每格只看三个已算好的邻居 O(1) 推出,O(n·m) 填完——这就是动态规划:记住每个子问题的答案,把指数级重复计算压成多项式。最优子结构+重叠子问题两条内核。`,
      }
    },
  },
  induction: {
    care:
      '大模型有个惊人的本事:你在 prompt 里给它几个例子,它就照着做(few-shot);你写一半有规律的序列,它能接着补全——哪怕这句话它训练时根本没见过。这种"看着上文现学现用"的能力叫**上下文学习(in-context learning)**,而它背后被找到的一个具体电路,就是**归纳头(induction head)**。'
      + '归纳头干的事一句话:**"上次见到当前这个 token 时,它后面跟了什么?把那个复制过来。"**它靠两个注意力头接力实现:一个"前一 token 头"给每个位置贴上"我前面是谁"的标签,一个"归纳头"用当前 token 去匹配这些标签——凡是"前一个 token=当前 token"的位置,就把注意力放上去,于是注意力正好落在**上次那个 token 之后**,再把那里的 token 复制成预测。'
      + '本实验:序列 A B C A B C A,问下一个。当前 token 是 A;归纳头回头找"前面是 A"的位置(pos1、pos4),注意力落上去——那两处后面跟的都是 **B**——复制出 B。于是 A B C A B C A → B,模式被补全了。'
      + '看懂这条,你就明白了为什么大模型能"照着例子做""续写有规律的东西",以及为什么说注意力不只是加权平均、而是能实现"回头查、按内容复制"这样的**算法**。它坐在注意力、多头、因果掩码之上。',
    guess: {
      q: '序列 A B C A B C A,归纳头会预测下一个 token 是什么?',
      opts: ['B(上次 A 之后跟的就是 B,复制过来)', 'A(最近出现的 token)'],
    },
    tasks: [
      { act: '一步步走', watch: '认当前 A → 扫出 pos1/pos4 → 注意力落上去 → 复制出 B' },
      { act: '看预测', watch: '"上次 A 之后是 B",补全 A B C A B C A → B' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ stage?: string; prediction?: string; cur?: string }>(trace)
      if (!s || s.stage !== 'done') return null
      return {
        pick: 0,
        say: `A B C A B C A → **${s.prediction}**:归纳头回头找"上次 ${s.cur} 之后是什么",把 ${s.prediction} 复制出来。`,
        why: `它没训过这个序列,纯靠上下文的模式现学现用——这就是上下文学习的核心电路,由"前一 token 头"+"归纳头"两个注意力头接力实现,也是 few-shot、模式续写的底层机制。`,
      }
    },
  },
  residual: {
    care:
      '2015 年前,把神经网络堆到几十层往往**更难训、效果更差**——不是容量不够,是**梯度消失**。反向传播里,梯度从损失出发、乘着每一层的局部导数往回传,链式法则就是**连乘**。每层导数常小于 1(比如 0.8),16 层连乘就是 0.8^16≈0.03,几十层后梯度几乎归零,最底下的层根本收不到有效信号、学不动。'
      + '**残差连接**一句话解决:让每层算 y = x + f(x),而不是 y = f(x)。这样这一层对输入的导数就从 f′(x) 变成了 **1 + f′(x)**——那个 **+1 是一条"恒等高速路"**,梯度即使经过 f′(x) 很小的一层,也能顺着 +1 **原样穿过去**。连乘不再塌向 0,于是几十上百层也能稳稳训练。'
      + '本实验让梯度从输出(=1)往输入倒传 16 层:没残差每层 ×0.8,你看它一路塌到 ~0.03;有残差每层 ×(1+小扰动)≈1,稳稳守在 1 附近。两条曲线一对比,残差的作用一目了然。'
      + '看懂这条,你就明白了为什么 ResNet 能堆到上百层、为什么 Transformer 的每个子层(注意力、FFN)都裹着残差、以及 LayerNorm 为什么总和残差配套。它坐在梯度下降之上——梯度能传下去,下降才有得下。',
    guess: {
      q: '梯度倒传穿过 16 层,没残差(每层×0.8) vs 有残差(导数=1+f′),结果会怎样?',
      opts: ['没残差塌到≈0(消失)、有残差守在≈1', '两者都能守住,残差没差别'],
    },
    tasks: [
      { act: '按「下一步」让梯度倒传', watch: '灰线(没残差)指数往 0 掉、红线(有残差)守在 1 附近' },
      { act: '看穿过 16 层后', watch: '没残差≈0.03(消失)、有残差≈1' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; depth?: number; gradPlain?: number; gradRes?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `梯度穿过 ${s.depth} 层:没残差塌到 **${s.gradPlain}**(梯度消失)、有残差稳在 **${s.gradRes}**。`,
        why: `链式法则=连乘。没残差每层×0.8指数衰减;残差 y=x+f(x)、导数=1+f′,那条 +1 恒等高速路让梯度原样穿过。这就是 ResNet、Transformer 每个子层都裹残差、能堆到上百层的原因。`,
      }
    },
  },
  graddesc: {
    care:
      '"训练一个模型"听着玄,拆开其实就一件事:**梯度下降**。你有个损失 L(θ)衡量模型错得多重,你想让它最小。梯度 ∇L 指向"损失上升最快"的方向,那就朝**反方向**走一步:θ ← θ − lr·∇L。学习率 lr 是步长。反复走,损失单调下降、逼近最低点。所有神经网络,从随机权重出发,靠的就是这一条把损失降下去。'
      + '本实验把损失画成一个碗:L(x,y)=x²+5y²(故意在 y 方向更陡一点)。从 (4,4) 出发、lr=0.14,梯度 ∇L=(2x,10y)。你会看到损失 96→21→6→2.6→1.2… 一路单调下降,轨迹拐着弯奔向谷底 (0,0)。'
      + '还有个细节值得盯:y 方向更陡(曲率大),同样的学习率下步子容易迈过头,于是 y 在中轴两侧**来回震荡**(4→−1.6→0.64→−0.256…)。这正是学习率与曲率(条件数)的博弈——学习率太大就发散、太小又太慢,病态的损失面尤其难走。'
      + '看懂这条,你就明白了训练日志里那条下降曲线是怎么来的、学习率为什么如此关键、以及为什么会有动量、Adam、学习率调度这些花样——都是为了在各种形状的损失面上把这一步走得又快又稳。它坐在"前向算损失、反向给梯度"之上。',
    guess: {
      q: '沿负梯度一步步更新参数,损失会怎样?',
      opts: ['单调下降,逼近最低点', '随机上下,不一定降'],
    },
    tasks: [
      { act: '按「下一步」下降', watch: '损失单调降、点拐向谷底 (0,0)' },
      { act: '看 y 方向', watch: 'y 更陡、步子迈过头,点在中轴两侧来回跳' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; loss?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `8 步梯度下降,损失从 96 单调降到 **${s.loss}**,逼近谷底 (0,0)。`,
        why: `沿负梯度 θ←θ−lr·∇L,梯度指向上升最快、取负号下降最快,损失就单调降——这就是神经网络训练的核心。y 方向更陡会来回震荡,正是学习率与曲率(条件数)的博弈。`,
      }
    },
  },
  bloom: {
    care:
      '你想判断"这个 URL 爬过没""这个 key 在不在库里",但集合太大、全存下来太占空间。**布隆过滤器**用一个 m 位的 bit 数组 + k 个哈希，就能几乎不出错地回答,空间小到惊人。'
      + '插入一个元素:算 k 个哈希、把对应的 k 个位全置 1。查询:看它的 k 位——**只要有一位是 0,就一定不在**(因为插过必然会把这些位都置 1);**k 位全是 1,则"可能在"**,但也可能是别的元素恰好把这几位都点亮了(**假阳性**)。'
      + '所以布隆过滤器的性格很鲜明:**绝不漏报(no false negative)、但可能误报(false positive)**。这在"先快速筛掉绝大多数不可能、再去查慢存储"的场景里正好够用。假阳性率≈(1−e^(−kn/m))^k,位越多、元素越少就越低。'
      + '本实验 m=24 位、k=3:先插 cat/dog/sun,再查一串。你会亲眼看到 owl 明明没插过,却因为它的 3 个哈希位恰好和 dog 撞在一起、全是 1,被判成"可能在"——一次真实的假阳性。'
      + '看懂这条,你就明白了为什么缓存前置、爬虫去重、数据库防穿透都爱用它,以及"用可控的错误率换巨大的空间/速度"这种工程折中怎么做。它坐在哈希和位图两条基础之上。',
    guess: {
      q: '一个没插入过的词,查询布隆过滤器,可能得到什么结果?',
      opts: ['可能"一定不在",也可能"可能在"(假阳性)', '一定得到"一定不在"(绝不出错)'],
    },
    tasks: [
      { act: '按「下一步」插入 cat/dog/sun', watch: '每个词点亮 3 个位' },
      { act: '查到 owl', watch: '没插过却三位全 1 → 假阳性"可能在"' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `规律成立:**有位是 0→一定不在**(绝不漏报)、**全是 1→可能在**(可能假阳性)。owl 撞了 dog 的位,就是一次假阳性。`,
        why: `插过的词必然把它的 k 位都置 1,所以绝不漏报;但没插过的词也可能被别人撞亮所有位,造成误报。用 24 个 bit 换"绝不漏报、极少误报"的极快判断——缓存前置、爬虫去重、防穿透都靠它。`,
      }
    },
  },
  bayes: {
    care:
      '一个稀有病,患病率 1%。有个不错的检测:真有病 90% 会显示阳性,没病也有 9% 误报。你测出**阳性**——你有多大概率真患病?直觉喊"90% 吧",但正确答案是 **~9%**。这就是**贝叶斯定理**,也是直觉最爱翻车的地方。'
      + '原因:后验 ∝ 先验 × 似然。P(病|阳)=真阳/(真阳+误报)。没病的人占 99%,光他们的 9% 误报,数量就远超真患者里的那点真阳性——于是阳性里绝大多数其实是误报。**贝叶斯逼你把基础率(先验)也算进去**,这正是"基础率谬误"戳破的地方。'
      + '但贝叶斯真正强大的是**连续更新**:把上一次的后验当这一次的先验,再测一次阳性。本实验连测 4 次:患病概率 1%→9%→50%→91%→**99%**,证据累积一步步逼近确诊。'
      + '看懂这条,你就明白了为什么"单次检测别慌"、为什么模型能"在上下文里不断修正判断",以及朴素贝叶斯分类器、卡尔曼滤波、A/B 实验背后是同一个式子:后验 ∝ 先验 × 似然。',
    guess: {
      q: '患病率 1%、灵敏度 90%、误报 9%。测出一次阳性,真患病概率约是?',
      opts: ['~9%(基础率太低,误报淹了真阳)', '~90%(灵敏度就是 90%)'],
    },
    tasks: [
      { act: '按「下一步」看第 1 次阳性', watch: '后验只 9%——真阳|误报拆分里,误报那截巨大' },
      { act: '继续按下去', watch: '上次后验当这次先验,9%→50%→91%→99%' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; posterior?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `连续 4 次阳性,患病概率 1%→9%→50%→91%→**${(s.posterior! * 100).toFixed(0)}%**。单次阳性只 9%(基础率谬误)。`,
        why: `后验 ∝ 先验 × 似然。没病的人基数太大,9% 误报淹没真阳性,所以单次阳性才 9%。但把后验当新先验能连续更新逼近确诊——这是朴素贝叶斯、卡尔曼滤波、上下文修正判断的底。`,
      }
    },
  },
  xent: {
    care:
      '你天天听到"模型训练损失下降了""这个模型困惑度多少"——它们到底在量什么？答案是**交叉熵**和**困惑度**，一体两面。'
      + '语言模型每一步都吐出一个"下一个词"的概率分布。真实的下一个词只有一个，于是这一步的**交叉熵**就等于 **−log p(真词)**——模型对真相的**惊讶度**(用 log₂，单位 bit)。给真词的概率越高、越不惊讶、交叉熵越低。'
      + '整句的**平均交叉熵**就是语言模型的**训练损失**；而**困惑度 = 2^交叉熵**，它是"有效分叉数"——模型平均在多少个等概率的词之间犹豫。完美预测：困惑度=1(毫不犹豫)；瞎猜(均匀 V 选 1)：困惑度=V。真实模型落在 1 和 V 之间，越低越好。'
      + '本实验让模型逐词预测 "the cat sat on the mat"(词表 V=8)：每步给出它对真词的概率，你看惊讶度 −log₂p 怎么算、怎么累成交叉熵、再换算成困惑度。拿不准的词(如 on 只给 25%)惊讶度飙到 2 bit，笃定的词(mat 95%)几乎 0。'
      + '看懂这条，你就明白了为什么"降交叉熵损失"和"降困惑度"是同一件事、困惑度为什么是语言模型最常用的评测指标，以及它和 softmax(概率从哪来)、采样(同一套下一词分布)是一条链。',
    guess: {
      q: '模型给真词的概率越高，这一步的交叉熵(惊讶度)会怎样？',
      opts: ['越低(越不惊讶)，困惑度越接近 1', '越高(概率大反而损失大)'],
    },
    tasks: [
      { act: '按「下一步」逐词预测', watch: '真词概率高→惊讶度低；on 只 25%那步惊讶度飙到 2 bit' },
      { act: '盯困惑度 ▲', watch: '在 1(笃定)到 8(瞎猜)之间；平均交叉熵越小越贴近 1' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; ce?: number; perplexity?: number; ppUniform?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `整句平均交叉熵 **${s.ce}** bit/词(=训练损失)，困惑度 2^${s.ce} = **${s.perplexity}**——只在约 ${s.perplexity!.toFixed(1)} 个词间犹豫(完美=1、瞎猜=${s.ppUniform})。`,
        why: `真词概率越高→惊讶度 −log p 越低→交叉熵越小→困惑度越接近 1。所以"降交叉熵损失"和"降困惑度"是同一件事，这也是困惑度成为语言模型最常用评测指标的原因。`,
      }
    },
  },
  clt: {
    care:
      '为什么高斯分布(钟形曲线)在自然界和深度学习里**无处不在**？答案是**中心极限定理**(CLT)：不管原始分布长什么样(只要方差有限)，把 m 个独立同分布样本**平均**，当 m 增大，这个**均值的分布**就越来越接近**高斯**——而均值的标准差按 **1/√m** 缩(正接大数定理)。'
      + '换句话说：任何"许多独立小随机因素相加/平均"出来的量，天然趋向高斯。测量误差、噪声、权重初始化、误差项，之所以都拿高斯建模，根就在这。'
      + '本实验故意用最**不像高斯**的**均匀分布 U[0,1]**(平的)当原始分布。逐步把"每次平均几个"m 从 1 加到 32：每个 m 跑 20000 次，把标准化后的均值做直方图、叠上标准正态曲线。'
      + '你会看到直方图从 m=1 的**平顶**(均匀本身、超额峰度 −1.2)，一步步长成 m=32 的**钟形**(超额峰度奔向 0=高斯)、死死贴住那条正态曲线；与此同时均值 std 按 σ/√m 缩。'
      + '看懂这条，你就明白了为什么高斯是默认假设、为什么"求平均"能把任意噪声"高斯化"，以及它和 √d 缩放、大数定理是同一套 i.i.d. 累加的不同侧面。',
    guess: {
      q: '把 m 个均匀(平的)样本平均，m 从 1 涨到 32，均值分布会怎样？',
      opts: ['从平顶长成钟形(趋近高斯)', '一直是平的(均匀不会变形状)'],
    },
    tasks: [
      { act: '按「下一步」把 m 从 1 加到 32', watch: '直方图从平顶长成钟形、越贴那条红色正态曲线' },
      { act: '盯超额峰度', watch: '从 −1.2(均匀)奔向 0(高斯)；均值 std 按 σ/√m 缩' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; m?: number; std?: number; theoStd?: number; exKurt?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `m 扫到 ${s.m}：均匀分布平均后长成钟形——超额峰度 **${s.exKurt}**(奔向 0=高斯)、均值 std **${s.std}**(理论 σ/√m=${s.theoStd})。`,
        why: `中心极限定理：许多独立小随机因素一平均，天然趋向高斯，且均值 std ∝ 1/√m。这就是高斯分布在自然界与深度学习(权重初始化、噪声、误差项)里无处不在的根。`,
      }
    },
  },
  lln: {
    care:
      '掷一次硬币你说不准，掷一万次正面比例几乎必是 0.5——这就是**大数定理**：独立同分布样本的**均值**，随样本数 n 增大**收敛到期望**。'
      + '更关键的是收敛有多快：估计的**误差按 1/√n 缩**（标准误 ∝ 1/√n，来自方差可加——n 个独立项相加、方差涨 n 倍、std 涨 √n，均值的 std 就 ∝ 1/√n）。'
      + '经典演示——**蒙特卡洛估 π**：单位正方形里随机撒 n 个点，落进 1/4 圆的比例 × 4 ≈ π。单条随机路径太吵，所以每个 n 跑 40 次独立试验取 RMS 误差。本实验把 n 从 50 加到 12800：均值估计稳在 3.14159（无偏）、RMS 误差越来越小，而 **RMS误差×√n ≈ 1.64 恒定**（理论 4·√(p(1−p))，p=π/4）——直接把"误差 ∝ 1/√n"摆给你看：想把误差减半，得把样本翻 4 倍。'
      + '这条是采样、蒙特卡洛积分、dropout、MoE 路由"多次平均就稳"的底：单次随机不可靠，n 个独立样本一平均，方差缩 n 倍。它也和 √d 缩放、高维近正交是同一套 i.i.d. 累加的不同侧面。',
    guess: {
      q: '撒点数 n 从 50 涨到 12800，均值估计和 RMS误差×√n 会怎样？',
      opts: ['估计贴近 π，而 RMS误差×√n 大致不变(≈1.64)', '误差按 1/n 缩，RMS误差×√n 跌到 0'],
    },
    tasks: [
      { act: '按「下一步」把 n 从 50 加到 12800', watch: '均值估计稳在 ≈3.14、RMS 误差越来越小' },
      { act: '盯 RMS误差×√n', watch: '它基本不随 n 变(≈1.64)——这个常数就是 1/√n 定律' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; n?: number; trials?: number; meanEst?: number; rmsError?: number; rmsErrSqrtN?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `n 扫到 ${s.n}（×${s.trials} 次独立试验）：均值估计 **${s.meanEst}**（≈π 无偏）、RMS 误差 **${s.rmsError}**，而 RMS误差×√n **${s.rmsErrSqrtN}**(≈1.64 恒定)。`,
        why: `大数定理 + 方差可加：均值收敛到期望、误差 ∝ 1/√n（理论 RMS误差×√n=4·√(p(1−p))≈1.64）。样本翻 4 倍误差才减半——这是采样、蒙特卡洛、dropout"多次平均就稳"的底。`,
      }
    },
  },
  ortho: {
    care:
      '大模型的嵌入是几百上千维。为什么这么高维能装下十几万个词、还不"打架"？'
      + '因为**高维随机向量几乎两两正交**：两个随机单位向量的夹角余弦，均值 0、**方差 = 1/d**（d 个独立分量的归一化内积，又是大数定理那套——分量越多越集中在 0）。'
      + '于是 d 越大，任意两个随机方向就越接近 90°(余弦→0)。你能在高维里塞下**指数级多**的"近正交"方向，每个概念占一个、彼此几乎不干扰。这就是分布式表示 / 嵌入有容量的根，也是**点积能当"相关度"**的前提。'
      + '本实验用 8 个确定性伪随机(高斯)单位向量、算 28 对夹角余弦。逐步把维度 d 从 2 加到 512：余弦标准差从 ~0.7 缩到 ~0.04(≈1/√d)、最大 |余弦| 从 ~1 贴到 ~0.09——**随机方向从"可能同向"变成"几乎正交"**。'
      + '看懂这条，你就知道了为什么大模型敢用几百维、为什么高维空间"很空"却很有用。它和 √d 缩放是同一条大数定理的两面。',
    guess: {
      q: '维度 d 从 2 涨到 512，随机向量两两余弦会怎样？',
      opts: ['越挤越紧地贴向 0(几乎正交)', '基本不变'],
    },
    tasks: [
      { act: '按「下一步」把 d 从 2 加到 512', watch: '点越挤越紧贴向"0=正交"；灰带(±1σ)越缩越窄' },
      { act: '看 d=2 vs d=512 的 max|cos|', watch: '从 ~1(可能同向)缩到 ~0.09(几乎正交)' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; d?: number; std?: number; theoStd?: number; maxAbs?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `d 扫到 ${s.d}：余弦标准差 **${s.std}**(理论 1/√d=${s.theoStd})、最大 |余弦| **${s.maxAbs}**——几乎两两正交。`,
        why: `高维随机向量的夹角余弦方差=1/d，d 大就死死集中在 0。所以高维能塞指数级多"近正交"方向，一个概念占一个——这就是嵌入有容量、点积能当相关度的根。一条大数定理。`,
      }
    },
  },
  hopfield: {
    care:
      '2020 年有个漂亮的结果：**注意力的更新规则，就是连续 Hopfield 网络的检索步**。换句话说，注意力本质是一个**可微的、按内容寻址的联想记忆**——把若干模式存成 keys，用 query 去"回忆"。'
      + 'softmax 的锐度 β(=1/温度) 决定检索方式：**β 大 = 精确检索**（query 只要落进某个存储模式的"吸引域"，就被拉回那个完整模式，哪怕它残缺）；β 小 = 软混合(几个模式的加权平均)。'
      + '一步 Hopfield 更新 = 一次注意力：weights = softmax(β · query·keys)，output = Σ weights·patterns。把 output 当新 query 再来一次，很快收敛到最相似的存储模式。'
      + '本实验存 4 个 8 位 ±1 的近正交模式(当"记忆")，query = 第 0 个模式**翻了 2 位**(残缺输入)。反复检索：残缺的 query 一步就被"清理"回完整的 P0，检索权重从分散收敛到 one-hot(认定=P0)。'
      + '这就是注意力能"从上下文回忆相关信息"的底——不是死记，是**按内容检索**；而存储容量随维度指数级，正对上「高维近正交」那条。看懂它，你就知道了注意力为什么能"记住"和"提取"。',
    guess: {
      q: '给注意力一个残缺的 query(和某个存储模式差 2 位)，反复检索会怎样？',
      opts: ['被"回忆"回完整的那个模式', '越检索越乱'],
    },
    tasks: [
      { act: '按「下一步」做检索', watch: '红框位翻回来、query 与 P0 从 6/8 变 8/8；权重收敛到 one-hot' },
      { act: '盯"最像 P?"和权重', watch: '残缺 query 最像 P0，检索把它拉回完整 P0——按内容的联想回忆' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; matchBits?: number; best?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `残缺 query 几步检索就回忆回完整的 **P${s.best}**（与 P0 相同 ${s.matchBits}/8 位、权重 one-hot）。`,
        why: `注意力=联想记忆：一次注意力就是一步 Hopfield 检索，query 落进某个记忆的吸引域就被拉回完整模式。这是注意力能"从上下文回忆相关信息"的底，容量随维度指数级。`,
      }
    },
  },
  scale: {
    care:
      '注意力分数 Q\u00b7K 是 **d 个乘积之和**。设 Q、K 每一维独立、均值 0、方差 1，则每个乘积均值 0、方差 1，d 个独立项相加 → **Var(Q\u00b7K)=d**（方差可加，正是大数定理那套 i.i.d. 累加）。'
      + '于是 logit 的标准差 ~\u221ad：d 一大，最相关那个 key 的分数就把别人甩开 \u221ad 那么多，**softmax 塌成近似 one-hot**（熵→0、一头独大），梯度也随之消失——训不动。'
      + '除以 **\u221ad_k** 正好把方差拉回 1、标准差回 1，softmax 重新“软”起来。这就是《Attention Is All You Need》里 “we scale the dot products by 1/\u221ad_k” 的原因。'
      + '本实验固定 4 个 key 的真实相似度 base=[1.5,1,0.5,0]（理解成缩放后该有的 logit）。逐步把维度 d 从 4 加到 1024：**不缩放** softmax(base\u00d7\u221ad) 迅速塌成 one-hot（d=256 时最大已 100%、熵 ~0）；**\u00f7\u221ad** softmax(base) 与 d 无关、熵恒定。'
      + '所以缩放不是玄学，是"d 个 i.i.d. 项相加、方差累加=d"的必然。看懂这一条，你就知道了注意力那个 1/\u221ad_k 到底在防什么——防 softmax 饱和、防梯度消失。它连着你熟悉的方差、独立同分布、大数定理。',
    guess: {
      q: '维度 d 从 4 涨到 1024，不缩放的 softmax 会怎样？',
      opts: ['塌成 one-hot（熵→0、一头独大）', '基本不变'],
    },
    tasks: [
      { act: '按「下一步」把 d 从 4 加到 1024', watch: '不缩放那边逐步塌成 one-hot；\u00f7\u221ad 那边纹丝不动' },
      { act: '对比两边的熵', watch: '不缩放熵→0（梯度消失）；\u00f7\u221ad 熵恒定' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; entU?: number; entS?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `d 扫到 1024：不缩放 softmax 熵塌到 **${s.entU}** bit（近 one-hot），\u00f7\u221ad 熵恒 **${s.entS}** bit。`,
        why: `Q\u00b7K 是 d 个 i.i.d. 项相加、方差=d、标准差 \u221ad；d 大就把 logit 差距放大 \u221ad 倍、softmax 饱和、梯度消失。除以 \u221ad_k 把方差拉回 1——这就是缩放的原因，一条大数定理。`,
      }
    },
  },
  engine: {
    care:
      '前面每个实验都是**单个算子**（注意力、KV 缓存、量化、矩阵乘…）。真正的推理引擎，是把它们串成一个会**连续批处理（continuous batching）**的系统：请求不断进来、各自长短不一，KV 显存有限，得有个调度主循环决定**谁上、谁等、谁的位子腾出来**。'
      + '每转一圈：①**回收**生成够了的请求、归还它的 KV 块；②按 **FCFS 准入**等待队列里放得下的（空闲块够才上，遇到第一个放不下就停——队头阻塞）；③新准入的做 **prefill**（一次吃完 prompt），在跑的做 **decode**（吐 1 个 token）；④前进。块池**守恒**：空闲 + 在跑占用 = 总块，恒成立。'
      + '本实验 4 个固定请求 R1(2,2) R2(4,3) R3(3,2) R4(2,1)：块池只有 4 块时，一开始只准入 R1、R2，R3/R4 排队；R1 算完让出块，R3 立刻补上，R2 算完 R4 补上——**批次每步都在变**，5 步就把 8 个 token 全生成完。'
      + '这就是连续批处理的价值：算完的请求立刻把块和位子让给等待的，短请求不被长的拖着空转，比"等整批全跑完才换批"的**静态批**利用率和吞吐都高。vLLM / TGI 这些推理引擎的核心，就是这个循环。'
      + '它把你早学过的**进程调度**（每步一次调度）、**分页 / 块池**（KV 按块分配、准入看空闲）、**KV 缓存**串成了一个系统——这是从 408 地基通到大模型推理的最后一段路。（简化：准入时按总长一次性分配块；真实引擎随 decode 增量分配，见 PagedAttention。）',
    guess: {
      q: 'KV 块池从 4 加到 6，一开始能同时准入的请求数会怎样？',
      opts: ['变多（块够了，批更大、等待更少）', '不变'],
    },
    tasks: [
      { act: '把 KV 块池从 4 加到 6', watch: '块多了，一开始能同时准入更多请求（批更大），等待队列更短', param: 'KV 块池' },
      { act: '盯运行批次的组成', watch: '每步都在变：算完的请求走、等待的补上——连续批处理', param: 'KV 块池' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; pool?: number; gen?: number; step?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `块池 ${s.pool} 块跑完 4 个请求：共生成 **${s.gen}** 个 token、引擎 **${(s.step ?? 0) + 1}** 步。`,
        why: `连续批处理：算完的请求立刻把块和位子让给等待的，批次每步在变，短请求不被长的拖着空转。这台引擎把进程调度、分页块池、KV 缓存串成一个系统——就是 vLLM/TGI 的核心。`,
      }
    },
  },
  kvoffload: {
    care:
      'KV 缓存吃显存，而且随**序列长度 × 并发请求数**线性涨（还记得「KV 缓存」和「参数量与显存」吗）。高并发、长上下文时，所有请求的 KV 块**一张 GPU 装不下**了，怎么办？'
      + '**KV 换出（offload）**：把暂时用不到的 KV 块**换出到容量大得多的 CPU 内存**，等要用时再**换回 GPU** —— 这和操作系统「内存不够就把页换到磁盘、要用再换回」的**页面置换**一模一样。'
      + '规则：访问某个 KV 块，若它在 GPU 上就**命中**；不在、且 GPU 已满，就按 **LRU**（最久没用的先走）把一个块**换出到 CPU**，再把要的块**换入 GPU**。'
      + '本实验固定访问序列 [0,1,2,0,3,1,4,2]：GPU 只有 3 个槽时，跑下来命中 1 次、换出 4 次、换入 2 次；把槽加到 4，换出就降到 2 次、换入 1 次 —— **显存越大，来回搬得越少**。'
      + '好处很直接：显存不够也能继续服务更多、更长的请求，不至于一满就拒绝。代价是换出换入要走 **PCIe 拷贝**，比在显存里慢得多，所以真实系统要尽量少换、或**异步预取**（提前把要用的块搬回来）。'
      + '它是「KV 缓存吃显存」这个矛盾的一个出口，和 PagedAttention（省碎片）、GQA（减 KV 头）、量化（压字节）并列的省显存手段 —— 而底层就是你早学过的**页面置换 / 换入换出**。看懂了页面置换，就看懂了 KV offload。',
    guess: {
      q: 'GPU 槽数从 3 增加到 4，换出到 CPU 的次数会怎样？',
      opts: ['变少（显存大了，少来回搬）', '不变'],
    },
    tasks: [
      { act: '把 GPU 槽数从 3 加到 4', watch: '同一序列，换出从 4 次降到 2 次、换入从 2 到 1 —— 显存越大越少来回搬', param: 'GPU 槽数' },
      { act: '盯 CPU 换出区（红色）', watch: 'GPU 一满又要新块，最久没用的块就被踢到 CPU；再访问它时得换回来（reload）', param: 'GPU 槽数' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; slots?: number; hits?: number; offloads?: number; reloads?: number }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `GPU ${s.slots} 槽跑完这串访问：命中 **${s.hits}**、换出 **${s.offloads}** 次、换入 **${s.reloads}** 次。`,
        why: `GPU 装不下所有 KV 块时，按 LRU 把最久没用的换出到 CPU、要用再换入 —— 就是页面置换。槽越多、来回搬越少。它用"换到 CPU"给显存续命，代价是 PCIe 拷贝，是省 KV 显存的手段之一。`,
      }
    },
  },

  collective: {
    care:
      '多卡一起跑大模型时，经常要把各张卡各自算的一份东西（比如张量并行拼完的结果、或训练时每卡的梯度）**求和，并让每一张卡都拿到同一个结果** —— 这个操作叫 **all-reduce**，是分布式的命门。'
      + '最朴素的做法是人人给人人发：G 张卡两两对发，**G² 条消息**，卡一多带宽就炸。'
      + '**环形（ring）all-reduce** 聪明得多：把卡排成一个环，分两段、共 **2(G−1) 步**。'
      + '**① reduce-scatter**（G−1 步）：每一步，每张卡把自己的**一个块**发给环上的下一张，对方把它累加进去。转 G−1 步后，每张卡恰好「拥有」某**一个块的完整求和**（各卡拥有的块还不一样）。'
      + '**② all-gather**（G−1 步）：再把这些已经求好和的块，沿着环传一圈广播出去。G−1 步后，每张卡都集齐了所有块 = **完整的总和**。'
      + '本实验里 4 张卡各持一段向量，6 步之后每张卡都拿到逐元素总和 [1111, 2222, 3333, 4444]，一模一样。'
      + '妙处在于：**每一步、每张卡都只收发一个块**，用掉的带宽和卡数 G 无关（带宽最优）—— 这就是它碾压「人人对发」的地方。'
      + '它直接接上你刚学的**张量并行**：张量并行各卡算完一片后拼结果用的 all-gather，就是环形 all-reduce 的后半段。all-reduce / all-gather / reduce-scatter 这几个集合通信原语，是大模型分布式训练和推理的通信地基。',
    guess: {
      q: 'G 张卡做 all-reduce，环形算法要多少步？',
      opts: ['2(G−1) 步，每步每卡只收发一个块', 'G² 步，人人对发'],
    },
    tasks: [
      { act: '把 GPU 数从 2 加到 4', watch: '总步数按 2·(G−1) 变（2→4→6）；卡越多步越多，但每步每卡仍只收发一个块', param: 'GPU 数 G' },
      { act: '看绿色 ✓ 怎么在网格里铺开', watch: 'reduce-scatter 后每卡先各拥有一个完整块，all-gather 再把它们传满整张网格 —— 人人集齐', param: 'GPU 数 G' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; G?: number; totalSteps?: number; target?: number[] }>(trace)
      if (!s || s.phase !== 'done' || !s.target) return null
      return {
        pick: 0,
        say: `${s.G} 张卡走 **${s.totalSteps}** 步（2·(G−1)）后，每张卡都拿到完整总和 [${s.target.join(', ')}]，人人一致。`,
        why: `环形 all-reduce 分 reduce-scatter + all-gather 两段，每步每卡只收发一个块，带宽与卡数无关，远胜人人对发的 G² 消息。张量并行拼结果的 all-gather 就是它的后半段 —— 这几个集合通信原语是大模型多卡的通信地基。`,
      }
    },
  },

  tensorpar: {
    care:
      '一个大模型的某个矩阵乘 Y = X·W，可能 W 就有几万×几万 —— 单张 GPU 既装不下、也算不快。**张量并行**的办法：把这个矩阵乘**切到多张卡上分头算**。'
      + '最常见的**列并行**：把 W[K×N] **按列切成 G 份**，第 g 张卡只拿一段列，算出结果 Y 的**对应一段列**（Y_g = X·W_g）。'
      + '于是每张卡**只存 1/G 的权重、只做 1/G 的乘法** —— 显存和算力都摊薄到 1/G，本来单卡扛不住的，现在 G 张卡各扛一点。'
      + '算完之后，各卡手里只有 Y 的一段，用一次跨卡通信 **all-gather** 把它们拼成完整的 Y。'
      + '最关键的一点 —— 拼出来的 Y 和**单卡整算完全一样**（本实验 G=2 时两卡各出 [7,5] 和 [4,8]，拼成 [7,5,4,8]，和不切时分毫不差）。'
      + '因为它只是把**同一个矩阵乘的列分开算**，就像 FlashAttention 分块一样，**切的是计算的分配、不是结果**。'
      + '代价是那一次 all-gather 的跨卡通信 —— 卡越多、通信越频繁，所以张量并行通常在一台机器的几张卡之间用（卡间带宽高）。'
      + '它直接坐在「矩阵乘法」这块地基上：看懂矩阵乘是"一行点一列、按列可分"，就看懂了为什么它能这么切。这是把大模型放上多卡跑起来的最基本手段之一。',
    guess: {
      q: '把矩阵乘按列切到 4 张 GPU 上分头算，最后拼起来的结果会怎样？',
      opts: ['和单卡整算完全一样（只是分开算）', '会有误差（分布式近似）'],
    },
    tasks: [
      { act: '把 GPU 数从 2 调到 4', watch: 'W 切得更细，每卡只拿 1/4 的列、只算 1/4；每卡占比从 1/2 变 1/4', param: 'GPU 数 G' },
      { act: '核对底部拼接结果', watch: '不管切几刀，all-gather 拼出的 Y 都等于单卡整算 —— 切的是乘法、不改结果', param: 'GPU 数 G' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; G?: number; full?: number[]; fraction?: number }>(trace)
      if (!s || s.phase !== 'done' || !s.full) return null
      return {
        pick: 0,
        say: `${s.G} 张卡各算 W 的一段列，all-gather 拼出 Y = [${s.full.join(', ')}]，和单卡整算**完全一样**；每卡只承担 **1/${s.G}** 的显存与算力。`,
        why: `列并行把 Y=X·W 按列切给多卡，各卡只存/只算 1/G，拼接严格等于单卡结果 —— 它切的是同一个矩阵乘的分配、不改结果（和 FlashAttention 分块同理）。代价是 all-gather 的跨卡通信。这是把大到单卡放不下的模型跑起来的基本手段。`,
      }
    },
  },

  layout: {
    care:
      '你在纸上画的矩阵是二维的，但内存是**一维的一条直线** —— 把二维摊平进一维，就是"布局"，而摊法不止一种。'
      + '**row-major（行主序，C 和 NumPy 默认）**：一行的元素在内存里**连续**存，元素 [i][j] 落在地址 **i·cols+j**。'
      + '**col-major（列主序，Fortran 和很多 BLAS/GPU 库默认）**：一列的元素连续存，[i][j] 落在地址 **j·rows+i**。'
      + '同一个矩阵、同样的数，两种布局在内存里的**顺序完全不同**：本实验的 2×3 矩阵，row-major 是 [1,2,3,4,5,6]，col-major 是 [1,4,2,5,3,6]。'
      + '为什么要在意？因为 **谁连续，顺着它走的访问就快** —— CPU/GPU 一次从内存读一整条 cache 行，连续访问正好一次读一片，跳着访问则每次都要重新取、cache 命中率崩。'
      + 'row-major 里"扫一行"步长 1（连续、快），"扫一列"步长 cols（跳着、慢）；col-major 正好反过来。'
      + '这就是为什么**矩阵乘、转置、reshape 都要看布局**：同一个乘法，访存顺序对不对布局，速度能差很多倍。它是「矩阵乘法」这块地基的另一半 —— 矩阵乘讲"算什么"，布局讲"数据在内存里怎么摆、怎么取才不浪费"。理解它，才理解 FlashAttention 的分块、cache 的分块优化为什么那么在意"连续"。',
    guess: {
      q: '同一个矩阵换成 col-major，内存里的数值顺序会怎样？',
      opts: ['完全不同（按列连续，[1,4,2,5,3,6]）', '不变（值一样）'],
    },
    tasks: [
      { act: '在 row-major / col-major 之间切', watch: '内存顺序在 [1,2,3,4,5,6] 和 [1,4,2,5,3,6] 之间变；扫行/扫列的步长跟着互换', param: '布局' },
      { act: '盯底部两个步长格', watch: 'row-major 扫一行步长 1(快)、扫一列步长 3(慢)；col-major 正好反过来 —— 这决定矩阵乘该按哪个方向访存', param: '布局' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; layout?: string; rowStride?: number; colStride?: number; mem?: ({v:number}|null)[] }>(trace)
      if (!s || s.phase !== 'done') return null
      const order = (s.mem ?? []).filter(Boolean).map(m => (m as {v:number}).v)
      return {
        pick: 0,
        say: `${s.layout} 摊平后内存顺序是 [${order.join(', ')}]；扫一行步长 **${s.rowStride}**、扫一列步长 **${s.colStride}**，步长 1 的那个连续、访问快。`,
        why: `二维摊进一维只有"先排行"或"先排列"两种，谁连续谁的访问就踩在 cache 行上、快。所以矩阵乘/转置/reshape 都要看布局 —— 同一个乘法访存顺序对不对布局，速度差很多倍。这是矩阵乘地基的另一半。`,
      }
    },
  },

  matmul: {
    care:
      '如果只挑一个运算来理解神经网络，就是**矩阵乘法**。注意力里的 Q·Kᵀ、前馈网络里的 W·x、最后投影到词表的 LM 头 —— 剥开都是矩阵乘。'
      + '规则很硬：**A[M×K] · B[K×N] = C[M×N]**，A 的列数必须等于 B 的行数（这个共同的内维 K 对不上就没法乘）。'
      + '算法很简单：结果 C 的每一格 **C[i][j] = A 的第 i 行 · B 的第 j 列**（对应位相乘再全加起来）。'
      + '本实验拿 2×3 · 3×2 两个小矩阵，一格一格算给你看：C[0][0] = 1×7 + 2×9 + 3×11 = 58，一直填满 C = [[58,64],[139,154]]。'
      + '**运算量 = 2·M·N·K**（每格 K 次乘 + K 次加），这是估算模型算力、显存带宽（还记得 Roofline 吗？）的起点。'
      + '为什么说它是"地基"：你之前学的那些高级机制，本质都是在**切分这一个乘法**而不改结果 —— '
      + 'FlashAttention 把大矩阵乘切成能塞进 SRAM 的小块（分块 = tiling），张量并行把一个大矩阵按行/列切到多张 GPU 上分头算再拼回来。'
      + '看懂矩阵乘怎么算、算多少，才看得懂它们在优化什么。它朴实到常被跳过，却是从「参数量与显存」到「FlashAttention」到「张量并行」这一整条线的共同底座。',
    guess: {
      q: 'A 是 2×3、B 是 3×2，能相乘吗？结果是几乘几？',
      opts: ['能，结果是 2×2（内维 3 对上了）', '不能，形状不匹配'],
    },
    tasks: [
      { act: '一格一格点完 C 的 4 个格', watch: 'A 的行、B 的列高亮，点积落到 C 对应格；FLOPs 每格涨 2K=6' },
      { act: '想它在网络里哪出现', watch: '注意力 Q·Kᵀ、FFN 的 W·x、LM 头投影 —— 全是矩阵乘，一个算法撑起整个网络' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; M?: number; N?: number; K?: number; totalFlops?: number; C?: (number|null)[][] }>(trace)
      if (!s || s.phase !== 'done') return null
      return {
        pick: 0,
        say: `${s.M}×${s.K} · ${s.K}×${s.N} = ${s.M}×${s.N}（内维 K=${s.K} 对上），每格一行点一列，共 **${s.totalFlops}** 次浮点（2·M·N·K）。`,
        why: `矩阵乘是神经网络的基本运算：Q·Kᵀ、W·x、LM 头全是它。理解它怎么算（一行点一列）、算多少（2MNK），才理解 FlashAttention 分块、张量并行切矩阵在优化什么 —— 它们都是切这个乘法、不改结果。`,
      }
    },
  },

  softmax: {
    care:
      'softmax 把一串任意实数（**logits**，可正可负、加起来不为 1）压成一个概率分布：'
      + '每个取 **exp**（保证非负、单调，把大的拉得更大），再**除以所有 exp 的总和**（保证加起来是 1）。'
      + '大模型每吐一个字，都是对下一个 token 的 logits 做 softmax、再按概率采样。'
      + '**温度 T** 是采样最常调的旋钮，作用是在 softmax 之前先把 logits **除以 T**：'
      + 'T 小（→0）把差距放大、分布变尖，越接近"只选最大的那个"（贪心、确定）；'
      + 'T 大（>1）把差距压平、分布变均匀，越随机、越有创造性。'
      + '用**熵**（−Σp·log₂p）量化：温度越高，分布越平，熵越大 —— 这就是"温度调的是随机性"的精确含义。',
    guess: {
      q: '把温度 T 调高（比如从 1 到 2），概率分布会变尖还是变平？',
      opts: ['变平（熵变大，更随机）', '变尖（熵变小，更确定）'],
    },
    tasks: [
      { act: '把温度 T 从 1 调到 2', watch: '同样的 logits，分布变平、熵变大 —— 更随机、更有创造性', param: '温度 T' },
      { act: '把 T 调到 0.5', watch: '分布变尖、熵变小 —— 越来越接近只选最大的那个（贪心）', param: '温度 T' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ phase?: string; T?: number; entropy?: number; probs?: number[] }>(trace)
      if (!s || s.phase !== 'done' || s.entropy === undefined || !s.probs?.length) return null
      const top = Math.round(Math.max(...s.probs) * 100)
      const hot = (s.T ?? 1) > 1
      return {
        pick: hot ? 0 : 1,
        say: hot
          ? `T=${s.T} 时分布**变平**了 —— 熵 **${s.entropy.toFixed(2)} bit**、最大概率才 ${top}%。`
          : `T=${s.T} 时分布**偏尖** —— 熵 ${s.entropy.toFixed(2)} bit、最大概率 ${top}%。要更平就把 T 调过 1。`,
        why: `温度在 softmax 之前把 logits 除以 T。除以一个大于 1 的数，所有 logit 一起缩小、彼此差距被压平，`
          + `softmax 出来就更均匀、熵更大。除以小于 1 的数则相反，差距被放大、分布更尖。`,
      }
    },
  },

  paged: {
    care:
      'PagedAttention（vLLM 的核心创新）本质就是**把操作系统的分页搬到 KV 缓存上**。'
      + '早期推理引擎要求一个请求的 KV **连续存放**，于是长度不定的请求把显存切得七零八落 —— '
      + '总量够、却拼不出一整块连续空间，这就是**外碎片**。分页的解法和 OS 一模一样：'
      + 'KV 切成固定大小的**块（page）**，不要求连续；每个请求一张**块表**记「逻辑块→物理块」（就是页表）；'
      + '要空间就从**空闲块池**拿一块，拿到哪块都行。两个请求交错生成时，物理块自然被打散 —— '
      + '请求 A 可能占物理块 0、2、4，块表照样把它们串成 A 的逻辑序列。请求结束就按块归还，别的请求立刻复用。'
      + '一句话：**用块级映射换来"想放哪放哪"，从根上消灭外碎片**，显存利用率因此大幅提高。',
    guess: {
      q: '两个请求交错生成 KV，其中一个请求占用的物理块会连续吗？',
      opts: ['不一定连续（分页不在乎）', '一定连续'],
    },
    tasks: [
      { act: '盯着请求 A 的块表', watch: '交错生成让 A 拿到物理块 0、2、4 —— 不连续，但块表把它们串成 A 的逻辑序列，一点不乱', param: '场景' },
      { act: '切到「释放后复用」', watch: '前一个请求结束、块归还后，新请求直接捡起这些块 —— 没有连续分配那种外碎片', param: '场景' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ act?: string; tables?: Record<string, number[]> }>(trace)
      if (!s || !s.tables) return null
      //  找任意一个占了 ≥2 块的请求，看它连不连续
      const owner = Object.entries(s.tables).find(([, v]) => v.length >= 2)
      if (!owner) return null
      const [r, blks] = owner
      const contiguous = blks.every((b, k) => k === 0 || b === blks[k - 1] + 1)
      return {
        pick: contiguous ? 1 : 0,
        say: contiguous
          ? `请求 ${r} 恰好拿到了连续的物理块 [${blks.join(' ')}] —— 但这只是**碰巧**，分页从不保证连续。`
          : `请求 ${r} 占的是物理块 **[${blks.join(' ')}]**，明显**不连续** —— 分页压根不在乎。`,
        why: `连续分配才要求一个请求的 KV 挨在一起，一旦长度不定就产生外碎片。分页把 KV 切成固定块、`
          + `用块表映射逻辑↔物理，物理块跳着分布也能对上 —— 这就是它能把显存用满、不留碎渣的原因。`,
      }
    },
  },

  radix: {
    care:
      '大模型推理里，每个 token 的 K、V 向量算一次就能反复用。而真实场景中很多请求**共享同一段前缀** —— '
      + '同一个 system prompt、同一段 few-shot 示例。这段前缀的 KV 只需算一次，就能**跨请求复用**，省掉重复的 **prefill**。'
      + '实现靠一棵**前缀（radix）树**：已缓存的 token 路径挂在树上，新请求逐 token 往下走，'
      + '能匹配的前缀**命中**（直接复用 KV、跳过计算），走到树上没有的 token 才**未命中**（计算 KV 并延长树）。'
      + '缓存的 token 总数超预算时，按 **LRU** 淘汰最久没被命中的叶子 —— 从叶子往上回收，不动还在被复用的前缀。'
      + '省下多少 prefill，直接等于命中 token 占总 token 的比例：请求越像、共享前缀越长，省得越狠。',
    guess: {
      q: '当前这组请求跑完，前缀复用大概能省下多少 prefill？',
      opts: ['省下近一半或更多', '几乎省不了'],
    },
    tasks: [
      { act: '在「共享 system 前缀」和「各不相同」之间切', watch: '共享前缀的请求集省下近一半；毫无共享的省 0 —— 复用的价值全看请求像不像', param: '请求集' },
      { act: '把缓存预算调到 4', watch: '装不下所有前缀就开始 LRU 淘汰叶子；想复用被淘汰的前缀就得重算', param: '缓存预算' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ act?: string; savedTotal?: number; seenTotal?: number }>(trace)
      if (!s || s.act !== 'done' || !s.seenTotal) return null
      const ratio = (s.savedTotal ?? 0) / s.seenTotal
      const p = Math.round(ratio * 100)
      return {
        pick: ratio >= 0.4 ? 0 : 1,
        say: ratio >= 0.4
          ? `这组请求省下了 **${s.savedTotal}/${s.seenTotal}** 个 token 的 prefill（**${p}%**）—— 共享前缀确实值钱。`
          : `只省下 **${s.savedTotal}/${s.seenTotal}**（**${p}%**）—— 请求之间几乎没有共享前缀，缓存派不上用场。`,
        why: ratio >= 0.4
          ? `省下的比例 = 命中 token / 总 token。前缀越长、越多请求共用，命中越多。真实推理里一个长 system prompt 被成千请求共享，省的是巨量重复 prefill。`
          : `前缀缓存只在请求“开头像”时有用。开头就各不相同，第一个 token 就分叉，谁也复用不了谁 —— 缓存全是各自的独占路径。`,
      }
    },
  },

  expr: {
    care:
      '人写的是**中缀式**（3+4*2，运算符在两个操作数中间），但中缀要靠优先级和括号才能定运算顺序，'
      + '机器算起来别扭。**后缀式**（逆波兰，如 3 4 2 * +）把运算符写在操作数后面，**没有括号、不看优先级** —— '
      + '运算顺序已经写死在排列里。两步都靠**一个栈**：① 中缀转后缀（调度场算法）用运算符栈，'
      + '遇新运算符就把栈里优先级不低于它的先弹出，再压自己，括号成对压入弹出；'
      + '② 后缀求值用数值栈，遇数字压栈、遇运算符弹两个算完压回，一遍扫描出答案。'
      + '栈的"后进先出"在这里是关键：优先级高的运算符后进却先算，正好由栈顶先弹出来保证。',
    guess: {
      q: '把 3+4*2-1 转成后缀式，紧跟在 4 后面输出的会是什么？',
      opts: ['数字 2', '运算符 *', '运算符 +'],
    },
    tasks: [
      { act: '把式子换成带括号的 (3+4)*2', watch: '左括号先压栈，右括号一到就把栈弹到左括号 —— 括号硬生生改了运算顺序', param: '中缀表达式' },
      { act: '对比 3+4*2 和 (3+4)*2 的后缀式', watch: '同样的数字和符号，后缀排列却不同 —— 优先级和括号都被"编译"进了后缀里', param: '中缀表达式' },
    ],
    verdict: ({ trace }) => {
      const flush = (trace as { act?: string; rpn?: string[] }[]).find(f => f.act === 'flush')
      const done = last<{ act?: string; result?: number | null; rpn?: string[] }>(trace)
      if (!flush?.rpn || !done || done.result === undefined || done.result === null) return null
      //  4 后面紧跟的那个 token（0-indexed 找 '4' 的下一个）
      const rpn = flush.rpn
      const idx = rpn.indexOf('4')
      const after = idx >= 0 && idx + 1 < rpn.length ? rpn[idx + 1] : ''
      const pick = after === '2' ? 0 : after === '*' ? 1 : after === '+' ? 2 : 1
      return {
        pick,
        say: `后缀式是 **${rpn.join(' ')}**，4 后面紧跟的是 **${after || '—'}**；整式求值 = **${done.result}**。`,
        why: `4 之后先输出数字 2，是因为 * 的两个操作数（4 和 2）要先凑齐；* 要等它右边的 2 也读到、`
          + `且没有更高优先级抢在前面，才轮到它进后缀。优先级决定了运算符在后缀里出现的**先后**。`,
      }
    },
  },

  rip: {
    care:
      '距离矢量路由（RIP 用的就是它）不需要任何路由器知道全网拓扑 —— 每台只维护一张"到各目的地的代价 + 下一跳"表，'
      + '**只跟直接邻居交换整张表**。更新式很简单：到某目的地的代价 = min（到邻居的代价 + 邻居声称到该目的地的代价），'
      + '这其实就是**分布式的 Bellman-Ford**，一轮一轮把最短路从近到远扩散出去，几轮就收敛。'
      + '它的著名毛病是**无穷计数**：一条链断了，邻居可能把"其实得经过你才到得了"的旧路由又广播回来，'
      + '路由器信了、加一跳再传，代价就一格格虚长，很慢才发现不可达 —— RIP 只好把"无穷"定成 16 来封顶。'
      + '水平分割、毒性逆转就是为了压住这个毛病。',
    guess: {
      q: '当前场景跑到最后，会出现"代价一直往上数到无穷"吗？',
      opts: ['会（无穷计数）', '不会'],
    },
    tasks: [
      { act: '从「收敛」切到「断链」', watch: '收敛后断掉第一条链，看通往断点的代价一格格爬到 16 —— 这就是无穷计数', param: '场景' },
      { act: '把拓扑换成「带环网络」再断链', watch: '有备用路径时坏消息不会打转，很快收敛到新路，不会数到无穷', param: '场景' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ act?: string; broken?: string; round?: number; routers?: string[]; dist?: Record<string, Record<string, number>> }>(trace)
      if (!s || s.act !== 'converged' || !s.routers || !s.dist) return null
      const infs = s.routers.reduce((n, x) => n + s.routers!.filter(y => x !== y && (s.dist![x]?.[y] ?? 0) >= 16).length, 0)
      const counted = !!s.broken && infs > 0
      return {
        pick: counted ? 0 : 1,
        say: counted
          ? `断链后确实发生了**无穷计数** —— 最后有 **${infs}** 个不可达表项停在了无穷（16）。`
          : `没有数到无穷 —— ${s.broken ? '这个拓扑有备用路径，很快收敛到新路。' : '收敛场景不断链，自然不会无穷计数。'}`,
        why: counted
          ? `坏消息一跳一跳传：邻居把经过断点的旧路由广播回来，代价每轮 +1 往上爬，一直到 16 才认定不可达。水平分割能避免它。`
          : `要出现无穷计数，得同时满足"链断了"且"没有别的路可绕" —— 只要还有备用路径，路由器立刻改走新路，不会打转。`,
      }
    },
  },

  addsub: {
    care:
      '补码是为了"让减法也能用加法器算"而设计的：负数补码 = 对应正数按位取反再加 1，'
      + '于是 **A − B 变成 A + (−B)的补码**，硬件只需要一个加法器。更妙的是**符号位可以和数值位一起参与运算**，'
      + '不用像原码那样单独处理符号 —— 从最低位逐列相加、带上进位，加到符号位为止。'
      + '唯一要小心的是**溢出**：结果超出这个位数能表示的范围（8 位是 −128~127）。'
      + '判法不是"看最高位有没有进位"，而是 **进入符号位的进位 ⊕ 移出符号位的进位，不相等就溢出**，'
      + '等价说法是"两个同号数相加却得到异号结果"。只有同号相加（含减法转成的加法）才可能溢出。',
    guess: {
      q: '按当前这组操作数和运算，结果会溢出吗？',
      opts: ['会溢出', '不会'],
    },
    tasks: [
      { act: '把操作数换成 100 和 50（都是正数）', watch: '两正数相加得到负数 —— 符号翻了，溢出；双进位异或那一格变成 1', param: '运算' },
      { act: '在「加 / 减」之间切', watch: '减法先多一步"求 −B 的补码"（取反加一），之后完全走加法', param: '运算' },
      { act: '把位数从 8 改成 4', watch: '能表示的范围缩到 −8~7，原本不溢出的数很容易就溢出了', param: '位数' },
    ],
    verdict: ({ trace }) => {
      const s = last<{ act?: string; overflow?: boolean; op?: string; aVal?: number; bVal?: number; sum?: string }>(trace)
      if (!s || (s.act !== 'overflow' && s.act !== 'done') || s.aVal === undefined || s.bVal === undefined) return null
      const real = s.op === 'sub' ? s.aVal - s.bVal : s.aVal + s.bVal
      return {
        pick: s.overflow ? 0 : 1,
        say: s.overflow
          ? `这组数相加**溢出**了 —— 真正的和是 **${real}**，但机器数放不下。`
          : `没溢出 —— 结果 **${real}** 落在这个位数的补码范围内。`,
        why: s.overflow
          ? `溢出的信号是"进入符号位的进位 ⊕ 移出符号位的进位 = 1"，也就是两个同号数相加却翻了符号。`
            + `位数越少（如 4 位只到 ±7/8），越容易溢出。`
          : `两个进位相等（异或为 0），或本来就是异号相加 —— 异号相加的结果一定落在两者之间，绝不溢出。`,
      }
    },
  },

  btree: {
    care:
      '二叉树的遍历要把一棵二维的树"压平"成一条线，四种次序各是一种压法。'
      + '**前序**（根→左→右）、**中序**（左→根→右）、**后序**（左→右→根）三种只差一件事：'
      + '**根在什么时候输出**——先输出、夹在中间、还是最后输出。它们都靠"一条路走到黑再回退"，'
      + '本质是**栈**（递归就是隐式的栈）。**层序**不一样，它一层一层从左到右扫，靠的是**队列**。'
      + '最常被考的一条性质：**中序遍历二叉搜索树，输出正好是从小到大的有序序列**——'
      + '不管插入顺序多乱，只要树是 BST，中序结果就有序。',
    guess: {
      q: '按当前的遍历次序，第一个被输出的，会是根结点吗？',
      opts: ['是，先输出根', '否，根不在最前'],
    },
    tasks: [
      { act: '在前序 / 中序 / 后序之间切换', watch: '树一动不动，只是"根"输出的时机在变，三条序列就各不相同', param: '遍历次序' },
      { act: '切到中序，再把插入序列改乱', watch: '中序输出永远从小到大 —— 这是二叉搜索树的定义性质，跟插入顺序无关', param: '遍历次序' },
      { act: '切到层序', watch: '辅助结构从"调用栈"换成"队列"，访问从往深处钻变成一层层铺开', param: '遍历次序' },
    ],
    verdict: ({ trace }) => {
      const s = last<{
        nodes?: { key: number }[]; root?: number; visited?: number[]; order?: string
      }>(trace)
      if (!s || !s.nodes || s.root === undefined || !s.visited?.length) return null
      const rootKey = s.nodes[s.root]?.key
      const firstKey = s.nodes[s.visited[0]]?.key
      if (rootKey === undefined || firstKey === undefined) return null
      const CN: Record<string, string> = { pre: '前序', in: '中序', post: '后序', level: '层序' }
      const name = CN[s.order ?? ''] ?? '本'
      const rootFirst = firstKey === rootKey
      return {
        pick: rootFirst ? 0 : 1,
        say: rootFirst
          ? `${name}遍历第一个输出的是 **${firstKey}**，正是根 —— 所以「是」。`
          : `${name}遍历第一个输出的是 **${firstKey}**，而根是 **${rootKey}** —— 所以「否」。`,
        why: rootFirst
          ? `前序和层序都从根开始：前序的规则头一条就是"先访问根"，层序则是根第一个入队、第一个出队。`
          : `中序要先把整棵左子树走完才轮到根，后序更是留到最后 —— 所以最先输出的是最左下角的结点，不是根。`,
      }
    },
  },

  hash: {
    care:
      '散列表靠一个函数把键直接映到槽位，理想情况一次就命中。但不同的键会算到同一个槽 —— **冲突**，'
      + '怎么处理冲突决定了性能。**拉链法**把冲突的挂成链表，各槽独立；**线性探测**往后一个个找空位，'
      + '老毛病是**堆积**：冲突的元素挤成一片连续占用，后来的一撞就要探很多次。衡量好坏用**平均查找长度 ASL** —— '
      + '把每个键查到它所需要比较的次数平均一下。装填因子越高、堆积越严重，ASL 涨得越快。'
      + '这一屏把每次插入的探测路径画出来，让"堆积"这件抽象的事变得看得见。',
    guess: {
      q: '同一批键，用线性探测和拉链法，谁的平均查找长度(ASL)更小？',
      opts: ['拉链法更小', '一样', '线性探测更小'],
    },
    tasks: [
      { act: '在「冲突处理」里从线性探测切到拉链法', watch: 'ASL 是不是降了 —— 拉链没有堆积', param: '冲突处理' },
      { act: '把「表长」调小（装填因子变高）', watch: 'ASL 猛涨 —— 越挤越难找', param: '表长' },
      { act: '切到平方探测', watch: '它跳着探，就是为了打散线性探测那种连片堆积', param: '冲突处理' },
    ],
    verdict: ({ doc, trace, runDoc }) => {
      if (hashASL(trace) === null) return null
      const lin = hashASL(runDoc({ ...doc, params: { ...doc.params, method: '线性探测' } }))
      const chain = hashASL(runDoc({ ...doc, params: { ...doc.params, method: '拉链' } }))
      if (lin === null || chain === null) return null
      const pick = chain < lin ? 0 : Math.abs(chain - lin) < 1e-9 ? 1 : 2
      const say = `同一批键：拉链法 ASL ${chain.toFixed(2)}、线性探测 ASL ${lin.toFixed(2)} —— 所以「${['拉链法更小', '一样', '线性探测更小'][pick]}」。`
      const why = `线性探测的冲突会**连片堆积**，一个键探到别人的地盘上就得一路顺延，ASL 因此被拉高；`
        + `拉链法各槽独立，冲突只在自己那条链上排队。装填因子越高，这个差距越大。`
      return { pick, say, why }
    },
  },

  huffman: {
    care:
      '给每个字符按出现频率编码，频率高的用短码、低的用长码，让整段的**总长度最短**。'
      + '哈夫曼的办法很简单：每次从森林里取**权值最小的两棵树**合并，新结点权值是两者之和，再放回森林，'
      + '直到只剩一棵。这样权值大的字符自然离根近、编码短。衡量指标是 **WPL（带权路径长度）** = '
      + 'Σ(权值 × 到根层数)，哈夫曼树让它**最小**，而且它恰好等于所有内部结点权值之和。'
      + '编出来的码还是**前缀码** —— 任何一个都不是另一个的前缀，所以码流不用分隔符也能唯一解码。',
    guess: {
      q: '哈夫曼树的 WPL（带权路径长度）恰好等于什么？',
      opts: ['所有叶子权值之和', '所有内部结点权值之和', '树的高度'],
    },
    tasks: [
      { act: '在右边「各字符的权值」里把某个字符的权值调到最大', watch: '它的编码是不是变最短了 —— 频率高的离根近' },
      { act: '把所有权值改成相等的', watch: '哈夫曼树退化成接近满二叉树，每个码长几乎一样' },
    ],
    verdict: ({ trace }) => {
      const wpl = huffWPL(trace)
      if (wpl === null) return null
      const say = `这组权值建出的哈夫曼树，WPL = **${wpl}**。它就等于把每次合并产生的那些"内部结点权值"全加起来。`
      const why = `每合并一次就产生一个内部结点，它的权值 = 那一刻两棵最小树之和；`
        + `一个叶子每被"往上合并"一次就多算一层，而它被合并的次数正好等于它头顶那串内部结点的个数 —— `
        + `所以 Σ(权值×层数) = Σ(内部结点权值) = ${wpl}。选别的两棵合并，WPL 只会更大。`
      return { pick: 1, say, why }
    },
  },

  kmp: {
    care:
      '在主串里找模式串，暴力法一失配就把主串指针退回去重来，最坏 O(nm)。KMP 的全部好处是一句话：'
      + '**主串指针只往前走，绝不回退**。它先对模式串预处理出一张 **next 表** —— next[j] 记的是'
      + '模式串前 j 位里"最长的相等前后缀"有多长。一旦在第 j 位失配，就靠它决定模式串往右滑多远：'
      + '已经匹配上的那一截前缀不用重新比，直接对齐到相等的后缀上。所以主串每个字符最多被看一次，'
      + '整体 O(n+m)。这一屏分两段：先算 next 表，再让双指针在主串上走，看主串指针如何一路不回头。',
    guess: {
      q: 'KMP 和暴力匹配，匹配过程中主串指针都需要回退吗？',
      opts: ['两个都要回退', '只有暴力法要回退', '两个都不回退'],
    },
    tasks: [
      { act: '把「是否演示匹配」关掉，只看 next 表怎么算出来', watch: 'next[j] 就是模式串前 j 位的最长相等前后缀长度', param: '是否演示匹配' },
      { act: '换一个「模式串」（如 aaaa）再看 next 表', watch: '高度自相似的模式串，next 值一路递增 —— 失配时能滑得很少', param: '模式串' },
    ],
    verdict: ({ trace }) => {
      const r = kmpAdv(trace)
      if (r === null) return null
      const say = `这次匹配，主串指针总共只前进了 **${r.adv}** 次，一次都没回退${r.found ? `，找到 ${r.found} 处` : ''} —— 所以「只有暴力法要回退」。`
      const why = `失配时 KMP 只把模式串的 j 退到 next[j]，主串指针**原地不动**；`
        + `暴力法则要把主串指针拨回到"这一趟起点的下一个"重新比。`
        + `正是"主串不回退"把复杂度从 O(nm) 压到了 O(n+m)。`
      return { pick: 1, say, why }
    },
  },

  mst: {
    care:
      '在一个带权连通图里选一棵**连通所有点、总权值最小**的树，就是最小生成树。两种经典贪心：'
      + '**Prim** 从一个点长出去，每次从"已经连上的那一堆"往外挑权值最小的一条边，把新点拉进来 —— '
      + '它天然不会成环，因为每条边都是从树内连到树外。**Kruskal** 把所有边按权值从小到大排，'
      + '逐条问"加了会不会成环"，不成环就要、成环就跳过，判环靠并查集。两者挑的边可能不同，'
      + '但**总权值必然相同** —— 这是最小生成树的一个基本性质。这一屏把选边过程一条条摊开。',
    guess: {
      q: '同一个图，用 Prim 和 Kruskal 得到的最小生成树，总权值一样吗？',
      opts: ['一样', 'Prim 更小', 'Kruskal 更小'],
    },
    tasks: [
      { act: '在「算法」里从 Prim 切到 Kruskal', watch: '选中的边序可能不同，但最后的总权值一样', param: '算法' },
      { act: '换一个「Prim 起点」', watch: 'Prim 从不同点长出去，选边顺序变，总权值仍不变', param: 'Prim 起点' },
    ],
    verdict: ({ doc, trace, runDoc }) => {
      if (mstWeight(trace) === null) return null
      const prim = mstWeight(runDoc({ ...doc, params: { ...doc.params, algorithm: 'Prim' } }))
      const krus = mstWeight(runDoc({ ...doc, params: { ...doc.params, algorithm: 'Kruskal' } }))
      if (!prim || !krus) return null
      const pick = prim.w === krus.w ? 0 : prim.w < krus.w ? 1 : 2
      const say = `这个图：Prim 总权值 ${prim.w}、Kruskal 总权值 ${krus.w} —— 所以「${['一样', 'Prim 更小', 'Kruskal 更小'][pick]}」。`
      const why = `两种算法各自贪心的角度不同（一个从点长、一个从边挑），中途选的边可能不是同一批；`
        + `但最小生成树的**总权值是这个图的固有量**，只要图不变，谁来选都是 ${prim.w}。`
      return { pick, say, why }
    },
  },

  topo: {
    care:
      'AOE 网用**边表示活动、点表示事件**，问的是"整个工程最快多久干完、哪些活动一天都拖不得"。'
      + '先做**拓扑排序**（反复取入度为 0 的点）确认无环；再正推每个事件的**最早发生时刻 ve**（取所有前置路径的最大值）、'
      + '逆推**最迟发生时刻 vl**（取所有后继限制的最小值）。一个活动的最早开始 = 起点 ve、最迟开始 = 终点 vl − 权，'
      + '两者相等（余量为 0）的活动就是**关键活动**，它们串起来就是**关键路径** —— 拖它一天，整个工程就晚一天。'
      + '总工期就等于关键路径的长度，也就是汇点的 ve。这一屏把 ve/vl 一层层算给你看。',
    guess: {
      q: '整个工程的总工期，由什么决定？',
      opts: ['最长的那条路径（关键路径）', '最短的那条路径', '边数最多的那条路径'],
    },
    tasks: [
      { act: '在「做什么」里从"拓扑排序"切到"关键路径"', watch: '关键路径被标出来，总工期 = 它的长度', param: '做什么' },
      { act: '把某条关键活动的权值（时长）调大', watch: '总工期跟着变长 —— 关键活动一拖，工期就拖' },
    ],
    verdict: ({ trace }) => {
      const r = topoSpan(trace)
      if (r === null) return null
      const say = `这个 AOE 网的总工期是 **${r.span}**`
        + (r.critical.length ? `，关键路径：${r.critical.join(' → ')}。` : '。')
        + ' 它由**最长**的那条路径决定。'
      const why = `总工期 = 汇点的最早发生时刻 ve，而 ve 是沿路径取**最大**算出来的 —— `
        + `等于说，工程要等最慢的那条链走完才算完。关键路径上的活动余量都是 0，`
        + `拖任何一个，汇点 ve 就跟着往后，工期就变长。`
      return { pick: 0, say, why }
    },
  },

  partition: {
    care:
      '动态分区把内存按作业请求**随到随切**，回收时再把相邻的空闲块合并。四种放置策略挑空闲块的方式不同：'
      + '**首次适应**从低地址找第一个够大的（低地址被切得很碎但找得快）；**最佳适应**找最小的够大的'
      + '（最容易留下一堆用不上的小碎片）；**最坏适应**找最大的切（剩的那截还能再用）；'
      + '**邻近适应**从上次停的地方接着找。麻烦的是**外碎片** —— 空闲总量够，却零散成一堆连不成一块的小空闲，'
      + '于是明明还有内存，大作业却装不进去。这一屏把每次分配/回收摊开，让碎片怎么攒起来的看得见。',
    guess: {
      q: '同一串请求，首次适应和最佳适应，谁剩下的外碎片更多？',
      opts: ['首次适应更多', '一样', '最佳适应更多'],
    },
    tasks: [
      { act: '在「放置策略」里从首次适应切到最佳适应', watch: '外碎片是不是更多了 —— 每次留最小剩块，越攒越碎', param: '放置策略' },
      { act: '切到最坏适应', watch: '它每次切最大块，剩下的那截还比较大、还能再分', param: '放置策略' },
    ],
    verdict: ({ doc, trace, runDoc }) => {
      if (partFree(trace) === null) return null
      const first = partFree(runDoc({ ...doc, params: { ...doc.params, algorithm: '首次适应' } }))
      const best = partFree(runDoc({ ...doc, params: { ...doc.params, algorithm: '最佳适应' } }))
      if (!first || !best) return null
      const pick = first.ext > best.ext ? 0 : first.ext === best.ext ? 1 : 2
      const say = `这串请求跑完：首次适应剩外碎片 ${first.ext}K、最佳适应剩 ${best.ext}K —— 所以「${['首次适应更多', '一样', '最佳适应更多'][pick]}」。`
      const why = pick === 1
        ? `这串请求没切出小于门限的碎渣，两种策略打平。碎片要在"请求大小参差、反复分配回收"时才攒得出来 —— `
          + `换一串更零碎的请求，最佳适应通常会先露出马脚：它每次留最小剩块，最容易积一堆用不上的小碎渣。`
        : `最佳适应每次都挑"刚好够"的块切，切完只剩一丁点 —— 这些碎渣谁也用不上，越攒越多；`
          + `首次适应不挑肥拣瘦，反而不容易制造这种连片的小碎渣。名字叫"最佳"，在碎片这件事上常常最差。`
      return { pick, say, why }
    },
  },

  inode: {
    care:
      'Unix 文件用 **inode** 里的一组指针找到数据块：前几个是**直接地址**（拿来就用），'
      + '再往后依次是**一级、二级、三级间址** —— 指针先指向一个索引块，索引块里才是下一层的地址。'
      + '一个索引块能装多少指针，取决于"块大小 ÷ 指针大小"。于是访问一个逻辑块要读几次盘，'
      + '完全看它落在哪一档：小文件的块在直接地址里，一次就到；大文件的块要绕两三层索引，'
      + '每多一层就多读一次盘。这套**混合索引**的妙处是：小文件不必为大文件的寻址开销买单。',
    guess: {
      q: '这次访问的逻辑块，要读几次盘才能拿到数据？',
      opts: ['1 次', '2 次', '3 次', '4 次'],
    },
    tasks: [
      { act: '把「块大小」调大（一个索引块能装更多指针）', watch: '同一个块号可能从二级间址落回一级 —— 少读一次盘', param: '块大小' },
      { act: '把要访问的逻辑块号改得很大', watch: '它落到二级、三级间址，读盘次数一层层加上去' },
    ],
    verdict: ({ trace }) => {
      const r = inodeReads(trace)
      if (r === null) return null
      //  ⚠️ level 是内核枚举（direct/single/double/triple），得翻成中文再印
      const LV: Record<string, string> = { direct: '直接地址', single: '一级间址', double: '二级间址', triple: '三级间址', oob: '越界' }
      const pick = Math.min(3, Math.max(0, r.reads - 1))
      const say = `这次访问的块落在**${LV[r.level] ?? '某一档'}**，要读 **${r.reads}** 次盘 —— 所以「${['1 次', '2 次', '3 次', '4 次'][pick]}」。`
      const why = `读盘次数 = 途经的索引块层数 + 1（最后那次是数据块本身）。`
        + `直接地址 1 次、一级间址 2 次、二级 3 次、三级 4 次。`
        + `把块调大能让更多块落进浅一层的索引，寻址就更快。`
      return { pick, say, why }
    },
  },

  bplus: {
    care:
      'B+ 树是数据库和文件系统的索引主力。m 阶 B+ 树每个结点最多 m−1 个键，'
      + '**所有真数据都在叶子层**，内部结点只当路标；叶子之间还串成链表，所以范围查询能顺着链一路扫。'
      + '插入时若某个结点装满就**分裂**：从中间劈开，把中间的键提到父结点（叶子分裂那个键留一份在右叶子，'
      + '内部结点分裂才是真提上去）。分裂会从叶子往上传，一旦传到根、根也分裂，**整棵树才长高一层**。'
      + '正因为长高只发生在根、且所有叶子永远在同一层，B+ 树始终是**平衡**的，查找代价稳定在 O(log n)。',
    guess: {
      q: 'B+ 树在什么时候会长高一层？',
      opts: ['每次插入都可能', '只有根结点也分裂时', '某一层插满时'],
    },
    tasks: [
      { act: '把「阶 m」从 3 调到 5（每个结点能装更多键）', watch: '同样一串键，分裂次数变少、树也更矮', param: '阶 m' },
      { act: '换一个「插入序列」（右边序列框里改）', watch: '分裂发生在哪几步、树在第几次插入后长高' },
    ],
    verdict: ({ trace }) => {
      const r = bplusShape(trace)
      if (r === null) return null
      const say = `这串键插完，树高 **${r.h}**、一共分裂 **${r.sp}** 次 —— 树长高**只发生在根结点也分裂**的那一刻。`
      const why = `分裂从叶子开始，把中间键往上顶；只要父结点还装得下，树就不长高。`
        + `只有一路顶到根、根也满了跟着裂，才多出一层 —— 所以 ${r.sp} 次分裂里，真正让树长高的没几次，`
        + `而且长高时**所有叶子一起下沉一层**，永远保持平衡。`
      return { pick: 1, say, why }
    },
  },

  traverse: {
    care:
      '图的遍历两种走法：**深度优先 DFS** 一条路走到黑，走不动了回退换一条，用**栈**（递归就是隐式的栈）；'
      + '**广度优先 BFS** 一圈一圈往外铺，先访问所有邻居再往深走，用**队列**，在无权图上顺带给出最短边数。'
      + '两者都要标记"访问过"，否则有环的图会绕不出来；图不连通时，一趟走完还有没访问到的点，'
      + '就从新的起点再来一趟。关键要看清：**换算法只改访问顺序和生成树的形状，不改被访问到的点集** —— '
      + '只要从同一个起点出发，可达的点都会被走到，个数一样。这一屏把栈/队列的进出逐步摊开。',
    guess: {
      q: '同一个图、同一个起点，DFS 和 BFS 访问到的点数一样吗？',
      opts: ['一样', 'DFS 访问得多', 'BFS 访问得多'],
    },
    tasks: [
      { act: '在「算法」里从 DFS 切到 BFS', watch: '访问顺序全变，但访问序列的长度一样', param: '算法' },
      { act: '换一个「起点」', watch: '生成树换了个样，但只要图连通，走到的还是那批点', param: '起点' },
    ],
    verdict: ({ doc, trace, runDoc }) => {
      if (travCount(trace) === null) return null
      const dfs = travCount(runDoc({ ...doc, params: { ...doc.params, algorithm: 'DFS' } }))
      const bfs = travCount(runDoc({ ...doc, params: { ...doc.params, algorithm: 'BFS' } }))
      if (!dfs || !bfs) return null
      const pick = dfs.n === bfs.n ? 0 : dfs.n > bfs.n ? 1 : 2
      const say = `从同一起点：DFS 访问 ${dfs.n} 个点、BFS 访问 ${bfs.n} 个 —— 所以「${['一样', 'DFS 访问得多', 'BFS 访问得多'][pick]}」。`
      const why = `两种走法只是**顺序**和**生成树形状**不同（DFS 深钻、BFS 平铺），`
        + `但"从起点可达的点集"是图的固有事实，跟怎么走无关 —— 所以个数必然相同，都是 ${dfs.n} 个。`
      return { pick, say, why }
    },
  },

  bitmap: {
    care:
      '位示图用**一位对应一个盘块**来管空闲：0 空闲、1 已用。分配就是找一个（或一串连续的）0 置成 1，'
      + '回收就是把对应的位清 0。它省空间、找空闲快，但**考点全在换算** —— 位示图是二维的（第几个字、字里第几位），'
      + '盘块号却是一维的，两者靠 `盘块号 = 字号 × 字长 + 位号` 来回换（若盘块从 1 开始编号还要再 +1）。'
      + '一道题给你盘块号问它在第几字第几位，或者反过来，错就错在这个换算和"从 0 还是从 1 编号"上。'
      + '这一屏把每次分配/回收落到位示图的哪一格画出来，把换算这件事摊开给你核对。',
    guess: {
      q: '在位示图里，"分配一个盘块"和"回收一个盘块"分别是什么操作？',
      opts: ['分配置 1、回收置 0', '分配置 0、回收置 1', '两个都置 1'],
    },
    tasks: [
      { act: '把「字长」从 16 调到 8', watch: '同一个盘块号，落到的字号/位号跟着变 —— 换算公式里的除数变了', param: '字长' },
      { act: '把「字数」调大（盘块总数变多）', watch: '空闲块数跟着变，位示图铺开更宽', param: '字数' },
    ],
    verdict: ({ trace }) => {
      const free = bitmapFree(trace)
      if (free === null) return null
      const say = `整串分配/回收跑完，位示图上还剩 **${free}** 个空闲块（值为 0 的位）—— 分配是把 0 置 1，回收是把 1 置 0。`
      const why = `位示图就这一条规矩：找 0 置 1 = 分配，置 0 = 回收，空闲块数 = 图里 0 的个数。`
        + `真正会做错的是**换算**：盘块号 = 字号 × 字长 + 位号，还有"盘块从 0 还是从 1 编号"那个 ±1。`
      return { pick: 0, say, why }
    },
  },

}

export const briefFor = (id: string): Brief | undefined => BRIEFS[id]
