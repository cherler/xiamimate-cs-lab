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
import { bestofnKernel, BON_JUDGES, BON_VARIETY } from '../../src/kernels/bestofn.ts'
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
    /*  2026-09-09 补厚：默认档 = 有缺陷的奖励模型 + 高多样性 —— 那才是 Best-of-N 真正的失败模式。
        老那批 fact 全按"奖励=10−|24−结果|、满分 10"提问，而这一档 argmax 认的是**代理分数**
        （真实质量 + 长度加成，最高 14），采纳的也不再是 3×8。整批重写。 */
    doc: { kind: 'bestofn', params: { judge: BON_JUDGES[1], variety: BON_VARIETY[2] }, entities: [], streams: [] },
    facts: [
      {
        id: 'bon_n', label: '扫到的最大采样数 N', kind: 'number', genre: 'count',
        ask: 'Best-of-N 沿采样数 N 扫描(1、2、4…),扫到的最大 N 是多少?',
        compute: t => ({ answer: String(last(t).n), step: t.length - 1, evidence: `轴扫到 N=${last(t).n}` }),
        distractors: numDistractors,
      },
      {
        /*  ⚠️ 计数题要自带数据：把整条曲线抄进题干，答题的人不用去翻屏幕。 */
        id: 'bon_true_peak_n', label: '真实质量在哪个 N 见顶', kind: 'number', genre: 'count',
        ask: '这一档（有缺陷的奖励模型 + 高多样性）实测的两条曲线是——代理分数 6→6→9→14→14→14，真实质量 2→2→5→0→0→0，对应 N=1、2、4、8、16、32。**真实质量**最高出现在哪个 N?',
        compute: t => ({ answer: String(last(t).peakN), step: t.length - 1,
          evidence: `真实质量在 N=${last(t).peakN} 见顶，之后掉了 ${last(t).declineAfterPeak} 分；而代理分数一路只涨不跌` }),
        distractors: numDistractors,
      },
      {
        /*  ⭐ 补厚的落点。这是只有把两条线并排量过才答得出的事。 */
        id: 'bon_overopt', label: 'N 加大之后真实质量怎么走', kind: 'choice', genre: 'concept',
        ask: '打分器换成一个有缺陷的奖励模型（它偏爱长的、看起来在认真推理的回答）之后，把 N 从 1 一路加到 32，**最终输出的真实质量**怎么走?',
        compute: t => {
          const f = last(t)
          const fc = (f.fullCurve ?? []) as { n: number; best: number; trueBest: number }[]
          return {
            answer: '先涨、到某个 N 见顶，然后掉头往下 —— 而代理分照涨',
            step: t.length - 1,
            evidence: `实测：代理分数 ${fc.map(x => x.best).join('→')}，真实质量 ${fc.map(x => x.trueBest).join('→')}（N=${fc.map(x => x.n).join('、')}）`,
          }
        },
        distractors: a => [a,
          '一路涨到满分 —— 采得越多，撞上好候选的机会就越大',
          '先涨后压平 —— 涨到打分器的分数上限就再也上不去了',
          '一路不动 —— 打分器有偏差，从第一个候选起就一直挑错',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'bon_argmax_on_what', label: 'argmax 认的是哪个分数', kind: 'choice', genre: 'concept',
        ask: 'Best-of-N 采样出 N 个候选之后，argmax 是照着什么挑出最终那一个的?',
        compute: t => {
          const f = last(t)
          const d = (f.drawn ?? []) as { e: string; reward: number; trueR: number }[]
          const bi = f.bestIdx as number
          return {
            answer: '打分器给出的分数 —— 它只是真实质量的一个代理',
            step: t.length - 1,
            evidence: `本档采纳「${d[bi]?.e}」：代理分 ${d[bi]?.reward}，而它的真实质量只有 ${d[bi]?.trueR}`,
          }
        },
        distractors: a => [a,
          '候选本身的真实质量 —— 那正是我们要优化的那个量',
          'N 个候选之间的多数投票 —— 谁被重复采到得多就选谁',
          '生成模型自己给出的概率 —— 它最有把握的那一条',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'bon_needs_variety', label: '多样性不够时 N 还有没有用', kind: 'choice', genre: 'concept',
        ask: '如果采样出来的 N 个候选高度重复（32 次只抽出 2 个不同的），把 N 加大还有用吗?',
        compute: t => ({
          answer: '没用 —— 取的是最大值，样本都一样最大值就是那一个',
          step: t.length - 1,
          evidence: '实测「多样性低」那一档：32 次采样只有 2 个不同候选，最高分从 N=4 起就再没动过，而算力照样翻了 8 倍',
        }),
        distractors: a => [a,
          '有用 —— 重复采到同一个候选说明它可靠，分数会被抬高',
          '有用 —— N 越大打分器见到的样本越多，打分就越准',
          '要看打分器 —— 打分器够好的话，重复的候选也能挑出差别',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'bon_vs_vote', label: 'Best-of-N 与自洽多数投票的区别', kind: 'choice', genre: 'concept',
        ask: 'Best-of-N 和「思维链自洽」都采样多个候选,它选出最终答案的方式有何不同?',
        compute: t => ({
          answer: '靠一个外部打分器给每个候选打分，argmax 取单个最高的',
          step: t.length - 1,
          evidence: '自洽是数票（答案得互相比对得上）；Best-of-N 是看分，适合没有"多数答案"可投的开放式生成',
        }),
        distractors: a => [a,
          '对所有候选做多数投票，得票最多的那个答案胜出',
          '把 N 个候选各自的答案取数值平均，作为最终结果',
          '只看第一个采样到的候选，其余的都直接丢掉不用',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },

  // ── 蒙特卡洛树搜索 MCTS ─────────────────────────────────────────────
  {
    id: 'mcts',
    title: '蒙特卡洛树搜索 MCTS',
    kernel: mctsKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：老那批 fact 全建立在"A 每次都赢"的写死脚本上
        （「B/C 各 1 次」「几乎每次都赢」）。现在 rollout 是照真实胜率抛硬币的，
        那些描述一句都不成立了。整批重写。 */
    doc: { kind: 'mcts', params: { c: 1.4, budget: 20 }, entities: [], streams: [] },
    facts: [
      {
        id: 'mcts_rollouts', label: '总模拟(rollout)轮数', kind: 'number', genre: 'count',
        ask: 'MCTS 搜索结束时,对根下的几个走法一共做了多少轮模拟(rollout)?',
        compute: t => {
          const n = last(t).n as number[]
          const tot = n.reduce((a, b) => a + b, 0)
          return { answer: String(tot), step: t.length - 1, evidence: `终态访问次数 ${n.join('、')},合计 ${tot} 次模拟` }
        },
        distractors: numDistractors,
      },
      {
        /*  ⚠️ 计数题要自带数据：把两条曲线抄进题干，不用去翻屏幕 */
        id: 'mcts_p_at_320', label: '预算加满时的选对率', kind: 'number', genre: 'count',
        ask: '这一档(c=1.4)实测的选对率曲线是——10轮 43.0%、20轮 55.0%、40轮 72.8%、80轮 85.8%、160轮 96.4%、320轮 99.0%(每档换种子重跑 500 次)。加到 320 轮时选对率是多少(填百分数的整数部分,如 99.0% 填 99)?',
        compute: t => {
          const sw = last(t).sweep as { budget: number; pRight: number }[]
          const big = sw[sw.length - 1]
          return { answer: String(Math.floor(big.pRight * 100)), step: t.length - 1,
            evidence: `预算扫描:${sw.map(x => `${x.budget}轮 ${(x.pRight * 100).toFixed(1)}%`).join('、')}` }
        },
        distractors: numDistractors,
      },
      {
        /*  ⭐ 补厚的落点①：单场是抛硬币 */
        id: 'mcts_single_run', label: '跑一次的结果说明什么', kind: 'choice', genre: 'concept',
        ask: '这一屏跑完一次 MCTS,选中了某个走法。**这一次的结果**说明了什么?',
        compute: t => {
          const f = last(t)
          const sw = f.sweep as { budget: number; pRight: number }[]
          return {
            answer: '几乎什么都说明不了 —— 单场模拟就是抛硬币，得看重跑几百次的概率',
            step: t.length - 1,
            evidence: `实测：这个配置重跑 500 次的选对率是 ${((f.pRight as number) * 100).toFixed(1)}%，`
              + `而预算加到 ${sw[sw.length - 1].budget} 轮才 ${(sw[sw.length - 1].pRight * 100).toFixed(1)}%`,
          }
        },
        distractors: a => [a,
          '说明它找到了最优走法 —— 访问次数最多的那个就是最好的',
          '说明这个走法的胜率最高 —— 模拟结果就是胜率的无偏估计',
          '说明预算已经够了 —— 能收敛到一个答案就说明模拟次数足够',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⭐ 补厚的落点②：c=0 不是慢，是不收敛 */
        id: 'mcts_c_zero', label: 'c 调成 0 会怎样', kind: 'choice', genre: 'concept',
        ask: '把 UCB 里的探索常数 c 调成 0(只剩胜率那一项),再把模拟预算一路加大,会发生什么?',
        compute: t => {
          const cs = last(t).cSweep as { c: number; pRight: number; pMax: number }[]
          const z = cs.find(x => x.c === 0)!
          const other = cs.filter(x => x.c > 0).map(x => x.pMax)
          return {
            answer: '选对率停在半路就再也不涨 —— 它不是收敛得慢，是不收敛',
            step: t.length - 1,
            evidence: `实测：c=0 加到 320 轮也只有 ${(z.pMax * 100).toFixed(1)}%，而 c>0 的三档都在 ${(Math.min(...other) * 100).toFixed(1)}% 以上`,
          }
        },
        distractors: a => [a,
          '照样能收敛到最优，只是要多花几倍的模拟预算才追得上',
          '会更快收敛 —— 省下探索的开销，全部押在当前最好的走法上',
          '结果不变 —— 探索项只影响中间过程，最终按访问次数选的结果一样',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'mcts_ucb', label: 'UCB 在选择步平衡什么', kind: 'choice', genre: 'concept',
        ask: '每轮"选择"用的 UCB = 实测胜率 + c·√(ln N父/n子),这个公式在平衡哪两件事?',
        compute: t => ({
          answer: '利用已经量到的胜率，和探索被试得太少的走法',
          step: t.length - 1,
          evidence: '第一项是已经量到的平均胜率；第二项随 n 变小而变大，未访问的记为 ∞，所以开局每个走法必被各试一遍',
        }),
        distractors: a => [a,
          '只看胜率高低，谁的实测胜率最高就一直选谁',
          '只看访问次数，谁被试得次数最少就优先选谁',
          '模拟走到底的步数和结果，越快分出胜负越好',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⭐ 「量不到就说量不到」也出成题 —— 它是这一屏教的方法论之一 */
        id: 'mcts_visit_vs_rate', label: '这一屏量不出的那件事', kind: 'choice', genre: 'concept',
        ask: 'MCTS 最后取"访问次数最多"而不是"胜率最高"。这一屏把两条规则都量了一遍,结果如何?',
        compute: t => {
          const rc = last(t).ruleCmp as { rule: string; pRight: number }[]
          return {
            answer: '几乎一样 —— 这个扁平的五选一上量不出差别，理由在树上',
            step: t.length - 1,
            evidence: `实测：访问最多 ${(rc[0].pRight * 100).toFixed(1)}% vs 胜率最高 ${(rc[1].pRight * 100).toFixed(1)}%。`
              + '真实 MCTS 里取访问次数的理由是深层节点方差更大、还被对手挑剔过，而这一屏没有树',
          }
        },
        distractors: a => [a,
          '访问最多明显更好 —— 胜率被只试过一次的走法骗走了',
          '胜率最高明显更好 —— 访问次数只反映探索顺序，不反映好坏',
          '两条规则永远选出同一个走法 —— 访问最多的必然胜率也最高',
        ].filter(o => o !== a).slice(0, 3),
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
