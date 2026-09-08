/**
 * 内核：流水线并行 PP（大模型推理 · 原理：按层切到多卡，怎么用微批填掉流水线气泡）
 * 轴：step —— 时间一格一格走，看各流水级(卡)什么时候忙、什么时候空(气泡)
 * 参数：micro（切几个微批 M）—— 改了立即重跑，看气泡随 M 缩小
 *
 * 模型太大放不下一张卡,除了切头(TP)、切专家(EP),还能**按层切**:把连续的几层放一张卡,做成 G 级**流水线**
 * (卡0 算前几层→卡1 算中间几层→…→卡G-1 算最后几层)。可只喂**一个 batch** 时,它在流水线里一级一级往下走,
 * **同一时刻只有一张卡在干活**,其余全在等——利用率只有 **1/G**,大量 **流水线气泡**(空闲)。
 * 解法:**把 batch 切成 M 个微批**,像工厂流水线一样让它们**首尾衔接**地流进来。稳态时 G 张卡**同时**各处理一个微批,
 * 气泡只剩开头"注满"和结尾"排空"那点。气泡占比 = **(G−1)/(M+G−1)**：微批越多,气泡越小、利用率越高。
 * (代价:微批太小会让单次算量太碎、划不来;M 有个甜点。)这就是 GPipe/1F1B 这类流水线调度的核心。
 *
 * 本实验:G=4 级流水线,M 个微批(默认 4)。逐时刻看调度表:哪格在算哪个微批、哪格是气泡。
 * 值全部现算、可核对(总时长 M+G−1、气泡占比 (G−1)/(M+G−1))。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

/*  ⚠️ G（流水级数＝卡数）原来是**写死的 4**，可这一屏的核心公式
    气泡占比 = (G−1)/(M+G−1) **两个变量都在里面** —— 只能拧 M 不能拧 G，
    等于把公式一半锁住了。2026-09-08 改成参数。 */
const G_DEFAULT = 4

export type PPState = {
  i: number
  step: number
  stages: number
  micro: number
  t: number                  // 当前时刻
  totalTime: number
  busy: number[]             // 每级此刻在算的微批号（-1=气泡）
  filled: number[][]         // 已揭示的调度：sched[s][t]，-1=气泡
  bubblePct: number
  util: number
  /*  ── 2026-09-08 补厚新增的三样 ──
      老版本结论里写着「微批太碎也划不来，M 有甜点」，但屏幕上**没有任何东西能看见这个甜点**：
      时长永远是 M+G−1，M 越大越好，甜点根本不存在。原因是模型里**没有每个微批的固定开销**。
      加上它（启动/通信开销 c），总时长变成 (M+G−1)·(1/M + c)，甜点才真的出现，
      而且能求导算出来：M* = √((G−1)/c)。 */
  /** 每个微批的固定开销（占一个完整 batch 计算量的比例） */
  overhead: number
  /** 真实总时长（含开销）：(M+G−1)·(1/M+c)，以"一个 batch 的纯计算量"为 1 */
  realTime: number
  /** 扫一遍 M 得到的 [M, 真实总时长]，用来画那条 U 形曲线 */
  mCurve: [number, number][]
  /** 曲线最低点那个 M（甜点），以及理论值 √((G−1)/c) */
  bestM: number
  bestMTheory: number
  /** 峰值激活显存：GPipe 要同时存 M 份，1F1B 只要 G 份 —— 这是两种调度真正的差别 */
  peakActs: number
  peak1f1b: number
  phase: 'run' | 'done'
  log: string
}

export const PP_VISIBLE = [
  'step', 'stages', 'micro', 't', 'totalTime', 'busy', 'filled', 'bubblePct', 'util',
  'overhead', 'realTime', 'mCurve', 'bestM', 'bestMTheory', 'peakActs', 'peak1f1b', 'phase', 'log',
] as const

type Frame = Omit<PPState, 'i'>

