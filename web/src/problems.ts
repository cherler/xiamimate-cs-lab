/**
 * 题库。
 *
 * ⚠️ 出处标注纪律：这里**不写**"2019 年 408 真题第 43 题"这类具体引用 ——
 * 记不准的引用等于假数据。现在按**题型**标注；等有确切可核对的来源，再逐题补上年份与题号。
 *
 * 核心设计：**答案不手写，从轨迹派生。**
 *   - 人手写答案会写错
 *   - 配置改了，答案自动跟着变
 *   - 这是验证器在为学生工作，而不只是在为 AI 把关
 */
import type { SimDocument } from '@engine/core/document.ts'
import type { CacheState } from '@engine/kernels/cache.ts'
import type { SchedState } from '@engine/kernels/scheduler.ts'
import type { TcpState } from '@engine/kernels/tcp.ts'
import type { PageState } from '@engine/kernels/page.ts'
import type { DiskState } from '@engine/kernels/disk.ts'
import type { SortState } from '@engine/kernels/sort.ts'
import type { DijkstraState } from '@engine/kernels/dijkstra.ts'
import type { BankerState } from '@engine/kernels/banker.ts'
import type { ArqState } from '@engine/kernels/arq.ts'
import type { FloatState } from '@engine/kernels/float.ts'
import type { PipeState } from '@engine/kernels/pipeline.ts'
import type { VmState } from '@engine/kernels/vm.ts'
import type { MulState } from '@engine/kernels/multiply.ts'
import { PIPE_PRESETS, VM_PRESETS, ROUTE_PRESETS } from '@engine/presets/entities.ts'
import type { CrcState } from '@engine/kernels/crc.ts'
import type { HammingState } from '@engine/kernels/hamming.ts'
import type { SubnetState } from '@engine/kernels/subnet.ts'
import type { HsState } from '@engine/kernels/handshake.ts'
import type { AvlState } from '@engine/kernels/avl.ts'
import type { HashState } from '@engine/kernels/hashtable.ts'
import type { HuffState } from '@engine/kernels/huffman.ts'
import type { KmpState } from '@engine/kernels/kmp.ts'
import { asl } from '@engine/kernels/hashtable.ts'
import { trueHeight, NIL } from '@engine/core/tree.ts'
import type { MstState } from '@engine/kernels/mst.ts'
import type { TopoState } from '@engine/kernels/topo.ts'
import type { PartState } from '@engine/kernels/partition.ts'
import type { InodeState } from '@engine/kernels/inode.ts'
import { maxFileSize } from '@engine/kernels/inode.ts'
import { MST_PRESETS, AOE_PRESETS, PART_PRESETS } from '@engine/presets/entities.ts'

/** 跑任意配置，供"改个参数再算一遍"型的题用 —— 仍然不手写答案 */
export type RunDoc = (doc: SimDocument) => unknown[]

export type Question = {
  prompt: string
  kind: 'number' | 'text'
  unit?: string
  /** 从轨迹派生正确答案 —— 绝不手写 */
  answer: (trace: never[], doc: SimDocument, runDoc: RunDoc) => string
  /** 答完之后跳到哪一步能看见原因 */
  revealStep?: (trace: never[]) => number
  hint?: string
}

export type Problem = {
  id: string
  experimentId: string
  /** 题型标注，不是伪造的年份题号 */
  source: string
  statement: string
  doc: SimDocument
  questions: Question[]
}

const q = <S,>(x: {
  prompt: string; kind?: 'number' | 'text'; unit?: string; hint?: string
  answer: (t: S[], doc: SimDocument, runDoc: RunDoc) => string
  revealStep?: (t: S[]) => number
}): Question => ({
  prompt: x.prompt, kind: x.kind ?? 'number', unit: x.unit, hint: x.hint,
  answer: x.answer as never, revealStep: x.revealStep as never,
})

const last = <S,>(t: S[]) => t[t.length - 1]

// ═══ Cache ═════════════════════════════════════════════
const cacheProblems: Problem[] = [
  {
    id: 'cache-1',
    experimentId: 'cache',
    source: '典型题型 · 组相联映射与 LRU',
    statement:
      '某计算机主存按字节编址。Cache 数据区容量 512B，主存块大小 32B，采用 4 路组相联映射，' +
      '替换策略为 LRU。CPU 按顺序访问以下主存地址（十六进制）：' +
      '0x00、0x20、0x40、0x60、0x80、0x00、0x20、0x100、0x00。',
    doc: {
      kind: 'cache',
      params: { addressBits: 32, cacheSizeBytes: 512, blockSizeBytes: 32, associativity: 4, replacement: 'LRU' },
      entities: [],
      streams: [{ name: 'accessSequence', values: [0x00, 0x20, 0x40, 0x60, 0x80, 0x00, 0x20, 0x100, 0x00] }],
    },
    questions: [
      q<CacheState>({
        prompt: 'Cache 共分为多少组？', unit: '组',
        hint: '组数 = 容量 ÷ 块大小 ÷ 相联度',
        answer: (_t, d) =>
          String((d.params.cacheSizeBytes as number) / (d.params.blockSizeBytes as number) / (d.params.associativity as number)),
      }),
      q<CacheState>({
        prompt: '主存地址中，组号字段占几位？', unit: '位',
        hint: '组号位数 = log₂(组数)',
        answer: (_t, d) => {
          const sets = (d.params.cacheSizeBytes as number) / (d.params.blockSizeBytes as number) / (d.params.associativity as number)
          return String(Math.log2(sets))
        },
      }),
      q<CacheState>({
        prompt: '整个访问序列共命中几次？', unit: '次',
        answer: t => String(last(t).hits),
        revealStep: t => t.findIndex(s => s.outcome === 'hit'),
      }),
      q<CacheState>({
        prompt: '最终命中率是多少（保留一位小数，只填数字）？', unit: '%',
        answer: t => (last(t).hits / t.length * 100).toFixed(1),
        revealStep: t => t.length - 1,
      }),
    ],
  },
]

// ═══ 页面置换 ═══════════════════════════════════════════
const pageProblems: Problem[] = [
  {
    id: 'page-1',
    experimentId: 'page',
    source: '典型题型 · FIFO 与 Belady 异常',
    statement:
      '某进程的页面引用串为 1、2、3、4、1、2、5、1、2、3、4、5。' +
      '系统采用 FIFO 页面置换算法，分配给该进程 3 个物理块（初始为空）。',
    doc: {
      kind: 'page',
      params: { algorithm: 'FIFO', frames: 3 },
      entities: [],
      streams: [{ name: 'referenceString', values: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5] }],
    },
    questions: [
      q<PageState>({
        prompt: '共发生多少次缺页？', unit: '次',
        answer: t => String(last(t).faults),
        revealStep: t => t.length - 1,
      }),
      q<PageState>({
        prompt: '缺页率是多少（保留一位小数，只填数字）？', unit: '%',
        answer: t => (last(t).faults / t.length * 100).toFixed(1),
      }),
      q<PageState>({
        prompt: '第一次发生页面置换（而非装入空闲块）是在第几次访问？', unit: '第 N 次',
        hint: '前几次是往空块里装，还不算置换',
        answer: t => String(t.findIndex(s => s.evictedPage !== null) + 1),
        revealStep: t => t.findIndex(s => s.evictedPage !== null),
      }),
      q<PageState>({
        prompt: '把物理块数改成 4 再跑一遍，缺页次数是多少？（这就是 Belady 异常）', unit: '次',
        hint: '把右侧「物理块数」改成 4，看读数',
        answer: (_t, d, runDoc) => {
          const four = runDoc({ ...d, params: { ...d.params, frames: 4 } }) as PageState[]
          return String(four[four.length - 1].faults)
        },
      }),
    ],
  },
]

