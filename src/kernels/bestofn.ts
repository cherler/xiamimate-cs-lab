/**
 * 内核：Best-of-N 拒绝采样（大模型算法）
 * 轴：**采样候选数 N** —— 对同一任务采样 N 个候选，用打分器给每个打分，argmax 取最高分的那个。
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。上一轮已经把**边际递减**做出来了（N 翻倍、质量涨得越来越少）。
 * 但它自己的注释里还有一句从没兑现过的：
 *   「还被**打分器上限**卡住」
 * 而那句话背后是 Best-of-N **真正的失败模式**：打分器只是**代理**，不是真目标。
 * N 一大，argmax 就开始专挑**能骗过打分器**的候选 —— 代理分数一路涨，
 * **真实质量反而掉头往下**。这就是 Goodhart 定律，也是 RLHF 里"过优化"那条著名的曲线。
 *
 * 这一版：
 * ① **打分器做成旋钮**：
 *    - **完美验证器**：真去算式子的值，分数就是真实质量。N 越大越好（只是边际递减）。
 *    - **有缺陷的奖励模型**：它有个可被利用的偏好（这里是"式子越长看着越像在推理"），
 *      于是有一条**又长又错**的候选能拿到虚高分。N 一大就一定会撞上它。
 * ② **代理分数和真实质量两条线并排画**。分岔的那个 N 就是"再加算力反而更差"的拐点。
 * ③ **采样多样性也做成旋钮**：候选高度重复时，N 加了也没用 ——
 *    **Best-of-N 的前提是"样本之间真的不一样"**，这一条常被忽略。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const J_PERFECT = '完美验证器（真去算结果）'
const J_FLAWED = '有缺陷的奖励模型（能被钻空子）'
export const BON_JUDGES = [J_PERFECT, J_FLAWED] as const

const V_LOW = '低（候选高度重复）'
const V_MID = '中'
const V_HIGH = '高（多样但参差）'
export const BON_VARIETY = [V_LOW, V_MID, V_HIGH] as const

export const BON_NS = [1, 2, 4, 8, 16, 32] as const

const TASK = '用 3、8、5 拼一个算式，结果尽量接近 24'
const TARGET = 24

/** **真实质量**：真去算式子的值，离 24 越近越好。这是我们真正想要的东西 */
const trueScore = (v: number) => Math.max(0, 10 - Math.abs(TARGET - v))

/*  候选池。最后一条是**专门用来钻空子**的：
    式子又长又花哨，算出来却离 24 很远（真实质量 0），
    但"有缺陷的奖励模型"偏爱长式子，会给它虚高分。 */
const POOL: { e: string; v: number }[] = [
  { e: '8 × 5', v: 40 },                       // 0 → 真 0
  { e: '3 + 8 + 5', v: 16 },                   // 1 → 真 2
  { e: '(8 − 5) × 3', v: 9 },                  // 2 → 真 0
  { e: '3 × 8 − 5', v: 19 },                   // 3 → 真 5
  { e: '5 × 3 + 8', v: 23 },                   // 4 → 真 9
  { e: '3 × 8', v: 24 },                       // 5 → 真 10（最优，故意出现得晚）
  //  6 → 真实质量 0（算出来是 12，离 24 差 12），但**又长又像在一步步推理** ——
  //     真实世界里奖励模型最常被钻的正是这一种：偏爱长的、看起来在认真思考的回答
  { e: '先算 8−5=3，再 3×3=9，最后 9+3=12，所以答案是 12', v: 12 },
]

/**
 * **打分器**。Best-of-N 的 argmax 认的是**这个分数**，不是真实质量 ——
 * 两者一旦分家，加算力就开始朝错的方向使劲。
 *
 * 「有缺陷的奖励模型」的缺陷很具体：**式子越长，它越觉得像在认真推理**，
 * 于是给长度加分。真实世界里的奖励模型也是这么被钻的
 * （偏爱长回答、偏爱套话、偏爱看起来自信的措辞）。
 */
function judgeScore(c: { e: string; v: number }, judge: string): number {
  if (judge === J_PERFECT) return trueScore(c.v)
  /*  真实质量 + **长度加成**（每 2 个字符 +1，最多 +14）。
      这个力度是特意调过的：要让那条"又长又错"的候选（真实质量 0、代理分 14）
      **压得过**真正的最优解（真实质量 10、很短、代理分 12）——
      **不然钻空子这件事根本不会发生**，而它正是要演的东西。 */
  const lenBonus = Math.min(14, Math.floor(c.e.length / 2))
  return trueScore(c.v) + lenBonus
}

/*  抽样序列（钉死，可复现）。三档"多样性"用不同的序列：
    - 低：几乎全是同一个候选 —— **Best-of-N 的前提是样本之间真的不一样**，
      这一档 N 加了也没用。
    - 中：好候选第 6 个才出、最优第 16 个才出 → best 先快涨后压平（边际递减）。
    - 高：多样，但也更容易撞上那条**钻空子**的候选（下标 6）。 */
