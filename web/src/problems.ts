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

export const PROBLEMS: Problem[] = [
  ...cacheProblems, ...pageProblems, ...schedProblems, ...tcpProblems, ...diskProblems,
]

export const problemsFor = (experimentId: string) =>
  PROBLEMS.filter(p => p.experimentId === experimentId)
