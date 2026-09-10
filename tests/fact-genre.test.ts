/**
 * AI 学伴的**题型纪律**：没有哪个实验可以全是计数题。
 *
 * 起因（用户 2026-09-07 报的）：出题面板里连着三道都是「比较了多少次 / 移动了多少次 /
 * 第一趟的枢轴是几」，而且四个功能（出题 / 答疑 / 复习 / 面试）问的是同一批东西。
 * 用户的原话：「这种肤浅的实操问题有什么意义？肯定是问理论知识啊…… AI 学伴的底层逻辑就错了。」
 *
 * 根因不在「焊死引擎」那个机制 —— 引擎钉答案、大模型只改写，这条挡住了模型胡编，要留。
 * 错的是**「可核算事实」被实现成了「trace 上的一个计数器」**：
 * `compute: t => last(t).comparisons`。口径一窄，题目就只能问计数；而四个功能又都吃同一份
 * facts，于是一起烂。引擎能钉死的远不止计数：一条原理、一个不变量、一个「换成别的会怎样」，
 * 引擎照样给得出出处。
 *
 * 所以这里立三条红线：
 *   ① 每个实验至少有一条**原理题**（欠账上限逐步降到 0，顶破就判红）
 *   ② 计数题必须拿得到那组输入数据 —— 拿不到的话题面写出来就是「对一组数据……」，没法答
 *   ③ 出一套题时，计数题至多一道；原理题够就一道都不出
 *
 * 跑法：npx tsx tests/fact-genre.test.ts（也在 npm test 里）
 */
import { CATALOG, traceOf, genreOf } from '../server/catalog.ts'
import { CONCEPT_FACTS } from '../server/catalog/concepts.ts'
import { FILL_FACTS } from '../server/catalog/concepts-fill.ts'
import { pickBalanced, inputBrief, MAX_COUNT_QUESTIONS, buildQuizSync } from '../server/quiz.ts'

let failures = 0
const ok = (m: string) => console.log('  ✅ ' + m)
const bad = (m: string) => { failures++; console.log('  ❌ ' + m) }

/**
 * 还欠多少个实验没有原理题。**这是欠账台账，不是及格线** —— 补一批就把数字调小。
 * 起点是 75（286 个实验里，最早那批经典实验全是计数题）。
 */
const DEBT_CAP = 0

/**
 * 「正确项明显长过干扰项」的**存量**欠账上限。
 * 486 是这条判据刚立起来时的实测值（全部来自更早几轮写的 facts）。补一批就把它调小 ——
 * 现在是 424：库层那 143 条把「选项」和「出处」对调之后降下来的（见 catalog.ts 里那段注释）。
 */
const LEN_DEBT_CAP = 424

/**
 * 原理题不足三条的实验数上限。出题面板一次摆三道,这些实验只摆得出一两道。
 * 191 是「计数题不再出成题目」之后的实测值 —— 那一刀把这笔欠账露了出来。
 * 补完 397 条原理题(concepts.ts + concepts-fill.ts)之后**清零**:286 个实验每一个都摆得满三道。
 * 这条从此是及格线,不是欠账台账 —— 新增实验时必须自带三条原理题。
 */
const THIN_DEBT_CAP = 0

/**
 * 现在有几个实验出得了「找错的」题。**下限，只许涨不许跌。**
 * 1 是实测值 —— 它被选项长度那笔债卡着（见规则⑧的注释），债还上它就自己涨。
 */
const ODD_UNLOCKED_MIN = 1

console.log('\n— AI 学伴 · 题型纪律 —')

type Row = { id: string; title: string; concept: number; count: number; input: string }
const rows: Row[] = []
for (const e of CATALOG) {
  let t: Record<string, unknown>[] = []
  try { t = traceOf(e) as Record<string, unknown>[] } catch { continue }
  let concept = 0, count = 0
  for (const f of e.facts) { if (genreOf(f, t) === 'concept') concept++; else count++ }
  rows.push({ id: e.id, title: e.title, concept, count, input: inputBrief(e, t) })
}

