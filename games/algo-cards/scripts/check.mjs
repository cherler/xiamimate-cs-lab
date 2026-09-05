/* 回归检查 —— docs/test.md 的 G 段,全自动跑一遍
 *   npm run check
 * 任何一条不达标 → 退出码 1。达标线跟着 docs/test.md 走,改一处必须同时改另一处。
 */
import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PAGE = pathToFileURL(join(ROOT, 'index.html')).href

// 200 局时通关率的抽样噪声能到 ±6 点(实测 sort:n=200 报 14%、n=600/1000 都是 ~20.7%),
// 足以让一条贴边的流派假红一次 —— 而假红比不测更糟(它教你忽略判据)。
// 500 局把噪声压下去,代价只是 8.3s → 11.4s。
const N_RUN = Number(process.env.RUNS || 500)   // 完整 RUN 局数
const N_FOE = Number(process.env.FIGHTS || 250) // 单场局数

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m', B = '\x1b[1m'
const rows = []
let failed = 0

function check(name, got, ok, expect) {
  const pass = ok(got)
  if (!pass) failed++
  rows.push({ name, got, expect, pass })
  return pass
}

const browser = await chromium.launch()
const page = await browser.newPage()
const consoleErrors = []
page.on('pageerror', e => consoleErrors.push(String(e)))
page.on('console', m => m.type() === 'error' && consoleErrors.push(m.text()))

await page.goto(PAGE)
await page.waitForTimeout(700)

const missing = await page.evaluate(() =>
  ['__batchRun', '__batchFoe', '__fight', '__KITS', '__SHAPE'].filter(k => typeof window[k] === 'undefined'))
if (missing.length) {
  console.error(`${R}页面没暴露这些钩子:${missing.join(', ')} —— index.html 结构变了?${X}`)
  await browser.close(); process.exit(1)
}

console.log(`${B}算法卡牌 · 回归检查${X}  ${D}${N_RUN} 局/流派 · ${N_FOE} 局/对战${X}\n`)

/* ── G1 完整通关率 ── */
process.stdout.write(`${D}G1 完整通关率…${X}`)
const run = await page.evaluate(n => {
  const o = {}
  for (const k of ['base', 'sort', 'dc', 'memo', 'greedy', 'heap', 'twop', 'bit', 'rand']) {
    const r = __batchRun(k, n)
    const top = Object.entries(r.stuck).sort((a, b) => b[1] - a[1])[0]
    o[k] = { win: r.win, deck: r.avgDeck, top: top ? top[0] : null }
  }
  return o
}, N_RUN)
process.stdout.write('\r\x1b[K')

// v14 起放宽 =0 → ≤2%:奖励池从 26 张扩到 38 张之后,base 有极小概率
// 靠七次三选一凑出一套能打的牌。那不是 bug —— 那正说明选牌本身有价值。
check('G1 不构筑几乎必输', run.base.win, v => v <= 2, '≤ 2%')
// v14 起六条流派共用一条带:15–35%。逐条各设一段窄带只会在每次改动后
// 逼我去改带子而不是改设计 —— 真正的判据是「都能玩、且没有一条独大」。
const KITS6 = [['sort','排序流'],['dc','分治流'],['memo','预处理流'],['bit','位运算流'],['rand','随机化流'],
               ['greedy','贪心流'],['heap','堆流'],['twop','区间流']]
for (const [k, nm] of KITS6) check(`G1 ${nm}通关率`, run[k].win, v => v >= 15 && v <= 35, '15–35%')
const wins = KITS6.map(([k]) => run[k].win)
check('G1 七流派极差', +(Math.max(...wins) - Math.min(...wins)).toFixed(1), v => v <= 15, '≤ 15 点')

// 头号死因必须是它 designated 的克星
const NEMESIS = { sort: 'worst', dc: 'atomic', memo: 'explode2', greedy: 'regret' }   // 新两条流派还没有 designated 克星
for (const [kit, foe] of Object.entries(NEMESIS))
  check(`G1 ${kit} 头号死因`, run[kit].top, v => v === foe, foe)

/* ── G2 克制矩阵 ── */
process.stdout.write(`${D}G2 克制矩阵…${X}`)
const mat = await page.evaluate(n => {
  const pairs = [['sort', 'worst'], ['dc', 'atomic'], ['memo', 'explode2'], ['greedy', 'regret'],
                 ['dc', 'worst'], ['memo', 'worst'], ['sort', 'atomic'], ['sort', 'explode2'],
                 ['sort', 'collide'], ['dc', 'collide'], ['memo', 'collide'], ['greedy', 'collide']]
  const o = {}
  for (const [k, f] of pairs) o[k + '/' + f] = __batchFoe(k, f, n).win
  return o
}, N_FOE)
process.stdout.write('\r\x1b[K')

check('G2 排序 vs 最坏用例', mat['sort/worst'], v => v <= 45, '≤ 45%')
check('G2 分治 vs 不可分问题', mat['dc/atomic'], v => v <= 25, '≤ 25%')
check('G2 预处理 vs 状态爆炸', mat['memo/explode2'], v => v <= 45, '≤ 45%')
check('G2 贪心 vs 反悔陷阱', mat['greedy/regret'], v => v <= 55, '≤ 55%')
for (const p of ['dc/worst', 'memo/worst', 'sort/atomic', 'sort/explode2'])
  check(`G2 误伤 ${p}`, mat[p], v => v >= 85, '≥ 85%')
const col = ['sort', 'dc', 'memo', 'greedy'].map(k => mat[k + '/collide'])
// v13 放宽 20→30:数据形状引入了真实的非对称 —— 哈希碰撞丢手牌,
// 而排序流依赖「先排序再查找」的出牌顺序,被打断的代价天生比别人大。
// 实测 63/81/91/88,极差 28。再压下去只能靠取消形状差异。
check('G2 哈希碰撞均匀度', Math.max(...col) - Math.min(...col), v => v <= 30, '极差 ≤ 30 点')

/* ── G3 Boss 的教学点 ── */
process.stdout.write(`${D}G3 Boss…${X}`)
const boss = await page.evaluate(n => {
  const base = ['scan', 'scan', 'scan', 'scan', 'scan', 'batch', 'batch', 'batch', 'batch', 'watch']
  const rate = deck => {
    let w = 0
    for (let s = 1; s <= n; s++) if (__fight('dc', s * 7919, 'expo', deck, 60, 45, null, 7).over === 'win') w++
    return +(w / n * 100).toFixed(0)
  }
  return { bare: rate([...__KITS.dc, ...base]), pruned: rate([...__KITS.dc, 'prune', 'prune', ...base]) }
}, N_FOE)
process.stdout.write('\r\x1b[K')

check('G3 无剪枝打 Boss', boss.bare, v => v <= 5, '≤ 5%')
check('G3 带 2 张剪枝', boss.pruned, v => v >= 75, '≥ 75%')

/* ── G4 战斗时长 ── */
process.stdout.write(`${D}G4 时长…${X}`)
const turns = await page.evaluate(n =>
  Object.fromEntries(['sort','dc','memo','greedy','heap','twop','bit','rand'].map(k => [k, __batchFoe(k, 'shuffled', n).turn])), 200)
process.stdout.write('\r\x1b[K')
// 堆流单独一条带。它的伤害只有一个来源(每回合弹掉最矮的 N 根),
// 所以「速度」和「强度」共用一个旋钮 —— 实测 heapsort 多弹 1 根就把通关率
// 从 19.5% 推到 39%。慢速稳推是这条流派的身份,不是缺陷。
// 20 回合是 docs/test.md 一直写着的「太磨」线。
for (const [k, t] of Object.entries(turns))
  check(`G4 ${k} 平均回合`, t, v => v >= 4 && v <= (k === 'heap' ? 20 : 17),
        k === 'heap' ? '4–20(慢速流派)' : '4–17 回合')

/* ── G5 渲染健壮性:每张卡 × 每种极端局面都得画得出来 ── */
process.stdout.write(`${D}G5 渲染…${X}`)
const render = await page.evaluate(() => {
  const bad = []
  const uniq = window.__ALLCARDS()   // 全部卡,不写死 —— 加了新卡也自动进检查
  // 极端局面:元素清零(刚打赢)/ 预处理值 0 / 段数 1 / 债务 0 / 手牌爆满
  const cases = [
    ['元素清零', S => S.bars.forEach(b => b.dead = true)],
    ['全新开局', () => {}],
    ['预算见底', S => { S.budget = 0 }],
    ['段数满格', S => { S.splits = 4 }],
    ['债务很高', S => { S.debt = 9 }],
  ]
  for (const [label, setup] of cases)
    for (const id of uniq) {
      try {
        __demo('tape', null, 'sort')
        const S = __S(); setup(S); S.hand = [id]; S.steps = 3
        __draw()
      } catch (err) { bad.push(`${label}/${id}: ${err.message}`) }
    }
  return bad
})
process.stdout.write('\r\x1b[K')
check('G5 每张卡 × 5 种极端局面能渲染', render.length ? render[0].slice(0, 46) : 0, v => v === 0, '0 处崩溃')

/* ── G6 重构(除牌):删一张 = 牌组 −1;代价 3→6→9 越删越贵;会自限不删空 ── */
const ref = await page.evaluate(() => {
  __startRun('sort'); const R = __RUN()
  const d0 = R.deck.length, c0 = R.cap, cost1 = __refactorCost()
  __doRemove(0); const d1 = R.deck.length, c1 = R.cap, cost2 = __refactorCost()
  __doRemove(0); const cost3 = __refactorCost()
  let g = 0; while (__canRefactor() && g++ < 60) __doRemove(0)
  return { dDrop: d0 - d1, cDrop: c0 - c1, cost1, cost2, cost3, deckMin: R.deck.length, canAfter: __canRefactor() }
})
check('G6 重构删一张 = 牌组 −1', ref.dDrop, v => v === 1, '= 1')
check('G6 重构代价升级', `${ref.cost1},${ref.cost2},${ref.cost3}`, v => v === '3,6,9', '3,6,9')
check('G6 首删 −3 上限', ref.cDrop, v => v === 3, '= 3')
check('G6 重构自限不删空', ref.canAfter === false && ref.deckMin >= 6 ? 'OK' : `FAIL(${ref.canAfter},${ref.deckMin})`, v => v === 'OK', 'canRef→false 且 ≥6 张')

/* ── G7 双流派:选两条流派 = 两校牌拼进同一副;6 个核心搭配各是一个真实算法名 ── */
const dual = await page.evaluate(() => ({
  dualDeck: __newRun2(1, 'sort', 'dc').deck.length,
  single: __newRun2(1, 'sort').deck.length,
  kit2: __newRun2(1, 'sort', 'dc').kit2,
  kit2single: __newRun2(1, 'sort').kit2,
  combos: [__comboName('sort','dc'), __comboName('sort','memo'), __comboName('dc','memo'),
           __comboName('memo','greedy'), __comboName('sort','greedy'), __comboName('dc','greedy')].join('/')
}))
check('G7 双流派牌组 = 单流派 + 6 张', dual.dualDeck - dual.single, v => v === 6, '= 6')
check('G7 双流派记住第二流派', `${dual.kit2},${dual.kit2single}`, v => v === 'dc,null', 'dc / 单流派 null')
check('G7 六个核心搭配算法名', dual.combos, v => v === '归并排序/索引/记忆化递归/启发式剪枝搜索/区间调度/随机化快排', '六对各是真算法')

/* ── G8 复盘 par:「你 N 回合 · 最优 M 回合」由引擎当场跑六条流派算出,不是硬编码 ── */
const par = await page.evaluate(() => {
  const out = []
  for (const [a, b2] of [['sort','dc'], ['memo','greedy'], ['heap','twop']]) {
    __startRun(a, b2); __pickNode(0)
    const S = __S()
    for (let i = 0; i < 400 && !S.over; i++) { const j = __POL2(S); if (j < 0) __endTurn2(S); else __play2(S, j) }
    const p = __parOf()
    out.push({ over: S.over, mine: S.turn, par: p ? p.turns : null, kit: p ? p.kit : null })
  }
  // 同一局面重复算两次必须一样(确定性,不是随机猜)
  __startRun('sort','dc'); __pickNode(0)
  const a1 = __parOf(), a2 = __parOf()
  return { out, stable: a1 && a2 ? (a1.turns === a2.turns && a1.kit === a2.kit) : null }
})
const parsGot = par.out.filter(o => o.par != null).length
check('G8 复盘 par 每仗都算得出', parsGot, v => v === 3, '3 / 3 仗')
check('G8 par 是正整数回合', par.out.every(o => o.par == null || (o.par > 0 && Number.isInteger(o.par))) ? 'OK' : 'FAIL', v => v === 'OK', '> 0 的整数')
check('G8 par 确定性(同局面两次一致)', par.stable === true ? 'OK' : `FAIL(${par.stable})`, v => v === 'OK', '两次一致')

/* ── G9 起手抉择:三种投资各自生效、都要付上限、且真的有区分度(不是三个一样的按钮)── */
process.stdout.write(`${D}G9 起手抉择…${X}`)
const boon = await page.evaluate(() => {
  const eff = {}
  for (const id of ['index', 'split', 'lean']) {
    __startRun('sort', 'dc')
    const cap0 = __RUN().cap, deck0 = __RUN().deck.length
    __takeBoon(id)
    const R = __RUN(), S = __S()
    eff[id] = { capDrop: cap0 - R.cap, deckDrop: deck0 - R.deck.length, memo: S.memo, splits: S.splits }
  }
  // 区分度:同一批种子下,dc 用「先切好段」该比用「先建索引」快;memo 反过来。
  const avg = (k, b2) => {
    let t = 0, w = 0
    for (const f of ['shuffled', 'tape', 'dupes', 'stream', 'graph'])
      for (let s = 1; s <= 30; s++) {
        const r = __fight(k, s * 7919, f, null, __T.BUDGET - 5, 45, null, 0, b2)
        if (r.over === 'win') { w++; t += r.turn }
      }
    return w ? t / w : null
  }
  return { eff, dcSplit: avg('dc', 'split'), dcIndex: avg('dc', 'index'), memoIndex: avg('memo', 'index'), memoSplit: avg('memo', 'split') }
})
process.stdout.write('\r')
check('G9 先建索引 = 预处理值 +14', boon.eff.index.memo, v => v === 14, '= 14')
check('G9 先切好段 = 段数 +1', boon.eff.split.splits, v => v === 2, '= 2(1+1)')
check('G9 轻装上阵 = 牌组 −2', boon.eff.lean.deckDrop, v => v === 2, '= 2 张')
check('G9 三种都付 5 点上限', [boon.eff.index.capDrop, boon.eff.split.capDrop, boon.eff.lean.capDrop].join(','), v => v === '5,5,5', '5,5,5')
check('G9 分治更吃「先切好段」', +(boon.dcIndex - boon.dcSplit).toFixed(1), v => v > 0, '> 0 回合(切段更快)')
check('G9 预处理更吃「先建索引」', +(boon.memoSplit - boon.memoIndex).toFixed(1), v => v > 0, '> 0 回合(建索引更快)')

/* ── G10 位运算流的身份:它必须**因形状而强弱**,而不是无脑通用 ── */
process.stdout.write(`${D}G10 形状身份…${X}`)
const shape = await page.evaluate(() => {
  const avg = (k, sh) => {
    __FOE['_s_' + sh] = { n: 40, shape: sh, inflow: 1, shuffle: 0, name: '测试', note: '', kind: '小怪' }
    let t = 0, w = 0
    for (let s = 1; s <= 60; s++) { const r = __fight(k, s * 7919, '_s_' + sh, null, __T.BUDGET, 45, null, 0, null); if (r.over === 'win') { w++; t += r.turn } }
    return w ? +(t / w).toFixed(1) : null
  }
  return { heavy: avg('bit', 'heavy'), sparse: avg('bit', 'sparse'), nearly: avg('bit', 'nearly'),
           heavySort: avg('sort', 'heavy'), nearlySort: avg('sort', 'nearly') }
})
process.stdout.write('\r\x1b[K')
check('G10 位运算吃重复值扎堆', +(shape.nearly - shape.heavy).toFixed(1), v => v >= 2, '比几乎有序快 ≥2 回合')
check('G10 重复扎堆上位运算快过排序', +(shape.heavySort - shape.heavy).toFixed(1), v => v > 0, '> 0 回合')

/* ── G11 随机化流的身份:随机主元把「照着你构造的输入」打回平均用例 ── */
process.stdout.write(`${D}G11 随机化…${X}`)
const rnd = await page.evaluate(() => {
  // ① 机制直测:对抗性输入下,出掉随机主元后排序惩罚必须失效
  __demo('crafted', null, 'rand')
  const S = __S(); const before = __antiOf(S)
  S.hand = ['rpivot']; S.steps = 3; __play2(S, 0)
  const after = __antiOf(S)
  // ② 结果直测:同为随机化流、同一批种子,带随机主元 vs 换成蒙特卡洛
  const base = ['scan','scan','scan','batch','batch','batch','cache','prefetch','memoize','sortdeck']
  // 用排序流打「最坏用例」精英(排序惩罚在这最疼):带随机主元 vs 换成一张冒泡
  const rate = deck => { let w = 0
    for (let s = 1; s <= 200; s++) if (__fight('sort', s * 7919, 'worst', deck, __T.BUDGET, 45, null, 0).over === 'win') w++
    return +(w / 200 * 100).toFixed(1) }
  const withP = rate([...__KITS.sort, 'rpivot', ...base])
  const without = rate([...__KITS.sort, 'bubble', ...base])
  return { before, after, withP, without, gain: +(withP - without).toFixed(1) }
})
process.stdout.write('\r\x1b[K')
check('G11 随机主元解除排序惩罚', `${rnd.before}→${rnd.after}`, v => v === 'true→false', 'true→false')
check('G11 随机主元克对抗性输入', rnd.gain, v => v > 0, '带随机主元胜率更高')

/* ── G12 精英预告:预告必须**说到做到**(说了第 3 关是谁,到了就得是谁)── */
const warn = await page.evaluate(() => {
  let same = 0, tot = 0, hasWarnAt0 = 0
  for (let s = 1; s <= 40; s++) {
    __startRun('sort'); const R = __RUN()
    if (__nextElite() && __nextElite().node === 2) hasWarnAt0++
    const promised = R.elites
    // 直接问引擎:第 3 关 / 第 6 关实际会摇出谁
    const a2 = __rollNode(R, 2)[0].foe, a5 = __rollNode(R, 5)[0].foe
    tot += 2; if (a2 === promised[0]) same++; if (a5 === promised[1]) same++
  }
  return { same, tot, hasWarnAt0, elitesDistinct: __RUN().elites[0] !== __RUN().elites[1] }
})
check('G12 精英预告说到做到', `${warn.same}/${warn.tot}`, v => v === '80/80', '预告=实际')
check('G12 第 1 关就能看到预告', warn.hasWarnAt0, v => v === 40, '40/40 局')
check('G12 两个精英不重样', warn.elitesDistinct ? 'OK' : 'FAIL', v => v === 'OK', '不同的两个')

/* ── G13 结构区 + 内存:空间换时间这条轴必须真的**咬得住**,又不能误伤专注构筑 ── */
process.stdout.write(`${D}G13 结构区…${X}`)
const mem = await page.evaluate(() => {
  // ① 建造类卡 → 登记成结构、占内存;同名只占一份
  __demo('shuffled', null, 'memo')
  const S = __S(); S.hand = ['pre', 'table', 'buildheap', 'prefix', 'pre']; S.steps = 99
  const play = id => { const i = S.hand.indexOf(id); const can = __canPlay(S, i); if (can) __play2(S, i); return can }
  const p1 = play('pre'), p2 = play('table'), p3 = play('buildheap')     // 2+3+3 = 8 = 满
  const blocked = !play('prefix')                                        // 第四个该被内存挡住
  const used = (S.structs || []).reduce((a, x) => a + x.mem, 0)
  const names = (S.structs || []).map(x => x.id).join(',')
  // ② 单流派专注构筑不该被卡住;③ 双流派堆结构会顶到上限(取舍成立)
  const peak = (k1, k2) => {
    const deck = k2 ? __newRun2(1, k1, k2).deck : null
    let mx = 0
    for (let s = 1; s <= 60; s++) {
      const St = deck ? __newFightD(k1, 'shuffled', s * 7919, deck, __T.BUDGET, null, 3)
                      : __newFightX(k1, 'shuffled', s * 7919, 3)
      const P = __POL(k1)
      while (!St.over && St.turn <= 45) { let g = 0
        while (!St.over && g++ < 14) { const i = P(St); if (i < 0) break; if (!__play2(St, i)) break }
        if (!St.over) __endTurn2(St) }
      mx = Math.max(mx, (St.structs || []).reduce((a, x) => a + x.mem, 0))
    }
    return mx
  }
  return { p1, p2, p3, blocked, used, names, soloMemo: peak('memo'), soloTwop: peak('twop'), dual: peak('memo', 'twop') }
})
process.stdout.write('\r\x1b[K')
check('G13 建造类卡进结构区', mem.names, v => v === 'pre,table,buildheap', 'pre,table,buildheap')
check('G13 结构占内存', mem.used, v => v === 8, '2+3+3 = 8')
check('G13 内存满了建不了', mem.blocked ? 'OK' : 'FAIL', v => v === 'OK', '第四个被挡住')
check('G13 单流派专注构筑不被卡', Math.max(mem.soloMemo, mem.soloTwop), v => v < 8, '< 上限 8')
check('G13 双流派会顶到上限(取舍成立)', mem.dual, v => v === 8, '= 8')

/* ── 控制台 ── */
check('全程无控制台报错', consoleErrors.length ? consoleErrors[0].slice(0, 60) : 0, v => v === 0, '0 条')

await browser.close()

/* ── 输出 ── */
const w = Math.max(...rows.map(r => [...r.name].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)))
const pad = s => s + ' '.repeat(Math.max(0, w - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)))
for (const r of rows)
  console.log(`  ${r.pass ? G + '✓' : R + '✗'}${X} ${pad(r.name)}  ${String(r.got).padStart(6)}  ${D}${r.expect}${X}`)

console.log(`\n${D}牌组终局大小 ${['sort','dc','memo','greedy','heap','twop','bit','rand'].map(k=>`${k} ${run[k].deck}`).join(' · ')}${X}`)
if (failed) {
  console.log(`\n${R}${B}${failed} 项不达标${X} —— 先量清楚再动数值,别脑补原因。`)
  process.exit(1)
}
console.log(`\n${G}${B}${rows.length} 项全部达标${X}`)
