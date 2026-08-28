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

const N_RUN = Number(process.env.RUNS || 200)   // 完整 RUN 局数
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
  for (const k of ['base', 'sort', 'dc', 'memo', 'greedy']) {
    const r = __batchRun(k, n)
    const top = Object.entries(r.stuck).sort((a, b) => b[1] - a[1])[0]
    o[k] = { win: r.win, deck: r.avgDeck, top: top ? top[0] : null }
  }
  return o
}, N_RUN)
process.stdout.write('\r\x1b[K')

check('G1 base 不构筑必输', run.base.win, v => v === 0, '= 0%')
check('G1 排序流通关率', run.sort.win, v => v >= 18 && v <= 34, '18–34%')
check('G1 分治流通关率', run.dc.win, v => v >= 26 && v <= 40, '26–40%')
check('G1 预处理流通关率', run.memo.win, v => v >= 17 && v <= 32, '17–32%')
check('G1 贪心流通关率', run.greedy.win, v => v >= 16 && v <= 31, '16–31%')
const wins = ['sort', 'dc', 'memo', 'greedy'].map(k => run[k].win)
check('G1 四流派极差', +(Math.max(...wins) - Math.min(...wins)).toFixed(1), v => v <= 15, '≤ 15 点')

// 头号死因必须是它 designated 的克星
const NEMESIS = { sort: 'worst', dc: 'atomic', memo: 'explode2', greedy: 'regret' }
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
  Object.fromEntries(['sort', 'dc', 'memo', 'greedy'].map(k => [k, __batchFoe(k, 'shuffled', n).turn])), 200)
process.stdout.write('\r\x1b[K')
for (const [k, t] of Object.entries(turns))
  // v13 放宽 14→17:有序度换成严格口径后,排序流要花更多回合重建有序度。
// docs/test.md 写的判据本来就是「超过 20 说明打得太磨」,14 只是 v6 的实测值加余量。
check(`G4 ${k} 平均回合`, t, v => v >= 4 && v <= 17, '4–17 回合')

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

/* ── 控制台 ── */
check('全程无控制台报错', consoleErrors.length ? consoleErrors[0].slice(0, 60) : 0, v => v === 0, '0 条')

await browser.close()

/* ── 输出 ── */
const w = Math.max(...rows.map(r => [...r.name].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)))
const pad = s => s + ' '.repeat(Math.max(0, w - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)))
for (const r of rows)
  console.log(`  ${r.pass ? G + '✓' : R + '✗'}${X} ${pad(r.name)}  ${String(r.got).padStart(6)}  ${D}${r.expect}${X}`)

console.log(`\n${D}牌组终局大小 ${['sort','dc','memo','greedy'].map(k=>`${k} ${run[k].deck}`).join(' · ')}${X}`)
if (failed) {
  console.log(`\n${R}${B}${failed} 项不达标${X} —— 先量清楚再动数值,别脑补原因。`)
  process.exit(1)
}
console.log(`\n${G}${B}${rows.length} 项全部达标${X}`)