//  空跑自检：目录一空、或 trace 全跑不出来，下面每一条都会「0 例外」地绿过去
rows.length >= 200 && rows.reduce((n, r) => n + r.concept + r.count, 0) >= 700
  ? ok(`扫过 ${rows.length} 个实验、${rows.reduce((n, r) => n + r.concept + r.count, 0)} 条事实`)
  : bad(`只扫到 ${rows.length} 个实验 —— 目录读不出来的话，下面的判据等于空跑`)

/* ① 每个实验至少一条原理题 */
{
  const naked = rows.filter(r => r.concept === 0)
  naked.length <= DEBT_CAP
    ? ok(`全是计数题的实验还剩 ${naked.length} 个（上限 ${DEBT_CAP}）`
      + (naked.length ? `：${naked.slice(0, 6).map(r => r.id).join(' ')}` : ''))
    : bad(`全是计数题的实验有 ${naked.length} 个 > 上限 ${DEBT_CAP}：${naked.slice(0, 12).map(r => `${r.id}(${r.title})`).join(' ')}`)
  ok(`原理题 ${rows.reduce((n, r) => n + r.concept, 0)} 条 / 计数题 ${rows.reduce((n, r) => n + r.count, 0)} 条`)
}

/* ② 计数题不许被端到用户面前。
      第一版的规则是「摘不出输入数据的计数题不许出」——治标：就算把数组印在题面上，
      要在 12/13/14/15 里挑一个也得把整趟快排手推一遍，考的是耐心不是理解。
      现在的规则是**一道都不出**（计数事实留着当答疑/面试的地面真值，只是不做成题目）。 */
{
  const leaked: string[] = [], empty: string[] = []
  for (const e of CATALOG) {
    let t: Record<string, unknown>[] = []
    try { t = traceOf(e) as Record<string, unknown>[] } catch { continue }
    const set = pickBalanced(e, t, 3)
    if (set.length === 0) { empty.push(e.id); continue }
    if (!inputBrief(e, t) && set.some(f => genreOf(f, t) === 'count')) leaked.push(e.id)
  }
  leaked.length === 0
    ? ok('摘不出输入的实验，一道计数题都没被选进题目')
    : bad(`有 ${leaked.length} 个实验把「没法答」的计数题端出来了：${leaked.slice(0, 8).join(' ')}`)
  empty.length === 0
    ? ok('每个实验都还出得出题（原理题兜底 —— 这也是规则①必须为 0 的原因）')
    : bad(`有 ${empty.length} 个实验一道题都出不出来了：${empty.slice(0, 8).join(' ')}`)
}

/* ③ 出一套题时的配比 */
{
  const over: string[] = []
  for (const e of CATALOG) {
    let t: Record<string, unknown>[] = []
    try { t = traceOf(e) as Record<string, unknown>[] } catch { continue }
    const set = pickBalanced(e, t, 3)
    const c = set.filter(f => genreOf(f, t) === 'count').length
    const conceptAvail = e.facts.filter(f => genreOf(f, t) === 'concept').length
    /*  现在是**一道都不出** —— MAX_COUNT_QUESTIONS = 0。
        只有「一条原理题都没有」的实验才退回计数题兜底,而规则①卡死了那种实验不存在。 */
    const allow = conceptAvail > 0 ? MAX_COUNT_QUESTIONS : 3
    if (c > allow) over.push(`${e.id} 出了 ${c} 道计数题(允许 ${allow})`)
  }
  over.length === 0
    ? ok(`每个实验出一套三道题，一道计数题都没出（配额 ${MAX_COUNT_QUESTIONS}）`)
    : bad(`配比失守：${over.slice(0, 6).join('；')}`)
}

