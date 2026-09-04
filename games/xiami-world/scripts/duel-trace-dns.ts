import { DnsDuel } from '../game/cards/dns-duel.ts'
function run(name: string, initial: any, moves: string[]) {
  console.log(`\n═══ ${name}(故障:${initial})═══`)
  const d = new DnsDuel(initial)
  console.log(`  起手:${d.snapshot().status}  真故障=${d.root}`)
  for (const m of moves) {
    if (d.won || d.lost) break
    const s = d.play(m)
    console.log(`  t${s.turn} 「${m}」→ ${s.ok ? '通了' : '打不开'} 断网${s.downtime}% ${s.won ? '🎉' : s.lost ? '💀' : ''}${s.entrenched ? ' [顽固]' : ''}`)
    if (s.events.length) console.log(`        ${s.events.join(' / ')}`)
  }
  const f = d.snapshot()
  console.log(`  结局:${f.won ? '🎉修好' : f.lost ? '💀断网太久' : '(未完)'} · ${f.turn}回合 · 断网${f.downtime}%`)
}
run('服务器挂了', 'server-down', ['probe-server', 'switch-dns'])
run('缓存被投毒·高效', 'poisoned-cache', ['probe-cache', 'clear-cache'])
run('缓存被投毒·拖太久触发反扑', 'poisoned-cache', ['probe-server', 'probe-hosts', 'wait', 'clear-cache', 'clear-cache', 'switch-dns', 'clear-cache'])
run('hosts 被劫持', 'hosts-hijack', ['probe-cache', 'probe-hosts', 'edit-hosts'])
run('TTL 过长', 'ttl-too-long', ['probe-cache', 'clear-cache'])
run('服务器慢', 'server-slow', ['probe-server', 'raise-timeout'])
