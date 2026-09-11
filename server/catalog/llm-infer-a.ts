/**
 * 出题目录分片：大模型推理（工程篇 A）——连续批处理 / 分块预填充 / 集合通信 /
 * DP Attention / 推理引擎 / Engram / 专家并行 / FlashAttention / Flash 解码 共 9 个实验。
 *
 * 焊死纪律：每个 fact 的 compute 都从 traceOfDoc 跑出的真实 trace 里读字段算答案，
 * 不是凭知识硬编码；每个 doc 与 web/src/registry.ts 的 defaultDoc 逐字一致。
 * 由 catalog.ts 汇总进 CATALOG（本文件不改主表）。
 */
import { batchingKernel } from '../../src/kernels/batching.ts'
import { flashKernel } from '../../src/kernels/flash.ts'
import { collectiveKernel } from '../../src/kernels/collective.ts'
import { chunkprefillKernel } from '../../src/kernels/chunkprefill.ts'
import { engineKernel } from '../../src/kernels/engine.ts'
import { epKernel } from '../../src/kernels/ep.ts'
import { dpattnKernel } from '../../src/kernels/dpattn.ts'
import { flashdecodeKernel } from '../../src/kernels/flashdecode.ts'
import { engramKernel, ENGRAM_SEQS } from '../../src/kernels/engram.ts'
import { last, numDistractors, type CatalogEntry, type Kernel } from '../catalog-shared.ts'