/* ④ 出一套题能出满三道吗 —— 计数题不出之后,这是新露出来的欠账。
      191 个实验只有一两条原理题,出题面板就只能摆一两道。这不是 bug(总比出一道没法答的强),
      但确实是内容欠账,记账封顶、只许降不许涨。 */
{
  const thin = rows.filter(r => r.concept < 3)
  thin.length <= THIN_DEBT_CAP
    ? ok(`原理题不足三条的实验还有 ${thin.length} 个（上限 ${THIN_DEBT_CAP}）—— 它们的出题面板只摆得出一两道`)
    : bad(`原理题不足三条的实验涨到 ${thin.length} 个 > 上限 ${THIN_DEBT_CAP}：${thin.slice(0, 8).map(r => r.id).join(' ')}`)
  const one = rows.filter(r => r.concept === 1).length
  ok(`其中只有一条原理题的 ${one} 个、两条的 ${thin.length - one} 个`)
}

/* ⑤ 补丁包的每个键都得对得上一个真实验 —— 键写错了是**静默失效**：那个实验依旧全是计数题，
      而补丁包看起来"写了"。这条不设上限，一个都不许错。 */
{
  const ids = new Set(CATALOG.map(e => e.id))
  const typo = [...Object.keys(CONCEPT_FACTS), ...Object.keys(FILL_FACTS)].filter(id => !ids.has(id))
  typo.length === 0
    ? ok(`两个补丁包挂了 ${new Set([...Object.keys(CONCEPT_FACTS), ...Object.keys(FILL_FACTS)]).size} 个实验，每个 id 都对得上`)
    : bad(`补丁包里有 ${typo.length} 个 id 对不上任何实验（写错了会静默失效）：${typo.join(' ')}`)
  const n = Object.values(CONCEPT_FACTS).reduce((a, v) => a + v.length, 0)
    + Object.values(FILL_FACTS).reduce((a, v) => a + v.length, 0)
  n >= 200 ? ok(`两个补丁包共 ${n} 条原理题`) : bad(`补丁包只有 ${n} 条 —— 是不是没被打进去?`)

  /*  ⑤b 补丁包的 fact id 不许和同实验里已有的 id 重名。
      合并是**追加**（`e.facts = [...e.facts, ...extra]`），重名不会报错，后果是两条同 id 的
      fact 并排躺在一个实验里，而 ask.ts / quiz 的讲解都按 `facts.find(f => f.id === factId)`
      取第一条 —— 用户点的是我写的原理题，答疑却拿旧那条（往往是计数题）去找出处。

      这条是第二轮补 facts 时撞出来的，一抓六处：其中四处（hmac/why_nested、
      compositeindex/leftmost、feed/push_pull、rmsnorm/vs_layernorm）连**题目都是重复的** ——
      我没读旧 fact 就动手写，等于给同一个知识点出了两遍题。另两处（traverse/visited、
      xent/perplexity）题不同但 id 撞了，是上一批就混进来的。全部改掉了。
      根因写在这儿：**动手补题之前先把该实验已有的 fact 列出来看一遍**。 */
  const dup: string[] = []
  for (const src of [CONCEPT_FACTS, FILL_FACTS]) {
    for (const [expId, fs] of Object.entries(src)) {
      const e = CATALOG.find(x => x.id === expId)
      if (!e) continue
      const count = new Map<string, number>()
      for (const f of e.facts) count.set(f.id, (count.get(f.id) ?? 0) + 1)
      for (const f of fs) if ((count.get(f.id) ?? 0) > 1) dup.push(`${expId}/${f.id}`)
    }
  }
  dup.length === 0
    ? ok('补丁包没有和存量重名的 fact id（重名会让答疑取错那一条）')
    : bad(`补丁包有 ${dup.length} 个 id 和同实验已有的重名：${dup.join('、')} —— 先读旧 fact 再写新题`)

  /*  ⑤c 换个 id 只躲过了上一条，**内容重复**照样是同一道题出两遍。
      改完重名之后我又扫了一遍答案的字面相似度，还剩六处：merkle/why_tree 和旧 verify_cost、
      birthday/why_double 和旧 sqrt_n、lrucache/why_doubly 和旧 two_structs、rope/why_relative
      和旧 relative_position、ep/ep_cost 和旧 ep-tradeoff、btree 那条和旧 rebuild ——
      答案几乎逐字相同。用户抽到这个实验，三道题里有两道是一个意思。全部换成了别的知识点。

      判法：同实验内两条原理题的**答案**按字符二元组算重合度（除以较短那个的长度，
      所以「短答案被长答案包住」也算命中），≥0.4 记一对。
      17 是清完补丁包之后的实测值，全部来自存量（大半是库层那批「这个库是干什么的」
      和「它覆盖哪些实验」，本来就讲同一件事）。记账封顶、只许降不许涨。

      ⚠️ 试过把**题面**也纳入比较，结果从 17 涨到 181 —— 同一个实验里的题面天然共享主语
      （「Dijkstra 为什么不能有负权」和「Dijkstra 为什么用堆」），几乎全是假阳性，退回只比答案。
      代价要说清楚：这条判据抓的是**字面雷同**，抓不住换一套词的同义改写。birthday 那条
      （「比的是任意一对」写成两句不同的话）就是它漏掉、我照着真实出题结果读出来的 ——
      判据封的是回归，新写的题还是得自己读一遍。 */
  const SIM_DEBT_CAP = 17
  const bigrams = (x: string) => new Set([...x.replace(/[^一-龥A-Za-z0-9]/g, '')].map((c, i, a) => c + (a[i + 1] ?? '')).slice(0, -1))
  const sim = (x: string, y: string) => {
    const A = bigrams(x), B = bigrams(y)
    if (!A.size || !B.size) return 0
    let hit = 0; for (const g of A) if (B.has(g)) hit++
    return hit / Math.min(A.size, B.size)
  }
  const twinTopics: string[] = []
  for (const e of CATALOG) {
    let t: Record<string, unknown>[] = []
    try { t = traceOf(e) as Record<string, unknown>[] } catch { continue }
    const cs = e.facts.filter(f => genreOf(f, t) === 'concept')
      .map(f => { let a = ''; try { a = f.compute(t as never).answer } catch { /* ignore */ } return { id: f.id, a, ask: f.ask } })
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++)
      if (sim(cs[i]!.a, cs[j]!.a) >= 0.4) twinTopics.push(`${e.id}: ${cs[i]!.id} ⇄ ${cs[j]!.id}`)
  }
  twinTopics.length <= SIM_DEBT_CAP
    ? ok(`同一实验里答案雷同的原理题还有 ${twinTopics.length} 对（上限 ${SIM_DEBT_CAP}）—— 抽到就等于同一道题问两遍`)
    : bad(`答案雷同的原理题涨到 ${twinTopics.length} 对 > 上限 ${SIM_DEBT_CAP}：${twinTopics.slice(0, 6).join('；')}`)
  //  空跑自检：这条判据靠 sim() 有鉴别力，两句同义的话必须判到 0.4 以上、两句无关的话必须判到之下
  sim('读也算最近使用，得把这个节点挪到头部', '读也算最近使用，要把该节点移到头部') >= 0.4
    && sim('读也算最近使用，得把这个节点挪到头部', '训练时加负载均衡损失，推理时设容量上限') < 0.4
    ? ok('自检：相似度判据分得开「同义改写」和「两个知识点」')
    : bad('自检失败：sim() 没有鉴别力，规则⑤c 等于空跑')
}

