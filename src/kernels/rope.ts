/**
 * 内核：旋转位置编码 RoPE（Transformer 与 LLM 原理）
 * 轴：step —— 逐个位置 p：把一对维度当成 2D 向量，按 p·θ 旋转，看模长不变、夹角随位置线性长
 *
 * 注意力本身不带位置信息（打乱词序结果一样）。RoPE 的招数：把每一对相邻维度 (x₂ᵢ, x₂ᵢ₊₁)
 * 当成平面上的一个 2D 向量，按「位置 × 频率」的角度**旋转**。旋转不改模长，只改方向。
 * 妙处：位置 m 的 query 和位置 n 的 key 各自旋转后做点积，结果只依赖**夹角差 = (m−n)·θ** ——
 * 也就是只和**相对位置**有关，与绝对位置无关。这正是模型泛化到更长上下文的关键。
 * 真实 RoPE 给每对维度一个不同的频率 θᵢ = base^(−2i/d)：转得快的编码精细位置、转得慢的编码粗位置。
 *
 * 值全部现算：模长恒为 1（旋转保范），与位置 0 的点积 = cos(p·θ)，可核对。状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type RopeState = {
  i: number
  thetaDeg: number         // 本演示这对维度的旋转步角（度）
  pos: number              // 当前位置
  angleDeg: number         // p·θ（累计旋转角，度）
  x: number                // 旋转后向量 x = cos(angle)
  y: number                // 旋转后向量 y = sin(angle)
  norm: number             // 模长（应恒为 1）
  dotWith0: number         // 与位置 0 向量的点积 = cos(p·θ)
  trail: { pos: number; x: number; y: number }[]  // 走过的位置轨迹
  phase: 'rotate' | 'done'
  log: string
}

export const ROPE_VISIBLE = [
  'i', 'thetaDeg', 'pos', 'angleDeg', 'x', 'y', 'norm', 'dotWith0', 'trail', 'phase', 'log',
] as const

type Frame = Omit<RopeState, 'i'>

const r3 = (x: number) => Math.round(x * 1000) / 1000

export const ropeKernel: Kernel<RopeState> = {
  kind: 'rope',

  compile(doc: SimDocument): CompiledModel<RopeState> {
    const thetaDeg = Math.max(10, Math.min(90, num(doc.params, 'theta') || 45))
    const N = 8
    const th = (thetaDeg * Math.PI) / 180

    const frames: Frame[] = []
    const trail: { pos: number; x: number; y: number }[] = []

    for (let p = 0; p < N; p++) {
      const ang = p * th
      const x = Math.cos(ang), y = Math.sin(ang)
      const norm = Math.sqrt(x * x + y * y)
      const dot0 = Math.cos(ang)  // (x,y)·(1,0) = x = cos(ang)
      trail.push({ pos: p, x: r3(x), y: r3(y) })
      frames.push({
        thetaDeg, pos: p, angleDeg: (p * thetaDeg) % 360,
        x: r3(x), y: r3(y), norm: r3(norm), dotWith0: r3(dot0),
        trail: trail.map(t => ({ ...t })), phase: 'rotate',
        log: `位置 ${p}：向量转到 ${(p * thetaDeg) % 360}°，坐标 (${r3(x)}, ${r3(y)})。` +
          `模长 = **${r3(norm)}**（旋转不改模长）。与位置 0 的点积 = cos(${p}·${thetaDeg}°) = **${r3(dot0)}** —— 只看相对位置差。`,
      })
    }

    const lastX = frames[N - 1].x, lastY = frames[N - 1].y
    frames.push({
      thetaDeg, pos: N - 1, angleDeg: ((N - 1) * thetaDeg) % 360,
      x: lastX, y: lastY, norm: 1, dotWith0: frames[N - 1].dotWith0,
      trail: trail.map(t => ({ ...t })), phase: 'done',
      log: `每个位置把向量多转 ${thetaDeg}°，**模长始终 = 1**（旋转保范，不像"加"位置编码会改变大小）。` +
        `位置 m 的 query 与位置 n 的 key 点积只依赖 (m−n)·θ —— **只和相对位置有关**。真实 RoPE 给每对维度不同频率：快的编精细位置、慢的编粗位置。`,
    })

    const base0: Frame = {
      thetaDeg, pos: -1, angleDeg: 0, x: 1, y: 0, norm: 1, dotWith0: 1,
      trail: [], phase: 'rotate', log: '',
    }

    return {
      axis: { kind: 'step', label: '位置' },
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