// ═══ 进程调度 ═══════════════════════════════════════════
const schedProblems: Problem[] = [
  {
    id: 'sched-1',
    experimentId: 'scheduler',
    source: '典型题型 · 最短剩余时间优先',
    statement:
      '系统中有 4 个进程：P1 到达时刻 0，需运行 7；P2 到达时刻 2，需运行 4；' +
      'P3 到达时刻 4，需运行 1；P4 到达时刻 5，需运行 4。采用 SRTF（最短剩余时间优先）调度。',
    doc: {
      kind: 'scheduler',
      params: { algorithm: 'SRTF', quantum: 1 },
      entities: [
        { id: 'P1', type: 'process', at: 0, attrs: { burst: 7 } },
        { id: 'P2', type: 'process', at: 2, attrs: { burst: 4 } },
        { id: 'P3', type: 'process', at: 4, attrs: { burst: 1 } },
        { id: 'P4', type: 'process', at: 5, attrs: { burst: 4 } },
      ],
      streams: [],
    },
    questions: [
      q<SchedState>({
        prompt: '最先执行完毕的是哪个进程？（填进程名，如 P1）', kind: 'text',
        answer: t => last(t).completed[0] ?? '—',
        revealStep: t => t.findIndex(s => s.completed.length >= 1),
      }),
      q<SchedState>({
        prompt: '全部进程执行完毕的时刻是？', unit: 't =',
        hint: '看轨迹最后一步的 t',
        answer: t => String(last(t).t + 1),
        revealStep: t => t.length - 1,
      }),
      q<SchedState>({
        prompt: 'P1 一共被抢占了几次？', unit: '次',
        hint: '「正在运行 P1」被打断、之后又恢复，算一次',
        answer: t => {
          let n = 0
          for (let i = 1; i < t.length; i++)
            if (t[i - 1].running === 'P1' && t[i].running !== 'P1' && !t[i].completed.includes('P1')) n++
          return String(n)
        },
      }),
    ],
  },
]

// ═══ TCP ═══════════════════════════════════════════════
const tcpProblems: Problem[] = [
  {
    id: 'tcp-1',
    experimentId: 'tcp',
    source: '典型题型 · Reno 拥塞控制',
    statement:
      '某 TCP 连接采用 Reno 算法，初始 cwnd = 1 MSS，慢启动门限 ssthresh = 16 MSS。' +
      '在第 8 个 RTT 收到三个重复 ACK，在第 13 个 RTT 发生超时。共观察前 20 个 RTT。',
    doc: {
      kind: 'tcp',
      params: { variant: 'Reno', initialCwnd: 1, initialSsthresh: 16, rounds: 20 },
      entities: [
        { id: 'L1', type: 'loss', at: 8, attrs: { type: 'tripleDup' } },
        { id: 'L2', type: 'loss', at: 13, attrs: { type: 'timeout' } },
      ],
      streams: [],
    },
    questions: [
      q<TcpState>({
        prompt: '第几个 RTT 开始进入拥塞避免阶段？', unit: '第 N 个',
        hint: 'cwnd 达到 ssthresh 之后',
        answer: t => String(t.findIndex(s => s.phase === 'congestionAvoidance') + 1),
        revealStep: t => t.findIndex(s => s.phase === 'congestionAvoidance'),
      }),
      q<TcpState>({
        prompt: '第 8 个 RTT 收到三个重复 ACK 后，ssthresh 变为多少？', unit: 'MSS',
        answer: t => String(t[7]?.ssthresh ?? 0),
        revealStep: () => 7,
      }),
      q<TcpState>({
        prompt: '第 13 个 RTT 超时后，cwnd 变为多少？', unit: 'MSS',
        answer: t => String(t[12]?.cwnd ?? 0),
        revealStep: () => 12,
      }),
      q<TcpState>({
        prompt: '前 20 个 RTT 中 cwnd 达到的最大值是？', unit: 'MSS',
        answer: t => String(Math.max(...t.map(s => s.cwnd))),
        revealStep: t => t.findIndex(s => s.cwnd === Math.max(...t.map(x => x.cwnd))),
      }),
    ],
  },
]

// ═══ 磁盘调度 ═══════════════════════════════════════════
const diskProblems: Problem[] = [
  {
    id: 'disk-1',
    experimentId: 'disk',
    source: '典型题型 · 寻道算法比较',
    statement:
      '磁盘共 200 个磁道（编号 0–199）。当前磁头位于 53 号磁道，' +
      '请求队列依次为：98、183、37、122、14、124、65、67。磁头初始向磁道号增大的方向移动。',
    doc: {
      kind: 'disk',
      params: { algorithm: 'SSTF', headStart: 53, maxTrack: 199, direction: 1 },
      entities: [],
      streams: [{ name: 'requests', values: [98, 183, 37, 122, 14, 124, 65, 67] }],
    },
    questions: [
      q<DiskState>({
        prompt: '采用 SSTF，总寻道距离是多少？', unit: '个磁道',
        answer: t => String(last(t).total),
        revealStep: t => t.length - 1,
      }),
      q<DiskState>({
        prompt: 'SSTF 第一个被服务的磁道是？', unit: '号磁道',
        hint: '离 53 最近的那个',
        answer: t => String(t[0].served),
        revealStep: () => 0,
      }),
      q<DiskState>({
        prompt: '把算法改成 FCFS，总寻道距离是多少？', unit: '个磁道',
        hint: '在右侧把「调度算法」切到 FCFS',
        answer: (_t, d, runDoc) => {
          const f = runDoc({ ...d, params: { ...d.params, algorithm: 'FCFS' } }) as DiskState[]
          return String(f[f.length - 1].total)
        },
      }),
      q<DiskState>({
        prompt: 'SSTF 相比 FCFS 少走了多少个磁道？', unit: '个磁道',
        answer: (t, d, runDoc) => {
          const f = runDoc({ ...d, params: { ...d.params, algorithm: 'FCFS' } }) as DiskState[]
          return String(f[f.length - 1].total - last(t).total)
        },
      }),
    ],
  },
]

// ═══ 排序逐趟 ══════════════════════════════════════════
const SORT_INPUT = [49, 38, 65, 97, 76, 13, 27, 49]
/** 取"第 n 趟结束后"的序列 —— 考题问的就是它 */
const passResult = (t: SortState[], n: number) =>
  (t.filter(s => s.passEnd)[n - 1]?.arr ?? []).join(' ')