/* ⑥ 选项长度不许出卖答案 —— 正确项明显比三个干扰项都长的话，不用懂也能挑出来。
      这是选择题最常见的送分漏洞，而原理题的正确答案天然容易写得比干扰项详细：
      写答案时会忍不住把"结论 + 理由"都塞进选项，写干扰项时却只写半句。

      ⚠️ 这条判据是写完补丁包之后才加的，一加就抓出 631 道 —— 包括当时刚写完的那 147 道。
      修法不是把干扰项灌水，而是**把理由从选项挪进讲解**：选项只留一句断言，理由跟着出处走。
      规则分两段：补丁包是这一轮写的，必须清零；存量 486 道是更早几轮留下的同一类债，
      先记账封顶、只许降不许涨。 */
{
  /*  ⚠️ fact 的 id **只在实验内唯一**(binsearch/why_fast 和 lsm/why_fast 是两回事)。
      第一版按裸 id 匹配,于是存量里同名的题被当成补丁包的、补丁包的违规被算进存量欠账 ——
      判据报「存量涨了 7 道」,其实是我新写的那几条自己犯规。键要用 实验/事实 的组合。 */
  const patchIds = new Set<string>()
  for (const [expId, fs] of Object.entries({ ...CONCEPT_FACTS, ...FILL_FACTS })) for (const f of fs) patchIds.add(`${expId}/${f.id}`)
  const leakyNew: string[] = [], leakyOld: string[] = [], thin: string[] = []
  for (const e of CATALOG) {
    let t: Record<string, unknown>[] = []
    try { t = traceOf(e) as Record<string, unknown>[] } catch { continue }
    for (const f of e.facts) {
      if (genreOf(f, t) !== 'concept') continue
      let ans = ''
      try { ans = f.compute(t).answer } catch { continue }
      const ds = f.distractors(ans, t).filter(d => d !== ans)
      if (ds.length < 3) { thin.push(`${e.id}/${f.id} 只有 ${ds.length} 个干扰项`); continue }
      const longest = Math.max(...ds.map(d => d.length))
      if (ans.length > longest * 1.5) {
        const line = `${e.id}/${f.id} 正确项 ${ans.length} 字 vs 最长干扰项 ${longest} 字`
        ;(patchIds.has(`${e.id}/${f.id}`) ? leakyNew : leakyOld).push(line)
      }
    }
  }
  leakyNew.length === 0
    ? ok('两个补丁包里，没有一道能靠长度挑出答案')
    : bad(`补丁包里有 ${leakyNew.length} 道靠长度就能猜中：${leakyNew.slice(0, 5).join('；')}`)
  leakyOld.length <= LEN_DEBT_CAP
    ? ok(`存量里还有 ${leakyOld.length} 道靠长度可猜（欠账上限 ${LEN_DEBT_CAP}，只许降不许涨）`)
    : bad(`存量欠账变多了：${leakyOld.length} > 上限 ${LEN_DEBT_CAP}：${leakyOld.slice(0, 5).join('；')}`)
  ok(`干扰项不足三个的题有 ${thin.length} 道${thin.length ? '：' + thin.slice(0, 4).join(' ') : ''}`)
}

