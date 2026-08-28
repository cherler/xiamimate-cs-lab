/**
 * 内核：Feed 流 · 推拉扩散真仿真 —— 首页时间线怎么生成：推模式写扩散 vs 拉模式读归并（后端 · 系统设计）
 * 轴：step —— 普通用户发帖走"推"(写进每个粉丝收件箱)，大V发帖走"拉"(只存自己 outbox)，刷 feed 时收件箱 + 拉大V 归并按时间排
 *
 * "怎么生成一个人的首页 Feed"是社交系统的核心题。矛盾在**读写谁贵**：
 *   · **推模式(fan-out on write)**：你一发帖,就把它**写进你每个粉丝的收件箱**。读 feed 只需读自己收件箱 → 读快;
 *     但发帖要写 N 次(N=粉丝数),**大V(百万粉)一发帖=百万次写**,扩散风暴。
 *   · **拉模式(fan-out on read)**：发帖只存自己 outbox、不扩散 → 写快;读 feed 时**拉你关注的所有人**的帖再归并 → 读贵。
 *   · **推拉结合(真实做法)**：普通用户用推(粉丝少、写得起、读得爽),**大V 用拉**(粉丝太多、别扩散),
 *     刷 feed = 读收件箱(推来的普通用户帖) + 实时拉大V帖 → 按时间归并。
 * 本仿真真跑:普通用户 A/B 发帖走推(看收件箱累积、写入次数),大V 发帖走拉(看省下的百万次写),
 * 最后刷 feed 把两路按逻辑时间归并成时间线。写入次数、收件箱、归并结果全真算。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Post = { author: string; text: string; t: number }   // t = 逻辑时间（发帖全局顺序）
export type FeedState = {
  i: number
  step: number
  phase: 'intro' | 'push' | 'pull' | 'read' | 'done'
  op: 'intro' | 'postPush' | 'postPull' | 'merge' | 'summary'
  event: { author: string; text: string; t: number; mode: 'push' | 'pull'; fanout: number } | null  // 本步发的帖
  myInbox: Post[]                     // 「我」的收件箱（推模式写进来的）
  vOutbox: Post[]                     // 大V 的 outbox（拉模式，不扩散）
  pushWrites: number                  // 推模式累计写入次数
  savedWrites: number                 // 大V 走拉省下的写入次数
  feed: Post[]                        // 刷新后归并出的 feed（时间降序）
  focus: string
  log: string
}
type Frame = Omit<FeedState, 'i'>

const BIGV_FOLLOWERS = 1_000_000       // 大V 粉丝（百万级）
const NORMAL_FOLLOWERS = 3             // 普通用户粉丝（含「我」）
// 发帖全局顺序（逻辑时间 t）：普通用户 A/B 走推，大V 走拉
const EVENTS: { author: string; text: string; t: number; mode: 'push' | 'pull' }[] = [
  { author: 'A', text: 'a1：今天写了个内核', t: 1, mode: 'push' },
  { author: 'B', text: 'b1：晚饭吃什么', t: 2, mode: 'push' },
  { author: '大V', text: 'v1：新版本发布了', t: 3, mode: 'pull' },
  { author: 'A', text: 'a2：跑通了！', t: 4, mode: 'push' },
  { author: '大V', text: 'v2：直播预告', t: 5, mode: 'pull' },
]

export const feedKernel: Kernel<FeedState> = {
  kind: 'feed',
  compile(_doc: SimDocument): CompiledModel<FeedState> {
    const frames: Frame[] = []
    const snap = (a: Post[]) => a.map(p => ({ ...p }))
    const push = (f: Omit<Frame, 'step'>) => frames.push({ step: frames.length, ...f })

    const myInbox: Post[] = []
    const vOutbox: Post[] = []
    let pushWrites = 0
    let savedWrites = 0

    // —— 开场 ——
    push({
      phase: 'intro', op: 'intro', event: null, myInbox: [], vOutbox: [], pushWrites: 0, savedWrites: 0, feed: [],
      focus: '首页 Feed 怎么生成：推(写扩散,读快写贵) vs 拉(读归并,写快读贵)',
      log: `**Feed 流：推 vs 拉**\n"怎么生成一个人的首页时间线"矛盾在**读写谁贵**：\n· **推**（发帖时写进每个粉丝收件箱）：读快，但发帖写 N 次——**大V 百万粉一发=百万次写**。\n· **拉**（发帖只存自己 outbox）：写快，但读 feed 要拉你关注的所有人再归并。\n· **推拉结合**：普通用户推、**大V 拉**。\n设定：大V 粉丝 ${BIGV_FOLLOWERS.toLocaleString()}，普通用户 A/B 各 ${NORMAL_FOLLOWERS} 粉（含「我」）。「我」关注了 A、B、大V。看发帖和刷新怎么走。`,
    })

    // —— 第一/二幕：按全局顺序发帖，普通用户走推、大V 走拉 ——
    for (const ev of EVENTS) {
      if (ev.mode === 'push') {
        pushWrites += NORMAL_FOLLOWERS                    // 写进每个粉丝的收件箱
        myInbox.push({ author: ev.author, text: ev.text, t: ev.t })   // 「我」是其粉丝之一
        push({
          phase: 'push', op: 'postPush', event: { ...ev, fanout: NORMAL_FOLLOWERS }, myInbox: snap(myInbox), vOutbox: snap(vOutbox), pushWrites, savedWrites, feed: [],
          focus: `${ev.author} 发帖(推) → 写进 ${NORMAL_FOLLOWERS} 个粉丝收件箱（累计写 ${pushWrites}）`,
          log: `**推：${ev.author} 发「${ev.text}」**\n${ev.author} 粉丝少（${NORMAL_FOLLOWERS}），走**推**：发帖时把这条**写进每个粉丝的收件箱**（fan-out=${NORMAL_FOLLOWERS} 次写，累计 ${pushWrites}）。「我」是粉丝之一 → 收件箱多了这条。\n好处：等「我」刷 feed 时，直接读收件箱就行、**读 O(1)**，不用现算。`,
        })
      } else {
        savedWrites += BIGV_FOLLOWERS                     // 若推需要写这么多次，现在省了
        vOutbox.push({ author: ev.author, text: ev.text, t: ev.t })
        push({
          phase: 'pull', op: 'postPull', event: { ...ev, fanout: 0 }, myInbox: snap(myInbox), vOutbox: snap(vOutbox), pushWrites, savedWrites, feed: [],
          focus: `${ev.author} 发帖(拉) → 只存 outbox，省下 ${BIGV_FOLLOWERS.toLocaleString()} 次写（累计省 ${savedWrites.toLocaleString()}）`,
          log: `**拉：${ev.author} 发「${ev.text}」**\n${ev.author} 是大V（${BIGV_FOLLOWERS.toLocaleString()} 粉），若走推要**写 ${BIGV_FOLLOWERS.toLocaleString()} 次**——扩散风暴。所以走**拉**：只把帖存进自己的 **outbox**、不扩散，**省下 ${BIGV_FOLLOWERS.toLocaleString()} 次写**（累计省 ${savedWrites.toLocaleString()}）。\n代价：这条没进任何人的收件箱，等粉丝刷 feed 时**实时拉**。`,
        })
      }
    }

    // —— 第三幕：刷 feed，收件箱 + 拉大V outbox → 归并 ——
    const feed = [...myInbox, ...vOutbox].sort((a, b) => b.t - a.t)   // 按逻辑时间降序归并
    push({
      phase: 'read', op: 'merge', event: null, myInbox: snap(myInbox), vOutbox: snap(vOutbox), pushWrites, savedWrites, feed: snap(feed),
      focus: `刷 feed：读收件箱(${myInbox.length}) + 拉大V(${vOutbox.length}) → 归并 ${feed.length} 条按时间排`,
      log: `**「我」刷 feed：两路归并**\n= 读**收件箱**（推来的普通用户帖：${myInbox.map(p => p.text.split('：')[0]).join('、')}）\n+ 实时**拉**关注的大V 的 outbox（${vOutbox.map(p => p.text.split('：')[0]).join('、')}）\n→ 按**逻辑时间**归并排序（多路归并，像 K 个有序链表合并）：\n**${feed.map(p => `${p.text.split('：')[0]}(t${p.t})`).join(' > ')}**。\n普通用户帖早写好在收件箱（读快），大V帖只拉这几个作者（不至于读爆）——这就是推拉结合。`,
    })

    // —— 收尾 ——
    push({
      phase: 'done', op: 'summary', event: null, myInbox: snap(myInbox), vOutbox: snap(vOutbox), pushWrites, savedWrites, feed: snap(feed),
      focus: `推写 ${pushWrites} 次(读快)；大V走拉省 ${savedWrites.toLocaleString()} 次写；刷 feed = 收件箱 + 拉大V 归并`,
      log: `**小结：推拉结合**\n· **推(fan-out on write)**：发帖写进每个粉丝收件箱 → 读 O(1)、写 O(粉丝数)。粉丝少的普通用户用它。\n· **拉(fan-out on read)**：发帖只存 outbox → 写 O(1)、读 O(关注数) 要归并。\n· **结合**：普通用户推、大V 拉；刷 feed = 读收件箱(推来的) + 拉少数大V(避免百万扩散)，归并按时间。本仿真里推共写 ${pushWrites} 次，大V 走拉省下 ${savedWrites.toLocaleString()} 次写。\n面试延伸：为什么大V 必须拉（写扩散风暴 + 粉丝里很多僵尸不看）、feed 归并=多路有序合并（小顶堆）、时间线存 postID 不存内容（省空间、内容另查）、新粉丝进来历史 feed 怎么补、读扩散的缓存怎么做。这套用在微博/朋友圈/Twitter timeline。`,
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, event: null, myInbox: [], vOutbox: [], pushWrites: 0, savedWrites: 0, feed: [], focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'Feed 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
