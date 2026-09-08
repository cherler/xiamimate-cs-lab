/**
 * 内核：梯度提升树 GBDT（机器学习算法 · 原理：一棵棵小树接力，每棵只补上一棵的"错"）
 * 轴：step —— 每一轮**两拍**：① 算残差 ② 拟合一棵树桩、乘学习率加进预测
 *
 * 单棵决策树容易过拟合、也拟合不了平滑曲线。**梯度提升(GBDT)**换个玩法：让**一串小树接力**，
 * 每棵都只干一件事 —— **补上前面所有树合起来还没拟合掉的那部分误差(残差)**。
 * 做法：先用一个常数(均值)当初始预测；每一轮算出残差(真值−当前预测)，再训一棵小树去拟合这个残差，
 * 把它**乘学习率加进预测**；残差越来越小、预测越来越准。因为每棵树拟合的是"梯度/残差"，故名梯度提升。
 * **一堆弱学习器串起来 = 一个强学习器** —— 这就是集成学习的 boosting 路线，
 * 和随机森林(并行投票的 bagging)并称。GBDT/XGBoost/LightGBM 至今是表格数据上的主力。
 *
 * ## 2026-09-08 补厚（用户：「实验仿真有点偏简陋，要深深打磨」）
 *
 * 原来这一屏是**看不出机制**的：没有任何参数（学习率、轮数、数据形状全写死），
 * 轨迹还**跳着走**（只留 0/1/2/3/5/8 轮），屏幕上只有「数据点 + 一条预测折线 + MSE」。
 * 而 GBDT 的全部内容是那三样：**残差长什么样**、**这一轮的树桩切在哪、两边各补多少**、
 * **乘上学习率之后预测挪了多少** —— 一样都没画。
 *
 * 现在：
 *   · 三个旋钮：学习率、轮数、数据形状。学习率是这门算法最要紧的那个权衡
 *     （大了走得快但会过冲、小了稳但要更多棵树），拧一下就看见。
 *   · 每一轮拆成**两拍**：先停在"残差"上（这一拍屏幕主角是残差柱），
 *     再走一拍看树桩怎么切、预测怎么被推上去。
 *   · 状态里吐出 `resid` / `stump` / `mseHist`，让这三样都能画、都能对着算。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}

/** 三种数据形状 —— 换形状是为了看清「树桩阶梯」擅长什么、不擅长什么 */
const SHAPES: Record<string, (x: number) => number> = {
  //  阶梯：树桩的天生对手盘，几刀就贴住
  '阶梯': x => (x < 0.35 ? 1 : x < 0.7 ? 3 : 2),
  //  正弦：平滑曲线，阶梯只能一级一级去逼近 —— 要更多棵树，而且永远带锯齿
  '正弦': x => 2 + Math.sin(x * Math.PI * 2),
  //  直线：最能看出「阶梯拟合斜线」的别扭劲儿
  '直线': x => 0.6 + 2.6 * x,
}

const N_POINTS = 20

export type Stump = { t: number; lm: number; rm: number }

export type GBDTState = {
  i: number
  step: number
  /** 已经加了几棵树 */
  round: number
  lr: number
  points: { x: number; y: number }[]
  /** 当前预测（加完这一轮的树之后） */
  pred: number[]
  /** 这一拍要拟合的残差 = 真值 − 当前预测 */
  resid: number[]
  /** 这一轮拟合出来的树桩；算残差那一拍还没有，为 null */
  stump: Stump | null
  mse: number
  /** 留出集（训练时没见过的点）上的 MSE —— 过拟合只有靠它才看得见 */
  testMse: number
  /** 每轮结束时的训练 / 留出 MSE，用来画两条收敛曲线 */
  mseHist: number[]
  testHist: number[]
  /** 留出集的点，画在图上（空心） */
  test: { x: number; y: number }[]
  /** 这一拍在干什么：算残差 / 拟合并加进去 / 起点 / 完成 */
  act: 'init' | 'resid' | 'fit' | 'done'
  phase: 'run' | 'done'
  log: string
}

export const GBDT_VISIBLE = [
  'step', 'round', 'lr', 'points', 'pred', 'resid', 'stump', 'mse', 'testMse', 'mseHist', 'testHist', 'test', 'act', 'phase', 'log',
] as const

type Frame = Omit<GBDTState, 'i'>

