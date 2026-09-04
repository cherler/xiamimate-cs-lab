/**
 * 内核：思维树 ToT（大模型算法）
 * 轴：step —— 把推理组织成**一棵真的搜索树**,逐层展开:生成想法(分支)→评估前景→剪掉没希望的→沿有希望的**再往下展开一层**→找到解路径。
 *
 * 这里加深的是 ToT 的**核心=树搜索**(前一版只在根下摊了 5 个想法、挑一个就完,是"单层"的假树)。现在做成**两层真树**:
 *   ①**根**:{2,3,4} 凑 24。
 *   ②**第一层(生成)**:从根挑两数做一次运算,得 5 个中间状态(分支)。
 *   ③**评估**:剩两数还能不能算到 24?能→**sure**、不能→**impossible**(评估器给每个分支判前景)。
 *   ④**剪枝**:把 impossible 的分支剪掉,不再往下展开——省得在死路上浪费。
 *   ⑤**展开第二层**:对**留下的每个** sure 分支,再做一次运算得到叶子——这才是"树"在往深处长。
 *   ⑥**解路径**:第一条算到 24 的叶子就是解,回溯到根得到完整路径 3×4=12→12×2=24。
 *
 * 比思维链(一条道走到黑、错了没回头)、自洽(多条独立线投票)更进一步:显式地**广度生成 + 评估剪枝 + 深度展开(可回溯)**。
 * 每个算式、每个评估都可手算核对。ToT 擅长需要探索、试错、规划的难题(24点、字谜、走迷宫);代价:分支多、评估多,更贵更慢。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const TARGET = 24
const ROOT = '{2, 3, 4}'
//  第一层想法(从根 {2,3,4} 挑两数一次运算);sure=剩两数能算到 24。
const L1_DEF = [
  { op: '3 × 4 = 12', state: '{12, 2}', sure: true },
  { op: '2 × 4 = 8', state: '{8, 3}', sure: true },
  { op: '2 × 3 = 6', state: '{6, 4}', sure: true },
  { op: '3 + 4 = 7', state: '{7, 2}', sure: false },  // 7,2 最多 14 → 到不了 24
  { op: '4 − 2 = 2', state: '{2, 3}', sure: false },  // 2,3 最多 6 → 到不了 24
]
//  第二层:对留下的 sure 分支各再算一次(都能到 24)。parent=第一层下标。
const L2_DEF = [
  { parent: 0, op: '12 × 2 = 24', solves: true },
  { parent: 1, op: '8 × 3 = 24', solves: true },
  { parent: 2, op: '6 × 4 = 24', solves: true },
]
const SOL_L1 = 0
const SOLUTION = '3×4=12，12×2=24'

export type TotNode = { op: string; state: string; sure: boolean; evaluated: boolean; pruned: boolean; onPath: boolean }
export type TotLeaf = { parent: number; op: string; solves: boolean; onPath: boolean }
export type ToTState = {
  i: number
  step: number
  target: number
  root: string
  l1: TotNode[]
  l2: TotLeaf[]
  stage: 'root' | 'generate' | 'evaluate' | 'prune' | 'expand' | 'done'
  kept: number                 // 剪枝后留下的分支数
  solL1: number                // 解所在的第一层下标（-1=还没找到）
  solution: string
  phase: 'run' | 'done'
  log: string
}

export const TOT_VISIBLE = [
  'step', 'target', 'root', 'l1', 'l2', 'stage', 'kept', 'solL1', 'solution', 'phase', 'log',
] as const

type Frame = Omit<ToTState, 'i'>

export const totKernel: Kernel<ToTState> = {
  kind: 'tot',

  compile(_doc: SimDocument): CompiledModel<ToTState> {
    const mkL1 = (evaluated: boolean, pruned: boolean, path: boolean): TotNode[] =>
      L1_DEF.map((t, k) => ({ ...t, evaluated, pruned: pruned && !t.sure, onPath: path && k === SOL_L1 }))
    const mkL2 = (path: boolean): TotLeaf[] =>
      L2_DEF.map(l => ({ ...l, state: '', onPath: path && l.parent === SOL_L1 } as TotLeaf))
    const kept = L1_DEF.filter(t => t.sure).length

    const frames: Frame[] = [
      { step: 0, target: TARGET, root: ROOT, l1: [], l2: [], stage: 'root', kept: 0, solL1: -1, solution: '', phase: 'run',
        log: `24 点:用 ${ROOT} 凑 **${TARGET}**。思维链只会硬走一条线,ToT 要**展开一棵搜索树**——逐层 生成→评估→剪枝→深入。` },
      { step: 1, target: TARGET, root: ROOT, l1: mkL1(false, false, false), l2: [], stage: 'generate', kept: 0, solL1: -1, solution: '', phase: 'run',
        log: `**① 生成第一层想法(分支)**:从根挑两数做一次运算,得 ${L1_DEF.length} 个中间状态(如 3×4=12 → 剩 {12,2})。这是树的第一层。` },
      { step: 2, target: TARGET, root: ROOT, l1: mkL1(true, false, false), l2: [], stage: 'evaluate', kept: 0, solL1: -1, solution: '', phase: 'run',
        log: `**② 评估每个分支**:剩两数还能算到 24 吗?{12,2}/{8,3}/{6,4} → **sure**;{7,2}(最多 14)、{2,3}(最多 6)→ **impossible**。评估器判前景。` },
      { step: 3, target: TARGET, root: ROOT, l1: mkL1(true, true, false), l2: [], stage: 'prune', kept, solL1: -1, solution: '', phase: 'run',
        log: `**③ 剪枝**:把 impossible 的两条({7,2}、{2,3})剪掉,不再往下展开——不在死路上浪费。留下 **${kept}** 条有希望的。` },
      { step: 4, target: TARGET, root: ROOT, l1: mkL1(true, true, false), l2: mkL2(false), stage: 'expand', kept, solL1: -1, solution: '', phase: 'run',
        log: `**④ 展开第二层**:对留下的每条 sure 分支再算一次——{12,2}→12×2=24、{8,3}→8×3=24、{6,4}→6×4=24。树往深处长了一层,三条都到 24。` },
      { step: 5, target: TARGET, root: ROOT, l1: mkL1(true, true, true), l2: mkL2(true), stage: 'done', kept, solL1: SOL_L1, solution: SOLUTION, phase: 'done',
        log: `**⑤ 解路径**:第一条到 24 的叶子回溯到根 → **${SOLUTION}**。ToT=树搜索:**广度生成 + 评估剪枝 + 深度展开(可回溯)**。` +
          `比思维链(一条道走到黑)、自洽(多条独立线投票)更进一步,擅长要探索/试错/规划的难题;代价是分支多、评估多、更贵更慢。` },
    ]

    const base0: Frame = { step: -1, target: TARGET, root: ROOT, l1: [], l2: [], stage: 'root', kept: 0, solL1: -1, solution: '', phase: 'run', log: '' }

    return {
      axis: { kind: 'step', label: '生成→评估→剪枝→深入→解' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 }
      },
    }
  },
}
