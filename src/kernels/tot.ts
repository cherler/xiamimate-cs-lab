/**
 * 内核：思维树 ToT（大模型算法）
 * 轴：生成 → 评估 → 剪枝 → 逐条深入（可回溯）→ 结论
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。上一版把"单层假树"做成了"两层树"，但**整棵树仍然是写死的常量表**：
 *   `L1_DEF`（5 个手挑的想法 + 手写的 sure/impossible）、`L2_DEF`（3 个都能到 24 的叶子）、
 *   `SOLUTION = '3×4=12，12×2=24'`
 * —— 没有一次搜索发生过，剪掉的两条是我预先标好的，解也是我预先写好的。
 *
 * 而它自己的正文和导览里写着三句从没兑现过的话：
 *   ①「走不通还能**回溯**换另一条」—— 每条留下的分支都能到 24，一次回溯都没发生过。
 *   ②「**评估器**给每个分支判前景」「**评估中间状态往往比解题本身还难**，
 *      模型对自己中间步骤的评估往往不可靠」—— 评估器从来没判错过，
 *      **而"判错了会怎样"正是 ToT 最要紧的一课**：剪掉的枝再也回不来，回溯救不了它。
 *   ③「**代价**：成本成倍甚至十倍地涨」—— 屏幕上一个计数都没有。
 *
 * 这一版：
 * ① **真搜索**：第一层枚举所有 (取两个数 × 六种运算) 的结果，第二层再枚举一次。
 *    不是 5 个手挑的想法，是**全部**候选。
 * ② **评估器做成旋钮**：
 *    - **完美评估器**：真去枚举剩下的数能不能到 24，只剪真死路。
 *    - **像大模型那样（会判错）**：一条听起来很有道理的启发式 ——「别把数弄得比目标还大」。
 *      它在 {1,5,5} 上会把**唯一的解**（5×5=25 → 25−1=24）当成死路剪掉。
 *    - **不评估（不剪枝）**：全展开。一定找得到，但代价翻好几倍 —— 这是剪枝的对照组。
 * ③ **题目做成旋钮**：好解的 / 只有一条路通的 / **无解的**。
 * ④ **"到底有没有解"是独立真值**：另跑一遍**不剪枝的穷举**当真相，不问 ToT 自己。
 * ⑤ **代价上屏**：生成了多少节点、评估器被调用了多少次、回溯了几次。
 *    并排摆着思维链（一条线 = 1 次生成）和不剪枝穷举的账。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const E_PERFECT = '完美评估器（真去枚举）'
const E_NOISY = '像大模型那样（会判错）'
const E_NONE = '不评估（不剪枝）'
export const TOT_EVALS = [E_PERFECT, E_NOISY, E_NONE] as const

const P_EASY = '{2, 3, 4}（好解）'
const P_HARD = '{1, 5, 5}（只有一条路通）'
const P_NONE = '{3, 3, 8}（无解）'
export const TOT_PUZZLES = [P_EASY, P_HARD, P_NONE] as const

const NUMS: Record<string, number[]> = {
  [P_EASY]: [2, 3, 4],
  [P_HARD]: [1, 5, 5],
  [P_NONE]: [3, 3, 8],
}
const TARGET = 24
const EPS = 1e-9

// ═══════════════════════════════════════════════════════════════
//  24 点的真运算（不是查表）
// ═══════════════════════════════════════════════════════════════

/** 一步运算的结果：算式 + 得数。减法和除法**跟顺序有关**，所以两个方向都要出。 */
type Move = { expr: string; v: number }

const fmt = (x: number) => {
  const r = Math.round(x * 1000) / 1000
  return Number.isInteger(r) ? String(r) : String(r)
}

