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

console.log('\n搭机器 · 十三关真地址冒烟\n')

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

/* ── L7 MAC 表自学习:头一个包泛到三个口,学会之后只进主机那一个口 ──
   判据的力气全在**计数**上:主机口 4 = 1 份泛洪 + 3 份直送,两个旁口各只有 1 份。
   纯泛洪会撑爆旁口、纯直送旁口收不到 —— 只有「先泛后学」这一种走法能同时对上三个数。 */
{
  const learn = await build(7, `
    P(2,1,'belt',0); H(2,2,10);                            // 主机口直送道(泛洪的那一份也并进这条道)
    P(3,1,'cache',0); P(3,2,'belt',0); P(3,3,'copier',0);   // 没学过→直行去泛洪;学过→拐弯上直送道
    P(4,3,'belt',1); P(5,3,'belt',0); P(5,4,'copier',0);    // 泛洪第二级:再复制一份,凑够三个口
    P(4,4,'belt',0); H(4,5,10);
    P(6,4,'belt',0); H(6,5,10);`)
  ok(learn.pass && learn.wrong === 0 && learn.lost === 0,
    `L7 MAC自学习 泛一次就学会,之后只走主机口=通过(by=[${learn.deliveredBy}], parts=${learn.parts})`)
  const allFlood = await build(7, `
    P(2,1,'belt',0); H(2,2,10);
    P(3,1,'belt',0); P(3,2,'belt',0); P(3,3,'copier',0);    // 把 MAC 表换成传送带 = 永远学不会
    P(4,3,'belt',1); P(5,3,'belt',0); P(5,4,'copier',0);
    P(4,4,'belt',0); H(4,5,10);
    P(6,4,'belt',0); H(6,5,10);`)
  ok(!allFlood.pass && allFlood.wrong > 0,
    `L7 反例:不学习、包包都泛洪→两个旁口各收 4 份(该只收 1 份)→不通过(by=[${allFlood.deliveredBy}])`)
  const noFlood = await build(7, `
    P(2,1,'belt',0); H(2,2,10);
    P(3,1,'cache',0); P(3,2,'belt',3);`)                    // 没学过的也直接上直送道 = 从不泛洪
  ok(!noFlood.pass && noFlood.deliveredBy[1] === 0 && noFlood.deliveredBy[2] === 0,
    `L7 反例:从不泛洪→头一个包也直送→两个旁口一份都收不到→不通过(by=[${noFlood.deliveredBy}])`)
}

/* ── L8~L9 NAT:出方向改写地址 → 回程按会话表还原(同主题加一层)── */
{
  const out = await build(8, `P(3,1,'nat',0); H(3,2,10);`)
  ok(out.pass && out.wrong === 0, `L8 NAT出方向 三台机器对外都成地址0=通过(by=[${out.deliveredBy}], parts=${out.parts})`)
  const raw = await build(8, `H(3,1,10);`)
  ok(!raw.pass && raw.wrong > 0, `L8 反例:不过 NAT 直送→私网地址原样出门→不通过(wrong=${raw.wrong})`)

  const back = await build(9, `
    P(3,1,'nat',0);
    P(3,2,'arouter',0,1); H(3,3,10);
    P(2,2,'belt',0); P(2,3,'arouter',0,0); H(2,4,10);
    P(1,3,'belt',0); H(1,4,10);`)
  ok(back.pass && back.wrong === 0, `L9 NAT回程 三台机器各归各位=通过(by=[${back.deliveredBy}], parts=${back.parts})`)
  ok(back.okDrop === 1 && back.lost === 1,
    `L9 未建会话的回包被 NAT 丢掉(okDrop=${back.okDrop}) —— 这就是外网连不进来的原因`)
  const noNat = await build(9, `P(3,1,'belt',0); H(3,2,10);`)
  ok(!noNat.pass && noNat.wrong > 0, `L9 反例:不经 NAT→会话号当地址送→不通过(wrong=${noNat.wrong})`)
}

