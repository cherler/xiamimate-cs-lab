/**
 * 内核：信号量与生产者-消费者（操作系统 · 同步）
 * 轴：step —— 每步是一个线程尝试执行一条语句
 *
 * 三个信号量各管一件事，混起来就错：
 *   empty  还有几个空位（初值 = 缓冲区大小）
 *   full   已有几个产品（初值 0）
 *   mutex  互斥锁（初值 1）
 *
 * 最经典的错误是**把 P(mutex) 放到 P(empty) 前面** —— 会死锁。
 * 这个实验可以把两种顺序都跑一遍，让死锁真的发生。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type SemState = {
  i: number
  empty: number
  full: number
  mutex: number
  /** 缓冲区里的产品 */
  buffer: number[]
  /** 每个线程当前执行到第几条语句 */
  pc: Record<string, number>
  /** 阻塞在哪个信号量上 */
  blocked: Record<string, string>
  /** 本步的线程与动作 */
  who: string
  act: 'P' | 'V' | 'work' | 'block' | 'wake' | 'deadlock' | 'done'
  sem: string
  produced: number
  consumed: number
  log: string
}

export const SEM_VISIBLE = [
  'i', 'empty', 'full', 'mutex', 'buffer', 'pc', 'blocked',
  'who', 'act', 'sem', 'produced', 'consumed', 'log',
] as const

type Frame = Omit<SemState, 'i'>

/** 一条语句 */
type Op = { kind: 'P' | 'V' | 'work'; sem?: string; text: string }

