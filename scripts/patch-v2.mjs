import { readFileSync, writeFileSync } from 'node:fs'
const P = 'docs/design/network-graph-v2.json'
const g = JSON.parse(readFileSync(P, 'utf8'))
const R = name => { const r = g.reactions.find(x => x.output === name); if (!r) throw new Error('找不到反应: ' + name); return r }
const exists = name => g.reactions.some(x => x.output === name) || g.atoms.some(a => a.name === name)

// —— 护栏:新指向的输入节点必须已存在 ——
const need = ['共享信道', '确认号机制', 'RIP', 'TCP报文段']
const missing = need.filter(n => !exists(n))
console.log('护栏检查(新输入节点是否存在):')
for (const n of need) console.log('  ', n, exists(n) ? '✅' : '❌ 缺失')
if (missing.length) { console.log('\n中止:缺节点 ' + missing.join(', ') + ',先查真名再改。'); process.exit(2) }

// —— A. 假涌现 emergent 重写 ——
R('传播时延').emergent = '一段与"发多少数据"无关的纯路程耗时——只由线长和介质定,链路再宽也省不掉,和传输时延并列成两种独立的等待'
R('网桥').emergent = '透明桥接:只转发跨段的帧、把本段流量挡在本段,一个冲突域就此一分为二,而两端主机毫无察觉'
R('分类编址').emergent = '光看地址头几位就能判网络大小与默认掩码、不必额外带掩码;代价是只有A/B/C三种固定粒度,要么不够用要么大浪费'
R('私有地址').emergent = '同一段地址能在无数私网里重复使用、互不冲突——因为公网根本看不见它们'
R('IP地址').emergent = '可聚合、可路由的层级命名:一条前缀概括一大片、指向同一方向,正与MAC扁平、认得出人却无法指路相反'
R('SDN').emergent = '转发与控制彻底分离:数据面退化成只照流表执行,全网策略集中在控制器一处改'
R('选择确认SACK').emergent = '接收方能精确告知哪些非连续区块已收,重传只补真正缺的段,不再被累积确认"只能报到第N个"拖着重发已达数据'
R('序列化字节').emergent = '任意异构系统只要共享同一套编码,就能无歧义地还原出同一份内容——互操作性'
R('DNS迭代递归查询').emergent = '把"一路问到底"的累活从客户端卸给递归解析器,权威服务器因此能无状态地各只答一步'

// —— B. 结构:拆开流控与拥塞控制,新增"发送窗口" ——
const cc = R('拥塞控制')
cc.inputs = ['慢启动', '拥塞避免', '拥塞信号']
cc.rule = '发端自己再开一把cwnd:网络不堵就长、一堵就退(AIMD),专防淹没网络本身'
cc.form = '脚下一只cwnd油门,不堵就缓踩加速、一探到堵就猛收'
// 新增反应(插在拥塞控制之后)
const ccIdx = g.reactions.findIndex(x => x.output === '拥塞控制')
g.reactions.splice(ccIdx + 1, 0, {
  inputs: ['拥塞控制', '流量控制'],
  output: '发送窗口',
  rule: '真正能发多少=min(cwnd, rwnd):防淹网络的cwnd与防淹接收方的rwnd在此相遇,取更短的那把尺',
  emergent: '两套各管一头、互不隶属的限速在此汇成一个真正的"现在到底能发多少"',
  form: '两把尺并排——cwnd油门与rwnd翻牌——卡尺自动咬住更短的那把',
  layer: '传输层',
})

