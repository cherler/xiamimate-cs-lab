import { solveThermal } from '../solvers/thermal.ts'
import { ok } from './harness.ts'
export function run() {
  console.log('— 热求解器 —')
  // 通畅：低热阻，柜温压到接近环境以下
  const clear = solveThermal({ pumpWatts: 90, Rcond: 0.05, Tambient: 30, load: 0 })
  ok(clear.Tinside < 8, `散热通畅时柜内应压到 8℃ 以下（实测 ${clear.Tinside.toFixed(1)}）`)
  // 堵塞：热阻放大 10 倍，柜温压不下来（这就是"通着电却是热的"）
  const blocked = solveThermal({ pumpWatts: 90, Rcond: 0.5, Tambient: 30, load: 0 })
  ok(blocked.Tinside > clear.Tinside + 10, `堵塞后柜内明显更热（${clear.Tinside.toFixed(1)}→${blocked.Tinside.toFixed(1)}）`)
  // 题眼：同样通着电、同样泵功率，只因散热被堵，结果天差地别
  ok(blocked.pumpWatts === clear.pumpWatts, '两组泵功率一样——变的只有散热')
  // 控制变量：只调环境温这一个变量，别的锁死（给"对照实验"用）
  const a = solveThermal({ pumpWatts: 90, Rcond: 0.05, Tambient: 30, load: 0 })
  const b = solveThermal({ pumpWatts: 90, Rcond: 0.05, Tambient: 42, load: 0 })
  ok(b.Tinside > a.Tinside, '环境更热 → 柜内更热（单变量对照可复现）')
}
