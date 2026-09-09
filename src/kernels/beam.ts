/**
 * 内核：束搜索 Beam Search（大模型算法 · 每步只保留最有希望的前 k 条序列）
 * 轴：step —— 每步把 k 条候选各扩一个词、按分数排序，只留前 k 条
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本束宽写死 k=2、一个玩具模型，只演了"束搜索赢过贪心"
 * 这一个漂亮结果（0.288 vs 0.10）。而它自己的注释里写着两句：
 *   「k 越大越接近最优、越慢」
 *   「（配**长度归一化**等技巧）」
 * 第一句**在实践中是错的**，第二句指的那个毛病**一次都没出现过** —— 而那个毛病
 * 恰恰是束搜索最有名的一件事。
 *
 * **长度偏置**：一句话的概率是各步概率**连乘**，每多一个词就再乘一个小于 1 的数。
 * 所以**越短的序列概率天然越高** —— 束搜索找得越准（k 越大），输出就越短、越空洞。
 * 机器翻译里"beam 调大反而 BLEU 下降"就是这么来的，长度归一化正是为它打的补丁。
 *
 * 这一版：
 * ① **束宽 k 是旋钮**（1/2/4/8）。**k=1 就是贪心** —— 那句话现在是一个档，不是旁白。
 * ② **全搜索的最优解另算一份**（穷举所有序列），每一档都跟它比 ——
 *    「找到最优了吗」不能问算法自己。
 * ③ **k 扫描**：k=1…8 各跑一遍，把「找到的分数」和**「输出长度」**并排。
 *    在「长度偏置」那张模型上，**k 越大分数越高、而输出越短** —— 一眼看得见那条曲线在打架。
 * ④ **打分口径是旋钮**：原始累积概率 / 除以长度 / GNMT 的 α=0.6。
 *    ⚠️ 而实测发现**三者力度差很多**，不能一句"加了长度归一化就好了"糊过去：
 *    「÷ 长度」能把选择拉回那条更长的；而 **GNMT 的 α=0.6 温和得多**
 *    （分母是 ((5+len)/6)^0.6：长 1 时 1.00、长 3 时才 1.19），
 *    在这张模型上**还不足以翻盘**，选中的仍是那条短的。
 *    **长度惩罚是个有力度的旋钮，不是一个开关。**
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const END = '·'
const round3 = (x: number) => Math.round(x * 1000) / 1000

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const M_CLASSIC = '玩具模型（束搜索胜过贪心）'
const M_LENGTH = '长度偏置（k 越大输出越短）'
export const BEAM_MODELS = [M_CLASSIC, M_LENGTH] as const

export const BEAM_KS = [1, 2, 4, 8] as const

const S_RAW = '累积概率（原始）'
const S_MEAN = '长度归一化（÷ 长度）'
const S_GNMT = 'GNMT 长度惩罚 α=0.6'
export const BEAM_SCORES = [S_RAW, S_MEAN, S_GNMT] as const

type Model = Record<string, Record<string, number>>

/*  ⭐ 「长度偏置」那张模型是**特意造出来演那个毛病的**：
    - 贪心（k=1）第一步取 A（0.5），一路走到 `ABC·`，概率 0.10、**长 3 个词**。
    - 束宽一放大就发现 `B·`：概率 **0.27**，比贪心高一倍多 —— 而它**只有 1 个词**。
    **搜得越准，输出越短。** 这不是模型坏了，是"整句概率最大"这个目标本身偏爱短句：
    每多一个词就再乘一个小于 1 的数。 */
const MODELS: Record<string, Model> = {
  [M_CLASSIC]: {
    '': { A: 0.5, B: 0.4, C: 0.1 },
    A: { B: 0.4, C: 0.3, D: 0.3 },
    B: { C: 0.8, A: 0.1, D: 0.1 },
    AB: { [END]: 0.5, C: 0.3, D: 0.2 },
    AC: { [END]: 0.6, B: 0.4 },
    BC: { [END]: 0.9, A: 0.05, B: 0.05 },
    BD: { [END]: 0.7, A: 0.3 },
  },
  [M_LENGTH]: {
    '': { A: 0.5, B: 0.3, C: 0.2 },
    A: { B: 0.5, C: 0.3, D: 0.2 },
    B: { [END]: 0.9, C: 0.1 },
    C: { [END]: 0.8, A: 0.2 },
    AB: { C: 0.4, [END]: 0.3, D: 0.3 },
    AC: { [END]: 0.5, B: 0.5 },
    AD: { [END]: 1 },
    BC: { [END]: 1 },
    CA: { [END]: 1 },
    ABC: { [END]: 1 },
    ABD: { [END]: 1 },
    ACB: { [END]: 1 },
  },
}

