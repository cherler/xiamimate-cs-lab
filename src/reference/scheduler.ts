/**
 * 独立设计 #2：进程调度甘特图
 * 同样不预设统一抽象。
 */

// ─── DSL ───────────────────────────────────────────────
export type SchedulerDSL = {
  kind: 'scheduler'
  algorithm: 'FCFS' | 'SJF' | 'SRTF' | 'RR'
  quantum: number                 // 仅 RR 用
  processes: {                    // 实体集合 —— 带时间属性
    id: string
    arrival: number
    burst: number
  }[]
}

// ─── 每步状态 ───────────────────────────────────────────
export type SchedulerStep = {
  t: number
  running: string | null
  readyQueue: string[]
  remaining: Record<string, number>
  completed: string[]
  log: string
}

// ─── 参考实现 ───────────────────────────────────────────
export function runScheduler(d: SchedulerDSL): SchedulerStep[] {
  const remaining: Record<string, number> = {}
  for (const p of d.processes) remaining[p.id] = p.burst

  const completed: string[] = []
  const trace: SchedulerStep[] = []
  let ready: string[] = []
  let running: string | null = null
  let sliceLeft = 0
  const total = d.processes.reduce((s, p) => s + p.burst, 0)
  const maxT = total + Math.max(...d.processes.map(p => p.arrival)) + 1

  for (let t = 0; t <= maxT && completed.length < d.processes.length; t++) {
    // 到达
    for (const p of d.processes)
      if (p.arrival === t && !ready.includes(p.id) && p.id !== running) ready.push(p.id)

    // 抢占判定
    if (running !== null && d.algorithm === 'SRTF') {
      const better = ready.find(id => remaining[id] < remaining[running!])
      if (better !== undefined) { ready.push(running); running = null }
    }
    if (running !== null && d.algorithm === 'RR' && sliceLeft === 0) {
      ready.push(running); running = null
    }

    // 选下一个
    let note = ''
    if (running === null && ready.length > 0) {
      let pick = 0
      if (d.algorithm === 'SJF' || d.algorithm === 'SRTF') {
        for (let k = 1; k < ready.length; k++)
          if (remaining[ready[k]] < remaining[ready[pick]]) pick = k
      }
      running = ready.splice(pick, 1)[0]
      sliceLeft = d.quantum
      note = ` ← 调度选中（${d.algorithm}）`
    }

    const step: SchedulerStep = {
      t, running, readyQueue: [...ready],
      remaining: { ...remaining }, completed: [...completed],
      log: running === null
        ? `t=${t} CPU 空闲，就绪队列 [${ready.join(', ') || '空'}]`
        : `t=${t} 运行 ${running}（剩余 ${remaining[running]}）就绪 [${ready.join(', ') || '空'}]${note}`,
    }
    trace.push(step)

    // 执行一个时间单位
    if (running !== null) {
      remaining[running]--
      sliceLeft--
      if (remaining[running] === 0) { completed.push(running); running = null; sliceLeft = 0 }
    }
  }

  //  循环条件在"全部完成"时就退出了，于是最后一次完成没有任何一步记录它 ——
  //  轨迹末态永远显示"已完成 n−1 / n"。补一步收尾。
  //  （统一内核当初写出了同样的毛病：两份独立实现撞了同一个盲点，
  //   直到看着界面上那句"已完成 3/4"才发现。）
  if (completed.length === d.processes.length) {
    trace.push({
      t: trace.length ? trace[trace.length - 1].t + 1 : 0,
      running: null, readyQueue: [...ready],
      remaining: { ...remaining }, completed: [...completed],
      log: `t=${trace.length ? trace[trace.length - 1].t + 1 : 0} 全部 ${d.processes.length} 个进程执行完毕`,
    })
  }

  return trace
}

// ─── 跑一个 ─────────────────────────────────────────────
if (import.meta.filename === process.argv[1]) {
  const dsl: SchedulerDSL = {
    kind: 'scheduler',
    algorithm: 'SRTF',
    quantum: 2,
    processes: [
      { id: 'P1', arrival: 0, burst: 7 },
      { id: 'P2', arrival: 2, burst: 4 },
      { id: 'P3', arrival: 4, burst: 1 },
      { id: 'P4', arrival: 5, burst: 4 },
    ],
  }
  const trace = runScheduler(dsl)
  console.log('── 调度轨迹 ──')
  for (const s of trace) console.log(`  ${s.log}`)
  const gantt = trace.map(s => s.running ?? '·').join('')
  console.log(`  甘特条: ${gantt}`)
}
