import { DnsSim } from '../solvers/dns/sim.ts'
import { DnsEncounter, symptomOf, SITE } from '../game/cards/dns-encounter.ts'
import type { FaultKind } from '../solvers/dns/state.ts'
import { ok } from './harness.ts'

/**
 * 卡牌遭遇战 = 真求解器的 UI。验:每种真故障有真症状,只有对症那张卡(经 sim 重判)才修得好,
 * 万金油/无关卡修不好。症状和成败都不是写死的——由 sim 说了算。
 */
export function run() {
  console.log('— DNS 诊断卡牌(接真求解器)—')

  // 无故障基线:SITE 本就能正确解析(否则整关立不住)
  ok(new DnsSim().query(SITE).correct === true, `${SITE} 无故障时能正确解析(基线)`)

  // 每种真故障 → 对症的那张卡
  const RIGHT: Partial<Record<FaultKind, string>> = {
    'server-down': 'switch-dns',
    'server-slow': 'raise-timeout',
    'poisoned-cache': 'clear-cache',
    'ttl-too-long': 'clear-cache',
    'hosts-hijack': 'fix-hosts',
  }
  const NOOP = ['reboot', 'bandwidth'] // 治不了任何故障的万金油

  for (const fault of Object.keys(RIGHT) as FaultKind[]) {
    // 有真症状(不是"通了")
    const e0 = new DnsEncounter(fault)
    ok(!e0.won && e0.symptom() !== '通了。', `[${fault}] 有真症状:${e0.symptom().slice(0, 22)}…`)

    // 万金油修不好(sim 重判仍失败、扣血)
    const eN = new DnsEncounter(fault)
    const r = eN.play(NOOP[0]!)
    ok(!r.fixed && eN.hp === 2, `[${fault}] 出万金油「${NOOP[0]}」→ sim 判仍没好、-1血`)

    // 对症的那张卡 → sim 重判真的通了
    const eR = new DnsEncounter(fault)
    const rr = eR.play(RIGHT[fault]!)
    ok(rr.fixed && eR.won, `[${fault}] 对症「${RIGHT[fault]}」→ sim 判通了 ✓`)
  }

  // symptomOf 纯函数:通了就是"通了。"
  ok(symptomOf(new DnsSim().query(SITE)) === '通了。', 'symptomOf:正确结果=通了')

  // 血扣光会输:连出两张万金油(3血→1),第三张→0
  const e = new DnsEncounter('server-down')
  e.play('reboot'); e.play('bandwidth')
  ok(e.hp === 1 && !e.won, '连出两张万金油 → 血扣到1、还没通')
}
