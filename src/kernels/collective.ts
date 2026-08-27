/**
 * 内核：集合通信 —— Ring All-Reduce（大模型推理 · 多卡通信）
 * 轴：step —— G 张 GPU 各持一段向量，环状传递：reduce-scatter 求和 → all-gather 广播 → 人人都拿到总和
 *
 * 多卡并行（如张量并行）算完各自一片后，常要把各卡的结果**求和并让每张卡都拿到**（all-reduce）。
 * 朴素做法人人给人人发（G² 条消息，带宽炸）。**环形 all-reduce** 把卡排成环，分两段、共 2(G−1) 步：
 *   reduce-scatter：每步各卡把一个块发给下一张、下一张累加 → G−1 步后，每卡"拥有"某一个块的完整和；
 *   all-gather：再把这些已求和的块沿环传一圈 → G−1 步后，每卡集齐所有块 = 完整总和。
 * 每步每卡只收发一个块，带宽最优（和 G 无关）；结果人人一致 —— 这就是多卡把梯度/激活对齐的基本操作。
 *
 * 值全部现算：末态每卡向量 == 各卡输入的逐元素和，可核对。状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type CollectiveState = {
  i: number
  G: number
  /** G×G：每张卡当前持有的向量（G 个块） */
  bufs: number[][]
  /** 参照：逐元素总和（每块应收敛到它） */
  target: number[]
  phase: 'reduce' | 'gather' | 'done'
  round: number            // 本阶段第几步
  /** 本步：块 chunk 从 src 发到 dst */
  moves: { src: number; dst: number; chunk: number }[]
  /** 每卡每块是否已是"完整和"（reduce 完成的块 / gather 到的块） */
  reduced: boolean[][]
  totalSteps: number
  log: string
}

export const COLLECTIVE_VISIBLE = [
  'i', 'G', 'bufs', 'target', 'phase', 'round', 'moves', 'reduced', 'totalSteps', 'log',
] as const

type Frame = Omit<CollectiveState, 'i'>

//  各卡初始向量（G×G，行=卡，列=块）
const INIT: number[][] = [
  [1, 2, 3, 4],
  [10, 20, 30, 40],
  [100, 200, 300, 400],
  [1000, 2000, 3000, 4000],
]

export const collectiveKernel: Kernel<CollectiveState> = {
  kind: 'collective',

  compile(doc: SimDocument): CompiledModel<CollectiveState> {
    const G = Math.max(2, Math.min(4, num(doc.params, 'gpus') || 4))
    const init = INIT.slice(0, G).map(r => r.slice(0, G))
    const target = Array.from({ length: G }, (_, c) => init.reduce((s, row) => s + row[c], 0))
    const totalSteps = 2 * (G - 1)

    const bufs = init.map(r => r.slice())
    const reduced: boolean[][] = init.map(() => Array(G).fill(false))
    const frames: Frame[] = []
    const snap = (phase: Frame['phase'], round: number, moves: Frame['moves'], log: string) =>
      frames.push({
        G, bufs: bufs.map(r => r.slice()), target, phase, round,
        moves: moves.map(m => ({ ...m })), reduced: reduced.map(r => r.slice()), totalSteps, log,
      })

    //  ── reduce-scatter：G-1 步。第 t 步，卡 g 把块 (g - t) 发给 g+1，g+1 累加 ──
    for (let t = 0; t < G - 1; t++) {
      const moves: Frame['moves'] = []
      const add: { dst: number; chunk: number; val: number }[] = []
      for (let g = 0; g < G; g++) {
        const chunk = ((g - t) % G + G) % G
        const dst = (g + 1) % G
        moves.push({ src: g, dst, chunk })
        add.push({ dst, chunk, val: bufs[g][chunk] })
      }
      for (const a of add) bufs[a.dst][a.chunk] += a.val
      //  这一步后，块 (g+1 - t) 在 g+1 上又累加了一份；最后一步后每卡有一个块是完整和
      if (t === G - 2) for (let g = 0; g < G; g++) reduced[g][((g - (G - 1)) % G + G) % G] = true
      snap('reduce', t + 1, moves,
        `**reduce-scatter 第 ${t + 1}/${G - 1} 步**：每张卡把一个块发给环上下一张、对方累加。` +
        (t === G - 2 ? `到此每卡各"拥有"一个**完整求和**的块。` : ''))
    }

    //  ── all-gather：G-1 步。把已求和的块沿环再传一圈，人人集齐 ──
    for (let t = 0; t < G - 1; t++) {
      const moves: Frame['moves'] = []
      const set: { dst: number; chunk: number; val: number }[] = []
      for (let g = 0; g < G; g++) {
        //  卡 g 当前"完整"的块下标
        const owned = ((g + 1 - t) % G + G) % G
        const dst = (g + 1) % G
        moves.push({ src: g, dst, chunk: owned })
        set.push({ dst, chunk: owned, val: bufs[g][owned] })
      }
      for (const s of set) { bufs[s.dst][s.chunk] = s.val; reduced[s.dst][s.chunk] = true }
      snap('gather', t + 1, moves,
        `**all-gather 第 ${t + 1}/${G - 1} 步**：把已求和的块沿环广播，接收方直接覆盖。` +
        (t === G - 2 ? `人人集齐所有块 = 完整总和。` : ''))
    }

    const ok = bufs.every(r => r.every((v, c) => v === target[c]))
    snap('done', G - 1, [],
      `全部 ${totalSteps} 步走完：每张卡都拿到完整总和 [${target.join('、')}]${ok ? '（人人一致 ✓）' : ''}。` +
      `每步每卡只收发一个块，带宽最优、与卡数无关 —— 这就是环形 all-reduce 比人人对发省的地方。`)

    const base0: Frame = {
      G, bufs: init.map(r => r.slice()), target, phase: 'reduce', round: 0,
      moves: [], reduced: init.map(() => Array(G).fill(false)), totalSteps,
      log: `${G} 张卡各持一段向量，目标：人人都拿到逐元素总和 [${target.join('、')}]。`,
    }

    return {
      axis: { kind: 'step', label: '通信步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx > frames.length) return null
        if (idx === 0) return { state: { i: 0, ...base0 }, done: false }
        const f = frames[idx - 1]
        return { state: { i: idx, ...f }, done: idx === frames.length }
      },
    }
  },
}
