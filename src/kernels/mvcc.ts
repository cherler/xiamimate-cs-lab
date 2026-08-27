/**
 * 内核：MVCC 多版本并发控制 / 快照读（数据库系统 · 求职面试核心）
 * 轴：step —— 一条固定的两事务调度，逐步看「读到哪个版本」
 *
 * MVCC 是 MySQL(InnoDB)/PostgreSQL 高并发的地基：写不覆盖旧值，而是**追加一个新版本**；
 * 读不加锁，而是**按自己的快照(read-view)挑一个可见版本**。于是「读不阻塞写、写不阻塞读」。
 *
 * 可见性规则(可重复读 RR / 快照隔离)：事务 T 读某行时，在版本链里从新到旧找第一个满足
 *   「该版本已提交，且(创建它的事务在 T 的快照里，或就是 T 自己)」的版本。
 * 快照在事务开始时拍定：之后别人提交的新版本**不在快照里**，所以 T 反复读到的是同一个值——
 * 这就是「可重复读」，也是本实验的招牌时刻：T1 两次读 x 都读到 100，尽管中间 T2 已把它改成 200 并提交。
 *
 * 值全部可核对：版本链、每次读的可见版本、快照集合都在状态里，照着规则一步步推得出。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Version = { value: number; by: number; committed: boolean }
type Txn = { id: number; status: 'idle' | 'active' | 'committed'; snapshot: number[] }

export type MvccState = {
  i: number
  step: number
  versions: Version[]
  txns: Txn[]            // T1, T2
  curTx: number         // 本步操作的事务 id（0=无）
  op: string            // 'begin' | 'read' | 'write' | 'commit' | 'done'
  readValue: number     // read 读到的值（-1 = 本步非读）
  readVersion: number   // 读到的版本在 versions 里的下标（-1）
  phase: 'run' | 'done'
  log: string
}

export const MVCC_VISIBLE = [
  'step', 'versions', 'txns', 'curTx', 'op', 'readValue', 'readVersion', 'phase', 'log',
] as const

type Frame = Omit<MvccState, 'i'>

// 固定调度：经典的「快照隔离 = 可重复读」演示。
type Op = { tx: number; kind: 'begin' | 'read' | 'write' | 'commit'; val?: number }
const SCHEDULE: Op[] = [
  { tx: 1, kind: 'begin' },
  { tx: 2, kind: 'begin' },
  { tx: 1, kind: 'read' },
  { tx: 2, kind: 'write', val: 200 },
  { tx: 2, kind: 'commit' },
  { tx: 1, kind: 'read' },
  { tx: 1, kind: 'commit' },
]
const INIT_VALUE = 100   // T0 的已提交初值

const clone = (vs: Version[]) => vs.map(v => ({ ...v }))
const cloneT = (ts: Txn[]) => ts.map(t => ({ ...t, snapshot: [...t.snapshot] }))

// 可见性：从新到旧找第一个「已提交且(创建者在快照里 或 就是自己)」的版本，返回下标。
function visibleIdx(versions: Version[], snapshot: number[], self: number): number {
  for (let i = versions.length - 1; i >= 0; i--) {
    const v = versions[i]!
    if (v.committed && (snapshot.includes(v.by) || v.by === self)) return i
  }
  return -1
}

export const mvccKernel: Kernel<MvccState> = {
  kind: 'mvcc',

  compile(_doc: SimDocument): CompiledModel<MvccState> {
    const frames: Frame[] = []
    const versions: Version[] = [{ value: INIT_VALUE, by: 0, committed: true }]
    const txns: Txn[] = [
      { id: 1, status: 'idle', snapshot: [] },
      { id: 2, status: 'idle', snapshot: [] },
    ]
    const committed = new Set<number>([0])   // T0 初值已提交
    const T = (id: number) => txns.find(t => t.id === id)!

    for (const op of SCHEDULE) {
      let readValue = -1, readVersion = -1, log = ''
      if (op.kind === 'begin') {
        const t = T(op.tx)
        t.status = 'active'
        t.snapshot = [...committed].sort((a, b) => a - b)   // 开始时拍定快照
        log = `T${op.tx} 开始事务 → 拍下快照 read-view = {${t.snapshot.map(x => `T${x}`).join(', ')}}。之后别人新提交的版本都不在这张快照里。`
      } else if (op.kind === 'read') {
        const t = T(op.tx)
        const idx = visibleIdx(versions, t.snapshot, op.tx)
        readVersion = idx
        readValue = idx >= 0 ? versions[idx]!.value : -1
        log = `T${op.tx} 读 x：按快照 {${t.snapshot.map(x => `T${x}`).join(', ')}} 从新到旧找可见版本 → 命中 v${idx}(值 **${readValue}**，由 T${versions[idx]!.by} 提交)。`
      } else if (op.kind === 'write') {
        versions.push({ value: op.val!, by: op.tx, committed: false })
        log = `T${op.tx} 写 x=${op.val}：不覆盖旧值，**追加新版本** v${versions.length - 1}（未提交，只有 T${op.tx} 自己看得见）。`
      } else if (op.kind === 'commit') {
        const t = T(op.tx)
        t.status = 'committed'
        for (const v of versions) if (v.by === op.tx) v.committed = true
        committed.add(op.tx)
        log = `T${op.tx} 提交：它的新版本对**之后**开始的事务才可见；但已经拿了快照的 T1 看不到——快照是开始那一刻的。`
      }
      frames.push({
        step: frames.length, versions: clone(versions), txns: cloneT(txns),
        curTx: op.tx, op: op.kind, readValue, readVersion, phase: 'run', log,
      })
    }

    const lf = frames[frames.length - 1]!
    frames.push({
      ...lf, versions: clone(versions), txns: cloneT(txns),
      curTx: 0, op: 'done', readValue: -1, readVersion: -1, phase: 'done',
      log: `**招牌时刻**：T1 前后两次读 x 都读到 **${INIT_VALUE}**，尽管中间 T2 已把它改成 200 并提交——因为 T1 用的是开始那一刻拍下的快照(可重复读 RR)。写追加版本、读挑版本，于是读写互不阻塞，这就是 InnoDB/PostgreSQL 扛高并发的地基。`,
    })

    const base0: Frame = {
      step: -1, versions: [{ value: INIT_VALUE, by: 0, committed: true }],
      txns: [{ id: 1, status: 'idle', snapshot: [] }, { id: 2, status: 'idle', snapshot: [] }],
      curTx: 0, op: '', readValue: -1, readVersion: -1, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '调度步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 }
      },
    }
  },
}
