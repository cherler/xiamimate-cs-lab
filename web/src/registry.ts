/**
 * 实验注册表。
 *
 * 加一个新实验 = 往这里加一条，宿主框架（布局/轴/日志/参数/读数）一行不用改。
 * 这是"渲染层可替换"（接缝 5）的落点。
 */
import { cacheKernel, type CacheState } from '@engine/kernels/cache.ts'
import { schedKernel, type SchedState } from '@engine/kernels/scheduler.ts'
import { tcpKernel, type TcpState } from '@engine/kernels/tcp.ts'
import { pageKernel, type PageState } from '@engine/kernels/page.ts'
import { diskKernel, type DiskState } from '@engine/kernels/disk.ts'
import { sortKernel, type SortState } from '@engine/kernels/sort.ts'
import { dijkstraKernel, type DijkstraState } from '@engine/kernels/dijkstra.ts'
import { bankerKernel, type BankerState } from '@engine/kernels/banker.ts'
import { arqKernel, type ArqState } from '@engine/kernels/arq.ts'
import { SortStage } from './stages/SortStage.tsx'
import { DijkstraStage } from './stages/DijkstraStage.tsx'
import { BankerStage } from './stages/BankerStage.tsx'
import { ArqStage } from './stages/ArqStage.tsx'
import { CacheStage } from './stages/CacheStage.tsx'
import { SchedulerStage } from './stages/SchedulerStage.tsx'
import { TcpStage } from './stages/TcpStage.tsx'
import { PageStage } from './stages/PageStage.tsx'
import { DiskStage } from './stages/DiskStage.tsx'
import {
  CACHE_PRESETS, PAGE_PRESETS, DISK_PRESETS, SORT_PRESETS,
} from '@engine/presets/sequences.ts'
import {
  SCHED_PRESETS, DIJKSTRA_PRESETS, BANKER_PRESETS, TCP_PRESETS, ARQ_PRESETS, NODES,
  PIPE_PRESETS, VM_PRESETS,
} from '@engine/presets/entities.ts'
import {
  VM_PRESETS_SEQ, FLOAT_PRESETS, MUL_PRESETS,
  CRC_PRESETS, HAMMING_PRESETS, SUBNET_PRESETS,
} from '@engine/presets/sequences.ts'
import { ROUTE_PRESETS, HS_PRESETS } from '@engine/presets/entities.ts'
import {
  AVL_PRESETS, HASH_PRESETS, HUFF_PRESETS,
} from '@engine/presets/sequences.ts'
import { avlKernel, type AvlState } from '@engine/kernels/avl.ts'
import { hashKernel, asl, type HashState } from '@engine/kernels/hashtable.ts'
import { huffmanKernel, type HuffState } from '@engine/kernels/huffman.ts'
import { kmpKernel, type KmpState } from '@engine/kernels/kmp.ts'
import { trueHeight } from '@engine/core/tree.ts'
import { AvlStage } from './stages/AvlStage.tsx'
import { HashStage } from './stages/HashStage.tsx'
import { HuffmanStage } from './stages/HuffmanStage.tsx'
import { KmpStage } from './stages/KmpStage.tsx'
import { crcKernel, type CrcState } from '@engine/kernels/crc.ts'
import { hammingKernel, type HammingState } from '@engine/kernels/hamming.ts'
import { subnetKernel, type SubnetState } from '@engine/kernels/subnet.ts'
import { handshakeKernel, type HsState } from '@engine/kernels/handshake.ts'
import { CrcStage } from './stages/CrcStage.tsx'
import { HammingStage } from './stages/HammingStage.tsx'
import { SubnetStage } from './stages/SubnetStage.tsx'
import { HandshakeStage } from './stages/HandshakeStage.tsx'
import { floatKernel, type FloatState } from '@engine/kernels/float.ts'
import { pipelineKernel, type PipeState } from '@engine/kernels/pipeline.ts'
import { vmKernel, type VmState } from '@engine/kernels/vm.ts'
import { multiplyKernel, type MulState } from '@engine/kernels/multiply.ts'
import { FloatStage } from './stages/FloatStage.tsx'
import { PipelineStage } from './stages/PipelineStage.tsx'
import { VmStage } from './stages/VmStage.tsx'
import { MultiplyStage } from './stages/MultiplyStage.tsx'
import type { AnyExperiment, Experiment } from './types.ts'

const pct = (n: number) => (n * 100).toFixed(1) + '%'
const hex = (n: number) => '0x' + n.toString(16).toUpperCase()

// ═══ Cache ═════════════════════════════════════════════
const cache: Experiment<CacheState> = {
  id: 'cache',
  group: '计算机组成原理',
  title: 'Cache 命中率',
  subtitle: '组相联映射 · 替换策略',
  kernel: cacheKernel,
  defaultDoc: {
    kind: 'cache',
    params: { addressBits: 32, cacheSizeBytes: 256, blockSizeBytes: 16, associativity: 2, replacement: 'LRU' },
    entities: [],
    streams: [{ name: 'accessSequence', values:
      [0x000, 0x010, 0x020, 0x000, 0x110, 0x210, 0x010, 0x020, 0x110, 0x000, 0x030, 0x210] }],
  },
  params: [
    { key: 'cacheSizeBytes', label: 'Cache 容量', kind: 'number', options: [128, 256, 512, 1024], unit: 'B' },
    { key: 'blockSizeBytes', label: '块大小', kind: 'number', options: [8, 16, 32, 64], unit: 'B' },
    { key: 'associativity', label: '相联度', kind: 'number', options: [1, 2, 4, 8], unit: '路' },
    { key: 'replacement', label: '替换策略', kind: 'enum', options: ['LRU', 'FIFO'] },
  ],
  sequence: {
    stream: 'accessSequence',
    label: '访问序列',
    radix: 16,
    hint: '按字节编址的主存地址',
    maxLength: 40,
    presets: CACHE_PRESETS,
    random: () => Array.from({ length: 12 }, () => Math.floor(Math.random() * 16) * 16),
  },
  bounds: [
    '本仿真不含 TLB，地址即物理地址',
    '假设指令与数据共用同一 Cache',
    '忽略预取与写分配，每次访问只查一次',
    '多级 Cache、一致性协议不在本实验范围内',
  ],
  tabs: [{ id: 'org', label: '地址拆解 + 组织' }, { id: 'sweep', label: '命中率随相联度' }],
  Stage: CacheStage,
  tone: s => (s.outcome === 'hit' ? { key: 'good', label: '命中' } : { key: 'bad', label: '缺失' }),
  metric: s => s.hits / (s.i + 1),
  tickLabel: (s, i) => `第 ${i + 1} 次 ${hex(s.address)} · ${s.outcome === 'hit' ? '命中' : '缺失'}`,
  readouts: (s) => [
    { label: '命中', value: String(s.hits), tone: 'good' },
    { label: '缺失', value: String(s.misses), tone: 'bad' },
    { label: '命中率', value: pct(s.hits / (s.i + 1)) },
    { label: 'tag', value: hex(s.tag) },
    { label: '组号', value: String(s.setIndex) },
    { label: '块内偏移', value: String(s.offset) },
    { label: '本步结果', value: s.outcome === 'hit' ? '命中' : '缺失', tone: s.outcome === 'hit' ? 'good' : 'bad' },
    { label: '被挤掉', value: s.evictedTag === null ? '—' : hex(s.evictedTag), tone: s.evictedTag === null ? undefined : 'bad' },
  ],
}

