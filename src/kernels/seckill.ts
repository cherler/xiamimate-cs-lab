/**
 * 内核：秒杀 · 防超卖真仿真 —— 并发扣库存，naive「读→判→写」的竞态会超卖，Redis 原子 DECR 挡住（后端 · 系统设计）
 * 轴：step —— 同一份库存喂两版扣减：naive 非原子交错 → 超卖；原子 DECR → 精确不超卖
 *
 * 秒杀的红线是**绝不超卖**。难点不在"怎么削峰"这种架构话术,而在一个具体机制:
 * 高并发下"读库存→判>0→写回"这三步**不是原子的**,多个请求会读到同一个旧值、各自都判"还有货"、都扣一次 → 卖超。
 * 本仿真真跑一个会超卖的交错(库存=2,三个请求),你会看到最终库存变成 -1、卖出 3 件(只有 2 件);
 * 再用 **Redis 原子 DECR**(读-判-写合成一步不可打断)跑同一批请求,第 3 个 DECR 结果<0 → 回滚拒绝,卖出恰好 2。
 * 库存/卖出/是否超卖全部由交错**真跑出来**,不是写死的结论。这才是"防超卖"四个字背后的机制。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type Req = { id: string; local: number | null; status: 'pending' | 'reading' | 'passed' | 'sold' | 'rejected' }
export type SeckillState = {
  i: number
  step: number
  phase: 'intro' | 'naive' | 'atomic' | 'done'
  op: 'intro' | 'read' | 'commit' | 'atomic' | 'summary'
  mode: 'naive' | 'atomic' | ''
  stock: number            // 当前库存（naive 下可为负 = 超卖）
  sold: number             // 已卖出件数
  initStock: number        // 初始库存
  reqs: Req[]              // 三个并发请求及其状态
  cur: number             // 本步操作的请求下标（-1）
  oversold: boolean        // 卖出 > 初始库存？
  focus: string
  log: string
}
type Frame = Omit<SeckillState, 'i'>

const STOCK0 = 2                       // 初始库存：故意只有 2 件，让 3 个请求里必有一个该失败
const IDS = ['R1', 'R2', 'R3']

// naive 交错：读改写非原子。R3 在 R2 写回**之前**就读了库存 → 读到同一个旧值 → 双双判"有货"→ 超卖
type NaiveOp = { req: number; k: 'read' | 'commit' }
const NAIVE: NaiveOp[] = [
  { req: 0, k: 'read' },    // R1 读库存
  { req: 0, k: 'commit' },  // R1 判>0、扣
  { req: 1, k: 'read' },    // R2 读库存
  { req: 2, k: 'read' },    // R3 读库存（此刻 R2 还没写回 → R3 读到和 R2 一样的旧值，竞态就在这）
  { req: 1, k: 'commit' },  // R2 判(旧值)>0、扣
  { req: 2, k: 'commit' },  // R3 判(旧值)>0、扣 → 库存变负、超卖
]

export const seckillKernel: Kernel<SeckillState> = {
  kind: 'seckill',
  compile(_doc: SimDocument): CompiledModel<SeckillState> {
    const frames: Frame[] = []
    const snap = (reqs: Req[]): Req[] => reqs.map(r => ({ ...r }))
    const push = (f: Omit<Frame, 'step' | 'initStock'>) => frames.push({ step: frames.length, initStock: STOCK0, ...f })

    // —— 开场 ——
    push({
      phase: 'intro', op: 'intro', mode: '', stock: STOCK0, sold: 0, reqs: IDS.map(id => ({ id, local: null, status: 'pending' })), cur: -1, oversold: false,
      focus: '秒杀红线=绝不超卖；难点是"读→判>0→写"这三步不是原子的',
      log: `**秒杀防超卖：机制在哪**\n红线是**绝不超卖**。真正的坑不是"怎么削峰"，而是一个具体机制：高并发下\n\`读库存 → 判 >0 → 写回\`这三步**不是原子的**。多个请求会读到同一个旧值、各自都判"还有货"、都扣一次 → 卖超。\n库存 **${STOCK0}** 件、**3** 个请求同时抢。先跑会超卖的 naive 版，再用 Redis 原子 DECR 修。看库存和卖出真跑成什么样。`,
    })

    // —— 第一幕：naive 非原子，真跑出超卖 ——
    let stock = STOCK0, sold = 0
    const nreqs: Req[] = IDS.map(id => ({ id, local: null, status: 'pending' }))
    NAIVE.forEach((o, idx) => {
      const r = nreqs[o.req]!
      let op: SeckillState['op'], focus: string, log: string
      if (o.k === 'read') {
        r.local = stock; r.status = 'reading'
        op = 'read'; focus = `${r.id} 读库存 → 读到 ${r.local}`
        const race = o.req === 2 && nreqs[1]!.local === r.local && nreqs[1]!.status === 'reading'
        log = `**${r.id}：读库存 = ${r.local}**\n${r.id} 把当前库存读进自己的局部变量：**${r.local}**。${race ? `\n⚠️ 注意：R2 刚才也读到了 ${nreqs[1]!.local}、但**还没写回**。R3 现在读到的是同一个旧值 —— 竞态就埋在这：两个请求都以为"还有 ${r.local} 件"。` : '（还没判断、没写回，只是读。）'}`
      } else {
        const localVal = r.local!
        if (localVal > 0) {           // 基于自己读到的旧值判断 —— 这正是 bug
          stock -= 1; sold += 1; r.status = 'sold'
          op = 'commit'; focus = `${r.id} 判 ${localVal}>0 成立 → 扣，库存=${stock}、卖出=${sold}`
          const over = sold > STOCK0
          log = `**${r.id}：判 ${localVal} > 0 成立 → 扣减写回**\n${r.id} 拿**自己读到的旧值 ${localVal}** 判断"还有货"→ 成立 → 库存写成 **${stock}**、卖出 **${sold}**。${over ? `\n💥 **超卖！** 只有 ${STOCK0} 件，却卖出了 ${sold} 件、库存变成 **${stock}**。R3 判断时用的是过期的 ${localVal}，而真实库存其实已经被 R2 扣到 0 了 —— 读改写不原子的直接后果。` : ''}`
        } else {
          r.status = 'rejected'
          op = 'commit'; focus = `${r.id} 判 ${localVal}>0 不成立 → 拒绝`
          log = `**${r.id}：判 ${localVal} > 0 不成立 → 拒绝**\n库存已空，${r.id} 被拒。`
        }
      }
      push({ phase: 'naive', op, mode: 'naive', stock, sold, reqs: snap(nreqs), cur: o.req, oversold: sold > STOCK0, focus, log })
    })

    // —— 第二幕：Redis 原子 DECR，同一批请求 ——
    stock = STOCK0; sold = 0
    const areqs: Req[] = IDS.map(id => ({ id, local: null, status: 'pending' }))
    push({
      phase: 'atomic', op: 'summary', mode: 'atomic', stock, sold, reqs: snap(areqs), cur: -1, oversold: false,
      focus: '修法：Redis 原子 DECR —— 读-判-写合成一步、不可打断',
      log: `**修法：Redis 原子 DECR**\n把"读-判-写"三步合成**一个不可打断的原子操作**：Redis \`DECR\` 直接把库存减 1 并**返回减完的值**，中间没有任何请求能插进来。\n约定：DECR 结果 **≥ 0** 才算抢到；结果 **< 0** 说明超了 → **把这 1 加回去、拒绝**。同一批 3 个请求再跑一遍。`,
    })
    areqs.forEach((r, idx) => {
      const after = stock - 1          // 原子 DECR：真减，返回减完的值
      stock = after
      let focus: string, log: string
      if (after >= 0) {
        sold += 1; r.status = 'sold'
        focus = `${r.id} 原子 DECR → ${after} ≥ 0 → 抢到，卖出=${sold}`
        log = `**${r.id}：原子 DECR → ${after}**\nDECR 一步把库存减到 **${after}** 并返回它。${after} ≥ 0 → **抢到**，卖出 **${sold}**。读-判-写没有缝，别的请求插不进来。`
      } else {
        stock = after + 1; r.status = 'rejected'   // 回滚这一次多扣的
        focus = `${r.id} 原子 DECR → ${after} < 0 → 回滚+拒绝，卖出仍=${sold}`
        log = `**${r.id}：原子 DECR → ${after} < 0 → 拒绝**\nDECR 返回 **${after}**（负数）说明库存已空 → 这 1 件是超扣的，**加回去**（库存回 ${stock}）、拒绝 ${r.id}。卖出仍是 **${sold}**，**没超卖**。`
      }
      const last = idx === areqs.length - 1
      push({
        phase: last ? 'done' : 'atomic', op: last ? 'summary' : 'atomic', mode: 'atomic', stock, sold, reqs: snap(areqs), cur: idx, oversold: false, focus,
        log: last
          ? `${log}\n\n**结果对比**：同一批请求、同样 ${STOCK0} 件库存 —— naive 读改写不原子 → 卖出 3、库存 -1（**超卖**）；原子 DECR → 卖出恰好 ${sold}、库存 0（**精确**）。\n\n**这才是"防超卖"的机制**：不是加个 MQ、限个流就防住了，而是让"扣库存"这个动作**原子化**。Redis 原子 DECR 抗住高并发的第一道；落库再用 DB 乐观锁 \`UPDATE stock=stock-1 WHERE stock>0\` 兜第二道。削峰(前端置灰/网关限流/MQ 异步下单)是把量削小、别拖垮系统，但**防超卖靠的是原子性**，两件事别混。面试讲：为什么读改写会超卖(读-判-写非原子)、Redis DECR/Lua 怎么做到原子、为什么还要 DB 乐观锁兜底(Redis 挂了/预扣与落库不一致)、少卖 vs 超卖哪个能忍。`
          : log,
      })
    })

    const base0: Frame = { phase: 'intro', op: 'intro', mode: '', step: -1, stock: STOCK0, sold: 0, initStock: STOCK0, reqs: IDS.map(id => ({ id, local: null, status: 'pending' })), cur: -1, oversold: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '并发步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
