/**
 * 多回合"对战"的通用契约 —— 整屋通用就靠它:每个电器实现一个 Duel,同一套回合制 UI 跑任意副本。
 * 换电器 = 换求解器 + 换探针/处置卡,回合制外壳(状态面板/证据盘/时钟/手牌/小修)完全复用。
 * ThermalDuel(冰箱·热力学)、DnsDuel(路由器·DNS)都产出同一个 DuelView 交给壳去画。
 */
export type DuelKind = 'probe' | 'fix' | 'wait'
export type DuelCard = { id: string; kind: DuelKind; name: string; note: string }

/** 证据盘的一格。value=null=还没探到(显示 ?);ref=正常参考;off=偏离正常(标红);plain=大白话解读(小修念给玩家听,不用术语)。 */
export type DuelReading = { label: string; value: string | null; ref?: string; off?: boolean; plain?: string }

export type DuelView = {
  title: string                                  // 例:冰箱 · 不制冷 / 路由器 · 网页打不开
  statusLabel: string; statusValue: string; statusOk: boolean // 主读数(柜内温 / 网页状态)
  clockLabel: string; clock: number; clockHint: string        // 压力(变质 / 断网)0..100
  readings: DuelReading[]                        // 证据盘(探到才亮真值)
  turn: number; won: boolean; lost: boolean; events: string[]
  wonText: string; lostText: string              // 各自措辞的结局
}

/** 工具箱修饰符 —— 跨电器通用的"build"就靠它插进任意副本(引擎级,不碰电器专属处置卡)。 */
export type RunMods = {
  clockMul: number          // 时钟(变质/断网)每回合涨幅倍率,<1=更慢(缓冲垫/保鲜箱)
  startReveals: number      // 开局白送几个读数(老师傅的直觉)
  autoRevealPerTurn: number // 每回合自动亮一个未探到的读数(监控仪)
}
export const NO_MODS: RunMods = { clockMul: 1, startReveals: 0, autoRevealPerTurn: 0 }

export interface Duel {
  won: boolean
  lost: boolean
  hand(): DuelCard[]      // 当前手牌(探针/处置/等待)
  play(cardId: string): void
  view(): DuelView        // 交给回合制外壳去画的一切
  revealOne(): boolean    // 亮一个还没探到的读数(工具用);没有可亮的返回 false
  easeClock(amount: number): void // 把时钟压低一截(急救包消耗品)
}
