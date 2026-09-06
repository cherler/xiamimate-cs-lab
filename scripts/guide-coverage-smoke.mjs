/**
 * 「看懂这一屏」覆盖率 —— **地面真相版**:在跑起来的应用里,把每条职业线的目录项
 * 一个一个点开,看 exphead 上到底有没有那个入口。
 *
 * 为什么还要这一份(tests/guide-coverage.test.ts 已经有一份静态的):
 * **静态解析看不见工厂函数生成的实验**。库层那 40 多个实验是 `mkLib(...)` 造出来的,
 * 源码里没有 `id: 'x'` 字面量 —— 静态判据整个漏掉了它们,还报出「51/51 全覆盖」的
 * 假绿灯。是浏览器抽查把这件事抓出来的。
 *
 * 教训写在这儿:**判据的解析口径和产品的真实数据源不是一回事时,判据可以全绿而事实是错的。**
 * 静态那份跑得快、进 npm test;这份慢(要点几百下)、按需跑,但它说的是实话。
 *
 * 跑法:先起 npm run web:lab(或任意 5178 的 dev),再 node scripts/guide-coverage-smoke.mjs
 */
import { chromium } from 'playwright'
const PORT = process.env.PORT || 5178
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)

const discs = await p.$$eval('.disctab', els => els.map(e => e.textContent.trim()))
console.log('\n— 「看懂这一屏」覆盖率 · 地面真相 —\n')
console.log(`  学科:${discs.join(' / ')}\n`)

let grandTotal = 0, grandLib = 0
for (const d of discs) {
  await p.evaluate(x => { [...document.querySelectorAll('.disctab')].find(e => e.textContent.trim() === x)?.click() }, d)
  await p.waitForTimeout(700)
  const n = await p.$$eval('.nav button', els => els.length)
  const missing = [], lib = []
  for (let i = 0; i < n; i++) {
    const name = await p.evaluate(i => { const l = document.querySelectorAll('.nav button'); if (!l[i]) return null; l[i].click(); return l[i].textContent.trim() }, i)
    if (!name) continue
    await p.waitForTimeout(180)
    const st = await p.evaluate(() => ({
      guide: [...document.querySelectorAll('button')].some(e => e.textContent.includes('看懂这一屏')),
      //  库层实验的舞台是一屏铺开的参考页(见 registry 的 mkLib),它本来就不配引导图
      isLib: !!document.querySelector('.libstage, [class*="lib"]') || /库层参考/.test(document.body.innerText),
    }))
    if (st.guide) continue
    ;(st.isLib ? lib : missing).push(name)
  }
  grandTotal += n; grandLib += lib.length
  ok(missing.length === 0,
    `「${d}」${n} 个实验:有引导图 ${n - missing.length - lib.length}、库层豁免 ${lib.length}、**缺 ${missing.length}**`
    + (missing.length ? ` → ${missing.slice(0, 6).join(' | ')}` : ''))
}

ok(grandLib > 0, `库层豁免确实生效(共 ${grandLib} 个)—— 一个都认不出来的话,说明豁免判断失灵了`)
ok(errs.length === 0, `全程无控制台报错${errs.length ? ':' + errs[0] : ''}`)
console.log(`\n  合计走过 ${grandTotal} 个目录项`)
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
