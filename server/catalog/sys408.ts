//
// 出题目录分片：操作系统 / 计算机组成原理 / 计算机网络（考研 408）14 个实验。
//
// 焊死纪律：每个 fact 的答案都由 compute(trace) 从引擎真实轨迹算出，不硬编码；
// 每条 doc 与 web/src/registry.ts 里对应实验的 defaultDoc 逐字一致，
// 引用到的预置常量从与 registry 相同的源 import，保证出题答案与页面完全对齐。
//
import { bitmapKernel } from '../../src/kernels/bitmap.ts'
import { inodeKernel } from '../../src/kernels/inode.ts'
import { partitionKernel } from '../../src/kernels/partition.ts'
import { schedKernel } from '../../src/kernels/scheduler.ts'
import { semaphoreKernel } from '../../src/kernels/semaphore.ts'
import { addsubKernel } from '../../src/kernels/addsub.ts'
import { floatKernel } from '../../src/kernels/float.ts'
import { multiplyKernel } from '../../src/kernels/multiply.ts'
import { pipelineKernel } from '../../src/kernels/pipeline.ts'
import { vmKernel } from '../../src/kernels/vm.ts'
import { arqKernel } from '../../src/kernels/arq.ts'
import { csmaKernel } from '../../src/kernels/csma.ts'
import { handshakeKernel } from '../../src/kernels/handshake.ts'
import { ripKernel } from '../../src/kernels/rip.ts'
import {
  PIPE_PRESETS, VM_PRESETS, PART_PRESETS, BITMAP_PRESETS, CSMA_PRESETS,
  SEM_SCHEDULES, RIP_PRESETS,
} from '../../src/presets/entities.ts'
import { VM_PRESETS_SEQ, INODE_PRESETS } from '../../src/presets/sequences.ts'
import { numDistractors, last, type CatalogEntry, type Kernel } from '../catalog-shared.ts'

// ── 小工具 ──────────────────────────────────────────────

// 位串干扰项：翻转末位 / 首位 / 中位，得到"像对但错"的机器数
const bitDistractors = (a: string): string[] => {
  const flip = (i: number) => a.slice(0, i) + (a[i] === '0' ? '1' : '0') + a.slice(i + 1)
  return [...new Set([flip(a.length - 1), flip(0), flip(Math.floor(a.length / 2))])].filter(x => x !== a)
}

// 从一组候选里挑出不等于答案的当干扰项
const others = (pool: string[], answer: string, n = 3) =>
  [...new Set(pool)].filter(x => x !== answer).slice(0, n)

const S = (v: unknown) => String(v ?? '')
const N = (v: unknown) => Number(v)