// ═══ 进程调度 ═══════════════════════════════════════════
const scheduler: Experiment<SchedState> = {
  id: 'scheduler',
  group: '操作系统',
  title: '进程调度甘特图',
  subtitle: '抢占与非抢占 · 时间片',
  kernel: schedKernel,
  defaultDoc: {
    kind: 'scheduler',
    params: { algorithm: 'SRTF', quantum: 2 },
    entities: [
      { id: 'P1', type: 'process', at: 0, attrs: { burst: 7 } },
      { id: 'P2', type: 'process', at: 2, attrs: { burst: 4 } },
      { id: 'P3', type: 'process', at: 4, attrs: { burst: 1 } },
      { id: 'P4', type: 'process', at: 5, attrs: { burst: 4 } },
    ],
    streams: [],
  },
  params: [
    { key: 'algorithm', label: '调度算法', kind: 'enum', options: ['FCFS', 'SJF', 'SRTF', 'RR'] },
    { key: 'quantum', label: '时间片', kind: 'number', options: [1, 2, 3, 4], unit: '仅 RR 用' },
  ],
  entitySpec: {
    tables: [{
      type: 'process',
      label: '进程表',
      columns: () => [
        { key: 'id', label: '进程', kind: 'text', width: 62 },
        { key: 'at', label: '到达时刻', kind: 'number', width: 84 },
        { key: 'burst', label: '服务时间', kind: 'number', width: 84 },
      ],
      newRow: i => ({ id: `P${i + 1}`, type: 'process', at: 0, attrs: { burst: 3 } }),
      minRows: 1, maxRows: 8,
    }],
    presets: SCHED_PRESETS,
  },
  bounds: [
    '单 CPU、单核，不考虑多处理器',
    '忽略上下文切换开销与 I/O 阻塞',
    '进程一旦到达就绪即可被调度，无优先级老化',
    'SJF / SRTF 假设运行时间已知（现实中需要预测）',
  ],
  tabs: [{ id: 'gantt', label: '甘特图' }, { id: 'queue', label: '队列状态' }],
  Stage: SchedulerStage,
  tone: s => (s.running === null ? { key: 'idle', label: '空闲' } : { key: 'good', label: '运行' }),
  metric: (s, _i) => {
    const total = Object.keys(s.remaining).length
    return total === 0 ? 0 : s.completed.length / total
  },
  tickLabel: s => `t=${s.t} ${s.running ?? '空闲'}`,
  readouts: (s, doc) => {
    const total = doc.entities.filter(e => e.type === 'process').length
    return [
      { label: '当前时刻', value: `t = ${s.t}` },
      { label: '正在运行', value: s.running ?? '空闲', tone: s.running ? 'good' : undefined },
      { label: '就绪队列', value: s.readyQueue.length ? s.readyQueue.join(' → ') : '空' },
      { label: '已完成', value: `${s.completed.length} / ${total}` },
      { label: '剩余时间', value: Object.entries(s.remaining).filter(([, v]) => v > 0)
          .map(([k, v]) => `${k}:${v}`).join('  ') || '全部完成' },
    ]
  },
}

// ═══ TCP ═══════════════════════════════════════════════
const tcp: Experiment<TcpState> = {
  id: 'tcp',
  group: '计算机网络',
  title: 'TCP 拥塞窗口',
  subtitle: '慢启动 · 拥塞避免 · 快恢复',
  kernel: tcpKernel,
  defaultDoc: {
    kind: 'tcp',
    params: { variant: 'Reno', initialCwnd: 1, initialSsthresh: 16, rounds: 20 },
    entities: [
      { id: 'L1', type: 'loss', at: 8, attrs: { type: 'tripleDup' } },
      { id: 'L2', type: 'loss', at: 13, attrs: { type: 'timeout' } },
    ],
    streams: [],
  },
  params: [
    { key: 'variant', label: '算法版本', kind: 'enum', options: ['Reno', 'Tahoe'] },
    { key: 'initialSsthresh', label: '慢启动门限', kind: 'number', options: [4, 8, 16, 32], unit: 'MSS' },
    { key: 'initialCwnd', label: '初始窗口', kind: 'number', options: [1, 2, 4], unit: 'MSS' },
    { key: 'rounds', label: '模拟轮数', kind: 'number', options: [12, 20, 30], unit: 'RTT' },
  ],
  entitySpec: {
    tables: [{
      type: 'loss',
      label: '丢包事件',
      columns: () => [
        { key: 'id', label: '编号', kind: 'text', width: 58 },
        { key: 'at', label: '第几轮', kind: 'number', width: 74 },
        { key: 'type', label: '事件类型', kind: 'enum',
          options: ['timeout', 'tripleDup'], labels: ['超时', '三次重复 ACK'], width: 116 },
      ],
      newRow: i => ({ id: `L${i + 1}`, type: 'loss', at: 5, attrs: { type: 'timeout' } }),
      minRows: 0, maxRows: 6,
    }],
    presets: TCP_PRESETS,
  },
  bounds: [
    '只建模拥塞控制，不含流量控制（接收窗口）',
    '假设 RTT 恒定，每轮恰好发送一个窗口',
    '丢包事件由题目给定，不做随机丢包建模',
    '未建模 SACK、时间戳选项与延迟确认',
  ],
  tabs: [{ id: 'curve', label: '窗口曲线' }, { id: 'phase', label: '状态机' }],
  Stage: TcpStage,
  tone: s => (s.event === 'none'
    ? { key: 'idle', label: '正常' }
    : { key: 'bad', label: s.event === 'timeout' ? '超时' : '重复ACK' }),
  metric: s => {
    const cap = Math.max(s.ssthresh * 2, 8)
    return Math.min(1, s.cwnd / cap)
  },
  tickLabel: s => `第 ${s.round} 轮 cwnd=${s.cwnd}`,
  readouts: s => [
    { label: '轮次', value: `${s.round} RTT` },
    { label: 'cwnd', value: `${s.cwnd} MSS` },
    { label: 'ssthresh', value: `${s.ssthresh} MSS` },
    { label: '所处阶段', value: { slowStart: '慢启动', congestionAvoidance: '拥塞避免', fastRecovery: '快恢复' }[s.phase] },
    { label: '本轮事件', value: s.event === 'none' ? '无' : s.event === 'timeout' ? '超时' : '三次重复 ACK',
      tone: s.event === 'none' ? undefined : 'bad' },
  ],
}

// ═══ 页面置换 ═══════════════════════════════════════════
const page: Experiment<PageState> = {
  id: 'page',
  group: '操作系统',
  title: '页面置换',
  subtitle: 'FIFO · LRU · OPT · CLOCK',
  kernel: pageKernel,
  defaultDoc: {
    kind: 'page',
    params: { algorithm: 'FIFO', frames: 3 },
    entities: [],
    streams: [{ name: 'referenceString', values: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5] }],
  },
  params: [
    { key: 'algorithm', label: '置换算法', kind: 'enum', options: ['FIFO', 'LRU', 'OPT', 'CLOCK'] },
    { key: 'frames', label: '物理块数', kind: 'number', options: [2, 3, 4, 5], unit: '块' },
  ],
  sequence: {
    stream: 'referenceString',
    label: '页面引用串',
    hint: '页号序列',
    maxLength: 40,
    presets: PAGE_PRESETS,
    random: () => Array.from({ length: 14 }, () => 1 + Math.floor(Math.random() * 6)),
  },
  bounds: [
    '只建模页面置换，不含 TLB 与多级页表',
    '所有页面大小相同，不考虑大页',
    '不区分读/写，无脏位与写回开销',
    'OPT 需要预知未来引用串，现实中不可实现，仅作为理论下界',
  ],
  tabs: [{ id: 'table', label: '置换表' }, { id: 'frames', label: '物理块' }],
  Stage: PageStage,
  tone: s => (s.outcome === 'hit' ? { key: 'good', label: '命中' } : { key: 'bad', label: '缺页' }),
  metric: s => s.hits / (s.i + 1),
  tickLabel: (s, i) => `第 ${i + 1} 次 访问页 ${s.page} · ${s.outcome === 'hit' ? '命中' : '缺页'}`,
  readouts: s => [
    { label: '缺页次数', value: String(s.faults), tone: 'bad' },
    { label: '命中次数', value: String(s.hits), tone: 'good' },
    { label: '缺页率', value: pct(s.faults / (s.i + 1)) },
    { label: '本步访问页', value: String(s.page) },
    { label: '本步结果', value: s.outcome === 'hit' ? '命中' : '缺页', tone: s.outcome === 'hit' ? 'good' : 'bad' },
    { label: '换出页', value: s.evictedPage === null ? '—' : String(s.evictedPage),
      tone: s.evictedPage === null ? undefined : 'bad' },
  ],
}

