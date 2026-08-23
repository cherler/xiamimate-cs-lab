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
