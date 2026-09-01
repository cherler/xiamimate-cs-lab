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
import { pidKernel } from '../src/kernels/pid.ts'
import { rrtKernel } from '../src/kernels/rrt.ts'
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

// trace 的一帧就是内核的可见状态；出题只读字段，用宽松类型即可。
type Frame = Record<string, unknown>

export type Fact = {
  id: string
  /** 喂给大模型的内部描述：这道题在考什么。 */
  label: string
  /** 保底题面：大模型不可用时直接用它，保证功能不依赖模型也能出题。 */
  ask: string
  kind: 'number' | 'choice'
  /** 从引擎 trace 算出钉死答案 + 出处（第几帧 + 该帧证据文字）。 */
  compute: (trace: Frame[]) => { answer: string; step: number; evidence: string }
  /** 生成干扰项（错误选项）。数值题按扰动，选择题按同类其它取值。 */
  distractors: (answer: string, trace: Frame[]) => string[]
}

export type CatalogEntry = {
  id: string
  title: string
  kernel: Kernel<unknown>
  doc: SimDocument
  facts: Fact[]
}

// ── 数值题通用干扰项：答案 ±1/±2，去重、去负、去与答案相同 ──
function numDistractors(answer: string): string[] {
  const a = Number(answer)
  const cand = [a + 1, a - 1, a + 2, a - 2, a + 3].filter(v => v >= 0 && v !== a)
  const uniq = [...new Set(cand)].map(String).filter(v => v !== answer)
  return uniq.slice(0, 3)
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

export const CATALOG: CatalogEntry[] = [
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
    doc: { kind: 'quant', params: { bits: 8 }, entities: [], streams: [] },
    facts: [
      {
        id: 'qmax', label: 'int8 的正整数上限 qmax',
        ask: 'int8 量化用带符号 8 位整数表示，它的正数上限 qmax 是多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).qmax), step: t.length - 1, evidence: `int8 范围 ±127；终态 qmax=${last(t).qmax}` }),
        distractors: numDistractors,
      },
      {
        id: 'bytesQ', label: '8 个权重量化后占的字节数',
        ask: '把 8 个 fp32 权重量化成 int8 后，一共占多少字节(原本 fp32 是 32 字节)?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).bytesQ), step: t.length - 1, evidence: `fp32=32B → int8=${last(t).bytesQ}B，压 4 倍` }),
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
        id: 'winner', label: '多数投票胜出的答案',
        ask: '自洽性采样多条推理链再多数投票。「小明有 5 个苹果，又买了 3 袋每袋 4 个」这题，多数链投出的最终答案是多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).winner), step: t.length - 1, evidence: String(last(t).log ?? '') }),
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
        distractors: answer => (answer === '安全' ? ['不安全'] : ['安全']),
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
      compute: t => ({ answer: String(last(t).flipped), step: t.length - 1, evidence: `翻转 ${last(t).flipped}/16 位，约一半` }),
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
        compute: () => ({ answer: '为了不动那段可缓存前缀(system+tools)——把可能变的项目指令放后面，系统提示前缀保持稳定、持续命中缓存。DeepSeek 把运行时快照当单独消息注入同理', step: 5, evidence: '护可缓存前缀，和 KV 缓存/上下文压缩(重放系统提示保前缀)同源' }),
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
        compute: () => ({ answer: '①计算力矩控制的 Cq̇+G 前馈=一次 RNEA(令 q̈=q̈_d+Kd ė+Kp e);②CRBA 组质量矩阵 M:对每关节 j 调 RNEA(q̈=eⱼ、q̇=0、g=0)读出 M 的第 j 列;③ABA 正向动力学也是同套空间递归的延伸', step: 5, evidence: 'RNEA 是逆动力学基元,被控制和正向动力学复用' }),
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

const BY_ID = new Map(CATALOG.map(e => [e.id, e]))

export function getEntry(id: string): CatalogEntry | undefined {
  return BY_ID.get(id)
}

/** 跑内核得到确定性 trace（出题/验答的唯一真源）。 */
export function traceOf(entry: CatalogEntry): Frame[] {
  const model = entry.kernel.compile(entry.doc) as CompiledModel<Frame>
  return run(model)
}

export function listExperiments(): { id: string; title: string; facts: number }[] {
  return CATALOG.map(e => ({ id: e.id, title: e.title, facts: e.facts.length }))
}
