/**
 * 内核：跳表 Skip List（后端 · Redis 有序集合的底子）
 * 轴：step —— 多层链表里查一个值，从高层"快车道"往下逐层逼近
 *
 * 有序链表查一个数要一个个走 O(n)。跳表给它加**多层索引**:底层是完整有序链表,上面每层随机挑一部分
 * 节点建"快车道"。查找从最高层开始:能往右就往右(下一个还 ≤ 目标),到头了就**下一层**,层层逼近,
 * 平均 O(log n)——用空间换时间,还比平衡树好写(插入不用旋转)。Redis 的 zset、LevelDB 的 memtable 都用它。
 *
 * 本例三层跳表查 7:从顶层出发,右不动就下沉,层层逼近→命中。走过的路可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type SkipListState = {
  i: number
  step: number
  levels: number[][]     // 每层的值（从高到低）
  target: number
  level: number          // 当前所在层（索引到 levels）
  val: number            // 当前节点值
  act: string            // 'right'|'down'|'found'|'done'
  compares: number
  path: { level: number; val: number }[]
  phase: 'run' | 'done'
  log: string
}

export const SKIPLIST_VISIBLE = ['step', 'levels', 'target', 'level', 'val', 'act', 'compares', 'path', 'phase', 'log'] as const

type Frame = Omit<SkipListState, 'i'>
//  levels[0] 是最高层
const LEVELS = [[1, 9], [1, 5, 9, 11], [1, 3, 5, 7, 9, 11]]
const TARGET = 7

export const skiplistKernel: Kernel<SkipListState> = {
  kind: 'skiplist',
  compile(_doc: SimDocument): CompiledModel<SkipListState> {
    const frames: Frame[] = []
    let level = 0, val = 1, compares = 0
    const path: { level: number; val: number }[] = [{ level, val }]
    const push = (act: string, log: string) => frames.push({
      step: frames.length, levels: LEVELS, target: TARGET, level, val, act, compares, path: path.map(p => ({ ...p })), phase: 'run', log,
    })
    push('start', `从**最高层**、最左节点 ${val} 出发，找 ${TARGET}。`)
    let guard = 0
    while (guard++ < 30) {
      const row = LEVELS[level]!
      const idx = row.indexOf(val)
      const next = row[idx + 1]
      compares++
      if (next !== undefined && next <= TARGET) {
        val = next
        path.push({ level, val })
        push('right', `本层下一个是 ${next} ≤ ${TARGET} → **往右走**到 ${next}。`)
        if (val === TARGET) { push('found', `到达 ${TARGET} —— **命中**!`); break }
      } else if (level < LEVELS.length - 1) {
        level++
        path.push({ level, val })
        push('down', `本层右边${next === undefined ? '到头了' : `是 ${next} > ${TARGET}`} → **下一层**（在 ${val} 处下降）。`)
      } else {
        push('found', val === TARGET ? `**命中** ${TARGET}!` : `到底了，${TARGET} 不存在。`)
        break
      }
    }
    const lf = frames[frames.length - 1]!
    frames.push({
      ...lf, act: 'done', phase: 'done',
      log: `**查找完成**：找到 ${TARGET}，只比较了 ${compares} 次(而单层链表要一个个走)。跳表用高层"快车道"跳过大段节点——右不动就下沉，平均 O(log n)。Redis zset、LevelDB memtable 都用它，比平衡树好写(插入靠抛硬币定层数，不用旋转)。`,
    })
    const base0: Frame = { step: -1, levels: LEVELS, target: TARGET, level: 0, val: 1, act: 'start', compares: 0, path: [{ level: 0, val: 1 }], phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '走一步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
