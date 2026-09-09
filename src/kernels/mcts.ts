/**
 * 内核：蒙特卡洛树搜索 MCTS（大模型算法/决策）
 * 轴：**模拟轮** —— 每轮四步：**选择**（按 UCB 挑最值得试的分支）→**扩展**→**模拟**（随机走到底看输赢）→**回传**（更新沿途节点）。
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本的"模拟"是一张**写死的脚本表**：
 *   `ROLLOUTS = { A: [1,1,1,1], B: [0], C: [0] }`
 * —— A 每次都赢、B/C 每次都输，跑 6 轮，A 必胜。而它自己的正文写着
 *   「靠**大量随机对局的统计**说话」「UCB **兼顾探索与利用**」
 * 这两句一句都没兑现：既没有随机、也没有"大量"，而 c 写死 1.4 从没动过。
 * **统计要收敛，先得有东西可收敛。** 脚本表里没有统计，只有一个已知答案。
 *
 * 这一版：
 * ① **模拟真的随机**：五个走法各有一个**真实胜率**（0.75 / 0.60 / 0.40 / 0.30 / 0.25，
 *    算法看不到），每次 rollout 就是照这个概率抛一次硬币（种子化，可复现）。
 *    最好的两个只差 0.15 —— **预算不够时 MCTS 是真的会选错的**。
 * ② **探索常数 c 做成旋钮**（0 / 0.7 / 1.4 / 4）。UCB 的两项**分开显示**：
 *    利用项（实测胜率）和探索项（c·√(ln N / n)）。
 *    实测：**c=0 卡死在 66% 上不去**（锁在第一个碰巧赢的走法上，加多少预算都没用），
 *    c=4 在预算 10 时只有 19%（探索项压过胜率差，均匀撒钱），中间那档 320 轮能到 99%。
 *    「兼顾探索与利用」这句话这才有东西可看 —— 它是个要调的数，不是一句口号。
 * ③ **"选对了吗"不问算法自己**：真实胜率是我们设的，最优走法已知。
 *    而且把整场搜索**重跑 500 次**，量出「这个配置下选对的概率」——
 *    单看这一次的输赢是运气，概率才是答案。
 * ④ **预算扫描**：预算 10→320，每档 500 次重跑，画出选对率曲线。
 *    这才叫"靠大量随机对局的统计说话"。
 *
 * ⚠️ **量不到的那件事也写在屏幕上**：「最后取访问最多、不是胜率最高」是 MCTS 的标准做法，
 * 但在这个**扁平的五选一**上两条规则实测几乎一样（甚至胜率略好）。真实 MCTS 里
 * 取访问次数的理由在**树**上（深层节点的价值估计方差大、且被对手挑剔过），
 * 这一屏没有树，**量不到就说量不到** —— 所以它只作为一栏对照摆着，不做旋钮、不下结论。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

export const MCTS_CS = [0, 0.7, 1.4, 4] as const
export const MCTS_BUDGETS = [10, 20, 40] as const

const P_VISIT = '访问最多'
const P_RATE = '胜率最高'

const MOVES = ['A', 'B', 'C', 'D', 'E']
/**  每个走法的**真实胜率** —— 算法看不到它，只能靠 rollout 去估。
     ⚠️ 这组数是**量过才定的**，不是随手写的：
     · 五个走法（不是三个）—— UCB 的价值在于**尽早把明显差的剪掉**，
       只有三个候选时它相对"均匀分配"几乎没有优势，那条课就演不出来。
     · A 与 B 差 0.15 —— 差太小（试过 0.05）时 320 轮也分不出来，曲线爬不起来；
       差太大则随便几轮就分得出，"预算不够会选错"又没了。 */
const TRUE_P = [0.75, 0.60, 0.40, 0.30, 0.25]
const BEST = 0                      // argmax TRUE_P —— 独立的真值，不问算法
const r2 = (x: number) => Math.round(x * 100) / 100
const r3 = (x: number) => Math.round(x * 1000) / 1000

/** 种子化 PRNG（mulberry32）—— rollout 要真随机，但整个实验必须可复现 */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ═══════════════════════════════════════════════════════════════
//  一场搜索
// ═══════════════════════════════════════════════════════════════

type Pick = { k: number; exploit: number; explore: number; ucb: number | null }