const sortProblems: Problem[] = [
  {
    id: 'sort-1',
    experimentId: 'sort',
    source: '典型题型 · 逐趟排序结果',
    statement:
      '对关键字序列 {49, 38, 65, 97, 76, 13, 27, 49} 进行排序。' +
      '注意其中有两个 49 —— 稳定性问题就藏在这里。',
    doc: {
      kind: 'sort', params: { algorithm: '冒泡' }, entities: [],
      streams: [{ name: 'array', values: SORT_INPUT }],
    },
    questions: [
      q<SortState>({
        prompt: '用冒泡排序，第 1 趟结束后的序列是？', kind: 'text',
        hint: '一趟冒泡把当前最大值送到末尾；答案用空格分隔',
        answer: t => passResult(t, 1),
        revealStep: t => t.findIndex(s => s.passEnd),
      }),
      q<SortState>({
        prompt: '用冒泡排序，第 3 趟结束后的序列是？', kind: 'text',
        answer: t => passResult(t, 3),
        revealStep: t => {
          const ends = t.filter(s => s.passEnd)
          return ends[2]?.i ?? t.length - 1
        },
      }),
      q<SortState>({
        prompt: '改用快速排序（基准取区间第一个元素），第 1 次划分后的序列是？', kind: 'text',
        hint: '在右侧把「排序算法」切到「快速」',
        answer: (_t, d, runDoc) =>
          passResult(runDoc({ ...d, params: { ...d.params, algorithm: '快速' } }) as SortState[], 1),
      }),
      q<SortState>({
        prompt: '快速排序第 1 次划分后，基准 49 落在哪个下标？', unit: '下标',
        hint: '划分结束那一步，被写入的位置就是基准的最终位置',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, algorithm: '快速' } }) as SortState[]
          const first = t.find(s => s.passEnd)
          return String(first?.changed[0] ?? -1)
        },
      }),
      q<SortState>({
        prompt: '用简单选择排序，总共需要多少次比较？', unit: '次',
        hint: '与初始序列无关，只取决于 n —— 想想为什么',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, algorithm: '简单选择' } }) as SortState[]
          return String(t[t.length - 1].comparisons)
        },
      }),
    ],
  },
]

// ═══ Dijkstra ══════════════════════════════════════════
const DIJ_EDGES: [string, string, number][] = [
  ['A', 'B', 4], ['A', 'C', 6], ['A', 'D', 6],
  ['B', 'C', 1], ['B', 'E', 7],
  ['C', 'D', 2], ['C', 'E', 6], ['C', 'F', 4],
  ['D', 'F', 5], ['E', 'F', 1], ['E', 'G', 6], ['F', 'G', 8],
]
const DIJ_XY: Record<string, [number, number]> = {
  A: [12, 50], B: [34, 18], C: [34, 74], D: [56, 92],
  E: [58, 22], F: [62, 58], G: [88, 40],
}
/** 从末态前驱表回溯出最短路径 */
const pathTo = (s: DijkstraState, to: string, src: string) => {
  const out = [to]
  let cur = to, guard = 0
  while (cur !== src && guard++ < 32) {
    const p = s.prev[cur]
    if (!p) return '不可达'
    out.unshift(p); cur = p
  }
  return out.join('→')
}

const dijkstraProblems: Problem[] = [
  {
    id: 'dij-1',
    experimentId: 'dijkstra',
    source: '典型题型 · 单源最短路径',
    statement:
      '给定一个带权无向图，顶点为 A~G，边与权值如图所示。' +
      '以 A 为源点，用 Dijkstra 算法求单源最短路径。',
    doc: {
      kind: 'dijkstra',
      params: { source: 'A', directed: 0 },
      entities: [
        ...Object.entries(DIJ_XY).map(([id, [x, y]]) => ({ id, type: 'node', attrs: { x, y } })),
        ...DIJ_EDGES.map(([from, to, w]) => ({ id: `${from}${to}`, type: 'edge', attrs: { from, to, w } })),
      ],
      streams: [],
    },
    questions: [
      q<DijkstraState>({
        prompt: 'A 到 G 的最短距离是多少？',
        answer: t => String(last(t).dist.G),
        revealStep: t => t.findIndex(s => s.act === 'pick' && s.at === 'G'),
      }),
      q<DijkstraState>({
        prompt: 'A 到 G 的最短路径经过哪些顶点？（如 A→B→G）', kind: 'text',
        hint: '看距离表里 G 那一格的括号，一路回溯',
        answer: (t, d) => pathTo(last(t), 'G', String(d.params.source)),
        revealStep: t => t.length - 1,
      }),
      q<DijkstraState>({
        prompt: '顶点被确定最短路的先后顺序是？（如 A B C…）', kind: 'text',
        hint: '每一轮选出的都是「未确定顶点中距离最小」的那个',
        answer: t => last(t).settled.join(' '),
        revealStep: t => t.length - 1,
      }),
      q<DijkstraState>({
        prompt: '第 3 个被确定的顶点是？', kind: 'text',
        answer: t => last(t).settled[2] ?? '—',
        revealStep: t => {
          const picks = t.map((s, i) => ({ s, i })).filter(x => x.s.act === 'pick')
          return picks[2]?.i ?? 0
        },
      }),
      q<DijkstraState>({
        prompt: '改以 D 为源点，D 到 B 的最短距离是多少？',
        hint: '在右侧把「源点」切到 D',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, source: 'D' } }) as DijkstraState[]
          return String(t[t.length - 1].dist.B)
        },
      }),
    ],
  },
]

// ═══ 银行家算法 ═════════════════════════════════════════
const BANK_ROWS: [string, number[], number[]][] = [
  ['P0', [7, 5, 3], [0, 1, 0]],
  ['P1', [3, 2, 2], [2, 0, 0]],
  ['P2', [9, 0, 2], [3, 0, 2]],
  ['P3', [2, 2, 2], [2, 1, 1]],
  ['P4', [4, 3, 3], [0, 0, 2]],
]
const bankDoc = (totals: number[]): SimDocument => ({
  kind: 'banker',
  params: { resources: 'A,B,C' },
  entities: [
    ...['A', 'B', 'C'].map((id, k) => ({ id, type: 'resource', attrs: { total: totals[k] } })),
    ...BANK_ROWS.map(([id, mx, al]) => ({
      id, type: 'process',
      attrs: {
        max_A: mx[0], max_B: mx[1], max_C: mx[2],
        alloc_A: al[0], alloc_B: al[1], alloc_C: al[2],
      },
    })),
  ],
  streams: [],
})

const bankerProblems: Problem[] = [
  {
    id: 'bank-1',
    experimentId: 'banker',
    source: '典型题型 · 安全性检查',
    statement:
      '系统有 A、B、C 三类资源，总量分别为 10、5、7。五个进程 P0~P4 的最大需求 Max 与' +
      '已分配 Allocation 如资源矩阵所示。用银行家算法判断当前状态是否安全。',
    doc: bankDoc([10, 5, 7]),
    questions: [
      q<BankerState>({
        prompt: '当前系统的 Available 向量是？（如 3 3 2）', kind: 'text',
        hint: 'Available = 总量 − 各进程已分配之和',
        answer: t => ['A', 'B', 'C'].map(r => t[0].work[r]).join(' '),
        revealStep: () => 0,
      }),
      q<BankerState>({
        prompt: 'P0 的 Need 向量是？（如 7 4 3）', kind: 'text',
        hint: 'Need = Max − Allocation',
        answer: t => ['A', 'B', 'C'].map(r => t[0].need.P0[r]).join(' '),
        revealStep: () => 0,
      }),
      q<BankerState>({
        prompt: '当前状态是否安全？（填 安全 或 不安全）', kind: 'text',
        answer: t => (last(t).act === 'safe' ? '安全' : '不安全'),
        revealStep: t => t.length - 1,
      }),
      q<BankerState>({
        prompt: '找到的安全序列是？（如 P1 P3 P0）', kind: 'text',
        hint: '安全序列通常不唯一，这里填本实验按登记顺序扫描找到的第一个',
        answer: t => last(t).sequence.join(' '),
        revealStep: t => t.length - 1,
      }),
      q<BankerState>({
        prompt: '若 A 类资源总量从 10 减到 8，系统还安全吗？（填 安全 或 不安全）', kind: 'text',
        hint: '总量减少会压低 Available，第一个能被满足的进程可能就没了',
        answer: (_t, _d, runDoc) => {
          const t = runDoc(bankDoc([8, 5, 7])) as BankerState[]
          return t[t.length - 1].act === 'safe' ? '安全' : '不安全'
        },
      }),
    ],
  },
]

