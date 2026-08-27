/**
 * 内核：BPE 分词逐步 merge（Transformer 与 LLM 原理）
 * 轴：step —— 从单字符起，按 merge 表的优先级，一步合并一对相邻符号
 *
 * BPE（字节对编码）是主流大模型的分词法：先把文本拆成最小单位（字符 / 字节），
 * 再按训练好的 **merge 表**（一串"把哪两个符号并成一个"的规则，按学到的先后排序），
 * 一步步把高频相邻对合并成一个 token。合并渲染和哈夫曼的"两个并一个"同构。
 *
 * 回答"中文为什么更贵"：merge 表是在**以英文为主**的语料上学的，
 * 于是英文常见词能一路并成一两个 token，而中文很多字并不出现在 merge 表里、
 * 甚至先被拆成 UTF-8 字节 —— 合并不动，token 数就多，按 token 计费自然更贵。
 *
 * 值全部现算。状态可 JSON 往返（验收标准 2）。
 */
import { str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type BpeState = {
  i: number
  /** 当前 token 序列 */
  toks: string[]
  /** 本步合并的那对（未合并时为空） */
  pair: [string, string] | null
  /** 本步合并出的新符号 */
  merged: string
  /** 剩余可用的 merge 规则数 */
  ruleLeft: number
  act: 'init' | 'merge' | 'nomerge' | 'done'
  /** 起始符号数（算压缩率） */
  start: number
  log: string
}

export const BPE_VISIBLE = [
  'i', 'toks', 'pair', 'merged', 'ruleLeft', 'act', 'start', 'log',
] as const

type Frame = Omit<BpeState, 'i'>

//  预置：起始符号序列 + 按优先级排的 merge 规则
const PRESETS: Record<string, { base: string[]; rules: [string, string][] }> = {
  '英文 lowest': {
    base: ['l', 'o', 'w', 'e', 's', 't'],
    rules: [['l', 'o'], ['lo', 'w'], ['e', 's'], ['es', 't'], ['low', 'est']],
  },
  '重复串 abab': {
    base: ['a', 'b', 'a', 'b', 'a', 'b'],
    rules: [['a', 'b'], ['ab', 'ab']],
  },
  '中文 你好': {
    //  中文先按 UTF-8 拆成字节（示意），merge 表里几乎没有它们的组合 —— 合并不动
    base: ['你', '好'],
    rules: [],
  },
}

export const bpeKernel: Kernel<BpeState> = {
  kind: 'bpe',

  compile(doc: SimDocument): CompiledModel<BpeState> {
    const preset = PRESETS[str(doc.params, 'text')] ?? PRESETS['英文 lowest']
    let toks = [...preset.base]
    const rules = preset.rules
    const start = toks.length

    const frames: Frame[] = []
    const put = (f: Partial<Frame> & { act: Frame['act']; log: string }) =>
      frames.push({ toks: [...toks], pair: null, merged: '', ruleLeft: 0, start, ...f })

    put({ act: 'init', ruleLeft: rules.length,
      log: `先拆成最小单位：${toks.join(' ')}（${start} 个符号）。下面按 merge 表逐条合并` })

    if (rules.length === 0) {
      put({ act: 'nomerge', ruleLeft: 0,
        log: `merge 表里没有这些符号的任何组合 —— **合并不动**。它们只能各算一个 token。这正是中文常常更贵的原因：分词器主要在英文上学，中文的组合没进 merge 表` })
    } else {
      rules.forEach((rule, ri) => {
        const [a, b] = rule
        //  合并所有相邻的 (a,b)
        let applied = false
        const next: string[] = []
        for (let k = 0; k < toks.length; k++) {
          if (k < toks.length - 1 && toks[k] === a && toks[k + 1] === b) {
            next.push(a + b); k++; applied = true
          } else next.push(toks[k])
        }
        if (!applied) return
        toks = next
        put({ act: 'merge', pair: [a, b], merged: a + b, ruleLeft: rules.length - ri - 1,
          log: `第 ${ri + 1} 条规则：把相邻的 **${a} + ${b}** 合成 **${a + b}** → ${toks.join(' ')}（剩 ${toks.length} 个 token）` })
      })
    }

    put({ act: 'done', ruleLeft: 0,
      log: `分词完成：${start} 个符号 → **${toks.length}** 个 token（${toks.join(' ')}）。` +
        (toks.length < start ? `英文能一路合并、压得很短 —— token 少、便宜` : `一个也没合并 —— token 多、贵`) })

    return {
      axis: { kind: 'step', label: '合并步骤' },
      initial: () => ({ i: -1, toks: [...preset.base], pair: null, merged: '', ruleLeft: rules.length, act: 'init', start, log: '' }),
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