/**
 * 跑一整场 MCTS。
 *
 * `emit` 是**同一份代码**在"只数结果"和"逐帧出画面"两种用法之间的唯一差别 ——
 * 静默扫描和屏幕上走的那一场，走的是同一条路径。**不另写一份重放**。
 */
/**  ⚠️ **平局必须随机拆。**
     第一版拿 `indexOf(Math.max(...))` 挑，永远偏向下标最小的 —— 而最优走法正好是 0 号。
     结果预算 4 轮就"选对 76.5%"、加到 16 轮反而掉到 66%：那不是收敛，
     **是我的平局拆法在冒充结果**。测出来的数越漂亮越要先问它是不是这么来的。 */
const argmaxRand = (rand: () => number, score: (k: number) => number) => {
  let best = -Infinity, cands: number[] = []
  for (let k = 0; k < MOVES.length; k++) {
    const v = score(k)
    if (v > best) { best = v; cands = [k] } else if (v === best) cands.push(k)
  }
  return cands[Math.floor(rand() * cands.length)]
}

/**  UCB 一整张表。**它是"照这组计数算出来的账"** —— 谁的计数，得跟着一起交出去，
     不然屏幕上会出现两个口径打架：表里的"利用"是本轮开始时的胜率，
     而树上的"实测胜率"是这一轮跑完之后的。**读状态字段先问它是这一步之前还是之后的。** */
function ucbTable(n: number[], w: number[], Nroot: number, c: number): Pick[] {
  return MOVES.map((_, k) => {
    if (n[k] === 0) return { k, exploit: 0, explore: Infinity, ucb: null }
    const exploit = w[k] / n[k]
    const explore = c * Math.sqrt(Math.log(Nroot) / n[k])
    return { k, exploit: r3(exploit), explore: r3(explore), ucb: r3(exploit + explore) }
  })
}

function search(
  c: number, budget: number, pickRule: string, seed: number,
  emit?: (info: {
    it: number; picks: Pick[]; chosen: number; win: number
    n: number[]; w: number[]
    /** picks 是照**这一组**计数算的（本轮开始时的账） */
    picksN: number[]; picksW: number[]
  }) => void,
) {
  const rand = rng(seed)
  const K = MOVES.length
  const n = new Array<number>(K).fill(0), w = new Array<number>(K).fill(0)
  let Nroot = 0
  for (let it = 1; it <= budget; it++) {
    //  选择：UCB = 利用项（实测胜率）+ 探索项（c·√(ln N_父 / n_子)）。没试过的一律 ∞ 先试
    const picksN = n.slice(), picksW = w.slice()
    const picks = ucbTable(n, w, Nroot, c)
    const chosen = argmaxRand(rand, k => (picks[k].ucb === null ? Infinity : picks[k].ucb!))
    //  模拟：照这个走法的**真实胜率**抛一次硬币。算法看不到 TRUE_P，只看得到结果
    const win = rand() < TRUE_P[chosen] ? 1 : 0
    n[chosen]++; w[chosen] += win; Nroot++
    emit?.({ it, picks, chosen, win, n: n.slice(), w: w.slice(), picksN, picksW })
  }
  //  最终决策
  const final = pickRule === P_RATE
    ? argmaxRand(rand, k => (n[k] ? w[k] / n[k] : -1))
    : argmaxRand(rand, k => n[k])
  return { n, w, final, right: final === BEST }
}

/** 把整场搜索重跑 `reps` 次，量出「这个配置下选对的概率」—— 单看一次是运气 */
function winRate(c: number, budget: number, pickRule: string, reps = 500) {
  let hit = 0
  for (let s = 0; s < reps; s++) if (search(c, budget, pickRule, 1000 + s * 7919).right) hit++
  return hit / reps
}

// ═══════════════════════════════════════════════════════════════
//  状态
// ═══════════════════════════════════════════════════════════════

export type MctsPick = { k: number; exploit: number; explore: number; ucb: number | null }
/** 预算扫描上的一点 */
export type MctsPoint = { budget: number; pRight: number }

