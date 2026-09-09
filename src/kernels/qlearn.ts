/**
 * 内核：强化学习 —— 值迭代 vs **真的 Q-learning**（机器学习算法）
 * 轴：**学习进度**（值迭代=第几轮 Bellman 扫描；Q-learning=跑到第几个 episode）
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。上一轮已经把"γ^曼哈顿距离"那个假的倒推换成了**真的值迭代**
 * （V 初始全 0、每轮扫全图取 max_a[R + γ·V(s')]、遇墙自动绕）。这一版补的是
 * **它自己最后那句话**：
 *   「值迭代 = 有模型的规划；**Q-learning = 同一套 Bellman、但从经验里免模型地学**」
 * —— 这个实验的名字叫 **Q-learning**，跑的却一直是值迭代。
 *
 * 差别不是措辞：值迭代每更新一格，都要**枚举它的四个邻居、读它们的价值** ——
 * 那等于**手里有地图**。真实的智能体没有地图，只有一串 (s, a, r, s')。
 *
 * 这一版：
 * ① **算法做成旋钮**：
 *    - **值迭代（知道地图）**：原来那套，全图扫描。
 *    - **Q-learning（只有经验）**：ε-greedy 走出轨迹，只用走过的那一步更新
 *      Q(s,a) ← Q(s,a) + α[r + γ·max_a' Q(s',a') − Q(s,a)]。**一次都不查地图。**
 * ② **探索率 ε 做成旋钮**（0 / 0.1 / 0.3 / 1.0）。ε=0 就只会重复第一次撞对的那条路。
 * ③ **"学对了没有"是独立真值**：拿**值迭代收敛后的最优策略**当标尺，
 *    逐格数 Q-learning 学错了几格。⚠️ 不问 Q-learning 自己。
 * ④ **代价上屏，而且是两种不同的代价**：
 *    值迭代 = 多少次 Bellman 更新（**但要求你有地图**）；
 *    Q-learning = 走了多少步真实经验（**不需要地图**）。这才是"免模型"的价格。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数与地图
// ═══════════════════════════════════════════════════════════════

const A_VI = '值迭代（知道地图）'
const A_QL = 'Q-learning（只有经验）'
export const QL_ALGOS = [A_VI, A_QL] as const
export const QL_EPS = [0, 0.1, 0.3, 1] as const

const W = 5, H = 4
const GOAL: [number, number] = [4, 1]
const START: [number, number] = [0, 2]
const GAMMA = 0.9
const ALPHA = 0.5
//  竖墙：第 2 列的 row0/1/2 是墙（row3 留缺口），逼着绕下面走。
const WALLS = new Set(['2,0', '2,1', '2,2'])
const r3 = (x: number) => Math.round(x * 1000) / 1000
const idx = (c: number, r: number) => c + r * W
const isWall = (c: number, r: number) => WALLS.has(`${c},${r}`)
const inGrid = (c: number, r: number) => c >= 0 && c < W && r >= 0 && r < H
const walkable = (c: number, r: number) => inGrid(c, r) && !isWall(c, r)
const NB: [number, number, string][] = [[1, 0, '→'], [-1, 0, '←'], [0, 1, '↓'], [0, -1, '↑']]
const isGoal = (c: number, r: number) => c === GOAL[0] && r === GOAL[1]

/** 种子化 PRNG —— 探索要真随机，整个实验又必须可复现 */
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
//  值迭代 —— 它**读得到每个邻居的价值**，也就是手里有地图
// ═══════════════════════════════════════════════════════════════

/** 贪心策略：朝价值最高的可走邻居；终点=★ */
function greedyFromV(V: (number | null)[]): (string | null)[] {
  const pol: (string | null)[] = Array(W * H).fill(null)
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (isWall(c, r)) continue
    if (isGoal(c, r)) { pol[idx(c, r)] = '★'; continue }
    let bestV = -Infinity, bestDir = ''
    for (const [dc, dr, sym] of NB) {
      const nc = c + dc, nr = r + dr
      if (!walkable(nc, nr)) continue
      const v = V[idx(nc, nr)] ?? 0
      if (v > bestV) { bestV = v; bestDir = sym }
    }
    pol[idx(c, r)] = bestV > 0 ? bestDir : null
  }
  return pol
}

