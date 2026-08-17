/**
 * 内核：TCP 拥塞窗口（计算机网络）
 * 轴：time（每个 RTT 一步）
 *
 * 状态里有 nextCwnd / nextPhase —— 因为"本轮显示的 cwnd"和"下轮起点的 cwnd"
 * 在无事件轮次里不是同一个值。独立实现把这个差异藏在控制流里（push 之后才改），
 * 那样就没法从任意状态续跑。提到 state 上是验收标准 2 的要求。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type TcpPhase = 'slowStart' | 'congestionAvoidance' | 'fastRecovery'

export type TcpState = {
  // ── 可见部分
  round: number
  cwnd: number
  ssthresh: number
  phase: TcpPhase
  event: 'none' | 'timeout' | 'tripleDup'
  log: string
  // ── 重放所需
  nextCwnd: number
  nextPhase: TcpPhase
}

export const TCP_VISIBLE = [
  'round', 'cwnd', 'ssthresh', 'phase', 'event', 'log',
] as const

export const tcpKernel: Kernel<TcpState> = {
  kind: 'tcp',

  compile(doc: SimDocument): CompiledModel<TcpState> {
    const variant = str(doc.params, 'variant')
    const rounds = num(doc.params, 'rounds')
    const initialCwnd = num(doc.params, 'initialCwnd')
    const initialSsthresh = num(doc.params, 'initialSsthresh')

    // 稀疏事件：entities 里 type='loss' 的，用 at 当轮次锚点
    const losses = new Map<number, string>(
      doc.entities
        .filter(e => e.type === 'loss')
        .map(e => [e.at as number, str(e.attrs, 'type')]),
    )

    const startPhase: TcpPhase =
      initialCwnd < initialSsthresh ? 'slowStart' : 'congestionAvoidance'

    return {
      axis: { kind: 'time', label: '轮次', unit: 'RTT' },

      initial: () => ({
        round: 0, cwnd: 0, ssthresh: initialSsthresh, phase: startPhase,
        event: 'none', log: '',
        nextCwnd: initialCwnd, nextPhase: startPhase,
      }),

      describe: s => s.log,

      step(prev) {
        const base = prev ?? this.initial()
        const round = base.round + 1
        if (round > rounds) return null

        let cwnd = base.nextCwnd
        let ssthresh = base.ssthresh
        let phase = base.nextPhase
        const ev = losses.get(round)

        let log: string
        let event: TcpState['event'] = 'none'
        let nextCwnd: number
        let nextPhase: TcpPhase

        if (ev === 'timeout') {
          event = 'timeout'
          ssthresh = Math.max(2, Math.floor(cwnd / 2))
          cwnd = 1
          phase = 'slowStart'
          log = `第 ${round} 轮 超时 → ssthresh=cwnd/2=${ssthresh}，cwnd 重置为 1，回到慢启动`
          nextCwnd = cwnd
          nextPhase = phase
        } else if (ev === 'tripleDup') {
          event = 'tripleDup'
          ssthresh = Math.max(2, Math.floor(cwnd / 2))
          if (variant === 'Reno') {
            cwnd = ssthresh
            phase = 'congestionAvoidance'
            log = `第 ${round} 轮 三次重复ACK → Reno 快恢复：ssthresh=${ssthresh}，cwnd=${cwnd}，进入拥塞避免`
          } else {
            cwnd = 1
            phase = 'slowStart'
            log = `第 ${round} 轮 三次重复ACK → Tahoe 不区分：cwnd 重置为 1，回到慢启动`
          }
          nextCwnd = cwnd
          nextPhase = phase
        } else if (phase === 'slowStart') {
          log = `第 ${round} 轮 慢启动 cwnd=${cwnd} → 指数增长`
          nextCwnd = cwnd * 2
          nextPhase = phase
          if (nextCwnd >= ssthresh) {
            nextCwnd = ssthresh
            nextPhase = 'congestionAvoidance'
          }
        } else {
          log = `第 ${round} 轮 拥塞避免 cwnd=${cwnd} → 线性 +1`
          nextCwnd = cwnd + 1
          nextPhase = phase
        }

        return {
          state: { round, cwnd, ssthresh, phase, event, log, nextCwnd, nextPhase },
          done: round === rounds,
        }
      },
    }
  },
}
