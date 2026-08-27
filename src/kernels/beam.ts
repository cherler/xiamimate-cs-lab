/**
 * 内核：束搜索 Beam Search（大模型算法 · 原理：每步只保留最有希望的前 k 条序列,平衡贪心与全搜）
 * 轴：step —— 大模型逐词生成时,每步把当前 k 条候选序列各自扩展一个词、算累积概率,只留**总分最高的 k 条**,
 *      其余剪掉。k=1 就是贪心(只留最好那条)、k=∞ 就是全搜索;束搜索取中间,常能找到比贪心更优的整句。
 *
 * 语言模型每步给出下一个词的概率,一句话的概率=各步概率**连乘**。想要整句概率最大,逐词贪心(每步只取当前最高)
 * 常会掉坑:某步的**局部最优**词后面接不出好句子。全搜索(枚举所有序列)又爆炸。**束搜索**折中:维护 **k 条**候选
 * (束宽 k),每步把每条各扩一个词、按**累积概率**排序,只保留**前 k 条**继续,其余剪枝。k 越大越接近最优、越慢。
 *
 * 本实验:玩具语言模型,束宽 k=2,生成 3 个词。你会看到贪心第一步就贪 A(0.5＞0.4),结果被锁进平庸的 AB⟨end⟩(0.10);
 * 束搜索同时留着 B,发现 B→C→⟨end⟩ 概率 **0.288**,近 3 倍胜出。每步的累积概率、保留哪几条都可手算核对。
 * 束搜索是机器翻译、摘要、受限生成的标准解码法(配长度归一化等技巧)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const K = 2
const STEPS = 3
const END = '·'
// 玩具语言模型 P(next | prefix)
const MODEL: Record<string, Record<string, number>> = {
  '': { A: 0.5, B: 0.4, C: 0.1 },
  A: { B: 0.4, C: 0.3, D: 0.3 },
  B: { C: 0.8, A: 0.1, D: 0.1 },
  AB: { [END]: 0.5, C: 0.3, D: 0.2 },
  AC: { [END]: 0.6, B: 0.4 },
  BC: { [END]: 0.9, A: 0.05, B: 0.05 },
  BD: { [END]: 0.7, A: 0.3 },
}
const round3 = (x: number) => Math.round(x * 1000) / 1000

type Cand = { seq: string; p: number; from: string; tok: string; np: number }

export type BeamState = {
  i: number
  step: number
  t: number
  k: number
  beamsIn: { seq: string; p: number }[]     // 本步展开前的 k 条
  cands: Cand[]                              // 本步全部候选（已按概率降序）
  kept: string[]                            // 保留的 top-k 序列
  best: { seq: string; p: number }
  greedy: { seq: string; p: number }
  showGreedy: boolean
  act: string                               // 'expand' | 'done'
  phase: 'run' | 'done'
  log: string
}

export const BEAM_VISIBLE = [
  'step', 't', 'k', 'beamsIn', 'cands', 'kept', 'best', 'greedy', 'showGreedy', 'act', 'phase', 'log',
] as const

type Frame = Omit<BeamState, 'i'>

export const beamKernel: Kernel<BeamState> = {
  kind: 'beam',

  compile(_doc: SimDocument): CompiledModel<BeamState> {
    // 贪心（用于对照）
    let gseq = '', gp = 1
    for (let t = 0; t < STEPS; t++) {
      const dist = MODEL[gseq] || { [END]: 1 }
      let best = '', bp = -1
      for (const tok in dist) if (dist[tok] > bp) { bp = dist[tok]; best = tok }
      gseq += best; gp *= bp
      if (best === END) break
    }
    const greedy = { seq: gseq, p: round3(gp) }

    const frames: Frame[] = []
    let beams: { seq: string; p: number }[] = [{ seq: '', p: 1 }]

    for (let t = 0; t < STEPS; t++) {
      const cands: Cand[] = []
      for (const bm of beams) {
        const dist = MODEL[bm.seq] || { [END]: 1 }
        for (const tok in dist) cands.push({ seq: bm.seq + tok, p: round3(bm.p * dist[tok]), from: bm.seq, tok, np: dist[tok] })
      }
      cands.sort((a, b) => b.p - a.p)
      const kept = cands.slice(0, K)
      const beamsIn = beams.slice()
      const bestNow = kept[0]
      frames.push({
        step: frames.length, t: t + 1, k: K, beamsIn, cands: cands.slice(), kept: kept.map(c => c.seq),
        best: { seq: bestNow.seq, p: bestNow.p }, greedy, showGreedy: false, act: 'expand', phase: 'run',
        log: `第 ${t + 1} 步:把 ${beams.length} 条候选各扩一个词,得 ${cands.length} 条候选,按累积概率排序,` +
          `**只留前 ${K} 条**:${kept.map(c => `${disp(c.seq)}(${c.p})`).join('、')};其余剪掉。`,
      })
      beams = kept.map(c => ({ seq: c.seq, p: c.p }))
    }

    beams.sort((a, b) => b.p - a.p)
    const winner = beams[0]
    frames.push({
      step: frames.length, t: STEPS, k: K, beamsIn: beams.slice(), cands: [], kept: beams.map(b => b.seq),
      best: { seq: winner.seq, p: winner.p }, greedy, showGreedy: true, act: 'done', phase: 'done',
      log: `**束搜索最优**:${disp(winner.seq)},概率 **${winner.p}**。而**贪心**(每步只取最高)第一步就贪 A、被锁进 ${disp(greedy.seq)}(${greedy.p})——` +
        `束搜索靠同时保留 ${K} 条,发现了贪心错过的更优整句,${round3(winner.p / greedy.p)}× 胜出。束宽 k 越大越接近最优、越慢;k=1 就是贪心。机器翻译、摘要、受限生成都靠它。`,
    })

    const base0: Frame = {
      step: -1, t: 0, k: K, beamsIn: [{ seq: '', p: 1 }], cands: [], kept: [], best: { seq: '', p: 1 }, greedy, showGreedy: false, act: '', phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '解码步(扩展+剪枝)' },
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

function disp(seq: string): string {
  return seq.replace('·', '⟨end⟩')
}
