/**
 * 内核：生日攻击 —— 为什么找哈希碰撞只要约 √N 次（安全 · 密码学 · 完整性）
 * 轴：step —— 往 N 个"格子"里逐渐放人，看"至少两人撞格子"的概率怎么涨
 *
 * 生日悖论:一屋子 23 个人,就有过半概率两人同一天生日(N=365 天)。反直觉——
 * 因为要比的是"任意一对",对数是 C(k,2)≈k²/2,所以碰撞概率在 k≈1.18√N 处就过半。
 * 密码学含义:n 位哈希输出空间 N=2^n,找一对碰撞只要约 √N=2^(n/2) 次,而非 2^n。
 * 所以想抗碰撞,哈希位数要翻倍——256 位哈希的碰撞难度只有 2^128(不是 2^256)。
 * 概率全由代码精确算(P=1-∏(N-i)/N),可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type BirthdayState = {
  i: number
  step: number
  N: number            // 输出空间大小（这里用 365 天做直观锚点）
  k: number            // 已放入的人数/样本数
  pairs: number        // 可能撞的对数 C(k,2)
  pColl: number        // 至少一次碰撞的概率 [0,1]
  crossed50: boolean   // 是否已过 50%
  note: string
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<BirthdayState, 'i'>

const N = 365
const KS = [1, 5, 10, 15, 20, 23, 30, 41, 57]
const pct = (p: number) => (p * 100).toFixed(1) + '%'
const collideP = (k: number) => { let p = 1; for (let j = 0; j < k; j++) p *= (N - j) / N; return 1 - p }
const combos = (k: number) => (k * (k - 1)) / 2

export const birthdayKernel: Kernel<BirthdayState> = {
  kind: 'birthday',
  compile(_doc: SimDocument): CompiledModel<BirthdayState> {
    const frames: Frame[] = []
    let everCrossed = false

    frames.push({
      step: 0, N, k: 0, pairs: 0, pColl: 0, crossed50: false, note: '', phase: 'run',
      focus: '生日问题：一屋子多少人，才有过半概率两人同天生日？',
      log: `**生日问题**\n一年 N = ${N} 天。屋里要多少人，才有 **过半概率** 存在两人生日相同？\n直觉常说"要 183 人(一半)"——**错得离谱**。往下逐个加人看概率。`,
    })

    for (const k of KS) {
      const p = collideP(k)
      const crossed = p >= 0.5
      const firstCross = crossed && !everCrossed
      if (crossed) everCrossed = true
      frames.push({
        step: frames.length, N, k, pairs: combos(k), pColl: p, crossed50: crossed,
        note: firstCross ? `就在这里过半！只要 ${k} 人` : k === 41 ? '90% 了' : k === 57 ? '几乎必然(99%)' : '',
        phase: 'run',
        focus: `${k} 人：碰撞概率 ${pct(p)}`,
        log: `**屋里 ${k} 个人**\n能相撞的"对"有 C(${k},2)=${combos(k)} 对，对数按 k² 涨得快。\n至少一对同天生日的概率 P = 1 − ∏(${N}−i)/${N} = **${pct(p)}**${firstCross ? `\n🎯 **过半了**——只要 ${k} 人，远不用 183。这就是"生日悖论"。` : ''}`,
      })
    }

    frames.push({
      step: frames.length, N, k: KS[KS.length - 1]!, pairs: combos(KS[KS.length - 1]!), pColl: collideP(KS[KS.length - 1]!), crossed50: true,
      note: '√N 规律', phase: 'done',
      focus: '结论：碰撞只要约 √N 次 → 哈希位数要翻倍',
      log: `**为什么密码学在乎这个**\n关键规律：在 N 个输出里随机取样，找到**一对碰撞**只要约 **√N ≈ 1.18√${N} ≈ 23** 次，而不是 N 次。因为比的是"任意一对"，对数 C(k,2)≈k²/2 增长快。\n\n映射到哈希：n 位哈希输出空间 N = 2ⁿ，找碰撞只要约 **√N = 2^(n/2)** 次尝试。\n· 64 位 → 碰撞约 2³² 次（几十亿，现代机器分分钟）\n· 128 位 → 碰撞约 2⁶⁴ 次\n· 256 位 → 碰撞约 2¹²⁸ 次（才安全）\n\n所以"抗碰撞"要的位数是"抗原像"的**两倍**。MD5(128位)、SHA-1(160位) 被生日攻击 + 构造技巧攻破，现在用 SHA-256。数字签名、区块链、去重都靠哈希抗碰撞，这条线直接决定选多少位。`,
    })

    const base0: Frame = { step: -1, N, k: 0, pairs: 0, pColl: 0, crossed50: false, note: '', phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '加人步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
