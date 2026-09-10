/**
 * 视图层的可插拔契约 —— 内核接口在视图侧的对应物。
 *
 * 共享的：布局、轴、逐步日志、参数面板、读数栏、边界栏
 * 每个实验自带的：舞台（Stage）、参数规格、读数计算、语义色、轴上的量
 *
 * 加一个新实验 = 往注册表里加一条，宿主框架一行不用改。
 */
import type { FC } from 'react'
import type { SimDocument, Entity } from '@engine/core/document.ts'
import type { Preset } from '@engine/presets/sequences.ts'
import type { EntityPreset } from '@engine/presets/entities.ts'
import type { Kernel } from '@engine/core/kernel.ts'

/** 参数面板的一项 —— 只给离散选项，避免自由输入产生非法配置 */
/**
 * 一个参数什么时候才起作用。不写 = 一直起作用。
 *
 * **`note` 是必填的**，而且这是故意的：一个变灰的旋钮不说明理由，跟坏了没区别。
 * 把条件和解释绑成一个字段，就没法"只加条件不写理由"。
 *
 * 为什么变灰而不是隐藏：隐藏会让面板在切算法时跳来跳去，而且用户会找"那个参数哪去了"；
 * 变灰还顺带教一件事 —— 这个旋钮属于哪一族算法。
 */
export type ParamWhen = {
  on: (params: Record<string, unknown>) => boolean
  /** 什么时候才生效，一句话：「仅 SCAN / C-SCAN / LOOK 生效」 */
  note: string
}

/**
 * `syncs` 的返回值：改一个参数时，顺带要跟着调的东西。
 *
 * 三块都可省。三块都不给就返回 `null`（表示"这次不用联动"）。
 */
export type SyncResult = {
  /** 要覆盖的别的参数 */
  params?: Record<string, number | string>
  /** 要换掉的流（键 = 流名，如 `operands` / `virtualAddresses`） */
  streams?: Record<string, (number | string)[]>
  /** 要换掉的实体表（页表项、丢包事件…）。整张换，不做逐行合并。 */
  entities?: Entity[]
}

export type ParamSpecBase = {
  when?: ParamWhen
  /**
   * 改这个参数时，**顺带把别的参数一起调到合法值**。返回要覆盖的那几项。
   *
   * ## 为什么需要它
   *
   * 有些参数不是自由选择，是被另一个参数定死的。ARQ 的「协议」换成
   * 停止等待时，发送窗口只能是 1 —— 而默认是 4，于是一按 SW 就撞上
   * 「配置不合法 · 停止等待的窗口只能是 1」，一屏什么都不剩。
   *
   * 内核那条校验是对的，不该拿掉；错的是**让人先撞了才知道**。
   * `when` 只能把那个旋钮标灰（它还留着旧值），所以另外需要这一手。
   *
   * 只写"物理上必须如此"的联动，别拿它做"我觉得这样搭配更好看"的推荐 ——
   * 那会把用户刚调好的值悄悄改掉。
   *
   * ## 为什么它还要能换预置数据（2026-09-10 扩的）
   *
   * 原来它只能改**参数**。可实测撞到的四处「一点就把整屏清空」里，
   * 有三处的冲突方根本不在参数里，而在**用户也能编辑的流 / 表格数据**上：
   *   · IEEE 754「做什么 = 加/减」—— 要 2 个操作数，而预置只有 1 个（流）
   *   · 虚地址「12 位」—— 页号只剩 0..3，而预置页表里有 ≥4 号页（表格）
   *   · TCP「模拟轮数 = 12」—— 而丢包事件写在第 13 轮（表格）
   *
   * 我先试过只改参数那一手（给虚地址两边挂 syncs 让页大小自动降到 1KB）——
   * **参数确实联动了，可还是不合法**，因为真正拦路的是页表。那一手只做到了
   * 「悄悄改掉用户刚调好的页大小、问题一点没修」，已撤回。
   *
   * 所以返回值扩成三块。**只有这一个调用点会写它们**，跟用户在序列编辑器 /
   * 表格里的编辑走同一个 store，不会像 `stream` 选择器那样把用户的编辑盖掉
   * （那条在 App.tsx 里排在 seqLive 之后，每次重算都覆盖一遍）。
   *
   * 第三个参数是**当前这份 doc**（含用户已经改过的流与表格）。没有它就只能盲写：
   * 比如浮点从「编码」换到「加」时该补一个操作数，可用户要是已经填了两个，
   * 再补就把他的第二个覆盖了。**要判断"现在够不够"，就得看得见现在是什么。**
   */
  syncs?: (v: number | string, params: Record<string, unknown>, doc: SimDocument) => SyncResult | null
  /**
   * 这个参数不是仿真的输入，而是**在几条现成的流之间做选择**。
   * 选中之后由 App 把对应的数据写进那条流 —— 内核读到的仍然只有流。
   *
   * ## 为什么要多这一层
   *
   * 信号量实验的三条调度序列里，只有第一条能进 `defaultDoc`，
   * 另外两条（唯二能演出阻塞的）界面上**根本够不着** ——
   * 于是它副标题写的「顺序错了会死锁」在产品里演示不出来。
   *
   * 直接让内核去认参数里的名字也能通，但那样同一件事就有了两个出处：
   * 参数说「消费者先跑」、流里还存着「交替执行」，
   * 而校验器要求那条流必须在。**一个真源**：参数只当选择器，数据仍在流里。
   */
  stream?: { name: string; values: (v: never) => (number | string)[] }
  /** 选项按钮上印什么。不给就印值本身 —— `1 / -1` 这种内部编码要给 */
  optionLabel?: (v: never) => string
}

