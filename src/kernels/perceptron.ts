/**
 * 内核：感知机 Perceptron（深度学习算法 · 原理：一个神经元靠"错了就纠"学出一条分界线）
 * 轴：step —— 平面上两类点,感知机=一条线 w·x+b=0。逐点检查:分对了不动,分错了就把线朝该点**纠一下**
 *      (w += y·x, b += y),一轮轮扫,直到某一整轮**零错误**——线就学好了(数据线性可分时保证收敛)。
 *
 * 感知机是神经网络的**最小单元**:给输入各配一个权重 w、加个偏置 b,算 w·x+b,看正负判类别——
 * 几何上就是一条**分界线**(高维是超平面)。它怎么"学"?**错了就纠**:遇到一个分错的点,
 * 把权重朝"下次能分对它"的方向挪一点(w += y·x、b += y,y=±1 是真实类别)。反复扫所有点,
 * 只要两类**线性可分**,感知机收敛定理保证有限步内学到一条能全分对的线。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本 6 个点、必然收敛。收敛定理是演到了，可它的结语里那句
 * 「**只对线性可分才收敛**」屏幕上一次都没兑现过 —— 而那才是感知机在历史上的位置：
 * 1969 年 Minsky 和 Papert 用一个异或就把它按了下去，直接带来了第一次 AI 寒冬。
 *
 * 补厚补三档数据，每档顶一个问题：
 *   · **线性可分**（原来那 6 个点，原样留着）—— 收敛定理成立的样子。
 *   · **异或** —— 四个点，怎么画一条直线都分不开。它**不会慢慢收敛**，而是**陷进循环**：
 *     权重走着走着回到出现过的状态，然后无限重复。屏幕上会把"第几轮跟第几轮一模一样"点出来。
 *   · **一个噪声点** —— 比异或更贴近实践：数据本来可分，混进一个标错的点，它就永远停不下来。
 *
 * 还补了一条**实践里最容易吃亏**的：感知机**不记得最好的那次**。
 * 它只有"当前的 w"，跑到最后停在哪儿全看运气 —— 中途明明出现过只错 1 个的权重，
 * 最后交出来的可能错 3 个。屏幕上因此并排摆着「此刻错几个」和「历史最好错几个」。
 * 这个差距就是 **pocket algorithm**（把见过的最好权重揣兜里）存在的全部理由。
 */
