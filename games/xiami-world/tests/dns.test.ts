import { resolve } from '../solvers/dns/resolve.ts'
import { initNet } from '../solvers/dns/state.ts'
import { PUBLIC_DNS } from '../solvers/dns/world.ts'
import { ok } from './harness.ts'

export function run() {
  console.log('— DNS 解析引擎 S1 —')

  //  核心：一次查询产出的是"逐跳过程"，不是一个结论
  {
    const r = resolve(initNet(), 'example.com')
    ok(r.ip === '93.184.216.34', 'example.com 解析到正确 IP')
    ok(r.correct, '解析结果正确')
    //  必须真的走过完整的链，一跳都不能少
    const hops = r.timeline.map(s => s.hop)
    ok(hops.includes('browser-cache') && hops.includes('os-cache') && hops.includes('hosts'),
       '时间线包含三级本地查找')
    ok(hops.includes('recursive'), '走了递归服务器')
    ok(hops.includes('root') && hops.includes('tld') && hops.includes('authoritative'),
       '递归代问了 根→TLD→权威 全程（这是 DNS 的本质）')
    //  顺序必须对：根在 TLD 前，TLD 在权威前
    ok(hops.indexOf('root') < hops.indexOf('tld') && hops.indexOf('tld') < hops.indexOf('authoritative'),
       '转介顺序正确：根 → TLD → 权威')
    //  总耗时 = 各跳之和（时间线是可累加的真过程）
    ok(r.totalMs === r.timeline.reduce((s, x) => s + x.ms, 0), '总耗时等于各跳耗时之和')
    //  权威那一步带着真记录
    const auth = r.timeline.find(s => s.hop === 'authoritative')!
    ok(auth.record?.value === '93.184.216.34', '权威那一步带回了真实 A 记录')
  }

  //  递归服务器挂了：这一关的密——网没断，但名字翻不出来
  {
    const net = initNet({ serverReachable: false })
    const r = resolve(net, 'example.com')
    ok(r.ip === null && r.failure === 'unreachable', '递归挂了 → 解析失败')
    const last = r.timeline[r.timeline.length - 1]!
    ok(last.hop === 'recursive' && last.outcome === 'unreachable',
       '断点精确落在递归服务器这一跳，不是别处')
  }

  //  换公共 DNS 就好了
  {
    const r = resolve(initNet({ dnsServer: PUBLIC_DNS }), 'example.com')
    ok(r.ip === '93.184.216.34', '换公共 DNS：解析成功')
  }

  //  hosts 写死：一步命中，不走递归
  {
    const r = resolve(initNet({ hosts: { 'example.com': '10.9.9.9' } }), 'example.com')
    const hostsStep = r.timeline.find(s => s.hop === 'hosts')!
    ok(hostsStep.outcome === 'hit', 'hosts 命中')
    ok(!r.timeline.some(s => s.hop === 'recursive'), 'hosts 命中后不再走递归（跳数变少）')
    ok(r.ip === '10.9.9.9' && !r.correct, 'hosts 劫持：解析"成功"但地址是错的')
  }

  //  查无此名
  {
    const r = resolve(initNet(), 'nope.example.com')
    ok(r.ip === null && r.failure === 'nxdomain', '不存在的名字 → nxdomain')
  }
}

import { clearCache } from '../solvers/dns/state.ts'
import { cacheView } from '../solvers/dns/cache.ts'

