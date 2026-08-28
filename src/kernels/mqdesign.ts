/**
 * 内核：系统设计 · 设计消息队列（后端 · 系统设计面试高频，对标 Kafka）
 * 轴：step —— 从需求到架构，一步一个设计决策，讲清「解耦 + 削峰 + 不丢消息」
 *
 * 消息队列是系统设计三大高频题之一(与短链、秒杀并列)。它考的是:怎么用一条
 * append-only 日志把生产者和消费者解耦,做到高吞吐、可回放、不丢消息。
 * 复用「需求→估算→核心→扩展→权衡」框架,值可核:每步一个真实决策
 * (分区顺序日志、消费组+offset、副本+ack、按 key 路由)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'
import type { SysDesignState } from './_sysdesign.ts'

type Comp = { id: string; label: string; role: string }
type Frame = Omit<SysDesignState, 'i'>

const STAGES: { stage: string; focus: string; detail: string; metric: string; add?: Comp[] }[] = [
  {
    stage: '① 需求澄清', focus: '为什么要消息队列：解耦、削峰、不丢',
    detail: '生产者和消费者别直接调用——中间放一层队列。好处：**解耦**(两边独立扩缩)、**削峰**(突发流量先堆队列、消费端平稳处理)、**异步**(生产者发完就返回)。红线：消息**不能丢**、要能**重放**。',
    metric: '解耦 + 削峰 + 异步 + 不丢可重放',
    add: [{ id: 'producer', label: '生产者', role: '发消息' }],
  },
  {
    stage: '② 容量估算', focus: '高吞吐写、顺序读',
    detail: '典型场景写入量极大(日志/埋点/订单流)，读也多但模式简单(顺序消费)。关键是**顺序写磁盘**(比随机写快几个量级)、批量+零拷贝拉取，用普通磁盘扛住高吞吐。',
    metric: '顺序写扛高吞吐，读是顺序拉取',
    add: [{ id: 'broker', label: 'Broker', role: '存储与转发' }],
  },
  {
    stage: '③ 核心模型：分区顺序日志', focus: 'Topic → Partition → append-only 日志',
    detail: '消息按 **Topic** 分类，每个 Topic 拆成多个 **Partition**。每个分区就是一个**只追加的日志文件**(append-only log)，消息尾部追加、各有一个递增 **offset**(偏移量)。顺序写=快，offset=天然的位置标记。',
    metric: 'Topic/Partition/append-only log + offset',
    add: [{ id: 'partition', label: 'Partition 日志', role: '顺序追加、offset 定位' }],
  },
  {
    stage: '④ 消费模型：消费组 + offset', focus: '各组独立进度，重放靠 offset',
    detail: '**消费组(Consumer Group)**：同组内一个分区只被一个消费者读(负载均衡)，不同组各自独立消费同一份数据。进度用 **offset** 记录——想重放历史，把 offset 回退即可。消息读完**不删**，按时间/大小过期。',
    metric: '消费组负载均衡 + offset 可回放',
    add: [{ id: 'group', label: '消费组', role: '独立进度、可重放' }, { id: 'consumer', label: '消费者', role: '拉取处理' }],
  },
  {
    stage: '⑤ 可靠性：副本 + ack', focus: '不丢消息怎么保证',
    detail: '每个分区有多个**副本(Replica)**，一个 Leader 多个 Follower，写入同步到 ISR(同步副本集)才算成功。生产者 **ack** 策略：ack=0(最快、可能丢)、ack=1(Leader 落盘)、ack=all(ISR 都确认、最稳)。Leader 挂了从 ISR 选新 Leader。',
    metric: '多副本 + ack=all + ISR 选主',
    add: [{ id: 'replica', label: '副本(ISR)', role: '不丢、故障转移' }],
  },
  {
    stage: '⑥ 顺序与扩展', focus: '分区内有序，按 key 路由',
    detail: '**顺序保证**：只保证**单个分区内**有序，跨分区不保证。要让同类消息有序(如同一订单)，用 **key 哈希路由**到固定分区。**扩展**：加分区、加 Broker 提吞吐；消费不过来就加同组消费者(≤分区数)。',
    metric: '分区内有序 + key 路由 + 加分区扩容',
    add: [{ id: 'router', label: 'key 路由', role: '同 key 同分区、保序' }],
  },
]

export const mqdesignKernel: Kernel<SysDesignState> = {
  kind: 'mqdesign',
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
      metric: '分区顺序日志 + 消费组offset + 多副本ack + key路由',
      components: components.map(c => ({ ...c })), phase: 'done',
      log: `**设计完成**：消息队列的骨架——**分区 append-only 日志**(顺序写=高吞吐)、**消费组 + offset**(独立消费、可重放)、**多副本 + ack**(不丢)、**key 路由**(分区内保序)。面试加分点：为什么顺序写快(避免随机 I/O)、至少一次 vs 精确一次(重复 vs 幂等消费)、推 vs 拉(拉能让消费者控制速率)、消息堆积怎么监控(消费 lag = 最新 offset − 已消费 offset)。这就是 Kafka/RocketMQ 的核心思路。`,
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
