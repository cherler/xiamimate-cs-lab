import { ThermalDuel } from '../game/cards/thermal-duel.ts'
function playthrough(name: string, initial: any, moves: string[]) {
  console.log(`\n═══ ${name}(开局故障:${JSON.stringify(initial)})═══`)
  const d = new ThermalDuel(initial)
  console.log(`  起手 柜内${d.inside.toFixed(1)}℃  变质0%  真故障[${[...d.faults]}]`)
  for (const m of moves) {
    if (d.won || d.lost) break
    const s = d.play(m)
    console.log(`  t${s.turn} 「${m}」→ 柜内${s.inside}℃ 变质${s.spoil}% 故障[${s.faults}] ${s.won ? '🎉赢' : s.lost ? '💀输' : ''}`)
    if (s.events.length) console.log(`        ${s.events.join(' / ')}`)
  }
  const f = d.snapshot()
  console.log(`  结局:${f.won ? '🎉修好' : f.lost ? '💀全变质' : '(未完)'} · ${f.turn}回合 · 变质${f.spoil}%`)
}
playthrough('高效诊断', ['coils'], ['probe-condenser', 'clean-coils', 'wait', 'wait', 'wait'])
playthrough('盲修乱试→触发反扑', ['coils'], ['fix-seal', 'refill', 'wait', 'clean-coils', 'probe-pump', 'rest-compressor', 'wait', 'wait', 'wait', 'wait'])
playthrough('双重故障', ['coils', 'seal'], ['probe-condenser', 'clean-coils', 'probe-load', 'fix-seal', 'wait', 'wait', 'wait'])
