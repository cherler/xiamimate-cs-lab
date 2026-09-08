/**
 * 内核：PageRank 网页排名（机器学习算法 · 原理：重要性顺着链接流动,被重要页面链到的页面也重要)
 * 轴：step —— 每个网页一个 rank(重要性分),幂迭代:每一轮,每个页面把自己的 rank 平分给它链出的页面;
 *      收到越多、来源越重要,分就越高。反复迭代直到稳定。Google 起家的算法,本质是图上的随机游走稳态。
 *
 * 网页海量,怎么排"哪个更重要"?PageRank 的洞见:**一个页面的重要性,取决于有多少、以及多重要的页面链接到它**——
 * 重要页面的"投票"更值钱。数学上是**幂迭代**:每个页面把自己当前的 rank **平分**给它链出去的页面(链接=投票);
 * 每个页面的新 rank = 各方投来的分之和,再混入一点"随机跳转"(阻尼 d=0.85,防止陷进死循环)。反复迭代,rank 收敛到稳定值。
 * 它等价于一个"随机上网者"无穷点击后停在各页的概率——图上随机游走的稳态分布。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本一张写死的图、d 写死 0.85、必然收敛得漂漂亮亮。幂迭代是演到了，
 * 但它把 PageRank 讲成了"一个会收敛的公式"，而这个算法真正的分量在于**它要防住两件事**：
 *
 *   · **悬挂节点（dangling node）** —— 有出链的页面把 rank 传出去，
 *     可**没有出链**的页面（下载页、PDF、死胡同）收了 rank 就**再也不往外给**。
 *     不处理的话，整个图的 rank 总和会**一路漏掉**：实测 d=1 时六轮就从 1 漏到 0.4 出头。
 *     标准解法是把悬挂节点的 rank **均分给所有页**（相当于随机上网者在死胡同里随机跳走）。
 *   · **蜘蛛陷阱（spider trap）** —— 一撮页面只互相链（这里用一个自环 C→C），
 *     随机游走一旦走进去就出不来，**rank 全被它吸干**。
 *
 * **阻尼系数 d 就是同时为这两件事存在的**：1−d 的概率随机跳到任意页面 —— 走进陷阱能跳出来。
 * 老版本把 d 写死成 0.85，于是"为什么要有 d"这个问题根本没机会出现。
 * 现在 d 是旋钮，把它拧到 1（不跳转）就能亲眼看见陷阱把 rank 吃光。
 *
 * 屏幕上因此多了一个**总和 Σrank**：正常时它恒等于 1，漏了就是漏了 —— 少了这一栏，
 * 悬挂节点漏 rank 这件事**从数字上完全看不出来**（各页 rank 都在变小，看着像"还没收敛"）。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Pt = { x: number; y: number }
const NODES = ['A', 'B', 'C', 'D']
const POS: Pt[] = [{ x: 0.28, y: 0.26 }, { x: 0.76, y: 0.26 }, { x: 0.52, y: 0.8 }, { x: 0.12, y: 0.72 }]

/*  三张图：
    · 正常 —— 老版本那张，每页都有出链
    · 悬挂节点 —— D 的出链全砍掉（死胡同），rank 进去就出不来
    · 蜘蛛陷阱 —— C 只链自己（自环），随机游走走进去就再也出不来 */
const GRAPHS: Record<string, Record<string, string[]>> = {
  '正常': { A: ['B', 'C'], B: ['C'], C: ['A'], D: ['A', 'C'] },
  '有悬挂节点（D 不链出去）': { A: ['B', 'C'], B: ['C'], C: ['A'], D: [] },
  '有蜘蛛陷阱（C 只链自己）': { A: ['B', 'C'], B: ['C'], C: ['C'], D: ['A', 'C'] },
}
const N = 4, ITERS = 8
const r3 = (x: number) => Math.round(x * 1000) / 1000


export type PageRankState = {
  i: number
  step: number
  pos: Pt[]
  edges: [number, number][]
  nodes: string[]
  rank: number[]               // 当前各页 rank
  prev: number[]               // 上一轮
  iter: number
  d: number
  ranked: { name: string; r: number }[]
  //  ── 补厚 ──
  total: number              // Σrank —— 正常恒为 1；漏了就是漏了
  graphTag: string
  fixDangling: boolean
  danglers: string[]         // 没有出链的页面
  trapped: string[]          // 只链自己的页面
  leaked: boolean            // 总和明显掉出 1
  absorbed: number           // 陷阱那几页吃掉的 rank 占比
  phase: 'run' | 'done'
  log: string
}