/** 跑到收敛的值迭代 —— 这一份当**真值标尺** */
function valueIteration(emit?: (e: { sweep: number; V: number[]; changed: number; updates: number }) => void) {
  let V = Array(W * H).fill(0); V[idx(...GOAL)] = 1
  let sweep = 0, updates = 0
  while (sweep < 30) {
    sweep++
    const nV = V.slice()
    let changed = 0
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (isWall(c, r) || isGoal(c, r)) continue
      updates++
      let best = 0
      //  ⚠️ 这一行就是"有模型"：它**直接读得到每个邻居的价值**。真实智能体没有这个。
      for (const [dc, dr] of NB) { const nc = c + dc, nr = r + dr; if (walkable(nc, nr)) best = Math.max(best, GAMMA * V[idx(nc, nr)]) }
      if (r3(best) !== r3(V[idx(c, r)])) changed++
      nV[idx(c, r)] = best
    }
    V = nV
    emit?.({ sweep, V: V.slice(), changed, updates })
    if (changed === 0) break
  }
  return { V, sweeps: sweep, updates }
}

// ═══════════════════════════════════════════════════════════════
//  Q-learning —— 只有 (s, a, r, s')，**一次都不查地图**
// ═══════════════════════════════════════════════════════════════

/** Q 表：每格四个动作。用 max_a Q(s,a) 当这一格的"价值"显示 */
type Q = number[][]
const newQ = (): Q => Array.from({ length: W * H }, () => [0, 0, 0, 0])
const maxQ = (q: number[]) => Math.max(...q)

function greedyFromQ(Q: Q): (string | null)[] {
  const pol: (string | null)[] = Array(W * H).fill(null)
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (isWall(c, r)) continue
    if (isGoal(c, r)) { pol[idx(c, r)] = '★'; continue }
    const q = Q[idx(c, r)]
    const m = maxQ(q)
    //  全 0 = 这一格根本没学到东西，别装作有策略
    pol[idx(c, r)] = m > 0 ? NB[q.indexOf(m)][2] : null
  }
  return pol
}

/**
 * 跑 Q-learning。
 * ⚠️ 更新式里**只出现 s、a、r、s'** —— 没有一处枚举邻居、没有一处读地图。
 * 撞墙/出界就是原地不动、奖励 0（智能体是"撞了才知道"的）。
 */
function qlearning(
  episodes: number, eps: number, seed: number,
  emit?: (e: { ep: number; Q: Q; steps: number; hits: number }) => void,
  checkpoints?: number[],
) {
  const rand = rng(seed)
  const Q = newQ()
  let steps = 0, hits = 0
  const cps = new Set(checkpoints ?? [])
  for (let ep = 1; ep <= episodes; ep++) {
    let [c, r] = START
    for (let t = 0; t < 200; t++) {
      const q = Q[idx(c, r)]
      //  ε-greedy：以 ε 的概率随便走一步，否则走当前 Q 最大的动作（平局随机拆）
      let a: number
      if (rand() < eps) {
        a = Math.floor(rand() * 4)
      } else {
        const m = maxQ(q)
        const ties: number[] = []
        for (let k = 0; k < 4; k++) if (q[k] === m) ties.push(k)
        a = ties[Math.floor(rand() * ties.length)]
      }
      const [dc, dr] = NB[a]
      const nc = c + dc, nr = r + dr
      //  撞墙就原地不动 —— 智能体**撞了才知道**这儿有墙，不是查表查出来的
      const ok = walkable(nc, nr)
      const sc = ok ? nc : c, sr = ok ? nr : r
      const reward = isGoal(sc, sr) ? 1 : 0
      //  Q(s,a) ← Q(s,a) + α[r + γ·max_a' Q(s',a') − Q(s,a)]
      const target = reward + (isGoal(sc, sr) ? 0 : GAMMA * maxQ(Q[idx(sc, sr)]))
      Q[idx(c, r)][a] += ALPHA * (target - Q[idx(c, r)][a])
      steps++
      c = sc; r = sr
      if (isGoal(c, r)) { hits++; break }
    }
    if (cps.has(ep)) emit?.({ ep, Q: Q.map(x => x.slice()), steps, hits })
  }
  return { Q, steps, hits }
}