export const semaphoreKernel: Kernel<SemState> = {
  kind: 'semaphore',

  compile(doc: SimDocument): CompiledModel<SemState> {
    const size = num(doc.params, 'bufferSize')
    const order = str(doc.params, 'order')     // 'correct' | 'wrong'
    /** 调度序列：每一步轮到哪个线程试一次 —— 由文档给定，保证可复现。
     *  界面上那个「调度序列」旋钮只是**选哪一条**，选完仍然是把它写进这条流里
     *  （见 `web/src/types.ts` 的 `ParamSpecBase.stream`）—— 数据只有一个出处。 */
    const sched = (doc.streams.find(s => s.name === 'schedule')?.values ?? []) as string[]
    const threads = [...new Set(sched.map(String))]

    /** 生产者代码；wrong 模式把 P(mutex) 提到 P(empty) 前面 */
    const producer: Op[] = order === 'wrong'
      ? [
          { kind: 'P', sem: 'mutex', text: 'P(mutex)  ← 先上锁（错误顺序）' },
          { kind: 'P', sem: 'empty', text: 'P(empty)  ← 再等空位' },
          { kind: 'work', text: '把产品放进缓冲区' },
          { kind: 'V', sem: 'mutex', text: 'V(mutex)' },
          { kind: 'V', sem: 'full', text: 'V(full)' },
        ]
      : [
          { kind: 'P', sem: 'empty', text: 'P(empty)  ← 先等空位' },
          { kind: 'P', sem: 'mutex', text: 'P(mutex)  ← 再上锁' },
          { kind: 'work', text: '把产品放进缓冲区' },
          { kind: 'V', sem: 'mutex', text: 'V(mutex)' },
          { kind: 'V', sem: 'full', text: 'V(full)' },
        ]
    const consumer: Op[] = order === 'wrong'
      ? [
          { kind: 'P', sem: 'mutex', text: 'P(mutex)  ← 先上锁（错误顺序）' },
          { kind: 'P', sem: 'full', text: 'P(full)   ← 再等产品' },
          { kind: 'work', text: '从缓冲区取走产品' },
          { kind: 'V', sem: 'mutex', text: 'V(mutex)' },
          { kind: 'V', sem: 'empty', text: 'V(empty)' },
        ]
      : [
          { kind: 'P', sem: 'full', text: 'P(full)   ← 先等产品' },
          { kind: 'P', sem: 'mutex', text: 'P(mutex)  ← 再上锁' },
          { kind: 'work', text: '从缓冲区取走产品' },
          { kind: 'V', sem: 'mutex', text: 'V(mutex)' },
          { kind: 'V', sem: 'empty', text: 'V(empty)' },
        ]
    const codeOf = (t: string) => (t.startsWith('P') ? producer : consumer)

    const frames: Frame[] = []
    const sem: Record<string, number> = { empty: size, full: 0, mutex: 1 }
    const buffer: number[] = []
    const pc: Record<string, number> = Object.fromEntries(threads.map(t => [t, 0]))
    const blocked: Record<string, string> = {}
    let produced = 0, consumed = 0
    let nextItem = 1

    const put = (f: Partial<Frame> & { act: Frame['act']; log: string }) => frames.push({
      empty: sem.empty, full: sem.full, mutex: sem.mutex, buffer: [...buffer],
      pc: { ...pc }, blocked: { ...blocked }, who: '', sem: '',
      produced, consumed, ...f,
    })

    put({ act: 'done', log:
      `初始：empty = ${size}（空位数）、full = 0（产品数）、mutex = 1（互斥锁）`
      + `；${order === 'wrong' ? '**本次故意把 P(mutex) 放在前面** —— 看它会不会死锁' : '顺序正确'}` })

    for (const raw of sched) {
      const t = String(raw)
      //  被阻塞的线程这一轮直接跳过（它还醒不过来）
      if (blocked[t]) {
        put({ act: 'block', who: t, sem: blocked[t],
          log: `轮到 ${t}，但它阻塞在 ${blocked[t]} 上，动不了` })
        continue
      }
      const code = codeOf(t)
      const op = code[pc[t] % code.length]

      if (op.kind === 'P') {
        const s = op.sem!
        if (sem[s] > 0) {
          sem[s]--
          pc[t]++
          put({ act: 'P', who: t, sem: s,
            log: `${t} 执行 ${op.text.split('  ')[0]}：${s} 由 ${sem[s] + 1} 减为 ${sem[s]}，通过` })
        } else {
          blocked[t] = s
          put({ act: 'block', who: t, sem: s,
            log: `${t} 执行 ${op.text.split('  ')[0]}：${s} 已经是 0 → **阻塞**，排到 ${s} 的等待队列` })
        }
      } else if (op.kind === 'V') {
        const s = op.sem!
        sem[s]++
        //  唤醒一个等在这个信号量上的线程
        const woken = threads.find(x => blocked[x] === s)
        if (woken) {
          delete blocked[woken]
          sem[s]--
          pc[woken]++
          put({ act: 'wake', who: t, sem: s,
            log: `${t} 执行 V(${s})：唤醒阻塞在 ${s} 上的 ${woken}，`
              + `${woken} 直接拿走这个资源继续往下走` })
        } else {
          put({ act: 'V', who: t, sem: s,
            log: `${t} 执行 V(${s})：${s} 由 ${sem[s] - 1} 加为 ${sem[s]}，没有线程在等` })
        }
        pc[t]++
      } else {
        if (t.startsWith('P')) { buffer.push(nextItem++); produced++ }
        else if (buffer.length > 0) { buffer.shift(); consumed++ }
        pc[t]++
        put({ act: 'work', who: t,
          log: `${t} ${op.text} → 缓冲区 [${buffer.join(' ')}]（${buffer.length}/${size}）` })
      }

      //  死锁判定：所有线程都阻塞了
      if (threads.length > 0 && threads.every(x => blocked[x])) {
        put({ act: 'deadlock', log:
          `**所有线程都阻塞了 —— 死锁**。`
          + `${order === 'wrong'
            ? '原因就是 P(mutex) 放在了 P(empty)/P(full) 前面：'
              + '拿着锁去等资源，而能给它资源的那个线程又在等锁。'
            : ''}` })
        break
      }
    }

    if (frames.at(-1)?.act !== 'deadlock') {
      put({ act: 'done',
        log: `调度序列走完：生产 ${produced} 个、消费 ${consumed} 个，缓冲区里还剩 ${buffer.length} 个` })
    }

    return {
      axis: { kind: 'step', label: '调度步' },
      initial: () => ({
        i: -1, empty: size, full: 0, mutex: 1, buffer: [], pc: {}, blocked: {},
        who: '', act: 'done', sem: '', produced: 0, consumed: 0, log: '',
      }),
      describe: s => s.log,
      step(prev) {
        const base = prev ?? this.initial()
        const i = base.i + 1
        if (i >= frames.length) return null
        return { state: { i, ...frames[i] }, done: i === frames.length - 1 }
      },
    }
  },
}

/** 两种顺序下的代码，供视图展示 */
export const codeFor = (role: 'producer' | 'consumer', order: string) => {
  const res = role === 'producer' ? ['empty', 'full'] : ['full', 'empty']
  return order === 'wrong'
    ? [`P(mutex)`, `P(${res[0]})`, role === 'producer' ? '放入产品' : '取出产品', `V(mutex)`, `V(${res[1]})`]
    : [`P(${res[0]})`, `P(mutex)`, role === 'producer' ? '放入产品' : '取出产品', `V(mutex)`, `V(${res[1]})`]
}
