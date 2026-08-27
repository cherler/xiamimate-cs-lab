/**
 * 内核：哈希雪崩效应（密码学 · 哈希函数的关键性质）
 * 轴：step —— 明文改一个字母，逐位比较两个哈希，数有多少位翻转
 *
 * 密码学哈希(SHA-256 等)要有**雪崩效应**:输入哪怕只改 1 位,输出也要有约**一半**的位翻转,
 * 而且改法不可预测。这样才谈得上「防篡改」——改一点点,指纹就面目全非,伪造不出碰撞。
 * 反例:如果输入小改、输出也小改,攻击者就能一点点凑出想要的哈希。
 *
 * 本例用一个 16 位玩具哈希,对比 "cat" 和 "cot"(只差中间一个字母)的哈希,逐位数翻转数。
 * 玩具哈希达不到密码学强度,但雪崩这个性质看得见:一个字母之差 → 一大片位翻转。值全部可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

//  16 位玩具哈希(FNV 变体 + 末尾混淆),够演示雪崩
function h16(s: string): number {
  let h = 0x811c
  for (const c of s) h = ((h ^ c.charCodeAt(0)) * 0x0101) & 0xffff
  h ^= h >> 7; h = (h * 0x2993) & 0xffff; h ^= h >> 9; h = (h * 0x0cd5) & 0xffff; h ^= h >> 8
  return h & 0xffff
}
const bits = (n: number) => Array.from({ length: 16 }, (_, i) => (n >> (15 - i)) & 1)

export type HashAvalState = {
  i: number
  step: number
  a: string; b: string
  hashA: number; hashB: number
  bitsA: number[]; bitsB: number[]
  pos: number; flipped: number
  phase: 'run' | 'done'
  log: string
}

export const HASHAVAL_VISIBLE = ['step', 'a', 'b', 'hashA', 'hashB', 'bitsA', 'bitsB', 'pos', 'flipped', 'phase', 'log'] as const

type Frame = Omit<HashAvalState, 'i'>
const A = 'cat', B = 'cot'

export const hashavalKernel: Kernel<HashAvalState> = {
  kind: 'hashaval',
  compile(_doc: SimDocument): CompiledModel<HashAvalState> {
    const hashA = h16(A), hashB = h16(B)
    const bA = bits(hashA), bB = bits(hashB)
    const frames: Frame[] = []
    let flipped = 0
    for (let p = 0; p < 16; p++) {
      const diff = bA[p] !== bB[p]
      if (diff) flipped++
      frames.push({
        step: frames.length, a: A, b: B, hashA, hashB, bitsA: bA, bitsB: bB, pos: p, flipped, phase: 'run',
        log: `第 ${p + 1} 位：${bA[p]} vs ${bB[p]} → ${diff ? '**翻转**' : '相同'}。累计翻转 ${flipped} 位。`,
      })
    }
    frames.push({
      step: frames.length, a: A, b: B, hashA, hashB, bitsA: bA, bitsB: bB, pos: -1, flipped, phase: 'done',
      log: `**比较完成**：只把 "cat" 改成 "cot"(一个字母),16 位哈希里就翻转了 **${flipped}** 位(≈一半)。输入微小变化→输出面目全非,这就是**雪崩效应**,防篡改的根基。真实的 SHA-256 是 256 位、雪崩更彻底、且不可预测。`,
    })
    const base0: Frame = { step: -1, a: A, b: B, hashA, hashB, bitsA: bA, bitsB: bB, pos: -1, flipped: 0, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '位' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const bb = prev ?? this.initial(); const idx = bb.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