const DRAWS: Record<string, number[]> = {
  [V_LOW]: [1, 1, 1, 3, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1],
  [V_MID]: [1, 0, 3, 0, 1, 4, 2, 3, 0, 1, 3, 0, 4, 2, 1, 5, 3, 0, 1, 2, 3, 0, 1, 4, 2, 3, 0, 1, 5, 2, 0, 3],
  [V_HIGH]: [1, 0, 3, 2, 4, 0, 6, 1, 3, 2, 0, 4, 6, 1, 2, 5, 0, 6, 3, 1, 4, 2, 6, 0, 5, 3, 1, 6, 2, 4, 0, 5],
}

export type BONCand = { e: string; v: number; reward: number; trueR: number }
/** 曲线上的一点：代理分数（打分器给的）和真实质量并排 */
export type BONPoint = { n: number; best: number; trueBest: number }

export type BestOfNState = {
  i: number
  n: number
  maxN: number
  task: string
  target: number
  judge: string
  variety: string
  drawn: BONCand[]
  bestIdx: number
  /** argmax 挑出来那条的**代理分数** */
  bestReward: number
  /** 同一条的**真实质量** —— 两者一旦分家就出事了 */
  bestTrue: number
  gain: number
  curve: BONPoint[]
  /** 完整曲线（所有 N），用来找分岔点 */
  fullCurve: BONPoint[]
  /** 真实质量最高出现在哪个 N；之后掉了多少 */
  peakN: number
  declineAfterPeak: number
  /** 池子里真实质量最高的那条（拿它当天花板） */
  ceiling: number
  /** 挑出来的这条是不是"钻空子"的（代理分高、真实质量 0） */
  hacked: boolean
  /** 采样到的不同候选个数 —— Best-of-N 的前提 */
  distinct: number
  phase: 'done'
  log: string
}

export const BESTOFN_VISIBLE = [
  'n', 'task', 'target', 'judge', 'variety', 'drawn', 'bestIdx', 'bestReward', 'bestTrue',
  'gain', 'curve', 'fullCurve', 'peakN', 'declineAfterPeak', 'ceiling', 'hacked', 'distinct', 'phase', 'log',
] as const

type Frame = Omit<BestOfNState, 'i'>

