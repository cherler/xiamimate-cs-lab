/**
 * 内核：向量时钟 Vector Clock —— 分布式下判定"谁先谁后 / 还是并发"（后端 · 分布式系统）
 * 轴：step —— 三个进程各持一个向量，本地事件自增、收消息取 max，最后判因果 vs 并发
 *
 * 分布式没有全局时钟，怎么知道两个事件的先后？物理时间不可靠(各机时钟有偏差)。
 * 向量时钟给每个进程一个计数向量 V=[P0,P1,P2]，三条规则：
 *   · 本地事件：自己那一位 +1
 *   · 发消息：自己 +1，并把整个向量随消息带走
 *   · 收消息：逐位取 max(本地, 收到的)，再把自己 +1
 * 判定：V(a) ≤ V(b)（每一位都 ≤ 且不相等）⟺ a 一定在 b 之前(因果先行)；
 *       两个都不 ≤ 对方 ⟺ 二者**并发**(谁也没影响谁)。
 * 本例最后比两对：a[1,0,0] 与 e[2,2,1] → 因果(a→e)；f[3,0,0] 与 e[2,2,1] → 并发。
 * 值:每个向量由自增/取 max 算出,可逐位手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Vec = number[]
export type VClockState = {
  i: number
  step: number
  op: 'intro' | 'local' | 'send' | 'recv' | 'compare'
  proc: number             // 本步动作的进程（-1=intro/compare）
  clocks: Vec[]            // 三个进程当前向量
  msg: Vec | null          // 随消息带走/收到的向量
  label: string            // 事件名 a/b/c...
  cmp: { x: string; xv: Vec; y: string; yv: Vec; rel: string }[]  // compare 步的结论
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<VClockState, 'i'>

const P = ['P0', 'P1', 'P2']
const sv = (v: Vec) => `[${v.join(',')}]`
const le = (x: Vec, y: Vec) => x.every((v, k) => v <= y[k]!)
const lt = (x: Vec, y: Vec) => le(x, y) && x.some((v, k) => v < y[k]!)
const relOf = (x: Vec, y: Vec) => (lt(x, y) ? '因果先行(x→y)' : lt(y, x) ? '因果先行(y→x)' : '并发（互不影响）')

export const vectorclockKernel: Kernel<VClockState> = {
  kind: 'vectorclock',
  compile(_doc: SimDocument): CompiledModel<VClockState> {
    const V: Vec[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    const clone = () => V.map(v => [...v])
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'clocks' | 'cmp'> & { cmp?: VClockState['cmp'] }) =>
      frames.push({ step: frames.length, clocks: clone(), cmp: f.cmp ?? [], ...f })

    push({ op: 'intro', proc: -1, msg: null, label: '', phase: 'run', focus: '三个进程，各持一个向量时钟',
      log: `**向量时钟：给"先后关系"一个可算的标尺**\n没有全局时钟，怎么知道两个事件谁先谁后？给每个进程一个计数向量 V=[P0,P1,P2]：\n· 本地事件 → 自己那位 +1\n· 发消息 → 自己 +1，向量随消息带走\n· 收消息 → 逐位取 max，再自己 +1\n三个进程都从 [0,0,0] 开始。` })

    // a: P0 local
    V[0]![0]++; const a = [...V[0]!]
    push({ op: 'local', proc: 0, msg: null, label: 'a', phase: 'run', focus: 'a：P0 本地事件 → 自己 +1',
      log: `**事件 a（P0 本地）**\nP0 自己那位 +1 → V0 = ${sv(V[0]!)}` })

    // b: P0 send
    V[0]![0]++; const mb = [...V[0]!]
    push({ op: 'send', proc: 0, msg: mb, label: 'b', phase: 'run', focus: 'b：P0 发消息 → 自己 +1，带上向量',
      log: `**事件 b（P0 发消息给 P1）**\nP0 再 +1 → V0 = ${sv(V[0]!)}，并把 ${sv(mb)} 随消息带走。` })

    // c: P1 recv
    for (let k = 0; k < 3; k++) V[1]![k] = Math.max(V[1]![k]!, mb[k]!); V[1]![1]++
    push({ op: 'recv', proc: 1, msg: mb, label: 'c', phase: 'run', focus: 'c：P1 收消息 → 逐位 max 后自己 +1',
      log: `**事件 c（P1 收到消息）**\n逐位取 max([0,0,0], ${sv(mb)}) = ${sv([mb[0]!, Math.max(0, mb[1]!), 0])}，再 P1 自己 +1 → V1 = ${sv(V[1]!)}\nP1 现在"知道"了 P0 到 b 为止的进度。` })

    // d: P1 send
    V[1]![1]++; const md = [...V[1]!]
    push({ op: 'send', proc: 1, msg: md, label: 'd', phase: 'run', focus: 'd：P1 发消息 → 自己 +1，带上向量',
      log: `**事件 d（P1 发消息给 P2）**\nP1 +1 → V1 = ${sv(V[1]!)}，带走 ${sv(md)}。` })

    // e: P2 recv
    for (let k = 0; k < 3; k++) V[2]![k] = Math.max(V[2]![k]!, md[k]!); V[2]![2]++; const e = [...V[2]!]
    push({ op: 'recv', proc: 2, msg: md, label: 'e', phase: 'run', focus: 'e：P2 收消息 → 逐位 max 后自己 +1',
      log: `**事件 e（P2 收到消息）**\nmax([0,0,0], ${sv(md)}) 再自己 +1 → V2 = ${sv(V[2]!)}\n注意 e 的向量里带着 P0=2、P1=2——因果链 a→b→c→d→e 全记在里面。` })

    // f: P0 local（并发分支）
    V[0]![0]++; const f = [...V[0]!]
    push({ op: 'local', proc: 0, msg: null, label: 'f', phase: 'run', focus: 'f：P0 又一个本地事件（没收过 P1/P2 的消息）',
      log: `**事件 f（P0 本地）**\nP0 +1 → V0 = ${sv(V[0]!)}\nP0 这一路都没收到 P1/P2 的消息，所以它的向量里 P1、P2 还是 0。` })

    const cmp = [
      { x: 'a', xv: a, y: 'e', yv: e, rel: relOf(a, e) },
      { x: 'f', xv: f, y: 'e', yv: e, rel: relOf(f, e) },
    ]
    push({ op: 'compare', proc: -1, msg: null, label: '', phase: 'done', focus: '判定：a→e 是因果，f 与 e 是并发', cmp,
      log: `**用向量比先后**\n规则：每一位都 ≤ 且不全等 ⟺ 因果先行；互相都不 ≤ ⟺ 并发。\n· a=${sv(a)} vs e=${sv(e)}：每位都 ≤ → **a 因果先于 e**（a→b→c→d→e 这条链）。\n· f=${sv(f)} vs e=${sv(e)}：f 的 P0=3>2，但 e 的 P1=2>0——**谁也不 ≤ 谁 → 并发**。f 和 e 各干各的、没有因果关系。\n\n这正是向量时钟的价值：不靠物理时间，就能分清"真的有先后依赖"和"只是碰巧同时"。用在因果一致性、冲突检测(如 Dynamo 购物车合并)、分布式调试里。` })

    const base0: Frame = { op: 'intro', step: -1, proc: -1, clocks: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], msg: null, label: '', cmp: [], phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '事件步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
