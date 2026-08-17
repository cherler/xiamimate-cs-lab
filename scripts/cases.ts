/**
 * AI 填 DSL 的测试题库。
 *
 * 五类：
 *   A 标准题   —— 常见题型，参考答案明确
 *   B 变体题   —— 覆盖参数空间（Tahoe/FCFS/RR/直接映射/FIFO…）
 *   C 表述变体 —— 同一个实验换个说法出题（KB/组数×行数/十进制/"行"…），测健壮性
 *   D 陷阱题   —— 题目本身不合法，验证器必须拦下
 *   E 歧义题   —— 条件不全，只记录模型选了什么，不判对错
 *
 * A/B/C 的判据都是：AI 填的 doc 跑出的轨迹 ≡ 手写参考 doc 的轨迹（exact）。
 */
import type { SimDocument } from '../src/core/document.ts'

export type Category = 'A' | 'B' | 'C' | 'D' | 'E'

export type ExactCase = {
  cat: 'A' | 'B' | 'C'
  name: string
  kind: 'cache' | 'scheduler' | 'tcp'
  problem: string
  reference: SimDocument
}

export type TrapCase = {
  cat: 'D'
  name: string
  kind: 'cache' | 'scheduler' | 'tcp'
  problem: string
  /** 期望验证器在哪个字段上报错 */
  expectField: string
}

export type AmbiguousCase = {
  cat: 'E'
  name: string
  kind: 'cache' | 'scheduler' | 'tcp'
  problem: string
  /** 题目没说清的东西 —— 只记录模型填了啥 */
  watch: string[]
}

const cache = (
  cacheSizeBytes: number, blockSizeBytes: number, associativity: number,
  replacement: 'LRU' | 'FIFO', seq: number[],
): SimDocument => ({
  kind: 'cache',
  params: { addressBits: 32, cacheSizeBytes, blockSizeBytes, associativity, replacement },
  entities: [],
  streams: [{ name: 'accessSequence', values: seq }],
})

const sched = (
  algorithm: 'FCFS' | 'SJF' | 'SRTF' | 'RR', quantum: number,
  procs: [string, number, number][],
): SimDocument => ({
  kind: 'scheduler',
  params: { algorithm, quantum },
  entities: procs.map(([id, at, burst]) => ({ id, type: 'process', at, attrs: { burst } })),
  streams: [],
})

const tcp = (
  variant: 'Tahoe' | 'Reno', initialCwnd: number, initialSsthresh: number, rounds: number,
  losses: [number, 'timeout' | 'tripleDup'][],
): SimDocument => ({
  kind: 'tcp',
  params: { variant, initialCwnd, initialSsthresh, rounds },
  entities: losses.map(([at, type], i) => ({ id: `L${i + 1}`, type: 'loss', at, attrs: { type } })),
  streams: [],
})

// ═══ A · 标准题 ════════════════════════════════════════
const A: ExactCase[] = [
  {
    cat: 'A', name: 'Cache 4路组相联 LRU（十六进制地址）', kind: 'cache',
    problem: '某计算机主存按字节编址，地址为 32 位。Cache 数据区容量 512B，主存块大小 32B，' +
      '采用 4 路组相联映射，替换策略为 LRU。CPU 按顺序访问以下主存地址（十六进制）：' +
      '0x00、0x20、0x40、0x60、0x80、0x00、0x20。请给出每次访问的命中情况。',
    reference: cache(512, 32, 4, 'LRU', [0x00, 0x20, 0x40, 0x60, 0x80, 0x00, 0x20]),
  },
  {
    cat: 'A', name: '调度 SRTF 四进程', kind: 'scheduler',
    problem: '系统中有 4 个进程，到达时间与所需运行时间如下：' +
      'P1 到达时刻 0，需运行 7；P2 到达时刻 2，需运行 4；P3 到达时刻 4，需运行 1；P4 到达时刻 5，需运行 4。' +
      '采用最短剩余时间优先（SRTF）调度算法，请画出甘特图。',
    reference: sched('SRTF', 1, [['P1', 0, 7], ['P2', 2, 4], ['P3', 4, 1], ['P4', 5, 4]]),
  },
  {
    cat: 'A', name: 'TCP Reno 双丢包', kind: 'tcp',
    problem: '某 TCP 连接采用 Reno 拥塞控制算法，初始拥塞窗口 cwnd = 1 MSS，慢启动门限 ssthresh = 16 MSS。' +
      '在第 8 个 RTT 收到三个重复 ACK，在第 13 个 RTT 发生超时。请模拟前 20 个 RTT 的拥塞窗口变化过程。',
    reference: tcp('Reno', 1, 16, 20, [[8, 'tripleDup'], [13, 'timeout']]),
  },
]