// ═══════════════════════════════════════════════════════════════
//  状态
// ═══════════════════════════════════════════════════════════════

export type QLearnState = {
  i: number
  step: number
  w: number; h: number
  goal: [number, number]; start: [number, number]
  gamma: number
  algo: string
  eps: number
  walls: string[]
  /** 每格价值（值迭代=V；Q-learning=max_a Q(s,a)），墙=null */
  value: (number | null)[]
  /** 每格贪心策略箭头 */
  policy: (string | null)[]
  /** ⭐ **真值**：值迭代收敛后的最优策略。Q-learning 学对没有，拿它数 */
  truePolicy: (string | null)[]
  trueValue: (number | null)[]
  /** 策略跟真值不一样的格子数（越小越好；0=学到最优） */
  wrongCells: number
  /** 还完全没学到东西的格子（Q 全 0）—— Q-learning 只学得到它走过的地方 */
  unlearned: number
  /** 可走的非终点格子总数 */
  cells: number
  /** 值迭代：第几轮扫描；Q-learning：第几个 episode */
  sweep: number
  sweeps: number
  converged: boolean
  changed: number
  /** 代价：值迭代 = Bellman 更新次数（要地图）；Q-learning = 走过多少步经验（不要地图） */
  updates: number
  expSteps: number
  /** Q-learning 走到终点过几次 */
  hits: number
  /** 两种算法的账并排 */
  cmp: {
    algo: string; eps: number; cost: string; wrongCells: number; unlearned: number
    /** 代价的**数**（值迭代=Bellman 更新次数；Q-learning=经验步数）—— 单位不一样，但都要能画进表 */
    n: number
    /** 需不需要地图 —— 这一栏才是两者真正的分野 */
    needsMap: boolean
    /** 从起点跟着学出的策略走，几步到终点（-1=走不到） */
    pathSteps: number
  }[]
  path: string[]
  phase: 'run' | 'done'
  log: string
}

export const QLEARN_VISIBLE = [
  'step', 'w', 'h', 'goal', 'start', 'gamma', 'algo', 'eps', 'walls', 'value', 'policy',
  'truePolicy', 'trueValue', 'wrongCells', 'unlearned', 'cells', 'sweep', 'sweeps', 'converged',
  'changed', 'updates', 'expSteps', 'hits', 'cmp', 'path', 'phase', 'log',
] as const
type Frame = Omit<QLearnState, 'i'>

const EPISODES = 400
const CHECKPOINTS = [1, 2, 5, 10, 25, 50, 100, 200, 400]
const SEED = 20260909

