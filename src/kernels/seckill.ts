/**
 * 内核：系统设计 · 设计秒杀系统（后端 · 系统设计面试高频）
 * 轴：step —— 从需求到架构，一步一个设计决策，专治「瞬时高并发抢有限库存」
 *
 * 秒杀是系统设计的经典难题:一瞬间几万人抢 1000 件,红线是**绝不超卖**,而且大部分请求注定失败。
 * 它考的是**削峰 + 防超卖 + 异步化**这一整套高并发思路。复用「需求→估算→核心→扩展→权衡」框架。
 * 值可核:每步一个真实决策(层层限流、Redis 原子预扣、MQ 异步下单、乐观锁兜底)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'
import type { SysDesignState } from './urlshortener.ts'

type Comp = { id: string; label: string; role: string }
type Frame = Omit<SysDesignState, 'i'>

const STAGES: { stage: string; focus: string; detail: string; metric: string; add?: Comp[] }[] = [
  {
    stage: '① 需求澄清', focus: '看清楚：抢的是有限库存，红线是不超卖',
    detail: '瞬时几万人抢 1000 件。核心红线：**绝不超卖**（少卖可以，多卖是事故）。特征：请求量远超库存，**大部分请求注定失败**——所以设计目标是"快速拒绝大多数、精确成交少数"。',
    metric: '成功请求 = 库存数（有限），失败是常态',
    add: [{ id: 'client', label: '抢购客户端', role: '海量并发请求' }],
  },
  {
    stage: '② 容量估算', focus: '算清读写倾斜',
    detail: '峰值可能几万 QPS，但真正要落库的成功请求只有库存数（如 1000）。绝大多数请求应该在**到达数据库之前**就被挡回，DB 只处理极少量真实成交。',
    metric: '峰值万级 QPS，落库仅 ~1000',
    add: [{ id: 'gateway', label: '网关', role: '统一入口' }],
  },
  {
    stage: '③ 削峰限流', focus: '层层拦，别让洪峰冲到核心',
    detail: '前端：按钮点一次就置灰、加答题/验证码拖慢。网关：**令牌桶限流**只放一小部分进来。CDN 扛静态页。目标是把冲进核心的流量削到可控。',
    metric: '层层过滤，只放少量进核心',
    add: [{ id: 'ratelimit', label: '限流(令牌桶)', role: '削峰' }],
  },
  {
    stage: '④ Redis 预扣库存', focus: '库存放内存，原子扣减挡住绝大多数',
    detail: '库存放 **Redis**，用 **原子 DECR / Lua 脚本** 预扣：扣成功(结果≥0)才放行下单，扣到 ≤0 直接拒绝。绝大多数请求在这一层就被挡回，根本不碰数据库。这是抗住高并发的关键。',
    metric: 'Redis 原子预扣，挡住绝大多数',
    add: [{ id: 'redis', label: 'Redis 库存', role: '原子预扣、抗并发' }],
  },
  {
    stage: '⑤ 异步下单', focus: '把尖峰摊平成平稳的写',
    detail: '预扣成功的请求丢进**消息队列**，订单服务慢慢消费、落库创建订单。这样把瞬时尖峰**削峰填谷**成后端能承受的平稳写入，用户看到"排队中"而不是超时。',
    metric: 'MQ 异步化，削峰填谷',
    add: [{ id: 'mq', label: '消息队列', role: '异步下单、削峰' }, { id: 'order', label: '订单服务', role: '消费落库' }],
  },
  {
    stage: '⑥ 防超卖 + 一致性', focus: '双保险，兜住红线',
    detail: 'DB 扣减用**乐观锁**兜底：`UPDATE stock=stock-1 WHERE id=? AND stock>0`，扣不动就说明卖完。未支付订单**超时释放**库存回 Redis。Redis 原子预扣 + DB 乐观锁双保险，保证绝不超卖。',
    metric: 'Redis 原子 + DB 乐观锁 双保险',
    add: [{ id: 'db', label: '数据库', role: '库存真源、乐观锁兜底' }],
  },
]

export const seckillKernel: Kernel<SysDesignState> = {
  kind: 'seckill',
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
      metric: '削峰(限流+MQ) + 防超卖(Redis原子+DB乐观锁) + 快速失败',
      components: components.map(c => ({ ...c })), phase: 'done',
      log: `**设计完成**：秒杀的三板斧——**削峰**(前端置灰+网关限流+MQ异步)、**防超卖**(Redis原子预扣+DB乐观锁双保险)、**快速失败**(大多数请求早早拒绝、别拖垮系统)。面试加分点：为什么用 Redis 扣库存而不是直接扣 DB(DB 抗不住高并发)、为什么异步下单(把尖峰摊平)、超卖和少卖哪个能忍(少卖可忍、超卖是事故)。这套思路也用在抢票、限量发售。`,
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
