/**
 * L2 组合级题库。
 *
 * 一半是对比题（该用 compare:*），一半是单实验题（该用单原语）。
 * **必须混着考** —— 只给对比题的话，模型全选 compare 也能满分，
 * 测不出它到底会不会判断。
 */
import type { SimDocument } from '../src/core/document.ts'

export type L2Case = {
  shape: '对比' | '单个'
  name: string
  expectKind: string
  problem: string
  reference: SimDocument
}

// ═══ 该用 compare 的 ═══════════════════════════════════
const COMPARE: L2Case[] = [
  {
    shape: '对比', name: 'Cache LRU vs FIFO', expectKind: 'compare:cache',
    problem: '某 Cache 数据区容量 128B，主存块大小 16B，2 路组相联。' +
      'CPU 依次访问主存地址（十进制）：0、64、0、128、64。' +
      '分别采用 LRU 和 FIFO 替换策略，比较两者的命中情况。',
    reference: {
      kind: 'compare:cache',
      params: {
        addressBits: 32, cacheSizeBytes: 128, blockSizeBytes: 16,
        associativity: 2, replacement: 'LRU', varyParam: 'replacement',
      },
      entities: [],
      streams: [
        { name: 'accessSequence', values: [0, 64, 0, 128, 64] },
        { name: 'variants', values: ['LRU', 'FIFO'] },
      ],
    },
  },
  {
    shape: '对比', name: 'Cache 直接映射 vs 4路组相联', expectKind: 'compare:cache',
    problem: '某 Cache 数据区容量 512B，主存块大小 32B，LRU 替换策略。' +
      'CPU 依次访问地址（十进制）：0、128、256、0、384、128。' +
      '试比较采用直接映射与 4 路组相联两种方式下的命中情况。',
    reference: {
      kind: 'compare:cache',
      params: {
        addressBits: 32, cacheSizeBytes: 512, blockSizeBytes: 32,
        associativity: 1, replacement: 'LRU', varyParam: 'associativity',
      },
      entities: [],
      streams: [
        { name: 'accessSequence', values: [0, 128, 256, 0, 384, 128] },
        { name: 'variants', values: [1, 4] },
      ],
    },
  },
  {
    shape: '对比', name: 'TCP Reno vs Tahoe', expectKind: 'compare:tcp',
    problem: '某 TCP 连接初始 cwnd = 1 MSS，ssthresh = 16 MSS，在第 6 个 RTT 收到三个重复 ACK。' +
      '请对比 Reno 与 Tahoe 两种算法在前 12 个 RTT 的拥塞窗口变化差异。',
    reference: {
      kind: 'compare:tcp',
      params: { variant: 'Reno', initialCwnd: 1, initialSsthresh: 16, rounds: 12, varyParam: 'variant' },
      entities: [{ id: 'L1', type: 'loss', at: 6, attrs: { type: 'tripleDup' } }],
      streams: [{ name: 'variants', values: ['Reno', 'Tahoe'] }],
    },
  },
  {
    shape: '对比', name: '调度 FCFS vs SJF', expectKind: 'compare:scheduler',
    problem: '有 4 个进程：P1 到达 0 需运行 8；P2 到达 1 需运行 4；' +
      'P3 到达 2 需运行 9；P4 到达 3 需运行 5。' +
      '分别采用先来先服务和短作业优先两种调度算法，比较执行顺序。',
    reference: {
      kind: 'compare:scheduler',
      params: { algorithm: 'FCFS', quantum: 1, varyParam: 'algorithm' },
      entities: [
        { id: 'P1', type: 'process', at: 0, attrs: { burst: 8 } },
        { id: 'P2', type: 'process', at: 1, attrs: { burst: 4 } },
        { id: 'P3', type: 'process', at: 2, attrs: { burst: 9 } },
        { id: 'P4', type: 'process', at: 3, attrs: { burst: 5 } },
      ],
      streams: [{ name: 'variants', values: ['FCFS', 'SJF'] }],
    },
  },
  {
    shape: '对比', name: 'Cache 块大小 16B vs 32B', expectKind: 'compare:cache',
    problem: '某 Cache 数据区容量 512B，4 路组相联，LRU 替换。' +
      'CPU 依次访问地址（十进制）：0、16、32、48、0、16。' +
      '试比较主存块大小分别为 16B 和 32B 时的命中情况。',
    reference: {
      kind: 'compare:cache',
      params: {
        addressBits: 32, cacheSizeBytes: 512, blockSizeBytes: 16,
        associativity: 4, replacement: 'LRU', varyParam: 'blockSizeBytes',
      },
      entities: [],
      streams: [
        { name: 'accessSequence', values: [0, 16, 32, 48, 0, 16] },
        { name: 'variants', values: [16, 32] },
      ],
    },
  },
  {
    shape: '对比', name: '调度 RR 时间片 2 vs 4', expectKind: 'compare:scheduler',
    problem: '有 3 个进程，均在时刻 0 到达：P1 需运行 8、P2 需运行 4、P3 需运行 6。' +
      '采用时间片轮转调度，试比较时间片取 2 和取 4 时的甘特图差异。',
    reference: {
      kind: 'compare:scheduler',
      params: { algorithm: 'RR', quantum: 2, varyParam: 'quantum' },
      entities: [
        { id: 'P1', type: 'process', at: 0, attrs: { burst: 8 } },
        { id: 'P2', type: 'process', at: 0, attrs: { burst: 4 } },
        { id: 'P3', type: 'process', at: 0, attrs: { burst: 6 } },
      ],
      streams: [{ name: 'variants', values: [2, 4] }],
    },
  },
]

