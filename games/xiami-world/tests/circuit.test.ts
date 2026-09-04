import { solve, type Circuit } from '../solvers/circuit.ts'
import { ok, near } from './harness.ts'

/** 修理铺那盏灯：12V 电源 + 开关 + 12Ω/12W 灯泡，导线接回去 */
const shop = (over: Partial<{ closed: boolean; burnt: boolean; wireBroken: boolean; extraOhms: number }> = {}): Circuit => ({
  components: [
    { id: 'battery', kind: 'source', volts: 12 },
    { id: 'sw', kind: 'switch', closed: over.closed ?? true },
    ...(over.extraOhms ? [{ id: 'load', kind: 'resistor' as const, ohms: over.extraOhms }] : []),
    { id: 'lamp', kind: 'lamp', ohms: 12, ratedWatts: 12, burnt: over.burnt },
    { id: 'wire', kind: 'wire', broken: over.wireBroken },
  ],
})

export function run() {
  console.log('— 电路求解器 —')

  //  1. 第一个故障：开关断开
  {
    const r = solve(shop({ closed: false }))
    ok(!r.closed, '开关断开时回路应为断路')
    ok(r.brokenAt === 'sw', '断点应指向开关')
    near(r.current, 0, '断路电流')
    ok(r.lamp?.lit === false, '断路时灯不亮')
    //  这条是「拿电压表找断点」那条玩法的地基
    near(r.drops.find(d => d.id === 'sw')!.volts, 12, '断点两端应压着全部电源电压')
    near(r.drops.find(d => d.id === 'lamp')!.volts, 0, '断路时灯上电压为 0')
  }

  //  2. 合上开关：灯该亮
  {
    const r = solve(shop({ closed: true }))
    ok(r.closed, '开关合上后回路通')
    near(r.totalOhms!, 12, '总电阻')
    near(r.current, 1, '电流 I = 12V / 12Ω')
    near(r.lamp!.watts, 12, '灯功率 P = I²R')
    near(r.lamp!.brightness, 1, '额定功率下亮度满格')
    ok(r.lamp!.lit, '灯应该亮')
  }

  //  3. 第二个故障：灯丝烧断 —— 现象和开关断开一模一样，但断点在别处
  {
    const r = solve(shop({ burnt: true }))
    ok(!r.closed && r.brokenAt === 'lamp', '灯丝断时断点应在灯上')
    near(r.drops.find(d => d.id === 'lamp')!.volts, 12, '灯丝断时全部电压压在灯两端')
    //  ⚠️ 这一条是这一集的题眼：两种故障给玩家看到的是同一个画面
    const a = solve(shop({ closed: false }))
    ok(a.lamp!.lit === r.lamp!.lit && a.current === r.current,
       '开关断开与灯丝烧断，肉眼现象必须无法区分')
  }

  //  4. 串一个负载：灯变暗但还亮着
  {
    const r = solve(shop({ extraOhms: 12 }))
    near(r.current, 0.5, '串入 12Ω 后电流减半')
    near(r.lamp!.brightness, 0.25, '亮度按功率算，是电流的平方 —— 减半的电流只剩四分之一的亮度')
    ok(r.lamp!.lit, '四分之一功率还看得见')
  }

  //  5. 串一个大负载：暗到看不见，但回路是通的
  {
    const r = solve(shop({ extraOhms: 108 }))
    ok(r.closed, '大负载下回路仍然是通的')
    ok(!r.lamp!.lit, '低于额定 5% 时看着就是不亮')
    ok(r.current > 0, '但电流不是 0 —— 这跟断路是两回事')
  }

  //  6. 短路不能把程序算炸，也不能假装「很亮」
  {
    const r = solve({ components: [
      { id: 'battery', kind: 'source', volts: 12 },
      { id: 'wire', kind: 'wire' },
    ] })
    ok(r.short, '没有电阻的回路应判为短路')
    ok(!Number.isFinite(r.current), '短路电流不该是一个有限的假数')
  }

  //  7. 导线断
  {
    const r = solve(shop({ wireBroken: true }))
    ok(r.brokenAt === 'wire', '导线断时断点应在导线')
  }
}
