/**
 * 内核：ABA 问题 —— CAS 的经典陷阱：值变了一圈又变回来，CAS 却察觉不到（后端 · 并发编程）
 * 轴：step —— 先演示无版本号的 ABA 误判，再用版本号(stamp)修复
 *
 * CAS(比较并交换)靠"当前值 == 我读到的旧值"来判断"期间没人动过"。但这判断有漏洞：
 *   值从 A 变到 B、又变回 A，CAS 一看还是 A，就以为没人动过——其实中间换了两次(ABA)。
 *   在无锁栈/队列里这会出真 bug：一个节点被弹出、释放、又被重新分配到同地址，CAS 把它当原来的。
 * 修复：给值配一个只增不减的**版本号(stamp)**，CAS 比 (值, 版本) 一对。改一次版本 +1，
 *   即使值绕回 A，版本也回不去了 → CAS 发现版本不符 → 正确失败。这就是 AtomicStampedReference。
 * 本例：值 100(A)。T1 读到 A，挂起；T2 把 A→B→A；T1 恢复做 CAS。
 *   无版本：CAS 期望 100、当前 100 → 误判成功；有版本：期望 (100,v1)、当前 (100,v3) → 正确失败。
 * 值:每步的值/版本由规则确定推进,可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type ABAState = {
  i: number
  step: number
  act: 'intro' | 'buggy' | 'fixed'
  op: 'read' | 'change' | 'cas' | 'note'
  value: number            // 共享值
  version: number          // 版本号（fixed 阶段用）
  t1Read: number           // T1 读到的值
  t1Ver: number            // T1 读到的版本
  casOk: boolean | null    // 本步 CAS 结果
  event: string
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<ABAState, 'i'>

const A = 100, B = 200

export const abaKernel: Kernel<ABAState> = {
  kind: 'aba',
  compile(_doc: SimDocument): CompiledModel<ABAState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step'>) => frames.push({ step: frames.length, ...f })
    //  CAS 成败由"当前值/版本"和"T1 读到的值/版本"现算：无版本只比值(会被 ABA 骗)、有版本比(值,版本)
    const casCheck = (versioned: boolean, curVal: number, curVer: number, readVal: number, readVer: number) =>
      versioned ? (curVal === readVal && curVer === readVer) : (curVal === readVal)

    push({ act: 'intro', op: 'note', value: A, version: 1, t1Read: -1, t1Ver: -1, casOk: null, event: '', phase: 'run', focus: 'CAS 靠"值没变"判断没人动过——但这有漏洞',
      log: `**ABA 问题**\nCAS(比较并交换)判断"期间没人动过"的依据是：**当前值 == 我读到的旧值**。\n漏洞：值从 A→B→又变回 A，CAS 一看还是 A，就以为没人动过——其实中间换了两次。\n本例共享值 = **${A}(记作 A)**。先看无版本号时怎么被坑。` })

    // —— Act 1: buggy ——
    push({ act: 'buggy', op: 'read', value: A, version: 1, t1Read: A, t1Ver: -1, casOk: null, event: `T1 读到 ${A}`, phase: 'run', focus: 'T1 读到 A=100，然后被挂起',
      log: `**① 无版本 · T1 读值**\nT1 读到共享值 = **${A}**，记下来准备待会 CAS。此时 T1 被调度器**挂起**（还没来得及 CAS）。` })
    push({ act: 'buggy', op: 'change', value: B, version: 1, t1Read: A, t1Ver: -1, casOk: null, event: `T2: ${A}→${B}`, phase: 'run', focus: 'T2 趁机把 A→B',
      log: `**① 无版本 · T2 改 A→B**\nT2 抢到 CPU，CAS 把值从 ${A} 改成 **${B}**。（现实里可能是弹出一个节点）` })
    push({ act: 'buggy', op: 'change', value: A, version: 1, t1Read: A, t1Ver: -1, casOk: null, event: `T2: ${B}→${A}`, phase: 'run', focus: 'T2 又把 B→A，值绕回 100',
      log: `**① 无版本 · T2 改回 B→A**\nT2 又把值从 ${B} 改回 **${A}**。现在值看起来和 T1 读到的一模一样，但**世界已经变过两次**了。（现实里：那个节点被释放、又重新分配到同地址）` })
    push({ act: 'buggy', op: 'cas', value: A, version: 1, t1Read: A, t1Ver: -1, casOk: casCheck(false, A, 1, A, -1), event: 'T1 CAS 误判成功 ✗', phase: 'run', focus: 'T1 恢复 CAS：期望 100、当前 100 → 误判成功',
      log: `**① 无版本 · T1 恢复做 CAS**\nT1 醒来，CAS 期望 = ${A}、当前值 = ${A} → **相等 → CAS 成功**！\n但这是**错的**：期间值被换过两次，T1 却毫不知情。在无锁栈里，这会把一个已经失效的节点当成有效的用 → 崩溃或数据错乱。**这就是 ABA。**` })

    // —— Act 2: fixed ——
    push({ act: 'fixed', op: 'read', value: A, version: 1, t1Read: A, t1Ver: 1, casOk: null, event: `T1 读到 (${A}, v1)`, phase: 'run', focus: '修复：给值配版本号。T1 读到 (100, v1)',
      log: `**② 加版本号 · T1 读**\n给共享值配一个只增不减的**版本号**。当前 = **(${A}, v1)**。\nT1 读到 (${A}, **v1**)，连版本一起记下，然后挂起。` })
    push({ act: 'fixed', op: 'change', value: B, version: 2, t1Read: A, t1Ver: 1, casOk: null, event: `T2: A→B，版本→v2`, phase: 'run', focus: 'T2 改 A→B，版本 +1 → v2',
      log: `**② 加版本号 · T2 改 A→B**\nT2 改值，**版本号 +1 → v2**。当前 = (${B}, v2)。` })
    push({ act: 'fixed', op: 'change', value: A, version: 3, t1Read: A, t1Ver: 1, casOk: null, event: `T2: B→A，版本→v3`, phase: 'run', focus: 'T2 改回 B→A，版本再 +1 → v3',
      log: `**② 加版本号 · T2 改回 B→A**\nT2 又改，**版本再 +1 → v3**。当前 = (${A}, v3)。\n值虽然绕回了 ${A}，但**版本回不去了**——这是关键。` })
    push({ act: 'fixed', op: 'cas', value: A, version: 3, t1Read: A, t1Ver: 1, casOk: casCheck(true, A, 3, A, 1), event: 'T1 CAS 正确失败 ✓', phase: 'done', focus: '修复成功：期望 (100,v1)、当前 (100,v3) → 版本不符 → 失败',
      log: `**② 加版本号 · T1 恢复做 CAS**\nT1 CAS 期望 = (${A}, **v1**)、当前 = (${A}, **v3**) → 值相等但**版本不符 → CAS 失败**！\nT1 于是知道"期间有人动过"，重新读取重试。ABA 被挡住了。\n\n**小结**：CAS 只比值会被 ABA 骗；配一个单调递增的版本号(stamp)、比 (值,版本) 一对，就能识破"绕一圈回来"。这就是 Java 的 **AtomicStampedReference**、无锁数据结构里的 tagged pointer。代价：多存一个版本号、CAS 变成双字比较。` })

    const base0: Frame = { act: 'intro', op: 'note', step: -1, value: A, version: 1, t1Read: -1, t1Ver: -1, casOk: null, event: '', phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'CAS 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