const MAX_STEPS = 4

/** 打分：把累积概率折算成"可比的分数"。三种口径 */
function scoreOf(logp: number, len: number, kind: string): number {
  if (kind === S_MEAN) return len > 0 ? logp / len : logp
  if (kind === S_GNMT) {
    //  GNMT：lp = ((5+len)/6)^α，分数 = logP / lp
    const lp = ((5 + len) / 6) ** 0.6
    return logp / lp
  }
  return logp
}

type Cand = { seq: string; p: number; from: string; tok: string; np: number; score: number; len: number; done: boolean }

/** 穷举所有能生成的完整序列 —— 全搜索的真值。「找到最优了吗」不能问算法自己 */
function allSequences(model: Model): { seq: string; p: number; len: number }[] {
  const out: { seq: string; p: number; len: number }[] = []
  const go = (prefix: string, p: number, len: number) => {
    if (len > MAX_STEPS) return
    const dist = model[prefix] ?? { [END]: 1 }
    for (const tok in dist) {
      const np = p * dist[tok]
      if (tok === END) { out.push({ seq: prefix, p: np, len }); continue }
      go(prefix + tok, np, len + 1)
    }
  }
  go('', 1, 0)
  return out
}

/** 跑一趟束搜索，返回最后选中的那条 */
function runBeam(model: Model, k: number, scoreKind: string,
  emit?: (info: { t: number; beamsIn: { seq: string; p: number }[]; cands: Cand[]; kept: string[]; log: string }) => void) {
  let beams: { seq: string; p: number; len: number; done: boolean }[] = [{ seq: '', p: 1, len: 0, done: false }]
  const finished: { seq: string; p: number; len: number }[] = []

  for (let t = 1; t <= MAX_STEPS; t++) {
    const live = beams.filter(b => !b.done)
    if (!live.length) break
    const cands: Cand[] = []
    for (const b of live) {
      const dist = model[b.seq] ?? { [END]: 1 }
      for (const tok in dist) {
        const np = b.p * dist[tok]
        const done = tok === END
        const len = done ? b.len : b.len + 1
        cands.push({
          seq: done ? b.seq : b.seq + tok, p: b.p, from: b.seq, tok, np: round3(np),
          len, done, score: scoreOf(Math.log(np), Math.max(1, len), scoreKind),
        })
      }
    }
    cands.sort((a, b) => b.score - a.score)
    const kept = cands.slice(0, k)
    for (const c of kept) if (c.done) finished.push({ seq: c.seq, p: c.np, len: c.len })
    beams = kept.map(c => ({ seq: c.seq, p: c.np, len: c.len, done: c.done }))
    emit?.({
      t, beamsIn: live.map(b => ({ seq: b.seq, p: round3(b.p) })), cands,
      kept: kept.map(c => (c.done ? `${c.seq}${END}` : c.seq)),
      log: `**第 ${t} 步**：把 ${live.length} 条候选各扩一个词，共 ${cands.length} 个候选，` +
        `按${scoreKind === S_RAW ? '累积概率' : '归一化分数'}排序**只留前 ${k} 条**：` +
        kept.map(c => `${c.seq || '空'}${c.done ? END : ''}(${c.np})`).join('、') +
        `。其余 ${cands.length - kept.length} 条**剪掉**。`,
    })
    if (beams.every(b => b.done)) break
  }
  //  收尾：还没结束的束按当前概率也算一条（补一个 END）
  for (const b of beams) if (!b.done) finished.push({ seq: b.seq, p: b.p, len: b.len })
  const best = finished.reduce((a, x) =>
    (scoreOf(Math.log(x.p), Math.max(1, x.len), scoreKind) > scoreOf(Math.log(a.p), Math.max(1, a.len), scoreKind) ? x : a),
  finished[0] ?? { seq: '', p: 0, len: 0 })
  return { best, finished }
}

// ═══════════════════════════════════════════════════════════════

