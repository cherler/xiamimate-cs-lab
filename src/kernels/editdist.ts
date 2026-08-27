/**
 * 内核：动态规划 / 编辑距离（算法 · 原理：为什么"记住子问题"能把指数级搜索压成多项式）
 * 轴：step —— 一格一格填编辑距离表，看每格怎么用三个已算好的邻居 O(1) 推出来
 *
 * 动态规划(DP)= 最优子结构 + 重叠子问题 + 记住每个子问题的答案(填表)，避免重复计算。
 * 编辑距离:把字符串 a 改成 b,最少几步(插入/删除/替换)?朴素递归会把同一个子问题算指数级多次;
 * DP 用一张表 dp[i][j]=a 前 i 个字符→b 前 j 个字符的最少步数，每格只看三个邻居就 O(1) 推出:
 *   若 a[i]==b[j]:dp[i][j]=dp[i−1][j−1]（不用动）;
 *   否则:dp[i][j]=1+min(dp[i−1][j−1] 替换, dp[i−1][j] 删除, dp[i][j−1] 插入)。
 * 于是 O(n·m) 就填完整张表,右下角就是答案——这正是 DP"用空间记子问题、把指数压成多项式"的威力。
 * 序列比对、最短路(Bellman-Ford)、背包、语音/DNA 对齐,底子都是它。
 *
 * 本实验:a="horse"→b="ros"，逐格填表,每步高亮当前格和它依赖的三个邻居,最后右下角=**3**。
 * 值全部现算、可核对(每格=match?左上:1+min(三邻居)、右下角=编辑距离)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const A = 'horse'
const B = 'ros'

export type EditDistState = {
  i: number
  step: number
  a: string
  b: string
  table: (number | null)[][]     // (|a|+1)×(|b|+1)，null=还没填
  ci: number                     // 当前格行（1..|a|）
  cj: number                     // 当前格列（1..|b|）
  diag: number
  up: number
  left: number
  match: boolean
  val: number
  done: boolean                  // 全表填完
  phase: 'run' | 'done'
  log: string
}

export const EDITDIST_VISIBLE = [
  'step', 'a', 'b', 'table', 'ci', 'cj', 'diag', 'up', 'left', 'match', 'val', 'done', 'phase', 'log',
] as const

type Frame = Omit<EditDistState, 'i'>

export const editdistKernel: Kernel<EditDistState> = {
  kind: 'editdist',

  compile(_doc: SimDocument): CompiledModel<EditDistState> {
    const na = A.length, nb = B.length
    const table: (number | null)[][] = Array.from({ length: na + 1 }, () => new Array(nb + 1).fill(null))
    // base：改成空串/从空串改
    for (let i = 0; i <= na; i++) table[i][0] = i
    for (let j = 0; j <= nb; j++) table[0][j] = j

    const frames: Frame[] = []
    let step = 0
    const snap = () => table.map(r => r.slice())

    for (let i = 1; i <= na; i++) {
      for (let j = 1; j <= nb; j++) {
        const match = A[i - 1] === B[j - 1]
        const diag = table[i - 1][j - 1]!, up = table[i - 1][j]!, left = table[i][j - 1]!
        const val = match ? diag : 1 + Math.min(diag, up, left)
        table[i][j] = val
        const isLast = i === na && j === nb
        frames.push({
          step: step++, a: A, b: B, table: snap(), ci: i, cj: j, diag, up, left, match, val,
          done: isLast, phase: 'run',
          log: `格 (${i},${j})：比 a[${i}]='${A[i - 1]}' 与 b[${j}]='${B[j - 1]}' → ` +
            (match ? `**相同**，直接抄左上 dp=${diag}。` : `**不同**，dp = 1 + min(左上 ${diag}替换, 上 ${up}删除, 左 ${left}插入) = **${val}**。`) +
            (isLast ? ` 右下角=**${val}**,就是编辑距离。` : ``),
        })
      }
    }

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done', done: true,
      log: `整张 ${na + 1}×${nb + 1} 表填完:把 **${A}** 改成 **${B}** 最少 **${lf.val}** 步(右下角)。` +
        `每格只看三个已算好的邻居就 O(1) 推出,${na * nb} 格 O(n·m) 填完——这就是动态规划:` +
        `**记住每个子问题的答案**,把朴素递归的指数级重复计算压成多项式。序列比对、最短路、背包、DNA 对齐都靠它。`,
    })

    const base0: Frame = {
      step: -1, a: A, b: B, table: snap(), ci: 0, cj: 0, diag: 0, up: 0, left: 0, match: false, val: 0,
      done: false, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '填第几格' },
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
