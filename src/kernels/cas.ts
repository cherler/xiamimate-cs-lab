/**
 * 内核：CAS 比较并交换 / 无锁自增（并发编程 · 后端面试核心）
 * 轴：step —— 3 个线程各做一次 x++（用 CAS），看竞争、失败、重试
 *
 * CAS(compare-and-swap) 是一切无锁并发的原子地基:AtomicInteger、自旋锁、无锁队列全靠它。
 * 一条硬件原子指令 CAS(addr, expected, new):**当且仅当**内存里还等于 expected 时,才写入 new、返回成功;
 * 否则说明有人先改了,返回失败,由调用者重试。
 *
 * 招牌时刻:T1 和 T2 **同时读到 x=0**,都想写 1。naive 的「读-改-写」会丢更新(两个 ++ 只涨了 1);
 * 而 CAS 里 T1 先 CAS(0→1) 成功,T2 CAS(0→1) 发现 x 已是 1≠0 → **失败**,只能重读再来。
 * 于是三个 ++ 一个都不丢,最终 x=3。代价是失败线程要**自旋重试**(本例重试 2 次)。
 *
 * 值全部可核:共享值 x、每个线程读到的 local、每次 CAS 的期望值与成败、重试次数都在状态里。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Thread = { id: number; local: number; status: 'idle' | 'read' | 'won' | 'retry' | 'done' }

export type CasState = {
  i: number
  step: number
  x: number
  threads: Thread[]
  cur: number               // 本步动作的线程 id（0 = 无）
  op: string                // 'read' | 'cas' | 'done'
  expected: number          // 本次 CAS 的期望值（-1 = 非 CAS 步）
  next: number              // 本次 CAS 的新值（-1）
  casOk: boolean            // 本次 CAS 是否成功
  succeeds: number
  fails: number
  phase: 'run' | 'done'
  log: string
}

export const CAS_VISIBLE = [
  'step', 'x', 'threads', 'cur', 'op', 'expected', 'next', 'casOk', 'succeeds', 'fails', 'phase', 'log',
] as const

type Frame = Omit<CasState, 'i'>

type Op = { t: number; k: 'read' | 'cas' }
// 固定交织:T1、T2 同时读 0(竞争);T1 赢、T2 失败重试;T3 插进来赢;T2 再败;T2 终于赢。
const SCHEDULE: Op[] = [
  { t: 1, k: 'read' }, { t: 2, k: 'read' },
  { t: 1, k: 'cas' }, { t: 2, k: 'cas' },
  { t: 3, k: 'read' }, { t: 2, k: 'read' },
  { t: 3, k: 'cas' }, { t: 2, k: 'cas' },
  { t: 2, k: 'read' }, { t: 2, k: 'cas' },
]

const clone = (ts: Thread[]) => ts.map(t => ({ ...t }))

export const casKernel: Kernel<CasState> = {
  kind: 'cas',

  compile(_doc: SimDocument): CompiledModel<CasState> {
    const frames: Frame[] = []
    let x = 0, succeeds = 0, fails = 0
    const threads: Thread[] = [
      { id: 1, local: -1, status: 'idle' },
      { id: 2, local: -1, status: 'idle' },
      { id: 3, local: -1, status: 'idle' },
    ]
    const T = (id: number) => threads.find(t => t.id === id)!

    for (const op of SCHEDULE) {
      let expected = -1, next = -1, casOk = false, log = ''
      const th = T(op.t)
      if (op.k === 'read') {
        th.local = x
        th.status = 'read'
        log = `T${op.t} 读取 x = **${x}** 到本地（准备把它 +1）。`
      } else {
        expected = th.local
        next = th.local + 1
        if (x === expected) {
          x = next; casOk = true; succeeds++
          th.status = 'won'
          log = `T${op.t} CAS(期望 ${expected} → 新值 ${next})：内存里 x 正好还是 ${expected} → **成功**,x=${x}。`
        } else {
          casOk = false; fails++
          th.status = 'retry'
          log = `T${op.t} CAS(期望 ${expected} → 新值 ${next})：但 x 已经是 **${x}** ≠ ${expected}(被别人抢先改了) → **失败**,得重读再来。`
        }
      }
      frames.push({
        step: frames.length, x, threads: clone(threads),
        cur: op.t, op: op.k, expected, next, casOk, succeeds, fails, phase: 'run', log,
      })
    }

    threads.forEach(t => (t.status = 'done'))
    const lf = frames[frames.length - 1]!
    frames.push({
      ...lf, threads: clone(threads), cur: 0, op: 'done', expected: -1, next: -1, casOk: false, phase: 'done',
      log: `**招牌时刻**：T1、T2 都读到过 x=0 想写 1,但 CAS 让先到的赢、后到的失败重试——三个 ++ 一个没丢,最终 **x=${x}**（不是丢更新后的 2）。代价是失败线程自旋重试了 **${fails}** 次。这就是 AtomicInteger、自旋锁、无锁队列的地基:用一条原子指令换掉了锁。`,
    })

    const base0: Frame = {
      step: -1, x: 0,
      threads: [{ id: 1, local: -1, status: 'idle' }, { id: 2, local: -1, status: 'idle' }, { id: 3, local: -1, status: 'idle' }],
      cur: 0, op: '', expected: -1, next: -1, casOk: false, succeeds: 0, fails: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '交织步' },
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
