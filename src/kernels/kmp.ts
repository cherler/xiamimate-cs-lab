/**
 * 内核：KMP 字符串匹配（数据结构）
 * 轴：step
 *
 * 两个阶段：
 *   next  求 next 数组 —— 本质是"模式串自己跟自己匹配"
 *   match 用 next 数组做匹配 —— 失配时主串指针**永不回退**，这是 KMP 的全部价值
 *
 * next[j] 的含义：模式串前 j 个字符里，最长的「相等前后缀」长度。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type KmpState = {
  i: number
  phase: 'next' | 'match' | 'found' | 'done'
  /** 当前的 next 数组（未算到的位置为 −1） */
  next: number[]
  /** next 阶段：正在算哪一位、比较哪两个字符 */
  j: number
  k: number
  /** match 阶段：主串与模式串的当前下标 */
  ti: number
  pj: number
  /** 本步比较的两个字符是否相等 */
  eq: boolean | null
  /** 已找到的匹配起点 */
  found: number[]
  /** 主串指针总共前进了多少次（用来说明"永不回退"） */
  textAdvances: number
  log: string
}

export const KMP_VISIBLE = [
  'i', 'phase', 'next', 'j', 'k', 'ti', 'pj', 'eq', 'found', 'textAdvances', 'log',
] as const

type Frame = Omit<KmpState, 'i'>

export const kmpKernel: Kernel<KmpState> = {
  kind: 'kmp',

  compile(doc: SimDocument): CompiledModel<KmpState> {
    const text = str(doc.params, 'text')
    const pattern = str(doc.params, 'pattern')
    const showMatch = num(doc.params, 'showMatch') === 1

    const m = pattern.length
    const next = new Array(m).fill(-1)
    const frames: Frame[] = []
    const put = (f: Partial<Frame> & { phase: Frame['phase']; log: string }) => frames.push({
      next: [...next], j: -1, k: -1, ti: -1, pj: -1, eq: null,
      found: frames.at(-1)?.found ? [...frames.at(-1)!.found] : [],
      textAdvances: frames.at(-1)?.textAdvances ?? 0, ...f,
    })

    // ── 阶段一：求 next ─────────────────────────────────
    if (m > 0) {
      next[0] = 0
      put({ phase: 'next', j: 0, log: `next[0] = 0 —— 只有一个字符，没有真前后缀` })
      let k = 0
      for (let j = 1; j < m; j++) {
        while (k > 0 && pattern[j] !== pattern[k]) {
          put({
            phase: 'next', j, k, eq: false,
            log: `算 next[${j}]：'${pattern[j]}' ≠ '${pattern[k]}' → 回退 k = next[${k - 1}] = ${next[k - 1]}`,
          })
          k = next[k - 1]
        }
        if (pattern[j] === pattern[k]) {
          k++
          next[j] = k
          put({
            phase: 'next', j, k: k - 1, eq: true,
            log: `算 next[${j}]：'${pattern[j]}' = '${pattern[k - 1]}' → k 加一，next[${j}] = ${k}`
              + `（前缀 "${pattern.slice(0, k)}" 同时也是后缀）`,
          })
        } else {
          next[j] = 0
          put({
            phase: 'next', j, k, eq: false,
            log: `算 next[${j}]：k 已经回退到 0 且仍不相等 → next[${j}] = 0`,
          })
        }
      }
    }

    // ── 阶段二：用 next 匹配 ────────────────────────────
    if (showMatch && m > 0) {
      let ti = 0, pj = 0
      let advances = 0
      const found: number[] = []
      while (ti < text.length) {
        const eq = text[ti] === pattern[pj]
        if (eq) {
          put({
            phase: 'match', ti, pj, eq: true, textAdvances: advances + 1, found: [...found],
            log: `主串[${ti}]='${text[ti]}' = 模式[${pj}]='${pattern[pj]}' → 两个指针都前进`,
          })
          ti++; pj++; advances++
          if (pj === m) {
            found.push(ti - m)
            put({
              phase: 'found', ti: ti - 1, pj: pj - 1, textAdvances: advances, found: [...found],
              log: `模式串走到末尾 → 在主串下标 ${ti - m} 处找到一个匹配；`
                + `按 next[${m - 1}] = ${next[m - 1]} 继续找下一个`,
            })
            pj = next[m - 1]
          }
        } else if (pj === 0) {
          put({
            phase: 'match', ti, pj, eq: false, textAdvances: advances + 1, found: [...found],
            log: `主串[${ti}]='${text[ti]}' ≠ 模式[0]='${pattern[0]}'，模式已在起点 → 主串前进一位`,
          })
          ti++; advances++
        } else {
          put({
            phase: 'match', ti, pj, eq: false, textAdvances: advances, found: [...found],
            log: `主串[${ti}]='${text[ti]}' ≠ 模式[${pj}]='${pattern[pj]}' → `
              + `**主串指针不动**，模式串滑到 next[${pj - 1}] = ${next[pj - 1]}`
              + `（朴素算法这时要把主串退回去重来，KMP 不用）`,
          })
          pj = next[pj - 1]
        }
      }
      put({
        phase: 'done', textAdvances: advances, found: [...found],
        log: found.length
          ? `匹配结束：共找到 ${found.length} 处，起点为 ${found.join('、')}；`
            + `主串指针总共只前进了 ${advances} 次，一次都没回退`
          : `匹配结束：没有找到；主串指针前进 ${advances} 次，一次都没回退`,
      })
    } else {
      put({
        phase: 'done',
        log: `next 数组求解完毕：[${next.join(', ')}]`,
      })
    }

    return {
      axis: { kind: 'step', label: '步骤' },
      initial: () => ({
        i: -1, phase: 'next', next: new Array(m).fill(-1), j: -1, k: -1,
        ti: -1, pj: -1, eq: null, found: [], textAdvances: 0, log: '',
      }),
      describe: s => s.log,
      step(prev) {
        const base = prev ?? this.initial()
        const i = base.i + 1
        if (i >= frames.length) return null
        return { state: { i, ...frames[i] }, done: i === frames.length - 1 }
      },
    }
  },
}
