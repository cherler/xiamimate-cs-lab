import { solveThermal, type ThermalInput } from '../../solvers/thermal.ts'

/** 副本《冷藏柜通着电却是热的》的配置。部件温度全从求解器取，不手绘。 */
export const FRIDGE = {
  id: 'clinic',
  // 初始态：散热被积灰堵住（高热阻）→ 柜里热、散热片烫
  initial: { pumpWatts: 90, Rcond: 0.5, Tambient: 30, load: 0 } as ThermalInput,
  parts: [
    { id: 'compressor', name: '压缩机', x: 300, y: 400 },
    { id: 'inside',     name: '柜内',   x: 560, y: 300 },
    { id: 'condenser',  name: '散热片', x: 860, y: 400 },
  ] as { id: string; name: string; x: number; y: number }[],
  anomalyPart: 'condenser',
  /** 某部件此刻的温度——从 solveThermal 取，是"真理源" */
  tempOfPart(id: string, input: ThermalInput): number {
    const s = solveThermal(input)
    if (id === 'inside') return s.Tinside
    if (id === 'condenser') return s.condenserTemp
    return (s.Tinside + s.condenserTemp) / 2
  },
}
