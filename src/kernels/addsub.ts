/**
 * 内核：补码定点加减与溢出（计算机组成原理）
 * 轴：step —— 取补码 → (减法)求负数补码 → 逐列相加(带进位) → 判溢出 → 结果
 *
 * 三个要讲明白的点：
 *   1. 补码加法**符号位一起参与运算**，不用单独处理符号 —— 这是补码相对原码最大的好处。
 *   2. 减法 A − B = A + (−B)的补码，而 (−B)补码 = B 按位取反 + 1。
 *   3. 溢出**不是看最高位进位**，而是看「符号位进位 ⊕ 次高位进位」——
 *      两者不同才溢出。等价说法：同号相加得到异号，就是溢出。
 *
 * 状态全部可 JSON 往返（验收标准 2）。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type AddSubState = {
  i: number
  bits: number
  op: 'add' | 'sub'
  aVal: number
  bVal: number
  aBits: string
  bBits: string
  /** 实际参与相加的第二个数（加法=B补码，减法=−B补码） */
  addend: string
  /** 本步在算第几列（0=最高位/符号位，bits−1=最低位）；−1 表示还没开始逐列相加 */
  pos: number
  /** 已经算出来的结果位（未算到的位是 '·'） */
  sum: string
  /** 进入本列的进位 */
  carryIn: number
  /** 各列产生的进位链，供画图 */
  carries: number[]
  /** 溢出判定用：进入符号位的进位、移出符号位的进位 */
  cInSign: number
  cOutSign: number
  overflow: boolean
  act: 'setup' | 'negate' | 'addbit' | 'overflow' | 'done'
  log: string
}

export const ADDSUB_VISIBLE = [
  'i', 'bits', 'op', 'aVal', 'bVal', 'aBits', 'bBits', 'addend',
  'pos', 'sum', 'carryIn', 'carries', 'cInSign', 'cOutSign', 'overflow', 'act', 'log',
] as const

type Frame = Omit<AddSubState, 'i'>

//  n 位补码
const toComp = (v: number, n: number): string => {
  const m = ((v % (1 << n)) + (1 << n)) % (1 << n)
  return m.toString(2).padStart(n, '0')
}
const fromComp = (s: string): number => {
  const v = parseInt(s, 2)
  return s[0] === '1' ? v - (1 << s.length) : v
}
const invert = (s: string) => s.split('').map(c => (c === '0' ? '1' : '0')).join('')
const negComp = (s: string) => toComp(-fromComp(s), s.length)

export const addsubKernel: Kernel<AddSubState> = {
  kind: 'addsub',

  compile(doc: SimDocument): CompiledModel<AddSubState> {
    const bits = num(doc.params, 'bits') || 8
    const op: AddSubState['op'] = str(doc.params, 'operation') === '减' ? 'sub' : 'add'
    const ops = (doc.streams.find(s => s.name === 'operands')?.values ?? [0, 0]) as number[]
    const aVal = ops[0] ?? 0, bVal = ops[1] ?? 0

    const aBits = toComp(aVal, bits)
    const bBits = toComp(bVal, bits)
    const addend = op === 'sub' ? negComp(bBits) : bBits

    const frames: Frame[] = []
    const blank = '·'.repeat(bits)
    const base = (): Frame => ({
      bits, op, aVal, bVal, aBits, bBits, addend,
      pos: -1, sum: blank, carryIn: 0, carries: new Array(bits).fill(0),
      cInSign: 0, cOutSign: 0, overflow: false, act: 'setup', log: '',
    })

    //  ① 取补码
    frames.push({ ...base(),
      log: `写出两个数的补码：[A]补 = ${aBits}（${aVal}），[B]补 = ${bBits}（${bVal}）` })

    //  ② 减法：把 B 换成 −B 的补码
    if (op === 'sub') {
      frames.push({ ...base(), act: 'negate',
        log: `减法 A − B = A + (−B)：(−B)补 = [B]补按位取反 + 1 = ${invert(bBits)} + 1 = ${addend}` })
    }

    //  ③ 逐列相加（从最低位到最高位）
    const sumArr = blank.split('')
    const carries = new Array(bits).fill(0)
    let carry = 0
    let cInSign = 0, cOutSign = 0
    for (let k = bits - 1; k >= 0; k--) {
      const da = aBits.charCodeAt(k) - 48
      const db = addend.charCodeAt(k) - 48
      const s = da + db + carry
      const bit = s & 1
      const cOut = s >> 1
      if (k === 0) { cInSign = carry; cOutSign = cOut }
      sumArr[k] = String(bit)
      carries[k] = cOut       // 这一列产生、送往更高一列的进位
      frames.push({ ...base(), act: 'addbit', pos: k,
        sum: sumArr.join(''), carryIn: carry, carries: [...carries],
        log: `第 ${bits - k} 列（从低位数）：${da} + ${db} + 进位 ${carry} = ${s} → 本位 ${bit}，向上进位 ${cOut}` })
      carry = cOut
    }

    const sum = sumArr.join('')
    const overflow = (cInSign ^ cOutSign) === 1

    //  ④ 判溢出
    frames.push({ ...base(), act: 'overflow', pos: 0, sum,
      carries: [...carries], cInSign, cOutSign, overflow,
      log: `判溢出：进入符号位的进位 ${cInSign} ⊕ 移出符号位的进位 ${cOutSign} = ${cInSign ^ cOutSign} → `
        + (overflow ? '**溢出**！结果超出了 ' + bits + ' 位补码能表示的范围' : '无溢出，结果有效') })

    //  ⑤ 结果
    const resultVal = fromComp(sum)
    frames.push({ ...base(), act: 'done', pos: -1, sum,
      carries: [...carries], cInSign, cOutSign, overflow,
      log: overflow
        ? `结果补码 ${sum} 若按 ${bits} 位解读是 ${resultVal}，但已溢出 —— 这个值是错的，真正的和是 ${op === 'sub' ? aVal - bVal : aVal + bVal}`
        : `结果补码 ${sum} = ${resultVal}　（${aVal} ${op === 'sub' ? '−' : '+'} ${bVal} = ${op === 'sub' ? aVal - bVal : aVal + bVal}）` })

    return {
      axis: { kind: 'step', label: '运算步骤' },
      initial: () => ({ i: -1, ...base() }),
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
