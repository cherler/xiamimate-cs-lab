/**
 * 内核：费马素性测试（密码学 · 素数判定）
 * 轴：step —— 用费马小定理快速判断一个数是不是素数
 *
 * RSA 要选大素数,可几百位的数没法试除。费马小定理:若 p 是素数,则对任意 1<a<p 有 a^(p-1) ≡ 1 (mod p)。
 * 反过来当检测:算 a^(n-1) mod n,**若 ≠ 1,n 一定是合数**(铁证);若 = 1,n 很可能是素数(概率判定)。
 * 极少数「卡迈克尔数」会骗过它,所以实用中用更强的米勒-拉宾,但骨架就是这个模幂。
 *
 * 本例测 n=15、底 a=2:2^14 mod 15 = 4 ≠ 1 → **15 是合数**,当场揪出。值全部可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type FermatState = {
  i: number
  step: number
  n: number; a: number
  bitPos: number; bit: number; baseNow: number; result: number
  verdict: string        // '' | '合数' | '可能素数'
  phase: 'run' | 'done'
  log: string
}

export const FERMAT_VISIBLE = ['step', 'n', 'a', 'bitPos', 'bit', 'baseNow', 'result', 'verdict', 'phase', 'log'] as const

type Frame = Omit<FermatState, 'i'>
const N = 15, A = 2   // 测 a^(n-1) mod n = 2^14 mod 15

export const fermatKernel: Kernel<FermatState> = {
  kind: 'fermat',
  compile(_doc: SimDocument): CompiledModel<FermatState> {
    const frames: Frame[] = []
    const exp = N - 1
    let result = 1, baseNow = A % N
    const bits = exp.toString(2).split('').reverse()
    frames.push({ step: 0, n: N, a: A, bitPos: -1, bit: -1, baseNow, result, verdict: '', phase: 'run',
      log: `费马小定理：素数 p 满足 a^(p-1)≡1 (mod p)。反过来测 n=${N}：算 **${A}^${exp} mod ${N}**,若 ≠1 则 ${N} 必是合数。` })
    for (let k = 0; k < bits.length; k++) {
      const bit = Number(bits[k])
      if (bit === 1) result = (result * baseNow) % N
      frames.push({ step: frames.length, n: N, a: A, bitPos: k, bit, baseNow, result, verdict: '', phase: 'run',
        log: `指数第 ${k} 位=${bit}：底数 a^(2^${k}) mod ${N}=${baseNow}${bit === 1 ? ` → 乘进结果 → ${result}` : ' → 跳过'}。` })
      baseNow = (baseNow * baseNow) % N
    }
    const verdict = result === 1 ? '可能素数' : '合数'
    frames.push({ step: frames.length, n: N, a: A, bitPos: -1, bit: -1, baseNow, result, verdict, phase: 'done',
      log: `**测完**：${A}^${exp} mod ${N} = **${result}**。${result === 1 ? `=1 → ${N} **可能是素数**(概率判定,极少数卡迈克尔数会骗过)。` : `≠1 → ${N} **一定是合数**!费马测试当场揪出了它——这就是 RSA 选素数时先用它快速筛掉合数。`}`,
    })
    const base0: Frame = { step: -1, n: N, a: A, bitPos: -1, bit: -1, baseNow: A % N, result: 1, verdict: '', phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '指数位' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