// ═══ B · 变体题（覆盖参数空间）══════════════════════════
const B: ExactCase[] = [
  {
    cat: 'B', name: 'Cache 直接映射', kind: 'cache',
    problem: '某 Cache 数据区容量 256B，主存块大小 16B，采用直接映射方式。' +
      'CPU 依次访问主存地址（十进制）：0、16、32、0、272、528、16。请分析命中情况。',
    reference: cache(256, 16, 1, 'LRU', [0, 16, 32, 0, 272, 528, 16]),
  },
  {
    cat: 'B', name: 'Cache FIFO 替换', kind: 'cache',
    problem: '某 Cache 数据区容量 128B，主存块大小 16B，2 路组相联，采用 FIFO 替换策略。' +
      'CPU 依次访问地址（十进制）：0、64、128、0、192。请分析命中情况。',
    reference: cache(128, 16, 2, 'FIFO', [0, 64, 128, 0, 192]),
  },
  {
    cat: 'B', name: 'Cache 8路组相联', kind: 'cache',
    problem: '某 Cache 数据区容量 1024B，主存块大小 16B，8 路组相联，LRU 替换。' +
      'CPU 依次访问地址（十进制）：0、128、256、384、0、128。请分析命中情况。',
    reference: cache(1024, 16, 8, 'LRU', [0, 128, 256, 384, 0, 128]),
  },
  {
    cat: 'B', name: '调度 FCFS', kind: 'scheduler',
    problem: '有 3 个进程：P1 到达时刻 0 需运行 5；P2 到达时刻 1 需运行 3；P3 到达时刻 2 需运行 4。' +
      '采用先来先服务（FCFS）调度算法，画出执行顺序。',
    reference: sched('FCFS', 1, [['P1', 0, 5], ['P2', 1, 3], ['P3', 2, 4]]),
  },
  {
    cat: 'B', name: '调度 SJF 非抢占', kind: 'scheduler',
    problem: '有 4 个进程，均在时刻 0 到达，所需运行时间分别为：P1 需 6、P2 需 8、P3 需 7、P4 需 3。' +
      '采用短作业优先（SJF，非抢占）调度算法，画出执行顺序。',
    reference: sched('SJF', 1, [['P1', 0, 6], ['P2', 0, 8], ['P3', 0, 7], ['P4', 0, 3]]),
  },
  {
    cat: 'B', name: '调度 RR 时间片=2', kind: 'scheduler',
    problem: '有 3 个进程：P1 到达时刻 0 需运行 5；P2 到达时刻 1 需运行 4；P3 到达时刻 2 需运行 3。' +
      '采用时间片轮转（RR）调度算法，时间片大小为 2，画出甘特图。',
    reference: sched('RR', 2, [['P1', 0, 5], ['P2', 1, 4], ['P3', 2, 3]]),
  },
  {
    cat: 'B', name: '调度 RR 时间片=4', kind: 'scheduler',
    problem: '有 3 个进程，均在时刻 0 到达：P1 需运行 10、P2 需运行 5、P3 需运行 8。' +
      '采用时间片轮转调度，时间片为 4，画出甘特图。',
    reference: sched('RR', 4, [['P1', 0, 10], ['P2', 0, 5], ['P3', 0, 8]]),
  },
  {
    cat: 'B', name: 'TCP Tahoe', kind: 'tcp',
    problem: '某 TCP 连接采用 Tahoe 算法，初始 cwnd = 1 MSS，ssthresh = 8 MSS。' +
      '在第 6 个 RTT 收到三个重复 ACK。请模拟前 12 个 RTT 的拥塞窗口变化。',
    reference: tcp('Tahoe', 1, 8, 12, [[6, 'tripleDup']]),
  },
  {
    cat: 'B', name: 'TCP 无丢包', kind: 'tcp',
    problem: '某 TCP 连接采用 Reno 算法，初始 cwnd = 1 MSS，ssthresh = 32 MSS，传输过程中没有发生任何丢包。' +
      '请模拟前 10 个 RTT 的拥塞窗口变化。',
    reference: tcp('Reno', 1, 32, 10, []),
  },
  {
    cat: 'B', name: 'TCP 三次丢包', kind: 'tcp',
    problem: '某 TCP 连接采用 Reno 算法，初始 cwnd = 2 MSS，ssthresh = 16 MSS。' +
      '第 5 个 RTT 超时，第 10 个 RTT 收到三个重复 ACK，第 16 个 RTT 再次超时。' +
      '请模拟前 22 个 RTT 的拥塞窗口变化。',
    reference: tcp('Reno', 2, 16, 22, [[5, 'timeout'], [10, 'tripleDup'], [16, 'timeout']]),
  },
]

