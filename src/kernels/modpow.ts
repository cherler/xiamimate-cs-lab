/**
 * 内核：快速模幂 a^b mod n（密码学 · 公钥运算的干活主力）
 * 轴：step —— 平方-乘(square & multiply),逐位处理指数
 *
 * RSA、DH、椭圆曲线全在算 a^b mod n,而 b 动辄几百上千位,直接乘会爆炸。快速模幂:
 * 把指数 b 拆成二进制,从低位到高位——底数每步**平方**(a→a²→a⁴→a⁸…),
 * 遇到 b 的某位是 1 就把当前底数**乘进结果**,全程对 n 取模不让数变大。O(log b) 次乘法搞定。
 *
 * 本例 3^13 mod 7:13=1101₂,结果 = 3^1·3^4·3^8 mod 7 = 3。值全部可核,每步平方/相乘都对 7 取模。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type ModPowState = {
  i: number
  step: number
  a: number; b: number; n: number
  bitPos: number; bit: number
  baseNow: number       // 当前 a^(2^k) mod n
  result: number
  mults: number
  phase: 'run' | 'done'
  log: string
}

export const MODPOW_VISIBLE = ['step', 'a', 'b', 'n', 'bitPos', 'bit', 'baseNow', 'result', 'mults', 'phase', 'log'] as const

type Frame = Omit<ModPowState, 'i'>
const A = 3, B = 13, N = 7

export const modpowKernel: Kernel<ModPowState> = {
  kind: 'modpow',
  compile(_doc: SimDocument): CompiledModel<ModPowState> {
    const frames: Frame[] = []
    let result = 1, baseNow = A % N, mults = 0
    const bits = B.toString(2).split('').reverse()   // 低位在前
    for (let k = 0; k < bits.length; k++) {
      const bit = Number(bits[k])
      let log = `第 ${k} 位 = **${bit}**：当前底数 a^(2^${k}) mod ${N} = **${baseNow}**。`
      if (bit === 1) {
        const before = result
        result = (result * baseNow) % N
        mults++
        log += ` 位是 1 → 把它乘进结果：${before}×${baseNow} mod ${N} = **${result}**。`
      } else {
        log += ` 位是 0 → 跳过,不乘。`
      }
      frames.push({ step: frames.length, a: A, b: B, n: N, bitPos: k, bit, baseNow, result, mults, phase: 'run', log })
      baseNow = (baseNow * baseNow) % N   // 为下一位平方
    }
    const lf = frames[frames.length - 1]!
    frames.push({
      ...lf, bitPos: -1, bit: -1, phase: 'done',
      log: `**算完**：${A}^${B} mod ${N} = **${result}**。13=1101₂,所以 = 3^1·3^4·3^8 mod 7。只用了 ${mults} 次「乘进结果」+ 几次平方,而不是把 3 连乘 13 次——这就是 RSA/DH 能在大数上跑起来的原因。`,
    })
    const base0: Frame = { step: -1, a: A, b: B, n: N, bitPos: -1, bit: -1, baseNow: A % N, result: 1, mults: 0, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '指数位' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
