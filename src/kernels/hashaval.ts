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
const A = 'cat'
//  与 "cat" 各差一点点的输入(改一个字母/加一个字母),扫过去看输出翻转都≈一半
const VARIANTS = ['cot', 'hat', 'can', 'mat', 'cut']

export const hashavalKernel: Kernel<HashAvalState> = {
  kind: 'hashaval',
  compile(_doc: SimDocument): CompiledModel<HashAvalState> {
    //  雪崩不是"一步步算"的仿真——它是个性质:输入改一点、输出翻一半。真正在**变**的是输入。
    //  轴换成"把 cat 换成一串差一点点的输入(cot/bat/car…)":按播放看每次翻转位数都≈8/16(一半)、
    //  翻哪些位不可预测——这才是雪崩。原来那 16 帧只是把 cat↔cot 的固定结果逐位读出,不是"在变"。
    const hashA = h16(A)
    const bA = bits(hashA)
    const at = (b: string, isBase = false): Frame => {
      const hashB = h16(b)
      const bB = bits(hashB)
      const flipped = bA.reduce((n, x, p) => n + (x !== bB[p] ? 1 : 0), 0)
      return {
        step: 0, a: A, b, hashA, hashB, bitsA: bA, bitsB: bB, pos: -1, flipped, phase: 'done',
        log: isBase
          ? `基准："${A}" 和自己比 → 0 位翻转。按 ▶ 把它换成差一点点的输入(cot / bat / car…)，看输出翻转都≈一半、翻哪些位不可预测——这就是雪崩，防篡改的根基。`
          : `"${A}" → "${b}"（改一点点）：16 位哈希翻转 **${flipped}** 位（${Math.round(flipped / 16 * 100)}%，≈一半），翻哪些位不可预测。输入微小变化 → 输出面目全非，这就是**雪崩效应**——攻击者没法一点点凑出想要的哈希。真实 SHA-256 是 256 位、雪崩更彻底。`,
      }
    }
    const frames: Frame[] = VARIANTS.map(v => at(v))
    return {
      axis: { kind: 'step', label: '改动的输入' },
      initial: () => ({ ...at(A, true), i: -1 }),
      describe: s => s.log,
      step(prev) { const bb = prev ?? this.initial(); const idx = bb.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