import { str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Pt = { x: [number, number]; y: number }
//  原来那 6 个点：线性可分，5 次更新收敛
const SEP: Pt[] = [
  { x: [1, 2], y: 1 }, { x: [2, 3], y: 1 }, { x: [2, 4], y: 1 },
  { x: [3, 2], y: -1 }, { x: [4, 3], y: -1 }, { x: [4, 1], y: -1 },
]
/*  同一批点，外加一个**标错的正例 (4,2)** —— 它正好夹在两个负例 (4,1) 和 (4,3) 中间。
    ⚠️ 这个点是**算过**才选的：第一版是把 (2,3) 的标签翻成负，结果数据**仍然线性可分**
    （w=(−3,2)、b=−0.5 就能分开），那一档照样收敛，"噪声让它停不下来"根本没演出来。
    而 (4,2) 跟 (4,1)、(4,3) 在同一条竖线上、还夹在正中间 ——
    任何直线都不可能把它跟那两个分到两边，**不可分是几何保证的**。 */
const NOISY: Pt[] = [...SEP, { x: [4, 2], y: 1 }]
//  异或：怎么画一条直线都分不开（Minsky & Papert 1969 拿来按住感知机的就是它）
const XOR: Pt[] = [
  { x: [0, 0], y: -1 }, { x: [1, 1], y: -1 },
  { x: [0, 1], y: 1 }, { x: [1, 0], y: 1 },
]
const DATA: Record<string, Pt[]> = { '线性可分': SEP, '一个噪声点': NOISY, '异或（怎么画都分不开）': XOR }
const MAX_PASS = 12

export type PerceptronState = {
  i: number
  step: number
  pts: Pt[]
  w: [number, number]
  b: number
  prevW: [number, number]
  prevB: number
  pass: number
  ptIdx: number                // 当前检查的点（-1=收敛帧）
  score: number
  ok: boolean
  updated: boolean
  updates: number
  act: string                  // 'check' | 'converged' | 'done'
  //  ── 补厚 ──
  dataTag: string
  converged: boolean
  passes: number               // 实际跑了几轮
  mistakesNow: number          // 当前 w 在全体点上错几个
  bestMistakes: number         // 见过的最好权重错几个（pocket）
  bestW: [number, number]
  bestB: number
  cycleAt: [number, number] | null   // [第 a 轮, 第 b 轮] 权重状态重复 —— 陷进循环的铁证
  phase: 'run' | 'done'
  log: string
}

export const PERCEPTRON_VISIBLE = [
  'step', 'pts', 'w', 'b', 'prevW', 'prevB', 'pass', 'ptIdx', 'score', 'ok', 'updated', 'updates', 'act',
  'dataTag', 'converged', 'passes', 'mistakesNow', 'bestMistakes', 'bestW', 'bestB', 'cycleAt', 'phase', 'log',
] as const

type Frame = Omit<PerceptronState, 'i'>

export const perceptronKernel: Kernel<PerceptronState> = {
  kind: 'perceptron',

  compile(doc: SimDocument): CompiledModel<PerceptronState> {
    const dataTag = doc.params.data === undefined ? '线性可分' : str(doc.params, 'data')
    const PTS = DATA[dataTag] ?? SEP

    const frames: Frame[] = []
    let w: [number, number] = [0, 0]
    let b = 0, updates = 0

    //  当前 w 在全体点上错几个
    const missCount = (ww: [number, number], bb: number) =>
      PTS.filter(p => ((ww[0] * p.x[0] + ww[1] * p.x[1] + bb) > 0 ? 1 : -1) !== p.y).length

    /*  ⚠️ 感知机**不记得最好的那次** —— 它只有"当前的 w"。
        这里另外记一份历史最好（pocket），跟当前值并排摆出来：
        中途明明出现过只错 1 个的权重，最后交出来的可能错 3 个。
        这个差距就是 pocket algorithm 存在的全部理由，少了它这条根本看不见。 */
    let bestMistakes = missCount(w, b)
    let bestW: [number, number] = [w[0], w[1]]
    let bestB = b

    /*  循环检测：把每轮开始时的 (w,b) 记下来。异或那档不是"慢慢收敛"，
        是走着走着**回到出现过的状态**然后无限重复 —— 这是"不会收敛"的铁证，
        比"跑了 12 轮还没好"有力得多（后者只能说明轮数不够）。 */
    const seen = new Map<string, number>()
    let cycleAt: [number, number] | null = null
    let converged = false
    let passes = 0

    for (let pass = 0; pass < MAX_PASS; pass++) {
      passes = pass + 1
      const key = `${w[0]},${w[1]},${b}`
      if (!cycleAt && seen.has(key)) cycleAt = [seen.get(key)! + 1, pass + 1]
      if (!seen.has(key)) seen.set(key, pass)

      let mistakes = 0
      for (let idx = 0; idx < PTS.length; idx++) {
        const p = PTS[idx]
        const score = w[0] * p.x[0] + w[1] * p.x[1] + b
        const pred = score > 0 ? 1 : -1
        const ok = pred === p.y
        const prevW: [number, number] = [w[0], w[1]]
        const prevB = b
        if (!ok) {
          w = [w[0] + p.y * p.x[0], w[1] + p.y * p.x[1]]
          b = b + p.y
          updates++; mistakes++
        }
        const mNow = missCount(w, b)
        if (mNow < bestMistakes) { bestMistakes = mNow; bestW = [w[0], w[1]]; bestB = b }
        frames.push({
          step: frames.length, pts: PTS, w: [w[0], w[1]], b, prevW, prevB, pass, ptIdx: idx,
          score, ok, updated: !ok, updates, act: 'check',
          dataTag, converged: false, passes, mistakesNow: mNow,
          bestMistakes, bestW: [bestW[0], bestW[1]], bestB, cycleAt, phase: 'run',
          log: `第 ${pass + 1} 轮 · 点 (${p.x.join(',')}) 真实类 ${p.y > 0 ? '正' : '负'}：score = w·x+b = ${score}。`
            + (ok ? `符号对 → **分对了**，不动。`
              : `符号错（判成${score > 0 ? '正' : '负'}）→ **纠**：w 加 ${p.y > 0 ? '+' : '−'}(${p.x.join(',')})、b ${p.y > 0 ? '+1' : '−1'} → w=(${w.join(',')})、b=${b}。`)
            + `　此刻全体点错 **${mNow}** 个${bestMistakes < mNow ? `（而历史最好只错 ${bestMistakes} 个 —— 它**没被记住**）` : ''}。`,
        })
      }
      if (mistakes === 0) {
        converged = true
        frames.push({
          step: frames.length, pts: PTS, w: [w[0], w[1]], b, prevW: [w[0], w[1]], prevB: b, pass: pass + 1, ptIdx: -1,
          score: 0, ok: true, updated: false, updates, act: 'converged',
          dataTag, converged: true, passes, mistakesNow: 0, bestMistakes: 0,
          bestW: [w[0], w[1]], bestB: b, cycleAt, phase: 'run',
          log: `第 ${pass + 1} 轮：${PTS.length} 个点**全部分对、零更新** → **收敛**！学到的线 w=(${w.join(',')})、b=${b}。`,
        })
        break
      }
    }

    const mNow = missCount(w, b)
    frames.push({
      step: frames.length, pts: PTS, w: [w[0], w[1]], b, prevW: [w[0], w[1]], prevB: b, pass: -1, ptIdx: -1,
      score: 0, ok: true, updated: false, updates, act: 'done',
      dataTag, converged, passes, mistakesNow: mNow, bestMistakes,
      bestW: [bestW[0], bestW[1]], bestB, cycleAt, phase: 'done',
      log: converged
        ? `**学好了**：一条线 w=(${w.join(',')})、b=${b} 把 ${PTS.length} 个点全分开，共 ${updates} 次更新。`
          + `感知机 = 一个神经元：w·x+b 判正负、"错了就纠"地学。它是逻辑回归、SVM、以及整个深度网络里每个神经元的祖先（激活换成 sign）。`
          + `　⚠️ 但**收敛定理有前提：数据必须线性可分**。把「数据」换成**异或**或**一个噪声点**再看 —— `
          + `同一套算法会**永远停不下来**。`
        : `**${passes} 轮跑完了，还没收敛** —— 此刻仍错 ${mNow}/${PTS.length} 个，共纠了 ${updates} 次。`
          + (cycleAt
            ? `　而且它不是"还差一点"：**第 ${cycleAt[0]} 轮和第 ${cycleAt[1]} 轮的 (w, b) 一模一样** —— `
              + `它已经**陷进循环**了，再跑一万轮也是这几个状态来回转。`
            : `　它一直在纠，但纠不到头。`)
        + (dataTag.startsWith('异或')
          ? `　异或的四个点**怎么画一条直线都分不开**，而感知机能表达的全部就是一条直线。`
            + `这不是没训练够，是**模型的表达能力不够** —— 1969 年 Minsky 和 Papert 摁住感知机、`
            + `直接带来第一次 AI 寒冬的，就是这个例子。出路是**多层 + 非线性激活**（多层感知机），`
            + `那才是后来神经网络的路。`
          : `　数据本来是可分的，只是混进了**一个标错的点**。`
            + `感知机的收敛定理要求"存在一条线把所有点都分对"，一个噪声点就把这个前提破了。`
            + `　⚠️ 这比异或更常见：真实数据总有噪声，**所以感知机在实践中几乎不能直接用**。`)
        + `　　另外注意这一栏：此刻错 **${mNow}** 个，而历史最好只错 **${bestMistakes}** 个`
        + (bestMistakes < mNow
          ? `（w=(${bestW.join(',')})、b=${bestB}）。**感知机不记得最好的那次** —— 它只有"当前的 w"，`
            + `停在哪儿全看运气。把见过的最好权重揣兜里，就是 **pocket algorithm**。`
          : `。`),
    })

    const base0: Frame = {
      step: -1, pts: PTS, w: [0, 0], b: 0, prevW: [0, 0], prevB: 0, pass: 0, ptIdx: -1,
      score: 0, ok: true, updated: false, updates: 0, act: '',
      dataTag, converged, passes, mistakesNow: missCount([0, 0], 0), bestMistakes,
      bestW: [bestW[0], bestW[1]], bestB, cycleAt, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '逐点检查/纠正' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b2 = prev ?? this.initial()
        const idx = b2.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
