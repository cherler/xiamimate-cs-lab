/**
 * 出题目录分片：大模型推理（第二批 · 工程栈）
 *
 * 八台确定性内核：KV 缓存 / KV 换出 / 线性注意力 / PagedAttention /
 * 流水线并行 PP / 前缀缓存 Radix / Roofline 性能建模 / 张量并行。
 *
 * 焊死纪律：每个 fact 的 answer 都由 compute(trace) 从内核真实轨迹里读出来，
 * 不是凭知识写死的；每个 doc 与 web/src/registry.ts 里该实验的 defaultDoc 逐字一致，
 * 否则页面上跑出来的数和出题答案对不上。汇总进 CATALOG 由 catalog.ts 负责。
 */
import { kvcacheKernel } from '../../src/kernels/kvcache.ts'
import { kvoffloadKernel } from '../../src/kernels/kvoffload.ts'
import { linattnKernel, LIN_PHIS, LIN_TASKS } from '../../src/kernels/linattn.ts'
import { pagedKernel } from '../../src/kernels/paged.ts'
import { ppKernel } from '../../src/kernels/pp.ts'
import { radixKernel } from '../../src/kernels/radix.ts'
import { rooflineKernel } from '../../src/kernels/roofline.ts'
import { tensorparKernel } from '../../src/kernels/tensorpar.ts'
import { last, numDistractors, type CatalogEntry, type Kernel } from '../catalog-shared.ts'