export const ppKernel: Kernel<PPState> = {
  kind: 'pp',

  compile(doc: SimDocument): CompiledModel<PPState> {
    let M = Math.round(num(doc.params, 'micro') || 4)
    if (![1, 2, 4, 8, 16, 32].includes(M)) M = 4
    const G = doc.params.stages === undefined ? G_DEFAULT : Math.round(num(doc.params, 'stages'))
    //  每个微批的固定开销（启动 + 级间通信），以"一个 batch 的纯计算量"为 1
    const C = doc.params.overhead === undefined ? 0.02 : num(doc.params, 'overhead') / 1000
    const T = M + G - 1
    // 完整调度：sched[s][t] = 微批号 (t-s) 若有效，否则 -1
    const sched: number[][] = Array.from({ length: G }, (_, s) =>
      Array.from({ length: T }, (_, t) => (t - s >= 0 && t - s < M ? t - s : -1)))
    let busyCells = 0
    for (let s = 0; s < G; s++) for (let t = 0; t < T; t++) if (sched[s][t] >= 0) busyCells++
    const bubblePct = Math.round(100 * (G - 1) / (M + G - 1))
    const util = Math.round(100 * busyCells / (G * T))
    /*  真实总时长：切成 M 份之后，每一格的耗时是「纯计算 1/M + 固定开销 c」，
        一共要走 M+G−1 格。M 太小 → 气泡多；M 太大 → 开销 c 被乘了太多次。中间才有甜点。 */
    const realOf = (m: number) => +((m + G - 1) * (1 / m + C)).toFixed(4)
    const mCurve = [1, 2, 4, 8, 16, 32, 64].map(m => [m, realOf(m)] as [number, number])
    const bestM = mCurve.reduce((a, b) => (b[1] < a[1] ? b : a))[0]
    //  连续情形下求导得 M* = √((G−1)/c)；离散点里挑最近的那个就是上面的 bestM
    const bestMTheory = +Math.sqrt((G - 1) / C).toFixed(1)
    const realTime = realOf(M)
    //  峰值激活显存：GPipe 一次注满 M 个微批的前向激活都得留着等反向；1F1B 只需 G 份
    const peakActs = M
    const peak1f1b = Math.min(M, G)

    const frames: Frame[] = []
    for (let t = 0; t < T; t++) {
      const busy = sched.map(row => row[t])
      const filled = sched.map(row => row.map((v, tt) => (tt <= t ? v : -2)))  // -2 = 还没到
      const active = busy.filter(m => m >= 0).length
      frames.push({
        step: t, stages: G, micro: M, t, totalTime: T, busy, filled,
        bubblePct, util, overhead: C, realTime, mCurve, bestM, bestMTheory, peakActs, peak1f1b,
        phase: 'run',
        log: `时刻 ${t + 1}/${T}：` +
          (active === G ? `**满载**——${G} 张卡各算一个微批(稳态)。`
            : active < G && t < G - 1 ? `**注入中**——才 ${active} 张卡在算,其余在等(开头气泡)。`
              : `**排空中**——只剩 ${active} 张卡收尾(结尾气泡)。`) +
          `此刻各级微批 = [${busy.map(m => m < 0 ? '·' : m).join(', ')}]。`,
      })
    }
    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `${G} 级流水线、${M} 个微批：总格数 ${T}、利用率 **${util}%**、气泡 **${bubblePct}%**（=(G−1)/(M+G−1)）。`
        + (M === 1 ? `只喂 1 个 batch 时同时只有 1 张卡干活、气泡高达 ${bubblePct}%。` : `微批越多，开头注入/结尾排空占比越小、气泡越小。`)
        + `　但**不是越多越好**：算上每个微批 ${(C * 100).toFixed(1)}% 的固定开销之后，`
        + `真实总时长 = (M+G−1)·(1/M+c)，这一档 M=${M} 时是 **${realTime}**；`
        + `扫一遍 M 的最低点在 **M=${bestM}**（连续解 M*=√((G−1)/c)=${bestMTheory}）—— **这就是那个"甜点"**，`
        + `它是算出来的，不是一句"太碎也划不来"。`
        + `　另一半代价在**显存**：GPipe 要同时留着 ${peakActs} 份微批的激活等反向，`
        + `而 1F1B 只需 ${peak1f1b} 份（≈级数 G）—— 两种调度气泡一样，差别在这儿。`,
    })

    const base0: Frame = {
      step: -1, stages: G, micro: M, t: -1, totalTime: T, busy: new Array(G).fill(-1),
      filled: sched.map(row => row.map(() => -2)), bubblePct, util,
      overhead: C, realTime, mCurve, bestM, bestMTheory, peakActs, peak1f1b, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '时刻' },
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
