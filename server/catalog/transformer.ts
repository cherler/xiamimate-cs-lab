//  AI 学伴出题目录分片：Transformer 原理（自注意力 / 点积相似 / 前向 / Hopfield 记忆 /
//  归纳头 / 模型规模换算 / 多头 / 正交性 / RMSNorm / RoPE / 采样 / 缩放 / 因果掩码）。
//
//  焊死纪律：每个 fact 的 answer 由 compute(trace) 从引擎真实 trace 算出，绝不硬编码；
//  doc 与 web/src/registry.ts 里该实验的 defaultDoc 逐字一致。
import { attentionKernel } from '../../src/kernels/attention.ts'
import { dotsimKernel } from '../../src/kernels/dotsim.ts'
import { forwardKernel } from '../../src/kernels/forward.ts'
import { hopfieldKernel } from '../../src/kernels/hopfield.ts'
import { inductionKernel } from '../../src/kernels/induction.ts'
import { llmSizeKernel } from '../../src/kernels/llmsize.ts'
import { mhaKernel } from '../../src/kernels/mha.ts'
import { orthoKernel } from '../../src/kernels/ortho.ts'
import { rmsnormKernel } from '../../src/kernels/rmsnorm.ts'
import { ropeKernel } from '../../src/kernels/rope.ts'
import { samplingKernel } from '../../src/kernels/sampling.ts'
import { scaleKernel } from '../../src/kernels/scale.ts'
import { scaledmaskKernel } from '../../src/kernels/scaledmask.ts'
import { numDistractors, last, type CatalogEntry, type Kernel, type Frame } from '../catalog-shared.ts'

//  在 trace 里找满足条件的帧下标；找不到就退回末帧（保证 step 合法）。
const fi = (t: Frame[], pred: (f: Frame) => boolean): number => {
  const i = t.findIndex(pred)
  return i < 0 ? t.length - 1 : i
}
const ev = (f: Frame): string => String(f.log ?? '')
const nums = (f: Frame, key: string): number[] => (f[key] as number[]) ?? []
const strs = (f: Frame, key: string): string[] => (f[key] as string[]) ?? []