export const SYS408_ENTRIES: CatalogEntry[] = [
  // ═══ 操作系统 ═══════════════════════════════════════════
  {
    id: 'bitmap', title: '位示图管理空闲块', kernel: bitmapKernel as Kernel<unknown>,
    doc: {
      kind: 'bitmap', params: { words: 8, wordBits: 8 },
      entities: BITMAP_PRESETS[0].entities, streams: [],
    },
    facts: [
      {
        id: 'free_left', label: '所有分配/回收请求处理完后还剩多少空闲盘块',
        ask: '位示图共 8 字 × 8 位 = 64 块。按请求序列依次分配、回收完之后，还剩几个空闲盘块?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: S(f.freeCount), step: t.length - 1, evidence: S(f.log) } },
        distractors: numDistractors,
      },
      {
        id: 'reuse_low', label: '回收中间那批后再分配，文件D 拿到的第一个盘块号',
        ask: '先连着分配三批、再回收中间那批(文件B)后，分配文件D 会优先填回收出来的低位——文件D 拿到的第一个盘块号是几?',
        kind: 'number',
        compute: t => {
          const f = last(t); const blocks = f.blocks as number[]
          return { answer: S(blocks[0]), step: t.length - 1, evidence: S(f.log) }
        },
        distractors: numDistractors,
      },
      {
        id: 'cross_word', label: '文件D 占用盘块里最大的盘块号(跨字)',
        ask: '文件D 一次要 6 块、跨过了字边界。它占用的这些盘块里，最大的盘块号是多少?',
        kind: 'number',
        compute: t => {
          const f = last(t); const blocks = f.blocks as number[]
          return { answer: S(Math.max(...blocks)), step: t.length - 1, evidence: `文件D 占用盘块 ${blocks.join('、')}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'op_kind', label: '第 4 个请求(文件B)执行的是哪种操作',
        ask: '请求序列里第 4 个请求(对文件B)执行的是哪种操作?',
        kind: 'choice',
        compute: t => {
          const idx = t.findIndex(f => f.act === 'free')
          const f = t[idx]!
          return { answer: '回收', step: idx, evidence: S(f.log) }
        },
        distractors: a => others(['回收', '分配', '分配失败'], a, 2),
      },
    ],
  },
  {
    id: 'inode', title: '文件索引寻址', kernel: inodeKernel as Kernel<unknown>,
    doc: {
      kind: 'inode',
      params: { blockSizeBytes: 1024, pointerSizeBytes: 4, directCount: 10 },
      entities: [],
      streams: [{ name: 'blockNumbers', values: INODE_PRESETS[0].values }],
    },
    facts: [
      {
        id: 'reads_100000', label: '访问逻辑块 100000 需要几次磁盘访问',
        ask: '块大小 1KB、指针 4B、10 个直接地址。访问逻辑块号 100000 需要几次磁盘访问?',
        kind: 'number',
        compute: t => {
          const f = t.find(x => x.lbn === 100000)!
          return { answer: S(f.reads), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: numDistractors,
      },
      {
        id: 'reads_1000', label: '访问逻辑块 1000 需要几次磁盘访问',
        ask: '访问逻辑块号 1000 需要几次磁盘访问?',
        kind: 'number',
        compute: t => {
          const f = t.find(x => x.lbn === 1000)!
          return { answer: S(f.reads), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: numDistractors,
      },
      {
        id: 'reads_total', label: '四次查找一共访问了多少次磁盘',
        ask: '把序列里 4 个逻辑块(5、100、1000、100000)都查一遍，一共访问了多少次磁盘?',
        kind: 'number',
        compute: t => {
          const total = t.reduce((s, f) => s + N(f.reads), 0)
          return { answer: S(total), step: t.length - 1, evidence: `各次访问次数依次为 ${t.map(f => S(f.reads)).join('、')}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'level_1000', label: '逻辑块 1000 落在哪一级索引',
        ask: '逻辑块号 1000 落在混合索引的哪一级?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.lbn === 1000)!
          const map: Record<string, string> = { direct: '直接地址', single: '一级间接', double: '二级间接', triple: '三级间接', oob: '越界' }
          return { answer: map[S(f.level)] ?? S(f.level), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: a => others(['直接地址', '一级间接', '二级间接', '三级间接'], a, 3),
      },
    ],
  },
  {
    id: 'partition', title: '动态分区分配', kernel: partitionKernel as Kernel<unknown>,
    doc: {
      kind: 'partition', params: { algorithm: '首次适应', memorySize: 640 },
      entities: PART_PRESETS[0].entities, streams: [],
    },
    facts: [
      {
        id: 'job2_at', label: '首次适应下作业2 分配到的起始地址',
        ask: '内存 640KB、首次适应。作业2 申请 100KB 时被分到的分区起始地址是多少?',
        kind: 'number',
        compute: t => {
          const f = t.find(x => x.job === '作业2' && x.act === 'alloc')!
          return { answer: S(f.at), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: numDistractors,
      },
      {
        id: 'free_end', label: '全部请求处理完后的空闲内存总量',
        ask: '整个请求序列(含两次释放)处理完后，空闲内存总量是多少 KB?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: S(f.freeTotal), step: t.length - 1, evidence: S(f.log) } },
        distractors: numDistractors,
      },
      {
        id: 'job6_free', label: '作业6 申请 220KB 却失败时的空闲总量',
        ask: '作业6 申请 220KB 时分配失败——但此刻系统的空闲内存总量其实是多少 KB(空间够却被切碎了)?',
        kind: 'number',
        compute: t => {
          const f = t.find(x => x.job === '作业6')!
          return { answer: S(f.freeTotal), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: numDistractors,
      },
      {
        id: 'job6_result', label: '作业6 申请 220KB 的结果',
        ask: '作业6 申请 220KB 的结果是什么?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.job === '作业6')!
          const map: Record<string, string> = { alloc: '分配成功', fail: '分配失败', free: '释放' }
          return { answer: map[S(f.act)] ?? S(f.act), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: a => others(['分配失败', '分配成功', '触发相邻空闲区合并'], a, 2),
      },
    ],
  },
  {
    id: 'scheduler', title: '进程调度甘特图', kernel: schedKernel as Kernel<unknown>,
    doc: {
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
    facts: [
      {
        id: 'finish_time', label: '所有进程执行完毕的时刻',
        ask: 'SRTF(最短剩余时间优先)调度这 4 个进程，系统在哪个时刻全部执行完毕?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: S(f.t), step: t.length - 1, evidence: S(f.log) } },
        distractors: numDistractors,
      },
      {
        id: 'first_done', label: '最先执行完成的进程',
        ask: 'SRTF 调度下，哪个进程最先执行完成?',
        kind: 'choice',
        compute: t => {
          const c = last(t).completed as string[]
          return { answer: S(c[0]), step: t.length - 1, evidence: `完成顺序 ${c.join(' → ')}` }
        },
        distractors: a => others(['P1', 'P2', 'P3', 'P4'], a, 3),
      },
      {
        id: 'last_done', label: '最后执行完成的进程',
        ask: 'SRTF 调度下，哪个进程最后才执行完成?',
        kind: 'choice',
        compute: t => {
          const c = last(t).completed as string[]
          return { answer: S(c[c.length - 1]), step: t.length - 1, evidence: `完成顺序 ${c.join(' → ')}` }
        },
        distractors: a => others(['P1', 'P2', 'P3', 'P4'], a, 3),
      },
    ],
  },
  {
    id: 'semaphore', title: '信号量与生产者消费者', kernel: semaphoreKernel as Kernel<unknown>,
    doc: {
      kind: 'semaphore',
      params: { bufferSize: 2, order: 'correct', schedule: SEM_SCHEDULES[0]!.label },
      entities: [],
      streams: [{ name: 'schedule', values: SEM_SCHEDULES[0]!.values }],
    },
    facts: [
      {
        id: 'produced', label: '生产者一共成功放入几个产品',
        ask: 'P/V 顺序正确、缓冲区大小 2、按"交替执行"调度，走完序列生产者一共成功放入几个产品?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: S(f.produced), step: t.length - 1, evidence: S(f.log) } },
        distractors: numDistractors,
      },
      {
        id: 'consumed', label: '消费者一共取走几个产品',
        ask: '同一次运行里，消费者一共从缓冲区取走了几个产品?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: S(f.consumed), step: t.length - 1, evidence: S(f.log) } },
        distractors: numDistractors,
      },
      {
        id: 'deadlock', label: '该调度序列最终是否死锁',
        ask: 'P/V 顺序正确、按"交替执行"调度，这次运行最终会不会死锁?',
        kind: 'choice',
        compute: t => {
          const idx = t.findIndex(f => f.act === 'deadlock')
          const dead = idx >= 0
          return {
            answer: dead ? '会死锁' : '不会死锁，正常走完',
            step: dead ? idx : t.length - 1,
            evidence: S(last(t).log),
          }
        },
        distractors: a => others(['会死锁，所有线程互相等待', '运行到一半缓冲区溢出'], a, 2),
      },
    ],
  },

  // ═══ 计算机组成原理 ═════════════════════════════════════
  {
    id: 'addsub', title: '补码定点加减', kernel: addsubKernel as Kernel<unknown>,
    doc: {
      kind: 'addsub', params: { operation: '加', bits: 8 }, entities: [],
      streams: [{ name: 'operands', values: [45, 38] }],
    },
    facts: [
      {
        id: 'carry_ones', label: '逐列相加向高位产生进位1 的列数',
        ask: '8 位补码计算 45 + 38，逐列相加过程中，有几列向更高一位产生了进位 1?',
        kind: 'number',
        compute: t => {
          const f = last(t); const carries = f.carries as number[]
          const n = carries.filter(x => x === 1).length
          return { answer: S(n), step: t.length - 1, evidence: `进位链 ${carries.join('')}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'result_bits', label: '45 + 38 的结果补码机器数(8位)',
        ask: '8 位补码计算 45 + 38，结果的机器数(8 位 0/1 串)是多少?',
        kind: 'choice',
        compute: t => { const f = last(t); return { answer: S(f.sum), step: t.length - 1, evidence: S(f.log) } },
        distractors: (a, _t) => bitDistractors(a),
      },
      {
        id: 'overflow', label: '本次加法是否溢出',
        ask: '8 位补码计算 45 + 38，结果是否溢出?',
        kind: 'choice',
        compute: t => {
          const f = last(t)
          return { answer: f.overflow ? '溢出' : '无溢出', step: t.length - 1, evidence: S(f.log) }
        },
        distractors: a => others(['溢出', '无溢出', '无法判定'], a, 2),
      },
    ],
  },
  {
    id: 'float', title: 'IEEE 754 浮点', kernel: floatKernel as Kernel<unknown>,
    doc: {
      kind: 'float',
      params: { format: 'single', operation: 'encode' },
      entities: [],
      streams: [{ name: 'operands', values: [-12.5] }],
    },
    facts: [
      {
        id: 'true_exp', label: '规格化后阶码真值 e',
        ask: '把 −12.5 写成 1.M × 2^e 的规格化形式，阶码真值 e 是多少?',
        kind: 'number',
        compute: t => {
          const f = t.find(x => x.phase === 'normalize')!
          const d = f.detail as Record<string, string>
          return { answer: S(d['阶码E']), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: numDistractors,
      },
      {
        id: 'exp_field', label: '8 位阶码字段(移码)',
        ask: '−12.5 的单精度编码里，8 位阶码字段(移码)是多少?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.phase === 'exponent')!
          const d = f.detail as Record<string, string>
          return { answer: S(d['二进制']), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: (a, _t) => bitDistractors(a),
      },
      {
        id: 'hex', label: '单精度编码的十六进制',
        ask: '−12.5 的 IEEE 754 单精度编码，用十六进制表示是多少?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.phase === 'assemble')!
          const d = f.detail as Record<string, string>
          return { answer: S(d['十六进制']), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: a => others([a, '0x41480000', '0xC1400000', '0xC1C80000'], a, 3),
      },
    ],
  },
  {
    id: 'multiply', title: '定点乘除逐步', kernel: multiplyKernel as Kernel<unknown>,
    doc: {
      kind: 'multiply',
      params: { algorithm: 'Booth', bits: 8 },
      entities: [],
      streams: [{ name: 'operands', values: [5, 3] }],
    },
    facts: [
      {
        id: 'addsub_count', label: 'Booth 全过程做了几次加减',
        ask: '用 Booth 算法(8 位)计算 5 × 3，全过程一共做了几次加或减(不含移位)?',
        kind: 'number',
        compute: t => {
          const n = t.filter(f => f.act === 'add' || f.act === 'sub').length
          return { answer: S(n), step: t.length - 1, evidence: `判断位 01 加、10 减、00/11 不动` }
        },
        distractors: numDistractors,
      },
      {
        id: 'shift_count', label: 'Booth 全过程移位次数',
        ask: '用 Booth 算法(8 位)计算 5 × 3，一共做了几次算术右移?',
        kind: 'number',
        compute: t => {
          const n = t.filter(f => f.act === 'shift').length
          return { answer: S(n), step: t.length - 1, evidence: `n 位数做 n 轮，每轮移一次` }
        },
        distractors: numDistractors,
      },
      {
        id: 'first_judge', label: '第 1 轮的判断位组合',
        ask: 'Booth 算法第 1 轮，用来判断加减的两位(乘数末位 + 附加位)是什么组合?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.round === 1)!
          return { answer: S(f.judge), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: a => others(['00', '01', '10', '11'], a, 3),
      },
    ],
  },
  {
    id: 'pipeline', title: '指令流水线', kernel: pipelineKernel as Kernel<unknown>,
    doc: {
      kind: 'pipeline',
      params: { forwarding: 0 },
      entities: PIPE_PRESETS[1].entities,
      streams: [],
    },
    facts: [
      {
        id: 'total_cycles', label: '不开前递跑完 4 条连环相关指令的总周期数',
        ask: '五段流水线、不开数据前递，4 条连环 RAW 相关的指令跑完一共需要多少个时钟周期?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: S(f.cycle), step: t.length - 1, evidence: S(f.log) } },
        distractors: numDistractors,
      },
      {
        id: 'stall_cycles', label: '发生停顿的周期数',
        ask: '整个流水过程中，有多少个时钟周期发生了停顿(有指令被卡住)?',
        kind: 'number',
        compute: t => {
          const n = t.filter(f => (f.stalled as string[]).length > 0).length
          return { answer: S(n), step: t.length - 1, evidence: `不开前递时，RAW 相关要等生产者写回` }
        },
        distractors: numDistractors,
      },
      {
        id: 'first_stall', label: '第一个因数据冒险停顿的指令',
        ask: '不开前递时，哪条指令最先因为数据冒险(RAW)而发生停顿?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => (x.stalled as string[]).length > 0)!
          const s = f.stalled as string[]
          return { answer: S(s[0]), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: a => others(['I1', 'I2', 'I3', 'I4'], a, 3),
      },
    ],
  },
  {
    id: 'vm', title: '虚地址转换与 TLB', kernel: vmKernel as Kernel<unknown>,
    doc: {
      kind: 'vm',
      params: { virtualBits: 16, pageSizeBytes: 4096, tlbEntries: 4 },
      entities: VM_PRESETS[0].entities,
      streams: [{ name: 'virtualAddresses', values: VM_PRESETS_SEQ[0].values }],
    },
    facts: [
      {
        id: 'faults', label: '整个访问序列的缺页次数',
        ask: '页大小 4KB、TLB 4 项、页 3 无效。跑完这串虚拟地址访问，一共缺页几次?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: S(f.faults), step: t.length - 1, evidence: S(f.log) } },
        distractors: numDistractors,
      },
      {
        id: 'tlb_hits', label: '整个访问序列的 TLB 命中次数',
        ask: '同一串访问里，一共发生几次 TLB 命中?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: S(f.tlbHits), step: t.length - 1, evidence: S(f.log) } },
        distractors: numDistractors,
      },
      {
        id: 'paddr_1000', label: '访问虚地址 0x1000 得到的物理地址',
        ask: '访问虚拟地址 0x1000 时，最终得到的物理地址(十进制)是多少?',
        kind: 'number',
        compute: t => {
          const f = t.find(x => x.vaddr === 0x1000)!
          return { answer: S(f.paddr), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: numDistractors,
      },
      {
        id: 'outcome_3001', label: '访问虚地址 0x3001 的结果',
        ask: '访问虚拟地址 0x3001 的结果是什么?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.vaddr === 0x3001)!
          const map: Record<string, string> = { tlbHit: 'TLB 命中', ptHit: '页表命中', fault: '缺页' }
          return { answer: map[S(f.outcome)] ?? S(f.outcome), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: a => others(['TLB 命中', '页表命中', '缺页'], a, 2),
      },
    ],
  },

  // ═══ 计算机网络 ═════════════════════════════════════════
  {
    id: 'arq', title: '滑动窗口 ARQ', kernel: arqKernel as Kernel<unknown>,
    doc: {
      kind: 'arq',
      params: { protocol: 'GBN', windowSize: 4, totalFrames: 8, delay: 2, timeout: 8 },
      entities: [
        { id: 'L1', type: 'loss', attrs: { target: 'frame', seq: 2, nth: 1 } },
      ],
      streams: [],
    },
    facts: [
      {
        id: 'transmissions', label: '全部交付前的总传输次数(含重传)',
        ask: 'GBN、窗口 4、共 8 帧，帧 2 首传丢失。到全部交付为止，发送方一共传输了多少次(含重传)?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: S(f.transmissions), step: t.length - 1, evidence: S(f.log) } },
        distractors: numDistractors,
      },
      {
        id: 'retransmissions', label: '重传次数',
        ask: '同一次运行里，除首次发送外，一共发生了多少次重传?',
        kind: 'number',
        compute: t => {
          const f = last(t); const re = N(f.transmissions) - N(f.delivered)
          return { answer: S(re), step: t.length - 1, evidence: `共传输 ${S(f.transmissions)} 次，交付 ${S(f.delivered)} 帧` }
        },
        distractors: numDistractors,
      },
      {
        id: 'slots', label: '从开始到全部交付经历的时隙数',
        ask: '从发送第一帧到全部交付完成，一共经历了多少个时隙?',
        kind: 'number',
        compute: t => ({ answer: S(t.length), step: t.length - 1, evidence: S(last(t).log) }),
        distractors: numDistractors,
      },
      {
        id: 'gbn_retx', label: '帧 2 超时后 GBN 的重传方式',
        ask: '帧 2 丢失导致超时后，GBN 采取的重传方式是?',
        kind: 'choice',
        compute: t => {
          const idx = t.findIndex(f => f.event === 'timeout')
          return {
            answer: '回退 N 帧：base 之后所有已发送但未确认的帧全部重发',
            step: idx >= 0 ? idx : t.length - 1,
            evidence: S((idx >= 0 ? t[idx] : last(t)).log),
          }
        },
        distractors: a => others(['只重传超时丢失的那一帧', '丢弃后续所有帧并停止发送'], a, 2),
      },
    ],
  },
  {
    id: 'csma', title: 'CSMA/CD 与退避', kernel: csmaKernel as Kernel<unknown>,
    doc: {
      kind: 'csma', params: { maxAttempts: 16 },
      entities: CSMA_PRESETS[0].entities, streams: [],
    },
    facts: [
      {
        id: 'collisions', label: '整个过程发生几次冲突',
        ask: '两站(A、B)同时就绪争用总线，整个过程一共发生了几次冲突?',
        kind: 'number',
        compute: t => {
          const n = t.filter(f => f.collision === true).length
          return { answer: S(n), step: t.length - 1, evidence: S(last(t).log) }
        },
        distractors: numDistractors,
      },
      {
        id: 'backoff_a', label: '站 A 首次冲突后退避的争用期数',
        ask: '第一次冲突后，站 A 按二进制指数退避取到的退避争用期数 r 是多少?',
        kind: 'number',
        compute: t => {
          const f = t.find(x => x.collision === true)!
          const b = f.backoff as Record<string, number>
          return { answer: S(b['A']), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: numDistractors,
      },
      {
        id: 'contention_slots', label: '整个过程经历几个争用期',
        ask: '从争用开始到两站都发送成功，一共经历了几个争用期?',
        kind: 'number',
        compute: t => {
          const m = Math.max(...t.map(f => N(f.slot)))
          return { answer: S(m), step: t.length - 1, evidence: S(last(t).log) }
        },
        distractors: numDistractors,
      },
      {
        id: 'first_success', label: '冲突后哪一站先发送成功',
        ask: '两站冲突、各自退避后，哪一站先发送成功?',
        kind: 'choice',
        compute: t => {
          const done = last(t).done as string[]
          return { answer: S(done[0]), step: t.length - 1, evidence: `成功顺序 ${done.join(' → ')}` }
        },
        distractors: (a, t) => others([...Object.keys(last(t).attempts as object), '两站同时成功'], a, 2),
      },
    ],
  },
  {
    id: 'handshake', title: 'TCP 连接管理', kernel: handshakeKernel as Kernel<unknown>,
    doc: {
      kind: 'handshake',
      params: { scenario: 'both', clientSeq: 100, serverSeq: 300 },
      entities: [],
      streams: [],
    },
    facts: [
      {
        id: 'seg_count', label: '建连+断连一共发送几个报文段',
        ask: '三次握手建连、四次挥手断连(无丢包)，全程一共发送了几个报文段?',
        kind: 'number',
        compute: t => {
          const h = last(t).history as unknown[]
          return { answer: S(h.length), step: t.length - 1, evidence: S(last(t).log) }
        },
        distractors: numDistractors,
      },
      {
        id: 'synack_ack', label: '第二次握手 SYN+ACK 的确认号',
        ask: '客户端初始序号 100，第二次握手服务器发回的 SYN+ACK 报文段里，确认号 ack 是多少?',
        kind: 'number',
        compute: t => {
          const h = last(t).history as { flags: string; ack: number }[]
          const seg = h.find(s => s.flags === 'SYN+ACK')!
          return { answer: S(seg.ack), step: t.length - 1, evidence: `SYN 要消耗一个序号，故 ack = 客户端 seq + 1` }
        },
        distractors: numDistractors,
      },
      {
        id: 'state_after_synack', label: '客户端收到 SYN+ACK 后的状态',
        ask: '客户端收到服务器的 SYN+ACK 后，进入哪个状态?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => S(x.log).includes('客户端收到 SYN+ACK'))!
          return { answer: S(f.client), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: a => others(['ESTABLISHED', 'SYN_SENT', 'SYN_RCVD', 'TIME_WAIT'], a, 3),
      },
      {
        id: 'state_after_fin', label: '客户端收到服务器 FIN 后的状态',
        ask: '主动关闭的客户端收到服务器的 FIN 后，进入哪个状态?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => S(x.log).includes('进入 TIME_WAIT'))!
          return { answer: S(f.client), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: a => others(['TIME_WAIT', 'FIN_WAIT_1', 'FIN_WAIT_2', 'CLOSED'], a, 3),
      },
    ],
  },
  {
    id: 'rip', title: '距离矢量路由', kernel: ripKernel as Kernel<unknown>,
    doc: {
      kind: 'rip', params: { scenario: '收敛' },
      entities: RIP_PRESETS[0].entities, streams: [],
    },
    facts: [
      {
        id: 'rounds', label: '全网收敛需要几轮交换',
        ask: 'A—B—C—D 一条链(各段代价 1)，从只知直连邻居开始，全网收敛需要几轮交换?',
        kind: 'number',
        compute: t => {
          const f = t.find(x => x.act === 'converged')!
          return { answer: S(f.round), step: t.indexOf(f), evidence: S(f.log) }
        },
        distractors: numDistractors,
      },
      {
        id: 'dist_ad', label: '收敛后 A 到 D 的最短代价',
        ask: '收敛后，路由器 A 到 D 的最短代价是多少?',
        kind: 'number',
        compute: t => {
          const d = last(t).dist as Record<string, Record<string, number>>
          return { answer: S(d['A']['D']), step: t.length - 1, evidence: `A 的距离矢量 ${JSON.stringify(d['A'])}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'first_round_changes', label: '第一轮交换更新的表项数',
        ask: '第 1 轮交换后，全网一共有多少个距离表项发生了更新?',
        kind: 'number',
        compute: t => {
          const f = t.find(x => x.round === 1 && x.act === 'exchange')!
          const c = f.changed as string[]
          return { answer: S(c.length), step: t.indexOf(f), evidence: `更新的表项：${c.join('、')}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'nexthop_ad', label: '收敛后 A 去 D 的下一跳',
        ask: '收敛后，A 要把发往 D 的分组先交给哪一台路由器(下一跳)?',
        kind: 'choice',
        compute: t => {
          const via = last(t).via as Record<string, Record<string, string>>
          return { answer: S(via['A']['D']), step: t.length - 1, evidence: `A 的下一跳表 ${JSON.stringify(via['A'])}` }
        },
        distractors: (a, t) => others(last(t).routers as string[], a, 3),
      },
    ],
  },
]
