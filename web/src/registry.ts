/**
 * 实验注册表。
 *
 * 加一个新实验 = 往这里加一条，宿主框架（布局/轴/日志/参数/读数）一行不用改。
 * 这是"渲染层可替换"（接缝 5）的落点。
 */
import { cacheKernel, type CacheState } from '@engine/kernels/cache.ts'
import { schedKernel, type SchedState } from '@engine/kernels/scheduler.ts'
import { tcpKernel, type TcpState } from '@engine/kernels/tcp.ts'
import { pageKernel, type PageState } from '@engine/kernels/page.ts'
import { diskKernel, type DiskState } from '@engine/kernels/disk.ts'
import { sortKernel, type SortState } from '@engine/kernels/sort.ts'
import { dijkstraKernel, type DijkstraState } from '@engine/kernels/dijkstra.ts'
import { bankerKernel, type BankerState } from '@engine/kernels/banker.ts'
import { arqKernel, type ArqState } from '@engine/kernels/arq.ts'
import { SortStage } from './stages/SortStage.tsx'
import { DijkstraStage } from './stages/DijkstraStage.tsx'
import { BankerStage } from './stages/BankerStage.tsx'
import { ArqStage } from './stages/ArqStage.tsx'
import { CacheStage } from './stages/CacheStage.tsx'
import { SchedulerStage } from './stages/SchedulerStage.tsx'
import { TcpStage } from './stages/TcpStage.tsx'
import { PageStage } from './stages/PageStage.tsx'
import { DiskStage } from './stages/DiskStage.tsx'
import {
  CACHE_PRESETS, PAGE_PRESETS, DISK_PRESETS, SORT_PRESETS,
} from '@engine/presets/sequences.ts'
import {
  SCHED_PRESETS, DIJKSTRA_PRESETS, BANKER_PRESETS, TCP_PRESETS, ARQ_PRESETS, NODES,
  PIPE_PRESETS, VM_PRESETS,
} from '@engine/presets/entities.ts'
import {
  VM_PRESETS_SEQ, FLOAT_PRESETS, MUL_PRESETS,
  CRC_PRESETS, HAMMING_PRESETS, SUBNET_PRESETS,
} from '@engine/presets/sequences.ts'
import { ROUTE_PRESETS, HS_PRESETS } from '@engine/presets/entities.ts'
import {
  AVL_PRESETS, HASH_PRESETS, HUFF_PRESETS,
} from '@engine/presets/sequences.ts'
import { avlKernel, type AvlState } from '@engine/kernels/avl.ts'
import { hashKernel, asl, type HashState } from '@engine/kernels/hashtable.ts'
import { huffmanKernel, type HuffState } from '@engine/kernels/huffman.ts'
import { kmpKernel, type KmpState } from '@engine/kernels/kmp.ts'
import { trueHeight } from '@engine/core/tree.ts'
import {
  MST_PRESETS, AOE_PRESETS, PART_PRESETS, MST_NODES, AOE_NODES,
} from '@engine/presets/entities.ts'
import { INODE_PRESETS, BPLUS_PRESETS } from '@engine/presets/sequences.ts'
import {
  TRAV_PRESETS, BITMAP_PRESETS, CSMA_PRESETS, SEM_SCHEDULES, TRAV_NODES,
} from '@engine/presets/entities.ts'
import { bplusKernel, type BPlusState } from '@engine/kernels/bplus.ts'
import { traverseKernel, type TravState } from '@engine/kernels/traverse.ts'
import { btreeKernel, type BtreeState } from '@engine/kernels/btree.ts'
import { BtreeStage } from './stages/BtreeStage.tsx'
import { BTREE_PRESETS } from '@engine/presets/sequences.ts'
import { ripKernel, type RipState } from '@engine/kernels/rip.ts'
import { RipStage } from './stages/RipStage.tsx'
import { RIP_PRESETS } from '@engine/presets/entities.ts'
import { exprKernel, type ExprState } from '@engine/kernels/expr.ts'
import { ExprStage } from './stages/ExprStage.tsx'
import { radixKernel, type RadixState } from '@engine/kernels/radix.ts'
import { RadixStage } from './stages/RadixStage.tsx'
import { pagedKernel, type PagedState } from '@engine/kernels/paged.ts'
import { PagedStage } from './stages/PagedStage.tsx'
import { softmaxKernel, type SoftmaxState } from '@engine/kernels/softmax.ts'
import { SoftmaxStage } from './stages/SoftmaxStage.tsx'
import { attentionKernel, type AttnState } from '@engine/kernels/attention.ts'
import { AttentionStage } from './stages/AttentionStage.tsx'
import { llmSizeKernel, type LlmSizeState } from '@engine/kernels/llmsize.ts'
import { LlmSizeStage } from './stages/LlmSizeStage.tsx'
import { samplingKernel, type SamplingState } from '@engine/kernels/sampling.ts'
import { SamplingStage } from './stages/SamplingStage.tsx'
import { bpeKernel, type BpeState } from '@engine/kernels/bpe.ts'
import { BpeStage } from './stages/BpeStage.tsx'
import { batchingKernel, type BatchState } from '@engine/kernels/batching.ts'
import { BatchingStage } from './stages/BatchingStage.tsx'
import { mhaKernel, type MhaState } from '@engine/kernels/mha.ts'
import { MhaStage } from './stages/MhaStage.tsx'
import { kvcacheKernel, type KvCacheState } from '@engine/kernels/kvcache.ts'
import { KvCacheStage } from './stages/KvCacheStage.tsx'
import { flashKernel, type FlashState } from '@engine/kernels/flash.ts'
import { FlashStage } from './stages/FlashStage.tsx'
import { scaledmaskKernel, type ScaledMaskState } from '@engine/kernels/scaledmask.ts'
import { ScaledMaskStage } from './stages/ScaledMaskStage.tsx'
import { specdecKernel, type SpecDecState } from '@engine/kernels/specdec.ts'
import { SpecDecStage } from './stages/SpecDecStage.tsx'
import { quantKernel, type QuantState } from '@engine/kernels/quant.ts'
import { QuantStage } from './stages/QuantStage.tsx'
import { moeKernel, type MoeState } from '@engine/kernels/moe.ts'
import { MoeStage } from './stages/MoeStage.tsx'
import { ropeKernel, type RopeState } from '@engine/kernels/rope.ts'
import { RopeStage } from './stages/RopeStage.tsx'
import { rooflineKernel, type RooflineState } from '@engine/kernels/roofline.ts'
import { RooflineStage } from './stages/RooflineStage.tsx'
import { rmsnormKernel, type RmsNormState } from '@engine/kernels/rmsnorm.ts'
import { RmsNormStage } from './stages/RmsNormStage.tsx'
import { forwardKernel, type ForwardState } from '@engine/kernels/forward.ts'
import { ForwardStage } from './stages/ForwardStage.tsx'
import { matmulKernel, type MatmulState } from '@engine/kernels/matmul.ts'
import { MatmulStage } from './stages/MatmulStage.tsx'
import { layoutKernel, type LayoutState } from '@engine/kernels/layout.ts'
import { LayoutStage } from './stages/LayoutStage.tsx'
import { tensorparKernel, type TensorParState } from '@engine/kernels/tensorpar.ts'
import { TensorParStage } from './stages/TensorParStage.tsx'
import { collectiveKernel, type CollectiveState } from '@engine/kernels/collective.ts'
import { CollectiveStage } from './stages/CollectiveStage.tsx'
import { chunkprefillKernel, type ChunkPrefillState } from '@engine/kernels/chunkprefill.ts'
import { ChunkPrefillStage } from './stages/ChunkPrefillStage.tsx'
import { kvoffloadKernel, type KvOffloadState } from '@engine/kernels/kvoffload.ts'
import { KvOffloadStage } from './stages/KvOffloadStage.tsx'
import { engineKernel, type EngineState } from '@engine/kernels/engine.ts'
import { EngineStage } from './stages/EngineStage.tsx'
import { scaleKernel, type ScaleState } from '@engine/kernels/scale.ts'
import { ScaleStage } from './stages/ScaleStage.tsx'
import { orthoKernel, type OrthoState } from '@engine/kernels/ortho.ts'
import { OrthoStage } from './stages/OrthoStage.tsx'
import { hopfieldKernel, type HopfieldState } from '@engine/kernels/hopfield.ts'
import { HopfieldStage } from './stages/HopfieldStage.tsx'
import { llnKernel, type LlnState } from '@engine/kernels/lln.ts'
import { LlnStage } from './stages/LlnStage.tsx'
import { cltKernel, type CltState } from '@engine/kernels/clt.ts'
import { CltStage } from './stages/CltStage.tsx'
import { xentKernel, type XentState } from '@engine/kernels/xent.ts'
import { XentStage } from './stages/XentStage.tsx'
import { bayesKernel, type BayesState } from '@engine/kernels/bayes.ts'
import { BayesStage } from './stages/BayesStage.tsx'
import { bloomKernel, type BloomState } from '@engine/kernels/bloom.ts'
import { BloomStage } from './stages/BloomStage.tsx'
import { graddescKernel, type GradDescState } from '@engine/kernels/graddesc.ts'
import { GradDescStage } from './stages/GradDescStage.tsx'
import { residualKernel, type ResidualState } from '@engine/kernels/residual.ts'
import { ResidualStage } from './stages/ResidualStage.tsx'
import { inductionKernel, type InductionState } from '@engine/kernels/induction.ts'
import { InductionStage } from './stages/InductionStage.tsx'
import { editdistKernel, type EditDistState } from '@engine/kernels/editdist.ts'
import { EditDistStage } from './stages/EditDistStage.tsx'
import { lowrankKernel, type LowRankState } from '@engine/kernels/lowrank.ts'
import { LowRankStage } from './stages/LowRankStage.tsx'
import { dotsimKernel, type DotSimState } from '@engine/kernels/dotsim.ts'
import { DotSimStage } from './stages/DotSimStage.tsx'
import { greedyKernel, type GreedyState } from '@engine/kernels/greedy.ts'
import { GreedyStage } from './stages/GreedyStage.tsx'
import { jlKernel, type JLState } from '@engine/kernels/jl.ts'
import { JLStage } from './stages/JLStage.tsx'
import { maxentKernel, type MaxEntState } from '@engine/kernels/maxent.ts'
import { MaxEntStage } from './stages/MaxEntStage.tsx'
import { condnumKernel, type CondNumState } from '@engine/kernels/condnum.ts'
import { CondNumStage } from './stages/CondNumStage.tsx'
import { linattnKernel, type LinAttnState } from '@engine/kernels/linattn.ts'
import { LinAttnStage } from './stages/LinAttnStage.tsx'
import { engramKernel, type EngramState } from '@engine/kernels/engram.ts'
import { EngramStage } from './stages/EngramStage.tsx'
import { flashdecodeKernel, type FlashDecodeState } from '@engine/kernels/flashdecode.ts'
import { FlashDecodeStage } from './stages/FlashDecodeStage.tsx'
import { dpattnKernel, type DPAttnState } from '@engine/kernels/dpattn.ts'
import { DPAttnStage } from './stages/DPAttnStage.tsx'
import { epKernel, type EPState } from '@engine/kernels/ep.ts'
import { EPStage } from './stages/EPStage.tsx'
import { ppKernel, type PPState } from '@engine/kernels/pp.ts'
import { PPStage } from './stages/PPStage.tsx'
import { linregKernel, type LinRegState } from '@engine/kernels/linreg.ts'
import { LinRegStage } from './stages/LinRegStage.tsx'
import { convKernel, type ConvState } from '@engine/kernels/conv.ts'
import { ConvStage } from './stages/ConvStage.tsx'
import { binsearchKernel, type BinSearchState } from '@engine/kernels/binsearch.ts'
import { BinSearchStage } from './stages/BinSearchStage.tsx'
import { nqueensKernel, type NQueensState } from '@engine/kernels/nqueens.ts'
import { NQueensStage } from './stages/NQueensStage.tsx'
import { unionfindKernel, type UnionFindState } from '@engine/kernels/unionfind.ts'
import { UnionFindStage } from './stages/UnionFindStage.tsx'
import { heapKernel, type HeapState } from '@engine/kernels/heap.ts'
import { HeapStage } from './stages/HeapStage.tsx'
import { quicksortKernel, type QuickSortState } from '@engine/kernels/quicksort.ts'
import { QuickSortStage } from './stages/QuickSortStage.tsx'
import { mergesortKernel, type MergeSortState } from '@engine/kernels/mergesort.ts'
import { MergeSortStage } from './stages/MergeSortStage.tsx'
import { fastpowKernel, type FastPowState } from '@engine/kernels/fastpow.ts'
import { FastPowStage } from './stages/FastPowStage.tsx'
import { astarKernel, type AStarState } from '@engine/kernels/astar.ts'
import { AStarStage } from './stages/AStarStage.tsx'
import { perceptronKernel, type PerceptronState } from '@engine/kernels/perceptron.ts'
import { PerceptronStage } from './stages/PerceptronStage.tsx'
import { poolingKernel, type PoolState } from '@engine/kernels/pooling.ts'
import { PoolingStage } from './stages/PoolingStage.tsx'
import { beamKernel, type BeamState } from '@engine/kernels/beam.ts'
import { BeamStage } from './stages/BeamStage.tsx'
import { rnnKernel, type RNNState } from '@engine/kernels/rnn.ts'
import { RNNStage } from './stages/RNNStage.tsx'
import { wordvecKernel, type WordVecState } from '@engine/kernels/wordvec.ts'
import { WordVecStage } from './stages/WordVecStage.tsx'
import { lstmKernel, type LSTMState } from '@engine/kernels/lstm.ts'
import { LSTMStage } from './stages/LSTMStage.tsx'
import { normKernel, type NormState } from '@engine/kernels/norm.ts'
import { NormStage } from './stages/NormStage.tsx'
import { ragKernel, type RagState } from '@engine/kernels/rag.ts'
import { RagStage } from './stages/RagStage.tsx'
import { selfconsistKernel, type SelfConsistState } from '@engine/kernels/selfconsist.ts'
import { SelfConsistStage } from './stages/SelfConsistStage.tsx'
import { bestofnKernel, type BestOfNState } from '@engine/kernels/bestofn.ts'
import { BestOfNStage } from './stages/BestOfNStage.tsx'
import { totKernel, type ToTState } from '@engine/kernels/tot.ts'
import { ToTStage } from './stages/ToTStage.tsx'
import { collisionKernel, type CollisionState } from '@engine/kernels/collision.ts'
import { mvccKernel, type MvccState } from '@engine/kernels/mvcc.ts'
import { MvccStage } from './stages/MvccStage.tsx'
import { isoKernel, type IsoState } from '@engine/kernels/iso.ts'
import { IsoStage } from './stages/IsoStage.tsx'
import { casKernel, type CasState } from '@engine/kernels/cas.ts'
import { CasStage } from './stages/CasStage.tsx'
import { mesiKernel, type MesiState } from '@engine/kernels/mesi.ts'
import { MesiStage } from './stages/MesiStage.tsx'
import { deadlockKernel, type DeadlockState } from '@engine/kernels/deadlock.ts'
import { DeadlockStage } from './stages/DeadlockStage.tsx'
import { raftKernel, type RaftState } from '@engine/kernels/raft.ts'
import { RaftStage } from './stages/RaftStage.tsx'
import { caesarKernel, type CaesarState } from '@engine/kernels/caesar.ts'
import { CaesarStage } from './stages/CaesarStage.tsx'
import { vigenereKernel, type VigenereState } from '@engine/kernels/vigenere.ts'
import { VigenereStage } from './stages/VigenereStage.tsx'
import { xorKernel, type XorState } from '@engine/kernels/xorcipher.ts'
import { XorStage } from './stages/XorStage.tsx'
import { modpowKernel, type ModPowState } from '@engine/kernels/modpow.ts'
import { ModPowStage } from './stages/ModPowStage.tsx'
import { dhKernel, type DHState } from '@engine/kernels/diffiehellman.ts'
import { DHStage } from './stages/DHStage.tsx'
import { rsaKernel, type RSAState } from '@engine/kernels/rsa.ts'
import { RSAStage } from './stages/RSAStage.tsx'
import { extgcdKernel, type ExtGcdState } from '@engine/kernels/extgcd.ts'
import { ExtGcdStage } from './stages/ExtGcdStage.tsx'
import { signKernel, type SignState } from '@engine/kernels/signature.ts'
import { SignStage } from './stages/SignStage.tsx'
import { hashavalKernel, type HashAvalState } from '@engine/kernels/hashaval.ts'
import { HashAvalStage } from './stages/HashAvalStage.tsx'
import { merkleKernel, type MerkleState } from '@engine/kernels/merkle.ts'
import { MerkleStage } from './stages/MerkleStage.tsx'
import { CollisionStage } from './stages/CollisionStage.tsx'
import { gcnKernel, type GcnState } from '@engine/kernels/gcn.ts'
import { GcnStage } from './stages/GcnStage.tsx'
import { pagerankKernel, type PageRankState } from '@engine/kernels/pagerank.ts'
import { PageRankStage } from './stages/PageRankStage.tsx'
import { qlearnKernel, type QLearnState } from '@engine/kernels/qlearn.ts'
import { QLearnStage } from './stages/QLearnStage.tsx'
import { recsysKernel, type RecSysState } from '@engine/kernels/recsys.ts'
import { RecSysStage } from './stages/RecSysStage.tsx'
import { diffusionKernel, type DiffusionState } from '@engine/kernels/diffusion.ts'
import { DiffusionStage } from './stages/DiffusionStage.tsx'
import { ganKernel, type GanState } from '@engine/kernels/gan.ts'
import { GanStage } from './stages/GanStage.tsx'
import { mctsKernel, type MctsState } from '@engine/kernels/mcts.ts'
import { MctsStage } from './stages/MctsStage.tsx'
import { backpropKernel, type BackpropState } from '@engine/kernels/backprop.ts'
import { BackpropStage } from './stages/BackpropStage.tsx'
import { logregKernel, type LogRegState } from '@engine/kernels/logreg.ts'
import { LogRegStage } from './stages/LogRegStage.tsx'
import { dtreeKernel, type DTreeState } from '@engine/kernels/dtree.ts'
import { DTreeStage } from './stages/DTreeStage.tsx'
import { gbdtKernel, type GBDTState } from '@engine/kernels/gbdt.ts'
import { GBDTStage } from './stages/GBDTStage.tsx'
import { svmKernel, type SVMState } from '@engine/kernels/svm.ts'
import { SVMStage } from './stages/SVMStage.tsx'
import { pcaKernel, type PCAState } from '@engine/kernels/pca.ts'
import { PCAStage } from './stages/PCAStage.tsx'
import { kmeansKernel, type KMeansState } from '@engine/kernels/kmeans.ts'
import { KMeansStage } from './stages/KMeansStage.tsx'
import { knnKernel, type KNNState } from '@engine/kernels/knn.ts'
import { KNNStage } from './stages/KNNStage.tsx'
import { semaphoreKernel, type SemState } from '@engine/kernels/semaphore.ts'
import { bitmapKernel, type BitmapState } from '@engine/kernels/bitmap.ts'
import { csmaKernel, type CsmaState } from '@engine/kernels/csma.ts'
import { BPlusStage } from './stages/BPlusStage.tsx'
import { TraverseStage } from './stages/TraverseStage.tsx'
import { SemaphoreStage } from './stages/SemaphoreStage.tsx'
import { BitmapStage } from './stages/BitmapStage.tsx'
import { CsmaStage } from './stages/CsmaStage.tsx'
import { mstKernel, type MstState } from '@engine/kernels/mst.ts'
import { topoKernel, type TopoState } from '@engine/kernels/topo.ts'
import { partitionKernel, type PartState } from '@engine/kernels/partition.ts'
import { inodeKernel, maxFileSize, type InodeState } from '@engine/kernels/inode.ts'
import { MstStage } from './stages/MstStage.tsx'
import { TopoStage } from './stages/TopoStage.tsx'
import { PartitionStage } from './stages/PartitionStage.tsx'
import { InodeStage } from './stages/InodeStage.tsx'
import { AvlStage } from './stages/AvlStage.tsx'
import { HashStage } from './stages/HashStage.tsx'
import { HuffmanStage } from './stages/HuffmanStage.tsx'
import { KmpStage } from './stages/KmpStage.tsx'
import { crcKernel, type CrcState } from '@engine/kernels/crc.ts'
import { hammingKernel, type HammingState } from '@engine/kernels/hamming.ts'
import { subnetKernel, type SubnetState } from '@engine/kernels/subnet.ts'
import { handshakeKernel, type HsState } from '@engine/kernels/handshake.ts'
import { CrcStage } from './stages/CrcStage.tsx'
import { HammingStage } from './stages/HammingStage.tsx'
import { SubnetStage } from './stages/SubnetStage.tsx'
import { HandshakeStage } from './stages/HandshakeStage.tsx'
import { floatKernel, type FloatState } from '@engine/kernels/float.ts'
import { pipelineKernel, type PipeState } from '@engine/kernels/pipeline.ts'
import { vmKernel, type VmState } from '@engine/kernels/vm.ts'
import { multiplyKernel, type MulState } from '@engine/kernels/multiply.ts'
import { addsubKernel, type AddSubState } from '@engine/kernels/addsub.ts'
import { AddSubStage } from './stages/AddSubStage.tsx'
import { ADDSUB_PRESETS } from '@engine/presets/sequences.ts'
import { FloatStage } from './stages/FloatStage.tsx'
import { PipelineStage } from './stages/PipelineStage.tsx'
import { VmStage } from './stages/VmStage.tsx'
import { MultiplyStage } from './stages/MultiplyStage.tsx'
import type { AnyExperiment, Experiment } from './types.ts'

const pct = (n: number) => (n * 100).toFixed(1) + '%'
const hex = (n: number) => '0x' + n.toString(16).toUpperCase()

// ═══ Cache ═════════════════════════════════════════════
const cache: Experiment<CacheState> = {
  id: 'cache',
  group: '计算机组成原理',
  title: 'Cache 命中率',
  subtitle: '组相联映射 · 替换策略',
  kernel: cacheKernel,
  defaultDoc: {
    kind: 'cache',
    params: { addressBits: 32, cacheSizeBytes: 256, blockSizeBytes: 16, associativity: 2, replacement: 'LRU' },
    entities: [],
    streams: [{ name: 'accessSequence', values:
      [0x000, 0x010, 0x020, 0x000, 0x110, 0x210, 0x010, 0x020, 0x110, 0x000, 0x030, 0x210] }],
  },
  params: [
    { key: 'cacheSizeBytes', label: 'Cache 容量', kind: 'number', options: [128, 256, 512, 1024], unit: 'B' },
    { key: 'blockSizeBytes', label: '块大小', kind: 'number', options: [8, 16, 32, 64], unit: 'B' },
    { key: 'associativity', label: '相联度', kind: 'number', options: [1, 2, 4, 8], unit: '路' },
    { key: 'replacement', label: '替换策略', kind: 'enum', options: ['LRU', 'FIFO'] },
  ],
  sequence: {
    stream: 'accessSequence',
    label: '访问序列',
    radix: 16,
    chips: true,
    hint: '按字节编址的主存地址',
    maxLength: 40,
    presets: CACHE_PRESETS,
    random: () => Array.from({ length: 12 }, () => Math.floor(Math.random() * 16) * 16),
  },
  //  推演搬右栏、旁栏默认收起 —— 概念图的形态（见 types.ts 的 whyInRail）
  whyInRail: true,
  //  走带格子里写"第几步 + 访问的是哪个地址"；命中/缺失只有两档，柱高表达不了
  tickChip: (s: CacheState) => hex(s.address),
  bounds: [
    /*  每条都带一个短标题（`标题｜正文`，见 Panels.tsx 的 Bounds）——
        用户要"层次感、编号、标题、重要性体现"，标题就是那一层。 */
    '不画数据字节｜每一路只画 **tag** 与它存放的那一块内存。'
      + '命中与否仅由 tag 决定，列出块内十六个字节的值对判断没有帮助。',
    '不画有效位｜本仿真从空 Cache 开始，"尚未装入"直接以虚线槽表示。',
    '不含 TLB｜地址即物理地址，不建模地址转换。',
    '指令与数据共用｜假设指令与数据使用同一个 Cache，不区分 I-Cache / D-Cache。',
    '不建模预取与写分配｜每次访问只查一次，不因写缺失而调块。',
    '只有一级｜多级 Cache 与一致性协议不在本实验范围内。',
  ],
  //  只留主视图。「命中率随相联度」那个柱状图去掉了（用户要求）——
  //  相联度→命中率这件事，主视图 + 现算结论「相联度解决冲突不解决容量」+ 引导图
  //  已经讲了三遍，柱状图是第四遍，冗余。Sweep 组件留在 CacheStage 里没删（无 VCS，
  //  删了找不回），只是不再有页签指向它。
  tabs: [{ id: 'org', label: '地址拆解 + 组织' }],
  Stage: CacheStage,
  tone: s => (s.outcome === 'hit' ? { key: 'good', label: '命中' } : { key: 'bad', label: '缺失' }),
  metric: s => s.hits / (s.i + 1),
  tickLabel: (s, i) => `第 ${i + 1} 次 ${hex(s.address)} · ${s.outcome === 'hit' ? '命中' : '缺失'}`,
  /*
   * 读数只留**舞台上没有的**三个。
   *
   * 砍掉的五条（tag / 组号 index / 块内偏移 offset / 本步结果 / 被挤掉的 tag）
   * 现在逐个都印在舞台上：tag 与 index 在位段图的 cap 上、offset 同理、
   * 本步结果在因果链末端和状态列、被挤掉的 tag 在「本步结果」那条搬运里。
   * 一个数在一屏上出现两次，读者要先确认这两个是不是同一个数才敢往下读。
   *
   * 留下的三个都是**跨步累计**的量 —— 舞台只画当前这一步，累计量它给不出。
   */
  readouts: (s) => [
    { label: '命中', value: String(s.hits), tone: 'good' },
    { label: '缺失', value: String(s.misses), tone: 'bad' },
    { label: '命中率', value: pct(s.hits / (s.i + 1)) },
  ],
}

// ═══ 进程调度 ═══════════════════════════════════════════
const scheduler: Experiment<SchedState> = {
  id: 'scheduler',
  group: '操作系统',
  title: '进程调度甘特图',
  subtitle: '抢占与非抢占 · 时间片',
  kernel: schedKernel,
  defaultDoc: {
    kind: 'scheduler',
    params: { algorithm: 'SRTF', quantum: 2 },
    entities: [
      { id: 'P1', type: 'process', at: 0, attrs: { burst: 7 } },
      { id: 'P2', type: 'process', at: 2, attrs: { burst: 4 } },
      { id: 'P3', type: 'process', at: 4, attrs: { burst: 1 } },
      { id: 'P4', type: 'process', at: 5, attrs: { burst: 4 } },
    ],
    streams: [],
  },
  params: [
    { key: 'algorithm', label: '调度算法', kind: 'enum', options: ['FCFS', 'SJF', 'SRTF', 'RR'] },
    {
      key: 'quantum', label: '时间片', kind: 'number', options: [1, 2, 3, 4],
      //  原来靠 unit 里那句"仅 RR 用"提示 —— 那是一行小字，旋钮照样能拧、拧了没反应
      when: { on: p => String(p.algorithm) === 'RR',
              note: '仅时间片轮转（RR）生效 —— 别的算法不切片' },
    },
  ],
  entitySpec: {
    tables: [{
      type: 'process',
      label: '进程表',
      columns: () => [
        { key: 'id', label: '进程', kind: 'text', width: 62 },
        { key: 'at', label: '到达时刻', kind: 'number', width: 84 },
        { key: 'burst', label: '服务时间', kind: 'number', width: 84 },
      ],
      newRow: i => ({ id: `P${i + 1}`, type: 'process', at: 0, attrs: { burst: 3 } }),
      minRows: 1, maxRows: 8,
    }],
    presets: SCHED_PRESETS,
  },
  bounds: [
    '单 CPU、单核，不考虑多处理器',
    '忽略上下文切换开销与 I/O 阻塞',
    '进程一旦到达就绪即可被调度，无优先级老化',
    'SJF / SRTF 假设运行时间已知（现实中需要预测）',
  ],
  tabs: [{ id: 'gantt', label: '甘特图' }, { id: 'queue', label: '队列状态' }],
  Stage: SchedulerStage,
  tone: s => (s.running === null ? { key: 'idle', label: '空闲' } : { key: 'good', label: '运行' }),
  metric: (s, _i) => {
    const total = Object.keys(s.remaining).length
    return total === 0 ? 0 : s.completed.length / total
  },
  tickLabel: s => `t=${s.t} ${s.running ?? '空闲'}`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => {
    const total = doc.entities.filter(e => e.type === 'process').length
    return [
      { label: '当前时刻', value: `t = ${s.t}` },
      { label: '正在运行', value: s.running ?? '空闲', tone: s.running ? 'good' : undefined },
      { label: '就绪队列', value: s.readyQueue.length ? s.readyQueue.join(' → ') : '空' },
      { label: '已完成', value: `${s.completed.length} / ${total}` },
      { label: '剩余时间', value: Object.entries(s.remaining).filter(([, v]) => v > 0)
          .map(([k, v]) => `${k}:${v}`).join('  ') || '全部完成' },
    ]
  },
}

// ═══ TCP ═══════════════════════════════════════════════
const tcp: Experiment<TcpState> = {
  id: 'tcp',
  group: '计算机网络',
  title: 'TCP 拥塞窗口',
  subtitle: '慢启动 · 拥塞避免 · 快恢复',
  kernel: tcpKernel,
  defaultDoc: {
    kind: 'tcp',
    params: { variant: 'Reno', initialCwnd: 1, initialSsthresh: 16, rounds: 20 },
    entities: [
      { id: 'L1', type: 'loss', at: 8, attrs: { type: 'tripleDup' } },
      { id: 'L2', type: 'loss', at: 13, attrs: { type: 'timeout' } },
    ],
    streams: [],
  },
  params: [
    { key: 'variant', label: '算法版本', kind: 'enum', options: ['Reno', 'Tahoe'] },
    { key: 'initialSsthresh', label: '慢启动门限', kind: 'number', options: [4, 8, 16, 32], unit: 'MSS' },
    { key: 'initialCwnd', label: '初始窗口', kind: 'number', options: [1, 2, 4], unit: 'MSS' },
    { key: 'rounds', label: '模拟轮数', kind: 'number', options: [12, 20, 30], unit: 'RTT' },
  ],
  entitySpec: {
    tables: [{
      type: 'loss',
      label: '丢包事件',
      columns: () => [
        { key: 'id', label: '编号', kind: 'text', width: 58 },
        { key: 'at', label: '第几轮', kind: 'number', width: 74 },
        { key: 'type', label: '事件类型', kind: 'enum',
          options: ['timeout', 'tripleDup'], labels: ['超时', '三次重复 ACK'], width: 116 },
      ],
      newRow: i => ({ id: `L${i + 1}`, type: 'loss', at: 5, attrs: { type: 'timeout' } }),
      minRows: 0, maxRows: 6,
    }],
    presets: TCP_PRESETS,
  },
  bounds: [
    '只建模拥塞控制，不含流量控制（接收窗口）',
    '假设 RTT 恒定，每轮恰好发送一个窗口',
    '丢包事件由题目给定，不做随机丢包建模',
    '未建模 SACK、时间戳选项与延迟确认',
  ],
  tabs: [{ id: 'curve', label: '窗口曲线' }, { id: 'phase', label: '状态机' }],
  Stage: TcpStage,
  tone: s => (s.event === 'none'
    ? { key: 'idle', label: '正常' }
    : { key: 'bad', label: s.event === 'timeout' ? '超时' : '重复ACK' }),
  metric: s => {
    const cap = Math.max(s.ssthresh * 2, 8)
    return Math.min(1, s.cwnd / cap)
  },
  tickLabel: s => `第 ${s.round} 轮 cwnd=${s.cwnd}`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: s => [
    { label: '轮次', value: `${s.round} RTT` },
    { label: 'cwnd', value: `${s.cwnd} MSS` },
    { label: 'ssthresh', value: `${s.ssthresh} MSS` },
    { label: '所处阶段', value: { slowStart: '慢启动', congestionAvoidance: '拥塞避免', fastRecovery: '快恢复' }[s.phase] },
    { label: '本轮事件', value: s.event === 'none' ? '无' : s.event === 'timeout' ? '超时' : '三次重复 ACK',
      tone: s.event === 'none' ? undefined : 'bad' },
  ],
}

// ═══ 页面置换 ═══════════════════════════════════════════
const page: Experiment<PageState> = {
  id: 'page',
  group: '操作系统',
  title: '页面置换',
  subtitle: 'FIFO · LRU · OPT · CLOCK',
  kernel: pageKernel,
  defaultDoc: {
    kind: 'page',
    params: { algorithm: 'FIFO', frames: 3 },
    entities: [],
    streams: [{ name: 'referenceString', values: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5] }],
  },
  params: [
    { key: 'algorithm', label: '置换算法', kind: 'enum', options: ['FIFO', 'LRU', 'OPT', 'CLOCK'] },
    { key: 'frames', label: '物理块数', kind: 'number', options: [2, 3, 4, 5], unit: '块' },
  ],
  sequence: {
    chips: true,
    stream: 'referenceString',
    label: '页面引用串',
    hint: '页号序列',
    maxLength: 40,
    presets: PAGE_PRESETS,
    random: () => Array.from({ length: 14 }, () => 1 + Math.floor(Math.random() * 6)),
  },
  bounds: [
    '只建模页面置换，不含 TLB 与多级页表',
    '所有页面大小相同，不考虑大页',
    '不区分读/写，无脏位与写回开销',
    'OPT 需要预知未来引用串，现实中不可实现，仅作为理论下界',
  ],
  tabs: [{ id: 'table', label: '置换表' }, { id: 'frames', label: '物理块' }],
  Stage: PageStage,
  tone: s => (s.outcome === 'hit' ? { key: 'good', label: '命中' } : { key: 'bad', label: '缺页' }),
  metric: s => s.hits / (s.i + 1),
  tickLabel: (s, i) => `第 ${i + 1} 次 访问页 ${s.page} · ${s.outcome === 'hit' ? '命中' : '缺页'}`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  tickChip: (s: PageState) => `页 ${s.page}`,
  readouts: s => [
    { label: '缺页次数', value: String(s.faults), tone: 'bad' },
    { label: '命中次数', value: String(s.hits), tone: 'good' },
    { label: '缺页率', value: pct(s.faults / (s.i + 1)) },
    { label: '本步访问页', value: String(s.page) },
    { label: '本步结果', value: s.outcome === 'hit' ? '命中' : '缺页', tone: s.outcome === 'hit' ? 'good' : 'bad' },
    { label: '换出页', value: s.evictedPage === null ? '—' : String(s.evictedPage),
      tone: s.evictedPage === null ? undefined : 'bad' },
  ],
}

// ═══ 磁盘调度 ═══════════════════════════════════════════
const disk: Experiment<DiskState> = {
  id: 'disk',
  group: '操作系统',
  title: '磁盘调度',
  subtitle: '寻道算法与磁头轨迹',
  kernel: diskKernel,
  defaultDoc: {
    kind: 'disk',
    params: { algorithm: 'SSTF', headStart: 53, maxTrack: 199, direction: 1 },
    entities: [],
    streams: [{ name: 'requests', values: [98, 183, 37, 122, 14, 124, 65, 67] }],
  },
  params: [
    { key: 'algorithm', label: '调度算法', kind: 'enum', options: ['FCFS', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK'] },
    { key: 'headStart', label: '磁头初始位置', kind: 'number', options: [0, 53, 100, 150], unit: '号磁道' },
    {
      key: 'direction', label: '初始方向', kind: 'number', options: [1, -1],
      //  `bounds` 里早就写着"只对 SCAN 系生效"，但界面照样让人拧 —— 拧了没反应，
      //  用户只会以为是自己看错了。条件写进参数本身，界面才不会骗人。
      when: { on: p => ['SCAN', 'C-SCAN', 'LOOK'].includes(String(p.algorithm)),
              note: '仅 SCAN / C-SCAN / LOOK 生效 —— FCFS 与 SSTF 没有方向概念' },
      //  别把内部编码印在按钮上
      optionLabel: (v: number) => (v > 0 ? '↑ 向大磁道' : '↓ 向小磁道'),
    },
  ],
  sequence: {
    chips: true,
    stream: 'requests',
    label: '请求队列',
    hint: '磁道号，须在 0..最大磁道 之间',
    maxLength: 20,
    presets: DISK_PRESETS,
    random: () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 200)),
  },
  bounds: [
    '只计寻道距离，不含旋转延迟与传输时间',
    'SSTF 这里只能演示"远端请求被一直推后"；严格意义的饥饿要靠**新请求不断到达**才成立，本仿真的队列是固定的',
    '假设请求队列在调度开始时已全部到达，中途不新增',
    '不考虑磁头加速/减速，移动一个磁道计一个单位',
    'FCFS 与 SSTF 无方向概念，"初始方向"只对 SCAN 系生效',
  ],
  tabs: [{ id: 'path', label: '磁头轨迹' }, { id: 'queue', label: '本步状态' }],
  Stage: DiskStage,
  tone: s => (s.sweep ? { key: 'bad', label: '空跑' } : { key: 'good', label: '服务' }),
  /*  柱高 = 本步寻道距离 ÷ 最大磁道号。
      原来是 `moved / (累计寻道/3)` —— 分母随跑动变大，同样的距离早期柱高后期柱矮，
      跨步不可比。分母换成 doc 里的 maxTrack（一次实验里不变），柱子之间才有可比性。 */
  metric: (s, _i, doc) => {
    const max = Math.max(1, Number(doc.params.maxTrack) || 199)
    return Math.min(1, s.moved / max)
  },
  tickLabel: s => `第 ${s.i + 1} 个：${s.from} → ${s.head}，移动 ${s.moved}`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: s => [
    { label: '磁头位置', value: String(s.head) },
    { label: '本步移动', value: `${s.from} → ${s.head}` },
    { label: '本步距离', value: String(s.moved), tone: s.sweep ? 'bad' : undefined },
    { label: '累计寻道', value: String(s.total) },
    { label: '扫描方向', value: s.dir === 0 ? '不适用' : s.dir > 0 ? '↑ 向大磁道' : '↓ 向小磁道' },
    { label: '剩余请求', value: s.pending.length ? String(s.pending.length) + ' 个' : '全部完成' },
  ],
}

// ═══ 排序逐趟 ═══════════════════════════════════════════
const sort: Experiment<SortState> = {
  id: 'sort',
  group: '数据结构',
  title: '排序逐趟',
  subtitle: '七种算法 · 每一趟都摊开',
  kernel: sortKernel,
  defaultDoc: {
    kind: 'sort',
    params: { algorithm: '快速' },
    entities: [],
    streams: [{ name: 'array', values: [49, 38, 65, 97, 76, 13, 27, 49] }],
  },
  params: [
    { key: 'algorithm', label: '排序算法', kind: 'enum',
      options: ['直接插入', '希尔', '冒泡', '简单选择', '快速', '堆', '归并'] },
  ],
  sequence: {
    stream: 'array',
    label: '待排序数组',
    hint: '整数，2~24 个',
    maxLength: 24,
    presets: SORT_PRESETS,
    random: () => Array.from({ length: 8 }, () => 1 + Math.floor(Math.random() * 99)),
  },
  bounds: [
    '快排取区间第一个元素作基准（挖坑法）；换基准选法结果会不同',
    '希尔用 n/2 逐次减半的增量序列；换增量序列趟数与结果都会变',
    '归并为自底向上的二路归并，与递归写法的中间态不同、末态相同',
    '只统计比较与移动次数，不建模缓存局部性等实际性能因素',
  ],
  tabs: [{ id: 'array', label: '数组状态' }, { id: 'passes', label: '逐趟结果' }],
  Stage: SortStage,
  tone: s => (s.passEnd
    ? { key: 'good', label: '一趟结束' }
    : s.changed.length ? { key: 'bad', label: '移动' } : { key: 'idle', label: '比较' }),
  //  轴上的量：已定最终位置的比例 —— 这才是"排序进度"的诚实度量
  metric: s => (s.arr.length ? s.settled.length / s.arr.length : 0),
  tickLabel: s => `第 ${s.pass || '-'} 趟 · ${s.passEnd ? '趟末' : `比较${s.comparisons}`}`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: s => [
    { label: '当前趟次', value: s.pass ? `第 ${s.pass} 趟` : '—' },
    { label: '比较次数', value: String(s.comparisons) },
    { label: '移动次数', value: String(s.moves) },
    { label: '已定位', value: `${s.settled.length} / ${s.arr.length}` },
    { label: '局部有序', value: s.sorted.length ? `${s.sorted.length} 个下标` : '—' },
    { label: '手持值', value: s.held === null ? '—' : String(s.held) },
  ],
}

// ═══ Dijkstra ═════════════════════════════════════════
const dijkstra: Experiment<DijkstraState> = {
  id: 'dijkstra',
  group: '数据结构',
  title: 'Dijkstra 最短路',
  subtitle: '逐步松弛 · 最短路径树',
  kernel: dijkstraKernel,
  defaultDoc: {
    kind: 'dijkstra',
    params: { source: 'A', directed: 0 },
    entities: [
      ...NODES,
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
  },
  params: [
    { key: 'source', label: '源点', kind: 'enum', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
    { key: 'directed', label: '图的类型', kind: 'number', options: [0, 1], unit: '0 无向 / 1 有向' },
  ],
  entitySpec: {
    tables: [{
      type: 'edge',
      label: '边表',
      //  只开放边（端点 + 权）。顶点固定 A–G：顶点坐标是布局信息，
      //  让学生填 x/y 既没有教学价值，也容易把图画乱。
      columns: doc => {
        const ids = doc.entities.filter(e => e.type === 'node').map(e => e.id)
        return [
          { key: 'from', label: '起点', kind: 'enum', options: ids, width: 64 },
          { key: 'to', label: '终点', kind: 'enum', options: ids, width: 64 },
          { key: 'w', label: '权值', kind: 'number', width: 70 },
        ]
      },
      newRow: (i, doc) => {
        const ids = doc.entities.filter(e => e.type === 'node').map(e => e.id)
        return { id: `E${i + 1}`, type: 'edge', attrs: { from: ids[0], to: ids[1] ?? ids[0], w: 1 } }
      },
      minRows: 1, maxRows: 16, chunk: 6,
    }],
    presets: DIJKSTRA_PRESETS,
  },
  bounds: [
    'Dijkstra 要求边权非负；含负权边请改用 Bellman-Ford',
    '顶点固定为 A–G（坐标是布局信息，不开放编辑）；可增删的是边',
    '每轮选点为线性扫描（O(V²)），不是堆优化版；结果相同，步数展示不同',
    '同距离时按顶点名字典序选点 —— 教材若约定别的顺序，中间过程会不同、最短距离相同',
    '不处理重边与自环',
  ],
  tabs: [{ id: 'graph', label: '图' }, { id: 'table', label: '逐轮距离表' }],
  Stage: DijkstraStage,
  tone: s => (s.act === 'pick'
    ? { key: 'good', label: '确定' }
    : s.improved ? { key: 'bad', label: '更新' } : { key: 'idle', label: '不更新' }),
  metric: s => {
    const n = Object.keys(s.dist).length
    return n ? s.settled.length / n : 0
  },
  tickLabel: s => (s.act === 'pick' ? `确定 ${s.at}` : s.act === 'done' ? '结束' : `${s.at}→${s.to}`),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => {
    const n = doc.entities.filter(e => e.type === 'node').length
    return [
      { label: '已确定', value: `${s.settled.length} / ${n}` },
      { label: '确定顺序', value: s.settled.join(' → ') || '—' },
      { label: '本步动作', value: { pick: '选点', relax: '松弛', skip: '跳过', done: '结束' }[s.act] },
      { label: '涉及边', value: s.to ? `${s.at} → ${s.to}` : s.at || '—' },
      { label: '是否更新', value: s.improved ? '是' : '否', tone: s.improved ? 'bad' : undefined },
      { label: '当前距离', value: Object.entries(s.dist)
          .map(([k, v]) => `${k}:${v === Infinity ? '∞' : v}`).join('  ') },
    ]
  },
}

// ═══ 银行家算法 ═════════════════════════════════════════
const banker: Experiment<BankerState> = {
  id: 'banker',
  group: '操作系统',
  title: '银行家算法',
  subtitle: '安全序列推演 · 死锁避免',
  kernel: bankerKernel,
  defaultDoc: {
    kind: 'banker',
    params: { resources: 'A,B,C' },
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
    streams: [],
  },
  //  这个实验的自由度在实体（各进程的 Max/Allocation），不在标量参数，
  //  所以参数面板故意留空 —— 不为了凑一栏而造假参数。
  params: [],
  paramsNote: '本实验的自由度在下面的资源矩阵里（各资源总量、各进程的 Max / Allocation），'
    + '不是标量参数，所以这里没有可调项。',
  entitySpec: {
    tables: [
      {
        type: 'resource',
        label: '资源总量',
        hint: '资源类别由参数 resources 决定，不在这里增删',
        columns: () => [
          { key: 'id', label: '资源', kind: 'text', width: 58 },
          { key: 'total', label: '系统总量', kind: 'number', width: 84 },
        ],
        newRow: i => ({ id: String.fromCharCode(65 + i), type: 'resource', attrs: { total: 1 } }),
        fixedRows: true,
      },
      {
        type: 'process',
        label: '进程需求',
        hint: 'Need = Max − Allocation，由这两栏算出来',
        //  列数取决于有几类资源 —— 这就是 columns 做成函数的原因
        columns: doc => {
          const res = String(doc.params.resources).split(',').map(x => x.trim()).filter(Boolean)
          return [
            { key: 'id', label: '进程', kind: 'text', width: 58 },
            ...res.map(r => ({ key: `max_${r}`, label: `Max ${r}`, kind: 'number' as const, width: 66 })),
            ...res.map(r => ({ key: `alloc_${r}`, label: `已分配 ${r}`, kind: 'number' as const, width: 74 })),
          ]
        },
        newRow: (i, doc) => {
          const res = String(doc.params.resources).split(',').map(x => x.trim()).filter(Boolean)
          const attrs: Record<string, number> = {}
          for (const r of res) { attrs[`max_${r}`] = 1; attrs[`alloc_${r}`] = 0 }
          return { id: `P${i}`, type: 'process', attrs }
        },
        minRows: 1, maxRows: 8,
      },
    ],
    presets: BANKER_PRESETS,
  },
  bounds: [
    '只做安全性检查，不含"某进程请求资源是否批准"的试分配环节',
    '按进程登记顺序线性扫描找可满足者；换扫描顺序可能得到另一个安全序列',
    '安全序列通常不唯一，本实验只给出找到的第一个',
    '"不安全"不等于"已死锁"，只是存在进入死锁的可能',
  ],
  tabs: [{ id: 'matrix', label: '资源矩阵' }, { id: 'search', label: '安全性检查' }],
  Stage: BankerStage,
  tone: s => ({
    init: { key: 'idle', label: '初始' }, try: { key: 'good', label: '归还' },
    accept: { key: 'good', label: '可满足' }, reject: { key: 'bad', label: '资源不足' },
    safe: { key: 'good', label: '安全' }, unsafe: { key: 'bad', label: '不安全' },
  } as const)[s.act],
  metric: s => {
    const n = Object.keys(s.finish).length
    return n ? s.sequence.length / n : 0
  },
  tickLabel: s => (s.pid ? `试 ${s.pid}` : s.act === 'safe' ? '安全' : s.act === 'unsafe' ? '不安全' : '初始'),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => {
    const res = String(doc.params.resources).split(',').map(x => x.trim())
    const n = doc.entities.filter(e => e.type === 'process').length
    return [
      { label: 'Work', value: `(${res.map(r => s.work[r] ?? 0).join(' ')})` },
      { label: '已入序列', value: `${s.sequence.length} / ${n}` },
      { label: '安全序列', value: s.sequence.join(' → ') || '—' },
      { label: '本步试探', value: s.pid || '—' },
      { label: '本步结论', value: { init: '初始化', try: '归还资源', accept: '可满足',
        reject: '资源不足，跳过', safe: '系统安全', unsafe: '系统不安全' }[s.act],
        tone: s.act === 'reject' || s.act === 'unsafe' ? 'bad' : s.act === 'safe' ? 'good' : undefined },
    ]
  },
}

// ═══ 滑动窗口 ARQ ═══════════════════════════════════════
const arq: Experiment<ArqState> = {
  id: 'arq',
  group: '计算机网络',
  title: '滑动窗口 ARQ',
  subtitle: '停止等待 · 后退N帧 · 选择重传',
  kernel: arqKernel,
  defaultDoc: {
    kind: 'arq',
    params: { protocol: 'GBN', windowSize: 4, totalFrames: 8, delay: 2, timeout: 8 },
    entities: [
      { id: 'L1', type: 'loss', attrs: { target: 'frame', seq: 2, nth: 1 } },
    ],
    streams: [],
  },
  params: [
    {
      key: 'protocol', label: '协议', kind: 'enum', options: ['GBN', 'SR', 'SW'],
      /*  停止等待的窗口按定义就是 1 —— 不是"建议 1"。
          不联动的话，默认窗口 4 会让人一按 SW 就撞
          「配置不合法 · 停止等待的窗口只能是 1」，整屏只剩一行错误。 */
      syncs: v => (v === 'SW' ? { windowSize: 1 } : null),
    },
    {
      key: 'windowSize', label: '发送窗口', kind: 'number', options: [1, 2, 4, 6], unit: '帧',
      when: { on: q => q.protocol !== 'SW', note: '停止等待没有窗口可调 —— 按定义就是 1' },
    },
    { key: 'totalFrames', label: '总帧数', kind: 'number', options: [6, 8, 12], unit: '帧' },
    { key: 'delay', label: '单程时延', kind: 'number', options: [1, 2, 3], unit: '时隙' },
    { key: 'timeout', label: '超时', kind: 'number', options: [6, 8, 12], unit: '时隙' },
  ],
  entitySpec: {
    tables: [{
      type: 'loss',
      label: '丢包事件',
      hint: '第 nth 次传输该序号时丢失，重传能过去',
      columns: () => [
        { key: 'id', label: '编号', kind: 'text', width: 56 },
        { key: 'target', label: '丢什么', kind: 'enum',
          options: ['frame', 'ack'], labels: ['数据帧', 'ACK'], width: 88 },
        { key: 'seq', label: '序号', kind: 'number', width: 64 },
        { key: 'nth', label: '第几次传输', kind: 'number', width: 92 },
      ],
      newRow: i => ({ id: `L${i + 1}`, type: 'loss', attrs: { target: 'frame', seq: 0, nth: 1 } }),
      minRows: 0, maxRows: 6,
    }],
    presets: ARQ_PRESETS,
  },
  bounds: [
    '序号不做回绕（不取模），所以看不到"窗口上限 2ⁿ−1"这一考点',
    '信道保序、不重排，每时隙至多发一个新帧',
    '丢包由题目指定第几次传输丢失，不做随机丢包',
    '接收方立即确认，未建模捎带确认与延迟确认',
    'SW 即窗口为 1 的 GBN，不单独实现',
  ],
  tabs: [{ id: 'timeline', label: '时空图' }, { id: 'window', label: '窗口状态' }],
  Stage: ArqStage,
  tone: s => ({
    send: { key: 'good', label: '发送' }, resend: { key: 'bad', label: '重传' },
    recv: { key: 'good', label: '收到' }, ack: { key: 'good', label: '确认' },
    drop: { key: 'bad', label: '丢失' }, timeout: { key: 'bad', label: '超时重传' },
    idle: { key: 'idle', label: '等待' }, done: { key: 'good', label: '完成' },
  } as const)[s.event],
  metric: (s, _i) => {
    const total = Object.keys(s.sent).filter(k => k.startsWith('f')).length
    return total ? s.delivered / Math.max(total, s.delivered) : 0
  },
  tickLabel: s => `t=${s.i} ${ { send: '发送', resend: '重传', recv: '收到', ack: 'ACK',
    drop: '丢失', timeout: '超时', idle: '等待', done: '完成' }[s.event] }`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => {
    const total = doc.params.totalFrames as number
    return [
      { label: '已交付', value: `${s.delivered} / ${total}` },
      { label: '发送窗口', value: `[${s.base}, ${s.next - 1}]` },
      { label: '接收方期待', value: String(s.expected) },
      { label: '信道在途', value: s.inFlight.length
          ? s.inFlight.map(f => `${f.kind === 'frame' ? '帧' : 'ACK'} ${f.seq}`).join(' ') : '空' },
      { label: '累计传输', value: String(s.transmissions) },
      { label: '其中重传', value: String(Math.max(0, s.transmissions - total)),
        tone: s.transmissions > total ? 'bad' : undefined },
    ]
  },
}

// ═══ IEEE 754 浮点 ═════════════════════════════════════
const float: Experiment<FloatState> = {
  id: 'float',
  group: '计算机组成原理',
  title: 'IEEE 754 浮点',
  subtitle: '编码七步 · 加减四步',
  kernel: floatKernel,
  defaultDoc: {
    kind: 'float',
    params: { format: 'single', operation: 'encode' },
    entities: [],
    streams: [{ name: 'operands', values: [-12.5] }],
  },
  params: [
    { key: 'format', label: '精度', kind: 'enum', options: ['single', 'double'] },
    { key: 'operation', label: '做什么', kind: 'enum', options: ['encode', 'add', 'sub'] },
  ],
  sequence: {
    stream: 'operands', label: '操作数',
    //  这一行不是装饰：提示语说了收小数和负号，解析器就得真收（见 types.ts 的 `value`）
    value: 'real',
    hint: '编码填 1 个；加减填 2 个（可含小数与负号）',
    maxLength: 2, presets: FLOAT_PRESETS,
  },
  bounds: [
    '只建模规格化数；非规格化数、无穷、NaN 不在范围内',
    '舍入固定为 IEEE 754 默认的「就近舍入、中间值取偶」',
    '加减法保留 3 位保护位后舍入，与硬件的实际位宽可能不同',
    '不建模运算过程中的上溢/下溢中断',
  ],
  tabs: [{ id: 'bits', label: '位域拆解' }, { id: 'steps', label: '推导链' }],
  Stage: FloatStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '完成' }
    : s.phase === 'round' || s.phase === 'mantissa' ? { key: 'bad', label: '舍入' }
    : { key: 'idle', label: '推导' }),
  metric: s => (s.bits.length ? s.bits.split('').filter(b => b !== '?').length / s.bits.length : 0),
  tickLabel: s => s.phase,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => [
    { label: '精度', value: doc.params.format === 'double' ? '双精度 64 位' : '单精度 32 位' },
    { label: '本步', value: s.phase },
    { label: '已确定位', value: `${s.bits.split('').filter(b => b !== '?').length} / ${s.bits.length}` },
    ...Object.entries(s.detail).slice(0, 4).map(([k, v]) => ({ label: k, value: v.slice(0, 28) })),
  ],
}

// ═══ 流水线 ════════════════════════════════════════════
const pipeline: Experiment<PipeState> = {
  id: 'pipeline',
  group: '计算机组成原理',
  title: '指令流水线',
  subtitle: '数据冒险 · 前递 · 分支冲刷',
  kernel: pipelineKernel,
  defaultDoc: {
    kind: 'pipeline',
    params: { forwarding: 0 },
    entities: PIPE_PRESETS[1].entities,
  streams: [],
  },
  params: [
    { key: 'forwarding', label: '数据前递', kind: 'number', options: [0, 1], unit: '0 关 / 1 开' },
  ],
  entitySpec: {
    tables: [{
      type: 'inst',
      label: '指令序列',
      hint: 'rd 是写入的寄存器，rs / rt 是读取的',
      columns: () => [
        { key: 'id', label: '编号', kind: 'text', width: 56 },
        { key: 'op', label: '操作', kind: 'enum',
          options: ['add', 'sub', 'and', 'or', 'lw', 'sw', 'beq', 'bne'], width: 78 },
        { key: 'rd', label: 'rd 写', kind: 'text', width: 62 },
        { key: 'rs', label: 'rs 读', kind: 'text', width: 62 },
        { key: 'rt', label: 'rt 读', kind: 'text', width: 62 },
        { key: 'taken', label: '分支跳转', kind: 'number', width: 78 },
      ],
      newRow: i => ({
        id: `I${i + 1}`, type: 'inst',
        attrs: { op: 'add', rd: `R${i + 1}`, rs: 'R0', rt: 'R0', taken: 0 },
      }),
      minRows: 1, maxRows: 10,
    }],
    presets: PIPE_PRESETS,
  },
  bounds: [
    '假设指令与数据存储分离，不建模结构冒险',
    '寄存器堆「前半周期写、后半周期读」—— 所以生产者进 WB 那一拍消费者就能读到',
    '分支在 EX 段判定，不建模分支预测与延迟槽',
    '只建模 RAW，不建模 WAR / WAW（顺序单发射流水线里不会出现）',
  ],
  tabs: [{ id: 'chart', label: '时空图' }, { id: 'now', label: '本周期' }],
  Stage: PipelineStage,
  tone: s => (s.flushed.length ? { key: 'bad', label: '冲刷' }
    : s.stalled.length ? { key: 'bad', label: '气泡' }
    : Object.keys(s.forwards).length ? { key: 'good', label: '前递' }
    : { key: 'idle', label: '推进' }),
  metric: (s, _i) => {
    const total = Object.keys(s.at).length
    return total ? s.done / total : 0
  },
  tickLabel: s => `第 ${s.cycle} 周期`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => {
    const n = doc.entities.filter(e => e.type === 'inst').length
    return [
      { label: '周期', value: String(s.cycle) },
      { label: '已完成', value: `${s.done} / ${n}` },
      { label: '本周期停顿', value: s.stalled.join('、') || '无',
        tone: s.stalled.length ? 'bad' : undefined },
      { label: '本周期前递', value: Object.keys(s.forwards).join('、') || '无',
        tone: Object.keys(s.forwards).length ? 'good' : undefined },
      { label: '本周期冲刷', value: s.flushed.join('、') || '无',
        tone: s.flushed.length ? 'bad' : undefined },
      { label: '前递开关', value: doc.params.forwarding === 1 ? '已开启' : '已关闭' },
    ]
  },
}

// ═══ 虚存 + TLB ════════════════════════════════════════
const vm: Experiment<VmState> = {
  id: 'vm',
  group: '计算机组成原理',
  title: '虚地址转换与 TLB',
  subtitle: '拆地址 · 查 TLB · 查页表',
  kernel: vmKernel,
  defaultDoc: {
    kind: 'vm',
    params: { virtualBits: 16, pageSizeBytes: 4096, tlbEntries: 4 },
    entities: VM_PRESETS[0].entities,
    streams: [{ name: 'virtualAddresses', values: VM_PRESETS_SEQ[0].values }],
  },
  params: [
    { key: 'pageSizeBytes', label: '页大小', kind: 'number', options: [1024, 2048, 4096], unit: 'B' },
    { key: 'tlbEntries', label: 'TLB 项数', kind: 'number', options: [1, 2, 4, 8], unit: '项' },
    { key: 'virtualBits', label: '虚地址位数', kind: 'number', options: [12, 16], unit: '位' },
  ],
  sequence: {
    chips: true,
    stream: 'virtualAddresses', label: '访问的虚拟地址',
    radix: 16, hint: '十六进制', maxLength: 20, presets: VM_PRESETS_SEQ,
  },
  entitySpec: {
    tables: [{
      type: 'pte',
      label: '页表',
      hint: '页号就是这一行的 id；有效位 0 表示不在内存',
      columns: () => [
        { key: 'id', label: '页号', kind: 'text', width: 58 },
        { key: 'frame', label: '页框号', kind: 'number', width: 72 },
        { key: 'valid', label: '有效位', kind: 'number', width: 66 },
      ],
      newRow: i => ({ id: String(i), type: 'pte', attrs: { frame: 0, valid: 1 } }),
      minRows: 1, maxRows: 16, chunk: 8,
    }],
    presets: VM_PRESETS,
  },
  bounds: [
    '单级页表，不建模多级页表与页目录',
    'TLB 为全相联、LRU 替换；组相联 TLB 不在范围内',
    '不建模写回、脏位与访问位',
    '缺页只标记出来，不模拟换页的具体过程（那是页面置换实验的事）',
  ],
  tabs: [{ id: 'chain', label: '转换链' }, { id: 'tables', label: 'TLB 与页表' }],
  Stage: VmStage,
  tone: s => (s.outcome === 'tlbHit' ? { key: 'good', label: 'TLB 命中' }
    : s.outcome === 'ptHit' ? { key: 'idle', label: '查页表' }
    : { key: 'bad', label: '缺页' }),
  metric: s => s.tlbHits / (s.i + 1),
  tickLabel: (s, i) => `第 ${i + 1} 次 0x${s.vaddr.toString(16).toUpperCase()}`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  tickChip: (s: VmState) => '0x' + s.vaddr.toString(16).toUpperCase(),
  readouts: s => [
    { label: 'TLB 命中', value: String(s.tlbHits), tone: 'good' },
    { label: '查页表', value: String(s.ptHits) },
    { label: '缺页', value: String(s.faults), tone: 'bad' },
    { label: '虚页号', value: String(s.vpn) },
    { label: '页内偏移', value: String(s.offset) },
    { label: '物理地址', value: s.paddr === null ? '缺页' : '0x' + s.paddr.toString(16).toUpperCase(),
      tone: s.paddr === null ? 'bad' : undefined },
  ],
}

// ═══ 定点乘除 ══════════════════════════════════════════
const multiply: Experiment<MulState> = {
  id: 'multiply',
  group: '计算机组成原理',
  title: '定点乘除逐步',
  subtitle: '原码一位乘 · Booth · 加减交替',
  kernel: multiplyKernel,
  defaultDoc: {
    kind: 'multiply',
    params: { algorithm: 'Booth', bits: 8 },
    entities: [],
    streams: [{ name: 'operands', values: [5, 3] }],
  },
  params: [
    { key: 'algorithm', label: '算法', kind: 'enum', options: ['原码一位乘', 'Booth', '加减交替'] },
    { key: 'bits', label: '位数', kind: 'number', options: [4, 8], unit: '位' },
  ],
  sequence: {
    stream: 'operands', label: '操作数',
    hint: '两个数：乘法是 被乘数 乘数；除法是 被除数 除数',
    maxLength: 2, presets: MUL_PRESETS,
  },
  bounds: [
    '一位乘/一位除，不建模两位乘、阵列乘法器',
    '加减交替法按「符号单独算、数值部分用绝对值」的形式做，与直接补码除法的中间步骤不同',
    '乘积取低 2n 位，不判溢出',
    '除法要求商能装进 n 位；被除数远大于除数时结果无意义',
  ],
  tabs: [{ id: 'regs', label: '寄存器' }, { id: 'table', label: '逐轮表' }],
  Stage: MultiplyStage,
  tone: s => (s.act === 'add' || s.act === 'sub' ? { key: 'good', label: '加减' }
    : s.act === 'shift' ? { key: 'idle', label: '移位' }
    : s.act === 'none' ? { key: 'idle', label: '不动' }
    : { key: 'good', label: '完成' }),
  metric: (s, _i) => {
    const b = s.hi.length
    return b ? Math.min(1, s.round / b) : 0
  },
  tickLabel: s => `第 ${s.round} 轮 ${s.act}`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => [
    { label: '算法', value: String(doc.params.algorithm) },
    { label: '轮次', value: `${s.round} / ${doc.params.bits}` },
    { label: '本步动作', value: s.act },
    { label: '判断位', value: s.judge || '—' },
    ...(s.q !== null
      ? [{ label: '商 / 余数', value: `${s.q} / ${s.rem}` }]
      : [{ label: '部分积', value: s.hi }]),
  ],
}

// ═══ 补码定点加减 ══════════════════════════════════════
const addsub: Experiment<AddSubState> = {
  id: 'addsub',
  group: '计算机组成原理',
  title: '补码定点加减',
  subtitle: '符号位一起算 · 溢出判定',
  kernel: addsubKernel,
  defaultDoc: {
    kind: 'addsub', params: { operation: '加', bits: 8 }, entities: [],
    streams: [{ name: 'operands', values: [45, 38] }],
  },
  params: [
    { key: 'operation', label: '运算', kind: 'enum', options: ['加', '减'] },
    { key: 'bits', label: '位数', kind: 'number', options: [4, 8], unit: '位' },
  ],
  sequence: {
    stream: 'operands', label: '操作数 A B', hint: '两个十进制整数，可正可负',
    maxLength: 2, presets: ADDSUB_PRESETS,
  },
  bounds: [
    '定点整数补码；不做小数点定标、不做浮点',
    '溢出用「双进位异或」判定（进入符号位的进位 ⊕ 移出符号位的进位）—— 与「双符号位」判法等价',
    '溢出后仍给出机器数，但会明确标注该值无效',
    '位数只给 4 / 8 两档；操作数超出该位数范围会先被截断到补码',
  ],
  tabs: [{ id: 'cols', label: '竖式' }, { id: 'overflow', label: '溢出判定' }],
  Stage: AddSubStage,
  tone: s => (s.act === 'done'
    ? (s.overflow ? { key: 'bad', label: '溢出' } : { key: 'good', label: '完成' })
    : s.act === 'overflow' ? (s.overflow ? { key: 'bad', label: '溢出' } : { key: 'good', label: '无溢出' })
    : s.act === 'negate' ? { key: 'idle', label: '求补' }
    : s.act === 'addbit' ? { key: 'good', label: `第 ${s.bits - s.pos} 列` }
    : { key: 'idle', label: '取补码' }),
  metric: s => (s.pos >= 0 ? (s.bits - s.pos) / s.bits : s.act === 'setup' ? 0 : 1),
  tickLabel: s => (s.act === 'addbit' ? `列${s.bits - s.pos}` : s.act === 'done' ? '毕' : s.act === 'overflow' ? '溢?' : s.act),
  whyInRail: true,
  readouts: (s, doc) => [
    { label: '运算', value: `${s.aVal} ${s.op === 'sub' ? '−' : '+'} ${s.bVal}` },
    { label: '位数', value: `${doc.params.bits} 位` },
    { label: '[A]补', value: s.aBits },
    { label: s.op === 'sub' ? '(−B)补' : '[B]补', value: s.addend },
    { label: '当前结果', value: s.sum },
    { label: '溢出', value: s.act === 'overflow' || s.act === 'done' ? (s.overflow ? '是 ⊗' : '否') : '—',
      tone: s.overflow && (s.act === 'overflow' || s.act === 'done') ? 'bad' : undefined },
  ],
}

// ═══ CRC ═══════════════════════════════════════════════
const crc: Experiment<CrcState> = {
  id: 'crc',
  group: '计算机网络',
  title: 'CRC 循环冗余校验',
  subtitle: '模 2 长除法 · 检错',
  kernel: crcKernel,
  defaultDoc: {
    kind: 'crc',
    params: { generator: '10011', operation: 'encode', errorAt: -1 },
    entities: [],
    streams: [{ name: 'dataBits', values: CRC_PRESETS[0].values }],
  },
  params: [
    { key: 'generator', label: '生成多项式', kind: 'enum',
      options: ['110', '1001', '10011', '110101'] },
    { key: 'operation', label: '做什么', kind: 'enum', options: ['encode', 'check'] },
    { key: 'errorAt', label: '注入错误位', kind: 'number',
      options: [-1, 0, 3, 7, 11], unit: '−1 表示不注入' },
  ],
  sequence: {
    stream: 'dataBits', label: '数据位', hint: '只能填 0 和 1',
    maxLength: 32, presets: CRC_PRESETS,
  },
  bounds: [
    '只建模 CRC 的检错，不做纠错 —— CRC 本身也不具备纠错能力',
    '生成多项式用二进制串给出，不涉及多项式的代数形式',
    '不建模比特反转以外的差错（如突发差错的具体分布）',
    '实际协议里的 CRC 还有初值、异或输出、位序反转等约定，本实验不含',
  ],
  tabs: [{ id: 'div', label: '长除法竖式' }, { id: 'result', label: '码字与判定' }],
  Stage: CrcStage,
  tone: s => (s.phase === 'verify'
    ? (/^0*$/.test(s.remainder) ? { key: 'good', label: '无差错' } : { key: 'bad', label: '检出差错' })
    : s.q === '1' ? { key: 'good', label: '异或' }
    : s.phase === 'divide' ? { key: 'idle', label: '上商 0' }
    : { key: 'idle', label: s.phase === 'init' ? '准备' : '结果' }),
  metric: (s, i) => {
    const n = s.dividend.length || 1
    return s.at >= 0 ? (s.at + 1) / n : (s.phase === 'init' ? 0 : 1)
  },
  tickLabel: s => (s.at >= 0 ? `第 ${s.at + 1} 位 商${s.q}` : s.phase),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => [
    { label: '生成多项式', value: String(doc.params.generator) },
    { label: '校验位数', value: String(String(doc.params.generator).length - 1) },
    { label: '当前商', value: s.quotient || '—' },
    { label: '余数', value: s.remainder || '尚未算完' },
    { label: '本步', value: s.at >= 0 ? `对齐第 ${s.at + 1} 位，上商 ${s.q}` : s.phase },
  ],
}

// ═══ 海明码 ════════════════════════════════════════════
const hamming: Experiment<HammingState> = {
  id: 'hamming',
  group: '计算机网络',
  title: '海明码',
  subtitle: '校验位布局 · 定位并纠正一位错',
  kernel: hammingKernel,
  defaultDoc: {
    kind: 'hamming',
    params: { operation: 'check', errorAt: 5, evenParity: 1 },
    entities: [],
    streams: [{ name: 'dataBits', values: HAMMING_PRESETS[0].values }],
  },
  params: [
    { key: 'operation', label: '做什么', kind: 'enum', options: ['encode', 'check'] },
    { key: 'errorAt', label: '让第几位出错', kind: 'number',
      options: [0, 1, 2, 3, 5, 7], unit: '0 表示不出错' },
    { key: 'evenParity', label: '校验方式', kind: 'number', options: [1, 0], unit: '1 偶 / 0 奇' },
  ],
  sequence: {
    stream: 'dataBits', label: '数据位', hint: '只能填 0 和 1',
    maxLength: 16, presets: HAMMING_PRESETS,
  },
  bounds: [
    '只建模能纠一位错的基本海明码；加一位全校验的 SEC-DED（能纠一检二）不在范围内',
    '假设最多出现一位错 —— 出两位错时校验子会指向一个错误的位置',
    '校验位固定放在 2 的幂次位，这是最常见的约定',
    '不建模突发差错与交织',
  ],
  tabs: [{ id: 'code', label: '码字与位号' }, { id: 'groups', label: '校验分组' }],
  Stage: HammingStage,
  tone: s => (s.phase === 'locate'
    ? (s.syndrome === 0 ? { key: 'good', label: '无错' } : { key: 'bad', label: '定位到错位' })
    : s.phase === 'inject' ? { key: 'bad', label: '注入错误' }
    : s.ok === false ? { key: 'bad', label: '校验不通过' }
    : s.ok === true ? { key: 'good', label: '校验通过' }
    : { key: 'idle', label: '编码' }),
  metric: s => (s.bits.length ? s.bits.split('').filter(b => b !== '?').length / s.bits.length : 0),
  tickLabel: s => (s.p ? `P${s.p}` : s.phase),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => {
    const k = (doc.streams.find(x => x.name === 'dataBits')?.values ?? []).length
    return [
      { label: '数据位数', value: String(k) },
      { label: '校验位数', value: String(s.bits.length - k) },
      { label: '码长', value: String(s.bits.length) },
      { label: '本步校验位', value: s.p ? `P${s.p}` : '—' },
      { label: '校验子', value: String(s.syndrome),
        tone: s.syndrome > 0 ? 'bad' : undefined },
      { label: '结论', value: s.phase === 'locate'
          ? (s.syndrome === 0 ? '无错' : `第 ${s.syndrome} 位出错`) : '推导中' },
    ]
  },
}

// ═══ 子网划分 ══════════════════════════════════════════
const subnet: Experiment<SubnetState> = {
  id: 'subnet',
  group: '计算机网络',
  title: '子网划分与路由匹配',
  subtitle: '掩码按位与 · 最长前缀',
  kernel: subnetKernel,
  defaultDoc: {
    kind: 'subnet',
    params: { operation: 'subnet', prefix: 25, splitBits: 0 },
    entities: ROUTE_PRESETS[0].entities,
    streams: [{ name: 'addresses', values: SUBNET_PRESETS[0].values }],
  },
  params: [
    { key: 'operation', label: '做什么', kind: 'enum', options: ['subnet', 'lpm'] },
    { key: 'prefix', label: '前缀长度', kind: 'number', options: [8, 16, 24, 25, 26, 30], unit: '位' },
    { key: 'splitBits', label: '再借几位划子网', kind: 'number', options: [0, 1, 2, 3], unit: '位' },
  ],
  sequence: {
    chips: true,
    stream: 'addresses', label: '地址',
    hint: '十六进制的 32 位地址（预置里给了常见的点分形式）',
    radix: 16, maxLength: 1, presets: SUBNET_PRESETS,
  },
  entitySpec: {
    tables: [{
      type: 'route',
      label: '路由表',
      hint: '仅「最长前缀匹配」模式用；网络号的主机位必须为 0',
      columns: () => [
        { key: 'id', label: '项', kind: 'text', width: 66 },
        { key: 'network', label: '网络号（十进制整数）', kind: 'number', width: 150 },
        { key: 'prefix', label: '前缀', kind: 'number', width: 62 },
        { key: 'nextHop', label: '下一跳', kind: 'text', width: 84 },
      ],
      newRow: i => ({ id: `R${i + 1}`, type: 'route', attrs: { network: 0, prefix: 0, nextHop: '默认' } }),
      minRows: 1, maxRows: 10,
    }],
    presets: ROUTE_PRESETS,
  },
  bounds: [
    '只做 IPv4，不含 IPv6',
    '不区分公网/私网、不校验保留地址（如 127.0.0.0/8）',
    '「可用主机数 = 2^h − 2」按传统约定；现代设备允许 /31 用于点对点链路',
    '路由表按顺序线性比较，不建模实际路由器的 Trie / TCAM 查找结构',
  ],
  tabs: [{ id: 'bits', label: '地址位域' }, { id: 'detail', label: '结论' }],
  Stage: SubnetStage,
  tone: s => (s.phase === 'match'
    ? (s.hit ? { key: 'good', label: '匹配' } : { key: 'bad', label: '不匹配' })
    : s.phase === 'pick' ? { key: 'good', label: '选定' }
    : { key: 'idle', label: '拆解' }),
  metric: (s, i) => {
    const ones = s.mask.indexOf('0') < 0 ? s.mask.length : s.mask.indexOf('0')
    return ones / 32
  },
  tickLabel: s => (s.entry || s.phase),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: s => [
    ...Object.entries(s.detail).slice(0, 5).map(([k, v]) => ({ label: k, value: v.slice(0, 30) })),
    { label: '本步', value: s.phase },
  ],
}

// ═══ TCP 连接管理 ══════════════════════════════════════
const handshake: Experiment<HsState> = {
  id: 'handshake',
  group: '计算机网络',
  title: 'TCP 连接管理',
  subtitle: '三次握手 · 四次挥手 · 状态迁移',
  kernel: handshakeKernel,
  defaultDoc: {
    kind: 'handshake',
    params: { scenario: 'both', clientSeq: 100, serverSeq: 300 },
    entities: [],
    streams: [],
  },
  params: [
    { key: 'scenario', label: '场景', kind: 'enum', options: ['connect', 'close', 'both'] },
    { key: 'clientSeq', label: '客户端初始序号', kind: 'number', options: [0, 100, 1000] },
    { key: 'serverSeq', label: '服务器初始序号', kind: 'number', options: [0, 300, 2000] },
  ],
  entitySpec: {
    tables: [{
      type: 'loss',
      label: '报文段丢失',
      hint: '第 nth 个报文段丢失（按发出的先后计）',
      columns: () => [
        { key: 'id', label: '编号', kind: 'text', width: 60 },
        { key: 'nth', label: '第几个报文段', kind: 'number', width: 110 },
      ],
      newRow: i => ({ id: `L${i + 1}`, type: 'loss', attrs: { nth: 1 } }),
      minRows: 0, maxRows: 4,
    }],
    presets: HS_PRESETS,
  },
  bounds: [
    '只建模连接的建立与释放，不含数据传输阶段',
    '超时重传最多尝试 3 次，之后放弃 —— 真实实现有退避策略',
    '不建模同时打开 / 同时关闭这两种少见情形',
    'TIME_WAIT 的 2MSL 只作为一步说明，不按真实时长推进',
  ],
  tabs: [{ id: 'timeline', label: '时序图' }, { id: 'states', label: '状态迁移' }],
  Stage: HandshakeStage,
  tone: s => (s.act === 'lost' ? { key: 'bad', label: '丢失' }
    : s.act === 'timeout' ? { key: 'bad', label: '超时' }
    : s.act === 'send' ? { key: 'good', label: '发出' }
    : s.act === 'arrive' ? { key: 'good', label: '到达' }
    : { key: 'idle', label: '说明' }),
  metric: (s, _i) => {
    const order = ['CLOSED', 'SYN_SENT', 'ESTABLISHED', 'FIN_WAIT_1', 'FIN_WAIT_2', 'TIME_WAIT']
    const k = order.indexOf(s.client)
    return k < 0 ? 0 : k / (order.length - 1)
  },
  tickLabel: s => (s.seg ? s.seg.flags : s.act),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: s => [
    { label: '客户端状态', value: s.client },
    { label: '服务器状态', value: s.server },
    { label: '本步', value: { send: '发出报文段', arrive: '报文段到达', lost: '报文段丢失',
      timeout: '超时重传', wait: '说明', done: '完成' }[s.act] },
    { label: '报文段', value: s.seg ? `${s.seg.flags} seq=${s.seg.seq}` : '—',
      tone: s.seg?.lost ? 'bad' : undefined },
    { label: '已交换', value: `${s.history.length} 个报文段` },
  ],
}

// ═══ AVL ═══════════════════════════════════════════════
const avl: Experiment<AvlState> = {
  id: 'avl',
  group: '数据结构',
  title: 'AVL 平衡二叉树',
  subtitle: 'LL · RR · LR · RL 四种旋转',
  kernel: avlKernel,
  defaultDoc: {
    kind: 'avl', params: { mode: 'avl' }, entities: [],
    streams: [{ name: 'keys', values: AVL_PRESETS[3].values }],
  },
  params: [
    { key: 'mode', label: '模式', kind: 'enum', options: ['avl', 'bst'] },
  ],
  sequence: {
    chips: true,
    stream: 'keys', label: '插入序列', hint: '整数，按顺序依次插入',
    maxLength: 20, presets: AVL_PRESETS,
    random: () => {
      const pool = Array.from({ length: 30 }, (_, k) => k + 1)
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]]
      }
      return pool.slice(0, 8)
    },
  },
  bounds: [
    '只做插入，不做删除 —— 删除的旋转情形更复杂，另开一个实验更合适',
    '不存重复键；插入已有的键会被跳过',
    '「bst 模式」只是关掉旋转做对照，不是标准的二叉排序树实现',
    '平衡因子按「左高 − 右高」定义，与部分教材相反的约定不同',
  ],
  tabs: [{ id: 'tree', label: '树形' }, { id: 'rotations', label: '四种失衡' }],
  Stage: AvlStage,
  tone: s => (s.act === 'rotate' ? { key: 'bad', label: `${s.rotation} 旋转` }
    : s.act === 'insert' ? { key: 'good', label: '插入' }
    : s.act === 'done' ? { key: 'good', label: '完成' }
    : { key: 'idle', label: s.act === 'descend' ? '下降' : '回溯' }),
  metric: (s, _i) => {
    const n = s.nodes.length || 1
    return s.inserted / n
  },
  tickLabel: s => (s.act === 'rotate' ? s.rotation : `${s.key}`),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => [
    { label: '已插入', value: `${s.inserted} / ${(doc.streams.find(x => x.name === 'keys')?.values ?? []).length}` },
    { label: '当前键', value: String(s.key) },
    { label: '树高', value: String(trueHeight(s.nodes, s.root)) },
    { label: '旋转次数', value: String(s.rotations), tone: s.rotations > 0 ? 'bad' : undefined },
    { label: '本步动作', value: { descend: '比较下降', insert: '挂上新结点',
      update: '回溯更新高度', rotate: `${s.rotation} 型旋转`, done: '完成' }[s.act] },
  ],
}

// ═══ 栈与表达式求值 ════════════════════════════════════
const expr: Experiment<ExprState> = {
  id: 'expr',
  group: '数据结构',
  title: '栈与表达式求值',
  subtitle: '中缀转后缀 · 后缀求值',
  kernel: exprKernel,
  defaultDoc: { kind: 'expr', params: { expr: '3+4*2-1' }, entities: [], streams: [] },
  params: [
    { key: 'expr', label: '中缀表达式', kind: 'enum',
      options: ['3+4*2-1', '(3+4)*2', '2*(3+4)-5', '(1+2)*(3+4)', '10-2*3', '8/2+3'] },
  ],
  paramsNote: '换一个中缀表达式，看它先怎么转成后缀式、再怎么用栈求值。只支持 + − × ÷ 和括号、非负整数。',
  bounds: [
    '只支持二元 + − × ÷、圆括号、非负整数；不含一元负号、幂、函数',
    '除法按整数截断（8÷3=2），不建模浮点',
    '优先级固定 × ÷ 高于 + −，同级左结合；不支持右结合运算符',
    '不做非法表达式的报错恢复 —— 预置里都是合法式子',
  ],
  tabs: [{ id: 'run', label: '栈演示' }],
  Stage: ExprStage,
  tone: s => (s.act === 'done' ? { key: 'good', label: '完成' }
    : s.act === 'apply' ? { key: 'good', label: '运算' }
    : s.act === 'flush' ? { key: 'idle', label: '清栈' }
    : s.phase === 'eval' ? { key: 'good', label: '求值' }
    : { key: 'idle', label: '转换' }),
  metric: (s, i, _doc) => {
    void i; return s.phase === 'eval' ? 1 : 0.5
  },
  tickLabel: s => (s.at >= 0 ? (s.infix[s.at] ?? s.rpn[s.at] ?? '') : s.act === 'flush' ? '清栈' : '毕'),
  whyInRail: true,
  readouts: (s) => [
    { label: '阶段', value: s.phase === 'eval' ? '后缀求值' : '中缀 → 后缀' },
    { label: '栈内容', value: s.stack.length ? s.stack.join(' ') : '空' },
    { label: '栈顶', value: s.stack.length ? s.stack[s.stack.length - 1] : '—' },
    { label: '后缀式', value: s.rpn.length ? s.rpn.join(' ') : '—' },
    { label: '结果', value: s.result === null ? '—' : String(s.result),
      tone: s.result !== null ? 'good' : undefined },
  ],
}

// ═══ 二叉树遍历 ════════════════════════════════════════
const btree: Experiment<BtreeState> = {
  id: 'btree',
  group: '数据结构',
  title: '二叉树遍历',
  subtitle: '前序 · 中序 · 后序 · 层序',
  kernel: btreeKernel,
  defaultDoc: {
    kind: 'btree', params: { order: '前序' }, entities: [],
    streams: [{ name: 'keys', values: BTREE_PRESETS[0].values }],
  },
  params: [
    { key: 'order', label: '遍历次序', kind: 'enum', options: ['前序', '中序', '后序', '层序'] },
  ],
  sequence: {
    chips: true,
    stream: 'keys', label: '插入序列（决定树形）', hint: '整数，按顺序建二叉搜索树',
    maxLength: 15, presets: BTREE_PRESETS,
    random: () => {
      const pool = Array.from({ length: 20 }, (_, k) => (k + 1) * 5)
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]]
      }
      return pool.slice(0, 7)
    },
  },
  bounds: [
    '树由插入序列建成二叉搜索树 —— 换插入序列就换树形，但这不改变"四种次序各自的规则"',
    '深度优先的「调用栈」显示的是从根到当前结点的路径（= 递归深度），不是某种迭代实现的精确栈内容',
    '不存重复键；插入已有的键会落到右子树（按 ≥ 处理）',
    '只遍历不修改；删除 / 建树过程另属别的实验',
  ],
  tabs: [{ id: 'tree', label: '遍历树' }, { id: 'orders', label: '四种次序' }],
  Stage: BtreeStage,
  tone: s => (s.act === 'done' ? { key: 'good', label: '完成' }
    : { key: 'good', label: '输出' }),
  metric: s => (s.nodes.length ? s.visited.length / s.nodes.length : 0),
  tickLabel: s => (s.cur >= 0 ? String(s.nodes[s.cur]?.key ?? '') : '毕'),
  whyInRail: true,
  readouts: (s) => [
    { label: '遍历次序', value: { pre: '前序', in: '中序', post: '后序', level: '层序' }[s.order] },
    { label: '已输出', value: `${s.visited.length} / ${s.nodes.length}` },
    { label: '本步结点', value: s.cur >= 0 ? String(s.nodes[s.cur].key) : '—' },
    { label: '树高', value: String(trueHeight(s.nodes, s.root)) },
    { label: s.auxKind === 'stack' ? '调用栈深度' : '队列长度', value: String(s.aux.length) },
    { label: '输出序列', value: s.visited.map(n => s.nodes[n].key).join(' ') || '—' },
  ],
}

// ═══ 散列表 ════════════════════════════════════════════
const hash: Experiment<HashState> = {
  id: 'hash',
  group: '数据结构',
  title: '散列表',
  subtitle: '冲突处理 · 平均查找长度',
  kernel: hashKernel,
  defaultDoc: {
    kind: 'hash', params: { size: 13, method: '线性探测', rehashStep: 3 }, entities: [],
    streams: [{ name: 'keys', values: HASH_PRESETS[0].values }],
  },
  params: [
    { key: 'method', label: '冲突处理', kind: 'enum',
      options: ['拉链', '线性探测', '平方探测', '再散列'] },
    { key: 'size', label: '表长', kind: 'number', options: [7, 11, 13, 16], unit: '槽' },
    { key: 'rehashStep', label: '再散列步长', kind: 'number', options: [1, 3, 5], unit: '仅再散列用' },
  ],
  sequence: {
    chips: true,
    stream: 'keys', label: '待插入的键', hint: '非负整数',
    maxLength: 16, presets: HASH_PRESETS,
    random: () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 90) + 1),
  },
  bounds: [
    '散列函数固定为 H(key) = key mod 表长，不含平方取中、折叠等其它构造法',
    '平方探测用 +1²、−1²、+2²… 的常见约定；不同教材的序列可能不同',
    '只做插入与查找长度统计，不做删除（开放定址的删除要用墓碑标记）',
    'ASL 失败按「从每个初始地址探到空槽为止」计，与教材主流口径一致',
  ],
  tabs: [{ id: 'table', label: '槽位表' }, { id: 'asl', label: '平均查找长度' }],
  Stage: HashStage,
  tone: s => (s.slot < 0 ? { key: 'bad', label: '装不下' }
    : s.collided ? { key: 'bad', label: '冲突' }
    : { key: 'good', label: '一次落位' }),
  metric: (s, i) => Math.min(1, s.compares / 6),
  tickLabel: s => `${s.key}→槽${s.slot}`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  tickChip: (s: HashState) => String(s.key),
  readouts: (s, doc) => {
    const size = doc.params.size as number
    const method = String(doc.params.method)
    const a = asl(s.table, size, method, doc.params.rehashStep as number)
    return [
      { label: '本次键', value: String(s.key) },
      { label: '初始地址', value: `${s.key} mod ${size} = ${s.home}` },
      { label: '探查次数', value: String(s.compares), tone: s.compares > 1 ? 'bad' : 'good' },
      { label: '已装入', value: `${s.count} / ${size}` },
      { label: '装填因子 α', value: (s.count / size).toFixed(3) },
      { label: 'ASL 成功', value: a.success.toFixed(3) },
      { label: 'ASL 失败', value: a.fail.toFixed(3) },
    ]
  },
}

// ═══ 哈夫曼 ════════════════════════════════════════════
const huffman: Experiment<HuffState> = {
  id: 'huffman',
  group: '数据结构',
  title: '哈夫曼树与编码',
  subtitle: '逐次合并 · WPL · 前缀码',
  kernel: huffmanKernel,
  defaultDoc: {
    kind: 'huffman', params: {}, entities: [],
    streams: [{ name: 'weights', values: HUFF_PRESETS[0].values }],
  },
  params: [],
  paramsNote: '哈夫曼树的构造完全由权值决定，没有可调参数 —— 改下面的权值序列就行。',
  sequence: {
    stream: 'weights', label: '各字符的权值', hint: '正整数，字符自动标为 A B C…',
    maxLength: 12, presets: HUFF_PRESETS,
    random: () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 20) + 1),
  },
  bounds: [
    '权值相同时取先出现的那个，保证结果可复现 —— 教材里这时结果可能不唯一',
    '左子树记 0、右子树记 1；反过来约定会得到另一组编码，但 WPL 相同',
    '只做等长权值的静态哈夫曼编码，不含自适应哈夫曼',
    '不建模实际压缩里的码表存储开销',
  ],
  tabs: [{ id: 'forest', label: '森林' }, { id: 'codes', label: '编码表与 WPL' }],
  Stage: HuffmanStage,
  tone: s => (s.act === 'merge' ? { key: 'good', label: '合并' }
    : s.act === 'done' ? { key: 'good', label: '完成' }
    : { key: 'idle', label: '初始' }),
  metric: (s, _i) => {
    const total = s.nodes.filter(n => n.left === -1 && n.right === -1).length || 1
    return s.forest.length ? 1 - (s.forest.length - 1) / total : 1
  },
  tickLabel: s => (s.act === 'merge' ? `合并 ${s.nodes[s.merged]?.w ?? ''}` : s.act),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => {
    const n = (doc.streams.find(x => x.name === 'weights')?.values ?? []).length
    return [
      { label: '字符个数', value: String(n) },
      { label: '森林剩余', value: `${s.forest.length} 棵` },
      { label: '已合并', value: `${Math.max(0, n - s.forest.length)} / ${Math.max(0, n - 1)} 次` },
      { label: 'WPL', value: s.wpl > 0 ? String(s.wpl) : '走到最后一步才有' },
      { label: '本步合并', value: s.picked.length === 2
          ? `${s.nodes[s.picked[0]].w} + ${s.nodes[s.picked[1]].w}` : '—' },
    ]
  },
}

// ═══ KMP ═══════════════════════════════════════════════
const kmp: Experiment<KmpState> = {
  id: 'kmp',
  group: '数据结构',
  title: 'KMP 字符串匹配',
  subtitle: 'next 数组 · 主串永不回退',
  kernel: kmpKernel,
  defaultDoc: {
    kind: 'kmp',
    params: { text: 'ababcabcabababd', pattern: 'ababd', showMatch: 1 },
    entities: [], streams: [],
  },
  params: [
    { key: 'pattern', label: '模式串', kind: 'enum',
      options: ['ababd', 'ababaca', 'aaaa', 'abcabc', 'abababca'] },
    { key: 'text', label: '主串', kind: 'enum',
      options: ['ababcabcabababd', 'aaaaaaa', 'abcabcabcabc', 'xyzxyzxyz'] },
    { key: 'showMatch', label: '是否演示匹配', kind: 'number', options: [1, 0], unit: '1 是 / 0 只求 next' },
  ],
  bounds: [
    'next 数组按「最长相等前后缀长度」定义（从 0 开始）；部分教材用「下标从 1 开始且整体加 1」的 nextval 约定',
    '不含 nextval 优化（把相同字符的回退再压一层）',
    '只做单模式串匹配，不含 AC 自动机等多模式算法',
    '主串与模式串限定为 ASCII 字符，不处理多字节字符',
  ],
  tabs: [{ id: 'next', label: 'next 数组' }, { id: 'match', label: '匹配对齐' }],
  Stage: KmpStage,
  tone: s => (s.phase === 'found' ? { key: 'good', label: '找到' }
    : s.eq === true ? { key: 'good', label: '相等' }
    : s.eq === false ? { key: 'bad', label: '失配' }
    : { key: 'idle', label: s.phase === 'done' ? '完成' : '推导' }),
  metric: (s, _i) => {
    const n = s.next.length || 1
    return s.phase === 'next' ? (s.j + 1) / n : 1
  },
  tickLabel: s => (s.phase === 'next' ? `next[${s.j}]` : s.phase === 'done' ? '完成' : `i=${s.ti} j=${s.pj}`),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => [
    { label: '阶段', value: { next: '求 next 数组', match: '匹配', found: '找到一处', done: '完成' }[s.phase] },
    { label: 'next 数组', value: s.next.map(v => (v < 0 ? '?' : v)).join(' ') },
    { label: '主串指针 i', value: s.ti >= 0 ? String(s.ti) : '—' },
    { label: '模式指针 j', value: s.pj >= 0 ? String(s.pj) : '—' },
    { label: '已找到', value: s.found.length ? s.found.join('、') : '暂无' },
    { label: '主串前进次数', value: `${s.textAdvances}（长 ${String(doc.params.text).length}，永不回退）` },
  ],
}

// ═══ 最小生成树 ════════════════════════════════════════
const mst: Experiment<MstState> = {
  id: 'mst', group: '数据结构',
  title: '最小生成树', subtitle: 'Prim 从点长 · Kruskal 从边挑',
  kernel: mstKernel,
  defaultDoc: {
    kind: 'mst', params: { algorithm: 'Prim', start: 'A' },
    entities: MST_PRESETS[0].entities, streams: [],
  },
  params: [
    { key: 'algorithm', label: '算法', kind: 'enum', options: ['Prim', 'Kruskal'] },
    { key: 'start', label: 'Prim 起点', kind: 'enum', options: ['A', 'B', 'C', 'D', 'E', 'F'] },
  ],
  entitySpec: {
    tables: [{
      type: 'edge', label: '边表', hint: '无向图；顶点固定 A–F',
      columns: doc => {
        const ids = doc.entities.filter(e => e.type === 'node').map(e => e.id)
        return [
          { key: 'from', label: '端点1', kind: 'enum', options: ids, width: 64 },
          { key: 'to', label: '端点2', kind: 'enum', options: ids, width: 64 },
          { key: 'w', label: '权值', kind: 'number', width: 70 },
        ]
      },
      newRow: (i, doc) => {
        const ids = doc.entities.filter(e => e.type === 'node').map(e => e.id)
        return { id: `E${i + 1}`, type: 'edge', attrs: { from: ids[0], to: ids[1] ?? ids[0], w: 1 } }
      },
      minRows: 1, maxRows: 16, chunk: 6,
    }],
    presets: MST_PRESETS,
  },
  bounds: [
    '只处理连通的无向带权图；不连通时得到的是最小生成森林的一部分',
    '权值相等时按边 id 字典序取，保证结果可复现 —— 教材里这时 MST 可能不唯一',
    'Prim 用线性扫描找最小边（O(V²)），不是堆优化版；结果相同，步数展示不同',
    '不处理自环与重边',
  ],
  tabs: [{ id: 'graph', label: '图' }, { id: 'edges', label: '边表' }],
  Stage: MstStage,
  tone: s => (s.act === 'take' ? { key: 'good', label: '选入' }
    : s.act === 'skip' ? { key: 'bad', label: '成环丢弃' }
    : s.act === 'done' ? { key: 'good', label: '完成' }
    : { key: 'idle', label: '考察' }),
  metric: (s, _i) => {
    const n = 6
    return s.chosen.length / Math.max(1, n - 1)
  },
  tickLabel: s => (s.edge || s.act),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => {
    const n = doc.entities.filter(e => e.type === 'node').length
    return [
      { label: '算法', value: String(doc.params.algorithm) },
      { label: '已选边', value: `${s.chosen.length} / ${n - 1}` },
      { label: '总权值', value: String(s.weight) },
      { label: '本步边', value: s.edge || '—' },
      { label: '树中顶点', value: s.inTree.length ? s.inTree.join(' ') : '—' },
    ]
  },
}

// ═══ 拓扑排序与关键路径 ════════════════════════════════
const topo: Experiment<TopoState> = {
  id: 'topo', group: '数据结构',
  title: '拓扑排序与关键路径', subtitle: 'AOE 网 · ve 正推 vl 逆推',
  kernel: topoKernel,
  defaultDoc: {
    kind: 'topo', params: { operation: 'critical' },
    entities: AOE_PRESETS[0].entities, streams: [],
  },
  params: [
    { key: 'operation', label: '做什么', kind: 'enum', options: ['topo', 'critical'] },
  ],
  entitySpec: {
    tables: [{
      type: 'edge', label: '活动表（有向边）', hint: '权值 = 活动耗时；顶点固定 V1–V7',
      columns: doc => {
        const ids = doc.entities.filter(e => e.type === 'node').map(e => e.id)
        return [
          { key: 'from', label: '起点', kind: 'enum', options: ids, width: 68 },
          { key: 'to', label: '终点', kind: 'enum', options: ids, width: 68 },
          { key: 'w', label: '耗时', kind: 'number', width: 66 },
        ]
      },
      newRow: (i, doc) => {
        const ids = doc.entities.filter(e => e.type === 'node').map(e => e.id)
        return { id: `A${i + 1}`, type: 'edge', attrs: { from: ids[0], to: ids[1] ?? ids[0], w: 1 } }
      },
      minRows: 1, maxRows: 14, chunk: 7,
    }],
    presets: AOE_PRESETS,
  },
  bounds: [
    '入度为 0 的顶点有多个时按名字字典序取，保证拓扑序列可复现（教材里此时不唯一）',
    'AOE 网假设只有一个源点和一个汇点；多源多汇需要先加虚拟结点',
    '关键路径可能不止一条 —— 这里把所有关键活动都标出来，不只给一条路径',
    '不建模活动的资源约束，只看时间',
  ],
  tabs: [{ id: 'graph', label: '图' }, { id: 'table', label: '表格' }],
  Stage: TopoStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '完成' }
    : s.critical.includes(s.at) ? { key: 'bad', label: '关键活动' }
    : s.phase === 'topo' ? { key: 'good', label: '输出顶点' }
    : { key: 'idle', label: s.phase === 've' ? '正推 ve' : s.phase === 'vl' ? '逆推 vl' : '算活动' }),
  metric: (s, _i) => {
    const n = Object.keys(s.indeg).length || 1
    return s.order.length / n
  },
  tickLabel: s => (s.at || s.phase),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => {
    const n = doc.entities.filter(e => e.type === 'node').length
    const total = Math.max(0, ...Object.values(s.ve))
    return [
      { label: '阶段', value: { topo: '拓扑排序', ve: '正推 ve', vl: '逆推 vl',
        activity: '算活动 e / l', done: '完成' }[s.phase] },
      { label: '拓扑序列', value: s.order.join(' ') || '—' },
      { label: '已排序', value: `${s.order.length} / ${n}` },
      { label: '总工期', value: total > 0 ? String(total) : '—' },
      { label: '关键活动', value: s.critical.length ? s.critical.join('、') : '—',
        tone: s.critical.length ? 'bad' : undefined },
    ]
  },
}

// ═══ 动态分区分配 ══════════════════════════════════════
const partition: Experiment<PartState> = {
  id: 'partition', group: '操作系统',
  title: '动态分区分配', subtitle: '四种放置策略 · 外碎片',
  kernel: partitionKernel,
  defaultDoc: {
    kind: 'partition', params: { algorithm: '首次适应', memorySize: 640 },
    entities: PART_PRESETS[0].entities, streams: [],
  },
  params: [
    { key: 'algorithm', label: '放置策略', kind: 'enum',
      options: ['首次适应', '最佳适应', '最坏适应', '邻近适应'] },
    { key: 'memorySize', label: '内存大小', kind: 'number', options: [512, 640, 1024], unit: 'KB' },
  ],
  entitySpec: {
    tables: [{
      type: 'req', label: '请求序列', hint: '释放填 1 时忽略大小，按作业名找',
      columns: () => [
        { key: 'id', label: '作业', kind: 'text', width: 72 },
        { key: 'size', label: '申请大小', kind: 'number', unit: 'KB', width: 88 },
        { key: 'free', label: '是否释放', kind: 'number', width: 82 },
      ],
      newRow: i => ({ id: `作业${i + 1}`, type: 'req', at: i, attrs: { size: 100, free: 0 } }),
      minRows: 1, maxRows: 14, chunk: 7,
    }],
    presets: PART_PRESETS,
  },
  bounds: [
    '只建模连续分配，不含分页与分段',
    '空闲块小于 8 KB 时计入外碎片统计 —— 这个门限是展示用的约定，不是硬性规则',
    '释放时只合并**相邻**空闲区，不做紧凑（compaction）',
    '邻近适应从上次分配结束的地址开始绕一圈找，与部分教材"从上次分配的分区开始"略有差别',
  ],
  tabs: [{ id: 'bar', label: '内存布局' }, { id: 'table', label: '分区表' }],
  Stage: PartitionStage,
  tone: s => (s.act === 'fail' ? { key: 'bad', label: '分配失败' }
    : s.act === 'free' ? { key: 'idle', label: '释放' }
    : { key: 'good', label: '分配' }),
  metric: (s, _i) => {
    const used = s.blocks.filter(b => b.owner).reduce((x, b) => x + b.size, 0)
    return used / Math.max(1, used + s.freeTotal)
  },
  tickLabel: s => `${s.job}${s.act === 'free' ? ' 释放' : ` ${s.size}K`}`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  tickChip: (s: PartState) => String(s.job),
  readouts: (s, doc) => [
    { label: '策略', value: String(doc.params.algorithm) },
    { label: '本步', value: `${s.job} ${s.act === 'free' ? '释放' : `申请 ${s.size} KB`}` },
    { label: '结果', value: s.act === 'fail' ? '失败' : s.at >= 0 ? `起址 ${s.at}` : '—',
      tone: s.act === 'fail' ? 'bad' : undefined },
    { label: '空闲总量', value: `${s.freeTotal} KB` },
    { label: '空闲块数', value: String(s.blocks.filter(b => !b.owner).length) },
    { label: '外碎片', value: `${s.external} KB`, tone: s.external > 0 ? 'bad' : undefined },
  ],
}

// ═══ 文件索引寻址 ══════════════════════════════════════
const inode: Experiment<InodeState> = {
  id: 'inode', group: '操作系统',
  title: '文件索引寻址', subtitle: '混合索引 · 几次磁盘访问',
  kernel: inodeKernel,
  defaultDoc: {
    kind: 'inode',
    params: { blockSizeBytes: 1024, pointerSizeBytes: 4, directCount: 10 },
    entities: [],
    streams: [{ name: 'blockNumbers', values: INODE_PRESETS[0].values }],
  },
  params: [
    { key: 'blockSizeBytes', label: '块大小', kind: 'number', options: [512, 1024, 4096], unit: 'B' },
    { key: 'pointerSizeBytes', label: '指针大小', kind: 'number', options: [2, 4, 8], unit: 'B' },
    { key: 'directCount', label: '直接地址个数', kind: 'number', options: [8, 10, 12], unit: '个' },
  ],
  sequence: {
    chips: true,
    stream: 'blockNumbers', label: '要访问的逻辑块号',
    hint: '非负整数', maxLength: 12, presets: INODE_PRESETS,
  },
  bounds: [
    '按 UNIX 风格的混合索引：直接 + 一级 + 二级 + 三级间接',
    '假设索引块与数据块同样大小；不建模 inode 本身的读取开销',
    '不建模磁盘缓存 —— 实际系统里索引块常驻内存，访问次数会少于这里的数字',
    '不含 FAT、连续分配、链接分配等其它文件分配方式',
  ],
  tabs: [{ id: 'chain', label: '寻址链' }, { id: 'levels', label: '分级结构' }],
  Stage: InodeStage,
  tone: s => (s.level === 'oob' ? { key: 'bad', label: '越界' }
    : s.level === 'direct' ? { key: 'good', label: '直接' }
    : { key: 'idle', label: { single: '一级', double: '二级', triple: '三级' }[s.level] ?? '' }),
  metric: s => Math.min(1, s.reads / 4),
  tickLabel: s => `块 ${s.lbn}`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  tickChip: (s: InodeState) => `块 ${s.lbn}`,
  readouts: (s, doc) => {
    const bs = doc.params.blockSizeBytes as number
    const ps = doc.params.pointerSizeBytes as number
    const dc = doc.params.directCount as number
    const K = Math.floor(bs / ps)
    const max = maxFileSize(bs, ps, dc)
    return [
      { label: '逻辑块号', value: String(s.lbn) },
      { label: '落在', value: { direct: '直接地址', single: '一级间接',
        double: '二级间接', triple: '三级间接', oob: '越界' }[s.level],
        tone: s.level === 'oob' ? 'bad' : s.level === 'direct' ? 'good' : undefined },
      { label: '磁盘访问', value: s.reads > 0 ? `${s.reads} 次` : '不可达', tone: s.reads >= 4 ? 'bad' : undefined },
      { label: '每块指针数 K', value: `${bs} ÷ ${ps} = ${K}` },
      { label: '文件最大长度', value: max >= (1 << 30)
          ? `${(max / (1 << 30)).toFixed(2)} GB` : `${(max / (1 << 20)).toFixed(1)} MB` },
    ]
  },
}

// ═══ B+ 树 ═════════════════════════════════════════════
const bplus: Experiment<BPlusState> = {
  id: 'bplus', group: '数据结构',
  title: 'B+ 树的插入与分裂', subtitle: '所有键在叶子层 · 叶子成链',
  kernel: bplusKernel,
  defaultDoc: {
    kind: 'bplus', params: { order: 3 }, entities: [],
    streams: [{ name: 'keys', values: BPLUS_PRESETS[1].values }],
  },
  params: [{ key: 'order', label: '阶 m', kind: 'number', options: [3, 4, 5], unit: '最多 m−1 个键' }],
  sequence: {
    chips: true,
    stream: 'keys', label: '插入序列', hint: '整数，按顺序依次插入',
    maxLength: 24, presets: BPLUS_PRESETS,
  },
  bounds: [
    '只做插入，不做删除 —— 删除涉及借键与合并，情形更多，另开实验更合适',
    '不存重复键',
    '按"叶子分裂时中间键复制上去"的常见约定；部分教材把分裂点取在别处，中间过程会不同',
    '不建模磁盘页大小与实际的 I/O 次数',
  ],
  tabs: [{ id: 'tree', label: '树形' }, { id: 'leaves', label: '叶子链' }],
  Stage: BPlusStage,
  tone: s => (s.act === 'split' ? { key: 'bad', label: '分裂' }
    : s.act === 'grow' ? { key: 'bad', label: '长高' }
    : s.act === 'insert' ? { key: 'good', label: '插入' }
    : s.act === 'done' ? { key: 'good', label: '完成' }
    : { key: 'idle', label: '下降' }),
  metric: (s, _i) => Math.min(1, s.height / 4),
  tickLabel: s => (s.act === 'split' ? `分裂 ${s.upKey}` : String(s.key)),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => [
    { label: '阶 m', value: `${doc.params.order}（最多 ${(doc.params.order as number) - 1} 个键）` },
    { label: '当前键', value: String(s.key) },
    { label: '树高', value: `${s.height} 层` },
    { label: '分裂次数', value: String(s.splits), tone: s.splits > 0 ? 'bad' : undefined },
    { label: '本步', value: { descend: '比较下降', insert: '插入叶子',
      split: `${s.splitLeaf ? '叶子' : '内部结点'}分裂`, grow: '根分裂，树长高', done: '完成' }[s.act] },
  ],
}

// ═══ 图的遍历 ══════════════════════════════════════════
const traverse: Experiment<TravState> = {
  id: 'traverse', group: '数据结构',
  title: '图的遍历', subtitle: 'DFS 用栈 · BFS 用队列',
  kernel: traverseKernel,
  defaultDoc: {
    kind: 'traverse', params: { algorithm: 'DFS', start: 'A', directed: 0 },
    entities: TRAV_PRESETS[0].entities, streams: [],
  },
  params: [
    { key: 'algorithm', label: '算法', kind: 'enum', options: ['DFS', 'BFS'] },
    { key: 'start', label: '起点', kind: 'enum', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
    { key: 'directed', label: '图的类型', kind: 'number', options: [0, 1], unit: '0 无向 / 1 有向' },
  ],
  entitySpec: {
    tables: [{
      type: 'edge', label: '边表', hint: '遍历不看权值；顶点固定 A–H',
      columns: doc => {
        const ids = doc.entities.filter(e => e.type === 'node').map(e => e.id)
        return [
          { key: 'from', label: '端点1', kind: 'enum', options: ids, width: 64 },
          { key: 'to', label: '端点2', kind: 'enum', options: ids, width: 64 },
        ]
      },
      newRow: (i, doc) => {
        const ids = doc.entities.filter(e => e.type === 'node').map(e => e.id)
        return { id: `E${i + 1}`, type: 'edge', attrs: { from: ids[0], to: ids[1] ?? ids[0], w: 1 } }
      },
      minRows: 1, maxRows: 16, chunk: 8,
    }],
    presets: TRAV_PRESETS,
  },
  bounds: [
    '邻接点按名字字典序访问，保证序列可复现 —— 教材里邻接表的存储顺序不同，序列也会不同',
    'DFS 用显式栈实现，与递归写法的访问序相同',
    '图不连通时会换起点继续，得到的是生成森林',
    '不建模边的权值',
  ],
  tabs: [{ id: 'graph', label: '图' }, { id: 'container', label: '栈 / 队列' }],
  Stage: TraverseStage,
  tone: s => (s.act === 'visit' ? { key: 'good', label: '访问' }
    : s.act === 'skip' ? { key: 'bad', label: '已访问，跳过' }
    : s.act === 'done' ? { key: 'good', label: '完成' }
    : { key: 'idle', label: '入容器' }),
  metric: (s, _i) => {
    const n = 8
    return s.order.length / n
  },
  tickLabel: s => (s.at || s.act),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => {
    const n = doc.entities.filter(e => e.type === 'node').length
    const dfs = doc.params.algorithm === 'DFS'
    return [
      { label: '算法', value: `${doc.params.algorithm}（${dfs ? '栈' : '队列'}）` },
      { label: '已访问', value: `${s.order.length} / ${n}` },
      { label: '访问序列', value: s.order.join(' ') || '—' },
      { label: dfs ? '栈内容' : '队列内容', value: s.pending.join(' ') || '空' },
      { label: '生成树边数', value: String(s.treeEdges.length) },
    ]
  },
}

// ═══ 信号量 ════════════════════════════════════════════
const semaphore: Experiment<SemState> = {
  id: 'semaphore', group: '操作系统',
  title: '信号量与生产者消费者', subtitle: 'P/V 操作 · 顺序错了会死锁',
  kernel: semaphoreKernel,
  defaultDoc: {
    kind: 'semaphore',
    params: { bufferSize: 2, order: 'correct', schedule: SEM_SCHEDULES[0]!.label },
    entities: [],
    streams: [{ name: 'schedule', values: SEM_SCHEDULES[0]!.values }],
  },
  params: [
    /*  ⚠️ 这个旋钮是**补上的**：三条调度预置里只有第一条进得了 defaultDoc，
        而另外两条正是唯二能演出阻塞的（生产者填满缓冲区、消费者空手先到）。
        没有它，「P 的顺序」拧到 wrong 屏幕上一个字都不变 ——
        因为默认那条交替序列压根走不到会抢锁的地方，
        于是这个实验的副标题「顺序错了会死锁」在产品里演示不出来。 */
    { key: 'schedule', label: '调度序列', kind: 'enum',
      options: SEM_SCHEDULES.map(x => x.label),
      //  选择器：选中哪条，就把哪条写进 `schedule` 流里 —— 内核只认流
      stream: { name: 'schedule',
                values: (v: never) => SEM_SCHEDULES.find(x => x.label === v)?.values ?? [] } },
    { key: 'order', label: 'P 的顺序', kind: 'enum', options: ['correct', 'wrong'],
      optionLabel: (v: never) => (v === 'correct' ? '正确' : '错误') },
    { key: 'bufferSize', label: '缓冲区大小', kind: 'number', options: [1, 2, 3, 4], unit: '个' },
  ],
  bounds: [
    '只建模一个生产者与一个消费者；多生产者多消费者的情形不改变结论，但轨迹会长很多',
    '调度序列由文档给定，不做随机调度 —— 否则无法复现、也无法出题',
    'V 操作唤醒等待队列里的第一个线程，且被唤醒者直接拿走资源（不再竞争）',
    '不建模优先级、饥饿与自旋锁',
  ],
  tabs: [{ id: 'live', label: '运行状态' }, { id: 'code', label: '两段代码' }],
  Stage: SemaphoreStage,
  tone: s => (s.act === 'deadlock' ? { key: 'bad', label: '死锁' }
    : s.act === 'block' ? { key: 'bad', label: '阻塞' }
    : s.act === 'wake' ? { key: 'good', label: '唤醒' }
    : s.act === 'work' ? { key: 'good', label: '临界区' }
    : { key: 'idle', label: s.act === 'P' ? 'P 操作' : s.act === 'V' ? 'V 操作' : '说明' }),
  metric: (s, _i) => {
    const n = Object.keys(s.pc).length || 1
    return 1 - Object.keys(s.blocked).length / n
  },
  tickLabel: s => (s.who ? `${s.who} ${s.act}` : s.act),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => [
    { label: 'empty（空位）', value: String(s.empty), tone: s.empty === 0 ? 'bad' : undefined },
    { label: 'full（产品）', value: String(s.full), tone: s.full === 0 ? 'bad' : undefined },
    { label: 'mutex（锁）', value: String(s.mutex) },
    { label: '缓冲区', value: `${s.buffer.length} / ${doc.params.bufferSize}` },
    { label: '阻塞中', value: Object.entries(s.blocked).map(([k, v]) => `${k}@${v}`).join(' ') || '无',
      tone: Object.keys(s.blocked).length ? 'bad' : undefined },
    { label: '生产 / 消费', value: `${s.produced} / ${s.consumed}` },
  ],
}

// ═══ 位示图 ════════════════════════════════════════════
const bitmap: Experiment<BitmapState> = {
  id: 'bitmap', group: '操作系统',
  title: '位示图管理空闲块', subtitle: '字号 / 位号 ↔ 盘块号',
  kernel: bitmapKernel,
  defaultDoc: {
    kind: 'bitmap', params: { words: 8, wordBits: 8 },
    entities: BITMAP_PRESETS[0].entities, streams: [],
  },
  params: [
    { key: 'words', label: '字数', kind: 'number', options: [4, 8, 16], unit: '个' },
    { key: 'wordBits', label: '字长', kind: 'number', options: [8, 16, 32], unit: '位' },
  ],
  entitySpec: {
    tables: [{
      type: 'req', label: '分配 / 回收请求',
      hint: '回收填 1 时用「起始盘块」定位；分配时忽略它',
      columns: () => [
        { key: 'id', label: '文件', kind: 'text', width: 78 },
        { key: 'count', label: '块数', kind: 'number', width: 66 },
        { key: 'free', label: '是否回收', kind: 'number', width: 82 },
        { key: 'block', label: '起始盘块', kind: 'number', width: 84 },
      ],
      newRow: i => ({ id: `文件${i + 1}`, type: 'req', at: i, attrs: { count: 3, free: 0, block: -1 } }),
      minRows: 1, maxRows: 12, chunk: 6,
    }],
    presets: BITMAP_PRESETS,
  },
  bounds: [
    '字号、位号一律从 0 起编 —— 教材若从 1 起编，两条换算式要各加/减 1',
    '分配采用顺序扫描找第一个空闲位，不做首次适应之外的策略',
    '一次申请多块时不要求连续；连续分配是另一种文件分配方式',
    '不建模位示图本身占用的磁盘空间',
  ],
  tabs: [{ id: 'grid', label: '位示图' }, { id: 'calc', label: '换算公式' }],
  Stage: BitmapStage,
  tone: s => (s.act === 'fail' ? { key: 'bad', label: '分配失败' }
    : s.act === 'free' ? { key: 'idle', label: '回收' }
    : { key: 'good', label: '分配' }),
  metric: (s, _i) => {
    const total = s.bits.length * (s.bits[0]?.length ?? 1)
    return total ? 1 - s.freeCount / total : 0
  },
  tickLabel: s => `${s.act === 'free' ? '收' : '分'}${s.blocks.length}块`,
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  tickChip: (s: BitmapState) => `${s.act === 'free' ? '收' : '分'}${s.blocks.length}`,
  readouts: (s, doc) => {
    const wb = doc.params.wordBits as number
    const b0 = s.blocks[0]
    return [
      { label: '本步动作', value: s.act === 'alloc' ? '分配' : s.act === 'free' ? '回收' : '失败',
        tone: s.act === 'fail' ? 'bad' : undefined },
      { label: '涉及盘块', value: s.blocks.length ? s.blocks.join('、') : '—' },
      { label: '第一块的字号', value: b0 === undefined ? '—' : String(Math.floor(b0 / wb)) },
      { label: '第一块的位号', value: b0 === undefined ? '—' : String(b0 % wb) },
      { label: '换算', value: b0 === undefined ? '—'
          : `${Math.floor(b0 / wb)} × ${wb} + ${b0 % wb} = ${b0}` },
      { label: '空闲块数', value: String(s.freeCount) },
    ]
  },
}

// ═══ CSMA/CD ═══════════════════════════════════════════
const csma: Experiment<CsmaState> = {
  id: 'csma', group: '计算机网络',
  title: 'CSMA/CD 与退避', subtitle: '冲突 · 二进制指数退避',
  kernel: csmaKernel,
  defaultDoc: {
    kind: 'csma', params: { maxAttempts: 16 },
    entities: CSMA_PRESETS[0].entities, streams: [],
  },
  params: [
    { key: 'maxAttempts', label: '重传上限', kind: 'number', options: [3, 8, 16], unit: '次' },
  ],
  entitySpec: {
    tables: [{
      type: 'station', label: '各站',
      hint: '退避取值由这里给定 —— 真随机就没法复现、也没法出题',
      columns: () => [
        { key: 'id', label: '站', kind: 'text', width: 58 },
        { key: 'readyAt', label: '第几个争用期就绪', kind: 'number', width: 132 },
        { key: 'picks', label: '每次退避取的 r（逗号分隔）', kind: 'text', width: 190 },
      ],
      newRow: i => ({ id: String.fromCharCode(65 + i), type: 'station', attrs: { readyAt: 1, picks: '0,1,2' } }),
      minRows: 1, maxRows: 6,
    }],
    presets: CSMA_PRESETS,
  },
  bounds: [
    '以争用期（2τ）为时间单位，不建模帧长与实际传播时延',
    '"随机"退避值由配置给定，不是真随机 —— 换成真随机就无法复现',
    '假设所有站都能听到彼此的冲突（无隐藏站问题）',
    '不建模 1-坚持 / 非坚持 / p-坚持 这几种监听策略的差别',
  ],
  tabs: [{ id: 'slots', label: '时隙图' }, { id: 'backoff', label: '退避表' }],
  Stage: CsmaStage,
  tone: s => (s.collision ? { key: 'bad', label: '冲突' }
    : s.sending.length === 1 ? { key: 'good', label: '发送成功' }
    : { key: 'idle', label: '空闲 / 退避' }),
  metric: (s, _i) => {
    const total = s.done.length + s.aborted.length
    return total / Math.max(1, Object.keys(s.attempts).length)
  },
  tickLabel: s => (s.slot > 0 ? `第 ${s.slot} 个争用期` : '说明'),
  //  推演右栏 + 旁栏收进底部实验记录（见 types.ts 的 whyInRail）
  whyInRail: true,
  readouts: (s, doc) => {
    const n = doc.entities.filter(e => e.type === 'station').length
    return [
      { label: '争用期', value: s.slot > 0 ? String(s.slot) : '—' },
      { label: '本期发送', value: s.sending.join('、') || '无' },
      { label: '是否冲突', value: s.collision ? '冲突' : '无', tone: s.collision ? 'bad' : undefined },
      { label: '已成功', value: `${s.done.length} / ${n}` },
      { label: '已放弃', value: s.aborted.join('、') || '无', tone: s.aborted.length ? 'bad' : undefined },
      { label: '各站冲突次数', value: Object.entries(s.attempts).map(([k, v]) => `${k}:${v}`).join(' ') || '—' },
    ]
  },
}

// ═══ 距离矢量路由 ══════════════════════════════════════
const rip: Experiment<RipState> = {
  id: 'rip',
  group: '计算机网络',
  title: '距离矢量路由',
  subtitle: 'RIP · 逐轮交换 · 无穷计数',
  kernel: ripKernel,
  defaultDoc: {
    kind: 'rip', params: { scenario: '收敛' },
    entities: RIP_PRESETS[0].entities, streams: [],
  },
  params: [
    { key: 'scenario', label: '场景', kind: 'enum', options: ['收敛', '断链'] },
  ],
  entitySpec: {
    presets: RIP_PRESETS,
    tables: [{
      type: 'edge',
      label: '链路（无向）',
      columns: doc => {
        const ids = doc.entities.filter(e => e.type === 'node').map(e => e.id)
        return [
          { key: 'from', label: '端点1', kind: 'enum', options: ids, width: 66 },
          { key: 'to', label: '端点2', kind: 'enum', options: ids, width: 66 },
          { key: 'w', label: '代价', kind: 'number', width: 62 },
        ]
      },
      newRow: (i, doc) => {
        const ids = doc.entities.filter(e => e.type === 'node').map(e => e.id)
        return { id: `L${i + 1}`, type: 'edge', attrs: { from: ids[0], to: ids[1] ?? ids[0], w: 1 } }
      },
    }],
  },
  bounds: [
    '同步模型：每轮所有路由器同时用邻居"上一轮"的矢量更新，真实 RIP 是异步定时广播',
    '不建模水平分割 / 毒性逆转等防无穷计数的优化 —— 正是为了把无穷计数演出来',
    '"无穷"取 RIP 的约定值 16；代价即跳数，不建模带宽 / 时延',
    '断链场景固定断掉拓扑里的第一条边',
  ],
  tabs: [{ id: 'matrix', label: '距离矢量表' }, { id: 'graph', label: '网络图' }],
  Stage: RipStage,
  tone: s => (s.act === 'converged' ? { key: 'good', label: '收敛' }
    : s.act === 'break' ? { key: 'bad', label: '断链' }
    : s.act === 'capped' ? { key: 'bad', label: '无穷计数' }
    : s.act === 'init' ? { key: 'idle', label: '初始' }
    : { key: 'good', label: `第 ${s.round} 轮` }),
  metric: s => Math.min(1, s.round / 8),
  tickLabel: s => (s.act === 'break' ? '断' : s.act === 'converged' ? '收敛' : `轮${s.round}`),
  whyInRail: true,
  readouts: (s) => {
    const inf = s.routers.reduce((n, x) => n + s.routers.filter(y => x !== y && (s.dist[x]?.[y] ?? 0) >= 16).length, 0)
    return [
      { label: '场景', value: s.broken ? `断链（${s.broken[0]}—${s.broken[1]}）` : '收敛' },
      { label: '交换轮', value: String(s.round) },
      { label: '本轮变化', value: s.changed.length ? `${s.changed.length} 项` : '无',
        tone: s.act === 'capped' ? 'bad' : undefined },
      { label: '不可达表项', value: String(inf), tone: inf > 0 ? 'bad' : undefined },
      { label: '本步动作', value: { init: '初始化', exchange: '交换更新', break: '链路断开',
        capped: '无穷计数中', converged: '已收敛' }[s.act] },
    ]
  },
}

// ═══ 前缀缓存（Radix Cache）· 大模型推理 ═══════════════
const radix: Experiment<RadixState> = {
  id: 'radix',
  group: '大模型推理',
  title: '前缀缓存 Radix Cache',
  subtitle: 'KV 复用 · 省下 prefill · LRU 淘汰',
  kernel: radixKernel,
  defaultDoc: { kind: 'radix', params: { requests: '共享 system 前缀', budget: 12 }, entities: [], streams: [] },
  params: [
    { key: 'requests', label: '请求集', kind: 'enum', options: ['共享 system 前缀', '各不相同', '层层加深'] },
    { key: 'budget', label: '缓存预算', kind: 'number', options: [4, 8, 12, 20], unit: 'token' },
  ],
  paramsNote: '推理服务里多个请求常共享前缀（同一 system prompt / few-shot）。前缀那段的 KV 可以跨请求复用，省掉重复的 prefill。换请求集看共享越多省越多；调小预算看 LRU 淘汰。',
  bounds: [
    '一个 token 用一个树结点表示其 KV —— 真实系统按块（page）粒度管理，这里简化到 token 粒度',
    '"省下 prefill"按命中 token 数占比现算，不建模真实 FLOPs / 显存 / 时延',
    'LRU 只淘汰叶子结点（真实 radix cache 也是从叶子往上回收）',
    '不建模并发、抢占、请求到达时间 —— 这里按请求依次处理',
  ],
  tabs: [{ id: 'tree', label: '前缀树' }],
  Stage: RadixStage,
  tone: s => (s.act === 'match' ? { key: 'good', label: '命中·复用' }
    : s.act === 'compute' ? { key: 'bad', label: '未命中·计算' }
    : s.act === 'evict' ? { key: 'bad', label: 'LRU 淘汰' }
    : s.act === 'done' ? { key: 'good', label: '完成' }
    : { key: 'idle', label: `请求 ${s.req} 完` }),
  metric: s => (s.seenTotal ? s.savedTotal / s.seenTotal : 0),
  tickLabel: s => (s.act === 'match' ? '命中' : s.act === 'compute' ? '算' : s.act === 'evict' ? '淘汰' : s.act === 'done' ? '毕' : `R${s.req}`),
  whyInRail: true,
  readouts: s => [
    { label: '请求', value: s.req > 0 ? `第 ${s.req} 个` : '—' },
    { label: '本请求命中', value: `${s.hit} 命中 / ${s.compute} 计算` },
    { label: '缓存占用', value: `${s.cached} / ${s.budget} token`, tone: s.cached >= s.budget ? 'bad' : undefined },
    { label: '累计省 prefill', value: s.seenTotal ? `${s.savedTotal} / ${s.seenTotal}（${((s.savedTotal / s.seenTotal) * 100).toFixed(0)}%）` : '—', tone: 'good' },
    { label: '本步', value: { match: '命中复用', compute: '计算 KV', evict: 'LRU 淘汰', reqdone: '请求完成', done: '全部完成' }[s.act] },
  ],
}

// ═══ PagedAttention · KV 分页 · 大模型推理 ═══════════
const paged: Experiment<PagedState> = {
  id: 'paged',
  group: '大模型推理',
  title: 'PagedAttention',
  subtitle: 'KV 分页 · 块表映射 · 消灭外碎片',
  kernel: pagedKernel,
  defaultDoc: { kind: 'paged', params: { schedule: '两请求交错', blockSize: 4, totalBlocks: 8 }, entities: [], streams: [] },
  params: [
    { key: 'schedule', label: '场景', kind: 'enum', options: ['两请求交错', '一请求增长', '释放后复用'] },
    { key: 'blockSize', label: '块大小', kind: 'number', options: [2, 4, 8], unit: 'token' },
    { key: 'totalBlocks', label: '物理块数', kind: 'number', options: [6, 8, 12], unit: '块' },
  ],
  paramsNote: 'vLLM 把操作系统的分页搬到 KV 缓存上：KV 切成固定块、不要求连续，每个请求一张块表映射逻辑块→物理块。交错场景里物理块会非连续——那正是分页相对连续分配的胜利。',
  bounds: [
    '块只记“属于谁·第几个逻辑块”，不建模块内真实 KV 数值',
    '空间不足时只提示“该抢占 / 换出”，不建模抢占策略本身',
    '按驱动脚本依次处理，不建模并发与真实到达时间',
    '不建模 copy-on-write 共享（beam / 前缀共享）—— 那是另一个实验',
  ],
  tabs: [{ id: 'pool', label: '块池与块表' }],
  Stage: PagedStage,
  tone: s => (s.act === 'alloc' ? { key: 'good', label: '分配块' }
    : s.act === 'append' ? { key: 'idle', label: '填入' }
    : s.act === 'free' ? { key: 'bad', label: '归还' }
    : { key: 'good', label: '完成' }),
  metric: s => (s.totalBlocks ? (s.totalBlocks - s.freeCount) / s.totalBlocks : 0),
  tickLabel: s => (s.act === 'alloc' ? '+块' : s.act === 'free' ? '归还' : s.act === 'done' ? '毕' : s.req),
  whyInRail: true,
  readouts: s => [
    { label: '本步请求', value: s.req || '—' },
    { label: '物理块占用', value: `${s.totalBlocks - s.freeCount} / ${s.totalBlocks}`, tone: s.freeCount === 0 ? 'bad' : undefined },
    { label: '空闲块', value: String(s.freeCount) },
    { label: 'A 的块表', value: s.tables.A ? s.tables.A.join(' ') : '—' },
    { label: '本步', value: { alloc: '分配新块', append: '填入旧块', free: '归还空闲池', done: '完成' }[s.act] },
  ],
}

// ═══ softmax 与温度 · 机器学习基础 ══════════════════════
const softmax: Experiment<SoftmaxState> = {
  id: 'softmax',
  group: '机器学习基础',
  title: 'softmax 与温度',
  subtitle: 'logits → 概率 · 温度调的是什么',
  kernel: softmaxKernel,
  defaultDoc: { kind: 'softmax', params: { temperature: 1, logits: '天气续写' }, entities: [], streams: [] },
  params: [
    { key: 'temperature', label: '温度 T', kind: 'number', options: [0.5, 1, 1.5, 2], unit: '' },
    { key: 'logits', label: 'logits 组', kind: 'enum', options: ['天气续写', '接近平局', '一枝独秀'] },
  ],
  paramsNote: '大模型每吐一个字，都对下一个 token 的 logits 做 softmax、再按概率采样。温度 T 就是 softmax 之前先把 logits 除以 T：T 小分布尖（接近贪心）、T 大分布平（更随机）。用熵量化。',
  bounds: [
    'logits 是给定的示例值，不是真跑模型出来的 —— 但 softmax 与温度的数学是精确的',
    'exp 前减去最大值是数值稳定技巧，不改变结果',
    '熵用以 2 为底（bit）；只演示温度对分布的影响，不含 top-k/top-p 截断（那是另一个实验）',
    '概率四舍五入到整数百分比显示，内部按浮点算',
  ],
  tabs: [{ id: 'dist', label: '分布' }],
  Stage: SoftmaxStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '分布' }
    : s.phase === 'norm' ? { key: 'good', label: '归一化' }
    : s.phase === 'scale' ? { key: 'idle', label: '除温度' }
    : s.phase === 'exp' ? { key: 'idle', label: 'exp' }
    : { key: 'idle', label: 'logits' }),
  metric: s => (s.probs.length ? Math.min(1, s.entropy / Math.log2(s.tokens.length || 2)) : 0),
  tickLabel: s => ({ logits: 'logit', scale: '÷T', exp: 'exp', norm: '归一', done: '分布' }[s.phase]),
  whyInRail: true,
  readouts: s => [
    { label: '温度 T', value: String(s.T) },
    { label: '候选数', value: String(s.tokens.length) },
    { label: '最大概率', value: s.probs.length ? `${(Math.max(...s.probs) * 100).toFixed(0)}%` : '—' },
    { label: '熵', value: s.probs.length ? `${s.entropy.toFixed(2)} bit` : '—' },
    { label: '概率和', value: s.probs.length ? s.probs.reduce((a, b) => a + b, 0).toFixed(3) : '—', tone: 'good' },
  ],
}

// ═══ 自注意力 · Transformer 原理 ══════════════════════
const attention: Experiment<AttnState> = {
  id: 'attention',
  group: 'Transformer 原理',
  title: '自注意力手算',
  subtitle: 'Q·K → softmax → 加权求和 V',
  kernel: attentionKernel,
  defaultDoc: { kind: 'attention', params: { sentence: '它爱吃鱼' }, entities: [], streams: [] },
  params: [
    { key: 'sentence', label: '例句', kind: 'enum', options: ['它爱吃鱼', '猫追老鼠'] },
  ],
  paramsNote: '自注意力是 Transformer 的心脏：每个 token 用它的 Q 和全句每个 token 的 K 做点积得分数，softmax 成注意力权重，再按权重把所有 V 加权汇总。Q/K/V 用 2 维小向量，点积能心算。',
  bounds: [
    'Q/K/V 是给定的 2 维示例向量（已投影好）—— 真实模型里它们由 embedding 乘投影矩阵得到，那是另一步',
    '单头注意力；多头（MHA/GQA）是另一个实验',
    '分数除以 √d 是缩放点积注意力的标准做法，防 softmax 饱和',
    '不含 causal mask（那让 token 只能看自己左边）；这里每个 token 看全句',
  ],
  tabs: [{ id: 'attn', label: '注意力' }],
  Stage: AttentionStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '完成' }
    : s.phase === 'sum' ? { key: 'good', label: '加权和' }
    : s.phase === 'softmax' ? { key: 'good', label: 'softmax' }
    : s.phase === 'score' ? { key: 'idle', label: '算分数' }
    : { key: 'idle', label: 'Q/K/V' }),
  metric: s => (s.tokens.length ? s.attn.filter(r => r.length > 0).length / s.tokens.length : 0),
  tickLabel: s => (s.qi >= 0 ? s.tokens[s.qi] : s.phase === 'done' ? '毕' : 'QKV'),
  whyInRail: true,
  readouts: s => {
    const w = s.qi >= 0 ? s.attn[s.qi] : []
    return [
      { label: '当前查询', value: s.qi >= 0 ? s.tokens[s.qi] : '—' },
      { label: '已算行数', value: `${s.attn.filter(r => r.length > 0).length} / ${s.tokens.length}` },
      { label: '本步', value: { setup: '看 Q/K/V', score: '算分数 Q·K', softmax: 'softmax 权重', sum: '加权求和', done: '完成' }[s.phase] },
      { label: '最关注', value: w.length ? s.tokens[w.indexOf(Math.max(...w))] : '—', tone: 'good' },
      { label: '注意力权重', value: w.length ? w.map(x => (x * 100).toFixed(0) + '%').join(' ') : '—' },
    ]
  },
}

// ═══ 参数量与显存 · Transformer 原理 ═════════════════════
const llmsize: Experiment<LlmSizeState> = {
  id: 'llmsize',
  group: 'Transformer 原理',
  title: '参数量与显存',
  subtitle: '7B 为什么要十几 G · KV 缓存',
  kernel: llmSizeKernel,
  defaultDoc: { kind: 'llmsize', params: { model: 'GPT-2 (124M)', dtype: 'fp16', seq: 2048 }, entities: [], streams: [] },
  params: [
    { key: 'model', label: '模型', kind: 'enum', options: ['GPT-2 (124M)', 'GPT-2 Medium (350M)', '7B 级'] },
    { key: 'dtype', label: '精度', kind: 'enum', options: ['fp32', 'fp16', 'int8'] },
    { key: 'seq', label: '序列长度', kind: 'number', options: [512, 2048, 8192], unit: 'token' },
  ],
  paramsNote: '按标准 Transformer 结构现算参数量（GPT-2 small 恰好 124M）：embedding + 层数×（4d² 注意力 + 2·ffn·d² 的 FFN）。权重显存 = 参数量 × 每参数字节（复用 IEEE754 的 dtype）；KV 缓存 = 2·层·序列·d·字节，随序列和并发线性涨。',
  bounds: [
    '标准 dense Transformer；不建模 MoE（激活参数≠总参数）、不含 bias / LayerNorm 的少量参数',
    '词嵌入按未与输出头共享计一次；实际很多模型 tied embedding',
    '显存按十进制（GB=1e9 字节）报，与模型大小惯例一致；不含激活、优化器状态（那是训练）',
    'FFN 按 2 个矩阵（升维+降维）算；SwiGLU 等门控 FFN 有 3 个矩阵，参数更多',
  ],
  tabs: [{ id: 'size', label: '拆解' }],
  Stage: LlmSizeStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '合计' }
    : s.phase === 'weight' || s.phase === 'kv' ? { key: 'bad', label: '显存' }
    : s.phase === 'total' ? { key: 'good', label: '总参数' }
    : { key: 'idle', label: { embed: '嵌入', attn: '注意力', ffn: 'FFN' }[s.phase] ?? '' }),
  metric: s => (s.total ? Math.min(1, s.total / 8e9) : 0),
  tickLabel: s => ({ embed: '嵌入', attn: '注意力', ffn: 'FFN', total: '总数', weight: '权重', kv: 'KV', done: '毕' }[s.phase]),
  whyInRail: true,
  readouts: s => [
    { label: '模型', value: `${s.L}层 · d=${s.d}` },
    { label: '总参数', value: s.total ? fmtNr(s.total) : '—' },
    { label: '权重显存', value: s.weightBytes ? fmtBr(s.weightBytes) : '—', tone: 'bad' },
    { label: `KV / 序列 ${s.seq}`, value: s.kvBytes ? fmtBr(s.kvBytes) : '—' },
    { label: '精度', value: `${s.dtype}（${s.bytes} 字节）` },
  ],
}
const fmtNr = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : (n / 1e6).toFixed(0) + 'M'
const fmtBr = (b: number) => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : (b / 1e6).toFixed(0) + ' MB'

// ═══ 采样解码旋钮台 · Transformer 原理 ═══════════════════
const sampling: Experiment<SamplingState> = {
  id: 'sampling',
  group: 'Transformer 原理',
  title: '采样解码旋钮台',
  subtitle: '温度 · top-k · top-p 截断',
  kernel: samplingKernel,
  defaultDoc: { kind: 'sampling', params: { temperature: 1, topK: 3, topP: 1, logits: '长尾一堆' }, entities: [], streams: [] },
  params: [
    { key: 'temperature', label: '温度 T', kind: 'number', options: [0.7, 1, 1.3] },
    { key: 'topK', label: 'top-k', kind: 'number', options: [0, 2, 3, 5], unit: '0=关' },
    { key: 'topP', label: 'top-p', kind: 'number', options: [0.5, 0.8, 0.9, 1], unit: '1=关' },
    { key: 'logits', label: 'logits 组', kind: 'enum', options: ['长尾一堆', '两强争锋'] },
  ],
  paramsNote: '接着 softmax 往下：吐字前先砍长尾。top-k 只留概率最高的 k 个；top-p（核采样）把概率从大到小累加、留累计刚超 p 的一小撮。砍完重新归一化再采。复用排序（按概率降序）。',
  bounds: [
    'logits 是示例值；softmax、top-k、top-p、重归一化的数学是精确的',
    'top-k 与 top-p 同开时取交集（都满足才留）',
    '只演示"截断出候选集"，真正的"随机采一个"是从最终分布里按概率抽 —— 这一步不建模具体随机数',
    '不含重复惩罚 / 频率惩罚（那是另一组旋钮）',
  ],
  tabs: [{ id: 'sample', label: '采样' }],
  Stage: SamplingStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '采样集' }
    : s.phase === 'renorm' ? { key: 'good', label: '归一化' }
    : s.phase === 'topk' ? { key: 'bad', label: 'top-k' }
    : s.phase === 'topp' ? { key: 'bad', label: 'top-p' }
    : s.phase === 'sort' ? { key: 'idle', label: '排序' }
    : { key: 'idle', label: 'softmax' }),
  metric: s => (s.tokens.length ? s.kept.filter(Boolean).length / s.tokens.length : 0),
  tickLabel: s => ({ softmax: 'softmax', sort: '排序', topk: 'top-k', topp: 'top-p', renorm: '归一', done: '采样' }[s.phase]),
  whyInRail: true,
  readouts: s => [
    { label: '温度 / k / p', value: `${s.T} / ${s.k > 0 ? s.k : '关'} / ${s.p < 1 ? s.p : '关'}` },
    { label: '候选总数', value: String(s.tokens.length) },
    { label: '保留候选', value: `${s.kept.filter(Boolean).length} 个`, tone: 'good' },
    { label: '本步', value: { softmax: 'softmax', sort: '按概率排序', topk: 'top-k 截断', topp: 'top-p 截断', renorm: '重新归一化', done: '得采样集' }[s.phase] },
    { label: '砍掉', value: `${s.tokens.length - s.kept.filter(Boolean).length} 个长尾` },
  ],
}

// ═══ BPE 分词 · Transformer 原理 ══════════════════════
const bpe: Experiment<BpeState> = {
  id: 'bpe',
  group: 'Transformer 原理',
  title: 'BPE 分词逐步合并',
  subtitle: '中文为什么更贵',
  kernel: bpeKernel,
  defaultDoc: { kind: 'bpe', params: { text: '英文 lowest' }, entities: [], streams: [] },
  params: [
    { key: 'text', label: '例子', kind: 'enum', options: ['英文 lowest', '重复串 abab', '中文 你好'] },
  ],
  paramsNote: 'BPE 先把文本拆成最小单位，再按训练好的 merge 表逐条把高频相邻对合成一个 token。merge 表主要在英文语料上学，所以英文常见词能一路合并、token 很少；中文的组合大多不在表里、合并不动，token 就多 —— 按 token 计费自然更贵。',
  bounds: [
    'merge 表是手工示例（几条规则），不是真实分词器的几万条 —— 但"逐步合并"的机制一致',
    '中文示例按字给，真实 byte-level BPE 会先把中文拆成 2-3 个 UTF-8 字节，token 更多',
    '只演示编码（用 merge 表切一段文本），不含 merge 表的训练过程',
    'token 数用于说明相对成本，不对应具体某个模型的计费',
  ],
  tabs: [{ id: 'bpe', label: '合并' }],
  Stage: BpeStage,
  tone: s => (s.act === 'done' ? { key: 'good', label: '完成' }
    : s.act === 'merge' ? { key: 'good', label: '合并' }
    : s.act === 'nomerge' ? { key: 'bad', label: '合并不动' }
    : { key: 'idle', label: '拆分' }),
  metric: s => (s.start ? 1 - s.toks.length / s.start : 0),
  tickLabel: s => (s.act === 'merge' ? s.merged : s.act === 'done' ? '毕' : s.act === 'nomerge' ? '不动' : '拆'),
  whyInRail: true,
  readouts: s => [
    { label: '起始符号', value: String(s.start) },
    { label: '当前 token', value: String(s.toks.length), tone: 'good' },
    { label: '压缩到', value: `${Math.round((s.toks.length / Math.max(1, s.start)) * 100)}%` },
    { label: '本步', value: { init: '拆最小单位', merge: '合并一对', nomerge: '合并不动', done: '完成' }[s.act] },
    { label: '剩余规则', value: String(s.ruleLeft) },
  ],
}

// ═══ 连续批处理 · 大模型推理 ═══════════════════════════
const batching: Experiment<BatchState> = {
  id: 'batching',
  group: '大模型推理',
  title: '连续批处理',
  subtitle: '请求组批 · 空槽随时补 · 复用调度',
  kernel: batchingKernel,
  defaultDoc: { kind: 'batching', params: { mode: '连续', slots: 2 }, entities: [], streams: [] },
  params: [
    { key: 'mode', label: '批处理方式', kind: 'enum', options: ['连续', '静态'] },
    { key: 'slots', label: 'batch 槽数', kind: 'number', options: [2, 3, 4], unit: '槽' },
  ],
  paramsNote: '推理引擎把多个请求凑成 batch 一起过 GPU。请求长短不一、到达时间不同：静态批处理等整批跑完才收下一批，空槽白白浪费；连续批处理每个 decode 步都把空槽补满，GPU 尽量不空转。本质就是把进程调度搬到 GPU 上：槽=CPU、请求=进程、decode 步=时间片。',
  bounds: [
    '请求的到达时间和 decode 步数是固定示例；真实系统里它们是动态、随机的',
    '每个 decode 步耗时视为相同；真实里长请求的注意力算得更慢',
    '不建模 prefill 阶段与 decode 混排（chunked prefill 是另一个实验）',
    '利用率按"在跑的槽数/总槽数"算，不含显存约束下的实际可容纳数',
  ],
  tabs: [{ id: 'batch', label: '批次' }],
  Stage: BatchingStage,
  tone: s => (s.act === 'done' ? { key: 'good', label: '完成' }
    : s.act === 'idle' ? { key: 'bad', label: '空转' }
    : s.util >= 0.99 ? { key: 'good', label: '满载' }
    : { key: 'idle', label: `${Math.round(s.util * 100)}%` }),
  metric: s => s.util,
  tickLabel: s => (s.act === 'idle' ? '空转' : s.act === 'done' ? '毕' : `${Math.round(s.util * 100)}%`),
  whyInRail: true,
  readouts: s => [
    { label: '方式', value: s.mode === 'cont' ? '连续' : '静态' },
    { label: '调度步', value: String(s.step) },
    { label: '在跑 / 槽', value: `${s.active.length + s.done.length} / ${s.slots}` },
    { label: '利用率', value: `${Math.round(s.util * 100)}%`, tone: s.util >= 0.99 ? 'good' : s.util < 0.6 ? 'bad' : undefined },
    { label: '排队 / 完成', value: `${s.waiting.length} / ${s.finished.length}` },
  ],
}

// ═══ 多头注意力 MHA/MQA/GQA · Transformer 原理 ═══════════
const mha: Experiment<MhaState> = {
  id: 'mha',
  group: 'Transformer 原理',
  title: 'MHA / MQA / GQA',
  subtitle: 'KV 头共享 · KV 缓存省多少',
  kernel: mhaKernel,
  defaultDoc: { kind: 'mha', params: { variant: 'GQA', heads: 8, groups: 2 }, entities: [], streams: [] },
  params: [
    { key: 'variant', label: '变体', kind: 'enum', options: ['MHA', 'MQA', 'GQA'] },
    { key: 'heads', label: 'query 头数', kind: 'number', options: [4, 8], unit: '头' },
    { key: 'groups', label: 'GQA 分组', kind: 'number', options: [2, 4], unit: '组' },
  ],
  paramsNote: '注意力分多个头并行。三种变体差在 KV 头怎么共享：MHA 每个 query 头独占一个 KV 头（KV 缓存最大）；MQA 所有 query 头共享 1 个（最小、可能掉点）；GQA 分组共享（折中、主流）。KV 缓存 ∝ KV 头数 —— 这就是"KV 吃显存"催生 GQA 的原因，接上参数量与显存那一屏。',
  bounds: [
    '只展示 query 头到 KV 头的映射与 KV 缓存比例，不算注意力本身的数值（那在自注意力实验）',
    'GQA 按组均分 query 头；真实模型的分组数由架构定',
    'KV 缓存比例按 KV 头数 / query 头数算，不含每头维度的细节',
    '掉点 / 表达力是定性说明，不做精度实测',
  ],
  tabs: [{ id: 'heads', label: '头共享' }],
  Stage: MhaStage,
  tone: s => (s.act === 'done' ? { key: 'good', label: `KV ${Math.round(s.kvRatio * 100)}%` }
    : { key: 'idle', label: `头 ${s.focus}` }),
  metric: s => 1 - s.kvRatio,
  tickLabel: s => (s.focus >= 0 ? `q${s.focus}` : '毕'),
  whyInRail: true,
  readouts: s => [
    { label: '变体', value: s.variant },
    { label: 'query 头', value: String(s.heads) },
    { label: 'KV 头', value: String(s.kvHeads) },
    { label: 'KV 缓存', value: `${Math.round(s.kvRatio * 100)}% of MHA`, tone: s.kvRatio < 1 ? 'good' : undefined },
    { label: '本步', value: s.act === 'done' ? '完成' : `query 头 ${s.focus} → KV 头 ${s.map[s.focus]}` },
  ],
}

const kvcache: Experiment<KvCacheState> = {
  id: 'kvcache',
  group: '大模型推理',
  title: 'KV 缓存',
  subtitle: '把算过的 K/V 存起来 · 每步只算新 token',
  kernel: kvcacheKernel,
  defaultDoc: { kind: 'kvcache', params: { prompt: 2, total: 6 }, entities: [], streams: [] },
  params: [
    { key: 'prompt', label: '提示词长度', kind: 'number', options: [1, 2, 3], unit: 'token' },
    { key: 'total', label: '总长度', kind: 'number', options: [5, 6, 7, 8], unit: 'token' },
  ],
  paramsNote: '自回归解码：每生成一个新 token，注意力都要用到前面所有 token 的 K/V。无缓存每步把整段 K/V 重算一遍（~L²/2 次）；有缓存把算过的存起来，每步只算新 token 那一个（共 L 次）。代价是缓存占显存，∝ 序列长度 —— 这就是 PagedAttention / GQA / KV 卸载都在省的那块。',
  bounds: [
    '只数 K/V 的计算次数（每 token 一次为单位），不算具体浮点数',
    '预填充把提示词一次算完，之后逐 token 解码',
    '无缓存对照假设每步重算整段前缀的 K/V，这是朴素实现的真实代价',
    '缓存大小按 K/V 对数计，未展开每对的维度 / 层数 / 字节数（见参数量与显存）',
  ],
  tabs: [{ id: 'seq', label: '序列与计算量' }],
  Stage: KvCacheStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `省 ${s.savedPct}%` }
    : s.phase === 'prefill' ? { key: 'idle', label: '预填充' }
      : { key: 'idle', label: `第 ${s.seq.length} 个` }),
  metric: s => (s.cumNaive > 0 ? 1 - s.cumCached / s.cumNaive : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.phase === 'prefill' ? '预' : `t${s.seq.length}`),
  whyInRail: true,
  readouts: s => [
    { label: '序列长度', value: `${s.seq.length} token` },
    { label: '缓存', value: `${s.cacheSize} 对 K/V` },
    { label: '本步算', value: `有缓存 ${s.computed} · 无缓存 ${s.recomputed}` },
    { label: '累计', value: `${s.cumCached} vs ${s.cumNaive}` },
    { label: '省下', value: s.phase === 'done' ? `${s.savedPct}%` : '—', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const flash: Experiment<FlashState> = {
  id: 'flash',
  group: '大模型推理',
  title: 'FlashAttention',
  subtitle: '在线 softmax 分块 · 分数矩阵不落 HBM',
  kernel: flashKernel,
  defaultDoc: { kind: 'flash', params: { block: 2 }, entities: [], streams: [] },
  params: [
    { key: 'block', label: '块大小', kind: 'number', options: [1, 2, 3], unit: '键/块' },
  ],
  paramsNote: '朴素注意力先把整行分数 S=Q·Kᵀ 写进 HBM，再读回做 softmax、再读一遍算 ×V —— 那条长度 N 的分数向量在 HBM 里来回搬好几趟。FlashAttention 把 K/V 切块，一块一块在片上 SRAM 里用在线 softmax 累加（维护滚动的 m/l/O），分数向量从不落 HBM。数学上和一次性 softmax 完全等价 —— 改块大小，最终结果分毫不差，省的是访存不是精度。',
  bounds: [
    'value 用 1 维标量便于手核；真实是向量，机制相同',
    '在线 softmax 每来一块先把旧累加按 exp(Δm) 缩放对齐，再加本块贡献 —— 与一次性 softmax 数学等价',
    'HBM 流量用"分数向量搬运趟数"表示：朴素 ~3N、flash 0；未建模 K/V 的读入与 SRAM 容量细节',
    '只算一个查询对一行键的注意力；多查询按块并行是同一招的平铺',
  ],
  tabs: [{ id: 'scan', label: '分块扫描' }],
  Stage: FlashStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '与真值等价' }
    : { key: 'idle', label: `扫块 ${s.block.join('')}` }),
  metric: s => Math.max(0, 1 - s.err),
  tickLabel: s => (s.phase === 'done' ? '毕' : `b${s.block[0] ?? ''}`),
  whyInRail: true,
  readouts: s => [
    { label: '块大小', value: `${s.blockSize} 键/块` },
    { label: '滚动 m / l', value: `${s.m === -Infinity ? '−∞' : s.m.toFixed(2)} / ${s.l.toFixed(2)}` },
    { label: '当前输出 O/l', value: s.out.toFixed(3) },
    { label: '真值对照', value: s.naive.toFixed(3) },
    { label: '相对误差', value: s.phase === 'done' ? `${(s.err * 1e9).toFixed(1)}e-9` : `${(s.err * 100).toFixed(1)}%`, tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const scaledmask: Experiment<ScaledMaskState> = {
  id: 'scaledmask',
  group: 'Transformer 原理',
  title: '缩放点积 + 因果掩码',
  subtitle: '除 √d 防饱和 · causal mask 成下三角',
  kernel: scaledmaskKernel,
  defaultDoc: { kind: 'scaledmask', params: { d: 4, causal: 1 }, entities: [], streams: [] },
  params: [
    { key: 'd', label: '头维度 d', kind: 'number', options: [1, 4, 64], unit: '维' },
    { key: 'causal', label: '因果掩码', kind: 'number', options: [1, 0], unit: '开/关' },
  ],
  paramsNote: '注意力打分后有两步小处理，却决定模型能不能训练、能不能自回归生成：① 除 √d —— 点积随维度 d 变大，太大 softmax 会饱和（一个≈1、其余≈0，梯度消失），除 √d 把量程拉回来；② causal mask —— 生成时第 i 个词只能看 ≤i 的词，把未来位分数设 −∞，softmax 后权重恰为 0，注意力矩阵成下三角。调大 d 看分布变平，关掉掩码看矩阵变满。',
  bounds: [
    'Q·K 原始分数用固定小矩阵便于手核；真实由 embedding 投影点积得到',
    '除 √d 的效果用"本行最大权重"对比有无缩放来体现饱和程度',
    'causal mask 把 j>i 的位设 −∞ → softmax 权重恰为 0，矩阵成严格下三角',
    '每行 softmax 和为 1；只展示权重，不再往下算 ×V（那在自注意力实验）',
  ],
  tabs: [{ id: 'matrix', label: '注意力矩阵' }],
  Stage: ScaledMaskStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: s.causal ? '下三角' : '双向满' }
    : { key: 'idle', label: `行 ${s.row}` }),
  metric: s => 1 - s.peak,
  tickLabel: s => (s.phase === 'done' ? '毕' : `q${s.row}`),
  whyInRail: true,
  readouts: s => [
    { label: '头维度 d', value: `${s.d}（√d=${s.scale.toFixed(2)}）` },
    { label: '因果掩码', value: s.causal ? '开（下三角）' : '关（双向）' },
    { label: '当前行', value: s.phase === 'done' ? '完成' : `${s.tokens[s.row] ?? ''}（第 ${s.row} 行）` },
    { label: '本行最大权重', value: s.raw.length ? `${Math.round(s.peak * 100)}%` : '—' },
    { label: '不除 √d 会到', value: s.raw.length && s.d > 1 ? `${Math.round(s.peakUnscaled * 100)}%（更饱和）` : '—', tone: undefined },
  ],
}

const specdec: Experiment<SpecDecState> = {
  id: 'specdec',
  group: '大模型推理',
  title: '投机解码',
  subtitle: '小模型猜 K 个 · 大模型一次验证多个',
  kernel: specdecKernel,
  defaultDoc: { kind: 'specdec', params: { k: 3 }, entities: [], streams: [] },
  params: [
    { key: 'k', label: '草稿步数 K', kind: 'number', options: [1, 2, 3, 4], unit: 'token/轮' },
  ],
  paramsNote: '大模型逐字解码，每个字跑一遍完整前向（贵）。投机解码让便宜的草稿模型一口气猜 K 个后续 token，大模型一次前向并行验证这 K+1 个位置：接受草稿猜对的最长前缀，第一个错处用大模型真值纠正，全中还白送 1 个。一次大模型前向能落地多个 token。接受/纠正规则保证输出与只用大模型逐字生成完全一致 —— 省的是前向次数不是质量。K 越大、草稿越准，接受越多、越快。',
  bounds: [
    '草稿与目标的续写用固定串（草稿在两处猜错），便于手核',
    '展示贪心版：落地的 token 一律取目标真值，因此输出与只用大模型逐字一致',
    '一次大模型前向 = 接受前缀 + 1（纠正首错或全中白送）；加速比 = 出字数 / 前向次数',
    '未建模草稿模型自身的成本与真实采样版的拒绝采样细节',
  ],
  tabs: [{ id: 'verify', label: '猜测与验证' }],
  Stage: SpecDecStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.speedup.toFixed(2)}×` }
    : { key: 'idle', label: `第 ${s.targetPasses} 轮` }),
  metric: s => Math.max(0, (s.speedup - 1) / 3),
  tickLabel: s => (s.phase === 'done' ? '毕' : `r${s.targetPasses}`),
  whyInRail: true,
  readouts: s => [
    { label: '草稿步数 K', value: `${s.K}` },
    { label: '本轮接受', value: s.phase === 'done' ? '—' : `前 ${s.matchLen} 个${s.bonus ? '（全中+白送）' : '，纠正 1 个'}` },
    { label: '已出字', value: `${s.tokensOut}` },
    { label: '大模型前向', value: `${s.targetPasses} 次` },
    { label: '加速比', value: `${s.speedup.toFixed(2)}×`, tone: s.speedup > 1 ? 'good' : undefined },
  ],
}

const quant: Experiment<QuantState> = {
  id: 'quant',
  group: 'Transformer 原理',
  title: '权重量化 W8 / W4',
  subtitle: 'fp32 → int8/int4 · 拿精度换显存',
  kernel: quantKernel,
  defaultDoc: { kind: 'quant', params: { bits: 8 }, entities: [], streams: [] },
  params: [
    { key: 'bits', label: '量化位数', kind: 'number', options: [8, 4], unit: 'bit' },
  ],
  paramsNote: '大模型显存几乎全被权重占（见参数量与显存）。对称量化把 fp32 权重压成低位整数：scale = max|w| ÷ (2^(bits-1)−1)，q = round(w/scale) 截断，反量化 ŵ = q·scale。int8 每权重 1 字节（vs fp32 的 4）、int4 只 0.5 字节 —— 位越少越省显存，舍入误差越大。切 8/4 位看整数、误差、显存怎么此消彼长；这正是 IEEE754 浮点 / 补码那两屏的延续。',
  bounds: [
    '用固定 8 个权重、对称 per-tensor 量化，便于手核',
    'scale = max|w| ÷ qmax；q 截断到 ±qmax；反量化 ŵ = q·scale',
    'int8 每权重 1 字节、int4 0.5 字节；未含 scale/zero-point 的分组存储开销',
    '只量化权重（W8/W4），未展开激活量化与 W8A8 矩阵乘的细节',
  ],
  tabs: [{ id: 'quant', label: '量化与误差' }],
  Stage: QuantStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `省 ${Math.round((1 - s.bytesQ / s.bytesFp32) * 100)}%` }
    : s.phase === 'scale' ? { key: 'idle', label: '定标' }
      : { key: 'idle', label: `w${s.cursor}` }),
  metric: s => 1 - s.bytesQ / s.bytesFp32,
  tickLabel: s => (s.phase === 'done' ? '毕' : s.phase === 'scale' ? '标' : `w${s.cursor}`),
  whyInRail: true,
  readouts: s => [
    { label: '量化位数', value: `int${s.bits}（±${s.qmax}）` },
    { label: 'scale', value: s.scale.toFixed(4) },
    { label: '显存', value: `${s.bytesFp32}B → ${s.bytesQ}B` },
    { label: '最大误差', value: s.phase === 'scale' ? '—' : s.maxErr.toFixed(3), tone: undefined },
    { label: '省下', value: `${Math.round((1 - s.bytesQ / s.bytesFp32) * 100)}%`, tone: 'good' },
  ],
}

const moe: Experiment<MoeState> = {
  id: 'moe',
  group: 'Transformer 原理',
  title: 'FFN 与 MoE 路由',
  subtitle: '每个 token 只选 top-k 个专家',
  kernel: moeKernel,
  defaultDoc: { kind: 'moe', params: { topk: 2 }, entities: [], streams: [] },
  params: [
    { key: 'topk', label: '每 token 选几个专家', kind: 'number', options: [1, 2], unit: '个' },
  ],
  paramsNote: 'Transformer 每层除了注意力还有 FFN，参数量通常最大。稠密 FFN 每个 token 都过同一个大网络，全部参数都算。MoE 把大 FFN 拆成 E 个小专家，router 给每个 token 打分、softmax 取门控最高的 top-k 个专家来算，输出 = Σ 门控·专家。参数随专家数涨、算力只随 k 涨（活跃参数 ∝ k/E）—— 这就是"总参数几百 B、推理只激活几十 B"。代价是负载可能不均。',
  bounds: [
    'E=4 个专家、固定 router 分数便于手核；真实专家数可到几十上百',
    '门控 = softmax(router 分数)，取 top-k 后在 k 个内重新归一化',
    '负载 = 每个专家累计接的 token 数；不均衡是 MoE 的真实难题（需负载均衡/辅助损失）',
    '只展示路由与负载，不算专家内部的 FFN 数值',
  ],
  tabs: [{ id: 'route', label: '路由与负载' }],
  Stage: MoeStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `活跃 ${Math.round(s.activeFrac * 100)}%` }
    : { key: 'idle', label: s.tokens[s.cursor] ?? '路由' }),
  metric: s => 1 - s.activeFrac,
  tickLabel: s => (s.phase === 'done' ? '毕' : s.tokens[s.cursor] ?? '·'),
  whyInRail: true,
  readouts: s => [
    { label: '专家数 E', value: `${s.experts}` },
    { label: 'top-k', value: `${s.topk}` },
    { label: '活跃参数', value: `${Math.round(s.activeFrac * 100)}%（${s.topk}/${s.experts}）`, tone: 'good' },
    { label: '当前路由', value: s.phase === 'done' ? '完成' : `${s.tokens[s.cursor] ?? ''} → 专家 ${s.chosen.join(',')}` },
    { label: '负载', value: `[${s.load.join(', ')}]` },
  ],
}

const rope: Experiment<RopeState> = {
  id: 'rope',
  group: 'Transformer 原理',
  title: 'RoPE 旋转位置编码',
  subtitle: '位置 = 旋转角 · 只编码相对位置',
  kernel: ropeKernel,
  defaultDoc: { kind: 'rope', params: { theta: 45 }, entities: [], streams: [] },
  params: [
    { key: 'theta', label: '每位旋转角 θ', kind: 'number', options: [30, 45, 60], unit: '°' },
  ],
  paramsNote: '注意力本身不带位置信息（打乱词序结果一样）。RoPE 把每对相邻维度当成 2D 向量，按「位置 × 频率 θ」旋转。旋转不改模长、只改方向。关键：位置 m 的 query 与位置 n 的 key 旋转后点积只依赖夹角差 (m−n)·θ —— 只和相对位置有关。真实 RoPE 给每对维度不同 θ：转得快的编精细位置、慢的编粗位置。改 θ 看向量转得多快、模长始终 1。',
  bounds: [
    '只展示一对维度（一个 2D 向量）；真实 d 维有 d/2 对、各自频率不同',
    'θ 用固定度数便于观察；真实 θᵢ = base^(−2i/d) 跨好几个数量级',
    '模长恒为 1（旋转保范）；与位置 0 的点积 = cos(p·θ)，体现相对位置',
    '不算注意力后续，只演示位置怎么进 Q/K',
  ],
  tabs: [{ id: 'circle', label: '单位圆旋转' }],
  Stage: RopeStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '模长恒 1' }
    : { key: 'idle', label: `${s.angleDeg}°` }),
  metric: s => (s.dotWith0 + 1) / 2,
  tickLabel: s => (s.phase === 'done' ? '毕' : `p${s.pos}`),
  whyInRail: true,
  readouts: s => [
    { label: '每位旋转角 θ', value: `${s.thetaDeg}°` },
    { label: '位置 p', value: s.phase === 'done' ? '—' : `${s.pos}` },
    { label: '旋转角 p·θ', value: `${s.angleDeg}°` },
    { label: '模长 |v|', value: s.norm.toFixed(3), tone: 'good' },
    { label: '与位置0点积', value: `${s.dotWith0.toFixed(3)} = cos(p·θ)` },
  ],
}

const roofline: Experiment<RooflineState> = {
  id: 'roofline',
  group: '大模型推理',
  title: 'Roofline 性能建模',
  subtitle: '算术强度 vs 屋顶 · 卡带宽还是卡算力',
  kernel: rooflineKernel,
  defaultDoc: { kind: 'roofline', params: { d: 4096 }, entities: [], streams: [] },
  params: [
    { key: 'd', label: '模型维度 d', kind: 'number', options: [2048, 4096], unit: '维' },
  ],
  paramsNote: '一个 kernel 快不快，既看算多少（FLOPs）也看搬多少（字节）。算术强度 AI = FLOPs/字节。机器有峰值算力 P 和峰值带宽 B，脊点 = P/B。可达性能 = min(P, AI·B)：AI < 脊点卡带宽、AI > 脊点卡算力。大模型解码是矩阵×向量，权重读一遍只用一次，AI≈1、深陷带宽瓶颈 —— 批越大 AI 越高、越往算力屋顶靠。这就是连续批处理、KV 缓存、FlashAttention 在做的事。',
  bounds: [
    '典型 fp16 加速卡：峰值算力 312 TFLOP/s、带宽 2 TB/s、脊点 156 FLOP/字节',
    '工作负载 = 权重矩阵乘 y=W·X（W:d×d 固定，批 b 复用同一份权重）',
    'AI = 2·d²·b ÷ [2·(d²+d·b+d·b)] ≈ b；可达性能 = min(峰值, AI·带宽)',
    '简化模型：只算这一层的 FLOPs/字节，未含激活、KV、通信等',
  ],
  tabs: [{ id: 'roof', label: '屋顶线图' }],
  Stage: RooflineStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `到 ${Math.round(s.util * 100)}%` }
    : { key: s.bound === 'memory' ? 'bad' : 'good', label: s.bound === 'memory' ? '卡带宽' : '卡算力' }),
  metric: s => s.util,
  tickLabel: s => (s.phase === 'done' ? '毕' : `b${s.batch}`),
  whyInRail: true,
  readouts: s => [
    { label: '模型维度 d', value: `${s.d}` },
    { label: '批大小', value: s.phase === 'done' ? '—' : `${s.batch}` },
    { label: '算术强度 AI', value: `${s.ai.toFixed(1)}（脊点 ${s.ridge}）` },
    { label: '瓶颈', value: s.bound === 'memory' ? '带宽 memory-bound' : '算力 compute-bound', tone: s.bound === 'memory' ? 'bad' : 'good' },
    { label: '算力利用率', value: `${Math.round(s.util * 100)}%（${s.attainTFLOPs} TF/s）` },
  ],
}

const rmsnorm: Experiment<RmsNormState> = {
  id: 'rmsnorm',
  group: 'Transformer 原理',
  title: 'RMSNorm 归一化',
  subtitle: '除以均方根 · 不减均值',
  kernel: rmsnormKernel,
  defaultDoc: { kind: 'rmsnorm', params: { gain: '全 1' }, entities: [], streams: [] },
  params: [
    { key: 'gain', label: '可学习增益 g', kind: 'enum', options: ['全 1', '放大末维'] },
  ],
  paramsNote: 'Transformer 每个子层前都要归一化，否则数值忽大忽小、训练不稳。RMSNorm 比 LayerNorm 更简：不减均值，只用均方根 RMS=√mean(x²) 把向量缩到单位尺度，再乘可学习增益 g（每维一个）：x̂ᵢ = xᵢ/RMS·gᵢ。少一次求均值、少一组偏置参数，效果却相当 —— LLaMA、Qwen 等都用它。改增益看某一维被放大。',
  bounds: [
    '用固定 4 维向量便于手核；真实 d 维同理',
    'RMS = √(各维平方的平均)；不减均值是 RMSNorm 与 LayerNorm 的关键区别',
    '归一化后（未乘增益）向量 RMS 恰为 1；增益 g 再逐维缩放',
    '省略了数值稳定用的 eps；只演示归一化本身',
  ],
  tabs: [{ id: 'norm', label: '归一化步骤' }],
  Stage: RmsNormStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: 'RMS→1' }
    : s.phase === 'rms' ? { key: 'idle', label: `RMS ${s.rms}` }
      : { key: 'idle', label: s.phase === 'square' ? '平方' : `第 ${s.cursor} 维` }),
  metric: s => (s.rms > 0 ? Math.min(1, s.outRms) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.phase === 'square' ? '²' : s.phase === 'rms' ? '√' : `d${s.cursor}`),
  whyInRail: true,
  readouts: s => [
    { label: '输入 x', value: `[${s.x.join(', ')}]` },
    { label: '均方 mean(x²)', value: s.meanSq ? `${s.meanSq}` : '—' },
    { label: 'RMS', value: s.rms ? `${s.rms}` : '—' },
    { label: '归一化后 RMS', value: s.outRms ? `${s.outRms}` : '—', tone: Math.abs(s.outRms - 1) < 0.01 ? 'good' : undefined },
    { label: '本步', value: s.phase === 'done' ? '完成' : s.phase === 'normalize' ? `第 ${s.cursor} 维` : s.phase },
  ],
}

const forward: Experiment<ForwardState> = {
  id: 'forward',
  group: 'Transformer 原理',
  title: '完整前向拼装',
  subtitle: '一次真实推理 · 收口把零件串起来',
  kernel: forwardKernel,
  defaultDoc: { kind: 'forward', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '把这条路上学过的零件串成一次真实前向：词嵌入 → RMSNorm → 自注意力(Q·Kᵀ/√d→掩码→softmax→·V) → 残差 → RMSNorm → FFN(relu) → 残差 → 末层 RMSNorm → LM 头 → logits → softmax → 采样下一个 token。每一段都对应前面一个实验。这就是推理引擎每步 decode 真正跑的那条链 —— KV 缓存、FlashAttention、量化、连续批处理，优化的都是它。为聚焦机制：d=4、单头单层、Q/K/V 投影取恒等，其余权重固定。',
  bounds: [
    'd=4、单头、单层、词表 4 —— 小到能逐段手核；真实模型同样的链、更大的维度和更多层',
    'Q/K/V 投影取恒等矩阵（真实是可学习），其余 FFN / LM 头权重固定',
    '每段向量、注意力权重、logits、概率都由前面各实验的公式现算',
    '贪心取最大概率作预测；省略 KV 缓存等推理期优化（那些是加速这条链，不改结果）',
  ],
  tabs: [{ id: 'pipe', label: '前向流水' }],
  Stage: ForwardStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `→ ${s.predicted}` }
    : { key: 'idle', label: `第 ${s.stageIdx + 1}/10 段` }),
  metric: s => (s.stageIdx + 1) / 11,
  tickLabel: s => (s.phase === 'done' ? '毕' : `${s.stageIdx + 1}`),
  whyInRail: true,
  readouts: s => [
    { label: '输入序列', value: s.seq.join(' ') },
    { label: '当前段', value: s.phase === 'done' ? '完成' : s.stageName },
    { label: '对应实验', value: s.stageLink && s.stageLink !== '—' ? s.stageLink : '—' },
    { label: '末向量', value: s.vec.length ? `[${s.vec.map(v => v.toFixed(1)).join(', ')}]` : '—' },
    { label: '预测下一 token', value: s.predicted ?? '推理中…', tone: s.predicted ? 'good' : undefined },
  ],
}

const matmul: Experiment<MatmulState> = {
  id: 'matmul',
  group: '机器学习基础',
  title: '矩阵乘法',
  subtitle: 'C = A·B · 一切神经网络的地基',
  kernel: matmulKernel,
  defaultDoc: { kind: 'matmul', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '本实验的自由度在固定的 A、B 两个小矩阵上（便于逐格手核），没有可调标量。神经网络几乎每步都是矩阵乘：注意力的 Q·Kᵀ、FFN 的 W·x、LM 头投影。规则：A[M×K]·B[K×N]=C[M×N]，内维 K 必须对上；每格 C[i][j]=Σ A[i][k]·B[k][j]（一行点一列）；总运算量 2·M·N·K。FlashAttention 分块、张量并行切矩阵，切的都是这个乘法而不改结果 —— 所以它是那些的地基。',
  bounds: [
    '用固定 2×3 · 3×2 小矩阵，便于逐格手核；真实维度成千上万，机制相同',
    '每格 = A 一行点 B 一列；内维 K 对不上就不能乘',
    'FLOPs = 2·M·N·K（K 次乘 + K 次加，每格 2K）',
    '只演示朴素逐格算法；分块/并行是同一乘法的不同访存与切分（见 FlashAttention / 张量并行）',
  ],
  tabs: [{ id: 'grid', label: '逐格相乘' }],
  Stage: MatmulStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.M}×${s.N} 算完` }
    : { key: 'idle', label: `C[${s.row}][${s.col}]` }),
  metric: s => (s.totalFlops > 0 ? s.flops / s.totalFlops : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : `${s.row}${s.col}`),
  whyInRail: true,
  readouts: s => [
    { label: '形状', value: `${s.M}×${s.K} · ${s.K}×${s.N} → ${s.M}×${s.N}` },
    { label: '当前格', value: s.phase === 'done' ? '完成' : `C[${s.row}][${s.col}]` },
    { label: '本格值', value: s.phase === 'done' ? '—' : `${s.value}` },
    { label: 'FLOPs', value: `${s.flops} / ${s.totalFlops}` },
    { label: '总量公式', value: '2·M·N·K' },
  ],
}

const tensorpar: Experiment<TensorParState> = {
  id: 'tensorpar',
  group: '大模型推理',
  title: '张量并行',
  subtitle: 'W 按列切到多卡 · 各算一片再拼回',
  kernel: tensorparKernel,
  defaultDoc: { kind: 'tensorpar', params: { gpus: 2 }, entities: [], streams: [] },
  params: [
    { key: 'gpus', label: 'GPU 数 G', kind: 'number', options: [2, 4], unit: '张' },
  ],
  paramsNote: '一个大矩阵乘 Y=X·W 大到单卡装不下/算不快时，切到多张 GPU 分头算 —— 这就是张量并行。列并行：W[K×N] 按列切成 G 份，第 g 张卡拿一段列、算出 Y 的对应片（Y_g=X·W_g），各卡只存 1/G 的 W、只算 1/G 的乘法；最后 all-gather 拼成完整 Y。拼起来和单卡整算完全一样（切的是矩阵乘、不改结果，就像 FlashAttention 分块）。改 G 看每卡占比 1/G 怎么变。坐在「矩阵乘法」上。',
  bounds: [
    '演示列并行、单个 token 的 Y=X·W；真实还有行并行、注意力头切分等',
    '各卡 Y 片 = X·W 的对应列，拼接严格等于单卡整算',
    '每卡显存/算力 = 1/G；代价是最后 all-gather 的跨卡通信（这里只标出、不建模带宽）',
    '用固定小矩阵便于手核；真实 W 成千上万列切到几十张卡',
  ],
  tabs: [{ id: 'split', label: '按列切分' }],
  Stage: TensorParStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '== 单卡' }
    : s.phase === 'gather' ? { key: 'idle', label: 'all-gather' }
      : { key: 'idle', label: `GPU ${s.gpu}` }),
  metric: s => 1 - s.fraction,
  tickLabel: s => (s.phase === 'done' ? '毕' : s.phase === 'gather' ? '拼' : `g${s.gpu}`),
  whyInRail: true,
  readouts: s => [
    { label: 'GPU 数 G', value: `${s.G}` },
    { label: '当前 GPU', value: s.phase === 'compute' ? `GPU ${s.gpu}（列 ${s.cols[0]}~${s.cols[1] - 1}）` : s.phase === 'gather' ? 'all-gather' : '完成' },
    { label: '每卡占比', value: `1/${s.G}（显存·算力）`, tone: 'good' },
    { label: '完整 Y', value: `[${s.full.join(', ')}]` },
    { label: '== 单卡', value: s.phase === 'done' ? '一致 ✓' : '—' },
  ],
}

const collective: Experiment<CollectiveState> = {
  id: 'collective',
  group: '大模型推理',
  title: '集合通信 All-Reduce',
  subtitle: '环形传递 · 人人拿到总和',
  kernel: collectiveKernel,
  defaultDoc: { kind: 'collective', params: { gpus: 4 }, entities: [], streams: [] },
  params: [
    { key: 'gpus', label: 'GPU 数 G', kind: 'number', options: [2, 3, 4], unit: '张' },
  ],
  paramsNote: '多卡并行（如张量并行）算完各自一片后，常要把各卡结果求和、并让每张卡都拿到（all-reduce）。朴素做法人人给人人发（G² 条消息）。环形 all-reduce 把卡排成环、分两段共 2(G−1) 步：reduce-scatter（每步各卡把一个块发给下一张、累加，G−1 步后每卡拥有某块的完整和）+ all-gather（把已求和的块沿环传一圈，人人集齐）。每步每卡只收发一个块，带宽最优、与卡数无关。坐在张量并行的 all-gather 之上。',
  bounds: [
    '演示 G×G 的 ring all-reduce（每卡持 G 块）；真实向量长得多、算法相同',
    '共 2(G−1) 步：reduce-scatter G−1 步 + all-gather G−1 步',
    '末态每卡向量严格等于各卡输入的逐元素和（可核对）',
    '只数通信轮次、不建模真实带宽/延迟；也未含 tree/其他拓扑',
  ],
  tabs: [{ id: 'ring', label: '环形传递' }],
  Stage: CollectiveStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '人人一致' }
    : { key: 'idle', label: s.phase === 'reduce' ? 'reduce-scatter' : 'all-gather' }),
  metric: s => (s.totalSteps > 0 ? (s.phase === 'done' ? 1 : (s.phase === 'reduce' ? s.round : (s.G - 1) + s.round) / s.totalSteps) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.phase === 'reduce' ? `r${s.round}` : `g${s.round}`),
  whyInRail: true,
  readouts: s => [
    { label: 'GPU 数 G', value: `${s.G}` },
    { label: '阶段', value: s.phase === 'reduce' ? 'reduce-scatter' : s.phase === 'gather' ? 'all-gather' : '完成' },
    { label: '总步数', value: `2·(G−1) = ${s.totalSteps}` },
    { label: '逐元素总和', value: `[${s.target.join(', ')}]` },
    { label: '人人拿到', value: s.phase === 'done' ? '是 ✓' : '进行中' },
  ],
}

const layout: Experiment<LayoutState> = {
  id: 'layout',
  group: '机器学习基础',
  title: '张量布局',
  subtitle: '二维矩阵怎么摊平进一维内存',
  kernel: layoutKernel,
  defaultDoc: { kind: 'layout', params: { layout: 'row-major' }, entities: [], streams: [] },
  params: [
    { key: 'layout', label: '布局', kind: 'enum', options: ['row-major', 'col-major'] },
  ],
  paramsNote: '矩阵是二维、内存是一维，二维怎么摊平就是布局。row-major（C/NumPy 默认）一行的元素连续存，[i][j] 在地址 i·cols+j；col-major（Fortran/BLAS）一列连续存，[i][j] 在地址 j·rows+i。同一矩阵两种布局内存顺序完全不同 —— 谁连续谁访问快（顺 cache 行）。切布局看内存顺序和"扫一行/扫一列"的步长怎么反过来。这是「矩阵乘法」地基的另一半。',
  bounds: [
    '用固定 2×3 小矩阵便于逐格手核；真实张量维度多、机制相同',
    'row-major：地址 = i·cols+j；col-major：地址 = j·rows+i',
    '步长 = 访问相邻元素的地址差：谁连续（步长 1）谁快',
    '只演示两种最常见布局；未含 stride tricks、非连续视图、reshape/transpose 的零拷贝细节',
  ],
  tabs: [{ id: 'mem', label: '摊平进内存' }],
  Stage: LayoutStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: s.layout } : { key: 'idle', label: s.cur ? `@${s.cur.addr}` : '摊平' }),
  metric: s => 0.5,
  tickLabel: s => (s.phase === 'done' ? '毕' : s.cur ? `@${s.cur.addr}` : '·'),
  whyInRail: true,
  readouts: s => [
    { label: '布局', value: s.layout },
    { label: '当前地址', value: s.phase === 'done' ? '完成' : s.cur ? `@${s.cur.addr} = A[${s.cur.i}][${s.cur.j}]` : '—' },
    { label: '扫一行步长', value: `${s.rowStride}`, tone: s.rowStride === 1 ? 'good' : undefined },
    { label: '扫一列步长', value: `${s.colStride}`, tone: s.colStride === 1 ? 'good' : undefined },
    { label: '内存顺序', value: `[${s.mem.filter(Boolean).map(m => m!.v).join(', ')}]` },
  ],
}

const chunkprefill: Experiment<ChunkPrefillState> = {
  id: 'chunkprefill',
  group: '大模型推理',
  title: 'Chunked Prefill',
  subtitle: '长 prefill 切块 · 和 decode 交错',
  kernel: chunkprefillKernel,
  defaultDoc: { kind: 'chunkprefill', params: { chunk: 2 }, entities: [], streams: [] },
  params: [
    { key: 'chunk', label: 'prefill 块大小', kind: 'number', options: [8, 4, 2], unit: 'token' },
  ],
  paramsNote: 'prefill（把整段 prompt 过一遍算 KV）耗时长；decode（逐字吐）每步很短。一个长 prefill 整块跑完，正在解码的其它请求要干等它结束、首字延迟被拉爆。chunked prefill 把长 prefill 切成小块，块之间插入其它请求的 decode：总时间几乎不变，但等待的请求很快拿到下一个字。块越小、别人等得越短。坐在进程调度的时间片思想上。',
  bounds: [
    '固定：A 的 prefill 长 8、B 要 decode 4 次；prefill 块耗时=块大小，decode 耗时=1',
    '交错策略：每排一个 prefill 块就插一个 B 的 decode',
    '总时间与块大小无关（都是 12）；变的是 B 的首字延迟',
    '简化时间模型：只数时隙、不建真实算力/带宽；PD 分离等更复杂调度未展开',
  ],
  tabs: [{ id: 'timeline', label: '时间线' }],
  Stage: ChunkPrefillStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `首字 ${s.firstDecodeAt}` }
    : { key: 'idle', label: s.timeline[s.cursor]?.kind === 'prefill' ? 'prefill' : 'decode' }),
  metric: s => (s.totalTime > 0 ? s.clock / s.totalTime : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : `t${s.clock}`),
  whyInRail: true,
  readouts: s => [
    { label: 'prefill 块大小', value: `${s.chunk} token` },
    { label: '当前时刻', value: s.phase === 'done' ? '完成' : `t=${s.clock}` },
    { label: 'B 首字延迟', value: `${s.firstDecodeAt}`, tone: 'good' },
    { label: '整块跑要等', value: `${s.prefillLen + 1}`, tone: 'bad' },
    { label: '总时间', value: `${s.totalTime}（两种一样）` },
  ],
}

const kvoffload: Experiment<KvOffloadState> = {
  id: 'kvoffload',
  group: '大模型推理',
  title: 'KV 换出 offload',
  subtitle: '显存装不下 → KV 块换到 CPU（LRU）',
  kernel: kvoffloadKernel,
  defaultDoc: { kind: 'kvoffload', params: { slots: 3 }, entities: [], streams: [] },
  params: [
    { key: 'slots', label: 'GPU 槽数', kind: 'number', options: [3, 4], unit: '块' },
  ],
  paramsNote: 'KV 缓存吃显存。高并发/长上下文时 GPU 装不下所有 KV 块，就把暂时不用的换出到 CPU 内存（offload）、要用再换入（reload）—— 和操作系统页面置换一模一样。访问某块：在 GPU 上→命中；不在且 GPU 满→按 LRU 把最久没用的换出，再把要的换入。显存不够用换出换入续命，代价是 PCIe 拷贝。坐在页面置换之上。',
  bounds: [
    '固定访问序列 [0,1,2,0,3,1,4,2]，LRU 置换，便于逐步手核',
    '在 GPU→命中；不在且满→换出 LRU 块到 CPU + 换入请求块',
    '只数命中/换出/换入次数；未建模真实块大小、PCIe 带宽、异步预取',
    '槽越多、换出换入越少（同一序列可对比）',
  ],
  tabs: [{ id: 'tier', label: 'GPU / CPU 两层' }],
  Stage: KvOffloadStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `换出 ${s.offloads}` }
    : s.result === 'hit' ? { key: 'good', label: '命中' } : { key: 'bad', label: '换出/入' }),
  metric: s => (s.step >= 0 ? s.hits / (s.step + 1) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : `${s.req}`),
  whyInRail: true,
  readouts: s => [
    { label: 'GPU 槽数', value: `${s.slots}` },
    { label: '当前访问', value: s.phase === 'done' ? '完成' : `块 ${s.req} → ${s.result === 'hit' ? '命中' : '未命中'}` },
    { label: '命中', value: `${s.hits}`, tone: 'good' },
    { label: '换出 CPU', value: `${s.offloads}`, tone: s.offloads > 0 ? 'bad' : undefined },
    { label: '换入 GPU', value: `${s.reloads}` },
  ],
}

const engine: Experiment<EngineState> = {
  id: 'engine',
  group: '大模型推理',
  title: '推理引擎',
  subtitle: '调度器+块池+prefill/decode = 连续批处理',
  kernel: engineKernel,
  defaultDoc: { kind: 'engine', params: { pool: 4 }, entities: [], streams: [] },
  params: [
    { key: 'pool', label: 'KV 块池', kind: 'number', options: [4, 6], unit: '块' },
  ],
  paramsNote: '前面的实验都是单个算子；真正的推理引擎把它们串成一个连续批处理系统：请求随时来、算完随时走，批次每步在变；KV 显存按块池管，准入看空闲块够不够。每转一圈：回收完成的(归还块)→FCFS准入放得下的(队头阻塞)→prefill新的/decode在跑的→吐 token。连续批处理让算完的位子立刻让给等待的，比"等整批跑完再换批"的静态批吞吐高——这就是 vLLM/TGI 的核心调度。坐在「连续批处理」调度与「分页/块池」之上。',
  bounds: [
    '4 个固定请求(prompt,生成)：R1(2,2) R2(4,3) R3(3,2) R4(2,1)，便于逐步手核',
    '块守恒：free + Σ在跑请求占用 = pool 恒成立（开发期断言）',
    'FCFS 准入，遇到第一个放不下就停(队头阻塞)；完成即归还块',
    '简化：准入时按总长一次性分配块；真实引擎随 decode 增量分配(见 PagedAttention)',
  ],
  tabs: [{ id: 'loop', label: '引擎主循环' }],
  Stage: EngineStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.gen} token` }
    : s.event === 'complete' ? { key: 'good', label: '完成回收' }
    : s.event === 'admit' ? { key: 'good', label: '准入' } : { key: 'idle', label: 'decode' }),
  metric: s => (s.pool ? (s.pool - s.free) / s.pool : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : `${s.step < 0 ? 0 : s.step}`),
  whyInRail: true,
  readouts: s => [
    { label: 'KV 块池', value: `${s.pool - s.free}/${s.pool} 用` },
    { label: '批内在跑', value: `${s.running.length}` },
    { label: '等待', value: `${s.waiting.length}` },
    { label: '生成 token', value: `${s.gen}`, tone: 'good' },
    { label: '完成', value: `${s.done.length}/4` },
  ],
}

const scale: Experiment<ScaleState> = {
  id: 'scale',
  group: 'Transformer 原理',
  title: '\u221ad 缩放',
  subtitle: '为什么注意力要除以 \u221ad_k',
  kernel: scaleKernel,
  defaultDoc: { kind: 'scale', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: 'Q\u00b7K 是 d 个乘积之和；设每维独立、均值0方差1，则每个乘积方差1、d 个相加 → Var(Q\u00b7K)=d（方差可加，就是大数定理那套 i.i.d. 累加）。于是 logit 标准差~\u221ad：d 一大，最相关的 key 就把别人甩开 \u221ad 倍，softmax 塌成近似 one-hot（熵→0、一头独大），梯度也消失、训不动。除以 \u221ad_k 把方差拉回1、softmax 重新“软”。这就是《Attention Is All You Need》里 “scale by 1/\u221ad_k” 的原因——不是玄学，是统计的必然。',
  bounds: [
    '4 个 key 的真实相似度固定 base=[1.5,1,0.5,0]（理解成缩放后该有的 logit）',
    '维度 d 逐步取 4→16→64→256→1024；原始 Q\u00b7K ≈ base\u00d7\u221ad',
    'Var(Q\u00b7K)=d（每维单位方差、i.i.d. 累加，精确可核）',
    '不缩放熵随 d 单调降→0；÷\u221ad 后=softmax(base)，与 d 无关、恒定',
  ],
  tabs: [{ id: 'cmp', label: '不缩放 vs \u00f7\u221ad' }],
  Stage: ScaleStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '\u00f7\u221ad 稳' }
    : s.maxU > 0.9 ? { key: 'bad', label: '塌成 one-hot' } : { key: 'idle', label: `d=${s.d}` }),
  metric: s => (s.d && s.entS ? Math.max(0, Math.min(1, s.entU / s.entS)) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.d ? `d${s.d}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '维度 d', value: s.d ? `${s.d}` : '—' },
    { label: 'Q\u00b7K 方差', value: s.d ? `${s.variance}` : '—' },
    { label: '不缩放 熵', value: s.d ? `${s.entU} bit` : '—', tone: s.entU < 0.3 ? 'bad' : undefined },
    { label: '不缩放 最大', value: s.d ? `${(s.maxU * 100).toFixed(1)}%` : '—', tone: s.maxU > 0.9 ? 'bad' : undefined },
    { label: '\u00f7\u221ad 熵', value: `${s.entS} bit`, tone: 'good' },
  ],
}

const ortho: Experiment<OrthoState> = {
  id: 'ortho',
  group: 'Transformer 原理',
  title: '高维近正交',
  subtitle: '嵌入为什么有容量：随机方向几乎两两正交',
  kernel: orthoKernel,
  defaultDoc: { kind: 'ortho', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '大模型嵌入是几百上千维。为什么高维能装十几万词还不打架？因为高维随机向量几乎两两正交：两个随机单位向量的夹角余弦，均值 0、方差=1/d（d 个分量的归一化内积，又是大数定理——分量越多越集中在 0）。d 越大随机方向越接近 90°，能塞下指数级多“近正交”方向，一个概念占一个、彼此几乎不干扰。这就是分布式表示/嵌入有容量的根，也是点积能当“相关度”的前提。',
  bounds: [
    '8 个用确定性伪随机(LCG+Box-Muller 高斯)生成的单位向量，可复现',
    '维度 d 逐步取 2→8→32→128→512，算全部 28 对夹角余弦',
    '余弦均值≈0、标准差≈1/√d（可与理论核对）、max|cos| 随 d 单调降',
    '只看两两余弦的集中；未建模具体嵌入怎么学',
  ],
  tabs: [{ id: 'axis', label: '余弦数轴' }],
  Stage: OrthoStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '几乎正交' }
    : s.maxAbs > 0 && s.maxAbs < 0.15 ? { key: 'good', label: '近正交' } : { key: 'idle', label: s.d ? `d=${s.d}` : '' }),
  metric: s => (s.d ? Math.max(0, Math.min(1, 1 - s.maxAbs)) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.d ? `d${s.d}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '维度 d', value: s.d ? `${s.d}` : '—' },
    { label: '余弦标准差', value: s.d ? `${s.std}` : '—' },
    { label: '理论 1/√d', value: s.d ? `${s.theoStd}` : '—' },
    { label: '最大 |余弦|', value: s.d ? `${s.maxAbs}` : '—', tone: s.maxAbs > 0 && s.maxAbs < 0.15 ? 'good' : undefined },
    { label: '余弦均值', value: s.d ? `${s.mean}` : '—' },
  ],
}

const hopfield: Experiment<HopfieldState> = {
  id: 'hopfield',
  group: 'Transformer 原理',
  title: '注意力=联想记忆',
  subtitle: '残缺 query 检索回完整记忆（Hopfield）',
  kernel: hopfieldKernel,
  defaultDoc: { kind: 'hopfield', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '2020 年证明：注意力的更新规则就是连续 Hopfield 网络的检索步——注意力本质是一个可微、按内容寻址的联想记忆。把若干模式存成 keys，用 query 检索，softmax 的锐度 β(=1/温度)：β 大=精确检索(query 只要落进某个存储模式的吸引域，就被拉回那个完整模式，即使残缺)、β 小=软混合。一步 Hopfield=一次注意力：weights=softmax(β·query·keys)、output=Σweights·patterns，把 output 当新 query 再来一次，很快收敛到最相似的存储模式。这是注意力能“从上下文回忆相关信息”的底，容量随维度指数级——正对上「高维近正交」。',
  bounds: [
    '存 4 个 8 位 ±1 近正交模式(当记忆)，query=P0 翻 2 位(残缺)',
    '离散 Hopfield：每步 output 取符号当新 query；β=6 固定',
    '收敛到重叠最高的 P0、权重→one-hot、querySign 与 P0 一致(均可核对)',
    '简化：模式设成近正交便于收敛；真实里靠高维近正交保证容量',
  ],
  tabs: [{ id: 'recall', label: '检索回忆' }],
  Stage: HopfieldStage,
  tone: s => (s.phase === 'done' || s.converged ? { key: 'good', label: '回忆出 P0' } : { key: 'idle', label: `${s.matchBits}/8` }),
  metric: s => s.matchBits / 8,
  tickLabel: s => (s.phase === 'done' ? '毕' : `P${s.best}`),
  whyInRail: true,
  readouts: s => [
    { label: 'β（锐度）', value: `${s.beta}` },
    { label: 'query 与 P0', value: `${s.matchBits}/8`, tone: s.matchBits === 8 ? 'good' : undefined },
    { label: '最像', value: `P${s.best}（${(s.weights[s.best] * 100).toFixed(0)}%）` },
    { label: '权重', value: s.converged ? 'one-hot' : '分散', tone: s.converged ? 'good' : undefined },
  ],
}

const knn: Experiment<KNNState> = {
  id: 'knn',
  group: '机器学习算法',
  title: 'k-近邻 k-NN',
  subtitle: '不训练，直接看邻居投票来分类',
  kernel: knnKernel,
  defaultDoc: { kind: 'knn', params: { k: 3 }, entities: [], streams: [] },
  params: [
    { key: 'k', label: '看几个最近邻', kind: 'number', options: [1, 3, 5, 7] },
  ],
  paramsNote: 'k-NN 是最"懒"的分类器:根本不训练。判一个新点属于哪类,就找离它最近的 k 个已知点、让它们投票,票多的类别就是答案。全部力气花在"预测时按距离找最近邻"。它点破一个道理:很多智能就是按相似度检索+多数表决(和注意力"近的权重大"一脉)。k 是灵魂:k 小敏感(被个别噪声带偏、边界毛糙)、k 大平滑(更稳但糊细节)。边界附近的点会随 k 变大改判——偏差-方差权衡的直观版。本实验两类各 8 点、一个落在边界的待判点:k=1 判 A、k=3 翻 B、k=7 又翻 A。调 k 看判断摇摆。',
  bounds: [
    '两类各 8 个确定性点(A/B),一个边界附近的待判点',
    '按距离排序取最近 k 个、多数表决(可核)',
    'k=1→A、k=3→B、k=7→A,判断随 k 翻',
    '无训练;真实里还要选距离度量、处理维度灾难',
  ],
  tabs: [{ id: 'vote', label: '最近邻投票' }],
  Stage: KNNStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `判 ${s.predict === 0 ? 'A' : 'B'}` } : { key: 'idle', label: `A${s.voteA}:B${s.voteB}` }),
  metric: s => (s.k ? s.seen / s.k : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : `${s.seen}`),
  whyInRail: true,
  readouts: s => [
    { label: '看几个 k', value: `${s.k}` },
    { label: '已找邻居', value: `${s.seen}` },
    { label: '票数', value: `A ${s.voteA} : B ${s.voteB}` },
    { label: '判为', value: s.predict === 0 ? 'A' : s.predict === 1 ? 'B' : '?', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const kmeans: Experiment<KMeansState> = {
  id: 'kmeans',
  group: '机器学习算法',
  title: 'k-means 聚类',
  subtitle: '无标签的点，怎么自己分成几堆',
  kernel: kmeansKernel,
  defaultDoc: { kind: 'kmeans', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: 'k-means 是最经典的无监督聚类:没标签,把一堆点分成 k 堆。两步反复跳:①分配:每点归给最近的重心;②更新:每个重心移到"分给它的点"的平均位置。反复①②,重心 march 到各堆中心、归属稳定,簇内平方和 inertia 单调下降、几步收敛。是"没老师、靠数据自己找结构"的代表,向量量化/图像分割/用户分群都用它。软肋:依赖初始重心、k 要人定。本实验 18 个点(来自 3 个簇)、k=3、重心故意初始化偏,看分配→移动交替、inertia 54→4、几步收敛。',
  bounds: [
    '18 个确定性点(来自 3 个簇),k=3,重心初始偏',
    '分配=每点归最近重心;更新=重心移到均值(可核)',
    'inertia 单调降 54→4;几步收敛(重心不再动)',
    '结果依赖初始化;k 需人定——k-means 的已知软肋',
  ],
  tabs: [{ id: 'cluster', label: '分配+移动' }],
  Stage: KMeansStage,
  tone: s => (s.phase === 'done' || s.converged ? { key: 'good', label: `inertia ${s.inertia}` } : { key: 'idle', label: s.phase === 'assign' ? '分配' : '移动' }),
  metric: s => Math.max(0, Math.min(1, 1 - s.inertia / 54)),
  tickLabel: s => (s.phase === 'done' ? '毕' : `${s.iter + 1}${s.phase === 'assign' ? '分' : '移'}`),
  whyInRail: true,
  readouts: s => [
    { label: '第几轮', value: `${s.iter + 1}` },
    { label: '阶段', value: s.phase === 'assign' ? '分配' : s.phase === 'move' ? '移动重心' : '收敛' },
    { label: '簇内平方和', value: `${s.inertia}`, tone: s.converged ? 'good' : undefined },
    { label: '收敛', value: s.converged ? '是' : '未', tone: s.converged ? 'good' : undefined },
  ],
}

const pca: Experiment<PCAState> = {
  id: 'pca',
  group: '机器学习算法',
  title: '主成分分析 PCA',
  subtitle: '找数据"最铺开"的方向，把高维压成低维',
  kernel: pcaKernel,
  defaultDoc: { kind: 'pca', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '高维数据各维往往相关、有效维度没那么多。PCA 找方差最大的方向(主成分 PC1)——沿它点铺得最开、信息最多;再找正交、次大方差的 PC2……把点投影到前几个主成分,用更少维度保住大部分信息。数学上主成分=协方差矩阵的特征向量,特征值=该方向方差,越大越该留。这就是降维:去冗余、抓主轴,是高维可视化/压缩/去噪的底,和 LoRA/低秩"抓主方向"一家。本实验 14 个沿对角线拉长的 2D 点:算协方差、取最大特征向量当 PC1(约 33°)、投影上去,PC1 保留 96% 方差,2D→1D 只丢 4%。',
  bounds: [
    '14 个沿对角线拉长的 2D 相关点',
    'PC1=协方差矩阵最大特征向量(2×2 闭式,可核)',
    'PC1≈33°,保留方差 96%;投影到 PC1 即 2D→1D',
    '演示 2D→1D;高维/白化/核 PCA 未展开',
  ],
  tabs: [{ id: 'project', label: '主轴+投影' }],
  Stage: PCAStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `保 ${s.var1}%` } : { key: 'idle', label: ({ cloud: '点云', axis: '找主轴', project: '投影' } as Record<string, string>)[s.phase] ?? '' }),
  metric: s => (s.phase === 'cloud' ? 0.2 : s.var1 / 100),
  tickLabel: s => (s.phase === 'done' ? '毕' : ({ cloud: '云', axis: '轴', project: '投' } as Record<string, string>)[s.phase] ?? '0'),
  whyInRail: true,
  readouts: s => [
    { label: '主轴 PC1', value: s.phase === 'cloud' ? '?' : `${s.angle}°` },
    { label: '保留方差', value: `${s.var1}%`, tone: s.phase === 'done' ? 'good' : undefined },
    { label: '压维', value: '2D → 1D' },
    { label: '丢失', value: `${(100 - s.var1).toFixed(1)}%` },
  ],
}

const svm: Experiment<SVMState> = {
  id: 'svm',
  group: '机器学习算法',
  title: '支持向量机 SVM',
  subtitle: '分两类不够，要找"最宽的那条街"',
  kernel: svmKernel,
  defaultDoc: { kind: 'svm', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '两类线性可分时能分开的直线有无数条。逻辑回归随便找一条,SVM 挑最大间隔的那条:两类之间想象一条尽量宽的"街道",正中间那条线是边界,SVM 让街道最宽。为什么?边界离两边都最远、容错最大、泛化最好。而且最宽的街只由紧贴街边的几个点(支持向量)定住,其余点再远都不影响——SVM 只记得支持向量。线性不可分时用核函数把点映到高维再找最大间隔。本实验两类各 5 点:先看一条随便分开的线(贴一类、间隔 0.5),再看 SVM 最大间隔线(居中、间隔 1),4 个支持向量高亮。',
  bounds: [
    '两类各 5 个线性可分点',
    '间隔=最近点到边界的距离;支持向量=最内侧点(可核)',
    'SVM 间隔 1 > 随便那条 0.5;只由 4 个支持向量定边界',
    '演示线性可分;核函数(非线性)只在文字里点到',
  ],
  tabs: [{ id: 'margin', label: '最大间隔' }],
  Stage: SVMStage,
  tone: s => (s.phase === 'done' || s.phase === 'svm' ? { key: 'good', label: `间隔 ${s.margin}` } : s.phase === 'naive' ? { key: 'bad', label: '间隔窄 0.5' } : { key: 'idle', label: '无数条?' }),
  metric: s => (s.isMax ? 1 : s.phase === 'naive' ? 0.4 : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : ({ setup: '设', naive: '随便', svm: 'SVM' } as Record<string, string>)[s.phase] ?? '0'),
  whyInRail: true,
  readouts: s => [
    { label: '边界', value: s.phase === 'setup' ? '?' : s.phase === 'naive' ? '随便一条' : '最大间隔' },
    { label: '间隔', value: s.phase === 'setup' ? '—' : `${s.margin}`, tone: s.isMax ? 'good' : s.phase === 'naive' ? 'bad' : undefined },
    { label: '支持向量', value: s.supportVectors.length ? `${s.supportVectors.length} 个` : '—' },
    { label: '泛化', value: s.isMax ? '最稳' : s.phase === 'naive' ? '差' : '—', tone: s.isMax ? 'good' : undefined },
  ],
}

const gbdt: Experiment<GBDTState> = {
  id: 'gbdt',
  group: '机器学习算法',
  title: '梯度提升树 GBDT',
  subtitle: '一棵棵小树接力，每棵只补上一棵的"错"',
  kernel: gbdtKernel,
  defaultDoc: { kind: 'gbdt', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '单棵决策树易过拟合、拟合不了平滑曲线。梯度提升(GBDT)让一串小树接力:每棵只补前面所有树合起来还没拟合掉的误差(残差)。先用常数(均值)当初始预测;每轮算残差(真值−预测),训一棵小树拟合残差,乘学习率加进预测;残差越来越小、预测越来越准。因为每棵拟合的是残差/梯度故名梯度提升。一堆弱学习器串起来=强学习器,是集成学习 boosting 路线,和随机森林(并行投票 bagging)并称。GBDT/XGBoost/LightGBM 至今是表格数据主力。本实验 20 个 1D 阶梯+噪声点,用只切一刀的树桩逐轮 boosting:预测阶梯长出贴近数据、MSE 0.75→0.03。',
  bounds: [
    '20 个 1D 点(阶梯+噪声),可复现',
    '初始=均值;每轮拟合残差、乘 lr 加进预测(可核)',
    'MSE 单调降 0.75→0.03;预测阶梯逼近数据',
    '弱学习器=单刀树桩;真实 GBDT 更深、有正则',
  ],
  tabs: [{ id: 'boost', label: '逐轮拟合残差' }],
  Stage: GBDTStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `MSE ${s.mse.toFixed(2)}` } : { key: 'idle', label: `第 ${s.round} 轮` }),
  metric: s => Math.max(0, Math.min(1, 1 - s.mse / 0.75)),
  tickLabel: s => (s.phase === 'done' ? '毕' : `${s.round}`),
  whyInRail: true,
  readouts: s => [
    { label: '提升轮数', value: `${s.round}` },
    { label: 'MSE', value: `${s.mse}`, tone: s.phase === 'done' ? 'good' : undefined },
    { label: '小树棵数', value: `${s.round}` },
    { label: '本轮切', value: s.round > 0 ? `x≈${s.splitT}` : '—' },
  ],
}

const dtree: Experiment<DTreeState> = {
  id: 'dtree',
  group: '机器学习算法',
  title: '决策树',
  subtitle: '靠一刀刀"切平面"把类别分开',
  kernel: dtreeKernel,
  defaultDoc: { kind: 'dtree', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '决策树像 20 个问题:每个内部节点问"某特征≷某阈值?"把数据一分为二,顺答案往下走到纯净叶子(几乎全同类)。怎么选每刀?看哪刀让子集最纯——基尼不纯度(Gini,越近 0 越纯)下降最多(信息增益最大)。递归切到每块都纯。它天生可解释(每条路径=一串 if-else)、能用多刀轴对齐拼非线性边界,是随机森林、GBDT 的积木。本实验 16 点分布四象限、只右上第 1 类:先切 x=0(左半纯=第0类)、再在右半切 y=0(右上第1类、右下第0类),三刀两下全切纯。',
  bounds: [
    '16 个点(四象限,右上=第1类),特征 x/y',
    '每刀挑信息增益最大(Gini 下降最多)(可核)',
    '切 x=0(左纯)、再切 y=0(右上/右下纯);深 2、3 叶子',
    '演示轴对齐分裂;剪枝/连续特征/多类未展开',
  ],
  tabs: [{ id: 'split', label: '切平面' }],
  Stage: DTreeStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.leaves.length} 纯叶子` } : { key: 'idle', label: s.phase === 'root' ? '不纯' : `切${s.splits.length}刀` }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, 1 - s.curGini / 0.5) * 0.6),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.phase === 'root' ? '根' : `刀${s.splits.length}`),
  whyInRail: true,
  readouts: s => [
    { label: '切了几刀', value: `${s.splits.length}` },
    { label: '当前不纯度', value: `${s.curGini}`, tone: s.curGini === 0 ? 'good' : undefined },
    { label: '本刀增益', value: s.gain ? `${s.gain}` : '—' },
    { label: '纯叶子', value: `${s.leaves.length}`, tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const logreg: Experiment<LogRegState> = {
  id: 'logreg',
  group: '机器学习算法',
  title: '逻辑回归',
  subtitle: '把"拟合直线"改造成"分两类"',
  kernel: logregKernel,
  defaultDoc: { kind: 'logreg', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '线性回归拟合连续值,逻辑回归改造成分类:先算线性打分 z=w₁x+w₂y+b,再用 sigmoid 把 z 压到 (0,1) 当"属于第 1 类的概率"。损失从 MSE 换成交叉熵(对数损失):预测概率离真实标签越远罚越狠。同样梯度下降调 w、b,让决策边界(z=0 那条线)转到分开两类的位置:一侧概率>0.5 判 1、另一侧判 0。它是最基础的分类器,也是单个神经元+sigmoid 的样子。本实验两类各 9 点(大致线性可分),w、b 从 0、lr=0.3:边界转到两类之间、交叉熵 0.69→0.03、准确率 50%→100%。',
  bounds: [
    '两类各 9 个确定性点(大致线性可分),可复现',
    '打分 z=w₁x+w₂y+b、概率=sigmoid(z)、损失=交叉熵',
    '梯度下降调 w、b(可核);交叉熵单调降、准确率→100%',
    '一层线性边界;非线性可分要核方法/神经网络',
  ],
  tabs: [{ id: 'boundary', label: '决策边界' }],
  Stage: LogRegStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${(s.acc * 100).toFixed(0)}%` } : { key: 'idle', label: `步 ${s.gdStep}` }),
  metric: s => s.acc,
  tickLabel: s => (s.phase === 'done' ? '毕' : `${s.gdStep}`),
  whyInRail: true,
  readouts: s => [
    { label: '梯度下降步', value: `${s.gdStep}` },
    { label: '交叉熵损失', value: `${s.loss}`, tone: s.phase === 'done' ? 'good' : undefined },
    { label: '准确率', value: `${(s.acc * 100).toFixed(0)}%`, tone: s.acc >= 1 ? 'good' : undefined },
    { label: '边界 w', value: `(${s.w1}, ${s.w2})` },
  ],
}

const backprop: Experiment<BackpropState> = {
  id: 'backprop',
  group: '深度学习算法',
  title: '反向传播',
  subtitle: '链式法则把"误差"逐层回传成每个权重的梯度',
  kernel: backpropKernel,
  defaultDoc: { kind: 'backprop', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '反向传播是训练神经网络的发动机。两趟:前向——数据从输入流到输出、算出损失 L;反向——从 L 出发用链式法则把"L 对每个中间量的偏导"一站站往回算,得到 L 对每个权重的梯度,交给梯度下降更新。核心一句:下游梯度×本站局部导数=上游梯度。sigmoid 局部导数 a(1−a)、乘法是"另一个数"……每站只管自己那点局部导数,链一串就把梯度从损失送回最前的权重。一趟就出所有权重梯度、和参数量成正比,极高效——这是深度学习能训上亿参数的底层原因。本实验一个神经元 x=1,w=0.8,b=0.2→z→a=σ(z)→L=(a−t)²,前向 L=0.072,反向逐站回传到 dL/dw、dL/db。',
  bounds: [
    '一个神经元:x=1,w=0.8,b=0.2,t=1;z=wx+b、a=σ(z)、L=(a−t)²',
    '前向 L=0.072;反向链式法则逐站(可核)',
    'dL/da=2(a−t)、过 sigmoid ×a(1−a)、dL/dw=dL/dz·x',
    '单神经元示意;多层网络同理逐层回传',
  ],
  tabs: [{ id: 'graph', label: '计算图' }],
  Stage: BackpropStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '梯度全出' } : s.phase === 'forward' ? { key: 'idle', label: '前向' } : { key: 'idle', label: s.stage }),
  metric: s => (s.phase === 'forward' ? 0.2 : s.phase === 'done' ? 1 : s.gLdw !== null ? 0.8 : s.gLdz !== null ? 0.6 : 0.4),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.phase === 'forward' ? '前向' : s.gLdw !== null ? 'w,b' : s.gLdz !== null ? 'z' : 'a'),
  whyInRail: true,
  readouts: s => [
    { label: '损失 L', value: `${s.loss}` },
    { label: 'dL/da', value: s.gLda !== null ? `${s.gLda}` : '—' },
    { label: 'dL/dz', value: s.gLdz !== null ? `${s.gLdz}` : '—' },
    { label: 'dL/dw', value: s.gLdw !== null ? `${s.gLdw}` : '—', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const binsearch: Experiment<BinSearchState> = {
  id: 'binsearch',
  group: '经典算法',
  title: '二分查找',
  subtitle: '有序=每问一次砍掉一半',
  kernel: binsearchKernel,
  defaultDoc: { kind: 'binsearch', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '二分查找是"分治+有序"的最小样板:数组排好序后,查一个数不用一个个扫。看正中间那个,目标比它大就只在右半、小就只在左半——一次比较砍掉一半候选。区间 [lo,hi] 反复对折,每步范围减半,只需 log₂n 次比较就能在百万个里定位(n=10⁶ 也就 20 步)。这是"有序结构+每次排除一半"的威力,B+树索引、二分定位 bug、猜数游戏底子都是它。本实验 13 个有序数找 63,看区间对半砍、mid 跳,4 步命中。',
  bounds: [
    '13 个有序数,目标 63',
    '每步 mid=(lo+hi)/2、比较后区间减半(可核)',
    '4 步命中(≤log₂13≈4);灰格=已排除',
    '要求数组有序;无序得先排序或用哈希',
  ],
  tabs: [{ id: 'search', label: '区间对折' }],
  Stage: BinSearchStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.compares} 步命中` } : s.cmp === 'hit' ? { key: 'good', label: '命中' } : { key: 'idle', label: `[${s.lo},${s.hi}]` }),
  metric: s => { const total = s.arr.length; const range = s.hi - s.lo + 1; return total ? Math.max(0, Math.min(1, 1 - range / total)) : 0 },
  tickLabel: s => (s.phase === 'done' ? '毕' : `${s.compares}`),
  whyInRail: true,
  readouts: s => [
    { label: '区间', value: `[${s.lo}, ${s.hi}]` },
    { label: '中点', value: s.mid >= 0 ? `arr[${s.mid}]=${s.arr[s.mid]}` : '—' },
    { label: '比较次数', value: `${s.compares}` },
    { label: '结果', value: s.found >= 0 ? `命中@${s.found}` : '查找中', tone: s.found >= 0 ? 'good' : undefined },
  ],
}

const nqueens: Experiment<NQueensState> = {
  id: 'nqueens',
  group: '经典算法',
  title: '回溯 · N 皇后',
  subtitle: '走不通就退回上一步，换一个再试',
  kernel: nqueensKernel,
  defaultDoc: { kind: 'nqueens', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '回溯是"系统化的试错":把问题拆成一步步选择,每步试一个候选、走下去;一旦约束破了(走不通)就撤销这步、退回上层换下一个——像走迷宫撞死胡同就原路退回换个岔口。它是深度优先地穷举"选择树",靠提前剪掉不可能的分支避免真枚举所有组合。N 皇后是招牌例子:N×N 棋盘放 N 个皇后,任两个不能同行/同列/同对角线。做法:一行放一个,行内找不被已放皇后攻击的列;找到就落子进下一行,整行没安全位就回溯。本实验 4×4 找第一个解 [1,3,0,2],看皇后一落一撤。',
  bounds: [
    '4×4 棋盘,放 4 个互不攻击的皇后',
    '一行一个,行内挑安全列;整行无处放→回溯',
    'safe 判定=同列或|Δ行|=|Δ列|(对角);可核',
    '第一个解 [1,3,0,2];共 13 步、回溯 4 次',
  ],
  tabs: [{ id: 'board', label: '试错+撤销' }],
  Stage: NQueensStage,
  tone: s => (s.phase === 'done' || s.act === 'solved' ? { key: 'good', label: '解出' } : s.act === 'backtrack' ? { key: 'bad', label: '回溯' } : { key: 'idle', label: `${s.placed}/${s.n}` }),
  metric: s => (s.n ? s.placed / s.n : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.act === 'backtrack' ? '退' : s.act === 'solved' ? '解' : '放'),
  whyInRail: true,
  readouts: s => [
    { label: '盘上皇后', value: `${s.placed}/${s.n}` },
    { label: '本步', value: s.act === 'place' ? `第${s.row}行落列${s.col}` : s.act === 'backtrack' ? `撤第${s.row}行` : s.act === 'solved' ? '找到解' : '待走' },
    { label: '试列/回溯', value: `${s.tries} / ${s.backtracks}` },
    { label: '布局', value: s.placed === s.n ? `[${s.cols.join(',')}]` : '拼装中', tone: s.placed === s.n ? 'good' : undefined },
  ],
}

const unionfind: Experiment<UnionFindState> = {
  id: 'unionfind',
  group: '经典算法',
  title: '并查集',
  subtitle: '是不是一伙，只看根同不同',
  kernel: unionfindKernel,
  defaultDoc: { kind: 'unionfind', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '并查集回答"这堆元素不断两两结盟,随时问某俩是不是一伙"。它用树表示集合:每个元素有父指针,顺着爬到根,根就是集团代表。find(x)=爬到根;union(a,b)=把两人的根挂到一起;"是不是一伙"=根同不同。朴素合并会长出长链,find 爬得慢;路径压缩在 find 到根后把沿途节点直接挂到根下,链一下拍平,后续近乎 O(1)。本实验 7 点:6 次 union 并成一团(故意长出 0←1←2←3 的链),再 find(0) 爬到根 6、路径压缩把 0/1/2/3 直挂 6 下,深度从 4 塌到 1。',
  bounds: [
    '7 个点,6 次 union 并成 1 个连通分量',
    'union=把根挂到根下;find=顺父指针爬到根(可核)',
    'find(0) 走 0→1→2→3→6;压缩后深度 4→1',
    '同色=一伙;是不是一伙就看根同不同',
  ],
  tabs: [{ id: 'forest', label: '并树+压缩' }],
  Stage: UnionFindStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.comps} 团` } : s.act === 'compress' ? { key: 'good', label: '拍平' } : s.act === 'find' ? { key: 'idle', label: `爬 ${s.path.length} 步` } : { key: 'idle', label: `${s.comps} 团` }),
  metric: s => (s.n ? 1 - (s.comps - 1) / (s.n - 1) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.act === 'compress' ? '压' : s.act === 'find' ? '找' : '并'),
  whyInRail: true,
  readouts: s => [
    { label: '连通分量', value: `${s.comps}` },
    { label: '本步', value: s.act === 'union' ? `union(${s.a},${s.b})` : s.act === 'find' ? `find(${s.a})→根${s.root}` : s.act === 'compress' ? '路径压缩' : '认祖归宗' },
    { label: '最深链', value: `${Math.max(...s.depths)}`, tone: s.act === 'compress' ? 'good' : undefined },
    { label: '状态', value: s.comps === 1 ? '全连通' : `${s.comps} 个集团` },
  ],
}

const heap: Experiment<HeapState> = {
  id: 'heap',
  group: '经典算法',
  title: '二叉堆 / 优先队列',
  subtitle: '父永远≥子，堆顶永远最大',
  kernel: heapKernel,
  defaultDoc: { kind: 'heap', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '堆是优先队列的标准实现:一棵完全二叉树,满足堆序——每个父≥两个孩子(最大堆),于是堆顶永远是全体最大,取最大 O(1) 看、O(log n) 移除。它还能紧凑压进数组:下标 i 的孩子在 2i+1/2i+2,父在 (i-1)/2,纯下标算不用指针。核心操作 sift-down(下沉):节点比孩子小就和更大的孩子交换、一路沉到位。建堆=从最后一个非叶节点倒着 sift-down(O(n));取最大=堆顶和末尾对调、堆减一、再 sift-down 复原,反复做就是堆排序。本实验 7 个数先建堆,再取一次堆顶 9 排到尾。',
  bounds: [
    '7 个数 [3,9,2,1,7,5,8] 建最大堆',
    '孩子在 2i+1/2i+2;sift-down 比孩子小就下沉(可核)',
    '堆顶=全体最大;取最大=对调末尾+下沉复原',
    '建堆 O(n)、取最大 O(log n);反复取=堆排序',
  ],
  tabs: [{ id: 'tree', label: '树+数组' }],
  Stage: HeapStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `顶=${s.arr[0]}` } : s.act === 'extract' ? { key: 'good', label: `取${s.arr[s.sortedFrom]}` } : s.act === 'sift' ? { key: 'idle', label: '下沉' } : { key: 'idle', label: s.stage === 'build' ? '建堆' : '复原' }),
  metric: s => (s.act === 'done' ? 1 : s.stage === 'extract' ? 0.8 : 0.4),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.act === 'sift' ? '沉' : s.act === 'extract' ? '取' : '⋯'),
  whyInRail: true,
  readouts: s => [
    { label: '堆顶(最大)', value: `${s.arr[0]}`, tone: 'good' },
    { label: '堆内元素', value: `${s.heapN}` },
    { label: '本步', value: s.act === 'sift' ? `${s.arr[s.node]} 下沉` : s.act === 'extract' ? `取顶 ${s.arr[s.sortedFrom]}` : s.act === 'done' ? '复原完成' : '到位' },
    { label: '阶段', value: s.stage === 'build' ? '建堆' : '取最大' },
  ],
}

const quicksort: Experiment<QuickSortState> = {
  id: 'quicksort',
  group: '经典算法',
  title: '快速排序',
  subtitle: '选基准，小的甩左、大的甩右，分而治之',
  kernel: quicksortKernel,
  defaultDoc: { kind: 'quicksort', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '快排是分治的代表作:排一个区间时先挑一个基准 pivot,做一趟 partition——把比 pivot 小的甩到左、不小于的留右;这趟结束 pivot 就落到最终该在的位置(左全比它小、右全不小于),永久锁定。再对左右两段各自递归,段越切越短到长度 1(天然有序)。平均 O(n log n)、原地(不需额外数组)、常数因子小,是实践中最快的通用排序,C++ sort、各语言库底子都有它。最坏(近有序且总挑到极值)退化 O(n²),用随机/三数取中基准规避。本实验 7 个数 [5,2,8,1,9,3,7],看 pivot、扫描指针 j 一趟趟收小的、pivot 归位、再切两段递归。',
  bounds: [
    '7 个数 [5,2,8,1,9,3,7],末元素当基准',
    '一趟扫描:<基准收左、≥基准留右;基准归位后锁定(可核)',
    '再对左右两段递归,段长到 1 停',
    '平均 O(n log n) 原地;最坏 O(n²) 用随机基准避',
  ],
  tabs: [{ id: 'part', label: '分区+递归' }],
  Stage: QuickSortStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '已排好' } : s.act === 'place' || s.act === 'single' ? { key: 'good', label: `归位 ${s.sortedCount}` } : s.act === 'pivot' ? { key: 'idle', label: `基准 ${s.pivotVal}` } : { key: 'idle', label: `${s.sortedCount}/${s.n}` }),
  metric: s => (s.n ? s.sortedCount / s.n : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.act === 'place' || s.act === 'single' ? '定' : s.act === 'pivot' ? '基' : '扫'),
  whyInRail: true,
  readouts: s => [
    { label: '当前基准', value: s.pivotVal >= 0 && s.phase !== 'done' ? `${s.pivotVal}` : '—' },
    { label: '处理区间', value: s.pivotVal >= 0 && s.phase !== 'done' ? `[${s.lo},${s.hi}]` : s.phase === 'done' ? '全区' : '—' },
    { label: '已归位', value: `${s.sortedCount}/${s.n}`, tone: s.act === 'place' || s.act === 'single' ? 'good' : undefined },
    { label: '本步', value: s.act === 'swap' ? '换进左区' : s.act === 'grow' ? '并入左区' : s.act === 'keep' ? '留右边' : s.act === 'place' ? '基准归位' : s.act === 'pivot' ? '选基准' : s.act === 'single' ? '单元素归位' : s.act === 'done' ? '排好序' : '待走' },
  ],
}

const mergesort: Experiment<MergeSortState> = {
  id: 'mergesort',
  group: '经典算法',
  title: '归并排序',
  subtitle: '分到不能再分，再两两有序地合并回去',
  kernel: mergesortKernel,
  defaultDoc: { kind: 'mergesort', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '归并排序是分治的另一面:快排先分区再递归,归并是分到底再合并。把数组不断对半拆到每段剩 1 个(天然有序),再两两归并——合并两个已排好的段时只需比各自队首、把小的先放进输出,一趟线性就拼成更长的有序段;段宽 1→2→4… 直到全有序。它稳定(相等不换序)、最坏也稳稳 O(n log n)(log n 轮×每轮扫 n),代价是要一块额外缓冲区。外部排序(数据大到装不下内存,分块排好再多路归并)、稳定排序需求、链表排序都靠它。本实验 7 个数 [5,2,8,1,9,3,7],看长度 1 的段两两归并成 2、再成 4,每次比队首取小的。',
  bounds: [
    '7 个数 [5,2,8,1,9,3,7],自底向上归并',
    '合并两有序段=比队首取小的,一趟线性(可核)',
    '段宽 1→2→4… 翻倍,共 log n 轮',
    '稳定、最坏也 O(n log n);代价=额外缓冲',
  ],
  tabs: [{ id: 'merge', label: '归并回合' }],
  Stage: MergeSortStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '已排好' } : s.act === 'done' ? { key: 'good', label: `宽 ${s.out.length}` } : s.from === 'L' ? { key: 'idle', label: `取左 ${s.took}` } : s.from === 'R' ? { key: 'idle', label: `取右 ${s.took}` } : { key: 'idle', label: `段宽 ${s.width}` }),
  metric: s => { if (s.phase === 'done') return 1; const passes = Math.ceil(Math.log2(s.n)); const cur = Math.log2(Math.max(1, s.width)); return Math.min(1, cur / passes) },
  tickLabel: s => (s.phase === 'done' ? '毕' : s.act === 'done' ? '合' : s.from === 'L' ? '左' : s.from === 'R' ? '右' : '⋯'),
  whyInRail: true,
  readouts: s => [
    { label: '当前段宽', value: s.phase === 'done' ? '全' : `${s.width}` },
    { label: '归并区段', value: (s.act === 'emit' || s.act === 'drain' || s.act === 'done') ? `[${s.lo},${s.hi})` : s.phase === 'done' ? '全区' : '—' },
    { label: '本步取', value: s.took >= 0 ? `${s.from === 'L' ? '左' : '右'}段 ${s.took}` : s.act === 'done' ? '本段合完' : '—' },
    { label: '输出', value: `${s.out.length} 个`, tone: s.act === 'done' ? 'good' : undefined },
  ],
}

const fastpow: Experiment<FastPowState> = {
  id: 'fastpow',
  group: '经典算法',
  title: '快速幂',
  subtitle: '指数拆二进制，反复平方 + 挑位相乘',
  kernel: fastpowKernel,
  defaultDoc: { kind: 'fastpow', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '求 a^n 最笨是乘 n-1 次。快速幂用分治/二进制压到 O(log n):把指数写成二进制,如 13=1101₂=8+4+1,于是 a¹³=a⁸·a⁴·a¹——只用到平方得来的幂 a¹,a²,a⁴,a⁸(每个由上一个平方而来,只需 log n 次平方),再看二进制哪几位是 1,把对应幂乘起来。本实验算 3¹³:base 反复平方 3→9→81→6561,bit0=1 取 3、bit1=0 跳、bit2=1 取 81、bit3=1 取 6561 → 3·81·6561=1594323,只用 3 乘+3 平方,朴素要 13 次。快速幂是模幂(RSA)、矩阵快速幂(线性递推)的底子。',
  bounds: [
    '算 3¹³:指数 13=1101₂=8+4+1',
    'base 反复平方得 a^(2^k);二进制位=1 就乘入(可核)',
    '3·81·6561=1594323;3 乘 + 3 平方 vs 朴素 13 乘',
    'O(log n):n=10⁹ 也才 ~30 步',
  ],
  tabs: [{ id: 'bits', label: '逐位平方' }],
  Stage: FastPowStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.result}` } : s.act === 'mul' ? { key: 'good', label: `×${s.powK}` } : s.act === 'skip' ? { key: 'idle', label: '跳过' } : { key: 'idle', label: `${s.a}^${s.n}` }),
  metric: s => { const nb = s.bitsMSB.length; return s.phase === 'done' ? 1 : nb ? Math.min(1, (s.k + 1) / nb) : 0 },
  tickLabel: s => (s.phase === 'done' ? '毕' : s.act === 'mul' ? '乘' : s.act === 'skip' ? '跳' : '⋯'),
  whyInRail: true,
  readouts: s => [
    { label: '要算', value: `${s.a}^${s.n}` },
    { label: '当前位', value: s.k >= 0 && s.phase !== 'done' ? `bit${s.k}=${s.bit}` : '—' },
    { label: '结果', value: `${s.result}`, tone: s.phase === 'done' ? 'good' : undefined },
    { label: '乘/平方', value: `${s.mults} / ${s.squares}` },
  ],
}

const astar: Experiment<AStarState> = {
  id: 'astar',
  group: '经典算法',
  title: 'A* 寻路',
  subtitle: 'f = 已走 g + 到终点估计 h，优先探最有希望的格',
  kernel: astarKernel,
  defaultDoc: { kind: 'astar', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: 'A* 是带启发的最短路搜索,BFS/Dijkstra 的聪明版。每格算两个数:g=从起点已走的步数、h=到终点的乐观估计(这里用曼哈顿距离,把墙当不存在、故永不高估)。按 f=g+h 排序开放集优先展开:g 保证不贪近路走冤枉、h 把搜索拽向终点。只要 h 不高估(admissible),A* 找到的必是最短路,还比 Dijkstra(只看 g、四面均匀铺)少展开很多格;h=0 就退化成 Dijkstra。本实验 8×5 网格,起点左、终点右,中间一堵墙留缺口:A* 先沿 h 直扑终点(f=7),撞墙后绕行(f=9)从缺口穿过,展开 19 格找到 9 步最短路。游戏 NPC 寻路、地图导航都靠它。',
  bounds: [
    '8×5 网格,一堵墙留缺口;起点左、终点右',
    'f=g+h:g=已走步数、h=曼哈顿距离(永不高估→最短路,可核)',
    '先探 f 最小的格;撞墙才绕行',
    '展开 19 格得 9 步最短路;h=0 退化成 Dijkstra',
  ],
  tabs: [{ id: 'grid', label: '网格搜索' }],
  Stage: AStarStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.path.length - 1} 步` } : s.act === 'goal' ? { key: 'good', label: '到终点' } : { key: 'idle', label: `f=${s.curF}` }),
  metric: s => (s.phase === 'done' ? 1 : Math.min(0.95, s.expanded / 20)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.act === 'goal' ? '到' : `${s.curF}`),
  whyInRail: true,
  readouts: s => [
    { label: '当前 f', value: s.phase === 'done' ? '—' : `${s.curG}+${s.curH}=${s.curF}` },
    { label: '已展开', value: `${s.expanded} 格` },
    { label: '开放集', value: `${s.open.length}` },
    { label: '结果', value: s.phase === 'done' ? `最短 ${s.path.length - 1} 步` : '搜索中', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const perceptron: Experiment<PerceptronState> = {
  id: 'perceptron',
  group: '深度学习算法',
  title: '感知机',
  subtitle: '一个神经元靠"错了就纠"学出分界线',
  kernel: perceptronKernel,
  defaultDoc: { kind: 'perceptron', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '感知机是神经网络的最小单元:给输入各配权重 w、加偏置 b,算 w·x+b 看正负判类别——几何上就是一条分界线(高维是超平面)。它怎么学?错了就纠:遇到分错的点,把权重朝"下次能分对它"的方向挪一点(w+=y·x、b+=y,y=±1 是真实类别)。反复扫所有点,只要两类线性可分,感知机收敛定理保证有限步内学到能全分对的线。本实验 6 个点(3 正 3 负),看线从乱猜开始、每遇分错点纠一下、慢慢转到位,5 次更新后某轮零错误即收敛(w=-3,2;b=1)。它是逻辑回归、SVM 和整个深度网络里每个神经元的祖先(激活换成硬阈值 sign)。',
  bounds: [
    '6 个点(3 正 3 负),线性可分',
    'score=w·x+b;符号≠真实类就纠 w+=y·x、b+=y(可核)',
    '扫到某轮零错误即收敛;这里 5 次更新',
    '仅线性可分才收敛;异或需多层+非线性',
  ],
  tabs: [{ id: 'plane', label: '平面学线' }],
  Stage: PerceptronStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.updates} 次收敛` } : s.act === 'converged' ? { key: 'good', label: '收敛' } : s.updated ? { key: 'bad', label: '纠正' } : { key: 'idle', label: '分对' }),
  metric: s => (s.phase === 'done' || s.act === 'converged' ? 1 : Math.min(0.9, s.updates / 5)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.act === 'converged' ? '敛' : s.updated ? '纠' : '✓'),
  whyInRail: true,
  readouts: s => [
    { label: '权重 w', value: `(${s.w.join(',')})` },
    { label: '偏置 b', value: `${s.b}` },
    { label: '本步', value: s.ptIdx >= 0 ? `点(${s.pts[s.ptIdx].x.join(',')}) score=${s.score}` : s.act === 'converged' ? '零错误' : '完成' },
    { label: '纠正次数', value: `${s.updates}`, tone: s.act === 'converged' || s.phase === 'done' ? 'good' : undefined },
  ],
}

const pooling: Experiment<PoolState> = {
  id: 'pooling',
  group: '深度学习算法',
  title: '池化 Pooling',
  subtitle: '小窗口把特征图缩小，只留每块最强/平均的信号',
  kernel: poolingKernel,
  defaultDoc: { kind: 'pooling', params: { kind: '最大' }, entities: [], streams: [] },
  params: [
    { key: 'kind', label: '汇总方式', kind: 'enum', options: ['最大', '平均'] },
  ],
  paramsNote: '卷积后的特征图往往很大、带位置冗余。池化用小窗口(这里 2×2)在图上不重叠地滑,每块把 4 个数汇总成 1 个:最大池化取最大(留最强响应)、平均池化取平均(留整体强度)。于是图边长减半、面积变 1/4——降采样:计算量骤减、对小平移更鲁棒(窗口里挪一格,最大值常不变)、感受野变大。它没有可学参数,是固定的汇总操作。本实验 4×4→2×2:最大池化=[[6,4],[7,9]]、平均池化=[[3.75,2.25],[4,5]],每个输出对着窗口可手算。CNN 里紧跟卷积(LeNet/VGG),后来常被步长卷积替代。',
  bounds: [
    '4×4 特征图,2×2 窗口不重叠',
    '每块取最大或平均→输出 1 个数(可核)',
    '最大池化=[[6,4],[7,9]];平均=[[3.75,2.25],[4,5]]',
    '边长减半、面积 1/4;无可学参数',
  ],
  tabs: [{ id: 'pool', label: '窗口降采样' }],
  Stage: PoolingStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.kindName}池化` } : s.wr >= 0 ? { key: 'idle', label: `→${s.result}` } : { key: 'idle', label: s.kindName }),
  metric: s => { const filled = s.out.flat().filter(x => x !== null).length; return s.phase === 'done' ? 1 : filled / 4 },
  tickLabel: s => (s.phase === 'done' ? '毕' : s.wr >= 0 ? `${s.result}` : '⋯'),
  whyInRail: true,
  readouts: s => [
    { label: '汇总方式', value: `${s.kindName}池化` },
    { label: '当前窗口', value: s.wr >= 0 && s.phase !== 'done' ? `(${s.wr},${s.wc})` : '—' },
    { label: '窗口内', value: s.vals.length ? `[${s.vals.join(',')}]` : '—' },
    { label: '本块结果', value: s.wr >= 0 && s.phase !== 'done' ? `${s.result}` : (s.phase === 'done' ? '缩成 2×2' : '—') },
  ],
}

const beam: Experiment<BeamState> = {
  id: 'beam',
  group: '大模型算法',
  title: '束搜索 Beam Search',
  subtitle: '每步只留最有希望的前 k 条序列',
  kernel: beamKernel,
  defaultDoc: { kind: 'beam', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '语言模型每步给出下一个词的概率,一句话的概率=各步概率连乘。想整句概率最大,逐词贪心(每步取当前最高)常掉坑:某步的局部最优词后面接不出好句。全搜索又爆炸。束搜索折中:维护 k 条候选(束宽 k),每步各扩一个词、按累积概率排序,只留前 k 条继续,其余剪枝。k=1 就是贪心、k=∞ 就是全搜索。本实验玩具模型、k=2、生成 3 词:贪心第一步就贪 A(0.5＞0.4)被锁进 AB⟨end⟩(0.10);束搜索同时留 B,发现 B→C→⟨end⟩ 概率 0.288、近 3 倍胜出。束搜索是机器翻译、摘要、受限生成的标准解码法(配长度归一化等)。',
  bounds: [
    '玩具语言模型,束宽 k=2,生成 3 个词',
    '每步 k 条各扩一词→按累积概率(连乘)留前 k 条(可核)',
    '束搜索 BC⟨end⟩=0.288 胜过贪心 AB⟨end⟩=0.10',
    'k=1 退化成贪心;k 越大越接近最优、越慢',
  ],
  tabs: [{ id: 'beam', label: '扩展+剪枝' }],
  Stage: BeamStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `胜贪心 ${Math.round((s.best.p / (s.greedy.p || 1)) * 10) / 10}×` } : { key: 'idle', label: `第${s.t}步` }),
  metric: s => (s.phase === 'done' ? 1 : Math.min(0.9, s.t / 3)),
  tickLabel: s => (s.phase === 'done' ? '毕' : `t${s.t}`),
  whyInRail: true,
  readouts: s => [
    { label: '束宽 k', value: `${s.k}` },
    { label: '解码步', value: s.phase === 'done' ? '完成' : `第 ${s.t} 步` },
    { label: '当前最优', value: `${s.best.seq === '' ? '⟨起⟩' : s.best.seq.replace('·', '⟨end⟩')} (${s.best.p})` },
    { label: '对照贪心', value: s.showGreedy ? `${s.greedy.seq.replace('·', '⟨end⟩')} (${s.greedy.p})` : '待揭晓', tone: s.showGreedy ? 'good' : undefined },
  ],
}

const rnn: Experiment<RNNState> = {
  id: 'rnn',
  group: '深度学习算法',
  title: '循环神经网络 RNN',
  subtitle: '一个隐藏状态沿时间流动，把"过去"记在里面',
  kernel: rnnKernel,
  defaultDoc: { kind: 'rnn', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '感知机/CNN 一次看一个固定大小输入,处理不了变长序列(一句话、一段语音)。RNN 引入一个隐藏状态 h(记忆)沿时间一步步传递:每读一个 x_t,就用同一套共享权重把"当前输入+上一刻记忆"揉进新记忆 h_t=tanh(wx·x_t+wh·h_{t-1}+b)。权重所有时刻共享(能吃任意长序列),h_t 藏着全部过去——同样当前输入、历史不同 h 就不同。本实验序列 [2,-1,3,-2],wx=0.5、wh=0.8、b=0:逐步算 h=tanh(1)=0.762→0.109→0.92→-0.258,每步可手算。末尾演示记忆:同样最后输入 +2,历史 [2] 得 0.923、[-3] 得 0.269。长序列会梯度消失,于是有 LSTM/GRU 门控、再到 Transformer 注意力。',
  bounds: [
    '序列 [2,-1,3,-2],wx=0.5 wh=0.8 b=0,h₀=0',
    '每步 h_t=tanh(wx·x_t+wh·h_{t-1}+b)(可核)',
    'h:0.762→0.109→0.92→-0.258;权重所有时刻共享',
    'h_t 藏历史:同样末输入、历史不同 h 不同',
  ],
  tabs: [{ id: 'unroll', label: '时间展开' }],
  Stage: RNNStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `末态 ${s.ht}` } : s.t > 0 ? { key: 'idle', label: `h=${s.ht}` } : { key: 'idle', label: '记忆流动' }),
  metric: s => (s.phase === 'done' ? 1 : s.xs.length ? s.t / s.xs.length : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : `t${s.t}`),
  whyInRail: true,
  readouts: s => [
    { label: '时间步', value: s.phase === 'done' ? '读完' : `第 ${s.t} 步` },
    { label: '当前输入', value: s.t > 0 && s.phase !== 'done' ? `x=${s.xt}` : '—' },
    { label: '记忆 h', value: s.t > 0 || s.phase === 'done' ? `${s.ht}` : '0', tone: s.phase === 'done' ? 'good' : undefined },
    { label: '共享权重', value: `wx=${s.wx} wh=${s.wh}` },
  ],
}

const wordvec: Experiment<WordVecState> = {
  id: 'wordvec',
  group: '深度学习算法',
  title: '词向量 Word2Vec',
  subtitle: '意思变成位置，语义关系变成可加减的方向',
  kernel: wordvecKernel,
  defaultDoc: { kind: 'wordvec', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '词向量把每个词映射成稠密向量,让"意思"变成"位置"。靠分布假设学出来:出现在相似上下文的词(猫/狗都跟宠物、喂食共现)向量就相近,skip-gram/CBOW 让共现的词向量相互靠近。学好后有惊人性质:语义关系体现为向量方向——国王−男人+女人≈王后:"国王减男人"得到"王室"方向,再加"女人"就落到"王后"。本实验用两条可解释语义轴(王室度×性别)给几个词定坐标,现场演示:国王(1,0)−男人(0,0)=王室方向(1,0),+女人(0,1)=(1,1),离它最近的词正是王后(1,1)距离0。每步向量加减、最近邻距离都可手算。词向量是 NLP 从符号迈向语义的关键一步,也是所有大模型输入层的地基。',
  bounds: [
    '词摆进平面:横轴王室度、纵轴性别',
    '国王−男人+女人:向量加减(可核)',
    '(1,0)−(0,0)+(0,1)=(1,1)=王后,最近邻距离 0',
    '真实词向量几百维、从海量文本自动学',
  ],
  tabs: [{ id: 'space', label: '语义空间' }],
  Stage: WordVecStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `=${s.nearest}` } : s.stage === 'find' ? { key: 'good', label: s.nearest } : { key: 'idle', label: s.stage === 'sub' ? '王室方向' : s.stage === 'add' ? '加女人' : '语义空间' }),
  metric: s => { const order: Record<string, number> = { show: 0.15, sub: 0.4, add: 0.65, find: 0.9, done: 1 }; return order[s.stage] ?? 0 },
  tickLabel: s => (s.phase === 'done' ? '毕' : s.stage === 'sub' ? '减' : s.stage === 'add' ? '加' : s.stage === 'find' ? '找' : '摆'),
  whyInRail: true,
  readouts: s => [
    { label: '类比', value: '国王−男人+女人' },
    { label: '本步', value: s.stage === 'sub' ? `方向=(${s.dir.join(',')})` : s.stage === 'add' || s.stage === 'find' || s.phase === 'done' ? `结果=(${s.result.join(',')})` : '摆词' },
    { label: '最近的词', value: s.stage === 'find' || s.phase === 'done' ? `${s.nearest}(${s.ranked[0]?.d})` : '?', tone: s.phase === 'done' ? 'good' : undefined },
    { label: '维度', value: '2(真实:几百维)' },
  ],
}

const lstm: Experiment<LSTMState> = {
  id: 'lstm',
  group: '深度学习算法',
  title: 'LSTM 门控',
  subtitle: '给记忆装门，一条几乎不衰减的 cell 传送带扛住长距离依赖',
  kernel: lstmKernel,
  defaultDoc: { kind: 'lstm', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '普通 RNN 的记忆每步都过 tanh、反复挤压,长序列很快忘光=梯度消失。LSTM 另开一条细胞状态 c 当传送带:更新是 c_t=f·c_{t-1}+i·c̃——加法为主、近乎线性的高速路。三个门(0~1 sigmoid)控制:遗忘门 f 留多少旧记忆、输入门 i 写多少新内容、输出门 o 放多少出来;h=o·tanh(c)。f≈1、i≈0 时旧记忆和梯度原封不动传很远。本实验"记住开头、末尾取出"任务,标量 4 步(门值理想化 0/1):存(i=1,c̃=0.8→c=0.8)、守守(f=1,i=0→c 一直 0.8)、取(o=1→h=tanh(0.8)=0.664)。cell 全程稳在 0.8,正是 RNN 做不到的长期记忆。GRU 是简化;后来 Transformer 注意力。',
  bounds: [
    '标量 LSTM 4 步:存→守→守→取',
    'c=f·c_prev+i·c̃、h=o·tanh(c)(可核)',
    'cell 全程 0.8(f=1 守住);末步 h=tanh(0.8)=0.664',
    '门理想化 0/1(真实 0~1 sigmoid);GRU 是简化',
  ],
  tabs: [{ id: 'gate', label: '门控+传送带' }],
  Stage: LSTMStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `守住 ${s.c}` } : s.role === '存' ? { key: 'idle', label: '写入' } : s.role === '守' ? { key: 'good', label: '守住' } : s.role === '取' ? { key: 'good', label: '取出' } : { key: 'idle', label: '门控' }),
  metric: s => (s.phase === 'done' ? 1 : s.t > 0 ? s.t / 4 : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.role || `t${s.t}`),
  whyInRail: true,
  readouts: s => [
    { label: '细胞状态 c', value: s.t > 0 || s.phase === 'done' ? `${s.c}` : '0', tone: s.phase === 'done' ? 'good' : undefined },
    { label: '隐藏 h', value: s.t > 0 || s.phase === 'done' ? `${s.h}` : '0' },
    { label: '门 f/i/o', value: s.t > 0 && s.phase !== 'done' ? `${s.f}/${s.ig}/${s.o}` : '—' },
    { label: '本步', value: s.t > 0 && s.phase !== 'done' ? s.role : s.phase === 'done' ? '取出' : '待走' },
  ],
}

const norm: Experiment<NormState> = {
  id: 'norm',
  group: '深度学习算法',
  title: '归一化 BatchNorm / LayerNorm',
  subtitle: '把一批激活拉成零均值单位方差——差别只在沿哪条轴',
  kernel: normKernel,
  defaultDoc: { kind: 'norm', params: { kind: '批归一化' }, entities: [], streams: [] },
  params: [
    { key: 'kind', label: '归一化方式', kind: 'enum', options: ['批归一化', '层归一化'] },
  ],
  paramsNote: '深层网络每层激活分布随训练乱漂,优化变难。归一化把激活拉回零均值、单位方差 x̂=(x−μ)/√(σ²+ε),再乘可学 γ、加 β。关键分歧在沿哪条轴统计 μ、σ:BatchNorm 对每个特征、在一个 batch 的所有样本上算(依赖 batch,训练/推理不同、小 batch 不稳,多见于 CNN);LayerNorm 对每个样本、在它自己所有特征上算(不依赖 batch、对序列稳,是 Transformer/RNN 标配,RMSNorm 是它省掉减均值的简化)。本实验 4 样本×3 特征:批归一化沿列(特征跨样本,恰好都 σ=2 归一成 ±1)、层归一化沿行(样本跨特征)。每个 μ/σ/归一化值可手算,一眼看清谁沿谁的轴。',
  bounds: [
    '4 样本 × 3 特征的激活表',
    'BatchNorm 沿列(每特征跨 4 样本)、LayerNorm 沿行(每样本跨 3 特征)',
    '都是 (x−μ)/σ,差别只在沿哪条轴统计(可核)',
    '批归一化恰好 σ=2→归一成 ±1;再乘 γ 加 β',
  ],
  tabs: [{ id: 'axis', label: '沿轴归一化' }],
  Stage: NormStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '已归一化' } : s.slice >= 0 ? { key: 'idle', label: `μ=${s.mu} σ=${s.sigma}` } : { key: 'idle', label: s.kindName }),
  metric: s => { const filled = s.out.flat().filter(x => x !== null).length; const total = s.mat.length * s.mat[0].length; return s.phase === 'done' ? 1 : filled / total },
  tickLabel: s => (s.phase === 'done' ? '毕' : s.axis === 'col' ? `f${s.slice + 1}` : `s${s.slice + 1}`),
  whyInRail: true,
  readouts: s => [
    { label: '方式', value: s.kindName },
    { label: '沿轴', value: s.axis === 'col' ? '样本轴(每列一特征)' : '特征轴(每行一样本)' },
    { label: '本片 μ/σ', value: s.slice >= 0 && s.phase !== 'done' ? `${s.mu} / ${s.sigma}` : '—' },
    { label: '状态', value: s.phase === 'done' ? '零均值单位方差' : '归一化中', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const rag: Experiment<RagState> = {
  id: 'rag',
  group: '大模型算法',
  title: 'RAG 检索增强生成',
  subtitle: '先按相似度检索资料塞进上下文，再据此作答',
  kernel: ragKernel,
  defaultDoc: { kind: 'rag', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '大模型的知识冻结在训练参数里:会过时、记不住私有资料、爱编造(幻觉)。RAG 给它外挂"开卷考试":把问题编码成查询向量,在向量化知识库里按相似度(内积/余弦)检索最相关的 top-k,作为上下文塞进提示词,再让模型据此作答。答案有据可查、可溯源、随库更新、少幻觉,不用重训。检索这一步就是向量最近邻——和词向量、k-NN 同源。本实验问"猫爱吃什么",知识库 5 篇:两篇讲猫吃的相似度最高(0.9、0.74)被检索,汽车(0)、植物(0.02)落选;top-2 拼进上下文,模型据此答"肉和鱼"。相似度、检索结果都可手算。RAG 是问答、客服、企业搜索的主流范式。',
  bounds: [
    '问题 vs 知识库 5 篇,按点积相似度检索',
    '猫吃两篇 0.9/0.74 命中;汽车 0、植物 0.02 落选(可核)',
    'top-2 拼进上下文→模型据此作答',
    '检索=向量最近邻;答案有出处、可更新、少幻觉',
  ],
  tabs: [{ id: 'rag', label: '检索+增强+生成' }],
  Stage: RagStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '据此作答' } : s.stage === 'retrieve' ? { key: 'good', label: `命中 ${s.retrieved.length}` } : s.stage === 'augment' ? { key: 'idle', label: '增强' } : { key: 'idle', label: s.stage === 'score' ? '算相似度' : '检索' }),
  metric: s => { const order: Record<string, number> = { query: 0.15, score: 0.4, retrieve: 0.65, augment: 0.85, done: 1 }; return order[s.stage] ?? 0 },
  tickLabel: s => (s.phase === 'done' ? '答' : s.stage === 'score' ? '相似' : s.stage === 'retrieve' ? '检索' : s.stage === 'augment' ? '增强' : '问'),
  whyInRail: true,
  readouts: s => [
    { label: '阶段', value: s.stage === 'query' ? '编码问题' : s.stage === 'score' ? '算相似度' : s.stage === 'retrieve' ? '检索 top-k' : s.stage === 'augment' ? '增强上下文' : s.phase === 'done' ? '生成' : '待走' },
    { label: '知识库', value: `${s.docs.length} 篇` },
    { label: '命中', value: s.retrieved.length ? s.retrieved.map(i => `#${i + 1}`).join(' ') : '—', tone: s.retrieved.length ? 'good' : undefined },
    { label: '答案', value: s.phase === 'done' ? s.answer : '待检索' },
  ],
}

const selfconsist: Experiment<SelfConsistState> = {
  id: 'selfconsist',
  group: '大模型算法',
  title: '思维链自洽 Self-Consistency',
  subtitle: '采样多条推理链，多数投票',
  kernel: selfconsistKernel,
  defaultDoc: { kind: 'selfconsist', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '单条贪心推理一步错就步步错、没有回头路。自洽的洞见:一道有唯一答案的推理题,正确的推法往往很多条、都通向同一个答案,错法则五花八门、彼此不一致。于是让模型对同一题采样 N 条推理链(温度采样制造多样),每条独立推到一个答案,最后取出现次数最多的那个(多数投票),就能把少数算错的链投下去,显著提升推理准确率(尤其数学、常识题)。本实验一道应用题(正解 17)采样 5 条链:3 条不同算法都得 17、1 条括号搞错得 32、1 条乘错得 19,投票 17:3 多数胜出;贪心若单采到错链就答错。票数可手数。自洽是提升 LLM 推理的经典简单招,配思维链 CoT 用,代价是多跑 N 次。',
  bounds: [
    '一道应用题(正解 17),采样 5 条推理链',
    '每条独立推到答案,最后多数投票(可核)',
    '17:3 / 32:1 / 19:1 → 17 胜出(正确)',
    '贪心单链可能采到错链;自洽用投票救回',
  ],
  tabs: [{ id: 'vote', label: '采样+投票' }],
  Stage: SelfConsistStage,
  tone: s => (s.phase === 'done' ? { key: s.winner === s.correct ? 'good' : 'bad', label: `${s.winner} 胜出` } : { key: 'idle', label: `${s.chains.length}/${s.n} 链` }),
  metric: s => (s.phase === 'done' ? 1 : s.n ? s.chains.length / s.n : 0),
  tickLabel: s => (s.phase === 'done' ? '票' : `链${s.chains.length}`),
  whyInRail: true,
  readouts: s => [
    { label: '已采样', value: `${s.chains.length}/${s.n} 链` },
    { label: '本链答案', value: s.chains.length && s.phase !== 'done' ? `${s.chains[s.chains.length - 1].a}${s.chains[s.chains.length - 1].ok ? '' : '(错)'}` : '—' },
    { label: '当前多数', value: s.tally.length ? `${s.tally[0][0]}(${s.tally[0][1]}票)` : '—' },
    { label: '结果', value: s.phase === 'done' ? `${s.winner} 胜出` : '投票中', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const bestofn: Experiment<BestOfNState> = {
  id: 'bestofn',
  group: '大模型算法',
  title: 'Best-of-N 拒绝采样',
  subtitle: '采样 N 个候选，打分器挑最高分的那个',
  kernel: bestofnKernel,
  defaultDoc: { kind: 'bestofn', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '生成一次质量参差:模型有时灵光、有时平庸。Best-of-N(拒绝采样)思路直白:多采几个、挑最好的。关键是有个打分器——训练好的奖励模型(给回答质量/有用性/安全性打分,RLHF 里就用它)或可算的验证器(数学验算、代码跑单测)。采样 N 个、逐个打分、argmax 取最高,用算力换质量。和自洽的多数投票不同:这里靠外部打分器选单个最好,适合开放式生成(没有"多数答案"可投)。本实验任务"用 3、8、5 拼算式凑近 24",采样 5 个,验证器按接近程度打分(奖励=10−|24−结果|):3×8=24 满分 10、5×3+8=23 得 9、8×5=40 得 0,取最高 → 3×8。结果、奖励都可手算。N 越大质量越好但越贵,还受打分器质量限制。',
  bounds: [
    '任务:用 3、8、5 拼算式凑近 24,采样 5 个候选',
    '验证器打分:奖励=10−|24−结果|(可核)',
    '3×8=24 得 10 分最高 → 采纳;8×5=40 得 0',
    'argmax 取最高(≠自洽的多数投票);用算力换质量',
  ],
  tabs: [{ id: 'pick', label: '采样+择优' }],
  Stage: BestOfNStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `取 ${s.cands[s.bestIdx]?.reward} 分` } : { key: 'idle', label: `${s.cands.length}/${s.n}` }),
  metric: s => (s.phase === 'done' ? 1 : s.n ? s.cands.length / s.n : 0),
  tickLabel: s => (s.phase === 'done' ? '取' : `候${s.cands.length}`),
  whyInRail: true,
  readouts: s => [
    { label: '已采样', value: `${s.cands.length}/${s.n}` },
    { label: '本候选分', value: s.cands.length && s.phase !== 'done' ? `${s.cands[s.cands.length - 1].reward}` : '—' },
    { label: '当前最高', value: s.cands.length ? `${s.cands[s.bestIdx].e}(${s.cands[s.bestIdx].reward})` : '—', tone: 'good' },
    { label: '结果', value: s.phase === 'done' ? `采纳 ${s.cands[s.bestIdx].e}` : '择优中' },
  ],
}

const tot: Experiment<ToTState> = {
  id: 'tot',
  group: '大模型算法',
  title: '思维树 ToT',
  subtitle: '推理展开成树：生成多个想法、评估、剪枝、搜索',
  kernel: totKernel,
  defaultDoc: { kind: 'tot', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '思维链(CoT)一条道走到黑,错一步没有回头路;自洽采多条独立链投票,但每条内部还是一条线。思维树 ToT 更进一步:把问题的中间状态当树节点,每步扩展出多个想法分支,并用一个评估器给每个分支判前景(能否通向解:sure/maybe/impossible),于是能像搜索一样广度/深度优先地探索、剪枝、回溯——把"想不同的路、比一比、走最有希望的、走不通就退回换一条"变成显式过程,像下棋时在脑中推演多步、剪掉臭棋。本实验 24 点用 [4,3,2] 凑 24:从根展开 5 个想法,3 个前景 sure(剩两数能乘到 24)、2 个 impossible,剪掉没希望的,沿一个展开 4×3=12、12×2=24 找到解。擅长需探索/试错/规划的难题;代价是分支多、评估多,更贵更慢。',
  bounds: [
    '24 点:用 [4,3,2] 凑 24',
    '生成想法(分支)→评估前景(sure/impossible)→剪枝→搜索(可核)',
    '3 个 sure、2 个 impossible;沿 {12,2} 展开 12×2=24 解出',
    '比 CoT(单线)/自洽(独立多线)更进一步:树+评估+回溯',
  ],
  tabs: [{ id: 'tree', label: '想法树搜索' }],
  Stage: ToTStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '解出' } : s.stage === 'prune' ? { key: 'bad', label: '剪枝' } : s.stage === 'evaluate' ? { key: 'idle', label: '评估' } : s.stage === 'expand' ? { key: 'good', label: '找到解' } : { key: 'idle', label: '展开' }),
  metric: s => { const order: Record<string, number> = { root: 0.1, generate: 0.35, evaluate: 0.55, prune: 0.75, expand: 0.95, done: 1 }; return order[s.stage] ?? 0 },
  tickLabel: s => (s.phase === 'done' ? '解' : s.stage === 'generate' ? '生' : s.stage === 'evaluate' ? '评' : s.stage === 'prune' ? '剪' : s.stage === 'expand' ? '搜' : '根'),
  whyInRail: true,
  readouts: s => [
    { label: '阶段', value: s.stage === 'root' ? '根' : s.stage === 'generate' ? '生成想法' : s.stage === 'evaluate' ? '评估前景' : s.stage === 'prune' ? '剪枝' : s.stage === 'expand' ? '展开搜索' : s.phase === 'done' ? '解出' : '待走' },
    { label: '分支数', value: s.thoughts.length ? `${s.thoughts.length}` : '—' },
    { label: '已剪枝', value: s.thoughts.filter(t => t.pruned).length ? `${s.thoughts.filter(t => t.pruned).length}` : '—', tone: s.stage === 'prune' ? 'bad' : undefined },
    { label: '解', value: s.phase === 'done' ? s.solution : '搜索中', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const collision: Experiment<CollisionState> = {
  id: 'collision',
  group: '力学',
  title: '弹性碰撞沙盘',
  subtitle: '实时物理引擎 · 碰撞里动能/动量转移，但总量守恒',
  kernel: collisionKernel,
  defaultDoc: { kind: 'collision', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '这是一个实时仿真实验:舞台里跑的是开源 2D 物理引擎 Matter.js(不是预先算好的逐帧轨迹)。小球在盒子里做弹性碰撞(无摩擦),可拖拽甩球、加球、开关重力。物理原理:碰撞把动能、动量在物体间转移——有的加速、有的减速,但所有球加起来总动能守恒、总动量守恒(弹性碰撞、无摩擦时)。上方读数实时显示总动能、总动量:碰撞再乱,总量基本不变(引擎数值积分有极小漂移)。这是物理学科的可视化路子——把看不见的守恒律变成看得见、摸得着、可交互的仿真。',
  bounds: [
    '实时仿真:开源物理引擎 Matter.js(非逐帧预算)',
    '小球弹性碰撞(无摩擦);可拖拽/加球/开关重力',
    '总动能守恒、总动量守恒(读数实时显示)',
    '数值积分有极小漂移;开重力则堆到底部',
  ],
  tabs: [{ id: 'sim', label: '实时仿真' }],
  Stage: CollisionStage,
  tone: s => (s.phase === 'run' ? { key: 'good', label: '守恒' } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'run' ? 1 : 0.3),
  tickLabel: s => (s.phase === 'run' ? '恒' : '始'),
  whyInRail: true,
  readouts: s => [
    { label: '球数', value: `${s.n}` },
    { label: '守恒量', value: '动能 + 动量' },
    { label: '引擎', value: 'Matter.js(实时)' },
    { label: '交互', value: '拖拽 / 加球 / 重力' },
  ],
}

const gcn: Experiment<GcnState> = {
  id: 'gcn',
  group: '深度学习算法',
  title: '图卷积 GCN',
  subtitle: '每个节点聚合邻居的特征更新自己，信息沿边传播',
  kernel: gcnKernel,
  defaultDoc: { kind: 'gcn', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '社交关系、分子、知识图谱是图——节点数不定、每个节点邻居数还不一样,普通网络吃不了。图卷积 GCN 让每个节点聚合邻居的信息更新自己:最简单一层=把自己+所有邻居的特征平均,再乘可学权重 W、过激活。于是节点表示融进一跳邻居;叠 L 层信息传 L 跳,第 L 层节点概括它 L 跳内的子图。本实验 5 节点小图,节点 0、4 带初始特征 1(其余 0),看 GCN 一层逐个节点把自己+邻居平均——特征沿边渗开、相连节点变相似,每个平均值可手算。GCN 是节点分类、推荐、分子性质预测的核心,和词向量、注意力同属表示学习。',
  bounds: [
    '5 节点小图,节点 0、4 初始特征=1、其余 0',
    '一层=每节点把(自己+邻居)特征平均(可核)',
    '新特征 [0.333,0.333,0.25,0.333,0.5];信息渗一跳',
    '叠 L 层传 L 跳;真实 GCN 聚合后乘权重 W 过激活',
  ],
  tabs: [{ id: 'graph', label: '邻域聚合' }],
  Stage: GcnStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '渗一跳' } : s.cur >= 0 ? { key: 'idle', label: `→${s.result}` } : { key: 'idle', label: '聚合' }),
  metric: s => (s.phase === 'done' ? 1 : s.newFeat.filter(x => x !== null).length / 5),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.cur >= 0 ? `${s.cur}` : '⋯'),
  whyInRail: true,
  readouts: s => [
    { label: '当前节点', value: s.cur >= 0 && s.phase !== 'done' ? `${s.cur}` : '—' },
    { label: '聚合', value: s.agg.length ? `自己+邻居(${s.agg.length}个)` : '—' },
    { label: '新特征', value: s.cur >= 0 && s.phase !== 'done' ? `${s.result}` : '—', tone: s.phase === 'done' ? 'good' : undefined },
    { label: '感受野', value: '一层 = 1 跳' },
  ],
}

const pagerank: Experiment<PageRankState> = {
  id: 'pagerank',
  group: '机器学习算法',
  title: 'PageRank 网页排名',
  subtitle: '重要性顺着链接流动，被重要页面链到的也重要',
  kernel: pagerankKernel,
  defaultDoc: { kind: 'pagerank', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '网页海量,怎么排哪个更重要?PageRank 的洞见:一个页面的重要性取决于有多少、以及多重要的页面链到它——重要页面的投票更值钱。数学上是幂迭代:每页把当前 rank 平分给它链出的页面(链接=投票),每页新 rank=各方投来之和,再混入随机跳转(阻尼 d=0.85 防死循环)。反复迭代收敛,等价于随机上网者无穷点击后停在各页的概率(图上随机游走稳态)。本实验 4 页 A/B/C/D 互链,初始各 0.25,看幂迭代每轮把重要性顺箭头流动、重新分配,几轮收敛:C 最高(三个页面链到它)、D 最低(没人链它)。每轮 rank 可手算。Google 起家算法,搜索排序/影响力分析/推荐的基石。',
  bounds: [
    '4 个网页 A/B/C/D 互链,初始 rank 各 0.25',
    '每轮:每页把 rank 平分给链出页、收方求和+阻尼(可核)',
    '几轮收敛:C 最高(0.392)、D 最低(0.038,无人链)',
    '等价随机游走稳态;d=0.85 混入随机跳转',
  ],
  tabs: [{ id: 'graph', label: '重要性流动' }],
  Stage: PageRankStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.ranked[0].name} 胜` } : { key: 'idle', label: s.iter === 0 ? '初始' : `第${s.iter}轮` }),
  metric: s => (s.phase === 'done' ? 1 : s.iter / 6),
  tickLabel: s => (s.phase === 'done' ? '敛' : s.iter === 0 ? '始' : `${s.iter}`),
  whyInRail: true,
  readouts: s => [
    { label: '迭代', value: s.phase === 'done' ? '收敛' : s.iter === 0 ? '初始' : `第 ${s.iter} 轮` },
    { label: '排名', value: s.ranked.map(x => x.name).join(' > ') },
    { label: '最高', value: `${s.ranked[0].name} (${s.ranked[0].r})`, tone: s.phase === 'done' ? 'good' : undefined },
    { label: '阻尼 d', value: `${s.d}` },
  ],
}

const qlearn: Experiment<QLearnState> = {
  id: 'qlearn',
  group: '机器学习算法',
  title: '强化学习 Q-learning',
  subtitle: '靠试错拿奖励，把未来总回报倒推回每一步',
  kernel: qlearnKernel,
  defaultDoc: { kind: 'qlearn', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '强化学习:智能体在环境里试错,做对给奖励、做错给惩罚,学拿最多奖励的策略。难点是奖励延迟——走迷宫只有到终点才 +1,中间没反馈,怎么知道哪步走对?Q-learning:给每个状态估一个价值(从这出发未来总回报),用 Bellman 规则更新:格子价值=即时奖励+γ×下一格价值。于是终点的 +1 顺规则一圈圈倒推:挨着终点 0.9、再外 0.81…每远一步打 γ=0.9 折。学好后往价值最高的邻居走=最优策略,不用提前知道地图。本实验 5×4 网格,看价值从终点像波纹倒推(0.9→0.81→0.729),策略箭头指向终点,每格价值=0.9^到终点步数可手算。RL 是 AlphaGo、机器人、推荐、大模型 RLHF 的底子,AI 求职大热门。',
  bounds: [
    '5×4 走迷宫,终点 +1 奖励,γ=0.9',
    'Bellman:格子价值=即时奖励+γ×下一格价值(可核)',
    '价值从终点倒推:0.9^到终点步数;策略=往价值高处走',
    '不用提前知道地图;RL 是 AlphaGo/RLHF 底子',
  ],
  tabs: [{ id: 'grid', label: '价值倒推' }],
  Stage: QLearnStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `最优 ${s.path.length - 1} 步` } : s.ring >= 0 ? { key: 'idle', label: `第${s.ring}圈` } : { key: 'idle', label: '试错' }),
  metric: s => { const filled = s.value.filter(x => x !== null).length; return s.phase === 'done' ? 1 : filled / (s.w * s.h) },
  tickLabel: s => (s.phase === 'done' ? '毕' : s.ring < 0 ? '始' : `${s.ring}`),
  whyInRail: true,
  readouts: s => [
    { label: '价值倒推', value: s.phase === 'done' ? '满图' : s.ring < 0 ? '起步' : `第 ${s.ring} 圈` },
    { label: '折扣 γ', value: `${s.gamma}` },
    { label: '本圈价值', value: s.ring > 0 && s.phase !== 'done' ? `${Math.round(Math.pow(s.gamma, s.ring) * 1000) / 1000}` : '—' },
    { label: '最优路线', value: s.phase === 'done' ? `${s.path.length - 1} 步` : '学习中', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const recsys: Experiment<RecSysState> = {
  id: 'recsys',
  group: '机器学习算法',
  title: '推荐系统 · 矩阵分解',
  subtitle: '评分 = 用户隐向量 · 电影隐向量，内积补全"猜你喜欢"',
  kernel: recsysKernel,
  defaultDoc: { kind: 'recsys', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '推荐系统核心问题:用户只对极少数物品打过分,评分矩阵大半是空的,怎么猜他没看过的会打几分?协同过滤·矩阵分解:给每个用户、每个电影各学一个隐向量(压进低维隐空间),让评分≈用户隐向量·物品隐向量(内积)。已知评分把隐向量学出来(内积对上真实分),空缺处再用内积一算就是预测评分。口味和属性对得上(内积大)=推荐。本实验 3 用户×3 电影,隐向量用两条可解释轴(爱动作/爱文艺 × 动作度/文艺度):小明(1,0)·盗梦(4,3)=4 分预测;小明×小森林(纯文艺)=0 不推荐。每个内积可手算。Netflix/淘宝/抖音猜你喜欢的经典底子,和词向量同属把对象嵌进隐空间的表示学习。',
  bounds: [
    '3 用户 × 3 电影,评分表大半空缺',
    '评分=用户隐向量·电影隐向量(内积,可核)',
    '小明(1,0)·盗梦(4,3)=4;小明×小森林=0 不推',
    '真实隐向量几十上百维、从海量评分自动学',
  ],
  tabs: [{ id: 'matrix', label: '分解+预测' }],
  Stage: RecSysStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '补全' } : s.stage === 'predict' ? { key: 'good', label: `预测 ${s.rating[s.pr]?.[s.pc]}` } : { key: 'idle', label: s.stage === 'userv' ? '用户向量' : s.stage === 'moviev' ? '电影向量' : '评分表' }),
  metric: s => { const order: Record<string, number> = { matrix: 0.2, userv: 0.4, moviev: 0.6, predict: 0.8, done: 1 }; return order[s.stage] ?? 0 },
  tickLabel: s => (s.phase === 'done' ? '毕' : s.stage === 'predict' ? '测' : s.stage === 'userv' ? 'U' : s.stage === 'moviev' ? 'V' : '表'),
  whyInRail: true,
  readouts: s => [
    { label: '本步', value: s.stage === 'userv' ? '用户隐向量' : s.stage === 'moviev' ? '电影隐向量' : s.stage === 'predict' ? '内积预测' : s.phase === 'done' ? '补全推荐' : '评分表' },
    { label: '隐空间', value: '2 维(动作/文艺)' },
    { label: '预测评分', value: s.stage === 'predict' || s.phase === 'done' ? `${s.rating[s.pr]?.[s.pc]}` : '?', tone: s.phase === 'done' ? 'good' : undefined },
    { label: '已填', value: `${s.rating.flat().filter(x => x !== null).length}/9` },
  ],
}

const diffusion: Experiment<DiffusionState> = {
  id: 'diffusion',
  group: '深度学习算法',
  title: '扩散模型 Diffusion',
  subtitle: '前向加噪把图变噪声，反向去噪从噪声生成图',
  kernel: diffusionKernel,
  defaultDoc: { kind: 'diffusion', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '怎么让 AI 画出一张全新的图?扩散模型:先学破坏、再学修复。前向过程:拿真实图片一步步掺高斯噪声(x_t=√ᾱ·x₀+√(1−ᾱ)·ε),几十步后变成纯噪声——这步固定、不用学。反向过程:训练一个网络专门预测每一步掺了多少噪声、并去掉;于是从随机噪声出发、让网络一步步去噪,就生成出一张新图。加噪简单可算,去噪是网络学的,反着走这条路噪声就变成了创作。本实验一张 8×8 小图(❤),前向看它被噪声淹没(√ᾱ 从 1 降到 0.14)、反向看图像从噪声浮现。前向每步 √ᾱ/√(1−ᾱ) 可手算,反向是网络学的(演示恢复)。真实模型几十~千步、百万图训练、能按文字生成。Stable Diffusion/DALL·E/Sora 底层,AI 求职大热门。',
  bounds: [
    '一张 8×8 小图,前向加噪→反向去噪',
    '前向 x=√ᾱ·原图+√(1−ᾱ)·噪声(可核)',
    '√ᾱ 从 1 降到 0.14,信号被噪声淹没',
    '反向是网络学的:从噪声一步步去噪、生成新图',
  ],
  tabs: [{ id: 'diffuse', label: '加噪/去噪' }],
  Stage: DiffusionStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '生成✓' } : s.dir === 'forward' ? { key: 'idle', label: '加噪' } : { key: 'good', label: '去噪' }),
  metric: s => { const T = 3; if (s.phase === 'done') return 1; return s.dir === 'forward' ? (s.t / T) * 0.5 : 0.5 + ((T - s.t) / T) * 0.5 },
  tickLabel: s => (s.phase === 'done' ? '生' : s.dir === 'forward' ? '噪' : '清'),
  whyInRail: true,
  readouts: s => [
    { label: '方向', value: s.phase === 'done' ? '生成完成' : s.dir === 'forward' ? '前向加噪' : '反向去噪' },
    { label: '噪声级', value: `${s.t}` },
    { label: '√ᾱ 信号', value: `${s.sqrtA}` },
    { label: '√(1-ᾱ) 噪声', value: `${s.sqrtN}`, tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const mcts: Experiment<MctsState> = {
  id: 'mcts',
  group: '大模型算法',
  title: '蒙特卡洛树搜索 MCTS',
  subtitle: '随机模拟 + UCB，把思考花在最有希望的走法上',
  kernel: mctsKernel,
  defaultDoc: { kind: 'mcts', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '围棋每步几百种选择、走到底天文数字,穷举和 minimax 算不动。MCTS 用随机模拟+统计逼近:维护一棵树,每节点记访问次数 N 和胜率。每轮四步:选择(从根按 UCB=胜率+c·√(ln N父/N子) 挑分支,胜率高的多利用、试得少的多探索)→扩展(加新节点)→模拟(从这随机走到底得输赢)→回传(把结果更新回沿途节点)。反复几千上万轮,好走法被反复模拟、访问数飙升,最后选访问最多的。不需要评估函数,靠大量随机对局的统计说话。本实验根有 3 走法 A/B/C(A 好 B/C 差),看 UCB 先把三个都试一遍(未访问=∞)再集中到 A,6 轮后 A 访问 4 次全赢→选 A。每步 UCB 可手算。MCTS 是 AlphaGo/AlphaZero 引擎,和思维树 ToT 一脉相承。',
  bounds: [
    '根 3 个候选走法 A/B/C(A 好、B/C 差)',
    'UCB=胜率+c·√(ln N父/N子);未访问=∞ 先探索(可核)',
    '选择→模拟→回传;6 轮后 A 访问 4 次→选 A',
    '兼顾探索/利用;AlphaGo 引擎,接思维树 ToT',
  ],
  tabs: [{ id: 'tree', label: '模拟+UCB' }],
  Stage: MctsStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `选 ${s.moves[s.best]}` } : s.win === 1 ? { key: 'good', label: '模拟赢' } : s.win === 0 ? { key: 'bad', label: '模拟输' } : { key: 'idle', label: 'UCB 选' }),
  metric: s => (s.phase === 'done' ? 1 : s.iter / 6),
  tickLabel: s => (s.phase === 'done' ? '选' : s.iter === 0 ? '始' : s.pick >= 0 ? s.moves[s.pick] : `${s.iter}`),
  whyInRail: true,
  readouts: s => [
    { label: '模拟轮', value: s.phase === 'done' ? '结束' : s.iter === 0 ? '起步' : `第 ${s.iter} 轮` },
    { label: '本轮选中', value: s.pick >= 0 && !s.phase.includes('done') ? `${s.moves[s.pick]}(UCB ${s.ucb[s.pick] === null ? '∞' : s.ucb[s.pick]})` : '—' },
    { label: '访问次数', value: s.moves.map((m, k) => `${m}=${s.n[k]}`).join(' ') },
    { label: '结果', value: s.phase === 'done' ? `选 ${s.moves[s.best]}` : '搜索中', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const gan: Experiment<GanState> = {
  id: 'gan',
  group: '深度学习算法',
  title: '生成对抗网络 GAN',
  subtitle: '造假的 G 和验假的 D 互相较劲，把假数据逼到和真的难分',
  kernel: ganKernel,
  defaultDoc: { kind: 'gan', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '怎么生成逼真数据?GAN 用对抗博弈:生成器 G 从随机噪声造假、想骗过审查;判别器 D 学着分辨真假。两者对着干:G 要骗过 D、D 要抓住 G。训练轮流进步——D 抓得越准 G 就被迫造得越像,G 越像 D 又得学得更精。这场军备竞赛的纳什均衡:G 的假数据分布=真数据分布,D 再也分不出、准确率掉到 50%(瞎猜),G 就学会了以假乱真。本实验真数据聚在一处(蓝),G 造的假数据(红)一开始乱撒、D 一眼看穿(准确率高);随训练假数据逐轮逼近真分布,D 准确率从 100% 掉到 50%。每轮准确率=(真判真+假判假)/总,可手算。GAN 是早期图像生成里程碑(逼真人脸/风格迁移),和扩散模型同属生成模型,AI 求职热点。',
  bounds: [
    '真数据聚一处(蓝),G 造假数据(红)逐轮逼近',
    'D 准确率=(真判真+假判假)/总(可核)',
    '假数据混进真区越多、D 越难分:100%→50%',
    '均衡=假分布=真分布、D 瞎猜;和扩散同属生成模型',
  ],
  tabs: [{ id: 'adv', label: '对抗训练' }],
  Stage: GanStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `D ${s.acc}%` } : { key: 'idle', label: `第${s.round}轮` }),
  metric: s => (s.phase === 'done' ? 1 : (100 - s.acc) / 50),
  tickLabel: s => (s.phase === 'done' ? '成' : `${s.acc}`),
  whyInRail: true,
  readouts: s => [
    { label: '对抗轮', value: s.phase === 'done' ? '均衡' : `第 ${s.round} 轮` },
    { label: 'D 准确率', value: `${s.acc}%`, tone: s.phase === 'done' ? 'good' : undefined },
    { label: '骗过 D', value: `${s.fakeInside}/6 假数据` },
    { label: '结果', value: s.phase === 'done' ? 'G 学会生成' : 'G/D 较劲中' },
  ],
}

const conv: Experiment<ConvState> = {
  id: 'conv',
  group: '深度学习算法',
  title: '卷积 CNN',
  subtitle: '一个小窗口滑过图像，就能"看见"特征',
  kernel: convKernel,
  defaultDoc: { kind: 'conv', params: { kernel: '边缘' }, entities: [], streams: [] },
  params: [
    { key: 'kernel', label: '卷积核', kind: 'enum', options: ['边缘', '模糊', '锐化'] },
  ],
  paramsNote: 'CNN 的核心操作:拿一个小卷积核(几组权重)在整张图上滑窗,每处把核和底下像素做加权和(点积),拼起来就是特征图。妙处:同一个核共享权重扫全图——参数极少、平移不变(哪儿有这特征都认得)。不同核提不同特征:边缘核在明暗交界响应最强、模糊核求邻域平均、锐化核突出中心。很多层卷积叠起来,浅层看边缘纹理、深层拼物体,这就是 CNN 看图的底。本实验 5×5 输入(竖直边缘),3×3 核滑 9 个位置逐格填特征图。换核看不同特征怎么被提取。',
  bounds: [
    '5×5 输入(左暗右亮一条竖直边缘),3×3 卷积核',
    '每格特征=核⊙窗口的加权和(可核);滑窗 9 处',
    '边缘核:交界列±27、平坦≈0;模糊/锐化各不同',
    '单通道单核 stride 1;真实 CNN 多通道多核+池化',
  ],
  tabs: [{ id: 'slide', label: '滑窗+特征图' }],
  Stage: ConvStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.kernelName}特征` } : s.ci >= 0 ? { key: 'idle', label: `(${s.ci},${s.cj})` } : { key: 'idle', label: s.kernelName }),
  metric: s => { const done = s.out.flat().filter(x => x !== null).length; return done / 9 },
  tickLabel: s => (s.phase === 'done' ? '毕' : s.ci >= 0 ? `${s.ci}${s.cj}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '卷积核', value: `${s.kernelName}` },
    { label: '窗口位置', value: s.ci >= 0 ? `(${s.ci},${s.cj})` : '—' },
    { label: '本格加权和', value: s.ci >= 0 ? `${s.curVal}` : '—' },
    { label: '已算', value: `${s.out.flat().filter(x => x !== null).length}/9` },
  ],
}

const linreg: Experiment<LinRegState> = {
  id: 'linreg',
  group: '机器学习算法',
  title: '线性回归',
  subtitle: '机器怎么"拟合"一条线：梯度下降 + 最小二乘',
  kernel: linregKernel,
  defaultDoc: { kind: 'linreg', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '线性回归=最基础的学习:给一堆 (x,y) 点,找一条 y=wx+b 让它离所有点最近。"最近"用均方误差 MSE(点到直线竖直距离的平方和平均)衡量。从随便一条线出发,顺负梯度调 w、b 让 MSE 下降——梯度下降在做回归。它有闭式最优解(最小二乘 OLS),梯度下降会收敛到它。看懂这条就抓住了几乎所有 ML 训练的骨架:定损失→对参数求梯度→沿负梯度更新→拟合。本实验 12 个确定性散点(真线 y≈2x+1+噪声),w、b 从 0、lr=0.06 梯度下降:直线转进点云、残差变短、MSE 8.8→0.14、w→2.22 b→0.92(=OLS)。',
  bounds: [
    '12 个确定性散点(真线 y≈2x+1 加噪声),可复现',
    '损失=MSE;梯度下降 w←w−lr·∂MSE/∂w、b 同理(可核)',
    'MSE 单调降 8.8→0.14;w/b 收敛到最小二乘闭式解',
    '一元线性;多元/正则化未建',
  ],
  tabs: [{ id: 'fit', label: '散点+拟合' }],
  Stage: LinRegStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `MSE ${s.mse.toFixed(2)}` } : { key: 'idle', label: `步 ${s.gdStep}` }),
  metric: s => Math.max(0, Math.min(1, 1 - s.mse / 8.8)),
  tickLabel: s => (s.phase === 'done' ? '毕' : `${s.gdStep}`),
  whyInRail: true,
  readouts: s => [
    { label: '梯度下降步', value: `${s.gdStep}` },
    { label: 'MSE', value: `${s.mse}`, tone: s.phase === 'done' ? 'good' : undefined },
    { label: '直线', value: `y=${s.w}x+${s.b}` },
    { label: 'OLS 最优', value: `w=${s.wOls} b=${s.bOls}` },
  ],
}

const pp: Experiment<PPState> = {
  id: 'pp',
  group: '大模型推理',
  title: '流水线并行 PP',
  subtitle: '按层切到多卡，用微批填掉流水线气泡',
  kernel: ppKernel,
  defaultDoc: { kind: 'pp', params: { micro: 4 }, entities: [], streams: [] },
  params: [
    { key: 'micro', label: '微批数', kind: 'number', options: [1, 2, 4, 8] },
  ],
  paramsNote: '模型太大放不下一张卡:除切头(TP)、切专家(EP),还能按层切——连续几层放一卡,做成 G 级流水线(卡0算前几层→…→卡G-1算最后几层)。只喂一个 batch 时它一级级往下走,同一时刻只有 1 张卡干活、其余在等,利用率仅 1/G、大量流水线气泡。解法:把 batch 切成 M 个微批首尾衔接流进来,稳态时 G 卡同时各处理一个微批,气泡只剩开头注入+结尾排空,占比 (G−1)/(M+G−1)——微批越多气泡越小。代价:微批太碎单次算量太碎划不来,M 有甜点。这就是 GPipe/1F1B 流水线调度的核心。本实验 G=4 级、M 个微批,逐时刻看调度表哪格在算、哪格是气泡。',
  bounds: [
    'G=4 级流水线,M 个微批(1/2/4/8)',
    '调度 sched[s][t]=微批 (t−s) 若有效否则气泡(可核)',
    '总时长 M+G−1、气泡占比 (G−1)/(M+G−1)、利用率随 M 升',
    '简化 forward-only;真实 1F1B 还交织反向、省显存',
  ],
  tabs: [{ id: 'sched', label: '流水调度' }],
  Stage: PPStage,
  tone: s => (s.phase === 'done' ? { key: s.bubblePct > 50 ? 'bad' : 'good', label: `气泡 ${s.bubblePct}%` } : { key: 'idle', label: `t${s.t + 1}/${s.totalTime}` }),
  metric: s => s.util / 100,
  tickLabel: s => (s.phase === 'done' ? '毕' : `t${s.t + 1}`),
  whyInRail: true,
  readouts: s => [
    { label: '微批数 M', value: `${s.micro}` },
    { label: '总时长', value: `${s.totalTime}` },
    { label: '利用率', value: `${s.util}%`, tone: s.util >= 60 ? 'good' : undefined },
    { label: '气泡', value: `${s.bubblePct}%`, tone: s.bubblePct > 50 ? 'bad' : undefined },
  ],
}

const ep: Experiment<EPState> = {
  id: 'ep',
  group: '大模型推理',
  title: '专家并行 EP',
  subtitle: 'MoE 的巨大专家分到多卡，代价是 all-to-all',
  kernel: epKernel,
  defaultDoc: { kind: 'ep', params: { gpus: 4 }, entities: [], streams: [] },
  params: [
    { key: 'gpus', label: '卡数', kind: 'number', options: [2, 4] },
  ],
  paramsNote: 'MoE 把巨大 FFN 换成 E 个专家,每 token 只经路由挑少数几个算(稀疏激活):参数量爆大、每 token 算量不涨。但 E 个专家权重加起来极大、一张卡放不下。专家并行 EP 把专家分片到 G 卡(每卡 E/G 个)省显存,代价:token 挑中的专家可能在别的卡,得先 all-to-all 派发到专家所在卡、算完再收回;路由还可能不均(热专家被很多 token 挑中)→那张卡过载,要配负载均衡(限容量/辅助损失)。所以现代 MoE 服务把 DP Attention(零通信)+ EP(专家分片、all-to-all)配在一起:各切各的。本实验 8 token、8 专家(top-1,专家3偏热)、G 卡,看路由→派发→每卡负载。',
  bounds: [
    '8 token、8 专家(top-1 路由,专家 3 被挑 3 次偏热),G 卡(2/4)',
    '每卡 E/G 个专家;token 按选中专家 all-to-all 派到对应卡(可核)',
    '每卡负载=落在它上的 token 数;热专家那卡过载、别的闲',
    '简化 top-1;真实 top-k + 容量因子 + 辅助均衡损失',
  ],
  tabs: [{ id: 'route', label: '路由+派发' }],
  Stage: EPStage,
  tone: s => (s.phase === 'done' ? (s.maxLoad > s.minLoad ? { key: 'bad', label: `负载 ${s.maxLoad}/${s.minLoad}` } : { key: 'good', label: '均衡' }) : s.phase === 'dispatch' ? { key: 'idle', label: 'all-to-all' } : { key: 'idle', label: s.phase }),
  metric: s => (s.phase === 'setup' || s.phase === 'route' ? 0.3 : s.maxLoad ? s.minLoad / s.maxLoad : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : ({ setup: '设', route: '路由', dispatch: '派发', compute: '算' } as Record<string, string>)[s.phase] ?? '0'),
  whyInRail: true,
  readouts: s => [
    { label: '每卡专家', value: `${s.expertsPerGpu}` },
    { label: '派发', value: s.phase === 'setup' || s.phase === 'route' ? '待' : 'all-to-all' },
    { label: '最忙卡', value: s.maxLoad ? `${s.maxLoad} token` : '—', tone: s.maxLoad > s.minLoad ? 'bad' : undefined },
    { label: '最闲卡', value: s.maxLoad ? `${s.minLoad} token` : '—' },
  ],
}

const dpattn: Experiment<DPAttnState> = {
  id: 'dpattn',
  group: '大模型推理',
  title: 'DP Attention',
  subtitle: '多卡服务时，注意力按请求切、零通信',
  kernel: dpattnKernel,
  defaultDoc: { kind: 'dpattn', params: { gpus: 4 }, entities: [], streams: [] },
  params: [
    { key: 'gpus', label: '卡数', kind: 'number', options: [2, 4] },
  ],
  paramsNote: '多卡服务一批请求,注意力怎么分到 G 张卡?两条路:张量并行 TP 把 H 个头切开(每卡 H/G 个头)、算全部请求,算完得每层 all-reduce 拼头——每层通信,好处是权重也切成 1/G。数据并行 DP Attention 把请求切开(每卡 B/G 个请求)、算全部头,每卡自己那几个请求从头算到尾——注意力零通信,代价是权重整套复制。权衡:TP 省显存但每层通信、DP 零通信但复制权重。注意力权重其实很小、复制得起;而 MoE 专家权重巨大才真需要切。所以现代 MoE 服务(如 DeepSeek)常用 DP Attention + EP:便宜的注意力用 DP 避开 all-reduce、昂贵的专家用 EP 分片。调 gpus 看分工。',
  bounds: [
    'B=8 请求、H=8 头,G 张卡(2/4)',
    'TP:每卡 H/G 个头×全部请求,每层 all-reduce B·d;权重 1/G',
    'DP:每卡全部头×B/G 个请求,注意力通信 0;权重整套复制',
    '只算注意力这段;MoE 里配 EP 分专家(见后续)',
  ],
  tabs: [{ id: 'split', label: 'TP vs DP' }],
  Stage: DPAttnStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: 'DP 零通信' } : s.phase === 'dp' ? { key: 'good', label: '零通信' } : s.phase === 'tp' ? { key: 'bad', label: '每层 all-reduce' } : { key: 'idle', label: `${s.gpus} 卡` }),
  metric: s => (s.phase === 'done' || s.phase === 'dp' ? 1 : s.phase === 'tp' ? 0.3 : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : ({ setup: '设', tp: 'TP', dp: 'DP' } as Record<string, string>)[s.phase] ?? '0'),
  whyInRail: true,
  readouts: s => [
    { label: 'TP 每卡', value: `${s.headsPerGpu} 头 × 全部请求` },
    { label: 'TP 通信', value: `${s.tpComm}/token/层`, tone: 'bad' },
    { label: 'DP 每卡', value: `全部头 × ${s.reqPerGpu} 请求` },
    { label: 'DP 通信', value: `0（零）`, tone: 'good' },
  ],
}

const flashdecode: Experiment<FlashDecodeState> = {
  id: 'flashdecode',
  group: '大模型推理',
  title: 'Flash Decode',
  subtitle: '解码时切开长 KV 并行，压低时延',
  kernel: flashdecodeKernel,
  defaultDoc: { kind: 'flashdecode', params: { chunks: 4 }, entities: [], streams: [] },
  params: [
    { key: 'chunks', label: 'KV 分块', kind: 'number', options: [2, 4, 8] },
  ],
  paramsNote: 'FlashAttention 在 prefill 按 query 切块并行(几百上千 query 一起算、GPU 吃得饱)。但 decode 每步只有 1 个 query、却要对一长串 KV 做注意力——只切 query 就 1 份活、GPU 闲着。Flash Decode 换切法:把 KV/序列维切 C 块并行各算局部注意力(局部 mᶜ/lᶜ/oᶜ),再用 online softmax 无损合并成全局结果。时延从顺序扫 N 降到并行 N/C。合并公式和 FlashAttention 同源(拿全局最大 M 重缩放各块 exp),数学上和一次性 softmax 完全相等、不是近似。调「KV 分块」看时延随 C 降、答案不变。',
  bounds: [
    '1 个 query 对 N=8 个 key,按 KV 切 C 块(2/4/8)',
    '每块算局部 mᶜ/lᶜ/oᶜ,再 online softmax 合并(可核)',
    '合并结果 == 一次性 softmax·V(无损);时延 ~N/C',
    'prefill 切 query、decode 切 KV;只演示 1 个 query 的单步解码',
  ],
  tabs: [{ id: 'split', label: 'KV 分块+合并' }],
  Stage: FlashDecodeStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `时延 ~${s.parLatency}` } : s.phase === 'combine' ? { key: 'good', label: '合并=精确' } : { key: 'idle', label: `块 ${s.curChunk + 1}/${s.chunks}` }),
  metric: s => (s.seqLatency ? Math.max(0, Math.min(1, 1 - s.parLatency / s.seqLatency)) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.phase === 'combine' ? '合' : `块${s.curChunk + 1}`),
  whyInRail: true,
  readouts: s => [
    { label: 'KV 分块 C', value: `${s.chunks}` },
    { label: '时延', value: `~${s.seqLatency} → ~${s.parLatency}`, tone: 'good' },
    { label: '输出', value: s.phase === 'chunk' ? '算局部中' : `${s.output}` },
    { label: '对照 softmax', value: `${s.fullOutput}`, tone: s.phase !== 'chunk' && Math.abs(s.output - s.fullOutput) < 1e-3 ? 'good' : undefined },
  ],
}

const engram: Experiment<EngramState> = {
  id: 'engram',
  group: '大模型推理',
  title: 'Engram · n-gram 记忆',
  subtitle: '用一张便宜的查表增强 Transformer',
  kernel: engramKernel,
  defaultDoc: { kind: 'engram', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '注意力要"回头看"靠 QKᵀ 全局打分,又贵(O(N²))又受窗口限制。Engram 这类 n-gram 记忆模块给条便宜旁路:把出现过的 n-gram 统计存成哈希表(前 n−1 个 token→下一个的计数),推理时用当前 (n−1)-gram O(1) 查表,拿到"上次/历次它后面跟了什么",融合进模型输出。查表 O(1) 不随上下文变、记忆不受注意力窗口限制(相关信息在几万 token 前也查得到)、把"精确复制重复模式"从昂贵注意力卸载到便宜查表。它和归纳头目标像(都回头找"上次它之后是什么")但机制相反:归纳头是学出来的软注意力(贵)、Engram 是显式非参数化查表(便宜),互补。本实验 A B C D×… trigram 建表,查当前 2-gram→预测。',
  bounds: [
    '序列 A B C D A B C D A B C,trigram(前2→下一个)',
    '扫序列建表:每个前缀记下一个 token 及计数(可核)',
    '查询 2-gram「B C」命中(历史 2 次)→ 预测 D',
    '简化成硬查表示意;真实里 n-gram 概率与模型 logits 加权融合',
  ],
  tabs: [{ id: 'lookup', label: '查表补全' }],
  Stage: EngramStage,
  tone: s => (s.stage === 'done' ? { key: 'good', label: `→ ${s.prediction}` } : s.stage === 'predict' ? { key: 'good', label: `查到 ${s.prediction}` } : { key: 'idle', label: s.stage }),
  metric: s => (s.stage === 'done' || s.stage === 'predict' ? 1 : s.stage === 'lookup' ? 0.7 : s.stage === 'build' ? 0.4 : 0.1),
  tickLabel: s => (s.stage === 'done' ? '毕' : ({ id: '认', build: '建表', lookup: '查', predict: 'copy' } as Record<string, string>)[s.stage] ?? `${s.step}`),
  whyInRail: true,
  readouts: s => [
    { label: '记忆粒度', value: `${s.ngram}-gram` },
    { label: '表项数', value: `${s.table.length}` },
    { label: '查询前缀', value: s.queryKey ? `「${s.queryKey}」` : '—' },
    { label: '预测', value: s.prediction || '?', tone: s.prediction ? 'good' : undefined },
  ],
}

const linattn: Experiment<LinAttnState> = {
  id: 'linattn',
  group: '大模型推理',
  title: '线性注意力',
  subtitle: '把 O(N²) 压成 O(N)、KV 缓存压成常数',
  kernel: linattnKernel,
  defaultDoc: { kind: 'linattn', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '标准注意力 softmax(QKᵀ)V 要算 N×N 矩阵、算量 O(N²);自回归还要存每个 token 的 K/V(KV缓存 O(N)、随上下文线性增长)。线性注意力换核函数 φ,把它近似成 φ(Q)·(φ(K)ᵀV),利用矩阵乘法结合律先算括号里的 φ(K)ᵀV(一个 d×d 状态、概括全部历史),再让 φ(Q) 乘它:算量 O(N·d²) 随 N 线性、显存 O(d²) 固定——告别膨胀的 KV 缓存,解码变 RNN 式递推、O(1)/步、常数显存。代价:φ 近似 softmax、拿精度换算量/显存。交叉点 N=d:短序列 softmax 省、长序列线性完胜(N=32768 算量差 512×、显存差 1000×)。本实验 d=64,N 从 64 拉到 32768。',
  bounds: [
    '头维度 d=64,序列 N 取 64→128→512→2048→8192→32768',
    'softmax 算量 2N²d、显存(KV) 2Nd;线性 算量 2Nd²、状态 d²+d(可核)',
    '交叉点 N=d=64;N 越大线性省得越多(算量差=N/d)',
    '只算算量/显存量级;φ 近似 softmax 的精度损失不建模',
  ],
  tabs: [{ id: 'scale', label: '算量+显存' }],
  Stage: LinAttnStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `省 ${s.ratio}×` } : s.n > 0 ? (s.n > s.d ? { key: 'good', label: `${s.ratio}×` } : { key: 'idle', label: `N=${s.n}` }) : { key: 'idle', label: '' }),
  metric: s => (s.n ? Math.max(0, Math.min(1, Math.log2(Math.max(1, s.ratio)) / 9)) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.n ? `${s.n >= 1024 ? (s.n / 1024) + 'k' : s.n}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '序列 N', value: s.n ? `${s.n}` : '—' },
    { label: '算量差', value: s.n ? `${s.ratio}×` : '—', tone: s.n > s.d ? 'good' : undefined },
    { label: 'KV 缓存', value: s.n ? `${s.kvMem >= 1e6 ? (s.kvMem / 1e6).toFixed(1) + 'M' : (s.kvMem / 1e3).toFixed(0) + 'K'}` : '—' },
    { label: '线性状态', value: `${(s.stateMem / 1e3).toFixed(1)}K 恒定`, tone: 'good' },
  ],
}

const condnum: Experiment<CondNumState> = {
  id: 'condnum',
  group: '机器学习基础',
  title: '条件数',
  subtitle: '为什么"病态"的问题又慢又难算',
  kernel: condnumKernel,
  defaultDoc: { kind: 'condnum', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '条件数 κ=最大曲率/最小曲率(二次型=最大特征值/最小特征值),衡量问题多"病态"。κ=1(正圆碗)梯度直指谷底、一步到位;κ 大(细长椭圆)梯度几乎垂直于通往谷底的方向、只能之字形慢挪。梯度下降每步误差最多缩 (κ−1)/(κ+1)——κ 越大越接近 1、越慢。所以要预处理/归一化/Adam 把 κ 拉回接近 1;数值上 κ 大还意味着解对噪声极敏感(病态方程组)。这是「梯度下降」那条的深层解释。本实验 L=x²+κy²、从(1,1)出发,κ 取 1→5→20→50:收敛步数 1→12→47→116、轨迹从直线一步变成剧烈之字形。',
  bounds: [
    '损失 L=x²+κ·y²、起点 (1,1)、稳定学习率 1/(1+κ)',
    'κ 取 1→5→20→50;每步 θ←θ−lr·∇L',
    '收敛步数 1→12→47→116、收敛率 (κ−1)/(κ+1)(可核)',
    '二次型示意;真实损失面局部也近似二次',
  ],
  tabs: [{ id: 'zigzag', label: '椭圆+轨迹' }],
  Stage: CondNumStage,
  tone: s => (s.phase === 'done' ? { key: 'bad', label: `${s.steps} 步` } : s.kappa === 1 ? { key: 'good', label: '一步到位' } : s.kappa > 0 ? { key: s.kappa >= 20 ? 'bad' : 'idle', label: `κ=${s.kappa}` } : { key: 'idle', label: '' }),
  metric: s => (s.kappa > 0 ? Math.max(0, Math.min(1, 1 - s.rate)) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.kappa > 0 ? `κ${s.kappa}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '条件数 κ', value: s.kappa > 0 ? `${s.kappa}` : '—' },
    { label: '收敛步数', value: s.kappa > 0 ? `${s.steps}` : '—', tone: s.kappa >= 20 ? 'bad' : s.kappa === 1 ? 'good' : undefined },
    { label: '每步误差缩', value: s.kappa > 0 ? `${s.rate}` : '—' },
    { label: '碗形', value: s.kappa === 1 ? '正圆' : s.kappa > 0 ? `扁 ${s.kappa}:1` : '—' },
  ],
}

const maxent: Experiment<MaxEntState> = {
  id: 'maxent',
  group: '概率统计原理',
  title: '最大熵原理',
  subtitle: 'softmax/玻尔兹曼分布凭什么"天生合理"',
  kernel: maxentKernel,
  defaultDoc: { kind: 'maxent', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '最大熵原理:在所有满足已知约束的分布里,选熵最大的那个——它对没被约束的部分不做多余假设,最诚实/最不武断。可证:给定若干"期望值"约束,最大熵解一定是指数族 p_i∝e^{Σλ·特征};给"期望能量"约束时正是 softmax/玻尔兹曼分布 p_i∝e^{λE_i}。这就是 softmax、逻辑回归、玻尔兹曼机天生合理的根:不是随手一挑,是约束下最大熵的唯一答案。本实验一颗 6 面骰:无约束时最大熵=均匀(log2 6=2.585);把期望点数 μ 从 3.5 抬到 5.5,最大熵解 p_i∝e^{λi}(二分求 λ)往 6 偏、熵 2.585→1.375,但每步都是该约束下熵最高(对比同均值两点分布熵低很多)。',
  bounds: [
    '6 面骰;约束=期望点数 μ 取 3.5→4→4.5→5→5.5',
    '最大熵解 p_i∝e^{λi},二分 λ 使 Σi·p_i=μ(可核)',
    '无约束→均匀(熵 log2 6);μ 越大分布越尖、熵越低',
    '每步熵 > 同均值两点分布(体现"最大");未做多约束一般情形',
  ],
  tabs: [{ id: 'dist', label: '最大熵分布' }],
  Stage: MaxEntStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `熵 ${s.ent}` } : s.probs.some(p => p > 0) ? { key: 'idle', label: `μ=${s.mu}` } : { key: 'idle', label: '' }),
  metric: s => (s.maxEnt ? Math.max(0, Math.min(1, s.ent / s.maxEnt)) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.probs.some(p => p > 0) ? `μ${s.mu}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '约束 μ', value: `${s.mu}` },
    { label: '最大熵', value: `${s.ent} bit`, tone: 'good' },
    { label: '熵上限', value: `${s.maxEnt} bit` },
    { label: '同均值两点分布', value: s.mu === 3.5 ? '—' : `${s.naiveEnt} bit（更低）` },
  ],
}

const jl: Experiment<JLState> = {
  id: 'jl',
  group: '概率统计原理',
  title: 'JL 引理·随机投影',
  subtitle: '高维压到低维还几乎不丢距离',
  kernel: jlKernel,
  defaultDoc: { kind: 'jl', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: 'Johnson–Lindenstrauss 引理:N 个高维点,只要投影到 k~O(log N/ε²) 维(一个随机线性投影),就能把所有两两距离保持在 (1±ε) 倍以内——与原始维度 D 无关,只跟点数 N 和精度 ε 有关。几百上千维可压到几十维、几何结构几乎原样保留。随机投影降维、近似最近邻(ANN)、特征哈希、"嵌入维度不用很大也够用"都靠它;也和 LoRA/低秩、高维近正交一家(高维很空、可压)。本实验 6 个 256 维随机点,用高斯随机矩阵(每列÷√K 保范数)投到 K=16→32→64→128 维,看 15 对点的距离比越来越贴 1、最大偏差 ~31%→~11%。',
  bounds: [
    '6 个 256 维随机点,投到 K=16→32→64→128 维',
    '高斯随机投影矩阵(÷√K 保范数),确定性可复现',
    '距离比(低维/高维)平均≈1、最大偏差随 K 降(可核)',
    'K 越大越准;所需 K 与原维度 D 无关(JL 核心)',
  ],
  tabs: [{ id: 'ratio', label: '距离比' }],
  Stage: JLStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `偏差 ${(s.maxDev * 100).toFixed(0)}%` } : s.k > 0 ? { key: s.maxDev < 0.15 ? 'good' : 'idle', label: `K=${s.k}` } : { key: 'idle', label: '' }),
  metric: s => (s.k > 0 ? Math.max(0, Math.min(1, 1 - s.maxDev / 0.4)) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.k > 0 ? `K${s.k}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '维度', value: s.k > 0 ? `${s.d}→${s.k}` : `${s.d}→?` },
    { label: '平均距离比', value: s.k > 0 ? `${s.avgRatio}` : '—' },
    { label: '最大偏差', value: s.k > 0 ? `${(s.maxDev * 100).toFixed(0)}%` : '—', tone: s.maxDev > 0 && s.maxDev < 0.15 ? 'good' : undefined },
    { label: '点对数', value: `${s.ratios.length || (s.n * (s.n - 1) / 2)}` },
  ],
}

const greedy: Experiment<GreedyState> = {
  id: 'greedy',
  group: '数据结构',
  title: '贪心算法',
  subtitle: '"每步拿最好"什么时候能=全局最优',
  kernel: greedyKernel,
  defaultDoc: { kind: 'greedy', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '贪心:每步都做当下最好的选择、不回头。快且简单,但不总对——只有问题具备"贪心选择性质"(局部最优拼成全局最优)时才保证最优。哈夫曼、Dijkstra、最小生成树都吃这条所以对;很多问题不具备,贪心就次优。经典反例找零:币值{1,3,4}凑 6,贪心每步拿最大:4→剩2→1→1,共 3 枚;可最优是 3+3=2 枚!贪心被"先拿 4"的局部最优带偏、回不到 3+3。要保证最优得用动态规划枚举子问题。对比 Dijkstra/Huffman(贪心正确)就懂:贪心对不对取决于问题结构,不取决于跑得快。',
  bounds: [
    '币值 {4,3,1}、凑 6;贪心每步取 ≤剩余 的最大币',
    'DP 求全局最少枚数(可核);贪心枚数 ≥ 最优',
    '贪心 4+1+1=3 枚,最优 3+3=2 枚 → 贪心失败',
    '只演示这一个反例;Dijkstra/Huffman 等贪心正确的另有其例',
  ],
  tabs: [{ id: 'coin', label: '找零' }],
  Stage: GreedyStage,
  tone: s => (s.phase === 'done' ? (s.greedyCount > s.optimal ? { key: 'bad', label: `${s.greedyCount}枚>最优${s.optimal}` } : { key: 'good', label: '最优' }) : { key: 'idle', label: s.picked.length ? `${s.greedyCount}枚` : '' }),
  metric: s => (s.phase === 'done' ? s.optimal / Math.max(1, s.greedyCount) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.pick ? `+${s.pick}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '目标', value: `${s.target}` },
    { label: '贪心已拿', value: s.picked.length ? `[${s.picked.join('+')}]` : '—' },
    { label: '贪心枚数', value: `${s.greedyCount}`, tone: s.phase === 'done' && s.greedyCount > s.optimal ? 'bad' : undefined },
    { label: '最优(DP)', value: `${s.optimal}`, tone: 'good' },
  ],
}

const dotsim: Experiment<DotSimState> = {
  id: 'dotsim',
  group: 'Transformer 原理',
  title: '内积=相似度',
  subtitle: '注意力凭什么用 Q·K 打分',
  kernel: dotsimKernel,
  defaultDoc: { kind: 'dotsim', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '内积 a·b=|a||b|cosθ,同时编码长度与夹角。长度固定时,内积纯粹量"方向多一致":同向(θ=0)最大、正交(90°)为 0、反向(180°)最负。归一化掉长度(÷|a||b|)就是余弦相似度 cosθ∈[−1,1]。这就是注意力用 Q·K 打分的根据:query 与 key 越方向一致(相关),内积越大、softmax 后权重越高;无关方向内积≈0(接「高维近正交」)。检索、推荐、词向量类比全靠它。本实验 |a|=3、|b|=2,夹角 θ 从 0°转到 180°:内积 6→4.24→0→−4.24→−6,余弦 1→0→−1。',
  bounds: [
    '|a|=3、|b|=2,a 固定指 +x,b 夹角 θ 取 0/45/90/135/180°',
    'a·b=|a||b|cosθ、cosθ=a·b/(|a||b|)、内积=|a|×b 在 a 上投影(可核)',
    '同向内积 6、正交 0、反向 −6;余弦 1→0→−1',
    '示意 2D;真实 Q、K 是高维,但同一几何',
  ],
  tabs: [{ id: 'geo', label: '几何' }],
  Stage: DotSimStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '方向=相似' } : s.angleDeg < 0 ? { key: 'idle', label: '' } : s.angleDeg === 90 ? { key: 'idle', label: '正交=0' } : s.dot > 0 ? { key: 'good', label: `+${s.dot}` } : { key: 'bad', label: `${s.dot}` }),
  metric: s => (s.angleDeg >= 0 ? (s.cosSim + 1) / 2 : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.angleDeg >= 0 ? `${s.angleDeg}°` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '夹角 θ', value: s.angleDeg >= 0 ? `${s.angleDeg}°` : '—' },
    { label: '内积 a·b', value: s.angleDeg >= 0 ? `${s.dot}` : '—', tone: s.angleDeg === 90 ? undefined : s.dot > 0 ? 'good' : 'bad' },
    { label: '余弦相似度', value: s.angleDeg >= 0 ? `${s.cosSim}` : '—' },
    { label: 'b 在 a 上投影', value: s.angleDeg >= 0 ? `${s.proj}` : '—' },
  ],
}

const lowrank: Experiment<LowRankState> = {
  id: 'lowrank',
  group: '机器学习基础',
  title: '低秩近似·LoRA',
  subtitle: '为什么"低秩"能省参数还不太掉精度',
  kernel: lowrankKernel,
  defaultDoc: { kind: 'lowrank', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '任何矩阵能拆成一串奇异分量叠加:A=Σσ_i·u_i·v_iᵀ，σ 从大到小。信息集中在前几个大 σ 上,只留前 k 个(低秩近似 A_k)就用 2·d·k 个数近似原来的 d² 个,而 Eckart–Young 保证 A_k 是所有秩-k 矩阵里最接近 A 的,误差(Frobenius)=√(Σ_{i>k}σ_i²)=被丢掉的奇异值。这就是 LoRA:微调不改整块 d×d 权重,而是加低秩更新 ΔW=B·A(秩 r≪d),只训 2·d·r 参数——省显存/算力、能存多套技能包。图像压缩、PCA、推荐降维底子也是它。本实验 8×8 矩阵由 4 个奇异分量搭成(σ=10,5,2,1),秩 1→4 看误差 5.48→0、能量 88%→100%。',
  bounds: [
    '8×8 矩阵 = 4 个奇异分量叠加(σ=[10,5,2,1])',
    '秩 k=1→4,重建 A_k=Σ_{i≤k}σ_i u_i v_iᵀ(可核)',
    '误差=√(丢掉的σ²)、保留能量=√(留下σ²)/‖A‖;参数 2·d·k vs d²',
    '奇异分量用确定性正交向量构造;未跑真实 SVD 分解算法',
  ],
  tabs: [{ id: 'recon', label: '低秩重建' }],
  Stage: LowRankStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '100% 还原' } : s.rank > 0 ? { key: s.energyPct > 95 ? 'good' : 'idle', label: `${s.energyPct}%` } : { key: 'idle', label: '' }),
  metric: s => (s.rank > 0 ? s.energyPct / 100 : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.rank > 0 ? `k${s.rank}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '保留秩 k', value: s.rank > 0 ? `${s.rank}` : '0' },
    { label: '保留能量', value: s.rank > 0 ? `${s.energyPct}%` : '—', tone: s.energyPct > 95 ? 'good' : undefined },
    { label: '重建误差', value: s.rank > 0 ? `${s.error}` : '—' },
    { label: '参数', value: `${s.lowrankParams}/${s.fullParams}` },
  ],
}

const editdist: Experiment<EditDistState> = {
  id: 'editdist',
  group: '数据结构',
  title: '动态规划·编辑距离',
  subtitle: '记住子问题，把指数搜索压成填表',
  kernel: editdistKernel,
  defaultDoc: { kind: 'editdist', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '动态规划(DP)=最优子结构+重叠子问题+记住每个子问题的答案(填表),避免重复计算。编辑距离:把 a 改成 b 最少几步(插/删/替)?朴素递归会把同一子问题算指数级多次;DP 用表 dp[i][j]=a 前 i 个→b 前 j 个的最少步,每格只看三个邻居 O(1) 推出:a[i]==b[j] 时 dp=dp[i−1][j−1];否则 dp=1+min(dp[i−1][j−1]替换, dp[i−1][j]删除, dp[i][j−1]插入)。O(n·m) 填完,右下角就是答案。序列比对、最短路(Bellman-Ford)、背包、DNA/语音对齐底子都是它。本实验 a=horse→b=ros,逐格填,右下角=3。',
  bounds: [
    'a="horse"→b="ros"，表 (|a|+1)×(|b|+1)',
    '每格=match?左上:1+min(左上/上/左)(可核)',
    '逐格 O(1) 推出、O(n·m) 填完,右下角=编辑距离 3',
    '只演示编辑距离这一种 DP;未回溯具体操作序列',
  ],
  tabs: [{ id: 'table', label: 'DP 表' }],
  Stage: EditDistStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `距离 ${s.val}` } : s.ci > 0 ? { key: 'idle', label: `(${s.ci},${s.cj})` } : { key: 'idle', label: '' }),
  metric: s => { const tot = s.a.length * s.b.length; return tot ? Math.max(0, Math.min(1, s.step / tot)) : 0 },
  tickLabel: s => (s.phase === 'done' ? '毕' : s.ci > 0 ? `${s.ci},${s.cj}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '当前格', value: s.ci > 0 ? `(${s.ci},${s.cj})` : '—' },
    { label: '比较', value: s.ci > 0 ? `${s.a[s.ci - 1]} vs ${s.b[s.cj - 1]} ${s.match ? '同' : '异'}` : '—' },
    { label: '本格值', value: s.ci > 0 ? `${s.val}` : '—' },
    { label: '编辑距离', value: s.phase === 'done' ? `${s.val}` : '填表中', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const induction: Experiment<InductionState> = {
  id: 'induction',
  group: 'Transformer 原理',
  title: '归纳头',
  subtitle: '上下文学习：照着上文的样式继续',
  kernel: inductionKernel,
  defaultDoc: { kind: 'induction', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '归纳头(induction head)是 2022 年在 Transformer 里发现的一种具体电路,被认为是上下文学习的核心机制之一。它干的事:"上次见到当前这个 token 时,它后面跟了什么?把那个复制过来。"靠两个注意力头接力:一个"前一 token 头"给每个位置标注"我前面是谁",一个"归纳头"用当前 token 去匹配——凡是"前一个 token=当前 token"的位置就把注意力放上去,于是落在上次那个 token 之后,再把那里的 token 复制成预测。它没在训练里见过这个具体序列,纯靠上下文的模式现学现用。本实验:A B C A B C A → 当前 A,回头找"前面是 A"的 pos1/pos4(后面都是 B)→复制出 B。',
  bounds: [
    '序列 A B C A B C A,问下一个 token',
    '归纳头:位置 j 得分高 ⟺ seq[j−1]==当前 token(前一 token 匹配)',
    '注意力落 pos1/pos4(上次 A 之后)、都是 B → 复制预测 B(可核)',
    '简化成硬匹配示意;真实里由两个注意力头学出来',
  ],
  tabs: [{ id: 'copy', label: '模式补全' }],
  Stage: InductionStage,
  tone: s => (s.stage === 'done' ? { key: 'good', label: `→ ${s.prediction}` } : s.stage === 'copy' ? { key: 'good', label: `复制 ${s.prediction}` } : { key: 'idle', label: s.stage }),
  metric: s => (s.stage === 'done' || s.stage === 'copy' ? 1 : s.stage === 'attend' ? 0.7 : s.stage === 'scan' ? 0.4 : 0.1),
  tickLabel: s => (s.stage === 'done' ? '毕' : ({ id: '认', scan: '扫', attend: '注', copy: 'copy' } as Record<string, string>)[s.stage] ?? `${s.step}`),
  whyInRail: true,
  readouts: s => [
    { label: '当前 token', value: s.cur },
    { label: '注意力落点', value: s.matches.length ? `pos ${s.matches.join(', ')}` : '—' },
    { label: '预测', value: s.prediction || '?', tone: s.prediction ? 'good' : undefined },
    { label: '阶段', value: ({ id: '认当前', scan: '扫匹配', attend: '注意力', copy: '复制', done: '完成' } as Record<string, string>)[s.stage] },
  ],
}

const residual: Experiment<ResidualState> = {
  id: 'residual',
  group: '机器学习基础',
  title: '残差=梯度高速路',
  subtitle: '为什么深网络能训得动',
  kernel: residualKernel,
  defaultDoc: { kind: 'residual', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '反向传播里梯度=各层局部导数的连乘(链式法则)。没残差:每层导数常<1(如0.8)，N 层连乘→0.8^N 指数衰减到≈0——梯度消失、深层学不动(2015 年前深网难训的核心)。残差 y=x+f(x):这层导数=1+f′,那个 +1 是"恒等高速路"，让梯度即使 f′很小也能原样穿过,连乘不再塌向 0，几十上百层也训得动。ResNet、Transformer 每个子层(注意力/FFN)都裹残差就是这道理。本实验 N=16 层,梯度从输出(=1)倒传:没残差每层×0.8、有残差每层×(1+小扰动)≈1;你会看到没残差塌到~0.03、有残差稳在~1。',
  bounds: [
    'N=16 层,梯度从输出(=1)往输入倒传',
    '没残差每层×0.8(连乘);有残差每层×(1+f′)≈1(可核)',
    '没残差塌到≈0.8^16≈0.03(梯度消失);有残差守在≈1',
    '残差因子用确定性小扰动示意;未建模具体 f 与激活',
  ],
  tabs: [{ id: 'grad', label: '梯度衰减' }],
  Stage: ResidualStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '残差守住' } : s.histPlain.length > 1 && s.gradPlain < 0.1 ? { key: 'bad', label: '没残差消失' } : { key: 'idle', label: s.layer <= s.depth ? `第${s.layer}层` : '' }),
  metric: s => (s.histPlain.length > 1 ? Math.max(0, Math.min(1, s.gradRes / 1.2)) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.layer <= s.depth ? `${s.layer}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '倒传到第', value: s.layer <= s.depth ? `${s.layer} 层` : '—' },
    { label: '没残差 梯度', value: s.histPlain.length > 1 ? `${s.gradPlain}` : '1', tone: s.gradPlain < 0.1 ? 'bad' : undefined },
    { label: '有残差 梯度', value: s.histRes.length > 1 ? `${s.gradRes}` : '1', tone: 'good' },
    { label: '这层残差因子', value: s.histRes.length > 1 ? `×${s.resFactor}` : '—' },
  ],
}

const graddesc: Experiment<GradDescState> = {
  id: 'graddesc',
  group: '机器学习基础',
  title: '梯度下降',
  subtitle: '模型到底怎么"学"：顺负梯度走到谷底',
  kernel: graddescKernel,
  defaultDoc: { kind: 'graddesc', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '想最小化损失 L(θ)，就沿负梯度更新 θ←θ−lr·∇L：梯度指向上升最快方向，取负号朝下降最快走，学习率 lr 控步长。反复走、损失单调下降逼近最低点——这就是所有神经网络"训练"的核心。本实验用碗形损失 L=x²+5y²(y 方向更陡=病态一点)，从 (4,4)、lr=0.14 出发,梯度 ∇L=(2x,10y)。损失 96→21→6→2.6…单调降;y 方向更陡、步子迈过头来回震荡(4→−1.6→0.64…)——学习率与曲率(条件数)的博弈,太大发散、太小太慢。',
  bounds: [
    '损失 L=x²+5y²(碗形，y 方向曲率更大)，起点 (4,4)、lr=0.14',
    '每步 θ←θ−lr·∇L，∇L=(2x,10y)(可核)；损失单调下降',
    '损失 96→…→0.08 逼近谷底 (0,0)；y 正负来回震荡',
    '定步长(无动量/Adam)；只演示一条轨迹',
  ],
  tabs: [{ id: 'descent', label: '等高线+轨迹' }],
  Stage: GradDescStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '到谷底' } : s.step >= 0 ? { key: 'idle', label: `L=${s.loss.toFixed(1)}` } : { key: 'idle', label: '' }),
  metric: s => (s.step >= 0 ? Math.max(0, Math.min(1, 1 - s.loss / 96)) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.step >= 0 ? `${s.step}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '迭代步', value: s.step >= 0 ? `${s.step}` : '0' },
    { label: '损失 L', value: s.step >= 0 ? `${s.loss}` : '96', tone: s.phase === 'done' ? 'good' : undefined },
    { label: '位置', value: s.step >= 0 ? `(${s.x}, ${s.y})` : '(4, 4)' },
    { label: '梯度 ∇L', value: s.step >= 0 ? `(${s.gx}, ${s.gy})` : '—' },
  ],
}

const bloom: Experiment<BloomState> = {
  id: 'bloom',
  group: '数据结构',
  title: '布隆过滤器',
  subtitle: '一点点空间，换"绝不漏报、极少误报"',
  kernel: bloomKernel,
  defaultDoc: { kind: 'bloom', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: 'm 位 bit 数组 + k 个哈希。插入:算 k 个哈希、把对应 k 位全置 1。查询:看这 k 位——有一位是 0 就一定不在(插过必会置 1，所以绝不漏报);全是 1 则"可能在"——也可能是别的元素恰好点亮这几位(假阳性)。所以布隆过滤器绝不漏报、但可能误报，用极小空间换极快判断。假阳性率≈(1−e^(−kn/m))^k，位越多/元素越少越低。缓存前置、爬虫去重、数据库防穿透都靠它。本实验 m=24、k=3，插 cat/dog/sun 再查一串，owl 会因撞上 dog 的位造成一次真实假阳性。',
  bounds: [
    'm=24 位、k=3 个哈希；插入 cat/dog/sun',
    '插入=点亮 k 位；查询=k 位是否全 1(均可核)',
    '有位是 0→一定不在(绝不漏报)；全 1→可能在(可能假阳性)',
    'owl 撞 dog 的位=一次真实假阳性；未做删除(标准布隆不支持删)',
  ],
  tabs: [{ id: 'bits', label: 'bit 数组' }],
  Stage: BloomStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '绝不漏报' }
    : s.falsePositive ? { key: 'bad', label: '假阳性!' }
    : s.op === 'query' ? { key: s.verdict === '可能在' ? 'good' : 'idle', label: s.verdict } : { key: 'idle', label: s.op === 'add' ? `+${s.word}` : '' }),
  metric: s => (s.bits.length ? s.bits.reduce((a, b) => a + b, 0) / s.m : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.word || '0'),
  whyInRail: true,
  readouts: s => [
    { label: '操作', value: s.op === 'add' ? `插入 ${s.word}` : s.op === 'query' ? `查询 ${s.word}` : '—' },
    { label: '触碰位', value: s.idx.length ? `[${s.idx.join(', ')}]` : '—' },
    { label: '判断', value: s.verdict || '—', tone: s.falsePositive ? 'bad' : s.verdict === '可能在' ? 'good' : undefined },
    { label: '置 1 位数', value: `${s.bits.reduce((a, b) => a + b, 0)}/${s.m}` },
  ],
}

const bayes: Experiment<BayesState> = {
  id: 'bayes',
  group: '概率统计原理',
  title: '贝叶斯定理',
  subtitle: '一次阳性没那么可怕：信念随证据更新',
  kernel: bayesKernel,
  defaultDoc: { kind: 'bayes', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '贝叶斯定理：后验 ∝ 先验 × 似然。P(病|阳)=P(阳|病)·P(病)/P(阳)，P(阳)=P(阳|病)·P(病)+P(阳|没病)·P(没病)。精髓是把先验(基础率)也算进去——直觉最爱翻车处。本实验:患病率(先验)1%、灵敏度 P(阳|病)=90%、误报 P(阳|没病)=9%。反直觉:单次阳性也只 ~9% 真患病(没病的人基数太大、误报淹没真阳);但把上次后验当这次先验连续更新 → 9%→50%→91%→99%,证据累积逼近确诊。这就是信念随证据更新,也是朴素贝叶斯、卡尔曼滤波、模型"在上下文里修正判断"的底。',
  bounds: [
    '患病率(先验)1%、灵敏度 P(阳|病)=90%、误报 P(阳|没病)=9%',
    '连续 4 次阳性；每步后验=sens·先验/(sens·先验+fpr·(1−先验))(可核)',
    '后验:1%→9.2%→50.2%→91.0%→99.0%(单次阳性只 9%=基础率谬误)',
    '把上次后验当这次先验;简化为多次检测相互独立',
  ],
  tabs: [{ id: 'update', label: '信念更新' }],
  Stage: BayesStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${(s.posterior * 100).toFixed(0)}%` }
    : s.nTests === 1 ? { key: 'bad', label: '才 9%?!' } : s.nTests > 0 ? { key: 'idle', label: `${(s.posterior * 100).toFixed(0)}%` } : { key: 'idle', label: '' }),
  metric: s => (s.nTests ? s.posterior : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.nTests ? `#${s.nTests}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '阳性次数', value: `${s.nTests}` },
    { label: '先验', value: s.nTests ? `${(s.prior * 100).toFixed(s.prior < 0.1 ? 2 : 1)}%` : '1.00%' },
    { label: '后验', value: s.nTests ? `${(s.posterior * 100).toFixed(s.posterior < 0.1 ? 2 : 1)}%` : '—', tone: s.phase === 'done' ? 'good' : s.nTests === 1 ? 'bad' : undefined },
    { label: '灵敏度/误报', value: `${(s.sens * 100).toFixed(0)}% / ${(s.fpr * 100).toFixed(0)}%` },
  ],
}

const xent: Experiment<XentState> = {
  id: 'xent',
  group: '概率统计原理',
  title: '交叉熵·困惑度',
  subtitle: '训练损失和评测指标到底在量什么',
  kernel: xentKernel,
  defaultDoc: { kind: 'xent', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '语言模型每步吐出"下一个词"的概率分布 p。真词只有一个(one-hot)，于是这步交叉熵退化成 −log p(真词)——模型对真相的"惊讶度"(bit，用 log2)。整句平均交叉熵=各词惊讶度的平均，正是语言模型的训练损失。困惑度=2^交叉熵，是"有效分叉数"：模型平均在多少个等概率词之间犹豫。完美预测 p=1→交叉熵0→困惑度1；瞎猜 p=1/V→交叉熵 log2(V)→困惑度 V。真实模型落在 1 与 V 之间，越低越好。所以"降交叉熵损失""降困惑度"是同一件事。本实验逐词预测 "the cat sat on the mat"(V=8)，算惊讶度、累计交叉熵、换算困惑度。',
  bounds: [
    '词表 V=8，目标句 "the cat sat on the mat" 逐词预测',
    '每步给真词概率 p→惊讶度 −log₂p、累计平均交叉熵、困惑度=2^CE',
    '困惑度恒在 [1, V] 之间：完美=1、瞎猜=V(均可核)',
    '模型对真词的概率是给定的示意值；未真跑一个 LM',
  ],
  tabs: [{ id: 'pred', label: '逐词预测' }],
  Stage: XentStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `困惑度 ${s.perplexity}` }
    : s.trueIdx >= 0 ? { key: 'idle', label: `${s.surprise}bit` } : { key: 'idle', label: '' }),
  metric: s => (s.trueIdx >= 0 ? Math.max(0, Math.min(1, 1 - (s.perplexity - 1) / (s.ppUniform - 1))) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.trueWord || '0'),
  whyInRail: true,
  readouts: s => [
    { label: '预测词', value: s.trueIdx >= 0 ? `${s.trueWord}（${(s.pTrue * 100).toFixed(0)}%）` : '—' },
    { label: '惊讶度', value: s.trueIdx >= 0 ? `${s.surprise} bit` : '—' },
    { label: '平均交叉熵', value: s.trueIdx >= 0 ? `${s.ce} bit/词` : '—' },
    { label: '困惑度', value: s.trueIdx >= 0 ? `${s.perplexity}` : '—', tone: s.phase === 'done' ? 'good' : undefined },
    { label: '瞎猜困惑度', value: `${s.ppUniform}` },
  ],
}

const clt: Experiment<CltState> = {
  id: 'clt',
  group: '概率统计原理',
  title: '中心极限定理',
  subtitle: '平的均匀分布，一平均就长成钟形',
  kernel: cltKernel,
  defaultDoc: { kind: 'clt', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '中心极限定理(CLT)：不管原始分布长什么样(只要方差有限)，把 m 个 i.i.d. 样本平均，当 m 增大，这个均值的分布就越来越接近高斯(正态)——而均值 std 按 1/√m 缩(接大数定理)。这就是高斯分布在自然界与深度学习里无处不在的原因：任何"许多小随机因素相加"的量天然趋向高斯(权重初始化、噪声假设、误差项、注意力打分的近似分析)。本实验用最不像高斯的均匀分布 U[0,1](平的)，把 m 取 1→2→4→8→32：每个 m 跑 T=20000 次，把标准化均值 z=(mean−0.5)/(σ/√m) 做直方图、叠标准正态曲线，看它从平顶长成钟形。',
  bounds: [
    '原始分布=均匀 U[0,1](均值0.5、σ=1/√12)，最不像高斯',
    'm 逐步取 1→2→4→8→32；每个 m 跑 T=20000 次独立试验，可复现',
    '样本 std≈σ/√m(∝1/√m)、超额峰度→0(均匀=−1.2，高斯=0)、直方图贴合正态(均可核)',
    '只看均值分布的形状与集中；未建模一般分布的收敛速率(Berry–Esseen)',
  ],
  tabs: [{ id: 'hist', label: '标准化直方图' }],
  Stage: CltStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '长成钟形' }
    : s.m > 0 && s.exKurt > -0.2 ? { key: 'good', label: '近高斯' } : { key: 'idle', label: s.m ? `m=${s.m}` : '' }),
  metric: s => (s.m ? Math.max(0, Math.min(1, 1 + s.exKurt / 1.2)) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.m ? `m${s.m}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '平均样本数 m', value: s.m ? `${s.m}（×${s.trials}）` : '—' },
    { label: '均值 std', value: s.m ? `${s.std}` : '—' },
    { label: '理论 σ/√m', value: s.m ? `${s.theoStd}` : '—' },
    { label: '超额峰度', value: s.m ? `${s.exKurt}` : '—', tone: s.m && s.exKurt > -0.2 ? 'good' : undefined },
  ],
}

const lln: Experiment<LlnState> = {
  id: 'lln',
  group: '概率统计原理',
  title: '大数定理',
  subtitle: '撒点估 π：为什么“多采样就准”',
  kernel: llnKernel,
  defaultDoc: { kind: 'lln', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '大数定理：i.i.d. 样本的均值随样本数 n 增大收敛到期望；而估计误差按 1/√n 缩（标准误∵方差可加：n 个独立项相加、方差涨 n 倍、std 涨 √n，均值的 std 就 ∝ 1/√n）。经典演示——蒙特卡洛估 π：单位正方形里随机撒 n 点，落进 1/4 圆的比例×4≈π。n 从 50 加到 12800：估计越来越贴 3.14159、|误差| 越来越小，而 |误差|×√n 大致恒定——“误差 ∝ 1/√n”。这是采样、蒙特卡洛、dropout、MoE 路由“多次平均就稳”的底。',
  bounds: [
    '确定性伪随机(LCG, seed 固定)撒点，可复现',
    '撒点数 n 逐步取 50→200→800→3200→12800',
    '估计=4·内点/n；|误差| 随 n 大致单调降；|误差|×√n 大致恒定(可核)',
    '展示散点最多抽 400 点；只看收敛与 1/√n，不建模方差估计',
  ],
  tabs: [{ id: 'mc', label: '蒙特卡洛' }],
  Stage: LlnStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '收敛到 π' }
    : s.n > 0 && s.rmsError < 0.05 ? { key: 'good', label: '已贴近' } : { key: 'idle', label: s.n ? `n=${s.n}` : '' }),
  metric: s => (s.n ? Math.max(0, Math.min(1, 1 - s.rmsError / 0.5)) : 0),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.n ? `n${s.n}` : '0'),
  whyInRail: true,
  readouts: s => [
    { label: '撒点数 n', value: s.n ? `${s.n}（×${s.trials}试验）` : '—' },
    { label: '均值估计', value: s.n ? `${s.meanEst}` : '—' },
    { label: 'RMS 误差', value: s.n ? `${s.rmsError}` : '—', tone: s.n && s.rmsError < 0.05 ? 'good' : undefined },
    { label: 'RMS误差×√n', value: s.n ? `${s.rmsErrSqrtN}` : '—' },
  ],
}

const mvcc: Experiment<MvccState> = {
  id: 'mvcc',
  group: '数据库系统',
  title: 'MVCC 快照读',
  subtitle: '写追加版本，读按快照挑版本',
  kernel: mvccKernel,
  defaultDoc: { kind: 'mvcc', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '无可调参数。固定调度演示快照读：T1、T2 同时开始，T2 把 x 改成 200 并提交后，T1 两次读 x 仍读到旧值 100——这就是可重复读。原理详见讲解卡与「边界」。',
  bounds: [
    'T1、T2 开始时各拍一张快照(此刻 = {T0})',
    '写=追加新版本(未提交只有自己可见);读=按快照挑可见版本',
    'T2 提交 x=200 后,已拿快照的 T1 仍读到 100(可重复读)',
    '值可核:版本链、每次读命中的版本、快照集合都在状态里',
  ],
  tabs: [{ id: 'chain', label: '版本链+快照' }],
  Stage: MvccStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '快照读' }
    : s.op === 'commit' ? { key: 'good', label: `T${s.curTx} 提交` }
      : s.op === 'read' ? { key: 'idle', label: `T${s.curTx} 读到 ${s.readValue}` }
        : s.op === 'write' ? { key: 'idle', label: `T${s.curTx} 追加版本` }
          : { key: 'idle', label: s.curTx ? `T${s.curTx} 开始` : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 8)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'read' ? '读' : s.op === 'write' ? '写' : s.op === 'commit' ? '交' : '始'),
  whyInRail: true,
  readouts: s => [
    { label: '本步', value: s.op === 'read' ? `T${s.curTx} 读 x` : s.op === 'write' ? `T${s.curTx} 写 x` : s.op === 'commit' ? `T${s.curTx} 提交` : s.op === 'begin' ? `T${s.curTx} 开始` : '完成' },
    { label: '读到的值', value: s.readValue >= 0 ? `${s.readValue}` : '—', tone: s.readValue >= 0 ? 'good' : undefined },
    { label: 'x 版本数', value: `${s.versions.length}` },
    { label: '已提交版本', value: `${s.versions.filter(v => v.committed).length}` },
  ],
}

const iso: Experiment<IsoState> = {
  id: 'iso',
  group: '数据库系统',
  title: '事务隔离级别',
  subtitle: '切级别，看脏读 / 不可重复读出现或消失',
  kernel: isoKernel,
  defaultDoc: { kind: 'iso', params: { level: '读已提交' }, entities: [], streams: [] },
  params: [{ key: 'level', label: '隔离级别', kind: 'enum', options: ['读未提交', '读已提交', '可重复读', '串行化'] }],
  paramsNote: '改「隔离级别」即刻重跑，看读现象出现/消失：读未提交→脏读+不可重复读；读已提交→只挡脏读；可重复读→两个都挡。级别越高越安全、并发越低。',
  bounds: [
    '固定调度:T1 读 x 三次,中间 T2 改 x=200 并提交',
    '读未提交:100→200(脏读)→200(不可重复读)',
    '读已提交:100→100→200(不可重复读);可重复读:100→100→100',
    '每次读的值与现象都可核对(和隔离级别的读规则一致)',
  ],
  tabs: [{ id: 'level', label: '级别×读现象' }],
  Stage: IsoStage,
  tone: s => (s.phase === 'done'
    ? (s.reads.some(r => r.a === '脏读' || r.a === '不可重复读') ? { key: 'bad', label: '有读现象' } : { key: 'good', label: '干净' })
    : s.anomaly === '脏读' || s.anomaly === '不可重复读' ? { key: 'bad', label: s.anomaly }
      : s.op === 'read' ? { key: 'good', label: `读到 ${s.readValue}` }
        : { key: 'idle', label: s.curTx ? `T${s.curTx} 动作` : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 9)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'read' ? '读' : s.op === 'write' ? '写' : s.op === 'commit' ? '交' : '始'),
  whyInRail: true,
  readouts: s => [
    { label: '隔离级别', value: s.level },
    { label: '本次现象', value: s.anomaly || '—', tone: (s.anomaly === '脏读' || s.anomaly === '不可重复读') ? 'bad' : s.anomaly === '正常' ? 'good' : undefined },
    { label: 'T1 读序列', value: s.reads.length ? s.reads.map(r => r.v).join('→') : '—' },
    { label: 'x 已提交', value: `${s.committedX}` },
  ],
}

const cas: Experiment<CasState> = {
  id: 'cas',
  group: '并发编程',
  title: 'CAS 无锁自增',
  subtitle: '读到旧值就 CAS，被抢先就重试',
  kernel: casKernel,
  defaultDoc: { kind: 'cas', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '无可调参数。3 个线程各 x++：T1、T2 同时读到 0（竞争），CAS 让后到者失败重读再来，于是不丢更新，最终 x=3、重试 2 次。原理详见讲解卡与「边界」。',
  bounds: [
    '3 个线程各 x++;T1、T2 同时读到 x=0(竞争)',
    'CAS 成功=内存仍等于期望值;否则失败重试(可核)',
    '最终 x=3(无丢更新),失败重试 2 次',
    '这就是 AtomicInteger / 自旋锁 / 无锁队列的地基',
  ],
  tabs: [{ id: 'race', label: '竞争+重试' }],
  Stage: CasStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `x=${s.x}` }
    : s.op === 'cas' ? (s.casOk ? { key: 'good', label: `T${s.cur} 成功` } : { key: 'bad', label: `T${s.cur} 重试` })
      : s.op === 'read' ? { key: 'idle', label: `T${s.cur} 读 ${s.x}` }
        : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 11)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'cas' ? (s.casOk ? '成' : '败') : '读'),
  whyInRail: true,
  readouts: s => [
    { label: '共享 x', value: `${s.x}` },
    { label: '本步', value: s.op === 'read' ? `T${s.cur} 读到 ${s.x}` : s.op === 'cas' ? `T${s.cur} CAS ${s.casOk ? '成功' : '失败'}` : '完成' },
    { label: '成功 / 失败', value: `${s.succeeds} / ${s.fails}`, tone: s.op === 'cas' && !s.casOk ? 'bad' : undefined },
    { label: '结果', value: s.phase === 'done' ? `x=${s.x}（未丢更新）` : '进行中' },
  ],
}

const mesi: Experiment<MesiState> = {
  id: 'mesi',
  group: '并发编程',
  title: 'MESI 缓存一致性',
  subtitle: '谁写了，别人的副本立刻失效',
  kernel: mesiKernel,
  defaultDoc: { kind: 'mesi', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '无可调参数。两核对同一个 x 读写，缓存行走 M/E/S/I 四态：谁写就先让别人的副本失效（I）——这就是「一个核的写另一核不会自动看见」、volatile 存在的硬件真相。详见讲解卡。',
  bounds: [
    '两核对同一个 x 读写,缓存行走 M/E/S/I 四态',
    '读未命中上总线;写=先失效别人再升 M(可核)',
    'C1 写→C2 变 I;C2 读到 C1 的 M→C1 回写降 S',
    '全程副本被失效 2 次;终态内存 x=1(脏值 2 还在 C2 的 M 里)',
  ],
  tabs: [{ id: 'coherence', label: 'M/E/S/I 状态转移' }],
  Stage: MesiStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `失效 ${s.invalidated} 次` }
    : s.op === 'write' ? { key: 'bad', label: `C${s.cur} 写·失效别人` }
      : s.op === 'read' ? { key: 'idle', label: `C${s.cur} 读` }
        : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'write' ? '写' : '读'),
  whyInRail: true,
  readouts: s => [
    { label: '本步', value: s.op === 'read' ? `C${s.cur} 读` : s.op === 'write' ? `C${s.cur} 写` : '完成' },
    { label: '核状态', value: s.cores.map(c => `C${c.id}:${c.state}`).join(' ') },
    { label: '内存 x', value: `${s.memX}` },
    { label: '失效次数', value: `${s.invalidated}`, tone: s.op === 'write' ? 'bad' : undefined },
  ],
}

const deadlock: Experiment<DeadlockState> = {
  id: 'deadlock',
  group: '并发编程',
  title: '死锁检测',
  subtitle: '等待图成环 = 死锁',
  kernel: deadlockKernel,
  defaultDoc: { kind: 'deadlock', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '无可调参数。T1/T2/T3 交叉加锁（各持一把、又等下一把），等待图 1→2→3→1 成环 → 死锁。这是死锁「检测」，区别于银行家的死锁「避免」。详见讲解卡与「边界」。',
  bounds: [
    'T1持A等B、T2持B等C、T3持C等A(交叉加锁)',
    '加锁成功=持有;要别人的锁=阻塞+加等待边(可核)',
    '边 1→2→3→1 闭合成环 → 第 6 步检出死锁',
    '环上 3 个线程互相等;按固定顺序加锁可防',
  ],
  tabs: [{ id: 'waitgraph', label: '等待图找环' }],
  Stage: DeadlockStage,
  tone: s => (s.deadlock ? { key: 'bad', label: '死锁!' }
    : s.phase === 'done' ? { key: 'good', label: '无死锁' }
      : s.op === 'request' ? { key: 'idle', label: `T${s.cur} 阻塞` }
        : s.op === 'acquire' ? { key: 'good', label: `T${s.cur} 拿到 ${s.lock}` }
          : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 7)),
  tickLabel: s => (s.deadlock ? '锁' : s.op === 'request' ? '等' : s.op === 'acquire' ? '取' : '毕'),
  whyInRail: true,
  readouts: s => [
    { label: '本步', value: s.op === 'acquire' ? `T${s.cur} 拿 ${s.lock}` : s.op === 'request' ? `T${s.cur} 等 ${s.lock}` : '完成' },
    { label: '等待边', value: s.waitFor.length ? s.waitFor.map(e => `${e[0]}→${e[1]}`).join(' ') : '—' },
    { label: '是否死锁', value: s.deadlock ? '是' : '否', tone: s.deadlock ? 'bad' : undefined },
    { label: '环上线程', value: s.cycle.length ? s.cycle.map(x => `T${x}`).join('→') : '—' },
  ],
}

const raft: Experiment<RaftState> = {
  id: 'raft',
  group: '分布式系统',
  title: 'Raft 共识',
  subtitle: '过半票当选，日志复制到过半即提交',
  kernel: raftKernel,
  defaultDoc: { kind: 'raft', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: 'Raft 让多台机器对「谁是主、日志长什么样」达成一致。本例 3 节点、多数派 2：Follower 选举超时→变 Candidate 拉票→拿过半票当选 Leader；客户端命令只发 Leader，复制到过半节点即提交。',
  bounds: [
    '3 节点,多数派 = 2;任期号保证一任期至多一主',
    '选主:超时→Candidate→拿过半票→Leader(可核)',
    '日志:客户端→Leader→复制到过半→提交',
    'N1 拿 2/2 票当选;日志复制到 2 份即提交',
  ],
  tabs: [{ id: 'consensus', label: '选主+日志复制' }],
  Stage: RaftStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `已提交 ${s.committed}` }
    : s.op === 'becomeLeader' ? { key: 'good', label: `N${s.cur} 当选` }
      : s.op === 'append' && s.committed ? { key: 'good', label: '日志提交' }
        : s.op === 'timeout' ? { key: 'idle', label: `N${s.cur} 参选` }
          : { key: 'idle', label: s.msg || '共识中' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 8)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'becomeLeader' ? '主' : s.op === 'append' && s.committed ? '交' : s.op === 'grantVote' ? '票' : s.op === 'clientCmd' ? '写' : '选'),
  whyInRail: true,
  readouts: s => [
    { label: '任期 term', value: `${s.term}` },
    { label: '角色', value: s.nodes.map(n => `N${n.id}:${n.role === 'leader' ? '主' : n.role === 'candidate' ? '选' : '从'}`).join(' ') },
    { label: '候选人票数', value: s.candidate > 0 ? `N${s.candidate} ${s.votes}/${s.majority}` : '—' },
    { label: '已提交日志', value: `${s.committed} 条`, tone: s.committed ? 'good' : undefined },
  ],
}

const caesar: Experiment<CaesarState> = {
  id: 'caesar',
  group: '密码学',
  title: '凯撒密码',
  subtitle: '每个字母在字母表上后移 k 位',
  kernel: caesarKernel,
  defaultDoc: { kind: 'caesar', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '无可调参数。固定演示移位加密：HELLO 每个字母后移 3 位 → KHOOR。原理：字母转数字→加 k→mod 26→转回。详见讲解卡。',
  bounds: ['明文 HELLO,密钥 k=3', '每字母:code→(code+k)mod26→新字母(可核)', 'HELLO→KHOOR', '只有26种密钥+不改频率,暴力/频率分析可破'],
  tabs: [{ id: 'shift', label: '逐字母移位' }],
  Stage: CaesarStage,
  tone: s => (s.phase === 'done' ? { key: 'good', label: s.cipher } : s.pos >= 0 ? { key: 'idle', label: `${s.ch}→${s.out}` } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / (s.plain.length + 1))),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.out || '移'),
  whyInRail: true,
  readouts: s => [
    { label: '密钥 k', value: `${s.key}` },
    { label: '本步', value: s.pos >= 0 ? `${s.ch}(${s.code}) → ${s.out}(${s.shifted})` : '完成' },
    { label: '密文', value: s.cipher || '—', tone: s.phase === 'done' ? 'good' : undefined },
    { label: '进度', value: `${s.pos >= 0 ? s.pos + 1 : s.plain.length}/${s.plain.length}` },
  ],
}

const vigenere: Experiment<VigenereState> = {
  id: 'vigenere', group: '密码学', title: '维吉尼亚密码', subtitle: '关键词循环给出每一位的位移',
  kernel: vigenereKernel, defaultDoc: { kind: 'vigenere', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。关键词 KEY 循环套在 HELLO 上，每位位移=对应关键词字母值 → RIJVS。详见讲解卡。',
  bounds: ['明文 HELLO,关键词 KEY(循环)', '每位:(明文码+关键词码)mod26(可核)', 'HELLO→RIJVS;两个L变成不同字母', '频率分析失效;弱点是关键词周期重复'],
  tabs: [{ id: 'poly', label: '多表替换' }], Stage: VigenereStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: s.cipher } : s.pos >= 0 ? { key: 'idle', label: `${s.ch}→${s.out}` } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / (s.plain.length + 1))),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.out || '移'),
  readouts: s => [{ label: '关键词', value: s.keyword }, { label: '本步', value: s.pos >= 0 ? `${s.ch}+${s.keyCh}→${s.out}` : '完成' }, { label: '密文', value: s.cipher || '—', tone: s.phase === 'done' ? 'good' : undefined }, { label: '进度', value: `${s.pos >= 0 ? s.pos + 1 : s.plain.length}/${s.plain.length}` }],
}
const xorcipher: Experiment<XorState> = {
  id: 'xor', group: '密码学', title: '异或加密', subtitle: '明文 XOR 密钥 = 密文，自反可还原',
  kernel: xorKernel, defaultDoc: { kind: 'xor', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。明文字节 A 逐位和密钥异或得密文；异或自反，再异或一次就还原。详见讲解卡。',
  bounds: ['明文 A=01000001,密钥 01101010', '逐位:相同得0、不同得1(可核)', '密文=00101011;再XOR同密钥=还原', '安全全在密钥:随机+等长+只用一次=OTP不可破'],
  tabs: [{ id: 'bits', label: '逐位异或' }], Stage: XorStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '自反' } : s.pos >= 0 ? { key: 'idle', label: `${s.mBit}⊕${s.kBit}=${s.cBit}` } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 9)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.cBit >= 0 ? String(s.cBit) : '异'),
  readouts: s => [{ label: '本位', value: s.pos >= 0 ? `${s.mBit} ⊕ ${s.kBit} = ${s.cBit}` : '完成' }, { label: '密文', value: s.cBits.join('') || '—', tone: s.phase === 'done' ? 'good' : undefined }, { label: '进度', value: `${s.pos >= 0 ? s.pos + 1 : 8}/8` }, { label: '性质', value: '自反(加解密同一套)' }],
}
const modpow: Experiment<ModPowState> = {
  id: 'modpow', group: '密码学', title: '快速模幂', subtitle: 'a^b mod n：逐位平方、遇 1 就乘',
  kernel: modpowKernel, defaultDoc: { kind: 'modpow', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。3^13 mod 7：指数拆二进制，底数逐步平方、遇 1 乘进结果，全程对 7 取模 → 3。详见讲解卡。',
  bounds: ['算 3^13 mod 7', '指数13=1101₂,逐位平方-乘(可核)', '= 3^1·3^4·3^8 mod 7 = 3', 'O(log b)次乘法;RSA/DH上千位幂全靠它'],
  tabs: [{ id: 'sqm', label: '平方-乘' }], Stage: ModPowStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `=${s.result}` } : s.bitPos >= 0 ? { key: 'idle', label: `位${s.bit} 结果${s.result}` } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.bit >= 0 ? String(s.bit) : '幂'),
  readouts: s => [{ label: '要算', value: `${s.a}^${s.b} mod ${s.n}` }, { label: '指数位', value: s.bitPos >= 0 ? `第${s.bitPos}位=${s.bit}` : '完成' }, { label: '当前底数', value: `${s.baseNow}` }, { label: '结果', value: `${s.result}`, tone: s.phase === 'done' ? 'good' : undefined }],
}
const diffiehellman: Experiment<DHState> = {
  id: 'diffiehellman', group: '密码学', title: 'DH 密钥交换', subtitle: '公开信道上商量出共享密钥',
  kernel: dhKernel, defaultDoc: { kind: 'diffiehellman', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。p=23,g=5；Alice a=6、Bob b=15。各算「对方公钥^自己私钥 mod p」都得共享密钥 2。详见讲解卡。',
  bounds: ['公开 p=23,g=5;私钥 a=6,b=15', 'A=g^a=8,B=g^b=19(公开,可核)', '共享=B^a=A^b=g^(ab)=2(两边一致)', '偷听者要解离散对数,大数下算不动'],
  tabs: [{ id: 'kex', label: '密钥协商' }], Stage: DHStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `共享 ${s.aliceShared}` } : { key: 'idle', label: s.stage === 'pubA' ? `A=${s.A}` : s.stage === 'pubB' ? `B=${s.B}` : s.stage }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.stage === 'sharedA' || s.stage === 'sharedB' ? '享' : '公'),
  readouts: s => [{ label: '公开参数', value: `p=${s.p} g=${s.g}` }, { label: '公钥 A/B', value: `${s.A >= 0 ? s.A : '?'} / ${s.B >= 0 ? s.B : '?'}` }, { label: '共享密钥', value: s.aliceShared >= 0 ? `${s.aliceShared}` : '—', tone: s.phase === 'done' ? 'good' : undefined }, { label: '安全根基', value: '离散对数难' }],
}
const rsa: Experiment<RSAState> = {
  id: 'rsa', group: '密码学', title: 'RSA 公钥加密', subtitle: '公钥加密、私钥解密',
  kernel: rsaKernel, defaultDoc: { kind: 'rsa', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。p=3,q=11→n=33,φ=20,e=3,d=7。明文 4 → 密文 31 → 解回 4。安全靠大数分解难。详见讲解卡。',
  bounds: ['p=3,q=11→n=33,φ=20,e=3,d=7', 'd使e·d≡1(mod φ);加密c=m^e mod n(可核)', 'm=4→c=31→解密c^d=4', '公开n难分解出p,q,故私钥d算不出'],
  tabs: [{ id: 'rsa', label: '密钥→加密→解密' }], Stage: RSAStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.m}→${s.c}→${s.dec}` } : { key: 'idle', label: s.stage }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.stage === 'encrypt' ? '密' : s.stage === 'decrypt' ? '解' : '钥'),
  readouts: s => [{ label: '模数 n', value: `${s.n}` }, { label: '公钥/私钥', value: `e=${s.e} / d=${s.d}` }, { label: '密文 c', value: s.c >= 0 ? `${s.c}` : '—' }, { label: '解密', value: s.dec >= 0 ? `${s.dec}(还原成 ${s.m})` : '—', tone: s.phase === 'done' ? 'good' : undefined }],
}

const extgcd: Experiment<ExtGcdState> = {
  id: 'extgcd', group: '密码学', title: '扩展欧几里得求模逆', subtitle: '求 d 使 e·d ≡ 1 (mod m)',
  kernel: extgcdKernel, defaultDoc: { kind: 'extgcd', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。迭代辗转相除+回带系数，求 3 关于模 20 的逆元 = 7（3×7=21≡1）。这是 RSA 求私钥 d 的算法。详见讲解卡。',
  bounds: ['求 3⁻¹ mod 20', '每步 q=⌊r/newr⌋,同步更新余数与系数(可核)', 'gcd=1 时系数取模即逆元 → d=7', '正是 RSA 求私钥 d 那一步'],
  tabs: [{ id: 'inv', label: '迭代求逆' }], Stage: ExtGcdStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `d=${s.result}` } : { key: 'idle', label: `q=${s.q}` }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 4)),
  tickLabel: s => (s.phase === 'done' ? '毕' : `q${s.q}`),
  readouts: s => [{ label: '求', value: `${s.e}⁻¹ mod ${s.m}` }, { label: '本步商', value: s.q >= 0 ? `${s.q}` : '完成' }, { label: '系数 t', value: `${s.t}` }, { label: '逆元 d', value: s.result >= 0 ? `${s.result}` : '?', tone: s.result >= 0 ? 'good' : undefined }],
}
const signature: Experiment<SignState> = {
  id: 'signature', group: '密码学', title: '数字签名', subtitle: '私钥签名、公钥验证',
  kernel: signKernel, defaultDoc: { kind: 'signature', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。消息哈希 h=4 → 私钥签名 s=4^7 mod 33=16 → 公钥验证 16^3 mod 33=4=h，通过。改消息就验不过。详见讲解卡。',
  bounds: ['n=33,e=3,d=7;消息哈希 h=4', '签名 s=h^d mod n=16;验证 s^e mod n(可核)', '验证=4=h → 通过', '私钥签、公钥验;篡改则 h′ 变、对不上'],
  tabs: [{ id: 'sign', label: '签名+验证' }], Stage: SignStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? (s.ok ? { key: 'good', label: '验证通过' } : { key: 'bad', label: '验证失败' }) : { key: 'idle', label: s.stage }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.stage === 'sign' ? '签' : s.stage === 'check' ? '验' : '哈'),
  readouts: s => [{ label: '消息哈希 h', value: `${s.hash}` }, { label: '签名 s', value: s.sig >= 0 ? `${s.sig}` : '—' }, { label: '验证 s^e', value: s.verified >= 0 ? `${s.verified}` : '—' }, { label: '结果', value: s.phase === 'done' ? (s.ok ? '通过 ✓' : '失败 ✕') : '…', tone: s.phase === 'done' ? (s.ok ? 'good' : 'bad') : undefined }],
}
const hashaval: Experiment<HashAvalState> = {
  id: 'hashaval', group: '密码学', title: '哈希雪崩效应', subtitle: '输入改一点，输出翻一半',
  kernel: hashavalKernel, defaultDoc: { kind: 'hashaval', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。对比 "cat" 与 "cot"（差一个字母）的 16 位哈希，逐位数翻转——翻了 8 位（约一半）。这就是雪崩效应。详见讲解卡。',
  bounds: ['对比 cat / cot 的 16 位哈希', '逐位比较,数翻转位(可核)', '一个字母之差→翻转 8/16 位(≈一半)', '雪崩=防篡改根基;真实 SHA-256 更彻底'],
  tabs: [{ id: 'aval', label: '逐位对比' }], Stage: HashAvalStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `翻转 ${s.flipped}/16` } : { key: 'idle', label: `翻 ${s.flipped}` }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 17)),
  tickLabel: s => (s.phase === 'done' ? '毕' : `${s.flipped}`),
  readouts: s => [{ label: '对比', value: `"${s.a}" vs "${s.b}"` }, { label: '两个哈希', value: `${s.hashA} / ${s.hashB}` }, { label: '当前位', value: s.pos >= 0 ? `第${s.pos + 1}位` : '完成' }, { label: '翻转位数', value: `${s.flipped}/16`, tone: s.phase === 'done' ? 'good' : undefined }],
}
const merkle: Experiment<MerkleState> = {
  id: 'merkle', group: '密码学', title: 'Merkle 树', subtitle: '一个根哈希守住一堆数据',
  kernel: merkleKernel, defaultDoc: { kind: 'merkle', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。4 个数据块自底向上两两哈希，汇成一个根哈希（=59）。改任何一块，根就变。区块链/Git/IPFS 都靠它。详见讲解卡。',
  bounds: ['4 块 [10,20,30,40],玩具哈希', '叶子→两两哈希成父→汇成根(可核)', '根哈希=59;改任何块根就变', '验证某块只需 O(log n) 个兄弟哈希'],
  tabs: [{ id: 'tree', label: '自底向上' }], Stage: MerkleStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `根 ${s.root}` } : { key: 'idle', label: s.act === 'leaf' ? `L${s.focus}` : s.act === 'parent' ? `P${s.focus}` : s.act }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 8)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.act === 'root' ? '根' : s.act === 'parent' ? '父' : '叶'),
  readouts: s => [{ label: '本步', value: s.act === 'leaf' ? `叶子 L${s.focus}` : s.act === 'parent' ? `父 P${s.focus}` : s.act === 'root' ? '根' : '完成' }, { label: '叶子哈希', value: s.leaves.filter(x => x >= 0).join(',') || '—' }, { label: '父节点', value: s.parents.filter(x => x >= 0).join(',') || '—' }, { label: '根哈希', value: s.root >= 0 ? `${s.root}` : '?', tone: s.root >= 0 ? 'good' : undefined }],
}

export const EXPERIMENTS = [
  cache, float, multiply, addsub, pipeline, vm,
  page, scheduler, disk, banker, mvcc, iso, cas, mesi, deadlock, raft,
  caesar, vigenere, xorcipher, modpow, diffiehellman, rsa, extgcd, signature, hashaval, merkle,
  partition, inode, semaphore, bitmap,
  sort, dijkstra, avl, btree, expr, bplus, hash, huffman, kmp, mst, topo, traverse, bloom, editdist, greedy,
  tcp, arq, crc, hamming, subnet, handshake, csma, rip,
  radix, paged, kvcache, batching, flash, specdec, roofline, tensorpar, collective, chunkprefill, kvoffload, linattn, engram, flashdecode, dpattn, ep, pp, engine,
  matmul, layout, softmax, attention, scaledmask, bayes, xent, jl, maxent, clt, lln, graddesc, residual, lowrank, condnum, scale, ortho, hopfield, induction, dotsim, rope, rmsnorm, mha, llmsize, sampling, bpe, quant, moe, forward,
  linreg, logreg, dtree, gbdt, svm, pca, kmeans, knn, pagerank, qlearn, recsys, conv, backprop, perceptron, pooling, rnn, lstm, wordvec, norm, gcn, diffusion, gan, beam, rag, selfconsist, bestofn, tot, mcts, binsearch, nqueens, unionfind, heap, quicksort, mergesort, fastpow, astar, collision,
] as unknown as AnyExperiment[]

/**
 * 地基关系：每个大模型 / ML 节点「坐在」哪些 408 / 基础实验上。
 * 用来在实验抬头渲染可点的「地基」链，把"从地基通到引擎"变成能一键跳的路。
 */
export const BASED_ON: Record<string, { id: string; why: string }[]> = {
  radix: [{ id: 'cache', why: '命中即复用' }, { id: 'hash', why: '按前缀查表' }],
  paged: [{ id: 'page', why: '分页取代连续分配' }, { id: 'bitmap', why: '空闲块池' }, { id: 'partition', why: '消灭外碎片' }],
  kvcache: [{ id: 'cache', why: '存过就不再算' }],
  batching: [{ id: 'scheduler', why: '每步一次调度' }],
  chunkprefill: [{ id: 'scheduler', why: '时间片轮转' }, { id: 'paged', why: '把长活切块' }],
  kvoffload: [{ id: 'page', why: '换入换出 / LRU' }],
  engine: [{ id: 'batching', why: '连续批处理调度' }, { id: 'paged', why: 'KV 块池准入' }, { id: 'scheduler', why: '每步一次调度' }, { id: 'kvcache', why: '每请求一份 KV' }],
  scale: [{ id: 'scaledmask', why: '\u00f7\u221ad 就在缩放点积这一步' }, { id: 'softmax', why: '缩放为了它不饱和' }],
  ortho: [{ id: 'attention', why: '点积当相关度的前提' }, { id: 'llmsize', why: '嵌入维度 d' }],
  hopfield: [{ id: 'attention', why: '一次注意力=一步检索' }, { id: 'softmax', why: 'β 锐度=1/温度' }, { id: 'ortho', why: '容量来自近正交' }],
  lln: [{ id: 'sampling', why: '采样靠多次平均才稳' }, { id: 'scale', why: '同一套 i.i.d. 方差可加' }],
  clt: [{ id: 'lln', why: '均值 std 同样 ∝1/√m' }, { id: 'sampling', why: '为什么用高斯建模随机' }],
  xent: [{ id: 'softmax', why: '概率分布从它来' }, { id: 'sampling', why: '同一套下一词分布' }],
  bayes: [{ id: 'clt', why: '同属概率推断' }],
  bloom: [{ id: 'hash', why: '靠哈希定位' }, { id: 'bitmap', why: '一位一格的位数组' }],
  graddesc: [{ id: 'forward', why: '前向算损失、反向给梯度' }],
  residual: [{ id: 'graddesc', why: '梯度靠它才不消失' }, { id: 'forward', why: '子层都裹残差' }],
  induction: [{ id: 'attention', why: '靠注意力回头匹配' }, { id: 'mha', why: '两个头接力' }, { id: 'scaledmask', why: '只能看左边' }],
  editdist: [{ id: 'dijkstra', why: '同是最优子结构' }],
  lowrank: [{ id: 'quant', why: '同是省显存的压法' }, { id: 'matmul', why: '权重就是矩阵' }],
  dotsim: [{ id: 'attention', why: 'Q·K 就是内积打分' }, { id: 'ortho', why: '无关方向点积≈0' }],
  greedy: [{ id: 'editdist', why: '对照:DP 保证最优' }, { id: 'huffman', why: '贪心对的一例' }],
  jl: [{ id: 'ortho', why: '同讲高维很空' }, { id: 'lowrank', why: '同是降维压缩' }],
  maxent: [{ id: 'softmax', why: 'softmax=最大熵解' }, { id: 'xent', why: '同属信息论' }],
  condnum: [{ id: 'graddesc', why: '它决定收敛快慢' }, { id: 'matmul', why: '矩阵的病态度' }],
  linattn: [{ id: 'attention', why: '改写的就是它' }, { id: 'kvcache', why: '换掉膨胀的 KV' }, { id: 'matmul', why: '结合律重排' }],
  knn: [{ id: 'dotsim', why: '按距离/相似度找最近' }, { id: 'hopfield', why: '近的权重大' }],
  kmeans: [{ id: 'dotsim', why: '按距离找最近' }],
  pca: [{ id: 'lowrank', why: '同抓主方向、降维' }, { id: 'ortho', why: '主成分两两正交' }],
  svm: [{ id: 'logreg', why: '同是线性分类、更挑边界' }, { id: 'dotsim', why: '间隔靠内积几何' }],
  gbdt: [{ id: 'dtree', why: '弱学习器就是它' }, { id: 'graddesc', why: '拟合的是残差/梯度' }],
  dtree: [{ id: 'topo', why: '同是树结构' }, { id: 'greedy', why: '每刀贪心选最优' }],
  logreg: [{ id: 'linreg', why: '同一套骨架、改分类' }, { id: 'softmax', why: 'sigmoid 是二类 softmax' }, { id: 'xent', why: '损失=交叉熵' }],
  backprop: [{ id: 'graddesc', why: '梯度喂给它更新' }, { id: 'residual', why: '梯度回传的高速路' }, { id: 'logreg', why: '就是一个神经元' }],
  binsearch: [{ id: 'sort', why: '得先有序' }, { id: 'bplus', why: 'B+树索引就是它' }],
  nqueens: [{ id: 'graph', why: '深度优先地搜' }, { id: 'greedy', why: '对照:贪心不回头' }],
  unionfind: [{ id: 'graph', why: '判两点连通' }, { id: 'hash', why: '按名找根同理' }],
  heap: [{ id: 'sort', why: '堆排序的核心' }, { id: 'huffman', why: '每次取最小靠它' }, { id: 'dijkstra', why: '优先队列取最近' }],
  quicksort: [{ id: 'sort', why: '对照:冒泡 O(n²)' }, { id: 'binsearch', why: '排好序才能二分' }, { id: 'heap', why: '另一种 O(n log n) 排序' }],
  mergesort: [{ id: 'quicksort', why: '分治两条路:先分vs后合' }, { id: 'heap', why: '同 O(n log n) 但原地' }, { id: 'sort', why: '对照:冒泡 O(n²)' }],
  fastpow: [{ id: 'binsearch', why: '同是每步砍一半=log n' }, { id: 'quicksort', why: '都是分治' }],
  astar: [{ id: 'dijkstra', why: 'h=0 就退化成它' }, { id: 'graph', why: '在图上搜路' }, { id: 'heap', why: '开放集用优先队列' }],
  perceptron: [{ id: 'logreg', why: '换 sigmoid 激活+概率' }, { id: 'svm', why: '同是线性分类,改最大间隔' }, { id: 'backprop', why: '多层就靠它学' }],
  pooling: [{ id: 'conv', why: '紧跟卷积后降采样' }],
  beam: [{ id: 'sampling', why: '另一条路:随机采样' }, { id: 'specdec', why: '都在解码阶段' }],
  rag: [{ id: 'wordvec', why: '检索靠词/句向量' }, { id: 'knn', why: '检索=向量最近邻' }, { id: 'dotsim', why: '相似度=内积' }],
  selfconsist: [{ id: 'sampling', why: '靠温度采样制造多样' }, { id: 'beam', why: '对照:束搜索求单一最优' }],
  bestofn: [{ id: 'selfconsist', why: '同采样多个:它投票、这打分' }, { id: 'sampling', why: '靠采样制造候选' }, { id: 'beam', why: '都在求更优输出' }],
  tot: [{ id: 'selfconsist', why: '都在增强推理:它平铺、这成树' }, { id: 'beam', why: '同是评估+剪枝的搜索' }, { id: 'astar', why: '本质是带评估的树搜索' }],
  mcts: [{ id: 'tot', why: '同是带评估的树搜索' }, { id: 'qlearn', why: '同做序列决策、试错' }, { id: 'beam', why: '都在搜索里权衡' }],
  rnn: [{ id: 'backprop', why: '沿时间反传学它' }, { id: 'residual', why: '残差治梯度消失' }, { id: 'attention', why: '注意力取代它' }],
  wordvec: [{ id: 'dotsim', why: '相似=向量内积' }, { id: 'jl', why: '高维向量可降维' }, { id: 'pca', why: '同是降维找结构' }],
  lstm: [{ id: 'rnn', why: '它给 RNN 装门' }, { id: 'residual', why: '同是加法高速路治梯度消失' }, { id: 'attention', why: '注意力取代循环' }],
  norm: [{ id: 'rmsnorm', why: 'LayerNorm 省掉减均值' }, { id: 'graddesc', why: '归一化让它更好收敛' }, { id: 'clt', why: '零均值单位方差=标准化' }],
  gcn: [{ id: 'conv', why: '卷积搬到图上=邻域聚合' }, { id: 'wordvec', why: '同属表示学习' }, { id: 'traverse', why: '在图上传播' }],
  diffusion: [{ id: 'sampling', why: '同是生成:采样出内容' }, { id: 'clt', why: '高斯噪声' }, { id: 'backprop', why: '去噪网络靠它训练' }],
  gan: [{ id: 'diffusion', why: '同属生成模型,另一条路' }, { id: 'logreg', why: '判别器就是个分类器' }, { id: 'backprop', why: 'G/D 都靠它训练' }],
  pagerank: [{ id: 'traverse', why: '本质是图上随机游走' }, { id: 'gcn', why: '同在图上传播信息' }, { id: 'lln', why: '稳态=大量游走的分布' }],
  qlearn: [{ id: 'astar', why: '同在网格找路,它靠试错学' }, { id: 'beam', why: '都在做序列决策' }, { id: 'dijkstra', why: '价值倒推像最短路松弛' }],
  recsys: [{ id: 'wordvec', why: '同把对象嵌进隐空间' }, { id: 'dotsim', why: '评分=内积' }, { id: 'pca', why: '同是低维分解' }],
  conv: [{ id: 'matmul', why: '核⊙窗口=点积' }, { id: 'dotsim', why: '匹配靠内积' }],
  linreg: [{ id: 'graddesc', why: '就是它在拟合' }, { id: 'condnum', why: '拟合的收敛快慢' }],
  pp: [{ id: 'pipeline', why: '指令流水线同理' }, { id: 'tensorpar', why: '另一种切法:切头' }, { id: 'scheduler', why: '调度填气泡' }],
  ep: [{ id: 'moe', why: '分片的就是专家' }, { id: 'collective', why: 'all-to-all 派发' }, { id: 'dpattn', why: 'MoE 里配 DP-attn' }],
  dpattn: [{ id: 'tensorpar', why: '对照:TP 切头' }, { id: 'collective', why: 'TP 的 all-reduce' }, { id: 'mha', why: '切的是多头' }],
  flashdecode: [{ id: 'flash', why: 'online softmax 同源' }, { id: 'kvcache', why: '切的是 KV' }, { id: 'batching', why: '同为吞吐/时延优化' }],
  engram: [{ id: 'induction', why: '同做回头复制、机制相反' }, { id: 'hash', why: 'O(1) 查表' }, { id: 'bpe', why: '同按 n-gram 统计' }],
  flash: [{ id: 'cache', why: '分块 blocking' }, { id: 'matmul', why: '切的是矩阵乘' }],
  tensorpar: [{ id: 'matmul', why: '按列切矩阵' }],
  collective: [{ id: 'tensorpar', why: '拼结果的 all-gather' }],
  quant: [{ id: 'float', why: '数值编码' }, { id: 'addsub', why: '补码 / 舍入' }],
  llmsize: [{ id: 'float', why: '每参数几字节' }],
  sampling: [{ id: 'sort', why: '按概率排序截断' }],
  bpe: [{ id: 'huffman', why: '按频次合并' }],
  mha: [{ id: 'llmsize', why: 'KV 吃显存' }],
  attention: [{ id: 'softmax', why: '注意力权重归一化' }],
  scaledmask: [{ id: 'softmax', why: '除 √d 防饱和' }, { id: 'attention', why: '注意力打分' }],
  rmsnorm: [{ id: 'softmax', why: '同管数值量程' }],
  moe: [{ id: 'llmsize', why: 'FFN 是参数大头' }],
  roofline: [{ id: 'matmul', why: '2·M·N·K 的算量' }],
  layout: [{ id: 'matmul', why: '访存的另一半' }],
  forward: [{ id: 'attention', why: '注意力' }, { id: 'rmsnorm', why: '归一化' }, { id: 'moe', why: 'FFN' }, { id: 'sampling', why: '采样' }],
}

/** 反向：一块地基被哪些节点用到。 */
export const USED_BY: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {}
  for (const [node, bases] of Object.entries(BASED_ON))
    for (const b of bases) (m[b.id] ??= []).push(node)
  return m
})()


/**
 * ── 模块体系（学科为骨架 + 职业/造物锚点做标签）──
 * 用户方向(2026-08-26)：模块按**学科**分(计算机/物理/化学/生物/历史/地理/文学)，
 * 每个实验挂一个「关联职业 / 具体造物」的**锚点**标签，可横向按锚点浏览。
 * 现有 78 个实验全在「计算机」学科下；物化生史地语先留占位入口，内容之后逐个填。
 */
export type Discipline = {
  key: string
  title: string
  icon: string
  sub: string
  groups: string[]          // 该学科下的子模块（= 现有 group 名）
  status: 'active' | 'planned'
  /** 该学科自己的 guide 页：一条「从地基 → 某职业/造物」的路（CS 就是 408→大模型推理机制）。 */
  guide: { from: string; to: string; toIcon: string; url?: string }
}

/**
 * 软链接：一个实验可以在多个子模块的目录里出现（同一个实验，导航到它的多个入口）。
 * key = 目标子模块名，value = 借来在这个子模块里也列出的实验 id（实验的真身仍在它的原 group）。
 * 用途：LLM 的解码/分词/量化等「算法」真身在计算机学科的 Transformer/大模型推理里，
 * 也软链进算法学科的「大模型算法」，避免重复造实验。目录里给它们标「↗」。
 */
export const SOFT_LINKS: Record<string, string[]> = {
  //  图算法也是经典算法——真身在计算机学科的「数据结构」，软链进这里。
  '经典算法': ['dijkstra', 'mst', 'topo', 'traverse'],
  //  注意力/Transformer 也是深度学习——真身在计算机学科的「Transformer 原理」，软链进这里。
  '深度学习算法': ['attention', 'scaledmask', 'mha', 'rope', 'forward'],
  '大模型算法': ['sampling', 'specdec', 'bpe', 'quant', 'moe'],
  //  B+ 树是数据库索引的地基——真身在地基轨「数据结构」，软链进后端轨「数据库系统」。
  '数据库系统': ['bplus'],
  //  信号量/生产者消费者、银行家(死锁)本身就是后端并发面试核心——真身在 408「操作系统」，软链进后端轨。
  '并发编程': ['semaphore', 'banker'],
}

export const DISCIPLINES: Discipline[] = [
  // 一级菜单 = 「408 地基 + 求职岗位」(2026-08-27 定)。地基轨在前,岗位轨在后。
  // 实验的 group 字段不变,只是重新归轨;一个实验可 SOFT_LINKS 跨轨挂载
  // (如 dijkstra 真身在地基轨「数据结构」,软链进算法轨「经典算法」)。
  // 名字只留核心、不带「工程师」。物理等非 CS 学科已下线(collision 的 group '力学' 成孤儿不显示)。
  {
    key: 'base', title: '408 基础', icon: '🎓', status: 'active',
    sub: '数据结构·组成·OS·网络 —— 考研与所有岗位的地基',
    groups: ['数据结构', '计算机组成原理', '操作系统', '计算机网络'],
    guide: { from: '一次内存访问', to: '吃透 408 四门', toIcon: '🎓' },
  },
  {
    key: 'backend', title: '后端', icon: '🖥️', status: 'active',
    sub: '数据库 · 并发 · 分布式',
    groups: ['数据库系统', '并发编程', '分布式系统'],
    guide: { from: '一次数据库查询', to: '扛住高并发的后端', toIcon: '🖥️' },
  },
  {
    key: 'algo', title: '算法', icon: '🧮', status: 'active',
    sub: '经典算法 → 会学习的模型',
    groups: ['经典算法', '概率统计原理', '机器学习基础', '机器学习算法', '深度学习算法'],
    guide: { from: '一次排序', to: '会学习的模型', toIcon: '🧠' },
  },
  {
    key: 'llm', title: '大模型', icon: '🧩', status: 'active',
    sub: 'Transformer → 推理引擎',
    groups: ['Transformer 原理', '大模型算法', '大模型推理'],
    guide: { from: '一次注意力', to: '大模型推理引擎', toIcon: '🤖' },
  },
  {
    key: 'security', title: '安全', icon: '🔐', status: 'active',
    sub: '密码学 → 可信系统',
    groups: ['密码学'],
    guide: { from: '一次移位', to: '一套加密协议', toIcon: '🔐' },
  },
]

export type Anchor = {
  key: string
  label: string
  icon: string
  kind: '造物' | '职业'
  status?: 'planned'        // 还没有实验挂上来的锚点，先展示"即将"
}

/** 锚点池：一个职业或一件具体的造物。现有 CS 实验挂在造物锚点上；职业/更多造物先占位。 */
export const ANCHORS: Anchor[] = [
  { key: 'computer', label: '电脑', icon: '🖥️', kind: '造物' },
  { key: 'software', label: '软件', icon: '🧩', kind: '造物' },
  { key: 'internet', label: '互联网', icon: '🌐', kind: '造物' },
  { key: 'llm', label: '大模型', icon: '🤖', kind: '造物' },
  { key: 'battery', label: '电池', icon: '🔋', kind: '造物', status: 'planned' },
  { key: 'phone', label: '手机', icon: '📱', kind: '造物', status: 'planned' },
  { key: 'car', label: '汽车', icon: '🚗', kind: '造物', status: 'planned' },
  { key: 'doctor', label: '医生', icon: '🩺', kind: '职业', status: 'planned' },
  { key: 'lawyer', label: '律师', icon: '⚖️', kind: '职业', status: 'planned' },
]

/** 子模块 → 默认锚点（造物）。个别实验将来要覆盖，可在此扩成 per-exp 映射。 */
export const GROUP_ANCHOR: Record<string, string> = {
  '计算机组成原理': 'computer',
  '操作系统': 'computer',
  '数据结构': 'software',
  '数据库系统': 'software',
  '并发编程': 'software',
  '分布式系统': 'internet',
  '密码学': 'internet',
  '计算机网络': 'internet',
  '概率统计原理': 'llm',
  '机器学习基础': 'llm',
  'Transformer 原理': 'llm',
  '大模型推理': 'llm',
}

export const ANCHOR_BY_KEY: Record<string, Anchor> = Object.fromEntries(ANCHORS.map(a => [a.key, a]))
export const DISCIPLINE_OF_GROUP: Record<string, Discipline> = (() => {
  const m: Record<string, Discipline> = {}
  for (const d of DISCIPLINES) for (const g of d.groups) m[g] = d
  return m
})()

/** 某实验关联的锚点（职业/造物）。 */
export function anchorOfExp(exp: { group: string }): Anchor | undefined {
  const key = GROUP_ANCHOR[exp.group]
  return key ? ANCHOR_BY_KEY[key] : undefined
}
