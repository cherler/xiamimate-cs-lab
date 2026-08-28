/**
 * 内核：mini 正则引擎 —— `.`(任意字符) `*`(零或多个前一字符) 的动态规划匹配（算法 · 项目实战 / 求职）
 * 轴：step —— 填一张 DP 表 dp[i][j]=「s 前 i 个字符能否匹配 p 前 j 个」，逐行揭开
 *
 * 正则的 `.` 配任意单字符,`*` 配**零或多个它前面那个字符**(注意:和通配符的 `*`=任意一段不同!)。
 * 难点全在 `*`。用**动态规划**最清楚:dp[i][j] = s[:i] 是否匹配 p[:j]。转移:
 *   · p[j-1] 不是 `*`:dp[i][j] = dp[i-1][j-1] 且 s[i-1] 配 p[j-1]（各消一个字符）。
 *   · p[j-1] 是 `*`(设前一个是 x=p[j-2]):
 *       ① **x* 匹配 0 个** → dp[i][j-2]（把 "x*" 整段跳过）;
 *       ② **x* 多匹配一个** → s[i-1] 配 x 且 dp[i-1][j]（消掉 s 一个字符、p 的 "x*" 留着继续吃）。
 * 本例 s="aab", p="c*a*b":c* 匹配 0 个 c、a* 匹配 2 个 a、b 配 b → dp[3][5]=真、匹配。
 * 值:每个格子由左上/上/左跳两格三种转移算出,可逐格手核。O(nm) 时间和空间,比回溯稳。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const S = 'aab'
const P = 'c*a*b'

export type RegexState = {
  i: number
  step: number
  op: 'intro' | 'row' | 'done'
  s: string
  p: string
  table: boolean[][]       // 完整 DP 表
  revealed: number         // 已揭开到第几行（含）
  curRow: number           // 本步刚填的行（-1 未开始）
  key: { i: number; j: number; rule: string } | null  // 高亮的关键格 + 用的规则
  matched: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<RegexState, 'i'>

export const regexKernel: Kernel<RegexState> = {
  kind: 'regex',
  compile(_doc: SimDocument): CompiledModel<RegexState> {
    const m = (sc: string, pc: string) => pc === '.' || sc === pc
    const table: boolean[][] = Array.from({ length: S.length + 1 }, () => Array(P.length + 1).fill(false))
    table[0]![0] = true
    for (let i = 0; i <= S.length; i++) for (let j = 1; j <= P.length; j++) {
      if (P[j - 1] === '*') table[i]![j] = table[i]![j - 2]! || (i > 0 && m(S[i - 1]!, P[j - 2]!) && table[i - 1]![j]!)
      else table[i]![j] = i > 0 && m(S[i - 1]!, P[j - 1]!) && table[i - 1]![j - 1]!
    }
    const matched = table[S.length]![P.length]!

    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 's' | 'p' | 'table' | 'matched'>) => frames.push({ step: frames.length, s: S, p: P, table, matched, ...f })

    push({ op: 'intro', revealed: 0, curRow: -1, key: null, phase: 'run', focus: '`.`配任意字符、`*`配"零或多个前一字符"；用 DP 表',
      log: `**mini 正则引擎（. 和 *）**\n\`.\` 配任意单字符；\`*\` 配**零或多个它前面那个字符**（和通配符不同！）。\n用 DP：**dp[i][j] = s 前 i 个字符能否匹配 p 前 j 个**。\ns = "${S}"，p = "${P}"。逐行填表，看 \`*\` 怎么处理"零或多个"。` })

    const KEY = [
      { i: 0, j: 2, rule: 'zero', note: `dp[0][2]：p="c*"，让 **c* 匹配 0 个 c**（跳过 "c*"）→ 看 dp[0][0]=真 → **真**。空串能匹配 "c*"。` },
      { i: 1, j: 4, rule: 'more', note: `dp[1][4]：p="c*a*"，**a* 多吃一个 a**（s[0]='a' 配 a）→ 看 dp[0][4]=真 → **真**。` },
      { i: 2, j: 4, rule: 'more', note: `dp[2][4]：**a* 再多吃一个 a**（s[1]='a' 配 a）→ 看 dp[1][4]=真 → **真**。a* 匹配了 2 个 a。` },
      { i: 3, j: 5, rule: 'char', note: `dp[3][5]：p[4]='b' 不是 \`*\`，**s[2]='b' 配 b** 且看左上 dp[2][4]=真 → **真**。这就是最终答案。` },
    ]
    for (let i = 0; i <= S.length; i++) {
      const k = KEY[i]!
      push({ op: 'row', revealed: i + 1, curRow: i, key: { i: k.i, j: k.j, rule: k.rule }, phase: 'run',
        focus: `填第 ${i} 行（s 前 ${i} 个='${S.slice(0, i) || '空'}'）`,
        log: `**填第 ${i} 行**（s 前 ${i} 个字符 = "${S.slice(0, i) || '空'}"）\n每格看：p 这位是不是 \`*\`——是就"跳两格(零个)"或"上一格(多吃一个)"，不是就看"左上"且字符相配。\n关键格 ${k.note}` })
    }

    push({ op: 'done', revealed: S.length + 1, curRow: S.length, key: { i: S.length, j: P.length, rule: 'char' }, phase: 'done',
      focus: `右下角 dp[${S.length}][${P.length}] = ${matched ? '真 → 匹配' : '假'}`,
      log: `**结果**：右下角 dp[${S.length}][${P.length}] = **${matched ? '真 → 匹配 ✓' : '假 → 不匹配'}**。\nc* 匹配 0 个 c、a* 匹配 2 个 a、b 配 b，正好吃完 "${S}"。\n\n**小结**：正则 \`.\`\`*\` 用 DP 最清楚，\`*\` 的"零或多个"就是两种转移（跳两格 / 上一格）。O(nm) 时间和空间，比递归回溯稳、不会指数爆。面试讲：\`*\` 的两种转移、和通配符 \`*\`（任意一段）的区别、DP vs 回溯（DP 稳、回溯省空间但可能慢）、真正则引擎用 NFA/DFA（Thompson 构造）更快。`,
    })

    const base0: Frame = { op: 'intro', step: -1, s: S, p: P, table, matched, revealed: 0, curRow: -1, key: null, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '填表步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(pv) { const b = pv ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
