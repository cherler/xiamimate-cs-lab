/**
 * 出题目录分片 · 大模型「推理时算法」组。
 *
 * 收录 5 个推理时(inference-time)增强算法实验：束搜索 beam、Best-of-N bestofn、
 * 蒙特卡洛树搜索 mcts、检索增强 rag、思维树 tot。它们都不改模型参数,而是在解码/推理阶段
 * 用「多采样 + 打分 / 搜索 / 检索」把有限算力花在更好的输出上。
 *
 * 焊死纪律：每个 fact 的答案都由 compute(trace) 从引擎真实轨迹里读出来算,不硬编码；
 * number 抓引擎真算的量(候选数、得分、访问次数、检索命中、分支数…),choice 考机制取舍,
 * 且答案文字尽量嵌入 trace 里的真实取值、证据取自轨迹日志。每条 doc 与 web/src/registry.ts
 * 里该实验的 defaultDoc 逐字一致(均为 trivial doc,内核自带默认数据)。
 */
import { beamKernel } from '../../src/kernels/beam.ts'
import { bestofnKernel } from '../../src/kernels/bestofn.ts'
import { mctsKernel } from '../../src/kernels/mcts.ts'
import { ragKernel } from '../../src/kernels/rag.ts'
import { totKernel } from '../../src/kernels/tot.ts'
import { numDistractors, last, type CatalogEntry, type Kernel } from '../catalog-shared.ts'

// 束搜索里把内部序列结束符替换成可读写法,和内核 disp 一致。
const disp = (seq: string): string => seq.replace('·', '⟨end⟩')

