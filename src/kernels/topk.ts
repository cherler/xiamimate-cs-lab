/**
 * 内核：系统设计 · 海量数据 Top-K —— 10 亿条里求出现最多的 K 个（算法 · 系统设计 / 求职）
 * 轴：step —— 需求→估算→哈希分片→分片内堆→归并→权衡，算法向的系统设计题
 *
 * "求海量数据里出现频率最高的 K 个"(热搜词、热门商品、高频 IP)是算法+系统设计的经典题。
 * 难点:数据量大到**内存装不下全部计数**。思路:
 *   · 哈希分片:hash(x)%N 把数据切成 N 个小文件——**相同的 x 一定进同一片**(哈希确定性),
 *     所以每片能独立统计、互不影响。
 *   · 分片内用**大小为 K 的小顶堆**求本片 Top-K(堆顶=第 K 大,新元素比堆顶大就替换,O(㏒K))。
 *   · 归并:把各片的 Top-K 再归并求全局 Top-K。
 * 复用「需求→估算→核心→扩展→权衡」框架。值可核:每步一个真实决策。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'
import type { SysDesignState } from './urlshortener.ts'

type Comp = { id: string; label: string; role: string }
type Frame = Omit<SysDesignState, 'i'>

const STAGES: { stage: string; focus: string; detail: string; metric: string; add?: Comp[] }[] = [
  {
    stage: '① 需求澄清', focus: '10 亿条里求 Top-K，但内存装不下全部',
    detail: '给 10 亿条记录（搜索词/商品/IP），求出现次数最多的 **K 个**（如 Top-10）。核心约束：**不同的 key 可能上亿，全部放进哈希表计数会撑爆内存**。所以不能"一把哈希表数完"。',
    metric: '数据 10 亿条，key 上亿，内存放不下全部计数',
    add: [{ id: 'src', label: '海量数据源', role: '10 亿条记录' }],
  },
  {
    stage: '② 容量估算', focus: '算清内存放不下，必须分而治之',
    detail: '假设 1 亿个不同 key、每个 key+计数占几十字节 → 数 GB，超单机内存。结论：**分而治之**，把大问题切成能塞进内存的小问题。',
    metric: '全量计数数 GB → 超内存 → 分片',
    add: [{ id: 'split', label: '分治', role: '切成小块' }],
  },
  {
    stage: '③ 哈希分片', focus: '相同 key 一定进同一片，各片独立统计',
    detail: '用 **hash(key) % N** 把数据分到 N 个小文件。关键性质：**相同的 key 哈希值相同 → 一定落到同一片**。于是每一片可以**独立**统计（同一个词的所有出现都在这片里，不会分散），且每片小到能进内存。',
    metric: 'hash(key)%N 分 N 片，同 key 同片',
    add: [{ id: 'shard', label: '哈希分片', role: 'hash%N，同key同片' }],
  },
  {
    stage: '④ 分片内统计 + 小顶堆', focus: '每片哈希计数，堆求本片 Top-K',
    detail: '每片装进内存后：哈希表统计词频，再用一个**大小为 K 的小顶堆**求本片 Top-K——堆顶是当前第 K 大，新词频比堆顶大就替换堆顶、下沉。求 Top-K 用小顶堆是 **O(n㏒K)**，比全排序 O(n㏒n) 省。',
    metric: '每片哈希计数 + 大小 K 小顶堆(O(n㏒K))',
    add: [{ id: 'count', label: '分片计数', role: '哈希表词频' }, { id: 'heap', label: '小顶堆 K', role: '本片 Top-K' }],
  },
  {
    stage: '⑤ 归并', focus: '各片 Top-K 再归并成全局 Top-K',
    detail: '每片得到本片 Top-K 后，把 N 片的 Top-K（共 N×K 个候选）**归并**，再求一次全局 Top-K（多路归并 / 再用一个小顶堆）。因为全局 Top-K 一定在"某片的 Top-K"里（某 key 的总频=它在所在片的频，不跨片），所以归并各片 Top-K 就够。',
    metric: 'N×K 候选归并 → 全局 Top-K',
    add: [{ id: 'merge', label: '归并', role: '各片TopK→全局' }],
  },
]

export const topkKernel: Kernel<SysDesignState> = {
  kind: 'topk',
  compile(_doc: SimDocument): CompiledModel<SysDesignState> {
    const frames: Frame[] = []
    const components: Comp[] = []
    for (const s of STAGES) {
      if (s.add) components.push(...s.add)
      frames.push({
        step: frames.length, stage: s.stage, focus: s.focus, detail: s.detail, metric: s.metric,
        components: components.map(c => ({ ...c })), phase: 'run',
        log: `**${s.stage}：${s.focus}**\n${s.detail}\n关键：${s.metric}`,
      })
    }
    frames.push({
      step: frames.length, stage: '⑥ 权衡总结', focus: '一句话讲清取舍', detail: '',
      metric: '分片(同key同片) + 分片内堆(O(n㏒K)) + 归并',
      components: components.map(c => ({ ...c })), phase: 'done',
      log: `**设计完成**：海量 Top-K 三板斧——**哈希分片**(同 key 同片、各片独立、能进内存)、**分片内小顶堆**(O(n㏒K) 求本片 Top-K)、**归并**(各片 Top-K → 全局 Top-K)。面试加分点：为什么用哈希分片而不是随机切(随机切同一个 key 会散到多片、没法独立统计)、为什么求 Top-K 用小顶堆而不是全排序(O(n㏒K) < O(n㏒n))、精确 vs 近似(内存再紧可用 Count-Min Sketch 近似计数、省内存但有误差)、单机分片 vs MapReduce 分布式(map 分片、reduce 归并，同一套思路)。这套也用在热搜榜、TopN 商品、高频 IP 封禁。`,
    })
    const base0: Frame = { step: -1, stage: '', focus: '', detail: '', metric: '', components: [], phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '设计步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
