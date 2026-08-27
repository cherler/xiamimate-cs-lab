/**
 * 内核：高维近正交（大模型推理 · 原理：嵌入为什么有容量）
 * 轴：step —— 逐个增大维度 d，看 8 个随机向量两两夹角余弦怎么挤向 0
 *
 * 大模型的嵌入是几百上千维。为什么这么高维能装下十几万个词还不"打架"？
 * 因为**高维随机向量几乎两两正交**：两个随机单位向量的夹角余弦，均值 0、**方差 = 1/d**
 * （d 个独立分量的归一化内积，又是大数定理那套——分量越多越集中在 0）。
 * 于是 d 越大，任意两个随机方向就越接近 90°，你能在高维里塞下**指数级多**的"近正交"方向，
 * 每个概念占一个、彼此几乎不干扰。这就是分布式表示 / 嵌入有容量的根，也是点积能当"相关度"的前提。
 *
 * 本实验：固定 8 个用确定性伪随机（LCG + Box-Muller 高斯）生成的单位向量。逐步增大维度 d：
 *   算出全部 C(8,2)=28 对的夹角余弦，看它们随 d 增大越挤越紧地贴向 0，
 *   标准差 ≈ 1/√d（可与理论核对），最大 |余弦|（最"不正交"的一对）也随之缩小。
 * 值全部现算、可核对：cos 均值≈0、std≈1/√d、max|cos| 随 d 单调降。状态可 JSON 往返。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type OrthoState = {
  i: number
  step: number
  d: number
  n: number                    // 向量个数
  cosines: number[]            // 全部 C(n,2) 对的夹角余弦
  mean: number
  std: number                  // 实测标准差
  theoStd: number              // 理论 1/√d
  maxAbs: number               // 最大 |余弦|
  phase: 'run' | 'done'
  log: string
}

export const ORTHO_VISIBLE = [
  'step', 'd', 'n', 'cosines', 'mean', 'std', 'theoStd', 'maxAbs', 'phase', 'log',
] as const

type Frame = Omit<OrthoState, 'i'>

const N = 8
const D_VALUES = [2, 8, 32, 128, 512]

// 确定性伪随机：LCG（可复现）
function lcg(seed: number) {
  let s = seed >>> 0
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 0x100000000 }
}
// Box-Muller：均匀 → 标准正态（高斯分量给球面上均匀的方向）
function gauss(rand: () => number) {
  let u = 0, v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
function dot(a: number[], b: number[]) { let s = 0; for (let k = 0; k < a.length; k++) s += a[k] * b[k]; return s }

export const orthoKernel: Kernel<OrthoState> = {
  kind: 'ortho',

  compile(_doc: SimDocument): CompiledModel<OrthoState> {
    const frames: Frame[] = []

    D_VALUES.forEach((d, step) => {
      // 用固定 seed 生成 N 个 d 维单位向量（同一 seed → 可复现）
      const rand = lcg(20240824)
      const vecs: number[][] = []
      for (let i = 0; i < N; i++) {
        const v = Array.from({ length: d }, () => gauss(rand))
        const norm = Math.sqrt(dot(v, v)) || 1
        vecs.push(v.map(x => x / norm))
      }
      const cos: number[] = []
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) cos.push(dot(vecs[i], vecs[j]))
      const mean = cos.reduce((a, b) => a + b, 0) / cos.length
      const std = Math.sqrt(cos.reduce((a, b) => a + (b - mean) * (b - mean), 0) / cos.length)
      const theoStd = 1 / Math.sqrt(d)
      const maxAbs = Math.max(...cos.map(Math.abs))
      frames.push({
        step, d, n: N,
        cosines: cos.map(x => +x.toFixed(3)),
        mean: +mean.toFixed(3), std: +std.toFixed(3), theoStd: +theoStd.toFixed(3), maxAbs: +maxAbs.toFixed(3),
        phase: 'run',
        log: `维度 d=${d}：${N} 个随机向量、${cos.length} 对夹角。余弦均值 **${mean.toFixed(2)}**、` +
          `标准差 **${std.toFixed(3)}**（理论 1/√d = ${theoStd.toFixed(3)}），最大 |余弦| **${maxAbs.toFixed(2)}**` +
          (maxAbs < 0.15 ? '（已经几乎两两正交了）' : '') + '。d 越大越挤向 0。',
      })
    })

    const lastD = D_VALUES[D_VALUES.length - 1]
    // 收尾帧复用最后一维的数据
    const lastFrame = frames[frames.length - 1]
    frames.push({
      ...lastFrame, phase: 'done',
      log: `从 d=2 到 d=${lastD}：随机向量的两两余弦标准差从 ~0.7 一路缩到 ~${(1 / Math.sqrt(lastD)).toFixed(3)}（≈1/√d），` +
        `最大 |余弦| 也贴到 0——**高维里随机方向几乎两两正交**。所以 ${lastD} 维能塞下指数级多的"近正交"方向，` +
        `每个概念占一个、彼此几乎不干扰，这就是嵌入有容量、点积能当相关度的根。又是一条大数定理：分量越多，归一化内积越集中在 0。`,
    })

    const base0: Frame = {
      step: -1, d: 0, n: N, cosines: [], mean: 0, std: 0, theoStd: 0, maxAbs: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '维度 d' },
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
