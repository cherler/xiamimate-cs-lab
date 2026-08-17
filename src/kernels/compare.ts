/**
 * 内核：并排对比（L2 组合原语）
 *
 * 跟 sweep 的区别：
 *   sweep   每个扫描点只取末态汇总，轴变成 parameter —— 产出曲线
 *   compare 保留 N 条完整轨迹，轴保持内层的 step/time —— 产出对齐播放
 *
 * 408 真题里"分别采用 X 和 Y，比较…"是高频题型，这是它的原语。
 * 教学价值在"拖时间轴，同时看两种策略在这一步各自做了什么"。
 *
 * 文档形状复用 SimDocument，没有新增顶层概念：
 *   params.varyParam        被对比的参数名
 *   streams['variants']     要对比的取值列表
 *   其余原样传给内层
 */
import type { SimDocument, Attrs } from '../core/document.ts'
import { str } from '../core/document.ts'
import { run, type Kernel, type CompiledModel } from '../core/kernel.ts'

export type Lane<Inner> = {
  label: string
  /** 该道已经跑完则为 null —— 各道长度可以不一样 */
  state: Inner | null
}

export type CompareState<Inner> = {
  i: number
  lanes: Lane<Inner>[]
  log: string
}

export const COMPARE_VISIBLE = ['i', 'log'] as const

export function makeCompareKernel<S>(
  inner: Kernel<S>,
  describeLane: (label: string, s: S) => string,
): Kernel<CompareState<S>> {
  return {
    kind: `compare:${inner.kind}`,

    compile(doc: SimDocument): CompiledModel<CompareState<S>> {
      const varyParam = str(doc.params, 'varyParam')
      const variants = (doc.streams.find(s => s.name === 'variants')?.values ?? []) as (string | number)[]

      /** 接缝 1：由一份外层 doc 派生出 N 份内层 doc */
      const innerDocFor = (v: string | number): SimDocument => {
        const params: Attrs = { ...doc.params, [varyParam]: v }
        delete params.varyParam
        return {
          kind: inner.kind,
          params,
          entities: doc.entities,
          streams: doc.streams.filter(s => s.name !== 'variants'),
        }
      }

      // compile 时把 N 条都跑完，step 时按步号切片。
      // 这样 step 仍然只依赖 prev.i，确定性重放不受影响。
      const traces: S[][] = variants.map(v => run(inner.compile(innerDocFor(v))))
      const maxLen = Math.max(0, ...traces.map(t => t.length))
      const innerAxis = inner.compile(innerDocFor(variants[0] ?? 0)).axis

      return {
        axis: innerAxis,   // 轴跟内层一致 —— 这正是 compare 与 sweep 的分野

        initial: () => ({ i: -1, lanes: [], log: '' }),

        describe: s => s.log,

        step(prev) {
          const base = prev ?? this.initial()
          const i = base.i + 1
          if (i >= maxLen) return null

          const lanes: Lane<S>[] = variants.map((v, k) => ({
            label: `${varyParam}=${v}`,
            state: traces[k][i] ?? null,
          }))

          const log = lanes
            .map(l => (l.state === null ? `${l.label}: —` : describeLane(l.label, l.state)))
            .join('  │  ')

          return { state: { i, lanes, log }, done: i === maxLen - 1 }
        },
      }
    },
  }
}
