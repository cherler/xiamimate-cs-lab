/**
 * 内核：内积 = 相似度（线代 · 原理：注意力凭什么用 Q·K 打分）
 * 轴：step —— 固定向量 a，让 b 从与 a 同向转到反向，看内积 a·b 怎么从最大→0→最小
 *
 * 内积(点积) a·b = |a||b|cosθ。拆开看:它同时编码了两件事——两个向量的**长度**、以及它们的**夹角**。
 * 当长度固定，内积就纯粹地量"方向有多一致":同向(θ=0)最大、正交(θ=90°)为 0、反向(θ=180°)最负。
 * 归一化掉长度(除以 |a||b|)就是**余弦相似度** cosθ ∈ [−1,1]——纯方向的相似度。
 * 这就是**注意力用 Q·K 打分**的根据:query 和 key 越"方向一致"(相关)，内积越大、softmax 后权重越高;
 * 无关的方向内积≈0(正对上「高维近正交」——随机方向几乎正交、点积≈0)。检索、推荐、词向量类比,全靠它。
 *
 * 本实验:|a|=3、|b|=2 固定，让夹角 θ 从 0°转到 180°:内积 6→4.24→0→−4.24→−6，余弦 1→0.71→0→−0.71→−1。
 * 值全部现算、可核对(a·b=|a||b|cosθ、cosθ=a·b/(|a||b|)、内积=|a|×b 在 a 上的投影)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const MAG_A = 3, MAG_B = 2
const ANGLES = [0, 45, 90, 135, 180]

export type DotSimState = {
  i: number
  step: number
  angleDeg: number
  ax: number; ay: number
  bx: number; by: number
  dot: number
  magA: number; magB: number
  cosSim: number
  proj: number               // b 在 a 上的标量投影 = |b|cosθ
  phase: 'run' | 'done'
  log: string
}

export const DOTSIM_VISIBLE = [
  'step', 'angleDeg', 'ax', 'ay', 'bx', 'by', 'dot', 'magA', 'magB', 'cosSim', 'proj', 'phase', 'log',
] as const

type Frame = Omit<DotSimState, 'i'>

export const dotsimKernel: Kernel<DotSimState> = {
  kind: 'dotsim',

  compile(_doc: SimDocument): CompiledModel<DotSimState> {
    const frames: Frame[] = []
    const ax = MAG_A, ay = 0    // a 固定指向 +x

    ANGLES.forEach((deg, step) => {
      const r = deg * Math.PI / 180
      const bx = MAG_B * Math.cos(r), by = MAG_B * Math.sin(r)
      const dot = ax * bx + ay * by
      const cosSim = dot / (MAG_A * MAG_B)
      const proj = MAG_B * Math.cos(r)
      const tag = deg === 0 ? '同向 → 最相似' : deg === 90 ? '正交 → 不相关(内积 0)' : deg === 180 ? '反向 → 最负' : deg < 90 ? '夹角小 → 正相关' : '夹角大 → 负相关'
      frames.push({
        step, angleDeg: deg, ax, ay, bx: +bx.toFixed(3), by: +by.toFixed(3),
        dot: +dot.toFixed(3), magA: MAG_A, magB: MAG_B, cosSim: +cosSim.toFixed(3), proj: +proj.toFixed(3), phase: 'run',
        log: `夹角 θ=**${deg}°**：a·b = |a||b|cosθ = ${MAG_A}×${MAG_B}×${Math.cos(r).toFixed(2)} = **${dot.toFixed(2)}**，` +
          `余弦相似度 = ${cosSim.toFixed(2)}。**${tag}**。（内积也 = |a| × b 在 a 上的投影 ${proj.toFixed(2)}）`,
      })
    })

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `θ 从 0°转到 180°:内积 6→4.24→**0**(正交)→−4.24→−6，余弦 1→0→−1。` +
        `内积 a·b=|a||b|cosθ,长度固定时它就纯粹量"方向多一致":同向最大、正交为 0、反向最负。这就是**注意力用 Q·K 打分**的根据——` +
        `query 与 key 越方向一致(相关)内积越大、softmax 权重越高;无关方向内积≈0(接「高维近正交」)。检索、推荐、词向量类比全靠它。`,
    })

    const base0: Frame = {
      step: -1, angleDeg: -1, ax, ay, bx: MAG_B, by: 0, dot: MAG_A * MAG_B, magA: MAG_A, magB: MAG_B, cosSim: 1, proj: MAG_B, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '夹角 θ' },
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