export type BeamState = {
  i: number
  step: number
  t: number
  k: number
  modelName: string
  scoreKind: string
  beamsIn: { seq: string; p: number }[]
  cands: Cand[]
  kept: string[]
  best: { seq: string; p: number; len: number }
  /** 贪心（k=1）的结果 —— 那句"k=1 就是贪心"现在是一个档 */
  greedy: { seq: string; p: number; len: number }
  /** 穷举所有序列得到的**真正最优**（按当前打分口径） */
  optimal: { seq: string; p: number; len: number }
  /** 概率最高的那条（不看打分口径）—— 用来看长度偏置 */
  topProb: { seq: string; p: number; len: number }
  /** 这一趟找到最优了吗 */
  isOptimal: boolean
  /** 全部完整序列的条数（全搜索的规模） */
  totalSeqs: number
  /** k 扫描：每个 k 找到什么、多长、是不是最优 */
  kSweep: { k: number; seq: string; p: number; len: number; optimal: boolean }[]
  /** k 从小到大，输出长度是不是在变短 */
  shrinks: boolean
  showGreedy: boolean
  act: string
  phase: 'run' | 'done'
  log: string
}

export const BEAM_VISIBLE = [
  'step', 't', 'k', 'modelName', 'scoreKind', 'beamsIn', 'cands', 'kept', 'best', 'greedy',
  'optimal', 'topProb', 'isOptimal', 'totalSeqs', 'kSweep', 'shrinks', 'showGreedy', 'act', 'phase', 'log',
] as const

type Frame = Omit<BeamState, 'i'>