export const gbdtKernel: Kernel<GBDTState> = {
  kind: 'gbdt',

  compile(doc: SimDocument): CompiledModel<GBDTState> {
    const LR = doc.params.lr === undefined ? 0.5 : num(doc.params, 'lr') / 100
    const ROUNDS = doc.params.rounds === undefined ? 8 : num(doc.params, 'rounds')
    const shape = doc.params.shape === undefined ? '阶梯' : str(doc.params, 'shape')
    const f = SHAPES[shape] ?? SHAPES['阶梯']

    const rnd = lcg(4)
    const POINTS = Array.from({ length: N_POINTS }, (_, i) => {
      const x = i / (N_POINTS - 1)
      return { x: +x.toFixed(3), y: +(f(x) + rnd() * 0.4).toFixed(2) }
    })
    /*  **留出集**：夹在训练点中间、噪声换一把种子，训练时一眼都没见过。
        没有它，这一屏只能演"训练误差一路降"——而训练 MSE 是**单调降**的，学习率怎么调都好看，
        GBDT 真正的那个权衡（走太快 / 树太多 → 过拟合）在它上面**永远看不见**。
        用户 2026-09-08 说仿真偏简陋，薄就薄在这儿：少了那条会掉头往上的曲线。 */
    const rndT = lcg(99)
    const TEST = Array.from({ length: N_POINTS - 1 }, (_, i) => {
      const x = (i + 0.5) / (N_POINTS - 1)
      return { x: +x.toFixed(3), y: +(f(x) + rndT() * 0.6).toFixed(2) }
    })

    const N = POINTS.length
    const mean = +(POINTS.reduce((a, p) => a + p.y, 0) / N).toFixed(3)
    const mseOf = (p: number[]) => POINTS.reduce((a, q, i) => a + (q.y - p[i]) ** 2, 0) / N
    /*  留出点不落在训练网格上，得按"这级阶梯在 x 处取什么值"重算：
        预测(x) = 均值 + Σ 每棵树 lr·(x<t ? 左补 : 右补)。 */
    const trees: Stump[] = []
    const predictAt = (x: number) => trees.reduce((a, st) => a + LR * (x < st.t ? st.lm : st.rm), mean)
    const testMseOf = () => TEST.reduce((a, q) => a + (q.y - predictAt(q.x)) ** 2, 0) / TEST.length

    /** 只切一刀的树桩：枚举所有切点，取平方误差最小的那个 */
    function bestStump(res: number[]): Stump {
      let best: Stump = { t: 0.5, lm: 0, rm: 0 }, bg = Infinity
      const xs = [...new Set(POINTS.map(p => p.x))].sort((a, b) => a - b)
      for (let i = 0; i < xs.length - 1; i++) {
        const t = (xs[i] + xs[i + 1]) / 2
        const L: number[] = [], R: number[] = []
        POINTS.forEach((p, idx) => (p.x < t ? L : R).push(idx))
        if (!L.length || !R.length) continue
        const lm = L.reduce((a, idx) => a + res[idx], 0) / L.length
        const rm = R.reduce((a, idx) => a + res[idx], 0) / R.length
        const err = L.reduce((a, idx) => a + (res[idx] - lm) ** 2, 0)
          + R.reduce((a, idx) => a + (res[idx] - rm) ** 2, 0)
        if (err < bg) { bg = err; best = { t: +t.toFixed(3), lm: +lm.toFixed(3), rm: +rm.toFixed(3) } }
      }
      return best
    }

    const r3 = (a: number[]) => a.map(v => +v.toFixed(3))
    const frames: Frame[] = []
    let pred = POINTS.map(() => mean)
    const mseHist = [+mseOf(pred).toFixed(3)]
    const testHist = [+testMseOf().toFixed(3)]
    const common = () => ({ lr: LR, points: POINTS, test: TEST, mseHist: [...mseHist], testHist: [...testHist] })

    frames.push({
      step: 0, round: 0, ...common(), pred: r3(pred),
      resid: r3(POINTS.map((p, i) => p.y - pred[i])), stump: null,
      mse: mseHist[0], testMse: testHist[0], act: 'init', phase: 'run',
      log: `第 0 轮：还没有任何树，预测就是**一条平线**（所有 y 的均值 ${mean}）。`
        + `训练 MSE **${mseHist[0]}**、留出 MSE **${testHist[0]}**。`
        + `下面那排柱子是**残差**（真值 − 预测），boosting 要拟合的正是它。`,
    })

    for (let r = 1; r <= ROUNDS; r++) {
      const res = POINTS.map((p, i) => p.y - pred[i])
      //  ── 第一拍：把残差摊出来（这一拍还没有树） ──
      frames.push({
        step: frames.length, round: r - 1, ...common(), pred: r3(pred),
        resid: r3(res), stump: null, mse: +mseOf(pred).toFixed(3), testMse: +testMseOf().toFixed(3),
        act: 'resid', phase: 'run',
        log: `第 ${r} 轮 · ①算残差：残差 = 真值 − 当前预测。`
          + `现在最大的一根是 **${Math.max(...res.map(Math.abs)).toFixed(2)}** —— `
          + `**下一棵树要拟合的不是原始数据，是这排柱子**。`,
      })
      //  ── 第二拍：拟合树桩，乘学习率加进预测 ──
      const st = bestStump(res)
      trees.push(st)
      pred = pred.map((v, i) => v + LR * (POINTS[i].x < st.t ? st.lm : st.rm))
      const m = +mseOf(pred).toFixed(3)
      const tm = +testMseOf().toFixed(3)
      const prevTest = testHist[testHist.length - 1]
      mseHist.push(m); testHist.push(tm)
      frames.push({
        step: frames.length, round: r, ...common(), pred: r3(pred),
        resid: r3(res), stump: st, mse: m, testMse: tm, act: 'fit', phase: 'run',
        log: `第 ${r} 轮 · ②拟合并加进去：树桩切在 x=**${st.t}**，`
          + `左边补 ${st.lm}、右边补 ${st.rm}；**乘学习率 ${LR}** 之后加进预测`
          + `（左 ${(LR * st.lm).toFixed(3)}、右 ${(LR * st.rm).toFixed(3)}）。`
          + `训练 MSE ${mseHist[mseHist.length - 2]} → **${m}**；`
          + `留出 MSE ${prevTest} → **${tm}**${tm > prevTest ? '（**涨了** —— 这一棵在拟合噪声）' : ''}。`,
      })
    }

    const lf = frames[frames.length - 1]
    const first = mseHist[0], last = mseHist[mseHist.length - 1]
    //  ⚠️ 下面这些数**全部现算**。原来写死成「0.75 一路降到 0.03」，参数一能调，写死的就全是假话。
    const bestT = Math.min(...testHist)
    const bestAt = testHist.indexOf(bestT)
    const overfit = testHist[testHist.length - 1] > bestT + 1e-9
    frames.push({
      ...lf, act: 'done', phase: 'done',
      log: `boosting ${ROUNDS} 轮（学习率 ${LR}、数据形状「${shape}」）：`
        + `**训练** MSE ${first} → **${last}**；**留出** MSE ${testHist[0]} → **${testHist[testHist.length - 1]}**。`
        + `每棵小树都只补"前面还没拟合掉的**残差**"——**一堆弱学习器接力 = 一个强学习器**；`
        + `因为每棵拟合的是残差/梯度，故名**梯度提升**。`
        + (overfit
          ? `　⚠️ 注意两条曲线**分岔**了：留出 MSE 在第 **${bestAt}** 轮触底 ${bestT}，之后掉头往上 —— `
            + `后面那几棵树学的已经是**训练点上的噪声**，不是规律。这就是"树太多/学得太快"的代价，`
            + `真实的 GBDT 靠早停和正则来卡这个点。`
          //  ⚠️ 这里原来写「两条曲线迟早会分开」——**没验过**。实测「正弦」形状下
          //  哪怕学习率 100%、16 轮，两条也仍然一起降。所以只说验得到的那一组。
          : `　这一组参数下留出 MSE 还跟着训练一起降 —— 说明这些树学到的还是规律、不是噪声。`
            + `想看它掉头：把形状换成**阶梯**、学习率拧到 **100%**、轮数拉到 16，`
            + `留出 MSE 第 3 轮就触底，之后一路往上。`),
    })

    const base0: Frame = {
      step: -1, round: 0, lr: LR, points: POINTS, test: TEST, pred: POINTS.map(() => mean),
      resid: r3(POINTS.map(p => p.y - mean)), stump: null,
      mse: mseHist[0], testMse: testHist[0], mseHist: [mseHist[0]], testHist: [testHist[0]],
      act: 'init', phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '步（每轮两拍）' },
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
