/**
 * 内核：一次一密的密钥重用攻击（密码学 · 为什么 OTP 密钥不能重复用）
 * 轴：step —— 两条消息用了同一个密钥，把两段密文异或，密钥就消失了
 *
 * 一次一密(OTP)理论上不可破——前提是密钥**真随机、和明文等长、只用一次**。一旦**同一个密钥加密两条消息**,
 * 就全垮:c1 = m1⊕k、c2 = m2⊕k,那么 c1⊕c2 = m1⊕m2⊕k⊕k = **m1⊕m2**——密钥被异或抵消了!
 * 攻击者不需要密钥,只要拿到两段密文异或,就得到两条明文的异或关系,再结合语言规律就能还原。
 * 这就是「密钥只能用一次」的铁律来历,也是 WEP、某些 RC4 用法被打穿的原因。
 *
 * 本例两条 8 位消息用同一密钥:逐位异或两段密文,得到的正是 m1⊕m2(密钥没了)。值可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type OTPReuseState = {
  i: number
  step: number
  m1: number[]; m2: number[]; k: number[]
  c1: number[]; c2: number[]
  pos: number
  xorbit: number         // c1[pos]^c2[pos]
  m1xm2: number[]        // 已揭示的 m1^m2
  phase: 'run' | 'done'
  log: string
}

export const OTPREUSE_VISIBLE = ['step', 'm1', 'm2', 'k', 'c1', 'c2', 'pos', 'xorbit', 'm1xm2', 'phase', 'log'] as const

type Frame = Omit<OTPReuseState, 'i'>
const M1 = [0, 1, 0, 0, 1, 0, 0, 0]
const M2 = [0, 1, 0, 0, 1, 0, 1, 1]
const K = [1, 0, 1, 1, 0, 0, 1, 0]

export const otpreuseKernel: Kernel<OTPReuseState> = {
  kind: 'otpreuse',
  compile(_doc: SimDocument): CompiledModel<OTPReuseState> {
    const c1 = M1.map((b, i) => b ^ K[i]!)
    const c2 = M2.map((b, i) => b ^ K[i]!)
    const frames: Frame[] = []
    const m1xm2: number[] = []
    for (let p = 0; p < 8; p++) {
      const xorbit = c1[p]! ^ c2[p]!
      m1xm2.push(xorbit)
      frames.push({
        step: frames.length, m1: M1, m2: M2, k: K, c1, c2, pos: p, xorbit, m1xm2: [...m1xm2], phase: 'run',
        log: `第 ${p + 1} 位：c1=${c1[p]} XOR c2=${c2[p]} = **${xorbit}**。而这等于 m1(${M1[p]}) XOR m2(${M2[p]}) = ${M1[p]! ^ M2[p]!}——密钥 k(${K[p]}) 被抵消了!`,
      })
    }
    frames.push({
      step: frames.length, m1: M1, m2: M2, k: K, c1, c2, pos: -1, xorbit: -1, m1xm2: [...m1xm2], phase: 'done',
      log: `**攻破**：把两段密文异或得到 ${m1xm2.join('')} = m1⊕m2,**密钥完全消失**。攻击者不需要密钥,就拿到了两条明文的异或关系;若知道其中一条,另一条直接还原。这就是「一次一密的密钥绝不能重复用」的铁律——重复用一次,安全性就从"不可破"跌到"送人头"。`,
    })
    const base0: Frame = { step: -1, m1: M1, m2: M2, k: K, c1, c2, pos: -1, xorbit: -1, m1xm2: [], phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '位' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