export function runS2() {
  console.log('— DNS 缓存 + TTL S2 —')

  //  性质①：同一查询第二次因命中缓存，更快、跳数更少
  {
    const net = initNet()
    const first = resolve(net, 'example.com')
    const second = resolve(net, 'example.com')
    ok(first.timeline.length > second.timeline.length,
       `第二次跳数变少（${first.timeline.length} → ${second.timeline.length}）——命中了缓存`)
    ok(second.totalMs < first.totalMs,
       `第二次更快（${first.totalMs}ms → ${second.totalMs}ms）`)
    ok(second.timeline.some(s => s.hop === 'browser-cache' && s.outcome === 'hit'),
       '第二次在浏览器缓存就命中了')
    ok(!second.timeline.some(s => s.hop === 'authoritative'),
       '第二次根本没惊动权威服务器')
  }

  //  性质②：清缓存后又变慢（回到全程）——反直觉的密
  {
    const net = initNet()
    resolve(net, 'example.com')                    // 暖缓存
    const cached = resolve(net, 'example.com')     // 快
    clearCache(net, 'all')
    const afterClear = resolve(net, 'example.com') // 又慢
    ok(afterClear.totalMs > cached.totalMs,
       `清缓存后反而变慢（${cached.totalMs}ms → ${afterClear.totalMs}ms）——清缓存不是"清理加速"`)
    ok(afterClear.timeline.some(s => s.hop === 'authoritative'),
       '清缓存后又得重新惊动权威')
  }

  //  性质③：TTL 到期后重查变慢；未到期第二次快
  {
    const net = initNet()
    resolve(net, 'example.com')                          // TTL 3600s
    const beforeExpire = resolve(net, 'example.com')     // 快
    net.now += 100 * 1000                                // 快进 100s（<3600，未过期）
    const stillCached = resolve(net, 'example.com')
    ok(stillCached.totalMs === beforeExpire.totalMs,
       'TTL 没到期：第二次照样命中、照样快')
    net.now += 3700 * 1000                               // 再快进，越过 3600s
    const afterExpire = resolve(net, 'example.com')
    ok(afterExpire.totalMs > beforeExpire.totalMs,
       `TTL 过期后重查变慢（${beforeExpire.totalMs}ms → ${afterExpire.totalMs}ms）`)
    ok(afterExpire.timeline.some(s => s.hop === 'authoritative'),
       'TTL 过期后又走了全程')
  }

  //  三级独立：清了浏览器缓存但系统缓存还在 → 仍然比全程快
  {
    const net = initNet()
    resolve(net, 'example.com')            // 三级都暖了
    clearCache(net, 'browser')             // 只清浏览器
    const r = resolve(net, 'example.com')
    ok(r.timeline.some(s => s.hop === 'os-cache' && s.outcome === 'hit'),
       '浏览器缓存清了，落到系统缓存命中')
    ok(!r.timeline.some(s => s.hop === 'authoritative'),
       '系统缓存还在，不用惊动权威')
  }

  //  缓存视图：能看见没过期的条目 + 剩余 TTL（给可视化用）
  {
    const net = initNet()
    resolve(net, 'example.com')
    const view = cacheView(net.browserCache, net.now)
    ok(view.length === 1 && view[0]!.record.name === 'example.com',
       '缓存视图里有 example.com')
    ok(view[0]!.ttlLeft > 0 && view[0]!.ttlLeft <= 3600,
       `剩余 TTL 在合理范围（${view[0]!.ttlLeft}s）`)
    net.now += 200 * 1000
    const later = cacheView(net.browserCache, net.now)
    ok(later[0]!.ttlLeft < view[0]!.ttlLeft, 'TTL 随时间倒数')
  }
}

export function runS3() {
  console.log('— DNS 记录类型 + CNAME 折返 S3 —')

  //  CNAME 折返：查 www.example.com → 别名 → 真身 → A
  {
    const net = initNet()
    const r = resolve(net, 'www.example.com')
    ok(r.ip === '93.184.216.34', 'www.example.com 最终解析到真身的 IP')
    ok(r.correct, '结果正确')
    //  时间线里必须出现"拿到 CNAME"和"折返后再查真身"
    const cnameStep = r.timeline.find(s => s.outcome === 'cname')
    ok(!!cnameStep, '时间线里出现了 CNAME 那一步')
    //  权威被问了两次：一次给 CNAME（查 www），一次给 A（查真身）
    const authSteps = r.timeline.filter(s => s.hop === 'authoritative')
    ok(authSteps.length === 2, `权威被问了两次（折返再查一遍）——实测 ${authSteps.length} 次`)
    //  折返后查的名字变成了真身
    ok(authSteps[1]!.query === 'example.com', '折返后查的是真身 example.com')
    //  比直连的 example.com 跳数更多（多走了一趟）
    const direct = resolve(initNet(), 'example.com')
    ok(r.timeline.length > direct.timeline.length,
       `CNAME 比直连跳数多（${direct.timeline.length} → ${r.timeline.length}）`)
  }

  //  CNAME 死循环：a→b→a，检出，不死机
  {
    const r = resolve(initNet(), 'loop-a.example.com')
    ok(r.ip === null && r.failure === 'cname-loop', 'CNAME 死循环被检出为 cname-loop')
    ok(r.timeline.length < 40, '没有无限展开（时间线有界）')
  }

  //  CNAME 折返后，别名和真身各自被缓存 → 第二次查 www 更快
  {
    const net = initNet()
    const first = resolve(net, 'www.example.com')
    const second = resolve(net, 'www.example.com')
    ok(second.totalMs < first.totalMs,
       `第二次查 www 更快（${first.totalMs}ms → ${second.totalMs}ms）——别名也缓存了`)
    ok(second.timeline.some(s => s.hop.includes('cache') && s.outcome === 'hit'),
       '第二次在缓存命中')
  }
}