export const LLM_INFER_A_ENTRIES: CatalogEntry[] = [
  // ═══ 连续批处理 ═══════════════════════════════════════
  {
    id: 'batching',
    title: '连续批处理',
    kernel: batchingKernel as Kernel<unknown>,
    doc: { kind: 'batching', params: { mode: '连续', slots: 2 }, entities: [], streams: [] },
    facts: [
      {
        id: 'batching-finished',
        label: '连续批处理最终完成的请求总数',
        ask: '这批连续批处理跑到最后一共完成了几个请求?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String((f.finished as string[]).length), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'batching-steps',
        label: '连续批处理用掉的调度步数',
        ask: '连续批处理把全部请求跑完,一共用了多少个调度步?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.step), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'batching-mode',
        label: '连续 vs 静态批处理的关键区别',
        ask: '连续批处理和静态批处理最关键的区别是什么?',
        kind: 'choice',
        compute: t => { const f = last(t); return { answer: '连续批每个 decode 步都补空槽，静态批要整批跑完', step: t.length - 1, evidence: `末态完成 ${(f.finished as string[]).length} 个请求、共 ${String(f.step)} 调度步,空槽随时补` } },
        distractors: () => [
          '连续批处理一次能容纳的请求更多,静态批受槽数限制',
          '连续批处理跳过 prefill 直接 decode,静态批要先 prefill',
          '两者调度相同,只是连续批用更大的 batch size',
        ],
      },
    ],
  },

  // ═══ FlashAttention ══════════════════════════════════
  {
    id: 'flash',
    title: 'FlashAttention',
    kernel: flashKernel as Kernel<unknown>,
    doc: { kind: 'flash', params: { block: 2 }, entities: [], streams: [] },
    facts: [
      {
        id: 'flash-block',
        label: 'FlashAttention 的分块大小(每块键数)',
        ask: '这次 FlashAttention 每个分块里放了几个键?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.blockSize), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'flash-save',
        label: 'FlashAttention 省的到底是什么',
        ask: 'FlashAttention 相比朴素注意力,省下来的到底是什么?',
        kind: 'choice',
        compute: t => { const f = last(t); return { answer: '省的是 HBM 访存，且与一次性 softmax 等价', step: t.length - 1, evidence: `末态在线输出 ${String(f.out)} 与真值 softmax ${String(f.naive)} 的相对误差 ~0` } },
        distractors: () => [
          '省的是计算量,分块后总的乘加次数变少了',
          '靠近似 softmax 换速度,会有一点可控的精度损失',
          '省的是显存,因为不再需要存 K/V 缓存',
        ],
      },
      {
        id: 'flash-online',
        label: '在线 softmax 处理新块的关键操作',
        ask: '在线 softmax 每扫到一个新块,关键的那一步是做什么?',
        kind: 'choice',
        compute: t => { const f = last(t); return { answer: '按 exp(Δmax) 把 l 和 O 缩放对齐再累加', step: t.length - 1, evidence: `末态滚动 m=${String(f.m)}、l=${String(f.l)},逐块对齐累加得 O=${String(f.out)}` } },
        distractors: () => [
          '先算完所有块的局部 softmax,最后一次性归一化',
          '每块独立算 softmax 后直接相加,不需要缩放',
          '把本块分数直接拼进全局分数向量,再统一做 softmax',
        ],
      },
    ],
  },

  // ═══ 集合通信 All-Reduce ═════════════════════════════
  {
    id: 'collective',
    title: '集合通信 All-Reduce',
    kernel: collectiveKernel as Kernel<unknown>,
    doc: { kind: 'collective', params: { gpus: 4 }, entities: [], streams: [] },
    facts: [
      {
        id: 'collective-steps',
        label: '环形 all-reduce 的总步数',
        ask: '这次环形 all-reduce 一共走了多少步?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.totalSteps), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'collective-sum0',
        label: '第一个块的逐元素总和',
        ask: 'all-reduce 结束后,第一个块(各卡该位置求和)的值是多少?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String((f.target as number[])[0]), step: t.length - 1, evidence: `末态每卡都拿到总和 [${(f.target as number[]).join(', ')}]` } },
        distractors: numDistractors,
      },
      {
        id: 'collective-why',
        label: '环形 all-reduce 为何带宽最优',
        ask: '环形 all-reduce 为什么比"人人给人人发"更省带宽?',
        kind: 'choice',
        compute: t => { const f = last(t); return { answer: '每步每卡只收发一个块，总量与卡数无关', step: t.length - 1, evidence: `${String(f.G)} 卡分 reduce-scatter+all-gather 共 2·(G−1)=${String(f.totalSteps)} 步,每步只搬一个块` } },
        distractors: () => [
          '它把消息压缩后再发,所以单条消息更小',
          '它只让一张主卡收集再广播,减少了连接数',
          '它跳过 all-gather 阶段,只做一次 reduce-scatter',
        ],
      },
    ],
  },

  // ═══ Chunked Prefill ═════════════════════════════════
  {
    id: 'chunkprefill',
    title: 'Chunked Prefill',
    kernel: chunkprefillKernel as Kernel<unknown>,
    doc: { kind: 'chunkprefill', params: { chunk: 2 }, entities: [], streams: [] },
    facts: [
      {
        id: 'chunkprefill-first',
        label: 'B 请求的首字延迟时刻',
        ask: '开了 chunked prefill 后,B 的第一个字在第几个时隙吐出?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.firstDecodeAt), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'chunkprefill-total',
        label: '交错时间线的总时间',
        ask: '这条交错时间线一共花了多少个时隙?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.totalTime), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'chunkprefill-gain',
        label: 'chunked prefill 换来的收益',
        ask: 'chunked prefill 把长 prefill 切块交错,主要换来了什么?',
        kind: 'choice',
        compute: t => { const f = last(t); return { answer: '解码中请求的首字延迟大降，总时间几乎不变', step: t.length - 1, evidence: `块大小 ${String(f.chunk)}:B 首字在 t=${String(f.firstDecodeAt)} 吐出,总时间仍是 ${String(f.totalTime)}` } },
        distractors: () => [
          'prefill 总耗时变短,因为切块后并行度更高',
          '总吞吐提升,因为 GPU 利用率被拉满',
          'prefill 结果更精确,因为分块降低了数值误差',
        ],
      },
    ],
  },

  // ═══ 推理引擎 ════════════════════════════════════════
  {
    id: 'engine',
    title: '推理引擎',
    kernel: engineKernel as Kernel<unknown>,
    doc: { kind: 'engine', params: { pool: 4 }, entities: [], streams: [] },
    facts: [
      {
        id: 'engine-gen',
        label: '引擎共生成的 token 数',
        ask: '这台推理引擎跑完,一共生成了多少个 token?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.gen), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'engine-done',
        label: '引擎完成的请求数',
        ask: '引擎主循环结束时完成了几个请求?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String((f.done as string[]).length), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'engine-core',
        label: '连续批处理引擎相对静态批的核心优势',
        ask: '这台连续批处理引擎相比静态批,核心优势在哪里?',
        kind: 'choice',
        compute: t => { const f = last(t); return { answer: '算完随时归还 KV 块和槽位，让给排队的', step: t.length - 1, evidence: `末态完成 ${(f.done as string[]).length}/4 请求、共生成 ${String(f.gen)} token;准入按 FCFS,遇放不下即停(队头阻塞)` } },
        distractors: () => [
          '它能同时 prefill 全部请求,省掉排队环节',
          '它给每个请求单独分一张 GPU,互不干扰',
          '它按最短请求优先调度,缩短平均延迟',
        ],
      },
    ],
  },

  // ═══ 专家并行 EP ═════════════════════════════════════
  {
    id: 'ep',
    title: '专家并行 EP',
    kernel: epKernel as Kernel<unknown>,
    doc: { kind: 'ep', params: { gpus: 4 }, entities: [], streams: [] },
    facts: [
      {
        id: 'ep-maxload',
        label: '最忙那张卡收到的 token 数',
        ask: '专家并行派发后,最忙的那张卡收到了多少个 token?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.maxLoad), step: t.length - 1, evidence: `每卡负载 [${(f.load as number[]).join(', ')}],专家 3 偏热` } },
        distractors: numDistractors,
      },
      {
        id: 'ep-pergpu',
        label: '每张卡分到的专家数',
        ask: 'EP 把 8 个专家分到这些卡后,每张卡放几个专家?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.expertsPerGpu), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'ep-tradeoff',
        label: '专家并行 EP 的收益与代价',
        ask: '专家并行 EP 带来什么好处、代价又是什么?',
        kind: 'choice',
        compute: t => { const f = last(t); return { answer: '专家分片省显存；代价是 all-to-all 和热专家', step: t.length - 1, evidence: `每卡 ${String(f.expertsPerGpu)} 个专家;负载 [${(f.load as number[]).join(', ')}] 最忙 ${String(f.maxLoad)}、最闲 ${String(f.minLoad)}` } },
        distractors: () => [
          '省显存且零通信,因为每卡自带全部专家',
          '省的是计算量,每卡只算 1/G 的乘法、没有额外通信',
          '代价是每层都要 all-reduce 把专家输出拼回来',
        ],
      },
    ],
  },

  // ═══ DP Attention ════════════════════════════════════
  {
    id: 'dpattn',
    title: 'DP Attention',
    kernel: dpattnKernel as Kernel<unknown>,
    doc: { kind: 'dpattn', params: { gpus: 4 }, entities: [], streams: [] },
    facts: [
      {
        id: 'dpattn-tpcomm',
        label: 'TP 每层 all-reduce 的通信量',
        ask: '张量并行下,每层 all-reduce 每个 token 要通信多少个元素?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.tpComm), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'dpattn-dpcomm',
        label: 'DP Attention 注意力段的通信量',
        ask: 'DP Attention 在注意力这一段的通信量是多少?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.dpComm), step: t.length - 1, evidence: `DP 按请求切、每卡 ${String(f.reqPerGpu)} 请求,注意力零通信` } },
        distractors: numDistractors,
      },
      {
        id: 'dpattn-tradeoff',
        label: 'DP 与 TP 铺注意力的权衡',
        ask: '注意力用 DP(数据并行)而不是 TP(张量并行)铺到多卡,权衡是什么?',
        kind: 'choice',
        compute: t => { const f = last(t); return { answer: 'DP 按请求切、注意力段零通信；但每卡要存整套权重', step: t.length - 1, evidence: `TP 每层通信 ${String(f.tpComm)} 元素/token、每卡 ${String(f.headsPerGpu)} 头;DP 通信 ${String(f.dpComm)}、每卡 ${String(f.reqPerGpu)} 请求` } },
        distractors: () => [
          'DP 零通信且权重也省成 1/G,全面优于 TP',
          'DP 每层要 all-reduce、TP 零通信,所以贵的部分该用 DP',
          '两者通信量相同,只是 DP 把切"头"换成切"请求"',
        ],
      },
    ],
  },

  // ═══ Flash Decode ════════════════════════════════════
  {
    id: 'flashdecode',
    title: 'Flash Decode',
    kernel: flashdecodeKernel as Kernel<unknown>,
    doc: { kind: 'flashdecode', params: { chunks: 4 }, entities: [], streams: [] },
    facts: [
      {
        id: 'flashdecode-seq',
        label: '顺序扫 KV 的时延',
        ask: '不切块、顺序扫完这条 KV,时延大约是多少?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.seqLatency), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'flashdecode-par',
        label: '切块并行后的时延',
        ask: '把 KV 切成 4 块并行后,时延大约降到多少?',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.parLatency), step: t.length - 1, evidence: `KV 切 ${String(f.chunks)} 块并行,时延从 ~${String(f.seqLatency)} 降到 ~${String(f.parLatency)}` } },
        distractors: numDistractors,
      },
      {
        id: 'flashdecode-split',
        label: 'Flash Decode 相对 FlashAttention 的切法',
        ask: 'Flash Decode 相比 prefill 阶段的 FlashAttention,换了什么切法?',
        kind: 'choice',
        compute: t => { const f = last(t); return { answer: '把长 KV 切成 C 块并行，再合并回来', step: t.length - 1, evidence: `1 query 对 N=${String(f.n)} 个 KV,切 ${String(f.chunks)} 块,时延 ~${String(f.seqLatency)}→~${String(f.parLatency)}` } },
        distractors: () => [
          '把 1 个 query 复制成 C 份分到多卡并行',
          '按注意力头切成 C 块,每块算一部分头',
          '跳过 softmax,直接对各 KV 分块取平均',
        ],
      },
      {
        id: 'flashdecode-exact',
        label: 'Flash Decode 合并结果的精确性',
        ask: 'Flash Decode 把各块局部结果合并后,和一次性 softmax 是什么关系?',
        kind: 'choice',
        compute: t => { const f = last(t); return { answer: '用全局最大值重缩放，结果完全相等', step: t.length - 1, evidence: `合并输出 ${String(f.output)} 与一次性 softmax·V 对照 ${String(f.fullOutput)} 相等` } },
        distractors: () => [
          '是近似结果,分块越多误差越大',
          '只在各块分数接近时才相等,否则有偏差',
          '相等,但会损失一点精度来换取速度',
        ],
      },
    ],
  },

  // ═══ Engram · n-gram 记忆：它便宜在哪、又贵在哪 ═══════
  {
    id: 'engram',
    title: 'Engram · n-gram 记忆',
    kernel: engramKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：老版本用的是完美周期序列、n 写死 3 —— 查表必然命中、预测必然对。
        老那几条 fact 全建立在"必然命中"上（"预测的下一个 token 是哪个"）。整批重写。 */
    doc: { kind: 'engram', params: { seq: ENGRAM_SEQS[1], n: 3 }, entities: [], streams: [] },
    facts: [
      {
        id: 'engram-table', label: 'n-gram 记忆表的表项数', kind: 'number', genre: 'count',
        ask: '扫完序列建好的 n-gram 表里有几个表项（不同的「前缀→下一个」组合）?',
        compute: t => { const f = last(t)
          return { answer: String((f.table as unknown[]).length), step: t.length - 1,
            evidence: `序列 ${(f.seq as string[]).join(' ')}，n=${f.ngram}` } },
        distractors: numDistractors,
      },
      {
        /*  ⚠️ 计数题要自带数据 */
        id: 'engram-hit-n5', label: 'n=5 时的命中率', kind: 'number', genre: 'count',
        ask: '在「带噪周期」序列上逐位置评测（每个位置只拿它之前的历史建表），实测命中率是：'
          + 'n=2 → 71%、n=3 → 56%、n=4 → 40%、n=5 → ?。**n=5 那一档的命中率是多少**（填百分数的整数部分）?',
        compute: t => {
          const rows = last(t).rows as { n: number; hitRate: number }[]
          const x = rows.find(r => r.n === 5)!
          return { answer: String(Math.round(x.hitRate * 100)), step: t.length - 1,
            evidence: `命中率：${rows.map(r => `n=${r.n} ${(r.hitRate * 100).toFixed(0)}%`).join('、')}` }
        },
        distractors: numDistractors,
      },
      {
        /*  ⭐ 补厚的落点①：n-gram 那对此消彼长的毛病 */
        id: 'engram-tradeoff', label: 'n 调大调小各有什么毛病', kind: 'choice', genre: 'concept',
        ask: 'n-gram 记忆表的 n 调大或调小，各会带来什么问题?',
        compute: t => {
          const rows = last(t).rows as { n: number; hitRate: number; ambRate: number; acc: number }[]
          return {
            answer: 'n 大了容易 miss（前缀没见过），n 小了容易跟错好几种情况',
            step: t.length - 1,
            evidence: `实测：${rows.map(r => `n=${r.n} 命中 ${(r.hitRate * 100).toFixed(0)}%、歧义 ${(r.ambRate * 100).toFixed(0)}%`).join('；')}`,
          }
        },
        distractors: a => [a,
          'n 大了 hit 率更高、n 小了 miss 多，只是命中率取舍',
          'n 大了表更小、n 小了表更大 —— 只影响 memory 占用，不影响预测',
          'n 怎么调结果都一样 —— 只要 pattern 出现过，多长的前缀都查得到',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⭐ 补厚的落点②：那条演不出来的序列 */
        id: 'engram-window-null', label: '哪条序列演不出"不受窗口限制"', kind: 'choice', genre: 'concept',
        ask: '要证明 n-gram 记忆"不受注意力窗口限制"，得跟一个只看最近几个 token 的基线比。'
          + '**在什么样的序列上这件事根本演不出来**?',
        compute: t => ({
          answer: '周期比窗口还短的序列——该抄的就在窗口里',
          step: t.length - 1,
          evidence: '实测：完美周期（周期 4）序列上，查表和只看最近 6 个 token 的基线都是 82%，两条线一样齐',
        }),
        distractors: a => [a,
          '完全随机的序列 —— 什么模式都没有，两边都预测不出来',
          '很长的序列 —— 表太大了，查表反而变慢',
          '词表很小的序列 —— 候选太少，随便猜都能猜中',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'engram-vs-induction', label: 'Engram 与归纳头的机制差别', kind: 'choice', genre: 'concept',
        ask: 'Engram 的 n-gram 记忆和 Transformer 的"归纳头"机制上有什么不同?',
        compute: t => ({
          answer: 'Engram 是显式的非参数化查表，归纳头是学出来的软注意力',
          step: t.length - 1,
          evidence: '目标像（都在回头找"上次它之后是什么"），但一个 O(1) 便宜、一个 O(N) 贵；'
            + 'Engram 只会照抄见过的，miss 或歧义时就得把活交回给注意力 —— 这才是"互补"',
        }),
        distractors: a => [a,
          '两者都是学出来的注意力，只是 Engram 的层数更少一些',
          'Engram 用 O(N²) 打分、归纳头用 O(1) 查表，正好反过来',
          'Engram 会随着训练更新权重，而归纳头是固定的查表',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },
]
