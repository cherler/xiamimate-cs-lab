/**
 * 实体表的预置 —— 进程表 / 图的边 / 资源矩阵 / 丢包事件。
 *
 * 与 sequences.ts 同一条纪律：**每条 note 都是能被证伪的行为主张**
 * （"FCFS 在这组进程上出现护航效应"、"去掉这条边 G 就不可达"），
 * 由 `tests/presets-claims.test.ts` 逐条验。说不出口的就别写在按钮上。
 */
import type { Entity } from '../core/document.ts'

export type EntityPreset = {
  label: string
  note: string
  entities: Entity[]
}

const proc = (id: string, at: number, burst: number): Entity =>
  ({ id, type: 'process', at, attrs: { burst } })

// ═══ 进程调度 ══════════════════════════════════════════
export const SCHED_PRESETS: EntityPreset[] = [
  {
    label: '教材经典',
    note: '到达时刻错开、服务时间不一 —— 四种算法能跑出四种不同的平均周转时间',
    entities: [proc('P1', 0, 7), proc('P2', 2, 4), proc('P3', 4, 1), proc('P4', 5, 4)],
  },
  {
    label: '同时到达',
    note: '全部 0 时刻到达：此时 SJF 的平均周转时间最短，任何别的顺序都不会更好',
    entities: [proc('P1', 0, 8), proc('P2', 0, 4), proc('P3', 0, 2), proc('P4', 0, 1)],
  },
  {
    label: '护航效应',
    //  原来写的是"FCFS 远大于 SJF"，实测两者一模一样（21.50 vs 21.50）——
    //  长作业已经在跑了，非抢占的 SJF 根本插不进来。能救的只有抢占。
    note: '一个长作业先到，挡住后面一串短作业 —— FCFS 与非抢占的 SJF 一样糟，只有抢占式的 SRTF 能救',
    entities: [proc('P1', 0, 20), proc('P2', 1, 2), proc('P3', 2, 2), proc('P4', 3, 2)],
  },
  {
    label: 'SRTF 抢占',
    note: '长作业跑到一半来了更短的 —— 只有 SRTF 会抢占，它的平均周转时间严格小于 SJF',
    entities: [proc('P1', 0, 10), proc('P2', 2, 2), proc('P3', 4, 1)],
  },
]

// ═══ Dijkstra 图 ═══════════════════════════════════════
const NODE_XY: Record<string, [number, number]> = {
  A: [12, 50], B: [34, 18], C: [34, 74], D: [56, 92],
  E: [58, 22], F: [62, 58], G: [88, 40],
}
export const NODES: Entity[] = Object.entries(NODE_XY)
  .map(([id, [x, y]]) => ({ id, type: 'node', attrs: { x, y } }))

const edge = (from: string, to: string, w: number): Entity =>
  ({ id: `${from}${to}`, type: 'edge', attrs: { from, to, w } })

const CLASSIC_EDGES = [
  edge('A', 'B', 4), edge('A', 'C', 6), edge('A', 'D', 6),
  edge('B', 'C', 1), edge('B', 'E', 7),
  edge('C', 'D', 2), edge('C', 'E', 6), edge('C', 'F', 4),
  edge('D', 'F', 5), edge('E', 'F', 1), edge('E', 'G', 6), edge('F', 'G', 8),
]

export const DIJKSTRA_PRESETS: EntityPreset[] = [
  {
    label: '教材经典',
    note: '七点十二边，A 到 G 的最短路要绕行而不是走直连边',
    entities: [...NODES, ...CLASSIC_EDGES],
  },
  {
    label: '贪心陷阱',
    note: 'A→G 有一条很重的直连边，绕路反而更短 —— 光看"下一步最近"会选错',
    entities: [
      ...NODES,
      edge('A', 'B', 1), edge('B', 'C', 1), edge('C', 'E', 1),
      edge('E', 'F', 1), edge('F', 'G', 1), edge('A', 'G', 99),
      edge('A', 'D', 3), edge('D', 'F', 3),
    ],
  },
  {
    label: 'G 不可达',
    note: '删掉通往 G 的所有边 —— dist(G) 保持 ∞，算法照样正常终止',
    entities: [
      ...NODES,
      edge('A', 'B', 4), edge('A', 'C', 6), edge('B', 'C', 1),
      edge('C', 'D', 2), edge('C', 'E', 6), edge('C', 'F', 4),
      edge('D', 'F', 5), edge('E', 'F', 1),
    ],
  },
  {
    label: '等距分叉',
    note: '两条路到 G 长度相同 —— 最短距离唯一，但走哪条取决于选点的先后顺序',
    entities: [
      ...NODES,
      edge('A', 'B', 3), edge('B', 'G', 5),
      edge('A', 'C', 4), edge('C', 'G', 4),
      edge('A', 'D', 9), edge('D', 'E', 1), edge('E', 'F', 1), edge('F', 'G', 1),
    ],
  },
]

