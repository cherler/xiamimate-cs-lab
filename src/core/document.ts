/**
 * 文档层 —— 流水线的入口。
 *
 * 形状受结构化输出的 JSON Schema 能力限制（见 docs/decisions/0002-dsl-shape.md）：
 *   不能递归 · 不能有数值约束 · 不能有字符串约束
 * 所以：深度固定，范围规则一律交给验证器。
 */

/** 扁平标量表 —— 结构化输出最友好的形状 */
export type Attrs = Record<string, number | string | boolean>

/**
 * 实体：带属性的记录。
 * `at` 是时间锚点（进程到达时刻 / 丢包发生轮次），省略表示常驻。
 */
export type Entity = {
  id: string
  /** 领域自定义：'process' | 'loss' | 'gate' | ... */
  type: string
  at?: number
  attrs: Attrs
}

/**
 * 流：密集位置数据，下标即步号。
 *
 * 为什么不用 Entity 表达：1000 条地址访问写成 1000 个 Entity 会把 JSON 撑爆，
 * 而且每项没有独立元数据。这个二分是被数据逼出来的，不是预设的
 * （见 logs/2026-08-17-phase0.md）。
 */
export type Stream = {
  name: string
  values: (number | string)[]
}

/** 接缝 1 的输入 —— 所有实验、所有领域都是这一个形状 */
export type SimDocument = {
  kind: string
  params: Attrs
  entities: Entity[]
  streams: Stream[]
}

/** 轴（接缝 4）—— 时间只是其中一种 */
export type AxisSpec = {
  kind: 'time' | 'step' | 'parameter' | 'depth'
  label: string
  unit?: string
}

/** 便捷取值：DSL 里全是 Attrs，取的时候要窄化 */
export const num = (a: Attrs, k: string): number => {
  const v = a[k]
  if (typeof v !== 'number') throw new Error(`params.${k} 期望 number，实际 ${typeof v}`)
  return v
}

export const str = (a: Attrs, k: string): string => {
  const v = a[k]
  if (typeof v !== 'string') throw new Error(`params.${k} 期望 string，实际 ${typeof v}`)
  return v
}