export const beamKernel: Kernel<BeamState> = {
  kind: 'beam',

  compile(doc: SimDocument): CompiledModel<BeamState> {
    const modelName = String(doc.params.model ?? M_LENGTH)
    const K = Number(doc.params.k ?? 4)
    const scoreKind = String(doc.params.score ?? S_RAW)
    const model = MODELS[modelName]

    const all = allSequences(model)
    //  按当前打分口径的真正最优
    const optimal = all.reduce((a, x) =>
      (scoreOf(Math.log(x.p), Math.max(1, x.len), scoreKind) > scoreOf(Math.log(a.p), Math.max(1, a.len), scoreKind) ? x : a), all[0])
    //  纯概率最高的那条（不看口径）—— 长度偏置就看它有多短
    const topProb = all.reduce((a, x) => (x.p > a.p ? x : a), all[0])

    const mine = runBeam(model, K, scoreKind)
    const greedy = runBeam(model, 1, scoreKind).best
    const isOptimal = Math.abs(mine.best.p - optimal.p) < 1e-9 && mine.best.seq === optimal.seq

    /*  ⭐ k 扫描：那句"k 越大越接近最优"是真的，
        但屏幕上要同时印**输出长度** —— 在长度偏置那张模型上，两条线是打架的。 */
    const kSweep = [...BEAM_KS].map(k => {
      const r = runBeam(model, k, scoreKind).best
      return { k, seq: r.seq, p: round3(r.p), len: r.len, optimal: r.seq === optimal.seq }
    })
    const lens = kSweep.map(x => x.len)
    const shrinks = lens[lens.length - 1] < lens[0]

    const frames: Frame[] = []
    const shared = {
      k: K, modelName, scoreKind,
      best: { seq: mine.best.seq, p: round3(mine.best.p), len: mine.best.len },
      greedy: { seq: greedy.seq, p: round3(greedy.p), len: greedy.len },
      optimal: { seq: optimal.seq, p: round3(optimal.p), len: optimal.len },
      topProb: { seq: topProb.seq, p: round3(topProb.p), len: topProb.len },
      isOptimal, totalSeqs: all.length, kSweep, shrinks, showGreedy: false,
    }

    runBeam(model, K, scoreKind, info => {
      frames.push({
        ...shared, step: frames.length, act: 'expand', phase: 'run',
        t: info.t, beamsIn: info.beamsIn, cands: info.cands, kept: info.kept, log: info.log,
      })
    })

    const sweepText = kSweep.map(x =>
      `k=${x.k}：选中「${x.seq || '（空）'}」概率 ${x.p}、**长 ${x.len} 个词**${x.optimal ? '（＝全搜最优）' : ''}`).join('\n')
    const show = (s: { seq: string; p: number; len: number }) => `「${s.seq || '（空）'}」概率 ${round3(s.p)}、长 ${s.len}`

    frames.push({
      ...shared, step: frames.length, t: MAX_STEPS, beamsIn: [], cands: [], kept: [],
      act: 'done', showGreedy: true, phase: 'done',
      log: `**这一趟（k=${K}，${scoreKind}）选中的是** ${show(mine.best)}。\n\n` +
        `对照：**贪心（k=1）**给出 ${show(greedy)}；` +
        `**全搜索**（穷举全部 ${all.length} 条完整序列）按同一口径的最优是 ${show(optimal)} —— ` +
        (isOptimal ? `这一趟**追平了最优**。` : `⚠️ 这一趟**没找到最优**。`) + `\n\n` +
        `**① 束宽 k 扫一遍**（同一模型、同一口径，各跑一遍）：\n${sweepText}\n\n` +
        (shrinks
          ? `⚠️ **注意长度那一列：k 从 ${BEAM_KS[0]} 到 ${BEAM_KS[BEAM_KS.length - 1]}，输出从 ${lens[0]} 个词缩到 ${lens[lens.length - 1]} 个。**\n\n` +
            `这不是 bug，是"整句概率最大"这个目标本身的毛病：一句话的概率是各步概率**连乘**，` +
            `**每多一个词就再乘一个小于 1 的数** —— 所以越短的序列概率天生越高。` +
            `束搜索找得越准，就越会挑出那条又短又空洞的。\n\n` +
            `这张模型上概率最高的序列是 ${show(topProb)}，而贪心那条 ${show(greedy)} 反而更长、更有内容。\n\n` +
            `**机器翻译里"beam 调大反而 BLEU 下降"就是这么来的。**`
          : `k 越大越接近最优（这一档 ${kSweep.filter(x => x.optimal).length}/${kSweep.length} 个 k 追平了全搜最优），` +
            `而输出长度**没有随 k 变短**（都是 ${lens[0]} 个词）。\n\n` +
            (modelName === M_LENGTH
              ? `因为当前口径是「${scoreKind}」，长度惩罚已经把偏置压住了 —— **把口径换回「${S_RAW}」就看得见那条曲线打架**。`
              : `**换成「${M_LENGTH}」那张模型再看** —— 那里 k 越大输出越短，两条线是打架的。`)) + `\n\n` +
        `**② 打分口径**：当前用「${scoreKind}」。` +
        /*  ⚠️ 三种口径的力度**不一样**，别一句"换成长度归一化就好了"糊过去：
            GNMT 的 α=0.6 惩罚**温和得多**，在这张模型上（长 1 vs 长 3）根本不足以翻盘。
            实测：lp=((5+1)/6)^0.6=1.00 vs ((5+3)/6)^0.6=1.19，而两条序列的对数概率差得更远。 */
        (scoreKind === S_RAW
          ? `原始累积概率**天然偏爱短句**（连乘）。「${S_MEAN}」是拿**平均每词**的对数概率来比，长句不再吃亏；` +
            `「${S_GNMT}」是同一件事的**温和版**（除以 ((5+len)/6)^0.6 而不是 len）。**两者力度差很多**，下一条会看到。`
          : scoreKind === S_MEAN
            ? `除以长度是最直接的一种：同一个 k 下它把选择拉回了更长的那条。` +
              `\n\n⚠️ 但**别以为"加了长度归一化"就万事大吉** —— 换成「${S_GNMT}」看看：` +
              `它的惩罚温和得多（除以 ((5+len)/6)^0.6 而不是 len），在这张模型上**还不足以翻盘**，选中的仍是那条短的。` +
              `**长度惩罚是个有力度的旋钮，不是一个开关。**`
            : `⚠️ GNMT 这一版的惩罚是除以 ((5+len)/6)^0.6，**比"除以长度"温和得多**：` +
              `长 1 时分母是 1.00、长 3 时才 1.19。这张模型上两条候选的对数概率差得比这远，` +
              `所以**它还不足以把选择翻回长的那条** —— 而「${S_MEAN}」可以。\n\n` +
              `**长度惩罚是个有力度的旋钮，不是一个开关**：α 调多大、用哪种形式，都得看任务。`) + `\n\n` +
        `束搜索是机器翻译、摘要、受限生成的标准解码法。**k=1 就是贪心、k→∞ 就是全搜索** —— 它是这两端之间的一个旋钮。`,
    })

    const base0: Frame = {
      ...shared, step: -1, t: 0, beamsIn: [{ seq: '', p: 1 }], cands: [], kept: [],
      act: '', phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '扩展 / 剪枝' },
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
