/**
 * 内核：两阶段提交 2PC（后端 · 分布式事务）
 * 轴：step —— 协调者两阶段:先问「能提交吗」,都答能才真提交
 *
 * 一个事务跨多个库/服务,要么全提交、要么全回滚,不能一半成一半败。2PC 由**协调者**统一指挥:
 *   阶段一(准备/投票):协调者向所有参与者发 Prepare;参与者把活干到「就差最后落盘」、锁住资源,回 **Yes/No**。
 *   阶段二(提交/中止):**只要有一个 No 或超时就全体 Abort**;全 Yes 才广播 Commit,大家一起落盘。
 * 它保证了原子性,但有硬伤:协调者在阶段二**宕机**,参与者会一直锁着资源干等(阻塞)——所以才有 3PC、
 * 以及 Raft/Paxos 这类更抗故障的共识。分布式事务、XA、TCC 的底子都是它。
 *
 * 本例 1 协调者 + 3 参与者,全投 Yes → 提交。值可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Part = { id: string; state: 'idle' | 'prepared' | 'committed' }

export type TwoPCState = {
  i: number
  step: number
  parts: Part[]
  coord: string          // 协调者阶段/决定
  cur: string            // 本步动作的参与者
  yesVotes: number
  decision: string       // '' | 'commit' | 'abort'
  phase: 'run' | 'done'
  log: string
}

export const TWOPC_VISIBLE = ['step', 'parts', 'coord', 'cur', 'yesVotes', 'decision', 'phase', 'log'] as const

type Frame = Omit<TwoPCState, 'i'>
const IDS = ['P1', 'P2', 'P3']

export const twopcKernel: Kernel<TwoPCState> = {
  kind: 'twopc',
  compile(_doc: SimDocument): CompiledModel<TwoPCState> {
    const frames: Frame[] = []
    const parts: Part[] = IDS.map(id => ({ id, state: 'idle' as const }))
    let yesVotes = 0, decision = ''
    const snap = (coord: string, cur: string, log: string) => frames.push({
      step: frames.length, parts: parts.map(p => ({ ...p })), coord, cur, yesVotes, decision, phase: 'run', log,
    })
    snap('阶段一·发Prepare', '', `协调者向 3 个参与者广播 **Prepare**：「你能提交这个事务吗？把活干到就差落盘、锁住资源。」`)
    for (const p of parts) {
      p.state = 'prepared'; yesVotes++
      snap('阶段一·收票', p.id, `${p.id} 干完活、锁好资源，回 **Yes**（已进入 prepared，但还没真提交）。已收 ${yesVotes}/3 票。`)
    }
    decision = 'commit'
    snap('阶段二·决定', '', `**3 票全 Yes** → 协调者决定 **Commit**，广播提交命令。（只要有一个 No 或超时，这里就会变成全体 Abort。）`)
    for (const p of parts) {
      p.state = 'committed'
      snap('阶段二·提交', p.id, `${p.id} 收到 Commit，正式落盘、释放锁。`)
    }
    frames.push({
      step: frames.length, parts: parts.map(p => ({ ...p })), coord: '完成', cur: '', yesVotes, decision, phase: 'done',
      log: `**事务提交完成**：3 个参与者一起提交，原子性达成。2PC 的硬伤：参与者投了 Yes 后就**锁着资源等**，若协调者在阶段二宕机，它们会一直阻塞——这也是 3PC、以及 Raft/Paxos 更抗故障的原因。分布式事务、XA、TCC 底子都是它。`,
    })
    const base0: Frame = { step: -1, parts: IDS.map(id => ({ id, state: 'idle' as const })), coord: '', cur: '', yesVotes: 0, decision: '', phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '2PC 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
