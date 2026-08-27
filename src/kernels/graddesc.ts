/**
 * 内核：梯度下降（机器学习基础 · 原理：模型到底怎么"学"）
 * 轴：step —— 在一个碗形损失面上，顺着梯度反方向一步步走到谷底
 *
 * 梯度下降：想最小化损失 L(θ)，就沿**负梯度**方向更新参数 θ ← θ − lr·∇L。梯度指向上升最快的方向，
 * 取负号就朝下降最快走；学习率 lr 控制步长。反复走，损失单调下降、逼近最低点。这**就是**所有神经网络
 * "训练"的核心——从随机权重出发，靠梯度把损失一点点降下去。
 *
 * 本实验用一个碗形损失 L(x,y) = x² + 5y²(在 y 方向更陡=病态一点)，从 (4,4) 出发、lr=0.14：
 * 梯度 ∇L=(2x, 10y)。你会看到损失 96→21→6→2.6→1.2…单调下降逼近 0；而 y 方向因为更陡，
 * 步子容易迈过头、**来回震荡**(4→−1.6→0.64…)——这就是学习率与曲率(条件数)的博弈,太大就发散、太小就慢。
 * 值全部现算、可核对(每步 θ−lr·∇L、损失单调降)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const A = 1, B = 5          // L = A·x² + B·y²
const LR = 0.14
const X0 = 4, Y0 = 4
const STEPS = 8

export type GradDescState = {
  i: number
  step: number
  x: number
  y: number
  loss: number
  gx: number
  gy: number
  lr: number
  path: { x: number; y: number }[]
  phase: 'run' | 'done'
  log: string
}

export const GRADDESC_VISIBLE = [
  'step', 'x', 'y', 'loss', 'gx', 'gy', 'lr', 'path', 'phase', 'log',
] as const

type Frame = Omit<GradDescState, 'i'>

const L = (x: number, y: number) => A * x * x + B * y * y

export const graddescKernel: Kernel<GradDescState> = {
  kind: 'graddesc',

  compile(_doc: SimDocument): CompiledModel<GradDescState> {
    const frames: Frame[] = []
    let x = X0, y = Y0
    const path: { x: number; y: number }[] = [{ x, y }]

    for (let step = 0; step <= STEPS; step++) {
      const loss = L(x, y)
      const gx = 2 * A * x, gy = 2 * B * y
      frames.push({
        step, x: +x.toFixed(3), y: +y.toFixed(3), loss: +loss.toFixed(3), gx: +gx.toFixed(3), gy: +gy.toFixed(3), lr: LR,
        path: path.map(p => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) })), phase: 'run',
        log: `第 ${step} 步：位置 (${x.toFixed(2)}, ${y.toFixed(2)})，损失 **${loss.toFixed(2)}**。` +
          `梯度 ∇L=(${gx.toFixed(1)}, ${gy.toFixed(1)})，沿负梯度走 lr=${LR}：新位置 (${(x - LR * gx).toFixed(2)}, ${(y - LR * gy).toFixed(2)})。` +
          (Math.abs(y) > 0.3 ? ` y 方向更陡、步子迈过头，正负来回震荡。` : ``),
      })
      x = x - LR * gx
      y = y - LR * gy
      path.push({ x, y })
    }

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `${STEPS} 步梯度下降：损失从 ${L(X0, Y0).toFixed(0)} 一路单调降到 **${lf.loss}**，逼近谷底 (0,0)。` +
        `这就是神经网络"训练"的核心——沿负梯度 θ←θ−lr·∇L 把损失降下去。注意 y 方向更陡(曲率大)，` +
        `步子容易迈过头来回震荡:学习率与曲率(条件数)的博弈——太大发散、太小太慢。这也接上「条件数」那条。`,
    })

    const base0: Frame = {
      step: -1, x: X0, y: Y0, loss: L(X0, Y0), gx: 0, gy: 0, lr: LR, path: [{ x: X0, y: Y0 }], phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '迭代步' },
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
