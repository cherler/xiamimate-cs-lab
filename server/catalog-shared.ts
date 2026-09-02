/**
 * 出题目录的**共享底座**——类型 + 通用干扰项 + 小工具。
 *
 * 为什么单独一个文件：catalog.ts 主表已经很大，新实验的 facts 按职业线拆成
 * server/catalog/*.ts 分片文件各自维护（互不冲突、各自可 probe 验证），
 * 再由 catalog.ts 汇总进 CATALOG。分片和主表都从这里拿类型与工具，保证结构一致。
 *
 * 焊死纪律不变：每个 fact 的 compute 必须**从引擎 trace 真算**，不是问大模型来的；
 * 分片的 doc 必须和 web/src/registry.ts 里该实验的默认 doc 一致，否则出题答案对不上页面。
 */
import { run } from '../src/core/kernel.ts'
import type { Kernel, CompiledModel } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'

// trace 的一帧就是内核的可见状态；出题只读字段，用宽松类型即可。
export type Frame = Record<string, unknown>

export type Fact = {
  id: string
  /** 喂给大模型的内部描述：这道题在考什么。 */
  label: string
  /** 保底题面：大模型不可用时直接用它，保证功能不依赖模型也能出题。 */
  ask: string
  kind: 'number' | 'choice'
  /** 从引擎 trace 算出钉死答案 + 出处（第几帧 + 该帧证据文字）。 */
  compute: (trace: Frame[]) => { answer: string; step: number; evidence: string }
  /** 生成干扰项（错误选项）。数值题按扰动，选择题按同类其它取值。 */
  distractors: (answer: string, trace: Frame[]) => string[]
}

export type CatalogEntry = {
  id: string
  title: string
  kernel: Kernel<unknown>
  doc: SimDocument
  facts: Fact[]
}

// ── 数值题通用干扰项 ──
// 整数答案：±1/±2/±3（计数不为负，去负）。
// 小数答案：按 ±10/20/30% 相对扰动，四舍五入到答案本身的小数位——避免 0.664±1 这种既离谱又露馅、
//   以及 IEEE 浮点噪声（1.6640000000000001）；相对扰动同号，负数答案也不会"只有正确项是负的"而露馅。
export function numDistractors(answer: string): string[] {
  const a = Number(answer)
  if (!Number.isFinite(a)) return []
  const decs = (answer.split('.')[1] ?? '').length
  const isInt = decs === 0
  const fmt = (v: number) => (isInt ? String(Math.round(v)) : v.toFixed(decs))
  let deltas: number[]
  if (a === 0) deltas = isInt ? [1, 2, 3] : [Math.pow(10, -decs), 2 * Math.pow(10, -decs), 3 * Math.pow(10, -decs)]
  else if (isInt) deltas = [1, -1, 2, -2, 3]
  else deltas = [0.1, -0.1, 0.2, -0.2, 0.3].map(f => a * f)  // 相对扰动：±10/20/30%
  const seen = new Set<string>([answer]); const out: string[] = []
  for (const d of deltas) {
    const v = a + d
    if (isInt && a >= 0 && v < 0) continue // 非负整数多是计数，去负；答案本身为负(如点积)则允许负干扰项
    const s = fmt(v)
    if (seen.has(s) || Number(s) === a) continue
    seen.add(s); out.push(s)
    if (out.length >= 3) break
  }
  return out
}

// 与 registry 对应的最简 doc：内核自带默认数据、不读 params/entities 时用它。
export const trivialDoc = (kind: string): SimDocument => ({ kind, params: {}, entities: [], streams: [] })

// trace 末帧（终态）。
export const last = (t: Frame[]) => t[t.length - 1]!

/** 跑内核得到确定性 trace——分片文件的 probe 脚本用它自检 facts。 */
export function traceOfDoc(kernel: Kernel<unknown>, doc: SimDocument): Frame[] {
  const model = kernel.compile(doc) as CompiledModel<Frame>
  return run(model)
}

export type { Kernel, SimDocument, CompiledModel }