// ═══ 该用单原语的（掺进来防蒙）═════════════════════════
const SINGLE: L2Case[] = [
  {
    shape: '单个', name: 'Cache 单配置 4路 LRU', expectKind: 'cache',
    problem: '某计算机主存按字节编址，Cache 数据区容量 512B，主存块大小 32B，' +
      '采用 4 路组相联映射，LRU 替换策略。CPU 按顺序访问地址（十六进制）：' +
      '0x00、0x20、0x40、0x60、0x80、0x00、0x20。请给出每次访问的命中情况。',
    reference: {
      kind: 'cache',
      params: { addressBits: 32, cacheSizeBytes: 512, blockSizeBytes: 32, associativity: 4, replacement: 'LRU' },
      entities: [],
      streams: [{ name: 'accessSequence', values: [0x00, 0x20, 0x40, 0x60, 0x80, 0x00, 0x20] }],
    },
  },
  {
    shape: '单个', name: '调度单算法 SRTF', expectKind: 'scheduler',
    problem: '系统中有 4 个进程：P1 到达 0 需运行 7；P2 到达 2 需运行 4；' +
      'P3 到达 4 需运行 1；P4 到达 5 需运行 4。' +
      '采用最短剩余时间优先（SRTF）调度算法，请画出甘特图。',
    reference: {
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
  },
  {
    shape: '单个', name: 'TCP 单算法 Reno 双丢包', expectKind: 'tcp',
    problem: '某 TCP 连接采用 Reno 拥塞控制算法，初始 cwnd = 1 MSS，ssthresh = 16 MSS。' +
      '在第 8 个 RTT 收到三个重复 ACK，在第 13 个 RTT 发生超时。' +
      '请模拟前 20 个 RTT 的拥塞窗口变化过程。',
    reference: {
      kind: 'tcp',
      params: { variant: 'Reno', initialCwnd: 1, initialSsthresh: 16, rounds: 20 },
      entities: [
        { id: 'L1', type: 'loss', at: 8, attrs: { type: 'tripleDup' } },
        { id: 'L2', type: 'loss', at: 13, attrs: { type: 'timeout' } },
      ],
      streams: [],
    },
  },
  {
    shape: '单个', name: 'Cache 单配置 直接映射', expectKind: 'cache',
    problem: '某 Cache 数据区容量 256B，主存块大小 16B，采用直接映射方式。' +
      'CPU 依次访问主存地址（十进制）：0、16、32、0、272、528、16。请分析命中情况。',
    reference: {
      kind: 'cache',
      params: { addressBits: 32, cacheSizeBytes: 256, blockSizeBytes: 16, associativity: 1, replacement: 'LRU' },
      entities: [],
      streams: [{ name: 'accessSequence', values: [0, 16, 32, 0, 272, 528, 16] }],
    },
  },
  {
    shape: '单个', name: '调度单算法 RR', expectKind: 'scheduler',
    problem: '有 3 个进程：P1 到达 0 需运行 5；P2 到达 1 需运行 4；P3 到达 2 需运行 3。' +
      '采用时间片轮转（RR）调度算法，时间片大小为 2，画出甘特图。',
    reference: {
      kind: 'scheduler',
      params: { algorithm: 'RR', quantum: 2 },
      entities: [
        { id: 'P1', type: 'process', at: 0, attrs: { burst: 5 } },
        { id: 'P2', type: 'process', at: 1, attrs: { burst: 4 } },
        { id: 'P3', type: 'process', at: 2, attrs: { burst: 3 } },
      ],
      streams: [],
    },
  },
  {
    shape: '单个', name: 'TCP 单算法 Tahoe', expectKind: 'tcp',
    problem: '某 TCP 连接采用 Tahoe 算法，初始 cwnd = 1 MSS，ssthresh = 8 MSS。' +
      '在第 6 个 RTT 收到三个重复 ACK。请模拟前 12 个 RTT 的拥塞窗口变化。',
    reference: {
      kind: 'tcp',
      params: { variant: 'Tahoe', initialCwnd: 1, initialSsthresh: 8, rounds: 12 },
      entities: [{ id: 'L1', type: 'loss', at: 6, attrs: { type: 'tripleDup' } }],
      streams: [],
    },
  },
]

export const L2_CASES: L2Case[] = [...COMPARE, ...SINGLE]
