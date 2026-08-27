/**
 * 内核：迷你 KV 存储（后端 · 组合式 mini-项目 · 把零件拼成能跑的数据库）
 * 轴：step —— put/update/get/compaction 全走一遍，看五个零件真正咬合
 *
 * 这不是又一个孤立知识点,而是把前面学的零件拼成一个真能跑的迷你数据库——面试能讲的「我造过 X」。
 * 它照着 LevelDB/RocksDB 的骨架,而且演示了 LSM 真正的核心行为(面试高频),不是只走顺利路径:
 *   写:先写 WAL(持久) → 进内存 memtable(跳表,有序) → 满了整块顺序刷成不可变 SSTable,键入布隆。
 *   **更新不改旧值,而是追加新版本**(a=1 后又 a=9,两个版本分别在不同 SSTable 里)。
 *   读:先问布隆(说没有就不查盘) → memtable → **从新到旧**查 SSTable(所以读到的是最新值 a=9)。
 *   **compaction(压实)**:后台把多个 SSTable 归并,同键只留最新版本、丢掉旧的(a=1 被丢),回收空间。
 *   多机时用一致性哈希把键分到不同节点。
 * 值全部可核:每步的 memtable、各 SSTable 内容、读到的版本都在状态里。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Entry = [string, number]

export type MiniKVState = {
  i: number
  step: number
  wal: string[]
  memtable: Entry[]
  sstables: Entry[][]
  bloom: string[]
  op: string             // 'put'|'update'|'flush'|'get'|'compact'|'done'
  key: string; val: number
  result: string
  bloomHit: boolean
  foundIn: string        // 'memtable'|'SSTable N'|'none'
  note: string           // 本步的额外提示（更新/新值优先/丢旧版本）
  phase: 'run' | 'done'
  log: string
}

export const MINIKV_VISIBLE = ['step', 'wal', 'memtable', 'sstables', 'bloom', 'op', 'key', 'val', 'result', 'bloomHit', 'foundIn', 'note', 'phase', 'log'] as const

type Frame = Omit<MiniKVState, 'i'>
const CAP = 3
type Op = { kind: 'put'; k: string; v: number } | { kind: 'get'; k: string } | { kind: 'compact' }
const OPS: Op[] = [
  { kind: 'put', k: 'a', v: 1 },
  { kind: 'put', k: 'b', v: 2 },
  { kind: 'put', k: 'c', v: 3 },   // memtable 满 → flush SST1[a=1,b=2,c=3]
  { kind: 'put', k: 'd', v: 4 },
  { kind: 'put', k: 'a', v: 9 },   // 更新 a：追加新版本，SST1 里的 a=1 还在
  { kind: 'put', k: 'e', v: 5 },   // memtable 满 → flush SST2[a=9,d=4,e=5]
  { kind: 'get', k: 'a' },          // 从新到旧查 → SST2 的 a=9 优先
  { kind: 'compact' },              // 归并 SST1+SST2，a 只留最新 9，丢掉 a=1
  { kind: 'get', k: 'z' },          // 布隆挡下
]

export const minikvKernel: Kernel<MiniKVState> = {
  kind: 'minikv',
  compile(_doc: SimDocument): CompiledModel<MiniKVState> {
    const frames: Frame[] = []
    const wal: string[] = []
    let memtable: Entry[] = []
    const sstables: Entry[][] = []
    const bloom: string[] = []
    const base = { key: '', val: -1, result: '', bloomHit: false, foundIn: '', note: '' }
    const snap = (o: Partial<Frame> & { op: string; log: string }) => frames.push({
      step: frames.length, wal: [...wal], memtable: memtable.map(e => [...e] as Entry), sstables: sstables.map(s => s.map(e => [...e] as Entry)),
      bloom: [...bloom], phase: 'run', ...base, ...o,
    })
    for (const op of OPS) {
      if (op.kind === 'put') {
        const isUpdate = bloom.includes(op.k)
        wal.push(`PUT ${op.k}=${op.v}`)
        // 内存表里同键覆盖（内存里就地更新），SSTable 里的旧版本保留
        const mi = memtable.findIndex(e => e[0] === op.k)
        if (mi >= 0) memtable[mi] = [op.k, op.v]; else memtable.push([op.k, op.v])
        memtable.sort((a, b) => a[0] < b[0] ? -1 : 1)
        if (!bloom.includes(op.k)) bloom.push(op.k)
        snap({ op: isUpdate ? 'update' : 'put', key: op.k, val: op.v,
          note: isUpdate ? `这是**更新**：不改旧值,追加新版本(旧 a=1 还躺在 SSTable 里)` : '',
          log: `**put(${op.k}, ${op.v})**：① 先写 WAL(持久) → ② 进 memtable(现 ${memtable.length}/${CAP})${isUpdate ? '——注意这是更新,旧版本不动、只在内存记新值' : ''}。` })
        if (memtable.length >= CAP) {
          sstables.push([...memtable])
          snap({ op: 'flush', note: '', log: `memtable 满(${CAP}) → ③ 整块顺序刷成 **SSTable${sstables.length}** [${memtable.map(e => `${e[0]}=${e[1]}`).join(', ')}]，memtable 清空。` })
          memtable = []
        }
      } else if (op.kind === 'get') {
        if (!bloom.includes(op.k)) {
          snap({ op: 'get', key: op.k, result: '不存在', bloomHit: false, foundIn: 'none',
            log: `**get(${op.k})**：① 问布隆——键 ${op.k} **一定不在**(布隆的"没有"可靠) → 直接返回"不存在"，**连磁盘都不查**，省一次 I/O。` })
        } else {
          const inMem = memtable.find(e => e[0] === op.k)
          let foundIn = '', result = '', note = ''
          if (inMem) { foundIn = 'memtable'; result = String(inMem[1]) }
          else {
            for (let s = sstables.length - 1; s >= 0; s--) {   // 从新到旧
              const hit = sstables[s]!.find(e => e[0] === op.k)
              if (hit) { foundIn = `SSTable${s + 1}`; result = String(hit[1]); note = sstables.length > 1 ? `**从新到旧查**,所以读到的是最新版本 ${op.k}=${result}(旧版本在更早的 SSTable 里被跳过)` : ''; break }
            }
          }
          snap({ op: 'get', key: op.k, result, bloomHit: true, foundIn, note,
            log: `**get(${op.k})**：① 布隆说"可能在" → ② 查 memtable → ③ 从新到旧查 SSTable → 在 **${foundIn}** 命中，返回 **${op.k}=${result}**。` })
        }
      } else {
        // compaction：把所有 SSTable 归并成一个，同键只留最新
        const merged = new Map<string, number>()
        for (const sst of sstables) for (const [k, v] of sst) merged.set(k, v)   // 后面的(更新的)覆盖前面的
        const compacted: Entry[] = [...merged.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
        const dropped = sstables.reduce((n, s) => n + s.length, 0) - compacted.length
        sstables.length = 0; sstables.push(compacted)
        snap({ op: 'compact', note: `丢掉了 ${dropped} 个被覆盖的旧版本(如 a=1)`,
          log: `**compaction(压实)**：后台把多个 SSTable 归并成一个 [${compacted.map(e => `${e[0]}=${e[1]}`).join(', ')}]，同键只留**最新版本**、丢掉 ${dropped} 个旧的(a=1 被丢),回收空间、加快读取。` })
      }
    }
    frames.push({
      step: frames.length, wal: [...wal], memtable: memtable.map(e => [...e] as Entry), sstables: sstables.map(s => s.map(e => [...e] as Entry)),
      bloom: [...bloom], op: 'done', ...base, phase: 'done',
      log: `**迷你 KV 跑通了**：put/更新/get/compaction 一路走完，五个零件真正咬合——WAL 保证不丢、memtable(跳表)吃写、LSM 顺序刷盘+追加更新+压实、布隆挡住不存在的键、（多机）一致性哈希分片。这就是 LevelDB/RocksDB 的骨架。`,
    })
    const base0: Frame = { step: -1, wal: [], memtable: [], sstables: [], bloom: [], op: '', ...base, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '操作' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
