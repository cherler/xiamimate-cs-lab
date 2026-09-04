import { Saboteur, ATTACK_POOL } from '../game/cards/saboteur.ts'
import { ok } from './harness.ts'

/**
 * 捣蛋鬼对战 · 骨架。测的是"真敌人 + 真攻防":破坏卡注真故障(sim 判打不开)、亮意图、
 * 挡对(对应卡)掉士气、挡错方向白折腾飙断网、熬光士气才赢、断网满就输。
 * 破坏↔对应这一对一对必须对得上(=要教的知识),错一个都算错。
 */
const RIGHT: Record<string, string> = {
  'poisoned-cache': 'clear-cache', 'ttl-too-long': 'clear-cache', 'hosts-hijack': 'edit-hosts',
  'server-down': 'switch-dns', 'server-slow': 'raise-timeout',
}

export function run() {
  console.log('— 捣蛋鬼对战(骨架)—')

  // 开场:它已经出了一招(网页打不开)、亮了下一招的意图、士气满
  {
    const d = new Saboteur(['poisoned-cache', 'hosts-hijack', 'server-down'])
    const v = d.view()
    ok(!v.systemOk && v.activeName!.includes('投毒') && v.morale === 3, `开场:它已投毒、网页打不开、士气3(${v.activeName})`)
    ok(v.intent!.includes('改 hosts'), `亮了下一招意图:${v.intent}`)
  }

  // 破坏卡=真故障、对应卡=真防御,一对一对得上(每种攻击,对症那张才挡得下、士气才掉)
  for (const atk of ATTACK_POOL) {
    const d = new Saboteur([atk])
    const v = d.play(RIGHT[atk]!)
    ok(v.won && v.systemOk, `[${atk}] 对应卡「${RIGHT[atk]}」→ 真 sim 判挡下、熬光士气赢了`)
  }

  // 挡错方向:士气不掉、断网飙升(拆错代价大,逼你懂哪张才对)
  {
    const d = new Saboteur(['poisoned-cache', 'hosts-hijack'])
    const before = d.view().clock
    const v = d.play('edit-hosts') // 投毒它却去删 hosts = 拆错方向
    ok(v.morale === 2 && !v.systemOk && v.clock > before + 30, `挡错方向:士气没掉、断网从 ${before} 飙到 ${v.clock}`)
  }

  // 见招拆招全挡对 → 熬光士气 → 赢
  {
    const d = new Saboteur(['server-down', 'poisoned-cache', 'hosts-hijack'])
    for (const m of ['switch-dns', 'clear-cache', 'edit-hosts']) if (!d.won && !d.lost) d.play(m)
    ok(d.won && d.view().morale === 0, `逐招挡对 → 士气0、捣蛋鬼跑了(断网${d.view().clock}%)`)
  }

  // 一直挡错 → 断网满 → 输
  {
    const d = new Saboteur(['poisoned-cache', 'hosts-hijack', 'server-slow'])
    for (let i = 0; i < 6 && !d.lost && !d.won; i++) d.play('switch-dns') // 一律拆错方向
    ok(d.lost && d.view().clock >= 100, `一直拆错 → 断网满 100% → 被它得逞,输`)
  }

  // 挡对一招后,它随即又出下一招(对战不停)
  {
    const d = new Saboteur(['poisoned-cache', 'hosts-hijack'])
    const v = d.play('clear-cache')
    ok(v.morale === 1 && v.events.some(e => e.includes('又出手')) && v.activeName!.includes('hosts'), '挡下一招 → 它立刻又出下一招(改 hosts)')
  }
}
