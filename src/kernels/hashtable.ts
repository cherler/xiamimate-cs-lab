/**
 * 内核：散列表（数据结构）
 * 轴：step —— 每步是一次探查
 *
 * 四种处理冲突的办法：拉链 / 线性探测 / 平方探测 / 再散列。
 * 考点几乎都落在**平均查找长度 ASL** 上，所以每一步都把探查次数记下来，
 * 末态直接给出 ASL 成功 与 ASL 失败。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type HashState = {
  i: number
  /** 表：每个槽里的键列表（拉链法可能多个；开放定址最多一个） */
  table: number[][]
  /** 本步插入的键 */
  key: number
  /** 初始散列地址 */
  home: number
  /** 本步的探查序列（依次探过的槽号） */
  probes: number[]
  /** 最终落到哪个槽；−1 表示放不下 */
  slot: number
  /** 本次插入的比较次数 */
  compares: number
  /** 累计比较次数 */
  totalCompares: number
  /** 已插入个数 */
  count: number
  /** 是否发生冲突 */
  collided: boolean
  log: string
}

export const HASH_VISIBLE = [
  'i', 'table', 'key', 'home', 'probes', 'slot', 'compares',
  'totalCompares', 'count', 'collided', 'log',
] as const

export const hashKernel: Kernel<HashState> = {
  kind: 'hash',

  compile(doc: SimDocument): CompiledModel<HashState> {
    const size = num(doc.params, 'size')
    const method = str(doc.params, 'method')       // '拉链' | '线性探测' | '平方探测' | '再散列'
    const step2 = num(doc.params, 'rehashStep')    // 再散列的第二个散列函数步长
    const keys = (doc.streams.find(s => s.name === 'keys')?.values ?? []) as number[]

    const initial = (): HashState => ({
      i: -1, table: Array.from({ length: size }, () => []), key: 0, home: 0,
      probes: [], slot: -1, compares: 0, totalCompares: 0, count: 0, collided: false, log: '',
    })

    /** 第 j 次探查落在哪个槽 */
    const probeAt = (home: number, j: number) => {
      if (method === '线性探测') return (home + j) % size
      if (method === '平方探测') {
        //  ±1², ±2², ±3² … 的常见约定；这里用 +j² 的简化式并在边界取模
        const d = Math.pow(Math.ceil(j / 2), 2) * (j % 2 === 1 ? 1 : -1)
        return ((home + d) % size + size) % size
      }
      if (method === '再散列') return (home + j * Math.max(1, step2)) % size
      return home
    }

    return {
      axis: { kind: 'step', label: '插入序号' },
      initial,
      describe: s => s.log,

      step(prev) {
        const base = prev ?? initial()
        const i = base.i + 1
        if (i >= keys.length) return null

        const key = keys[i]
        const home = ((key % size) + size) % size
        //  状态必须自足：整张表深拷贝
        const table = base.table.map(x => [...x])
        const probes: number[] = []
        let slot = -1
        let compares = 0
        let collided = false
        let log: string

        if (method === '拉链') {
          probes.push(home)
          compares = table[home].length + 1
          collided = table[home].length > 0
          table[home].push(key)
          slot = home
          log = `插入 ${key}：H(${key}) = ${key} mod ${size} = ${home}`
            + (collided
              ? ` —— 该槽已有 ${table[home].length - 1} 个键，挂到链表末尾（第 ${compares} 个位置）`
              : ' —— 槽是空的，直接挂上')
        } else {
          for (let j = 0; j < size; j++) {
            const p = probeAt(home, j)
            probes.push(p)
            compares++
            if (table[p].length === 0) { slot = p; break }
            collided = true
          }
          if (slot >= 0) {
            table[slot].push(key)
            log = `插入 ${key}：H(${key}) = ${home}`
              + (collided
                ? ` 已被占用 → 按${method}依次探查 ${probes.join(' → ')}，第 ${compares} 次落在槽 ${slot}`
                : ` 空闲，一次探查成功`)
          } else {
            log = `插入 ${key}：探遍全表仍无空槽 —— 表已满，插入失败`
          }
        }

        return {
          state: {
            i, table, key, home, probes, slot, compares,
            totalCompares: base.totalCompares + compares,
            count: base.count + (slot >= 0 ? 1 : 0),
            collided, log,
          },
          done: i === keys.length - 1,
        }
      },
    }
  },
}

/**
 * 平均查找长度。
 * ASL成功 = 各元素的探查次数之和 ÷ 元素个数 —— 这正是逐步记录 compares 的原因。
 * ASL失败按"从每个初始地址出发，探到空槽为止"算，与教材口径一致。
 */
export function asl(table: number[][], size: number, method: string, step2 = 1) {
  const n = table.reduce((s, x) => s + x.length, 0)
  if (n === 0) return { success: 0, fail: 0 }

  let succ = 0
  if (method === '拉链') {
    for (const chain of table) for (let k = 0; k < chain.length; k++) succ += k + 1
  } else {
    //  开放定址：重新推一遍每个键的探查次数（不依赖插入历史，避免记账错）
    for (let s = 0; s < size; s++) {
      for (const key of table[s]) {
        const home = ((key % size) + size) % size
        for (let j = 0; j < size; j++) {
          const p = method === '线性探测' ? (home + j) % size
            : method === '平方探测'
              ? ((home + Math.pow(Math.ceil(j / 2), 2) * (j % 2 === 1 ? 1 : -1)) % size + size) % size
              : (home + j * Math.max(1, step2)) % size
          if (p === s) { succ += j + 1; break }
        }
      }
    }
  }

  let fail = 0
  for (let h = 0; h < size; h++) {
    if (method === '拉链') { fail += table[h].length + 1; continue }
    let j = 0
    while (j < size) {
      const p = method === '线性探测' ? (h + j) % size
        : method === '平方探测'
          ? ((h + Math.pow(Math.ceil(j / 2), 2) * (j % 2 === 1 ? 1 : -1)) % size + size) % size
          : (h + j * Math.max(1, step2)) % size
      j++
      if (table[p].length === 0) break
    }
    fail += j
  }

  return { success: succ / n, fail: fail / size }
}
