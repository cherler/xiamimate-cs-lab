/**
 * 内核：LSM-Tree（后端 · 写密集存储引擎）
 * 轴：step —— 写入先进内存表，满了整块刷成不可变 SSTable
 *
 * 为什么 LevelDB、RocksDB、Cassandra、HBase 写这么快?LSM-Tree(Log-Structured Merge Tree):
 * 写入不去改磁盘上的 B+树(那是随机写、慢),而是**先写进内存里的有序表 memtable**(极快);
 * memtable 满了,就**整块顺序写成一个不可变文件 SSTable**(顺序写，磁盘最爱);读取时从新到旧查各层。
 * 后台再把多个 SSTable **归并压实(compaction)** 去掉旧值。它把随机写换成顺序写+批量刷,吞吐暴涨,
 * 代价是读要查多层(用布隆过滤器加速)、以及压实的后台开销。写多读少的场景是它的主场。
 *
 * 本例 memtable 容量 3:写 a/b/c 满→刷成 SSTable1;再写 d/e。每步可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type LSMState = {
  i: number
  step: number
  cap: number
  memtable: string[]
  sstables: string[][]
  cur: string
  act: string            // 'write'|'flush'|'done'
  phase: 'run' | 'done'
  log: string
}

export const LSM_VISIBLE = ['step', 'cap', 'memtable', 'sstables', 'cur', 'act', 'phase', 'log'] as const

type Frame = Omit<LSMState, 'i'>
const CAP = 3
const WRITES = ['a', 'b', 'c', 'd', 'e']

export const lsmKernel: Kernel<LSMState> = {
  kind: 'lsm',
  compile(_doc: SimDocument): CompiledModel<LSMState> {
    const frames: Frame[] = []
    let memtable: string[] = []
    const sstables: string[][] = []
    const snap = (cur: string, act: string, log: string) => frames.push({
      step: frames.length, cap: CAP, memtable: [...memtable], sstables: sstables.map(s => [...s]), cur, act, phase: 'run', log,
    })
    for (const w of WRITES) {
      memtable.push(w); memtable.sort()
      snap(w, 'write', `写入 "${w}"：**直接进内存表 memtable**（极快，有序）。当前 memtable=[${memtable.join(',')}]。`)
      if (memtable.length >= CAP) {
        sstables.push([...memtable])
        snap('', 'flush', `memtable 满(${CAP})→ **整块顺序刷成不可变 SSTable${sstables.length}** [${memtable.join(',')}]（磁盘顺序写，最快）。memtable 清空重新收。`)
        memtable = []
      }
    }
    frames.push({
      step: frames.length, cap: CAP, memtable: [...memtable], sstables: sstables.map(s => [...s]), cur: '', act: 'done', phase: 'done',
      log: `**写入完成**：${sstables.length} 个 SSTable 落盘 + memtable 剩 [${memtable.join(',')}]。LSM 把随机写换成「内存收集 + 整块顺序刷」，写吞吐暴涨——这就是 LevelDB/RocksDB/Cassandra 写得快的原因。代价：读要从新到旧查各层(布隆过滤器加速)，后台还要归并压实(compaction)去旧值。`,
    })
    const base0: Frame = { step: -1, cap: CAP, memtable: [], sstables: [], cur: '', act: '', phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '写入' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
