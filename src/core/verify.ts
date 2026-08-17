/**
 * 验证器 —— 这是护城河，不是仿真。
 *
 * 四种比较器，强度递减。比较器的强度直接决定 L3（AI 生成新原语）的天花板：
 *   exact      408：命中/缺失、淘汰序、调度顺序 —— 闸最严，L3 最有机会
 *   tolerance  机器人：末端位姿、关节角
 *   structural 编辑域：网表拓扑、DRC
 *   property   IK 多解、RRT 随机路径 —— 闸最松，L3 天花板最低
 */

export type Violation = {
  severity: 'error' | 'warn'
  location: string
  message: string
  expected?: unknown
  actual?: unknown
}

export type Comparator =
  | { kind: 'exact' }
  | { kind: 'tolerance'; eps: number }
  | { kind: 'structural'; key: (x: unknown) => string }
  | { kind: 'property'; check: (trace: unknown[]) => Violation[] }

const MAX_REPORTED = 5

export function compareTraces(
  actual: unknown[],
  expected: unknown[],
  cmp: Comparator,
  label = 'trace',
): Violation[] {
  if (cmp.kind === 'property') return cmp.check(actual)

  const out: Violation[] = []

  if (actual.length !== expected.length) {
    out.push({
      severity: 'error',
      location: `${label}.length`,
      message: '轨迹长度不一致',
      expected: expected.length,
      actual: actual.length,
    })
  }

  const n = Math.min(actual.length, expected.length)
  for (let i = 0; i < n; i++) {
    const a = actual[i]
    const e = expected[i]
    let same: boolean
    switch (cmp.kind) {
      case 'exact':      same = JSON.stringify(a) === JSON.stringify(e); break
      case 'tolerance':  same = numericClose(a, e, cmp.eps); break
      case 'structural': same = cmp.key(a) === cmp.key(e); break
    }
    if (!same) {
      out.push({
        severity: 'error',
        location: `${label}[${i}]`,
        message: '该步状态与参考实现不一致',
        expected: e,
        actual: a,
      })
      if (out.length >= MAX_REPORTED) break
    }
  }
  return out
}

/** 递归容差比较：数字比 eps，其余比相等 */
function numericClose(a: unknown, b: unknown, eps: number): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= eps
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  return ka.every(k => numericClose((a as never)[k], (b as never)[k], eps))
}

/** 只取轨迹的"可见字段" —— 内部重放状态不参与比对 */
export function visible<T extends object>(o: T, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter(k => k in o).map(k => [k, (o as never)[k]]))
}