// ═══ 滑动窗口 ARQ ═══════════════════════════════════════
const arqDoc = (protocol: string, windowSize: number): SimDocument => ({
  kind: 'arq',
  params: { protocol, windowSize, totalFrames: 8, delay: 2, timeout: 8 },
  entities: [{ id: 'L1', type: 'loss', attrs: { target: 'frame', seq: 2, nth: 1 } }],
  streams: [],
})

const arqProblems: Problem[] = [
  {
    id: 'arq-1',
    experimentId: 'arq',
    source: '典型题型 · 后退N帧与选择重传的差别',
    statement:
      '发送方要发送编号 0~7 共 8 个数据帧，发送窗口为 4，单程传播时延 2 个时隙，超时时间 8 个时隙。' +
      '其中 2 号帧在第一次传输时丢失，重传可以成功到达。',
    doc: arqDoc('GBN', 4),
    questions: [
      q<ArqState>({
        prompt: '采用后退 N 帧协议，总共需要传输多少帧次（含重传）？', unit: '帧次',
        answer: t => String(last(t).transmissions),
        revealStep: t => t.length - 1,
      }),
      q<ArqState>({
        prompt: '其中重传了多少帧次？', unit: '帧次',
        hint: '总传输次数减去 8',
        answer: (t, d) => String(last(t).transmissions - (d.params.totalFrames as number)),
        revealStep: t => Math.max(0, t.findIndex(s => s.event === 'timeout')),
      }),
      q<ArqState>({
        prompt: '2 号帧丢失后，接收方对随后到达的 3、4、5 号帧如何处理？（填 缓存 或 丢弃）', kind: 'text',
        hint: 'GBN 的接收窗口大小是 1',
        answer: (_t, d) => (d.params.protocol === 'SR' ? '缓存' : '丢弃'),
        revealStep: t => Math.max(0, t.findIndex(s => s.log.includes('直接丢弃'))),
      }),
      q<ArqState>({
        prompt: '改用选择重传协议，总共需要传输多少帧次？', unit: '帧次',
        hint: '在右侧把「协议」切到 SR',
        answer: (_t, _d, runDoc) => {
          const t = runDoc(arqDoc('SR', 4)) as ArqState[]
          return String(t[t.length - 1].transmissions)
        },
      }),
      q<ArqState>({
        prompt: '选择重传比后退 N 帧少传了多少帧次？', unit: '帧次',
        answer: (_t, _d, runDoc) => {
          const g = runDoc(arqDoc('GBN', 4)) as ArqState[]
          const s = runDoc(arqDoc('SR', 4)) as ArqState[]
          return String(g[g.length - 1].transmissions - s[s.length - 1].transmissions)
        },
      }),
    ],
  },
]

// ═══ IEEE 754 ══════════════════════════════════════════
const floatProblems: Problem[] = [
  {
    id: 'float-1',
    experimentId: 'float',
    source: '典型题型 · 浮点数的机器表示',
    statement:
      '将十进制数 −12.5 表示为 IEEE 754 单精度浮点数（1 位符号 + 8 位阶码 + 23 位尾数，偏置 127）。',
    doc: {
      kind: 'float', params: { format: 'single', operation: 'encode' }, entities: [],
      streams: [{ name: 'operands', values: [-12.5] }],
    },
    questions: [
      q<FloatState>({
        prompt: '符号位 S 是多少？',
        answer: t => last(t).bits[0],
        revealStep: t => t.findIndex(s => s.phase === 'sign'),
      }),
      q<FloatState>({
        prompt: '阶码字段（8 位二进制）是？', kind: 'text',
        hint: '真值 e 加上偏置 127',
        answer: t => last(t).bits.slice(1, 9),
        revealStep: t => t.findIndex(s => s.phase === 'exponent'),
      }),
      q<FloatState>({
        prompt: '完整的 32 位机器数用十六进制表示是？（如 0xC1480000）', kind: 'text',
        answer: t => '0x' + BigInt('0b' + last(t).bits).toString(16).toUpperCase().padStart(8, '0'),
        revealStep: t => t.length - 1,
      }),
      q<FloatState>({
        prompt: '把这个数改成 0.1，尾数还能精确表示吗？（填 能 或 不能）', kind: 'text',
        hint: '在上面的操作数框里把 −12.5 改成 0.1，看第 3 步的说明',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, streams: [{ name: 'operands', values: [0.1] }] }) as FloatState[]
          return t.some(s => String(s.detail['是否有限'] ?? '').includes('无限')) ? '不能' : '能'
        },
      }),
    ],
  },
]

// ═══ 流水线 ════════════════════════════════════════════
const pipeProblems: Problem[] = [
  {
    id: 'pipe-1',
    experimentId: 'pipeline',
    source: '典型题型 · 流水线数据冒险与前递',
    statement:
      '五段流水线（IF/ID/EX/MEM/WB），四条算术指令依次相关：'
      + '每一条都要用上一条刚写入的寄存器。寄存器堆前半周期写、后半周期读。',
    doc: {
      kind: 'pipeline', params: { forwarding: 0 },
      entities: PIPE_PRESETS[1].entities, streams: [],
    },
    questions: [
      q<PipeState>({
        prompt: '不采用数据前递时，执行完这 4 条指令共需多少个时钟周期？', unit: '周期',
        answer: t => String(t.length),
        revealStep: t => t.length - 1,
      }),
      q<PipeState>({
        prompt: '采用数据前递后，共需多少个时钟周期？', unit: '周期',
        hint: '把右侧「数据前递」切到 1',
        answer: (_t, d, runDoc) =>
          String((runDoc({ ...d, params: { ...d.params, forwarding: 1 } }) as PipeState[]).length),
      }),
      q<PipeState>({
        prompt: '前递省下了多少个周期？', unit: '周期',
        answer: (t, d, runDoc) =>
          String(t.length - (runDoc({ ...d, params: { ...d.params, forwarding: 1 } }) as PipeState[]).length),
      }),
      q<PipeState>({
        prompt: '若 4 条指令互不相关，理想情况下需要多少周期？', unit: '周期',
        hint: '段数 + (指令数 − 1)',
        answer: (_t, d) => String(5 + d.entities.filter(e => e.type === 'inst').length - 1),
      }),
    ],
  },
]

