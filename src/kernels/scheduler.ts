/**
 * 内核：进程调度甘特图（操作系统）
 * 轴：time（每个时间单位一步）
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type SchedState = {
  // ── 可见部分
  t: number
  running: string | null
  readyQueue: string[]
  remaining: Record<string, number>
  completed: string[]
  log: string
  // ── 重放所需（独立实现漏在闭包里的那个）
  sliceLeft: number
}

export const SCHED_VISIBLE = [
  't', 'running', 'readyQueue', 'remaining', 'completed', 'log',
] as const

export const schedKernel: Kernel<SchedState> = {
  kind: 'scheduler',

  compile(doc: SimDocument): CompiledModel<SchedState> {
    const algorithm = str(doc.params, 'algorithm')
    const quantum = num(doc.params, 'quantum')

    // 接缝 1：这里从 entities 提取进程。手搓 CPU 阶段这一段变成网表提取。
    const procs = doc.entities
      .filter(e => e.type === 'process')
      .map(e => ({ id: e.id, arrival: e.at ?? 0, burst: num(e.attrs, 'burst') }))

    const total = procs.reduce((s, p) => s + p.burst, 0)
    const maxT = total + Math.max(...procs.map(p => p.arrival)) + 1

    return {
      axis: { kind: 'time', label: '时刻', unit: 't' },

      initial: () => ({
        t: -1,
        running: null,
        readyQueue: [],
        remaining: Object.fromEntries(procs.map(p => [p.id, p.burst])),
        completed: [],
        log: '',
        sliceLeft: 0,
      }),

      describe: s => s.log,

      step(prev) {
        const base = prev ?? this.initial()
        if (base.completed.length >= procs.length) return null
        const t = base.t + 1
        if (t > maxT) return null

        const remaining = { ...base.remaining }
        const completed = [...base.completed]
        const ready = [...base.readyQueue]
        let running = base.running
        let sliceLeft = base.sliceLeft

        // 结算上一步的执行（等价于把执行放在循环尾部）
        if (running !== null && base.t >= 0) {
          remaining[running]--
          sliceLeft--
          if (remaining[running] === 0) {
            completed.push(running)
            running = null
            sliceLeft = 0
          }
        }
        //  结算完最后一个进程就直接 return null 的话，"全部完成"这件事
        //  被算出来又扔掉了 —— 轨迹里没有任何一步显示它，UI 永远停在"已完成 3/4"。
        //  必须把这一步发出去。
        if (completed.length >= procs.length) {
          return {
            state: {
              t, running: null, readyQueue: ready, remaining, completed,
              log: `t=${t} 全部 ${procs.length} 个进程执行完毕`,
              sliceLeft: 0,
            },
            done: true,
          }
        }

        // 到达
        for (const p of procs) {
          if (p.arrival === t && !ready.includes(p.id) && p.id !== running) ready.push(p.id)
        }

        // 抢占
        if (running !== null && algorithm === 'SRTF') {
          const better = ready.find(id => remaining[id] < remaining[running!])
          if (better !== undefined) { ready.push(running); running = null }
        }
        if (running !== null && algorithm === 'RR' && sliceLeft === 0) {
          ready.push(running)
          running = null
        }

        // 选下一个
        let note = ''
        if (running === null && ready.length > 0) {
          let pick = 0
          if (algorithm === 'SJF' || algorithm === 'SRTF') {
            for (let k = 1; k < ready.length; k++) {
              if (remaining[ready[k]] < remaining[ready[pick]]) pick = k
            }
          }
          running = ready.splice(pick, 1)[0]
          sliceLeft = quantum
          note = ` ← 调度选中（${algorithm}）`
        }

        const log = running === null
          ? `t=${t} CPU 空闲，就绪队列 [${ready.join(', ') || '空'}]`
          : `t=${t} 运行 ${running}（剩余 ${remaining[running]}）就绪 [${ready.join(', ') || '空'}]${note}`

        return {
          state: { t, running, readyQueue: ready, remaining, completed, log, sliceLeft },
          done: false,
        }
      },
    }
  },
}
