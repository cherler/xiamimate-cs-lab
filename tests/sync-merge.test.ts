/**
 * 跨设备合并的规则（web/src/sync.ts）。
 *
 * 合并是**纯函数**，所以判据挂在定义级性质上，而不是"跑一遍看看像不像"：
 *   · 幂等   merge(a, a) = a           —— 同一份数据合并自己不该变
 *   · 交换   merge(a, b) = merge(b, a) —— 谁先登录不该影响结果
 *   · 不凭空 合并结果里的每一问，必须至少有一边做过
 *
 * 这三条比"对答案"强：它们不依赖我记住某个具体数字，
 * 而任何一条被破坏都会让用户看到一份两边都不曾发生过的记录。
 */
import * as P from '../web/src/progress.ts'
import * as S from '../web/src/sync.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

const rec = (o: Partial<P.QRecord>): P.QRecord => ({
  attempts: 1, wrong: 0, streak: 1, lastCorrect: true, lastAt: 1000, ...o,
})
const store = (q: Record<string, P.QRecord>): P.Store => ({ v: 1, q })
const canon = (s: P.Store) => JSON.stringify(Object.keys(s.q).sort().map(k => [k, s.q[k]]))

console.log('\n【只有一边有】')
{
  const a = store({ 'x#0': rec({ attempts: 3 }) })
  const b = store({ 'y#1': rec({ attempts: 5 }) })
  const m = S.mergeStores(a, b)
  m.q['x#0']?.attempts === 3 && m.q['y#1']?.attempts === 5 && Object.keys(m.q).length === 2
    ? ok('两边各有各的题 → 全都留下，一条不改')
    : bad(`并集不对：${JSON.stringify(m.q)}`)
}

console.log('\n【次数取较大值，不是相加】')
{
  //  两台设备都带着同一段本地历史（第一次登录时必然如此）：
  //  各自记着"做过 3 次、错过 2 次"。相加会变成 6 次 / 4 次。
  const a = store({ 'x#0': rec({ attempts: 3, wrong: 2, lastAt: 100 }) })
  const b = store({ 'x#0': rec({ attempts: 3, wrong: 2, lastAt: 100 }) })
  const m = S.mergeStores(a, b).q['x#0']
  m.attempts === 3 && m.wrong === 2
    ? ok('同一段历史合并两次 → 仍是 3 次 / 错 2 次（相加会数成 6 / 4）')
    : bad(`重复计数了：做过 ${m.attempts} 次、错 ${m.wrong} 次`)
}

console.log('\n【状态整组取自更近的一次】')
{
  //  逐字段各取各的会造出一个**两边都不曾发生过**的状态：
  //  连对 2 次却"最近一次答错了"。那样的记录 statusOf 会判成已掌握，
  //  而用户刚刚才答错 —— 徽章和事实对不上。
  const older = rec({ attempts: 5, wrong: 1, streak: 2, lastCorrect: true, lastAt: 100 })
  const newer = rec({ attempts: 6, wrong: 2, streak: 0, lastCorrect: false, lastAt: 200 })
  const m = S.mergeRecord(older, newer)
  m.streak === 0 && m.lastCorrect === false && m.lastAt === 200
    ? ok('更近的那次答错了 → streak 归零、lastCorrect=false（次数仍取较大值 6 / 2）')
    : bad(`状态字段串了：${JSON.stringify(m)}`)
  m.attempts === 6 && m.wrong === 2
    ? ok('同一条里，次数与状态各按各的规则 —— 互不干扰')
    : bad(`次数不对：${m.attempts} / ${m.wrong}`)
}

console.log('\n【时刻相同时取更保守的那条】')
{
  //  `Date.now()` 在同一毫秒里能返回两次，而合并的两份记录常常同源 ——
  //  平局不是假想的情况。取谁不能看参数顺序，否则"谁先登录"会决定错题本长什么样。
  const good = rec({ attempts: 5, wrong: 1, streak: 2, lastCorrect: true, lastAt: 500 })
  const poor = rec({ attempts: 5, wrong: 2, streak: 0, lastCorrect: false, lastAt: 500 })
  const ab = S.mergeRecord(good, poor)
  const ba = S.mergeRecord(poor, good)
  JSON.stringify(ab) === JSON.stringify(ba)
    ? ok('同一时刻的两条 → 换个顺序合并，结果一模一样')
    : bad(`顺序影响了结果：${JSON.stringify(ab)} vs ${JSON.stringify(ba)}`)
  ab.lastCorrect === false && ab.streak === 0
    ? ok('平局取更保守的那条 —— 没有依据说哪个真时，宁可判成还要再练')
    : bad(`平局给出了掌握态：${JSON.stringify(ab)}`)
}

