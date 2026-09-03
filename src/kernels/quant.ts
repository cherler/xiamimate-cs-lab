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
import { type SimDocument } from '../core/document.ts'
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

  compile(_doc: SimDocument): CompiledModel<QuantState> {
    const N = WEIGHTS.length
    const absMax = Math.max(...WEIGHTS.map(Math.abs))
    const bytesFp32 = N * 4

    //  量化不是"一步步算"的仿真——它是个函数：一组权重 + 位数 → 整数/误差/显存。
    //  真正在**变**的是位数:轴换成"位宽从高到低扫描",按播放就看同一组权重压到 int8→int2,
    //  整数越来越粗、最大误差越来越大、显存越来越小——一眼看清"拿精度换显存"这笔账。
    const BITS_SWEEP = [8, 6, 4, 3, 2]

    const at = (bits: number): Frame => {
      const qmax = Math.pow(2, bits - 1) - 1
      const scale = absMax / qmax
      const bytesQ = N * (bits / 8)
      const ints: (number | null)[] = []
      const deq: (number | null)[] = []
      const errs: (number | null)[] = []
      let maxErr = 0
      for (let k = 0; k < N; k++) {
        const q = Math.max(-qmax, Math.min(qmax, Math.round(WEIGHTS[k] / scale)))
        const dq = q * scale
        const e = Math.abs(WEIGHTS[k] - dq)
        ints.push(q); deq.push(r3(dq)); errs.push(r3(e))
        maxErr = Math.max(maxErr, e)
      }
      return {
        bits, qmax, scale, weights: WEIGHTS, cursor: N,
        ints, deq, errs, maxErr: r3(maxErr), bytesFp32, bytesQ, phase: 'done',
        log: `**int${bits}**（±${qmax}，scale=${scale.toFixed(4)}）：${N} 个权重从 fp32 的 ${bytesFp32}B 压到 **${bytesQ}B**`
          + `（省 ${Math.round((1 - bytesQ / bytesFp32) * 100)}%），最大误差 **${r3(maxErr)}**。`
          + (bits >= 8 ? '位多、误差小,但省得少' : bits <= 2 ? '位极少、误差飙升,精度快扛不住' : '位越少越省显存、误差越大——拿精度换显存和带宽'),
      }
    }

    const frames: Frame[] = BITS_SWEEP.map(at)

    return {
      axis: { kind: 'step', label: '量化位数' },
      initial: () => ({ ...at(8), i: -1, log: '按 ▶ 从高到低扫量化位数(int8→int2)：同一组权重,看整数越来越粗、最大误差越来越大、显存越来越小。' }),
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
