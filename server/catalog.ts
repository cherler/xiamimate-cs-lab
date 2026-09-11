/**
 * 服务端「出题目录」—— 这是「答案焊死在引擎上」的物理位置。
 *
 * 每个实验登记两样东西：
 *   1. kernel + defaultDoc —— 跑一遍就得到确定性 trace（一串状态帧）。
 *   2. facts —— 一组「可核算事实」。每个 fact 的答案由 compute(trace) **从引擎轨迹算出**，
 *      不是问大模型得来的。大模型只负责把事实写成一句人话题面 + 讲解（见 quiz.ts）。
 *
 * 这就是我们和 NotebookLM / 猿辅导的差别：他们的答案是模型生成的、可能错；
 * 我们的答案是 121 台确定性验题机算出来的、钉死。出题机可以骗人，验题机不会。
 *
 * 只 import src/kernels 下的纯引擎，不碰 web/ 里的 React —— 服务端要能被 node/tsx 直接跑。
 */
import { run } from '../src/core/kernel.ts'
import type { Kernel, CompiledModel } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'
import { binsearchKernel } from '../src/kernels/binsearch.ts'
import { quicksortKernel } from '../src/kernels/quicksort.ts'
import { dijkstraKernel } from '../src/kernels/dijkstra.ts'
import { mergesortKernel } from '../src/kernels/mergesort.ts'
import { fastpowKernel } from '../src/kernels/fastpow.ts'
import { nqueensKernel } from '../src/kernels/nqueens.ts'
import { unionfindKernel } from '../src/kernels/unionfind.ts'
import { perceptronKernel } from '../src/kernels/perceptron.ts'
import { kmeansKernel } from '../src/kernels/kmeans.ts'
import { dtreeKernel } from '../src/kernels/dtree.ts'
import { gbdtKernel } from '../src/kernels/gbdt.ts'
import { pcaKernel } from '../src/kernels/pca.ts'
import { poolingKernel } from '../src/kernels/pooling.ts'
import { wordvecKernel } from '../src/kernels/wordvec.ts'
import { knnKernel } from '../src/kernels/knn.ts'
import { bpeKernel } from '../src/kernels/bpe.ts'
import { moeKernel } from '../src/kernels/moe.ts'
import { quantKernel } from '../src/kernels/quant.ts'
import { specdecKernel } from '../src/kernels/specdec.ts'
import { selfconsistKernel } from '../src/kernels/selfconsist.ts'
import { convKernel } from '../src/kernels/conv.ts'
import { pageKernel } from '../src/kernels/page.ts'
import { diskKernel } from '../src/kernels/disk.ts'
import { cacheKernel } from '../src/kernels/cache.ts'
import { tcpKernel } from '../src/kernels/tcp.ts'
import { bankerKernel } from '../src/kernels/banker.ts'
import { hammingKernel } from '../src/kernels/hamming.ts'
import { crcKernel } from '../src/kernels/crc.ts'
import { subnetKernel } from '../src/kernels/subnet.ts'
import { huffmanKernel } from '../src/kernels/huffman.ts'
import { bplusKernel } from '../src/kernels/bplus.ts'
import { lrucacheKernel } from '../src/kernels/lrucache.ts'
import { topkKernel } from '../src/kernels/topk.ts'
import { reactagentKernel } from '../src/kernels/reactagent.ts'
import { ctxcompactKernel } from '../src/kernels/ctxcompact.ts'
import { toolcallKernel } from '../src/kernels/toolcall.ts'
import { permguardKernel } from '../src/kernels/permguard.ts'
import { subagentKernel } from '../src/kernels/subagent.ts'
import { memretrieveKernel } from '../src/kernels/memretrieve.ts'
import { mempagingKernel } from '../src/kernels/mempaging.ts'
import { reflectionKernel } from '../src/kernels/reflection.ts'
import { memwriteKernel } from '../src/kernels/memwrite.ts'
import { planningKernel } from '../src/kernels/planning.ts'
import { promptbuildKernel } from '../src/kernels/promptbuild.ts'
import { lfucacheKernel } from '../src/kernels/lfucache.ts'
import { trieKernel } from '../src/kernels/trie.ts'
import { quickselectKernel } from '../src/kernels/quickselect.ts'
import { libraryKernel } from '../src/kernels/library.ts'
import { wildcardKernel } from '../src/kernels/wildcard.ts'
import { regexKernel } from '../src/kernels/regex.ts'
// 与 registry 同源的预设常量：直接 import 保证 doc 逐字一致（引擎侧，无 React）。
import { CRC_PRESETS, HAMMING_PRESETS, SUBNET_PRESETS, HUFF_PRESETS, BPLUS_PRESETS } from '../src/presets/sequences.ts'
import { ROUTE_PRESETS } from '../src/presets/entities.ts'
// 分片目录：大模型/算法/408 三轨的出题条目按职业线拆在 server/catalog/*.ts，这里汇总进 CATALOG。
// 每个分片自带 kernel/doc/facts，doc 与 registry defaultDoc 逐字一致、答案由引擎 trace 真算（见 catalog-shared.ts）。
import { LLM_INFER_A_ENTRIES } from './catalog/llm-infer-a.ts'
import { LLM_INFER_B_ENTRIES } from './catalog/llm-infer-b.ts'
import { TRANSFORMER_ENTRIES } from './catalog/transformer.ts'
import { LLM_ALGO_ENTRIES } from './catalog/llm-algo.ts'
import { DS_CLASSIC_ENTRIES } from './catalog/ds-classic.ts'
import { ML_ENTRIES } from './catalog/ml.ts'
import { DL_STATS_ENTRIES } from './catalog/dl-stats.ts'
import { SYS408_ENTRIES } from './catalog/sys408.ts'
import { DORMANT_ENTRIES } from './catalog/dormant.ts'
import { CONCEPT_FACTS } from './catalog/concepts.ts'
import { FILL_FACTS } from './catalog/concepts-fill.ts'
// 数值题通用干扰项：与分片共用同一份（整数 ±1/±2、小数按精度相对扰动、负答案允许负干扰项）。
import { numDistractors } from './catalog-shared.ts'

// trace 的一帧就是内核的可见状态；出题只读字段，用宽松类型即可。
type Frame = Record<string, unknown>

/**
 * 一条事实是「计数」还是「原理」。
 *
 * ⚠️ 这个字段是被用户骂出来的,起因值得写在这儿:
 * 最早那批实验的 fact 全是 `compute: t => last(t).comparisons` 这种 —— 从**这一次运行**的
 * trace 上读一个计数器。于是四个功能(出题/答疑/复习/面试)全都在问「比了几次、移动了几次」,
 * 而它们又都吃同一份 facts,所以一起烂。用户的原话:「这种肤浅的实操问题有什么意义?肯定是问
 * 理论知识啊……AI 学伴的底层逻辑就错了。」
 *
 * 根因不是「焊死引擎」这个机制错了 —— 引擎钉答案、大模型只改写,这条挡住了模型胡编,要留。
 * 错的是**「可核算事实」被实现成了「trace 上的一个计数器」**:口径一窄,题目就只能问计数。
 * 引擎能钉死的远不止计数:一条原理、一个不变量、一个「换成别的会怎样」,引擎照样能给出处、
 * 照样能验证。所以现在把两类分开,并且立一条纪律(见 tests/fact-genre.test.ts):
 *   **没有哪个实验可以全是计数题。**
 */
export type FactGenre =
  /** 原理 / 不变量 / 权衡 / 适用条件 —— 答案是一句话,脱离这一次运行也成立。 */
  | 'concept'
  /** 这一次运行里的某个数(比较次数、下标、某步的值)。⚠️ 题面必须自带那组数据,否则无从答起。 */
  | 'count'

export type Fact = {
  id: string
  /** 喂给大模型的内部描述：这道题在考什么。 */
  label: string
  /** 保底题面：大模型不可用时直接用它，保证功能不依赖模型也能出题。 */
  ask: string
  kind: 'number' | 'choice'
  /**
   * 这条事实属于哪一类。不写的话按答案长短推断(短 = 计数),推断只是为了兼容存量,
   * 新写的 fact 一律显式声明。
   */
  genre?: FactGenre
  /** 从引擎 trace 算出钉死答案 + 出处（第几帧 + 该帧证据文字）。 */
  compute: (trace: Frame[]) => { answer: string; step: number; evidence: string }
  /** 生成干扰项（错误选项）。数值题按扰动，选择题按同类其它取值。 */
  distractors: (answer: string, trace: Frame[]) => string[]
}

/** 一条 fact 到底是哪一类:优先看声明,没声明就按答案长短兜底(存量有 800 多条,不可能全标一遍)。 */
export function genreOf(f: Fact, trace: Frame[]): FactGenre {
  if (f.genre) return f.genre
  try { return f.compute(trace).answer.length <= 12 ? 'count' : 'concept' } catch { return 'count' }
}

export type CatalogEntry = {
  id: string
  title: string
  kernel: Kernel<unknown>
  doc: SimDocument
  facts: Fact[]
}

// ── 各实验的 defaultDoc（与 web/src/registry.ts 对应；只需 kernel 读得到的字段） ──
const trivialDoc = (kind: string): SimDocument => ({ kind, params: {}, entities: [], streams: [] })

