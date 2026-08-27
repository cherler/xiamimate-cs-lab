/**
 * 内核：DP Attention（大模型推理 · 原理：多卡服务时，注意力按请求切、零通信）
 * 轴：step —— 对比两种把注意力铺到多卡上的切法：张量并行 TP vs 数据并行 DP
 * 参数：gpus（几张卡 G）—— 改了立即重跑，看每卡分到什么、通信多少
 *
 * 多卡服务一批请求,注意力怎么分到 G 张卡上?两条路:
 *   · **张量并行 TP**：把 H 个注意力头**切开**分到各卡(每卡 H/G 个头)、每卡都算**全部请求**。算完各卡只有一部分头,
 *     得**每层 all-reduce** 把头拼回来——**每层都要跨卡通信**。好处:注意力权重也被切成 1/G,省显存。
 *   · **数据并行 DP Attention**：把**请求**切开分到各卡(每卡 B/G 个请求)、每卡都算**全部头**。每卡自己那几个请求
 *     从头算到尾、**注意力这段零通信**。代价:注意力权重要**整套复制**到每张卡。
 * 关键权衡:TP 省权重显存但每层通信;DP 零通信但复制权重。**注意力的权重其实很小**,复制得起;而 **MoE 的专家
 * 权重巨大**,才真需要切。于是现代 MoE 服务(如 DeepSeek)常用 **DP Attention + EP(专家并行)**:便宜的注意力用 DP
 * 避开每层 all-reduce、昂贵的专家用 EP 分片——各切各的、把通信花在刀刃上。
 *
 * 本实验:B=8 请求、H=8 头,G 张卡(默认 4)。对比 TP 与 DP 的每卡分工与通信量。值全部现算、可核对。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const B = 8      // 请求数
const H = 8      // 注意力头数
const D = 512    // 隐藏维

export type DPAttnState = {
  i: number
  step: number
  gpus: number
  b: number
  h: number
  phase: 'setup' | 'tp' | 'dp' | 'done'
  headsPerGpu: number        // TP：每卡几个头
  reqPerGpu: number          // DP：每卡几个请求
  tpComm: number             // TP：每层 all-reduce 元素/token
  dpComm: number             // DP：注意力通信（0）
  tpWeight: string           // TP 权重每卡占比
  dpWeight: string           // DP 权重每卡占比
  log: string
}

export const DPATTN_VISIBLE = [
  'step', 'gpus', 'b', 'h', 'phase', 'headsPerGpu', 'reqPerGpu', 'tpComm', 'dpComm', 'tpWeight', 'dpWeight', 'log',
] as const

type Frame = Omit<DPAttnState, 'i'>

export const dpattnKernel: Kernel<DPAttnState> = {
  kind: 'dpattn',

  compile(doc: SimDocument): CompiledModel<DPAttnState> {
    let G = Math.round(num(doc.params, 'gpus') || 4)
    if (![2, 4].includes(G)) G = 4
    const headsPerGpu = H / G
    const reqPerGpu = B / G
    const tpComm = B * D
    const base: Omit<Frame, 'step' | 'phase' | 'log'> = {
      gpus: G, b: B, h: H, headsPerGpu, reqPerGpu, tpComm, dpComm: 0, tpWeight: `1/${G}`, dpWeight: '整套',
    }

    const frames: Frame[] = [
      { ...base, step: 0, phase: 'setup',
        log: `${B} 个请求、${H} 个注意力头,要铺到 **${G} 张卡**上。两种切法:张量并行 TP(切头)、数据并行 DP(切请求)。` },
      { ...base, step: 1, phase: 'tp',
        log: `**张量并行 TP**:把 ${H} 个头切开,每卡 **${headsPerGpu}** 个头、算**全部 ${B} 个请求**。` +
          `算完各卡只有一部分头,得**每层 all-reduce** 拼回来 → 通信 **${tpComm}** 元素/token/层。好处:权重也切成 **1/${G}**。` },
      { ...base, step: 2, phase: 'dp',
        log: `**数据并行 DP Attention**:把 ${B} 个请求切开,每卡 **${reqPerGpu}** 个请求、算**全部 ${H} 个头**。` +
          `每卡自己那几个请求从头算到尾——**注意力这段零通信(${0})**。代价:注意力权重要**整套复制**到每卡。` },
      { ...base, step: 3, phase: 'done',
        log: `权衡:TP 省权重显存(1/${G})但**每层都要 all-reduce**;DP **零通信**但复制权重。` +
          `注意力权重其实很小、复制得起;而 **MoE 的专家权重巨大**才真需要切。所以现代 MoE 服务常用 **DP Attention + EP**:` +
          `便宜的注意力用 DP 避开每层 all-reduce、昂贵的专家用 EP 分片——各切各的,把通信花在刀刃上。调 gpus 看分工变化。` },
    ]

    const base0: Frame = { ...base, step: -1, phase: 'setup', log: '' }

    return {
      axis: { kind: 'step', label: '切法' },
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