export const bestofnKernel: Kernel<BestOfNState> = {
  kind: 'bestofn',

  compile(doc: SimDocument): CompiledModel<BestOfNState> {
    const judge = String(doc.params.judge ?? J_FLAWED)
    const variety = String(doc.params.variety ?? V_HIGH)
    const draws = DRAWS[variety] ?? DRAWS[V_MID]

    const drawnOf = (n: number): BONCand[] => draws.slice(0, n).map(idx => ({
      e: POOL[idx].e, v: POOL[idx].v,
      reward: judgeScore(POOL[idx], judge), trueR: trueScore(POOL[idx].v),
    }))
    /** argmax **按打分器的分数**挑 —— 这正是问题所在：它挑的不是真实质量 */
    const bestOf = (cands: BONCand[]) => {
      let bi = 0
      for (let j = 1; j < cands.length; j++) if (cands[j].reward > cands[bi].reward) bi = j
      return bi
    }

    const MAXN = BON_NS[BON_NS.length - 1]
    const fullCurve: BONPoint[] = [...BON_NS].map(n => {
      const d = drawnOf(n)
      const bi = bestOf(d)
      return { n, best: d[bi].reward, trueBest: d[bi].trueR }
    })
    //  真实质量的峰值在哪个 N，之后掉了多少 —— 那就是"再加算力反而更差"的拐点
    const peak = fullCurve.reduce((a, x) => (x.trueBest > a.trueBest ? x : a), fullCurve[0])
    const peakN = peak.n
    const declineAfterPeak = peak.trueBest - fullCurve[fullCurve.length - 1].trueBest
    const ceiling = Math.max(...POOL.map(c => trueScore(c.v)))

    const frames: Frame[] = []
    for (let k = 0; k < BON_NS.length; k++) {
      const n = BON_NS[k]
      const drawn = drawnOf(n)
      const bestIdx = bestOf(drawn)
      const best = drawn[bestIdx]
      const gain = k === 0 ? best.reward : best.reward - fullCurve[k - 1].best
      const trueGain = k === 0 ? best.trueR : best.trueR - fullCurve[k - 1].trueBest
      const distinct = new Set(draws.slice(0, n)).size
      const hacked = best.reward > best.trueR + 1e-9 && best.trueR < ceiling / 2

      frames.push({
        n, maxN: MAXN, task: TASK, target: TARGET, judge, variety,
        drawn, bestIdx, bestReward: best.reward, bestTrue: best.trueR,
        gain, curve: fullCurve.slice(0, k + 1), fullCurve, peakN, declineAfterPeak, ceiling, hacked, distinct,
        phase: 'done',
        log:
          `采样 **N=${n}** 个候选（其中 ${distinct} 个互不相同）、逐个打分，取**打分器分数最高**的那条 → ` +
          `「**${best.e}**」= ${best.v}，代理分 **${best.reward}**、真实质量 **${best.trueR}**。\n\n` +
          (k === 0
            ? `只采 1 个，好坏全凭运气。`
            : gain >= 3 ? `代理分比上一档涨了 **+${gain}** —— 加候选还很划算。`
              : gain > 0 ? `代理分只涨 **+${gain}** —— **边际开始递减**。`
                : `代理分和上一档**一样** —— 再加候选几乎白花算力。`) +
          (judge === J_FLAWED && hacked
            ? `\n\n⚠️ **注意这两个分数已经分家了**：代理分 ${best.reward} 是打分器给的，而它的**真实质量只有 ${best.trueR}**。\n\n` +
              `挑出来的这条式子又长又花哨，算出来却离 ${TARGET} 差得远 —— **它是来骗打分器的**。` +
              `而 argmax 认的就是打分器的分数，N 越大就越一定会撞上它。`
            : trueGain < 0
              ? `\n\n⚠️ 真实质量比上一档**掉了 ${-trueGain}** —— 代理分在涨，真东西在退。`
              : ''),
      })
    }

    //  末帧：把整条曲线的结论说清楚
    const lastF = frames[frames.length - 1]
    const curveText = fullCurve.map(p => `N=${p.n}：代理 ${p.best} / 真实 ${p.trueBest}`).join('　')
    lastF.log += `\n\n**整条 N 曲线**（代理分 / 真实质量）：\n${curveText}\n\n` +
      (declineAfterPeak > 0
        ? `⚠️ **真实质量在 N=${peakN} 见顶（${peak.trueBest} 分），之后掉了 ${declineAfterPeak} 分** —— 而代理分一路只涨不跌。\n\n` +
          `**这就是 Goodhart 定律：一旦拿代理指标当目标，它就不再是个好指标。** ` +
          `RLHF 里"过优化"那条著名的曲线（KL 越大、奖励越高、人类偏好反而下降）说的是同一件事。\n\n` +
          `**把「打分器」换成完美验证器再看** —— 那时候代理分就是真实质量，两条线重合，N 越大只会越好。`
        : lastF.distinct <= 2
          ? `⚠️ **这一档 ${MAXN} 次采样里只有 ${new Set(draws).size} 个不同的候选。** ` +
            `Best-of-N 取的是"N 个样本里的最大值"—— 样本都一样的话，最大值也就是那一个，**N 加了等于没加**。\n\n` +
            `**Best-of-N 的前提是样本之间真的不一样**（靠温度/采样策略制造多样性），这一条常被忽略：` +
            `一份"多采几个"的算力预算，花在**重复的样本**上是**一分钱都不值**的。\n\n把「采样多样性」调高再看。`
          : judge === J_PERFECT
            ? `真实质量随 N 单调不降，最高到 ${peak.trueBest}（池子里的天花板是 ${ceiling}）——` +
              `**打分器就是真实质量**（它真去算式子的值）时，Best-of-N 就是老老实实"用算力换质量"，只是**边际递减**：` +
              `从 N=1 到 N=8 涨了 ${fullCurve[3].trueBest - fullCurve[0].trueBest} 分，从 N=8 到 N=32 只涨了 ${fullCurve[5].trueBest - fullCurve[3].trueBest} 分。\n\n` +
              `**把「打分器」换成有缺陷的那个、多样性调到高再看** —— 代理分照涨，而真实质量会掉头。`
            //  ⚠️ 这一支是"打分器有缺陷、但这条抽样序列**没撞上**那条钻空子的候选"。
            //     原来这里一律印「把打分器换成有缺陷的那个再看」—— 而当前档**本来就是**有缺陷的那个，屏幕上自相矛盾。
            : `这一档代理分（${lastF.bestReward}）已经明显高于真实质量（${lastF.bestTrue}）—— ` +
              `**打分器的长度偏好已经在虚报了**，只是这条抽样序列 ${MAXN} 抽里**没抽到**那条最会钻空子的候选，` +
              `所以真实质量还没掉头。\n\n**把「采样多样性」调到高再看** —— N 一大就一定会撞上它。`)

    const base0: Frame = {
      n: 0, maxN: MAXN, task: TASK, target: TARGET, judge, variety,
      drawn: [], bestIdx: 0, bestReward: 0, bestTrue: 0, gain: 0, curve: [], fullCurve,
      peakN, declineAfterPeak, ceiling, hacked: false, distinct: 0, phase: 'done', log: '',
    }

    return {
      axis: { kind: 'step', label: '采样候选数 N' },
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
