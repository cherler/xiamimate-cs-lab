/**
 * 内核：参数扫描（parameter 轴）
 *
 * 这是个高阶内核 —— 它包住另一个内核，每"步"跑一整轮内层仿真，
 * 把汇总结果作为该步的状态。命中率随组数变化的曲线就是这么来的。
 *
 * 它同时是对"step() 内部是内核的私事"这条设计的压力测试：
 * 如果 step() 里能跑一整个子仿真而框架无感，那这条抽象就是真的。
 */
import type { SimDocument, Attrs } from '../core/document.ts'
import { str } from '../core/document.ts'
import { run, type Kernel, type CompiledModel } from '../core/kernel.ts'

export type SweepState<Inner> = {
  i: number
  /** 本轮被扫描的参数值 */
  value: number | string
  /** 内层轨迹的长度 */
  steps: number
  /** 内层末态 —— 汇总指标从这里取 */
  final: Inner
  log: string
}

export const SWEEP_VISIBLE = ['i', 'value', 'steps', 'log'] as const

/**
 * 造一个扫描内核。
 *
 * 约定：
 *   doc.params.sweepParam  被扫描的参数名
 *   doc.streams['sweepValues']  要扫的值列表
 *   其余 params / entities / streams 原样传给内层
 */
export function makeSweepKernel<S>(
  inner: Kernel<S>,
  summarize: (finalState: S, steps: number) => string,
): Kernel<SweepState<S>> {
  return {
    kind: `sweep:${inner.kind}`,

    compile(doc: SimDocument): CompiledModel<SweepState<S>> {
      const sweepParam = str(doc.params, 'sweepParam')
      const values = doc.streams.find(s => s.name === 'sweepValues')?.values ?? []

      /** 接缝 1 在这里被真正拉伸了一次：由外层 doc 派生出 N 个内层 doc */
      const innerDocFor = (v: number | string): SimDocument => {
        const params: Attrs = { ...doc.params, [sweepParam]: v }
        delete params.sweepParam
        return {
          kind: inner.kind,
          params,
          entities: doc.entities,
          streams: doc.streams.filter(s => s.name !== 'sweepValues'),
        }
      }

      return {
        axis: { kind: 'parameter', label: sweepParam },

        initial: () => ({
          i: -1,
          value: 0,
          steps: 0,
          final: null as never,
          log: '',
        }),

        describe: s => s.log,

        step(prev) {
          const base = prev ?? this.initial()
          const i = base.i + 1
          if (i >= values.length) return null

          const value = values[i]
          // ← 这一步跑了一整个内层仿真，外层框架完全无感
          const trace = run(inner.compile(innerDocFor(value)))
          const final = trace[trace.length - 1]

          return {
            state: {
              i,
              value,
              steps: trace.length,
              final,
              log: `${sweepParam}=${value} → ${summarize(final, trace.length)}`,
            },
            done: i === values.length - 1,
          }
        },
      }
    },
  }
}
