/**
 * 内核：数字签名（密码学 · 完整性与不可抵赖）
 * 轴：step —— 用私钥签名、用公钥验证；篡改一下就验不过
 *
 * 加密是「公钥加密、私钥解密」;签名反过来——**私钥签名、公钥验证**。
 * 发送方:对消息算哈希 h,再用**私钥**算 s = h^d mod n(签名),连同消息一起发。
 * 接收方:对收到的消息重算哈希 h',再用**公钥**算 s^e mod n,若 == h' 就通过——
 * 证明消息没被改(完整性)、且确实来自私钥持有者(不可抵赖,别人没私钥签不出)。
 *
 * 本例用 RSA 小数(n=33,e=3,d=7):消息哈希 h=4 → 签名 s=4^7 mod 33=16 → 验证 16^3 mod 33=4=h,通过。
 * 若消息被篡改(哈希会变),验证算出的仍是原 h,两者对不上,当场露馅。值全部可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const modpow = (a: number, b: number, n: number) => { let r = 1; a %= n; while (b > 0) { if (b & 1) r = (r * a) % n; a = (a * a) % n; b >>= 1 } return r }

export type SignState = {
  i: number
  step: number
  n: number; e: number; d: number
  hash: number          // 发送方消息哈希
  sig: number           // 签名
  recvHash: number      // 接收方重算的哈希
  verified: number      // 验证算出的 s^e mod n（-1 未算）
  ok: boolean
  tampered: boolean
  stage: string         // 'hash'|'sign'|'send'|'verify'|'done'
  phase: 'run' | 'done'
  log: string
}

export const SIGN_VISIBLE = ['step', 'n', 'e', 'd', 'hash', 'sig', 'recvHash', 'verified', 'ok', 'tampered', 'stage', 'phase', 'log'] as const

type Frame = Omit<SignState, 'i'>
const N = 33, E = 3, D = 7, H = 4
const SIG = modpow(H, D, N)          // 4^7 mod 33 = 16? 见下

export const signKernel: Kernel<SignState> = {
  kind: 'signature',
  compile(_doc: SimDocument): CompiledModel<SignState> {
    const recvHash = H          // 未篡改：接收方重算哈希 = 原哈希
    const verified = modpow(SIG, E, N)
    const ok = verified === recvHash
    const steps: { stage: string; sig: number; recvHash: number; verified: number; ok: boolean; log: string }[] = [
      { stage: 'hash', sig: -1, recvHash: -1, verified: -1, ok: false, log: `发送方对消息算哈希 **h=${H}**(哈希把任意长消息压成定长指纹)。` },
      { stage: 'sign', sig: SIG, recvHash: -1, verified: -1, ok: false, log: `用**私钥**签名：s = h^d mod n = ${H}^${D} mod ${N} = **${SIG}**。把(消息, 签名 ${SIG})一起发出。` },
      { stage: 'verify', sig: SIG, recvHash, verified: -1, ok: false, log: `接收方对收到的消息重算哈希 h' = **${recvHash}**(没被改就还是 ${H})。` },
      { stage: 'check', sig: SIG, recvHash, verified, ok, log: `用**公钥**验证：s^e mod n = ${SIG}^${E} mod ${N} = **${verified}**。和 h'=${recvHash} ${ok ? '相等 → **验证通过**✓' : '不等 → 验证失败!'}` },
    ]
    const frames: Frame[] = steps.map((s, k) => ({ step: k, n: N, e: E, d: D, hash: H, tampered: false, ...s, phase: 'run' }))
    frames.push({
      step: frames.length, n: N, e: E, d: D, hash: H, sig: SIG, recvHash, verified, ok, tampered: false, stage: 'done', phase: 'done',
      log: `**签名验证通过**：s^e mod n = h'，证明消息没被改、且确实出自私钥持有者(别人没私钥签不出这个 s)。若消息被篡改,重算的 h' 会变,而验证算出的仍是原 h,两者对不上——当场露馅。私钥签、公钥验,这就是数字签名。`,
    })
    const base0: Frame = { step: -1, n: N, e: E, d: D, hash: H, sig: -1, recvHash: -1, verified: -1, ok: false, tampered: false, stage: 'hash', phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '签名步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
