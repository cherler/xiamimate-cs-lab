/**
 * 内核：系统设计 · 设计短链系统（后端 · 求职面试「系统设计」这一关）
 * 轴：step —— 从需求到架构，一步一个设计决策，把系统搭起来
 *
 * 系统设计是中高级岗面试的核心:给一个模糊需求(设计短链/秒杀/Feed),让你**从需求澄清 → 容量估算 →
 * 核心设计 → 扩展 → 权衡**一路推下来。考的不是背答案,是有没有「造系统」的思维框架。
 * 本实验以「短链系统」为例,把这套框架走一遍:每一步是一个真实的设计决策 + 为什么这么选。
 * 走完你手里就有一套能讲的设计,也是 AI 面试官能继续追问的靶子。
 *
 * 关键数:Base62 编码 6 位 → 62^6 ≈ 568 亿个短码,够用;读写比约 100:1 → 必须加缓存。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Comp = { id: string; label: string; role: string }

export type SysDesignState = {
  i: number
  step: number
  stage: string          // 阶段名
  focus: string          // 本步的设计决策
  detail: string         // 为什么这么选
  metric: string         // 本步的关键数/结论
  components: Comp[]      // 累积搭起来的架构
  phase: 'run' | 'done'
  log: string
}

export const SYSDESIGN_VISIBLE = ['step', 'stage', 'focus', 'detail', 'metric', 'components', 'phase', 'log'] as const

type Frame = Omit<SysDesignState, 'i'>

const STAGES: { stage: string; focus: string; detail: string; metric: string; add?: Comp[] }[] = [
  {
    stage: '① 需求澄清', focus: '先问清楚要什么，别急着画框',
    detail: '功能：长链→短链、短链→长链跳转。非功能：读远多于写、低延迟、短码要短且唯一、高可用。先划定边界，面试官最看重这一步。',
    metric: '读:写 ≈ 100:1（跳转多、生成少）',
    add: [{ id: 'client', label: '客户端', role: '发起生成/跳转' }],
  },
  {
    stage: '② 容量估算', focus: '算一算规模，决定后面怎么选型',
    detail: '假设每月新增 1 亿短链 → 写 ≈ 40/s；读按 100:1 ≈ 4000/s。存 5 年 ≈ 60 亿条 × ~100B ≈ 600GB。这些数决定要不要分片、要不要缓存。',
    metric: '写 40/s、读 4000/s、存 ~600GB',
    add: [{ id: 'api', label: 'API 服务', role: '生成/跳转接口' }],
  },
  {
    stage: '③ 发号 + 编码', focus: '短码怎么生成？唯一且尽量短',
    detail: '核心是拿一个**唯一 ID**（发号器/雪花 ID），再 **Base62 编码**（0-9a-zA-Z）成短码。6 位 Base62 = 62^6 ≈ 568 亿，够用还短。对比：哈希长链会碰撞、要处理冲突；自增 ID 可预测有序、但暴露量。',
    metric: '62^6 ≈ 568 亿个 6 位短码',
    add: [{ id: 'idgen', label: '发号器', role: '生成唯一 ID' }, { id: 'base62', label: 'Base62 编码', role: 'ID→短码' }],
  },
  {
    stage: '④ 存储', focus: '映射存哪，主键选谁',
    detail: '存「短码 → 长链」的映射。短码做主键（点查为主，KV/关系库都行）。写少读多，存储不是瓶颈，重点是读得快。',
    metric: '短码为主键，点查 O(1)',
    add: [{ id: 'db', label: '数据库', role: '短码→长链 持久化' }],
  },
  {
    stage: '⑤ 缓存读路径', focus: '读 4000/s，靠缓存扛',
    detail: '读多写少 → 加 **Redis 缓存**热点短码：跳转先查缓存，命中直接 302；未命中查库、回填缓存。热点短链(病毒传播)几乎全走缓存，DB 压力骤降。',
    metric: '热点命中率高 → DB 只扛未命中',
    add: [{ id: 'cache', label: 'Redis 缓存', role: '热点短码，扛住读' }],
  },
  {
    stage: '⑥ 扩展', focus: '量再大怎么办',
    detail: '按短码**一致性哈希分片**（加机器只搬一小段）；跳转用 301(永久,浏览器缓存)还是 302(临时,能统计点击)按需选；超热链上 **CDN**。发号器也要能分布式发号（雪花 ID 天然可分片）。',
    metric: '分片 + CDN + 301/302 权衡',
    add: [{ id: 'shard', label: '分片(一致性哈希)', role: '水平扩展' }, { id: 'cdn', label: 'CDN', role: '超热链就近跳转' }],
  },
]

export const urlshortenerKernel: Kernel<SysDesignState> = {
  kind: 'urlshortener',
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
      step: frames.length, stage: '⑦ 权衡总结', focus: '一句话讲清取舍', detail: '',
      metric: '发号器>哈希>自增；301 缓存永久 vs 302 可统计；缓存扛读、分片扛量',
      components: components.map(c => ({ ...c })), phase: 'done',
      log: `**设计完成**：需求→估算→发号编码→存储→缓存→扩展，一套短链系统搭好了。面试的加分项在**权衡**：短码为什么用发号器+Base62(不用哈希怕碰撞、不用自增怕被爬)；跳转 301(永久、省服务器但没法统计) vs 302(可统计点击);读靠缓存、量靠分片。这套「需求→估算→核心→扩展→权衡」的框架,换成设计秒杀/Feed/消息队列也照样用。`,
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