// ═══ 银行家资源矩阵 ═════════════════════════════════════
const res = (id: string, total: number): Entity =>
  ({ id, type: 'resource', attrs: { total } })
const bproc = (id: string, mx: [number, number, number], al: [number, number, number]): Entity => ({
  id, type: 'process',
  attrs: {
    max_A: mx[0], max_B: mx[1], max_C: mx[2],
    alloc_A: al[0], alloc_B: al[1], alloc_C: al[2],
  },
})

export const BANKER_PRESETS: EntityPreset[] = [
  {
    label: '教材经典',
    note: '五进程三资源的经典安全状态 —— 存在安全序列',
    entities: [
      res('A', 10), res('B', 5), res('C', 7),
      bproc('P0', [7, 5, 3], [0, 1, 0]),
      bproc('P1', [3, 2, 2], [2, 0, 0]),
      bproc('P2', [9, 0, 2], [3, 0, 2]),
      bproc('P3', [2, 2, 2], [2, 1, 1]),
      bproc('P4', [4, 3, 3], [0, 0, 2]),
    ],
  },
  {
    label: '不安全状态',
    note: '资源几乎分光，剩下的谁都不够用 —— 判为不安全，找不到完整安全序列',
    entities: [
      res('A', 10), res('B', 5), res('C', 7),
      bproc('P0', [8, 4, 5], [4, 2, 3]),
      bproc('P1', [8, 4, 5], [4, 2, 3]),
      bproc('P2', [6, 3, 3], [2, 1, 1]),
    ],
  },
  {
    label: '只剩一条路',
    note: '只有一个进程当前能被满足 —— 安全序列唯一，第一步必须选它',
    entities: [
      res('A', 6), res('B', 4), res('C', 4),
      bproc('P0', [6, 4, 4], [2, 1, 1]),
      bproc('P1', [3, 2, 2], [2, 1, 1]),
      bproc('P2', [5, 3, 3], [1, 1, 1]),
    ],
  },
]

// ═══ TCP 丢包事件 ═══════════════════════════════════════
const loss = (id: string, at: number, type: string): Entity =>
  ({ id, type: 'loss', at, attrs: { type } })

export const TCP_PRESETS: EntityPreset[] = [
  {
    label: '两种丢包都有',
    note: '先三次重复 ACK 再超时 —— Reno 对这两种事件的反应完全不同',
    entities: [loss('L1', 8, 'tripleDup'), loss('L2', 13, 'timeout')],
  },
  {
    label: '只有超时',
    note: '每次都是超时 —— cwnd 一律掉回 1，Tahoe 与 Reno 表现相同',
    entities: [loss('L1', 7, 'timeout'), loss('L2', 14, 'timeout')],
  },
  {
    label: '只有重复 ACK',
    note: '只有三次重复 ACK —— Reno 进快恢复不回 1，最终窗口比 Tahoe 大',
    entities: [loss('L1', 7, 'tripleDup'), loss('L2', 13, 'tripleDup')],
  },
  {
    label: '不丢包',
    note: '全程无丢包 —— 慢启动到门限后转拥塞避免，窗口一路单调增',
    entities: [],
  },
]

// ═══ ARQ 丢包事件 ═══════════════════════════════════════
const drop = (id: string, target: string, seq: number, nth = 1): Entity =>
  ({ id, type: 'loss', attrs: { target, seq, nth } })

export const ARQ_PRESETS: EntityPreset[] = [
  {
    label: '丢一个数据帧',
    note: '2 号帧首传丢失 —— GBN 要把 2 之后的全部重发，SR 只补 2 号那一帧',
    entities: [drop('L1', 'frame', 2)],
  },
  {
    label: '丢一个 ACK',
    note: '数据帧都到了，ACK 3 丢了 —— GBN 靠后面的累积 ACK 就能补上，不必重传',
    entities: [drop('L1', 'ack', 3)],
  },
  {
    label: '连丢两帧',
    //  原来写的是"GBN 要回退两次，差距拉大"，实测 GBN 传输次数一点没变（12→12）：
    //  5 号帧的重发本来就在 2 号帧那次回退的批次里，一次回退把两个洞一起补了。
    note: '2 号和 5 号都丢 —— GBN 一次回退就把两个洞一起补上，传输次数不变；反倒是 SR 要多补一帧',
    entities: [drop('L1', 'frame', 2), drop('L2', 'frame', 5)],
  },
  {
    label: '不丢包',
    note: '理想信道 —— 三种协议传输次数都等于总帧数，一次重传都没有',
    entities: [],
  },
]