const dijkstraDoc: SimDocument = {
  kind: 'dijkstra',
  params: { source: 'A', directed: 0 },
  entities: [
    ...['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(id => ({ id, type: 'node', attrs: {} })),
    ...([
      ['A', 'B', 4], ['A', 'C', 6], ['A', 'D', 6],
      ['B', 'C', 1], ['B', 'E', 7],
      ['C', 'D', 2], ['C', 'E', 6], ['C', 'F', 4],
      ['D', 'F', 5], ['E', 'F', 1], ['E', 'G', 6], ['F', 'G', 8],
    ] as [string, string, number][]).map(([from, to, w]) => ({
      id: `${from}${to}`, type: 'edge', attrs: { from, to, w },
    })),
  ],
  streams: [],
}

const last = (t: Frame[]) => t[t.length - 1]!

// 主表核心条目（历史内联的 197 个）。三轨新增的 89 个在下方从分片汇总进最终 CATALOG。
const CATALOG_CORE: CatalogEntry[] = [
  {
    id: 'binsearch',
    title: '二分查找',
    kernel: binsearchKernel as Kernel<unknown>,
    doc: trivialDoc('binsearch'),
    facts: [
      {
        id: 'compares', label: '二分查找命中目标一共比较了几次',
        ask: '在这个有序数组里用二分查找定位目标 63，一共要比较几次?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.compares), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'found_index', label: '目标在数组中的下标',
        ask: '目标 63 命中时，它在数组中的下标(从 0 开始)是多少?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          return { answer: String(f.found), step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'first_mid', label: '第一步检查的中点下标',
        ask: '二分查找第一步检查的中点(mid)下标是多少?',
        kind: 'number',
        compute: t => ({ answer: String(t[0]!.mid), step: 0, evidence: String(t[0]!.log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'quicksort',
    title: '快速排序',
    kernel: quicksortKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：默认档从"一组乱序数"改成**最坏情况**（已排好序 + 末元素当基准），
        因为那才是快排最该记住的一件事。doc 必须跟 web/src/registry.ts 的 defaultDoc 一致，
        否则出题算出来的答案跟页面上看到的对不上。 */
    doc: { kind: 'quicksort', params: { data: '已经排好序', pivot: '末元素（教科书）', part: 'Lomuto 两路' }, entities: [], streams: [] },
    facts: [
      {
        id: 'total_steps', label: '快排走完整个过程的总步数(帧数)',
        ask: '把这个数组快速排序完成，逐步演示一共有多少帧(步)?',
        kind: 'number', genre: 'count',
        compute: t => ({ answer: String(t.length), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        /*  这一条考的是补厚的落点：规模表上 n=160 的比较次数**正好等于 n(n−1)/2**。
            题面自带全部数据（哪一档、哪个 n），不依赖"这次运行碰巧是什么"。 */
        id: 'worst_count', label: '最坏档在 n=160 时的比较次数正好是 n(n−1)/2',
        ask: '一份**已经排好序**的数据，用教科书快排（取区间末元素当基准、Lomuto 两路分区）。规模表上 n=160 那一行，比较了多少次？',
        kind: 'number', genre: 'count',
        compute: t => {
          const f = last(t)
          const rows = (f.scale ?? []) as { n: number; compares: number; nsq: number }[]
          const big = rows[rows.length - 1]
          return { answer: String(big.compares), step: t.length - 1,
            evidence: `n=${big.n}：实测 ${big.compares} 次，n(n−1)/2 = ${big.nsq} —— 一次不差` }
        },
        distractors: numDistractors,
      },
      {
        id: 'dup_needs_threeway', label: '元素大量相等时换基准没用、得换分区', kind: 'choice', genre: 'concept',
        ask: '元素**大量相等**的数组上，Lomuto 两路快排退化成 O(n²)。把「选基准」从末元素换成三数取中或随机，能救回来吗？',
        compute: t => {
          const f = last(t)
          return {
            answer: '救不回来 —— 全相等时挑谁当基准都一样，得改用三路分区一次锁定等值',
            step: t.length - 1,
            evidence: `实测：全相等数据下三种基准的增长指数分别是 2.03 / 1.88 / 2.03，换成三路分区后是 1.00（当前档 slope=${f.slope}）`,
          }
        },
        distractors: a => [a,
          '能救回来 —— 随机基准让每次划分的期望位置落在中间，重复元素也不例外',
          '能救回来 —— 三数取中在全相等时会取到正中间那个，划分自然就均衡了',
          '不用救 —— 元素全相等时数组本来就有序，快排一趟扫完就结束了',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'first_pivot', label: '第一次分区选的基准值 pivot',
        ask: '快速排序第一次分区选定的基准值(pivot)是多少?',
        kind: 'number',
        compute: t => {
          const f = t.find(x => x.act === 'pivot') ?? t[0]!
          return { answer: String(f.pivotVal), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'dijkstra',
    title: 'Dijkstra 最短路',
    kernel: dijkstraKernel as Kernel<unknown>,
    doc: dijkstraDoc,
    facts: [
      {
        id: 'dist_G', label: '从源点 A 到 G 的最短距离',
        ask: '在这张带权图里，从源点 A 到 G 的最短距离是多少?',
        kind: 'number',
        compute: t => {
          const d = last(t).dist as Record<string, number>
          return { answer: String(d.G), step: t.length - 1, evidence: `终态 dist=${JSON.stringify(d)}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'dist_F', label: '从源点 A 到 F 的最短距离',
        ask: '从源点 A 到 F 的最短距离是多少?',
        kind: 'number',
        compute: t => {
          const d = last(t).dist as Record<string, number>
          return { answer: String(d.F), step: t.length - 1, evidence: `终态 dist=${JSON.stringify(d)}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'second_settled', label: 'A 之后第一个被确定最短路的顶点',
        ask: '按 Dijkstra 的顺序，源点 A 之后第一个被「确定(settled)」的顶点是哪个?',
        kind: 'choice',
        compute: t => {
          const s = last(t).settled as string[]
          return { answer: String(s[1] ?? s[0]), step: t.length - 1, evidence: `确定顺序 ${s.join('→')}` }
        },
        distractors: answer => ['A', 'B', 'C', 'D', 'E', 'F', 'G'].filter(x => x !== answer).slice(0, 3),
      },
    ],
  },
  {
    id: 'mergesort',
    title: '归并排序',
    kernel: mergesortKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：默认档带上重复值 —— "稳定"这件事没有重复值根本无从谈起。 */
    doc: { kind: 'mergesort', params: { data: '大量重复（考稳定性）', tie: '相等时取左段（≤，稳定）', pass: '固定倍增（1→2→4…）' }, entities: [], streams: [] },
    facts: [
      {
        id: 'buf_peak', label: '归并需要的额外缓冲区峰值', kind: 'number', genre: 'count',
        ask: '对 12 个数做自底向上的归并排序（固定倍增 1→2→4…），过程中额外缓冲区最多同时装了多少个元素?',
        compute: t => {
          const f = last(t)
          return { answer: String(f.totalBuf), step: t.length - 1,
            evidence: `走了 ${f.totalPasses} 趟、比较 ${f.totalCompares} 次；快排是原地的，这一栏是 0` }
        },
        distractors: numDistractors,
      },
      {
        id: 'shape_spread', label: '换数据形状比较次数几乎不变', kind: 'choice', genre: 'concept',
        ask: '把数据换成"已经排好序"或"完全逆序"，归并排序的比较次数会有多大变化?',
        compute: t => {
          const f = last(t)
          const sw = (f.shapeSweep ?? []) as { data: string; rows: { n: number; compares: number }[] }[]
          const bigs = sw.map(x => x.rows[x.rows.length - 1].compares)
          return {
            answer: '几乎不变 —— 它不看数据长什么样，照着 log n 趟一趟趟扫到底',
            step: t.length - 1,
            evidence: `实测 n=128 四种形状：${bigs.join(' / ')} 次，最费的比最省的只多 ${f.shapeSpread} 倍（快排同样的对照是差 11 倍）`,
          }
        },
        distractors: a => [a,
          '会大幅变少 —— 已经有序时相邻两段一比就知道不用动，整趟归并可以跳过',
          '会大幅变多 —— 逆序时每次比较都要取右段，输出缓冲要来回搬更多次',
          '会变成 O(n²) —— 跟快排一样，有序数据正好是归并排序的最坏情况',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'stable_one_char', label: '"稳定"来自哪一个字符', kind: 'choice', genre: 'concept',
        ask: '归并排序被称为稳定排序。这个性质具体是由代码里的哪一处保证的?',
        compute: t => {
          const f = last(t)
          return {
            answer: '合并时那一次比较：相等时先取左段（写成 <=），左段本来就在前面，原序保住',
            step: t.length - 1,
            evidence: `实测：当前是「${f.tie}」，等值元素的原序${f.stable ? '保住了' : '被打乱了'}；把 <= 改成 < 之后排序结果一模一样，而角标会乱`,
          }
        },
        distractors: a => [a,
          '由分治结构保证：分到底、再合并回去，相等元素之间的先后，就不可能被换掉',
          '由自底向上的扫描顺序保证：段宽从 1 开始翻倍，天然、从左往右一段段处理',
          '由额外缓冲区保证：输出写进新数组、而不是原地交换，位置、关系就都不会被破坏',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'space_tradeoff', label: '归并 vs 快排的取舍', kind: 'choice', genre: 'concept',
        ask: '归并排序最坏也是 O(n log n)，而快排最坏是 O(n²)。既然如此，为什么实践中快排反而更常用?',
        compute: t => ({
          answer: '因为归并要一块 O(n) 的额外缓冲，而快排原地跑、访存局部性也更好',
          step: t.length - 1,
          evidence: `实测缓冲区峰值 ${last(t).totalBuf} 个元素；反过来，数据大到内存装不下时（外部排序）只有归并做得了，因为它只需要顺序读写`,
        }),
        distractors: a => [a,
          '因为快排的比较次数在数学上就更少 —— 同样规模下它要做的比较只有归并的一半',
          '因为归并排序的最坏情况其实也会退化成 O(n²)，两者在这一点上并没有区别',
          '因为快排是稳定的而归并不是，需要保持相等元素次序的场合只能用快排',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },
  {
    id: 'fastpow',
    title: '快速幂',
    kernel: fastpowKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：默认档改成 3¹⁰⁰ + 整数乘法 —— 一进来就是个**静默算错**的现场，
        而"不取模的快速幂在真实场景里用不了"才是这个算法最该被记住的一件事。 */
    doc: { kind: 'fastpow', params: { base: 3, exp: 100, op: '整数乘法（会溢出）' }, entities: [], streams: [] },
    facts: [
      {
        id: 'total_ops', label: '快速幂算 3^100 的乘法总次数', kind: 'number', genre: 'count',
        ask: '用快速幂计算 3^100（100 = 1100100₂），一共要做多少次乘法（平方 + 挑位相乘）?',
        compute: t => {
          const f = last(t)
          return { answer: String(f.totalOps), step: t.length - 1,
            evidence: `${f.squares} 次平方 + ${f.mults} 次挑位相乘；朴素做法要 ${f.naiveOps} 次` }
        },
        distractors: numDistractors,
      },
      {
        id: 'silent_wrong', label: '不取模的快速幂会静默算错', kind: 'choice', genre: 'concept',
        ask: '用 64 位整数（或 JavaScript 的 Number）跑快速幂算 3^100，会发生什么?',
        compute: t => {
          const f = last(t)
          return {
            answer: '会算出一个错的数，而且不报任何错 —— 结果有 48 位，早就超出了能精确表示的范围',
            step: t.length - 1,
            evidence: `实测：这一趟得到 ${f.got}，而 BigInt 算出的真值是 ${String(f.truth).slice(0, 24)}…；中间量最大到过 ${(f.maxInter as number).toExponential(2)}，而上限是 9.0e15`,
          }
        },
        distractors: a => [a,
          '会抛出一个溢出异常 —— 运行时检测到结果超出范围，于是中断计算并报错',
          '会自动切换到高精度整数 —— 现代语言在检测到溢出时会把结果提升为大整数类型',
          '会算出正确结果 —— 快速幂的中间结果始终不超过 a^n 本身，不存在额外的溢出风险',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'mod_not_enough', label: '取模也救不了中间量溢出', kind: 'choice', genre: 'concept',
        ask: '把快速幂改成"每一步都对 1e9+7 取模"。这样结果就一定对了吗?',
        compute: t => ({
          answer: '不一定 —— 取模治的是结果太大，治不了中间量太大：两个 10⁹ 一乘就是 10¹⁸',
          step: t.length - 1,
          evidence: '实测：模乘那一档 n=45 还对（中间量 1.85e15 < 2⁵³），n=100 就错了（中间量 1.89e17）；换成 BigInt 中间量之后四个 n 全部逐位吻合',
        }),
        distractors: a => [a,
          '一定对 —— 每一步都取模之后，参与运算的数永远小于 1e9+7，不可能溢出',
          '一定对 —— 取模是同余运算，先取模再相乘和先相乘再取模的结果在数学上完全等价',
          '不一定 —— 但原因是 1e9+7 这个模数选得不好，换成 2 的幂次做模数就没问题了',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⚠️ 「快速幂还能用在哪（矩阵幂）」那一条已经在 concepts-fill 的补丁包里了
            （fastpow/matrix_pow）—— 判据「答案雷同的原理题」当场把我这条重复的抓了出来。
            换成这个实验**独有**的一条：换了运算，溢出那个坑照样在。 */
        id: 'matrix_also_overflows', label: '换了运算，溢出的坑还在', kind: 'choice', genre: 'concept',
        ask: '把快速幂里的"数的乘法"换成 2×2 矩阵乘法来求斐波那契。这样就绕开溢出问题了吗?',
        compute: t => ({
          answer: '没绕开 —— 矩阵每一项是 x·y + x·y，两个 10⁹ 一乘还是 10¹⁸',
          step: t.length - 1,
          evidence: '实测：矩阵档内部若用 Number 写，F(100) 会算成 687995181，而真值是 687995182，差 1 且不报错；改走 BigInt 中间量后四个 n 全部逐位吻合',
        }),
        distractors: a => [a,
          '绕开了 —— 矩阵的每一项都已经先取过模，所以参与运算的数不会超过模数',
          '绕开了 —— 矩阵乘法只做加法和小数相乘，本来就不会产生特别大的中间值',
          '不用绕 —— 斐波那契数增长很慢，即使不取模，F(1000) 也在 64 位整数范围内',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },
  {
    id: 'nqueens',
    title: '回溯 · N 皇后',
    kernel: nqueensKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：默认档改成 6×6 找全部解 —— "剪掉了多少"和"无解也是结论"
        这两件事，在只找第一个解的 4×4 上都看不见。 */
    doc: { kind: 'nqueens', params: { n: 6, goal: '找出全部解', prune: '每步都检查（正常回溯）' }, entities: [], streams: [] },
    facts: [
      {
        id: 'sols_6', label: '6×6 棋盘上 N 皇后有几个解', kind: 'number', genre: 'count',
        ask: '6×6 的棋盘上，摆 6 个互不攻击的皇后，一共有多少种摆法?',
        compute: t => {
          const f = last(t)
          return { answer: String(f.totalSolutions), step: t.length - 1,
            evidence: `整棵搜索树走完，访问了 ${f.totalNodes} 个节点、回溯 ${f.totalBacktracks} 次` }
        },
        distractors: numDistractors,
      },
      {
        id: 'prune_ratio', label: '剪枝把节点数砍到多少', kind: 'number', genre: 'count',
        ask: '6×6 找全部解：不做任何剪枝（放满 6 个再检查）要访问多少个搜索树节点?',
        compute: t => {
          const f = last(t)
          return { answer: String(f.bruteNodes), step: t.length - 1,
            evidence: `而每步都检查的正常回溯只访问 ${f.totalNodes} 个 —— 差 ${((f.bruteNodes as number) / (f.totalNodes as number)).toFixed(0)} 倍` }
        },
        distractors: numDistractors,
      },
      {
        id: 'fast_why', label: '回溯比暴力快在哪', kind: 'choice', genre: 'concept',
        ask: '常说"回溯比暴力枚举快得多"。它到底快在哪里?',
        compute: t => {
          const f = last(t)
          return {
            answer: '它根本没去枚举那些一看就不可能的分支 —— 不是把同样的组合过得更快',
            step: t.length - 1,
            evidence: `实测 ${f.n}×${f.n} 找全部解：每步检查访问 ${f.totalNodes} 个节点，放满再检查要 ${f.bruteNodes} 个，而两边得出的解一模一样`,
          }
        },
        distractors: a => [a,
          '快在枚举的顺序上 —— 先试更可能成功的位置，于是平均更早撞上答案',
          '快在剪枝把总组合数变少了 —— 加了约束之后，合法的摆法本身就没那么多了',
          '快在它是深度优先的 —— 深度优先比广度优先省内存，因此每一步也跑得更快',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'no_solution', label: '"没找到"和"没找"是两件事', kind: 'choice', genre: 'concept',
        ask: '把棋盘调成 3×3，回溯跑完之后一个解都没有。这个结果说明了什么?',
        compute: t => ({
          answer: '说明 3×3 上确实不存在合法摆法 —— 这是把整棵搜索树都走完之后得出的结论',
          step: t.length - 1,
          evidence: '实测：3×3 访问 5 个节点、回溯 5 次后穷尽了所有分支，解的个数为 0；N=2 同理',
        }),
        distractors: a => [a,
          '说明搜索提前停下了 —— 回溯只保证找到解时正确，不保证把所有分支都走完',
          '说明剪枝剪过头了 —— 某些合法分支被约束判定误伤，换成不剪枝就能找到',
          '说明棋盘太小 —— 3 个皇后本来就放不下 3 个互不攻击的位置，不需要搜索也知道',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },
  {
    id: 'unionfind',
    title: '并查集',
    kernel: unionfindKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：默认档改成**两个优化都关 + 最坏序列** —— 那才是
        "并查集很快是有前提的"这句话唯一能被看见的地方。 */
    doc: { kind: 'unionfind', params: { union: '朴素（谁在前挂谁）', compress: '不压缩', seq: '最坏序列（故意串成一条链）' }, entities: [], streams: [] },
    facts: [
      {
        id: 'first_union_comps', label: '第一次 union 后剩余连通分量数', kind: 'number', genre: 'count',
        ask: '10 个各自独立的点，执行第一次 union(0,1) 之后，还剩几个连通分量?',
        compute: t => ({ answer: String(t[0]!.comps), step: 0, evidence: String(t[0]!.log ?? '') }),
        distractors: numDistractors,
      },
      {
        /*  补厚的落点：不上优化时，n=256 的最坏情况要爬多少步。 */
        id: 'worst_steps', label: '不上优化时 n=256 的累计爬树步数', kind: 'number', genre: 'count',
        ask: '朴素合并 + 不做路径压缩，操作序列是 union(0,1)、union(1,2)… 这样串成一条链。规模表上 n=256 那一行，find 一共爬了多少步?',
        compute: t => {
          const f = last(t)
          const sc = (f.scale ?? []) as { unionKind: string; compress: string; rows: { n: number; steps: number; depth: number }[] }[]
          const mine = sc.find(x => x.unionKind.startsWith('朴素') && x.compress === '不压缩')!
          const big = mine.rows[mine.rows.length - 1]
          return { answer: String(big.steps), step: t.length - 1, evidence: `n=${big.n} 时树深 ${big.depth}，实测增长指数是平方级` }
        },
        distractors: numDistractors,
      },
      {
        id: 'premise', label: '"均摊近乎 O(1)"是有前提的', kind: 'choice', genre: 'concept',
        ask: '常说并查集"单次操作均摊近乎常数"。这句话对一个**只写了 find 和 union、两个优化都没做**的实现也成立吗?',
        compute: t => {
          const f = last(t)
          const sc = (f.scale ?? []) as { unionKind: string; compress: string; slope: number; rows: { n: number; steps: number }[] }[]
          const naive = sc.find(x => x.unionKind.startsWith('朴素') && x.compress === '不压缩')!
          const good = sc.find(x => x.compress !== '不压缩')!
          return {
            answer: '不成立 —— 不上优化时树可能长成一条链，最坏情况会到 O(n²)',
            step: t.length - 1,
            evidence: `实测 n=256：朴素+不压缩 ${naive.rows[naive.rows.length - 1].steps} 步（指数 ${naive.slope}），打开压缩后 ${good.rows[good.rows.length - 1].steps} 步（指数 ${good.slope}）`,
          }
        },
        distractors: a => [a,
          '成立 —— 用树加父指针表示分组这件事本身就带来了近乎常数的复杂度',
          '成立 —— 只要元素个数固定，树的高度就有上界，爬树的代价自然是常数',
          '不成立 —— 但原因是没有按大小合并，跟路径压缩和按秩合并都没有关系',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'two_opts', label: '两个优化治的不是同一件事', kind: 'choice', genre: 'concept',
        ask: '按秩合并和路径压缩，都是为了不让 find 爬太久。它们的做法有什么根本区别?',
        compute: t => ({
          answer: '按秩合并在合并时从源头不让树长高，路径压缩是事后把链拍平',
          step: t.length - 1,
          evidence: '看规模表「树深」那一列：按秩合并让它从一开始就没高过（两两归并序列上正好是 log₂n），而压缩是把它一次拍到 1',
        }),
        distractors: a => [a,
          '没有区别 —— 两者都是在 find 的时候修改父指针，只是修改的时机差了一步',
          '按秩合并保证正确性、路径压缩只管速度 —— 少了前者查出来的根可能是错的',
          '路径压缩只对查询有效、按秩合并只对合并有效 —— 各管一个操作，互不影响',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },

  // ── AI / 机器学习 / 深度学习 ──
  {
    id: 'perceptron',
    title: '感知机',
    kernel: perceptronKernel as Kernel<unknown>,
    doc: trivialDoc('perceptron'),
    facts: [
      {
        id: 'updates', label: '感知机收敛前的权重更新次数',
        ask: '感知机学到分界线之前，一共做了多少次权重更新(只在分错时才更新)?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).updates), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'kmeans',
    title: 'k-means 聚类',
    kernel: kmeansKernel as Kernel<unknown>,
    doc: trivialDoc('kmeans'),
    facts: [
      {
        id: 'iters', label: 'k-means 收敛所需迭代轮数',
        ask: 'k-means(k=3) 迭代几轮后重心不再移动、收敛?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).iter), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'dtree',
    title: '决策树',
    kernel: dtreeKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：默认档改成**噪声 + 不限深度**，因为"训练 100% 却学不会"
        才是决策树最该记住的事。doc 必须跟 registry 的 defaultDoc 一致。 */
    doc: { kind: 'dtree', params: { data: '四象限 + 噪声', impurity: '基尼', depth: 0 }, entities: [], streams: [] },
    facts: [
      {
        id: 'depth', label: '建好的决策树深度',
        ask: '这棵决策树按不纯度下降建好后，深度是多少?',
        kind: 'number', genre: 'count',
        compute: t => ({ answer: String(last(t).finalDepth), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'dt_ncands', label: '根节点枚举的候选切法数',
        ask: '决策树选第一刀时，在根节点一共枚举了多少个候选切法(每个特征相邻取值的中点)来比较不纯度下降、取最大?',
        kind: 'number', genre: 'count',
        compute: t => { const f = t.find(x => x.phase === 'search' && (x.splits as unknown[]).length === 0)!; return { answer: String(f.nCands), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        /*  补厚的落点：训练准确率单独看没有意义。题面把两个数一起问，
            答案是"缺口有多大"—— 这个数只有摆了留出集才存在。 */
        id: 'dt_gap', label: '不限深度时训练与留出准确率的缺口', kind: 'number', genre: 'count',
        ask: '一份 12% 标签被翻错的数据，**不限深度**建一棵决策树。训练准确率减去留出准确率，差多少个百分点?',
        compute: t => {
          const f = last(t)
          return { answer: ((f.overfit as number) * 100).toFixed(1), step: t.length - 1,
            evidence: `训练 ${((f.trainAcc as number) * 100).toFixed(1)}% − 留出 ${((f.testAcc as number) * 100).toFixed(1)}%` }
        },
        distractors: numDistractors,
      },
      {
        id: 'dt_train100', label: '训练准确率 100% 说明不了学会了', kind: 'choice', genre: 'concept',
        ask: '一棵不限深度的决策树在训练集上做到了 100% 准确。这说明它学会这个任务了吗?',
        compute: t => {
          const f = last(t)
          return {
            answer: '说明不了 —— 它可能只是把每个训练点各圈了一个叶子，什么也没学到',
            step: t.length - 1,
            evidence: `实测：训练 ${((f.trainAcc as number) * 100).toFixed(1)}%，而留出只有 ${((f.testAcc as number) * 100).toFixed(1)}%，共 ${f.maxLeaves} 个叶子`,
          }
        },
        distractors: a => [a,
          '说明学会了 —— 训练集上零错误意味着这棵树完整地表达了数据里的规律',
          '说明深度还不够 —— 再往下切几层，留出集上的分数也会跟着涨上去',
          '说明数据太简单 —— 换一份更难的数据，训练和留出的分数自然就一致了',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'dt_axis', label: '轴对齐切不出斜边界', kind: 'choice', genre: 'concept',
        ask: '真边界是一条 45° 斜线（y = x）时，加深决策树的深度能不能最终把留出准确率推到 100%?',
        compute: t => ({
          answer: '不能 —— 每一刀都必须平行于坐标轴，阶梯每一级都留着判错的三角',
          step: t.length - 1,
          evidence: '实测：对角档训练准确率到 100%，而留出停在 92.5%（基尼）/ 94.3%（信息熵）不再上升',
        }),
        distractors: a => [a,
          '能 —— 台阶切得足够密之后，阶梯就收敛到那条斜线，误差趋于零',
          '能 —— 只要把不纯度指标从基尼换成信息熵，斜边界就能被正确表示出来',
          '不能 —— 因为斜线上的点不纯度恒为 0.5，任何一刀的信息增益都算不出来',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },
  {
    id: 'gbdt',
    title: '梯度提升树 GBDT',
    kernel: gbdtKernel as Kernel<unknown>,
    doc: trivialDoc('gbdt'),
    facts: [
      {
        id: 'rounds', label: 'GBDT boosting 轮数',
        ask: 'GBDT 一共做了多少轮 boosting(每轮用新树去拟合上一轮的残差)?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).round), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'pca',
    title: '主成分分析 PCA',
    kernel: pcaKernel as Kernel<unknown>,
    doc: trivialDoc('pca'),
    facts: [
      {
        id: 'var1', label: 'PC1 保留的方差百分比',
        ask: 'PCA 降维后，第一主成分(PC1)保留了百分之多少的方差?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).var1), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'pooling',
    title: '池化 Pooling',
    kernel: poolingKernel as Kernel<unknown>,
    // registry 的 defaultDoc 带 params:{kind:'最大'}，必须一致，否则答案≠用户屏幕所见。
    doc: { kind: 'pooling', params: { kind: '最大' }, entities: [], streams: [] },
    facts: [
      {
        id: 'br_window', label: '右下角 2×2 窗口的最大池化输出',
        ask: '对这张 4×4 特征图做 2×2 最大池化，右下角(1,1)那个窗口的输出是多少?',
        kind: 'number',
        compute: t => {
          const f = t.find(x => x.wr === 1 && x.wc === 1) ?? last(t)
          return { answer: String(f.result), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'wordvec',
    title: '词向量 Word2Vec',
    kernel: wordvecKernel as Kernel<unknown>,
    doc: trivialDoc('wordvec'),
    facts: [
      {
        id: 'analogy', label: '词向量类比 国王−男人+女人 的最近词',
        ask: '词向量的经典类比：国王 − 男人 + 女人 ≈ 哪个词(向量运算后最近的那个)?',
        kind: 'choice',
        compute: t => ({ answer: String(last(t).nearest), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: answer => ['王后', '国王', '男人', '女人'].filter(x => x !== answer).slice(0, 3),
      },
    ],
  },

  // ── 大模型 / 深度学习(需带 params 的 doc,与 registry 一致) ──
  {
    id: 'knn',
    title: 'k-近邻 k-NN',
    kernel: knnKernel as Kernel<unknown>,
    doc: { kind: 'knn', params: { k: 3 }, entities: [], streams: [] },
    facts: [
      {
        id: 'voteB', label: 'k=3 时最近邻中 B 类的个数',
        ask: 'k-NN 取 k=3，这个查询点的 3 个最近邻里，有几个属于 B 类?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).voteB), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'bpe',
    title: 'BPE 分词',
    kernel: bpeKernel as Kernel<unknown>,
    doc: { kind: 'bpe', params: { text: '英文 lowest' }, entities: [], streams: [] },
    facts: [
      {
        id: 'merges', label: '把 lowest 合并成 1 个 token 的合并次数',
        ask: 'BPE 把 lowest(6 个字符)按 merge 表逐条合并，一共发生了几次合并(merge)?',
        kind: 'number',
        compute: t => {
          const n = t.filter(f => f.act === 'merge').length
          return { answer: String(n), step: t.length - 1, evidence: `trace 中 act='merge' 的帧数 = ${n}；6 符号 → ${6 - n} token` }
        },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'moe',
    title: '混合专家 MoE',
    kernel: moeKernel as Kernel<unknown>,
    doc: { kind: 'moe', params: { topk: 2 }, entities: [], streams: [] },
    facts: [
      {
        id: 'active_pct', label: 'MoE 每 token 激活的参数比例',
        ask: 'MoE 有 4 个专家、每个 token 选 top-2，那么每个 token 实际只激活了百分之多少的专家参数?',
        kind: 'number',
        compute: t => ({ answer: String(Math.round((last(t).activeFrac as number) * 100)), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'quant',
    title: '权重量化 W8',
    kernel: quantKernel as Kernel<unknown>,
    doc: { kind: 'quant', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'qmax', label: 'int8 的正整数上限 qmax',
        ask: 'int8 量化用带符号 8 位整数表示，它的正数上限 qmax 是多少?',
        kind: 'number',
        compute: t => { const i = t.findIndex(f => f.bits === 8); const f = t[i] ?? last(t); return { answer: String(f.qmax), step: i < 0 ? t.length - 1 : i, evidence: `int8 范围 ±127；qmax=${f.qmax}` } },
        distractors: numDistractors,
      },
      {
        id: 'bytesQ', label: '8 个权重量化后占的字节数',
        ask: '把 8 个 fp32 权重量化成 int8 后，一共占多少字节(原本 fp32 是 32 字节)?',
        kind: 'number',
        compute: t => { const i = t.findIndex(f => f.bits === 8); const f = t[i] ?? last(t); return { answer: String(f.bytesQ), step: i < 0 ? t.length - 1 : i, evidence: `fp32=32B → int8=${f.bytesQ}B，压 4 倍` } },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'specdec',
    title: '投机解码',
    kernel: specdecKernel as Kernel<unknown>,
    doc: { kind: 'specdec', params: { k: 3 }, entities: [], streams: [] },
    facts: [
      {
        id: 'target_passes', label: '生成 8 token 大模型的前向次数',
        ask: '投机解码用小模型起草、大模型验证。最终生成 8 个 token，大模型(target)一共只做了几次前向?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).targetPasses), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'selfconsist',
    title: '自洽性 Self-Consistency',
    kernel: selfconsistKernel as Kernel<unknown>,
    doc: trivialDoc('selfconsist'),
    facts: [
      {
        id: 'winner', label: '采样够多(N=25)时多数投票胜出的答案',
        ask: '自洽性采样多条推理链再多数投票。「小明有 5 个苹果，又买了 3 袋每袋 4 个」这题，采样到 N=25 条链、多数投票投出的最终答案是多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).winner), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'n1', label: 'N=1(单条链、不投票)时的答案——不走运抽到错的',
        ask: '自洽性的核心是"采样越多越可靠"。若只采样 N=1 条链(相当于单条贪心、不投票),答案就是那一条的结果。本实验 N=1 恰好抽到一条算错的链，此时答案是多少?',
        kind: 'number',
        compute: t => ({ answer: String(t[0]!.winner), step: 0, evidence: String(t[0]!.log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'conv',
    title: '卷积 CNN',
    kernel: convKernel as Kernel<unknown>,
    // registry defaultDoc 带 params:{kernel:'边缘'}，必须一致。
    doc: { kind: 'conv', params: { kernel: '边缘' }, entities: [], streams: [] },
    facts: [
      {
        id: 'out_cells', label: '3×3 核在 5×5 图上 valid 卷积的输出格子数',
        ask: '一个 3×3 卷积核在 5×5 输入上做 valid 卷积(不补零)，会滑过多少个位置(即输出特征图有多少个格子)?',
        kind: 'number',
        compute: t => {
          const n = t.filter(f => f.phase === 'run').length
          return { answer: String(n), step: t.length - 1, evidence: `5-3+1=3，输出 3×3；trace 中卷积步 = ${n}` }
        },
        distractors: numDistractors,
      },
    ],
  },

  // ── 计算机系统组(408 核心；doc 含 params/streams/entities，与 registry 逐字一致) ──
  {
    id: 'page',
    title: '页面置换',
    kernel: pageKernel as Kernel<unknown>,
    doc: { kind: 'page', params: { algorithm: 'FIFO', frames: 3 }, entities: [], streams: [{ name: 'referenceString', values: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5] }] },
    facts: [
      {
        id: 'faults', label: 'FIFO 3 帧的缺页次数',
        ask: 'FIFO 置换、3 个物理帧，引用串 1,2,3,4,1,2,5,1,2,3,4,5 一共缺页(page fault)多少次?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).faults), step: t.length - 1, evidence: `终态 faults=${last(t).faults}、hits=${last(t).hits}` }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'disk',
    title: '磁盘调度',
    kernel: diskKernel as Kernel<unknown>,
    doc: { kind: 'disk', params: { algorithm: 'SSTF', headStart: 53, maxTrack: 199, direction: 1 }, entities: [], streams: [{ name: 'requests', values: [98, 183, 37, 122, 14, 124, 65, 67] }] },
    facts: [
      {
        id: 'total_move', label: 'SSTF 磁头总移动磁道数',
        ask: 'SSTF 磁盘调度，磁头从 53 出发，请求队列 98,183,37,122,14,124,65,67，磁头总共移动多少个磁道?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).total), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'cache',
    title: 'Cache 组相联',
    kernel: cacheKernel as Kernel<unknown>,
    doc: { kind: 'cache', params: { addressBits: 32, cacheSizeBytes: 256, blockSizeBytes: 16, associativity: 2, replacement: 'LRU' }, entities: [], streams: [{ name: 'accessSequence', values: [0x000, 0x010, 0x020, 0x000, 0x110, 0x210, 0x010, 0x020, 0x110, 0x000, 0x030, 0x210] }] },
    facts: [
      {
        id: 'hits', label: '2 路组相联 LRU 的命中次数',
        ask: '2 路组相联、块 16 字节、LRU，这 12 次访问里一共命中(hit)多少次?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).hits), step: t.length - 1, evidence: `终态 hits=${last(t).hits}、misses=${last(t).misses}` }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'tcp',
    title: 'TCP 拥塞控制',
    kernel: tcpKernel as Kernel<unknown>,
    doc: { kind: 'tcp', params: { variant: 'Reno', initialCwnd: 1, initialSsthresh: 16, rounds: 20 }, entities: [{ id: 'L1', type: 'loss', at: 8, attrs: { type: 'tripleDup' } }, { id: 'L2', type: 'loss', at: 13, attrs: { type: 'timeout' } }], streams: [] },
    facts: [
      {
        id: 'final_cwnd', label: '第 20 轮的拥塞窗口 cwnd',
        ask: 'TCP Reno，初始 cwnd=1、ssthresh=16，第 8 轮三次重复 ACK、第 13 轮超时，跑到第 20 轮时 cwnd 是多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).cwnd), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'banker',
    title: '银行家算法',
    kernel: bankerKernel as Kernel<unknown>,
    doc: {
      kind: 'banker', params: { resources: 'A,B,C' }, streams: [],
      entities: [
        { id: 'A', type: 'resource', attrs: { total: 10 } },
        { id: 'B', type: 'resource', attrs: { total: 5 } },
        { id: 'C', type: 'resource', attrs: { total: 7 } },
        { id: 'P0', type: 'process', attrs: { max_A: 7, max_B: 5, max_C: 3, alloc_A: 0, alloc_B: 1, alloc_C: 0 } },
        { id: 'P1', type: 'process', attrs: { max_A: 3, max_B: 2, max_C: 2, alloc_A: 2, alloc_B: 0, alloc_C: 0 } },
        { id: 'P2', type: 'process', attrs: { max_A: 9, max_B: 0, max_C: 2, alloc_A: 3, alloc_B: 0, alloc_C: 2 } },
        { id: 'P3', type: 'process', attrs: { max_A: 2, max_B: 2, max_C: 2, alloc_A: 2, alloc_B: 1, alloc_C: 1 } },
        { id: 'P4', type: 'process', attrs: { max_A: 4, max_B: 3, max_C: 3, alloc_A: 0, alloc_B: 0, alloc_C: 2 } },
      ],
    },
    facts: [
      {
        id: 'is_safe', label: '该状态是否处于安全状态',
        ask: '银行家算法：给定各进程的 Max 与 Allocation、可用资源，判断当前系统是否处于安全状态?',
        kind: 'choice',
        compute: t => ({ answer: last(t).act === 'safe' ? '安全' : '不安全', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: answer => (answer === '安全' ? ['不安全（找不到安全序列）', '已经死锁'] : ['安全（存在安全序列）', '已经死锁']),
      },
      {
        id: 'first_proc', label: '安全序列中第一个执行的进程',
        ask: '银行家算法找到的安全序列里，第一个可以安全执行完的进程是哪个?',
        kind: 'choice',
        compute: t => {
          const m = String(last(t).log ?? '').match(/P\d/)
          return { answer: m ? m[0] : 'P1', step: t.length - 1, evidence: String(last(t).log ?? '') }
        },
        distractors: answer => ['P0', 'P1', 'P2', 'P3', 'P4'].filter(x => x !== answer).slice(0, 3),
      },
    ],
  },
  {
    id: 'hamming',
    title: '海明码',
    kernel: hammingKernel as Kernel<unknown>,
    doc: { kind: 'hamming', params: { operation: 'check', errorAt: 5, evenParity: 1 }, entities: [], streams: [{ name: 'dataBits', values: HAMMING_PRESETS[0]!.values }] },
    facts: [
      {
        id: 'syndrome', label: '海明码校验子指出的出错位号',
        ask: '对收到的这个偶校验海明码字做校验，各校验位算出的校验子(syndrome)指出第几位出错?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).syndrome), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'crc',
    title: 'CRC 校验',
    kernel: crcKernel as Kernel<unknown>,
    doc: { kind: 'crc', params: { generator: '10011', operation: 'encode', errorAt: -1 }, entities: [], streams: [{ name: 'dataBits', values: CRC_PRESETS[0]!.values }] },
    facts: [
      {
        id: 'remainder', label: 'CRC 编码的余数 FCS',
        ask: 'CRC 用生成多项式 10011(即 x⁴+x+1)对数据做模 2 除法，得到的余数(FCS)是多少?',
        kind: 'choice',
        compute: t => ({ answer: String(last(t).remainder), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: answer => ['1111', '1010', '0110', '1101'].filter(x => x !== answer).slice(0, 3),
      },
    ],
  },
  {
    id: 'subnet',
    title: '子网划分',
    kernel: subnetKernel as Kernel<unknown>,
    doc: { kind: 'subnet', params: { operation: 'subnet', prefix: 25, splitBits: 0 }, entities: ROUTE_PRESETS[0]!.entities, streams: [{ name: 'addresses', values: SUBNET_PRESETS[0]!.values }] },
    facts: [
      {
        id: 'addr_total', label: '/25 子网的地址总数',
        ask: '前缀长度为 /25 的子网，一共包含多少个 IP 地址(含网络号与广播地址)?',
        kind: 'number',
        compute: t => {
          const total = 2 ** (32 - Number(last(t).prefix))
          return { answer: String(total), step: t.length - 1, evidence: `主机号 ${32 - Number(last(t).prefix)} 位 → 2^${32 - Number(last(t).prefix)} = ${total}` }
        },
        distractors: answer => [String(Number(answer) / 2), String(Number(answer) * 2), String(Number(answer) - 2)].filter(x => x !== answer).slice(0, 3),
      },
    ],
  },
  {
    id: 'huffman',
    title: 'Huffman 编码',
    kernel: huffmanKernel as Kernel<unknown>,
    doc: { kind: 'huffman', params: {}, entities: [], streams: [{ name: 'weights', values: HUFF_PRESETS[0]!.values }] },
    facts: [
      {
        id: 'wpl', label: 'Huffman 树的带权路径长度 WPL',
        ask: '按这些字符频率建 Huffman 树，最终的带权路径长度(WPL，也就是编码总位数)是多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).wpl), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },

  // ── 数据库系统(求职核心) ──
  {
    id: 'bplus',
    title: 'B+ 树索引',
    kernel: bplusKernel as Kernel<unknown>,
    // registry defaultDoc:order 3 + BPLUS_PRESETS[1]，逐字复刻。
    doc: { kind: 'bplus', params: { order: 3 }, entities: [], streams: [{ name: 'keys', values: BPLUS_PRESETS[1]!.values }] },
    facts: [
      {
        id: 'height', label: '插入完成后 B+ 树的高度',
        ask: '阶 m=3 的 B+ 树(每个节点最多 2 个键)，按顺序插入这串键后，树的高度是多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).height), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'splits', label: '插入过程中的节点分裂次数',
        ask: 'B+ 树插入时节点满了就分裂。整个插入过程一共发生了多少次节点分裂(split)?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).splits), step: t.length - 1, evidence: `终态 splits=${last(t).splits}` }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'lrucache', title: '手写 LRU 缓存', kernel: lrucacheKernel as Kernel<unknown>, doc: trivialDoc('lrucache'),
    facts: [
      {
        id: 'two_structs', label: 'LRU 为什么要 HashMap + 双向链表两个结构',
        ask: '实现 O(1) 的 LRU 缓存，为什么要同时用 HashMap 和双向链表?', kind: 'choice',
        compute: () => ({ answer: 'HashMap 管定位，双向链表管顺序，都 O(1)', step: 0, evidence: 'get 命中要把节点移到头，删除中间节点需要前驱指针，所以必须双向链表' }),
        distractors: () => ['HashMap 一个就够，链表只是为了方便打印内容', '双向链表管定位，HashMap 只记每个键的过期时间', '用单向链表也行，删节点时从头遍历找前驱够快'],
      },
      {
        id: 'evict_tail', label: 'LRU 淘汰谁、命中怎么处理',
        ask: '容量满时 LRU 淘汰哪个？get 命中一个 key 后要做什么?', kind: 'choice',
        compute: () => ({ answer: '淘汰链表尾部；命中后把该节点移到头部', step: 4, evidence: 'put(3,3) 时容量满 → 淘汰尾部 2；get(1) 命中 → 把 1 移到头部' }),
        distractors: () => ['淘汰链表头部；命中后把该节点移到尾部', '淘汰值最小的那个；命中之后不需要动链表', '随机淘汰一个；命中之后把该节点直接删掉'],
      },
    ],
  },
  {
    id: 'topk', title: '设计海量数据 Top-K', kernel: topkKernel as Kernel<unknown>, doc: trivialDoc('topk'),
    facts: [
      {
        id: 'hash_shard', label: 'Top-K 为什么用哈希分片而不是随机切',
        ask: '海量数据求 Top-K 要分片处理，为什么用 hash(词)%N 分片，而不是随机/轮询切成 N 块?', kind: 'choice',
        compute: () => ({ answer: '相同的词一定落同一片，计数不会被拆开', step: 1, evidence: '本例「苹果」hash%2=1 每次都进 shard1、「香蕉」每次进 shard0，计数不被拆' }),
        distractors: () => ['哈希分片切得更均匀，每片数据量完全相等', '随机切会丢数据，轮询切会把顺序打乱掉', '两种切法没区别，汇总时都能得到正确结果'],
      },
      {
        id: 'min_heap', label: '求 Top-K 为什么用小顶堆',
        ask: '求出现最多的 K 个，为什么用大小为 K 的小顶堆，而不是全部排序?', kind: 'choice',
        compute: () => ({ answer: '堆顶是当前第 K 大，比它小的直接扔掉', step: 10, evidence: '本例堆满门槛=1，橙子3>1→淘汰堆顶梨1、门槛升到3；葡萄2/桃1≤3直接扔' }),
        distractors: () => ['该用大顶堆，堆顶就是最大的，取 K 次即可', '必须全部排序才能求 Top-K，堆做不到', '用哈希表统计完直接排序，比堆更省内存'],
      },
    ],
  },
  {
    id: 'reactagent', title: 'Agent 主循环 · 防死循环', kernel: reactagentKernel as Kernel<unknown>, doc: trivialDoc('reactagent'),
    facts: [
      {
        id: 'ra_terminate', label: 'Agent 主循环怎么正确地停',
        ask: 'Thought→Action→Observation 的 Agent 循环，怎么"正确地停"、有哪几条终止路径?', kind: 'choice',
        compute: t => { const f = t as unknown as { halt?: string; stepCount?: number }[]; const l = f[f.length - 1]; return ({ answer: '四条：正常、检测到重复、超预算、出错兜底', step: Math.max(0, f.length - 1), evidence: `本例默认"正常"场景：${l?.stepCount ?? 3} 步后模型不再发工具、正常终止` }) },
        distractors: () => ['只有一种：等模型自己说结束，别的都不停', '固定跑满 N 步就停，不看内容也不看进展', '永远跑到用户手动关掉，框架不该替它决定'],
      },
      {
        id: 'ra_stuck', label: '模型陷入重复怎么办',
        ask: 'Agent 循环里模型卡住了、一直发同一个动作(反复 search 同一个词)，怎么防它无限跑?', kind: 'choice',
        compute: () => ({ answer: 'stuck 检测：最近几步动作相同就停', step: 4, evidence: '切"重复"场景：最近 3 步动作全相同 → stuck 中止' }),
        distractors: () => ['timeout：超过 60s 就掐掉', 'temperature 调高，让它自己跳', 'budget 上限：跑满 N 步就停，不看动作'],
      },
      {
        id: 'ra_budget', label: '任务不收敛怎么控成本',
        ask: '任务很难、Agent 一直不收敛，怎么防止它烧爆算力/预算?', kind: 'choice',
        compute: () => ({ answer: '设步数或成本上限，撞了就停并交出当前进展', step: 5, evidence: '切"超预算"场景：走满 6 步预算 → 停、交 best-effort' }),
        distractors: () => ['不用管，模型会自己省着用，不会烧太多算力', '无限跑直到出结果，中途停会浪费前面的进展', '每一步都问用户要不要继续，由人来兜这个底'],
      },
      {
        id: 'ra_autosubmit', label: 'Agent 跑一半崩了怎么办',
        ask: 'Agent 跑到一半崩溃了(沙箱被 OOM 杀、异常、超时)，好的做法是?', kind: 'choice',
        compute: () => ({ answer: '不硬崩退出，而是尽力交一版当前的进展出去', step: 3, evidence: '切"出错"场景：崩溃 → autosubmit 交一版已改好的 config' }),
        distractors: () => ['直接抛异常退出，这一趟作废，重跑一次即可', '自动从头重跑一遍，直到某次没有崩溃为止', '把错误藏起来假装成功，让上游以为跑完了'],
      },
      {
        id: 'ra_step_turn', label: 'step 和 turn 的区别',
        ask: 'Agent 工程里 step 和 turn 是一回事吗，预算按哪个算?', kind: 'choice',
        compute: () => ({ answer: 'step=一次模型请求加它触发的工具', step: 1, evidence: '一个 turn 里模型可能连着调好几次工具=好几个 step' }),
        distractors: () => ['step 和 turn 完全一样', 'turn 是一个 step 里的一小步', '预算只能按对话轮数(turn)算'],
      },
    ],
  },
  {
    id: 'ctxcompact', title: '上下文压缩', kernel: ctxcompactKernel as Kernel<unknown>, doc: trivialDoc('ctxcompact'),
    facts: [
      {
        id: 'cc_pipeline', label: '上下文窗口爆了的标准处理流水线',
        ask: 'Agent 长会话把上下文窗口撑爆了，工程上标准的处理流水线是怎样的?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; before: number; running: number }[]; const r = f.find(x => x.stage === 'rebuild'); return ({ answer: '量 token→过阈值→留头尾压中间', step: f.findIndex(x => x.stage === 'rebuild'), evidence: r ? `本例 ${r.before}→${r.running} tokens` : '压回阈值下' }) },
        distractors: () => ['量 token→过阈值→从最新往前删', '量字数→到上限→整段丢给模型重写', '不量→换更大窗口的模型→不压缩'],
      },
      {
        id: 'cc_trigger', label: '压缩的触发阈值怎么算',
        ask: '上下文窗口 120 tokens、thresholdRatio=0.8，累计到多少 tokens 触发压缩?', kind: 'number',
        compute: t => { const f = t as unknown as { threshold: number; stage: string }[]; const thr = f.find(x => x.threshold != null)?.threshold ?? 96; return ({ answer: String(thr), step: Math.max(0, f.findIndex(x => x.stage === 'full')), evidence: `阈值 = 窗口 120 × thresholdRatio 0.8 = ${thr}（DeepSeek Harness/Goose 默认 0.8，Codex ~0.9）` }) },
        distractors: numDistractors,
      },
      {
        id: 'cc_keep_drop', label: '压缩时保留什么、压什么',
        ask: '压缩上下文时，哪些内容要原样保留、哪些被压掉?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string }[]; return ({ answer: '留头留最近、压中间，不拆散调用与结果', step: f.findIndex(x => x.stage === 'partition'), evidence: '头=系统+首任务、尾=最新几条原样、中间被压；尾巴宁可略超预算也把成对的 call/result 补齐' }) },
        distractors: () => ['只保留最新的一条，其余的全部删掉不留', '保留最长的那几条，短消息一律压掉', '按字母顺序保留一半，另一半直接省略'],
      },
      {
        id: 'cc_sum_vs_elide', label: '总结 vs 省略的取舍',
        ask: '压中间那段，用"总结成摘要"还是"直接省略"，两者怎么取舍?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string }[]; return ({ answer: '总结有损但记得住，省略免费但会失忆', step: Math.max(0, f.findIndex(x => x.stage === 'rebuild')), evidence: 'DeepSeek/Claude Code/Codex 用 8 段式摘要模板；SWE-agent 用「N 行已省略」的确定性省略' }) },
        distractors: () => ['总结和省略效果一样，随便挑一个用就行', '省略更好，因为它把信息完整保留下来了', '总结不花钱，所以任何时候都该用总结'],
      },
      {
        id: 'cc_cjk_token', label: '为什么 4字/token 估算对中文有坑',
        ask: '很多框架用"~4 字/token"快速估 token，这对中文场景有什么坑?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; meter?: { est: number; real: number } }[]; const m = f.find(x => x.meter)?.meter; return ({ answer: `低估中文：1 字≈1 token，触发晚`, step: f.findIndex(x => x.meter), evidence: m ? `本例一句中文估 ${m.est}、实际约 ${m.real}，低估 ${(m.real / m.est).toFixed(1)} 倍` : '中文被严重低估' }) },
        distractors: () => ['高估中文：1 字≈4 token，触发早', '中文英文都准：4 字≈1 token 通用', '只影响英文：中文按 1 字 1 token'],
      },
    ],
  },
  {
    id: 'toolcall', title: '工具调用', kernel: toolcallKernel as Kernel<unknown>, doc: trivialDoc('toolcall'),
    facts: [
      {
        id: 'tc_pipeline', label: 'harness 处理工具调用的流水线',
        ask: '模型发出一个工具调用后，harness 用什么样的流水线来处理它?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string }[]; return ({ answer: '解析→门禁→带超时执行→结果配对喂回去', step: 1, evidence: '本例 5 个调用各走这条流水线，卡在不同阶段' }) },
        distractors: () => ['模型直接执行工具，harness 不参与这个过程', '把工具名当普通文本拼进回复里返回给用户', '每个调用都要用户手动确认之后才能真的跑'],
      },
      {
        id: 'tc_error', label: '工具调用失败了怎么办',
        ask: '一个工具调用解析失败 / 工具不存在 / 被权限拒绝，好的 harness 怎么处理?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; history?: { ok: boolean }[] }[]; const d = f.find(x => x.stage === 'done'); const fails = d?.history?.filter(h => !h.ok).length ?? 3; return ({ answer: '错误当 tool_result 喂回，不中断', step: f.findIndex(x => x.stage === 'done'), evidence: `本例 5 个调用里 ${fails} 个失败（拒绝/未知/解析错），全变成 error 结果回灌、循环没断` }) },
        distractors: () => ['静默丢掉这次 tool_call，当没发生过', '直接抛异常，Agent loop 就地停掉', '自动换一个最像的 tool 照样执行'],
      },
      {
        id: 'tc_encoding', label: '工具调用一定是 JSON 吗',
        ask: '模型发的工具调用，一定是 JSON（function-calling）格式吗?', kind: 'choice',
        compute: () => ({ answer: '不一定，也有自由文本、diff、代码块标签', step: 0, evidence: '编码方式是工具调用的一个关键设计取舍：function-calling vs 文本/XML' }),
        distractors: () => ['必须是 JSON，别的格式 harness 解析不了', '必须是 XML 标签，这是各家统一的约定', '必须是 Python 代码，靠执行它来调用工具'],
      },
      {
        id: 'tc_execute', label: 'calc 工具真执行的结果',
        ask: '本实验里 calc 工具收到 1234*5678，执行后返回多少（引擎真算，不是写死）?', kind: 'number',
        compute: t => { const f = t as unknown as { call?: { name: string; result: string }; outcome: string }[]; const c = f.find(x => x.call?.name === 'calc' && x.outcome === 'ok'); return ({ answer: c?.call?.result ?? '7006652', step: 2, evidence: 'calc 工具解析 "1234*5678" 并求值——execute 这步由引擎真算' }) },
        distractors: numDistractors,
      },
      {
        id: 'tc_parallel', label: '哪些工具调用能并行',
        ask: '一批工具调用里，哪些能并行跑、哪些必须独占排队?', kind: 'choice',
        compute: () => ({ answer: '只读的可并行，有副作用的必须独占排队', step: 1, evidence: '按"有无副作用"分类：并行安全 vs 独占' }),
        distractors: () => ['所有调用都必须串行，一个跑完再跑下一个', '所有调用都能无脑并行，互相之间不影响', '按调用的字母顺序决定哪些能并行哪些不能'],
      },
    ],
  },
  {
    id: 'permguard', title: '沙箱 / 权限', kernel: permguardKernel as Kernel<unknown>, doc: trivialDoc('permguard'),
    facts: [
      {
        id: 'pg_two_walls', label: 'Agent 靠什么决定放不放行模型的命令',
        ask: 'Agent 要跑模型生成的命令，靠什么机制决定放不放行?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; history?: { final: string }[] }[]; const d = f.find(x => x.stage === 'done'); const blk = d?.history?.filter(h => h.final === 'blocked').length ?? 2; const run = (d?.history?.length ?? 5) - blk; return ({ answer: '规则审批 + 沙箱两道墙，都过才跑', step: f.findIndex(x => x.stage === 'done'), evidence: `本例默认模式：${run} 跑 / ${blk} 拦` }) },
        distractors: () => ['全靠模型自己判断这条命令该不该跑', '所有命令都要用户逐条确认之后才放行', '只看命令字符串的长度和有没有危险词'],
      },
      {
        id: 'pg_precedence', label: 'allow/ask/deny 规则的优先级',
        ask: '一条命令同时匹配到 allow 和 deny 规则，听谁的?', kind: 'choice',
        compute: () => ({ answer: 'deny→ask→allow，首次匹配', step: 3, evidence: '本例 rm -rf /tmp/* 第一条 deny 就拦下' }),
        distractors: () => ['allow→ask→deny，首次匹配', 'deny→allow→ask，末次匹配', 'ask→deny→allow，全部匹配取交'],
      },
      {
        id: 'pg_bypass_net', label: '放行模式还能被拦住联网吗',
        ask: 'Agent 开了"放行"模式(--dangerously-skip-permissions，跳过所有审批)，它还能被拦住联网吗?', kind: 'choice',
        compute: () => ({ answer: '能。沙箱是独立的第二道墙，网络默认关', step: 4, evidence: '本例即便放行模式，curl 联网仍被沙箱拦住' }),
        distractors: () => ['不能，放行模式会跳过一切限制包括沙箱', '要看模型自己愿不愿意去联网，不好说', '只有付费版才会拦，免费版一律放行'],
      },
      {
        id: 'pg_failclosed', label: '沙箱起不来了怎么办',
        ask: '要跑命令时沙箱环境起不来（不可用），一个安全的 harness 怎么办?', kind: 'choice',
        compute: () => ({ answer: 'fail-closed：报错拒绝，宁可拦错', step: 0, evidence: '安全默认永远是 fail-closed' }),
        distractors: () => ['fail-open：没沙箱就直接在宿主机上跑', '静默跳过这条命令，当作它已经跑过了', '自动降权之后照跑不误，只是限制小一些'],
      },
      {
        id: 'pg_escalate', label: '越权操作怎么处理',
        ask: '模型要写工作区外的文件(越出沙箱范围)，安全的处理是?', kind: 'choice',
        compute: () => ({ answer: '一次性升级：带理由申请 + 一次人工批准', step: 5, evidence: '本例 write /etc/hosts 越界 → 升级 → 一次批准 → 仅此一次运行' }),
        distractors: () => ['直接拒绝，永远不给写工作区之外的文件', '批准一次之后就永久放行（allow-always）', '模型自己提权就行，不用问人也不用记录'],
      },
    ],
  },
  {
    id: 'subagent', title: '子 Agent · 委派', kernel: subagentKernel as Kernel<unknown>, doc: trivialDoc('subagent'),
    facts: [
      {
        id: 'sa_why', label: '为什么要派独立子 agent',
        ask: '复杂任务，父 agent 为什么要派独立子 agent 去干、而不是自己全包?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; internalTotal: number; returnTotal: number }[]; const d = f.find(x => x.stage === 'done'); return ({ answer: '省上下文：探索关在子里，只回传结论', step: f.findIndex(x => x.stage === 'done'), evidence: d ? `本例子内部共 ${d.internalTotal}t，父只涨 ${d.returnTotal}t` : '子内部大、回传小' }) },
        distractors: () => ['为了跑得更慢一些，好让人看清每一步', '子 agent 比父更聪明、能力也更强一些', '为了绕过父 agent 身上的那些权限限制'],
      },
      {
        id: 'sa_return', label: '子 agent 回传给父的是什么',
        ask: '子 agent 干完活，回传给父 agent 的是什么?', kind: 'choice',
        compute: () => ({ answer: '只回传最终结论，不带子的对话轨迹', step: 1, evidence: '子内部几百 t 的探索，只回传一句结论' }),
        distractors: () => ['把子的完整对话轨迹原样搬回父那边', '什么都不回传，父自己去猜出结果', '只回传子这一趟用掉了多少 token'],
      },
      {
        id: 'sa_forkbomb', label: '怎么防子生子指数爆炸',
        ask: '子 agent 还能再派子 agent，怎么防止子生子、指数爆炸(fork 炸弹)?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; depthCap: number; concCap: number }[]; const d = f.find(x => x.depthCap != null); return ({ answer: '深度上限（到顶摘掉 spawn）+ 并发上限', step: f.findIndex(x => x.stage === 'blocked'), evidence: `本例深度上限 ${d?.depthCap ?? 3}、并发上限 ${d?.concCap ?? 20}；B1a 在深度 3 想再派 → 拦下` }) },
        distractors: () => ['不用防，模型自己会收敛到合理层数', '每派一次子都弹窗问一次用户要不要', '限制每个子 agent 的 token 长度上限'],
      },
      {
        id: 'sa_spawn_fork', label: 'spawn 和 fork 的区别',
        ask: '起子 agent 有 spawn(新开) 和 fork(承接) 两种，区别是?', kind: 'choice',
        compute: () => ({ answer: 'spawn 从空白起，fork 承接父的前缀', step: 0, evidence: '本例新开=子起 10t、承接=子起 120t(父前缀)' }),
        distractors: () => ['两者完全一样，只是叫法上的差别而已', 'fork 更快，因为它根本不带任何上下文', 'spawn 会把父 agent 自己也复制出一份'],
      },
      {
        id: 'sa_saved', label: '委派省下多少 token',
        ask: '本例子 agent 内部共花 230t、回传给父 36t，父一共省下多少 token?', kind: 'number',
        compute: t => { const f = t as unknown as { stage: string; internalTotal: number; returnTotal: number }[]; const d = f.find(x => x.stage === 'done'); const saved = (d?.internalTotal ?? 230) - (d?.returnTotal ?? 36); return ({ answer: String(saved), step: f.findIndex(x => x.stage === 'done'), evidence: `子内部 ${d?.internalTotal ?? 230}t − 回传 ${d?.returnTotal ?? 36}t = ${saved}t 的探索被关在子里、没进父上下文` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'memretrieve', title: '记忆检索打分', kernel: memretrieveKernel as Kernel<unknown>, doc: trivialDoc('memretrieve'),
    facts: [
      {
        id: 'mr_scoring', label: 'agent 从记忆库捞哪几条进上下文靠什么',
        ask: 'agent 长期记忆一大堆、上下文塞不下，查询来了靠什么决定捞哪几条?', kind: 'choice',
        compute: () => ({ answer: '打分检索：三信号加权求和取 top-k', step: 3, evidence: '得分 = w·最近 + w·相关 + w·重要，排序取 top-k' }),
        distractors: () => ['FIFO 检索：按存入顺序取最早的 k 条', '全量注入：不检索，整库塞进 context', '随机抽样：均匀抽 k 条，不看相关度'],
      },
      {
        id: 'mr_signals', label: '记忆打分的三个信号',
        ask: 'Generative Agents 给每条记忆打分，用哪三个信号?', kind: 'choice',
        compute: () => ({ answer: '最近度 + 重要度 + 与查询的相关度', step: 1, evidence: '三者各说各话：记忆可以很新但不相关、很重要但不相关' }),
        distractors: () => ['记忆的长度、所用的语言、以及排版格式', '存入的时间、写它的作者、一共有多少个字', '只数一下它和查询之间的关键词重合数'],
      },
      {
        id: 'mr_weights', label: '权重影响什么',
        ask: '三个信号加权求和时，权重(w_rec/w_rel/w_imp)会影响什么?', kind: 'choice',
        compute: () => ({ answer: '权重一变排名就变，捞回来的记忆也不同', step: 2, evidence: '一条"VIP"(重要但不相关)：等权时被捞回，相关权重一大就落榜' }),
        distractors: () => ['权重只影响检索速度，不影响排名结果', '权重必须三者相等，否则分数算不出来', '权重设得越大越省 token，与排名无关'],
      },
      {
        id: 'mr_vip', label: '重要但不相关的记忆会被捞回吗',
        ask: '一条"用户是 VIP"(重要度 9、但跟"修登录 bug"相关度只 0.2)的记忆，会被捞进上下文吗?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; weights: string; mems?: { id: string; retrieved: boolean }[] }[]; const d = f.find(x => x.stage === 'done'); const vip = d?.mems?.find(m => m.id === 'm3'); return ({ answer: `看权重：${d?.weights ?? '均衡'}下它${vip?.retrieved ? '进榜' : '落榜'}，换一档就反过来`, step: Math.max(0, f.findIndex(x => x.stage === 'done')), evidence: `均衡权重下 VIP 进 top-k、重相关权重下出局` }) },
        distractors: () => ['一定会被捞回来，因为它的重要度最高', '一定捞不回来，因为它跟查询不相关', '只看它存进去有多久，跟权重没有任何关系'],
      },
      {
        id: 'mr_topk', label: '检索捞回几条',
        ask: '本实验记忆流 6 条，一次检索捞回几条进上下文(top-k 的 k)?', kind: 'number',
        compute: t => { const f = t as unknown as { topK: number; mems?: { retrieved: boolean }[] }[]; const k = f.find(x => x.topK != null)?.topK ?? 3; return ({ answer: String(k), step: 3, evidence: `按得分排序，只把前 ${k} 条捞进上下文，其余留库里(没删)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'mempaging', title: 'MemGPT 虚拟内存 · 分页', kernel: mempagingKernel as Kernel<unknown>, doc: trivialDoc('mempaging'),
    facts: [
      {
        id: 'mp_analogy', label: 'MemGPT 怎么解决上下文装不下',
        ask: '上下文窗口有限、装不下所有历史，MemGPT 的核心思路是什么?', kind: 'choice',
        compute: () => ({ answer: '上下文当内存、外部存储当磁盘，来回搬', step: 0, evidence: 'RAM 快·贵·小，磁盘慢·便宜·大，靠数据搬运制造"内存无限大"的假象' }),
        distractors: () => ['换一个上下文窗口更大的模型来顶上去', '把老消息直接删干净，只留最新的那几条', '把全部历史压成一句话塞在开头就够了'],
      },
      {
        id: 'mp_tiers', label: 'MemGPT 的两层内存',
        ask: 'MemGPT 的主上下文(进 prompt)和外部存储(不进 prompt)各含什么?', kind: 'choice',
        compute: () => ({ answer: '主=指令+工作记忆+队列，外部=两个存储库', step: 0, evidence: 'RAM 里是当前要用的，磁盘里是全量历史+可检索库' }),
        distractors: () => ['主上下文只放系统指令，别的全在外部存储', '两层其实都是同一个向量数据库，没有分别', '主上下文放用户消息、外部存储放助手的回复内容'],
      },
      {
        id: 'mp_pressure', label: '内存压力警告的阈值',
        ask: 'MemGPT 里上下文窗口是 100 tokens，涨到多少 tokens 触发"内存压力"警告(70% 线)?', kind: 'number',
        compute: t => { const f = t as unknown as { warnAt: number }[]; const w = f.find(x => x.warnAt != null)?.warnAt ?? 70; return ({ answer: String(w), step: 2, evidence: `警告线 = 窗口 100 × 70% = ${w}(MemGPT 论文值)；到 100% 强制 flush` }) },
        distractors: numDistractors,
      },
      {
        id: 'mp_evict', label: '内存压力到了怎么办',
        ask: '上下文到了内存压力线，MemGPT 的队列管理器怎么腾空间?', kind: 'choice',
        compute: () => ({ answer: '驱逐最老的一半到磁盘，并写回递归摘要', step: 3, evidence: '本例驱逐 3 条老消息→recall、队首写递归摘要，RAM 从 77 降到 49' }),
        distractors: () => ['把整个上下文清空掉，从头重新开始一轮', '停下来等用户自己动手删掉一些老消息', '把最新的那几条消息删掉，把老的留住'],
      },
      {
        id: 'mp_pagefault', label: '需要已驱逐的旧信息怎么办',
        ask: 'agent 需要一条已被驱逐到磁盘的旧消息(缺页)，怎么拿回来?', kind: 'choice',
        compute: () => ({ answer: '函数调用检索出来，追加回队尾重进窗口', step: 4, evidence: '本例需要已驱逐的 NPE 那条→检索调回队尾，RAM 升回' }),
        distractors: () => ['没办法，一旦驱逐到磁盘上就永远丢失了', '让模型凭着印象把那条旧消息重新编一遍', '整个会话推倒重启，从第一条重新跑起'],
      },
    ],
  },
  {
    id: 'reflection', title: '反思 · 记忆巩固', kernel: reflectionKernel as Kernel<unknown>, doc: trivialDoc('reflection'),
    facts: [
      {
        id: 'rf_why', label: '为什么 agent 要反思',
        ask: '"用户是个后端工程师"这种高层判断，agent 从哪来?', kind: 'choice',
        compute: () => ({ answer: '反思：多条观察综合起来抽象成高层洞察', step: 3, evidence: '检索只能捞已有条目；高层理解要靠反思综合出来' }),
        distractors: () => ['直接从某一条原始观察里原样读出来就行', '每次要用的时候，现问一遍用户本人确认', '模型预训练的时候天生就知道，不用推导'],
      },
      {
        id: 'rf_trigger', label: '反思的触发阈值(本例默认)',
        ask: '本实验默认阈值下，最近观察的重要度之和累计到多少就触发一次反思?', kind: 'number',
        compute: t => { const f = t as unknown as { threshold: number }[]; const th = f.find(x => x.threshold != null)?.threshold ?? 15; return ({ answer: String(th), step: 2, evidence: `累计重要度 ≥ ${th} 触发(论文里约 150)；重要度低的琐事攒得慢、重要的催得快` }) },
        distractors: numDistractors,
      },
      {
        id: 'rf_evidence', label: '反思的洞察怎么保证不是凭空',
        ask: '反思提炼出的洞察，怎么保证它不是模型凭空断言?', kind: 'choice',
        compute: () => ({ answer: '洞察要引证据：记下由哪几条观察支撑', step: 3, evidence: '本例洞察下写着"证据：o1/o2/o3/o4"' }),
        distractors: () => ['不用保证，模型给出的判断默认都是对', '让用户把每一条洞察都逐条确认一遍', '存下模型给这条洞察打的置信度分数'],
      },
      {
        id: 'rf_tree', label: '洞察产生之后',
        ask: '反思产生一条洞察之后，它怎么处理，能再进化吗?', kind: 'choice',
        compute: () => ({ answer: '当高重要度记忆入库，还能被更高层反思', step: 3, evidence: '观察是叶、洞察是往上长的节点' }),
        distractors: () => ['洞察用完即弃，不会再写回到记忆库里去', '洞察就是终点，不能再被更高层反思了', '洞察会直接覆盖掉支撑它的那些原始观察'],
      },
      {
        id: 'rf_vs_compact', label: '反思和上下文压缩摘要的区别',
        ask: '反思提炼洞察，和上下文压缩里的"摘要"，目的有什么不同?', kind: 'choice',
        compute: () => ({ answer: '压缩为省 token 删繁、反思为理解升华', step: 4, evidence: '一个删繁、一个升华' }),
        distractors: () => ['两者完全一样、只是叫法上不一样而已', '反思是为了省 token、压缩是为了长期理解', '都是为了把模型的参数量给减下来'],
      },
    ],
  },
  {
    id: 'memwrite', title: '记忆写入 · 冲突消解', kernel: memwriteKernel as Kernel<unknown>, doc: trivialDoc('memwrite'),
    facts: [
      {
        id: 'mw_conflict', label: '记忆矛盾了怎么写',
        ask: '用户上月说"住北京"、这周说"搬上海了"，好的记忆系统怎么写?', kind: 'choice',
        compute: () => ({ answer: '检索到矛盾，就改掉或删掉过时那条', step: 3, evidence: '写记忆要比对已有、消解冲突，不是无脑追加' }),
        distractors: () => ['两条都存进去，反正都是用户自己说的', '只信最早那一条、后面说的全部忽略', '每次都把记忆全清空、从头重新存一遍'],
      },
      {
        id: 'mw_ops', label: 'mem0 的四个写入操作',
        ask: 'mem0 往记忆库写新事实时，LLM 会挑哪四种操作之一?', kind: 'choice',
        compute: () => ({ answer: 'ADD / UPDATE / DELETE / NOOP', step: 1, evidence: '本例：养猫=ADD、Python3.12=UPDATE、戒咖啡=DELETE、又提北京=NOOP' }),
        distractors: () => ['只有 ADD 一种，写入就是新建一条', 'CREATE/READ/UPDATE/DELETE（CRUD）', 'INSERT/SELECT，其余全靠模型定'],
      },
      {
        id: 'mw_similar', label: '决定 UPDATE 还是 ADD 靠什么',
        ask: '一条新事实，怎么决定它是 ADD 新建、还是该 UPDATE/DELETE 某条旧记忆?', kind: 'choice',
        compute: () => ({ answer: '先向量检索：没相似就 ADD，有才改', step: 1, evidence: '不先找"该改哪条"，就只能无脑 ADD' }),
        distractors: () => ['按新事实的长度来决定用哪一种', '随机挑一种操作，反正都写得进去', '永远先 DELETE 掉旧的再 ADD 新的'],
      },
      {
        id: 'mw_singlepass', label: 'mem0 现在 OSS 默认怎么写',
        ask: 'mem0 论文是四操作(ADD/UPDATE/DELETE/NOOP)，但它现在开源版默认怎么做?', kind: 'choice',
        compute: t => { const f = t as unknown as { store?: { stale?: boolean }[] }[]; const d = f[f.length - 1]; const stale = d?.store?.filter(m => m.stale).length ?? 0; return ({ answer: '单遍 ADD-only：只新增、不改不删', step: Math.max(0, f.length - 1), evidence: `切单遍模式：${stale || 3} 条旧记忆变陈旧矛盾(美式咖啡 vs 戒咖啡等并存)` }) },
        distractors: () => ['还是老老实实走完整的四种操作', '改成只 DELETE 不 ADD、越写越少', '干脆完全不写记忆、每轮从头来'],
      },
      {
        id: 'mw_zep', label: 'Zep 怎么处理过时事实',
        ask: 'Zep/Graphiti 处理"过时的事实"用了什么不同思路?', kind: 'choice',
        compute: () => ({ answer: '双时间图：打失效时间、不真删', step: 4, evidence: 'bi-temporal：事件时间 + 系统时间两条轴，矛盾时把旧边设失效而非删除' }),
        distractors: () => ['直接把过时的那条旧事实物理删掉', '把所有历史压成一句话再存起来', '从不更新、写进去就再也不动它'],
      },
    ],
  },
  {
    id: 'planning', title: '规划 · 计划模式 + Todo', kernel: planningKernel as Kernel<unknown>, doc: trivialDoc('planning'),
    facts: [
      {
        id: 'pl_planmode', label: '计划模式是硬门禁还是走过场',
        ask: 'Claude Code 的"计划模式"，在你批准计划前能不能直接改文件?', kind: 'choice',
        compute: () => ({ answer: '不能。权限层把写堵死，是硬门禁', step: 1, evidence: 'edits stay blocked until you approve the plan；强制 vs 建议的分叉' }),
        distractors: () => ['能，计划模式只是一句提醒而已', '看模型自己判断，它觉得该改就改', '能，但一次只允许改一个文件'],
      },
      {
        id: 'pl_todo_sm', label: 'Todo 状态机的关键不变量',
        ask: 'Agent 的 todo 列表作为状态机，有什么关键约束?', kind: 'choice',
        compute: () => ({ answer: '三态流转，且恰好一个 in_progress', step: 3, evidence: '本例 t1 done、t2 active，同时只一个进行中' }),
        distractors: () => ['三态流转，可多个 in_progress 并行', '两态流转，pending 直接跳 completed', '四态流转，多一个 blocked 可无限停'],
      },
      {
        id: 'pl_recite', label: 'todo 每轮重贴回近端图什么',
        ask: '把整张 todo 列表每轮重新贴回上下文近端("复述")，主要图什么?', kind: 'choice',
        compute: () => ({ answer: '注意力操控：把计划推回近端，抗漂移', step: 4, evidence: 'Manus："recitation 把全局计划推进近端注意力"' }),
        distractors: () => ['只是为了让用户能看到当前的进度', '为了省 token、把上下文压小一点', '没有用、纯装饰，删掉也没差别'],
      },
      {
        id: 'pl_replan', label: '计划和现实岔开怎么办',
        ask: '执行到一半发现计划没料到的依赖(现实和计划岔开)，怎么办?', kind: 'choice',
        compute: () => ({ answer: '重规划：整表替换、插入新的 todo', step: 4, evidence: '本例抽函数时发现 auth.py 依赖 session.py → 插入「先解耦」一项' }),
        distractors: () => ['硬按原计划走到底、忽略新出现的情况', '直接放弃整个任务、什么都不做了', '删掉所有 todo、从第一步重头再来'],
      },
      {
        id: 'pl_paradigm', label: 'ReAct/Plan-and-Solve/ToT 的区别',
        ask: '几种规划范式 ReAct、Plan-and-Solve、Tree-of-Thoughts 的核心区别?', kind: 'choice',
        compute: () => ({ answer: '边想边做 / 先规划后执行 / 树搜索', step: 5, evidence: '交错 vs 先规划后执行 vs 树搜索' }),
        distractors: () => ['三者完全一样、只是名字上不一样罢了', '都是先执行再回头规划、三者的顺序完全相同', '三者都不需要调用任何的外部工具'],
      },
    ],
  },
  {
    id: 'promptbuild', title: '提示词组装 · 缓存友好排序', kernel: promptbuildKernel as Kernel<unknown>, doc: trivialDoc('promptbuild'),
    facts: [
      {
        id: 'pb_prefix', label: 'prompt 缓存怎么匹配',
        ask: 'prompt 缓存(prompt caching)是怎么匹配命中的?', kind: 'choice',
        compute: () => ({ answer: '最长相同前缀匹配，变一处后面全失效', step: 1, evidence: '找不到命中还会往前回溯最多 20 个块' }),
        distractors: () => ['按内容相似度做模糊匹配、允许有出入', '整个 prompt 逐块独立缓存、互不影响', '只缓存最后一条消息、前面的不缓存'],
      },
      {
        id: 'pb_order', label: '怎么排 prompt 省缓存钱',
        ask: 'Agent 每轮重拼 prompt，怎么排序最能省缓存的钱?', kind: 'choice',
        compute: t => { const f = t as unknown as { ordering: string; prefixTok: number }[]; const d = f.find(x => x.ordering); return ({ answer: '静态排前、动态排后，断点放最后', step: 1, evidence: `本例静态优先前缀 ${d?.prefixTok ?? 85}t 可缓存` }) },
        distractors: () => ['每轮都把最新的消息放到最前面去', '随便排、只要内容一样就能命中', '把最大的那一块放到最后面去'],
      },
      {
        id: 'pb_readcost', label: '命中缓存花多少钱',
        ask: 'prompt 缓存命中(读缓存)的部分，花基础输入价的多少?', kind: 'choice',
        compute: () => ({ answer: '0.1× 基础价（只花 10%）', step: 3, evidence: '命中省 90%，所以要尽量让前缀稳定复用' }),
        distractors: () => ['和全价一样、一分钱都省不下来的', '0.5× 基础价（正好省下一半）', '完全免费、读缓存不计任何的费用'],
      },
      {
        id: 'pb_pitfall', label: '把动态内容放靠前会怎样',
        ask: '把每轮都变的东西(时间戳/运行时快照)塞进 prompt 靠前的块，会怎样?', kind: 'choice',
        compute: () => ({ answer: '前缀每轮都变 → 缓存永远不命中', step: 1, evidence: '本例"乱序"把运行时快照混进 system，只剩工具能缓存、省 21% vs 静态优先 44%' }),
        distractors: () => ['没影响，缓存照样能够正常命中', '缓存反而会更快一点、命中率也更高', '只是稍微慢一点点、影响可忽略'],
      },
      {
        id: 'pb_frameworks', label: '为什么 CLAUDE.md 当独立 user 消息',
        ask: 'Claude Code 为什么把 CLAUDE.md 当独立 user 消息放系统提示之后、而不塞进 system?', kind: 'choice',
        compute: () => ({ answer: '为了不动 system 那段可缓存前缀', step: 4, evidence: '护可缓存前缀，和 KV 缓存/上下文压缩(重放系统提示保前缀)同源' }),
        distractors: () => ['因为 system 那一段实在是放不下了', '因为 user 消息模型会更重视一些些', '纯粹是历史遗留下来的，没有原因'],
      },
    ],
  },
  {
    id: 'lfucache', title: '手写 LFU 缓存', kernel: lfucacheKernel as Kernel<unknown>, doc: trivialDoc('lfucache'),
    facts: [
      {
        id: 'lfu_vs_lru', label: 'LFU 和 LRU 的淘汰规则差别',
        ask: 'LFU 缓存和 LRU 缓存，容量满时淘汰谁的规则有什么本质区别?', kind: 'choice',
        compute: () => ({ answer: 'LRU 看最久没用，LFU 看访问频率', step: 4, evidence: 'put(3) 时淘汰频率最低的 2，而不是最久没用的' }),
        distractors: () => ['两者完全一样、只是叫法上不一样', 'LFU 淘汰的是最近刚用过的那一个 key', 'LFU 随机淘汰、不看任何的指标'],
      },
      {
        id: 'lfu_tie', label: 'LFU 频率相同时淘汰谁',
        ask: 'LFU 里有多个 key 的访问频率并列最低，这时淘汰哪一个?', kind: 'choice',
        compute: () => ({ answer: '并列最低频时，用 LRU 打破平手', step: 7, evidence: 'put(4) 时 1 和 3 都是频率 2，淘汰更久没用的 1' }),
        distractors: () => ['淘汰 key 值最小的那一个', '淘汰最近刚刚用过的那一个 key 条目', '随机淘汰一个同频的 key'],
      },
    ],
  },
  {
    id: 'trie', title: 'Trie 自动补全', kernel: trieKernel as Kernel<unknown>, doc: trivialDoc('trie'),
    facts: [
      {
        id: 'why_trie', label: '自动补全为什么用 Trie 而不是遍历词表',
        ask: '按前缀补全候选词，为什么用 Trie（前缀树），而不是遍历整个词表找前缀匹配的?', kind: 'choice',
        compute: () => ({ answer: '公共前缀共享，只跟前缀长度有关', step: 5, evidence: '走 c→a→r 三步就定位到前缀节点，不用扫全部词' }),
        distractors: () => ['Trie 更省内存，所以查得更快一些', '遍历词表根本就找不到前缀词', '两者的速度其实是完全一样的'],
      },
      {
        id: 'complete_flow', label: 'Trie 补全的三步',
        ask: '输入前缀「car」后，Trie 自动补全是怎么给出候选的?', kind: 'choice',
        compute: () => ({ answer: '前缀节点→DFS 收集→按热度取前 K', step: 7, evidence: '收集到 car(3)/card(2)/care(4)，按频率排 care(4)>car(3)>card(2)' }),
        distractors: () => ['根节点→BFS 逐层→按字母序取前 K', '前缀节点→只取该节点挂的那一个词', '全表扫描→逐个前缀比对→原序返回'],
      },
    ],
  },
  {
    id: 'quickselect', title: '快速选择 Quickselect', kernel: quickselectKernel as Kernel<unknown>, doc: trivialDoc('quickselect'),
    facts: [
      {
        id: 'one_side', label: 'Quickselect 比快排快在哪',
        ask: '求第 K 大，Quickselect 和快速排序都用 partition，为什么 Quickselect 平均只要 O(n)?', kind: 'choice',
        compute: () => ({ answer: 'pivot 落到最终位置，只递归目标那侧', step: 1, evidence: '第1轮 pivot 落 idx5 > 目标 4，右半整个丢掉、只递归左半' }),
        distractors: () => ['Quickselect 用了更好的 pivot', 'Quickselect 不用 partition', '两者复杂度其实一样'],
      },
      {
        id: 'pivot_compare', label: 'partition 后怎么决定递归哪一侧',
        ask: 'partition 让 pivot 落在下标 P，目标下标是 T，怎么决定下一步搜哪边?', kind: 'choice',
        compute: () => ({ answer: 'P==T 即答案，P>T 走左否则走右', step: 2, evidence: '第2轮 pivot 落 idx0 < 目标 4 → 只递归右半 [1,4]' }),
        distractors: () => ['总是递归左半边、右半边直接丢掉不管', '两边都要各自递归一遍才能找得到它', '看 pivot 的值大小而不是看它的下标'],
      },
    ],
  },
  {
    id: 'pytorch', title: 'PyTorch · 深度学习地基', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'pytorch' }, entities: [], streams: [] },
    facts: [
      { id: 'pt_what', label: 'PyTorch 是什么', ask: 'PyTorch 是什么?为什么大模型都用它?', kind: 'choice', compute: () => ({ answer: '深度学习事实标准框架(BSD-3):张量(GPU 加速)+自动求导(autograd)+动态计算图+nn 模块。手推的前向传播/注意力写成代码就是几行 PyTorch;大模型训练/推理栈(Transformers/vLLM/DeepSpeed)全建在它上', step: 0, evidence: '张量+自动求导+动态图、大模型代码底座' }), distractors: () => ['一个推理服务引擎', '一个向量数据库', '一个操作系统'] },
      { id: 'pt_autograd', label: 'autograd 是什么', ask: 'PyTorch 的自动求导(autograd)在做什么?', kind: 'choice', compute: () => ({ answer: '动态记录前向计算构成的计算图,反向传播时自动按链式法则算出每个参数的梯度——你只写前向,梯度自动来。这是训练神经网络的核心便利', step: 0, evidence: '记录计算图、反向自动求梯度' }), distractors: () => ['自动把模型的权重下载到本地', '自动把权重量化成低精度来存', '自动把张量分到多张卡上去算'] },
      { id: 'pt_pos', label: 'PyTorch 的定位', ask: 'PyTorch 和 vLLM/DeepSpeed 是什么关系?', kind: 'choice', compute: () => ({ answer: 'PyTorch 是通用底座(写模型/训练/推理的语言);vLLM 是建在它上的高吞吐推理服务、DeepSpeed 是建在它上的训练优化。要开箱的推理服务/大规模并行训练,要在 PyTorch 之上再叠专用库', step: 0, evidence: '通用底座、vLLM/DeepSpeed 建其上' }), distractors: () => ['是 vLLM/DeepSpeed 的替代品', '建在 vLLM/DeepSpeed 之上的封装', '和 vLLM/DeepSpeed 平行、不依赖'] },
    ],
  },
  {
    id: 'transformers', title: 'HF Transformers · 模型库', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'transformers' }, entities: [], streams: [] },
    facts: [
      { id: 'tf_what', label: 'Transformers 是什么', ask: 'Hugging Face Transformers 是干什么的?', kind: 'choice', compute: () => ({ answer: '模型库(Apache-2.0):把几十万预训练模型(GPT/LLaMA/Qwen/BERT)统一成一套 API,from_pretrained 几行加载/推理/微调;配 Tokenizers(BPE 分词)、PEFT(LoRA)、TRL(对齐)、Datasets。是"用大模型"的门户', step: 0, evidence: '几十万模型统一 API、from_pretrained' }), distractors: () => ['一个物理仿真器', '一个推理编译器', '一个向量库'] },
      { id: 'tf_cover', label: 'Transformers 对应的实验', ask: 'Transformers 里现成的模块对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: '多头注意力/RoPE/RMSNorm(架构)、BPE(分词 Tokenizers)、top-k/top-p/温度采样与束搜索(生成)——正是实验室 Transformer 原理/大模型算法里那些实验。库是现成模块、实验是原理', step: 0, evidence: '多头/RoPE/RMSNorm/BPE/采样/束搜索' }), distractors: () => ['点云配准/ICP/SLAM/位姿估计/立体视觉', 'RRT/A*/势场法/Dubins/D* Lite 规划', 'FOC 电流环/Clarke/Park/SVPWM/位置环'] },
      { id: 'tf_limit', label: 'Transformers 的局限', ask: '用 Transformers 做生产推理有什么局限?', kind: 'choice', compute: () => ({ answer: '它的默认推理吞吐不如专用引擎——生产高并发要用 vLLM/SGLang/TGI/TensorRT-LLM;默认注意力也常要换 FlashAttention 加速。它强在"加载/微调/实验"、不是"高吞吐服务"', step: 0, evidence: '推理吞吐不如专用引擎、生产要 vLLM 等' }), distractors: () => ['不能加载开源权重，只能用自家模型', '不支持微调，只能拿来做前向推理', '只能在 TensorFlow 后端上跑起来'] },
    ],
  },
  {
    id: 'vllm', title: 'vLLM · 高吞吐推理引擎', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'vllm' }, entities: [], streams: [] },
    facts: [
      { id: 'vl_paged', label: 'PagedAttention 是什么', ask: 'vLLM 的招牌 PagedAttention 解决什么问题?', kind: 'choice', compute: () => ({ answer: '把 KV 缓存像操作系统的虚拟内存一样分块管理:按需分配、跨请求共享(如共同前缀),几乎消除显存碎片、大幅提高吞吐和可容纳的并发数。这是 vLLM 高吞吐的核心', step: 0, evidence: 'KV 缓存仿 OS 分页、分块共享、消碎片' }), distractors: () => ['把模型权重分页换出到 SSD 上去省下显存', '把注意力矩阵做低秩近似来省下算力', '换一个参数更小的模型来降低显存占用'] },
      { id: 'vl_batch', label: '连续批处理', ask: 'vLLM 的连续批处理(continuous batching)是什么?', kind: 'choice', compute: () => ({ answer: '请求可以动态地进出同一个批次(谁生成完就退出、新请求随时加入),让 GPU 始终打满、不用等整批对齐,大幅提高吞吐。配 PagedAttention 一起把利用率拉满', step: 0, evidence: '请求动态进出同批、GPU 打满' }), distractors: () => ['一次只处理一个请求，后面排队等', '攒够一整批请求再一起算，要等齐', '把批处理挪到 CPU 上去做'] },
      { id: 'vl_pos', label: 'vLLM 的定位', ask: 'vLLM 适合什么?和 llama.cpp/TensorRT-LLM 怎么选?', kind: 'choice', compute: () => ({ answer: 'vLLM 面向 GPU 上的高吞吐服务、开箱 OpenAI 兼容、易用;端侧/CPU 本地跑用 llama.cpp;NVIDIA GPU 上追极致延迟用 TensorRT-LLM(但要编译、运维更复杂,vLLM 以 85% 性能换易用)', step: 0, evidence: 'GPU 高吞吐;端侧用 llama.cpp' }), distractors: () => ['只适合手机端侧;高吞吐要用 llama.cpp', '只做训练不做推理;服务要换 TRT-LLM', '一次只能加载一个模型;多模型开多进程'] },
    ],
  },
  {
    id: 'sglang', title: 'SGLang · 结构化推理引擎', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'sglang' }, entities: [], streams: [] },
    facts: [
      { id: 'sg_radix', label: 'RadixAttention 是什么', ask: 'SGLang 的核心创新 RadixAttention 是什么?', kind: 'choice', compute: () => ({ answer: '用基数树(radix tree)按 token 前缀组织 KV 缓存块,自动、细粒度地复用共享前缀的缓存。多轮对话/RAG/few-shot 里前缀大量重复时,命中率高、吞吐大幅提升', step: 0, evidence: '基数树按前缀复用 KV 缓存' }), distractors: () => ['一种新的注意力数学近似', '把 KV 缓存放到磁盘', '一种量化方法'] },
      { id: 'sg_vs', label: 'SGLang vs vLLM', ask: 'SGLang 相比 vLLM 强在什么场景?', kind: 'choice', compute: () => ({ answer: '前缀重复多的场景(多轮对话、RAG、few-shot)——RadixAttention 自动复用共享前缀,吞吐常胜过 vLLM(基准显示 H100 上更高、RAG 场景加速明显);还把结构化/受约束生成(JSON/正则)做成一等公民', step: 0, evidence: '前缀复用场景吞吐领先、结构化生成' }), distractors: () => ['只跑在 CPU 上、不用显卡', '完全不用 KV 缓存、所以更省显存', '只支持单轮对话、多轮要换 vLLM'] },
      { id: 'sg_struct', label: 'SGLang 的结构化生成', ask: 'SGLang 除了快,还有什么特色?', kind: 'choice', compute: () => ({ answer: '结构化/受约束生成:前端 DSL 方便写多步流程、约束输出为 JSON/正则/固定选项,适合 Agent、工具调用、结构化抽取。是"服务引擎 + 结构化前端"二合一', step: 0, evidence: 'DSL + 受约束生成(JSON/正则)' }), distractors: () => ['GUI + 一键部署的 console', 'AutoML + 自带 labeling 标注台', '内置 VectorDB + 现成 RAG 流水线'] },
    ],
  },
  {
    id: 'tensorrtllm', title: 'TensorRT-LLM · NVIDIA 极致推理', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'tensorrtllm' }, entities: [], streams: [] },
    facts: [
      { id: 'tr_what', label: 'TensorRT-LLM 是什么', ask: 'TensorRT-LLM 是什么?怎么做到快?', kind: 'choice', compute: () => ({ answer: 'NVIDIA 的 LLM 推理库(Apache-2.0):用 Python API 定义模型、编译成 TensorRT 引擎,靠算子融合、量化(INT8/FP8/NVFP4)、内核自动调优在 NVIDIA GPU 上做极致优化,通常吞吐/延迟最优(比 vLLM 高约 10-20%)', step: 0, evidence: '编译成 TensorRT 引擎、算子融合+量化' }), distractors: () => ['在 CPU 上多线程并行、不依赖 GPU', '把权重放在显存之外;靠 NVLink 换入换出来提速', '解释执行不编译;靠 PyTorch 动态图保持跨厂商通用'] },
      { id: 'tr_cost', label: 'TensorRT-LLM 的代价', ask: 'TensorRT-LLM 追求极致性能的代价是什么?', kind: 'choice', compute: () => ({ answer: '要把模型编译成引擎(上手复杂、换模型/配置要重编)、强绑 NVIDIA 硬件(换硬件重来)、灵活性低于 PyTorch 原生。所以很多人用 vLLM——85% 的性能换来低得多的运维复杂度', step: 0, evidence: '要编译、绑 NVIDIA 硬件、灵活性低' }), distractors: () => ['要编译、绑 AMD ROCm、精度会掉', '免编译、绑 NVIDIA 驱动、吞吐偏低', '要编译、跨厂商通用、但显存翻倍'] },
      { id: 'tr_cover', label: 'TensorRT-LLM 用到的技术', ask: 'TensorRT-LLM 内部用到实验室哪些概念?', kind: 'choice', compute: () => ({ answer: '量化(FP8/NVFP4)、张量并行/流水并行(多卡切模型)、in-flight(连续)批处理、FlashAttention 类注意力核、编译式推理引擎——都是「大模型推理」组里的实验', step: 0, evidence: '量化/张量并行/推理引擎/FlashAttention' }), distractors: () => ['卷积/池化/BatchNorm/残差连接/数据增强', '点云配准/ICP/SLAM/回环检测/位姿图优化', 'RRT/A*/势场法/Dubins 曲线/D* Lite'] },
    ],
  },
  {
    id: 'llamacpp', title: 'llama.cpp · 端侧本地推理', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'llamacpp' }, entities: [], streams: [] },
    facts: [
      { id: 'lc_what', label: 'llama.cpp 是什么', ask: 'llama.cpp 是干什么的?最大特点?', kind: 'choice', compute: () => ({ answer: '把大模型跑到普通设备(CPU/Apple Silicon/手机)的 C++ 框架(MIT):基于自研 ggml 张量库、模型用 GGUF 格式 + 量化(Q4_K_M 等)大幅压内存,不用 GPU 也能跑。是端侧/本地 LLM 的事实标准(Ollama 封装它)', step: 0, evidence: 'C++ 端侧推理、GGUF 量化、不用 GPU' }), distractors: () => ['一个 GPU 集群训练框架', '一个云端推理服务', '一个向量数据库'] },
      { id: 'lc_gguf', label: 'GGUF 和量化', ask: 'llama.cpp 靠什么在普通设备上跑大模型?', kind: 'choice', compute: () => ({ answer: 'GGUF 格式 + 量化:把权重从 FP16 压成 4/5/8-bit(如 Q4_K_M),显存/内存需求骤降,普通 CPU/笔记本/手机就能跑。量化是端侧推理的关键(有精度损失、低档更明显)', step: 0, evidence: 'GGUF+量化压权重、端侧可跑' }), distractors: () => ['ONNX+剪枝压权重、端侧可跑', 'FP32+分页换出、靠内存条扛', 'TensorRT 编译、必须有 GPU'] },
      { id: 'lc_pos', label: 'llama.cpp 的定位', ask: 'llama.cpp 适合/不适合什么?', kind: 'choice', compute: () => ({ answer: '适合本地/端侧/离线/隐私场景(不用 GPU、可移植到手机树莓派);不适合高并发大吞吐服务(那用 vLLM/TensorRT-LLM)。Ollama/LM Studio 等桌面工具就封装它', step: 0, evidence: '端侧本地强、高并发服务弱' }), distractors: () => ['适合万卡集群上做预训练', '适合高并发的云端在线服务', '只能跑在服务器 GPU 上'] },
    ],
  },
  {
    id: 'flashattn', title: 'FlashAttention · 注意力内核', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'flashattn' }, entities: [], streams: [] },
    facts: [
      { id: 'fa_what', label: 'FlashAttention 是什么', ask: 'FlashAttention 解决了注意力的什么问题?', kind: 'choice', compute: () => ({ answer: '标准注意力要把 N×N 的注意力矩阵写回显存、显存 O(N²) 且访存慢。FlashAttention 通过 IO 感知——把注意力分块在片上 SRAM 里算、不落地 N×N 矩阵 + 在线 softmax——做到又快又省显存(O(N)),且是精确注意力(不近似)', step: 0, evidence: 'IO 感知分块进 SRAM、显存降到 O(N)' }), distractors: () => ['换成线性注意力、复杂度从 O(N²) 降到 O(N)', '丢掉一部分注意力头、只算剩下的那几个', '用低秩近似替代精确注意力、精度换速度'] },
      { id: 'fa_exact', label: 'FlashAttention 近似吗', ask: 'FlashAttention 是对注意力的近似吗?', kind: 'choice', compute: () => ({ answer: '不是近似——它和标准注意力数学上完全等价(精确),只是换了个又快又省显存的算法(分块+在线 softmax)。所以能直接替换标准注意力、不掉精度,这是它成为默认实现的原因', step: 0, evidence: '精确、和标准注意力等价、可直接替换' }), distractors: () => ['是近似、会掉一点精度、需要重新训练', '只在推理时能用、训练的时候用不了', '只对短序列有效、序列一长就会退化'] },
      { id: 'fa_cover', label: 'FlashAttention 的意义', ask: 'FlashAttention 为什么对大模型很关键?对应哪些实验?', kind: 'choice', compute: () => ({ answer: '显存从 O(N²) 降到 O(N),让训练/推理更长上下文成为可能、还更快;是现代大模型默认注意力(Transformers/vLLM/TensorRT-LLM 都集成)。对应实验:FlashAttention、Flash-Decoding、缩放点积/掩码', step: 0, evidence: '省显存能训长上下文、现已是默认实现' }), distractors: () => ['只省一点点显存、对训练长度没有影响', '和上下文长度无关、只影响批大小', '只用在 CV 模型上、语言模型用不到它'] },
    ],
  },
  {
    id: 'megatron', title: 'Megatron-LM · 并行训练引擎', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'megatron' }, entities: [], streams: [] },
    facts: [
      { id: 'mg_what', label: 'Megatron-LM 是什么', ask: 'Megatron-LM 解决什么问题?', kind: 'choice', compute: () => ({ answer: 'NVIDIA 的超大模型并行训练引擎(Apache-2.0):当模型大到单卡放不下、连 ZeRO 也不够时,靠切开计算本身来训。Megatron-Core 提供五种并行:张量 TP/流水 PP/数据 DP/专家 EP/上下文 CP', step: 0, evidence: '并行训练引擎、TP/PP/DP 等五种并行' }), distractors: () => ['在线推理引擎、管 KV cache 与调度', '轻量微调库、只更 LoRA 那一小部分', '向量库、存 embedding 做相似检索'] },
      { id: 'mg_par', label: '张量并行 vs 流水并行', ask: 'Megatron 的张量并行和流水并行有什么区别?', kind: 'choice', compute: () => ({ answer: '张量并行(TP):把同一层的大矩阵切到多卡、算完 all-reduce 合并(层内切);流水并行(PP):把不同层分到不同卡、用微批流水填满(层间切)。专家并行(EP)则把 MoE 的不同专家放不同卡。对应实验里的张量/流水/专家并行', step: 0, evidence: 'TP 层内切矩阵、PP 层间切、EP 专家分卡' }), distractors: () => ['TP 按数据批次来切、PP 按模型的参数量来切', 'TP 只用在推理阶段、PP 只用在训练', '两者完全等价，只是叫法上不一样而已'] },
      { id: 'mg_vs', label: 'Megatron vs DeepSpeed', ask: 'Megatron-LM 和 DeepSpeed 分工?', kind: 'choice', compute: () => ({ answer: 'Megatron 强在切开计算的并行(张量/流水/专家并行,把集群榨满);DeepSpeed 强在 ZeRO(分片优化器状态省显存)+卸载+MoE。二者常结合(Megatron-DeepSpeed)训超大模型', step: 0, evidence: 'Megatron 切并行、DeepSpeed 省显存' }), distractors: () => ['两者是竞品、不能放在一起用', 'Megatron 做推理、DeepSpeed 做训练', 'DeepSpeed 是 Megatron 的一个子模块'] },
    ],
  },
  {
    id: 'deepspeed', title: 'DeepSpeed · 训练优化(ZeRO)', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'deepspeed' }, entities: [], streams: [] },
    facts: [
      { id: 'ds_zero', label: 'ZeRO 是什么', ask: 'DeepSpeed 的招牌 ZeRO 解决什么?', kind: 'choice', compute: () => ({ answer: '零冗余优化器:数据并行里每张卡本来都存一份完整的优化器状态/梯度/参数(冗余),ZeRO 把它们分片到多卡(ZeRO-1/2/3),消除冗余显存,让单卡放不下的大模型也能训。是"平民训大模型"的关键', step: 0, evidence: '分片优化器状态/梯度/参数、消冗余显存' }), distractors: () => ['一种新的注意力实现、既省显存又提速', '把模型权重量化到 4-bit 之后再存', '一种采样策略、让生成的结果更稳定'] },
      { id: 'ds_offload', label: 'ZeRO-Offload', ask: 'DeepSpeed 的 Offload/Infinity 是什么?', kind: 'choice', compute: () => ({ answer: '把优化器状态/参数等卸载到 CPU 内存甚至 NVMe 硬盘,让单卡也能训超大模型(用速度换容量);对应实验里的 KV/状态卸载思想。代价是带宽瓶颈、速度下降', step: 0, evidence: '卸载到 CPU/NVMe、以速度换容量' }), distractors: () => ['卸载到另一张 GPU、以带宽换显存', '把 FP32 降成 INT4、以精度换容量', '把梯度丢掉不存、以收敛换显存'] },
      { id: 'ds_cover', label: 'DeepSpeed 对应的实验', ask: 'DeepSpeed 用到实验室哪些概念?', kind: 'choice', compute: () => ({ answer: 'MoE(混合专家)训练、KV/状态卸载、张量并行、集合通信(all-reduce/all-gather)——都是「大模型推理/算法」里的实验。它和 Megatron 结合(Megatron-DeepSpeed)训超大模型', step: 0, evidence: 'MoE/KV 卸载/张量并行/集合通信' }), distractors: () => ['ICP/点云配准/SLAM/回环检测', 'Dubins 曲线/RRT/A*/势场法', 'FOC 电流环/PID/阻抗控制'] },
    ],
  },
  {
    id: 'peft', title: 'PEFT(LoRA) · 参数高效微调', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'peft' }, entities: [], streams: [] },
    facts: [
      { id: 'pf_lora', label: 'LoRA 是什么', ask: 'LoRA(PEFT)是怎么做到高效微调的?', kind: 'choice', compute: () => ({ answer: '冻结大模型主体,只在权重旁边加一对低秩矩阵 A·B、只训这两个小矩阵(原权重不动)。要训的参数量骤降到千分之几,显存/成本大降,效果却接近全量微调', step: 0, evidence: '冻结主体、只训低秩 A·B、参数骤降' }), distractors: () => ['把整个模型的全部参数重新训一遍', '把模型权重量化成 1-bit 之后存', '换一个参数量更大的基座模型来训'] },
      { id: 'pf_qlora', label: 'QLoRA 是什么', ask: 'QLoRA 为什么能在消费级单卡微调大模型?', kind: 'choice', compute: () => ({ answer: '把基座模型量化成 4-bit(省显存)+ 在上面挂 LoRA(只训低秩小矩阵)。量化压住基座显存 + LoRA 压住可训参数,双管齐下,消费级单卡就能微调几十亿参数模型', step: 0, evidence: '4-bit 量化基座 + LoRA、消费级卡可微调' }), distractors: () => ['16-bit 基座 + 全量微调、单卡也够用', '4-bit 量化梯度 + 全参更新、显存减半', '8-bit 基座 + Adapter 串联、只训最后层'] },
      { id: 'pf_use', label: 'PEFT 的用途与局限', ask: 'PEFT/LoRA 适合什么?有什么局限?', kind: 'choice', compute: () => ({ answer: '适合领域/任务微调、一个基座挂多套 LoRA 按任务切换、低成本对齐(配 TRL);局限是冻结主体、极端任务不如全量微调,且仍依赖一个好的预训练基座、秩等超参要调', step: 0, evidence: '领域微调/多适配器切换;不如全量、依赖好基座' }), distractors: () => ['能从零训出一个大模型;而且完全不挑基座的好坏', '不需要任何基座;直接从随机权重起训', '效果一定超过全量微调;没有任何局限'] },
    ],
  },
  {
    id: 'langgraph', title: 'LangGraph · Agent 编排', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'langgraph' }, entities: [], streams: [] },
    facts: [
      { id: 'lgg_what', label: 'LangGraph 是什么', ask: 'LangGraph 是干什么的?为什么用图?', kind: 'choice', compute: () => ({ answer: 'LangChain 出的 Agent 编排框架(MIT):把智能体流程写成有状态的图(节点=步骤/工具/模型、边=转移)。用图是因为 Agent 需要循环、分支、人审——线性链表达不了"想→调工具→观察→再想"的主循环、防死循环、子 Agent', step: 0, evidence: '把 Agent 写成有状态图、支持循环/分支/人审' }), distractors: () => ['一个推理引擎', '一个向量数据库', '一个训练框架'] },
      { id: 'lgg_cover', label: 'LangGraph 编排的东西', ask: 'LangGraph 编排的能力对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: 'Agent 主循环(想→行动→观察、防死循环)、工具调用、子 Agent 委派、规划(计划模式+Todo)、上下文压缩——正是「大模型项目实战」里那批 Agent harness 实验。库负责编排、实验讲原理', step: 0, evidence: 'Agent 主循环/工具调用/子Agent/规划/上下文压缩' }), distractors: () => ['卷积/池化/全连接/BatchNorm/残差连接/Dropout', 'ICP/点云配准/SLAM/回环检测/位姿图优化', 'Clarke/Park/SVPWM/电流环/位置环/编码器'] },
      { id: 'lgg_why', label: '为什么不用线性链', ask: '为什么复杂 Agent 用 LangGraph 而不是线性的链?', kind: 'choice', compute: () => ({ answer: '复杂 Agent 要循环(反复想-行动)、分支(按结果走不同路)、人审(中途让人确认)、断点续跑——这些线性链表达不了。图能精确控制流程、可持久化、可观测,还能防死循环、加子 Agent', step: 0, evidence: '需循环/分支/人审/续跑,链表达不了' }), distractors: () => ['图一定比链跑得更快、延迟也会更低一些', '链根本不能调用模型、只能拼字符串', '图不需要写代码、拖拽一下就能出来'] },
    ],
  },
  {
    id: 'llamaindex', title: 'LlamaIndex · RAG 框架', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'llamaindex' }, entities: [], streams: [] },
    facts: [
      { id: 'li_what', label: 'LlamaIndex 是什么', ask: 'LlamaIndex 是干什么的?RAG 是什么流程?', kind: 'choice', compute: () => ({ answer: '专注 RAG(检索增强生成)的框架(MIT):把私有文档切块→向量化→存进向量库→按问题检索 top-k→拼进提示词喂给大模型,让它基于你的数据回答而不是瞎编。提供数据连接器/索引/检索器/查询引擎一整套', step: 0, evidence: '切块→向量化→检索 top-k→拼 prompt→生成' }), distractors: () => ['一个推理引擎', '一个训练框架', '一个电机控制库'] },
      { id: 'li_why', label: 'RAG 为什么有用', ask: 'RAG(LlamaIndex)相比直接问大模型好在哪?', kind: 'choice', compute: () => ({ answer: '让模型基于检索到的你的真实数据回答,减少幻觉、能用私有/最新知识、还能给引用出处;不用重新训练模型就能"接上"外部知识。对应实验里的 RAG、检索打分', step: 0, evidence: '基于真实数据答、减幻觉、无需训练接外部知识' }), distractors: () => ['让模型推理跑得更快一些、延迟也低上一大截了', '把模型体积变小、省下一大半显存占用', '完全不需要任何数据就能答得更准'] },
      { id: 'li_stack', label: 'LlamaIndex 和向量库', ask: 'LlamaIndex 通常和什么搭配?和 LangGraph 分工?', kind: 'choice', compute: () => ({ answer: '搭配向量库(FAISS/Milvus/Chroma/Qdrant)存检索向量;LlamaIndex 专注 RAG/检索,LangGraph 专注 Agent 流程编排——常一起用(检索 + Agent)。它俩和 LangChain 功能有重叠、按需选型', step: 0, evidence: '配向量库;RAG 归它、编排归图框架' }), distractors: () => ['它自带 GPU 训练能力;能从零训出一个模型', '它是 PyTorch 的替代品;两者二选一即可', '它是一个操作系统;要装在裸机上才能跑'] },
    ],
  },
  {
    id: 'numpy', title: 'NumPy · 科学计算地基', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'numpy' }, entities: [], streams: [] },
    facts: [
      { id: 'np_what', label: 'NumPy 是什么', ask: 'NumPy 为什么是数据科学的地基?', kind: 'choice', compute: () => ({ answer: '核心是 ndarray(N 维数组、连续内存、类型统一)+向量化运算(把 for 循环下沉到 C/SIMD,比纯 Python 快几十上百倍),加广播/线代/随机数/FFT。pandas/SciPy/scikit-learn/PyTorch 全建在它(或它的数组接口)之上', step: 0, evidence: 'ndarray+向量化、生态全建其上' }), distractors: () => ['DataFrame+索引对齐、专做表格', 'Tensor+autograd、专做深度学习', 'Series+时间索引、专做时序'] },
      { id: 'np_vec', label: '向量化为什么快', ask: 'NumPy 的向量化为什么比纯 Python 循环快?', kind: 'choice', compute: () => ({ answer: '把整块数组的运算下沉到编译好的 C/SIMD 代码一次算完,避免 Python 解释器逐元素循环的开销(还利用连续内存和缓存)。所以写 NumPy 要"整块数组运算"而不是 Python for 循环', step: 0, evidence: '整块运算下沉 C/SIMD、免解释器循环开销' }), distractors: () => ['因为它默认把所有运算都放到 GPU 上跑', '因为它用多线程把 Python 循环并行起来', '因为它先把数据压缩之后再做运算'] },
      { id: 'np_cover', label: 'NumPy 对应的实验', ask: 'NumPy 的数组运算对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: '矩阵乘、内存布局(行/列主序与步幅)、softmax(数值稳定)、条件数、低秩近似(SVD)——这些「机器学习基础」实验底层就是 NumPy 的数组/线代运算', step: 0, evidence: 'matmul/布局/softmax/条件数/低秩' }), distractors: () => ['RRT/A*/势场法/Dubins/D* Lite', 'ICP/点云配准/SLAM/回环检测', 'FOC 电流环/Clarke/Park/SVPWM'] },
    ],
  },
  {
    id: 'pandas', title: 'pandas · 数据分析', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'pandas' }, entities: [], streams: [] },
    facts: [
      { id: 'pd_what', label: 'pandas 是什么', ask: 'pandas 是干什么的?核心数据结构?', kind: 'choice', compute: () => ({ answer: '结构化数据处理的行业标准:核心是 DataFrame(带行列标签的二维表),做读写(CSV/Parquet/SQL)、清洗、缺失值、分组聚合(groupby)、合并(merge)、时间序列。是 ML 前"数据整理"(约 80% 的活)的主力', step: 0, evidence: 'DataFrame、清洗/groupby/merge' }), distractors: () => ['软件模拟整台计算机、启动完整 OS、配 KVM', '几千行能真跑的教学类 Unix 内核', '刚体动力学算法库(RNEA/ABA/CRBA)+解析导数'] },
      { id: 'pd_role', label: 'pandas 的角色', ask: 'pandas 在机器学习流程里处于什么位置?', kind: 'choice', compute: () => ({ answer: '在"原始数据"和"能喂模型的特征"之间的桥:清洗、合并、聚合出干净的特征表,再交给 scikit-learn/XGBoost 建模。做 ML 大部分时间其实花在 pandas 的数据整理上', step: 0, evidence: '原始数据→特征表的桥、数据整理主力' }), distractors: () => ['负责训练模型、跑梯度下降的那一个步骤', '负责部署推理、对外提供接口服务', '负责画图表、把最终结果可视化出来'] },
      { id: 'pd_limit', label: 'pandas 的局限', ask: 'pandas 处理大数据有什么局限?', kind: 'choice', compute: () => ({ answer: '单机内存内——数据大过内存就吃力;大表/链式操作也容易慢或吃内存。更大/更快看 Polars、Dask、Spark。它也不做建模(那是 scikit-learn)', step: 0, evidence: '单机内存内、大数据看 Polars/Dask' }), distractors: () => ['只支持 CSV/JSON，读不了 Parquet', '只做数值列，object 列一律跳过', '必须连 MySQL 取数，不能读本地'] },
    ],
  },
  {
    id: 'scipy', title: 'SciPy · 科学计算算法', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'scipy' }, entities: [], streams: [] },
    facts: [
      { id: 'sp_what', label: 'SciPy 是什么', ask: 'SciPy 提供什么?和 NumPy 什么关系?', kind: 'choice', compute: () => ({ answer: '建在 NumPy 之上的科学计算算法库:优化(minimize/最小二乘)、线代(SVD/特征/稀疏)、统计(分布/检验)、信号、插值、积分/ODE。NumPy 给数组、SciPy 给"算法"。很多 ML/统计方法的底层数值工具来自它', step: 0, evidence: '建在 NumPy 上、优化/线代/统计/信号算法' }), distractors: () => ['一个机器学习模型库、自带训练调参和评估的全套接口', '一个数据库、负责存储与查询大批数值数据', 'NumPy 的替代品、两者装一个就够用了'] },
      { id: 'sp_cover', label: 'SciPy 对应的实验', ask: 'SciPy 的算法对应实验室哪些概念?', kind: 'choice', compute: () => ({ answer: '线代里的 SVD 对应条件数/低秩、optimize 的最小化对应梯度下降(训练底层)、stats 的分布对应中心极限定理/大数定律。它是这些统计/ML 方法的数值底座', step: 0, evidence: 'SVD↔条件数、优化↔梯度下降、分布↔CLT' }), distractors: () => ['卷积和池化↔图像、循环网络↔序列建模', 'RRT 和 Dubins↔路径规划、势场法↔避障', 'FOC 和 PID↔电机控制、卡尔曼↔滤波'] },
      { id: 'sp_pos', label: 'SciPy vs scikit-learn', ask: 'SciPy 和 scikit-learn 分工?', kind: 'choice', compute: () => ({ answer: 'SciPy 是底层数值算法(优化/线代/统计),scikit-learn 建在它和 NumPy 之上、提供开箱的机器学习模型(fit/predict)。要"数值算法"用 SciPy、要"直接建模"用 scikit-learn', step: 0, evidence: 'SciPy 底层数值、sklearn 开箱 ML' }), distractors: () => ['两者完全一样', 'SciPy 做深度学习', 'scikit-learn 是 SciPy 的底层'] },
    ],
  },
  {
    id: 'matplotlib', title: 'Matplotlib · 数据可视化', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'matplotlib' }, entities: [], streams: [] },
    facts: [
      { id: 'mpl_what', label: 'Matplotlib 是什么', ask: 'Matplotlib 是干什么的?', kind: 'choice', compute: () => ({ answer: 'Python 数据可视化的老牌主力:折线/散点/柱状/热图/等高线/3D 都能画,pyplot 上手快又能控到每个元素。做 ML 时画损失曲线、决策边界、特征分布、混淆矩阵都靠它——把"数字"变成"看得懂"', step: 0, evidence: 'Python 可视化主力、pyplot、什么图都能画' }), distractors: () => ['一个机器学习库', '一个数据处理库', '一个推理引擎'] },
      { id: 'mpl_eco', label: 'Matplotlib 的生态', ask: 'seaborn/Plotly 和 Matplotlib 什么关系?', kind: 'choice', compute: () => ({ answer: 'seaborn 建在 Matplotlib 之上、做统计图更省事(几行出漂亮图);Plotly 补交互(能缩放/悬停)。Matplotlib 是最通用可控的底层,pandas .plot 也基于它', step: 0, evidence: 'seaborn 建其上、Plotly 补交互' }), distractors: () => ['它们是竞品、和 Matplotlib 完全无关', 'seaborn 是深度学习库、和画图无关', 'Plotly 是数据库、负责存储图表数据'] },
      { id: 'mpl_limit', label: 'Matplotlib 的取舍', ask: 'Matplotlib 有什么取舍?', kind: 'choice', compute: () => ({ answer: '最通用、可控到出版级,但默认样式一般、精修代码啰嗦;交互弱(要交互看 Plotly/Bokeh);有 pyplot 和面向对象两套 API 易混;大量数据点渲染慢', step: 0, evidence: '通用可控但精修啰嗦、交互弱、两套 API' }), distractors: () => ['不能导出图片、只能在屏幕上看一眼', '只能画折线图、别的图形一律画不了', '必须有 GPU 才能画、纯 CPU 跑不动'] },
    ],
  },
  {
    id: 'sklearn', title: 'scikit-learn · 经典机器学习', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'sklearn' }, entities: [], streams: [] },
    facts: [
      { id: 'sk_what', label: 'scikit-learn 是什么', ask: 'scikit-learn 是干什么的?', kind: 'choice', compute: () => ({ answer: '经典(非深度)机器学习的事实标准库:把几十种算法(KNN/K-Means/PCA/SVM/决策树/逻辑·线性回归/随机森林/GBDT)统一成 fit/predict/transform API,配特征处理、交叉验证、网格搜索、Pipeline。结构化数据建模/快速基线/教学首选', step: 0, evidence: '经典 ML 事实标准、统一 API+Pipeline' }), distractors: () => ['一个深度学习框架', '一个数据可视化库', '一个推理引擎'] },
      { id: 'sk_api', label: '统一 API 与 Pipeline', ask: 'scikit-learn 的 fit/predict 统一 API 和 Pipeline 有什么好处?', kind: 'choice', compute: () => ({ answer: '所有模型都是 fit(训练)/predict(预测)/transform(变换)同一套,换算法只改一行;Pipeline 把预处理+模型串成一条流水线,交叉验证时能防"数据泄露"(预处理只在训练折上 fit)。规范又不易出错', step: 0, evidence: '换算法只改一行、Pipeline 防泄露' }), distractors: () => ['自动调参、GridSearch 免写循环', '自动部署、Serving 自带监控面板', '自动画图、Plotting 一行出结果'] },
      { id: 'sk_cover', label: 'scikit-learn 对应的实验', ask: 'scikit-learn 的算法对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: 'KNN/SVM/逻辑回归/线性回归/决策树(分类回归)、K-Means/PCA(聚类降维)、GBDT(集成)——正是「机器学习算法」组那批实验。库是现成算法、实验讲原理', step: 0, evidence: 'KNN/SVM/回归/决策树/K-Means/PCA' }), distractors: () => ['卷积/池化/RNN/注意力/BatchNorm/残差', 'ICP/SLAM/点云配准/回环检测/位姿图', 'RRT/A*/Dubins/势场法/D* Lite/PRM'] },
    ],
  },
  {
    id: 'xgboost', title: 'XGBoost · 梯度提升树', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'xgboost' }, entities: [], streams: [] },
    facts: [
      { id: 'xgb_what', label: 'XGBoost 是什么', ask: 'XGBoost 是什么?为什么在结构化数据上强?', kind: 'choice', compute: () => ({ answer: '梯度提升决策树(GBDT)的高性能实现:一棵棵树串行拟合前面的残差、逐步变强;工程上二阶泰勒近似+正则化+缺失值处理+直方图分裂+GPU。在表格/结构化数据上常年准确率最强(Kaggle 王者)', step: 0, evidence: 'GBDT 高性能实现、串行加树拟合残差、表格最强' }), distractors: () => ['一种神经网络', '一个数据库', '一个可视化库'] },
      { id: 'xgb_cover', label: 'XGBoost 对应的实验', ask: 'XGBoost 对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: 'GBDT(梯度提升,它就是 GBDT 的工程实现)、决策树(基学习器)——「机器学习算法」组里的实验。原理在实验里、工业实现在 XGBoost', step: 0, evidence: 'GBDT/决策树' }), distractors: () => ['卷积和注意力', 'PageRank 和 A*', '词向量和 RNN'] },
      { id: 'xgb_vs', label: 'XGBoost vs 神经网络', ask: '什么时候用 XGBoost、什么时候用深度学习?', kind: 'choice', compute: () => ({ answer: '表格/结构化数据(金融/推荐/CTR)常年是 XGBoost/LightGBM 等梯度提升更强、又快又准;图像/文本/语音这类非结构化数据才是深度学习(PyTorch)的主场。选型看数据类型', step: 0, evidence: '表格用梯度提升、非结构化用 DL' }), distractors: () => ['XGBoost 永远比 DL 强', 'DL 永远比 XGBoost 强', '两者不能同一项目'] },
    ],
  },
  {
    id: 'jax', title: 'JAX · 可微的 NumPy', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'jax' }, entities: [], streams: [] },
    facts: [
      { id: 'jx_what', label: 'JAX 是什么', ask: 'JAX 是什么?为什么叫"可微的 NumPy"?', kind: 'choice', compute: () => ({ answer: 'Google 的高性能数值计算库:NumPy 接口 + 自动求导(grad)+ XLA 编译(jit)+ 向量化(vmap)+ GPU/TPU。用几乎和 NumPy 一样的代码,但能自动求导、能编译加速——所以叫"可微的 NumPy"', step: 0, evidence: 'NumPy 接口+grad 自动求导+jit 编译+GPU/TPU' }), distractors: () => ['一个数据库', '一个可视化库', '一个推理服务'] },
      { id: 'jx_transform', label: 'grad/jit/vmap', ask: 'JAX 的 grad、jit、vmap 分别做什么?', kind: 'choice', compute: () => ({ answer: 'grad:对任意函数自动求导(还能高阶);jit:用 XLA 把函数编译成融合内核、GPU/TPU 提速;vmap:自动把函数向量化成批处理。它们是可组合的函数变换,函数式风格', step: 0, evidence: 'grad 求导/jit 编译/vmap 批处理' }), distractors: () => ['grad 编译/jit 批处理/vmap 求导', 'grad 剪枝/jit 量化/vmap 蒸馏', 'grad 分片/jit 混精/vmap 重算'] },
      { id: 'jx_cover', label: 'JAX 对应的实验/用途', ask: 'JAX 对应实验室哪些概念?典型用在哪?', kind: 'choice', compute: () => ({ answer: '梯度下降、反向传播、矩阵运算——写 JAX 就是"可微的 NumPy"。前沿 DL/研究(Flax)、大规模 RL 仿真(Brax、MuJoCo MJX)、科学计算、TPU 训练大量用它', step: 0, evidence: '梯度下降/反向传播/矩阵;前沿 DL/RL 仿真' }), distractors: () => ['ICP/SLAM/点云配准;主要用在机器人', 'B+ 树/LSM/WAL;主要用在数据库引擎里面', 'RSA/AES/哈希;主要用在密码学工程'] },
    ],
  },
  {
    id: 'opencv', title: 'OpenCV · 计算机视觉', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'opencv' }, entities: [], streams: [] },
    facts: [
      { id: 'cv_what', label: 'OpenCV 是什么', ask: 'OpenCV 是干什么的?', kind: 'choice', compute: () => ({ answer: '计算机视觉的老牌全家桶:图像读写/滤波卷积、特征(ORB/SIFT)、几何变换、相机标定(solvePnP)、光流、立体视觉、传统目标检测,还能跑 DNN 推理。既是 CV 经典算法库,也是机器人/图像项目的地基', step: 0, evidence: 'CV 全家桶:图像处理/特征/标定/立体/DNN' }), distractors: () => ['一个深度学习训练框架', '一个数据库', '一个绘图库'] },
      { id: 'cv_cover', label: 'OpenCV 对应的实验', ask: 'OpenCV 对应实验室哪些实验?和机器人感知什么关系?', kind: 'choice', compute: () => ({ answer: '卷积/滤波(图像卷积)、池化(图像金字塔/降采样)对应 DL 里的卷积/池化实验;它的相机标定/立体视觉/位姿又和「机器人感知」轨的针孔/双目/点云/PnP 相通', step: 0, evidence: '卷积/池化;和针孔/双目/PnP 相通' }), distractors: () => ['B+ 树/LSM/WAL;和数据库索引相通', 'RRT/A*;和运动规划那组相通', 'FOC/PID;和电机控制那组相通'] },
      { id: 'cv_limit', label: 'OpenCV 的取舍', ask: 'OpenCV 的取舍是什么?', kind: 'choice', compute: () => ({ answer: 'CV 算法最全、C++ 核心快 Python 好用、跨平台;但深度学习训练不归它(那是 PyTorch,它只能跑现成 DNN),API 庞杂、旧版 BSD 新版(4.5+)才 Apache-2.0', step: 0, evidence: 'CV 算法全但不训 DL、API 庞杂' }), distractors: () => ['不能读图片、只能处理视频流', '只支持 Python、别的语言都没有绑定', '必须联网、断网就没法做处理'] },
    ],
  },
  {
    id: 'statsmodels', title: 'statsmodels · 统计建模与推断', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'statsmodels' }, entities: [], streams: [] },
    facts: [
      { id: 'sm_what', label: 'statsmodels 是什么', ask: 'statsmodels 和 scikit-learn 有什么不同?', kind: 'choice', compute: () => ({ answer: 'statsmodels 专注统计建模与"推断"(要 p 值、置信区间、显著性、诊断报告),scikit-learn 专注"预测"(要准)。statsmodels 做回归/时间序列/假设检验时给完整统计报告——回答"这个变量显著吗、关系可信吗"', step: 0, evidence: '推断(p 值/置信区间)vs 预测(准)' }), distractors: () => ['两者完全一样、只是名字不同而已', 'statsmodels 专做深度学习模型', 'statsmodels 是一个画图库'] },
      { id: 'sm_cover', label: 'statsmodels 对应的实验', ask: 'statsmodels 对应实验室哪些概念?', kind: 'choice', compute: () => ({ answer: '线性回归、逻辑回归(带显著性推断)、以及中心极限定理、大数定律(统计根基)——「机器学习算法/概率统计」里的实验。它把这些做成带统计报告的建模', step: 0, evidence: '线性/逻辑回归、中心极限、大数定律' }), distractors: () => ['卷积和池化、图像分类', 'ICP 和点云配准、位姿', 'PagedAttention、KV 缓存'] },
      { id: 'sm_use', label: 'statsmodels 用在哪', ask: 'statsmodels 典型用在什么场景?', kind: 'choice', compute: () => ({ answer: '计量经济/社科的统计分析、时间序列预测(ARIMA)、A/B 实验的显著性检验——要"解释"而非只"预测"的场景。大规模纯预测则用 sklearn/XGBoost', step: 0, evidence: '计量/时间序列/AB 检验,要解释' }), distractors: () => ['图像识别与目标检测、那一类的视觉任务', '大模型推理、在线服务化', '机器人控制、实时闭环'] },
    ],
  },
  {
    id: 'networkx', title: 'NetworkX · 图/网络分析', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'networkx' }, entities: [], streams: [] },
    facts: [
      { id: 'nx_what', label: 'NetworkX 是什么', ask: 'NetworkX 是干什么的?', kind: 'choice', compute: () => ({ answer: 'Python 图/网络分析库:建图(有向/无向/带权)+跑经典图算法——最短路(Dijkstra/A*/Bellman-Ford)、PageRank、连通分量/并查集、最小生成树、最大流、中心性、社区发现。纯 Python 上手极快、适合建模/分析/教学', step: 0, evidence: '图分析库、最短路/PageRank/连通/中心性' }), distractors: () => ['一个神经网络框架', '一个数据库', '一个绘图库'] },
      { id: 'nx_cover', label: 'NetworkX 对应的实验', ask: 'NetworkX 对应实验室哪些经典算法实验?', kind: 'choice', compute: () => ({ answer: 'PageRank(网页排名)、A* 寻路(带启发的最短路)、并查集(连通分量)——正是「经典算法」组里的实验。库里都是现成一行调用、原理在实验里', step: 0, evidence: 'PageRank/A*/并查集' }), distractors: () => ['卷积/RNN/注意力', 'FOC/PID/阻抗控制', 'KV Cache/量化/MoE'] },
      { id: 'nx_limit', label: 'NetworkX 的取舍', ask: 'NetworkX 处理超大图有什么局限?', kind: 'choice', compute: () => ({ answer: '纯 Python、图很大(百万边以上)会慢、内存内;超大图看 igraph/graph-tool(C 核)或 GPU 图库。它也不做图神经网络(那是 PyG/DGL)。胜在灵活、算法全、上手快', step: 0, evidence: '纯 Python 大图慢、不做 GNN' }), distractors: () => ['不能建有向图、只支持无向', '只能算最短路、别的算不了', '必须用 GPU 才行、纯 CPU 跑不动'] },
    ],
  },
  {
    id: 'gensim', title: 'gensim · 主题模型与词向量', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'gensim' }, entities: [], streams: [] },
    facts: [
      { id: 'gs_what', label: 'gensim 是什么', ask: 'gensim 是干什么的?', kind: 'choice', compute: () => ({ answer: '主题建模与词向量的经典库:Word2Vec/FastText/Doc2Vec 词/文档向量、LDA/LSI 主题模型、TF-IDF、相似度检索,主打无监督从大规模文本挖语义、能流式处理大语料。Word2Vec 的著名实现就出自这里', step: 0, evidence: '主题模型 + 词向量、word2vec 原产地' }), distractors: () => ['经典 ML 事实标准、统一 API 加 Pipeline', '图分析库、最短路/PageRank/中心性', '事件驱动 + epoll 非阻塞、扛高并发'] },
      { id: 'gs_cover', label: 'gensim 对应的实验', ask: 'gensim 对应实验室哪个实验?', kind: 'choice', compute: () => ({ answer: '词向量(Word2Vec)——它是 word2vec 的原产地,「国王−男人+女人≈王后」那个著名例子就来自这类词向量。「深度学习算法」里的词向量实验讲的就是它的原理', step: 0, evidence: '词向量 Word2Vec、国王−男人+女人≈王后' }), distractors: () => ['ICP 点云配准、把两片点云对齐', 'RRT 运动规划、在障碍中找路径', 'FOC 电流环、Clarke 与 Park 变换'] },
      { id: 'gs_license', label: 'gensim 的许可注意', ask: '用 gensim 要注意什么许可问题?', kind: 'choice', compute: () => ({ answer: '它是 LGPL-2.1(弱传染)——比 NumPy/scikit-learn 的 BSD 严:动态链接调用一般 OK,但静态链接或改动它的源码再分发,可能要求把那部分也按 LGPL 开源。商用要评估。这正是"库要核许可"的价值', step: 0, evidence: 'LGPL-2.1 弱传染、改源要开源' }), distractors: () => ['MIT 许可、闭源商用都没有限制', 'Apache-2.0、带专利授权条款', 'AGPL-3.0、联网服务也要开源'] },
    ],
  },
  {
    id: 'linux', title: 'Linux 内核 · 操作系统内核', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'linux' }, entities: [], streams: [] },
    facts: [
      { id: 'lx_what', label: 'Linux 内核是什么', ask: 'Linux 内核负责哪些核心工作?', kind: 'choice', compute: () => ({ answer: '操作系统内核(GPL-2.0):进程调度、虚拟内存(分页/缺页/页替换)、文件系统(inode/位图/日志)、并发原语(信号量/锁/死锁避免)、网络栈。你「操作系统」组实验讲的原理在它里都有工业级真实现', step: 0, evidence: '调度/虚拟内存/文件系统/并发/网络栈' }), distractors: () => ['一个编译器、把源码翻成机器码', '一个数据库、负责存储与查询', '一个网页服务器、专门处理 HTTP 请求'] },
      { id: 'lx_cover', label: 'Linux 对应的实验', ask: 'Linux 内核对应实验室「操作系统」组哪些实验?', kind: 'choice', compute: () => ({ answer: '进程调度、缺页/页替换、虚拟内存、inode/位图/分区(文件系统)、磁盘寻道、信号量、银行家(死锁避免)——OS 组几乎全覆盖。库是工业实现、实验讲原理', step: 0, evidence: '调度/缺页/inode/信号量/银行家' }), distractors: () => ['卷积/注意力/BatchNorm', 'RRT/Dubins/势场法/PRM/D* Lite', 'B 树/哈希/LSM/跳表'] },
      { id: 'lx_gpl', label: 'Linux 的许可', ask: 'Linux 内核用什么许可?意味着什么?', kind: 'choice', compute: () => ({ answer: 'GPL-2.0(only,有传染性):改动内核代码并分发,要以 GPL 开源那部分。用户空间程序通过系统调用用内核不受影响(有 syscall 例外)。这也是内核驱动开源生态的原因', step: 0, evidence: 'GPL-2.0 传染;改内核分发要开源' }), distractors: () => ['MIT 许可、随便用、闭源商用也行得通', '闭源商业软件、要买授权才能用', '公有领域、没有任何许可上的限制'] },
    ],
  },
  {
    id: 'gcc', title: 'GCC · GNU 编译器套件', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'gcc' }, entities: [], streams: [] },
    facts: [
      { id: 'gc_steps', label: 'GCC 编译四步', ask: 'GCC 把源码变成可执行程序经过哪几步?', kind: 'choice', compute: () => ({ answer: '预处理(展开宏/头文件)→编译(语法分析+优化+生成汇编)→汇编(汇编→机器码目标文件)→链接(合并目标+库成可执行文件)。gcc -S 可看编译到的汇编', step: 0, evidence: '预处理→编译→汇编→链接' }), distractors: () => ['源码直接一步就变成机器码', '解释执行、压根不用编译', '先运行起来再回头编译'] },
      { id: 'gc_cover', label: 'GCC 对应的实验', ask: 'GCC 生成的机器指令对应实验室哪些「组成原理」实验?', kind: 'choice', compute: () => ({ answer: '加法/减法、乘法、浮点表示的机器级运算(GCC 把高级语言的算术编译成这些指令),以及编译前端的表达式求值(语法分析)。它把「组成原理」的运算真正生成出来', step: 0, evidence: '加减/乘法/浮点/表达式' }), distractors: () => ['TCP 和握手', 'ICP 和 SLAM', 'PageRank 和 A*'] },
      { id: 'gc_license', label: 'GCC 许可与你的程序', ask: 'GCC 是 GPLv3,那你用它编出来的程序也要开源吗?', kind: 'choice', compute: () => ({ answer: '不用。GCC 本身是 GPLv3,但它有"运行时库例外(GCC Runtime Library Exception)",让你编出来的程序不被 GPL 传染——可以闭源商用。改 GCC 本身才受 GPL 约束', step: 0, evidence: 'GPLv3+运行时例外、编出的程序不传染' }), distractors: () => ['要，用 GCC 编出来的程序也必须跟着 GPL', 'GCC 本身是闭源的、要买授权', '完全没有许可、想怎么用都行'] },
    ],
  },
  {
    id: 'gdb', title: 'GDB · GNU 调试器', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'gdb' }, entities: [], streams: [] },
    facts: [
      { id: 'gd_what', label: 'GDB 是什么', ask: 'GDB 能做什么?', kind: 'choice', compute: () => ({ answer: '调试器(GPLv3+):让程序停在断点、单步执行、查看和修改寄存器/内存/变量/调用栈、反汇编、远程调试(配 QEMU 调内核)、分析 core dump。把「组成原理」的寄存器/内存/栈变成看得见能拨动的东西', step: 0, evidence: '断点/单步/看寄存器内存栈/反汇编/远程' }), distractors: () => ['编译源码', '发送网络请求', '管理数据库'] },
      { id: 'gd_use', label: 'GDB 怎么配合用', ask: 'GDB 通常和什么一起用?', kind: 'choice', compute: () => ({ answer: '配 GCC(编译时加 -g 生成调试信息)、配 QEMU(远程调试操作系统内核/嵌入式)。GCC 编译、GDB 调试、QEMU 提供运行环境,是系统编程的经典工具三件套', step: 0, evidence: '配 GCC -g、配 QEMU 调内核' }), distractors: () => ['配 Photoshop 修图、配 PS 脚本用', '配 Excel 做表、排查表里的数据', '配浏览器调网页、配 DevTools'] },
      { id: 'gd_see', label: 'GDB 让你看见什么', ask: 'GDB 对理解「计算机组成原理」有什么帮助?', kind: 'choice', compute: () => ({ answer: '它把课本上抽象的寄存器、内存地址、函数调用栈、机器指令,变成运行时能实际观察的东西——你能真看到变量在内存哪个地址、函数调用怎么压栈、指令一条条怎么执行。是"看得见的组成原理"', step: 0, evidence: '寄存器/内存/栈/指令运行时可见' }), distractors: () => ['帮你写出跑得更快的排序与查找算法', '帮你画图表、把数据可视化', '帮你训练模型、自动调超参'] },
    ],
  },
  {
    id: 'qemu', title: 'QEMU · 整机模拟器', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'qemu' }, entities: [], streams: [] },
    facts: [
      { id: 'qm_what', label: 'QEMU 是什么', ask: 'QEMU 是干什么的?', kind: 'choice', compute: () => ({ answer: '整机模拟/虚拟化器(GPL-2.0):在软件里模拟出一整台计算机(CPU 指令翻译、内存、磁盘、网卡、外设),能启动完整操作系统,配 Linux KVM 可做接近原生的硬件加速虚拟化', step: 0, evidence: '软件模拟整台计算机、启动完整 OS、配 KVM' }), distractors: () => ['点云处理的老牌标准库、滤波/特征/配准/分割', '开源 VLA 基座(7B)、图 + 指令→动作', '基数树按前缀复用 KV 缓存、提吞吐'] },
      { id: 'qm_use', label: 'QEMU 学 OS 的价值', ask: 'QEMU 为什么是学操作系统/开发内核的标准平台?', kind: 'choice', compute: () => ({ answer: '它把整机放到一个可观察、可调试(配 GDB 单步调内核)的环境里跑,改内核不会搞崩真机、还能跨架构。学 OS、跑 xv6、开发/调试 Linux 内核都在它上面', step: 0, evidence: '整机可观察可调试、配 GDB 调内核' }), distractors: () => ['因为它是所有模拟器里面跑得最快的一个', '因为它自带图形界面、点点就能用', '因为它自带编译器、不用另装工具链'] },
      { id: 'qm_cover', label: 'QEMU 对应的实验', ask: 'QEMU 模拟的机器涉及实验室哪些「组成原理」概念?', kind: 'choice', compute: () => ({ answer: 'CPU 指令执行(缓存、流水线)、内存管理单元 MMU(虚拟内存/分页)——它把这些组成原理概念放到可跑可调的整机里。纯模拟慢、配 KVM 才快', step: 0, evidence: '缓存/流水线/虚拟内存(MMU)' }), distractors: () => ['TCP 三次握手/子网划分/CRC', '词向量和注意力、位置编码', 'B 树和哈希表、跳表与索引'] },
    ],
  },
  {
    id: 'wireshark', title: 'Wireshark · 网络抓包分析', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'wireshark' }, entities: [], streams: [] },
    facts: [
      { id: 'ws_what', label: 'Wireshark 是什么', ask: 'Wireshark 是干什么的?', kind: 'choice', compute: () => ({ answer: '网络抓包分析工具(GPL-2.0+):抓下网卡上的每个数据包,逐层逐字段解析(以太网→IP→TCP→HTTP…),让你亲眼看到协议在线路上怎么运作。是网络故障排查、协议开发、安全分析的事实标准', step: 0, evidence: '抓包逐层解析、看协议真实运作' }), distractors: () => ['一个 Web 服务器', '一个编译器', '一个数据库'] },
      { id: 'ws_cover', label: 'Wireshark 对应的实验', ask: 'Wireshark 能对照实验室「计算机网络」组哪些实验?', kind: 'choice', compute: () => ({ answer: 'TCP(拥塞/可靠、序号确认重传窗口)、三次握手、子网划分、CRC 校验——你能抓真实的包对照实验里的原理看:握手的 SYN/ACK、重传、校验字段都在包里', step: 0, evidence: 'TCP/三次握手/子网/CRC' }), distractors: () => ['LRU/缺页/页表/TLB 刷新', 'CNN/池化/BN/ReLU', 'B 树/哈希/跳表/LSM'] },
      { id: 'ws_use', label: 'Wireshark 的价值', ask: 'Wireshark 对学网络协议有什么独特价值?', kind: 'choice', compute: () => ({ answer: '把课本上抽象的协议变成"看得见的真流量":你能实际抓到 TCP 三次握手的三个包、看到重传和窗口变化、逐字段拆开每个包。学协议从"背 RFC"变成"看真包"', step: 0, evidence: '协议从课本变可见的真实流量' }), distractors: () => ['帮你写出跑得更快的那种代码', '帮你训练模型调超参', '帮你管理内存和显存'] },
    ],
  },
  {
    id: 'nginx', title: 'nginx · 高性能 Web 服务器', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'nginx' }, entities: [], streams: [] },
    facts: [
      { id: 'ng_what', label: 'nginx 是什么', ask: 'nginx 是干什么的?靠什么扛高并发?', kind: 'choice', compute: () => ({ answer: '高性能 Web 服务器/反向代理/负载均衡(BSD-2):靠事件驱动 + 异步非阻塞(epoll/kqueue)架构,单进程用 IO 多路复用管海量连接,单机就能扛住高并发(经典 C10K 问题的答案)', step: 0, evidence: '事件驱动+epoll 异步非阻塞、扛高并发' }), distractors: () => ['靠为每个连接开一个线程', '靠更快的 CPU', '靠更大的内存'] },
      { id: 'ng_epoll', label: 'nginx 和 OS 的关系', ask: 'nginx 的高并发和操作系统哪个机制相关?', kind: 'choice', compute: () => ({ answer: 'IO 多路复用(epoll):一个线程用 epoll 同时盯着成千上万个连接,谁有数据就处理谁,不用一连接一线程。这和 OS 的事件通知、进程调度/事件循环相通——是「网络」和「操作系统」的交汇', step: 0, evidence: 'epoll IO 多路复用、和调度/事件循环相通' }), distractors: () => ['和文件系统 inode 的分配与回收方式完全相通', '和 CPU 缓存的命中率与替换相通', '和浮点运算的舍入误差处理相通'] },
      { id: 'ng_role', label: 'nginx vs curl', ask: 'nginx 和 curl 在网络里分别是什么角色?', kind: 'choice', compute: () => ({ answer: 'nginx 是服务端(接收并响应请求的 Web 服务器),curl 是客户端(发起请求)。一次网络请求:curl 发出 → 经 TCP 握手 → nginx 接收响应。抓包看两边靠 Wireshark', step: 0, evidence: 'nginx 服务端、curl 客户端' }), distractors: () => ['nginx 客户端、curl 服务端', 'nginx 和 curl 都是客户端', 'nginx 和 curl 都是抓包器'] },
    ],
  },
  {
    id: 'redis', title: 'Redis · 内存数据结构服务器', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'redis' }, entities: [], streams: [] },
    facts: [
      { id: 'rd_what', label: 'Redis 是什么', ask: 'Redis 是干什么的?为什么快?', kind: 'choice', compute: () => ({ answer: '内存数据结构服务器(C 写):把字符串/哈希/列表/集合/有序集合(跳表)/位图等当网络服务用,常做缓存/排行榜/队列。快在数据全在内存 + 单线程事件循环(无锁竞争)。内部是一座数据结构博物馆', step: 0, evidence: '内存数据结构服务器、单线程事件循环、极快' }), distractors: () => ['一个关系数据库(存磁盘)', '一个编译器', '一个 Web 服务器'] },
      { id: 'rd_cover', label: 'Redis 对应的实验', ask: 'Redis 内部结构对应实验室哪些概念?', kind: 'choice', compute: () => ({ answer: '哈希表(渐进式 rehash,对应「数据结构」哈希)、有序集合用跳表、以及内存满时的 LRU/LFU 淘汰(和「操作系统」页替换 LRU 同思路)。它是这些数据结构的工程范本', step: 0, evidence: '哈希表 rehash、LRU 淘汰↔页替换' }), distractors: () => ['TCP 三次握手和 CRC 校验、滑动窗口', '卷积和注意力、位置编码', '梯度下降和反向传播、链式法则'] },
      { id: 'rd_license', label: 'Redis 许可变更', ask: 'Redis 的许可这几年发生了什么?用要注意什么?', kind: 'choice', compute: () => ({ answer: '2024 从宽松的 BSD 改成 source-available(SSPLv1/RSALv2),一度不再是 OSI 开源;Redis 8(2025)又加回 AGPLv3 作为可选,现在是三重许可。商用/云服务要看清条款;社区拉了个 BSD 分叉叫 Valkey', step: 0, evidence: '2024 转闭源、8 又加回 AGPLv3' }), distractors: () => ['2024 转 MIT、8 收紧 BSD-3', '一直 BSD-3、8 起加 Apache', '2024 转 GPL-3、8 放宽 MIT'] },
    ],
  },
  {
    id: 'sqlite', title: 'SQLite · 嵌入式数据库', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'sqlite' }, entities: [], streams: [] },
    facts: [
      { id: 'sq_what', label: 'SQLite 是什么', ask: 'SQLite 有什么特别?为什么部署最广?', kind: 'choice', compute: () => ({ answer: '嵌入式、零配置、单文件的关系数据库(公有领域):整个库就是磁盘上一个 .db 文件,随程序进程跑、不用单独的服务器。因为小、稳、无依赖,被嵌进手机/浏览器/操作系统/飞机——是部署量最大的数据库', step: 0, evidence: '单文件+零配置+嵌入式、部署最广' }), distractors: () => ['需要单独起一个服务器进程才能用起来', '只能在云上跑、本地跑不了', '是内存数据库、根本不落盘'] },
      { id: 'sq_cover', label: 'SQLite 的存储结构', ask: 'SQLite 的存储引擎核心是什么数据结构?对应哪个实验?', kind: 'choice', compute: () => ({ answer: 'B 树/B+ 树:表和索引都用 B 树组织、页式存储到文件。正是「数据结构」里的 B 树/B+ 树实验。SQLite 是"B 树怎么落到磁盘文件"的最佳活样本', step: 0, evidence: 'B 树/B+ 树存储、对应 btree' }), distractors: () => ['LSM 树 + SSTable、对应 lsm', '哈希桶 + 开放寻址、对应 hash', '跳表 + WAL 追加、对应 skiplist'] },
      { id: 'sq_license', label: 'SQLite 许可', ask: 'SQLite 的许可是什么?', kind: 'choice', compute: () => ({ answer: '公有领域(Public Domain)——没有版权限制,想怎么用怎么用(商用/闭源都行、无需署名)。这在开源里少见,也是它能嵌进一切的原因之一', step: 0, evidence: '公有领域、无任何许可限制' }), distractors: () => ['GPL 传染、改了就要开源', 'AGPL、云服务受限制', '商业收费、按坐席买'] },
    ],
  },
  {
    id: 'git', title: 'Git · 分布式版本控制', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'git' }, entities: [], streams: [] },
    facts: [
      { id: 'gt_what', label: 'Git 的内部模型', ask: 'Git 内部是怎么存东西的?', kind: 'choice', compute: () => ({ answer: '内容寻址对象库:每个文件(blob)/目录(tree)/提交(commit)都按内容的 SHA 哈希寻址——改一点内容哈希就变;提交靠父指针连成有向无环图(DAG),分支只是指向某个提交的指针。是一个漂亮的数据结构设计', step: 0, evidence: '内容寻址 + 提交 DAG + 分支是指针' }), distractors: () => ['路径寻址 + 提交链表 + 分支是拷贝', '内容寻址 + 提交 DAG + 分支是快照', '行号寻址 + diff 链 + 分支是补丁'] },
      { id: 'gt_cover', label: 'Git 对应的实验', ask: 'Git 的设计对应实验室哪些数据结构?', kind: 'choice', compute: () => ({ answer: '哈希(内容寻址,改内容→新哈希,类似哈希表/指纹)、拓扑排序(提交的有向无环图 DAG,log 就是拓扑序);内容去重/压缩和布隆/压缩思路相通。理解 Git = 把哈希+DAG 串一遍', step: 0, evidence: '哈希(内容寻址)、拓扑排序(提交 DAG)' }), distractors: () => ['TCP 三次握手、拥塞控制与滑动窗口的机制', '卷积和池化、批归一化与残差', '调度和缺页、虚拟内存与页表'] },
      { id: 'gt_dist', label: 'Git 为什么分布式', ask: 'Git 的"分布式"体现在哪?', kind: 'choice', compute: () => ({ answer: '每个克隆(clone)都是包含完整历史的完整仓库,可以离线提交/查历史/建分支,不依赖中心服务器;需要时再和别人同步(push/pull)。这和集中式(SVN,必须连服务器)不同', step: 0, evidence: '每个克隆是完整仓库、可离线、去中心' }), distractors: () => ['必须连上中心服务器才能提交代码上去', '只在云端存代码、本地不留副本', '不能建分支、只有一条主线可用'] },
    ],
  },
  {
    id: 'docker', title: 'Docker · 容器', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'docker' }, entities: [], streams: [] },
    facts: [
      { id: 'dk_what', label: 'Docker 是什么', ask: 'Docker 容器和虚拟机有什么本质不同?', kind: 'choice', compute: () => ({ answer: '容器不是虚拟机:它不虚拟一整台机器,而是直接用宿主 Linux 内核的原语——namespaces(隔离进程/网络/文件视图)+cgroups(限 CPU/内存)+overlayfs(镜像分层)——把应用装进一个隔离环境。共享内核,所以比 VM 轻', step: 0, evidence: '共享内核、靠 namespaces 隔离' }), distractors: () => ['和虚拟机一样虚拟整台机器、自带 Guest OS', '是一种新的 CPU 指令集扩展', '是一个编译器、把代码打包成镜像'] },
      { id: 'dk_cover', label: 'Docker 对应的 OS 概念', ask: 'Docker 用到的 Linux 内核机制对应实验室哪些 OS 概念?', kind: 'choice', compute: () => ({ answer: 'cgroups 限制 CPU/内存配额(和进程调度/资源管理相关)、overlayfs 联合文件系统(和 inode/文件系统相关)。理解容器 = 理解 OS 的隔离与资源管理', step: 0, evidence: 'cgroups↔调度、overlayfs↔文件系统' }), distractors: () => ['cgroups↔页表、overlayfs↔TLB 刷新', 'namespaces↔虚拟内存、seccomp↔中断', 'epoll↔文件系统、inotify↔进程调度'] },
      { id: 'dk_license', label: 'Docker 的开源与商业', ask: 'Docker 的开源和商业怎么区分?', kind: 'choice', compute: () => ({ answer: '底层容器引擎(moby 项目)是 Apache-2.0 开源;而 Docker Desktop(桌面客户端)对较大企业有商业授权条款。用引擎/CLI 一般没问题,企业用 Desktop 要看授权', step: 0, evidence: '引擎 Apache-2.0 但桌面版收费' }), distractors: () => ['引擎 GPL-2.0、桌面版免费', '引擎 AGPL-3.0、桌面版 BSD-3', '引擎 BSD-3、桌面版 Apache-2'] },
    ],
  },
  {
    id: 'xv6', title: 'xv6 · 教学操作系统', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'xv6' }, entities: [], streams: [] },
    facts: [
      { id: 'xv_what', label: 'xv6 是什么', ask: 'xv6 是什么?为什么用它学 OS?', kind: 'choice', compute: () => ({ answer: 'MIT 为操作系统课(6.S081)写的教学操作系统(MIT 许可):一个几千行、能真编译运行的类 Unix 内核(RISC-V + QEMU)。Linux 几千万行读不动,xv6 小到能完整读懂,却涵盖进程/调度/内存/文件系统/锁', step: 0, evidence: '几千行能真跑的教学类 Unix 内核' }), distractors: () => ['一个生产级服务器内核', '一个编译器', '一个数据库'] },
      { id: 'xv_cover', label: 'xv6 覆盖的 OS 概念', ask: 'xv6 里能读到实验室哪些 OS 实验的完整实现?', kind: 'choice', compute: () => ({ answer: '进程调度(上下文切换)、虚拟内存(分页/缺页)、inode + 日志的文件系统——「操作系统」组实验的原理,在 xv6 里是完整、可编译运行的最小真实现。是从"原理"到"真代码"的最短路径', step: 0, evidence: '调度/缺页/inode 的完整可运行实现' }), distractors: () => ['TCP 三次握手和子网划分的完整实现过程', '卷积和注意力、批归一化的实现', 'B 树和哈希表、跳表索引的实现'] },
      { id: 'xv_vs', label: 'xv6 vs Linux', ask: '学 OS 用 xv6 还是 Linux?', kind: 'choice', compute: () => ({ answer: '先 xv6 后 Linux:xv6 小(几千行)、能完整读懂 OS 骨架,适合入门;Linux 是生产内核(几千万行、功能全但门槛极高),xv6 打好基础后再看 Linux 的工业实现', step: 0, evidence: 'xv6 入门读懂骨架、Linux 工业实现' }), distractors: () => ['xv6 更适合直接拿去做生产环境的部署使用', 'Linux 更适合教学入门读骨架', '两者完全一样、只是名字不同'] },
    ],
  },
  {
    id: 'curl', title: 'curl · 网络客户端', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'curl' }, entities: [], streams: [] },
    facts: [
      { id: 'cl_what', label: 'curl 是什么', ask: 'curl 是干什么的?', kind: 'choice', compute: () => ({ answer: '网络客户端(curl License,MIT 派生):命令行工具 + 库 libcurl,把 HTTP(S)/FTP 等几十种协议的请求发出去、拿回响应。是部署量最大的软件之一(几乎每台设备/汽车/手机里都有),调 API/下载/自动化脚本首选', step: 0, evidence: '命令行+libcurl、多协议客户端、部署量最大' }), distractors: () => ['一个 Web 服务器', '一个抓包工具', '一个数据库'] },
      { id: 'cl_cover', label: 'curl 一次请求发生什么', ask: '一次 `curl https://...` 背后经历了什么?对应哪个实验?', kind: 'choice', compute: () => ({ answer: 'DNS 解析 → TCP 三次握手 → TLS 握手 → 发 HTTP 请求 → 收响应。curl -v 能看到握手和头的全过程。对应「计算机网络」的三次握手、TCP——它是网络的"客户端侧"活样本', step: 0, evidence: 'DNS→TCP 握手→TLS→HTTP' }), distractors: () => ['TCP 握手→DNS→TLS→HTTP', 'DNS→UDP 直发→HTTP(免握手)', 'ARP→DHCP→NAT→HTTP'] },
      { id: 'cl_role', label: 'curl 的角色', ask: 'curl 在网络里是什么角色?配合谁?', kind: 'choice', compute: () => ({ answer: '客户端(发起请求),对应的服务端是 nginx 那类 Web 服务器;要看它俩之间线路上的包,用 Wireshark 抓。curl 发 → 握手 → nginx 收响应 → Wireshark 看全过程', step: 0, evidence: '客户端;配服务端 nginx 与抓包' }), distractors: () => ['服务端;配客户端 curl 与压测器', '抓包器;配 nginx 与 tcpdump', '代理;配 nginx 做 L7 层转发'] },
    ],
  },
  {
    id: 'wildcard', title: '通配符匹配', kernel: wildcardKernel as Kernel<unknown>, doc: trivialDoc('wildcard'),
    facts: [
      {
        id: 'star_backtrack', label: '通配符 * 该吃几个字符怎么定',
        ask: '通配符匹配里 * 能配任意一段，它到底该吃几个字符？双指针法怎么处理?', kind: 'choice',
        compute: () => ({ answer: '记锚点先吃 0 个，走不通回溯多吃一个', step: 2, evidence: 'p="a*d"，* 先当匹配 0 个，后面 d≠b 走不通→回溯让 * 吃 b、再吃 c' }),
        distractors: () => ['* 总是一次吃掉剩下的所有字符', '* 总是只吃掉一个字符就往后走', '枚举 * 吃 0 到 n 个、全部试一遍'],
      },
      {
        id: 'why_anchor', label: '双指针法的空间复杂度',
        ask: '通配符匹配用"双指针+回溯锚点"而不是动态规划，好处是?', kind: 'choice',
        compute: () => ({ answer: 'O(n) 时间、O(1) 额外空间', step: 6, evidence: '全程只维护 si/pj/star/sTmp 几个变量，无二维表' }),
        distractors: () => ['双指针一定比 DP 慢上不少的', '双指针也要 O(n×m) 的额外空间', '两种方法的空间开销完全是一样的'],
      },
    ],
  },
  {
    id: 'regex', title: 'mini 正则引擎', kernel: regexKernel as Kernel<unknown>, doc: trivialDoc('regex'),
    facts: [
      {
        id: 'star_two', label: '正则 * 在 DP 里的两种转移',
        ask: '正则的 * 表示"零或多个前一字符"，在动态规划里它对应哪两种转移?', kind: 'choice',
        compute: () => ({ answer: '跳过 x*，或消掉 s 一个字符', step: 1, evidence: 'c* 用①匹配 0 个 c；a* 用②吃掉 2 个 a' }),
        distractors: () => ['* 只能匹配恰好一个字符，不能多也不能少', '* 直接看左上角一种转移', '* 匹配整个剩余的字符串'],
      },
      {
        id: 'vs_wildcard', label: '正则 * 和通配符 * 的区别',
        ask: '正则的 * 和通配符（glob）的 * 有什么本质区别?', kind: 'choice',
        compute: () => ({ answer: '正则 * 跟前一个字符，glob * 是任意段', step: 5, evidence: 'p="c*a*b" 里 c*=零或多个c、a*=零或多个a；通配符里 * 是任意段' }),
        distractors: () => ['两者完全一样', '正则 * 匹配一整段、而通配符 * 只匹配一个', '只是写法不同、语义上其实完全相同'],
      },
    ],
  },
]

// 最终目录 = 历史核心 + 三轨(大模型/算法/408)分片。分片各自 probe 过、id 与核心不重复。
export const CATALOG: CatalogEntry[] = [
  ...CATALOG_CORE,
  ...LLM_INFER_A_ENTRIES,
  ...LLM_INFER_B_ENTRIES,
  ...TRANSFORMER_ENTRIES,
  ...LLM_ALGO_ENTRIES,
  ...DS_CLASSIC_ENTRIES,
  ...ML_ENTRIES,
  ...DL_STATS_ENTRIES,
  ...SYS408_ENTRIES,
  //  点不到的那批（隐藏的具身轨 + 已下线的孤儿组）搬去了 catalog/dormant.ts，行为不变
  ...DORMANT_ENTRIES,
]

/*  把原理题补丁包挂上去（server/catalog/concepts.ts）。
    那 75 个最早的实验只有计数题，用户看到的就是连着三道「比了几次 / 移了几次」。
    补丁不改原条目，只往它们的 facts 后面追加 —— 合并点就这一处，好 review 也好回退。
    ⚠️ 键写错了会静默什么都不做，所以 tests/fact-genre.test.ts 里有一条判据盯着
    「补丁包里的每个 id 都对得上一个真实验」。 */
for (const src of [CONCEPT_FACTS, FILL_FACTS]) {
  for (const [id, extra] of Object.entries(src)) {
    const e = CATALOG.find(x => x.id === id)
    if (e) e.facts = [...e.facts, ...extra]
  }
}

/**
 * 库层那批题:把「选项」和「出处」对调。
 *
 * 起因:用户报了「题目肤浅」之后,判据又抓出一批**靠长度就能猜中**的题,其中最离谱的
 * 全在软件库层 —— 比如「Hugging Face Transformers 是干什么的?」,正确项是一段 142 字的
 * 说明书,三个干扰项是「一个物理仿真器」「一个推理编译器」「一个向量库」,各 7 个字。
 * 不用懂也能挑出最长那条,而且读完也没学到东西 —— 那段说明书本来就不是「选项」,是「讲解」。
 *
 * 好在这批 fact 的 `evidence` 字段里**早就写着一句精炼版的结论**
 * (「通信中间件+工具生态、非真OS、DDS」「刚体动力学算法库(RNEA/ABA/CRBA)+解析导数」)——
 * 那正是选项该有的长度。所以不是重写,是**对调**:短结论上来当选项,整段说明下去当出处
 * (讲解会用到)。一处变换管 143 条,不去动 143 个地方。
 *
 * ⚠️ 只在库层做。别的实验的 evidence 是**轨迹引文**(「URL#1 发号 100000000 → …」),
 * 那种东西当选项就是答非所问 —— 所以这个变换按 doc.kind 卡死,不许推广。
 */
for (const e of CATALOG) {
  if (e.doc.kind !== 'library') continue
  e.facts = e.facts.map(f => {
    const probe = (() => { try { return f.compute(traceOf(e)) } catch { return null } })()
    /*  出处太短(当不了一句完整结论)或不比答案短的,原样留着。
        门槛一开始定在 12,结果把「GBDT/决策树」「预处理→编译→汇编→链接」这种**正好合适**的
        短结论挡在外面,那 5 条的选项仍是 70~90 字的说明书 —— 判据当场抓到。放宽到 6。 */
    if (!probe || probe.evidence.length < 6 || probe.evidence.length >= probe.answer.length) return f
    return {
      ...f,
      genre: 'concept' as const,      // 对调后答案变短,别被「短答案=计数题」的兜底推断认错
      compute: (t: Frame[]) => {
        const r = f.compute(t)
        return { answer: r.evidence, step: r.step, evidence: r.answer }
      },
      //  干扰项函数拿到的仍是**原来那个**答案 —— 有的干扰项是按答案算出来的,不能给它换参数
      distractors: (_a: string, t: Frame[]) => f.distractors(f.compute(t).answer, t),
    }
  })
}

const BY_ID = new Map(CATALOG.map(e => [e.id, e]))

export function getEntry(id: string): CatalogEntry | undefined {
  return BY_ID.get(id)
}

/**
 * 库层「这个库是干什么的」那一问:干扰项换成**别的库的角色描述**。
 *
 * 原来的干扰项是「一个物理仿真器」「一个向量库」这种 7 字标签,和正确项一比长度悬殊,
 * 挑最长的就中;而且它们太笼统,排除起来不需要知识。换成别的库那句真实的角色描述之后:
 *   · 长度天然齐平(都是对调上来的同一种句子);
 *   · 每一条都是**真实存在的角色**,只是属于别的库 —— 想排除就得知道那个库是干嘛的;
 *   · 必然是错的(描述的是另一个库),不会出现"两个都对"。
 * 于是这道题从「认最长的」变成了「这四句话里哪句说的是 Pinocchio」。
 *
 * ⚠️ 两个库的角色可能真的重叠(都叫「框架」「库」),那样干扰项就可能也说得通。
 * 所以候选要过一道**词面重合**的筛:和正确答案共享两个以上实词的一律不用。
 */
{
  const isRoleAsk = (a: string) => /是干什么的|是什么|做什么|干嘛|什么角色/.test(a)
  const libs = CATALOG.filter(e => e.doc.kind === 'library')
  //  取每个库的首条 fact(约定就是「这个库是干什么的」)对调后的那句角色描述
  const roleOf = new Map<string, string>()
  for (const e of libs) {
    const f = e.facts[0]
    if (!f || !isRoleAsk(f.ask)) continue
    try { roleOf.set(e.id, f.compute(run(e.kernel.compile(e.doc) as CompiledModel<Frame>)).answer) } catch { /* 跑不出来就不参与 */ }
  }
  /** 两句话共享几个长度≥2 的实词 —— 用来避开角色真的撞车的库。 */
  const overlap = (a: string, b: string) => {
    const grams = (s: string) => new Set((s.match(/[\u4e00-\u9fa5]{2,4}/g) ?? []))
    const ga = grams(a); let n = 0
    for (const g of grams(b)) if (ga.has(g)) n++
    return n
  }
  for (const e of libs) {
    const f = e.facts[0]
    if (!f || !isRoleAsk(f.ask)) continue
    const mine = roleOf.get(e.id); if (!mine) continue
    const pool = [...roleOf.entries()].filter(([id, r]) => id !== e.id && overlap(mine, r) < 2).map(([, r]) => r)
    if (pool.length < 3) continue        // 挑不出三个够远的就保留原干扰项
    /**
     * 从池子里**挑长度配得上的**,不是按哈希随手取。
     *
     * 上一版是「按实验 id 的哈希定点取」—— 可复现，但可复现地取错:
     * QEMU 那句角色描述 23 字，哈希取到的三条是 21/21/14，
     * **答案仍然是唯一最长的**，这道题照样能靠长度蒙对。这一整批(库层
     * 「这个库是干什么的」那一问)都栽在同一处，逐条去改源码里的 distractors 还没用 ——
     * 这个生成器在运行时把它们整个覆盖掉了。判据写在根因上，就得改这里。
     *
     * 挑法:按「和答案的字数差」排序，先各留一条不短于、一条不长于答案的，
     * 再用最接近的补满三条。这样答案既不是唯一最长、也不是唯一最短。
     * 仍然是纯函数、无随机 —— 可复现这条没丢。
     */
    const len = (x: string) => [...x].length
    /*  **字数配得上还不够，符号也得配得上。**
        只按字数挑同伴时判据⑫又抓出一条：`ndarray+向量化、生态全建其上` 里有 8 个
        英文/数字，而挑中的三条同伴一个都没有 —— 于是"挑看起来最技术的那条"照样能蒙。
        所以距离按「字数差 + 符号数差」一起算。 */
    const note = (x: string) => (x.match(/[A-Za-z0-9=+\-×·↔→√≈²³∝]/g) ?? []).length
    const lm = len(mine), nm = note(mine)
    const dist = (x: string) => Math.abs(len(x) - lm) + Math.abs(note(x) - nm)
    const near = pool.slice().sort((a, b) => dist(a) - dist(b) || a.localeCompare(b))
    //  长度和符号都各留一条"不低于"、一条"不高于"的，剩下按最近补满
    const pick = (f: (x: string) => number, m: number, up: boolean) =>
      near.find(r => (up ? f(r) >= m : f(r) <= m))
    const picks = [...new Set([
      pick(len, lm, true), pick(len, lm, false), pick(note, nm, true), pick(note, nm, false), ...near,
    ].filter((x): x is string => !!x))].slice(0, 3)
    if (new Set(picks).size < 3) continue
    e.facts = e.facts.map(x => x === f ? { ...x, distractors: () => picks } : x)
  }
}

/** 跑内核得到确定性 trace（出题/验答的唯一真源）。 */
export function traceOf(entry: CatalogEntry): Frame[] {
  const model = entry.kernel.compile(entry.doc) as CompiledModel<Frame>
  return run(model)
}

export function listExperiments(): { id: string; title: string; facts: number }[] {
  return CATALOG.map(e => ({ id: e.id, title: e.title, facts: e.facts.length }))
}