// ═══ 磁盘调度 ═══════════════════════════════════════════
const disk: Experiment<DiskState> = {
  id: 'disk',
  group: '操作系统',
  title: '磁盘调度',
  subtitle: '寻道算法与磁头轨迹',
  kernel: diskKernel,
  defaultDoc: {
    kind: 'disk',
    params: { algorithm: 'SSTF', headStart: 53, maxTrack: 199, direction: 1 },
    entities: [],
    streams: [{ name: 'requests', values: [98, 183, 37, 122, 14, 124, 65, 67] }],
  },
  params: [
    { key: 'algorithm', label: '调度算法', kind: 'enum', options: ['FCFS', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK'] },
    { key: 'headStart', label: '磁头初始位置', kind: 'number', options: [0, 53, 100, 150], unit: '号磁道' },
    { key: 'direction', label: '初始方向', kind: 'number', options: [1, -1], unit: '1↑ / -1↓' },
  ],
  sequence: {
    stream: 'requests',
    label: '请求队列',
    hint: '磁道号，须在 0..最大磁道 之间',
    maxLength: 20,
    presets: DISK_PRESETS,
    random: () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 200)),
  },
  bounds: [
    '只计寻道距离，不含旋转延迟与传输时间',
    '假设请求队列在调度开始时已全部到达，中途不新增',
    '不考虑磁头加速/减速，移动一个磁道计一个单位',
    'FCFS 与 SSTF 无方向概念，"初始方向"只对 SCAN 系生效',
  ],
  tabs: [{ id: 'path', label: '磁头轨迹' }, { id: 'queue', label: '本步状态' }],
  Stage: DiskStage,
  tone: s => (s.sweep ? { key: 'bad', label: '空跑' } : { key: 'good', label: '服务' }),
  metric: (s, _i) => {
    const cap = Math.max(1, s.total)
    return Math.min(1, s.moved / Math.max(cap / 3, 1))
  },
  tickLabel: s => `第 ${s.i + 1} 个：${s.from} → ${s.head}，移动 ${s.moved}`,
  readouts: s => [
    { label: '磁头位置', value: String(s.head) },
    { label: '本步移动', value: `${s.from} → ${s.head}` },
    { label: '本步距离', value: String(s.moved), tone: s.sweep ? 'bad' : undefined },
    { label: '累计寻道', value: String(s.total) },
    { label: '扫描方向', value: s.dir === 0 ? '不适用' : s.dir > 0 ? '↑ 向大磁道' : '↓ 向小磁道' },
    { label: '剩余请求', value: s.pending.length ? String(s.pending.length) + ' 个' : '全部完成' },
  ],
}

// ═══ 排序逐趟 ═══════════════════════════════════════════
const sort: Experiment<SortState> = {
  id: 'sort',
  group: '数据结构',
  title: '排序逐趟',
  subtitle: '七种算法 · 每一趟都摊开',
  kernel: sortKernel,
  defaultDoc: {
    kind: 'sort',
    params: { algorithm: '快速' },
    entities: [],
    streams: [{ name: 'array', values: [49, 38, 65, 97, 76, 13, 27, 49] }],
  },
  params: [
    { key: 'algorithm', label: '排序算法', kind: 'enum',
      options: ['直接插入', '希尔', '冒泡', '简单选择', '快速', '堆', '归并'] },
  ],
  sequence: {
    stream: 'array',
    label: '待排序数组',
    hint: '整数，2~24 个',
    maxLength: 24,
    presets: SORT_PRESETS,
    random: () => Array.from({ length: 8 }, () => 1 + Math.floor(Math.random() * 99)),
  },
  bounds: [
    '快排取区间第一个元素作基准（挖坑法）；换基准选法结果会不同',
    '希尔用 n/2 逐次减半的增量序列；换增量序列趟数与结果都会变',
    '归并为自底向上的二路归并，与递归写法的中间态不同、末态相同',
    '只统计比较与移动次数，不建模缓存局部性等实际性能因素',
  ],
  tabs: [{ id: 'array', label: '数组状态' }, { id: 'passes', label: '逐趟结果' }],
  Stage: SortStage,
  tone: s => (s.passEnd
    ? { key: 'good', label: '一趟结束' }
    : s.changed.length ? { key: 'bad', label: '移动' } : { key: 'idle', label: '比较' }),
  //  轴上的量：已定最终位置的比例 —— 这才是"排序进度"的诚实度量
  metric: s => (s.arr.length ? s.settled.length / s.arr.length : 0),
  tickLabel: s => `第 ${s.pass || '-'} 趟 · ${s.passEnd ? '趟末' : `比较${s.comparisons}`}`,
  readouts: s => [
    { label: '当前趟次', value: s.pass ? `第 ${s.pass} 趟` : '—' },
    { label: '比较次数', value: String(s.comparisons) },
    { label: '移动次数', value: String(s.moves) },
    { label: '已定位', value: `${s.settled.length} / ${s.arr.length}` },
    { label: '局部有序', value: s.sorted.length ? `${s.sorted.length} 个下标` : '—' },
    { label: '手持值', value: s.held === null ? '—' : String(s.held) },
  ],
}

