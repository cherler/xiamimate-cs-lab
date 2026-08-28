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
  op: 'intro' | 'pass' | 'fail' | 'trip' | 'reject' | 'timeout' | 'probe' | 'probeFail' | 'recover'
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
      log: `**熔断器：防级联雪崩**\n下游依赖故障时，如果还一直打它、每个请求都卡到超时，会耗光上游线程 → 雪崩。\n三个状态：\n· **Closed**（正常）：放行，累计失败；失败数 ≥ 阈值(${TH}) → 跳 Open\n· **Open**（熔断）：直接快速失败，不打下游；超时后 → Half-Open\n· **Half-Open**（试探）：放探测请求，成功→回 Closed，失败→退回 Open\n喂一串事件进去，看状态机怎么转（含探测失败退回）。` })

    //  —— 真状态机：cstate/fails 由事件按转移规则算出，不写死 ——
    type Ev = { t: 'req'; ok?: boolean } | { t: 'timeout' } | { t: 'probe'; ok: boolean }
    const SEQ: Ev[] = [
      { t: 'req', ok: true },   // #1 成功
      { t: 'req', ok: false },  // #2 失败
      { t: 'req', ok: false },  // #3 失败
      { t: 'req', ok: false },  // #4 失败 → 达阈值跳闸
      { t: 'req' },             // #5 Open 态 → 快速失败
      { t: 'timeout' },         // 超时 → Half-Open
      { t: 'probe', ok: false },// 探测失败 → 退回 Open
      { t: 'timeout' },         // 再超时 → Half-Open
      { t: 'probe', ok: true }, // 探测成功 → 回 Closed
    ]
    let cstate: BreakerState['cstate'] = 'closed'
    let fails = 0
    let reqNo = 0
    SEQ.forEach((ev, k) => {
      let op: BreakerState['op'] = 'pass', outcome = '', focus = '', log = ''
      if (ev.t === 'req') {
        if (cstate === 'open') { op = 'reject'; outcome = '快速失败(未打下游)'; focus = 'Open：请求直接快速失败，不打下游'; log = `**请求（Open 态）**\n熔断中 → 请求**立即返回失败(fail-fast)**、根本不调用下游。给下游喘息、不让上游线程卡在超时上。` }
        else { reqNo++
          if (ev.ok) { fails = 0; op = 'pass'; outcome = '成功'; focus = 'Closed：请求成功 → 正常放行'; log = `**请求 #${reqNo}（Closed）**\n正常放行下游、返回**成功**。失败计数归 0。` }
          else { fails++
            if (fails >= TH) { cstate = 'open'; op = 'trip'; outcome = '失败→熔断'; focus = '失败数达阈值 → 跳闸到 Open（熔断！）'; log = `**请求 #${reqNo}（Closed）→ 熔断**\n又失败，失败计数 = **${fails} ≥ 阈值 ${TH}** → **跳闸！状态转 Open**，从此不打下游。` }
            else { op = 'fail'; outcome = '失败'; focus = `Closed：请求失败 → 失败计数 ${fails}`; log = `**请求 #${reqNo}（Closed）**\n下游出错、返回**失败**。失败计数 = **${fails}**（未达阈值 ${TH}，继续放行）。` }
          }
        }
      } else if (ev.t === 'timeout') {
        cstate = 'halfopen'; op = 'timeout'; outcome = '超时到，试探'; focus = 'Open 超时到 → 进 Half-Open（放探测）'; log = `**熔断冷却超时到**\nOpen 维持一个冷却期，时间一到 → 转 **Half-Open**，放少量**探测请求**看下游恢复没有。`
      } else { // probe
        if (ev.ok) { cstate = 'closed'; fails = 0; op = 'recover'; outcome = '探测成功→恢复'; focus = '探测成功 → 回 Closed，计数清零，恢复'; log = `**探测成功（Half-Open → Closed）**\n放一个真实探测请求 → **成功**，下游恢复了 → 状态回 **Closed**、失败计数清零。` }
        else { cstate = 'open'; op = 'probeFail'; outcome = '探测失败→退回 Open'; focus = '探测失败 → 退回 Open，再等一个超时'; log = `**探测失败（Half-Open → Open）**\n探测请求还是**失败** → 下游没好 → **退回 Open**、再等一个冷却超时。这一步防止下游还没恢复就被全量流量再次打垮。` }
      }
      const last = k === SEQ.length - 1
      push({ op, cstate, fails, outcome, phase: last ? 'done' : 'run', focus, log: last ? `${log}\n\n**要点**：熔断器用一个三态机把"故障隔离 + 自动探测恢复"做成自动的——Closed 累计失败、Open 快速失败保护下游、Half-Open 小流量试探（成功回 Closed、失败退回 Open）。整条状态转移由失败计数和事件驱动、非写死。配合超时和降级(fallback)，是微服务容错标配（Hystrix / Resilience4j / Sentinel）。` : log })
    })

    const base0: Frame = { op: 'intro', step: -1, cstate: 'closed', fails: 0, threshold: TH, outcome: '', phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '请求步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
