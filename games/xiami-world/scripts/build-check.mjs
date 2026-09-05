/**
 * 「搭机器」冒烟判据 —— 八关全是**真地址关**(包上印二进制,零抽象形状)。
 *
 * 纪律:每条判据都要**能判红**。所以凡是有"正确做法"的关,都配一条反例:
 * 把关键那一步做错,必须真的不通过 —— 否则这条判据证明不了任何东西。
 * 跑法:先起 dev(npx vite --port 5183 --host 127.0.0.1),再 PORT=5183 node scripts/build-check.mjs
 */
import { chromium } from 'playwright'
const PORT = process.env.PORT || 5183
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }

const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text().slice(0, 160)) })
await p.goto(`http://localhost:${PORT}/build.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(400)

const hooks = await p.evaluate(() => ['__place', '__run', '__stepN', '__state', '__play', '__menu', '__storyOk'].filter(k => typeof window[k] !== 'function'))
if (hooks.length) { console.error('页面没暴露钩子:' + hooks.join(',') + ' —— 多半是 dev 的 base 又把 /build.html 顶成了首页'); await b.close(); process.exit(1) }

/** 在页面里摆一台机器然后跑完,回传最终状态。fn 里可用 P/H/V 三个铺设助手。 */
const build = (lvl, fn, arg) => p.evaluate(({ L, src, a }) => {
  window.__play(L)
  const P = (r, c, k, d, m = 0) => window.__place(r, c, k, d, m)
  const H = (r, c1, c2, d = 0) => { for (let c = c1; c <= c2; c++) P(r, c, 'belt', d) }
  const V = (c, r1, r2, d = 3) => { for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) P(r, c, 'belt', d) }
  ;(new Function('P', 'H', 'V', 'a', src))(P, H, V, a)
  window.__run(); for (let i = 0; i < 120 && window.__state().running; i++) window.__stepN(1)
  return window.__state()
}, { L: lvl, src: fn, a: arg ?? null })

console.log('\n搭机器 · 八关真地址冒烟\n')

/* ── L0 先认一位:第 0 位=0 走直、=1 拐弯 ── */
{
  const s = await build(0, `P(3,1,'arouter',0,0); H(3,2,10); V(1,1,2); H(1,1,10)`)
  ok(s.pass && s.wrong === 0, `L0 先认一位 网段0×3/网段1×3=通过(by=[${s.deliveredBy}], parts=${s.parts})`)
  const bad = await build(0, `P(3,1,'arouter',0,0); H(3,2,10)`)   // 不接拐弯那条 → 地址为 1 的全丢
  ok(!bad.pass && (bad.lost > 0 || bad.wrong > 0), `L0 反例:不接"位=1"那条支路→包丢/错(lost=${bad.lost})`)
}

/* ── L1 按址转发:两台串成转发树,先看高位再看低位 ── */
{
  const s = await build(1, `
    P(3,1,'arouter',0,1);                          // 看高位:低组(0,1)直行, 高组(2,3)上
    P(3,2,'arouter',1,0); H(4,2,10); H(3,3,10);    // 低组朝下:a0 直行向下→网段0, a1 右转→网段1
    P(2,1,'arouter',0,0);                          // 高组:a2 直行, a3 上
    P(2,2,'belt',3); P(1,2,'belt',0); H(1,3,10);   // a2 → 网段2
    P(1,1,'belt',3); P(0,1,'belt',0); H(0,2,10);`) // a3 → 网段3
  ok(s.pass && s.wrong === 0, `L1 按址转发 四网段各2=通过(by=[${s.deliveredBy}], parts=${s.parts})`)
}

/* ── L3 最长前缀匹配:具体在前=通过;泛化在前=被提前吞掉 ── */
{
  const lay = `
    P(3,1,'prefix',0,a[0]); P(3,2,'prefix',0,a[1]); P(3,3,'prefix',0,a[2]); H(3,4,10);
    P(2,1,'belt',3); P(1,1,'belt',3); H(0,1,10);
    P(2,2,'belt',3); H(1,2,10);
    H(2,3,10);`
  const good = await build(3, lay, [0, 1, 2])
  ok(good.pass && good.wrong === 0 && good.lost === 0,
    `L3 最长前缀 具体→泛化=通过(by=[${good.deliveredBy}], parts=${good.parts}, cyc=${good.cycles})`)
  const bad = await build(3, lay, [2, 1, 0])
  ok(!bad.pass && bad.wrong > 0,
    `L3 反例:泛化(1**)摆最前→吞掉该走具体路由的包→不通过(wrong=${bad.wrong})`)
}

/* ── L4 子网掩码:金发姑娘,取长取短都错且错法不同 ── */
{
  const lay = `P(3,1,'mask',0,a); H(3,2,10); H(2,1,10);`
  const short = await build(4, lay, 0), right = await build(4, lay, 1), long = await build(4, lay, 2)
  ok(right.pass && right.wrong === 0 && right.deliveredBy[0] === 2 && right.deliveredBy[1] === 4,
    `L4 子网掩码 /2 正确=通过(本地2 网关4, parts=${right.parts})`)
  ok(!short.pass && short.wrong > 0, `L4 反例:/1 太短→外网地址被误当本地(wrong=${short.wrong})`)
  ok(!long.pass && long.wrong > 0, `L4 反例:/3 太长→同网段同伴被误送网关(wrong=${long.wrong})`)
}

/* ── L5 ARP:同一个 IP 只该问一次,之后全走直送 ── */
{
  const s = await build(5, `
    P(3,1,'cache',0);                                     // 没问过→直行, 问过→上
    H(3,2,8); P(3,9,'belt',1); P(4,9,'belt',1); H(5,9,10);// 首次 → 绕到 ARP 查询口
    P(2,1,'belt',3); P(1,1,'belt',0); H(1,2,10);`)        // 问过 → 上行进直送口
  ok(s.deliveredBy[1] === 2, `L5 ARP 两个不同 IP 各问一次(ARP口=${s.deliveredBy[1]})`)
  ok(s.deliveredBy[0] === 4, `L5 ARP 问过的直送(直送口=${s.deliveredBy[0]})`)
  ok(s.pass && s.wrong === 0, `L5 ARP 通过(parts=${s.parts}, cyc=${s.cycles})`)
}

/* ── L6 泛洪:一个包复制成两份,两个口各收满 ── */
{
  const s = await build(6, `
    P(3,1,'copier',0);                                    // 一份向上、一份向下
    P(2,1,'belt',3); P(1,1,'belt',0); H(1,2,10);          // 上面那份 → 口1
    P(4,1,'belt',1); P(5,1,'belt',0); H(5,2,10);`)        // 下面那份 → 口2(必须朝下,朝上会送回复制器→无限增殖)
  ok(s.pass && s.deliveredBy[0] === 4 && s.deliveredBy[1] === 4,
    `L6 泛洪 两个口各 4 份=通过(by=[${s.deliveredBy}], parts=${s.parts})`)
  const bad = await build(6, `H(3,1,10);`)   // 不复制,直走 → 两个口都收不满
  ok(!bad.pass, `L6 反例:不用复制器直走→两口收不满→不通过(by=[${bad.deliveredBy}])`)
}

/* ── L7~L8 NAT:出方向改写地址 → 回程按会话表还原(同主题加一层)── */
{
  const out = await build(7, `P(3,1,'nat',0); H(3,2,10);`)
  ok(out.pass && out.wrong === 0, `L7 NAT出方向 三台机器对外都成地址0=通过(by=[${out.deliveredBy}], parts=${out.parts})`)
  const raw = await build(7, `H(3,1,10);`)
  ok(!raw.pass && raw.wrong > 0, `L7 反例:不过 NAT 直送→私网地址原样出门→不通过(wrong=${raw.wrong})`)

  const back = await build(8, `
    P(3,1,'nat',0);
    P(3,2,'arouter',0,1); H(3,3,10);
    P(2,2,'belt',0); P(2,3,'arouter',0,0); H(2,4,10);
    P(1,3,'belt',0); H(1,4,10);`)
  ok(back.pass && back.wrong === 0, `L8 NAT回程 三台机器各归各位=通过(by=[${back.deliveredBy}], parts=${back.parts})`)
  ok(back.natDrop === 1 && back.lost === 1,
    `L8 未建会话的回包被 NAT 丢掉(natDrop=${back.natDrop}) —— 这就是外网连不进来的原因`)
  const noNat = await build(8, `P(3,1,'belt',0); H(3,2,10);`)
  ok(!noNat.pass && noNat.wrong > 0, `L8 反例:不经 NAT→会话号当地址送→不通过(wrong=${noNat.wrong})`)
}

/* ── L9 出口拥塞:一峰同拍涌到,不限速就丢包 ── */
{
  const good = await build(9, `
    P(3,1,'arouter',0,0);                                  // 地址第0位:1→上(网段1), 0→直行(网段0)
    P(2,1,'belt',3); P(1,1,'belt',0); P(1,2,'queue',0,0); H(1,3,10);   // 网段1 支路接队列限速
    H(3,2,3); P(3,4,'belt',1); P(4,4,'belt',1); P(5,4,'belt',0); P(5,5,'queue',0,0); H(5,6,10);`)
  ok(good.lost === 0 && good.delivered > 0, `L9 拥塞 接队列限速→零丢包(lost=${good.lost}, by=[${good.deliveredBy}])`)
  const bad = await build(9, `
    P(3,1,'arouter',0,0);
    P(2,1,'belt',3); P(1,1,'belt',0); H(1,2,10);
    H(3,2,3); P(3,4,'belt',1); P(4,4,'belt',1); P(5,4,'belt',0); H(5,5,10);`)   // 同样接通但不限速
  ok(bad.lost > 0, `L9 反例:不接队列直怼出口→丢包(lost=${bad.lost})`)
}

/* ── L10 终关:掩码判同网段 → 前缀匹配选路 → 没人认领走默认口 ── */
{
  const s = await build(10, `
    P(3,1,'mask',0,1); P(3,2,'prefix',0,0); P(3,3,'prefix',0,1); H(3,4,10);
    P(2,1,'belt',3); P(1,1,'belt',3); H(0,1,10);
    P(2,2,'belt',3); H(1,2,10);
    H(2,3,10);`)
  ok(s.pass && s.wrong === 0 && s.lost === 0,
    `L10 终关 四个口各2=通过(by=[${s.deliveredBy}], parts=${s.parts}, cyc=${s.cycles})`)
}

/* ── 通用 ── */
await p.evaluate(() => window.__menu()); await p.waitForTimeout(250)
ok(errs.length === 0, `全程无控制台报错(含菜单渲染)${errs.length ? ':' + errs[0] : ''}`)
const storyOk = await p.evaluate(() => window.__storyOk())
ok(storyOk, '每关都有 STORY 文案')

await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
