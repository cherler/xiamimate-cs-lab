/**
 * 第二台机器 · CPU 五级流水线 —— 六关冒烟判据。
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

const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text().slice(0, 160)) })
await p.goto(`http://localhost:${PORT}/cpu.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(400)

const hooks = await p.evaluate(() => ['__cpuPlay', '__cpuSet', '__cpuRun', '__cpuLevels'].filter(k => typeof window[k] !== 'function'))
if (hooks.length) { console.error('页面没暴露钩子:' + hooks.join(',') + ' —— 多半是拿到了别的文档'); await b.close(); process.exit(1) }

const FIVE = ['if', 'id', 'ex', 'mem', 'wb']
const N = null
const play = (i) => p.evaluate(i => window.__cpuPlay(i), i)
const go = (st, tp) => p.evaluate(({ st, tp }) => { window.__cpuSet(st, tp); return window.__cpuRun() }, { st, tp })

console.log('\n第二台机器 · CPU 五级流水线 · 六关\n')

/* ── L0 分成五级:顺序是仿真自己认的,不是我规定的 ── */
{
  const l = await play(0)
  ok(JSON.stringify(l.ref) === JSON.stringify([6, 3, 4, 5]), `L0 参考答案由顺序执行算出:${l.prog.join(' / ')} → [${l.ref}]`)
  const s = await go(FIVE, [N, N, N, N, N])
  ok(s.ok && s.cycles === 8 && s.parts === 5, `L0 五级摆对 → 4 条指令 4+4=8 拍(${s.cycles} 拍 ${s.parts} 件)`)
  const wbFirst = await go(['if', 'id', 'wb', 'ex', 'mem'], [N, N, N, N, N])
  ok(!wbFirst.ok, `L0 反例:写回摆到执行前面→写回去的是还没算出来的东西(regs=[${wbFirst.regs}] 应为 [${l.ref}])`)
  const exFirst = await go(['if', 'ex', 'id', 'mem', 'wb'], [N, N, N, N, N])
  ok(!exFirst.ok, `L0 反例:执行摆到译码前面→还没读到操作数就开算(regs=[${exFirst.regs}])`)
  const noWb = await go(['if', 'id', 'ex', 'mem', null], [N, N, N, N, N])
  ok(noWb === null, `L0 反例:缺〈写回〉→ 机器根本不成立,拒绝运行`)
  const swapMem = await go(['if', 'id', 'ex', 'wb', 'mem'], [N, N, N, N, N])
  ok(swapMem.ok, `L0 这一关没有访存指令,所以〈访存〉挪到最后也照样对 —— 仿真诚实地不管它(第 3 关就管了)`)
}

/* ── L1 数据冒险(隔一条):只有一个位置抽得到 ── */
{
  const l = await play(1)
  ok(JSON.stringify(l.ref) === JSON.stringify([0, 3, 6, 9]), `L1 参考:${l.prog.join(' / ')} → [${l.ref}]`)
  const good = await go(FIVE, [N, N, N, 'wire', N])
  ok(good.ok && good.cycles === 7, `L1 旁路接在〈访存〉级上方 → 对,且一拍没多花(${good.cycles} 拍)`)
  const bare = await go(FIVE, [N, N, N, N, N])
  ok(!bare.ok && bare.regs[2] === 0, `L1 反例:不接旁路→译码读到的 r1 还是 0,算出 r2=0(regs=[${bare.regs}])`)
  const wrongSpot = await go(FIVE, [N, N, N, N, 'wire'])
  ok(!wrongSpot.ok, `L1 反例:旁路接在〈写回〉级上方→那一级此刻站着的不是它要的那条,抽了个空(regs=[${wrongSpot.regs}])`)
  const beforeEx = await go(FIVE, ['wire', 'wire', 'wire', N, N])
  ok(!beforeEx.ok, `L1 反例:线全接在执行级之前→那几级的结果还没出炉,等于没接(regs=[${beforeEx.regs}])`)
}

/* ── L2 数据冒险(隔两条):真 CPU 的前递通路本来就有两条 ── */
{
  const l = await play(2)
  ok(JSON.stringify(l.ref) === JSON.stringify([0, 11, 4, 7]), `L2 参考:${l.prog.join(' / ')} → [${l.ref}]`)
  const good = await go(FIVE, [N, N, N, 'wire', 'wire'])
  ok(good.ok && good.stalls === 0 && good.cycles === 8, `L2 两条通路都接 → 对、一拍没停(${good.cycles} 拍 ${good.parts} 件)`)
  const only1 = await go(FIVE, [N, N, N, 'wire', N])
  ok(!only1.ok, `L2 反例:少了「隔两条」那根→r1 读到旧值(regs=[${only1.regs}] 应为 [${l.ref}])`)
  const only2 = await go(FIVE, [N, N, N, N, 'wire'])
  ok(!only2.ok, `L2 反例:少了「隔一条」那根→r3 读到旧值(regs=[${only2.regs}])`)
}

