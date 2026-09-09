/**
 * 补厚这一轮的判据：**"讲解里印的那个数"必须真是仿真跑出来的**
 *
 * 起因（用户 2026-09-08）：「好多实验目录都好大、好难理解，但我们的实验仿真有点偏简陋
 * （算法、大模型职业的实验）这个还是要深深打磨才行。」
 *
 * 补厚的做法是：给每个实验加旋钮，再补上**"少了它就看不见那条结论"的那个量**。
 * 于是就有了新的风险 —— 结语里那些具体的数（"第 6 轮触底""60% 收敛 70% 发散"
 * "44%+集中 → 23%"）如果只是我按印象写的，屏幕上的仿真跟旁边的文字就会各说各话。
 * 这一套把这些数**逐条钉在仿真上**：不是钉字面，是钉**性质**（谁大于谁、拐点在哪、
 * 换个档结论翻不翻）。这样以后动内核，说错话会当场红。
 *
 * 纪律（memory: never-fill-data-from-memory / measure-before-tuning）：
 * 这里没有一个"记忆里的数"，全部由本文件现场跑出来再比。
 */
import { run } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'
import { gbdtKernel, type GBDTState } from '../src/kernels/gbdt.ts'
import { linregKernel, type LinRegState } from '../src/kernels/linreg.ts'
import { kmeansKernel, type KMeansState } from '../src/kernels/kmeans.ts'
import { diffusionKernel, type DiffusionState } from '../src/kernels/diffusion.ts'
import { selfconsistKernel, type SelfConsistState } from '../src/kernels/selfconsist.ts'
import { ppKernel, type PPState } from '../src/kernels/pp.ts'
import { llnKernel, type LlnState } from '../src/kernels/lln.ts'
import { cltKernel, type CltState } from '../src/kernels/clt.ts'
import { jlKernel, type JLState } from '../src/kernels/jl.ts'
import { logregKernel, type LogRegState } from '../src/kernels/logreg.ts'
import { binsearchKernel, type BinSearchState } from '../src/kernels/binsearch.ts'
import { graddescKernel, type GradDescState } from '../src/kernels/graddesc.ts'
import { pcaKernel, type PCAState } from '../src/kernels/pca.ts'
import { backpropKernel, type BackpropState } from '../src/kernels/backprop.ts'
import { residualKernel, type ResidualState } from '../src/kernels/residual.ts'
import { condnumKernel, type CondNumState } from '../src/kernels/condnum.ts'
import { svmKernel, type SVMState } from '../src/kernels/svm.ts'
import { matmulKernel, type MatmulState } from '../src/kernels/matmul.ts'
import { quantKernel, type QuantState } from '../src/kernels/quant.ts'
import { rnnKernel, type RNNState } from '../src/kernels/rnn.ts'
import { lstmKernel, type LSTMState } from '../src/kernels/lstm.ts'
import { inductionKernel, type InductionState } from '../src/kernels/induction.ts'
import { scaleKernel, type ScaleState } from '../src/kernels/scale.ts'
import { orthoKernel, type OrthoState } from '../src/kernels/ortho.ts'
import { xentKernel, type XentState } from '../src/kernels/xent.ts'
import { lowrankKernel, type LowRankState } from '../src/kernels/lowrank.ts'
import { ragKernel, type RagState } from '../src/kernels/rag.ts'
import { ganKernel, type GanState } from '../src/kernels/gan.ts'
import { perceptronKernel, type PerceptronState } from '../src/kernels/perceptron.ts'
import { pagerankKernel, type PageRankState } from '../src/kernels/pagerank.ts'
import { maxentKernel, MAXENT_MODES, MAXENT_MUS, MAXENT_STARTS, type MaxEntState } from '../src/kernels/maxent.ts'
import { quicksortKernel, QS_DATA, QS_PIVOTS, QS_PARTS, QS_SCALE_NS, type QuickSortState } from '../src/kernels/quicksort.ts'
import { dtreeKernel, DT_DATA, DT_IMPURITY, DT_DEPTHS, type DTreeState } from '../src/kernels/dtree.ts'
import { recsysKernel, RS_SCENES, RS_DIMS, RS_LAMBDAS, type RecSysState } from '../src/kernels/recsys.ts'
import { astarKernel, ASTAR_MAPS, ASTAR_WEIGHTS, ASTAR_HEURISTICS, type AStarState } from '../src/kernels/astar.ts'
import { unionfindKernel, UF_UNIONS, UF_COMPRESS, UF_SEQS, UF_SCALE_NS, type UnionFindState } from '../src/kernels/unionfind.ts'
import { mergesortKernel, MS_DATA, MS_TIES, MS_PASSES, MS_SCALE_NS, type MergeSortState } from '../src/kernels/mergesort.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

type P = Record<string, string | number>
const doc = (kind: string, params: P): SimDocument => ({ kind, params, entities: [], streams: [] })
const last = <T>(a: T[]) => a[a.length - 1]
const r = (x: number) => +x.toFixed(3)

// ═══ GBDT：留出集是"过拟合看得见"的唯一凭据 ═══════════════
console.log('\n【GBDT：训练误差单调降，留出误差会掉头】')
{
  const go = (p: P) => run(gbdtKernel.compile(doc('gbdt', p)), 400) as GBDTState[]
  const f = last(go({ lr: 50, rounds: 16, shape: '阶梯' }))
  const tr = f.mseHist, te = f.testHist

  //  ① 训练误差必须**单调不增** —— 每棵树都在拟合残差，它没有掉头的道理
  const up = tr.map((v, k) => k > 0 && v > tr[k - 1] + 1e-9 ? k : -1).filter(k => k >= 0)
  up.length === 0 ? ok(`训练 MSE 全程不升（${tr.length} 轮，${tr[0].toFixed(3)} → ${last(tr).toFixed(3)}）`)
    : bad(`训练 MSE 在第 ${up.join('、')} 轮反弹了 —— 拟合残差不该越拟合越差`)

  //  ② 留出误差必须在**中途**触底 ——「过拟合」这句话全靠它
  //     只钉"拐点不在最后一轮"，不钉具体第几轮：轮数是数据的事，改了数据不该红。
  /*  ⚠️ 判据不能写成 indexOf(最小值) 落在中间：曲线末尾走平时，indexOf 会
      指到平台的**第一个**点，于是单调下降的训练曲线也能"通过"。
      要钉的性质其实是**末端明显高于谷底**（掉头回升），直接这么写。 */
  const rebound = (c: number[]) => last(c) / Math.min(...c) - 1
  const lowest = te.indexOf(Math.min(...te))
  rebound(te) > 0.02
    ? ok(`留出 MSE 在第 ${lowest} 轮触底、之后回升（末轮比谷底高 ${(rebound(te) * 100).toFixed(1)}%）—— 过拟合看得见`)
    : bad(`留出 MSE 末端只比谷底高 ${(rebound(te) * 100).toFixed(2)}% —— 掉头没发生，"过拟合"就成了空话`)

  //  ③ 自检：如果留出集其实是训练集（判据写错的典型），②就该红
  rebound(tr) > 0.02
    ? bad('自检失败：把训练曲线塞进②居然也过 —— ②没在真正区分两条曲线')
    : ok(`自检：拿训练曲线冒充留出曲线，②会红（它末端不回升，只高 ${(rebound(tr) * 100).toFixed(2)}%）`)

  //  ④ 学习率越小，同样轮数走得越"欠"—— 这是"lr 是刹车"那句话的凭据
  const slow = last(go({ lr: 10, rounds: 16, shape: '阶梯' })).mseHist
  last(slow) > last(tr)
    ? ok(`lr=10% 走 16 轮仍欠拟合（MSE ${last(slow).toFixed(3)} > lr=50% 的 ${last(tr).toFixed(3)}）`)
    : bad('lr 调小反而训练误差更低 —— 跟"学习率是刹车"矛盾')
}

// ═══ 线性回归：稳定上界是**算出来**的，不是试出来的 ══════════
console.log('\n【线性回归：lrMax=2/λmax 真的分开了收敛与发散】')
{
  const go = (p: P) => last(run(linregKernel.compile(doc('linreg', p)), 400) as LinRegState[])
  const f = go({ lr: 6, steps: 48, start: '原点 (0,0)' })
  const cap = f.lrMax

  //  ① 界两侧的档位，行为必须相反 —— 从 registry 的选项里现挑，不写死数字
  const OPTS = [1, 6, 30, 60, 90]
  const wrong = OPTS.map(lr => {
    const s = go({ lr, steps: 48, start: '原点 (0,0)' })
    const shouldDiverge = lr / 100 > cap
    return s.diverged === shouldDiverge ? '' : `lr=${lr}% 界=${(cap * 100).toFixed(1)}% 预期${shouldDiverge ? '发散' : '收敛'}、实际${s.diverged ? '发散' : '收敛'}`
  }).filter(Boolean)
  wrong.length === 0
    ? ok(`界 ${(cap * 100).toFixed(1)}% 把 ${OPTS.join('/')}% 五档全分对了（界下全收敛、界上全发散）`)
    : bad(wrong.join(' / '))

  //  ② 收敛档必须**真的落到最小二乘解**上（闭式解是独立于梯度下降的第二个来源）
  const conv = go({ lr: 30, steps: 48, start: '原点 (0,0)' })
  const err = Math.hypot(conv.w - conv.wOls, conv.b - conv.bOls)
  err < 0.05 ? ok(`lr=30% 走 48 步后落在 OLS 闭式解上（偏差 ${err.toFixed(4)}）`)
    : bad(`收敛档离闭式解还差 ${err.toFixed(3)} —— 右图那个十字就白画了`)

  //  ③ 起点换到偏远处，终点必须还是同一个 OLS —— 凸问题的标志
  const far = go({ lr: 30, steps: 48, start: '偏远处 (-3,6)' })
  Math.hypot(far.w - conv.w, far.b - conv.b) < 0.05
    ? ok('换起点走到同一个解 —— MSE 是凸的，没有第二个谷底')
    : bad('两个起点收敛到了不同的地方 —— 那右图的等高线就不是一个碗')
}

// ═══ k-means：坏初值是"多跑几次"这条建议的唯一凭据 ═══════
console.log('\n【k-means：局部最优真的会发生】')
{
  const go = (p: P) => last(run(kmeansKernel.compile(doc('kmeans', p)), 400) as KMeansState[])
  const best = go({ k: 3, init: 'k-means++', shape: '三团' })

  //  ① bestInertia 是 20 次随机重启里的最好值，任何一次跑都不该比它更好
  const worst = go({ k: 3, init: '一角扎堆', shape: '三团' })
  const all = [best, worst]
  all.every(s => s.inertia >= s.bestInertia - 1e-6)
    ? ok(`没有哪一档跑得比"最好的重启"更好（++ ${best.inertia.toFixed(1)} / 扎堆 ${worst.inertia.toFixed(1)} / 最好 ${best.bestInertia.toFixed(1)}）`)
    : bad('某一档的 inertia 低于 bestInertia —— best-of-restarts 没算对')

  //  ② 坏初值必须**明显更差** —— 不然"初值决定成败"这句话没根据
  worst.gapPct > 5
    ? ok(`"一角扎堆"比最好解差 ${worst.gapPct.toFixed(0)}%，"k-means++"差 ${best.gapPct.toFixed(0)}% —— 初值决定成败看得见`)
    : bad(`坏初值只差 ${worst.gapPct.toFixed(1)}%，看不出局部最优`)

  //  ③ 一定要收敛（分配不再变），否则"迭代到不动为止"是空话
  all.every(s => s.converged) ? ok('两档都收敛到分配不再变化')
    : bad('有档位跑完仍未收敛 —— 步数不够或收敛判据坏了')
}

// ═══ 扩散：反向必须是**真采样**，不是把前向倒放 ═══════════
console.log('\n【扩散：换种子会磨出另一张图】')
{
  const go = (p: P) => run(diffusionKernel.compile(doc('diffusion', p)), 400) as DiffusionState[]
  const seeds = [1, 2, 3, 5]
  const landed = seeds.map(seed => last(go({ seed, steps: 16, schedule: '线性' })).landed)

  //  ① 不同种子必须能磨出**不止一种**结果 —— 老版本倒放录像时这里永远只有一种
  new Set(landed).size > 1
    ? ok(`四个种子磨出 ${new Set(landed).size} 种图案（${seeds.map((s, k) => `种子${s}→${landed[k]}`).join('、')}）`)
    : bad(`四个种子都磨出同一个 ${landed[0]} —— 反向若是倒放录像，正是这个样子`)

  //  ② 反向途中的后验权重必须是**分布**（和为 1），且末步比首步更笃定
  const t = go({ seed: 1, steps: 16, schedule: '线性' })
  const rev = t.filter(s => s.dir === 'reverse' && s.x0hat)
  //  ⚠️ weights 存的是 +toFixed(3) 的显示值（屏幕上要印百分比），
  //     所以和只能到 1±0.001 —— 容差按这个来，不是按浮点误差。
  const sumBad = rev.filter(s => Math.abs(s.weights.reduce((a, b) => a + b, 0) - 1) > 2e-3)
  sumBad.length === 0 ? ok(`反向 ${rev.length} 帧的后验权重都是合法分布（和=1）`)
    : bad(`${sumBad.length} 帧的权重和不为 1`)
  const conf = (s: DiffusionState) => Math.max(...s.weights)
  rev.length > 1 && conf(last(rev)) > conf(rev[0])
    ? ok(`把握从 ${(conf(rev[0]) * 100).toFixed(0)}% 涨到 ${(conf(last(rev)) * 100).toFixed(0)}% —— "一步步磨出来"有具体所指`)
    : bad('反向过程中把握没有变高 —— 那就不是在收敛到一张图')

  //  ③ 前向必须是**加噪**：√ᾱ 单调降到接近 0
  const fwd = t.filter(s => s.dir === 'forward')
  const mono = fwd.every((s, k) => k === 0 || s.sqrtA <= fwd[k - 1].sqrtA + 1e-9)
  mono && last(fwd).sqrtA < 0.2
    ? ok(`前向 √ᾱ 单调降到 ${last(fwd).sqrtA}（几乎纯噪声）`)
    : bad(`前向 √ᾱ 不单调或没降到底（末值 ${last(fwd).sqrtA}）`)
}

// ═══ 自洽：错法"集中"时多数投票会**反过来伤人** ═══════════
console.log('\n【思维链自洽：多数投票不是白吃的午餐】')
{
  const go = (p: P) => last(run(selfconsistKernel.compile(doc('selfconsist', p)), 400) as SelfConsistState[])
  const spread = go({ p: 44, spread: '分散', seed: 7 })
  const focus = go({ p: 44, spread: '集中', seed: 7 })

  //  ① 同样的正解占比，错法集中时可靠度必须**明显更低**
  //     （只钉方向和差距，不钉"40%→100% / 40%→23%"那两个具体数）
  spread.pWin > focus.pWin + 0.2
    ? ok(`正解占比同为 44%：错法分散 → ${(spread.pWin * 100).toFixed(0)}%，集中 → ${(focus.pWin * 100).toFixed(0)}% —— 差 ${((spread.pWin - focus.pWin) * 100).toFixed(0)} 个点`)
    : bad(`分散 ${(spread.pWin * 100).toFixed(0)}% vs 集中 ${(focus.pWin * 100).toFixed(0)}% —— 拉不开差距，"错法分布决定成败"就没凭据`)

  //  ② 错法集中时，多采几条**不该**把可靠度救回来（这才是反直觉的那一半）
  const curve = focus.curve
  Math.max(...curve.map(c => c[1])) < 0.6
    ? ok(`错法集中：链数从 1 加到 ${last(curve)[0]}，可靠度峰值也只有 ${(Math.max(...curve.map(c => c[1])) * 100).toFixed(0)}% —— 加采样救不回来`)
    : bad('错法集中时可靠度居然被采样数救回来了 —— 跟结语相反')

  //  ③ 正解占比过半时，多数投票必须**越采越稳**（curve 末端高于首端）
  const good = go({ p: 60, spread: '分散', seed: 7 }).curve
  last(good)[1] > good[0][1]
    ? ok(`正解占比 60%：链数 1→${last(good)[0]}，可靠度 ${(good[0][1] * 100).toFixed(0)}% → ${(last(good)[1] * 100).toFixed(0)}%`)
    : bad('正解过半时加采样没变稳 —— 大数定律该在这儿出现')
}

// ═══ 流水线并行：甜点 M* 必须是**求导算出来的那个** ═════════
console.log('\n【PP：微批数有甜点，不是越多越好】')
{
  const go = (p: P) => last(run(ppKernel.compile(doc('pp', p)), 400) as PPState[])
  const f = go({ micro: 8, stages: 4, overhead: 20 })

  //  ① mCurve 必须真是 U 形：谷底不在两端
  const ys = f.mCurve.map(c => c[1])
  const at = ys.indexOf(Math.min(...ys))
  at > 0 && at < ys.length - 1
    ? ok(`时长-M 曲线是 U 形，谷底在 M=${f.mCurve[at][0]}（两端分别高 ${((ys[0] / ys[at] - 1) * 100).toFixed(0)}% / ${((last(ys) / ys[at] - 1) * 100).toFixed(0)}%）`)
    : bad(`谷底落在端点（第 ${at} 个）—— 甜点不存在，"M 越大越好"又回来了`)

  //  ② 曲线量出来的 bestM 必须跟闭式解 √((G−1)/c) **对得上**（相邻档以内）
  const idx = f.mCurve.findIndex(c => c[0] === f.bestM)
  const near = Math.abs(f.bestM - f.bestMTheory) <= Math.abs(f.mCurve[Math.min(idx + 1, f.mCurve.length - 1)][0] - f.bestM) + 1e-9
  near ? ok(`量出来的 M*=${f.bestM} 与闭式解 √((G−1)/c)=${f.bestMTheory.toFixed(2)} 相符`)
    : bad(`量出来 ${f.bestM}、公式说 ${f.bestMTheory.toFixed(2)} —— 两个来源打架`)

  //  ③ 开销越大，甜点越靠左（M* 随 c 单调不增）—— 公式里的 1/√c
  const ms = [5, 20, 50].map(c => go({ micro: 8, stages: 4, overhead: c }).bestMTheory)
  ms.every((v, k) => k === 0 || v <= ms[k - 1] + 1e-9)
    ? ok(`每微批开销 5/20/50‰ → M* = ${ms.map(v => v.toFixed(1)).join(' / ')}，开销越大甜点越靠左`)
    : bad(`M* 随开销的走向不对：${ms.join(' / ')}`)

  //  ④ 气泡率必须随 M 变小 —— 这是这个实验最老的那条结论，别改坏了
  const b1 = go({ micro: 1, stages: 4, overhead: 20 }).bubblePct
  const b16 = go({ micro: 16, stages: 4, overhead: 20 }).bubblePct
  b16 < b1 ? ok(`气泡率 M=1 时 ${b1.toFixed(0)}% → M=16 时 ${b16.toFixed(0)}%`)
    : bad('微批越多气泡越大 —— 跟流水线的基本盘矛盾')
}

// ═══ 大数定律：误差×√n 恒定，柯西没有期望 ════════════════
console.log('\n【大数定律：1/√n 与"没有期望"那一档】')
{
  const go = (p: P) => last(run(llnKernel.compile(doc('lln', p)), 600) as LlnState[])

  //  ① 蒙特卡洛估 π：误差×√n 必须**大致恒定**（这才是 1/√n 的可检验形式）
  const pi = go({ target: '蒙特卡洛估 π', trials: 200 })
  const cur = pi.ratioCurve.map(c => c[1])
  const spread = Math.max(...cur) / Math.min(...cur)
  spread < 2.2
    ? ok(`误差×√n 在 ${cur.length} 个 n 上只在 ${Math.min(...cur).toFixed(2)}~${Math.max(...cur).toFixed(2)} 之间（比值 ${spread.toFixed(2)}）—— 抵消掉了 1/√n`)
    : bad(`误差×√n 波动 ${spread.toFixed(1)} 倍 —— 这条曲线撑不起"误差按 1/√n 缩"`)

  //  ② 柯西那一档必须自报"没有期望"，而且**估计不收敛**
  const cauchy = go({ target: '柯西均值（没有期望）', trials: 200 })
  !cauchy.hasMean ? ok('柯西档 hasMean=false —— 大数定律的前提在这儿不成立')
    : bad('柯西居然被标成有期望')
  const cc = cauchy.ratioCurve.map(c => c[1])
  Math.max(...cc) / Math.min(...cc) > spread
    ? ok(`柯西的误差×√n 抖动（${(Math.max(...cc) / Math.min(...cc)).toFixed(1)} 倍）远大于 π 档（${spread.toFixed(2)} 倍）—— 它不收敛`)
    : bad('柯西的曲线跟正常分布一样平 —— 反例没起到反例的作用')

  //  ③ 正态档必须收敛到真值
  const nor = go({ target: '正态均值', trials: 200 })
  Math.abs(nor.meanEst - nor.truth) < 0.2 * Math.max(1, Math.abs(nor.truth))
    ? ok(`正态档 T 次估计的均值 ${nor.meanEst.toFixed(3)} 贴着真值 ${nor.truth}`)
    : bad(`正态档估计 ${nor.meanEst} 离真值 ${nor.truth} 太远`)
}

// ═══ 中心极限：越偏的分布越慢，柯西根本不去 ═══════════════
console.log('\n【中心极限：峰度→0 才叫"变成正态"】')
{
  const go = (p: P) => last(run(cltKernel.compile(doc('clt', p)), 600) as CltState[])

  //  ① 有限方差的分布：样本均值的标准差必须贴着 σ/√m
  for (const d of ['均匀 U[0,1]', '指数（偏）', '伯努利 p=0.05（极偏）']) {
    const s = go({ dist: d, trials: 20000 })
    const rel = Math.abs(s.std - s.theoStd) / s.theoStd
    rel < 0.06 ? ok(`${d}：实测 σ/√m=${s.std.toFixed(4)}，理论 ${s.theoStd.toFixed(4)}（差 ${(rel * 100).toFixed(1)}%）`)
      : bad(`${d}：实测 ${s.std} vs 理论 ${s.theoStd}，差 ${(rel * 100).toFixed(0)}%`)
  }

  //  ② 峰度曲线必须随 m 往 0 走 —— "变成正态"这句话的可检验形式
  const exp = go({ dist: '指数（偏）', trials: 20000 })
  const k0 = Math.abs(exp.kurtCurve[0][1]), kN = Math.abs(last(exp.kurtCurve)[1])
  kN < k0 ? ok(`指数分布：m=${exp.kurtCurve[0][0]} 时超额峰度 ${exp.kurtCurve[0][1].toFixed(2)} → m=${last(exp.kurtCurve)[0]} 时 ${last(exp.kurtCurve)[1].toFixed(2)}`)
    : bad('峰度没有随 m 变小 —— 那就没在"变成正态"')

  //  ③ 柯西必须**不去** —— 方差不存在，CLT 前提破了
  const cau = go({ dist: '柯西（方差发散）', trials: 20000 })
  !cau.finiteVar ? ok('柯西档 finiteVar=false —— 屏幕上会说明前提不成立')
    : bad('柯西被当成有限方差')
  const ck = last(cau.kurtCurve)[1]
  Math.abs(ck) > Math.abs(last(exp.kurtCurve)[1]) * 3
    ? ok(`柯西在同样的 m 下峰度仍达 ${ck.toFixed(1)}（指数只剩 ${last(exp.kurtCurve)[1].toFixed(2)}）—— 它不往正态去`)
    : bad('柯西的峰度也降下去了 —— 反例失效')
}

