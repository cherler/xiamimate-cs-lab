/**
 * 内核：回溯 N 皇后（经典算法 · 原理：走不通就退回上一步，换一个再试）
 * 轴：step —— 4×4 棋盘上逐行放皇后，行内挑一列安全的落子；整行无处可放就退回上一行、挪一格重来
 *
 * 回溯是"系统化的试错":把问题拆成一步步的选择,每步试一个候选、走下去;一旦发现走不通(约束破了),
 * 就**撤销这一步**、退回上一层换下一个候选——像走迷宫遇到死胡同就原路退回换个岔口。它不是瞎猜,
 * 而是**深度优先地穷举**整棵"选择树",靠"提前剪掉不可能的分支"避免真的枚举所有组合。
 *
 * N 皇后是它的招牌例子:在 N×N 棋盘放 N 个皇后,任意两个不能同行、同列、同对角线(互相攻击)。
 * 做法:一行放一个,行内从左到右找**不被已放皇后攻击**的列;找到就落子、进入下一行;
 * 整行没有安全列(死胡同)就**回溯**——退回上一行,把那儿的皇后挪到下一个安全列重试。
 *
 * 本实验:4×4 棋盘找第一个解。你会看到皇后一个个落下,撞到死胡同又被**撤回**(回溯),
 * 换个位置再试,最终拼出无冲突的布局 [1,3,0,2]。每步落子/回溯都可核对(safe 判定、行列对角线)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const N = 4

export type NQueensState = {
  i: number
  step: number
  n: number
  cols: number[]        // cols[r]=皇后所在列，-1 空
  row: number           // 本步作用的行
  col: number           // 本步作用的列
  act: string           // 'place' | 'backtrack' | 'solved'
  skip: number[]        // 本行被攻击、跳过的列
  placed: number        // 盘上皇后数
  tries: number         // 累计试列次数
  backtracks: number    // 累计回溯次数
  phase: 'run' | 'done'
  log: string
}

export const NQUEENS_VISIBLE = [
  'step', 'n', 'cols', 'row', 'col', 'act', 'skip', 'placed', 'tries', 'backtracks', 'phase', 'log',
] as const

type Frame = Omit<NQueensState, 'i'>

export const nqueensKernel: Kernel<NQueensState> = {
  kind: 'nqueens',

  compile(_doc: SimDocument): CompiledModel<NQueensState> {
    const frames: Frame[] = []
    const cols = Array(N).fill(-1)
    let solved = false, tries = 0, backtracks = 0
    const safe = (r: number, c: number) => {
      for (let i = 0; i < r; i++) {
        if (cols[i] === c || Math.abs(cols[i] - c) === Math.abs(i - r)) return false
      }
      return true
    }
    const placedNow = () => cols.filter(x => x >= 0).length

    const solve = (r: number): void => {
      if (solved) return
      if (r === N) {
        frames.push({
          step: frames.length, n: N, cols: cols.slice(), row: -1, col: -1, act: 'solved', skip: [],
          placed: N, tries, backtracks, phase: 'run',
          log: `四个皇后互不攻击——**找到解** [${cols.join(',')}]!共试 ${tries} 次列、回溯 ${backtracks} 次。`,
        })
        solved = true
        return
      }
      const skip: number[] = []
      for (let c = 0; c < N; c++) {
        tries++
        if (safe(r, c)) {
          cols[r] = c
          const sk = skip.slice()
          frames.push({
            step: frames.length, n: N, cols: cols.slice(), row: r, col: c, act: 'place', skip: sk,
            placed: placedNow(), tries, backtracks, phase: 'run',
            log: `第 ${r} 行:` + (sk.length ? `列 ${sk.join('、')} 被已放皇后攻击,跳过;` : ``) +
              `列 ${c} 安全,**落子**。往下一行走。`,
          })
          solve(r + 1)
          if (solved) return
          cols[r] = -1
          backtracks++
          frames.push({
            step: frames.length, n: N, cols: cols.slice(), row: r, col: c, act: 'backtrack', skip: [],
            placed: placedNow(), tries, backtracks, phase: 'run',
            log: `第 ${r} 行放列 ${c} 后,下面**整行都没安全位**(死胡同)——**撤回**这枚皇后,回到第 ${r} 行换下一列。`,
          })
        } else {
          skip.push(c)
        }
      }
    }
    solve(0)

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, step: frames.length, phase: 'done',
      log: `**回溯完成**:解 [${lf.cols.join(',')}]。一路"试→撞死胡同→撤回→换一个",深度优先地穷举选择树、` +
        `靠剪枝避免枚举全部 ${N ** N} 种摆法。这套"走不通就退一步"的骨架,是数独、排列组合、正则匹配、` +
        `编译器求解的通用底子。共落子+回溯 ${frames.length - 1} 步、回溯 ${backtracks} 次。`,
    })

    const base0: Frame = {
      step: -1, n: N, cols: Array(N).fill(-1), row: -1, col: -1, act: '', skip: [],
      placed: 0, tries: 0, backtracks: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '落子/回溯' },
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
