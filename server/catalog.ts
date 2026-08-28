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
import { lfucacheKernel } from '../src/kernels/lfucache.ts'
import { trieKernel } from '../src/kernels/trie.ts'
import { quickselectKernel } from '../src/kernels/quickselect.ts'
import { lockstrategyKernel } from '../src/kernels/lockstrategy.ts'
import { bufferpoolKernel } from '../src/kernels/bufferpool.ts'
import { feedKernel } from '../src/kernels/feed.ts'
import { wildcardKernel } from '../src/kernels/wildcard.ts'
import { blockingqueueKernel } from '../src/kernels/blockingqueue.ts'
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
        id: 'read_heavy', label: '短链系统读多写少该怎么扛',
        ask: '短链系统读:写约 100:1（跳转远多于生成）。为扛住读，第一个该加的组件是?', kind: 'choice',
        compute: () => ({ answer: '缓存（Redis 缓存热点短码）', step: 0, evidence: '读多写少，热点短链几乎全走缓存' }),
        distractors: () => ['消息队列', '更多写库', '分布式锁'],
      },
      {
        id: 'shortcode', label: '短码生成为什么用发号器+Base62',
        ask: '短链的短码生成，为什么推荐「唯一发号器 + Base62 编码」，而不是「哈希长链」?', kind: 'choice',
        compute: () => ({ answer: '哈希会碰撞、要处理冲突；发号器保证唯一，Base62 让短码又短又不易被爬', step: 0, evidence: '62^6≈568亿够用；自增 ID 又会暴露业务量' }),
        distractors: () => ['哈希更快所以更好', '发号器不需要唯一性', '两者完全一样'],
      },
    ],
  },
  {
    id: 'seckill', title: '设计秒杀系统', kernel: seckillKernel as Kernel<unknown>, doc: trivialDoc('seckill'),
    facts: [
      {
        id: 'no_oversell', label: '秒杀怎么防超卖',
        ask: '秒杀的红线是绝不超卖。抗住高并发扣库存、又不超卖，核心手段是?', kind: 'choice',
        compute: () => ({ answer: 'Redis 原子预扣（DECR/Lua）挡住绝大多数，DB 乐观锁(where stock>0)兜底', step: 3, evidence: '内存原子扣减扛并发，DB 乐观锁保证绝不扣成负数' }),
        distractors: () => ['直接 UPDATE 数据库库存', '加分布式锁串行下单', '前端限制点击就够了'],
      },
      {
        id: 'peak_shaving', label: '秒杀怎么削峰',
        ask: '秒杀瞬时几万 QPS，但真正成功的只有库存数。把洪峰摊平、别冲垮后端，靠什么?', kind: 'choice',
        compute: () => ({ answer: '层层限流(前端置灰+网关令牌桶) + 消息队列异步下单，削峰填谷', step: 4, evidence: '预扣成功才进 MQ，订单服务平稳消费落库' }),
        distractors: () => ['给数据库加更多连接', '同步下单只是加机器', '关掉缓存直连库'],
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
        id: 'no_loss', label: '消息队列怎么保证不丢消息',
        ask: '消息队列的红线是消息不丢。Broker 挂了也不丢，靠什么?', kind: 'choice',
        compute: () => ({ answer: '每个分区多副本(ISR)，生产者 ack=all（ISR 都确认才算成功），Leader 挂了从 ISR 选新 Leader', step: 4, evidence: '单副本落盘也可能随机器一起丢，多副本 + ack=all 才扛得住宕机' }),
        distractors: () => ['消息只存内存更快', '生产者 ack=0 发完即成功', '消费完就删除消息'],
      },
      {
        id: 'ordering', label: '消息队列怎么保证顺序',
        ask: '要让同一个订单的消息被顺序消费，消息队列怎么做?', kind: 'choice',
        compute: () => ({ answer: '只保证单个分区内有序；按订单 key 哈希路由到固定分区，同 key 消息就都进同一分区、天然有序', step: 5, evidence: '跨分区不保证顺序，key 路由把需要保序的消息收敛到一个分区' }),
        distractors: () => ['全局所有分区都有序', '加副本就能保序', '消费者随机拉取即可'],
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
        ask: '海量数据求 Top-K 要分片处理，为什么用 hash(key)%N 分片，而不是随机切成 N 块?', kind: 'choice',
        compute: () => ({ answer: '哈希分片保证"相同的 key 一定落到同一片"，所以每片能独立统计词频、各片互不影响；随机切会把同一个 key 散到多片，每片只数到部分、没法得到该 key 的真实总频', step: 2, evidence: '同 key 哈希值相同→同片→该 key 的所有出现都在这片里' }),
        distractors: () => ['哈希分片切得更均匀', '随机切会丢数据', '两种没区别'],
      },
      {
        id: 'min_heap', label: '求 Top-K 为什么用小顶堆',
        ask: '每片内求出现最多的 K 个，为什么用大小为 K 的小顶堆，而不是全部排序?', kind: 'choice',
        compute: () => ({ answer: '维护一个大小为 K 的小顶堆：堆顶是当前第 K 大，新元素只要比堆顶大就替换堆顶下沉。整体 O(n㏒K)，比全排序 O(n㏒n) 省（K 远小于 n），且只需 O(K) 内存', step: 3, evidence: '小顶堆堆顶=第K大，比它小的直接丢，比它大的替换' }),
        distractors: () => ['大顶堆才对', '必须全排序才能求 Top-K', '用哈希表就能直接排序'],
      },
    ],
  },
  {
    id: 'reactagent', title: 'ReAct Agent 循环', kernel: reactagentKernel as Kernel<unknown>, doc: trivialDoc('reactagent'),
    facts: [
      {
        id: 'react_loop', label: 'ReAct 的三步循环是什么',
        ask: 'ReAct Agent 处理一个多步问题时，反复走哪三步?', kind: 'choice',
        compute: () => ({ answer: 'Thought(推理下一步该干嘛)→Action(调用某个工具并给参数)→Observation(把工具真实返回喂回模型)，循环直到能给 Final Answer', step: 11, evidence: '本例：想查气温→search 北京→观察30°C→想查上海→search→25°C→想算差→calc→5→作答' }),
        distractors: () => ['输入→隐藏层→输出', '编码→解码→采样', '训练→验证→测试'],
      },
      {
        id: 'why_tools', label: 'Agent 为什么要调工具而不是直接答',
        ask: '大模型直接回答"北京今天比上海热多少度"有什么问题，为什么 Agent 要调 search/calc?', kind: 'choice',
        compute: () => ({ answer: '实时气温不在模型训练知识里、直接答会幻觉；调 search 拿真实气温、调 calc 精确算差，Observation 把真结果喂回，答案就基于真数据而非编造', step: 11, evidence: 'search 得到 30/25、calc 得到 5，都是工具的真实返回' }),
        distractors: () => ['调工具只是为了更慢', '模型其实知道，调工具是多余的', '为了减少模型参数'],
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
        compute: () => ({ answer: '推：发帖时写进每个粉丝的收件箱，读时直接读自己收件箱→读快，但写放大（大 V 发一条写千万次）；拉：发帖只存自己，读时现拉所有关注人的最新帖归并→写快，但读慢（每次拉 N 个人）', step: 3, evidence: '推=fan-out on write 读快写放大；拉=fan-out on read 写快读慢' }),
        distractors: () => ['推和拉都读快', '推写快、拉读快', '两者没区别'],
      },
      {
        id: 'big_v', label: '推拉结合怎么解决大 V 问题',
        ask: '大 V 有千万粉丝，推拉结合怎么避免他发帖时的写放大?', kind: 'choice',
        compute: () => ({ answer: '普通用户走推（写扩散、读快）；大 V 走拉——发帖不推给千万粉丝，粉丝刷时才现拉大 V 的最新帖、和自己收件箱归并。既避免大 V 写放大，普通场景又保持读快', step: 4, evidence: '按粉丝数阈值判定大 V，大 V 的帖读时才拉' }),
        distractors: () => ['给大 V 更多服务器推', '禁止大 V 发帖太频繁', '大 V 也全量推、只是异步'],
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
