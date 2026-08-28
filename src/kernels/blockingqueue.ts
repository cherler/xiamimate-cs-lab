/**
 * 内核：线程安全阻塞队列 —— 有界缓冲，满时 put 阻塞、空时 take 阻塞（后端 · 并发编程）
 * 轴：step —— 生产者/消费者共用一个容量有限的队列，看它怎么在满/空时挂起、有空位/有数据时唤醒
 *
 * 生产者-消费者要解耦、还要削峰,用**有界阻塞队列**(BlockingQueue):
 *   · put(x):队列满 → 生产者**阻塞等待**,直到有空位;否则入队。
 *   · take():队列空 → 消费者**阻塞等待**,直到有数据;否则出队。
 * 关键:满/空的判断和挂起/唤醒必须原子(锁 + 条件变量 notFull/notEmpty),否则会丢唤醒或竞态。
 * 本例容量 2:队列满时生产者 put 被挂起,消费者 take 腾出空位后唤醒它;队列空时消费者 take 被挂起,生产者 put 后唤醒它。
 * 值:队列内容、谁阻塞、谁被唤醒都可手核。=Java ArrayBlockingQueue / Go 带缓冲 channel。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type BQState = {
  i: number
  step: number
  op: 'intro' | 'put' | 'take' | 'blockFull' | 'blockEmpty' | 'wakeP' | 'wakeC'
  queue: string[]
  cap: number
  actor: 'P' | 'C' | ''
  item: string
  blockedP: boolean
  blockedC: boolean
  event: string
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<BQState, 'i'>

const CAP = 2

export const blockingqueueKernel: Kernel<BQState> = {
  kind: 'blockingqueue',
  compile(_doc: SimDocument): CompiledModel<BQState> {
    let q: string[] = []
    let bp = false, bc = false
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'queue' | 'cap' | 'blockedP' | 'blockedC'>) => frames.push({ step: frames.length, queue: [...q], cap: CAP, blockedP: bp, blockedC: bc, ...f })

    push({ op: 'intro', actor: '', item: '', event: '', phase: 'run', focus: '有界阻塞队列：满时 put 阻塞、空时 take 阻塞',
      log: `**线程安全阻塞队列（容量 ${CAP}）**\n生产者-消费者解耦的经典结构：\n· put(x)：队列满 → 生产者**阻塞**，等有空位；\n· take()：队列空 → 消费者**阻塞**，等有数据。\n满/空判断 + 挂起/唤醒必须原子（锁 + 条件变量）。看它怎么走。` })

    q.push('A'); push({ op: 'put', actor: 'P', item: 'A', event: 'P put(A)', phase: 'run', focus: '生产者 put(A)：有空位，入队',
      log: `**P put(A)**\n队列有空位 → A 入队。queue=[${q.join(',')}]。` })
    q.push('B'); push({ op: 'put', actor: 'P', item: 'B', event: 'P put(B) → 队列满', phase: 'run', focus: '生产者 put(B)：入队后队列满',
      log: `**P put(B)**\nB 入队 → queue=[${q.join(',')}]，**队列满了**（${CAP}/${CAP}）。再 put 就得阻塞。` })

    bp = true; push({ op: 'blockFull', actor: 'P', item: 'C', event: 'P put(C)：满 → 生产者阻塞', phase: 'run', focus: '生产者 put(C)：队列满 → 阻塞等待空位',
      log: `**P put(C) → 阻塞**\n队列满，没法放 C → 生产者在 **notFull 条件上阻塞挂起**，让出 CPU、等消费者腾出空位。（不是忙等，是真挂起。）` })

    { const x = q.shift()!; bp = false; push({ op: 'wakeP', actor: 'C', item: x, event: `C take → ${x}，腾出空位、唤醒生产者`, phase: 'run', focus: `消费者 take()：取走 ${x}，唤醒被阻塞的生产者`,
      log: `**C take() → ${x}**\n消费者取走 ${x} → queue=[${q.join(',')}]，出现空位 → **唤醒在 notFull 上等待的生产者**。` }) }

    q.push('C'); push({ op: 'put', actor: 'P', item: 'C', event: '生产者被唤醒 → put(C) 成功', phase: 'run', focus: '生产者被唤醒，把 C 放进去',
      log: `**生产者续：put(C)**\n被唤醒后拿到锁、发现有空位 → C 入队 → queue=[${q.join(',')}]。` })

    { const x = q.shift()!; push({ op: 'take', actor: 'C', item: x, event: `C take → ${x}`, phase: 'run', focus: `消费者 take() → ${x}`,
      log: `**C take() → ${x}**\nqueue=[${q.join(',')}]。` }) }
    { const x = q.shift()!; push({ op: 'take', actor: 'C', item: x, event: `C take → ${x}，队列空`, phase: 'run', focus: `消费者 take() → ${x}，队列空了`,
      log: `**C take() → ${x}**\nqueue=[]，**空了**。再 take 就得阻塞。` }) }

    bc = true; push({ op: 'blockEmpty', actor: 'C', item: '', event: 'C take()：空 → 消费者阻塞', phase: 'run', focus: '消费者 take()：队列空 → 阻塞等待数据',
      log: `**C take() → 阻塞**\n队列空，没数据可取 → 消费者在 **notEmpty 条件上阻塞挂起**，等生产者放东西。` })

    q.push('D'); bc = false; push({ op: 'wakeC', actor: 'P', item: 'D', event: 'P put(D)，有数据、唤醒消费者', phase: 'run', focus: '生产者 put(D)：放入数据，唤醒被阻塞的消费者',
      log: `**P put(D)**\nD 入队 → queue=[${q.join(',')}]，有数据了 → **唤醒在 notEmpty 上等待的消费者**。` })

    { const x = q.shift()!; push({ op: 'take', actor: 'C', item: x, event: `消费者被唤醒 → take → ${x}`, phase: 'done', focus: '消费者被唤醒，取走 D',
      log: `**消费者续：take() → ${x}**\nqueue=[]。\n\n**小结**：有界阻塞队列用**锁 + 两个条件变量**（notFull / notEmpty）：满了 put 在 notFull 上等、空了 take 在 notEmpty 上等；对方操作后 signal 唤醒。它天然**削峰**（生产快了就堵在 put）、解耦（两边不用直接协调）。=Java ArrayBlockingQueue、Go 带缓冲 channel。面试讲：为什么要两个条件变量、为什么用 while 而不是 if 判断满/空（防虚假唤醒）、和无界队列的区别（无界不阻塞 put、但可能 OOM）。` }) }

    const base0: Frame = { op: 'intro', step: -1, queue: [], cap: CAP, actor: '', item: '', blockedP: false, blockedC: false, event: '', phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '操作步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