// ═══ C · 表述变体（同一实验，换个说法）══════════════════
const C: ExactCase[] = [
  {
    cat: 'C', name: 'Cache 容量用 KB 表述', kind: 'cache',
    problem: '某 Cache 数据区容量 1KB，主存块大小 32B，4 路组相联，LRU 替换策略。' +
      'CPU 依次访问主存地址（十进制）：0、256、512、0、768。请分析命中情况。',
    reference: cache(1024, 32, 4, 'LRU', [0, 256, 512, 0, 768]),
  },
  {
    cat: 'C', name: 'Cache 给"组数×行数"而非容量', kind: 'cache',
    problem: '某 Cache 共分为 4 组，每组 4 行，每行大小 32B，采用 LRU 替换策略。' +
      'CPU 依次访问主存地址（十进制）：0、128、256、0、384。请分析命中情况。',
    reference: cache(512, 32, 4, 'LRU', [0, 128, 256, 0, 384]),
  },
  {
    cat: 'C', name: 'Cache 用"行大小"而非"块大小"', kind: 'cache',
    problem: '某 Cache 数据区容量 256B，Cache 行大小为 16B，采用 2 路组相联，最近最少使用替换算法。' +
      'CPU 访存地址序列（十进制）为：0、128、256、0、384。请分析命中情况。',
    reference: cache(256, 16, 2, 'LRU', [0, 128, 256, 0, 384]),
  },
  {
    cat: 'C', name: '调度用"服务时间"表述', kind: 'scheduler',
    problem: '下表给出各进程的提交时刻与服务时间：进程 A 提交时刻 0，服务时间 3；' +
      '进程 B 提交时刻 1，服务时间 6；进程 C 提交时刻 3，服务时间 2。' +
      '试用最短剩余时间优先算法给出调度过程。',
    reference: sched('SRTF', 1, [['A', 0, 3], ['B', 1, 6], ['C', 3, 2]]),
  },
  {
    cat: 'C', name: '调度用"CPU 区间"表述', kind: 'scheduler',
    problem: '三个作业 J1、J2、J3 分别在 0、2、4 时刻进入系统，CPU 区间长度依次为 8、4、2。' +
      '采用非抢占式短作业优先算法调度。',
    reference: sched('SJF', 1, [['J1', 0, 8], ['J2', 2, 4], ['J3', 4, 2]]),
  },
  {
    cat: 'C', name: 'TCP 用"门限值"与"往返时延"表述', kind: 'tcp',
    problem: '一条 TCP 连接使用 Reno 版本的拥塞控制，起始拥塞窗口为 1 个报文段，' +
      '慢开始门限值为 16 个报文段。在第 9 个往返时延时发生了超时重传。' +
      '请给出前 15 个往返时延内拥塞窗口的变化。',
    reference: tcp('Reno', 1, 16, 15, [[9, 'timeout']]),
  },
  {
    cat: 'C', name: 'TCP 用"冗余 ACK"表述', kind: 'tcp',
    problem: '某 TCP 采用 Reno 拥塞控制。初始拥塞窗口 1 MSS，慢启动阈值 8 MSS。' +
      '发送方在第 7 轮传输中连续收到 3 个冗余 ACK。请画出前 14 轮的 cwnd 变化曲线。',
    reference: tcp('Reno', 1, 8, 14, [[7, 'tripleDup']]),
  },
]

