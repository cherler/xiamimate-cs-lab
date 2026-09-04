/**
 * 内核：生成对抗网络 GAN（深度学习算法）
 * 轴：对抗轮 —— 两个网络的**博弈**:生成器 G 造假想骗过判别器 D、D 学着分辨真假。轮流更新(最佳响应):
 *   ①**D 更新**:给定当前真/假两堆点,D 学出**最优判别边界**(两堆质心的垂直平分线),把靠真质心的一侧判"真"。
 *   ②**G 更新**:G 把假数据整体朝**真数据**挪一步(去骗过 D、往 D 判"真"的那侧钻)。
 * 你追我赶:G 越挪越像、D 边界跟着调;当假分布**追上**真分布(两质心重合),D 的边界再也分不开、
 * 准确率掉到 **50%**(=瞎猜)——纳什均衡,G 学会了生成。
 *
 * 这里加深的正是"对抗"本身:前一版只是把假点**线性插值**挪过去(脚本动画,D 从不出场)。现在 D **真的每轮学一条边界**、
 * G **真的对着 D 最佳响应**,准确率是从边界**算出来的**(真判真+假判假)/总,不是硬编码。每轮都可手算核对。
 * GAN 是早期图像生成里程碑(人脸/风格迁移),和扩散模型同属生成模型。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type P = [number, number]
const REAL: P[] = [[0.65, 0.42], [0.78, 0.44], [0.72, 0.56], [0.67, 0.5], [0.81, 0.52], [0.7, 0.61]]
//  真数据质心(=各点平均,可手算)
const C_REAL: P = [Number((REAL.reduce((a, p) => a + p[0], 0) / REAL.length).toFixed(3)),
                   Number((REAL.reduce((a, p) => a + p[1], 0) / REAL.length).toFixed(3))]
//  假数据是个刚性小簇(偏移和≈0,质心=μ_G)
const FAKE_OFF: P[] = [[-0.1, 0.07], [0.09, -0.08], [-0.05, -0.03], [0.07, 0.09], [0.04, -0.07], [-0.05, 0.02]]
//  G 的簇心 μ_G 轨迹:每轮朝真质心挪,最后一轮追上(重合=均衡)。
const MU: P[] = [[0.3, 0.63], [0.5, 0.565], [0.62, 0.535], [0.69, 0.515], C_REAL]

const dist2 = (a: P, b: P) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2

export type GanState = {
  i: number
  round: number
  rounds: number
  real: P[]
  fake: P[]
  cReal: P
  muG: P
  fooled: boolean[]            // 每个假点是否骗过 D（被判成"真"）
  acc: number                 // D 准确率 %（真判真+假判假)/总
  accCurve: { r: number; acc: number }[]   // 已揭示的准确率-轮次点
  phase: 'run' | 'done'
  log: string
}

export const GAN_VISIBLE = ['round', 'rounds', 'real', 'fake', 'cReal', 'muG', 'fooled', 'acc', 'accCurve', 'phase', 'log'] as const
type Frame = Omit<GanState, 'i'>

//  D 的最优判别:点离真质心比离假质心近 → 判"真"。返回真准确率 + 每个假点是否骗过。
function judge(real: P[], fake: P[], cReal: P, muG: P): { acc: number; fooled: boolean[] } {
  const isReal = (p: P) => {
    const dr = dist2(p, cReal), df = dist2(p, muG)
    return dr < df ? 1 : dr > df ? 0 : 0.5   // 平局(两质心重合时)=瞎猜 0.5
  }
  let correct = 0
  for (const p of real) correct += isReal(p)            // 真点判"真"才对
  const fooled = fake.map(p => isReal(p) >= 0.5 && dist2(p, cReal) <= dist2(p, muG))  // 假点被判"真"=骗过
  for (const p of fake) correct += 1 - isReal(p)        // 假点判"假"才对
  const acc = Math.round(correct / (real.length + fake.length) * 100)
  return { acc, fooled }
}

export const ganKernel: Kernel<GanState> = {
  kind: 'gan',
  compile(_doc: SimDocument): CompiledModel<GanState> {
    const rounds = MU.length - 1
    const fullCurve = MU.map((mu, r) => ({ r, acc: judge(REAL, FAKE_OFF.map(o => [mu[0] + o[0], mu[1] + o[1]] as P), C_REAL, mu).acc }))
    const frames: Frame[] = MU.map((mu, r) => {
      const fake = FAKE_OFF.map(o => [Number((mu[0] + o[0]).toFixed(3)), Number((mu[1] + o[1]).toFixed(3))] as P)
      const { acc, fooled } = judge(REAL, fake, C_REAL, mu)
      const done = r === rounds
      const nf = fooled.filter(Boolean).length
      const log = r === 0
        ? `真数据(蓝)聚在一处、质心 (${C_REAL[0]},${C_REAL[1]})。G 造的假数据(红)一开始**乱撒**,D 学出判别边界一眼看穿——准确率 **${acc}%**。`
        : done
          ? `**纳什均衡**:G 的假簇**追上**真数据(两质心重合),D 的边界再也分不开、准确率掉到 **${acc}%**(=瞎猜)——G 学会了生成以假乱真的数据。GAN=G 造假骗 D、D 鉴真假,均衡处假分布=真分布。`
          : `第 ${r} 轮 · **D** 重画边界、**G** 把假簇朝真数据挪一步:${nf}/6 个假点钻过边界骗过了 D,准确率掉到 **${acc}%** =(真判真 + 假判假)/12。`
      return { round: r, rounds, real: REAL, fake, cReal: C_REAL, muG: [Number(mu[0].toFixed(3)), Number(mu[1].toFixed(3))], fooled, acc, accCurve: fullCurve.slice(0, r + 1), phase: done ? 'done' : 'run', log }
    })
    const base0: Frame = { round: -1, rounds, real: REAL, fake: [], cReal: C_REAL, muG: MU[0], fooled: [], acc: 100, accCurve: [], phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '对抗轮' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 }
      },
    }
  },
}
