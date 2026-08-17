/**
 * 独立设计 #3：TCP 拥塞窗口
 * 第三种形状：参数 + 稀疏事件。
 */

// ─── DSL ───────────────────────────────────────────────
export type TcpDSL = {
  kind: 'tcp'
  variant: 'Tahoe' | 'Reno'
  initialCwnd: number
  initialSsthresh: number
  rounds: number
  lossEvents: {                  // 稀疏事件 —— 大多数轮次没有
    round: number
    type: 'timeout' | 'tripleDup'
  }[]
}

// ─── 每步状态 ───────────────────────────────────────────
export type TcpStep = {
  round: number
  cwnd: number
  ssthresh: number
  phase: 'slowStart' | 'congestionAvoidance' | 'fastRecovery'
  event: 'none' | 'timeout' | 'tripleDup'
  log: string
}

// ─── 参考实现 ───────────────────────────────────────────
export function runTcp(d: TcpDSL): TcpStep[] {
  let cwnd = d.initialCwnd
  let ssthresh = d.initialSsthresh
  let phase: TcpStep['phase'] = cwnd < ssthresh ? 'slowStart' : 'congestionAvoidance'
  const trace: TcpStep[] = []

  for (let round = 1; round <= d.rounds; round++) {
    const ev = d.lossEvents.find(e => e.round === round)
    let log: string

    if (ev?.type === 'timeout') {
      ssthresh = Math.max(2, Math.floor(cwnd / 2))
      cwnd = 1
      phase = 'slowStart'
      log = `第 ${round} 轮 超时 → ssthresh=cwnd/2=${ssthresh}，cwnd 重置为 1，回到慢启动`
    } else if (ev?.type === 'tripleDup') {
      ssthresh = Math.max(2, Math.floor(cwnd / 2))
      if (d.variant === 'Reno') {
        cwnd = ssthresh
        phase = 'congestionAvoidance'
        log = `第 ${round} 轮 三次重复ACK → Reno 快恢复：ssthresh=${ssthresh}，cwnd=${cwnd}，进入拥塞避免`
      } else {
        cwnd = 1
        phase = 'slowStart'
        log = `第 ${round} 轮 三次重复ACK → Tahoe 不区分：cwnd 重置为 1，回到慢启动`
      }
    } else if (phase === 'slowStart') {
      log = `第 ${round} 轮 慢启动 cwnd=${cwnd} → 指数增长`
      trace.push({ round, cwnd, ssthresh, phase, event: 'none', log })
      cwnd = cwnd * 2
      if (cwnd >= ssthresh) { cwnd = ssthresh; phase = 'congestionAvoidance' }
      continue
    } else {
      log = `第 ${round} 轮 拥塞避免 cwnd=${cwnd} → 线性 +1`
      trace.push({ round, cwnd, ssthresh, phase, event: 'none', log })
      cwnd = cwnd + 1
      continue
    }

    trace.push({ round, cwnd, ssthresh, phase, event: ev!.type, log })
  }

  return trace
}

// ─── 跑一个 ─────────────────────────────────────────────
if (import.meta.filename === process.argv[1]) {
  const dsl: TcpDSL = {
    kind: 'tcp',
    variant: 'Reno',
    initialCwnd: 1,
    initialSsthresh: 16,
    rounds: 14,
    lossEvents: [{ round: 7, type: 'tripleDup' }, { round: 11, type: 'timeout' }],
  }
  const trace = runTcp(dsl)
  console.log('── TCP 轨迹 ──')
  for (const s of trace) console.log(`  ${s.log}`)
  console.log(`  cwnd 序列: ${trace.map(s => s.cwnd).join(' ')}`)
}