export const qlearnKernel: Kernel<QLearnState> = {
  kind: 'qlearn',

  compile(doc: SimDocument): CompiledModel<QLearnState> {
    const algo = String(doc.params.algo ?? A_QL)
    const eps = Number(doc.params.eps ?? 0.3)
    const wallsArr = [...WALLS]
    const mask = (V: number[]): (number | null)[] => V.map((v, k) => (isWall(k % W, Math.floor(k / W)) ? null : r3(v)))

    //  ⭐ 真值标尺：值迭代跑到收敛。Q-learning 学对没有，拿它数 —— 不问 Q-learning 自己
    const truth = valueIteration()
    const trueValue = mask(truth.V)
    const truePolicy = greedyFromV(trueValue)
    //  可走的非终点格子（策略要学的就是这些）
    const cells = truePolicy.filter((p, k) => p !== null && p !== '★' && !isWall(k % W, Math.floor(k / W))).length

    /** 逐格跟真值比：策略不一样的算学错 */
    const diff = (pol: (string | null)[]) => {
      let wrong = 0, none = 0
      for (let k = 0; k < W * H; k++) {
        if (truePolicy[k] === null || truePolicy[k] === '★') continue
        if (pol[k] === null) { none++; wrong++ } else if (pol[k] !== truePolicy[k]) wrong++
      }
      return { wrong, none }
    }

    //  两种算法的账并排 —— 代价的**单位都不一样**，这本身就是那句话的落点
    /** 从起点跟着一份策略走，几步到终点（-1=半路没箭头，走不到） */
    const walk = (pol: (string | null)[]) => {
      let [c, r] = START, n = 0
      while (!isGoal(c, r) && n < 60) {
        const dir = pol[idx(c, r)]
        if (dir === '→') c++; else if (dir === '←') c--; else if (dir === '↓') r++; else if (dir === '↑') r--; else return -1
        n++
      }
      return isGoal(c, r) ? n : -1
    }
    const qlAt = (e: number) => {
      const r = qlearning(EPISODES, e, SEED)
      const pol = greedyFromQ(r.Q)
      const d = diff(pol)
      return {
        algo: A_QL, eps: e, cost: `${r.steps} 步经验`, n: r.steps, needsMap: false,
        wrongCells: d.wrong, unlearned: d.none, pathSteps: walk(pol),
      }
    }
    const cmp = [
      { algo: A_VI, eps: -1, cost: `${truth.updates} 次 Bellman 更新`, n: truth.updates, needsMap: true,
        wrongCells: 0, unlearned: 0, pathSteps: walk(truePolicy) },
      ...QL_EPS.map(qlAt),
    ]

    const frames: Frame[] = []
    const shared = {
      w: W, h: H, goal: GOAL, start: START, gamma: GAMMA, algo, eps, walls: wallsArr,
      truePolicy, trueValue, cells, cmp,
    }

    const zeroV = mask(Array(W * H).fill(0))
    frames.push({
      ...shared, step: 0, value: zeroV, policy: Array(W * H).fill(null),
      wrongCells: cells, unlearned: cells, sweep: 0, sweeps: 0, converged: false, changed: 0,
      updates: 0, expSteps: 0, hits: 0, path: [], phase: 'run',
      log: `5×4 走迷宫（灰=墙），只有**终点（★）有 +1**、γ=${GAMMA}。价值初始全 0，智能体不知道路。\n\n`
        + (algo === A_VI
          ? `这一档跑的是**值迭代**：每轮扫全图，每格取 **max_a[奖励 + γ·邻居价值]**。\n\n`
            + `⚠️ **注意"邻居价值"这四个字** —— 它要读得到每个邻居的价值，那等于**手里有地图**。`
            + `真实的智能体没有地图，只有一串"我在哪、做了什么、拿到多少、到了哪"。**把「算法」换成 Q-learning 再看。**`
          : `这一档跑的是**真的 Q-learning**：ε-greedy 走出一条条轨迹，只用走过的那一步更新\n\n`
            + `　　**Q(s,a) ← Q(s,a) + α[ r + γ·max Q(s',a') − Q(s,a) ]**\n\n`
            + `⚠️ **这个式子里只有 s、a、r、s'** —— 没有一处枚举邻居、没有一处查地图。`
            + `撞墙就原地不动、奖励 0，它是**撞了才知道**那儿有墙的。探索率 ε=**${eps}**。\n\n`
            + `屏幕上那张"真值策略"是另跑一遍值迭代算的 —— **Q-learning 看不到它**，只用来数它学错了几格。`),
    })

    if (algo === A_VI) {
      valueIteration(({ sweep, V, changed, updates }) => {
        const val = mask(V)
        const pol = greedyFromV(val)
        const d = diff(pol)
        frames.push({
          ...shared, step: frames.length, value: val, policy: pol,
          wrongCells: d.wrong, unlearned: d.none, sweep, sweeps: sweep,
          converged: changed === 0, changed, updates, expSteps: 0, hits: 0, path: [],
          phase: changed === 0 ? 'done' : 'run',
          log: changed === 0
            ? `**第 ${sweep} 轮**：没有格子的价值再变（changed=0）→ **收敛**。价值满全图，每格 = γ^到终点最短路（绕墙）。`
            : `**第 ${sweep} 轮 Bellman 扫描**：价值向外扩一圈，本轮 **${changed}** 格更新。`
              + `挨着终点的先变 0.9，再外一圈 0.81…遇墙就绕。已做 ${updates} 次 Bellman 更新，`
              + `还有 **${d.wrong}** 格的策略跟最优不一样。`,
        })
      })
    } else {
      qlearning(EPISODES, eps, SEED, ({ ep, Q, steps, hits }) => {
        const val = mask(Q.map(q => maxQ(q)))
        const pol = greedyFromQ(Q)
        const d = diff(pol)
        frames.push({
          ...shared, step: frames.length, value: val, policy: pol,
          wrongCells: d.wrong, unlearned: d.none, sweep: ep, sweeps: ep,
          converged: d.wrong === 0, changed: 0, updates: 0, expSteps: steps, hits, path: [],
          phase: 'run',
          log: `**跑完第 ${ep} 个 episode**（累计走了 ${steps} 步经验、到过终点 ${hits} 次）。\n\n`
            + `策略跟最优不一样的还有 **${d.wrong} / ${cells}** 格`
            + (d.none > 0 ? `，其中 **${d.none}** 格**根本没学到东西**（Q 全 0）—— **Q-learning 只学得到它走过的地方**。` : `。`)
            + (d.wrong === 0 ? `\n\n✅ **已经学到最优策略了。**` : ''),
        })
      }, CHECKPOINTS)
    }

    //  ── 末帧：路径 + 两种代价的对照
    const lastF = frames[frames.length - 1]
    const finalPol = lastF.policy
    const path: string[] = []
    let [cc, cr] = START, guard = 0
    while (!isGoal(cc, cr) && guard++ < 50) {
      path.push(`${cc},${cr}`)
      const dir = finalPol[idx(cc, cr)]
      if (dir === '→') cc++; else if (dir === '←') cc--; else if (dir === '↓') cr++; else if (dir === '↑') cr--; else break
    }
    const reached = isGoal(cc, cr)
    if (reached) path.push(`${GOAL[0]},${GOAL[1]}`)
    const truePath: string[] = []
    let [tc, tr] = START, g2 = 0
    while (!isGoal(tc, tr) && g2++ < 50) {
      truePath.push(`${tc},${tr}`)
      const dir = truePolicy[idx(tc, tr)]
      if (dir === '→') tc++; else if (dir === '←') tc--; else if (dir === '↓') tr++; else if (dir === '↑') tr--; else break
    }
    truePath.push(`${GOAL[0]},${GOAL[1]}`)

    const viRow = cmp[0]
    const qlRow = cmp.find(x => x.algo === A_QL && x.eps === eps)
    lastF.path = path
    lastF.phase = 'done'
    lastF.log += `\n\n**从起点跟着箭头走**：${reached ? `${path.length - 1} 步到终点` : '⚠️ **走不到终点**（半路没有箭头）'}。`
      + `最优是 **${truePath.length - 1}** 步（绕墙，比曼哈顿的 5 步长 —— 这正是"距离公式"给不出、只有真学出来才有的）。\n\n`
      + `**两种算法的账**（同一张图）：\n`
      + `　${viRow.algo}：${viRow.cost}，学错 0 格\n`
      + cmp.filter(x => x.algo === A_QL).map(x =>
        `　${x.algo}　ε=${x.eps}：${x.cost}，学错 ${x.wrongCells} 格（其中 ${x.unlearned} 格没学到）`).join('\n')
      + `\n\n⚠️ **这两行的代价单位根本不一样，而那正是重点。** `
      + `值迭代只要 ${viRow.cost.split('（')[0]}就收敛了，看着便宜得多 —— **但它要求你手里有一张地图**：`
      + `每更新一格都要读得到四个邻居的价值。**真实的智能体没有地图**，`
      + `它只有一串"我在哪、做了什么、拿到多少、到了哪"。\n\n`
      + `Q-learning 用 ${qlRow?.n} 步经验换来了**不需要地图**。`
      + `**"免模型"不是免费的，它的价格就是这些经验步数。**\n\n`
      + (algo === A_QL
        ? (() => {
          const e0 = cmp.find(x => x.algo === A_QL && x.eps === 0)!
          const e1 = cmp.find(x => x.algo === A_QL && x.eps === 1)!
          const best = cmp.filter(x => x.algo === A_QL).reduce((a2, x) => (x.wrongCells < a2.wrongCells ? x : a2))
          /*  ⚠️ 这一段我先写死成"ε=1 完全乱走、学得到但慢"，紧接着又印出"这一列最好的是 ε=1" ——
              自己打自己。实测就是：**乱走学得最全**（小网格上均匀探索的覆盖率最高），
              代价是 10 倍的经验。话得跟着这两个数走。 */
          return `**探索率 ε 那几行值得单看。**\n\n`
            + `**ε=0（一点不探索）**：学错 **${e0.wrongCells}** 格，其中 **${e0.unlearned}** 格 Q 全是 0 —— `
            + `**这些格子它这辈子都没去过**。可它从起点走出来的路照样是 ${e0.pathSteps} 步（最优也是 ${truePath.length - 1} 步）：`
            + `**它只学会了那一条路**，一旦被放到别处就抓瞎。「学到最优路径」和「学到最优策略」是两件事。\n\n`
            + `**ε=1（完全乱走）**：反而学得最全（只错 ${e1.wrongCells} 格）—— 小网格上均匀探索的覆盖率最高。`
            + `**但代价是 ${e1.n} 步经验，是 ε=${eps} 那档的 ${(e1.n / (qlRow?.n || 1)).toFixed(1)} 倍。**\n\n`
            + `所以这一列不是"谁错得少谁赢"，得连着经验步数一起看：`
            + cmp.filter(x => x.algo === A_QL).map(x =>
              `ε=${x.eps} 花 ${x.n} 步换 ${cells - x.wrongCells}/${cells} 格`).join('、')
            + `。跟 MCTS 里那个 c 是同一课：**探索和利用得兼顾，而且它是一个要调的数。**`
        })()
        : `**把「算法」换成 Q-learning 再看** —— 同一张图，它得走上千步经验才学得出来，但全程一次地图都没查过。`)
      + `\n\nRL 是 AlphaGo、机器人控制、推荐、大模型 RLHF 的底子。**值迭代 = 有模型的规划；Q-learning = 同一套 Bellman，但从经验里免模型地学。**`

    const base0: Frame = {
      ...shared, step: -1, value: zeroV, policy: Array(W * H).fill(null),
      wrongCells: cells, unlearned: cells, sweep: 0, sweeps: 0, converged: false, changed: 0,
      updates: 0, expSteps: 0, hits: 0, path: [], phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: algo === A_VI ? 'Bellman 扫描轮' : '经验（episode）' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const j = b.i + 1
        if (j >= frames.length) return null
        return { state: { i: j, ...frames[j] }, done: j === frames.length - 1 }
      },
    }
  },
}
