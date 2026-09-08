/**
 * 内核：梯度下降（机器学习基础 · 原理：模型到底怎么"学"）
 * 轴：step —— 在一个碗形损失面上，顺着梯度反方向一步步走到谷底
 *
 * 梯度下降：想最小化损失 L(θ)，就沿**负梯度**方向更新 θ ← θ − lr·∇L。梯度指向上升最快的方向，
 * 取负号就朝下降最快走；学习率 lr 控制步长。这**就是**所有神经网络"训练"的核心。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本写死 L=x²+5y²、lr=0.14、走 8 步，结语里却写着一整套结论：
 * 「太大就发散、太小就慢」「学习率与曲率(条件数)的博弈」。**屏幕上一样都看不见** ——
 * 只有一条固定的路，既不会发散也不会慢，"博弈"无从谈起。
 *
 * 补厚补的是**三个旋钮 + 一个理论速率**：
 *   · **谷的形状 κ**（1 / 5 / 50）—— 条件数。κ=1 是正圆碗，一步就能指着谷底；
 *     κ=50 是又长又窄的峡谷，负梯度**几乎垂直于谷底方向**，只能来回横跳着往前蹭。
 *   · **步长**按「占稳定上限的百分之几」给，而不是给一个绝对数。上限 lrMax=1/κ 是**算出来**的
 *     （y 方向的迭代因子 |1−2κ·lr| 要小于 1）。于是同一组档位在三种谷上都成立：
 *     10% 慢得看得见、最优档最快、**100% 恰好在临界**（永远等幅震荡、一步也不收敛）、110% 发散。
 *   · **动量 β** —— 这是"峡谷"唯一说得清的解药。理论上普通 GD 的收缩率是 (κ−1)/(κ+1)，
 *     配套调好的重球法是 (√κ−1)/(√κ+1)：**κ 开了平方根**。
 *
 * ⚠️ 两处"我差点按印象写错、被实测扫出来"的地方，记在这儿免得下次再写一遍：
 *   ① **动量不是拧上去就更快**。β=90% 配着普通 GD 的步长跑，在圆碗和椭圆上**反而更慢**
 *      （椭圆最优步长：β=0 第 6 步就降到 1%，β=90% 拖到第 18 步）。快的是**配套调好的一对**
 *      (lr*, β*)，不是单拧一个 β —— 所以"最优"那一档会把步长一起改掉，并在屏幕上写明。
 *   ② **公式步长在这个玩具上不是最快的**，而公式没错。2/(λmin+λmax) 求的是**整段谱**上的
 *      最坏情况最优；这里只有两个曲率，于是 lr=1/λmax 能把陡的那一模**一步清零**（实测：
 *      峡谷上"上限的 50%"第 17 步到 1%，"公式值"36 步还没到）。真问题的曲率是连成一片的，
 *      没有这种巧劲 —— 这个反差本身就值得看。公式该被信任的是**收缩率**：公式档实测每步
 *      收缩 0.9608，理论 (κ−1)/(κ+1)=0.9608，一位不差。
 *
 * 所有理论值都在这里现算，再跟**实测收缩率**（损失比的几何平均）并排摆出来核对。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const A = 1                 // L = A·x² + B·y²，固定 A=1，让 B 直接就是条件数 κ
const X0 = 4, Y0 = 4
const STEPS = 36

const SHAPES: Record<string, number> = {
  '圆碗 κ=1': 1,
  '椭圆 κ=5': 5,
  '峡谷 κ=50': 50,
}

export type GradDescState = {
  i: number
  step: number
  x: number
  y: number
  loss: number
  gx: number
  gy: number
  lr: number
  vx: number; vy: number     // 动量项（速度）
  mom: number
  momTag: string
  tuned: boolean             // "最优"档：步长被连带换成重球法的配套值
  kappa: number
  lrMax: number              // 普通 GD 的稳定上限 = 1/κ（|1−2κ·lr|<1）
  lrMaxEff: number           // 加了动量之后的稳定上限 = (1+β)/κ —— 动量顺带放宽了可用步长
  lrOpt: number              // 最优步长 = 1/(A+κ)
  lrTag: string
  rateGd: number             // 理论收缩率（普通 GD、最优步长）= (κ−1)/(κ+1)
  rateMom: number            // 理论收缩率（最优动量）= (√κ−1)/(√κ+1)
  measRate: number           // 实测：每步损失比的几何平均（开平方到"参数尺度"）
  zig: number                // y 方向变号次数 —— 横跳的次数
  reach: number              // 走到损失 < 初始的 1% 用了几步（-1=没到）
  diverged: boolean
  path: { x: number; y: number }[]
  phase: 'run' | 'done'
  log: string
}

export const GRADDESC_VISIBLE = [
  'step', 'x', 'y', 'loss', 'gx', 'gy', 'lr', 'vx', 'vy', 'mom', 'momTag', 'tuned',
  'kappa', 'lrMax', 'lrMaxEff', 'lrOpt', 'lrTag', 'rateGd', 'rateMom', 'measRate', 'zig', 'reach', 'diverged', 'path', 'phase', 'log',
] as const

type Frame = Omit<GradDescState, 'i'>

export const graddescKernel: Kernel<GradDescState> = {
  kind: 'graddesc',

  compile(doc: SimDocument): CompiledModel<GradDescState> {
    const shape = doc.params.shape === undefined ? '椭圆 κ=5' : str(doc.params, 'shape')
    const B = SHAPES[shape] ?? 5
    const kappa = B / A
    const L = (x: number, y: number) => A * x * x + B * y * y

    //  ⚠️ 上限和最优都是**算出来**的，不是试出来的：
    //     沿 y 的迭代因子是 (1−2B·lr)，|·|<1 ⟺ lr < 1/B；
    //     两个方向的因子绝对值相等时最快，即 lr* = 1/(A+B)。
    const lrMax = 1 / B
    const lrOpt = 1 / (A + B)

    const lrTag = doc.params.lr === undefined ? '公式值 1/(λmin+λmax)' : str(doc.params, 'lr')
    const LR0 = lrTag === '公式值 1/(λmin+λmax)' ? lrOpt
      : lrTag === '很小（上限的 10%）' ? 0.1 * lrMax
        : lrTag === '一半（上限的 50%）' ? 0.5 * lrMax
          : lrTag === '临界（正好等于上限）' ? lrMax
            : 1.1 * lrMax                                   // 超限（上限的 110%）

    //  两条理论收缩率（每步参数缩小的倍数）——屏幕上要跟实测并排比
    const rateGd = (kappa - 1) / (kappa + 1)
    const rateMom = (Math.sqrt(kappa) - 1) / (Math.sqrt(kappa) + 1)

    /*  动量。⚠️ "最优"那一档会**连步长一起换掉** —— 因为重球法的最优是一**对**参数：
        β* = ((√λmax−√λmin)/(√λmax+√λmin))²、lr* = 4/(√λmax+√λmin)²，此时收缩率 = √β* = (√κ−1)/(√κ+1)。
        只拧 β、步长不动，实测反而更慢（见文件头 ①）。屏幕上会写明步长被一起改了。 */
    const LAM_MIN = 2 * A, LAM_MAX = 2 * B
    const betaOpt = ((Math.sqrt(LAM_MAX) - Math.sqrt(LAM_MIN)) / (Math.sqrt(LAM_MAX) + Math.sqrt(LAM_MIN))) ** 2
    const lrHb = 4 / (Math.sqrt(LAM_MAX) + Math.sqrt(LAM_MIN)) ** 2
    const momTag = doc.params.mom === undefined ? '0（普通梯度下降）' : str(doc.params, 'mom')
    const tuned = momTag === '最优（连步长一起配）'
    const mom = tuned ? betaOpt : momTag === '50%' ? 0.5 : momTag === '90%' ? 0.9 : 0
    const LR = tuned ? lrHb : LR0
    //  动量还顺带把**可用步长放宽**了：重球法的稳定区是 lr < 2(1+β)/λmax = (1+β)/B
    const lrMaxEff = (1 + mom) / B
    /*  ⚠️ "发散没发散"要用**解析判据**，不能拿"损失涨到某个阈值"来判：
        超限 110% 那一档 36 步之后损失才 4e8，用阈值判会被判成"没发散"，
        于是屏幕上弹出的是"卡在临界"那条横幅 —— 说的完全是另一回事。
        因子是已知的：β=0 时 |1−2κ·lr|>1 就发散；带动量时稳定区是 lr<(1+β)/κ。 */
    const unstable = LR > lrMaxEff + 1e-12
    const marginal = Math.abs(LR - lrMaxEff) <= 1e-12

    const frames: Frame[] = []
    let x = X0, y = Y0, vx = 0, vy = 0
    const path: { x: number; y: number }[] = [{ x, y }]
    const losses: number[] = []
    let zig = 0, reach = -1
    const diverged = unstable
    const L0 = L(X0, Y0)

    for (let step = 0; step <= STEPS; step++) {
      const loss = L(x, y)
      losses.push(loss)
      if (reach < 0 && loss < L0 * 0.01) reach = step

      const gx = 2 * A * x, gy = 2 * B * y
      //  实测收缩率：损失比的几何平均，再开根到"参数尺度"（损失是参数的平方）
      const meas = step > 0 && losses[0] > 0 && loss > 0 && Number.isFinite(loss)
        ? Math.sqrt((loss / losses[0]) ** (1 / step)) : NaN

      frames.push({
        step, x: +x.toFixed(4), y: +y.toFixed(4), loss: +loss.toFixed(4),
        gx: +gx.toFixed(3), gy: +gy.toFixed(3), lr: +LR.toFixed(4),
        vx: +vx.toFixed(4), vy: +vy.toFixed(4), mom: +mom.toFixed(4), momTag, tuned, kappa,
        lrMax: +lrMax.toFixed(4), lrMaxEff: +lrMaxEff.toFixed(4), lrOpt: +lrOpt.toFixed(4), lrTag,
        rateGd: +rateGd.toFixed(4), rateMom: +rateMom.toFixed(4),
        measRate: Number.isFinite(meas) ? +meas.toFixed(4) : 0,
        zig, reach, diverged,
        path: path.map(p => ({ x: +p.x.toFixed(4), y: +p.y.toFixed(4) })), phase: 'run',
        log: diverged
          ? `第 ${step} 步：损失 **${Number.isFinite(loss) ? loss.toExponential(1) : '∞'}** —— 已经炸了。`
            + `步长 ${(LR / lrMax * 100).toFixed(0)}% 越过上限，y 方向每步放大 |1−2κ·lr|=${Math.abs(1 - 2 * B * LR).toFixed(2)} 倍。`
          : `第 ${step} 步：位置 (${x.toFixed(3)}, ${y.toFixed(3)})，损失 **${loss.toFixed(3)}**。`
            + `梯度 ∇L=(${gx.toFixed(2)}, ${gy.toFixed(2)})`
            + (mom > 0 ? `，先攒动量 v←${mom}·v−lr·∇L，再按 v 走。` : `，沿负梯度走 lr=${LR.toFixed(3)}。`)
            + (Math.abs(1 - 2 * B * LR) > 0.999 ? `　y 方向的因子 |1−2κ·lr|=${Math.abs(1 - 2 * B * LR).toFixed(3)}，**等幅震荡、根本不收缩**。`
              : Math.abs(y) > 0.05 && zig >= 2 ? `　y 方向已横跳 ${zig} 次：谷太窄，负梯度几乎垂直于谷底方向。` : ``),
      })

      //  ── 走一步（动量=重球法；β=0 时退化成普通梯度下降）──
      const ny = y
      vx = mom * vx - LR * gx
      vy = mom * vy - LR * gy
      x = x + vx
      y = y + vy
      if (ny * y < 0) zig++
      path.push({ x, y })
      if (!Number.isFinite(loss) || loss > L0 * 1e12) break   // 真的爆掉了才提前收
    }

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done', zig, reach, diverged,
      log: diverged
        ? `**发散了。** 步长取到普通 GD 上限的 ${(LR / lrMax * 100).toFixed(0)}%，y 方向的迭代因子 |1−2κ·lr| = `
          + `**${Math.abs(1 - 2 * B * LR).toFixed(3)} > 1** —— 每步不是缩小而是放大，来回横跳着越跳越远。`
          + `　这个上限 lrMax=1/κ=${lrMax.toFixed(3)} 是**算出来**的，不用试：`
          + `沿 y 的更新是 y←(1−2κ·lr)·y，因子绝对值超过 1 就必炸。`
        : marginal
          ? `**卡在临界。** 步长正好等于上限 ${lrMax.toFixed(3)}，y 方向的因子恰好是 −1：`
            + `每步把 y 翻个号、**大小分毫不变**，${STEPS} 步下来 y 还是 ${Math.abs(lf.y).toFixed(2)}，`
            + `损失从 ${L0.toFixed(0)} 只降到 ${lf.loss}（降的全是 x 那一维）。`
            + `　"再多走几步总会到"在这儿不成立 —— 步长过界，走多久都没用。`
          : `${STEPS} 步走完：损失从 ${L0.toFixed(0)} 降到 **${lf.loss}**`
            + (reach >= 0 ? `，第 **${reach}** 步就降到了初始的 1% 以下。` : `，**始终没降到初始的 1% 以下**。`)
            + `　这个谷的条件数 κ=**${kappa}**：${kappa === 1 ? '正圆碗，负梯度直指谷底，一步到位（收缩率 0）。'
              : `长宽比 ${kappa}:1，负梯度并不指向谷底，y 方向横跳了 ${zig} 次。`}`
            + `　实测每步收缩 **${lf.measRate}**（损失比的几何平均，开根到参数尺度）。`
            + (tuned
              ? `　这一档是**配套调好的一对**：β*=${betaOpt.toFixed(3)}、步长跟着换成 4/(√λmin+√λmax)²=${lrHb.toFixed(4)}`
                + `（所以"步长"那个旋钮这一档不起作用，屏幕上标着"已被接管"）。`
                + `理论收缩率 (√κ−1)/(√κ+1)=**${rateMom.toFixed(3)}**，普通 GD 最好也只有 (κ−1)/(κ+1)=**${rateGd.toFixed(3)}** —— `
                + `**κ 开了平方根**，这是峡谷唯一说得清的解药。`
                + (kappa > 1
                  ? `　实测 ${lf.measRate} 已经比普通 GD 的理论最好值 ${rateGd.toFixed(3)} 小了；`
                    + `比理论值 ${rateMom.toFixed(3)} 还大一点是正常的 —— 那是**渐近**速率，${STEPS} 步里还带着起步的瞬态。`
                    + `　另外别拿"第几步到 1%"单看：这个只有两个曲率的玩具上，"上限的 50%"能靠一步清零陡模抢先，`
                    + `但它的每步收缩率并不更好，谷再深一点就被动量甩开了。`
                  : `　κ=1 时两种方法都是一步到位，动量的本事要在椭圆和峡谷上才看得出来。`)
              : mom > 0
                ? `　⚠️ 动量拧到 ${(mom * 100).toFixed(0)}% 但**步长没跟着配**：重球法的最优是一对参数，`
                  + `单拧 β 常常更慢（把"谷的形状"换成圆碗或椭圆试试，β=90% 反而拖后腿）。`
                  + `想看动量真正的本事，把动量拨到"最优（连步长一起配）"。`
                  + `　顺带一提，动量把稳定上限从 ${lrMax.toFixed(3)} 放宽到 (1+β)/κ=**${lrMaxEff.toFixed(3)}** —— `
                  + `所以"超限"那一档配上动量反而炸不了。`
                : `　普通梯度下降在这个谷上的理论最好收缩率是 (κ−1)/(κ+1)=**${rateGd.toFixed(3)}**`
                  + `（"公式值"那一档就是冲着它去的${lrTag === '公式值 1/(λmin+λmax)' ? `，实测 ${lf.measRate} 正好对上` : ''}）。`
                  + (kappa > 1 && lrTag !== '公式值 1/(λmin+λmax)'
                    ? `　⚠️ 但在这个**只有两个曲率**的玩具上，"上限的 50%"（lr=1/λmax）能把陡的那一模**一步清零**，`
                      + `反而比公式值更快 —— 公式求的是整段谱上的最坏情况最优，真问题的曲率连成一片，没有这种巧劲。`
                    : ``)
                  + `　把动量拨到"最优（连步长一起配）"，收缩率能降到 ${rateMom.toFixed(3)}。`),
    })

    const base0: Frame = {
      step: -1, x: X0, y: Y0, loss: L0, gx: 0, gy: 0, lr: +LR.toFixed(4), vx: 0, vy: 0,
      mom: +mom.toFixed(4), momTag, tuned, kappa,
      lrMax: +lrMax.toFixed(4), lrMaxEff: +lrMaxEff.toFixed(4), lrOpt: +lrOpt.toFixed(4), lrTag,
      rateGd: +rateGd.toFixed(4), rateMom: +rateMom.toFixed(4), measRate: 0,
      zig: 0, reach: -1, diverged: false, path: [{ x: X0, y: Y0 }], phase: 'run', log: '',
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
