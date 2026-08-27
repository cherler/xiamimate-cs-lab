/**
 * 内核：思维树 ToT（大模型算法 · 原理：把推理展开成一棵树,每步生成多个想法、评估、剪枝、搜索)
 * 轴：step —— 不像思维链只走一条线、也不像自洽各走各的独立线,ToT 把推理组织成**一棵树**:
 *      每一步**生成多个候选想法**(分支)、给每个**评估**前景(能不能通向解:sure/maybe/impossible)、
 *      **剪掉**没希望的、沿有希望的继续展开,还能**回溯**换分支。像下棋时在脑子里推演多步、剪掉臭棋。
 *
 * 思维链(CoT)一条道走到黑,错一步没有回头路;自洽采多条独立链投票,但每条内部还是一条线。**思维树 ToT** 更进一步:
 * 把问题的中间状态当**树节点**,每步**扩展出多个想法分支**,并引入一个**评估器**给每个分支打分/判断前景,
 * 于是能像搜索一样**广度/深度优先地探索、剪枝、回溯**——把"想不同的路、比一比、走最有希望的、走不通就退回换一条"变成显式过程。
 *
 * 本实验:24 点游戏,用 [4,3,2] 凑 24。从根展开 5 个想法(两数运算):3 个前景 sure(剩两数能乘到 24)、2 个 impossible;
 * 剪掉没希望的,沿一个有希望的展开 → 4×3=12、12×2=24 **找到解**。每步的算式、评估都可手算核对。ToT 擅长需要探索、试错、规划的难题(24点、字谜、走迷宫)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const TARGET = 24
const ROOT = '{4, 3, 2}'
type Thought = { op: string; state: string; sure: boolean }
const THOUGHTS: Thought[] = [
  { op: '4 × 3 = 12', state: '{12, 2}', sure: true },
  { op: '4 × 2 = 8', state: '{8, 3}', sure: true },
  { op: '3 × 2 = 6', state: '{6, 4}', sure: true },
  { op: '4 + 3 = 7', state: '{7, 2}', sure: false },
  { op: '4 − 3 = 1', state: '{1, 2}', sure: false },
]
const CHOSEN = 0
const SOLUTION = '4×3=12，12×2=24'

export type ToTState = {
  i: number
  step: number
  target: number
  root: string
  thoughts: { op: string; state: string; sure: boolean; evaluated: boolean; pruned: boolean }[]
  stage: string                // 'root'|'generate'|'evaluate'|'prune'|'expand'|'done'
  chosen: number               // 展开的分支下标（-1=未选）
  solution: string
  phase: 'run' | 'done'
  log: string
}

export const TOT_VISIBLE = [
  'step', 'target', 'root', 'thoughts', 'stage', 'chosen', 'solution', 'phase', 'log',
] as const

type Frame = Omit<ToTState, 'i'>

export const totKernel: Kernel<ToTState> = {
  kind: 'tot',

  compile(_doc: SimDocument): CompiledModel<ToTState> {
    const mk = (evaluated: boolean, pruned: boolean) =>
      THOUGHTS.map(t => ({ ...t, evaluated, pruned: pruned && !t.sure }))

    const frames: Frame[] = [
      { step: 0, target: TARGET, root: ROOT, thoughts: [], stage: 'root', chosen: -1, solution: '', phase: 'run',
        log: `24 点:用 ${ROOT} 凑 **${TARGET}**。思维链只会硬走一条线,ToT 要**展开一棵想法树**——每步生成多个想法、评估、剪枝、搜索。` },
      { step: 1, target: TARGET, root: ROOT, thoughts: mk(false, false), stage: 'generate', chosen: -1, solution: '', phase: 'run',
        log: `**生成想法(分支)**:从根挑两个数做一次运算,得到 ${THOUGHTS.length} 个候选中间状态(如 4×3=12 → 剩 {12,2})。这就是树的第一层分支。` },
      { step: 2, target: TARGET, root: ROOT, thoughts: mk(true, false), stage: 'evaluate', chosen: -1, solution: '', phase: 'run',
        log: `**评估每个想法**:剩下的两个数还能不能乘/算到 24?{12,2}(12×2=24)、{8,3}、{6,4} → **sure**;{7,2}、{1,2} 怎么凑都不到 24 → **impossible**。评估器给每个分支判前景。` },
      { step: 3, target: TARGET, root: ROOT, thoughts: mk(true, true), stage: 'prune', chosen: -1, solution: '', phase: 'run',
        log: `**剪枝**:把 impossible 的分支({7,2}、{1,2})剪掉,不再往下展开——省得在死路上浪费。留下 3 个有希望的。` },
      { step: 4, target: TARGET, root: ROOT, thoughts: mk(true, true), stage: 'expand', chosen: CHOSEN, solution: SOLUTION, phase: 'run',
        log: `**沿有希望的展开**:选 {12,2} 继续,12×2=24 ✓ **找到解**!完整路径:${SOLUTION}。若这条走不通,还能**回溯**换另一个 sure 分支(如 {8,3})。` },
      { step: 5, target: TARGET, root: ROOT, thoughts: mk(true, true), stage: 'done', chosen: CHOSEN, solution: SOLUTION, phase: 'done',
        log: `**解出**:${SOLUTION}=${TARGET}。ToT=把推理组织成树:每步**生成多个想法 → 评估前景 → 剪掉没希望的 → 沿有希望的搜索(可回溯)**。` +
          `比思维链(一条道走到黑、错了没回头)、自洽(多条独立线投票)更进一步,擅长需要**探索、试错、规划**的难题(24点、字谜、走迷宫)。代价:分支多、评估多,更贵更慢。` },
    ]

    const base0: Frame = {
      step: -1, target: TARGET, root: ROOT, thoughts: [], stage: '', chosen: -1, solution: '', phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '生成→评估→剪枝→搜索' },
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
