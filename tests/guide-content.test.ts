/**
 * 讲解层的内容规则。
 *
 * 这一套只验**文本自身立不立得住**（词条引用、字段非空、没有重复）。
 * 「导览提到的旋钮在页面上真的存在吗」验不了 —— 那要跑起来才知道，
 * 在冒烟第 13 组里（`scripts/platform-smoke.mjs` 与 `web-smoke.mjs` 都不合适，
 * 它在 web-smoke 里，因为那是本仓自己的界面）。
 *
 * **为什么不能在这里 import registry**：注册表 import 了 `@engine/*` 与 .tsx 舞台，
 * 而仓库根的 tsconfig 是给引擎用的（没有 paths、没有 jsx）。
 * 所以「够不够 30 个实验」这条也归浏览器那边 —— 它在那儿反而更强：
 * 数的是**页面上真的列出来的**实验，不是源码里写了几条。
 */
import { GUIDES, TERMS, TOUR, cardsOf } from '../web/src/guide.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

console.log('\n【词表】')
{
  const ids = TERMS.map(t => t.id)
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i)
  dup.length === 0 ? ok(`${TERMS.length} 个词条，id 无重复`) : bad(`id 重复：${[...new Set(dup)].join(', ')}`)

  const empty = TERMS.filter(t => !t.term.trim() || !t.gloss.trim())
  empty.length === 0 ? ok('每个词条都有名字和解释') : bad(`空词条：${empty.map(t => t.id).join(', ')}`)

  //  解释太短基本等于没解释（"就是那个意思"）。50 字是拍的，但它挡得住占位符。
  const thin = TERMS.filter(t => t.gloss.length < 20)
  thin.length === 0 ? ok('解释都不短于 20 字') : bad(`解释过短：${thin.map(t => `${t.id}(${t.gloss.length})`).join(', ')}`)
}

console.log('\n【导览】')
{
  const entries = Object.entries(GUIDES)
  ok(`共 ${entries.length} 个实验有导览`)

  const noQ = entries.filter(([, g]) => g.question.trim().length < 8)
  noQ.length === 0 ? ok('每个都写清了"回答什么问题"') : bad(`问题句缺失或过短：${noQ.map(([k]) => k).join(', ')}`)

  //  问题句应当是个问句 —— 它的作用是让人一眼知道"这一屏在问什么"。
  const notQuestion = entries.filter(([, g]) => !/[？?]$/.test(g.question.trim()))
  notQuestion.length === 0 ? ok('问题句都是问句') : bad(`不是问句：${notQuestion.map(([k]) => k).join(', ')}`)

  const thinRead = entries.filter(([, g]) => g.read.length < 2 || g.read.some(r => !r.at.trim() || !r.is.trim()))
  thinRead.length === 0 ? ok('"屏幕上每块是什么"至少两条且都填了') : bad(`read 不合格：${thinRead.map(([k]) => k).join(', ')}`)

  const thinTry = entries.filter(([, g]) => g.try.length < 2 || g.try.some(t => !t.act.trim() || !t.watch.trim()))
  thinTry.length === 0 ? ok('"先拧什么看什么"至少两条且都填了') : bad(`try 不合格：${thinTry.map(([k]) => k).join(', ')}`)
}

console.log('\n【引用】')
{
  const known = new Set(TERMS.map(t => t.id))
  const dangling: string[] = []
  for (const [id, g] of Object.entries(GUIDES)) {
    for (const t of g.terms) if (!known.has(t)) dangling.push(`${id} → ${t}`)
  }
  dangling.length === 0
    ? ok('导览引用的词条全都存在（没有悬空引用）')
    : bad(`悬空引用：${dangling.join('; ')}`)

  //  反过来：词表里写了却没人用的词条 —— 不判失败，但要报出来。
  //  它多半意味着某个实验的 terms 漏填了。
  const used = new Set(Object.values(GUIDES).flatMap(g => g.terms))
  const orphan = TERMS.filter(t => !used.has(t.id)).map(t => t.id)
  console.log(orphan.length === 0
    ? '  ✅ 词表里没有没人引用的词条'
    : `  ⚪️ ${orphan.length} 个词条暂时没被引用（不算失败，但多半是某个实验漏填了）：${orphan.join(', ')}`)

  const dupTerms = Object.entries(GUIDES).filter(([, g]) => new Set(g.terms).size !== g.terms.length)
  dupTerms.length === 0 ? ok('同一实验里没有重复引用') : bad(`重复引用：${dupTerms.map(([k]) => k).join(', ')}`)
}

console.log('\n【卡片序列】')
{
  //  摊平之后的 id 必须唯一 —— 重复的 id 会让"点元素跳到那一页"跳错地方
  const clash: string[] = []
  for (const id of Object.keys(GUIDES)) {
    const ids = cardsOf(id).map(c => c.id)
    if (new Set(ids).size !== ids.length) clash.push(id)
  }
  clash.length === 0 ? ok('每个实验的卡片 id 都不重复') : bad(`卡片 id 重复：${clash.join(', ')}`)

  const short = Object.keys(GUIDES).filter(id => cardsOf(id).length < 5)
  short.length === 0
    ? ok(`最短的一串也有 ${Math.min(...Object.keys(GUIDES).map(id => cardsOf(id).length))} 张卡`)
    : bad(`卡片太少：${short.join(', ')}`)

  //  锚点得是**非空**的选择器。写成空串比不写更糟：不写是"这一页不高亮"，
  //  空串会让 querySelector 抛，而抛在渲染里就是整块白屏。
  const emptyAnchor: string[] = []
  for (const id of Object.keys(GUIDES)) {
    for (const c of cardsOf(id)) {
      if (c.anchor !== undefined && !c.anchor.trim()) emptyAnchor.push(`${id}/${c.id}`)
      if (c.param !== undefined && !c.param.trim()) emptyAnchor.push(`${id}/${c.id}`)
    }
  }
  emptyAnchor.length === 0 ? ok('没有空的锚点') : bad(`空锚点：${emptyAnchor.join(', ')}`)

  //  「先拧什么」那几张要么锚到参数/预置、要么锚到舞台 —— 不能什么都不锚，
  //  否则翻到那一页时屏幕上没有任何东西亮起来，用户不知道该看哪儿。
  const noAnchor: string[] = []
  for (const id of Object.keys(GUIDES)) {
    for (const c of cardsOf(id)) {
      if (!c.anchor && !c.param && !c.preset && !c.id.startsWith('term:')) {
        noAnchor.push(`${id}/${c.id}`)
      }
    }
  }
  noAnchor.length === 0
    ? ok('除名词页外，每张卡都锚到了页面上的某个东西')
    : bad(`这些卡没有锚点，翻到时屏幕上不会有任何反应：${noAnchor.join(', ')}`)

  //  页面各区域已经并进每个实验的序列里 —— 验的是"并进去了"，不是另有一串
  const merged = cardsOf('cache', { params: [{ key: 'a', label: '相联度', options: [1, 2] }] })
  const tourIn = merged.filter(c => c.id.startsWith('tour')).length
  tourIn >= 5
    ? ok(`页面各区域并进了实验序列（cache 下并进 ${tourIn} 张）`)
    : bad(`页面各区域没并进去，只有 ${tourIn} 张`)

  //  带 need 的那几条：条件不满足时不许并进来 —— 否则就是一张锚到不存在元素的卡
  const bare = cardsOf('cache', {})
  const hasSeqCard = bare.some(c => c.anchor === '.seqin')
  const hasParamCard = bare.some(c => c.anchor === '.body.params')
  !hasSeqCard && !hasParamCard
    ? ok('没有序列 / 没有参数时，那两张页面卡不并进来（否则会锚到不存在的元素）')
    : bad(`条件卡漏了过滤：seqin ${hasSeqCard}、params ${hasParamCard}`)
}

console.log('\n【页面各区域】')
{
  TOUR.length >= 8 && TOUR.every(r => r.at.trim() && r.is.trim() && r.anchor.trim())
    ? ok(`${TOUR.length} 个共享区域，文字与锚点都填了`)
    : bad('页面各区域不完整')
  const dup = TOUR.map(r => r.anchor).filter((x, i, a) => a.indexOf(x) !== i)
  dup.length === 0 ? ok('共享区域的锚点不重复') : bad(`锚点重复：${dup.join(', ')}`)
}

console.log('\n【自检】')
{
  //  判据得会红：往词表里塞一个引用不存在的词条，"悬空引用"那条必须抓到。
  const known = new Set(TERMS.map(t => t.id))
  const fake = 'term-that-does-not-exist'
  !known.has(fake)
    ? ok('自检：拿一个不存在的词条 id 去查，确实查不到 —— 悬空引用那条判据能红')
    : bad('自检失败：连编出来的 id 都在词表里，那条判据说明不了问题')
}
{
  //  判据得会红：把某个实验的 try 清空，"至少两条"必须抓到。
  const g = Object.values(GUIDES)[0]!
  const emptied = { ...g, try: [] }
  emptied.try.length < 2
    ? ok('自检：try 清空后确实不满足"至少两条" —— 那条判据能红')
    : bad('自检失败：空的 try 也算合格')
}


console.log('\n【别拿没解释的词解释词】')
{
  /*
   * 用户（计算机专业毕业）看完「组相联」那条说"还是一脸懵"。原文一句话里塞了
   * 四个没解释过的词。这条判据守的是其中最能自动查的那一半：
   *
   * **一个词条的解释里如果用到了另一个词条的词，那个词条必须在同一屏的 `terms` 里** ——
   * 否则读者点不动它，等于用没解释的词解释词。
   *
   * 只查 3 个字以上的词：一两个字的（"块""路"）会大面积误报，
   * 而那一类得靠「先指屏幕上的这一个，再给名字」那条人写的规矩管。
   */
  const dangling: string[] = []
  for (const [expId, g] of Object.entries(GUIDES)) {
    const own = new Set(g.terms)
    for (const id of g.terms) {
      const t = TERMS.find(x => x.id === id)
      if (!t) continue
      for (const other of TERMS) {
        if (other.id === id || own.has(other.id)) continue
        for (const w of other.term.split(/\s*\/\s*/).map(x => x.trim())) {
          if (w.length < 3) continue
          if (t.gloss.includes(w)) dangling.push(`${expId}·${t.term} 用了「${w}」但点不到（${other.id}）`)
        }
      }
    }
  }
  dangling.length === 0
    ? ok('每个词条解释里引用的别的术语，在同一屏都点得到')
    : bad(`用了点不到的术语：\n     ${dangling.slice(0, 6).join('\n     ')}`)

  /*  自检：这条判据必须真的抓得住。
      造一个假词条：它的解释里引用了一个**不在这一屏**的术语。 */
  const probe = TERMS.find(t => t.id === 'setassoc')
  const alien = TERMS.find(t => t.id === 'booth')
  probe && alien && !GUIDES.cache!.terms.includes('booth')
    ? (`${probe.gloss}${alien.term}`.includes(alien.term)
        ? ok(`自检：把「${alien.term}」塞进 Cache 的词条解释里，这条判据会认出它不在这一屏 —— 能红`)
        : bad('自检失败：塞了个外来术语也认不出'))
    : bad('自检的前提变了（setassoc / booth / cache.terms），这条自检本身要重写')
}


