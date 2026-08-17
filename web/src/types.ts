/**
 * 视图层的可插拔契约 —— 内核接口在视图侧的对应物。
 *
 * 共享的：布局、轴、逐步日志、参数面板、读数栏、边界栏
 * 每个实验自带的：舞台（Stage）、参数规格、读数计算、语义色、轴上的量
 *
 * 加一个新实验 = 往注册表里加一条，宿主框架一行不用改。
 */
import type { FC } from 'react'
import type { SimDocument } from '@engine/core/document.ts'
import type { Kernel } from '@engine/core/kernel.ts'

/** 参数面板的一项 —— 只给离散选项，避免自由输入产生非法配置 */
export type ParamSpec =
  | { key: string; label: string; kind: 'number'; options: number[]; unit?: string }
  | { key: string; label: string; kind: 'enum'; options: string[] }

/**
 * 语义色的键必须是领域中性的。
 * 曾经用过 'hit'|'miss'，结果调度实验的日志里每步都写着"命中" ——
 * 那是 Cache 的词汇，跨内核不成立。色用中性键，文案各实验自己给。
 */
export type ToneKey = 'good' | 'bad' | 'idle'
export type Tone = { key: ToneKey; label: string }

export type Readout = { label: string; value: string; tone?: ToneKey }

export type ViewTab = { id: string; label: string }

export type StageProps<S> = {
  doc: SimDocument
  trace: S[]
  index: number
  state: S
  tab: string
}

export interface Experiment<S = never> {
  id: string
  group: string
  title: string
  subtitle: string

  kernel: Kernel<S>
  defaultDoc: SimDocument
  params: ParamSpec[]

  /** 内容标准 #2：诚实标注失真范围 */
  bounds: string[]

  tabs: ViewTab[]
  Stage: FC<StageProps<S>>

  readouts: (s: S, doc: SimDocument, i: number) => Readout[]

  /** 每步的语义色 + 该领域对这一步的说法（"命中"/"运行"/"丢包"…） */
  tone: (s: S) => Tone
  /** 每步的"量"（0..1）—— 轴上的柱高用它。命中/缺失不是量，滚动命中率才是。 */
  metric: (s: S, i: number) => number
  /** 轴的刻度标签（可选） */
  tickLabel?: (s: S, i: number) => string
}

/** 存在注册表里时擦掉状态泛型，避免到处写 unknown */
export type AnyExperiment = Experiment<never>
