/**
 * 出题目录分片：经典数据结构与算法（14 个实验）。
 *
 * 收录：AVL 平衡树 / 布隆过滤器 / 二叉树遍历 / 编辑距离 / 栈与表达式求值 /
 *       贪心找零 / 散列表 / KMP / 最小生成树 / 排序逐趟 / 拓扑与关键路径 /
 *       图的遍历 / A star 寻路（astar）/ 二叉堆。
 *
 * 焊死纪律（见 catalog-shared.ts）：
 *   1. 每个 fact 的 compute 只从引擎 trace 真算，绝不硬编码答案。
 *   2. 每条 doc 与 web/src/registry.ts 里该实验的 defaultDoc 逐字一致 ——
 *      引用了预置常量的（AVL/HASH/BTREE/MST/AOE/TRAV）从同一模块 import，
 *      保证出题答案 == 用户屏幕所见。
 */
import { avlKernel } from '../../src/kernels/avl.ts'
import { bloomKernel } from '../../src/kernels/bloom.ts'
import { btreeKernel } from '../../src/kernels/btree.ts'
import { editdistKernel } from '../../src/kernels/editdist.ts'
import { exprKernel } from '../../src/kernels/expr.ts'
import { greedyKernel } from '../../src/kernels/greedy.ts'
import { hashKernel } from '../../src/kernels/hashtable.ts'
import { kmpKernel } from '../../src/kernels/kmp.ts'
import { mstKernel } from '../../src/kernels/mst.ts'
import { sortKernel } from '../../src/kernels/sort.ts'
import { topoKernel } from '../../src/kernels/topo.ts'
import { traverseKernel } from '../../src/kernels/traverse.ts'
import { astarKernel } from '../../src/kernels/astar.ts'
import { heapKernel } from '../../src/kernels/heap.ts'
import { AVL_PRESETS, HASH_PRESETS, BTREE_PRESETS } from '../../src/presets/sequences.ts'
import { MST_PRESETS, AOE_PRESETS, TRAV_PRESETS } from '../../src/presets/entities.ts'
import { numDistractors, last, type CatalogEntry, type Kernel } from '../catalog-shared.ts'