/* ── L10 访问控制:例外放行(101)必须摆在通配拦截(10*)的上游 ──
   注意两条反例判的是**两种不同的错**:摆反顺序 → 例外轮不上、该放的被拦;
   干脆不装规则 → 该拦的也出网了。 */
{
  const lay = `
    P(3,1,'prefix',0,a[0]); P(3,2,'acl',0,a[1]); H(3,3,10);   // ① 放行 101(命中就绕开后面的规则) ② 拦截 10*
    P(2,1,'belt',0); P(2,2,'belt',0); P(2,3,'belt',1);`       // 放行道:从规则①上方绕过规则②,再并回主道
  const good = await build(10, lay, [0, 1])
  ok(good.pass && good.wrong === 0 && good.deliveredBy[0] === 4,
    `L10 访问控制 例外在前=通过(放行 ${good.deliveredBy[0]}/4, parts=${good.parts})`)
  ok(good.okDrop === 2 && good.lost === 2,
    `L10 命中拦截规则的 100 是**真的被丢掉**(okDrop=${good.okDrop}),不是送去了某个口`)
  const swapped = await build(10, `
    P(3,1,'acl',0,1); P(3,2,'prefix',0,0); H(3,3,10);
    P(2,2,'belt',0); P(2,3,'belt',1);`)
  ok(!swapped.pass && swapped.lost > (good.lost ?? 0),
    `L10 反例:拦截(10*)摆在例外(101)前面→例外永远轮不上、该放的也被拦(丢 ${swapped.lost} 个)`)
  const noRule = await build(10, `H(3,1,10);`)
  ok(!noRule.pass && noRule.lost === 0,
    `L10 反例:一条规则都不装直通→该拦的 100 也出了网(丢 ${noRule.lost} 个,放行 ${noRule.deliveredBy[0]})`)
}

/* ── L11 出口拥塞:一峰同拍涌到,不限速就丢包 ── */
{
  const good = await build(11, `
    P(3,1,'arouter',0,0);                                  // 地址第0位:1→上(网段1), 0→直行(网段0)
    P(2,1,'belt',3); P(1,1,'belt',0); P(1,2,'queue',0,0); H(1,3,10);   // 网段1 支路接队列限速
    H(3,2,3); P(3,4,'belt',1); P(4,4,'belt',1); P(5,4,'belt',0); P(5,5,'queue',0,0); H(5,6,10);`)
  ok(good.lost === 0 && good.delivered > 0, `L11 拥塞 接队列限速→零丢包(lost=${good.lost}, by=[${good.deliveredBy}])`)
  const bad = await build(11, `
    P(3,1,'arouter',0,0);
    P(2,1,'belt',3); P(1,1,'belt',0); H(1,2,10);
    H(3,2,3); P(3,4,'belt',1); P(4,4,'belt',1); P(5,4,'belt',0); H(5,5,10);`)   // 同样接通但不限速
  ok(bad.lost > 0, `L11 反例:不接队列直怼出口→丢包(lost=${bad.lost})`)
}

