/**
 * 内核契约 + 执行器。
 *
 * 宿主框架的全部职责就是 run()：反复调 step()，攒成轨迹。
 * step() 内部做什么是内核的私事 —— 查表、状态转移、还是四阶龙格库塔，框架不关心。
 * 这就是"内核可插拔"（验收标准 5）的实际含义。
 */
import type { SimDocument, AxisSpec } from './document.ts'

export type StepResult<S> = { state: S; done: boolean }

export interface CompiledModel<S> {
  axis: AxisSpec
  /** 零号状态。step(null) 时的兜底基准，本身不进轨迹。 */
  initial(): S
  /**
   * 从 prev 推出下一个状态。返回 null 表示轨迹结束。
   *
   * 铁律（验收标准 2）：只能读 prev，不许读闭包里的可变状态。
   * 状态必须自足到"JSON 往返之后还能续跑"。
   */
  step(prev: S | null): StepResult<S> | null
  /** 逐步文字日志 —— 内容标准第 3 条，CS 相对物理的独有优势 */
  describe(s: S): string
}

export interface Kernel<S> {
  kind: string
  /**
   * 接缝 1。
   * 408 阶段近乎恒等映射；手搓 CPU 阶段变成网表提取 + 拓扑排序。
   * 上下游不因此改动 —— 这是它存在的全部理由。
   */
  compile(doc: SimDocument): CompiledModel<S>
}

/** 执行器：跑出完整轨迹 */
export function run<S>(model: CompiledModel<S>, maxSteps = 100_000): S[] {
  const trace: S[] = []
  let prev: S | null = null
  for (let i = 0; i < maxSteps; i++) {
    const r = model.step(prev)
    if (r === null) break
    trace.push(r.state)
    prev = r.state
    if (r.done) break
  }
  return trace
}

/**
 * 从任意中间状态续跑 —— 时间轴 scrub、分享链接、断点续做共用这条。
 * 同时是验收标准 2 的实测入口。
 */
export function resume<S>(model: CompiledModel<S>, from: S, maxSteps = 100_000): S[] {
  const trace: S[] = []
  let prev: S = from
  for (let i = 0; i < maxSteps; i++) {
    const r = model.step(prev)
    if (r === null) break
    trace.push(r.state)
    prev = r.state
    if (r.done) break
  }
  return trace
}
