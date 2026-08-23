import { ipToInt, intToIp, parsePrefix, inPrefix, sameSubnet } from '../solvers/route/ip.ts'
import { ok } from './harness.ts'

export function run() {
  console.log('— 路由·IP 位运算 —')
  // 往返
  ok(intToIp(ipToInt('192.168.1.9')) === '192.168.1.9', 'IP 点分↔整数往返')
  ok(ipToInt('0.0.0.0') === 0 && ipToInt('255.255.255.255') === 0xffffffff, '边界值')
  // 前缀规整：主机位被掩掉
  ok(parsePrefix('10.1.2.3/16').text === '10.1.0.0/16', '前缀取网络号（主机位清零）')
  ok(parsePrefix('0.0.0.0/0').len === 0, '默认路由 /0')
  // 前缀匹配
  const p16 = parsePrefix('10.1.0.0/16'), p8 = parsePrefix('10.0.0.0/8'), def = parsePrefix('0.0.0.0/0')
  ok(inPrefix(ipToInt('10.1.5.5'), p16), '10.1.5.5 命中 10.1.0.0/16')
  ok(!inPrefix(ipToInt('10.2.5.5'), p16), '10.2.5.5 不命中 /16')
  ok(inPrefix(ipToInt('10.2.5.5'), p8), '10.2.5.5 命中 10.0.0.0/8')
  ok(inPrefix(ipToInt('93.184.216.34'), def), '任何 IP 都命中默认路由 /0')
  ok(!inPrefix(ipToInt('93.184.216.34'), p8), '外网 IP 不命中 10/8')
  // 同网段
  ok(sameSubnet(ipToInt('192.168.1.9'), ipToInt('192.168.1.1'), 24), '同 /24 网段')
  ok(!sameSubnet(ipToInt('192.168.1.9'), ipToInt('192.168.2.1'), 24), '不同 /24')
  // 非法输入抛错
  let threw = false; try { ipToInt('999.1.1.1') } catch { threw = true }
  ok(threw, '非法 IP 抛错（不静默出错值）')
}

import { sendPacket, route, longestPrefixMatch, type Topology } from '../solvers/route/forward.ts'


/** 一个小拓扑：你的电脑 → 家里路由器 → ISP → 目标服务器 */
function homeNet(withGateway = true): Topology {
  return {
    nodes: {
      pc: { id: 'pc', name: '你的电脑', ip: '192.168.1.9', subnet: '192.168.1.0/24',
        neighbors: ['gw'],
        routes: [
          route('192.168.1.0/24', null),                 // 本段直连
          ...(withGateway ? [route('0.0.0.0/0', 'gw')] : []), // 默认网关
        ] },
      gw: { id: 'gw', name: '家里路由器', ip: '192.168.1.1', subnet: '192.168.1.0/24',
        neighbors: ['pc', 'isp'],
        routes: [ route('192.168.1.0/24', null), route('0.0.0.0/0', 'isp') ] },
      isp: { id: 'isp', name: 'ISP 路由器', ip: '203.0.113.1', subnet: '203.0.113.0/24',
        neighbors: ['gw', 'srv'],
        routes: [ route('93.184.216.0/24', 'srv'), route('203.0.113.0/24', null) ] },
      srv: { id: 'srv', name: 'example.com 服务器', ip: '93.184.216.34', subnet: '93.184.216.0/24',
        neighbors: ['isp'],
        routes: [ route('93.184.216.0/24', null) ] },
    },
  }
}

export function runForward() {
  console.log('— 路由·逐跳转发 —')

  //  正常：包从电脑一跳跳送到服务器
  {
    const d = sendPacket(homeNet(), 'pc', '93.184.216.34')
    ok(d.delivered, '包成功送达服务器')
    const path = d.hops.map(h => h.at)
    ok(path[0] === 'pc' && path.includes('gw') && path.includes('isp'), `逐跳路径 ${path.join('→')}`)
    ok(d.hops[d.hops.length - 1]!.outcome === 'deliver', '最后一跳是投递')
  }

  //  ★理论核心：收件人(IP)全程不变，门牌(目标MAC)每跳都换
  {
    const d = sendPacket(homeNet(), 'pc', '93.184.216.34')
    const forwards = d.hops.filter(h => h.outcome === 'forward')
    ok(d.hops.every(h => h.dstIp === '93.184.216.34'), '收件人 IP 全程不变')
    const macs = forwards.map(h => h.dstMac)
    ok(new Set(macs).size === macs.length && macs.length >= 2, `门牌(目标MAC)每跳都换：${macs.join(' → ')}`)
    //  第一跳：电脑发往服务器，但目标 MAC 是"网关"的，不是服务器的！（那个反直觉啊哈）
    ok(d.hops[0]!.dstMac === 'MAC:gw', '第一跳门牌写的是隔壁网关(MAC:gw)，不是远方服务器')
  }

  //  ★删掉默认网关那一行 → 同网段照通、外网全断（引擎真算出不可达，不是切图）
  {
    const noGw = sendPacket(homeNet(false), 'pc', '93.184.216.34')
    ok(!noGw.delivered && noGw.failure === 'no-route', '删默认网关：外网不可达（no-route）')
    ok(noGw.hops[noGw.hops.length - 1]!.note.includes('默认网关'), '断点说明指向缺失的默认网关')
    // 但同网段还是通的
    const local = sendPacket(homeNet(false), 'pc', '192.168.1.1')
    ok(local.delivered, '删默认网关后，同网段(192.168.1.1)照样通——证明不是网断了')
  }

  //  最长前缀匹配：更具体的路由赢
  {
    const n = homeNet().nodes.isp!
    // isp 同时有 93.184.216.0/24(→srv) 和（假设加一条）默认，最具体的赢
    n.routes.push(route('0.0.0.0/0', 'gw'))
    const best = longestPrefixMatch(n, ipToInt('93.184.216.34'))
    ok(best?.prefix.text === '93.184.216.0/24', '最长前缀匹配：/24 比 /0 更具体，选 /24')
  }

  //  TTL 防打转：TTL 太小送不到
  {
    const d = sendPacket(homeNet(), 'pc', '93.184.216.34', 1)
    ok(!d.delivered && d.failure === 'ttl-expired', 'TTL=1 不够：耗尽被丢（防无限打转）')
  }
}
