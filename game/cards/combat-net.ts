import type { Domain } from './combat.ts'
import { DnsSim } from '../../solvers/dns/sim.ts'

const SITE = 'www.example.com'

/**
 * 网络领域 · 6 层连接栈,每层 2 招具名攻防(12 对 = 12 条真网络知识)+ 通用工具 + 3 张关键词卡。
 * 解析 DNS → 加密 TLS → 传输 TCP → 网络 IP → 链路 ARP → 物理信号。
 */
export const NET: Domain = {
  id: 'net',
  title: '网页打不开 · 捣蛋鬼在栈里作乱',
  statusOk: '连上了 · 网页通了',
  statusBad: '连不上 · 网页打不开',
  layers: ['dns', 'tls', 'tcp', 'ip', 'link', 'phys'],
  layerInfo: {
    dns: { name: '解析 · DNS', why: '先把网址翻成 IP 门牌号,不然连都没法连' },
    tls: { name: '加密 · TLS', why: '验对方是真的、把通道加密(证书 + 密钥)' },
    tcp: { name: '传输 · TCP', why: '三次握手,双方各确认「我能收也能发」' },
    ip: { name: '网络 · IP', why: '包跨网段,靠路由表一跳跳转到目的地' },
    link: { name: '链路 · ARP', why: '本地线缆只认 MAC;ARP 拿 IP 换 MAC' },
    phys: { name: '物理 · 信号', why: '比特变电压/光,还得被对面采样回来' },
  },
  attacks: {
    poison: { layer: 'dns', name: '投毒缓存', broken: '地址本被塞了假条,翻出错地址', mode: 'break', counter: 'c-poison' },
    hijack: { layer: 'dns', name: '域名劫持', broken: '被冒充的服务器抢答,域名被劫走', mode: 'break', counter: 'c-hijack' },
    forge: { layer: 'tls', name: '伪造证书', broken: '证书是假的,握手对象根本不可信', mode: 'break', counter: 'c-forge' },
    expire: { layer: 'tls', name: '证书过期', broken: '证书过期失效,浏览器拒绝握手', mode: 'break', counter: 'c-expire' },
    block: { layer: 'tcp', name: '封端口', broken: '端口被堵,SYN 石沉大海握不上手', mode: 'break', counter: 'c-port' },
    synflood: { layer: 'tcp', name: 'SYN 洪水', broken: '半开连接塞满队列,真握手排不进去', mode: 'break', counter: 'c-synflood' },
    wipe: { layer: 'ip', name: '抹掉路由', broken: '路由表没到目的网段的路,包不知往哪走', mode: 'break', counter: 'c-route' },
    ttl: { layer: 'ip', name: 'TTL 耗尽', broken: 'TTL 被压到 0,包没到目的地就被丢', mode: 'break', counter: 'c-ttl' },
    arpspoof: { layer: 'link', name: 'ARP 欺骗', broken: '被冒充网关,拿到假 MAC,帧发错地方', mode: 'break', counter: 'c-arp' },
    macflood: { layer: 'link', name: 'MAC 洪水', broken: '交换机表被灌满,退化成广播、帧乱窜', mode: 'break', counter: 'c-macport' },
    skew: { layer: 'phys', name: '调歪光模块', broken: '偏置被拧歪,误码率飙、链路 up 不起来', mode: 'worsen', counter: 'c-skew' },
    cut: { layer: 'phys', name: '拔纤断线', broken: '光纤被拔/断,链路直接没了', mode: 'break', counter: 'c-fiber' },
  },
  cardDef: {
    'c-poison': { name: '清缓存 / 换 DNS', cost: 1, kind: 'fix', atk: 'poison', layer: 'dns', targeted: false, note: '治【投毒缓存】:丢脏缓存、走可信 DNS' },
    'c-hijack': { name: '锁定 / 换权威 DNS', cost: 1, kind: 'fix', atk: 'hijack', layer: 'dns', targeted: false, note: '治【域名劫持】:直连可信权威、拒绝抢答' },
    'c-forge': { name: '验证书链', cost: 1, kind: 'fix', atk: 'forge', layer: 'tls', targeted: false, note: '治【伪造证书】:查到受信根 CA,假证书断链' },
    'c-expire': { name: '更新证书', cost: 1, kind: 'fix', atk: 'expire', layer: 'tls', targeted: false, note: '治【证书过期】:换一张在有效期内的证书' },
    'c-port': { name: '换端口 / 放行', cost: 1, kind: 'fix', atk: 'block', layer: 'tcp', targeted: false, note: '治【封端口】:换没堵的端口 / 防火墙放行' },
    'c-synflood': { name: '限流 / SYN cookie', cost: 1, kind: 'fix', atk: 'synflood', layer: 'tcp', targeted: false, note: '治【SYN 洪水】:SYN cookie 不占队列、限流' },
    'c-route': { name: '补回路由', cost: 1, kind: 'fix', atk: 'wipe', layer: 'ip', targeted: false, note: '治【抹掉路由】:把下一跳补回路由表' },
    'c-ttl': { name: '抬高 TTL / 换近路', cost: 1, kind: 'fix', atk: 'ttl', layer: 'ip', targeted: false, note: '治【TTL 耗尽】:抬够 TTL 或换更短路径' },
    'c-arp': { name: '静态 ARP 绑定', cost: 1, kind: 'fix', atk: 'arpspoof', layer: 'link', targeted: false, note: '治【ARP 欺骗】:把网关真 MAC 写死' },
    'c-macport': { name: '端口安全 · 限 MAC', cost: 1, kind: 'fix', atk: 'macflood', layer: 'link', targeted: false, note: '治【MAC 洪水】:每口限 MAC 数、锁住表' },
    'c-skew': { name: '校准光模块', cost: 1, kind: 'fix', atk: 'skew', layer: 'phys', targeted: false, note: '治【调歪光模块】:偏置回最佳点、压误码率' },
    'c-fiber': { name: '接回 / 切备纤', cost: 1, kind: 'fix', atk: 'cut', layer: 'phys', targeted: false, note: '治【拔纤断线】:接回光纤或切到备用纤' },
    'shield': { name: '加固', cost: 1, kind: 'shield', targeted: true, note: '给某层顶住它下一击(照意图预防)' },
    'foresee': { name: '预判', cost: 0, kind: 'foresee', targeted: false, note: '看清它接下来两波破坏卡' },
    'quickfix': { name: '万能急修', cost: 2, kind: 'quickfix', targeted: true, note: '不挑招,硬修一坏层(应急、贵)' },
    'stabilize': { name: '稳压', cost: 1, kind: 'stabilize', targeted: false, note: '压住信号恶化(把恶化中的层归零)' },
    // —— 关键词卡(靠三选一收,让卡与卡/敌人破坏卡交互)——
    'k-reflect': { name: '反弹加固', cost: 2, kind: 'shield', targeted: true, kw: ['reflect'], note: '加固一层;挡下它这击→顺手抽一张(反弹)' },
    'k-taunt': { name: '嘲讽诱饵', cost: 1, kind: 'taunt', targeted: false, kw: ['taunt'], note: '布诱饵,引开它下一波的一层(Boss 连打就少挨一层)' },
    'k-chain': { name: '连锁维修', cost: 1, kind: 'quickfix', targeted: true, kw: ['chain'], note: '硬修一坏层,修好顺手再抽一张(连锁)' },
    'k-aoe': { name: '一键复位', cost: 2, kind: 'aoe', targeted: false, kw: ['aoe'], note: '一口气修好所有坏层(专治 Boss 连打)' },
    'k-buffer': { name: '抢修缓冲', cost: 1, kind: 'buffer', targeted: false, kw: ['buffer'], note: '稳住局面:断网条回退 25%' },
    'k-bulwark': { name: '全栈加固', cost: 2, kind: 'bulwark', targeted: false, kw: ['bulwark'], note: '全栈顶住它下一波(挡掉一整轮连打)' },
  },
  startDeck: ['c-poison', 'c-forge', 'c-port', 'c-route', 'c-arp', 'c-skew', 'shield', 'quickfix', 'foresee', 'stabilize'],
  rewardPool: ['c-hijack', 'c-expire', 'c-synflood', 'c-ttl', 'c-macport', 'c-fiber', 'c-poison', 'c-forge', 'c-port', 'c-route', 'c-arp', 'c-skew', 'shield', 'quickfix', 'stabilize', 'foresee', 'k-reflect', 'k-taunt', 'k-chain', 'k-aoe', 'k-buffer', 'k-bulwark'],
  // 总成败接真 DnsSim:有未修的 DNS 攻击就真注故障、真解析一次(拿到错地址=打不开);其余层走真实网络规则
  judge(snap) {
    const by = Object.fromEntries(snap.map(s => [s.key, s]))
    const dns = by.dns
    let dnsOk = true, dnsNote = 'DNS 解析正常'
    if (dns && (dns.broken || dns.decay > 0) && dns.active) {
      const sim = new DnsSim()
      sim.setFault(dns.active === 'poison' ? 'poisoned-cache' : 'hosts-hijack', SITE)
      const q = sim.query(SITE); dnsOk = q.correct
      dnsNote = q.correct ? 'DNS 解析正常' : 'DnsSim 判:解析拿到错地址,页面打不开'
    }
    const othersOk = ['tls', 'tcp', 'ip', 'link', 'phys'].every(l => { const s = by[l]; return !!s && !s.broken && s.decay < 3 })
    const ok = dnsOk && othersOk
    return { ok, metric: ok ? '整栈打通 · 网页能开' : !dnsOk ? dnsNote : '还有一层没通' }
  },
}