/* ── L3 load-use:真 CPU 里唯一躲不掉的停顿 ── */
{
  const l = await play(3)
  ok(JSON.stringify(l.ref) === JSON.stringify([0, 5, 10, 1]), `L3 参考(lw 从存储器 [2] 取 5):${l.prog.join(' / ')} → [${l.ref}]`)
  const wiresOnly = await go(FIVE, [N, N, N, 'wire', 'wire'])
  ok(!wiresOnly.ok, `L3 关键反例:**两条旁路都接上也救不了** —— lw 的数据要到访存末尾才出来(regs=[${wiresOnly.regs}] 应为 [${l.ref}])`)
  const good = await go(FIVE, [N, 'hazard', N, 'wire', 'wire'])
  ok(good.ok && good.stalls === 1, `L3 加一个〈冒险检测〉→ 对,而且只停了 ${good.stalls} 拍(${good.cycles} 拍)`)
  const stallOnly = await go(FIVE, [N, 'hazard', N, N, N])
  ok(stallOnly.ok && stallOnly.stalls > good.stalls,
    `L3 只停顿不接线也能对,但慢:停 ${stallOnly.stalls} 拍、共 ${stallOnly.cycles} 拍(接线那条路只要 ${good.cycles} 拍)`)
  const memLast = await go(['if', 'id', 'ex', 'wb', 'mem'], [N, 'hazard', N, 'wire', 'wire'])
  ok(!memLast.ok, `L3 反例:把〈访存〉挪到〈写回〉后面→数据还没取出来就写回去了(regs=[${memLast.regs}])`)
}

/* ── L4 控制冒险:分支到执行级才判得出跳不跳,后面两条早进来了 ── */
{
  const l = await play(4)
  ok(JSON.stringify(l.ref) === JSON.stringify([9, 1, 2, 8]), `L4 参考(带分支,按 PC 走一遍):${l.prog.join(' / ')} → [${l.ref}]`)
  const good = await go(FIVE, [N, 'hazard', 'flush', 'wire', 'wire'])
  ok(good.ok, `L4 装上〈分支作废〉→ 跳走后那条没被执行(regs=[${good.regs}])`)
  ok(good.regs[3] === 8 && good.regs[0] === 9,
    `L4 不跳的那条分支不该误伤:它后面那三条(含落在作废阴影之外的 add r3,r3,r1)全跑了(r3=${good.regs[3]})`)
  const noFlush = await go(FIVE, [N, 'hazard', N, 'wire', 'wire'])
  ok(!noFlush.ok && noFlush.regs[3] === 16,
    `L4 反例:没有作废→走错路那条 add r3,r3,r3 真的把 r3 翻了倍(regs=[${noFlush.regs}] 应为 [${l.ref}])`)
  const wrongSpot = await go(FIVE, [N, 'hazard', N, 'flush', 'wire'])
  ok(!wrongSpot.ok,
    `L4 反例:作废装在〈访存〉上方→分支不在那一级判,等于没装(regs=[${wrongSpot.regs}])`)
  ok(good.cycles <= l.par.cycles, `L4 拍数达标:${good.cycles} ≤ 目标 ${l.par.cycles}`)
}

/* ── L5 终关:数据冒险 + load-use + 控制冒险,三种全在一段里 ── */
{
  const l = await play(5)
  ok(JSON.stringify(l.ref) === JSON.stringify([0, 23, 37, 14]), `L5 参考:${l.prog.join(' / ')} → [${l.ref}]`)
  const good = await go(FIVE, [N, 'hazard', 'flush', 'wire', 'wire'])
  ok(good.ok, `L5 终关 旁路×2 + 冒险检测 + 分支作废 → 跑对(regs=[${good.regs}])`)
  ok(good.cycles <= l.par.cycles, `L5 拍数达标:${good.cycles} 拍 ≤ 目标 ${l.par.cycles} 拍(停顿 ${good.stalls} 拍)`)
  ok(good.parts <= l.par.parts, `L5 件数达标:${good.parts} 件 ≤ 目标 ${l.par.parts} 件`)
  const noFlush = await go(FIVE, [N, 'hazard', N, 'wire', 'wire'])
  ok(!noFlush.ok && noFlush.regs[1] === 999, `L5 反例:缺分支作废→走错路那条把 r1 写成了 999(regs=[${noFlush.regs}])`)
  const noHazard = await go(FIVE, [N, N, 'flush', 'wire', 'wire'])
  ok(!noHazard.ok, `L5 反例:缺冒险检测→load-use 那处读到旧值(regs=[${noHazard.regs}])`)
  const noWire = await go(FIVE, [N, 'hazard', 'flush', N, N])
  ok(noWire.ok && noWire.cycles > good.cycles, `L5 反例(慢解):只停顿不接线→还是对的,但从 ${good.cycles} 拍涨到 ${noWire.cycles} 拍`)
}

ok(errs.length === 0, `全程无控制台报错${errs.length ? ':' + errs[0] : ''}`)
await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
