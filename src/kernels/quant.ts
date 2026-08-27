/**
 * 内核：权重量化 W8/W4（Transformer 与 LLM 原理 · 也接推理量化）
 * 轴：step —— 先算 scale，再逐个权重量化：round(w/scale) → 存整数 → 反量化 → 看误差
 *
 * 大模型显存几乎全被权重占（见「参数量与显存」）。量化把 fp32/fp16 权重压成低位整数：
 *   对称量化：scale = max(|w|) / (2^(bits-1) − 1)；q = clamp(round(w/scale))；反量化 ŵ = q·scale。
 *   int8 每权重 1 字节（vs fp32 的 4），int4 只 0.5 字节 —— 位越少越省显存，但舍入误差越大。
 * 这就是「7B 用 int8 只要 7G」的来历，也是 W8A8 / W4A16 量化推理的地基：拿一点点精度换显存和带宽。
 *
 * 值全部现算：scale、每个整数、反量化值、误差都可核对（这正是 IEEE754 浮点 / 补码那两屏的延续）。
 * 状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type QuantState = {
  i: number
  bits: number
  qmax: number             // 2^(bits-1) − 1
  scale: number
  weights: number[]        // 原始 fp32 权重
  /** 本步处理到第几个权重（-1=算 scale 阶段） */
  cursor: number
  ints: (number | null)[]  // 各权重的量化整数（未到的为 null）
  deq: (number | null)[]   // 反量化值
  errs: (number | null)[]  // |w − ŵ|
  maxErr: number           // 目前最大误差
  bytesFp32: number        // 原始字节
  bytesQ: number           // 量化后字节
  phase: 'scale' | 'quantize' | 'done'
  log: string
}

export const QUANT_VISIBLE = [
  'i', 'bits', 'qmax', 'scale', 'weights', 'cursor', 'ints', 'deq', 'errs', 'maxErr', 'bytesFp32', 'bytesQ', 'phase', 'log',
] as const

type Frame = Omit<QuantState, 'i'>

const WEIGHTS = [0.12, -0.87, 1.53, -2.10, 0.44, 1.98, -0.33, 0.71]

const r3 = (x: number) => Math.round(x * 1000) / 1000

export const quantKernel: Kernel<QuantState> = {
  kind: 'quant',

  compile(doc: SimDocument): CompiledModel<QuantState> {
    const bits = Math.max(2, Math.min(8, num(doc.params, 'bits') || 8))
    const qmax = Math.pow(2, bits - 1) - 1
    const N = WEIGHTS.length
    const absMax = Math.max(...WEIGHTS.map(Math.abs))
    const scale = absMax / qmax
    const bytesFp32 = N * 4
    const bytesPerW = bits / 8
    const bytesQ = N * bytesPerW

    const frames: Frame[] = []
    const ints: (number | null)[] = Array(N).fill(null)
    const deq: (number | null)[] = Array(N).fill(null)
    const errs: (number | null)[] = Array(N).fill(null)

    //  第 0 帧：算 scale
    frames.push({
      bits, qmax, scale, weights: WEIGHTS, cursor: -1,
      ints: ints.slice(), deq: deq.slice(), errs: errs.slice(), maxErr: 0,
      bytesFp32, bytesQ, phase: 'scale',
      log: `**定标**：int${bits} 的整数范围是 ±${qmax}。取权重绝对值最大 ${r3(absMax)}，` +
        `scale = ${r3(absMax)} / ${qmax} = **${scale.toFixed(4)}** —— 每个整数一格代表这么大。`,
    })

    let maxErr = 0
    for (let k = 0; k < N; k++) {
      const q = Math.max(-qmax, Math.min(qmax, Math.round(WEIGHTS[k] / scale)))
      const dq = q * scale
      const e = Math.abs(WEIGHTS[k] - dq)
      ints[k] = q; deq[k] = r3(dq); errs[k] = r3(e)
      maxErr = Math.max(maxErr, e)
      frames.push({
        bits, qmax, scale, weights: WEIGHTS, cursor: k,
        ints: ints.slice(), deq: deq.slice(), errs: errs.slice(), maxErr: r3(maxErr),
        bytesFp32, bytesQ, phase: 'quantize',
        log: `第 ${k} 个 w=${WEIGHTS[k]}：round(${WEIGHTS[k]} / ${scale.toFixed(4)}) = **${q}**（占 ${bytesPerW} 字节）。` +
          `反量化 ŵ = ${q} × ${scale.toFixed(4)} = ${r3(dq)}，误差 ${r3(e)}。`,
      })
    }

    frames.push({
      bits, qmax, scale, weights: WEIGHTS, cursor: N,
      ints: ints.slice(), deq: deq.slice(), errs: errs.slice(), maxErr: r3(maxErr),
      bytesFp32, bytesQ, phase: 'done',
      log: `${N} 个权重从 fp32 的 **${bytesFp32} 字节** 压到 int${bits} 的 **${bytesQ} 字节**` +
        `（省 ${Math.round((1 - bytesQ / bytesFp32) * 100)}%），最大误差 **${r3(maxErr)}**。` +
        `位越少越省显存、误差越大 —— 这就是量化拿精度换显存和带宽的本质。`,
    })

    const base0: Frame = {
      bits, qmax, scale, weights: WEIGHTS, cursor: -1,
      ints: Array(N).fill(null), deq: Array(N).fill(null), errs: Array(N).fill(null),
      maxErr: 0, bytesFp32, bytesQ, phase: 'scale', log: '',
    }

    return {
      axis: { kind: 'step', label: '量化步' },
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
