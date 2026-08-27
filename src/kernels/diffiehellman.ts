/**
 * 内核：Diffie-Hellman 密钥交换（密码学 · 公钥）
 * 轴：step —— 两个人在公开信道上，各算各的，最后算出同一个共享密钥
 *
 * 怎么在**所有人都能偷听**的信道上，商量出一个只有你俩知道的密钥？DH 的答案:
 * 公开约定大素数 p 和底数 g;Alice 私选 a、公布 A=g^a mod p;Bob 私选 b、公布 B=g^b mod p;
 * 各自算 共享 = 对方公钥^自己私钥 mod p —— Alice 算 B^a、Bob 算 A^b,都等于 **g^(ab) mod p**,一致!
 * 偷听者只看到 p、g、A、B,想反推 a 要解**离散对数**(g^a=A 求 a),大数下算不动——这就是它的安全根基。
 *
 * 本例 p=23,g=5,a=6,b=15:A=8,B=19,共享密钥=2。值全部可核(快速模幂)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const modpow = (a: number, b: number, n: number) => { let r = 1; a %= n; while (b > 0) { if (b & 1) r = (r * a) % n; a = (a * a) % n; b >>= 1 } return r }

export type DHState = {
  i: number
  step: number
  p: number; g: number; a: number; b: number
  A: number; B: number
  aliceShared: number; bobShared: number
  stage: string          // 'setup'|'pubA'|'pubB'|'sharedA'|'sharedB'|'done'
  phase: 'run' | 'done'
  log: string
}

export const DH_VISIBLE = ['step', 'p', 'g', 'a', 'b', 'A', 'B', 'aliceShared', 'bobShared', 'stage', 'phase', 'log'] as const

type Frame = Omit<DHState, 'i'>
const P = 23, G = 5, a = 6, b = 15

export const dhKernel: Kernel<DHState> = {
  kind: 'diffiehellman',
  compile(_doc: SimDocument): CompiledModel<DHState> {
    const A = modpow(G, a, P), B = modpow(G, b, P)
    const aliceShared = modpow(B, a, P), bobShared = modpow(A, b, P)
    const steps: { stage: string; A: number; B: number; aliceShared: number; bobShared: number; log: string }[] = [
      { stage: 'setup', A: -1, B: -1, aliceShared: -1, bobShared: -1, log: `**公开约定**：大素数 p=${P}、底数 g=${G}(全世界都能看见)。Alice 私选 a=${a}、Bob 私选 b=${b}(**只有自己知道**)。` },
      { stage: 'pubA', A, B: -1, aliceShared: -1, bobShared: -1, log: `Alice 算并公布公钥 **A = g^a mod p = ${G}^${a} mod ${P} = ${A}**。` },
      { stage: 'pubB', A, B, aliceShared: -1, bobShared: -1, log: `Bob 算并公布公钥 **B = g^b mod p = ${G}^${b} mod ${P} = ${B}**。` },
      { stage: 'sharedA', A, B, aliceShared, bobShared: -1, log: `Alice 用 Bob 的公钥算共享：**B^a mod p = ${B}^${a} mod ${P} = ${aliceShared}**。` },
      { stage: 'sharedB', A, B, aliceShared, bobShared, log: `Bob 用 Alice 的公钥算共享：**A^b mod p = ${A}^${b} mod ${P} = ${bobShared}**。两边一样!` },
    ]
    const frames: Frame[] = steps.map((s, k) => ({ step: k, p: P, g: G, a, b, ...s, phase: 'run' }))
    frames.push({
      step: frames.length, p: P, g: G, a, b, A, B, aliceShared, bobShared, stage: 'done', phase: 'done',
      log: `**密钥协商完成**：双方都得到共享密钥 **${aliceShared}** = g^(ab) mod p,全程没在信道上传过它。偷听者只见 p、g、A、B,想反推私钥要解离散对数——大数下算不动。这就是无需事先见面就能建密钥的魔法。`,
    })
    const base0: Frame = { step: -1, p: P, g: G, a, b, A: -1, B: -1, aliceShared: -1, bobShared: -1, stage: 'setup', phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '协商步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const bb = prev ?? this.initial(); const idx = bb.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
