/**
 * 内核：分组密码工作模式 · ECB vs CBC —— 为什么 ECB 会泄露明文 pattern（安全 · 密码学）
 * 轴：step —— 同一批明文,分别走 ECB 和 CBC 加密,看重复明文块的下场
 *
 * 经典教学题("ECB 企鹅图"的原理):明文里有**重复的块**(P1=P3),
 *   · ECB: C_i = E(P_i)。块独立加密→相同明文块必得相同密文块→**重复 pattern 直接泄露**。
 *   · CBC: C_i = E(P_i ⊕ C_{i-1})。每块先和上一块密文异或再加密→链接打散→相同明文块也得不同密文。
 * 为了能手算,把分组密码 E 建模成 E(x)=x⊕K(4-bit 块),全程只有异或:
 *   P=[1010,1100,1010,0011](P1=P3), K=0110, IV=1111
 *   ECB=[1100,1010,1100,0101] → C1=C3(泄露);  CBC=[0011,1001,0101,0000] → C1≠C3(不泄露)
 * 数字全部代码现算,可逐位手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type EcbCbcState = {
  i: number
  step: number
  mode: 'intro' | 'ecb' | 'cbc'
  blockIdx: number        // 本步刚算出的块下标(-1 表示未开始/小结)
  P: number[]             // 明文 4 块(4-bit 整数)
  K: number
  IV: number
  ecbC: number[]          // ECB 密文,逐块累积
  cbcC: number[]          // CBC 密文,逐块累积
  expr: string            // 本步计算式
  ecbLeak: boolean        // ECB 跑完:C1==C3
  cbcSafe: boolean        // CBC 跑完:C1!=C3
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<EcbCbcState, 'i'>

const P = [0b1010, 0b1100, 0b1010, 0b0011]
const K = 0b0110
const IV = 0b1111
const bin = (n: number) => n.toString(2).padStart(4, '0')

export const ecbcbcKernel: Kernel<EcbCbcState> = {
  kind: 'ecbcbc',
  compile(_doc: SimDocument): CompiledModel<EcbCbcState> {
    const ecbFull = P.map(p => p ^ K)
    const cbcFull: number[] = []
    { let prev = IV; for (const p of P) { const c = (p ^ prev) ^ K; cbcFull.push(c); prev = c } }
    const ecbLeak = ecbFull[0] === ecbFull[2]
    const cbcSafe = cbcFull[0] !== cbcFull[2]

    const frames: Frame[] = []
    const base = { P: [...P], K, IV, ecbLeak: false, cbcSafe: false }
    const push = (f: Omit<Frame, 'step' | 'P' | 'K' | 'IV' | 'ecbLeak' | 'cbcSafe'> & { ecbLeak?: boolean; cbcSafe?: boolean }) => frames.push({ step: frames.length, ...base, ...f, ecbLeak: f.ecbLeak ?? false, cbcSafe: f.cbcSafe ?? false } as Frame)

    // f0 明文
    push({
      mode: 'intro', blockIdx: -1, ecbC: [], cbcC: [], expr: '',
      phase: 'run', focus: '明文里有重复块：P1 = P3 = 1010',
      log: `**明文（4 个 4-bit 块）**\nP = ${P.map(bin).join(' ')}\n注意 **P1 = P3 = 1010**（重复的块，比如一张图里大片同色区域）。\n分组密码 E 这里简化成 E(x)=x⊕K（K=${bin(K)}），好让每一步都能手算。看两种模式怎么处理这对重复块。`,
    })

    // ECB f1..f4
    for (let b = 0; b < P.length; b++) {
      const c = ecbFull.slice(0, b + 1)
      push({
        mode: 'ecb', blockIdx: b, ecbC: c, cbcC: [], expr: `C${b + 1}=E(P${b + 1})=${bin(P[b]!)}⊕${bin(K)}=${bin(ecbFull[b]!)}`,
        phase: 'run', focus: `ECB · 第 ${b + 1} 块：块独立加密`,
        log: `**ECB · 加密第 ${b + 1} 块**\nECB 每块**独立**加密：C${b + 1}=E(P${b + 1})=P${b + 1}⊕K\n= ${bin(P[b]!)} ⊕ ${bin(K)} = **${bin(ecbFull[b]!)}**${b === 2 ? `\n⚠ P3 和 P1 一样，算出的 C3 也和 C1 一样（都是 ${bin(ecbFull[0]!)}）。` : ''}`,
      })
    }
    // f5 ECB 小结
    push({
      mode: 'ecb', blockIdx: -1, ecbC: [...ecbFull], cbcC: [], expr: `C1=C3=${bin(ecbFull[0]!)}`,
      ecbLeak, phase: 'run', focus: 'ECB 结论：重复明文 → 重复密文，pattern 泄露',
      log: `**ECB 全部密文** = ${ecbFull.map(bin).join(' ')}\n**C1 = C3 = ${bin(ecbFull[0]!)}**——明文里哪里有重复，密文里一模一样地重复出来。这就是著名的「ECB 企鹅」：加密后轮廓还在。**ECB 泄露了明文的结构**，实战禁用。`,
    })

    // CBC f6..f9
    let prev = IV
    for (let b = 0; b < P.length; b++) {
      const x = P[b]! ^ prev
      const c = cbcFull.slice(0, b + 1)
      push({
        mode: 'cbc', blockIdx: b, ecbC: [...ecbFull], cbcC: c,
        expr: `C${b + 1}=E(P${b + 1}⊕${b === 0 ? 'IV' : `C${b}`})=(${bin(P[b]!)}⊕${bin(prev)})⊕${bin(K)}=${bin(cbcFull[b]!)}`,
        phase: 'run', focus: `CBC · 第 ${b + 1} 块：先和上一块密文异或`,
        log: `**CBC · 加密第 ${b + 1} 块**\nCBC 先把明文块和**上一块密文**异或(第 1 块用 IV)，再加密：\nC${b + 1}=E(P${b + 1}⊕${b === 0 ? `IV=${bin(IV)}` : `C${b}=${bin(prev)}`}) = E(${bin(x)}) = ${bin(x)}⊕${bin(K)} = **${bin(cbcFull[b]!)}**${b === 2 ? `\n👀 P3 还是 1010（和 P1 相同），但它异或的是不同的 C2，所以 C3=${bin(cbcFull[2]!)} ≠ C1=${bin(cbcFull[0]!)}。` : ''}`,
      })
      prev = cbcFull[b]!
    }
    // f10 done 对比
    push({
      mode: 'cbc', blockIdx: -1, ecbC: [...ecbFull], cbcC: [...cbcFull], expr: `CBC: C1=${bin(cbcFull[0]!)} ≠ C3=${bin(cbcFull[2]!)}`,
      ecbLeak, cbcSafe, phase: 'done', focus: '对比：同一批明文，CBC 把重复彻底打散',
      log: `**对比完成**\n明文相同：P1 = P3 = 1010\n· ECB → C1 = C3 = ${bin(ecbFull[0]!)}（**重复泄露**）\n· CBC → C1 = ${bin(cbcFull[0]!)}、C3 = ${bin(cbcFull[2]!)}（**不同，pattern 消失**）\n\n关键：ECB 块独立、确定性→相同明文块必得相同密文；CBC 靠**链接(前一块密文参与)**把重复打散，同样的明文块每次异或的都不一样。所以现实里 ECB 基本禁用，要用 CBC/CTR/GCM 这类带链接或计数器的模式（还得配随机 IV）。`,
    })

    const base0: Frame = { step: -1, mode: 'intro', blockIdx: -1, P: [...P], K, IV, ecbC: [], cbcC: [], expr: '', ecbLeak: false, cbcSafe: false, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '加密步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev2) { const b = prev2 ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
