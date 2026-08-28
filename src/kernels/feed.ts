/**
 * 内核：系统设计 · 设计 Feed 流（时间线）—— 推 vs 拉 vs 推拉结合（后端 · 系统设计 / 求职）
 * 轴：step —— 需求→估算→推模型(写扩散)→拉模型(读扩散)→推拉结合→权衡
 *
 * 朋友圈/微博时间线是系统设计高频题。核心矛盾:关注的人发帖,我要看到最新;读远多于写;
 * 还有**大 V**(千万粉丝)这个麻烦。三种做法:
 *   · 推(写扩散):发帖时写进**所有粉丝的收件箱**。读快(直接读自己收件箱),但大 V 发一条要写千万次、存储爆。
 *   · 拉(读扩散):发帖只存自己。读时**现拉所有关注人的最新帖归并**。写快,但读慢(每次拉 N 个人)。
 *   · 推拉结合:普通用户用推,大 V 用拉(粉丝读时才现拉大 V)——两头的短板互相补。
 * 复用「需求→估算→核心→扩展→权衡」框架。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'
import type { SysDesignState } from './urlshortener.ts'

type Comp = { id: string; label: string; role: string }
type Frame = Omit<SysDesignState, 'i'>

const STAGES: { stage: string; focus: string; detail: string; metric: string; add?: Comp[] }[] = [
  {
    stage: '① 需求澄清', focus: '关注的人发帖，我的时间线看到最新',
    detail: '功能：关注某些人 → 他们发的帖按时间出现在我的时间线。非功能：**读远多于写**（刷的人多、发的人少）、低延迟、大体按时间倒序。麻烦：**大 V** 有千万粉丝。',
    metric: '读多写少 + 大 V 千万粉丝这个麻烦',
    add: [{ id: 'user', label: '用户', role: '发帖 / 刷时间线' }],
  },
  {
    stage: '② 容量估算', focus: '读写严重不对称',
    detail: '刷时间线（读）的 QPS 远高于发帖（写）。但**写放大**在大 V 身上很可怕：一个千万粉丝的大 V 发一条，若要推给所有粉丝，就是千万次写。选型要在"读快"和"写放大"之间权衡。',
    metric: '读 QPS ≫ 写；大 V 写放大千万倍',
    add: [{ id: 'post', label: '发帖服务', role: '写入帖子' }],
  },
  {
    stage: '③ 推模型（写扩散）', focus: '发帖时写进所有粉丝的收件箱',
    detail: '**推（fan-out on write）**：你一发帖，就把它 ID 写进**每个粉丝的收件箱（timeline 表/Redis 列表）**。读时直接读自己的收件箱 → **读极快**。代价：写放大（大 V 发一条要写千万次）、存储冗余大。',
    metric: '写进每个粉丝收件箱 → 读快、写放大',
    add: [{ id: 'inbox', label: '粉丝收件箱', role: '推：预写好的时间线' }],
  },
  {
    stage: '④ 拉模型（读扩散）', focus: '读时现拉所有关注人的最新帖归并',
    detail: '**拉（fan-out on read）**：发帖只存自己的"发件箱"。读时去**拉你关注的每个人的最新帖、归并排序**。**写极快**（只存一份）、无写放大。代价：读慢（每次要拉 N 个关注人、归并）、读放大。',
    metric: '读时拉 N 个关注人归并 → 写快、读慢',
    add: [{ id: 'pull', label: '拉取归并', role: '拉：读时现拉关注人' }],
  },
  {
    stage: '⑤ 推拉结合', focus: '普通用户用推、大 V 用拉，补两头短板',
    detail: '**混合**：普通用户走推（写扩散，读快）；**大 V 走拉**（发帖不推给千万粉丝，粉丝刷时才现拉大 V 的最新帖，和自己收件箱归并）。这样既避免大 V 的写放大，普通场景又保持读快。这是微博等的真实做法。',
    metric: '普通用户推 + 大 V 拉 → 两头短板互补',
    add: [{ id: 'merge', label: '归并层', role: '收件箱 + 大V现拉 合并' }],
  },
]

export const feedKernel: Kernel<SysDesignState> = {
  kind: 'feed',
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
      metric: '推(写扩散读快) + 拉(读扩散写快) + 大V走拉的混合',
      components: components.map(c => ({ ...c })), phase: 'done',
      log: `**设计完成**：Feed 三种做法——**推**(写扩散，读快、大 V 写放大)、**拉**(读扩散，写快、读慢)、**推拉结合**(普通推、大 V 拉)。面试加分点：为什么读多写少却怕写(大 V 写放大)、推拉怎么划线(按粉丝数阈值判定大 V)、时间线怎么排序(纯时间 vs 算法推荐)、收件箱存哪(Redis 列表、只存热点用户的、有上限)、拉的时候怎么快(缓存每个人的最新 N 条)、feed 去重和分页(基于游标)。这套也用在信息流、通知、动态。`,
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