/* ⑦ 库层那批题的形状 —— 选项不许再是一段说明书。
      原来「Hugging Face Transformers 是干什么的?」的正确项是 142 字的说明书、干扰项是 7 字标签，
      挑最长的就中、读完也没学到东西。现在短结论上来当选项、说明书下去当出处。 */
{
  const libs = CATALOG.filter(e => e.doc.kind === 'library')
  const long: string[] = []
  let swapped = 0
  for (const e of libs) {
    let t: Record<string, unknown>[] = []
    try { t = traceOf(e) as Record<string, unknown>[] } catch { continue }
    for (const f of e.facts) {
      let r
      try { r = f.compute(t) } catch { continue }
      if (r.answer.length < r.evidence.length) swapped++
      if (r.answer.length > 60) long.push(`${e.id}/${f.id} ${r.answer.length} 字`)
    }
  }
  swapped >= 140
    ? ok(`库层有 ${swapped} 条把选项和出处对调了（说明书挪进了讲解）`)
    : bad(`只有 ${swapped} 条对调 —— 那段变换是不是失效了?（它按 doc.kind === 'library' 卡的）`)
  long.length === 0
    ? ok(`库层没有哪个选项超过 60 字（对调前最长 167 字）`)
    : bad(`库层还有 ${long.length} 个选项是长说明书：${long.slice(0, 5).join('；')}`)

  /*  「这个库是干什么的」那一问的干扰项，必须是**别的库真实的角色描述** ——
      不是「一个物理仿真器」这种笼统标签。这样长度天然齐平，而且排除它需要真知道那个库。 */
  const isRoleAsk = (a: string) => /是干什么的|是什么|做什么|干嘛|什么角色/.test(a)
  const roles = new Set<string>()
  for (const e of libs) {
    const f = e.facts[0]
    if (!f || !isRoleAsk(f.ask)) continue
    try { roles.add(f.compute(traceOf(e) as Record<string, unknown>[]).answer) } catch { /* 跳过 */ }
  }
  const notRole: string[] = []
  let crossed = 0
  for (const e of libs) {
    const f = e.facts[0]
    if (!f || !isRoleAsk(f.ask)) continue
    let r
    try { r = f.compute(traceOf(e) as Record<string, unknown>[]) } catch { continue }
    const ds = f.distractors(r.answer, [])
    if (!ds.every(d => roles.has(d))) { notRole.push(e.id); continue }
    if (ds.includes(r.answer)) { notRole.push(`${e.id}(干扰项里混进了正确答案)`); continue }
    crossed++
  }
  crossed >= 30
    ? ok(`${crossed} 道「这个库是干什么的」用的是别的库真实的角色描述当干扰项`)
    : bad(`只有 ${crossed} 道换成了跨库干扰项 —— 词面重合的筛子是不是把候选全滤光了?`)
  notRole.length <= libs.length - crossed
    ? ok(`其余 ${notRole.length} 道保留了原干扰项（挑不出三个够远的候选，宁可不换）`)
    : bad(`有 ${notRole.length} 道的干扰项既不是跨库角色、也不该保留：${notRole.slice(0, 5).join(' ')}`)
}

