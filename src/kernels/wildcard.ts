/**
 * 内核：通配符匹配 —— `?`(任意一个字符) `*`(任意一段，含空) 的双指针回溯（算法 · 项目实战 / 求职）
 * 轴：step —— 两个指针扫 s 和 p，`*` 记一个"锚点"，走不通就回溯让 `*` 多吃一个字符
 *
 * 通配符匹配(LeetCode 44)是经典字符串题。`?` 配任意单字符,`*` 配任意一段(可空)。难点是 `*` 该吃几个字符——
 * 优雅解法是**双指针 + 回溯锚点**:遇到 `*` 先记下它的位置(锚点)、当作匹配 0 个继续往后走;
 * 一旦后面走不通,就**回溯**到锚点、让 `*` **多吃一个字符**再试。这样不用递归、O(n) 空间。
 * 本例 s="abcd", p="a*d":a↔a 匹配;遇 `*` 记锚点;后面 d≠b 回溯让 `*` 吃 b、再吃 c;最后 d↔d 匹配 → ✓。
 * 值:每步的指针、`*` 吃了哪几个字符都可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const S = 'abcd'
const P = 'a*d'

export type WildState = {
  i: number
  step: number
  op: 'intro' | 'match' | 'star' | 'backtrack' | 'done'
  s: string
  p: string
  si: number               // s 指针
  pj: number               // p 指针
  star: number             // p 里 `*` 的位置（-1 无）
  coverFrom: number        // `*` 开始吃字符的 s 起点（-1 无）
  coverTo: number          // `*` 已吃到的 s 位置（不含）
  matched: boolean         // 末态：是否匹配
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<WildState, 'i'>

export const wildcardKernel: Kernel<WildState> = {
  kind: 'wildcard',
  compile(_doc: SimDocument): CompiledModel<WildState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 's' | 'p'>) => frames.push({ step: frames.length, s: S, p: P, ...f })

    push({ op: 'intro', si: 0, pj: 0, star: -1, coverFrom: -1, coverTo: -1, matched: false, phase: 'run', focus: '`?`配一个字符、`*`配任意一段；双指针 + 回溯锚点',
      log: `**通配符匹配**\n\`?\` 配任意**单个**字符，\`*\` 配任意**一段**（可空）。难在 \`*\` 该吃几个字符。\n优雅解：双指针扫 s、p，遇 \`*\` 先记**锚点**、当匹配 0 个往后走；走不通就**回溯**、让 \`*\` 多吃一个再试。\ns = "${S}"，p = "${P}"。看它怎么匹配。` })

    let si = 0, pj = 0, star = -1, sTmp = 0, coverFrom = -1, coverTo = -1
    while (si < S.length) {
      if (pj < P.length && (P[pj] === S[si] || P[pj] === '?')) {
        const c = S[si], pc = P[pj]
        si++; pj++
        push({ op: 'match', si, pj, star, coverFrom, coverTo, matched: false, phase: 'run', focus: `匹配 '${c}' ↔ '${pc}'，两指针都前进`,
          log: `**匹配 '${c}' ↔ '${pc}'**\n${pc === '?' ? '`?` 配任意字符' : '字符相同'} → si、pj 都 +1（现在 si=${si}, pj=${pj}）。${coverFrom >= 0 && coverTo > coverFrom ? `（\`*\` 已定，吃了 "${S.slice(coverFrom, coverTo)}"）` : ''}` })
      } else if (pj < P.length && P[pj] === '*') {
        star = pj; sTmp = si; coverFrom = si; coverTo = si; pj++
        push({ op: 'star', si, pj, star, coverFrom, coverTo, matched: false, phase: 'run', focus: `遇 '*'：记锚点(p=${star})，先当匹配 0 个字符`,
          log: `**遇到 '*'**\n记下锚点：\`*\` 在 p 的位置 ${star}，此刻 s 到 si=${si}。**先当它匹配 0 个字符**，pj 越过 \`*\` 往后走（pj=${pj}）。走不通再回来让它多吃。` })
      } else if (star >= 0) {
        pj = star + 1; sTmp++; si = sTmp; coverTo = si
        push({ op: 'backtrack', si, pj, star, coverFrom, coverTo, matched: false, phase: 'run', focus: `走不通 → 回溯到锚点，让 '*' 多吃一个字符`,
          log: `**回溯**\n当前位置配不上 → 回到锚点：让 \`*\` **多吃一个字符**（吃到 s[${si - 1}]='${S[si - 1]}'），pj 回到锚点后一位 ${pj}，si=${si} 继续。\`*\` 现在吃了 "${S.slice(coverFrom, coverTo)}"。` })
      } else {
        push({ op: "done", si, pj, star, coverFrom, coverTo, matched: false, phase: 'done', focus: '没有 `*` 可回溯 → 不匹配',
          log: `**不匹配**：配不上又没有 \`*\` 可回溯。` })
        break
      }
    }

    if (frames[frames.length - 1]!.op !== 'done') {
      let pj2 = pj; while (pj2 < P.length && P[pj2] === '*') pj2++
      const ok = si === S.length && pj2 === P.length
      push({ op: "done", si, pj: pj2, star, coverFrom, coverTo, matched: ok, phase: 'done', focus: ok ? 's 扫完、p 剩下的都是 `*` → 匹配 ✓' : '不匹配',
        log: `**结束**\ns 扫完（si=${si}）。p 剩下的${pj2 > pj ? '若干 `*` 跳过后' : ''}也到头（pj=${pj2}）→ **${ok ? '匹配 ✓' : '不匹配 ✗'}**。\n\n**小结**：\`*\` 用**锚点 + 回溯**处理"该吃几个"——先贪心当 0 个、走不通就逐个多吃。O(n) 空间、不用递归/DP。面试讲：\`*\` 为什么要回溯、锚点法 vs 动态规划（DP 更直观但 O(nm) 空间）、和正则 \`.*\` 的区别。文件通配、路由匹配、SQL LIKE 都用类似思路。`,
      })
    }

    const base0: Frame = { op: 'intro', step: -1, s: S, p: P, si: 0, pj: 0, star: -1, coverFrom: -1, coverTo: -1, matched: false, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '匹配步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
