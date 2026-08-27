/**
 * 内核：FlashAttention —— 在线 softmax 分块累加（大模型推理 · 计算与访存）
 * 轴：step —— 逐个 K/V 块扫过，维护 running(m, l, O)，末尾对齐朴素结果并算省下的 HBM 流量
 *
 * 朴素注意力要先把整行分数 S = Q·Kᵀ（N 个数）写进 HBM，再读回做 softmax，再读一遍算 ×V ——
 * 中间那条长度 N 的分数向量在 HBM 里来回搬好几趟，序列越长越慢（访存瓶颈）。
 * FlashAttention 把 K/V 切成小块，一块一块在片上 SRAM 里累加，用**在线 softmax**维护三个滚动量：
 *   m = 目前见过的最大分数；l = 目前的 exp 之和；O = 目前的加权和。
 * 每来一个新块，先把旧累加量按 exp(m_old - m_new) 缩放对齐，再加上本块贡献 —— 数学上和一次性 softmax 完全等价。
 * 于是那条长度 N 的分数向量**从不落 HBM**，省掉的正是这块反复搬运的访存流量。
 *
 * 值全部现算：末步 online 的 O 与朴素 softmax·V 对齐（相对误差 < 1e-9），是可核对的唯一值。
 * 状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type FlashState = {
  i: number
  /** 固定一个查询，对 N 个键的分数（Q·K/√d，已给定） */
  scores: number[]
  values: number[]
  blockSize: number
  /** 本步处理的块内键下标 */
  block: number[]
  /** 滚动最大值 m */
  m: number
  /** 滚动 exp 之和 l */
  l: number
  /** 滚动加权和 O（未归一） */
  acc: number
  /** 本步归一化输出 O/l（用于展示收敛） */
  out: number
  /** 朴素一次性 softmax 的最终结果（对照） */
  naive: number
  /** 相对误差（末步应 ~0） */
  err: number
  /** HBM 省下的分数向量搬运趟数占比 */
  savedIO: number
  phase: 'block' | 'done'
  log: string
}

export const FLASH_VISIBLE = [
  'i', 'scores', 'values', 'blockSize', 'block', 'm', 'l', 'acc', 'out', 'naive', 'err', 'savedIO', 'phase', 'log',
] as const

type Frame = Omit<FlashState, 'i'>

//  固定一行分数与对应 value（1 维，便于手核）
const SCORES = [2.0, 1.0, 3.0, 0.5, 2.5, 1.5]
const VALUES = [10, 20, 30, 40, 50, 60]

export const flashKernel: Kernel<FlashState> = {
  kind: 'flash',

  compile(doc: SimDocument): CompiledModel<FlashState> {
    const N = SCORES.length
    const bs = Math.max(1, Math.min(N, num(doc.params, 'block') || 2))

    //  朴素一次性 softmax·V（对照真值）
    const gmax = Math.max(...SCORES)
    const exps = SCORES.map(s => Math.exp(s - gmax))
    const denom = exps.reduce((a, b) => a + b, 0)
    const naive = SCORES.reduce((acc, _s, i) => acc + (exps[i] / denom) * VALUES[i], 0)

    const frames: Frame[] = []
    let m = -Infinity, l = 0, accO = 0

    for (let start = 0; start < N; start += bs) {
      const idx: number[] = []
      for (let k = start; k < Math.min(start + bs, N); k++) idx.push(k)
      const blockMax = Math.max(...idx.map(k => SCORES[k]))
      const mNew = Math.max(m, blockMax)
      const correction = m === -Infinity ? 0 : Math.exp(m - mNew)
      //  先把旧累加量对齐到新 max
      l = l * correction
      accO = accO * correction
      //  再加本块贡献
      for (const k of idx) {
        const e = Math.exp(SCORES[k] - mNew)
        l += e
        accO += e * VALUES[k]
      }
      m = mNew
      const out = accO / l
      const err = Math.abs(out - naive) / Math.abs(naive)
      frames.push({
        scores: SCORES, values: VALUES, blockSize: bs, block: idx,
        m, l, acc: accO, out, naive, err, savedIO: 0, phase: 'block',
        log: `扫第 ${Math.floor(start / bs) + 1} 块（键 ${idx.join('、')}）：更新 m=${m.toFixed(2)}、l=${l.toFixed(2)}，` +
          `旧累加按 exp(Δm) 缩放对齐后加本块贡献 → 当前 O=${out.toFixed(2)}（真值 ${naive.toFixed(2)}）。`,
      })
    }

    //  访存对照：朴素把长度 N 的分数向量在 HBM 至少来回 3 趟（写 S、读做 softmax、读算 ×V）；
    //  flash 全在 SRAM 累加，那条向量 0 趟落 HBM。这里用"省掉的分数向量搬运趟数占比"表示。
    const savedIO = 1 // 100% 的分数向量 HBM 搬运被省掉（仍需读一遍 K/V，但 N×? 的分数矩阵不落地）
    const finalOut = accO / l
    const finalErr = Math.abs(finalOut - naive) / Math.abs(naive)
    frames.push({
      scores: SCORES, values: VALUES, blockSize: bs, block: [],
      m, l, acc: accO, out: finalOut, naive, err: finalErr, savedIO, phase: 'done',
      log: `扫完所有块：在线 softmax 结果 O=${finalOut.toFixed(4)}，与一次性 softmax 的真值 ${naive.toFixed(4)} ` +
        `相对误差 ${(finalErr * 1e9).toFixed(2)}e-9 —— 数学上完全等价。` +
        `而那条长度 ${N} 的分数向量**从没写进 HBM**，省掉的就是它反复搬运的访存。`,
    })

    const base0: Frame = {
      scores: SCORES, values: VALUES, blockSize: bs, block: [],
      m: -Infinity, l: 0, acc: 0, out: 0, naive, err: 1, savedIO: 0, phase: 'block', log: '',
    }

    return {
      axis: { kind: 'step', label: '分块扫描' },
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
