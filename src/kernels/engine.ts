/**
 * 内核：推理引擎（大模型推理 · 压轴：把算子串成一个系统）
 * 轴：step —— 引擎主循环每转一圈：回收完成的 → 调度准入等待的 → prefill/decode 一步 → 前进
 *
 * 前面那些实验（KV缓存/注意力/量化/矩阵乘…）都是**单个算子**。真正的推理引擎是把它们串成一个
 * 会**连续批处理（continuous batching）**的系统：请求随时来、算完随时走，批次每一步都在变；
 * KV 显存按**块池**管理，准入要看有没有空闲块。这一屏就是这台引擎的主循环。
 *
 * 每转一圈（一个引擎 step）：
 *   1) 回收：已生成够 max_new 的请求 → done，**归还它的块**。
 *   2) 调度：按 FCFS 把等待队列里**放得下**（空闲块够）的请求准入 running（遇到第一个放不下就停，队头阻塞）。
 *   3) 执行：新准入的做 prefill（一次吃完 prompt）；在跑的做 decode（生成 1 个 token）。
 *   4) 前进：吐出的 token 计入吞吐。
 *
 * 对比静态批：静态批要等一整批全跑完才收下一批，短请求被长请求拖着空转；连续批处理让算完的位子立刻
 * 让给等待的，利用率和吞吐都更高。这就是 vLLM/TGI 这些引擎的核心调度。
 *
 * 值全部现算，可核对（验收标准 2）：块守恒（free + Σ在跑请求占用 = pool 恒成立）、
 * 准入只在 free≥需求 时发生、总生成 token = Σ各请求 max_new、完成顺序可推。状态可 JSON 往返。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type Req = {
  id: string
  prompt: number      // prompt token 数
  maxNew: number      // 要生成的 token 数
  blocks: number      // 占用的 KV 块数（按总长一次性算）
  tokens: number      // 已有 token 数（prompt 起步，decode 递增）
  phase: 'wait' | 'prefill' | 'decode' | 'done'
}

export type EngineState = {
  i: number
  step: number
  pool: number                 // 块池总块数
  free: number                 // 空闲块
  blockSize: number
  running: Req[]
  waiting: string[]
  done: string[]
  gen: number                  // 累计生成的 token 数
  event: string                // 本步事件类型标签
  admitted: string[]           // 本步准入的
  finished: string[]           // 本步完成的
  phase: 'run' | 'done'
  log: string
}

export const ENGINE_VISIBLE = [
  'step', 'pool', 'free', 'blockSize', 'running', 'waiting', 'done', 'gen',
  'event', 'admitted', 'finished', 'phase', 'log',
] as const

type Frame = Omit<EngineState, 'i'>

// 固定四个请求（prompt, maxNew），便于逐步手核
const REQS: { id: string; prompt: number; maxNew: number }[] = [
  { id: 'R1', prompt: 2, maxNew: 2 },
  { id: 'R2', prompt: 4, maxNew: 3 },
  { id: 'R3', prompt: 3, maxNew: 2 },
  { id: 'R4', prompt: 2, maxNew: 1 },
]

const clone = (r: Req): Req => ({ ...r })
const snapRunning = (running: Req[]) => running.map(clone)

export const engineKernel: Kernel<EngineState> = {
  kind: 'engine',

  compile(doc: SimDocument): CompiledModel<EngineState> {
    const pool = Math.max(3, Math.min(6, num(doc.params, 'pool') || 4))
    const blockSize = 4

    const frames: Frame[] = []
    // 初始化：全部在等待队列
    const meta: Record<string, Req> = {}
    for (const r of REQS) {
      meta[r.id] = {
        id: r.id, prompt: r.prompt, maxNew: r.maxNew,
        blocks: Math.ceil((r.prompt + r.maxNew) / blockSize),
        tokens: r.prompt, phase: 'wait',
      }
    }
    let free = pool
    let running: Req[] = []
    let waiting: string[] = REQS.map(r => r.id)
    const done: string[] = []
    let gen = 0
    let step = 0

    // 主循环：直到全部 done
    while (done.length < REQS.length) {
      const finished: string[] = []
      const admitted: string[] = []

      // 1) 回收完成的（上一步 decode 到达 maxNew 的）
      running = running.filter(r => {
        if (r.tokens >= r.prompt + r.maxNew) {
          r.phase = 'done'; free += r.blocks; done.push(r.id); finished.push(r.id)
          return false
        }
        return true
      })

      // 2) 调度准入：FCFS，遇到第一个放不下就停（队头阻塞）
      while (waiting.length > 0) {
        const r = meta[waiting[0]]
        if (r.blocks <= free) {
          free -= r.blocks; r.phase = 'prefill'; running.push(r); admitted.push(r.id); waiting.shift()
        } else break
      }

      // 3) 执行一步：prefill 的转 decode（prompt 已在 tokens 里）；decode 的 +1 token
      let stepGen = 0
      for (const r of running) {
        if (r.phase === 'prefill') {
          r.phase = 'decode'   // prefill 一次吃完 prompt，本步不算新 token
        } else if (r.phase === 'decode') {
          r.tokens += 1; gen += 1; stepGen += 1
        }
      }

      const used = pool - free
      // 断言块守恒（开发期自检）
      const held = running.reduce((s, r) => s + r.blocks, 0)
      if (held !== used) throw new Error(`块不守恒: held ${held} != used ${used}`)

      const evParts: string[] = []
      if (finished.length) evParts.push(`回收 ${finished.join('/')}（归还块）`)
      if (admitted.length) evParts.push(`准入 ${admitted.join('/')}（prefill）`)
      const decoding = running.filter(r => r.phase === 'decode' && !admitted.includes(r.id))
      if (stepGen) evParts.push(`decode ${decoding.map(r => r.id).join('/')} 各出 1 token`)

      frames.push({
        step, pool, free, blockSize,
        running: snapRunning(running), waiting: waiting.slice(), done: done.slice(), gen,
        event: finished.length ? 'complete' : admitted.length ? 'admit' : 'decode',
        admitted, finished, phase: 'run',
        log: `第 ${step} 步：` + (evParts.join('；') || '继续 decode') + `。` +
          `块池 ${used}/${pool} 用，${free} 空；批内 ${running.length} 个在跑，${waiting.length} 个等。`,
      })
      step++
      if (step > 30) break  // 安全阀
    }

    // 收尾帧
    const staticSteps = REQS.reduce((s, r) => s + r.maxNew, 0) // 静态串行的粗略下界对比用
    frames.push({
      step: step - 1, pool, free: pool, blockSize,
      running: [], waiting: [], done: done.slice(), gen,
      event: 'done', admitted: [], finished: [], phase: 'done',
      log: `全部完成：${REQS.length} 个请求、共生成 **${gen}** 个 token，引擎跑了 **${step}** 步。` +
        `连续批处理让算完的请求立刻把块和位子让给等待的——算完随时走、新的随时上，` +
        `所以 ${step} 步就清空；静态批要等整批跑完才换批，短请求被长的拖着空转。` +
        `（简化：准入时按总长一次性分配块；真实引擎随 decode 增量分配，见「PagedAttention」。静态下界≈${staticSteps}）`,
    })

    const base0: Frame = {
      step: -1, pool, free: pool, blockSize, running: [], waiting: REQS.map(r => r.id), done: [],
      gen: 0, event: 'init', admitted: [], finished: [], phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '引擎步' },
      initial: () => ({ i: -1, ...base0 }),
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
