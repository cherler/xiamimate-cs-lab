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

// ═══ 流水线指令序列 ═════════════════════════════════════
const inst = (id: string, op: string, rd = '', rs = '', rt = '', taken = 0) =>
  ({ id, type: 'inst', attrs: { op, rd, rs, rt, taken } })

export const PIPE_PRESETS: EntityPreset[] = [
  {
    label: '无相关',
    note: '四条指令互不依赖 —— 周期数恰好等于 段数 + (n−1)，没有一个气泡',
    entities: [
      inst('I1', 'add', 'R1', 'R2', 'R3'),
      inst('I2', 'add', 'R4', 'R5', 'R6'),
      inst('I3', 'add', 'R7', 'R8', 'R9'),
      inst('I4', 'add', 'R10', 'R11', 'R12'),
    ],
  },
  {
    label: '连环 RAW',
    note: '每条都要上一条刚算出的结果 —— 不开前递气泡最多，开了前递能全消',
    entities: [
      inst('I1', 'add', 'R1', 'R2', 'R3'),
      inst('I2', 'add', 'R4', 'R1', 'R5'),
      inst('I3', 'add', 'R6', 'R4', 'R7'),
      inst('I4', 'add', 'R8', 'R6', 'R9'),
    ],
  },
  {
    label: 'load-use',
    note: 'lw 的结果紧接着就被用 —— 这是前递唯一救不了的相关，必插一个气泡',
    entities: [
      inst('I1', 'lw', 'R1', 'R2'),
      inst('I2', 'add', 'R3', 'R1', 'R4'),
      inst('I3', 'add', 'R5', 'R6', 'R7'),
    ],
  },
  {
    label: '分支跳转',
    note: '分支在 EX 段才判定 —— 那时后面两条已经取进来了，只能冲刷掉',
    entities: [
      inst('I1', 'add', 'R1', 'R2', 'R3'),
      inst('I2', 'beq', '', 'R1', 'R4', 1),
      inst('I3', 'add', 'R5', 'R6', 'R7'),
      inst('I4', 'add', 'R8', 'R9', 'R10'),
    ],
  },
]

// ═══ 页表 ═══════════════════════════════════════════════
const pte = (page: number, frame: number, valid = 1) =>
  ({ id: String(page), type: 'pte', attrs: { frame, valid } })

export const VM_PRESETS: EntityPreset[] = [
  {
    label: '教材经典',
    note: '六个页表项，其中页 3 无效 —— 访问它必然缺页',
    entities: [pte(0, 5), pte(1, 9), pte(2, 3), pte(3, 0, 0), pte(4, 7), pte(5, 2)],
  },
  {
    label: '全部有效',
    note: '所有页都在内存里 —— 只会有 TLB 未命中，永远不会缺页',
    entities: [pte(0, 5), pte(1, 9), pte(2, 3), pte(3, 6), pte(4, 7), pte(5, 2),
               pte(6, 1), pte(7, 4)],
  },
  {
    label: '大半缺页',
    note: '只有两页在内存 —— 缺页次数远多于命中，抖动的典型场景',
    entities: [pte(0, 5), pte(1, 9), pte(2, 0, 0), pte(3, 0, 0), pte(4, 0, 0), pte(5, 0, 0)],
  },
]

// ═══ 路由表（最长前缀匹配）═══════════════════════════════
const ipn = (a: number, b: number, c: number, d: number) => ((a << 24) | (b << 16) | (c << 8) | d) >>> 0
const route = (id: string, a: number, b: number, c: number, d: number, prefix: number, nextHop: string) =>
  ({ id, type: 'route', attrs: { network: ipn(a, b, c, d), prefix, nextHop } })

