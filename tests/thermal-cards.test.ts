import { FridgeEncounter, type FridgeFault } from '../game/cards/thermal-encounter.ts'
import { ok } from './harness.ts'

/** 冰箱副本卡牌 = 真热力学求解器的 UI。验:每种真故障有真症状、只有对症卡(经sim重算)才够凉、万金油修不好。 */
export function run() {
  console.log('— 冰箱诊断卡牌(接真热求解器)—')
  const RIGHT: Record<FridgeFault, string> = { coils: 'clean-coils', seal: 'fix-seal', refrigerant: 'refill' }
  const NOOP = ['unplug', 'colder-set']
  const distinct = new Set<string>()
  for (const f of Object.keys(RIGHT) as FridgeFault[]) {
    const e0 = new FridgeEncounter(f)
    ok(!e0.won && e0.symptom() !== '够凉了。', `[${f}] 有真症状:${e0.symptom().slice(0, 20)}…`)
    distinct.add(e0.symptom())
    const eN = new FridgeEncounter(f); const r = eN.play(NOOP[0]!)
    ok(!r.fixed && eN.hp === 2, `[${f}] 万金油「${NOOP[0]}」→ sim 判仍不凉、-1血`)
    const eR = new FridgeEncounter(f); const rr = eR.play(RIGHT[f])
    ok(rr.fixed && eR.won, `[${f}] 对症「${RIGHT[f]}」→ sim 判够凉了 ✓`)
    // 拿错的对症卡也修不好(散热堵却去关门)
    const eW = new FridgeEncounter(f); const wrongCard = f === 'coils' ? 'fix-seal' : 'clean-coils'
    ok(!eW.play(wrongCard).fixed, `[${f}] 拿错的修法「${wrongCard}」→ 修不好(必须诊断对)`)
  }
  ok(distinct.size === 3, '三种故障的症状各不相同(可诊断区分)')
}