import { applyFault, randomFault, ALL_REAL_FAULTS } from '../solvers/dns/fault.ts'
import { currentTrueIp } from '../solvers/dns/resolve.ts'

export function runS4() {
  console.log('— DNS 故障模型 S4 —')

  //  每种故障：网页打不开（或解析成功却是错的），且断点/命中特征可区分
  {
    // server-down：递归 unreachable
    const n1 = initNet(); applyFault(n1, 'server-down', 'example.com')
    const r1 = resolve(n1, 'example.com')
    ok(r1.failure === 'unreachable' && r1.timeline[r1.timeline.length-1]!.outcome === 'unreachable',
       'server-down：递归不可达，断在递归这跳')

    // server-slow：递归 timeout（不是 unreachable，可区分）
    const n2 = initNet(); applyFault(n2, 'server-slow', 'example.com')
    const r2 = resolve(n2, 'example.com')
    ok(r2.failure === 'timeout' && r2.timeline[r2.timeline.length-1]!.outcome === 'timeout',
       'server-slow：超时（跟 unreachable 区分开）')
    // 且"调大超时"能修好——证明是慢不是断
    const n2b = initNet({ timeoutMs: 8000 }); applyFault(n2b, 'server-slow', 'example.com')
    ok(resolve(n2b, 'example.com').ip !== null, 'server-slow：等得够久其实能解析（慢≠断）')

    // poisoned-cache：解析"成功"但 IP 错，命中在缓存
    const n3 = initNet(); applyFault(n3, 'poisoned-cache', 'example.com')
    const r3 = resolve(n3, 'example.com')
    ok(r3.ip !== null && !r3.correct, 'poisoned-cache：解析成功却是错的 IP')
    ok(r3.timeline.some(s => s.hop.includes('cache') && s.outcome === 'hit'),
       'poisoned-cache：命中在缓存')

    // ttl-too-long：也是缓存命中错IP，但那条记录 TTL 超长（区分 poisoned）
    const n4 = initNet(); applyFault(n4, 'ttl-too-long', 'example.com')
    const r4 = resolve(n4, 'example.com')
    ok(r4.ip !== null && !r4.correct, 'ttl-too-long：拿到的是过时地址，连不上')
    const badStep = r4.timeline.find(s => s.hop.includes('cache') && s.outcome === 'hit')!
    ok((badStep.record?.ttl ?? 0) > 86400,
       `ttl-too-long：那条缓存 TTL 超长（${badStep.record?.ttl}s），跟 poisoned 的正常 TTL 区分`)

    // hosts-hijack：命中在 hosts（不是缓存），清缓存修不了
    const n5 = initNet(); applyFault(n5, 'hosts-hijack', 'example.com')
    const r5 = resolve(n5, 'example.com')
    ok(r5.ip !== null && !r5.correct, 'hosts-hijack：解析成功却是错的')
    ok(r5.timeline.some(s => s.hop === 'hosts' && s.outcome === 'hit'),
       'hosts-hijack：命中在 hosts 这跳（不是缓存）')
  }

  //  换 DNS 修好 server-down / 换不好 poisoned（对症才有用）
  {
    const n = initNet(); applyFault(n, 'server-down', 'example.com')
    n.serverReachable = true // 相当于换了台可达的
    ok(resolve(n, 'example.com').ip !== null, 'server-down 换台可达服务器 → 好了')
  }

  //  随机故障：不管随机到哪个，都"真的坏了"且"能被观察到坏在哪"——防刷的地基
  {
    for (let seed = 0; seed < 30; seed++) {
      const f = randomFault(seed)
      const net = initNet(); applyFault(net, f, 'example.com')
      const r = resolve(net, 'example.com')
      const broken = r.ip === null || !r.correct
      ok(broken, `随机故障 seed=${seed}(${f})：确实让网页打不开/连不上`)
    }
    // 覆盖到所有故障种类（不是永远随机到同一个）
    const seen = new Set(Array.from({ length: 30 }, (_, s) => randomFault(s)))
    ok(seen.size === ALL_REAL_FAULTS.length, `30 个 seed 覆盖了全部 ${ALL_REAL_FAULTS.length} 种故障`)
  }

  //  currentTrueIp：ttl-too-long 下"现在的真值"跟缓存里的旧值不同
  {
    const n = initNet(); applyFault(n, 'ttl-too-long', 'example.com')
    ok(currentTrueIp(n, 'example.com') !== '93.184.216.34',
       'ttl-too-long：权威现在的真值已经变了（所以旧缓存是错的）')
  }
}