export const ROUTE_PRESETS: EntityPreset[] = [
  {
    label: '多条重叠',
    note: '同一个地址能匹配三条 —— 正好用来说明"为什么要取最长的那条"',
    entities: [
      route('R1', 192, 168, 0, 0, 16, '接口 A'),
      route('R2', 192, 168, 10, 0, 24, '接口 B'),
      route('R3', 192, 168, 10, 128, 25, '接口 C'),
      route('R4', 10, 0, 0, 0, 8, '接口 D'),
    ],
  },
  {
    label: '含默认路由',
    note: '0.0.0.0/0 匹配一切但前缀最短 —— 只有别的都不匹配时才轮到它',
    entities: [
      route('默认', 0, 0, 0, 0, 0, '默认网关'),
      route('R1', 192, 168, 0, 0, 16, '接口 A'),
      route('R2', 172, 16, 0, 0, 12, '接口 B'),
    ],
  },
  {
    label: '无匹配项',
    note: '路由表里没有一条能匹配 —— 既没有默认路由，只能丢弃',
    entities: [
      route('R1', 10, 0, 0, 0, 8, '接口 A'),
      route('R2', 172, 16, 0, 0, 12, '接口 B'),
    ],
  },
]

// ═══ 握手丢包 ═══════════════════════════════════════════
export const HS_PRESETS: EntityPreset[] = [
  { label: '不丢包', note: '理想情况 —— 建连恰好三个报文段，断连恰好四个', entities: [] },
  {
    label: '第一个 SYN 丢失',
    note: '客户端等超时后重发 SYN —— 连接仍能建立，只是多花了一个超时',
    entities: [{ id: 'L1', type: 'loss', attrs: { nth: 1 } }],
  },
  {
    label: 'SYN+ACK 丢失',
    note: '服务器已进 SYN_RCVD，客户端却什么都没收到 —— 半开连接就是这么来的',
    entities: [{ id: 'L1', type: 'loss', attrs: { nth: 2 } }],
  },
]

// ═══ AOE 网 / 无向带权图 ═══════════════════════════════
const XY6: Record<string, [number, number]> = {
  A: [12, 30], B: [38, 12], C: [38, 62], D: [64, 88], E: [64, 20], F: [88, 52],
}
const XY7: Record<string, [number, number]> = {
  V1: [8, 50], V2: [30, 22], V3: [30, 76], V4: [54, 50], V5: [54, 12], V6: [76, 74], V7: [94, 44],
}
export const MST_NODES = Object.entries(XY6).map(([id, [x, y]]) => ({ id, type: 'node', attrs: { x, y } }))
export const AOE_NODES = Object.entries(XY7).map(([id, [x, y]]) => ({ id, type: 'node', attrs: { x, y } }))
const und = (f: string, t: string, w: number) => ({ id: `${f}${t}`, type: 'edge', attrs: { from: f, to: t, w } })
const dir = (f: string, t: string, w: number) => ({ id: `${f}→${t}`, type: 'edge', attrs: { from: f, to: t, w } })

export const MST_PRESETS: EntityPreset[] = [
  {
    label: '教材经典',
    note: 'Prim 与 Kruskal 会选出不同的边集，但总权值都是 15',
    entities: [...MST_NODES,
      und('A','B',6), und('A','C',1), und('A','D',5),
      und('B','C',5), und('B','E',3),
      und('C','D',5), und('C','E',6), und('C','F',4),
      und('D','F',2), und('E','F',6)],
  },
  {
    label: '权值互不相同',
    note: '所有边权都不同 —— 此时最小生成树唯一，两种算法选出的边集完全一样',
    entities: [...MST_NODES,
      und('A','B',1), und('A','C',2), und('A','D',3),
      und('B','C',4), und('B','E',5),
      und('C','D',6), und('C','F',7),
      und('D','F',8), und('E','F',9), und('C','E',10)],
  },
  {
    label: '有大量成环边',
    note: '边很密 —— Kruskal 会丢掉很多条成环的边，判环那一步看得最清楚',
    entities: [...MST_NODES,
      und('A','B',2), und('A','C',2), und('A','D',3), und('A','E',4), und('A','F',5),
      und('B','C',1), und('B','D',6), und('C','D',1), und('C','E',7),
      und('D','E',1), und('E','F',1), und('D','F',8)],
  },
]

