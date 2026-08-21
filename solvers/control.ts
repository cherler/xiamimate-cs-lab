/**
 * 温控求解器 —— 副本"控制"层的真理源。
 * 反转：修好散热后柜子会制冷，但"够冷"不是越冷越好——
 * 窗口设到冰点以下，疫苗一样冻废。正解是把窗口卡在 2–8℃。
 * 边界：只判窗口落点是否安全 + 制冷能否够着，不建模迟滞振荡的动态过程。
 */
/** 疫苗冷链安全区（WHO 冷链标准，真事，不是拍的） */
export const VACCINE_OK = { lo: 2, hi: 8 } as const

export type ControlInput = {
  setLow: number       // 温控窗口下界 ℃
  setHigh: number      // 温控窗口上界 ℃
  coolingFloor: number // 制冷系统能达到的最低温 ℃（够不够得着窗口）
}
export type ControlSolved = {
  frozen: boolean      // 窗口触到冰点 → 冻坏
  tooWarm: boolean     // 窗口高于安全上限 → 太热
  reachable: boolean   // 制冷够得着这个窗口
  safe: boolean        // 整体安全
  notes: string[]
}
export function solveControl(i: ControlInput): ControlSolved {
  const frozen = i.setLow <= 0
  const tooWarm = i.setHigh > VACCINE_OK.hi
  const reachable = i.coolingFloor <= i.setHigh
  const inWindow = i.setLow >= VACCINE_OK.lo && i.setHigh <= VACCINE_OK.hi && i.setLow < i.setHigh
  const safe = inWindow && reachable && !frozen && !tooWarm
  const notes = [
    `温控窗口 ${i.setLow}–${i.setHigh} ℃；疫苗安全区 ${VACCINE_OK.lo}–${VACCINE_OK.hi} ℃。`,
  ]
  if (frozen) notes.push('窗口下界在冰点以下——疫苗会冻坏，跟热坏一样报废。')
  else if (tooWarm) notes.push('窗口上界高于 8℃——压不到疫苗要求，太热。')
  else if (safe) notes.push('窗口稳稳落在 2–8℃，安全。')
  return { frozen, tooWarm, reachable, safe, notes }
}
