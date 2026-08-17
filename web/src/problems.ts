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
import { PIPE_PRESETS, VM_PRESETS } from '@engine/presets/entities.ts'

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

export const PROBLEMS: Problem[] = [
  ...cacheProblems, ...pageProblems, ...schedProblems, ...tcpProblems, ...diskProblems,
  ...sortProblems, ...dijkstraProblems, ...bankerProblems, ...arqProblems,
  ...floatProblems, ...pipeProblems, ...vmProblems, ...mulProblems,
]

export const problemsFor = (experimentId: string) =>
  PROBLEMS.filter(p => p.experimentId === experimentId)