export type ParamSpec =
  | (ParamSpecBase & { key: string; label: string; kind: 'number'; options: number[]; unit?: string })
  | (ParamSpecBase & { key: string; label: string; kind: 'enum'; options: string[] })

/**
 * 语义色的键必须是领域中性的。
 * 曾经用过 'hit'|'miss'，结果调度实验的日志里每步都写着"命中" ——
 * 那是 Cache 的词汇，跨内核不成立。色用中性键，文案各实验自己给。
 */
export type ToneKey = 'good' | 'bad' | 'idle'
export type Tone = { key: ToneKey; label: string }

// 读数可带语义色：good/bad（命中/出错）+ hot（当前聚焦，琥珀）。hot 只用于读数强调，不进 stage Tone。
export type Readout = { label: string; value: string; tone?: ToneKey | 'hot' }

/**
 * 可编辑的驱动序列。
 * 指向 doc.streams 里的某一条 —— 也就是说，编辑器改的仍然是 DSL，
 * 没有绕过文档层开后门（验收标准 6）。
 */
export type SequenceSpec = {
  /** doc.streams 里的 name */
  stream: string
  label: string
  /** 十六进制录入与显示（Cache 地址） */
  radix?: 16
  /**
   * 允许录入什么样的数。默认 `'nat'` —— 非负整数（地址、页号、磁道号、服务时间…）。
   *
   * `'real'` 放开小数与负号，只有 IEEE 754 那一个实验要。
   * ⚠️ 这不是"顺手加个开关"：**它是一处修好的 bug** ——
   * 那个实验的提示语本来就写着「可含小数与负号」，默认值也是 −12.5，
   * 而解析器一律按非负整数校验，于是输入框里打 `0.1` 会被顶回来
   * 「不是合法的整数」。默认值之所以能跑，是因为它从 `defaultDoc` 直接进去，
   * **根本没经过解析器**。也就是说：这个实验最该动手试的那个数，用户打不进去。
   */
  value?: 'nat' | 'real'
  /**
   * 一句话说清这串数是什么（进制、单位、取值范围）。
   *
   * ⚠️ 它属于**编辑器**，不属于概览行。用户原话：
   * 「上层不需要『12 项 · 十六进制，0x 前缀可省 · 按字节编址的主存地址』」——
   * 不打算改这串数的人，这三句一个字都用不上；真要改的人一展开就看见。
   */
  hint?: string
  maxLength?: number
  /**
   * 收起时把每一项印成**格子**，而不是一行 `0x0 → 0x10 → …` 的箭头文字。
   *
   * 格子能干两件文字干不了的事：标出**走到第几项**、点一下**跳到那一步**。
   * 概念图上这一行就是格子。对"每一项是一次访问"的序列（Cache 地址、
   * 页面引用串）它是对的；对"整串是一个数组"的序列（待排序数组）
   * 逐项高亮没有意义 —— 所以是每个实验自己声明，不是全站默认。
   */
  chips?: boolean
  /**
   * 预置序列。数据在引擎侧 `src/presets/sequences.ts`，
   * 因为每条 note 都是能被证伪的行为主张，得让 tests/presets-claims.test.ts 逐条验。
   */
  presets?: Preset[]
  random?: () => number[]
}

/**
 * 可编辑的实体表 —— 进程表 / 图的边 / 资源矩阵 / 丢包事件。
 *
 * 跟序列编辑器同源：改的仍是 doc.entities，没有绕过文档层。
 * 区别只在形状：序列是一串标量，实体是一张表。
 */
export type EntityColumn =
  | { key: string; label: string; kind: 'text'; width?: number }
  | { key: string; label: string; kind: 'number'; unit?: string; width?: number }
  | { key: string; label: string; kind: 'enum'; options: string[]; labels?: string[]; width?: number }

