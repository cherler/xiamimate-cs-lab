/**
 * 内核：完整前向拼装 —— 一次真实推理（Transformer 与 LLM 原理 · 收口 capstone）
 * 轴：逐段走完一次前向 → 再连续 decode 几步 → 结论
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。前向本身是真算的（这一半上一轮就对了），但**只跑了一次、只有贪心**，
 * 于是正文里两句话没兑现：
 *   ①「→ softmax → **采样**下一个 token」，还链到「采样解码」那一屏 ——
 *     而代码里是 `bestIdx`，**只有贪心，从来没采样过**。
 *   ②「这就是推理引擎每次 decode 真正跑的那条链 —— 之前所有优化（**KV 缓存** / Flash / 量化 /
 *     批处理）都是在加速它」—— **decode 只跑了一步**，而且**一个优化都没演**。
 *     KV 缓存尤其该演：它正是这条链上唯一"能省"的地方，前面好几屏都提过它。
 *
 * 这一版：
 * ① **连续 decode 4 步**：把预测出来的 token 接回去再跑 —— **这才叫 decode**。
 * ② ⭐ **KV 缓存做成旋钮**：不用缓存（每步把全部 K/V 重算一遍）vs 用缓存（只算新 token 的）。
 *    **两边的输出必须逐位相同**，而乘加次数差一截 —— 「优化的都是这条链」这才有了实例。
 * ③ **解码方式做成旋钮**：贪心 / 温度 0.7 / 温度 1.5。**"采样"那句话兑现**，
 *    而且看得到温度把输出改掉。
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
  predicted: string | null // 这一步预测/采样出来的下一个 token
  detail: string           // 本段一句话
  /** 当前档：用不用 KV 缓存、怎么解码 */
  cacheName: string
  decodeName: string
  /** ⭐ 连续 decode 出来的几步（当前档） */
  gen: { step: number; token: string; mac: number }[]
  genText: string
  /** ⭐ 两条路的账：用缓存 / 不用缓存，各花多少乘加 */
  macWith: number
  macWithout: number
  /** ⭐ 两条路的输出**必须一样** —— 不然那不叫优化 */
  sameOut: boolean
  sameLogits: boolean
  /** 各档解码方式生成出来的文本 */
  decodeCmp: {
    name: string; text: string
    /**  ⚠️ **单个种子说明不了温度有没有用** —— T=0.7 和 T=1.5 在同一个种子上碰巧抽出同一条。
         这一栏是抽 200 个种子量的："跟贪心不一样"的比例。 */
    differ: number
  }[]
  phase: 'run' | 'done'
  log: string
}