// ═══ 虚存 ══════════════════════════════════════════════
const vmProblems: Problem[] = [
  {
    id: 'vm-1',
    experimentId: 'vm',
    source: '典型题型 · 虚地址转换与 TLB',
    statement:
      '某系统采用分页管理，虚地址 16 位，页大小 4KB，TLB 有 4 项、全相联、LRU 替换。'
      + '页表如右表所示（有效位为 0 表示该页不在内存）。CPU 依次访问给定的虚地址序列。',
    doc: {
      kind: 'vm',
      params: { virtualBits: 16, pageSizeBytes: 4096, tlbEntries: 4 },
      entities: VM_PRESETS[0].entities,
      streams: [{ name: 'virtualAddresses', values: [0x0000, 0x0FFF, 0x1000, 0x2ABC, 0x3001, 0x4001, 0x0002, 0x5FFF] }],
    },
    questions: [
      q<VmState>({
        prompt: '虚地址中页内偏移占多少位？', unit: '位',
        hint: '页大小 4KB = 2^12',
        answer: (_t, d) => String(Math.log2(d.params.pageSizeBytes as number)),
        revealStep: () => 0,
      }),
      q<VmState>({
        prompt: '访问 0x2ABC 时，虚页号是多少？',
        answer: t => String(t[3].vpn),
        revealStep: () => 3,
      }),
      q<VmState>({
        prompt: '访问 0x2ABC 得到的物理地址是？（十六进制，如 0x3ABC）', kind: 'text',
        answer: t => t[3].paddr === null ? '缺页' : '0x' + t[3].paddr.toString(16).toUpperCase(),
        revealStep: () => 3,
      }),
      q<VmState>({
        prompt: '整个序列中发生了几次缺页？', unit: '次',
        answer: t => String(last(t).faults),
        revealStep: t => t.findIndex(s => s.outcome === 'fault'),
      }),
      q<VmState>({
        prompt: '把 TLB 缩到 1 项，TLB 命中次数变成多少？', unit: '次',
        hint: '在右侧把「TLB 项数」切到 1',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, tlbEntries: 1 } }) as VmState[]
          return String(t[t.length - 1].tlbHits)
        },
      }),
    ],
  },
]

// ═══ 定点乘除 ══════════════════════════════════════════
const mulProblems: Problem[] = [
  {
    id: 'mul-1',
    experimentId: 'multiply',
    source: '典型题型 · Booth 算法',
    statement:
      '用 Booth 算法计算 (−5) × 3，字长 8 位，结果用补码表示。'
      + '（乘数末尾补一个附加位 0，每轮看「末位 + 附加位」两位决定加、减还是不动。）',
    doc: {
      kind: 'multiply', params: { algorithm: 'Booth', bits: 8 }, entities: [],
      streams: [{ name: 'operands', values: [-5, 3] }],
    },
    questions: [
      q<MulState>({
        prompt: '共需要多少轮？', unit: '轮',
        hint: '一位乘每轮处理一位',
        answer: (_t, d) => String(d.params.bits),
        revealStep: t => t.length - 1,
      }),
      q<MulState>({
        prompt: '第 1 轮的判断位组合是？（如 01）', kind: 'text',
        answer: t => t.find(s => s.round === 1 && s.judge)?.judge ?? '—',
        revealStep: t => t.findIndex(s => s.round === 1 && !!s.judge),
      }),
      q<MulState>({
        prompt: '最终乘积是多少（十进制）？',
        answer: t => {
          const m = last(t).log.match(/= (-?\d+)（/)
          return m ? m[1] : '—'
        },
        revealStep: t => t.length - 1,
      }),
      q<MulState>({
        prompt: '改用加减交替法算 11 ÷ 3，商是多少？',
        hint: '把算法切到「加减交替」，操作数改成 11 3',
        answer: (_t, d, runDoc) => {
          const t = runDoc({
            ...d, params: { ...d.params, algorithm: '加减交替' },
            streams: [{ name: 'operands', values: [11, 3] }],
          }) as MulState[]
          return String(t[t.length - 1].q)
        },
      }),
    ],
  },
]

// ═══ CRC ═══════════════════════════════════════════════
const crcProblems: Problem[] = [
  {
    id: 'crc-1',
    experimentId: 'crc',
    source: '典型题型 · CRC 校验码计算',
    statement:
      '数据为 1101011011，生成多项式 G(x) = x⁴ + x + 1（即 10011）。'
      + '求循环冗余校验码（FCS），并写出实际发送的码字。',
    doc: {
      kind: 'crc',
      params: { generator: '10011', operation: 'encode', errorAt: -1 },
      entities: [],
      streams: [{ name: 'dataBits', values: [1,1,0,1,0,1,1,0,1,1] }],
    },
    questions: [
      q<CrcState>({
        prompt: '校验码是几位？', unit: '位',
        hint: '生成多项式的位数减 1',
        answer: (_t, d) => String(String(d.params.generator).length - 1),
      }),
      q<CrcState>({
        prompt: '数据后面要补几个 0 再做除法？', unit: '个',
        answer: (_t, d) => String(String(d.params.generator).length - 1),
        revealStep: () => 0,
      }),
      q<CrcState>({
        prompt: '余数（FCS）是多少？', kind: 'text',
        answer: t => last(t).remainder,
        revealStep: t => t.length - 1,
      }),
      q<CrcState>({
        prompt: '实际发送的码字是多少？', kind: 'text',
        answer: t => last(t).dividend,
        revealStep: t => t.length - 1,
      }),
      q<CrcState>({
        prompt: '若第 3 位在传输中翻转，接收端算出的余数还是全 0 吗？（填 是 或 否）', kind: 'text',
        hint: '把「做什么」切到 check，「注入错误位」切到 3',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, operation: 'check', errorAt: 3 } }) as CrcState[]
          return /^0*$/.test(t[t.length - 1].remainder) ? '是' : '否'
        },
      }),
    ],
  },
]

// ═══ 海明码 ════════════════════════════════════════════
const hammingProblems: Problem[] = [
  {
    id: 'ham-1',
    experimentId: 'hamming',
    source: '典型题型 · 海明码的编码与纠错',
    statement:
      '对 4 位数据 1011 编海明码（偶校验，校验位放在 1、2、4 位）。'
      + '传输中第 5 位发生了翻转，接收端如何定位并纠正？',
    doc: {
      kind: 'hamming',
      params: { operation: 'check', errorAt: 5, evenParity: 1 },
      entities: [],
      streams: [{ name: 'dataBits', values: [1,0,1,1] }],
    },
    questions: [
      q<HammingState>({
        prompt: '需要几位校验位？', unit: '位',
        hint: '满足 2^r ≥ k + r + 1 的最小 r',
        answer: (_t, d) => {
          const k = (d.streams.find(x => x.name === 'dataBits')?.values ?? []).length
          let r = 0
          while (Math.pow(2, r) < k + r + 1) r++
          return String(r)
        },
        revealStep: () => 0,
      }),
      q<HammingState>({
        prompt: '码字总长是多少位？', unit: '位',
        answer: t => String(t[0].bits.length),
        revealStep: () => 0,
      }),
      q<HammingState>({
        prompt: 'P1 负责校验哪几位？（按位号从小到大，空格分隔）', kind: 'text',
        hint: '位号的二进制里含 1 的那些位',
        answer: t => (t.find(s => s.phase === 'parity' && s.p === 1)?.covers ?? []).join(' '),
        revealStep: t => t.findIndex(s => s.phase === 'parity' && s.p === 1),
      }),
      q<HammingState>({
        prompt: '接收端算出的校验子是多少？',
        answer: t => String(last(t).syndrome),
        revealStep: t => t.findIndex(s => s.phase === 'locate'),
      }),
      q<HammingState>({
        prompt: '若改成第 7 位出错，校验子会是多少？',
        hint: '把「让第几位出错」切到 7',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, errorAt: 7 } }) as HammingState[]
          return String(t[t.length - 1].syndrome)
        },
      }),
    ],
  },
]