// ═══ D · 陷阱题 ════════════════════════════════════════
export const TRAPS: TrapCase[] = [
  {
    cat: 'D', name: 'Cache 容量不是 2 的幂', kind: 'cache', expectField: 'cacheSizeBytes',
    problem: '某 Cache 数据区容量 500B，主存块大小 32B，4 路组相联，LRU 替换。' +
      'CPU 依次访问地址 0、32、64。请分析命中情况。',
  },
  {
    cat: 'D', name: '相联度不是 2 的幂', kind: 'cache', expectField: 'associativity',
    problem: '某 Cache 数据区容量 512B，主存块大小 32B，采用 6 路组相联映射，LRU 替换。' +
      'CPU 依次访问地址 0、32、64。请分析命中情况。',
  },
  {
    cat: 'D', name: '块大小不是 2 的幂', kind: 'cache', expectField: 'blockSizeBytes',
    problem: '某 Cache 数据区容量 512B，主存块大小 20B，4 路组相联，LRU 替换。' +
      'CPU 依次访问地址 0、20、40。请分析命中情况。',
  },
  {
    cat: 'D', name: '丢包轮次超出模拟范围', kind: 'tcp', expectField: 'at',
    problem: '某 TCP 连接采用 Reno 算法，初始 cwnd=1，ssthresh=16。' +
      '在第 25 个 RTT 发生超时。请模拟前 10 个 RTT 的窗口变化。',
  },
  {
    cat: 'D', name: '进程运行时间为 0', kind: 'scheduler', expectField: 'burst',
    problem: '有 3 个进程：P1 到达时刻 0 需运行 5；P2 到达时刻 1 需运行 0；P3 到达时刻 2 需运行 4。' +
      '采用 FCFS 调度，画出甘特图。',
  },
  {
    cat: 'D', name: '进程到达时刻为负', kind: 'scheduler', expectField: 'at',
    problem: '有 2 个进程：P1 到达时刻 -3 需运行 5；P2 到达时刻 2 需运行 4。采用 FCFS 调度。',
  },
]

// ═══ E · 歧义题（只记录，不判对错）══════════════════════
export const AMBIGUOUS: AmbiguousCase[] = [
  {
    cat: 'E', name: 'Cache 没说替换策略', kind: 'cache',
    watch: ['params.replacement'],
    problem: '某 Cache 数据区容量 512B，主存块大小 32B，4 路组相联。' +
      'CPU 依次访问地址（十进制）：0、128、256、0。请分析命中情况。',
  },
  {
    cat: 'E', name: 'Cache 没给访问序列', kind: 'cache',
    watch: ['streams'],
    problem: '某 Cache 数据区容量 512B，主存块大小 32B，4 路组相联，LRU 替换策略。请分析其组织结构。',
  },
  {
    cat: 'E', name: '调度没说算法', kind: 'scheduler',
    watch: ['params.algorithm'],
    problem: '有 3 个进程：P1 到达时刻 0 需运行 5；P2 到达时刻 1 需运行 3；P3 到达时刻 2 需运行 4。请画出甘特图。',
  },
  {
    cat: 'E', name: 'TCP 没说模拟多少轮', kind: 'tcp',
    watch: ['params.rounds'],
    problem: '某 TCP 连接采用 Reno 算法，初始 cwnd = 1 MSS，ssthresh = 16 MSS，' +
      '在第 8 个 RTT 收到三个重复 ACK。请描述拥塞窗口的变化。',
  },
  {
    cat: 'E', name: 'TCP 没说 Reno 还是 Tahoe', kind: 'tcp',
    watch: ['params.variant'],
    problem: '某 TCP 连接初始 cwnd = 1 MSS，ssthresh = 16 MSS，在第 8 个 RTT 收到三个重复 ACK。' +
      '请模拟前 15 个 RTT 的拥塞窗口变化。',
  },
]

export const EXACT_CASES: ExactCase[] = [...A, ...B, ...C]