// ═══ Dijkstra ═════════════════════════════════════════
const dijkstra: Experiment<DijkstraState> = {
  id: 'dijkstra',
  group: '数据结构',
  title: 'Dijkstra 最短路',
  subtitle: '逐步松弛 · 最短路径树',
  kernel: dijkstraKernel,
  defaultDoc: {
    kind: 'dijkstra',
    params: { source: 'A', directed: 0 },
    entities: [
      ...NODES,
      ...([
        ['A', 'B', 4], ['A', 'C', 6], ['A', 'D', 6],
        ['B', 'C', 1], ['B', 'E', 7],
        ['C', 'D', 2], ['C', 'E', 6], ['C', 'F', 4],
        ['D', 'F', 5], ['E', 'F', 1], ['E', 'G', 6], ['F', 'G', 8],
      ] as [string, string, number][]).map(([from, to, w]) => ({
        id: `${from}${to}`, type: 'edge', attrs: { from, to, w },
      })),
    ],
    streams: [],
  },
  params: [
    { key: 'source', label: '源点', kind: 'enum', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
    { key: 'directed', label: '图的类型', kind: 'number', options: [0, 1], unit: '0 无向 / 1 有向' },
  ],
  entitySpec: {
    tables: [{
      type: 'edge',
      label: '边表',
      //  只开放边（端点 + 权）。顶点固定 A–G：顶点坐标是布局信息，
      //  让学生填 x/y 既没有教学价值，也容易把图画乱。
      columns: doc => {
        const ids = doc.entities.filter(e => e.type === 'node').map(e => e.id)
        return [
          { key: 'from', label: '起点', kind: 'enum', options: ids, width: 64 },
          { key: 'to', label: '终点', kind: 'enum', options: ids, width: 64 },
          { key: 'w', label: '权值', kind: 'number', width: 70 },
        ]
      },
      newRow: (i, doc) => {
        const ids = doc.entities.filter(e => e.type === 'node').map(e => e.id)
        return { id: `E${i + 1}`, type: 'edge', attrs: { from: ids[0], to: ids[1] ?? ids[0], w: 1 } }
      },
      minRows: 1, maxRows: 16, chunk: 6,
    }],
    presets: DIJKSTRA_PRESETS,
  },
  bounds: [
    'Dijkstra 要求边权非负；含负权边请改用 Bellman-Ford',
    '顶点固定为 A–G（坐标是布局信息，不开放编辑）；可增删的是边',
    '每轮选点为线性扫描（O(V²)），不是堆优化版；结果相同，步数展示不同',
    '同距离时按顶点名字典序选点 —— 教材若约定别的顺序，中间过程会不同、最短距离相同',
    '不处理重边与自环',
  ],
  tabs: [{ id: 'graph', label: '图' }, { id: 'table', label: '逐轮距离表' }],
  Stage: DijkstraStage,
  tone: s => (s.act === 'pick'
    ? { key: 'good', label: '确定' }
    : s.improved ? { key: 'bad', label: '更新' } : { key: 'idle', label: '不更新' }),
  metric: s => {
    const n = Object.keys(s.dist).length
    return n ? s.settled.length / n : 0
  },
  tickLabel: s => (s.act === 'pick' ? `确定 ${s.at}` : s.act === 'done' ? '结束' : `${s.at}→${s.to}`),
  readouts: (s, doc) => {
    const n = doc.entities.filter(e => e.type === 'node').length
    return [
      { label: '已确定', value: `${s.settled.length} / ${n}` },
      { label: '确定顺序', value: s.settled.join(' → ') || '—' },
      { label: '本步动作', value: { pick: '选点', relax: '松弛', skip: '跳过', done: '结束' }[s.act] },
      { label: '涉及边', value: s.to ? `${s.at} → ${s.to}` : s.at || '—' },
      { label: '是否更新', value: s.improved ? '是' : '否', tone: s.improved ? 'bad' : undefined },
      { label: '当前距离', value: Object.entries(s.dist)
          .map(([k, v]) => `${k}:${v === Infinity ? '∞' : v}`).join('  ') },
    ]
  },
}

// ═══ 银行家算法 ═════════════════════════════════════════
const banker: Experiment<BankerState> = {
  id: 'banker',
  group: '操作系统',
  title: '银行家算法',
  subtitle: '安全序列推演 · 死锁避免',
  kernel: bankerKernel,
  defaultDoc: {
    kind: 'banker',
    params: { resources: 'A,B,C' },
    entities: [
      { id: 'A', type: 'resource', attrs: { total: 10 } },
      { id: 'B', type: 'resource', attrs: { total: 5 } },
      { id: 'C', type: 'resource', attrs: { total: 7 } },
      { id: 'P0', type: 'process', attrs: { max_A: 7, max_B: 5, max_C: 3, alloc_A: 0, alloc_B: 1, alloc_C: 0 } },
      { id: 'P1', type: 'process', attrs: { max_A: 3, max_B: 2, max_C: 2, alloc_A: 2, alloc_B: 0, alloc_C: 0 } },
      { id: 'P2', type: 'process', attrs: { max_A: 9, max_B: 0, max_C: 2, alloc_A: 3, alloc_B: 0, alloc_C: 2 } },
      { id: 'P3', type: 'process', attrs: { max_A: 2, max_B: 2, max_C: 2, alloc_A: 2, alloc_B: 1, alloc_C: 1 } },
      { id: 'P4', type: 'process', attrs: { max_A: 4, max_B: 3, max_C: 3, alloc_A: 0, alloc_B: 0, alloc_C: 2 } },
    ],
    streams: [],
  },
  //  这个实验的自由度在实体（各进程的 Max/Allocation），不在标量参数，
  //  所以参数面板故意留空 —— 不为了凑一栏而造假参数。
  params: [],
  paramsNote: '本实验的自由度在下面的资源矩阵里（各资源总量、各进程的 Max / Allocation），'
    + '不是标量参数，所以这里没有可调项。',
  entitySpec: {
    tables: [
      {
        type: 'resource',
        label: '资源总量',
        hint: '资源类别由参数 resources 决定，不在这里增删',
        columns: () => [
          { key: 'id', label: '资源', kind: 'text', width: 58 },
          { key: 'total', label: '系统总量', kind: 'number', width: 84 },
        ],
        newRow: i => ({ id: String.fromCharCode(65 + i), type: 'resource', attrs: { total: 1 } }),
        fixedRows: true,
      },
      {
        type: 'process',
        label: '进程需求',
        hint: 'Need = Max − Allocation，由这两栏算出来',
        //  列数取决于有几类资源 —— 这就是 columns 做成函数的原因
        columns: doc => {
          const res = String(doc.params.resources).split(',').map(x => x.trim()).filter(Boolean)
          return [
            { key: 'id', label: '进程', kind: 'text', width: 58 },
            ...res.map(r => ({ key: `max_${r}`, label: `Max ${r}`, kind: 'number' as const, width: 66 })),
            ...res.map(r => ({ key: `alloc_${r}`, label: `已分配 ${r}`, kind: 'number' as const, width: 74 })),
          ]
        },
        newRow: (i, doc) => {
          const res = String(doc.params.resources).split(',').map(x => x.trim()).filter(Boolean)
          const attrs: Record<string, number> = {}
          for (const r of res) { attrs[`max_${r}`] = 1; attrs[`alloc_${r}`] = 0 }
          return { id: `P${i}`, type: 'process', attrs }
        },
        minRows: 1, maxRows: 8,
      },
    ],
    presets: BANKER_PRESETS,
  },
  bounds: [
    '只做安全性检查，不含"某进程请求资源是否批准"的试分配环节',
    '按进程登记顺序线性扫描找可满足者；换扫描顺序可能得到另一个安全序列',
    '安全序列通常不唯一，本实验只给出找到的第一个',
    '"不安全"不等于"已死锁"，只是存在进入死锁的可能',
  ],
  tabs: [{ id: 'matrix', label: '资源矩阵' }, { id: 'search', label: '安全性检查' }],
  Stage: BankerStage,
  tone: s => ({
    init: { key: 'idle', label: '初始' }, try: { key: 'good', label: '归还' },
    accept: { key: 'good', label: '可满足' }, reject: { key: 'bad', label: '资源不足' },
    safe: { key: 'good', label: '安全' }, unsafe: { key: 'bad', label: '不安全' },
  } as const)[s.act],
  metric: s => {
    const n = Object.keys(s.finish).length
    return n ? s.sequence.length / n : 0
  },
  tickLabel: s => (s.pid ? `试 ${s.pid}` : s.act === 'safe' ? '安全' : s.act === 'unsafe' ? '不安全' : '初始'),
  readouts: (s, doc) => {
    const res = String(doc.params.resources).split(',').map(x => x.trim())
    const n = doc.entities.filter(e => e.type === 'process').length
    return [
      { label: 'Work', value: `(${res.map(r => s.work[r] ?? 0).join(' ')})` },
      { label: '已入序列', value: `${s.sequence.length} / ${n}` },
      { label: '安全序列', value: s.sequence.join(' → ') || '—' },
      { label: '本步试探', value: s.pid || '—' },
      { label: '本步结论', value: { init: '初始化', try: '归还资源', accept: '可满足',
        reject: '资源不足，跳过', safe: '系统安全', unsafe: '系统不安全' }[s.act],
        tone: s.act === 'reject' || s.act === 'unsafe' ? 'bad' : s.act === 'safe' ? 'good' : undefined },
    ]
  },
}

// ═══ 滑动窗口 ARQ ═══════════════════════════════════════
const arq: Experiment<ArqState> = {
  id: 'arq',
  group: '计算机网络',
  title: '滑动窗口 ARQ',
  subtitle: '停止等待 · 后退N帧 · 选择重传',
  kernel: arqKernel,
  defaultDoc: {
    kind: 'arq',
    params: { protocol: 'GBN', windowSize: 4, totalFrames: 8, delay: 2, timeout: 8 },
    entities: [
      { id: 'L1', type: 'loss', attrs: { target: 'frame', seq: 2, nth: 1 } },
    ],
    streams: [],
  },
  params: [
    { key: 'protocol', label: '协议', kind: 'enum', options: ['GBN', 'SR', 'SW'] },
    { key: 'windowSize', label: '发送窗口', kind: 'number', options: [1, 2, 4, 6], unit: '帧' },
    { key: 'totalFrames', label: '总帧数', kind: 'number', options: [6, 8, 12], unit: '帧' },
    { key: 'delay', label: '单程时延', kind: 'number', options: [1, 2, 3], unit: '时隙' },
    { key: 'timeout', label: '超时', kind: 'number', options: [6, 8, 12], unit: '时隙' },
  ],
  entitySpec: {
    tables: [{
      type: 'loss',
      label: '丢包事件',
      hint: '第 nth 次传输该序号时丢失，重传能过去',
      columns: () => [
        { key: 'id', label: '编号', kind: 'text', width: 56 },
        { key: 'target', label: '丢什么', kind: 'enum',
          options: ['frame', 'ack'], labels: ['数据帧', 'ACK'], width: 88 },
        { key: 'seq', label: '序号', kind: 'number', width: 64 },
        { key: 'nth', label: '第几次传输', kind: 'number', width: 92 },
      ],
      newRow: i => ({ id: `L${i + 1}`, type: 'loss', attrs: { target: 'frame', seq: 0, nth: 1 } }),
      minRows: 0, maxRows: 6,
    }],
    presets: ARQ_PRESETS,
  },
  bounds: [
    '序号不做回绕（不取模），所以看不到"窗口上限 2ⁿ−1"这一考点',
    '信道保序、不重排，每时隙至多发一个新帧',
    '丢包由题目指定第几次传输丢失，不做随机丢包',
    '接收方立即确认，未建模捎带确认与延迟确认',
    'SW 即窗口为 1 的 GBN，不单独实现',
  ],
  tabs: [{ id: 'timeline', label: '时空图' }, { id: 'window', label: '窗口状态' }],
  Stage: ArqStage,
  tone: s => ({
    send: { key: 'good', label: '发送' }, resend: { key: 'bad', label: '重传' },
    recv: { key: 'good', label: '收到' }, ack: { key: 'good', label: '确认' },
    drop: { key: 'bad', label: '丢失' }, timeout: { key: 'bad', label: '超时重传' },
    idle: { key: 'idle', label: '等待' }, done: { key: 'good', label: '完成' },
  } as const)[s.event],
  metric: (s, _i) => {
    const total = Object.keys(s.sent).filter(k => k.startsWith('f')).length
    return total ? s.delivered / Math.max(total, s.delivered) : 0
  },
  tickLabel: s => `t=${s.i} ${ { send: '发送', resend: '重传', recv: '收到', ack: 'ACK',
    drop: '丢失', timeout: '超时', idle: '等待', done: '完成' }[s.event] }`,
  readouts: (s, doc) => {
    const total = doc.params.totalFrames as number
    return [
      { label: '已交付', value: `${s.delivered} / ${total}` },
      { label: '发送窗口', value: `[${s.base}, ${s.next - 1}]` },
      { label: '接收方期待', value: String(s.expected) },
      { label: '信道在途', value: s.inFlight.length
          ? s.inFlight.map(f => `${f.kind === 'frame' ? '帧' : 'ACK'} ${f.seq}`).join(' ') : '空' },
      { label: '累计传输', value: String(s.transmissions) },
      { label: '其中重传', value: String(Math.max(0, s.transmissions - total)),
        tone: s.transmissions > total ? 'bad' : undefined },
    ]
  },
}

// ═══ IEEE 754 浮点 ═════════════════════════════════════
const float: Experiment<FloatState> = {
  id: 'float',
  group: '计算机组成原理',
  title: 'IEEE 754 浮点',
  subtitle: '编码七步 · 加减四步',
  kernel: floatKernel,
  defaultDoc: {
    kind: 'float',
    params: { format: 'single', operation: 'encode' },
    entities: [],
    streams: [{ name: 'operands', values: [-12.5] }],
  },
  params: [
    { key: 'format', label: '精度', kind: 'enum', options: ['single', 'double'] },
    { key: 'operation', label: '做什么', kind: 'enum', options: ['encode', 'add', 'sub'] },
  ],
  sequence: {
    stream: 'operands', label: '操作数',
    hint: '编码填 1 个；加减填 2 个（可含小数与负号）',
    maxLength: 2, presets: FLOAT_PRESETS,
  },
  bounds: [
    '只建模规格化数；非规格化数、无穷、NaN 不在范围内',
    '舍入固定为 IEEE 754 默认的「就近舍入、中间值取偶」',
    '加减法保留 3 位保护位后舍入，与硬件的实际位宽可能不同',
    '不建模运算过程中的上溢/下溢中断',
  ],
  tabs: [{ id: 'bits', label: '位域拆解' }, { id: 'steps', label: '推导链' }],
  Stage: FloatStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '完成' }
    : s.phase === 'round' || s.phase === 'mantissa' ? { key: 'bad', label: '舍入' }
    : { key: 'idle', label: '推导' }),
  metric: s => (s.bits.length ? s.bits.split('').filter(b => b !== '?').length / s.bits.length : 0),
  tickLabel: s => s.phase,
  readouts: (s, doc) => [
    { label: '精度', value: doc.params.format === 'double' ? '双精度 64 位' : '单精度 32 位' },
    { label: '本步', value: s.phase },
    { label: '已确定位', value: `${s.bits.split('').filter(b => b !== '?').length} / ${s.bits.length}` },
    ...Object.entries(s.detail).slice(0, 4).map(([k, v]) => ({ label: k, value: v.slice(0, 28) })),
  ],
}

