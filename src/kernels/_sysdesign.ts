/**
 * 共享类型：系统设计「讲解式」阶段状态（逐步搭架构）。
 * mqdesign / topk / feed / objectstore 暂时还用这套「组件走图」的形态；
 * 它们会陆续升级成真仿真（见 seckill/urlshortener），全部升级后本文件与 SysDesignStage 一并删除。
 */
export type Comp = { id: string; label: string; role: string }

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
