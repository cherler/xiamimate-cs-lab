/**
 * 内核：生成对抗网络 GAN（深度学习算法 · 原理：造假的和验假的互相较劲,把假数据逼到和真数据难分)
 * 轴：step —— 两个网络对抗:**生成器 G** 造假数据想骗过审查、**判别器 D** 学着分辨真假。
 *      G 越造越像、D 越审越严,你追我赶;最终 G 的假数据和真数据**难分难解**,D 只能瞎猜(准确率→50%)——G 学会了生成。
 *
 * 怎么让 AI 生成逼真的数据?GAN 用一个绝妙的**对抗博弈**:一个**生成器 G** 负责造假(从随机噪声生成数据),一个**判别器 D**
 * 负责鉴定(判一个样本是真数据还是 G 造的假)。两者对着干:G 的目标是**骗过 D**、D 的目标是**抓住 G**。训练就让它们轮流进步——
 * D 抓得越准,G 就被迫造得越像;G 造得越像,D 又得学得更精。这场军备竞赛的**纳什均衡**是:G 造的假数据和真数据分布一模一样,
 * D 再也分不出来、准确率掉到 **50%**(等于瞎猜)。这时 G 就学会了生成以假乱真的数据。
 *
 * 本实验:真数据聚在一处(蓝),G 造的假数据(红)一开始乱撒、D 一眼看穿(准确率高);随训练,假数据逐轮**逼近**真数据分布,
 * D 越来越难分,准确率从 100% 掉到 **50%**。每轮准确率=(真判真+假判假)/总,可手算。GAN 是早期图像生成的里程碑(人脸/风格迁移),和扩散模型同属生成模型——AI 求职热点。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const REAL: [number, number][] = [[0.65, 0.42], [0.78, 0.44], [0.72, 0.56], [0.67, 0.5], [0.81, 0.52], [0.7, 0.61]]
const FAKE0: [number, number][] = [[0.2, 0.75], [0.35, 0.2], [0.14, 0.46], [0.42, 0.86], [0.26, 0.56], [0.46, 0.24]]
const FAKE1: [number, number][] = [[0.7, 0.47], [0.76, 0.53], [0.68, 0.57], [0.74, 0.45], [0.71, 0.53], [0.79, 0.49]]
const CENTER: [number, number] = [0.72, 0.5]
const RAD = 0.17
const ROUNDS = 4
const inside = (p: [number, number]) => Math.hypot(p[0] - CENTER[0], p[1] - CENTER[1]) < RAD
const lerp = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

export type GanState = {
  i: number
  step: number
  real: [number, number][]
  fake: [number, number][]
  center: [number, number]; rad: number
  round: number
  fakeInside: number           // 假数据落进真数据区的个数（=骗过 D 的）
  acc: number                  // D 准确率 %
  phase: 'run' | 'done'
  log: string
}

export const GAN_VISIBLE = ['step', 'real', 'fake', 'center', 'rad', 'round', 'fakeInside', 'acc', 'phase', 'log'] as const
type Frame = Omit<GanState, 'i'>

export const ganKernel: Kernel<GanState> = {
  kind: 'gan',
  compile(_doc: SimDocument): CompiledModel<GanState> {
    const frames: Frame[] = []
    for (let t = 0; t <= ROUNDS; t++) {
      const fake = FAKE0.map((f, k) => lerp(f, FAKE1[k], t / ROUNDS))
      const ins = fake.filter(inside).length
      const acc = Math.round((REAL.length + (fake.length - ins)) / (REAL.length + fake.length) * 100)
      const done = t === ROUNDS
      frames.push({
        step: t, real: REAL, fake, center: CENTER, rad: RAD, round: t, fakeInside: ins, acc, phase: done ? 'done' : 'run',
        log: t === 0
          ? `真数据(蓝)聚在一处。G 造的假数据(红)一开始**乱撒**,D 一眼看穿——D 准确率 **${acc}%**。接下来 G 学着骗、D 学着分,轮流进步。`
          : done
            ? `**对抗均衡**:G 造的假数据和真数据**难分难解**,D 再也分不出、准确率掉到 **${acc}%**(=瞎猜)——G 学会了生成以假乱真的数据。` +
              `GAN=生成器 G(造假骗 D)+ 判别器 D(鉴真假)互相较劲,均衡处 G 的假分布=真分布。早期图像生成里程碑(人脸/风格迁移),和扩散模型同属生成模型。`
            : `第 ${t} 轮:G 造得更像了,${ins}/6 个假数据混进了真数据区、骗过了 D;D 准确率掉到 **${acc}%**=(6 真判真+${fake.length - ins} 假判假)/12。`,
      })
    }
    const base0: Frame = { step: -1, real: REAL, fake: FAKE0, center: CENTER, rad: RAD, round: 0, fakeInside: 0, acc: 100, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '对抗轮' },
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
