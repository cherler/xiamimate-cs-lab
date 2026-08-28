/**
 * 内核：三种 JOIN 算法对比 —— 同样两表连接，优化器为什么选不同算法（后端 · 数据库系统）
 * 轴：step —— 同一对表 Users⋈Orders，依次走嵌套循环 / 哈希 / 排序归并，比代价
 *
 * SQL 里一个 JOIN，数据库优化器会在几种物理算法里挑最省的：
 *   · Nested Loop Join(NLJ)：外表每行 × 内表每行逐一比。无需预处理，但代价 O(N×M)，表一大就爆。
 *   · Hash Join：对小表建哈希表(build)，用大表逐行探测(probe)。O(N+M)，等值连接的主力。
 *   · Sort-Merge Join(SMJ)：两表各自排序，再双指针归并。O(N㏒N+M㏒M) 排序 + O(N+M) 归并；
 *      若输入已排序、或需要有序输出，最划算。
 * 本例 Users.id=[1,2,3]、Orders.uid=[2,2,3,5]，连接键相等 → 3 个匹配行。
 *   NLJ 比较 3×4=12 次；Hash 建 3+探 4=7 次；SMJ 归并 3+4=7 步(两表已排序)。
 * 值:匹配行与各算法代价都由数据算出、可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Algo = 'none' | 'nlj' | 'hash' | 'smj'
export type JoinState = {
  i: number
  step: number
  algo: Algo
  op: 'intro' | 'nlj' | 'build' | 'probe' | 'sort' | 'merge' | 'compare'
  users: number[]
  orders: number[]
  hash: number[]           // 哈希表里的键（build 后）
  matches: [number, number][]
  cost: number             // 本算法的代价数
  costs: { nlj: number; hash: number; smj: number }  // compare 步填满
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<JoinState, 'i'>

const U = [1, 2, 3]
const O = [2, 2, 3, 5]
const MATCHES: [number, number][] = []
for (const u of U) for (const o of O) if (u === o) MATCHES.push([u, o])
const COST = { nlj: U.length * O.length, hash: U.length + O.length, smj: U.length + O.length }

export const joinsKernel: Kernel<JoinState> = {
  kind: 'joins',
  compile(_doc: SimDocument): CompiledModel<JoinState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'users' | 'orders'>) => frames.push({ step: frames.length, users: [...U], orders: [...O], ...f })
    const noCost = { nlj: 0, hash: 0, smj: 0 }
    const ms = (n: number) => MATCHES.slice(0, n)

    push({ algo: 'none', op: 'intro', hash: [], matches: [], cost: 0, costs: noCost, phase: 'run', focus: '同一个 JOIN，三种物理算法，代价不同',
      log: `**一个 JOIN，优化器怎么选算法？**\nUsers.id = ${JSON.stringify(U)}，Orders.uid = ${JSON.stringify(O)}，连接条件 id = uid。\n结果应有 **${MATCHES.length}** 个匹配行：(2,2)、(2,2)、(3,3)。\n同样的结果，三种算法（嵌套循环 / 哈希 / 排序归并）代价差很多。逐个看。` })

    // NLJ
    push({ algo: 'nlj', op: 'nlj', hash: [], matches: MATCHES, cost: COST.nlj, costs: noCost, phase: 'run', focus: 'Nested Loop：外表每行 × 内表每行',
      log: `**① 嵌套循环 Nested Loop Join**\n外表 Users 每一行，都去内表 Orders 从头扫一遍比一次：\n比较次数 = |Users| × |Orders| = 3 × 4 = **${COST.nlj}** 次。\n找到 ${MATCHES.length} 个匹配。**优点**：不用任何预处理、任何连接条件都能用；**缺点**：O(N×M)，表一大就爆炸（10万×10万=百亿次）。` })

    // Hash build
    push({ algo: 'hash', op: 'build', hash: [...U], matches: [], cost: U.length, costs: noCost, phase: 'run', focus: 'Hash Join · build：对小表 Users 建哈希表',
      log: `**② 哈希连接 · build 阶段**\n对**较小的表** Users 建哈希表：把 id ${JSON.stringify(U)} 逐个 hash 进桶（${U.length} 次）。\n哈希表 = {1,2,3}。` })
    // Hash probe
    push({ algo: 'hash', op: 'probe', hash: [...U], matches: MATCHES, cost: COST.hash, costs: noCost, phase: 'run', focus: 'Hash Join · probe：大表逐行探测哈希表',
      log: `**② 哈希连接 · probe 阶段**\n用 Orders 每行的 uid 去哈希表**探测**（O(1) 查找，${O.length} 次）：\nuid=2→命中、uid=2→命中、uid=3→命中、uid=5→未命中。\n总代价 = 建 3 + 探 4 = **${COST.hash}** 次，O(N+M)。**等值连接(=)的主力算法**；缺点：只支持等值、要额外内存放哈希表。` })

    // SMJ sort
    push({ algo: 'smj', op: 'sort', hash: [], matches: [], cost: 0, costs: noCost, phase: 'run', focus: 'Sort-Merge · 排序：两表各自按连接键排好',
      log: `**③ 排序归并 Sort-Merge Join · 排序**\n两表先各自按连接键排序：Users ${JSON.stringify(U)}（已序）、Orders ${JSON.stringify(O)}（已序）。\n若本来无序，这一步要付 O(N㏒N) 排序代价。` })
    // SMJ merge
    push({ algo: 'smj', op: 'merge', hash: [], matches: MATCHES, cost: COST.smj, costs: noCost, phase: 'run', focus: 'Sort-Merge · 归并：双指针一遍扫过',
      log: `**③ 排序归并 · 归并**\n两个指针分别指着两表，谁小谁前进、相等就匹配——像拉链一样一遍扫过：\n归并代价 = |Users| + |Orders| = **${COST.smj}** 步。\n**优点**：适合输入已排序、或需要有序输出、或范围连接(>、<)；排序开销是它的门槛。` })

    // compare
    push({ algo: 'none', op: 'compare', hash: [], matches: MATCHES, cost: 0, costs: COST, phase: 'done', focus: '代价对比：优化器按数据规模和是否有序来选',
      log: `**三种算法代价对比**（本例小表，都很快；看趋势）\n· Nested Loop：**${COST.nlj}** 次比较 —— O(N×M)，只在表很小、或有索引时才划算。\n· Hash Join：**${COST.hash}** 次 —— O(N+M)，**大表等值连接首选**，但只支持 =、吃内存。\n· Sort-Merge：排序 + **${COST.smj}** 步归并 —— 输入已排序 / 要有序输出 / 范围连接时最好。\n\n**优化器**（如 MySQL/PG 的 EXPLAIN）就是根据表大小、有没有索引、连接类型（等值 vs 范围）、要不要有序，估算代价挑一个。懂这三种算法，就能看懂执行计划里为什么是 Hash Join 还是 Nested Loop——这也是 SQL 调优的基本功。` })

    const base0: Frame = { algo: 'none', op: 'intro', step: -1, users: [...U], orders: [...O], hash: [], matches: [], cost: 0, costs: noCost, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'JOIN 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
