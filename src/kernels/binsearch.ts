/**
 * 内核：二分查找（经典算法 · 原理：有序=每问一次砍掉一半）
 * 轴：step —— 在一个有序数组里找目标，每步看中点、把搜索区间对半砍，直到命中
 *
 * 二分查找是"分治 + 有序"的最小样板:数组**排好序**后,查一个数不用一个个扫。看**正中间**那个:
 * 目标比它大就只可能在**右半**、比它小只可能在**左半**——一次比较就**砍掉一半**候选。区间 [lo,hi] 反复对折,
 * 每步搜索范围减半,所以只需 **log₂n** 次比较就能在百万个里定位(n=10⁶ 也就 20 步)。
 * 这就是"有序结构 + 每次排除一半"的威力,数据库索引(B+树)、版本二分定位 bug、猜数游戏,底子都是它。
 *
 * 本实验:一串数,找一个目标。看 [lo,hi] 区间每步对半砍、mid 指针跳,几步命中。
 * 值全部现算、可核对(每步 mid=(lo+hi)/2、比较方向、区间减半、≤log₂n 步)。
 *
 * ## 2026-09-08 补厚（用户：「继续打磨实验加厚」）
 *
 * 原来数组和目标都写死、**一个旋钮都没有**，于是二分查找的**前提**演不出来 ——
 * 而它整条命就系在那个前提上：**数组必须有序**。
 *
 *   · **乱序那一档**：同一套代码照跑不误、不报错、不崩，只是**找不到明明存在的数**。
 *     这是二分最危险的地方 —— 它失败得**很安静**。老版本只给有序数组，
 *     等于把这个前提藏起来了。
 *   · **找不存在的数**：区间一路缩到 lo>hi 才停。这是"未命中"的正常收场，
 *     也顺带把 lower_bound 那个"插入位置"讲清楚。
 *   · 顺带把**比较次数跟 log₂n 的关系**做成可核对的：换更大的数组，看它只多几步。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

/*  三种数组：有序（二分的主场）、乱序（前提被破坏）、更长的有序（看 log₂n）。
    乱序那一份是**同一批数打乱**的 —— 元素完全一样，只是顺序变了，
    这样"找不到"就百分之百是顺序的锅，赖不到数据头上。 */
const BASE = [3, 7, 12, 18, 25, 31, 42, 55, 63, 71, 80, 88, 95]
const SHUFFLED = [63, 12, 88, 3, 42, 95, 25, 71, 7, 80, 18, 55, 31]
const LONG = Array.from({ length: 41 }, (_, i) => 3 + i * 4)

export type BinSearchState = {
  i: number
  step: number
  arr: number[]
  target: number
  lo: number; hi: number; mid: number
  cmp: string                // 'hit' | 'go-right' | 'go-left'
  found: number              // 命中下标（-1 未定）
  compares: number
  /** 这份数组是有序的吗 —— 二分查找的前提 */
  sorted: boolean
  /** 目标到底在不在数组里（用线性扫确认的事实，跟二分的结论对照） */
  reallyThere: number
  /** log₂n 的上界：比较次数不该超过它 */
  bound: number
  phase: 'run' | 'done'
  log: string
}

export const BINSEARCH_VISIBLE = [
  'step', 'arr', 'target', 'lo', 'hi', 'mid', 'cmp', 'found', 'compares',
  'sorted', 'reallyThere', 'bound', 'phase', 'log',
] as const

type Frame = Omit<BinSearchState, 'i'>