// ═══ 子网划分 ══════════════════════════════════════════
const subnetProblems: Problem[] = [
  {
    id: 'sub-1',
    experimentId: 'subnet',
    source: '典型题型 · 子网划分',
    statement:
      '某主机的 IP 地址为 192.168.10.130，子网掩码为 /25（255.255.255.128）。'
      + '求该子网的网络地址、广播地址与可用主机数。',
    doc: {
      kind: 'subnet',
      params: { operation: 'subnet', prefix: 25, splitBits: 0 },
      entities: ROUTE_PRESETS[0].entities,
      streams: [{ name: 'addresses', values: [((192 << 24) | (168 << 16) | (10 << 8) | 130) >>> 0] }],
    },
    questions: [
      q<SubnetState>({
        prompt: '主机号占多少位？', unit: '位',
        answer: (_t, d) => String(32 - (d.params.prefix as number)),
        revealStep: t => t.findIndex(s => s.phase === 'mask'),
      }),
      q<SubnetState>({
        prompt: '网络地址是？（点分十进制，如 192.168.10.128）', kind: 'text',
        answer: t => {
          const b = t.find(s => s.phase === 'network')!.bits
          return (b.match(/.{8}/g) ?? []).map(x => parseInt(x, 2)).join('.')
        },
        revealStep: t => t.findIndex(s => s.phase === 'network'),
      }),
      q<SubnetState>({
        prompt: '广播地址是？（点分十进制）', kind: 'text',
        answer: t => {
          const b = t.find(s => s.phase === 'broadcast')!.bits
          return (b.match(/.{8}/g) ?? []).map(x => parseInt(x, 2)).join('.')
        },
        revealStep: t => t.findIndex(s => s.phase === 'broadcast'),
      }),
      q<SubnetState>({
        prompt: '这个子网最多能分配给多少台主机？', unit: '台',
        hint: '2^主机位 − 2（去掉网络地址和广播地址）',
        answer: t => t.find(s => s.phase === 'hosts')!.detail['可用主机数'],
        revealStep: t => t.findIndex(s => s.phase === 'hosts'),
      }),
      q<SubnetState>({
        prompt: '改成 /26，可用主机数变成多少？', unit: '台',
        hint: '把右侧「前缀长度」切到 26',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, prefix: 26 } }) as SubnetState[]
          return t.find(s => s.phase === 'hosts')!.detail['可用主机数']
        },
      }),
    ],
  },
]

// ═══ TCP 连接管理 ══════════════════════════════════════
const hsProblems: Problem[] = [
  {
    id: 'hs-1',
    experimentId: 'handshake',
    source: '典型题型 · 三次握手与四次挥手',
    statement:
      '客户端与服务器建立 TCP 连接，客户端初始序号 100，服务器初始序号 300；'
      + '数据传输结束后由客户端主动关闭。',
    doc: {
      kind: 'handshake',
      params: { scenario: 'both', clientSeq: 100, serverSeq: 300 },
      entities: [], streams: [],
    },
    questions: [
      q<HsState>({
        prompt: '建立连接共交换多少个报文段？', unit: '个',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, scenario: 'connect' } }) as HsState[]
          return String(t[t.length - 1].history.length)
        },
      }),
      q<HsState>({
        prompt: '第二次握手报文段的确认号 ack 是多少？',
        hint: 'SYN 要消耗一个序号',
        answer: t => {
          const seg = t.map(s => s.seg).filter(Boolean)[1]
          return String(seg!.ack)
        },
        revealStep: t => t.findIndex(s => s.seg?.flags === 'SYN+ACK'),
      }),
      q<HsState>({
        prompt: '客户端收到 SYN+ACK 后进入什么状态？', kind: 'text',
        answer: t => {
          const k = t.findIndex(s => s.seg?.flags === 'SYN+ACK' && s.act === 'send')
          return t.slice(k).find(s => s.act === 'arrive')?.client ?? '—'
        },
        revealStep: t => {
          const k = t.findIndex(s => s.seg?.flags === 'SYN+ACK' && s.act === 'send')
          return t.slice(k).findIndex(s => s.act === 'arrive') + k
        },
      }),
      q<HsState>({
        prompt: '服务器收到第一个 FIN 后进入什么状态？', kind: 'text',
        hint: '它可能还有数据没发完，所以不能直接关',
        answer: t => {
          const k = t.findIndex(s => s.seg?.flags === 'FIN' && s.act === 'send')
          return t.slice(k).find(s => s.act === 'arrive')?.server ?? '—'
        },
        revealStep: t => {
          const k = t.findIndex(s => s.seg?.flags === 'FIN' && s.act === 'send')
          return t.slice(k).findIndex(s => s.act === 'arrive') + k
        },
      }),
      q<HsState>({
        prompt: '释放连接共交换多少个报文段？', unit: '个',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, scenario: 'close' } }) as HsState[]
          return String(t[t.length - 1].history.length)
        },
      }),
    ],
  },
]

// ═══ AVL ═══════════════════════════════════════════════
const avlProblems: Problem[] = [
  {
    id: 'avl-1',
    experimentId: 'avl',
    source: '典型题型 · AVL 树的插入与调整',
    statement:
      '依次将 10、20、30、40、50、25 插入一棵初始为空的平衡二叉树（AVL 树），'
      + '每次插入后若失衡则立即调整。',
    doc: {
      kind: 'avl', params: { mode: 'avl' }, entities: [],
      streams: [{ name: 'keys', values: [10, 20, 30, 40, 50, 25] }],
    },
    questions: [
      q<AvlState>({
        prompt: '整个过程共发生几次旋转？', unit: '次',
        answer: t => String(last(t).rotations),
        revealStep: t => t.findIndex(s => s.act === 'rotate'),
      }),
      q<AvlState>({
        prompt: '第一次旋转是哪种类型？（填 LL / RR / LR / RL）', kind: 'text',
        answer: t => t.find(s => s.act === 'rotate')?.rotation ?? '无',
        revealStep: t => t.findIndex(s => s.act === 'rotate'),
      }),
      q<AvlState>({
        prompt: '最终树的根结点是哪个键？',
        answer: t => {
          const l = last(t)
          return l.root === NIL ? '空' : String(l.nodes[l.root].key)
        },
        revealStep: t => t.length - 1,
      }),
      q<AvlState>({
        prompt: '最终树高是多少？', unit: '层',
        answer: t => String(trueHeight(last(t).nodes, last(t).root)),
        revealStep: t => t.length - 1,
      }),
      q<AvlState>({
        prompt: '若关掉旋转（普通 BST），最终树高会是多少？', unit: '层',
        hint: '把右侧「模式」切到 bst',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, mode: 'bst' } }) as AvlState[]
          const l = t[t.length - 1]
          return String(trueHeight(l.nodes, l.root))
        },
      }),
    ],
  },
]