export const AOE_PRESETS: EntityPreset[] = [
  {
    label: '教材经典',
    note: '七个事件九个活动，关键路径唯一，总工期 10',
    entities: [...AOE_NODES,
      dir('V1','V2',3), dir('V1','V3',2),
      dir('V2','V4',2), dir('V2','V5',3),
      dir('V3','V4',4), dir('V3','V6',3),
      dir('V4','V6',2), dir('V5','V7',1), dir('V6','V7',2)],
  },
  {
    label: '两条关键路径',
    note: '有两条等长的最长路 —— 关键活动会多出一批，缩短其中一条并不能缩短工期',
    entities: [...AOE_NODES,
      dir('V1','V2',3), dir('V1','V3',3),
      dir('V2','V4',2), dir('V3','V4',2),
      dir('V4','V6',2), dir('V4','V5',1),
      dir('V5','V7',1), dir('V6','V7',2)],
  },
  {
    label: '含环（拓扑失败）',
    note: 'V7 又指回 V2 —— 入度永远降不到 0，不存在拓扑序列，也就没有关键路径',
    entities: [...AOE_NODES,
      dir('V1','V2',3), dir('V2','V4',2), dir('V4','V6',2),
      dir('V6','V7',2), dir('V7','V2',1),
      dir('V1','V3',2), dir('V3','V4',4), dir('V2','V5',3), dir('V5','V7',1)],
  },
]

// ═══ 动态分区请求序列 ═══════════════════════════════════
const req = (id: string, size: number, free = 0, at = 0) =>
  ({ id, type: 'req', at, attrs: { size, free } })

export const PART_PRESETS: EntityPreset[] = [
  {
    label: '四策略全分开',
    note: '这组请求下四种放置策略跑出四种不同的末态布局 —— 切换策略能看出真差别',
    entities: [
      req('作业1', 180, 0, 0), req('作业2', 100, 0, 1), req('作业3', 40, 0, 2), req('作业4', 120, 0, 3),
      req('作业1', 0, 1, 4), req('作业3', 0, 1, 5),
      req('作业5', 60, 0, 6), req('作业6', 220, 0, 7), req('作业7', 40, 0, 8),
    ],
  },
  {
    label: '外碎片致失败',
    note: '空闲总量够，却被切得太碎，最后那个大作业谁也装不下 —— 这就是外碎片',
    entities: [
      req('A', 100, 0, 0), req('B', 100, 0, 1), req('C', 100, 0, 2), req('D', 100, 0, 3),
      req('A', 0, 1, 4), req('C', 0, 1, 5),
      req('E', 250, 0, 6),
    ],
  },
  {
    label: '合并相邻空闲区',
    note: '连着释放两个相邻作业 —— 必须合并成一大块，否则后面的大作业进不来',
    entities: [
      req('A', 200, 0, 0), req('B', 200, 0, 1), req('C', 100, 0, 2),
      req('A', 0, 1, 3), req('B', 0, 1, 4),
      req('D', 380, 0, 5),
    ],
  },
]

// ═══ 图遍历用的无向图 ═══════════════════════════════════
const XY8: Record<string, [number, number]> = {
  A: [10, 46], B: [30, 18], C: [30, 74], D: [52, 8],
  E: [52, 40], F: [52, 78], G: [74, 46], H: [92, 82],
}
export const TRAV_NODES = Object.entries(XY8).map(([id, [x, y]]) => ({ id, type: 'node', attrs: { x, y } }))
const te = (f: string, t: string) => ({ id: `${f}${t}`, type: 'edge', attrs: { from: f, to: t, w: 1 } })

export const TRAV_PRESETS: EntityPreset[] = [
  {
    label: '含孤立顶点',
    note: 'H 跟谁都不连 —— 主分量走完后必须换起点，否则它永远访问不到',
    entities: [...TRAV_NODES,
      te('A','B'), te('A','C'), te('B','D'), te('B','E'),
      te('C','F'), te('E','F'), te('D','G'), te('F','G')],
  },
  {
    label: '连通图',
    note: '全部连通 —— DFS 一条路走到黑，BFS 一层层铺开，两种序列差别最明显',
    entities: [...TRAV_NODES,
      te('A','B'), te('A','C'), te('B','D'), te('B','E'),
      te('C','F'), te('E','F'), te('D','G'), te('F','G'), te('G','H')],
  },
  {
    label: '一条链',
    note: '退化成链 —— 此时 DFS 与 BFS 的访问序列完全相同',
    entities: [...TRAV_NODES,
      te('A','B'), te('B','C'), te('C','D'), te('D','E'),
      te('E','F'), te('F','G'), te('G','H')],
  },
]

