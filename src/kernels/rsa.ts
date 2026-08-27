/**
 * 内核：RSA 公钥加密（密码学 · 非对称加密的代表）
 * 轴：step —— 生成密钥 → 用公钥加密 → 用私钥解密
 *
 * 第一个实用的公钥体制:公钥加密、私钥解密,加密的人不需要知道解密的钥。基于「大数分解难」:
 *   选两个素数 p、q → n=pq(公开)、φ=(p-1)(q-1)(保密);
 *   选 e 与 φ 互质(公钥 (e,n));求 d 使 e·d ≡ 1 (mod φ)(私钥 (d,n));
 *   加密 c = m^e mod n;解密 m = c^d mod n。
 * 公开的 n 谁都看得见,但想从 n 反推 p、q(进而算出 d)= 大数分解,几百位就算不动了。
 *
 * 本例 p=3,q=11 → n=33,φ=20,e=3,d=7。明文 m=4 → 密文 31 → 解回 4。值全部可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const modpow = (a: number, b: number, n: number) => { let r = 1; a %= n; while (b > 0) { if (b & 1) r = (r * a) % n; a = (a * a) % n; b >>= 1 } return r }

export type RSAState = {
  i: number
  step: number
  p: number; q: number; n: number; phi: number; e: number; d: number
  m: number; c: number; dec: number
  stage: string          // 'keygen'|'pub'|'priv'|'encrypt'|'decrypt'|'done'
  phase: 'run' | 'done'
  log: string
}

export const RSA_VISIBLE = ['step', 'p', 'q', 'n', 'phi', 'e', 'd', 'm', 'c', 'dec', 'stage', 'phase', 'log'] as const

type Frame = Omit<RSAState, 'i'>
const P = 3, Q = 11, E = 3, M = 4
const N = P * Q, PHI = (P - 1) * (Q - 1)
const D = (() => { for (let d = 1; d < PHI; d++) if ((E * d) % PHI === 1) return d; return 1 })()  // = 7
const C = modpow(M, E, N)
const DEC = modpow(C, D, N)

export const rsaKernel: Kernel<RSAState> = {
  kind: 'rsa',
  compile(_doc: SimDocument): CompiledModel<RSAState> {
    const steps: { stage: string; c: number; dec: number; log: string }[] = [
      { stage: 'keygen', c: -1, dec: -1, log: `选两个素数 **p=${P}、q=${Q}** → 模数 **n=p·q=${N}**(公开)、**φ=(p-1)(q-1)=${PHI}**(保密)。` },
      { stage: 'pub', c: -1, dec: -1, log: `选公钥指数 **e=${E}**(与 φ=${PHI} 互质)。**公钥 = (e=${E}, n=${N})**,发给全世界。` },
      { stage: 'priv', c: -1, dec: -1, log: `求私钥 **d**,使 e·d ≡ 1 (mod φ)：${E}·d ≡ 1 (mod ${PHI}) → **d=${D}**(因为 ${E}×${D}=${E * D}≡1)。**私钥 = (d=${D}, n=${N})**,自己藏好。` },
      { stage: 'encrypt', c: C, dec: -1, log: `别人用公钥加密明文 m=${M}：**c = m^e mod n = ${M}^${E} mod ${N} = ${C}**。` },
      { stage: 'decrypt', c: C, dec: DEC, log: `你用私钥解密：**m = c^d mod n = ${C}^${D} mod ${N} = ${DEC}** —— 正好还原成 ${M}!` },
    ]
    const frames: Frame[] = steps.map((s, k) => ({ step: k, p: P, q: Q, n: N, phi: PHI, e: E, d: D, m: M, ...s, phase: 'run' }))
    frames.push({
      step: frames.length, p: P, q: Q, n: N, phi: PHI, e: E, d: D, m: M, c: C, dec: DEC, stage: 'done', phase: 'done',
      log: `**RSA 全流程完成**：公钥加密(${M}→${C})、私钥解密(${C}→${DEC})。公开的 n=${N} 谁都看得见,但想从 n 反推 p、q 才能算出 d——这是**大数分解**,几百位就算不动。加密的人不需要知道私钥,这就是「公钥」的意义。`,
    })
    const base0: Frame = { step: -1, p: P, q: Q, n: N, phi: PHI, e: E, d: D, m: M, c: -1, dec: -1, stage: 'keygen', phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: 'RSA 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
