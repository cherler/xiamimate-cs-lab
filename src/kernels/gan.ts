/**
 * 内核：生成对抗网络 GAN（深度学习算法）
 * 轴：对抗轮 —— 两个网络的**博弈**：生成器 G 造假想骗过判别器 D、D 学着分辨真假。轮流更新（最佳响应）：
 *   ①**D 更新**：给定当前真/假两堆点，D 学出**最优判别边界**（到两个质心等距的那条线），把靠真质心的一侧判"真"。
 *   ②**G 更新**：G 把假簇朝"能骗过 D"的方向挪一步。
 * 你追我赶：G 越挪越像、D 边界跟着调；当假分布**追上**真分布，D 再也分不开、准确率掉到 **50%**（=瞎猜）。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 上一轮已经把 **D** 做成真的（每轮从两堆点算出边界、准确率是算出来的）。但 **G 还是假的**：
 * 它的簇心轨迹是一个写死的数组 `MU`，"每轮朝真质心挪、最后一轮正好追上" —— 是**排好的动画**，
 * 不是对 D 的响应。于是这个实验只能演"GAN 成功收敛"，而 GAN 在实践里出名的恰恰是**它多难训**。
 *
 * 这一轮把 G 也做成真的，并补上两条**只有真博弈才会出现**的东西：
 *
 *   · **模式崩溃（mode collapse）** —— GAN 最著名的失败。真数据有**两团**时，
 *     G 只是一个簇，它会**扑向离自己最近的那一团、彻底忽略另一团**。
 *     D 的准确率照样能掉到 50% 左右（因为它是条直线、分不开），
 *     **"D 分不出来"于是并不等于"G 学会了"** —— 屏幕上因此多了一个**覆盖率**：
 *     G 到底盖住了几个真模式。少了这一项，模式崩溃看起来跟成功一模一样。
 *   · **步长不是越大越好** —— G 每轮朝目标挪 η 比例。η 小了追不上（轮数用光还在半路），
 *     η 大了会**冲过头来回震荡**。这跟「梯度下降」那一屏是同一件事，只不过这里两边都在动。
 *
 * G 的更新是**算出来**的：朝"D 判真那一侧的中心"走 η 步（对当前 D 的最佳响应方向）。
 * 每一轮的准确率、覆盖率都能手算核对。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type P = [number, number]

//  真数据：一团 / 两团（两团那档专门用来演模式崩溃）
const CLUSTER_A: P[] = [[0.65, 0.42], [0.78, 0.44], [0.72, 0.56], [0.67, 0.5], [0.81, 0.52], [0.7, 0.61]]
const CLUSTER_B: P[] = [[0.18, 0.72], [0.26, 0.8], [0.14, 0.84], [0.22, 0.68], [0.3, 0.78], [0.2, 0.76]]
//  假簇是个刚性小簇（偏移和≈0，质心=μ_G）
const FAKE_OFF: P[] = [[-0.1, 0.07], [0.09, -0.08], [-0.05, -0.03], [0.07, 0.09], [0.04, -0.07], [-0.05, 0.02]]
const MU0: P = [0.3, 0.63]              // G 的起点
const ROUNDS = 12

const dist2 = (a: P, b: P) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
const centroid = (ps: P[]): P => [
  +(ps.reduce((a, p) => a + p[0], 0) / ps.length).toFixed(4),
  +(ps.reduce((a, p) => a + p[1], 0) / ps.length).toFixed(4),
]

export type GanState = {
  i: number
  round: number
  rounds: number
  real: P[]
  fake: P[]
  cReal: P
  muG: P
  fooled: boolean[]
  acc: number
  accCurve: { r: number; acc: number }[]
  //  ── 补厚 ──
  modes: P[]                 // 各个真模式的中心（一团档只有一个）
  covered: boolean[]         // G 盖住了哪几个模式
  coverage: number           // 盖住几个 / 共几个
  collapsed: boolean         // 有多个模式却只盖住一个 = 模式崩溃
  eta: number                // G 每轮追的比例
  dataTag: string
  oscillating: boolean       // μ_G 在来回震荡（步长太大）
  muTrail: P[]               // μ_G 走过的路
  phase: 'run' | 'done'
  log: string
}

export const GAN_VISIBLE = [
  'round', 'rounds', 'real', 'fake', 'cReal', 'muG', 'fooled', 'acc', 'accCurve',
  'modes', 'covered', 'coverage', 'collapsed', 'eta', 'dataTag', 'oscillating', 'muTrail', 'phase', 'log',
] as const
type Frame = Omit<GanState, 'i'>

/*  D 的判别：点离**任一真模式**比离假簇近 → 判"真"。

    ⚠️ 这里用的是"到最近的真模式"，不是"到全体真数据的总质心"。这一处**改过一次**：
    第一版用总质心，结果两团那档 G 追的是**两团中间的空地**，覆盖 0/2 ——
    那演的是"生成模糊平均"，不是**模式崩溃**（mode collapse 是扑向其中一个模式）。
    真实的 D 学到的是真数据的**支撑集**（两团它都认），所以 G 往任一团走都能骗过它，
    于是它会扑向**离自己最近的那一团**、彻底忽略另一团 —— 这才是模式崩溃。
    换句话说：G 崩到哪一团是**几何决定的**，不是我摆的。 */
