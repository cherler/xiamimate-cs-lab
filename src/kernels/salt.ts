/**
 * 内核：盐与密码哈希（密码学 · 密码安全工程）
 * 轴：step —— 两个用户同一个密码，看不加盐/加盐后存的哈希
 *
 * 密码不能明文存,得存哈希。但**只哈希不加盐**有大漏洞:两个人用同一个密码,存下的哈希就一样——
 * 攻击者拿一张「常见密码→哈希」的**彩虹表**一撞,一批人同时沦陷;而且一眼看出谁和谁密码相同。
 * **加盐**:每个用户配一个随机盐,存 hash(盐+密码)。同一密码因盐不同→哈希不同,彩虹表失效,
 * 必须对每个盐单独暴力,成本被拉爆。真实系统还用 bcrypt/argon2 故意放慢哈希。
 *
 * 本例两个用户都用密码 "123456":不加盐两人哈希相同;加盐后不同。用玩具哈希演示,值可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function h(s: string): number {
  let x = 0x1505
  for (const c of s) x = ((x * 33) ^ c.charCodeAt(0)) & 0xffff
  return x & 0xffff
}

export type SaltState = {
  i: number
  step: number
  pw: string
  saltA: string; saltB: string
  noSaltA: number; noSaltB: number
  saltedA: number; saltedB: number
  stage: string          // 'pw'|'nosalt'|'salted'|'done'
  phase: 'run' | 'done'
  log: string
}

export const SALT_VISIBLE = ['step', 'pw', 'saltA', 'saltB', 'noSaltA', 'noSaltB', 'saltedA', 'saltedB', 'stage', 'phase', 'log'] as const

type Frame = Omit<SaltState, 'i'>
const PW = '123456', SA = 'x7', SB = 'q2'

export const saltKernel: Kernel<SaltState> = {
  kind: 'salt',
  compile(_doc: SimDocument): CompiledModel<SaltState> {
    const noSalt = h(PW)
    const saltedA = h(SA + PW), saltedB = h(SB + PW)
    const frames: Frame[] = []
    const push = (stage: string, o: Partial<Frame>, log: string) => frames.push({
      step: frames.length, pw: PW, saltA: SA, saltB: SB, noSaltA: -1, noSaltB: -1, saltedA: -1, saltedB: -1, stage, phase: 'run', log, ...o,
    })
    push('pw', {}, `两个用户 Alice、Bob **恰好用了同一个密码 "${PW}"**（常见密码，撞车很常见）。`)
    push('nosalt', { noSaltA: noSalt, noSaltB: noSalt }, `**不加盐**：直接存 hash(密码)。两人哈希都是 **${noSalt}**——完全一样!攻击者拿彩虹表一撞，俩人同时沦陷；还一眼看出他俩密码相同。`)
    push('salted', { noSaltA: noSalt, noSaltB: noSalt, saltedA, saltedB }, `**加盐**：每人配随机盐(Alice "${SA}"、Bob "${SB}")，存 hash(盐+密码)。Alice=**${saltedA}**、Bob=**${saltedB}**——不一样了!`)
    frames.push({ step: frames.length, pw: PW, saltA: SA, saltB: SB, noSaltA: noSalt, noSaltB: noSalt, saltedA, saltedB, stage: 'done', phase: 'done',
      log: `**结论**：同一个密码，不加盐→哈希相同(彩虹表可批量破)，加盐→哈希不同(彩虹表失效，必须逐个盐暴力)。盐不用保密，随哈希一起存即可，它的作用是**打散**。真实系统再叠 bcrypt/argon2 故意放慢，让暴力更贵。` })
    const base0: Frame = { step: -1, pw: PW, saltA: SA, saltB: SB, noSaltA: -1, noSaltB: -1, saltedA: -1, saltedB: -1, stage: 'pw', phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
