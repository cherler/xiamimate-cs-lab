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

const G = 4      // 流水级数 = 卡数

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
  phase: 'run' | 'done'
  log: string
}

export const PP_VISIBLE = [
  'step', 'stages', 'micro', 't', 'totalTime', 'busy', 'filled', 'bubblePct', 'util', 'phase', 'log',
] as const

type Frame = Omit<PPState, 'i'>

export const ppKernel: Kernel<PPState> = {
  kind: 'pp',

  compile(doc: SimDocument): CompiledModel<PPState> {
    let M = Math.round(num(doc.params, 'micro') || 4)
    if (![1, 2, 4, 8].includes(M)) M = 4
    const T = M + G - 1
    // 完整调度：sched[s][t] = 微批号 (t-s) 若有效，否则 -1
    const sched: number[][] = Array.from({ length: G }, (_, s) =>
      Array.from({ length: T }, (_, t) => (t - s >= 0 && t - s < M ? t - s : -1)))
    let busyCells = 0
    for (let s = 0; s < G; s++) for (let t = 0; t < T; t++) if (sched[s][t] >= 0) busyCells++
    const bubblePct = Math.round(100 * (G - 1) / (M + G - 1))
    const util = Math.round(100 * busyCells / (G * T))

    const frames: Frame[] = []
    for (let t = 0; t < T; t++) {
      const busy = sched.map(row => row[t])
      const filled = sched.map(row => row.map((v, tt) => (tt <= t ? v : -2)))  // -2 = 还没到
      const active = busy.filter(m => m >= 0).length
      frames.push({
        step: t, stages: G, micro: M, t, totalTime: T, busy, filled,
        bubblePct, util, phase: 'run',
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
      log: `${G} 级流水线、${M} 个微批:总时长 ${T}、利用率 **${util}%**、气泡 **${bubblePct}%**((G−1)/(M+G−1))。` +
        (M === 1 ? `只喂 1 个 batch 时同时只有 1 张卡干活、气泡高达 ${bubblePct}%。` : `微批越多,开头注入/结尾排空占比越小、气泡越小。`) +
        `把「micro」调大看气泡缩小——这就是 GPipe/1F1B 流水线调度填气泡的核心(但微批太碎也划不来,M 有甜点)。`,
    })

    const base0: Frame = {
      step: -1, stages: G, micro: M, t: -1, totalTime: T, busy: new Array(G).fill(-1),
      filled: sched.map(row => row.map(() => -2)), bubblePct, util, phase: 'run', log: '',
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
