/**
 * 内核：栈与表达式求值（数据结构）
 * 轴：step —— 先「中缀转后缀」（调度场算法），再「后缀求值」，两段都靠一个栈
 *
 * 这个实验把栈最经典的两个用途摊开：
 *   1. 中缀 → 后缀：数字直接输出；运算符要和栈顶比优先级，
 *      不比它高的先弹出去；括号成对地压入 / 弹出。
 *   2. 后缀求值：遇数字压栈，遇运算符弹两个算完再压回 —— 一遍扫描就出答案。
 *
 * 栈的"后进先出"在这里有两处硬约束：优先级更高的运算符后进却先算；
 * 求值时右操作数后进却在减/除里当被减/被除数的右边。都靠这个实验讲清。
 *
 * 状态全部可 JSON 往返（验收标准 2）：栈用数组、不用引用。
 */
import { str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type ExprState = {
  i: number
  phase: 'toRPN' | 'eval'
  /** 输入的中缀 token 序列 */
  infix: string[]
  /** 本步正在读的 token 下标（-1 表示阶段收尾） */
  at: number
  /** 运算符栈（转后缀）/ 数值栈（求值），都用字符串装 */
  stack: string[]
  /** 已产出的后缀序列 */
  rpn: string[]
  /** 求值阶段：结果（收尾时） */
  result: number | null
  act: 'num' | 'op' | 'lparen' | 'rparen' | 'push' | 'pop' | 'apply' | 'flush' | 'done'
  log: string
}

export const EXPR_VISIBLE = [
  'i', 'phase', 'infix', 'at', 'stack', 'rpn', 'result', 'act', 'log',
] as const

type Frame = Omit<ExprState, 'i'>

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }
const isOp = (t: string) => t in PREC
const isNum = (t: string) => /^\d+$/.test(t)

//  把 "3+4*2-1" 这样的串切成 token（数字、运算符、括号）
function tokenize(s: string): string[] {
  const out: string[] = []
  let num = ''
  for (const ch of s.replace(/\s+/g, '')) {
    if (/\d/.test(ch)) { num += ch; continue }
    if (num) { out.push(num); num = '' }
    if ('+-*/()'.includes(ch)) out.push(ch)
  }
  if (num) out.push(num)
  return out
}

export const exprKernel: Kernel<ExprState> = {
  kind: 'expr',

  compile(doc: SimDocument): CompiledModel<ExprState> {
    const infix = tokenize(str(doc.params, 'expr') || '3+4*2-1')

    const frames: Frame[] = []
    const base = (phase: Frame['phase']): Frame => ({
      phase, infix, at: -1, stack: [], rpn: [], result: null, act: 'done', log: '',
    })

    // ── 阶段一：中缀 → 后缀（调度场算法）──
    {
      const stack: string[] = []
      const rpn: string[] = []
      const snap = (at: number, act: Frame['act'], log: string) =>
        frames.push({ ...base('toRPN'), at, stack: [...stack], rpn: [...rpn], act, log })

      infix.forEach((t, k) => {
        if (isNum(t)) {
          rpn.push(t)
          snap(k, 'num', `读到数字 **${t}** → 直接进后缀序列`)
        } else if (t === '(') {
          stack.push(t)
          snap(k, 'lparen', `读到 **(** → 压栈，等它的右括号`)
        } else if (t === ')') {
          while (stack.length && stack[stack.length - 1] !== '(') rpn.push(stack.pop()!)
          stack.pop() // 弹掉 '('
          snap(k, 'rparen', `读到 **)** → 把栈里一直弹到 ( 为止，再丢掉这对括号`)
        } else if (isOp(t)) {
          const popped: string[] = []
          while (stack.length && stack[stack.length - 1] !== '(' && PREC[stack[stack.length - 1]] >= PREC[t]) {
            popped.push(stack[stack.length - 1]); rpn.push(stack.pop()!)
          }
          stack.push(t)
          snap(k, 'op', popped.length
            ? `读到 **${t}**：栈顶 ${popped.join('、')} 优先级不比它低 → 先弹出去，再压 ${t}`
            : `读到 **${t}**：栈顶没有更该先算的 → 直接压栈`)
        }
      })
      while (stack.length) rpn.push(stack.pop()!)
      frames.push({ ...base('toRPN'), at: -1, stack: [], rpn: [...rpn], act: 'flush',
        log: `读完了：把运算符栈里剩下的全部弹出 → 后缀式 **${rpn.join(' ')}**` })
    }

    const rpnFinal = frames[frames.length - 1].rpn

    // ── 阶段二：后缀求值 ──
    {
      const stack: string[] = []
      const snap = (at: number, act: Frame['act'], log: string, result: number | null = null) =>
        frames.push({ ...base('eval'), at, stack: [...stack], rpn: rpnFinal, act, result, log })

      rpnFinal.forEach((t, k) => {
        if (isNum(t)) {
          stack.push(t)
          snap(k, 'push', `遇数字 **${t}** → 压入数值栈`)
        } else {
          const b = Number(stack.pop()), a = Number(stack.pop())
          const r = t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : Math.trunc(a / b)
          stack.push(String(r))
          snap(k, 'apply', `遇 **${t}** → 弹出栈顶两个：${a} ${t} ${b} = **${r}**，结果压回`)
        }
      })
      const val = stack.length === 1 ? Number(stack[0]) : NaN
      frames.push({ ...base('eval'), at: -1, stack: [...stack], rpn: rpnFinal, act: 'done', result: val,
        log: `栈里只剩一个数，它就是答案：**${val}**` })
    }

    return {
      axis: { kind: 'step', label: '步骤' },
      initial: () => ({ i: -1, ...base('toRPN'), act: 'done', log: '' }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const i = b.i + 1
        if (i >= frames.length) return null
        return { state: { i, ...frames[i] }, done: i === frames.length - 1 }
      },
    }
  },
}