export const TRANSFORMER_ENTRIES: CatalogEntry[] = [
  //  ── 自注意力手算 ──────────────────────────────────
  {
    id: 'attention', title: '自注意力手算', kernel: attentionKernel as Kernel<unknown>,
    doc: { kind: 'attention', params: { sentence: '它爱吃鱼' }, entities: [], streams: [] },
    facts: [
      {
        id: 'first_query_top', label: '第一个查询 token 最关注谁', kind: 'choice',
        ask: '例句「它爱吃鱼」里，token「它」经过自注意力后，注意力权重最高落在哪个 token 上？',
        compute: t => {
          const s = fi(t, f => f.phase === 'softmax' && f.qi === 0)
          const w = (t[s].attn as number[][])[0]
          const toks = strs(t[s], 'tokens')
          return { answer: toks[w.indexOf(Math.max(...w))], step: s, evidence: ev(t[s]) }
        },
        distractors: (answer, t) => {
          const s = fi(t, f => f.phase === 'softmax' && f.qi === 0)
          return strs(t[s], 'tokens').filter(x => x !== answer)
        },
      },
      {
        id: 'first_query_top_weight', label: '第一个查询最大注意力权重（百分比）', kind: 'number',
        ask: 'token「它」对它最关注的那个 token，注意力权重大约是百分之几（取整）？',
        compute: t => {
          const s = fi(t, f => f.phase === 'softmax' && f.qi === 0)
          const w = (t[s].attn as number[][])[0]
          return { answer: String(Math.round(Math.max(...w) * 100)), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'token_count', label: '例句被切成几个 token', kind: 'number',
        ask: '例句「它爱吃鱼」在本实验里被切成几个 token？',
        compute: t => {
          const f = last(t)
          return { answer: String(strs(f, 'tokens').length), step: t.length - 1, evidence: ev(f) }
        },
        distractors: numDistractors,
      },
      {
        id: 'why_scale', label: '分数为何除以 √d', kind: 'choice',
        ask: '算出 Q·K 分数后、做 softmax 之前要除以 √d，主要是为了什么？',
        compute: t => {
          const s = fi(t, f => f.phase === 'score' && f.qi === 0)
          return { answer: '防止 softmax 饱和、梯度消失（点积会随维度变大）', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['让注意力权重相加正好等于 1', '把 Q、K 投影到相同维度', '减少注意力的计算量'],
      },
    ],
  },

  //  ── 内积=相似度 ──────────────────────────────────
  {
    id: 'dotsim', title: '内积=相似度', kernel: dotsimKernel as Kernel<unknown>,
    doc: { kind: 'dotsim', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'dot_at_0', label: '同向时内积', kind: 'number',
        ask: '当 a、b 夹角 θ=0°（同向）时，内积 a·b 等于多少？（|a|=3，|b|=2）',
        compute: t => {
          const s = fi(t, f => f.angleDeg === 0)
          return { answer: String(t[s].dot), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'dot_at_90', label: '正交时内积', kind: 'number',
        ask: '当 a、b 夹角 θ=90°（正交）时，内积 a·b 等于多少？',
        compute: t => {
          const s = fi(t, f => f.angleDeg === 90)
          return { answer: String(t[s].dot), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'orthogonal_meaning', label: '正交内积为 0 的含义', kind: 'choice',
        ask: '夹角 90° 时内积恰为 0，这说明两个向量之间是什么关系？',
        compute: t => {
          const s = fi(t, f => f.angleDeg === 90)
          return { answer: '方向无关（正交），相似度为 0', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['两个向量长度都为 0', '两个向量完全相同', '任意两个向量的内积都是 0'],
      },
      {
        id: 'why_qk_dot', label: '注意力为何用 Q·K 打分', kind: 'choice',
        ask: '注意力凭什么用 Q·K 内积给每个 key 打分？',
        compute: t => {
          const s = fi(t, f => f.angleDeg === 0)
          return { answer: '内积越大表示 query 与 key 方向越一致（越相关）', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['内积衡量两个向量的长度差', '内积总是非负，正好当权重', '内积等于两向量的欧氏距离'],
      },
    ],
  },

  //  ── 完整前向拼装 ──────────────────────────────────
  {
    id: 'forward', title: '完整前向拼装', kernel: forwardKernel as Kernel<unknown>,
    doc: { kind: 'forward', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'predicted_token', label: '前向预测的下一个 token', kind: 'choice',
        ask: '把零件串成一次完整前向后，模型贪心预测的下一个 token 是哪个？',
        compute: t => {
          const f = last(t)
          return { answer: String(f.predicted), step: t.length - 1, evidence: ev(f) }
        },
        distractors: (answer, t) => strs(last(t), 'vocab').filter(x => x !== answer),
      },
      {
        id: 'stage_count', label: '前向链分几段', kind: 'number',
        ask: '本实验把一次前向推理拆成了几段（stage）来逐段展示？',
        compute: t => {
          const f = last(t)
          return { answer: String(t.filter(x => x.phase === 'run').length), step: t.length - 1, evidence: ev(f) }
        },
        distractors: numDistractors,
      },
      {
        id: 'rmsnorm_count', label: '前向链里归一化出现几次', kind: 'number',
        ask: '这条前向链里，RMSNorm 归一化一共出现了几次？',
        compute: t => {
          const s = fi(t, f => f.phase === 'run' && String(f.stageName).includes('RMSNorm'))
          return { answer: String(t.filter(x => x.phase === 'run' && String(x.stageName).includes('RMSNorm')).length), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'optimize_relation', label: 'KV缓存/Flash 与前向链的关系', kind: 'choice',
        ask: 'KV 缓存、FlashAttention、量化、连续批处理这些推理优化，和这条前向链是什么关系？',
        compute: t => {
          const f = last(t)
          return { answer: '它们都在加速这同一条前向链，不改变预测结果', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['它们替换掉了链里的注意力这一段', '它们只在训练阶段起作用', '它们会改变最终预测的 token'],
      },
    ],
  },

  //  ── 注意力=联想记忆（Hopfield）─────────────────────
  {
    id: 'hopfield', title: '注意力=联想记忆', kernel: hopfieldKernel as Kernel<unknown>,
    doc: { kind: 'hopfield', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'flipped_bits', label: '初始 query 残缺几位', kind: 'number',
        ask: '实验里的 query 是把存储模式 P0 翻转了几位（残缺几位）当作输入？',
        compute: t => {
          const f = t[0]
          const p0 = (f.patterns as number[][])[0]
          return { answer: String(p0.length - Number(f.matchBits)), step: 0, evidence: ev(f) }
        },
        distractors: numDistractors,
      },
      {
        id: 'final_match_bits', label: '收敛后与 P0 相同的位数', kind: 'number',
        ask: '反复检索收敛后，query 与存储模式 P0 相同的位数是多少（共 8 位）？',
        compute: t => {
          const f = last(t)
          return { answer: String(Number(f.matchBits)), step: t.length - 1, evidence: ev(f) }
        },
        distractors: numDistractors,
      },
      {
        id: 'converged_weight_shape', label: '收敛后权重形态', kind: 'choice',
        ask: '检索收敛后，对 4 个存储模式的注意力权重呈什么形态？',
        compute: t => {
          const s = fi(t, f => f.phase === 'run' && f.converged === true)
          return { answer: 'one-hot（几乎全部权重压在 P0 上）', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['均匀分布（每个模式各约 25%）', '权重全部为 0', '在 P0 和 P1 之间平分'],
      },
      {
        id: 'attention_essence', label: '注意力的本质', kind: 'choice',
        ask: '这个实验想说明注意力的本质是什么？',
        compute: t => {
          const f = last(t)
          return { answer: '按内容寻址的联想记忆（一次注意力=一步 Hopfield 检索）', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['一种给向量排序的算法', '把 query 归一化成单位长度的操作', '统计 token 出现频率的计数器'],
      },
    ],
  },

  //  ── 归纳头 ───────────────────────────────────────
  {
    id: 'induction', title: '归纳头', kernel: inductionKernel as Kernel<unknown>,
    doc: { kind: 'induction', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'prediction', label: '归纳头预测的下一个 token', kind: 'choice',
        ask: '序列 A B C A B C A，归纳头预测下一个 token 是什么？',
        compute: t => {
          const f = last(t)
          return { answer: String(f.prediction), step: t.length - 1, evidence: ev(f) }
        },
        distractors: (answer, t) => [...new Set(strs(last(t), 'seq'))].filter(x => x !== answer),
      },
      {
        id: 'match_count', label: '注意力落在几个位置', kind: 'number',
        ask: '归纳头回头扫描时，注意力落在了几个位置上？',
        compute: t => {
          const s = fi(t, f => f.stage === 'scan')
          return { answer: String(nums(t[s], 'matches').length), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'seq_len', label: '序列长度', kind: 'number',
        ask: '本实验给归纳头的输入序列一共有几个 token？',
        compute: t => {
          const f = t[0]
          return { answer: String(strs(f, 'seq').length), step: 0, evidence: ev(f) }
        },
        distractors: numDistractors,
      },
      {
        id: 'induction_rule', label: '归纳头的匹配规则', kind: 'choice',
        ask: '归纳头靠什么规则决定回头把注意力放到哪些位置？',
        compute: t => {
          const s = fi(t, f => f.stage === 'scan')
          return { answer: '找“前一个 token 正好是当前 token”的位置', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['找出现次数最多的 token', '找与当前 token 距离最近的位置', '直接复制序列里最后一个 token'],
      },
    ],
  },

  //  ── 参数量与显存 ──────────────────────────────────
  {
    id: 'llmsize', title: '参数量与显存', kernel: llmSizeKernel as Kernel<unknown>,
    doc: { kind: 'llmsize', params: { model: 'GPT-2 (124M)', dtype: 'fp16', seq: 2048 }, entities: [], streams: [] },
    facts: [
      {
        id: 'layers', label: 'GPT-2 (124M) 层数', kind: 'number',
        ask: '按标准结构拆解，GPT-2 (124M) 一共有多少层 Transformer 层？',
        compute: t => {
          const s = fi(t, f => f.phase === 'total')
          return { answer: String(Number(t[s].L)), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'ffn_attn_ratio', label: '每层 FFN 参数是注意力的几倍', kind: 'number',
        ask: '每层里，FFN 的参数量是注意力（Q/K/V/O 四个投影）参数量的几倍？',
        compute: t => {
          const s = fi(t, f => f.phase === 'ffn')
          return { answer: String(Number(t[s].ffnPerLayer) / Number(t[s].attnPerLayer)), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'weight_mem_formula', label: '权重显存怎么估', kind: 'choice',
        ask: '模型权重占多少显存，怎么估算？',
        compute: t => {
          const s = fi(t, f => f.phase === 'weight')
          return { answer: '参数总量 × 每个参数的字节数', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['层数 × 序列长度', '词表大小 × 精度字节', 'KV 缓存 × 层数'],
      },
      {
        id: 'kv_growth', label: 'KV 缓存随什么涨', kind: 'choice',
        ask: 'KV 缓存显存主要随什么线性增长？',
        compute: t => {
          const s = fi(t, f => f.phase === 'kv')
          return { answer: '序列长度与并发数（batch）', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['模型层数的平方', '词表大小', '训练步数'],
      },
    ],
  },

  //  ── 多头注意力 MHA / MQA / GQA ─────────────────────
  {
    id: 'mha', title: 'MHA / MQA / GQA', kernel: mhaKernel as Kernel<unknown>,
    doc: { kind: 'mha', params: { variant: 'GQA', heads: 8, groups: 2 }, entities: [], streams: [] },
    facts: [
      {
        id: 'kv_heads', label: 'GQA 下的 KV 头数', kind: 'number',
        ask: '默认配置（GQA，8 个 query 头、2 组）下有多少个 KV 头？',
        compute: t => {
          const f = last(t)
          return { answer: String(Number(f.kvHeads)), step: t.length - 1, evidence: ev(f) }
        },
        distractors: numDistractors,
      },
      {
        id: 'kv_ratio_pct', label: 'KV 缓存占 MHA 的百分比', kind: 'number',
        ask: '这个配置下，KV 缓存是同规模 MHA 的百分之几？',
        compute: t => {
          const f = last(t)
          return { answer: String(Math.round(Number(f.kvRatio) * 100)), step: t.length - 1, evidence: ev(f) }
        },
        distractors: numDistractors,
      },
      {
        id: 'why_gqa_saves', label: 'GQA 为何省 KV 缓存', kind: 'choice',
        ask: 'GQA 为什么能比 MHA 省 KV 缓存？',
        compute: t => {
          const f = last(t)
          return { answer: 'KV 缓存 ∝ KV 头数，GQA 让多个 query 头共享少数 KV 头', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['因为它减少了 query 头的数量', '因为它降低了每个头的维度', '因为它跳过了 softmax 计算'],
      },
      {
        id: 'assign_meaning', label: 'assign 阶段做的事', kind: 'choice',
        ask: '逐 query 头的 assign 阶段，每个 query 头做的是什么事？',
        compute: t => {
          const s = fi(t, f => f.act === 'assign' && f.focus === 0)
          return { answer: '被映射到某个 KV 头去读取它的 K、V', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['计算自己那份 softmax 权重', '把所有 query 头的输出相加', '直接生成下一个 token'],
      },
    ],
  },

  //  ── 高维近正交 ────────────────────────────────────
  {
    id: 'ortho', title: '高维近正交', kernel: orthoKernel as Kernel<unknown>,
    doc: { kind: 'ortho', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'pair_count', label: '8 个向量的配对数', kind: 'number',
        ask: '8 个随机向量两两配对，一共要算多少对夹角余弦？',
        compute: t => {
          const s = fi(t, f => f.phase === 'run')
          return { answer: String(nums(t[s], 'cosines').length), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'd_count', label: '对比了几个维度', kind: 'number',
        ask: '实验逐步取了几个不同的维度 d 来做对比？',
        compute: t => {
          const f = last(t)
          return { answer: String(t.filter(x => x.phase === 'run').length), step: t.length - 1, evidence: ev(f) }
        },
        distractors: numDistractors,
      },
      {
        id: 'std_trend', label: '余弦标准差随 d 的变化', kind: 'choice',
        ask: '随机单位向量两两余弦的标准差，随维度 d 增大怎么变化？',
        compute: t => {
          const f = last(t)
          return { answer: '约等于 1/√d，d 越大越贴近 0（越正交）', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['随 d 线性增大', '与 d 无关，恒为 0.5', '随 d 增大而增大'],
      },
      {
        id: 'capacity', label: '嵌入为何有容量', kind: 'choice',
        ask: '为什么几百上千维的嵌入能装下十几万个词还几乎不打架？',
        compute: t => {
          const f = last(t)
          return { answer: '高维随机方向几乎两两正交，可容纳指数级多的近正交方向', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['因为每个词用一个整数编号', '因为维度越高向量模长越大', '因为训练时强制所有词向量正交'],
      },
    ],
  },

  //  ── RMSNorm 归一化 ────────────────────────────────
  {
    id: 'rmsnorm', title: 'RMSNorm 归一化', kernel: rmsnormKernel as Kernel<unknown>,
    doc: { kind: 'rmsnorm', params: { gain: '全 1' }, entities: [], streams: [] },
    facts: [
      {
        id: 'mean_sq', label: '输入向量的均方', kind: 'number',
        ask: '输入 x=[2,-4,1,3] 的均方 mean(x²) 等于多少？',
        compute: t => {
          const s = fi(t, f => f.phase === 'square')
          return { answer: String(Number(t[s].meanSq)), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'out_rms', label: '归一化后的 RMS', kind: 'number',
        ask: '归一化后（未乘增益）的向量，其 RMS 等于多少？',
        compute: t => {
          const f = last(t)
          return { answer: String(Number(f.outRms)), step: t.length - 1, evidence: ev(f) }
        },
        distractors: numDistractors,
      },
      {
        id: 'vs_layernorm', label: 'RMSNorm 与 LayerNorm 的区别', kind: 'choice',
        ask: 'RMSNorm 相比 LayerNorm，最关键的区别是什么？',
        compute: t => {
          const s = fi(t, f => f.phase === 'rms')
          return { answer: 'RMSNorm 不减均值，只除以均方根 RMS', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['RMSNorm 多用一个偏置参数', 'RMSNorm 用最大值代替均值来归一化', 'RMSNorm 不需要可学习增益'],
      },
      {
        id: 'unit_scale', label: '归一化拉到什么尺度', kind: 'choice',
        ask: 'RMSNorm 的归一化把向量拉到了什么尺度？',
        compute: t => {
          const f = last(t)
          return { answer: '单位均方根（RMS=1）的尺度', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['零均值单位方差', '所有维度都变成 1', '和为 1 的概率分布'],
      },
    ],
  },

  //  ── RoPE 旋转位置编码 ─────────────────────────────
  {
    id: 'rope', title: 'RoPE 旋转位置编码', kernel: ropeKernel as Kernel<unknown>,
    doc: { kind: 'rope', params: { theta: 45 }, entities: [], streams: [] },
    facts: [
      {
        id: 'norm_value', label: '旋转后向量模长', kind: 'number',
        ask: '每个位置旋转后的向量，模长 |v| 等于多少？',
        compute: t => {
          const s = fi(t, f => f.phase === 'rotate')
          return { answer: String(Number(t[s].norm)), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'angle_at_p2', label: '位置 2 的旋转角', kind: 'number',
        ask: '每位旋转角 θ=45° 时，位置 p=2 的向量总共转到了多少度？',
        compute: t => {
          const s = fi(t, f => f.pos === 2)
          return { answer: String(Number(t[s].angleDeg)), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'relative_position', label: 'RoPE 编码的是哪种位置', kind: 'choice',
        ask: 'RoPE 旋转后，query 与 key 的点积只依赖什么？',
        compute: t => {
          const f = last(t)
          return { answer: '相对位置（点积只依赖位置差 (m−n)·θ）', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['绝对位置（每个位置一个固定编码）', '不编码任何位置信息', '只编码第一个 token 的位置'],
      },
      {
        id: 'why_rotation', label: '为何用旋转而非相加', kind: 'choice',
        ask: 'RoPE 为什么用“旋转”来编码位置，而不是加上一个位置向量？',
        compute: t => {
          const s = fi(t, f => f.phase === 'rotate')
          return { answer: '旋转不改变向量的模长（保范）', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['旋转能增加向量的维度', '旋转让所有向量指向同一方向', '旋转把位置编成整数'],
      },
    ],
  },

  //  ── 采样解码旋钮台 ────────────────────────────────
  {
    id: 'sampling', title: '采样解码旋钮台', kernel: samplingKernel as Kernel<unknown>,
    doc: { kind: 'sampling', params: { temperature: 1, topK: 3, topP: 1, logits: '长尾一堆' }, entities: [], streams: [] },
    facts: [
      {
        id: 'total_candidates', label: '原始候选总数', kind: 'number',
        ask: '截断之前，「长尾一堆」这组一共有几个候选 token？',
        compute: t => {
          const f = last(t)
          return { answer: String(strs(f, 'tokens').length), step: t.length - 1, evidence: ev(f) }
        },
        distractors: numDistractors,
      },
      {
        id: 'kept_count', label: 'top-k=3 后保留几个', kind: 'number',
        ask: '默认温度 1、top-k=3、top-p 关，截断后最终保留几个候选可供采样？',
        compute: t => {
          const f = last(t)
          return { answer: String((f.kept as boolean[]).filter(Boolean).length), step: t.length - 1, evidence: ev(f) }
        },
        distractors: numDistractors,
      },
      {
        id: 'topp_rule', label: 'top-p 的截断规则', kind: 'choice',
        ask: 'top-p（核采样）是按什么规则截断候选的？',
        compute: t => {
          const s = fi(t, f => f.phase === 'topp')
          return { answer: '把概率从大到小累加，保留累计刚超过 p 的那一小撮', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['保留概率最高的固定 p 个', '随机丢弃 p 比例的候选', '保留所有概率大于 p 的 token'],
      },
      {
        id: 'topk_vs_topp', label: 'top-k 与 top-p 的差别', kind: 'choice',
        ask: 'top-k 和 top-p 两把“截断刀”的关键区别是什么？',
        compute: t => {
          const s = fi(t, f => f.phase === 'topk')
          return { answer: 'top-k 按固定个数截断，top-p 按累计概率动态截断', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['两者的规则完全相同', 'top-k 按概率阈值、top-p 按个数', 'top-p 只在训练时使用'],
      },
    ],
  },

  //  ── √d 缩放 ──────────────────────────────────────
  {
    id: 'scale', title: '√d 缩放', kernel: scaleKernel as Kernel<unknown>,
    doc: { kind: 'scale', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'variance_d4', label: 'd=4 时 Q·K 的方差', kind: 'number',
        ask: '维度 d=4 时，Q·K 分数的方差 Var(Q·K) 等于多少？',
        compute: t => {
          const s = fi(t, f => f.phase === 'run' && f.d === 4)
          return { answer: String(Number(t[s].variance)), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'sqrtd_d4', label: 'd=4 时的 √d', kind: 'number',
        ask: '维度 d=4 时，缩放用的 √d 等于多少？',
        compute: t => {
          const s = fi(t, f => f.phase === 'run' && f.d === 4)
          return { answer: String(Number(t[s].sqrtd)), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'why_collapse', label: '不缩放为何塌成 one-hot', kind: 'choice',
        ask: '不做缩放时，为什么 d 越大 softmax 越容易塌成近似 one-hot？',
        compute: t => {
          const f = last(t)
          return { answer: 'Q·K 是 d 个乘积之和，方差随 d 增大（∝d），最大分数把其他越拉越开', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['因为 softmax 只对高维生效', '因为温度会随 d 自动升高', '因为 key 的数量变多了'],
      },
      {
        id: 'why_div_sqrtd', label: '除以 √d 的作用', kind: 'choice',
        ask: '注意力分数除以 √d_k 起到什么作用？',
        compute: t => {
          const f = last(t)
          return { answer: '把分数方差拉回 1，softmax 不饱和、梯度不消失', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['让 softmax 的输出之和等于 1', '增加模型的参数量', '把 logits 变成整数'],
      },
    ],
  },

  //  ── 缩放点积 + 因果掩码 ───────────────────────────
  {
    id: 'scaledmask', title: '缩放点积 + 因果掩码', kernel: scaledmaskKernel as Kernel<unknown>,
    doc: { kind: 'scaledmask', params: { d: 4, causal: 1 }, entities: [], streams: [] },
    facts: [
      {
        id: 'sqrt_d', label: 'd=4 的缩放因子', kind: 'number',
        ask: '头维度 d=4 时，注意力分数要除以的缩放因子 √d 等于多少？',
        compute: t => {
          const s = fi(t, f => f.phase === 'row')
          return { answer: String(Number(t[s].scale)), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'row2_visible', label: '第 2 行能看到几个 token', kind: 'number',
        ask: '开启因果掩码后，第 2 行（第 3 个 token）有几个非零的注意力权重？',
        compute: t => {
          const s = fi(t, f => f.phase === 'row' && f.row === 2)
          return { answer: String(nums(t[s], 'weights').filter(w => w > 0).length), step: s, evidence: ev(t[s]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'mask_mechanism', label: '因果掩码怎么实现', kind: 'choice',
        ask: 'causal mask 是怎么让每个词“只看左边”的？',
        compute: t => {
          const s = fi(t, f => f.phase === 'row' && f.row === 0)
          return { answer: '把未来位（j>i）的分数设为 −∞，softmax 后权重恰为 0', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['把未来位的权重直接设成 0.5', '把未来的 token 从序列里删掉', '把未来位的分数设成最大值'],
      },
      {
        id: 'triangle_shape', label: '开掩码后矩阵的形状', kind: 'choice',
        ask: '开启因果掩码后，整张注意力矩阵呈什么形状？',
        compute: t => {
          const f = last(t)
          return { answer: '下三角（每行只在自己及左侧的位置有权重）', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['上三角', '完整方阵（双向全满）', '对角矩阵'],
      },
    ],
  },
]
