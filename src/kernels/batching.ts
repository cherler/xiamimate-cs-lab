/**
 * 内核：连续批处理（大模型推理）
 * 轴：step —— 每步是一次 decode 迭代：谁在 batch 里、谁完成离场、谁补进来
 *
 * 推理引擎把多个请求凑成一个 batch 一起过 GPU（并行、省算力）。难点是请求**长短不一、
 * 到达时间也不同**：
 *   静态批处理：等凑满一批一起跑，全部等最慢的那个跑完才收，新请求只能干等 —— GPU 空转多。
 *   连续批处理：**每个 decode 步都动态调整 batch** —— 有请求吐完就离场、腾出的槽立刻让排队的补进来。
 * 本质就是把操作系统的**进程调度**搬到 GPU 上：槽位 = CPU、请求 = 进程、decode 步 = 时间片。
 *
 * 值全部现算（利用率 = 在跑的槽数 / 总槽数）。状态可 JSON 往返（验收标准 2）。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Req = { id: string; arrive: number; len: number }

export type BatchState = {
  i: number
  slots: number
  mode: 'cont' | 'static'
  /** 本步在 batch 里的请求 id */
  active: string[]
  /** 本步完成离场的 */
  done: string[]
  /** 本步新补进来的 */
  admitted: string[]
  /** 还在排队的 */
  waiting: string[]
  /** 已全部完成的 */
  finished: string[]
  step: number
  /** 本步利用率 0..1 */
  util: number
  act: 'run' | 'idle' | 'done'
  log: string
}

export const BATCH_VISIBLE = [
  'i', 'slots', 'mode', 'active', 'done', 'admitted', 'waiting', 'finished', 'step', 'util', 'act', 'log',
] as const

type Frame = Omit<BatchState, 'i'>

//  请求：到达步 + decode 步数（长短不一，故意错开到达）
const REQS: Req[] = [
  { id: 'A', arrive: 0, len: 5 },
  { id: 'B', arrive: 0, len: 2 },
  { id: 'C', arrive: 1, len: 4 },
  { id: 'D', arrive: 2, len: 2 },
  { id: 'E', arrive: 3, len: 3 },
]

export const batchingKernel: Kernel<BatchState> = {
  kind: 'batching',

  compile(doc: SimDocument): CompiledModel<BatchState> {
    const slots = num(doc.params, 'slots') || 2
    const mode: BatchState['mode'] = str(doc.params, 'mode') === '静态' ? 'static' : 'cont'
    const reqs = REQS

    const frames: Frame[] = []
    const remaining: Record<string, number> = {}
    reqs.forEach(r => { remaining[r.id] = r.len })
    const finished: string[] = []
    let running: string[] = []      // 当前 batch
    let step = 0

    const put = (f: Partial<Frame> & { act: Frame['act']; log: string }) =>
      frames.push({
        slots, mode, active: [...running], done: [], admitted: [], waiting: [],
        finished: [...finished], step, util: running.length / slots, ...f,
      })

    const arrivedBy = (t: number) => reqs.filter(r => r.arrive <= t).map(r => r.id)

    for (let guard = 0; guard < 40; guard++) {
      //  谁已经到达、还没完成、且不在跑 —— 排队中
      const waitingNow = () => arrivedBy(step).filter(id => remaining[id] > 0 && !running.includes(id))

      if (mode === 'static') {
        //  静态：batch 空了才凑下一批（等全部跑完）
        if (running.length === 0) {
          const wq = waitingNow()
          if (wq.length === 0) {
            if (finished.length === reqs.length) break
            //  没请求可跑，空转等新到达
            put({ act: 'idle', admitted: [], waiting: wq, util: 0,
              log: `第 ${step} 步：batch 空、没有已到达的请求 —— GPU **空转**等待` })
            step++; continue
          }
          const take = wq.slice(0, slots)
          running = take
          put({ act: 'run', admitted: take, waiting: waitingNow(),
            log: `静态：凑一批 [${take.join(' ')}] 一起跑，**中途不接新请求**，直到这批全部跑完` })
        }
      } else {
        //  连续：每步都把空槽补满
        const admit = waitingNow().slice(0, slots - running.length)
        running = [...running, ...admit]
        if (admit.length) {
          put({ act: 'run', admitted: admit, waiting: waitingNow(),
            log: `连续：有空槽 → 立刻补进 [${admit.join(' ')}]，不等上一批跑完` })
        }
      }

      if (running.length === 0) {
        if (finished.length === reqs.length) break
        step++; continue
      }

      //  跑一个 decode 步
      running.forEach(id => { remaining[id]-- })
      const doneNow = running.filter(id => remaining[id] <= 0)
      running = running.filter(id => remaining[id] > 0)
      finished.push(...doneNow)
      put({ act: 'run', done: doneNow, waiting: waitingNow(),
        log: `第 ${step} 步 decode：batch [${[...running, ...doneNow].join(' ')}] 各吐一个 token`
          + (doneNow.length ? `；**${doneNow.join('、')} 吐完离场**（腾出 ${doneNow.length} 个槽）` : '')
          + `。利用率 ${Math.round(([...running, ...doneNow].length / slots) * 100)}%` })
      step++

      if (finished.length === reqs.length && running.length === 0) break
    }

    const totalUtil = frames.filter(f => f.act === 'run').reduce((s, f) => s + f.active.length + f.done.length, 0)
    const runSteps = frames.filter(f => f.act === 'run').length
    put({ act: 'done', util: 0,
      log: `${reqs.length} 个请求全部完成，用了 ${step} 步。${mode === 'cont'
        ? '连续批处理：空槽随时补，GPU 几乎没闲着'
        : '静态批处理：每批要等最慢的跑完，中间空槽白白浪费'}（平均在跑 ${runSteps ? (totalUtil / runSteps).toFixed(1) : 0} / ${slots} 槽）` })

    return {
      axis: { kind: 'step', label: '调度步' },
      initial: () => ({ i: -1, slots, mode, active: [], done: [], admitted: [], waiting: [], finished: [], step: 0, util: 0, act: 'run', log: '' }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