console.log('\n【第一次答对的时间取较早】')
{
  const a = rec({ firstCorrectAt: 500, lastAt: 100 })
  const b = rec({ firstCorrectAt: 300, lastAt: 900 })
  S.mergeRecord(a, b).firstCorrectAt === 300
    ? ok('两边都答对过 → 取更早那次（"什么时候第一次会的"只有一个答案）')
    : bad('firstCorrectAt 没取较早')
  //  一边从没答对过时，那一边压根没有这个字段 —— 不能因此把有值的那边抹掉
  const c = rec({ lastAt: 900 })
  delete (c as { firstCorrectAt?: number }).firstCorrectAt
  S.mergeRecord(a, c).firstCorrectAt === 500
    ? ok('一边从没答对过 → 保留有值的那边')
    : bad('缺字段的一边把有值的抹掉了')
}

console.log('\n【定义级性质】')

/** 造一批伪随机但确定的记录 —— 不用 Math.random，失败要能原样复现。
 *  乘法走 Math.imul：直接写 `s * 1103515245` 会超出 2^53，
 *  得到的是被舍入过的数 —— 序列仍然"确定"，但确定成了什么谁也说不清。 */
function sample(seed: number, n: number): P.Store {
  let s = seed >>> 0
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  const q: Record<string, P.QRecord> = {}
  for (let i = 0; i < n; i++) {
    const k = `p${Math.floor(next() * 8)}#${Math.floor(next() * 4)}`
    const wrong = Math.floor(next() * 4)
    q[k] = {
      attempts: wrong + Math.floor(next() * 5) + 1,
      wrong,
      streak: Math.floor(next() * 3),
      lastCorrect: next() > 0.5,
      //  **时刻只取 6 个值。** 第一版取值范围有十万，于是 40 组样本里
      //  一次平局都没撞上 —— 而"lastAt 相同"正是合并唯一坏过的地方。
      //  随机用例的覆盖面不是越宽越好，要往可疑的地方压。
      lastAt: Math.floor(next() * 6) * 1000,
      ...(next() > 0.5 ? { firstCorrectAt: Math.floor(next() * 100000) } : {}),
    }
  }
  return { v: 1, q }
}

{
  let idem = 0, comm = 0, invented = 0
  for (let seed = 1; seed <= 40; seed++) {
    const a = sample(seed, 12)
    const b = sample(seed + 500, 12)
    if (canon(S.mergeStores(a, a)) !== canon(a)) idem++
    if (canon(S.mergeStores(a, b)) !== canon(S.mergeStores(b, a))) comm++
    for (const k of Object.keys(S.mergeStores(a, b).q)) {
      if (!a.q[k] && !b.q[k]) invented++
    }
  }
  idem === 0 ? ok('幂等：merge(a, a) = a（40 组）') : bad(`幂等被破坏 ${idem} 组`)
  comm === 0 ? ok('交换：merge(a, b) = merge(b, a)（40 组）—— 谁先登录不影响结果')
             : bad(`交换律被破坏 ${comm} 组`)
  invented === 0 ? ok('不凭空造题：结果里每一问都至少有一边做过') : bad(`凭空多出 ${invented} 问`)
}

console.log('\n【云端回来的东西要挑过再用】')
{
  const dirty = {
    'good#0': { attempts: 2, wrong: 1, streak: 1, lastCorrect: true, lastAt: 9 },
    'half#0': { attempts: 2, wrong: 1 },                 // 缺状态字段
    'str#0': { attempts: '3', wrong: 0, streak: 0, lastCorrect: false, lastAt: 1 },
    'nul#0': null,
  }
  const clean = S.sanitize(dirty)
  Object.keys(clean.q).length === 1 && !!clean.q['good#0']
    ? ok('形状不对的三条整条丢掉，只留合格的那条')
    : bad(`挑得不对：${JSON.stringify(clean.q)}`)
  //  为什么是"丢掉"而不是"补默认值"：补出来的 {attempts:0, wrong:1} 会一直
  //  挂在错题本上，而用户根本没做过那道题。
  P.statusOf(clean.q['half#0']) === 'untouched'
    ? ok('丢掉的那条 → 状态是"还没做"，不会假装出一条错题')
    : bad('缺字段的条目被补成了一条假记录')
  Object.keys(S.sanitize(undefined).q).length === 0
    && Object.keys(S.sanitize('nonsense').q).length === 0
    && Object.keys(S.sanitize(42).q).length === 0
    ? ok('payload 整个不是对象时 → 空记录，不抛')
    : bad('非对象 payload 没兜住')
}

