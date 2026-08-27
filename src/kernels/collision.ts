/**
 * 内核：弹性碰撞沙盘（物理·力学 · 原理：碰撞里动能/动量在物体间转移,但总量守恒)
 * 这是一个**实时仿真**实验:舞台里跑的是开源 2D 物理引擎 Matter.js(而不是预先算好的逐帧轨迹),
 * 小球在盒子里弹性碰撞、可拖拽、可加球、可开关重力。内核只提供导览面板需要的两个状态(初始/运行),
 * 真正的物理由引擎实时求解;守恒律(总动能、总动量)在读数里实时显示——碰撞再乱,总量基本不变。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type CollisionState = {
  i: number
  step: number
  phase: 'init' | 'run'
  n: number
  ke: number                   // 总动能（示意初值，实时值在舞台里）
  log: string
}

export const COLLISION_VISIBLE = ['step', 'phase', 'n', 'ke', 'log'] as const

type Frame = Omit<CollisionState, 'i'>

export const collisionKernel: Kernel<CollisionState> = {
  kind: 'collision',

  compile(_doc: SimDocument): CompiledModel<CollisionState> {
    const frames: Frame[] = [
      { step: 0, phase: 'init', n: 6, ke: 100, log: '起点:6 个小球带着一定的**总动能**出发,盒子四壁反弹、球与球弹性碰撞。总动能、总动量此刻是初值。' },
      { step: 1, phase: 'run', n: 6, ke: 100, log: '碰撞进行中:每次碰撞把动能/动量在两球之间**转移**——有的加速、有的减速,但把所有球加起来,**总动能守恒、总动量守恒**(弹性碰撞、无摩擦时)。这就是仿真里"乱中有恒"的守恒律。' },
    ]
    const base0: Frame = { step: -1, phase: 'init', n: 6, ke: 100, log: '' }
    return {
      axis: { kind: 'step', label: '仿真' },
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