// ═══ 散列表 ════════════════════════════════════════════
const hashProblems: Problem[] = [
  {
    id: 'hash-1',
    experimentId: 'hash',
    source: '典型题型 · 线性探测与 ASL',
    statement:
      '将关键字 19、14、23、1、68、20、84、27、55、11 依次插入长度为 13 的散列表，'
      + '散列函数 H(key) = key mod 13，用线性探测法处理冲突。',
    doc: {
      kind: 'hash', params: { size: 13, method: '线性探测', rehashStep: 3 }, entities: [],
      streams: [{ name: 'keys', values: [19,14,23,1,68,20,84,27,55,11] }],
    },
    questions: [
      q<HashState>({
        prompt: '关键字 19 的初始散列地址是多少？',
        answer: t => String(t[0].home),
        revealStep: () => 0,
      }),
      q<HashState>({
        prompt: '第一个发生冲突的关键字是哪个？',
        hint: '第一次探查次数大于 1 的那个',
        answer: t => String((t.find(s => s.collided) ?? t[0]).key),
        revealStep: t => Math.max(0, t.findIndex(s => s.collided)),
      }),
      q<HashState>({
        prompt: '关键字 27 最终落在哪个槽？', unit: '号槽',
        answer: t => String((t.find(s => s.key === 27) ?? t[0]).slot),
        revealStep: t => Math.max(0, t.findIndex(s => s.key === 27)),
      }),
      q<HashState>({
        prompt: '查找成功的平均查找长度 ASL 是多少（保留三位小数）？', kind: 'text',
        hint: '各元素查找长度之和 ÷ 元素个数',
        answer: (t, d) => asl(last(t).table, d.params.size as number,
          String(d.params.method), d.params.rehashStep as number).success.toFixed(3),
        revealStep: t => t.length - 1,
      }),
      q<HashState>({
        prompt: '改用拉链法，ASL 成功变成多少（保留三位小数）？', kind: 'text',
        hint: '把「冲突处理」切到拉链',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, method: '拉链' } }) as HashState[]
          return asl(t[t.length - 1].table, d.params.size as number, '拉链').success.toFixed(3)
        },
      }),
    ],
  },
]

// ═══ 哈夫曼 ════════════════════════════════════════════
const huffProblems: Problem[] = [
  {
    id: 'huff-1',
    experimentId: 'huffman',
    source: '典型题型 · 哈夫曼树与 WPL',
    statement:
      '设有 8 个字符 A~H，权值分别为 5、29、7、8、14、23、3、11。'
      + '构造哈夫曼树并求带权路径长度 WPL。',
    doc: {
      kind: 'huffman', params: {}, entities: [],
      streams: [{ name: 'weights', values: [5,29,7,8,14,23,3,11] }],
    },
    questions: [
      q<HuffState>({
        prompt: '构造过程共需要合并多少次？', unit: '次',
        hint: 'n 个叶子合并 n−1 次',
        answer: (_t, d) => String((d.streams.find(x => x.name === 'weights')?.values ?? []).length - 1),
      }),
      q<HuffState>({
        prompt: '第一次合并产生的新结点权值是多少？',
        answer: t => {
          const m = t.find(s => s.act === 'merge')
          return m ? String(m.nodes[m.merged].w) : '—'
        },
        revealStep: t => t.findIndex(s => s.act === 'merge'),
      }),
      q<HuffState>({
        prompt: '带权路径长度 WPL 是多少？',
        answer: t => String(last(t).wpl),
        revealStep: t => t.length - 1,
      }),
      q<HuffState>({
        prompt: '权值最大的字符 B（29）的编码有几位？', unit: '位',
        hint: '权值越大编码越短',
        answer: t => String((last(t).codes['B'] ?? '').length),
        revealStep: t => t.length - 1,
      }),
      q<HuffState>({
        prompt: '权值最小的字符 G（3）的编码有几位？', unit: '位',
        answer: t => String((last(t).codes['G'] ?? '').length),
        revealStep: t => t.length - 1,
      }),
    ],
  },
]

// ═══ KMP ═══════════════════════════════════════════════
const kmpProblems: Problem[] = [
  {
    id: 'kmp-1',
    experimentId: 'kmp',
    source: '典型题型 · KMP 的 next 数组',
    statement:
      '模式串为 "ababd"，主串为 "ababcabcabababd"。'
      + '求模式串的 next 数组，并用 KMP 算法完成匹配。',
    doc: {
      kind: 'kmp',
      params: { text: 'ababcabcabababd', pattern: 'ababd', showMatch: 1 },
      entities: [], streams: [],
    },
    questions: [
      q<KmpState>({
        prompt: 'next 数组是多少？（空格分隔，如 0 0 1 2 0）', kind: 'text',
        hint: 'next[j] = 前 j+1 个字符里最长的相等前后缀长度',
        answer: t => last(t).next.join(' '),
        revealStep: t => t.findIndex(s => s.phase !== 'next'),
      }),
      q<KmpState>({
        prompt: '模式串在主串中第一次匹配成功的起始下标是？', unit: '下标',
        answer: t => String(last(t).found[0] ?? -1),
        revealStep: t => Math.max(0, t.findIndex(s => s.phase === 'found')),
      }),
      q<KmpState>({
        prompt: '整个匹配过程中，主串指针一共前进了多少次？', unit: '次',
        hint: '这个数不会超过主串长度 —— KMP 是线性的',
        answer: t => String(last(t).textAdvances),
        revealStep: t => t.length - 1,
      }),
      q<KmpState>({
        prompt: '把模式串换成 "aaaa"，它的 next 数组是？（空格分隔）', kind: 'text',
        hint: '在右侧把「模式串」切到 aaaa',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, pattern: 'aaaa' } }) as KmpState[]
          return t[t.length - 1].next.join(' ')
        },
      }),
    ],
  },
]

// ═══ 最小生成树 ════════════════════════════════════════
const mstProblems: Problem[] = [
  {
    id: 'mst-1', experimentId: 'mst',
    source: '典型题型 · Prim 与 Kruskal',
    statement:
      '给定一个 6 个顶点的连通带权无向图（边与权值见图），'
      + '分别用 Prim（从 A 出发）和 Kruskal 求最小生成树。',
    doc: { kind: 'mst', params: { algorithm: 'Prim', start: 'A' },
      entities: MST_PRESETS[0].entities, streams: [] },
    questions: [
      q<MstState>({
        prompt: '最小生成树有几条边？', unit: '条',
        hint: 'n 个顶点的生成树恰好 n−1 条边',
        answer: (_t, d) => String(d.entities.filter(e => e.type === 'node').length - 1),
      }),
      q<MstState>({
        prompt: 'Prim 从 A 出发，第一条选入的边是？（如 AC）', kind: 'text',
        answer: t => t.find(s => s.act === 'take')?.edge ?? '—',
        revealStep: t => t.findIndex(s => s.act === 'take'),
      }),
      q<MstState>({
        prompt: '最小生成树的总权值是多少？',
        answer: t => String(last(t).weight),
        revealStep: t => t.length - 1,
      }),
      q<MstState>({
        prompt: '改用 Kruskal，总权值是多少？',
        hint: '两种算法的总权值一定相同 —— 这是 MST 的性质',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, algorithm: 'Kruskal' } }) as MstState[]
          return String(t[t.length - 1].weight)
        },
      }),
      q<MstState>({
        prompt: 'Kruskal 过程中丢弃了几条会成环的边？', unit: '条',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, algorithm: 'Kruskal' } }) as MstState[]
          return String(t.filter(s => s.act === 'skip').length)
        },
      }),
    ],
  },
]