console.log('\n【自检】')
{
  //  判据得会红：把"次数取较大值"换成"相加"，第 2 条就该失败
  const a = rec({ attempts: 3, wrong: 2, lastAt: 100 })
  const b = rec({ attempts: 3, wrong: 2, lastAt: 100 })
  const naive = a.attempts + b.attempts
  naive !== S.mergeRecord(a, b).attempts
    ? ok(`自检：相加规则给出 ${naive} 次，与现在的 ${S.mergeRecord(a, b).attempts} 不同 —— 第 2 条判据有鉴别力`)
    : bad('自检失败：相加与取大在这个用例上结果相同，第 2 条判据说明不了问题')
}
{
  //  判据得会红：把"状态整组取更近"换成"逐字段取最大"，第 3 条就该失败
  const older = rec({ streak: 2, lastCorrect: true, lastAt: 100 })
  const newer = rec({ streak: 0, lastCorrect: false, lastAt: 200 })
  const perField = { streak: Math.max(older.streak, newer.streak), lastCorrect: older.lastCorrect || newer.lastCorrect }
  const real = S.mergeRecord(older, newer)
  perField.streak !== real.streak && perField.lastCorrect !== real.lastCorrect
    ? ok(`自检：逐字段取最大会造出 streak=${perField.streak} 且刚答对，而事实是刚答错 —— 第 3 条判据有鉴别力`)
    : bad('自检失败：逐字段取最大与整组取近在这个用例上结果相同')
}

{
  //  判据得会红：把平局规则换回第一版（固定取左边），交换律那条就该失败。
  //  这一条不是补充，是这套用例最重要的一条 —— 原来的随机样本跑 40 组全绿，
  //  而 bug 就在那 40 组从没碰到过的地方。
  const naive = (a: P.QRecord, b: P.QRecord) => (b.lastAt > a.lastAt ? b : a)
  let broke = 0
  for (let seed = 1; seed <= 40; seed++) {
    const a = sample(seed, 12), b = sample(seed + 500, 12)
    for (const k of Object.keys(a.q)) {
      if (!b.q[k]) continue
      if (JSON.stringify(naive(a.q[k], b.q[k])) !== JSON.stringify(naive(b.q[k], a.q[k]))) broke++
    }
  }
  broke > 0
    ? ok(`自检：旧的平局规则在这批样本上有 ${broke} 处不对称 —— 交换律那条判据现在真的会红`)
    : bad('自检失败：样本里一次平局都没撞上，交换律那条判据说明不了问题')
}

/* ═══ 别人的键要原样带回去 ═══
   云端那份 payload 是整个虾米课堂共用的:本模块的题目记录之外,两个游戏的进度
   也住在里面(`@games`)。本模块推的是**整份** payload —— 带漏了就等于把游戏
   进度删了,而且删得悄无声息。所以这三条都得钉住,最后一条是自检:
   旧写法(只推 store.q)必须在这批数据上真的判红。 */
{
  console.log('\n【别人的键要原样带回去】')
  const cloud = { 'p1#0': { attempts: 1, wrong: 0, streak: 1, lastCorrect: true, lastAt: 1 },
    '@games': { cards: { at: 9, data: { wins: 3 } }, world: { at: 8, data: { 0: { parts: 12 } } } } }
  const foreign = S.pickForeign(cloud)
  Object.keys(foreign).length === 1 && '@games' in foreign
    ? ok('只挑出 @ 开头的键(题目记录不算别人的)')
    : bad(`挑错了:${JSON.stringify(Object.keys(foreign))}`)

  const mine = { 'p1#0': { attempts: 2, wrong: 1, streak: 0, lastCorrect: false, lastAt: 5 } }
  const body = S.withForeign(mine as never, foreign)
  JSON.stringify((body as Record<string, unknown>)['@games']) === JSON.stringify(cloud['@games'])
    ? ok('推上去的整份里,游戏进度一个字节没动')
    : bad('游戏进度被改了或丢了')
  ;(body as Record<string, unknown>)['p1#0'] === mine['p1#0']
    ? ok('自己的记录以本地那份为准(不会被云端旧值盖回去)')
    : bad('自己的记录被云端盖了')

  //  自检:旧写法只推 store.q,这条判据必须能红
  const legacy = { ...mine } as Record<string, unknown>
  legacy['@games'] === undefined
    ? ok('自检:旧写法(只推自己的记录)在这批数据上确实丢了 @games —— 上面那条判据有鉴别力')
    : bad('自检失败:旧写法也没丢,说明这批数据证明不了什么')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
