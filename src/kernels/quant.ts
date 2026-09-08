/**
 * 内核：权重量化 W8/W4（Transformer 与 LLM 原理 · 也接推理量化）
 * 轴：bits —— 同一组权重从 int8 一路压到 int2，看整数越来越粗、误差越来越大、显存越来越小
 *
 * 对称量化：scale = max(|w|) / (2^(bits−1) − 1)；q = clamp(round(w/scale))；反量化 ŵ = q·scale。
 * int8 每权重 1 字节（vs fp32 的 4），int4 只 0.5 字节 —— 这就是「7B 用 int8 只要 7G」的来历。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本用 8 个手挑的权重、整张一个 scale，扫一遍位宽就完了。那演的是**量化的定义**，
 * 不是量化的**难处**。而大模型量化这个领域里，几乎所有工作都在对付同一件事：
 *
 *   **一个异常值就能毁掉整张的 scale。**
 *   scale 由 max|w| 定，而 LLM 的权重/激活里就是会冒出几个特别大的值。
 *   scale 被它撑大之后，剩下 99% 的小权重**全被四舍五入压成 0** —— 存了一堆 0。
 *   这就是 LLM.int8()、SmoothQuant、GPTQ、AWQ 那一整条线要解决的问题。
 *
 * 补厚补两个旋钮，正好是"病"和"药"：
 *   · **权重分布**：正态（教科书情形）／**有异常值**（真实 LLM 的样子）／长尾。
 *   · **量化粒度**：整张一个 scale ／ 分 8 组（每组 32 个）／ 分 32 组（每组 8 个）——
 *     这就是 GPTQ/AWQ 的 per-group 量化。
 *     分组把异常值的破坏**关进它自己那一组**，别的组照常。
 *
 * 而分组不是白来的：**每组要多存一个 fp16 的 scale**。所以屏幕上记的是**等效位宽**
 * （把 scale 的开销摊进去），这正是论文里"4-bit group128 = 4.25 bit/权重"那个数的来历。
 * 少了这一项，"分组当然更好、组越小越好"就成了一句没有代价的空话。
 */
import { str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

/*  ⚠️ N 从 64 提到 256，是**量过之后改的**：
    分组的开销是"每组多存一个 fp16 scale"，摊到每个权重上 = 16/组大小 比特。
    N=64 时分 8 组 → 每组才 8 个权重 → 多花 2 bit/权重，int4 变成 6 bit ——
    分组看着贵得离谱，跟真实做法（group 128、多花 0.125 bit）完全不是一回事，会把人教歪。
    N=256 配 8/32 组 = 每组 32/8 个权重 → 多花 0.5/2 bit，正好能演出**组太小就不划算**这条。 */
const N = 256
const r3 = (x: number) => Math.round(x * 1000) / 1000
const r4 = (x: number) => Math.round(x * 10000) / 10000

function lcg(seed: number) {
  let s = seed >>> 0
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 0x100000000 - 0.5 }
}
const gauss = (r: () => number) => Array.from({ length: 6 }, r).reduce((a, b) => a + b, 0) / Math.sqrt(0.5)

function makeWeights(kind: string): number[] {
  const r = lcg(4242)
  const w = Array.from({ length: N }, () => r3(gauss(r) * 0.35))
  if (kind === '有异常值（真实 LLM 的样子）') {
    /*  三个大得离谱的值 —— LLM 的权重和激活里确实会冒出这种东西
        （这正是 LLM.int8() 那篇论文的出发点）。散在三个位置，
        分组之后它们只污染自己那三组，别的组照常。 */
    w[5] = 6.4; w[40] = -5.1; w[137] = 5.8
  } else if (kind === '长尾') {
    for (let k = 0; k < N; k++) if (k % 9 === 0) w[k] = r3(w[k] * 5)
  }
  return w
}