// ═══ JL：k 只跟 N 有关，跟原始维度 D 无关 ════════════════
console.log('\n【JL：降到多少维只由点数决定】')
{
  const go = (p: P) => last(run(jlKernel.compile(doc('jl', p)), 600) as JLState[])

  /*  ⚠️ 别拿 kNeeded 钉"与 D 无关"：它算的是 8·lnN/ε²，而这里的 ε 是**当次量出来的**
      maxDev —— 随机投影的抽样噪声会整个搬进去（实测 533~871 之间跳）。
      "与 D 无关"该钉在**偏差曲线**上：同样点数、不同原始维度，maxDev-k 曲线几乎重合。 */
  //  ① 同样点数、不同原始维度，偏差曲线必须几乎重合
  const curves = [64, 256, 1024].map(d => go({ dim: d, points: 50 }).devCurve)
  const ksAt = curves[0].map(c => c[0])
  const off = ksAt.map((k, i) => {
    const vs = curves.map(c => c[i][1])
    return Math.max(...vs) / Math.min(...vs)
  })
  Math.max(...off) < 1.5
    ? ok(`D=64/256/1024（N=50）：各 k 上的最大偏差彼此只差 ${((Math.max(...off) - 1) * 100).toFixed(0)}% 以内 —— "与 D 无关"是真的`)
    : bad(`偏差曲线随 D 变了 ${Math.max(...off).toFixed(2)} 倍：${curves.map((c, i) => `D=${[64, 256, 1024][i]} ${JSON.stringify(c.map(x => x[1]))}`).join(' / ')}`)

  //  ② 点数变多（要保的点对数暴涨），同一个 k 上的最大偏差必须**变差**
  const devs = [6, 50, 200].map(n => go({ dim: 256, points: n }))
  const kk = last(devs[0].devCurve)[0]
  const at = devs.map(s => last(s.devCurve)[1])
  at.every((v, i) => i === 0 || v >= at[i - 1]) && last(at) > at[0]
    ? ok(`k=${kk} 固定，N=6/50/200 → 最大偏差 ${at.join(' / ')}（要保的点对从 ${devs[0].pairs} 涨到 ${devs[2].pairs} 对）`)
    : bad(`点数变多、最坏偏差没变差：${at.join(' / ')}`)

  //  ③ JL 那个理论界是**很松**的：真跑通的 k 远小于 8·lnN/ε² 要的维数
  const f50 = devs[1]
  f50.kNeeded > f50.k * 3
    ? ok(`当前 k=${f50.k} 已把偏差压到 ${f50.maxDev}，而定理要求这个精度得 k≈${f50.kNeeded} —— 理论界很松，实际早就够用`)
    : bad(`理论界 ${f50.kNeeded} 跟实际 k=${f50.k} 差不出量级 —— "界很松"这句话没凭据`)

  //  ④ 对数必须真是 C(N,2)
  const s = go({ dim: 256, points: 50 })
  s.pairs === 50 * 49 / 2 ? ok(`N=50 量了 ${s.pairs} 对距离（=C(50,2)）`)
    : bad(`对数 ${s.pairs} ≠ C(50,2)=1225`)
}

// ═══ 逻辑回归：L2 压 ‖w‖，异或压根分不开 ════════════════
console.log('\n【逻辑回归：正则真的在压权重，异或真的分不开】')
{
  const go = (p: P) => last(run(logregKernel.compile(doc('logreg', p)), 600) as LogRegState[])

  //  ① λ 越大 ‖w‖ 越小 —— "正则=给权重上缰绳"的唯一凭据
  const norms = [0, 10, 50, 200].map(l2 => go({ data: '线性可分', lr: 30, l2 }).wNorm)
  norms.every((v, k) => k === 0 || v <= norms[k - 1] + 1e-6) && last(norms) < norms[0]
    ? ok(`λ=0/10/50/200‰ → ‖w‖ = ${norms.map(v => v.toFixed(2)).join(' / ')}，单调被压小`)
    : bad(`‖w‖ 随 λ 的走向不对：${norms.map(v => v.toFixed(2)).join(' / ')}`)

  //  ② 可分数据 λ=0 时 ‖w‖ 会一路长 —— 这是"可分数据没有最优解"的样子
  const free = go({ data: '线性可分', lr: 30, l2: 0 })
  const nc = free.normCurve.map(c => c[1])
  last(nc) > nc[0] && free.separable
    ? ok(`可分 + λ=0：‖w‖ 从 ${nc[0].toFixed(2)} 长到 ${last(nc).toFixed(2)}，没有停下来的意思`)
    : bad('可分数据 λ=0 时 ‖w‖ 没有持续增长 —— 那条结论就没根据')

  //  ③ 异或必须**分不开**，而且准确率明显低于可分档（不钉具体数字）
  const xor = go({ data: '异或（线性不可分）', lr: 30, l2: 0 })
  const sep = go({ data: '线性可分', lr: 30, l2: 0 })
  !xor.separable && xor.acc < sep.acc - 0.15
    ? ok(`异或准确率 ${(xor.acc * 100).toFixed(0)}%，可分档 ${(sep.acc * 100).toFixed(0)}% —— 一条直线切不开异或`)
    : bad(`异或 ${(xor.acc * 100).toFixed(0)}% vs 可分 ${(sep.acc * 100).toFixed(0)}% —— 差距不足以说明"线性不可分"`)
}

// ═══ PageRank：阻尼系数是为两个坑存在的 ═══════════════════
console.log('\n【PageRank：悬挂节点会漏 rank，蜘蛛陷阱会吃光 rank】')
{
  const all = (p: P) => (run(pagerankKernel.compile(doc('pagerank', p)), 40) as PageRankState[]).filter(s => s.iter >= 0)
  const go = (p: P) => last(run(pagerankKernel.compile(doc('pagerank', p)), 40) as PageRankState[])
  const OK = '正常', DANG = '有悬挂节点（D 不链出去）', TRAP = '有蜘蛛陷阱（C 只链自己）'

  /*  ① 正常图上总和必须**精确等于 1**（每轮只是重新分配）。
      这条是全屏的锚：内部不舍入、只在显示时舍入，就是为了它 —— 逐项舍入再相加会显示成 1.003。 */
  const norm = all({ graph: OK, d: 85, fix: '不处理' })
  norm.every(s => Math.abs(s.total - 1) < 1e-9)
    ? ok(`正常图：每一轮的 Σrank 都精确等于 1（${norm.length} 帧）—— rank 只是重新分配，不增不减`)
    : bad(`正常图的总和不是 1：${[...new Set(norm.map(s => s.total))].join(' / ')}`)

  //  ② 老口径守住：正常图收敛后 C 最高、D 最低
  const nf = go({ graph: OK, d: 85, fix: '不处理' })
  nf.ranked[0].name === 'C' && last(nf.ranked).name === 'D'
    ? ok(`正常图排名 ${nf.ranked.map(x => `${x.name}(${x.r})`).join(' > ')} —— C 最高、D 最低，跟老版本一致`)
    : bad(`排名变了：${nf.ranked.map(x => x.name).join('>')}`)

  /*  ③ 悬挂节点**不处理**时总和必须一路漏；**均分修复**后回到 1。
      少了"总和"这一栏，这件事从各页 rank 上完全看不出来（都在变小，像还没收敛）。 */
  const leak = go({ graph: DANG, d: 85, fix: '不处理' })
  const fixed = go({ graph: DANG, d: 85, fix: '均分给所有页' })
  leak.leaked && leak.total < 0.85 && !fixed.leaked && Math.abs(fixed.total - 1) < 1e-9
    ? ok(`悬挂节点：不处理时 Σrank 漏到 ${leak.total}，均分修复后精确回到 ${fixed.total}`)
    : bad(`漏/修没演出来：不处理 ${leak.total}（leaked=${leak.leaked}）、修复后 ${fixed.total}`)

  //  ④ 总和必须**单调往下漏**（不是抖出来的）
  const seq = all({ graph: DANG, d: 100, fix: '不处理' }).map(s => s.total)
  seq.every((v, k) => k === 0 || v <= seq[k - 1] + 1e-9) && last(seq) < seq[0]
    ? ok(`d=1、不处理：Σrank 单调下漏 ${seq[0]} → ${last(seq)}`)
    : bad(`总和不是单调漏的：${seq.join(' / ')}`)

  /*  ⑤ 蜘蛛陷阱：d=1（完全不跳转）时必须**吃光**，d=0.85 时吃不干净。
      这一条就是"阻尼系数为什么存在"的全部证据。 */
  const trapHard = go({ graph: TRAP, d: 100, fix: '不处理' })
  const trapSoft = go({ graph: TRAP, d: 85, fix: '不处理' })
  trapHard.absorbed > 0.99 && trapSoft.absorbed < trapHard.absorbed && trapSoft.absorbed > 0.5
    ? ok(`蜘蛛陷阱：d=1 时 C 吃掉 ${(trapHard.absorbed * 100).toFixed(0)}%（其余全 0），d=0.85 时只吃 ${(trapSoft.absorbed * 100).toFixed(0)}% —— 阻尼就是为这个存在的`)
    : bad(`陷阱那档不对：d=1 吃 ${trapHard.absorbed}、d=0.85 吃 ${trapSoft.absorbed}`)

  //  ⑥ 自检：正常图上既不漏也没有陷阱（否则③⑤的对照不干净）
  !nf.leaked && nf.absorbed === 0 && nf.danglers.length === 0 && nf.trapped.length === 0
    ? ok('自检：正常图既没有悬挂节点也没有陷阱 —— ③⑤两条的对照是干净的')
    : bad(`正常图也有毛病：漏=${nf.leaked}、陷阱吃=${nf.absorbed}、悬挂=${nf.danglers}`)
}

// ═══ 感知机：收敛定理的前提，和"它不记得最好的那次" ═══════
console.log('\n【感知机：不可分时不是慢慢收敛，是陷进循环】')
{
  const go = (p: P) => last(run(perceptronKernel.compile(doc('perceptron', p)), 200) as PerceptronState[])
  const SEP = '线性可分', NOISY = '一个噪声点', XOR = '异或（怎么画都分不开）'

  //  ① 老口径守住：线性可分那档仍是 5 次更新、4 轮收敛
  const sep = go({ data: SEP })
  sep.converged && sep.updates === 5 && sep.mistakesNow === 0
    ? ok(`线性可分档原样保留：${sep.passes} 轮、${sep.updates} 次更新收敛，w=(${sep.w.join(',')}) b=${sep.b}`)
    : bad(`可分档变了：收敛=${sep.converged} 更新=${sep.updates} 错=${sep.mistakesNow}`)

  /*  ② 不可分的两档必须**都不收敛**，而且要有**循环**这个铁证 ——
      光说"跑满 12 轮还没好"只能说明轮数不够，说明不了"永远不会好"。 */
  const bad2: string[] = []
  for (const data of [NOISY, XOR]) {
    const s2 = go({ data })
    if (s2.converged) bad2.push(`${data} 居然收敛了`)
    if (!s2.cycleAt) bad2.push(`${data} 没检出循环（只能说明轮数不够，证明不了不收敛）`)
  }
  bad2.length === 0
    ? ok(`两档不可分数据都没收敛，且都检出循环：噪声点 第${go({ data: NOISY }).cycleAt![0]}轮=第${go({ data: NOISY }).cycleAt![1]}轮、异或 第${go({ data: XOR }).cycleAt![0]}轮=第${go({ data: XOR }).cycleAt![1]}轮`)
    : bad(bad2.join(' / '))

  /*  ③ 噪声点必须**真的**破坏可分性。这条钉的是一次实打实的翻车：
      第一版把 (2,3) 的标签翻成负，数据**仍然线性可分**（w=(−3,2)、b=−0.5 就能分开），
      那一档照样收敛，"噪声让它停不下来"根本没演出来。
      判据直接暴力验证：不存在任何整系数超平面能分对全部点。 */
  {
    const pts = go({ data: NOISY }).pts
    let sepExists = false
    for (let w1 = -8; w1 <= 8 && !sepExists; w1++)
      for (let w2 = -8; w2 <= 8 && !sepExists; w2++)
        for (let bb = -20; bb <= 20 && !sepExists; bb++) {
          if (pts.every(pt => Math.sign(w1 * pt.x[0] + w2 * pt.x[1] + bb) === pt.y)) sepExists = true
        }
    !sepExists
      ? ok(`噪声点那档**确实线性不可分**：在 w∈[−8,8]²、b∈[−20,20] 里穷举，没有一个超平面能分对全部 ${pts.length} 个点`)
      : bad('噪声点那档其实还是可分的 —— "噪声让它停不下来"就没演出来（第一版就栽在这儿）')
  }

  //  ④ 异或的四个点：任何直线都分不开（同样穷举验证，别只靠"大家都知道"）
  {
    const pts = go({ data: XOR }).pts
    let sepExists = false
    for (let w1 = -8; w1 <= 8 && !sepExists; w1++)
      for (let w2 = -8; w2 <= 8 && !sepExists; w2++)
        for (let bb = -20; bb <= 20 && !sepExists; bb++)
          if (pts.every(pt => Math.sign(w1 * pt.x[0] + w2 * pt.x[1] + bb) === pt.y)) sepExists = true
    !sepExists ? ok('异或那四个点穷举验证：确实没有任何直线能分开')
      : bad('异或居然找到了分界线 —— 那点集摆错了')
  }

  /*  ⑤ "它不记得最好的那次"：异或档最后交出来的必须**比历史最好更差**。
      这是 pocket algorithm 存在的理由，少了这条差距就看不见。 */
  const x = go({ data: XOR })
  x.bestMistakes < x.mistakesNow
    ? ok(`异或档：此刻错 ${x.mistakesNow} 个，而历史最好只错 ${x.bestMistakes} 个 —— 感知机不记得自己最好的时候（pocket algorithm 的理由）`)
    : bad(`没拉开差距：此刻 ${x.mistakesNow}、最好 ${x.bestMistakes}`)

  //  ⑥ 自检：可分那档"此刻=最好=0"，不该报出 pocket 差距（否则⑤就是碰巧）
  sep.bestMistakes === 0 && sep.mistakesNow === 0
    ? ok('自检：可分档收敛后此刻错 0、历史最好也是 0 —— ⑤那条差距只在不收敛时才出现')
    : bad(`可分档也有差距：${sep.mistakesNow} / ${sep.bestMistakes}`)
}

// ═══ GAN：G 也改成真的，模式崩溃才跑得出来 ═══════════════
console.log('\n【GAN：D 分不出来 ≠ G 学会了】')
{
  const all = (p: P) => (run(ganKernel.compile(doc('gan', p)), 40) as GanState[]).filter(s => s.round >= 0)
  const go = (p: P) => last(run(ganKernel.compile(doc('gan', p)), 40) as GanState[])
  const ONE = '一团', TWO = '两团（能看出模式崩溃）'

  /*  ① G 必须是**算出来**的：μ_G 每轮朝最近的真模式走 η 比例，
      于是不同 η 会走出不同的轨迹。老版本 μ 是写死的数组，换 η 也不会变。 */
  const trails = [15, 40, 90].map(eta => go({ data: ONE, eta }).muTrail)
  new Set(trails.map(t2 => JSON.stringify(t2))).size === 3
    ? ok(`三档 η 走出三条不同的轨迹（末位 ${trails.map(t2 => JSON.stringify(last(t2))).join(' / ')}）—— G 是真在追，不是排好的动画`)
    : bad('不同 η 的轨迹一样 —— 那 G 还是写死的')

  //  ② 一团档：G 必须追上（覆盖 1/1），D 的准确率一路降
  const one = all({ data: ONE, eta: 40 })
  const accs = one.map(s => s.acc)
  last(one).coverage === 1 && accs[0] > 90 && last(accs) < 60
    ? ok(`一团档：G 追上了（覆盖 1/1），D 准确率 ${accs[0]}% → ${last(accs)}%`)
    : bad(`一团档不对：覆盖 ${last(one).coverage}，准确率 ${accs[0]}→${last(accs)}`)

  /*  ③ 这一屏的主菜：两团时 **G 只盖住一个模式** —— 模式崩溃。
      而且它扑的是**离起点近的那一团**（几何决定，不是我摆的）。 */
  const two = go({ data: TWO, eta: 40 })
  const dist = (a2: number[], b2: number[]) => Math.hypot(a2[0] - b2[0], a2[1] - b2[1])
  const dToModes = two.modes.map(m => dist(two.muG, m))
  two.collapsed && two.coverage === 1 && two.modes.length === 2
    && Math.max(...dToModes) > 5 * Math.min(...dToModes)
    ? ok(`两团档：覆盖 ${two.coverage}/2，到两团的距离 ${dToModes.map(d => d.toFixed(2)).join(' / ')} —— 扑向一团、彻底忽略另一团`)
    : bad(`模式崩溃没跑出来：覆盖 ${two.coverage}/${two.modes.length}，距离 ${dToModes.map(d => d.toFixed(2)).join('/')}`)

  //  ④ 崩溃时 D 的准确率**掉不到瞎猜** —— 它还能靠没被覆盖的那团认出假货
  two.acc > 55 && go({ data: ONE, eta: 40 }).acc < 55
    ? ok(`崩溃那档 D 准确率停在 ${two.acc}%（一团档是 ${go({ data: ONE, eta: 40 }).acc}%）—— 没被覆盖的那团出卖了 G`)
    : bad(`两档的准确率没区分开：两团 ${two.acc}%、一团 ${go({ data: ONE, eta: 40 }).acc}%`)

  /*  ⑤ 崩溃跟 η 无关：三档步长都崩。
      这条钉的是"崩溃是结构性的（一个簇盖不住两团），不是没调好参"。 */
  const allCollapse = [15, 40, 90].map(eta => go({ data: TWO, eta }))
  allCollapse.every(s => s.collapsed && s.coverage === 1)
    ? ok('η=15/40/90% 三档全都崩溃（覆盖都是 1/2）—— 崩溃是结构性的，不是步长没调好')
    : bad(`有的 η 没崩：${allCollapse.map(s => `${s.eta}:${s.coverage}`).join(' ')}`)

  /*  ⑥ 自检：这一屏的 D 是"最近质心"这条固定规则，不是理论最优判别器 ——
      分布重合时它会掉到 50% 以下。这条把"屏幕上那句解释"钉住，免得哪天被当成 bug 抹平。 */
  const dipped = [15, 40, 90].map(eta => Math.min(...all({ data: ONE, eta }).map(s => s.acc)))
  Math.min(...dipped) < 50
    ? ok(`自检：一团档的最低准确率 ${Math.min(...dipped)}%，**低于 50%** —— 这个 D 是固定规则、不是最优判别器，屏幕上有说明`)
    : bad(`没出现低于 50% 的情形（${dipped.join('/')}）—— 那屏幕上那段解释就该删掉`)
}

