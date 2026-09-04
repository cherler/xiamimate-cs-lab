/**
 * 冰箱副本 · 诊断卡牌遭遇战 —— 接真热力学求解器(证明"换电器=换求解器+动作卡")。
 *
 * 和 DNS 副本同一套规则:注入一种**真故障**(散热堵/门封漏/缺制冷剂)→ solveThermal 算出**真症状**
 * (从柜内温 + 散热片温读)→ 出卡=改一个**真参数** → 重算 → **由 sim 判**够不够凉。
 * 三种故障靠"散热片温度"区分:堵了烫死、门封漏不烫、缺剂反而凉——玩家读真现象诊断,不给答案。
 */
import { solveThermal, type ThermalInput } from '../../solvers/thermal.ts'
import type { Encounter, Card, PlayResult } from './encounter.ts'

export type FridgeFault = 'coils' | 'seal' | 'refrigerant'
const HEALTHY: ThermalInput = { pumpWatts: 100, Rcond: 0.1, Tambient: 25, load: 10 }
const FAULTS: Record<FridgeFault, Partial<ThermalInput>> = {
  coils: { Rcond: 1.0 },      // 散热片积灰/顶墙 → 热阻大 → 搬得出散不掉 → 散热片烫死
  seal: { load: 95 },         // 门没关严/密封条坏 → 漏热大 → 压不下来,但散热片不烫
  refrigerant: { pumpWatts: 15 }, // 缺制冷剂/压缩机弱 → 根本没使劲搬 → 不凉,散热片也凉
}
const ACTIONS: (Card & { apply: (st: ThermalInput) => void })[] = [
  { id: 'clean-coils', name: '清理散热片 / 挪开离墙', note: '降低散热热阻', apply: st => { st.Rcond = 0.1 } },
  { id: 'fix-seal', name: '关严门 / 换密封条', note: '堵住漏进来的热', apply: st => { st.load = 10 } },
  { id: 'refill', name: '加制冷剂 / 修压缩机', note: '恢复搬热功率', apply: st => { st.pumpWatts = 100 } },
  { id: 'unplug', name: '拔电重启', note: '万金油?搬热还是搬不动', apply: () => {} },
  { id: 'colder-set', name: '把温度调更低', note: '设定更低?搬不动就是搬不动', apply: () => {} },
]
const COLD = 8 // ℃:柜内到这个温度算够凉

export class FridgeEncounter implements Encounter {
  title = '冰箱 · 不制冷'
  goal = '让柜内降到 8℃ 以下'
  cards: Card[] = ACTIONS.map(a => ({ id: a.id, name: a.name, note: a.note }))
  st: ThermalInput
  fault: FridgeFault
  hp = 3
  won = false

  constructor(faultOrSeed: FridgeFault | number) {
    const kinds: FridgeFault[] = ['coils', 'seal', 'refrigerant']
    this.fault = typeof faultOrSeed === 'number' ? kinds[Math.abs(faultOrSeed) % 3]! : faultOrSeed
    this.st = { ...HEALTHY, ...FAULTS[this.fault] }
  }
  private solve() { return solveThermal(this.st) }

  symptom(): string {
    const r = this.solve()
    if (r.Tinside <= COLD) return '够凉了。'
    const t = r.Tinside.toFixed(0), c = r.condenserTemp.toFixed(0)
    if (r.condenserTemp >= 80) return `柜里不凉(${t}℃),伸手摸后背散热片——烫得吓人(${c}℃)。热搬出来了,却散不掉。`
    if (r.condenserTemp >= 32) return `柜里不凉(${t}℃),可散热片不太热(${c}℃),门缝那儿有凉气往外冒。`
    return `柜里不凉(${t}℃),散热片也不怎么热(${c}℃)——像根本没在使劲搬热。`
  }

  play(cardId: string): PlayResult {
    const a = ACTIONS.find(x => x.id === cardId)
    if (!a || this.won || this.hp <= 0) return { fixed: this.won, symptom: this.symptom(), won: this.won, hp: this.hp }
    a.apply(this.st)
    const cold = this.solve().Tinside <= COLD
    if (cold) this.won = true; else this.hp--
    return { fixed: cold, symptom: this.symptom(), won: this.won, hp: this.hp }
  }
}