export type QuantState = {
  i: number
  bits: number
  qmax: number
  scale: number              // per-tensor 时就是它；分组时给第 0 组的
  scales: number[]           // 每组的 scale
  groups: number             // 组数
  groupSize: number
  weights: number[]
  cursor: number
  ints: (number | null)[]
  deq: (number | null)[]
  errs: (number | null)[]
  maxErr: number
  rmsErr: number             // 比 maxErr 有用得多：它反映的是"大多数权重被毁得多惨"
  relErr: number             // RMS 误差 / 权重的 RMS —— 无量纲，跨档可比
  zeroed: number             // 被压成 0 的非零权重个数 —— 异常值那档的主角
  zeroedAt4: number          // int4 时被压成 0 的个数（结语要引它；别在舞台里写死）
  zeroedFlat4: number        // 同样 int4、但**整张一个 scale** 时的个数 —— 分组的收益就是这个差
  bytesFp32: number
  bytesQ: number             // 含每组 scale 的 2 字节
  effBits: number            // 等效位宽 = 8·bytesQ/N
  kind: string
  gTag: string
  phase: 'scale' | 'quantize' | 'done'
  log: string
}

export const QUANT_VISIBLE = [
  'i', 'bits', 'qmax', 'scale', 'scales', 'groups', 'groupSize', 'weights', 'cursor',
  'ints', 'deq', 'errs', 'maxErr', 'rmsErr', 'relErr', 'zeroed', 'zeroedAt4', 'zeroedFlat4',
  'bytesFp32', 'bytesQ', 'effBits', 'kind', 'gTag', 'phase', 'log',
] as const

type Frame = Omit<QuantState, 'i'>

