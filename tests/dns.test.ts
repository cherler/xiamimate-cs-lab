import { resolve, pingIp, canOpenSite, PUBLIC_DNS, ROUTER_DNS, type Net } from '../solvers/dns.ts'
import { ok } from './harness.ts'

const base = (over: Partial<Net> = {}): Net => ({
  linkUp: true, dnsServer: ROUTER_DNS, cache: {}, hosts: {},
  fault: 'none', latencyMs: 30, timeoutMs: 2000, ...over,
})

export function run() {
  console.log('— DNS 求解器 —')

  //  这一关的题眼：同一个网络状态，游戏通、网页废
  {
    const net = base({ fault: 'server-down' })
    ok(pingIp(net, '203.0.113.20').ok, 'DNS 挂了，按 IP 直连仍然通（游戏没事）')
    ok(!canOpenSite(net, 'example.com'), '同一时刻，靠域名的网页打不开')
    const r = resolve(net, 'example.com')
    ok(r.ip === null, '解析失败')
    ok(r.steps.some(s => s.where.includes('DNS') && !s.ok), '断点落在 DNS 那一步，不是链路')
  }

  //  真断网：两者都废——用来跟上面区分（否则玩家分不清）
  {
    const net = base({ linkUp: false })
    ok(!pingIp(net, '203.0.113.20').ok, '链路断时 IP 也不通')
    ok(!canOpenSite(net, 'example.com'), '链路断时网页当然也不通')
  }

  //  换个 DNS 就好了——这一关的解法
  {
    const broken = base({ fault: 'server-down' })
    ok(!canOpenSite(broken, 'example.com'), '用路由器的 DNS：打不开')
    const fixed = { ...broken, dnsServer: PUBLIC_DNS }
    ok(canOpenSite(fixed, 'example.com'), '换成公共 DNS：打开了')
  }

  //  超时：能答但太慢，浏览器放弃——跟"挂了"现象一样，原因不同
  {
    const slow = base({ fault: 'server-slow', latencyMs: 5000, timeoutMs: 2000 })
    ok(!canOpenSite(slow, 'example.com'), 'DNS 太慢=等于打不开')
    const patient = { ...slow, timeoutMs: 8000 }
    ok(canOpenSite(patient, 'example.com'), '等得够久其实能解析——慢和挂不是一回事')
  }

  //  脏缓存：解析"成功"了却是错的地址（最阴的一种）
  {
    const net = base({ cache: { 'example.com': '10.0.0.9' } })
    const r = resolve(net, 'example.com')
    ok(r.ip !== null, '脏缓存下解析看起来成功了')
    ok(!r.correct, '但地址是错的——所以还是打不开')
    ok(!canOpenSite(net, 'example.com'), '“解析成功”不等于“能打开”')
  }

  //  缓存命中就不问 DNS——解释"为什么有的网站还能开"
  {
    const net = base({ fault: 'server-down', cache: { 'example.com': '93.184.216.34' } })
    ok(canOpenSite(net, 'example.com'), 'DNS 挂了，但缓存里有的那个网站照样开')
    const r = resolve(net, 'example.com')
    ok(r.steps[0]!.where === '本机缓存' && r.steps[0]!.ok, '走的是缓存，没碰 DNS')
  }
}