import { clearCache as clearC } from '../solvers/dns/state.ts'

/** S4b：对抗验证挖出的交互 bug，逐条钉成"修复动作真能修好"的守卫 */
export function runS4b() {
  console.log('— DNS 故障修复闭环 S4b（对抗验证守卫）—')

  //  【blocker】ttl-too-long：清缓存必须真能修好（之前 override 引擎不读→永远修不好）
  {
    const net = initNet(); applyFault(net, 'ttl-too-long', 'example.com')
    const before = resolve(net, 'example.com')
    ok(before.ip !== null && !before.correct, 'ttl-too-long：施故障后拿到旧地址、连不上')
    clearC(net, 'all')
    const after = resolve(net, 'example.com')
    ok(after.correct, 'ttl-too-long：清缓存后走权威拿到新值 → 修好（谜题可解）')
    ok(after.ip === '93.184.216.99', '修好后拿到的是权威改后的新地址')
  }

  //  【major】hosts-hijack：hosts 优先于缓存 → 就算缓存是暖的，劫持也立刻可见
  {
    const net = initNet()
    resolve(net, 'example.com')                 // 暖三级缓存（正确值）
    applyFault(net, 'hosts-hijack', 'example.com')
    const r = resolve(net, 'example.com')
    ok(r.ip === '10.66.66.66' && !r.correct, 'hosts 劫持：暖缓存也盖不住（hosts 优先）')
    ok(r.timeline[0]!.hop === 'hosts' && r.timeline[0]!.outcome === 'hit', 'hosts 是第一跳就命中')
    //  清缓存修不好（是 hosts 的事），删 hosts 才行
    clearC(net, 'all')
    ok(!resolve(net, 'example.com').correct, 'hosts 劫持：清缓存没用（符合故障表宣称）')
    delete net.hosts['example.com']
    ok(resolve(net, 'example.com').correct, '删掉 hosts 那条 → 修好')
  }

  //  【major】poisoned-cache：暖浏览器缓存不该掩盖中毒；清全部缓存能修好
  {
    const net = initNet()
    resolve(net, 'example.com')                 // 先暖缓存
    applyFault(net, 'poisoned-cache', 'example.com') // 毒覆盖三级
    const r = resolve(net, 'example.com')
    ok(r.ip === '10.0.0.66' && !r.correct, 'poisoned：暖缓存下仍然中毒可见（不被掩盖）')
    clearC(net, 'all')
    ok(resolve(net, 'example.com').correct, 'poisoned：清全部缓存 → 走权威拿到正确值，修好')
  }

  //  对症才有效：每种故障，只有对症动作能修好，别的不行（防"乱点通关"）
  {
    // server-slow：调大超时能修，清缓存不能
    const n = initNet(); applyFault(n, 'server-slow', 'example.com')
    clearC(n, 'all')
    ok(!resolve(n, 'example.com').correct, 'server-slow：清缓存无效（不对症）')
    n.timeoutMs = 8000
    ok(resolve(n, 'example.com').correct, 'server-slow：调大超时才修好（对症）')
  }
}

