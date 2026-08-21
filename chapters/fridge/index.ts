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
  experiment: {
    correctVar: 'Rcond',
    vars: [
      { id: 'Rcond',    name: '散热热阻', patchA: { Rcond: 0.5 } as Partial<ThermalInput>,   patchB: { Rcond: 0.05 } as Partial<ThermalInput>,  labelA: '堵着', labelB: '通着' },
      { id: 'Tambient', name: '环境温度', patchA: { Tambient: 30 } as Partial<ThermalInput>, patchB: { Tambient: 42 } as Partial<ThermalInput>, labelA: '30℃', labelB: '42℃' },
      { id: 'load',     name: '柜内负荷', patchA: { load: 0 } as Partial<ThermalInput>,      patchB: { load: 40 } as Partial<ThermalInput>,     labelA: '空',   labelB: '塞满' },
    ],
  },
  /** 跑一次对照：只改选中的变量，其余锁死初始态；两组的柜内温度都从求解器取 */
  runExperiment(varId: string): { endA: number; endB: number; labelA: string; labelB: string; name: string } {
    const v = this.experiment.vars.find(x => x.id === varId)!
    const endA = solveThermal({ ...this.initial, ...v.patchA }).Tinside
    const endB = solveThermal({ ...this.initial, ...v.patchB }).Tinside
    return { endA, endB, labelA: v.labelA, labelB: v.labelB, name: v.name }
  },
}