/** 从一组数里取两个做一次运算，返回所有可能的结果（含剩下的数） */
function moves(nums: number[]): { m: Move; rest: number[] }[] {
  const out: { m: Move; rest: number[] }[] = []
  const seen = new Set<string>()
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue
      const a = nums[i], b = nums[j]
      const rest = nums.filter((_, k) => k !== i && k !== j)
      const cands: Move[] = [
        { expr: `${fmt(a)} + ${fmt(b)}`, v: a + b },
        { expr: `${fmt(a)} − ${fmt(b)}`, v: a - b },
        { expr: `${fmt(a)} × ${fmt(b)}`, v: a * b },
      ]
      if (Math.abs(b) > EPS) cands.push({ expr: `${fmt(a)} ÷ ${fmt(b)}`, v: a / b })
      for (const m of cands) {
        //  加法和乘法交换律 —— 同一个算式别出两遍
        const key = `${m.v.toFixed(6)}|${[...rest].sort((x, y) => x - y).join(',')}|${m.expr.includes('+') || m.expr.includes('×') ? [a, b].sort((x, y) => x - y).join(m.expr.includes('+') ? '+' : '×') : m.expr}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ m, rest })
      }
    }
  }
  return out
}

/**
 * **独立真值**：不剪枝的穷举 —— 这组数到底能不能凑出 24，解是什么。
 * ⚠️ 「找到解了吗」不能问 ToT 自己：它剪错了枝也会一口咬定"无解"。
 */
function bruteSolve(nums: number[]): { ok: boolean; path: string[]; nodes: number } {
  let nodes = 0
  const rec = (cur: number[], trail: string[]): string[] | null => {
    nodes++
    if (cur.length === 1) return Math.abs(cur[0] - TARGET) < EPS ? trail : null
    for (const { m, rest } of moves(cur)) {
      const hit = rec([...rest, m.v], [...trail, `${m.expr} = ${fmt(m.v)}`])
      if (hit) return hit
    }
    return null
  }
  const path = rec(nums, [])
  return { ok: path !== null, path: path ?? [], nodes }
}

/**
 * 评估器：给一个中间状态判前景（这条路还有没有希望到 24）。
 *
 * - **完美**：真去穷举剩下的数。只剪真死路 —— 但**在现实里这等于已经把题解了**，
 *   所以它只是这一屏的对照组，不是真实 ToT 拿得到的东西。
 * - **有噪声**：一条听起来很有道理的启发式 ——「别把数弄得比目标还大」。
 *   现实里大模型给中间状态打分，用的就是这种"看着像不像"的直觉。
 *   ⚠️ 它在 {1,5,5} 上会把**唯一的解**剪掉：5×5=25 已经超过 24，看着没救了，
 *   可 25−1 恰好就是 24 —— **减法的存在让这条规则站不住**。
 * - **不评估**：一律判 sure，谁也不剪。
 */
function evaluate(kind: string, state: number[]): { sure: boolean; inner: number } {
  if (kind === E_NONE) return { sure: true, inner: 0 }
  if (kind === E_PERFECT) {
    //  ⚠️ **它内部真的跑了一遍穷举** —— 这笔账必须记下来。
    //     只数"外面展开了几个节点"的话，完美评估器看着又准又省，
    //     而它省下来的那些节点，是在评估器里面走完的。
    const b = bruteSolve(state)
    return { sure: b.ok, inner: b.nodes }
  }
  //  E_NOISY：剩下的数里只要有一个超过目标，就判它没救了。**一眼就看得出，不用搜**
  return { sure: state.every(x => x <= TARGET + EPS), inner: 0 }
}

// ═══════════════════════════════════════════════════════════════
//  状态
// ═══════════════════════════════════════════════════════════════

/** 第一层的一个想法（分支） */
export type TotNode = {
  op: string
  state: string
  /** 评估器判的前景。⚠️ 这是**评估器说的**，不一定对 */
  sure: boolean
  /** 这条路**真的**有没有希望（穷举算的真值）—— 用来抓评估器判错 */
  trulySure: boolean
  evaluated: boolean
  pruned: boolean
  onPath: boolean
  /** 已经深入过（DFS 走进去过） */
  visited: boolean
}
/** 第二层的一个叶子 */
export type TotLeaf = { parent: number; op: string; solves: boolean; onPath: boolean }

/** 三档评估器的账，并排比 */
export type TotCost = {
  evalKind: string; nodes: number; evals: number; found: boolean
  /**  评估器**内部**走掉的节点。完美评估器的"又准又省"全靠这一栏没记账 ——
       记上之后它常常比不剪枝还贵，**而这正是"现实里没有完美评估器"的算术版本**。 */
  evalNodes: number
  /** 真实总账 = 外面展开的 + 评估器里面走的 */
  total: number
}

export type ToTState = {
  i: number
  step: number
  target: number
  root: string
  nums: number[]
  evalKind: string
  puzzle: string
  l1: TotNode[]
  l2: TotLeaf[]
  stage: 'root' | 'generate' | 'evaluate' | 'prune' | 'expand' | 'done'
  /** 剪枝后留下的分支数 */
  kept: number
  /** 正在深入第几条（-1=还没开始） */
  trying: number
  /** 回溯次数：试了一条、走不通退回来换下一条 */
  backtracks: number
  /** 解所在的第一层下标（-1=还没找到） */
  solL1: number
  solution: string
  /** ToT 这一趟**声称**的结果 */
  claimFound: boolean
  /** **真值**：这题到底有没有解、解是什么（不剪枝穷举算的，不问 ToT） */
  trulySolvable: boolean
  truePath: string[]
  /** 评估器把有希望的枝剪掉了几条 —— 剪错就再也回不来 */
  wrongPrunes: number
  /** 代价：生成了多少节点、评估器被调了多少次、评估器**内部**又走了多少 */
  nodes: number
  evals: number
  evalNodes: number
  /** 三档评估器的账，并排 */
  costs: TotCost[]
  /** 穷举（不剪枝、走到底）要访问多少节点 —— 剪枝省下的就是这个差 */
  bruteNodes: number
  phase: 'run' | 'done'
  log: string
}

export const TOT_VISIBLE = [
  'step', 'target', 'root', 'nums', 'evalKind', 'puzzle', 'l1', 'l2', 'stage', 'kept', 'trying',
  'backtracks', 'solL1', 'solution', 'claimFound', 'trulySolvable', 'truePath', 'wrongPrunes',
  'nodes', 'evals', 'evalNodes', 'costs', 'bruteNodes', 'phase', 'log',
] as const

type Frame = Omit<ToTState, 'i'>

/**
 * 跑一趟 ToT。
 * `emit` 是"只算账"和"逐帧出画面"之间**唯一**的差别 —— 不另写一份重放。
 */
function runToT(
  nums: number[], evalKind: string,
  emit?: (e: { kind: 'gen' | 'eval' | 'prune' | 'try' | 'solve' | 'fail'; l1: TotNode[]; l2: TotLeaf[]
    trying: number; backtracks: number; nodes: number; evals: number; evalNodes: number
    solL1: number; solution: string }) => void,
) {
  let nodes = 0, evals = 0, backtracks = 0
  //  评估器**内部**走掉的节点。完美评估器的"便宜"全藏在这一项里
  let evalNodes = 0

  //  ① 生成第一层：**全部**候选，不是手挑的 5 个
  const gen = moves(nums)
  const l1: TotNode[] = gen.map(({ m, rest }) => {
    nodes++
    const st = [...rest, m.v]
    return {
      op: `${m.expr} = ${fmt(m.v)}`,
      state: `{${st.map(fmt).join(', ')}}`,
      sure: false, trulySure: bruteSolve(st).ok,
      evaluated: false, pruned: false, onPath: false, visited: false,
    }
  })
  emit?.({ kind: 'gen', l1: l1.map(x => ({ ...x })), l2: [], trying: -1, backtracks, nodes, evals, evalNodes, solL1: -1, solution: '' })

  //  ② 评估：每条分支调一次评估器（**这就是 ToT 的开销大头**）
  //  ⚠️「不评估」那档必须记 0 次 —— 第一版不管哪档都 +1，于是"不评估"的账上写着
  //     调用了 18 次评估器，三档并排的表直接失去意义。
  gen.forEach(({ m, rest }, k) => {
    if (evalKind !== E_NONE) evals++
    const e = evaluate(evalKind, [...rest, m.v])
    evalNodes += e.inner
    l1[k].sure = e.sure
    l1[k].evaluated = true
  })
  emit?.({ kind: 'eval', l1: l1.map(x => ({ ...x })), l2: [], trying: -1, backtracks, nodes, evals, evalNodes, solL1: -1, solution: '' })

  //  ③ 剪枝
  l1.forEach(t => { t.pruned = !t.sure })
  const keptIdx = l1.map((t, k) => (t.pruned ? -1 : k)).filter(k => k >= 0)
  emit?.({ kind: 'prune', l1: l1.map(x => ({ ...x })), l2: [], trying: -1, backtracks, nodes, evals, evalNodes, solL1: -1, solution: '' })

  //  ④ 逐条深入 —— **走不通就退回来换下一条，这才是回溯**
  const l2: TotLeaf[] = []
  let solL1 = -1, solution = ''
  for (let t = 0; t < keptIdx.length; t++) {
    const k = keptIdx[t]
    l1[k].visited = true
    const st = [...gen[k].rest, gen[k].m.v]
    let hitHere = -1
    for (const { m } of moves(st)) {
      nodes++
      const solves = Math.abs(m.v - TARGET) < EPS
      l2.push({ parent: k, op: `${m.expr} = ${fmt(m.v)}`, solves, onPath: false })
      if (solves && hitHere < 0) hitHere = l2.length - 1
    }
    if (hitHere >= 0) {
      solL1 = k
      l1[k].onPath = true
      l2[hitHere].onPath = true
      solution = `${l1[k].op}，${l2[hitHere].op}`
      emit?.({ kind: 'solve', l1: l1.map(x => ({ ...x })), l2: l2.map(x => ({ ...x })), trying: k, backtracks, nodes, evals, evalNodes, solL1, solution })
      break
    }
    //  这条走不通 —— **回溯**，退回根换下一条
    backtracks++
    emit?.({ kind: 'try', l1: l1.map(x => ({ ...x })), l2: l2.map(x => ({ ...x })), trying: k, backtracks, nodes, evals, evalNodes, solL1: -1, solution: '' })
  }
  if (solL1 < 0) {
    emit?.({ kind: 'fail', l1: l1.map(x => ({ ...x })), l2: l2.map(x => ({ ...x })), trying: -1, backtracks, nodes, evals, evalNodes, solL1: -1, solution: '' })
  }

  const wrongPrunes = l1.filter(t => t.pruned && t.trulySure).length
  return { l1, l2, kept: keptIdx.length, solL1, solution, nodes, evals, evalNodes, backtracks, wrongPrunes, found: solL1 >= 0 }
}

export const totKernel: Kernel<ToTState> = {
  kind: 'tot',

  compile(doc: SimDocument): CompiledModel<ToTState> {
    const puzzle = String(doc.params.puzzle ?? P_EASY)
    const evalKind = String(doc.params.eval ?? E_PERFECT)
    const nums = NUMS[puzzle] ?? NUMS[P_EASY]
    const root = `{${nums.join(', ')}}`

    //  ⭐ 独立真值：不剪枝的穷举。「到底有没有解」不问 ToT 自己
    const truth = bruteSolve(nums)
    //  三档评估器的账，并排比 —— 剪枝到底省了多少、又赔上了什么
    const costs: TotCost[] = TOT_EVALS.map(k => {
      const r = runToT(nums, k)
      return { evalKind: k, nodes: r.nodes, evals: r.evals, evalNodes: r.evalNodes, total: r.nodes + r.evalNodes, found: r.found }
    })
    const noneCost = costs.find(c => c.evalKind === E_NONE)!

    const frames: Frame[] = []
    const shared = {
      target: TARGET, root, nums, evalKind, puzzle,
      trulySolvable: truth.ok, truePath: truth.path, costs, bruteNodes: noneCost.nodes,
    }
    const blank = {
      l1: [] as TotNode[], l2: [] as TotLeaf[], kept: 0, trying: -1, backtracks: 0,
      solL1: -1, solution: '', claimFound: false, wrongPrunes: 0, nodes: 0, evals: 0, evalNodes: 0,
    }

    frames.push({
      ...shared, ...blank, step: 0, stage: 'root', phase: 'run',
      log: `24 点：用 ${root} 凑 **${TARGET}**。思维链只会硬走一条线、错一步没回头；ToT 要**展开一棵搜索树** —— 逐层 生成 → 评估 → 剪枝 → 深入（走不通就回溯）。\n\n`
        + `这一档的评估器是「**${evalKind}**」。\n\n`
        + `⚠️ **这题到底有没有解，先另跑一遍不剪枝的穷举当真相** —— 「找到解了吗」不能问 ToT 自己：`
        + `它把有希望的枝剪错了，也会一口咬定"无解"。真值：**${truth.ok ? '有解' : '无解'}**`
        + `${truth.ok ? `（穷举访问 ${truth.nodes} 个节点找到的，解先不剧透）` : `（穷举把 ${truth.nodes} 个节点全走了一遍才敢这么说）`}。`,
    })

    const r = runToT(nums, evalKind, e => {
      const wrong = e.l1.filter(t => t.pruned && t.trulySure).length
      const kept = e.l1.filter(t => t.evaluated && !t.pruned).length
      const base = {
        ...shared, step: frames.length, l1: e.l1, l2: e.l2, kept,
        trying: e.trying, backtracks: e.backtracks, solL1: e.solL1, solution: e.solution,
        claimFound: e.solL1 >= 0, wrongPrunes: wrong, nodes: e.nodes, evals: e.evals, evalNodes: e.evalNodes,
      }
      if (e.kind === 'gen') {
        frames.push({
          ...base, stage: 'generate', phase: 'run',
          log: `**① 生成第一层想法（分支）**：从 ${root} 里挑两个数做一次运算 —— 加减乘除、而且**减和除跟顺序有关**，`
            + `所以一共有 **${e.l1.length}** 个中间状态。\n\n`
            + `⚠️ 上一版这里是我手挑的 5 个想法，"生成"其实没发生过。现在是**全部枚举**的 —— `
            + `所以你才看得见剪枝到底省了多少。`,
        })
      } else if (e.kind === 'eval') {
        const nSure = e.l1.filter(t => t.sure).length
        frames.push({
          ...base, stage: 'evaluate', phase: 'run',
          log: `**② 评估每个分支**：剩下的数还能不能算到 24？评估器给 ${e.l1.length} 个分支各判一次 —— `
            + `**${nSure}** 条 sure、**${e.l1.length - nSure}** 条 impossible。\n\n`
            + `⚠️ **评估器被调用了 ${e.evals} 次，这是 ToT 开销的大头。** 思维链一条线只要 1 次生成，ToT 光评估就 ${e.evals} 次。\n\n`
            + (evalKind === E_NOISY
              ? `这一档用的是**像大模型那样**的评估器 —— 它的规矩听起来很有道理：**「别把数弄得比目标还大」**。`
                + `现实里大模型给中间状态打分，用的就是这种"看着像不像"的直觉。`
              : evalKind === E_PERFECT
                ? `这一档用的是**完美评估器**（真去穷举剩下的数）。⚠️ 但现实里没有这种东西 —— `
                  + `**能完美判断中间状态有没有希望，等于已经把题解了**。它在这儿只是对照组。`
                : `这一档**不评估**，一律判 sure、谁也不剪 —— 剪枝的对照组。`),
        })
      } else if (e.kind === 'prune') {
        frames.push({
          ...base, stage: 'prune', phase: 'run',
          log: `**③ 剪枝**：把 impossible 的 ${e.l1.length - kept} 条剪掉，留下 **${kept}** 条往下展开 —— 不在死路上浪费。\n\n`
            + (wrong > 0
              ? `⚠️⚠️ **但评估器剪错了 ${wrong} 条。** 拿真值一对：这 ${wrong} 条其实**是能到 24 的**。\n\n`
                + `**剪掉的枝再也回不来了。** 回溯只能在"留下的枝"之间换，救不了被剪掉的那些 —— `
                + `**这就是 ToT 最要紧的一课**：它的天花板不在搜索，在评估器。`
              : `拿真值一对：剪掉的这 ${e.l1.length - kept} 条**确实**都到不了 24，一条没剪错。`),
        })
      } else if (e.kind === 'try') {
        const tried = e.l1.filter(t => t.visited).length
        frames.push({
          ...base, stage: 'expand', phase: 'run',
          log: `**④ 深入第 ${tried} 条**：${e.l1[e.trying].op} → ${e.l1[e.trying].state}，`
            + `把剩下两个数的所有运算都试一遍 —— **没有一个是 24**。\n\n`
            + `⚠️ **回溯**：退回根，换下一条。这是思维链完全没有的动作 —— 它错一步就一路错到底。`
            + `（已回溯 **${e.backtracks}** 次）`,
        })
      } else if (e.kind === 'solve') {
        const tried = e.l1.filter(t => t.visited).length
        frames.push({
          ...base, stage: 'done', phase: 'done',
          log: `**⑤ 找到解**：深入第 ${tried} 条 ${e.l1[e.trying].op} → **${e.solution}** ✓\n\n`
            + (e.backtracks > 0
              ? `之前**回溯了 ${e.backtracks} 次**（试了 ${e.backtracks} 条走不通的分支才撞到这条）—— 回溯是真发生了的，不是说说。`
              : `第一条就撞对了，这一档没有回溯。**换个难一点的题目**（{1,5,5} 只有一条路通）就看得到回溯了。`),
        })
      } else {
        frames.push({
          ...base, stage: 'done', phase: 'done',
          log: `**⑤ 搜完了，没找到解。** 留下的 ${kept} 条分支全试过（回溯 ${e.backtracks} 次），没有一条能到 24。`,
        })
      }
    })

    //  末帧：把账和真相摊开
    const lastF = frames[frames.length - 1]
    const cotCost = 1
    lastF.log += `\n\n**这一趟的账**：生成 ${r.nodes} 个节点、评估器调用 ${r.evals} 次、回溯 ${r.backtracks} 次。\n\n`
      + `**三档评估器并排**（同一道题）：\n`
      + costs.map(c => `　${c.evalKind}：展开 ${c.nodes} 个节点 + 评估器内部走 ${c.evalNodes} 个 = **总账 ${c.total}**（评估 ${c.evals} 次）→ ${c.found ? '找到解' : '说无解'}`).join('\n')
      + `\n\n`
      + (r.wrongPrunes > 0
        /*  ⚠️ 这一段我先写死成"注意它剪得多快、多省 —— 比不剪枝那档省了一大半"，
          而屏幕上摆着 57 vs 59 个节点 —— **省了 3%**。话得跟着账走。
          而且账一算出来，课比我原来想写的还硬：**不准的评估器两头不落好**。 */
      ? (() => {
        const mine = r.nodes + r.evalNodes
        const saved = noneCost.total - mine
        const savedPct = noneCost.total ? saved / noneCost.total : 0
        const perfect = costs.find(c => c.evalKind === E_PERFECT)!
        return `⚠️⚠️ **这一档的结论是错的。** ToT 说「${r.found ? '找到解' : '无解'}」，而真值是**有解**：`
          + `${truth.path.join('，')}。\n\n`
          + `错在评估器把 **${r.wrongPrunes}** 条有希望的枝当死路剪了 —— **剪掉的枝再也回不来**，`
          + `后面回溯了 ${r.backtracks} 次也没用，因为回溯只能在"留下的枝"之间换。\n\n`
          + (savedPct < 0.2
            ? `**而它连省都没省下多少**：总账 ${mine} 个节点，不剪枝那档是 ${noneCost.total} 个 —— `
              + `只省了 ${saved} 个（${(savedPct * 100).toFixed(0)}%）。\n\n`
              + `**一个不准的评估器是两头不落好**：既没省下多少算力，又把对的答案剪掉了。`
              + `ToT 的账不是"评估换搜索"那么简单 —— **评估器不够准的时候，你付了评估的钱，买到的是一个错答案**。`
            : `它确实省了：${r.nodes} 个节点 vs 不剪枝的 ${noneCost.nodes} 个（省 ${(savedPct * 100).toFixed(0)}%）。`
              + `**但"更省"和"更对"是两件事** —— 屏幕上只有把真值摆出来才分得清。`)
          + `\n\n**换成完美评估器再看** —— 同一道题，它展开 ${perfect.nodes} 个节点就找到了`
          + `（不过它的总账是 ${perfect.total}：省下来的节点是在评估器**里面**走掉的）。`
      })()
        : r.found === truth.ok
          ? (truth.ok
            ? `ToT 找到的解是 **${r.solution}**，和独立穷举出的真值对得上（真值：${truth.path.join('，')}）。\n\n`
              + (evalKind === E_PERFECT
                ? `⚠️ 但**这一档的"省"是假的**：它只展开了 ${r.nodes} 个节点，看着比不剪枝的 ${noneCost.nodes} 省一大半，`
                  + `可评估器内部又走了 **${r.evalNodes}** 个 —— **总账 ${r.nodes + r.evalNodes}**，`
                  + `${r.nodes + r.evalNodes > noneCost.total ? `反而比不剪枝还贵` : `并不比不剪枝便宜多少`}。\n\n`
                  + `**能完美判断中间状态有没有希望，本来就等于已经把题解了一遍。** `
                  + `这就是"现实里没有完美评估器"的算术版本 —— 真实 ToT 只能用便宜但会判错的那种。`
                : '')
            : `ToT 说无解，独立穷举也说无解（穷举把 ${truth.nodes} 个节点全走了一遍）—— **两边对得上**。\n\n`
              + `⚠️ 但注意"无解"这个结论有多贵：**它必须把整棵树走完才敢说**。`
              + `"有解"可以撞到就停，"无解"没有捷径 —— 这是搜索问题里一条很硬的不对称。\n\n`
              /*  ⚠️ 别写"剪枝一点忙都帮不上" —— 完美评估器在这题上只展开了 10 个节点。
                  真正的话在总账那一栏：省下来的节点是在评估器**里面**走完的。 */
              + `而这里正好看得见**完美评估器的"省"是假的**：它只展开了 ${costs[0].nodes} 个节点，`
              + `可评估器内部又走了 ${costs[0].evalNodes} 个 —— **总账 ${costs[0].total}**，`
              + `${costs[0].total > noneCost.total ? `比不剪枝那档（${noneCost.total}）还贵` : `和不剪枝那档（${noneCost.total}）一个量级`}。`)
          : `⚠️ ToT 的结论和真值对不上：ToT 说「${r.found ? '有解' : '无解'}」，真值是「${truth.ok ? '有解' : '无解'}」。`)
      + `\n\n**代价对照**：思维链一条线 = **${cotCost}** 次生成、0 次评估，错一步就一路错到底；`
      + `ToT 这一趟 = 展开 ${r.nodes} 个节点 + ${r.evals} 次评估（评估器内部又走了 ${r.evalNodes} 个）= **总账 ${r.nodes + r.evalNodes}**；`
      + `不剪枝穷举 = ${noneCost.total} 个节点、0 次评估。\n\n`
      + `**"成本成倍甚至十倍地涨"就是这么涨的** —— 每个节点要一次生成，每次评估又是一次调用。`
      + `ToT 擅长要探索、试错、规划的难题（24 点、字谜、走迷宫），代价很实在；`
      + `而它真正的天花板是**评估器准不准** —— 在中间状态好坏容易判断的问题上效果显著，在开放式推理上就很有限。`

    const base0: Frame = { ...shared, ...blank, step: -1, stage: 'root', phase: 'run', log: '' }

    return {
      axis: { kind: 'step', label: '生成→评估→剪枝→深入→解' },
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
