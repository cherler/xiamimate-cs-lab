/**
 * 打开网页的「连接栈」· 真·分层(能钻到物理层)+ 捣蛋鬼跨层对战。
 * 三合一:①敌人(捣蛋鬼)每回合往**某一层**下手、注真故障 → 对战;
 *        ②当前这招**不明说**,你得**顺着栈往下钻(inspect 每层)**、搞懂那层为什么,才认得出它打了哪层 → 分层下钻;
 *        ③每层是真状态+真判定(端口通不通/有没有路由/ARP对不对/误码率),连不连由整栈算 → 知道为什么、不玄乎。
 * 深招(物理层)= 得钻得更深才看得懂 = 更难。破坏↔对应这一对一对就是知识点。
 */
export type Layer = 'tcp' | 'ip' | 'link' | 'phys'
export const LAYERS: Layer[] = ['tcp', 'ip', 'link', 'phys'] // 从上(应用侧)往下(物理侧)

export const LAYER_INFO: Record<Layer, {
  name: string; why: string; artifact: string
  attack: string; attackHint: string    // 捣蛋鬼在这层的破坏卡
  counter: string; counterName: string   // 你在这层的对应卡
}> = {
  tcp: {
    name: '传输 · TCP 握手', why: '双方各确认一次"我能收也能发"(三次握手),连接才算建立', artifact: 'SYN / SYN-ACK / ACK',
    attack: '封端口', attackHint: '把目标端口堵上,SYN 发出去石沉大海', counter: 'open-port', counterName: '换个开放端口 / 放行',
  },
  ip: {
    name: '网络 · IP 路由', why: '包要跨网段,靠路由表一跳跳转到目的地(TTL 防止绕死)', artifact: '目的 IP · 下一跳 · TTL',
    attack: '抹掉路由', attackHint: '把去目的网段的路由条目删了,包不知往哪走', counter: 'fix-route', counterName: '补回路由',
  },
  link: {
    name: '链路 · ARP/MAC', why: '到了本地线缆,网卡只认硬件地址 MAC、不认 IP;ARP 拿 IP 换 MAC', artifact: 'ARP · MAC · 以太帧',
    attack: 'ARP 欺骗', attackHint: '冒充网关,把下一跳的 MAC 换成假的', counter: 'static-arp', counterName: '静态 ARP 绑定',
  },
  phys: {
    name: '物理 · 信号', why: '比特要变成介质上的电压/光,还得能被对面采样回来(编码为了抗噪+恢复时钟)', artifact: '误码率 BER · 信号质量',
    attack: '调歪光模块', attackHint: '把偏置电流拧歪,信噪比掉、误码率飙', counter: 'recalibrate', counterName: '校准光模块',
  },
}
export const COUNTER_LAYER: Record<string, Layer> = { 'open-port': 'tcp', 'fix-route': 'ip', 'static-arp': 'link', 'recalibrate': 'phys' }

const BER_OK = 0.001, BER_BAD = 0.2, BER_MAX = 0.01
// 差异化计时:下探便宜(你在诊断)、对上适中、挡错方向贵、干等一般
const COST_INSPECT = 3, COST_RIGHT = 8, COST_WRONG = 26, COST_WAIT = 15
/** 攻击只报"半栈区域",逼你钻进去认是哪层——不明说、不报菜名。 */
function region(l: Layer): string { return l === 'tcp' || l === 'ip' ? '上半栈(传输 / 网络)' : '下半栈(链路 / 物理)' }

export type StackView = {
  title: string
  connected: boolean; statusText: string
  morale: number; moraleMax: number
  attackRegion: string | null          // 现在这招落在哪半栈(只报区域,逼你钻进去认是哪层)
  intentLayer: Layer | null            // 下一招"盯上哪层"(只到层,不明说哪招)
  intentName: string | null            // 下一招那层的名字(给 UI 直接显示)
  clock: number; clockLabel: string; clockHint: string
  layers: { key: Layer; name: string; known: boolean; broken: boolean; reading: string | null; why: string }[]
  hand: { id: string; kind: 'inspect' | 'counter' | 'wait'; name: string; note: string; layer?: Layer }[]
  events: string[]
  won: boolean; lost: boolean
}

export class StackBattle {
  // 每层的真状态
  portOpen = true; hasRoute = true; arpGood = true; ber = BER_OK
  attacks: Layer[]                       // 捣蛋鬼这场要打的层序列(外部随机排,防刷)
  cursor = 0; beaten = 0
  downtime = 0; turn = 0
  won = false; lost = false
  known = new Set<Layer>()               // 已下探看过的层
  events: string[] = []

