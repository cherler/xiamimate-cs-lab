/**
 * 概念卡的解析不许再静默为空。
 *
 * 2026-09-10 实测：复习模式的概念卡经常整块不出现，屏幕上**不报错、不提示**，
 * 而这次调用的钱照扣。根因是模型写中文引文时用了英文双引号、没转义，
 * `JSON.parse` 抛错，而 `extractCards` 是 `catch { return [] }` —— 一个静默的洞。
 * （`stop_reason=end_turn`，不是被截断。）
 *
 * 这套判据钉两件事：坏 JSON 要救得回来，好 JSON 不许被救坏。
 */
import { extractCardsForTest } from '../server/review.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

console.log('\n【概念卡解析：坏 JSON 也要救得回来】')

//  标准 JSON —— 走第一层
{
  const good = '[{"front":"什么是不变量","back":"每轮结束后仍成立的性质"},{"front":"复杂度","back":"O(n log n)"}]'
  const cards = extractCardsForTest(good)
  cards.length === 2 && cards[0]!.front === '什么是不变量'
    ? ok(`合法 JSON 解出 ${cards.length} 张`)
    : bad(`合法 JSON 解不出来：${JSON.stringify(cards)}`)
}

//  值里带**未转义的英文双引号** —— 这就是线上真实的坏法
{
  const broken = '[{"front":"贪心为什么对","back":"因为 "当前最小即最终最小" 这条不变量成立"},'
    + '{"front":"何时失效","back":"边权为负时 "已定则不再变" 不再成立"}]'
  let threw = false
  try { JSON.parse(broken.match(/\[[\s\S]*\]/)![0]) } catch { threw = true }
  threw ? ok('自检：这段确实是 JSON.parse 解不动的（不然下面等于没测）')
        : bad('自检失败：这段其实合法，换一个坏样本')

  const cards = extractCardsForTest(broken)
  cards.length === 2
    ? ok(`容错抠法救回 ${cards.length} 张`)
    : bad(`容错抠法只救回 ${cards.length} 张：${JSON.stringify(cards)}`)
  cards[0]?.back.includes('"当前最小即最终最小"')
    ? ok('值里的裸双引号**原样保留**了 —— 不是靠删引号糊过去的')
    : bad(`值被改动了：${cards[0]?.back}`)
}

//  真的什么都没有 —— 该空就空，但不能假装有
{
  const junk = '抱歉，我无法根据轨迹生成卡片。'
  extractCardsForTest(junk).length === 0
    ? ok('没有 JSON 数组时返回空 —— 不编造')
    : bad('从没有 JSON 的文本里编出了卡片')
  const emptyArr = extractCardsForTest('[]')
  emptyArr.length === 0 ? ok('空数组就是空') : bad('空数组解出了东西')
}

console.log(`\n${'─'.repeat(52)}`)
console.log(failures === 0 ? '本套全部通过' : `概念卡解析：失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
