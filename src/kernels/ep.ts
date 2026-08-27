/**
 * 内核：专家并行 EP（大模型推理 · 原理：MoE 的巨大专家怎么分到多卡、代价是什么）
 * 轴：step —— MoE 里 token 经路由挑专家、再 all-to-all 送到专家所在的卡上算，看分片省显存与负载不均
 * 参数：gpus（几张卡 G）—— 改了立即重跑，看每卡放几个专家、负载均不均
 *
 * MoE(混合专家)把一个巨大的 FFN 换成 **E 个专家**,每个 token 只经**路由**挑其中少数几个算(稀疏激活),
 * 于是参数量爆炸大、但每 token 算量不涨。问题:E 个专家的权重**加起来极其庞大**,一张卡放不下。
 * **专家并行 EP**:把 E 个专家**分片**到 G 张卡上(每卡 E/G 个专家)——省显存。代价是:token 挑中的专家可能在
 * **别的卡**上,得先把每个 token **all-to-all 派发**到它专家所在的卡、算完再 all-to-all 收回来。而且路由可能**不均**
 * (某个"热"专家被很多 token 挑中),那张卡就**过载**、别的卡闲着——所以 EP 还要配**负载均衡**(限容量/辅助损失)。
 * 这就是为什么现代 MoE 服务把 **DP Attention(便宜、零通信)+ EP(专家分片、all-to-all)**配在一起:各切各的。
 *
 * 本实验:8 个 token、8 个专家(top-1 路由,专家 3 偏热),G 张卡(默认 4)。看路由→派发→每卡负载。
 * 值全部现算、可核对(每卡专家数、token 落在哪张卡、每卡负载)。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const T = 8      // token 数
const E = 8      // 专家数
const ROUTE = [0, 3, 5, 3, 6, 1, 3, 7]   // token → 选中的专家（专家 3 偏热）

export type EPState = {
  i: number
  step: number
  gpus: number
  tokens: number
  experts: number
  expertsPerGpu: number
  phase: 'setup' | 'route' | 'dispatch' | 'compute' | 'done'
  route: number[]            // token → expert
  gpuOf: number[]            // token → gpu
  load: number[]             // 每卡收到的 token 数
  maxLoad: number
  minLoad: number
  log: string
}

export const EP_VISIBLE = [
  'step', 'gpus', 'tokens', 'experts', 'expertsPerGpu', 'phase', 'route', 'gpuOf', 'load', 'maxLoad', 'minLoad', 'log',
] as const

type Frame = Omit<EPState, 'i'>

export const epKernel: Kernel<EPState> = {
  kind: 'ep',

  compile(doc: SimDocument): CompiledModel<EPState> {
    let G = Math.round(num(doc.params, 'gpus') || 4)
    if (![2, 4].includes(G)) G = 4
    const perGpu = E / G
    const gpuOf = ROUTE.map(e => Math.floor(e / perGpu))
    const load = new Array(G).fill(0)
    gpuOf.forEach(g => load[g]++)
    const maxLoad = Math.max(...load), minLoad = Math.min(...load)

    const base: Omit<Frame, 'step' | 'phase' | 'log' | 'gpuOf' | 'load'> = {
      gpus: G, tokens: T, experts: E, expertsPerGpu: perGpu, route: ROUTE.slice(), maxLoad, minLoad,
    }

    const frames: Frame[] = [
      { ...base, step: 0, phase: 'setup', gpuOf: [], load: new Array(G).fill(0),
        log: `MoE:${E} 个专家、${T} 个 token。专家权重加起来太大、一张卡放不下 → **专家并行 EP**:把 ${E} 个专家分到 **${G} 张卡**,每卡 **${perGpu}** 个。` },
      { ...base, step: 1, phase: 'route', gpuOf: [], load: new Array(G).fill(0),
        log: `**路由**:每个 token 挑一个专家(top-1)。token→专家 = [${ROUTE.join(', ')}]。注意专家 **3** 被挑了 3 次(偏热)。` },
      { ...base, step: 2, phase: 'dispatch', gpuOf: gpuOf.slice(), load: load.slice(),
        log: `**all-to-all 派发**:每个 token 送到它专家所在的卡。token→卡 = [${gpuOf.join(', ')}]。跨卡通信换来了专家分片省显存。` },
      { ...base, step: 3, phase: 'compute', gpuOf: gpuOf.slice(), load: load.slice(),
        log: `各卡算自己收到的 token,再 all-to-all 收回。每卡负载 = [${load.join(', ')}]:最忙 **${maxLoad}**、最闲 **${minLoad}**——` +
          (maxLoad > minLoad ? `**不均**(热专家那张卡过载,别的闲着)。` : `刚好均衡。`) },
      { ...base, step: 4, phase: 'done', gpuOf: gpuOf.slice(), load: load.slice(),
        log: `EP 把巨大的专家权重**分片**到 ${G} 卡(每卡 ${perGpu} 个)→省显存,代价是 **all-to-all**(token 跳到专家所在卡)+ **负载不均**` +
          `(热专家 ${maxLoad} vs 闲 ${minLoad},要靠限容量/辅助损失做**负载均衡**)。所以现代 MoE 服务把 **DP Attention(零通信)+ EP(专家分片)**配在一起:` +
          `便宜的注意力不通信、昂贵的专家才分片走 all-to-all。调「卡数」看每卡专家数与负载怎么变。` },
    ]

    const base0: Frame = { ...base, step: -1, phase: 'setup', gpuOf: [], load: new Array(G).fill(0), log: '' }

    return {
      axis: { kind: 'step', label: '阶段' },
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
