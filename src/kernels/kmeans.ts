/**
 * 内核：k-means 聚类（机器学习算法 · 原理：无标签的点怎么自己分成几堆）
 * 轴：step —— 反复"把每个点分给最近的重心 → 重心移到自己那堆的中心"
 *
 * k-means 是最经典的**无监督聚类**：没有标签，只想把一堆点分成 k 堆。做法是两步反复跳：
 *   ① **分配**：每个点归给离它最近的那个"重心(centroid)"；
 *   ② **更新**：每个重心移动到"分给它的那些点"的平均位置。
 * 反复①②，重心一步步挪到各堆的中心、点的归属稳定下来。
 * 每一轮**簇内平方和(inertia)单调下降**、几步就收敛。
 *
 * ## 2026-09-08 补厚（用户：「实验仿真有点偏简陋，要深深打磨」）
 *
 * 原来 k 写死 3、初始重心写死一组、数据写死一份，**一个旋钮都没有**。
 * 而这门算法的两条软肋，老版本的说明里**写着**却**演不出来**：
 *   ① 「结果依赖初始重心」—— 只有一组初始值，怎么可能看见它依赖？
 *   ② 「k 得人定」—— k 不能改，这句话就是空的。
 * 光说不演，跟背结论没区别。
 *
 * 现在：
 *   · **k 可调(2..5)**，并且现算出「这个 k 的 inertia」——把 k 从 2 拧到 5，
 *     inertia 一路降（它必然随 k 单调降，所以**不能靠 inertia 选 k**），这正是手肘法的由来；
 *   · **初始化可选**，其中「一角扎堆」是精心构造的坏初始 —— 它会收敛到一个
 *     **inertia 明显更高的局部最优**，而且屏幕上跟最好的那次并排比给你看；
 *   · **数据形状可换**：三团（k-means 的主场）/ 两条月牙（它做不到 —— 只会切球形的堆）；
 *   · 每一轮的 inertia 存进 `inertiaHist`，收敛曲线画得出来。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}

/** 两种数据：三团是 k-means 的主场；两条月牙它注定切不开 */
function makePoints(shape: string): number[][] {
  const rnd = lcg(7)
  const pts: number[][] = []
  if (shape === '两条月牙') {
    //  非凸：两条弯月互相嵌着。k-means 只会按"离哪个重心近"切直线边界，必然切错
    for (let i = 0; i < 11; i++) {
      const t = Math.PI * (i / 10)
      pts.push([+(Math.cos(t) * 2 + rnd() * 0.35).toFixed(3), +(Math.sin(t) * 1.4 - 0.5 + rnd() * 0.35).toFixed(3)])
    }
    for (let i = 0; i < 11; i++) {
      const t = Math.PI * (i / 10)
      pts.push([+(Math.cos(t) * -2 + 0 + rnd() * 0.35).toFixed(3), +(-Math.sin(t) * 1.4 + 0.5 + rnd() * 0.35).toFixed(3)])
    }
    return pts
  }
  const CENTERS = [[-1.5, -1], [1.5, -1.2], [0, 1.6]]
  for (const c of CENTERS) for (let i = 0; i < 6; i++) {
    pts.push([+(c[0] + rnd() * 1.2).toFixed(3), +(c[1] + rnd() * 1.2).toFixed(3)])
  }
  return pts
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1])

export type KMeansState = {
  i: number
  step: number
  iter: number
  k: number
  phase: 'assign' | 'move' | 'done'
  points: number[][]
  assign: number[]
  centroids: number[][]
  inertia: number
  /** 每一帧之后的 inertia —— 画收敛曲线，也用来验"单调降" */
  inertiaHist: number[]
  /** 同样的 k、同样的数据，**最好的一次**能到多少（20 次随机重启里的最小值） */
  bestInertia: number
  /** 这一次比最好的一次差多少（%）；> 0 就是掉进了局部最优 */
  gapPct: number
  converged: boolean
  log: string
}

export const KMEANS_VISIBLE = [
  'step', 'iter', 'k', 'phase', 'points', 'assign', 'centroids',
  'inertia', 'inertiaHist', 'bestInertia', 'gapPct', 'converged', 'log',
] as const