export const DS_CLASSIC_ENTRIES: CatalogEntry[] = [
  // ── AVL 平衡二叉树（doc: AVL_PRESETS[3] = 连环失衡 [10,20,30,40,50,25]）──
  {
    id: 'avl',
    title: 'AVL 平衡二叉树',
    kernel: avlKernel as Kernel<unknown>,
    doc: {
      kind: 'avl', params: { mode: 'avl' }, entities: [],
      streams: [{ name: 'keys', values: AVL_PRESETS[3].values }],
    },
    facts: [
      {
        id: 'rotations', label: '插入全部键后累计的旋转次数',
        ask: '把这串键依次插入 AVL 树，为维持平衡一共做了多少次旋转?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).rotations), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'inserted', label: '成功插入的键个数',
        ask: 'AVL 不存重复键，这串键最终成功插入了几个?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).inserted), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'first_rotation', label: '第一次触发的旋转类型',
        ask: '插入过程中，第一次失衡触发的是哪一种旋转(LL / RR / LR / RL)?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.act === 'rotate')!
          return { answer: String(f.rotation), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: answer => ['LL', 'RR', 'LR', 'RL'].filter(x => x !== answer),
      },
    ],
  },

  // ── 布隆过滤器（内核自带 m=24/k=3，插 cat/dog/sun，查 cat/fox/owl/sun）──
  {
    id: 'bloom',
    title: '布隆过滤器',
    kernel: bloomKernel as Kernel<unknown>,
    doc: { kind: 'bloom', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'set_bits', label: '插入后 bit 数组里被置 1 的位数',
        ask: '插入 cat、dog、sun 后，24 位的 bit 数组里一共有多少位被置成 1?',
        kind: 'number',
        compute: t => {
          const bits = last(t).bits as number[]
          const n = bits.reduce((a, b) => a + b, 0)
          return { answer: String(n), step: t.length - 1, evidence: `bit 数组 = [${bits.join('')}]` }
        },
        distractors: numDistractors,
      },
      {
        id: 'false_positives', label: '查询阶段出现的假阳性次数',
        ask: '查询这一串词时，一共出现了几次「假阳性」(没插过却被判可能在)?',
        kind: 'number',
        compute: t => {
          const n = t.filter(f => f.op === 'query' && f.falsePositive === true).length
          return { answer: String(n), step: t.length - 1, evidence: String(last(t).log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'fp_word', label: '造成假阳性的查询词',
        ask: '哪个查询词是「假阳性」—— 根本没插入过，却因撞位被判成「可能在」?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.falsePositive === true)!
          return { answer: String(f.word), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: (answer, t) => {
          const words = [...new Set(t.filter(f => f.op === 'query').map(f => String(f.word)))]
          return words.filter(x => x !== answer).slice(0, 3)
        },
      },
    ],
  },

  // ── 二叉树遍历（doc: BTREE_PRESETS[0] = 满二叉树 [50,30,70,20,40,60,80]，前序）──
  {
    id: 'btree',
    title: '二叉树遍历',
    kernel: btreeKernel as Kernel<unknown>,
    doc: {
      kind: 'btree', params: { order: '前序' }, entities: [],
      streams: [{ name: 'keys', values: BTREE_PRESETS[0].values }],
    },
    facts: [
      {
        id: 'node_count', label: '前序遍历输出的结点个数',
        ask: '对这棵二叉搜索树做前序遍历，一共输出多少个结点?',
        kind: 'number',
        compute: t => {
          const vis = last(t).visited as number[]
          return { answer: String(vis.length), step: t.length - 1, evidence: String(last(t).log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'first_node', label: '前序遍历第一个输出的结点键',
        ask: '前序遍历(根 → 左 → 右)时，第一个被输出的结点键是多少?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.act === 'visit')!
          const nodes = f.nodes as { key: number }[]
          return { answer: String(nodes[f.cur as number].key), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: (answer, t) => {
          const nodes = last(t).nodes as { key: number }[]
          return nodes.map(n => String(n.key)).filter(x => x !== answer).slice(0, 3)
        },
      },
      {
        id: 'last_node', label: '前序遍历最后一个输出的结点键',
        ask: '前序遍历这棵树，最后一个被输出的结点键是多少?',
        kind: 'choice',
        compute: t => {
          const vis = t.filter(x => x.act === 'visit')
          const f = vis[vis.length - 1]
          const nodes = f.nodes as { key: number }[]
          return { answer: String(nodes[f.cur as number].key), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: (answer, t) => {
          const nodes = last(t).nodes as { key: number }[]
          return nodes.map(n => String(n.key)).filter(x => x !== answer).slice(0, 3)
        },
      },
    ],
  },

  // ── 动态规划 · 编辑距离（内核固定 a="horse" → b="ros"）──
  {
    id: 'editdist',
    title: '动态规划·编辑距离',
    kernel: editdistKernel as Kernel<unknown>,
    doc: { kind: 'editdist', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'distance', label: 'horse 改成 ros 的编辑距离',
        ask: '用 DP 填表，把 horse 改成 ros 的最少编辑距离(右下角)是多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).val), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'cells', label: '需要填的 DP 内部格子数',
        ask: '不算首行首列的边界，这张编辑距离表要填多少个格子(|a|×|b|)?',
        kind: 'number',
        compute: t => {
          const f = last(t)
          const n = (f.a as string).length * (f.b as string).length
          return { answer: String(n), step: t.length - 1, evidence: `a="${f.a}"(${(f.a as string).length}) × b="${f.b}"(${(f.b as string).length})` }
        },
        distractors: numDistractors,
      },
      {
        id: 'match_rule', label: '字符相同时 dp 取哪个邻居',
        ask: '填表时若当前两个字符相同，这一格的 dp 值直接等于哪个邻居(不 +1)?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.match === true)!
          return { answer: '左上(dp[i−1][j−1])', step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: () => ['上(dp[i−1][j])', '左(dp[i][j−1])', '三个邻居里最小的再 +1'],
      },
    ],
  },

  // ── 栈与表达式求值（内核固定中缀 3+4*2-1）──
  {
    id: 'expr',
    title: '栈与表达式求值',
    kernel: exprKernel as Kernel<unknown>,
    doc: { kind: 'expr', params: { expr: '3+4*2-1' }, entities: [], streams: [] },
    facts: [
      {
        id: 'result', label: '表达式求值结果',
        ask: '中缀表达式 3+4*2-1 转后缀再求值，最终结果是多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).result), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'ops_applied', label: '后缀求值阶段的运算次数',
        ask: '后缀求值阶段一共做了几次「弹两个数、算完压回」的运算?',
        kind: 'number',
        compute: t => {
          const n = t.filter(f => f.act === 'apply').length
          return { answer: String(n), step: t.length - 1, evidence: String(last(t).log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'first_apply', label: '后缀求值第一个被计算的运算符',
        ask: '按后缀式求值时，第一个被真正计算的运算符是哪一个?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.act === 'apply')!
          const rpn = f.rpn as string[]
          return { answer: String(rpn[f.at as number]), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: answer => ['+', '-', '*', '/'].filter(x => x !== answer),
      },
    ],
  },

  // ── 贪心算法（内核固定：币值 {4,3,1} 凑 6，对照 DP 最优）──
  {
    id: 'greedy',
    title: '贪心算法',
    kernel: greedyKernel as Kernel<unknown>,
    doc: { kind: 'greedy', params: {}, entities: [], streams: [] },
    facts: [
      {
        id: 'greedy_count', label: '贪心找零用的硬币枚数',
        ask: '用「每步拿当下最大币」的贪心法凑 6，一共用了几枚硬币?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).greedyCount), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'optimal_count', label: 'DP 求出的最优枚数',
        ask: '同样凑 6，动态规划求出的全局最少枚数是多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).optimal), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'first_coin', label: '贪心第一步拿的币值',
        ask: '贪心找零的第一步，拿走的是面值多少的硬币?',
        kind: 'choice',
        compute: t => ({ answer: String(t[0]!.pick), step: 0, evidence: String(t[0]!.log ?? '') }),
        distractors: (answer, t) => (t[0]!.coins as number[]).map(String).filter(x => x !== answer),
      },
    ],
  },

  // ── 散列表（doc: HASH_PRESETS[0] 教材经典，表长 13，线性探测，再散列步长 3）──
  {
    id: 'hash',
    title: '散列表',
    kernel: hashKernel as Kernel<unknown>,
    doc: {
      kind: 'hash', params: { size: 13, method: '线性探测', rehashStep: 3 }, entities: [],
      streams: [{ name: 'keys', values: HASH_PRESETS[0].values }],
    },
    facts: [
      {
        id: 'total_compares', label: '全部键插入的累计探查次数',
        ask: '这组键全部用线性探测插入完，累计探查(比较)了多少次?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).totalCompares), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'collisions', label: '插入时发生冲突的键个数',
        ask: '插入过程中，有多少个键在放入时发生了冲突(初始地址被占)?',
        kind: 'number',
        compute: t => {
          const n = t.filter(f => f.collided === true).length
          return { answer: String(n), step: t.length - 1, evidence: `共 ${t.length} 次插入` }
        },
        distractors: numDistractors,
      },
      {
        id: 'first_collision', label: '第一个发生冲突的键',
        ask: '按插入顺序，第一个发生冲突(初始地址已被占)的键是哪个?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.collided === true)!
          return { answer: String(f.key), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: (answer, t) => [...new Set(t.map(f => String(f.key)))].filter(x => x !== answer).slice(0, 3),
      },
    ],
  },

  // ── KMP 字符串匹配（内核固定 text=ababcabcabababd, pattern=ababd, showMatch=1）──
  {
    id: 'kmp',
    title: 'KMP 字符串匹配',
    kernel: kmpKernel as Kernel<unknown>,
    doc: {
      kind: 'kmp',
      params: { text: 'ababcabcabababd', pattern: 'ababd', showMatch: 1 },
      entities: [], streams: [],
    },
    facts: [
      {
        id: 'match_pos', label: '模式串第一次匹配的起点下标',
        ask: '模式串 ababd 在主串中第一次匹配成功，起点下标(从 0 开始)是多少?',
        kind: 'number',
        compute: t => {
          const found = last(t).found as number[]
          return { answer: String(found[0]), step: t.length - 1, evidence: String(last(t).log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'text_advances', label: '主串指针前进的总次数',
        ask: 'KMP 匹配全程主串指针一共前进了多少次(它永不回退)?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).textAdvances), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'next3', label: 'next 数组第 3 位的值',
        ask: '模式串 ababd 的 next 数组中，next[3] 等于多少(最长相等前后缀长度)?',
        kind: 'choice',
        compute: t => {
          const next = last(t).next as number[]
          return { answer: String(next[3]), step: t.length - 1, evidence: `next 数组 = [${next.join(', ')}]` }
        },
        distractors: numDistractors,
      },
    ],
  },

  // ── 最小生成树（doc: MST_PRESETS[0] 教材经典，Prim，起点 A，总权 15）──
  {
    id: 'mst',
    title: '最小生成树',
    kernel: mstKernel as Kernel<unknown>,
    doc: {
      kind: 'mst', params: { algorithm: 'Prim', start: 'A' },
      entities: MST_PRESETS[0].entities, streams: [],
    },
    facts: [
      {
        id: 'total_weight', label: '最小生成树的总权值',
        ask: '用 Prim 从 A 出发，求出的最小生成树总权值是多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).weight), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'edge_count', label: '生成树的边数',
        ask: 'n 个顶点的最小生成树恰好有几条边(这里选入了几条)?',
        kind: 'number',
        compute: t => {
          const chosen = last(t).chosen as string[]
          return { answer: String(chosen.length), step: t.length - 1, evidence: `选入的边：${chosen.join('、')}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'first_edge', label: 'Prim 选入的第一条边',
        ask: 'Prim 从 A 出发，第一条被选入生成树的边是哪一条?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.act === 'take')!
          return { answer: String(f.edge), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: (answer, t) => {
          const ids = [...new Set(t.map(f => String(f.edge)).filter(Boolean))]
          return ids.filter(x => x !== answer).slice(0, 3)
        },
      },
    ],
  },

  // ── 排序逐趟（doc: 快速排序，[49,38,65,97,76,13,27,49]）──
  {
    id: 'sort',
    title: '排序逐趟',
    kernel: sortKernel as Kernel<unknown>,
    doc: {
      kind: 'sort',
      params: { algorithm: '快速' },
      entities: [],
      streams: [{ name: 'array', values: [49, 38, 65, 97, 76, 13, 27, 49] }],
    },
    facts: [
      {
        id: 'comparisons', label: '快速排序全过程的比较次数',
        ask: '把这个数组快速排序完成，全过程一共比较了多少次?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).comparisons), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'moves', label: '快速排序全过程的移动次数',
        ask: '快速排序全过程一共发生了多少次元素移动(写入)?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).moves), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'first_pivot', label: '第一趟划分选的基准值',
        ask: '快速排序第一趟划分选定的基准值(取区间第一个元素)是多少?',
        kind: 'choice',
        compute: t => {
          const f = t.find(x => x.held !== null && x.held !== undefined)!
          return { answer: String(f.held), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: (answer, t) => [...new Set((t[0]!.arr as number[]).map(String))].filter(x => x !== answer).slice(0, 3),
      },
    ],
  },

  // ── 拓扑排序与关键路径（doc: AOE_PRESETS[0] 教材经典，operation=critical，总工期 10）──
  {
    id: 'topo',
    title: '拓扑排序与关键路径',
    kernel: topoKernel as Kernel<unknown>,
    doc: {
      kind: 'topo', params: { operation: 'critical' },
      entities: AOE_PRESETS[0].entities, streams: [],
    },
    facts: [
      {
        id: 'total_duration', label: '工程总工期',
        ask: '这张 AOE 网求出的工程总工期(汇点最早发生时间)是多少?',
        kind: 'number',
        compute: t => {
          const ve = last(t).ve as Record<string, number>
          const total = Math.max(...Object.values(ve))
          return { answer: String(total), step: t.length - 1, evidence: `各事件最早发生时间 ve = ${JSON.stringify(ve)}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'critical_count', label: '关键活动的条数',
        ask: '这张 AOE 网里，一共有几条关键活动(时间余量为 0)?',
        kind: 'number',
        compute: t => {
          const crit = last(t).critical as string[]
          return { answer: String(crit.length), step: t.length - 1, evidence: `关键活动：${crit.join('、')}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'first_topo', label: '拓扑序列第一个输出的顶点',
        ask: '拓扑排序时，第一个被输出的顶点(入度为 0)是哪个?',
        kind: 'choice',
        compute: t => {
          const order = last(t).order as string[]
          return { answer: String(order[0]), step: t.length - 1, evidence: `拓扑序列 ${order.join(' → ')}` }
        },
        distractors: (answer, t) => {
          const order = last(t).order as string[]
          return order.filter(x => x !== answer).slice(0, 3)
        },
      },
    ],
  },

  // ── 图的遍历（doc: TRAV_PRESETS[0] 含孤立顶点，DFS，起点 A）──
  {
    id: 'traverse',
    title: '图的遍历',
    kernel: traverseKernel as Kernel<unknown>,
    doc: {
      kind: 'traverse', params: { algorithm: 'DFS', start: 'A', directed: 0 },
      entities: TRAV_PRESETS[0].entities, streams: [],
    },
    facts: [
      {
        id: 'visited', label: 'DFS 访问到的顶点数',
        ask: '这张含孤立顶点的图，DFS 换起点走完后一共访问了几个顶点?',
        kind: 'number',
        compute: t => {
          const order = last(t).order as string[]
          return { answer: String(order.length), step: t.length - 1, evidence: `访问序列 ${order.join(' → ')}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'tree_edges', label: '生成树(森林)的边数',
        ask: 'DFS 走完后，得到的生成树(森林)一共有几条树边?',
        kind: 'number',
        compute: t => {
          const te = last(t).treeEdges as string[]
          return { answer: String(te.length), step: t.length - 1, evidence: String(last(t).log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'second_visit', label: 'DFS 第二个访问的顶点',
        ask: 'DFS 从 A 出发(邻接点按字典序)，第二个被访问的顶点是哪个?',
        kind: 'choice',
        compute: t => {
          const order = last(t).order as string[]
          return { answer: String(order[1]), step: t.length - 1, evidence: `访问序列 ${order.join(' → ')}` }
        },
        distractors: (answer, t) => {
          const order = last(t).order as string[]
          return order.filter(x => x !== answer).slice(0, 3)
        },
      },
    ],
  },

  // ── A star 寻路（astar）：内核固定 8×5 网格，一堵墙留缺口 ──
  {
    id: 'astar',
    title: 'A* 寻路',
    kernel: astarKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：默认档改成**沼泽 + w=5** —— 那是唯一真的会走冤枉路的组合。 */
    doc: { kind: 'astar', params: { map: '沼泽（穿过去贵、绕开便宜）', weight: 5, h: '曼哈顿（紧）' }, entities: [], streams: [] },
    facts: [
      {
        id: 'expanded', label: '一共展开的格子数', kind: 'number', genre: 'count',
        ask: '在 11×7 的沼泽地图上、启发权重 w=5 时，A star 找到终点之前一共展开(移入关闭集)了多少个格子?',
        compute: t => ({ answer: String(last(t).expanded), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        /*  补厚的落点：w=5 找到的路的代价，跟真正的最小代价**不一样**。 */
        id: 'cost_gap', label: '加权 A* 多花的代价', kind: 'number', genre: 'count',
        ask: '沼泽地图上把启发权重放大到 w=5：它找到的那条路的代价，比真正的最小代价多了多少?',
        compute: t => {
          const f = last(t)
          return { answer: String(+((f.pathLen as number) - (f.optimalLen as number)).toFixed(2)), step: t.length - 1,
            evidence: `这一趟代价 ${f.pathLen}，而反向 Dijkstra 算出的最小代价是 ${f.optimalLen}` }
        },
        distractors: numDistractors,
      },
      {
        id: 'w0_is_dijkstra', label: 'w=0 就是 Dijkstra', kind: 'choice', genre: 'concept',
        ask: 'A star 按 f = g + w·h 排序。把权重 w 调成 0 之后，它变成了什么算法?',
        compute: t => {
          const f = last(t)
          const sw = (f.sweep ?? []) as { w: number; expanded: number }[]
          const d = sw.find(x => x.w === 0), a = sw.find(x => x.w === 1)
          return {
            answer: '就是 Dijkstra —— 启发完全不起作用，只按已走代价排序，于是四面八方均匀铺开',
            step: t.length - 1,
            evidence: `实测：w=0 展开 ${d?.expanded}/${f.freeCells} 格，而 w=1 只要 ${a?.expanded} 格`,
          }
        },
        distractors: a => [a,
          '变成广度优先搜索 —— 因为没有启发之后，队列里的顺序就退回先进先出了',
          '变成贪心最好优先 —— 只剩已走代价这一项，算法会一路挑当前最省的那一步走',
          '还是 A star —— w 只影响搜索的快慢，不改变它按 f 排序展开的这套机制',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        id: 'overestimate', label: '高估了就一定走冤枉路吗', kind: 'choice', genre: 'concept',
        ask: '把启发放大到 w·h 之后，它在某些格子上高估了到终点的真实代价。这是不是意味着这一趟一定找不到最优路?',
        compute: t => {
          const f = last(t)
          const sw = (f.sweep ?? []) as { w: number; pathLen: number; optimal: boolean; admissible: boolean }[]
          const bad14 = sw.find(x => x.w === 1.4)
          return {
            answer: '不一定 —— 高估只是把"保证最优"这个承诺撤掉了，不等于结果一定错',
            step: t.length - 1,
            evidence: `实测：w=1.4 在同一张图上同样不可采纳（${bad14?.admissible ? '' : '有格子被高估'}），却${bad14?.optimal ? '照样找到了最优路' : '没找到'}；而 w=5 就真的走贵了`,
          }
        },
        distractors: a => [a,
          '一定找不到 —— 高估会让最优路上的某个点永远排在队列后面，算法必然错过它',
          '一定找不到 —— 可采纳性是最优性的充分必要条件，破坏了它结果就不可能是最优的',
          '一定能找到 —— 高估只影响展开顺序，最后回溯出来的路仍然是代价最小的那条',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },

  // ── 二叉堆 / 优先队列（内核固定 [3,9,2,1,7,5,8] 建堆再取一次堆顶）──
  {
    id: 'heap',
    title: '二叉堆 / 优先队列',
    kernel: heapKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：默认档改成**逐个插入 + 升序** —— 那是它最惨的一档，
        而"建堆 O(n)"这句话没有第二种建法可比就等于没讲。 */
    doc: { kind: 'heap', params: { data: '已经排好序', build: '逐个插入 sift-up', after: '只建堆' }, entities: [], streams: [] },
    facts: [
      {
        id: 'build_compares', label: '建堆阶段的比较次数', kind: 'number', genre: 'count',
        ask: '12 个已经升序排好的数，用"逐个插入 sift-up"的办法建最大堆，建堆阶段一共比较了多少次?',
        compute: t => {
          const f = last(t)
          return { answer: String(f.buildCompares), step: t.length - 1,
            evidence: `交换 ${f.buildSwaps} 次；换成自底向上（Floyd）只要更少` }
        },
        distractors: numDistractors,
      },
      {
        /*  ⚠️「堆不是排好序的」补丁包里已有（heap/why_not_sorted），
            判据按答案的字面相似度（0.47）抓了出来 —— 抽到两条就是同一道题问两遍。
            换成这个实验独有的一条：**建法的选择在哪种输入上才真的要紧**。 */
        id: 'worst_input_for_insert', label: '逐个插入最惨的是哪种输入', kind: 'choice', genre: 'concept',
        ask: '用"逐个插入 sift-up"建最大堆。哪一种输入会让它做最多的比较?',
        compute: t => ({
          answer: '升序输入 —— 每个新进来的元素都是当前最大，必须一路上浮到根，每次都走满一整条路径',
          step: t.length - 1,
          evidence: '实测 n=512：升序 3595 次、随机 1125 次、完全逆序只要 511 次（降序输入本来就是个最大堆，一次都不用浮）',
        }),
        distractors: a => [a,
          '完全逆序 —— 每个新元素都比已有的都小，得一路下沉到最底层才停',
          '随机打乱 —— 元素位置毫无规律，平均下来上浮的距离最长',
          '大量重复 —— 相等元素无法判断该不该继续上浮，只能一直比到根',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⚠️「建堆为什么是 O(n)」那一条补丁包里已经有了（heap/build_on），
            判据当场按 实验/事实 的组合键抓出重名。换成这个实验**独有**的一条：
            两种建法差多少，**取决于数据形状** —— 这件事只有把三档数据都扫过才知道。 */
        id: 'gap_depends_on_data', label: '两种建法差多少取决于数据形状', kind: 'choice', genre: 'concept',
        ask: '自底向上建堆是 O(n)、逐个插入是 O(n log n)。那么在实际数据上，后者一定慢很多吗?',
        compute: t => ({
          answer: '不一定 —— 差多少取决于数据形状：升序输入时差好几倍，随机时只差一点点，而完全逆序时两者一模一样',
          step: t.length - 1,
          evidence: '实测 n=512：升序 1006 vs 3595（差 3.6 倍）、随机 953 vs 1125（差 1.18 倍）、完全逆序 511 vs 511（降序输入本来就是个最大堆，插入一次都不用上浮）',
        }),
        distractors: a => [a,
          '一定慢很多 —— 渐进复杂度差了一个 log n，规模一大差距就会稳定地拉开',
          '一定一样快 —— 两者的比较次数只差常数因子，渐进上的 log n 在实践中量不出来',
          '取决于元素类型 —— 比较代价大的对象上差距明显，比较整数时两者几乎相同',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },
]
