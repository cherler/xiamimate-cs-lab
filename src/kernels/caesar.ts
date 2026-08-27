/**
 * 内核：凯撒密码 / 移位密码（密码学 · 古典密码入门）
 * 轴：step —— 明文逐字母按固定位移加密，看字母怎么在字母表上转圈
 *
 * 最古老的替换密码:把每个字母在字母表上**向后移 k 位**(超过 Z 就绕回 A)。k=3 时 A→D、X→A。
 * 解密就是反着移 k 位。它的致命弱点:密钥只有 26 种,暴力试一遍就破;而且不改变字母频率,
 * 频率分析(E 最多)一眼看穿。但「移位 + 取模绕回」这个骨架,是后面维吉尼亚、乃至一切对称加密的起点。
 *
 * 值全部可核:每个字母的原码(A=0..Z=25)、加 k、mod 26、新字母,一步步照着推得出来。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type CaesarState = {
  i: number
  step: number
  plain: string
  key: number
  pos: number            // 当前处理到第几个字母（-1 = 未开始/结束）
  ch: string             // 当前明文字母
  code: number           // 原码 0..25
  shifted: number        // (code + k) mod 26
  out: string            // 密文字母
  cipher: string         // 到目前为止的密文
  phase: 'run' | 'done'
  log: string
}

export const CAESAR_VISIBLE = [
  'step', 'plain', 'key', 'pos', 'ch', 'code', 'shifted', 'out', 'cipher', 'phase', 'log',
] as const

type Frame = Omit<CaesarState, 'i'>

const PLAIN = 'HELLO'
const KEY = 3

export const caesarKernel: Kernel<CaesarState> = {
  kind: 'caesar',

  compile(_doc: SimDocument): CompiledModel<CaesarState> {
    const frames: Frame[] = []
    let cipher = ''
    for (let p = 0; p < PLAIN.length; p++) {
      const ch = PLAIN[p]!
      const code = ch.charCodeAt(0) - 65
      const shifted = (code + KEY) % 26
      const out = String.fromCharCode(shifted + 65)
      cipher += out
      frames.push({
        step: frames.length, plain: PLAIN, key: KEY, pos: p, ch, code, shifted, out, cipher, phase: 'run',
        log: `第 ${p + 1} 个字母 **${ch}**(=${code})：向后移 ${KEY} 位 → (${code}+${KEY}) mod 26 = ${shifted} → **${out}**。${shifted < code ? '(越过 Z 绕回了 A)' : ''}`,
      })
    }
    const lf = frames[frames.length - 1]!
    frames.push({
      ...lf, pos: -1, ch: '', code: -1, shifted: -1, out: '', phase: 'done',
      log: `**加密完成**：${PLAIN} → **${cipher}**(每个字母都后移 ${KEY} 位)。解密就是反着移 ${KEY} 位。凯撒密码只有 26 种密钥、又不改字母频率,暴力+频率分析都能破——但「移位 mod 26」这个骨架是后面所有对称密码的起点。`,
    })
    const base0: Frame = { step: -1, plain: PLAIN, key: KEY, pos: -1, ch: '', code: -1, shifted: -1, out: '', cipher: '', phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '字母' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 }
      },
    }
  },
}