function judge(real: P[], fake: P[], modes: P[], muG: P): { acc: number; fooled: boolean[] } {
  const dReal = (p: P) => Math.min(...modes.map(m => dist2(p, m)))
  /*  ⚠️ 这里的 D 是**「最近质心」这条固定规则**，不是理论上的最优判别器。
      差别在收敛处会露出来：两个分布几乎重合时，它还在硬按一条线切，
      于是会把一部分真点判成假、一部分假点判成真 —— 实测能掉到 **42%**，**比瞎猜还低**。
      理论最优的 D 此时应当处处输出 0.5、准确率正好 50%（它不会做得比瞎猜差）。
      这个差距**不抹平**：它本身就说明"D 准确率掉到 50%"这句话讲的是**最优 D**，
      而实现里的判别器只是一条具体规则。屏幕上会把这件事说出来。
      （只保留一个极小的平局容差，避免恰好相等时的浮点抖动。） */
  const TIE = 1e-6
  const isReal = (p: P) => {
    const dr = dReal(p), df = dist2(p, muG)
    if (Math.abs(dr - df) <= TIE) return 0.5
    return dr < df ? 1 : 0
  }
  let correct = 0
  for (const p of real) correct += isReal(p)
  const fooled = fake.map(p => dReal(p) <= dist2(p, muG))
  for (const p of fake) correct += 1 - isReal(p)
  return { acc: Math.round(correct / (real.length + fake.length) * 100), fooled }
}

