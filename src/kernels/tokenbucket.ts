/**
 * 内核：令牌桶限流（后端 · 分布式服务）
 * 轴：step —— 每个时刻先按速率补令牌，再处理这一刻的请求
 *
 * 后端网关最常用的限流算法。一个桶,容量 C;每个时间单位匀速放 r 个令牌进去(满了就溢出丢弃);
 * 每个请求要拿走 1 个令牌才放行,拿不到就拒绝(限流/排队)。妙处是**既能限住平均速率(=r),
 * 又允许短时突发**(桶里攒着的令牌能一次性放出去)——这正是真实流量的样子。
 * 对比漏桶(恒定速率、不允许突发),令牌桶更适合「平时限速、偶尔放突发」的接口。
 *
 * 本例 容量 5、速率 1/tick,到达 [3,4,2,1,5]:开局突发 3 个全放行,之后被限到约每 tick 1 个。值可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type TokenBucketState = {
  i: number
  step: number
  cap: number; rate: number
  tick: number
  tokens: number
  arrived: number; allowed: number; rejected: number
  totalAllowed: number; totalRejected: number
  phase: 'run' | 'done'
  log: string
}

export const TOKENBUCKET_VISIBLE = ['step', 'cap', 'rate', 'tick', 'tokens', 'arrived', 'allowed', 'rejected', 'totalAllowed', 'totalRejected', 'phase', 'log'] as const

type Frame = Omit<TokenBucketState, 'i'>
const CAP = 5, RATE = 1
const ARRIVALS = [3, 4, 2, 1, 5]

export const tokenbucketKernel: Kernel<TokenBucketState> = {
  kind: 'tokenbucket',
  compile(_doc: SimDocument): CompiledModel<TokenBucketState> {
    const frames: Frame[] = []
    let tokens = CAP, totalAllowed = 0, totalRejected = 0
    for (let t = 0; t < ARRIVALS.length; t++) {
      const before = tokens
      tokens = Math.min(CAP, tokens + RATE)   // 补令牌（满了溢出）
      const refilled = tokens - before
      const arrived = ARRIVALS[t]!
      const allowed = Math.min(arrived, tokens)
      const rejected = arrived - allowed
      tokens -= allowed
      totalAllowed += allowed; totalRejected += rejected
      frames.push({
        step: frames.length, cap: CAP, rate: RATE, tick: t, tokens, arrived, allowed, rejected, totalAllowed, totalRejected, phase: 'run',
        log: `t=${t}：先补 ${refilled} 个令牌(桶 ${before}→${before + refilled}${before + RATE > CAP ? '，满了溢出' : ''})。来了 ${arrived} 个请求 → 放行 **${allowed}**、拒绝 **${rejected}**，桶剩 ${tokens}。`,
      })
    }
    frames.push({
      step: frames.length, cap: CAP, rate: RATE, tick: -1, tokens, arrived: 0, allowed: 0, rejected: 0, totalAllowed, totalRejected, phase: 'done',
      log: `**限流结束**：共放行 ${totalAllowed}、拒绝 ${totalRejected}。开局桶是满的 → 突发 3 个一次放行(容量给的突发额度);之后桶被抽干、只能按补令牌的速率(${RATE}/tick)放行——既限住平均速率、又容忍短时突发,这就是令牌桶。`,
    })
    const base0: Frame = { step: -1, cap: CAP, rate: RATE, tick: -1, tokens: CAP, arrived: 0, allowed: 0, rejected: 0, totalAllowed: 0, totalRejected: 0, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '时刻' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