// ═══ 流水线 ════════════════════════════════════════════
const pipeline: Experiment<PipeState> = {
  id: 'pipeline',
  group: '计算机组成原理',
  title: '指令流水线',
  subtitle: '数据冒险 · 前递 · 分支冲刷',
  kernel: pipelineKernel,
  defaultDoc: {
    kind: 'pipeline',
    params: { forwarding: 0 },
    entities: PIPE_PRESETS[1].entities,
  streams: [],
  },
  params: [
    { key: 'forwarding', label: '数据前递', kind: 'number', options: [0, 1], unit: '0 关 / 1 开' },
  ],
  entitySpec: {
    tables: [{
      type: 'inst',
      label: '指令序列',
      hint: 'rd 是写入的寄存器，rs / rt 是读取的',
      columns: () => [
        { key: 'id', label: '编号', kind: 'text', width: 56 },
        { key: 'op', label: '操作', kind: 'enum',
          options: ['add', 'sub', 'and', 'or', 'lw', 'sw', 'beq', 'bne'], width: 78 },
        { key: 'rd', label: 'rd 写', kind: 'text', width: 62 },
        { key: 'rs', label: 'rs 读', kind: 'text', width: 62 },
        { key: 'rt', label: 'rt 读', kind: 'text', width: 62 },
        { key: 'taken', label: '分支跳转', kind: 'number', width: 78 },
      ],
      newRow: i => ({
        id: `I${i + 1}`, type: 'inst',
        attrs: { op: 'add', rd: `R${i + 1}`, rs: 'R0', rt: 'R0', taken: 0 },
      }),
      minRows: 1, maxRows: 10,
    }],
    presets: PIPE_PRESETS,
  },
  bounds: [
    '假设指令与数据存储分离，不建模结构冒险',
    '寄存器堆「前半周期写、后半周期读」—— 所以生产者进 WB 那一拍消费者就能读到',
    '分支在 EX 段判定，不建模分支预测与延迟槽',
    '只建模 RAW，不建模 WAR / WAW（顺序单发射流水线里不会出现）',
  ],
  tabs: [{ id: 'chart', label: '时空图' }, { id: 'now', label: '本周期' }],
  Stage: PipelineStage,
  tone: s => (s.flushed.length ? { key: 'bad', label: '冲刷' }
    : s.stalled.length ? { key: 'bad', label: '气泡' }
    : Object.keys(s.forwards).length ? { key: 'good', label: '前递' }
    : { key: 'idle', label: '推进' }),
  metric: (s, _i) => {
    const total = Object.keys(s.at).length
    return total ? s.done / total : 0
  },
  tickLabel: s => `第 ${s.cycle} 周期`,
  readouts: (s, doc) => {
    const n = doc.entities.filter(e => e.type === 'inst').length
    return [
      { label: '周期', value: String(s.cycle) },
      { label: '已完成', value: `${s.done} / ${n}` },
      { label: '本周期停顿', value: s.stalled.join('、') || '无',
        tone: s.stalled.length ? 'bad' : undefined },
      { label: '本周期前递', value: Object.keys(s.forwards).join('、') || '无',
        tone: Object.keys(s.forwards).length ? 'good' : undefined },
      { label: '本周期冲刷', value: s.flushed.join('、') || '无',
        tone: s.flushed.length ? 'bad' : undefined },
      { label: '前递开关', value: doc.params.forwarding === 1 ? '已开启' : '已关闭' },
    ]
  },
}

// ═══ 虚存 + TLB ════════════════════════════════════════
const vm: Experiment<VmState> = {
  id: 'vm',
  group: '计算机组成原理',
  title: '虚地址转换与 TLB',
  subtitle: '拆地址 · 查 TLB · 查页表',
  kernel: vmKernel,
  defaultDoc: {
    kind: 'vm',
    params: { virtualBits: 16, pageSizeBytes: 4096, tlbEntries: 4 },
    entities: VM_PRESETS[0].entities,
    streams: [{ name: 'virtualAddresses', values: VM_PRESETS_SEQ[0].values }],
  },
  params: [
    { key: 'pageSizeBytes', label: '页大小', kind: 'number', options: [1024, 2048, 4096], unit: 'B' },
    { key: 'tlbEntries', label: 'TLB 项数', kind: 'number', options: [1, 2, 4, 8], unit: '项' },
    { key: 'virtualBits', label: '虚地址位数', kind: 'number', options: [12, 16], unit: '位' },
  ],
  sequence: {
    stream: 'virtualAddresses', label: '访问的虚拟地址',
    radix: 16, hint: '十六进制', maxLength: 20, presets: VM_PRESETS_SEQ,
  },
  entitySpec: {
    tables: [{
      type: 'pte',
      label: '页表',
      hint: '页号就是这一行的 id；有效位 0 表示不在内存',
      columns: () => [
        { key: 'id', label: '页号', kind: 'text', width: 58 },
        { key: 'frame', label: '页框号', kind: 'number', width: 72 },
        { key: 'valid', label: '有效位', kind: 'number', width: 66 },
      ],
      newRow: i => ({ id: String(i), type: 'pte', attrs: { frame: 0, valid: 1 } }),
      minRows: 1, maxRows: 16, chunk: 8,
    }],
    presets: VM_PRESETS,
  },
  bounds: [
    '单级页表，不建模多级页表与页目录',
    'TLB 为全相联、LRU 替换；组相联 TLB 不在范围内',
    '不建模写回、脏位与访问位',
    '缺页只标记出来，不模拟换页的具体过程（那是页面置换实验的事）',
  ],
  tabs: [{ id: 'chain', label: '转换链' }, { id: 'tables', label: 'TLB 与页表' }],
  Stage: VmStage,
  tone: s => (s.outcome === 'tlbHit' ? { key: 'good', label: 'TLB 命中' }
    : s.outcome === 'ptHit' ? { key: 'idle', label: '查页表' }
    : { key: 'bad', label: '缺页' }),
  metric: s => s.tlbHits / (s.i + 1),
  tickLabel: (s, i) => `第 ${i + 1} 次 0x${s.vaddr.toString(16).toUpperCase()}`,
  readouts: s => [
    { label: 'TLB 命中', value: String(s.tlbHits), tone: 'good' },
    { label: '查页表', value: String(s.ptHits) },
    { label: '缺页', value: String(s.faults), tone: 'bad' },
    { label: '虚页号', value: String(s.vpn) },
    { label: '页内偏移', value: String(s.offset) },
    { label: '物理地址', value: s.paddr === null ? '缺页' : '0x' + s.paddr.toString(16).toUpperCase(),
      tone: s.paddr === null ? 'bad' : undefined },
  ],
}

