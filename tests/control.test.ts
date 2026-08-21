import { solveControl } from '../solvers/control.ts'
import { ok } from './harness.ts'
export function run() {
  console.log('— 控制求解器 —')
  // 窗口设太低：会把柜内拉到冰点以下 → 判定"冻坏"
  const tooCold = solveControl({ setLow: -4, setHigh: -1, coolingFloor: -6 })
  ok(tooCold.frozen, '窗口设在冰点以下 → 疫苗冻坏')
  ok(!tooCold.safe, '冻坏 = 不安全')
  // 正确窗口 2–8℃：稳定、不冻、不热
  const good = solveControl({ setLow: 3, setHigh: 6, coolingFloor: -6 })
  ok(good.safe && !good.frozen && !good.tooWarm, '2–8℃ 窗口安全')
  // 窗口太高：压不到疫苗要求 → 太热
  const tooWarm = solveControl({ setLow: 10, setHigh: 14, coolingFloor: -6 })
  ok(tooWarm.tooWarm && !tooWarm.safe, '窗口太高 → 太热，一样不安全')
}