export const FORWARD_VISIBLE = [
  'i', 'seq', 'vocab', 'stageIdx', 'stageName', 'stageLink', 'vec', 'attn', 'logits', 'probs',
  'predicted', 'detail', 'cacheName', 'decodeName', 'gen', 'genText', 'macWith', 'macWithout',
  'sameOut', 'sameLogits', 'decodeCmp', 'phase', 'log',
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
// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const C_OFF = '不用（每步重算全部 K/V）'
const C_ON = '用 KV 缓存（只算新 token）'
export const FWD_CACHE = [C_OFF, C_ON] as const

const D_GREEDY = '贪心（取最大）'
const D_T07 = '温度采样 T=0.7'
const D_T15 = '温度采样 T=1.5'
export const FWD_DECODE = [D_GREEDY, D_T07, D_T15] as const

/** 连续 decode 几步 —— 一步不叫 decode */
const GEN_STEPS = 4

//  LM 头 Wout[vocab×d]：拿末向量点每个词的方向
const WOUT = [
  [0.9, 0.3, -0.4, 0.2],   // 猫
  [0.2, -0.5, 0.7, 0.1],   // 吃
  [-0.3, 0.8, 1.5, -0.4],  // 鱼
  [0.6, 0.1, -0.2, 0.9],   // 跑
]

export const forwardKernel: Kernel<ForwardState> = {
  kind: 'forward',

  compile(doc: SimDocument): CompiledModel<ForwardState> {
    const cacheName = String(doc.params.cache ?? C_ON)
    const decodeName = String(doc.params.decode ?? D_GREEDY)
    const useCache = cacheName === C_ON
    const temp = decodeName === D_T07 ? 0.7 : decodeName === D_T15 ? 1.5 : 0
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

    // ═══════════════════════════════════════════════════════════
    //  ⭐ 连续 decode + KV 缓存对照
    // ═══════════════════════════════════════════════════════════

    /** 种子化 PRNG —— 采样要真随机，整个实验又必须可复现 */
    const rng = (seed: number) => {
      let a = seed >>> 0
      return () => {
        a = (a + 0x6D2B79F5) >>> 0
        let t2 = Math.imul(a ^ (a >>> 15), 1 | a)
        t2 = (t2 + Math.imul(t2 ^ (t2 >>> 7), 61 | t2)) ^ t2
        return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296
      }
    }

    /**
     * 跑一步 decode：给定当前序列，算出下一个 token 的 logits。
     * ⚠️ `cache` 决定 K/V 是**每步重算全部**还是**只算新来的那个**。
     * **两条路必须给出逐位相同的 logits** —— 那才叫"优化"，不是"换了个算法"。
     * `mac` 是**真数出来的**乘加次数，不是公式。
     */
    const decodeStep = (tokens: string[], cache: { k: number[][]; v: number[][] } | null) => {
      let mac = 0
      const emb = tokens.map(t => EMB[t])
      const normed = emb.map(rmsnorm)
      //  ⭐ 这就是 KV 缓存省下的那一块：没缓存要把**全部**位置的 K/V 都算一遍，
      //     有缓存只算**新来的那一个**，前面的直接从缓存里取。
      let K: number[][], V: number[][]
      if (cache) {
        //  只把最后一个位置的 K/V 算出来，接到缓存后面
        const last = normed[normed.length - 1]
        mac += d * 2                       // 新 token 的 K、V 各投影一次（恒等投影也算一次搬运）
        K = [...cache.k, last]
        V = [...cache.v, last]
      } else {
        //  每步把全部位置的 K/V 重算一遍
        mac += normed.length * d * 2
        K = normed.map(x => x.slice())
        V = normed.map(x => x.slice())
      }
      const qv = normed[normed.length - 1]
      const sc = K.map(k => { mac += d; return dot(qv, k) / scale })
      const aw = softmax(sc)
      const ao = Array.from({ length: d }, (_, dim) => {
        mac += K.length
        return aw.reduce((acc, w, j) => acc + w * V[j][dim], 0)
      })
      const r1 = add(emb[emb.length - 1], ao)
      const nm = rmsnorm(r1)
      const h = relu(matvec(W1, nm)); mac += d * d
      const fo = matvec(W2, h); mac += d * d
      const r2v = add(r1, fo)
      const nf = rmsnorm(r2v)
      const lg = matvec(WOUT, nf); mac += VOCAB.length * d
      return { logits: lg, mac, newCache: { k: K, v: V } }
    }

    /** 按当前解码方式挑一个 token */
    const pick = (lg: number[], rand: () => number) => {
      if (temp === 0) return lg.reduce((bi, x, k, arr) => (x > arr[bi] ? k : bi), 0)
      const p = softmax(lg.map(x => x / temp))
      let acc = 0
      const u = rand()
      for (let k = 0; k < p.length; k++) { acc += p[k]; if (u <= acc) return k }
      return p.length - 1
    }

    /** 连续跑 GEN_STEPS 步 —— **这才叫 decode** */
    const runDecode = (withCache: boolean) => {
      const rand = rng(20260909)
      let toks = seq.slice()
      let cache: { k: number[][]; v: number[][] } | null = null
      const out: { step: number; token: string; mac: number; logits: number[] }[] = []
      let total = 0
      for (let t2 = 0; t2 < GEN_STEPS; t2++) {
        const r = decodeStep(toks, withCache ? cache : null)
        total += r.mac
        const idx = pick(r.logits, rand)
        toks = [...toks, VOCAB[idx]]
        if (withCache) cache = r.newCache
        out.push({ step: t2 + 1, token: VOCAB[idx], mac: r.mac, logits: r.logits.map(r2) })
      }
      return { toks, out, total }
    }

    const withCache = runDecode(true)
    const noCache = runDecode(false)
    //  ⭐ 两条路必须给出**一样的输出** —— 不然那不叫优化
    const sameOut = withCache.toks.join('') === noCache.toks.join('')
    const sameLogits = withCache.out.every((x, k) =>
      x.logits.every((v, j) => Math.abs(v - noCache.out[k].logits[j]) < 1e-9))
    const gen = (useCache ? withCache : noCache).out
    const genText = (useCache ? withCache : noCache).toks.join('')
    //  各档解码方式的对照（同样用不用缓存都一样，所以固定用缓存那条跑）
    const r3 = (x: number) => Math.round(x * 1000) / 1000
    //  先把贪心那条算出来当基准
    const greedyText = (() => {
      let tk = seq.slice()
      let ch: { k: number[][]; v: number[][] } | null = null
      for (let t2 = 0; t2 < GEN_STEPS; t2++) {
        const r = decodeStep(tk, ch)
        tk = [...tk, VOCAB[r.logits.reduce((bi, x, k, arr) => (x > arr[bi] ? k : bi), 0)]]
        ch = r.newCache
      }
      return tk.join('')
    })()
    const decodeCmp = FWD_DECODE.map(dn => {
      const tp = dn === D_T07 ? 0.7 : dn === D_T15 ? 1.5 : 0
      const rand = rng(20260909)
      let toks = seq.slice()
      let cache: { k: number[][]; v: number[][] } | null = null
      for (let t2 = 0; t2 < GEN_STEPS; t2++) {
        const r = decodeStep(toks, cache)
        const p = tp === 0
          ? r.logits.reduce((bi, x, k, arr) => (x > arr[bi] ? k : bi), 0)
          : (() => { const pr = softmax(r.logits.map(x => x / tp)); let acc = 0; const u = rand()
            for (let k = 0; k < pr.length; k++) { acc += pr[k]; if (u <= acc) return k } return pr.length - 1 })()
        toks = [...toks, VOCAB[p]]
        cache = r.newCache
      }
      /*  ⚠️ **单个种子说明不了温度有没有用**：T=0.7 和 T=1.5 在这一个种子上碰巧抽出同一条。
          所以再抽 200 个种子，量"跟贪心不一样"的比例 —— 那才是温度真正在做的事。 */
      let differ = 0
      const REPS = 200
      for (let sd = 0; sd < REPS; sd++) {
        const rd = rng(1000 + sd * 7919)
        let tk = seq.slice()
        let ch: { k: number[][]; v: number[][] } | null = null
        for (let t2 = 0; t2 < GEN_STEPS; t2++) {
          const r = decodeStep(tk, ch)
          const p2 = tp === 0
            ? r.logits.reduce((bi, x, k, arr) => (x > arr[bi] ? k : bi), 0)
            : (() => { const pr = softmax(r.logits.map(x => x / tp)); let acc = 0; const u = rd()
              for (let k = 0; k < pr.length; k++) { acc += pr[k]; if (u <= acc) return k } return pr.length - 1 })()
          tk = [...tk, VOCAB[p2]]
          ch = r.newCache
        }
        if (tk.join('') !== greedyText) differ++
      }
      return { name: dn, text: toks.join(''), differ: r3(differ / REPS) }
    })

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

    const shared = {
      cacheName, decodeName,
      gen: gen.map(g => ({ step: g.step, token: g.token, mac: g.mac })),
      genText, macWith: withCache.total, macWithout: noCache.total, sameOut, sameLogits, decodeCmp,
    }

    const frames: Frame[] = stages.map((st, idx) => ({
      ...shared,
      seq, vocab: VOCAB, stageIdx: idx, stageName: st.name, stageLink: st.link,
      vec: st.vec.map(r2), attn: st.attn ? st.attn.map(r2) : null,
      logits: st.logits ? st.logits.map(r2) : null, probs: st.probs ? st.probs.map(r2) : null,
      predicted: idx === stages.length - 1 ? predicted : null,
      detail: st.detail, phase: 'run',
      log: `${st.name}：${st.detail}`,
    }))
    frames.push({
      ...shared,
      seq, vocab: VOCAB, stageIdx: stages.length, stageName: '完成', stageLink: '—',
      vec: nFin.map(r2), attn: null, logits: logits.map(r2), probs: probs.map(r2), predicted,
      detail: '', phase: 'done',
      log: `一次前向走完：「${seq.join('')}」→ 预测「**${predicted}**」（概率 ${(probs[bestIdx] * 100).toFixed(0)}%）。\n\n`
        + `⚠️ **但一步不叫 decode。** 老版本到这儿就收了 —— 而正文写着"这就是推理引擎**每次 decode** 真正跑的那条链"。\n\n`
        + `⭐ **① 连续跑 ${GEN_STEPS} 步**（把预测出来的 token 接回去再跑）：**「${seq.join('')}」→「${genText}」**\n`
        + gen.map(g => `　第 ${g.step} 步 → 「${g.token}」（这一步 ${g.mac} 次乘加）`).join('\n')
        + `\n\n⭐ **② KV 缓存：这条链上唯一"能省"的地方。**\n`
        + `　不用缓存（每步把**全部**位置的 K/V 重算一遍）：**${noCache.total}** 次乘加\n`
        + `　用 KV 缓存（只算**新来的那一个**）：**${withCache.total}** 次乘加\n`
        + `　→ 省了 **${noCache.total - withCache.total}** 次（${((1 - withCache.total / noCache.total) * 100).toFixed(0)}%）\n\n`
        + `⚠️ **而"优化"的前提是输出不能变。** 两条路生成的文本：`
        + `${sameOut ? `**都是「${withCache.toks.join('')}」—— 一样 ✓**` : `⚠️ **不一样**（${withCache.toks.join('')} vs ${noCache.toks.join('')}）`}；`
        + `每一步的 logits ${sameLogits ? '**逐位相同 ✓**' : '⚠️ **对不上**'}。`
        + `**同一个答案、更少的算量 —— 这才叫优化，不是"换了个算法"。**\n\n`
        + `（这里序列才 ${seq.length}+${GEN_STEPS} 个 token，省下的是 ${((1 - withCache.total / noCache.total) * 100).toFixed(0)}%；`
        + `真实推理里上下文动辄几千几万 token，**每步重算全部 K/V 是完全不可行的** —— KV 缓存不是优化，是前提。）\n\n`
        + `⭐ **③ "采样"那句话也兑现了。** 老版本代码里是 \`bestIdx\`，**只有贪心**，而正文写着"softmax → **采样**"、还链到「采样解码」那一屏。现在三档并排：\n`
        + decodeCmp.map(x => `　${x.name}：「**${x.text}**」`
          + `　抽 200 个种子，**跟贪心不一样的占 ${(x.differ * 100).toFixed(0)}%**`).join('\n')
        + `\n\n⚠️ **注意 T=0.7 和 T=1.5 在这一个种子上碰巧抽出了同一条** —— `
        + `**单个种子说明不了温度有没有用**，得看右边那一列：`
        + `贪心 ${(decodeCmp[0].differ * 100).toFixed(0)}%（定义上就是 0）、`
        + `T=0.7 ${(decodeCmp[1].differ * 100).toFixed(0)}%、T=1.5 **${(decodeCmp[2].differ * 100).toFixed(0)}%** —— `
        + `**温度越高，跑偏得越多**。这就是「采样解码」那一屏说的事。\n\n`
        + `这就是每步 decode 真正跑的链 —— **KV 缓存、FlashAttention、量化、连续批处理，优化的都是这条链**。`,
    })

    const base0: Frame = {
      ...shared,
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