// ═══ 定点乘除 ══════════════════════════════════════════
const multiply: Experiment<MulState> = {
  id: 'multiply',
  group: '计算机组成原理',
  title: '定点乘除逐步',
  subtitle: '原码一位乘 · Booth · 加减交替',
  kernel: multiplyKernel,
  defaultDoc: {
    kind: 'multiply',
    params: { algorithm: 'Booth', bits: 8 },
    entities: [],
    streams: [{ name: 'operands', values: [5, 3] }],
  },
  params: [
    { key: 'algorithm', label: '算法', kind: 'enum', options: ['原码一位乘', 'Booth', '加减交替'] },
    { key: 'bits', label: '位数', kind: 'number', options: [4, 8], unit: '位' },
  ],
  sequence: {
    stream: 'operands', label: '操作数',
    hint: '两个数：乘法是 被乘数 乘数；除法是 被除数 除数',
    maxLength: 2, presets: MUL_PRESETS,
  },
  bounds: [
    '一位乘/一位除，不建模两位乘、阵列乘法器',
    '加减交替法按「符号单独算、数值部分用绝对值」的形式做，与直接补码除法的中间步骤不同',
    '乘积取低 2n 位，不判溢出',
    '除法要求商能装进 n 位；被除数远大于除数时结果无意义',
  ],
  tabs: [{ id: 'regs', label: '寄存器' }, { id: 'table', label: '逐轮表' }],
  Stage: MultiplyStage,
  tone: s => (s.act === 'add' || s.act === 'sub' ? { key: 'good', label: '加减' }
    : s.act === 'shift' ? { key: 'idle', label: '移位' }
    : s.act === 'none' ? { key: 'idle', label: '不动' }
    : { key: 'good', label: '完成' }),
  metric: (s, _i) => {
    const b = s.hi.length
    return b ? Math.min(1, s.round / b) : 0
  },
  tickLabel: s => `第 ${s.round} 轮 ${s.act}`,
  readouts: (s, doc) => [
    { label: '算法', value: String(doc.params.algorithm) },
    { label: '轮次', value: `${s.round} / ${doc.params.bits}` },
    { label: '本步动作', value: s.act },
    { label: '判断位', value: s.judge || '—' },
    ...(s.q !== null
      ? [{ label: '商 / 余数', value: `${s.q} / ${s.rem}` }]
      : [{ label: '部分积', value: s.hi }]),
  ],
}

// ═══ CRC ═══════════════════════════════════════════════
const crc: Experiment<CrcState> = {
  id: 'crc',
  group: '计算机网络',
  title: 'CRC 循环冗余校验',
  subtitle: '模 2 长除法 · 检错',
  kernel: crcKernel,
  defaultDoc: {
    kind: 'crc',
    params: { generator: '10011', operation: 'encode', errorAt: -1 },
    entities: [],
    streams: [{ name: 'dataBits', values: CRC_PRESETS[0].values }],
  },
  params: [
    { key: 'generator', label: '生成多项式', kind: 'enum',
      options: ['110', '1001', '10011', '110101'] },
    { key: 'operation', label: '做什么', kind: 'enum', options: ['encode', 'check'] },
    { key: 'errorAt', label: '注入错误位', kind: 'number',
      options: [-1, 0, 3, 7, 11], unit: '−1 表示不注入' },
  ],
  sequence: {
    stream: 'dataBits', label: '数据位', hint: '只能填 0 和 1',
    maxLength: 32, presets: CRC_PRESETS,
  },
  bounds: [
    '只建模 CRC 的检错，不做纠错 —— CRC 本身也不具备纠错能力',
    '生成多项式用二进制串给出，不涉及多项式的代数形式',
    '不建模比特反转以外的差错（如突发差错的具体分布）',
    '实际协议里的 CRC 还有初值、异或输出、位序反转等约定，本实验不含',
  ],
  tabs: [{ id: 'div', label: '长除法竖式' }, { id: 'result', label: '码字与判定' }],
  Stage: CrcStage,
  tone: s => (s.phase === 'verify'
    ? (/^0*$/.test(s.remainder) ? { key: 'good', label: '无差错' } : { key: 'bad', label: '检出差错' })
    : s.q === '1' ? { key: 'good', label: '异或' }
    : s.phase === 'divide' ? { key: 'idle', label: '上商 0' }
    : { key: 'idle', label: s.phase === 'init' ? '准备' : '结果' }),
  metric: (s, i) => {
    const n = s.dividend.length || 1
    return s.at >= 0 ? (s.at + 1) / n : (s.phase === 'init' ? 0 : 1)
  },
  tickLabel: s => (s.at >= 0 ? `第 ${s.at + 1} 位 商${s.q}` : s.phase),
  readouts: (s, doc) => [
    { label: '生成多项式', value: String(doc.params.generator) },
    { label: '校验位数', value: String(String(doc.params.generator).length - 1) },
    { label: '当前商', value: s.quotient || '—' },
    { label: '余数', value: s.remainder || '尚未算完' },
    { label: '本步', value: s.at >= 0 ? `对齐第 ${s.at + 1} 位，上商 ${s.q}` : s.phase },
  ],
}

// ═══ 海明码 ════════════════════════════════════════════
const hamming: Experiment<HammingState> = {
  id: 'hamming',
  group: '计算机网络',
  title: '海明码',
  subtitle: '校验位布局 · 定位并纠正一位错',
  kernel: hammingKernel,
  defaultDoc: {
    kind: 'hamming',
    params: { operation: 'check', errorAt: 5, evenParity: 1 },
    entities: [],
    streams: [{ name: 'dataBits', values: HAMMING_PRESETS[0].values }],
  },
  params: [
    { key: 'operation', label: '做什么', kind: 'enum', options: ['encode', 'check'] },
    { key: 'errorAt', label: '让第几位出错', kind: 'number',
      options: [0, 1, 2, 3, 5, 7], unit: '0 表示不出错' },
    { key: 'evenParity', label: '校验方式', kind: 'number', options: [1, 0], unit: '1 偶 / 0 奇' },
  ],
  sequence: {
    stream: 'dataBits', label: '数据位', hint: '只能填 0 和 1',
    maxLength: 16, presets: HAMMING_PRESETS,
  },
  bounds: [
    '只建模能纠一位错的基本海明码；加一位全校验的 SEC-DED（能纠一检二）不在范围内',
    '假设最多出现一位错 —— 出两位错时校验子会指向一个错误的位置',
    '校验位固定放在 2 的幂次位，这是最常见的约定',
    '不建模突发差错与交织',
  ],
  tabs: [{ id: 'code', label: '码字与位号' }, { id: 'groups', label: '校验分组' }],
  Stage: HammingStage,
  tone: s => (s.phase === 'locate'
    ? (s.syndrome === 0 ? { key: 'good', label: '无错' } : { key: 'bad', label: '定位到错位' })
    : s.phase === 'inject' ? { key: 'bad', label: '注入错误' }
    : s.ok === false ? { key: 'bad', label: '校验不通过' }
    : s.ok === true ? { key: 'good', label: '校验通过' }
    : { key: 'idle', label: '编码' }),
  metric: s => (s.bits.length ? s.bits.split('').filter(b => b !== '?').length / s.bits.length : 0),
  tickLabel: s => (s.p ? `P${s.p}` : s.phase),
  readouts: (s, doc) => {
    const k = (doc.streams.find(x => x.name === 'dataBits')?.values ?? []).length
    return [
      { label: '数据位数', value: String(k) },
      { label: '校验位数', value: String(s.bits.length - k) },
      { label: '码长', value: String(s.bits.length) },
      { label: '本步校验位', value: s.p ? `P${s.p}` : '—' },
      { label: '校验子', value: String(s.syndrome),
        tone: s.syndrome > 0 ? 'bad' : undefined },
      { label: '结论', value: s.phase === 'locate'
          ? (s.syndrome === 0 ? '无错' : `第 ${s.syndrome} 位出错`) : '推导中' },
    ]
  },
}

