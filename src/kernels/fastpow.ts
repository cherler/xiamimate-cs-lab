/**
 * 内核：快速幂 Fast Power（经典算法 · 原理：把指数拆成二进制，反复平方 + 挑位相乘，O(log n)）
 * 轴：step —— 算 a^n。看 n 的二进制,从低位到高位:每一位对应一个"反复平方"得来的幂 a^(2^k);
 *      这一位是 1 就把 a^(2^k) 乘进结果、是 0 就跳过。log₂n 步搞定,而不是老实乘 n 次。
 *
 * 求 a^n 最笨是乘 n-1 次。快速幂用**分治/二进制**把它压到 **O(log n)**:关键是把指数写成二进制,
 * 比如 13 = 1101₂ = 8+4+1,于是 a¹³ = a⁸·a⁴·a¹——只用到"平方得来"的幂 a¹,a²,a⁴,a⁸(每个由上一个**平方**而来,
 * a²=a·a、a⁴=a²·a²…只需 log n 次平方)。再看二进制哪几位是 1,把对应的那几个幂乘起来就是答案。
 *
 * 本实验:算 **3¹³**。n=13=1101₂=8+4+1。你会看到 base 反复平方(3→9→81→6561),二进制某位是 1 就把当前 base
 * 乘进 result:bit0=1 取 3、bit1=0 跳、bit2=1 取 81、bit3=1 取 6561 → 3·81·6561 = **1594323**。
 * 只用 3 次乘法(+3 次平方),而朴素要乘 13 次。每个数都可手算核对。快速幂是模幂(RSA)、矩阵快速幂(线性递推)的底子。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const A = 3
const NEXP = 13

export type FastPowState = {
  i: number
  step: number
  a: number
  n: number
  bitsMSB: number[]            // 二进制高位在前，如 [1,1,0,1]
  k: number                    // 当前处理的位（低位起，LSB=0）
  bit: number                  // 当前位值
  powK: number                 // a^(2^k)：本位对应的“平方幂”
  result: number               // 累乘结果
  prevResult: number
  mults: number                // 已做的乘法次数
  squares: number              // 已做的平方次数
  picked: number[]             // 已选入结果的指数幂（如 [1,4,8]）
  act: string                  // 'mul' | 'skip' | 'done'
  phase: 'run' | 'done'
  log: string
}

export const FASTPOW_VISIBLE = [
  'step', 'a', 'n', 'bitsMSB', 'k', 'bit', 'powK', 'result', 'prevResult', 'mults', 'squares', 'picked', 'act', 'phase', 'log',
] as const

type Frame = Omit<FastPowState, 'i'>

export const fastpowKernel: Kernel<FastPowState> = {
  kind: 'fastpow',

  compile(_doc: SimDocument): CompiledModel<FastPowState> {
    const bitsMSB = NEXP.toString(2).split('').map(Number)
    const nbits = bitsMSB.length
    const frames: Frame[] = []
    let result = 1, base = A, mults = 0, squares = 0
    const picked: number[] = []

    for (let k = 0; k < nbits; k++) {
      const bit = (NEXP >> k) & 1
      const powK = base
      const prevResult = result
      let act: string
      if (bit) {
        result *= base
        mults++
        picked.push(2 ** k)
        act = 'mul'
      } else {
        act = 'skip'
      }
      frames.push({
        step: frames.length, a: A, n: NEXP, bitsMSB, k, bit, powK, result, prevResult,
        mults, squares, picked: picked.slice(), act, phase: 'run',
        log: `第 ${k} 位 = **${bit}**,它对应幂 a^(2^${k}) = ${A}^${2 ** k} = **${powK}**。` +
          (bit ? `这位是 1 → 把 ${powK} **乘进结果**:${prevResult} × ${powK} = **${result}**。`
            : `这位是 0 → **跳过**,结果不变(仍 ${result})。`) +
          `(base 平方 ${powK}→${powK * powK},为下一位备好。)`,
      })
      base *= base
      squares++
    }

    frames.push({
      step: frames.length, a: A, n: NEXP, bitsMSB, k: nbits, bit: -1, powK: -1, result, prevResult: result,
      mults, squares: squares - 1, picked: picked.slice(), act: 'done', phase: 'done',
      log: `**算完**:${A}^${NEXP} = ${A}^(${picked.join('+')}) = ${picked.map(e => `${A}^${e}`).join('·')} = **${result}**。` +
        `只用 ${mults} 次乘法 + ${squares - 1} 次平方 = ${mults + squares - 1} 次,而朴素要乘 ${NEXP} 次——O(log n) vs O(n)。` +
        `指数越大差距越夸张(n=10⁹ 也就 ~30 步)。模幂(RSA 加解密)、矩阵快速幂(O(log n) 求斐波那契等线性递推)都靠它。`,
    })

    const base0: Frame = {
      step: -1, a: A, n: NEXP, bitsMSB, k: -1, bit: -1, powK: -1, result: 1, prevResult: 1,
      mults: 0, squares: 0, picked: [], act: '', phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '逐位(平方+相乘)' },
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