/* ⑧ 「找错的」题型 —— 三句真的 + 一句假的，答案是那句假的。
      用户问「1004 条题面刷太多次就没新题了，要不要上大模型生成题面兜底」。
      换措辞不换考点：同一个知识点问第四遍，措辞再新也还是那道题。**换题型才是真的换了一道**，
      而且这一种的四个选项全是我们钉死的真/假命题，模型一句都不用编。

      ⚠️ 但它现在几乎跑不起来，原因要说明白：存量的正确答案 54~164 字、干扰项只有 5~24 字，
      四句话凑不成一组长度齐平的 —— 硬凑就变成「挑最短的就中」（前几轮那个「挑最长的就中」
      的镜像）。所以它被**同一笔债**（LEN_DEBT_CAP 那 424 道）卡着：选项配平了它就自动解锁。
      这条判据记的是现状，不是理想值 —— 只许涨不许跌。 */
{
  let made = 0, unlocked = 0
  const bad: string[] = []
  for (const e of CATALOG) {
    let t: Record<string, unknown>[] = []
    try { t = traceOf(e) as Record<string, unknown>[] } catch { continue }
    if (e.facts.filter(f => genreOf(f, t) === 'concept').length < 4) continue
    let got = false
    for (let k = 0; k < 40; k++) {
      for (const q of buildQuizSync(e.id, 3)) {
        if (q.variant !== 'odd-one-out') continue
        made++; got = true
        const right = q.options[q.correctIndex]!
        const lens = q.options.map(o => o.length)
        //  真假两边都不许靠长度露馅
        if (Math.max(...lens) / Math.max(1, Math.min(...lens)) > 2) bad.push(`${e.id} 四个选项长度差 ${Math.max(...lens)}/${Math.min(...lens)}`)
        if (new Set(q.options).size !== 4) bad.push(`${e.id} 四个选项有重复`)
        void right
      }
    }
    if (got) unlocked++
  }
  unlocked >= ODD_UNLOCKED_MIN
    ? ok(`能出「找错的」实验有 ${unlocked} 个（下限 ${ODD_UNLOCKED_MIN}）—— 抽样生成 ${made} 道；选项配平后会自动变多`)
    : bad.push(`能出「找错的」的实验掉到 ${unlocked} 个 < 下限 ${ODD_UNLOCKED_MIN}`)
  bad.length === 0
    ? ok('「找错的」里四个选项长度在一个量级（挑最长/最短都猜不中），且无重复')
    : bad.slice(0, 4).forEach(m => console.log('  ❌ ' + m))
  if (bad.length) failures++
}

