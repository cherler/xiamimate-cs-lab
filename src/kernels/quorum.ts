/**
 * 内核：Quorum NWR —— 可调一致性，W+R>N 保证读到最新写（后端 · 分布式系统）
 * 轴：step —— N 份副本，写到 W 份、读 R 份；当 W+R>N，读写集必重叠 → 读一定看到最新
 *
 * 数据存 N 份副本(容错)，但不必等所有副本都确认。Dynamo/Cassandra 给你三个旋钮 N/W/R：
 *   · 写：只要 W 份副本确认就算成功
 *   · 读：只从 R 份副本读，取里面**版本最新**的那个
 * 关键不等式 **W + R > N**：读集(R 份)和写集(W 份)在 N 份里必有重叠(鸽巢原理)，
 *   重叠的那份带着最新写 → 读一定读到最新。反过来 W+R ≤ N 就可能读到旧值(读写集不相交)。
 * 于是能按需调：W 大读延迟低、写延迟高;R 大反之;W=R=N 强一致但慢。
 * 本例 N=5,W=3,R=3(W+R=6>5)：写 {R0,R1,R2}→v2，读 {R2,R3,R4} 重叠 R2 → 读到 v2。
 * 值:重叠集由读写集交集算出、可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Rep = { ver: number; val: string }
export type QuorumState = {
  i: number
  step: number
  op: 'intro' | 'init' | 'write' | 'read' | 'verdict' | 'counter'
  N: number
  W: number
  R: number
  reps: Rep[]              // N 份副本
  writeSet: number[]       // 写命中的副本下标
  readSet: number[]        // 读命中的副本下标
  overlap: number[]        // 读写重叠
  readVer: number          // 读到的最新版本（-1 未读）
  readVal: string          // 读到的值
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<QuorumState, 'i'>

const N = 5, W = 3, R = 3
const WRITE_SET = [0, 1, 2]
const READ_SET = [2, 3, 4]
const COUNTER_READ = [3, 4]   // R=2 的反例读集

export const quorumKernel: Kernel<QuorumState> = {
  kind: 'quorum',
  compile(_doc: SimDocument): CompiledModel<QuorumState> {
    const reps: Rep[] = Array.from({ length: N }, () => ({ ver: 1, val: 'A' }))
    const frames: Frame[] = []
    const clone = () => reps.map(r => ({ ...r }))
    const push = (f: Omit<Frame, 'step' | 'N' | 'W' | 'R' | 'reps'> & { reps?: Rep[] }) =>
      frames.push({ step: frames.length, N, W, R, reps: f.reps ?? clone(), ...f })

    push({ op: 'intro', writeSet: [], readSet: [], overlap: [], readVer: -1, readVal: '', phase: 'run', focus: 'N 份副本，写 W 份、读 R 份——三个旋钮',
      log: `**Quorum NWR：可调的一致性**\n数据存 **N=${N}** 份副本。不必等所有副本：\n· 写只要 **W=${W}** 份确认就算成功\n· 读只从 **R=${R}** 份读，取里面版本最新的\n关键：**W + R > N** 时读写集必重叠 → 读一定看到最新写。这里 ${W}+${R}=${W + R} > ${N}。` })

    push({ op: 'init', writeSet: [], readSet: [], overlap: [], readVer: -1, readVal: '', phase: 'run', focus: '初始：5 份副本都是 v1（值 A）',
      log: `**初始状态**\n${N} 份副本，全是 **v1（值 A）**。接下来写一个新值 B。` })

    for (const idx of WRITE_SET) { reps[idx] = { ver: 2, val: 'B' } }
    push({ op: 'write', writeSet: WRITE_SET, readSet: [], overlap: [], readVer: -1, readVal: '', phase: 'run', focus: `写 W=${W} 份：R0,R1,R2 更新为 v2（值 B）`,
      log: `**写（W=${W}）**\n把新值 B 写到 3 份副本 **{R0,R1,R2}** → 它们升到 **v2（B）**；R3、R4 还是 v1（A）。\n只要 ${W} 份确认，这次写就算成功——不等 R3、R4。` })

    const overlap = READ_SET.filter(x => WRITE_SET.includes(x))
    const readVer = Math.max(...READ_SET.map(x => reps[x]!.ver))
    const readVal = reps[READ_SET.find(x => reps[x]!.ver === readVer)!]!.val
    push({ op: 'read', writeSet: WRITE_SET, readSet: READ_SET, overlap: [], readVer: -1, readVal: '', phase: 'run', focus: `读 R=${R} 份：R2,R3,R4`,
      log: `**读（R=${R}）**\n从 3 份副本 **{R2,R3,R4}** 读。其中 R2 是刚写过的 v2、R3/R4 是 v1。\n读操作会取读到的这几份里**版本号最大**的那个。` })

    push({ op: 'verdict', writeSet: WRITE_SET, readSet: READ_SET, overlap, readVer, readVal, phase: 'run', focus: 'W+R>N → 读写集必重叠 → 读到最新',
      log: `**为什么一定读到最新**\n写集 {R0,R1,R2} 和读集 {R2,R3,R4} 在 5 份里**必然重叠**——因为 W+R=${W + R} > ${N}（鸽巢原理：${W}+${R} 个位置塞进 ${N} 格，至少 1 格重叠）。\n重叠的是 **R2**，它带着最新的 v2。读集里版本最大 = **v${readVer}（值 ${readVal}）** → 读到了最新写。✅` })

    push({ op: 'counter', writeSet: WRITE_SET, readSet: COUNTER_READ, overlap: COUNTER_READ.filter(x => WRITE_SET.includes(x)), readVer: 1, readVal: 'A', phase: 'done', focus: '反例：W+R≤N 时可能读到旧值',
      log: `**反例：如果 R 调小到 2（W+R=${W + 2} ≤ ${N}）**\n读集可能是 **{R3,R4}**——两份都还是 v1（A），和写集 {R0,R1,R2} **零重叠** → 读到**旧值 A**，漏掉了新写的 B。\n\n**结论**：**W+R>N 保证强一致读**（总读到最新）。三个旋钮按需调：\n· W 大、R 小 → 写慢读快（读多写少场景）\n· W 小、R 大 → 写快读慢\n· W=R=N → 最强一致但最慢；W=R=1 → 最快但可能读到旧值\n这就是 Dynamo/Cassandra "可调一致性" 的来历：一致性和延迟之间的旋钮握在你手里。` })

    const base0: Frame = { op: 'intro', step: -1, N, W, R, reps: Array.from({ length: N }, () => ({ ver: 1, val: 'A' })), writeSet: [], readSet: [], overlap: [], readVer: -1, readVal: '', phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '副本步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