// ═══ 子网划分 ══════════════════════════════════════════
const subnet: Experiment<SubnetState> = {
  id: 'subnet',
  group: '计算机网络',
  title: '子网划分与路由匹配',
  subtitle: '掩码按位与 · 最长前缀',
  kernel: subnetKernel,
  defaultDoc: {
    kind: 'subnet',
    params: { operation: 'subnet', prefix: 25, splitBits: 0 },
    entities: ROUTE_PRESETS[0].entities,
    streams: [{ name: 'addresses', values: SUBNET_PRESETS[0].values }],
  },
  params: [
    { key: 'operation', label: '做什么', kind: 'enum', options: ['subnet', 'lpm'] },
    { key: 'prefix', label: '前缀长度', kind: 'number', options: [8, 16, 24, 25, 26, 30], unit: '位' },
    { key: 'splitBits', label: '再借几位划子网', kind: 'number', options: [0, 1, 2, 3], unit: '位' },
  ],
  sequence: {
    stream: 'addresses', label: '地址',
    hint: '十六进制的 32 位地址（预置里给了常见的点分形式）',
    radix: 16, maxLength: 1, presets: SUBNET_PRESETS,
  },
  entitySpec: {
    tables: [{
      type: 'route',
      label: '路由表',
      hint: '仅「最长前缀匹配」模式用；网络号的主机位必须为 0',
      columns: () => [
        { key: 'id', label: '项', kind: 'text', width: 66 },
        { key: 'network', label: '网络号（十进制整数）', kind: 'number', width: 150 },
        { key: 'prefix', label: '前缀', kind: 'number', width: 62 },
        { key: 'nextHop', label: '下一跳', kind: 'text', width: 84 },
      ],
      newRow: i => ({ id: `R${i + 1}`, type: 'route', attrs: { network: 0, prefix: 0, nextHop: '默认' } }),
      minRows: 1, maxRows: 10,
    }],
    presets: ROUTE_PRESETS,
  },
  bounds: [
    '只做 IPv4，不含 IPv6',
    '不区分公网/私网、不校验保留地址（如 127.0.0.0/8）',
    '「可用主机数 = 2^h − 2」按传统约定；现代设备允许 /31 用于点对点链路',
    '路由表按顺序线性比较，不建模实际路由器的 Trie / TCAM 查找结构',
  ],
  tabs: [{ id: 'bits', label: '地址位域' }, { id: 'detail', label: '结论' }],
  Stage: SubnetStage,
  tone: s => (s.phase === 'match'
    ? (s.hit ? { key: 'good', label: '匹配' } : { key: 'bad', label: '不匹配' })
    : s.phase === 'pick' ? { key: 'good', label: '选定' }
    : { key: 'idle', label: '拆解' }),
  metric: (s, i) => {
    const ones = s.mask.indexOf('0') < 0 ? s.mask.length : s.mask.indexOf('0')
    return ones / 32
  },
  tickLabel: s => (s.entry || s.phase),
  readouts: s => [
    ...Object.entries(s.detail).slice(0, 5).map(([k, v]) => ({ label: k, value: v.slice(0, 30) })),
    { label: '本步', value: s.phase },
  ],
}

// ═══ TCP 连接管理 ══════════════════════════════════════
const handshake: Experiment<HsState> = {
  id: 'handshake',
  group: '计算机网络',
  title: 'TCP 连接管理',
  subtitle: '三次握手 · 四次挥手 · 状态迁移',
  kernel: handshakeKernel,
  defaultDoc: {
    kind: 'handshake',
    params: { scenario: 'both', clientSeq: 100, serverSeq: 300 },
    entities: [],
    streams: [],
  },
  params: [
    { key: 'scenario', label: '场景', kind: 'enum', options: ['connect', 'close', 'both'] },
    { key: 'clientSeq', label: '客户端初始序号', kind: 'number', options: [0, 100, 1000] },
    { key: 'serverSeq', label: '服务器初始序号', kind: 'number', options: [0, 300, 2000] },
  ],
  entitySpec: {
    tables: [{
      type: 'loss',
      label: '报文段丢失',
      hint: '第 nth 个报文段丢失（按发出的先后计）',
      columns: () => [
        { key: 'id', label: '编号', kind: 'text', width: 60 },
        { key: 'nth', label: '第几个报文段', kind: 'number', width: 110 },
      ],
      newRow: i => ({ id: `L${i + 1}`, type: 'loss', attrs: { nth: 1 } }),
      minRows: 0, maxRows: 4,
    }],
    presets: HS_PRESETS,
  },
  bounds: [
    '只建模连接的建立与释放，不含数据传输阶段',
    '超时重传最多尝试 3 次，之后放弃 —— 真实实现有退避策略',
    '不建模同时打开 / 同时关闭这两种少见情形',
    'TIME_WAIT 的 2MSL 只作为一步说明，不按真实时长推进',
  ],
  tabs: [{ id: 'timeline', label: '时序图' }, { id: 'states', label: '状态迁移' }],
  Stage: HandshakeStage,
  tone: s => (s.act === 'lost' ? { key: 'bad', label: '丢失' }
    : s.act === 'timeout' ? { key: 'bad', label: '超时' }
    : s.act === 'send' ? { key: 'good', label: '发出' }
    : s.act === 'arrive' ? { key: 'good', label: '到达' }
    : { key: 'idle', label: '说明' }),
  metric: (s, _i) => {
    const order = ['CLOSED', 'SYN_SENT', 'ESTABLISHED', 'FIN_WAIT_1', 'FIN_WAIT_2', 'TIME_WAIT']
    const k = order.indexOf(s.client)
    return k < 0 ? 0 : k / (order.length - 1)
  },
  tickLabel: s => (s.seg ? s.seg.flags : s.act),
  readouts: s => [
    { label: '客户端状态', value: s.client },
    { label: '服务器状态', value: s.server },
    { label: '本步', value: { send: '发出报文段', arrive: '报文段到达', lost: '报文段丢失',
      timeout: '超时重传', wait: '说明', done: '完成' }[s.act] },
    { label: '报文段', value: s.seg ? `${s.seg.flags} seq=${s.seg.seq}` : '—',
      tone: s.seg?.lost ? 'bad' : undefined },
    { label: '已交换', value: `${s.history.length} 个报文段` },
  ],
}

// ═══ AVL ═══════════════════════════════════════════════
const avl: Experiment<AvlState> = {
  id: 'avl',
  group: '数据结构',
  title: 'AVL 平衡二叉树',
  subtitle: 'LL · RR · LR · RL 四种旋转',
  kernel: avlKernel,
  defaultDoc: {
    kind: 'avl', params: { mode: 'avl' }, entities: [],
    streams: [{ name: 'keys', values: AVL_PRESETS[3].values }],
  },
  params: [
    { key: 'mode', label: '模式', kind: 'enum', options: ['avl', 'bst'] },
  ],
  sequence: {
    stream: 'keys', label: '插入序列', hint: '整数，按顺序依次插入',
    maxLength: 20, presets: AVL_PRESETS,
    random: () => {
      const pool = Array.from({ length: 30 }, (_, k) => k + 1)
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]]
      }
      return pool.slice(0, 8)
    },
  },
  bounds: [
    '只做插入，不做删除 —— 删除的旋转情形更复杂，另开一个实验更合适',
    '不存重复键；插入已有的键会被跳过',
    '「bst 模式」只是关掉旋转做对照，不是标准的二叉排序树实现',
    '平衡因子按「左高 − 右高」定义，与部分教材相反的约定不同',
  ],
  tabs: [{ id: 'tree', label: '树形' }, { id: 'rotations', label: '四种失衡' }],
  Stage: AvlStage,
  tone: s => (s.act === 'rotate' ? { key: 'bad', label: `${s.rotation} 旋转` }
    : s.act === 'insert' ? { key: 'good', label: '插入' }
    : s.act === 'done' ? { key: 'good', label: '完成' }
    : { key: 'idle', label: s.act === 'descend' ? '下降' : '回溯' }),
  metric: (s, _i) => {
    const n = s.nodes.length || 1
    return s.inserted / n
  },
  tickLabel: s => (s.act === 'rotate' ? s.rotation : `${s.key}`),
  readouts: (s, doc) => [
    { label: '已插入', value: `${s.inserted} / ${(doc.streams.find(x => x.name === 'keys')?.values ?? []).length}` },
    { label: '当前键', value: String(s.key) },
    { label: '树高', value: String(trueHeight(s.nodes, s.root)) },
    { label: '旋转次数', value: String(s.rotations), tone: s.rotations > 0 ? 'bad' : undefined },
    { label: '本步动作', value: { descend: '比较下降', insert: '挂上新结点',
      update: '回溯更新高度', rotate: `${s.rotation} 型旋转`, done: '完成' }[s.act] },
  ],
}

