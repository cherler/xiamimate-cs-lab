import { ScriptedPartner, ModelPartner, makePartner } from '../agents/partner.ts'
import { ok } from './harness.ts'

export async function run() {
  console.log('— AI 助手 —')
  const sp = new ScriptedPartner()

  // 每个认知节点都有话说
  for (const node of ['enter', 'anomaly', 'before-pick', 'cracked', 'freeze-warn'] as const) {
    const line = await sp.react({ chapter: 'fridge', node })
    ok(line != null && line.who === '咕噜' && line.text.length > 0, `节点 ${node} 有台词`)
  }

  // 引用的数字来自 readings（不是编的）
  const anom = await sp.react({ chapter: 'fridge', node: 'anomaly', readings: { condenser: 75 } })
  ok(anom!.text.includes('75'), '扫出异常时引用求解器给的 75℃')

  // ⚠️ 铁律：没给 readings 就不许冒出数字
  const anomNoData = await sp.react({ chapter: 'fridge', node: 'anomaly' })
  ok(!/\d/.test(anomNoData!.text), '没有读数时，助手不编造任何数字')

  const cracked = await sp.react({ chapter: 'fridge', node: 'cracked', readings: { blocked: 21, clear: 7.5 } })
  ok(cracked!.text.includes('21') && cracked!.text.includes('7.5'), '破案台词用的是求解器的 21/7.5')

  // 工厂：无配置→脚本；全配置→真模型
  ok(makePartner() instanceof ScriptedPartner, '无端点配置时用脚本兜底')
  ok(makePartner({ baseUrl: 'http://x', apiKey: 'k', model: 'm' }) instanceof ModelPartner, '配齐端点时用真模型')
  ok(makePartner({ baseUrl: 'http://x' }) instanceof ScriptedPartner, '配置不全时仍用脚本兜底')
}
