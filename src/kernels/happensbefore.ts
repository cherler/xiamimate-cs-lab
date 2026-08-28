/**
 * 内核：happens-before / 内存可见性 —— 无同步时，一个线程的写另一个线程不一定按序看见（后端 · 并发编程）
 * 轴：step —— 经典 flag/data 例子：无 volatile 会读到旧值，volatile 建立 happens-before 修复
 *
 * 多线程共享变量时，一个线程写了，另一个线程**不一定马上、按顺序**看得见——因为：
 *   · 编译器/CPU 会**重排**指令（只要单线程看起来没变）；· 值可能停在**缓存**里没刷到主存。
 * 经典例子：writer 先 data=42 再 ready=true；reader 见到 ready==true 就去读 data。
 *   无同步：ready=true 可能先于 data=42 生效（重排），或 data 的新值还没让 reader 看见（可见性）
 *           → reader 读到 **data=0**（旧值），bug。
 *   修复：把 ready 声明 **volatile**，就建立了 **happens-before**：volatile 写会把之前所有写刷出(释放屏障)，
 *         volatile 读会拿到最新(获取屏障)。于是"data=42 先于 reader 读 data"被保证 → 读到 42。
 * 值:两幕对照(读到0 vs 读到42),规则确定,可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type HBState = {
  i: number
  step: number
  act: 'intro' | 'plain' | 'volatile'
  who: 'writer' | 'reader' | ''
  data: number             // writer 写进 data 的值（主存/理论值）
  ready: boolean
  isVolatile: boolean
  readerData: number       // reader 实际读到的 data（-1 未读，0 旧值，42 新值）
  hazard: boolean          // 本步是否暴露了可见性/重排风险
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<HBState, 'i'>

export const happensbeforeKernel: Kernel<HBState> = {
  kind: 'happensbefore',
  compile(_doc: SimDocument): CompiledModel<HBState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step'>) => frames.push({ step: frames.length, ...f })

    push({ act: 'intro', who: '', data: 0, ready: false, isVolatile: false, readerData: -1, hazard: false, phase: 'run', focus: '一个线程写了，另一个不一定按序、及时看见',
      log: `**内存可见性 & 重排**\n多线程共享变量：一个线程写了，另一个**不一定马上、按顺序**看得见。原因：\n· 编译器/CPU 会**重排**指令（单线程看起来没变就行）；\n· 新值可能停在**缓存**里，没刷到主存让别人看见。\n经典例子：writer 先 \`data=42\` 再 \`ready=true\`；reader 见 \`ready==true\` 就去读 data。先看无同步会怎样。` })

    // Act 1: plain
    push({ act: 'plain', who: 'writer', data: 42, ready: false, isVolatile: false, readerData: -1, hazard: false, phase: 'run', focus: '① 无 volatile · writer 写 data=42',
      log: `**① 无同步 · writer 第 1 步**\nwriter 执行 \`data = 42\`。（但这个新值现在可能还在 writer 的缓存里）` })
    push({ act: 'plain', who: 'writer', data: 42, ready: true, isVolatile: false, readerData: -1, hazard: true, phase: 'run', focus: '① writer 写 ready=true —— 但可能先于 data 生效',
      log: `**① 无同步 · writer 第 2 步**\nwriter 执行 \`ready = true\`。\n⚠ 没有任何屏障：这条**可能被重排到 data=42 之前**生效，或者 ready 先刷出去、data 还没刷——两条写的顺序对 reader **不保证**。` })
    push({ act: 'plain', who: 'reader', data: 42, ready: true, isVolatile: false, readerData: 0, hazard: true, phase: 'run', focus: '① reader 看到 ready=true，却读到 data=0（旧值！）',
      log: `**① 无同步 · reader**\nreader 看到 \`ready==true\`，于是去读 data……**读到 0**（旧值）！\n因为 ready 的新值先被看见、而 data=42 要么被重排到后面、要么还没同步过来。**这就是可见性/重排 bug**——偶发、极难复现、极难查。` })

    // Act 2: volatile
    push({ act: 'volatile', who: '', data: 0, ready: false, isVolatile: true, readerData: -1, hazard: false, phase: 'run', focus: '② 把 ready 声明 volatile → 建立 happens-before',
      log: `**② 修复 · 把 ready 声明 volatile**\n\`volatile boolean ready\`。这建立了 **happens-before** 关系：\n· volatile **写**（ready=true）= 释放屏障：把它**之前**的所有写(data=42)都刷出去；\n· volatile **读**（读 ready）= 获取屏障：拿到最新，并禁止把后面的读提前。` })
    push({ act: 'volatile', who: 'writer', data: 42, ready: true, isVolatile: true, readerData: -1, hazard: false, phase: 'run', focus: '② writer：data=42 → ready=true（volatile 写带屏障）',
      log: `**② 修复 · writer**\nwriter 执行 \`data=42\`，再 \`ready=true\`(volatile 写)。\n屏障保证：data=42 一定排在 ready=true **之前**生效、且被刷到主存。` })
    push({ act: 'volatile', who: 'reader', data: 42, ready: true, isVolatile: true, readerData: 42, hazard: false, phase: 'done', focus: '② reader：读到 ready=true → data 保证是 42',
      log: `**② 修复 · reader**\nreader 读 \`ready\`(volatile 读)==true → 再读 data = **42** ✅。\n因为 happens-before：\`data=42\` 先于 \`ready=true\`(程序序)、\`ready=true\` 先于 reader 读到它(volatile)、reader 读 ready 先于读 data(程序序) → 传递出 **data=42 先于 reader 读 data**，必看见 42。\n\n**小结**：多线程下"写了就能看见"是错觉。要靠 **happens-before** 才有可见性 + 有序性保证——volatile、synchronized/锁、final、线程 start/join、原子类都能建立它。这就是 Java 内存模型(JMM)的核心，也是"为什么加个 volatile 就好了"的原理。` })

    const base0: Frame = { act: 'intro', step: -1, who: '', data: 0, ready: false, isVolatile: false, readerData: -1, hazard: false, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '执行步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
