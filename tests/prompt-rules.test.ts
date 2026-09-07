/**
 * AI 学伴的**提示词纪律** —— 提示词搬进 server/prompts/*.md 之后，就该被判据盯着。
 *
 * 起因（用户 2026-09-07）：「AI 学伴的逻辑，我还是不放心。」
 * 于是去读了清华 OpenMAIC（MIT）的出题提示词。两边的差别值得记在这儿：
 *
 *   · 它的正确答案 `"answer": ["A"]` 是**模型生成**的；判分也是模型说了算
 *     （app/api/quiz-grade/route.ts：没有标准答案，JSON 解析失败还兜底给满分的 50%）。
 *   · 我们的答案由引擎钉死，模型只负责改写题面 —— 这一层不学它。
 *   · 但它的**出题工艺**比我们成熟：选项等长、干扰项要可信、不许「以上都对」、
 *     讲解要说明其余选项各错在哪、难度分级。这几条我们学了，就得有判据保证它们留在提示词里。
 *
 * 顺带补了一个结构性缺口：以前**干扰项根本没传给模型**，所以「讲解要驳倒其余选项」
 * 在结构上就做不到 —— 模型不知道别的选项是什么。
 *
 * 跑法：npx tsx tests/prompt-rules.test.ts（也在 npm test 里）
 */
import { prompt, unresolved } from '../server/prompts/loader.ts'
import { CATALOG, traceOf } from '../server/catalog.ts'

let failures = 0
const ok = (m: string) => console.log('  ✅ ' + m)
const bad = (m: string) => { failures++; console.log('  ❌ ' + m) }

console.log('\n— AI 学伴 · 提示词纪律 —')

const IDS = ['quiz-explain'] as const
const rendered = Object.fromEntries(IDS.map(id => [id, prompt(id)])) as Record<string, string>

/* ① 渲染得出来，而且不许剩占位符 —— 剩下的会被当字面量发给模型，且没人会发现 */
{
  for (const id of IDS) {
    const t = rendered[id]!
    t.length > 200
      ? ok(`${id}.md 渲染出 ${t.length} 字`)
      : bad(`${id}.md 只渲染出 ${t.length} 字 —— 文件是不是空的/路径错了?`)
    const left = unresolved(t)
    left.length === 0
      ? ok(`${id}.md 没有没填上的占位符`)
      : bad(`${id}.md 还剩占位符 ${left.join(' ')} —— 它们会被当成字面量发给模型`)
  }
}

/* ② 那几条出题工艺规则必须在（学自 OpenMAIC 的 quiz-content/system.md） */
{
  const RULES: [string, RegExp][] = [
    ['选项长度要接近', /长度要接近|长度.{0,4}接近/],
    ['干扰项要可信', /可信的错误认知|站得住的错误理由/],
    ['不许「以上都对」', /以上都对/],
    ['讲解要驳倒其余选项', /逐个说明其余.{0,6}选项|各错在哪/],
    ['不许自己算数字', /不要自己计算|不要.{0,6}编造/],
  ]
  for (const id of IDS) {
    const miss = RULES.filter(([, re]) => !re.test(rendered[id]!)).map(([n]) => n)
    miss.length === 0
      ? ok(`${id}.md 里五条出题工艺规则齐全`)
      : bad(`${id}.md 少了：${miss.join('、')} —— 删掉之后模型会退回随手写选项`)
  }
  /*  题面不再过大模型（我们手写的 ask 直接用），所以那两条关于「题面怎么写」的规则
      不在提示词里了，改由代码 + 判据保证：计数题的数据由 askWithData 注入、
      「不许把中间状态抄进题面」由我们自己写 ask 时把关。
      这里只剩一条:模型不许自己重写题面。 */
  const noRewrite = /不要重写题面/
  noRewrite.test(rendered['quiz-explain']!)
    ? ok('quiz-explain.md 明令模型不许重写题面（题面是我们写的，不过模型）')
    : bad('quiz-explain.md 没拦住模型重写题面 —— 那正是「某组关键字」那道题的由来')
}

/* ③ 选项内容本身：不许出现「以上都对」这类白送分的选项 */
{
  const BANNED = /以上都对|以上都不对|以上全部正确|都正确|A 和 B|上述都对/
  const hits: string[] = []
  for (const e of CATALOG) {
    let t: Record<string, unknown>[] = []
    try { t = traceOf(e) as Record<string, unknown>[] } catch { continue }
    for (const f of e.facts) {
      let a = ''
      try { a = f.compute(t).answer } catch { continue }
      for (const o of [a, ...f.distractors(a, t)]) if (BANNED.test(o)) hits.push(`${e.id}/${f.id}: ${o.slice(0, 20)}`)
    }
  }
  hits.length === 0
    ? ok('全部选项里没有「以上都对」这类白送分的写法')
    : bad(`有 ${hits.length} 个这类选项：${hits.slice(0, 5).join('；')}`)
}

/* ④ 正确答案的位置要真的散开 —— 选项是 shuffle 的，但得验一遍它没退化。
      不验的话，某天 shuffle 写错、答案永远在第一个，也没人会发现。 */
{
  const pos = [0, 0, 0, 0]
  let n = 0
  for (const e of CATALOG.slice(0, 60)) {
    let t: Record<string, unknown>[] = []
    try { t = traceOf(e) as Record<string, unknown>[] } catch { continue }
    for (const f of e.facts) {
      let a = ''
      try { a = f.compute(t).answer } catch { continue }
      const ds = f.distractors(a, t).filter(d => d !== a).slice(0, 3)
      if (ds.length < 3) continue
      //  重跑一次和 quiz.ts 同款的洗牌，看落点分布
      const opts = [a, ...ds]
      for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j]!, opts[i]!] }
      pos[opts.indexOf(a)]!++; n++
    }
  }
  const worst = Math.max(...pos) / Math.max(1, n)
  n >= 100 ? ok(`抽 ${n} 道题看正确项落点：${pos.join('/')}`) : bad(`只抽到 ${n} 道题，样本太少，这条判据没意义`)
  worst < 0.4
    ? ok(`最偏的那个位置占 ${(worst * 100).toFixed(0)}%（四选一的期望是 25%，明显偏了就说明洗牌坏了）`)
    : bad(`正确项过于集中在某个位置（${(worst * 100).toFixed(0)}%）—— 洗牌是不是失效了?`)
}

/* ⑤ 能判红的自检 */
{
  //  a) unresolved 认不认得出没填上的占位符
  unresolved('前面 {{foo}} 后面').length === 1
    ? ok('自检：unresolved 认得出没填上的占位符')
    : bad('自检失败：unresolved 抓不到占位符，规则①等于空跑')
  //  b) 变量能填上、snippet 能拼进来
  const withVar = prompt('quiz-explain', { nothing: 'x' })
  withVar.includes('长度要接近')
    ? ok('自检：{{snippet:option-rules}} 真的被拼进来了（不是原样留着）')
    : bad('自检失败：snippet 没拼进来，那几条规则等于没写')
  //  c) 那条「以上都对」的正则确实能抓到人为的坏选项
  const banned = /以上都对|以上都不对/
  banned.test('以上都对')
    ? ok('自检：「以上都对」的规则确实抓得住')
    : bad('自检失败：规则③抓不住人为的坏选项')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
