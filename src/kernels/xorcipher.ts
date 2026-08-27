/**
 * 内核：异或加密 / 流密码骨架（密码学 · 对称加密）
 * 轴：step —— 明文逐字节和密钥流逐位异或
 *
 * 计算机里最基础的加密原语:密文 = 明文 XOR 密钥。异或的妙处是**自反**:再异或一次同一个密钥就还原
 * (c XOR k = m,c XOR k XOR k = m)——加密解密同一套代码。流密码(RC4、ChaCha20)、一次一密(OTP)全靠它。
 * 安全性**完全取决于密钥**:密钥真随机、和明文一样长、只用一次(OTP),就是理论上不可破;
 * 一旦密钥重复或有规律,异或就漏底(两段密文异或就把密钥消掉了)。
 *
 * 值全部可核:每一位 m XOR k = c,真值表一查便知。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type XorState = {
  i: number
  step: number
  msg: string
  pos: number
  mBit: number; kBit: number; cBit: number
  mBits: number[]; kBits: number[]; cBits: number[]
  phase: 'run' | 'done'
  log: string
}

export const XOR_VISIBLE = ['step', 'msg', 'pos', 'mBit', 'kBit', 'cBit', 'mBits', 'kBits', 'cBits', 'phase', 'log'] as const

type Frame = Omit<XorState, 'i'>
//  明文字节 'A' = 0100 0001,密钥 0110 1010 —— 取 8 位演示
const M = [0, 1, 0, 0, 0, 0, 0, 1]
const K = [0, 1, 1, 0, 1, 0, 1, 0]

export const xorKernel: Kernel<XorState> = {
  kind: 'xor',
  compile(_doc: SimDocument): CompiledModel<XorState> {
    const frames: Frame[] = []
    const cBits: number[] = []
    for (let p = 0; p < M.length; p++) {
      const mBit = M[p]!, kBit = K[p]!, cBit = mBit ^ kBit
      cBits.push(cBit)
      frames.push({
        step: frames.length, msg: 'A', pos: p, mBit, kBit, cBit,
        mBits: M, kBits: K, cBits: [...cBits], phase: 'run',
        log: `第 ${p + 1} 位：明文 **${mBit}** XOR 密钥 **${kBit}** = **${cBit}**。(相同得 0、不同得 1)`,
      })
    }
    const lf = frames[frames.length - 1]!
    frames.push({
      ...lf, pos: -1, mBit: -1, kBit: -1, cBit: -1, cBits: [...cBits], phase: 'done',
      log: `**加密完成**：明文 ${M.join('')} XOR 密钥 ${K.join('')} = 密文 ${cBits.join('')}。异或**自反**:密文再 XOR 同一密钥就还原成明文——加解密同一套。安全全押在密钥上:真随机+等长+只用一次(OTP)=不可破;密钥重复就漏底。`,
    })
    const base0: Frame = { step: -1, msg: 'A', pos: -1, mBit: -1, kBit: -1, cBit: -1, mBits: M, kBits: K, cBits: [], phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '位' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
