/**
 * 内核：读写锁 RWLock —— 读读共享、读写/写写互斥（后端 · 并发编程）
 * 轴：step —— 一串加锁/解锁请求，看谁能立刻进、谁得排队等
 *
 * 普通互斥锁不管读写、一次只放一个，但"读"其实互不干扰。读写锁放宽：
 *   · 多个读者可以**同时**持有读锁(共享)——读不改数据，并发读安全。
 *   · 写者要**独占**：有任何读者或写者在，它就得等；它持锁时别人都进不来。
 * 于是读多写少的场景吞吐大增(读并发)。代价:写者可能被源源不断的读者饿死(需公平策略)。
 * 本例请求序列 R1读、R2读、W1写、R1解、R2解、R3读、W1解，逐步看持有者与等待队列。
 * 值:每步的持有者/队列由规则确定推进,可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Wait = { who: string; type: 'R' | 'W' }
export type RWLockState = {
  i: number
  step: number
  op: 'intro' | 'grantR' | 'grantW' | 'block' | 'release' | 'summary'
  who: string
  readers: string[]
  writer: string | null
  waitQ: Wait[]
  event: string
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<RWLockState, 'i'>

type Req = { a: 'R' | 'W' | 'U'; who: string }
const SEQ: Req[] = [
  { a: 'R', who: 'R1' }, { a: 'R', who: 'R2' }, { a: 'W', who: 'W1' },
  { a: 'U', who: 'R1' }, { a: 'U', who: 'R2' }, { a: 'R', who: 'R3' }, { a: 'U', who: 'W1' },
]

export const rwlockKernel: Kernel<RWLockState> = {
  kind: 'rwlock',
  compile(_doc: SimDocument): CompiledModel<RWLockState> {
    let readers: string[] = []
    let writer: string | null = null
    const wq: Wait[] = []
    const frames: Frame[] = []
    const snap = (op: Frame['op'], who: string, event: string, focus: string, log: string) =>
      frames.push({ step: frames.length, op, who, readers: [...readers], writer, waitQ: wq.map(w => ({ ...w })), event, phase: 'run', focus, log })

    snap('intro', '', '', '读读共享、读写/写写互斥',
      `**读写锁 RWLock**\n比互斥锁聪明：读不改数据，多个读者可**同时**持锁（共享）；写者要**独占**（有任何读者/写者在就得等）。\n读多写少时吞吐大增。下面一串请求 R1读、R2读、W1写、R1解、R2解、R3读、W1解，看谁进、谁等。`)

    const wake = () => { while (wq.length) { const h = wq[0]!; if (h.type === 'R' && !writer) { readers.push(h.who); wq.shift() } else if (h.type === 'W' && !writer && readers.length === 0) { writer = h.who; wq.shift() } else break } }

    for (const req of SEQ) {
      if (req.a === 'R') {
        if (writer || wq.length) { wq.push({ who: req.who, type: 'R' }); snap('block', req.who, `${req.who} 读→阻塞`, `${req.who} 请求读锁 → 前面有写者/等待者，排队`, `**${req.who} 请求读锁**\n当前${writer ? `写者 ${writer} 独占` : '有人在排队'} → ${req.who} **进等待队列**（不能插队，否则写者饿死）。`) }
        else { readers.push(req.who); snap('grantR', req.who, `${req.who} 读→获准(共享)`, `${req.who} 拿到读锁 → 和其他读者共享`, `**${req.who} 拿到读锁**\n没有写者 → 直接获准。读者们共享：现在持读锁的有 {${readers.join(', ')}}。多个读**并发**进行、互不阻塞。`) }
      } else if (req.a === 'W') {
        if (writer || readers.length || wq.length) { wq.push({ who: req.who, type: 'W' }); snap('block', req.who, `${req.who} 写→阻塞`, `${req.who} 请求写锁 → 有读者/写者，必须等`, `**${req.who} 请求写锁**\n写要**独占**，但现在有读者 {${readers.join(', ')}} → ${req.who} **阻塞排队**，等所有读者都释放。`) }
        else { writer = req.who; snap('grantW', req.who, `${req.who} 写→获准(独占)`, `${req.who} 拿到写锁 → 独占`, `**${req.who} 拿到写锁**\n无人持锁 → 独占获准。此刻别人（读或写）都进不来。`) }
      } else {
        const wasWriter = writer === req.who
        if (wasWriter) writer = null; else readers = readers.filter(x => x !== req.who)
        const before = wq.map(w => w.who).join(',')
        wake()
        const woke = wq.map(w => w.who).join(',') !== before
        snap('release', req.who, `${req.who} 释放`, `${req.who} 释放锁${woke ? ' → 唤醒队首' : ''}`,
          `**${req.who} 释放${wasWriter ? '写' : '读'}锁**\n${wasWriter ? '写者退出' : `读者集变 {${readers.join(', ') || '空'}}`}。${woke ? `条件满足 → **唤醒等待队首**：现在持有者 = ${writer ? `写者 ${writer}` : `读者 {${readers.join(', ')}}`}。` : (readers.length === 0 && !writer && wq.length === 0 ? '锁空了。' : '等待队首条件还不满足，继续等。')}`)
      }
    }

    snap('summary', '', '', '读共享、写独占；读多写少吞吐高，注意写饥饿', '')
    const last = frames[frames.length - 1]!
    last.phase = 'done'
    last.log = `**读写锁小结**\n· **读读共享**：多个读者同时持锁，读并发不阻塞——读多写少的场景（配置、缓存、字典）吞吐远高于互斥锁。\n· **读写、写写互斥**：写者独占，保证写期间数据不被读到中间态。\n· **代价**：实现要防**写饥饿**（读者源源不断、写者永远等不到）——公平锁会让新读者也在等待的写者后面排队。\n\nJava 的 ReentrantReadWriteLock、Go 的 sync.RWMutex、数据库的共享锁/排他锁(S锁/X锁)都是这个模型。什么时候用：**读远多于写、且读操作不短**时最划算。`

    const base0: Frame = { op: 'intro', step: -1, who: '', readers: [], writer: null, waitQ: [], event: '', phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '请求步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