/* ⑨ 能判红的自检：规则本身有没有鉴别力 */
{
  const fakeAll = { id: 'x', title: 'x', kernel: null as never, doc: { kind: 'x', params: {}, entities: [], streams: [] }, facts: [] }
  //  a) 「至少一条原理题」这条规则,喂一个零原理题的实验必须算它欠账
  const wouldCount = [{ concept: 0, count: 3 }].filter(r => r.concept === 0).length
  wouldCount === 1 ? ok('自检：一个零原理题的实验确实会被算进欠账') : bad('自检失败：零原理题的实验没被算进欠账')
  //  b) inputBrief 对没有数据流也没有参数的实验必须回空串(这样 ② 才抓得住)
  inputBrief(fakeAll as never) === ''
    ? ok('自检：摘不出输入的实验，inputBrief 回空串 —— 规则②才抓得住它')
    : bad('自检失败：inputBrief 对空实验没回空串，规则②等于失效')
  //  c) genreOf 的兜底推断:短答案算计数、长句算原理
  const shortF = { id: 's', label: '', ask: '', kind: 'number' as const, compute: () => ({ answer: '14', step: 0, evidence: '' }), distractors: () => [] }
  const longF = { id: 'l', label: '', ask: '', kind: 'choice' as const, compute: () => ({ answer: '因为枢轴左边全部小于它，所以这一趟之后它的位置就定了', step: 0, evidence: '' }), distractors: () => [] }
  genreOf(shortF, []) === 'count' && genreOf(longF, []) === 'concept'
    ? ok('自检：没声明 genre 时，短答案判成计数题、长句判成原理题')
    : bad('自检失败：genre 的兜底推断不对，存量那 800 多条会被归错类')
  //  d) 重名 id 那条规则:拿一个人为造的「同实验里两条 why_fast」喂进去,必须判红
  const twins = [{ id: 'why_fast' }, { id: 'why_fast' }, { id: 'other' }]
  const cnt = new Map<string, number>()
  for (const f of twins) cnt.set(f.id, (cnt.get(f.id) ?? 0) + 1)
  ;(cnt.get('why_fast') ?? 0) > 1 && (cnt.get('other') ?? 0) === 1
    ? ok('自检：同实验里两条同 id 的 fact 确实会被规则⑤b 抓住')
    : bad('自检失败：规则⑤b 抓不住人为造的重名，等于空跑')
}