export type MctsState = {
  i: number
  step: number
  moves: string[]
  /** 每个走法的**真实胜率** —— 算法看不到，只有屏幕上看得到 */
  trueP: number[]
  best: number
  n: number[]
  w: number[]
  /** UCB 拆成两项：利用（实测胜率）+ 探索（c·√(ln N / n)） */
  picks: MctsPick[]
  /**  `picks` 是照**这一组**计数算出来的。
       中间帧里它是**本轮开始时**的账（那才是驱动这一轮选择的东西），
       而 `n`/`w` 已经是这一轮跑完之后的 —— 两者对不上是正常的，
       但屏幕和判据都必须知道自己在读哪一个。 */
  picksN: number[]
  picksW: number[]
  chosen: number
  win: number
  iter: number
  budget: number
  c: number
  pickRule: string
  /** 到这一轮为止「访问最多」和「胜率最高」各会选谁 —— 两条规则打架的地方就是那个坑 */
  byVisit: number
  byRate: number
  /** 最终按当前规则选中的走法（跑完才有意义） */
  final: number
  right: boolean
  /** 这个配置下**选对的概率**（重跑 400 次量的） */
  pRight: number
  /** 预算扫描曲线（当前 c 与规则下）：预算 → 选对率 */
  sweep: MctsPoint[]
  /**  四档 c 的选对率：`pRight`=当前预算下，`pMax`=预算扫描末档（320 轮）时。
       ⚠️ 两个数都要，因为**小预算下四档根本分不开**（差距还没重采样噪声大），
       c=0 不收敛这件事只有把预算加满才看得见。 */
  cSweep: { c: number; pRight: number; pMax: number }[]
  /** 两条最终决策规则在同一配置下的选对率 */
  ruleCmp: { rule: string; pRight: number }[]
  phase: 'run' | 'done'
  log: string
}

export const MCTS_VISIBLE = [
  'step', 'moves', 'trueP', 'best', 'n', 'w', 'picks', 'picksN', 'picksW', 'chosen', 'win', 'iter', 'budget', 'c',
  'pickRule', 'byVisit', 'byRate', 'final', 'right', 'pRight', 'sweep', 'cSweep', 'ruleCmp', 'phase', 'log',
] as const
type Frame = Omit<MctsState, 'i'>

const SWEEP_BUDGETS = [10, 20, 40, 80, 160, 320]
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