export type EntityTableSpec = {
  /** 只管这一类实体，其余原样保留 */
  type: string
  label: string
  hint?: string
  /**
   * 列定义。做成函数是因为银行家的列数取决于 params.resources ——
   * 资源有几类，Max/Allocation 就有几列。
   */
  columns: (doc: SimDocument) => EntityColumn[]
  /** `id` 与 `at` 是 Entity 的顶层字段，其余列名都落在 attrs 里 */
  newRow: (index: number, doc: SimDocument) => Entity
  minRows?: number
  maxRows?: number
  /**
   * 每多少行折一栏。窄表（如三列的边表）行数一多就会挤成细长一条、
   * 右边全是空白 —— 折栏之后并排放，一屏看得全。
   */
  chunk?: number
  /** 行不可增删时（如银行家的资源类别由参数决定）关掉加/减按钮 */
  fixedRows?: boolean
}

export type EntitySpec = {
  tables: EntityTableSpec[]
  /** 整组实体的预置 —— 与序列预置同一条纪律：note 是能被证伪的主张 */
  presets?: EntityPreset[]
}

export type ViewTab = { id: string; label: string }

export type StageProps<S> = {
  doc: SimDocument
  trace: S[]
  index: number
  state: S
  tab: string
  /** 跳到另一个实验(库层"内容覆盖"反向连回理论实验用)。 */
  onNavExp?: (id: string) => void
}

export interface Experiment<S = never> {
  id: string
  group: string
  title: string
  subtitle: string

  kernel: Kernel<S>
  defaultDoc: SimDocument
  params: ParamSpec[]
  /** params 为空时，在参数面板里解释这个实验的自由度在哪 */
  paramsNote?: string
  /** 驱动序列可编辑 —— 参数换不了题面数据，这个才行 */
  sequence?: SequenceSpec
  /** 实体表可编辑 —— 进程表 / 图的边 / 资源矩阵 / 丢包事件 */
  entitySpec?: EntitySpec

  /**
   * **「本步推演」搬到右栏**，跟参数、读数摞在一起；旁栏只剩日志/真题/边界，默认收起。
   *
   * 用户给的概念图就是这个形态：右栏自上而下是「本步为什么这样做 → 实验控制 → 读数」，
   * 舞台左边**什么都没有**。推演贴着图放本来是对的（它每句都在说"你该看哪一格"），
   * 但贴在左边就得占掉整整一列，而右栏本来就在那儿。
   *
   * 做成实验自己声明的旗标、而不是在外壳里写 `id === 'cache'`：
   * 别的实验什么时候改成这个形态，就什么时候把这一行加上，外壳一个字不用改。
   * 默认 false —— 没改的实验推演照旧在旁栏第一格。
   */
  whyInRail?: boolean

  /** 内容标准 #2：诚实标注失真范围 */
  bounds: string[]

  /**
   * 走带上每一格里写什么（第二行）。
   *
   * 给了它，轴就从**柱状条**换成**格子**：格子里第一行是步号、第二行是这一步的输入
   * （Cache 是访问的地址、页面置换是引用的页号）。用户给的概念图要的就是这个 ——
   * 柱高表达的是"量"，而这一类实验每一步的量只有命中/缺失两档，
   * 柱子高低反而在暗示一个并不存在的连续量；写出地址才是那一格真正的身份。
   *
   * 不给就还是柱状条 —— TCP 的 cwnd、磁盘的移动距离是真正的连续量，柱子对。
   */
  tickChip?: (s: never, i: number) => string

  tabs: ViewTab[]
  Stage: FC<StageProps<S>>

  readouts: (s: S, doc: SimDocument, i: number) => Readout[]

  /** 每步的语义色 + 该领域对这一步的说法（"命中"/"运行"/"丢包"…） */
  tone: (s: S) => Tone
  /**
   * 每步的"量"（0..1）—— 轴上的柱高用它。命中/缺失不是量，滚动命中率才是。
   *
   * 第三个参数是当前配置。**归一化的分母不能是会长大的东西** ——
   * 磁盘那条原来写的是 `moved / (累计寻道 / 3)`，分母随着跑动一直变大，
   * 同样的距离早期柱高、后期柱矮，跨步不可比。分母要么是常量，要么来自 doc。
   */
  metric: (s: S, i: number, doc: SimDocument) => number
  /** 轴的刻度标签（可选） */
  tickLabel?: (s: S, i: number) => string
}

/** 存在注册表里时擦掉状态泛型，避免到处写 unknown */
export type AnyExperiment = Experiment<never>
