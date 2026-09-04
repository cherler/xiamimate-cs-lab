// 三个画布引擎 spike 共用的 demo 树(打开网页的一段真内容,多层多枝,用来压测自动布局)
export const LAYER_COLOR = {
  目标: '#9be29b', 组件: '#ffcb7a', 素材: '#6b8cff', 结构: '#4fb6a3', 字段: '#a879d6',
}
export const BG = '#0e1524'

export const TREE = {
  id: 'goal', name: '打开网页', layer: '目标', children: [
    { id: 'dns', name: 'DNS解析', layer: '组件', children: [
      { id: 'dns.name', name: '域名', layer: '素材', children: [
        { id: 'dns.tld', name: '顶级域 .com', layer: '字段' },
        { id: 'dns.sld', name: '二级域 example', layer: '字段' },
        { id: 'dns.sub', name: '子域 www', layer: '字段' },
      ] },
      { id: 'dns.msg', name: 'DNS查询报文', layer: '结构', children: [
        { id: 'dns.id', name: '事务ID', layer: '字段' },
        { id: 'dns.qname', name: 'QNAME/QTYPE', layer: '字段' },
        { id: 'dns.rdata', name: 'RDATA', layer: '字段' },
      ] },
      { id: 'dns.cache', name: '缓存', layer: '素材' },
    ] },
    { id: 'ip', name: 'IP寻址', layer: '组件', children: [
      { id: 'ip.addr', name: 'IP地址', layer: '素材', children: [
        { id: 'ip.net', name: '网络部分', layer: '字段' },
        { id: 'ip.host', name: '主机部分', layer: '字段' },
      ] },
      { id: 'ip.route', name: '路由表', layer: '素材' },
      { id: 'ip.arp', name: 'ARP', layer: '结构', children: [
        { id: 'ip.arp.req', name: '广播请求', layer: '字段' },
        { id: 'ip.arp.rep', name: '单播应答', layer: '字段' },
      ] },
    ] },
    { id: 'tcp', name: 'TCP连接', layer: '组件', children: [
      { id: 'tcp.port', name: '端口', layer: '素材', children: [
        { id: 'tcp.src', name: '源端口', layer: '字段' },
        { id: 'tcp.dst', name: '目的端口 443', layer: '字段' },
      ] },
      { id: 'tcp.hs', name: '三次握手', layer: '结构', children: [
        { id: 'tcp.syn', name: 'SYN', layer: '字段' },
        { id: 'tcp.synack', name: 'SYN-ACK', layer: '字段' },
        { id: 'tcp.ack', name: 'ACK', layer: '字段' },
      ] },
      { id: 'tcp.seq', name: '序号/确认', layer: '素材' },
    ] },
    { id: 'tls', name: 'TLS握手', layer: '组件', children: [
      { id: 'tls.cert', name: '证书', layer: '结构', children: [
        { id: 'tls.pub', name: '公钥', layer: '字段' },
        { id: 'tls.sig', name: '签名+有效期', layer: '字段' },
      ] },
      { id: 'tls.kex', name: '密钥交换 ECDHE', layer: '素材' },
    ] },
    { id: 'http', name: 'HTTP请求', layer: '组件', children: [
      { id: 'http.get', name: '请求方法 GET', layer: '素材' },
      { id: 'http.resp', name: '响应', layer: '结构', children: [
        { id: 'http.code', name: '状态码 200', layer: '字段' },
        { id: 'http.body', name: 'body(网页)', layer: '字段' },
      ] },
    ] },
  ],
}

// 素材库示例块(spike 里演示"拖进来添加")
export const PALETTE = [
  { id: 'x.cookie', name: 'Cookie', layer: '素材' },
  { id: 'x.win', name: '滑动窗口', layer: '素材' },
  { id: 'x.gw', name: '默认网关', layer: '素材' },
  { id: 'x.suite', name: '密码套件', layer: '素材' },
]