// —— C. 事实性错误 ——
R('IP首部').rule = '封面标签区:版本、源/目的IP、TTL、协议号、分片字段、首部校验和;基本20字节、带选项可到60,靠IHL字段指明多长——是变长的(定长的是IPv6那40字节基本首部)'
R('组播地址').rule = '目的=组地址(第一个字节的I/G位=1,如01:00:5E里首字节0x01的最低位),只有加入该组的网卡才收下'
R('信道容量').rule = '香农C=带宽×log2(1+信噪比);此处信噪比取线性功率比(30dB要先还原成1000倍再代入,别直接代分贝);带宽给每秒几格上限,信噪比给每格几比特上限'
const carrier = R('载波')
carrier.rule = '一条纯正弦空车,恰有幅/频/相三个可独立调制的参数'
carrier.emergent = '三个可独立调制的旋钮(其中幅/相正交成I/Q两维),后面才长出ASK/FSK/PSK'
const dig = R('数字摘要')
dig.rule = '内容过哈希得指纹一起发,收方重算比对;对不上=路上出了差错。挡得住意外损坏,但挡不住蓄意篡改——攻击者改完顺手重算指纹'
dig.emergent = '完整性:能查出意外损坏/传输差错(防篡改要等下游HMAC带上密钥)'
R('消息认证码HMAC').form = '蜡封机里先掺一把只有双方知道的密钥再压指纹,没那把钥匙就伪造不出'

// —— D. 合成/输入贴合 ——
R('受控接入').inputs = ['共享信道', '帧', '标识']
R('广播域').inputs = ['广播地址', '共享信道']
R('拥塞信号').inputs = ['定时器', '确认号机制']
R('Cookie').inputs = ['状态', '元数据', '名字']
const msg = R('报文')
msg.inputs = ['TCP连接', '元数据', '内容/数据']
msg.rule = '把TCP连续水流按边界约定(空行/Content-Length,都记在元数据里)切成有边界的信件,分首部与主体'
const cdma = R('CDMA/WDM复用')
cdma.inputs = ['载波', '比特', '介质']
cdma.rule = 'CDMA给每人一串正交码片、同频同时发,靠码字正交在收端分离;WDM=光纤(介质)上的FDM,不同波长各走一路'
R('物理链路').rule = '选介质+选线路编码(此处以自同步的曼彻斯特为代表,实际NRZ/8B10B/PAM4皆可)+做好同步+定好双工,两端各装收发器(PHY)'
const rt = R('路由器')
if (!rt.inputs.includes('RIP')) rt.inputs = [...rt.inputs, 'RIP']

// —— E. 措辞打磨 ——
R('信号').rule = '信号=电平随时间变化的函数;不变的电平携带不了信息,信息得靠随时间起伏'
R('MAC地址').rule = '一个标识+48位位串,前24位OUI后24位流水号,固化出厂烧死(ROM里的BIA;实际在用的可被软件改写,即MAC欺骗);它是扁平的,认人却无法寻路'
R('以太网').rule = '一套帧格式+一套接入布线规格;10BASE-T/1000BASE-T把规格编进型号;早期共享总线靠CSMA/CD争用,全双工交换后CSMA/CD退役'
R('网络前缀').emergent = '掩码把"分层"落到具体某一位,让一条短前缀概括一大片地址成为可能'
R('IP分组').rule = '把上层数据裹进带源/目的逻辑地址的首部,无连接每包独立选路,每段临时塞进帧投递;源/目的地址端到端不变(TTL、首部校验和每跳会变)'
R('VPN隧道').emergent = '在公网上凿出一条逻辑专用通道(私网地址跨公网可达);但机密性另需加密(密钥/IPsec),纯封装不等于安全'
R('差分曼彻斯特编码').form = '咕噜不看灯、只喊"变没变":每格起点探一脚看跳没跳,正中必跺一下续拍;线接反了也照读不误'
R('状态码').form = '四色信号灯宝石,浮着200/301/404/500(2xx绿/3xx蓝/4xx黄/5xx红)'

// —— E续:报文段→传输段 改中性名(segment 是 TCP 专有词) ——
const segRename = { from: '报文段', to: '传输段' }
if (exists(segRename.to)) throw new Error('传输段 已存在,改名会撞')
for (const r of g.reactions) {
  if (r.output === segRename.from) r.output = segRename.to
  r.inputs = r.inputs.map(i => i === segRename.from ? segRename.to : i)
}
R('传输段').rule = '贴源/目的端口(供分用)+校验封(查错),自己不认路,交给下层网络去装;这是传输层通用单元,TCP的叫TCP报文段、UDP的叫用户数据报'

writeFileSync(P, JSON.stringify(g, null, 2) + '\n', 'utf8')
console.log('\n✅ 补丁已写入。原子:', g.atoms.length, ' 反应:', g.reactions.length, '(应+1=151)')