import { DnsSim } from '../solvers/dns/sim.ts'

/** S5：门面整层验收——从玩家视角走完整局 */
export function runS5() {
  console.log('— DNS 门面 S5（整层验收）—')

  //  门面能发起查询、拿到时间线
  {
    const sim = new DnsSim()
    const r = sim.query('example.com')
    ok(r.ip === '93.184.216.34' && r.timeline.length > 0, '门面：query 返回时间线')
    ok(sim.canOpen('example.com'), '门面：canOpen 正常')
  }

  //  门面能读三级缓存快照（给可视化）
  {
    const sim = new DnsSim()
    sim.query('example.com')
    const snaps = sim.caches()
    ok(snaps.length === 3 && snaps.every(s => Array.isArray(s.entries)), '门面：三级缓存快照')
    const browser = snaps.find(s => s.level === 'browser')!
    ok(browser.entries.some(e => e.record.name === 'example.com' && e.ttlLeft > 0),
       '门面：缓存快照里有条目 + 剩余 TTL')
  }

  //  完整一局：每种随机故障都能"观察→对症修→打开"
  {
    // seed 覆盖到全部 5 种故障
    const applied = new Set<string>()
    for (let seed = 0; seed < 5; seed++) {
      const sim = new DnsSim()
      const fault = sim.seedFault(seed, 'example.com')
      applied.add(fault)
      ok(!sim.canOpen('example.com'), `${fault}：施故障后打不开`)
      // 对症修复（玩家会做的动作，全走门面）
      if (fault === 'server-down') sim.setDns('public')
      else if (fault === 'server-slow') sim.setTimeout(8000)
      else if (fault === 'poisoned-cache') sim.clear('all')
      else if (fault === 'ttl-too-long') sim.clear('all')
      else if (fault === 'hosts-hijack') sim.editHosts('example.com', null)
      ok(sim.canOpen('example.com'), `${fault}：对症修复后能打开`)
    }
    ok(applied.size === 5, 'seed 0-4 覆盖了全部 5 种故障')
  }

  //  推进时钟让缓存过期
  {
    const sim = new DnsSim()
    const cold = sim.query('example.com')
    const warm = sim.query('example.com')
    ok(warm.totalMs < cold.totalMs, '门面：第二次命中缓存更快')
    sim.advance(4000) // 越过 3600s TTL
    const expired = sim.query('example.com')
    ok(expired.totalMs > warm.totalMs, '门面：advance 让缓存过期，重查变慢')
  }
}

/** S6：间接层理论——名字≠地址，中间要翻译（第一关"玩中懂"的核心机制） */
export function runS6() {
  console.log('— DNS 间接层理论 S6 —')
  const sim = new DnsSim()

  //  亲手用名字直连 → 必然撞墙（机器只认门牌号）
  const byName = sim.connectByName('example.com')
  ok(byName.ok === false, '用名字直连：连不上（机器不认名字）')
  ok(byName.reason.includes('门牌号') || byName.reason.includes('IP'), '给出的理由点到"只认门牌号"')

  //  查号台：把名字翻译成门牌号
  const ip = sim.lookupIp('example.com')
  ok(ip === '93.184.216.34', '查号台把 example.com 翻译成门牌号 93.184.216.34')

  //  拿翻译来的门牌号去连 → 通
  const byIp = sim.connectByIp(ip!, 'example.com')
  ok(byIp.ok === true, '用翻译来的门牌号：拨通了')

  //  拿错的门牌号 → 不通（门牌号得对）
  ok(sim.connectByIp('1.2.3.4', 'example.com').ok === false, '错的门牌号连不上')

  //  理论对照：同一个目标，名字连不上、号能连上——这就是"间接层"存在的理由
  ok(sim.connectByName('example.com').ok === false && sim.connectByIp(ip!, 'example.com').ok === true,
     '同一台机器：名字连不上、门牌号能连上——名字和地址是两回事')
}
