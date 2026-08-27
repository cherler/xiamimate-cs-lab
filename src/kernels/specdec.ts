/**
 * 内核：投机解码 speculative decoding（大模型推理 · 计算与访存）
 * 轴：step —— 逐轮：小草稿模型一次猜 K 个 token → 大模型一次并行验证 → 接受匹配前缀 + 纠正 1 个
 *
 * 大模型解码一次只吐一个字，每个字都要跑一遍完整前向（贵）。投机解码用一个便宜的"草稿模型"
 * 一口气猜 K 个后续 token，再让大模型**一次前向并行验证这 K+1 个位置**：
 *   从头比对，接受草稿猜对的最长前缀；第一个猜错处用大模型自己的 token 纠正；后面作废。
 *   若 K 个全中，还白送 1 个大模型 token。于是**一次大模型前向能落地多个 token**。
 * 关键：接受/纠正规则保证最终输出与"只用大模型"逐字生成**完全一致**（这里用贪心版展示）——
 * 省的是大模型前向次数，不是质量。草稿越准，接受越多，加速比越高。
 *
 * 值全部现算：提交的每个 token 都等于目标真值；加速比 = 出字数 / 大模型前向次数。状态可 JSON 往返。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type SpecDecState = {
  i: number
  K: number
  committed: string[]        // 已锁定的输出
  proposals: string[]        // 本轮草稿猜的 K 个
  truthSlice: string[]       // 目标模型这几个位的真值
  accepts: boolean[]         // 每个草稿 token 是否被接受
  matchLen: number           // 接受的前缀长度
  gotThisRound: number       // 本轮落地几个 token
  bonus: boolean             // 是否全中拿到白送 token
  targetPasses: number       // 累计大模型前向次数
  tokensOut: number          // 累计出字数
  speedup: number            // 出字数 / 前向次数
  phase: 'round' | 'done'
  log: string
}

export const SPECDEC_VISIBLE = [
  'i', 'K', 'committed', 'proposals', 'truthSlice', 'accepts', 'matchLen', 'gotThisRound', 'bonus',
  'targetPasses', 'tokensOut', 'speedup', 'phase', 'log',
] as const

type Frame = Omit<SpecDecState, 'i'>

//  目标模型的真实续写，与草稿模型的猜测（草稿在 2、6 位猜错）
const TRUTH = ['深', '度', '学', '习', '真', '有', '意', '思']
const DRAFT = ['深', '度', '猫', '习', '真', '有', '狗', '思']

export const specdecKernel: Kernel<SpecDecState> = {
  kind: 'specdec',

  compile(doc: SimDocument): CompiledModel<SpecDecState> {
    const K = Math.max(1, Math.min(4, num(doc.params, 'k') || 3))
    const N = TRUTH.length

    const frames: Frame[] = []
    let committed: string[] = []
    let targetPasses = 0

    while (committed.length < N) {
      const start = committed.length
      const proposals = DRAFT.slice(start, start + K)
      const truthSlice = TRUTH.slice(start, start + proposals.length)
      //  逐个比对，取匹配前缀
      let matchLen = 0
      const accepts: boolean[] = []
      for (let j = 0; j < proposals.length; j++) {
        const ok = proposals[j] === truthSlice[j]
        accepts.push(ok)
        if (ok && matchLen === j) matchLen++
      }
      //  一次大模型前向：接受前缀 matchLen 个 + 纠正/白送 1 个
      const allMatched = matchLen === proposals.length
      const remaining = N - start
      const got = Math.min(matchLen + 1, remaining)  // 前缀 + 1（纠正首错，或全中时白送）
      const bonus = allMatched && got > matchLen
      //  落地的 token 一律取目标真值（保证与只用大模型一致）
      committed = TRUTH.slice(0, start + got)
      targetPasses += 1
      const tokensOut = committed.length
      const speedup = tokensOut / targetPasses
      frames.push({
        K, committed: committed.slice(), proposals, truthSlice, accepts, matchLen,
        gotThisRound: got, bonus, targetPasses, tokensOut, speedup, phase: 'round',
        log: `第 ${targetPasses} 次大模型前向：草稿猜「${proposals.join('')}」，验证接受前 **${matchLen}** 个` +
          (bonus ? `（全中！白送 1 个「${TRUTH[start + matchLen] ?? ''}」）`
            : allMatched ? `（全部命中，已到末尾）`
              : `，第 ${matchLen + 1} 个「${proposals[matchLen] ?? ''}」猜错→用真值「${truthSlice[matchLen] ?? ''}」纠正`) +
          ` → 本轮落地 **${got}** 字。累计 ${tokensOut} 字 / ${targetPasses} 次前向 = **${speedup.toFixed(2)}×**。`,
      })
    }

    const last = frames[frames.length - 1]
    frames.push({
      ...last, phase: 'done',
      log: `生成完 ${last.tokensOut} 个 token，只跑了 **${last.targetPasses}** 次大模型前向（逐字要 ${last.tokensOut} 次）` +
        ` → 加速 **${last.speedup.toFixed(2)}×**。输出与只用大模型逐字生成完全一致 —— 草稿越准，接受越多，越快。`,
    })

    const base0: Frame = {
      K, committed: [], proposals: [], truthSlice: [], accepts: [], matchLen: 0,
      gotThisRound: 0, bonus: false, targetPasses: 0, tokensOut: 0, speedup: 0, phase: 'round', log: '',
    }

    return {
      axis: { kind: 'step', label: '验证轮' },
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