// ═══ 散列表 ════════════════════════════════════════════
const hash: Experiment<HashState> = {
  id: 'hash',
  group: '数据结构',
  title: '散列表',
  subtitle: '冲突处理 · 平均查找长度',
  kernel: hashKernel,
  defaultDoc: {
    kind: 'hash', params: { size: 13, method: '线性探测', rehashStep: 3 }, entities: [],
    streams: [{ name: 'keys', values: HASH_PRESETS[0].values }],
  },
  params: [
    { key: 'method', label: '冲突处理', kind: 'enum',
      options: ['拉链', '线性探测', '平方探测', '再散列'] },
    { key: 'size', label: '表长', kind: 'number', options: [7, 11, 13, 16], unit: '槽' },
    { key: 'rehashStep', label: '再散列步长', kind: 'number', options: [1, 3, 5], unit: '仅再散列用' },
  ],
  sequence: {
    stream: 'keys', label: '待插入的键', hint: '非负整数',
    maxLength: 16, presets: HASH_PRESETS,
    random: () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 90) + 1),
  },
  bounds: [
    '散列函数固定为 H(key) = key mod 表长，不含平方取中、折叠等其它构造法',
    '平方探测用 +1²、−1²、+2²… 的常见约定；不同教材的序列可能不同',
    '只做插入与查找长度统计，不做删除（开放定址的删除要用墓碑标记）',
    'ASL 失败按「从每个初始地址探到空槽为止」计，与教材主流口径一致',
  ],
  tabs: [{ id: 'table', label: '槽位表' }, { id: 'asl', label: '平均查找长度' }],
  Stage: HashStage,
  tone: s => (s.slot < 0 ? { key: 'bad', label: '装不下' }
    : s.collided ? { key: 'bad', label: '冲突' }
    : { key: 'good', label: '一次落位' }),
  metric: (s, i) => Math.min(1, s.compares / 6),
  tickLabel: s => `${s.key}→槽${s.slot}`,
  readouts: (s, doc) => {
    const size = doc.params.size as number
    const method = String(doc.params.method)
    const a = asl(s.table, size, method, doc.params.rehashStep as number)
    return [
      { label: '本次键', value: String(s.key) },
      { label: '初始地址', value: `${s.key} mod ${size} = ${s.home}` },
      { label: '探查次数', value: String(s.compares), tone: s.compares > 1 ? 'bad' : 'good' },
      { label: '已装入', value: `${s.count} / ${size}` },
      { label: '装填因子 α', value: (s.count / size).toFixed(3) },
      { label: 'ASL 成功', value: a.success.toFixed(3) },
      { label: 'ASL 失败', value: a.fail.toFixed(3) },
    ]
  },
}

// ═══ 哈夫曼 ════════════════════════════════════════════
const huffman: Experiment<HuffState> = {
  id: 'huffman',
  group: '数据结构',
  title: '哈夫曼树与编码',
  subtitle: '逐次合并 · WPL · 前缀码',
  kernel: huffmanKernel,
  defaultDoc: {
    kind: 'huffman', params: {}, entities: [],
    streams: [{ name: 'weights', values: HUFF_PRESETS[0].values }],
  },
  params: [],
  paramsNote: '哈夫曼树的构造完全由权值决定，没有可调参数 —— 改下面的权值序列就行。',
  sequence: {
    stream: 'weights', label: '各字符的权值', hint: '正整数，字符自动标为 A B C…',
    maxLength: 12, presets: HUFF_PRESETS,
    random: () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 20) + 1),
  },
  bounds: [
    '权值相同时取先出现的那个，保证结果可复现 —— 教材里这时结果可能不唯一',
    '左子树记 0、右子树记 1；反过来约定会得到另一组编码，但 WPL 相同',
    '只做等长权值的静态哈夫曼编码，不含自适应哈夫曼',
    '不建模实际压缩里的码表存储开销',
  ],
  tabs: [{ id: 'forest', label: '森林' }, { id: 'codes', label: '编码表与 WPL' }],
  Stage: HuffmanStage,
  tone: s => (s.act === 'merge' ? { key: 'good', label: '合并' }
    : s.act === 'done' ? { key: 'good', label: '完成' }
    : { key: 'idle', label: '初始' }),
  metric: (s, _i) => {
    const total = s.nodes.filter(n => n.left === -1 && n.right === -1).length || 1
    return s.forest.length ? 1 - (s.forest.length - 1) / total : 1
  },
  tickLabel: s => (s.act === 'merge' ? `合并 ${s.nodes[s.merged]?.w ?? ''}` : s.act),
  readouts: (s, doc) => {
    const n = (doc.streams.find(x => x.name === 'weights')?.values ?? []).length
    return [
      { label: '字符个数', value: String(n) },
      { label: '森林剩余', value: `${s.forest.length} 棵` },
      { label: '已合并', value: `${Math.max(0, n - s.forest.length)} / ${Math.max(0, n - 1)} 次` },
      { label: 'WPL', value: s.wpl > 0 ? String(s.wpl) : '走到最后一步才有' },
      { label: '本步合并', value: s.picked.length === 2
          ? `${s.nodes[s.picked[0]].w} + ${s.nodes[s.picked[1]].w}` : '—' },
    ]
  },
}

// ═══ KMP ═══════════════════════════════════════════════
const kmp: Experiment<KmpState> = {
  id: 'kmp',
  group: '数据结构',
  title: 'KMP 字符串匹配',
  subtitle: 'next 数组 · 主串永不回退',
  kernel: kmpKernel,
  defaultDoc: {
    kind: 'kmp',
    params: { text: 'ababcabcabababd', pattern: 'ababd', showMatch: 1 },
    entities: [], streams: [],
  },
  params: [
    { key: 'pattern', label: '模式串', kind: 'enum',
      options: ['ababd', 'ababaca', 'aaaa', 'abcabc', 'abababca'] },
    { key: 'text', label: '主串', kind: 'enum',
      options: ['ababcabcabababd', 'aaaaaaa', 'abcabcabcabc', 'xyzxyzxyz'] },
    { key: 'showMatch', label: '是否演示匹配', kind: 'number', options: [1, 0], unit: '1 是 / 0 只求 next' },
  ],
  bounds: [
    'next 数组按「最长相等前后缀长度」定义（从 0 开始）；部分教材用「下标从 1 开始且整体加 1」的 nextval 约定',
    '不含 nextval 优化（把相同字符的回退再压一层）',
    '只做单模式串匹配，不含 AC 自动机等多模式算法',
    '主串与模式串限定为 ASCII 字符，不处理多字节字符',
  ],
  tabs: [{ id: 'next', label: 'next 数组' }, { id: 'match', label: '匹配对齐' }],
  Stage: KmpStage,
  tone: s => (s.phase === 'found' ? { key: 'good', label: '找到' }
    : s.eq === true ? { key: 'good', label: '相等' }
    : s.eq === false ? { key: 'bad', label: '失配' }
    : { key: 'idle', label: s.phase === 'done' ? '完成' : '推导' }),
  metric: (s, _i) => {
    const n = s.next.length || 1
    return s.phase === 'next' ? (s.j + 1) / n : 1
  },
  tickLabel: s => (s.phase === 'next' ? `next[${s.j}]` : s.phase === 'done' ? '完成' : `i=${s.ti} j=${s.pj}`),
  readouts: (s, doc) => [
    { label: '阶段', value: { next: '求 next 数组', match: '匹配', found: '找到一处', done: '完成' }[s.phase] },
    { label: 'next 数组', value: s.next.map(v => (v < 0 ? '?' : v)).join(' ') },
    { label: '主串指针 i', value: s.ti >= 0 ? String(s.ti) : '—' },
    { label: '模式指针 j', value: s.pj >= 0 ? String(s.pj) : '—' },
    { label: '已找到', value: s.found.length ? s.found.join('、') : '暂无' },
    { label: '主串前进次数', value: `${s.textAdvances}（长 ${String(doc.params.text).length}，永不回退）` },
  ],
}

export const EXPERIMENTS = [
  cache, float, multiply, pipeline, vm,
  page, scheduler, disk, banker,
  sort, dijkstra, avl, hash, huffman, kmp,
  tcp, arq, crc, hamming, subnet, handshake,
] as unknown as AnyExperiment[]
