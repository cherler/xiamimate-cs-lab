/**
 * 内核：熔断器状态机 Circuit Breaker —— 下游故障时快速失败，给它恢复的机会（后端 · 分布式系统）
 * 轴：step —— 一串请求成败驱动三态流转：Closed → Open → Half-Open → Closed
 *
 * 微服务里下游依赖挂了，如果还一直打它、每个请求都卡到超时，会把上游线程/连接耗光→级联雪崩。
 * 熔断器像家里的保险丝，三个状态：
 *   · Closed(闭合/正常)：请求正常放行，失败累计;失败数≥阈值 → 跳到 Open。
 *   · Open(断开/熔断)：直接**快速失败**，根本不打下游(给它喘息);等一个超时 → 进 Half-Open。
 *   · Half-Open(半开/试探)：放几个探测请求进去，成功 → 回 Closed(恢复);失败 → 退回 Open。
 * 本例阈值=3：连续 3 次失败触发熔断，超时后半开试探，探测成功则恢复。
 * 值:失败计数、状态转移由规则确定性推进,可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type CState = 'closed' | 'open' | 'halfopen'
export type BreakerState = {
  i: number
  step: number
  op: 'intro' | 'pass' | 'fail' | 'trip' | 'reject' | 'timeout' | 'probe' | 'recover'
  cstate: CState
  fails: number          // 当前失败计数
  threshold: number
  outcome: string        // 本步请求结果描述
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<BreakerState, 'i'>

const TH = 3

export const circuitbreakerKernel: Kernel<BreakerState> = {
  kind: 'circuitbreaker',
  compile(_doc: SimDocument): CompiledModel<BreakerState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'threshold'>) => frames.push({ step: frames.length, threshold: TH, ...f })

    push({ op: 'intro', cstate: 'closed', fails: 0, outcome: '', phase: 'run', focus: '熔断器像保险丝：下游挂了就快速失败，别陪葬',
      log: `**熔断器：防级联雪崩**\n下游依赖故障时，如果还一直打它、每个请求都卡到超时，会耗光上游线程 → 雪崩。\n三个状态：\n· **Closed**（正常）：放行，累计失败；失败数 ≥ 阈值(${TH}) → 跳 Open\n· **Open**（熔断）：直接快速失败，不打下游；超时后 → Half-Open\n· **Half-Open**（试探）：放几个探测请求，成功→回 Closed，失败→退回 Open` })

    push({ op: 'pass', cstate: 'closed', fails: 0, outcome: '成功', phase: 'run', focus: 'Closed：请求成功 → 正常放行',
      log: `**请求 #1（Closed）**\n正常放行下游，返回**成功**。失败计数 = 0。` })

    push({ op: 'fail', cstate: 'closed', fails: 1, outcome: '失败', phase: 'run', focus: 'Closed：请求失败 → 失败计数 +1',
      log: `**请求 #2（Closed）**\n下游开始出错，返回**失败**。失败计数 = **1**（还没到阈值 ${TH}，继续放行）。` })

    push({ op: 'fail', cstate: 'closed', fails: 2, outcome: '失败', phase: 'run', focus: 'Closed：又一次失败 → 计数 2',
      log: `**请求 #3（Closed）**\n又**失败**。失败计数 = **2**。逼近阈值。` })

    push({ op: 'trip', cstate: 'open', fails: 3, outcome: '失败→熔断', phase: 'run', focus: '失败数达阈值 → 跳闸到 Open（熔断！）',
      log: `**请求 #4（Closed）→ 熔断**\n第 3 次**失败**，失败计数 = **3 ≥ 阈值 ${TH}** → **跳闸！状态转到 Open**。\n从此刻起，不再打下游了。` })

    push({ op: 'reject', cstate: 'open', fails: 3, outcome: '快速失败(未打下游)', phase: 'run', focus: 'Open：请求直接快速失败，不打下游',
      log: `**请求 #5（Open）**\n熔断中——请求**立即返回失败(fail-fast)**，根本不去调用下游。\n这就是熔断的意义：给下游喘息、不让上游线程都卡在超时上。` })

    push({ op: 'timeout', cstate: 'halfopen', fails: 3, outcome: '超时到，试探', phase: 'run', focus: 'Open 超时到 → 进 Half-Open（放探测请求）',
      log: `**熔断超时到**\nOpen 状态维持一个冷却期，时间一到 → 转 **Half-Open**。\n此时放**少量探测请求**进去，看下游恢复没有。` })

    push({ op: 'probe', cstate: 'halfopen', fails: 3, outcome: '探测请求→成功', phase: 'run', focus: 'Half-Open：探测请求成功',
      log: `**探测请求（Half-Open）**\n放一个真实请求试探下游 → 返回**成功**！说明下游恢复了。` })

    push({ op: 'recover', cstate: 'closed', fails: 0, outcome: '恢复正常', phase: 'done', focus: '探测成功 → 回 Closed，计数清零，恢复',
      log: `**恢复（→ Closed）**\n探测成功 → 状态转回 **Closed**，失败计数**清零**，一切恢复正常。\n\n（要是探测**失败**，就退回 Open、再等一个超时——避免下游还没好就被打垮。）\n\n**要点**：熔断器用一个三态机把"故障隔离 + 自动探测恢复"做成自动的。Closed 累计失败、Open 快速失败保护下游、Half-Open 小流量试探。配合超时、降级(fallback)一起用，是微服务容错的标配（Hystrix、Resilience4j、Sentinel）。` })

    const base0: Frame = { op: 'intro', step: -1, cstate: 'closed', fails: 0, threshold: TH, outcome: '', phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '请求步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
