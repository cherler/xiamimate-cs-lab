import { Combat, makeWaves, type Wave } from '../game/cards/combat.ts'
import { NET } from '../game/cards/combat-net.ts'
import { FRIDGE } from '../game/cards/combat-fridge.ts'
import { ok } from './harness.ts'

/**
 * 捣蛋鬼对战 v5 · 领域引擎 + Boss 多层连打 + 关键词连招。测的是:
 * 12 对具名攻防各自对症 + 同层不同招要不同的药;敌人每回合出可见破坏卡(Boss 一回合连打几层);
 * 关键词:反弹(挡下抽一张)/嘲讽(诱饵引开一层)/连锁(修好再抽一张);盘面持续;熬完波次赢、放着输。
 */
const W = (...atks: string[]): Wave => ({ atks })
const pt = (d: Combat, type: string, layer?: string): boolean => { const i = d.hand.indexOf(type); if (i >= 0 && d.canPlay(i, layer)) { d.play(i, layer); return true } return false }

export function run() {
  console.log('— 捣蛋鬼对战 v5 · 领域引擎 + Boss连打 + 关键词 —')

  // 攻防表自洽:每招的对症卡都指回这一招、同一层(防漂移)
  {
    let good = true
    for (const id of Object.keys(NET.attacks)) { const c = NET.attacks[id]!.counter, def = NET.cardDef[c]; if (!def || def.atk !== id || def.layer !== NET.attacks[id]!.layer) good = false }
    ok(good, '12 对攻防自洽:每张对症卡指回它治的那招、那层')
  }

  // 开局:抽5张、3能量、牌库计数;开场就亮出破坏卡(敌人出牌可见)
  {
    const d = new Combat(NET, ['c-poison', 'shield', 'foresee', 'quickfix', 'stabilize', 'c-arp'], [W('arpspoof')])
    ok(d.hand.length === 5 && d.view().energy === 3 && d.view().deckCount === 1, `开局抽5张、3能量、牌库剩1`)
    ok(d.view().enemyCards.length === 1 && d.view().enemyCards[0]!.includes('ARP'), `开场就亮出破坏卡:${d.view().enemyCards[0]}`)
  }

  // 对症修复:link 被 ARP 欺骗 → 出【静态ARP】修好 → 单波熬赢
  {
    const d = new Combat(NET, ['c-arp', 'c-poison', 'shield', 'foresee', 'quickfix'], [W('arpspoof')])
    ok(d.board.link!.broken && d.board.link!.active === 'arpspoof', 'ARP欺骗 → link 坏了、记下是哪招')
    pt(d, 'c-arp'); ok(!d.board.link!.broken && d.won, '静态ARP 对症 → 修好、熬赢')
  }

  // 同层不同招:link 被【ARP欺骗】却出治【MAC洪水】的卡(也在link)→ 白费
  {
    const d = new Combat(NET, ['c-macport', 'c-arp', 'shield', 'foresee', 'quickfix'], [W('arpspoof')])
    const before = d.view().clock; pt(d, 'c-macport')
    ok(d.board.link!.broken && d.view().clock > before, '同层错招(治MAC洪水的药治ARP欺骗)→ 白费、断网涨')
  }

  // 加固照意图挡下一张破坏卡
  {
    const d = new Combat(NET, ['shield', 'c-arp', 'foresee', 'quickfix', 'stabilize'], [W('arpspoof'), W('block')])
    pt(d, 'shield', 'tcp'); d.endTurn(); ok(!d.board.tcp!.broken, '预加固 tcp → 它这张【封端口】被挡')
  }

  // 敌人每回合出可见破坏卡 + 预告下一张
  {
    const d = new Combat(NET, ['c-arp', 'c-port', 'shield', 'foresee', 'quickfix'], [W('arpspoof'), W('block'), W('poison')])
    ok(d.view().intent!.includes('封端口'), `预告下一张:${d.view().intent}`)
    pt(d, 'c-arp'); d.endTurn(); ok(d.view().enemyCards.some(e => e.includes('封端口')), `它这回合打出:${d.view().enemyCards.join(',')}`)
  }

  // 预判:看清接下来两波
  {
    const d = new Combat(NET, ['foresee', 'c-arp', 'shield', 'quickfix', 'stabilize'], [W('arpspoof'), W('block'), W('poison')])
    ok(d.view().foresight.length === 0, '没用预判 → 看不到后手'); pt(d, 'foresee'); ok(d.view().foresight.length === 2, `预判 → 后手两波:${d.view().foresight.join(' / ')}`)
  }

  // 万能急修 + 稳压
  { const d = new Combat(NET, ['quickfix', 'c-poison', 'shield', 'foresee', 'stabilize'], [W('arpspoof')]); pt(d, 'quickfix', 'link'); ok(!d.board.link!.broken && d.won, '万能急修 → 硬修好、熬赢') }
  { const d = new Combat(NET, ['stabilize', 'c-poison', 'shield', 'foresee', 'quickfix'], [W('skew')]); ok(d.board.phys!.decay > 0, '调歪光模块 → 恶化中'); pt(d, 'stabilize'); ok(d.board.phys!.decay === 0, '稳压 → 压住恶化') }

  // 持续盘面 + 恶化到顶崩
  { const d = new Combat(NET, NET.startDeck, [W('arpspoof'), W('wipe')]); d.endTurn(); ok(d.board.link!.broken, '没修的 link → 下回合还坏着') }
  { const d = new Combat(NET, NET.startDeck, [W('skew'), W('block'), W('wipe')]); ok(d.board.phys!.decay > 0 && !d.board.phys!.broken, '恶化但没崩'); d.endTurn(); d.endTurn(); ok(d.board.phys!.broken, '拖着不稳压 → 恶化到顶,物理层崩') }

  // —— Boss:一回合连打多层 ——
  {
    const d = new Combat(NET, NET.startDeck, [W('poison'), { atks: ['arpspoof', 'block', 'forge'], boss: true }])
    d.endTurn() // 打出 Boss 那一波
    const v = d.view()
    ok(d.board.link!.broken && d.board.tcp!.broken && d.board.tls!.broken, 'Boss 一回合连打 3 层(链路+传输+加密全坏)')
    ok(v.enemyCards.length === 3, `Boss 出了 ${v.enemyCards.length} 张破坏卡`)
  }
  {
    let k = 0; const cyc = (n: number) => k++ % n
    const ws = makeWaves(NET, 'boss', cyc)
    ok(ws.length === 6 && ws.some(w => w.boss) && ws[5]!.atks.length === 3, `makeWaves(boss) → 6 波、末波三连打(${ws[5]!.atks.length} 层)`)
  }

  // —— 关键词:嘲讽诱饵 ——
  {
    const d = new Combat(NET, ['k-taunt', 'c-arp', 'shield', 'foresee', 'stabilize'], [W('arpspoof'), W('block')])
    pt(d, 'k-taunt'); ok(d.view().decoy, '嘲讽 → 诱饵布好')
    d.endTurn(); ok(!d.board.tcp!.broken, '诱饵引开了它下一波的【封端口】——tcp 没坏')
  }

  // —— 关键词:反弹加固(挡下顺手抽一张)——
  {
    const d = new Combat(NET, ['k-reflect', 'c-arp', 'shield', 'foresee', 'stabilize', 'c-poison', 'c-forge'], [W('arpspoof'), W('block')])
    pt(d, 'k-reflect', 'tcp'); d.endTurn()
    ok(!d.board.tcp!.broken && d.hand.length === 6, `反弹加固挡下【封端口】+ 顺手多抽一张(手牌 ${d.hand.length})`)
  }

  // —— 关键词:连锁维修(修好顺手再抽一张)——
  {
    const d = new Combat(NET, ['k-chain', 'c-poison', 'shield', 'foresee', 'stabilize', 'c-forge'], [W('arpspoof')])
    const before = d.view().deckCount; pt(d, 'k-chain', 'link')
    ok(!d.board.link!.broken && d.view().deckCount === before - 1, `连锁维修 → 修好 link + 连锁抽一张(牌库 ${before}→${d.view().deckCount})`)
  }

  // —— 真求解器·网络:总成败由 DnsSim 判 ——
  {
    const d = new Combat(NET, ['c-poison', 'shield', 'foresee', 'quickfix', 'stabilize'], [W('poison')])
    ok(!d.connected() && d.view().metric.includes('错地址'), `DnsSim 真判:投毒缓存 → 真解析拿到错地址、连不上(${d.view().metric})`)
    pt(d, 'c-poison'); ok(d.connected() && d.won, '清缓存 → DnsSim 真解析通 → 连上、赢')
  }

  // —— 真求解器·冰箱:够不够凉由 solveThermal 算,多故障真叠加 ——
  {
    const d = new Combat(FRIDGE, FRIDGE.startDeck, [W('gasket')])
    ok(!d.connected() && d.view().metric.includes('℃'), `solveThermal 真算:抠门封漏冷 → 柜内超标不够凉(${d.view().metric})`)
    const before = d.view().metric; pt(d, 'f-gasket'); ok(d.connected() && d.won, `换密封条 → 真算够凉(${before} → ${d.view().metric})`)
  }
  {
    const num = (s: string) => parseFloat(s.match(/柜内 ([\-\d.]+)/)![1]!)
    const one = new Combat(FRIDGE, FRIDGE.startDeck, [W('gasket')])
    const two = new Combat(FRIDGE, FRIDGE.startDeck, [{ atks: ['gasket', 'clog'] }])
    ok(num(two.view().metric) > num(one.view().metric), `多故障 solveThermal 真叠加:糊散热+抠门封(${num(two.view().metric)}℃)比只抠门封(${num(one.view().metric)}℃)更热`)
  }

  // —— 平衡:断网按「坏几层」加压(Boss 连打飙得快)——
  {
    const one = new Combat(NET, NET.startDeck, [W('arpspoof')]); one.endTurn()
    const three = new Combat(NET, NET.startDeck, [{ atks: ['arpspoof', 'block', 'wipe'] }]); three.endTurn()
    ok(three.view().clock >= one.view().clock * 2, `断网按坏层数加压:3层坏(${three.view().clock}%)远比 1层坏(${one.view().clock}%)疼`)
  }

  // —— 关键词:群修 / 缓冲 / 铁壁(应对 Boss 连打)——
  {
    const d = new Combat(NET, ['k-aoe', 'shield', 'foresee', 'stabilize', 'c-poison'], [{ atks: ['arpspoof', 'block', 'wipe'] }])
    ok(!d.connected(), '开场三层坏'); pt(d, 'k-aoe'); ok(d.connected() && d.won, '群修「一键复位」→ 三层一口气修好、连上')
  }
  {
    const d = new Combat(NET, ['c-poison', 'shield', 'foresee', 'stabilize', 'quickfix', 'k-buffer'], [W('arpspoof')])
    d.endTurn(); const before = d.view().clock
    ok(before > 0 && d.hand.includes('k-buffer'), `攒了断网 ${before}%、抽到抢修缓冲`)
    pt(d, 'k-buffer'); ok(d.view().clock < before, `缓冲「抢修缓冲」→ 断网回退(${before}% → ${d.view().clock}%)`)
  }
  {
    const d = new Combat(NET, ['k-bulwark', 'c-poison', 'foresee', 'stabilize', 'quickfix'], [W('poison'), { atks: ['arpspoof', 'block', 'wipe'] }])
    pt(d, 'c-poison'); pt(d, 'k-bulwark'); d.endTurn()
    ok(!d.board.link!.broken && !d.board.tcp!.broken && !d.board.ip!.broken, '铁壁「全栈加固」→ Boss 三连全被挡下')
  }

  // 熬完波次 + 连上 → 赢(驱动:读盘面当前是哪招 → 出对应对症卡)
  {
    const d = new Combat(NET, NET.startDeck.concat(NET.startDeck), [W('arpspoof'), W('block'), W('wipe')])
    for (let t = 0; t < 40 && !d.won && !d.lost; t++) {
      for (const l of NET.layers) { const st = d.board[l]!; if (st.broken || st.decay > 0) { const cty = st.active ? NET.attacks[st.active]!.counter : null; if (!(cty && pt(d, cty))) pt(d, 'quickfix', l) } }
      d.endTurn()
    }
    ok(d.won, `逐招对症化解 → 熬赢(断网 ${d.view().clock}%)`)
  }

  // 放着不管 → 断网满 → 输
  { const d = new Combat(NET, NET.startDeck, [W('arpspoof')]); for (let i = 0; i < 15 && !d.lost; i++) d.endTurn(); ok(d.lost && d.view().clock >= 100, '一直不修 → 断网满 → 输') }
}
