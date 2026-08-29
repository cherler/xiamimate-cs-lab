import { startRun, onWin, onLose, advance, buyTool, rewardChoices, modsOf, currentNode, TOOLS } from '../game/cards/run.ts'
import { ThermalDuel } from '../game/cards/thermal-duel.ts'
import { NO_MODS } from '../game/cards/duel.ts'
import { ok } from './harness.ts'

/**
 * 房子肉鸽跑图 · 工具箱经济 + 工具真作用于对战引擎。
 * 关键:工具是引擎级修饰符,得**真的改变副本手感**(时钟更慢/开局送读数/自动亮),不是数值摆设;
 * 口碑/钱经济自洽(修砸掉口碑、归零判输、Boss 修好通关)。
 */
export function run() {
  console.log('— 房子肉鸽跑图(工具箱 meta)—')

  // 工具 → mods 合成:缓冲垫降时钟、直觉送读数、监控每回合亮;叠加正确
  ok(modsOf([]).clockMul === 1, '空工具 = 恒等修饰符')
  ok(modsOf(['buffer']).clockMul === 0.6, '缓冲垫 → clockMul 0.6')
  ok(Math.abs(modsOf(['buffer', 'buffer']).clockMul - 0.36) < 1e-9, '两块缓冲垫叠乘(0.36)')
  ok(modsOf(['intuition']).startReveals === 1 && modsOf(['monitor']).autoRevealPerTurn === 1, '直觉/监控仪的修饰正确')

  // 工具真改副本手感:缓冲垫 → 同样拖 4 回合,变质明显更低
  {
    const bare = new ThermalDuel(['coils'], NO_MODS); for (let i = 0; i < 4; i++) bare.play('wait')
    const buff = new ThermalDuel(['coils'], modsOf(['buffer'])); for (let i = 0; i < 4; i++) buff.play('wait')
    ok(buff.snapshot().spoil < bare.snapshot().spoil - 5, `缓冲垫真的拖慢时钟:变质 ${buff.snapshot().spoil}% < 裸装 ${bare.snapshot().spoil}%`)
  }
  // 老师傅的直觉:开局就白送一个读数
  {
    const d = new ThermalDuel(['coils'], modsOf(['intuition']))
    ok(Object.keys(d.snapshot().known).length === 1, '直觉 → 开局白送一个读数')
  }
  // 监控仪:每回合自动亮一个未知读数
  {
    const d = new ThermalDuel(['coils'], modsOf(['monitor']))
    ok(Object.keys(d.snapshot().known).length === 0, '监控仪开局还没动(0)')
    d.play('wait')
    ok(Object.keys(d.snapshot().known).length === 1, '监控仪 → 走一回合自动亮一个')
  }
  // 急救包:easeClock 把时钟压回一截
  {
    const d = new ThermalDuel(['coils']); for (let i = 0; i < 5; i++) d.play('wait')
    const before = d.snapshot().spoil; d.easeClock(30)
    ok(d.snapshot().spoil <= before - 30 + 1, `急救包:变质从 ${before}% 压回一截`)
  }

  // 难度旋钮:hardMul 让时钟涨更快(Boss 更凶)
  {
    const easy = new ThermalDuel(['coils'], NO_MODS, 1); for (let i = 0; i < 3; i++) easy.play('wait')
    const boss = new ThermalDuel(['coils'], NO_MODS, 2.2); for (let i = 0; i < 3; i++) boss.play('wait')
    ok(boss.snapshot().spoil > easy.snapshot().spoil + 5, `Boss 时钟更快:变质 ${boss.snapshot().spoil}% > 普通 ${easy.snapshot().spoil}%`)
  }

  // 经济:口碑血条 + 钱
  {
    const r = startRun()
    ok(r.rep === 3 && r.money === 5 && currentNode(r).type === 'repair', '开局:口碑3、钱5、首站维修')
    const m0 = r.money; onWin(r)
    ok(r.money === m0 + currentNode(r).reward && !r.over, '修好 → 赚钱、没通关(非 Boss)')
    onLose(r); onLose(r)
    ok(r.rep === 1 && !r.over, '修砸两次 → 口碑掉到1、还没输')
    onLose(r)
    ok(r.rep === 0 && r.over === 'lose', '口碑归零 → 这局失败')
  }
  // Boss 修好 = 通关
  {
    const r = startRun(); r.pos = r.map.length - 1
    ok(currentNode(r).type === 'boss', '末节点是 Boss')
    onWin(r); ok(r.over === 'win', 'Boss 修好 → 通关')
  }
  // 商店:钱够才买、非消耗品不重复、急救包可叠
  {
    const r = startRun(); r.money = 5
    ok(buyTool(r, 'buffer') && r.tools.includes('buffer') && r.money === 2, '买缓冲垫(3钱)成功')
    ok(!buyTool(r, 'buffer'), '非消耗品不重复买')
    ok(!buyTool(r, 'monitor'), '钱不够(2<4)→ 买不了')
    ok(buyTool(r, 'firstaid') && r.firstaid === 1, '急救包(2钱)买到、记数+1')
  }
  // 三选一:已拥有的非消耗品不再出,急救包总在
  {
    const r = startRun(); r.tools = ['buffer', 'intuition', 'monitor']
    const ch = rewardChoices(r)
    ok(!ch.includes('buffer') && ch.includes('firstaid'), '奖励池排除已有非消耗、保留急救包')
  }

  // 推进:走到底不越界
  {
    const r = startRun(); for (let i = 0; i < 10; i++) advance(r)
    ok(r.pos === r.map.length - 1, '推进不越界(停在末节点)')
  }

  ok(TOOLS.buffer.price === 3, '工具定价可读(缓冲垫3钱)')
}
