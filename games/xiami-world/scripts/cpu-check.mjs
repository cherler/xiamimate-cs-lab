/**
 * CPU 五级流水线(灰盒竖切)冒烟判据。
 *
 * 这台机器要证明的是「仿真是真的」,所以判据全部围绕一件事:
 * **参考答案不是写死的,是同一段程序顺序执行一遍算出来的**;你搭的流水线跑出来必须和它一致。
 * 老规矩:每条正向判据都配一条能判红的反例 —— 拆掉哪根旁路,就该错在哪个寄存器上。
 * 跑法:先起 dev(npx vite --port 5183 --host 127.0.0.1),再 PORT=5183 node scripts/cpu-check.mjs
 */
import { chromium } from 'playwright'
const PORT = process.env.PORT || 5183
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }

const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 880 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text().slice(0, 160)) })
await p.goto(`http://localhost:${PORT}/cpu.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(400)

const hooks = await p.evaluate(() => ['__cpuSet', '__cpuRun', '__cpuRef', '__cpuProg'].filter(k => typeof window[k] !== 'function'))
if (hooks.length) { console.error('页面没暴露钩子:' + hooks.join(',') + ' —— 多半是拿到了别的文档'); await b.close(); process.exit(1) }

const FIVE = ['if', 'id', 'ex', 'mem', 'wb']
const go = (st, tp) => p.evaluate(({ st, tp }) => { window.__cpuSet(st, tp); return window.__cpuRun() }, { st, tp })
const N = null

console.log('\n第二台机器 · CPU 五级流水线(灰盒竖切)\n')

const ref = await p.evaluate(() => window.__cpuRef())
const prog = await p.evaluate(() => window.__cpuProg())
ok(JSON.stringify(ref) === JSON.stringify([0, 11, 4, 7]),
  `参考答案由顺序执行算出:${prog.join(' / ')} → [${ref}]`)

/* ── 正解一:两条旁路都接上(不多花一拍)── */
{
  const s = await go(FIVE, [N, N, N, 'wire', 'wire'])
  ok(s.ok && s.stalls === 0, `两条旁路都接 → 结果对且一拍没停(regs=[${s.regs}], ${s.cycles} 拍, ${s.parts} 件)`)
  ok(s.cycles === 8, `4 条指令灌满五级 = 4+4 = 8 拍(实测 ${s.cycles})`)
}

/* ── 反例:拆掉任意一条旁路,就该错在特定的寄存器上 ── */
{
  const noMem = await go(FIVE, [N, N, N, N, 'wire'])
  ok(!noMem.ok, `反例:少了「访存级」那条旁路→隔 1 条的依赖读到旧值(regs=[${noMem.regs}] 应为 [${ref}])`)
  const noWb = await go(FIVE, [N, N, N, 'wire', N])
  ok(!noWb.ok, `反例:少了「写回级」那条旁路→隔 2 条的依赖读到旧值(regs=[${noWb.regs}])`)
  const bare = await go(FIVE, [N, N, N, N, N])
  ok(!bare.ok && bare.regs[3] === 0, `反例:一条旁路都不接→r3 读到两个 0、算出 0(regs=[${bare.regs}])`)
}

/* ── 正解二:不接线,改放冒险检测 —— 也对,但要多花拍数(这就是那道设计题)── */
{
  const st = await go(FIVE, [N, 'hazard', N, N, N])
  ok(st.ok, `只放冒险检测(不接线)→ 结果一样对(regs=[${st.regs}])`)
  ok(st.stalls > 0 && st.cycles > 8, `代价是停顿:停了 ${st.stalls} 拍、共 ${st.cycles} 拍(旁路那条路只要 8 拍)`)
  const mix = await go(FIVE, [N, 'hazard', N, 'wire', N])
  ok(mix.ok && mix.stalls < st.stalls, `检测 + 一条旁路 → 也对,停顿从 ${st.stalls} 拍降到 ${mix.stalls} 拍(接一条少停一点)`)
}

/* ── 反例:五级摆错顺序 / 缺件,机器就不成立 ── */
{
  const swapped = await go(['if', 'id', 'mem', 'ex', 'wb'], [N, N, N, N, 'wire'])
  ok(!swapped.ok, `反例:执行和访存对调→算的时机全乱(regs=[${swapped.regs}])`)
  const noWb = await go(['if', 'id', 'ex', 'mem', null], [N, N, N, 'wire', 'wire'])
  ok(noWb === null, `反例:缺〈写回〉→ 机器根本不成立,拒绝运行`)
  const lateEx = await go(['if', 'ex', 'id', 'mem', 'wb'], [N, N, N, 'wire', 'wire'])
  ok(!lateEx.ok, `反例:执行摆在译码前面→还没读寄存器就先算(regs=[${lateEx.regs}])`)
}

/* ── 旁路接错地方:接在执行级之前 = 那一级还没算出东西,等于没接 ── */
{
  const early = await go(FIVE, ['wire', 'wire', 'wire', N, N])
  ok(!early.ok, `反例:三条线全接在执行级之前→那几级还没算出结果,等于没接(regs=[${early.regs}])`)
}

ok(errs.length === 0, `全程无控制台报错${errs.length ? ':' + errs[0] : ''}`)
await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
