import { ThermalDuel } from '../game/cards/thermal-duel.ts'
import { ok } from './harness.ts'

/**
 * 冰箱副本 v2 · 多回合"对战":敌人=故障、且故障主动反扑。
 * 这里测的都是**只有"真仿真+真动态"才成立**的性质——次生故障从散热片读数涌现、
 * 探针不改物理、时钟由温度积出来、盲修的代价客观更大。写死住,防以后退化成脚本。
 */
export function run() {
  console.log('— 冰箱副本 v2(多回合·故障反扑)—')

  // 开局:有真症状(偏暖、还没赢),但病因不写在脸上(要探针)
  {
    const d = new ThermalDuel(['coils'])
    const s = d.snapshot()
    ok(!s.won && !s.lost && s.inside > 12, `开局有真症状:柜内 ${s.inside}℃ 偏暖`)
    ok(Object.keys(s.known).length === 0, '开局啥读数都没探到——病因藏着,得取证')
  }

  // 探针只取证、不改物理:同一故障连探两次,读数一样(物理没被探针动过)
  {
    const d = new ThermalDuel(['coils'])
    const v1 = d.play('probe-condenser').known.condenser
    const v2 = d.play('probe-condenser').known.condenser
    ok(v1 === 125 && v2 === 125, `探针不改物理:散热片两次都读 125℃(coils 的真读数)`)
    ok(d.snapshot().faults.join() === 'coils', '探完针,故障还是那一个(没被"修"掉)')
  }

  // 对症处置 → sim 重判,那一层被清掉、读数跟着变
  {
    const d = new ThermalDuel(['coils'])
    d.play('clean-coils')
    ok(!d.snapshot().faults.includes('coils'), '清散热片 → coils 这层没了(sim 重判)')
    ok(d.play('probe-condenser').known.condenser! < 90, '清完散热片 → 散热片温度真的降下来了')
  }

  // 错处置 = 白费一回合(故障没动、时钟照走)
  {
    const d = new ThermalDuel(['coils'])
    const before = d.snapshot().spoil
    d.play('fix-seal')
    const s = d.snapshot()
    ok(s.faults.join() === 'coils' && s.spoil > before, '出错卡:故障没清、变质还涨了(时钟有牙)')
  }

  // 核心:晾着不管 → 散热片连烫 3 回合 → 压缩机烤降频,冒出次生故障(涌现,非脚本)
  {
    const d = new ThermalDuel(['coils'])
    d.play('wait'); d.play('wait')
    ok(!d.snapshot().faults.includes('derate'), '烫了 2 回合还没反扑(阈值前)')
    d.play('wait')
    ok(d.snapshot().faults.includes('derate'), '烫满 3 回合 → 压缩机降频,次生故障 derate 涌现 ⚡')
  }

  // 反扑是有条件的:及时清掉散热片,就永远不会烤出降频
  {
    const d = new ThermalDuel(['coils'])
    d.play('clean-coils')
    d.play('wait'); d.play('wait'); d.play('wait')
    ok(!d.snapshot().faults.includes('derate'), '早早清散热片 → 散热片不烫了 → 永不降频(反扑可被扼杀)')
  }

  // 反扑制造真·新活:降频后光清散热赢不了,得再让压缩机歇口气
  {
    const d = new ThermalDuel(['coils'])
    d.play('wait'); d.play('wait'); d.play('wait')  // 逼出 derate
    d.play('clean-coils')
    ok(!d.snapshot().won, '降频后只清散热 → 还是不凉(功率被砍,新活跑不掉)')
    ok(d.play('probe-pump').known.pump! < 60, '听压缩机 → 功率异常低(降频的真读数)')
    d.play('rest-compressor'); d.play('wait'); d.play('wait'); d.play('wait')
    ok(d.snapshot().won, '让压缩机歇口气 + 等凉 → 才修好')
  }

  // 多故障:两层都得诊断清掉才赢,清一半不算
  {
    const d = new ThermalDuel(['coils', 'seal'])
    d.play('clean-coils')
    d.play('wait'); d.play('wait')
    ok(!d.snapshot().won, '双故障只清了散热(seal 还漏)→ 压不下来,不算赢')
    d.play('fix-seal'); d.play('wait'); d.play('wait'); d.play('wait')
    ok(d.snapshot().won, '再堵住门封 + 等凉 → 两层全清才修好')
  }

  // 时钟真会输:一直不动手,变质积满 → 判输
  {
    const d = new ThermalDuel(['coils'])
    for (let i = 0; i < 20 && !d.lost; i++) d.play('wait')
    ok(d.snapshot().lost && d.snapshot().spoil >= 100, '光等不修 → 变质积到 100% → 食物全坏,判输')
  }

  // 盲修的代价客观更大:同一故障,乱试比先取证再对症,变质高得多
  {
    const eff = new ThermalDuel(['coils'])
    for (const m of ['probe-condenser', 'clean-coils', 'wait', 'wait']) eff.play(m)
    const blind = new ThermalDuel(['coils'])
    for (const m of ['fix-seal', 'refill', 'wait', 'clean-coils', 'probe-pump', 'rest-compressor', 'wait', 'wait', 'wait']) blind.play(m)
    ok(eff.snapshot().won && blind.snapshot().won, '两条线最后都能修好')
    ok(blind.snapshot().spoil > eff.snapshot().spoil + 20, `盲修代价更大:变质 ${blind.snapshot().spoil}% ≫ 高效 ${eff.snapshot().spoil}%`)
  }

  // 诊断必须比乱试划算(否则诊断没意义)——一次错处置远贵于一次探针,连拆错直接输
  {
    const p = new ThermalDuel(['coils']); p.play('probe-load')
    const w = new ThermalDuel(['coils']); w.play('fix-seal') // 拆错零件
    ok(w.snapshot().spoil > p.snapshot().spoil * 2 + 8, `一次错处置(变质${w.snapshot().spoil}%)远贵于一次探针(${p.snapshot().spoil}%)`)
    const blind3 = new ThermalDuel(['coils']);['fix-seal', 'refill', 'rest-compressor'].forEach(m => blind3.play(m))
    ok(blind3.lost || blind3.snapshot().spoil >= 80, `连拆错 3 次 → 濒死/直接输(变质${blind3.snapshot().spoil}%),乱点不再划算`)
  }
}