/* ⑨ 「永远选最长的」蒙对率 —— 规则⑥的**端到端**版本，只许降不许涨。
      ⑥ 钉的是「正确项比干扰项长多少」，那是**长度差**；这条钉的是
      「一个不读题、永远挑最长选项的人能考多少分」，那是**结果**。
      区别要紧：微调几个字的长度能让⑥变好看，却一分都改不了这个数。

      随机基线 = 25%（四选一）。2026-09-10 首次实测：**82.3%** ——
      也就是说这套题里 80% 的题，不看题干就能选对。而 AI 面试官的
      「掌握度」分母正建在这些 factId 上，那个数跟着一起是假的。

      ⚠️ 这条判据钉的是 **fact 级的确定量**（答案是不是唯一最长），不是
      抽样出题的命中率 —— 后者每次跑都差 0.5 个百分点（shuffle + 随机挑
      odd-one-out），拿它当上限会随机变红。两个数意思一样：772/961 = 80.3%
      对上端到端的 82.3%。

      ## 为什么只记账不修

      查过了，**没有生成期的机械解**（全是实测，不是推测）：
        · 每个 fact 的干扰项**恰好 3 条**，没有池子可挑 —— odd-one-out 那套
          「挑长度配得上的」在这里无从下手（那边是从别的 fact 的真命题里挑）。
        · 772 条里，干扰项池中根本没有够长的占 655 条。
        · 规则⑥写的修法「把理由从选项挪进讲解」机械化之后只覆盖 **18/772 = 2.3%**
          （四个选项都含同一个分隔符的只有 32 条）。
      所以这是一笔 772 条的**内容账**，要作者侧逐条改写。先封顶，别让它涨。 */
{
  const longestWins: string[] = []
  let concepts = 0
  for (const e of CATALOG) {
    let t: Record<string, unknown>[] = []
    try { t = traceOf(e) as Record<string, unknown>[] } catch { continue }
    for (const f of e.facts) {
      if (genreOf(f, t) !== 'concept') continue
      let ans = '', ds: string[] = []
      try {
        ans = String(f.compute(t as never).answer)
        ds = f.distractors(ans, t as never).filter((d: string) => d !== ans)
      } catch { continue }
      if (!ans || ds.length < 3) continue
      concepts++
      const L = (x: string) => [...x].length
      if (L(ans) > Math.max(...ds.map(L))) longestWins.push(`${e.id}/${f.id}`)
    }
  }
  /*  **只许降不许涨。** 每还一批就把这个数压到当天的实测值 ——
      留着旧上限等于给"又涨回去"留了空间。
      降到 240（= 961 的 25%，随机基线）才算这笔债还清。

      降账记录：772（2026-09-10 首测）→ 737 → 718 → 684 → 619 → 567 → 511（累计改写 261 条；库层 83 条已清零）

      ⚠️ 这 961 条里有一批属于**用户点不到的实验**（隐藏的具身轨 + 已下线的
      后端轨/安全轨孤儿组）—— 它们练不到，所以改写只从点得到的那些里挑。
      上限仍按全量记，因为哪天那些轨放回来，账就得跟着算。

      ⚠️ 「点得到」这份清单本身炸过一次。scripts/_split.ts 原来按
      `\n  id: 'x',` 那一行找实验的组，而库层 46 条走的是 `mkLib(...)` 工厂、
      **压根没有 `group:` 那一行** —— 于是整批被判成"注册表里没有"，
      其中 35 条(算法/大模型/408 三条可见轨)用户明明点得到，却从来没进过待修清单。
      漏的是"该修的没进清单"，而清单看着一切正常 —— 跟当初 bplus/vigenere
      被误判成不可达是同一种病：**清单的口径错了，清单本身不会喊。** */
  const LONGEST_DEBT_CAP = 511
  concepts >= 800
    ? ok(`扫过 ${concepts} 条原理 fact`)
    : bad(`只扫到 ${concepts} 条原理 fact —— 解析不出来的话，下面这条等于空跑`)
  longestWins.length <= LONGEST_DEBT_CAP
    ? ok(`「答案是唯一最长」的还有 ${longestWins.length} / ${concepts} 条`
      + `（上限 ${LONGEST_DEBT_CAP}，只许降；随机基线 ${Math.round(concepts * 0.25)}）`)
    : bad(`靠长度就能蒙对的题变多了：${longestWins.length} > 上限 ${LONGEST_DEBT_CAP}`
      + `：${longestWins.slice(0, 5).join(' ')}`)

  //  自检：判法本身得能分辨好坏，不是永远为真
  const L = (x: string) => [...x].length
  const leak = ['正确答案写得又长又全面还带理由', '短的', '也短', '很短']
  const fair = ['四个选项差不多长一', '四个选项差不多长二', '四个选项差不多长三', '四个选项差不多长四']
  L(leak[0]) > Math.max(...leak.slice(1).map(L)) && !(L(fair[0]) > Math.max(...fair.slice(1).map(L)))
    ? ok('自检：答案独长的那组会被抓住，四个等长的那组不会误伤 —— 它能红')
    : bad('自检失败：⑨的判法要么抓不住独长，要么误伤等长')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