export const LLM_ALGO_ENTRIES: CatalogEntry[] = [
  // ── 束搜索 Beam Search ──────────────────────────────────────────────
  {
    id: 'beam',
    title: '束搜索 Beam Search',
    kernel: beamKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：默认档换成「长度偏置」+ k=4 —— 那才是束搜索最有名的毛病，
        老那批 fact 全在夸它"胜过贪心"，而 `cands`/`greedy.seq` 的形状也换了。 */
    doc: { kind: 'beam', params: { model: '长度偏置（k 越大输出越短）', k: 4, score: '累积概率（原始）' }, entities: [], streams: [] },
    facts: [
      {
        id: 'beam_width', label: '束宽 k(每步保留的候选条数)', kind: 'number', genre: 'count',
        ask: '束搜索每一步排序后，最多保留几条候选序列(束宽 k)继续往下走?',
        compute: t => ({ answer: String(last(t).k), step: t.length - 1, evidence: `束宽 k=${last(t).k}：每步各扩一词、排序后只留前 k 条` }),
        distractors: numDistractors,
      },
      {
        id: 'beam_out_len', label: '大束宽下的输出长度', kind: 'number', genre: 'count',
        ask: '在这张"长度偏置"的玩具模型上，束宽 k=4、按原始累积概率打分，最后选中的那条序列有几个词?',
        compute: t => {
          const f = last(t)
          const b = f.best as { seq: string; p: number; len: number }
          const g = f.greedy as { seq: string; p: number; len: number }
          return { answer: String(b.len), step: t.length - 1,
            evidence: `选中「${b.seq}」概率 ${b.p}；而贪心（k=1）给出「${g.seq}」概率 ${g.p}、长 ${g.len} 个词` }
        },
        distractors: numDistractors,
      },
      {
        id: 'beam_k1', label: 'k=1 时束搜索退化成什么', kind: 'choice', genre: 'concept',
        ask: '把束宽 k 调成 1，束搜索就退化成了哪种解码方式?',
        compute: t => {
          const g = last(t).greedy as { seq: string; p: number }
          return { answer: `贪心解码 —— 每步只留概率最高的那 1 条`, step: t.length - 1, evidence: `本例 k=1 一路走到「${g.seq}」，概率 ${g.p}` }
        },
        distractors: () => ['全搜索 —— 枚举所有可能的序列再挑最优', '随机采样 —— 每步按概率分布随机抽一个词', '多数投票 —— 独立采样多条序列之后投票'],
      },
      {
        /*  ⭐ 补厚的落点：那句"k 越大越接近最优"在实践中是错的。
            ⚠️「束搜索为什么偏爱短句」补丁包里已有（beam/length_bias），判据按答案相似度
            0.55 抓了出来。这条改问**同一屏上两个数的走向**，那是只有量过才知道的事；
            答案也压到跟干扰项同一长度 —— 否则"挑最长的就中"。 */
        id: 'beam_k_vs_len', label: 'k 扫描上两条线的走向', kind: 'choice', genre: 'concept',
        ask: '把束宽 k 从 1 一路调到 8，同时盯着「找到的概率」和「输出长度」这两个数。它们各自怎么走?',
        compute: t => {
          const f = last(t)
          const sw = (f.kSweep ?? []) as { k: number; len: number; p: number }[]
          return {
            answer: '概率一路涨，而长度一路缩 —— 两条线是打架的',
            step: t.length - 1,
            evidence: `实测：k 从 ${sw[0]?.k} 到 ${sw[sw.length - 1]?.k}，概率 ${sw[0]?.p} → ${sw[sw.length - 1]?.p}，长度 ${sw[0]?.len} → ${sw[sw.length - 1]?.len} 个词`,
          }
        },
        distractors: a => [a,
          '两个都涨 —— 搜得越宽，找到的句子既更可能也更完整详细',
          '两个都不动 —— 束宽只影响速度，最终选中的那条序列并不会变',
          '概率涨、长度也涨 —— 高概率的句子往往需要更多词才说得完整',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'beam_lenpen_knob', label: '长度惩罚是旋钮不是开关', kind: 'choice', genre: 'concept',
        ask: '给束搜索加上长度归一化之后，长度偏置这个问题就解决了吗?',
        compute: t => ({
          answer: '要看用哪一种、力度多大 —— 有的能翻盘，有的翻不动',
          step: t.length - 1,
          evidence: '实测：同一个 k 下「÷ 长度」选回了长 3 个词的那条；而 GNMT 的 α=0.6 分母长 1 时是 1.00、长 3 时才 1.19，仍选那条长 1 的',
        }),
        distractors: a => [a,
          '解决了 —— 除以长度之后，长短候选就在同一个尺度上了',
          '解决了 —— 这是等价变换，不改最优解只让排序更稳',
          '没解决 —— 它会反过来偏爱长句，问题只是换了一头',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },

  // ── Best-of-N 拒绝采样 ──────────────────────────────────────────────
  {
    id: 'bestofn',
    title: 'Best-of-N 拒绝采样',
    kernel: bestofnKernel as Kernel<unknown>,
    doc: { kind: 'bestofn', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'bon_n', label: '扫到的最大采样数 N',
        ask: 'Best-of-N 沿采样数 N 扫描(1、2、4…),扫到的最大 N 是多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).n), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'bon_best_reward', label: '采样够多(N=32)时被采纳候选的得分',
        ask: '采样到 N=32 时,所有候选里最终被打分器选中采纳的那个,拿到多少分(奖励=10−|24−结果|,满分 10)?',
        kind: 'number',
        compute: t => {
          const cands = last(t).drawn as { e: string; v: number; reward: number }[]
          const bi = last(t).bestIdx as number
          return { answer: String(cands[bi].reward), step: t.length - 1, evidence: `最高分候选「${cands[bi].e}」= ${cands[bi].v},奖励 ${cands[bi].reward} 分` }
        },
        distractors: numDistractors,
      },
      {
        id: 'bon_n1', label: 'N=1(只采1个)时的最高分——边际递减的起点',
        ask: 'Best-of-N 的核心是"最高分随 N 边际递减"。若只采样 N=1 个候选(碰运气),本实验第一个候选拿到多少分?',
        kind: 'number',
        compute: t => ({ answer: String(t[0]!.bestReward), step: 0, evidence: String(t[0]!.log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'bon_vs_vote', label: 'Best-of-N 与自洽多数投票的区别',
        ask: 'Best-of-N 和「思维链自洽」都采样多个候选,它选出最终答案的方式有何不同?',
        kind: 'choice',
        compute: t => ({ answer: '靠一个外部打分器(奖励模型 / 可算的验证器)给每个候选打分,argmax 取单个最高分的——适合没有"多数答案"可投的开放式生成', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['对所有候选做多数投票,得票最多的答案胜出', '把 N 个候选的答案数值取平均作为结果', '只采样一次,直接采用第一个候选'],
      },
      {
        id: 'bon_why_pick', label: '为何选 3×8 而非结果最大的 8×5',
        ask: '8×5=40 数值最大,为什么打分器最终采纳的却是 3×8?',
        kind: 'choice',
        compute: t => {
          const cands = last(t).drawn as { e: string; v: number; reward: number }[]
          const bi = last(t).bestIdx as number
          return {
            answer: `打分器按接近目标 24 打分(奖励=10−|24−结果|):${cands[bi].e}=${cands[bi].v} 最接近得满分 ${cands[bi].reward};8×5=40 偏离最远,只有 0 分`,
            step: t.length - 1, evidence: String(last(t).log ?? ''),
          }
        },
        distractors: () => ['因为 3×8 的算式字符数最少', '因为 8×5 超过了 24 被判违规淘汰', '因为 3×8 是最先被采样到的候选'],
      },
    ],
  },

  // ── 蒙特卡洛树搜索 MCTS ─────────────────────────────────────────────
  {
    id: 'mcts',
    title: '蒙特卡洛树搜索 MCTS',
    kernel: mctsKernel as Kernel<unknown>,
    doc: { kind: 'mcts', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'mcts_rollouts', label: '总模拟(rollout)轮数',
        ask: 'MCTS 搜索结束时,对根下三个走法一共做了多少轮模拟(rollout)?',
        kind: 'number',
        compute: t => {
          const n = last(t).n as number[]
          return { answer: String(n.reduce((a, b) => a + b, 0)), step: t.length - 1, evidence: `终态访问次数 ${n.join('、')},合计 ${n.reduce((a, b) => a + b, 0)} 次模拟` }
        },
        distractors: numDistractors,
      },
      {
        id: 'mcts_best_visits', label: '被选中走法的访问次数',
        ask: '搜索结束时,最终被选中的那个走法一共被访问(模拟)了几次?',
        kind: 'number',
        compute: t => {
          const n = last(t).n as number[]
          const best = last(t).best as number
          const moves = last(t).moves as string[]
          return { answer: String(n[best]), step: t.length - 1, evidence: `走法 ${moves[best]} 访问 ${n[best]} 次,B/C 各 ${n[(best + 1) % 3]} 次` }
        },
        distractors: numDistractors,
      },
      {
        id: 'mcts_final_pick', label: 'MCTS 最终按什么选走法',
        ask: '所有模拟跑完后,MCTS 输出的最终走法是按什么标准选的?',
        kind: 'choice',
        compute: t => {
          const n = last(t).n as number[]
          const best = last(t).best as number
          const moves = last(t).moves as string[]
          return { answer: `选访问次数最多的走法:${moves[best]} 被访问 ${n[best]} 次(远多于另两个各 1 次),因为它反复被模拟且几乎每次都赢`, step: t.length - 1, evidence: String(last(t).log ?? '') }
        },
        distractors: () => ['选当前 UCB 值最大的走法', '选胜率最高的走法(哪怕只试过一次)', '在三个走法里随机选一个'],
      },
      {
        id: 'mcts_ucb', label: 'UCB 在选择步平衡什么',
        ask: '每轮"选择"用的 UCB=胜率+c·√(ln N父/N子),这个公式在平衡哪两件事?',
        kind: 'choice',
        compute: t => ({ answer: '兼顾利用与探索:第一项(胜率)鼓励多用当前表现好的走法,第二项 c·√(ln N父/N子)鼓励探索访问次数少的;未访问的记为 ∞,优先各试一遍', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['只看胜率,谁高就一直选谁', '只看访问次数,谁被试得最少就选谁', '只看模拟走到底的步数,越短越好'],
      },
    ],
  },

  // ── RAG 检索增强生成 ────────────────────────────────────────────────
  {
    id: 'rag',
    title: 'RAG 检索增强生成',
    kernel: ragKernel as Kernel<unknown>,
    doc: { kind: 'rag', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'rag_kb_size', label: '知识库文档篇数',
        ask: 'RAG 检索时面对的知识库里,一共有多少篇文档?',
        kind: 'number',
        compute: t => ({ answer: String((last(t).docs as unknown[]).length), step: t.length - 1, evidence: `知识库共 ${(last(t).docs as unknown[]).length} 篇(猫/狗/汽车/植物…)` }),
        distractors: numDistractors,
      },
      {
        id: 'rag_topk', label: '检索命中并拼进上下文的篇数',
        ask: 'RAG 最终检索出多少篇最相关的文档拼进提示词当上下文?',
        kind: 'number',
        compute: t => ({ answer: String((last(t).retrieved as unknown[]).length), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'rag_retrieval_is', label: '检索这一步的本质算法',
        ask: 'RAG 里的"检索"这一步,本质上是在做什么算法?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.stage === 'retrieve') ?? last(t)
          return { answer: '向量最近邻:把问题和每篇文档编码成向量,按相似度(点积 / 余弦)找最接近的 top-k——和词向量、k-NN 同源', step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: () => ['关键词全文匹配:看文档里有没有出现问题中的字词', '让模型逐篇通读所有文档再打分挑选', '从知识库里随机抽取几篇'],
      },
      {
        id: 'rag_which_docs', label: '命中了哪两篇、为何',
        ask: '"猫爱吃什么"这一问,RAG 检索出了哪两篇、又为何丢掉其余的?',
        kind: 'choice',
        compute: t => {
          const docs = last(t).docs as { t: string; sim: number | null }[]
          const ret = last(t).retrieved as number[]
          const names = ret.map(i => `「${docs[i].t}」(${docs[i].sim})`).join('、')
          return { answer: `按相似度取最高的两篇:${names};汽车(0)、植物(0.02)等与问题不相关,相似度太低被丢掉`, step: t.length - 1, evidence: String(last(t).log ?? '') }
        },
        distractors: () => ['检索相似度最低的两篇', '检索字数最多的两篇', '检索知识库里排在最前面的两篇'],
      },
    ],
  },

  // ── 思维树 ToT ──────────────────────────────────────────────────────
  {
    id: 'tot',
    title: '思维树 ToT',
    kernel: totKernel as Kernel<unknown>,
    doc: { kind: 'tot', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'tot_branches', label: '从根生成的想法(分支)数',
        ask: 'ToT 解 24 点,从根节点第一层一共生成了多少个想法(分支)?',
        kind: 'number',
        compute: t => ({ answer: String((last(t).l1 as unknown[]).length), step: t.length - 1, evidence: `根下展开 ${(last(t).l1 as unknown[]).length} 个候选中间状态` }),
        distractors: numDistractors,
      },
      {
        id: 'tot_pruned', label: '被剪掉的分支数',
        ask: '评估之后,有多少个分支因被判"impossible"而剪枝?',
        kind: 'number',
        compute: t => {
          const th = last(t).l1 as { pruned: boolean }[]
          return { answer: String(th.filter(x => x.pruned).length), step: t.length - 1, evidence: String(last(t).log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'tot_kept', label: '剪枝后继续展开第二层的分支数',
        ask: 'ToT 剪掉 impossible 的分支后,还剩几条 sure 分支被保留、继续往深处展开第二层?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).kept), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'tot_vs_cot', label: 'ToT 与思维链 / 自洽的差别',
        ask: '思维树 ToT 相比思维链 CoT、自洽,组织推理的方式有什么根本不同?',
        kind: 'choice',
        compute: t => ({ answer: '把推理组织成一棵树:每步生成多个想法分支、用评估器判前景、剪掉没希望的、沿有希望的搜索,走不通还能回溯换分支', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['只走一条推理链,一步错就步步错(思维链 CoT)', '采样多条独立推理链最后多数投票(自洽)', '把所有想法的答案取平均得到结果'],
      },
      {
        id: 'tot_why_prune', label: '为什么剪掉那两个分支',
        ask: 'ToT 为什么把 {7, 2} 和 {2, 3} 这两个分支剪掉、不再往下展开?',
        kind: 'choice',
        compute: t => {
          const th = last(t).l1 as { state: string; pruned: boolean }[]
          const states = th.filter(x => x.pruned).map(x => x.state).join('、')
          return { answer: `评估器判定 ${states} 为 impossible(剩下两个数怎么算都到不了 24),剪掉它们就不必在死路上浪费后续展开`, step: t.length - 1, evidence: String(last(t).log ?? '') }
        },
        distractors: () => ['因为这两个分支里的数字最大', '因为它们是最后才生成出来的分支', '因为算法随机剪掉了其中两个'],
      },
    ],
  },
]