export const binsearchKernel: Kernel<BinSearchState> = {
  kind: 'binsearch',

  compile(doc: SimDocument): CompiledModel<BinSearchState> {
    const kind = doc.params.arr === undefined ? '有序 13 个' : str(doc.params, 'arr')
    const ARR = kind === '乱序（前提被破坏）' ? SHUFFLED : kind === '有序 41 个' ? LONG : BASE
    const TARGET = doc.params.target === undefined ? 63 : num(doc.params, 'target')
    const sorted = ARR.every((v, i) => i === 0 || ARR[i - 1] <= v)
    //  ⚠️ 事实由**线性扫**给出，不由二分给出 —— 这样"二分说没有、其实有"才对得起来
    const reallyThere = ARR.indexOf(TARGET)
    const bound = Math.ceil(Math.log2(ARR.length + 1))

    const frames: Frame[] = []
    let lo = 0, hi = ARR.length - 1, compares = 0, found = -1
    const common = { arr: ARR, target: TARGET, sorted, reallyThere, bound }

    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      compares++
      const v = ARR[mid]
      const cmp = v === TARGET ? 'hit' : v < TARGET ? 'go-right' : 'go-left'
      frames.push({
        step: frames.length, ...common, lo, hi, mid, cmp, found: cmp === 'hit' ? mid : -1, compares, phase: 'run',
        log: `第 ${compares} 次比较：区间 [${lo},${hi}]，看正中间 arr[${mid}]=**${v}**。`
          + (cmp === 'hit' ? `正好等于 ${TARGET} —— **命中**！`
            : cmp === 'go-right' ? `${v} < ${TARGET}，${sorted ? '目标只可能在**右半**' : '**按有序假设**认为在右半（可这份数组没排序，这个推断没有依据）'}，lo=${mid + 1}。`
              : `${v} > ${TARGET}，${sorted ? '目标只可能在**左半**' : '**按有序假设**认为在左半（可这份数组没排序，这个推断没有依据）'}，hi=${mid - 1}。`),
      })
      if (cmp === 'hit') { found = mid; break }
      if (cmp === 'go-right') lo = mid + 1; else hi = mid - 1
    }

    const lf = frames[frames.length - 1]
    //  三种收场：命中 / 真没有 / **有但没找到**（前提被破坏时才会发生）
    const missedButThere = found < 0 && reallyThere >= 0
    frames.push({
      /*  ⚠️ lo/hi 必须用**循环结束后**的值，不能跟着 ...lf 走。
          lf 是最后一次比较那一帧，它的 lo/hi 是**更新之前**的。
          未命中时 lo 就是 lower_bound 插入位，读数条和结语都指着它 —— 差一格就说错话。 */
      ...lf, phase: 'done', found, lo, hi,
      log: found >= 0
        ? `只用 **${compares}** 次比较，就在 ${ARR.length} 个数里定位了 ${TARGET}（下标 ${found}）。`
          + `每次比较**砍掉一半**候选 —— 所以是 **log₂n**（这份数组的上界是 ${bound} 次，实际用了 ${compares} 次）。`
          + `百万个数也只要 ~20 步。B+树索引、二分定位 bug、猜数游戏都靠它。`
        : missedButThere
          ? `**没找到 —— 可 ${TARGET} 明明在数组里（下标 ${reallyThere}）。**`
            + `　这份数组**没有排序**，而二分查找的每一步推断（"比它大就只可能在右半"）都建立在有序之上。`
            + `前提一破，那句"只可能"就不成立，它会把目标所在的半边整个扔掉。`
            + `　注意它**没有报错、没有崩、也没跑慢** —— 照样 ${compares} 次比较干净利落地返回"不存在"。`
            + `**这才是二分最危险的地方：它失败得很安静。** 用二分之前先确认有序，不是形式主义。`
          : `区间缩到 lo>hi，**${TARGET} 不在数组里**（线性扫也确认了）。用了 ${compares} 次比较。`
            + `　停下来时的 lo=${lo} 就是它**该插进去的位置** —— 这正是 lower_bound 的用处：`
            + `二分不只回答"在不在"，还回答"该放哪儿"。`,
    })

    const base0: Frame = {
      step: -1, ...common, lo: 0, hi: ARR.length - 1, mid: -1, cmp: '', found: -1, compares: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '比较次数' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
