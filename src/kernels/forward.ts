/**
 * 内核：完整前向拼装 —— 一次真实推理（Transformer 与 LLM 原理 · 收口 capstone）
 * 轴：step —— 把一个 token 从 embedding 一路走到 logits → 采样，逐段展示真实向量
 *
 * 把这条路上学过的零件串成一次真实前向：
 *   embed → RMSNorm → 自注意力(Q·Kᵀ/√d→掩码→softmax→·V) → 残差 → RMSNorm → FFN(relu) → 残差
 *   → 末层 RMSNorm → LM 头(·Wout) → logits → softmax → 采样下一个 token。
 * 每一段都对应前面一个实验（归一化=RMSNorm、注意力=缩放点积+掩码、FFN=MoE那屏的稠密版、采样=采样解码）。
 * 这就是推理引擎每次 decode 真正跑的那条链 —— 之前所有优化(KV缓存/Flash/量化/批处理)都是在加速它。
 *
 * 值全部现算：固定权重下每段向量、注意力权重、logits、概率、贪心预测都可核对。状态可 JSON 往返（验收标准 2）。
 * 为聚焦机制：d=4、单头单层、Q/K/V 投影取恒等（真实是可学习矩阵），其余权重固定。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type ForwardState = {
  i: number
  seq: string[]            // 输入序列
  vocab: string[]
  stageIdx: number         // 当前走到第几段
  stageName: string        // 段名
  stageLink: string        // 对应哪个实验
  vec: number[]            // 本段末（最后一个 token 的）向量
  attn: number[] | null    // 注意力权重（只在注意力段有）
  logits: number[] | null  // logits（只在 LM 头段有）
  probs: number[] | null   // softmax 概率（只在采样段有）
  predicted: string | null // 贪心预测的下一个 token
  detail: string           // 本段一句话
  phase: 'run' | 'done'
  log: string
}

export const FORWARD_VISIBLE = [
  'i', 'seq', 'vocab', 'stageIdx', 'stageName', 'stageLink', 'vec', 'attn', 'logits', 'probs', 'predicted', 'detail', 'phase', 'log',
] as const

type Frame = Omit<ForwardState, 'i'>
const r2 = (v: number) => Math.round(v * 100) / 100

//  —— 小工具 ——
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)
const add = (a: number[], b: number[]) => a.map((x, i) => x + b[i])
const matvec = (M: number[][], v: number[]) => M.map(row => dot(row, v))  // M:[out×in], v:[in] → [out]
const relu = (v: number[]) => v.map(x => Math.max(0, x))
function rmsnorm(v: number[]): number[] {
  const ms = v.reduce((s, x) => s + x * x, 0) / v.length
  const rms = Math.sqrt(ms) || 1
  return v.map(x => x / rms)
}
function softmax(xs: number[]): number[] {
  const m = Math.max(...xs)
  const e = xs.map(x => Math.exp(x - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map(x => x / s)
}

//  —— 固定模型 ——
const VOCAB = ['猫', '吃', '鱼', '跑']
const EMB: Record<string, number[]> = {
  猫: [1.0, 0.5, -0.5, 0.2],
  吃: [0.3, -0.4, 0.8, 0.1],
  鱼: [-0.2, 0.9, 0.4, -0.6],
  跑: [0.6, 0.1, -0.3, 0.7],
}
//  FFN：升维 W1[4×4]、降维 W2[4×4]（relu 夹中间）
const W1 = [
  [0.8, -0.3, 0.5, 0.1],
  [0.2, 0.7, -0.4, 0.6],
  [-0.5, 0.4, 0.9, -0.2],
  [0.3, 0.1, -0.6, 0.8],
]
const W2 = [
  [0.5, 0.2, -0.3, 0.4],
  [-0.2, 0.6, 0.1, -0.5],
  [0.7, -0.4, 0.3, 0.2],
  [0.1, 0.5, -0.6, 0.3],
]
//  LM 头 Wout[vocab×d]：拿末向量点每个词的方向
const WOUT = [
  [0.9, 0.3, -0.4, 0.2],   // 猫
  [0.2, -0.5, 0.7, 0.1],   // 吃
  [-0.3, 0.8, 1.5, -0.4],  // 鱼
  [0.6, 0.1, -0.2, 0.9],   // 跑
]

export const forwardKernel: Kernel<ForwardState> = {
  kind: 'forward',

  compile(_doc: SimDocument): CompiledModel<ForwardState> {
    const seq = ['猫', '吃']
    const d = 4
    const scale = Math.sqrt(d)

    //  嵌入两个 token
    const e = seq.map(t => EMB[t])
    //  预注意力 RMSNorm（每个位置各自归一化）
    const nPre = e.map(rmsnorm)
    //  自注意力（Q/K/V = 归一化后的向量；恒等投影）。最后位置(1)因果地看 0,1
    const q = nPre[1]
    const scores = nPre.map(k => dot(q, k) / scale)   // 对 key 0,1
    const attnW = softmax(scores)                      // 因果下 0,1 都可见
    const attnOut = [0, 1, 2, 3].map(dim => attnW[0] * nPre[0][dim] + attnW[1] * nPre[1][dim])
    //  残差 1（加回最后 token 的原始嵌入）
    const res1 = add(e[1], attnOut)
    //  预 FFN RMSNorm
    const nMid = rmsnorm(res1)
    //  FFN：relu(W1·x)·W2
    const ffnH = relu(matvec(W1, nMid))
    const ffnOut = matvec(W2, ffnH)
    //  残差 2
    const res2 = add(res1, ffnOut)
    //  末层 RMSNorm
    const nFin = rmsnorm(res2)
    //  LM 头 → logits → softmax → 贪心
    const logits = matvec(WOUT, nFin)
    const probs = softmax(logits)
    const bestIdx = probs.reduce((bi, p, i, a) => (p > a[bi] ? i : bi), 0)
    const predicted = VOCAB[bestIdx]

    type S = { name: string; link: string; vec: number[]; attn?: number[]; logits?: number[]; probs?: number[]; detail: string }
    const stages: S[] = [
      { name: '① 词嵌入 embed', link: '参数量与显存', vec: e[1], detail: `token「${seq[1]}」查嵌入表 → 4 维向量。序列另一个 token「${seq[0]}」也一起嵌入。` },
      { name: '② RMSNorm（注意力前）', link: 'RMSNorm', vec: nPre[1], detail: '把向量除以均方根拉到单位尺度，稳住数值再进注意力。' },
      { name: '③ 自注意力', link: '缩放点积+因果掩码 / 自注意力', vec: attnOut, attn: attnW, detail: `末 token 的 Q 和每个 K 点积÷√d→softmax 得注意力权重，再加权求和各 V。因果掩码下它能看 0、1。` },
      { name: '④ 残差相加', link: '—', vec: res1, detail: '注意力输出加回输入（残差连接），信息叠加、梯度好传。' },
      { name: '⑤ RMSNorm（FFN 前）', link: 'RMSNorm', vec: nMid, detail: '进 FFN 前再归一化一次。' },
      { name: '⑥ 前馈网络 FFN', link: 'FFN 与 MoE 路由', vec: ffnOut, detail: 'relu(W1·x)·W2：升维→激活→降维，每层参数量最大的块（这里是稠密版，MoE 是它的稀疏版）。' },
      { name: '⑦ 残差相加', link: '—', vec: res2, detail: 'FFN 输出再加回，一层 Transformer 块到此结束。' },
      { name: '⑧ 末层 RMSNorm', link: 'RMSNorm', vec: nFin, detail: '所有层跑完后最后归一化一次，准备投影到词表。' },
      { name: '⑨ LM 头 → logits', link: '参数量与显存', vec: nFin, logits, detail: '末向量乘 Wout，得到每个词的原始打分 logit（可正可负、和不为 1）。' },
      { name: '⑩ softmax → 采样', link: '采样解码 / softmax', vec: nFin, logits, probs, detail: `logits 过 softmax 成概率，贪心取最大 → 预测下一个 token「${predicted}」。` },
    ]

    const frames: Frame[] = stages.map((st, idx) => ({
      seq, vocab: VOCAB, stageIdx: idx, stageName: st.name, stageLink: st.link,
      vec: st.vec.map(r2), attn: st.attn ? st.attn.map(r2) : null,
      logits: st.logits ? st.logits.map(r2) : null, probs: st.probs ? st.probs.map(r2) : null,
      predicted: idx === stages.length - 1 ? predicted : null,
      detail: st.detail, phase: 'run',
      log: `${st.name}：${st.detail}`,
    }))
    frames.push({
      seq, vocab: VOCAB, stageIdx: stages.length, stageName: '完成', stageLink: '—',
      vec: nFin.map(r2), attn: null, logits: logits.map(r2), probs: probs.map(r2), predicted,
      detail: '', phase: 'done',
      log: `一次前向走完：「${seq.join('')}」→ 预测「**${predicted}**」（概率 ${(probs[bestIdx] * 100).toFixed(0)}%）。` +
        `这就是每步 decode 真正跑的链 —— KV 缓存、FlashAttention、量化、连续批处理，优化的都是这条链。`,
    })

    const base0: Frame = {
      seq, vocab: VOCAB, stageIdx: -1, stageName: '', stageLink: '', vec: [],
      attn: null, logits: null, probs: null, predicted: null, detail: '', phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '前向段' },
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