/* ── L12 终关:真路由器出方向的整条路 ──
   判同网段 → 查路由表 → 出向访问控制 → NAT 改写 → 出口排队。
   四条反例各拆掉链上的一环,每一环缺了都得判红 —— 否则「完整」二字就是空话。 */
{
  const CHAIN = (k4, k5) => `
    P(3,1,'mask',0,1); P(3,2,'prefix',0,0); P(3,3,'acl',0,1); ${k4} ${k5} H(3,6,10);
    P(2,1,'belt',3); P(1,1,'belt',3); H(0,1,10);
    P(2,2,'belt',3); H(1,2,10);`
  const s = await build(12, CHAIN(`P(3,4,'nat',0);`, `P(3,5,'queue',0,0);`))
  ok(s.pass && s.wrong === 0,
    `L12 终关 整条路串通=通过(by=[${s.deliveredBy}], 按规矩拦下 ${s.okDrop}, parts=${s.parts}, cyc=${s.cycles})`)
  const noQueue = await build(12, CHAIN(`P(3,4,'nat',0);`, `P(3,5,'belt',0);`))
  ok(!noQueue.pass && noQueue.lost > noQueue.okDrop,
    `L12 反例:公网口不接队列→一峰同拍怼上最慢的链路→挤丢(lost=${noQueue.lost} > 该丢的 ${noQueue.okDrop})`)
  const noNat = await build(12, CHAIN(`P(3,4,'belt',0);`, `P(3,5,'queue',0,0);`))
  ok(!noNat.pass && noNat.wrong > 0,
    `L12 反例:不过 NAT→私网地址原样上公网→公网口不认(wrong=${noNat.wrong})`)
  const noAcl = await build(12, `
    P(3,1,'mask',0,1); P(3,2,'prefix',0,0); P(3,3,'prefix',0,1); P(3,4,'nat',0); P(3,5,'queue',0,0); H(3,6,10);
    P(2,1,'belt',3); P(1,1,'belt',3); H(0,1,10);
    P(2,2,'belt',3); H(1,2,10);
    H(2,3,10);`)
  ok(!noAcl.pass && noAcl.okDrop === 0,
    `L12 反例:把「拦截」换成「放行」→ 该禁的 00* 也出了网(按规矩拦下 ${noAcl.okDrop},该拦 2)`)
  const badMask = await build(12, CHAIN(`P(3,4,'nat',0);`, `P(3,5,'queue',0,0);`).replace(`'mask',0,1`, `'mask',0,2`))
  ok(!badMask.pass && badMask.wrong > 0,
    `L12 反例:掩码调成 /3 太长→同网段的 011 被误当外网、一路走到公网口(wrong=${badMask.wrong})`)
}

/* ── 房子剖面图:两台机器各有各的入口,而且不能叠住 ──
   叠住的表现是「点路由器却进了电脑」——**不报错,只是点不对**,所以必须有判据钉着。
   窗口宽度会改变房子的画幅,所以三个宽度都量一遍。 */
{
  const overlap = (a, z, t) => !(a.x + a.w + t < z.x - t || z.x + z.w + t < a.x - t || a.y + a.h + t < z.y - t || z.y + z.h + t < a.y - t)
  //  前面的关卡判据把页面切进了 play 态,房子早不在屏幕上了 —— 必须先重载回开场。
  //  (第一版忘了这一步,判据红在「点了没反应」,而真实原因是压根没在那一屏。)
  await p.goto(`http://localhost:${PORT}/build.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
  let bad = []
  for (const [w, h] of [[1024, 720], [1360, 860], [1680, 900]]) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(200)
    const g = await p.evaluate(() => ({ r: window.__intro(), c: window.__introCpu() }))
    if (overlap(g.r, g.c, 6)) bad.push(`${w}×${h}`)
  }
  ok(bad.length === 0, `房子里两个入口(路由器 / 电脑)在 1024~1680 三个宽度下都不叠(叠了会「点这个进那个」)${bad.length ? ':' + bad : ''}`)
  await p.setViewportSize({ width: 1280, height: 720 }); await p.waitForTimeout(200)
  const c = await p.evaluate(() => window.__introCpu())
  await p.mouse.click(c.x + c.w / 2, c.y + c.h / 2 + 36)   // +36 = 顶部那条虾米课堂外壳
  await p.waitForTimeout(600)
  ok(new URL(p.url()).pathname.endsWith('cpu.html'), `点书房那台电脑 → 跳到第二台机器(实测 ${new URL(p.url()).pathname})`)
  await p.goto(`http://localhost:${PORT}/build.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(300)
}

/* ── 通用 ── */
await p.evaluate(() => window.__menu()); await p.waitForTimeout(250)
ok(errs.length === 0, `全程无控制台报错(含菜单渲染)${errs.length ? ':' + errs[0] : ''}`)
const storyOk = await p.evaluate(() => window.__storyOk())
ok(storyOk, '每关都有 STORY 文案')

await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
