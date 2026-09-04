import { chromium } from 'playwright'
const URL = 'http://localhost:5180/?craft'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(900)

const state = () => p.evaluate(() => window.__levelState)
const call = (fn, args = []) => p.evaluate(({ fn, args }) => window.__game.scene.getScene('WebLevel')[fn](...args), { fn, args })

ok(errs.length === 0, `无控制台报错${errs.length ? '：' + errs[0].slice(0, 140) : ''}`)
let s = await state()
ok(s && s.scene === 'WebLevel', '进入建树关卡')
ok(s.placed.length === 1 && s.placed[0] === 'goal' && !s.goalDone, '开局只有根节点(打开网页)、未通关')

// 拖错父:SYN 放到 目标 上 → wrong
ok((await call('dropNode', ['tcp.hs.syn', 'goal'])) === 'wrong', '把 SYN 放到目标上 → 拒绝(拖错父)')
// 父还没放,放不进去:SYN 放到 三次握手(尚未在画布) → noparent
ok((await call('dropNode', ['tcp.hs.syn', 'tcp.hs'])) === 'noparent', '父节点没放上,子块放不了')

// 放 5 个组件到 目标 上
for (const c of ['dns', 'ip', 'tcp', 'tls', 'http']) ok((await call('placeCorrect', [c])) === 'ok', `组件 ${c} 接上目标`)
s = await state(); ok(s.placed.length === 6 && !s.goalDone, '五组件接上、但整树未填 → 未通关')
await p.screenshot({ path: SHOT + '/build-comps.png' })

// 把 TCP 这一枝全部填满 → tcp 冒泡点亮
for (const id of ['tcp.port', 'tcp.hs', 'tcp.seq', 'tcp.win', 'tcp.port.src', 'tcp.port.dst', 'tcp.hs.syn', 'tcp.hs.synack', 'tcp.hs.ack']) await call('placeCorrect', [id])
s = await state()
ok(s.lit.includes('tcp.hs') && s.lit.includes('tcp.port'), '结构/素材的字段填满→它们冒泡点亮')
ok(s.lit.includes('tcp'), 'TCP整枝填满→TCP组件冒泡点亮')
ok(!s.goalDone, '只亮一枝、还没通关')
await p.screenshot({ path: SHOT + '/build-tcp.png' })

// 把剩下全建出来 → 通关
const all = await call('allIds')
for (let guard = 0; guard < 12; guard++) {
  s = await state(); const todo = all.filter(id => !s.placed.includes(id)); if (!todo.length) break
  let did = false
  for (const id of todo) { const par = await call('parentOf', [id]); if (s.placed.includes(par)) { await call('placeCorrect', [id]); did = true } }
  if (!did) break
}
s = await state()
ok(s.litLeaves === s.totalLeaves, `所有叶子点亮(${s.litLeaves}/${s.totalLeaves})`)
ok(s.goalDone, '整棵树建完并点亮→目标"打开网页"通关')
await p.waitForTimeout(400)
await p.screenshot({ path: SHOT + '/build-win.png' })

await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
