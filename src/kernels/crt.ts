/**
 * 内核：中国剩余定理 CRT（密码学 · 数论）
 * 轴：step —— 从几个「除以 n_i 余 a_i」的条件，拼出唯一的 x
 *
 * 「物不知数」:一个数除 3 余 2、除 5 余 3、除 7 余 2,问这数是几?中国剩余定理:只要模两两互质,
 * 这组同余式在 0..N-1(N=∏n_i) 内有**唯一解**。构造法:对每个条件算 N_i=N/n_i、它模 n_i 的逆 y_i,
 * 则 x = Σ a_i·N_i·y_i mod N。RSA 解密用 CRT 拆成模 p、模 q 两个小幂,能快 3~4 倍。
 *
 * 本例 x≡2(3)、x≡3(5)、x≡2(7):唯一解 x=**23**(mod 105)。值全部可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const inv = (a: number, m: number) => { a = ((a % m) + m) % m; for (let x = 1; x < m; x++) if ((a * x) % m === 1) return x; return -1 }

export type CRTState = {
  i: number
  step: number
  ns: number[]; as: number[]; N: number
  idx: number            // 当前处理第几个条件
  Ni: number; yi: number; term: number
  acc: number            // 累加和
  x: number              // 最终解（-1 未定）
  phase: 'run' | 'done'
  log: string
}

export const CRT_VISIBLE = ['step', 'ns', 'as', 'N', 'idx', 'Ni', 'yi', 'term', 'acc', 'x', 'phase', 'log'] as const

type Frame = Omit<CRTState, 'i'>
const NS = [3, 5, 7], AS = [2, 3, 2]

export const crtKernel: Kernel<CRTState> = {
  kind: 'crt',
  compile(_doc: SimDocument): CompiledModel<CRTState> {
    const N = NS.reduce((a, b) => a * b, 1)
    const frames: Frame[] = []
    let acc = 0
    frames.push({ step: 0, ns: NS, as: AS, N, idx: -1, Ni: -1, yi: -1, term: -1, acc: 0, x: -1, phase: 'run',
      log: `条件：x 除 ${NS[0]} 余 ${AS[0]}、除 ${NS[1]} 余 ${AS[1]}、除 ${NS[2]} 余 ${AS[2]}。模两两互质，总模 N=${NS.join('×')}=**${N}**，在 0..${N - 1} 内有唯一解。` })
    for (let k = 0; k < NS.length; k++) {
      const Ni = N / NS[k]!
      const yi = inv(Ni % NS[k]!, NS[k]!)
      const term = AS[k]! * Ni * yi
      acc += term
      frames.push({ step: frames.length, ns: NS, as: AS, N, idx: k, Ni, yi, term, acc, x: -1, phase: 'run',
        log: `第 ${k + 1} 条(模 ${NS[k]})：N${k}=N/${NS[k]}=${Ni}；它模 ${NS[k]} 的逆 y=${yi}；贡献项 a·N·y=${AS[k]}×${Ni}×${yi}=**${term}**。累加 ${acc}。` })
    }
    const x = ((acc % N) + N) % N
    frames.push({ step: frames.length, ns: NS, as: AS, N, idx: -1, Ni: -1, yi: -1, term: -1, acc, x, phase: 'done',
      log: `**求解完成**：x = (${acc}) mod ${N} = **${x}**。验证：${x}÷3余${x % 3}、÷5余${x % 5}、÷7余${x % 7}，全对!CRT 保证解唯一;RSA 解密用它拆成模 p、模 q 两个小幂加速。` })
    const base0: Frame = { step: -1, ns: NS, as: AS, N, idx: -1, Ni: -1, yi: -1, term: -1, acc: 0, x: -1, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '条件' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
