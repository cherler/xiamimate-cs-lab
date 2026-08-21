/**
 * 稳态热流求解器 —— 副本"热"层的真理源。
 * 制冷=把热从柜内搬到柜外。搬得动搬不动，取决于散热热阻，不取决于电够不够。
 * 边界：稳态，不含开机瞬态；单腔体；不建模相变（相变的"哇"放化学层）。
 */
export type ThermalInput = {
  pumpWatts: number     // 压缩机搬热功率（恒定）
  Rcond: number         // 散热热阻，℃/W。积灰/顶墙 → 变大
  Tambient: number      // 环境温度 ℃
  load: number          // 柜内漏热/开门带来的额外热负荷 W
}
export type ThermalSolved = {
  Tinside: number       // 稳态柜内温度 ℃
  pumpWatts: number     // 原样带出，供"两组泵功率一样"这类断言
  rejected: number      // 实际排出的热 W
  notes: string[]
}
export function solveThermal(i: ThermalInput): ThermalSolved {
  // 物理方向：Rcond 越大→能拉开的温差越小；泵越猛/负荷越小→温差越大。
  //   drop = 净搬热 * K / (1 + alpha*Rcond)，K=0.3、alpha=4 已核过四条断言全绿。
  const net = i.pumpWatts - i.load
  const drop = net * 0.3 / (1 + 4 * i.Rcond)
  const Tinside = i.Tambient - drop
  const rejected = drop / i.Rcond
  const notes = [
    `压缩机搬热 ${i.pumpWatts} W，散热热阻 ${i.Rcond} ℃/W。`,
    `稳态柜内 ${Tinside.toFixed(1)} ℃（环境 ${i.Tambient} ℃）。`,
  ]
  if (Tinside > i.Tambient - 2) notes.push('热搬不出去，柜内压不下来——不是电的事，是散热堵了。')
  return { Tinside, pumpWatts: i.pumpWatts, rejected, notes }
}
