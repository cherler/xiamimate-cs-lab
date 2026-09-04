/**
 * 关卡树 —— 一个"完整功能"当目标,顺着一次真实请求往下拆:
 *   目标 → 组件(谁负责) → 素材(需要什么) → 结构/字段(长什么样)。
 *
 * 每个节点都是**真东西**(抓包/教材里指得到的实体),不是抽象概念——这条纪律见记忆
 * [[ground-materials-in-real-artifacts]]。玩法:开局只显组件(灰),点进去展开下一层,
 * 点亮叶子(字段)→ 冒泡点亮父节点 → 全亮=目标达成。字段封底,比特/物理是可选深钻(暂不铺)。
 */
export type Layer = '目标' | '组件' | '素材' | '结构' | '字段'
export type LNode = {
  id: string
  name: string
  layer: Layer
  note: string          // 咕噜点亮时念的一句(教材级的真事实)
  children?: LNode[]
}
export type Level = { root: LNode; goalWhen: string }

export const LEVEL_WEBSITE: Level = {
  goalWhen: '请求发出去、200 回来了 —— 网页开了。整条链从灰点到全亮,这就是一次 https 访问的全貌。',
  root: {
    id: 'goal', name: '打开网页', layer: '目标',
    note: '在浏览器输入 https://www.example.com 到看见页面,下面五个组件全亮才通。',
    children: [
      {
        id: 'dns', name: 'DNS解析', layer: '组件',
        note: '浏览器只认 IP 不认域名:先把 www.example.com 解析成 IP。',
        children: [
          { id: 'dns.name', name: '域名', layer: '素材', note: '分层命名,从右往左越来越大。', children: [
            { id: 'dns.name.tld', name: '顶级域 .com', layer: '字段', note: '最右一段,由根和 TLD 服务器管。' },
            { id: 'dns.name.sld', name: '二级域 example', layer: '字段', note: '你注册的那一段,归它的权威服务器管。' },
            { id: 'dns.name.sub', name: '子域 www', layer: '字段', note: '最左的主机名,权威区里的一条记录。' },
          ] },
          { id: 'dns.msg', name: 'DNS查询报文', layer: '结构', note: '一个 UDP 包,发给 DNS 的 53 端口。', children: [
            { id: 'dns.msg.id', name: '事务ID', layer: '字段', note: '匹配请求和应答用的 16 位号。' },
            { id: 'dns.msg.qname', name: 'QNAME/QTYPE', layer: '字段', note: '问的是谁、要哪种记录(A=要 IPv4)。' },
            { id: 'dns.msg.rdata', name: 'RDATA', layer: '字段', note: '应答里真正的那串 IP。' },
          ] },
          { id: 'dns.cache', name: '缓存', layer: '素材', note: '查过的按 TTL 存着,没过期就不再问。' },
        ],
      },
      {
        id: 'ip', name: 'IP寻址', layer: '组件',
        note: '拿到 IP,决定这个包往哪送、下一跳交给谁。',
        children: [
          { id: 'ip.addr', name: 'IP地址', layer: '素材', note: '标识一台机器的接口。', children: [
            { id: 'ip.addr.net', name: '网络部分', layer: '字段', note: '掩码切出来的高位,定"去哪个网"。' },
            { id: 'ip.addr.host', name: '主机部分', layer: '字段', note: '低位,定"网里的哪台机"。' },
          ] },
          { id: 'ip.route', name: '路由表', layer: '素材', note: '按目的 IP 做最长前缀匹配,选出下一跳。' },
          { id: 'ip.arp', name: 'ARP', layer: '结构', note: '下一跳只认 MAC:广播问"谁是这个 IP"。', children: [
            { id: 'ip.arp.req', name: '广播请求', layer: '字段', note: '发给全网:谁有 192.168.1.1?' },
            { id: 'ip.arp.rep', name: '单播应答', layer: '字段', note: '那台机回一句:是我,MAC 是 aa:bb:…' },
          ] },
          { id: 'ip.gw', name: '默认网关', layer: '素材', note: '不在本地网的,统统交给网关出门。' },
        ],
      },
      {
        id: 'tcp', name: 'TCP连接', layer: '组件',
        note: '在不可靠的 IP 上,架一条可靠、有序的通道。',
        children: [
          { id: 'tcp.port', name: '端口', layer: '素材', note: 'IP 到机器,端口才到机器里那个程序。', children: [
            { id: 'tcp.port.src', name: '源端口', layer: '字段', note: '本机随机分一个,标识这条连接。' },
            { id: 'tcp.port.dst', name: '目的端口 443', layer: '字段', note: 'HTTPS 的约定端口。' },
          ] },
          { id: 'tcp.hs', name: '三次握手', layer: '结构', note: '两边各确认收发能力,连接才算建立。', children: [
            { id: 'tcp.hs.syn', name: 'SYN', layer: '字段', note: '客户端:我想连,我的起始序号是 x。' },
            { id: 'tcp.hs.synack', name: 'SYN-ACK', layer: '字段', note: '服务器:行,我的序号 y,确认你的 x+1。' },
            { id: 'tcp.hs.ack', name: 'ACK', layer: '字段', note: '客户端:确认你的 y+1,连接建成。' },
          ] },
          { id: 'tcp.seq', name: '序号/确认', layer: '素材', note: '每个字节编号,收到回确认,丢了重传。' },
          { id: 'tcp.win', name: '滑动窗口', layer: '素材', note: '一次能发多少,由对方缓冲和网络拥塞定。' },
        ],
      },
      {
        id: 'tls', name: 'TLS握手', layer: '组件',
        note: 'HTTP 不能裸发:先验明身份、再建加密——这就是 HTTPS 的 S。',
        children: [
          { id: 'tls.cert', name: '证书', layer: '结构', note: 'CA 签发,证明"这台确实是 example.com"。', children: [
            { id: 'tls.cert.sub', name: '主体/颁发者', layer: '字段', note: '证给谁的、谁签的。' },
            { id: 'tls.cert.pub', name: '公钥', layer: '字段', note: '服务器的公钥,用来验签、不是用来传密钥。' },
            { id: 'tls.cert.sig', name: '签名+有效期', layer: '字段', note: 'CA 的签名 + 起止时间,过期或验不过就红。' },
          ] },
          { id: 'tls.kex', name: '密钥交换 ECDHE', layer: '素材', note: '双方各出一半,算出只有彼此知道的共享密钥(不是把密钥传过去)。' },
          { id: 'tls.hello', name: '握手消息', layer: '结构', note: '协商版本和密码套件。', children: [
            { id: 'tls.hello.ch', name: 'ClientHello', layer: '字段', note: '带 SNI 说要哪个站、给出支持的套件列表。' },
            { id: 'tls.hello.sh', name: 'ServerHello', layer: '字段', note: '选定套件,给出服务器随机数。' },
            { id: 'tls.hello.fin', name: 'Finished', layer: '字段', note: '双方各发一条,握手完整性校验通过即加密开始。' },
          ] },
          { id: 'tls.suite', name: '密码套件', layer: '素材', note: '选定这条连接用哪套:密钥交换 + 加密 + 哈希。' },
        ],
      },
      {
        id: 'http', name: 'HTTP请求', layer: '组件',
        note: '通道通了,发请求、拿网页。',
        children: [
          { id: 'http.method', name: '请求方法 GET', layer: '素材', note: 'GET 表示"我要拿这个资源"。' },
          { id: 'http.url', name: 'URL', layer: '结构', note: '一条地址拆成几段。', children: [
            { id: 'http.url.scheme', name: 'scheme https', layer: '字段', note: '用哪种协议访问。' },
            { id: 'http.url.host', name: 'host', layer: '字段', note: '哪个站,也用作 TLS 的 SNI 和 HTTP 的 Host 头。' },
            { id: 'http.url.path', name: 'path/query', layer: '字段', note: '要站里的哪个资源、带什么参数。' },
          ] },
          { id: 'http.head', name: '请求头', layer: '素材', note: 'Host 说要哪个站,Cookie 带身份,Accept 说想要什么格式。' },
          { id: 'http.resp', name: '响应', layer: '结构', note: '服务器回一封信。', children: [
            { id: 'http.resp.code', name: '状态码 200', layer: '字段', note: '2xx 成功、3xx 改道、4xx 你错、5xx 我错。' },
            { id: 'http.resp.type', name: 'Content-Type', layer: '字段', note: '回的是 text/html,浏览器才知道当网页渲染。' },
            { id: 'http.resp.body', name: 'body(网页)', layer: '字段', note: '真正的 HTML,渲染出来就是你看到的页面。' },
          ] },
        ],
      },
    ],
  },
}

/** 展平+父子索引:建树时校验"某块能不能放到某节点下"用。 */
export function indexLevel(lv: Level) {
  const byId = new Map<string, LNode>()
  const parentOf = new Map<string, string>()
  const walk = (n: LNode) => {
    byId.set(n.id, n)
    for (const c of n.children ?? []) { parentOf.set(c.id, n.id); walk(c) }
  }
  walk(lv.root)
  return { byId, parentOf, all: [...byId.values()] }
}