export const quantKernel: Kernel<QuantState> = {
  kind: 'quant',

  compile(doc: SimDocument): CompiledModel<QuantState> {
    const kind = doc.params.dist === undefined ? '正态（教科书情形）' : str(doc.params, 'dist')
    const gTag = doc.params.group === undefined ? '整张一个 scale' : str(doc.params, 'group')
    const groups = gTag.startsWith('整张') ? 1 : gTag.includes('32') ? 32 : 8
    const groupSize = N / groups
    const WEIGHTS = makeWeights(kind)
    const bytesFp32 = N * 4
    const wRms = Math.sqrt(WEIGHTS.reduce((a, w) => a + w * w, 0) / N)

    const BITS_SWEEP = [8, 6, 4, 3, 2]

    const at = (bits: number): Frame => {
      const qmax = Math.pow(2, bits - 1) - 1
      const scales: number[] = []
      for (let g = 0; g < groups; g++) {
        const seg = WEIGHTS.slice(g * groupSize, (g + 1) * groupSize)
        scales.push(Math.max(...seg.map(Math.abs)) / qmax || 1e-12)
      }
      const ints: number[] = [], deq: number[] = [], errs: number[] = []
      let maxErr = 0, sq = 0, zeroed = 0
      for (let k = 0; k < N; k++) {
        const sc = scales[Math.floor(k / groupSize)]
        const q = Math.max(-qmax, Math.min(qmax, Math.round(WEIGHTS[k] / sc)))
        const dq = q * sc
        const e = Math.abs(WEIGHTS[k] - dq)
        ints.push(q); deq.push(r3(dq)); errs.push(r3(e))
        maxErr = Math.max(maxErr, e); sq += e * e
        //  "本来不是 0、量化完变成 0" —— 异常值撑大 scale 时，遭殃的就是这些
        if (q === 0 && Math.abs(WEIGHTS[k]) > 1e-6) zeroed++
      }
      const rmsErr = Math.sqrt(sq / N)
      //  ⚠️ 分组的代价：每组多存一个 fp16 的 scale（2 字节）。不记这一项，"组越小越好"就是空话。
      const bytesQ = N * (bits / 8) + groups * 2
      const effBits = 8 * bytesQ / N

      return {
        bits, qmax, scale: r4(scales[0]), scales: scales.map(r4), groups, groupSize,
        weights: WEIGHTS, cursor: N, ints, deq, errs,
        maxErr: r3(maxErr), rmsErr: r4(rmsErr), relErr: r4(rmsErr / wRms), zeroed,
        zeroedAt4: 0, zeroedFlat4: 0,
        bytesFp32, bytesQ, effBits: r3(effBits), kind, gTag, phase: 'done',
        log: `**int${bits}**（整数范围 ±${qmax}）：`
          + (groups === 1
            ? `整张一个 scale = max|w|/${qmax} = **${r4(scales[0])}**。`
            : `分 ${groups} 组、每组自己一个 scale（${scales.slice(0, 3).map(r4).join(' / ')}${groups > 3 ? ' …' : ''}）。`)
          + `　${N} 个权重从 fp32 的 ${bytesFp32}B 压到 **${bytesQ}B**`
          + (groups > 1 ? `（含 ${groups} 个 fp16 scale 共 ${groups * 2}B）` : '')
          + `，等效 **${r3(effBits)} bit/权重**。`
          + `　相对误差 **${(rmsErr / wRms * 100).toFixed(1)}%**，最大误差 ${r3(maxErr)}`
          + (zeroed > 0
            ? `，**${zeroed}/${N} 个权重被压成了 0**${zeroed > N * 0.5 ? ' —— 一多半的权重直接没了' : ''}。`
            : `，没有权重被压成 0。`),
      }
    }

    /*  int4 那一档的归零数在好几处要引用（结语、舞台），算一次挂到每一帧上，
        别让舞台自己写死一个数 —— 换个分布/粒度它立刻就骗人了。
        zeroedFlat4 是"同样 int4 但整张一个 scale"的对照，分组的收益就是这个差。 */
    const zeroedAt4 = at(4).zeroed
    const flatW = makeWeights(kind)
    const flatScale = Math.max(...flatW.map(Math.abs)) / 7
    const zeroedFlat4 = flatW.filter(w => Math.round(w / flatScale) === 0 && Math.abs(w) > 1e-6).length

    const frames: Frame[] = BITS_SWEEP.map(b => ({ ...at(b), zeroedAt4, zeroedFlat4 }))

    //  收尾那一帧：把这一档的账算清楚，并指出该拧哪个旋钮
    const lo = frames[frames.length - 1], hi = frames[0]
    const outlier = kind.startsWith('有异常值')
    const finale: Frame = {
      ...lo, phase: 'done',
      log: `位宽从 8 扫到 2：等效位宽 ${r3(hi.effBits)} → **${r3(lo.effBits)}** bit/权重，`
        + `相对误差 ${(hi.relErr * 100).toFixed(1)}% → **${(lo.relErr * 100).toFixed(1)}%**。`
        + `　**拿精度换显存**这笔账就是这么算的。`
        + (outlier && groups === 1
          ? `　⚠️ 但这一档的问题不在位宽：权重里有三个**异常值**（6.4、−5.1、5.8），`
            + `而整张只有一个 scale、由 max|w| 定 —— scale 被它们撑大之后，`
            + `int4 下已经有 **${zeroedAt4}/${N}** 个权重被四舍五入压成 0，int2 更是 **${lo.zeroed}/${N}**。`
            + `**存了一堆 0**，位宽省下来的那点显存全白搭。`
            + `　把「量化粒度」拨到分组再看：异常值的破坏会被**关进它自己那一组**。`
            + `这就是 GPTQ / AWQ / LLM.int8() 那一整条线在做的事。`
          : outlier
            ? `　这一档已经开了**分 ${groups} 组**（每组 ${groupSize} 个权重）：三个异常值只污染自己那三组，别的组的 scale 不受连累 —— `
              + `int4 下被压成 0 的从整张 scale 的 ${zeroedFlat4} 个降到 **${zeroedAt4}** 个。`
              + `　代价写在"等效位宽"那一栏：每组要多存一个 fp16 的 scale，int4 分 ${groups} 组是 ${r3(frames[2].effBits)} bit/权重而不是 4。`
              + `**组越小误差越小、但开销越大** —— 论文里"4-bit group128"那个 128 就是在这条线上挑的。`
            : `　换成「有异常值」那一档再看 —— 那才是真实 LLM 权重的样子，也是量化真正难的地方。`),
    }
    frames.push(finale)

    return {
      axis: { kind: 'step', label: '量化位数' },
      initial: () => ({ ...at(8), i: -1, log: '按 ▶ 从高到低扫量化位数（int8→int2）：同一组权重，看整数越来越粗、误差越来越大、显存越来越小。' }),
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