  constructor(attacks: Layer[]) {
    this.attacks = attacks.length ? attacks : ['link']
    this.hit(this.attacks[0]!) // 开场第一招已经打出来了(但打的哪层不明说,得你钻)
  }
  private hit(l: Layer): void {
    if (l === 'tcp') this.portOpen = false
    else if (l === 'ip') this.hasRoute = false
    else if (l === 'link') this.arpGood = false
    else this.ber = BER_BAD
  }
  private heal(l: Layer): void {
    if (l === 'tcp') this.portOpen = true
    else if (l === 'ip') this.hasRoute = true
    else if (l === 'link') this.arpGood = true
    else this.ber = BER_OK
  }
  /** 每层是否通过(真判定);物理坏则底层就断,整条连不上。 */
  private pass(l: Layer): boolean {
    if (l === 'phys') return this.ber < BER_MAX
    if (l === 'link') return this.arpGood
    if (l === 'ip') return this.hasRoute
    return this.portOpen
  }
  private brokenLayer(): Layer | null { return LAYERS.find(l => !this.pass(l)) ?? null }
  connected(): boolean { return LAYERS.every(l => this.pass(l)) }

  private reading(l: Layer): string {
    if (l === 'tcp') return this.portOpen ? '端口开着·SYN 有回应,握手成' : '端口不通·SYN 石沉大海,握不上手'
    if (l === 'ip') return this.hasRoute ? '有路由·下一跳 192.168.1.1' : '路由表里没有到目的网段的路,包不知往哪走'
    if (l === 'link') return this.arpGood ? 'ARP 正常·下一跳 MAC 对得上' : 'ARP 被冒充·拿到的 MAC 是假的,帧发错地方'
    return `误码率 ${(this.ber * 100).toFixed(1)}%·${this.ber >= BER_MAX ? '太高,帧一直校验错、链路 up 不起来' : '正常'}`
  }

  hand() {
    const inspects = LAYERS.map(l => ({ id: `see-${l}`, kind: 'inspect' as const, name: `看${LAYER_INFO[l].name.split(' · ')[1]}`, note: '下探这一层,看它真状态', layer: l }))
    const counters = LAYERS.map(l => ({ id: LAYER_INFO[l].counter, kind: 'counter' as const, name: LAYER_INFO[l].counterName, note: `修这一层:${LAYER_INFO[l].name.split(' · ')[1]}`, layer: l }))
    return [...inspects, ...counters, { id: 'wait', kind: 'wait' as const, name: '缓一手', note: '不出手先扛一回合(断网会涨)' }]
  }

  play(cardId: string): StackView {
    if (this.won || this.lost) return this.view()
    this.events = []
    let cost = COST_WAIT
    if (cardId === 'wait') this.events.push('缓了一手…')
    else if (cardId.startsWith('see-')) { const l = cardId.slice(4) as Layer; this.known.add(l); this.events.push(`下探「${LAYER_INFO[l].name}」→ ${this.reading(l)}`); cost = COST_INSPECT }
    else if (COUNTER_LAYER[cardId]) {
      const l = COUNTER_LAYER[cardId]!, broke = this.brokenLayer()
      if (broke === l) {
        this.heal(l); this.known.add(l); this.beaten++; this.cursor++; cost = COST_RIGHT
        this.events.push(`「${LAYER_INFO[l].counterName}」对上了!挡回它在【${LAYER_INFO[l].name}】的这招,士气 −1`)
        const nxt = this.cursor < this.attacks.length ? this.attacks[this.cursor]! : null
        if (nxt) { this.hit(nxt); this.events.push(`捣蛋鬼又往【${region(nxt)}】动了手脚——钻下去找是哪层、为什么`) }
        else this.events.push('捣蛋鬼没招了,灰溜溜跑了!')
      } else { cost = COST_WRONG; this.events.push(`「${LAYER_INFO[l].counterName}」这层没坏,白折腾(断网飙升)`) }
    }
    this.turn++
    if (!this.connected()) this.downtime = Math.min(100, this.downtime + cost)
    if (this.downtime >= 100) this.lost = true
    else if (this.beaten >= this.attacks.length && this.connected()) this.won = true
    return this.view()
  }

  view(): StackView {
    const nextI = this.cursor + 1, next = nextI < this.attacks.length ? this.attacks[nextI]! : null
    return {
      title: '网页打不开 · 捣蛋鬼在栈里作乱',
      connected: this.connected(), statusText: this.connected() ? '连上了 · 网页通了' : '连不上 · 网页打不开',
      morale: Math.max(0, this.attacks.length - this.beaten), moraleMax: this.attacks.length,
      attackRegion: this.won || this.connected() ? null : region(this.brokenLayer()!),
      intentLayer: this.won ? null : next,
      intentName: next ? LAYER_INFO[next].name : null,
      clock: Math.round(this.downtime), clockLabel: '断网', clockHint: '全家都在等,满了就算被它得逞',
      layers: LAYERS.map(l => ({ key: l, name: LAYER_INFO[l].name, known: this.known.has(l), broken: this.known.has(l) && !this.pass(l), reading: this.known.has(l) ? this.reading(l) : null, why: LAYER_INFO[l].why })),
      hand: this.hand(), events: [...this.events], won: this.won, lost: this.lost,
    }
  }
}
