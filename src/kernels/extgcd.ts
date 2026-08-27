/**
 * 内核：扩展欧几里得 · 求模逆（密码学 · 数论工具）
 * 轴：step —— 迭代求 e 关于模 m 的逆元 d，使 e·d ≡ 1 (mod m)
 *
 * RSA 生成私钥那一步(求 d 使 e·d≡1 mod φ)、以及一切「除以某个数」在模运算里的实现,都要模逆。
 * 求法是扩展欧几里得:一边跑辗转相除求 gcd,一边**回带系数**。gcd=1 才有逆(e 与 m 互质)。
 * 迭代版每步记 (商 q、余数、系数 t),最后那个 t 取模 m 就是逆元。
 *
 * 本例 e=3、m=20:3 的逆是 **7**(因为 3×7=21≡1 mod 20)。每步的 q/r/t 都可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type ExtGcdState = {
  i: number
  step: number
  e: number; m: number
  q: number; r: number; newr: number; t: number; newt: number
  result: number         // 逆元（-1 = 未求出）
  phase: 'run' | 'done'
  log: string
}

export const EXTGCD_VISIBLE = ['step', 'e', 'm', 'q', 'r', 'newr', 't', 'newt', 'result', 'phase', 'log'] as const

type Frame = Omit<ExtGcdState, 'i'>
const E = 3, M = 20

export const extgcdKernel: Kernel<ExtGcdState> = {
  kind: 'extgcd',
  compile(_doc: SimDocument): CompiledModel<ExtGcdState> {
    const frames: Frame[] = []
    let t = 0, newt = 1, r = M, newr = E
    while (newr !== 0) {
      const q = Math.floor(r / newr)
      const rNext = r - q * newr
      const tNext = t - q * newt
      frames.push({
        step: frames.length, e: E, m: M, q, r, newr, t, newt, result: -1, phase: 'run',
        log: `商 q = ⌊${r}/${newr}⌋ = ${q}。更新余数 ${r}−${q}×${newr} = ${rNext}；更新系数 ${t}−${q}×${newt} = ${tNext}。`,
      });
      [t, newt] = [newt, tNext];
      [r, newr] = [newr, rNext]
    }
    const inv = r === 1 ? ((t % M) + M) % M : -1
    frames.push({
      step: frames.length, e: E, m: M, q: -1, r, newr, t, newt, result: inv, phase: 'done',
      log: inv >= 0
        ? `**辗转相除结束**：gcd(${E},${M})=1(互质,可逆)。系数 t=${t} 取模 ${M} → 逆元 **d=${inv}**。验证：${E}×${inv}=${E * inv}≡1 (mod ${M})。这就是 RSA 求私钥 d 的那一步。`
        : `gcd(${E},${M})=${r}≠1，${E} 在模 ${M} 下无逆元。`,
    })
    const base0: Frame = { step: -1, e: E, m: M, q: -1, r: M, newr: E, t: 0, newt: 1, result: -1, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '迭代' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