// ═══ RAG：检索永远有输出，所以它不会说"我没有" ═══════════
console.log('\n【RAG：检索错了答案一定错，而且错得理直气壮】')
{
  const go = (p: P) => last(run(ragKernel.compile(doc('rag', p)), 20) as RagState[])
  const Q_OK = '猫爱吃什么？（库里有答案）'
  const Q_NONE = '企鹅爱吃什么？（库里没有）'
  const Q_DIST = '猫为什么半夜叫？（有干扰项）'
  const HONEST = '老实（没依据就说不知道）', LIAR = '爱编（照着资料硬答）'

  //  ① 顺利那档：任何 k 都命中，答案有出处
  const ok1 = [1, 2, 4].map(topk => go({ q: Q_OK, topk, honest: HONEST }))
  ok1.every(s => s.hit && !s.hallucinated && s.answerRank === 1)
    ? ok('库里有答案那档：k=1/2/4 都命中（含答案那篇排第 1），不产生幻觉')
    : bad(`顺利那档出问题：${ok1.map(s => `hit=${s.hit} rank=${s.answerRank}`).join(' / ')}`)

  /*  ② **检索永远有输出**：库里根本没有答案时，它照样交出 k 篇。
      这是所有 RAG 幻觉的根子，也是老版本演不出来的东西。 */
  const none = [1, 2, 4].map(topk => go({ q: Q_NONE, topk, honest: HONEST }))
  none.every((s, k) => s.retrieved.length === [1, 2, 4][k] && !s.hit && !s.hasAnswerInKb)
    ? ok('库里没有答案时，检索照样交出 k 篇（k=1/2/4 分别是 1/2/4 篇）—— 它不会说"我没有"')
    : bad(`没答案那档不对：${none.map(s => `取${s.retrieved.length}篇 hit=${s.hit}`).join(' / ')}`)

  //  ③ 同样的检索结果，模型脾气一换就从"说不知道"变成幻觉
  const honestOne = go({ q: Q_NONE, topk: 2, honest: HONEST })
  const liarOne = go({ q: Q_NONE, topk: 2, honest: LIAR })
  JSON.stringify(honestOne.retrieved) === JSON.stringify(liarOne.retrieved)
    && !honestOne.hallucinated && liarOne.hallucinated && liarOne.answer !== honestOne.answer
    ? ok(`同一份检索结果（${liarOne.retrieved.map(i => `#${i + 1}`).join(' ')}）：老实的说「${honestOne.answer}」，爱编的说「${liarOne.answer}」—— 幻觉来自模型脾气，不来自检索`)
    : bad(`脾气那条没演出来：老实 ${honestOne.answer}（幻觉=${honestOne.hallucinated}）、爱编 ${liarOne.answer}（幻觉=${liarOne.hallucinated}）`)

  /*  ④ 干扰项那档：**相似度高 ≠ 有答案**。含答案的那篇必须排在 top-2 之外、top-4 之内，
      于是 k 从 2 调到 4 能把它捞回来。这条也是"这个实验的向量得调过"的原因。 */
  const d2 = go({ q: Q_DIST, topk: 2, honest: HONEST })
  const d4 = go({ q: Q_DIST, topk: 4, honest: HONEST })
  d2.answerRank === 3 && !d2.hit && d4.hit
    ? ok(`干扰项那档：含答案的那篇只排第 ${d2.answerRank}（两篇讲猫但答非所问的相似度反而更高）—— k=2 漏掉、k=4 捞回来`)
    : bad(`干扰项没起作用：排第 ${d2.answerRank}，k=2 hit=${d2.hit}、k=4 hit=${d4.hit}`)

  //  ⑤ 幻觉的定义要严：只有"没命中 + 还给了肯定答案"才算
  const cases = [Q_OK, Q_NONE, Q_DIST].flatMap(q => [1, 2, 4].flatMap(topk => [HONEST, LIAR].map(honest => go({ q, topk, honest }))))
  cases.every(s => s.hallucinated === (!s.hit && s.honest.startsWith('爱编')))
    ? ok(`18 种组合：幻觉标记严格等于"没命中 + 模型爱编"—— 命中时不管什么脾气都不算幻觉`)
    : bad('幻觉的判定跟定义对不上')

  //  ⑥ 自检：库里没答案那档，调 k 救不回来（跟干扰项那档形成对照）
  const noneK = [1, 2, 4].map(topk => go({ q: Q_NONE, topk, honest: HONEST }).hit)
  noneK.every(h => !h) && d4.hit
    ? ok('自检：库里没答案时 k=1/2/4 全都救不回来；而干扰项那档 k=4 就能捞到 —— 两种失败的解法完全不同')
    : bad(`两种失败没区分开：没答案档 ${noneK.join('/')}、干扰项 k=4 hit=${d4.hit}`)
}

// ═══ 低秩近似：LoRA 靠的是谱的形状，不是"低秩"本身 ═══════
console.log('\n【低秩近似：谱一平，同一套数学什么都省不下来】')
{
  const all = (p: P) => (run(lowrankKernel.compile(doc('lowrank', p)), 80) as LowRankState[]).filter(s => s.phase === 'run')
  const go = (p: P) => last(run(lowrankKernel.compile(doc('lowrank', p)), 80) as LowRankState[])
  const SPEC = ['陡降（σ ∝ 1/i²）', '缓降（σ ∝ 1/i）', '平坦（随机矩阵）']

  /*  ① 矩阵必须是**满秩**的：老版本由 4 个分量搭出来，秩到 4 误差就归零了，
      "低秩好用"是被构造出来的。现在只有 k=d 时误差才归零。 */
  const bad1: string[] = []
  for (const spectrum of SPEC) for (const size of [8, 32]) {
    const seq = all({ spectrum, size })
    const zeros = seq.filter(s => s.error < 1e-6).map(s => s.rank)
    if (zeros.length !== 1 || zeros[0] !== size) bad1.push(`${spectrum}/d=${size}：误差在秩 ${zeros.join(',')} 归零`)
  }
  bad1.length === 0 ? ok('六种组合的矩阵都是满秩：只有 k=d 时重建误差才归零（不是搭出来的低秩矩阵）')
    : bad(bad1.join(' / '))

  //  ② Eckart–Young：重建误差必须等于被丢掉那些奇异值的平方和开根
  const bad2: string[] = []
  for (const spectrum of SPEC) {
    for (const s of all({ spectrum, size: 8 })) {
      const dropped = Math.sqrt(s.sigmas.slice(s.rank).reduce((a, v) => a + v * v, 0))
      if (Math.abs(s.error - dropped) > 1e-2) bad2.push(`${spectrum}/k=${s.rank}：误差 ${s.error} vs √(丢掉的σ²) ${dropped.toFixed(3)}`)
    }
  }
  bad2.length === 0 ? ok('每一档每个 k：重建误差都等于 √(被丢掉的 σ²) —— Eckart–Young 就是这么写的')
    : bad(bad2.slice(0, 3).join(' / '))

  /*  ③ 这一屏的主菜：**谱一平，低秩就帮不上忙**。
      陡降档留 90% 能量只要秩 1；平坦档要留一大半的秩，压缩比掉到 1 以下。 */
  const steep = go({ spectrum: SPEC[0], size: 32 })
  const flat = go({ spectrum: SPEC[2], size: 32 })
  steep.worthIt && !flat.worthIt && steep.rFor90 <= 2 && flat.rFor90 > 32 * 0.5
    ? ok(`d=32：陡降谱留 90% 能量只要秩 ${steep.rFor90}（压缩 ${(32 / (2 * steep.rFor90)).toFixed(1)}×）；平坦谱要秩 ${flat.rFor90}，压缩只有 ${(32 / (2 * flat.rFor90)).toFixed(2)}× —— 小于 1，白忙`)
    : bad(`两档没拉开：陡降 rFor90=${steep.rFor90}（值得=${steep.worthIt}）、平坦 rFor90=${flat.rFor90}（值得=${flat.worthIt}）`)

  //  ④ 压缩比必须恒等于 d/(2k)，且 k>d/2 时小于 1
  const bad4 = SPEC.flatMap(spectrum => all({ spectrum, size: 32 }))
    .filter(s => Math.abs(s.ratio - s.n / (2 * s.rank)) > 0.01 || (s.rank > s.n / 2 && s.ratio >= 1))
  bad4.length === 0 ? ok('压缩比逐格等于 d/(2k)，且 k 超过 d/2 时一律小于 1')
    : bad(`压缩比不对：${bad4.slice(0, 2).map(s => `k=${s.rank} ratio=${s.ratio}`).join(' / ')}`)

  //  ⑤ 能量必须单调涨到 100%，误差单调降到 0
  const bad5: string[] = []
  for (const spectrum of SPEC) {
    const seq = all({ spectrum, size: 8 })
    const e = seq.map(s => s.energyPct), r = seq.map(s => s.error)
    if (!e.every((v, k) => k === 0 || v >= e[k - 1]) || Math.abs(last(e) - 100) > 1e-6) bad5.push(`${spectrum}：能量 ${e.join('/')}`)
    if (!r.every((v, k) => k === 0 || v <= r[k - 1])) bad5.push(`${spectrum}：误差不单调`)
  }
  bad5.length === 0 ? ok('三种谱：保留能量单调涨到 100%、重建误差单调降到 0')
    : bad(bad5.slice(0, 2).join(' / '))

  //  ⑥ 自检：三种谱在 k=2 时的能量必须**明显拉开**，否则"谱的形状决定一切"就没凭据
  const at2 = SPEC.map(spectrum => all({ spectrum, size: 32 }).find(s => s.rank === 2)!.energyPct)
  at2[0] > at2[1] && at2[1] > at2[2] && at2[0] - at2[2] > 40
    ? ok(`自检：k=2 时三种谱的保留能量 ${at2.join('% / ')}% —— 拉开 ${(at2[0] - at2[2]).toFixed(0)} 个点，形状确实决定一切`)
    : bad(`三种谱在 k=2 时差不多：${at2.join(' / ')}`)
}

// ═══ 交叉熵·困惑度：PPL 不能跨词表比；一个词能绑架整句 ═══
console.log('\n【交叉熵：困惑度的天花板是词表大小；−log 在 p→0 时无界】')
{
  const go = (p: P) => last(run(xentKernel.compile(doc('xent', p)), 20) as XentState[])
  const VS = [8, 64, 50257]

  //  ① 瞎猜时困惑度必须**正好等于词表大小** —— 这是天花板，也是全实验的锚
  const chance = VS.map(vocab => go({ model: '瞎猜（均匀）', vocab, doom: '没有' }))
  chance.every((s, k) => Math.abs(s.perplexity - VS[k]) < 0.01)
    ? ok(`瞎猜档的困惑度正好等于词表大小：${chance.map((s, k) => `V=${VS[k]}→${s.perplexity}`).join('、')}`)
    : bad(`瞎猜档对不上 V：${chance.map(s => s.perplexity).join(' / ')}`)

  /*  ② 这一屏最该带走的一条：**同一个模型换词表，PPL 一动不动，而"比瞎猜强"差好几个数量级**。
      所以 PPL 不能跨词表比，要比就比那个倍数。 */
  const same = VS.map(vocab => go({ model: '一般', vocab, doom: '没有' }))
  const ppls = same.map(s => s.perplexity), ratios = same.map(s => s.betterThanChance)
  new Set(ppls).size === 1 && last(ratios) / ratios[0] > 1000
    ? ok(`同一个模型换词表：PPL 全是 ${ppls[0]}（一动不动），而"比瞎猜强" ${ratios.join(' → ')} 倍 —— PPL 不可跨词表比`)
    : bad(`跨词表那条没演出来：PPL ${ppls.join('/')}、倍数 ${ratios.join('/')}`)

  //  ③ 困惑度必须恒在 [1, V] 之间（没有被判死刑的词时）
  const bad3: string[] = []
  for (const model of ['瞎猜（均匀）', '一般', '很好']) for (const vocab of VS) {
    const s = go({ model, vocab, doom: '没有' })
    if (s.perplexity < 1 - 1e-9 || s.perplexity > vocab + 1e-6) bad3.push(`${model}/V=${vocab}：PPL ${s.perplexity}`)
  }
  bad3.length === 0 ? ok('9 种组合的困惑度都落在 [1, V] 之间 —— 完美=1、瞎猜=V 这两个端点是真的')
    : bad(bad3.join(' / '))

  /*  ④ 一个词绑架整句：六个词里改一个，困惑度涨一个数量级。
      而且**只有那一个词变了** —— 判据顺便钉住这一点，免得被当成"整体变差"。 */
  const clean = go({ model: '一般', vocab: 8, doom: '没有' })
  const doomed = go({ model: '一般', vocab: 8, doom: '有一个 p=1e-9' })
  doomed.perplexity / clean.perplexity > 20 && Math.abs(doomed.pplNoDoom - clean.perplexity) < 0.01
    ? ok(`一个 p=1e-9 的词：困惑度 ${clean.perplexity} → ${doomed.perplexity}（×${(doomed.perplexity / clean.perplexity).toFixed(0)}），它一个人贡献 ${doomed.doomBits} bit`)
    : bad(`绑架那条没演出来：${clean.perplexity} → ${doomed.perplexity}，pplNoDoom=${doomed.pplNoDoom}`)

  //  ⑤ 绑架的程度必须随那个词的概率**单调**（1e-3 比 1e-9 轻）
  const mild = go({ model: '一般', vocab: 8, doom: '有一个 p=0.001' })
  clean.perplexity < mild.perplexity && mild.perplexity < doomed.perplexity
    ? ok(`p=正常 / 0.001 / 1e-9 → 困惑度 ${clean.perplexity} / ${mild.perplexity} / ${doomed.perplexity}，越"绝对"代价越大`)
    : bad(`三档没单调：${clean.perplexity} / ${mild.perplexity} / ${doomed.perplexity}`)

  //  ⑥ 自检：被绑架之后，V=8 那档会**比瞎猜还差**（倍数 <1）—— 这才叫"代价无穷大"
  doomed.betterThanChance < 1
    ? ok(`自检：V=8 时被绑架的模型"比瞎猜强 ${doomed.betterThanChance} 倍"——**不到 1，即不如瞎猜**`)
    : bad(`被绑架后居然还强过瞎猜 ${doomed.betterThanChance} 倍`)
}

// ═══ 高维近正交：容量是能算出位数的数 ═══════════════════
console.log('\n【高维近正交：不是"余弦小"，是"能塞下多少个互不干扰的方向"】')
{
  const all = (p: P) => (run(orthoKernel.compile(doc('ortho', p)), 20) as OrthoState[]).filter(s => s.d > 0 && s.phase === 'run')

  //  ① 老口径守住：余弦标准差贴着理论 1/√d
  const base = all({ tol: 0.2 })
  const off = base.filter(s => s.d >= 8).map(s => Math.abs(s.std / s.theoStd - 1))
  Math.max(...off) < 0.2
    ? ok(`余弦标准差贴着 1/√d：${base.map(s => `d=${s.d} ${s.std}/${s.theoStd}`).join('、')}`)
    : bad(`标准差跟 1/√d 对不上：最大偏差 ${(Math.max(...off) * 100).toFixed(0)}%`)

  /*  ② 撞线概率必须用**精确公式**而不是高斯近似。
      ⚠️ 这条钉的是"能数的那几档要跟算出来的对上"：只在实测有分辨率（撞了 ≥30 次）的格子上比，
      并且用实测自己的 2σ 误差当门槛 —— 不拿一个拍脑袋的容差。 */
  const cmp = [0.1, 0.2, 0.4].flatMap(tol => all({ tol }))
    .filter(s => s.pMeasured * s.pSamples >= 30)
  const bad2 = cmp.filter(s => Math.abs(s.pMeasured - s.pTheory) > 3 * s.pErr)
  bad2.length === 0
    ? ok(`${cmp.length} 个能数得出来的格子：实测撞线频率都落在精确值的 3σ 以内`)
    : bad(bad2.map(s => `d=${s.d}/ε=${s.tol}：实测 ${s.pMeasured} vs 精确 ${s.pTheory.toFixed(4)}（±${s.pErr}）`).join(' / '))

  //  ③ 容量必须随 d **暴涨**（这才是"指数级多"的实际含义）
  const caps = all({ tol: 0.4 }).map(s => s.capacity)
  caps.every((v, k) => k === 0 || v >= caps[k - 1]) && last(caps) / caps[1] > 1e20
    ? ok(`ε=0.4：容量下界 ${caps.map(c => (c >= 1e5 ? c.toExponential(1) : c.toFixed(0))).join(' → ')}，d 从 8 到 768 涨了 ${(last(caps) / caps[1]).toExponential(1)} 倍`)
    : bad(`容量没暴涨：${caps.join(' / ')}`)

  //  ④ 容量对 ε 极其敏感（ε 在尾巴的指数里）：同一个 d，ε 放宽一倍容量涨很多个数量级
  const at768 = [0.1, 0.2, 0.4].map(tol => last(all({ tol })).capacity)
  at768[2] / at768[0] > 1e20
    ? ok(`d=768：ε=0.1/0.2/0.4 的容量下界 ${at768.map(c => (c >= 1e5 ? c.toExponential(1) : c.toFixed(0))).join(' / ')} —— ε 放宽一倍就涨二十多个数量级`)
    : bad(`容量对 ε 不敏感：${at768.join(' / ')}`)

  /*  ⑤ 容量公式必须是 **1/p**（Gilbert–Varshamov），不是生日估计 √(2ln2/p)。
      这条钉住的是一次真实的自相矛盾：生日式在 ε=0.1、d=768 那格给 16，
      而贪心**实际装进去** 120+ 个 —— 公式比现实还小，说明它回答的根本不是这个问题。 */
  //  容量存的是 toPrecision(4) 的显示值，所以按**相对**误差比，不按绝对
  const bad5 = [0.1, 0.2, 0.4].flatMap(tol => all({ tol }))
    .filter(s => Math.abs(s.capacity / (1 / s.pTheory) - 1) > 1e-3)
  bad5.length === 0 ? ok('容量用的是 1/p（GV 下界），不是生日估计 —— 逐格核对无误')
    : bad(`容量公式不是 1/p：${bad5.slice(0, 2).map(s => `d=${s.d} 容量 ${s.capacity} vs 1/p ${(1 / s.pTheory).toFixed(2)}`).join(' / ')}`)

  //  ⑥ 自检：生日式在那一格确实会跟贪心打架（证明⑤换公式是必要的，不是洁癖）
  const cell = all({ tol: 0.1 }).find(s => s.d === 768)!
  const birthday = Math.sqrt(2 * Math.LN2 / cell.pTheory)
  birthday < cell.packed && 1 / cell.pTheory > cell.packed
    ? ok(`自检：ε=0.1、d=768 那格，生日式给 ${birthday.toFixed(0)} 个 < 贪心实际装进的 ${cell.packed} 个（自相矛盾），而 1/p 给 ${(1 / cell.pTheory).toFixed(0)} 个 —— 换公式是必要的`)
    : bad(`自检没成立：生日 ${birthday.toFixed(1)}、贪心 ${cell.packed}、1/p ${(1 / cell.pTheory).toFixed(1)}`)
}

// ═══ √d 缩放：方差是量出来的，梯度是画出来的 ═══════════
console.log('\n【√d 缩放：不缩放没梯度、÷d 没选择性、÷√d 两头都要】')
{
  const all = (p: P) => (run(scaleKernel.compile(doc('scale', p)), 20) as ScaleState[]).filter(s => s.d > 0)
  const NONE = '不缩放', SQ = '÷√d（正解）', OVER = '÷d（缩过头）'

  /*  ① Var(Q·K)=d 必须是**量出来**的：实测方差要贴着 d。
      老版本这条是写进去的（logit 直接取 base×√d），根本没在验证定理。 */
  const vs = all({ scale: NONE }).map(s => ({ d: s.d, v: s.variance }))
  vs.every(x => Math.abs(x.v / x.d - 1) < 0.15)
    ? ok(`实测 Var(Q·K) 逐档贴着 d：${vs.map(x => `${x.d}→${x.v}`).join('、')}（抽 200 对随机向量数出来的）`)
    : bad(`方差对不上 d：${vs.map(x => `${x.d}/${x.v}`).join(' ')}`)

  //  ② 不缩放：d 越大越塌，且**梯度单调掉**（这是补厚补上的那一栏）
  const nn = all({ scale: NONE })
  const jac = nn.map(s => s.jac), mx = nn.map(s => s.maxU)
  jac.every((v, k) => k === 0 || v <= jac[k - 1]) && mx.every((v, k) => k === 0 || v >= mx[k - 1]) && jac[0] / last(jac) > 10
    ? ok(`不缩放：最大概率 ${mx.map(v => `${(v * 100).toFixed(0)}%`).join('→')}，梯度 ${jac.join('→')}（掉 ${(jac[0] / last(jac)).toFixed(0)} 倍）`)
    : bad(`不缩放没演出"越大越塌"：最大概率 ${mx.join('/')}，梯度 ${jac.join('/')}`)

  //  ③ ÷√d：熵和梯度必须**几乎不随 d 变** —— 这是这一屏的正解
  const sq = all({ scale: SQ })
  const sj = sq.map(s => s.jac), se = sq.map(s => s.entU)
  Math.max(...sj) / Math.min(...sj) < 1.3 && Math.max(...se) / Math.min(...se) < 1.3
    ? ok(`÷√d：梯度 ${Math.min(...sj)}~${Math.max(...sj)}、熵 ${Math.min(...se)}~${Math.max(...se)} bit —— 跨 256 倍的 d 几乎不动`)
    : bad(`÷√d 没稳住：梯度 ${sj.join('/')}、熵 ${se.join('/')}`)

  /*  ④ ÷d（缩过头）走到另一头：分布趋近**均匀**（最大概率→1/n、熵→log2(n)），
      有梯度但**没有选择性**。两种失败正好是一对。 */
  const ov = last(all({ scale: OVER }))
  const n = ov.unscaled.length
  Math.abs(ov.maxU - 1 / n) < 0.03 && Math.abs(ov.entU - Math.log2(n)) < 0.02 && ov.jac > last(jac) * 10
    ? ok(`÷d：最大概率 ${(ov.maxU * 100).toFixed(0)}%≈1/${n}、熵 ${ov.entU}≈log₂${n}，梯度 ${ov.jac} 比不缩放大 ${(ov.jac / last(jac)).toFixed(0)} 倍 —— 有梯度但没选择性`)
    : bad(`÷d 那档没走到均匀：最大概率 ${ov.maxU}、熵 ${ov.entU}、梯度 ${ov.jac}`)

  //  ⑤ 三档的**排序**必须一致：不缩放最尖、÷d 最平、÷√d 居中
  const lastOf = (m: string) => last(all({ scale: m }))
  const [a1, b1, c1] = [lastOf(NONE).maxU, lastOf(SQ).maxU, lastOf(OVER).maxU]
  a1 > b1 && b1 > c1
    ? ok(`d=1024 时三档的最大概率：不缩放 ${(a1 * 100).toFixed(0)}% > ÷√d ${(b1 * 100).toFixed(0)}% > ÷d ${(c1 * 100).toFixed(0)}%`)
    : bad(`三档排序不对：${a1} / ${b1} / ${c1}`)

  /*  ⑥ 自检：这些统计量必须是**多次抽样的平均**才有单调性。
      拿单次抽样重算一遍，②的单调性应该保不住 —— 这条把"为什么要平均"钉成一个会红的对照。 */
  const single = nn.map(s => Math.max(...softmaxOf(s.rawLogits)))
  !single.every((v, k) => k === 0 || v >= single[k - 1])
    ? ok(`自检：只看单次抽样，最大概率是 ${single.map(v => `${(v * 100).toFixed(0)}%`).join('→')} —— **不单调**，所以必须对多次抽样取平均`)
    : bad('自检没成立：单次抽样居然也单调，那"要平均"这条理由就站不住')
}
//  自检用的小工具（跟内核里那个同式）
function softmaxOf(xs: number[]): number[] {
  const m = Math.max(...xs)
  const es = xs.map(x => Math.exp(x - m))
  const s2 = es.reduce((a, b) => a + b, 0)
  return es.map(e => e / s2)
}

// ═══ 归纳头：它不是记忆，是一条现场执行的规则 ═══════════
console.log('\n【归纳头：换成没见过的符号照样对；先例不止一条时它在投票】')
{
  const go = (p: P) => last(run(inductionKernel.compile(doc('induction', p)), 20) as InductionState[])
  const BOOK = 'A B C A B C A（教科书）'
  const NOVEL = '没见过的符号（♣♠♦）'
  const AMB = '有歧义（上次跟 B、上上次跟 D）'
  const NONE = '没有先例（当前 token 首次出现）'

  //  ① 教科书那档的老口径不能变：A B C A B C A → B，先例是 pos1/pos4
  const bk = go({ seq: BOOK, beta: 8 })
  bk.prediction === 'B' && JSON.stringify(bk.matches) === '[1,4]' && bk.conf > 0.999
    ? ok('教科书档原样保留：先例 pos1/pos4，预测 B，把握 100%')
    : bad(`教科书档变了：预测 ${bk.prediction}、先例 ${JSON.stringify(bk.matches)}、把握 ${bk.conf}`)

  /*  ② 这个实验补厚后最要紧的一条：**换成不可能在训练里出现的符号，它照样答对**。
      这是"不是背下来的、是一条现场执行的规则"的直接证据。 */
  const nv = go({ seq: NOVEL, beta: 8 })
  nv.prediction === '♠' && nv.conf > 0.999 && JSON.stringify(nv.matches) === JSON.stringify(bk.matches)
    ? ok(`换成 ♣♠♦ 照样答对（预测 ♠、把握 100%），先例位置跟教科书档完全一样 —— 规则跟符号无关`)
    : bad(`没见过的符号那档没答对：预测 ${nv.prediction}、把握 ${nv.conf}`)

  //  ③ 歧义档：预测必须是个**分布**，而且两条先例的后继确实不同
  const am = go({ seq: AMB, beta: 8 })
  am.ambiguous && am.dist.length === 2 && am.conf < 0.95 && Math.abs(am.dist.reduce((a2, d) => a2 + d[1], 0) - 1) < 1e-3
    ? ok(`歧义档给出的是分布：${am.dist.map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' / ')}（和为 1）—— "复制"其实是投票`)
    : bad(`歧义档没给出分布：${JSON.stringify(am.dist)}、ambiguous=${am.ambiguous}`)

  /*  ④ β 就是 softmax 温度：β 越大越只认最近那条先例。
      ⚠️ 这条要成立，得分必须带**近因偏好** —— 否则两条先例永远平票，β 拧到天上也没用。 */
  const bs = [1, 4, 8, 20].map(beta => go({ seq: AMB, beta }).conf)
  bs.every((v, k) => k === 0 || v > bs[k - 1]) && bs[0] < 0.6 && last(bs) > 0.98
    ? ok(`β=1/4/8/20 → 把握 ${bs.map(v => `${(v * 100).toFixed(0)}%`).join(' → ')}：β 越大越只认最近那条先例`)
    : bad(`β 没起到温度的作用：${bs.map(v => v.toFixed(3)).join(' / ')}`)

  //  ⑤ 没有先例那档：匹配集必须是空的，且不能硬编一个预测出来
  const nn = go({ seq: NONE, beta: 8 })
  nn.noPrecedent && nn.matches.length === 0 && nn.dist.length === 0 && nn.conf === 0
    ? ok(`没有先例那档：匹配集为空、不给分布也不给预测 —— 这条电路的**前提**说清楚了`)
    : bad(`无先例那档还给了东西：matches=${JSON.stringify(nn.matches)}、dist=${JSON.stringify(nn.dist)}`)

  //  ⑥ 自检：教科书档和没见过的符号档必须**除了符号本身之外完全一致**（证明②不是碰巧）
  JSON.stringify(bk.weights) === JSON.stringify(nv.weights)
    ? ok('自检：两档的注意力权重逐位相同 —— 差别只在符号，机制一模一样')
    : bad(`两档的权重不同：${JSON.stringify(bk.weights)} vs ${JSON.stringify(nv.weights)}`)
}

// ═══ LSTM：跟 RNN 同一把尺子，只差 tanh′ 那一项 ═══════════
console.log('\n【LSTM：∏f 没有 tanh′ 掺进来，所以 f 能取到 1】')
{
  const go = (p: P) => last(run(lstmKernel.compile(doc('lstm', p)), 80) as LSTMState[])
  const L50 = '长序列（T=50）'

  //  ① f=1 时影响力必须**一点不掉**（∏f=1），这是 LSTM 存在的全部理由
  const f1 = go({ seq: L50, forget: 1 })
  Math.abs(f1.grad - 1) < 1e-12 && f1.halfLife < 0
    ? ok(`f=1、走 50 步：开头写进 cell 的东西还剩 ${f1.grad}（一点没少），半衰期判为"不衰减"`)
    : bad(`f=1 居然掉了：还剩 ${f1.grad}、半衰期 ${f1.halfLife}`)

  /*  ② 这一屏最值钱的一条：**f=0.9 的衰减跟 RNN wh=0.9 一模一样**。
      因为脉冲之后 RNN 的 h→0、tanh′→1，两条链此刻乘的正是同一个数。
      这条把"两边只差 tanh′ 那一项"钉成了一个可核对的等式。 */
  const lf9 = go({ seq: L50, forget: 0.9 })
  const rw9 = last(run(rnnKernel.compile(doc('rnn', { seq: '脉冲后全 0（T=50）', wh: 0.9 })), 80) as RNNState[])
  Math.abs(lf9.halfLife - rw9.halfLife) < 0.15
    ? ok(`f=0.9 的半衰期 ${lf9.halfLife} 步 = RNN wh=0.9 的 ${rw9.halfLife} 步 —— 两条链此刻乘的是同一个数`)
    : bad(`两边对不上：LSTM f=0.9 → ${lf9.halfLife} 步，RNN wh=0.9 → ${rw9.halfLife} 步`)

  //  ③ 影响力必须是**纯粹的 ∏f**：逐帧算出来的值要等于 f 的幂
  const seq = (run(lstmKernel.compile(doc('lstm', { seq: L50, forget: 0.9 })), 80) as LSTMState[]).filter(s => s.phase === 'run')
  const off = seq.map((s, k) => (k === 0 ? 0 : Math.abs(Math.log(Math.abs(s.grad) / 0.9 ** k))))
  Math.max(...off) < 0.02
    ? ok(`影响力逐帧等于 0.9^k —— 是**纯粹的 ∏f**，没有 tanh′ 之类的东西掺进来`)
    : bad(`影响力不等于 ∏f（最大偏差 ${Math.max(...off).toFixed(3)}）`)

  /*  ④ 跟 RNN 的关键差别：LSTM 的因子**可以取到 1**，RNN 的**取不到**。
      拿两边各自最好的一档比 —— 这才是"门控赢在哪"的硬凭据。 */
  const rnnBest = [0.5, 0.9, 1.5].map(wh => last(run(rnnKernel.compile(doc('rnn', { seq: '脉冲后全 0（T=50）', wh })), 80) as RNNState[]))
  const bestRnnFactor = Math.max(...rnnBest.map(s => s.factorAsymp))
  bestRnnFactor < 1 && f1.grad === 1
    ? ok(`RNN 三档的每步因子最大也只有 ${bestRnnFactor}（<1，必然衰减）；LSTM 的 f 可以取到 1（不衰减）—— 门控赢的就是这一项`)
    : bad(`对照不成立：RNN 最大因子 ${bestRnnFactor}、LSTM f=1 时还剩 ${f1.grad}`)

  //  ⑤ 剧本那一档原样保住（cell 全程 0.8、末步 h=tanh(0.8)=0.664）
  const sc = (run(lstmKernel.compile(doc('lstm', { seq: '存/守/取 剧本（可手核）', forget: 1 })), 80) as LSTMState[]).filter(s => s.phase === 'run')
  JSON.stringify(sc.map(s => s.c)) === JSON.stringify([0.8, 0.8, 0.8, 0.8]) && sc[3].h === 0.664
    ? ok('剧本那一档原样保留：cell 全程 0.8，末步 h=tanh(0.8)=0.664，逐步可手核')
    : bad(`剧本那档变了：c=${sc.map(s => s.c).join('/')}，末步 h=${sc[3]?.h}`)
}

// ═══ RNN：沿时间的连乘，跟沿深度是同一件事 ═══════════════
console.log('\n【RNN：记不住远处；而且把 wh 调大反而更糟】')
{
  const go = (p: P) => last(run(rnnKernel.compile(doc('rnn', p)), 80) as RNNState[])
  const LONG = '脉冲后全 0（T=50）'

  //  ① 影响力必须真是那串连乘：末值 = wx·∏|wh·(1−h²)|，跟逐帧因子对得上
  const t50 = run(rnnKernel.compile(doc('rnn', { seq: LONG, wh: 0.9 })), 80) as RNNState[]
  const runs = t50.filter(s => s.phase === 'run')
  const prod = runs.slice(1).reduce((p2, s) => p2 * s.factor, Math.abs(runs[0].grad))
  Math.abs(Math.log(prod / Math.abs(last(runs).grad))) < 0.02
    ? ok(`影响力确实是连乘出来的：逐帧因子连乘 ${prod.toExponential(2)} = 末值 ${last(runs).grad}`)
    : bad(`连乘对不上：${prod.toExponential(3)} vs ${last(runs).grad}`)

  /*  ② 影响力必须单调衰减，而且掉出至少两个数量级。
      ⚠️ 门槛写 1e3 会误伤：wh=0.9 那档实测掉 778 倍（2.9 个数量级），是**真实值**不是毛病。
      两个条件分开判，红的时候才说得清是哪一条不成立。 */
  const gs = runs.map(s => Math.abs(s.grad))
  const mono = gs.every((v, k) => k === 0 || v <= gs[k - 1] + 1e-30)
  const drop = gs[0] / last(gs)
  mono ? ok(`影响力逐步单调不增（${gs.length} 帧）`) : bad('影响力中途反弹了 —— 那就不是连乘衰减')
  drop > 100
    ? ok(`50 步里影响力从 ${gs[0]} 掉到 ${last(gs).toExponential(1)} —— ${drop.toExponential(1)} 倍，两个数量级以上`)
    : bad(`只掉了 ${drop.toFixed(0)} 倍，看不出"记不住远处"`)

  /*  ③ 这个实验补厚后最反直觉、也最该钉住的一条：
      **把 wh 调大救不回来，甚至更糟**。wh=1.5 的半衰期必须**短于** wh=0.9。
      道理是 h 被推到饱和区、tanh′ 塌掉；判据顺便把"末态 h 确实饱和了"也钉上。 */
  const w9 = go({ seq: LONG, wh: 0.9 })
  const w15 = go({ seq: LONG, wh: 1.5 })
  const w5 = go({ seq: LONG, wh: 0.5 })
  w15.halfLife < w9.halfLife && w5.halfLife < w9.halfLife && Math.abs(w15.ht) > 0.8
    ? ok(`半衰期 wh=0.5 → ${w5.halfLife} 步、0.9 → ${w9.halfLife} 步、1.5 → ${w15.halfLife} 步 —— **1.5 比 0.9 还短**（h 饱和在 ${w15.ht}，tanh′ 只剩 ${(1 - w15.ht ** 2).toFixed(2)}）`)
    : bad(`"调大 wh 反而更糟"没演出来：${w5.halfLife} / ${w9.halfLife} / ${w15.halfLife}，末态 h=${w15.ht}`)

  //  ④ 半衰期必须跟渐近因子对得上（ln0.5/ln f），两个数不能各说各的
  const badH = [w5, w9, w15].filter(s => Math.abs(s.halfLife - Math.log(0.5) / Math.log(s.factorAsymp)) > 0.1)
  badH.length === 0 ? ok('三档的半衰期都等于 ln0.5/ln(渐近因子) —— 屏幕上那两个数是同一件事的两种说法')
    : bad(`半衰期跟渐近因子对不上：${badH.map(s => `wh=${s.wh}：${s.halfLife} vs ${(Math.log(0.5) / Math.log(s.factorAsymp)).toFixed(2)}`).join(' / ')}`)

  //  ⑤ 短序列那档原样保住（老口径：h 一路 0.762 → 0.109 → 0.92 → −0.258）
  const sh = (run(rnnKernel.compile(doc('rnn', { seq: '短序列 [2,−1,3,−2]（可手核）', wh: 0.8 })), 80) as RNNState[])
    .filter(s => s.phase === 'run').map(s => s.ht)
  JSON.stringify(sh) === JSON.stringify([0.762, 0.109, 0.92, -0.258])
    ? ok('短序列那档原样保留：h = 0.762 → 0.109 → 0.92 → −0.258，逐步可手核')
    : bad(`短序列的 h 变了：${sh.join(' / ')}`)

  /*  ⑥ 自检：半衰期不能拿"从第 0 步往下数"来算 —— 那样三档全是 1~2 步、分不出高下。
      这条把当初写歪的算法固定成一个**会红**的对照。 */
  const naive = (s2: RNNState[]) => {
    const g0 = Math.abs(s2.filter(x => x.phase === 'run')[0].grad)
    const seq2 = s2.filter(x => x.phase === 'run')
    for (let k = 1; k < seq2.length; k++) if (Math.abs(seq2[k].grad) < g0 / 2) return k
    return -1
  }
  const naiveHl = [0.5, 0.9, 1.5].map(wh => naive(run(rnnKernel.compile(doc('rnn', { seq: LONG, wh })), 80) as RNNState[]))
  new Set(naiveHl).size < 3 && new Set([w5.halfLife, w9.halfLife, w15.halfLife]).size === 3
    ? ok(`自检：按"从第 0 步往下数"算，三档半衰期是 ${naiveHl.join('/')}（分不出高下）；按渐近因子算是 ${[w5, w9, w15].map(s => s.halfLife).join('/')} —— 换算法是必要的`)
    : bad(`自检没成立：朴素算法 ${naiveHl.join('/')}、渐近算法 ${[w5, w9, w15].map(s => s.halfLife).join('/')}`)
}

// ═══ 量化：一个异常值就能毁掉整张的 scale ═══════════════
console.log('\n【量化：scale 由 max|w| 定，所以异常值能把小权重全挤成 0】')
{
  const all = (p: P) => (run(quantKernel.compile(doc('quant', p)), 40) as QuantState[]).filter(s => s.bits > 0)
  const at = (p: P, bits: number) => all(p).find(s => s.bits === bits)!
  const DIST = ['正态（教科书情形）', '有异常值（真实 LLM 的样子）', '长尾']
  const GRP = ['整张一个 scale', '分 8 组', '分 32 组']

  //  ① 位宽越低，误差越大、显存越小 —— 老口径也得守住
  const bad1: string[] = []
  for (const dist of DIST) for (const group of GRP) {
    const seq = all({ dist, group })
    const err = seq.map(s => s.relErr), by = seq.map(s => s.bytesQ)
    if (!err.every((v, k) => k === 0 || v >= err[k - 1])) bad1.push(`${dist}/${group}：误差不单调`)
    if (!by.every((v, k) => k === 0 || v <= by[k - 1])) bad1.push(`${dist}/${group}：字节数不单调`)
  }
  bad1.length === 0 ? ok('9 种组合 × 5 档位宽：位越少误差越大、显存越小 —— "拿精度换显存"这笔账没错')
    : bad(bad1.slice(0, 3).join(' / '))

  /*  ② 这个实验的主菜：**异常值 + 整张 scale** 时，int4 会把一大半权重压成 0。
      少了这条，整个补厚就白做了。 */
  const flat = at({ dist: DIST[1], group: GRP[0] }, 4)
  const norm = at({ dist: DIST[0], group: GRP[0] }, 4)
  const N = flat.weights.length
  flat.zeroed > N * 0.5 && flat.zeroed > norm.zeroed * 3
    ? ok(`异常值 + 整张 scale + int4：${flat.zeroed}/${N}（${Math.round(100 * flat.zeroed / N)}%）被压成 0；同样条件的正态分布只有 ${norm.zeroed} 个`)
    : bad(`异常值那档没演出来：归零 ${flat.zeroed}/${N}，正态 ${norm.zeroed}`)

  //  ③ 药：分组必须把归零和误差都明显压下去
  const g8 = at({ dist: DIST[1], group: GRP[1] }, 4)
  const g32 = at({ dist: DIST[1], group: GRP[2] }, 4)
  g8.zeroed < flat.zeroed / 2 && g32.zeroed < g8.zeroed && g32.relErr < g8.relErr && g8.relErr < flat.relErr
    ? ok(`分组是药：归零 ${flat.zeroed} → ${g8.zeroed} → ${g32.zeroed}，相对误差 ${(flat.relErr * 100).toFixed(1)}% → ${(g8.relErr * 100).toFixed(1)}% → ${(g32.relErr * 100).toFixed(1)}%`)
    : bad(`分组没把误差压下去：${flat.zeroed}/${g8.zeroed}/${g32.zeroed}，${flat.relErr}/${g8.relErr}/${g32.relErr}`)

  /*  ④ 药不是白吃的：等效位宽必须**把每组 scale 摊进去**并随组数上升。
      少了这一项，"组越小越好"就成了一句没有代价的空话。 */
  const eff = [flat, g8, g32].map(s => s.effBits)
  eff[0] < eff[1] && eff[1] < eff[2] && Math.abs(eff[1] - (4 + 16 * 8 / N)) < 1e-6
    ? ok(`等效位宽把 scale 开销摊了进去：${eff.join(' → ')} bit/权重（分 8 组 = 4 + 16·8/${N} = ${eff[1]}）`)
    : bad(`等效位宽不对：${eff.join(' / ')}`)

  //  ⑤ 分组之后，异常值所在那几组的 scale 必须**明显更大**（破坏被关在那里）
  const sc = g8.scales
  Math.max(...sc) > Math.min(...sc) * 3
    ? ok(`分 8 组时各组 scale 差 ${(Math.max(...sc) / Math.min(...sc)).toFixed(1)} 倍 —— 异常值只撑大了它自己那几组`)
    : bad(`各组 scale 差不多（最大/最小 ${(Math.max(...sc) / Math.min(...sc)).toFixed(2)}）—— 看不出"关进自己那组"`)

  //  ⑥ 自检：正态那档不该有"一多半归零"，否则②的对照就不成立
  norm.zeroed < N * 0.3
    ? ok(`自检：正态分布 int4 只有 ${norm.zeroed}/${N} 归零 —— ②的对照干净，差别确实来自异常值`)
    : bad(`正态档也归零了 ${norm.zeroed}/${N} —— 那"异常值的锅"就说不清了`)
}

// ═══ 矩阵乘：FLOPs 是定死的，访存不是 ═══════════════════
console.log('\n【矩阵乘：同样的浮点数，换个循环顺序差一个数量级】')
{
  const t = (p: P) => run(matmulKernel.compile(doc('matmul', p)), 80) as MatmulState[]
  const go = (p: P) => last(t(p))
  const ORDERS = ['i-j-k（教科书写法）', 'i-k-j（行优先友好）', '分块（tiling）']
  const MID = '中（32 行 × 8）'

  //  ① 三种顺序的 FLOPs 必须**完全相同** —— 这是整个实验的前提
  const flops = ORDERS.map(order => go({ size: '64×64', order, cache: MID }).totalFlops)
  new Set(flops).size === 1 && flops[0] === 2 * 64 ** 3
    ? ok(`三种顺序的浮点运算完全相同：${flops[0].toLocaleString()} = 2·64³`)
    : bad(`FLOPs 居然随顺序变了：${flops.join(' / ')}`)

  //  ② 而缺失必须差出数量级；且 i-j-k 最差、分块最好
  const f64 = go({ size: '64×64', order: ORDERS[0], cache: MID })
  const [ijk, ikj, tiled] = f64.compare.map(c => c[1])
  ijk > ikj * 5 && tiled < ikj
    ? ok(`64×64：i-j-k ${ijk.toLocaleString()} ／ i-k-j ${ikj.toLocaleString()} ／ 分块 ${tiled.toLocaleString()} —— 最差比最好多 ${(ijk / tiled).toFixed(1)} 倍缺失`)
    : bad(`三种顺序没拉开：${ijk} / ${ikj} / ${tiled}`)

  /*  ③ 每一帧的缺失必须是**当场数出来的**。
      ⚠️ 这条判据写歪过一次：第一版钉的是"曲线不是直线"，可实测 i-j-k 的真实曲线
      本来就几乎是直线（预热之后每次访问的缺失率基本恒定），偏离线性只有 0.01% ——
      **直不直跟真不真没关系**，那条判据钉错了对象。
      真正只有仿真才有的性质有两条，改钉它们：
        · 逐帧累计的末值，必须等于**另一条代码路径**（compare 表）独立算出的总数；
        · 分块那档的曲线**明显偏离线性**（块与块之间冷热不均），摊平模型给不出这个。 */
  const badEnd: string[] = []
  for (const order of ORDERS) for (const size of ['16×16', '32×32', '64×64']) {
    const fr = t({ size, order, cache: MID }).filter(s => s.phase === 'cell')
    const seq = fr.map(s => s.miss)
    if (!seq.every((v, k) => k === 0 || v >= seq[k - 1])) badEnd.push(`${size}/${order}：累计缺失不单调`)
    if (last(seq) !== last(fr).totalMiss) badEnd.push(`${size}/${order}：末帧 ${last(seq)} ≠ 总数 ${last(fr).totalMiss}`)
  }
  badEnd.length === 0
    ? ok('9 种组合：逐帧累计缺失单调不减，且末值跟另一条代码路径算出的总数逐个相等')
    : bad(badEnd.slice(0, 3).join(' / '))

  {
    const seq = t({ size: '32×32', order: ORDERS[2], cache: MID }).filter(s => s.phase === 'cell').map(s => s.miss)
    const fin = last(seq)
    const dev = Math.max(...seq.map((m, k) => Math.abs(m - fin * (k + 1) / seq.length) / fin))
    dev > 0.01
      ? ok(`分块那档的缺失曲线偏离线性 ${(dev * 100).toFixed(1)}% —— 块与块之间冷热不均，摊平模型给不出这个`)
      : bad(`分块的曲线跟摊平的直线只差 ${(dev * 100).toFixed(2)}% —— 看不出是跟着真实访存流走的`)
  }

  /*  ④ 放得下就无所谓：矩阵小到塞进缓存时，前两种顺序的缺失必须**一模一样**。
      这条撑着"分块不是玄学，是放不下才需要的"那句话。 */
  const f16 = go({ size: '16×16', order: ORDERS[0], cache: MID }).compare.map(c => c[1])
  f16[0] === f16[1] && ijk / ikj > 5
    ? ok(`16×16 时 i-j-k 与 i-k-j 缺失一模一样（都是 ${f16[0]}），而 64×64 时差 ${(ijk / ikj).toFixed(1)} 倍 —— 分块是"放不下"才需要的`)
    : bad(`小矩阵那档没体现"放得下就无所谓"：${f16[0]} vs ${f16[1]}`)

  //  ⑤ 块边长必须由缓存容量算出来（3T² ≤ 容量），换缓存就跟着变
  const tiles = ['小（16 行 × 8）', MID, '大（128 行 × 8）'].map(cache => {
    const s = go({ size: '64×64', order: ORDERS[2], cache })
    return { cap: s.cacheCap, tile: s.tile }
  })
  tiles.every(x => 3 * x.tile ** 2 <= x.cap && 3 * (x.tile + 1) ** 2 > x.cap)
    ? ok(`块边长由缓存算出：${tiles.map(x => `容量 ${x.cap}→T=${x.tile}`).join('、')}（3T² ≤ 容量 的最大整数）`)
    : bad(`块边长跟缓存容量对不上：${tiles.map(x => `${x.cap}/${x.tile}`).join(' ')}`)

  //  ⑥ 小矩阵那档必须原样保住手核路径（C[0][0]=58）
  const sm = t({ size: '2×3 · 3×2（逐格手核）', order: ORDERS[0], cache: MID }).filter(s => s.phase === 'cell')
  sm.length === 4 && sm[0].value === 58 && sm[3].value === 154
    ? ok('「逐格手核」那一档原样保留：4 个输出格，C[0][0]=58、C[1][1]=154，可拿计算器核')
    : bad(`手核那档变了：${sm.length} 帧，值 ${sm.map(s => s.value).join('/')}`)
}

// ═══ SVM：真求解，而且只有几个点说了算 ═══════════════════
console.log('\n【SVM：方向是解出来的；支持向量删掉别的点也照样定住这条街】')
{
  const t = (p: P) => run(svmKernel.compile(doc('svm', p)), 80) as SVMState[]
  const go = (p: P) => last(t(p))
  const DATA = ['清爽可分', '有重叠（线性不可分）', '有一个离群点']
  const CS = [0.1, 1, 10]

  /*  ① 全实验最硬的一条：把所有**非**支持向量删掉重解，边界必须几乎不动。
      这也是"C 只给到 10"的理由 —— C=100 时求解器解不完，这条会红。 */
  const tilts = DATA.flatMap(data => CS.map(c => ({ data, c, tilt: go({ data, c }).svOnlyTilt })))
  tilts.every(x => x.tilt < 1)
    ? ok(`9 种组合：只留支持向量重解，边界最大只差 ${Math.max(...tilts.map(x => x.tilt))}° —— 真的只有那几个点说了算`)
    : bad(tilts.filter(x => x.tilt >= 1).map(x => `${x.data}/C=${x.c}：差 ${x.tilt}°`).join(' / '))

  //  ② 目标函数必须逐帧不升（迭代数是几何级数增长的，best-so-far 保证单调）
  const badObj: string[] = []
  for (const data of DATA) for (const c of CS) {
    const objs = t({ data, c }).filter(s => s.phase === 'run').map(s => s.obj)
    if (!objs.every((v, k) => k === 0 || v <= objs[k - 1] + 1e-9)) badObj.push(`${data}/C=${c}`)
  }
  badObj.length === 0 ? ok('9 种组合：目标 J 逐帧不升（次梯度法本身不是下降法，靠 best-so-far 保住）')
    : bad(`这些组合的 J 反弹了：${badObj.join('、')}`)

  //  ③ 方向必须是**解出来**的：起步那一帧跟收敛后差很多（否则等于写死了答案）
  const seq = t({ data: '清爽可分', c: 1 }).filter(s => s.phase === 'run')
  const ang = (s: SVMState) => Math.atan2(s.w2, s.w1) * 180 / Math.PI
  Math.abs(ang(seq[0]) - ang(last(seq))) > 15 && last(seq).margin > seq[0].margin * 2
    ? ok(`方向确实转过来了：${ang(seq[0]).toFixed(1)}° → ${ang(last(seq)).toFixed(1)}°，街宽 ${(2 * seq[0].margin).toFixed(2)} → ${(2 * last(seq).margin).toFixed(2)}`)
    : bad(`起步和收敛差不多（${ang(seq[0]).toFixed(1)}° vs ${ang(last(seq)).toFixed(1)}°）—— 那"方向是解出来的"就没凭据`)

  //  ④ C 越大街越窄（软间隔那个取舍）——三种数据都要成立
  const badC: string[] = []
  for (const data of DATA) {
    const w = CS.map(c => go({ data, c }).margin)
    if (!w.every((v, k) => k === 0 || v <= w[k - 1] + 1e-9)) badC.push(`${data}：${w.map(v => (2 * v).toFixed(2)).join(' / ')}`)
  }
  badC.length === 0
    ? ok(`C=0.1/1/10 时街宽单调变窄（清爽 ${CS.map(c => (2 * go({ data: '清爽可分', c }).margin).toFixed(2)).join('→')}）`)
    : bad(`C 变大街反而变宽：${badC.join(' / ')}`)

  /*  ⑤ 离群点那档的主菜：C 小放弃它、街最宽；C 大为它一个点把街挤掉一大半。
      离群点的落点是扫出来的 —— 放太深任何 C 都会放弃它，这条就红了。 */
  const soft = go({ data: '有一个离群点', c: 0.1 })
  const hard = go({ data: '有一个离群点', c: 10 })
  const clean = go({ data: '清爽可分', c: 10 })
  soft.wrong === 1 && hard.wrong === 0 && hard.margin < clean.margin * 0.5
    ? ok(`离群点：C=0.1 放弃它（错 1、街宽 ${(2 * soft.margin).toFixed(2)}）；C=10 为它一个点把街挤到 ${(2 * hard.margin).toFixed(2)}，干净数据的基准是 ${(2 * clean.margin).toFixed(2)}`)
    : bad(`离群点那档没演出取舍：软 错${soft.wrong}/宽${(2 * soft.margin).toFixed(2)}，硬 错${hard.wrong}/宽${(2 * hard.margin).toFixed(2)}，基准 ${(2 * clean.margin).toFixed(2)}`)

  //  ⑥ 重叠那档必须**真的分不开**：任何 C 都错几个
  const ov = CS.map(c => go({ data: '有重叠（线性不可分）', c }).wrong)
  ov.every(v => v > 0) ? ok(`重叠档三种 C 都分不干净（错 ${ov.join(' / ')} 个）—— "线性不可分"不是嘴上说的`)
    : bad(`重叠档居然有 C 能全分对：${ov.join(' / ')}`)
}

// ═══ 条件数：同一个数的两张脸 ═══════════════════════════
console.log('\n【条件数：走得慢，和算不准，是同一个 κ】')
{
  const all = (p: P) => (run(condnumKernel.compile(doc('condnum', p)), 60) as CondNumState[]).filter(s => s.phase === 'run')

  /*  ① 最坏方向上，实测误差放大必须**正好等于 κ** —— 不等式 ‖Δx‖/‖x‖ ≤ κ·‖Δb‖/‖b‖
      在这个方向上取等号。这条是全实验最硬的一个核对点。 */
  const worst = all({ dir: '最坏方向', precond: '不预处理' })
  const off = worst.map(s => Math.abs(s.amp / s.kappaEff - 1))
  Math.max(...off) < 1e-6
    ? ok(`最坏方向：误差放大逐档等于 κ（${worst.map(s => s.amp).join(' / ')}），不等式取到等号`)
    : bad(`最坏方向没顶到 κ：${worst.map(s => `κ=${s.kappa} 放大 ${s.amp}`).join(' / ')}`)

  //  ② 随便一个方向：放大必须**远小于** κ —— κ 是上界，不是每次都发生
  const any = all({ dir: '随便一个方向', precond: '不预处理' })
  const big = any.filter(s => s.kappa >= 20)
  big.every(s => s.amp < s.kappaEff / 10)
    ? ok(`随便一个方向：κ=20/50/200 时放大只有 ${big.map(s => s.amp).join(' / ')} —— κ 是上界，不是每次都会发生`)
    : bad(`随便方向的放大没跟 κ 拉开：${big.map(s => `${s.amp}/${s.kappaEff}`).join(' ')}`)

  //  ③ 两张脸必须**一起**变坏：步数和放大都随 κ 单调上升
  const st = worst.map(s => s.steps), ap = worst.map(s => s.amp)
  st.every((v, k) => k === 0 || v > st[k - 1]) && ap.every((v, k) => k === 0 || v > ap[k - 1])
    ? ok(`κ 递增时两张脸同步变坏：步数 ${st.join('→')}，放大 ${ap.join('→')}`)
    : bad(`有一张脸没跟着变坏：步数 ${st.join('/')}，放大 ${ap.join('/')}`)

  //  ④ 收敛率必须等于 (κ−1)/(κ+1)，用的是**实际**的 κ（预处理后会变）
  const bad4 = worst.filter(s => Math.abs(s.rate - (s.kappaEff - 1) / (s.kappaEff + 1)) > 1e-3)
  bad4.length === 0 ? ok('各档收敛率都等于 (κ−1)/(κ+1)（用的是预处理之后的实际 κ）')
    : bad(`收敛率对不上：${bad4.map(s => `κ=${s.kappa} rate=${s.rate}`).join(' / ')}`)

  /*  ⑤ 预处理有用、但**不是万能**。这条钉住两头：κ 确实降了，而且**没降到 1**。
      矩阵是转了 30° 的，对角缩放修不了"方向相关"那部分病态 —— 少了这一条，
      屏幕上就成了"归一化一下就好了"。 */
  const raw = all({ dir: '最坏方向', precond: '不预处理' }).filter(s => s.kappa === 200)[0]
  const jac = all({ dir: '最坏方向', precond: '对角缩放 (Jacobi)' }).filter(s => s.kappa === 200)[0]
  jac.kappaEff < raw.kappaEff && jac.kappaEff > 10 && jac.steps < raw.steps
    ? ok(`对角缩放：κ=200 只降到 ${jac.kappaEff}、步数 ${raw.steps}→${jac.steps} —— 有用，但远不是万能`)
    : bad(`预处理那一档不对：κ ${raw.kappaEff}→${jac.kappaEff}、步数 ${raw.steps}→${jac.steps}`)

  //  ⑥ 结语里那两条序列必须是**本次跑出来的**（老版本是三个写死的数拼一个现算的）
  const fin = last(run(condnumKernel.compile(doc('condnum', { dir: '最坏方向', precond: '不预处理' })), 60) as CondNumState[])
  fin.stepsSoFar.length === worst.length && fin.stepsSoFar.every(([k, v], i) => k === worst[i].kappa && v === worst[i].steps)
    ? ok(`结语用的序列跟逐帧实测逐个对上（${fin.stepsSoFar.map(([k, v]) => `κ${k}:${v}`).join(' ')}）—— 没有写死的数`)
    : bad('结语里的序列跟实际跑出来的对不上')
}

// ═══ 残差：差别只有那个 +1，而它不是万能的 ═══════════════
console.log('\n【残差：同一批 f′，两条链只差一个 +1】')
{
  const go = (p: P) => last(run(residualKernel.compile(doc('residual', p)), 200) as ResidualState[])
  const DEPTHS = [8, 16, 50]
  const BRANCH = ['弱 f′≈0.1', '中 f′≈0.4', '强 f′≈0.6']

  /*  ① 两条链必须**共用同一批 f′**：每一帧上 |f′| 与 |1+f′| 要能互相推出来。
      老版本两条曲线的因子是各写各的（0.8 和 ≈1），这条判据在那时候是过不了的。 */
  const bad1: string[] = []
  for (const branch of BRANCH) {
    const t = run(residualKernel.compile(doc('residual', { depth: 16, branch })), 200) as ResidualState[]
    for (const s of t.filter(x => x.phase === 'run')) {
      //  |1+f′| 只可能是 1+|f′| 或 |1−|f′||，取决于 f′ 的正负 —— 别的值就说明不是同一个 f′
      const up = 1 + s.plainFactor, dn = Math.abs(1 - s.plainFactor)
      if (Math.min(Math.abs(s.resFactor - up), Math.abs(s.resFactor - dn)) > 2e-3)
        bad1.push(`${branch} 第 ${s.layer} 层：|f′|=${s.plainFactor} 却配了 |1+f′|=${s.resFactor}`)
    }
  }
  bad1.length === 0
    ? ok('三档 × 每一层：|1+f′| 都能由同一个 |f′| 推出来 —— 两条链确实共用一批 f′，差别只有那个 +1')
    : bad(bad1.slice(0, 2).join(' / '))

  //  ② 理论 exp(N·E[log 因子]) 必须跟实测末值对上（两条链都要）
  const bad2: string[] = []
  for (const depth of DEPTHS) for (const branch of BRANCH) {
    const s = go({ depth, branch })
    for (const [nm, meas, th] of [['普通', s.gradPlain, s.thPlain], ['残差', s.gradRes, s.thRes]] as const)
      if (Math.abs(Math.log10(meas / th)) > 0.02) bad2.push(`${branch}/N=${depth}/${nm}：实测 ${meas} vs 理论 ${th}`)
  }
  bad2.length === 0 ? ok('9 种组合 × 两条链：实测末值都等于 exp(N·E[log 因子]) —— 衰减率是算得出来的')
    : bad(bad2.slice(0, 2).join(' / '))

  //  ③ 残差必须**总是**优于普通（这一档参数范围内），且弱支路时优势大到几十个数量级
  const bad3: string[] = []
  for (const depth of DEPTHS) for (const branch of BRANCH) {
    const s = go({ depth, branch })
    if (s.gradRes <= s.gradPlain) bad3.push(`${branch}/N=${depth}：残差 ${s.gradRes} ≤ 普通 ${s.gradPlain}`)
  }
  const weak = go({ depth: 50, branch: '弱 f′≈0.1' })
  bad3.length === 0 && weak.gradRes / weak.gradPlain > 1e40
    ? ok(`9 种组合里残差全都优于普通；弱支路 50 层时差 ${(weak.gradRes / weak.gradPlain).toExponential(1)} 倍（普通只剩 ${weak.gradPlain.toExponential(1)}）`)
    : bad(bad3.length ? bad3.join(' / ') : `弱支路的优势只有 ${weak.gradRes / weak.gradPlain}`)

  /*  ④ 但残差**不是万能的**：支路一强，它自己也塌。这是补厚后最该保住的一条。
      同时钉住"强"档没有越过标量模型的翻转点（f′=1/√2≈0.707）—— 越过去就会得出
      "残差不如普通"的一维假象，那不该出现在屏幕上。 */
  const strong = go({ depth: 50, branch: '强 f′≈0.6' })
  !strong.resHolds && strong.gradRes > strong.gradPlain && strong.branch < Math.SQRT1_2
    ? ok(`强支路 f′≈${strong.branch}（未越过标量翻转点 ${Math.SQRT1_2.toFixed(3)}）：50 层后残差也塌到 ${strong.gradRes.toExponential(1)}，但仍好过普通的 ${strong.gradPlain.toExponential(1)}`)
    : bad(`强支路那档不对：resHolds=${strong.resHolds}、残差 ${strong.gradRes} vs 普通 ${strong.gradPlain}、branch=${strong.branch}`)

  //  ⑤ 同一支路强度下，越深塌得越狠（两条链都要单调）
  const seq = DEPTHS.map(depth => go({ depth, branch: '中 f′≈0.4' }))
  seq.every((s, k) => k === 0 || (s.gradPlain < seq[k - 1].gradPlain && s.gradRes < seq[k - 1].gradRes))
    ? ok(`中支路：8/16/50 层，普通 ${seq.map(s => s.gradPlain.toExponential(1)).join(' → ')}，残差 ${seq.map(s => s.gradRes.toExponential(1)).join(' → ')}`)
    : bad('加深之后有一条链没有变小 —— 连乘衰减这件事就没演对')
}

// ═══ 反向传播：链一长就是连乘 ═══════════════════════════
console.log('\n【反向传播：梯度消失/爆炸是一串连乘的必然结果】')
{
  const go = (p: P) => last(run(backpropKernel.compile(doc('backprop', p)), 80) as BackpropState[])

  //  ① 回传信号必须**等于**每层因子的连乘 —— 屏幕上那句"每层乘 |w·f′|"就是它
  const bad1: string[] = []
  for (const act of ['sigmoid', 'tanh', 'ReLU']) for (const w of [0.5, 0.8, 1.5]) for (const depth of [4, 8]) {
    const s = go({ act, w, depth })
    const prod = s.layerFactor.slice(1).reduce((a, b) => a * b, 1)   // 第 1 层不再往上传
    if (Math.abs(Math.log(s.chain / prod)) > 0.01) bad1.push(`${act}/w=${w}/L=${depth}：链 ${s.chain} vs 连乘 ${prod.toExponential(2)}`)
  }
  bad1.length === 0 ? ok('18 种组合：回传信号都等于各层 |w·f′| 的连乘 —— 这条链没有别的成分')
    : bad(bad1.slice(0, 3).join(' / '))

  //  ② sigmoid 的 f′ 上界 0.25 是**硬**的：任何 w、任何一层，实测 f′ 都不超过它
  const sg = go({ act: 'sigmoid', w: 1.5, depth: 8 })
  const fps = sg.layerFactor.map((f, k) => f / sg.w)
  Math.max(...fps) <= 0.25 + 1e-9
    ? ok(`sigmoid 各层实测 f′ 最大 ${Math.max(...fps).toFixed(4)} ≤ 0.25 —— 每层至少缩 4 倍，跟 w 多大无关`)
    : bad(`有层的 f′ 超过了 0.25：${Math.max(...fps)}`)

  //  ③ 这个实验的头条：同样 8 层、同样 w，ReLU 比 sigmoid 的回传信号大几个数量级
  const s8 = go({ act: 'sigmoid', w: 0.8, depth: 8 })
  const r8 = go({ act: 'ReLU', w: 0.8, depth: 8 })
  s8.vanish && !r8.vanish && r8.chain / s8.chain > 1000
    ? ok(`8 层 w=0.8：sigmoid 回传只剩 ${s8.chain.toExponential(1)}（判为消失），ReLU 还有 ${r8.chain} —— 大 ${(r8.chain / s8.chain).toExponential(1)} 倍`)
    : bad(`ReLU 没能救回来：sigmoid ${s8.chain}（vanish=${s8.vanish}）vs ReLU ${r8.chain}（vanish=${r8.vanish}）`)

  //  ④ 深度越深塌得越狠（同一激活、同一 w，chain 必须单调下降）
  const dp = [1, 4, 8].map(depth => go({ act: 'sigmoid', w: 0.8, depth }).chain)
  dp.every((v, k) => k === 0 || v < dp[k - 1])
    ? ok(`sigmoid w=0.8：1/4/8 层的回传信号 ${dp.map(v => (v < 1e-3 ? v.toExponential(1) : v)).join(' → ')}`)
    : bad(`深度加深、回传信号没单调变小：${dp.join(' / ')}`)

  /*  ⑤ 这条钉的是**该看哪个数**。ReLU+w=1.5+8 层是真的爆炸（回传放大 17 倍），
      但首末两层的权重梯度之比只有 0.84 —— 因为 dL/dw 还乘着本层输入 a，而 a 同步放大、两头抵消。
      我一开始就是拿 ratio 判的，扫参数才发现它会**漏报爆炸**。 */
  const ex = go({ act: 'ReLU', w: 1.5, depth: 8 })
  ex.explode && ex.chain > 10 && ex.ratio > 0.5 && ex.ratio < 2
    ? ok(`ReLU w=1.5 8 层：回传信号 ${ex.chain} 倍（判为爆炸），而首末权重梯度之比只有 ${ex.ratio} —— 拿 ratio 判会漏报`)
    : bad(`爆炸档的两个数没形成对照：chain=${ex.chain} explode=${ex.explode} ratio=${ex.ratio}`)

  /*  ⑥ b=0.1 不能改回 0.2：ReLU 链的不动点 a*=b/(1−w)，b=0.2、w=0.8 时正好撞上 t=1，
      损失和梯度会全变 0。这条判据钉住"三档 w 一个都不撞 t"。 */
  const zeroish = [0.5, 0.8, 1.5].map(w => go({ act: 'ReLU', w, depth: 8 })).filter(s => s.loss === 0)
  zeroish.length === 0
    ? ok('三档 w 配 ReLU 都没有踩上"输出恰好等于目标"的退化（损失全非 0，梯度演得出来）')
    : bad(`有 ${zeroish.length} 档 ReLU 的损失恒为 0 —— 整屏梯度都会是 0，什么都演不出来`)
}

// ═══ PCA：三个坑，外加一个能逐位核对的恒等式 ═══════════════
console.log('\n【PCA：丢掉一个主成分的代价 = 它的特征值；以及三种它会骗人的情形】')
{
  const go = (p: P) => last(run(pcaKernel.compile(doc('pca', p)), 60) as PCAState[])
  const SHAPES = ['拉长的云', '两团（类别方向≠主方向）', '各向同性（没有主方向）']
  const UNITS = ['x、y 同单位', 'x 换单位（×10）']
  const PREPS = ['直接做', '先标准化（z-score）']

  //  ① 恒等式：重构误差 == λ2。十二种组合一个都不能差 —— 这是屏幕上并排印着的两个数
  const bad1: string[] = []
  for (const data of SHAPES) for (const unit of UNITS) for (const prep of PREPS) {
    const s = go({ data, unit, prep })
    if (Math.abs(s.recErr - s.lam2) > 5e-4) bad1.push(`${data}/${unit}/${prep}：${s.recErr} vs ${s.lam2}`)
  }
  bad1.length === 0 ? ok('12 种组合：重构误差全部等于 λ2 —— "丢掉一个主成分的代价就是它的特征值"')
    : bad(bad1.slice(0, 3).join(' / '))

  //  ② 两团那档：PC1 必须**把两类压扁**，而被丢掉的 PC2 才是判别方向
  const two = go({ data: '两团（类别方向≠主方向）', unit: 'x、y 同单位', prep: '直接做' })
  two.hasClass && two.sep2 > two.sep1 * 3
    ? ok(`两团档：投到 PC1 两类只差 ${two.sep1}σ，投到被丢掉的 PC2 差 ${two.sep2}σ —— 差 ${(two.sep2 / two.sep1).toFixed(1)} 倍`)
    : bad(`两团档没演出 PCA 的失手：sep1=${two.sep1} sep2=${two.sep2}`)

  //  ③ 各向同性：观测比值必须**落在噪声地板以内**（"没有主方向"是有判据的，不是嘴上说）
  const iso = go({ data: '各向同性（没有主方向）', unit: 'x、y 同单位', prep: '直接做' })
  const cloud = go({ data: '拉长的云', unit: 'x、y 同单位', prep: '直接做' })
  !iso.real && cloud.real
    ? ok(`各向同性 λ1/λ2=${iso.ratio} 没超噪声地板 ${iso.nullRatio}（判为"没有主方向"，尽管它照样报了 ${iso.var1}%）；拉长的云 ${cloud.ratio} 远超`)
    : bad(`噪声地板没起作用：各向同性 real=${iso.real}（比 ${iso.ratio}/地板 ${iso.nullRatio}）、拉长 real=${cloud.real}`)

  /*  ④ 单位陷阱：**数据一个点没动**，只换记法，PC1 就该掉头。
      判据钉的是"角度变了很多"，不钉具体几度。 */
  const scaled = go({ data: '拉长的云', unit: 'x 换单位（×10）', prep: '直接做' })
  Math.abs(scaled.angle - cloud.angle) > 20 && scaled.ratio > cloud.ratio * 10
    ? ok(`x 轴 ×10：PC1 从 ${cloud.angle}° 掉到 ${scaled.angle}°，λ1/λ2 从 ${cloud.ratio} 被抬到 ${scaled.ratio} —— 协方差带量纲`)
    : bad(`换单位没把 PC1 带跑（${cloud.angle}° → ${scaled.angle}°）—— 那这个坑就没演出来`)

  //  ⑤ 解药：标准化之后，换不换单位结果必须**分毫不差**
  const bad5: string[] = []
  for (const data of SHAPES) {
    const a = go({ data, unit: 'x、y 同单位', prep: '先标准化（z-score）' })
    const b = go({ data, unit: 'x 换单位（×10）', prep: '先标准化（z-score）' })
    if (a.angle !== b.angle || Math.abs(a.var1 - b.var1) > 1e-9) bad5.push(`${data}：${a.angle}°/${a.var1}% vs ${b.angle}°/${b.var1}%`)
  }
  bad5.length === 0 ? ok('z-score 之后，三种数据换不换单位的结果分毫不差 —— 标准化是那个坑的解药')
    : bad(bad5.join(' / '))

  /*  ⑥ 但标准化**不是"恢复真方向"**：它把两轴尺度拉平，等于换了个问题来解。
      这条钉住的是措辞 —— 我第一版写的是"PC1 就回来了"，实测它去了 45°，不是造数据时的 33°。 */
  const std = go({ data: '拉长的云', unit: 'x、y 同单位', prep: '先标准化（z-score）' })
  std.angle !== std.angleTrue
    ? ok(`标准化本身也转动了 PC1（造数据时是 ${std.angleTrue}°，标准化后是 ${std.angle}°）—— 它给的是"跟单位无关"，不是"真方向"`)
    : bad('标准化后的 PC1 恰好等于造数据的方向 —— 那"它不是恢复真值"这句话就没凭据了')
}

// ═══ 梯度下降：上限是算出来的，动量要成对调 ═══════════════
console.log('\n【梯度下降：稳定上限、理论收缩率、动量】')
{
  const go = (p: P) => last(run(graddescKernel.compile(doc('graddesc', p)), 200) as GradDescState[])
  const NONE = '0（普通梯度下降）', FORM = '公式值 1/(λmin+λmax)'

  //  ① 公式档的**实测**收缩率必须跟理论 (κ−1)/(κ+1) 对上 —— 这一栏是"公式没骗人"的现场核对
  const off = [5, 50].map(k => {
    const s = go({ shape: `${k === 5 ? '椭圆' : '峡谷'} κ=${k}`, lr: FORM, mom: NONE })
    return { k, meas: s.measRate, th: s.rateGd, d: Math.abs(s.measRate - s.rateGd) }
  })
  off.every(o => o.d < 5e-4)
    ? ok(`公式档实测收缩率跟理论逐位对上：${off.map(o => `κ=${o.k} 实测 ${o.meas}/理论 ${o.th}`).join('、')}`)
    : bad(`实测跟理论对不上：${off.map(o => `κ=${o.k} 差 ${o.d}`).join(' / ')}`)

  //  ② 稳定上限必须真的分开收敛与发散（上限本身是算出来的 1/κ）
  const wrong: string[] = []
  for (const shape of ['圆碗 κ=1', '椭圆 κ=5', '峡谷 κ=50']) {
    for (const lr of ['很小（上限的 10%）', '一半（上限的 50%）', FORM, '临界（正好等于上限）', '超限（上限的 110%）']) {
      const s = go({ shape, lr, mom: NONE })
      const should = s.lr > s.lrMaxEff + 1e-12
      if (s.diverged !== should) wrong.push(`${shape}/${lr}：步长 ${s.lr} 上限 ${s.lrMaxEff}，标成${s.diverged ? '发散' : '收敛'}`)
    }
  }
  wrong.length === 0 ? ok('三种谷 × 五档步长：发散标记跟解析判据 lr>(1+β)/κ 完全一致')
    : bad(wrong.slice(0, 3).join(' / '))

  //  ③ 临界档必须**既不炸也不收** —— 这个实验最反直觉的一档
  const crit = go({ shape: '峡谷 κ=50', lr: '临界（正好等于上限）', mom: NONE })
  !crit.diverged && crit.reach < 0 && Math.abs(Math.abs(crit.y) - 4) < 1e-6
    ? ok(`临界档：不发散、也永远到不了（y 走了 36 步还是 ${Math.abs(crit.y)}，跟起点一模一样）`)
    : bad(`临界档表现不对：发散=${crit.diverged}、到 1% 第 ${crit.reach} 步、末了 y=${crit.y}`)

  //  ④ 动量顺带放宽了稳定上限 —— 同一个"超限"档，加了动量就炸不了
  const noMom = go({ shape: '峡谷 κ=50', lr: '超限（上限的 110%）', mom: NONE })
  const withMom = go({ shape: '峡谷 κ=50', lr: '超限（上限的 110%）', mom: '90%' })
  noMom.diverged && !withMom.diverged && withMom.lrMaxEff > withMom.lrMax
    ? ok(`同一档超限步长：不加动量发散，β=90% 时上限从 ${withMom.lrMax} 放宽到 ${withMom.lrMaxEff}，就不炸了`)
    : bad(`动量放宽上限这件事没演出来：无动量 diverged=${noMom.diverged}、有动量 diverged=${withMom.diverged}`)

  //  ⑤ 配套调好的动量，实测收缩率必须**优于普通 GD 的理论最好值**
  const TUNED = '最优（连步长一起配）'
  const tw = [5, 50].map(k => {
    const s = go({ shape: `${k === 5 ? '椭圆' : '峡谷'} κ=${k}`, lr: FORM, mom: TUNED })
    return { k, meas: s.measRate, gd: s.rateGd, ok: s.measRate < s.rateGd }
  })
  tw.every(t => t.ok)
    ? ok(`配套动量实测 ${tw.map(t => `κ=${t.k} ${t.meas}`).join('、')}，都低于普通 GD 的理论最好值 ${tw.map(t => t.gd).join('、')} —— κ 开了平方根`)
    : bad(`配套动量没跑赢普通 GD 的理论界：${tw.map(t => `κ=${t.k} ${t.meas} vs ${t.gd}`).join(' / ')}`)

  /*  ⑥ 反过来钉一条我差点按印象写反的话：**只拧 β、步长不动，会更慢**。
      写文案时我本来要写"动量拧上去就更快"，扫参数才发现椭圆上 β=90% 比 β=0 慢了两倍。
      这条判据就是防止哪天有人（包括我）把这句话又改回去。 */
  const plain = go({ shape: '椭圆 κ=5', lr: FORM, mom: NONE })
  const naive = go({ shape: '椭圆 κ=5', lr: FORM, mom: '90%' })
  naive.reach > plain.reach && plain.reach > 0
    ? ok(`椭圆上只拧 β=90%（步长不配）反而更慢：第 ${naive.reach} 步才进 1%，β=0 只要 ${plain.reach} 步 —— "动量拧上去就更快"是错的`)
    : bad(`只拧 β 居然不更慢（${naive.reach} vs ${plain.reach}）—— 那"要成对调"这句话就没凭据了`)
}

// ═══ 二分查找：前提一破，它**安静地**给错答案 ══════════════
console.log('\n【二分查找：有序是前提，破了不会报错】')
{
  const go = (p: P) => run(binsearchKernel.compile(doc('binsearch', p)), 200) as BinSearchState[]
  const fin = (p: P) => last(go(p))

  //  ① 有序档：比较次数不得超过 ⌈log₂(n+1)⌉，且必须命中真实位置
  const wrong: string[] = []
  for (const arr of ['有序 13 个', '有序 41 个']) {
    for (const target of [3, 42, 60, 63, 95]) {
      const s = fin({ arr, target })
      if (s.compares > s.bound) wrong.push(`${arr} 找 ${target}：${s.compares} 次 > 上界 ${s.bound}`)
      if (s.found !== s.reallyThere) wrong.push(`${arr} 找 ${target}：二分说 ${s.found}、线性扫说 ${s.reallyThere}`)
    }
  }
  wrong.length === 0
    ? ok('两个有序档 × 五个目标：比较次数全在 ⌈log₂(n+1)⌉ 以内，结论跟线性扫逐个一致')
    : bad(wrong.slice(0, 3).join(' / '))

  //  ② 未命中时停下来的 lo 必须正好是**插入位**（小于 target 的元素个数）
  //     —— 结语和读数条都指着这个数；它曾经跟着最后一帧的旧 lo 走、差一格。
  const miss: string[] = []
  for (const arr of ['有序 13 个', '有序 41 个']) {
    for (const target of [3, 42, 60, 63, 95]) {
      const s = fin({ arr, target })
      if (s.found >= 0) continue
      const lb = s.arr.filter(v => v < target).length
      if (s.lo !== lb) miss.push(`${arr} 找 ${target}：停在 lo=${s.lo}，插入位应是 ${lb}`)
    }
  }
  miss.length === 0 ? ok('所有未命中的收场，lo 都等于 lower_bound 插入位')
    : bad(miss.join(' / '))

  //  ③ 乱序档必须**存在**一个"有但没找到"的目标 —— 这个实验补厚后的主菜
  const silent = [3, 42, 60, 63, 95].map(target => fin({ arr: '乱序（前提被破坏）', target }))
    .filter(s => s.found < 0 && s.reallyThere >= 0)
  silent.length > 0
    ? ok(`乱序档有 ${silent.length} 个目标"明明在却报不存在"（如 ${silent[0].target} 就在下标 ${silent[0].reallyThere}，只用了 ${silent[0].compares} 次比较）`)
    : bad('乱序档没有一个静默失败的例子 —— 这个实验最该看见的东西没出场')

  //  ④ 自检：静默失败必须**没有任何异常信号** —— 没报错、次数也没超界
  silent.every(s => s.compares <= s.bound && s.phase === 'done')
    ? ok('静默失败的那几次，比较次数照样在上界内、照样正常收场 —— "它失败得很安静"是真的')
    : bad('静默失败伴随了越界或异常收场 —— 那就不叫"安静"了')

  //  ⑤ 乱序档跟有序档必须是**同一批数**（只是顺序不同），否则对照不成立
  const a = fin({ arr: '有序 13 个', target: 63 }).arr
  const b = fin({ arr: '乱序（前提被破坏）', target: 63 }).arr
  JSON.stringify([...a].sort((x, y) => x - y)) === JSON.stringify([...b].sort((x, y) => x - y))
    ? ok('乱序档跟有序 13 个是同一批数、只是顺序变了 —— 差别只可能来自"有没有序"')
    : bad('两档的元素不一样 —— 对照不干净，说明不了问题出在顺序上')
}

// ═══ 最大熵：指数族不是假设，是搜出来的 ═══════════════════
console.log('\n【最大熵原理：搜索不假设形式，自己走到指数族上】')
{
  const go = (p: P) => run(maxentKernel.compile(doc('maxent', p)), 400) as MaxEntState[]
  const fin = (p: P) => last(go(p))

  /*  ① **这一屏的全部说服力**：搜索在约束平面上爬熵，全程不假设分布形式，
         最后必须落在指数族解析解上。gap 是两者的最大逐项差。 */
  const off: string[] = []
  for (const mode of [MAXENT_MODES[0], MAXENT_MODES[1], MAXENT_MODES[2]]) {
    for (const mu of MAXENT_MUS) {
      const s = fin({ mode, mu, start: '均匀' })
      if (!(s.gap < 1e-6)) off.push(`${mode} μ=${mu}：差 ${s.gap}`)
      if (!(s.feasErr < 1e-9)) off.push(`${mode} μ=${mu}：约束残差 ${s.feasErr}`)
    }
  }
  off.length === 0
    ? ok(`三档约束 × ${MAXENT_MUS.length} 个 μ：爬熵搜出来的分布跟指数族解的最大逐项差都 < 1e-6，约束残差全程 0`)
    : bad(off.slice(0, 3).join(' / '))

  /*  ② **爬到的确实是顶**，而且这句话不是拿爬山自己证的：
         在同一张可行平面上 hit-and-run 撒 3000 个分布，最高的那个也得低于它。 */
  const notTop: string[] = []
  for (const mu of MAXENT_MUS) {
    const s = fin({ mode: MAXENT_MODES[1], mu, start: '均匀' })
    if (s.randN < 2000) notTop.push(`μ=${mu}：3000 发只落进可行集 ${s.randN} 发，这条交叉验证量不出东西`)
    if (s.randBest > s.ent + 1e-9) notTop.push(`μ=${mu}：随机撒到 ${s.randBest} > 爬到 ${s.ent}`)
  }
  notTop.length === 0
    ? ok('随机撒点（hit-and-run，每发都落在可行集里）撞到的最高熵，全部低于爬到的熵')
    : bad(notTop.slice(0, 3).join(' / '))

  /*  ③ **唯一性**：三个天差地别的起点必须收敛到同一个分布。
         这是"最大熵解唯一"那句话的实测版。 */
  const spread: string[] = []
  for (const mu of MAXENT_MUS) {
    const ps = MAXENT_STARTS.map(start => fin({ mode: MAXENT_MODES[1], mu, start }).probs)
    const d = Math.max(...ps[0].map((_, k) => Math.max(...ps.map(p => p[k])) - Math.min(...ps.map(p => p[k]))))
    if (d > 1e-4) spread.push(`μ=${mu}：三个起点最大分歧 ${d}`)
  }
  spread.length === 0
    ? ok(`${MAXENT_STARTS.length} 个起点（均匀 / 全押小点数 / 全押大点数）× ${MAXENT_MUS.length} 个 μ：收敛到同一个分布，逐项分歧 < 1e-4`)
    : bad(spread.join(' / '))

  /*  ④ **锁死档**：五阶矩全给定 ⇒ 自由方向 0 个，熵一句话没说上。
         而答案必须跟"只约束均值"那一档爬出来的**一模一样** —— 同一个分布、两种理由。
         这是补厚后这个实验最想让人记住的一句话，所以单独钉。 */
  const lock: string[] = []
  for (const mu of MAXENT_MUS) {
    const a = fin({ mode: MAXENT_MODES[3], mu, start: '均匀' })
    const b = fin({ mode: MAXENT_MODES[1], mu, start: '均匀' })
    if (a.freedom !== 0) lock.push(`μ=${mu}：五阶矩全给定，自由方向却有 ${a.freedom} 个`)
    const d = Math.max(...a.probs.map((x, k) => Math.abs(x - b.probs[k])))
    if (d > 1e-4) lock.push(`μ=${mu}：锁死档跟只约束均值差 ${d}`)
  }
  lock.length === 0
    ? ok('锁死档（一到五阶矩全给定）自由方向恒为 0，且答案跟"只约束均值"爬出来的完全一致 —— 同一个分布，一次靠约束给够了，一次靠熵')
    : bad(lock.slice(0, 3).join(' / '))

  /*  ⑤ **无解 / 卡死这两档要分得开。**「方差=0」加上 μ：
         μ 是整数 → 有解（全押那一面），但答案在单纯形的角上，一步走不动；
         μ 不是整数 → 真无解。**第一版就在这儿栽过**：交替投影往顶点收敛太慢，
         μ=5 被判成无解，屏幕上会理直气壮印一句假话。 */
  const zv: string[] = []
  for (const mu of MAXENT_MUS) {
    const s = fin({ mode: MAXENT_MODES[4], mu, start: '均匀' })
    const want = Number.isInteger(mu)
    if (s.solvable !== want) zv.push(`μ=${mu}：${want ? '本该有解（全押那一面）' : '本该无解'}，实际 solvable=${s.solvable}`)
    if (want && s.ent !== 0) zv.push(`μ=${mu}：方差 0 的解熵应为 0，实际 ${s.ent}`)
    if (want && s.probs[mu - 1] !== 1) zv.push(`μ=${mu}：该全押第 ${mu} 面，实际 [${s.probs.join(',')}]`)
    if (!want && s.phase !== 'dead') zv.push(`μ=${mu}：无解档 phase=${s.phase}`)
  }
  zv.length === 0
    ? ok('方差=0 档：μ 是整数就有解且全押那一面（熵 0），μ 不是整数就真无解 —— 两种收场分得开')
    : bad(zv.slice(0, 3).join(' / '))

  /*  ⑥ **无解档屏幕上那句"老解法会闷声给你一个错答案"必须是真的。**
         只盯期望点数二分求 λ，它给出的分布均值确实等于 μ（所以看着没毛病），
         但方差那条约束根本不在它眼里 —— 差得离谱。 */
  const naive: string[] = []
  for (const mu of [3.5, 4.5, 5.5, 5.9]) {
    const s = fin({ mode: MAXENT_MODES[4], mu, start: '均匀' })
    if (Math.abs(s.naiveMean - mu) > 1e-3) naive.push(`μ=${mu}：老解法的均值 ${s.naiveMean} 竟然不等于 μ，那它连"看着像回事"都算不上`)
  }
  naive.length === 0
    ? ok('无解档里，老式"只盯均值二分求 λ"照样交得出一个分布、均值也正好等于 μ —— 它失败得毫无破绽，这就是要摆出来的理由')
    : bad(naive.join(' / '))

  /*  ⑦ 自检：这一套判据得会红。把"约束越多熵越低"这条**必然成立**的性质
         拿反着写一遍 —— 若它通过，说明上面量的东西根本没在动。 */
  const chain = [MAXENT_MODES[0], MAXENT_MODES[1], MAXENT_MODES[2]]
    .map(mode => fin({ mode, mu: 5, start: '均匀' }).ent)
  chain[0] > chain[1] && chain[1] > chain[2]
    ? ok(`μ=5 下约束逐条加严，熵单调下降 ${chain.join(' → ')} —— 每一条约束都真的带走了信息量`)
    : bad(`熵没有随约束变严而单调下降：${chain.join(' → ')}`)

  //  自检的自检：反着比必须失败
  !(chain[0] < chain[1] && chain[1] < chain[2])
    ? ok('自检：把单调方向写反，这条判据会红 —— 它量的确实是"约束越多熵越低"')
    : bad('自检失败：正反两个方向都成立，这条判据量不出东西')
}

// ═══ 快速排序：三条退化路径，两种解药 ═══════════════════
console.log('\n【快速排序：最坏情况就在手边，而且反直觉】')
{
  const go = (p: P) => run(quicksortKernel.compile(doc('quicksort', p)), 600) as QuickSortState[]
  const fin = (p: P) => last(go(p))
  const all: { data: string; pivot: string; part: string; s: QuickSortState }[] = []
  for (const data of QS_DATA) for (const pivot of QS_PIVOTS) for (const part of QS_PARTS) {
    all.push({ data, pivot, part, s: fin({ data, pivot, part }) })
  }

  /*  ① 底线：30 个组合，每一个都得真把数排好，而且**还是原来那批数**。
      ⚠️ 第一版这条的"同一批数"写成了 `sorted(arr) === sorted(arr)` —— 左右同一个表达式，
      恒真。判据自己写了句废话，还绿着。这里把每一档**应该**是哪批数独立算出来对（判据自带数据）。 */
  const EXPECT: Record<string, number[]> = {
    '随机打乱': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    '已经排好序': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    '完全逆序': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    '全都一样': [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    //  makeData 的 D_DUP：第 k 个是 (k%3)*3+1，n=10 → 1×4、4×3、7×3，再打乱
    '大量重复（3 种值）': [1, 1, 1, 1, 4, 4, 4, 7, 7, 7],
  }
  const wrong = all.filter(({ data, s }) => {
    const sorted = s.arr.every((v, k) => k === 0 || s.arr[k - 1] <= v)
    const same = JSON.stringify(s.arr) === JSON.stringify(EXPECT[data])
    return !sorted || !same || s.sortedCount !== s.n
  })
  wrong.length === 0
    ? ok(`${all.length} 个参数组合全都真排好了，元素跟各档应有的那批数逐个对得上，且都归了位`)
    : bad(`${wrong.length} 个组合不对，如 ${wrong[0].data}/${wrong[0].pivot}/${wrong[0].part}：[${wrong[0].s.arr.join(',')}]`)

  /*  ② **动画跑的和规模表跑的必须是同一份代码。**
      这是"退化成 n² 是量出来的"这句话的前提 —— 两条路一旦分开写，
      屏幕上演的和曲线上量的可以悄悄变成两个算法，而没有任何东西会报错。 */
  const drift = all.filter(({ s }) => s.compares !== s.totalCompares || s.maxDepth !== s.totalDepth)
  drift.length === 0
    ? ok('每个组合里，逐帧动画数出来的比较次数/递归深度，跟静默规模表在同一个 n 上数出来的完全相等')
    : bad(`${drift.length} 个组合两条路对不上，如 ${drift[0].data}：动画 ${drift[0].s.compares} vs 静默 ${drift[0].s.totalCompares}`)

  /*  ③ **主菜**：已排好序 / 完全逆序 + 末元素基准 + 两路分区 → 比较次数**正好** n(n−1)/2。
      不是"接近"，是逐个 n 一次不差 —— 每趟总有一边是空的，n(n−1)/2 是它的精确值。 */
  const exact: string[] = []
  for (const data of ['已经排好序', '完全逆序']) {
    const s = fin({ data, pivot: QS_PIVOTS[0], part: QS_PARTS[0] })
    for (const r of s.scale) if (r.compares !== r.nsq) exact.push(`${data} n=${r.n}：${r.compares} ≠ ${r.nsq}`)
    if (s.totalDepth !== s.n) exact.push(`${data}：递归深度 ${s.totalDepth}，最坏该是 n=${s.n}`)
  }
  exact.length === 0
    ? ok(`已排好序 / 完全逆序 + 末元素基准：${QS_SCALE_NS.length} 个 n 上比较次数都**正好等于** n(n−1)/2，递归深度正好等于 n`)
    : bad(exact.slice(0, 3).join(' / '))

  /*  ④ **解药一**：同一份有序数据，只把基准换成三数取中或随机，就从平方级回到 n log n。
      "命门和解药并排"这句话得两边都量得到。 */
  const cure: string[] = []
  for (const data of ['已经排好序', '完全逆序']) {
    const bad0 = fin({ data, pivot: QS_PIVOTS[0], part: QS_PARTS[0] })
    if (!bad0.degraded) cure.push(`${data}+末元素 竟然没退化（指数 ${bad0.slope}）`)
    for (const pivot of [QS_PIVOTS[1], QS_PIVOTS[2]]) {
      const g = fin({ data, pivot, part: QS_PARTS[0] })
      if (g.degraded) cure.push(`${data}+${pivot} 仍然退化（指数 ${g.slope}）`)
      const bigBad = last(bad0.scale).compares, bigGood = last(g.scale).compares
      if (!(bigGood < bigBad / 5)) cure.push(`${data}+${pivot} 在 n=${last(g.scale).n} 只降到 ${bigGood}（原 ${bigBad}）`)
    }
  }
  cure.length === 0
    ? ok('同一份有序/逆序数据，只把基准换成三数取中或随机就不再退化，最大 n 上的比较次数降到不足原来的 1/5')
    : bad(cure.slice(0, 3).join(' / '))

  /*  ⑤ **解药二**：元素大量相等是**另一条**退化路径 —— 换基准一点用没有，只有换分区管用。
      这一条是这个实验最容易被记成"随机基准包治百病"的地方，所以正反两面都钉。 */
  const dup: string[] = []
  for (const data of ['全都一样', '大量重复（3 种值）']) {
    for (const pivot of QS_PIVOTS) {
      const two = fin({ data, pivot, part: QS_PARTS[0] })
      if (!two.degraded) dup.push(`${data}+${pivot}+两路 竟然没退化（指数 ${two.slope}）—— "换基准救不了"这句话就不成立了`)
      const three = fin({ data, pivot, part: QS_PARTS[1] })
      if (three.degraded) dup.push(`${data}+${pivot}+三路 仍然退化（指数 ${three.slope}）`)
      if (!(last(three.scale).compares < last(two.scale).compares / 5)) {
        dup.push(`${data}+${pivot}：三路只降到 ${last(three.scale).compares}（两路 ${last(two.scale).compares}）`)
      }
    }
  }
  dup.length === 0
    ? ok('元素大量相等时：三种基准配两路分区**全部**退化，换成三路后**全部**不退化、比较次数降到不足 1/5 —— 换基准救不了，换分区才行')
    : bad(dup.slice(0, 3).join(' / '))

  //  ⑥ 全相等 + 三路：增长指数必须落在 1 附近（每个元素只被看一遍），递归 1 层
  {
    const s = fin({ data: '全都一样', pivot: QS_PIVOTS[0], part: QS_PARTS[1] })
    s.slope <= 1.1 && s.totalDepth === 1
      ? ok(`全相等 + 三路分区：增长指数 ${s.slope}（线性），递归深度 ${s.totalDepth} 层 —— 一趟就把整堆锁定`)
      : bad(`全相等 + 三路：指数 ${s.slope}、深度 ${s.totalDepth}，本该是线性 + 1 层`)
  }

  /*  ⑦ **"退化"这条判定线得留着余量。** 阈值是 1.5：正常档最高与退化档最低之间
      必须留出可见的缝，否则某天噪声一晃就误判 —— 而误判的方向是屏幕上印一句假话。 */
  {
    const normals = all.filter(x => !x.s.degraded).map(x => x.s.slope)
    const bads = all.filter(x => x.s.degraded).map(x => x.s.slope)
    const hiN = Math.max(...normals), loB = Math.min(...bads)
    loB - hiN > 0.1
      ? ok(`退化判定留着缝：正常档指数最高 ${hiN}、退化档最低 ${loB}，中间空着 ${(loB - hiN).toFixed(2)}（阈值 1.5）`)
      : bad(`判定线太挤：正常最高 ${hiN}、退化最低 ${loB} —— 噪声一晃就会误判`)
  }

  /*  ⑧ **不稳定**要有实例，而且只在有等值元素时才下结论。
      没有等值元素时报"稳定"是无从谈起的话，不能算数。 */
  {
    const withTies = all.filter(x => x.s.hasTies)
    const unstable = withTies.filter(x => !x.s.stable)
    const noTies = all.filter(x => !x.s.hasTies)
    withTies.length > 0 && unstable.length > 0 && noTies.every(x => !x.s.hasTies)
      ? ok(`${withTies.length} 个有等值元素的组合里，${unstable.length} 个把等值元素的原始次序打乱了 —— 快排不稳定，屏幕上看得见`)
      : bad(`不稳定没有实例：有等值 ${withTies.length} 个、其中乱序 ${unstable.length} 个`)
    noTies.every(x => !x.s.hasTies)
      ? ok('没有等值元素的档不下"稳不稳定"的结论 —— 那种情况下这件事无从谈起')
      : bad('无等值元素的档也报了稳定性结论')
  }

  //  ⑨ 自检：这一套判据得会红 —— 拿"随机数据"冒充最坏情况，③ 那条必须抓住
  {
    const s = fin({ data: '随机打乱', pivot: QS_PIVOTS[0], part: QS_PARTS[0] })
    const mism = s.scale.filter(r => r.compares !== r.nsq).length
    mism === s.scale.length && !s.degraded
      ? ok(`自检：随机数据在 ${mism} 个 n 上比较次数都不等于 n(n−1)/2、也没被判退化 —— 上面那条"正好等于"量的确实是最坏情况，不是恒真`)
      : bad(`自检失败：随机数据也满足"正好等于 n(n−1)/2"（对上 ${s.scale.length - mism} 个 n），那条判据量不出东西`)
  }
}

// ═══ 决策树：训练误差 0 是个陷阱 ═══════════════════════
console.log('\n【决策树：训练 100% 跟"学会了"长得一模一样】')
{
  const go = (p: P) => run(dtreeKernel.compile(doc('dtree', p)), 400) as DTreeState[]
  const fin = (p: P) => last(go(p))

  /*  ① **留出集必须是真的没见过。** 训练点和留出点同分布、不同样本 —— 一旦有重合，
      "留出准确率"就是自欺欺人，而这个实验全部的说服力都压在那个数上。 */
  const leak: string[] = []
  for (const data of DT_DATA) {
    const s = fin({ data, impurity: DT_IMPURITY[0], depth: 0 })
    const keys = new Set(s.points.map(p => `${p.x},${p.y}`))
    const dup = s.holdout.filter(p => keys.has(`${p.x},${p.y}`)).length
    if (dup > 0) leak.push(`${data}：留出集里有 ${dup} 个点跟训练点重合`)
    if (s.holdout.length < 100) leak.push(`${data}：留出集只有 ${s.holdout.length} 个点，量不出天花板`)
  }
  leak.length === 0
    ? ok(`三档数据的留出集跟训练集**一个点都不重合**，且各 ${fin({ data: DT_DATA[0], impurity: DT_IMPURITY[0], depth: 0 }).holdout.length} 个点`)
    : bad(leak.join(' / '))

  /*  ② **主菜**：噪声档不限深度时，训练必须到 100%、留出必须明显掉下来。
      "训练误差 0 是个陷阱"这句话得有实数撑着。 */
  {
    const s = fin({ data: '四象限 + 噪声', impurity: DT_IMPURITY[0], depth: 0 })
    s.trainAcc === 1 && s.overfit > 0.15
      ? ok(`噪声档不限深度：训练 100%、留出 ${(s.testAcc * 100).toFixed(1)}%，缺口 ${(s.overfit * 100).toFixed(1)}pp（${s.maxLeaves} 个叶子）`)
      : bad(`噪声档没演出过拟合：训练 ${s.trainAcc}、留出 ${s.testAcc}、缺口 ${s.overfit}`)
  }

  /*  ③ **剪枝是解药，而且方向必须是"训练降、留出升"。**
      只验"留出升"不够 —— 训练也跟着升的话那是模型变强了，不是剪枝。 */
  {
    const full = fin({ data: '四象限 + 噪声', impurity: DT_IMPURITY[1], depth: 0 })
    const cut = fin({ data: '四象限 + 噪声', impurity: DT_IMPURITY[1], depth: 2 })
    cut.trainAcc < full.trainAcc && cut.testAcc > full.testAcc
      ? ok(`剪到深 2：训练 ${(full.trainAcc * 100).toFixed(1)}% → ${(cut.trainAcc * 100).toFixed(1)}%（**降**），留出 ${(full.testAcc * 100).toFixed(1)}% → ${(cut.testAcc * 100).toFixed(1)}%（**升**）`)
      : bad(`剪枝方向不对：训练 ${full.trainAcc}→${cut.trainAcc}、留出 ${full.testAcc}→${cut.testAcc}`)
  }

  /*  ④ **深度曲线上的三种形状必须互不相同** —— 它们就是三档数据各自的结论。 */
  const shape: string[] = []
  for (const impurity of DT_IMPURITY) {
    const q = fin({ data: '四象限（两刀切净）', impurity, depth: 0 })
    const n = fin({ data: '四象限 + 噪声', impurity, depth: 0 })
    const d = fin({ data: '对角边界 y = x', impurity, depth: 0 })
    //  刚好够：留出顶到很高，之后一路平
    if (!(q.ceiling > 0.97 && q.declineAfterPeak <= 0.02)) shape.push(`四象限(${impurity})：天花板 ${q.ceiling}、峰后掉 ${q.declineAfterPeak}，本该"高且平"`)
    //  过拟合：留出先升后降
    if (!(n.declineAfterPeak > 0.02)) shape.push(`噪声(${impurity})：峰后只掉 ${n.declineAfterPeak}，看不出"越切越差"`)
    //  天花板：留出一路升但够不到，且训练到过 100%
    if (!(d.declineAfterPeak <= 0.02 && d.ceiling < 0.97)) shape.push(`对角(${impurity})：天花板 ${d.ceiling}、峰后掉 ${d.declineAfterPeak}，本该"升到头就上不去"`)
    if (!(last(d.sweep).train === 1)) shape.push(`对角(${impurity})：训练准确率没到过 100%（${last(d.sweep).train}），"训练满分而留出到顶"这句就不成立`)
  }
  shape.length === 0
    ? ok('三档数据在深度曲线上的形状互不相同：四象限"高且平"、噪声"先升后降"、对角"训练满分而留出到顶就上不去"')
    : bad(shape.slice(0, 3).join(' / '))

  /*  ⑤ **对角档的天花板是形状带来的，不是刀不够。** 同一份数据，
      一条 45° 直线（y > x）在留出集上必须打满分 —— 那是树够不到的那 7 个百分点的去处。 */
  {
    const d = fin({ data: '对角边界 y = x', impurity: DT_IMPURITY[0], depth: 0 })
    const lineAcc = d.holdout.filter(p => (p.y > p.x ? 1 : 0) === p.c).length / d.holdout.length
    lineAcc === 1 && d.ceiling < 0.97
      ? ok(`对角档：一条斜线在同一批留出点上是 100%，而树切到 ${d.maxLeaves} 个叶子只有 ${(d.ceiling * 100).toFixed(1)}% —— 差的那截是"只会切横竖刀"，不是刀不够`)
      : bad(`对角对照不成立：斜线 ${lineAcc}、树天花板 ${d.ceiling}`)
  }

  /*  ⑥ **深度上限真的管用**：树的实际深度不许超过上限，叶子数随上限单调不减。 */
  const cap: string[] = []
  for (const data of DT_DATA) {
    let prevLeaves = 0
    for (const depth of DT_DEPTHS.filter(d => d > 0)) {
      const s = fin({ data, impurity: DT_IMPURITY[0], depth })
      if (s.finalDepth > depth) cap.push(`${data} 上限 ${depth}：实际深了 ${s.finalDepth} 层`)
      if (s.maxLeaves < prevLeaves) cap.push(`${data} 上限 ${depth}：叶子反而少了 ${s.maxLeaves} < ${prevLeaves}`)
      prevLeaves = s.maxLeaves
    }
  }
  cap.length === 0
    ? ok('三档 × 三个深度上限：实际深度都没超过上限，叶子数随上限单调不减')
    : bad(cap.slice(0, 3).join(' / '))

  /*  ⑦ 基尼 vs 信息熵：根节点选的那一刀在三档数据上都一样。
      "实践中两者差别不大"这句话，这里是量出来的。 */
  const same = DT_DATA.map(data => fin({ data, impurity: DT_IMPURITY[0], depth: 0 }).sameAsOther)
  same.every(Boolean)
    ? ok('基尼与信息熵在三档数据上选的**根节点那一刀完全一致** —— "两种指标实践中差别不大"是量出来的')
    : bad(`根节点那一刀在 ${same.filter(x => !x).length} 档上不一致`)

  /*  ⑧ 自检：这一套判据得会红 —— 拿"四象限（无噪声）"冒充过拟合档，②③ 那两条必须抓住。 */
  {
    const full = fin({ data: '四象限（两刀切净）', impurity: DT_IMPURITY[1], depth: 0 })
    const cut = fin({ data: '四象限（两刀切净）', impurity: DT_IMPURITY[1], depth: 2 })
    full.overfit <= 0.15 && !(cut.testAcc > full.testAcc)
      ? ok(`自检：无噪声那档缺口只有 ${(full.overfit * 100).toFixed(1)}pp、剪到深 2 留出也没变好 —— 上面两条量的确实是"噪声导致的过拟合"，不是恒真`)
      : bad(`自检失败：无噪声档也满足"过拟合 + 剪枝有效"（缺口 ${full.overfit}、剪后留出 ${cut.testAcc} vs ${full.testAcc}）`)
  }
}

// ═══ 推荐系统：隐向量是学出来的，而且它本身没有意义 ═══════
console.log('\n【推荐系统 · 矩阵分解：隐向量本身没有意义，只有内积才是模型】')
{
  const go = (p: P) => run(recsysKernel.compile(doc('recsys', p)), 400) as RecSysState[]
  const fin = (p: P) => last(go(p))
  const NORMAL = RS_SCENES[0], COLD = RS_SCENES[1], SPARSE = RS_SCENES[2]

  /*  ① **旋转不变性** —— 这一屏最想让人记住的一句话，也是最容易被讲错的那句。
      把 P 乘一个随机可逆矩阵、Q 乘它的逆：向量必须**真的变了**，而预测必须**一个数都不变**。
      只验后半句不够：R 取成单位阵时后半句自动成立，那就什么也没证明。 */
  const rot: string[] = []
  for (const scene of RS_SCENES) {
    for (const dim of RS_DIMS.filter(k => k >= 2)) {
      const s = fin({ scene, dim, lambda: 0.05 })
      if (!(s.rotGap < 1e-6)) rot.push(`${scene}/k=${dim}：旋转后预测变了 ${s.rotGap}`)
      if (!(s.rotPGap > 0.1)) rot.push(`${scene}/k=${dim}：隐向量只变了 ${s.rotPGap} —— 旋转矩阵太接近单位阵，这条判据什么也没证明`)
    }
  }
  rot.length === 0
    ? ok('旋转 P、逆旋转 Q：隐向量最大变化 > 0.1，而所有预测逐格变化 < 1e-6 —— 隐向量不是定下来的东西，只有内积是')
    : bad(rot.slice(0, 3).join(' / '))

  /*  ② **模型得真学到东西**：配好的那一档必须明显赢过"什么都不学、一律猜基准分"。
      不摆这条基线的话，一个 0.6 的 RMSE 看不出是好是坏。 */
  {
    const s = fin({ scene: NORMAL, dim: 5, lambda: 0.05 })
    s.testRmse < s.baseRmse * 0.75
      ? ok(`配好的一档（k=5、λ=0.05）留出 RMSE ${s.testRmse}，基线（一律猜 ${3.2}）是 ${s.baseRmse} —— 赢了 ${r(s.baseRmse - s.testRmse)}`)
      : bad(`没赢过基线：留出 ${s.testRmse} vs 基线 ${s.baseRmse}`)
  }

  /*  ③ **λ=0 会飞出量程。** 评分只有 1~5 分 —— 预测值飞到哪儿，比 RMSE 更能说明"没有正则不行"。 */
  /*  ⚠️ **普遍成立的那一条要写弱，具体那一档才写强。**
      第一版对三个场景一律要求"λ=0 的留出 RMSE 差一倍以上"，而冷启动档 k=5 时只差 1.57 倍 ——
      判据红了，可产品是对的。**方向（更差、飞出量程）处处成立，倍数不是。** */
  const wild: string[] = []
  for (const scene of RS_SCENES) {
    for (const dim of RS_DIMS.filter(k => k >= 2)) {
      const bad0 = fin({ scene, dim, lambda: 0 })
      const good = fin({ scene, dim, lambda: 0.05 })
      if (!(bad0.testRmse > good.testRmse)) wild.push(`${scene}/k=${dim}：λ=0 的留出 RMSE ${bad0.testRmse} 竟然没比 λ=0.05 的 ${good.testRmse} 更差`)
    }
  }
  wild.length === 0
    ? ok('三场景 × 三个 k 下，λ=0 的留出 RMSE **一律**比 λ=0.05 更差 —— 这个方向处处成立')
    : bad(wild.slice(0, 3).join(' / '))

  /*  ⚠️ 而"λ=0 训练误差更小"这句话**不成立**，别顺手写上去。
      k=2 时 λ=0 的训练 RMSE 反而更大（0.154 vs 0.138）—— 没有正则不是
      "更贴合训练集但不泛化"那种教科书画面，而是**两头都更差**：
      方程组接近奇异，ALS 在两侧之间来回甩，连训练误差都优化不好。
      这一条比那句顺口的话更值得记，所以单独钉住。 */
  {
    const b2 = fin({ scene: NORMAL, dim: 2, lambda: 0 })
    const g2 = fin({ scene: NORMAL, dim: 2, lambda: 0.05 })
    const b5 = fin({ scene: NORMAL, dim: 5, lambda: 0 })
    const g5 = fin({ scene: NORMAL, dim: 5, lambda: 0.05 })
    b2.trainRmse > g2.trainRmse && b5.trainRmse < g5.trainRmse
      ? ok(`λ=0 的训练误差**不一定更小**：k=2 时反而更大（${b2.trainRmse} vs ${g2.trainRmse}，两头都更差），k=5 时才更小（${b5.trainRmse} vs ${g5.trainRmse}）—— "没正则=更贴合训练集"这句顺口话是错的`)
      : bad(`两面的观察对不上：k=2 训练 ${b2.trainRmse}/${g2.trainRmse}，k=5 训练 ${b5.trainRmse}/${g5.trainRmse}`)
  }

  //  最惨的那一档单独钉住：预测值必须真的飞出 1~5 分的量程
  {
    const s = fin({ scene: NORMAL, dim: 2, lambda: 0 })
    const g = fin({ scene: NORMAL, dim: 2, lambda: 0.05 })
    s.predMax > 6 && s.testRmse > g.testRmse * 5
      ? ok(`正常档 k=2：λ=0 训练 ${s.trainRmse}、留出 **${s.testRmse}**，预测量程飞到 ${s.predMin}~${s.predMax}（评分只有 1~5 分）；λ=0.05 时留出只有 ${g.testRmse}`)
      : bad(`最惨那一档不够惨：λ=0 留出 ${s.testRmse}、量程 ${s.predMin}~${s.predMax}，λ=0.05 留出 ${g.testRmse}`)
  }

  /*  ④ **冷启动**：那位用户必须真的一条训练评分都没有、隐向量被压成 0、
      而且他那几格明显比全表差。三条缺一条这个演示就不成立。 */
  {
    const s = fin({ scene: COLD, dim: 2, lambda: 0.05 })
    const n = fin({ scene: NORMAL, dim: 2, lambda: 0.05 })
    s.coldUser >= 0 && s.coldNorm === 0 && s.coldRmse > s.testRmse * 1.3 && n.coldUser < 0
      ? ok(`冷启动：「${s.users[s.coldUser]}」隐向量范数 ${s.coldNorm}，他那几格 RMSE ${s.coldRmse} vs 全表 ${s.testRmse}；而「正常」那一档没有这种用户`)
      : bad(`冷启动演示不成立：coldUser=${s.coldUser} 范数=${s.coldNorm} 他=${s.coldRmse} 全表=${s.testRmse}；正常档 coldUser=${n.coldUser}`)
  }

  /*  ⑤ **冷启动救不了**：加维度、加正则、换 λ 都不能让他那几格变好。
      这是屏幕上那句"没有数据就是没有数据"的实证。 */
  {
    const base = fin({ scene: COLD, dim: 2, lambda: 0.05 }).coldRmse
    const tries = RS_DIMS.flatMap(dim => RS_LAMBDAS.map(lambda => fin({ scene: COLD, dim, lambda }).coldRmse))
    tries.every(x => Math.abs(x - base) < 1e-9)
      ? ok(`冷启动那几格的 RMSE 在 ${tries.length} 组 (k, λ) 下**一模一样**（${base}）—— 加维度、调正则一点用都没有`)
      : bad(`冷启动 RMSE 竟然随参数变了：${[...new Set(tries)].slice(0, 5).join(' / ')}`)
  }

  /*  ⑥ **留出格真的没参与训练**：训练格与留出格不能有交集，且留出格数量要够。 */
  {
    const s = fin({ scene: NORMAL, dim: 2, lambda: 0.05 })
    const cells = s.role.flat()
    const nTrain = cells.filter(x => x === 'train').length
    const nTest = cells.filter(x => x === 'test').length
    nTrain === s.nTrain && nTest === s.nTest && nTest >= 15 && nTrain + nTest < cells.length
      ? ok(`评分表 ${s.role.length}×${s.role[0].length}：训练 ${nTrain} 格、留出 ${nTest} 格、真没打分 ${cells.length - nTrain - nTest} 格，三者互斥且都不空`)
      : bad(`格子身份对不上：训练 ${nTrain}/${s.nTrain}、留出 ${nTest}/${s.nTest}、总 ${cells.length}`)
  }

  /*  ⑦ **k×λ 网格里挑出来的那一格，必须真的是全场最低**（判据自己重算一遍，不信状态里的字段）。 */
  {
    const s = fin({ scene: NORMAL, dim: 2, lambda: 0.05 })
    const best = s.grid.reduce((a, b) => (b.test < a.test ? b : a), s.grid[0])
    s.grid.length === RS_DIMS.length * RS_LAMBDAS.length && best.k === s.bestK && best.lam === s.bestLam
      ? ok(`k×λ 网格 ${s.grid.length} 格齐全，最低点 (k=${s.bestK}, λ=${s.bestLam}) 跟逐格重算的结果一致`)
      : bad(`网格不对：${s.grid.length} 格，声称最低 (${s.bestK}, ${s.bestLam})，实算 (${best.k}, ${best.lam})`)
  }

  /*  ⑧ **稀疏档的天花板是数据量**：同样的 (k, λ) 下，稀疏档必须明显不如正常档。 */
  {
    const n = fin({ scene: NORMAL, dim: 5, lambda: 0.05 })
    const sp = fin({ scene: SPARSE, dim: 5, lambda: 0.05 })
    sp.nTrain < n.nTrain * 0.7 && sp.testRmse / sp.baseRmse > n.testRmse / n.baseRmse
      ? ok(`稀疏档训练格 ${sp.nTrain}（正常档 ${n.nTrain}）：相对基线只做到 ${r(sp.testRmse / sp.baseRmse)}，而正常档是 ${r(n.testRmse / n.baseRmse)} —— 数据量本身就是天花板`)
      : bad(`稀疏档没比正常档差：训练格 ${sp.nTrain}/${n.nTrain}，相对基线 ${r(sp.testRmse / sp.baseRmse)} vs ${r(n.testRmse / n.baseRmse)}`)
  }

  /*  ⑨ 自检：这一套判据得会红 —— 拿"正常档"冒充冷启动档，④ 那条必须抓住。 */
  {
    const n = fin({ scene: NORMAL, dim: 2, lambda: 0.05 })
    n.coldUser < 0 && n.coldRmse === 0
      ? ok('自检：正常档没有零评分用户（coldUser=-1），上面那条冷启动判据量的确实是这个场景独有的，不是恒真')
      : bad(`自检失败：正常档也有冷启动用户 ${n.coldUser}`)
  }
}

// ═══ A*：三句课本结论，全部改成量出来的 ═══════════════════
console.log('\n【A* 寻路：把"h 不高估就保证最优"验到每一格】')
{
  const go = (p: P) => run(astarKernel.compile(doc('astar', p)), 400) as AStarState[]
  const fin = (p: P) => last(go(p))
  const [MAN, EUC] = ASTAR_HEURISTICS
  const [OPEN, WALL, TRAP, SWAMP] = ASTAR_MAPS

  /*  ① **底线**：任何 w 下走出来的都得是一条**真路** —— 首尾对得上、每步只挪一格、不穿墙，
      而且这条路的代价要跟读数里印的那个数一致。不验这条，后面所有比较都是空的。 */
  const broken: string[] = []
  for (const map of ASTAR_MAPS) for (const w of ASTAR_WEIGHTS) {
    const s = fin({ map, weight: w, h: MAN })
    const wallSet = new Set(s.walls), swampSet = new Set(s.swamp)
    if (s.path[0] !== '0,3' || last(s.path) !== '10,3') { broken.push(`${map}/w=${w}：路的首尾是 ${s.path[0]}→${last(s.path)}`); continue }
    let cost = 0, ok2 = true
    for (let i = 1; i < s.path.length; i++) {
      const [c0, r0] = s.path[i - 1].split(',').map(Number)
      const [c1, r1] = s.path[i].split(',').map(Number)
      if (Math.abs(c1 - c0) + Math.abs(r1 - r0) !== 1) { ok2 = false; break }
      if (wallSet.has(s.path[i])) { ok2 = false; break }
      cost += swampSet.has(s.path[i]) ? s.swampCost : 1
    }
    if (!ok2) broken.push(`${map}/w=${w}：路不连续或穿了墙`)
    else if (cost !== s.pathLen) broken.push(`${map}/w=${w}：逐格加出来是 ${cost}，读数印的是 ${s.pathLen}`)
  }
  broken.length === 0
    ? ok(`${ASTAR_MAPS.length} 张图 × ${ASTAR_WEIGHTS.length} 个 w：走出来的都是真路（首尾对、每步一格、不穿墙），逐格加出来的代价跟读数一致`)
    : bad(broken.slice(0, 3).join(' / '))

  /*  ② **"h=0 就是 Dijkstra"**：w=0 时展开数必须接近铺满，而 w=1 明显更少。 */
  /*  ⚠️ **别拿"铺满全图"当判据。** 第一版要求 w=0 展开 ≥95% 的可走格，而开阔图上只有
      59/77 = 77% —— Dijkstra **取到终点就停**，比终点更远的格子根本轮不到展开。
      判据红了，可产品是对的。真正处处成立的是这三条：w=0 展开数是所有 w 里**最多**的、
      它**一定**找到最优、而且比 w=1 多出可观的一截。 */
  const dij: string[] = []
  for (const map of ASTAR_MAPS) {
    const all = ASTAR_WEIGHTS.map(w => fin({ map, weight: w, h: MAN }))
    const d = all[0], a = all[1]
    if (d.weight !== 0) { dij.push(`${map}：第一个权重不是 0`); continue }
    if (d.expanded !== Math.max(...all.map(x => x.expanded))) dij.push(`${map}：w=0 展开 ${d.expanded} 不是最多的（${all.map(x => x.expanded).join('/')}）`)
    /*  ⚠️ **别在这里要求"w=0 比 w=1 多出多少倍"** —— 那会跟下面第 ⑦ 条打架：
        ⑦ 要说的正是"启发省多少取决于地形"，凹形陷阱上只省 33%（64 → 43，才 1.49 倍）。
        同一套判据里两条互相矛盾的话，先红的那条未必是错的那条。 */
    if (!(d.expanded > a.expanded)) dij.push(`${map}：w=0 展开 ${d.expanded} 没多过 w=1 的 ${a.expanded}`)
    if (!d.optimal) dij.push(`${map}：w=0（Dijkstra）竟然没找到最优路`)
  }
  dij.length === 0
    ? ok(`四张图上 w=0 的展开数都是所有权重里**最多**的、都严格多过 w=1、且都找到最优 —— 这就是 Dijkstra（省多少要看地形，见下面第 ⑦ 条）`)
    : bad(dij.slice(0, 3).join(' / '))

  /*  ③ **"h 越紧越好（只要都不高估）"**：曼哈顿和欧氏在 w=1 时都可采纳，
      而更松的欧氏展开得更多。两个条件缺一不可 —— 只说"欧氏更慢"没意义，得先证它也不高估。 */
  const tight: string[] = []
  for (const map of ASTAR_MAPS) {
    const m = fin({ map, weight: 1, h: MAN })
    const e = fin({ map, weight: 1, h: EUC })
    if (!m.admissible || !e.admissible) tight.push(`${map}：w=1 下曼哈顿/欧氏竟然不都可采纳（${m.admissible}/${e.admissible}）`)
    if (!(e.expanded >= m.expanded)) tight.push(`${map}：更松的欧氏展开 ${e.expanded}，反而少于曼哈顿的 ${m.expanded}`)
    if (!m.optimal || !e.optimal) tight.push(`${map}：可采纳的 h 竟然没找到最优路`)
  }
  tight.length === 0
    ? ok(`w=1 下曼哈顿与欧氏**都可采纳、都找到最优**，而更松的欧氏一律展开得不比曼哈顿少 —— "h 越紧越好"是量出来的`)
    : bad(tight.slice(0, 3).join(' / '))

  /*  ④ **可采纳性的定义本身要复核**：判据自己拿真值表重算一遍 max(w·h − 真实代价)，
      不信状态里的 `admissible` 字段。**判据不该拿被测对象的自我声明当证据。** */
  {
    const s = fin({ map: SWAMP, weight: 5, h: MAN })
    let over = 0, at = ''
    for (const k of Object.keys(s.trueDist)) {
      const [c, r] = k.split(',').map(Number)
      const hv = 5 * (Math.abs(c - 10) + Math.abs(r - 3))
      if (hv - s.trueDist[k] > over) { over = hv - s.trueDist[k]; at = k }
    }
    Math.abs(over - s.maxOver) < 1e-6 && at === s.overAt && s.admissible === (over <= 1e-9)
      ? ok(`可采纳性判定复核通过：判据自己重算的最大超出量 ${over}（在 ${at}）跟状态里印的一致`)
      : bad(`可采纳性对不上：判据算 ${over}@${at}，状态印 ${s.maxOver}@${s.overAt}`)
  }

  /*  ⑤ **主菜**：沼泽 + w=5 必须真的走冤枉路，而 w=1 必须最优。
      这是"快是拿正确性换的"唯一的实证 —— 前三张图上 w=5 照样最优，**换句话说：
      光有 w 这个旋钮还不够，得有地形代价才构造得出反例**。 */
  {
    const bad5 = fin({ map: SWAMP, weight: 5, h: MAN })
    const good = fin({ map: SWAMP, weight: 1, h: MAN })
    !bad5.optimal && bad5.pathLen > good.pathLen && bad5.expanded < good.expanded && good.optimal
      ? ok(`沼泽 + w=5：只展开 ${bad5.expanded} 格（w=1 要 ${good.expanded}），而代价 ${bad5.pathLen} vs 最优 ${good.pathLen} —— **快是拿正确性换的**`)
      : bad(`沼泽档没演出这个权衡：w=5 展开 ${bad5.expanded} 代价 ${bad5.pathLen}（最优？${bad5.optimal}）、w=1 展开 ${good.expanded} 代价 ${good.pathLen}`)
  }

  /*  ⑥ **"高估就一定走冤枉路"是错的** —— 必须真有反例，否则那句"不保证 ≠ 一定错"就是空话。 */
  {
    const cases: string[] = []
    for (const map of ASTAR_MAPS) for (const h of ASTAR_HEURISTICS) for (const w of [1.4, 5]) {
      const s = fin({ map, weight: w, h })
      if (!s.admissible && s.optimal) cases.push(`${map}/${h}/w=${w}`)
    }
    cases.length > 0
      ? ok(`不可采纳却照样找到最优路的组合有 ${cases.length} 个（如 ${cases[0]}）—— **定理给的是保证，撤掉保证不等于结果错**`)
      : bad('没有一个"高估却仍最优"的例子 —— "不保证 ≠ 一定错"这句话在屏幕上落不了地')
  }

  /*  ⑦ **"有启发总是更快"也是错的**：凹形陷阱上 h 的收益必须明显小于开阔图。 */
  {
    const o0 = fin({ map: OPEN, weight: 0, h: MAN }), o1 = fin({ map: OPEN, weight: 1, h: MAN })
    const t0 = fin({ map: TRAP, weight: 0, h: MAN }), t1 = fin({ map: TRAP, weight: 1, h: MAN })
    const saveOpen = 1 - o1.expanded / o0.expanded
    const saveTrap = 1 - t1.expanded / t0.expanded
    saveOpen > 0.7 && saveTrap < 0.4
      ? ok(`启发的收益跟地形有关：开阔图省了 ${(saveOpen * 100).toFixed(0)}%（${o0.expanded}→${o1.expanded}），凹形陷阱只省 ${(saveTrap * 100).toFixed(0)}%（${t0.expanded}→${t1.expanded}）`)
      : bad(`两张图上启发的收益差不出来：开阔省 ${(saveOpen * 100).toFixed(0)}%、陷阱省 ${(saveTrap * 100).toFixed(0)}%`)
  }

  /*  ⑧ 自检：这一套判据得会红 —— 拿"一堵墙"冒充沼泽档，⑤ 那条必须抓住。 */
  {
    const s = fin({ map: WALL, weight: 5, h: MAN })
    s.optimal
      ? ok('自检：均匀代价的「一堵墙」图上 w=5 照样找到最优路 —— 上面那条"走冤枉路"量的确实是沼泽档独有的，不是恒真')
      : bad(`自检失败：均匀代价图上 w=5 也走了冤枉路（代价 ${s.pathLen}、最优 ${s.optimalLen}）`)
  }
}

// ═══ 并查集：「均摊近乎 O(1)」是有前提的 ═══════════════════
console.log('\n【并查集：不上优化时它是 O(n²)】')
{
  const go = (p: P) => run(unionfindKernel.compile(doc('unionfind', p)), 400) as UnionFindState[]
  const fin = (p: P) => last(go(p))
  const [NAIVE, RANK] = UF_UNIONS
  const [OFF, ON] = UF_COMPRESS
  const [CHAIN, RANDOM, PAIR] = UF_SEQS

  /*  ① **底线**：不管哪一档，跑完都得真的并成一团，而且每个点顺父指针一定爬得到根
      （不成环、不指向自己以外的自己）。不验这条，后面所有步数比较都是空的。 */
  const broken: string[] = []
  for (const seq of UF_SEQS) for (const union of UF_UNIONS) for (const compress of UF_COMPRESS) {
    const s = fin({ union, compress, seq })
    if (s.comps !== 1) { broken.push(`${seq}/${union}/${compress}：跑完还剩 ${s.comps} 个分量`); continue }
    for (let x = 0; x < s.n; x++) {
      let cur = x, hops = 0
      while (s.parent[cur] !== cur && hops <= s.n) { cur = s.parent[cur]; hops++ }
      if (hops > s.n) { broken.push(`${seq}/${union}/${compress}：从 ${x} 爬不到根（成环了）`); break }
    }
  }
  broken.length === 0
    ? ok(`${UF_SEQS.length * UF_UNIONS.length * UF_COMPRESS.length} 种组合跑完都并成 1 个分量，且每个点都爬得到根（没有环）`)
    : bad(broken.slice(0, 3).join(' / '))

  /*  ② **主菜**：朴素 + 不压缩 + 最坏序列必须是平方级，且树深正好等于 n−1（一条链）。
      "并查集很快"这句话的前提，就靠这一条撑着。 */
  {
    const s = fin({ union: NAIVE, compress: OFF, seq: CHAIN })
    const rows = s.scale.find(x => x.unionKind === NAIVE && x.compress === OFF)!.rows
    const badRows = rows.filter(r => r.depth !== r.n - 1)
    s.degraded && s.slope > 1.9 && badRows.length === 0
      ? ok(`朴素 + 不压缩 + 最坏序列：${UF_SCALE_NS.length} 个 n 上树深都正好是 n−1（一条链），实测增长指数 ${s.slope} —— 这是 O(n²)`)
      : bad(`没演出退化：指数 ${s.slope}，树深不对的有 ${badRows.length} 行`)
  }

  /*  ③ **任一个优化都够用**：三条序列上，只要开一个，指数就掉到 1.5 以下、步数降到不足 1/10。
      两个都要求 —— 只说"变快了"没意义，得同时是"不再是平方级"。 */
  const cure: string[] = []
  for (const seq of UF_SEQS) {
    const base = fin({ union: NAIVE, compress: OFF, seq })
    const baseBig = last(base.scale.find(x => x.unionKind === NAIVE && x.compress === OFF)!.rows).steps
    for (const [u, c, tag] of [[RANK, OFF, '只按秩'], [NAIVE, ON, '只压缩'], [RANK, ON, '两个都上']] as const) {
      const g = fin({ union: u, compress: c, seq })
      if (g.degraded) cure.push(`${seq}/${tag}：指数 ${g.slope}，仍是平方级`)
      const big = last(g.scale.find(x => x.unionKind === u && x.compress === c)!.rows).steps
      //  链式序列上差 64 倍，另两条序列没那么夸张 —— 只要求"明显更省"
      if (seq === CHAIN && !(big < baseBig / 10)) cure.push(`${seq}/${tag}：n=256 只降到 ${big}（原 ${baseBig}）`)
      if (!(big <= baseBig)) cure.push(`${seq}/${tag}：${big} 步反而多过朴素+不压缩的 ${baseBig}`)
    }
  }
  cure.length === 0
    ? ok('三条序列 × 三种"至少开一个优化"的组合：全部不再是平方级，且链式序列上步数降到不足 1/10')
    : bad(cure.slice(0, 3).join(' / '))

  /*  ④ **按秩合并的树深真的是 log n** —— 但只在「两两归并」那条序列上量得到。
      另两条序列上它恒等于 1，那是**序列的巧合**（union 的一边永远是个单点）。
      两面都钉：不钉后半句的话，屏幕上"按秩合并 = 深度 1"这个错觉没人拦。 */
  {
    const s = fin({ union: RANK, compress: OFF, seq: PAIR })
    const rows = s.scale.find(x => x.unionKind === RANK && x.compress === OFF)!.rows
    const wrong = rows.filter(r => r.depth !== Math.log2(r.n))
    const flat = [CHAIN, RANDOM].map(q => fin({ union: RANK, compress: OFF, seq: q }))
    const flatRows = flat.map(f => last(f.scale.find(x => x.unionKind === RANK && x.compress === OFF)!.rows).depth)
    wrong.length === 0 && flatRows.every(d => d === 1)
      ? ok(`按秩合并 + 两两归并：${rows.length} 个 n 上树深都**正好等于 log₂n**（n=256 时是 8）；而另两条序列上它恒等于 1 —— 那是序列的巧合，不是算法的性质`)
      : bad(`树深对不上：两两归并有 ${wrong.length} 行不等于 log₂n，另两条序列的深度是 ${flatRows.join('/')}`)
  }

  /*  ⑤ **路径压缩之后树深必须真的塌到 1** —— "事后拍平"这句话的实测版。 */
  const flatten: string[] = []
  for (const seq of UF_SEQS) for (const union of UF_UNIONS) {
    const s = fin({ union, compress: ON, seq })
    if (s.finalDepth !== 1) flatten.push(`${seq}/${union}：压缩之后最终树深还是 ${s.finalDepth}`)
    const rows = s.scale.find(x => x.unionKind === union && x.compress === ON)!.rows
    if (rows.some(r => r.depth !== 1)) flatten.push(`${seq}/${union}：规模表里有 n 的树深不是 1`)
  }
  flatten.length === 0
    ? ok('打开路径压缩后，六种组合在所有 n 上的最终树深**都是 1** —— 爬过的链被一次拍平')
    : bad(flatten.slice(0, 3).join(' / '))

  /*  ⑥ **union 内部的 find 也计入总步数** —— 不计的话按秩合并会白占便宜。
      验法：按秩 + 不压缩 + 两两归并，树深是 log n，那么总步数必须**明显多于** n
      （每次 union 里的两次 find 都要爬）。若只统计显式 find，这个数会小得多。 */
  {
    const s = fin({ union: RANK, compress: OFF, seq: PAIR })
    const rows = s.scale.find(x => x.unionKind === RANK && x.compress === OFF)!.rows
    const big = last(rows)
    big.steps > big.n * 2
      ? ok(`按秩 + 不压缩 + 两两归并：n=${big.n} 时累计 ${big.steps} 步 > 2n —— union 内部那两次 find 确实记在账上了`)
      : bad(`总步数 ${big.steps} 只有 n=${big.n} 的 ${(big.steps / big.n).toFixed(1)} 倍 —— union 里的 find 好像没计入`)
  }

  /*  ⑦ **这个实验量不到的那一格，得如实承认。** 课本说"只用一个优化是 O(log n)、
      两个都用才近乎常数"，而这张表上开一个和开两个几乎一模一样。
      判据不去要求"两个更快"（那会红，而红的是规模不够），改成**钉住"确实分不出来"** ——
      哪天换了更大的 n 真分出来了，这条会红，那正是该改文案的时候。 */
  {
    const one = [fin({ union: RANK, compress: OFF, seq: CHAIN }), fin({ union: NAIVE, compress: ON, seq: CHAIN })]
      .map(f => last(f.scale.find(x => x.unionKind === f.unionKind && x.compress === f.compress)!.rows).steps)
    const both = last(fin({ union: RANK, compress: ON, seq: CHAIN })
      .scale.find(x => x.unionKind === RANK && x.compress === ON)!.rows).steps
    Math.abs(Math.min(...one) - both) < both * 0.15
      ? ok(`量不到的一格已如实标注：开一个优化 ${one.join('/')} 步 vs 开两个 ${both} 步，n≤${last([...UF_SCALE_NS])} 上分不出来（log₂256=8、α(256)≤4，差距被常数吃掉）`)
      : bad(`开一个(${one.join('/')})和开两个(${both})已经分得出来了 —— 屏幕上那句"这个实验量不到"该改了`)
  }

  /*  ⑧ 自检：这一套判据得会红 —— 拿"两两归并"冒充最坏序列，② 那条必须抓住。 */
  {
    const s = fin({ union: NAIVE, compress: OFF, seq: PAIR })
    !s.degraded && s.finalDepth < s.n - 1
      ? ok(`自检：两两归并序列上朴素+不压缩也没退化（指数 ${s.slope}、树深 ${s.finalDepth}）—— 上面那条量的确实是"最坏序列"，不是恒真`)
      : bad(`自检失败：两两归并序列上也退化了（指数 ${s.slope}、树深 ${s.finalDepth}）`)
  }
}

// ═══ 归并排序：稳定是一个字符，没有坏情况是拿空间换的 ═══════
console.log('\n【归并排序：三句课本结论，全部改成量出来的】')
{
  const go = (p: P) => run(mergesortKernel.compile(doc('mergesort', p)), 800) as MergeSortState[]
  const fin = (p: P) => last(go(p))
  const [RAND, SORTED, REV, DUP] = MS_DATA
  const [LEFT, RIGHT] = MS_TIES
  const [POW2, NATURAL] = MS_PASSES

  /*  ① **底线**：所有组合都得真排好，而且元素还是原来那一批（判据自带期望数据）。 */
  const EXPECT: Record<string, number[]> = {
    [RAND]: Array.from({ length: 12 }, (_, k) => k + 1),
    [SORTED]: Array.from({ length: 12 }, (_, k) => k + 1),
    [REV]: Array.from({ length: 12 }, (_, k) => k + 1),
    //  makeData 的 D_DUP：第 k 个是 (k%4)*2+1，n=12 → 1/3/5/7 各 3 个
    [DUP]: [1, 1, 1, 3, 3, 3, 5, 5, 5, 7, 7, 7],
  }
  const wrong: string[] = []
  for (const data of MS_DATA) for (const tie of MS_TIES) for (const pass of MS_PASSES) {
    const s = fin({ data, tie, pass })
    if (JSON.stringify(s.arr) !== JSON.stringify(EXPECT[data])) wrong.push(`${data}/${tie}/${pass}：[${s.arr.join(',')}]`)
  }
  wrong.length === 0
    ? ok(`${MS_DATA.length * MS_TIES.length * MS_PASSES.length} 种组合全都排好了，元素跟各档应有的那批数逐个对得上`)
    : bad(wrong.slice(0, 3).join(' / '))

  /*  ② **主菜之一：稳定性就是一个字符。**
      同一份数据、同一个算法，只换"相等时取左还是取右"：
      排序结果必须**一模一样**，而等值元素的原序必须一个稳一个不稳。
      两条缺一不可 —— 只验"不稳"不够，得先证明结果没变，否则那就是另一个算法了。 */
  {
    const a = fin({ data: DUP, tie: LEFT, pass: POW2 })
    const b = fin({ data: DUP, tie: RIGHT, pass: POW2 })
    const sameResult = JSON.stringify(a.arr) === JSON.stringify(b.arr)
    sameResult && a.hasTies && b.hasTies && a.stable && !b.stable
      ? ok(`「相等取左」vs「相等取右」：排序结果**逐个相同** [${a.arr.join(',')}]，而原序一个保住、一个被打乱 —— 稳定性就是这一个字符`)
      : bad(`稳定性演示不成立：结果相同=${sameResult}、取左稳=${a.stable}、取右稳=${b.stable}`)
  }

  /*  ③ 没有等值元素时不许下"稳不稳定"的结论 —— 那种情况下这件事无从谈起。 */
  {
    const noTies = [RAND, SORTED, REV].map(d => fin({ data: d, tie: LEFT, pass: POW2 }))
    noTies.every(s => !s.hasTies)
      ? ok('三档无重复值的数据都不给稳定性结论 —— 没有等值元素时这件事无从谈起')
      : bad(`有档在没有等值元素时也报了稳定性：${noTies.filter(s => s.hasTies).length} 个`)
  }

  /*  ④ **主菜之二：没有坏情况。** 固定倍增下，四种数据形状的比较次数必须几乎不动。
      而且这个"几乎"要有个数：判据自己从 shapeSweep 重算一遍倍数，不信状态里的字段。 */
  {
    const s = fin({ data: RAND, tie: LEFT, pass: POW2 })
    const bigs = s.shapeSweep.map(x => last(x.rows).compares)
    const spread = +(Math.max(...bigs) / Math.min(...bigs)).toFixed(2)
    spread < 3 && Math.abs(spread - s.shapeSpread) < 1e-9 && s.shapeSweep.every(x => x.slope < 1.5)
      ? ok(`固定倍增：四种数据形状在 n=${last([...MS_SCALE_NS])} 上比较 ${bigs.join(' / ')} 次，最费的只多 ${spread} 倍，四条曲线指数都 < 1.5 —— **没有坏情况**`)
      : bad(`形状差不成立：${bigs.join('/')}，倍数 ${spread}（状态里印的是 ${s.shapeSpread}）`)
  }

  /*  ⑤ **跟快排并排才有意义。** 判据直接把快排那一屏的对照拉过来算一遍：
      同样换数据形状，快排的差距必须**远大于**归并。两屏说的是同一件事的两面。 */
  {
    const ms = fin({ data: RAND, tie: LEFT, pass: POW2 })
    const msSpread = Math.max(...ms.shapeSweep.map(x => last(x.rows).compares)) / Math.min(...ms.shapeSweep.map(x => last(x.rows).compares))
    const qs = ['随机打乱', '已经排好序'].map(d =>
      last(last(run(quicksortKernel.compile(doc('quicksort', { data: d, pivot: '末元素（教科书）', part: 'Lomuto 两路' })), 600) as QuickSortState[]).scale).compares)
    const qsSpread = Math.max(...qs) / Math.min(...qs)
    qsSpread > msSpread * 3
      ? ok(`跟快排并排：同样换数据形状，归并差 ${msSpread.toFixed(2)} 倍、快排差 ${qsSpread.toFixed(2)} 倍（${qs.join(' → ')}）—— 两屏说的是同一件事的两面`)
      : bad(`两屏对照不成立：归并 ${msSpread.toFixed(2)} 倍、快排只有 ${qsSpread.toFixed(2)} 倍`)
  }

  /*  ⑥ **主菜之三：代价是空间。** 缓冲区峰值必须等于 n（自底向上最后一趟要归并整个数组），
      而且逐帧的峰值只增不减、末帧等于总值。 */
  {
    const s = fin({ data: RAND, tie: LEFT, pass: POW2 })
    const frames = go({ data: RAND, tie: LEFT, pass: POW2 })
    const monotone = frames.every((f, k) => k === 0 || f.bufPeak >= frames[k - 1].bufPeak)
    s.totalBuf === s.n && monotone && last(frames).bufPeak === s.totalBuf
      ? ok(`缓冲区峰值 ${s.totalBuf} = n（最后一趟要归并整个数组），逐帧只增不减 —— 这就是归并"没有坏情况"付的那笔账，而快排这一栏是 0`)
      : bad(`缓冲区账不对：峰值 ${s.totalBuf}（n=${s.n}）、单调=${monotone}`)
  }

  /*  ⑦ **自然归并两面都要钉。** 好的一面：已排好序时 0 趟、缓冲 0。
      坏的一面：随机数据上它**反而更亏**（每趟要重扫一遍找有序段）。
      只钉好的一面，屏幕上就会留下"自然归并总是更好"的错觉。 */
  {
    const sortedNat = fin({ data: SORTED, tie: LEFT, pass: NATURAL })
    const sortedPow = fin({ data: SORTED, tie: LEFT, pass: POW2 })
    const randNat = fin({ data: RAND, tie: LEFT, pass: NATURAL })
    const randPow = fin({ data: RAND, tie: LEFT, pass: POW2 })
    sortedNat.totalPasses === 0 && sortedNat.totalBuf === 0 && sortedNat.totalCompares < sortedPow.totalCompares
      && randNat.totalCompares > randPow.totalCompares
      ? ok(`自然归并两面都真：已排好序时 **0 趟、缓冲 0**（比较 ${sortedNat.totalCompares} < 固定倍增的 ${sortedPow.totalCompares}）；而随机数据上它**反而更亏**（${randNat.totalCompares} > ${randPow.totalCompares}）—— 它赌的是"数据本来就局部有序"`)
      : bad(`自然归并的账不对：有序档 ${sortedNat.totalPasses} 趟/缓冲 ${sortedNat.totalBuf}/比较 ${sortedNat.totalCompares}(vs ${sortedPow.totalCompares})、随机档 ${randNat.totalCompares}(vs ${randPow.totalCompares})`)
  }

  /*  ⑧ **有了"好情况"就等于承认了"坏情况"** —— 自然归并的形状差必须明显大于固定倍增的。
      这一条是上一条的必然推论，但它值得单独印在屏幕上，所以也单独钉。 */
  {
    const nat = fin({ data: RAND, tie: LEFT, pass: NATURAL })
    const pow = fin({ data: RAND, tie: LEFT, pass: POW2 })
    nat.shapeSpread > pow.shapeSpread * 3
      ? ok(`自然归并的数据形状差 ${nat.shapeSpread} 倍 ≫ 固定倍增的 ${pow.shapeSpread} 倍 —— **有了"好情况"，就等于承认了"坏情况"**`)
      : bad(`两种分段方式的形状差没拉开：自然 ${nat.shapeSpread}、固定 ${pow.shapeSpread}`)
  }

  /*  ⑨ 自检：这一套判据得会红 —— 拿无重复值的数据冒充稳定性演示，② 那条必须抓住。 */
  {
    const a = fin({ data: RAND, tie: LEFT, pass: POW2 })
    const b = fin({ data: RAND, tie: RIGHT, pass: POW2 })
    !a.hasTies && !b.hasTies && JSON.stringify(a.tags) === JSON.stringify(b.tags)
      ? ok('自检：没有重复值时，换取小规则连元素的原始下标都一模一样 —— 上面那条稳定性判据量的确实是等值元素，不是恒真')
      : bad(`自检失败：无重复值的数据上换规则竟然改变了排列（hasTies ${a.hasTies}/${b.hasTies}）`)
  }
}

console.log(failures === 0 ? '\n本套全部通过' : `\n${failures} 处不对`)
process.exit(failures === 0 ? 0 : 1)
