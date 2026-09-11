//  AI 学伴出题目录分片：Transformer 原理（自注意力 / 点积相似 / 前向 / Hopfield 记忆 /
//  归纳头 / 模型规模换算 / 多头 / 正交性 / RMSNorm / RoPE / 采样 / 缩放 / 因果掩码）。
//
//  焊死纪律：每个 fact 的 answer 由 compute(trace) 从引擎真实 trace 算出，绝不硬编码；
//  doc 与 web/src/registry.ts 里该实验的 defaultDoc 逐字一致。
import { attentionKernel } from '../../src/kernels/attention.ts'
import { dotsimKernel } from '../../src/kernels/dotsim.ts'
import { forwardKernel, FWD_CACHE, FWD_DECODE } from '../../src/kernels/forward.ts'
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
          return { answer: '防 softmax 饱和、梯度消失', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['让 softmax 输出之和正好为 1', '把 Q、K 投影到同一维度 d', '减少 QKᵀ 那一步的计算量'],
      },
    ],
  },

  //  ── 内积=相似度 ──────────────────────────────────
  {
    id: 'dotsim', title: '内积=相似度', kernel: dotsimKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：老版本是 2 维、5 个手挑角度，而正文写着「高维近正交」——
        2 维里那句话根本不成立。现在维度是旋钮，随机向量的余弦分布是抽出来的。 */
    doc: { kind: 'dotsim', params: { dim: 64, score: '原始内积 a·b' }, entities: [], streams: [] },
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
        distractors: () => ['两个向量的长度恰好都等于 0', '两个向量的方向是完全相同的', '任意两个向量之间的内积都是 0'],
      },
      {
        id: 'why_qk_dot', label: '注意力为何用 Q·K 打分', kind: 'choice',
        ask: '注意力凭什么用 Q·K 内积给每个 key 打分？',
        compute: t => {
          const s = fi(t, f => f.angleDeg === 0)
          return { answer: '内积越大说明方向越一致（越相关）', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['内积衡量的是两个向量之间的长度差', '内积总是非负的，正好拿来当作权重', '内积等于两个向量之间的欧氏距离'],
      },
      {
        /*  ⭐ 补厚的落点①：「高维近正交」是抽出来的，而且在低维是**假的** */
        id: 'high_dim_ortho', label: '"随机方向几乎正交"在几维成立', kind: 'choice', genre: 'concept',
        ask: '"随便抓两个方向，内积几乎总是接近 0"——这句话在几维空间里成立?',
        compute: t => {
          const o = last(t).ortho as { d: number; sd: number; theory: number; bigFrac: number }[]
          return {
            answer: '得高维才成立 —— 低维时两个随机方向常常挨得很近',
            step: t.length - 1,
            evidence: `实测（每档抽 2000 对）：${o.map(x => `d=${x.d} 标准差 ${x.sd}（理论 1/√d=${x.theory}）、|余弦|>0.5 占 ${(x.bigFrac * 100).toFixed(1)}%`).join('；')}`,
          }
        },
        distractors: a => [a,
          '任何维度都成立 —— 随机取的两个方向本来就毫无关系',
          '只在二维三维成立 —— 维度一高向量就都挤到一起去了',
          '跟维度无关 —— 取决于向量的长度分布怎么取',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⚠️ 计数题要自带数据 */
        id: 'ortho_sd_512', label: 'd=512 时随机方向余弦的标准差', kind: 'number', genre: 'count',
        ask: '实测（每档抽 2000 对随机向量）余弦的标准差是：d=2 → 0.703、d=8 → 0.357、d=64 → 0.124、d=512 → ?。'
          + '理论值是 1/√d。**d=512 那一档实测是多少**（填小数点后三位，如 0.703 填 0.703）?',
        compute: t => {
          const o = last(t).ortho as { d: number; sd: number; theory: number }[]
          const x = o.find(y => y.d === 512)!
          return { answer: String(x.sd), step: t.length - 1, evidence: `理论 1/√512 = ${x.theory}，实测 ${x.sd}` }
        },
        distractors: numDistractors,
      },
      {
        /*  ⭐ 补厚的落点②：内积同时编码长度和夹角 —— 检索里的长文档偏置 */
        id: 'length_bias', label: '为什么检索要先归一化', kind: 'choice', genre: 'concept',
        ask: '拿 query 去打一堆文档向量,用**原始内积**排名会出什么问题?',
        compute: t => {
          const d = last(t).docs as { name: string; mag: number; cos: number; rankDot: number; rankCos: number }[]
          const d1 = d.find(x => x.name.startsWith('D1'))!
          return {
            answer: '会系统性偏爱模长大的向量 —— 方向准但短的吃亏',
            step: t.length - 1,
            evidence: `实测：方向最准的 D1（余弦 ${d1.cos}、模长 ${d1.mag}）按余弦排第 ${d1.rankCos}，`
              + `按原始内积却只排第 ${d1.rankDot}；按内积排第一的是「${last(t).topDot}」`,
          }
        },
        distractors: a => [a,
          '会偏爱模长小的向量 —— 短向量的内积数值更稳定',
          '不会有问题 —— 内积和余弦排出来的名次本来就一样',
          '会让负相关的文档排到前面 —— 内积可以是负数',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },

  //  ── 完整前向拼装：decode 一步不算 decode ──────────
  {
    id: 'forward', title: '完整前向拼装', kernel: forwardKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：老版本只跑了一步、只有贪心 —— 而正文写着"每次 decode"和"→ 采样"。
        现在连续跑 4 步、加了 KV 缓存对照和温度采样。 */
    doc: { kind: 'forward', params: { cache: FWD_CACHE[1], decode: FWD_DECODE[0] }, entities: [], streams: [] },
    facts: [
      {
        id: 'predicted_token', label: '前向预测的下一个 token', kind: 'choice', genre: 'concept',
        ask: '把零件串成一次完整前向后，模型贪心预测的下一个 token 是哪个?',
        compute: t => {
          const f = last(t)
          return { answer: String(f.predicted), step: t.length - 1, evidence: ev(f) }
        },
        distractors: (answer, t) => strs(last(t), 'vocab').filter(x => x !== answer),
      },
      {
        /*  ⚠️ 计数题要自带数据 */
        id: 'kv_saving', label: 'KV 缓存省了多少次乘加', kind: 'number', genre: 'count',
        ask: '连续 decode 4 步。**不用 KV 缓存**（每步把全部位置的 K/V 重算一遍）一共 416 次乘加，'
          + '**用 KV 缓存**（只算新来的那一个）一共 344 次。**省了多少次**？',
        compute: t => {
          const f = last(t)
          return { answer: String(Number(f.macWithout) - Number(f.macWith)), step: t.length - 1,
            evidence: `不用缓存 ${f.macWithout}、用缓存 ${f.macWith}` }
        },
        distractors: numDistractors,
      },
      {
        /*  ⭐ 补厚的落点①："优化"这个词的意思 */
        id: 'what_is_optimization', label: '"优化"这个词的意思', kind: 'choice', genre: 'concept',
        ask: 'KV 缓存把这条链的算量从 416 次乘加降到 344 次。**凭什么说它是"优化"而不是"换了个算法"**?',
        compute: t => {
          const f = last(t)
          return {
            answer: '因为输出一个字都没变 —— 逐步 logits 逐位相同',
            step: t.length - 1,
            evidence: `实测：文本${f.sameOut ? '一样' : '不一样'}、逐步 logits ${f.sameLogits ? '逐位相同' : '对不上'}；`
              + `算量 ${f.macWithout} → ${f.macWith}`,
          }
        },
        distractors: a => [a,
          '因为它算得更快 —— 只要速度上去了就是优化',
          '因为它省了显存 —— 缓存下来的 K/V 比重算占的空间小',
          '因为它是论文里公认的做法 —— 大家都这么叫',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⭐ 补厚的落点②：单个种子说明不了温度有没有用 */
        id: 'temp_needs_sampling', label: '怎么看出温度起了作用', kind: 'choice', genre: 'concept',
        ask: '把解码方式从贪心换成温度采样 T=0.7 和 T=1.5，屏幕上两档生成的文本**一模一样**。'
          + '这说明温度没起作用吗?',
        compute: t => {
          const dc = last(t).decodeCmp as { name: string; text: string; differ: number }[]
          return {
            answer: '说明不了 —— 单个种子碰巧抽到同一条，得抽很多个种子看比例',
            step: t.length - 1,
            evidence: `抽 200 个种子量"跟贪心不一样"的比例：${dc.map(x => `${x.name} ${(x.differ * 100).toFixed(0)}%`).join('、')}`,
          }
        },
        distractors: a => [a,
          '说明没起作用 —— 两个温度输出一样，那这个旋钮就是摆设',
          '说明温度只影响概率不影响采样结果 —— argmax 挑的还是同一个',
          '说明词表太小 —— 换个大词表两个温度就分得开了',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'optimize_relation', label: 'KV缓存/Flash 与前向链的关系', kind: 'choice', genre: 'concept',
        ask: 'KV 缓存、FlashAttention、量化、连续批处理这些推理优化，和这条前向链是什么关系?',
        compute: t => ({
          answer: '它们都在加速这同一条链，而且不改变预测结果',
          step: t.length - 1,
          evidence: '这一屏拿 KV 缓存验了一遍：算量降了，逐步 logits 逐位相同',
        }),
        distractors: a => [a,
          '它们把链里的注意力那一段整个替换掉了，换成别的算子',
          '它们只在训练阶段起作用，推理的时候用不上',
          '它们会让预测出来的 token 变得更准一些',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },

  //  ── 注意力=联想记忆（Hopfield）：温度、吸引域、容量 ────
  {
    id: 'hopfield', title: '注意力=联想记忆', kernel: hopfieldKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：β/翻转位数/模式数三个都做成了旋钮，正文里那三句话
        （β 大→精确、落进吸引域就被拉回、容量随维度指数级）现在都是抽出来的数。 */
    doc: { kind: 'hopfield', params: { beta: 6, flip: 2 }, entities: [], streams: [] },
    facts: [
      {
        id: 'flipped_bits', label: '初始 query 残缺几位', kind: 'number', genre: 'count',
        ask: '实验里的 query 是把存储模式 P0 翻转了几位（残缺几位）当作输入？',
        compute: t => ({ answer: String(t[0].flip), step: 0, evidence: `翻了 ${t[0].flip} 位，共 ${t[0].n} 位` }),
        distractors: numDistractors,
      },
      {
        /*  ⚠️ 计数题要自带数据 */
        id: 'basin_edge', label: '吸引域的边界在翻几位', kind: 'number', genre: 'count',
        ask: '随机翻 f 位、每档重采样 200 次，量"还回得到**原模式**"的比例，实测是：'
          + '翻 0 位 100%、翻 1 位 100%、翻 2 位 63%、翻 3 位 42%、翻 4 位 14%。'
          + '**正确率还在 90% 以上的最大翻转位数**是多少？',
        compute: t => ({ answer: String(last(t).basinEdge), step: t.length - 1,
          evidence: `吸引域：${(last(t).basin as { flip: number; ok: number }[]).map(x => `翻${x.flip}位 ${(x.ok * 100).toFixed(0)}%`).join('、')}` }),
        distractors: numDistractors,
      },
      {
        /*  ⭐ 补厚的落点①：β 是那个把行为整个改掉的旋钮 */
        id: 'beta_role', label: 'β 调小会怎样', kind: 'choice', genre: 'concept',
        ask: '把 softmax 的锐度 β（=1/温度）从 6 调到 0.5，检索会变成什么样?',
        compute: t => {
          const bs = last(t).betaSweep as { beta: number; maxW: number; basin2: number; cap16: number }[]
          const lo = bs[0], hi = bs[bs.length - 1]
          return {
            answer: '权重压不出 one-hot，输出变成几个模式的加权平均 —— 谁也不是',
            step: t.length - 1,
            evidence: `实测最大权重 β=${lo.beta} 时 ${lo.maxW}、β=${hi.beta} 时 ${hi.maxW}；`
              + `抽样下 β=${lo.beta} 翻 2 位只有 ${(lo.basin2 * 100).toFixed(0)}% 回得去、存 16 个只认得出 ${(lo.cap16 * 100).toFixed(0)}%`,
          }
        },
        distractors: a => [a,
          '检索会更准 —— 温度高意味着搜索得更充分，不容易卡在局部',
          '完全不影响结果 —— softmax 是单调的，argmax 挑的还是同一个',
          '会收敛得更快 —— 权重差距小，迭代几步就稳定下来了',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⭐ 补厚的落点②：那个栽过的口径问题 */
        id: 'basin_criterion', label: '吸引域该怎么量', kind: 'choice', genre: 'concept',
        ask: '量吸引域时，把 query 翻 f 位，然后判"回忆对不对"。**该拿什么当正确答案**?',
        compute: t => {
          const bs = last(t).basin as { flip: number; ok: number; okNear: number }[]
          return {
            answer: '回到原来那个模式 —— 拿汉明最近当正确，曲线不降',
            step: t.length - 1,
            evidence: `两个口径实测：回原模式 ${bs.map(x => `${(x.ok * 100).toFixed(0)}%`).join('/')}；`
              + `回汉明最近 ${bs.map(x => `${(x.okNear * 100).toFixed(0)}%`).join('/')} —— 后者几乎不随翻转位数变`,
          }
        },
        distractors: a => [a,
          '回到汉明距离最近的那个模式 —— 那才是客观上"应该"检索到的',
          '回到权重最高的那个模式 —— 算法自己认定哪个就是哪个',
          '只要收敛到某个存储模式就算对 —— 回到哪个不重要',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⭐ 补厚的落点③：容量随维度 */
        id: 'capacity_dim', label: '容量跟维度什么关系', kind: 'choice', genre: 'concept',
        ask: '存 M 个随机模式、翻 1 位当 query，问"还认得出原来那个吗"。维度从 8 加到 16，容量怎么变?',
        compute: t => {
          const cap = last(t).cap as { n: number; row: { m: number; ok: number }[] }[]
          const edge = (c: typeof cap[number]) => { const g = c.row.filter(x => x.ok >= 0.9); return g.length ? g[g.length - 1].m : 0 }
          return {
            answer: '涨得比维度快得多 —— 维度翻倍，能存的不止翻倍',
            step: t.length - 1,
            evidence: `实测 N=${cap[0].n}：${cap[0].row.map(x => `M=${x.m} ${(x.ok * 100).toFixed(0)}%`).join('、')}；`
              + `N=${cap[1].n}：${cap[1].row.map(x => `M=${x.m} ${(x.ok * 100).toFixed(0)}%`).join('、')}。`
              + `撑到 90% 的最大 M：${edge(cap[0])} → ${edge(cap[1])}`,
          }
        },
        distractors: a => [a,
          '跟维度成正比 —— 维度翻一倍，能存的也就翻一倍',
          '跟维度无关 —— 能存多少只取决于模式之间的相似度',
          '维度越高反而越少 —— 高维空间里向量更容易互相干扰',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'attention_essence', label: '注意力的本质', kind: 'choice', genre: 'concept',
        ask: '这个实验想说明注意力的本质是什么?',
        compute: t => ({
          answer: '按内容寻址的联想记忆 —— 一次注意力就是一步检索',
          step: t.length - 1,
          evidence: 'weights = softmax(β·query·keys)、output = Σ weights·patterns，把 output 当新 query 再来一次',
        }),
        distractors: a => [a,
          '一种给向量按相关性排序的算法，输出的是排好序的下标',
          '把 query 归一化成单位长度、消除模长影响的一步预处理',
          '统计每个 token 在上下文里出现了多少次的计数器',
        ].filter(o => o !== a).slice(0, 3),
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
          return { answer: '找前一个 token 等于当前的位置', step: s, evidence: ev(t[s]) }
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
          return { answer: '参数总量 × 每个参数占的字节数', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['层数 × 序列长度 × 批大小', '词表大小 × 每个词的精度字节', 'KV 缓存的大小 × 模型的层数'],
      },
      {
        id: 'kv_growth', label: 'KV 缓存随什么涨', kind: 'choice',
        ask: 'KV 缓存显存主要随什么线性增长？',
        compute: t => {
          const s = fi(t, f => f.phase === 'kv')
          return { answer: '序列长度与并发数 batch', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['模型层数的平方，与 seq 无关', '词表大小 vocab，越大越占', '训练步数 step，训久就涨'],
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
          return { answer: 'KV 缓存 ∝ KV 头数，多头共享少数 KV', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['因为它把 query 头的数量减少了一大半还多', '因为它把每个注意力头的维度降低了', '因为它整个跳过了 softmax 那一步计算'],
      },
      {
        id: 'assign_meaning', label: 'assign 阶段做的事', kind: 'choice',
        ask: '逐 query 头的 assign 阶段，每个 query 头做的是什么事？',
        compute: t => {
          const s = fi(t, f => f.act === 'assign' && f.focus === 0)
          return { answer: '被映射到某个 KV 头去读 K、V', step: s, evidence: ev(t[s]) }
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
          return { answer: '约 1/√d，d 越大越贴近正交', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['随 d 线性增大，维度越高越分散', '与 d 完全无关，恒定在 0.5 附近', '随 d 增大而增大，高维反而更像'],
      },
      {
        id: 'capacity', label: '嵌入为何有容量', kind: 'choice',
        ask: '为什么几百上千维的嵌入能装下十几万个词还几乎不打架？',
        compute: t => {
          const f = last(t)
          return { answer: '高维里随机方向几乎两两正交', step: t.length - 1, evidence: ev(f) }
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
          return { answer: 'RMSNorm 不减均值，只除以 RMS', step: s, evidence: ev(t[s]) }
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
        distractors: () => ['零均值、单位方差的那种标准尺度', '所有维度上的数值都被拉成了 1', '归一化成一个和为 1 的概率分布'],
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
          return { answer: '相对位置（只依赖位置差 m−n）', step: t.length - 1, evidence: ev(f) }
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
        distractors: () => ['旋转能顺带把向量的维度增加', '旋转会让所有向量指向同一方向', '旋转把位置直接编成一个个整数'],
      },
    ],
  },

  //  ── 采样解码旋钮台 ────────────────────────────────
  {
    id: 'sampling', title: '采样解码旋钮台', kernel: samplingKernel as Kernel<unknown>,
    doc: { kind: 'sampling', params: { temperature: 1, topK: 0, logits: '长尾一堆' }, entities: [], streams: [] },
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
        id: 'kept_count', label: 'top-p=0.9 时核里保留几个', kind: 'number',
        ask: '温度 1、top-k 关，top-p=0.9（核采样）时最终保留几个候选可供采样？',
        compute: t => {
          const f = fi(t, x => (x.p as number) === 0.9)
          return { answer: String((t[f].kept as boolean[]).filter(Boolean).length), step: f, evidence: ev(t[f]) }
        },
        distractors: numDistractors,
      },
      {
        id: 'topp_rule', label: 'top-p 的截断规则', kind: 'choice',
        ask: 'top-p（核采样）是按什么规则截断候选的？',
        compute: t => {
          const s = fi(t, f => (f.p as number) < 1)
          return { answer: '概率从大到小累加，保留刚超过 p 的', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['保留概率最高的固定 p 个', '随机丢弃 p 比例的候选', '保留所有概率大于 p 的 token'],
      },
      {
        id: 'topk_vs_topp', label: 'top-k 与 top-p 的差别', kind: 'choice',
        ask: 'top-k 和 top-p 两把“截断刀”的关键区别是什么？',
        compute: t => {
          const s = fi(t, f => (f.p as number) < 1)
          return { answer: 'top-k 按固定个数，top-p 按累计概率', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['两者的截断规则其实完全相同，没差别', 'top-k 按概率阈值截、top-p 按个数截', 'top-p 只在训练时用，推理时用不上它'],
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
          return { answer: '方差随 d 增大，最大分数被拉开', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['因为 softmax 只在高维时才生效', '因为温度会随着 d 自动升高', '因为 key 的数量一起变多了'],
      },
      {
        id: 'why_div_sqrtd', label: '除以 √d 的作用', kind: 'choice',
        ask: '注意力分数除以 √d_k 起到什么作用？',
        compute: t => {
          const f = last(t)
          return { answer: '把分数方差拉回 1，不再饱和', step: t.length - 1, evidence: ev(f) }
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
          return { answer: '未来位设 −∞，权重恰为 0', step: s, evidence: ev(t[s]) }
        },
        distractors: () => ['把未来位的权重直接设成 0.5', '把未来的 token 从序列里删掉', '把未来位的分数设成最大值'],
      },
      {
        id: 'triangle_shape', label: '开掩码后矩阵的形状', kind: 'choice',
        ask: '开启因果掩码后，整张注意力矩阵呈什么形状？',
        compute: t => {
          const f = last(t)
          return { answer: '下三角（只在自己及左侧有权重）', step: t.length - 1, evidence: ev(f) }
        },
        distractors: () => ['上三角（只在自己及右侧有权重）', '完整方阵（左右两边全都看得到）', '对角矩阵（只看自己这一个位置）'],
      },
    ],
  },
]