// ═══ 位示图请求 ═════════════════════════════════════════
const bmreq = (id: string, count: number, free = 0, block = -1, at = 0) =>
  ({ id, type: 'req', at, attrs: { count, free, block } })

export const BITMAP_PRESETS: EntityPreset[] = [
  {
    label: '分配后回收',
    note: '先连着分三批，再回收中间那批 —— 下一次分配会优先填回收出来的低位',
    entities: [
      bmreq('文件A', 5, 0, -1, 0), bmreq('文件B', 3, 0, -1, 1), bmreq('文件C', 4, 0, -1, 2),
      bmreq('文件B', 3, 1, 5, 3), bmreq('文件D', 6, 0, -1, 4),
    ],
  },
  {
    label: '跨字边界',
    note: '一次要 12 块，跨过好几个字 —— 正好看清字号怎么进位',
    entities: [bmreq('大文件', 12, 0, -1, 0), bmreq('小文件', 3, 0, -1, 1)],
  },
  {
    label: '分配失败',
    note: '申请数超过总块数 —— 直接失败，不留半分配的中间状态',
    entities: [bmreq('文件A', 60, 0, -1, 0), bmreq('文件B', 10, 0, -1, 1)],
  },
]

// ═══ CSMA/CD 各站 ═══════════════════════════════════════
const sta = (id: string, readyAt: number, picks: string) =>
  ({ id, type: 'station', attrs: { readyAt, picks } })

export const CSMA_PRESETS: EntityPreset[] = [
  {
    label: '两站争用',
    note: '两站同时就绪 → 冲突一次，退避取值不同就各自错开，随后都成功',
    entities: [sta('A', 1, '1,3,5,7'), sta('B', 1, '0,2,4,6')],
  },
  {
    label: '退避撞车',
    note: '两站每次都取同一个 r —— 一直撞，直到达到重传上限',
    entities: [sta('A', 1, '1,1,1,1,1,1'), sta('B', 1, '1,1,1,1,1,1')],
  },
  {
    label: '三站争用',
    note: '三站同时抢 —— 冲突后退避范围扩大，错开的可能才变大',
    entities: [sta('A', 1, '1,3,2'), sta('B', 1, '0,1,5'), sta('C', 1, '1,2,0')],
  },
  {
    label: '错峰就绪',
    note: '三站在不同时刻就绪 —— 谁也不撞谁，一次冲突都没有',
    entities: [sta('A', 1, '0'), sta('B', 3, '0'), sta('C', 5, '0')],
  },
]

// ═══ 信号量调度序列 ═════════════════════════════════════
export const SEM_SCHEDULES: { label: string; note: string; values: string[] }[] = [
  {
    label: '交替执行',
    note: '生产者与消费者轮流拿到 CPU —— 正常协作，不会死锁',
    values: ['P1','P1','P1','P1','P1','C1','C1','C1','C1','C1',
             'P1','P1','P1','P1','P1','C1','C1','C1','C1','C1'],
  },
  {
    label: '生产者连跑',
    note: '生产者一口气跑到底 —— 缓冲区填满后它会阻塞在 P(empty) 上',
    values: ['P1','P1','P1','P1','P1','P1','P1','P1','P1','P1',
             'P1','P1','C1','C1','C1','C1','C1'],
  },
  {
    label: '消费者先跑',
    note: '缓冲区还空着消费者就来了 —— 它会阻塞在 P(full) 上等生产者',
    values: ['C1','C1','P1','P1','P1','P1','P1','C1','C1','C1','C1'],
  },
]
