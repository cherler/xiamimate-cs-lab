/**
 * 内核：子 Agent / 委派 Sub-agents & Delegation —— 派活给子 agent，怎么省上下文又不炸（大模型 · 项目实战 / Agent 工程八股）
 * 轴：step —— 父 agent 逐个派子任务，看**委派树**长出来 + **token 账本**怎么变。
 *
 * 复杂任务，父 agent 派子 agent 去干（Claude Code 的 Task/subagent、DeepSeek 的 ctx.subagents）。为什么要独立子 agent？
 *   · **省上下文**：子 agent 在**自己独立的上下文**里探索（读一堆文件、试一堆），**只把最终结论回传**给父——
 *     子干了一大堆活，父上下文只涨一点点。大块探索被关在子里，不污染父。**这才是子 agent 存在的头号理由。**
 *   · **新开(spawn) vs 承接(fork)**：spawn=子从空白起（便宜、无父历史）；fork=子承接父的前缀（有上下文、KV 缓存友好、但更贵）。
 *   · **防 fork 炸弹**：**深度上限**(Claude Code maxDepth 3：到顶就把 spawn 工具摘掉)、**并发上限**(≤20)——不然子生子、指数爆炸。
 *   · **只回传最终结果**（不是整条轨迹，省 token）；**子权限不可自扩**（派出时定死，子自己扩不了——接上「沙箱/权限」那课）；子崩了不连累父。
 * token 账本、深度守卫都由引擎**现算**。切「起始方式」看 spawn vs fork。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Seed = '新开' | '承接'
type NStatus = 'done' | 'blocked'
export type Node = { id: string; name: string; depth: number; parentId: string; internalTok: number; returnTok: number; status: NStatus; result: string }
export type SubState = {
  i: number
  step: number
  stage: 'intro' | 'child' | 'blocked' | 'done'
  seed: Seed
  nodes: Node[]           // 已展开的委派树节点（父 root 隐含在 depth 0）
  cur: string             // 当前动作的节点 id
  parentCtx: number       // 父 agent 的上下文 token（只随"回传的结果"涨）
  internalTotal: number   // 子 agent 们内部一共花的 token
  returnTotal: number     // 回传给父的 token 总和
  depthCap: number
  concCap: number
  childStart: number      // 当前子 agent 的起始上下文（取决于 seed）
  blocked: string         // 被守卫拦下的原因（空=没拦）
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<SubState, 'i'>

const PARENT_BASE = 120   // 父 agent 起始上下文
const DEPTH_CAP = 3       // 最大委派深度（Claude Code maxDepth 3）
const CONC_CAP = 20       // 最大并发子 agent 数

//  父 agent 这一趟派的子任务（固定输入）。internalTok=子内部探索花的、returnTok=只回传给父的（小）。
//  树：父(0) → A(1)、B(1)；B(1) → B1(2)；B1(2) → B1a(3)。B1a 在深度上限，再想往下会被拦。
const PLAN: Node[] = [
  { id: 'A', name: '调研 auth.py 的调用方', depth: 1, parentId: '父', internalTok: 90, returnTok: 12, status: 'done', result: '3 处调用：web / mobile / admin' },
  { id: 'B', name: '写登录单元测试', depth: 1, parentId: '父', internalTok: 70, returnTok: 10, status: 'done', result: '加了 4 个用例，覆盖空指针 / 过期' },
  { id: 'B1', name: '查测试框架 fixture 用法', depth: 2, parentId: 'B', internalTok: 40, returnTok: 8, status: 'done', result: '用 pytest.fixture 造 mock session' },
  { id: 'B1a', name: '跑一个边界用例', depth: 3, parentId: 'B1', internalTok: 30, returnTok: 6, status: 'done', result: '边界用例通过' },
]

export const subagentKernel: Kernel<SubState> = {
  kind: 'subagent',
  compile(doc: SimDocument): CompiledModel<SubState> {
    const seed = (String(doc.params?.seed ?? '新开') === '承接' ? '承接' : '新开') as Seed
    const childStart = seed === '承接' ? PARENT_BASE : 10   // fork 承接父前缀 / spawn 从空白起
    const nodes: Node[] = []
    let parentCtx = PARENT_BASE, internalTotal = 0, returnTotal = 0
    const frames: Frame[] = []
    const base = (over: Partial<Frame>): Frame => ({
      stage: 'intro', seed, nodes: nodes.map(n => ({ ...n })), cur: '', parentCtx, internalTotal, returnTotal,
      depthCap: DEPTH_CAP, concCap: CONC_CAP, childStart, blocked: '', phase: 'run', focus: '', log: '',
      step: frames.length, ...over,
    })
    const push = (over: Partial<Frame>) => frames.push(base(over))

    push({ stage: 'intro', focus: `父 agent 有个大任务，起始上下文 ${PARENT_BASE}t——它要派子 agent 去干`,
      log: `**子 Agent / 委派**\n复杂任务，父 agent 把子任务**派给子 agent**。为什么不自己干？——**省上下文**：子 agent 在**独立上下文**里探索（读一堆文件、试一堆），**只把结论回传**给父。子干一大堆活，父只涨一点点。\n起始方式（切参数）：**新开(spawn)**=子从空白起；**承接(fork)**=子承接父的前缀（KV 缓存友好、但更贵）。本次：**${seed}**，子起始约 ${childStart}t。\n父起始上下文 **${PARENT_BASE}t**。看它派 ${PLAN.length} 个子任务、树怎么长、账本怎么变。` })

    for (const n of PLAN) {
      nodes.push({ ...n })
      internalTotal += n.internalTok
      returnTotal += n.returnTok
      parentCtx += n.returnTok
      push({
        stage: 'child', cur: n.id,
        focus: `派子 agent「${n.name}」(深度 ${n.depth})：内部花 ${n.internalTok}t，只回传 ${n.returnTok}t → 父省 ${n.internalTok - n.returnTok}t`,
        log: `**派子 agent：${n.name}**（深度 ${n.depth}，父=${n.parentId}）\n子在**独立上下文**(起始 ${childStart}t)里干活，内部花了 **${n.internalTok}t** 探索；但**只回传最终结果**：「${n.result}」= **${n.returnTok}t**。\n→ 父上下文只涨 ${n.returnTok}t（现在 ${parentCtx}t），**省下 ${n.internalTok - n.returnTok}t**（那 ${n.internalTok - n.returnTok}t 的探索被关在子里、没污染父）。` })
    }

    // 深度守卫：B1a 在深度 3（上限），再想派子 → 拦下
    push({
      stage: 'blocked', cur: 'B1a', blocked: '深度已达上限 3',
      focus: `B1a 在深度 3（上限），想再派子 agent → 拦下（防 fork 炸弹）`,
      log: `**🛑 深度守卫：不让再往下**\nB1a 已在**深度 3**（= maxDepth 上限）。它想再派一个子 agent（深度 4）——**被拦下**：到深度上限就把 **spawn 工具摘掉**，节点根本发不出委派。\n**为什么**：不设上限的话，子生子、子又生子……**指数爆炸（fork 炸弹）**，几秒钟几百个 agent 把配额烧光。并发也有上限（≤${CONC_CAP} 个同时跑）。` })

    push({
      stage: 'done', phase: 'done',
      focus: `完：子内部共 ${internalTotal}t，父只涨 ${returnTotal}t，省 ${internalTotal - returnTotal}t`,
      log: `**小结：委派为什么划算**\n${PLAN.length} 个子 agent 内部一共干了 **${internalTotal}t** 的活，但**回传给父的只有 ${returnTotal}t**——父上下文从 ${PARENT_BASE} 涨到 ${parentCtx}，**省下 ${internalTotal - returnTotal}t**。大块探索被关在各自独立上下文里，父始终精简。\n**四条工程铁律**：① 子有**独立上下文**（省父的 token + 聚焦）② **只回传最终结果**（不是整条轨迹）③ **深度/并发上限**防 fork 炸弹（maxDepth ${DEPTH_CAP}、并发 ${CONC_CAP}，到顶摘 spawn 工具）④ **子权限不可自扩**（派出时定死，子扩不了——接「沙箱/权限」）。spawn(新开)从空白起省事、fork(承接)带父前缀续得上。子崩了不连累父。面试常问：为什么子要独立上下文、回传什么、怎么防递归失控。` })

    const base0: Frame = base({ stage: 'intro', step: -1 })
    return {
      axis: { kind: 'step', label: '委派步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