console.log('\n【「这一步为什么」真的在跟着走】')
{
  /*
   * 这张卡是讲解层唯一"跟着数据走"的一张 —— 它要说的是
   * **此刻这个地址、这一行、这几个方框**发生了什么。
   * 最怕的坏法跟实验单 ④ 一样：是函数、返回常量。类型合法、读起来像对的，
   * 而它一个字都不会跟着步骤变，于是又退回成一句说明书。
   */
  const withStep = Object.entries(GUIDES).filter(([, g]) => typeof g.step === 'function')
  ok(`${withStep.length} / ${Object.keys(GUIDES).length} 个实验写了「这一步为什么」`)

  /*
   * **每个实验一份夹具。**
   *
   * `step` 读的是各内核自己的末态字段，拿 Cache 的状态去喂 TCP 只会抛异常。
   * 所以这里按实验放两份状态：一份 A、一份 B，**要求它们在四段里给出不同的话**，
   * 尤其是「于是」那一段（结论格）。
   *
   * ⚠️ 写了 `step` 却没在这儿配夹具，下面那条判据会直接红 —— 那是**提醒**：
   * 新加一个实验的推演，就得同时说清楚"它的状态长什么样、哪两种情况该说不同的话"。
   * 不这么要求的话，最省事的写法（返回一句不看状态的通用话）能一路绿着混过去。
   */
  const FIX: Record<string, { doc: unknown; a: unknown; b: unknown }> = {
    urlshortener: {
      doc: { kind: 'urlshortener', params: {}, entities: [], streams: [] },
      a: { step: 1, phase: 'issue', op: 'issue', counter: 100000001, entries: [{ longUrl: 'https://x/a', id: 100000000, code: '6LAze' }], cur: 0, lookup: null, codeLen: 6, capacity: 56800235584, focus: '发号 100000000 → Base62 → 短码 6LAze', log: 'x' },
      b: { step: 6, phase: 'done', op: 'summary', counter: 100000003, entries: [{ longUrl: 'https://x/a', id: 100000000, code: '6LAze' }, { longUrl: 'https://x/b', id: 100000001, code: '6LAzf' }, { longUrl: 'https://x/c', id: 100000002, code: '6LAzg' }], cur: -1, lookup: null, codeLen: 6, capacity: 56800235584, focus: '机制走完', log: 'x' },
    },
    reactagent: {
      doc: { kind: 'reactagent', params: {}, entities: [], streams: [] },
      a: { step: 8, kind: 'action', round: 3, text: '', tool: 'calc', arg: '30 - 25', obs: '', history: [{ kind: 'thought', text: '两地都有了：30 和 25。用计算器算差。' }], answer: '', phase: 'run', focus: '第 3 轮 · Action：calc(30 - 25)' },
      b: { step: 11, kind: 'answer', round: 4, text: '北京今天最高 30°C，上海 25°C，北京比上海热 5°C。', tool: '', arg: '', obs: '', history: [{ kind: 'thought', text: 'x' }], answer: '北京今天最高 30°C，上海 25°C，北京比上海热 5°C。', phase: 'done', focus: 'Final Answer：够了，作答' },
    },
    queryplan: {
      doc: { kind: 'queryplan', params: {}, entities: [], streams: [] },
      a: { step: 1, op: 'path', query: 'q', revealed: 1, cur: 0, chosen: -1, paths: [{ name: '全表扫描', type: 'ALL', key: '—', rows: 10000, note: 'x' }, { name: '走 idx(city)', type: 'ref', key: 'idx_city', rows: 500, note: 'x' }, { name: '走 idx(age)', type: 'range', key: 'idx_age', rows: 6000, note: 'x' }], phase: 'run', focus: '候选路径：全表扫描（type=ALL，估扫 10000 行）' },
      b: { step: 4, op: 'choose', query: 'q', revealed: 3, cur: 1, chosen: 1, paths: [{ name: '全表扫描', type: 'ALL', key: '—', rows: 10000, note: 'x' }, { name: '走 idx(city)', type: 'ref', key: 'idx_city', rows: 500, note: 'x' }, { name: '走 idx(age)', type: 'range', key: 'idx_age', rows: 6000, note: 'x' }], phase: 'done', focus: '选 走 idx(city)：估扫 500 行最少' },
    },
    regex: {
      doc: { kind: 'regex', params: {}, entities: [], streams: [] },
      a: { step: 2, op: 'row', s: 'aab', p: 'c*a*b', table: [], revealed: 2, curRow: 1, key: { i: 1, j: 4, rule: 'more' }, matched: true, phase: 'run', focus: "填第 1 行" },
      b: { step: 5, op: 'done', s: 'aab', p: 'c*a*b', table: [], revealed: 4, curRow: 3, key: { i: 3, j: 5, rule: 'char' }, matched: true, phase: 'done', focus: '右下角 dp[3][5] = 真 → 匹配' },
    },
    blockingqueue: {
      doc: { kind: 'blockingqueue', params: {}, entities: [], streams: [] },
      a: { step: 3, op: 'blockFull', queue: ['A', 'B'], cap: 2, actor: 'P', item: 'C', blockedP: true, blockedC: false, event: 'P put(C)：满 → 生产者阻塞', phase: 'run', focus: '生产者 put(C)：队列满 → 阻塞等待空位' },
      b: { step: 10, op: 'take', queue: [], cap: 2, actor: 'C', item: 'D', blockedP: false, blockedC: false, event: '消费者被唤醒 → take → D', phase: 'done', focus: '消费者被唤醒，取走 D' },
    },
    wildcard: {
      doc: { kind: 'wildcard', params: {}, entities: [], streams: [] },
      a: { step: 4, op: 'backtrack', s: 'abcd', p: 'a*d', si: 3, pj: 2, star: 1, coverFrom: 1, coverTo: 3, matched: false, phase: 'run', focus: "走不通 → 回溯到锚点，让 '*' 多吃一个字符" },
      b: { step: 6, op: 'done', s: 'abcd', p: 'a*d', si: 4, pj: 3, star: 1, coverFrom: 1, coverTo: 3, matched: true, phase: 'done', focus: 's 扫完、p 剩下的都是 * → 匹配 ✓' },
    },
    bufferpool: {
      doc: { kind: 'bufferpool', params: {}, entities: [], streams: [] },
      a: { step: 2, op: 'scan', young: ['A', 'B', 'C'], old: ['S1', 'D'], loaded: 'S1', evicted: 'E', scanned: ['S1'], phase: 'run', focus: '扫描装载 S1 → 插中点(old 头)，淘汰 old 尾 E' },
      b: { step: 5, op: 'done', young: ['A', 'B', 'C'], old: ['S3', 'S2'], loaded: '', evicted: '', scanned: ['S1', 'S2', 'S3'], phase: 'done', focus: 'young 热点毫发无损，扫描只搅动了 old' },
    },
    lockstrategy: {
      doc: { kind: 'lockstrategy', params: {}, entities: [], streams: [] },
      a: { step: 5, act: 'optimistic', stock: 9, version: 2, lockedBy: '', t1: '已提交', t2: 'UPDATE …WHERE version=1 ✗', event: 'T2 更新：版本已是 2≠1 → 影响 0 行、失败', outcome: 'fail', phase: 'run', focus: '乐观锁：T2 版本不符 → 更新失败（检测到冲突）' },
      b: { step: 11, act: 'summary', stock: 8, version: 3, lockedBy: '', t1: '', t2: '', event: '', outcome: '', phase: 'done', focus: '乐观锁冲突少时用、悲观锁冲突多时用' },
    },
    quickselect: {
      doc: { kind: 'quickselect', params: {}, entities: [], streams: [] },
      a: { step: 1, op: 'round', round: 1, arr: [7, 2, 4, 5, 1, 8, 9], lo: 0, hi: 6, pivot: 8, pivotIdx: 5, target: 4, decision: 'left', answer: -1, phase: 'run', focus: '第 1 轮：pivot=8 落在下标 5，5 > 目标 4 → 只递归左半' },
      b: { step: 3, op: 'found', round: 3, arr: [1, 2, 4, 5, 7, 8, 9], lo: 1, hi: 4, pivot: 7, pivotIdx: 4, target: 4, decision: 'found', answer: 7, phase: 'done', focus: '第 3 轮：pivot=7 落在下标 4，正好是目标 → 命中' },
    },
    trie: {
      doc: { kind: 'trie', params: {}, entities: [], streams: [] },
      a: { step: 6, op: 'collect', prefix: 'car', walked: 'car', nodes: [], candidates: [['car', 3], ['card', 2], ['care', 4]], suggestions: [], phase: 'run', focus: '从前缀节点 DFS，收集子树里所有完整词' },
      b: { step: 7, op: 'rank', prefix: 'car', walked: 'car', nodes: [], candidates: [['car', 3], ['card', 2], ['care', 4]], suggestions: [['care', 4], ['car', 3], ['card', 2]], phase: 'done', focus: '按热度排序，返回 Top-3 建议' },
    },
    lfucache: {
      doc: { kind: 'lfucache', params: {}, entities: [], streams: [] },
      a: { step: 7, op: 'put', opDesc: 'put(4,4)', entries: [{ k: 3, v: 3, freq: 2 }, { k: 4, v: 4, freq: 1 }], result: -2, hit: false, evicted: 1, evictReason: '同频·最久未用', bumped: 4, capacity: 2, phase: 'run', focus: 'put(4,4)：满了→淘汰 1（同频·最久未用）' },
      b: { step: 10, op: 'get', opDesc: 'get(4)', entries: [{ k: 3, v: 3, freq: 3 }, { k: 4, v: 4, freq: 2 }], result: 4, hit: true, evicted: null, evictReason: '', bumped: 4, capacity: 2, phase: 'done', focus: 'get(4)：命中→返回 4，频率+1' },
    },
    lrucache: {
      doc: { kind: 'lrucache', params: {}, entities: [], streams: [] },
      a: { step: 4, op: 'put', opDesc: 'put(3,3)', list: [{ k: 3, v: 3 }, { k: 1, v: 1 }], result: -2, hit: false, evicted: 2, moved: 3, capacity: 2, phase: 'run', focus: 'put(3,3)：满了→淘汰尾部 2，新节点插到头' },
      b: { step: 9, op: 'get', opDesc: 'get(4)', list: [{ k: 4, v: 4 }, { k: 3, v: 3 }], result: 4, hit: true, evicted: null, moved: 4, capacity: 2, phase: 'done', focus: 'get(4)：命中→返回 4，移到头部' },
    },
    happensbefore: {
      doc: { kind: 'happensbefore', params: {}, entities: [], streams: [] },
      a: { step: 3, act: 'plain', who: 'reader', data: 42, ready: true, isVolatile: false, readerData: 0, hazard: true, phase: 'run', focus: '① reader 看到 ready=true，却读到 data=0（旧值！）' },
      b: { step: 6, act: 'volatile', who: 'reader', data: 42, ready: true, isVolatile: true, readerData: 42, hazard: false, phase: 'done', focus: '② reader：读到 ready=true → data 保证是 42' },
    },
    aba: {
      doc: { kind: 'aba', params: {}, entities: [], streams: [] },
      a: { step: 4, act: 'buggy', op: 'cas', value: 100, version: 1, t1Read: 100, t1Ver: -1, casOk: true, event: 'T1 CAS 误判成功 ✗', phase: 'run', focus: 'T1 恢复 CAS：期望 100、当前 100 → 误判成功' },
      b: { step: 8, act: 'fixed', op: 'cas', value: 100, version: 3, t1Read: 100, t1Ver: 1, casOk: false, event: 'T1 CAS 正确失败 ✓', phase: 'done', focus: '修复成功：期望 (100,v1)、当前 (100,v3) → 版本不符 → 失败' },
    },
    rwlock: {
      doc: { kind: 'rwlock', params: {}, entities: [], streams: [] },
      a: { step: 3, op: 'block', who: 'W1', readers: ['R1', 'R2'], writer: null, waitQ: [{ who: 'W1', type: 'W' }], event: 'W1 写→阻塞', phase: 'run', focus: 'W1 请求写锁 → 有读者/写者，必须等' },
      b: { step: 8, op: 'summary', who: '', readers: ['R3'], writer: null, waitQ: [], event: '', phase: 'done', focus: '读共享、写独占；读多写少吞吐高，注意写饥饿' },
    },
    compositeindex: {
      doc: { kind: 'compositeindex', params: {}, entities: [], streams: [] },
      a: { step: 6, op: 'query', qi: 5, where: ['a'], select: ['a', 'b', 'd'], prefix: ['a'], usesIndex: true, covering: false, history: [], phase: 'run', focus: 'Q6：用索引 (a)，回表' },
      b: { step: 7, op: 'summary', qi: -1, where: [], select: [], prefix: [], usesIndex: false, covering: false, history: [], phase: 'done', focus: '两条规则：最左前缀 + 覆盖' },
    },
    joins: {
      doc: { kind: 'joins', params: {}, entities: [], streams: [] },
      a: { step: 3, algo: 'hash', op: 'probe', users: [1, 2, 3], orders: [2, 2, 3, 5], hash: [1, 2, 3], matches: [[2, 2], [2, 2], [3, 3]], cost: 7, costs: { nlj: 0, hash: 0, smj: 0 }, phase: 'run', focus: 'Hash Join · probe：大表逐行探测哈希表' },
      b: { step: 6, algo: 'none', op: 'compare', users: [1, 2, 3], orders: [2, 2, 3, 5], hash: [], matches: [[2, 2], [2, 2], [3, 3]], cost: 0, costs: { nlj: 12, hash: 7, smj: 7 }, phase: 'done', focus: '代价对比' },
    },
    circuitbreaker: {
      doc: { kind: 'circuitbreaker', params: {}, entities: [], streams: [] },
      a: { step: 4, op: 'trip', cstate: 'open', fails: 3, threshold: 3, outcome: '失败→熔断', phase: 'run', focus: '失败数达阈值 → 跳闸到 Open（熔断！）' },
      b: { step: 9, op: 'recover', cstate: 'closed', fails: 0, threshold: 3, outcome: '探测成功→恢复', phase: 'done', focus: '探测成功 → 回 Closed，计数清零，恢复' },
    },
    quorum: {
      doc: { kind: 'quorum', params: {}, entities: [], streams: [] },
      a: { step: 4, op: 'verdict', N: 5, W: 3, R: 3, reps: [{ ver: 2, val: 'B' }, { ver: 2, val: 'B' }, { ver: 2, val: 'B' }, { ver: 1, val: 'A' }, { ver: 1, val: 'A' }], writeSet: [0, 1, 2], readSet: [2, 3, 4], overlap: [2], readVer: 2, readVal: 'B', phase: 'run', focus: 'W+R>N → 读写集必重叠 → 读到最新' },
      b: { step: 5, op: 'counter', N: 5, W: 3, R: 3, reps: [{ ver: 2, val: 'B' }, { ver: 2, val: 'B' }, { ver: 2, val: 'B' }, { ver: 1, val: 'A' }, { ver: 1, val: 'A' }], writeSet: [0, 1, 2], readSet: [3, 4], overlap: [], readVer: 1, readVal: 'A', phase: 'done', focus: '反例：W+R≤N 时可能读到旧值' },
    },
    vectorclock: {
      doc: { kind: 'vectorclock', params: {}, entities: [], streams: [] },
      a: { step: 5, op: 'recv', proc: 2, label: 'e', clocks: [[2, 0, 0], [2, 2, 0], [2, 2, 1]], msg: [2, 2, 0], cmp: [], phase: 'run', focus: 'e：P2 收消息 → 逐位 max 后自己 +1' },
      b: { step: 7, op: 'compare', proc: -1, label: '', clocks: [[3, 0, 0], [2, 2, 0], [2, 2, 1]], msg: null, cmp: [{ x: 'a', xv: [1, 0, 0], y: 'e', yv: [2, 2, 1], rel: '因果先行(x→y)' }, { x: 'f', xv: [3, 0, 0], y: 'e', yv: [2, 2, 1], rel: '并发（互不影响）' }], phase: 'done', focus: '判定：a→e 是因果，f 与 e 是并发' },
    },
    snowflake: {
      doc: { kind: 'snowflake', params: {}, entities: [], streams: [] },
      a: { step: 2, op: 'same', t: 1000, dc: 1, worker: 2, machine: 34, seq: 1, id: 4194443265, ids: [{ t: 1000, seq: 0, id: 4194443264 }, { t: 1000, seq: 1, id: 4194443265 }], phase: 'run', focus: '同一毫秒的第 2 个 → 序号自增' },
      b: { step: 5, op: 'next', t: 1001, dc: 1, worker: 2, machine: 34, seq: 0, id: 4198637568, ids: [{ t: 1000, seq: 0, id: 4194443264 }, { t: 1001, seq: 0, id: 4198637568 }], phase: 'done', focus: '全局唯一 + 趋势递增 + 零协调' },
    },
    totp: {
      doc: { kind: 'totp', params: {}, entities: [], streams: [] },
      a: { step: 3, op: 'next', t: 30, T: 1, code: '094198', prevCode: '790815', history: [{ t: 0, T: 0, code: '790815' }, { t: 30, T: 1, code: '094198' }], phase: 'run', focus: 't=30s：跨到下一窗口 → 换新码' },
      b: { step: 4, op: 'verify', t: 30, T: 1, code: '094198', prevCode: '094198', history: [{ t: 0, T: 0, code: '790815' }, { t: 30, T: 1, code: '094198' }], phase: 'done', focus: '服务器验证' },
    },
    hmac: {
      doc: { kind: 'hmac', params: {}, entities: [], streams: [] },
      a: { step: 2, op: 'inner', K: [0x4b, 0x65, 0x79, 0x31], m: [0x48, 0x69], ki: [0x7d, 0x53, 0x4f, 0x07], ko: [], inner: 0x2f, mac: -1, tamperM: [], tamperMac: -1, phase: 'run', focus: '内层哈希 inner = H(K⊕ipad ‖ m)' },
      b: { step: 5, op: 'verify', K: [0x4b, 0x65, 0x79, 0x31], m: [0x48, 0x69], ki: [0x7d, 0x53, 0x4f, 0x07], ko: [0x17, 0x39, 0x25, 0x6d], inner: 0x2f, mac: 0x05, tamperM: [0x48, 0x6a], tamperMac: 0x06, phase: 'done', focus: '篡改演示' },
    },
    aesround: {
      doc: { kind: 'aesround', params: {}, entities: [], streams: [] },
      a: { step: 1, op: 'addkey0', mat: [0x19, 0xa0, 0x9a, 0xe9, 0x3d, 0xf4, 0xc6, 0xf8, 0xe3, 0xe2, 0x8d, 0x48, 0xbe, 0x2b, 0x2a, 0x08], prev: [0x32, 0x88, 0x31, 0xe0, 0x43, 0x5a, 0x31, 0x37, 0xf6, 0x30, 0x98, 0x07, 0xa8, 0x8d, 0xa2, 0x34], keyMat: [0x2b, 0x28, 0xab, 0x09, 0x7e, 0xae, 0xf7, 0xcf, 0x15, 0xd2, 0x15, 0x4f, 0x16, 0xa6, 0x88, 0x3c], phase: 'run', focus: 'AddRoundKey（轮0）' },
      b: { step: 5, op: 'addkey1', mat: [0xa4, 0x68, 0x6b, 0x02, 0x9c, 0x9f, 0x5b, 0x6a, 0x7f, 0x35, 0xea, 0x50, 0xf2, 0x2b, 0x43, 0x49], prev: [0x04, 0xe0, 0x48, 0x28, 0x66, 0xcb, 0xf8, 0x06, 0x81, 0x19, 0xd3, 0x26, 0xe5, 0x9a, 0x7a, 0x4c], keyMat: [0xa0, 0x88, 0x23, 0x2a, 0xfa, 0x54, 0xa3, 0x6c, 0xfe, 0x2c, 0x39, 0x76, 0x17, 0xb1, 0x39, 0x05], phase: 'done', focus: '一轮完成' },
    },
    birthday: {
      doc: { kind: 'birthday', params: {}, entities: [], streams: [] },
      a: { step: 6, N: 365, k: 23, pairs: 253, pColl: 0.507, crossed50: true, note: '就在这里过半！只要 23 人', phase: 'run', focus: '23 人：碰撞概率 50.7%' },
      b: { step: 10, N: 365, k: 57, pairs: 1596, pColl: 0.99, crossed50: true, note: '√N 规律', phase: 'done', focus: '结论：碰撞只要约 √N 次' },
    },
    ecbcbc: {
      doc: { kind: 'ecbcbc', params: {}, entities: [], streams: [] },
      a: { step: 5, mode: 'ecb', blockIdx: -1, P: [10, 12, 10, 3], K: 6, IV: 15, ecbC: [12, 10, 12, 5], cbcC: [], expr: 'C1=C3=1100', ecbLeak: true, cbcSafe: false, phase: 'run', focus: 'ECB 结论' },
      b: { step: 10, mode: 'cbc', blockIdx: -1, P: [10, 12, 10, 3], K: 6, IV: 15, ecbC: [12, 10, 12, 5], cbcC: [3, 9, 5, 0], expr: 'CBC: C1=0011 ≠ C3=0101', ecbLeak: true, cbcSafe: true, phase: 'done', focus: '对比' },
    },
    mqdesign: {
      doc: { kind: 'mqdesign', params: {}, entities: [], streams: [] },
      a: { step: 11, phase: 'group2', op: 'poll', P: 2, parts: [{ id: 0, log: [{ offset: 0, key: 'B', val: '下单#2' }, { offset: 1, key: 'B', val: '退款#2' }] }, { id: 1, log: [{ offset: 0, key: 'A', val: '下单#1' }, { offset: 1, key: 'A', val: '付款#1' }, { offset: 2, key: 'C', val: '下单#3' }] }], produce: null, groups: [{ name: 'G1', offsets: [2, 3] }, { name: 'G2', offsets: [0, 1] }], active: 'G2', poll: { group: 'G2', part: 1, offset: 0, key: 'A', val: '下单#1' }, focus: 'G2 从分区 1@offset 0 也能读到「下单#1」', log: 'x' },
      b: { step: 12, phase: 'done', op: 'summary', P: 2, parts: [{ id: 0, log: [{ offset: 0, key: 'B', val: '下单#2' }, { offset: 1, key: 'B', val: '退款#2' }] }, { id: 1, log: [{ offset: 0, key: 'A', val: '下单#1' }, { offset: 1, key: 'A', val: '付款#1' }, { offset: 2, key: 'C', val: '下单#3' }] }], produce: null, groups: [{ name: 'G1', offsets: [2, 3] }, { name: 'G2', offsets: [0, 1] }], active: '', poll: null, focus: '机制走完', log: 'x' },
    },
    objectstore: {
      doc: { kind: 'objectstore', params: {}, entities: [], streams: [] },
      a: { step: 2, stage: '③ 核心：对象存储', focus: '切块 + 冗余存多机 + 扁平 key', detail: 'x', metric: '切块 + 副本/纠删码 + 元数据 + 扁平 key', components: [{ id: 'client', label: '客户端', role: 'r' }, { id: 'store', label: '对象存储集群', role: 'r' }], phase: 'run' },
      b: { step: 5, stage: '⑥ 权衡总结', focus: '一句话讲清取舍', detail: '', metric: '对象存储(切块+纠删码) + 上传(分片秒传) + 分发(CDN+转码)', components: [{ id: 'client', label: '客户端', role: 'r' }, { id: 'cdn', label: 'CDN', role: 'r' }], phase: 'done' },
    },
    feed: {
      doc: { kind: 'feed', params: {}, entities: [], streams: [] },
      a: { step: 4, phase: 'push', op: 'postPush', event: { author: 'A', text: 'a2：跑通了！', t: 4, mode: 'push', fanout: 3 }, myInbox: [{ author: 'A', text: 'a1：今天写了个内核', t: 1 }, { author: 'B', text: 'b1：晚饭吃什么', t: 2 }, { author: 'A', text: 'a2：跑通了！', t: 4 }], vOutbox: [{ author: '大V', text: 'v1：新版本发布了', t: 3 }], pushWrites: 9, savedWrites: 1000000, feed: [], focus: 'A 发帖(推) → 写进 3 个粉丝收件箱（累计写 9）', log: 'x' },
      b: { step: 7, phase: 'done', op: 'summary', event: null, myInbox: [{ author: 'A', text: 'a1：今天写了个内核', t: 1 }, { author: 'B', text: 'b1：晚饭吃什么', t: 2 }, { author: 'A', text: 'a2：跑通了！', t: 4 }], vOutbox: [{ author: '大V', text: 'v1：新版本发布了', t: 3 }, { author: '大V', text: 'v2：直播预告', t: 5 }], pushWrites: 9, savedWrites: 2000000, feed: [{ author: '大V', text: 'v2：直播预告', t: 5 }, { author: 'A', text: 'a2：跑通了！', t: 4 }, { author: '大V', text: 'v1：新版本发布了', t: 3 }, { author: 'B', text: 'b1：晚饭吃什么', t: 2 }, { author: 'A', text: 'a1：今天写了个内核', t: 1 }], focus: '推拉结合', log: 'x' },
    },
    fk: {
      doc: { kind: 'fk', params: {}, entities: [], streams: [] },
      a: { step: 2, phase: 'chain', op: 'apply', links: [{ theta: 30, L: 2 }, { theta: 60, L: 2 }, { theta: -30, L: 1 }], revealed: 2, cur: 1, points: [{ x: 0, y: 0 }, { x: 1.732, y: 1 }, { x: 1.732, y: 3 }], cumAngle: 90, endX: 1.732, endY: 3, endAngle: 90, focus: '关节 2：θ=60° → 累计朝向 90°', log: 'x' },
      b: { step: 3, phase: 'done', op: 'summary', links: [{ theta: 30, L: 2 }, { theta: 60, L: 2 }, { theta: -30, L: 1 }], revealed: 3, cur: 2, points: [{ x: 0, y: 0 }, { x: 1.732, y: 1 }, { x: 1.732, y: 3 }, { x: 2.232, y: 3.866 }], cumAngle: 60, endX: 2.232, endY: 3.866, endAngle: 60, focus: '末端执行器', log: 'x' },
    },
    ik: {
      doc: { kind: 'ik', params: {}, entities: [], streams: [] },
      a: { step: 3, phase: 'solve', op: 'branch', L1: 2, L2: 2, target: { x: 2, y: 2 }, r: 2.828, reachLo: 0, reachHi: 4, reachable: true, cosTheta2: 0, solutions: [{ branch: '肘朝下 (elbow-down)', th1: 0, th2: 90, checkX: 2, checkY: 2, valid: true }], curBranch: 0, armPts: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }], focus: '解 1（肘朝下）：θ1=0°、θ2=90°', log: 'x' },
      b: { step: 4, phase: 'done', op: 'summary', L1: 2, L2: 2, target: { x: 2, y: 2 }, r: 2.828, reachLo: 0, reachHi: 4, reachable: true, cosTheta2: 0, solutions: [{ branch: '肘朝下 (elbow-down)', th1: 0, th2: 90, checkX: 2, checkY: 2, valid: true }, { branch: '肘朝上 (elbow-up)', th1: 90, th2: -90, checkX: 2, checkY: 2, valid: true }], curBranch: 1, armPts: [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }], focus: '解 2（肘朝上）', log: 'x' },
    },
    jacobian: {
      doc: { kind: 'jacobian', params: {}, entities: [], streams: [] },
      a: { step: 2, phase: 'apply', op: 'apply', L1: 2, L2: 2, theta1: 30, theta2: 90, J: [[-2.732, -1.732], [0.732, -1]], det: 4, singular: false, dtheta: [1, 0], endVel: { vx: -2.732, vy: 0.732 }, armPts: [{ x: 0, y: 0 }, { x: 1.732, y: 1 }, { x: 0.732, y: 2.732 }], which: '只转关节1（θ̇=[1, 0]）', focus: 'θ̇=[1,0] → 末端速度 = (-2.732, 0.732)', log: 'x' },
      b: { step: 5, phase: 'done', op: 'summary', L1: 2, L2: 2, theta1: 30, theta2: 0, J: [[-2, -1], [3.464, 1.732]], det: 0, singular: true, dtheta: [1, 0], endVel: { vx: -2, vy: 3.464 }, armPts: [{ x: 0, y: 0 }, { x: 1.732, y: 1 }, { x: 3.464, y: 2 }], which: '手臂伸直 θ2=0', focus: 'θ2=0 手臂伸直 → det(J)=0 奇异', log: 'x' },
    },
    quat: {
      doc: { kind: 'quat', params: {}, entities: [], streams: [] },
      a: { step: 3, phase: 'rotate', op: 'rotate', axis: [0, 0, 1], angle: 90, q: [0.707, 0, 0, 0.707], qnorm: 1, R: [[0, -1, 0], [1, 0, 0], [0, 0, 1]], vecStart: [1, 0, 0], vecNow: [0, 1, 0], angleShown: 90, eulerSets: [], gimbalR: null, focus: 'R·(1,0,0)=(0,1,0)', log: 'x' },
      b: { step: 6, phase: 'done', op: 'summary', axis: [0, 0, 1], angle: 90, q: [0.707, 0, 0, 0.707], qnorm: 1, R: [[0, -1, 0], [1, 0, 0], [0, 0, 1]], vecStart: [1, 0, 0], vecNow: [-1, 0, 0], angleShown: 180, eulerSets: [{ yaw: 30, pitch: 90, roll: 0 }, { yaw: 60, pitch: 90, roll: 30 }, { yaw: 50, pitch: 90, roll: 20 }], gimbalR: [[0, -0.5, 0.866], [0, 0.866, 0.5], [-1, 0, 0]], focus: '四元数首选', log: 'x' },
    },
    trajectory: {
      doc: { kind: 'trajectory', params: {}, entities: [], streams: [] },
      a: { step: 4, phase: 'trace', op: 'sample', theta0: 0, thetaF: 90, T: 2, a: [0, 0, 67.5, -22.5], t: 0.4, theta: 9.36, vel: 43.2, accel: 81, linVel: 45, samples: [{ t: 0, theta: 0, vel: 0 }, { t: 0.4, theta: 9.36, vel: 43.2 }], focus: 't=0.4s 采样', log: 'x' },
      b: { step: 8, phase: 'done', op: 'summary', theta0: 0, thetaF: 90, T: 2, a: [0, 0, 67.5, -22.5], t: 2, theta: 90, vel: 0, accel: -135, linVel: 45, samples: [{ t: 0, theta: 0, vel: 0 }, { t: 0.4, theta: 9.36, vel: 43.2 }, { t: 0.8, theta: 31.68, vel: 64.8 }, { t: 1.2, theta: 58.32, vel: 64.8 }, { t: 1.6, theta: 80.64, vel: 43.2 }, { t: 2, theta: 90, vel: 0 }], focus: 't=2s 到位', log: 'x' },
    },
    kalman: {
      doc: { kind: 'kalman', params: {}, entities: [], streams: [] },
      a: { step: 2, phase: 'update', op: 'update', u: 1, Q: 0.5, R: 1, stepNo: 1, x: 1.12, P: 0.6, truePos: 1, z: 1.2, K: 0.6, innov: 0.2, xPred: 1, history: [{ step: 1, truePos: 1, x: 1.12, sd: 0.775, z: 1.2 }], focus: '步 1 · Update：K=0.6 融合观测 z=1.2 → x=1.12', log: 'x' },
      b: { step: 8, phase: 'done', op: 'summary', u: 1, Q: 0.5, R: 1, stepNo: 4, x: 4.014, P: 0.502, truePos: 4, z: 3.9, K: 0.501, innov: -0.228, xPred: 4.128, history: [{ step: 1, truePos: 1, x: 1.12, sd: 0.775, z: 1.2 }, { step: 2, truePos: 2, x: 1.952, sd: 0.724, z: 1.8 }, { step: 3, truePos: 3, x: 3.128, sd: 0.711, z: 3.3 }, { step: 4, truePos: 4, x: 4.014, sd: 0.709, z: 3.9 }], focus: '步 4 · Update 收敛', log: 'x' },
    },
    icp: {
      doc: { kind: 'icp', params: {}, entities: [], streams: [] },
      a: { step: 1, phase: 'iterate', op: 'iter', target: [[0.9, 1.1], [2.6, 0.4], [3.5, 0.9], [2.9, 2.3], [0.3, 2.7]], cur: [[0.3, 0.2], [2.1, 0.1], [3, 0.3], [3.1, 1.7], [1.1, 2.6]], corr: [0, 1, 1, 3, 4], iterNo: 1, iterRot: 12.18, cumRot: 12.18, error: 0.55, trueRot: 25, focus: '第 1 轮', log: 'x' },
      b: { step: 4, phase: 'done', op: 'summary', target: [[0.9, 1.1], [2.6, 0.4], [3.5, 0.9], [2.9, 2.3], [0.3, 2.7]], cur: [[0.9, 1.1], [2.6, 0.4], [3.5, 0.9], [2.9, 2.3], [0.3, 2.7]], corr: [0, 1, 2, 3, 4], iterNo: 4, iterRot: 0.03, cumRot: 25.01, error: 0.01, trueRot: 25, focus: '收敛', log: 'x' },
    },
    pid: {
      doc: { kind: 'pid', params: {}, entities: [], streams: [] },
      a: { step: 5, phase: 'ponly', op: 'step', target: 10, Kp: 0.4, Kd: 0.9, mode: 'P', k: 5, e: 1.43, uP: 0.572, uD: 0, u: 0.572, v: 4.02, p: 11.77, ponly: [{ k: 1, p: 1 }, { k: 2, p: 2.9 }, { k: 3, p: 5.51 }, { k: 4, p: 8.57 }, { k: 5, p: 11.77 }], pd: [], focus: '纯P 步5：冲过目标', log: 'x' },
      b: { step: 14, phase: 'done', op: 'summary', target: 10, Kp: 0.4, Kd: 0.9, mode: 'PD', k: 8, e: 1.48, uP: 0.593, uD: -1.417, u: -0.824, v: -0.5, p: 9.1, ponly: [{ k: 1, p: 1 }, { k: 2, p: 2.9 }, { k: 3, p: 5.51 }, { k: 4, p: 8.57 }, { k: 5, p: 11.77 }], pd: [{ k: 1, p: 1 }, { k: 2, p: 2.45 }, { k: 3, p: 4 }, { k: 4, p: 5.46 }, { k: 5, p: 6.71 }, { k: 6, p: 7.73 }, { k: 7, p: 8.52 }, { k: 8, p: 9.1 }], focus: '步 8 · PD 收敛', log: 'x' },
    },
    rrt: {
      doc: { kind: 'rrt', params: {}, entities: [], streams: [] },
      a: { step: 4, phase: 'grow', op: 'reject', W: 10, start: { x: 1, y: 1 }, goal: { x: 9, y: 9 }, goalR: 1.6, obstacles: [{ x0: 2.5, y0: 3, x1: 7, y1: 6.5 }], nodes: [{ x: 1, y: 1, parent: -1 }, { x: 1.55, y: 2.5, parent: 0 }, { x: 3.14, y: 2.34, parent: 1 }, { x: 2, y: 4.04, parent: 1 }], sample: { x: 9, y: 9 }, nearest: 3, newNode: null, goalward: true, rejected: 1, reason: '撞障碍', path: null, found: false, focus: '采样(朝终点) → 撞障碍丢弃', log: 'x' },
      b: { step: 19, phase: 'done', op: 'summary', W: 10, start: { x: 1, y: 1 }, goal: { x: 9, y: 9 }, goalR: 1.6, obstacles: [{ x0: 2.5, y0: 3, x1: 7, y1: 6.5 }], nodes: [{ x: 1, y: 1, parent: -1 }, { x: 1.55, y: 2.5, parent: 0 }, { x: 3.14, y: 2.34, parent: 1 }, { x: 2, y: 4.04, parent: 1 }, { x: 1.66, y: 5.6, parent: 3 }, { x: 2.38, y: 7.03, parent: 4 }, { x: 3.94, y: 7.4, parent: 5 }, { x: 5.54, y: 7.5, parent: 6 }, { x: 7.01, y: 8.14, parent: 7 }, { x: 0.56, y: 1.24, parent: 1 }, { x: 7.6, y: 9.63, parent: 8 }], sample: { x: 7.58, y: 9.57 }, nearest: 8, newNode: { x: 7.6, y: 9.63 }, goalward: false, rejected: 9, reason: '', path: [0, 1, 3, 4, 5, 6, 7, 8, 10], found: true, focus: '到达终点！回溯出 8 段路径', log: 'x' },
    },
    topk: {
      doc: { kind: 'topk', params: {}, entities: [], streams: [] },
      a: { step: 10, phase: 'heap', op: 'replace', K: 3, N: 2, shards: [{ id: 0, items: [{ word: '香蕉', count: 4 }, { word: '梨', count: 1 }] }, { id: 1, items: [{ word: '苹果', count: 5 }, { word: '橙子', count: 3 }, { word: '葡萄', count: 2 }, { word: '桃', count: 1 }] }], route: null, heap: [{ word: '橙子', count: 3 }, { word: '香蕉', count: 4 }, { word: '苹果', count: 5 }], consider: { word: '橙子', count: 3 }, evicted: { word: '梨', count: 1 }, threshold: 3, topk: [], focus: '3 > 门槛 1 → 淘汰「梨」换上「橙子」', log: 'x' },
      b: { step: 13, phase: 'done', op: 'summary', K: 3, N: 2, shards: [{ id: 0, items: [{ word: '香蕉', count: 4 }, { word: '梨', count: 1 }] }, { id: 1, items: [{ word: '苹果', count: 5 }, { word: '橙子', count: 3 }, { word: '葡萄', count: 2 }, { word: '桃', count: 1 }] }], route: null, heap: [{ word: '橙子', count: 3 }, { word: '香蕉', count: 4 }, { word: '苹果', count: 5 }], consider: null, evicted: null, threshold: 3, topk: [{ word: '苹果', count: 5 }, { word: '香蕉', count: 4 }, { word: '橙子', count: 3 }], focus: 'Top-3 求出', log: 'x' },
    },
    seckill: {
      doc: { kind: 'seckill', params: {}, entities: [], streams: [] },
      a: { step: 5, phase: 'naive', op: 'commit', mode: 'naive', stock: -1, sold: 3, initStock: 2, reqs: [{ id: 'R1', local: 2, status: 'sold' }, { id: 'R2', local: 1, status: 'sold' }, { id: 'R3', local: 1, status: 'sold' }], cur: 2, oversold: true, focus: 'R3 判 1>0 成立 → 扣，库存=-1、卖出=3', log: 'x' },
      b: { step: 9, phase: 'done', op: 'summary', mode: 'atomic', stock: 0, sold: 2, initStock: 2, reqs: [{ id: 'R1', local: null, status: 'sold' }, { id: 'R2', local: null, status: 'sold' }, { id: 'R3', local: null, status: 'rejected' }], cur: 2, oversold: false, focus: '原子 DECR 跑完', log: 'x' },
    },
    minisearch: {
      doc: { kind: 'minisearch', params: {}, entities: [], streams: [] },
      a: { step: 7, stage: '⑥ TF-IDF 打分', focus: 'score = Σ tf × idf', reading: '', indexed: ['D1', 'D2', 'D3'], index: [], query: ['猫', '狗'], candidates: ['D1', 'D2', 'D3'], idf: [{ term: '猫', df: 2, idf: 0.405 }, { term: '狗', df: 1, idf: 1.099 }], scores: [{ id: 'D2', score: 1.099, parts: '狗:tf1×idf1.10' }, { id: 'D3', score: 0.811, parts: '猫:tf2×idf0.41' }, { id: 'D1', score: 0.405, parts: '猫:tf1×idf0.41' }], phase: 'run' },
      b: { step: 8, stage: '⑦ 排序返回', focus: '按分降序', reading: '', indexed: ['D1', 'D2', 'D3'], index: [], query: ['猫', '狗'], candidates: ['D1', 'D2', 'D3'], idf: [{ term: '猫', df: 2, idf: 0.405 }, { term: '狗', df: 1, idf: 1.099 }], scores: [{ id: 'D2', score: 1.099, parts: '狗:tf1×idf1.10' }, { id: 'D3', score: 0.811, parts: '猫:tf2×idf0.41' }, { id: 'D1', score: 0.405, parts: '猫:tf1×idf0.41' }], phase: 'done' },
    },
    minikv: {
      doc: { kind: 'minikv', params: {}, entities: [], streams: [] },
      a: { op: 'get', key: 'a', val: -1, memtable: [], sstables: [[['a', 1], ['b', 2], ['c', 3]], [['a', 9], ['d', 4], ['e', 5]]], bloom: ['a', 'b', 'c', 'd', 'e'], result: '9', bloomHit: true, foundIn: 'SSTable2', note: '从新到旧查', phase: 'run' },
      b: { op: 'get', key: 'z', val: -1, memtable: [], sstables: [[['a', 1], ['b', 2], ['c', 3]], [['a', 9], ['d', 4], ['e', 5]]], bloom: ['a', 'b', 'c', 'd', 'e'], result: '不存在', bloomHit: false, foundIn: 'none', note: '', phase: 'run' },
    },
    otpreuse: {
      doc: { kind: 'otpreuse', params: {}, entities: [], streams: [] },
      a: { m1: [0, 1], m2: [0, 0], k: [1, 0], c1: [1, 1], c2: [1, 0], pos: 1, xorbit: 1, m1xm2: [0, 1], phase: 'run' },
      b: { m1: [0, 1], m2: [0, 0], k: [1, 0], c1: [1, 1], c2: [1, 0], pos: -1, xorbit: -1, m1xm2: [0, 0, 0, 0, 0, 0, 1, 1], phase: 'done' },
    },
    wal: {
      doc: { kind: 'wal', params: {}, entities: [], streams: [] },
      a: { data: 5, wal: ['SET x=5', 'SET x=8'], applied: 1, act: 'crash', crashed: true, phase: 'run' },
      b: { data: 8, wal: ['SET x=5', 'SET x=8'], applied: 2, act: 'replay', crashed: false, phase: 'run' },
    },
    lsm: {
      doc: { kind: 'lsm', params: {}, entities: [], streams: [] },
      a: { cap: 3, memtable: ['a', 'b'], sstables: [], cur: 'b', act: 'write', phase: 'run' },
      b: { cap: 3, memtable: [], sstables: [['a', 'b', 'c']], cur: '', act: 'flush', phase: 'run' },
    },
    tokenbucket: {
      doc: { kind: 'tokenbucket', params: {}, entities: [], streams: [] },
      a: { cap: 5, rate: 1, tick: 1, tokens: 0, arrived: 4, allowed: 3, rejected: 1, totalAllowed: 6, totalRejected: 1, phase: 'run' },
      b: { cap: 5, rate: 1, tick: -1, tokens: 0, arrived: 0, allowed: 0, rejected: 0, totalAllowed: 9, totalRejected: 6, phase: 'done' },
    },
    consistenthash: {
      doc: { kind: 'consistenthash', params: {}, entities: [], streams: [] },
      a: { nodes: [{ id: 'A', pos: 10 }], keys: [{ id: 'k1', pos: 25, node: 'B' }], cur: 'k1', act: 'assign', remapped: '', phase: 'run' },
      b: { nodes: [{ id: 'A', pos: 10 }, { id: 'D', pos: 60 }], keys: [{ id: 'k2', pos: 55, node: 'D' }], cur: 'k2', act: 'remap', remapped: 'k2', phase: 'run' },
    },
    skiplist: {
      doc: { kind: 'skiplist', params: {}, entities: [], streams: [] },
      a: { levels: [[1, 9], [1, 5, 9, 11], [1, 3, 5, 7, 9, 11]], target: 7, level: 1, val: 5, act: 'right', compares: 2, path: [{ level: 0, val: 1 }], phase: 'run' },
      b: { levels: [[1, 9], [1, 5, 9, 11], [1, 3, 5, 7, 9, 11]], target: 7, level: 2, val: 7, act: 'found', compares: 4, path: [{ level: 2, val: 7 }], phase: 'done' },
    },
    twopc: {
      doc: { kind: 'twopc', params: {}, entities: [], streams: [] },
      a: { parts: [{ id: 'P1', state: 'prepared' }], coord: '阶段一·收票', cur: 'P1', yesVotes: 1, decision: '', phase: 'run' },
      b: { parts: [{ id: 'P1', state: 'committed' }], coord: '阶段二·提交', cur: 'P1', yesVotes: 3, decision: 'commit', phase: 'run' },
    },
    crt: {
      doc: { kind: 'crt', params: {}, entities: [], streams: [] },
      a: { ns: [3, 5, 7], as: [2, 3, 2], N: 105, idx: 0, Ni: 35, yi: 2, term: 140, acc: 140, x: -1, phase: 'run' },
      b: { ns: [3, 5, 7], as: [2, 3, 2], N: 105, idx: -1, Ni: -1, yi: -1, term: -1, acc: 233, x: 23, phase: 'done' },
    },
    fermat: {
      doc: { kind: 'fermat', params: {}, entities: [], streams: [] },
      a: { n: 15, a: 2, bitPos: 1, bit: 1, baseNow: 4, result: 4, verdict: '', phase: 'run' },
      b: { n: 15, a: 2, bitPos: -1, bit: -1, baseNow: 1, result: 4, verdict: '合数', phase: 'done' },
    },
    salt: {
      doc: { kind: 'salt', params: {}, entities: [], streams: [] },
      a: { pw: '123456', saltA: 'x7', saltB: 'q2', noSaltA: 55778, noSaltB: 55778, saltedA: -1, saltedB: -1, stage: 'nosalt', phase: 'run' },
      b: { pw: '123456', saltA: 'x7', saltB: 'q2', noSaltA: 55778, noSaltB: 55778, saltedA: 2029, saltedB: 29185, stage: 'salted', phase: 'run' },
    },
    extgcd: {
      doc: { kind: 'extgcd', params: {}, entities: [], streams: [] },
      a: { e: 3, m: 20, q: 6, r: 20, newr: 3, t: 0, newt: 1, result: -1, phase: 'run' },
      b: { e: 3, m: 20, q: -1, r: 1, newr: 0, t: 7, newt: -20, result: 7, phase: 'done' },
    },
    signature: {
      doc: { kind: 'signature', params: {}, entities: [], streams: [] },
      a: { n: 33, e: 3, d: 7, hash: 4, sig: 16, recvHash: -1, verified: -1, ok: false, stage: 'sign', phase: 'run' },
      b: { n: 33, e: 3, d: 7, hash: 4, sig: 16, recvHash: 4, verified: 4, ok: true, stage: 'check', phase: 'run' },
    },
    hashaval: {
      doc: { kind: 'hashaval', params: {}, entities: [], streams: [] },
      a: { a: 'cat', b: 'cot', bitsA: [1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0], bitsB: [1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1], pos: 2, flipped: 1, phase: 'run' },
      b: { a: 'cat', b: 'cot', bitsA: [1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0], bitsB: [1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1], pos: -1, flipped: 8, phase: 'done' },
    },
    merkle: {
      doc: { kind: 'merkle', params: {}, entities: [], streams: [] },
      a: { data: [10, 20, 30, 40], leaves: [26, -1, -1, -1], parents: [-1, -1], root: -1, act: 'leaf', focus: 0, phase: 'run' },
      b: { data: [10, 20, 30, 40], leaves: [26, 45, 64, 83], parents: [12, 34], root: 59, act: 'root', focus: 0, phase: 'run' },
    },
    caesar: {
      doc: { kind: 'caesar', params: {}, entities: [], streams: [] },
      a: { pos: 0, ch: 'H', code: 7, key: 3, shifted: 10, out: 'K', cipher: 'K', phase: 'run' },
      b: { pos: -1, ch: '', code: -1, key: 3, shifted: -1, out: '', cipher: 'KHOOR', phase: 'done' },
    },
    vigenere: {
      doc: { kind: 'vigenere', params: {}, entities: [], streams: [] },
      a: { pos: 0, ch: 'H', chCode: 7, keyCh: 'K', keyCode: 10, shifted: 17, out: 'R', cipher: 'R', phase: 'run' },
      b: { pos: -1, ch: '', chCode: -1, keyCh: '', keyCode: -1, shifted: -1, out: '', cipher: 'RIJVS', phase: 'done' },
    },
    xor: {
      doc: { kind: 'xor', params: {}, entities: [], streams: [] },
      a: { pos: 1, mBit: 1, kBit: 1, cBit: 0, cBits: [0, 0], phase: 'run' },
      b: { pos: -1, mBit: -1, kBit: -1, cBit: -1, cBits: [0, 0, 1, 0, 1, 0, 1, 1], phase: 'done' },
    },
    modpow: {
      doc: { kind: 'modpow', params: {}, entities: [], streams: [] },
      a: { a: 3, b: 13, n: 7, bitPos: 1, bit: 0, baseNow: 2, result: 3, phase: 'run' },
      b: { a: 3, b: 13, n: 7, bitPos: -1, bit: -1, baseNow: 4, result: 3, phase: 'done' },
    },
    diffiehellman: {
      doc: { kind: 'diffiehellman', params: {}, entities: [], streams: [] },
      a: { p: 23, g: 5, A: 8, B: -1, aliceShared: -1, stage: 'pubA', phase: 'run' },
      b: { p: 23, g: 5, A: 8, B: 19, aliceShared: 2, stage: 'sharedA', phase: 'run' },
    },
    rsa: {
      doc: { kind: 'rsa', params: {}, entities: [], streams: [] },
      a: { p: 3, q: 11, n: 33, phi: 20, e: 3, d: 7, m: 4, c: -1, dec: -1, stage: 'priv', phase: 'run' },
      b: { p: 3, q: 11, n: 33, phi: 20, e: 3, d: 7, m: 4, c: 31, dec: -1, stage: 'encrypt', phase: 'run' },
    },
    mvcc: {
      doc: { kind: 'mvcc', params: {}, entities: [], streams: [] },
      //  A T1 读到 100 · B 调度结束(两次都 100) —— 结果换一套说法
      a: { op: 'read', curTx: 1, readValue: 100, versions: [{}, {}], phase: 'run' },
      b: { op: 'done', curTx: 0, readValue: -1, versions: [{}, {}], phase: 'done' },
    },
    iso: {
      doc: { kind: 'iso', params: { level: '读未提交' }, entities: [], streams: [] },
      //  A 脏读(读到 200) · B 首次读(基准 100) —— 结果换一套说法
      a: { level: '读未提交', op: 'read', curTx: 1, readValue: 200, anomaly: '脏读', phase: 'run' },
      b: { level: '读未提交', op: 'read', curTx: 1, readValue: 100, anomaly: '首次读', phase: 'run' },
    },
    cas: {
      doc: { kind: 'cas', params: {}, entities: [], streams: [] },
      //  A CAS 成功 · B CAS 失败 —— 结果换一套说法
      a: { op: 'cas', cur: 1, x: 1, expected: 0, next: 1, casOk: true, fails: 0, phase: 'run' },
      b: { op: 'cas', cur: 2, x: 1, expected: 0, next: 1, casOk: false, fails: 1, phase: 'run' },
    },
    mesi: {
      doc: { kind: 'mesi', params: {}, entities: [], streams: [] },
      //  A 写→别人失效 · B 读→上总线 —— 结果换一套说法
      a: { op: 'write', cur: 1, bus: 'BusRdX / Invalidate', invalidated: 1, phase: 'run' },
      b: { op: 'read', cur: 2, bus: 'BusRd', invalidated: 1, phase: 'run' },
    },
    deadlock: {
      doc: { kind: 'deadlock', params: {}, entities: [], streams: [] },
      //  A 加锁成功 · B 成环死锁 —— 结果换一套说法
      a: { op: 'acquire', cur: 1, lock: 'A', deadlock: false, cycle: [], phase: 'run' },
      b: { op: 'request', cur: 3, lock: 'A', deadlock: true, cycle: [1, 2, 3], phase: 'run' },
    },
    raft: {
      doc: { kind: 'raft', params: {}, entities: [], streams: [] },
      //  A 当选 Leader · B 日志提交 —— 结果换一套说法
      a: { op: 'becomeLeader', cur: 1, term: 1, votes: 2, majority: 2, committed: 0, phase: 'run' },
      b: { op: 'append', cur: 2, term: 1, votes: 2, majority: 2, committed: 1, phase: 'run' },
    },
    knn: {
      doc: { kind: 'knn', params: { k: 3 }, entities: [], streams: [] },
      //  A 第 1 近邻(暂判 A) · B 看完 3 个(判 B) —— 结论必须换一套说法
      a: { phase: 'run', k: 3, seen: 1, voteA: 1, voteB: 0, predict: 0 },
      b: { phase: 'done', k: 3, seen: 3, voteA: 1, voteB: 2, predict: 1 },
    },
    kmeans: {
      doc: { kind: 'kmeans', params: {}, entities: [], streams: [] },
      //  A 第 1 轮分配(inertia 54) · B 收敛(inertia 4) —— 结论必须换一套说法
      a: { phase: 'assign', iter: 0, k: 3, inertia: 54.17, converged: false },
      b: { phase: 'done', iter: 3, k: 3, inertia: 4.05, converged: true },
    },
    pca: {
      doc: { kind: 'pca', params: {}, entities: [], streams: [] },
      //  A 点云(还没找轴) · B 完成(投影、保 96%) —— 结论必须换一套说法
      a: { phase: 'cloud', angle: 33, var1: 96 },
      b: { phase: 'done', angle: 33, var1: 96 },
    },
    svm: {
      doc: { kind: 'svm', params: {}, entities: [], streams: [] },
      //  A 随便一条(间隔窄) · B 完成(SVM 最大间隔) —— 结论必须换一套说法
      a: { phase: 'naive', margin: 0.5, supportVectors: [], isMax: false },
      b: { phase: 'done', margin: 1, supportVectors: [0, 1, 5, 6], isMax: true },
    },
    gbdt: {
      doc: { kind: 'gbdt', params: {}, entities: [], streams: [] },
      //  A 第 0 轮(均值、MSE大) · B 提升 8 轮(MSE 0.03) —— 结论必须换一套说法
      a: { phase: 'run', round: 0, mse: 0.746, splitT: 0 },
      b: { phase: 'done', round: 8, mse: 0.033, splitT: 0.34 },
    },
    dtree: {
      doc: { kind: 'dtree', params: {}, entities: [], streams: [] },
      //  A 根节点(不纯) · B 切完(3 纯叶子) —— 结论必须换一套说法
      a: { phase: 'root', splits: [], curGini: 0.375, gain: 0, leaves: [], depth: 0 },
      b: { phase: 'done', splits: [{}, {}], curGini: 0, gain: 0, leaves: [{}, {}, {}], depth: 2 },
    },
    logreg: {
      doc: { kind: 'logreg', params: {}, entities: [], streams: [] },
      //  A 起点(无边界、蒙一半) · B 收敛(100%) —— 结论必须换一套说法
      a: { phase: 'run', gdStep: 0, w1: 0, w2: 0, b: 0, loss: 0.693, acc: 0.5 },
      b: { phase: 'done', gdStep: 60, w1: 1.967, w2: 1.421, b: 0.038, loss: 0.03, acc: 1 },
    },
    backprop: {
      doc: { kind: 'backprop', params: {}, entities: [], streams: [] },
      //  A 前向(算到 L) · B 反向完成(梯度全出) —— 结论必须换一套说法
      a: { phase: 'forward', stage: '前向', loss: 0.072, gLda: null, gLdz: null, gLdw: null },
      b: { phase: 'done', stage: '完成', loss: 0.072, gLda: -0.538, gLdz: -0.106, gLdw: -0.106 },
    },
    binsearch: {
      doc: { kind: 'binsearch', params: {}, entities: [], streams: [] },
      //  A 第 1 次比较(去右) · B 命中(4 步) —— 结论必须换一套说法
      a: { phase: 'run', target: 63, lo: 0, hi: 12, mid: 6, arr: [3, 7, 12, 18, 25, 31, 42, 55, 63, 71, 80, 88, 95], cmp: 'go-right', compares: 1, found: -1 },
      b: { phase: 'done', target: 63, lo: 8, hi: 8, mid: 8, arr: [3, 7, 12, 18, 25, 31, 42, 55, 63, 71, 80, 88, 95], cmp: 'hit', compares: 4, found: 8 },
    },
    nqueens: {
      doc: { kind: 'nqueens', params: {}, entities: [], streams: [] },
      //  A 第 0 行落子(才刚开始) · B 解出(回溯 4 次拼出解) —— 结论必须换一套说法
      a: { phase: 'run', act: 'place', n: 4, row: 0, col: 0, skip: [], cols: [0, -1, -1, -1], placed: 1, tries: 1, backtracks: 0 },
      b: { phase: 'done', act: 'solved', n: 4, row: -1, col: -1, skip: [], cols: [1, 3, 0, 2], placed: 4, tries: 26, backtracks: 4 },
    },
    unionfind: {
      doc: { kind: 'unionfind', params: {}, entities: [], streams: [] },
      //  A 第 1 次 union(分量降到 6) · B 全并成 1 团(压缩后) —— 结论必须换一套说法
      a: { phase: 'run', act: 'union', a: 0, b: 1, ra: 0, rb: 1, root: -1, path: [], comps: 6, depths: [1, 0, 0, 0, 0, 0, 0] },
      b: { phase: 'done', act: 'done', a: 0, b: -1, ra: -1, rb: -1, root: 6, path: [], comps: 1, depths: [1, 1, 1, 1, 2, 1, 0] },
    },
    heap: {
      doc: { kind: 'heap', params: {}, entities: [], streams: [] },
      //  A 建堆下沉中 · B 复原完成(取出最大) —— 结论必须换一套说法
      a: { phase: 'run', act: 'sift', stage: 'build', arr: [9, 3, 8, 1, 7, 5, 2], node: 1, child: 0, heapN: 7, sortedFrom: 7 },
      b: { phase: 'done', act: 'done', stage: 'extract', arr: [8, 7, 5, 1, 3, 2, 9], node: 0, child: -1, heapN: 6, sortedFrom: 6 },
    },
    quicksort: {
      doc: { kind: 'quicksort', params: {}, entities: [], streams: [] },
      //  A 分区中选基准 · B 排好序 —— 结论必须换一套说法
      a: { phase: 'run', act: 'pivot', arr: [5, 2, 8, 1, 9, 3, 7], n: 7, lo: 0, hi: 6, pivotVal: 7, iPtr: -1, jPtr: 6, swapWith: -1, sortedCount: 0, locked: [false, false, false, false, false, false, false] },
      b: { phase: 'done', act: 'done', arr: [1, 2, 3, 5, 7, 8, 9], n: 7, lo: 0, hi: 6, pivotVal: -1, iPtr: -1, jPtr: -1, swapWith: -1, sortedCount: 7, locked: [true, true, true, true, true, true, true] },
    },
    mergesort: {
      doc: { kind: 'mergesort', params: {}, entities: [], streams: [] },
      //  A 归并中取右段队首 · B 排好序 —— 结论必须换一套说法
      a: { phase: 'run', act: 'emit', from: 'R', took: 1, arr: [2, 5, 1, 8, 3, 9, 7], n: 7, width: 2, lo: 0, mid: 2, hi: 4, li: 0, rj: 2, out: [1], focus: 2 },
      b: { phase: 'done', act: 'done', from: '', took: -1, arr: [1, 2, 3, 5, 7, 8, 9], n: 7, width: 4, lo: 0, mid: 4, hi: 7, li: 7, rj: 7, out: [1, 2, 3, 5, 7, 8, 9], focus: -1 },
    },
    fastpow: {
      doc: { kind: 'fastpow', params: {}, entities: [], streams: [] },
      //  A 某位=1 乘入 · B 算完 —— 结论必须换一套说法
      a: { phase: 'run', act: 'mul', a: 3, n: 13, bitsMSB: [1, 1, 0, 1], k: 2, bit: 1, powK: 81, result: 243, prevResult: 3, mults: 2, squares: 2, picked: [1, 4] },
      b: { phase: 'done', act: 'done', a: 3, n: 13, bitsMSB: [1, 1, 0, 1], k: 4, bit: -1, powK: -1, result: 1594323, prevResult: 1594323, mults: 3, squares: 3, picked: [1, 4, 8] },
    },
    astar: {
      doc: { kind: 'astar', params: {}, entities: [], streams: [] },
      //  A 展开一格(f=7) · B 找到最短路 —— 结论必须换一套说法
      a: { phase: 'run', act: 'expand', cur: [3, 2], curG: 3, curH: 4, curF: 7, expanded: 4, open: ['3,3', '3,1'], path: [] },
      b: { phase: 'done', act: 'done', cur: [7, 2], curG: 9, curH: 0, curF: 9, expanded: 19, open: ['5,2', '6,2'], path: ['0,2', '1,2', '2,2', '3,2', '3,3', '4,3', '5,3', '6,3', '7,3', '7,2'] },
    },
    perceptron: {
      doc: { kind: 'perceptron', params: {}, entities: [], streams: [] },
      //  A 分错→纠正 · B 收敛 —— 结论必须换一套说法
      a: { phase: 'run', act: 'check', pts: [{ x: [1, 2], y: 1 }, { x: [2, 3], y: 1 }, { x: [2, 4], y: 1 }, { x: [3, 2], y: -1 }, { x: [4, 3], y: -1 }, { x: [4, 1], y: -1 }], w: [1, 2], b: 1, prevW: [0, 0], prevB: 0, pass: 0, ptIdx: 0, score: 0, ok: false, updated: true, updates: 1 },
      b: { phase: 'done', act: 'done', pts: [{ x: [1, 2], y: 1 }, { x: [2, 3], y: 1 }, { x: [2, 4], y: 1 }, { x: [3, 2], y: -1 }, { x: [4, 3], y: -1 }, { x: [4, 1], y: -1 }], w: [-3, 2], b: 1, prevW: [-3, 2], prevB: 1, pass: -1, ptIdx: -1, score: 0, ok: true, updated: false, updates: 5 },
    },
    pooling: {
      doc: { kind: 'pooling', params: { kind: '最大' }, entities: [], streams: [] },
      //  A 扫第一块(取最大 6) · B 池化完成 —— 结论必须换一套说法
      a: { phase: 'run', kindName: '最大', wr: 0, wc: 0, vals: [1, 3, 5, 6], result: 6, out: [[6, null], [null, null]] },
      b: { phase: 'done', kindName: '最大', wr: 1, wc: 1, vals: [9, 1, 2, 8], result: 9, out: [[6, 4], [7, 9]] },
    },
    beam: {
      doc: { kind: 'beam', params: {}, entities: [], streams: [] },
      //  A 第 2 步扩展+剪枝 · B 完成(对照贪心) —— 结论必须换一套说法
      a: { phase: 'run', act: 'expand', t: 2, k: 2, beamsIn: [{ seq: 'A', p: 0.5 }, { seq: 'B', p: 0.4 }], cands: [{ seq: 'BC', p: 0.32 }, { seq: 'AB', p: 0.2 }, { seq: 'AC', p: 0.15 }, { seq: 'AD', p: 0.15 }, { seq: 'BA', p: 0.04 }, { seq: 'BD', p: 0.04 }], kept: ['BC', 'AB'], best: { seq: 'BC', p: 0.32 }, greedy: { seq: 'AB·', p: 0.1 }, showGreedy: false },
      b: { phase: 'done', act: 'done', t: 3, k: 2, beamsIn: [{ seq: 'BC·', p: 0.288 }, { seq: 'AB·', p: 0.1 }], cands: [], kept: ['BC·', 'AB·'], best: { seq: 'BC·', p: 0.288 }, greedy: { seq: 'AB·', p: 0.1 }, showGreedy: true },
    },
    rnn: {
      doc: { kind: 'rnn', params: {}, entities: [], streams: [] },
      //  A 第 3 步(记忆更新) · B 读完整段 —— 结论必须换一套说法
      a: { phase: 'run', t: 3, xt: 3, hPrev: 0.109, pre: 1.587, ht: 0.92, hs: [0.762, 0.109, 0.92, null], xs: [2, -1, 3, -2], wx: 0.5, wh: 0.8, b: 0 },
      b: { phase: 'done', t: -1, xt: 0, hPrev: 0, pre: 0, ht: -0.258, hs: [0.762, 0.109, 0.92, -0.258], xs: [2, -1, 3, -2], wx: 0.5, wh: 0.8, b: 0 },
    },
    wordvec: {
      doc: { kind: 'wordvec', params: {}, entities: [], streams: [] },
      //  A 减出王室方向 · B 类比成立(最近=王后) —— 结论必须换一套说法
      a: { phase: 'run', stage: 'sub', dir: [1, 0], result: [0, 0], ranked: [], nearest: '', words: [{ name: '国王', v: [1, 0] }, { name: '男人', v: [0, 0] }, { name: '女人', v: [0, 1] }, { name: '王后', v: [1, 1] }] },
      b: { phase: 'done', stage: 'done', dir: [1, 0], result: [1, 1], ranked: [{ name: '王后', d: 0 }, { name: '王子', d: 0.906 }], nearest: '王后', words: [{ name: '国王', v: [1, 0] }, { name: '男人', v: [0, 0] }, { name: '女人', v: [0, 1] }, { name: '王后', v: [1, 1] }] },
    },
    lstm: {
      doc: { kind: 'lstm', params: {}, entities: [], streams: [] },
      //  A 存(写入记忆) · B 取出(全程守住) —— 结论必须换一套说法
      a: { phase: 'run', t: 1, role: '存', f: 0, ig: 1, ctil: 0.8, o: 0, cPrev: 0, c: 0.8, h: 0, cs: [0.8, null, null, null] },
      b: { phase: 'done', t: -1, role: '毕', f: 1, ig: 0, ctil: 0, o: 1, cPrev: 0.8, c: 0.8, h: 0.664, cs: [0.8, 0.8, 0.8, 0.8] },
    },
    norm: {
      doc: { kind: 'norm', params: { kind: '批归一化' }, entities: [], streams: [] },
      //  A 归一化第一列(f1) · B 全部完成 —— 结论必须换一套说法
      a: { phase: 'run', kindName: '批归一化', axis: 'col', slice: 0, vals: [2, 2, 6, 6], mu: 4, sigma: 2, mat: [[2, 3, 1], [2, 7, 5], [6, 3, 5], [6, 7, 1]], out: [[-1, null, null], [-1, null, null], [1, null, null], [1, null, null]] },
      b: { phase: 'done', kindName: '批归一化', axis: 'col', slice: -1, vals: [], mu: 0, sigma: 0, mat: [[2, 3, 1], [2, 7, 5], [6, 3, 5], [6, 7, 1]], out: [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]] },
    },
    rag: {
      doc: { kind: 'rag', params: {}, entities: [], streams: [] },
      //  A 算相似度(还没检索) · B 据此作答 —— 结论必须换一套说法
      a: { phase: 'run', stage: 'score', query: '猫爱吃什么?', topK: 2, retrieved: [], answer: '', docs: [{ t: '猫是肉食动物，主食是肉和鱼', sim: 0.9 }, { t: '狗需要每天遛弯运动', sim: 0.34 }, { t: '汽车每 5000 公里保养一次', sim: 0 }, { t: '猫特别爱吃鱼、鸡肉', sim: 0.74 }, { t: '绿色植物靠光合作用产能', sim: 0.02 }] },
      b: { phase: 'done', stage: 'done', query: '猫爱吃什么?', topK: 2, retrieved: [0, 3], answer: '肉和鱼（含鸡肉）', docs: [{ t: '猫是肉食动物，主食是肉和鱼', sim: 0.9 }, { t: '狗需要每天遛弯运动', sim: 0.34 }, { t: '汽车每 5000 公里保养一次', sim: 0 }, { t: '猫特别爱吃鱼、鸡肉', sim: 0.74 }, { t: '绿色植物靠光合作用产能', sim: 0.02 }] },
    },
    selfconsist: {
      doc: { kind: 'selfconsist', params: {}, entities: [], streams: [] },
      //  A 采样第 2 条(平票) · B 多数投票(17 胜) —— 结论必须换一套说法
      a: { phase: 'run', problem: '小明有 5 个苹果，又买了 3 袋、每袋 4 个，一共几个？', n: 5, correct: 17, winner: 17, tally: [[17, 1], [32, 1]], chains: [{ r: '5 + 3×4 = 17', a: 17, ok: true }, { r: '(5+3)×4 = 32', a: 32, ok: false }] },
      b: { phase: 'done', problem: '小明有 5 个苹果，又买了 3 袋、每袋 4 个，一共几个？', n: 5, correct: 17, winner: 17, tally: [[17, 3], [32, 1], [19, 1]], chains: [{ r: '5 + 3×4 = 17', a: 17, ok: true }, { r: '(5+3)×4 = 32', a: 32, ok: false }, { r: '3×4=12, +5 = 17', a: 17, ok: true }, { r: '5 + 12 = 17', a: 17, ok: true }, { r: '5×3 + 4 = 19', a: 19, ok: false }] },
    },
    bestofn: {
      doc: { kind: 'bestofn', params: {}, entities: [], streams: [] },
      //  A 采样中(当前最高 9) · B 取最高分(3×8=24 得 10) —— 结论必须换一套说法
      a: { phase: 'run', task: '用 3、8、5 拼一个算式，结果尽量接近 24', target: 24, n: 5, bestIdx: 1, cands: [{ e: '3 + 8 + 5', r: 16, reward: 2 }, { e: '5 × 3 + 8', r: 23, reward: 9 }] },
      b: { phase: 'done', task: '用 3、8、5 拼一个算式，结果尽量接近 24', target: 24, n: 5, bestIdx: 3, cands: [{ e: '3 + 8 + 5', r: 16, reward: 2 }, { e: '5 × 3 + 8', r: 23, reward: 9 }, { e: '8 × 5', r: 40, reward: 0 }, { e: '3 × 8', r: 24, reward: 10 }, { e: '3 × 8 − 5', r: 19, reward: 5 }] },
    },
    tot: {
      doc: { kind: 'tot', params: {}, entities: [], streams: [] },
      //  A 评估分支(还没剪) · B 解出 —— 结论必须换一套说法
      a: { phase: 'run', stage: 'evaluate', target: 24, root: '{4, 3, 2}', chosen: -1, solution: '', thoughts: [{ op: '4 × 3 = 12', state: '{12, 2}', sure: true, evaluated: true, pruned: false }, { op: '4 × 2 = 8', state: '{8, 3}', sure: true, evaluated: true, pruned: false }, { op: '3 × 2 = 6', state: '{6, 4}', sure: true, evaluated: true, pruned: false }, { op: '4 + 3 = 7', state: '{7, 2}', sure: false, evaluated: true, pruned: false }, { op: '4 − 3 = 1', state: '{1, 2}', sure: false, evaluated: true, pruned: false }] },
      b: { phase: 'done', stage: 'done', target: 24, root: '{4, 3, 2}', chosen: 0, solution: '4×3=12，12×2=24', thoughts: [{ op: '4 × 3 = 12', state: '{12, 2}', sure: true, evaluated: true, pruned: false }, { op: '4 × 2 = 8', state: '{8, 3}', sure: true, evaluated: true, pruned: false }, { op: '3 × 2 = 6', state: '{6, 4}', sure: true, evaluated: true, pruned: false }, { op: '4 + 3 = 7', state: '{7, 2}', sure: false, evaluated: true, pruned: true }, { op: '4 − 3 = 1', state: '{1, 2}', sure: false, evaluated: true, pruned: true }] },
    },
    mcts: {
      doc: { kind: 'mcts', params: {}, entities: [], streams: [] },
      //  A 第4轮选中A模拟赢 · B 搜索结束选A —— 结论必须换一套说法
      a: { phase: 'run', iter: 4, moves: ['A', 'B', 'C'], n: [2, 1, 1], w: [2, 0, 0], ucb: [2.47, 1.47, 1.47], pick: 0, win: 1, c: 1.4, best: 0 },
      b: { phase: 'done', iter: 6, moves: ['A', 'B', 'C'], n: [4, 1, 1], w: [4, 0, 0], ucb: [2.03, 1.78, 1.78], pick: 0, win: -1, c: 1.4, best: 0 },
    },
    collision: {
      doc: { kind: 'collision', params: {}, entities: [], streams: [] },
      //  A 初始(球各自出发) · B 碰撞中(总量守恒) —— 结论必须换一套说法
      a: { phase: 'init', n: 6, ke: 100 },
      b: { phase: 'run', n: 6, ke: 100 },
    },
    gcn: {
      doc: { kind: 'gcn', params: {}, entities: [], streams: [] },
      //  A 聚合节点2 · B 一层完成 —— 结论必须换一套说法
      a: { phase: 'run', cur: 2, agg: [2, 0, 1, 3], result: 0.25, feat: [1, 0, 0, 0, 1], newFeat: [0.333, 0.333, 0.25, null, null], pos: [], edges: [] },
      b: { phase: 'done', cur: -1, agg: [], result: 0, feat: [0.333, 0.333, 0.25, 0.333, 0.5], newFeat: [0.333, 0.333, 0.25, 0.333, 0.5], pos: [], edges: [] },
    },
    pagerank: {
      doc: { kind: 'pagerank', params: {}, entities: [], streams: [] },
      //  A 第 1 轮迭代 · B 收敛(C 胜) —— 结论必须换一套说法
      a: { phase: 'run', iter: 1, d: 0.85, nodes: ['A', 'B', 'C', 'D'], rank: [0.356, 0.144, 0.463, 0.038], prev: [0.25, 0.25, 0.25, 0.25], ranked: [{ name: 'C', r: 0.463 }, { name: 'A', r: 0.356 }, { name: 'B', r: 0.144 }, { name: 'D', r: 0.038 }], pos: [], edges: [] },
      b: { phase: 'done', iter: 6, d: 0.85, nodes: ['A', 'B', 'C', 'D'], rank: [0.372, 0.2, 0.392, 0.038], prev: [0.372, 0.2, 0.392, 0.038], ranked: [{ name: 'C', r: 0.392 }, { name: 'A', r: 0.372 }, { name: 'B', r: 0.2 }, { name: 'D', r: 0.038 }], pos: [], edges: [] },
    },
    qlearn: {
      doc: { kind: 'qlearn', params: {}, entities: [], streams: [] },
      //  A 倒推第2圈 · B 学好(最优路线) —— 结论必须换一套说法
      a: { phase: 'run', ring: 2, gamma: 0.9, w: 5, h: 4, goal: [4, 1], start: [0, 2], value: [], policy: [], path: [] },
      b: { phase: 'done', ring: -1, gamma: 0.9, w: 5, h: 4, goal: [4, 1], start: [0, 2], value: [], policy: [], path: ['0,2', '1,2', '2,2', '3,2', '4,2', '4,1'] },
    },
    recsys: {
      doc: { kind: 'recsys', params: {}, entities: [], streams: [] },
      //  A 露出用户向量 · B 补全预测 —— 结论必须换一套说法
      a: { phase: 'run', stage: 'userv', pr: -1, pc: -1, users: [{ n: '小明', v: [1, 0] }, { n: '小红', v: [0, 1] }, { n: '阿强', v: [0.8, 0.6] }], movies: [{ n: '复仇者', v: [5, 0] }, { n: '小森林', v: [0, 5] }, { n: '盗梦空间', v: [4, 3] }], known: ['0,0', '0,1', '1,1', '2,0', '2,2'], rating: [[5, 0, null], [null, 5, null], [4, null, 5]] },
      b: { phase: 'done', stage: 'done', pr: 0, pc: 2, users: [{ n: '小明', v: [1, 0] }, { n: '小红', v: [0, 1] }, { n: '阿强', v: [0.8, 0.6] }], movies: [{ n: '复仇者', v: [5, 0] }, { n: '小森林', v: [0, 5] }, { n: '盗梦空间', v: [4, 3] }], known: ['0,0', '0,1', '1,1', '2,0', '2,2'], rating: [[5, 0, 4], [0, 5, 3], [4, 3, 5]] },
    },
    diffusion: {
      doc: { kind: 'diffusion', params: {}, entities: [], streams: [] },
      //  A 前向加噪中 · B 生成完成 —— 结论必须换一套说法
      a: { phase: 'run', dir: 'forward', t: 2, n: 8, sqrtA: 0.387, sqrtN: 0.922, img: [] },
      b: { phase: 'done', dir: 'done', t: 0, n: 8, sqrtA: 1, sqrtN: 0, img: [] },
    },
    gan: {
      doc: { kind: 'gan', params: {}, entities: [], streams: [] },
      //  A 对抗中(D 92%) · B 均衡(D 50%) —— 结论必须换一套说法
      a: { phase: 'run', round: 2, acc: 92, fakeInside: 1, center: [0.72, 0.5], rad: 0.17, real: [], fake: [] },
      b: { phase: 'done', round: 4, acc: 50, fakeInside: 6, center: [0.72, 0.5], rad: 0.17, real: [], fake: [] },
    },
    conv: {
      doc: { kind: 'conv', params: { kernel: '边缘' }, entities: [], streams: [] },
      //  A 滑到 (0,0)、才算 1 格 · B 滑完 9 格(看见边缘) —— 结论必须换一套说法
      a: { phase: 'run', kernelName: '边缘', ci: 0, cj: 0, curVal: 27, out: [[27, null, null], [null, null, null], [null, null, null]] },
      b: { phase: 'done', kernelName: '边缘', ci: 2, cj: 2, curVal: 0, out: [[27, 27, 0], [27, 27, 0], [27, 27, 0]] },
    },
    linreg: {
      doc: { kind: 'linreg', params: {}, entities: [], streams: [] },
      //  A 起点(平线、MSE大) · B 收敛(=OLS) —— 结论必须换一套说法
      a: { phase: 'run', gdStep: 0, w: 0, b: 0, mse: 8.766, wOls: 2.223, bOls: 0.916 },
      b: { phase: 'done', gdStep: 50, w: 2.223, b: 0.915, mse: 0.142, wOls: 2.223, bOls: 0.916 },
    },
    pp: {
      doc: { kind: 'pp', params: { micro: 4 }, entities: [], streams: [] },
      //  A t0 注入(只 1 卡忙) · B 走完(气泡 43%) —— 结论必须换一套说法
      a: { phase: 'run', stages: 4, micro: 4, t: 0, totalTime: 7, busy: [0, -1, -1, -1], util: 57, bubblePct: 43 },
      b: { phase: 'done', stages: 4, micro: 4, t: 6, totalTime: 7, busy: [-1, -1, -1, 3], util: 57, bubblePct: 43 },
    },
    ep: {
      doc: { kind: 'ep', params: { gpus: 4 }, entities: [], streams: [] },
      //  A 路由阶段(还没派发) · B 走完(负载不均 3/1) —— 结论必须换一套说法
      a: { phase: 'route', gpus: 4, experts: 8, expertsPerGpu: 2, load: [0, 0, 0, 0], maxLoad: 3, minLoad: 1 },
      b: { phase: 'done', gpus: 4, experts: 8, expertsPerGpu: 2, load: [2, 3, 1, 2], maxLoad: 3, minLoad: 1 },
    },
    dpattn: {
      doc: { kind: 'dpattn', params: { gpus: 4 }, entities: [], streams: [] },
      //  A TP 切头(每层 all-reduce) · B 走完(DP 零通信) —— 结论必须换一套说法
      a: { phase: 'tp', gpus: 4, b: 8, h: 8, headsPerGpu: 2, reqPerGpu: 2, tpComm: 4096, tpWeight: '1/4' },
      b: { phase: 'done', gpus: 4, b: 8, h: 8, headsPerGpu: 2, reqPerGpu: 2, tpComm: 4096, tpWeight: '1/4' },
    },
    flashdecode: {
      doc: { kind: 'flashdecode', params: { chunks: 4 }, entities: [], streams: [] },
      //  A 算第 1 块(还没合并) · B 合并完成(时延降、结果精确) —— 结论必须换一套说法
      a: { phase: 'chunk', n: 8, chunks: 4, curChunk: 0, output: 0, fullOutput: 4.2145, seqLatency: 8, parLatency: 2 },
      b: { phase: 'done', n: 8, chunks: 4, curChunk: -1, output: 4.2143, fullOutput: 4.2145, seqLatency: 8, parLatency: 2 },
    },
    engram: {
      doc: { kind: 'engram', params: {}, entities: [], streams: [] },
      //  A 建表阶段(还没查) · B 查表命中预测 D —— 结论必须换一套说法
      a: { stage: 'build', ngram: 3, table: [{}, {}, {}, {}], queryKey: '', prediction: '', matchCount: 0 },
      b: { stage: 'done', ngram: 3, table: [{}, {}, {}, {}], queryKey: 'B C', prediction: 'D', matchCount: 2 },
    },
    linattn: {
      doc: { kind: 'linattn', params: {}, entities: [], streams: [] },
      //  A N=64(=d，softmax 还更省) · B N=32768(线性省 512×) —— 结论必须换一套说法
      a: { phase: 'run', n: 64, d: 64, ratio: 1, kvMem: 8192, stateMem: 4160, crossoverN: 64 },
      b: { phase: 'done', n: 32768, d: 64, ratio: 512, kvMem: 4194304, stateMem: 4160, crossoverN: 64 },
    },
    condnum: {
      doc: { kind: 'condnum', params: {}, entities: [], streams: [] },
      //  A κ=1(一步到位) · B κ=50(116 步之字形) —— 结论必须换一套说法
      a: { phase: 'run', kappa: 1, steps: 1, rate: 0 },
      b: { phase: 'done', kappa: 50, steps: 116, rate: 0.961 },
    },
    maxent: {
      doc: { kind: 'maxent', params: {}, entities: [], streams: [] },
      //  A μ=3.5(均匀、熵到顶) · B μ=5.5(偏、熵降) —— 结论必须换一套说法
      a: { phase: 'run', mu: 3.5, ent: 2.585, naiveEnt: 1, maxEnt: 2.585 },
      b: { phase: 'done', mu: 5.5, ent: 1.375, naiveEnt: 1, maxEnt: 2.585 },
    },
    jl: {
      doc: { kind: 'jl', params: {}, entities: [], streams: [] },
      //  A K=16(偏差 31%) · B K=128(偏差 11%) —— 结论必须换一套说法
      a: { phase: 'run', d: 256, k: 16, avgRatio: 1.09, maxDev: 0.31 },
      b: { phase: 'done', d: 256, k: 128, avgRatio: 0.968, maxDev: 0.109 },
    },
    greedy: {
      doc: { kind: 'greedy', params: {}, entities: [], streams: [] },
      //  A 第一步拿 4 · B 走完(3 枚 > 最优 2) —— 结论必须换一套说法
      a: { phase: 'run', rem: 6, pick: 4, picked: [4], greedyCount: 1, optimal: 2, target: 6 },
      b: { phase: 'done', rem: 0, pick: 0, picked: [4, 1, 1], greedyCount: 3, optimal: 2, target: 6 },
    },
    dotsim: {
      doc: { kind: 'dotsim', params: {}, entities: [], streams: [] },
      //  A 正交(90°、内积 0) · B 反向(180°、内积 −6) —— 结论必须换一套说法
      a: { phase: 'run', angleDeg: 90, dot: 0, cosSim: 0, proj: 0, magA: 3, magB: 2 },
      b: { phase: 'done', angleDeg: 180, dot: -6, cosSim: -1, proj: -2, magA: 3, magB: 2 },
    },
    lowrank: {
      doc: { kind: 'lowrank', params: {}, entities: [], streams: [] },
      //  A 秩 1(88%、误差 5.48) · B 秩 4(100% 还原) —— 结论必须换一套说法
      a: { phase: 'run', rank: 1, error: 5.477, energyPct: 87.7, fullParams: 64, lowrankParams: 16 },
      b: { phase: 'done', rank: 4, error: 0, energyPct: 100, fullParams: 64, lowrankParams: 64 },
    },
    editdist: {
      doc: { kind: 'editdist', params: {}, entities: [], streams: [] },
      //  A 第一格 (1,1) · B 全表填完(距离 3) —— 结论必须换一套说法
      a: { phase: 'run', a: 'horse', b: 'ros', ci: 1, cj: 1, match: false, val: 1 },
      b: { phase: 'done', a: 'horse', b: 'ros', ci: 5, cj: 3, match: false, val: 3 },
    },
    induction: {
      doc: { kind: 'induction', params: {}, entities: [], streams: [] },
      //  A 扫描阶段(还没预测) · B 完成(复制出 B) —— 结论必须换一套说法
      a: { stage: 'scan', cur: 'A', matches: [1, 4], prediction: '' },
      b: { stage: 'done', cur: 'A', matches: [1, 4], prediction: 'B' },
    },
    residual: {
      doc: { kind: 'residual', params: {}, entities: [], streams: [] },
      //  A 传到第 8 层(没残差已 0.13) · B 穿完 16 层(没残差 0.03 消失) —— 结论必须换一套说法
      a: { phase: 'run', layer: 8, depth: 16, gradPlain: 0.1342, gradRes: 1.089, resFactor: 0.977, histPlain: [1, 0.8], histRes: [1, 1.06] },
      b: { phase: 'done', layer: 1, depth: 16, gradPlain: 0.0281, gradRes: 0.9323, resFactor: 0.939, histPlain: [1, 0.8], histRes: [1, 1.06] },
    },
    graddesc: {
      doc: { kind: 'graddesc', params: {}, entities: [], streams: [] },
      //  A 第 1 步(损失 21、y 震荡) · B 到谷底(损失 0.08) —— 结论必须换一套说法
      a: { phase: 'run', step: 1, x: 2.88, y: -1.6, loss: 21.094, gx: 5.76, gy: -16, lr: 0.14 },
      b: { phase: 'done', step: 8, x: 0.289, y: 0.003, loss: 0.083, gx: 0.578, gy: 0.026, lr: 0.14 },
    },
    bloom: {
      doc: { kind: 'bloom', params: {}, entities: [], streams: [] },
      //  A 查 owl(撞 dog、假阳性) · B 全部查完 —— 结论必须换一套说法
      a: { phase: 'query', op: 'query', word: 'owl', idx: [5, 1, 2], verdict: '可能在', falsePositive: true },
      b: { phase: 'done', op: '', word: '', idx: [], verdict: '', falsePositive: false },
    },
    bayes: {
      doc: { kind: 'bayes', params: {}, entities: [], streams: [] },
      //  A 第 1 次阳性(只 9%、基础率谬误) · B 连测 4 次(逼近 99%) —— 结论必须换一套说法
      a: { phase: 'run', nTests: 1, prior: 0.01, sens: 0.9, fpr: 0.09, num: 0.009, denFalse: 0.0891, posterior: 0.0917 },
      b: { phase: 'done', nTests: 4, prior: 0.9099, sens: 0.9, fpr: 0.09, num: 0.8189, denFalse: 0.0081, posterior: 0.9902 },
    },
    xent: {
      doc: { kind: 'xent', params: {}, entities: [], streams: [] },
      //  A 拿不准的「on」(25%、惊讶 2bit) · B 整句跑完(困惑度 1.6) —— 结论必须换一套说法
      a: { phase: 'run', trueIdx: 4, trueWord: 'on', pTrue: 0.25, surprise: 2, ce: 0.868, perplexity: 1.826, ppUniform: 8 },
      b: { phase: 'done', trueIdx: 5, trueWord: 'mat', pTrue: 0.95, surprise: 0.074, ce: 0.677, perplexity: 1.599, ppUniform: 8 },
    },
    clt: {
      doc: { kind: 'clt', params: {}, entities: [], streams: [] },
      //  A m=1 就是均匀本身（平顶、峰度 −1.2） · B m=32 长成钟形（峰度→0）—— 结论必须换一套说法
      a: { phase: 'run', m: 1, trials: 20000, std: 0.2889, theoStd: 0.2887, exKurt: -1.205 },
      b: { phase: 'done', m: 32, trials: 20000, std: 0.0516, theoStd: 0.051, exKurt: -0.031 },
    },
    lln: {
      doc: { kind: 'lln', params: {}, entities: [], streams: [] },
      //  A 撒点少、RMS 误差大（还没准） · B 撒点多、跑完（收敛到 π）—— 结论必须换一套说法
      a: { phase: 'run', n: 50, trials: 40, meanEst: 3.148, rmsError: 0.2438, rmsErrSqrtN: 1.72 },
      b: { phase: 'done', n: 12800, trials: 40, meanEst: 3.1441, rmsError: 0.0147, rmsErrSqrtN: 1.67 },
    },
    ortho: {
      doc: { kind: 'ortho', params: {}, entities: [], streams: [] },
      //  A d=2 可能同向（max|cos|≈1） · B d=512 几乎正交 —— 结论必须换一套说法
      a: { phase: 'run', d: 2, std: 0.789, theoStd: 0.707, maxAbs: 0.999, mean: 0.058 },
      b: { phase: 'done', d: 512, std: 0.043, theoStd: 0.044, maxAbs: 0.094, mean: -0.002 },
    },
    hopfield: {
      doc: { kind: 'hopfield', params: {}, entities: [], streams: [] },
      //  A 第 0 步还残缺（6/8） · B 收敛回完整 P0（8/8、one-hot）—— 结论必须换一套说法
      a: { phase: 'run', step: 0, weights: [0.907, 0.045, 0.002, 0.045], best: 0, matchBits: 6, converged: false },
      b: { phase: 'done', step: 1, weights: [0.993, 0.002, 0.002, 0.002], best: 0, matchBits: 8, converged: true },
    },
    scale: {
      doc: { kind: 'scale', params: {}, entities: [], streams: [] },
      //  A d=4 还软 · B d=1024 不缩放塌成 one-hot（熵→0）—— 结论必须换一套说法
      a: { phase: 'run', d: 4, sqrtd: 2, variance: 4, entU: 1.367, entS: 1.796, maxU: 0.6439 },
      b: { phase: 'done', d: 1024, sqrtd: 32, variance: 1024, entU: 0, entS: 1.796, maxU: 1 },
    },
    engine: {
      doc: { kind: 'engine', params: { pool: 4 }, entities: [], streams: [] },
      //  A 批内 2 在跑、2 等 · B 全部跑完（共 8 token）—— 结论必须换一套说法
      a: { phase: 'run', step: 1, free: 1, pool: 4, running: [{}, {}], waiting: ['R3', 'R4'], gen: 2, admitted: [], finished: [], event: 'decode' },
      b: { phase: 'done', step: 6, free: 4, pool: 4, running: [], waiting: [], gen: 8, admitted: [], finished: [], event: 'done' },
    },
    cache: {
      doc: { kind: 'cache', params: { associativity: 2 }, entities: [], streams: [] },
      a: { address: 0x10, tag: 0x0, setIndex: 1, offset: 0, outcome: 'hit', wayUsed: 0, evictedTag: null },
      b: { address: 0x210, tag: 0x4, setIndex: 1, offset: 0, outcome: 'miss', wayUsed: 1, evictedTag: 0x2 },
    },
    tcp: {
      doc: { params: { variant: 'Reno' } },
      //  A 慢启动翻倍 · B 撞上三次重复 ACK 被腰斩 —— 规则和结论都该换一套说法
      a: { round: 3, cwnd: 4, ssthresh: 16, phase: 'slowStart', event: 'none', nextCwnd: 8 },
      b: { round: 8, cwnd: 16, ssthresh: 8, phase: 'congestionAvoidance', event: 'tripleDup', nextCwnd: 8 },
    },
    arq: {
      doc: { params: { protocol: 'GBN', windowSize: 4 } },
      a: { i: 2, base: 0, next: 2, expected: 2, delivered: 2, transmissions: 2, event: 'send' },
      b: { i: 9, base: 2, next: 6, expected: 2, delivered: 2, transmissions: 7, event: 'timeout' },
    },
    crc: {
      doc: { params: { generator: '10011', operation: 'encode' } },
      a: { i: 1, dividend: '11010110000', at: 0, q: '1', quotient: '1', remainder: '', phase: 'divide' },
      b: { i: 9, dividend: '00000001110', at: 6, q: '0', quotient: '1100001010', remainder: '1110', phase: 'result' },
    },
    hamming: {
      doc: { params: { operation: 'check' } },
      a: { bits: '0110100', touched: [], p: 1, covers: [1, 3, 5, 7], ok: true, syndrome: 0, phase: 'check' },
      b: { bits: '0110100', touched: [], p: 4, covers: [4, 5, 6, 7], ok: false, syndrome: 5, phase: 'check' },
    },
    subnet: {
      doc: { params: { operation: 'subnet', prefix: 26 } },
      a: { prefix: 25, best: '', entry: '', hit: false, bits: '', mask: '', touched: [],
           detail: { 地址总数: '128', 可用主机数: '126' }, phase: 'mask' },
      b: { prefix: 26, best: '', entry: '', hit: false, bits: '', mask: '', touched: [],
           detail: { 地址总数: '64', 可用主机数: '62' }, phase: 'hosts' },
    },
    handshake: {
      doc: { params: { scenario: 'both' } },
      a: { client: 'SYN_SENT', server: 'LISTEN', history: [{}],
           seg: { flags: ['SYN'], seq: 100, ack: 0, from: 'client' }, act: 'send' },
      b: { client: 'TIME_WAIT', server: 'CLOSED', history: [{}, {}, {}, {}, {}, {}, {}],
           seg: null, act: 'wait' },
    },
    semaphore: {
      doc: { params: { order: 'wrong', bufferSize: 2 } },
      //  A 正常执行一次 P · B 被卡住（死锁那一步）—— 规则和结论都该换一套说法
      a: { i: 3, empty: 2, full: 0, mutex: 1, buffer: [], pc: { P1: 1, C1: 0 }, blocked: {},
           who: 'P1', act: 'P', sem: 'mutex', produced: 0, consumed: 0 },
      b: { i: 8, empty: 2, full: 0, mutex: 0, buffer: [], pc: { P1: 1, C1: 1 },
           blocked: { C1: 'full', P1: 'mutex' },
           who: '', act: 'deadlock', sem: '', produced: 0, consumed: 0 },
    },
    scheduler: {
      doc: { params: { algorithm: 'RR', quantum: 2 } },
      //  A 有人在跑、队里还排着 · B CPU 空闲 —— 规则同一条，结论必须换一套说法
      a: { t: 3, running: 'P2', readyQueue: ['P3', 'P1'], remaining: { P1: 4, P2: 3, P3: 2 },
           completed: [], sliceLeft: 1 },
      b: { t: 9, running: null, readyQueue: [], remaining: { P1: 0, P2: 0, P3: 0 },
           completed: ['P2', 'P3', 'P1'], sliceLeft: 0 },
    },
    page: {
      doc: { params: { algorithm: 'FIFO', frames: 3 } },
      a: { i: 3, page: 2, outcome: 'hit', frameUsed: 1, evictedPage: null, faults: 3, hits: 1,
           hand: 0, frames: [{ page: 1 }, { page: 2 }, { page: 3 }] },
      b: { i: 4, page: 4, outcome: 'fault', frameUsed: 0, evictedPage: 1, faults: 4, hits: 1,
           hand: 0, frames: [{ page: 4 }, { page: 2 }, { page: 3 }] },
    },
    disk: {
      doc: { params: { algorithm: 'SCAN', headStart: 53, maxTrack: 199, direction: 1 } },
      a: { i: 1, from: 53, head: 65, served: 1, moved: 12, total: 12, pending: [98, 183, 37],
           dir: 1, sweep: false, via: [] },
      b: { i: 5, from: 183, head: 199, served: 4, moved: 16, total: 146, pending: [37, 14],
           dir: 1, sweep: true, via: [199] },
    },
    sort: {
      doc: { params: { algorithm: '冒泡排序' } },
      a: { i: 2, arr: [38, 49, 65, 76, 13], hole: -1, held: null, compare: [1, 2], changed: [],
           pass: 1, passEnd: false, settled: [], sorted: [], comparisons: 3, moves: 0 },
      b: { i: 9, arr: [38, 13, 49, 65, 76], hole: -1, held: null, compare: [0, 1], changed: [0, 1],
           pass: 2, passEnd: true, settled: [4], sorted: [], comparisons: 8, moves: 3 },
    },
    dijkstra: {
      doc: { params: { source: 'A', directed: 0 } },
      a: { act: 'pick', at: 'C', to: '', dist: { A: 0, B: 4, C: 5, D: Infinity },
           prev: { A: null, B: 'A', C: 'A', D: null }, settled: ['A', 'B'], improved: false },
      b: { act: 'relax', at: 'C', to: 'D', dist: { A: 0, B: 4, C: 5, D: 11 },
           prev: { A: null, B: 'A', C: 'A', D: 'C' }, settled: ['A', 'B', 'C'], improved: true },
    },
    banker: {
      doc: { params: { resources: 'A B C' } },
      a: { act: 'accept', pid: 'P1', work: { A: 5, B: 3, C: 2 },
           finish: { P0: false, P1: true, P2: false }, sequence: ['P1'],
           need: { P0: { A: 7, B: 4, C: 3 }, P1: { A: 1, B: 2, C: 2 }, P2: { A: 6, B: 0, C: 0 } } },
      b: { act: 'unsafe', pid: '', work: { A: 2, B: 1, C: 0 },
           finish: { P0: false, P1: false, P2: false }, sequence: [],
           need: { P0: { A: 7, B: 4, C: 3 }, P1: { A: 1, B: 2, C: 2 }, P2: { A: 6, B: 0, C: 0 } } },
    },
    float: {
      doc: { params: { format: 'binary32', operation: 'encode' } },
      a: { phase: 'exponent', bits: '1',
           detail: { 真值阶: '3', 偏置: '127', 阶码: '10000010' } },
      b: { phase: 'mantissa', bits: '110000010',
           detail: { 规格化: '1.1001 × 2^3', 隐含位: '不存', 尾数: '10010000000000000000000' } },
    },
    pipeline: {
      doc: { params: { forwarding: 1 } },
      a: { cycle: 4, at: { I1: 'MEM', I2: 'EX', I3: 'ID', I4: 'IF' }, stalled: [], flushed: [],
           forwards: { I2: 'I1' }, done: 0 },
      b: { cycle: 7, at: { I2: 'WB', I3: 'MEM', I4: 'EX' }, stalled: ['I4'], flushed: ['I5'],
           forwards: {}, done: 2 },
    },
    vm: {
      doc: { params: { pageSizeBytes: 4096, tlbEntries: 4, virtualBits: 16 } },
      a: { vaddr: 0x3ABC, vpn: 3, offset: 0xABC, outcome: 'tlbHit', paddr: 0x7ABC, frame: 7,
           evicted: null, tlbHits: 2, ptHits: 1, faults: 0 },
      b: { vaddr: 0x5010, vpn: 5, offset: 0x010, outcome: 'fault', paddr: null, frame: null,
           evicted: null, tlbHits: 2, ptHits: 1, faults: 1 },
    },
    multiply: {
      doc: { params: { algorithm: '补码一位乘', bits: 4 } },
      a: { round: 1, hi: '0000', lo: '1101', extra: '0', act: 'sub', judge: '10',
           q: null, rem: null },
      b: { round: 4, hi: '1110', lo: '1001', extra: '1', act: 'shift', judge: '11',
           q: null, rem: null },
    },
    avl: {
      doc: { params: { mode: 'AVL' } },
      a: { key: 30, act: 'insert', rotation: '', pivot: -1, inserted: 2, rotations: 0, root: 0,
           nodes: [{ key: 10 }, { key: 20 }, { key: 30 }], focus: [1] },
      b: { key: 30, act: 'rotate', rotation: 'RR', pivot: 0, inserted: 2, rotations: 1, root: 1,
           nodes: [{ key: 10 }, { key: 20 }, { key: 30 }], focus: [0, 1, 2] },
    },
    hash: {
      doc: { params: { size: 11, method: '线性探测', rehashStep: 3 } },
      a: { key: 22, home: 0, probes: [0], slot: 0, compares: 1, totalCompares: 3, count: 3,
           collided: false, table: [[22], [], []] },
      b: { key: 11, home: 0, probes: [0, 1, 2], slot: 2, compares: 3, totalCompares: 6, count: 4,
           collided: true, table: [[22], [1], [11]] },
    },
    rip: {
      doc: { params: { scenario: '断链' } },
      //  A：断链后正在无穷计数的某一轮
      a: { act: 'capped', round: 6, changed: ['B→A', 'D→A'], broken: 'AB', routers: ['A', 'B', 'C', 'D'],
           dist: { A: { A: 0, B: 16, C: 16, D: 16 }, B: { A: 9, B: 0, C: 1, D: 2 },
                   C: { A: 8, B: 1, C: 0, D: 1 }, D: { A: 9, B: 2, C: 1, D: 0 } } },
      //  B：收敛完成
      b: { act: 'converged', round: 3, changed: [], broken: '', routers: ['A', 'B', 'C', 'D'],
           dist: { A: { A: 0, B: 1, C: 2, D: 3 }, B: { A: 1, B: 0, C: 1, D: 2 },
                   C: { A: 2, B: 1, C: 0, D: 1 }, D: { A: 3, B: 2, C: 1, D: 0 } } },
    },
    addsub: {
      doc: { params: { operation: '加', bits: 8 } },
      //  A：正在逐列相加的某一列
      a: { act: 'addbit', op: 'add', aVal: 45, bVal: 38, bits: 8, pos: 4, carryIn: 1,
           sum: '····0011', cInSign: 0, cOutSign: 0, overflow: false, addend: '00100110', bBits: '00100110' },
      //  B：完成、且溢出
      b: { act: 'done', op: 'add', aVal: 100, bVal: 50, bits: 8, pos: -1, carryIn: 0,
           sum: '10010110', cInSign: 1, cOutSign: 0, overflow: true, addend: '00110010', bBits: '00110010' },
    },
    forward: {
      doc: { params: {} },
      a: { phase: 'run', stageIdx: 2, stageName: '③ 自注意力', stageLink: '缩放点积+因果掩码 / 自注意力', vec: [0.71,-0.72,1.49,0.22], attn: [0.08,0.92], predicted: null, seq: ['猫','吃'], probs: null, detail: '注意力' },
      b: { phase: 'done', stageIdx: 10, stageName: '完成', stageLink: '—', vec: [0.76,-0.64,1.73,0.01], attn: null, predicted: '鱼', seq: ['猫','吃'], probs: [0.06,0.4,0.47,0.08], detail: '' },
    },
    rmsnorm: {
      doc: { params: { gain: '全 1' } },
      a: { phase: 'normalize', x: [2,-4,1,3], meanSq: 7.5, rms: 2.739, cursor: 1, gain: [1,1,1,1], out: [0.73,-1.461,null,null], outRms: 1 },
      b: { phase: 'done', x: [2,-4,1,3], meanSq: 7.5, rms: 2.739, cursor: 4, gain: [1,1,1,1], out: [0.73,-1.461,0.365,1.095], outRms: 1 },
    },
    rope: {
      doc: { params: { theta: 45 } },
      a: { phase: 'rotate', pos: 1, thetaDeg: 45, angleDeg: 45, x: 0.707, y: 0.707, norm: 1, dotWith0: 0.707 },
      b: { phase: 'done', pos: 7, thetaDeg: 45, angleDeg: 315, x: 0.707, y: -0.707, norm: 1, dotWith0: 0.707 },
    },
    moe: {
      doc: { params: { topk: 2 } },
      a: { phase: 'route', experts: 4, topk: 2, tokens: ['猫','追','老','鼠'], cursor: 0, chosen: [0,2], chosenGates: [0.73,0.27], load: [1,0,1,0], activeFrac: 0.5 },
      b: { phase: 'done', experts: 4, topk: 2, tokens: ['猫','追','老','鼠'], cursor: 4, chosen: [], chosenGates: [], load: [3,1,3,1], activeFrac: 0.5 },
    },
    quant: {
      doc: { params: { bits: 8 } },
      a: { phase: 'quantize', bits: 8, qmax: 127, scale: 0.0165, cursor: 3, weights: [0.12,-0.87,1.53,-2.10,0.44,1.98,-0.33,0.71], ints: [7,-53,93,-127,null,null,null,null], deq: [0.116,-0.876,1.538,-2.100,null,null,null,null], errs: [0.004,0.006,0.008,0.000,null,null,null,null], maxErr: 0.008, bytesFp32: 32, bytesQ: 8 },
      b: { phase: 'done', bits: 8, qmax: 127, scale: 0.0165, cursor: 8, weights: [0.12,-0.87,1.53,-2.10,0.44,1.98,-0.33,0.71], ints: [7,-53,93,-127,27,120,-20,43], deq: [0.116,-0.876,1.538,-2.100,0.446,1.984,-0.331,0.711], errs: [0.004,0.006,0.008,0.000,0.006,0.004,0.001,0.001], maxErr: 0.008, bytesFp32: 32, bytesQ: 8 },
    },
    specdec: {
      doc: { params: { k: 3 } },
      a: { phase: 'round', proposals: ['深','度','猫'], matchLen: 2, bonus: false, gotThisRound: 3, targetPasses: 1, tokensOut: 3, speedup: 3.0, K: 3 },
      b: { phase: 'done', proposals: ['思'], matchLen: 1, bonus: false, gotThisRound: 1, targetPasses: 3, tokensOut: 8, speedup: 2.67, K: 3 },
    },
    scaledmask: {
      doc: { params: { d: 4, causal: 1 } },
      a: { phase: 'row', row: 1, tokens: ['它','爱','吃','鱼'], d: 4, scale: 2, causal: true, peak: 0.818, peakUnscaled: 0.953, raw: [2,5,3,4] },
      b: { phase: 'done', row: 3, tokens: ['它','爱','吃','鱼'], d: 4, scale: 2, causal: true, peak: 0.509, peakUnscaled: 0.696, raw: [1,4,2,5] },
    },
    roofline: {
      doc: { params: { d: 4096 } },
      a: { phase: 'point', batch: 1, ai: 1.0, ridge: 156, bound: 'memory', attainTFLOPs: 2, util: 0.006, peakTFLOPs: 312 },
      b: { phase: 'done', batch: 128, ai: 120.47, ridge: 156, bound: 'memory', attainTFLOPs: 241, util: 0.772, peakTFLOPs: 312 },
    },
    flash: {
      doc: { params: { block: 2 } },
      a: { phase: 'block', block: [2,3], m: 3.0, l: 2.0, acc: 40, out: 20.0, naive: 34.53, err: 0.42, blockSize: 2, scores: [2,1,3,0.5,2.5,1.5], values: [10,20,30,40,50,60] },
      b: { phase: 'done', block: [], m: 3.0, l: 2.41, acc: 83.3, out: 34.5278, naive: 34.5278, err: 2e-16, blockSize: 2, scores: [2,1,3,0.5,2.5,1.5], values: [10,20,30,40,50,60] },
    },
    kvcache: {
      doc: { params: { prompt: 2, total: 6 } },
      a: { phase: 'decode', seq: ['深','度','学'], computed: 1, recomputed: 3, cacheSize: 3, cumCached: 3, cumNaive: 5, savedPct: 0 },
      b: { phase: 'done', seq: ['深','度','学','习','真','有'], computed: 0, recomputed: 0, cacheSize: 6, cumCached: 6, cumNaive: 20, savedPct: 70 },
    },
    mha: {
      doc: { params: { variant: 'GQA', heads: 8, groups: 2 } },
      a: { variant: 'GQA', heads: 8, kvHeads: 2, map: [0,0,0,0,1,1,1,1], focus: 2, kvRatio: 0.25, act: 'assign' },
      b: { variant: 'MQA', heads: 8, kvHeads: 1, map: [0,0,0,0,0,0,0,0], focus: -1, kvRatio: 0.125, act: 'done' },
    },
    batching: {
      doc: { params: { mode: '连续', slots: 2 } },
      a: { act: 'run', mode: 'cont', active: ['A', 'C'], done: ['B'], admitted: ['C'], waiting: ['D'], finished: [], step: 1, util: 1, slots: 2 },
      b: { act: 'done', mode: 'cont', active: [], done: [], admitted: [], waiting: [], finished: ['A', 'B', 'C', 'D', 'E'], step: 9, util: 0, slots: 2 },
    },
    bpe: {
      doc: { params: { text: '英文 lowest' } },
      //  A：合并一步
      a: { act: 'merge', toks: ['lo', 'w', 'e', 's', 't'], pair: ['l', 'o'], merged: 'lo', start: 6, ruleLeft: 4 },
      //  B：完成
      b: { act: 'done', toks: ['lowest'], pair: null, merged: '', start: 6, ruleLeft: 0 },
    },
    sampling: {
      doc: { params: { temperature: 1, topK: 3, topP: 0.8, logits: '长尾一堆' } },
      //  A：top-k 截断步
      a: { phase: 'topk', T: 1, k: 3, p: 0.8, tokens: ['好', '棒', '妙', '行', '嗯'], order: [0, 1, 2, 3, 4],
           kept: [true, true, true, false, false], final: [] },
      //  B：完成
      b: { phase: 'done', T: 1, k: 3, p: 0.8, tokens: ['好', '棒', '妙', '行', '嗯'], order: [0, 1, 2, 3, 4],
           kept: [true, true, true, false, false], final: [0.57, 0.26, 0.17, 0, 0] },
    },
    llmsize: {
      doc: { params: { model: '7B 级', dtype: 'fp16', seq: 2048 } },
      //  A：算 FFN 参数那步
      a: { phase: 'ffn', L: 32, d: 4096, total: 0, embed: 131e6, attnPerLayer: 67e6, ffnPerLayer: 134e6, weightBytes: 0, kvBytes: 0, dtype: 'fp16', bytes: 2, seq: 2048 },
      //  B：权重显存那步
      b: { phase: 'weight', L: 32, d: 4096, total: 6.57e9, embed: 131e6, attnPerLayer: 67e6, ffnPerLayer: 134e6, weightBytes: 13.1e9, kvBytes: 0, dtype: 'fp16', bytes: 2, seq: 2048 },
    },
    attention: {
      doc: { params: { sentence: '它爱吃鱼' } },
      //  A：某查询的 softmax 阶段（权重出来了）
      a: { phase: 'softmax', qi: 1, tokens: ['它', '爱', '吃', '鱼'], scores: [0.7, 0.7, 1.4, 2.1],
           attn: [[0.22, 0.11, 0.22, 0.45], [0.12, 0.12, 0.25, 0.51], [], []], out: [] },
      //  B：全部完成
      b: { phase: 'done', qi: 3, tokens: ['它', '爱', '吃', '鱼'], scores: [],
           attn: [[0.22, 0.11, 0.22, 0.45], [0.12, 0.12, 0.25, 0.51], [0.14, 0.29, 0.29, 0.29], [0.12, 0.12, 0.25, 0.51]], out: [] },
    },
    chunkprefill: {
      doc: { params: { chunk: 2 } },
      a: { phase: 'run', chunk: 2, timeline: [{kind:'prefill',cost:2,label:'A prefill 块1(2)'},{kind:'decode',cost:1,label:'B decode 1'}], cursor: 1, clock: 3, firstDecodeAt: 3, prefillLen: 8, totalTime: 12 },
      b: { phase: 'done', chunk: 2, timeline: [{kind:'prefill',cost:2,label:'x'}], cursor: 8, clock: 12, firstDecodeAt: 3, prefillLen: 8, totalTime: 12 },
    },
    kvoffload: {
      doc: { params: { slots: 3 } },
      a: { phase: 'run', slots: 3, req: 3, result: 'miss', evicted: 1, reloaded: false, gpu: [2,0,3], hits: 1, offloads: 1, reloads: 0 },
      b: { phase: 'done', slots: 3, req: 2, result: 'miss', evicted: null, reloaded: false, gpu: [1,4,2], hits: 1, offloads: 4, reloads: 2 },
    },
    collective: {
      doc: { params: { gpus: 4 } },
      a: { phase: 'reduce', G: 4, round: 2, totalSteps: 6, target: [1111,2222,3333,4444], moves: [{src:0,dst:1,chunk:3},{src:1,dst:2,chunk:0}] },
      b: { phase: 'done', G: 4, round: 3, totalSteps: 6, target: [1111,2222,3333,4444], moves: [] },
    },
    tensorpar: {
      doc: { params: { gpus: 2 } },
      a: { phase: 'compute', gpu: 0, G: 2, cols: [0,2], shard: [7,5], full: [7,5,4,8], fraction: 0.5 },
      b: { phase: 'done', gpu: 2, G: 2, cols: [0,4], shard: [], full: [7,5,4,8], fraction: 0.5 },
    },
    layout: {
      doc: { params: { layout: 'row-major' } },
      a: { phase: 'lay', layout: 'row-major', rows: 2, cols: 3, cur: { addr: 4, i: 1, j: 1, v: 5 }, rowStride: 1, colStride: 3, mem: [{v:1},{v:2},{v:3},{v:4},{v:5},null] },
      b: { phase: 'done', layout: 'row-major', rows: 2, cols: 3, cur: null, rowStride: 1, colStride: 3, mem: [{v:1},{v:2},{v:3},{v:4},{v:5},{v:6}] },
    },
    matmul: {
      doc: { params: {} },
      a: { phase: 'cell', row: 0, col: 0, terms: [{a:1,b:7,prod:7},{a:2,b:9,prod:18},{a:3,b:11,prod:33}], value: 58, M:2, K:3, N:2, flops: 6, totalFlops: 24 },
      b: { phase: 'done', row: 1, col: 1, terms: [], value: 0, M:2, K:3, N:2, flops: 24, totalFlops: 24 },
    },
    softmax: {
      doc: { params: { temperature: 1, logits: '天气续写' } },
      //  A：exp 阶段（还没归一化）
      a: { phase: 'exp', T: 1, tokens: ['好', '不错', '热'], probs: [], entropy: 0, sumExp: 1.92 },
      //  B：done，高温分布平
      b: { phase: 'done', T: 2, tokens: ['好', '不错', '热'], probs: [0.5, 0.3, 0.2], entropy: 2.4, sumExp: 3 },
    },
    paged: {
      doc: { params: { schedule: '两请求交错', blockSize: 4, totalBlocks: 8 } },
      //  A：分配一个非连续的新块
      a: { act: 'alloc', req: 'A', focus: 4, freeCount: 3, totalBlocks: 8, blockSize: 4,
           tables: { A: [0, 2, 4], B: [1, 3] } },
      //  B：全部完成
      b: { act: 'done', req: '', focus: -1, freeCount: 5, totalBlocks: 8, blockSize: 4,
           tables: { A: [0, 2, 4] } },
    },
    radix: {
      doc: { params: { requests: '共享 system 前缀', budget: 12 } },
      //  A：命中一个前缀 token
      a: { act: 'match', req: 2, pos: 1, reqTokens: ['系统', '请', '翻译'], hit: 2, compute: 0,
           cached: 5, budget: 12, savedTotal: 0, seenTotal: 5 },
      //  B：全部完成
      b: { act: 'done', req: 4, pos: 1, reqTokens: ['系统', '你好'], hit: 1, compute: 1,
           cached: 8, budget: 12, savedTotal: 7, seenTotal: 15 },
    },
    expr: {
      doc: { params: { expr: '3+4*2-1' } },
      //  A：转换阶段，读到 * 直接压栈
      a: { phase: 'toRPN', act: 'op', infix: ['3', '+', '4', '*', '2', '-', '1'], at: 3,
           stack: ['+', '*'], rpn: ['3', '4'], result: null },
      //  B：求值阶段，遇运算符弹两个算完
      b: { phase: 'eval', act: 'apply', infix: ['3', '+', '4', '*', '2', '-', '1'], at: 3,
           stack: ['3', '8'], rpn: ['3', '4', '2', '*', '+', '1', '-'], result: null },
    },
    btree: {
      doc: { params: { order: '前序' } },
      //  A：前序遍历、刚输出根（栈里只有根）
      a: { order: 'pre', nodes: [{ key: 50 }, { key: 30 }, { key: 70 }], root: 0,
           cur: 0, visited: [0], aux: [0], auxKind: 'stack', act: 'visit', log: '' },
      //  B：中序遍历、已跑完（提到 BST 中序有序）
      b: { order: 'in', nodes: [{ key: 50 }, { key: 30 }, { key: 70 }], root: 0,
           cur: -1, visited: [1, 0, 2], aux: [], auxKind: 'stack', act: 'done', log: '' },
    },
    huffman: {
      doc: { params: {} },
      a: { forest: [0, 1, 2], picked: [0, 1], merged: 3, wpl: 7, codes: {}, act: 'merge',
           nodes: [{ w: 3 }, { w: 4 }, { w: 8 }, { w: 7 }] },
      b: { forest: [4], picked: [], merged: 4, wpl: 22, codes: { A: '00', B: '01', C: '1' },
           act: 'done', nodes: [{ w: 3 }, { w: 4 }, { w: 8 }, { w: 7 }, { w: 15 }] },
    },
    kmp: {
      doc: { params: { text: 'ABABABCABAA', pattern: 'ABABC', showMatch: 1 } },
      a: { phase: 'match', next: [0, 0, 1, 2, 0], j: 0, k: 0, ti: 4, pj: 4, eq: false,
           found: [], textAdvances: 4 },
      b: { phase: 'found', next: [0, 0, 1, 2, 0], j: 0, k: 0, ti: 7, pj: 5, eq: true,
           found: [2], textAdvances: 7 },
    },
    mst: {
      doc: { params: { algorithm: 'Kruskal', start: 'A' } },
      a: { chosen: ['AB'], inTree: ['A', 'B'], edge: 'AC', act: 'take',
           find: {}, weight: 9 },
      b: { chosen: ['AB', 'AC'], inTree: ['A', 'B', 'C'], edge: 'BC', act: 'skip',
           find: {}, weight: 9 },
    },
    topo: {
      doc: { params: { operation: 'critical' } },
      a: { phase: 'topo', indeg: { V1: 0, V2: 1, V3: 1 }, order: ['V1'], at: 'V1',
           ve: {}, vl: {}, ee: {}, el: {}, critical: [] },
      b: { phase: 'activity', indeg: { V1: 0, V2: 0, V3: 0 }, order: ['V1', 'V2', 'V3'], at: 'a1',
           ve: { V1: 0, V2: 6 }, vl: { V1: 0, V2: 6 }, ee: { a1: 0 }, el: { a1: 0 },
           critical: ['V1', 'V2'] },
    },
    partition: {
      doc: { params: { algorithm: '首次适应', memorySize: 640 } },
      a: { act: 'alloc', job: 'J1', size: 130, at: 0, scanned: [0], merged: 0,
           external: 60, freeTotal: 510,
           blocks: [{ start: 0, size: 130, job: 'J1' }, { start: 130, size: 510 }] },
      b: { act: 'fail', job: 'J4', size: 400, at: -1, scanned: [0, 1, 2], merged: 0,
           external: 340, freeTotal: 340,
           blocks: [{ start: 0, size: 130, job: 'J1' }, { start: 130, size: 200 }] },
    },
    inode: {
      doc: { params: { blockSizeBytes: 1024, pointerSizeBytes: 4, directCount: 10 } },
      a: { lbn: 5, level: 'direct', path: ['inode 第 5 个直接地址', '数据块'], reads: 1,
           ranges: [{ name: '直接地址', from: 0, to: 9, count: 10 },
                    { name: '一级间址', from: 10, to: 265, count: 256 }] },
      b: { lbn: 300, level: 'double', path: ['inode 二级间址', '一级索引块', '二级索引块', '数据块'],
           reads: 3,
           ranges: [{ name: '直接地址', from: 0, to: 9, count: 10 },
                    { name: '二级间址', from: 266, to: 65801, count: 65536 }] },
    },
    bplus: {
      doc: { params: { order: 3 } },
      a: { key: 30, act: 'insert', upKey: 0, splitLeaf: false, height: 1, splits: 0, root: 0,
           nodes: [{ keys: [10, 20] }], focus: [0] },
      b: { key: 30, act: 'split', upKey: 20, splitLeaf: true, height: 2, splits: 1, root: 2,
           nodes: [{ keys: [10] }, { keys: [20, 30] }, { keys: [20] }], focus: [0, 1] },
    },
    traverse: {
      doc: { params: { algorithm: 'DFS', start: 'A', directed: 0 } },
      a: { order: ['A', 'B'], pending: ['D', 'C'], at: 'B', act: 'visit',
           treeEdges: ['AB'] },
      b: { order: ['A', 'B', 'D'], pending: ['C'], at: 'A', act: 'skip',
           treeEdges: ['AB', 'BD'] },
    },
    bitmap: {
      doc: { params: { wordBits: 16, words: 8 } },
      a: { act: 'alloc', blocks: [18, 19], word: 1, bit: 2, freeCount: 120,
           bits: [[0], [1]] },
      b: { act: 'fail', blocks: [], word: -1, bit: -1, freeCount: 3,
           bits: [[1], [1]] },
    },
    csma: {
      doc: { params: { maxAttempts: 16 } },
      a: { slot: 1, sending: ['A', 'B'], collision: true, attempts: { A: 1, B: 1 },
           backoff: { A: 1, B: 0 }, picked: { A: '1 / 0~1', B: '0 / 0~1' }, done: [], aborted: [] },
      b: { slot: 5, sending: ['A'], collision: false, attempts: { A: 1, B: 1 },
           backoff: {}, picked: {}, done: ['B'], aborted: [] },
    },
  }

  /*
   * 段名是跨实验的骨架 —— 换个名字、换个顺序，用户第二个实验就得重新学怎么读。
   *
   * ⚠️ 但**不是"必须四段"**，是"必须是这个骨架的前缀，且至少三段"。
   * 第四段「对应画面」的活是「这段话对应屏幕上哪一块」—— 那是给
   * "文字在一处、图在另一处"准备的。推演一旦贴到图旁边（Cache 改版后
   * 它就在右栏，紧挨着舞台），再写一段话去描述读者正盯着的那张图，
   * 就是同一件事多说一遍。
   * 前三段是**每一屏都必须回答**的：输入是什么、按什么规则、结果如何。
   */
  const KEYS = ['本步输入', '判定规则', '本步结果', '对应画面']
  const MIN_KEYS = 3

  const noFix = withStep.filter(([id]) => !FIX[id]).map(([id]) => id)
  noFix.length === 0
    ? ok(`${withStep.length} 个实验各有一份夹具`)
    : bad(`写了「这一步为什么」却没配夹具：${noFix.join(', ')}`
          + ' —— 补一份 A/B 状态到 FIX 里，说清它两种情况该说什么不一样的话')

  const flat: string[] = []
  const wrongKeys: string[] = []
  for (const [id, g] of withStep) {
    const f = FIX[id]
    if (!f) continue
    const a = g.step!(f.a as never, f.doc as never)
    const b = g.step!(f.b as never, f.doc as never)
    const ka = a.map(x => x.k)
    if (ka.length < MIN_KEYS || ka.length > KEYS.length || ka.some((k, i) => k !== KEYS[i]))
      wrongKeys.push(`${id}(${ka.join('/')})`)
    const same = a.length === b.length && a.every((x, i) => x.v === b[i]!.v)
    if (same) flat.push(id)
    const text = a.map(x => x.v).join('')
    if (!/\d/.test(text)) flat.push(`${id}(一个具体的数都没提)`)
    //  「于是」这一段必须自己就变 —— 它是结论那格
    if (a[2]?.v === b[2]?.v) flat.push(`${id}(「于是」那段是常量)`)
    //  每一段都不许留空 —— 空段在屏幕上是一行光秃秃的段名
    a.forEach((x, i) => { if (!x.v.trim()) flat.push(`${id}(第 ${i + 1} 段是空的)`) })
  }
  wrongKeys.length === 0
    ? ok(`段名都是骨架的前缀、且不少于 ${MIN_KEYS} 段（${KEYS.join(' → ')}）`)
    : bad(`段名对不上：${wrongKeys.join(', ')}`
          + ` —— 必须是「${KEYS.join(' → ')}」的前缀，且至少 ${MIN_KEYS} 段`)
  flat.length === 0
    ? ok('换一步，四段跟着变、「于是」那段自己就变，而且提到了此刻的具体地址与位置')
    : bad(`没跟着数据走：${flat.join(', ')}`)

  /*  自检：这两条判据都得真的会红。
      造一份**段名对、内容却是常量**的假实现 —— 它最像真的，也最该被挡下。 */
  const fake = () => KEYS.map(k => ({ k, v: '这一步发生了一些事。' }))
  const fa = fake(), fb = fake()
  const fakeCaught = fa.every((x, i) => x.v === fb[i]!.v)
    && !fa.map(x => x.v).join('').match(/\d/)
  fakeCaught && withStep.every(([id, g]) => {
    const f = FIX[id]!
    const a = g.step!(f.a as never, f.doc as never), b = g.step!(f.b as never, f.doc as never)
    return a[2]!.v !== b[2]!.v
  })
    ? ok('自检：段名对但内容恒定的假实现会被挡下、真实现过得去 —— 它能红，也不误杀')
    : bad(`自检失败：假实现被抓=${fakeCaught}`)
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
