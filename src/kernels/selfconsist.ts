/**
 * 内核：思维链自洽 Self-Consistency（大模型算法 · 原理：对同一题采样多条推理链,答案多数投票)
 * 轴：step —— 让模型对同一道题**采样多条不同的推理链**(带随机性),每条各自推到一个答案,
 *      再对这些答案**多数投票**。不同路子若殊途同归到同一个答案,它更可能是对的;个别算错的被票数淹没。
 *
 * 单条"贪心"推理链一步错就步步错,还没有回头路。**自洽解码**的洞见:一道有唯一答案的推理题,
 * **正确的推法往往很多条、都通向同一个答案**,而错法则五花八门、彼此不一致。于是**采样 N 条**推理链(温度采样制造多样性),
 * 每条独立推到一个答案,最后**取出现次数最多的那个**(多数投票)——就能把少数算错的链投下去,显著提升推理准确率(尤其数学、常识题)。
 *
 * 本实验:一道应用题(正解 17),采样 5 条链:3 条不同算法都得 17、1 条括号搞错得 32、1 条乘错得 19。
 * 投票 17:3 / 32:1 / 19:1 → **多数票 17 胜出**(正确);而贪心若单采到那条错链就答错了。票数都可手数核对。自洽是提升 LLM 推理的经典简单招。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const PROBLEM = '小明有 5 个苹果，又买了 3 袋、每袋 4 个，一共几个？'
const CORRECT = 17
type Chain = { r: string; a: number; ok: boolean }
const CHAINS: Chain[] = [
  { r: '5 + 3×4 = 5 + 12 = 17', a: 17, ok: true },
  { r: '(5+3)×4 = 8×4 = 32', a: 32, ok: false },
  { r: '先算 3×4=12，再 +5 = 17', a: 17, ok: true },
  { r: '5 + 12 = 17', a: 17, ok: true },
  { r: '5×3 + 4 = 19', a: 19, ok: false },
]

export type SelfConsistState = {
  i: number
  step: number
  problem: string
  chains: Chain[]              // 已采样出的链（逐步增加）
  n: number                    // 总链数
  tally: [number, number][]    // [答案, 票数]，降序
  winner: number
  correct: number
  phase: 'run' | 'done'
  log: string
}

export const SELFCONSIST_VISIBLE = [
  'step', 'problem', 'chains', 'n', 'tally', 'winner', 'correct', 'phase', 'log',
] as const

type Frame = Omit<SelfConsistState, 'i'>

function tallyOf(chains: Chain[]): [number, number][] {
  const m = new Map<number, number>()
  chains.forEach(c => m.set(c.a, (m.get(c.a) ?? 0) + 1))
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

export const selfconsistKernel: Kernel<SelfConsistState> = {
  kind: 'selfconsist',

  compile(_doc: SimDocument): CompiledModel<SelfConsistState> {
    const frames: Frame[] = []
    for (let k = 0; k < CHAINS.length; k++) {
      const shown = CHAINS.slice(0, k + 1)
      const t = tallyOf(shown)
      const c = CHAINS[k]
      frames.push({
        step: frames.length, problem: PROBLEM, chains: shown, n: CHAINS.length, tally: t, winner: t[0][0], correct: CORRECT, phase: 'run',
        log: `采样第 ${k + 1} 条推理链:「${c.r}」→ 答案 **${c.a}**${c.ok ? '(对)' : '(算错了)'}。` +
          `当前票数:${t.map(([a, n]) => `${a}×${n}`).join('、')}。`,
      })
    }
    const finalTally = tallyOf(CHAINS)
    const winner = finalTally[0][0]
    frames.push({
      step: frames.length, problem: PROBLEM, chains: CHAINS, n: CHAINS.length, tally: finalTally, winner, correct: CORRECT, phase: 'done',
      log: `**多数投票**:${finalTally.map(([a, n]) => `${a} 得 ${n} 票`).join('、')} → **${winner} 胜出**(${finalTally[0][1]}/${CHAINS.length},正解 ${CORRECT}✓)。` +
        `3 条不同算法殊途同归到 17,2 条各自算错、彼此还不一样,被票数淹没。而**贪心**只采一条链,若恰好采到那条错的(如 32)就答错了——自洽用"多条采样+多数投票"把它救回来。` +
        `一道题正确推法往往多条且一致、错法各异,所以多数投票有效。是提升 LLM 数学/常识推理的经典简单招(配思维链 CoT)。`,
    })

    const base0: Frame = {
      step: -1, problem: PROBLEM, chains: [], n: CHAINS.length, tally: [], winner: 0, correct: CORRECT, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '采样推理链' },
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