export const ganKernel: Kernel<GanState> = {
  kind: 'gan',
  compile(doc: SimDocument): CompiledModel<GanState> {
    const dataTag = doc.params.data === undefined ? '一团' : str(doc.params, 'data')
    const eta = (doc.params.eta === undefined ? 40 : num(doc.params, 'eta')) / 100
    const twoModes = dataTag.startsWith('两团')
    const REAL: P[] = twoModes ? [...CLUSTER_A, ...CLUSTER_B] : CLUSTER_A
    const modes: P[] = twoModes ? [centroid(CLUSTER_A), centroid(CLUSTER_B)] : [centroid(CLUSTER_A)]
    const C_REAL = centroid(REAL)

    /*  ⚠️ G 的更新**算出来**，不再是写死的轨迹。
        对当前的 D，G 的最佳响应是往"D 判真的地方"走 —— 也就是朝**离自己最近的那个真模式**，
        步长 η。这一步是这次补厚的关键：G 一旦真的在追，
        **两团数据下它会扑向哪一团就不由我说了算**，而是由起点和几何决定
        —— 模式崩溃因此是**跑出来的**，不是摆出来的。 */
    const nearestMode = (mu: P): P => modes.reduce((best, m) => (dist2(mu, m) < dist2(mu, best) ? m : best), modes[0])
    const mus: P[] = [MU0]
    for (let r = 1; r <= ROUNDS; r++) {
      const m = mus[r - 1]
      const tgt = nearestMode(m)
      mus.push([
        +(m[0] + eta * (tgt[0] - m[0])).toFixed(4),
        +(m[1] + eta * (tgt[1] - m[1])).toFixed(4),
      ])
    }

    //  覆盖：G 的簇心离某个真模式足够近，就算盖住了它
    const COVER_R = 0.18
    const coverOf = (mu: P) => modes.map(m => Math.sqrt(dist2(mu, m)) <= COVER_R)

    const fakeAt = (mu: P): P[] => FAKE_OFF.map(o => [+(mu[0] + o[0]).toFixed(3), +(mu[1] + o[1]).toFixed(3)] as P)
    const fullCurve = mus.map((mu, r) => ({ r, acc: judge(REAL, fakeAt(mu), modes, mu).acc }))

    const frames: Frame[] = mus.map((mu, r) => {
      const fake = fakeAt(mu)
      const { acc, fooled } = judge(REAL, fake, modes, mu)
      const covered = coverOf(mu)
      const coverage = covered.filter(Boolean).length
      const done = r === ROUNDS
      const collapsed = done && modes.length > 1 && coverage < modes.length
      //  震荡：最后几轮 μ_G 还在两侧来回跨过 C_REAL
      const oscillating = r >= 3 && mus.slice(Math.max(1, r - 3), r + 1)
        .some((m, k, arr) => k > 0 && (m[0] - C_REAL[0]) * (arr[k - 1][0] - C_REAL[0]) < 0)
      const nf = fooled.filter(Boolean).length
      const d2mode = modes.map(m => Math.sqrt(dist2(mu, m)).toFixed(2))

      const log = r === 0
        ? `真数据（蓝）${twoModes ? `分成**两团**，质心分别在 (${modes[0].join(',')}) 和 (${modes[1].join(',')})` : `聚在一处、质心 (${C_REAL.join(',')})`}。`
          + `G 造的假数据（红）一开始撒在 (${mu.join(',')})，D 学出判别边界一眼看穿 —— 准确率 **${acc}%**。`
        : done
          ? (collapsed
            ? `**模式崩溃了。** D 的准确率掉到 **${acc}%**，看着像收敛了 —— 可 G 只是一个簇，`
              + `它扑向了离自己近的那一团，**另一团一个点都没生成**（到两团的距离 ${d2mode.join(' / ')}，`
              + `覆盖 **${coverage}/${modes.length}**）。`
              + `　⚠️ **"D 分不出来"不等于"G 学会了"**：D 在这儿只是一条直线，它分不开不代表分布对上了。`
              + `这就是**模式崩溃**，也是 GAN 最出名的病 —— 光看判别器的准确率，你根本发现不了。`
              + `（真实训练里的对策：minibatch discrimination、unrolled GAN、多样性正则……都是在盯"覆盖"这件事。）`
            : `**纳什均衡**：G 的假簇追上了真数据，D 的边界再也分不开、准确率 **${acc}%**，`
              + `覆盖 **${coverage}/${modes.length}** 个模式 —— G 真的学会了。`
              + (acc < 50
                ? `　⚠️ 注意它**低于 50%**。理论最优的判别器在两个分布重合时会处处输出 0.5、`
                  + `拿正好 50%，**不会比瞎猜差**；而这一屏的 D 是「最近质心」这条**固定规则**，`
                  + `分布重合之后它还在硬按一条线切，于是真点假点各错一半、掉到了 50% 以下。`
                  + `　这个差别值得记住：**"D 准确率掉到 50%"说的是最优判别器**，`
                  + `真实训练里的 D 也是个具体网络，它的曲线同样会毛毛躁躁地穿过 50%。`
                : ``)
              + (twoModes ? '' : `　⚠️ 但真数据只有一团时，"覆盖"这件事根本考不出来。`
                + `把「真数据」换成**两团**再跑一遍 —— 同样的算法会演出完全不同的结局。`))
          : `第 ${r} 轮 · **D** 重画边界、**G** 朝 D 判真的那侧挪 ${(eta * 100).toFixed(0)}%：`
            + `${nf}/${fake.length} 个假点钻过边界骗过了 D，准确率 **${acc}%**。`
            + `　G 到${modes.length > 1 ? '两团' : '真数据'}的距离 ${d2mode.join(' / ')}，覆盖 ${coverage}/${modes.length}。`
            + (oscillating ? `　⚠️ μ_G 正在**来回跨过**目标 —— 步长太大，冲过头了。` : '')

      return {
        round: r, rounds: ROUNDS, real: REAL, fake, cReal: C_REAL,
        muG: [+mu[0].toFixed(3), +mu[1].toFixed(3)], fooled, acc,
        accCurve: fullCurve.slice(0, r + 1),
        modes, covered, coverage, collapsed, eta, dataTag, oscillating,
        muTrail: mus.slice(0, r + 1).map(m => [+m[0].toFixed(3), +m[1].toFixed(3)] as P),
        phase: done ? 'done' : 'run', log,
      }
    })

    const base0: Frame = {
      round: -1, rounds: ROUNDS, real: REAL, fake: [], cReal: C_REAL, muG: MU0, fooled: [], acc: 100,
      accCurve: [], modes, covered: modes.map(() => false), coverage: 0, collapsed: false,
      eta, dataTag, oscillating: false, muTrail: [], phase: 'run', log: '',
    }
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
