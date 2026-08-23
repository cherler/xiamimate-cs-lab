import { resolve } from '../solvers/dns/resolve.ts'
import { initNet } from '../solvers/dns/state.ts'
import { PUBLIC_DNS, SERVERS } from '../solvers/dns/world.ts'
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
    const brokenRouter = { ...SERVERS.router!, reachable: false }
    // 用一个不可达的递归服务器
    const net = initNet({ dnsServer: brokenRouter.ip })
    // 手动让 router 不可达
    SERVERS.router!.reachable = false
    const r = resolve(net, 'example.com')
    ok(r.ip === null && r.failure === 'unreachable', '递归挂了 → 解析失败')
    const last = r.timeline[r.timeline.length - 1]!
    ok(last.hop === 'recursive' && last.outcome === 'unreachable',
       '断点精确落在递归服务器这一跳，不是别处')
    SERVERS.router!.reachable = true // 复原
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
