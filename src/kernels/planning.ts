/**
 * 内核：规划 · 计划模式 + Todo —— Agent 怎么"先想后做"、又不跑偏（大模型 · 项目实战 / Agent 工程八股）
 * 轴：step —— 计划模式(只读门)里拟计划 → 批准解锁 → 按 todo 状态机推进(恰一个进行中) → 复述防漂移 → 现实变了就重规划。
 *
 * 复杂任务不能上来就写代码。三个机制，别只当"清单"看：
 *   · **计划模式=硬门禁(不是建议)**：Claude Code 在**权限层**把"写"堵死——**批准计划前只能读/探查**，逼你"先看后动"(bypass 模式才降级成软提示)；DeepSeek 的 plan-mode 则是**纯建议、工具照样能调**。这是真实的**强制 vs 建议**分叉，和沙箱/权限的模式一脉。
 *   · **Todo=状态机**：每项 pending→in_progress→completed，**恰好一个进行中**(不平行)；整表替换更新。(Opus4.8/Sonnet5+ 起 TodoWrite 换成增量 TaskCreate/TaskUpdate + deleted 态。)
 *   · **复述=注意力操控(最不显眼的深处)**：每轮把整张 todo **重新贴到上下文近端**(recitation)——把全局计划推回模型的"近端注意力"，**对抗长任务里的 lost-in-the-middle 漂移**。不是记账，是把模型摁在当前步上。
 * 现实和计划总会岔开 → **重规划**(整表替换)。切「模式」看 硬门禁 vs 软建议。门禁/状态机全由引擎现算。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Mode = '计划门' | '建议'
type TStatus = 'pending' | 'active' | 'done'
export type Todo = { id: string; text: string; status: TStatus; added?: boolean }
export type PlanState = {
  i: number
  step: number
  stage: 'intro' | 'planning' | 'exit' | 'exec' | 'replan' | 'done'
  mode: Mode
  planMode: boolean          // 是否在计划模式（只读门）
  todos: Todo[]
  writeBlocked: boolean       // 计划模式里试图写、被门禁挡下
  recited: boolean            // 本轮是否把 todo 复述到近端（注意力操控）
  op: string
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<PlanState, 'i'>

const DRAFT: Todo[] = [
  { id: 't1', text: '读 auth.py 摸清现状', status: 'pending' },
  { id: 't2', text: '抽出 validate() 函数', status: 'pending' },
  { id: 't3', text: '加单元测试', status: 'pending' },
  { id: 't4', text: '跑测试验证', status: 'pending' },
]

export const planningKernel: Kernel<PlanState> = {
  kind: 'planning',
  compile(doc: SimDocument): CompiledModel<PlanState> {
    const mode = (String(doc.params?.mode ?? '计划门') === '建议' ? '建议' : '计划门') as Mode
    const frames: Frame[] = []
    const push = (over: Partial<Frame> & { stage: Frame['stage']; todos: Todo[]; focus: string; log: string }) =>
      frames.push({ mode, planMode: true, writeBlocked: false, recited: false, op: '', phase: 'run', step: frames.length, ...over } as Frame)
    const clone = (ts: Todo[]) => ts.map(t => ({ ...t }))

    push({ stage: 'intro', planMode: true, todos: [], focus: `复杂任务，先进"计划模式"——${mode === '计划门' ? '硬门禁：批准前只能读' : '软建议：可读可写但劝你先想'}`,
      log: `**规划：先想后做，又不跑偏**\n复杂任务不能上来就写代码。先进**计划模式**探查、拟计划。\n**模式（${mode}）**：${mode === '计划门' ? '**硬门禁**——权限层把"写"堵死，批准计划前只能读/探查(Claude Code 做法，逼你先看后动)' : '**软建议**——工具照样能调，只是劝你先规划(DeepSeek plan-mode 做法)'}。\n任务：重构登录模块并加测试。往下看它怎么拟计划、解锁、推进、防跑偏。` })

    // ① 计划中：只读探查 + 拟 todo；试图写 → 门禁
    push({ stage: 'planning', planMode: true, todos: clone(DRAFT), writeBlocked: mode === '计划门', op: '只读探查 + 拟 4 项 todo；试图写',
      focus: `计划模式里拟出 4 项 todo；此时想写 → ${mode === '计划门' ? '被门禁挡下' : '放行(但不建议)'}`,
      log: `**① 计划模式：只读探查、拟计划**\n读文件摸清现状，拟出 4 项 todo(全 pending)。\n这时若想直接**写文件**：${mode === '计划门' ? '**被门禁挡下**——"先看后动"是被强制的(edits stay blocked until you approve the plan)。' : '**放行**——建议模式不拦，但计划没定就写容易乱。'}\n这就是**硬门禁 vs 软建议**的分叉。` })

    // ② 批准 → 出计划模式、解锁写
    push({ stage: 'exit', planMode: false, todos: clone(DRAFT), op: '批准计划 → 退出计划模式，解锁写',
      focus: '批准计划 → 退出计划模式，写操作解锁，开始执行',
      log: `**② 批准计划 → 解锁**\n人看过计划、批准 → 退出计划模式，会话转入执行态，**写操作解锁**。${mode === '计划门' ? '(门禁只在"看清楚"之后才开——这一步是安全闸。)' : ''}\n计划定了，开始按 todo 推进。` })

    // ③ 执行：状态机推进（恰一个 in_progress）+ 复述
    const exec = clone(DRAFT)
    exec[0]!.status = 'done'; exec[1]!.status = 'active'
    push({ stage: 'exec', planMode: false, todos: exec, recited: true, op: 't1 完成，t2 进行中；整表复述到近端',
      focus: 't1✓、t2 进行中(恰一个 active)；每轮把 todo 复述到上下文近端',
      log: `**③ 执行：Todo 状态机 + 复述**\npending→**in_progress**→completed，**恰好一个进行中**(t1 done、t2 active)。\n🔑 **复述(attention-steering)**：每轮把整张 todo **重新贴到上下文近端**——把全局计划推回模型的"近端注意力"，**对抗长任务里的 lost-in-the-middle 漂移**(计划只在开头说一次，跑几十步就被埋在中部、被模型忽略)。这不是记账、是把模型摁在当前步上。` })

    // ④ 现实岔开 → 重规划（整表替换、插一项）
    const replan = clone(exec)
    replan.splice(2, 0, { id: 't2b', text: '先解耦 session.py（新发现的依赖）', status: 'active', added: true })
    replan[1]!.status = 'done'   // t2 抽函数时发现依赖，先完成/让位
    push({ stage: 'replan', planMode: false, todos: replan, op: '现实岔开 → 整表替换、插入新 todo',
      focus: '抽函数时发现 auth.py 还依赖 session.py → 重规划：插入新一项',
      log: `**④ 重规划：现实总和计划岔开**\n抽 validate() 时发现 auth.py 还**依赖 session.py**——原计划没料到。\n→ **重规划**：整表替换，插入「先解耦 session.py」。计划不是一次定死、是**随现实滚动更新**的活文档。(TodoWrite 是整表替换；Opus4.8/Sonnet5+ 起换成增量 TaskCreate/TaskUpdate + deleted 态，改一项不用重发整表。)` })

    const fin = clone(replan)
    fin.forEach(t => (t.status = 'done'))
    push({ stage: 'done', planMode: false, todos: fin, phase: 'done', op: '',
      focus: '完：计划门/状态机/复述/重规划——规划不是"清单"那么浅',
      log: `**小结：规划远不止"一张清单"**\n三个真机制：\n· **计划模式=硬门禁 vs 软建议**：Claude Code 在权限层强制"批准前只读"(和沙箱/权限模式一脉)；DeepSeek 纯建议。\n· **Todo 状态机**：恰一个 in_progress、整表替换(或增量 TaskCreate/TaskUpdate)。\n· **复述=注意力操控**：每轮把计划贴回近端，对抗 lost-in-the-middle——这是最不显眼、也最深的一层。\n· **重规划**：计划是随现实滚动的活文档。\n面试延伸：为何 plan mode 要只读优先(先看后动、防误改)、todo 为何要"恰一个进行中"(逼串行、别并行摊大)、architect/editor 双模型(强模型规划、廉价模型落地)、ReAct(边想边做) vs Plan-and-Solve(先规划再执行) vs ToT(树搜索多个计划)的区别。` })

    const base0: Frame = { mode, planMode: true, stage: 'intro', step: -1, todos: [], writeBlocked: false, recited: false, op: '', phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '规划步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
