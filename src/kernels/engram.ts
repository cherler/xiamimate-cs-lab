/**
 * 内核：Engram / n-gram 记忆（大模型推理 · 原理：用一张便宜的查表增强 Transformer）
 * 轴：step —— 把序列里的 n-gram 存成一张「前缀 → 下一个」的表，再用 O(1) 查表补全，看它怎么补注意力的短板
 *
 * 注意力要"回头看"得靠 QKᵀ 全局打分,又贵(O(N²))、又受上下文窗口限制。Engram 这类 **n-gram 记忆模块**给了
 * 一条便宜的旁路:把出现过的 **n-gram 统计**存成一张哈希表(前 n−1 个 token → 下一个 token 的计数),推理时
 * 用当前的 (n−1)-gram 去 **O(1) 查表**,直接拿到"上次/历次它后面跟了什么",再把这个便宜预测**融合**进模型输出。
 *   · 查表 **O(1)**、不随上下文长度变;
 *   · 记忆**不受注意力窗口限制**——哪怕相关信息在几万 token 之前,只要那个 n-gram 出现过,就查得到;
 *   · 把"精确复制重复模式"这件事从昂贵的注意力**卸载**到便宜的查表上,让注意力去干更难的语义活。
 * 它和「归纳头」目标像(都在"回头找上次它之后是什么"),但机制完全不同:归纳头是**学出来的注意力**、软而贵;
 * Engram 是**显式的非参数化查表**、硬而便宜。二者互补——这就是"n-gram 记忆增强 Transformer"。
 *
 * 本实验:序列 A B C D A B C D A B C,用 trigram(前 2 个→下一个)建表,查询当前 2-gram → 预测下一个。
 * 值全部现算、可核对(表项计数、命中、预测 token)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const SEQ = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C']
const NGRAM = 3   // trigram：前 2 个 token 预测第 3 个

type Entry = { key: string; next: string; count: number }

export type EngramState = {
  i: number
  step: number
  seq: string[]
  ngram: number
  stage: 'id' | 'build' | 'lookup' | 'predict' | 'done'
  table: Entry[]
  queryKey: string
  hitKey: string             // 命中的表项 key（lookup 后有）
  prediction: string
  matchCount: number         // 该 n-gram 在历史里出现次数
  log: string
}

export const ENGRAM_VISIBLE = [
  'step', 'seq', 'ngram', 'stage', 'table', 'queryKey', 'hitKey', 'prediction', 'matchCount', 'log',
] as const

type Frame = Omit<EngramState, 'i'>

export const engramKernel: Kernel<EngramState> = {
  kind: 'engram',

  compile(_doc: SimDocument): CompiledModel<EngramState> {
    // 建表：前 n-1 个 token → 下一个 token 的计数
    const counts: Record<string, Record<string, number>> = {}
    for (let i = NGRAM - 1; i < SEQ.length; i++) {
      const key = SEQ.slice(i - NGRAM + 1, i).join(' ')
      const nxt = SEQ[i]
      ;(counts[key] ??= {})[nxt] = (counts[key][nxt] || 0) + 1
    }
    const table: Entry[] = []
    for (const k in counts) for (const t in counts[k]) table.push({ key: k, next: t, count: counts[k][t] })

    const queryKey = SEQ.slice(-(NGRAM - 1)).join(' ')
    const cand = counts[queryKey] || {}
    const prediction = Object.keys(cand).sort((a, b) => cand[b] - cand[a])[0] ?? ''
    const matchCount = cand[prediction] ?? 0

    const frames: Frame[] = [
      {
        step: 0, seq: SEQ, ngram: NGRAM, stage: 'id', table: [], queryKey: '', hitKey: '', prediction: '', matchCount: 0,
        log: `序列 **${SEQ.join(' ')}**，问下一个 token 是什么?Engram 的办法:不靠注意力全局打分,` +
          `而是查一张便宜的 **n-gram 记忆表**(这里用 trigram:前 2 个 token → 下一个)。`,
      },
      {
        step: 1, seq: SEQ, ngram: NGRAM, stage: 'build', table, queryKey: '', hitKey: '', prediction: '', matchCount: 0,
        log: `扫一遍序列,把每个 trigram 存进表:` +
          table.map(e => `「${e.key}」→${e.next}(×${e.count})`).join('、') + `。这张表 **O(1) 可查**、且不受注意力窗口限制。`,
      },
      {
        step: 2, seq: SEQ, ngram: NGRAM, stage: 'lookup', table, queryKey, hitKey: queryKey, prediction: '', matchCount,
        log: `预测下一个:取当前的 2-gram key = 「**${queryKey}**」,去表里 **O(1) 查**——命中!` +
          `它在历史里出现过 ${matchCount} 次,后面都跟着同一个 token。`,
      },
      {
        step: 3, seq: SEQ, ngram: NGRAM, stage: 'predict', table, queryKey, hitKey: queryKey, prediction, matchCount,
        log: `表里「${queryKey}」→ **${prediction}**(×${matchCount})→ 预测下一个 token = **${prediction}**。` +
          `一次查表搞定,没动用任何注意力打分。`,
      },
      {
        step: 4, seq: SEQ, ngram: NGRAM, stage: 'done', table, queryKey, hitKey: queryKey, prediction, matchCount,
        log: `**${SEQ.join(' ')} → ${prediction}**：n-gram 记忆用 O(1) 查表补全了重复模式,不受上下文窗口限制、` +
          `把"精确复制"从昂贵的注意力卸载到便宜的查表上。它和**归纳头**目标像(都回头找"上次它之后是什么"),` +
          `但机制相反:归纳头是学出来的软注意力、贵;Engram 是显式非参数化查表、便宜。二者互补——这就是` +
          `**n-gram 记忆增强 Transformer**,让注意力腾出手去干更难的语义活,也是长上下文里省算力的一条路。`,
      },
    ]

    const base0: Frame = {
      step: -1, seq: SEQ, ngram: NGRAM, stage: 'id', table: [], queryKey: '', hitKey: '', prediction: '', matchCount: 0, log: '',
    }

    return {
      axis: { kind: 'step', label: '步骤' },
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
