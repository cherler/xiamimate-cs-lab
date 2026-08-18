/**
 * 实验单的内容规则。
 *
 * 和 `guide-content.test.ts` 同样的分工：这一套只验**文本自身立不立得住**，
 * 「③ 里说的旋钮页面上真有吗」「④ 的数是不是现算的」要跑起来才知道，
 * 那两条在冒烟第 15 组。
 *
 * 为什么不能在这里 import registry：注册表 import 了 `@engine/*` 和 .tsx 舞台，
 * 仓库根的 tsconfig 是给引擎用的（没有 paths、没有 jsx）。
 * `brief.ts` 因此刻意不认识 `SimDocument` —— 它和 App 在 `unknown` 上握手。
 */
import { BRIEFS, briefFor } from '../web/src/brief.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

const entries = Object.entries(BRIEFS)

console.log('\n【实验单 · 四段齐不齐】')
{
  ok(`共 ${entries.length} 个实验有实验单`)

  /*
   * ① 不许短。
   *
   * 这一段要回答"不懂这个会在哪儿吃亏"，一句"介绍 Cache 的原理"是废话 ——
   * 而废话和真话在代码里长得一样，只有长度挡得住占位符。
   * 80 字是拍的，写不满说明还没想清楚该讲什么。
   */
  const thin = entries.filter(([, b]) => b.care.length < 80)
  thin.length === 0 ? ok('① 都写满了 80 字以上') : bad(`① 过短：${thin.map(([k, b]) => `${k}(${b.care.length})`).join(', ')}`)

  const badGuess = entries.filter(([, b]) =>
    b.guess.q.trim().length < 10 || b.guess.opts.length < 2 || b.guess.opts.some(o => !o.trim()))
  badGuess.length === 0
    ? ok('② 都有一句问句和至少两个选项')
    : bad(`② 不完整：${badGuess.map(([k]) => k).join(', ')}`)

  /*
   * ③ 至少两条，且每条都要有"看什么"。
   *
   * 只写"把相联度拧一拧"而不说看哪儿，等于没说 —— 用户会拧完之后
   * 盯着一屏没变化的东西发呆。这一条是整层里最容易写漏的。
   */
  const badTasks = entries.filter(([, b]) =>
    b.tasks.length < 2 || b.tasks.some(t => !t.act.trim() || !t.watch.trim()))
  badTasks.length === 0
    ? ok('③ 每个实验至少两条动作，每条都写了"看什么"')
    : bad(`③ 不完整：${badTasks.map(([k]) => k).join(', ')}`)

  const noVerdict = entries.filter(([, b]) => typeof b.verdict !== 'function')
  noVerdict.length === 0
    ? ok('④ 都是函数 —— 结论现算，没有写死的句子')
    : bad(`④ 不是函数：${noVerdict.map(([k]) => k).join(', ')}`)
}

console.log('\n【④ 结论真的在算】')
{
  /**
   * 拿两份**假轨迹**喂给 Cache 的 verdict：同一份配置，命中率不同，
   * 结论文本必须不一样。
   *
   * 这条挡的是最坏的一种写法：`verdict` 是函数、返回的却是常量句子 ——
   * 类型上完全合法，读起来也像对的，而它一个字都不会跟着数据变。
   */
  const b = briefFor('cache')
  if (!b) { bad('cache 没有实验单'); }
  else {
    const doc = { params: { associativity: 2 } }
    //  runDoc 按传进来的相联度编造不同的命中率：1 路差、8 路好
    const fake = (assoc: number, hits: number) => [{ hits, i: 9, assoc }]
    const mk = (oneHits: number, eightHits: number) => (d: unknown) => {
      const a = Number((d as { params: Record<string, unknown> }).params.associativity)
      return fake(a, a === 1 ? oneHits : eightHits)
    }
    const A = b.verdict({ doc, trace: [{ hits: 5, i: 9 }], runDoc: mk(2, 8) })
    const B = b.verdict({ doc, trace: [{ hits: 5, i: 9 }], runDoc: mk(8, 8) })
    if (!A || !B) bad('④ 在正常输入上返回了 null')
    else {
      //  截头会截到两句相同的开头，看起来像"两个一样的字符串通过了" —— 截差异那一段
      const tail = (s: string) => s.slice(-30)
      A.say !== B.say
        ? ok(`换一组数，④ 结论跟着变（「…${tail(A.say)}」≠「…${tail(B.say)}」）`)
        : bad('④ 是函数但返回常量 —— 换了数结论一个字没变')
      A.pick !== B.pick
        ? ok(`对错判定也跟着变（${A.pick} ≠ ${B.pick}）—— 不是固定押一个答案`)
        : bad(`④ 的 pick 恒定为 ${A.pick}`)
    }
    //  空轨迹要老实返回 null，不能编一个结论出来
    b.verdict({ doc, trace: [], runDoc: mk(2, 8) }) === null
      ? ok('轨迹为空时返回 null —— 算不出来就不说')
      : bad('轨迹为空时也给了结论')
  }
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
