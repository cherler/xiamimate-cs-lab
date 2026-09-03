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
import { crtKernel, type CRTState } from '@engine/kernels/crt.ts'
import { CRTStage } from './stages/CRTStage.tsx'
import { fermatKernel, type FermatState } from '@engine/kernels/fermat.ts'
import { FermatStage } from './stages/FermatStage.tsx'
import { saltKernel, type SaltState } from '@engine/kernels/salt.ts'
import { SaltStage } from './stages/SaltStage.tsx'
import { tokenbucketKernel, type TokenBucketState } from '@engine/kernels/tokenbucket.ts'
import { TokenBucketStage } from './stages/TokenBucketStage.tsx'
import { consistentHashKernel, type ConsistentHashState } from '@engine/kernels/consistenthash.ts'
import { ConsistentHashStage } from './stages/ConsistentHashStage.tsx'
import { skiplistKernel, type SkipListState } from '@engine/kernels/skiplist.ts'
import { SkipListStage } from './stages/SkipListStage.tsx'
import { twopcKernel, type TwoPCState } from '@engine/kernels/twopc.ts'
import { TwoPCStage } from './stages/TwoPCStage.tsx'
import { otpreuseKernel, type OTPReuseState } from '@engine/kernels/otpreuse.ts'
import { OTPReuseStage } from './stages/OTPReuseStage.tsx'
import { ecbcbcKernel, type EcbCbcState } from '@engine/kernels/ecbcbc.ts'
import { ECBCBCStage } from './stages/ECBCBCStage.tsx'
import { birthdayKernel, type BirthdayState } from '@engine/kernels/birthday.ts'
import { BirthdayStage } from './stages/BirthdayStage.tsx'
import { aesroundKernel, type AesState } from '@engine/kernels/aesround.ts'
import { AesRoundStage } from './stages/AesRoundStage.tsx'
import { hmacKernel, type HmacState } from '@engine/kernels/hmac.ts'
import { HmacStage } from './stages/HmacStage.tsx'
import { totpKernel, type TotpState } from '@engine/kernels/totp.ts'
import { TotpStage } from './stages/TotpStage.tsx'
import { snowflakeKernel, type SnowflakeState } from '@engine/kernels/snowflake.ts'
import { SnowflakeStage } from './stages/SnowflakeStage.tsx'
import { vectorclockKernel, type VClockState } from '@engine/kernels/vectorclock.ts'
import { VClockStage } from './stages/VClockStage.tsx'
import { quorumKernel, type QuorumState } from '@engine/kernels/quorum.ts'
import { QuorumStage } from './stages/QuorumStage.tsx'
import { circuitbreakerKernel, type BreakerState } from '@engine/kernels/circuitbreaker.ts'
import { BreakerStage } from './stages/BreakerStage.tsx'
import { joinsKernel, type JoinState } from '@engine/kernels/joins.ts'
import { JoinsStage } from './stages/JoinsStage.tsx'
import { compositeindexKernel, type CIndexState } from '@engine/kernels/compositeindex.ts'
import { CIndexStage } from './stages/CIndexStage.tsx'
import { rwlockKernel, type RWLockState } from '@engine/kernels/rwlock.ts'
import { RWLockStage } from './stages/RWLockStage.tsx'
import { abaKernel, type ABAState } from '@engine/kernels/aba.ts'
import { ABAStage } from './stages/ABAStage.tsx'
import { happensbeforeKernel, type HBState } from '@engine/kernels/happensbefore.ts'
import { HBStage } from './stages/HBStage.tsx'
import { lrucacheKernel, type LRUState } from '@engine/kernels/lrucache.ts'
import { LRUCacheStage } from './stages/LRUCacheStage.tsx'
import { reactagentKernel, type ReactState } from '@engine/kernels/reactagent.ts'
import { ReactAgentStage } from './stages/ReactAgentStage.tsx'
import { ctxcompactKernel, type CompactState } from '@engine/kernels/ctxcompact.ts'
import { CtxCompactStage } from './stages/CtxCompactStage.tsx'
import { toolcallKernel, type ToolCallState } from '@engine/kernels/toolcall.ts'
import { ToolCallStage } from './stages/ToolCallStage.tsx'
import { permguardKernel, type PermState } from '@engine/kernels/permguard.ts'
import { PermGuardStage } from './stages/PermGuardStage.tsx'
import { subagentKernel, type SubState } from '@engine/kernels/subagent.ts'
import { SubAgentStage } from './stages/SubAgentStage.tsx'
import { memretrieveKernel, type MRState } from '@engine/kernels/memretrieve.ts'
import { MemRetrieveStage } from './stages/MemRetrieveStage.tsx'
import { mempagingKernel, type MemPState } from '@engine/kernels/mempaging.ts'
import { MemPagingStage } from './stages/MemPagingStage.tsx'
import { reflectionKernel, type ReflState } from '@engine/kernels/reflection.ts'
import { ReflectionStage } from './stages/ReflectionStage.tsx'
import { memwriteKernel, type MemWState } from '@engine/kernels/memwrite.ts'
import { MemWriteStage } from './stages/MemWriteStage.tsx'
import { planningKernel, type PlanState } from '@engine/kernels/planning.ts'
import { PlanningStage } from './stages/PlanningStage.tsx'
import { promptbuildKernel, type PBState } from '@engine/kernels/promptbuild.ts'
import { PromptBuildStage } from './stages/PromptBuildStage.tsx'
import { actteKernel, type ActState } from '@engine/kernels/actte.ts'
import { ActTeStage } from './stages/ActTeStage.tsx'
import { deltatsKernel, type DTState } from '@engine/kernels/deltats.ts'
import { DeltaTsStage } from './stages/DeltaTsStage.tsx'
import { normstatsKernel, type NSState } from '@engine/kernels/normstats.ts'
import { NormStatsStage } from './stages/NormStatsStage.tsx'
import { teleopKernel, type TeleState } from '@engine/kernels/teleop.ts'
import { TeleopStage } from './stages/TeleopStage.tsx'
import { miniduckKernel, type DuckState } from '@engine/kernels/miniduck.ts'
import { MiniDuckStage } from './stages/MiniDuckStage.tsx'
import { focKernel, type FocState } from '@engine/kernels/foc.ts'
import { FocStage } from './stages/FocStage.tsx'
import { lfucacheKernel, type LFUState } from '@engine/kernels/lfucache.ts'
import { LFUCacheStage } from './stages/LFUCacheStage.tsx'
import { trieKernel, type TrieState } from '@engine/kernels/trie.ts'
import { TrieStage } from './stages/TrieStage.tsx'
import { quickselectKernel, type QSelState } from '@engine/kernels/quickselect.ts'
import { QuickselectStage } from './stages/QuickselectStage.tsx'
import { lockstrategyKernel, type LockState } from '@engine/kernels/lockstrategy.ts'
import { LockStrategyStage } from './stages/LockStrategyStage.tsx'
import { bufferpoolKernel, type BufPoolState } from '@engine/kernels/bufferpool.ts'
import { BufferPoolStage } from './stages/BufferPoolStage.tsx'
import { wildcardKernel, type WildState } from '@engine/kernels/wildcard.ts'
import { WildcardStage } from './stages/WildcardStage.tsx'
import { blockingqueueKernel, type BQState } from '@engine/kernels/blockingqueue.ts'
import { BlockingQueueStage } from './stages/BlockingQueueStage.tsx'
import { regexKernel, type RegexState } from '@engine/kernels/regex.ts'
import { RegexStage } from './stages/RegexStage.tsx'
import { queryplanKernel, type QPlanState } from '@engine/kernels/queryplan.ts'
import { QueryPlanStage } from './stages/QueryPlanStage.tsx'
import { walKernel, type WALState } from '@engine/kernels/wal.ts'
import { WALStage } from './stages/WALStage.tsx'
import { lsmKernel, type LSMState } from '@engine/kernels/lsm.ts'
import { LSMStage } from './stages/LSMStage.tsx'
import { minikvKernel, type MiniKVState } from '@engine/kernels/minikv.ts'
import { MiniKVStage } from './stages/MiniKVStage.tsx'
import { minisearchKernel, type SearchState } from '@engine/kernels/minisearch.ts'
import { SearchStage } from './stages/SearchStage.tsx'
import { urlshortenerKernel, type UrlState } from '@engine/kernels/urlshortener.ts'
import type { SysDesignState } from '@engine/kernels/_sysdesign.ts'
import { seckillKernel, type SeckillState } from '@engine/kernels/seckill.ts'
import { mqdesignKernel, type MqState } from '@engine/kernels/mqdesign.ts'
import { topkKernel, type TopkState } from '@engine/kernels/topk.ts'
import { feedKernel, type FeedState } from '@engine/kernels/feed.ts'
import { fkKernel, type FKState } from '@engine/kernels/fk.ts'
import { dyneomKernel, type DynState } from '@engine/kernels/dyneom.ts'
import { rneaKernel, type RneaState } from '@engine/kernels/rnea.ts'
import { fwddynKernel, type FwdState } from '@engine/kernels/fwddyn.ts'
import { computedtorqueKernel, type CtcState } from '@engine/kernels/computedtorque.ts'
import { contactlcpKernel, type LcpState } from '@engine/kernels/contactlcp.ts'
import { ekfKernel, type EkfState } from '@engine/kernels/ekf.ts'
import { pinholeKernel, type PinState } from '@engine/kernels/pinhole.ts'
import { pointcloudKernel, type CloudState } from '@engine/kernels/pointcloud.ts'
import { stereoKernel, type StereoState } from '@engine/kernels/stereo.ts'
import { handeyeKernel, type HandEyeState } from '@engine/kernels/handeye.ts'
import { voKernel, type VoState } from '@engine/kernels/vo.ts'
import { pnpKernel, type PnpState } from '@engine/kernels/pnp.ts'
import { particlefilterKernel, type PfState } from '@engine/kernels/particlefilter.ts'
import { ukfKernel, type UkfState } from '@engine/kernels/ukf.ts'
import { complementaryKernel, type CompState } from '@engine/kernels/complementary.ts'
import { ikKernel, type IKState } from '@engine/kernels/ik.ts'
import { jacobianKernel, type JacoState } from '@engine/kernels/jacobian.ts'
import { kalmanKernel, type KalmanState } from '@engine/kernels/kalman.ts'
import { pidKernel, type PIDState } from '@engine/kernels/pid.ts'
import { rrtKernel, type RRTState } from '@engine/kernels/rrt.ts'
import { rrtstarKernel, type RRTSState } from '@engine/kernels/rrtstar.ts'
import { potentialfieldKernel, type PotState } from '@engine/kernels/potentialfield.ts'
import { trapezoidKernel, type TrapState } from '@engine/kernels/trapezoid.ts'
import { chompKernel, type ChompState } from '@engine/kernels/chomp.ts'
import { gjkKernel, type GjkState } from '@engine/kernels/gjk.ts'
import { dubinsKernel, type DubinsState } from '@engine/kernels/dubins.ts'
import { rrtconnectKernel, type RRTCState } from '@engine/kernels/rrtconnect.ts'
import { dstarliteKernel, type DStarState } from '@engine/kernels/dstarlite.ts'
import { libraryKernel, type LibraryState } from '@engine/kernels/library.ts'
import { prmKernel, type PrmState } from '@engine/kernels/prm.ts'
import { mdpKernel, type MdpState } from '@engine/kernels/mdp.ts'
import { qlearningKernel, type QState } from '@engine/kernels/qlearning.ts'
import { policygradKernel, type PgState } from '@engine/kernels/policygrad.ts'
import { ppoKernel, type PpoState } from '@engine/kernels/ppo.ts'
import { quatKernel, type QuatState } from '@engine/kernels/quat.ts'
import { trajectoryKernel, type TrajState } from '@engine/kernels/trajectory.ts'
import { icpKernel, type ICPState } from '@engine/kernels/icp.ts'
import { slamKernel, type SLAMState } from '@engine/kernels/slam.ts'
import { impedanceKernel, type ImpState } from '@engine/kernels/impedance.ts'
import { mpcKernel, type MPCState } from '@engine/kernels/mpc.ts'
import { bcKernel, type BCState } from '@engine/kernels/bc.ts'
import { diffpolicyKernel, type DiffPolicyState } from '@engine/kernels/diffpolicy.ts'
import { vlaKernel, type VLAState } from '@engine/kernels/vla.ts'
import { lerobotKernel, type LeRobotState } from '@engine/kernels/lerobot.ts'
import { objectstoreKernel } from '@engine/kernels/objectstore.ts'
import { SysDesignStage } from './stages/SysDesignStage.tsx'
import { SeckillStage } from './stages/SeckillStage.tsx'
import { UrlStage } from './stages/UrlStage.tsx'
import { TopkStage } from './stages/TopkStage.tsx'
import { MqStage } from './stages/MqStage.tsx'
import { FeedStage } from './stages/FeedStage.tsx'
import { FKStage } from './stages/FKStage.tsx'
import { DynEomStage } from './stages/DynEomStage.tsx'
import { RneaStage } from './stages/RneaStage.tsx'
import { FwdDynStage } from './stages/FwdDynStage.tsx'
import { ComputedTorqueStage } from './stages/ComputedTorqueStage.tsx'
import { ContactLcpStage } from './stages/ContactLcpStage.tsx'
import { EkfStage } from './stages/EkfStage.tsx'
import { PinholeStage } from './stages/PinholeStage.tsx'
import { PointCloudStage } from './stages/PointCloudStage.tsx'
import { StereoStage } from './stages/StereoStage.tsx'
import { HandEyeStage } from './stages/HandEyeStage.tsx'
import { VoStage } from './stages/VoStage.tsx'
import { PnpStage } from './stages/PnpStage.tsx'
import { PfStage } from './stages/PfStage.tsx'
import { UkfStage } from './stages/UkfStage.tsx'
import { CompStage } from './stages/CompStage.tsx'
import { IKStage } from './stages/IKStage.tsx'
import { JacobianStage } from './stages/JacobianStage.tsx'
import { KalmanStage } from './stages/KalmanStage.tsx'
import { PIDStage } from './stages/PIDStage.tsx'
import { RRTStage } from './stages/RRTStage.tsx'
import { RrtStarStage } from './stages/RrtStarStage.tsx'
import { PotentialFieldStage } from './stages/PotentialFieldStage.tsx'
import { TrapezoidStage } from './stages/TrapezoidStage.tsx'
import { ChompStage } from './stages/ChompStage.tsx'
import { GjkStage } from './stages/GjkStage.tsx'
import { DubinsStage } from './stages/DubinsStage.tsx'
import { RrtConnectStage } from './stages/RrtConnectStage.tsx'
import { DStarLiteStage } from './stages/DStarLiteStage.tsx'
import { LibraryStage } from './stages/LibraryStage.tsx'
import { PrmStage } from './stages/PrmStage.tsx'
import { MdpStage } from './stages/MdpStage.tsx'
import { QlearningStage } from './stages/QlearningStage.tsx'
import { PolicyGradStage } from './stages/PolicyGradStage.tsx'
import { PpoStage } from './stages/PpoStage.tsx'
import { QuatStage } from './stages/QuatStage.tsx'
import { TrajStage } from './stages/TrajStage.tsx'
import { ICPStage } from './stages/ICPStage.tsx'
import { SLAMStage } from './stages/SLAMStage.tsx'
import { ImpedanceStage } from './stages/ImpedanceStage.tsx'
import { MPCStage } from './stages/MPCStage.tsx'
import { BCStage } from './stages/BCStage.tsx'
import { DiffPolicyStage } from './stages/DiffPolicyStage.tsx'
import { VLAStage } from './stages/VLAStage.tsx'
import { LeRobotStage } from './stages/LeRobotStage.tsx'
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
  defaultDoc: { kind: 'softmax', params: { logits: '天气续写' }, entities: [], streams: [] },
  params: [
    { key: 'logits', label: 'logits 组', kind: 'enum', options: ['天气续写', '接近平局', '一枝独秀'] },
  ],
  paramsNote: 'softmax 不是一步步算的仿真，是个函数：logits + 温度 → 分布。真正在变的是温度——这里把轴换成"温度从低到高扫描"，按 ▶ 播放就看同一串 logit 的分布从尖变平、熵一路升高。温度就是 softmax 之前先把 logits 除以 T：T 小分布尖（接近贪心）、T 大分布平（更随机）。',
  bounds: [
    'logits 是给定的示例值，不是真跑模型出来的 —— 但 softmax 与温度的数学是精确的',
    '轴是温度扫描（T=0.25→5）：每一步是同一串 logit 在该温度下的完整分布，不是计算的中间步',
    '熵用以 2 为底（bit）；只演示温度对分布的影响，不含 top-k/top-p 截断（那是另一个实验）',
    '概率四舍五入到整数百分比显示，内部按浮点算；exp 前减最大值是数值稳定技巧不改结果',
  ],
  tabs: [{ id: 'dist', label: '分布' }],
  Stage: SoftmaxStage,
  tone: s => (s.T < 1 ? { key: 'good', label: `T=${s.T} 尖` }
    : s.T > 1 ? { key: 'idle', label: `T=${s.T} 平` }
    : { key: 'idle', label: 'T=1 基准' }),
  metric: s => (s.probs.length ? Math.min(1, s.entropy / Math.log2(s.tokens.length || 2)) : 0),
  tickLabel: s => `T=${s.T}`,
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
  subtitle: 'top-p 核采样 · 看候选集随阈值长大',
  kernel: samplingKernel,
  defaultDoc: { kind: 'sampling', params: { temperature: 1, topK: 0, logits: '长尾一堆' }, entities: [], streams: [] },
  params: [
    { key: 'temperature', label: '温度 T', kind: 'number', options: [0.7, 1, 1.3] },
    { key: 'topK', label: 'top-k(叠加)', kind: 'number', options: [0, 2, 3, 5], unit: '0=关' },
    { key: 'logits', label: 'logits 组', kind: 'enum', options: ['长尾一堆', '两强争锋'] },
  ],
  paramsNote: '采样解码不是一步步算的仿真，是个函数：一组 logit + 旋钮 → 候选集。真正在变的是截断阈值——这里把轴换成"top-p 从紧到松扫描"，按 ▶ 播放就看「核」(保留的候选集)怎么随阈值长大、自适应分布形状(分布尖核小、分布平核大)。温度、top-k 留作左侧旋钮,可叠加。',
  bounds: [
    'logits 是示例值；softmax、top-p、重归一化的数学是精确的',
    '轴是 top-p 扫描(0.3→1)：每步是同一分布在该阈值下的完整候选集,不是计算中间步',
    'top-k(侧栏,默认关)与 top-p 同开时取交集(都满足才留)',
    '只演示"截断出候选集"，真正的"随机采一个"是从最终分布里按概率抽 —— 不建模具体随机数',
  ],
  tabs: [{ id: 'sample', label: '采样' }],
  Stage: SamplingStage,
  tone: s => (s.p >= 1 ? { key: 'idle', label: 'top-p 关' } : { key: 'good', label: `top-p=${s.p}` }),
  metric: s => (s.tokens.length ? s.kept.filter(Boolean).length / s.tokens.length : 0),
  tickLabel: s => `p=${s.p}`,
  whyInRail: true,
  readouts: s => [
    { label: 'top-p', value: String(s.p), tone: 'hot' },
    { label: '保留候选(核)', value: `${s.kept.filter(Boolean).length} / ${s.tokens.length}`, tone: 'good' },
    { label: '覆盖概率', value: `${(s.probs.reduce((a, pr, i) => a + (s.kept[i] ? pr : 0), 0) * 100).toFixed(0)}%` },
    { label: '温度 / top-k', value: `${s.T} / ${s.k > 0 ? s.k : '关'}` },
    { label: '砍掉长尾', value: `${s.tokens.length - s.kept.filter(Boolean).length} 个` },
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
  subtitle: 'int8→int2 位宽扫描 · 拿精度换显存',
  kernel: quantKernel,
  defaultDoc: { kind: 'quant', params: {}, entities: [], streams: [] },
  params: [],
  paramsNote: '量化不是一步步算的仿真，是个函数：一组权重 + 位数 → 整数/误差/显存。真正在变的是位宽——这里把轴换成"位宽从高到低扫描(int8→int2)"，按 ▶ 播放就看同一组权重被压得整数越来越粗、最大误差越来越大、显存越来越小。对称量化：scale = max|w| ÷ (2^(bits-1)−1)，q = round(w/scale) 截断，反量化 ŵ = q·scale。这就是"拿精度换显存和带宽"。',
  bounds: [
    '用固定 8 个权重、对称 per-tensor 量化，便于手核',
    '轴是位宽扫描 int8→int2：每步是同一组权重在该位数下的完整量化,不是计算中间步',
    'scale = max|w| ÷ qmax；q 截断到 ±qmax；反量化 ŵ = q·scale；每权重占 bits/8 字节',
    '只量化权重，未展开激活量化与 W8A8 矩阵乘的细节；未含 scale/zero-point 分组存储开销',
  ],
  tabs: [{ id: 'quant', label: '量化与误差' }],
  Stage: QuantStage,
  tone: s => (s.bits >= 8 ? { key: 'good', label: `int${s.bits} 稳` }
    : s.bits <= 2 ? { key: 'bad', label: `int${s.bits} 险` }
    : { key: 'idle', label: `int${s.bits}` }),
  metric: s => 1 - s.bytesQ / s.bytesFp32,
  tickLabel: s => `int${s.bits}`,
  whyInRail: true,
  readouts: s => [
    { label: '量化位数', value: `int${s.bits}（±${s.qmax}）`, tone: 'hot' },
    { label: 'scale', value: s.scale.toFixed(4) },
    { label: '显存', value: `${s.bytesFp32}B → ${s.bytesQ}B` },
    { label: '最大误差', value: s.maxErr.toFixed(3), tone: s.bits <= 2 ? 'bad' : undefined },
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
    { label: '中点', value: s.mid >= 0 ? `arr[${s.mid}]=${s.arr[s.mid]}` : '—', tone: s.mid >= 0 && s.phase !== 'done' ? 'hot' : undefined },
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

const crt: Experiment<CRTState> = {
  id: 'crt', group: '密码学', title: '中国剩余定理', subtitle: '几个余数条件拼出唯一的数',
  kernel: crtKernel, defaultDoc: { kind: 'crt', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。x 除 3 余 2、除 5 余 3、除 7 余 2 → 唯一解 x=23（mod 105）。RSA 解密用它加速。详见讲解卡。',
  bounds: ['x≡2(3),3(5),2(7);模两两互质', '每条算 N_i、逆 y_i、贡献项 a·N·y(可核)', '唯一解 x=23(mod105)', 'RSA解密用CRT拆成模p/q两小幂,快3~4倍'],
  tabs: [{ id: 'crt', label: '构造解' }], Stage: CRTStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `x=${s.x}` } : { key: 'idle', label: s.idx >= 0 ? `第${s.idx + 1}条` : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.idx >= 0 ? `${s.idx + 1}` : '设'),
  readouts: s => [{ label: '总模 N', value: `${s.N}` }, { label: '本步', value: s.idx >= 0 ? `模${s.ns[s.idx]}: N=${s.Ni} y=${s.yi}` : '完成' }, { label: '累加和', value: `${s.acc}` }, { label: '解 x', value: s.x >= 0 ? `${s.x}` : '?', tone: s.x >= 0 ? 'good' : undefined }],
}
const fermat: Experiment<FermatState> = {
  id: 'fermat', group: '密码学', title: '费马素性测试', subtitle: 'a^(n-1) mod n ≠ 1 就是合数',
  kernel: fermatKernel, defaultDoc: { kind: 'fermat', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。测 n=15、底 a=2：2^14 mod 15 = 4 ≠ 1 → 15 一定是合数。RSA 选素数先用它筛。详见讲解卡。',
  bounds: ['费马小定理:素数 p 有 a^(p-1)≡1(mod p)', '测 n=15,a=2:算 2^14 mod 15(快速模幂,可核)', '= 4 ≠1 → 15 一定是合数', '=1只是"可能素数";实用中用米勒-拉宾'],
  tabs: [{ id: 'test', label: '模幂检测' }], Stage: FermatStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? (s.verdict === '合数' ? { key: 'bad', label: '合数' } : { key: 'good', label: '可能素数' }) : { key: 'idle', label: `结果${s.result}` }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.bit >= 0 ? String(s.bit) : '测'),
  readouts: s => [{ label: '测试 n', value: `${s.n}` }, { label: '要算', value: `${s.a}^${s.n - 1} mod ${s.n}` }, { label: '当前结果', value: `${s.result}` }, { label: '判定', value: s.verdict || '…', tone: s.phase === 'done' ? (s.verdict === '合数' ? 'bad' : 'good') : undefined }],
}
const salt: Experiment<SaltState> = {
  id: 'salt', group: '密码学', title: '盐与密码哈希', subtitle: '同一密码，加盐后哈希各不同',
  kernel: saltKernel, defaultDoc: { kind: 'salt', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。两人同用密码 123456：不加盐哈希相同(彩虹表可批量破)、加盐后不同。详见讲解卡。',
  bounds: ['两用户同密码 123456', '不加盐:hash(密码)两人相同(可核)', '加盐:hash(盐+密码)两人不同', '盐不保密,作用是打散;真实系统叠 bcrypt'],
  tabs: [{ id: 'salt', label: '不加盐 vs 加盐' }], Stage: SaltStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '加盐即不同' } : { key: 'idle', label: s.stage }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 4)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.stage === 'nosalt' ? '素' : s.stage === 'salted' ? '盐' : '码'),
  readouts: s => [{ label: '密码', value: `"${s.pw}"` }, { label: '不加盐', value: s.noSaltA >= 0 ? `${s.noSaltA} = ${s.noSaltB}` : '—', tone: s.noSaltA >= 0 ? 'bad' : undefined }, { label: '加盐', value: s.saltedA >= 0 ? `${s.saltedA} ≠ ${s.saltedB}` : '—', tone: s.saltedA >= 0 ? 'good' : undefined }, { label: '盐的作用', value: '打散(防彩虹表)' }],
}

const tokenbucket: Experiment<TokenBucketState> = {
  id: 'tokenbucket', group: '分布式系统', title: '令牌桶限流', subtitle: '限住平均速率，又容忍突发',
  kernel: tokenbucketKernel, defaultDoc: { kind: 'tokenbucket', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。桶容量 5、速率 1/tick，到达 [3,4,2,1,5]：开局突发全放行，之后限到约每 tick 1 个。详见讲解卡。',
  bounds: ['容量5、速率1/tick;到达[3,4,2,1,5]', '每刻:先补令牌(满溢出),请求拿令牌才放行(可核)', '开局突发3全放,共放行9拒6', '既限均速又容突发;对比漏桶恒定不容突发'],
  tabs: [{ id: 'rl', label: '补令牌+放行' }], Stage: TokenBucketStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `放行${s.totalAllowed}拒${s.totalRejected}` } : { key: s.rejected ? 'bad' : 'idle', label: `放${s.allowed}拒${s.rejected}` }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.phase === 'done' ? '毕' : `${s.allowed}`),
  readouts: s => [{ label: '桶中令牌', value: `${s.tokens}/${s.cap}` }, { label: '这刻', value: s.tick >= 0 ? `到${s.arrived} 放${s.allowed} 拒${s.rejected}` : '完成' }, { label: '累计放行', value: `${s.totalAllowed}`, tone: 'good' }, { label: '累计拒绝', value: `${s.totalRejected}`, tone: s.totalRejected ? 'bad' : undefined }],
}
const consistenthash: Experiment<ConsistentHashState> = {
  id: 'consistenthash', group: '分布式系统', title: '一致性哈希', subtitle: '加节点只搬一小段键',
  kernel: consistentHashKernel, defaultDoc: { kind: 'consistenthash', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。环 0..99，节点 A@10/B@40/C@70；加入 D@60 后 4 个键只有 k2 从 C 搬到 D。详见讲解卡。',
  bounds: ['环0..99,节点A@10/B@40/C@70,4个键', '键归顺时针第一个节点(可核)', '加D@60后只有k2(@55)从C搬到D', '对比hash%N扩容全体失效;Redis Cluster/Cassandra用它'],
  tabs: [{ id: 'ring', label: '环上分片' }], Stage: ConsistentHashStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '只搬1键' } : { key: 'idle', label: s.act === 'addnode' ? '加D' : s.act === 'remap' ? '重映射' : s.cur || '布置' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 7)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.act === 'addnode' ? '加' : s.act === 'remap' ? '搬' : s.act === 'assign' ? '分' : '置'),
  readouts: s => [{ label: '节点数', value: `${s.nodes.length}` }, { label: '本步', value: s.act === 'addnode' ? '新增 D@60' : s.act === 'remap' ? `搬动 ${s.remapped}` : s.act === 'assign' ? `分配 ${s.cur}` : '布置' }, { label: '键归属', value: s.keys.map(k => `${k.id}→${k.node}`).join(' ') || '—' }, { label: '本步搬动', value: s.remapped || '—', tone: s.remapped ? 'good' : undefined }],
}
const skiplist: Experiment<SkipListState> = {
  id: 'skiplist', group: '数据库系统', title: '跳表 Skip List', subtitle: '多层链表，O(log n) 查找',
  kernel: skiplistKernel, defaultDoc: { kind: 'skiplist', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。三层跳表查 7：从顶层出发，能右就右、右不动就下沉，4 步命中。Redis zset 用它。详见讲解卡。',
  bounds: ['三层跳表,查7', '本层下一个≤目标就右,否则下沉(可核)', '路径 L0:1→L1:1→L1:5→L2:5→L2:7,4步命中', '平均O(log n);Redis zset/LevelDB memtable用它'],
  tabs: [{ id: 'search', label: '逐层逼近' }], Stage: SkipListStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.compares}次命中` } : { key: 'idle', label: `L${s.levels.length - 1 - s.level}:${s.val}` }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.act === 'right' ? '右' : s.act === 'down' ? '下' : s.act === 'found' ? '中' : '始'),
  readouts: s => [{ label: '目标', value: `${s.target}` }, { label: '当前', value: `L${s.levels.length - 1 - s.level} 值 ${s.val}` }, { label: '比较次数', value: `${s.compares}` }, { label: '路径长', value: `${s.path.length} 步`, tone: s.phase === 'done' ? 'good' : undefined }],
}
const twopc: Experiment<TwoPCState> = {
  id: 'twopc', group: '分布式系统', title: '两阶段提交 2PC', subtitle: '都答能才真提交',
  kernel: twopcKernel, defaultDoc: { kind: 'twopc', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。协调者+3参与者：阶段一投票（全 Yes），阶段二提交。协调者宕机会让参与者阻塞。详见讲解卡。',
  bounds: ['1协调者+3参与者', '阶段一Prepare投票,阶段二Commit/Abort(可核)', '全Yes→提交;一个No/超时→全体Abort', '硬伤:协调者阶段二宕机→参与者锁资源阻塞'],
  tabs: [{ id: '2pc', label: '投票+提交' }], Stage: TwoPCStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '全提交' } : { key: 'idle', label: s.decision === 'commit' ? '决定Commit' : `${s.yesVotes}/3票` }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 8)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.decision ? '交' : s.yesVotes > 0 ? '票' : '备'),
  readouts: s => [{ label: '协调者', value: s.coord || '就绪' }, { label: 'Yes 票', value: `${s.yesVotes}/3` }, { label: '决定', value: s.decision || '未决', tone: s.decision === 'commit' ? 'good' : undefined }, { label: '参与者', value: s.parts.map(p => p.state === 'committed' ? '交' : p.state === 'prepared' ? '备' : '空').join('') }],
}

const otpreuse: Experiment<OTPReuseState> = {
  id: 'otpreuse', group: '密码学', title: '一次一密密钥重用', subtitle: '同一密钥加密两条消息=送人头',
  kernel: otpreuseKernel, defaultDoc: { kind: 'otpreuse', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。两条消息用同一密钥，把两段密文异或 → k⊕k 抵消，得到 m1⊕m2，密钥消失。详见讲解卡。',
  bounds: ['两条8位消息用同一密钥k', 'c1⊕c2=(m1⊕k)⊕(m2⊕k)=m1⊕m2(可核)', '密钥被抵消,泄露两明文异或关系', 'OTP密钥绝不能重复用;WEP/RC4栽在这'],
  tabs: [{ id: 'reuse', label: '异或消钥' }], Stage: OTPReuseStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'bad', label: '密钥泄露' } : { key: 'idle', label: `位${s.pos + 1}` }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 9)),
  tickLabel: s => (s.phase === 'done' ? '破' : s.xorbit >= 0 ? String(s.xorbit) : '异'),
  readouts: s => [{ label: '密钥', value: '两条消息共用(错误!)' }, { label: '本位', value: s.pos >= 0 ? `c1⊕c2=${s.xorbit}` : '完成' }, { label: 'm1⊕m2', value: s.m1xm2.join('') || '—', tone: s.phase === 'done' ? 'bad' : undefined }, { label: '结论', value: '密钥不能重复用' }],
}
const ecbcbc: Experiment<EcbCbcState> = {
  id: 'ecbcbc', group: '密码学', title: 'ECB vs CBC 工作模式', subtitle: '重复明文块：ECB 泄露、CBC 打散',
  kernel: ecbcbcKernel, defaultDoc: { kind: 'ecbcbc', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。同一批明文(P1=P3=1010)分别走 ECB(块独立)和 CBC(链接)加密：ECB 得 C1=C3 泄露重复，CBC 得 C1≠C3 打散。分组密码简化成 E(x)=x⊕K 好手算。详见讲解卡。',
  bounds: ['明文 P=[1010,1100,1010,0011],P1=P3;K=0110,IV=1111', 'ECB:C=P⊕K → [1100,1010,1100,0101],C1=C3(泄露)', 'CBC:C=(P⊕C₋₁)⊕K → [0011,1001,0101,0000],C1≠C3(安全)', 'ECB禁用(企鹅图);要CBC/CTR/GCM+随机IV'],
  tabs: [{ id: 'mode', label: '两模式对照' }], Stage: ECBCBCStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: 'CBC 打散' } : s.mode === 'ecb' ? (s.ecbLeak ? { key: 'bad', label: 'ECB 泄露' } : { key: 'idle', label: `ECB 块${s.blockIdx + 1}` }) : s.mode === 'cbc' ? { key: 'idle', label: `CBC 块${s.blockIdx + 1}` } : { key: 'idle', label: '看明文' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 11)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.mode === 'ecb' ? 'E' : s.mode === 'cbc' ? 'C' : 'P'),
  readouts: s => [
    { label: '模式', value: s.mode === 'intro' ? '看明文' : s.mode.toUpperCase() },
    { label: 'ECB 密文', value: s.ecbC.length ? s.ecbC.map(x => x.toString(2).padStart(4, '0')).join(' ') : '—', tone: s.ecbLeak ? 'bad' : undefined },
    { label: 'CBC 密文', value: s.cbcC.length ? s.cbcC.map(x => x.toString(2).padStart(4, '0')).join(' ') : '—', tone: s.cbcSafe ? 'good' : undefined },
    { label: '重复块', value: s.phase === 'done' ? 'ECB 泄露 / CBC 安全' : '对比中' },
  ],
}
const queryplan: Experiment<QPlanState> = {
  id: 'queryplan', group: '数据库系统', title: '执行计划 · 优化器选路', subtitle: '按估扫描行数选访问路径（读懂 EXPLAIN）',
  kernel: queryplanKernel, defaultDoc: { kind: 'queryplan', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。表10000行,查询 WHERE city AND age>30。优化器估三条访问路径扫多少行:全表扫ALL(10000)/idx(city) ref(500)/idx(age) range(6000),选最少的idx(city)。EXPLAIN显示type/key/rows。可核。详见讲解卡。',
  bounds: ['CBO基于代价:估每条访问路径扫多少行,选最省', 'type:ALL全表扫(危险)/ref等值索引/range范围索引;rows=估扫描行数', '本例选idx(city)(500行)而非全表(10000)或idx(age)(6000)', '"建了索引不走"=优化器算走索引更贵或统计信息过期估错'],
  tabs: [{ id: 'plan', label: '比代价选路' }], Stage: QueryPlanStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `选 ${s.paths[s.chosen]?.key}` } : s.op === 'path' ? { key: s.paths[s.cur]?.type === 'ALL' ? 'bad' : 'idle', label: `${s.paths[s.cur]?.rows}行` } : { key: 'idle', label: '看查询' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => (s.phase === 'done' ? '选' : s.op === 'path' ? String(s.cur + 1) : '始'),
  readouts: s => [
    { label: '本步', value: s.op === 'intro' ? '看查询' : s.phase === 'done' ? '优化器选定' : `候选：${s.paths[s.cur]?.name}` },
    { label: 'type', value: s.cur >= 0 ? s.paths[s.cur].type : '—', tone: s.cur >= 0 && s.paths[s.cur].type === 'ALL' ? 'bad' : s.phase === 'done' ? 'good' : undefined },
    { label: '估扫描', value: s.cur >= 0 ? `${s.paths[s.cur].rows} 行` : '—' },
    { label: '选中', value: s.chosen >= 0 ? `${s.paths[s.chosen].name}(${s.paths[s.chosen].rows}行)` : '—', tone: s.chosen >= 0 ? 'good' : undefined },
  ],
}
const regex: Experiment<RegexState> = {
  id: 'regex', group: '算法项目实战', title: 'mini 正则引擎', subtitle: '. 配任意、* 配零或多个前一字符（DP）',
  kernel: regexKernel, defaultDoc: { kind: 'regex', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。s="aab" p="c*a*b"。.配任意字符、*配零或多个前一字符(和通配符不同!)。DP:dp[i][j]=s前i个配p前j个。*两种转移:跳两格(0个)/正上方(多吃一个)。c*配0个c、a*配2个a、b配b→匹配✓。逐格可手核。详见讲解卡。',
  bounds: ['.配任意单字符;*配零或多个"前一个字符"(≠通配符的任意一段)', 'DP dp[i][j]=s前i配p前j;非*看左上且字符相配', '*两种转移:dp[i][j-2](匹配0个)或s[i-1]配x且dp[i-1][j](多吃一个)', 'c*配0个/a*配2个a/b配b→dp[3][5]真;O(nm)时空比回溯稳'],
  tabs: [{ id: 'dp', label: '逐行填表' }], Stage: RegexStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? (s.matched ? { key: 'good', label: '匹配 ✓' } : { key: 'bad', label: '不匹配' }) : s.op === 'row' ? { key: 'idle', label: `第${s.curRow}行` } : { key: 'idle', label: '看规则' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.phase === 'done' ? (s.matched ? '✓' : '✗') : s.op === 'row' ? String(s.curRow) : '始'),
  readouts: s => [
    { label: '本步', value: s.op === 'intro' ? '看规则' : s.phase === 'done' ? '读右下角' : `填第 ${s.curRow} 行` },
    { label: '关键格', value: s.key ? `dp[${s.key.i}][${s.key.j}]` : '—' },
    { label: '用的规则', value: s.key ? (s.key.rule === 'zero' ? '* 匹配 0 个' : s.key.rule === 'more' ? '* 多吃一个' : '字符相配·左上') : '—' },
    { label: '结果', value: s.phase === 'done' ? (s.matched ? '匹配 ✓' : '不匹配 ✗') : '填表中', tone: s.phase === 'done' ? (s.matched ? 'good' : 'bad') : undefined },
  ],
}
const blockingqueue: Experiment<BQState> = {
  id: 'blockingqueue', group: '并发编程', title: '线程安全阻塞队列', subtitle: '满时 put 阻塞、空时 take 阻塞',
  kernel: blockingqueueKernel, defaultDoc: { kind: 'blockingqueue', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。容量2的有界阻塞队列:put满→生产者阻塞、take空→消费者阻塞;对方操作腾空位/放数据后唤醒。锁+两条件变量(notFull/notEmpty)。队列/阻塞/唤醒可手核。=Java ArrayBlockingQueue/Go带缓冲channel。详见讲解卡。',
  bounds: ['put:队列满→生产者在notFull阻塞挂起(非忙等);take:空→消费者在notEmpty阻塞', '对方操作后signal唤醒:take腾空位唤醒生产者、put放数据唤醒消费者', '锁+两个条件变量;while判满/空防虚假唤醒', '天然削峰解耦;=ArrayBlockingQueue/带缓冲channel'],
  tabs: [{ id: 'bq', label: '阻塞与唤醒' }], Stage: BlockingQueueStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '唤醒取走' } : s.op === 'blockFull' ? { key: 'bad', label: '生产者阻塞' } : s.op === 'blockEmpty' ? { key: 'bad', label: '消费者阻塞' } : s.op === 'wakeP' || s.op === 'wakeC' ? { key: 'good', label: '唤醒' } : s.op === 'put' ? { key: 'idle', label: `put ${s.item}` } : s.op === 'take' ? { key: 'idle', label: `take ${s.item}` } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 11)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'blockFull' || s.op === 'blockEmpty' ? '⏳' : s.op === 'wakeP' || s.op === 'wakeC' ? '醒' : s.op === 'put' ? '入' : s.op === 'take' ? '出' : '始'),
  readouts: s => [
    { label: '队列', value: s.queue.length ? `[${s.queue.join(',')}]` : '空', tone: s.queue.length >= s.cap ? 'bad' : undefined },
    { label: '占用', value: `${s.queue.length}/${s.cap}` },
    { label: '阻塞', value: s.blockedP ? '生产者(等空位)' : s.blockedC ? '消费者(等数据)' : '无', tone: s.blockedP || s.blockedC ? 'bad' : undefined },
    { label: '本步', value: s.event || (s.phase === 'done' ? '消费者取走' : '就绪'), tone: s.op === 'wakeP' || s.op === 'wakeC' || s.phase === 'done' ? 'good' : undefined },
  ],
}
const wildcard: Experiment<WildState> = {
  id: 'wildcard', group: '算法项目实战', title: '通配符匹配', subtitle: '? 配一个、* 配一段：双指针 + 回溯锚点',
  kernel: wildcardKernel, defaultDoc: { kind: 'wildcard', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。s="abcd" p="a*d"。?配任意单字符、*配任意一段(可空)。双指针:遇*记锚点、先当匹配0个;走不通回溯让*多吃一个。a↔a→遇*→回溯吃b→吃c→d↔d→匹配✓。指针/*覆盖可手核。详见讲解卡。',
  bounds: ['?配任意单字符;*配任意一段(含空);难在*该吃几个', '双指针:遇*记锚点(位置+此刻si)、先当匹配0个越过', '走不通→回溯到锚点、*多吃一个字符再试', 'O(n)空间不用递归/DP;*吃"bc"最后d↔d→匹配;=文件通配/路由/SQL LIKE'],
  tabs: [{ id: 'wc', label: '双指针回溯' }], Stage: WildcardStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? (s.matched ? { key: 'good', label: '匹配 ✓' } : { key: 'bad', label: '不匹配' }) : s.op === 'backtrack' ? { key: 'idle', label: '回溯' } : s.op === 'star' ? { key: 'idle', label: '记锚点' } : s.op === 'match' ? { key: 'good', label: '匹配' } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 7)),
  tickLabel: s => (s.phase === 'done' ? (s.matched ? '✓' : '✗') : s.op === 'match' ? '配' : s.op === 'star' ? '锚' : s.op === 'backtrack' ? '溯' : '始'),
  readouts: s => [
    { label: '本步', value: s.op === 'intro' ? '就绪' : s.op === 'match' ? '匹配字符' : s.op === 'star' ? '遇 * 记锚点' : s.op === 'backtrack' ? '回溯 * 多吃一个' : '结束' },
    { label: '双指针', value: `si=${s.si} · pj=${s.pj}` },
    { label: '* 吃了', value: s.coverFrom >= 0 && s.coverTo > s.coverFrom ? `"${s.s.slice(s.coverFrom, s.coverTo)}"` : (s.star >= 0 ? '空' : '—') },
    { label: '结果', value: s.phase === 'done' ? (s.matched ? '匹配 ✓' : '不匹配 ✗') : '匹配中', tone: s.phase === 'done' ? (s.matched ? 'good' : 'bad') : undefined },
  ],
}
const bufferpool: Experiment<BufPoolState> = {
  id: 'bufferpool', group: '数据库系统', title: '缓冲池 midpoint-LRU', subtitle: '全表扫描冲不掉热点页（MySQL InnoDB）',
  kernel: bufferpoolKernel, defaultDoc: { kind: 'bufferpool', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。普通LRU被全表扫描污染(冷页挤走热点)。InnoDB把LRU分young(热)+old(冷)两段:新页插中点(old头)、二次访问才升young。扫描页S1/S2/S3只在old进出,young[A,B,C]毫发无损。链表流转可手核。详见讲解卡。',
  bounds: ['普通LRU坑:全表扫描把冷页塞LRU头、挤走热点(缓存污染)', 'InnoDB:LRU分young(前5/8)+old(后3/8),新页插中点(old头)', '二次访问且过时间窗才升young;扫描页只用一次→不升→old尾淘汰', 'young热点毫发无损;=innodb_old_blocks_pct/time参数机制;近LRU-K/2Q'],
  tabs: [{ id: 'bfp', label: '扫描不污染' }], Stage: BufferPoolStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '热点无损' } : s.op === 'scan' ? { key: 'idle', label: `装${s.loaded}汰${s.evicted}` } : s.op === 'init' ? { key: 'idle', label: '初始' } : { key: 'idle', label: '看问题' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.phase === 'done' ? '护' : s.op === 'scan' ? s.loaded.slice(-1) : s.op === 'init' ? '始' : 'Q'),
  readouts: s => [
    { label: '本步', value: s.op === 'scan' ? `装载 ${s.loaded}` : s.op === 'init' ? '初始' : s.phase === 'done' ? '扫描完' : '看问题' },
    { label: 'young 热区', value: `[${s.young.join(',')}]`, tone: s.phase === 'done' ? 'good' : undefined },
    { label: 'old 冷区', value: `[${s.old.join(',')}]` },
    { label: '淘汰', value: s.op === 'scan' ? s.evicted : '—', tone: s.op === 'scan' ? 'bad' : undefined },
  ],
}
const lockstrategy: Experiment<LockState> = {
  id: 'lockstrategy', group: '并发编程', title: '乐观锁 vs 悲观锁', subtitle: '并发改一行：版本重试 还是 加锁阻塞',
  kernel: lockstrategyKernel, defaultDoc: { kind: 'lockstrategy', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。两事务各扣1件库存(10→8)。先看无保护"更新丢失"(都读10都写9→9)；乐观锁(版本号:T2版本不符失败、重读重试成功)；悲观锁(FOR UPDATE:T2阻塞等T1放锁)。库存/版本/锁流转可手核。详见讲解卡。',
  bounds: ['无保护:都读10都写9→更新丢失(少扣一次)', '乐观锁:不加锁,UPDATE…WHERE version=旧;版本被改→影响0行→重试', '悲观锁:SELECT…FOR UPDATE先加锁,别人阻塞等待→串行', '乐观适合读多写少/冲突罕见(MVCC);悲观适合写多/冲突频繁(扣钱)'],
  tabs: [{ id: 'lock', label: '两策略对照' }], Stage: LockStrategyStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '两策略对比' } : s.outcome === 'fail' ? { key: 'bad', label: s.act === 'lost' ? '更新丢失' : '版本不符' } : s.outcome === 'block' ? { key: 'bad', label: 'T2 阻塞' } : s.outcome === 'retry' ? { key: 'good', label: 'T2 重试成功' } : s.act === 'optimistic' ? { key: 'idle', label: '乐观锁' } : s.act === 'pessimistic' ? { key: 'idle', label: '悲观锁' } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 12)),
  tickLabel: s => (s.phase === 'done' ? '比' : s.act === 'lost' ? '丢' : s.act === 'optimistic' ? '乐' : s.act === 'pessimistic' ? '悲' : '始'),
  readouts: s => [
    { label: '策略', value: s.act === 'intro' ? '引入' : s.act === 'lost' ? '无保护' : s.act === 'optimistic' ? '乐观锁' : s.act === 'pessimistic' ? '悲观锁' : '对比' },
    { label: '库存', value: `${s.stock}${s.act === 'optimistic' ? ` (v${s.version})` : ''}` },
    { label: '锁', value: s.lockedBy ? `🔒 ${s.lockedBy}` : '无锁' },
    { label: '本步', value: s.event || (s.phase === 'done' ? '两策略对比' : '就绪'), tone: s.outcome === 'fail' || s.outcome === 'block' ? 'bad' : s.outcome === 'ok' || s.outcome === 'retry' ? 'good' : undefined },
  ],
}
const quickselect: Experiment<QSelState> = {
  id: 'quickselect', group: '算法项目实战', title: '快速选择 Quickselect', subtitle: '找第 K 大不全排序，只递归一侧，平均 O(n)',
  kernel: quickselectKernel, defaultDoc: { kind: 'quickselect', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。[7,2,9,4,5,1,8]找第3大(升序第4位)。每轮partition定pivot最终位置,比目标下标→只递归一侧。3轮收敛到A[4]=7。pivot落位/递归侧可手核。详见讲解卡。',
  bounds: ['借快排partition,但每轮只递归目标所在的一侧', 'pivot落位P:P==目标→命中;P>目标→递归左;P<目标→递归右', '平均O(n)(丢一半);快排两侧递归=O(n㏒n);最坏O(n²)随机pivot避免', '求第K大/TopK/中位数;比全排序取第K快一个量级'],
  tabs: [{ id: 'qs', label: '逐轮 partition' }], Stage: QuickselectStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `第3大=${s.answer}` } : s.decision === 'left' ? { key: 'idle', label: '递归左' } : s.decision === 'right' ? { key: 'idle', label: '递归右' } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 4)),
  tickLabel: s => (s.phase === 'done' ? '中' : s.op === 'round' ? String(s.round) : '始'),
  readouts: s => [
    { label: '窗口', value: s.op === 'intro' ? '全部' : `[${s.lo},${s.hi}]` },
    { label: 'pivot 落位', value: s.pivotIdx >= 0 ? `${s.pivot}→idx${s.pivotIdx}` : '—' },
    { label: '目标下标', value: `${s.target}` },
    { label: '决策', value: s.phase === 'done' ? `命中→第3大=${s.answer}` : s.decision === 'left' ? '只递归左半' : s.decision === 'right' ? '只递归右半' : '—', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}
const trie: Experiment<TrieState> = {
  id: 'trie', group: '算法项目实战', title: 'Trie 自动补全', subtitle: '前缀树走查 + 收集子树 + 按热度 Top-K',
  kernel: trieKernel, defaultDoc: { kind: 'trie', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。词表 cat/car/card/care/dog 建 Trie,输入前缀 car:沿树走到前缀节点→DFS收集子树词(car/card/care)→按热度排 care(4)/car(3)/card(2)。走查/收集/排序可手核。详见讲解卡。',
  bounds: ['Trie:每节点一字符、路径拼成前缀、公共前缀共享;末尾节点标完整词', '补全:走到前缀节点O(前缀长度)→DFS收集子树词→按热度Top-K', '前缀car→子树car/card/care→排care(4)/car(3)/card(2)', '大词表优化:节点预存子树TopK;可扩模糊匹配/拼写纠错'],
  tabs: [{ id: 'trie', label: '走查→收集→排序' }], Stage: TrieStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: 'Top-K 建议' } : s.op === 'walk' ? { key: 'idle', label: `走到 ${s.walked}` } : s.op === 'collect' ? { key: 'good', label: `${s.candidates.length} 候选` } : s.op === 'build' ? { key: 'idle', label: '建树' } : { key: 'idle', label: '看结构' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 8)),
  tickLabel: s => (s.phase === 'done' ? '荐' : s.op === 'walk' ? (s.walked.slice(-1) || '走') : s.op === 'collect' ? '收' : s.op === 'build' ? '建' : '始'),
  readouts: s => [
    { label: '前缀', value: s.prefix || '—' },
    { label: '走到', value: s.walked || '根' },
    { label: '子树候选', value: s.candidates.length ? s.candidates.map(c => c[0]).join(',') : '—' },
    { label: 'Top-K 建议', value: s.suggestions.length ? s.suggestions.map(x => `${x[0]}(${x[1]})`).join(' ') : '—', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}
const lfucache: Experiment<LFUState> = {
  id: 'lfucache', group: '算法项目实战', title: '手写 LFU 缓存', subtitle: '按频率淘汰，同频再按最久未用',
  kernel: lfucacheKernel, defaultDoc: { kind: 'lfucache', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。容量2跑 LeetCode 460 序列。LFU 淘汰频率最低的、同频再按最久未用(LRU打平手)。O(1)实现=频率桶+minFreq。频率/淘汰对象可手核。详见讲解卡。',
  bounds: ['与LRU区别:LFU看频率、LRU看时间;get/put命中freq+1', 'put(3)淘汰频率最低的2;put(4)两个同频里淘汰最久未用的1', 'O(1)实现:频率桶(freq→双向链表)+minFreq指针', 'LFU坑:老热点赖着不走→真实用带衰减近似LFU(Redis)'],
  tabs: [{ id: 'lfu', label: 'put/get 全流程' }], Stage: LFUCacheStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: 'O(1) LFU' } : s.op === 'get' ? (s.hit ? { key: 'good', label: `命中 ${s.result}` } : { key: 'bad', label: '未命中' }) : s.evicted !== null ? { key: 'bad', label: `淘汰 ${s.evicted}` } : s.op === 'put' ? { key: 'idle', label: '插入' } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 11)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'get' ? (s.hit ? '中' : '空') : s.evicted !== null ? '汰' : s.op === 'put' ? '写' : '始'),
  readouts: s => [
    { label: '本步', value: s.opDesc || '就绪' },
    { label: '缓存(freq)', value: s.entries.length ? s.entries.map(e => `${e.k}:${e.v}(f${e.freq})`).join(' ') : '空' },
    { label: '结果', value: s.op === 'get' ? (s.result === -1 ? '-1' : `${s.result}`) : s.evicted !== null ? `淘汰${s.evicted}(${s.evictReason})` : '插入', tone: s.op === 'get' ? (s.hit ? 'good' : 'bad') : s.evicted !== null ? 'bad' : undefined },
    { label: '占用', value: `${s.entries.length}/${s.capacity}` },
  ],
}
const reactagent: Experiment<ReactState> = {
  id: 'reactagent', group: '大模型项目实战', title: 'Agent 主循环 · 防死循环', subtitle: '想→做→看，难在正确地停：正常 / 重复 / 超预算 / 出错',
  kernel: reactagentKernel, defaultDoc: { kind: 'reactagent', params: { scenario: '正常' }, entities: [], streams: [] },
  params: [{ key: 'scenario', label: '场景', kind: 'enum', options: ['正常', '重复', '超预算', '出错'] }],
  paramsNote: 'Agent=LLM+工具+循环(Thought→Action→Observation→…)。循环好写，**难的是让它正确地停**——这是 Agent 工程/面试的坑。四条终止路径(切「场景」看)：①正常(模型不再发工具→Final Answer) ②重复(一直发同一动作→**stuck 检测**中止，最近 3 步动作相同就判死循环) ③超预算(不收敛→撞 6 步预算上限→停、交 best-effort) ④出错(中途崩→**不硬崩、autosubmit 交一版**当前最好结果)。stuck 检测、步数计数都由引擎现算。术语：step=一次模型请求+工具，turn=零或多个 step。详见讲解卡。',
  bounds: [
    '循环难在正确地停：正常(无工具调用) / 重复(stuck 检测) / 超预算(步数·成本上限) / 出错(autosubmit)',
    'stuck 检测：最近几步动作相同=原地打转→中止，防无限跑烧钱；或给步数上限兜底',
    '超预算=硬上限(SWE-agent per_instance_cost_limit)，安全但可能截断正经活；软终止靠 stuck+压缩兜底',
    'autosubmit-on-error：崩了也交一版 best-effort，别让整趟白跑。step vs turn。Codex/DeepSeek 无硬 turn 上限,SWE-agent/OpenHands 有 max_iterations',
  ],
  tabs: [{ id: 'react', label: '循环逐步跑' }], Stage: ReactAgentStage, whyInRail: true,
  tone: s => (s.halt === 'answer' ? { key: 'good', label: '正常终止' }
    : s.halt === 'stuck' ? { key: 'bad', label: 'stuck 中止' }
    : s.halt === 'budget' ? { key: 'bad', label: '超预算停' }
    : s.halt === 'error' ? { key: 'bad', label: 'autosubmit' }
    : s.kind === 'action' ? { key: 'idle', label: `调 ${s.tool}·第${s.stepCount}步` }
    : s.kind === 'observation' ? { key: 'idle', label: '看结果' }
    : s.kind === 'thought' ? { key: 'idle', label: `想·第${s.round}轮` }
    : { key: 'idle', label: `场景 ${s.scenario}` }),
  metric: s => (s.halt ? 1 : Math.max(0, s.stepCount / s.budget)),
  tickLabel: s => (s.kind === 'halt' ? (s.halt === 'stuck' ? '停' : s.halt === 'budget' ? '爆' : '崩') : s.kind === 'answer' ? '答' : s.kind === 'thought' ? '想' : s.kind === 'action' ? '做' : s.kind === 'observation' ? '看' : '始'),
  readouts: s => [
    { label: '场景', value: s.scenario },
    { label: '步数 / 预算', value: `${s.stepCount} / ${s.budget}`, tone: s.stepCount >= s.budget ? 'bad' : undefined },
    { label: 'stuck 窗口', value: s.recent.length ? s.recent.slice(-3).join(' · ') : '—', tone: (() => { const w = s.recent.slice(-3); return w.length === 3 && w.every(a => a === w[0]) ? 'bad' : undefined })() },
    { label: '终止', value: s.halt ? ({ answer: '✅ 正常', stuck: '🛑 重复中止', budget: '🛑 超预算', error: '🛑 出错·交一版' }[s.halt] ?? '—') : '运行中', tone: s.halt === 'answer' ? 'good' : s.halt ? 'bad' : undefined },
  ],
}
const ctxcompact: Experiment<CompactState> = {
  id: 'ctxcompact', group: '大模型项目实战', title: '上下文压缩', subtitle: 'Agent 长会话 token 爆了：留头+留最近+中间压掉',
  kernel: ctxcompactKernel, defaultDoc: { kind: 'ctxcompact', params: { strategy: '总结', thresholdRatio: 0.8 }, entities: [], streams: [] },
  params: [
    { key: 'strategy', label: '压中间', kind: 'enum', options: ['总结', '省略'] },
    { key: 'thresholdRatio', label: '触发阈值', kind: 'number', options: [0.7, 0.8, 0.9], unit: '×窗口' },
  ],
  paramsNote: '大模型应用/Agent 工程面试最高频题:上下文窗口爆了怎么办。真跑一遍压缩流水线,每个 token 都现算:量token(中文被4字/token低估)→到阈值触发(thresholdRatio,DeepSeek默认0.8)→分区(留头+留最近retainRatio=0.16+压中间,别拆call/result对)→先剪超大工具输出→还超就【总结】(有损·花模型调用·记得住)或【省略】(免费·确定·失忆)。调阈值到0.9可看到"光剪枝就够、免总结"。素材来自真实开源框架,详见讲解卡。',
  bounds: [
    '流水线:量token→到阈值触发→留头(系统+首任务)+留最近(retainRatio)+压中间→先剪超大工具输出→总结/省略',
    '分区不拆「工具调用↔结果」对:结果留着调用被压走,模型看不懂结果哪来的',
    '总结(summarize):8段式摘要,有损、花一次模型调用、信息密度高;省略(elide):一行标记,免费确定但全丢',
    '原始日志append-only一条不删(可回放审计);系统提示+工具原样在最前→保住KV/前缀缓存。真实框架:Codex/Claude Code/OpenHands/SWE-agent/DeepSeek Harness',
  ],
  tabs: [{ id: 'cc', label: '压缩流水线' }], Stage: CtxCompactStage, whyInRail: true,
  tone: s => (s.stage === 'rebuild' ? (s.relievedByPrune ? { key: 'good', label: `剪够了 ${s.running}t` } : { key: 'good', label: `压缩完成 ${s.running}t` })
    : s.stage === 'prune' ? { key: 'idle', label: `剪超大输出 →${s.running}t` }
    : s.stage === 'partition' ? { key: 'idle', label: '分区:头/中/尾' }
    : { key: 'bad', label: `满了 ${s.running}t ≥ ${s.threshold}` }),
  metric: s => (s.stage === 'rebuild' ? 1 : Math.max(0, (s.step + 1) / 4)),
  tickLabel: s => ({ full: '满', partition: '分', prune: '剪', rebuild: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '累计 token', value: `${s.running} / ${s.N}`, tone: s.running >= s.threshold ? 'bad' : 'good' },
    { label: '压缩阈值', value: `${s.threshold}（${s.thresholdRatio}×窗口）` },
    { label: '本步', value: { full: '会话满了·超阈值', partition: '① 分区', prune: '② 先剪超大工具输出', rebuild: s.relievedByPrune ? '成·剪枝已够' : `③ 压中间·${s.strategy} → 成` }[s.stage] ?? '—' },
    { label: '省下', value: s.stage === 'rebuild' ? `${s.before - s.running} tokens（${s.before}→${s.running}）` : '—', tone: s.stage === 'rebuild' ? 'good' : undefined },
  ],
}
const toolcall: Experiment<ToolCallState> = {
  id: 'toolcall', group: '大模型项目实战', title: '工具调用', subtitle: '模型发的调用怎么解析→分发→执行→回灌；错了不崩循环',
  kernel: toolcallKernel, defaultDoc: { kind: 'toolcall', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: 'Agent 工程面试高频题：模型发的工具调用，harness 怎么处理。模型只管"发哪个工具"（模型的事）；"怎么接"是确定性流水线：①解析(取 name/参数，不合法→PARSE_ERROR) ②门禁(未知工具→UNKNOWN_TOOL；危险操作→DENY) ③执行(calc 引擎真算，带超时) ④回灌(结果/错误当 tool_result 配对喂回)。本例 5 个调用覆盖 成功/权限拒绝/未知工具/解析失败。关键：**出错不抛异常终止循环，错误当结果喂回**，模型能重试。详见讲解卡。',
  bounds: [
    '流水线(确定性)：解析→门禁→执行→回灌；模型只决定"发哪个"，"怎么接"是 harness 的功夫',
    '出错不崩循环：拒绝/未知工具/解析失败都变成一条 error 结果喂回，模型看到能重试/换招',
    '编码不只 JSON：Codex apply_patch 是自由文本、Aider 用文本 diff——为模型无关+避 JSON 转义地狱',
    '配对(结果带 call_id 喂回别拆) + 并行vs独占(只读可并行、写/shell 独占)。真实框架:Codex/OpenHands/DeepSeek Harness',
  ],
  tabs: [{ id: 'tc', label: '调用逐个处理' }], Stage: ToolCallStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: `${s.history.filter(h => h.ok).length}成/${s.history.filter(h => !h.ok).length}败·循环不断` }
    : s.cur < 0 ? { key: 'idle', label: `发出 ${s.total} 个调用` }
    : s.outcome === 'ok' ? { key: 'good', label: `${s.call?.name} 已执行` }
    : { key: 'bad', label: s.outcome === 'denied' ? '门禁拒绝' : s.outcome === 'unknown' ? '未知工具' : '解析失败' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / (s.total + 1))),
  tickLabel: s => (s.cur < 0 ? '发' : s.outcome === 'ok' ? '✓' : s.outcome === 'denied' ? '挡' : s.outcome === 'unknown' ? '?' : '✗'),
  readouts: s => [
    { label: '处理进度', value: s.cur < 0 ? `发出 ${s.total} 个` : `第 ${s.cur + 1} / ${s.total}` },
    { label: '本调用', value: s.cur < 0 ? '—' : `${s.call?.name || '(malformed)'}`, tone: s.outcome === 'ok' ? 'good' : s.outcome === '—' ? undefined : 'bad' },
    { label: '结局', value: s.cur < 0 ? '—' : (({ ok: '✅ 执行·回灌', denied: '⛔ 拒绝·错误回灌', unknown: '❓ 未知·错误回灌', malformed: '💥 解析失败·错误回灌' } as Record<string, string>)[s.outcome] ?? '—'), tone: s.outcome === 'ok' ? 'good' : s.outcome === '—' ? undefined : 'bad' },
    { label: '已回灌', value: s.history.length ? `${s.history.filter(h => h.ok).length}✓ / ${s.history.filter(h => !h.ok).length}✗` : '0' },
  ],
}
const permguard: Experiment<PermState> = {
  id: 'permguard', group: '大模型项目实战', title: '沙箱 / 权限', subtitle: '模型想跑命令，放不放行：规则(deny→ask→allow) + 沙箱(fail-closed)',
  kernel: permguardKernel, defaultDoc: { kind: 'permguard', params: { mode: '默认' }, entities: [], streams: [] },
  params: [{ key: 'mode', label: '权限模式', kind: 'enum', options: ['默认', '接受编辑', '计划', '放行'] }],
  paramsNote: 'Agent 安全面试大点：模型生成的命令，怎么既让它干活、又不删库/联网偷数据。靠两道**相互独立**的墙：①规则/审批(deny→ask→allow，**首次匹配即生效**，危险的先拦)②沙箱(物理隔离，网络默认关、写只在工作区内，**fail-closed**)。两墙都过才真跑；越权是**一次性升级**(带理由+一次批准，不给 allow-always)。切「权限模式」(默认问/接受编辑不问/计划只读/放行全跳过)看结局怎么变——注意：连"放行"模式都过不了沙箱那道网络墙。详见讲解卡。',
  bounds: [
    '两道墙相互独立：规则放行 ≠ 沙箱放行；网络那条连"放行"模式都被沙箱 fail-closed 拦住',
    'deny→ask→allow，首次匹配即生效——危险操作(rm -rf)第一条 deny 就拦下，不再往后看',
    'fail-closed：沙箱宁可拦错不放过(网络默认关、写越界拦)；越权=一次性升级(带理由+一次人工批准，防权限蔓延)',
    '模式=安全↔顺手滑杆(默认问/接受编辑不问/计划只读/放行危险)。对比 Aider 不做沙箱、靠 git+/undo 兜底(可回滚≠隔离)',
  ],
  tabs: [{ id: 'pg', label: '操作逐个决议' }], Stage: PermGuardStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: `${s.history.filter(h => h.final !== 'blocked').length}跑/${s.history.filter(h => h.final === 'blocked').length}拦` }
    : s.cur < 0 ? { key: 'idle', label: `${s.mode}·${s.total} 个待判` }
    : s.res?.final === 'blocked' ? { key: 'bad', label: '拒绝' }
    : s.res?.final === 'escalate-run' ? { key: 'idle', label: '升级放行' }
    : s.res?.final === 'ask-run' ? { key: 'good', label: '问过放行' }
    : { key: 'good', label: '放行' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / (s.total + 1))),
  tickLabel: s => (s.cur < 0 ? '判' : s.res?.final === 'blocked' ? '拦' : s.res?.final === 'ask-run' ? '问' : s.res?.final === 'escalate-run' ? '升' : '放'),
  readouts: s => [
    { label: '权限模式', value: s.mode },
    { label: '本操作', value: s.cur < 0 ? '—' : `${s.op?.cmd}`, tone: s.res?.final === 'blocked' ? 'bad' : s.res ? 'good' : undefined },
    { label: '结局', value: s.cur < 0 ? '—' : (s.res?.fLabel ?? '—'), tone: s.res?.final === 'blocked' ? 'bad' : s.res ? 'good' : undefined },
    { label: '已判', value: s.history.length ? `${s.history.filter(h => h.final !== 'blocked').length}跑 / ${s.history.filter(h => h.final === 'blocked').length}拦` : '0' },
  ],
}
const subagent: Experiment<SubState> = {
  id: 'subagent', group: '大模型项目实战', title: '子 Agent · 委派', subtitle: '派活给子 agent：独立上下文省 token、只回传结果、防 fork 炸弹',
  kernel: subagentKernel, defaultDoc: { kind: 'subagent', params: { seed: '新开' }, entities: [], streams: [] },
  params: [{ key: 'seed', label: '起始方式', kind: 'enum', options: ['新开', '承接'] }],
  paramsNote: 'Agent 工程八股：复杂任务，父 agent 把子任务派给子 agent。为什么要独立子 agent？——**省上下文**：子在自己独立上下文里探索(读一堆文件、试一堆)，**只把结论回传**给父，大块探索不污染父。本例 4 个子内部共花 230t，父只涨 36t、省 194t。**起始方式**：新开(spawn)从空白起(便宜、无父历史)/承接(fork)带父前缀(KV 缓存友好但更贵)。**防 fork 炸弹**：深度上限(maxDepth 3，到顶摘 spawn 工具)、并发上限(≤20)。子只回传最终结果(非整条轨迹)、子权限不可自扩、子崩不连累父。详见讲解卡。',
  bounds: [
    '省上下文=头号理由：子在独立上下文探索、只回传结论，大块探索不污染父(本例子共 230t、父只涨 36t)',
    '防 fork 炸弹：深度上限(maxDepth 3，到顶摘 spawn 工具)+并发上限(≤20)，不然子生子指数爆炸',
    '只回传最终结果(不是整条轨迹，省 token)；子权限不可自扩(派出时定死，接沙箱/权限)；子崩不连累父',
    '新开(spawn)从空白起省事 / 承接(fork)带父前缀续得上、KV 缓存友好。真实框架:Claude Code Task、DeepSeek ctx.subagents、OpenHands AgentDelegate',
  ],
  tabs: [{ id: 'sa', label: '委派逐个展开' }], Stage: SubAgentStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: `省 ${s.internalTotal - s.returnTotal}t` }
    : s.stage === 'blocked' ? { key: 'bad', label: '深度上限拦下' }
    : s.cur ? { key: 'idle', label: `派 ${s.cur}·省${s.nodes.find(n => n.id === s.cur) ? (s.nodes.find(n => n.id === s.cur)!.internalTok - s.nodes.find(n => n.id === s.cur)!.returnTok) : 0}t` }
    : { key: 'idle', label: `父 ${s.parentCtx}t` }),
  metric: s => (s.stage === 'done' ? 1 : Math.min(0.95, (s.step + 1) / 7)),
  tickLabel: s => ({ intro: '始', child: '派', blocked: '拦', done: '省' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '起始方式', value: `${s.seed}（子起 ${s.childStart}t）` },
    { label: '父上下文', value: `${s.parentCtx}t`, tone: 'good' },
    { label: '子内部 / 回传', value: `${s.internalTotal}t / ${s.returnTotal}t` },
    { label: '省下', value: s.internalTotal > s.returnTotal ? `${s.internalTotal - s.returnTotal}t` : '—', tone: s.stage === 'done' ? 'good' : undefined },
  ],
}
const memretrieve: Experiment<MRState> = {
  id: 'memretrieve', group: '大模型项目实战', title: '记忆检索打分', subtitle: '查询来了，从记忆流按 最近×重要×相关 打分、捞 top-k',
  kernel: memretrieveKernel, defaultDoc: { kind: 'memretrieve', params: { weights: '均衡' }, entities: [], streams: [] },
  params: [{ key: 'weights', label: '权重', kind: 'enum', options: ['均衡', '重相关', '重时新'] }],
  paramsNote: 'Agent 记忆系统的算法心脏：长期记忆一大堆、上下文塞不下，查询来了要**只捞最该看的 top-k**。不是关键词匹配，是**打分检索**(Generative Agents 经典做法)：每条记忆算三信号——最近度(decay^龄，decay=0.995)、重要度(LLM 打的 1~10 分/10)、相关度(与查询的余弦)——加权求和 得分 = w_rec·最近 + w_rel·相关 + w_imp·重要，排序取 top-k。**权重翻则排名翻**：论文等权(1·1·1)、Generative Agents 代码是(0.5·3·2 相关最重)。切「权重」看「用户是 VIP」这条(重要但不相关)进/出。三信号+得分+排名全现算；GA 实际还会 min-max 归一化。详见讲解卡。',
  bounds: [
    '检索=打分不是关键词匹配：得分 = w_rec·最近度(decay^龄) + w_rel·相关度(余弦) + w_imp·重要度(LLM 1~10)，排序取 top-k',
    '三信号各说各话：记忆可以很新但不相关、很重要但不相关——所以"重要但眼下不相关"要不要捞，全看权重',
    '权重翻则排名翻：论文等权(1·1·1) vs Generative Agents 代码(0.5·3·2 相关最重)，捞回的 top-k 不同',
    'GA 实际把三列各自 min-max 归一化再加权。延伸：向量检索(embed→余弦 top-k)/BM25/混合+rerank；检索不准=喂噪声污染上下文',
  ],
  tabs: [{ id: 'mr', label: '检索逐格算' }], Stage: MemRetrieveStage, whyInRail: true,
  tone: s => (s.stage === 'done' || s.stage === 'rank' ? { key: 'good', label: `捞回 ${s.mems.filter(m => m.retrieved).map(m => m.id).join('/')}` }
    : s.stage === 'score' ? { key: 'idle', label: `加权求分·${s.weights}` }
    : s.stage === 'signals' ? { key: 'idle', label: '算三信号' }
    : { key: 'idle', label: '查询来了' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => ({ intro: '询', signals: '信', score: '分', rank: '排', done: '捞' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '权重（最近·相关·重要）', value: `${s.weights}（${s.wr}·${s.wl}·${s.wi}）` },
    { label: '查询', value: s.query },
    { label: '最高分', value: (() => { const t = [...s.mems].sort((a, b) => b.score - a.score)[0]; return t ? `${t.text}（${t.score.toFixed(2)}）` : '—' })(), tone: 'good' },
    { label: '捞回 top-k', value: (s.stage === 'rank' || s.stage === 'done') ? s.mems.filter(m => m.retrieved).map(m => m.text).join('、') : '—', tone: (s.stage === 'rank' || s.stage === 'done') ? 'good' : undefined },
  ],
}
const mempaging: Experiment<MemPState> = {
  id: 'mempaging', group: '大模型项目实战', title: 'MemGPT 虚拟内存 · 分页', subtitle: '上下文=RAM、外部=磁盘：填满→内存压力→驱逐+递归摘要→缺页调回',
  kernel: mempagingKernel, defaultDoc: { kind: 'mempaging', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: 'MemGPT 的核心洞察：把 LLM 上下文当"物理内存 RAM"、外部存储当"磁盘"，agent 用函数调用在两层间搬数据=给大模型做**虚拟内存**(和 408 页面置换/缺页同一思想)。RAM(进prompt)=系统指令+工作记忆(core)+FIFO队列(首槽=递归摘要)；磁盘(不进prompt)=recall(全消息库)+archival(可检索)。流水线：消息填 RAM→到窗口 **70%** 触发内存压力警告→队列管理器**驱逐**~50% 老消息到 recall 并写**递归摘要**回队首(换出)→需要旧信息时 conversation_search/archival_search 检索**调回队尾**(缺页换入)。数字来自 MemGPT 论文；水位/驱逐/调回全现算。详见讲解卡。',
  bounds: [
    '上下文=RAM(快·贵·小)、外部存储=磁盘(慢·便宜·大)，函数调用换页=给 LLM 做虚拟内存',
    '内存压力：RAM 到窗口 70% 警告、100% flush；驱逐~50% 老消息到 recall + 写递归摘要回队首(有损换出)',
    '缺页(page fault)：需要已驱逐的旧信息→conversation_search/archival_search 检索、追加到队尾调回',
    'OS 对照：主上下文=物理内存、驱逐+摘要=页面置换、检索调回=缺页调入。和 408 页面置换同一算法；换页太频=抖动',
  ],
  tabs: [{ id: 'mp', label: '换页逐步跑' }], Stage: MemPagingStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '换页完成' }
    : s.stage === 'pagein' ? { key: 'good', label: '缺页调回' }
    : s.stage === 'evict' ? { key: 'idle', label: '驱逐换出' }
    : s.stage === 'pressure' ? { key: 'bad', label: `内存压力 ${s.ramUsed}≥${s.warnAt}` }
    : s.stage === 'fill' ? { key: 'idle', label: `填到 ${s.ramUsed}t` }
    : { key: 'idle', label: 'RAM/磁盘' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '始', fill: '填', pressure: '压', evict: '逐', pagein: '调', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: 'RAM 水位', value: `${s.ramUsed} / ${s.N}`, tone: s.pressure ? 'bad' : 'good' },
    { label: '内存状态', value: s.pressure ? '⚠ 压力(≥70%)' : '正常', tone: s.pressure ? 'bad' : undefined },
    { label: 'recall(磁盘)', value: `${s.recall.length} 条`, tone: s.recall.length ? 'good' : undefined },
    { label: '本步', value: s.op || (({ intro: 'RAM/磁盘分层', done: '换页完成' } as Record<string, string>)[s.stage] ?? '—') },
  ],
}
const reflection: Experiment<ReflState> = {
  id: 'reflection', group: '大模型项目实战', title: '反思 · 记忆巩固', subtitle: '零散观察攒够重要度→提炼高层洞察(带证据)→入库成新记忆',
  kernel: reflectionKernel, defaultDoc: { kind: 'reflection', params: { threshold: '默认' }, entities: [], streams: [] },
  params: [{ key: 'threshold', label: '反思阈值', kind: 'enum', options: ['敏感', '默认', '迟钝'] }],
  paramsNote: 'Generative Agents 的洞察：光存原始观察不够(只见树木不见森林)，agent 得定期把零散观察**巩固成高层洞察**。触发=最近观察的**重要度之和**超阈值(论文约 150)就反思一次;反思=LLM 就最近观察提炼**洞察**并**引用证据**(哪几条观察支撑);洞察当**高重要度新记忆**入库、还能被更高层反思→**反思树**。切「阈值」(敏感10/默认15/迟钝20)看反思勤/懒、证据集怎么变。重要度累积、触发、证据引用全现算。详见讲解卡。',
  bounds: [
    '光存原始观察不够，要定期巩固：把零散观察消化成高层洞察(反思/reflection)',
    '触发靠重要度累积过阈值(论文约150)：琐碎观察攒得慢、重要的催得快',
    '提炼时 LLM 综合观察成洞察 + 引用证据(可追溯，不是凭空)；洞察=高重要度新记忆，能被更高层反思→反思树',
    '和上下文压缩摘要不同:压缩为省token压最近的、反思为长期理解把零散的往上抽象。真实框架:Generative Agents',
  ],
  tabs: [{ id: 'rf', label: '反思逐步跑' }], Stage: ReflectionStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '洞察入库' }
    : s.stage === 'reflect' ? { key: 'good', label: '提炼洞察' }
    : s.stage === 'trigger' ? { key: 'bad', label: `触发 ${s.cum}≥${s.threshold}` }
    : s.stage === 'observe' ? { key: 'idle', label: `累计 ${s.cum}` }
    : { key: 'idle', label: `阈值 ${s.threshold}` }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => ({ intro: '始', observe: '攒', trigger: '触', reflect: '炼', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '反思阈值', value: `${s.threshold}（${s.thresholdKey}）` },
    { label: '累计重要度', value: `${s.cum} / ${s.threshold}`, tone: s.cum >= s.threshold ? 'bad' : undefined },
    { label: '洞察', value: s.insight ? s.insight.text.replace(/\*/g, '') : '—', tone: s.insight ? 'good' : undefined },
    { label: '证据', value: s.insight ? s.insight.evidence.join('、') : '—' },
  ],
}
const memwrite: Experiment<MemWState> = {
  id: 'memwrite', group: '大模型项目实战', title: '记忆写入 · 冲突消解', subtitle: '新事实→检索相似旧记忆→ADD/UPDATE/DELETE/NOOP，别让记忆自相矛盾',
  kernel: memwriteKernel, defaultDoc: { kind: 'memwrite', params: { mode: '四步' }, entities: [], streams: [] },
  params: [{ key: 'mode', label: '写入模式', kind: 'enum', options: ['四步', '单遍'] }],
  paramsNote: '检索是"读"、反思是"消化"，这一课是"写"——新信息来了记忆库怎么更新、又不自相矛盾。mem0 两阶段：抽取候选事实 → 每条**检索最相似旧记忆** → LLM 决定 **ADD(新建)/UPDATE(修正)/DELETE(删矛盾)/NOOP(去重)**。关键：不无脑追加，要**比对消解冲突**，否则"住北京"和"搬上海了"并存、记忆越用越脏。切「模式」：**四步**(mem0 论文，库始终自洽) vs **单遍 ADD-only**(现 OSS 默认，只加不改、简单但矛盾/陈旧越积越多)。冲突判定按相似度现算。详见讲解卡。',
  bounds: [
    '写记忆不是无脑追加：每条新事实先检索最相似旧记忆，再决定 ADD/UPDATE/DELETE/NOOP',
    'ADD 新建(无相似) · UPDATE 修正(补充/改) · DELETE 删矛盾(与旧记忆冲突) · NOOP 去重(已知道)',
    '四步(mem0 论文)库始终自洽;单遍 ADD-only(现 OSS 默认)只加不改、简单但矛盾陈旧越积越多(美式vs戒咖啡、3.10vs3.12 并存)',
    '靠向量相似度找"该改哪条"。Zep/Graphiti 用双时间知识图给旧事实打"失效时间"而非真删。真实框架:mem0/Zep',
  ],
  tabs: [{ id: 'mw', label: '写入逐条处理' }], Stage: MemWriteStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? (s.store.some(m => m.stale) ? { key: 'bad', label: `${s.store.filter(m => m.stale).length} 条陈旧矛盾` } : { key: 'good', label: `库自洽 ${s.store.length} 条` })
    : s.op === 'ADD' ? { key: 'good', label: 'ADD 新建' }
    : s.op === 'UPDATE' ? { key: 'idle', label: 'UPDATE 修正' }
    : s.op === 'DELETE' ? { key: 'bad', label: 'DELETE 删矛盾' }
    : s.op === 'NOOP' ? { key: 'idle', label: 'NOOP 去重' }
    : { key: 'idle', label: `模式 ${s.mode}` }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.cur + 2) / 5)),
  tickLabel: s => (s.cur < 0 ? '始' : s.op === 'ADD' ? '增' : s.op === 'UPDATE' ? '改' : s.op === 'DELETE' ? '删' : s.op === 'NOOP' ? '同' : '·'),
  readouts: s => [
    { label: '写入模式', value: s.mode },
    { label: '库大小', value: `${s.store.length} 条`, tone: s.store.some(m => m.stale) ? 'bad' : undefined },
    { label: '本步', value: s.cur < 0 ? '—' : `${s.fact ? `「${s.fact}」` : ''} → ${s.op}` },
    { label: '陈旧/矛盾', value: `${s.store.filter(m => m.stale).length} 条`, tone: s.store.some(m => m.stale) ? 'bad' : undefined },
  ],
}
const planning: Experiment<PlanState> = {
  id: 'planning', group: '大模型项目实战', title: '规划 · 计划模式 + Todo', subtitle: '先想后做：只读门→批准→Todo 状态机→复述防漂移',
  kernel: planningKernel, defaultDoc: { kind: 'planning', params: { mode: '计划门' }, entities: [], streams: [] },
  params: [{ key: 'mode', label: '计划模式', kind: 'enum', options: ['计划门', '建议'] }],
  paramsNote: '复杂任务先想后做，三个机制别只当"清单"：①**计划模式=硬门禁 vs 软建议**——Claude Code 在权限层把"写"堵死、批准计划前只能读(逼先看后动，bypass 才降级)，DeepSeek plan-mode 是纯建议、工具照调。②**Todo=状态机**——pending→in_progress→completed、**恰一个进行中**、整表替换(Opus4.8/Sonnet5+ 起换增量 TaskCreate/TaskUpdate+deleted)。③**复述=注意力操控**(最深)——每轮把整张 todo 贴回上下文近端、对抗长任务 lost-in-the-middle 漂移。现实岔开就**重规划**。切「模式」看 硬门禁 vs 软建议。门禁/状态机现算。详见讲解卡。',
  bounds: [
    '计划模式=硬门禁(权限层强制"批准前只读"，Claude Code) vs 软建议(工具照调，DeepSeek)——和沙箱/权限模式一脉',
    'Todo 状态机：pending→in_progress→completed，恰一个进行中；整表替换 或 增量 TaskCreate/TaskUpdate(+deleted)',
    '复述=注意力操控：每轮把整张 todo 贴回上下文近端，对抗长任务 lost-in-the-middle 漂移(不是记账、是摁住模型)',
    '计划是随现实滚动的活文档→重规划。延伸:plan mode 为何只读优先、architect/editor 双模型、ReAct vs Plan-and-Solve vs ToT。真实框架:Claude Code/Codex/DeepSeek/Aider',
  ],
  tabs: [{ id: 'pl', label: '规划逐步跑' }], Stage: PlanningStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '计划走完' }
    : s.stage === 'replan' ? { key: 'bad', label: '重规划·现实岔开' }
    : s.stage === 'exec' ? { key: 'good', label: '推进+复述' }
    : s.stage === 'exit' ? { key: 'good', label: '批准·写解锁' }
    : s.stage === 'planning' ? (s.writeBlocked ? { key: 'bad', label: '门禁挡下写' } : { key: 'idle', label: '计划中·可写' })
    : { key: 'idle', label: `${s.mode}` }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '始', planning: '拟', exit: '批', exec: '推', replan: '改', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '计划模式', value: `${s.mode}（${s.planMode ? '只读中' : '已解锁'}）`, tone: s.writeBlocked ? 'bad' : undefined },
    { label: 'Todo', value: s.todos.length ? `${s.todos.filter(t => t.status === 'done').length}✓ / ${s.todos.filter(t => t.status === 'active').length}◐ / ${s.todos.length} 总` : '—' },
    { label: '本步', value: s.op || (({ intro: '进入计划模式', done: '计划走完' } as Record<string, string>)[s.stage] ?? '—') },
    { label: '复述近端', value: s.recited ? '✓ 已贴回近端(防漂移)' : '—', tone: s.recited ? 'good' : undefined },
  ],
}
const promptbuild: Experiment<PBState> = {
  id: 'promptbuild', group: '大模型项目实战', title: '提示词组装 · 缓存友好排序', subtitle: '静态前排、动态后排；前缀命中缓存省 90%',
  kernel: promptbuildKernel, defaultDoc: { kind: 'promptbuild', params: { ordering: '静态优先' }, entities: [], streams: [] },
  params: [{ key: 'ordering', label: '排序', kind: 'enum', options: ['静态优先', '乱序'] }],
  paramsNote: 'Agent 每步都重拼 prompt。不是"拼字符串"，关键是**排序要缓存友好**(省钱算法核心)：前缀缓存是**最长相同前缀**匹配——覆盖 tools→system→messages 到断点为止，**断点及之前变一处、缓存全失效**、后面全价重算；**缓存读只 0.1× 基础价**(命中省 90%)。所以**静态排前、动态排后**、断点放"逐轮不变的最后一块"。经典翻车：把每轮变的(时间戳/运行时快照)塞进靠前的块→前缀每轮不同→永不命中。切「排序」看 静态优先(省44%) vs 乱序(省21%)。缓存命中/成本现算，和 KV 缓存同源。详见讲解卡。',
  bounds: [
    '前缀缓存=最长相同前缀匹配(tools→system→messages)；断点前变一处、后面全失效；缓存读只 0.1× 基础价',
    '静态排前(工具/身份/项目指令)、动态排后(运行时快照/历史/本轮)、断点放逐轮不变的最后一块',
    '经典翻车:把逐轮变的(时间戳/运行时快照)塞进靠前的块→前缀每轮不同→缓存永不命中、每轮全价',
    'Claude Code 把 CLAUDE.md 当独立 user 消息放后、DeepSeek 运行时快照当单独消息注入=护可缓存前缀。和 KV 缓存/上下文压缩(重放系统提示保前缀)同源',
  ],
  tabs: [{ id: 'pb', label: '组装逐步跑' }], Stage: PromptBuildStage, whyInRail: true,
  tone: s => (s.stage === 'done' || s.stage === 'turn2' ? { key: 'good', label: `省 ${Math.round((1 - s.turn2Cached / s.turn2Full) * 100)}%` }
    : s.stage === 'turn1' ? { key: 'idle', label: '第1轮写缓存' }
    : s.stage === 'assemble' ? { key: 'idle', label: `前缀 ${s.prefixTok}t 可缓存` }
    : { key: 'idle', label: `${s.ordering}` }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => ({ intro: '始', assemble: '排', turn1: '写', turn2: '读', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '排序', value: s.ordering },
    { label: '可缓存前缀 / 动态尾', value: `${s.prefixTok}t / ${s.tailTok}t`, tone: 'good' },
    { label: '第2轮成本', value: (s.stage === 'turn2' || s.stage === 'done') ? `等效 ${s.turn2Cached}t（全价 ${s.turn2Full}t）` : '—', tone: (s.stage === 'turn2' || s.stage === 'done') ? 'good' : undefined },
    { label: '省', value: (s.stage === 'turn2' || s.stage === 'done') ? `${Math.round((1 - s.turn2Cached / s.turn2Full) * 100)}%` : '—', tone: (s.stage === 'turn2' || s.stage === 'done') ? 'good' : undefined },
  ],
}
const lrucache: Experiment<LRUState> = {
  id: 'lrucache', group: '算法项目实战', title: '手写 LRU 缓存', subtitle: 'HashMap+双向链表，get/put 都 O(1)',
  kernel: lrucacheKernel, defaultDoc: { kind: 'lrucache', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。容量2跑 LeetCode 146 序列:HashMap(O(1)定位)+双向链表(头=最近/尾=最久)。get命中移到头、put满淘汰尾。链表顺序/淘汰/返回值可手核。详见讲解卡。',
  bounds: ['HashMap key→节点(O(1)定位)+双向链表(O(1)摘除/头插)→get/put都O(1)', 'get命中:返回值+把节点移到头部(最近)', 'put满(容量2):淘汰尾部(最久没用),新节点插头', '=Redis近似LRU/本地缓存;面试高频手写题'],
  tabs: [{ id: 'lru', label: 'put/get 全流程' }], Stage: LRUCacheStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: 'O(1) LRU' } : s.op === 'get' ? (s.hit ? { key: 'good', label: `命中 ${s.result}` } : { key: 'bad', label: '未命中' }) : s.evicted !== null ? { key: 'bad', label: `淘汰 ${s.evicted}` } : s.op === 'put' ? { key: 'idle', label: '插入' } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 10)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'get' ? (s.hit ? '中' : '空') : s.evicted !== null ? '汰' : s.op === 'put' ? '写' : '始'),
  readouts: s => [
    { label: '本步', value: s.opDesc || '就绪' },
    { label: '链表(头→尾)', value: s.list.length ? s.list.map(n => `${n.k}:${n.v}`).join('→') : '空' },
    { label: '结果', value: s.op === 'get' ? (s.result === -1 ? '-1(未命中)' : `${s.result}`) : s.evicted !== null ? `淘汰${s.evicted}` : '插入', tone: s.op === 'get' ? (s.hit ? 'good' : 'bad') : s.evicted !== null ? 'bad' : undefined },
    { label: '占用', value: `${s.list.length}/${s.capacity}` },
  ],
}
const happensbefore: Experiment<HBState> = {
  id: 'happensbefore', group: '并发编程', title: 'happens-before 可见性', subtitle: '无同步读到旧值，volatile 建立可见有序',
  kernel: happensbeforeKernel, defaultDoc: { kind: 'happensbefore', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。flag/data 经典例:writer 先 data=42 再 ready=true,reader 见 ready 读 data。无volatile→重排/可见性→读到0;ready声明volatile建立happens-before→保证读到42。两幕对照,可核。详见讲解卡。',
  bounds: ['无同步:编译器/CPU重排+值滞留缓存→写不一定按序及时可见', 'reader见ready=true却读到data=0(旧值):经典可见性bug', 'ready声明volatile:写=释放屏障/读=获取屏障→建立happens-before', 'data=42先于reader读data被保证→读到42;=JMM核心'],
  tabs: [{ id: 'hb', label: '读到0→修复42' }], Stage: HBStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '保证读到42' } : s.readerData === 0 ? { key: 'bad', label: '读到旧值0' } : s.act === 'plain' ? { key: 'bad', label: '无屏障' } : s.act === 'volatile' ? { key: 'good', label: 'volatile' } : { key: 'idle', label: '引入' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 7)),
  tickLabel: s => (s.phase === 'done' ? '修' : s.readerData === 0 ? '0' : s.readerData === 42 ? '42' : s.who === 'writer' ? '写' : s.who === 'reader' ? '读' : s.act === 'volatile' ? 'V' : '始'),
  readouts: s => [
    { label: '演示', value: s.act === 'intro' ? '引入' : s.act === 'plain' ? '① 无 volatile' : '② volatile' },
    { label: 'ready', value: `${s.isVolatile ? 'volatile ' : ''}${s.ready}` },
    { label: 'reader 读 data', value: s.readerData < 0 ? '—' : `${s.readerData}`, tone: s.readerData === 0 ? 'bad' : s.readerData === 42 ? 'good' : undefined },
    { label: '同步', value: s.isVolatile ? 'happens-before' : '无屏障' },
  ],
}
const aba: Experiment<ABAState> = {
  id: 'aba', group: '并发编程', title: 'ABA 问题', subtitle: 'CAS 被 A→B→A 骗，版本号识破',
  kernel: abaKernel, defaultDoc: { kind: 'aba', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。演示 CAS 的 ABA 陷阱:T1读A挂起→T2把A→B→A→T1恢复CAS。无版本:期望100当前100→误判成功;加版本号:期望(100,v1)当前(100,v3)→版本不符正确失败。可手核。详见讲解卡。',
  bounds: ['CAS靠"当前值==读到的旧值"判没人动过', '值A→B→A绕回:无版本CAS只比值→误判成功(bug)', '加单调递增版本号:值同但版本v1≠v3→CAS正确失败', '=AtomicStampedReference/tagged pointer;无锁栈队列必备'],
  tabs: [{ id: 'aba', label: '误判→修复' }], Stage: ABAStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '版本号识破' } : s.casOk === true ? { key: 'bad', label: 'ABA 误判' } : s.act === 'buggy' ? { key: 'idle', label: '无版本' } : s.act === 'fixed' ? { key: 'idle', label: '有版本' } : { key: 'idle', label: 'CAS' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 9)),
  tickLabel: s => (s.phase === 'done' ? '修' : s.op === 'cas' ? (s.casOk ? '✗' : '✓') : s.op === 'change' ? '改' : s.op === 'read' ? '读' : '始'),
  readouts: s => [
    { label: '演示', value: s.act === 'intro' ? '引入' : s.act === 'buggy' ? '① 无版本' : '② 加版本号' },
    { label: '共享值', value: s.act === 'fixed' ? `${s.value}/v${s.version}` : `${s.value}` },
    { label: 'T1 记忆', value: s.t1Read < 0 ? '—' : (s.act === 'fixed' ? `${s.t1Read}/v${s.t1Ver}` : `${s.t1Read}`) },
    { label: 'CAS', value: s.casOk === null ? '—' : s.casOk ? '误判成功✗' : '正确失败✓', tone: s.casOk === true ? 'bad' : s.casOk === false ? 'good' : undefined },
  ],
}
const rwlock: Experiment<RWLockState> = {
  id: 'rwlock', group: '并发编程', title: '读写锁 RWLock', subtitle: '读读共享、读写/写写互斥',
  kernel: rwlockKernel, defaultDoc: { kind: 'rwlock', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。多读者共享读锁、写者独占。请求序列 R1读/R2读/W1写(阻塞)/R1解/R2解/W1获准/R3读(阻塞)/W1解,看持有者与等待队列。可手核。详见讲解卡。',
  bounds: ['读读共享:多读者同时持读锁,读并发不阻塞', '读写/写写互斥:写者独占,有读者/写者就阻塞排队', 'W1请求写→有读者R1R2→排队;读者全释放才轮到W1独占', '读多写少吞吐高;防写饥饿(公平锁);=ReentrantReadWriteLock/RWMutex/S锁X锁'],
  tabs: [{ id: 'rw', label: '加解锁流转' }], Stage: RWLockStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '读共享写独占' } : s.op === 'grantR' ? { key: 'good', label: '读获准' } : s.op === 'grantW' ? { key: 'bad', label: '写独占' } : s.op === 'block' ? { key: 'bad', label: '阻塞排队' } : s.op === 'release' ? { key: 'idle', label: '释放' } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 9)),
  tickLabel: s => (s.phase === 'done' ? '结' : s.op === 'grantR' ? '读' : s.op === 'grantW' ? '写' : s.op === 'block' ? '等' : s.op === 'release' ? '放' : '始'),
  readouts: s => [
    { label: '读锁', value: s.readers.length ? `{${s.readers.join(',')}}` : '无', tone: s.readers.length ? 'good' : undefined },
    { label: '写锁', value: s.writer || '无', tone: s.writer ? 'bad' : undefined },
    { label: '等待队列', value: s.waitQ.length ? s.waitQ.map(w => `${w.who}(${w.type})`).join(',') : '空' },
    { label: '本步', value: s.event || '就绪' },
  ],
}
const compositeindex: Experiment<CIndexState> = {
  id: 'compositeindex', group: '数据库系统', title: '复合索引·最左前缀', subtitle: 'idx(a,b,c) 走不走索引、要不要回表',
  kernel: compositeindexKernel, defaultDoc: { kind: 'compositeindex', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。复合索引 idx(a,b,c),6 条查询逐条判:最左前缀(从a起连续等值才能定位,跳列/断层用不上)+覆盖索引(SELECT列全在索引里就免回表)。规则可手核。详见讲解卡。',
  bounds: ['最左前缀:WHERE从a起连续命中才走索引;WHERE b=跳过a→全表扫', 'WHERE a AND c(b断)→只用到a', '覆盖:SELECT列全在(a,b,c)→不回表;含d→回表', '=EXPLAIN里key=idx vs type=ALL;建索引要卡列顺序'],
  tabs: [{ id: 'idx', label: '逐条查询判' }], Stage: CIndexStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '两规则' } : s.op === 'query' ? (s.usesIndex ? (s.covering ? { key: 'good', label: '走索引·不回表' } : { key: 'idle', label: '走索引·回表' }) : { key: 'bad', label: '全表扫' }) : { key: 'idle', label: 'idx(a,b,c)' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 8)),
  tickLabel: s => (s.phase === 'done' ? '结' : s.op === 'query' ? (s.usesIndex ? 'Q' : '扫') : '始'),
  readouts: s => [
    { label: '查询', value: s.op === 'query' ? `Q${s.qi + 1}` : (s.phase === 'done' ? '总结' : '就绪') },
    { label: '最左前缀', value: s.op === 'query' ? (s.usesIndex ? `用(${s.prefix.join(',')})` : '全表扫') : '—', tone: s.op === 'query' ? (s.usesIndex ? 'good' : 'bad') : undefined },
    { label: '覆盖', value: s.op === 'query' && s.usesIndex ? (s.covering ? '不回表' : '回表') : '—', tone: s.op === 'query' && s.usesIndex && s.covering ? 'good' : undefined },
    { label: '已判', value: `${s.history.length}/6` },
  ],
}
const joins: Experiment<JoinState> = {
  id: 'joins', group: '数据库系统', title: '三种 JOIN 算法', subtitle: '嵌套循环 / 哈希 / 排序归并，代价对比',
  kernel: joinsKernel, defaultDoc: { kind: 'joins', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。同一对表 Users⋈Orders(3个匹配),依次走 NLJ(3×4=12次)、Hash(建3+探4=7)、Sort-Merge(归并7步)。优化器按表大小/索引/等值vs范围/是否要有序来选。代价可手核。详见讲解卡。',
  bounds: ['NLJ:外表每行×内表每行=|N|×|M|=12次,任意条件但O(N×M)会爆', 'Hash:小表build+大表probe=N+M=7,等值连接主力但吃内存', 'Sort-Merge:排序+归并=N+M=7步,已排序/要有序/范围连接最好', 'EXPLAIN 里为什么Hash Join还是Nested Loop=这三种代价的估算'],
  tabs: [{ id: 'join', label: '三算法走一遍' }], Stage: JoinsStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: 'Hash/SMJ 更省' } : s.algo === 'nlj' ? { key: 'bad', label: `NLJ ${s.cost}次` } : s.algo === 'hash' ? { key: 'good', label: s.op === 'build' ? 'build' : 'probe' } : s.algo === 'smj' ? { key: 'idle', label: s.op === 'sort' ? '排序' : '归并' } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 7)),
  tickLabel: s => (s.phase === 'done' ? '比' : s.algo === 'nlj' ? 'N' : s.algo === 'hash' ? 'H' : s.algo === 'smj' ? 'S' : '始'),
  readouts: s => [
    { label: '算法', value: s.algo === 'none' ? (s.phase === 'done' ? '代价对比' : '就绪') : s.algo === 'nlj' ? 'Nested Loop' : s.algo === 'hash' ? 'Hash Join' : 'Sort-Merge' },
    { label: '阶段', value: s.op === 'build' ? 'build' : s.op === 'probe' ? 'probe' : s.op === 'sort' ? '排序' : s.op === 'merge' ? '归并' : s.op === 'nlj' ? '嵌套循环' : '—' },
    { label: '代价', value: s.cost > 0 ? `${s.cost}` : (s.phase === 'done' ? 'NLJ12/Hash7/SMJ7' : '—') },
    { label: '匹配行', value: `${s.matches.length}`, tone: s.matches.length ? 'good' : undefined },
  ],
}
const circuitbreaker: Experiment<BreakerState> = {
  id: 'circuitbreaker', group: '分布式系统', title: '熔断器状态机', subtitle: 'Closed/Open/Half-Open 防级联雪崩',
  kernel: circuitbreakerKernel, defaultDoc: { kind: 'circuitbreaker', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。三态机:Closed(累计失败,≥阈值3跳Open)→Open(快速失败不打下游,超时进Half-Open)→Half-Open(探测,成功回Closed/失败退Open)。一串请求成败驱动流转,可手核。详见讲解卡。',
  bounds: ['Closed:正常放行+累计失败;失败≥阈值3→跳Open', 'Open:请求快速失败(不打下游),超时→Half-Open', 'Half-Open:放探测,成功→Closed(计数清零)/失败→Open', '防级联雪崩;配超时+降级=微服务容错标配(Hystrix/Sentinel)'],
  tabs: [{ id: 'fsm', label: '状态流转' }], Stage: BreakerStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '恢复 Closed' } : s.op === 'trip' ? { key: 'bad', label: '跳闸熔断' } : s.op === 'reject' ? { key: 'bad', label: '快速失败' } : s.op === 'timeout' || s.op === 'probe' ? { key: 'idle', label: '试探' } : s.cstate === 'closed' ? { key: s.outcome === '失败' ? 'bad' : 'good', label: `失败${s.fails}/${s.threshold}` } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 9)),
  tickLabel: s => (s.phase === 'done' ? '复' : s.op === 'trip' ? '闸' : s.op === 'reject' ? '拒' : s.op === 'timeout' ? '时' : s.op === 'probe' ? '探' : s.cstate === 'open' ? 'O' : s.outcome === '失败' ? '✗' : '✓'),
  readouts: s => [
    { label: '状态', value: s.cstate === 'closed' ? 'Closed(正常)' : s.cstate === 'open' ? 'Open(熔断)' : 'Half-Open(试探)', tone: s.cstate === 'closed' ? 'good' : s.cstate === 'open' ? 'bad' : undefined },
    { label: '失败计数', value: `${s.fails}/${s.threshold}` },
    { label: '本步', value: s.outcome || '就绪' },
    { label: '下游', value: s.cstate === 'open' ? '受保护(不被打)' : s.cstate === 'halfopen' ? '被试探' : '正常调用' },
  ],
}
const quorum: Experiment<QuorumState> = {
  id: 'quorum', group: '分布式系统', title: 'Quorum NWR', subtitle: 'W+R>N 保证读到最新写（可调一致性）',
  kernel: quorumKernel, defaultDoc: { kind: 'quorum', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。N=5副本,写W=3份、读R=3份,取读到的最新版本。W+R>N(6>5)时读写集必重叠(鸽巢)→读到最新;反例R=2(W+R=5≤5)可能无重叠读到旧值。详见讲解卡。',
  bounds: ['N=5,写W=3份确认即成功,读R=3份取最新版本', 'W+R=6>5→读写集必重叠(鸽巢原理)→读到最新v2', '反例R=2→读集{R3,R4}零重叠→读到旧v1', '旋钮:W大读快写慢/R大反之/W=R=N强一致最慢=Dynamo可调一致性'],
  tabs: [{ id: 'nwr', label: '写读重叠' }], Stage: QuorumStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'bad', label: '反例:读旧值' } : s.op === 'verdict' ? { key: 'good', label: '读到最新' } : s.op === 'read' ? { key: 'idle', label: '读R份' } : s.op === 'write' ? { key: 'idle', label: '写W份' } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.op === 'counter' ? '反' : s.op === 'verdict' ? '✓' : s.op === 'write' ? '写' : s.op === 'read' ? '读' : s.op === 'init' ? '始' : 'N'),
  readouts: s => [
    { label: 'N/W/R', value: `${s.N}/${s.W}/${s.op === 'counter' ? 2 : s.R}` },
    { label: 'W+R vs N', value: `${s.op === 'counter' ? s.W + 2 : s.W + s.R} vs ${s.N}`, tone: s.op === 'counter' ? 'bad' : (s.W + s.R > s.N ? 'good' : 'bad') },
    { label: '读写重叠', value: s.overlap.length ? `R${s.overlap.join(',R')}` : (s.op === 'counter' ? '无' : '—'), tone: s.overlap.length ? 'good' : (s.op === 'counter' ? 'bad' : undefined) },
    { label: '读到', value: s.readVer > 0 ? `v${s.readVer}(${s.readVal})` : '—', tone: s.readVer === 2 ? 'good' : s.readVer === 1 ? 'bad' : undefined },
  ],
}
const vectorclock: Experiment<VClockState> = {
  id: 'vectorclock', group: '分布式系统', title: '向量时钟', subtitle: '判分布式事件：因果先行 vs 并发',
  kernel: vectorclockKernel, defaultDoc: { kind: 'vectorclock', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。三进程各持向量 V=[P0,P1,P2]:本地事件自己+1、发消息带走向量、收消息逐位max后自己+1。判定:每位≤且不全等=因果先行,互不≤=并发。末步比 a→e(因果)、f/e(并发)。逐位可手核。详见讲解卡。',
  bounds: ['规则:本地+1 / 发消息带向量 / 收消息逐位max再+1', 'a[1,0,0]→e[2,2,1]:每位≤→因果先行(a→b→c→d→e)', 'f[3,0,0]与e[2,2,1]:互不≤→并发', '不靠物理时间判先后;用于因果一致性/冲突检测(Dynamo)'],
  tabs: [{ id: 'vc', label: '事件推进' }], Stage: VClockStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '因果/并发已判' } : s.op === 'recv' ? { key: 'good', label: `${['P0', 'P1', 'P2'][s.proc]} max` } : s.op === 'send' ? { key: 'idle', label: '发消息' } : s.op === 'local' ? { key: 'idle', label: `事件${s.label}` } : { key: 'idle', label: '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 8)),
  tickLabel: s => (s.phase === 'done' ? '判' : s.label || '钟'),
  readouts: s => [
    { label: 'V0', value: `[${s.clocks[0]!.join(',')}]` },
    { label: 'V1', value: `[${s.clocks[1]!.join(',')}]` },
    { label: 'V2', value: `[${s.clocks[2]!.join(',')}]` },
    { label: '本步', value: s.label ? `事件 ${s.label}` : s.op === 'compare' ? '判先后' : '就绪', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}
const snowflake: Experiment<SnowflakeState> = {
  id: 'snowflake', group: '分布式系统', title: '雪花算法分布式ID', subtitle: '64位=时间戳+机器码+序号，各机自拼、全局唯一',
  kernel: snowflakeKernel, defaultDoc: { kind: 'snowflake', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。64位切三段:[1符号][41时间戳][10机器码][12序号]。同毫秒序号自增、新毫秒归零;时间戳在高位保证趋势递增,机器码保证不同机不撞。ID=时间戳<<22|机器<<12|序号,可逐段手核。详见讲解卡。',
  bounds: ['64位=1符号+41时间戳+10机器码+12序号', '同毫秒:序号自增(4096个/ms/机);新毫秒:序号归零', '时间戳高位→趋势递增(B+树友好);机器码不同→不撞;零协调', '风险:时钟回拨会生成重复ID,要检测拒发'],
  tabs: [{ id: 'id', label: '逐个生成' }], Stage: SnowflakeStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '唯一+递增' } : s.op === 'same' ? { key: 'idle', label: `序号${s.seq}` } : s.op === 'next' ? { key: 'good', label: '新毫秒' } : s.op === 'gen' ? { key: 'idle', label: '首个ID' } : { key: 'idle', label: '看布局' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'same' ? '+1' : s.op === 'next' ? '新' : s.op === 'gen' ? '发' : '局'),
  readouts: s => [
    { label: '时间戳', value: s.op === 'intro' ? '—' : `${s.t}ms` },
    { label: '机器码', value: `${s.machine} (dc${s.dc}·w${s.worker})` },
    { label: '序号', value: s.op === 'intro' ? '—' : `#${s.seq}` },
    { label: 'ID', value: s.op === 'intro' ? '—' : `${s.id}`, tone: s.phase === 'done' ? 'good' : undefined },
  ],
}
const totp: Experiment<TotpState> = {
  id: 'totp', group: '密码学', title: 'TOTP 动态口令', subtitle: '共享密钥+时间窗：离线算出同一个6位码',
  kernel: totpKernel, defaultDoc: { kind: 'totp', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。码 = 截断(HMAC(K, ⌊t/30⌋))：时间按30秒切窗口，同窗不变、换窗即变。手机和服务器不通信却算出同一个码(共享K+当前时间)。玩具HMAC=FNV mod 10⁶，码可复算。详见讲解卡。',
  bounds: ['码=截断(HMAC(密钥,时间窗T)),T=⌊t/30⌋', 't=0/15/29s同窗→790815不变;t=30s换窗→094198', '手机与服务器不通信:靠共享K+当前时间各自算', '服务器容时钟差校验T-1/T/T+1;真实=RFC6238'],
  tabs: [{ id: 'otp', label: '随时间翻码' }], Stage: TotpStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '验证通过' } : s.op === 'next' ? { key: 'good', label: '换新码' } : s.op === 'same' ? { key: 'idle', label: '码不变' } : s.op === 'code' ? { key: 'idle', label: s.code } : { key: 'idle', label: '看目标' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => (s.phase === 'done' ? '验' : s.op === 'next' ? '翻' : s.op === 'same' ? '守' : s.op === 'code' ? String(s.T) : '标'),
  readouts: s => [
    { label: '时间', value: `${s.t}s` },
    { label: '时间窗', value: `T=${s.T}` },
    { label: '6 位码', value: s.code || '——', tone: s.op === 'next' || s.phase === 'done' ? 'good' : undefined },
    { label: '和上一步', value: s.op === 'same' ? '同窗·不变' : s.op === 'next' ? '换窗·翻新' : '—' },
  ],
}
const hmac: Experiment<HmacState> = {
  id: 'hmac', group: '密码学', title: 'HMAC 消息认证', subtitle: '密钥+嵌套哈希：防伪造又防篡改',
  kernel: hmacKernel, defaultDoc: { kind: 'hmac', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。HMAC(K,m)=H((K⊕opad)‖H((K⊕ipad)‖m))：密钥在内外两层各揉一次，堵住 H(K‖m) 的长度扩展攻击。用玩具哈希 h=(h*31+b) mod 256，结构真实、可跟。末步演示改一字节标签就对不上。详见讲解卡。',
  bounds: ['直接H(m)无密钥谁都能算;H(K‖m)有长度扩展攻击', 'HMAC两层嵌套:K⊕ipad→内层H→K⊕opad→外层H', 'K⊕ipad/opad异或可手核;K=Key1、m=Hi→HMAC=05', '篡改m→标签05变06,收方一比对就拒收;真实用HMAC-SHA256'],
  tabs: [{ id: 'mac', label: '嵌套两层' }], Stage: HmacStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `标签 ${s.mac >= 0 ? s.mac.toString(16).padStart(2, '0') : ''}` } : s.op === 'intro' ? { key: 'idle', label: '看目标' } : { key: 'idle', label: s.op === 'ipad' ? 'K⊕ipad' : s.op === 'inner' ? '内层H' : s.op === 'opad' ? 'K⊕opad' : '外层H' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'inner' || s.op === 'outer' ? 'H' : s.op === 'ipad' || s.op === 'opad' ? '⊕' : '标'),
  readouts: s => [
    { label: '本步', value: s.op === 'intro' ? '看目标' : s.op === 'ipad' ? 'K⊕ipad' : s.op === 'inner' ? '内层哈希' : s.op === 'opad' ? 'K⊕opad' : s.op === 'outer' ? '外层哈希' : '篡改验证' },
    { label: '内层 inner', value: s.inner >= 0 ? s.inner.toString(16).padStart(2, '0') : '—' },
    { label: 'HMAC 标签', value: s.mac >= 0 ? s.mac.toString(16).padStart(2, '0') : '—', tone: s.phase === 'done' ? 'good' : undefined },
    { label: '篡改后', value: s.tamperMac >= 0 ? `${s.tamperMac.toString(16).padStart(2, '0')}(对不上)` : '—', tone: s.tamperMac >= 0 ? 'bad' : undefined },
  ],
}
const aesround: Experiment<AesState> = {
  id: 'aesround', group: '密码学', title: 'AES 一轮', subtitle: 'SubBytes→ShiftRows→MixColumns→AddRoundKey',
  kernel: aesroundKernel, defaultDoc: { kind: 'aesround', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。16 字节明文摆成 4×4 状态矩阵，走一轮 AES 四步变换。用 FIPS-197 官方向量，每个字节对标标准：SubBytes(混淆)/ShiftRows/MixColumns(扩散)/AddRoundKey(密钥)。详见讲解卡。',
  bounds: ['明文3243f6a8…、密钥2b7e1516…(FIPS-197向量,可对标)', 'SubBytes查S盒(非线性混淆)、ShiftRows行移位、MixColumns列GF混合(扩散)', 'AddRoundKey逐字节异或密钥;一轮末=a49c7ff2…(FIPS对标)', 'AES-128共10轮(末轮省MixColumns)'],
  tabs: [{ id: 'round', label: '四步变换' }], Stage: AesRoundStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '一轮完成' } : s.op === 'intro' ? { key: 'idle', label: '摆矩阵' } : { key: 'idle', label: s.op === 'sub' ? 'SubBytes' : s.op === 'shift' ? 'ShiftRows' : s.op === 'mix' ? 'MixColumns' : 'AddRoundKey' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'sub' ? 'S' : s.op === 'shift' ? '移' : s.op === 'mix' ? '混' : s.op.startsWith('addkey') ? '⊕' : '摆'),
  readouts: s => [
    { label: '本步', value: s.op === 'intro' ? '摆状态矩阵' : s.op === 'sub' ? 'SubBytes' : s.op === 'shift' ? 'ShiftRows' : s.op === 'mix' ? 'MixColumns' : 'AddRoundKey' },
    { label: '作用', value: s.op === 'sub' ? '非线性混淆(S盒)' : s.op === 'shift' || s.op === 'mix' ? '扩散' : s.op.startsWith('addkey') ? '混入密钥(异或)' : '就绪' },
    { label: '状态首字节', value: s.mat.length ? s.mat[0]!.toString(16).padStart(2, '0') : '—' },
    { label: '轮数', value: s.phase === 'done' ? '1/10 轮(共10轮)' : '轮 1 进行中' },
  ],
}
const birthday: Experiment<BirthdayState> = {
  id: 'birthday', group: '密码学', title: '生日攻击', subtitle: '找哈希碰撞只要约 √N 次，不是 N 次',
  kernel: birthdayKernel, defaultDoc: { kind: 'birthday', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。往 N=365 天里逐个加人，看"至少两人同天"的概率：23 人就过半(生日悖论)。映射到哈希：n 位输出找碰撞只要约 2^(n/2) 次，所以抗碰撞位数要翻倍。详见讲解卡。',
  bounds: ['能相撞的对数 C(k,2)≈k²/2,概率按 k² 涨得快', '23人→50.7%、41→90%、57→99%(可核)', 'n位哈希碰撞约 √(2ⁿ)=2^(n/2) 次,非 2ⁿ', 'MD5/SHA-1被攻破;抗碰撞要SHA-256(碰撞2¹²⁸)'],
  tabs: [{ id: 'prob', label: '概率飙升' }], Stage: BirthdayStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '√N 规律' } : s.crossed50 ? { key: 'bad', label: `${Math.round(s.pColl * 100)}%` } : { key: 'idle', label: `${s.k}人` }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, s.pColl)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.crossed50 ? '半' : String(s.k)),
  readouts: s => [
    { label: '人数', value: `${s.k}` },
    { label: '可撞对数', value: `C(${s.k},2)=${s.pairs}` },
    { label: '碰撞概率', value: `${(s.pColl * 100).toFixed(1)}%`, tone: s.crossed50 ? (s.phase === 'done' ? 'good' : 'bad') : undefined },
    { label: '哈希含义', value: s.phase === 'done' ? 'n位→碰撞2^(n/2)' : '√N 次即可' },
  ],
}
const wal: Experiment<WALState> = {
  id: 'wal', group: '数据库系统', title: '预写日志 WAL', subtitle: '先写日志后改数据，崩溃能恢复',
  kernel: walKernel, defaultDoc: { kind: 'wal', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。写 x=5(先日志后应用)、写 x=8(只写日志就崩溃) → 重启重放日志，x 恢复成 8。详见讲解卡。',
  bounds: ['先日志后数据(预写)', '崩溃在日志已落盘、数据页未改时', '重启重放日志→x恢复成8(可核)', '持久性D的实现;MySQL redo/PG WAL/etcd用它'],
  tabs: [{ id: 'wal', label: '日志+数据' }], Stage: WALStage, whyInRail: true,
  tone: s => (s.crashed ? { key: 'bad', label: '宕机' } : s.phase === 'done' ? { key: 'good', label: `恢复 x=${s.data}` } : { key: 'idle', label: s.act === 'replay' ? '重放' : s.act === 'log' ? '写日志' : '改数据' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.crashed ? '💥' : s.phase === 'done' ? '毕' : s.act === 'replay' ? '放' : s.act === 'log' ? '志' : '据'),
  readouts: s => [{ label: '本步', value: s.crashed ? '💥宕机' : s.act === 'replay' ? '重放恢复' : s.act === 'log' ? '写日志' : s.act === 'apply' ? '改数据' : '完成' }, { label: '数据页 x', value: `${s.data}` }, { label: '日志条数', value: `${s.wal.length}` }, { label: '已应用', value: `${s.applied}`, tone: s.phase === 'done' ? 'good' : undefined }],
}
const lsm: Experiment<LSMState> = {
  id: 'lsm', group: '数据库系统', title: 'LSM-Tree', subtitle: '写进内存、批量顺序刷盘',
  kernel: lsmKernel, defaultDoc: { kind: 'lsm', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '无可调参数。memtable 容量 3：写 a/b/c 满→刷成 SSTable1；再写 d/e。随机写换成顺序写。详见讲解卡。',
  bounds: ['memtable容量3;写a/b/c/d/e', '写进内存表,满了整块顺序刷SSTable(可核)', 'a/b/c→SSTable1,memtable剩d/e', '写吞吐暴涨;LevelDB/RocksDB/Cassandra用它'],
  tabs: [{ id: 'lsm', label: '内存表+SSTable' }], Stage: LSMStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `${s.sstables.length} SSTable` } : { key: 'idle', label: s.act === 'flush' ? '刷盘' : `写${s.cur}` }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 8)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.act === 'flush' ? '刷' : s.cur || '写'),
  readouts: s => [{ label: '本步', value: s.act === 'flush' ? '刷成 SSTable' : s.act === 'write' ? `写 ${s.cur}` : '完成' }, { label: 'memtable', value: `[${s.memtable.join(',')}] ${s.memtable.length}/${s.cap}` }, { label: 'SSTable 数', value: `${s.sstables.length}`, tone: s.phase === 'done' ? 'good' : undefined }, { label: '写模式', value: '顺序写(快)' }],
}

const minikv: Experiment<MiniKVState> = {
  id: 'minikv', group: '项目实战', title: '迷你 KV 存储', subtitle: '把 WAL+跳表+LSM+布隆 拼成一个数据库',
  kernel: minikvKernel, defaultDoc: { kind: 'minikv', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '组合式项目：一条 put/get 流水把五个零件（WAL/memtable跳表/LSM/布隆/一致性哈希）拼成迷你数据库。面试能讲的「我造过 X」。详见讲解卡。',
  bounds: ['put:先WAL→memtable→满了刷SSTable+入布隆', 'get:先问布隆(说没有就不查盘)→memtable→SSTable', 'get(a)走磁盘命中;get(z)被布隆挡下(可核)', '=LevelDB/RocksDB骨架;面试项目叙事'],
  tabs: [{ id: 'kv', label: '写读全流程' }], Stage: MiniKVStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: 'KV 跑通' }
    : s.op === 'get' ? (s.result === '不存在' ? { key: 'bad', label: '布隆挡下' } : { key: 'good', label: `读到 ${s.result}` })
      : s.op === 'compact' ? { key: 'good', label: '压实去旧' }
        : s.op === 'update' ? { key: 'idle', label: `更新 ${s.key}` }
          : s.op === 'flush' ? { key: 'good', label: '刷盘' } : { key: 'idle', label: `写 ${s.key}` }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 14)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'get' ? '读' : s.op === 'flush' ? '刷' : s.op === 'compact' ? '压' : s.op === 'update' ? '改' : '写'),
  readouts: s => [
    { label: '本步', value: s.op === 'put' ? `put(${s.key},${s.val})` : s.op === 'update' ? `更新 ${s.key}=${s.val}` : s.op === 'get' ? `get(${s.key})` : s.op === 'flush' ? '刷 SSTable' : s.op === 'compact' ? '压实归并' : '完成' },
    { label: 'memtable', value: `[${s.memtable.map(e => `${e[0]}=${e[1]}`).join(',')}]` },
    { label: 'SSTable', value: s.sstables.length ? s.sstables.map((x, i) => `SST${i + 1}[${x.map(e => e[0]).join('')}]`).join(' ') : '0 个' },
    { label: 'get 结果', value: s.op === 'get' ? `${s.result}${s.bloomHit ? ` (在${s.foundIn})` : '(布隆挡下)'}` : '—', tone: s.op === 'get' ? (s.result === '不存在' ? 'bad' : 'good') : undefined },
  ],
}

const urlshortener: Experiment<UrlState> = {
  id: 'urlshortener', group: '系统设计', title: '设计短链系统', subtitle: '真仿真：发号器 + Base62 编码/解码跳转',
  kernel: urlshortenerKernel, defaultDoc: { kind: 'urlshortener', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '短链的核心机制——短码怎么生成。真发号+真 Base62 编码：全局发号器发自增 ID（唯一不碰撞）→ Base62 编码成短码（1 亿→"6LAze"只 5 位）；访问时短码解码回 ID 查库 302 跳转。编码/解码逐位可手核。',
  bounds: ['短码=发号器自增ID(唯一不碰撞) + Base62编码(0-9a-zA-Z共62字符,比十进制短)', '编码:不断取余62映射字符、商继续、倒序;解码按62进制累加回ID(可逆)', '为什么不用哈希:会碰撞要处理冲突;为什么不用十进制明文:能被顺号爬遍', '6位Base62=62^6≈568亿码;读多写少100:1→热点码进缓存;302可统计vs301永久'],
  tabs: [{ id: 'design', label: '发号+编码' }], Stage: UrlStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '机制走完' } : { key: 'idle', label: s.phase === 'issue' ? '发号+编码' : s.phase === 'redirect' ? '解码跳转' : s.phase === 'capacity' ? '容量估算' : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.phase === 'issue' ? '号' : s.phase === 'redirect' ? '跳' : s.phase === 'capacity' ? '容' : '短'),
  readouts: s => [
    { label: '发号器下一号', value: s.counter.toLocaleString() },
    { label: '已建短链', value: `${s.entries.length} 条` },
    { label: '最新短码', value: s.entries.length ? s.entries[s.entries.length - 1]!.code : '—' },
    { label: '6位码容量', value: `62⁶≈${(s.capacity / 1e8).toFixed(0)}亿` },
  ],
}

const minisearch: Experiment<SearchState> = {
  id: 'minisearch', group: '项目实战', title: 'mini 搜索引擎', subtitle: '倒排索引 + TF-IDF 打分排序',
  kernel: minisearchKernel, defaultDoc: { kind: 'minisearch', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '组合式项目：从三篇小文档建倒排索引，查询走 TF-IDF 打分排序。语料小到能手算——tf 和 idf 两个效应都看得见。面试能讲的「我造过搜索引擎」。详见讲解卡。',
  bounds: ['建倒排索引:词→出现在哪些文档(×词频),查询不扫全库', 'idf=ln(N/df):稀有词权重高(狗 idf=1.10 > 猫 0.41)', 'score=Σ tf×idf:D2靠稀有词赢、D3靠词频超D1', '结果 D2>D3>D1 全由代码从语料算出(可核)'],
  tabs: [{ id: 'search', label: '建索引→查询打分' }], Stage: SearchStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `Top: ${s.scores[0]?.id ?? '—'}` }
    : s.query.length ? { key: 'idle', label: s.stage.replace(/^[①②③④⑤⑥⑦]\s*/, '') }
      : { key: 'idle', label: s.reading ? `读入 ${s.reading}` : '备料' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 9)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.query.length ? (s.scores.length ? '分' : s.idf.length ? 'idf' : '查') : s.reading ? s.reading.slice(1) : '料'),
  readouts: s => [
    { label: '阶段', value: s.stage.replace(/^[①②③④⑤⑥⑦]\s*/, '') || '就绪' },
    { label: '倒排规模', value: `${s.index.length} 词` },
    { label: '候选', value: s.candidates.length ? `{${s.candidates.join(',')}}` : '—' },
    { label: '最相关', value: s.scores.length ? `${s.scores[0].id} (${(Math.round(s.scores[0].score * 100) / 100).toFixed(2)})` : '—', tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const seckill: Experiment<SeckillState> = {
  id: 'seckill', group: '系统设计', title: '设计秒杀系统', subtitle: '防超卖真仿真：读改写竞态 vs 原子 DECR',
  kernel: seckillKernel, defaultDoc: { kind: 'seckill', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '系统设计高频题的核心机制——防超卖。真跑并发扣库存：naive「读→判>0→写」不原子会超卖（库存 2 却卖出 3、库存变 -1），Redis 原子 DECR 挡住（卖出恰好 2）。库存/卖出/是否超卖全由交错真跑出来，不是背结论。',
  bounds: ['红线=绝不超卖;难点是"读→判>0→写"三步非原子,并发下读到同一旧值→各扣一次→卖超', 'naive 交错真跑:库存2、3请求 → 卖出3、库存-1(超卖)', '修法=让扣库存原子化:Redis DECR/Lua 读判写合成一步;结果<0 回滚拒绝 → 卖出恰好2', '削峰(前端置灰+网关限流+MQ异步)是把量削小,防超卖靠原子性,两件事别混;落库再用DB乐观锁 where stock>0 兜底'],
  tabs: [{ id: 'design', label: '并发扣库存' }], Stage: SeckillStage, whyInRail: true,
  tone: s => (s.oversold ? { key: 'bad', label: '超卖！' } : s.phase === 'done' ? { key: 'good', label: '不超卖' } : { key: 'idle', label: s.mode === 'naive' ? 'naive 扣减' : s.mode === 'atomic' ? '原子 DECR' : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 10)),
  tickLabel: s => (s.oversold ? '超' : s.phase === 'done' ? '毕' : s.mode === 'atomic' ? '原' : s.mode === 'naive' ? 'n' : '秒'),
  readouts: s => [
    { label: '扣减方式', value: s.mode === 'naive' ? 'naive(非原子)' : s.mode === 'atomic' ? '原子 DECR' : '—' },
    { label: '当前库存', value: `${s.stock}`, tone: s.stock < 0 ? 'bad' : undefined },
    { label: '卖出/库存', value: `${s.sold}/${s.initStock}`, tone: s.oversold ? 'bad' : undefined },
    { label: '是否超卖', value: s.oversold ? '超卖!' : '正常', tone: s.oversold ? 'bad' : 'good' },
  ],
}

const objectstore: Experiment<SysDesignState> = {
  id: 'objectstore', group: '系统设计', title: '设计对象存储', subtitle: '海量图片视频：切块+纠删码+CDN',
  kernel: objectstoreKernel, defaultDoc: { kind: 'objectstore', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '系统设计高频题(存海量图片/短视频)。矛盾:数据量大、低成本、读得快。走一遍——需求→估算→对象存储(切块+纠删码/副本+元数据+扁平key)→上传(分片续传+哈希秒传)→分发(CDN+多码率转码切片)→权衡(副本vs纠删码/冷热分层)。详见讲解卡。',
  bounds: ['对象存储:文件切块+多副本/纠删码存多机+元数据单独存,扁平key水平扩展', '上传:大文件分片续传+哈希秒传去重', '分发:CDN边缘缓存+视频多码率转码切片(HLS)', '副本(3倍存储恢复快)vs纠删码RS(6,3)(1.5倍省钱恢复要算);冷热分层'],
  tabs: [{ id: 'design', label: '架构逐步搭' }], Stage: SysDesignStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '设计完成' } : { key: 'idle', label: s.stage.replace(/^[①②③④⑤⑥⑦]\s*/, '') || '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.stage.slice(0, 1) || '设'),
  readouts: s => [
    { label: '阶段', value: s.stage || '就绪' },
    { label: '关键', value: s.metric || '—' },
    { label: '已定组件', value: `${s.components.length} 个` },
    { label: '架构', value: s.components.map(c => c.label).join('→') || '—' },
  ],
}
const feed: Experiment<FeedState> = {
  id: 'feed', group: '系统设计', title: '设计 Feed 流', subtitle: '真仿真：推(写扩散) vs 拉(读归并) 推拉结合',
  kernel: feedKernel, defaultDoc: { kind: 'feed', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: 'Feed 首页时间线怎么生成。真跑推拉：普通用户 A/B 发帖走推(写进每个粉丝收件箱、读快写贵)，大V 发帖走拉(只存 outbox、省百万次写)，「我」刷 feed = 读收件箱 + 拉大V outbox → 按逻辑时间归并。写入次数/收件箱/归并结果全真算。',
  bounds: ['矛盾在读写谁贵:推=发帖写进每个粉丝收件箱(读O(1)、写O(粉丝数))', '拉=只存outbox(写O(1)、读时拉关注人归并)', '大V百万粉必须走拉(推=百万次写扩散风暴);普通用户走推', '刷feed=读收件箱(推来的)+拉少数大V→按时间多路归并(小顶堆)'],
  tabs: [{ id: 'design', label: '推拉扩散' }], Stage: FeedStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '推拉结合' } : { key: 'idle', label: s.phase === 'push' ? '推·写扩散' : s.phase === 'pull' ? '拉·存outbox' : s.phase === 'read' ? '刷feed归并' : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 7)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'postPush' ? '推' : s.op === 'postPull' ? '拉' : s.op === 'merge' ? '并' : 'F'),
  readouts: s => [
    { label: '当前模式', value: s.phase === 'push' ? '推·写扩散' : s.phase === 'pull' ? '拉·存outbox' : s.phase === 'read' || s.phase === 'done' ? '刷feed归并' : '就绪' },
    { label: '推·累计写入', value: `${s.pushWrites} 次` },
    { label: '大V拉·省下写', value: `${s.savedWrites.toLocaleString()} 次` },
    { label: '我的收件箱/Feed', value: `${s.myInbox.length} 条${s.feed.length ? ` → 归并 ${s.feed.length}` : ''}` },
  ],
}
const topk: Experiment<TopkState> = {
  id: 'topk', group: '算法系统设计', title: '设计海量数据 Top-K', subtitle: '真仿真：哈希分片(同词同片) + 小顶堆',
  kernel: topkKernel, defaultDoc: { kind: 'topk', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '内存装不下全量计数时怎么求 Top-K。真跑两个机制：哈希分片 hash(词)%N（同词必同片→计数不被拆、各片独立数），再用大小 K 的小顶堆（堆顶=第 K 大=门槛，新词 > 门槛才淘汰堆顶挤进来，O(n㏒K)）。分片/计数/堆的淘汰全真算。',
  bounds: ['难点:key上亿→全量计数超内存→分而治之', '哈希分片hash(词)%N:哈希确定→同词必同片→计数不被拆(轮询/随机分片会数错)', '大小K小顶堆:堆顶=第K大=门槛;新词≤门槛直接扔,>门槛淘汰堆顶换上;O(n㏒K)≪全排序O(n㏒n)', '各片局部TopK→归并全局TopK=MapReduce;再大用Count-Min Sketch近似;热点倾斜二次分片'],
  tabs: [{ id: 'design', label: '分片+堆' }], Stage: TopkStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: `Top-${s.K} 求出` } : { key: 'idle', label: s.phase === 'shard' ? '哈希分片' : s.phase === 'heap' ? '小顶堆' : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 12)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'replace' ? '换' : s.op === 'skip' ? '扔' : s.phase === 'heap' ? '堆' : s.phase === 'shard' ? '片' : 'K'),
  readouts: s => [
    { label: '当前机制', value: s.phase === 'heap' || s.phase === 'done' ? '小顶堆' : s.phase === 'shard' ? '哈希分片' : '就绪' },
    { label: '堆顶门槛', value: s.threshold < 0 ? '—(未满)' : `${s.threshold}（第${s.K}大）` },
    { label: '堆内容', value: s.heap.length ? s.heap.map(x => `${x.word}${x.count}`).join(' ') : '空' },
    { label: `Top-${s.K}`, value: s.topk.length ? s.topk.map(x => `${x.word}=${x.count}`).join(', ') : '求解中' },
  ],
}
const mqdesign: Experiment<MqState> = {
  id: 'mqdesign', group: '系统设计', title: '设计消息队列', subtitle: '真仿真：分区日志(offset) + 消费位移',
  kernel: mqdesignKernel, defaultDoc: { kind: 'mqdesign', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: 'MQ 的核心机制——append-only 分区日志 + 消费位移。真跑：5 条带 key 的消息哈希分区追加（看 offset 怎么长、同 key 同分区保序），消费组 G1 逐条 poll（offset 前进），再让 G2 从 0 读同一批（消息还在→组间独立消费/可回放）。offset/分区全真算。',
  bounds: ['核心=append-only分区日志:追加得单调offset;同key哈希到同分区→分区内严格有序(全局有序做不到)', 'offset归消费者:读不删除,消费者自己记读到哪;poll一条+1', '不同组独立offset→同一条消息每组各消费一遍(发布订阅);offset回拨即重放', '不丢:生产acks+多副本ISR;消费提交offset时机(先处理后提交=至少一次)'],
  tabs: [{ id: 'design', label: '日志+offset' }], Stage: MqStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '机制走完' } : { key: 'idle', label: s.phase === 'produce' ? '生产追加' : s.phase === 'consume' ? 'G1 消费' : s.phase === 'group2' ? 'G2 独立消费' : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 12)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'append' ? '追' : s.op === 'poll' ? (s.active === 'G2' ? '2' : '读') : 'MQ'),
  readouts: s => [
    { label: '日志消息数', value: `${s.parts.reduce((a, p) => a + p.log.length, 0)} 条` },
    { label: '分区0 / 分区1', value: `${s.parts[0]!.log.length} / ${s.parts[1]!.log.length}` },
    { label: 'G1 offset(p0/p1)', value: s.groups[0]!.offsets.join(' / ') },
    { label: 'G2 offset(p0/p1)', value: s.groups[1]!.offsets.join(' / ') },
  ],
}

// ── 具身智能 · 机器人学基础 ──
const fk: Experiment<FKState> = {
  id: 'fk', group: '机器人学基础', title: '正向运动学 FK', subtitle: '关节角 → 末端位姿：连杆链逐关节累加',
  kernel: fkKernel, defaultDoc: { kind: 'fk', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '机器人学第一课：已知每个关节转多少度、每根连杆多长，求末端(手爪/脚尖)在哪、朝哪。三连杆 L=[2,2,1]、θ=[30°,60°,-30°]，逐关节把角叠进累计朝向 cumθ、再沿它走一根连杆，末端坐标全用 cos/sin 真算、可手核。连杆链是通用的——机械臂一条链、机器狗一条腿也是。',
  bounds: ['FK:关节角→末端位姿,沿链累加 (xᵢ,yᵢ)=(xᵢ₋₁,yᵢ₋₁)+Lᵢ·(cos cumθᵢ,sin cumθᵢ)', '累计朝向 cumθᵢ=θ₁+…+θᵢ 决定这一节朝哪,连杆长决定走多远', '本例末端=(2.232,3.866)、朝向60°;是齐次变换连乘T₁T₂T₃的平面直觉版', 'FK唯一解(角定末端定);反过来求关节角=逆运动学IK,可能多解/无解更难'],
  tabs: [{ id: 'design', label: '连杆链' }], Stage: FKStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '末端求出' } : { key: 'idle', label: s.revealed > 0 ? `关节 ${s.revealed}` : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, s.revealed / s.links.length)),
  tickLabel: s => (s.phase === 'done' ? '末' : s.revealed > 0 ? `J${s.revealed}` : '基'),
  readouts: s => [
    { label: '已应用关节', value: `${s.revealed}/${s.links.length}` },
    { label: '累计朝向 cumθ', value: `${s.cumAngle}°` },
    { label: '当前末端', value: `(${s.points[s.points.length - 1]!.x}, ${s.points[s.points.length - 1]!.y})` },
    { label: '末端朝向', value: s.phase === 'done' ? `${s.endAngle}°` : '求解中' },
  ],
}

const dyneom: Experiment<DynState> = {
  id: 'dyneom', group: '刚体动力学', title: '机械臂运动方程', subtitle: '拉格朗日 M(q)q̈+C(q,q̇)q̇+G(q)=τ：惯性耦合+科氏/离心+重力，各关节不是独立的',
  kernel: dyneomKernel, defaultDoc: { kind: 'dyneom', params: { motion: '加速起摆' }, entities: [], streams: [] },
  params: [{ key: 'motion', label: '运动状态', kind: 'enum', options: ['静止保持', '匀速转动', '加速起摆'] }],
  paramsNote: '刚体动力学第一课(整组地基):机械臂不是"一个电机管一个关节"——各关节被惯性/科氏/重力**强耦合**,全写进一条**运动方程 M(q)q̈+C(q,q̇)q̇+G(q)=τ**。两连杆平面 RR 臂(标准 Spong/《Modern Robotics》ch.8),用 α=I1+I2+m1 lc1²+m2(l1²+lc2²)、β=m2 l1 lc2、δ=I2+m2 lc2²:①**M(q)** 质量矩阵(随构型变、**非对角≠0=关节耦合**)②**C(q,q̇)q̇** 科氏+离心(∝q̇²、**只在运动时**)③**G(q)** 重力(**静止举着也要力矩**)。切「运动状态」看静止(只 G)/匀速(+科氏)/加速(全三项)。M/C/G/τ 全现算。连「逆动力学RNEA(算这条τ)/计算力矩控制(用它抵消非线性)/正向动力学(反解 q̈)」。详见讲解卡。',
  bounds: [
    '机械臂运动方程 M(q)q̈+C(q,q̇)q̇+G(q)=τ:不能当 n 个独立单关节 PID(惯性耦合+科氏+重力)',
    'M(q)质量矩阵:对称正定、随构型变(cos q2)、**非对角项=关节耦合**(动一个甩另一个);C(q,q̇)q̇ 科氏+离心 ∝q̇²、只在运动时',
    'G(q)重力:静止 q̇=q̈=0 也要输出 τ=G 顶住(所以要重力补偿前馈,否则 PID 稳态下垂)',
    '连:逆动力学RNEA 高效算这条 τ(O(n)递归);计算力矩控制 τ=M(q̈_d+Kd ė+Kp e)+Cq̇+G 抵消非线性;正向动力学 q̈=M⁻¹(τ−Cq̇−G)。参考:《Modern Robotics》ch.8、Spong',
  ],
  tabs: [{ id: 'dy', label: '运动方程逐步跑' }], Stage: DynEomStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: 'τ=Mq̈+Cq̇+G' }
    : s.stage === 'assemble' ? { key: 'good', label: `τ₁=${Object.is(s.tau[0], -0) ? 0 : s.tau[0]}` }
    : s.stage === 'gravity' ? { key: 'idle', label: '重力 G' }
    : s.stage === 'coriolis' ? { key: 'idle', label: '科氏/离心' }
    : s.stage === 'mass' ? { key: 'idle', label: '质量矩阵 M' }
    : { key: 'idle', label: '强耦合' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '耦', mass: 'M', coriolis: 'C', gravity: 'G', assemble: 'τ', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '运动状态', value: s.motionLabel },
    { label: '质量矩阵耦合项', value: s.showM ? `M₁₂=${s.M[0][1]}（≠0=耦合）` : '—' },
    { label: '重力力矩 G', value: s.showG ? `[${Object.is(s.G[0], -0) ? 0 : s.G[0]}, ${Object.is(s.G[1], -0) ? 0 : s.G[1]}]` : '—' },
    { label: '关节力矩 τ', value: s.showTau ? `[${Object.is(s.tau[0], -0) ? 0 : s.tau[0]}, ${Object.is(s.tau[1], -0) ? 0 : s.tau[1]}] N·m` : '—' },
  ],
}
const rnea: Experiment<RneaState> = {
  id: 'rnea', group: '刚体动力学', title: '递归牛顿-欧拉 RNEA', subtitle: '逆动力学：给定 q,q̇,q̈ 两次扫描 O(n) 算关节力矩 τ，不显式组 M/C/G',
  kernel: rneaKernel, defaultDoc: { kind: 'rnea', params: { grav: '含重力' }, entities: [], streams: [] },
  params: [{ key: 'grav', label: '重力', kind: 'enum', options: ['含重力', '无重力'] }],
  paramsNote: '**逆动力学**:给定"想让臂怎么动"(q,q̇,q̈)、反求每个关节该出多大力矩 τ(控制的核心)。上一课显式组 M/C/G 再相乘(O(n²~n³));**RNEA 换算法**——沿连杆链**两次扫描、O(n)、不显式组任何矩阵**(Featherstone《RBDA》ch.5 / 《Modern Robotics》§8.3):①**外向(基→梢)** ω_i=ω_{i−1}+q̇_i、α 累加、线加速度 a=a_prev+α×r−ω²r 往外传;**重力技巧**给基座假加速度 a₀=−g,每连杆自动含自重、免单列重力项 ②**内向(梢→基)** 牛顿 F=m a_c、欧拉 N=I α,力/力矩往里传、投影关节轴得 τ。结果与「机械臂运动方程」M q̈+C q̇+G **完全一致**。切「重力」看基座假加速度技巧。全现算。连「机械臂运动方程/计算力矩控制」。详见讲解卡。',
  bounds: [
    'RNEA 逆动力学:两次扫描算 τ——外向(基→梢)传运动 ω/α/a、内向(梢→基)传力 F/N/τ;O(n)、不显式组 M/C/G',
    '重力技巧:基座假加速度 a₀=−g,每连杆自动感到自重(免单列重力项);切无重力 τ 正好少一个 G',
    'RNEA 结果 = M(q)q̈+C(q,q̇)q̇+G(q) 完全一致——同一套动力学、O(n) 递归 vs O(n²~n³) 显式组矩阵',
    '连:计算力矩控制的 Cq̇+G 前馈=一次 RNEA(令 q̈=q̈_d+Kd ė+Kp e);也是 CRBA(读 M 列)与 ABA(正向动力学)的构件。参考:Featherstone《RBDA》、Pinocchio::rnea',
  ],
  tabs: [{ id: 'rn', label: 'RNEA 逐步跑' }], Stage: RneaStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: 'O(n) 逆动力学' }
    : s.stage === 'verify' ? { key: 'good', label: '=Mq̈+Cq̇+G' }
    : s.stage === 'inward' ? { key: 'good', label: `τ=[${s.tau[0]},${s.tau[1]}]` }
    : s.stage === 'outward' ? { key: 'idle', label: '外向传运动' }
    : { key: 'idle', label: '逆动力学' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => ({ intro: '逆', outward: '外', inward: '内', verify: '对', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '重力', value: s.grav === 'on' ? `含(a₀=−g)` : '无(a₀=0)' },
    { label: '关节力矩 τ', value: s.showIn ? `[${s.tau[0]}, ${s.tau[1]}] N·m` : '—', tone: s.showIn ? 'good' : undefined },
    { label: '对拍 Mq̈+Cq̇+G', value: s.showVerify ? `[${s.eomTau[0]}, ${s.eomTau[1]}]${s.tau[0] === s.eomTau[0] && s.tau[1] === s.eomTau[1] ? ' ✓' : ''}` : '—' },
    { label: '本步', value: ({ intro: '逆动力学', outward: '外向传运动', inward: '内向传力→τ', verify: '对拍运动方程', done: 'O(n) 逆动力学' } as Record<string, string>)[s.stage] ?? '—' },
  ],
}
const fwddyn: Experiment<FwdState> = {
  id: 'fwddyn', group: '刚体动力学', title: '正向动力学 · 仿真', subtitle: '给力矩求加速度 q̈=M⁻¹(τ−Cq̇−G)：物理仿真每一步在做的事',
  kernel: fwddynKernel, defaultDoc: { kind: 'fwddyn', params: { torque: '偏小' }, entities: [], streams: [] },
  params: [{ key: 'torque', label: '施加力矩', kind: 'enum', options: ['偏小', '平衡', '发力'] }],
  paramsNote: '**正向动力学**是逆动力学(RNEA)的反问题:逆动力学给运动求力矩(**控制**)、正向动力学**给力矩求运动(仿真)**。q̈=**M(q)⁻¹·(τ−C(q,q̇)q̇−G(q))**。四步:①偏置 b=Cq̇+G(=一次 q̈=0 的 RNEA)②质量矩阵 M **对称正定→一定可逆**(实际用 Cholesky 解、不真求逆;大自由度用 ABA O(n))③解 q̈=M⁻¹(τ−b)④**半隐式欧拉**积分一步 q̇←q̇+q̈dt、q←q+q̇dt——这就是仿真器循环一步。切「施加力矩」看偏小(往下掉)/平衡(不加速)/发力(起摆)。研究对拍 τ=[10,2]→q̈=[−3.89,9.16]、round-trip 精确还原。全现算。连「机械臂运动方程/RNEA/MPC/RL(都要仿真)」。详见讲解卡。',
  bounds: [
    '正向动力学 q̈=M⁻¹(τ−Cq̇−G):给力矩求运动=仿真;逆动力学 RNEA 给运动求力矩=控制;二者互逆(round-trip 精确还原)',
    'M 对称正定→一定可逆、正向动力学良定义;实际用 Cholesky 解 M q̈=τ−b(不显式求逆)、大自由度用 ABA O(n) 连 M 都不组',
    '偏置 b=Cq̇+G 用一次 q̈=0 的 RNEA 算;半隐式欧拉积分 q̇←q̇+q̈dt、q←q+q̇dt = 仿真器循环一步',
    '连:MuJoCo/Bullet/Drake 核心就是这循环;MPC 靠它预测未来;RL 在仿真里跑的也是它。参考:Featherstone ABA、Pinocchio::aba',
  ],
  tabs: [{ id: 'fw', label: '正向动力学逐步跑' }], Stage: FwdDynStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '仿真一步' }
    : s.stage === 'integrate' ? { key: 'good', label: '积分推进' }
    : s.stage === 'solve' ? { key: 'good', label: `q̈=[${Object.is(s.qdd[0], -0) ? 0 : s.qdd[0]},${Object.is(s.qdd[1], -0) ? 0 : s.qdd[1]}]` }
    : s.stage === 'massinv' ? { key: 'idle', label: 'M⁻¹' }
    : s.stage === 'bias' ? { key: 'idle', label: '偏置 b' }
    : { key: 'idle', label: '仿真' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '仿', bias: 'b', massinv: 'M', solve: 'q̈', integrate: '积', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '施加力矩 τ', value: `[${s.tau[0]}, ${s.tau[1]}] N·m` },
    { label: '偏置 Cq̇+G', value: s.showBias ? `[${s.bias[0]}, ${s.bias[1]}]` : '—' },
    { label: '关节加速度 q̈', value: s.showQdd ? `[${Object.is(s.qdd[0], -0) ? 0 : s.qdd[0]}, ${Object.is(s.qdd[1], -0) ? 0 : s.qdd[1]}] rad/s²` : '—', tone: s.showQdd ? 'good' : undefined },
    { label: '本步', value: ({ intro: '仿真=反问题', bias: '偏置 Cq̇+G', massinv: 'M 与逆(SPD)', solve: '解 q̈', integrate: '积分一步', done: '仿真一步' } as Record<string, string>)[s.stage] ?? '—' },
  ],
}
const computedtorque: Experiment<CtcState> = {
  id: 'computedtorque', group: '刚体动力学', title: '计算力矩控制', subtitle: '反馈线性化：τ=M(q̈_d+Kd ė+Kp e)+Cq̇+G，用模型抵消非线性 → ë+Kd ė+Kp e=0',
  kernel: computedtorqueKernel, defaultDoc: { kind: 'computedtorque', params: { mode: '计算力矩' }, entities: [], streams: [] },
  params: [{ key: 'mode', label: '控制模式', kind: 'enum', options: ['计算力矩', '只重力补偿', '纯 PID'] }],
  paramsNote: '机械臂是**非线性强耦合**的(重力随构型变、惯性耦合、科氏∝q̇²),固定增益 PID 只能保守整定、高速丢精度。**计算力矩控制(=逆动力学控制/反馈线性化)**用动力学模型主动抵消非线性:先把 PD 修正当"想要的加速度" **v=q̈_d+Kd ė+Kp e**,再 **τ=M·v+Cq̇+G**。代回被控对象 M q̈+Cq̇+G=τ,**Cq̇+G 抵消、M 约掉** → **解耦线性误差动力学 ë+Kd ė+Kp e=0**(每关节独立二阶、可配极点、一套增益全局用)。切「控制模式」看:计算力矩(全抵消、线性解耦)/只重力补偿(消重力留科氏耦合)/纯PID(啥都不消、稳态下垂)。研究对拍 τ=[21.70,3.08]、v=[6,−8]。全现算。连「机械臂运动方程/RNEA/PID」。详见讲解卡。',
  bounds: [
    '计算力矩控制 τ=M(q̈_d+Kd ė+Kp e)+Cq̇+G:用模型抵消非线性→误差动力学 ë+Kd ė+Kp e=0(线性、解耦、可配极点、一套增益全局用)',
    'Kd=2√Kp 临界阻尼(ζ=1);M·v 给想要的加速度、Cq̇+G 前馈抵消科氏和重力;=反馈线性化',
    '三档:计算力矩(全抵消最好)>只重力补偿(消重力留耦合、设定点够用)>纯PID(啥都不消、稳态下垂、要保守整定)',
    '连:Cq̇+G 前馈=一次 RNEA(令 q̈=q̈_d+Kd ė+Kp e);是 PID 的模型升级版;要准确模型(误差→自适应/鲁棒计算力矩 Slotine-Li)。参考:Spong ch.8、《Modern Robotics》§11',
  ],
  tabs: [{ id: 'ct', label: '计算力矩逐步跑' }], Stage: ComputedTorqueStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '模型抵消非线性' }
    : s.stage === 'errordyn' ? (s.linear ? { key: 'good', label: 'ë+Kd ė+Kp e=0' } : { key: 'bad', label: '残留非线性' })
    : s.stage === 'torque' ? { key: 'good', label: `τ=[${Object.is(s.tau[0], -0) ? 0 : s.tau[0]}]` }
    : s.stage === 'law' ? { key: 'idle', label: 'v=q̈_d+Kd ė+Kp e' }
    : s.stage === 'error' ? { key: 'idle', label: '误差 e,ė' }
    : { key: 'idle', label: '反馈线性化' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '扛', error: 'e', law: 'v', torque: 'τ', errordyn: '线', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '控制模式', value: s.modeLabel },
    { label: '伺服律 v', value: s.showLaw ? `[${s.innerV[0]}, ${s.innerV[1]}]` : '—' },
    { label: '关节力矩 τ', value: s.showTau ? `[${Object.is(s.tau[0], -0) ? 0 : s.tau[0]}, ${Object.is(s.tau[1], -0) ? 0 : s.tau[1]}] N·m` : '—', tone: s.showTau ? 'good' : undefined },
    { label: '误差动力学', value: s.showDyn ? (s.linear ? 'ë+Kd ė+Kp e=0（线性解耦）' : '残留非线性') : '—', tone: s.showDyn && !s.linear ? 'bad' : undefined },
  ],
}
const contactlcp: Experiment<LcpState> = {
  id: 'contactlcp', group: '刚体动力学', title: '接触动力学 · 摩擦锥', subtitle: '物理引擎每步怎么解接触：法向互补 0≤f_n⊥φ≥0 + 库仑摩擦锥 |f_t|≤μf_n 的粘/滑开关',
  kernel: contactlcpKernel, defaultDoc: { kind: 'contactlcp', params: { push: '重推' }, entities: [], streams: [] },
  params: [{ key: 'push', label: '水平推力', kind: 'enum', options: ['轻推', '临界', '重推'] }],
  paramsNote: '接触和自由运动不同——**非光滑、集值**:法向不能拉不能穿、切向有摩擦还分粘/滑,没法写成光滑 f(x),所以物理引擎(MuJoCo/Bullet)每步组成 **LCP/QP** 求解。最小例子:滑块(m=1)压水平面(μ=0.5)、水平推力 F。两条支柱:①**法向互补 0≤f_n⊥φ≥0**(分离 φ>0→f_n=0 / 接触 φ=0→f_n≥0、只推不拉),静止 f_n=mg=9.81 ②**库仑摩擦锥 |f_t|≤μf_n**=4.905(最大静摩擦)。**粘/滑=摩擦锥的 KKT 开关**:F≤μf_n→粘(a=0)、F>μf_n→滑(f_t饱和μf_n、a=(F−μf_n)/m)。切「推力」看轻推(粘)/临界(将滑)/重推(滑 a=1.095)。锥常线性化成金字塔。全现算。连「阻抗力控/正向动力学仿真」。详见讲解卡。',
  bounds: [
    '接触=非光滑集值:法向互补 0≤f_n⊥φ≥0(不能拉不能穿)+库仑摩擦锥 |f_t|≤μf_n;物理引擎每步组 LCP/QP 解',
    '粘/滑=摩擦锥 KKT 开关:F≤μf_n 粘(f_t=F 在锥内、a=0)、F>μf_n 滑(f_t=μf_n 在锥边界反向、a=(F−μf_n)/m)',
    '锥常线性化成金字塔(几个切向方向、β≥0、Σβ≤μf_n)供 LCP;碰撞要速度级/冲量级(Painlevé 佯谬),穿透用 Baumgarte/软约束修正',
    '连:正向动力学/仿真每步在动力学外还要解接触 LCP;阻抗力控处理接触柔顺;抓取力闭合/腿足落脚建在摩擦锥上。参考:Stewart-Trinkle、MuJoCo 软凸锥、Tedrake《Underactuated》',
  ],
  tabs: [{ id: 'lc', label: '接触求解逐步跑' }], Stage: ContactLcpStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '互补+摩擦锥' }
    : s.stage === 'accel' ? (s.stick ? { key: 'good', label: 'a=0 粘' } : { key: 'bad', label: `a=${s.accel} 滑` })
    : s.stage === 'stickslip' ? (s.stick ? { key: 'good', label: '粘住' } : { key: 'bad', label: '滑动' })
    : s.stage === 'cone' ? { key: 'idle', label: '摩擦锥' }
    : s.stage === 'normal' ? { key: 'idle', label: '法向互补' }
    : { key: 'idle', label: '接触' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '触', normal: '法', cone: '锥', stickslip: '粘', accel: 'a', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '推力 F / μf_n', value: `${s.F} / ${s.maxStatic} N` },
    { label: '法向力 f_n=mg', value: s.showNormal ? `${s.fn} N` : '—' },
    { label: '粘/滑', value: s.showStick ? (s.stick ? '粘住(F≤μf_n)' : '滑动(F>μf_n)') : '—', tone: s.showStick ? (s.stick ? 'good' : 'bad') : undefined },
    { label: '加速度 a', value: s.showAccel ? `${s.accel} m/s²` : '—', tone: s.showAccel && s.accel > 0 ? 'bad' : undefined },
  ],
}
const ik: Experiment<IKState> = {
  id: 'ik', group: '机器人学基础', title: '逆运动学 IK', subtitle: '目标由近到远扫描：多解→奇异→无解',
  kernel: ikKernel, defaultDoc: { kind: 'ik', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: 'IK 不是一步步算的仿真，是个函数：末端目标 → 关节角。真正在变的是目标位置——这里把轴换成"目标沿 45° 射线由近到远扫描"，按 ▶ 播放就看两组解(肘上/肘下)怎么随距离靠拢、到最大伸展 r=L1+L2 合并成一个(奇异)、再远就够不到(无解)。二连杆余弦定理闭式解:cosθ2=(x²+y²−L1²−L2²)/(2L1L2)，θ2=±acos(±两支=肘上/肘下)。',
  bounds: ['IK=FK反问题:给末端反求关节角;可能多解/无解(够不到)/奇异——这正是它比FK难的地方', '轴是目标距离 r 扫描(沿45°射线):每步是该目标下的完整反解,不是计算中间步', '可达性:r=√(x²+y²)须落在[|L1−L2|,L1+L2]=[0,4];r>4 无解', '余弦定理:θ2=±acos(...) → 肘上/肘下两解;r=4 时 θ2=0 两支合并(奇异);每组回代FK验证'],
  tabs: [{ id: 'design', label: '几何反解' }], Stage: IKStage, whyInRail: true,
  tone: s => (!s.reachable ? { key: 'bad', label: '无解' } : s.solutions.length === 1 ? { key: 'bad', label: '奇异·1 解' } : { key: 'good', label: `${s.solutions.length} 组解` }),
  metric: s => Math.min(1, s.r / (s.reachHi || 4)),
  tickLabel: s => `r=${s.r}`,
  readouts: s => [
    { label: '目标距离 r', value: `${s.r}`, tone: s.reachable ? undefined : 'bad' },
    { label: '可达范围', value: `[${s.reachLo}, ${s.reachHi}]`, tone: s.reachable ? 'good' : 'bad' },
    { label: 'cosθ2', value: `${s.cosTheta2}` },
    { label: '解', value: s.solutions.length ? s.solutions.map(x => `(${x.th1}°,${x.th2}°)`).join(' / ') : '求解中' },
  ],
}

const jacobian: Experiment<JacoState> = {
  id: 'jacobian', group: '机器人学基础', title: '雅可比矩阵', subtitle: 'θ2 扫描：det=L1L2sinθ2 → 0 逼近奇异',
  kernel: jacobianKernel, defaultDoc: { kind: 'jacobian', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '雅可比不是一步步算的仿真，是个函数：构型 → J/det。真正在变的是关节角 θ2——这里把轴换成"θ2 从 90° 扫到 0°(手臂由弯到伸直)"，按 ▶ 播放看 det(J)=L1·L2·sinθ2 一路缩到 0：伸直(θ2=0)即奇异、两列平行、末端丢一个自由度、J⁻¹ 爆炸。J=末端(x,y)对关节θ的偏导，ẋ=Jθ̇ 正着算末端速度、θ̇=J⁻¹ẋ 反着做速度层 IK。',
  bounds: ['雅可比 J=∂(末端x,y)/∂(关节θ1,θ2);ẋ=Jθ̇ 关节速度线性映成末端速度', '轴是 θ2 扫描(90°→0°,θ1 固定 30°):每步是该构型下的完整 J/det,不是计算中间步', 'det(J)=L1·L2·sinθ2;≠0可逆→能反解(速度层IK,沿直线走/力控)', 'θ2=0伸直或180°对折→det=0奇异,两列平行,末端丢一个自由度,J⁻¹爆炸;工程绕开或用阻尼最小二乘'],
  tabs: [{ id: 'design', label: '速度映射' }], Stage: JacobianStage, whyInRail: true,
  tone: s => (s.singular ? { key: 'bad', label: '奇异 det=0' } : s.det < 1 ? { key: 'bad', label: `将奇异 det=${s.det}` } : { key: 'good', label: `可逆 det=${s.det}` }),
  metric: s => Math.max(0, Math.min(1, 1 - Math.abs(s.det) / (s.L1 * s.L2))),
  tickLabel: s => `θ2=${s.theta2}°`,
  readouts: s => [
    { label: '当前构型', value: `θ=[${s.theta1}°,${s.theta2}°]` },
    { label: 'det(J)', value: `${s.det}`, tone: s.singular ? 'bad' : 'good' },
    { label: 'J 状态', value: s.singular ? '奇异·丢自由度' : '可逆', tone: s.singular ? 'bad' : 'good' },
    { label: '末端速度', value: s.endVel ? `(${s.endVel.vx}, ${s.endVel.vy})` : '—' },
  ],
}

const quat: Experiment<QuatState> = {
  id: 'quat', group: '机器人学基础', title: '位姿与四元数', subtitle: '轴-角→四元数→矩阵→转向量；欧拉角万向锁',
  kernel: quatKernel, defaultDoc: { kind: 'quat', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '机器人表达"朝向"有几种等价写法：欧拉角(直观但万向锁)、旋转矩阵(3×3)、四元数(4 个数、无奇异、首选)。绕 z 轴 90°：q=(cos45°,0,0,sin45°)=(0.707,0,0,0.707) |q|=1；转成 R 把 (1,0,0) 转到 (0,1,0)；自乘 q⊗q=转 180°→(-1,0,0)；最后 pitch=90° 时三组不同欧拉角给出同一个 R(万向锁)。四元数/矩阵/向量全真算。',
  bounds: ['轴-角→四元数:q=(cos(θ/2),sin(θ/2)·轴),|q|=1;4个数编码旋转(矩阵要9个带6约束)', '四元数→旋转矩阵R,R乘向量把它转过去;绕z90°把(1,0,0)转到(0,1,0)', '组合旋转=四元数相乘q1⊗q2(不可交换),比连乘矩阵省、不漂移', '欧拉角pitch=90°万向锁:yaw和roll锁成一个自由度(三组不同角同一R);四元数无奇异,首选(IMU/SLAM/图形)'],
  tabs: [{ id: 'design', label: '旋转表示' }], Stage: QuatStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '四元数首选' } : s.phase === 'gimbal' ? { key: 'bad', label: '万向锁' } : { key: 'idle', label: s.phase === 'quat' ? '轴角→四元数' : s.phase === 'matrix' ? '→旋转矩阵' : s.phase === 'rotate' ? '转向量' : s.phase === 'compose' ? '相乘组合' : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 7)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.phase === 'gimbal' ? '锁' : s.op === 'quat' ? 'q' : s.op === 'matrix' ? 'R' : s.op === 'rotate' ? 'v' : s.op === 'compose' ? '⊗' : '姿'),
  readouts: s => [
    { label: '四元数 q', value: `(${s.q.join(', ')})` },
    { label: '|q|²', value: `${s.qnorm}`, tone: 'good' },
    { label: '累计转角', value: `${s.angleShown}°` },
    { label: '当前向量', value: `(${s.vecNow.join(', ')})` },
  ],
}

const trajectory: Experiment<TrajState> = {
  id: 'trajectory', group: '机器人学基础', title: '轨迹规划', subtitle: '三次多项式：平滑起停 vs 线性插值速度突跳',
  kernel: trajectoryKernel, defaultDoc: { kind: 'trajectory', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: 'FK/IK 给位置，还要一条平滑的时间轨迹(每时刻位置/速度/加速度)。线性插值匀速走→速度两端从 0 突跳=无穷加速度、顿挫。三次多项式 θ(t)=a0+a1t+a2t²+a3t³ 用 4 个边界条件(两端位置+两端速度=0)定系数：关节 0°→90°、T=2s 解出 a=[0,0,67.5,-22.5]，位置走 S 曲线、速度呈钟形(两端归零)、加速度有限。系数与每时刻值全真算。',
  bounds: ['轨迹规划=时间参数化的平滑运动(每时刻位置/速度/加速度),几何路径是RRT的活', '线性插值速度两端从0突跳→无穷大加速度,电机顿挫抖动', '三次多项式:4边界条件(两端位置+两端速度0)→a=[0,0,3Δθ/T²,-2Δθ/T³];位置S曲线、速度钟形两端0', '要加速度也平滑用五次多项式;多路点用样条;还有梯形/S速度曲线;轨迹交PID跟踪、每点IK转关节角'],
  tabs: [{ id: 'design', label: '平滑轨迹' }], Stage: TrajStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '平滑到位' } : s.phase === 'linear' ? { key: 'bad', label: '线性速度突跳' } : { key: 'idle', label: s.phase === 'solve' ? '解系数' : s.phase === 'trace' ? `t=${s.t}s` : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 9)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.phase === 'linear' ? '线' : s.phase === 'solve' ? 'a' : s.op === 'sample' ? `${s.t}` : '轨'),
  readouts: s => [
    { label: '时间 t', value: `${s.t}s` },
    { label: '位置 θ', value: `${s.theta}°` },
    { label: '速度 θ̇', value: `${s.vel}°/s`, tone: (s.op === 'summary' && s.vel === 0) ? 'good' : undefined },
    { label: '加速度 θ̈', value: `${s.accel}°/s²` },
  ],
}

// ── 具身智能 · 机器人感知 ──
const ekf: Experiment<EkfState> = {
  id: 'ekf', group: '机器人感知', title: '扩展卡尔曼滤波 EKF', subtitle: '卡尔曼的非线性扩展：在估计点用雅可比 H=∂h/∂x 把非线性观测就地线性化',
  kernel: ekfKernel, defaultDoc: { kind: 'ekf', params: { trust: '测量准' }, entities: [], streams: [] },
  params: [{ key: 'trust', label: '测量信任', kind: 'enum', options: ['测量准', '测量糙'] }],
  paramsNote: '「卡尔曼滤波」要求运动/观测**线性**;但机器人常遇非线性(状态是位置 x、传感器测的是到地标的**距离** z=√((L−x)²+d²)、对 x 非线性)。**EKF 的招**:在**当前估计点**把非线性 f/h 用一阶泰勒(**雅可比**)线性化,再套原卡尔曼公式。本例地标(10,5)偏离轴。①预测 x̂←x̂+u、P←P+Q ②非线性观测 h(x̂)、创新 y=z−h ③**雅可比 H=∂h/∂x=−(L−x̂)/h(EKF 精髓、就地线性化)** ④更新 S=H²P+R、K=PH/S、x←x̂+Ky、P←(1−KH)P。切「信任」看 R 小(信测量、K 大)vs R 大(信预测)。**失效**:强非线性/估计点差→发散→UKF/粒子滤波。全现算。连「卡尔曼滤波/雅可比矩阵」。详见讲解卡。',
  bounds: [
    'EKF=卡尔曼的非线性扩展:唯一不同是在估计点对非线性 f/h 求雅可比(F/H)就地线性化,其余预测-更新公式照旧',
    '观测雅可比 H=∂h/∂x 把非线性距离测量翻译成局部线性灵敏度(H 符号=往哪动会让测量怎么变);运动非线性则对 f 求 F、P←F P Fᵀ+Q',
    '更新:创新 y=z−h(x̂)、S=HPHᵀ+R、K=PHᵀS⁻¹、x←x̂+Ky、P←(I−KH)P;R 小信测量 K 大、R 大信预测 K 小',
    '失效:只做一阶线性化,强非线性/估计点离真值远→协方差失真甚至发散→UKF(sigma 点不求雅可比)或粒子滤波(多峰非高斯)。是机器人定位/EKF-SLAM 主力',
  ],
  tabs: [{ id: 'ek', label: 'EKF 逐步跑' }], Stage: EkfStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '雅可比+卡尔曼' }
    : s.stage === 'update' ? { key: 'good', label: `x̂=${s.xPost}` }
    : s.stage === 'jacobian' ? { key: 'idle', label: `H=${s.H}` }
    : s.stage === 'measmodel' ? { key: 'idle', label: '非线性观测' }
    : s.stage === 'predict' ? { key: 'idle', label: '预测' }
    : { key: 'idle', label: '非线性' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '非', predict: '测', measmodel: 'h', jacobian: 'H', update: '融', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '测量信任', value: s.trustLabel },
    { label: '雅可比 H=∂h/∂x', value: s.showJac ? `${s.H}` : '—' },
    { label: '位置估计 x̂', value: s.showUpd ? `${s.xPost}` : `${s.xPred}` },
    { label: '方差 P', value: s.showUpd ? `${s.PPost}（收敛）` : `${s.PPred}`, tone: s.showUpd ? 'good' : undefined },
  ],
}
const particlefilter: Experiment<PfState> = {
  id: 'particlefilter', group: '机器人感知', title: '粒子滤波 · 蒙特卡洛定位', subtitle: '用一堆带权粒子表示信念：加权→N_eff→重采样，能表多峰/非高斯',
  kernel: particlefilterKernel, defaultDoc: { kind: 'particlefilter', params: { resample: '重采样' }, entities: [], streams: [] },
  params: [{ key: 'resample', label: '重采样', kind: 'enum', options: ['重采样', '不重采样'] }],
  paramsNote: 'EKF 用一个高斯表信念、强非线性/多峰会崩;**粒子滤波**用 **N 个带权粒子** {(x_i,w_i)} 近似**任意分布**(多峰/非高斯都能表,如全局定位)。每步:①预测(每粒子按运动+噪声动)②**加权** w_i∝观测似然 exp(−(z−x_i)²/(2σ²))(离测量越近权重越高)③归一 + **有效样本数 N_eff=1/Σw²**(权重集中→N_eff 掉、<N/2 该重采样)④**系统重采样**(高权复制、低权淘汰、权重重置均匀、治退化)。估计=加权均值。切「重采样」看开(粒子聚拢可持续)vs 关(权重退化 N_eff→1)。本例 6 粒子、z=5.5→估计 5.4。全现算。连「卡尔曼滤波/EKF(它失效时用粒子)」。详见讲解卡。',
  bounds: [
    '粒子滤波=用 N 个带权粒子近似任意分布(多峰/非高斯);预测(粒子各自动+噪声)+加权(w∝观测似然)+重采样',
    '有效样本数 N_eff=1/Σw²:权重越集中越小,<N/2 就重采样;系统(低方差)重采样高权复制低权淘汰、权重重置均匀',
    '不重采样→粒子退化(权重全集中到极少数、N_eff→1、浪费采样);粒子贫化靠加噪缓解',
    '连:是卡尔曼/EKF 的采样式替代、EKF 强非线性失效时的答案(蒙特卡洛定位 MCL);KF/EKF 快但单峰、PF 表多峰但慢。参考:Thrun《Probabilistic Robotics》',
  ],
  tabs: [{ id: 'pf', label: '粒子滤波逐步跑' }], Stage: PfStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '样本表信念' }
    : s.stage === 'resample' ? (s.mode === 'on' ? { key: 'good', label: '重采样聚拢' } : { key: 'bad', label: '退化' })
    : s.stage === 'neff' ? { key: (s.neff < s.N / 2 ? 'bad' : 'idle'), label: `N_eff=${s.neff}` }
    : s.stage === 'weight' ? { key: 'idle', label: '加权' }
    : s.stage === 'predict' ? { key: 'idle', label: '预测散开' }
    : { key: 'idle', label: '粒子' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '粒', predict: '散', weight: '权', neff: 'N', resample: '采', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '重采样', value: s.modeLabel },
    { label: '有效样本数 N_eff', value: s.showNeff ? `${s.neff} / ${s.N}` : '—', tone: s.showNeff && s.neff < s.N / 2 ? 'bad' : undefined },
    { label: '估计(加权均值)', value: s.showNeff ? `${s.estimate}` : '—', tone: s.showNeff ? 'good' : undefined },
    { label: '本步', value: ({ intro: '样本表信念', predict: '预测散开', weight: '加权(似然)', neff: 'N_eff 判据', resample: '重采样', done: '样本表信念' } as Record<string, string>)[s.stage] ?? '—' },
  ],
}
const ukf: Experiment<UkfState> = {
  id: 'ukf', group: '机器人感知', title: '无迹卡尔曼滤波 UKF', subtitle: '不求雅可比：sigma 点过真非线性再拟合高斯；与 EKF 同题对比',
  kernel: ukfKernel, defaultDoc: { kind: 'ukf', params: { unc: '不确定大' }, entities: [], streams: [] },
  params: [{ key: 'unc', label: '先验不确定', kind: 'enum', options: ['不确定大', '不确定小'] }],
  paramsNote: '「EKF」在估计点求**雅可比**线性化(要算导数);**UKF(无迹变换)**换思路——与其近似非线性函数,不如**近似分布**:①取 **2n+1 个 sigma 点**(X₀=μ、X₁,₂=μ±√((n+λ)P))②**每点过真非线性 h**(不求导!)③用权重 Wm/Wc 重组预测测量均值 ẑ、协方差 S、互协方差 Pxz ④更新 K=Pxz/S、x←x̂+K(z−ẑ)、P←P−KSK。和 EKF 同一个问题(地标(10,5)、非线性距离、z=8)好对比。切「先验不确定」:P 小→sigma 点靠近→UKF≈EKF;P 大→铺得开→捕捉曲率、和 EKF 分道。全现算+对拍 EKF。连「EKF/卡尔曼/粒子滤波」。详见讲解卡。',
  bounds: [
    'UKF=无迹变换+卡尔曼:取 2n+1 个 sigma 点、每点过真非线性 f/h(不求雅可比)、重组均值/协方差/互协方差、卡尔曼式更新 K=Pxz/S',
    'vs EKF:EKF 用一条切线(雅可比一阶);UKF 让点真走一遍非线性、捕捉二阶曲率(对高斯到三阶精确)、且免推雅可比;代价每步过 2n+1 个点',
    '先验 P 小→sigma 点靠近→UKF≈EKF(局部线性);P 大→铺得开→UKF 捕捉曲率、和 EKF 分道——优势在不确定大/非线性强时显现',
    '滤波家族选型:线性→KF、弱非线性/要快→EKF、强非线性/难求导→UKF、多峰/非高斯→粒子滤波。参考:Julier-Uhlmann 无迹变换、Thrun《Probabilistic Robotics》',
  ],
  tabs: [{ id: 'uk', label: 'UKF 逐步跑' }], Stage: UkfStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: 'sigma+卡尔曼' }
    : s.stage === 'update' ? { key: 'good', label: `x̂=${s.xPost}` }
    : s.stage === 'recombine' ? { key: 'idle', label: `ẑ=${s.zPred}` }
    : s.stage === 'transform' ? { key: 'idle', label: '过真非线性' }
    : s.stage === 'sigma' ? { key: 'idle', label: 'sigma 点' }
    : { key: 'idle', label: '无迹变换' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '迹', sigma: 'σ', transform: 'h', recombine: '组', update: '融', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '先验不确定 P', value: `${s.P}` },
    { label: 'UKF 估计 x̂', value: s.showUpd ? `${s.xPost}` : '—', tone: s.showUpd ? 'good' : undefined },
    { label: '对比 EKF x̂', value: s.showUpd ? `${s.xEkf}${s.unc === 'big' ? '（分道）' : '（≈UKF）'}` : '—' },
    { label: '本步', value: ({ intro: '不线性化', sigma: '取 sigma 点', transform: '过真非线性', recombine: '重组高斯', update: '更新+对比EKF', done: 'sigma+卡尔曼' } as Record<string, string>)[s.stage] ?? '—' },
  ],
}
const complementary: Experiment<CompState> = {
  id: 'complementary', group: '机器人感知', title: '互补滤波 · IMU 姿态', subtitle: '陀螺(短期准·长期漂)+加速度(绝对·抖)融倾角：θ=α·陀螺+(1−α)·加速度',
  kernel: complementaryKernel, defaultDoc: { kind: 'complementary', params: { alpha: '偏信陀螺' }, entities: [], streams: [] },
  params: [{ key: 'alpha', label: '混合权重', kind: 'enum', options: ['偏信陀螺', '偏信加速度', '均衡'] }],
  paramsNote: 'IMU 测姿态(倾角)两个传感器各有死穴:**陀螺仪**积分角速度→短期准、平滑,但 bias **积分累积漂移**(无绝对参考);**加速度计**由重力算**绝对倾角**→不漂,但**噪声大、抖**、运动时线加速度污染。**互补滤波**把长短板互补:**θ=α·(θ_prev+ω·dt)+(1−α)·θ_acc**——α·陀螺=高通(信短期)、(1−α)·加速度=低通(纠漂)。α 大(≈0.98)平滑抗抖但纠漂慢、α 小跟加速度紧压漂快但抖。只陀螺→无限漂、只加速度→抖得没法用。切「混合权重」看 α 取舍。全现算。它是**定增益的简化卡尔曼**;进阶 Mahony/Madgwick。连「卡尔曼滤波/位姿与四元数」。详见讲解卡。',
  bounds: [
    '互补滤波 θ=α·(θ_prev+ω·dt)+(1−α)·θ_acc:高通陀螺(短期准长期漂)+低通加速度(绝对不漂但抖)',
    '陀螺积分短期准但 bias 累积无限漂;加速度由重力算绝对倾角不漂但噪声大抖、运动时污染;两个极端都不能单用',
    'α 定增益权衡:大(≈0.98)平滑抗抖纠漂慢、小跟加速度紧压漂快但抖;采样越快 α 越接近 1',
    '互补滤波=定增益的简化卡尔曼(卡尔曼增益随不确定度自适应、这里固定 1−α);进阶 Mahony/Madgwick(3D 四元数+在线估 bias)或 EKF。参考:姿态估计经典',
  ],
  tabs: [{ id: 'co', label: '互补滤波逐步跑' }], Stage: CompStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '高通陀螺+低通加速度' }
    : s.stage === 'behavior' ? { key: 'idle', label: 'α 取舍' }
    : s.stage === 'fuse' ? { key: 'good', label: `融=${s.fused}°` }
    : s.stage === 'accel' ? { key: 'idle', label: '加速度(抖)' }
    : s.stage === 'gyro' ? { key: 'idle', label: '陀螺(漂)' }
    : { key: 'idle', label: 'IMU 融合' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '融', gyro: '陀', accel: '加', fuse: '合', behavior: 'α', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '混合权重 α', value: `${s.alpha}` },
    { label: '陀螺 / 加速度', value: s.showAccel ? `${s.gyroPred}° / ${s.thetaAcc}°` : (s.showGyro ? `${s.gyroPred}° / —` : '—') },
    { label: '融合倾角', value: s.showFuse ? `${s.fused}°` : '—', tone: s.showFuse ? 'good' : undefined },
    { label: '本步', value: ({ intro: 'IMU 两毛病', gyro: '陀螺积分(漂)', accel: '加速度绝对(抖)', fuse: '互补融合', behavior: 'α 取舍', done: '高通陀螺+低通加速度' } as Record<string, string>)[s.stage] ?? '—' },
  ],
}
const kalman: Experiment<KalmanState> = {
  id: 'kalman', group: '机器人感知', title: '卡尔曼滤波', subtitle: '预测+观测按方差融合：机器人定位的地基',
  kernel: kalmanKernel, defaultDoc: { kind: 'kalman', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '每个传感器都有噪声（里程计漂移、GPS 跳）。卡尔曼把"运动预测的位置"和"观测的位置"按各自不确定度(方差)最优融合。1D 定位版两拍循环：predict 用里程计前推(方差 +Q 涨)、update 用 GPS 观测校正(增益 K=P/(P+R) 融合、方差 (1−K)P 缩)。u=1、Q=0.5、R=1 喂 4 个读数，估计贴着真值走、方差收敛。每步算术全真算。',
  bounds: ['每传感器有噪声→把运动预测与观测按各自方差最优融合;状态估计/SLAM的地基', 'Predict:x\'=x+u(里程计),P\'=P+Q(推得越久越不确定,方差涨)', 'Update:增益K=P\'/(P\'+R)权衡信预测还是信观测;x=x\'+K(z−x\'),P=(1−K)P\'(观测后方差缩)', '融合估计比单独预测或观测都准;方差predict涨update缩、收敛稳态(K→~0.5);EKF处理非线性'],
  tabs: [{ id: 'design', label: 'predict+update' }], Stage: KalmanStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '收敛贴真值' } : { key: 'idle', label: s.phase === 'predict' ? 'Predict·方差涨' : s.phase === 'update' ? 'Update·方差缩' : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 9)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.phase === 'predict' ? '预' : s.phase === 'update' ? '校' : '卡'),
  readouts: s => [
    { label: '本拍', value: s.op === 'predict' ? 'Predict' : s.op === 'update' || s.op === 'summary' ? 'Update' : '就绪' },
    { label: '估计 x / 真值', value: `${s.x} / ${s.truePos}` },
    { label: '方差 P', value: `${s.P}`, tone: s.phase === 'predict' ? 'bad' : 'good' },
    { label: '卡尔曼增益 K', value: s.K !== null ? `${s.K}` : '—' },
  ],
}

const mpc: Experiment<MPCState> = {
  id: 'mpc', group: '机器人控制', title: 'MPC 模型预测控制', subtitle: '预测未来+优化+只执行第一步；提前刹车不越界',
  kernel: mpcKernel, defaultDoc: { kind: 'mpc', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: 'PID/阻抗只看当前误差反应；MPC 每步用模型预测未来一段(预测时域)、优化整条控制序列(到目标+满足约束+省劲)、只执行第一步、下步重规划(滚动时域)。质量块要精准停在 x=10(也是墙)：MPC 每步算刹车距离(预测停点)，够到目标就提前刹车→停在 9.94；反应式无预测→冲过目标飙到 15.98。位置/速度/控制由双积分动力学真跑。',
  bounds: ['MPC三件套:用模型预测未来一段+优化整条控制序列(跟踪+约束+省劲)+只执行第一步再滚动重规划', '会往前看:能提前刹车/避让、显式满足约束(不越界/超速/超力矩),反应式做不到', '本例预测=刹车距离→预测停点,够到目标就提前刹→停在9.94;反应式冲到15.98(越界)', '代价:要准模型+每步在线求解(QP/NLP,算力大);用在自动驾驶/四足步态/无人机/过程控制'],
  tabs: [{ id: 'design', label: '预测控制' }], Stage: MPCStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '精准停住' } : s.phase === 'reactive' ? { key: 'bad', label: '反应式越界' } : { key: 'idle', label: s.phase === 'mpc' ? (s.braking ? 'MPC 刹车' : 'MPC 加速') : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 8)),
  tickLabel: s => (s.phase === 'done' ? '停' : s.phase === 'reactive' ? '冲' : s.op === 'sample' ? (s.braking ? '刹' : '加') : 'M'),
  readouts: s => [
    { label: '当前', value: s.op === 'reactive' ? '反应式(无预测)' : s.phase === 'done' ? 'MPC 停住' : s.phase === 'mpc' ? (s.braking ? 'MPC 刹车' : 'MPC 加速') : '就绪' },
    { label: '位置 x', value: s.op === 'reactive' ? `${s.reacMax}(越界)` : `${s.x}（目标 ${s.target}）`, tone: s.op === 'reactive' ? 'bad' : s.phase === 'done' ? 'good' : undefined },
    { label: '预测停点', value: s.op === 'sample' || s.op === 'summary' ? `${s.predStop}` : '—' },
    { label: '反应式 vs MPC', value: `${s.reacMax} vs ${s.phase === 'done' ? s.x : '~10'}` },
  ],
}

// ── 具身智能 · 机器人控制 ──
const impedance: Experiment<ImpState> = {
  id: 'impedance', group: '机器人控制', title: '阻抗 / 力控', subtitle: '柔顺接触：末端像虚拟弹簧，接触力可调',
  kernel: impedanceKernel, defaultDoc: { kind: 'impedance', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '装配/打磨/协作等接触任务，机器人不能只盯位置。纯位置控制很刚：撞上工件为消位置误差会硬顶出巨大接触力。阻抗控制让末端像虚拟弹簧+阻尼 F=K(x目标−x)−D·ẋ，遇阻柔顺让步，接触力≈K×侵入、K 你自己设。本例命令去 x=8、墙在 x=5：刚性(K=200)硬顶 480N，阻抗(K=25)动态逼近、轻贴、力 settle 到 ~73N。位置/接触力由弹簧-阻尼-墙反力动力学真跑。',
  bounds: ['接触任务:位置控制很刚→撞工件为消位置误差硬顶出巨大力(本例480N)、砸坏', '阻抗控制=末端像虚拟弹簧+阻尼 F=K(x目标−x)−D·ẋ,遇阻柔顺让步', '接触力≈K×侵入深度,K(刚度)是旋钮:软→轻贴/吸冲击/对人安全(本例73N),硬→接近位置控制', '变体:导纳控制(测力改位置)、混合力/位控(打磨:沿面控位/压向控力)、直接力控;靠力矩/力传感器测力'],
  tabs: [{ id: 'design', label: '柔顺接触' }], Stage: ImpedanceStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '柔顺贴合' } : s.phase === 'stiff' ? { key: 'bad', label: '刚性硬顶' } : { key: 'idle', label: s.phase === 'compliant' ? '阻抗逼近' : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 8)),
  tickLabel: s => (s.phase === 'done' ? '贴' : s.phase === 'stiff' ? '砸' : s.op === 'sample' ? `${s.t}` : '力'),
  readouts: s => [
    { label: '模式', value: s.phase === 'stiff' ? '刚性位置控制' : s.phase === 'done' ? '柔顺·稳定' : s.phase === 'compliant' ? '阻抗控制' : '就绪' },
    { label: '末端位置', value: `${s.x}（墙 ${s.xWall}）` },
    { label: '接触力', value: `${s.contactForce}N`, tone: s.contactForce > 200 ? 'bad' : s.contactForce > 0 ? 'good' : undefined },
    { label: '刚性 vs 柔顺', value: `${s.stiffForce}N vs ${s.phase === 'done' ? s.contactForce : '~73'}N` },
  ],
}

// ── 具身智能 · 机器人控制 ──
const pid: Experiment<PIDState> = {
  id: 'pid', group: '机器人控制', title: 'PID 控制', subtitle: '纯 P 震荡 vs 加 D 阻尼收敛到目标',
  kernel: pidKernel, defaultDoc: { kind: 'pid', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '让机器人关节/底盘停到目标靠反馈控制，最常用 PID：每拍算误差 e=目标−实际，三项合成控制量——P=Kp·e(误差越大越使劲)、D=Kd·误差变化率(快到时反向刹车、阻尼)、I=Ki·误差累计(消稳态误差)。被控对象是质量块(双积分)：纯 P 会冲过头震荡(到 11.77 还在涨)，加 Kd=0.9 后平稳收敛到目标 10。误差/三项/位置每步真算。',
  bounds: ['PID:u=Kp·e+Ki·∫e+Kd·(de/dt);P按当前误差、D按误差变化率、I按误差累计', '质量块(双积分)纯P必震荡:到目标还有速度、刹不住→冲过头→反向→来回震荡', 'D=Kd·误差变化率提供阻尼:快到时反向刹车、提前减速→平稳停住', 'I消除稳态误差(顶掉重力等恒定扰动);调参Kp快易震/Kd稳/Ki消稳态但易饱和超调'],
  tabs: [{ id: 'design', label: '闭环控制' }], Stage: PIDStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: 'PD 稳到目标' } : s.mode === 'P' && s.p > s.target ? { key: 'bad', label: '纯P冲过头' } : { key: 'idle', label: s.mode === 'P' ? '纯 P 控制' : s.mode === 'PD' ? 'P+D 控制' : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 15)),
  tickLabel: s => (s.phase === 'done' ? '稳' : s.op === 'switch' ? '+D' : s.mode === 'P' ? `P${s.k}` : s.mode === 'PD' ? `D${s.k}` : 'PID'),
  readouts: s => [
    { label: '控制器', value: s.mode === 'P' ? '纯 P' : s.mode === 'PD' ? 'P + D' : '就绪' },
    { label: '位置 / 目标', value: `${s.p} / ${s.target}`, tone: s.mode === 'P' && s.p > s.target ? 'bad' : s.phase === 'done' ? 'good' : undefined },
    { label: '误差 e', value: `${s.e}` },
    { label: '控制量 u = P+D', value: `${s.u}（P=${s.uP}${s.mode === 'PD' ? `, D=${s.uD}` : ''}）` },
  ],
}

// ── 具身智能 · 运动规划 ──
const rrtstar: Experiment<RRTSState> = {
  id: 'rrtstar', group: '运动规划', title: 'RRT* · 渐近最优', subtitle: '在 RRT 上加「选最优父 + 重连」两步，让树随采样收敛到最短路',
  kernel: rrtstarKernel, defaultDoc: { kind: 'rrtstar', params: { algo: 'RRT*' }, entities: [], streams: [] },
  params: [{ key: 'algo', label: '算法', kind: 'enum', options: ['RRT*', 'RRT只接最近'] }],
  paramsNote: '「RRT」每步把新点接到**最近**的树节点——快速找到**一条**可行路,但**接最近≠代价最小**、不最优。**RRT\*** 加两步→随采样**渐近最优**:①**选父(choose parent)**:新点在半径 r 邻域里选"起点→新点代价=cost[邻居]+dist"**最小**的邻居当父(非几何最近)②**重连(rewire)**:加完新点后,把邻域里"经新点更省"的邻居**改接到新点**、降其代价。邻域半径按 (γ·log n/n)^(1/d) 收缩。本例 x_new 代价 RRT=9(接最近 B)、RRT\*=6(选父 A)、邻居 B 被重连 8→7。切「算法」对比。全现算。连「RRT/A* 寻路/轨迹规划」。详见讲解卡。',
  bounds: [
    'RRT*=RRT+选父+重连:选父(邻域里挑代价最小的父、非最近)+重连(经新点更省的邻居改接到新点)→随采样渐近收敛最优',
    'RRT 只保证概率完备(找到一条可行路)、不最优(接最近≠代价最小);RRT* 还渐近最优',
    '邻域半径 r 按 (γ·log n/n)^(1/d) 随节点数收缩:保证渐近最优又不至于每步查太多邻居;代价是比 RRT 慢、每步开销大',
    '连:是 RRT 的最优化升级;和 A* 都求最优(A* 离散栅格/RRT* 连续采样);进阶 Informed RRT*/PRM*。参考:Karaman-Frazzoli 2011',
  ],
  tabs: [{ id: 'rs', label: 'RRT* 逐步跑' }], Stage: RrtStarStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '选父+重连' }
    : s.stage === 'compare' ? { key: 'good', label: `RRT*省到${s.starCost}` }
    : s.stage === 'rewire' ? (s.rewired.length ? { key: 'good', label: `重连${s.rewired.length}个` } : { key: 'idle', label: '无重连' })
    : s.stage === 'chooseparent' ? { key: 'good', label: `父=${s.chosenParent}` }
    : s.stage === 'sample' ? { key: 'idle', label: '采样+邻域' }
    : { key: 'idle', label: '渐近最优' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '优', sample: '采', chooseparent: '父', rewire: '连', compare: '比', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '算法', value: s.algoLabel },
    { label: 'x_new 父 / 代价', value: s.showParent ? `${s.chosenParent} / ${s.starCost}` : '—', tone: s.showParent ? 'good' : undefined },
    { label: '重连', value: s.showRewire ? (s.rewired.length ? s.rewired.map(r => `${r.id} ${r.oldCost}→${r.newCost}`).join('、') : '无') : '—' },
    { label: '对比 RRT 代价', value: s.showCompare ? `${s.rrtCost}（接最近 ${s.nearestId}）` : '—' },
  ],
}
const potentialfield: Experiment<PotState> = {
  id: 'potentialfield', group: '运动规划', title: '人工势场法', subtitle: '目标引力+障碍斥力，顺合力下山；快，但障碍正中会卡局部极小',
  kernel: potentialfieldKernel, defaultDoc: { kind: 'potentialfield', params: { scenario: '障碍正中' }, entities: [], streams: [] },
  params: [{ key: 'scenario', label: '障碍位置', kind: 'enum', options: ['障碍偏侧', '障碍正中'] }],
  paramsNote: '**势场法**不采样不搜图:目标造一个"低谷"(**引力** F_att=k_att·(q_goal−q)、拉向目标)、障碍造"高山"(**斥力** F_rep 仅 ρ≤ρ0、=k_rep·(1/ρ−1/ρ0)·(1/ρ²)·n̂、推离障碍、越近越猛),机器人顺**合力** F=F_att+F_rep 梯度下降。极简、反应式、快、天然实时避障。**死穴=局部极小**:障碍**正中**挡路时引力(朝目标)和斥力(离障碍)共线相反、某处抵消→合力≈0→卡在离目标还远的"假谷"、到不了(本例卡在离目标 5.43);障碍**偏侧**时斥力有横向分量→绕过到达。切「障碍位置」对比。解法:随机扰动/导航函数/配全局规划。全现算。连「RRT(全局无局部极小)/力控」。详见讲解卡。',
  bounds: [
    '势场法:引力 F_att=k_att·(q_goal−q) 拉向目标 + 斥力 F_rep(仅 ρ≤ρ0、∝1/ρ²)推离障碍,顺合力梯度下降;反应式、快',
    '死穴=局部极小:障碍正中时引力斥力共线相反、抵消→合力≈0→卡在离目标很远的假谷、到不了;窄通道还会震荡',
    '障碍偏侧时斥力有横向分量→合力偏向侧面绕过障碍;局部极小是拓扑问题、不是调参能根治',
    '解法:随机扰动跳出/导航函数(只有目标一个极小)/配全局规划(RRT/A* 出全局路、势场只做局部避障)。连 RRT(全局采样无局部极小)、力控虚拟弹簧同源',
  ],
  tabs: [{ id: 'po', label: '势场逐步跑' }], Stage: PotentialFieldStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '引力+斥力' }
    : s.stage === 'outcome' ? (s.stuck ? { key: 'bad', label: '卡局部极小' } : { key: 'good', label: '绕过到达' })
    : s.stage === 'total' ? { key: 'idle', label: `|F|=${s.fMag}` }
    : s.stage === 'repulsive' ? { key: 'idle', label: '斥力' }
    : s.stage === 'attractive' ? { key: 'idle', label: '引力' }
    : { key: 'idle', label: '势场' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '场', attractive: '引', repulsive: '斥', total: '合', outcome: '果', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '场景', value: s.scenLabel },
    { label: '引力 / 斥力', value: s.showRep ? `[${s.fAtt.join(',')}] / [${s.fRep.join(',')}]` : (s.showAtt ? `[${s.fAtt.join(',')}] / —` : '—') },
    { label: '合力 |F|', value: s.showTotal ? `${s.fMag}` : '—' },
    { label: '结局', value: s.showOut ? (s.stuck ? `卡局部极小(离目标 ${s.distToGoal})` : '绕过到达') : '—', tone: s.showOut ? (s.stuck ? 'bad' : 'good') : undefined },
  ],
}
const trapezoid: Experiment<TrapState> = {
  id: 'trapezoid', group: '运动规划', title: '梯形速度曲线', subtitle: '时间最优轨迹：加速-匀速-减速，v_max/a_max 约束下最快走完；短则退化三角',
  kernel: trapezoidKernel, defaultDoc: { kind: 'trapezoid', params: { distance: '长距离' }, entities: [], streams: [] },
  params: [{ key: 'distance', label: '移动距离', kind: 'enum', options: ['长距离', '短距离'] }],
  paramsNote: '「RRT/A\*」出的是**几何路径**(走哪),电机执行要**每时刻的速度**=轨迹规划。经典**梯形速度曲线**:全程用 a_max **加速**到 v_max→**匀速**→再 a_max **减速**到 0,在 v_max/a_max 约束下**时间最优**(bang-bang)。加速段 t_a=v_max/a_max、d_a=v_max²/(2a_max)。**判形**:D≥2 d_a→**梯形**(匀速段 d_c=D−2 d_a、总时 T=2 t_a+t_c);D<2 d_a→**三角**(达不到 v_max、峰值 v_peak=√(a_max·D)、T=2√(D/a_max))。本例 v_max=2、a_max=1:长距离 D=10→梯形 T=7s、短距离 D=3→三角 T=3.46s。切「距离」看两形态。全现算。S 曲线(限 jerk 更平滑)在小结。连「轨迹规划(三次多项式)/RRT」。详见讲解卡。',
  bounds: [
    '梯形速度曲线:加速(t_a=v_max/a_max、d_a=v_max²/(2a_max))-匀速-减速;bang-bang(取极值加速度)故时间最优',
    '判形:D≥2 d_a→梯形(达 v_max、有匀速段);D<2 d_a→三角(达不到、v_peak=√(a_max·D)、无匀速)',
    '总时间:梯形 T=2 t_a+t_c(t_c=(D−2 d_a)/v_max)、三角 T=2√(D/a_max);是约束下走完 D 的最短时间',
    'S 曲线:再限 jerk(加速度变化率)、更柔更抗振、稍慢。连轨迹规划(三次多项式是另一插值)、RRT/A*(几何路径每段配速度曲线才能执行)',
  ],
  tabs: [{ id: 'tz', label: '速度曲线逐步跑' }], Stage: TrapezoidStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '时间最优' }
    : s.stage === 'time' ? { key: 'good', label: `T=${s.tTotal}s` }
    : s.stage === 'profile' ? { key: 'idle', label: s.isTrap ? '梯形三段' : '三角两段' }
    : s.stage === 'regime' ? { key: 'idle', label: s.isTrap ? '梯形' : '三角' }
    : s.stage === 'accel' ? { key: 'idle', label: '加速段' }
    : { key: 'idle', label: '速度曲线' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '轨', accel: '加', regime: '形', profile: '段', time: 'T', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '距离 / v_max / a_max', value: `${s.D} / ${s.vMax} / ${s.aMax}` },
    { label: '加速段 t_a / d_a', value: s.showAccel ? `${s.tA}s / ${s.dA}m` : '—' },
    { label: '形态', value: s.showRegime ? (s.isTrap ? '梯形（达 v_max）' : `三角（v_peak=${s.vPeak}）`) : '—' },
    { label: '总时间 T', value: s.showTime ? `${s.tTotal}s` : '—', tone: s.showTime ? 'good' : undefined },
  ],
}
const prm: Experiment<PrmState> = {
  id: 'prm', group: '运动规划', title: 'PRM 概率路图', subtitle: '先撒点连成无碰路图、再图搜索；建一次路图答多次查询（多查询）',
  kernel: prmKernel, defaultDoc: { kind: 'prm', params: { density: '够密' }, entities: [], streams: [] },
  params: [{ key: 'density', label: '采样密度', kind: 'enum', options: ['够密', '太稀'] }],
  paramsNote: '和「RRT」(单查询、朝一个目标长树)不同,PRM 是**多查询**:①**建图**:自由空间随机采样 N 个构型当节点,每个连 k 近邻——但**边要碰撞检测、穿过障碍的边丢掉**(碰撞检测最贵);②**查询**:起点/终点接入路图、用 Dijkstra/A* 搜最短路。建一次路图可**反复答不同起终点**的查询(适合固定环境反复规划)。本例最短的 B-D 边被障碍挡→路径绕障碍上方 S-A-C-D-G(9.48)。**难点=窄通道/采样密度**:采样太稀路图会**断开**、找不到路。切「采样密度」看够密(连通)vs 太稀(断开)。全现算。连「RRT(单查询)/A*·Dijkstra(图搜索)」。详见讲解卡。',
  bounds: [
    'PRM 两阶段:建图(采样自由构型当节点、连 k 近邻、边碰撞检测丢掉穿障的)+查询(起终点接入、Dijkstra/A* 搜路)',
    'PRM 多查询(建一次路图答多次、适合固定环境反复规划) vs RRT 单查询(朝一目标长树、用完即弃);都概率完备',
    '边的碰撞检测是最贵的一步;窄通道采样概率低→路图易断(采样太稀就找不到路,不是没路是没覆盖到)',
    '对策:加采样/窄通道采样(桥采样、高斯采样)/PRM*(渐近最优、连接半径随 n 收缩)。连 RRT/RRT*、查询就是 A*·Dijkstra、路再配轨迹',
  ],
  tabs: [{ id: 'pm', label: 'PRM 逐步跑' }], Stage: PrmStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '建图+查询' }
    : s.stage === 'outcome' ? (s.connected ? { key: 'good', label: '连通找到路' } : { key: 'bad', label: '断开无路' })
    : s.stage === 'query' ? (s.connected ? { key: 'good', label: `路长 ${s.pathLen}` } : { key: 'bad', label: '无路' })
    : s.stage === 'connect' ? { key: 'idle', label: `路图 ${s.roadmap.length} 边` }
    : s.stage === 'sample' ? { key: 'idle', label: `${s.nodes.length} 节点` }
    : { key: 'idle', label: '多查询' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '图', sample: '采', connect: '连', query: '搜', outcome: '果', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '采样密度', value: s.densLabel },
    { label: '路图边 / 被挡', value: s.showConnect ? `${s.roadmap.length} / ${s.edges.filter(e => e.blocked).length}` : '—' },
    { label: '连通性', value: s.showOut ? (s.connected ? '连通' : '断开') : '—', tone: s.showOut ? (s.connected ? 'good' : 'bad') : undefined },
    { label: '最短路', value: s.showQuery ? (s.connected ? `${s.path.join('→')}（${s.pathLen}）` : '无路') : '—' },
  ],
}
const chomp: Experiment<ChompState> = {
  id: 'chomp', group: '运动规划', title: 'CHOMP 轨迹优化', subtitle: '把整条轨迹当变量、梯度下降降"平滑+避障"代价；优化式规划',
  kernel: chompKernel, defaultDoc: { kind: 'chomp', params: { weight: '避障优先' }, entities: [], streams: [] },
  params: [{ key: 'weight', label: '代价权重', kind: 'enum', options: ['避障优先', '平滑优先'] }],
  paramsNote: '和 RRT/A*(采样/搜索)不同,CHOMP 是**优化式规划**:把整条轨迹 ξ=[q_1..q_n] 当变量、定义**代价 U=平滑项+避障项**、做**梯度下降** ξ←ξ−α∇U。**避障梯度**把靠近障碍(影响半径 d0 内)的路点往外推(∝(d0−dist)·远离方向);**平滑梯度**把每点拉向邻居中点(Laplacian、∝2q_i−q_{i−1}−q_{i+1}、直线上=0)。本例 5 路点直线 S(0,0)→G(4,0)穿过障碍(2,0.6)旁,中点 q2=(2,0)离障碍0.6<d0=1、被避障梯度往下推:**避障优先**(k_obs=2)推到(2,−0.8)、**平滑优先**(k_obs=0.5)只到(2,−0.2)(更直但擦障碍)。迭代→整条平滑绕过。**局部极小**(同势场)是死穴、常先 RRT 出初值再 CHOMP。切「权重」对比。全现算。连「轨迹规划/RRT/势场法」。详见讲解卡。',
  bounds: [
    'CHOMP 优化式规划:整条轨迹当变量、代价 U=平滑项+避障项、梯度下降 ξ←ξ−α∇U',
    '避障梯度∝(d0−dist)·远离方向(推离障碍、越近越猛);平滑梯度=邻居中点−q_i(Laplacian、拉平、直线上=0)',
    '协变(covariant):用度量矩阵 A(平滑度)做更新、非朴素欧氏梯度、更稳;死穴=局部极小(同势场、常多初值或先 RRT 出初值)',
    'vs 采样(RRT)/搜索(A*)/反应(势场):优化直接产出平滑可执行轨迹。RRT 可当 CHOMP 初值;和 STOMP(采样)/TrajOpt(序列凸)同类。参考:Zucker CHOMP',
  ],
  tabs: [{ id: 'cm', label: '轨迹优化逐步跑' }], Stage: ChompStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '平滑+避障下降' }
    : s.stage === 'step' ? { key: 'good', label: `q2→(${s.q2New})` }
    : s.stage === 'smooth' ? { key: 'idle', label: '平滑梯度' }
    : s.stage === 'obstacle' ? { key: 'bad', label: '避障梯度' }
    : s.stage === 'traj' ? { key: 'idle', label: '初始直线' }
    : { key: 'idle', label: '优化轨迹' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '优', traj: '直', obstacle: '避', smooth: '平', step: '降', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '代价权重', value: s.wLabel },
    { label: 'q2 离障碍', value: s.showTraj ? `${s.distToObs}（d0=${s.d0}）` : '—', tone: s.showTraj && s.distToObs < s.d0 ? 'bad' : undefined },
    { label: '避障 / 平滑梯度', value: s.showSmooth ? `[${s.gObs}] / [${s.gSmooth}]` : (s.showObs ? `[${s.gObs}] / —` : '—') },
    { label: 'q2 更新后', value: s.showStep ? `(${s.q2New})` : '—', tone: s.showStep ? 'good' : undefined },
  ],
}
const gjk: Experiment<GjkState> = {
  id: 'gjk', group: '运动规划', title: 'GJK 碰撞检测', subtitle: '两凸形碰不碰=原点在不在 Minkowski 差里；支撑函数懒惰围原点建单纯形',
  kernel: gjkKernel, defaultDoc: { kind: 'gjk', params: { scenario: '相交' }, entities: [], streams: [] },
  params: [{ key: 'scenario', label: '场景', kind: 'enum', options: ['相交', '分离'] }],
  paramsNote: '运动规划每走一步都要问"机器人和障碍碰了吗"。GJK(Gilbert–Johnson–Keerthi)是**凸形碰撞检测**的标准算法,两招:①**Minkowski 差 A⊖B={a−b}**:两凸形相交 ⟺ **原点∈A⊖B**(把"碰不碰"变成"含不含原点");②**支撑函数 support(d)=沿方向 d 最远的顶点**:不显式建整个 A⊖B,每轮只朝一个方向要一个最远点 **a=support_A(d)−support_B(−d)**,懒惰地围原点建**单纯形**(2D 最多三角形)。每轮:朝当前方向(指向原点)取支撑点 a;若 **a·d<0**(最远都没越过原点)→ 原点在外、**不碰**、提前停;否则 a 加进单纯形、doSimplex 丢掉离原点远的点、方向重新指向原点;**三角形一旦含原点=碰**。本例两矩形 A=[1,1]~[4,4]:相交场景(B=[3,2]~[6,5])2 轮把原点围进三角形→碰;分离场景(B=[6,2]~[9,5])第 2 轮 a·d=−144<0→不碰。支撑点/单纯形/方向/Minkowski 差全现算。切「场景」对比。连「运动规划(碰撞检测是每步前提)/EPA(求穿透深度)/SAT」。详见讲解卡。',
  bounds: [
    'GJK 两招:①Minkowski 差 A⊖B(两凸形碰 ⟺ 原点∈A⊖B);②支撑函数 support(d)=沿 d 最远顶点(不显式建整个差集)',
    '每轮朝指向原点的方向取支撑点 a=support_A(d)−support_B(−d),懒惰围原点建单纯形(2D 三角形);doSimplex 丢无用点、方向重新指向原点',
    '两个出口:三角形含原点→碰;某轮 a·d<0(最远都没越过原点)→不碰、提前停(高效关键)',
    '对任意凸形只需支撑函数(圆/胶囊/多面体都行)、无需预建差集;求穿透深度/最小平移向量接 EPA;凹形要先凸分解。是运动规划每步碰撞检测的常用底层。参考 GJK/EPA、SAT 分离轴',
  ],
  tabs: [{ id: 'gk', label: 'GJK 逐轮跑' }], Stage: GjkStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? (s.collide ? { key: 'bad', label: '碰撞' } : { key: 'good', label: '不碰' })
    : s.stage === 'result' && s.contained ? { key: 'bad', label: '三角形含原点' }
    : s.stage === 'support' && !s.passed ? { key: 'good', label: 'a·d<0 不碰' }
    : s.stage === 'support' ? { key: 'idle', label: `第 ${s.iterNo} 轮支撑点` }
    : s.stage === 'simplex' ? { key: 'idle', label: 'doSimplex' }
    : { key: 'idle', label: 'Minkowski 差' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => (s.stage === 'done' ? (s.collide ? '碰' : '离') : s.stage === 'support' ? `${s.iterNo}` : s.stage === 'simplex' ? 'Δ' : 'G'),
  readouts: s => [
    { label: '场景', value: s.scenLabel },
    { label: 'GJK 轮次', value: s.iterNo ? `第 ${s.iterNo} 轮` : '就绪' },
    { label: 'a·d', value: (s.stage === 'support' || s.stage === 'simplex' || s.stage === 'result') ? `${s.adot}` : '—', tone: (s.stage === 'support' || s.stage === 'simplex' || s.stage === 'result') ? (s.passed ? undefined : 'good') : undefined },
    { label: '结论', value: s.stage === 'done' ? (s.collide ? '碰撞' : '不碰') : s.contained ? '含原点·碰' : '—', tone: s.stage === 'done' ? (s.collide ? 'bad' : 'good') : undefined },
  ],
}
const dubins: Experiment<DubinsState> = {
  id: 'dubins', group: '运动规划', title: 'Dubins 曲线', subtitle: '只能前进、有最小转弯半径的车，两位姿间最短路=转-直-转三段（6 种词取最短）',
  kernel: dubinsKernel, defaultDoc: { kind: 'dubins', params: { heading: '朝上' }, entities: [], streams: [] },
  params: [{ key: 'heading', label: '终点朝向', kind: 'enum', options: ['朝上', '朝下'] }],
  paramsNote: '车/差速底盘不像机械臂能任意方向移动——**不能横着走**(非完整约束 nonholonomic)、且有**最小转弯半径 R**(方向盘打死也只能拐这么急)。**Dubins(1957)** 证明:只前进的车,任意两个**位姿(位置+朝向)**间的**最短路**一定是**三段**、只可能是 **6 种"词"**之一:**CSC**(转-直-转)LSL/RSR/LSR/RSL、**CCC**(转-转-转)RLR/LRL(近距离才用)。每种词用**闭式几何**直接算三段长度(转弯段弧度、直线段长度、半径都=R)、取总长最短。本例起点(0,0,东 0°)、终点(3,2)、R=1:终点**朝上(90°)**→最优 **LSL**(左转0.464+直2.236+左转1.107=3.807);终点**朝下(−90°)**→最优 **LSR**(1.571+1+3.142=5.712)。**同起终位置、只改朝向,最优词就从 LSL 变 LSR**——最优路径由位姿决定。长度全用 Dubins 闭式现算、并按三段重建验证终点严格落在目标位姿(误差 0)。切「朝向」对比。连「RRT/PRM(车上两点转移换成 Dubins)/混合A*/Reeds-Shepp(可倒车版)」。详见讲解卡。',
  bounds: [
    '非完整约束(不能横走)+最小转弯半径 R;Dubins:只前进的车两位姿间最短路一定是三段、6 种词之一(CSC LSL/RSR/LSR/RSL + CCC RLR/LRL)',
    '每种词闭式几何直接算三段(两段圆弧转角+一段公切线)、取总长最短、不用搜索;转弯半径都=R',
    '最优词由位姿决定:本例同起终位置、终点朝上→LSL(3.807)、朝下→LSR(5.712);Dubins 把 (α,β,d) 参数空间分区、每块对应一种最优词',
    '给车式/差速机器人规划:RRT/PRM 的两点转移要换成 Dubins(直线拐不过来);混合 A* 用作启发与末端接入;Reeds-Shepp 是可倒车推广(多 6 种含后退的词)。参考 Dubins 1957、LaValle 规划算法 §15.3',
  ],
  tabs: [{ id: 'du', label: 'Dubins 逐步跑' }], Stage: DubinsStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: `最优 ${s.bestType}` }
    : s.stage === 'segments' ? { key: 'good', label: `${s.bestType} 三段` }
    : s.stage === 'best' ? { key: 'good', label: `${s.bestType}=${s.len}` }
    : s.stage === 'words' ? { key: 'idle', label: '四词算长度' }
    : s.stage === 'circles' ? { key: 'idle', label: '转向圆' }
    : { key: 'idle', label: '非完整约束' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '车', circles: '圆', words: '词', best: '选', segments: '段', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '终点朝向', value: s.scenLabel },
    { label: '最优词', value: s.showBest ? s.bestType : '—', tone: s.showBest ? 'good' : undefined },
    { label: '最短总长', value: s.showBest ? `${s.len}` : '—', tone: s.showBest ? 'good' : undefined },
    { label: '三段(转+直+转)', value: s.showBest ? `${s.t}+${s.p}+${s.q}` : '—' },
  ],
}
const rrtconnect: Experiment<RRTCState> = {
  id: 'rrtconnect', group: '运动规划', title: 'RRT-Connect 双向规划', subtitle: '起点树+终点树同时长、EXTEND 迈步 + CONNECT 贪心连接：MoveIt/OMPL 默认',
  kernel: rrtconnectKernel, defaultDoc: { kind: 'rrtconnect', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '单树 RRT 从起点一棵树慢慢长到终点。**RRT-Connect** 是加速版、也是 **MoveIt/OMPL 机械臂规划的默认**:①**两棵树**——一棵从起点、一棵从终点;②**EXTEND**——随机采样、让当前树朝采样点**迈一步**得 q_new(撞障碍就丢);③**CONNECT(贪心)**——让**另一棵树朝 q_new 连续迈步(一次走一串、不是一步)**、直到够到 q_new(相遇)或撞障碍停;④两树相遇 → 从相遇点回溯、**拼出起点→终点整条路**,没相遇就**交换两树**再来。双向+贪心让搜索快得多(两头对着挖)。同样**概率完备、不最优**(路径要后处理平滑)。本例 10×10 世界、中央障碍、起点(1,1)↔终点(9,9)、固定种子可复现:两树各绕障碍一侧、CONNECT 接上、拼出 12 段路径。采样/最近点/迈步/贪心连接/碰撞全真算。连「RRT(单树)/RRT*(最优)/PRM(多查询)/Dubins(车上两点转移)」。详见讲解卡。',
  bounds: [
    'RRT-Connect:双向两棵树(起点树+终点树)+贪心 CONNECT;是 MoveIt/OMPL 机械臂规划默认',
    'EXTEND:采样、当前树朝采样点迈一步得 q_new(撞障碍丢);CONNECT:另一棵树朝 q_new 连续迈步(一次走一串)直到够到或撞障碍',
    '两树相遇→回溯拼出完整路径;没相遇→交换两树再来。双向+贪心比单树 RRT 快很多',
    '概率完备但不最优(路径歪、要后处理平滑或双向 RRT*);高维关节空间照用。连 RRT/RRT*/PRM/Dubins',
  ],
  tabs: [{ id: 'rc', label: '双向长树' }], Stage: RrtConnectStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '两树相遇' }
    : s.op === 'reject' ? { key: 'bad', label: 'EXTEND 撞障碍' }
    : s.op === 'connect' ? { key: 'idle', label: 'CONNECT 未接上' }
    : s.op === 'extend' ? { key: 'idle', label: `EXTEND ${s.extendS ? '起点' : '终点'}树` }
    : { key: 'idle', label: '双向搜索' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 21)),
  tickLabel: s => (s.phase === 'done' ? '接' : s.op === 'reject' ? '丢' : s.op === 'connect' ? 'C' : s.op === 'extend' ? 'E' : 'RC'),
  readouts: s => [
    { label: '起点树 / 终点树', value: `${s.treeS.length} / ${s.treeG.length} 节点` },
    { label: '本步', value: s.op === 'extend' ? `EXTEND ${s.extendS ? '起点' : '终点'}树` : s.op === 'connect' ? `CONNECT ${s.extendS ? '终点' : '起点'}树` : s.op === 'reject' ? 'EXTEND 撞障碍' : s.op === 'summary' ? '两树相遇' : '就绪' },
    { label: '丢弃', value: `${s.rejected}`, tone: s.rejected > 0 ? 'bad' : undefined },
    { label: '路径', value: s.path ? `${s.path.length - 1} 段` : '—', tone: s.found ? 'good' : undefined },
  ],
}
const dstarlite: Experiment<DStarState> = {
  id: 'dstarlite', group: '运动规划', title: 'D* Lite 增量重规划', subtitle: '地图变了只局部修复旧计划、不从头重搜：g/rhs + 只重算受影响的格',
  kernel: dstarliteKernel, defaultDoc: { kind: 'dstarlite', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '机器人在**部分已知/动态**地图里走,边走边用传感器发现新障碍。每次都从头 A* / Dijkstra 重搜太浪费。**D* Lite(Koenig & Likhachev)** 是增量式重规划:改动只让**局部失效、只修那一小块**。核心两量:**g(s)**=已知从起点到 s 的最优代价;**rhs(s)**=一步前瞻 min_邻居(g+边权)(起点 rhs=0);**局部一致** g=rhs。边权一变,受影响格 g≠rhs(不一致)→进优先队列、只重算这些格及其下游、其余 g 原样复用。本例 7×5 栅格、起点(0,2)→终点(6,2)、四连通(此处 h=0=增量 Dijkstra、加 h>0 即 A* 制导的 D* Lite):初次规划算出整张 g 表、直穿第 2 行(代价 6、展开 35 格);(3,2) 突然变障碍 → 只有 4 格受影响、增量修复只展开 6 格、新路绕第 3 行(代价 8);从头重搜要 34 格——地图越大改动越局部、优势越夸张。g/rhs/展开全真算。连「A*(启发式)/RRT(采样式)/SLAM(边走边建图触发重规划)」。详见讲解卡。',
  bounds: [
    'D* Lite:增量式重规划,地图变了只局部修复旧计划、不从头重搜;g(从起点最优代价)、rhs(一步前瞻 min 邻居 g+边权)、局部一致 g=rhs',
    '边权变→受影响格 g≠rhs(不一致)→优先队列→只重算这些格及下游、其余 g 原样复用',
    '本例(3,2)变障碍:只 4 格 g 变、增量修复展开 6 格(从头重搜 34)、新路代价 6→8;地图越大改动越局部、省得越多',
    '机器人边走边发现障碍(接 SLAM)用它省巨量计算,动态/未知环境导航标准(火星车、field D*)。h>0 即 A* 制导;vs LPA*(起点会动+km 项)。参考 Koenig & Likhachev 2002',
  ],
  tabs: [{ id: 'ds', label: '增量重规划' }], Stage: DStarLiteStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: `增量 ${s.expInc} vs 从头 ${s.expFull}` }
    : s.stage === 'compare' ? { key: 'good', label: `复用 ${s.reused} 格` }
    : s.stage === 'repair' ? { key: 'good', label: `只修 ${s.changed.length} 格` }
    : s.stage === 'change' ? { key: 'bad', label: '障碍出现在路上' }
    : s.stage === 'initial' ? { key: 'idle', label: `代价 ${s.gGoal}` }
    : { key: 'idle', label: '增量重规划' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: 'D', initial: '规', change: '障', repair: '修', compare: '比', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '终点 g（路径代价）', value: `${s.gGoal}` },
    { label: '受影响格数', value: s.showChanged ? `${s.changed.length}` : '—', tone: s.showChanged ? undefined : undefined },
    { label: '增量修复展开', value: s.showChanged ? `${s.expInc} 格` : '—', tone: s.showChanged ? 'good' : undefined },
    { label: '从头重搜展开', value: s.showChanged ? `${s.expFull} 格` : '—', tone: s.showChanged ? 'bad' : undefined },
  ],
}
const rrt: Experiment<RRTState> = {
  id: 'rrt', group: '运动规划', title: 'RRT 运动规划', subtitle: '采样式避障：随机长树绕障碍到终点',
  kernel: rrtKernel, defaultDoc: { kind: 'rrt', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '机器人从起点到终点绕开障碍=运动规划。RRT(快速探索随机树)反复：随机采样→找树上最近节点→朝它迈一步(step)→撞障碍/出界就丢弃、否则加进树，够到终点再回溯出路径。10×10 世界+中央障碍，固定种子伪随机(可复现)长出 11 节点的树、绕过障碍、8 段路径。采样/最近点/碰撞判定全真算。',
  bounds: ['RRT:随机采样+找最近节点+朝它迈一步step+撞障碍丢弃,树朝空白蔓延自动绕障碍', 'goal bias:偶尔直接采终点加速收敛;够到终点沿父指针回溯出路径', '概率完备(采样够多迟早找到)但不最优(路径歪,要平滑或RRT*边长边改父求近似最优)', '高维(机械臂6/7关节空间)也照用—采样式打败网格法维度爆炸;配IK(路径点→关节角)+PID(跟踪)避障抓取'],
  tabs: [{ id: 'design', label: '长树避障' }], Stage: RRTStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '找到路径' } : s.op === 'reject' ? { key: 'bad', label: '撞障碍丢弃' } : { key: 'idle', label: s.phase === 'grow' ? `树 ${s.nodes.length} 节点` : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 20)),
  tickLabel: s => (s.phase === 'done' ? '路' : s.op === 'reject' ? '丢' : s.op === 'extend' ? '+' : 'R'),
  readouts: s => [
    { label: '树节点数', value: `${s.nodes.length}` },
    { label: '丢弃(撞障碍/出界)', value: `${s.rejected}`, tone: s.rejected > 0 ? 'bad' : undefined },
    { label: '状态', value: s.found ? '到达终点' : '探索中', tone: s.found ? 'good' : undefined },
    { label: '路径', value: s.path ? `${s.path.length - 1} 段` : '—' },
  ],
}

const pinhole: Experiment<PinState> = {
  id: 'pinhole', group: '机器人感知', title: '针孔相机 · 投影与畸变', subtitle: '3D 点→2D 像素：透视除以深度 + 内参 K + 径向畸变',
  kernel: pinholeKernel, defaultDoc: { kind: 'pinhole', params: { distort: '有畸变' }, entities: [], streams: [] },
  params: [{ key: 'distort', label: '畸变', kind: 'enum', options: ['有畸变', '无畸变'] }],
  paramsNote: '针孔相机把 3D 点映到 2D 像素:**u=K·[R|t]·X**。①**外参[R|t]** 世界→相机 ②**透视**归一化 x_n=X/Z、y_n=Y/Z(**除以深度**、近大远小、单张图丢深度)③**内参 K** u=fx·x_n+cx、v=fy·y_n+cy(fx,fy 焦距[像素]、cx,cy 主点≈图心)④**径向畸变** r²=x_n²+y_n²、x_d=x_n(1+k1 r²+k2 r⁴)(桶形/枕形、**离中心越远越弯**)。本例 X=(3,2,5)、fx=fy=500、主点(320,240)、k1=0.2/k2=0.05:无畸变像素 (620,440);有畸变 (655,464)、偏 42px。**标定**=拍棋盘格从已知 3D↔2D 反求 K 和畸变系数(张正友法)、用图前先去畸变。切「畸变」对比。全现算。连「ICP/SLAM/手眼标定/6D位姿(都要相机模型)」。详见讲解卡。',
  bounds: [
    '针孔 u=K[R|t]X:外参世界→相机、透视 x_n=X/Z(除以深度、近大远小、丢深度)、内参 K→像素、径向畸变',
    '内参 fx,fy 焦距(像素)+cx,cy 主点;透视投影非线性(除法)、单张图不同 Z 同 X/Z 投到同一像素(丢深度)',
    '径向畸变 x_d=x_n(1+k1 r²+k2 r⁴):离中心越远越弯(桶形/枕形)、边缘明显中心几乎不变;用图前去畸变',
    '标定(张正友法):拍棋盘格、从已知 3D↔2D 反求 K 和畸变系数。是视觉几何地基:ICP/SLAM 反投影、立体视觉求深度、6D位姿/手眼标定都要 K',
  ],
  tabs: [{ id: 'ph', label: '投影逐步跑' }], Stage: PinholeStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '透视+内参+畸变' }
    : s.stage === 'result' ? (s.dist === 'on' ? { key: 'bad', label: `偏 ${s.shift}px` } : { key: 'good', label: '理想像素' })
    : s.stage === 'distortion' ? { key: 'idle', label: '径向畸变' }
    : s.stage === 'intrinsic' ? { key: 'idle', label: '内参 K' }
    : s.stage === 'perspective' ? { key: 'idle', label: '除以深度' }
    : { key: 'idle', label: '3D→2D' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '投', perspective: '透', intrinsic: 'K', distortion: '畸', result: '果', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '畸变', value: s.distLabel },
    { label: '归一化 x_n,y_n', value: s.showPersp ? `${s.xn}, ${s.yn}` : '—' },
    { label: '理想像素', value: s.showIntr ? `(${s.uIdeal}, ${s.vIdeal})` : '—' },
    { label: '最终像素', value: s.showResult ? (s.dist === 'on' ? `(${s.uDist}, ${s.vDist}) 偏${s.shift}px` : `(${s.uIdeal}, ${s.vIdeal})`) : '—', tone: s.showResult ? (s.dist === 'on' ? 'bad' : 'good') : undefined },
  ],
}
const pointcloud: Experiment<CloudState> = {
  id: 'pointcloud', group: '机器人感知', title: '点云预处理 · 下采样+法线', subtitle: '体素下采样降密度 + PCA 求表面法线：配准/建图前必做',
  kernel: pointcloudKernel, defaultDoc: { kind: 'pointcloud', params: { voxel: '细' }, entities: [], streams: [] },
  params: [{ key: 'voxel', label: '下采样分辨率', kind: 'enum', options: ['细', '粗'] }],
  paramsNote: '深度相机/激光出的原始点云**又密又不均、还带噪**,配准(ICP)/建图前先做两步预处理。①**体素下采样(voxel grid)**:把空间切成边长 **L** 的网格(点落哪格看 ⌊坐标/L⌋)、**每个占用体素只保留落在里面所有点的质心**→点数降下来、密度变均匀(L 越大越粗)。②**法线估计(PCA)**:法线是局部性质→对目标点找 **k 近邻**、算邻域 **2×2 协方差矩阵 C**(点云往哪散、散多大)、做**特征分解**——**最小特征值的特征向量=表面法线**(方差最小方向⊥局部面)、最大的=切向;**λ小/λ大** 判形状(≈0 局部很平、两 λ 都不小=边/角)。本例 2D、8 点在斜面上:L=1 下采样到 5 个体素(切「分辨率」看 L=2→2 个);对点(1.6,1.3)取 4 近邻、C=[[0.287,0.331],[0.331,0.413]]、λ=0.687/0.013→法线≈[−0.77,0.64](⊥斜面)。全现算。连「ICP(配准前下采样、点到面误差要法线)/SLAM/PCA 降维(同一套特征分解)」。详见讲解卡。',
  bounds: [
    '点云预处理两步:①体素下采样(边长 L 网格、每格取质心→降密度、密度均匀化);②法线估计(PCA)。配准/建图前必做',
    '法线估计:找 k 近邻→邻域协方差矩阵 C→特征分解,**最小特征值对应的特征向量=表面法线**(方差最小方向⊥面)、最大特征值=切向',
    'λ小/λ大 判局部形状:≈0→平面(法线可靠)、两个都不小→边/角(法线不确定);法线有±方向歧义、一般统一朝相机',
    '为什么重要:「ICP」配准前先下采样(快、稳),点到面(point-to-plane)ICP 的误差要用法线(比点到点收敛快);法向一致性剔外点;曲面重建/抓取姿态都要法线。PCA 和「PCA 降维」同一套特征分解',
  ],
  tabs: [{ id: 'pc', label: '预处理逐步跑' }], Stage: PointCloudStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '下采样+法线' }
    : s.stage === 'pca' ? { key: 'good', label: `法线 [${s.normal}]` }
    : s.stage === 'covariance' ? { key: 'idle', label: '协方差 C' }
    : s.stage === 'neighbors' ? { key: 'idle', label: `k=${s.nbrs.length} 近邻` }
    : s.stage === 'voxel' ? { key: 'idle', label: `${s.raw.length}→${s.voxels.length}` }
    : { key: 'idle', label: '原始点云' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '云', voxel: '采', neighbors: 'k', covariance: 'C', pca: '法', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '下采样', value: `${s.resLabel.split('(')[0]} L=${s.L}` },
    { label: '点数', value: s.showVoxel ? `${s.raw.length}→${s.voxels.length}` : '—' },
    { label: 'λ小/λ大', value: s.showPca ? `${s.lamSmall} / ${s.lamBig}` : '—' },
    { label: '法线(小λ特征向量)', value: s.showPca ? `[${s.normal}]` : '—', tone: s.showPca ? 'good' : undefined },
  ],
}
const stereo: Experiment<StereoState> = {
  id: 'stereo', group: '机器人感知', title: '双目立体视觉 · 视差求深度', subtitle: '两个平行相机把针孔丢掉的深度找回来：视差 d=f·b/Z、深度 Z=f·b/d',
  kernel: stereoKernel, defaultDoc: { kind: 'stereo', params: { depth: '近处' }, entities: [], streams: [] },
  params: [{ key: 'depth', label: '物体远近', kind: 'enum', options: ['近处', '远处'] }],
  paramsNote: '单个针孔相机把 3D 压成 2D、**丢了深度**(不同 Z、同 X/Z 投到同一像素、单目测不了绝对距离)。**双目(立体)** 用**两个平行相机**(相隔基线 b)找回深度:同一 3D 点在左右图横坐标不同,①左右投影 x_L=f·X/Z+cx、x_R=f·(X−b)/Z+cx;②**视差 d=x_L−x_R=f·b/Z**(∝1/Z、**近大远小**);③**深度 Z=f·b/d**(测出视差就得深度、逐像素→深度图);④**精度 ΔZ≈Z²/(f·b)·Δd ∝ Z²**(远处极不准、误差随距离平方涨)。本例 f=500px、b=0.1m:近处点(Z=2m)视差 25px、远处点(Z=5m)视差 10px、Z=f·b/d 现算还原;1px 视差误差 → 近处 ΔZ=0.08m、远处 0.5m(差 6.25 倍)。切「远近」对比视差与精度。全现算。连「针孔相机(逆问题)/对极几何(找对应)/ICP/SLAM」。详见讲解卡。',
  bounds: [
    '双目找回针孔丢的深度:左右两个平行相机(基线 b),同一点横坐标不同→视差里藏深度',
    '视差 d=x_L−x_R=f·b/Z(∝1/Z、近大远小、和横坐标 X 无关);深度 Z=f·b/d(测视差就得深度、逐像素得深度图)',
    '深度精度 ΔZ≈Z²/(f·b)·Δd ∝ Z²:远处极不准(误差随距离平方增长);加大基线 b/焦距 f/做亚像素视差可改善',
    '找对应(左像素↔右像素):平行相机下对应点在同一行(极线水平);是被动深度相机(RealSense/ZED)/立体 SLAM 的地基。主动(结构光/ToF) vs 被动(双目);单目深度靠先验无绝对尺度',
  ],
  tabs: [{ id: 'st', label: '求深度逐步跑' }], Stage: StereoStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '视差→深度' }
    : s.stage === 'precision' ? { key: 'bad', label: `ΔZ ∝ Z²` }
    : s.stage === 'depth' ? { key: 'good', label: `Z=${s.Zrec}m` }
    : s.stage === 'disparity' ? { key: 'idle', label: `视差 ${s.disp}px` }
    : s.stage === 'project' ? { key: 'idle', label: '左右投影' }
    : { key: 'idle', label: '双目' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '双', project: '投', disparity: '差', depth: '深', precision: '精', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '场景', value: s.scenLabel },
    { label: '视差 d', value: s.showDisp ? `${s.disp}px` : '—' },
    { label: '深度 Z=f·b/d', value: s.showDepth ? `${s.Zrec}m（真 ${s.Ztrue}m）` : '—', tone: s.showDepth ? 'good' : undefined },
    { label: '1px 深度误差 ΔZ', value: s.showPrec ? `±${s.dZ}m` : '—', tone: s.showPrec ? 'bad' : undefined },
  ],
}
const handeye: Experiment<HandEyeState> = {
  id: 'handeye', group: '机器人感知', title: '手眼标定 AX=XB', subtitle: '相机装夹爪上，求相机↔夹爪固定变换 X：先解旋转、再解平移',
  kernel: handeyeKernel, defaultDoc: { kind: 'handeye', params: { xrot: 'z90' }, entities: [], streams: [] },
  params: [{ key: 'xrot', label: '真值 X 旋转', kind: 'enum', options: ['z90', 'z45'] }],
  paramsNote: '视觉引导抓取里相机常**装在夹爪上**(eye-in-hand)。要用相机看到的指挥手,先得知道**相机相对夹爪的固定变换 X**——手眼标定。让机器人动几下:每次记 **A=夹爪相对运动**(关节角+正运动学 [[fk]] 算)、**B=相机相对运动**(观测固定标定板算);相机固连夹爪 → 经典手眼方程 **A·X=X·B**。①**先解旋转**:R_A R_X=R_X R_B ⟹ R_A、R_B **旋转角必相等**(θ_A=θ_B、自检),且 **R_X 把 B 的转轴转到 A 的转轴**(n_A=R_X n_B),≥2 组不共线定出 R_X(Tsai-Lenz);②**再解平移**:(R_A−I)t_X=R_X t_B−t_A **线性方程**、≥2 组凑满秩解出。本例构造真值 X(绕z 90°/45° + 平移[0.1,0,0.05])、用两组运动(绕x90°、绕y90°)生成 B=X⁻¹AX,再还原出 X 与真值一致(闭环验证)。全用矩阵现算。切「真值旋转」看还原跟着变。连「正运动学FK(算A)/相机标定针孔(B前提)/位姿」。详见讲解卡。',
  bounds: [
    '手眼标定:求相机相对夹爪(eye-in-hand)固定变换 X;数据 A=夹爪相对运动(FK)、B=相机相对运动(看标定板);满足 A·X=X·B',
    '先解旋转:R_A R_X=R_X R_B → R_A/R_B 旋转角相等(θ_A=θ_B 自检)、R_X 把 n_B 转到 n_A、≥2 组不共线定出 R_X(Tsai-Lenz/Park-Martin)',
    '再解平移:(R_A−I)t_X=R_X t_B−t_A 线性方程;(R_A−I) 沿转轴秩亏,要 ≥2 组不共线凑满秩、多组最小二乘去噪',
    'eye-in-hand vs eye-to-hand;AX=XB vs AX=ZB(同时标机器人-世界);对偶四元数解法;结果喂视觉引导抓取(相机看到目标乘 X 换算到夹爪去抓)。参考 Tsai&Lenz 1989、Park&Martin 1994',
  ],
  tabs: [{ id: 'he', label: '标定逐步跑' }], Stage: HandEyeStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? (s.rotOK && s.transOK ? { key: 'good', label: 'X 还原=真值' } : { key: 'bad', label: '还原失败' })
    : s.stage === 'translation' ? (s.transOK ? { key: 'good', label: 't_X 解出' } : { key: 'bad', label: '✗' })
    : s.stage === 'rotation' ? (s.rotOK ? { key: 'good', label: 'R_X 解出' } : { key: 'bad', label: '✗' })
    : s.stage === 'angle' ? (s.angleMatch ? { key: 'good', label: 'θ_A=θ_B ✓' } : { key: 'bad', label: '角度不符' })
    : s.stage === 'motions' ? { key: 'idle', label: '两组运动对' }
    : { key: 'idle', label: 'A·X=X·B' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '眼', motions: '动', angle: '角', rotation: 'R', translation: 't', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '真值 X 旋转', value: s.scenLabel.replace('真值 ', '') },
    { label: '角度自检 θ_A=θ_B', value: s.showAngle ? (s.angleMatch ? '通过' : '不符') : '—', tone: s.showAngle ? (s.angleMatch ? 'good' : 'bad') : undefined },
    { label: '还原旋转 R_X', value: s.showRot ? (s.rotOK ? '=真值' : '✗') : '—', tone: s.showRot ? (s.rotOK ? 'good' : 'bad') : undefined },
    { label: '还原平移 t_X', value: s.showTrans ? `[${s.tXrec}]${s.transOK ? ' ✓' : ''}` : '—', tone: s.showTrans ? (s.transOK ? 'good' : 'bad') : undefined },
  ],
}
const vo: Experiment<VoState> = {
  id: 'vo', group: '机器人感知', title: '视觉里程计 · 对极几何', subtitle: '单目两帧恢复相机运动：本质矩阵 E=[t]×R、对极约束 x2ᵀE x1=0、分解 (R,t)',
  kernel: voKernel, defaultDoc: { kind: 'vo', params: { motion: '前进平移' }, entities: [], streams: [] },
  params: [{ key: 'motion', label: '相机运动', kind: 'enum', options: ['前进平移', '横向平移'] }],
  paramsNote: '视觉里程计(VO)/单目 SLAM 前端:相机从上一帧到这一帧,**自己转了多少、往哪走了**。靠**对极几何**:①**本质矩阵 E=[t]×R**(归一化坐标下打包相对旋转 R + 平移方向 t、[t]× 是叉乘反对称阵);②**对极约束 x2ᵀE x1=0**(同一 3D 点两帧归一化像点的硬约束、对 E 线性 → **8 点法**从 ≥8 对匹配解 E、RANSAC 去误匹配);③**对极线 l2=E x1 + 极点 e2**(x2 必落在对极线上、所有线交于极点=平移方向的像;**找匹配只沿一条线搜**);④**分解 E→(R,t)**(SVD 得 4 组候选、手性/点在两相机前方选唯一;**单目 t 只定方向不定绝对尺度**、E 与 2E 同约束=尺度不确定)。本例 R=I:**前进平移** t=[0,0,1](极点=图心扩张焦点 FOE、对极线放射,像往前开)vs **横向平移** t=[1,0,0](极点无穷远、对极线水平 y1=y2、正是双目校正情形)。3 组匹配点约束≈0、画对极线与极点。全用矩阵现算。切「运动」对比。连「针孔/双目/ICP/SLAM/PnP」。详见讲解卡。',
  bounds: [
    '对极几何:E=[t]×R(归一化;带内参是基础矩阵 F);对极约束 x2ᵀE x1=0(对 E 线性 → 8 点法解 E、RANSAC 去误匹配)',
    '对极线 l2=E x1:x2 必落在线上、所有线交于极点 e2(=平移方向的像);匹配只沿一条对极线搜、不搜全图',
    '极点位置由平移方向定:横向平移→极点无穷远、对极线水平(y1=y2、双目校正);前进平移→极点=图心扩张焦点 FOE、对极线放射',
    '分解 E→(R,t):SVD 4 组候选、手性(点在两相机前方)选唯一;单目 t 无绝对尺度(E 与 2E 同约束)→尺度不确定,靠双目/IMU/回环补。三角化建图接成轨迹。参考 Longuet-Higgins 1981、Hartley-Zisserman',
  ],
  tabs: [{ id: 'vo', label: '对极逐步跑' }], Stage: VoStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '恢复 (R,t)' }
    : s.stage === 'recover' ? { key: 'bad', label: '单目无尺度' }
    : s.stage === 'epiline' ? { key: 'good', label: s.epipole ? '极点=FOE' : '极点∞·水平' }
    : s.stage === 'constraint' ? { key: 'good', label: 'x2ᵀEx1≈0' }
    : s.stage === 'essential' ? { key: 'idle', label: 'E=[t]×R' }
    : { key: 'idle', label: '两帧恢复运动' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: 'VO', essential: 'E', constraint: '约', epiline: '线', recover: 'Rt', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '相机运动', value: s.scenLabel.split('(')[0] },
    { label: '对极约束 x2ᵀEx1', value: s.showConstraint ? '≈0（三对匹配）' : '—', tone: s.showConstraint ? 'good' : undefined },
    { label: '极点 e2', value: s.showEpi ? (s.epipole ? `(${s.epipole}) FOE` : '∞（水平线）') : '—' },
    { label: '单目恢复 (R,t)', value: s.showRecover ? '方向定·尺度不定' : '—', tone: s.showRecover ? 'bad' : undefined },
  ],
}
const pnp: Experiment<PnpState> = {
  id: 'pnp', group: '机器人感知', title: 'PnP · 6D 位姿估计', subtitle: '已知 3D 点+它们的 2D 像素+内参 K，求 6 自由度位姿：最小化重投影误差',
  kernel: pnpKernel, defaultDoc: { kind: 'pnp', params: { dof: '平移' }, entities: [], streams: [] },
  params: [{ key: 'dof', label: '偏移自由度', kind: 'enum', options: ['平移', '旋转'] }],
  paramsNote: 'PnP(Perspective-n-Point):已知 **n 个 3D 点**在物体系的坐标(CAD 角点/SLAM 地图点)、又检测到它们的 **2D 像素**、加**标定好的内参 K**,求相机相对物体的 **6 自由度位姿 (R,t)**。本质=**最小化重投影误差**:找 (R,t) 让每个 3D 点按 u=K[R|t]X 投影后尽量落在观测像素上(Σ‖投影−观测‖² 最小、真位姿处=0)。解法:**P3P**(3 点最小情形、4 组候选、第 4 点消歧)、**DLT/线性 PnP**(≥6 点线性)、**EPnP**(O(n)、OpenCV solvePnP 常用)、再**高斯-牛顿/LM 迭代**精修 + RANSAC 去外点。本例 4 个 3D 点(方底+凸顶点)、K:fx=fy=500 cx=cy=320,真位姿 R=I、t=[0,0,5] 投出观测像素 [(270,270),(370,270),(370,370),(320,320)];换偏位姿(param:平移 tz+0.6 / 偏航+8°)重投影就偏离观测、每点有像素残差;沿该自由度扫描,重投影误差在真值处最小(≈0)。全用投影现算。切「自由度」看平移/旋转。连「针孔(投影+K)/VO/SLAM(地图点来源)/双目/ICP(3D-3D 对应)」。详见讲解卡。',
  bounds: [
    'PnP:n 个 3D 点 + 它们的 2D 像素 + 内参 K → 相机相对物体 6 自由度位姿 (R,t)',
    '准则=最小化重投影误差 Σ‖K[R|t]X−观测‖²:真位姿处=0、位姿越偏残差越大(重投影误差碗形、最低点=解)',
    '解法:P3P(3 点 4 解、第 4 点消歧)、DLT(≥6 线性)、EPnP(O(n))、高斯-牛顿/LM 精修 + RANSAC 去外点',
    '用途:VO/SLAM 建图后用 PnP 做 2D-3D 重定位;机械臂抓取先求物体 6D 位姿;AR 跟踪。共面点退化(用单应);PnP(2D-3D) vs ICP(3D-3D)。参考 EPnP(Lepetit 2009)、OpenCV solvePnP',
  ],
  tabs: [{ id: 'pn', label: 'PnP 逐步跑' }], Stage: PnpStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '重投影归零' }
    : s.stage === 'solve' ? { key: 'good', label: '残差归零 ✓' }
    : s.stage === 'landscape' ? { key: 'idle', label: '误差碗形' }
    : s.stage === 'reproject' ? { key: 'bad', label: `RMS ${s.rmsCur}px` }
    : s.stage === 'observe' ? { key: 'idle', label: '投出观测' }
    : { key: 'idle', label: '2D-3D→位姿' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: 'P', observe: '观', reproject: '差', landscape: '碗', solve: '解', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '偏移自由度', value: s.scenLabel.split('(')[0] },
    { label: '重投影 RMS 误差', value: s.showSolved ? '0px' : (s.showReproj ? `${s.rmsCur}px` : '—'), tone: s.showSolved ? 'good' : (s.showReproj ? 'bad' : undefined) },
    { label: '当前位姿', value: s.showSolved ? `真值 ${s.trueVal}${s.unit}` : (s.showReproj ? `${s.curVal}${s.unit}` : '—') },
    { label: 'PnP 解', value: s.showSolved ? '残差归零' : '—', tone: s.showSolved ? 'good' : undefined },
  ],
}
const icp: Experiment<ICPState> = {
  id: 'icp', group: '机器人感知', title: 'ICP 点云配准', subtitle: '迭代最近点：两片点云对齐求位姿',
  kernel: icpKernel, defaultDoc: { kind: 'icp', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '激光雷达/深度相机每帧一片点云，把这帧和上帧对齐、对齐的刚体变换就是位姿变化(激光 SLAM 前端)。ICP(迭代最近点)不知道点的真实对应，就猜+迭代：①每个源点找目标里最近点当对应；②用点对算最佳旋转+平移(2D Kabsch)；③搬过去；④重来。源=5点形状，目标=转25°+平移，ICP 从猜错的对应开始 4 轮把误差从 0.72 收到 ~0、还原 25°。对应/旋转/误差全真算。',
  bounds: ['ICP=找最近点对应+用点对求最佳刚体变换(Kabsch/SVD),两步反复迭代,误差单调降', '不知道点的真实对应→用欧氏最近点猜(一开始会错几个),迭代中对应越来越准', '本例4轮:误差0.72→0.55→0.22→0.01,累计旋转还原真值25°', '依赖初值(差太多→对应全错→局部最优),实际先粗配准(特征/IMU)再ICP精配;点面ICP/GICP/鲁棒核'],
  tabs: [{ id: 'design', label: '迭代配准' }], Stage: ICPStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '配准收敛' } : { key: 'idle', label: s.iterNo > 0 ? `第 ${s.iterNo} 轮` : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => (s.phase === 'done' ? '齐' : s.iterNo > 0 ? `${s.iterNo}` : 'ICP'),
  readouts: s => [
    { label: '迭代轮', value: `第 ${s.iterNo} 轮` },
    { label: '点对平均误差', value: `${s.error}`, tone: s.error < 0.1 ? 'good' : undefined },
    { label: '累计旋转', value: `${s.cumRot}°（真 ${s.trueRot}°）` },
    { label: '本轮旋转', value: `${s.iterRot}°` },
  ],
}

const slam: Experiment<SLAMState> = {
  id: 'slam', group: '机器人感知', title: 'SLAM 回环校正', subtitle: '里程计漂移→回环把误差分摊回轨迹、拉闭合',
  kernel: slamKernel, defaultDoc: { kind: 'slam', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: 'SLAM=同时定位与建图。核心难题是里程计漂移(轮子打滑等系统误差逐步累积)。机器人沿八边形走一圈,里程计每步累积漂移、终点偏到(2.45,0.82)不闭合(漂移2.58);回环检测认出回到起点、加约束"终点=起点",位姿图优化把漂移按位置比例分摊回整条轨迹→环闭合、轨迹平均误差从1.26骤降到0.25。漂移/校正/误差全真算。',
  bounds: ['里程计漂移:系统误差逐步累积,走越久偏越多,回到起点却以为在别处(轨迹不闭合)', '回环检测:认出回到走过的地方(相同地标)→加约束"终点=起点",缺口=累计漂移', '位姿图优化:把回环误差按i/N分摊回整条轨迹→环闭合、之前漂移大幅抹平(误差1.26→0.25)', '本例按比例分摊演示直觉;真实是SE(2)/SE(3)非线性最小二乘(g2o/GTSAM),同时优化位姿+地标;前端找回环靠ICP/视觉词袋'],
  tabs: [{ id: 'design', label: '走一圈闭环' }], Stage: SLAMStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '闭环·误差骤降' } : s.phase === 'loopclose' ? { key: 'bad', label: '漂移未闭合' } : { key: 'idle', label: s.poseNo > 0 ? `位姿 ${s.poseNo}` : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 11)),
  tickLabel: s => (s.phase === 'done' ? '闭' : s.op === 'loopclose' ? '环' : s.poseNo > 0 ? `${s.poseNo}` : 'S'),
  readouts: s => [
    { label: '进度', value: s.phase === 'done' ? '已闭环' : s.phase === 'loopclose' ? '检测回环' : `位姿 ${s.poseNo}` },
    { label: '回环漂移', value: s.driftMag ? `${s.driftMag}` : '—', tone: s.driftMag > 0 && !s.corrected ? 'bad' : undefined },
    { label: '轨迹误差', value: s.errOdom ? `里程计 ${s.errOdom}` : '累积中' },
    { label: '校正后误差', value: s.corrected ? `${s.errCorr}` : '—', tone: s.corrected ? 'good' : undefined },
  ],
}

// ── 具身智能 · 机器人强化学习 ──
const mdp: Experiment<MdpState> = {
  id: 'mdp', group: '机器人强化学习', title: 'MDP · 贝尔曼值迭代', subtitle: '强化学习地基：V(s)=max_a[R+γV(s′)]，值从目标一步步往回传',
  kernel: mdpKernel, defaultDoc: { kind: 'mdp', params: { gamma: '远视' }, entities: [], streams: [] },
  params: [{ key: 'gamma', label: '折扣 γ', kind: 'enum', options: ['远视', '短视'] }],
  paramsNote: '强化学习把问题建成 **MDP=⟨S 状态,A 动作,P 转移,R 奖励,γ 折扣⟩**,目标最大化**累积折扣回报 Σγ^t r_t**。**值函数** V(s)=从该状态出发的期望折扣回报,满足**贝尔曼(最优)方程 V\\*(s)=max_a[R+γV\\*(s\')]**(值=选最好动作、即时奖励+折扣下个状态值)。**值迭代**:反复做贝尔曼备份直到收敛。本例确定性 4 状态链 A→B→C→G(C→G 得 +1),**值从目标 G 一步步往回传**(iter1 C=1、iter2 B=γ、iter3 A=γ²);收敛后 argmax 得最优策略(全朝 G)。切「折扣 γ」看 0.9 远视/0.5 短视怎么改变对未来的看重(V=γ^步数·1)。全现算。连「Q-learning(免模型)/PPO/miniduck」。详见讲解卡。',
  bounds: [
    'MDP=⟨S,A,P,R,γ⟩、目标最大化累积折扣回报 Σγ^t r_t;值函数 V(s)=期望折扣回报',
    '贝尔曼最优方程 V*(s)=max_a[R+γV*(s\')]:值=即时奖励+折扣后下个状态值;值迭代反复备份收敛、值从目标往回传',
    '收敛后 argmax 得最优策略;V=γ^(到目标步数)·奖励,γ 越大越远视(看重远期)、越小越短视',
    'V(s) vs Q(s,a)(Q 更常用、argmax Q 直接给策略免模型);有模型(值迭代要知 P/R)vs 免模型(Q-learning 从经验学)。连 PPO/SAC/miniduck。参考:Sutton&Barto',
  ],
  tabs: [{ id: 'md', label: '值迭代逐步跑' }], Stage: MdpStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: 'V=max[R+γV]' }
    : s.stage === 'converge' ? { key: 'good', label: `V*=[${s.vFinal.A},${s.vFinal.B},${s.vFinal.C}]` }
    : s.stage === 'iterate' ? { key: 'idle', label: '值往回传' }
    : s.stage === 'bellman' ? { key: 'idle', label: '贝尔曼备份' }
    : s.stage === 'components' ? { key: 'idle', label: 'MDP 五要素' }
    : { key: 'idle', label: 'RL 地基' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: 'M', components: '素', bellman: '备', iterate: '迭', converge: '敛', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '折扣 γ', value: `${s.gamma}（${s.gamLabel.split(' ')[0]}）` },
    { label: '收敛扫描次数', value: s.showIter ? `${s.nIters}` : '—' },
    { label: 'V*(A,B,C)', value: s.showConv ? `[${s.vFinal.A}, ${s.vFinal.B}, ${s.vFinal.C}]` : '—', tone: s.showConv ? 'good' : undefined },
    { label: '最优策略 π*', value: s.showConv ? `A${s.policy.A} B${s.policy.B} C${s.policy.C}` : '—' },
  ],
}
const qlearning: Experiment<QState> = {
  id: 'qlearning', group: '机器人强化学习', title: 'Q-learning · 免模型', subtitle: '不知道模型，从经验 (s,a,r,s\') 学 Q(s,a)：TD 更新、off-policy',
  kernel: qlearningKernel, defaultDoc: { kind: 'qlearning', params: { alpha: '快' }, entities: [], streams: [] },
  params: [{ key: 'alpha', label: '学习率 α', kind: 'enum', options: ['快', '慢'] }],
  paramsNote: '和「MDP 值迭代」(要知道转移 P/奖励 R、有模型)不同,Q-learning **免模型**:只从**经验元组 (s,a,r,s\')** 学**动作值 Q(s,a)**。**TD 更新** Q(s,a)←Q+α·[r+γ·max_a\' Q(s\',a\')−Q],方括号=**TD 误差 δ**(自举、走一步更一次)。为何学 Q 不学 V?argmax Q 直接给策略、免转移模型。**off-policy**:更新用 max(贪心)、行为带 ε-greedy 探索。同链 A→B→C→G(C→G 得 +1、γ=0.9):首次更新 δ=1、Q(C,→)←α·1;**奖励每回合往回传一步**;多回合收敛到 **[0.81,0.9,1]**(和值迭代 V\\* 一样、但免模型+渐进)。切「学习率 α」看快(0.5)/慢稳(0.2)。全现算。连「MDP(有模型)/DQN/PPO/miniduck」。详见讲解卡。',
  bounds: [
    'Q-learning 免模型:只从经验 (s,a,r,s\') 学动作值 Q(s,a)、不需要转移 P/奖励 R;argmax Q 直接给策略',
    'TD 更新 Q←Q+α[r+γmax Q(s\')−Q]:方括号=TD 误差 δ(自举 bootstrapping、走一步更一次);α 学习率',
    'off-policy:更新用 max(目标策略贪心)、行为带 ε-greedy 探索(探索 vs 利用);奖励每回合往回传一步',
    '收敛到和值迭代一样的 Q*=[0.81,0.9,1];Q 表只处理离散小规模→大/连续用 DQN(神经网络近似Q)/PPO/SAC。参考:Watkins Q-learning、Sutton&Barto',
  ],
  tabs: [{ id: 'ql', label: 'Q-learning 逐步跑' }], Stage: QlearningStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '免模型学最优' }
    : s.stage === 'converge' ? { key: 'good', label: '收敛=值迭代' }
    : s.stage === 'episode' ? { key: 'idle', label: '奖励往回传' }
    : s.stage === 'tdupdate' ? { key: 'good', label: `δ=${s.td.delta}` }
    : s.stage === 'qtable' ? { key: 'idle', label: 'Q 表' }
    : { key: 'idle', label: '免模型' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: 'Q', qtable: '表', tdupdate: 'TD', episode: '回', converge: '敛', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '学习率 α', value: `${s.alpha}（${s.alLabel.includes('快') ? '快' : '慢稳'}）` },
    { label: 'TD 误差 δ', value: s.showTd ? `${s.td.delta}` : '—' },
    { label: 'Q(C,→) 首更', value: s.showTd ? `${s.td.newQ}` : '—' },
    { label: '收敛 Q*(A,B,C)', value: s.showConv ? `[${s.qConv.A}, ${s.qConv.B}, ${s.qConv.C}]（=V*）` : '—', tone: s.showConv ? 'good' : undefined },
  ],
}
const policygrad: Experiment<PgState> = {
  id: 'policygrad', group: '机器人强化学习', title: '策略梯度 REINFORCE', subtitle: '直接学策略 π_θ：把高回报动作概率推上去；基线/优势降方差',
  kernel: policygradKernel, defaultDoc: { kind: 'policygrad', params: { baseline: '带基线' }, entities: [], streams: [] },
  params: [{ key: 'baseline', label: '基线', kind: 'enum', options: ['带基线', '不带基线'] }],
  paramsNote: '「Q-learning」是值方法(先学值再 argmax);**策略梯度直接参数化策略 π_θ(a|s)**、以 J(θ)=E[回报] 梯度上升。**策略梯度定理** ∇_θ J=E[∇_θ log π·G]("把导致高回报的动作概率往上推")。**REINFORCE**:采样轨迹、用 G 估梯度、上升。天然处理**连续动作**(miniduck 的关节力矩);缺点**高方差**。**基线/优势** A=G−b(b 常用 V(s))降方差、且能**正确压制低于平均的动作**(A<0)、而非只要回报>0 就强化。本例单状态 2 动作(L 回报1、R 回报3、b=2):采到较差的 L,带基线 A=−1→π(L) 0.5→0.27(对);不带基线 权重=G=1→π(L)→0.73(错、被误强化)。切「基线」对比。全现算。连「Q-learning/PPO(下一课稳住更新)/actor-critic/miniduck」。详见讲解卡。',
  bounds: [
    '策略梯度直接参数化 π_θ、梯度上升 J=E[回报];策略梯度定理 ∇J=E[∇log π·G];REINFORCE 采样估梯度。天然处理连续动作',
    '基线/优势 A=G−b(b 常用 V(s)):降方差、正确压制低于平均动作(A<0);不带基线纯回报 G 全正、方差大、会误强化差动作',
    '基线→actor-critic(actor=策略π、critic=值V当基线);on-policy(当前策略采的数据、用完即扔、样本效率低)',
    '痛点:步子难调(太大崩、太小慢)→PPO 裁剪替代目标限信任域。连 Q-learning(值方法)/PPO/SAC/miniduck(PPO 学走路)。参考:Sutton PG 定理、Williams REINFORCE',
  ],
  tabs: [{ id: 'pg', label: '策略梯度逐步跑' }], Stage: PolicyGradStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '∇log π·优势' }
    : s.stage === 'update' ? (s.piNew[s.sampled]! < s.pi[s.sampled]! ? { key: 'good', label: '压低差动作' } : { key: 'bad', label: '误推高' })
    : s.stage === 'gradient' ? { key: 'idle', label: `权重 ${s.weight}` }
    : s.stage === 'sample' ? { key: (s.adv < 0 ? 'bad' : 'idle'), label: `A=${s.adv}` }
    : s.stage === 'policy' ? { key: 'idle', label: 'softmax π' }
    : { key: 'idle', label: '直接学策略' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '策', policy: 'π', sample: '采', gradient: '∇', update: '新', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '基线', value: s.baseLabel },
    { label: '优势 A=G−b', value: s.showSample ? `${s.adv}` : '—', tone: s.showSample && s.adv < 0 ? 'bad' : undefined },
    { label: '更新权重', value: s.showGrad ? `${s.weight}（${s.base === 'on' ? '优势' : '回报'}）` : '—' },
    { label: `π(${s.acts[s.sampled]}) 变化`, value: s.showUpdate ? `${s.pi[s.sampled]}→${s.piNew[s.sampled]}` : '—', tone: s.showUpdate ? (s.piNew[s.sampled]! < s.pi[s.sampled]! ? 'good' : 'bad') : undefined },
  ],
}
const ppo: Experiment<PpoState> = {
  id: 'ppo', group: '机器人强化学习', title: 'PPO 近端策略优化', subtitle: '策略梯度+裁剪的替代目标：把每次更新限在信任域；miniduck 用的就是它',
  kernel: ppoKernel, defaultDoc: { kind: 'ppo', params: { move: '大步' }, entities: [], streams: [] },
  params: [{ key: 'move', label: '尝试步幅', kind: 'enum', options: ['小步', '大步'] }],
  paramsNote: '「策略梯度」痛点:步子难调、一步太大策略会崩。**PPO** 用**裁剪的替代目标**把新旧策略差距锁小:**重要性比** r=π_θ(a|s)/π_θ_old(a|s)(r=1 没变);**替代目标** L=r·A(A=优势),无脑最大化会把 r 推到无穷、崩;**裁剪目标** L^clip=**min(r·A, clip(r,1−ε,1+ε)·A)**(ε=0.2→r 限 [0.8,1.2])。A>0 时 r 涨到 1+ε 封顶、再涨无梯度(不过度增概率);A<0 对称。**新旧策略差出 ε 就没梯度**=天然信任域,比 TRPO 简单得多。本例 A=+1、ε=0.2:小步 r=1.1(不裁剪、正常);大步 r=1.5(超 1+ε、裁剪到 1.2、封顶、梯度0、拦住)。切「步幅」看裁剪。PPO 是当今主力、可多 epoch 复用 batch。**miniduck 用 Brax PPO 学走路**。连「策略梯度/miniduck」。详见讲解卡。',
  bounds: [
    'PPO=策略梯度+裁剪信任域:重要性比 r=π_new/π_old、裁剪目标 min(r·A, clip(r,1−ε,1+ε)·A);新旧策略差出 ε 就无梯度',
    'A>0 时 r 涨到 1+ε 封顶(不过度增好动作概率)、A<0 时 r 跌到 1−ε 封底;把每次更新限在信任域、防策略崩',
    '比 TRPO(二阶信任域)简单得多、效果相当;稳、超参不敏感、同一批数据可多 epoch 复用(比 REINFORCE 省样本);仍 on-policy',
    '配 actor-critic(critic 学 V 当基线)+GAE 算优势 A。是策略梯度的稳定化升级;miniduck 用 Brax PPO 学走路。参考:Schulman PPO 2017',
  ],
  tabs: [{ id: 'pp', label: 'PPO 逐步跑' }], Stage: PpoStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '裁剪限信任域' }
    : s.stage === 'effect' ? (s.clipped ? { key: 'bad', label: '裁剪拦住' } : { key: 'good', label: '正常更新' })
    : s.stage === 'clip' ? { key: 'idle', label: `L^clip=${s.Lclip}` }
    : s.stage === 'surrogate' ? { key: 'idle', label: `L=r·A=${s.rA}` }
    : s.stage === 'ratio' ? { key: 'idle', label: `r=${s.r}` }
    : { key: 'idle', label: '限步' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '限', ratio: 'r', surrogate: 'L', clip: '裁', effect: '果', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '尝试步幅', value: s.moveLabel },
    { label: '重要性比 r', value: s.showRatio ? `${s.r}` : '—' },
    { label: '裁剪目标 L^clip', value: s.showClip ? `${s.Lclip}（r·A=${s.rA}）` : '—' },
    { label: '触发裁剪', value: s.showEff ? (s.clipped ? '是（封顶·无梯度）' : '否（信任域内）') : '—', tone: s.showEff ? (s.clipped ? 'bad' : 'good') : undefined },
  ],
}
// ── 具身智能 · 具身学习 ──
const bc: Experiment<BCState> = {
  id: 'bc', group: '具身学习', title: '模仿学习 · 行为克隆', subtitle: '从专家示范学策略；分布漂移→复合误差',
  kernel: bcKernel, defaultDoc: { kind: 'bc', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '让机器人学技能最直接的办法=模仿学习：收集专家示范(状态→动作)、监督学习拟合策略。最简单的行为克隆 BC 就是把状态→动作当回归——VLA 的训练基石。但有致命伤：分布漂移/复合误差。车道保持任务，专家只在中线附近示范(|偏移|≤0.5)：扰动把车推出示范区后，专家修正不封顶稳稳拉回(留道内0.66)，BC 在示范区外欠修正、压不住扰动→一路漂出车道(1.76+)。轨迹每步真算。',
  bounds: ['模仿学习:收集专家示范(状态→动作)监督学习拟合策略;BC=把状态→动作当回归,VLA训练基石', '致命伤:分布漂移/复合误差—只在专家示范过的状态学得好,自己小误差带到没示范过的状态就崩', '本例:专家留道内(0.66),BC漂出示范区(0.5)后欠修正、误差复合、冲出车道(1.76);代价O(εT²)', '解法:DAgger(在BC走出的新状态补标注)、含纠错的示范、RL微调—也是VLA要海量多样数据的原因;引出Diffusion Policy/VLA'],
  tabs: [{ id: 'design', label: '专家vs克隆' }], Stage: BCStage, whyInRail: true,
  tone: s => (s.bcCrashed ? { key: 'bad', label: 'BC 冲出车道' } : s.phase === 'done' ? { key: 'bad', label: 'BC 崩了' } : s.bcOff ? { key: 'bad', label: 'BC 漂出示范区' } : { key: 'idle', label: s.shown > 0 ? `第 ${s.shown} 步` : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 7)),
  tickLabel: s => (s.bcCrashed ? '崩' : s.shown > 0 ? `${s.shown}` : 'BC'),
  readouts: s => [
    { label: '滚动步', value: `第 ${s.shown} 步` },
    { label: '专家偏移', value: `${s.expertY}`, tone: 'good' },
    { label: 'BC 偏移', value: `${s.bcY}`, tone: s.bcCrashed ? 'bad' : undefined },
    { label: 'BC 状态', value: s.bcCrashed ? '冲出车道' : s.bcOff ? '漂出示范区' : '示范区内' },
  ],
}

const diffpolicy: Experiment<DiffPolicyState> = {
  id: 'diffpolicy', group: '具身学习', title: 'Diffusion Policy', subtitle: '扩散建多峰动作分布、去噪采一个模态；治 BC 平均成撞',
  kernel: diffpolicyKernel, defaultDoc: { kind: 'diffpolicy', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: 'BC 除了分布漂移，还有多峰被平均的病：绕障向左(−1)或向右(+1)都对，BC 回归求均值→0(直行)→撞。Diffusion Policy 换成生成模型：建整个动作分布(可多峰)，从噪声沿学到的能量去噪采样出某一个模态。本例双阱能量 U=(x²−1)²(模态±1)：BC 均值落 0(撞)，两个噪声种子去噪分别收敛到 +1(右绕)/−1(左绕)。去噪每步真算。',
  bounds: ['BC第二个病:多峰动作被平均—绕障左(−1)或右(+1)都对,回归求均值→0直行→撞(结构缺陷,加大网络无用)', 'Diffusion Policy=生成模型:建整个动作分布(可多峰),从噪声沿分数/能量去噪采样出一个模态', '不同噪声→不同模态(左/右都有效),不被平均;一整段动作序列内部连贯', '代价:采样迭代多步(DDIM/一致性/流匹配加速);现代VLA(RT/π0)动作头广用扩散;引出VLA'],
  tabs: [{ id: 'design', label: '去噪采样' }], Stage: DiffPolicyStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '各落一模态' } : s.phase === 'bc' ? { key: 'bad', label: 'BC 平均成撞' } : { key: 'idle', label: s.phase === 'denoise' ? `去噪 ${s.shown} 步` : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 8)),
  tickLabel: s => (s.phase === 'done' ? '峰' : s.op === 'bc' ? '撞' : s.op === 'step' ? `${s.shown}` : 'D'),
  readouts: s => [
    { label: '当前', value: s.op === 'bc' ? 'BC 回归' : s.phase === 'done' ? '各落一模态' : s.phase === 'denoise' ? `去噪 ${s.shown} 步` : '就绪' },
    { label: 'BC 均值', value: `${s.bcAction}（直行→撞）`, tone: 'bad' },
    { label: '扩散样本 A', value: `${s.aVal}${s.phase === 'done' ? '（右绕）' : ''}`, tone: s.phase === 'done' ? 'good' : undefined },
    { label: '扩散样本 B', value: `${s.bVal}${s.phase === 'done' ? '（左绕）' : ''}`, tone: s.phase === 'done' ? 'good' : undefined },
  ],
}

const vla: Experiment<VLAState> = {
  id: 'vla', group: '具身学习', title: 'VLA 视觉-语言-动作', subtitle: '预训练大模型吃图像+指令、直接吐机器人动作',
  kernel: vlaKernel, defaultDoc: { kind: 'vla', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: 'VLA=拿网络图文预训练的视觉-语言大模型(VLM)当骨干+接动作输出+机器人示范微调，吃一张图+一句自然语言、直接产动作。RT-2 的动作 token 化：连续 Δpose 每维按范围离散成 256 格→token id，大模型像预测单词一样自回归吐这串动作 token，再反解成位姿执行。指令「把红积木放进碗」→动作 token [204,96,77,255]，反解误差≈0。杀手锏=靠骨干网络知识泛化到没训过的物体/指令。',
  bounds: ['VLA=网络预训练VLM骨干+动作输出+机器人示范微调;吃图像+语言直接产动作', '动作token化(RT-2):连续Δpose每维离散256格→token,大模型像吐单词一样自回归生成,和语言共用词表', '连续动作头(π0):扩散/流匹配产连续动作块=Diffusion Policy;本例token[204,96,77,255]反解≈0', '杀手锏:骨干带网络知识→泛化到没训过的物体/自由指令(BC做不到);代表RT-2/OpenVLA/π0/RDT;瓶颈=机器人数据/算力/精度'],
  tabs: [{ id: 'design', label: '图像+语言→动作' }], Stage: VLAStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '通才策略' } : { key: 'idle', label: s.phase === 'backbone' ? 'VLM 骨干' : s.phase === 'tokenize' ? '动作token化' : s.phase === 'execute' ? '生成执行' : s.phase === 'generalize' ? '泛化' : s.phase === 'input' ? '图像+指令' : '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 7)),
  tickLabel: s => (s.phase === 'done' ? '毕' : s.op === 'tokenize' ? 'tok' : s.op === 'backbone' ? '骨' : s.op === 'execute' ? '动' : s.op === 'generalize' ? '泛' : 'V'),
  readouts: s => [
    { label: '当前阶段', value: s.phase === 'input' ? '图像+指令' : s.phase === 'backbone' ? '预训练VLM骨干' : s.phase === 'tokenize' ? '动作token化' : s.phase === 'execute' ? '生成+执行' : s.phase === 'generalize' ? '泛化' : s.phase === 'done' ? '通才策略' : '就绪' },
    { label: '指令', value: `「${s.instruction}」` },
    { label: '动作 token', value: `[${s.tokens.join(', ')}]` },
    { label: '泛化到', value: s.phase === 'generalize' || s.phase === 'done' ? `没训过的「${s.novelObj}」` : '—' },
  ],
}

// ── 具身智能 · 具身项目实战 ──
const deltats: Experiment<DTState> = {
  id: 'deltats', group: '具身项目实战', title: 'LeRobotDataset · 时序窗口', subtitle: 'delta_timestamps：秒→帧→episode 边界钳→pad 掩码，取一段历史观测/未来动作块',
  kernel: deltatsKernel, defaultDoc: { kind: 'deltats', params: { pos: '靠结尾' }, entities: [], streams: [] },
  params: [{ key: 'pos', label: '采样位置', kind: 'enum', options: ['靠开头', '靠结尾'] }],
  paramsNote: 'LeRobotDataset 把机器人数据标准化存(低维进 parquet、图像进 mp4、fps/统计量进 meta)。但策略要的不是单帧、是一段**时序窗口**(ACT 要未来动作块、Diffusion 要历史观测)。**delta_timestamps** 是桥:①秒→帧 **delta_idx=round(偏移·fps)**(fps 换算让不同频率数据集通用)②定位+**clamp 进本 episode**[start,end)、越界钳到边界帧③**pad 掩码** is_pad=越界、喂 loss 排除不污染训练。ACT 的动作块=action_delta_indices=range(chunk_size)=[0..K-1]。切「采样位置」看开头(观测窗越界)/结尾(动作块越界)。偏移/钳/掩码现算。连「ACT 动作分块」。详见讲解卡。',
  bounds: [
    'delta_timestamps=从"要时序窗口"到"取哪些帧"的桥:秒→帧(round(偏移·fps))→episode边界钳→pad掩码',
    '秒→帧用 fps 换算(不同采集频率数据集通用);越界钳到边界帧、不跨 episode(不借别条轨迹的帧)',
    'pad 掩码 is_pad 越界标 True、喂给 loss 排除——padding 帧不污染训练梯度',
    'ACT 动作块=action_delta_indices=range(chunk_size)=[0..K-1];parquet 存低维/mp4 存图像(图占体积大)。真实框架:LeRobot(dataset_reader.py)',
  ],
  tabs: [{ id: 'dt', label: '取帧逐步跑' }], Stage: DeltaTsStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '窗口取出' }
    : s.stage === 'pad' ? { key: 'bad', label: `${s.obs.filter(c => c.pad).length + s.act.filter(c => c.pad).length} 个 pad` }
    : s.stage === 'clamp' ? { key: 'idle', label: '边界钳' }
    : s.stage === 'sec2idx' ? { key: 'idle', label: '秒→帧' }
    : { key: 'idle', label: `帧 ${s.absIdx}` }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => ({ intro: '始', sec2idx: '换', clamp: '钳', pad: '掩', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '采集频率', value: `${s.fps} fps` },
    { label: 'episode / 当前帧', value: `[${s.epStart},${s.epEnd}) / ${s.absIdx}` },
    { label: 'pad 数', value: s.showPad ? `观测 ${s.obs.filter(c => c.pad).length} · 动作块 ${s.act.filter(c => c.pad).length}` : '—', tone: s.showPad && (s.obs.some(c => c.pad) || s.act.some(c => c.pad)) ? 'bad' : undefined },
    { label: '本步', value: ({ intro: '要时序窗口', sec2idx: '秒→帧偏移', clamp: '定位+边界钳', pad: 'pad 掩码', done: '窗口取出' } as Record<string, string>)[s.stage] ?? '—' },
  ],
}
const foc: Experiment<FocState> = {
  id: 'foc', group: '具身项目实战', title: 'FOC 磁场定向控制', subtitle: '稚晖君 Dummy-Robot 关节驱动的电流环：Clarke→Park→PI(i_d→0,i_q→i_q*)→逆变换+SVPWM，级联 PID 最内环',
  kernel: focKernel, defaultDoc: { kind: 'foc', params: { cmd: '正转 iq*=+1.0A' }, entities: [], streams: [] },
  params: [{ key: 'cmd', label: '力矩指令', kind: 'enum', options: ['正转 iq*=+1.0A', '反转 iq*=−1.0A', '零力矩 iq*=0'] }],
  paramsNote: '稚晖君 Dummy-Robot 关节靠 **Ctrl-Step**(闭环步进,FOC 收成"电流矢量恒超前转子 90°")驱动、配套 **Ctrl-FOC-Lite**(3 相无刷,基于 SimpleFOC 标准 Clarke/Park/SVPWM)。这里拆**标准三相 FOC 电流环**(嵌入式电机控制头号八股):三相电流是随转子转的交流量、PI 控不了→FOC 转进"跟转子转"的 dq 系、交流变直流→两个 PI 各管一路。一个控制周期(20kHz):①Clarke abc→αβ ②Park αβ→dq(**交流变直流**) ③两个 PI(e_d=0−i_d、e_q=i_q*−i_q;**i_d*=0** 是最大转矩每安培 MTPA) ④逆 Park+逆 Clarke+**SVPWM**(注共模零序、比正弦 PWM 多约 15% 母线利用率) ⑤转矩 τ=1.5·p·λ_m·i_q。切「力矩指令」看 i_q 翻转(力矩旋钮)、i_d 恒被压到 0。为何比开环微步好:闭环量转子角、恒 90°矢量→不丢步、每安培都出力。全链现算。连「PID(最内环)/FK·IK(它驱动的关节)」。详见讲解卡。',
  bounds: [
    'FOC=把三相交流相电流经 Clarke(3→2)+Park(转进转子 dq 系)变成直流→简单 PI 就能零稳态误差(PI 追不了正弦)',
    'i_d*=0 是最大转矩每安培(MTPA):表贴永磁/步进只有 i_q 产生转矩、i_d 只发热;高速弱磁才让 i_d<0。d/q 两个独立 PI 解耦',
    '逆 Park+逆 Clarke+SVPWM(中点钳位注共模零序):比正弦 PWM 多约 15% 母线电压利用率;转矩 τ=1.5·p·λ_m·i_q,i_q 是力矩旋钮',
    'FOC 是级联 PID 最内环(位置→速度→电流、内环 20kHz 最快);比开环微步好在闭环量转子角、恒 90°矢量不丢步。真实项目:稚晖君 Dummy-Robot(Ctrl-Step/Ctrl-FOC-Lite)、SimpleFOC',
  ],
  tabs: [{ id: 'fc', label: '控制周期逐步跑' }], Stage: FocStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: 'i_q 力矩旋钮' }
    : s.stage === 'invsvpwm' ? (s.torque > 0 ? { key: 'good', label: `τ=${s.torque}` } : s.torque < 0 ? { key: 'bad', label: `τ=${s.torque}` } : { key: 'idle', label: 'τ=0' })
    : s.stage === 'pi' ? { key: 'idle', label: 'i_d*=0' }
    : s.stage === 'park' ? { key: 'idle', label: '交流→直流' }
    : s.stage === 'clarke' ? { key: 'idle', label: '3相→2相' }
    : { key: 'idle', label: 'dq 变换' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '交', clarke: '克', park: '帕', pi: 'PI', invsvpwm: '逆', done: '矩' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '力矩指令 i_q*', value: `${s.iqTarget} A` },
    { label: 'i_d / i_q (Park)', value: s.showPark ? `${Object.is(s.iD, -0) ? 0 : s.iD} / ${Object.is(s.iQ, -0) ? 0 : s.iQ}` : '—' },
    { label: '转矩 τ', value: s.showInv ? `${Object.is(s.torque, -0) ? 0 : s.torque} N·m` : '—', tone: s.showInv && s.torque < 0 ? 'bad' : undefined },
    { label: '本步', value: ({ intro: '交流难控', clarke: 'Clarke 3→2', park: 'Park 交流→直流', pi: '两个 PI(i_d*=0)', invsvpwm: '逆变换+SVPWM', done: 'i_q=力矩旋钮' } as Record<string, string>)[s.stage] ?? '—' },
  ],
}
// ── 具身智能 · 软件库与框架(新内容类型:库层介绍,非焊死仿真) ──
const moveit: Experiment<LibraryState> = {
  id: 'moveit', group: '软件库与框架', title: 'MoveIt 2 · 机械臂运动规划框架', subtitle: 'ROS 2 上机械臂规划的事实标准：把 OMPL/FCL/CHOMP/IK 拼成一条规划流水线（库层，非仿真）',
  kernel: libraryKernel, defaultDoc: { kind: 'library', params: { lib: 'moveit' }, entities: [], streams: [] }, params: [],
  paramsNote: '**软件库/框架层**(新内容类型):在单个"知识理论/算法"实验之上,加一层软件库的介绍——它们没法做焊死仿真,改成四要素:①特点介绍 ②优缺点剖析 ③内容覆盖(并**反向连回**用到的理论实验) ④落地项目。**MoveIt 2** = ROS 2 上机械臂(操作臂)运动规划的事实标准框架:给机器人模型 + 目标位姿,算出无碰撞可执行的关节轨迹;中枢 move_group 串起 场景/规划/碰撞/运动学/轨迹一条流水线。它不发明新算法,而是把经典算法工程化拼成系统——**默认规划器就是我们建过的 RRT-Connect、碰撞用 FCL(=GJK 那类)、优化用 CHOMP、时间参数化=梯形速度曲线、逆解=IK/雅可比**。许可 BSD-3-Clause、维护 PickNik。库是"用法"、实验是"原理",两层对着看。逐段翻:特点→优缺点→覆盖→落地。',
  bounds: [
    'MoveIt 2=ROS 2 机械臂运动规划事实标准框架(BSD-3-Clause,PickNik 维护);中枢 move_group 串 场景/规划/碰撞/运动学/轨迹流水线',
    '不发明算法、把经典算法工程化:OMPL(采样,默认 RRT-Connect)+CHOMP(优化)+FCL(碰撞)+KDL/IKFast(运动学)+时间参数化',
    '内容覆盖反向连回理论实验:OMPL↔RRT-Connect/RRT/RRT*/PRM、FCL↔GJK、CHOMP、时间参数化↔梯形速度曲线、IK↔逆运动学/雅可比',
    '取舍:生态标准/可插拔/开箱即用,但学习曲线陡、配置繁、和 ROS 强耦合、偏机械臂(移动导航是 Nav2)。落地:Franka Panda、UR 等',
  ],
  tabs: [{ id: 'lib', label: '逐段翻' }], Stage: LibraryStage, whyInRail: true,
  tone: s => (s.section === 'done' ? { key: 'good', label: '库层小结' }
    : s.section === 'coverage' ? { key: 'good', label: '反向连回实验' }
    : s.section === 'proscons' ? { key: 'idle', label: '优缺点' }
    : s.section === 'projects' ? { key: 'idle', label: '落地项目' }
    : { key: 'idle', label: '特点介绍' }),
  metric: s => Math.max(0, (s.step + 1) / 5),
  tickLabel: s => ({ intro: '特', proscons: '优', coverage: '覆', projects: '落', done: '结' }[s.section] ?? '·'),
  readouts: s => [
    { label: '库/框架', value: s.name },
    { label: '许可', value: s.license },
    { label: '当前段', value: ({ intro: '特点介绍', proscons: '优缺点剖析', coverage: '内容覆盖', projects: '落地项目', done: '小结' } as Record<string, string>)[s.section] ?? '—' },
    { label: '覆盖理论实验', value: `${s.coverage.flatMap(c => c.links).length} 个`, tone: s.section === 'coverage' || s.section === 'done' ? 'good' : undefined },
  ],
}
// 库层实验共用的导览逻辑（分段:特点/优缺点/覆盖/落地/小结）
const mkLib = (id: string, title: string, subtitle: string, lib: string, paramsNote: string, bounds: string[], group = '软件库与框架'): Experiment<LibraryState> => ({
  id, group, title, subtitle,
  kernel: libraryKernel, defaultDoc: { kind: 'library', params: { lib }, entities: [], streams: [] }, params: [],
  paramsNote, bounds,
  tabs: [{ id: 'lib', label: '逐段翻' }], Stage: LibraryStage, whyInRail: true,
  tone: s => (s.section === 'done' ? { key: 'good', label: '库层小结' }
    : s.section === 'coverage' ? { key: 'good', label: '反向连回实验' }
    : s.section === 'proscons' ? { key: 'idle', label: '优缺点' }
    : s.section === 'projects' ? { key: 'idle', label: '落地项目' }
    : { key: 'idle', label: '特点介绍' }),
  metric: s => Math.max(0, (s.step + 1) / 5),
  tickLabel: s => ({ intro: '特', proscons: '优', coverage: '覆', projects: '落', done: '结' }[s.section] ?? '·'),
  readouts: s => [
    { label: '库/框架', value: s.name },
    { label: '许可', value: s.license },
    { label: '当前段', value: ({ intro: '特点介绍', proscons: '优缺点剖析', coverage: '内容覆盖', projects: '落地项目', done: '小结' } as Record<string, string>)[s.section] ?? '—' },
    { label: '覆盖理论实验', value: `${s.coverage.flatMap(c => c.links).length} 个`, tone: s.section === 'coverage' || s.section === 'done' ? 'good' : undefined },
  ],
})
const ros2 = mkLib('ros2', 'ROS 2 · 机器人通信中间件', '机器人的"操作系统"：节点图 + 发布订阅 + DDS，几乎所有机器人软件的通信底座（库层）', 'ros2',
  '**软件库层** · ROS 2 = 机器人软件的**通信中间件 + 工具生态**(不是真操作系统)。系统拆成一堆**节点**小进程,靠**话题 pub/sub、服务、动作**通信,底层走 **DDS**(带实时/多机/安全);相比 ROS 1 完全重写。MoveIt/Nav2/Autoware 都建在它上面。许可 Apache-2.0、最新 LTS Jazzy(支持到 2029)。它是"承载算法库的底座"——算法本身在上层包里。逐段翻:特点→优缺点→覆盖→落地。',
  ['ROS 2=机器人软件通信中间件+工具生态(Apache-2.0,OSRF 维护);节点图+话题 pub/sub+服务+动作,底层 DDS',
    '相比 ROS 1 重写:实时、多机组网、生产级可靠、安全(SROS2);非硬实时(kHz 电机环下到 MCU/micro-ROS)',
    '几乎所有机器人软件的通信底座:MoveIt(机械臂)、Nav2(移动导航)、Autoware(自动驾驶)都建在其上',
    '取舍:生态巨大/模块化,但概念多、DDS 配置调试烦、量级重。TF 坐标变换↔位姿与四元数'])
const pinocchio = mkLib('pinocchio', 'Pinocchio · 刚体动力学库', '快到飞起的刚体动力学(RNEA/ABA/CRBA)+ 解析导数：机器人动力学的心脏（库层）', 'pinocchio',
  '**软件库层** · Pinocchio = **刚体动力学算法**的高性能实现:正/逆运动学、正/逆动力学、雅可比、质量矩阵,以及这些量的**解析导数**(MPC/优化必需)。它把我们「刚体动力学」实验手推的 **RNEA(逆动力学)、ABA(正向动力学)、CRBA(质量矩阵)** 做成了工业级库,是 Crocoddyl/Stack-of-Tasks 等上层控制库的公共底座。许可 BSD-2-Clause、INRIA/Stack-of-Tasks 维护。逐段翻。',
  ['Pinocchio=刚体动力学算法高性能实现(BSD-2,INRIA/SoT);FK/IK、逆动力学 RNEA、正向动力学 ABA、质量矩阵 CRBA、雅可比',
    '杀手锏=给解析导数(动力学量对 q/q̇/τ 的导数),MPC/最优控制/轨迹优化的关键;极快(模板+代码生成)',
    '内容覆盖反向连回:RNEA↔递归牛顿-欧拉、M/C/G↔机械臂运动方程、ABA↔正向动力学、雅可比/FK、计算力矩控制',
    '取舍:是"算子库"不是开箱系统、偏底层需 C++ 功底、只管动力学。是 Crocoddyl/SoT/腿足 MPC 的底座'])
const lerobotlib = mkLib('lerobotlib', 'LeRobot · 端到端机器人学习库', 'Hugging Face 的机器人学习库：标准数据集 + 策略(ACT/DP/VLA)+ 低成本真机一条龙（库层）', 'lerobot',
  '**软件库层** · LeRobot = Hugging Face 把**机器人学习**(以模仿学习为主)做成像 transformers 那样开箱即用:标准**数据集格式** LeRobotDataset、一批**策略**(ACT/Diffusion Policy/TDMPC/VLA)、**真机支持**(SO-100/SO-101 低成本臂、ALOHA)。把"采数据→训策略→上真机"降到人人能跑。我们「具身学习/项目实战」那批实验拆的就是它内部机制。许可 Apache-2.0。逐段翻。',
  ['LeRobot=HF 端到端机器人学习库(Apache-2.0,PyTorch);LeRobotDataset 数据格式+策略库(ACT/DP/TDMPC/VLA)+真机(SO-101/ALOHA)',
    '目标=把"采数据→训策略→上真机"整条流水线降到人人能跑;低成本真机(SO-101 几百刀)、HF Hub 共享数据/模型',
    '内容覆盖反向连回:ACT↔动作分块时序集成、数据管线↔delta_timestamps/归一化、遥操作↔主从遥操作、BC/Diffusion Policy',
    '取舍:模仿学习为主(数据质量定上限)、偏研究入门、依赖重。接前沿 VLA(π0 等)到低成本真机上跑'])
const mujoco = mkLib('mujoco', 'MuJoCo · 接触物理引擎', '接触丰富、又快又准的物理引擎：机器人 RL/控制研究的头号仿真器（库层）', 'mujoco',
  '**软件库层** · MuJoCo(Multi-Joint dynamics with Contact,Google DeepMind,Apache-2.0)= 通用物理引擎,主打**接触丰富**的刚体动力学(接触当凸优化、大步长稳、给解析导数),用 MJCF 描述模型;**MJX** 走 JAX 在 GPU/TPU 大规模并行、把 RL 训练加速几个数量级。学界机器人控制/RL 的默认仿真器。反向连回:接触动力学↔摩擦锥、正向动力学↔仿真一步、RL↔PPO/miniduck。逐段翻。',
  ['MuJoCo=接触丰富的通用物理引擎(Apache-2.0,DeepMind);接触当凸优化、大步长稳、给一阶解析导数;MJCF 模型;MJX(JAX GPU/TPU)并行 RL',
    '学界机器人控制/强化学习默认仿真器;dm_control/Brax/Playground 生态',
    '反向连回:接触动力学↔摩擦锥 LCP、正向动力学(仿真一步)、大规模 PPO 训练↔Open Duck Mini',
    '取舍:精于动力学与学术评测,渲染/感知逼真度不如 Isaac Sim;偏研究不偏工业数字孪生'])
const isaaclab = mkLib('isaaclab', 'Isaac Lab · GPU 机器人学习框架', 'NVIDIA GPU 大规模并行训策略、主打 sim-to-real（建在 Isaac Sim 上，库层）', 'isaaclab',
  '**软件库层** · Isaac Lab(NVIDIA,BSD-3-Clause)= 建在 Isaac Sim(Omniverse 高保真/照片级仿真)之上的**机器人学习框架**,主打**GPU 大规模并行**训策略(RL/模仿/规划)、逼真渲染+传感器仿真、sim-to-real。和 MuJoCo 互补(它强在规模与逼真感知)。反向连回:大规模 RL↔PPO/miniduck、策略/VLA 训练、感知合成数据↔点云。逐段翻。',
  ['Isaac Lab=NVIDIA GPU 机器人学习框架(BSD-3,建在 Isaac Sim/Omniverse);数千环境并行、照片级渲染+传感器仿真、sim-to-real',
    '适合机器人基座模型/RL 策略/复杂交互;和 rl_games/RSL-RL、VLA 训练打通',
    '反向连回:大规模并行 PPO↔miniduck、VLA/BC 训练、RGB-D/点云合成数据↔点云预处理',
    '取舍:强依赖 NVIDIA GPU/Omniverse 栈、体量大门槛高;轻量验证不如 MuJoCo/PyBullet'])
const pcl = mkLib('pcl', 'PCL · 点云处理库', '点云处理的老牌标准库：滤波/配准/分割/特征一整套（库层）', 'pcl',
  '**软件库层** · PCL(Point Cloud Library,BSD-3-Clause)= 2D/3D 点云处理的老牌标准库:滤波(体素下采样/离群点)、特征(法线估计 PCA)、配准(ICP 及变体)、分割、曲面重建一整套,模块化、ROS 深度集成。反向连回:体素下采样/法线估计↔点云预处理、ICP↔ICP 点云配准。逐段翻。',
  ['PCL=点云处理老牌标准库(BSD-3);滤波/特征/配准/分割/重建一整套、模块化、ROS 集成',
    '反向连回:体素下采样 + 法线估计(PCA)↔点云预处理实验、ICP 及变体↔ICP 点云配准实验',
    '几乎所有感知项目都用它(RTAB-Map 等 SLAM 大量依赖 PCL)',
    '取舍:C++ 为主编译重、偏经典几何(深度学习点云要另找)、更现代/Python 可看 Open3D'])
const orbslam3 = mkLib('orbslam3', 'ORB-SLAM3 · 视觉惯性 SLAM', '精度标杆的视觉/视觉惯性 SLAM：特征点 + 光束平差 + 回环（库层）', 'orbslam3',
  '**软件库层** · ORB-SLAM3(GPL-3.0,萨拉戈萨大学)= 精度标杆的视觉/视觉惯性 SLAM,支持单目/双目/RGB-D + IMU + 多地图。核心:ORB 特征匹配→对极几何求相对运动→PnP 重定位→光束平差(BA)优化位姿+地图点→回环检测闭合漂移。反向连回:对极几何/VO、PnP、SLAM 回环。⚠️GPL-3.0 商业慎用。逐段翻。',
  ['ORB-SLAM3=精度标杆视觉/视觉惯性 SLAM(GPL-3.0);单目/双目/RGB-D+IMU+多地图;ORB 特征+光束平差 BA+回环(DBoW2)',
    '反向连回:前端对极几何↔视觉里程计、重定位↔PnP、回环+位姿图优化↔SLAM 回环校正',
    '模式全、精度高、研究基线常用;AR/无人机/移动机器人定位建图',
    '取舍:⚠️GPL-3.0 有传染性(商业闭源慎用);稀疏特征法(稠密要另配)、纯旋转/低纹理/动态场景退化'])
const ros2control = mkLib('ros2control', 'ros2_control · 实时控制框架', 'ROS 2 的硬件抽象 + 控制器管理器：把规划的轨迹执行到电机（库层）', 'ros2control',
  '**软件库层** · ros2_control(Apache-2.0)= ROS 2 实时控制框架:把硬件(真机/仿真)抽象成统一接口,控制器管理器在实时循环里加载/切换控制器(关节轨迹/PID/力控…),把上层规划(如 MoveIt 的轨迹)执行到底层电机。反向连回:PID、阻抗/力控、关节轨迹↔轨迹规划/梯形曲线。逐段翻。',
  ['ros2_control=ROS 2 实时控制框架(Apache-2.0);硬件抽象(HardwareInterface)+控制器管理器(实时循环热插拔控制器)',
    '是"规划→执行"标准中间层:收 MoveIt 的关节轨迹、插值下发到硬件;sim 与真机同一套控制器',
    '反向连回:PID 控制器↔PID、力控/导纳↔阻抗力控、关节轨迹控制器↔轨迹规划/梯形速度曲线',
    '取舍:概念多配置繁、硬实时依赖 RT 内核、和 ROS 强耦合'])
const nav2 = mkLib('nav2', 'Nav2 · 移动机器人导航栈', 'ROS 2 自主导航：行为树 + 代价图 + 规划/控制插件（MoveIt 的移动版，库层）', 'nav2',
  '**软件库层** · Nav2(Navigation 2,Apache-2.0)= ROS 2 移动机器人自主导航标准栈:行为树编排、代价图(含膨胀层)、全局规划器(NavFn=Dijkstra/A*、Smac=混合 A*+Reeds-Shepp/Dubins、Theta*)、局部控制器(DWB、MPPI)、恢复行为。是 MoveIt 的"移动版"。反向连回:Smac↔Dubins、膨胀层↔人工势场、MPPI↔MPC、全局重规划↔D* Lite。逐段翻。',
  ['Nav2=ROS 2 移动机器人自主导航栈(Apache-2.0);行为树+代价图+全局规划器(NavFn/Smac/Theta*)+局部控制器(DWB/MPPI)+恢复',
    '反向连回:Smac 混合 A*(含 Reeds-Shepp/Dubins)↔Dubins、膨胀层代价图↔人工势场、MPPI↔MPC、全局重规划↔D* Lite',
    'MoveIt 管机械臂、Nav2 管移动底盘;扫地机/送餐/AGV/巡检的导航',
    '取舍:配置庞大(yaml+BT)调参门槛高、偏 2D/2.5D、依赖定位(AMCL/SLAM)'])
const openvla = mkLib('openvla', 'OpenVLA · 视觉-语言-动作基座模型', '开源 VLA(7B)：看图听指令直接出动作，Open X-Embodiment 训练（库层）', 'openvla',
  '**软件库层** · OpenVLA(MIT)= 开源视觉-语言-动作基座模型(7B):图+指令→机器人动作;视觉 DINOv2+SigLIP、语言 Llama 2,在 Open X-Embodiment 97 万条真机演示上训练,动作离散成 token 自回归生成。反向连回:动作 token 化↔VLA、模仿学习↔BC/ACT、生成式策略↔Diffusion Policy。逐段翻。',
  ['OpenVLA=开源视觉-语言-动作基座模型(MIT,7B);DINOv2+SigLIP 视觉+Llama 2 语言,Open X-Embodiment 97 万演示训练',
    '动作离散成 token 由语言模型自回归生成(和 ACT 动作分块同思路);可 LoRA 微调、OFT/FAST 加速',
    '反向连回:动作 token 化↔VLA、模仿学习↔BC/ACT、扩散式策略邻居↔Diffusion Policy',
    '取舍:7B 算力高实时性要优化、动作离散有精度取舍;π0/RDT/GR00T 是同类。配 LeRobot 上真机'])
const simplefoc = mkLib('simplefoc', 'SimpleFOC · 无刷电机磁场定向控制', '几行 Arduino 代码搞定无刷电机 FOC——最亲民的 FOC 库（库层，关节驱动最底层）', 'simplefoc',
  '**软件库层** · SimpleFOC(Arduino-FOC,MIT)= 最亲民的开源磁场定向控制(FOC)库,给无刷(BLDC)/步进电机做平滑力矩/速度/位置控制,把 Clarke/Park/SVPWM/电流环封成几行 Arduino 代码。反向连回:FOC 电流环↔FOC 磁场定向控制、级联 PID↔PID。是机器人关节驱动最底层的一环。逐段翻。',
  ['SimpleFOC=最亲民的开源 FOC 库(MIT,Arduino/PlatformIO);BLDC/步进的力矩/速度/位置控制,把 Clarke/Park/SVPWM/电流环封装好',
    '反向连回:FOC 电流环(Clarke→Park→PI→逆变换+SVPWM)↔FOC 磁场定向控制实验、级联位置→速度→电流三环↔PID',
    '稚晖君 Dummy-Robot 的 Ctrl-FOC-Lite 基于 SimpleFOC;DIY 机械臂/云台/力反馈的关节',
    '取舍:面向爱好者/中小功率非工业伺服级、Arduino 算力实时有限、高性能需搭好硬件'])
// ── 大模型轨 · 软件库与框架 ──
const LG = '大模型软件库与框架'
const pytorch = mkLib('pytorch', 'PyTorch · 深度学习地基', '张量+自动求导+动态图，几乎所有大模型都在它上面写（库层）', 'pytorch',
  '**软件库层** · PyTorch(BSD-3,PyTorch Foundation)= 深度学习事实标准框架:张量(GPU 加速)+ 自动求导 + 动态图 + nn 模块。你手推的前向传播、注意力、矩阵运算,写成代码就是几行 PyTorch;大模型训练/推理栈(Transformers/vLLM/DeepSpeed)全建在它上。2.x 的 torch.compile 图编译加速。反向连回:前向传播、手写注意力、多头注意力。逐段翻。',
  ['PyTorch=深度学习事实标准(BSD-3);张量+GPU+自动求导(autograd)+动态图+nn 模块+分布式(DDP/FSDP)',
    '几乎所有大模型代码的底座;Transformers/vLLM/DeepSpeed/LeRobot 都建在其上;torch.compile 图编译加速',
    '反向连回:前向传播/张量运算、手写注意力、多头注意力(它是写这些的语言)',
    '取舍:是通用框架非开箱推理服务(那要 vLLM)、大规模训练要配 DeepSpeed/Megatron'], LG)
const transformers = mkLib('transformers', 'Hugging Face Transformers · 模型库', '几行代码加载/微调几十万预训练模型——用大模型的门户（库层）', 'transformers',
  '**软件库层** · HF Transformers(Apache-2.0)= 把几十万预训练模型(GPT/LLaMA/Qwen/BERT)统一成一套 API,from_pretrained 几行加载/推理/微调;配 Tokenizers(BPE 分词)、PEFT(LoRA)、TRL(对齐)、Datasets。你实验里的注意力/多头/BPE/RoPE/RMSNorm/采样都是它的现成模块。反向连回:多头注意力/RoPE/RMSNorm/BPE/采样/束搜索。逐段翻。',
  ['HF Transformers=模型库(Apache-2.0);几十万预训练模型统一 API(from_pretrained/generate)+Tokenizers+生态',
    '反向连回:多头注意力/RoPE/RMSNorm、BPE 分词、采样/束搜索(都是它的现成模块)',
    '生态:配 PEFT(LoRA 微调)、TRL(RLHF/DPO)、Datasets、Hub 共享;跨 PyTorch/JAX/TF',
    '取舍:推理吞吐不如专用引擎(生产要 vLLM/TGI)、大而全依赖重、默认实现要配 FlashAttention 加速'], LG)
const vllm = mkLib('vllm', 'vLLM · 高吞吐推理引擎', 'PagedAttention 把 KV 缓存当"虚拟内存分页"——高吞吐 LLM 服务（库层）', 'vllm',
  '**软件库层** · vLLM(Apache-2.0,源自 UC Berkeley)= 主流高吞吐 LLM 推理/服务引擎。招牌 **PagedAttention**:把 KV 缓存像 OS 虚拟内存一样分块/按需分配/跨请求共享,消碎片、提吞吐;配连续批处理、分块预填充、投机解码、OpenAI 兼容服务。反向连回:PagedAttention/KV Cache/连续批处理/分块预填充/投机解码。逐段翻。',
  ['vLLM=高吞吐 LLM 推理/服务引擎(Apache-2.0);招牌 PagedAttention(KV 缓存仿 OS 分页、分块共享消碎片)',
    '反向连回:PagedAttention↔paged、KV Cache、连续批处理、分块预填充、投机解码',
    '开箱 OpenAI 兼容服务、张量并行多卡、前缀缓存;社区大模型支持快',
    '取舍:面向 GPU 服务(端侧看 llama.cpp)、单卡极致延迟不一定胜 TensorRT-LLM'], LG)
const sglang = mkLib('sglang', 'SGLang · 结构化推理引擎', 'RadixAttention 用基数树自动复用 KV 缓存——RAG/多轮场景吞吐领先（库层）', 'sglang',
  '**软件库层** · SGLang(Apache-2.0)= 高性能 LLM 服务引擎 + 结构化生成前端。核心 **RadixAttention**:用基数树按 token 前缀组织 KV 缓存、自动细粒度复用共享前缀(多轮/RAG/few-shot 特别快);前端 DSL 写受约束(JSON/正则)生成。反向连回:RadixAttention 前缀复用/KV Cache/连续批处理。逐段翻。',
  ['SGLang=结构化 LLM 服务引擎(Apache-2.0);核心 RadixAttention(基数树按前缀复用 KV 缓存)',
    '反向连回:RadixAttention↔radix、KV Cache、连续批处理',
    '结构化/受约束生成一等公民(JSON/正则);RAG/多轮前缀重复场景吞吐大幅领先 vLLM',
    '取舍:相对新、生态文档不如 vLLM 厚、收益依赖前缀重复场景'], LG)
const tensorrtllm = mkLib('tensorrtllm', 'TensorRT-LLM · NVIDIA 极致推理', '把 LLM 编译成高度优化的 TensorRT 引擎——NVIDIA GPU 上通常最快（库层）', 'tensorrtllm',
  '**软件库层** · TensorRT-LLM(Apache-2.0,NVIDIA)= 用 Python API 定义模型、编译成 TensorRT 引擎,在 NVIDIA GPU 上做极致优化推理(算子融合、量化 INT8/FP8/NVFP4、in-flight batching、张量/流水并行)。NVIDIA GPU 上通常吞吐/延迟最优(比 vLLM 高约 10-20%)。反向连回:量化/张量并行/推理引擎/FlashAttention。逐段翻。',
  ['TensorRT-LLM=NVIDIA 极致推理库(Apache-2.0);模型编译成 TensorRT 引擎、算子融合+量化(FP8/NVFP4)+in-flight batching',
    '反向连回:量化、张量并行/流水并行、推理引擎、FlashAttention 类核',
    'NVIDIA GPU 上吞吐/延迟通常最优(高 vLLM 约 10-20%)、配 Triton 上生产',
    '取舍:要编译引擎上手复杂、强绑 NVIDIA 硬件;vLLM 以 85% 性能换低得多的运维复杂度'], LG)
const llamacpp = mkLib('llamacpp', 'llama.cpp · 端侧本地推理', 'C++ + GGUF 量化,不用 GPU 就在笔记本/手机上跑大模型（库层）', 'llamacpp',
  '**软件库层** · llama.cpp(MIT,Georgi Gerganov)= 把大模型跑到普通设备(CPU/Apple Silicon/手机)的框架,基于自研 ggml 张量库、GGUF 格式 + 量化(Q4_K_M)大幅压内存,不用 GPU 也能跑 Llama/Qwen/Mistral。是端侧/本地 LLM 事实标准(Ollama 封装它)。反向连回:量化(GGUF)/KV Cache/采样。逐段翻。',
  ['llama.cpp=端侧本地 LLM 框架(MIT);ggml 张量库+GGUF 量化(Q2~Q8)、不用 GPU、极致可移植(手机/树莓派/wasm)',
    '反向连回:量化(GGUF)↔quant、KV Cache、采样策略',
    '本地/端侧事实标准、Ollama/LM Studio 封装它;离线/隐私场景',
    '取舍:吞吐不如 GPU 服务引擎、大模型高并发非强项、低档量化有精度损失、纯推理不训练'], LG)
const flashattn = mkLib('flashattn', 'FlashAttention · IO 感知注意力内核', '分块进 SRAM + 在线 softmax——省显存又更快、还是精确注意力（库层）', 'flashattn',
  '**软件库层** · FlashAttention(BSD-3,Tri Dao)= 注意力的高性能 GPU 内核:IO 感知(注意力分块在片上 SRAM 里算、不把 N×N 矩阵写回显存)+ 在线 softmax → 又快又省显存、且精确(不近似)。是现代大模型默认注意力实现;FA-2 翻倍/FA-3 Hopper/FA-4 Blackwell。反向连回:FlashAttention/Flash-Decoding/缩放点积掩码/手写注意力。逐段翻。',
  ['FlashAttention=IO 感知精确注意力内核(BSD-3,Tri Dao);分块进 SRAM+在线 softmax、显存 O(N) 而非 O(N²)、精确不近似',
    '反向连回:FlashAttention↔flash、Flash-Decoding↔flashdecode、缩放点积/掩码、手写注意力',
    '现代大模型训练/推理默认;能训更长上下文;被 Transformers/vLLM/TensorRT-LLM 集成',
    '取舍:是内核库要匹配 GPU 架构/CUDA、主要吃 NVIDIA、前沿版(FA-3/4)对新卡才最优'], LG)
const megatron = mkLib('megatron', 'Megatron-LM · 并行训练引擎', 'NVIDIA 的张量/流水/专家并行参考实现——切开计算本身训超大模型（库层）', 'megatron',
  '**软件库层** · Megatron-LM(Apache-2.0,NVIDIA)= 超大模型并行训练框架:当模型大到单卡放不下、ZeRO 也不够时靠切开计算本身来训。Megatron-Core 提供五种并行:张量 TP/流水 PP/数据 DP/专家 EP/上下文 CP,是 NeMo 及众多项目底层。反向连回:张量并行/流水并行/专家并行/MoE/集合通信。逐段翻。',
  ['Megatron-LM=NVIDIA 并行训练引擎(Apache-2.0);Megatron-Core 五种并行 TP/PP/DP/EP/CP、切开计算训 >70B 大模型',
    '反向连回:张量并行↔tensorpar、流水并行↔pp、专家并行↔ep、MoE、集合通信↔collective',
    '超大模型/MoE 训练参考实现、NeMo 底座、社区广泛采用',
    '取舍:门槛高配置复杂、强绑 NVIDIA 集群、偏训练非推理;常和 DeepSpeed 结合'], LG)
const deepspeed = mkLib('deepspeed', 'DeepSpeed · 训练优化(ZeRO)', '微软 ZeRO 把优化器状态切开——单卡也能训大模型 + 卸载 + MoE（库层）', 'deepspeed',
  '**软件库层** · DeepSpeed(Apache-2.0,Microsoft)= 大模型训练/推理优化库,招牌 **ZeRO(零冗余优化器)**:把优化器状态/梯度/参数分片到多卡(ZeRO-1/2/3)消冗余显存、让单卡放不下的模型也能训;还有 Offload/Infinity(卸载 CPU/NVMe)、MoE、DeepSpeed-Inference。常和 Megatron 结合。反向连回:MoE/KV 卸载/张量并行/集合通信。逐段翻。',
  ['DeepSpeed=微软训练优化库(Apache-2.0);招牌 ZeRO(优化器状态/梯度/参数分片消冗余、平民也能训大模型)',
    '反向连回:MoE、KV/状态卸载↔kvoffload、张量并行、集合通信',
    'Offload/Infinity 卸载 CPU/NVMe 训超大模型;和 PyTorch/Transformers/Megatron 打通',
    '取舍:配置项多有门槛、Offload 换来速度下降(带宽瓶颈)、偏训练侧'], LG)
const peft = mkLib('peft', 'PEFT(LoRA) · 参数高效微调', '只训极少参数(LoRA)——消费级显卡也能微调大模型（库层）', 'peft',
  '**软件库层** · PEFT(Apache-2.0,Hugging Face)= 参数高效微调:冻结大模型主体、只训极少新增参数。最有名 **LoRA**(权重旁挂低秩 A·B、只训 A/B);配 **QLoRA**(4-bit 量化基座 + LoRA)后消费级单卡就能微调几十亿模型。反向连回:量化(QLoRA)/维度规模。逐段翻。',
  ['PEFT=参数高效微调库(Apache-2.0,HF);冻结主体只训少量参数;LoRA(低秩 A·B)、QLoRA(4-bit+LoRA)',
    '反向连回:QLoRA 的量化↔quant、低秩适配的参数量↔维度/规模',
    '消费级卡微调大模型;LoRA 权重小易分发切换;和 Transformers/TRL 无缝',
    '取舍:冻结主体极端任务不如全量微调、秩/目标层要调、仍依赖好基座'], LG)
const langgraph = mkLib('langgraph', 'LangGraph · Agent 编排', '把 Agent 写成"状态图"——可控/可循环/可人审的智能体编排（库层）', 'langgraph',
  '**软件库层** · LangGraph(MIT,LangChain)= Agent 编排框架:把智能体流程写成有状态的图(节点=步骤/工具/模型、边=转移),支持循环/分支/人审/持久化,精确控制"想→调工具→观察→再想"主循环、防死循环、加子 Agent。反向连回:Agent 主循环/工具调用/子 Agent 委派/规划/上下文压缩。逐段翻。',
  ['LangGraph=Agent 编排框架(MIT,LangChain);把 Agent 写成有状态图(循环/分支/人审/持久化)',
    '反向连回:Agent 主循环↔reactagent、工具调用、子 Agent 委派、规划/Todo、上下文压缩',
    '把 Agent 从黑箱链变成可控状态图;多智能体/人审/断点续跑;OpenMAIC 就用它',
    '取舍:概念多学习曲线(图/状态/检查点)、抽象厚、轻量任务偏重'], LG)
const llamaindex = mkLib('llamaindex', 'LlamaIndex · RAG 框架', '给大模型接上你的数据——检索增强生成(RAG)的编排框架（库层）', 'llamaindex',
  '**软件库层** · LlamaIndex(MIT)= 专注 RAG(检索增强生成)的框架:私有文档切块→向量化→存向量库→检索 top-k→拼进提示词喂模型,让它基于你的数据答而非瞎编;提供数据连接器/索引/检索器/查询引擎,配各种向量库(FAISS/Milvus/Chroma)。反向连回:RAG/记忆检索打分。逐段翻。',
  ['LlamaIndex=RAG 编排框架(MIT);切块→向量化→存向量库→检索 top-k→拼 prompt→生成',
    '反向连回:RAG 检索增强生成↔rag、检索打分/排序↔记忆检索打分',
    '连各种数据源和向量库(FAISS/Milvus/Qdrant);让模型基于私有数据答、减少幻觉',
    '取舍:抽象多简单场景偏重、效果强依赖切块/检索/重排调优、和 LangChain 有重叠'], LG)
// ── 算法轨 · 软件库与框架 ──(PyTorch 软链自大模型轨,见 SOFT_LINKS)
const AG = '算法软件库与框架'
const numpy = mkLib('numpy', 'NumPy · 科学计算地基', 'N 维数组 + 向量化运算，几乎所有数据科学库都建在它上（库层）', 'numpy',
  '**软件库层** · NumPy(BSD-3,NumFOCUS)= Python 科学计算地基:核心 ndarray(N 维数组、连续内存)+向量化运算(下沉 C/SIMD、比纯 Python 快几十上百倍)+广播/线代/随机数/FFT。pandas/SciPy/scikit-learn/PyTorch 全建其上。反向连回:矩阵乘/内存布局/softmax/条件数/低秩。逐段翻。',
  ['NumPy=科学计算地基(BSD-3);ndarray N 维数组+向量化(C/SIMD)+广播+线代+随机数+FFT',
    '反向连回:矩阵乘 matmul、内存布局、softmax、条件数、低秩近似(都是它的数组运算)',
    '数据科学事实地基、生态全建其上;接口成"数组协议"标准(CuPy/JAX 兼容)',
    '取舍:单机内存内(大数据看 Dask)、CPU 为主(GPU 看 CuPy/JAX)、不含高层 ML'], AG)
const pandas = mkLib('pandas', 'pandas · 数据分析', 'DataFrame 清洗/合并/重塑结构化数据——ML 前的数据整理主力（库层）', 'pandas',
  '**软件库层** · pandas(BSD-3,NumFOCUS)= 结构化数据处理行业标准:核心 DataFrame(带行列标签的表),读写(CSV/Parquet/SQL)、清洗、缺失值、分组聚合(groupby)、合并(merge)、时间序列、透视。ML 之前的数据整理(80% 的活)都在它里。2.x 起可用 Arrow 后端提速。逐段翻。',
  ['pandas=结构化数据处理事实标准(BSD-3);DataFrame+清洗/缺失值/groupby/merge/时间序列/IO',
    '是从"原始数据"到"能喂模型的特征"之间的桥;ML/分析前的数据整理主力',
    '和 NumPy/scikit-learn/Matplotlib 无缝;Arrow 后端提速',
    '取舍:单机内存内(大数据看 Polars/Dask/Spark)、大表易慢吃内存、不做建模'], AG)
const scipy = mkLib('scipy', 'SciPy · 科学计算算法', '优化/线代/统计/信号,建在 NumPy 上——ML 方法的数值底座（库层）', 'scipy',
  '**软件库层** · SciPy(BSD-3,NumFOCUS)= 建在 NumPy 上的科学计算算法:优化(minimize/最小二乘)、线代(SVD/特征/稀疏)、统计(分布/检验)、信号、插值、积分/ODE。很多 ML/统计方法的底层数值工具来自它。反向连回:条件数/低秩(SVD)/中心极限·大数定律(分布)/梯度下降(优化)。逐段翻。',
  ['SciPy=科学计算算法库(BSD-3);优化+线代(SVD/稀疏)+统计(分布/检验)+信号+积分,建在 NumPy 上',
    '反向连回:条件数/低秩(SVD)、中心极限定理/大数定律(分布)、梯度下降(优化)',
    'ML/统计方法的数值底座(底层 BLAS/LAPACK/Fortran、快)',
    '取舍:偏底层算法非开箱 ML(那是 scikit-learn)、CPU 为主、接口专业'], AG)
const matplotlib = mkLib('matplotlib', 'Matplotlib · 数据可视化', 'Python 可视化老牌主力——什么图都能画、可控到每个像素（库层）', 'matplotlib',
  '**软件库层** · Matplotlib(BSD 兼容,NumFOCUS)= Python 数据可视化老牌主力:折线/散点/柱状/热图/等高线/3D 都能画,pyplot 上手快又可控到每个元素;seaborn 建其上做统计图、Plotly 补交互。做 ML 时画损失曲线、决策边界、特征分布、混淆矩阵都靠它——把"数字"变成"看得懂"。逐段翻。',
  ['Matplotlib=Python 可视化老牌主力(BSD 兼容);pyplot 接口+精细控制(轴/刻度/图例)+多种图+导出',
    '做 ML/分析时画损失曲线/决策边界/分布/混淆矩阵的工具;seaborn/pandas .plot 都基于它',
    '最通用、可控到出版级、生态庞大',
    '取舍:默认样式一般精修啰嗦、交互弱(看 Plotly)、两套 API 易混、大数据点渲染慢'], AG)
const sklearn = mkLib('sklearn', 'scikit-learn · 经典机器学习', '统一 API 把几十种经典 ML 算法一键可用——结构化建模首选（库层）', 'sklearn',
  '**软件库层** · scikit-learn(BSD-3,NumFOCUS)= 经典(非深度)ML 事实标准:KNN/K-Means/PCA/SVM/决策树/逻辑·线性回归/随机森林/GBDT 统一成 fit/predict/transform API,配特征处理、交叉验证、网格搜索、Pipeline。反向连回:KNN/K-Means/PCA/SVM/决策树/逻辑回归/线性回归(机器学习算法组几乎全覆盖)。逐段翻。',
  ['scikit-learn=经典 ML 事实标准(BSD-3);fit/predict/transform 统一 API+算法全+Pipeline+交叉验证+调参',
    '反向连回(最多):KNN/SVM/逻辑回归/线性回归/决策树、K-Means/PCA、GBDT——机器学习算法组几乎全覆盖',
    '结构化建模/快速基线/教学首选;和 NumPy/pandas 无缝',
    '取舍:不做深度学习(那是 PyTorch)、单机内存内、GBDT 不如 XGBoost/LightGBM 快、默认非 GPU'], AG)
const xgboost = mkLib('xgboost', 'XGBoost · 梯度提升树', '结构化数据之王——梯度提升决策树,Kaggle 常胜将军（库层）', 'xgboost',
  '**软件库层** · XGBoost(Apache-2.0,DMLC)= 梯度提升决策树(GBDT)高性能实现:一棵棵树串行拟合残差逐步变强,工程上二阶泰勒近似+正则+缺失值处理+直方图分裂+GPU。表格/结构化数据上常年最强(Kaggle 王者)。反向连回:GBDT/决策树。逐段翻。',
  ['XGBoost=梯度提升树高性能实现(Apache-2.0,DMLC);串行加树拟合残差(二阶泰勒+正则)+直方图分裂+GPU',
    '反向连回:GBDT(梯度提升)、决策树(基学习器)',
    '表格数据准确率常年最强(Kaggle 王者)、快、可扩展;金融风控/推荐/CTR',
    '取舍:不适合图像/文本(那是 DL)、调参项多、大类别要编码、比线性模型难解释(SHAP 缓解)'], AG)
const jax = mkLib('jax', 'JAX · 可微的 NumPy', '自动求导 + XLA 编译 + GPU/TPU,函数式高性能数值计算（库层）', 'jax',
  '**软件库层** · JAX(Apache-2.0,Google)= 高性能数值计算:NumPy 接口 + 自动求导(grad)+ XLA 编译(jit)+ 向量化(vmap)+ GPU/TPU。函数式风格,grad 求导、jit 编译加速、vmap 批处理。学界/前沿(DeepMind、Brax、MuJoCo MJX)大量用。反向连回:梯度下降/反向传播/矩阵运算——写 JAX 就是"可微的 NumPy"。逐段翻。',
  ['JAX=可微 NumPy 高性能计算(Apache-2.0,Google);grad 自动求导+jit(XLA 编译)+vmap/pmap+GPU/TPU',
    '反向连回:梯度下降、反向传播、矩阵乘("可微 NumPy"一条心智模型从数值到 DL)',
    '函数式(纯函数+可组合变换);前沿 DL/RL 仿真(Flax/Brax/MJX)大量用',
    '取舍:函数式思维需转变、高层 API 不如 PyTorch 厚(配 Flax)、jit 内调试有门槛'], AG)
const opencv = mkLib('opencv', 'OpenCV · 计算机视觉', '图像处理/特征/几何/相机标定一整套——CV 老牌全家桶（库层）', 'opencv',
  '**软件库层** · OpenCV(Apache-2.0(4.5+;旧版 BSD-3))= 计算机视觉老牌全家桶:图像读写/滤波卷积、特征(ORB/SIFT)、几何变换、相机标定(solvePnP)、光流、立体视觉、传统检测,还能跑 DNN。既是 CV 经典算法库,也和「机器人感知」轨的针孔/双目/点云相通。反向连回:卷积/池化(图像处理)。逐段翻。',
  ['OpenCV=计算机视觉老牌全家桶(Apache-2.0(4.5+));图像处理+特征匹配+相机标定+光流+立体+DNN 模块',
    '反向连回:卷积(图像卷积/滤波)、池化(图像金字塔/降采样);和机器人感知的针孔/双目/点云相通',
    'CV 算法最全、C++ 核心快 Python 好用、跨平台',
    '取舍:DL 训练不归它(那是 PyTorch)、API 庞杂、旧版 BSD 新版才 Apache-2.0'], AG)
const statsmodels = mkLib('statsmodels', 'statsmodels · 统计建模与推断', '回归/时间序列/假设检验——给你 p 值和置信区间（库层）', 'statsmodels',
  '**软件库层** · statsmodels(BSD-3)= 专注统计建模与推断(不同于 sklearn 的预测取向):线性/广义线性回归(OLS/GLM/logit)、时间序列(ARIMA/VAR)、假设检验、方差分析,给完整统计报告(系数/标准误/p 值/置信区间/R²)。要"解释变量显著吗"而非只"预测准"时用。反向连回:线性/逻辑回归、中心极限/大数定律。逐段翻。',
  ['statsmodels=统计建模与推断(BSD-3);回归(OLS/GLM/logit)+时间序列(ARIMA)+假设检验+完整统计报告(p 值/置信区间)',
    '反向连回:线性回归、逻辑回归、中心极限定理、大数定律(统计根基)',
    '统计推断为一等公民、时间序列/计量经济强、R 风格公式',
    '取舍:偏推断解释非大规模预测(那是 sklearn/XGBoost)、大数据/高维非强项、DL 不归它'], AG)
const networkx = mkLib('networkx', 'NetworkX · 图/网络分析', '最短路/PageRank/社区/连通——经典图算法一站式（库层）', 'networkx',
  '**软件库层** · NetworkX(BSD-3,NumFOCUS)= Python 图/网络分析库:建图(有向/无向/带权)+经典图算法——最短路(Dijkstra/A*/Bellman-Ford)、PageRank、连通/并查集、MST、最大流、中心性、社区发现。纯 Python 上手极快。反向连回:PageRank/A* 寻路/并查集(经典算法组)。逐段翻。',
  ['NetworkX=图/网络分析库(BSD-3);图数据结构+最短路(Dijkstra/A*)+PageRank+连通/并查集/MST/中心性/社区',
    '反向连回:PageRank、A* 寻路、并查集(连通)——经典算法组的现成算法',
    '纯 Python 上手极快、算法全、和 Matplotlib 集成、适合建模/教学',
    '取舍:纯 Python 大图慢(百万边看 igraph/graph-tool)、内存内、不做图神经网络(PyG/DGL)'], AG)
const gensim = mkLib('gensim', 'gensim · 主题模型与词向量', 'Word2Vec / LDA——无监督挖文本语义（库层，⚠️LGPL）', 'gensim',
  '**软件库层** · gensim(⚠️LGPL-2.1)= 主题建模与词向量经典库:Word2Vec/FastText/Doc2Vec 词/文档向量、LDA/LSI 主题模型、TF-IDF、相似度,主打无监督从大规模文本挖语义、能流式处理大语料。**Word2Vec 的著名实现出自这里**("国王−男人+女人≈王后")。反向连回:词向量。⚠️许可 LGPL-2.1(弱传染、商用要评估)。逐段翻。',
  ['gensim=主题模型与词向量经典库(⚠️LGPL-2.1);Word2Vec/FastText/Doc2Vec+LDA/LSI 主题模型+TF-IDF+流式',
    '反向连回:词向量 Word2Vec(它是 word2vec 原产地、"国王−男人+女人≈王后")',
    '无监督挖文本语义、能流式处理大语料、教学首选',
    '⚠️取舍:LGPL-2.1 比 BSD/MIT 严(商用评估)、经典方法为主(上下文向量看 Transformers)、非端到端 NLP(看 spaCy)'], AG)
// ── 408 地基 · 系统与工具 ──
const TG = '系统与工具'
const linux = mkLib('linux', 'Linux 内核 · 操作系统内核', '调度/虚拟内存/文件系统/网络栈的活教材——OS 原理的工业级真代码（系统层）', 'linux',
  '**系统与工具层** · Linux 内核(GPL-2.0)= 世界最重要的开源 OS 内核:进程调度(CFS/EEVDF)、虚拟内存(分页/缺页/页替换)、文件系统(inode/位图/日志)、并发(信号量/死锁避免)、网络栈全在里面。你「操作系统」组的实验(调度/缺页/磁盘/银行家/inode/位图/分区/信号量)在它里都有工业级实现。是学 OS 从原理到真代码的桥。逐段翻。',
  ['Linux 内核=开源 OS 内核(GPL-2.0);调度+虚拟内存+文件系统+并发+网络栈的工业级实现',
    '反向连回:调度器/缺页/虚拟内存/inode/位图/分区/磁盘/信号量/银行家——OS 组几乎全覆盖',
    'OS 原理的活教材(真代码)、生态无敌(服务器/手机/嵌入式)、可裁剪可插模块',
    '取舍:代码庞大门槛高、GPL-2.0 传染(改内核要开源)、开发要配 QEMU/GDB'], TG)
const gcc = mkLib('gcc', 'GCC · GNU 编译器套件', '把 C/C++ 源码翻成机器码——预处理→编译→汇编→链接（系统层）', 'gcc',
  '**系统与工具层** · GCC(GPLv3+运行时库例外)= 经典开源编译器套件:源码经预处理→编译(语法/优化/生成汇编)→汇编→链接变成机器码。它把「组成原理」的加减/乘法/浮点/表达式真正生成出来(gcc -S 看汇编)。是"高级语言如何变成机器指令"的窗口、几乎所有 C/C++ 项目的地基。逐段翻。',
  ['GCC=开源编译器套件(GPLv3+运行时例外);预处理→编译→汇编→链接、多语言多架构、优化(-O2/O3/SIMD)',
    '反向连回:生成加法/减法/乘法/浮点的机器级指令、编译前端的表达式求值',
    '是"源码→机器码"的活教材(gcc -S 看汇编)、生态无处不在',
    '取舍:报错历史上不如 Clang 友好、大项目编译慢、内部庞大'], TG)
const gdb = mkLib('gdb', 'GDB · GNU 调试器', '运行时透视程序——断点/单步/看寄存器/内存/栈帧（系统层）', 'gdb',
  '**系统与工具层** · GDB(GPLv3+)= 经典开源调试器:断点、单步、看寄存器/内存/栈帧/变量、反汇编、远程调试(配 QEMU 调内核)。它把「组成原理」讲的"寄存器/内存/栈/机器指令"变成看得见能拨动的东西——真看到函数调用怎么压栈。配 GCC(-g)、QEMU 是系统编程必备。逐段翻。',
  ['GDB=开源调试器(GPLv3+);断点/单步/看寄存器内存栈帧/反汇编/远程调试(配 QEMU 调内核)',
    '把运行时机器状态变可见可调——把「组成原理」的寄存器/内存/栈"看得见"(工具基石)',
    '和 GCC(-g)/QEMU 无缝、系统编程与逆向必备',
    '取舍:命令行门槛(有 TUI/IDE 前端)、优化代码调试信息会跳、需 -g'], TG)
const qemu = mkLib('qemu', 'QEMU · 整机模拟器', '在软件里跑一台"虚拟计算机"(CPU/内存/外设)——学 OS/体系结构神器（系统层）', 'qemu',
  '**系统与工具层** · QEMU(GPL-2.0)= 开源整机模拟/虚拟化:软件模拟整台计算机(CPU 指令翻译/内存/磁盘/网卡),能启动完整 OS(配 KVM 硬件加速)。把「组成原理」的流水线/缓存/虚拟内存/机器指令放到可观察可调试(配 GDB)环境跑。学 OS/体系结构、开发内核(xv6/Linux)的标准平台。逐段翻。',
  ['QEMU=整机模拟/虚拟化(GPL-2.0);模拟 CPU/内存/磁盘/外设启动完整 OS、多架构、配 KVM 加速',
    '反向连回:缓存/流水线(CPU 执行)、虚拟内存(MMU/分页模拟)',
    '整机可观察可调试(配 GDB 调内核)、云虚拟化底座、学 OS/体系结构神器',
    '取舍:纯模拟慢(要 KVM)、配置门槛、周期级精确要 gem5'], TG)
const wireshark = mkLib('wireshark', 'Wireshark · 网络抓包分析', '把每个数据包逐字段拆开——亲眼看 TCP 握手/重传/校验（系统层）', 'wireshark',
  '**系统与工具层** · Wireshark(GPL-2.0+)= 最流行的网络抓包分析工具:抓下每个包逐层逐字段解析(以太网→IP→TCP→HTTP),亲眼看 TCP 三次握手、序号确认、重传、窗口、CRC 校验、子网寻址怎么在线路上发生。你「计算机网络」组的实验(TCP/握手/子网/CRC/ARQ)能抓真实包对照。学协议从课本到真流量的桥。逐段翻。',
  ['Wireshark=网络抓包分析事实标准(GPL-2.0+);逐层解析几千种协议+显示过滤+Follow TCP Stream+专家信息',
    '反向连回:TCP/三次握手(序号确认重传窗口)、子网划分、CRC 校验',
    '协议分析/故障排查/安全分析神器、跨平台',
    '取舍:抓真实流量需权限/合规、大流量要过滤、加密流量要密钥、深用需协议背景'], TG)
const nginx = mkLib('nginx', 'nginx · 高性能 Web 服务器', '事件驱动 + epoll 扛海量并发连接——网络与 OS 交汇的活样本（系统层）', 'nginx',
  '**系统与工具层** · nginx(BSD-2)= 高性能 Web 服务器/反向代理/负载均衡:事件驱动+异步非阻塞(epoll/kqueue),单机扛海量并发连接(C10K 的答案)。它是「网络」+「操作系统」交汇处的样本——处理 TCP/HTTP 靠 OS 的 IO 多路复用(epoll,和进程调度/事件循环相通)。互联网基建最常见的一块。逐段翻。',
  ['nginx=高性能 Web 服务器/反向代理(BSD-2);事件驱动+epoll 异步非阻塞、单机扛海量并发(C10K)',
    '反向连回:TCP 连接/三次握手、IO 多路复用 epoll(和进程调度/事件循环相通)',
    'Web/代理/负载均衡/缓存/限流一把梭、稳定可靠、互联网基建标配',
    '取舍:复杂动态逻辑不如应用服务器、配置有学习曲线、依赖 OS 的 epoll'], TG)
const redis = mkLib('redis', 'Redis · 内存数据结构服务器', '哈希/跳表/集合当服务用——一座数据结构博物馆（系统层，⚠️许可变更）', 'redis',
  '**系统与工具层** · Redis(⚠️ AGPLv3/SSPLv1/RSALv2 三重许可)= 高性能内存数据结构服务器:string/hash/list/set/zset(跳表)/bitmap 当网络服务用,常做缓存/排行榜/队列。内部是数据结构博物馆——哈希表(渐进 rehash)、跳表、LRU/LFU 淘汰(和页替换同思路)。反向连回:哈希表、页替换(LRU)。⚠️2024 从 BSD 改 source-available,Redis 8(2025)加回 AGPLv3、商用要看清。逐段翻。',
  ['Redis=内存数据结构服务器(⚠️AGPLv3/SSPLv1/RSALv2);丰富数据结构(哈希/跳表/集合)+持久化+淘汰策略',
    '反向连回:哈希表(渐进式 rehash)、页替换 LRU/LFU(内存满淘汰、和缺页同思路)',
    '极快(内存+单线程事件循环)、缓存/排行/队列/限流/分布式锁',
    '⚠️取舍:许可变更(source-available/AGPL,商用评估;BSD 分叉是 Valkey)、内存贵、单线程核心'], TG)
const sqlite = mkLib('sqlite', 'SQLite · 嵌入式数据库', '一个文件、一段 B 树,部署最广的数据库——B 树落盘的活样本（系统层）', 'sqlite',
  '**系统与工具层** · SQLite(公有领域)= 世界部署最广的数据库引擎(手机/浏览器/OS 里都有):嵌入式、零配置、单文件关系数据库,整库就是一个 .db 文件。存储引擎核心是 B 树/B+ 树(表和索引都是 B 树)——正是你「数据结构」的 btree/bplus。SQL+事务(ACID)+WAL 俱全。理解"数据库怎么把 B 树落到磁盘文件"的最佳样本。许可公有领域。逐段翻。',
  ['SQLite=部署最广的嵌入式数据库(公有领域);单文件+零配置+B 树存储+完整 SQL+ACID 事务+WAL',
    '反向连回:B 树/B+ 树(表和索引都是 B 树)、哈希/查找',
    'B 树落盘的活教材、极稳(海量测试)、可移植无服务进程',
    '取舍:高并发写不如客户端-服务器 DB(单写者)、不适合海量分布式(看 Postgres/MySQL)'], TG)
const git = mkLib('git', 'Git · 分布式版本控制', '内容寻址 + 有向无环图 + 哈希——数据结构的杰作（系统层）', 'git',
  '**系统与工具层** · Git(GPL-2.0)= 世界主流分布式版本控制,也是数据结构杰作:内部是内容寻址对象库——文件/目录/提交按内容 SHA 哈希寻址(改一点哈希就变),提交连成有向无环图 DAG(父指针),分支是指针。反向连回:哈希、拓扑排序(DAG)。理解 Git 对象模型=把哈希+DAG+内容寻址串一遍。逐段翻。',
  ['Git=分布式版本控制(GPL-2.0);内容寻址对象(SHA 哈希)+提交 DAG(父指针)+轻量分支+zlib 压缩去重',
    '反向连回:哈希表(内容寻址)、拓扑排序(提交 DAG);内容去重和布隆/压缩思路相通',
    '版本控制事实标准、对象模型优雅、生态无敌(GitHub/GitLab)',
    '取舍:命令多心智门槛、大二进制不友好(要 LFS)、GPL-2.0'], TG)
const docker = mkLib('docker', 'Docker · 容器', '命名空间 + cgroups + 联合文件系统"打包隔离环境"——OS 隔离活样本（系统层）', 'docker',
  '**系统与工具层** · Docker(Apache-2.0,moby 引擎)= 主流容器平台:把应用+依赖打包成镜像在隔离环境跑。不是虚拟机,直接用 Linux 内核原语——namespaces(隔离进程/网络/文件视图)+cgroups(限 CPU/内存)+overlayfs(镜像分层)。是「操作系统」隔离/资源管理的活样本。反向连回:cgroups↔调度、overlayfs↔inode/文件系统。逐段翻。',
  ['Docker=容器平台(Apache-2.0,moby;Desktop 另有商业条款);用 Linux 内核 namespaces+cgroups+overlayfs 做隔离',
    '反向连回:cgroups 资源限制(和调度/配额相关)、联合文件系统 overlayfs(和 inode/文件系统相关)',
    '环境一致、轻量(共享内核比 VM 省)、部署标准、生态巨大(对接 Kubernetes)',
    '取舍:共享内核隔离弱于虚拟机、强依赖 Linux 原语、Desktop 有商业授权(引擎开源)'], TG)
const xv6 = mkLib('xv6', 'xv6 · 教学操作系统', 'MIT 几千行代码读懂一个真 OS——学 OS 的最佳真代码教材（系统层）', 'xv6',
  '**系统与工具层** · xv6(MIT)= MIT OS 课(6.S081)的教学操作系统:几千行、能真跑的类 Unix 内核(RISC-V + QEMU),麻雀虽小五脏俱全——进程/调度、系统调用、虚拟内存(分页)、陷阱中断、文件系统(inode/日志)、锁。Linux 太大读不动,xv6 正好。反向连回:调度、缺页、inode。学 OS 的最佳真代码教材。逐段翻。',
  ['xv6=MIT 教学操作系统(MIT 许可);几千行能真跑的类 Unix 内核(RISC-V+QEMU),涵盖进程/内存/FS/锁',
    '反向连回:进程调度、缺页/虚拟内存、inode+日志文件系统',
    '小到能完整读懂一个真 OS、可编译运行调试、教学一流(6.S081)',
    '取舍:教学用非生产内核、功能精简(无网络栈)、要 RISC-V/QEMU 环境'], TG)
const curl = mkLib('curl', 'curl · 网络客户端', '无处不在的命令行/库——把 HTTP 等协议请求发出去（系统层）', 'curl',
  '**系统与工具层** · curl(curl License,MIT/X 派生)= 部署量最大的软件之一(几乎每台设备里):命令行 + 库 libcurl,把 HTTP(S)/FTP 等几十种协议请求发出去。它是「网络」的客户端侧样本——一次 curl 背后就是 DNS→TCP 三次握手→TLS 握手→HTTP 请求响应(curl -v 看全过程)。理解"客户端怎么发起一次网络请求"最直接的工具。逐段翻。',
  ['curl=网络客户端(curl License,MIT 派生);命令行+libcurl 库、HTTP(S)/FTP 等几十种协议、部署量最大之一',
    '反向连回:一次请求=DNS→TCP 三次握手→TLS→HTTP(curl -v 看握手和头)',
    '协议全、命令行/库两用、调 API 首选、学网络客户端侧神器',
    '取舍:是客户端不做服务端(那是 nginx)、选项极多、复杂交互不如专用 HTTP 库'], TG)
const miniduck: Experiment<DuckState> = {
  id: 'miniduck', group: '具身项目实战', title: 'Open Duck Mini · 学会走路', subtitle: 'BD-X 迷你复刻的腿式 RL：相位参考步态 + 「模仿奖励」(≠模仿学习)；LeRobot 线收官',
  kernel: miniduckKernel, defaultDoc: { kind: 'miniduck', params: { mode: '带模仿奖励' }, entities: [], streams: [] },
  params: [{ key: 'mode', label: '消融', kind: 'enum', options: ['带模仿奖励', '只 velocity', 'reference+PD 无策略'] }],
  paramsNote: 'miniduck=**Open Duck Mini**(迪士尼 BD-X 开源迷你复刻，Pollen/HF，现商品化 Microduck)。它**不是** LeRobot 模仿学习(ACT/Diffusion)，而是**腿式 RL**:MuJoCo Playground 里 Brax PPO(沿用 Berkeley Humanoid)训练、50Hz 跑 Pi Zero 2W。**整条线最值钱的一句:「模仿奖励」≠「模仿学习」**——模仿学习(ACT/BC)监督克隆示教、累积误差、无恢复;模仿奖励(DeepMimic 家族)是 RL 里一个**奖励项**、奖励跟踪相位对齐的参考步态、会探索会恢复。确定性单步:①相位 t=(i mod N)/N→φ=(cos,sin) ②参考 q̂(Placo 生成、相位索引) ③策略残差 u=q_def+0.25a→PD τ=kp(u−q)−kd·q̇(PID 内环) ④奖励 r=2.5R_vel+1.0R_imit+20alive，R_imit 主导 −15‖q−q̂‖² ⑤摔判 projected_gravity_z<0。切「消融」看带模仿(直立)/只velocity(步态退化)/无策略(欠驱动摔倒)。相位/参考/奖励现算。连「PID/FK/BC」。详见讲解卡。',
  bounds: [
    '「模仿奖励」≠「模仿学习」:模仿学习(ACT/BC)监督克隆示教、累积误差、无恢复;模仿奖励(DeepMimic)=RL 奖励项、跟踪相位对齐参考步态、会探索会恢复',
    '确定性单步:相位 t=(i mod N)/N→φ(cos,sin)、参考 q̂(相位索引、Placo 生成)、策略残差 u=q_def+0.25a、PD τ=kp(u−q)−kd·q̇、奖励主导项 −15‖q−q̂‖²',
    '消融:带模仿→直立自然;只velocity(去模仿项)→步态退化(reward 看着差不多、步态却塌,证明模仿奖励买自然步态);无策略→开环 q=q̂ 也摔(欠驱动浮基未镇定)',
    '非对称 actor-critic(critic 看真值、actor 只用 IMU+相位免特权量);sim2real 靠作动器辨识+域随机化+随机推搡。真实框架:Open_Duck_Playground(Brax PPO@MuJoCo Playground)',
  ],
  tabs: [{ id: 'mk', label: '单步逐步拆' }], Stage: MiniDuckStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '模仿奖励≠模仿学习' }
    : s.stage === 'ablate' ? (s.mode === 'imit' ? { key: 'good', label: '直立自然' } : s.mode === 'velonly' ? { key: 'bad', label: '步态退化' } : { key: 'bad', label: '摔倒' })
    : s.stage === 'reward' ? { key: 'idle', label: `r=${s.reward}` }
    : s.stage === 'policy' ? { key: 'idle', label: '残差+PD' }
    : s.stage === 'phase' ? { key: 'idle', label: '相位+参考' }
    : { key: 'idle', label: '腿式RL' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '鸭', phase: '相', policy: '策', reward: '奖', ablate: '消', done: '收' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '模式', value: s.modeLabel },
    { label: '相位 t / 结局', value: `${s.showPhase ? s.phaseT : '—'} / ${s.showOutcome ? (s.mode === 'imit' ? '直立' : s.mode === 'velonly' ? '退化步态' : '摔倒') : '—'}`, tone: s.showOutcome && s.mode !== 'imit' ? 'bad' : undefined },
    { label: '本步奖励 r', value: s.showReward ? `${s.reward}` : '—' },
    { label: '本步', value: ({ intro: '腿式RL≠模仿学习', phase: '相位+参考步态', policy: '残差动作+PD', reward: '奖励分解', ablate: '消融对照', done: '模仿奖励≠模仿学习' } as Record<string, string>)[s.stage] ?? '—' },
  ],
}
const teleop: Experiment<TeleState> = {
  id: 'teleop', group: '具身项目实战', title: 'LeRobot · 主从遥操作', subtitle: 'SO-101 一对同构臂：读 leader 原始码→标定角→max_relative_target 安全钳→写 follower；采集示教数据的入口',
  kernel: teleopKernel, defaultDoc: { kind: 'teleop', params: { safety: '开 max_relative_target' }, entities: [], streams: [] },
  params: [{ key: 'safety', label: '安全钳', kind: 'enum', options: ['开 max_relative_target', '关（直通）'] }],
  paramsNote: 'SO-101 是**一对同构机械臂**(连杆尺寸一样):**leader** 可反驱、人手拧;**follower** 复制关节角。关键:两臂同构→**直接抄关节角就复现同一末端位姿、不用 IK**(结构不同才要重定向)。一步四件事:①读 leader 原始舵机码(0~4095,12位、装配零位随机)②标定 角=(码−homing_offset)×360/4096 ③**max_relative_target** 安全钳 goal=present+clamp(Δ,±15°) ④写 follower、舵机**内部 PID** 执行。切「安全钳」看抖动关节(腕转 Δ≈90°)被钳(开)还是直通急跳(关、危险)。遥操作录下的 (obs,action)=ACT/BC 示教数据集。标定/钳/跳变现算。连「FK/PID/ACT·BC」。详见讲解卡。',
  bounds: [
    '主从遥操作:leader 反驱人手拧、follower 复制;**同构臂直接抄关节角、不用 IK**(结构不同才要重定向/retarget)',
    '原始舵机码 0~4095(12位、装配零位随机)要标定:角=(码−homing_offset)×360/4096;标定还含 range/符号',
    'max_relative_target 每步限幅 goal=present+clamp(Δ,±15°):防通信抖动/leader 跳变时急跳撞坏;写目标后舵机 PID 内环执行',
    '闭环:遥操作同步录 (observation.state, action)=ACT/Diffusion/BC 的示教数据集;FK 画末端轨迹。真实框架:LeRobot(so101_follower/leader、teleoperate.py)',
  ],
  tabs: [{ id: 'tp', label: '遥操作逐步跑' }], Stage: TeleopStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '跟随+录数据' }
    : s.stage === 'safety' ? (s.safety === 'on' ? { key: 'bad', label: `钳 ${s.clampedN} 关节` } : { key: 'bad', label: '直通急跳' })
    : s.stage === 'calib' ? { key: 'idle', label: '标定成角' }
    : s.stage === 'readraw' ? { key: 'idle', label: '读原始码' }
    : { key: 'idle', label: '同构·免IK' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 5)),
  tickLabel: s => ({ intro: '构', readraw: '码', calib: '标', safety: '钳', done: '录' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '安全钳', value: `${s.safety === 'on' ? '开' : '关（直通）'} · ±${s.maxRel}°` },
    { label: '关节数', value: `${s.joints.length}（同构→免 IK）` },
    { label: '被钳关节', value: s.showGoal ? `${s.clampedN}${s.clampedN ? '（腕转抖动）' : ''}` : '—', tone: s.showGoal && s.clampedN ? 'bad' : undefined },
    { label: '本步', value: ({ intro: '同构·抄关节角', readraw: '读原始码', calib: '标定成角', safety: 'max_relative_target 钳', done: '跟随+录示教' } as Record<string, string>)[s.stage] ?? '—' },
  ],
}
const normstats: Experiment<NSState> = {
  id: 'normstats', group: '具身项目实战', title: 'LeRobot · 数据集归一化', subtitle: '用整套数据集的统计量把特征拉到同一量级：MEAN_STD/MIN_MAX，输入归一化+输出反归一化',
  kernel: normstatsKernel, defaultDoc: { kind: 'normstats', params: { policy: '给 ACT' }, entities: [], streams: [] },
  params: [{ key: 'policy', label: '喂给哪个策略', kind: 'enum', options: ['给 ACT', '给 Diffusion'] }],
  paramsNote: 'LeRobot 把 state/action 的统计量**在整套数据集上算一遍**存进 meta/stats(不是 BatchNorm 每批现算)→归一化是**固定、可逆的仿射变换**。两模式:**MEAN_STD** x′=(x−μ)/(σ+eps)(ACT 默认,对无界的关节角/力矩自然、离群较稳);**MIN_MAX** x′=2(x−min)/(max−min)−1 映射 **[-1,1]**(Diffusion 用,配加噪 schedule,但**离群敏感**——会把正常样本挤扁)。σ=√(E[x²]−μ²)。关键坑:策略**输出**的是归一化动作,必须用**同一套统计量反归一化**再发给机器人,漏了=动作全错的静默 bug。切「策略」看高亮哪条路+反归一化用哪个模式。统计量/归一化/反归一化现算。连下游 PID/遥操作吃的真实动作。详见讲解卡。',
  bounds: [
    '归一化统计量(μ/σ/min/max)在整套数据集上算一遍存 meta/stats→固定可逆仿射变换(非 BatchNorm 每批现算);σ=√(E[x²]−μ²)',
    'MEAN_STD (x−μ)/(σ+eps):ACT 默认、对无界特征/离群较稳;MIN_MAX 2(x−min)/(max−min)−1 映射[-1,1]:Diffusion 用、离群敏感',
    '两端各一次:输入端归一化观测、输出端**反归一化动作**(同一套统计量);漏了输出反归一化=动作幅度全错的静默 bug',
    '为何不用 BatchNorm(部署要确定可逆);图像另走(/255 或 ImageNet 统计);离群多改分位数/robust。真实框架:LeRobot(normalize.py NormalizationMode)',
  ],
  tabs: [{ id: 'ns', label: '归一化逐步跑' }], Stage: NormStatsStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '两端归一化' }
    : s.stage === 'unnorm' ? { key: 'bad', label: '反归一化' }
    : s.stage === 'minmax' ? { key: 'idle', label: '离群敏感' }
    : s.stage === 'meanstd' ? { key: 'idle', label: 'MEAN_STD' }
    : s.stage === 'stats' ? { key: 'idle', label: '算统计量' }
    : { key: 'idle', label: '量纲差异' }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '差', stats: '统', meanstd: '标', minmax: '缩', unnorm: '还', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '策略 / 模式', value: `${s.policy} · ${s.mode === 'MEAN_STD' ? '均值方差' : '最小最大'}` },
    { label: '特征数', value: `${s.cols.length}(各存 μ/σ/min/max)` },
    { label: '反归一化', value: s.showUnnorm ? `${s.policyOut}→${s.unnormVal}(漏则 ${s.forgotVal})` : '—', tone: s.showUnnorm ? 'bad' : undefined },
    { label: '本步', value: ({ intro: '量纲差异', stats: '全数据集统计量', meanstd: 'MEAN_STD', minmax: 'MIN_MAX(离群敏感)', unnorm: '反归一化', done: '两端归一化' } as Record<string, string>)[s.stage] ?? '—' },
  ],
}
const actte: Experiment<ActState> = {
  id: 'actte', group: '具身项目实战', title: 'ACT · 动作分块 + 时序集成', subtitle: 'LeRobot 旗舰策略：预测一整块动作、把重叠预测加权平均，治抖动与复合误差',
  kernel: actteKernel, defaultDoc: { kind: 'actte', params: { m: '默认' }, entities: [], streams: [] },
  params: [{ key: 'm', label: '集成权重', kind: 'enum', options: ['均等', '默认', '重旧'] }],
  paramsNote: 'LeRobot 旗舰策略 ACT 怎么让机械臂不抖不漂(面试高频)。单步 BC 一步错、状态偏、误差滚雪球(复合误差)。ACT 两招：①**动作分块**——一次观测预测未来 K 个动作(真值 chunk_size=100)，有效时域 T→T/K；②**时序集成**——每步都重预测一整块，同一动作被好几块预测到(不一致=抖)，加权平均抹平：权重 **w_i=exp(-m·i)**、i=0 是**最旧**那条，执行 a_t=Σw·P/Σw。m 默认 0.01≈均匀略偏旧。⚠️八股陷阱：LeRobot **默认关**集成(走队列 receding-horizon)、读配置别只读论文。切「权重 m」看集成。集成/轨迹现算。连「模仿学习·行为克隆」的复合误差。详见讲解卡。',
  bounds: [
    '动作分块:一次预测 K 个动作(chunk_size=100)、有效时域 T→T/K、把复合误差机会砍到 1/K',
    '时序集成:每步重预测→同一动作多块重叠→加权平均抹抖动；权重 w_i=exp(-m·i)、最旧 w₀、m 默认 0.01',
    '分块≠集成(独立两招);⚠️ LeRobot 默认关集成(n_action_steps=100 走队列)、开要 n_action_steps=1',
    'ACT 还用 CVAE 潜变量吸收人类示范多样性(测试 z=0)。连 BC 复合误差;对比 Diffusion Policy(迭代去噪)。真实框架:LeRobot(ACT 论文 2304.13705)',
  ],
  tabs: [{ id: 'at', label: 'ACT 逐步跑' }], Stage: ActTeStage, whyInRail: true,
  tone: s => (s.stage === 'done' ? { key: 'good', label: '分块+集成' }
    : s.stage === 'traj' ? { key: 'good', label: '集成更平滑' }
    : s.stage === 'ensemble' ? { key: 'good', label: `a${s.detailT}=${s.ensembled}` }
    : s.stage === 'overlap' ? { key: 'bad', label: `${s.votes.length} 块重叠·抖` }
    : s.stage === 'chunk' ? { key: 'idle', label: `预测 K=${s.K}` }
    : { key: 'idle', label: `权重 ${s.mKey}` }),
  metric: s => (s.stage === 'done' ? 1 : Math.max(0, (s.step + 1) / 6)),
  tickLabel: s => ({ intro: '始', chunk: '块', overlap: '叠', ensemble: '集', traj: '轨', done: '成' }[s.stage] ?? '·'),
  readouts: s => [
    { label: '动作块长 K', value: `${s.K}（真值 100）` },
    { label: '集成权重', value: `${s.mKey}（m=${s.m}，w_i=exp(-m·i)）` },
    { label: `a${s.detailT} 集成 / 只用最新`, value: s.ensembled ? `${s.ensembled} / ${s.newest}（真值≈${s.trajTrue[s.detailT]}）` : '—', tone: s.ensembled ? 'good' : undefined },
    { label: '本步', value: ({ intro: '动作分块+时序集成', chunk: '① 分块预测', overlap: '② 多块重叠', ensemble: '③ 加权集成', traj: '④ 全程对比', done: '收尾' } as Record<string, string>)[s.stage] ?? '—' },
  ],
}
const lerobot: Experiment<LeRobotState> = {
  id: 'lerobot', group: '具身项目实战', title: 'LeRobot × SO-101 开源实战', subtitle: '低成本机械臂：装配→采集→训练→自主抓取（含真算 FK 仿真）',
  kernel: lerobotKernel, defaultDoc: { kind: 'lerobot', params: {}, entities: [], streams: [] }, params: [],
  paramsNote: '把前面所有课落到能真买真搭的开源硬件：SO-101(HuggingFace×TheRobotStudio 低成本3D打印臂，5自由度+夹爪、6颗STS3215舵机、leader/follower主从两条臂)+LeRobot库。全链路走一遍并给真实CLI命令(照抄自官方文档、可据此真搭)：装配标定→leader遥操follower采集≥50段示范→lerobot-train训ACT策略→lerobot-rollout自主抓取。部署段接一个真算FK的SO-101手臂抓取仿真(home→伸手→合爪→抬起，位姿每帧正运动学现算)。',
  bounds: ['SO-101=低成本3D打印臂:6颗STS3215舵机、5自由度+夹爪、leader(遥操手柄)/follower(干活)主从两条臂', '全链路(模仿学习那套):装配标定(find-port/setup-motors/calibrate)→leader遥操follower采集示范(lerobot-record ≥50段)→训练(lerobot-train --policy.type=act)→部署(lerobot-rollout)', '策略:ACT(动作分块Transformer,默认)/Diffusion Policy(多峰)/π0/SmolVLA(VLA);评估策略base/sentry/dagger(人在环)', '部署段是真算模拟引擎:SO-101简化四连杆,手臂每帧位姿由正运动学从关节角现算、方块抓住跟夹爪走(真机用MuJoCo/硬件);命令照抄官方文档'],
  tabs: [{ id: 'design', label: '开源实战' }], Stage: LeRobotStage, whyInRail: true,
  tone: s => (s.phase === 'done' ? { key: 'good', label: '抓取成功' } : s.holding ? { key: 'good', label: '抓住方块' } : { key: 'idle', label: s.stageLabel.replace(/^[①②③④⑤]\s*/, '').split(' ')[0] || '就绪' }),
  metric: s => (s.phase === 'done' ? 1 : Math.max(0, (s.step + 1) / 9)),
  tickLabel: s => (s.phase === 'done' ? '抓' : s.op === 'pose' ? '臂' : s.op === 'train' ? '训' : s.op === 'record' ? '采' : s.op === 'setup' ? '标' : s.op === 'hardware' ? '硬' : 'L'),
  readouts: s => [
    { label: '阶段', value: s.stageLabel || '就绪' },
    { label: '策略', value: 'ACT（也可 Diffusion/π0）' },
    { label: '夹爪', value: s.gripper === 'closed' ? '合' : '开', tone: s.holding ? 'good' : undefined },
    { label: '抓取', value: s.holding ? '抓住方块' : s.phase === 'deploy' || s.phase === 'done' ? '执行中' : '—', tone: s.holding ? 'good' : undefined },
  ],
}

export const EXPERIMENTS = [
  cache, float, multiply, addsub, pipeline, vm,
  page, scheduler, disk, banker, mvcc, iso, cas, mesi, deadlock, raft,
  caesar, vigenere, xorcipher, modpow, diffiehellman, rsa, extgcd, signature, hashaval, merkle, crt, fermat, salt, ecbcbc, birthday, aesround, hmac, totp,
  tokenbucket, consistenthash, skiplist, twopc, snowflake, vectorclock, quorum, circuitbreaker, joins, compositeindex, bufferpool, queryplan, wildcard, regex, blockingqueue, rwlock, aba, happensbefore, lockstrategy, lrucache, lfucache, trie, quickselect, reactagent, ctxcompact, toolcall, permguard, subagent, memretrieve, mempaging, reflection, memwrite, planning, promptbuild, otpreuse, wal, lsm, minikv, minisearch, urlshortener, seckill, mqdesign, topk, feed, objectstore,
  partition, inode, semaphore, bitmap,
  sort, dijkstra, avl, btree, expr, bplus, hash, huffman, kmp, mst, topo, traverse, bloom, editdist, greedy,
  tcp, arq, crc, hamming, subnet, handshake, csma, rip,
  radix, paged, kvcache, batching, flash, specdec, roofline, tensorpar, collective, chunkprefill, kvoffload, linattn, engram, flashdecode, dpattn, ep, pp, engine,
  matmul, layout, softmax, attention, scaledmask, bayes, xent, jl, maxent, clt, lln, graddesc, residual, lowrank, condnum, scale, ortho, hopfield, induction, dotsim, rope, rmsnorm, mha, llmsize, sampling, bpe, quant, moe, forward,
  linreg, logreg, dtree, gbdt, svm, pca, kmeans, knn, pagerank, qlearn, recsys, conv, backprop, perceptron, pooling, rnn, lstm, wordvec, norm, gcn, diffusion, gan, beam, rag, selfconsist, bestofn, tot, mcts, binsearch, nqueens, unionfind, heap, quicksort, mergesort, fastpow, astar, collision,
  fk, dyneom, rnea, fwddyn, computedtorque, contactlcp, ik, jacobian, quat, trajectory, kalman, ekf, particlefilter, ukf, complementary, pinhole, pointcloud, stereo, handeye, vo, pnp, icp, slam, impedance, mpc, pid, rrt, rrtconnect, rrtstar, prm, potentialfield, chomp, trapezoid, gjk, dubins, dstarlite, mdp, qlearning, policygrad, ppo, bc, diffpolicy, vla, lerobot, actte, deltats, normstats, teleop, miniduck, foc, moveit, ros2, pinocchio, lerobotlib, mujoco, isaaclab, pcl, orbslam3, ros2control, nav2, openvla, simplefoc, pytorch, transformers, vllm, sglang, tensorrtllm, llamacpp, flashattn, megatron, deepspeed, peft, langgraph, llamaindex, numpy, pandas, scipy, matplotlib, sklearn, xgboost, jax, opencv, statsmodels, networkx, gensim, linux, gcc, gdb, qemu, wireshark, nginx, redis, sqlite, git, docker, xv6, curl,
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
  //  B+树是数据库索引地基、布隆过滤器是缓存穿透/LSM 读加速的常客——真身在地基轨，软链进后端。
  '数据库系统': ['bplus', 'bloom'],
  //  信号量/生产者消费者、银行家(死锁)本身就是后端并发面试核心——真身在 408「操作系统」，软链进后端轨。
  '并发编程': ['semaphore', 'banker'],
  //  A* 栅格寻路也是机器人运动规划的经典——真身在算法轨「经典算法」，软链进具身智能轨「运动规划」，和 RRT(采样式)配成栅格最优 vs 采样两条路。
  '运动规划': ['astar'],
  //  PyTorch 真身在大模型轨「大模型软件库与框架」,软链进算法轨库层(它也是算法/DL 实验的底座)。
  '算法软件库与框架': ['pytorch'],
}

export const DISCIPLINES: Discipline[] = [
  // 一级菜单 = 「408 地基 + 求职岗位」(2026-08-27 定)。地基轨在前,岗位轨在后。
  // 实验的 group 字段不变,只是重新归轨;一个实验可 SOFT_LINKS 跨轨挂载
  // (如 dijkstra 真身在地基轨「数据结构」,软链进算法轨「经典算法」)。
  // 名字只留核心、不带「工程师」。物理等非 CS 学科已下线(collision 的 group '力学' 成孤儿不显示)。
  {
    key: 'base', title: '408 基础', icon: '🎓', status: 'active',
    sub: '数据结构·组成·OS·网络 —— 考研与所有岗位的地基',
    groups: ['数据结构', '计算机组成原理', '操作系统', '计算机网络', '系统与工具'],
    guide: { from: '一次内存访问', to: '吃透 408 四门', toIcon: '🎓' },
  },
  // 后端轨已下线(2026-09-02 用户只保留 408/算法/大模型/具身四轨);实验仍在 EXPERIMENTS 里、
  // 其 group(数据库系统/并发编程/分布式系统/系统设计/项目实战)成孤儿不显示,未删除,日后可恢复或重挂。
  {
    key: 'algo', title: '算法', icon: '🧮', status: 'active',
    sub: '经典算法 → 会学习的模型 · 求职',
    groups: ['经典算法', '概率统计原理', '机器学习基础', '机器学习算法', '深度学习算法', '算法系统设计', '算法项目实战', '算法软件库与框架'],
    guide: { from: '一次排序', to: '会学习的模型', toIcon: '🧠' },
  },
  {
    key: 'llm', title: '大模型', icon: '🧩', status: 'active',
    sub: 'Transformer → 推理引擎 · 求职',
    groups: ['Transformer 原理', '大模型算法', '大模型推理', '大模型项目实战', '大模型软件库与框架'],
    guide: { from: '一次注意力', to: '大模型推理引擎', toIcon: '🤖' },
  },
  {
    key: 'embodied', title: '具身智能', icon: '🦾', status: 'active',
    sub: '机器人学 → 感知 · 控制 · 规划 → 具身智能',
    // 从零到具身智能工程师：机器人学基础(运动学/雅可比)→感知(卡尔曼/SLAM)→控制(PID/力控)
    // →规划(RRT)→具身学习(模仿/RL/VLA)→开源实战(LeRobot/MuJoCo)。分组随实验增量补齐。
    groups: ['机器人学基础', '刚体动力学', '机器人感知', '机器人控制', '运动规划', '机器人强化学习', '具身学习', '具身项目实战', '软件库与框架'],
    guide: { from: '一次关节转动', to: '具身智能工程师', toIcon: '🦾' },
  },
  // 安全轨已下线(2026-09-02 用户只保留 408/算法/大模型/具身四轨);密码学实验仍在 EXPERIMENTS 里、成孤儿不显示,未删除。
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
  { key: 'robot', label: '机器人', icon: '🦾', kind: '造物' },
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
  '系统设计': 'internet',
  '项目实战': 'software',
  '密码学': 'internet',
  '计算机网络': 'internet',
  '概率统计原理': 'llm',
  '机器学习基础': 'llm',
  'Transformer 原理': 'llm',
  '大模型推理': 'llm',
  '算法系统设计': 'internet',
  '算法项目实战': 'software',
  '大模型项目实战': 'llm',
  '机器人学基础': 'robot',
  '机器人感知': 'robot',
  '机器人控制': 'robot',
  '运动规划': 'robot',
  '具身学习': 'robot',
  '具身项目实战': 'robot',
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
