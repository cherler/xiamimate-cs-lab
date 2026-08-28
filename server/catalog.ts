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
import { walKernel } from '../src/kernels/wal.ts'
import { lsmKernel } from '../src/kernels/lsm.ts'
import { minikvKernel } from '../src/kernels/minikv.ts'
import { urlshortenerKernel } from '../src/kernels/urlshortener.ts'
import { seckillKernel } from '../src/kernels/seckill.ts'
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
