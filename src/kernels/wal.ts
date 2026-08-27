/**
 * 内核：预写日志 WAL（后端 · 数据库持久性）
 * 轴：step —— 改数据前先写日志；崩溃后靠重放日志恢复
 *
 * 数据库怎么保证「已提交的写不会因为宕机而丢」(持久性 D)?**WAL(Write-Ahead Log)**:任何对数据的修改,
 * **先把这条操作顺序追加到日志(fsync 落盘),再去改数据页**。日志是顺序写(快),数据页可以攒着慢慢刷。
 * 崩溃后重启:扫一遍日志,把「记了但没落到数据页」的操作**重放**一遍,数据就恢复到崩溃前的已提交状态。
 * 顺带把随机写变顺序写,性能也上去了。几乎所有数据库(MySQL redo log、PostgreSQL WAL、etcd)都用它。
 *
 * 本例:写 x=5(先日志后应用)、写 x=8(只写了日志就崩溃)→ 重启重放日志,x 恢复成 8。值可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type WALState = {
  i: number
  step: number
  data: number           // 数据页里的 x
  wal: string[]          // 日志条目
  applied: number        // 已应用到数据页的日志条数
  act: string            // 'log'|'apply'|'crash'|'replay'|'done'
  crashed: boolean
  phase: 'run' | 'done'
  log: string
}

export const WAL_VISIBLE = ['step', 'data', 'wal', 'applied', 'act', 'crashed', 'phase', 'log'] as const

type Frame = Omit<WALState, 'i'>

export const walKernel: Kernel<WALState> = {
  kind: 'wal',
  compile(_doc: SimDocument): CompiledModel<WALState> {
    const frames: Frame[] = []
    let data = 0, applied = 0
    const wal: string[] = []
    const snap = (act: string, crashed: boolean, log: string) => frames.push({
      step: frames.length, data, wal: [...wal], applied, act, crashed, phase: 'run', log,
    })
    wal.push('SET x=5'); snap('log', false, `写 x=5：**先追加日志** "SET x=5" 并 fsync 落盘(此刻数据页还没动，x=${data})。`)
    data = 5; applied = 1; snap('apply', false, `**再改数据页**：x=5。日志在前、数据在后——这就是"预写"。`)
    wal.push('SET x=8'); snap('log', false, `写 x=8：先追加日志 "SET x=8" 并落盘(数据页仍是 x=${data})。`)
    snap('crash', true, `💥 **宕机!** 就在日志已落盘、数据页还没改到 x=8 的时候。数据页停在 x=${data}，但日志里记着 x=8。`)
    data = 8; applied = 2; snap('replay', false, `重启恢复：扫日志，发现 "SET x=8" 记了但没应用 → **重放**它 → 数据页 x=8。已提交的写没丢!`)
    frames.push({
      step: frames.length, data, wal: [...wal], applied, act: 'done', crashed: false, phase: 'done',
      log: `**恢复完成**：x=${data}，崩溃前记入日志的写全部还在。WAL 的铁律是「先日志后数据」：只要日志落了盘，哪怕数据页没刷、机器宕机，重放日志就能补上——这就是持久性(D)。顺带把随机写变顺序写,还提了速。MySQL redo log、PG WAL、etcd 都靠它。`,
    })
    const base0: Frame = { step: -1, data: 0, wal: [], applied: 0, act: '', crashed: false, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