export const PAGERANK_VISIBLE = ['step', 'pos', 'edges', 'nodes', 'rank', 'prev', 'iter', 'd', 'ranked',
  'total', 'graphTag', 'fixDangling', 'danglers', 'trapped', 'leaked', 'absorbed', 'phase', 'log'] as const
type Frame = Omit<PageRankState, 'i'>

export const pagerankKernel: Kernel<PageRankState> = {
  kind: 'pagerank',
  compile(doc: SimDocument): CompiledModel<PageRankState> {
    const graphTag = doc.params.graph === undefined ? '正常' : str(doc.params, 'graph')
    const D = (doc.params.d === undefined ? 85 : num(doc.params, 'd')) / 100
    const fixDangling = (doc.params.fix === undefined ? '不处理' : str(doc.params, 'fix')).startsWith('均分')
    const OUT = GRAPHS[graphTag] ?? GRAPHS['正常']

    const EDGES: [number, number][] = []
    for (const u in OUT) for (const v of OUT[u]) EDGES.push([NODES.indexOf(u), NODES.indexOf(v)])
    const inl: Record<string, string[]> = {}
    NODES.forEach(n => (inl[n] = []))
    for (const u in OUT) for (const v of OUT[u]) inl[v].push(u)

    const danglers = NODES.filter(n => OUT[n].length === 0)
    const trapped = NODES.filter(n => OUT[n].length > 0 && OUT[n].every(v => v === n))

    /*  ⚠️ **rank 内部不舍入，只在显示时舍入。**
        原来每轮算完就 r3 到三位，四个数再加起来，累积误差让"总和"显示成 1.003 ——
        而这一屏恰恰要拿"总和恒等于 1"当判据（悬挂节点漏 rank 全靠它才看得出来）。
        算的时候留全精度，摆到屏幕上再舍入。 */
    const frames: Frame[] = []
    let r = NODES.map(() => 1 / N)
    const sorted = (arr: number[]) => NODES.map((n, i2) => ({ name: n, r: r3(arr[i2]) })).sort((a, b) => b.r - a.r)
    const sum = (arr: number[]) => r3(arr.reduce((a, x) => a + x, 0))
    const show = (arr: number[]) => arr.map(r3)
    const absorbedOf = (arr: number[]) => {
      const t = sum(arr)
      return t > 0 ? r3(trapped.reduce((a, n) => a + arr[NODES.indexOf(n)], 0) / t) : 0
    }
    const common = { pos: POS, edges: EDGES, nodes: NODES, d: D, graphTag, fixDangling, danglers, trapped }

    frames.push({
      step: 0, ...common, rank: show(r), prev: show(r), iter: 0, ranked: sorted(r),
      total: sum(r), leaked: false, absorbed: absorbedOf(r), phase: 'run',
      log: `4 个网页 A/B/C/D（箭头=链接=投票）。初始：每页 rank = 1/4 = **0.25**，总和 **1**。`
        + `PageRank：重要性顺着链接流动，被重要页面链到的也重要。`
        + (danglers.length ? `　⚠️ 这一档里 **${danglers.join('、')} 没有任何出链**（死胡同）——盯住总和会怎样。` : '')
        + (trapped.length ? `　⚠️ 这一档里 **${trapped.join('、')} 只链自己**（蜘蛛陷阱）——盯住它会吃掉多少。` : ''),
    })

    for (let it = 1; it <= ITERS; it++) {
      const prev = r.slice()
      /*  悬挂节点的 rank 无处可去。
          · 不处理 → 它那份就**凭空消失**，总和一路漏。
          · 均分修复 → 摊给所有页（= 随机上网者在死胡同里随机跳走），总和守恒。 */
      const dangSum = danglers.reduce((a, n) => a + prev[NODES.indexOf(n)], 0)
      const spill = fixDangling ? dangSum / N : 0
      const nr = NODES.map(n => {
        let s2 = 0
        for (const u of inl[n]) s2 += prev[NODES.indexOf(u)] / OUT[u].length
        return (1 - D) / N + D * (s2 + spill)
      })
      r = nr
      const total = sum(r)
      frames.push({
        step: frames.length, ...common, rank: show(r), prev: show(prev), iter: it, ranked: sorted(r),
        total, leaked: total < 0.98, absorbed: absorbedOf(r), phase: 'run',
        log: `第 ${it} 轮：每页把上一轮的 rank **平分**给它链出的页面，收方求和，再混入随机跳转（×${D}）。`
          + `→ ${NODES.map((n, k) => `${n}=${r3(r[k])}`).join('、')}，**总和 ${total}**。`
          + (danglers.length && !fixDangling && total < 0.98
            ? `　⚠️ 总和在往下掉 —— **${danglers.join('、')} 收了 rank 却不往外给，那一份凭空消失了**。`
            : '')
          + (trapped.length && absorbedOf(r) > 0.5
            ? `　⚠️ **${trapped.join('、')} 已经吃掉 ${(absorbedOf(r) * 100).toFixed(0)}% 的 rank**。` : ''),
      })
    }

    const fin = sorted(r)
    const total = sum(r)
    const absorbed = absorbedOf(r)
    frames.push({
      step: frames.length, ...common, rank: show(r), prev: show(r), iter: ITERS, ranked: fin,
      total, leaked: total < 0.98, absorbed, phase: 'done',
      log: `排名 ${fin.map(x => `${x.name}(${x.r})`).join(' > ')}，**总和 ${total}**。`
        + (danglers.length && !fixDangling
          ? `　⚠️ **总和不是 1，是 ${total}** —— ${danglers.join('、')} 没有出链，收到的 rank **有进无出**，`
            + `每一轮都漏掉一部分。${D >= 1 ? '而 d=1 时连随机跳转都没有，漏得最狠。' : ''}`
            + `　这就是**悬挂节点**：网上到处都是（PDF、下载页、死胡同）。`
            + `标准解法是把它的 rank **均分给所有页**（等于随机上网者在死胡同里随机跳走）——`
            + `把「悬挂节点」拨到"均分给所有页"再看，总和立刻回到 1。`
          : trapped.length
            ? `　⚠️ **${trapped.join('、')} 只链自己**（蜘蛛陷阱），它吃掉了 **${(absorbed * 100).toFixed(0)}%** 的 rank。`
              + (D >= 1
                ? `　d=1 意味着**完全不随机跳转**，随机上网者一旦点进陷阱就**永远出不来** —— 所以它把 rank 几乎全吸干了。`
                  + `　把 d 调到 0.85 再看：1−d 的概率跳走，陷阱就吸不干净了。`
                  + `**这就是阻尼系数存在的理由**，不是随手加的一个超参。`
                : `　d=${D} 时有 ${((1 - D) * 100).toFixed(0)}% 的概率随机跳走，陷阱吸不干净。`
                  + `把 d 拧到 1（不跳转）再看 —— 它会吃掉 ${(() => {
                    let rr = NODES.map(() => 1 / N)
                    for (let k = 0; k < ITERS; k++) {
                      const pv = rr.slice()
                      rr = NODES.map(n => { let a = 0; for (const u of inl[n]) a += pv[NODES.indexOf(u)] / OUT[u].length; return a })
                    }
                    const t2 = rr.reduce((a, x) => a + x, 0)
                    return t2 > 0 ? Math.round(trapped.reduce((a, n) => a + rr[NODES.indexOf(n)], 0) / t2 * 100) : 0
                  })()}%。`)
            : `　**${fin[0].name} 最高** —— 链到它的页面多、且来源本身重要；${fin[fin.length - 1].name} 最低。`
              + `总和恒等于 1（每一轮 rank 只是重新分配，不增不减）。`
              + `　PageRank = 重要性顺链接流动的**幂迭代**，等价于"随机上网者"无穷点击后停在各页的概率。`
              + `　⚠️ 但真实网页图有两个坑，这一档都碰不到：把「网页图」换成**有悬挂节点**或**有蜘蛛陷阱**看看。`),
    })

    const base0: Frame = {
      step: -1, ...common, rank: NODES.map(() => 1 / N), prev: NODES.map(() => 1 / N), iter: 0,
      ranked: sorted(NODES.map(() => 1 / N)), total: 1, leaked: false, absorbed: 0, phase: 'run', log: '',
    }
    return {
      axis: { kind: 'step', label: '迭代' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
