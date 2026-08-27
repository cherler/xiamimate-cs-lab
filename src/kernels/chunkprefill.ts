/**
 * 内核：Chunked Prefill（大模型推理 · 内存与调度）
 * 轴：step —— 逐个时隙走时间线：长 prefill 切块，和另一请求的 decode 交错，看谁等多久
 *
 * prefill（把整段 prompt 过一遍、算 KV）算得多、耗时长；decode（逐字吐）每步很短。
 * 若一个长 prefill 一整块跑完，正在解码的其它请求要**干等它结束**，首字延迟被拉爆。
 * chunked prefill：把长 prefill 切成小块，块与块之间**插入其它请求的 decode** ——
 *   总时间几乎不变，但等待中的请求能很快拿到下一个字（首字延迟大降）。坐在「进程调度」的时间片思想上。
 *
 * 值全部现算：时间线由块大小决定，B 的首个 decode 完成时刻可核对。状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Op = { kind: 'prefill' | 'decode'; cost: number; label: string }

export type ChunkPrefillState = {
  i: number
  chunk: number
  prefillLen: number
  decodeCount: number
  /** 时间线（已排定），逐个点亮 */
  timeline: Op[]
  /** 当前走到第几个 op（-1 未开始） */
  cursor: number
  /** 累计时间 */
  clock: number
  /** B 的首个 decode 完成时刻（越小越好） */
  firstDecodeAt: number
  totalTime: number
  phase: 'run' | 'done'
  log: string
}

export const CHUNKPREFILL_VISIBLE = [
  'i', 'chunk', 'prefillLen', 'decodeCount', 'timeline', 'cursor', 'clock', 'firstDecodeAt', 'totalTime', 'phase', 'log',
] as const

type Frame = Omit<ChunkPrefillState, 'i'>

export const chunkprefillKernel: Kernel<ChunkPrefillState> = {
  kind: 'chunkprefill',

  compile(doc: SimDocument): CompiledModel<ChunkPrefillState> {
    const prefillLen = 8
    const decodeCount = 4
    const chunk = Math.max(1, Math.min(prefillLen, num(doc.params, 'chunk') || 2))

    //  排时间线：交错 prefill 块与 decode
    const timeline: Op[] = []
    let rem = prefillLen, dec = decodeCount, ci = 1, di = 1
    while (rem > 0 || dec > 0) {
      if (rem > 0) { const c = Math.min(chunk, rem); timeline.push({ kind: 'prefill', cost: c, label: `A prefill 块${ci++}(${c})` }); rem -= c }
      if (dec > 0) { timeline.push({ kind: 'decode', cost: 1, label: `B decode ${di++}` }); dec -= 1 }
    }

    //  预算每个 op 完成时刻 + B 首个 decode 完成时刻
    let t = 0, firstDecode = -1
    const done: number[] = []
    timeline.forEach(op => { t += op.cost; done.push(t); if (op.kind === 'decode' && firstDecode < 0) firstDecode = t })
    const totalTime = t

    const frames: Frame[] = []
    let clock = 0
    timeline.forEach((op, k) => {
      clock += op.cost
      frames.push({
        chunk, prefillLen, decodeCount, timeline, cursor: k, clock, firstDecodeAt: firstDecode, totalTime,
        phase: 'run',
        log: `t=${clock}：${op.label}（耗时 ${op.cost}）。` +
          (op.kind === 'decode' && done[k] === firstDecode ? `←【B 的首个字在此吐出，等了 ${firstDecode}】` : ''),
      })
    })
    frames.push({
      chunk, prefillLen, decodeCount, timeline, cursor: timeline.length, clock: totalTime, firstDecodeAt: firstDecode, totalTime,
      phase: 'done',
      log: `块大小 ${chunk}：总时间 ${totalTime} 不变，但 B 的首个字在 t=**${firstDecode}** 就吐出（整块跑要等到 t=${prefillLen + 1}）。` +
        `切得越碎、别人等得越短 —— 用一点点调度换来延迟公平，这就是 chunked prefill。`,
    })

    const base0: Frame = {
      chunk, prefillLen, decodeCount, timeline, cursor: -1, clock: 0, firstDecodeAt: firstDecode, totalTime,
      phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '时隙' },
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