export const mctsKernel: Kernel<MctsState> = {
  kind: 'mcts',

  compile(doc: SimDocument): CompiledModel<MctsState> {
    const c = Number(doc.params.c ?? 1.4)
    const budget = Number(doc.params.budget ?? 20)
    const pickRule = P_VISIT
    /*  ⚠️ 种子是**按明写的规则挑的**，不是碰运气碰到一个好看的：
        「第一个让**默认档 c=1.4/20 轮选对、而 c=0 同预算选错**的种子」。
        原来那个种子下 12 档配置**全都选错**（同一个种子、开局 A 就输了，一路带偏），
        屏幕上从来看不到一次成功 —— 那不叫诚实，那叫没得看。
        这一屏演的是**机制**，而"到底有多大用"由下面重跑 500 次的选对率回答。 */
    const SEED = 20260924
    const K = MOVES.length

    //  静默扫描：预算 / 探索常数 / 决策规则 各自的选对率。都是**量**出来的，不是断言
    const sweep: MctsPoint[] = SWEEP_BUDGETS.map(b => ({ budget: b, pRight: winRate(c, b, pickRule) }))
    const MAXB = SWEEP_BUDGETS[SWEEP_BUDGETS.length - 1]
    const cSweep = MCTS_CS.map(cc => ({
      c: cc, pRight: winRate(cc, budget, pickRule), pMax: winRate(cc, MAXB, pickRule),
    }))
    const ruleCmp = [P_VISIT, P_RATE].map(r => ({ rule: r, pRight: winRate(c, budget, r) }))
    const pRight = winRate(c, budget, pickRule)

    //  只在"到此为止两条规则各会选谁"上用（展示用，平局取下标最小的即可，不参与任何统计）
    const argmaxVisit = (n: number[]) => n.indexOf(Math.max(...n))
    const argmaxRate = (n: number[], w: number[]) => {
      let bi = 0, br = -Infinity
      for (let k = 0; k < K; k++) { const r = n[k] ? w[k] / n[k] : -1; if (r > br) { br = r; bi = k } }
      return bi
    }

    const zeros = () => new Array<number>(K).fill(0)
    const noPicks = () => MOVES.map((_, k) => ({ k, exploit: 0, explore: Infinity, ucb: null }))
    const frames: Frame[] = []
    const shared = { moves: MOVES, trueP: TRUE_P, best: BEST, budget, c, pickRule, pRight, sweep, cSweep, ruleCmp }

    frames.push({
      ...shared, step: 0, n: zeros(), w: zeros(), picks: noPicks(), picksN: zeros(), picksW: zeros(),
      chosen: -1, win: -1, iter: 0, byVisit: -1, byRate: -1, final: -1, right: false, phase: 'run',
      log: `下棋走法太多没法全搜。MCTS 每轮四步:**选择**(按 UCB 挑最值得试的)→**扩展**→**模拟**(随机走到底看输赢)→**回传**(更新沿途节点)。\n\n`
        + `根有 ${K} 个候选走法。**它们的真实胜率是 ${MOVES.map((m, k) => `${m}=${TRUE_P[k]}`).join('、')}** —— `
        + `注意这几个数**算法看不到**，只有屏幕上看得到；它只能靠一次次 rollout 去估。\n\n`
        + `最好的两个（${MOVES[0]} 和 ${MOVES[1]}）只差 **${r2(TRUE_P[0] - TRUE_P[1])}** —— 这是量过才定的：`
        + `差太小时几百轮也分不出来，差太大又随便几轮就分得出，而**"预算不够会选错"正是 MCTS 最要紧的一课**。\n\n`
        + `这一档预算 **${budget}** 轮、探索常数 **c=${c}**。`,
    })

    search(c, budget, pickRule, SEED, ({ it, picks, chosen, win, n, w, picksN, picksW }) => {
      const bv = argmaxVisit(n), br = argmaxRate(n, w)
      const p = picks[chosen]
      const firstTry = p.ucb === null
      frames.push({
        ...shared, step: frames.length, n, w, picks, picksN, picksW, chosen, win, iter: it,
        byVisit: bv, byRate: br, final: -1, right: false, phase: 'run',
        log: `第 ${it} 轮 · **选择**：`
          + picks.map(x => x.ucb === null
            ? `${MOVES[x.k]}=**∞**(没试过)`
            : `${MOVES[x.k]}=**${x.ucb}**(利用 ${x.exploit} + 探索 ${x.explore})`).join('　')
          + ` → 挑 **${MOVES[chosen]}**${firstTry ? '（没试过，先探索）' : ''}。\n\n`
          + `**模拟**：照 ${MOVES[chosen]} 的真实胜率 ${TRUE_P[chosen]} 抛一次硬币 → **${win ? '赢' : '输'}**。`
          + `**回传**：${MOVES[chosen]} 访问 ${n[chosen]} 次、赢 ${w[chosen]} 次（实测胜率 ${r2(w[chosen] / n[chosen])}）。\n\n`
          + (c === 0
            ? `⚠️ **c=0：探索项全是 0**，UCB 退化成"只看实测胜率"。谁先碰巧赢就一直押谁 —— `
              + `${MOVES.map((m, k) => `${m}${n[k]}`).join('/')}，**再多的预算也拉不回来**。`
            : bv !== br
              ? `此刻两条规则指向不同：按「访问最多」是 **${MOVES[bv]}**，按「胜率最高」是 **${MOVES[br]}**（它只试过 ${n[br]} 次）。`
              : `到这一轮为止，两条规则都指向 **${MOVES[bv]}**。`),
      })
    })

    const fin = search(c, budget, pickRule, SEED)
    const alloc = fin.n[BEST] / budget
    const first = sweep[0], big = sweep[sweep.length - 1]
    const cZero = cSweep.find(x => x.c === 0)!
    const cBig = cSweep[cSweep.length - 1]
    const cMid = cSweep.reduce((a2, x) => (x.pMax > a2.pMax ? x : a2), cSweep[0])
    const worstNow = cSweep.reduce((a2, x) => (x.pRight < a2.pRight ? x : a2), cSweep[0]).c
    const worstMax = cSweep.reduce((a2, x) => (x.pMax < a2.pMax ? x : a2), cSweep[0]).c
    const rv = ruleCmp[0], rr = ruleCmp[1]

    frames.push({
      //  ⚠️ 末帧的 UCB 表按**最终**计数重算一遍 —— 沿用最后一轮开始时那张表的话，
      //     它的"利用"列会比旁边树上的"实测胜率"落后一轮，屏幕上两个数打架。
      ...shared, step: frames.length, n: fin.n, w: fin.w,
      picks: ucbTable(fin.n, fin.w, budget, c), picksN: fin.n, picksW: fin.w,
      chosen: fin.final, win: -1, iter: budget,
      byVisit: argmaxVisit(fin.n), byRate: argmaxRate(fin.n, fin.w),
      final: fin.final, right: fin.right, phase: 'done',
      log: `**搜索结束**（共 ${budget} 次模拟）：访问 ${MOVES.map((m, k) => `${m}=${fin.n[k]}`).join('、')}，`
        + `实测胜率 ${MOVES.map((m, k) => `${m}=${fin.n[k] ? r2(fin.w[k] / fin.n[k]) : '—'}`).join('、')}。\n\n`
        + `按「访问最多」→ 选 **${MOVES[fin.final]}**。真实最优是 **${MOVES[BEST]}**（真实胜率 ${TRUE_P[BEST]}）`
        + `—— 这一次**${fin.right ? '选对了' : '选错了'}**。\n\n`
        + `⚠️ **但单看这一次的输赢是运气。** 把整场搜索**重跑 500 次**，这个配置下选对的概率是 **${pct(pRight)}**。`
        + `这才是"多花算力有多大用"的答案。\n\n`
        + `**预算扫描**（选对率）：${sweep.map(x => `${x.budget}轮 ${pct(x.pRight)}`).join('　')}\n\n`
        /*  ⚠️ 判据得写在**收敛**上，不是"涨没涨"。c=0 那档从 45% 涨到 64% 也是"涨了 19 个点"，
            可它**饱和在 64% 再也上不去** —— 按"涨没涨"分支就会印出"统计说话"那句漂亮话，
            而屏幕上的曲线正在说相反的事。 */
        + (big.pRight >= 0.9
          ? `预算从 ${first.budget} 加到 ${big.budget}，选对率 ${pct(first.pRight)} → **${pct(big.pRight)}** —— `
            + `**这才叫"靠大量随机对局的统计说话"**：单场就是抛硬币，几百场之后真实胜率才浮出来。`
          : `⚠️ **加到 ${big.budget} 轮也只有 ${pct(big.pRight)}，曲线在 ${pct(sweep[sweep.length - 3].pRight)} 附近就压平了**`
            + `（${sweep.slice(-3).map(x => `${x.budget}轮 ${pct(x.pRight)}`).join(' → ')}）。`
            + `**这一档的毛病不在算力，在 c。** c=0 时探索项恒为 0，UCB 退化成"只看实测胜率"：`
            + `开局每个走法各试一次之后，谁碰巧赢了就一直押谁，其余的**再也没有机会翻案**。`
            + `这就是"只利用、不探索"的代价 —— **它不是收敛得慢，是压根不收敛**。`)
        + `\n\n**探索常数 c** —— 两列都要看：\n`
        + cSweep.map(x => `　c=${x.c}：${budget} 轮 ${pct(x.pRight)}　｜　${MAXB} 轮 **${pct(x.pMax)}**`).join('\n')
        + `\n\n`
        /*  ⚠️ 我先写的是"四档差距还没噪声大" —— 而实测跨度 11.6 个点、噪声 ±2 点，**自己打自己**。
            量得到的不是"差距是噪声"，是**这一列把 c 排错了**：c=0 在小预算下看着中游。 */
        + (worstNow !== worstMax
          ? `⚠️ **别拿 ${budget} 轮那一列去排 c 的高下 —— 它排错了。** 这一列垫底的是 c=${worstNow}`
            + `（${pct(cSweep.find(x => x.c === worstNow)!.pRight)}），而真正有毛病的是 **c=${worstMax}**：`
            + `它在这一列有 ${pct(cSweep.find(x => x.c === worstMax)!.pRight)}、看着还行，`
            + `可加到 ${MAXB} 轮也只有 **${pct(cSweep.find(x => x.c === worstMax)!.pMax)}**。`
            + `**小预算下大家都还没来得及收敛，看不出谁根本收敛不了。**\n\n`
          : '')
        + `**要看 c，得把预算加满那一列。** c=0 停在 **${pct(cZero.pMax)}**，而 c=0.7/1.4/4 都到了 `
        + `${pct(Math.min(...cSweep.filter(x => x.c > 0).map(x => x.pMax)))} 以上。\n\n`
        + `**c=0 就是纯利用**：探索项恒为 0，开局每个走法各试一次之后，谁碰巧赢了就一直押谁，`
        + `其余的**再也没有机会翻案** —— 它不是收敛得慢，**是压根不收敛**。`
        + `**c=${cBig.c} 则几乎是均匀撒钱**（${MAXB} 轮 ${pct(cBig.pMax)}，仍是四档里最低的一个非零档）：`
        + `探索项压过了胜率差，${K} 个走法平分预算，明显差的 ${MOVES[K - 2]}/${MOVES[K - 1]} 也照样反复试。`
        + `最好的是 **c=${cMid.c}（${pct(cMid.pMax)}）** —— **"兼顾探索与利用"不是口号，是一个要调的数。**\n\n`
        /*  ⚠️ 这段话得看**钱到底挪到哪儿去了**。c=0 那档 A 只拿到 2/20，预算全砸在 B 上，
            照印"UCB 把思考往最有希望的分支上挪"就是屏幕上自相矛盾。 */
        + `**预算分配**：${budget} 次模拟里，真正最优的 ${MOVES[BEST]} 拿到 **${fin.n[BEST]}** 次（${pct(alloc)}），`
        + `垫底的 ${MOVES[K - 1]} 只有 ${fin.n[K - 1]} 次（均匀分的话每个都是 ${pct(1 / K)}）。`
        + (alloc > 1 / K
          ? `UCB 干的就是这件事：**把有限的思考往最有希望的分支上挪**，而不是均匀浪费。\n\n`
          : `⚠️ **这一档的钱没挪对地方** —— 最优的 ${MOVES[BEST]} 反而低于均匀分的 ${pct(1 / K)}，`
            + `预算堆在了 ${MOVES[fin.n.indexOf(Math.max(...fin.n))]} 上。`
            + `${c === 0 ? '这正是 c=0 的病：开局那一次输赢就把它锁死了，之后再也没回头看过。' : ''}\n\n`)
        /*  ⚠️ 这一段**不能写死成"几乎一样"**。c=4/预算 10 那一档实测是 17.0% vs 43.6%，
            差 26 个点 —— 屏幕上印着"几乎一样"、旁边摆着两个差一倍的数，是自相矛盾。
            差别从哪来也是量得到的：那一档预算被平摊成 2/2/2/2/2，**"访问最多"整个是平局**。 */
        + (Math.abs(rv.pRight - rr.pRight) < 0.08
          ? `⚠️ **有一件事这一屏量不到。** MCTS 最后取的是"**访问次数最多**"而不是"胜率最高"，`
            + `理由通常说成"胜率会被只试过一两次、碰巧全赢的走法骗走"。但在这个**扁平的 ${K} 选一**上，`
            + `实测两条规则的选对率是 **${pct(rv.pRight)}（访问最多）vs ${pct(rr.pRight)}（胜率最高）**，`
            + `**几乎一样**。真实 MCTS 里取访问次数的理由在**树**上（深层节点的价值估计方差更大、还被对手挑剔过），`
            + `而这一屏根本没有树。**量不到就说量不到** —— 别拿"看起来一样"当成"两者等价"的结论。\n\n`
          : `⚠️ **这一档两条最终决策规则差得很远**：访问最多 **${pct(rv.pRight)}**、胜率最高 **${pct(rr.pRight)}**。`
            + (Math.max(...fin.n) - Math.min(...fin.n) <= 1
              ? `原因就摆在访问次数上：**预算被平摊成 ${fin.n.join('/')}，"访问最多"整个是平局**，`
                + `只能随机拆 —— 于是它退化成瞎猜（${pct(1 / K)}）。而"胜率最高"还分得出高下。\n\n`
                + `**这不是"胜率规则更好"，是"访问计数在均匀分配下根本没携带信息"。** `
                + `真实 MCTS 敢用访问次数，前提正是 UCB 已经把预算拉开了差距 —— c 调过头，这个前提就没了。\n\n`
              : `访问次数是 ${fin.n.join('/')}。\n\n`)
          )
        + `MCTS 是 AlphaGo/AlphaZero 的引擎（配神经网络给出先验和价值），和**思维树 ToT** 一脉相承——都是带评估的树搜索。`,
    })

    const base0: Frame = {
      ...shared, step: -1, n: zeros(), w: zeros(), picks: noPicks(), picksN: zeros(), picksW: zeros(),
      chosen: -1, win: -1, iter: 0, byVisit: -1, byRate: -1, final: -1, right: false, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '模拟轮' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
