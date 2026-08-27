/**
 * 内核：维吉尼亚密码（密码学 · 多表替换）
 * 轴：step —— 明文逐字母，按**关键词循环**给出的位移加密
 *
 * 凯撒的升级:不再用一个固定位移,而是用一个**关键词**,关键词的每个字母给出一个位移,
 * 循环套在明文上。于是同一个明文字母在不同位置会加密成不同字母——**频率分析失效**了,
 * 几百年没被破,人称「不可破译的密码」。直到卡西斯基发现:关键词周期性重复,
 * 找出周期就能把它拆成几个凯撒分别破。它是「一次一密」思想的前身。
 *
 * 值全部可核:每个位置 (明文码 + 关键词码) mod 26,照着算得出来。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type VigenereState = {
  i: number
  step: number
  plain: string
  keyword: string
  pos: number
  ch: string; chCode: number
  keyCh: string; keyCode: number
  shifted: number; out: string
  cipher: string
  phase: 'run' | 'done'
  log: string
}

export const VIGENERE_VISIBLE = ['step', 'plain', 'keyword', 'pos', 'ch', 'chCode', 'keyCh', 'keyCode', 'shifted', 'out', 'cipher', 'phase', 'log'] as const

type Frame = Omit<VigenereState, 'i'>
const PLAIN = 'HELLO'
const KEYWORD = 'KEY'

export const vigenereKernel: Kernel<VigenereState> = {
  kind: 'vigenere',
  compile(_doc: SimDocument): CompiledModel<VigenereState> {
    const frames: Frame[] = []
    let cipher = ''
    for (let p = 0; p < PLAIN.length; p++) {
      const ch = PLAIN[p]!, chCode = ch.charCodeAt(0) - 65
      const keyCh = KEYWORD[p % KEYWORD.length]!, keyCode = keyCh.charCodeAt(0) - 65
      const shifted = (chCode + keyCode) % 26
      const out = String.fromCharCode(shifted + 65)
      cipher += out
      frames.push({
        step: frames.length, plain: PLAIN, keyword: KEYWORD, pos: p, ch, chCode, keyCh, keyCode, shifted, out, cipher, phase: 'run',
        log: `位置 ${p + 1}：明文 **${ch}**(${chCode}) + 关键词 **${keyCh}**(${keyCode}) = ${chCode + keyCode} → mod 26 = ${shifted} → **${out}**。`,
      })
    }
    const lf = frames[frames.length - 1]!
    frames.push({
      ...lf, pos: -1, ch: '', chCode: -1, keyCh: '', keyCode: -1, shifted: -1, out: '', phase: 'done',
      log: `**加密完成**：${PLAIN} → **${cipher}**(关键词 ${KEYWORD} 循环)。同一个明文字母(两个 L)加密成了不同字母(J、V)——频率分析因此失效。弱点在关键词**周期重复**:找出周期就能拆成几个凯撒分别破。`,
    })
    const base0: Frame = { step: -1, plain: PLAIN, keyword: KEYWORD, pos: -1, ch: '', chCode: -1, keyCh: '', keyCode: -1, shifted: -1, out: '', cipher: '', phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '字母' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