export const LLM_INFER_B_ENTRIES: CatalogEntry[] = [
  // ── KV 缓存 ──────────────────────────────────────────
  {
    id: 'kvcache',
    title: 'KV 缓存',
    kernel: kvcacheKernel as Kernel<unknown>,
    doc: { kind: 'kvcache', params: { prompt: 2, total: 6 }, entities: [], streams: [] },
    facts: [
      {
        id: 'saved_pct', label: 'KV 缓存相对无缓存省下的计算百分比',
        ask: '提示词 2 token、总长 6 token 的自回归解码，用 KV 缓存比无缓存少算了百分之多少 K/V?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.savedPct), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'cum_naive', label: '无缓存累计要算的 K/V 次数',
        ask: '同样生成到 6 token，若每步都把整段前缀的 K/V 重算一遍(无缓存)，累计要算多少次 K/V?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.cumNaive), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'cache_size', label: '终态缓存里的 K/V 对数',
        ask: '生成结束时，KV 缓存里存了多少对 K/V(等于最终序列长度)?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.cacheSize), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'tradeoff', label: 'KV 缓存省下计算的代价是什么',
        ask: 'KV 缓存能省下大量重复计算，它换来的代价是什么?',
        kind: 'choice',
        compute: t => {
          const f = last(t)
          return {
            answer: '多占显存——缓存要存下所有算过的 K/V，占用随序列长度线性增长',
            step: t.length - 1,
            evidence: `终态缓存 ${String(f.cacheSize)} 对 K/V；${String(f.log ?? '')}`,
          }
        },
        distractors: () => [
          '牺牲精度——缓存里的 K/V 被压成低精度',
          '增加计算——每步反而要多算一遍前缀',
          '不占任何额外资源，纯赚',
        ],
      },
    ],
  },

  // ── KV 换出 offload ──────────────────────────────────
  {
    id: 'kvoffload',
    title: 'KV 换出 offload',
    kernel: kvoffloadKernel as Kernel<unknown>,
    doc: { kind: 'kvoffload', params: { slots: 3 }, entities: [], streams: [] },
    facts: [
      {
        id: 'offloads', label: '整个访问序列换出到 CPU 的次数',
        ask: 'GPU 3 槽、访问序列 [0,1,2,0,3,1,4,2]，按 LRU 一共把多少个 KV 块换出到 CPU?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.offloads), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'reloads', label: '从 CPU 换入 GPU 的次数',
        ask: '同一序列里，有多少次是把已在 CPU 上的块重新换入 GPU(reload)?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.reloads), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'hits', label: '直接在 GPU 命中的次数',
        ask: '整个访问序列里，有多少次访问的块正好还在 GPU 上(命中)?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.hits), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'policy', label: 'GPU 满时换出哪个块的置换策略',
        ask: 'GPU 槽满、又要放新块时，这个实验换出的是哪个 KV 块?',
        kind: 'choice',
        compute: t => {
          const f = last(t)
          return {
            answer: 'LRU——换出最久没被用过的那个块到 CPU',
            step: t.length - 1,
            evidence: `终态换出 ${String(f.offloads)} 次、换入 ${String(f.reloads)} 次；和 OS 页面置换同一招`,
          }
        },
        distractors: () => [
          'FIFO——换出最早进来的块',
          'LFU——换出被访问次数最少的块',
          '随机挑一个块换出',
        ],
      },
    ],
  },

  // ── 线性注意力：代价不只是"一点误差" ───────────────────
  {
    id: 'linattn',
    title: '线性注意力',
    kernel: linattnKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：老版本是纯公式算术（只有 2N²d / 2Nd² 在换 N），一次注意力都没算过。
        老那几条 fact 全建立在 `ratio`/`stateMem` 这些公式值上，而 d 从 64 改成了 8、
        大 N 挪进了外推表。整批重写。 */
    doc: { kind: 'linattn', params: { phi: LIN_PHIS[0], task: LIN_TASKS[1] }, entities: [], streams: [] },
    facts: [
      {
        /*  ⚠️ 计数题要自带数据 */
        id: 'flops_ratio', label: 'N=32768 时两种注意力的算量倍数', kind: 'number', genre: 'count',
        ask: '头维度 d=8。标准注意力算量 2N²d、线性注意力 2Nd²，所以倍数 = N/d。'
          + '序列 N 拉到 **32768** 时，标准 softmax 注意力的算量是线性注意力的多少倍?',
        compute: t => {
          const big = last(t).big as { n: number; ratio: number }[]
          const x = big[big.length - 1]
          return { answer: String(x.ratio), step: t.length - 1, evidence: `N=${x.n}、d=8 → 倍数 ${x.ratio}` }
        },
        distractors: numDistractors,
      },
      {
        /*  ⭐ 补厚的落点①："一点精度"是个数 */
        id: 'how_much_error', label: '"一点精度"到底是多少', kind: 'choice', genre: 'concept',
        ask: '正文常说线性注意力"拿**一点**精度换算量与显存"。把两种注意力都真算一遍，输出的相对误差大概是什么量级?',
        compute: t => {
          const rows = last(t).rows as { n: number; err: number }[]
          return {
            answer: '几十个百分点 —— 那可不叫"一点"',
            step: t.length - 1,
            evidence: `实测相对误差：${rows.map(r => `N=${r.n} 时 ${r.err}`).join('、')}`,
          }
        },
        distractors: a => [a,
          '千分之几 —— 数值上几乎看不出差别，可以当成等价',
          '百分之几 —— 略有偏差，但对下游任务没有影响',
          '要看序列长度 —— N 越短误差越大，N 长了就收敛到 0',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⭐ 补厚的落点②：真正丢的是"尖锐" */
        id: 'lost_sharpness', label: '线性注意力真正丢掉的是什么', kind: 'choice', genre: 'concept',
        ask: '除了数值误差，线性注意力相比 softmax 注意力**真正丢掉的能力**是什么?',
        compute: t => {
          const rows = last(t).rows as { n: number; smMax: number; linMax: number; smEnt: number; linEnt: number; smHit: number; linHit: number }[]
          const r = rows.find(x => x.n === 64)!
          return {
            answer: '把注意力尖锐地压到一个 token 上的能力 —— 分布平坦得多',
            step: t.length - 1,
            evidence: `实测 N=64：softmax 最大权重 ${r.smMax}（熵 ${r.smEnt}），线性只有 ${r.linMax}（熵 ${r.linEnt}）；`
              + `q₀ 特意对准的那个 key，softmax 给 ${r.smHit}、线性只给 ${r.linHit}`,
          }
        },
        distractors: a => [a,
          '处理长序列的能力 —— 序列一长它就记不住早期的 token 了',
          '并行训练的能力 —— 它只能像 RNN 那样一步步串行地算',
          '区分不同位置的能力 —— 它把序列当成一个无序的集合',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'mechanism', label: '把 O(N²) 压成 O(N) 的关键手法', kind: 'choice', genre: 'concept',
        ask: '线性注意力靠什么把算量从 O(N²) 降到 O(N)、显存降到恒定?',
        compute: t => {
          const f = last(t)
          return {
            answer: '结合律：先算 φ(K)ᵀ·V 得到一个 d×d 状态，再让 φ(Q) 去乘',
            step: t.length - 1,
            evidence: `实测两种乘法顺序输出相对差 ${f.assocErr}（同一个答案），`
              + `而乘加次数 ${f.assocMacFast} vs ${f.assocMacNaive}；状态固定 ${f.stateSize} 个数`,
          }
        },
        distractors: a => [a,
          '稀疏化 N×N 的注意力矩阵，只保留分数最高的少数几项',
          '直接把距离太远的 token 的 K/V 丢掉，只留最近的一段',
          '对 Q 做低秩分解，把矩阵的规模先降下来再算',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⭐ 「测量确认过的公式」这条纪律也出成题 */
        id: 'formula_checked', label: '外推那张表凭什么可信', kind: 'choice', genre: 'concept',
        ask: 'N=32768 那几档**没有真算**，用的是公式 2N²d / 2Nd²。这一屏凭什么敢这么外推?',
        compute: t => ({
          answer: '先在小 N 上把真数出来的乘加次数跟公式逐档核对过',
          step: t.length - 1,
          evidence: `N=8/16/32/64/128 五档上，实测乘加次数跟公式${last(t).formulaOK ? '一模一样' : '对不上'}`,
        }),
        distractors: a => [a,
          '公式是从论文里抄的，论文已经证明过了，不用再核',
          '大 N 真算太慢，只能相信公式 —— 这一步没有办法验证',
          '因为算量本来就是定义出来的，跟实现怎么写没关系',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },
  // ── PagedAttention ───────────────────────────────────
  {
    id: 'paged',
    title: 'PagedAttention',
    kernel: pagedKernel as Kernel<unknown>,
    doc: { kind: 'paged', params: { schedule: '两请求交错', blockSize: 4, totalBlocks: 8 }, entities: [], streams: [] },
    facts: [
      {
        id: 'blocks_used', label: '处理完毕时在用的物理块数',
        ask: '两请求交错、块大小 4、共 8 个物理块，全部处理完后有多少个物理块仍在使用?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          const used = Number(f.totalBlocks) - Number(f.freeCount)
          return { answer: String(used), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'free_blocks', label: '处理完毕时空闲的物理块数',
        ask: '同一场景全部处理完后，空闲块池里还剩多少个物理块?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.freeCount), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'noncontiguous', label: '请求 A 的物理块是否连续',
        ask: '在交错场景里，请求 A 拿到的那几个物理块在物理内存上是连续的吗?',
        kind: 'choice',
        compute: t => {
          const f = last(t)
          const tables = f.tables as Record<string, number[]>
          const a = tables.A ?? []
          return {
            answer: '不连续——如 0、2、4，块表照样把逻辑块映射对，分页不在乎',
            step: t.length - 1,
            evidence: `终态请求 A 的块表 = [${a.join('、')}]`,
          }
        },
        distractors: () => [
          '必须连续——如 0、1、2，否则块表无法映射',
          '全部集中在块池末尾',
          '每次都从物理块 0 重新开始分配',
        ],
      },
      {
        id: 'mechanism', label: 'PagedAttention 解决的核心问题',
        ask: 'PagedAttention 把操作系统的分页搬到 KV 缓存上，它从根上消灭了什么?',
        kind: 'choice',
        compute: t => {
          const f = last(t)
          return {
            answer: '连续分配的外碎片——每请求一张块表映射逻辑块到物理块，块不必连续',
            step: t.length - 1,
            evidence: `终态 ${Number(f.totalBlocks) - Number(f.freeCount)}/${String(f.totalBlocks)} 块在用；${String(f.log ?? '')}`,
          }
        },
        distractors: () => [
          '显存总量不足——靠把 KV 压成低精度省下',
          '跨卡通信开销——靠 all-gather 合并',
          'KV 装不下——靠把块换出到 CPU 内存',
        ],
      },
    ],
  },

  // ── 流水线并行 PP ────────────────────────────────────
  {
    id: 'pp',
    title: '流水线并行 PP',
    kernel: ppKernel as Kernel<unknown>,
    doc: { kind: 'pp', params: { micro: 4 }, entities: [], streams: [] },
    facts: [
      {
        id: 'total_time', label: '4 级流水线 4 微批的总时长',
        ask: 'G=4 级流水线、切成 4 个微批，跑完全部需要多少个时刻(M+G−1)?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.totalTime), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'bubble_pct', label: '气泡占比百分比',
        ask: 'G=4、M=4 时，流水线气泡(空闲)占比是多少百分比?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.bubblePct), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'util', label: '流水线利用率百分比',
        ask: 'G=4、M=4 时，四张卡的整体利用率是多少百分比?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.util), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'fill_bubble', label: '填掉流水线气泡靠什么',
        ask: '只喂一个 batch 时利用率只有 1/G，靠什么把气泡填掉、把利用率提上去?',
        kind: 'choice',
        compute: t => {
          const f = last(t)
          return {
            answer: '把 batch 切成多个微批首尾衔接流入，稳态时每张卡同时各算一个微批',
            step: t.length - 1,
            evidence: `M=${String(f.micro)} 时利用率 ${String(f.util)}%、气泡 ${String(f.bubblePct)}%`,
          }
        },
        distractors: () => [
          '增加流水级数 G，级数越多气泡越小',
          '减少模型层数让单卡装得下',
          '让各卡异步更新、不必等上游算完',
        ],
      },
    ],
  },

  // ── 前缀缓存 Radix Cache ─────────────────────────────
  {
    id: 'radix',
    title: '前缀缓存 Radix Cache',
    kernel: radixKernel as Kernel<unknown>,
    doc: { kind: 'radix', params: { requests: '共享 system 前缀', budget: 12 }, entities: [], streams: [] },
    facts: [
      {
        id: 'saved_total', label: '靠前缀复用累计省下的 prefill token 数',
        ask: '四个共享 system 前缀的请求跑完，靠前缀复用一共省下多少个 token 的 prefill?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.savedTotal), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'seen_total', label: '四个请求的 token 总数',
        ask: '这四个请求加起来一共有多少个 token?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.seenTotal), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'cached', label: '终态前缀树里缓存的 token 结点数',
        ask: '全部请求处理完(预算 12 未触发淘汰)，前缀树里一共缓存了多少个 token 结点?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.cached), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'mechanism', label: 'Radix Cache 省下 prefill 的原理',
        ask: 'Radix Cache 是怎么省掉重复 prefill 的?',
        kind: 'choice',
        compute: t => {
          const f = last(t)
          return {
            answer: '多请求共享同一段前缀，前缀那段的 KV 沿前缀树跨请求复用，命中就不重算',
            step: t.length - 1,
            evidence: `累计 ${String(f.seenTotal)} token、复用省下 ${String(f.savedTotal)} 个的 prefill`,
          }
        },
        distractors: () => [
          '把每个请求的 KV 量化压缩后存下来',
          '把最久没用的 KV 换出到 CPU 再换入',
          '给每个请求各算一遍前缀、互不共享',
        ],
      },
    ],
  },

  // ── Roofline 性能建模 ────────────────────────────────
  {
    id: 'roofline',
    title: 'Roofline 性能建模',
    kernel: rooflineKernel as Kernel<unknown>,
    doc: { kind: 'roofline', params: { d: 4096 }, entities: [], streams: [] },
    facts: [
      {
        id: 'ridge', label: '这台加速卡的脊点 FLOP/字节',
        ask: '峰值算力 312 TFLOP/s、带宽 2 TB/s 的加速卡，脊点(P/B)是多少 FLOP/字节?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.ridge), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'ai_max', label: '批 128 时的算术强度 AI',
        ask: 'd=4096、批大小 128 的权重矩阵乘，算术强度 AI(FLOPs/字节)约是多少?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.ai), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'attain', label: '批 128 时的可达算力',
        ask: 'd=4096、批 128 时，可达性能约是多少 TFLOP/s?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.attainTFLOPs), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'bound', label: '批 128 时的瓶颈类型',
        ask: 'd=4096、批一直加到 128，这个权重矩阵乘的瓶颈是算力还是带宽?',
        kind: 'choice',
        compute: t => {
          const f = last(t)
          return {
            answer: '带宽 memory-bound——算术强度 AI 仍小于脊点 156',
            step: t.length - 1,
            evidence: `批 128 时 AI=${String(f.ai)}、脊点 ${String(f.ridge)}、bound=${String(f.bound)}`,
          }
        },
        distractors: () => [
          '算力 compute-bound——AI 已越过脊点 156',
          '已经打满峰值算力 312 TFLOP/s',
          '瓶颈在跨卡通信带宽',
        ],
      },
    ],
  },

  // ── 张量并行 ─────────────────────────────────────────
  {
    id: 'tensorpar',
    title: '张量并行',
    kernel: tensorparKernel as Kernel<unknown>,
    doc: { kind: 'tensorpar', params: { gpus: 2 }, entities: [], streams: [] },
    facts: [
      {
        id: 'y_first', label: '完整 Y 的第 0 个元素',
        ask: 'X=[1,2,3] 乘按列切分的 W，all-gather 拼出的完整 Y 第 0 个元素是多少?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          const full = f.full as number[]
          return { answer: String(full[0]), step: t.length - 1, evidence: `完整 Y = [${full.join('、')}]` }
        },
        distractors: numDistractors,
      },
      {
        id: 'y_last', label: '完整 Y 的最后一个元素',
        ask: '拼出来的完整 Y 最后一个元素(最后一列)是多少?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          const full = f.full as number[]
          return { answer: String(full[full.length - 1]), step: t.length - 1, evidence: `完整 Y = [${full.join('、')}]` }
        },
        distractors: numDistractors,
      },
      {
        id: 'gpus', label: '参与列并行的 GPU 数',
        ask: '这次张量并行把权重 W 按列切给了几张 GPU?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.G), step: t.length - 1, evidence: `每卡显存/算力占比 1/${String(f.G)}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'mechanism', label: '列并行怎么切、怎么拼',
        ask: '列并行的张量并行是怎么切分权重、又怎么合并结果的?',
        kind: 'choice',
        compute: t => {
          const f = last(t)
          const full = f.full as number[]
          return {
            answer: 'W 按列切成 G 份，第 g 卡算 Y 的对应列片(Y_g=X·W_g)，再 all-gather 拼成完整 Y，结果与单卡一致',
            step: t.length - 1,
            evidence: `G=${String(f.G)}、每卡占 1/${String(f.G)}，拼出 Y=[${full.join('、')}]`,
          }
        },
        distractors: () => [
          '按行切 W，各卡算部分和再 all-reduce 相加',
          '把整个 W 复制到每张卡上各算一遍',
          '把 W 量化到低精度后再分给各卡',
        ],
      },
    ],
  },
]
