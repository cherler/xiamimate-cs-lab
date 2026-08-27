/**
 * 内核：死锁检测 · 等待图找环（并发编程 · 后端面试核心）
 * 轴：step —— 三个线程交叉加锁，等待图一步步长出一个环 → 死锁
 *
 * 和银行家算法(死锁**避免**：分配前先判断安不安全)不同，这里是死锁**检测**：
 * 先让它发生，再用**等待图(wait-for graph)**找出来——节点是线程，边 Ti→Tj 表示
 * 「Ti 正等着一把被 Tj 攥在手里的锁」。等待图里一旦出现**环**，环上的线程就互相等、谁也动不了 = 死锁。
 *
 * 经典的循环等待:T1 持 A 等 B、T2 持 B 等 C、T3 持 C 等 A —— 边 1→2→3→1 闭合成环。
 * 招牌时刻:第 6 步 T3 去要 A(被 T1 攥着),最后一条边补上,环闭合,死锁当场被检出。
 * 死锁四条件之一「循环等待」被打破就不会死——这也是「按固定顺序加锁」能防死锁的原因。
 *
 * 值全部可核:每个线程持有/等待的锁、等待图的边、是否成环都在状态里。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Thread = { id: number; holds: string[]; wants: string; blocked: boolean }

export type DeadlockState = {
  i: number
  step: number
  threads: Thread[]
  cur: number
  op: string                // 'acquire' | 'request' | 'done'
  lock: string
  granted: boolean          // 本次加锁是否成功
  waitFor: [number, number][]   // 等待边 Ti→Tj
  deadlock: boolean
  cycle: number[]           // 环上的线程（空=无环）
  phase: 'run' | 'done'
  log: string
}

export const DEADLOCK_VISIBLE = [
  'step', 'threads', 'cur', 'op', 'lock', 'granted', 'waitFor', 'deadlock', 'cycle', 'phase', 'log',
] as const

type Frame = Omit<DeadlockState, 'i'>

type Op = { t: number; k: 'acquire' | 'request'; lock: string }
const SCHEDULE: Op[] = [
  { t: 1, k: 'acquire', lock: 'A' },
  { t: 2, k: 'acquire', lock: 'B' },
  { t: 3, k: 'acquire', lock: 'C' },
  { t: 1, k: 'request', lock: 'B' },   // 等 B（T2 持有）→ 1→2
  { t: 2, k: 'request', lock: 'C' },   // 等 C（T3 持有）→ 2→3
  { t: 3, k: 'request', lock: 'A' },   // 等 A（T1 持有）→ 3→1 环闭合
]

const cloneT = (ts: Thread[]) => ts.map(t => ({ ...t, holds: [...t.holds] }))

// 在等待图里找一个环（DFS 三色）。返回环上的节点，找不到返回 []。
function findCycle(edges: [number, number][], nodes: number[]): number[] {
  const adj = new Map<number, number[]>()
  for (const n of nodes) adj.set(n, [])
  for (const [u, v] of edges) adj.get(u)?.push(v)
  const color = new Map<number, number>()  // 0 白 1 灰 2 黑
  const stack: number[] = []
  let found: number[] = []
  const dfs = (u: number): boolean => {
    color.set(u, 1); stack.push(u)
    for (const v of adj.get(u) ?? []) {
      if (color.get(v) === 1) {   // 回边 → 环
        const idx = stack.indexOf(v)
        found = stack.slice(idx)
        return true
      }
      if ((color.get(v) ?? 0) === 0 && dfs(v)) return true
    }
    color.set(u, 2); stack.pop()
    return false
  }
  for (const n of nodes) if ((color.get(n) ?? 0) === 0 && dfs(n)) break
  return found
}

export const deadlockKernel: Kernel<DeadlockState> = {
  kind: 'deadlock',

  compile(_doc: SimDocument): CompiledModel<DeadlockState> {
    const frames: Frame[] = []
    const threads: Thread[] = [
      { id: 1, holds: [], wants: '', blocked: false },
      { id: 2, holds: [], wants: '', blocked: false },
      { id: 3, holds: [], wants: '', blocked: false },
    ]
    const owner: Record<string, number> = {}   // 锁 → 持有者
    const waitFor: [number, number][] = []
    const T = (id: number) => threads.find(t => t.id === id)!
    const ids = threads.map(t => t.id)

    for (const op of SCHEDULE) {
      const th = T(op.t)
      let granted = false, log = ''
      let deadlock = false, cycle: number[] = []
      if (op.k === 'acquire') {
        owner[op.lock] = op.t
        th.holds.push(op.lock)
        granted = true
        log = `T${op.t} 申请锁 ${op.lock}：空闲 → **拿到**。T${op.t} 现持有 {${th.holds.join(',')}}。`
      } else {
        const holder = owner[op.lock]
        th.wants = op.lock
        th.blocked = true
        granted = false
        waitFor.push([op.t, holder!])
        cycle = findCycle(waitFor, ids)
        deadlock = cycle.length > 0
        log = `T${op.t} 申请锁 ${op.lock}：被 T${holder} 攥着 → **阻塞**,等待图加一条边 T${op.t}→T${holder}。` +
          (deadlock ? `——这条边让等待图**成环** T${[...cycle, cycle[0]].join('→')},**检测到死锁!** 环上的线程互相等、谁也进不了。` : '')
      }
      frames.push({
        step: frames.length, threads: cloneT(threads), cur: op.t, op: op.k, lock: op.lock,
        granted, waitFor: waitFor.map(e => [...e] as [number, number]), deadlock, cycle: [...cycle], phase: 'run', log,
      })
      if (deadlock) break
    }

    const lf = frames[frames.length - 1]!
    frames.push({
      ...lf, threads: cloneT(threads), cur: 0, op: 'done', deadlock: lf.deadlock, cycle: [...lf.cycle], phase: 'done',
      log: lf.deadlock
        ? `**招牌时刻**：等待图成环 T${[...lf.cycle, lf.cycle[0]].join('→')}，${lf.cycle.length} 个线程首尾相等——死锁的本质就是这个**循环等待**。破掉它(比如所有线程**按固定顺序**加锁,就不会出现反向边)就能防死锁,这也是死锁四条件里最好打破的一条。`
        : `没有形成环，未发生死锁。`,
    })

    const base0: Frame = {
      step: -1,
      threads: [{ id: 1, holds: [], wants: '', blocked: false }, { id: 2, holds: [], wants: '', blocked: false }, { id: 3, holds: [], wants: '', blocked: false }],
      cur: 0, op: '', lock: '', granted: false, waitFor: [], deadlock: false, cycle: [], phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '加锁步' },
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
