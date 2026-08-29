import { StackBattle, LAYERS, LAYER_INFO } from '../game/cards/stack.ts'
import { ok } from './harness.ts'

/**
 * 连接栈 · 捣蛋鬼跨层对战(三合一:对战 + 分层下钻 + 知道为什么)。
 * 测的都是只有"真分层栈 + 真攻防"才成立的:每层攻击都真断连、下探读到真状态、对上那层才挡得下、
 * 挡错层白折腾、能一路钻到物理层、区域提示只到半栈(逼你钻)。
 */
export function run() {
  console.log('— 连接栈 · 捣蛋鬼跨层对战 —')

  // 开场:连不上、只报半栈区域、各层还没下探(得你钻)
  {
    const d = new StackBattle(['phys', 'link', 'tcp']).view()
    ok(!d.connected && d.attackRegion!.includes('下半栈'), `开场连不上、只报区域「${d.attackRegion}」(没报具体哪层)`)
    ok(d.layers.every(l => !l.known), '各层都还没下探——得自己钻')
  }

  // 每层的攻击都真断连;下探这层读到"坏"的真状态,别的层读到"好"
  for (const atk of LAYERS) {
    const d = new StackBattle([atk])
    ok(!d.connected(), `[${atk}] 攻击 → 整条真断连(网页打不开)`)
    const self = d.play(`see-${atk}`)
    ok(self.layers.find(l => l.key === atk)!.broken, `[${atk}] 下探这层 → 读到它是坏的`)
  }

  // 钻到物理层:下探物理 → 读到误码率飙高;校准 → 真的通了
  {
    const d = new StackBattle(['phys'])
    const v = d.play('see-phys')
    const phys = v.layers.find(l => l.key === 'phys')!
    ok(phys.broken && phys.reading!.includes('误码率') && phys.reading!.includes('太高'), `钻到物理层 → 误码率太高(${phys.reading})`)
    ok(d.play('recalibrate').connected, '校准光模块 → 整条连上了(真判)')
  }

  // 对症那层的对应卡才挡得下、士气才掉
  const RIGHT: Record<string, string> = { tcp: 'open-port', ip: 'fix-route', link: 'static-arp', phys: 'recalibrate' }
  for (const atk of LAYERS) {
    const d = new StackBattle([atk])
    const v = d.play(RIGHT[atk]!)
    ok(v.won && v.morale === 0, `[${atk}] 对应卡「${LAYER_INFO[atk].counterName}」→ 挡下、熬光士气赢了`)
  }

  // 挡错层:士气不掉、断网飙升(逼你先钻清是哪层)
  {
    const d = new StackBattle(['link', 'tcp'])
    const before = d.view().clock
    const v = d.play('recalibrate') // 链路坏了却去修物理
    ok(v.morale === 2 && !v.connected && v.clock > before + 20, `挡错层:士气没掉、断网从 ${before} 飙到 ${v.clock}`)
  }

  // 下探便宜、挡错贵(鼓励先钻后打)
  {
    const a = new StackBattle(['link']); a.play('see-tcp')
    const b = new StackBattle(['link']); b.play('recalibrate')
    ok(b.view().clock > a.view().clock * 3, `一次挡错(${b.view().clock}%)远贵于一次下探(${a.view().clock}%)`)
  }

  // 逐招挡对(靠区域缩范围)→ 熬光士气 → 赢;区域提示只到半栈
  {
    const d = new StackBattle(['phys', 'tcp'])
    ok(d.view().attackRegion!.includes('下半栈'), '物理层这招 → 提示"下半栈"')
    d.play('recalibrate')
    ok(d.view().attackRegion!.includes('上半栈'), 'TCP 那招 → 提示"上半栈"')
    d.play('open-port')
    ok(d.won, '两招都对症挡下 → 赢')
  }

  // 一直挡错 → 断网满 → 输
  {
    const d = new StackBattle(['link', 'tcp', 'phys'])
    for (let i = 0; i < 8 && !d.lost && !d.won; i++) d.play('fix-route') // 一律修没坏的那层
    ok(d.lost && d.view().clock >= 100, '一直挡错层 → 断网满 → 被得逞,输')
  }
}
