/**
 * 遭遇战通用接口 —— 卡牌壳的"整屋通用"就靠它:每个电器实现一个 Encounter,
 * 同一套卡牌 UI 跑任意 Encounter。换电器 = 换求解器 + 换动作卡,规则不动。
 * 症状与成败都来自各自背后的真求解器(守铁律"仿真是核心")。
 */
export type Card = { id: string; name: string; note: string }
export type PlayResult = { fixed: boolean; symptom: string; won: boolean; hp: number }

export interface Encounter {
  title: string          // 例:路由器 · 网页打不开
  goal: string           // 例:让 https 网页打开
  cards: Card[]          // 手牌(对症的 + 干扰的)
  hp: number
  won: boolean
  symptom(): string      // 由真求解器算出的真症状(不点名答案)
  play(cardId: string): PlayResult
}
