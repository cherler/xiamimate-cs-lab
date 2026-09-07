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
import { mvccKernel } from '../src/kernels/mvcc.ts'
import { bplusKernel } from '../src/kernels/bplus.ts'
import { isoKernel } from '../src/kernels/iso.ts'
import { casKernel } from '../src/kernels/cas.ts'
import { mesiKernel } from '../src/kernels/mesi.ts'
import { deadlockKernel } from '../src/kernels/deadlock.ts'
import { raftKernel } from '../src/kernels/raft.ts'
import { caesarKernel } from '../src/kernels/caesar.ts'
import { vigenereKernel } from '../src/kernels/vigenere.ts'
import { xorKernel } from '../src/kernels/xorcipher.ts'
import { modpowKernel } from '../src/kernels/modpow.ts'
import { dhKernel } from '../src/kernels/diffiehellman.ts'
import { rsaKernel } from '../src/kernels/rsa.ts'
import { extgcdKernel } from '../src/kernels/extgcd.ts'
import { signKernel } from '../src/kernels/signature.ts'
import { hashavalKernel } from '../src/kernels/hashaval.ts'
import { merkleKernel } from '../src/kernels/merkle.ts'
import { crtKernel } from '../src/kernels/crt.ts'
import { fermatKernel } from '../src/kernels/fermat.ts'
import { saltKernel } from '../src/kernels/salt.ts'
import { tokenbucketKernel } from '../src/kernels/tokenbucket.ts'
import { consistentHashKernel } from '../src/kernels/consistenthash.ts'
import { skiplistKernel } from '../src/kernels/skiplist.ts'
import { twopcKernel } from '../src/kernels/twopc.ts'
import { otpreuseKernel } from '../src/kernels/otpreuse.ts'
import { ecbcbcKernel } from '../src/kernels/ecbcbc.ts'
import { birthdayKernel } from '../src/kernels/birthday.ts'
import { aesroundKernel } from '../src/kernels/aesround.ts'
import { hmacKernel } from '../src/kernels/hmac.ts'
import { totpKernel } from '../src/kernels/totp.ts'
import { snowflakeKernel } from '../src/kernels/snowflake.ts'
import { vectorclockKernel } from '../src/kernels/vectorclock.ts'
import { quorumKernel } from '../src/kernels/quorum.ts'
import { circuitbreakerKernel } from '../src/kernels/circuitbreaker.ts'
import { joinsKernel } from '../src/kernels/joins.ts'
import { compositeindexKernel } from '../src/kernels/compositeindex.ts'
import { rwlockKernel } from '../src/kernels/rwlock.ts'
import { abaKernel } from '../src/kernels/aba.ts'
import { happensbeforeKernel } from '../src/kernels/happensbefore.ts'
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
import { actteKernel } from '../src/kernels/actte.ts'
import { deltatsKernel } from '../src/kernels/deltats.ts'
import { normstatsKernel } from '../src/kernels/normstats.ts'
import { teleopKernel } from '../src/kernels/teleop.ts'
import { miniduckKernel } from '../src/kernels/miniduck.ts'
import { focKernel } from '../src/kernels/foc.ts'
import { lfucacheKernel } from '../src/kernels/lfucache.ts'
import { trieKernel } from '../src/kernels/trie.ts'
import { quickselectKernel } from '../src/kernels/quickselect.ts'
import { lockstrategyKernel } from '../src/kernels/lockstrategy.ts'
import { bufferpoolKernel } from '../src/kernels/bufferpool.ts'
import { feedKernel } from '../src/kernels/feed.ts'
import { fkKernel } from '../src/kernels/fk.ts'
import { dyneomKernel } from '../src/kernels/dyneom.ts'
import { rneaKernel } from '../src/kernels/rnea.ts'
import { fwddynKernel } from '../src/kernels/fwddyn.ts'
import { computedtorqueKernel } from '../src/kernels/computedtorque.ts'
import { contactlcpKernel } from '../src/kernels/contactlcp.ts'
import { ikKernel } from '../src/kernels/ik.ts'
import { jacobianKernel } from '../src/kernels/jacobian.ts'
import { quatKernel } from '../src/kernels/quat.ts'
import { trajectoryKernel } from '../src/kernels/trajectory.ts'
import { icpKernel } from '../src/kernels/icp.ts'
import { slamKernel } from '../src/kernels/slam.ts'
import { impedanceKernel } from '../src/kernels/impedance.ts'
import { mpcKernel } from '../src/kernels/mpc.ts'
import { bcKernel } from '../src/kernels/bc.ts'
import { diffpolicyKernel } from '../src/kernels/diffpolicy.ts'
import { vlaKernel } from '../src/kernels/vla.ts'
import { lerobotKernel } from '../src/kernels/lerobot.ts'
import { kalmanKernel } from '../src/kernels/kalman.ts'
import { ekfKernel } from '../src/kernels/ekf.ts'
import { pinholeKernel } from '../src/kernels/pinhole.ts'
import { pointcloudKernel } from '../src/kernels/pointcloud.ts'
import { stereoKernel } from '../src/kernels/stereo.ts'
import { handeyeKernel } from '../src/kernels/handeye.ts'
import { voKernel } from '../src/kernels/vo.ts'
import { pnpKernel } from '../src/kernels/pnp.ts'
import { particlefilterKernel } from '../src/kernels/particlefilter.ts'
import { ukfKernel } from '../src/kernels/ukf.ts'
import { complementaryKernel } from '../src/kernels/complementary.ts'
import { pidKernel } from '../src/kernels/pid.ts'
import { rrtKernel } from '../src/kernels/rrt.ts'
import { rrtconnectKernel } from '../src/kernels/rrtconnect.ts'
import { dstarliteKernel } from '../src/kernels/dstarlite.ts'
import { libraryKernel } from '../src/kernels/library.ts'
import { rrtstarKernel } from '../src/kernels/rrtstar.ts'
import { potentialfieldKernel } from '../src/kernels/potentialfield.ts'
import { chompKernel } from '../src/kernels/chomp.ts'
import { trapezoidKernel } from '../src/kernels/trapezoid.ts'
import { gjkKernel } from '../src/kernels/gjk.ts'
import { dubinsKernel } from '../src/kernels/dubins.ts'
import { prmKernel } from '../src/kernels/prm.ts'
import { mdpKernel } from '../src/kernels/mdp.ts'
import { qlearningKernel } from '../src/kernels/qlearning.ts'
import { policygradKernel } from '../src/kernels/policygrad.ts'
import { ppoKernel } from '../src/kernels/ppo.ts'
import { objectstoreKernel } from '../src/kernels/objectstore.ts'
import { queryplanKernel } from '../src/kernels/queryplan.ts'
import { wildcardKernel } from '../src/kernels/wildcard.ts'
import { blockingqueueKernel } from '../src/kernels/blockingqueue.ts'
import { regexKernel } from '../src/kernels/regex.ts'
import { walKernel } from '../src/kernels/wal.ts'
import { lsmKernel } from '../src/kernels/lsm.ts'
import { minikvKernel } from '../src/kernels/minikv.ts'
import { urlshortenerKernel } from '../src/kernels/urlshortener.ts'
import { seckillKernel } from '../src/kernels/seckill.ts'
import { minisearchKernel } from '../src/kernels/minisearch.ts'
import { mqdesignKernel } from '../src/kernels/mqdesign.ts'
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
import { CONCEPT_FACTS } from './catalog/concepts.ts'
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
    doc: trivialDoc('quicksort'),
    facts: [
      {
        id: 'total_steps', label: '快排走完整个过程的总步数(帧数)',
        ask: '把这个数组快速排序完成，逐步演示一共有多少帧(步)?',
        kind: 'number',
        compute: t => ({ answer: String(t.length), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
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
    doc: trivialDoc('mergesort'),
    facts: [
      {
        id: 'total_steps', label: '归并排序逐步演示的总帧数',
        ask: '对这 7 个数做归并排序，逐步演示一共有多少帧(步)?',
        kind: 'number',
        compute: t => ({ answer: String(t.length), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'emit_count', label: '归并过程中「取较小的放进输出」的次数',
        ask: '归并排序全过程一共做了多少次「比较两段队首、取较小的放进输出」(emit)?',
        kind: 'number',
        compute: t => {
          const n = t.filter(f => f.act === 'emit').length
          return { answer: String(n), step: t.length - 1, evidence: `trace 中 act='emit' 的帧数 = ${n}` }
        },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'fastpow',
    title: '快速幂',
    kernel: fastpowKernel as Kernel<unknown>,
    doc: trivialDoc('fastpow'),
    facts: [
      {
        id: 'mults', label: '快速幂计算 3^13 的乘法次数',
        ask: '用快速幂计算 3^13，需要多少次「乘法」(把某个 a^(2^k) 乘进结果)?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).mults), step: t.length - 1, evidence: `13=1101₂，二进制里有几个 1 就乘几次；终态 mults=${last(t).mults}` }),
        distractors: numDistractors,
      },
      {
        id: 'squares', label: '快速幂计算 3^13 的平方次数',
        ask: '用快速幂计算 3^13，需要多少次「平方」(把底数反复自乘得到 a^2、a^4、a^8…)?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).squares), step: t.length - 1, evidence: `终态 squares=${last(t).squares}` }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'nqueens',
    title: '回溯 · N 皇后',
    kernel: nqueensKernel as Kernel<unknown>,
    doc: trivialDoc('nqueens'),
    facts: [
      {
        id: 'backtracks', label: '4 皇后求第一个解的回溯次数',
        ask: '4 皇后用回溯法求出第一个解，一共回溯(退回上一行重试)了几次?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).backtracks), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'tries', label: '4 皇后求第一个解的落子尝试次数',
        ask: '4 皇后求第一个解的过程中，一共尝试落子多少次?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).tries), step: t.length - 1, evidence: `终态 tries=${last(t).tries}` }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'unionfind',
    title: '并查集',
    kernel: unionfindKernel as Kernel<unknown>,
    doc: trivialDoc('unionfind'),
    facts: [
      {
        id: 'unions', label: '把散点并成一个分量执行的 union 次数',
        ask: '把这些散点合并连通的过程中，一共执行了多少次 union 操作?',
        kind: 'number',
        compute: t => {
          const n = t.filter(f => f.act === 'union').length
          return { answer: String(n), step: t.length - 1, evidence: `trace 中 act='union' 的帧数 = ${n}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'first_union_comps', label: '第一次 union 后剩余连通分量数',
        ask: '初始 7 个各自独立的点，执行第一次 union(0,1) 之后，还剩几个连通分量?',
        kind: 'number',
        compute: t => ({ answer: String(t[0]!.comps), step: 0, evidence: String(t[0]!.log ?? '') }),
        distractors: numDistractors,
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
    doc: trivialDoc('dtree'),
    facts: [
      {
        id: 'depth', label: '建好的决策树深度',
        ask: '这棵决策树按信息增益建好后，深度是多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).depth), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'dt_ncands', label: '根节点枚举的候选切法数',
        ask: '决策树选第一刀时，在根节点一共枚举了多少个候选切法(每个特征相邻取值的中点)来比较信息增益、取最大?',
        kind: 'number',
        compute: t => { const f = t.find(x => x.phase === 'search' && (x.splits as unknown[]).length === 0)!; return { answer: String(f.nCands), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'dt_gain1', label: '搜出的第一刀的信息增益',
        ask: '根节点搜遍所有候选后选中第一刀(x<0),它的信息增益是多少?(切前 Gini 0.375 − 切后加权 Gini 0.25)',
        kind: 'number',
        compute: t => { const f = t.find(x => x.phase === 'search' && (x.splits as unknown[]).length === 0)!; const b = f.best as { gain: number }; return { answer: String(b.gain), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
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
    id: 'mvcc',
    title: 'MVCC 快照读',
    kernel: mvccKernel as Kernel<unknown>,
    doc: trivialDoc('mvcc'),
    facts: [
      {
        id: 'reread', label: '快照隔离下 T1 第二次读到的值',
        ask: 'MVCC 可重复读：T1、T2 同时开始，T1 先读 x=100，随后 T2 把 x 改成 200 并提交。T1 再次读 x，读到的值是多少?',
        kind: 'number',
        compute: t => {
          const reads = t.filter(f => f.op === 'read')
          const f = reads[reads.length - 1] ?? last(t)
          return { answer: String(f.readValue), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: () => ['200', '150', '50'],
      },
      {
        id: 'versions', label: '调度结束后 x 的版本数',
        ask: 'MVCC 写不覆盖旧值而是追加版本。这个调度全部结束后，行 x 一共有多少个版本?',
        kind: 'number',
        compute: t => ({ answer: String((last(t).versions as unknown[]).length), step: t.length - 1, evidence: `版本链长度 = ${(last(t).versions as unknown[]).length}` }),
        distractors: numDistractors,
      },
    ],
  },
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
    id: 'iso',
    title: '事务隔离级别',
    kernel: isoKernel as Kernel<unknown>,
    // 与 registry defaultDoc 一致:读已提交。
    doc: { kind: 'iso', params: { level: '读已提交' }, entities: [], streams: [] },
    facts: [
      {
        id: 'rc_third_read', label: '读已提交下 T1 第三次读到的值',
        ask: '读已提交(RC)隔离级别下：T1 读 x=100，之后 T2 把 x 改成 200 并提交，T1 第三次读 x 读到多少?',
        kind: 'number',
        compute: t => {
          const reads = t.filter(f => f.op === 'read')
          const f = reads[reads.length - 1] ?? last(t)
          return { answer: String(f.readValue), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: () => ['100', '150', '0'],
      },
      {
        id: 'rc_anomaly', label: '读已提交挡不住的读现象',
        ask: '读已提交(RC)能挡住脏读，但挡不住下面哪一种读现象?',
        kind: 'choice',
        compute: () => ({ answer: '不可重复读', step: 0, evidence: 'RC 只读已提交值→无脏读；但两次读之间别的事务提交了新值→不可重复读' }),
        distractors: () => ['脏读', '幻读', '三种都能挡住'],
      },
    ],
  },
  {
    id: 'cas',
    title: 'CAS 无锁自增',
    kernel: casKernel as Kernel<unknown>,
    doc: trivialDoc('cas'),
    facts: [
      {
        id: 'final_x', label: '3 线程 CAS 自增后的最终值',
        ask: '3 个线程各用 CAS 做一次 x++（x 初值 0），期间有线程读到旧值发生竞争。CAS 保证不丢更新，最终 x 等于多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).x), step: t.length - 1, evidence: `终值 x=${last(t).x}、成功 ${last(t).succeeds} 次` }),
        distractors: () => ['2', '1', '4'],
      },
      {
        id: 'retries', label: 'CAS 失败重试次数',
        ask: '上题中，因为被别的线程抢先修改，CAS 一共失败并重试了多少次?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).fails), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'mesi',
    title: 'MESI 缓存一致性',
    kernel: mesiKernel as Kernel<unknown>,
    doc: trivialDoc('mesi'),
    facts: [
      {
        id: 'invalidations', label: '缓存行被失效的总次数',
        ask: 'MESI 协议：两个核对同一个 x 交替读写。整个过程里，缓存行副本一共被失效(Invalidate)了多少次?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).invalidated), step: t.length - 1, evidence: `终态 invalidated=${last(t).invalidated}` }),
        distractors: numDistractors,
      },
      {
        id: 'write_invalidate', label: '一个核写时其它核副本的状态',
        ask: 'MESI 里，某个核要写 x 时，会先把其它核持有的这个缓存行副本置为哪个状态?',
        kind: 'choice',
        compute: () => ({ answer: 'I（Invalid 失效）', step: 0, evidence: '写前先 Invalidate 其它副本，自己升 M' }),
        distractors: () => ['S（Shared 共享）', 'E（Exclusive 独占）', 'M（Modified 已改）'],
      },
    ],
  },
  {
    id: 'deadlock',
    title: '死锁检测',
    kernel: deadlockKernel as Kernel<unknown>,
    doc: trivialDoc('deadlock'),
    facts: [
      {
        id: 'cycle_len', label: '死锁环上的线程数',
        ask: '三个线程交叉加锁：T1 持 A 等 B、T2 持 B 等 C、T3 持 C 等 A。用等待图检测，死锁环上一共有几个线程?',
        kind: 'number',
        compute: t => {
          const cyc = last(t).cycle as number[]
          return { answer: String(cyc.length), step: t.length - 1, evidence: `环 = ${cyc.map(x => 'T' + x).join('→')}` }
        },
        distractors: () => ['2', '4', '1'],
      },
      {
        id: 'detect_vs_avoid', label: '等待图找环属于哪种死锁处理',
        ask: '用「等待图找环」来发现死锁，属于下面哪一种死锁处理策略?',
        kind: 'choice',
        compute: () => ({ answer: '死锁检测', step: 0, evidence: '先让死锁发生、再检测出来；银行家算法才是分配前判断的死锁避免' }),
        distractors: () => ['死锁避免（银行家算法）', '死锁预防', '鸵鸟策略（不处理）'],
      },
    ],
  },
  {
    id: 'raft',
    title: 'Raft 共识',
    kernel: raftKernel as Kernel<unknown>,
    doc: trivialDoc('raft'),
    facts: [
      {
        id: 'majority', label: '3 节点集群的多数派门槛',
        ask: 'Raft 3 节点集群：选主要拿到几票才能当选 Leader、一条日志要复制到几个节点才能提交?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).majority), step: t.length - 1, evidence: `多数派 = ⌊3/2⌋+1 = ${last(t).majority}` }),
        distractors: () => ['3', '1', '4'],
      },
      {
        id: 'commit_rule', label: '日志何时算已提交',
        ask: 'Raft 里，一条日志什么时候才算「已提交(committed)」、可以安全应用到状态机?',
        kind: 'choice',
        compute: () => ({ answer: '被复制到多数派(过半)节点后', step: 0, evidence: '复制到过半即提交；任何两个多数派必有交集，保证不丢' }),
        distractors: () => ['Leader 写入自己日志后', '所有节点都复制后', '客户端收到确认后'],
      },
    ],
  },
  {
    id: 'caesar',
    title: '凯撒密码',
    kernel: caesarKernel as Kernel<unknown>,
    doc: trivialDoc('caesar'),
    facts: [
      {
        id: 'cipher', label: 'HELLO 用 k=3 加密的结果',
        ask: '凯撒密码，密钥 k=3（每个字母后移 3 位）：明文 HELLO 加密后是什么?',
        kind: 'choice',
        compute: t => ({ answer: String(last(t).cipher), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['EBIIL', 'KHOOS', 'IFMMP'],
      },
      {
        id: 'keyspace', label: '凯撒密码的密钥空间大小',
        ask: '凯撒密码一共只有多少种不同的密钥（因此暴力破解极其容易）?',
        kind: 'number',
        compute: () => ({ answer: '25', step: 0, evidence: '26 个字母，位移 1~25 共 25 种有效密钥（0 位移=不加密）' }),
        distractors: () => ['26', '52', '128'],
      },
    ],
  },
  {
    id: 'vigenere', title: '维吉尼亚密码', kernel: vigenereKernel as Kernel<unknown>, doc: trivialDoc('vigenere'),
    facts: [{
      id: 'cipher', label: 'HELLO 用关键词 KEY 加密的结果',
      ask: '维吉尼亚密码，关键词 KEY（循环）：明文 HELLO 加密后是什么?', kind: 'choice',
      compute: t => ({ answer: String(last(t).cipher), step: t.length - 1, evidence: String(last(t).log ?? '') }),
      distractors: () => ['RIJVX', 'HIJVS', 'KHOOR'],
    }],
  },
  {
    id: 'xor', title: '异或加密', kernel: xorKernel as Kernel<unknown>, doc: trivialDoc('xor'),
    facts: [{
      id: 'selfinverse', label: '异或加密如何解密',
      ask: '异或加密：密文 = 明文 XOR 密钥。要把密文解回明文，该怎么做?', kind: 'choice',
      compute: () => ({ answer: '密文再 XOR 同一个密钥', step: 0, evidence: '异或自反：c XOR k XOR k = m' }),
      distractors: () => ['密文 XOR 反转的密钥', '密文减去密钥', '密文再加密一次'],
    }],
  },
  {
    id: 'modpow', title: '快速模幂', kernel: modpowKernel as Kernel<unknown>, doc: trivialDoc('modpow'),
    facts: [{
      id: 'result', label: '3^13 mod 7 的值',
      ask: '用快速模幂计算 3^13 mod 7，结果是多少?', kind: 'number',
      compute: t => ({ answer: String(last(t).result), step: t.length - 1, evidence: String(last(t).log ?? '') }),
      distractors: () => ['2', '5', '1'],
    }],
  },
  {
    id: 'diffiehellman', title: 'DH 密钥交换', kernel: dhKernel as Kernel<unknown>, doc: trivialDoc('diffiehellman'),
    facts: [{
      id: 'shared', label: 'DH 双方算出的共享密钥',
      ask: 'Diffie-Hellman：p=23、g=5，Alice 私钥 a=6、Bob 私钥 b=15。双方算出的共享密钥是多少?', kind: 'number',
      compute: t => ({ answer: String(last(t).aliceShared), step: t.length - 1, evidence: String(last(t).log ?? '') }),
      distractors: () => ['8', '19', '5'],
    }],
  },
  {
    id: 'rsa', title: 'RSA 公钥加密', kernel: rsaKernel as Kernel<unknown>, doc: trivialDoc('rsa'),
    facts: [
      {
        id: 'privkey', label: 'RSA 私钥 d',
        ask: 'RSA：p=3、q=11、e=3。私钥 d 满足 e·d≡1 (mod φ)，φ=(p-1)(q-1)。d 等于多少?', kind: 'number',
        compute: t => ({ answer: String(last(t).d), step: t.length - 1, evidence: `φ=${last(t).phi}，${last(t).e}·d≡1 → d=${last(t).d}` }),
        distractors: () => ['3', '11', '20'],
      },
      {
        id: 'cipher', label: 'RSA 加密 m=4 的密文',
        ask: 'RSA：n=33、e=3，明文 m=4。密文 c=m^e mod n 是多少?', kind: 'number',
        compute: t => ({ answer: String(last(t).c), step: t.length - 1, evidence: `4^3 mod 33 = 64 mod 33 = ${last(t).c}` }),
        distractors: () => ['64', '4', '27'],
      },
    ],
  },
  {
    id: 'extgcd', title: '扩展欧几里得求模逆', kernel: extgcdKernel as Kernel<unknown>, doc: trivialDoc('extgcd'),
    facts: [{
      id: 'inverse', label: '3 关于模 20 的逆元',
      ask: '用扩展欧几里得求 3 关于模 20 的逆元 d（使 3·d ≡ 1 mod 20），d 等于多少?', kind: 'number',
      compute: t => ({ answer: String(last(t).result), step: t.length - 1, evidence: String(last(t).log ?? '') }),
      distractors: () => ['13', '3', '9'],
    }],
  },
  {
    id: 'signature', title: '数字签名', kernel: signKernel as Kernel<unknown>, doc: trivialDoc('signature'),
    facts: [{
      id: 'who', label: '数字签名用哪个钥签、哪个钥验',
      ask: '数字签名（与加密相反）：签名和验证分别用什么钥?', kind: 'choice',
      compute: () => ({ answer: '私钥签名、公钥验证', step: 0, evidence: '只有私钥持有者签得出，任何人用公钥都能验' }),
      distractors: () => ['公钥签名、私钥验证', '都用私钥', '都用公钥'],
    }],
  },
  {
    id: 'hashaval', title: '哈希雪崩效应', kernel: hashavalKernel as Kernel<unknown>, doc: trivialDoc('hashaval'),
    facts: [{
      id: 'flipped', label: 'cat→cot 后 16 位哈希翻转的位数',
      ask: '哈希雪崩：把 "cat" 改成 "cot"（一个字母），16 位哈希翻转了多少位?', kind: 'number',
      compute: t => { const f = t.find(x => x.b === 'cot') ?? last(t); return { answer: String(f.flipped), step: t.indexOf(f), evidence: `cat→cot 翻转 ${f.flipped}/16 位，约一半` } },
      distractors: answer => { const f = Number(answer); return [String(f + 2), String(Math.max(0, f - 3)), '1'] },
    }],
  },
  {
    id: 'merkle', title: 'Merkle 树', kernel: merkleKernel as Kernel<unknown>, doc: trivialDoc('merkle'),
    facts: [{
      id: 'verify_cost', label: '验证一个块需要几个兄弟哈希',
      ask: 'Merkle 树最大的好处：验证某一个数据块没被改，需要多少个哈希（n 个块）?', kind: 'choice',
      compute: () => ({ answer: 'O(log n) 个兄弟哈希', step: 0, evidence: '沿路径到根，每层一个兄弟，不用下载全部数据' }),
      distractors: () => ['全部 n 个块的哈希', '只要根哈希 1 个', 'O(n) 个'],
    }],
  },
  {
    id: 'crt', title: '中国剩余定理', kernel: crtKernel as Kernel<unknown>, doc: trivialDoc('crt'),
    facts: [{
      id: 'x', label: '除3余2、除5余3、除7余2 的数',
      ask: '一个数除以 3 余 2、除以 5 余 3、除以 7 余 2。用中国剩余定理，这个数(0~104 内)是几?', kind: 'number',
      compute: t => ({ answer: String(last(t).x), step: t.length - 1, evidence: String(last(t).log ?? '') }),
      distractors: () => ['128', '17', '52'],
    }],
  },
  {
    id: 'fermat', title: '费马素性测试', kernel: fermatKernel as Kernel<unknown>, doc: trivialDoc('fermat'),
    facts: [{
      id: 'verdict', label: '费马测试对 15 的判定',
      ask: '费马素性测试：2^14 mod 15 = 4 ≠ 1。这说明 15 是什么?', kind: 'choice',
      compute: () => ({ answer: '一定是合数', step: 0, evidence: 'a^(n-1) mod n ≠ 1 是合数的铁证' }),
      distractors: () => ['一定是素数', '可能是素数', '无法判断'],
    }],
  },
  {
    id: 'salt', title: '盐与密码哈希', kernel: saltKernel as Kernel<unknown>, doc: trivialDoc('salt'),
    facts: [{
      id: 'why', label: '加盐的作用',
      ask: '存密码哈希时为什么要「加盐」(每个用户配一个随机盐再哈希)?', kind: 'choice',
      compute: () => ({ answer: '让相同密码的哈希也不同，使彩虹表失效', step: 0, evidence: '盐打散哈希，攻击者必须对每个盐单独暴力' }),
      distractors: () => ['让哈希更快', '让密码更短', '让密码可以解密还原'],
    }],
  },
  {
    id: 'tokenbucket', title: '令牌桶限流', kernel: tokenbucketKernel as Kernel<unknown>, doc: trivialDoc('tokenbucket'),
    facts: [{
      id: 'total', label: '令牌桶放行的请求总数',
      ask: '令牌桶：容量 5、速率 1/tick，各刻到达 [3,4,2,1,5]。一共放行了多少个请求?', kind: 'number',
      compute: t => ({ answer: String(last(t).totalAllowed), step: t.length - 1, evidence: `放行 ${last(t).totalAllowed}、拒绝 ${last(t).totalRejected}` }),
      distractors: () => ['15', '5', '6'],
    }],
  },
  {
    id: 'consistenthash', title: '一致性哈希', kernel: consistentHashKernel as Kernel<unknown>, doc: trivialDoc('consistenthash'),
    facts: [{
      id: 'moved', label: '加节点后需要搬动的键数',
      ask: '一致性哈希：环上原有 3 个节点、4 个键。加入 1 个新节点后，大约需要搬动多少个键（对比 hash%N 几乎全搬）?', kind: 'choice',
      compute: () => ({ answer: '只搬一小段（本例 1 个）', step: 0, evidence: '只有新节点到前一节点之间的键需要重新归属' }),
      distractors: () => ['几乎所有键（和 hash%N 一样）', '全部 4 个', '0 个'],
    }],
  },
  {
    id: 'skiplist', title: '跳表 Skip List', kernel: skiplistKernel as Kernel<unknown>, doc: trivialDoc('skiplist'),
    facts: [{
      id: 'complexity', label: '跳表查找的平均复杂度',
      ask: '跳表（多层索引链表）查找一个值的平均时间复杂度是?', kind: 'choice',
      compute: () => ({ answer: 'O(log n)', step: 0, evidence: '高层快车道跳过大段节点，逐层逼近' }),
      distractors: () => ['O(n)', 'O(1)', 'O(n log n)'],
    }],
  },
  {
    id: 'twopc', title: '两阶段提交 2PC', kernel: twopcKernel as Kernel<unknown>, doc: trivialDoc('twopc'),
    facts: [{
      id: 'commit_cond', label: '2PC 何时提交',
      ask: '两阶段提交：协调者在阶段二什么情况下才广播 Commit（否则全体 Abort）?', kind: 'choice',
      compute: () => ({ answer: '所有参与者阶段一都投 Yes', step: 0, evidence: '只要有一个 No 或超时就 Abort' }),
      distractors: () => ['多数参与者投 Yes', '协调者自己决定', '第一个参与者投 Yes'],
    }],
  },
  {
    id: 'otpreuse', title: '一次一密密钥重用', kernel: otpreuseKernel as Kernel<unknown>, doc: trivialDoc('otpreuse'),
    facts: [{
      id: 'leak', label: '同密钥加密两消息，异或密文得到什么',
      ask: '一次一密用同一个密钥 k 加密了两条消息(c1=m1⊕k, c2=m2⊕k)。攻击者把两段密文异或 c1⊕c2，得到什么?', kind: 'choice',
      compute: () => ({ answer: 'm1⊕m2（密钥被抵消，泄露明文关系）', step: 0, evidence: 'k⊕k=0，剩下 m1⊕m2' }),
      distractors: () => ['密钥 k', '乱码，什么也得不到', 'm1 和 m2'],
    }],
  },
  {
    id: 'wal', title: '预写日志 WAL', kernel: walKernel as Kernel<unknown>, doc: trivialDoc('wal'),
    facts: [{
      id: 'order', label: 'WAL 的核心规则',
      ask: '预写日志(WAL)保证持久性的核心规则是什么?', kind: 'choice',
      compute: () => ({ answer: '先把操作写入日志并落盘，再改数据页', step: 0, evidence: '日志落盘后崩溃可重放恢复' }),
      distractors: () => ['先改数据页，再写日志', '数据和日志同时写', '只写数据不写日志'],
    }],
  },
  {
    id: 'lsm', title: 'LSM-Tree', kernel: lsmKernel as Kernel<unknown>, doc: trivialDoc('lsm'),
    facts: [{
      id: 'why_fast', label: 'LSM-Tree 写得快的原因',
      ask: 'LSM-Tree(LevelDB/RocksDB 用)为什么写入这么快?', kind: 'choice',
      compute: () => ({ answer: '写进内存表、满了整块顺序刷盘，把随机写变顺序写', step: 0, evidence: '避免了改磁盘 B+树的随机写' }),
      distractors: () => ['直接原地改磁盘 B+树', '不落盘只在内存', '用更快的哈希'],
    }],
  },
  {
    id: 'minikv', title: '迷你 KV 存储', kernel: minikvKernel as Kernel<unknown>, doc: trivialDoc('minikv'),
    facts: [
      {
        id: 'bloom_role', label: '布隆过滤器在读路径上的作用',
        ask: 'LSM 型 KV 存储的读路径上，布隆过滤器起什么作用?', kind: 'choice',
        compute: () => ({ answer: '布隆说"一定不在"时直接返回，省掉查磁盘 SSTable 的 I/O', step: 0, evidence: 'get(z) 被布隆挡下，不查盘' }),
        distractors: () => ['加密存储的键', '给键排序', '压缩 SSTable'],
      },
      {
        id: 'write_path', label: 'KV 写入的第一步',
        ask: '这个迷你 KV 存储执行 put(k,v) 时，第一步做什么（保证宕机不丢）?', kind: 'choice',
        compute: () => ({ answer: '先写 WAL 日志并落盘', step: 0, evidence: '先日志后数据，崩溃可重放' }),
        distractors: () => ['先写进 SSTable', '先更新布隆过滤器', '先分片到其它节点'],
      },
      {
        id: 'newest_wins', label: 'LSM 更新后 get 读到哪个版本',
        ask: 'LSM 存储里，key a 先写 1、后又写 9（两个版本在不同 SSTable）。get(a) 读到几?', kind: 'number',
        compute: t => {
          const reads = (t as { op?: string; result?: string }[]).filter(f => f.op === 'get' && f.result && f.result !== '不存在')
          return { answer: String(reads[0]?.result ?? 9), step: 0, evidence: '读时从新到旧扫 SSTable，最新版本先命中' }
        },
        distractors: () => ['1', '报错', '0'],
      },
    ],
  },
  {
    id: 'urlshortener', title: '设计短链系统', kernel: urlshortenerKernel as Kernel<unknown>, doc: trivialDoc('urlshortener'),
    facts: [
      {
        id: 'shortcode', label: '短码生成为什么用发号器+Base62',
        ask: '短链的短码生成，为什么推荐「唯一发号器 + Base62 编码」，而不是「哈希长链」或「十进制自增明文」?', kind: 'choice',
        compute: () => ({ answer: '发号器发自增 ID 天然唯一、不碰撞；Base62 把 ID 编码得又短（1亿→"6LAze"只5位）。哈希会碰撞要处理冲突，十进制明文能被顺号爬遍且更长', step: 1, evidence: 'URL#1 发号 100000000 → Base62 逐位编码 → "6LAze"；62^6≈568亿够用' }),
        distractors: () => ['哈希更快所以更好', '发号器不需要唯一性', '直接用十进制自增明文最简单'],
      },
      {
        id: 'base62_reversible', label: '短码怎么跳回长 URL',
        ask: '用户访问短码（如 /6LAze），系统怎么找回原来的长 URL?', kind: 'choice',
        compute: () => ({ answer: '把短码 Base62 解码回 ID（按 62 进制累加，正好等于当初发的号，可逆），拿 ID 查映射表得长 URL，返回 302 跳转', step: 4, evidence: '"6LAze" 解码 = 100000000 = 发号时的 ID；编码/解码是可逆的一对' }),
        distractors: () => ['遍历所有长 URL 挨个哈希比对', '短码里直接存了长 URL', '每次都重新发一个号'],
      },
    ],
  },
  {
    id: 'seckill', title: '设计秒杀系统', kernel: seckillKernel as Kernel<unknown>, doc: trivialDoc('seckill'),
    facts: [
      {
        id: 'why_oversell', label: 'naive 扣库存为什么超卖',
        ask: '库存 2 件、3 个请求同抢，naive「读库存→判>0→写回」为什么会卖出 3 件(超卖)?', kind: 'choice',
        compute: () => ({ answer: '读-判-写三步不是原子的：R3 在 R2 写回之前就读了库存、读到同一个旧值 1，两个请求都判 1>0 成立、各扣一次 → 库存 -1、卖出 3', step: 6, evidence: 'naive 幕真跑出：库存 = -1、卖出 = 3（初始只有 2）' }),
        distractors: () => ['库存数配置写错了', 'Redis 太慢没扣及时', '请求数超过库存所以必然超卖'],
      },
      {
        id: 'atomic_fix', label: '原子 DECR 怎么防超卖',
        ask: '同样库存 2、3 个请求同抢，怎么改才绝不超卖?', kind: 'choice',
        compute: () => ({ answer: 'Redis 原子 DECR：把读-判-写合成一个不可打断的操作，DECR 返回值 <0 就回滚拒绝；同批请求卖出恰好 2、不超卖。落库再用 DB 乐观锁 where stock>0 兜底', step: 10, evidence: '原子幕：R1→1、R2→0 都抢到，R3→-1 回滚拒绝，卖出 = 2' }),
        distractors: () => ['直接 UPDATE 数据库库存', '加分布式锁串行下单', '前端限制点击就够了'],
      },
    ],
  },
  {
    id: 'minisearch', title: 'mini 搜索引擎', kernel: minisearchKernel as Kernel<unknown>, doc: trivialDoc('minisearch'),
    facts: [
      {
        id: 'idf_rare', label: '为什么稀有词排名更靠前',
        ask: '语料 D1「猫爱吃鱼」D2「狗爱吃肉」D3「猫猫玩鱼」，查询「猫 狗」。为什么只含一个词"狗"的 D2 反而排第一?', kind: 'choice',
        compute: () => ({ answer: '"狗"只在 1 篇出现(df=1)，idf=ln(3/1)=1.10 远高于"猫"的 ln(3/2)=0.41——稀有词更能区分相关性', step: 8, evidence: 'score(D2)=1×1.10=1.10 > score(D3)=2×0.41=0.81 > score(D1)=1×0.41=0.41' }),
        distractors: () => ['因为 D2 文档最短', '因为"狗"笔画多', '因为 D2 排在最后'],
      },
      {
        id: 'tf_freq', label: '词频对排名的影响',
        ask: 'D1 和 D3 都含查询词"猫"，为什么 D3 排在 D1 前面?', kind: 'choice',
        compute: () => ({ answer: '"猫"在 D3 出现 2 次(tf=2)、在 D1 出现 1 次(tf=1)，score=tf×idf，词频高→更相关', step: 8, evidence: 'score(D3,猫项)=2×0.41=0.81 > score(D1,猫项)=1×0.41=0.41' }),
        distractors: () => ['D3 的 idf 更高', 'D3 含更多查询词', '两者其实一样，随机排的'],
      },
    ],
  },
  {
    id: 'mqdesign', title: '设计消息队列', kernel: mqdesignKernel as Kernel<unknown>, doc: trivialDoc('mqdesign'),
    facts: [
      {
        id: 'ordering', label: '消息队列怎么保证顺序',
        ask: '要让同一个订单(同 key)的消息被顺序消费，消息队列怎么做?', kind: 'choice',
        compute: () => ({ answer: '只保证单个分区内有序；按 key 哈希路由到固定分区，同 key 消息就都进同一分区、按追加顺序天然有序。全局有序做不到（除非只用一个分区、牺牲并行）', step: 3, evidence: '本例 key=A 的下单#1、付款#1 都 hash 到分区1、offset 0 和 1，顺序不乱' }),
        distractors: () => ['全局所有分区都有序', '加副本就能保序', '消费者随机拉取即可'],
      },
      {
        id: 'offset_pubsub', label: '消息读走为什么不删除、offset 是谁的',
        ask: 'G1 已经消费过某条消息了，为什么换个消费组 G2 还能读到它?', kind: 'choice',
        compute: () => ({ answer: '消息读走不删除、一直留在日志里；"读到哪"是每个消费组自己记的 offset，各组独立。所以同一条消息被每个组各消费一遍(发布订阅)，把 offset 往回拨还能重放', step: 11, evidence: '本例 G1 把分区1读到 offset 3 后，G2 从 offset 0 照样读到「下单#1」' }),
        distractors: () => ['G2 读的是副本备份', '系统又重新生产了一条', 'offset 是全局共享的、G2 会跳过已读的'],
      },
    ],
  },
  {
    id: 'ecbcbc', title: 'ECB vs CBC 工作模式', kernel: ecbcbcKernel as Kernel<unknown>, doc: trivialDoc('ecbcbc'),
    facts: [
      {
        id: 'ecb_leak', label: '为什么 ECB 会泄露明文 pattern',
        ask: '明文里有重复块(P1=P3=1010)。为什么 ECB 模式加密后 C1 和 C3 也一模一样、把重复暴露了?', kind: 'choice',
        compute: () => ({ answer: 'ECB 每块独立、确定性加密(C=E(P))，相同明文块必得相同密文块，所以 C1=C3=1100，明文的重复结构直接暴露', step: 5, evidence: 'ECB 密文=[1100,1010,1100,0101]，C1=C3；这就是"ECB 企鹅"，加密后轮廓还在' }),
        distractors: () => ['因为密钥太短', '因为块是 4-bit 太小', 'ECB 其实不会泄露，是巧合'],
      },
      {
        id: 'cbc_chain', label: 'CBC 靠什么把重复块打散',
        ask: '同样是重复明文块(P1=P3)，为什么 CBC 加密后 C1≠C3、不泄露重复?', kind: 'choice',
        compute: () => ({ answer: 'CBC 有链接：每块先和上一块密文异或再加密(C=E(P⊕C₋₁))，同样的明文块每次异或的密文都不同，所以 C1≠C3', step: 10, evidence: 'CBC 密文=[0011,1001,0101,0000]，C1=0011≠C3=0101；再配随机 IV 连第一块都随机化' }),
        distractors: () => ['CBC 用了更长的密钥', 'CBC 把块顺序打乱了', 'CBC 每块换一个密钥'],
      },
    ],
  },
  {
    id: 'birthday', title: '生日攻击', kernel: birthdayKernel as Kernel<unknown>, doc: trivialDoc('birthday'),
    facts: [
      {
        id: 'sqrt_n', label: '找哈希碰撞大约要多少次',
        ask: '一个 n 位哈希输出空间是 2ⁿ。找到"任意一对"输入产生相同哈希，大约要试多少次?', kind: 'choice',
        compute: () => ({ answer: '约 √(2ⁿ) = 2^(n/2) 次（生日攻击），远小于 2ⁿ，所以抗碰撞需要的位数是抗原像的两倍', step: 10, evidence: '23 人就让生日碰撞过半；256 位哈希碰撞难度只有 2¹²⁸' }),
        distractors: () => ['要 2ⁿ 次（穷举整个空间）', '要 2ⁿ⁻¹ 次（一半空间）', '要 n 次'],
      },
      {
        id: 'why_fast', label: '为什么碰撞概率涨得比直觉快',
        ask: 'N=365 天，为什么只要 23 人就有过半概率两人同天生日（不用 183 人）?', kind: 'choice',
        compute: () => ({ answer: '比的是"任意一对"是否相同，对数是 C(k,2)≈k²/2，随人数平方增长，所以概率在约 √N 处就过半', step: 6, evidence: 'k=23 时可相撞的对有 253 对，碰撞概率 50.7%' }),
        distractors: () => ['因为每个人都和固定某一天比', '因为 365 天其实不够多', '巧合，换个数就不成立'],
      },
    ],
  },
  {
    id: 'aesround', title: 'AES 一轮', kernel: aesroundKernel as Kernel<unknown>, doc: trivialDoc('aesround'),
    facts: [
      {
        id: 'confuse_diffuse', label: 'AES 一轮四步分别负责什么',
        ask: 'AES 一轮的四步 SubBytes / ShiftRows / MixColumns / AddRoundKey，哪个负责"混淆"、哪些负责"扩散"?', kind: 'choice',
        compute: () => ({ answer: 'SubBytes(查S盒,非线性)负责混淆；ShiftRows(行移位)和 MixColumns(列GF混合)负责扩散；AddRoundKey 把密钥异或进来', step: 5, evidence: '混淆让密文↔密钥关系乱、扩散让一个明文位影响多个密文位；10 轮叠加后每位密文依赖所有明文和密钥位' }),
        distractors: () => ['AddRoundKey 负责混淆', 'SubBytes 负责扩散、MixColumns 负责混淆', '四步都只是异或'],
      },
      {
        id: 'sbox_nonlinear', label: 'AES 唯一的非线性步骤',
        ask: 'AES 一轮里哪一步是唯一的非线性变换（去掉它整个密码就会被线性代数破掉）?', kind: 'choice',
        compute: () => ({ answer: 'SubBytes——逐字节查 S-盒(GF(2⁸)求逆+仿射)，是唯一的非线性步骤；ShiftRows/MixColumns/AddRoundKey 都是线性的', step: 2, evidence: '没有 S-盒的非线性，密码退化成线性方程组，可被直接解出' }),
        distractors: () => ['MixColumns', 'ShiftRows', 'AddRoundKey'],
      },
    ],
  },
  {
    id: 'hmac', title: 'HMAC 消息认证', kernel: hmacKernel as Kernel<unknown>, doc: trivialDoc('hmac'),
    facts: [
      {
        id: 'why_nested', label: 'HMAC 为什么要两层嵌套而不是 H(K‖m)',
        ask: '给消息盖认证标签，为什么不直接用 H(K‖m)，而要 HMAC 的两层嵌套 H((K⊕opad)‖H((K⊕ipad)‖m))?', kind: 'choice',
        compute: () => ({ answer: '很多哈希(Merkle-Damgård 结构)有长度扩展攻击：知道 H(K‖m) 就能算出 H(K‖m‖…) 而不需要 K；HMAC 用外层再哈希一次把这条路堵死，密钥在内外各揉一次', step: 4, evidence: 'ipad/opad 让密钥参与内外两层，攻击者拿到最终标签也续不出新标签' }),
        distractors: () => ['两层只是为了更慢、增加破解成本', '嵌套能把密钥藏得更深所以更安全', '没区别，只是习惯写法'],
      },
      {
        id: 'tamper', label: 'HMAC 怎么同时防伪造和防篡改',
        ask: 'HMAC 标签是怎么让收方既挡住伪造、又发现消息被改的?', kind: 'choice',
        compute: () => ({ answer: '标签的计算需要密钥 K：没有 K 就算不出正确标签(防伪造)；消息改一个字节，收方用 K 重算的标签就和附带的对不上(防篡改)', step: 5, evidence: "m 从 'Hi' 改成 'Hj'，重算 HMAC=06≠原 05，收方拒收" }),
        distractors: () => ['靠把消息加密隐藏起来', '靠标签里带一个时间戳', '靠消息本身够长'],
      },
    ],
  },
  {
    id: 'totp', title: 'TOTP 动态口令', kernel: totpKernel as Kernel<unknown>, doc: trivialDoc('totp'),
    facts: [
      {
        id: 'offline_same', label: '手机和服务器不通信怎么算出同一个码',
        ask: 'TOTP 里手机和服务器不联网对表，为什么能各自算出同一个 6 位码?', kind: 'choice',
        compute: () => ({ answer: '两边都有同一个共享密钥 K，又都看当前时间：码 = 截断(HMAC(K, ⌊t/30⌋))，同一个时间窗算出同一个码，全程不用传密钥、不用通信', step: 4, evidence: 't=30s 时手机与服务器都算窗口 T=1 → 都得 094198' }),
        distractors: () => ['手机每次把码发给服务器存起来', '服务器提前把所有码发给手机', '靠联网实时同步'],
      },
      {
        id: 'window_change', label: '码为什么每 30 秒变一次',
        ask: 'TOTP 的码为什么在 30 秒内不变、过 30 秒就换一个?', kind: 'choice',
        compute: () => ({ answer: '码只取决于时间窗 T=⌊t/30⌋：同一个 30 秒内 T 不变→码不变(给你时间输入)；跨到下一窗口 T+1→HMAC 全变→新码(旧码作废)', step: 3, evidence: 't=0/15/29s 同在窗口0→790815；t=30s 进窗口1→094198' }),
        distractors: () => ['码是随机生成的，正好 30 秒换', '手机内置了一张 30 秒一换的码表', '服务器每 30 秒推一个新码给手机'],
      },
    ],
  },
  {
    id: 'snowflake', title: '雪花算法分布式ID', kernel: snowflakeKernel as Kernel<unknown>, doc: trivialDoc('snowflake'),
    facts: [
      {
        id: 'no_coord', label: '多台机器不协调怎么保证 ID 不撞',
        ask: '分布式下每台机器都本地发 ID、彼此不通信，Snowflake 怎么保证全局不重复?', kind: 'choice',
        compute: () => ({ answer: '64 位里有一段"机器码"：每台机器的机器码不同，即使同一毫秒同一序号，拼出的 ID 也因机器码段不同而不同，所以不同机器绝不相撞、无需协调', step: 5, evidence: '机器码=dc<<5|worker，本机=34；这段嵌在 ID 中间' }),
        distractors: () => ['每台机器发 ID 前都去问中心发号器', '靠随机数碰运气不重复', '所有机器共用一个全局锁'],
      },
      {
        id: 'monotonic', label: 'Snowflake 的 ID 为什么趋势递增',
        ask: 'Snowflake 生成的 ID 为什么"越晚生成越大"（趋势递增），这有什么用?', kind: 'choice',
        compute: () => ({ answer: '毫秒时间戳放在最高位，所以时间越晚 ID 整体越大；对数据库 B+树索引友好——插入几乎是顺序追加，不会到处分裂页', step: 4, evidence: 't=1000→ID≈41.9亿，t=1001→ID≈41.99亿，时间戳一增 ID 跳一大截' }),
        distractors: () => ['因为序号一直自增不清零', '因为机器码每次都变大', '其实是随机的，不保证递增'],
      },
    ],
  },
  {
    id: 'vectorclock', title: '向量时钟', kernel: vectorclockKernel as Kernel<unknown>, doc: trivialDoc('vectorclock'),
    facts: [
      {
        id: 'causal_vs_concurrent', label: '怎么判两个事件是因果还是并发',
        ask: '向量时钟里，怎么判断事件 a 和 b 是"有先后因果"还是"并发"?', kind: 'choice',
        compute: () => ({ answer: 'V(a) 每一位都 ≤ V(b) 且不全等 → a 因果先于 b；若两个向量互相都不 ≤ 对方 → 二者并发（谁也没影响谁）', step: 7, evidence: 'a[1,0,0] 每位≤e[2,2,1]→a→e因果；f[3,0,0] 与 e[2,2,1] 互不≤→并发' }),
        distractors: () => ['比向量各位之和，大的在后', '比物理时间戳谁早', '比第一位 P0 谁大'],
      },
      {
        id: 'recv_rule', label: '收到消息时向量怎么更新',
        ask: '一个进程收到别人发来的消息（带着对方的向量）时，自己的向量时钟怎么更新?', kind: 'choice',
        compute: () => ({ answer: '逐位取 max(本地向量, 收到的向量)，把对方"见过的进度"并进来，然后再把自己那一位 +1', step: 5, evidence: 'P2 收到 [2,2,0]：max([0,0,0],[2,2,0])=[2,2,0]，再自己+1 → [2,2,1]' }),
        distractors: () => ['直接用收到的向量覆盖自己的', '只把自己那位 +1，忽略收到的', '逐位相加两个向量'],
      },
    ],
  },
  {
    id: 'quorum', title: 'Quorum NWR', kernel: quorumKernel as Kernel<unknown>, doc: trivialDoc('quorum'),
    facts: [
      {
        id: 'wr_gt_n', label: 'W+R>N 为什么能保证读到最新',
        ask: 'N=5 份副本，写 W=3 份、读 R=3 份。为什么这样一定能读到最新写?', kind: 'choice',
        compute: () => ({ answer: 'W+R=6>N=5，由鸽巢原理，读的 3 份和写的 3 份在 5 份里必有至少 1 份重叠；那份带着最新写，读取最新版本就一定读到它', step: 4, evidence: '写集{R0,R1,R2}、读集{R2,R3,R4}重叠 R2，R2 是最新 v2' }),
        distractors: () => ['因为写了多数派副本就够了', '因为读的时候会自动同步所有副本', '因为版本号会广播给所有副本'],
      },
      {
        id: 'tunable', label: 'NWR 三个旋钮怎么权衡',
        ask: 'Quorum 的 N/W/R 三个值是可调的，调它们在权衡什么?', kind: 'choice',
        compute: () => ({ answer: '在一致性和读写延迟之间权衡：W 大写慢读快、R 大读慢写快、W=R=N 最强一致但最慢、W+R≤N 最快但可能读到旧值', step: 5, evidence: 'R 调到 2 时 W+R=5≤5，读集{R3,R4}可能零重叠、读到旧 v1' }),
        distractors: () => ['只调容错能力，和一致性无关', '调副本存在哪个机房', 'W/R 越大一定越好'],
      },
    ],
  },
  {
    id: 'circuitbreaker', title: '熔断器状态机', kernel: circuitbreakerKernel as Kernel<unknown>, doc: trivialDoc('circuitbreaker'),
    facts: [
      {
        id: 'why_break', label: '熔断器 Open 态为什么"快速失败"',
        ask: '下游服务挂了，熔断器进入 Open 态后直接让请求快速失败、不打下游，这是为了什么?', kind: 'choice',
        compute: () => ({ answer: '避免级联雪崩：如果还一直打故障的下游，每个请求都卡到超时会耗光上游线程/连接池；快速失败既保护上游不被拖垮，也给下游喘息恢复的机会', step: 5, evidence: 'Open 态请求 fail-fast，根本不调用下游' }),
        distractors: () => ['为了让请求更快返回成功', '为了给下游发更多重试请求', '为了记录更多失败日志'],
      },
      {
        id: 'halfopen', label: 'Half-Open 态是干什么的',
        ask: '熔断器 Open 一段时间后进入 Half-Open 态，这个中间态的作用是?', kind: 'choice',
        compute: () => ({ answer: '放少量探测请求去试探下游恢复没有：探测成功就回 Closed 恢复正常，探测失败就退回 Open 再等——避免下游还没好就被全量流量再次打垮', step: 7, evidence: '探测请求成功 → 回 Closed 且失败计数清零' }),
        distractors: () => ['直接放全部流量进去试', '永久停在这个状态', '把所有历史失败请求重放一遍'],
      },
    ],
  },
  {
    id: 'joins', title: '三种 JOIN 算法', kernel: joinsKernel as Kernel<unknown>, doc: trivialDoc('joins'),
    facts: [
      {
        id: 'nlj_cost', label: '嵌套循环 JOIN 为什么表大就爆',
        ask: 'Nested Loop Join（嵌套循环连接）在大表上为什么代价高?', kind: 'choice',
        compute: () => ({ answer: '它是外表每行都去内表整个扫一遍，比较次数 = |外表| × |内表|，即 O(N×M)——两张十万行的表就是百亿次比较', step: 1, evidence: '本例 3×4=12 次；没有索引时随表规模平方爆炸' }),
        distractors: () => ['因为要先给两表排序', '因为要建很大的哈希表', '因为它只支持等值连接'],
      },
      {
        id: 'hash_best', label: 'Hash Join 适合什么场景',
        ask: '大表之间的等值连接（=），优化器通常选哪种 JOIN 算法、为什么?', kind: 'choice',
        compute: () => ({ answer: 'Hash Join：对小表建哈希表(build)、大表逐行 O(1) 探测(probe)，总代价 O(N+M)，远小于嵌套循环的 O(N×M)；代价是只支持等值连接、要额外内存放哈希表', step: 3, evidence: '本例 建3+探4=7 次，远少于 NLJ 的 12' }),
        distractors: () => ['Nested Loop，因为不用预处理', 'Sort-Merge，因为一定要排序', 'Hash Join 只适合小表'],
      },
    ],
  },
  {
    id: 'compositeindex', title: '复合索引·最左前缀', kernel: compositeindexKernel as Kernel<unknown>, doc: trivialDoc('compositeindex'),
    facts: [
      {
        id: 'leftmost', label: '复合索引 idx(a,b,c) 什么查询用不上',
        ask: '有复合索引 idx(a,b,c)。WHERE b=? （只按 b 查）为什么用不上这个索引?', kind: 'choice',
        compute: () => ({ answer: '违反最左前缀：索引在 B+树里是先按 a 排、a 相同再按 b 排，只按 b 查无法在树里定位（b 是散的）；必须从最左列 a 起、连续命中的等值条件才能用', step: 4, evidence: 'WHERE b=? 用到前缀[]→全表扫；而 WHERE a=? 用到 (a)、WHERE a=?AND b=? 用到 (a,b)' }),
        distractors: () => ['因为 b 不是主键', '因为 b 的区分度不够', '因为要 SELECT 的列不在索引里'],
      },
      {
        id: 'covering', label: '覆盖索引免回表是什么意思',
        ask: 'SELECT a,b WHERE a=? 用到 idx(a,b,c) 时"不回表"，而 SELECT a,b,d 就要回表，为什么?', kind: 'choice',
        compute: () => ({ answer: '覆盖索引：SELECT 需要的列(a,b)都在索引里，直接从索引叶子拿到数据就够了；而 d 不在索引里，必须拿主键再去主键树捞整行（回表），多一次查找', step: 6, evidence: 'SELECT a,b,c 覆盖不回表；SELECT a,b,d 含索引外列 d → 回表' }),
        distractors: () => ['回表是因为 WHERE 条件不够', '回表是因为索引失效了', '两者其实都要回表'],
      },
    ],
  },
  {
    id: 'rwlock', title: '读写锁 RWLock', kernel: rwlockKernel as Kernel<unknown>, doc: trivialDoc('rwlock'),
    facts: [
      {
        id: 'share_exclusive', label: '读写锁比互斥锁强在哪',
        ask: '读写锁相比普通互斥锁（一次只放一个），并发上强在哪里?', kind: 'choice',
        compute: () => ({ answer: '多个读者可以同时持有读锁（读读共享），因为读不改数据、并发读安全；只有写者需要独占。读多写少时吞吐远高于互斥锁', step: 2, evidence: 'R1、R2 同时持读锁 {R1,R2}，读并发不互相阻塞' }),
        distractors: () => ['写操作也能并发执行', '它永远不会阻塞任何请求', '它不需要任何锁就能保证安全'],
      },
      {
        id: 'writer_wait', label: '有读者时写者为什么要等',
        ask: 'R1、R2 正持有读锁，这时 W1 请求写锁，为什么 W1 必须等待?', kind: 'choice',
        compute: () => ({ answer: '写要独占：写期间如果有人在读，读者会读到写了一半的中间状态。所以 W1 必须等所有读者都释放读锁后，才能独占进入', step: 3, evidence: 'W1 请求写时 readers={R1,R2}，进等待队列；R1、R2 都释放后 W1 才获准' }),
        distractors: () => ['因为 W1 优先级低', '因为写锁比读锁慢', '其实不用等，可以和读者并发'],
      },
    ],
  },
  {
    id: 'aba', title: 'ABA 问题', kernel: abaKernel as Kernel<unknown>, doc: trivialDoc('aba'),
    facts: [
      {
        id: 'why_aba', label: 'CAS 的 ABA 问题是怎么发生的',
        ask: 'CAS 明明检查了"当前值 == 我读到的旧值"，为什么还会被 ABA 骗?', kind: 'choice',
        compute: () => ({ answer: 'CAS 只比较值本身。如果值从 A 被改成 B、又改回 A，CAS 看到当前还是 A、以为期间没人动过，其实中间变过两次——在无锁栈里可能把已释放又重分配的节点当成原来的', step: 4, evidence: 'T1 读到 100，T2 把 100→200→100，T1 的 CAS 期望 100、当前 100 → 误判成功' }),
        distractors: () => ['因为 CAS 本身有并发 bug', '因为读和写没加锁', '因为值溢出了'],
      },
      {
        id: 'stamp_fix', label: '版本号怎么修复 ABA',
        ask: '给 CAS 加一个版本号(stamp)，为什么就能识破 ABA?', kind: 'choice',
        compute: () => ({ answer: '版本号只增不减，每改一次就 +1。CAS 比较 (值, 版本) 一对：即使值绕回 A，版本也从 v1 变成了 v3、回不去，CAS 发现版本不符就正确失败。这就是 AtomicStampedReference', step: 8, evidence: 'T1 期望 (100,v1)、当前 (100,v3)，值同但版本不符 → CAS 失败' }),
        distractors: () => ['版本号让 CAS 变快了', '版本号把值锁住不让改', '版本号让 A 和 A 变得不相等'],
      },
    ],
  },
  {
    id: 'happensbefore', title: 'happens-before 可见性', kernel: happensbeforeKernel as Kernel<unknown>, doc: trivialDoc('happensbefore'),
    facts: [
      {
        id: 'why_stale', label: 'reader 为什么会读到旧值',
        ask: 'writer 先 data=42 再 ready=true，reader 看到 ready==true 却读到 data=0，为什么?', kind: 'choice',
        compute: () => ({ answer: '没有同步时，编译器/CPU 可能把 ready=true 重排到 data=42 之前生效，或 data 的新值还停在缓存没让 reader 看见；两条写的顺序和可见性对 reader 都不保证', step: 3, evidence: 'reader 见 ready=true 就读 data，却读到旧值 0——经典可见性/重排 bug' }),
        distractors: () => ['因为 reader 读得太快', '因为 data 被别的线程改成了 0', '因为 42 存不下'],
      },
      {
        id: 'volatile_hb', label: 'volatile 靠什么保证读到最新',
        ask: '把 ready 声明为 volatile 后，为什么 reader 就一定能读到 data=42?', kind: 'choice',
        compute: () => ({ answer: 'volatile 建立 happens-before：volatile 写(ready=true)是释放屏障、把之前的写(data=42)刷出；volatile 读(读 ready)是获取屏障、拿到最新。于是 data=42 先于 reader 读 data 被保证', step: 6, evidence: 'happens-before 传递：data=42 → ready=true → reader 见 ready → reader 读 data，必看见 42' }),
        distractors: () => ['volatile 给变量加了锁', 'volatile 让 data 也不能被改', 'volatile 只是让读写更快'],
      },
    ],
  },
  {
    id: 'lrucache', title: '手写 LRU 缓存', kernel: lrucacheKernel as Kernel<unknown>, doc: trivialDoc('lrucache'),
    facts: [
      {
        id: 'two_structs', label: 'LRU 为什么要 HashMap + 双向链表两个结构',
        ask: '实现 O(1) 的 LRU 缓存，为什么要同时用 HashMap 和双向链表?', kind: 'choice',
        compute: () => ({ answer: 'HashMap 负责 O(1) 定位节点（否则查找是 O(n)）；双向链表负责 O(1) 维护使用顺序——头插、以及从中间摘除任意节点（单链表删节点找不到前驱，做不到 O(1)）。两者配合才能 get/put 都 O(1)', step: 0, evidence: 'get 命中要把节点移到头，删除中间节点需要前驱指针，所以必须双向链表' }),
        distractors: () => ['为了省内存', '双向链表只是为了好看', 'HashMap 一个就够了，链表多余'],
      },
      {
        id: 'evict_tail', label: 'LRU 淘汰谁、命中怎么处理',
        ask: '容量满时 LRU 淘汰哪个？get 命中一个 key 后要做什么?', kind: 'choice',
        compute: () => ({ answer: '淘汰链表尾部（最久没用的）；get 命中后把该节点移到链表头部（它刚被使用，成了最近的），保证头=最近、尾=最久', step: 4, evidence: 'put(3,3) 时容量满 → 淘汰尾部 2；get(1) 命中 → 把 1 移到头部' }),
        distractors: () => ['淘汰头部；命中后移到尾部', '淘汰值最小的；命中不用动', '随机淘汰一个；命中后删除它'],
      },
    ],
  },
  {
    id: 'topk', title: '设计海量数据 Top-K', kernel: topkKernel as Kernel<unknown>, doc: trivialDoc('topk'),
    facts: [
      {
        id: 'hash_shard', label: 'Top-K 为什么用哈希分片而不是随机切',
        ask: '海量数据求 Top-K 要分片处理，为什么用 hash(词)%N 分片，而不是随机/轮询切成 N 块?', kind: 'choice',
        compute: () => ({ answer: '哈希确定→"相同的词一定落同一片"，所以一个词的计数不会被拆到两片、每片能独立统计；随机/轮询切会把同一个词散到多片、各数一半，全局求和就错了', step: 1, evidence: '本例「苹果」hash%2=1 每次都进 shard1、「香蕉」每次进 shard0，计数不被拆' }),
        distractors: () => ['哈希分片切得更均匀', '随机切会丢数据', '两种没区别'],
      },
      {
        id: 'min_heap', label: '求 Top-K 为什么用小顶堆',
        ask: '求出现最多的 K 个，为什么用大小为 K 的小顶堆，而不是全部排序?', kind: 'choice',
        compute: () => ({ answer: '维护大小 K 的小顶堆：堆顶=当前第 K 大=门槛，新词 ≤ 门槛直接扔、> 门槛才淘汰堆顶换上。整体 O(n㏒K) ≪ 全排序 O(n㏒n)，只吃 O(K) 内存', step: 10, evidence: '本例堆满门槛=1，橙子3>1→淘汰堆顶梨1、门槛升到3；葡萄2/桃1≤3直接扔' }),
        distractors: () => ['大顶堆才对', '必须全排序才能求 Top-K', '用哈希表就能直接排序'],
      },
    ],
  },
  {
    id: 'reactagent', title: 'Agent 主循环 · 防死循环', kernel: reactagentKernel as Kernel<unknown>, doc: trivialDoc('reactagent'),
    facts: [
      {
        id: 'ra_terminate', label: 'Agent 主循环怎么正确地停',
        ask: 'Thought→Action→Observation 的 Agent 循环，怎么"正确地停"、有哪几条终止路径?', kind: 'choice',
        compute: t => { const f = t as unknown as { halt?: string; stepCount?: number }[]; const l = f[f.length - 1]; return ({ answer: '四条：①正常(模型不再发工具→Final Answer) ②重复(stuck 检测:最近几步动作相同就中止) ③超预算(步数/成本上限→停、交 best-effort) ④出错(autosubmit 交一版 best-effort)', step: Math.max(0, f.length - 1), evidence: `本例默认"正常"场景：${l?.stepCount ?? 3} 步后模型不再发工具、正常终止` }) },
        distractors: () => ['只有一种：模型自己说结束', '固定跑满 N 步就停，不看内容', '永远跑到用户手动关掉'],
      },
      {
        id: 'ra_stuck', label: '模型陷入重复怎么办',
        ask: 'Agent 循环里模型卡住了、一直发同一个动作(反复 search 同一个词)，怎么防它无限跑?', kind: 'choice',
        compute: () => ({ answer: 'stuck 检测：盯"最近几步动作是否相同/有没有进展"，一相同就中止(OpenHands 有 StuckDetector)；兜底再给个步数硬上限。防止原地打转把算力烧光', step: 4, evidence: '切"重复"场景：最近 3 步动作全相同 → stuck 中止' }),
        distractors: () => ['相信模型自己会停下来', '让它一直跑，反正迟早会对', '把温度调高让它随机跳出来'],
      },
      {
        id: 'ra_budget', label: '任务不收敛怎么控成本',
        ask: '任务很难、Agent 一直不收敛，怎么防止它烧爆算力/预算?', kind: 'choice',
        compute: () => ({ answer: '设步数/成本预算上限(SWE-agent 的 per_instance_cost_limit)，撞了就停、交当前 best-effort。硬上限安全但可能截断正经活；Codex/DeepSeek 不设硬 turn 上限、靠压缩+stuck 软兜底，SWE-agent/OpenHands 用 max_iterations 硬上限', step: 5, evidence: '切"超预算"场景：走满 6 步预算 → 停、交 best-effort' }),
        distractors: () => ['不用管，模型会自己省着用', '无限跑直到出结果', '每步都问用户要不要继续'],
      },
      {
        id: 'ra_autosubmit', label: 'Agent 跑一半崩了怎么办',
        ask: 'Agent 跑到一半崩溃了(沙箱被 OOM 杀、异常、超时)，好的做法是?', kind: 'choice',
        compute: () => ({ answer: 'autosubmit-on-error：不硬崩退出、让整趟白跑，而是尽力交一版当前进展当结果(SWE-agent 崩了也交一个 best-effort patch)', step: 3, evidence: '切"出错"场景：崩溃 → autosubmit 交一版已改好的 config' }),
        distractors: () => ['直接抛异常退出，这趟就作废', '自动从头重跑一遍', '把错误藏起来假装成功'],
      },
      {
        id: 'ra_step_turn', label: 'step 和 turn 的区别',
        ask: 'Agent 工程里 step 和 turn 是一回事吗，预算按哪个算?', kind: 'choice',
        compute: () => ({ answer: '不是。step=一次模型请求+它触发的工具；turn=零或多个 step。预算通常按 step 数或累计成本(token/$)算', step: 1, evidence: '一个 turn 里模型可能连着调好几次工具=好几个 step' }),
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
        compute: t => { const f = t as unknown as { stage: string; before: number; running: number }[]; const r = f.find(x => x.stage === 'rebuild'); return ({ answer: '量token→累计到阈值触发→分区:留头(系统+首任务)+留最近+压中间→先剪超大工具输出→还超就总结或省略→原始日志append-only不删', step: f.findIndex(x => x.stage === 'rebuild'), evidence: r ? `本例 ${r.before}→${r.running} tokens` : '压回阈值下' }) },
        distractors: () => ['直接从最新消息往前删，删到不超为止', '把整段历史丢给另一个模型重写成一句话', '换一个上下文窗口更大的模型就行，不用压缩'],
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
        compute: t => { const f = t as unknown as { stage: string }[]; return ({ answer: '留头(系统提示+第一条任务，钉住)+留最近(retainRatio=0.16 的最新对话，原样)；压中间。分界处不能拆散「工具调用↔结果」这一对', step: f.findIndex(x => x.stage === 'partition'), evidence: '头=系统+首任务、尾=最新几条原样、中间被压；尾巴宁可略超预算也把成对的 call/result 补齐' }) },
        distractors: () => ['只保留最新的一条，其余全删', '保留最长的几条消息', '按字母顺序保留一半'],
      },
      {
        id: 'cc_sum_vs_elide', label: '总结 vs 省略的取舍',
        ask: '压中间那段，用"总结成摘要"还是"直接省略"，两者怎么取舍?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string }[]; return ({ answer: '总结(summarize)：换成结构化摘要，有损、要花一次模型调用，但信息密度高、Agent 记得住来龙去脉；省略(elide)：换成一行标记，免费、确定、可回放，但中间全丢、Agent 失忆', step: Math.max(0, f.findIndex(x => x.stage === 'rebuild')), evidence: 'DeepSeek/Claude Code/Codex 用 8 段式摘要模板；SWE-agent 用「N 行已省略」的确定性省略' }) },
        distractors: () => ['总结和省略没区别，随便用', '省略更好因为信息全保留', '总结免费所以永远用总结'],
      },
      {
        id: 'cc_cjk_token', label: '为什么 4字/token 估算对中文有坑',
        ask: '很多框架用"~4 字/token"快速估 token，这对中文场景有什么坑?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; meter?: { est: number; real: number } }[]; const m = f.find(x => x.meter)?.meter; return ({ answer: `低估中文(和 JSON)：中文约 1 字≈1 token，用 4字/token 会算少好几倍，导致压缩触发得偏晚——你以为没满、其实早超了`, step: f.findIndex(x => x.meter), evidence: m ? `本例一句中文估 ${m.est}、实际约 ${m.real}，低估 ${(m.real / m.est).toFixed(1)} 倍` : '中文被严重低估' }) },
        distractors: () => ['高估中文，导致压缩触发太早', '对中文刚好准确', '只影响英文不影响中文'],
      },
    ],
  },
  {
    id: 'toolcall', title: '工具调用', kernel: toolcallKernel as Kernel<unknown>, doc: trivialDoc('toolcall'),
    facts: [
      {
        id: 'tc_pipeline', label: 'harness 处理工具调用的流水线',
        ask: '模型发出一个工具调用后，harness 用什么样的流水线来处理它?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string }[]; return ({ answer: '解析(取 name/参数，不合法→PARSE_ERROR)→门禁(未知工具→UNKNOWN_TOOL；危险操作→DENY)→执行(带超时)→回灌(结果或错误当 tool_result 配对喂回)。模型只决定发哪个工具，怎么接是确定性流水线', step: 1, evidence: '本例 5 个调用各走这条流水线，卡在不同阶段' }) },
        distractors: () => ['模型直接执行工具、harness 不参与', '把工具名当普通文本拼进回复里', '每个调用都要用户手动确认才能跑'],
      },
      {
        id: 'tc_error', label: '工具调用失败了怎么办',
        ask: '一个工具调用解析失败 / 工具不存在 / 被权限拒绝，好的 harness 怎么处理?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; history?: { ok: boolean }[] }[]; const d = f.find(x => x.stage === 'done'); const fails = d?.history?.filter(h => !h.ok).length ?? 3; return ({ answer: '把错误本身当成一条 tool_result 喂回给模型，循环不中断——模型看到错误能重试/改名/换招；不抛异常终止整个 Agent', step: f.findIndex(x => x.stage === 'done'), evidence: `本例 5 个调用里 ${fails} 个失败（拒绝/未知/解析错），全变成 error 结果回灌、循环没断` }) },
        distractors: () => ['直接抛异常，整个 Agent 停掉', '静默忽略这个调用，当无事发生', '自动用最相近的工具替换后执行'],
      },
      {
        id: 'tc_encoding', label: '工具调用一定是 JSON 吗',
        ask: '模型发的工具调用，一定是 JSON（function-calling）格式吗?', kind: 'choice',
        compute: () => ({ answer: '不一定。原生 function-calling 用 JSON schema(稳但绑供应商)；但 Codex 的 apply_patch 是自由文本、Aider 用文本 diff、gptme 把工具名当代码块语言标签——为了模型无关(本地/不支持 function-calling 的也能用)+避开在 JSON 里塞代码的转义地狱', step: 0, evidence: '编码方式是工具调用的一个关键设计取舍：function-calling vs 文本/XML' }),
        distractors: () => ['必须是 JSON，否则解析不了', '必须是 XML 标签', '必须是 Python 代码'],
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
        compute: () => ({ answer: '只读/互不影响的调用(read_file、calc)可并行(DeepSeek 默认最多 10 个并发)；写文件/跑 shell 这种有副作用的必须独占排队，否则互相踩', step: 1, evidence: '按"有无副作用"分类：并行安全 vs 独占' }),
        distractors: () => ['所有调用都必须串行、一个一个来', '所有调用都能无脑并行', '按调用的字母顺序决定能否并行'],
      },
    ],
  },
  {
    id: 'permguard', title: '沙箱 / 权限', kernel: permguardKernel as Kernel<unknown>, doc: trivialDoc('permguard'),
    facts: [
      {
        id: 'pg_two_walls', label: 'Agent 靠什么决定放不放行模型的命令',
        ask: 'Agent 要跑模型生成的命令，靠什么机制决定放不放行?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; history?: { final: string }[] }[]; const d = f.find(x => x.stage === 'done'); const blk = d?.history?.filter(h => h.final === 'blocked').length ?? 2; const run = (d?.history?.length ?? 5) - blk; return ({ answer: '两道相互独立的墙：①规则/审批(deny→ask→allow，首次匹配即生效) ②沙箱(物理隔离、fail-closed，网络默认关、写只在工作区内)。两墙都过才真跑', step: f.findIndex(x => x.stage === 'done'), evidence: `本例默认模式：${run} 跑 / ${blk} 拦` }) },
        distractors: () => ['全靠模型自己判断该不该跑', '所有命令都要用户逐条确认', '只看命令字符串长度'],
      },
      {
        id: 'pg_precedence', label: 'allow/ask/deny 规则的优先级',
        ask: '一条命令同时匹配到 allow 和 deny 规则，听谁的?', kind: 'choice',
        compute: () => ({ answer: 'deny → ask → allow，首次匹配即生效——最危险的先拦。rm -rf 命中 deny 就直接拒，后面的 allow 规则看都不看', step: 3, evidence: '本例 rm -rf /tmp/* 第一条 deny 就拦下' }),
        distractors: () => ['allow 优先，宽松的赢', '按规则写的先后、后写的覆盖', '随机选一条'],
      },
      {
        id: 'pg_bypass_net', label: '放行模式还能被拦住联网吗',
        ask: 'Agent 开了"放行"模式(--dangerously-skip-permissions，跳过所有审批)，它还能被拦住联网吗?', kind: 'choice',
        compute: () => ({ answer: '能。沙箱是跟审批相互独立的第二道墙——网络默认关、fail-closed；跳过审批 ≠ 拆掉沙箱（纵深防御）', step: 4, evidence: '本例即便放行模式，curl 联网仍被沙箱拦住' }),
        distractors: () => ['不能，放行模式跳过一切限制', '要看模型愿不愿意联网', '只有付费版才拦'],
      },
      {
        id: 'pg_failclosed', label: '沙箱起不来了怎么办',
        ask: '要跑命令时沙箱环境起不来（不可用），一个安全的 harness 怎么办?', kind: 'choice',
        compute: () => ({ answer: 'fail-closed：报 SANDBOX_UNAVAILABLE、拒绝执行，宁可拦错不放过；而不是"没沙箱就裸奔"(fail-open)', step: 0, evidence: '安全默认永远是 fail-closed' }),
        distractors: () => ['fail-open：没沙箱就直接在宿主机上跑', '静默跳过这条命令', '自动降权后照跑不误'],
      },
      {
        id: 'pg_escalate', label: '越权操作怎么处理',
        ask: '模型要写工作区外的文件(越出沙箱范围)，安全的处理是?', kind: 'choice',
        compute: () => ({ answer: '一次性升级：模型带理由申请更宽范围 + 一次人工批准，而且只这一次(one-shot、不给 allow-always)——防"批一次以后全放行"的权限蔓延', step: 5, evidence: '本例 write /etc/hosts 越界 → 升级 → 一次批准 → 仅此一次运行' }),
        distractors: () => ['直接拒绝，永远不给写工作区外', '批准一次后就永久放行(allow-always)', '模型自己提权、不用问人'],
      },
    ],
  },
  {
    id: 'subagent', title: '子 Agent · 委派', kernel: subagentKernel as Kernel<unknown>, doc: trivialDoc('subagent'),
    facts: [
      {
        id: 'sa_why', label: '为什么要派独立子 agent',
        ask: '复杂任务，父 agent 为什么要派独立子 agent 去干、而不是自己全包?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; internalTotal: number; returnTotal: number }[]; const d = f.find(x => x.stage === 'done'); return ({ answer: '省上下文：子在自己独立的上下文里探索(读文件/试错，烧很多 token)，只把最终结论回传给父(几十 token)；大块探索关在子里、不污染父。也顺带聚焦(子不被父的历史干扰)', step: f.findIndex(x => x.stage === 'done'), evidence: d ? `本例子内部共 ${d.internalTotal}t，父只涨 ${d.returnTotal}t` : '子内部大、回传小' }) },
        distractors: () => ['为了跑得更慢', '子 agent 更聪明、能力更强', '为了绕过父的权限限制'],
      },
      {
        id: 'sa_return', label: '子 agent 回传给父的是什么',
        ask: '子 agent 干完活，回传给父 agent 的是什么?', kind: 'choice',
        compute: () => ({ answer: '只回传最终结论(几十 token)，不是子的整条对话轨迹。省 token，但父也看不到子的完整推理——要细节就让子写进结果里', step: 1, evidence: '子内部几百 t 的探索，只回传一句结论' }),
        distractors: () => ['把子的完整对话轨迹全搬回父', '什么都不回传', '回传子用了多少 token'],
      },
      {
        id: 'sa_forkbomb', label: '怎么防子生子指数爆炸',
        ask: '子 agent 还能再派子 agent，怎么防止子生子、指数爆炸(fork 炸弹)?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; depthCap: number; concCap: number }[]; const d = f.find(x => x.depthCap != null); return ({ answer: '深度上限(Claude Code maxDepth 3：到上限就把 spawn 工具摘掉、节点发不出委派) + 并发上限(≤20 同时跑)', step: f.findIndex(x => x.stage === 'blocked'), evidence: `本例深度上限 ${d?.depthCap ?? 3}、并发上限 ${d?.concCap ?? 20}；B1a 在深度 3 想再派 → 拦下` }) },
        distractors: () => ['不用防，模型会自己收敛', '每次派子都问一次用户', '限制子 agent 的 token 长度'],
      },
      {
        id: 'sa_spawn_fork', label: 'spawn 和 fork 的区别',
        ask: '起子 agent 有 spawn(新开) 和 fork(承接) 两种，区别是?', kind: 'choice',
        compute: () => ({ answer: 'spawn=子从空白上下文起(便宜、干净、但没父的历史)；fork=子承接父的前缀(续得上、还能复用 provider 的 KV 缓存，但起始更贵)。要连续性用 fork、要省事用 spawn', step: 0, evidence: '本例新开=子起 10t、承接=子起 120t(父前缀)' }),
        distractors: () => ['spawn 和 fork 完全一样', 'fork 更快因为不用上下文', 'spawn 会把父 agent 也复制一份'],
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
        compute: () => ({ answer: '打分检索(Generative Agents 做法)：给每条记忆算三信号、加权求和、排序取 top-k——不是关键词匹配，也不是把全部历史倒进去', step: 3, evidence: '得分 = w·最近 + w·相关 + w·重要，排序取 top-k' }),
        distractors: () => ['按存入的先后顺序，先存的先捞', '把所有记忆全塞进上下文', '随机抽几条'],
      },
      {
        id: 'mr_signals', label: '记忆打分的三个信号',
        ask: 'Generative Agents 给每条记忆打分，用哪三个信号?', kind: 'choice',
        compute: () => ({ answer: '最近度 recency(=decay^龄，指数衰减，decay=0.995) + 重要度 importance(LLM 打的 1~10 分) + 相关度 relevance(与查询向量的余弦)', step: 1, evidence: '三者各说各话：记忆可以很新但不相关、很重要但不相关' }),
        distractors: () => ['长度、语言、格式', '存入时间、作者、字数', '只看和查询的关键词重合数'],
      },
      {
        id: 'mr_weights', label: '权重影响什么',
        ask: '三个信号加权求和时，权重(w_rec/w_rel/w_imp)会影响什么?', kind: 'choice',
        compute: () => ({ answer: '权重翻则排名翻、捞回的记忆就不同。论文说三者等权(1·1·1)，但 Generative Agents 代码里是 (0.5·3·2)[最近·相关·重要]、相关度最重', step: 2, evidence: '一条"VIP"(重要但不相关)：等权时被捞回，相关权重一大就落榜' }),
        distractors: () => ['权重只影响速度、不影响排名', '权重必须相等否则算不出来', '权重越大越省 token'],
      },
      {
        id: 'mr_vip', label: '重要但不相关的记忆会被捞回吗',
        ask: '一条"用户是 VIP"(重要度 9、但跟"修登录 bug"相关度只 0.2)的记忆，会被捞进上下文吗?', kind: 'choice',
        compute: t => { const f = t as unknown as { stage: string; weights: string; mems?: { id: string; retrieved: boolean }[] }[]; const d = f.find(x => x.stage === 'done'); const vip = d?.mems?.find(m => m.id === 'm3'); return ({ answer: `看权重。默认"${d?.weights ?? '均衡'}"下它${vip?.retrieved ? '被捞回(靠重要度+最近度挤进 top-k)' : '没被捞回'}；但切到"重相关"(相关度权重大)它就落榜——重要 vs 相关是真实取舍`, step: Math.max(0, f.findIndex(x => x.stage === 'done')), evidence: `均衡权重下 VIP 进 top-k、重相关权重下出局` }) },
        distractors: () => ['一定会，因为它最重要', '一定不会，因为它不相关', '看它存了多久'],
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
        compute: () => ({ answer: '把上下文当"物理内存 RAM"、外部存储当"磁盘"，agent 用函数调用在两层间搬数据=给 LLM 做虚拟内存(和 OS 页面置换同一思想)', step: 0, evidence: 'RAM 快·贵·小，磁盘慢·便宜·大，靠数据搬运制造"内存无限大"的假象' }),
        distractors: () => ['换一个上下文更大的模型', '把老消息直接删掉', '把所有历史压成一句话'],
      },
      {
        id: 'mp_tiers', label: 'MemGPT 的两层内存',
        ask: 'MemGPT 的主上下文(进 prompt)和外部存储(不进 prompt)各含什么?', kind: 'choice',
        compute: () => ({ answer: '主上下文=系统指令 + 工作记忆(core) + FIFO 消息队列(首槽=递归摘要)；外部存储=recall(全消息库) + archival(可检索文本)', step: 0, evidence: 'RAM 里是当前要用的，磁盘里是全量历史+可检索库' }),
        distractors: () => ['主上下文只有系统指令，其余全在外部', '两层都是向量数据库', '主上下文=用户消息、外部=助手消息'],
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
        compute: () => ({ answer: '驱逐最老的约 50% 窗口的消息到 recall(磁盘)，并用"旧摘要+被驱逐消息"生成新的递归摘要放回队首——这就是页面置换(换出)，有损但腾出 RAM', step: 3, evidence: '本例驱逐 3 条老消息→recall、队首写递归摘要，RAM 从 77 降到 49' }),
        distractors: () => ['把整个上下文清空重来', '停下来等用户手动删', '把最新的消息删掉'],
      },
      {
        id: 'mp_pagefault', label: '需要已驱逐的旧信息怎么办',
        ask: 'agent 需要一条已被驱逐到磁盘的旧消息(缺页)，怎么拿回来?', kind: 'choice',
        compute: () => ({ answer: '函数调用 conversation_search(搜 recall) 或 archival_memory_search(搜 archival) 检索出来，追加到队尾、重新进上下文——这就是缺页调入(换入)', step: 4, evidence: '本例需要已驱逐的 NPE 那条→检索调回队尾，RAM 升回' }),
        distractors: () => ['没办法，驱逐了就永远丢了', '让模型凭记忆重新编一条', '整个会话重启'],
      },
    ],
  },
  {
    id: 'reflection', title: '反思 · 记忆巩固', kernel: reflectionKernel as Kernel<unknown>, doc: trivialDoc('reflection'),
    facts: [
      {
        id: 'rf_why', label: '为什么 agent 要反思',
        ask: '"用户是个后端工程师"这种高层判断，agent 从哪来?', kind: 'choice',
        compute: () => ({ answer: '反思(reflection)：任何单条原始观察里都没有这种高层判断，得综合多条观察抽象出来——把零散观察巩固成高层洞察', step: 3, evidence: '检索只能捞已有条目；高层理解要靠反思综合出来' }),
        distractors: () => ['直接从某一条原始观察里读出来', '每次现问用户', '模型天生就知道'],
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
        compute: () => ({ answer: '洞察要引用证据——记录它由哪几条观察支撑，可追溯回具体观察，因而可解释', step: 3, evidence: '本例洞察下写着"证据：o1/o2/o3/o4"' }),
        distractors: () => ['不用保证，模型说的都对', '让用户逐条确认', '存下模型的置信度分数'],
      },
      {
        id: 'rf_tree', label: '洞察产生之后',
        ask: '反思产生一条洞察之后，它怎么处理，能再进化吗?', kind: 'choice',
        compute: () => ({ answer: '洞察当成一条高重要度的新记忆入库(以后更容易被检索到)；而且洞察本身还能被更高层反思——观察→洞察→更高层洞察，长成反思树', step: 3, evidence: '观察是叶、洞察是往上长的节点' }),
        distractors: () => ['洞察用完即弃、不入库', '洞察不能再被反思', '洞察会覆盖掉原始观察'],
      },
      {
        id: 'rf_vs_compact', label: '反思和上下文压缩摘要的区别',
        ask: '反思提炼洞察，和上下文压缩里的"摘要"，目的有什么不同?', kind: 'choice',
        compute: () => ({ answer: '压缩摘要是为省 token、把最近的历史压掉(短期、就地删繁)；反思是为长期理解、把零散观察往上抽象成洞察(长期、增值升华)', step: 4, evidence: '一个删繁、一个升华' }),
        distractors: () => ['两者完全一样', '反思是为省 token、压缩是为理解', '都是为了减少模型参数'],
      },
    ],
  },
  {
    id: 'memwrite', title: '记忆写入 · 冲突消解', kernel: memwriteKernel as Kernel<unknown>, doc: trivialDoc('memwrite'),
    facts: [
      {
        id: 'mw_conflict', label: '记忆矛盾了怎么写',
        ask: '用户上月说"住北京"、这周说"搬上海了"，好的记忆系统怎么写?', kind: 'choice',
        compute: () => ({ answer: '检索到矛盾的旧记忆 → 用 UPDATE/DELETE 消解(改掉或删掉过时的)，别让两条并存；否则记忆自相矛盾、检索捞出哪条都不对', step: 3, evidence: '写记忆要比对已有、消解冲突，不是无脑追加' }),
        distractors: () => ['两条都存进去，反正都是用户说的', '只信最早那条、忽略后面的', '每次都清空重存'],
      },
      {
        id: 'mw_ops', label: 'mem0 的四个写入操作',
        ask: 'mem0 往记忆库写新事实时，LLM 会挑哪四种操作之一?', kind: 'choice',
        compute: () => ({ answer: 'ADD(无相似→新建) / UPDATE(补充修正已有) / DELETE(与已有矛盾→删旧) / NOOP(已知道→不动、去重)', step: 1, evidence: '本例：养猫=ADD、Python3.12=UPDATE、戒咖啡=DELETE、又提北京=NOOP' }),
        distractors: () => ['只有 ADD 一种', 'CREATE/READ/UPDATE/DELETE(CRUD)', 'INSERT/SELECT/其余全靠模型'],
      },
      {
        id: 'mw_similar', label: '决定 UPDATE 还是 ADD 靠什么',
        ask: '一条新事实，怎么决定它是 ADD 新建、还是该 UPDATE/DELETE 某条旧记忆?', kind: 'choice',
        compute: () => ({ answer: '先用向量相似度检索最相似的旧记忆：没有相似的就 ADD；有相似的才谈 UPDATE(修正)或 DELETE(矛盾)', step: 1, evidence: '不先找"该改哪条"，就只能无脑 ADD' }),
        distractors: () => ['按新事实的长度决定', '随机选一种操作', '永远先 DELETE 再 ADD'],
      },
      {
        id: 'mw_singlepass', label: 'mem0 现在 OSS 默认怎么写',
        ask: 'mem0 论文是四操作(ADD/UPDATE/DELETE/NOOP)，但它现在开源版默认怎么做?', kind: 'choice',
        compute: t => { const f = t as unknown as { store?: { stale?: boolean }[] }[]; const d = f[f.length - 1]; const stale = d?.store?.filter(m => m.stale).length ?? 0; return ({ answer: '单遍 ADD-only：只抽取只新增、不 UPDATE/DELETE。简单快，但矛盾/陈旧越积越多(要修正得显式调 update/delete)', step: Math.max(0, f.length - 1), evidence: `切单遍模式：${stale || 3} 条旧记忆变陈旧矛盾(美式咖啡 vs 戒咖啡等并存)` }) },
        distractors: () => ['还是老老实实四操作', '改成只 DELETE 不 ADD', '完全不写记忆了'],
      },
      {
        id: 'mw_zep', label: 'Zep 怎么处理过时事实',
        ask: 'Zep/Graphiti 处理"过时的事实"用了什么不同思路?', kind: 'choice',
        compute: () => ({ answer: '双时间知识图：给旧事实打"失效时间(t_invalid)"而不真删——"住北京"标记为某时刻失效、"住上海"生效，还能查"某时刻用户住哪"', step: 4, evidence: 'bi-temporal：事件时间 + 系统时间两条轴，矛盾时把旧边设失效而非删除' }),
        distractors: () => ['直接物理删除旧事实', '把所有历史压成一句话', '从不更新、只读'],
      },
    ],
  },
  {
    id: 'planning', title: '规划 · 计划模式 + Todo', kernel: planningKernel as Kernel<unknown>, doc: trivialDoc('planning'),
    facts: [
      {
        id: 'pl_planmode', label: '计划模式是硬门禁还是走过场',
        ask: 'Claude Code 的"计划模式"，在你批准计划前能不能直接改文件?', kind: 'choice',
        compute: () => ({ answer: '不能——它是硬门禁：在权限层把"写"堵死，批准计划前只能读/探查(逼先看后动，只有 bypass 模式才降级成软提示)。对比 DeepSeek plan-mode 是纯建议、工具照调', step: 1, evidence: 'edits stay blocked until you approve the plan；强制 vs 建议的分叉' }),
        distractors: () => ['能，计划模式只是个提醒', '看模型自己判断', '能，但只能改一个文件'],
      },
      {
        id: 'pl_todo_sm', label: 'Todo 状态机的关键不变量',
        ask: 'Agent 的 todo 列表作为状态机，有什么关键约束?', kind: 'choice',
        compute: () => ({ answer: '每项 pending→in_progress→completed，且**恰好一个 in_progress**(逼串行、别并行摊大)；整表替换更新(或 Opus4.8/Sonnet5+ 的增量 TaskCreate/TaskUpdate + deleted 态)', step: 3, evidence: '本例 t1 done、t2 active，同时只一个进行中' }),
        distractors: () => ['可以同时很多个进行中、并行推', 'todo 只能增不能改状态', '完成的要立刻从列表删掉'],
      },
      {
        id: 'pl_recite', label: 'todo 每轮重贴回近端图什么',
        ask: '把整张 todo 列表每轮重新贴回上下文近端("复述")，主要图什么?', kind: 'choice',
        compute: () => ({ answer: '注意力操控：把全局计划推回模型的近端注意力，对抗长任务里的 lost-in-the-middle 漂移(计划只在开头说一次，跑几十步就被埋在中部被忽略)。不只是记账', step: 4, evidence: 'Manus："recitation 把全局计划推进近端注意力"' }),
        distractors: () => ['只是为了让用户看到进度', '为了省 token', '没有用，纯装饰'],
      },
      {
        id: 'pl_replan', label: '计划和现实岔开怎么办',
        ask: '执行到一半发现计划没料到的依赖(现实和计划岔开)，怎么办?', kind: 'choice',
        compute: () => ({ answer: '重规划：整表替换、插入新 todo。计划不是一次定死，是随现实滚动更新的活文档', step: 4, evidence: '本例抽函数时发现 auth.py 依赖 session.py → 插入「先解耦」一项' }),
        distractors: () => ['硬按原计划走到底、忽略新情况', '直接放弃整个任务', '删掉所有 todo 从头再来'],
      },
      {
        id: 'pl_paradigm', label: 'ReAct/Plan-and-Solve/ToT 的区别',
        ask: '几种规划范式 ReAct、Plan-and-Solve、Tree-of-Thoughts 的核心区别?', kind: 'choice',
        compute: () => ({ answer: 'ReAct=边想边做(想一步做一步、看结果再想)；Plan-and-Solve=先把整个计划规划好再逐步执行；Tree-of-Thoughts=把多个候选计划展开成树、搜索/回溯选最优', step: 5, evidence: '交错 vs 先规划后执行 vs 树搜索' }),
        distractors: () => ['三者完全一样、只是名字不同', '都是先执行再规划', '都不需要工具调用'],
      },
    ],
  },
  {
    id: 'promptbuild', title: '提示词组装 · 缓存友好排序', kernel: promptbuildKernel as Kernel<unknown>, doc: trivialDoc('promptbuild'),
    facts: [
      {
        id: 'pb_prefix', label: 'prompt 缓存怎么匹配',
        ask: 'prompt 缓存(prompt caching)是怎么匹配命中的?', kind: 'choice',
        compute: () => ({ answer: '最长相同前缀匹配：缓存覆盖 tools→system→messages(固定顺序)到断点为止；断点及之前任何一处变了，前缀哈希就变、缓存全失效、后面全价重算', step: 1, evidence: '找不到命中还会往前回溯最多 20 个块' }),
        distractors: () => ['按内容相似度模糊匹配', '整个 prompt 逐块独立缓存、互不影响', '只缓存最后一条消息'],
      },
      {
        id: 'pb_order', label: '怎么排 prompt 省缓存钱',
        ask: 'Agent 每轮重拼 prompt，怎么排序最能省缓存的钱?', kind: 'choice',
        compute: t => { const f = t as unknown as { ordering: string; prefixTok: number }[]; const d = f.find(x => x.ordering); return ({ answer: '静态的排前面(工具schema/系统身份/项目指令)、动态的排后面(运行时快照/历史/本轮消息)、断点放"逐轮都不变的最后一块"——让可缓存前缀又长又稳', step: 1, evidence: `本例静态优先前缀 ${d?.prefixTok ?? 85}t 可缓存` }) },
        distractors: () => ['每轮把最新消息放最前面', '随便排、内容一样就行', '把最大的块放最后'],
      },
      {
        id: 'pb_readcost', label: '命中缓存花多少钱',
        ask: 'prompt 缓存命中(读缓存)的部分，花基础输入价的多少?', kind: 'choice',
        compute: () => ({ answer: '0.1× 基础价(只花 10%、省 90%)。对比缓存写是 1.25×(5分钟)/2×(1小时)', step: 3, evidence: '命中省 90%，所以要尽量让前缀稳定复用' }),
        distractors: () => ['和全价一样、不省', '0.5× 基础价', '免费'],
      },
      {
        id: 'pb_pitfall', label: '把动态内容放靠前会怎样',
        ask: '把每轮都变的东西(时间戳/运行时快照)塞进 prompt 靠前的块，会怎样?', kind: 'choice',
        compute: () => ({ answer: '前缀每轮都不同 → 缓存永远不命中、每轮全价重写——经典翻车。所以逐轮变的必须排到断点之后', step: 1, evidence: '本例"乱序"把运行时快照混进 system，只剩工具能缓存、省 21% vs 静态优先 44%' }),
        distractors: () => ['没影响，缓存照样命中', '缓存会更快', '只是稍微慢一点'],
      },
      {
        id: 'pb_frameworks', label: '为什么 CLAUDE.md 当独立 user 消息',
        ask: 'Claude Code 为什么把 CLAUDE.md 当独立 user 消息放系统提示之后、而不塞进 system?', kind: 'choice',
        compute: () => ({ answer: '为了不动那段可缓存前缀(system+tools)——把可能变的项目指令放后面，系统提示前缀保持稳定、持续命中缓存。DeepSeek 把运行时快照当单独消息注入同理', step: 4, evidence: '护可缓存前缀，和 KV 缓存/上下文压缩(重放系统提示保前缀)同源' }),
        distractors: () => ['因为 system 放不下', '因为 user 消息模型更重视', '纯粹是历史遗留、没原因'],
      },
    ],
  },
  {
    id: 'actte', title: 'ACT · 动作分块 + 时序集成', kernel: actteKernel as Kernel<unknown>, doc: trivialDoc('actte'),
    facts: [
      {
        id: 'at_chunk', label: 'ACT 为什么一次预测一块动作',
        ask: 'ACT 为什么一次预测未来一"块"(K 个)动作，而不是每步一个?', kind: 'choice',
        compute: t => { const f = t as unknown as { K: number }[]; const k = f.find(x => x.K != null)?.K ?? 4; return ({ answer: `把有效时域从 T 缩到 T/K——需要自主决策的次数少 K 倍、复合误差(滚雪球)的机会砍到 1/K。这是 ACT 打赢单步 BC 的核心`, step: 1, evidence: `本例 K=${k}(LeRobot 真值 chunk_size=100)` }) },
        distractors: () => ['为了让模型跑得更快', '因为机械臂一次只能动一下', '为了省显存'],
      },
      {
        id: 'at_ensemble', label: '时序集成怎么算执行动作',
        ask: 'ACT 的时序集成(temporal ensembling)怎么算出每一步真正执行的动作?', kind: 'choice',
        compute: () => ({ answer: '每步都重预测一整块 → 同一个动作会被好几块预测到(重叠、互相不一致) → 把这些重叠预测加权平均：a_t = Σ w_i·P_i / Σ w_i，抹掉抖动', step: 3, evidence: '权重 w_i=exp(-m·i)、i=0 是最旧那条' }),
        distractors: () => ['只用最新那一块的预测', '取所有预测的最大值', '随机选一条预测'],
      },
      {
        id: 'at_weight', label: '时序集成的权重公式',
        ask: 'ACT 时序集成的权重 w_i = exp(-m·i)，其中 i=0 对应哪条预测，m 默认多少?', kind: 'choice',
        compute: t => { const f = t as unknown as { m: number }[]; const m = f.find(x => x.m != null && x.m > 0)?.m ?? 0.01; return ({ answer: `i=0 是**最旧**那条预测(LeRobot 代码 exp(-m·arange))；m 默认 ${m} → 权重近似均匀、还略偏旧(别过度信最新那条抖的，代码注释:激进上调新动作会削弱分块好处)`, step: 3, evidence: 'm 大→更信旧;m<0→更信新' }) },
        distractors: () => ['i=0 是最新那条、m 默认 1.0', 'i=0 是最旧、权重全相等(m 恒为 0)', 'i=0 是最重要那条、m 由模型学出'],
      },
      {
        id: 'at_default_off', label: 'LeRobot 默认开时序集成吗',
        ask: 'ACT 论文重点讲时序集成，那 LeRobot 里默认开启它吗?', kind: 'choice',
        compute: () => ({ answer: '默认不开！默认 n_action_steps=100、走队列(receding-horizon 执行完一块再预测)；要开集成得设 n_action_steps=1、每步重预测。经典"读配置别只读论文"陷阱', step: 5, evidence: 'temporal_ensemble_coeff 默认 None(关闭)' }),
        distractors: () => ['默认开启、不用配置', '论文和代码里都默认开', '默认开、但只在仿真里'],
      },
      {
        id: 'at_chunksize', label: 'LeRobot ACT 的动作块长',
        ask: 'LeRobot 里 ACT 的动作块长 chunk_size 默认是多少?', kind: 'number',
        compute: () => ({ answer: '100', step: 1, evidence: '本实验演示用 K=4 便于手算；LeRobot 真值 chunk_size=100、n_action_steps=100' }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'foc', title: 'FOC 磁场定向控制', kernel: focKernel as Kernel<unknown>, doc: trivialDoc('foc'),
    facts: [
      {
        id: 'foc_why', label: 'Park 变换关键在哪',
        ask: 'FOC 里 Park 变换(αβ→dq)最关键的作用是什么?为什么它让简单 PI 能用?', kind: 'choice',
        compute: () => ({ answer: 'Park 按转子电角把电流旋进"跟着转子转"的 dq 系，随转子转的正弦相电流在里面变成直流；PI 追不了正弦、却能把直流误差压到零稳态误差，所以两个简单 PI 就能分别控 i_d、i_q', step: 2, evidence: 'Clarke 先 3→2 降维、Park 再转进转子系:交流→直流是 FOC 能用 PI 的根本' }),
        distractors: () => ['把三相变两相、减少一个电流传感器', '把电流放大、提高转矩', '把直流变交流去驱动电机'],
      },
      {
        id: 'foc_id0', label: 'i_d 目标为什么设 0',
        ask: 'FOC 电流环里为什么把 i_d 的目标设成 0?', kind: 'choice',
        compute: () => ({ answer: '最大转矩每安培(MTPA)：表贴永磁/混合步进电机只有 i_q(交轴)产生转矩、i_d(直轴)只白白发热(I²R)不出力。i_d*=0 让每一安培都用在转矩上。唯一例外是高速弱磁时故意让 i_d<0', step: 3, evidence: 'τ=1.5·p·λ_m·i_q 只跟 i_q 走;i_d 只发热' }),
        distractors: () => ['为了让电机转得更快', '因为 i_d 测不准、干脆设 0', '为了让电流环更稳定'],
      },
      {
        id: 'foc_svpwm', label: 'SVPWM 比正弦 PWM 强在哪',
        ask: 'SVPWM(空间矢量 PWM)相比朴素正弦 PWM 好在哪?', kind: 'choice',
        compute: () => ({ answer: '在三相上注入一个共模(零序)偏置(中点钳位 −(max+min)/2)，把线电压顶得更高——比正弦 PWM 多约 15% 的母线电压利用率;相当于同样母线电压能输出更大转矩/转速', step: 4, evidence: '逆 Clarke 得三相电压后做中点钳位、就是 SVPWM' }),
        distractors: () => ['开关损耗更低、发热更少', '不需要测转子角度', '能省掉两个 PI 控制器'],
      },
      {
        id: 'foc_cascade', label: 'FOC 在级联 PID 的哪一环',
        ask: 'FOC 电流环在机器人关节的级联 PID 里处于哪一环?和 Dummy-Robot 的 FK/IK 什么关系?', kind: 'choice',
        compute: () => ({ answer: '最内环、带宽最高(20kHz):位置环→速度环→电流环，上一环的输出是下一环的设定值。FK/IK 把末端位姿解成关节角、下发到关节;这套 FOC 电流环就是把关节角指令变成协调的三相电流去执行的底层', step: 1, evidence: 'Dummy-Robot:STM32F4 解六轴 IK→CAN 下发→各关节 Ctrl-Step 电流环执行' }),
        distractors: () => ['最外环、直接接收位姿指令', '和 FK/IK 无关、是独立系统', '在速度环外面、管全局规划'],
      },
      {
        id: 'foc_idtarget', label: 'i_d 目标值是多少',
        ask: '为了最大转矩每安培(MTPA)，表贴永磁/步进电机 FOC 电流环里 i_d 的目标值 i_d* 设为多少?', kind: 'number',
        compute: t => { const f = t as unknown as { idTarget?: number }[]; const l = f[f.length - 1]; const v = l?.idTarget ?? 0; return ({ answer: String(v), step: 3, evidence: `i_d*=${v}:i_d 不产生转矩、只发热,设 0 让每安培都出力(MTPA);高速弱磁才 <0` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'miniduck', title: 'Open Duck Mini · 学会走路', kernel: miniduckKernel as Kernel<unknown>, doc: trivialDoc('miniduck'),
    facts: [
      {
        id: 'mk_reward_vs_learn', label: '模仿奖励 vs 模仿学习',
        ask: 'Open Duck Mini 的"模仿奖励"(imitation reward)和 ACT/BC 的"模仿学习"(imitation learning)是一回事吗?', kind: 'choice',
        compute: () => ({ answer: '不是，同词反机制。模仿奖励=RL 里一个奖励项，奖励跟踪相位对齐的参考步态(会探索、能从扰动恢复);模仿学习=监督克隆人类示教动作(漂出分布就累积误差 covariate shift、不会自恢复)', step: 1, evidence: '鸭子用 DeepMimic 式逐帧相位跟踪奖励、非 AMP(无判别器);走路是 Brax PPO 强化学习出来的' }),
        distractors: () => ['是，都是从示教数据克隆动作', '不是，模仿奖励更快但本质都是监督学习', '是，只是模仿奖励在仿真里、模仿学习在真机'],
      },
      {
        id: 'mk_paradigm', label: '为什么 locomotion 用 RL 不用 BC',
        ask: 'Open Duck Mini 的走路为什么用强化学习(PPO)训练，而不是像 ACT 那样行为克隆?', kind: 'choice',
        compute: () => ({ answer: '新形态没有现成示教者;接触富、混杂(每次落脚/离地都切换)的动力学;而且需要扰动恢复——BC 没有恢复能力、只会累积误差。RL 能探索并沿奖励梯度找到鲁棒步态', step: 1, evidence: '在 MuJoCo Playground 里 Brax PPO 训练、随机推搡教会"推不倒"' }),
        distractors: () => ['BC 太慢、RL 更快', '因为没有 GPU 只能用 RL', 'RL 不需要奖励函数、更省事'],
      },
      {
        id: 'mk_actorcritic', label: '非对称 actor-critic',
        ask: 'Open Duck Mini 的 actor(部署用)和 critic(只训练用)看到的观测为什么不一样?', kind: 'choice',
        compute: () => ({ answer: 'critic 训练时能看真值特权量(base 线速度、全参考帧、接触力),学得更稳更快;actor 只用真机测得到的量(IMU 陀螺/加速度、指令、关节位/速、动作历史、相位)——所以部署时不依赖任何特权量。base 线速度真机测不到、故意不给 actor', step: 1, evidence: '非对称 actor-critic:critic 用 privileged_state、actor 用可部署观测' }),
        distractors: () => ['actor 更聪明所以给它更多信息', '两者一样、只是网络大小不同', 'critic 看得少、防止过拟合'],
      },
      {
        id: 'mk_imit_term', label: '模仿奖励的主导项',
        ask: '模仿奖励里权重最大(主导)的是哪一项?它买来了什么?', kind: 'choice',
        compute: () => ({ answer: '关节位置跟踪项 −15·‖q_leg − q̂_leg‖²(权重 15、最狠)。它把训练拉向那条物理可行的参考步态 → 得到自然、对称、像 BD-X 的步态;去掉它,只奖励速度,策略会退化成能量最省的"丑走"', step: 4, evidence: '本例只velocity 模式 ‖q−q̂‖²=0.365 却不扣分→步态退化，证明模仿项买自然步态' }),
        distractors: () => ['存活奖励 alive、防止摔倒', '力矩惩罚、为了省电', '速度跟踪、为了走得快'],
      },
      {
        id: 'mk_alive', label: '直立这一步的存活奖励',
        ask: '带模仿奖励、机器人直立不倒时，这一步的存活(alive)奖励是多少?', kind: 'number',
        compute: t => { const f = t as unknown as { alive?: number }[]; const l = f[f.length - 1]; const a = l?.alive ?? 20; return ({ answer: String(a), step: 3, evidence: `alive=+${a}(站着不倒);摔了则 0——站着本身就值 ${a} 分,是"别摔"的最强激励` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'teleop', title: 'LeRobot · 主从遥操作', kernel: teleopKernel as Kernel<unknown>, doc: trivialDoc('teleop'),
    facts: [
      {
        id: 'tp_noik', label: 'follower 跟随为什么不用 IK',
        ask: 'SO-101 主从遥操作里 follower 跟随 leader，为什么通常不用逆运动学(IK)?', kind: 'choice',
        compute: () => ({ answer: '两臂同构(连杆尺寸完全相同)——直接把 leader 的关节角当 follower 目标，就复现同一末端位姿，无需 IK。只有两臂结构不同(如遥操作人形手)才要逆解/重定向(retargeting)', step: 1, evidence: '同构→关节空间直接复制；异构才需要 IK/retarget' }),
        distractors: () => ['IK 太慢，改用查表近似', 'follower 有专门的 IK 芯片代劳', 'follower 只是回放录像、不算 IK'],
      },
      {
        id: 'tp_calib', label: '原始舵机码怎么变成角度',
        ask: '舵机回报 0~4095 的原始码，怎么标定成关节角度?为什么需要 homing_offset?', kind: 'choice',
        compute: () => ({ answer: '角 = (码 − homing_offset) × (360/4096)。每个舵机装配时零位随机(舵盘花键任意插)，homing_offset 记录"这个电机 0°对应哪个码"；360/4096 是 12 位分辨率。标定还含 range/符号，把不同装配统一到同一角度约定', step: 2, evidence: '0~4095=12 位；homing_offset 消除装配零位差异' }),
        distractors: () => ['码直接就是角度(码/4096×360)、不用 homing', '按码的奇偶判正负', '每次上电现测、不存标定'],
      },
      {
        id: 'tp_maxrel', label: 'max_relative_target 防什么',
        ask: 'max_relative_target 每步把 follower 的移动限幅在 ±阈值内，防的是什么?', kind: 'choice',
        compute: () => ({ answer: '防通信抖动/丢包/leader 被碰导致目标角瞬间大跳变时，follower 一次危险急跳(甩臂撞坏)。goal=present+clamp(Δ,±阈值)，每步只挪一小段', step: 3, evidence: '本例腕转抖动 Δ≈90°；开钳→挪 15°平稳，关→急跳 90°危险' }),
        distractors: () => ['防舵机过热', '防关节角超出 0~360 范围', '让 follower 动得更快'],
      },
      {
        id: 'tp_data', label: '遥操作和示教数据的关系',
        ask: '主从遥操作和 ACT/Diffusion/BC 训练用的示教数据，是什么关系?', kind: 'choice',
        compute: () => ({ answer: '遥操作时同步录下 follower 的 (observation.state, observation.images, action)——这一串就是模仿学习(ACT/Diffusion/BC)训练用的示教数据集。遥操作是采集示教数据的核心入口', step: 4, evidence: '配合 delta_timestamps 取时序窗口、归一化统计量，喂进策略' }),
        distractors: () => ['没关系，示教数据是仿真里生成的', '遥操作只是调试、不产生训练数据', '示教数据靠强化学习自己探索出来'],
      },
      {
        id: 'tp_move', label: '被钳关节这一步挪多少度',
        ask: 'max_relative_target 阈值 15°，腕转一步要跳 Δ≈90° 被钳；follower 当前 -2°，这一步实际挪了多少度?', kind: 'number',
        compute: t => { const f = t as unknown as { joints?: { present: number; goal: number; clamped: boolean }[] }[]; const j = f.find(x => x.joints)?.joints?.find(x => x.clamped); const mv = j ? Math.round(Math.abs(j.goal - j.present)) : 15; return ({ answer: String(mv), step: 3, evidence: `Δ=89.89°>15° → 钳到 +15°；当前 -2°→目标 13°，实际只挪 |13−(−2)|=${mv}°(=阈值)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'normstats', title: 'LeRobot · 数据集归一化', kernel: normstatsKernel as Kernel<unknown>, doc: trivialDoc('normstats'),
    facts: [
      {
        id: 'ns_when', label: '归一化统计量什么时候算',
        ask: 'LeRobot 的归一化统计量(μ/σ/min/max)是什么时候、算几遍的?和 BatchNorm 有何不同?', kind: 'choice',
        compute: () => ({ answer: '在整套数据集上离线算一遍、存进 meta/stats.json；归一化因此是固定、可逆的仿射变换，训练/部署完全一致。BatchNorm 是每个 batch 现算、训练和推理行为不同', step: 1, evidence: 'σ=√(E[x²]−μ²) 一遍聚合；换数据集要重算' }),
        distractors: () => ['每个 batch 现算(和 BatchNorm 一样)', '每个 epoch 重算一次', '推理时按当前样本实时算'],
      },
      {
        id: 'ns_meanstd', label: 'MEAN_STD 公式与适用',
        ask: 'MEAN_STD 归一化的公式是什么?通常给哪个策略、有什么好处?', kind: 'choice',
        compute: () => ({ answer: "x'=(x−μ)/(σ+eps)，拉成 ~0 均值、单位尺度；ACT 默认。对无界的关节角/力矩自然，对离群相对稳(离群只把 σ 拉大一点、不挤扁其它值)", step: 2, evidence: 'eps 防止除零；均值为 0 的特征归一化后保持符号' }),
        distractors: () => ["x'=x/max，缩到 [0,1]", "x'=(x−min)/(max−min)，缩到 [0,1]", "x'=log(x)，取对数"],
      },
      {
        id: 'ns_minmax', label: 'MIN_MAX 为什么给 Diffusion',
        ask: 'MIN_MAX 归一化映射到哪个区间?为什么 Diffusion Policy 用它、代价是什么?', kind: 'choice',
        compute: () => ({ answer: "x'=2(x−min)/(max−min)−1 映射到 [-1,1]；Diffusion 的加噪 schedule 假设数据在 [-1,1]。代价是离群敏感——一个离群值会把其它正常样本挤到紧贴边界、彼此难分", step: 3, evidence: '本例力矩离群 3.0→+1，正常样本 0.1~0.3 全挤到 -1 附近' }),
        distractors: () => ['映射到 [0,1]，因为图像像素是 [0,1]', '映射到 [-π,π]，因为是关节角', '映射到 [0,∞)，因为力矩非负'],
      },
      {
        id: 'ns_unnorm', label: '策略输出能不能直接发',
        ask: '策略网络预测出一串动作，能直接发给机器人吗?', kind: 'choice',
        compute: () => ({ answer: '不能。策略输出的是归一化空间的动作，必须用同一套存好的统计量反归一化(x=x′·σ+μ 或 x=(x′+1)/2·(max−min)+min)再发。漏了输出反归一化=动作幅度全错、像"没力气"，是部署最常见的静默 bug', step: 4, evidence: '两端各一次:输入归一化观测、输出反归一化动作，同一套统计量' }),
        distractors: () => ['能，网络输出就是真实动作值', '能，机器人固件会自己换算', '能，只要输入端归一化过就行'],
      },
      {
        id: 'ns_negcount', label: 'θ 归一化后几个负数',
        ask: '关节角 θ=[-2.8,-1.2,0,0.4,1.6,2.0] 均值恰为 0，经 MEAN_STD(=除以 σ)归一化后，有几个样本是负数?', kind: 'number',
        compute: t => { const f = t as unknown as { cols?: { name: string; ms: number[] }[] }[]; const c = f.find(x => x.cols)?.cols?.[0]; const n = c ? c.ms.filter(v => v < 0).length : 2; return ({ answer: String(n), step: 2, evidence: `μ=0 → 归一化保持符号；原始 -2.8、-1.2 为负 → 归一化后仍为负，共 ${n} 个(0 归一化后仍是 0)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'deltats', title: 'LeRobotDataset · 时序窗口', kernel: deltatsKernel as Kernel<unknown>, doc: trivialDoc('deltats'),
    facts: [
      {
        id: 'dt_window', label: 'delta_timestamps 怎么把秒翻成帧',
        ask: '策略要一段时序窗口(如未来 0~0.08 秒的动作)，delta_timestamps 怎么把"秒"翻成"取哪些帧"?', kind: 'choice',
        compute: t => { const f = t as unknown as { fps: number }[]; const fps = f.find(x => x.fps != null)?.fps ?? 50; return ({ answer: `delta_idx = round(偏移 × fps)——fps=${fps} 时 -0.06s→-3 帧；再定位到"当前帧+偏移"。用 fps 换算让不同采集频率的数据集通用`, step: 1, evidence: '合法性 |偏移·fps−round|/fps ≤ 容差，保证偏移正好落在某帧' }) },
        distractors: () => ['直接按秒数当帧号用', '固定取前后各 3 帧、不管 fps', '按文件字节偏移取'],
      },
      {
        id: 'dt_boundary', label: '取的帧超出本轨迹末尾怎么办',
        ask: '取"未来动作块"时，有些帧超出了当前这条 episode 的末尾，怎么办?', kind: 'choice',
        compute: () => ({ answer: 'clamp 到本 episode 的边界帧(不跨到别条 episode、否则把两段无关轨迹拼一起)，并把这些越界帧标 is_pad=True', step: 2, evidence: '越界钳边界 + pad 掩码，两手都要' }),
        distractors: () => ['去借下一条 episode 开头的帧凑数', '报错、这个样本作废', '直接用零填充、不做标记'],
      },
      {
        id: 'dt_pad', label: 'pad 掩码干什么用',
        ask: 'delta_timestamps 给出的 is_pad 布尔掩码，训练时有什么用?', kind: 'choice',
        compute: () => ({ answer: '喂给 loss：把 padding(边界处钳出来的重复)帧排除，不让它们污染训练梯度。ACT/Diffusion 都用它', step: 3, evidence: '被钳的帧是"借来的"、不是真数据，必须从 loss 里剔掉' }),
        distractors: () => ['没什么用、只是记录', '用来给数据打分', '决定学习率'],
      },
      {
        id: 'dt_storage', label: 'LeRobotDataset 为什么图像走 mp4',
        ask: 'LeRobotDataset 为什么低维信号(state/action)存 parquet、而相机图像存 mp4?', kind: 'choice',
        compute: () => ({ answer: '图像占绝大多数体积，用视频编码(mp4)压得狠、解码也快；低维高频信号用列存 parquet(一个文件放很多 episode)高效读取', step: 4, evidence: '按数据特性分开存:图像走视频、低维走列存表' }),
        distractors: () => ['mp4 是唯一能存机器人数据的格式', '图像不重要所以随便存', 'parquet 存不了数字'],
      },
      {
        id: 'dt_padcount', label: '靠结尾采样动作块几个越界',
        ask: '本例当前帧 158、episode 到 160、动作块偏移未来 5 帧(0~4)，有几个帧越界被标 pad?', kind: 'number',
        compute: t => { const f = t as unknown as { act?: { pad: boolean }[] }[]; const d = f.find(x => x.act && x.act.some(c => 'pad' in c)); const n = d?.act?.filter(c => c.pad).length ?? 3; return ({ answer: String(n), step: 3, evidence: `158+2=160、+3=161、+4=162 都 ≥160(episode 末) → 钳到 159、标 pad，共 ${n} 个` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'lfucache', title: '手写 LFU 缓存', kernel: lfucacheKernel as Kernel<unknown>, doc: trivialDoc('lfucache'),
    facts: [
      {
        id: 'lfu_vs_lru', label: 'LFU 和 LRU 的淘汰规则差别',
        ask: 'LFU 缓存和 LRU 缓存，容量满时淘汰谁的规则有什么本质区别?', kind: 'choice',
        compute: () => ({ answer: 'LRU 淘汰"最久没用的"（只看时间/最近使用）；LFU 淘汰"用得最少的"（看访问频率），频率相同时才再按最久没用打破平手', step: 4, evidence: 'put(3) 时淘汰频率最低的 2，而不是最久没用的' }),
        distractors: () => ['两者完全一样', 'LFU 淘汰最近刚用的', 'LFU 随机淘汰'],
      },
      {
        id: 'lfu_tie', label: 'LFU 频率相同时淘汰谁',
        ask: 'LFU 里有多个 key 的访问频率并列最低，这时淘汰哪一个?', kind: 'choice',
        compute: () => ({ answer: '并列最低频时，用 LRU 打破平手——淘汰这些同频 key 里最久没被使用的那个', step: 7, evidence: 'put(4) 时 1 和 3 都是频率 2，淘汰更久没用的 1' }),
        distractors: () => ['淘汰 key 最小的', '淘汰最近刚用的', '随机淘汰一个同频的'],
      },
    ],
  },
  {
    id: 'trie', title: 'Trie 自动补全', kernel: trieKernel as Kernel<unknown>, doc: trivialDoc('trie'),
    facts: [
      {
        id: 'why_trie', label: '自动补全为什么用 Trie 而不是遍历词表',
        ask: '按前缀补全候选词，为什么用 Trie（前缀树），而不是遍历整个词表找前缀匹配的?', kind: 'choice',
        compute: () => ({ answer: 'Trie 里公共前缀共享节点，沿前缀路径走一遍就到"前缀节点"，只跟前缀长度有关、和词表大小无关；遍历词表是 O(N)。且公共前缀共享还省空间', step: 5, evidence: '走 c→a→r 三步就定位到前缀节点，不用扫全部词' }),
        distractors: () => ['Trie 更省内存所以更快', '遍历词表根本找不到', '两者速度一样'],
      },
      {
        id: 'complete_flow', label: 'Trie 补全的三步',
        ask: '输入前缀「car」后，Trie 自动补全是怎么给出候选的?', kind: 'choice',
        compute: () => ({ answer: '① 沿 Trie 走到「car」前缀节点；② 从该节点 DFS 收集子树里所有完整词(car/card/care)；③ 按热度排序取 Top-K(care/car/card)', step: 7, evidence: '收集到 car(3)/card(2)/care(4)，按频率排 care(4)>car(3)>card(2)' }),
        distractors: () => ['直接返回前缀节点的那个词', '把整棵树的词都返回', '按字母序返回不排热度'],
      },
    ],
  },
  {
    id: 'quickselect', title: '快速选择 Quickselect', kernel: quickselectKernel as Kernel<unknown>, doc: trivialDoc('quickselect'),
    facts: [
      {
        id: 'one_side', label: 'Quickselect 比快排快在哪',
        ask: '求第 K 大，Quickselect 和快速排序都用 partition，为什么 Quickselect 平均只要 O(n)?', kind: 'choice',
        compute: () => ({ answer: 'partition 后 pivot 落到它的最终位置，Quickselect 拿这个位置和目标比，只往目标所在的一侧递归、另一半直接丢；快排两侧都要递归。每轮丢一半 → T(n)=T(n/2)+O(n)=O(n)', step: 1, evidence: '第1轮 pivot 落 idx5 > 目标 4，右半整个丢掉、只递归左半' }),
        distractors: () => ['Quickselect 用了更好的 pivot', 'Quickselect 不用 partition', '两者复杂度其实一样'],
      },
      {
        id: 'pivot_compare', label: 'partition 后怎么决定递归哪一侧',
        ask: 'partition 让 pivot 落在下标 P，目标下标是 T，怎么决定下一步搜哪边?', kind: 'choice',
        compute: () => ({ answer: 'P==T 就是答案；P>T 说明目标在左半，只递归左；P<T 说明目标在右半，只递归右', step: 2, evidence: '第2轮 pivot 落 idx0 < 目标 4 → 只递归右半 [1,4]' }),
        distractors: () => ['总是递归左半', '两边都要递归一遍', '看 pivot 的值大小而不是下标'],
      },
    ],
  },
  {
    id: 'lockstrategy', title: '乐观锁 vs 悲观锁', kernel: lockstrategyKernel as Kernel<unknown>, doc: trivialDoc('lockstrategy'),
    facts: [
      {
        id: 'optimistic_how', label: '乐观锁怎么发现冲突',
        ask: '乐观锁不加锁，两个事务同时改一行时，它靠什么发现"我读之后有人改过"?', kind: 'choice',
        compute: () => ({ answer: '靠版本号：读时记下 version，更新时 UPDATE … WHERE version=旧值。如果期间被别人改过、版本变了，这条 UPDATE 就匹配不到、影响 0 行 → 更新失败，于是重读重试', step: 5, evidence: 'T2 的 UPDATE WHERE version=1 匹配不到(版本已是2)→失败→重试' }),
        distractors: () => ['靠给行加锁', '靠数据库自动检测', '靠比较两个事务的时间戳'],
      },
      {
        id: 'when_which', label: '乐观锁和悲观锁各适合什么场景',
        ask: '乐观锁和悲观锁分别适合什么场景?', kind: 'choice',
        compute: () => ({ answer: '乐观锁适合读多写少、冲突罕见（不加锁并发高，偶尔重试代价小，如点赞数、MVCC）；悲观锁适合写多、冲突频繁、必须一次成功（先加锁串行，稳但并发低，如扣钱、抢票核心）', step: 11, evidence: '冲突少→乐观(重试便宜)；冲突多→悲观(重试太多、不如直接锁)' }),
        distractors: () => ['乐观锁任何场景都更好', '悲观锁任何场景都更好', '两者适用场景完全一样'],
      },
    ],
  },
  {
    id: 'bufferpool', title: '缓冲池 midpoint-LRU', kernel: bufferpoolKernel as Kernel<unknown>, doc: trivialDoc('bufferpool'),
    facts: [
      {
        id: 'scan_pollution', label: '普通 LRU 遇到全表扫描的问题',
        ask: '如果缓冲池用普通 LRU，一次全表扫描会造成什么问题?', kind: 'choice',
        compute: () => ({ answer: '全表扫描把海量只用一次的冷页塞到 LRU 头，把真正被反复访问的热点页挤到尾部淘汰——扫描完缓存全是没用的冷页、热点全没了（缓存污染）', step: 0, evidence: '普通 LRU 新页都进链表头，扫描页会顶掉热点' }),
        distractors: () => ['扫描会让缓存变大', '扫描其实对普通 LRU 没影响', '扫描会触发死锁'],
      },
      {
        id: 'midpoint_how', label: 'midpoint-LRU 怎么保护热点',
        ask: 'MySQL InnoDB 的 midpoint-LRU 靠什么让全表扫描冲不掉热点页?', kind: 'choice',
        compute: () => ({ answer: 'LRU 链分 young(热)+old(冷) 两段，新页插到中点(old 头)而非链表头，只有在 old 段再次被访问才升 young。扫描页只用一次、进不了 young，很快从 old 尾淘汰，young 里的热点不受影响', step: 5, evidence: '扫描 S1/S2/S3 全在 old 段进出，young[A,B,C] 毫发无损' }),
        distractors: () => ['把缓冲池扩大一倍', '扫描时暂时关掉 LRU', '给热点页加锁不让淘汰'],
      },
    ],
  },
  {
    id: 'feed', title: '设计 Feed 流', kernel: feedKernel as Kernel<unknown>, doc: trivialDoc('feed'),
    facts: [
      {
        id: 'push_pull', label: 'Feed 的推模型和拉模型差别',
        ask: 'Feed 时间线的"推（写扩散）"和"拉（读扩散）"，各快在哪、慢在哪?', kind: 'choice',
        compute: () => ({ answer: '推：发帖时写进每个粉丝收件箱，读时直接读自己收件箱→读 O(1)，但写 O(粉丝数)；拉：发帖只存自己 outbox，读时现拉所有关注人的帖归并→写 O(1)，但读要归并 O(关注数)', step: 6, evidence: '本例普通用户走推累计写 9 次(读O(1))，大V走拉省 2,000,000 次写(读时拉+归并)' }),
        distractors: () => ['推和拉都读快', '推写快、拉读快', '两者没区别'],
      },
      {
        id: 'big_v', label: '推拉结合怎么解决大 V 问题',
        ask: '大 V 有百万粉丝，推拉结合怎么避免他发帖时的写放大?', kind: 'choice',
        compute: () => ({ answer: '普通用户走推（读快）；大 V 走拉——发帖不推给百万粉丝、只存自己 outbox，粉丝刷时才现拉大 V 的帖、和收件箱归并。既避免写放大、普通场景又读快', step: 5, evidence: '本例大 V 100 万粉，2 帖走拉省下 2,000,000 次写' }),
        distractors: () => ['给大 V 更多服务器推', '禁止大 V 发帖太频繁', '大 V 也全量推、只是异步'],
      },
    ],
  },
  {
    id: 'contactlcp', title: '接触动力学 · 摩擦锥', kernel: contactlcpKernel as Kernel<unknown>, doc: trivialDoc('contactlcp'),
    facts: [
      {
        id: 'lcp_normal', label: '法向接触为什么是互补',
        ask: '物理引擎里法向接触为什么写成互补条件 0≤f_n⊥φ≥0、而不是一个普通函数?', kind: 'choice',
        compute: () => ({ answer: '因为接触非光滑/集值:要么分离(间隙 φ>0→支持力 f_n=0)、要么接触(φ=0→f_n≥0),二者必居其一且乘积为0;而且法向力只能推不能拉(面不会吸住物体)。没法写成一个光滑的 f_n(φ),只能用互补/LCP', step: 2, evidence: '互补=非光滑的来源;f_n≥0 只推不拉' }),
        distractors: () => ['因为接触力是常数、直接查表', '因为要节省计算、近似成互补', '因为法向力可以拉也可以推'],
      },
      {
        id: 'lcp_cone', label: '库仑摩擦锥是什么',
        ask: '库仑摩擦锥 |f_t|≤μf_n 里，粘(stick)和滑(slip)分别对应锥的什么位置?', kind: 'choice',
        compute: () => ({ answer: '粘(v_t=0):f_t 在锥内部(可取任意平衡外力的反作用力);滑:f_t 落在锥边界(=μf_n)、方向反着滑动阻滑。所以粘/滑就是摩擦锥的 KKT 开关:锥内→粘、锥边界→滑', step: 3, evidence: '最大静摩擦=μf_n;滑时摩擦饱和在边界' }),
        distractors: () => ['粘在边界、滑在内部', '粘和滑都在锥心', '摩擦力和法向力无关'],
      },
      {
        id: 'lcp_stickslip', label: '粘/滑怎么判定',
        ask: '滑块受水平推力 F、最大静摩擦 μf_n，怎么判定粘还是滑?加速度多少?', kind: 'choice',
        compute: () => ({ answer: '比 F 和 μf_n:F≤μf_n→粘(摩擦力 f_t=F 在锥内、净力 0、a=0);F>μf_n→滑(摩擦力饱和在 μf_n、a=(F−μf_n)/m)。本例重推 F=6>4.905→滑、a=(6−4.905)/1=1.095', step: 4, evidence: '粘 a=0、滑 a=(F−μf_n)/m' }),
        distractors: () => ['一直滑动、a=F/m', 'F 越大摩擦越大、永远粘住', '摩擦力总等于 F、a 恒为 0'],
      },
      {
        id: 'lcp_engine', label: '引擎每步怎么解接触',
        ask: '物理引擎(MuJoCo/Bullet)每步是怎么处理所有接触的?圆锥怎么进 LCP?', kind: 'choice',
        compute: () => ({ answer: '每步把所有接触组成一个线性互补问题(LCP)或凸 QP,变量是接触冲量(f_n、切向 β、滑动松弛 λ),用 PGS/Lemke/内点法解;圆锥常线性化成金字塔(几个切向方向 β≥0、Σβ≤μf_n)变成线性 LCP,面越多越准越慢', step: 5, evidence: '金字塔=圆锥的线性化;冲量级处理碰撞(Painlevé)' }),
        distractors: () => ['逐个接触独立用 ODE 积分', '忽略摩擦、只算法向', '用一次逆运动学求解'],
      },
      {
        id: 'lcp_accel', label: '重推时滑块加速度',
        ask: '重推 F=6N、滑动摩擦饱和在 μf_n≈4.9N、m=1kg，滑块加速度 a=(F−μf_n)/m 约多少?(m/s²，一位小数)', kind: 'number',
        compute: t => { const f = t as unknown as { accel?: number }[]; const l = f.find(x => x.accel != null && x.accel > 0); const v = l?.accel != null ? Math.round(l.accel * 10) / 10 : 1.1; return ({ answer: String(v), step: 4, evidence: `a=(6−4.905)/1=1.095≈${v} m/s²;粘住时则 a=0` }) },
        distractors: () => ['0', '0.5', '2.2', '6.0'],
      },
    ],
  },
  {
    id: 'computedtorque', title: '计算力矩控制', kernel: computedtorqueKernel as Kernel<unknown>, doc: trivialDoc('computedtorque'),
    facts: [
      {
        id: 'ct_errordyn', label: '代回后误差动力学变成什么',
        ask: '计算力矩控制 τ=M(q̈_d+Kd ė+Kp e)+Cq̇+G 代回被控对象后，误差动力学变成什么?', kind: 'choice',
        compute: () => ({ answer: 'ë + Kd·ė + Kp·e = 0：Cq̇+G 两边抵消、M 约掉,非线性耦合系统被线性化成每个关节独立、解耦的二阶线性系统。可任意配极点(Kp=ωₙ²、Kd=2ζωₙ)、一套增益全局适用(无需增益调度)', step: 5, evidence: '这就是"反馈线性化":用模型把非线性拉直' }),
        distractors: () => ['仍是原来的非线性耦合系统', '变成一阶线性系统 ė+Kp e=0', '变成随构型变的时变系统'],
      },
      {
        id: 'ct_vs_pid', label: '为什么比纯 PID 好',
        ask: '计算力矩控制相比纯 PID 好在哪?为什么纯 PID 高速时跟踪差?', kind: 'choice',
        compute: () => ({ answer: '纯 PID 用固定增益硬扛非线性(重力/惯性耦合/科氏∝q̇²),只能保守整定、高速大幅时误差长,重力还让它稳态下垂;计算力矩用模型 M/C/G 主动抵消这些非线性,误差动力学变线性解耦、增益可精确配、全局一致', step: 1, evidence: '模型based vs 纯调参;Cq̇+G 前馈抵消非线性' }),
        distractors: () => ['计算力矩不需要传感器', '计算力矩增益可以设得无穷大', '纯 PID 无法控制机械臂'],
      },
      {
        id: 'ct_gravcomp', label: '只重力补偿是什么档',
        ask: '只重力补偿(τ=Kp e+Kd ė+G)和全计算力矩相比，是什么定位?', kind: 'choice',
        compute: () => ({ answer: '"够用又省"的折中:只前馈掉重力 G(所以静止能定住、无稳态下垂),但没消掉惯性耦合和科氏 → 误差动力学仍非线性耦合。设定点调节(定位)够用、轨迹跟踪(高速)差', step: 4, evidence: '消重力=省下 M·v 和 Cq̇;设定点调节的最省档' }),
        distractors: () => ['和全计算力矩完全等价', '比全计算力矩更精确', '完全没用、不如纯 PID'],
      },
      {
        id: 'ct_rnea', label: '计算力矩里的前馈=什么',
        ask: '计算力矩控制里的 Cq̇+G 前馈项，工程上怎么高效算?', kind: 'choice',
        compute: () => ({ answer: '就是一次 RNEA(递归牛顿-欧拉)调用:令 q̈=q̈_d+Kd ė+Kp e(伺服律 v)、q̇=真实速度,RNEA 直接返回 τ=M·v+Cq̇+G。所以计算力矩控制复用了逆动力学 RNEA', step: 3, evidence: '整条 τ=M·v+Cq̇+G 就是 RNEA(q,q̇,v)' }),
        distractors: () => ['要显式组 M、C、G 三个矩阵再相乘', '用一次正向动力学', '查预先标定的力矩表'],
      },
      {
        id: 'ct_innerv', label: '伺服律算出的加速度指令',
        ask: '计算力矩伺服律 v=q̈_d+Kd ė+Kp e，关节1(q̈_d=0,Kd=20,ė₁=−0.2,Kp=100,e₁=0.1)算出 v₁=?', kind: 'number',
        compute: t => { const f = t as unknown as { innerV?: number[] }[]; const l = f.find(x => x.innerV); const v = l?.innerV ? Math.round(l.innerV[0]!) : 6; return ({ answer: String(v), step: 2, evidence: `v₁=0+20·(−0.2)+100·0.1=−4+10=${v}(PD 作用在加速度上、当"想要的 q̈")` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'fwddyn', title: '正向动力学 · 仿真', kernel: fwddynKernel as Kernel<unknown>, doc: trivialDoc('fwddyn'),
    facts: [
      {
        id: 'fwd_vs_inv', label: '正向 vs 逆动力学',
        ask: '正向动力学和逆动力学(RNEA)有什么区别?各用在哪?', kind: 'choice',
        compute: () => ({ answer: '逆动力学:给运动(q,q̇,q̈)求力矩 τ——用于控制(前馈力矩);正向动力学:给力矩 τ 求加速度 q̈=M⁻¹(τ−Cq̇−G)——用于仿真。二者互逆(把 RNEA 算出的 τ 喂回正向动力学会精确还原 q̈)', step: 1, evidence: '逆=控制、正=仿真;round-trip 精确还原' }),
        distractors: () => ['一样，只是叫法不同', '正向算位置、逆向算速度', '正向用于真机、逆向用于仿真'],
      },
      {
        id: 'fwd_invert', label: 'M 为什么可逆却不显式求逆',
        ask: '正向动力学 q̈=M⁻¹(τ−Cq̇−G) 里，为什么 M 一定可逆、工程上却不显式求逆?', kind: 'choice',
        compute: () => ({ answer: 'M 对称正定(是动能度规 T=½q̇ᵀMq̇)→ det M≠0 必可逆、正向动力学良定义。但实际不显式求逆——对 SPD 矩阵用 Cholesky 分解解 M q̈=(τ−b) 更快更稳;大自由度用 ABA(O(n))连 M 都不组', step: 2, evidence: 'SPD→Cholesky;显式求逆慢又不稳' }),
        distractors: () => ['M 不一定可逆、要加正则项', 'M 是对角阵、直接取倒数', 'M 可逆但求逆是唯一办法'],
      },
      {
        id: 'fwd_bias', label: '偏置 b 怎么算',
        ask: '正向动力学里的偏置 b(与加速度无关的部分)是什么?怎么高效算?', kind: 'choice',
        compute: () => ({ answer: 'b = C(q,q̇)q̇ + G(q)(科氏/离心 + 重力)。工程上用一次 RNEA 调用(令 q̈=0)算:RNEA 返回 τ=M·0+Cq̇+G=b。所以正向动力学复用了逆动力学(RNEA)', step: 1, evidence: 'b=Cq̇+G;一次 q̈=0 的 RNEA 直接给出' }),
        distractors: () => ['b 就是重力 G、不含科氏', 'b 是常数、不随状态变', 'b 需要单独组 C 和 G 矩阵才能算'],
      },
      {
        id: 'fwd_simloop', label: '正向动力学连到什么',
        ask: '正向动力学 + 积分一步，等于什么?它是哪些系统的核心?', kind: 'choice',
        compute: () => ({ answer: '等于物理仿真器循环里的一次迭代:读力矩→正向动力学求 q̈→半隐式欧拉积分(q̇←q̇+q̈dt、q←q+q̇dt)→下一帧。MuJoCo/Bullet/Drake 核心就是它;MPC 靠它预测未来;RL 训练在仿真里跑的也是它', step: 4, evidence: '仿真=反复跑正向动力学+积分;MPC/RL 都建在其上' }),
        distractors: () => ['等于一次逆运动学求解', '只用于离线分析、不用于实时', '是 SLAM 的核心循环'],
      },
      {
        id: 'fwd_det', label: '质量矩阵行列式',
        ask: '本例两连杆臂 q=[30°,45°]，质量矩阵 M 的行列式 det M(两位小数)约为多少?(它≠0 保证 M 可逆)', kind: 'number',
        compute: t => { const f = t as unknown as { detM?: number }[]; const l = f.find(x => x.detM != null); const v = l?.detM != null ? Math.round(l.detM * 100) / 100 : 0.32; return ({ answer: String(v), step: 2, evidence: `det M=M₁₁M₂₂−M₁₂²=2.37·0.33−0.69²≈${v}≠0,M 对称正定必可逆` }) },
        distractors: () => ['0.12', '0.68', '1.00', '0.05'],
      },
    ],
  },
  {
    id: 'rnea', title: '递归牛顿-欧拉 RNEA', kernel: rneaKernel as Kernel<unknown>, doc: trivialDoc('rnea'),
    facts: [
      {
        id: 'rnea_what', label: 'RNEA 的两次扫描做什么',
        ask: 'RNEA(递归牛顿-欧拉)的两次扫描分别在做什么?', kind: 'choice',
        compute: () => ({ answer: '外向(基→梢)传运动:ω_i=ω_{i−1}+q̇_i、质心线加速度 a=a_prev+α×r−ω²r 逐连杆往外传;内向(梢→基)传力:牛顿 F=m·a_c、欧拉 N=I·α,力/力矩往里传、投影关节轴得 τ。O(n)、不显式组 M/C/G', step: 1, evidence: '外向传运动学、内向传静力学,把牛顿-欧拉沿链递归组织' }),
        distractors: () => ['第一遍算 M、第二遍算 C 和 G', '第一遍前向、第二遍反向传播梯度', '两遍都从基座到梢、取平均'],
      },
      {
        id: 'rnea_gravity', label: 'RNEA 怎么把重力算进去',
        ask: 'RNEA 里重力是怎么算进去的?', kind: 'choice',
        compute: () => ({ answer: '重力技巧:给基座一个假加速度 a₀=−g(向上 g)。于是外向扫描时每根连杆都自动感到一个等于自重的惯性力,整条链免去单列的重力项——一行代码搞定重力', step: 2, evidence: '切无重力(a₀=0)时 τ 正好少掉一个 G,验证这个技巧' }),
        distractors: () => ['每根连杆单独加一项 m·g', '在最后的 τ 上统一加一个常数', '用一个单独的重力扫描'],
      },
      {
        id: 'rnea_complexity', label: 'RNEA 为什么比显式组 M 快',
        ask: 'RNEA 相比"显式组质量矩阵 M/C/G 再相乘"为什么更适合实时?', kind: 'choice',
        compute: () => ({ answer: 'RNEA 两次扫描 O(n) 时间、O(n) 内存、不组任何矩阵;显式组 M 是 O(n²)、还要存矩阵再相乘。自由度越多 RNEA 优势越大,是实时前馈力矩的主力。两者结果完全一致', step: 4, evidence: 'RNEA 结果 = M q̈+C q̇+G,只是算法更高效' }),
        distractors: () => ['RNEA 是近似算法、牺牲精度换速度', 'RNEA 用了 GPU 并行', 'RNEA 忽略了科氏项所以快'],
      },
      {
        id: 'rnea_building', label: 'RNEA 是哪些算法的构件',
        ask: 'RNEA 除了直接算逆动力学,还是哪些算法的构件?', kind: 'choice',
        compute: () => ({ answer: '①计算力矩控制的 Cq̇+G 前馈=一次 RNEA(令 q̈=q̈_d+Kd ė+Kp e);②CRBA 组质量矩阵 M:对每关节 j 调 RNEA(q̈=eⱼ、q̇=0、g=0)读出 M 的第 j 列;③ABA 正向动力学也是同套空间递归的延伸', step: 4, evidence: 'RNEA 是逆动力学基元,被控制和正向动力学复用' }),
        distractors: () => ['只能算逆动力学、别的用不上', '是 SLAM 的构件', '是路径规划的构件'],
      },
      {
        id: 'rnea_tau1', label: '含重力关节1的力矩',
        ask: '本例两连杆臂 q=[30°,45°]、q̇=[1,1]、q̈=[0.5,−0.5]、含重力，RNEA 算出关节1 力矩 τ₁(取整,N·m)?', kind: 'number',
        compute: t => { const f = t as unknown as { tau?: number[] }[]; const l = f.find(x => x.tau && x.tau[0] !== 0); const v = l?.tau ? Math.round(l.tau[0]!) : 14; return ({ answer: String(v), step: 3, evidence: `RNEA τ₁=13.8≈${v} N·m,与 M q̈+C q̇+G 完全一致;无重力则 τ₁=−0.22(少一个 G₁=14.01)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'dyneom', title: '机械臂运动方程', kernel: dyneomKernel as Kernel<unknown>, doc: trivialDoc('dyneom'),
    facts: [
      {
        id: 'dyn_notindep', label: '能不能每关节独立 PID',
        ask: '机械臂能不能"一个电机管一个关节、各自独立 PID"就行?', kind: 'choice',
        compute: () => ({ answer: '不能。各关节被惯性(质量矩阵非对角=耦合)、科氏/离心、重力强耦合,全写进一条运动方程 M(q)q̈+C(q,q̇)q̇+G(q)=τ。独立 PID 会被这些非线性耦合项拖累(尤其高速+重力)', step: 1, evidence: '动关节1 会通过 M₂₁ 在关节2 上生力矩;举在半空要 G;转得快有科氏' }),
        distractors: () => ['能，关节之间互不影响', '能，只要 PID 增益调大', '能，加个前馈就等价了'],
      },
      {
        id: 'dyn_mass', label: '质量矩阵非对角项是什么',
        ask: '机械臂质量矩阵 M(q) 的非对角项代表什么?M 有什么性质?', kind: 'choice',
        compute: t => { const f = t as unknown as { M?: number[][] }[]; const M = f.find(x => x.M)?.M; const off = M ? M[0]![1] : 0.69; return ({ answer: `非对角项(本例 M₁₂=${off})是**关节间的惯性耦合**——给一个关节加速度会在另一个关节上产生力矩;非对角≠0 就是耦合。M 还随构型变(cos q2)、且恒对称正定(是动能度规、故一定可逆)`, step: 2, evidence: 'M 对称正定→正向动力学良定义;非对角=耦合' }) },
        distractors: () => ['非对角是测量噪声、应忽略', '非对角是重力项', 'M 是常数矩阵、与姿势无关'],
      },
      {
        id: 'dyn_coriolis', label: '科氏离心项什么时候出现',
        ask: '运动方程里的 C(q,q̇)q̇(科氏+离心)项什么时候出现?为什么静态标定测不到?', kind: 'choice',
        compute: () => ({ answer: '只在运动时出现、与速度平方成正比(离心 q̇² + 科氏 q̇ᵢq̇ⱼ 交叉项);q̇=0 时全为 0。静态标定只能测到重力/摩擦、测不到这项,所以它是高速下丢精度/振动的元凶', step: 3, evidence: 'C·q̇=[−h(2q̇1q̇2+q̇2²), h q̇1²]、h=β sin q2;q̇=0→0' }),
        distractors: () => ['一直存在、即使静止', '只在有外力时出现', '只和重力方向有关'],
      },
      {
        id: 'dyn_gravcomp', label: '静止举着要不要力矩',
        ask: '机械臂静止(q̇=q̈=0)地举在半空，关节要不要输出力矩?这引出什么控制手段?', kind: 'choice',
        compute: () => ({ answer: '要,τ=G(q) 顶住重力(本例关节1 要 14.01 N·m)。这引出"重力补偿":把 G 项前馈掉,否则纯 PID 得靠积分硬扛、必然稳态下垂。更完整的是计算力矩控制 τ=M(q̈_d+Kd ė+Kp e)+Cq̇+G 抵消全部非线性', step: 4, evidence: '静止也要 τ=G;重力补偿=只前馈 G 的省档' }),
        distractors: () => ['不要，不动就不费力', '要，但只需静摩擦力矩', '要，但和构型无关、是常数'],
      },
      {
        id: 'dyn_gtorque', label: '静止举着关节1的重力力矩',
        ask: '本例两连杆臂静止举在 q=[30°,45°]，关节1 需要多大重力力矩顶住(N·m,取整)?', kind: 'number',
        compute: t => { const f = t as unknown as { G?: number[] }[]; const G = f.find(x => x.G)?.G; const v = G ? Math.round(G[0]!) : 14; return ({ answer: String(v), step: 4, evidence: `G₁=(m1 lc1+m2 l1)g cos q1+m2 lc2 g cos(q1+q2)=14.01≈${v} N·m;不补重力 PID 会稳态下垂` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'fk', title: '正向运动学 FK', kernel: fkKernel as Kernel<unknown>, doc: trivialDoc('fk'),
    facts: [
      {
        id: 'cum_angle', label: '累计朝向 cumθ 怎么算',
        ask: '三连杆机械臂 θ=[30°,60°,-30°]，正向运动学里"累计朝向 cumθ"是怎么来的、关节2 之后是多少?', kind: 'choice',
        compute: () => ({ answer: 'cumθᵢ = θ₁+θ₂+…+θᵢ，是从基座到当前关节的转角累加；关节2 之后 cumθ = 30+60 = 90°，所以那一节竖直向上走', step: 2, evidence: '关节2 后 cumθ=90°，从 (1.732,1) 沿 90° 走 L=2 → (1.732, 3)' }),
        distractors: () => ['只看当前关节角，关节2 后是 60°', 'cumθ 是各连杆长度之和', '累计朝向不影响末端位置'],
      },
      {
        id: 'fk_vs_ik', label: 'FK 和 IK 的区别',
        ask: '正向运动学 FK（关节角→末端）和逆运动学 IK（末端→关节角），难度和解的性质有什么本质区别?', kind: 'choice',
        compute: () => ({ answer: 'FK 是唯一解：关节角定了，沿连杆链 cos/sin 累加，末端位姿唯一确定（本例算出 (2.232,3.866)、朝向60°）。IK 反过来求关节角，可能多解、无解(够不到)或奇异，难得多', step: 3, evidence: 'FK 末端 (2.232,3.866) 由关节角唯一算出；IK 是反问题、不唯一' }),
        distractors: () => ['FK 和 IK 都是唯一解', 'IK 更简单因为直接读末端', '两者完全等价、可互相替代'],
      },
    ],
  },
  {
    id: 'ik', title: '逆运动学 IK', kernel: ikKernel as Kernel<unknown>, doc: trivialDoc('ik'),
    facts: [
      {
        id: 'multi_solution', label: 'IK 为什么会有多个解',
        ask: '二连杆机械臂逆运动学，用余弦定理算出 cosθ2 后 θ2=±acos(...)，这个±号意味着什么?', kind: 'choice',
        compute: () => ({ answer: '±两支对应两种姿势：肘朝下和肘朝上，两组关节角够到同一个末端点。这就是 IK 的"多解"——FK(唯一解)永远没有', step: 2, evidence: '本例 cosθ2=0 → θ2=±90° → 肘朝下(0°,90°) 与 肘朝上(90°,−90°) 都到 (2,2)' }),
        distractors: () => ['计算出错了，正确答案只有一个', '±号可以随意丢弃一个', '正负号表示误差范围'],
      },
      {
        id: 'reachable', label: 'IK 什么时候无解',
        ask: '给二连杆机械臂(L1=L2=2)一个末端目标，什么情况下逆运动学无解(够不到)?', kind: 'choice',
        compute: () => ({ answer: '目标到基座距离 r 超出可达范围 [|L1−L2|, L1+L2]=[0,4] 时无解：太远(r>4)伸直也够不到、太近(r<|L1−L2|)缩不进去。本例目标(2,2) r=2.828 在范围内够得到；(4.5,0) r=4.5>4 就无解', step: 1, evidence: 'r=2.828 ∈ [0,4] 够得到；r=4.5 > 4 手臂伸直也够不到' }),
        distractors: () => ['IK 永远有解，机械臂能到任何点', '只有目标在原点时无解', '关节数不够时才无解，和距离无关'],
      },
    ],
  },
  {
    id: 'trajectory', title: '轨迹规划', kernel: trajectoryKernel as Kernel<unknown>, doc: trivialDoc('trajectory'),
    facts: [
      {
        id: 'why_not_linear', label: '为什么不能匀速(线性插值)走',
        ask: '机器人关节从一个角度到另一个角度，为什么不能简单地线性插值(匀速)走过去?', kind: 'choice',
        compute: () => ({ answer: '匀速意味着速度在起点从 0 突跳到匀速值、终点又突跳回 0，那一瞬间加速度无穷大 → 电机顿挫、机械抖动。要平滑必须让速度在两端连续(为 0)', step: 1, evidence: '本例线性速度恒 45°/s，但起终点从 0 突跳=无穷加速度' }),
        distractors: () => ['匀速走速度太慢', '线性插值算不出中间位置', '匀速会走过头'],
      },
      {
        id: 'cubic_traj', label: '三次多项式怎么平滑起停',
        ask: '三次多项式轨迹 θ(t)=a0+a1t+a2t²+a3t³ 靠什么保证起停平滑？它的位置和速度曲线什么形状?', kind: 'choice',
        compute: () => ({ answer: '用 4 个边界条件定 4 个系数：两端位置 + 两端速度=0(起停静止)。于是位置走平滑 S 曲线、速度呈钟形(两端归零、中点最大)、加速度有限(不再无穷)', step: 8, evidence: '本例 a=[0,0,67.5,-22.5]，速度 0→64.8→0，t=2s 到位且速度归零' }),
        distractors: () => ['靠调大 T 让它慢慢走', '位置和速度都是直线', '三次多项式和线性插值效果一样'],
      },
    ],
  },
  {
    id: 'quat', title: '位姿与四元数', kernel: quatKernel as Kernel<unknown>, doc: trivialDoc('quat'),
    facts: [
      {
        id: 'quat_unit', label: '四元数为什么单位、几个数',
        ask: '机器人用四元数表示旋转，绕单位轴转 θ 的四元数怎么写、有什么约束?', kind: 'choice',
        compute: () => ({ answer: 'q=(w,x,y,z)=(cos(θ/2), sin(θ/2)·轴)，始终 |q|=1(单位四元数)。只用 4 个数编码一个旋转，比旋转矩阵的 9 个数(带 6 个正交约束)紧凑得多', step: 1, evidence: '本例绕 z 转 90° → q=(0.707,0,0,0.707)，|q|²=0.707²+0.707²=1' }),
        distractors: () => ['q=(θ, 轴)，共 4 个数、无约束', '四元数是 3 个数、和欧拉角一样', 'q 的模可以是任意值'],
      },
      {
        id: 'gimbal_lock', label: '万向锁：为什么不用欧拉角',
        ask: '欧拉角(roll/pitch/yaw)表示旋转有个致命问题叫"万向锁"，它具体是什么、什么时候发生?', kind: 'choice',
        compute: () => ({ answer: 'pitch=±90° 时 yaw 和 roll 变成绕同一根轴转，只剩它们的差起作用 → 丢一个自由度，本该三个独立角变两个。四元数和旋转矩阵没有这个奇异', step: 5, evidence: '本例 pitch=90° 时 (30,90,0)、(60,90,30)、(50,90,20) 三组不同角给出同一个旋转矩阵' }),
        distractors: () => ['欧拉角超过 360° 会溢出', '欧拉角计算量太大', '万向锁只发生在四元数上'],
      },
    ],
  },
  {
    id: 'jacobian', title: '雅可比矩阵', kernel: jacobianKernel as Kernel<unknown>, doc: trivialDoc('jacobian'),
    facts: [
      {
        id: 'jaco_meaning', label: '雅可比矩阵是什么',
        ask: '机器人学里的雅可比矩阵 J 把什么映射成什么？它的每一列代表什么?', kind: 'choice',
        compute: () => ({ answer: 'J 把关节角速度线性映成末端线速度：ẋ=Jθ̇，J=末端(x,y)对关节(θ1,θ2)的偏导。每一列 = 只转那个关节时末端往哪动；反着用 J⁻¹ 就是速度层 IK', step: 1, evidence: '本例 J=[[-2.732,-1.732],[0.732,-1]]；θ̇=[1,0]→末端速度=第1列(-2.732,0.732)' }),
        distractors: () => ['把末端位置映成关节角(那是 IK)', '把力映成加速度', 'J 是常数矩阵，和构型无关'],
      },
      {
        id: 'singularity', label: '奇异构型：det(J)=0',
        ask: '二连杆机械臂 det(J)=L1·L2·sinθ2，什么构型下 J 奇异、末端会丢一个自由度?', kind: 'choice',
        compute: () => ({ answer: 'θ2=0(手臂完全伸直)或 180°(对折)时 sinθ2=0 → det(J)=0、J 奇异：两列平行，末端此刻只能沿一个方向动、丢一个自由度，J⁻¹ 爆炸。工程上要绕开或用阻尼最小二乘', step: 5, evidence: '本例 θ2=90° 时 det=4 可逆；θ2=0 伸直时 det=0 奇异、两列平行' }),
        distractors: () => ['θ1=0 时奇异', '关节速度过大时奇异', 'J 永远可逆、不会奇异'],
      },
    ],
  },
  {
    id: 'slam', title: 'SLAM 回环校正', kernel: slamKernel as Kernel<unknown>, doc: trivialDoc('slam'),
    facts: [
      {
        id: 'odom_drift', label: '为什么里程计会漂移',
        ask: 'SLAM 里机器人靠里程计推算位置，走一圈回到起点却以为自己在别处，为什么?', kind: 'choice',
        compute: () => ({ answer: '里程计有系统误差(轮子打滑、标定偏差)，每步累积一点点、越走越偏。走一圈本该回到起点，里程计终点却偏出一个缺口，这个缺口就是累计漂移', step: 9, evidence: '本例走八边形一圈，里程计终点 (2.45,0.82) 而非起点 (0,0)，累计漂移 2.58' }),
        distractors: () => ['里程计没误差，是地图错了', '机器人真的走到了别处', '因为没有 GPS'],
      },
      {
        id: 'loop_closure', label: '回环校正怎么提升精度',
        ask: 'SLAM 的"回环检测+位姿图优化"怎么把累计漂移大幅抹平?', kind: 'choice',
        compute: () => ({ answer: '机器人认出回到走过的地方(相同地标)，加一条强约束"终点=起点"；位姿图优化把这个回环误差分摊回整条轨迹(每个位姿按比例拉回)→环闭合、之前的漂移被抹平', step: 10, evidence: '本例回环校正把漂移分摊回去，轨迹平均误差从 1.26 骤降到 0.25、环闭合' }),
        distractors: () => ['重新走一遍取平均', '把里程计误差直接设为 0', '只修正终点、中间不管'],
      },
    ],
  },
  {
    id: 'icp', title: 'ICP 点云配准', kernel: icpKernel as Kernel<unknown>, doc: trivialDoc('icp'),
    facts: [
      {
        id: 'icp_two_steps', label: 'ICP 的两步迭代',
        ask: 'ICP 并不知道两片点云的点怎么对应，它靠什么把点云对齐?', kind: 'choice',
        compute: () => ({ answer: '两步反复迭代：① 每个源点找目标里欧氏最近的点当对应(一开始会猜错几个)；② 用这批点对算最佳刚体变换(Kabsch/SVD)搬过去。对应和变换互相改进、误差单调下降', step: 1, evidence: '本例对应从 00134 逐轮修正到 01234，误差 0.72→0.55→0.22→0.01' }),
        distractors: () => ['穷举所有点的配对组合找最优', '需要人工标注每个点的对应关系', '直接用一次最小二乘就能对齐'],
      },
      {
        id: 'icp_local', label: 'ICP 为什么依赖初值',
        ask: 'ICP 有个著名的局限：依赖初值。为什么初始差太多会失败?', kind: 'choice',
        compute: () => ({ answer: '初始差太大时，欧氏最近点算出的对应会系统性地错(点连到错误的目标点)，基于错对应求出的变换把点云带向错误方向 → 陷入局部最优。所以实际先用粗配准(特征匹配/IMU 里程计)给个好初值再上 ICP 精配', step: 4, evidence: '本例初始 25° 尚可收敛；若初始偏差过大对应全错就收不回来' }),
        distractors: () => ['ICP 从不失败、总能全局最优', '初值只影响速度、不影响结果', 'ICP 需要初值是因为要设旋转角'],
      },
    ],
  },
  {
    id: 'complementary', title: '互补滤波 · IMU 姿态', kernel: complementaryKernel as Kernel<unknown>, doc: trivialDoc('complementary'),
    facts: [
      {
        id: 'comp_gyro', label: '为什么不能只用陀螺',
        ask: '为什么不能只用陀螺仪(积分角速度)来测倾角?', kind: 'choice',
        compute: () => ({ answer: '陀螺测角速度、积分得角度,短期很准很平滑,但它有 bias,积分会把 bias 累积成漂移(逐秒偏、且没有绝对参考、回不来)。几十秒就漂出好几度', step: 2, evidence: '积分累积 bias→无限漂;无绝对参考' }),
        distractors: () => ['陀螺测不了角度、只能测加速度', '陀螺太贵、只用加速度更省', '陀螺噪声太大、抖得没法用'],
      },
      {
        id: 'comp_accel', label: '加速度计的长短板',
        ask: '加速度计测倾角有什么优点和缺点?', kind: 'choice',
        compute: () => ({ answer: '优点:静止时测重力方向→算出绝对倾角、不会漂(重力是天然绝对参考)。缺点:噪声大、抖动厉害,机器人一运动线加速度混进来污染读数。所以只用加速度计角度跳个不停', step: 3, evidence: '绝对不漂 vs 噪声大抖、运动污染' }),
        distractors: () => ['优点是平滑、缺点是会漂', '优点缺点都和陀螺一样', '加速度计不能测倾角'],
      },
      {
        id: 'comp_fuse', label: '互补滤波怎么融',
        ask: '互补滤波 θ=α·(θ_prev+ω·dt)+(1−α)·θ_acc 是怎么融合两个传感器的?', kind: 'choice',
        compute: () => ({ answer: 'α·陀螺项=高通(短期信陀螺、平滑不抖)、(1−α)·加速度项=低通(长期用加速度的绝对参考慢慢纠陀螺的漂移)。两信号频段互补(gyro 管高频、accel 管低频)、合起来既平滑又不漂', step: 4, evidence: '高通陀螺+低通加速度、频段互补' }),
        distractors: () => ['取两者平均、各占一半', '谁噪声小用谁、二选一', '把两者相乘'],
      },
      {
        id: 'comp_alpha', label: 'α 怎么取舍',
        ask: '互补滤波的 α 该取大还是小?有什么取舍?', kind: 'choice',
        compute: () => ({ answer: 'α 大(≈0.98)偏信陀螺→平滑抗抖,但靠很小的加速度权重纠漂、纠得慢;α 小偏信加速度→压漂快但跟着抖。工程常取 α≈0.98(采样越快 α 越接近 1)。它是定增益,和卡尔曼自适应增益不同', step: 4, evidence: 'α 大平滑纠漂慢、小压漂快但抖' }),
        distractors: () => ['α 越大越好、取 1 最优', 'α 越小越好、取 0 最优', 'α 必须精确等于 0.5'],
      },
      {
        id: 'comp_num', label: '融合倾角',
        ask: '陀螺积分得 30.2°、加速度得 32°、α=0.98，互补融合 θ=α·30.2+(1−α)·32 约为多少?(一位小数)', kind: 'number',
        compute: t => { const f = t as unknown as { fused?: number }[]; const l = f.find(x => x.fused != null); const v = l?.fused != null ? Math.round(l.fused * 10) / 10 : 30.2; return ({ answer: String(v), step: 4, evidence: `θ=0.98×30.2+0.02×32=29.596+0.64≈${v}°(几乎跟陀螺、只被加速度拉一点点)` }) },
        distractors: () => ['32.0', '31.1', '30.0', '29.0'],
      },
    ],
  },
  {
    id: 'ukf', title: '无迹卡尔曼滤波 UKF', kernel: ukfKernel as Kernel<unknown>, doc: trivialDoc('ukf'),
    facts: [
      {
        id: 'ukf_core', label: 'UKF 和 EKF 的区别',
        ask: 'UKF 处理非线性和 EKF 最本质的区别是什么?', kind: 'choice',
        compute: () => ({ answer: 'EKF 在估计点求雅可比、把非线性函数线性化(要求导、只一阶近似);UKF 挑一组确定性 sigma 点、让它们原样穿过真非线性函数、再从变换后的点重组均值/协方差。名言:近似分布比近似函数容易', step: 1, evidence: 'sigma 点过真非线性 vs 雅可比切线' }),
        distractors: () => ['UKF 用二阶泰勒、要算 Hessian', 'UKF 用一堆随机粒子、和粒子滤波一样', 'UKF 只是 EKF 换了个名字'],
      },
      {
        id: 'ukf_sigma', label: 'sigma 点怎么取',
        ask: 'UKF 的 sigma 点是怎么取的?为什么是确定性的?', kind: 'choice',
        compute: t => { const f = t as unknown as { sigmas?: unknown[] }[]; const l = f.find(x => x.sigmas); const n = l?.sigmas?.length ?? 3; return ({ answer: `n 维状态取 2n+1 个点(本例 n=1→${n} 个):X₀=μ、Xᵢ=μ±(√((n+λ)P))ᵢ,围绕均值、按协方差铺开。是算出来的确定性点(不是随机采样),能精确捕捉均值和协方差、过非线性后还能到高阶精度`, step: 2, evidence: `2n+1 个;X₀=μ、两侧 μ±√((n+λ)P)` }) },
        distractors: () => ['随机采 N 个点、和粒子滤波一样', '只取均值一个点', '取协方差矩阵的特征向量'],
      },
      {
        id: 'ukf_vs_ekf_when', label: 'UKF 何时比 EKF 强',
        ask: 'UKF 在什么情况下明显比 EKF 好?什么情况下差不多?', kind: 'choice',
        compute: () => ({ answer: '不确定大(协方差大)/非线性强时 UKF 明显更好:sigma 点铺得开、把函数曲率算进来,而 EKF 的一阶线性化误差大。不确定小/局部近似线性时两者几乎一样(sigma 点靠得近)。所以 UKF 的优势在强非线性/大不确定时才显现', step: 5, evidence: '本例 P 大时 UKF/EKF 分道、P 小时≈' }),
        distractors: () => ['UKF 永远比 EKF 好几个数量级', 'UKF 只在测量噪声大时更好', '两者任何情况都完全相同'],
      },
      {
        id: 'ukf_family', label: '滤波家族怎么选',
        ask: 'KF/EKF/UKF/粒子滤波这个贝叶斯滤波家族，怎么选?', kind: 'choice',
        compute: () => ({ answer: '线性→卡尔曼 KF;弱非线性/要快→EKF(雅可比);强非线性/难求导→UKF(sigma 点、免求导、捕捉曲率);多峰/非高斯(如全局定位)→粒子滤波(一堆样本)。KF/EKF/UKF 都是单高斯(单峰)、PF 能表任意分布', step: 5, evidence: '单峰高斯(KF/EKF/UKF)vs 多峰样本(PF)' }),
        distractors: () => ['永远用粒子滤波最准', '永远用 EKF 最快最好', '它们完全等价、随便选'],
      },
      {
        id: 'ukf_nsigma', label: 'sigma 点个数',
        ask: '一维状态(n=1)的 UKF，需要取几个 sigma 点?(2n+1)', kind: 'number',
        compute: t => { const f = t as unknown as { sigmas?: unknown[] }[]; const l = f.find(x => x.sigmas); const n = l?.sigmas?.length ?? 3; return ({ answer: String(n), step: 2, evidence: `2n+1=2·1+1=${n}:中心点 μ 加两侧 μ±√((n+λ)P)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'particlefilter', title: '粒子滤波 · 蒙特卡洛定位', kernel: particlefilterKernel as Kernel<unknown>, doc: trivialDoc('particlefilter'),
    facts: [
      {
        id: 'pf_why', label: '粒子滤波比 EKF 强在哪',
        ask: '粒子滤波相比卡尔曼/EKF，能表示什么它们表示不了的?', kind: 'choice',
        compute: () => ({ answer: 'KF/EKF 用一个高斯(均值+协方差)只能表单峰;粒子滤波用 N 个带权粒子近似任意分布,能表多峰/非高斯(如全局定位"我可能在长得一样的走廊 A 或 B"、绑架问题),且不需要线性化', step: 1, evidence: '一堆样本 vs 一个高斯;多峰/非高斯' }),
        distractors: () => ['粒子滤波更快、算力更省', '粒子滤波不需要观测模型', '粒子滤波精度总是更高'],
      },
      {
        id: 'pf_weight', label: '粒子权重怎么定',
        ask: '粒子滤波里每个粒子的权重是怎么定的?', kind: 'choice',
        compute: () => ({ answer: '权重 ∝ 观测似然 p(z|x_i):粒子预测的测量和实测越接近、权重越高。本例位置测量、似然高斯 w_i=exp(−(z−x_i)²/(2σ²)),离 z 近的粒子权重大。相当于用测量给粒子打分', step: 2, evidence: '加权=测量更新;w∝似然' }),
        distractors: () => ['权重都相等、不变', '权重按粒子离原点的距离', '权重是随机分配的'],
      },
      {
        id: 'pf_resample', label: '为什么要重采样',
        ask: '粒子滤波为什么每隔几步要重采样?不重采样会怎样?', kind: 'choice',
        compute: () => ({ answer: '不重采样,迭代几步后权重会全集中到极少数粒子(其余趋近 0、有效样本数 N_eff→1),粒子退化(degeneracy)、大量粒子浪费在低概率区。重采样(高权复制、低权淘汰、权重重置均匀)把算力聚到高概率区。判据:N_eff<N/2 就重采样', step: 4, evidence: 'N_eff=1/Σw²;退化 vs 聚拢' }),
        distractors: () => ['为了增加粒子数量提高精度', '为了把粒子随机打散增加探索', '重采样只是为了好看、可省略'],
      },
      {
        id: 'pf_neff', label: '有效样本数 N_eff',
        ask: '有效样本数 N_eff=1/Σw² 衡量什么?什么时候触发重采样?', kind: 'choice',
        compute: () => ({ answer: '衡量"实际有多少粒子在起作用":权重均匀时 N_eff≈N(满值)、权重集中到一个粒子时 N_eff→1。标准做法是 N_eff<N/2 就重采样。它是判断粒子退化程度的指标', step: 3, evidence: 'N_eff∈[1,N];<N/2 触发重采样' }),
        distractors: () => ['衡量粒子的平均位置', '衡量测量噪声大小', 'N_eff 越小说明估计越准'],
      },
      {
        id: 'pf_neff_num', label: '本例有效样本数',
        ask: '本例 6 个粒子、权重集中在中间几个，有效样本数 N_eff=1/Σw² 约为多少?(一位小数，满值为 6)', kind: 'number',
        compute: t => { const f = t as unknown as { neff?: number }[]; const l = f.find(x => x.neff != null); const v = l?.neff != null ? Math.round(l.neff * 10) / 10 : 3.7; return ({ answer: String(v), step: 3, evidence: `N_eff=1/Σw²≈${v}(满值 6);权重集中让它从 6 掉下来、接近 N/2=3 阈值` }) },
        distractors: () => ['6.0', '1.0', '5.5', '2.0'],
      },
    ],
  },
  {
    id: 'pinhole', title: '针孔相机 · 投影与畸变', kernel: pinholeKernel as Kernel<unknown>, doc: trivialDoc('pinhole'),
    facts: [
      {
        id: 'pin_perspective', label: '投影最关键的一步',
        ask: '针孔相机把 3D 点 (X,Y,Z) 投到像素，最关键的一步是什么?', kind: 'choice',
        compute: () => ({ answer: '除以深度 Z:透视投影 x_n=X/Z、y_n=Y/Z。同样大的东西 Z 越大(越远)投影越小=近大远小;这一步是非线性的(除法),也是单张图丢深度的原因(不同 Z、同 X/Z 投到同一像素、单目测不了绝对尺度)', step: 2, evidence: '除以深度=近大远小、丢深度' }),
        distractors: () => ['乘以焦距', '加上畸变系数', '旋转到相机坐标系'],
      },
      {
        id: 'pin_intrinsic', label: '内参是什么',
        ask: '相机内参 K 里的 fx,fy,cx,cy 分别是什么?', kind: 'choice',
        compute: () => ({ answer: 'fx,fy 是焦距(像素单位),把归一化坐标放大到像素;cx,cy 是主点(光轴与像平面的交点、≈图像中心)。像素 u=fx·x_n+cx、v=fy·y_n+cy。K=[[fx,0,cx],[0,fy,cy],[0,0,1]]', step: 3, evidence: 'fx,fy 焦距;cx,cy 主点' }),
        distractors: () => ['fx,fy 是畸变系数、cx,cy 是位姿', 'fx,fy 是图像宽高、cx,cy 是深度', '都是外参'],
      },
      {
        id: 'pin_distortion', label: '径向畸变的特点',
        ask: '径向畸变 x_d=x_n(1+k1 r²+k2 r⁴) 有什么特点?', kind: 'choice',
        compute: () => ({ answer: '离图像中心(主点)越远、r 越大、畸变越明显(桶形/枕形):图像边缘的直线被拍弯、中心几乎不变。这是真镜头非理想造成的,用图前要去畸变把像素纠回理想针孔位置', step: 4, evidence: 'r 越大越弯;边缘明显中心不变' }),
        distractors: () => ['所有像素均匀偏移', '离中心越近越弯', '和焦距无关的常数偏移'],
      },
      {
        id: 'pin_calib', label: '相机标定怎么做',
        ask: '相机内参和畸变系数是怎么求出来的(标定)?', kind: 'choice',
        compute: () => ({ answer: '拍多张棋盘格:棋盘格角点的 3D 位置已知、在图上检测到对应的 2D 像素,用一堆已知 3D↔2D 对应反求 fx,fy,cx,cy,k1,k2(张正友标定法最常用)。标定是所有视觉测量的前提', step: 4, evidence: '棋盘格已知3D↔2D反求;张正友法' }),
        distractors: () => ['从相机说明书直接读', '用深度传感器测', '不需要标定、假设理想针孔'],
      },
      {
        id: 'pin_num', label: '理想像素坐标',
        ask: '相机系点 X=(3,2,5)、fx=500、cx=320，无畸变时像素 u=fx·(X/Z)+cx 是多少?', kind: 'number',
        compute: t => { const f = t as unknown as { uIdeal?: number }[]; const l = f.find(x => x.uIdeal != null); const v = l?.uIdeal != null ? Math.round(l.uIdeal) : 620; return ({ answer: String(v), step: 3, evidence: `x_n=3/5=0.6、u=500·0.6+320=${v}(透视除以深度再乘焦距加主点)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'pointcloud', title: '点云预处理 · 下采样+法线', kernel: pointcloudKernel as Kernel<unknown>, doc: trivialDoc('pointcloud'),
    facts: [
      {
        id: 'pc_normal', label: '法线是哪个特征向量',
        ask: '点云法线估计(PCA):一个点的表面法线对应邻域协方差矩阵的哪个特征向量?', kind: 'choice',
        compute: () => ({ answer: '最小特征值对应的特征向量。表面法线方向上点云几乎没铺开(方差最小),所以是最小特征值那个方向;最大特征值的特征向量是表面切向(点云铺开的方向)', step: 5, evidence: '最小 λ 的特征向量=法线(方差最小方向⊥面)' }),
        distractors: () => ['最大特征值对应的特征向量', '所有特征向量的平均', '协方差矩阵的对角线'],
      },
      {
        id: 'pc_voxel', label: '体素下采样怎么做',
        ask: '体素下采样(voxel grid)是怎么把点云降密度的?', kind: 'choice',
        compute: () => ({ answer: '把空间切成边长 L 的网格,点落哪格看 ⌊坐标/L⌋,每个被占用的体素只保留落在里面所有点的质心(平均位置)、其余丢掉。效果是点数下降且密度变均匀;L 越大越粗(点更少、细节丢更多)', step: 1, evidence: '网格分箱、每格取质心;L 控制粗细' }),
        distractors: () => ['随机删掉一半点', '只保留每格里第一个点', '按距离排序取前 N 个'],
      },
      {
        id: 'pc_lambda', label: 'λ 的比说明什么',
        ask: '法线估计里,邻域协方差的特征值 λ 之间的比(λ小/λ大)能说明什么?', kind: 'choice',
        compute: () => ({ answer: '局部形状(曲率):λ小/λ大≈0→局部很平(法线可靠);若几个 λ 都不小→是边/角、点云在多个方向都铺开、法线不确定。本例 λ=0.687/0.013、比≈0.02→局部很平', step: 5, evidence: 'λ 比≈0 平面、都不小=边/角' }),
        distractors: () => ['点云的颜色', '相机到点的距离', '下采样用的 L 大小'],
      },
      {
        id: 'pc_why', label: '为什么要算法线',
        ask: '配准/建图前为什么要给每个点算表面法线?', kind: 'choice',
        compute: () => ({ answer: '点到面(point-to-plane)ICP 的误差要用法线(比点到点收敛快)、法向一致性用来剔除外点/错匹配、曲面重建和抓取姿态也都要法线。法线是点云几何的基本局部特征', step: 5, evidence: '点到面 ICP、剔外点、重建/抓取都要法线' }),
        distractors: () => ['为了给点云上色', '为了压缩点云体积', '法线只是可视化好看、算法不用'],
      },
      {
        id: 'pc_num', label: '下采样后点数',
        ask: '8 个点做体素下采样、L=1(细)时下采样到几个点?(每个占用体素取质心)', kind: 'number',
        compute: t => { const f = t as unknown as { voxels?: unknown[]; L?: number }[]; const l = f.find(x => x.L === 1 && x.voxels); const v = l?.voxels?.length ?? 5; return ({ answer: String(v), step: 1, evidence: `L=1 网格下 8 点占 ${v} 个体素、每格取质心 → ${v} 个下采样点` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'stereo', title: '双目立体视觉 · 视差求深度', kernel: stereoKernel as Kernel<unknown>, doc: trivialDoc('stereo'),
    facts: [
      {
        id: 'st_depth', label: '深度和视差的关系',
        ask: '双目立体视觉里,深度 Z 和视差 d 是什么关系?', kind: 'choice',
        compute: () => ({ answer: 'Z = f·b / d(f 焦距、b 基线、d 视差)。因为视差 d=f·b/Z、反过来就是 Z=f·b/d。视差越大越近、测出视差就得深度。标定好 f、b 后,逐像素测视差就得整幅深度图', step: 3, evidence: 'Z=f·b/d;视差越大越近' }),
        distractors: () => ['Z=f·b·d,视差越大越远', 'Z 和视差无关、要另外测', 'Z=d/(f·b)'],
      },
      {
        id: 'st_disp', label: '视差为什么∝1/Z',
        ask: '视差 d=x_L−x_R 为什么只和深度有关、且近大远小?', kind: 'choice',
        compute: () => ({ answer: 'x_L=f·X/Z+cx、x_R=f·(X−b)/Z+cx,相减 d=f·b/Z——横坐标 X 抵消了、只剩 f·b/Z,所以视差 ∝1/Z(近大远小、和 X 无关)。像手指凑到眼前左右眼差很大、看远山几乎没差', step: 2, evidence: 'd=f·b/Z、X 抵消、∝1/Z' }),
        distractors: () => ['视差和横坐标 X 成正比', '视差是个常数、和深度无关', '视差∝Z、越远越大'],
      },
      {
        id: 'st_prec', label: '为什么远处不准',
        ask: '双目测深度为什么远处越来越不准?', kind: 'choice',
        compute: () => ({ answer: '对 Z=f·b/d 求导:ΔZ≈(Z²/(f·b))·Δd,深度误差随距离的平方增长(∝Z²)。视差是离散像素、总有 ~1px 误差,近处 1px 只差几厘米、远处同样 1px 就差几十厘米。所以双目擅长近处、远处退化', step: 5, evidence: 'ΔZ∝Z²、远处误差随距离平方涨' }),
        distractors: () => ['远处光线弱、噪声大而已', '远处视差大、反而更准', '和距离无关、都一样准'],
      },
      {
        id: 'st_improve', label: '怎么测更远更准',
        ask: '想让双目测得更远、更准,可以怎么做?', kind: 'choice',
        compute: () => ({ answer: '加大基线 b 或焦距 f(都让同样深度的视差变大、精度提高),或做亚像素视差(把视差误差 Δd 压到 <1px)。因为 ΔZ≈Z²/(f·b)·Δd,增大 f·b、减小 Δd 都能降低深度误差。代价:大基线两图重叠区变小、近处盲区变大', step: 5, evidence: '加大 b/f 或亚像素视差(降 Δd)' }),
        distractors: () => ['缩小基线 b', '缩短焦距 f', '把两个相机叠在一起'],
      },
      {
        id: 'st_num', label: '还原深度',
        ask: 'f=500px、基线 b=0.1m、测得视差 d=25px，深度 Z=f·b/d 是多少米?', kind: 'number',
        compute: t => { const f = t as unknown as { disp?: number; Zrec?: number }[]; const l = f.find(x => x.disp === 25 && x.Zrec != null); const v = l?.Zrec ?? 2; return ({ answer: String(v), step: 3, evidence: `Z=f·b/d=500·0.1/25=50/25=${v}m` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'handeye', title: '手眼标定 AX=XB', kernel: handeyeKernel as Kernel<unknown>, doc: trivialDoc('handeye'),
    facts: [
      {
        id: 'he_what', label: '手眼标定求什么',
        ask: '手眼标定(AX=XB)要求解的 X 是什么?', kind: 'choice',
        compute: () => ({ answer: '相机坐标系和夹爪(手)坐标系之间的固定变换(位置+朝向)。相机装在手腕上(eye-in-hand),要用相机看到的东西指挥手去抓,必须先知道这个固定关系 X', step: 1, evidence: 'X=相机↔夹爪的固定变换' }),
        distractors: () => ['相机的内参(焦距、主点)', '机器人每个关节的角度', '标定板在世界里的位置'],
      },
      {
        id: 'he_data', label: 'A 和 B 怎么来',
        ask: '手眼方程 A·X=X·B 里,A 和 B 分别怎么得到?', kind: 'choice',
        compute: () => ({ answer: '机器人动几下:A=夹爪的相对运动,由关节角+正运动学 FK 算(机器人自己知道);B=相机的相对运动,让相机盯着一块固定标定板、从图像算出相机动了多少。相机固连夹爪→A·X=X·B', step: 1, evidence: 'A 靠 FK、B 靠看固定标定板' }),
        distractors: () => ['A、B 都由相机测', 'A 是标定板位置、B 是相机内参', 'A、B 都由关节编码器直接给'],
      },
      {
        id: 'he_angle', label: '为什么 θ_A=θ_B',
        ask: '手眼标定里,为什么每组运动 A 的旋转角必须等于 B 的旋转角?', kind: 'choice',
        compute: () => ({ answer: '因为 R_B=R_X⁻¹ R_A R_X,R_A 和 R_B 是相似矩阵、相似矩阵旋转角相等,所以 θ_A=θ_B 是硬约束。可当自检:哪组 θ_A≠θ_B 就是这组数据配错了(时间戳没对齐/标定板没看准)、该剔除', step: 3, evidence: 'R_A~R_B 相似、角相等、可自检' }),
        distractors: () => ['巧合、不一定相等', 'A 的角总是 B 的两倍', '因为转轴一样'],
      },
      {
        id: 'he_solve', label: '旋转和平移怎么解',
        ask: '手眼标定 AX=XB 通常怎么解?', kind: 'choice',
        compute: () => ({ answer: '拆两步:①先解旋转 R_X——R_X 把 B 的转轴转到 A 的转轴(n_A=R_X n_B)、≥2 组不共线运动定出 R_X;②再解平移 t_X——(R_A−I)t_X=R_X t_B−t_A 是线性方程、≥2 组凑满秩解出。多组做最小二乘去噪(Tsai-Lenz/Park-Martin)', step: 4, evidence: '先旋转(轴对应)后平移(线性)' }),
        distractors: () => ['一步直接矩阵求逆 X=A⁻¹XB', '只解旋转、平移不用管', '随机搜索直到 AX≈XB'],
      },
      {
        id: 'he_eih', label: 'eye-in-hand vs eye-to-hand',
        ask: 'eye-in-hand 和 eye-to-hand 有什么区别?', kind: 'choice',
        compute: () => ({ answer: 'eye-in-hand=相机装在手腕/夹爪上、跟着手一起动(本实验就是,方程 AX=XB 求相机↔夹爪);eye-to-hand=相机固定在外面看着机器人(求相机↔机器人基座)。两者方程形式类似、但 X 的含义和数据采法不同', step: 5, evidence: 'in-hand相机在手上动、to-hand相机在外固定' }),
        distractors: () => ['一个用单目、一个用双目', 'eye-to-hand 不需要标定', '只是叫法不同、完全一样'],
      },
    ],
  },
  {
    id: 'vo', title: '视觉里程计 · 对极几何', kernel: voKernel as Kernel<unknown>, doc: trivialDoc('vo'),
    facts: [
      {
        id: 'vo_essential', label: '本质矩阵是什么',
        ask: '对极几何里的本质矩阵 E 打包了什么?', kind: 'choice',
        compute: () => ({ answer: 'E=[t]×R,在归一化坐标下打包相机的相对旋转 R 和平移方向 t([t]× 是 t 的反对称叉乘矩阵)。带内参的像素坐标对应基础矩阵 F=K⁻ᵀE K⁻¹。E 秩 2、5 个自由度(3 旋转+2 平移方向、尺度未定)', step: 1, evidence: 'E=[t]×R、打包相对旋转+平移方向' }),
        distractors: () => ['相机的内参 K(焦距、主点)', '两帧之间的时间差', '3D 点的绝对坐标'],
      },
      {
        id: 'vo_constraint', label: '对极约束与 8 点法',
        ask: '对极约束 x2ᵀE x1=0 为什么能用来解本质矩阵 E?', kind: 'choice',
        compute: () => ({ answer: '因为 x2ᵀE x1=0 对 E 的 9 个元素是线性的,每对匹配点给一个线性方程,给 ≥8 对匹配就能线性解出 E(8 点法,Longuet-Higgins)。实际有误匹配,用 RANSAC 稳健估计', step: 2, evidence: '对 E 线性、≥8 对匹配解 E(8 点法)' }),
        distractors: () => ['它是非线性的、要迭代优化', '一对匹配点就能解出 E', '它给出 3D 点的深度'],
      },
      {
        id: 'vo_epi', label: '对极线和极点',
        ask: '对极线 l2=E x1 和极点是什么?有什么用?', kind: 'choice',
        compute: () => ({ answer: 'l2=E x1 是 x1 在第二帧的对极线,x2 必落在它上面;所有对极线交于极点 e2(=平移方向的像)。用处:找 x1 在第二帧的匹配只需沿这一条对极线搜、不用搜整幅图,极大加速。前进平移时极点是图心扩张焦点 FOE、线放射;横向平移时极点在无穷远、线水平', step: 3, evidence: 'x2 在对极线上、沿线搜匹配、交于极点' }),
        distractors: () => ['对极线是 3D 点的轨迹', '极点是图像最亮的点', '和匹配无关、只是可视化'],
      },
      {
        id: 'vo_scale', label: '单目为什么无尺度',
        ask: '单目视觉里程计从两帧为什么只能定平移方向、定不了绝对尺度?', kind: 'choice',
        compute: () => ({ answer: '因为本质矩阵 E 对 t 的尺度是齐次的——E 和 2E(即 t 和 2t)给出完全相同的对极约束,尺度不可观。所以单目只能定平移方向、不知道是小场景走 1 米还是大场景走 100 米。要定尺度靠双目基线、IMU、已知物体大小或回环', step: 5, evidence: 'E 与 2E 同约束、尺度不可观' }),
        distractors: () => ['相机分辨率不够高', '因为没有 GPS', '因为只用了 8 个点'],
      },
      {
        id: 'vo_recover', label: '从 E 恢复位姿',
        ask: '从本质矩阵 E 恢复相机运动 (R,t) 怎么做?', kind: 'choice',
        compute: () => ({ answer: '对 E 做 SVD 分解,得到 4 组 (R,t) 候选(旋转 2 种×平移 ±方向);用手性检验(cheirality)——真正那组必须让三角化出的 3D 点在两个相机前方(深度为正)——选出唯一解。之后三角化匹配点建 3D 地图、接成轨迹', step: 5, evidence: 'SVD 得 4 解、手性(点在相机前方)选唯一' }),
        distractors: () => ['直接矩阵求逆 (R,t)=E⁻¹', 'E 已经就是 (R,t)、不用分解', '随机搜索直到满足约束'],
      },
    ],
  },
  {
    id: 'pnp', title: 'PnP · 6D 位姿估计', kernel: pnpKernel as Kernel<unknown>, doc: trivialDoc('pnp'),
    facts: [
      {
        id: 'pnp_what', label: 'PnP 求什么',
        ask: 'PnP(Perspective-n-Point)要解的是什么?', kind: 'choice',
        compute: () => ({ answer: '已知 n 个 3D 点(物体系坐标)+它们的 2D 像素+内参 K,求相机相对物体的 6 自由度位姿 (R,t)(3 旋转+3 平移)。3D 点来自 CAD 模型角点或 SLAM 地图点', step: 1, evidence: '2D-3D 对应 + K → 6 自由度位姿' }),
        distractors: () => ['求相机的内参 K', '求 3D 点之间的距离', '求图像的深度图'],
      },
      {
        id: 'pnp_crit', label: 'PnP 的准则',
        ask: 'PnP 求位姿要最小化的量(准则)是什么?', kind: 'choice',
        compute: () => ({ answer: '重投影误差 Σ‖投影(X_i;R,t)−观测像素_i‖²。真正的位姿能把 3D 点按 u=K[R|t]X 投影后正好落在观测像素上、误差=0;位姿越偏、各点像素残差越大。PnP 就是找让这个误差最小的位姿', step: 2, evidence: '最小化重投影误差、真位姿处=0' }),
        distractors: () => ['3D 点两两之间的距离', '图像的亮度差', '相机移动的速度'],
      },
      {
        id: 'pnp_p3p', label: 'P3P 为什么 4 解',
        ask: 'P3P(用 3 个点的最小 PnP)有什么特点?', kind: 'choice',
        compute: () => ({ answer: '3 个点是求位姿的最小情形,几何上一般解出 4 组候选位姿(有歧义),需要用第 4 个点的投影一致性来消歧、选出唯一解。是很多 RANSAC-PnP 的最小样本', step: 4, evidence: '3 点给 4 组候选、第 4 点消歧' }),
        distractors: () => ['3 点直接给唯一解、不用消歧', 'P3P 需要至少 6 个点', 'P3P 只能求平移不能求旋转'],
      },
      {
        id: 'pnp_methods', label: 'PnP 的解法',
        ask: '常见的 PnP 解法有哪些?', kind: 'choice',
        compute: () => ({ answer: 'P3P(3 点 4 解、第 4 点消歧)、DLT/线性 PnP(≥6 点、把投影排成线性方程 SVD 解)、EPnP(把点表成 4 个控制点、O(n)、OpenCV solvePnP 常用),最后用高斯-牛顿/LM 迭代最小化重投影误差精修、配 RANSAC 去外点', step: 4, evidence: 'P3P/DLT/EPnP + 高斯牛顿精修 + RANSAC' }),
        distractors: () => ['只有暴力搜索一种', '直接矩阵求逆', '必须用深度学习'],
      },
      {
        id: 'pnp_use', label: 'PnP 的用途',
        ask: 'PnP 在机器人/SLAM 里典型用在哪?', kind: 'choice',
        compute: () => ({ answer: 'VO/SLAM 建好 3D 地图后、新一帧靠 PnP 用 2D-3D 对应快速重定位(比重做对极几何稳);机械臂抓取先求物体 6D 位姿(2D-3D 或 CAD 模型)才能规划抓;AR 标记/物体跟踪。是把图像观测对齐到已知 3D 结构的标准工具', step: 5, evidence: 'SLAM 重定位、抓取求 6D 位姿、AR 跟踪' }),
        distractors: () => ['给点云做下采样', '标定相机内参', '生成深度图'],
      },
    ],
  },
  {
    id: 'ekf', title: '扩展卡尔曼滤波 EKF', kernel: ekfKernel as Kernel<unknown>, doc: trivialDoc('ekf'),
    facts: [
      {
        id: 'ekf_core', label: 'EKF 和线性卡尔曼的区别',
        ask: 'EKF(扩展卡尔曼滤波)和线性卡尔曼滤波最本质的区别是什么?', kind: 'choice',
        compute: () => ({ answer: 'EKF 在当前估计点对非线性的运动/观测函数 f/h 求雅可比(F/H)、用一阶泰勒就地线性化,再套原来的卡尔曼预测-更新公式。其余完全一样', step: 1, evidence: '唯一不同=雅可比线性化;非线性时能用卡尔曼' }),
        distractors: () => ['EKF 用神经网络代替线性模型', 'EKF 不需要预测步、只有更新', 'EKF 用二阶导数、更精确'],
      },
      {
        id: 'ekf_jacobian', label: '观测雅可比 H 是什么',
        ask: 'EKF 里观测雅可比 H=∂h/∂x 的物理意义是什么?', kind: 'choice',
        compute: t => { const f = t as unknown as { H?: number }[]; const l = f.find(x => x.H != null); const h = l?.H ?? -0.707; return ({ answer: `状态每变一点、测量随之变多少(测量对状态的局部线性灵敏度)。本例 H=${h}(负):机器人往右 x↑ 会离地标更近、距离↓,所以斜率为负。它把非线性距离测量翻译成局部线性关系、让卡尔曼公式能用`, step: 3, evidence: 'H=−(L−x̂)/h;符号=往哪动测量怎么变' }) },
        distractors: () => ['测量噪声的大小', '机器人的速度', '卡尔曼增益本身'],
      },
      {
        id: 'ekf_trust', label: '测量噪声 R 的作用',
        ask: 'EKF 更新里,测量噪声 R 变大变小对卡尔曼增益 K 和结果有什么影响?', kind: 'choice',
        compute: () => ({ answer: 'R 小(信测量)→ K 大、状态被测量拉得多、方差 P 收得狠;R 大(信测量糙)→ K 小、状态几乎不动、更信预测、P 收得少。这和线性卡尔曼一个道理', step: 4, evidence: 'K=PH/(H²P+R);R↑则 K↓' }),
        distractors: () => ['R 只影响预测步、不影响更新', 'R 越大 K 越大、越信测量', 'R 和 K 无关'],
      },
      {
        id: 'ekf_fail', label: 'EKF 什么时候失效',
        ask: 'EKF 什么时候会失效?有哪些替代?', kind: 'choice',
        compute: () => ({ answer: 'EKF 只做一阶线性化,若非线性很强、或估计点离真值远,线性化误差会让协方差失真甚至发散。替代:UKF(无迹卡尔曼,传 sigma 点过非线性、不求雅可比、对强非线性更准);粒子滤波(采样、能表多峰/非高斯,如全局定位绑架问题)', step: 5, evidence: '一阶线性化的局限;UKF/粒子滤波各补一块' }),
        distractors: () => ['EKF 永不失效、总是最优', '只在测量噪声大时失效、加大 R 即可', '失效时改用线性卡尔曼'],
      },
      {
        id: 'ekf_hpred', label: '预测测量距离',
        ask: '机器人估计在 x=5、地标在(10,5)，EKF 算的预测测量 h(x̂)=√((10−5)²+5²) 约为多少?(取整)', kind: 'number',
        compute: t => { const f = t as unknown as { hPred?: number }[]; const l = f.find(x => x.hPred != null); const v = l?.hPred != null ? Math.round(l.hPred) : 7; return ({ answer: String(v), step: 2, evidence: `h=√(25+25)=√50≈7.07≈${v};创新 y=z−h=8−7.07=0.93` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'kalman', title: '卡尔曼滤波', kernel: kalmanKernel as Kernel<unknown>, doc: trivialDoc('kalman'),
    facts: [
      {
        id: 'predict_update', label: '卡尔曼的两拍：预测涨、校正缩',
        ask: '卡尔曼滤波每步 predict 和 update 两拍，位置估计的不确定度(方差 P)分别怎么变、为什么?', kind: 'choice',
        compute: () => ({ answer: 'Predict 用运动模型前推(x\'=x+u)，推得越久越不确定 → 方差涨 P\'=P+Q；Update 用观测校正，观测带来新信息 → 方差缩 P=(1−K)P\'。所以 P 呈锯齿、收敛到稳态', step: 1, evidence: '本例 P: 1→predict 1.5→update 0.6→predict 1.1→update 0.524…收敛~0.5' }),
        distractors: () => ['predict 和 update 都让方差变小', '方差一直不变', 'predict 缩、update 涨'],
      },
      {
        id: 'kalman_gain', label: '卡尔曼增益 K 是什么权重',
        ask: '卡尔曼增益 K=P\'/(P\'+R) 决定什么？什么时候更信 GPS 观测、什么时候更信运动预测?', kind: 'choice',
        compute: () => ({ answer: 'K 是"信预测还是信观测"的权重：x=x\'+K(z−x\')。观测噪声 R 小(GPS 准)→K 大→多信观测；预测方差 P\' 小(预测准)→K 小→多信预测。融合估计比单独任一个都准', step: 8, evidence: '本例 R=1，K 从 0.6 收敛到 ~0.5；估计一路贴真值(误差≤0.13)' }),
        distractors: () => ['K 是固定常数、与方差无关', 'K 越大越好、永远多信观测', 'K 只和步数有关'],
      },
    ],
  },
  {
    id: 'lerobot', title: 'LeRobot × SO-101 开源实战', kernel: lerobotKernel as Kernel<unknown>, doc: trivialDoc('lerobot'),
    facts: [
      {
        id: 'lerobot_pipeline', label: 'SO-101+LeRobot 自主抓取的全链路',
        ask: '用 SO-101 机械臂 + LeRobot 做一个会自主抓取的策略，要走哪几步？训练数据从哪来?', kind: 'choice',
        compute: () => ({ answer: '模仿学习全链路：装配标定→手推 leader 臂遥操 follower、用 lerobot-record 录≥50 段示范(相机+关节+动作)→lerobot-train 训一个策略(默认 ACT 动作分块 Transformer)→lerobot-rollout 部署让 follower 臂自主执行。训练数据来自你自己遥操作采集的示范', step: 8, evidence: '本例走完 硬件→装配标定→采集→训练ACT→部署抓取 全链路，含真实 CLI 命令' }),
        distractors: () => ['训练数据从网上下载现成的，不用自己采', '手写规则程序控制、不用学习', '只需要一条臂、不用 leader/follower'],
      },
      {
        id: 'so101_hardware', label: 'SO-101 硬件与主从臂',
        ask: 'SO-101 机械臂的 leader 和 follower 两条臂各是干什么的？它有几个自由度?', kind: 'choice',
        compute: () => ({ answer: 'follower(从臂)真干活、执行任务；leader(主臂)当你手里的遥操作手柄(用不同减速比让你轻松推动)，你推 leader、follower 跟随来采集示范。6 颗 STS3215 舵机、6 关节=5 自由度+夹爪', step: 1, evidence: 'SO-101：5 自由度+夹爪、6 舵机、leader/follower 主从两条臂' }),
        distractors: () => ['leader 和 follower 是两个独立机器人、各干各的', '只有一条臂、没有主从之分', 'leader 负责计算、follower 负责供电'],
      },
    ],
  },
  {
    id: 'vla', title: 'VLA 视觉-语言-动作', kernel: vlaKernel as Kernel<unknown>, doc: trivialDoc('vla'),
    facts: [
      {
        id: 'vla_action_token', label: 'VLA 怎么让大模型"说出"动作',
        ask: 'RT-2 这类 VLA 怎么让视觉-语言大模型输出连续的机器人动作?', kind: 'choice',
        compute: () => ({ answer: '动作 token 化：把连续动作(Δx/Δy/Δz/夹爪)每一维按范围离散成 256 个格子、每格=一个 token id，动作就变成一串"词"；大模型像预测下一个单词一样自回归吐出这串动作 token，机器人端再反 token 化回连续位姿执行。动作和语言共用词表', step: 3, evidence: '本例 Δpose→动作 token [204,96,77,255]，反解误差≈0' }),
        distractors: () => ['大模型直接输出电机电压', '动作由另一个独立规则程序算', '每个动作硬编码成一个固定指令'],
      },
      {
        id: 'vla_generalize', label: 'VLA 为什么能泛化',
        ask: 'VLA 能听懂机器人示范数据里从没出现过的物体/指令(如"拿起紫色的杯子")，为什么?', kind: 'choice',
        compute: () => ({ answer: '骨干是在海量网络图文上预训练的视觉-语言大模型，早就见过无数紫色的、无数杯子、懂各种概念和语言——这份世界知识让它能把没在机器人数据里出现过的新概念直接接到动作上。从零训练的策略没有这份知识就做不到', step: 5, evidence: '本例换成没训过的"紫色的杯子"，靠骨干网络知识仍能理解并伸手去拿' }),
        distractors: () => ['因为机器人数据其实覆盖了所有物体', '因为动作 token 化', '靠随机试探碰运气'],
      },
    ],
  },
  {
    id: 'diffpolicy', title: 'Diffusion Policy', kernel: diffpolicyKernel as Kernel<unknown>, doc: trivialDoc('diffpolicy'),
    facts: [
      {
        id: 'bc_multimodal', label: 'BC 为什么把多解平均成撞',
        ask: '绕障碍向左或向右都对，为什么行为克隆(BC)会预测"直行"撞上去?', kind: 'choice',
        compute: () => ({ answer: 'BC 是回归、只输出一个动作，训练最小化均方误差→最优单点预测就是均值。左(−1)和右(+1)平均=0(直行)→正好撞障碍。这是"回归求均值"的结构缺陷，加大网络也没用', step: 1, evidence: '本例双峰动作 ±1，BC 均值落在 0(直行撞)' }),
        distractors: () => ['BC 训练不够', '专家示范里没有绕障数据', 'BC 网络太小'],
      },
      {
        id: 'diffusion_multimodal', label: 'Diffusion Policy 怎么治多峰',
        ask: 'Diffusion Policy 怎么解决 BC 把多峰动作平均成错解的问题?', kind: 'choice',
        compute: () => ({ answer: '换成生成模型：不预测单个动作，而是建整个动作分布(可多峰)，从随机噪声沿学到的能量/分数去噪采样，落到某一个模态而非平均。不同噪声→不同模态，都是有效解', step: 6, evidence: '本例两个噪声种子去噪分别收敛到 +0.99(右绕)/−0.99(左绕)，BC 却给 0(撞)' }),
        distractors: () => ['给 BC 加更多层', '把左右两个动作都执行', '只保留一个方向的示范'],
      },
    ],
  },
  {
    id: 'bc', title: '模仿学习 · 行为克隆', kernel: bcKernel as Kernel<unknown>, doc: trivialDoc('bc'),
    facts: [
      {
        id: 'bc_what', label: '行为克隆 BC 是什么',
        ask: '模仿学习里的"行为克隆(BC)"是怎么让机器人学技能的?', kind: 'choice',
        compute: () => ({ answer: '收集专家示范(状态→动作的数据对)，用监督学习把"状态→动作"当回归/分类拟合出一个策略。简单、可扩展，是 VLA 的训练基石', step: 0, evidence: '本例专家在中线附近示范状态→动作，BC 拟合它' }),
        distractors: () => ['让机器人自己试错、拿奖励强化(那是强化学习)', '手写 if-else 规则', '让机器人随机探索'],
      },
      {
        id: 'bc_compound', label: 'BC 的致命伤：复合误差',
        ask: 'BC 有个著名的致命伤，会让小误差滚成大祸(如开车冲出车道)，它是什么、根因是什么?', kind: 'choice',
        compute: () => ({ answer: '分布漂移/复合误差：BC 只在专家示范过的状态学得好，自己的小误差把它带到没示范过的状态→欠修正→漂更远→错上加错(代价 O(εT²))。根因是训练分布≠测试时自己走出的分布', step: 6, evidence: '本例专家稳在 0.66(道内)，BC 漂出示范区(0.5)后复合误差冲到 1.76(出车道)' }),
        distractors: () => ['网络太小、拟合能力不够', '专家示范数据有噪声', 'BC 学习率设太大'],
      },
    ],
  },
  {
    id: 'mpc', title: 'MPC 模型预测控制', kernel: mpcKernel as Kernel<unknown>, doc: trivialDoc('mpc'),
    facts: [
      {
        id: 'mpc_predict', label: 'MPC 和 PID 的本质区别',
        ask: 'MPC(模型预测控制)和 PID/阻抗这类反应式控制，本质区别是什么?', kind: 'choice',
        compute: () => ({ answer: 'MPC 会往前看：每步用模型预测未来一段、优化整条控制序列(跟踪+约束+省劲)、只执行第一步、下步重规划(滚动时域)。PID/阻抗只看当前误差反应、没有预测', step: 7, evidence: '本例 MPC 预测刹车距离→提前刹车停在 9.94；反应式无预测冲过目标到 15.98' }),
        distractors: () => ['MPC 用的力更大', 'MPC 是 PID 加了积分项', '两者没本质区别、只是参数不同'],
      },
      {
        id: 'mpc_constraint', label: 'MPC 怎么提前刹车不越界',
        ask: '质量块要停在目标(墙)，MPC 靠什么做到提前刹车、不冲过去?', kind: 'choice',
        compute: () => ({ answer: '每步预测"照现在速度刹停还要多远"(刹车距离)=预测停点；一旦预测停点够到目标就提前刹车，否则加速。这就是用预测显式满足"不越界"约束——反应式做不到', step: 5, evidence: '本例 MPC 在预测停点将超过目标时切换到刹车(u=-1)，稳稳停在 9.94' }),
        distractors: () => ['等撞到墙才反应', '把目标设得更近一点', '靠运气、多试几次'],
      },
    ],
  },
  {
    id: 'impedance', title: '阻抗 / 力控', kernel: impedanceKernel as Kernel<unknown>, doc: trivialDoc('impedance'),
    facts: [
      {
        id: 'why_not_position', label: '接触任务为什么不能只用位置控制',
        ask: '机械臂做装配/打磨等接触任务，为什么纯位置控制会砸坏工件?', kind: 'choice',
        compute: () => ({ answer: '位置控制很刚：为把位置误差压到 0 会死命顶。命令去墙后面的目标时，剩下的位置误差消不掉，就输出巨大接触力去顶——砸坏工件、伤人。它不知道该松手', step: 1, evidence: '本例命令去 x=8、墙在 x=5，位置控制硬顶出 480N' }),
        distractors: () => ['位置控制会停在墙前不动', '位置控制会自动绕过墙', '位置控制接触力太小、夹不住'],
      },
      {
        id: 'impedance_spring', label: '阻抗控制怎么柔顺、怎么调接触力',
        ask: '阻抗控制让机械臂柔顺接触，它把末端表现成什么？接触力怎么调?', kind: 'choice',
        compute: () => ({ answer: '让末端表现得像虚拟弹簧+阻尼 F=K(x目标−x)−D·ẋ，遇阻柔顺让步而非硬顶。接触力≈K×侵入深度，K(刚度)是你设的旋钮：软(小K)→轻贴、吸冲击、对人安全；硬(大K)→接近位置控制', step: 7, evidence: '本例阻抗控制(K=25)接触力 settle 到 ~73N，比刚性 480N 柔和 6.6 倍' }),
        distractors: () => ['让末端完全不动', '把电机关掉靠惯性', '接触力是固定的、不能调'],
      },
    ],
  },
  {
    id: 'pid', title: 'PID 控制', kernel: pidKernel as Kernel<unknown>, doc: trivialDoc('pid'),
    facts: [
      {
        id: 'p_oscillate', label: '纯 P 为什么震荡',
        ask: '用纯比例(P)控制一个质量块到目标位置，为什么会冲过头、来回震荡?', kind: 'choice',
        compute: () => ({ answer: '质量块是双积分、没有天然阻尼：纯 P 把它推向目标，但到目标时还有速度、刹不住 → 冲过头 → 反向 → 来回震荡。必须加 D(微分)提供阻尼才能停住', step: 5, evidence: '本例纯 P(Kp=0.4)第5步冲到 11.77(过目标10)还在涨' }),
        distractors: () => ['Kp 太小，调大就不震荡了', '质量块自己会震荡、和控制无关', '因为没有用积分 I'],
      },
      {
        id: 'pid_terms', label: 'PID 三项各管什么',
        ask: 'PID 控制的 P、I、D 三项分别按什么量、起什么作用?', kind: 'choice',
        compute: () => ({ answer: 'P=Kp·e 按当前误差使劲(越远越使劲)；D=Kd·误差变化率提供阻尼(快到时反向刹车、防冲过头);I=Ki·误差累计消除稳态误差(顶掉重力等恒定扰动)。P管现在、I管过去累计、D管趋势', step: 14, evidence: '本例加 D=Kd·误差变化率(负=刹车)后，位置平稳收敛到目标不震荡' }),
        distractors: () => ['三项都按当前误差，只是系数不同', 'D 让响应更快、P 提供阻尼', 'I 提供阻尼、D 消除稳态误差'],
      },
    ],
  },
  {
    id: 'ppo', title: 'PPO 近端策略优化', kernel: ppoKernel as Kernel<unknown>, doc: trivialDoc('ppo'),
    facts: [
      {
        id: 'ppo_clip', label: 'PPO 的裁剪目标起什么作用',
        ask: 'PPO 的裁剪替代目标 min(r·A, clip(r,1−ε,1+ε)·A) 起什么作用?', kind: 'choice',
        compute: () => ({ answer: '把每次更新限在信任域、防策略崩:重要性比 r=π_new/π_old 差出 ε(超 [1−ε,1+ε])就被裁剪、目标封顶、梯度=0,优化器得不到继续推大 r 的动力。用一行 min/clip 实现信任域、比 TRPO 简单得多', step: 3, evidence: 'r 差出 ε 就无梯度=信任域;防一步迈太大崩' }),
        distractors: () => ['让训练跑得更快', '把连续动作变成离散动作', '替代掉奖励函数'],
      },
      {
        id: 'ppo_ratio', label: '重要性比 r 是什么',
        ask: 'PPO 里的重要性比 r 是什么?衡量什么?', kind: 'choice',
        compute: () => ({ answer: 'r=π_θ(a|s)/π_θ_old(a|s):新策略给这个动作的概率÷旧策略的。r=1 表示没变、r>1 新策略更偏爱、r<1 更嫌弃。它衡量新策略离旧策略走了多远,PPO 就是盯住它别离 1 太远', step: 1, evidence: 'r=新/旧策略概率比;r=1 没变' }),
        distractors: () => ['r 是学习率', 'r 是折扣因子', 'r 是奖励与基线的比'],
      },
      {
        id: 'ppo_why', label: 'PPO 为何成主力',
        ask: 'PPO 相比 REINFORCE / TRPO 为什么成了主力?', kind: 'choice',
        compute: () => ({ answer: '比 TRPO(复杂的二阶信任域)简单得多、效果相当;比 REINFORCE 稳、超参不敏感,而且裁剪限制了更新幅度、同一批数据可跑多个 epoch(样本效率更高、不像 REINFORCE 用完即扔)。配 actor-critic+GAE 算优势', step: 5, evidence: '简单+稳+可多epoch复用batch' }),
        distractors: () => ['因为它是 off-policy、能复用所有旧数据', '因为它不需要优势函数', '因为它只能用于离散动作'],
      },
      {
        id: 'ppo_miniduck', label: 'PPO 和 miniduck 的关系',
        ask: 'PPO 和 miniduck(Open Duck Mini)是什么关系?', kind: 'choice',
        compute: () => ({ answer: 'miniduck 用 Brax PPO 在 MuJoCo 里学走路:动作是连续的关节位置残差,PPO 的优势里就是那套 velocity tracking + imitation(相位参考步态)奖励。PPO 是它的训练算法', step: 5, evidence: 'miniduck=Brax PPO 学腿式locomotion;连续关节残差' }),
        distractors: () => ['无关、miniduck 用模仿学习', 'miniduck 用值迭代', 'PPO 只能用于机械臂不能用于腿'],
      },
      {
        id: 'ppo_num', label: '大步的裁剪目标',
        ask: 'A=+1、ε=0.2，新策略把重要性比推到 r=1.5，裁剪目标 L^clip=min(r·A, clip(r,0.8,1.2)·A) 是多少?', kind: 'number',
        compute: t => { const f = t as unknown as { Lclip?: number; clipped?: boolean }[]; const l = f.find(x => x.clipped) ?? f[f.length - 1] as unknown as { Lclip?: number }; const v = l?.Lclip != null ? Math.round(l.Lclip * 10) / 10 : 1.2; return ({ answer: String(v), step: 3, evidence: `clip(1.5,0.8,1.2)=1.2、L^clip=min(1.5·1, 1.2·1)=${v}(被封在 1.2、超出 1+ε 无梯度)` }) },
        distractors: () => ['1.5', '1.0', '0.8', '2.0'],
      },
    ],
  },
  {
    id: 'policygrad', title: '策略梯度 REINFORCE', kernel: policygradKernel as Kernel<unknown>, doc: trivialDoc('policygrad'),
    facts: [
      {
        id: 'pg_theorem', label: '策略梯度在做什么',
        ask: '策略梯度(policy gradient)和值方法(Q-learning)最本质的区别?策略梯度定理直觉是什么?', kind: 'choice',
        compute: () => ({ answer: '值方法先学值 Q 再 argmax;策略梯度直接参数化策略 π_θ、对期望回报梯度上升。策略梯度定理 ∇J=E[∇log π·G]:把导致高回报 G 的动作、概率往上推。天然处理连续动作(值方法难对无穷动作 argmax)', step: 1, evidence: '直接学策略;∇log π·G 推高好动作' }),
        distractors: () => ['策略梯度也是先学 Q 再选动作', '策略梯度不需要奖励', '策略梯度只能处理离散动作'],
      },
      {
        id: 'pg_baseline', label: '基线/优势为何降方差',
        ask: '策略梯度里减去基线(用优势 A=G−b 代替回报 G)为什么重要?', kind: 'choice',
        compute: () => ({ answer: '降方差、且能正确压制低于平均的动作。纯回报 G 全是正的、任何被采到的动作都被推高(方差大、方向常错);减基线后用优势 A=G−b:A>0(高于平均)才推高、A<0(低于平均)压低。减基线不改变梯度期望(不引偏)、只降方差', step: 4, evidence: 'A=G−b;比平均好才强化;不引偏只降方差' }),
        distractors: () => ['加快计算', '让回报变成整数', '把 on-policy 变 off-policy'],
      },
      {
        id: 'pg_ac', label: '基线引向什么',
        ask: '把基线做成一个学出来的 V(s)，策略梯度就变成了什么?', kind: 'choice',
        compute: () => ({ answer: 'actor-critic:actor 是策略 π_θ、critic 学值 V(s) 当基线,用优势 A=G−V(s)(或 TD 优势)更新 actor。PPO、SAC 都是 actor-critic 的变体', step: 5, evidence: 'actor=策略、critic=V 基线;PPO/SAC 是其变体' }),
        distractors: () => ['Q-learning', '值迭代', '蒙特卡洛树搜索'],
      },
      {
        id: 'pg_onpolicy', label: '为何 on-policy 且要 PPO',
        ask: 'REINFORCE 是 on-policy 还是 off-policy?它有什么痛点、怎么解决?', kind: 'choice',
        compute: () => ({ answer: 'on-policy:必须用当前策略采的数据更新、用完即扔(样本效率低)。痛点是更新步子难调:太大一步可能把策略更新崩坏、太小又慢。PPO 用裁剪的替代目标把每次更新限制在信任域(新旧策略别差太多),稳且样本利用更好(miniduck 用的就是 PPO)', step: 5, evidence: 'on-policy;步子难调→PPO 裁剪限信任域' }),
        distractors: () => ['off-policy、可复用旧数据', '没有痛点、直接可用', '用更大的学习率就行'],
      },
      {
        id: 'pg_num', label: '较差动作的优势',
        ask: '单状态 2 动作(L 回报1、R 回报3、初始 π=[0.5,0.5])，采到 L；基线 b=Σπ·R，优势 A=G−b 是多少?', kind: 'number',
        compute: t => { const f = t as unknown as { adv?: number }[]; const l = f.find(x => x.adv != null); const v = l?.adv != null ? Math.round(l.adv) : -1; return ({ answer: String(v), step: 3, evidence: `b=0.5·1+0.5·3=2、A=G−b=1−2=${v}<0(L 低于平均、该压低)` }) },
        distractors: () => ['1', '2', '0', '3'],
      },
    ],
  },
  {
    id: 'qlearning', title: 'Q-learning · 免模型', kernel: qlearningKernel as Kernel<unknown>, doc: trivialDoc('qlearning'),
    facts: [
      {
        id: 'ql_modelfree', label: 'Q-learning 和值迭代的区别',
        ask: 'Q-learning 和 MDP 值迭代最本质的区别是什么?', kind: 'choice',
        compute: () => ({ answer: 'Q-learning 免模型:什么模型都不知道、只从和环境交互得到的经验元组 (s,a,r,s\') 学动作值 Q(s,a);值迭代要知道转移 P 和奖励 R(有模型)。真实机器人 P/R 常未知,所以要免模型', step: 1, evidence: '免模型(经验)vs 有模型(要 P/R)' }),
        distractors: () => ['Q-learning 更快、值迭代更准', 'Q-learning 不用折扣 γ', 'Q-learning 学 V、值迭代学 Q'],
      },
      {
        id: 'ql_td', label: 'TD 更新在做什么',
        ask: 'Q-learning 的 TD 更新 Q←Q+α[r+γmax Q(s\')−Q] 在做什么?', kind: 'choice',
        compute: () => ({ answer: '方括号是 TD 误差 δ=(即时奖励+折扣后对未来的估计 γmax Q(s\'))−(当前估计 Q(s,a)),用它按学习率 α 修正 Q。自举(bootstrapping):用当前对未来的估计更新自己、走一步更一次(不用等回合结束)', step: 2, evidence: 'δ=目标−当前;自举、在线更新' }),
        distractors: () => ['等整局结束后统计平均回报', '直接把 Q 设成奖励 r', '随机扰动 Q'],
      },
      {
        id: 'ql_offpolicy', label: 'off-policy 与探索',
        ask: 'Q-learning 为什么叫 off-policy?为什么需要探索?', kind: 'choice',
        compute: () => ({ answer: 'off-policy:更新用 max(目标策略是贪心)、但行为可以带探索(行为策略 ε-greedy)——学的策略和执行的策略可以不一样。需要探索是因为:要学到最优必须走遍各状态动作,只贪心会错过没试过的好动作(探索 vs 利用)', step: 5, evidence: '更新用max、行为带ε-greedy;探索走遍' }),
        distractors: () => ['off-policy 指不用奖励', '探索是为了跑得快', 'on-policy 和 off-policy 完全一样'],
      },
      {
        id: 'ql_converge', label: 'Q-learning 收敛到哪',
        ask: 'Q-learning 多回合后收敛到什么?说明了什么?', kind: 'choice',
        compute: () => ({ answer: '收敛到和值迭代完全一样的最优 Q*(本例 [0.81,0.9,1]=γ^步数·1)。说明:免模型、只靠经验试错,也能学到和有模型值迭代一样的最优值。α 只影响速度不影响收敛点(大快但抖、小慢但稳)', step: 4, evidence: '收敛=值迭代 V*;免模型学到同解' }),
        distractors: () => ['收敛到 0', '收敛到比值迭代差的次优', '不会收敛、一直震荡'],
      },
      {
        id: 'ql_num', label: 'C→G 的 TD 误差',
        ask: 'Q 全 0、经验 (C,→,r=1,G)、γ=0.9，这次 TD 误差 δ=r+γ·max Q(G)−Q(C,→) 是多少?', kind: 'number',
        compute: t => { const f = t as unknown as { td?: { delta: number } }[]; const l = f.find(x => x.td); const v = l?.td?.delta ?? 1; return ({ answer: String(v), step: 2, evidence: `δ=1+0.9·0−0=${v}(Q 全 0、只有即时奖励 r=1);Q(C,→)←α·δ` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'mdp', title: 'MDP · 贝尔曼值迭代', kernel: mdpKernel as Kernel<unknown>, doc: trivialDoc('mdp'),
    facts: [
      {
        id: 'mdp_bellman', label: '贝尔曼最优方程在说什么',
        ask: '贝尔曼最优方程 V*(s)=max_a[R+γV*(s\')] 在说什么?', kind: 'choice',
        compute: () => ({ answer: '一个状态的值=选最好的动作、拿到即时奖励 R + 折扣 γ 后的下一个状态的值。它是递归的(自己的值用邻居的值定义),表达"最优地走下去能拿多少折扣回报"', step: 3, evidence: 'V=即时奖励+折扣未来值;取 max 动作' }),
        distractors: () => ['一个状态的值=所有动作奖励的平均', '一个状态的值=离目标的欧氏距离', '一个状态的值=转移概率之和'],
      },
      {
        id: 'mdp_valueiter', label: '值迭代怎么收敛',
        ask: '值迭代是怎么求出最优值的?值怎么传播?', kind: 'choice',
        compute: () => ({ answer: '反复做贝尔曼备份 V_{k+1}(s)=max_a[R+γV_k(s\')] 直到不再变。值像水波从目标状态往回扩散:第1次紧挨目标的状态变、第2次再往回一格……每扫一次信息往回传一格,收敛后 argmax 得最优策略', step: 4, evidence: '值从目标往回传;iter1 C=1、iter2 B=γ、iter3 A=γ²' }),
        distractors: () => ['从起点往目标正向传播', '一次扫描就得到最优', '随机更新直到稳定'],
      },
      {
        id: 'mdp_gamma', label: '折扣 γ 的作用',
        ask: 'MDP 里的折扣 γ 是干什么的?γ 大和小有什么区别?', kind: 'choice',
        compute: () => ({ answer: 'γ∈[0,1) 折扣未来奖励(累积回报 Σγ^t r_t),让近期奖励更值钱、也保证无穷步和收敛。γ 越大越远视(远处奖励也看重、本例 A=γ²=0.81)、越小越短视(只顾眼前、γ=0.5 时 A 只值 0.25)', step: 5, evidence: 'V=γ^步数·奖励;γ 大远视、小短视' }),
        distractors: () => ['γ 是学习率、控制更新快慢', 'γ 是探索率', 'γ 只是防止除零'],
      },
      {
        id: 'mdp_vq', label: 'V 和 Q 的区别',
        ask: '值函数 V(s) 和 Q(s,a) 有什么区别?为什么 Q 更常用?', kind: 'choice',
        compute: () => ({ answer: 'V(s)是状态值、Q(s,a)是状态-动作值(在 s 做 a、之后最优的回报)。Q 更常用:argmax_a Q(s,a) 直接给出策略、不需要转移模型 P;用 V 选动作还得知道 P 才能算下个状态', step: 5, evidence: 'Q 选动作免模型;V 选动作要 P' }),
        distractors: () => ['V 和 Q 完全等价', 'V 是动作值、Q 是状态值', 'Q 只用于有模型情形'],
      },
      {
        id: 'mdp_num', label: 'A 状态的最优值',
        ask: '4 状态链 A→B→C→G、C→G 得 +1、γ=0.9，值迭代收敛后 V*(A) 约为多少?(两位小数)', kind: 'number',
        compute: t => { const f = t as unknown as { vFinal?: Record<string, number> }[]; const l = f.find(x => x.vFinal && x.vFinal.A); const v = l?.vFinal?.A != null ? Math.round(l.vFinal.A * 100) / 100 : 0.81; return ({ answer: String(v), step: 5, evidence: `A 离 G 有 3 步、V(A)=γ³?不,C→G才有奖励:V(A)=γ²·1=0.9²=${v}(A→B→C 两步折扣、C 拿 +1)` }) },
        distractors: () => ['0.9', '1.0', '0.5', '0.25'],
      },
    ],
  },
  {
    id: 'prm', title: 'PRM 概率路图', kernel: prmKernel as Kernel<unknown>, doc: trivialDoc('prm'),
    facts: [
      {
        id: 'prm_vs_rrt', label: 'PRM 和 RRT 的区别',
        ask: 'PRM 和 RRT 最本质的区别是什么?', kind: 'choice',
        compute: () => ({ answer: 'PRM 多查询:先建一张覆盖自由空间的路图、之后每次查询只在图上搜(建一次答多次、适合固定环境反复规划);RRT 单查询:每次朝一个目标从头长一棵树、用完即弃(增量、适合一次性/高维)。都概率完备', step: 1, evidence: '多查询(建路图)vs 单查询(长树)' }),
        distractors: () => ['PRM 更快、RRT 更准', 'PRM 不需要碰撞检测', 'PRM 是最优的、RRT 不是'],
      },
      {
        id: 'prm_phases', label: 'PRM 的两个阶段',
        ask: 'PRM 的两个阶段分别做什么?', kind: 'choice',
        compute: () => ({ answer: '①建图:自由空间采样节点、每个连 k 近邻、每条边碰撞检测(穿过障碍的丢掉)构成路图;②查询:起点/终点接入路图、用 Dijkstra/A* 在图上搜最短路。建图一次、查询多次', step: 1, evidence: '建图(采样+连边+碰撞检测)+查询(图搜索)' }),
        distractors: () => ['①随机长树 ②回溯路径', '①梯度下降 ②收敛', '①栅格化 ②启发式搜索'],
      },
      {
        id: 'prm_narrow', label: 'PRM 的核心难点',
        ask: 'PRM 最容易出问题的地方是什么?怎么解决?', kind: 'choice',
        compute: () => ({ answer: '窄通道/采样密度:窄通道(两障碍间的缝)采样命中概率极低、路图容易在那里断开、找不到路(不是没路、是没覆盖到)。对策:加采样、窄通道采样(桥采样 bridge sampling/高斯采样)、PRM*', step: 5, evidence: '采样太稀→路图断开;桥采样专补窄缝' }),
        distractors: () => ['计算最短路太慢', '节点太多内存不够', '起点终点没法接入'],
      },
      {
        id: 'prm_collision', label: '碰撞检测为何是瓶颈',
        ask: 'PRM 里最耗时的部分是什么?为什么?', kind: 'choice',
        compute: () => ({ answer: '边的碰撞检测(collision checking):建图时每对候选边都要检测连线是否无碰、节点一多检测次数爆炸,查询接入也要检测。是采样规划共同的瓶颈,工程上用层次包围盒/GJK 加速', step: 2, evidence: '每条候选边都要碰撞检测;节点多则爆炸' }),
        distractors: () => ['随机采样本身', 'Dijkstra 图搜索', '起终点接入'],
      },
      {
        id: 'prm_num', label: 'PRM 找到的最短路长',
        ask: '本例障碍挡住最短的 B-D 边，PRM 绕障碍上方的路径 S-A-C-D-G 总长约为多少?(取整)', kind: 'number',
        compute: t => { const f = t as unknown as { pathLen?: number; connected?: boolean }[]; const l = f.find(x => x.connected && x.pathLen) ?? f[f.length - 1] as unknown as { pathLen?: number }; const v = l?.pathLen != null ? Math.round(l.pathLen) : 9; return ({ answer: String(v), step: 3, evidence: `S-A(2.5)+A-C(2.24)+C-D(2.24)+D-G(2.5)=9.48≈${v};B-D 直连被障碍挡、只能绕上方` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'trapezoid', title: '梯形速度曲线', kernel: trapezoidKernel as Kernel<unknown>, doc: trivialDoc('trapezoid'),
    facts: [
      {
        id: 'trap_what', label: '梯形速度曲线为何时间最优',
        ask: '梯形速度曲线(加速-匀速-减速)为什么在 v_max/a_max 约束下时间最优?', kind: 'choice',
        compute: () => ({ answer: 'bang-bang:全程要么全力加速(+a_max)、要么全力减速(−a_max)、加速度始终取极值,中间尽量以 v_max 匀速。在速度/加速度上限下,任何别的走法都更慢或违反约束,所以它最快', step: 5, evidence: '加速度取极值=bang-bang=时间最优' }),
        distractors: () => ['因为它最平滑', '因为加速度恒为 0', '因为它是三次多项式'],
      },
      {
        id: 'trap_regime', label: '何时退化成三角',
        ask: '梯形速度曲线什么时候退化成三角形?', kind: 'choice',
        compute: t => { const f = t as unknown as { dA?: number }[]; const dA = f.find(x => x.dA != null)?.dA ?? 2; return ({ answer: `距离太短:D < 2·d_a(加速+减速的距离和,本例 2·${dA}=${2 * dA})。还没加到 v_max 就得开始减速、根本达不到 v_max,曲线退化成三角,峰值 v_peak=√(a_max·D)`, step: 2, evidence: `D<2 d_a→三角;v_peak=√(a_max·D)<v_max` }) },
        distractors: () => ['加速度太大时', '速度上限太高时永远是三角', '距离很长时'],
      },
      {
        id: 'trap_time', label: '总时间怎么算',
        ask: '梯形/三角速度曲线的总时间怎么算?', kind: 'choice',
        compute: () => ({ answer: '梯形:T=2·t_a+t_c,t_a=v_max/a_max、匀速段 t_c=(D−2 d_a)/v_max;三角:T=2·√(D/a_max)(没有匀速段)。都是约束下走完 D 的最短时间', step: 4, evidence: '梯形 2 t_a+t_c、三角 2√(D/a_max)' }),
        distractors: () => ['T=D/v_max、匀速走全程', 'T=√(2D/a_max)、全程加速', 'T 和加速度无关'],
      },
      {
        id: 'trap_scurve', label: 'S 曲线比梯形好在哪',
        ask: 'S 曲线相比梯形速度曲线好在哪?代价是什么?', kind: 'choice',
        compute: () => ({ answer: '梯形曲线的加速度是阶跃(瞬间从0跳到a_max)、会激起振动冲击;S 曲线再限制 jerk(加速度的变化率),让加速度也平滑升降→运动更柔、对机械和负载更友好。代价是稍慢、更复杂(七段式)', step: 5, evidence: 'S 曲线限 jerk、抗振;梯形加速度阶跃' }),
        distractors: () => ['S 曲线更快、无任何代价', 'S 曲线不需要 v_max/a_max', 'S 曲线是直线、最简单'],
      },
      {
        id: 'trap_num', label: '长距离总时间',
        ask: '走 D=10m、v_max=2m/s、a_max=1m/s²，梯形速度曲线的总时间 T 是多少?(秒)', kind: 'number',
        compute: t => { const f = t as unknown as { tTotal?: number; isTrap?: boolean }[]; const l = f.find(x => x.isTrap) ?? f[f.length - 1] as unknown as { tTotal?: number }; const v = l?.tTotal != null ? Math.round(l.tTotal) : 7; return ({ answer: String(v), step: 4, evidence: `t_a=2s、d_a=2m、匀速 d_c=10−4=6m、t_c=3s → T=2·2+3=${v}s` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'chomp', title: 'CHOMP 轨迹优化', kernel: chompKernel as Kernel<unknown>, doc: trivialDoc('chomp'),
    facts: [
      {
        id: 'chomp_what', label: 'CHOMP 属于哪一类规划',
        ask: 'CHOMP 属于哪一类运动规划?和 RRT 最大的不同?', kind: 'choice',
        compute: () => ({ answer: '优化式规划:把整条轨迹 ξ=[q_1..q_n] 当变量、定义代价 U=平滑项+避障项、梯度下降 ξ←ξ−α∇U。RRT 是采样式、出的是几何折线还要再平滑;CHOMP 直接产出平滑、避障、可执行的轨迹', step: 1, evidence: '优化整条轨迹 vs 采样长树' }),
        distractors: () => ['采样式、和 RRT 一样随机长树', '搜索式、和 A* 一样栅格搜', '反应式、和势场一样只看眼前'],
      },
      {
        id: 'chomp_grad', label: 'CHOMP 的两个梯度',
        ask: 'CHOMP 代价的梯度有哪两个分量?各干什么?', kind: 'choice',
        compute: () => ({ answer: '避障梯度:把落在障碍影响半径 d0 内的路点沿远离障碍方向推(大小∝d0−dist、越近越猛);平滑梯度:把每个路点拉向左右邻居的中点(Laplacian、∝2q_i−q_{i−1}−q_{i+1}、惩罚急转)。两者合起来梯度下降', step: 3, evidence: '避障推离+平滑拉向邻居中点' }),
        distractors: () => ['一个算速度、一个算加速度', '一个正向、一个反向传播', '只有避障梯度、没有平滑'],
      },
      {
        id: 'chomp_localmin', label: 'CHOMP 的死穴',
        ask: 'CHOMP 有什么死穴?怎么缓解?', kind: 'choice',
        compute: () => ({ answer: '局部极小(和势场一样、梯度下降会卡住、障碍布局刁钻时优化不出可行轨迹)。缓解:从多条不同初始轨迹分别优化取最好,或先用 RRT 出一条可行初值、再用 CHOMP 平滑(全局管能到、优化管好走)', step: 5, evidence: '局部极小;多初值或先RRT出初值' }),
        distractors: () => ['没有死穴、总能找到最优', '计算太慢是唯一问题', '只能用于二维'],
      },
      {
        id: 'chomp_covariant', label: '协变是什么意思',
        ask: 'CHOMP 名字里的"协变(covariant)"指什么?', kind: 'choice',
        compute: () => ({ answer: '用一个度量矩阵 A(编码轨迹平滑度)做更新、而不是朴素欧氏梯度——让更新和轨迹的参数化无关、更稳、避免只有个别路点抖动。是 CHOMP 更新更平顺的关键', step: 5, evidence: '用度量A更新、非欧氏梯度、参数化无关' }),
        distractors: () => ['指轨迹随时间变化', '指多个机器人协同', '指梯度取协方差'],
      },
      {
        id: 'chomp_num', label: '避障优先的梯度大小',
        ask: '避障优先(k_obs=2)、q2 离障碍 0.6、d0=1，避障梯度大小=k_obs·(d0−dist) 是多少?', kind: 'number',
        compute: t => { const f = t as unknown as { gObs?: number[] }[]; const l = f.find(x => x.gObs && (x.gObs[0] !== 0 || x.gObs[1] !== 0)); const mag = l?.gObs ? Math.round(Math.sqrt(l.gObs[0]! ** 2 + l.gObs[1]! ** 2) * 10) / 10 : 0.8; return ({ answer: String(mag), step: 3, evidence: `k_obs·(d0−dist)=2·(1−0.6)=2·0.4=${mag}(把 q2 往下推这么多、离障碍越近推越猛)` }) },
        distractors: () => ['0.4', '0.2', '1.0', '2.0'],
      },
    ],
  },
  {
    id: 'gjk', title: 'GJK 碰撞检测', kernel: gjkKernel as Kernel<unknown>, doc: trivialDoc('gjk'),
    facts: [
      {
        id: 'gjk_core', label: 'GJK 本质在判什么',
        ask: 'GJK 判两个凸形碰没碰,本质上是在判什么?', kind: 'choice',
        compute: () => ({ answer: '原点在不在 Minkowski 差 A⊖B={a−b} 里。有个结论:两凸形相交 ⟺ 原点∈A⊖B(A、B 有公共点 p ⟺ p−p=原点∈A⊖B)。于是"两形碰不碰"变成"一个凸形含不含原点"', step: 1, evidence: '两凸形碰⟺原点∈A⊖B' }),
        distractors: () => ['两形中心的距离小不小', '两形有没有公共顶点', '两形面积谁大'],
      },
      {
        id: 'gjk_support', label: '支撑函数的作用',
        ask: 'GJK 里的支撑函数 support(d) 是什么?为什么它让 GJK 高效?', kind: 'choice',
        compute: () => ({ answer: 'support(shape,d)=沿方向 d 最远的顶点;A⊖B 在 d 上的最远点 a=support_A(d)−support_B(−d)。GJK 不显式构造整个 A⊖B(可能很大),每轮只朝一个方向要一个最远点、懒惰地围原点建单纯形,所以对任意凸形都快', step: 2, evidence: '朝一个方向要最远点、不建整个差集' }),
        distractors: () => ['两形所有顶点两两求差、建出完整 A⊖B', '沿方向 d 最近的顶点', '形状的质心'],
      },
      {
        id: 'gjk_exit', label: '不碰怎么提前判定',
        ask: 'GJK 怎么在两形不碰时提前退出(不必建完整个差集)?', kind: 'choice',
        compute: () => ({ answer: '每轮取支撑点 a 后判 a·d:若 a·d<0,说明沿当前方向(指向原点)"最远"都没越过原点 → 原点在 A⊖B 之外 → 两形不碰,立刻返回。这个提前退出是 GJK 高效的关键', step: 4, evidence: 'a·d<0→最远没越过原点→不碰、停' }),
        distractors: () => ['单纯形凑够三个点还没含原点就停', '迭代固定 10 轮后停', '两形距离大于阈值就停'],
      },
      {
        id: 'gjk_epa', label: '穿透深度怎么求',
        ask: 'GJK 判出"碰了",还想知道"穿透多深/最小把它们分开要推多远",怎么办?', kind: 'choice',
        compute: () => ({ answer: '接 EPA(Expanding Polytope Algorithm):从 GJK 结束时那个含原点的单纯形出发、朝表面不断加支撑点把多面体往外扩,逼近 A⊖B 的边界,求出原点到边界的最近距离=穿透深度、方向=最小平移向量(MTV)', step: 5, evidence: 'EPA 从含原点单纯形往外扩、求穿透深度/MTV' }),
        distractors: () => ['GJK 自己就直接给出穿透深度', '再跑一次 GJK 交换 A、B', '穿透深度无法计算'],
      },
      {
        id: 'gjk_num', label: '不碰时的 a·d',
        ask: '分离场景第 2 轮朝 d=[72,0] 取支撑点 a=[-2,-1]，a·d 是多少?(<0 即判不碰)', kind: 'number',
        compute: t => { const f = t as unknown as { stage?: string; passed?: boolean; adot?: number }[]; const l = f.find(x => x.stage === 'support' && x.passed === false); const v = l?.adot ?? -144; return ({ answer: String(v), step: 4, evidence: `a·d=(-2)·72+(-1)·0=${v}<0 → 沿 d 最远都没越过原点 → 不碰` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'dubins', title: 'Dubins 曲线', kernel: dubinsKernel as Kernel<unknown>, doc: trivialDoc('dubins'),
    facts: [
      {
        id: 'du_shape', label: 'Dubins 最短路的形状',
        ask: 'Dubins 曲线说,只能前进、有最小转弯半径的车,两位姿间最短路是什么形状?', kind: 'choice',
        compute: () => ({ answer: '三段拼成、且只可能是 6 种"词"之一:CSC(转-直-转)LSL/RSR/LSR/RSL、CCC(转-转-转)RLR/LRL。L=左转弧、R=右转弧、S=直线,圆弧半径都=最小转弯半径 R。每种词闭式算三段、取最短', step: 1, evidence: '三段、6 种词(CSC+CCC)取最短' }),
        distractors: () => ['总是一条直线', '任意光滑曲线都行', '一段圆弧'],
      },
      {
        id: 'du_why', label: '为什么要用 Dubins',
        ask: '给车式/差速机器人规划,为什么不能像质点那样两点连直线?', kind: 'choice',
        compute: () => ({ answer: '车有非完整约束(不能横着走)和最小转弯半径,直线要求任意方向瞬移、车根本拐不过来。所以两个位姿之间要用 Dubins(只前进)或 Reeds-Shepp(可倒车)这种满足转弯半径的曲线来连', step: 1, evidence: '非完整+最小转弯半径、直线拐不过来' }),
        distractors: () => ['直线太短、绕远反而快', '质点和车没区别、只是习惯', '直线会撞障碍'],
      },
      {
        id: 'du_pose', label: '最优词由什么决定',
        ask: '本例起点终点位置不变,只把终点朝向从朝上换成朝下,最优的 Dubins 词发生了什么?', kind: 'choice',
        compute: () => ({ answer: '从 LSL(3.807)变成了 LSR(5.712)。说明最优词由位姿(尤其朝向)决定、不只看位置——Dubins 把 (起点朝向α、终点朝向β、距离d) 参数空间划分成若干区域、每块对应一种最优词', step: 4, evidence: '朝上→LSL、朝下→LSR;最优词由位姿定' }),
        distractors: () => ['最优词不变、还是 LSL', '变成一条直线 S', '两种朝向长度一样'],
      },
      {
        id: 'du_rs', label: 'Reeds-Shepp 的区别',
        ask: 'Reeds-Shepp 曲线和 Dubins 曲线最主要的区别是什么?', kind: 'choice',
        compute: () => ({ answer: 'Reeds-Shepp 允许车倒车(有前进也有后退段),是 Dubins(只前进)的推广、词的种类更多(含后退共 48 种情形)。停车、狭窄空间掉头等需要倒车的场景用 Reeds-Shepp;只前进的场景用 Dubins', step: 5, evidence: 'Reeds-Shepp 可倒车、Dubins 只前进' }),
        distractors: () => ['Reeds-Shepp 不需要最小转弯半径', 'Reeds-Shepp 用于机械臂、Dubins 用于车', '两者完全一样、只是名字不同'],
      },
      {
        id: 'du_num', label: '最短总长',
        ask: '起点(0,0,0°)、终点(3,2,90°)、最小转弯半径 R=1，最优 LSL 的总长是多少?(保留三位)', kind: 'number',
        compute: t => { const f = t as unknown as { bestType?: string; len?: number }[]; const l = f.find(x => x.bestType === 'LSL' && x.len != null); const v = l?.len ?? 3.807; return ({ answer: String(v), step: 4, evidence: `LSL=左转0.464+直2.236+左转1.107=${v}(四种 CSC 里最短)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'potentialfield', title: '人工势场法', kernel: potentialfieldKernel as Kernel<unknown>, doc: trivialDoc('potentialfield'),
    facts: [
      {
        id: 'pf_how', label: '势场法怎么工作',
        ask: '人工势场法是怎么规划路径的?', kind: 'choice',
        compute: () => ({ answer: '给空间造势能面:目标产生引力 F_att=k_att·(q_goal−q)(拉向目标)、障碍产生斥力 F_rep(仅影响半径 ρ0 内、∝1/ρ²、推离障碍),机器人顺合力 F=F_att+F_rep 梯度下降(往目标去、绕开障碍)。极简、反应式、快', step: 1, evidence: '引力+斥力顺合力下山;不采样不搜图' }),
        distractors: () => ['随机采样长一棵树(那是 RRT)', '在栅格上用启发式搜索(那是 A*)', '枚举所有路径选最短'],
      },
      {
        id: 'pf_localmin', label: '势场法的死穴',
        ask: '人工势场法最有名的失败模式是什么?为什么?', kind: 'choice',
        compute: () => ({ answer: '局部极小(local minimum):障碍正挡在机器人和目标之间时,引力(朝目标)和斥力(离障碍)共线相反、某处完全抵消→合力≈0→机器人卡在离目标还很远的"假谷"里、到不了。这是势场叠加的拓扑必然、调参救不了', step: 5, evidence: '引力斥力共线相反抵消;本例卡在离目标 5.43' }),
        distractors: () => ['计算太慢、实时跑不动', '会撞上障碍物', '只能走直线'],
      },
      {
        id: 'pf_repulsive', label: '斥力为什么用 1/ρ²',
        ask: '势场斥力 F_rep 里为什么用 1/ρ²、还限定影响半径 ρ0?', kind: 'choice',
        compute: () => ({ answer: '1/ρ² 让越靠近障碍斥力越猛(趋无穷),保证机器人撞不上;限定 ρ≤ρ0(影响半径)是让远处不受障碍影响、只在快撞上时才推,否则每个障碍都全局作用会乱', step: 2, evidence: '越近越猛防撞;超出 ρ0 斥力=0' }),
        distractors: () => ['1/ρ² 只是好算', '影响半径是为了省内存', '斥力和距离无关、是常数'],
      },
      {
        id: 'pf_fix', label: '局部极小怎么救',
        ask: '势场法卡在局部极小，有哪些解法?', kind: 'choice',
        compute: () => ({ answer: '①随机扰动:卡住时给个随机推力跳出;②导航函数:构造保证只有目标一个极小的势场(优雅但难构造);③和全局规划结合(最常用):RRT/A* 出无碰全局路、势场只在附近做局部平滑避障——全局管不卡住、势场管实时反应', step: 5, evidence: '扰动/导航函数/配全局规划(RRT)' }),
        distractors: () => ['加大引力系数就行', '换个初始位置重试', '无解、只能放弃势场法'],
      },
      {
        id: 'pf_num', label: '卡住时离目标多远',
        ask: '障碍正中场景，机器人卡在局部极小(合力≈0)时，离目标大约还有多远?(取整)', kind: 'number',
        compute: t => { const f = t as unknown as { distToGoal?: number; stuck?: boolean }[]; const l = f.find(x => x.stuck) ?? f[f.length - 1] as unknown as { distToGoal?: number }; const v = l?.distToGoal != null ? Math.round(l.distToGoal) : 5; return ({ answer: String(v), step: 5, evidence: `卡在 x≈4.57、目标 x=10,离目标 5.43≈${v}——合力≈0 却远没到目标,这就是局部极小` }) },
        distractors: () => ['0', '1', '10', '3'],
      },
    ],
  },
  {
    id: 'rrtstar', title: 'RRT* · 渐近最优', kernel: rrtstarKernel as Kernel<unknown>, doc: trivialDoc('rrtstar'),
    facts: [
      {
        id: 'rrts_two', label: 'RRT* 多做的两步',
        ask: 'RRT* 相比 RRT，多做了哪两步来趋近最优?', kind: 'choice',
        compute: () => ({ answer: '①选父(choose parent):新点在半径 r 邻域里选"起点→新点代价=cost[邻居]+dist"最小的邻居当父(不是几何最近的);②重连(rewire):加完新点后,把邻域里"经新点更省"的邻居改接到新点、降其代价', step: 1, evidence: '选父+重连让树随采样渐近最优' }),
        distractors: () => ['增大步长+多采样几个点', '用 A* 的启发式代替随机采样', '每步回溯整棵树重新规划'],
      },
      {
        id: 'rrts_complete', label: 'RRT 和 RRT* 的保证',
        ask: 'RRT 和 RRT* 在"能找到什么样的路"上有什么本质区别?', kind: 'choice',
        compute: () => ({ answer: 'RRT 只保证概率完备:样本够多必找到一条可行路,但不最优(接最近≠代价最小)、再多采样也不变好;RRT* 在此基础上还保证渐近最优:随采样数→∞ 收敛到最短路', step: 5, evidence: '概率完备(RRT)vs 渐近最优(RRT*)' }),
        distractors: () => ['两者都保证最优、只是 RRT* 更快', '两者都不保证找到路', 'RRT 最优、RRT* 只是更快'],
      },
      {
        id: 'rrts_radius', label: '邻域半径为何收缩',
        ask: 'RRT* 的邻域半径 r 为什么不用固定值、而是随节点数收缩?', kind: 'choice',
        compute: () => ({ answer: 'r 按 (γ·log n/n)^(1/d) 随节点数 n 收缩:节点越多、半径越小。这样既保证渐近最优的理论性质,又不至于节点多了每步要查一大堆邻居(平衡最优性和计算量)', step: 5, evidence: 'r∝(γ·log n/n)^(1/d);平衡最优与开销' }),
        distractors: () => ['半径固定就够了、不用收缩', '半径应该随节点增多而增大', '半径和最优性无关、随便取'],
      },
      {
        id: 'rrts_cost', label: 'RRT* 的代价',
        ask: 'RRT* 相比 RRT 有什么代价?怎么加速?', kind: 'choice',
        compute: () => ({ answer: '每步要查邻域、算多条代价、还可能重连,比 RRT 慢、每步开销大,而且收敛到最优较慢(初期解也绕)。加速:Informed RRT*(找到初解后只在包住起终点的椭球内采样)、RRT*-Connect、BIT* 等', step: 5, evidence: '慢+初解绕;Informed RRT* 加速收敛' }),
        distractors: () => ['没有代价、RRT* 全面更快', '只是内存多一点、速度一样', 'RRT* 反而更省内存'],
      },
      {
        id: 'rrts_num', label: 'RRT* 选父后的代价',
        ask: '本例邻域 A(cost4,dist2)、B(cost8,dist1)，RRT* 选父后 x_new 的代价是多少?(选 cost[邻居]+dist 最小)', kind: 'number',
        compute: t => { const f = t as unknown as { starCost?: number }[]; const l = f.find(x => x.starCost != null); const v = l?.starCost != null ? Math.round(l.starCost) : 6; return ({ answer: String(v), step: 3, evidence: `经 A=4+2=6、经 B=8+1=9,取最小=${v}(选 A、非最近的 B);RRT 接最近 B 则代价 9` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'rrt', title: 'RRT 运动规划', kernel: rrtKernel as Kernel<unknown>, doc: trivialDoc('rrt'),
    facts: [
      {
        id: 'rrt_avoid', label: 'RRT 怎么自动避开障碍',
        ask: 'RRT 长树时并没有专门的"避障算法"，它是怎么让路径绕开障碍的?', kind: 'choice',
        compute: () => ({ answer: '每次朝采样点迈一步时做碰撞检测：若这一步撞障碍/出界就丢弃、不加进树。撞的方向长不出去，树只往空白处蔓延，于是自然绕开障碍', step: 4, evidence: '本例朝中央障碍方向的采样一步步被丢弃(共9次)，树沿左侧空白往上绕过去' }),
        distractors: () => ['先算出障碍的边界再规划绕行', '把障碍当成排斥力推开树', 'RRT 不能避障、需要额外算法'],
      },
      {
        id: 'rrt_optimal', label: 'RRT 完备但不最优',
        ask: 'RRT 找到的路径是不是最短/最优的？它的理论保证是什么?', kind: 'choice',
        compute: () => ({ answer: 'RRT 概率完备(采样够多迟早找到一条可行路)，但不最优——随机采样长出的路径歪歪扭扭、通常不是最短的，要后处理平滑，或用 RRT*(边长树边重接父节点)求近似最优', step: 19, evidence: '本例回溯出的 8 段路径能到终点但不是最短；换种子路径还不一样' }),
        distractors: () => ['RRT 保证找到最短路径', 'RRT 既不完备也无任何保证', 'RRT 总是找到唯一的一条路'],
      },
    ],
  },
  {
    id: 'rrtconnect', title: 'RRT-Connect 双向规划', kernel: rrtconnectKernel as Kernel<unknown>, doc: trivialDoc('rrtconnect'),
    facts: [
      {
        id: 'rc_fast', label: 'RRT-Connect 为什么快',
        ask: 'RRT-Connect 相比单树 RRT 主要快在哪?', kind: 'choice',
        compute: () => ({ answer: '两个改动:①双向——一棵树从起点长、一棵从终点长,两头对着挖、搜索空间对半分;②贪心 CONNECT——让另一棵树朝对方新节点连续迈步(一次走一串、不是一步)、直奔过去。所以通常比单树 RRT 快好几倍,是 MoveIt/OMPL 机械臂规划默认', step: 1, evidence: '双向两棵树 + 贪心 CONNECT(一次走一串)' }),
        distractors: () => ['用了更快的随机数生成器', '不做碰撞检测所以快', '把障碍预先算出来避开'],
      },
      {
        id: 'rc_extend', label: 'EXTEND 和 CONNECT 的区别',
        ask: 'RRT-Connect 里 EXTEND 和 CONNECT 有什么区别?', kind: 'choice',
        compute: () => ({ answer: 'EXTEND 是当前树朝随机采样点只迈一步得到 q_new(撞障碍就丢);CONNECT 是让另一棵树朝这个 q_new 连续迈步、一路走到够到 q_new(相遇)或撞障碍才停。CONNECT 的贪心一次走一串,是加速关键', step: 2, evidence: 'EXTEND 迈一步、CONNECT 连续迈步到够到或撞障碍' }),
        distractors: () => ['两个一样、都只迈一步', 'EXTEND 走一串、CONNECT 走一步', 'CONNECT 是做碰撞检测'],
      },
      {
        id: 'rc_meet', label: '两树怎么拼出路径',
        ask: 'RRT-Connect 里两棵树相遇后怎么得到完整路径?', kind: 'choice',
        compute: () => ({ answer: 'CONNECT 让一棵树够到另一棵树的新节点 q_new,两树在此相遇;从相遇点分别沿各自的父指针回溯到起点树根和终点树根,把两段拼起来就是起点→终点的完整路径。没相遇就交换两棵树继续', step: 3, evidence: '相遇点分别回溯到两树根、拼接' }),
        distractors: () => ['随便连一条直线', '只用起点树、终点树丢掉', '重新从头搜一遍'],
      },
      {
        id: 'rc_optimal', label: 'RRT-Connect 最优吗',
        ask: 'RRT-Connect 找到的路径是最优的吗?', kind: 'choice',
        compute: () => ({ answer: '不是。和 RRT 一样概率完备(采样够多迟早找到可行路)但不最优——拼出的路径歪歪扭扭、不是最短,要后处理平滑,或用双向的 RRT*-Connect/BIT* 求近似最优', step: 4, evidence: '概率完备但不最优、路径要平滑' }),
        distractors: () => ['是、保证最短路径', '既不完备也无保证', '总是找到唯一一条路'],
      },
      {
        id: 'rc_use', label: 'RRT-Connect 用在哪',
        ask: 'RRT-Connect 典型用在哪?', kind: 'choice',
        compute: () => ({ answer: '机械臂在高维关节空间(6/7 维)的运动规划,是 MoveIt/OMPL 的默认规划器;适合起点终点位形都已知、要快速找一条可行路的场景。车式机器人用时,两点之间的迈步/连接要换成满足转弯半径的 Dubins/Reeds-Shepp 曲线', step: 4, evidence: 'MoveIt/OMPL 默认、机械臂关节空间规划' }),
        distractors: () => ['给点云做配准', '数据库查询优化', '相机标定'],
      },
    ],
  },
  {
    id: 'dstarlite', title: 'D* Lite 增量重规划', kernel: dstarliteKernel as Kernel<unknown>, doc: trivialDoc('dstarlite'),
    facts: [
      {
        id: 'ds_idea', label: 'D* Lite 省在哪',
        ask: 'D* Lite 相比"每次从头 A* 重搜",主要省在哪?', kind: 'choice',
        compute: () => ({ answer: '地图变了(发现新障碍)时,只让改动局部失效、只重算受影响的少数格及其下游,其余格子的 g 值原样复用(增量);不像从头 A* 把整张图重搜一遍。地图越大、改动越局部,省得越多', step: 3, evidence: '只重算受影响格、其余 g 复用(增量)' }),
        distractors: () => ['用了更快的优先队列', '不需要启发式函数', '把地图压缩了'],
      },
      {
        id: 'ds_grhs', label: 'g 和 rhs 是什么',
        ask: 'D* Lite 里 g(s) 和 rhs(s) 分别是什么?', kind: 'choice',
        compute: () => ({ answer: 'g(s)=目前已知的从起点到 s 的最优代价;rhs(s)=一步前瞻=min over 邻居(g(邻居)+边权)(起点 rhs=0)。rhs 是"根据邻居现在的 g,我应该是多少"。g=rhs 时该格局部一致(信息最新)', step: 2, evidence: 'g=已知最优代价、rhs=一步前瞻、g=rhs 一致' }),
        distractors: () => ['g 是启发式、rhs 是真实代价', 'g 是行、rhs 是列', '都是随机初值'],
      },
      {
        id: 'ds_consistent', label: '局部一致与不一致',
        ask: '"局部一致"是什么?边权变化时会发生什么?', kind: 'choice',
        compute: () => ({ answer: '局部一致 = g(s)=rhs(s)(该格信息最新)。某条边权重变了(冒出障碍),紧挨的格子发现 g≠rhs(不一致、信息过时)→进优先队列;算法只处理不一致的格、让它们重新一致,涟漪只往受影响下游传', step: 3, evidence: 'g=rhs 一致;边权变→受影响格不一致→进队列' }),
        distractors: () => ['一致就是所有格 g 都相等', '边权变要把所有格清零重来', '不一致的格直接删掉'],
      },
      {
        id: 'ds_use', label: 'D* Lite 用在哪',
        ask: 'D* Lite 典型用在什么场景?', kind: 'choice',
        compute: () => ({ answer: '机器人在部分已知/动态的地图里导航:边走边用传感器发现新障碍(接 SLAM),用 D* Lite 每步只局部修复计划、不必从头重规划,省巨量计算。火星车、送餐/扫地机器人、动态环境导航都用它(及 field D* 等变体)', step: 4, evidence: '动态/未知环境导航、边走边发现障碍' }),
        distractors: () => ['静态已知地图的一次性规划', '图像分类', '机械臂力控'],
      },
      {
        id: 'ds_vs_lpa', label: 'D* Lite 和 A* 的关系',
        ask: 'D* Lite 和 A* 是什么关系?', kind: 'choice',
        compute: () => ({ answer: 'D* Lite 是 A* 的增量式版本:同样可以用启发式 h 制导搜索(h=0 时退化成增量 Dijkstra),但它在地图变化时能复用上次的结果只做局部修复,而 A* 每次都从头搜。它建立在 LPA* 之上、再加起点会移动的补偿(km 项)', step: 4, evidence: 'A* 的增量版、可用 h 制导、复用旧结果局部修' }),
        distractors: () => ['和 A* 无关、是采样式的', 'D* Lite 不用代价、只看方向', 'A* 是 D* Lite 的特例、更强'],
      },
    ],
  },
  {
    id: 'moveit', title: 'MoveIt 2 · 机械臂运动规划框架', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'moveit' }, entities: [], streams: [] },
    facts: [
      {
        id: 'mi_what', label: 'MoveIt 是什么',
        ask: 'MoveIt 2 是什么?在机器人栈里处于什么位置?', kind: 'choice',
        compute: () => ({ answer: 'ROS 2 上机械臂(操作臂)运动规划的事实标准框架:给机器人模型+目标位姿,算出无碰撞、可执行的关节轨迹。中枢是 move_group 节点,把 规划场景/规划器/碰撞检测/运动学/轨迹时间参数化 串成一条流水线。它是"库层"、骑在运动规划算法之上', step: 0, evidence: 'ROS 2 机械臂运动规划框架、move_group 流水线' }),
        distractors: () => ['一个物理仿真器(像 MuJoCo/Gazebo)', '一个移动底盘的导航栈', '一个深度学习训练框架'],
      },
      {
        id: 'mi_planner', label: 'MoveIt 默认规划器',
        ask: 'MoveIt 默认用哪类规划器?底层库是什么?', kind: 'choice',
        compute: () => ({ answer: '默认接 OMPL(Open Motion Planning Library)里的采样式规划器,默认规划器是 RRT-Connect(双向长两棵树+贪心连接);OMPL 里还有 RRT、RRT*、PRM 等。MoveIt 也支持 CHOMP(优化式)、STOMP、Pilz(工业 LIN/PTP)', step: 0, evidence: 'OMPL、默认 RRT-Connect' }),
        distractors: () => ['自己写的 A* 栅格搜索', '深度强化学习策略', '只有一种固定规划器、不可换'],
      },
      {
        id: 'mi_collision', label: 'MoveIt 碰撞检测',
        ask: 'MoveIt 用什么做碰撞检测?背后是什么算法?', kind: 'choice',
        compute: () => ({ answer: '用 FCL(Flexible Collision Library)判机器人与环境/自身碰撞;底层就是 GJK 那类凸-凸碰撞检测(支撑函数 + Minkowski 差)。这正是实验室「GJK 碰撞检测」实验的原理', step: 0, evidence: 'FCL、底层 GJK 凸检测' }),
        distractors: () => ['逐像素比对摄像头图像', '训练一个神经网络判碰撞', '不做碰撞检测、靠人避让'],
      },
      {
        id: 'mi_notinvent', label: 'MoveIt 的定位',
        ask: 'MoveIt 和它内部的算法(RRT-Connect/GJK/CHOMP)是什么关系?', kind: 'choice',
        compute: () => ({ answer: 'MoveIt 不发明新算法,而是把这些经典算法工程化、拼成一条能用的规划流水线(库=用法、算法=原理)。所以学 MoveIt 之前先在实验里把 RRT-Connect/GJK/CHOMP/时间参数化的原理焊死,再回头看 MoveIt 就是"把它们拼起来"', step: 0, evidence: '库把经典算法工程化拼成系统、非发明新算法' }),
        distractors: () => ['MoveIt 发明了全新的规划算法', 'MoveIt 和这些算法无关', 'MoveIt 只是这些算法的文档'],
      },
      {
        id: 'mi_scope', label: 'MoveIt vs Nav2',
        ask: 'MoveIt 和 Nav2 分工是什么?MoveIt 有什么局限?', kind: 'choice',
        compute: () => ({ answer: 'MoveIt 管机械臂(操作臂)的运动规划;移动底盘的自主导航是 Nav2 的活。MoveIt 局限:学习曲线陡、配置繁琐(URDF/SRDF+一堆yaml)、和 ROS 强耦合、量级重、默认采样规划不最优要调参。许可 BSD-3-Clause、PickNik 维护', step: 0, evidence: 'MoveIt=机械臂、Nav2=移动导航;学习曲线陡/偏机械臂' }),
        distractors: () => ['MoveIt 既管机械臂又管移动导航、Nav2 是它的子模块', 'MoveIt 只能用于仿真、不能上真机', '两者完全一样、只是名字不同'],
      },
    ],
  },
  {
    id: 'ros2', title: 'ROS 2 · 机器人通信中间件', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'ros2' }, entities: [], streams: [] },
    facts: [
      {
        id: 'ros_what', label: 'ROS 2 是什么',
        ask: 'ROS 2 是操作系统吗?它到底是什么?', kind: 'choice',
        compute: () => ({ answer: '不是真正的操作系统,而是机器人软件的通信中间件 + 工具生态:把系统拆成一堆节点(小进程),节点间靠话题(发布订阅)、服务(请求响应)、动作(长任务)通信,底层走 DDS。几乎所有机器人软件(MoveIt/Nav2/Autoware)都建在它上面', step: 0, evidence: '通信中间件+工具生态、非真OS、DDS' }),
        distractors: () => ['一个像 Ubuntu 那样的操作系统', '一个物理仿真器', '一个机器人硬件品牌'],
      },
      {
        id: 'ros_comm', label: 'ROS 2 的通信方式',
        ask: 'ROS 2 里节点之间怎么通信?', kind: 'choice',
        compute: () => ({ answer: '三种:话题(topic)发布-订阅(多对多、解耦,如传感器流)、服务(service)请求-响应(短同步调用)、动作(action)带反馈可取消的长任务(如"导航到某点")。底层由 DDS 传输、带 QoS/多机/安全', step: 0, evidence: '话题pub/sub + 服务 + 动作,底层 DDS' }),
        distractors: () => ['只能通过共享内存', '全靠一个中心服务器转发(像 ROS 1 的 master)', '直接函数调用、不能跨进程'],
      },
      {
        id: 'ros_vs1', label: 'ROS 2 相比 ROS 1',
        ask: 'ROS 2 相比 ROS 1 主要改进了什么?', kind: 'choice',
        compute: () => ({ answer: '完全重写:用 DDS 替代中心 master(去单点、支持多机组网)、支持实时、生产级可靠、内置安全(SROS2)。但仍非硬实时——kHz 电机控制环还得下到 MCU / micro-ROS / RT 层。许可 Apache-2.0', step: 0, evidence: 'DDS去master+实时+多机+安全;仍非硬实时' }),
        distractors: () => ['只是换了个名字、没变化', 'ROS 2 变成了闭源商业软件', 'ROS 2 去掉了 Python 支持'],
      },
    ],
  },
  {
    id: 'pinocchio', title: 'Pinocchio · 刚体动力学库', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'pinocchio' }, entities: [], streams: [] },
    facts: [
      {
        id: 'pin_what', label: 'Pinocchio 是什么',
        ask: 'Pinocchio 库是干什么的?', kind: 'choice',
        compute: () => ({ answer: '刚体动力学算法的高性能实现:正/逆运动学、正/逆动力学(RNEA/ABA)、质量矩阵(CRBA)、雅可比,以及这些量的解析导数。是机器人动力学计算的"心脏",Crocoddyl/Stack-of-Tasks 等上层控制库都建在它上面。BSD-2 许可、INRIA 维护', step: 0, evidence: '刚体动力学算法库(RNEA/ABA/CRBA)+解析导数' }),
        distractors: () => ['一个运动规划框架', '一个深度学习库', '一个相机驱动'],
      },
      {
        id: 'pin_deriv', label: 'Pinocchio 的杀手锏',
        ask: 'Pinocchio 相比一般动力学计算,最突出的能力是什么?', kind: 'choice',
        compute: () => ({ answer: '它不仅算动力学量,还给出这些量对 q/q̇/τ 的解析导数(analytical derivatives)。MPC、最优控制、轨迹优化都要梯度,有了解析导数就又快又准,这是 Pinocchio 成为控制/优化底座的关键。加上模板+代码生成、速度极快', step: 0, evidence: '给解析导数(MPC/优化必需)、极快' }),
        distractors: () => ['自带图形界面', '内置强化学习训练', '能直接控制电机'],
      },
      {
        id: 'pin_cover', label: 'Pinocchio 实现的算法',
        ask: 'Pinocchio 内部实现的经典动力学算法有哪些?(对应实验室哪些实验)', kind: 'choice',
        compute: () => ({ answer: 'RNEA(递归牛顿-欧拉逆动力学)、ABA(Articulated-Body 正向动力学)、CRBA(Composite-Rigid-Body 质量矩阵)——正是实验室「刚体动力学」组里 rnea/dyneom/fwddyn 这些手推过的算法。库把它们工程化,原理在实验里', step: 0, evidence: 'RNEA/ABA/CRBA=刚体动力学实验的工程化' }),
        distractors: () => ['卷积和注意力', '快速傅里叶变换', 'A* 和 Dijkstra'],
      },
    ],
  },
  {
    id: 'lerobotlib', title: 'LeRobot · 端到端机器人学习库', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'lerobot' }, entities: [], streams: [] },
    facts: [
      {
        id: 'lr_what', label: 'LeRobot 是什么',
        ask: 'LeRobot 库是干什么的?', kind: 'choice',
        compute: () => ({ answer: 'Hugging Face 的端到端机器人学习库(以模仿学习为主):标准数据集格式(LeRobotDataset)、一批策略实现(ACT/Diffusion Policy/TDMPC/VLA)、低成本真机支持(SO-100/SO-101/ALOHA)。目标是把"采数据→训策略→上真机"降到人人能跑。Apache-2.0、PyTorch', step: 0, evidence: 'HF 端到端机器人学习库:数据+策略+真机' }),
        distractors: () => ['一个机器人仿真物理引擎', '一个 SLAM 建图库', '一个电机驱动固件'],
      },
      {
        id: 'lr_cover', label: 'LeRobot 内部机制',
        ask: 'LeRobot 内部用到的机制,对应实验室哪些实验?', kind: 'choice',
        compute: () => ({ answer: 'ACT(动作分块+时序集成)、delta_timestamps(时序窗口)、数据集归一化、主从遥操作采数据——正是实验室「具身学习/项目实战」里 actte/deltats/normstats/teleop 这些实验拆的机制。库是"用法"、实验是"原理"', step: 0, evidence: 'ACT/delta_timestamps/归一化/遥操作=具身学习实验' }),
        distractors: () => ['B+ 树和 LSM 树', 'TCP 拥塞控制', 'RSA 和 AES 加密'],
      },
      {
        id: 'lr_paradigm', label: 'LeRobot 的学习范式与局限',
        ask: 'LeRobot 主要走什么学习范式?有什么局限?', kind: 'choice',
        compute: () => ({ answer: '以模仿学习为主:靠人遥操作采示范数据、训策略克隆动作,所以数据质量决定上限;偏研究/入门,工业级鲁棒性/安全还要自己补,依赖也重(PyTorch 全家桶)。优势是低成本真机(SO-101)+ 开箱即用 + HF 生态共享', step: 0, evidence: '模仿学习为主、数据质量定上限、偏入门' }),
        distractors: () => ['纯强化学习、不需要任何数据', '只做仿真、上不了真机', '只支持百万美元级工业机器人'],
      },
    ],
  },
  {
    id: 'mujoco', title: 'MuJoCo · 接触物理引擎', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'mujoco' }, entities: [], streams: [] },
    facts: [
      { id: 'mj_what', label: 'MuJoCo 是什么', ask: 'MuJoCo 是什么?名字什么意思?', kind: 'choice', compute: () => ({ answer: 'MuJoCo=Multi-Joint dynamics with Contact,通用物理引擎,主打接触丰富的刚体动力学,广泛用于机器人/生物力学/机器学习。Google DeepMind 2022 开源(Apache-2.0)。是学界机器人控制/RL 的默认仿真器', step: 0, evidence: '接触丰富的通用物理引擎、DeepMind Apache-2.0' }), distractors: () => ['一个深度学习框架', '一个 SLAM 建图库', '一个机器人操作系统'] },
      { id: 'mj_contact', label: 'MuJoCo 的接触处理', ask: 'MuJoCo 在接触动力学上的特点是什么?', kind: 'choice', compute: () => ({ answer: '把接触建成凸优化问题(软/弹性接触),大步长也稳定、还能给一阶解析导数(利于最优控制/可微仿真)。这也是它比很多引擎更适合控制与 RL 的原因', step: 0, evidence: '接触当凸优化、大步长稳、给解析导数' }), distractors: () => ['完全刚性硬接触、不给导数', '不处理接触、只做自由飞行', '用神经网络预测接触'] },
      { id: 'mj_mjx', label: 'MJX 是什么', ask: 'MuJoCo 的 MJX 是干什么的?', kind: 'choice', compute: () => ({ answer: 'MJX 是 MuJoCo 的 JAX 版实现,能在 GPU/TPU 上大规模并行仿真(数千环境),把强化学习训练加速几个数量级。和 Brax 生态一起做大规模 RL', step: 0, evidence: 'JAX 版、GPU/TPU 并行、加速 RL' }), distractors: () => ['MuJoCo 的图形界面', 'MuJoCo 的机器人硬件', 'MuJoCo 的移动 App'] },
    ],
  },
  {
    id: 'isaaclab', title: 'Isaac Lab · GPU 机器人学习框架', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'isaaclab' }, entities: [], streams: [] },
    facts: [
      { id: 'il_what', label: 'Isaac Lab 是什么', ask: 'Isaac Lab 是什么?和 Isaac Sim 什么关系?', kind: 'choice', compute: () => ({ answer: 'NVIDIA 开源的机器人学习框架(BSD-3),建在 Isaac Sim(Omniverse 上的高保真/照片级仿真平台)之上,主打 GPU 大规模并行训机器人策略(RL/模仿/规划)、sim-to-real', step: 0, evidence: 'NVIDIA GPU 机器人学习框架、建在 Isaac Sim 上' }), distractors: () => ['一个独立于 GPU 的 CPU 仿真器', '一个点云处理库', 'NVIDIA 的操作系统'] },
      { id: 'il_vs_mujoco', label: 'Isaac Lab vs MuJoCo', ask: 'Isaac Lab 和 MuJoCo 各自强在哪?', kind: 'choice', compute: () => ({ answer: 'Isaac Lab 强在 GPU 大规模并行(数千环境)、照片级渲染 + 传感器仿真、sim-to-real 与产业生态;MuJoCo 强在接触动力学精度与学术评测、轻量。感知/规模选 Isaac、接触/算法评测选 MuJoCo', step: 0, evidence: 'Isaac=规模/逼真感知/sim2real、MuJoCo=接触精度/轻量' }), distractors: () => ['两者完全一样', 'MuJoCo 更逼真、Isaac 更轻量', 'Isaac Lab 不支持 GPU'] },
      { id: 'il_use', label: 'Isaac Lab 用在哪', ask: 'Isaac Lab 典型用途?', kind: 'choice', compute: () => ({ answer: '机器人基座模型/RL 策略的大规模训练、sim-to-real 迁移、复杂交互与感知任务;和 rl_games/RSL-RL、VLA 训练打通(如 GR00T 的仿真训练)。局限:强依赖 NVIDIA GPU/Omniverse、体量大', step: 0, evidence: '大规模 RL/基座模型训练、sim-to-real;依赖 NVIDIA GPU' }), distractors: () => ['给单片机写电机固件', '数据库查询优化', '网页前端开发'] },
    ],
  },
  {
    id: 'pcl', title: 'PCL · 点云处理库', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'pcl' }, entities: [], streams: [] },
    facts: [
      { id: 'pcl_what', label: 'PCL 是什么', ask: 'PCL(Point Cloud Library)是干什么的?', kind: 'choice', compute: () => ({ answer: '2D/3D 点云处理的老牌开源标准库(BSD-3):滤波(体素下采样/离群点)、特征(法线估计)、配准(ICP)、分割、曲面重建一整套,模块化、ROS 深度集成。几乎所有感知项目都用它', step: 0, evidence: '点云处理老牌标准库、滤波/特征/配准/分割' }), distractors: () => ['一个物理仿真器', '一个强化学习库', '一个电机驱动'] },
      { id: 'pcl_cover', label: 'PCL 对应的实验', ask: 'PCL 的哪些模块对应实验室「点云预处理」和「ICP」?', kind: 'choice', compute: () => ({ answer: '滤波模块的体素下采样、特征模块的法线估计(PCA)对应「点云预处理」实验;配准模块的 ICP(点到点/点到面等变体)对应「ICP 点云配准」实验。库是工程实现、实验是原理', step: 0, evidence: '体素下采样/法线估计↔点云预处理、ICP↔ICP 配准' }), distractors: () => ['卷积和注意力', 'TCP 拥塞控制', 'B+ 树索引'] },
      { id: 'pcl_limit', label: 'PCL 的局限', ask: 'PCL 有什么局限?', kind: 'choice', compute: () => ({ answer: 'C++ 为主、编译重、上手门槛高;偏经典几何算法,深度学习点云(如 PointNet)要另找;部分模块 API 老、维护慢。更现代/Python 友好可看 Open3D', step: 0, evidence: 'C++重/偏经典几何/API老;现代可看 Open3D' }), distractors: () => ['不能处理 3D 只能 2D', '闭源收费', '只能在 GPU 上跑'] },
    ],
  },
  {
    id: 'orbslam3', title: 'ORB-SLAM3 · 视觉惯性 SLAM', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'orbslam3' }, entities: [], streams: [] },
    facts: [
      { id: 'orb_what', label: 'ORB-SLAM3 是什么', ask: 'ORB-SLAM3 是什么?', kind: 'choice', compute: () => ({ answer: '精度标杆的开源视觉/视觉惯性 SLAM 库(GPL-3.0),支持单目/双目/RGB-D + IMU + 多地图。用 ORB 特征点做前端、光束平差做后端、词袋做回环', step: 0, evidence: '视觉/视觉惯性 SLAM、ORB 特征+BA+回环、GPL-3.0' }), distractors: () => ['一个物理仿真器', '一个点云滤波库', '一个电机控制固件'] },
      { id: 'orb_pipe', label: 'ORB-SLAM3 的流程', ask: 'ORB-SLAM3 前后端的核心步骤,对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: 'ORB 特征匹配→对极几何求相对运动(↔视觉里程计)→PnP 重定位(↔PnP)→光束平差优化位姿+地图点→回环检测闭合漂移(↔SLAM 回环校正)。正是我们感知实验里的那几步', step: 0, evidence: '对极几何↔VO、PnP↔重定位、回环↔SLAM 校正' }), distractors: () => ['卷积→池化→全连接', 'Clarke→Park→SVPWM', '生产者→队列→消费者'] },
      { id: 'orb_gpl', label: 'ORB-SLAM3 的许可注意', ask: '用 ORB-SLAM3 要注意什么许可问题?', kind: 'choice', compute: () => ({ answer: '它是 GPL-3.0,有传染性——把它链进闭源商业产品要非常小心(可能被要求开源)。研究/开源用没问题,商用要评估许可或找 BSD/Apache 的替代', step: 0, evidence: 'GPL-3.0 传染性、商业闭源慎用' }), distractors: () => ['MIT 随便用', '闭源收费软件', '公有领域无任何限制'] },
    ],
  },
  {
    id: 'ros2control', title: 'ros2_control · 实时控制框架', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'ros2control' }, entities: [], streams: [] },
    facts: [
      { id: 'rc_what', label: 'ros2_control 是什么', ask: 'ros2_control 是干什么的?', kind: 'choice', compute: () => ({ answer: 'ROS 2 的实时控制框架(Apache-2.0):把硬件(真机/仿真)抽象成统一接口,控制器管理器在实时循环里加载/切换控制器(关节轨迹/PID/力控),把上层规划的轨迹执行到底层电机。是"规划→执行"的标准中间层', step: 0, evidence: '硬件抽象+控制器管理器、规划→执行中间层' }), distractors: () => ['一个运动规划算法', '一个 SLAM 库', '一个仿真渲染器'] },
      { id: 'rc_cover', label: 'ros2_control 的控制器', ask: 'ros2_control 里的控制器对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: 'PID 控制器↔「PID 控制」、力控/导纳控制器↔「阻抗/力控」、关节轨迹控制器(插值下发)↔「轨迹规划/梯形速度曲线」。它把 MoveIt 出的轨迹执行到硬件', step: 0, evidence: 'PID/力控/关节轨迹控制器↔对应控制实验' }), distractors: () => ['A* 和 Dijkstra', 'RSA 和 AES', 'BPE 和分词'] },
      { id: 'rc_pos', label: 'ros2_control 的位置', ask: 'ros2_control 在机器人软件栈里处于什么位置?', kind: 'choice', compute: () => ({ answer: '在"规划"和"电机"之间:上接 MoveIt/Nav2 等规划出的轨迹/命令,下接硬件接口写到电机;sim 与真机用同一套控制器。再往下的电流环是 SimpleFOC 那类', step: 0, evidence: '规划与电机之间、sim/真机通用、下接电流环' }), distractors: () => ['最上层的任务规划', '最底层的电流环 PWM', '和控制无关的可视化'] },
    ],
  },
  {
    id: 'nav2', title: 'Nav2 · 移动机器人导航栈', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'nav2' }, entities: [], streams: [] },
    facts: [
      { id: 'nav_what', label: 'Nav2 是什么', ask: 'Nav2 是什么?和 MoveIt 分工?', kind: 'choice', compute: () => ({ answer: 'ROS 2 移动机器人自主导航标准栈(Apache-2.0):行为树编排 + 代价图 + 全局规划器(NavFn/Smac/Theta*) + 局部控制器(DWB/MPPI) + 恢复行为。MoveIt 管机械臂、Nav2 管移动底盘', step: 0, evidence: '移动导航栈、行为树+代价图+规划+控制;MoveIt 管臂' }), distractors: () => ['管机械臂运动规划(那是 MoveIt)', '一个物理引擎', '一个电机驱动'] },
      { id: 'nav_cover', label: 'Nav2 对应的实验', ask: 'Nav2 的哪些组件对应实验室的规划实验?', kind: 'choice', compute: () => ({ answer: 'Smac 混合 A* 规划器用 Reeds-Shepp/Dubins 处理车式非完整约束↔「Dubins 曲线」;代价图膨胀层=障碍斥力↔「人工势场法」;MPPI 局部控制↔「MPC」;地图变化全局重规划↔「D* Lite」', step: 0, evidence: 'Smac↔Dubins、膨胀层↔势场、MPPI↔MPC、重规划↔D*Lite' }), distractors: () => ['卷积/注意力/Transformer', 'ICP/点云/SLAM', 'RSA/AES/HMAC'] },
      { id: 'nav_limit', label: 'Nav2 的局限', ask: 'Nav2 有什么局限?', kind: 'choice', compute: () => ({ answer: '配置庞大(一堆 yaml + 行为树)、调参门槛高;偏 2D/2.5D 平面导航(3D/腿足要另做);依赖定位(AMCL/SLAM);动态密集环境仍具挑战', step: 0, evidence: '配置庞大调参难、偏 2D、依赖定位' }), distractors: () => ['只能仿真上不了真机', '不支持避障', '闭源收费'] },
    ],
  },
  {
    id: 'openvla', title: 'OpenVLA · 视觉-语言-动作基座模型', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'openvla' }, entities: [], streams: [] },
    facts: [
      { id: 'ov_what', label: 'OpenVLA 是什么', ask: 'OpenVLA 是什么?', kind: 'choice', compute: () => ({ answer: '开源视觉-语言-动作(VLA)基座模型(MIT,7B):输入相机图 + 语言指令,直接输出机器人动作。视觉用 DINOv2+SigLIP、语言用 Llama 2,在 Open X-Embodiment 97 万条真机演示上训练', step: 0, evidence: '开源 VLA 基座(7B)、图+指令→动作' }), distractors: () => ['一个物理仿真器', '一个 SLAM 库', '一个电机控制库'] },
      { id: 'ov_action', label: 'VLA 怎么出动作', ask: 'OpenVLA 是怎么把"图+指令"变成动作的?', kind: 'choice', compute: () => ({ answer: '把连续动作离散化成 token,由语言模型自回归生成(和 ACT 的动作分块是同一思路)。这样能复用大语言模型的架构与预训练能力。局限:离散化有精度/频率取舍', step: 0, evidence: '动作离散成 token 自回归生成(似 ACT)' }), distractors: () => ['直接解析求逆运动学', '查表匹配预设动作', '随机采样动作'] },
      { id: 'ov_deploy', label: 'OpenVLA 上真机', ask: 'OpenVLA 这类 VLA 上真机有什么挑战?怎么落地?', kind: 'choice', compute: () => ({ answer: '7B 模型推理算力高、实时性要靠 OFT/FAST 等加速;还要解决控制频率、安全、标定。落地常配 LeRobot 接到低成本真机;π0/RDT/GR00T 是同类', step: 0, evidence: '算力高要加速、配 LeRobot 上真机' }), distractors: () => ['无需任何数据即可零成本部署', '只能在仿真里跑', '不需要相机'] },
    ],
  },
  {
    id: 'simplefoc', title: 'SimpleFOC · 无刷电机磁场定向控制', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'simplefoc' }, entities: [], streams: [] },
    facts: [
      { id: 'sf_what', label: 'SimpleFOC 是什么', ask: 'SimpleFOC 是干什么的?', kind: 'choice', compute: () => ({ answer: '最亲民的开源磁场定向控制(FOC)库(MIT,Arduino/PlatformIO),给无刷(BLDC)/步进电机做平滑的力矩/速度/位置控制,把 Clarke/Park/SVPWM/电流环封成几行代码。是机器人关节驱动最底层一环', step: 0, evidence: 'Arduino FOC 库、BLDC/步进力矩/速度/位置控制' }), distractors: () => ['一个运动规划框架', '一个 SLAM 库', '一个深度学习库'] },
      { id: 'sf_cover', label: 'SimpleFOC 对应的实验', ask: 'SimpleFOC 内部算法对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: 'FOC 电流环(Clarke→Park→两个 PI→逆变换+SVPWM)↔「FOC 磁场定向控制」实验;级联位置→速度→电流三环↔「PID 控制」。稚晖君 Dummy-Robot 的 Ctrl-FOC-Lite 就基于 SimpleFOC', step: 0, evidence: 'FOC 电流环↔FOC 实验、级联环↔PID' }), distractors: () => ['A*/Dijkstra 寻路', 'ICP 点云配准', '注意力机制'] },
      { id: 'sf_limit', label: 'SimpleFOC 的定位', ask: 'SimpleFOC 适合什么场景?不适合什么?', kind: 'choice', compute: () => ({ answer: '适合爱好者/创客/教育/中小功率(DIY 机械臂、云台、力反馈);不是工业伺服级,Arduino 生态算力/实时有限、高转速吃紧、高性能要搭好硬件(电流采样/驱动)', step: 0, evidence: '爱好者/中小功率;非工业伺服级、算力实时有限' }), distractors: () => ['大规模工业伺服首选', '只能控直流有刷电机', '不需要任何传感器'] },
    ],
  },
  {
    id: 'pytorch', title: 'PyTorch · 深度学习地基', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'pytorch' }, entities: [], streams: [] },
    facts: [
      { id: 'pt_what', label: 'PyTorch 是什么', ask: 'PyTorch 是什么?为什么大模型都用它?', kind: 'choice', compute: () => ({ answer: '深度学习事实标准框架(BSD-3):张量(GPU 加速)+自动求导(autograd)+动态计算图+nn 模块。手推的前向传播/注意力写成代码就是几行 PyTorch;大模型训练/推理栈(Transformers/vLLM/DeepSpeed)全建在它上', step: 0, evidence: '张量+自动求导+动态图、大模型代码底座' }), distractors: () => ['一个推理服务引擎', '一个向量数据库', '一个操作系统'] },
      { id: 'pt_autograd', label: 'autograd 是什么', ask: 'PyTorch 的自动求导(autograd)在做什么?', kind: 'choice', compute: () => ({ answer: '动态记录前向计算构成的计算图,反向传播时自动按链式法则算出每个参数的梯度——你只写前向,梯度自动来。这是训练神经网络的核心便利', step: 0, evidence: '记录计算图、反向自动求梯度' }), distractors: () => ['自动下载模型', '自动量化权重', '自动分配 GPU'] },
      { id: 'pt_pos', label: 'PyTorch 的定位', ask: 'PyTorch 和 vLLM/DeepSpeed 是什么关系?', kind: 'choice', compute: () => ({ answer: 'PyTorch 是通用底座(写模型/训练/推理的语言);vLLM 是建在它上的高吞吐推理服务、DeepSpeed 是建在它上的训练优化。要开箱的推理服务/大规模并行训练,要在 PyTorch 之上再叠专用库', step: 0, evidence: '通用底座、vLLM/DeepSpeed 建其上' }), distractors: () => ['PyTorch 是 vLLM 的替代品', 'PyTorch 只能推理不能训练', 'PyTorch 只能跑 CPU'] },
    ],
  },
  {
    id: 'transformers', title: 'HF Transformers · 模型库', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'transformers' }, entities: [], streams: [] },
    facts: [
      { id: 'tf_what', label: 'Transformers 是什么', ask: 'Hugging Face Transformers 是干什么的?', kind: 'choice', compute: () => ({ answer: '模型库(Apache-2.0):把几十万预训练模型(GPT/LLaMA/Qwen/BERT)统一成一套 API,from_pretrained 几行加载/推理/微调;配 Tokenizers(BPE 分词)、PEFT(LoRA)、TRL(对齐)、Datasets。是"用大模型"的门户', step: 0, evidence: '几十万模型统一 API、from_pretrained' }), distractors: () => ['一个物理仿真器', '一个推理编译器', '一个向量库'] },
      { id: 'tf_cover', label: 'Transformers 对应的实验', ask: 'Transformers 里现成的模块对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: '多头注意力/RoPE/RMSNorm(架构)、BPE(分词 Tokenizers)、top-k/top-p/温度采样与束搜索(生成)——正是实验室 Transformer 原理/大模型算法里那些实验。库是现成模块、实验是原理', step: 0, evidence: '多头/RoPE/RMSNorm/BPE/采样/束搜索' }), distractors: () => ['ICP 和点云配准', 'RRT 和 A*', 'FOC 电流环'] },
      { id: 'tf_limit', label: 'Transformers 的局限', ask: '用 Transformers 做生产推理有什么局限?', kind: 'choice', compute: () => ({ answer: '它的默认推理吞吐不如专用引擎——生产高并发要用 vLLM/SGLang/TGI/TensorRT-LLM;默认注意力也常要换 FlashAttention 加速。它强在"加载/微调/实验"、不是"高吞吐服务"', step: 0, evidence: '推理吞吐不如专用引擎、生产要 vLLM 等' }), distractors: () => ['不能加载开源模型', '不支持微调', '只能用 TensorFlow'] },
    ],
  },
  {
    id: 'vllm', title: 'vLLM · 高吞吐推理引擎', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'vllm' }, entities: [], streams: [] },
    facts: [
      { id: 'vl_paged', label: 'PagedAttention 是什么', ask: 'vLLM 的招牌 PagedAttention 解决什么问题?', kind: 'choice', compute: () => ({ answer: '把 KV 缓存像操作系统的虚拟内存一样分块管理:按需分配、跨请求共享(如共同前缀),几乎消除显存碎片、大幅提高吞吐和可容纳的并发数。这是 vLLM 高吞吐的核心', step: 0, evidence: 'KV 缓存仿 OS 分页、分块共享、消碎片' }), distractors: () => ['把模型权重分页到磁盘', '把注意力矩阵压缩成低秩', '用更小的模型代替'] },
      { id: 'vl_batch', label: '连续批处理', ask: 'vLLM 的连续批处理(continuous batching)是什么?', kind: 'choice', compute: () => ({ answer: '请求可以动态地进出同一个批次(谁生成完就退出、新请求随时加入),让 GPU 始终打满、不用等整批对齐,大幅提高吞吐。配 PagedAttention 一起把利用率拉满', step: 0, evidence: '请求动态进出同批、GPU 打满' }), distractors: () => ['一次只处理一个请求', '把所有请求攒够再一起算', '在 CPU 上批处理'] },
      { id: 'vl_pos', label: 'vLLM 的定位', ask: 'vLLM 适合什么?和 llama.cpp/TensorRT-LLM 怎么选?', kind: 'choice', compute: () => ({ answer: 'vLLM 面向 GPU 上的高吞吐服务、开箱 OpenAI 兼容、易用;端侧/CPU 本地跑用 llama.cpp;NVIDIA GPU 上追极致延迟用 TensorRT-LLM(但要编译、运维更复杂,vLLM 以 85% 性能换易用)', step: 0, evidence: 'GPU 高吞吐易用;端侧 llama.cpp、极致 TRT-LLM' }), distractors: () => ['vLLM 专门跑手机端', 'vLLM 只做训练不做推理', 'vLLM 只能跑一个模型'] },
    ],
  },
  {
    id: 'sglang', title: 'SGLang · 结构化推理引擎', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'sglang' }, entities: [], streams: [] },
    facts: [
      { id: 'sg_radix', label: 'RadixAttention 是什么', ask: 'SGLang 的核心创新 RadixAttention 是什么?', kind: 'choice', compute: () => ({ answer: '用基数树(radix tree)按 token 前缀组织 KV 缓存块,自动、细粒度地复用共享前缀的缓存。多轮对话/RAG/few-shot 里前缀大量重复时,命中率高、吞吐大幅提升', step: 0, evidence: '基数树按前缀复用 KV 缓存' }), distractors: () => ['一种新的注意力数学近似', '把 KV 缓存放到磁盘', '一种量化方法'] },
      { id: 'sg_vs', label: 'SGLang vs vLLM', ask: 'SGLang 相比 vLLM 强在什么场景?', kind: 'choice', compute: () => ({ answer: '前缀重复多的场景(多轮对话、RAG、few-shot)——RadixAttention 自动复用共享前缀,吞吐常胜过 vLLM(基准显示 H100 上更高、RAG 场景加速明显);还把结构化/受约束生成(JSON/正则)做成一等公民', step: 0, evidence: '前缀复用场景吞吐领先、结构化生成' }), distractors: () => ['它专门跑在 CPU 上', '它不需要 KV 缓存', '它只支持单轮对话'] },
      { id: 'sg_struct', label: 'SGLang 的结构化生成', ask: 'SGLang 除了快,还有什么特色?', kind: 'choice', compute: () => ({ answer: '结构化/受约束生成:前端 DSL 方便写多步流程、约束输出为 JSON/正则/固定选项,适合 Agent、工具调用、结构化抽取。是"服务引擎 + 结构化前端"二合一', step: 0, evidence: 'DSL + 受约束生成(JSON/正则)' }), distractors: () => ['自带图形界面', '自动训练模型', '内置向量数据库'] },
    ],
  },
  {
    id: 'tensorrtllm', title: 'TensorRT-LLM · NVIDIA 极致推理', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'tensorrtllm' }, entities: [], streams: [] },
    facts: [
      { id: 'tr_what', label: 'TensorRT-LLM 是什么', ask: 'TensorRT-LLM 是什么?怎么做到快?', kind: 'choice', compute: () => ({ answer: 'NVIDIA 的 LLM 推理库(Apache-2.0):用 Python API 定义模型、编译成 TensorRT 引擎,靠算子融合、量化(INT8/FP8/NVFP4)、内核自动调优在 NVIDIA GPU 上做极致优化,通常吞吐/延迟最优(比 vLLM 高约 10-20%)', step: 0, evidence: '编译成 TensorRT 引擎、算子融合+量化、NVIDIA 最快' }), distractors: () => ['靠更大的模型', '靠 CPU 多线程', '靠云端转发'] },
      { id: 'tr_cost', label: 'TensorRT-LLM 的代价', ask: 'TensorRT-LLM 追求极致性能的代价是什么?', kind: 'choice', compute: () => ({ answer: '要把模型编译成引擎(上手复杂、换模型/配置要重编)、强绑 NVIDIA 硬件(换硬件重来)、灵活性低于 PyTorch 原生。所以很多人用 vLLM——85% 的性能换来低得多的运维复杂度', step: 0, evidence: '要编译、绑 NVIDIA 硬件、灵活性低' }), distractors: () => ['完全没有代价', '只能跑很小的模型', '需要联网'] },
      { id: 'tr_cover', label: 'TensorRT-LLM 用到的技术', ask: 'TensorRT-LLM 内部用到实验室哪些概念?', kind: 'choice', compute: () => ({ answer: '量化(FP8/NVFP4)、张量并行/流水并行(多卡切模型)、in-flight(连续)批处理、FlashAttention 类注意力核、编译式推理引擎——都是「大模型推理」组里的实验', step: 0, evidence: '量化/张量并行/推理引擎/FlashAttention' }), distractors: () => ['卷积和池化', 'ICP 和 SLAM', 'RRT 和 A*'] },
    ],
  },
  {
    id: 'llamacpp', title: 'llama.cpp · 端侧本地推理', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'llamacpp' }, entities: [], streams: [] },
    facts: [
      { id: 'lc_what', label: 'llama.cpp 是什么', ask: 'llama.cpp 是干什么的?最大特点?', kind: 'choice', compute: () => ({ answer: '把大模型跑到普通设备(CPU/Apple Silicon/手机)的 C++ 框架(MIT):基于自研 ggml 张量库、模型用 GGUF 格式 + 量化(Q4_K_M 等)大幅压内存,不用 GPU 也能跑。是端侧/本地 LLM 的事实标准(Ollama 封装它)', step: 0, evidence: 'C++ 端侧推理、GGUF 量化、不用 GPU' }), distractors: () => ['一个 GPU 集群训练框架', '一个云端推理服务', '一个向量数据库'] },
      { id: 'lc_gguf', label: 'GGUF 和量化', ask: 'llama.cpp 靠什么在普通设备上跑大模型?', kind: 'choice', compute: () => ({ answer: 'GGUF 格式 + 量化:把权重从 FP16 压成 4/5/8-bit(如 Q4_K_M),显存/内存需求骤降,普通 CPU/笔记本/手机就能跑。量化是端侧推理的关键(有精度损失、低档更明显)', step: 0, evidence: 'GGUF+量化压权重、端侧可跑' }), distractors: () => ['把模型上传云端算', '用更多内存条', '换更大的模型'] },
      { id: 'lc_pos', label: 'llama.cpp 的定位', ask: 'llama.cpp 适合/不适合什么?', kind: 'choice', compute: () => ({ answer: '适合本地/端侧/离线/隐私场景(不用 GPU、可移植到手机树莓派);不适合高并发大吞吐服务(那用 vLLM/TensorRT-LLM)。Ollama/LM Studio 等桌面工具就封装它', step: 0, evidence: '端侧本地强、高并发服务弱' }), distractors: () => ['适合万卡训练', '适合高并发云服务', '只能跑在服务器 GPU'] },
    ],
  },
  {
    id: 'flashattn', title: 'FlashAttention · 注意力内核', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'flashattn' }, entities: [], streams: [] },
    facts: [
      { id: 'fa_what', label: 'FlashAttention 是什么', ask: 'FlashAttention 解决了注意力的什么问题?', kind: 'choice', compute: () => ({ answer: '标准注意力要把 N×N 的注意力矩阵写回显存、显存 O(N²) 且访存慢。FlashAttention 通过 IO 感知——把注意力分块在片上 SRAM 里算、不落地 N×N 矩阵 + 在线 softmax——做到又快又省显存(O(N)),且是精确注意力(不近似)', step: 0, evidence: 'IO 感知分块进 SRAM、显存 O(N)、精确' }), distractors: () => ['用低秩近似省算力', '把注意力换成卷积', '丢掉一部分注意力头'] },
      { id: 'fa_exact', label: 'FlashAttention 近似吗', ask: 'FlashAttention 是对注意力的近似吗?', kind: 'choice', compute: () => ({ answer: '不是近似——它和标准注意力数学上完全等价(精确),只是换了个又快又省显存的算法(分块+在线 softmax)。所以能直接替换标准注意力、不掉精度,这是它成为默认实现的原因', step: 0, evidence: '精确、和标准注意力等价、可直接替换' }), distractors: () => ['是近似、会掉精度', '只在推理时能用', '只对短序列有效'] },
      { id: 'fa_cover', label: 'FlashAttention 的意义', ask: 'FlashAttention 为什么对大模型很关键?对应哪些实验?', kind: 'choice', compute: () => ({ answer: '显存从 O(N²) 降到 O(N),让训练/推理更长上下文成为可能、还更快;是现代大模型默认注意力(Transformers/vLLM/TensorRT-LLM 都集成)。对应实验:FlashAttention、Flash-Decoding、缩放点积/掩码', step: 0, evidence: '省显存能训长上下文、默认实现;↔flash/flashdecode' }), distractors: () => ['只是省一点点无关紧要', '和上下文长度无关', '只用于 CV 不用于 LLM'] },
    ],
  },
  {
    id: 'megatron', title: 'Megatron-LM · 并行训练引擎', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'megatron' }, entities: [], streams: [] },
    facts: [
      { id: 'mg_what', label: 'Megatron-LM 是什么', ask: 'Megatron-LM 解决什么问题?', kind: 'choice', compute: () => ({ answer: 'NVIDIA 的超大模型并行训练引擎(Apache-2.0):当模型大到单卡放不下、连 ZeRO 也不够时,靠切开计算本身来训。Megatron-Core 提供五种并行:张量 TP/流水 PP/数据 DP/专家 EP/上下文 CP', step: 0, evidence: '并行训练引擎、TP/PP/DP/EP/CP 五种并行' }), distractors: () => ['一个推理服务引擎', '一个微调库', '一个向量数据库'] },
      { id: 'mg_par', label: '张量并行 vs 流水并行', ask: 'Megatron 的张量并行和流水并行有什么区别?', kind: 'choice', compute: () => ({ answer: '张量并行(TP):把同一层的大矩阵切到多卡、算完 all-reduce 合并(层内切);流水并行(PP):把不同层分到不同卡、用微批流水填满(层间切)。专家并行(EP)则把 MoE 的不同专家放不同卡。对应实验里的张量/流水/专家并行', step: 0, evidence: 'TP 层内切矩阵、PP 层间切、EP 专家分卡' }), distractors: () => ['两者完全一样', 'TP 切数据、PP 切模型参数量', 'TP 用于推理、PP 用于训练'] },
      { id: 'mg_vs', label: 'Megatron vs DeepSpeed', ask: 'Megatron-LM 和 DeepSpeed 分工?', kind: 'choice', compute: () => ({ answer: 'Megatron 强在切开计算的并行(张量/流水/专家并行,把集群榨满);DeepSpeed 强在 ZeRO(分片优化器状态省显存)+卸载+MoE。二者常结合(Megatron-DeepSpeed)训超大模型', step: 0, evidence: 'Megatron 切计算并行、DeepSpeed ZeRO 省显存、常结合' }), distractors: () => ['两者是竞品不能一起用', 'Megatron 做推理、DeepSpeed 做训练', 'DeepSpeed 是 Megatron 的子模块'] },
    ],
  },
  {
    id: 'deepspeed', title: 'DeepSpeed · 训练优化(ZeRO)', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'deepspeed' }, entities: [], streams: [] },
    facts: [
      { id: 'ds_zero', label: 'ZeRO 是什么', ask: 'DeepSpeed 的招牌 ZeRO 解决什么?', kind: 'choice', compute: () => ({ answer: '零冗余优化器:数据并行里每张卡本来都存一份完整的优化器状态/梯度/参数(冗余),ZeRO 把它们分片到多卡(ZeRO-1/2/3),消除冗余显存,让单卡放不下的大模型也能训。是"平民训大模型"的关键', step: 0, evidence: '分片优化器状态/梯度/参数、消冗余显存' }), distractors: () => ['一种新的注意力', '把模型量化到 0-bit', '一种采样策略'] },
      { id: 'ds_offload', label: 'ZeRO-Offload', ask: 'DeepSpeed 的 Offload/Infinity 是什么?', kind: 'choice', compute: () => ({ answer: '把优化器状态/参数等卸载到 CPU 内存甚至 NVMe 硬盘,让单卡也能训超大模型(用速度换容量);对应实验里的 KV/状态卸载思想。代价是带宽瓶颈、速度下降', step: 0, evidence: '卸载到 CPU/NVMe、以速度换容量' }), distractors: () => ['把模型上传云端', '删掉一半参数', '只训练一层'] },
      { id: 'ds_cover', label: 'DeepSpeed 对应的实验', ask: 'DeepSpeed 用到实验室哪些概念?', kind: 'choice', compute: () => ({ answer: 'MoE(混合专家)训练、KV/状态卸载、张量并行、集合通信(all-reduce/all-gather)——都是「大模型推理/算法」里的实验。它和 Megatron 结合(Megatron-DeepSpeed)训超大模型', step: 0, evidence: 'MoE/KV 卸载/张量并行/集合通信' }), distractors: () => ['ICP/点云/SLAM', 'Dubins/RRT/A*', 'FOC/PID'] },
    ],
  },
  {
    id: 'peft', title: 'PEFT(LoRA) · 参数高效微调', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'peft' }, entities: [], streams: [] },
    facts: [
      { id: 'pf_lora', label: 'LoRA 是什么', ask: 'LoRA(PEFT)是怎么做到高效微调的?', kind: 'choice', compute: () => ({ answer: '冻结大模型主体,只在权重旁边加一对低秩矩阵 A·B、只训这两个小矩阵(原权重不动)。要训的参数量骤降到千分之几,显存/成本大降,效果却接近全量微调', step: 0, evidence: '冻结主体、只训低秩 A·B、参数骤降' }), distractors: () => ['把整个模型重新训一遍', '把模型量化成 1-bit', '换更大的模型'] },
      { id: 'pf_qlora', label: 'QLoRA 是什么', ask: 'QLoRA 为什么能在消费级单卡微调大模型?', kind: 'choice', compute: () => ({ answer: '把基座模型量化成 4-bit(省显存)+ 在上面挂 LoRA(只训低秩小矩阵)。量化压住基座显存 + LoRA 压住可训参数,双管齐下,消费级单卡就能微调几十亿参数模型', step: 0, evidence: '4-bit 量化基座 + LoRA、消费级卡可微调' }), distractors: () => ['用云端 GPU 集群', '只微调最后一层', '把数据集变小'] },
      { id: 'pf_use', label: 'PEFT 的用途与局限', ask: 'PEFT/LoRA 适合什么?有什么局限?', kind: 'choice', compute: () => ({ answer: '适合领域/任务微调、一个基座挂多套 LoRA 按任务切换、低成本对齐(配 TRL);局限是冻结主体、极端任务不如全量微调,且仍依赖一个好的预训练基座、秩等超参要调', step: 0, evidence: '领域微调/多适配器切换;不如全量、依赖好基座' }), distractors: () => ['能从零训练一个大模型', '不需要任何基座', '效果一定超过全量微调'] },
    ],
  },
  {
    id: 'langgraph', title: 'LangGraph · Agent 编排', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'langgraph' }, entities: [], streams: [] },
    facts: [
      { id: 'lgg_what', label: 'LangGraph 是什么', ask: 'LangGraph 是干什么的?为什么用图?', kind: 'choice', compute: () => ({ answer: 'LangChain 出的 Agent 编排框架(MIT):把智能体流程写成有状态的图(节点=步骤/工具/模型、边=转移)。用图是因为 Agent 需要循环、分支、人审——线性链表达不了"想→调工具→观察→再想"的主循环、防死循环、子 Agent', step: 0, evidence: '把 Agent 写成有状态图、支持循环/分支/人审' }), distractors: () => ['一个推理引擎', '一个向量数据库', '一个训练框架'] },
      { id: 'lgg_cover', label: 'LangGraph 编排的东西', ask: 'LangGraph 编排的能力对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: 'Agent 主循环(想→行动→观察、防死循环)、工具调用、子 Agent 委派、规划(计划模式+Todo)、上下文压缩——正是「大模型项目实战」里那批 Agent harness 实验。库负责编排、实验讲原理', step: 0, evidence: 'Agent 主循环/工具调用/子Agent/规划/上下文压缩' }), distractors: () => ['卷积/池化/全连接', 'ICP/点云/SLAM', 'Clarke/Park/SVPWM'] },
      { id: 'lgg_why', label: '为什么不用线性链', ask: '为什么复杂 Agent 用 LangGraph 而不是线性的链?', kind: 'choice', compute: () => ({ answer: '复杂 Agent 要循环(反复想-行动)、分支(按结果走不同路)、人审(中途让人确认)、断点续跑——这些线性链表达不了。图能精确控制流程、可持久化、可观测,还能防死循环、加子 Agent', step: 0, evidence: '需循环/分支/人审/续跑,链表达不了' }), distractors: () => ['图一定比链快', '链不能调用模型', '图不需要写代码'] },
    ],
  },
  {
    id: 'llamaindex', title: 'LlamaIndex · RAG 框架', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'llamaindex' }, entities: [], streams: [] },
    facts: [
      { id: 'li_what', label: 'LlamaIndex 是什么', ask: 'LlamaIndex 是干什么的?RAG 是什么流程?', kind: 'choice', compute: () => ({ answer: '专注 RAG(检索增强生成)的框架(MIT):把私有文档切块→向量化→存进向量库→按问题检索 top-k→拼进提示词喂给大模型,让它基于你的数据回答而不是瞎编。提供数据连接器/索引/检索器/查询引擎一整套', step: 0, evidence: '切块→向量化→检索 top-k→拼 prompt→生成' }), distractors: () => ['一个推理引擎', '一个训练框架', '一个电机控制库'] },
      { id: 'li_why', label: 'RAG 为什么有用', ask: 'RAG(LlamaIndex)相比直接问大模型好在哪?', kind: 'choice', compute: () => ({ answer: '让模型基于检索到的你的真实数据回答,减少幻觉、能用私有/最新知识、还能给引用出处;不用重新训练模型就能"接上"外部知识。对应实验里的 RAG、检索打分', step: 0, evidence: '基于真实数据答、减幻觉、无需训练接外部知识' }), distractors: () => ['让模型跑得更快', '把模型变小', '不需要任何数据'] },
      { id: 'li_stack', label: 'LlamaIndex 和向量库', ask: 'LlamaIndex 通常和什么搭配?和 LangGraph 分工?', kind: 'choice', compute: () => ({ answer: '搭配向量库(FAISS/Milvus/Chroma/Qdrant)存检索向量;LlamaIndex 专注 RAG/检索,LangGraph 专注 Agent 流程编排——常一起用(检索 + Agent)。它俩和 LangChain 功能有重叠、按需选型', step: 0, evidence: '配向量库;RAG 归它、Agent 编排归 LangGraph' }), distractors: () => ['它自带 GPU 训练', '它替代 PyTorch', '它是一个操作系统'] },
    ],
  },
  {
    id: 'numpy', title: 'NumPy · 科学计算地基', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'numpy' }, entities: [], streams: [] },
    facts: [
      { id: 'np_what', label: 'NumPy 是什么', ask: 'NumPy 为什么是数据科学的地基?', kind: 'choice', compute: () => ({ answer: '核心是 ndarray(N 维数组、连续内存、类型统一)+向量化运算(把 for 循环下沉到 C/SIMD,比纯 Python 快几十上百倍),加广播/线代/随机数/FFT。pandas/SciPy/scikit-learn/PyTorch 全建在它(或它的数组接口)之上', step: 0, evidence: 'ndarray+向量化、生态全建其上' }), distractors: () => ['一个机器学习模型库', '一个可视化库', '一个数据库'] },
      { id: 'np_vec', label: '向量化为什么快', ask: 'NumPy 的向量化为什么比纯 Python 循环快?', kind: 'choice', compute: () => ({ answer: '把整块数组的运算下沉到编译好的 C/SIMD 代码一次算完,避免 Python 解释器逐元素循环的开销(还利用连续内存和缓存)。所以写 NumPy 要"整块数组运算"而不是 Python for 循环', step: 0, evidence: '整块运算下沉 C/SIMD、免解释器循环开销' }), distractors: () => ['因为用了 GPU', '因为多线程', '因为压缩了数据'] },
      { id: 'np_cover', label: 'NumPy 对应的实验', ask: 'NumPy 的数组运算对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: '矩阵乘、内存布局(行/列主序与步幅)、softmax(数值稳定)、条件数、低秩近似(SVD)——这些「机器学习基础」实验底层就是 NumPy 的数组/线代运算', step: 0, evidence: 'matmul/布局/softmax/条件数/低秩' }), distractors: () => ['RRT 和 A*', 'ICP 和 SLAM', 'FOC 电流环'] },
    ],
  },
  {
    id: 'pandas', title: 'pandas · 数据分析', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'pandas' }, entities: [], streams: [] },
    facts: [
      { id: 'pd_what', label: 'pandas 是什么', ask: 'pandas 是干什么的?核心数据结构?', kind: 'choice', compute: () => ({ answer: '结构化数据处理的行业标准:核心是 DataFrame(带行列标签的二维表),做读写(CSV/Parquet/SQL)、清洗、缺失值、分组聚合(groupby)、合并(merge)、时间序列。是 ML 前"数据整理"(约 80% 的活)的主力', step: 0, evidence: 'DataFrame、清洗/groupby/merge、数据整理' }), distractors: () => ['一个深度学习框架', '一个绘图库', '一个推理引擎'] },
      { id: 'pd_role', label: 'pandas 的角色', ask: 'pandas 在机器学习流程里处于什么位置?', kind: 'choice', compute: () => ({ answer: '在"原始数据"和"能喂模型的特征"之间的桥:清洗、合并、聚合出干净的特征表,再交给 scikit-learn/XGBoost 建模。做 ML 大部分时间其实花在 pandas 的数据整理上', step: 0, evidence: '原始数据→特征表的桥、数据整理主力' }), distractors: () => ['负责训练模型', '负责部署推理', '负责画图'] },
      { id: 'pd_limit', label: 'pandas 的局限', ask: 'pandas 处理大数据有什么局限?', kind: 'choice', compute: () => ({ answer: '单机内存内——数据大过内存就吃力;大表/链式操作也容易慢或吃内存。更大/更快看 Polars、Dask、Spark。它也不做建模(那是 scikit-learn)', step: 0, evidence: '单机内存内、大数据看 Polars/Dask' }), distractors: () => ['不能读 CSV', '只能处理数字不能处理文本', '必须联网'] },
    ],
  },
  {
    id: 'scipy', title: 'SciPy · 科学计算算法', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'scipy' }, entities: [], streams: [] },
    facts: [
      { id: 'sp_what', label: 'SciPy 是什么', ask: 'SciPy 提供什么?和 NumPy 什么关系?', kind: 'choice', compute: () => ({ answer: '建在 NumPy 之上的科学计算算法库:优化(minimize/最小二乘)、线代(SVD/特征/稀疏)、统计(分布/检验)、信号、插值、积分/ODE。NumPy 给数组、SciPy 给"算法"。很多 ML/统计方法的底层数值工具来自它', step: 0, evidence: '建在 NumPy 上、优化/线代/统计/信号算法' }), distractors: () => ['一个模型库', '一个数据库', 'NumPy 的替代品'] },
      { id: 'sp_cover', label: 'SciPy 对应的实验', ask: 'SciPy 的算法对应实验室哪些概念?', kind: 'choice', compute: () => ({ answer: '线代里的 SVD 对应条件数/低秩、optimize 的最小化对应梯度下降(训练底层)、stats 的分布对应中心极限定理/大数定律。它是这些统计/ML 方法的数值底座', step: 0, evidence: 'SVD↔条件数/低秩、优化↔梯度下降、分布↔CLT/LLN' }), distractors: () => ['卷积和池化', 'RRT 和 Dubins', 'FOC 和 PID'] },
      { id: 'sp_pos', label: 'SciPy vs scikit-learn', ask: 'SciPy 和 scikit-learn 分工?', kind: 'choice', compute: () => ({ answer: 'SciPy 是底层数值算法(优化/线代/统计),scikit-learn 建在它和 NumPy 之上、提供开箱的机器学习模型(fit/predict)。要"数值算法"用 SciPy、要"直接建模"用 scikit-learn', step: 0, evidence: 'SciPy 底层数值、sklearn 开箱 ML' }), distractors: () => ['两者完全一样', 'SciPy 做深度学习', 'scikit-learn 是 SciPy 的底层'] },
    ],
  },
  {
    id: 'matplotlib', title: 'Matplotlib · 数据可视化', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'matplotlib' }, entities: [], streams: [] },
    facts: [
      { id: 'mpl_what', label: 'Matplotlib 是什么', ask: 'Matplotlib 是干什么的?', kind: 'choice', compute: () => ({ answer: 'Python 数据可视化的老牌主力:折线/散点/柱状/热图/等高线/3D 都能画,pyplot 上手快又能控到每个元素。做 ML 时画损失曲线、决策边界、特征分布、混淆矩阵都靠它——把"数字"变成"看得懂"', step: 0, evidence: 'Python 可视化主力、pyplot、什么图都能画' }), distractors: () => ['一个机器学习库', '一个数据处理库', '一个推理引擎'] },
      { id: 'mpl_eco', label: 'Matplotlib 的生态', ask: 'seaborn/Plotly 和 Matplotlib 什么关系?', kind: 'choice', compute: () => ({ answer: 'seaborn 建在 Matplotlib 之上、做统计图更省事(几行出漂亮图);Plotly 补交互(能缩放/悬停)。Matplotlib 是最通用可控的底层,pandas .plot 也基于它', step: 0, evidence: 'seaborn 建其上、Plotly 补交互、pandas .plot 基于它' }), distractors: () => ['它们是 Matplotlib 的竞品完全无关', 'seaborn 是深度学习库', 'Plotly 是数据库'] },
      { id: 'mpl_limit', label: 'Matplotlib 的取舍', ask: 'Matplotlib 有什么取舍?', kind: 'choice', compute: () => ({ answer: '最通用、可控到出版级,但默认样式一般、精修代码啰嗦;交互弱(要交互看 Plotly/Bokeh);有 pyplot 和面向对象两套 API 易混;大量数据点渲染慢', step: 0, evidence: '通用可控但精修啰嗦、交互弱、两套 API' }), distractors: () => ['不能导出图片', '只能画折线图', '必须用 GPU'] },
    ],
  },
  {
    id: 'sklearn', title: 'scikit-learn · 经典机器学习', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'sklearn' }, entities: [], streams: [] },
    facts: [
      { id: 'sk_what', label: 'scikit-learn 是什么', ask: 'scikit-learn 是干什么的?', kind: 'choice', compute: () => ({ answer: '经典(非深度)机器学习的事实标准库:把几十种算法(KNN/K-Means/PCA/SVM/决策树/逻辑·线性回归/随机森林/GBDT)统一成 fit/predict/transform API,配特征处理、交叉验证、网格搜索、Pipeline。结构化数据建模/快速基线/教学首选', step: 0, evidence: '经典 ML 事实标准、统一 API+Pipeline' }), distractors: () => ['一个深度学习框架', '一个数据可视化库', '一个推理引擎'] },
      { id: 'sk_api', label: '统一 API 与 Pipeline', ask: 'scikit-learn 的 fit/predict 统一 API 和 Pipeline 有什么好处?', kind: 'choice', compute: () => ({ answer: '所有模型都是 fit(训练)/predict(预测)/transform(变换)同一套,换算法只改一行;Pipeline 把预处理+模型串成一条流水线,交叉验证时能防"数据泄露"(预处理只在训练折上 fit)。规范又不易出错', step: 0, evidence: '统一 API 换算法改一行、Pipeline 防数据泄露' }), distractors: () => ['能自动收集数据', '能自动部署到生产', '能自动画图'] },
      { id: 'sk_cover', label: 'scikit-learn 对应的实验', ask: 'scikit-learn 的算法对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: 'KNN/SVM/逻辑回归/线性回归/决策树(分类回归)、K-Means/PCA(聚类降维)、GBDT(集成)——正是「机器学习算法」组那批实验。库是现成算法、实验讲原理', step: 0, evidence: 'KNN/SVM/逻辑·线性回归/决策树/K-Means/PCA/GBDT' }), distractors: () => ['卷积/池化/RNN', 'ICP/SLAM/点云', 'RRT/A*/Dubins'] },
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
      { id: 'jx_transform', label: 'grad/jit/vmap', ask: 'JAX 的 grad、jit、vmap 分别做什么?', kind: 'choice', compute: () => ({ answer: 'grad:对任意函数自动求导(还能高阶);jit:用 XLA 把函数编译成融合内核、GPU/TPU 提速;vmap:自动把函数向量化成批处理。它们是可组合的函数变换,函数式风格', step: 0, evidence: 'grad 求导/jit 编译/vmap 批处理、可组合变换' }), distractors: () => ['分别是三个模型', '分别是三种数据库', '分别是三个可视化函数'] },
      { id: 'jx_cover', label: 'JAX 对应的实验/用途', ask: 'JAX 对应实验室哪些概念?典型用在哪?', kind: 'choice', compute: () => ({ answer: '梯度下降、反向传播、矩阵运算——写 JAX 就是"可微的 NumPy"。前沿 DL/研究(Flax)、大规模 RL 仿真(Brax、MuJoCo MJX)、科学计算、TPU 训练大量用它', step: 0, evidence: '梯度下降/反向传播/矩阵;前沿 DL/RL 仿真' }), distractors: () => ['ICP/SLAM', 'B+树/LSM', 'RSA/AES'] },
    ],
  },
  {
    id: 'opencv', title: 'OpenCV · 计算机视觉', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'opencv' }, entities: [], streams: [] },
    facts: [
      { id: 'cv_what', label: 'OpenCV 是什么', ask: 'OpenCV 是干什么的?', kind: 'choice', compute: () => ({ answer: '计算机视觉的老牌全家桶:图像读写/滤波卷积、特征(ORB/SIFT)、几何变换、相机标定(solvePnP)、光流、立体视觉、传统目标检测,还能跑 DNN 推理。既是 CV 经典算法库,也是机器人/图像项目的地基', step: 0, evidence: 'CV 全家桶:图像处理/特征/标定/立体/DNN' }), distractors: () => ['一个深度学习训练框架', '一个数据库', '一个绘图库'] },
      { id: 'cv_cover', label: 'OpenCV 对应的实验', ask: 'OpenCV 对应实验室哪些实验?和机器人感知什么关系?', kind: 'choice', compute: () => ({ answer: '卷积/滤波(图像卷积)、池化(图像金字塔/降采样)对应 DL 里的卷积/池化实验;它的相机标定/立体视觉/位姿又和「机器人感知」轨的针孔/双目/点云/PnP 相通', step: 0, evidence: '卷积/池化;和针孔/双目/PnP 相通' }), distractors: () => ['B+树/LSM', 'RRT/A*', 'FOC/PID'] },
      { id: 'cv_limit', label: 'OpenCV 的取舍', ask: 'OpenCV 的取舍是什么?', kind: 'choice', compute: () => ({ answer: 'CV 算法最全、C++ 核心快 Python 好用、跨平台;但深度学习训练不归它(那是 PyTorch,它只能跑现成 DNN),API 庞杂、旧版 BSD 新版(4.5+)才 Apache-2.0', step: 0, evidence: 'CV 算法全但不训 DL、API 庞杂、4.5+ 才 Apache' }), distractors: () => ['不能读图片', '只支持 Python', '必须联网'] },
    ],
  },
  {
    id: 'statsmodels', title: 'statsmodels · 统计建模与推断', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'statsmodels' }, entities: [], streams: [] },
    facts: [
      { id: 'sm_what', label: 'statsmodels 是什么', ask: 'statsmodels 和 scikit-learn 有什么不同?', kind: 'choice', compute: () => ({ answer: 'statsmodels 专注统计建模与"推断"(要 p 值、置信区间、显著性、诊断报告),scikit-learn 专注"预测"(要准)。statsmodels 做回归/时间序列/假设检验时给完整统计报告——回答"这个变量显著吗、关系可信吗"', step: 0, evidence: '推断(p 值/置信区间)vs 预测(准)' }), distractors: () => ['两者完全一样', 'statsmodels 做深度学习', 'statsmodels 是画图库'] },
      { id: 'sm_cover', label: 'statsmodels 对应的实验', ask: 'statsmodels 对应实验室哪些概念?', kind: 'choice', compute: () => ({ answer: '线性回归、逻辑回归(带显著性推断)、以及中心极限定理、大数定律(统计根基)——「机器学习算法/概率统计」里的实验。它把这些做成带统计报告的建模', step: 0, evidence: '线性/逻辑回归、中心极限、大数定律' }), distractors: () => ['卷积和池化', 'ICP 和点云', 'PagedAttention'] },
      { id: 'sm_use', label: 'statsmodels 用在哪', ask: 'statsmodels 典型用在什么场景?', kind: 'choice', compute: () => ({ answer: '计量经济/社科的统计分析、时间序列预测(ARIMA)、A/B 实验的显著性检验——要"解释"而非只"预测"的场景。大规模纯预测则用 sklearn/XGBoost', step: 0, evidence: '计量/时间序列/AB 检验,要解释' }), distractors: () => ['图像识别', '大模型推理', '机器人控制'] },
    ],
  },
  {
    id: 'networkx', title: 'NetworkX · 图/网络分析', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'networkx' }, entities: [], streams: [] },
    facts: [
      { id: 'nx_what', label: 'NetworkX 是什么', ask: 'NetworkX 是干什么的?', kind: 'choice', compute: () => ({ answer: 'Python 图/网络分析库:建图(有向/无向/带权)+跑经典图算法——最短路(Dijkstra/A*/Bellman-Ford)、PageRank、连通分量/并查集、最小生成树、最大流、中心性、社区发现。纯 Python 上手极快、适合建模/分析/教学', step: 0, evidence: '图分析库、最短路/PageRank/连通/中心性' }), distractors: () => ['一个神经网络框架', '一个数据库', '一个绘图库'] },
      { id: 'nx_cover', label: 'NetworkX 对应的实验', ask: 'NetworkX 对应实验室哪些经典算法实验?', kind: 'choice', compute: () => ({ answer: 'PageRank(网页排名)、A* 寻路(带启发的最短路)、并查集(连通分量)——正是「经典算法」组里的实验。库里都是现成一行调用、原理在实验里', step: 0, evidence: 'PageRank/A*/并查集' }), distractors: () => ['卷积/RNN/注意力', 'FOC/PID', 'KV Cache/量化'] },
      { id: 'nx_limit', label: 'NetworkX 的取舍', ask: 'NetworkX 处理超大图有什么局限?', kind: 'choice', compute: () => ({ answer: '纯 Python、图很大(百万边以上)会慢、内存内;超大图看 igraph/graph-tool(C 核)或 GPU 图库。它也不做图神经网络(那是 PyG/DGL)。胜在灵活、算法全、上手快', step: 0, evidence: '纯 Python 大图慢、超大看 igraph;不做 GNN' }), distractors: () => ['不能建有向图', '只能算最短路', '必须用 GPU'] },
    ],
  },
  {
    id: 'gensim', title: 'gensim · 主题模型与词向量', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'gensim' }, entities: [], streams: [] },
    facts: [
      { id: 'gs_what', label: 'gensim 是什么', ask: 'gensim 是干什么的?', kind: 'choice', compute: () => ({ answer: '主题建模与词向量的经典库:Word2Vec/FastText/Doc2Vec 词/文档向量、LDA/LSI 主题模型、TF-IDF、相似度检索,主打无监督从大规模文本挖语义、能流式处理大语料。Word2Vec 的著名实现就出自这里', step: 0, evidence: '主题模型+词向量、无监督挖语义、word2vec 原产地' }), distractors: () => ['一个深度学习训练框架', '一个数据库', '一个绘图库'] },
      { id: 'gs_cover', label: 'gensim 对应的实验', ask: 'gensim 对应实验室哪个实验?', kind: 'choice', compute: () => ({ answer: '词向量(Word2Vec)——它是 word2vec 的原产地,「国王−男人+女人≈王后」那个著名例子就来自这类词向量。「深度学习算法」里的词向量实验讲的就是它的原理', step: 0, evidence: '词向量 Word2Vec、国王−男人+女人≈王后' }), distractors: () => ['ICP 点云配准', 'RRT 运动规划', 'FOC 电流环'] },
      { id: 'gs_license', label: 'gensim 的许可注意', ask: '用 gensim 要注意什么许可问题?', kind: 'choice', compute: () => ({ answer: '它是 LGPL-2.1(弱传染)——比 NumPy/scikit-learn 的 BSD 严:动态链接调用一般 OK,但静态链接或改动它的源码再分发,可能要求把那部分也按 LGPL 开源。商用要评估。这正是"库要核许可"的价值', step: 0, evidence: 'LGPL-2.1 弱传染、动态调用OK/改源要开源' }), distractors: () => ['MIT 随便用', '公有领域无限制', '闭源收费软件'] },
    ],
  },
  {
    id: 'linux', title: 'Linux 内核 · 操作系统内核', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'linux' }, entities: [], streams: [] },
    facts: [
      { id: 'lx_what', label: 'Linux 内核是什么', ask: 'Linux 内核负责哪些核心工作?', kind: 'choice', compute: () => ({ answer: '操作系统内核(GPL-2.0):进程调度、虚拟内存(分页/缺页/页替换)、文件系统(inode/位图/日志)、并发原语(信号量/锁/死锁避免)、网络栈。你「操作系统」组实验讲的原理在它里都有工业级真实现', step: 0, evidence: '调度/虚拟内存/文件系统/并发/网络栈' }), distractors: () => ['一个编译器', '一个数据库', '一个网页服务器'] },
      { id: 'lx_cover', label: 'Linux 对应的实验', ask: 'Linux 内核对应实验室「操作系统」组哪些实验?', kind: 'choice', compute: () => ({ answer: '进程调度、缺页/页替换、虚拟内存、inode/位图/分区(文件系统)、磁盘寻道、信号量、银行家(死锁避免)——OS 组几乎全覆盖。库是工业实现、实验讲原理', step: 0, evidence: '调度/缺页/inode/信号量/银行家等 OS 实验' }), distractors: () => ['卷积和注意力', 'RRT 和 Dubins', 'B 树和哈希'] },
      { id: 'lx_gpl', label: 'Linux 的许可', ask: 'Linux 内核用什么许可?意味着什么?', kind: 'choice', compute: () => ({ answer: 'GPL-2.0(only,有传染性):改动内核代码并分发,要以 GPL 开源那部分。用户空间程序通过系统调用用内核不受影响(有 syscall 例外)。这也是内核驱动开源生态的原因', step: 0, evidence: 'GPL-2.0 传染;改内核分发要开源' }), distractors: () => ['MIT 随便用', '闭源商业软件', '公有领域'] },
    ],
  },
  {
    id: 'gcc', title: 'GCC · GNU 编译器套件', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'gcc' }, entities: [], streams: [] },
    facts: [
      { id: 'gc_steps', label: 'GCC 编译四步', ask: 'GCC 把源码变成可执行程序经过哪几步?', kind: 'choice', compute: () => ({ answer: '预处理(展开宏/头文件)→编译(语法分析+优化+生成汇编)→汇编(汇编→机器码目标文件)→链接(合并目标+库成可执行文件)。gcc -S 可看编译到的汇编', step: 0, evidence: '预处理→编译→汇编→链接' }), distractors: () => ['直接一步变成机器码', '解释执行不编译', '先运行再编译'] },
      { id: 'gc_cover', label: 'GCC 对应的实验', ask: 'GCC 生成的机器指令对应实验室哪些「组成原理」实验?', kind: 'choice', compute: () => ({ answer: '加法/减法、乘法、浮点表示的机器级运算(GCC 把高级语言的算术编译成这些指令),以及编译前端的表达式求值(语法分析)。它把「组成原理」的运算真正生成出来', step: 0, evidence: '加减/乘法/浮点/表达式' }), distractors: () => ['TCP 和握手', 'ICP 和 SLAM', 'PageRank 和 A*'] },
      { id: 'gc_license', label: 'GCC 许可与你的程序', ask: 'GCC 是 GPLv3,那你用它编出来的程序也要开源吗?', kind: 'choice', compute: () => ({ answer: '不用。GCC 本身是 GPLv3,但它有"运行时库例外(GCC Runtime Library Exception)",让你编出来的程序不被 GPL 传染——可以闭源商用。改 GCC 本身才受 GPL 约束', step: 0, evidence: 'GPLv3+运行时例外、编出的程序不传染' }), distractors: () => ['要,编出的程序必须 GPL', 'GCC 是闭源的', '完全没有许可'] },
    ],
  },
  {
    id: 'gdb', title: 'GDB · GNU 调试器', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'gdb' }, entities: [], streams: [] },
    facts: [
      { id: 'gd_what', label: 'GDB 是什么', ask: 'GDB 能做什么?', kind: 'choice', compute: () => ({ answer: '调试器(GPLv3+):让程序停在断点、单步执行、查看和修改寄存器/内存/变量/调用栈、反汇编、远程调试(配 QEMU 调内核)、分析 core dump。把「组成原理」的寄存器/内存/栈变成看得见能拨动的东西', step: 0, evidence: '断点/单步/看寄存器内存栈/反汇编/远程' }), distractors: () => ['编译源码', '发送网络请求', '管理数据库'] },
      { id: 'gd_use', label: 'GDB 怎么配合用', ask: 'GDB 通常和什么一起用?', kind: 'choice', compute: () => ({ answer: '配 GCC(编译时加 -g 生成调试信息)、配 QEMU(远程调试操作系统内核/嵌入式)。GCC 编译、GDB 调试、QEMU 提供运行环境,是系统编程的经典工具三件套', step: 0, evidence: '配 GCC -g、配 QEMU 调内核' }), distractors: () => ['和 Photoshop', '和 Excel', '和浏览器'] },
      { id: 'gd_see', label: 'GDB 让你看见什么', ask: 'GDB 对理解「计算机组成原理」有什么帮助?', kind: 'choice', compute: () => ({ answer: '它把课本上抽象的寄存器、内存地址、函数调用栈、机器指令,变成运行时能实际观察的东西——你能真看到变量在内存哪个地址、函数调用怎么压栈、指令一条条怎么执行。是"看得见的组成原理"', step: 0, evidence: '寄存器/内存/栈/指令运行时可见' }), distractors: () => ['帮你写更快的算法', '帮你画图表', '帮你训练模型'] },
    ],
  },
  {
    id: 'qemu', title: 'QEMU · 整机模拟器', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'qemu' }, entities: [], streams: [] },
    facts: [
      { id: 'qm_what', label: 'QEMU 是什么', ask: 'QEMU 是干什么的?', kind: 'choice', compute: () => ({ answer: '整机模拟/虚拟化器(GPL-2.0):在软件里模拟出一整台计算机(CPU 指令翻译、内存、磁盘、网卡、外设),能启动完整操作系统,配 Linux KVM 可做接近原生的硬件加速虚拟化', step: 0, evidence: '软件模拟整台计算机、启动完整 OS、配 KVM' }), distractors: () => ['一个编译器', '一个抓包工具', '一个数据库'] },
      { id: 'qm_use', label: 'QEMU 学 OS 的价值', ask: 'QEMU 为什么是学操作系统/开发内核的标准平台?', kind: 'choice', compute: () => ({ answer: '它把整机放到一个可观察、可调试(配 GDB 单步调内核)的环境里跑,改内核不会搞崩真机、还能跨架构。学 OS、跑 xv6、开发/调试 Linux 内核都在它上面', step: 0, evidence: '整机可观察可调试、配 GDB 调内核、跑 xv6' }), distractors: () => ['因为它最快', '因为它是图形界面', '因为它自带编译器'] },
      { id: 'qm_cover', label: 'QEMU 对应的实验', ask: 'QEMU 模拟的机器涉及实验室哪些「组成原理」概念?', kind: 'choice', compute: () => ({ answer: 'CPU 指令执行(缓存、流水线)、内存管理单元 MMU(虚拟内存/分页)——它把这些组成原理概念放到可跑可调的整机里。纯模拟慢、配 KVM 才快', step: 0, evidence: '缓存/流水线/虚拟内存(MMU)' }), distractors: () => ['TCP 握手和子网', '词向量和注意力', 'B 树和哈希'] },
    ],
  },
  {
    id: 'wireshark', title: 'Wireshark · 网络抓包分析', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'wireshark' }, entities: [], streams: [] },
    facts: [
      { id: 'ws_what', label: 'Wireshark 是什么', ask: 'Wireshark 是干什么的?', kind: 'choice', compute: () => ({ answer: '网络抓包分析工具(GPL-2.0+):抓下网卡上的每个数据包,逐层逐字段解析(以太网→IP→TCP→HTTP…),让你亲眼看到协议在线路上怎么运作。是网络故障排查、协议开发、安全分析的事实标准', step: 0, evidence: '抓包逐层解析、看协议真实运作' }), distractors: () => ['一个 Web 服务器', '一个编译器', '一个数据库'] },
      { id: 'ws_cover', label: 'Wireshark 对应的实验', ask: 'Wireshark 能对照实验室「计算机网络」组哪些实验?', kind: 'choice', compute: () => ({ answer: 'TCP(拥塞/可靠、序号确认重传窗口)、三次握手、子网划分、CRC 校验——你能抓真实的包对照实验里的原理看:握手的 SYN/ACK、重传、校验字段都在包里', step: 0, evidence: 'TCP/三次握手/子网/CRC' }), distractors: () => ['缺页和页替换', '卷积和池化', 'B 树和哈希'] },
      { id: 'ws_use', label: 'Wireshark 的价值', ask: 'Wireshark 对学网络协议有什么独特价值?', kind: 'choice', compute: () => ({ answer: '把课本上抽象的协议变成"看得见的真流量":你能实际抓到 TCP 三次握手的三个包、看到重传和窗口变化、逐字段拆开每个包。学协议从"背 RFC"变成"看真包"', step: 0, evidence: '协议从课本变可见的真实流量' }), distractors: () => ['帮你写更快的代码', '帮你训练模型', '帮你管理内存'] },
    ],
  },
  {
    id: 'nginx', title: 'nginx · 高性能 Web 服务器', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'nginx' }, entities: [], streams: [] },
    facts: [
      { id: 'ng_what', label: 'nginx 是什么', ask: 'nginx 是干什么的?靠什么扛高并发?', kind: 'choice', compute: () => ({ answer: '高性能 Web 服务器/反向代理/负载均衡(BSD-2):靠事件驱动 + 异步非阻塞(epoll/kqueue)架构,单进程用 IO 多路复用管海量连接,单机就能扛住高并发(经典 C10K 问题的答案)', step: 0, evidence: '事件驱动+epoll 异步非阻塞、扛高并发' }), distractors: () => ['靠为每个连接开一个线程', '靠更快的 CPU', '靠更大的内存'] },
      { id: 'ng_epoll', label: 'nginx 和 OS 的关系', ask: 'nginx 的高并发和操作系统哪个机制相关?', kind: 'choice', compute: () => ({ answer: 'IO 多路复用(epoll):一个线程用 epoll 同时盯着成千上万个连接,谁有数据就处理谁,不用一连接一线程。这和 OS 的事件通知、进程调度/事件循环相通——是「网络」和「操作系统」的交汇', step: 0, evidence: 'epoll IO 多路复用、和调度/事件循环相通' }), distractors: () => ['和文件系统 inode', '和 CPU 缓存', '和浮点运算'] },
      { id: 'ng_role', label: 'nginx vs curl', ask: 'nginx 和 curl 在网络里分别是什么角色?', kind: 'choice', compute: () => ({ answer: 'nginx 是服务端(接收并响应请求的 Web 服务器),curl 是客户端(发起请求)。一次网络请求:curl 发出 → 经 TCP 握手 → nginx 接收响应。抓包看两边靠 Wireshark', step: 0, evidence: 'nginx 服务端、curl 客户端' }), distractors: () => ['两者都是客户端', '两者都是抓包工具', '两者是同一个东西'] },
    ],
  },
  {
    id: 'redis', title: 'Redis · 内存数据结构服务器', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'redis' }, entities: [], streams: [] },
    facts: [
      { id: 'rd_what', label: 'Redis 是什么', ask: 'Redis 是干什么的?为什么快?', kind: 'choice', compute: () => ({ answer: '内存数据结构服务器(C 写):把字符串/哈希/列表/集合/有序集合(跳表)/位图等当网络服务用,常做缓存/排行榜/队列。快在数据全在内存 + 单线程事件循环(无锁竞争)。内部是一座数据结构博物馆', step: 0, evidence: '内存数据结构服务器、单线程事件循环、极快' }), distractors: () => ['一个关系数据库(存磁盘)', '一个编译器', '一个 Web 服务器'] },
      { id: 'rd_cover', label: 'Redis 对应的实验', ask: 'Redis 内部结构对应实验室哪些概念?', kind: 'choice', compute: () => ({ answer: '哈希表(渐进式 rehash,对应「数据结构」哈希)、有序集合用跳表、以及内存满时的 LRU/LFU 淘汰(和「操作系统」页替换 LRU 同思路)。它是这些数据结构的工程范本', step: 0, evidence: '哈希表(rehash)、LRU 淘汰(和页替换同思路)' }), distractors: () => ['TCP 握手和 CRC', '卷积和注意力', '梯度下降和反向传播'] },
      { id: 'rd_license', label: 'Redis 许可变更', ask: 'Redis 的许可这几年发生了什么?用要注意什么?', kind: 'choice', compute: () => ({ answer: '2024 从宽松的 BSD 改成 source-available(SSPLv1/RSALv2),一度不再是 OSI 开源;Redis 8(2025)又加回 AGPLv3 作为可选,现在是三重许可。商用/云服务要看清条款;社区拉了个 BSD 分叉叫 Valkey', step: 0, evidence: '2024 BSD→source-available、Redis 8 加回 AGPLv3;分叉 Valkey' }), distractors: () => ['一直是 MIT 没变', '一直是公有领域', '变成了完全闭源收费'] },
    ],
  },
  {
    id: 'sqlite', title: 'SQLite · 嵌入式数据库', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'sqlite' }, entities: [], streams: [] },
    facts: [
      { id: 'sq_what', label: 'SQLite 是什么', ask: 'SQLite 有什么特别?为什么部署最广?', kind: 'choice', compute: () => ({ answer: '嵌入式、零配置、单文件的关系数据库(公有领域):整个库就是磁盘上一个 .db 文件,随程序进程跑、不用单独的服务器。因为小、稳、无依赖,被嵌进手机/浏览器/操作系统/飞机——是部署量最大的数据库', step: 0, evidence: '单文件+零配置+嵌入式、部署最广' }), distractors: () => ['需要独立服务器进程', '只能在云上跑', '是内存数据库不落盘'] },
      { id: 'sq_cover', label: 'SQLite 的存储结构', ask: 'SQLite 的存储引擎核心是什么数据结构?对应哪个实验?', kind: 'choice', compute: () => ({ answer: 'B 树/B+ 树:表和索引都用 B 树组织、页式存储到文件。正是「数据结构」里的 B 树/B+ 树实验。SQLite 是"B 树怎么落到磁盘文件"的最佳活样本', step: 0, evidence: 'B 树/B+ 树存储、对应 btree/bplus 实验' }), distractors: () => ['哈希表(全内存)', '链表', '红黑树内存索引'] },
      { id: 'sq_license', label: 'SQLite 许可', ask: 'SQLite 的许可是什么?', kind: 'choice', compute: () => ({ answer: '公有领域(Public Domain)——没有版权限制,想怎么用怎么用(商用/闭源都行、无需署名)。这在开源里少见,也是它能嵌进一切的原因之一', step: 0, evidence: '公有领域、无任何许可限制' }), distractors: () => ['GPL 传染', 'AGPL 云限制', '商业收费'] },
    ],
  },
  {
    id: 'git', title: 'Git · 分布式版本控制', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'git' }, entities: [], streams: [] },
    facts: [
      { id: 'gt_what', label: 'Git 的内部模型', ask: 'Git 内部是怎么存东西的?', kind: 'choice', compute: () => ({ answer: '内容寻址对象库:每个文件(blob)/目录(tree)/提交(commit)都按内容的 SHA 哈希寻址——改一点内容哈希就变;提交靠父指针连成有向无环图(DAG),分支只是指向某个提交的指针。是一个漂亮的数据结构设计', step: 0, evidence: '内容寻址(SHA 哈希)+提交 DAG+分支是指针' }), distractors: () => ['按文件名和时间戳存', '存每次改动的差异行号', '存整个项目的多份完整拷贝'] },
      { id: 'gt_cover', label: 'Git 对应的实验', ask: 'Git 的设计对应实验室哪些数据结构?', kind: 'choice', compute: () => ({ answer: '哈希(内容寻址,改内容→新哈希,类似哈希表/指纹)、拓扑排序(提交的有向无环图 DAG,log 就是拓扑序);内容去重/压缩和布隆/压缩思路相通。理解 Git = 把哈希+DAG 串一遍', step: 0, evidence: '哈希(内容寻址)、拓扑排序(提交 DAG)' }), distractors: () => ['TCP 和握手', '卷积和池化', '调度和缺页'] },
      { id: 'gt_dist', label: 'Git 为什么分布式', ask: 'Git 的"分布式"体现在哪?', kind: 'choice', compute: () => ({ answer: '每个克隆(clone)都是包含完整历史的完整仓库,可以离线提交/查历史/建分支,不依赖中心服务器;需要时再和别人同步(push/pull)。这和集中式(SVN,必须连服务器)不同', step: 0, evidence: '每个克隆是完整仓库、可离线、去中心' }), distractors: () => ['必须连中心服务器才能提交', '只在云端存代码', '不能建分支'] },
    ],
  },
  {
    id: 'docker', title: 'Docker · 容器', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'docker' }, entities: [], streams: [] },
    facts: [
      { id: 'dk_what', label: 'Docker 是什么', ask: 'Docker 容器和虚拟机有什么本质不同?', kind: 'choice', compute: () => ({ answer: '容器不是虚拟机:它不虚拟一整台机器,而是直接用宿主 Linux 内核的原语——namespaces(隔离进程/网络/文件视图)+cgroups(限 CPU/内存)+overlayfs(镜像分层)——把应用装进一个隔离环境。共享内核,所以比 VM 轻', step: 0, evidence: '用内核 namespaces+cgroups+overlayfs、共享内核' }), distractors: () => ['和虚拟机一样虚拟整台机器', '是一种新的 CPU', '是一个编译器'] },
      { id: 'dk_cover', label: 'Docker 对应的 OS 概念', ask: 'Docker 用到的 Linux 内核机制对应实验室哪些 OS 概念?', kind: 'choice', compute: () => ({ answer: 'cgroups 限制 CPU/内存配额(和进程调度/资源管理相关)、overlayfs 联合文件系统(和 inode/文件系统相关)。理解容器 = 理解 OS 的隔离与资源管理', step: 0, evidence: 'cgroups↔调度/配额、overlayfs↔文件系统/inode' }), distractors: () => ['TCP 拥塞控制', '浮点表示', '词向量'] },
      { id: 'dk_license', label: 'Docker 的开源与商业', ask: 'Docker 的开源和商业怎么区分?', kind: 'choice', compute: () => ({ answer: '底层容器引擎(moby 项目)是 Apache-2.0 开源;而 Docker Desktop(桌面客户端)对较大企业有商业授权条款。用引擎/CLI 一般没问题,企业用 Desktop 要看授权', step: 0, evidence: 'moby 引擎 Apache-2.0、Desktop 有商业条款' }), distractors: () => ['完全免费无任何限制', '完全闭源收费', '是 GPL 传染'] },
    ],
  },
  {
    id: 'xv6', title: 'xv6 · 教学操作系统', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'xv6' }, entities: [], streams: [] },
    facts: [
      { id: 'xv_what', label: 'xv6 是什么', ask: 'xv6 是什么?为什么用它学 OS?', kind: 'choice', compute: () => ({ answer: 'MIT 为操作系统课(6.S081)写的教学操作系统(MIT 许可):一个几千行、能真编译运行的类 Unix 内核(RISC-V + QEMU)。Linux 几千万行读不动,xv6 小到能完整读懂,却涵盖进程/调度/内存/文件系统/锁', step: 0, evidence: '几千行能真跑的教学类 Unix 内核' }), distractors: () => ['一个生产级服务器内核', '一个编译器', '一个数据库'] },
      { id: 'xv_cover', label: 'xv6 覆盖的 OS 概念', ask: 'xv6 里能读到实验室哪些 OS 实验的完整实现?', kind: 'choice', compute: () => ({ answer: '进程调度(上下文切换)、虚拟内存(分页/缺页)、inode + 日志的文件系统——「操作系统」组实验的原理,在 xv6 里是完整、可编译运行的最小真实现。是从"原理"到"真代码"的最短路径', step: 0, evidence: '调度/缺页/inode 的完整可运行实现' }), distractors: () => ['TCP 和子网', '卷积和注意力', 'B 树和哈希'] },
      { id: 'xv_vs', label: 'xv6 vs Linux', ask: '学 OS 用 xv6 还是 Linux?', kind: 'choice', compute: () => ({ answer: '先 xv6 后 Linux:xv6 小(几千行)、能完整读懂 OS 骨架,适合入门;Linux 是生产内核(几千万行、功能全但门槛极高),xv6 打好基础后再看 Linux 的工业实现', step: 0, evidence: 'xv6 入门读懂骨架、Linux 工业实现' }), distractors: () => ['xv6 更适合生产部署', 'Linux 更适合教学入门', '两者完全一样'] },
    ],
  },
  {
    id: 'curl', title: 'curl · 网络客户端', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'curl' }, entities: [], streams: [] },
    facts: [
      { id: 'cl_what', label: 'curl 是什么', ask: 'curl 是干什么的?', kind: 'choice', compute: () => ({ answer: '网络客户端(curl License,MIT 派生):命令行工具 + 库 libcurl,把 HTTP(S)/FTP 等几十种协议的请求发出去、拿回响应。是部署量最大的软件之一(几乎每台设备/汽车/手机里都有),调 API/下载/自动化脚本首选', step: 0, evidence: '命令行+libcurl、多协议客户端、部署量最大' }), distractors: () => ['一个 Web 服务器', '一个抓包工具', '一个数据库'] },
      { id: 'cl_cover', label: 'curl 一次请求发生什么', ask: '一次 `curl https://...` 背后经历了什么?对应哪个实验?', kind: 'choice', compute: () => ({ answer: 'DNS 解析 → TCP 三次握手 → TLS 握手 → 发 HTTP 请求 → 收响应。curl -v 能看到握手和头的全过程。对应「计算机网络」的三次握手、TCP——它是网络的"客户端侧"活样本', step: 0, evidence: 'DNS→TCP 握手→TLS→HTTP;对应握手/TCP' }), distractors: () => ['直接读本地文件', '只是画个图', '编译一段代码'] },
      { id: 'cl_role', label: 'curl 的角色', ask: 'curl 在网络里是什么角色?配合谁?', kind: 'choice', compute: () => ({ answer: '客户端(发起请求),对应的服务端是 nginx 那类 Web 服务器;要看它俩之间线路上的包,用 Wireshark 抓。curl 发 → 握手 → nginx 收响应 → Wireshark 看全过程', step: 0, evidence: '客户端;服务端 nginx、抓包 Wireshark' }), distractors: () => ['服务端', '抓包分析器', '编译器'] },
    ],
  },
  {
    id: 'wildcard', title: '通配符匹配', kernel: wildcardKernel as Kernel<unknown>, doc: trivialDoc('wildcard'),
    facts: [
      {
        id: 'star_backtrack', label: '通配符 * 该吃几个字符怎么定',
        ask: '通配符匹配里 * 能配任意一段，它到底该吃几个字符？双指针法怎么处理?', kind: 'choice',
        compute: () => ({ answer: '遇到 * 时先记下"锚点"(它的位置和此刻的 s 位置)、当作匹配 0 个往后走；一旦后面走不通，就回溯到锚点、让 * 多吃一个字符再试。贪心+回溯，不用枚举', step: 2, evidence: 'p="a*d"，* 先当匹配 0 个，后面 d≠b 走不通→回溯让 * 吃 b、再吃 c' }),
        distractors: () => ['* 总是吃掉剩下所有字符', '* 总是只吃一个字符', '枚举 * 吃 0 到 n 个全试一遍'],
      },
      {
        id: 'why_anchor', label: '双指针法的空间复杂度',
        ask: '通配符匹配用"双指针+回溯锚点"而不是动态规划，好处是?', kind: 'choice',
        compute: () => ({ answer: '只用几个指针变量记锚点，O(n) 时间、O(1) 额外空间；而 DP 要 O(n×m) 的二维表。锚点法本质是把"* 该吃几个"的搜索用回溯代替了枚举', step: 6, evidence: '全程只维护 si/pj/star/sTmp 几个变量，无二维表' }),
        distractors: () => ['双指针一定比 DP 慢', '双指针要 O(n×m) 空间', '两种方法空间一样'],
      },
    ],
  },
  {
    id: 'blockingqueue', title: '线程安全阻塞队列', kernel: blockingqueueKernel as Kernel<unknown>, doc: trivialDoc('blockingqueue'),
    facts: [
      {
        id: 'block_when', label: '阻塞队列什么时候阻塞谁',
        ask: '有界阻塞队列里，什么时候生产者被阻塞、什么时候消费者被阻塞?', kind: 'choice',
        compute: () => ({ answer: '队列满时 put 让生产者阻塞（等有空位），队列空时 take 让消费者阻塞（等有数据）；对方操作后 signal 唤醒被阻塞的一方', step: 3, evidence: '队列 [A,B] 满，put(C) 时生产者阻塞；消费者 take 腾出空位后唤醒它' }),
        distractors: () => ['队列空时阻塞生产者、满时阻塞消费者', '任何时候都不阻塞', '只在队列半满时阻塞'],
      },
      {
        id: 'two_conds', label: '为什么要两个条件变量',
        ask: '实现阻塞队列为什么要两个条件变量（notFull / notEmpty），用 while 判断满/空?', kind: 'choice',
        compute: () => ({ answer: '生产者在 notFull 上等空位、消费者在 notEmpty 上等数据，分开才能精确唤醒对应的一方；用 while 而非 if 判满/空是为了防"虚假唤醒"——被唤醒后要重新检查条件', step: 10, evidence: '满/空是两个不同的等待条件，各自的等待者不同' }),
        distractors: () => ['一个条件变量就够了', 'while 只是为了写着好看', '两个条件变量是为了更快'],
      },
    ],
  },
  {
    id: 'regex', title: 'mini 正则引擎', kernel: regexKernel as Kernel<unknown>, doc: trivialDoc('regex'),
    facts: [
      {
        id: 'star_two', label: '正则 * 在 DP 里的两种转移',
        ask: '正则的 * 表示"零或多个前一字符"，在动态规划里它对应哪两种转移?', kind: 'choice',
        compute: () => ({ answer: '设 p 是 "x*"：① x* 匹配 0 个 → dp[i][j] = dp[i][j-2]（把 "x*" 整段跳过）；② x* 多匹配一个 → 若 s[i-1] 配 x，则 dp[i][j] = dp[i-1][j]（消掉 s 一个字符、"x*" 留着继续吃）', step: 1, evidence: 'c* 用①匹配 0 个 c；a* 用②吃掉 2 个 a' }),
        distractors: () => ['* 只能匹配恰好一个字符', '* 直接看左上角一种转移', '* 匹配整个剩余字符串'],
      },
      {
        id: 'vs_wildcard', label: '正则 * 和通配符 * 的区别',
        ask: '正则的 * 和通配符（glob）的 * 有什么本质区别?', kind: 'choice',
        compute: () => ({ answer: '正则的 * 表示"零或多个它前面那个字符"（如 a* 是零或多个 a）；通配符的 * 表示"任意一段字符"（和前一个字符无关）。语义完全不同', step: 5, evidence: 'p="c*a*b" 里 c*=零或多个c、a*=零或多个a；通配符里 * 是任意段' }),
        distractors: () => ['两者完全一样', '正则 * 匹配一段、通配符 * 匹配一个', '只是写法不同、语义相同'],
      },
    ],
  },
  {
    id: 'objectstore', title: '设计对象存储', kernel: objectstoreKernel as Kernel<unknown>, doc: trivialDoc('objectstore'),
    facts: [
      {
        id: 'replica_ec', label: '副本和纠删码怎么选',
        ask: '对象存储保证数据不丢，用多副本还是纠删码，怎么权衡?', kind: 'choice',
        compute: () => ({ answer: '多副本(如3副本)=3倍存储、恢复快、简单，适合热数据；纠删码(如RS(6,3))=约1.5倍存储、省钱，但恢复要计算、CPU高、恢复慢，适合冷数据。核心是存储成本 vs 恢复性能的权衡', step: 5, evidence: '3副本3倍空间；纠删码把冗余从"整份复制"降到"校验块"' }),
        distractors: () => ['副本一定更好', '纠删码一定更好', '两者存储开销一样'],
      },
      {
        id: 'why_object', label: '为什么用对象存储而不是文件系统',
        ask: '存海量图片视频，为什么用对象存储、而不是传统文件系统的目录树?', kind: 'choice',
        compute: () => ({ answer: '海量小文件会把文件系统的目录树/inode/元数据撑爆；对象存储用扁平的 key(bucket/hash)而非目录树，元数据单独存、可水平扩展，天然适合海量对象', step: 2, evidence: '目录树扛不住 PB 级海量文件，对象存储扁平 key 可扩展' }),
        distractors: () => ['对象存储读写更快', '文件系统不能存视频', '对象存储不用存元数据'],
      },
    ],
  },
  {
    id: 'queryplan', title: '执行计划 · 优化器选路', kernel: queryplanKernel as Kernel<unknown>, doc: trivialDoc('queryplan'),
    facts: [
      {
        id: 'cbo', label: '优化器凭什么选执行计划',
        ask: '同一个查询有多条访问路径，数据库优化器凭什么选其中一条?', kind: 'choice',
        compute: () => ({ answer: '基于代价(CBO)：估每条访问路径大概要扫多少行(以及回表、排序等成本)，选代价最低的。不是"哪个索引新"或"随便挑"', step: 4, evidence: '全表扫 10000、idx(city) 500、idx(age) 6000 → 选 500 行的 idx(city)' }),
        distractors: () => ['选最新建的索引', '选主键索引', '随机选一条'],
      },
      {
        id: 'why_not_index', label: '建了索引为什么有时不走',
        ask: '明明建了索引，EXPLAIN 却显示 type=ALL（全表扫），可能是为什么?', kind: 'choice',
        compute: () => ({ answer: '优化器算出走索引反而更贵——比如索引命中行太多、回表成本高，全表扫可能更省；或统计信息过期导致代价估错；也可能是查询写法让索引失效(函数、隐式转换、最左前缀不满足)', step: 0, evidence: '优化器按代价选，命中行多时全表扫可能比走索引+回表更省' }),
        distractors: () => ['索引一建就一定会走', '数据库有 bug', '索引太新还没生效'],
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
]

/*  把原理题补丁包挂上去（server/catalog/concepts.ts）。
    那 75 个最早的实验只有计数题，用户看到的就是连着三道「比了几次 / 移了几次」。
    补丁不改原条目，只往它们的 facts 后面追加 —— 合并点就这一处，好 review 也好回退。
    ⚠️ 键写错了会静默什么都不做，所以 tests/fact-genre.test.ts 里有一条判据盯着
    「补丁包里的每个 id 都对得上一个真实验」。 */
for (const [id, extra] of Object.entries(CONCEPT_FACTS)) {
  const e = CATALOG.find(x => x.id === id)
  if (e) e.facts = [...e.facts, ...extra]
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
    //  按实验 id 的哈希定点取,保证每次出题都一样(可复现),不随机
    const h = [...e.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)
    const picks = [0, 1, 2].map(k => pool[(h + k * 37) % pool.length]!)
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
