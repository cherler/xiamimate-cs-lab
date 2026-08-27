/**
 * 内核：KV 换出 offload（大模型推理 · 内存与调度）
 * 轴：step —— 逐个 KV 块访问：GPU 命中/换入；GPU 满了就把最久没用的块换出到 CPU（LRU）
 *
 * KV 缓存吃显存（见「KV 缓存」/「参数量与显存」）。高并发、长上下文时 GPU 显存装不下所有 KV 块，
 * 就把暂时不用的块**换出到 CPU 内存**（offload），要用时再**换入**（reload）—— 和操作系统的页面置换一模一样。
 *   访问某块：在 GPU 上 → 命中；不在且 GPU 满 → 按 LRU 把最久没用的块换出，再把要的块换入。
 * 显存不够时用"换出换入"续命，代价是换入换出的 PCIe 拷贝（慢）。这就是「页面置换」在推理里的应用。
 *
 * 值全部现算：给定访问序列 + 槽数 + LRU，命中/换出/换入次数与末态可核对。状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type KvOffloadState = {
  i: number
  slots: number
  seq: number[]
  step: number             // 当前访问序列下标
  req: number              // 当前请求的块 id
  gpu: number[]            // GPU 上的块（LRU：末尾最新）
  cpu: number[]            // 换出到 CPU 的块
  result: 'hit' | 'miss'
  evicted: number | null   // 本步换出的块（换出到 CPU）
  reloaded: boolean        // 本步是否从 CPU 换入
  hits: number; offloads: number; reloads: number
  phase: 'run' | 'done'
  log: string
}

export const KVOFFLOAD_VISIBLE = [
  'i', 'slots', 'seq', 'step', 'req', 'gpu', 'cpu', 'result', 'evicted', 'reloaded', 'hits', 'offloads', 'reloads', 'phase', 'log',
] as const

type Frame = Omit<KvOffloadState, 'i'>

const SEQ = [0, 1, 2, 0, 3, 1, 4, 2]

export const kvoffloadKernel: Kernel<KvOffloadState> = {
  kind: 'kvoffload',

  compile(doc: SimDocument): CompiledModel<KvOffloadState> {
    const slots = Math.max(2, Math.min(5, num(doc.params, 'slots') || 3))

    const frames: Frame[] = []
    let gpu: number[] = []
    let cpu: number[] = []
    let hits = 0, offloads = 0, reloads = 0

    SEQ.forEach((req, step) => {
      let result: 'hit' | 'miss', evicted: number | null = null, reloaded = false
      if (gpu.includes(req)) {
        result = 'hit'; hits++
        gpu = gpu.filter(b => b !== req); gpu.push(req)   // LRU 更新
      } else {
        result = 'miss'
        if (cpu.includes(req)) { cpu = cpu.filter(b => b !== req); reloaded = true; reloads++ }
        if (gpu.length >= slots) { evicted = gpu.shift()!; cpu.push(evicted); offloads++ }
        gpu.push(req)
      }
      frames.push({
        slots, seq: SEQ, step, req, gpu: gpu.slice(), cpu: cpu.slice(), result, evicted, reloaded,
        hits, offloads, reloads, phase: 'run',
        log: `访问 KV 块 ${req}：` +
          (result === 'hit' ? `**命中**（在 GPU 上，更新为最近用过）。`
            : `**未命中**。` + (reloaded ? `块 ${req} 在 CPU → 换入。` : '新块。') +
              (evicted !== null ? `GPU 满，把最久没用的块 ${evicted} **换出到 CPU**。` : '')),
      })
    })

    frames.push({
      slots, seq: SEQ, step: SEQ.length - 1, req: SEQ[SEQ.length - 1], gpu: gpu.slice(), cpu: cpu.slice(),
      result: 'miss', evicted: null, reloaded: false, hits, offloads, reloads, phase: 'done',
      log: `${SEQ.length} 次访问：命中 **${hits}**，换出 **${offloads}**、换入 **${reloads}** 次。` +
        `GPU 只 ${slots} 槽装不下所有块，靠换出换入续命 —— 代价是 PCIe 拷贝。和 OS 页面置换是同一招。`,
    })

    const base0: Frame = {
      slots, seq: SEQ, step: -1, req: -1, gpu: [], cpu: [], result: 'miss', evicted: null, reloaded: false,
      hits: 0, offloads: 0, reloads: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '访问' },
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
