import { CraftEngine, guruLine } from '../game/craft/engine.ts'
import { ok } from './harness.ts'

export function run() {
  console.log('— 反应引擎 —')
  const e = new CraftEngine()

  // 起手:拥有全部原子,不拥有任何组件
  ok(e.owns('电平') && e.owns('时间') && e.owns('标识') && e.owns('比特'), '起手拥有全部原子')
  ok(!e.owns('信号') && !e.owns('MAC地址'), '起手不拥有组件')

  // 正确合成,顺序无关
  const r1 = e.react(['时间', '电平'])
  ok(r1.ok && r1.reaction.output === '信号', '电平+时间 → 信号(顺序无关)')
  ok(e.owns('信号'), '合成后拥有 信号,可当下一步原料')

  // 单输入反应
  const rc = e.react(['时间'])
  ok(rc.ok && rc.reaction.output === '时钟', '时间 → 时钟(单输入反应)')

  // 三输入 + 落地"标识是唯一地址原子"这条边界
  const rm = e.react(['固化', '标识', '比特'])
  ok(rm.ok && rm.reaction.output === 'MAC地址', '标识+比特+固化 → MAC地址(地址是反应不是原子)')

  // 两级链:先造出的组件能当原料
  const chain = e.react(['信号', '比特'])
  ok(chain.ok && chain.reaction.output === '码元', '信号(自造)+比特 → 码元(两级链)')

  // 错配:凑不到一起
  const bad = e.react(['比特', '密钥'])
  ok(!bad.ok && bad.reason === 'no-reaction', '比特+密钥 → 无反应(懂才能合)')

  // 差一味:真子集
  const inc = e.react(['标识', '比特']) // MAC地址 还差 固化
  ok(!inc.ok && inc.reason === 'incomplete', '标识+比特 → 还差一味(incomplete)')

  // 没料:用还没造出的组件当原料
  const e2 = new CraftEngine()
  const no = e2.react(['以太网', '交换机', '广播域', 'ARP'])
  ok(!no.ok && no.reason === 'not-owned', '组件没先造出就合 → not-owned')

  // 重复合成:already=true,不重复计数
  const before = e.progress().made
  const again = e.react(['电平', '时间'])
  ok(again.ok && again.already, '重复合成 信号 → already=true')
  ok(e.progress().made === before, 'already 不重复计进度')

  // 进度:总数=去重后的产物数
  ok(e.progress().total > 100 && e.progress().made >= 4, '进度计数(made/total)')

  // craftableNow:当前库存能直接合出来的下一批(非空)
  ok(e.craftableNow().length > 0, 'craftableNow 给出下一步可合成项')

  // 咕噜解说:成功念原理、卡住给方向(不报答案)
  ok(r1.ok && guruLine(r1).includes(r1.reaction.rule.slice(0, 4)), '咕噜:成功念原理')
  ok(guruLine(bad).length > 0 && !guruLine(bad).includes('MAC'), '咕噜:卡住给方向不报答案')
}
