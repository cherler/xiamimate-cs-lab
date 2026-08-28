/**
 * 内核：乐观锁 vs 悲观锁 —— 两个事务同时改一行，两种防"更新丢失"的思路（后端 · 并发编程）
 * 轴：step —— 先看无保护的更新丢失，再看乐观锁(版本号+重试) 和 悲观锁(先加锁+串行) 各自怎么解
 *
 * 两个事务同时改同一行(如扣库存),不加保护会**更新丢失**:都读到 10、都写 9,最终 9——少扣了一次。
 * 两种解法、两种世界观:
 *   · **乐观锁**:假设冲突少,**不加锁**;更新时带版本号 `UPDATE …WHERE version=旧`,版本被别人改过→影响 0 行→**失败重试**。
 *   · **悲观锁**:假设冲突多,**先加锁**(`SELECT …FOR UPDATE`),别人只能**阻塞等待**,拿到锁再改→天然串行。
 * 本例两事务各扣 1 件库存(10→…→8)。乐观:T2 版本不符、重读重试成功;悲观:T2 阻塞等 T1 放锁。
 * 值:库存/版本/锁的流转都可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type LockState = {
  i: number
  step: number
  act: 'intro' | 'lost' | 'optimistic' | 'pessimistic' | 'summary'
  stock: number
  version: number
  lockedBy: string         // 悲观锁持有者（''=无锁）
  t1: string               // T1 当前动作
  t2: string               // T2 当前动作
  event: string
  outcome: 'ok' | 'fail' | 'block' | 'retry' | ''
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<LockState, 'i'>

export const lockstrategyKernel: Kernel<LockState> = {
  kind: 'lockstrategy',
  compile(_doc: SimDocument): CompiledModel<LockState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step'>) => frames.push({ step: frames.length, ...f })

    push({ act: 'intro', stock: 10, version: 1, lockedBy: '', t1: '', t2: '', event: '', outcome: '', phase: 'run', focus: '两个事务同时改一行 → 不保护就"更新丢失"',
      log: `**并发更新同一行**\n库存 10。两个事务 T1、T2 各要扣 1 件（应剩 8）。不加保护会**更新丢失**。两种解法：\n· **乐观锁**：不加锁，更新时用版本号检测冲突、失败重试。\n· **悲观锁**：先加锁，别人阻塞等待、天然串行。\n先看不保护会怎样。` })

    // 更新丢失
    push({ act: 'lost', stock: 10, version: 1, lockedBy: '', t1: '读到 10', t2: '读到 10', event: 'T1、T2 都读到 10', outcome: '', phase: 'run', focus: '无保护：两个事务都读到 10',
      log: `**无保护 · 都读到 10**\nT1 读 stock=10，T2 也读 stock=10（各自在内存里算 10−1=9）。` })
    push({ act: 'lost', stock: 9, version: 1, lockedBy: '', t1: '写回 9 ✓', t2: '写回 9', event: 'T1 写 9、T2 也写 9 → 最终 9', outcome: 'fail', phase: 'run', focus: '无保护：两次扣库存只生效一次 → 更新丢失',
      log: `**无保护 · 更新丢失**\nT1 写回 9、T2 也写回 9 → 最终 **9**。扣了两次、却只少了 1 件——**T2 覆盖了 T1，一次扣减丢了**。这就是要加锁的原因。` })

    // 乐观锁
    push({ act: 'optimistic', stock: 10, version: 1, lockedBy: '', t1: '读 (10, v1)', t2: '读 (10, v1)', event: '乐观锁：都读到 (10, 版本1)', outcome: '', phase: 'run', focus: '乐观锁：不加锁，读出数据带一个版本号',
      log: `**乐观锁 · 读**\n给行加一个**版本号**。T1、T2 都读到 (stock=10, **version=1**)，各自准备扣 1。不加任何锁。` })
    push({ act: 'optimistic', stock: 9, version: 2, lockedBy: '', t1: 'UPDATE …WHERE version=1 ✓', t2: '', event: 'T1 更新成功，版本 1→2', outcome: 'ok', phase: 'run', focus: '乐观锁：T1 带版本更新，匹配 → 成功、版本+1',
      log: `**乐观锁 · T1 更新**\nT1 执行 \`UPDATE stock=9 WHERE version=1\`。当前版本正是 1 → **匹配、更新成功**，stock=9，**版本 1→2**。` })
    push({ act: 'optimistic', stock: 9, version: 2, lockedBy: '', t1: '已提交', t2: 'UPDATE …WHERE version=1 ✗', event: 'T2 更新：版本已是 2≠1 → 影响 0 行、失败', outcome: 'fail', phase: 'run', focus: '乐观锁：T2 版本不符 → 更新失败（检测到冲突）',
      log: `**乐观锁 · T2 更新失败**\nT2 执行 \`UPDATE stock=9 WHERE version=1\`。但版本已经被 T1 改成 2 了 → \`WHERE version=1\` **匹配不到、影响 0 行 → 失败**。乐观锁**检测到了冲突**（而不是像无保护那样默默覆盖）。` })
    push({ act: 'optimistic', stock: 8, version: 3, lockedBy: '', t1: '', t2: '重读(9,v2)→UPDATE …v2 ✓', event: 'T2 重读重试 → 成功，8', outcome: 'retry', phase: 'run', focus: '乐观锁：T2 重读最新、重试 → 成功',
      log: `**乐观锁 · T2 重试**\nT2 **重新读**到最新 (stock=9, version=2)，再 \`UPDATE stock=8 WHERE version=2\` → 匹配、成功，stock=**8**、版本→3。\n结果对了。乐观锁的代价：**冲突时要重试**。` })

    // 悲观锁
    push({ act: 'pessimistic', stock: 10, version: 1, lockedBy: 'T1', t1: 'SELECT…FOR UPDATE 🔒 读 10', t2: '', event: '悲观锁：T1 先加行锁', outcome: 'ok', phase: 'run', focus: '悲观锁：T1 先 SELECT…FOR UPDATE 拿行锁',
      log: `**悲观锁 · T1 加锁**\n（重来，库存 10）T1 执行 \`SELECT stock FROM … WHERE id=… **FOR UPDATE**\` → **拿到这行的锁**，读 stock=10。锁没放，别人别想动这行。` })
    push({ act: 'pessimistic', stock: 10, version: 1, lockedBy: 'T1', t1: '持锁中', t2: 'SELECT…FOR UPDATE → 阻塞 ⏳', event: 'T2 想拿锁 → 行被锁 → 阻塞等待', outcome: 'block', phase: 'run', focus: '悲观锁：T2 也来加锁 → 行被占，阻塞等待',
      log: `**悲观锁 · T2 阻塞**\nT2 也执行 \`SELECT…FOR UPDATE\`，但这行被 T1 锁着 → **T2 阻塞、排队等**（不是重试，是干等）。` })
    push({ act: 'pessimistic', stock: 9, version: 1, lockedBy: '', t1: 'UPDATE 9、提交、放锁 ✓', t2: '等待中…', event: 'T1 改成 9、提交、释放锁', outcome: 'ok', phase: 'run', focus: '悲观锁：T1 改完提交、释放锁',
      log: `**悲观锁 · T1 提交**\nT1 \`UPDATE stock=9\`、提交、**释放锁**。这期间 T2 一直在等。` })
    push({ act: 'pessimistic', stock: 8, version: 1, lockedBy: '', t1: '已完成', t2: '拿到锁 → 读 9 → UPDATE 8 ✓', event: 'T2 拿到锁，读 9 改 8', outcome: 'ok', phase: 'run', focus: '悲观锁：T2 拿到锁，读到最新 9、改成 8',
      log: `**悲观锁 · T2 继续**\n锁放了，T2 拿到锁，读到**最新的 9**、\`UPDATE stock=8\`、提交。最终 **8**。\n悲观锁天然**串行**、不会更新丢失，代价是**并发低**（大家排队等锁）。` })

    push({ act: 'summary', stock: 8, version: 3, lockedBy: '', t1: '', t2: '', event: '', outcome: '', phase: 'done', focus: '乐观锁冲突少时用、悲观锁冲突多时用',
      log: `**对比总结**\n两种都能防更新丢失，结果都是 8，但世界观相反：\n· **乐观锁**（版本号 / CAS）：假设冲突少 → **不加锁**、更新时校验版本、**冲突了才重试**。并发高、无锁开销；但冲突多时反复重试、反而更差。适合**读多写少、冲突罕见**（如点赞数、MVCC）。\n· **悲观锁**（\`FOR UPDATE\` / 行锁）：假设冲突多 → **先加锁**、别人阻塞等待、**天然串行**。稳、不重试；但并发低、锁竞争、可能死锁。适合**写多、冲突频繁、必须一次成功**（如扣钱、抢票核心）。\n面试讲：乐观锁怎么实现（版本号列 / CAS）、ABA 问题（见「ABA 问题」实验）、悲观锁的死锁风险、各自适用场景。`,
    })

    const base0: Frame = { act: 'intro', step: -1, stock: 10, version: 1, lockedBy: '', t1: '', t2: '', event: '', outcome: '', phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '并发步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