type Frame = Omit<KMeansState, 'i'>

export const kmeansKernel: Kernel<KMeansState> = {
  kind: 'kmeans',

  compile(doc: SimDocument): CompiledModel<KMeansState> {
    const K = doc.params.k === undefined ? 3 : num(doc.params, 'k')
    const shape = doc.params.shape === undefined ? '三团' : str(doc.params, 'shape')
    /*  默认用 k-means++ —— 真实实现（sklearn 等）就是它。
        实测：默认这组数据上 k-means++ 收敛到 4.05（= 20 次重启里的最好成绩），
        而「分散」31.79、「一角扎堆」30.19，都是明显更差的局部最优。
        默认必须是"教科书该有的样子"，坏初始留给旋钮去演。 */
    const initKey = doc.params.init === undefined ? 'k-means++' : str(doc.params, 'init')
    const POINTS = makePoints(shape)

    const assignOf = (cent: number[][]) => POINTS.map(p => {
      let best = 0, bd = Infinity
      cent.forEach((c, k) => { const d = dist(p, c); if (d < bd) { bd = d; best = k } })
      return best
    })
    const meansOf = (assign: number[], cent: number[][]) => cent.map((_, k) => {
      const mine = POINTS.filter((_, i) => assign[i] === k)
      //  空簇：没有点归给它，就让它待在原地（真实实现常见做法是重新播种，这里保守处理）
      if (!mine.length) return cent[k]
      return [mine.reduce((a, p) => a + p[0], 0) / mine.length, mine.reduce((a, p) => a + p[1], 0) / mine.length]
    })
    const inertiaOf = (assign: number[], cent: number[][]) =>
      POINTS.reduce((a, p, i) => a + dist(p, cent[assign[i]]) ** 2, 0)

    /** 跑到收敛，只要最终 inertia（用来求"最好的一次"） */
    function runTo(cent0: number[][]): number {
      let c = cent0.map(x => x.slice())
      for (let it = 0; it < 40; it++) {
        const a = assignOf(c)
        const n = meansOf(a, c)
        if (!n.some((x, k) => dist(x, c[k]) > 1e-9)) return inertiaOf(a, n)
        c = n
      }
      return inertiaOf(assignOf(c), c)
    }

    /** 三种初始化 */
    function initCentroids(): number[][] {
      const xs = POINTS.map(p => p[0]), ys = POINTS.map(p => p[1])
      const xlo = Math.min(...xs), xhi = Math.max(...xs), ylo = Math.min(...ys), yhi = Math.max(...ys)
      if (initKey === '一角扎堆') {
        //  **精心构造的坏初始**：k 个重心全挤在左下角一小块里。
        //  它照样会收敛（k-means 总会收敛），但收敛到的是一个明显更差的局部最优。
        return Array.from({ length: K }, (_, k) => [xlo + 0.08 * k, ylo + 0.08 * k])
      }
      if (initKey === 'k-means++') {
        //  k-means++：第一个随机，之后每个都**尽量离已选的远**（按距离平方加权，这里取最大值，确定性）
        const c: number[][] = [POINTS[0].slice()]
        while (c.length < K) {
          let best = POINTS[0], bd = -1
          for (const p of POINTS) {
            const d = Math.min(...c.map(x => dist(p, x))) ** 2
            if (d > bd) { bd = d; best = p }
          }
          c.push(best.slice())
        }
        return c
      }
      /*  「分散」：在数据框边缘上下交替铺开。听着合理，实测却是个**中等偏差**的初始
          （三团 k=3 收敛到 31.79，而最好的一次只要 4.05）—— 这本身就是一课：
          "看起来分散"不等于"好初始"，k-means++ 那种"尽量互相远离"才是。 */
      return Array.from({ length: K }, (_, k) => [
        xlo + (xhi - xlo) * ((k + 0.5) / K),
        k % 2 === 0 ? yhi : ylo,
      ])
    }

    //  「最好的一次」：20 次确定性伪随机重启，取最小 inertia。
    //  有了它，"这一次掉进局部最优"才是**摆在屏幕上的对比**，而不是一句断言。
    const rr = lcg(2026)
    let bestInertia = Infinity
    for (let t = 0; t < 20; t++) {
      const c = Array.from({ length: K }, () => POINTS[Math.floor(Math.abs(rr()) * 2 * POINTS.length) % POINTS.length].slice())
      bestInertia = Math.min(bestInertia, runTo(c))
    }
    bestInertia = +bestInertia.toFixed(2)

    const frames: Frame[] = []
    const inertiaHist: number[] = []
    let cent = initCentroids()
    const r2 = (m: number[][]) => m.map(c => [+c[0].toFixed(2), +c[1].toFixed(2)])
    const gapOf = (v: number) => (bestInertia > 0 ? +(((v - bestInertia) / bestInertia) * 100).toFixed(1) : 0)
    let step = 0

    for (let iter = 0; iter < 12; iter++) {
      const assign = assignOf(cent)
      const inertia = +inertiaOf(assign, cent).toFixed(2)
      inertiaHist.push(inertia)
      frames.push({
        step: step++, iter, k: K, phase: 'assign', points: POINTS, assign: assign.slice(),
        centroids: r2(cent), inertia, inertiaHist: [...inertiaHist], bestInertia, gapPct: gapOf(inertia),
        converged: false,
        log: `第 ${iter + 1} 轮 · **分配**：每个点归给离它最近的重心（按颜色分堆）。`
          + `此刻簇内平方和 inertia = **${inertia}**。`,
      })
      const next = meansOf(assign, cent)
      const moved = next.some((c, k) => dist(c, cent[k]) > 1e-4)
      const inertia2 = +inertiaOf(assign, next).toFixed(2)
      inertiaHist.push(inertia2)
      frames.push({
        step: step++, iter, k: K, phase: moved ? 'move' : 'done', points: POINTS, assign: assign.slice(),
        centroids: r2(next), inertia: inertia2, inertiaHist: [...inertiaHist], bestInertia,
        gapPct: gapOf(inertia2), converged: !moved,
        log: moved
          ? `第 ${iter + 1} 轮 · **更新**：每个重心移到"分给它的那些点"的平均位置 → inertia ${inertia} → **${inertia2}**。`
          : `重心不再动了 —— **收敛**，inertia 稳定在 **${inertia2}**。`,
      })
      if (!moved) break
      cent = next
    }

    const lf = frames[frames.length - 1]
    const gap = gapOf(lf.inertia)
    frames.push({
      ...lf, phase: 'done', converged: true,
      //  ⚠️ 这些数全部现算。原来写死「inertia 从 54 一路降到…」，k 一能调就是假话。
      log: `k-means 收敛（k=${K}、初始「${initKey}」、数据「${shape}」）：`
        + `inertia 从 ${inertiaHist[0]} 降到 **${lf.inertia}**，走了 ${lf.iter + 1} 轮。`
        + `全程没有用任何标签 —— 纯靠"分给最近重心 → 重心移到均值"两步交替，让结构自己浮现。`
        + (gap > 1
          ? `　⚠️ 但这一次**掉进了局部最优**：同样的 k、同样的数据，最好的一次只要 ${bestInertia}，`
            + `这一次高出 **${gap}%**。k-means 保证收敛，**不保证收敛到最好** —— `
            + `所以实际用的时候要换不同初始跑很多次、取 inertia 最小的那次（sklearn 的 n_init 就是干这个的）。`
            + `把初始化换成「k-means++」再看。`
          : `　这一次落在了最好的那一档（${bestInertia}）。把初始化换成「一角扎堆」试试 —— `
            + `同样的算法、同样的数据，只因为起点不同就会停在一个明显更差的地方。`)
        + `　另外：inertia **必然随 k 单调降**（k=点数时它是 0），所以**不能靠 inertia 选 k**，`
        + `这正是"手肘法"存在的原因。`,
    })

    const base0: Frame = {
      step: -1, iter: 0, k: K, phase: 'assign', points: POINTS, assign: POINTS.map(() => -1),
      centroids: r2(initCentroids()), inertia: 0, inertiaHist: [], bestInertia, gapPct: 0,
      converged: false, log: '',
    }

    return {
      axis: { kind: 'step', label: '分配/更新' },
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