// ═══ 关键路径 ══════════════════════════════════════════
const topoProblems: Problem[] = [
  {
    id: 'topo-1', experimentId: 'topo',
    source: '典型题型 · AOE 网的关键路径',
    statement:
      '某工程的 AOE 网有 7 个事件 V1~V7、9 个活动，边上的数字表示活动持续时间。'
      + '求关键路径与工程总工期。',
    doc: { kind: 'topo', params: { operation: 'critical' },
      entities: AOE_PRESETS[0].entities, streams: [] },
    questions: [
      q<TopoState>({
        prompt: '该图的一个拓扑序列是？（空格分隔，如 V1 V2 V3…）', kind: 'text',
        hint: '入度为 0 的有多个时按名字字典序取',
        answer: t => (t.filter(s => s.phase === 'topo').at(-1)?.order ?? []).join(' '),
        revealStep: t => t.filter(s => s.phase === 'topo').length - 1,
      }),
      q<TopoState>({
        prompt: '汇点 V7 的最早发生时间 ve(V7) 是多少？',
        answer: t => String(last(t).ve['V7'] ?? 0),
        revealStep: t => t.findIndex(s => s.phase === 'vl'),
      }),
      q<TopoState>({
        prompt: '工程总工期是多少？',
        hint: '总工期 = 汇点的 ve',
        answer: t => String(Math.max(...Object.values(last(t).ve))),
        revealStep: t => t.length - 1,
      }),
      q<TopoState>({
        prompt: '关键活动有几个？', unit: '个',
        answer: t => String(last(t).critical.length),
        revealStep: t => t.length - 1,
      }),
      q<TopoState>({
        prompt: '活动 V2→V5 的时间余量是多少？',
        hint: '余量 = l − e；余量为 0 的才是关键活动',
        answer: t => {
          const l = last(t)
          const id = 'V2→V5'
          return String((l.el[id] ?? 0) - (l.ee[id] ?? 0))
        },
        revealStep: t => Math.max(0, t.findIndex(s => s.at === 'V2→V5')),
      }),
    ],
  },
]

// ═══ 动态分区 ══════════════════════════════════════════
const partProblems: Problem[] = [
  {
    id: 'part-1', experimentId: 'partition',
    source: '典型题型 · 动态分区放置策略',
    statement:
      '内存总容量 640 KB，初始为一个空闲分区。按请求序列依次申请与释放，'
      + '比较四种放置策略的结果。',
    doc: { kind: 'partition', params: { algorithm: '首次适应', memorySize: 640 },
      entities: PART_PRESETS[0].entities, streams: [] },
    questions: [
      q<PartState>({
        prompt: '首次适应下，作业5（60 KB）落在哪个起址？', unit: '起址',
        answer: t => String((t.find(s => s.job === '作业5') ?? t[0]).at),
        revealStep: t => Math.max(0, t.findIndex(s => s.job === '作业5')),
      }),
      q<PartState>({
        prompt: '最坏适应下，作业5 落在哪个起址？（与首次适应比一比）', unit: '起址',
        hint: '把「放置策略」切到最坏适应',
        answer: (_t, d, runDoc) => {
          const t = runDoc({ ...d, params: { ...d.params, algorithm: '最坏适应' } }) as PartState[]
          return String((t.find(s => s.job === '作业5') ?? t[0]).at)
        },
      }),
      q<PartState>({
        prompt: '作业6 申请 220 KB，四种策略下都发生了什么？（填 成功 或 失败）', kind: 'text',
        hint: '看空闲总量够不够，再看有没有一整块够大的',
        answer: t => ((t.find(s => s.job === '作业6') ?? t[0]).act === 'fail' ? '失败' : '成功'),
        revealStep: t => Math.max(0, t.findIndex(s => s.job === '作业6')),
      }),
      q<PartState>({
        prompt: '作业6 失败时，内存里的空闲总量是多少？（说明这是外碎片，不是内存不够）', unit: 'KB',
        answer: t => String((t.find(s => s.job === '作业6') ?? t[0]).freeTotal),
        revealStep: t => Math.max(0, t.findIndex(s => s.job === '作业6')),
      }),
      q<PartState>({
        prompt: '作业7（40 KB）在四种策略下分别落在哪个起址？（按 首次 最佳 最坏 邻近 的顺序，空格分隔）',
        kind: 'text',
        hint: '这一步四种策略的结果各不相同 —— 正好看出它们的区别',
        answer: (_t, d, runDoc) => ['首次适应', '最佳适应', '最坏适应', '邻近适应']
          .map(a => {
            const t = runDoc({ ...d, params: { ...d.params, algorithm: a } }) as PartState[]
            return String((t.find(s => s.job === '作业7') ?? t[0]).at)
          }).join(' '),
      }),
    ],
  },
]

// ═══ 文件索引 ══════════════════════════════════════════
const inodeProblems: Problem[] = [
  {
    id: 'inode-1', experimentId: 'inode',
    source: '典型题型 · 混合索引寻址',
    statement:
      '某文件系统采用混合索引：inode 中有 10 个直接地址、1 个一级间接、1 个二级间接、'
      + '1 个三级间接。磁盘块大小 1 KB，每个指针占 4 B。',
    doc: {
      kind: 'inode',
      params: { blockSizeBytes: 1024, pointerSizeBytes: 4, directCount: 10 },
      entities: [],
      streams: [{ name: 'blockNumbers', values: [5, 100, 1000, 100000] }],
    },
    questions: [
      q<InodeState>({
        prompt: '一个索引块能存放多少个指针？', unit: '个',
        hint: '块大小 ÷ 指针大小',
        answer: (_t, d) => String(Math.floor((d.params.blockSizeBytes as number) / (d.params.pointerSizeBytes as number))),
        revealStep: () => 0,
      }),
      q<InodeState>({
        prompt: '逻辑块号 100 落在哪一级？（填 直接/一级间接/二级间接/三级间接）', kind: 'text',
        answer: t => {
          const s = t.find(x => x.lbn === 100)
          return { direct: '直接', single: '一级间接', double: '二级间接',
            triple: '三级间接', oob: '越界' }[s?.level ?? 'oob']
        },
        revealStep: t => Math.max(0, t.findIndex(x => x.lbn === 100)),
      }),
      q<InodeState>({
        prompt: '访问逻辑块号 1000 需要读几次磁盘？', unit: '次',
        answer: t => String((t.find(x => x.lbn === 1000) ?? t[0]).reads),
        revealStep: t => Math.max(0, t.findIndex(x => x.lbn === 1000)),
      }),
      q<InodeState>({
        prompt: '二级间接能覆盖的逻辑块号从哪一号开始？', unit: '号',
        hint: '前面的直接与一级间接加起来',
        answer: t => String(t[0].ranges[2].from),
        revealStep: () => 0,
      }),
      q<InodeState>({
        prompt: '这种 inode 支持的单个文件最大是多少 GB（保留两位小数）？', kind: 'text',
        answer: (_t, d) => {
          const m = maxFileSize(d.params.blockSizeBytes as number,
            d.params.pointerSizeBytes as number, d.params.directCount as number)
          return (m / (1 << 30)).toFixed(2)
        },
      }),
    ],
  },
]

export const PROBLEMS: Problem[] = [
  ...cacheProblems, ...pageProblems, ...schedProblems, ...tcpProblems, ...diskProblems,
  ...sortProblems, ...dijkstraProblems, ...bankerProblems, ...arqProblems,
  ...floatProblems, ...pipeProblems, ...vmProblems, ...mulProblems,
  ...crcProblems, ...hammingProblems, ...subnetProblems, ...hsProblems,
  ...avlProblems, ...hashProblems, ...huffProblems, ...kmpProblems,
  ...mstProblems, ...topoProblems, ...partProblems, ...inodeProblems,
]

export const problemsFor = (experimentId: string) =>
  PROBLEMS.filter(p => p.experimentId === experimentId)
