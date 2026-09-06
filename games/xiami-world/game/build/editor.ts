/**
 * 「搭机器」核心引擎 v1(灰盒)。Zachtronics/Opus Magnum 那一挂:摆零件→接线→按运行→包自己流→对照规格判对错、按零件/拍数评分。
 * 关卡系统:每关一个规格 + 一套解锁的零件。第1关分包转发(传送带+分流器);第2关复制/广播(新零件复制器)。
 * 深度来自设计与最优化,不是手速。先灰盒验好玩,再上绘本美术。
 */
import cutUrl from '../../web/assets/gen/home/house-cutaway.webp'
import routerUrl from '../../web/assets/gen/home/router.webp'
import corrUrl from '../../web/assets/gen/gates/corridor.webp'
import { sfx } from '../demo/sfx'
import { mountHub, type Hub } from '../hub'
import { makeKit, BRASS, STEEL, VIOLET, GOLD, GREEN } from './kit'
let HUB: Hub | null = null
const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
const IMG = (u: string) => { const i = new Image(); i.src = u; return i }
const CUT = IMG(cutUrl), ROUTER = IMG(routerUrl), CORR = IMG(corrUrl)
const iready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0
let introRouter = { x: 0, y: 0, w: 0, h: 0 } // 房子里那台路由器的可点区域(renderIntro 里更新)
let introCpu = { x: 0, y: 0, w: 0, h: 0 }    // 书房那台电脑 —— 点进去是第二台机器(CPU 流水线,另一个页面)
/** 同目录下的另一个页面。相对当前文档解析,所以 /lab/world/ 与本地 dev 都对。 */
const pageUrl = (f: string) => new URL(f, location.href).href
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
//  画布上面还有一条「虾米课堂」外壳条,所以量画布自己的尺寸 —— 读 innerHeight 会多算 36px
function resize() { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()

const COLS = 12, ROWS = 8
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1] // 0右 1下 2左 3上
const SHAPE_COL = ['#e0954b', '#5b8def', '#3fa78f']
const TEAL = '#49a791', AMBER = '#e8c98a', CREAM = '#efe6d2', RED = '#c8452e', BLUE = '#5b8def'
type Dir = 0 | 1 | 2 | 3
type Kind = 'belt' | 'router' | 'copier' | 'cache' | 'queue' | 'arouter' | 'prefix' | 'mask' | 'nat' | 'acl'
type Piece = { kind: Kind; dir: Dir; mode: number; seen?: Set<number>; store?: number[]; next?: number }
const QUEUE_MODES = ['限速', '排序'] // 缓冲队列两种放法:限速=每拍放1个(先到先出,安全默认) / 排序=按号重排(缺号会等)
/* 前缀匹配器:一条路由条目 = 一个前缀模式(从最高位写起,'*'=不管这一位)。
   匹配上就拐弯进本条路由的网段,没匹配就直行交给下一条。
   **最长前缀匹配在传送带上就是「顺序」**:更具体的条目摆在上游先匹配;
   把 /0 默认路由摆前面,它会把所有包一口吞掉 —— 这正是这一关要让你踩的坑。 */
function prefixHit(pat: string, num: number, nbits: number) {
  for (let i = 0; i < pat.length; i++) {
    const ch = pat[i]!; if (ch === '*') continue
    const bit = (num >> (nbits - 1 - i)) & 1
    if (bit !== (ch === '1' ? 1 : 0)) return false
  }
  return true
}
const levelRoutes = () => LEVELS[lvl]?.routes ?? []
/* 访问控制(家用路由器上叫「家长控制 / 上网限制」):规则表从上往下,**第一条匹配的就生效**。
   〈前缀匹配〉命中 = 放行(拐弯走放行道,后面的规则不再看它);
   〈访问控制〉命中 = 「当场拦下」(没有出口 —— 包是真的被丢掉,不是送去某个口)。
   于是「例外必须写在通配之前」:把 10* 的拦截摆在 101 的放行前面,那条例外永远轮不上。 */
/* NAT:家用路由器的立身之本,而且它做的事**就是改写包头**——
   出方向:内网各机的私网地址统统换成同一个公网地址(对外看起来只有一台),同时把这条会话记下来;
   回程:回包带着会话号,按会话表**还原**成当初那台机器的私网地址;
   **会话表里查不到的回包直接丢** —— 这正是"外网主动连不进来"的原因,NAT 天生就是道墙。 */
const natOut = () => LEVELS[lvl]?.natPub !== undefined
function natMap(num: number) {
  const L = LEVELS[lvl]!
  if (L.natPub !== undefined) return L.natPub          // 出方向:一律改写成公网地址
  return L.natTable?.[num] ?? -1                        // 回程:查会话表,-1 = 没建过这条会话
}
/* 掩码判断器:子网掩码 /n 的**真正用处**——先算「对方跟我是不是同一个网段」。
   把两边地址都按掩码盖住(只留高 n 位)比一下:一样=同网段,直接送本地;不一样=交给网关。
   掩码取长取短都会错,而且错得不一样:太短→外网地址被误当本地;太长→本地地址被误送网关。 */
const maskLen = (mode: number) => mode + 1                     // mode 0 → /1
function sameNet(num: number, localNet: number, n: number, nbits: number) {
  const shift = Math.max(0, nbits - n)
  return (num >> shift) === (localNet >> shift)
}
const grid: (Piece | null)[][] = Array.from({ length: ROWS }, () => Array<Piece | null>(COLS).fill(null))
const leftOf = (d: Dir) => ((d + 3) % 4) as Dir
const rightOf = (d: Dir) => ((d + 1) % 4) as Dir
// 可编程路由器:每种形状(△□○)走哪个前向出口 —— 0=左 1=直 2=右;右键循环模式
const ROUTER_MODES: { name: string; map: number[] }[] = [
  { name: '三向分拣', map: [0, 1, 2] }, // △左 □直 ○右
  { name: '△挑向左', map: [0, 1, 1] }, // △左 · 其余直
  { name: '□挑向左', map: [1, 0, 1] }, // □左 · 其余直
  { name: '○挑向右', map: [1, 1, 2] }, // ○右 · 其余直
  { name: '反向分拣', map: [2, 1, 0] }, // △右 □直 ○左
]

// —— 关卡 ——
type Sink = { r: number; accept: number; need: number; label?: string; ordered?: boolean; rate?: number; addr?: number; addrs?: number[] }
type Src = { r: number; seq: number[] }
type Level = { name: string; hint: string; srcRow: number; seq: number[]; sinks: Sink[]; parts: Kind[]; par: { parts: number; cycles: number }; burst?: boolean; finale?: boolean; sandbox?: boolean; sources?: Src[]; collide?: boolean; gap?: number; showAddr?: boolean; routes?: { pat: string }[]; localNet?: number; natPub?: number; natTable?: number[]; drops?: number }
const LEVELS: Level[] = [
  // 全部关卡都用**真地址**(包上印着二进制),不再用 △□○ 这类指不到实体的抽象形状。
  // —— 一、按地址转发:一位一位地看 ——
  { name: '真·路由器 · 先认一位', hint: '入门先熟悉一台:每个包带一个地址(0 或 1,信封上有二进制)。〈地址路由〉盯住地址二进制的最右一位(第 0 位)—— 是 0 走直去网段0,是 1 拐弯去网段1。就一台,看清它怎么"按一位分两路"', srcRow: 3, seq: [0, 1, 0, 1, 1, 0], showAddr: true, sinks: [{ r: 3, addr: 0, accept: -1, need: 3, label: '网段0' }, { r: 1, addr: 1, accept: -1, need: 3, label: '网段1' }], parts: ['belt', 'arouter'], par: { parts: 12, cycles: 20 } },
  { name: '真·路由器 · 按址转发', hint: '每个包带一个 2 位目的地址(0~3),要送到对应网段 —— 一台〈地址路由〉只看某一位(右键选看第几位:该位=0 走直、=1 拐弯)。把几台串成一棵转发树:先看高位分两支、再看低位,把四个地址各归各网段', srcRow: 3, seq: [0, 1, 2, 3, 0, 1, 2, 3], showAddr: true, sinks: [{ r: 4, addr: 0, accept: -1, need: 2, label: '网段0' }, { r: 3, addr: 1, accept: -1, need: 2, label: '网段1' }, { r: 1, addr: 2, accept: -1, need: 2, label: '网段2' }, { r: 0, addr: 3, accept: -1, need: 2, label: '网段3' }], parts: ['belt', 'arouter'], par: { parts: 16, cycles: 28 } },
  { name: '真·路由器 · 默认路由', hint: '地址 0~3 有各自网段;可现在还来了本机不认识的地址(4~7)—— 它们一律走「默认口(外网网关)」。真路由器就这样:先看最高位,置 1 的(≥4)没有具体路由,全甩给默认路由 0.0.0.0/0;置 0 的再按低位细分', srcRow: 4, seq: [0, 5, 1, 6, 2, 7, 3, 4], showAddr: true, sinks: [{ r: 4, addr: 0, accept: -1, need: 1, label: '网段0' }, { r: 3, addr: 1, accept: -1, need: 1, label: '网段1' }, { r: 2, addr: 2, accept: -1, need: 1, label: '网段2' }, { r: 1, addr: 3, accept: -1, need: 1, label: '网段3' }, { r: 0, addr: -1, accept: -1, need: 4, label: '默认口·外网' }], parts: ['belt', 'arouter'], par: { parts: 22, cycles: 32 } },
  { name: '真·路由器 · 最长前缀匹配', hint: '同一个地址,路由表里好几条都能匹配(101 既符合 101、也符合 10*、也符合 1**)—— 真路由器永远选「最具体」那条。〈前缀匹配〉右键切条目:命中→拐弯进本网段,没命中→直行交给下一条;一路没人认领的,直行到底进「默认口」(这就是 0.0.0.0/0)。诀窍:越具体的条目摆得越靠上游 —— 把 1** 摆前面,101 和 10* 的包会被它提前吞掉', srcRow: 3, seq: [5, 4, 6, 0, 7, 3], showAddr: true, routes: [{ pat: '101' }, { pat: '10*' }, { pat: '1**' }], sinks: [{ r: 0, accept: -1, need: 1, addrs: [5], label: '101 · 精确' }, { r: 1, accept: -1, need: 1, addrs: [4], label: '10* · 网段' }, { r: 2, accept: -1, need: 2, addrs: [6, 7], label: '1** · 网段' }, { r: 3, accept: -1, need: 2, addrs: [0, 3], label: '默认口 · 0.0.0.0/0' }], parts: ['belt', 'prefix'], par: { parts: 36, cycles: 24 } },
  { name: '真·路由器 · 子网掩码', hint: '本机在 010 这个网段。要送出去之前,先问一句「对方跟我同网段吗」—— 用〈掩码判断〉:两边地址都按掩码盖住、只留高 n 位比一比,一样就直接送本地口,不一样交给网关口。右键调掩码长度 /1~/3:调短了外网地址会被误当本地,调长了本机同伴又会被误送网关,只有一个长度是对的', srcRow: 3, seq: [2, 0, 3, 5, 1, 6], showAddr: true, localNet: 2, sinks: [{ r: 2, accept: -1, need: 2, addrs: [2, 3], label: '本地口 · 同网段' }, { r: 3, accept: -1, need: 4, addrs: [0, 1, 5, 6], label: '网关口 · 去外网' }], parts: ['belt', 'mask'], par: { parts: 20, cycles: 26 } },
  // —— 二、发出去之前:先问到硬件地址(ARP)——
  { name: '真·ARP · 先问到 MAC', hint: '知道 IP 还送不出去 —— 链路上认的是 MAC。〈ARP 缓存〉记的是"这个 IP 我问过没":「没问过的」走「ARP 查询口」(广播喊一嗓子谁是它),「问过的」直接走「直送口」。同一个 IP 只该问一次,后面全走直送', srcRow: 3, seq: [2, 5, 2, 2, 5, 2], showAddr: true, sinks: [{ r: 1, accept: -1, need: 4, label: '直送口 · 已知 MAC' }, { r: 5, accept: -1, need: 2, label: 'ARP 查询口 · 广播问' }], parts: ['belt', 'cache'], par: { parts: 18, cycles: 24 } },
  { name: '真·交换机 · 泛洪', hint: '交换机还没学到这个 MAC 挂在哪个口 —— 只能「泛洪」:除了来的那个口,每个口都发一份,谁是主人谁应答。用〈复制器〉把包复制成两份,两个口各送一份', srcRow: 3, seq: [4, 4, 4, 4], showAddr: true, sinks: [{ r: 1, accept: -1, need: 4, label: '口1 · 泛洪' }, { r: 5, accept: -1, need: 4, label: '口2 · 泛洪' }], parts: ['belt', 'copier'], par: { parts: 18, cycles: 24 } },
  { name: '真·交换机 · MAC 表自学习', hint: '交换机不会一直泛洪 —— 头一个包泛出去之后,它就从应答里学到这个 MAC 挂在哪个口,记进 MAC 表;之后再发给它,只往那一个口送。用〈MAC 表〉(没学过→直行去泛洪、学过→拐弯走直送道),把「第一个包泛到三个口、后面三个只进主机那个口」搭出来 —— 看两个旁口的计数:学会之后,它们再也收不到了', srcRow: 3, seq: [4, 4, 4, 4], showAddr: true, sinks: [{ r: 2, accept: -1, need: 4, label: '主机口 · MAC 4' }, { r: 4, accept: -1, need: 1, label: '旁口A · 只在泛洪时' }, { r: 6, accept: -1, need: 1, label: '旁口B · 只在泛洪时' }], parts: ['belt', 'cache', 'copier'], par: { parts: 30, cycles: 20 } },
  // —— 三、出口顶不住的时候 ——
  // —— 四、NAT:家用路由器的立身之本(它做的事就是改写包头)——
  { name: '真·NAT · 对外只有一个地址', hint: '家里三台机器(私网地址 1/2/3)要上网,可 ISP 只给了你「一个」公网地址。〈NAT〉出方向把每个包的源地址统统改写成公网地址 0,并把这条会话记下来 —— 于是外面看起来,你家只有一台机器在上网', srcRow: 3, seq: [1, 2, 3, 1, 2, 3], showAddr: true, natPub: 0, sinks: [{ r: 3, accept: -1, need: 6, addrs: [0], label: '公网口 · 全是地址0' }], parts: ['belt', 'nat'], par: { parts: 12, cycles: 22 } },
  { name: '真·NAT · 回包怎么找回原主', hint: '回包只写着公网那一侧的「会话号」,可它到底该给家里哪台机器?〈NAT〉查会话表还原成私网地址(会话0→机器1、1→机器2、2→机器3),再用〈地址路由〉送到各自机器。会话表里查不到的(会话3,外面主动找上门的)直接丢掉 —— 这就是外网连不进你家的原因', srcRow: 3, seq: [0, 1, 2, 3, 0, 1], showAddr: true, natTable: [1, 2, 3, -1], drops: 1, sinks: [{ r: 3, addr: 1, accept: -1, need: 2, label: '机器1' }, { r: 2, addr: 2, accept: -1, need: 2, label: '机器2' }, { r: 1, addr: 3, accept: -1, need: 1, label: '机器3' }], parts: ['belt', 'nat', 'arouter'], par: { parts: 24, cycles: 26 } },
  // —— 五、放不放行:访问控制(家用路由器上的「家长控制」)——
  { name: '真·路由器 · 访问控制', hint: '不是所有包都该放出去。规则表两条:①放行 101(这台设备是例外) ②拦截 10*(这个网段禁止上网)。〈前缀匹配〉命中=放行(拐弯走放行道、后面的规则不再看它),〈访问控制〉命中=「当场拦下」(它没有出口,包是真的被丢掉)。谁都没匹配上的,直行到底照常出网。规则表从上往下第一条匹配即生效 —— 例外要是摆在通配后面,它永远轮不上', srcRow: 3, seq: [5, 4, 5, 6, 4, 5], showAddr: true, routes: [{ pat: '101' }, { pat: '10*' }], drops: 2, sinks: [{ r: 3, accept: -1, need: 4, label: '放行口 · 出网' }], parts: ['belt', 'prefix', 'acl'], par: { parts: 13, cycles: 24 } },
  // —— 六、出口顶不住的时候 ——
  { name: '真·路由器 · 出口拥塞', hint: '一峰包同拍涌到,可每个出口每拍只发得出 1 个 —— 直接怼过去就丢包。先用〈地址路由〉按地址分开,各接一个〈缓冲队列〉切「限速」削成 1/拍,一个都别丢', srcRow: 3, seq: [0, 1, 0, 1], showAddr: true, burst: true, sinks: [{ r: 1, addr: 1, accept: -1, need: 2, rate: 1, label: '网段1 · 每拍1' }, { r: 5, addr: 0, accept: -1, need: 2, rate: 1, label: '网段0 · 每拍1' }], parts: ['belt', 'arouter', 'queue'], par: { parts: 22, cycles: 22 } },
  // —— 七、终关:一次完整的转发,把学过的串成一台真机器 ——
  /* 终关 = 真路由器**出方向的整条转发路**,顺序就是真机器里的顺序:
     判同网段 → 查路由表 → 出向访问控制 → NAT 改写 → 出口排队 → 上公网。
     一峰同拍涌到(burst),而公网口是家里最慢的那条链路(rate 1)—— 所以队列不是装饰,不接就丢包。 */
  { name: '终关 · 一次完整转发', hint: '把学过的全串成一台真路由器,顺序就是真机器里的顺序:①〈掩码判断〉问「跟我同网段吗」—— 同网段(010/011)直接进本地口,不出门 ②〈前缀匹配〉查路由表,10* 的去网段A ③〈访问控制〉把禁止上网的 00* 当场拦下 ④〈NAT〉把剩下的源地址统统改写成公网地址 0 ⑤公网口是家里最慢的那条链路(每拍只发得出 1 个),先接〈缓冲队列〉切「限速」削峰,一个都别丢', srcRow: 3, seq: [2, 4, 6, 0, 3, 5, 7, 1], showAddr: true, burst: true, localNet: 2, natPub: 0, drops: 2, routes: [{ pat: '10*' }, { pat: '00*' }, { pat: '11*' }], sinks: [{ r: 0, accept: -1, need: 2, addrs: [2, 3], label: '本地口 · 同网段' }, { r: 1, accept: -1, need: 2, addrs: [4, 5], label: '网段A · 10*' }, { r: 3, accept: -1, need: 2, rate: 1, addrs: [0], label: '公网口 · NAT已改写' }], parts: ['belt', 'mask', 'prefix', 'acl', 'nat', 'queue'], par: { parts: 32, cycles: 18 }, finale: true },
]
let lvl = 0
let SOURCES: Src[] = [{ r: LEVELS[0]!.srcRow, seq: LEVELS[0]!.seq }]
let SINKS: Sink[] = LEVELS[0]!.sinks
function isSource(r: number, c: number) { return c === 0 && SOURCES.some(s => s.r === r) }
function editable(r: number, c: number) { return c > 0 && c < COLS - 1 && r >= 0 && r < ROWS }
function trayItems(): (Kind | 'erase')[] { return [...LEVELS[lvl]!.parts, 'erase'] }
function loadLevel(i: number) { lvl = Math.max(0, Math.min(LEVELS.length - 1, i)); const L = LEVELS[lvl]!; SOURCES = L.sources ?? [{ r: L.srcRow, seq: L.seq }]; SINKS = L.sinks; for (const row of grid) row.fill(null); resetSim(); tool = L.parts[0]!; enterFade = 1; celebrate = 0; resultT = 0 }
const STORY = [
  '先认一台路由器 —— 它只看地址的一位,是 0 走直、是 1 拐弯,就把两个地址分开了。',
  '包上写着目的地址 —— 像真路由器那样搭一棵转发树,一位一位地看,把每个地址送到它该去的网段。',
  '还来了本机不认识的地址 —— 真路由器给它们留了条默认路由,不认识的一律甩给外网网关。',
  '同一个地址,路由表里好几条都能匹配 —— 真路由器只认最具体的那条。越具体的摆得越靠上游,别让默认路由抢在前面。',
  '要发包之前先得判断:对方跟我是不是同一个网段?掩码盖住高几位一比就知道 —— 同网段直接送,不同的交给网关。',
  '知道 IP 还不够,链路上认的是 MAC —— 没问过的先广播问一次,问到了就记下来,后面直接送。',
  '交换机还不知道这个 MAC 挂在哪个口 —— 先泛洪,每个口都发一份,谁是主人谁应答。',
  '泛过一次它就学会了 —— MAC 表记下这个地址挂在哪个口,之后只发那一个口,旁边的口再也收不到。',
  '家里三台机器,ISP 只给一个公网地址 —— NAT 把源地址统统改写成那一个,外面看起来你家只有一台。',
  '回包只写着会话号,得查表才知道该给谁 —— 查不到的(外面主动找上门的)直接丢,这就是外网进不来的原因。',
  '不是所有包都该放出去 —— 规则表从上往下,第一条匹配的就生效;例外要是排在通配后面,它永远轮不上。',
  '出口顶不住了 —— 先按地址分开,再各自排队限速,一个包都别丢。',
  '最后一里:判同网段 → 查路由表 → 访问控制放不放行 → NAT 改写 → 出口排队上公网。整条路都在这一屏里。',
]

type Best = { parts: number; cycles: number }
let mode: 'intro' | 'menu' | 'play' = 'intro'
let best: Record<number, Best> = {}
try { best = JSON.parse(localStorage.getItem('buildgame.best') || '{}') } catch { }
//  存盘交给课堂外壳:它同时管本机与账号同步。老键 buildgame.best 仍在启动时读一次,老存档不丢。
function saveBest() { HUB?.save() }
let bgmStarted = false, musicMuted = false
try { musicMuted = localStorage.getItem('buildgame.muted') === '1' } catch { }
function ensureBgm() { if (musicMuted) { sfx.setMuted(true); return } if (!bgmStarted) { sfx.startBgm(); bgmStarted = true } sfx.setMuted(false) }
function toggleMusic() { musicMuted = !musicMuted; try { localStorage.setItem('buildgame.muted', musicMuted ? '1' : '0') } catch { } ensureBgm(); sfx.blip() }
const passed = (i: number) => best[i] !== undefined
//  现在每一关都是真地址关(showAddr 人人都有),再拿它当解锁条件就等于全解锁 —— 只留沙盒例外
const unlocked = (i: number) => i === 0 || passed(i - 1) || !!LEVELS[i]?.sandbox

// —— 仿真 ——
type Pkt = { r: number; c: number; ar: number; ac: number; shape: number; num: number }
let running = false, done = false, pass = false, overflowed = false, stuck = false
let step = 0, acc = 0, tprev = 0, celebrate = 0, enterFade = 0, resultT = 0
let emittedPer: number[] = [0], collided = false
let collisionFlash: { r: number; c: number; t: number }[] = []
const allEmitted = () => SOURCES.every((s, i) => (emittedPer[i] ?? 0) >= s.seq.length)
let delivered = 0, wrong = 0, lost = 0
/*  **按规矩丢掉**的包:NAT 查不到会话(外面主动找上门的)、访问控制命中拦截规则。
    这类"丢"是**正确行为**,不能和"接错线丢了"混为一谈,所以单独记一笔,
    通关判定要求:丢的总数 == 按规矩丢的 == 这一关本就该丢的那么多。 */
let okDrop = 0
let deliveredBy: number[] = SINKS.map(() => 0)
let oexp: number[] = SINKS.map(() => 0) // 按序口:下一个该到的序号
let pkts: Pkt[] = []
const STEP_MS = 240, EMIT_GAP = 2
function partCount() { let n = 0; for (const row of grid) for (const p of row) if (p) n++; return n }
function resetSim() { running = false; done = false; pass = false; overflowed = false; stuck = false; collided = false; collisionFlash = []; step = 0; emittedPer = SOURCES.map(() => 0); acc = 0; delivered = 0; wrong = 0; lost = 0; okDrop = 0; deliveredBy = SINKS.map(() => 0); oexp = SINKS.map(() => 0); pkts = []; for (const row of grid) for (const p of row) if (p) { if (p.kind === 'cache') p.seen = new Set(); if (p.kind === 'queue') { p.store = []; p.next = 0 } } }
function run() { resetSim(); running = true; sfx.run() }
function exits(r: number, c: number, shape: number, num = 0): Dir[] {
  if (isSource(r, c)) return [0]
  const p = grid[r]![c]; if (!p) return []
  if (p.kind === 'belt') return [p.dir]
  if (p.kind === 'router') { const m = ROUTER_MODES[p.mode] ?? ROUTER_MODES[0]!; return [[leftOf(p.dir), p.dir, rightOf(p.dir)][m.map[shape]!]!] } // 可编程路由器:按形状查表转发
  if (p.kind === 'arouter') { const bit = (num >> p.mode) & 1; return [bit ? leftOf(p.dir) : p.dir] } // 地址路由器:看地址第 mode 位,0→直行 1→拐弯(串成转发树)
  if (p.kind === 'nat') { return natMap(num) < 0 ? [] : [p.dir] }   // 回程查不到会话 → 无出口 → 丢弃
  if (p.kind === 'acl') { const pat = levelRoutes()[p.mode]?.pat ?? '*'; return prefixHit(pat, num, addrBits()) ? [] : [p.dir] } // 命中拦截规则 → 无出口 → 真的丢掉;没命中 → 直行交给下一条
  if (p.kind === 'mask') { const L = LEVELS[lvl]!; return [sameNet(num, L.localNet ?? 0, maskLen(p.mode), addrBits()) ? leftOf(p.dir) : p.dir] } // 同网段→拐弯进本地口,不同→直行交给网关
  if (p.kind === 'prefix') { const pat = levelRoutes()[p.mode]?.pat ?? '*'; return [prefixHit(pat, num, addrBits()) ? leftOf(p.dir) : p.dir] } // 前缀匹配器:命中→拐弯进本网段,未命中→直行给下一条
  if (p.kind === 'copier') return [leftOf(p.dir), rightOf(p.dir)] // T 型分叉:朝右=左进、上下各一份(两个垂直出口)
  // cache:没见过→dir(去查号),见过→leftOf(走快线)
  //  缓存盒:带地址的关卡按**地址**记(ARP 缓存记的是"这个 IP 我查过没"),否则按形状
  if (!p.seen) p.seen = new Set()
  const key = LEVELS[lvl]?.showAddr ? num : shape
  if (p.seen.has(key)) return [leftOf(p.dir)]
  p.seen.add(key); return [p.dir]
}
function buffersEmpty() { for (const row of grid) for (const p of row) if (p && p.kind === 'queue' && p.store && p.store.length > 0) return false; return true }
function simStep() {
  step++
  const L = LEVELS[lvl]!
  if (L.burst) { if (step === 1) SOURCES.forEach((src, i) => { for (const num of src.seq) pkts.push({ r: src.r, c: 0, ar: src.r, ac: 0, shape: num % 3, num }); emittedPer[i] = src.seq.length }) } // 峰值:同一拍全喷出、叠在源上
  else if (step % (L.gap ?? EMIT_GAP) === 1) SOURCES.forEach((src, i) => { if ((emittedPer[i] ?? 0) < src.seq.length) { const num = src.seq[emittedPer[i]!]!; pkts.push({ r: src.r, c: 0, ar: src.r, ac: 0, shape: num % 3, num }); emittedPer[i]!++ } }) // 每个源各发各的(gap 控快慢)
  const next: Pkt[] = []
  const sinkTick = SINKS.map(() => 0) // 本拍各出口已收数(用于 rate 限流)
  const arrive = (nr: number, nc: number, num: number, shape: number, fr: number, fc: number) => {
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) { lost++; return }
    const si = SINKS.findIndex(s => s.r === nr && nc === COLS - 1)
    if (si >= 0) {
      const s = SINKS[si]!
      if (s.rate !== undefined && sinkTick[si]! >= s.rate) { lost++; return } // 拥塞:本拍已收满,多的挤丢
      const okShape = s.addrs ? s.addrs.includes(num) : s.addr !== undefined ? (s.addr === -1 || num === s.addr) : s.ordered ? (num === oexp[si]) : (s.accept === -1 || shape === s.accept)
      if (!okShape) { wrong++; return }                                     // 地址不对 / 形状不对 / 顺序不对
      if (deliveredBy[si]! >= s.need) { deliveredBy[si]!++; wrong++; return } // 送多了(含无限增殖)= 错,并把溢出显示出来
      deliveredBy[si]!++; sinkTick[si]!++; if (s.ordered) oexp[si]!++; delivered++; sfx.ping()
      return
    }
    if (!editable(nr, nc) && !isSource(nr, nc)) { lost++; return }
    next.push({ r: nr, c: nc, ar: fr, ac: fc, shape, num })
  }
  const hadInput = pkts.length > 0
  // 1) 缓冲队列先放:放的是上一拍之前就囤好的包(所以这一拍新到的包至少要等到下一拍 —— 队列天然延一拍,可用来错峰)
  let released = false
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const b = grid[r]![c]; if (!b || b.kind !== 'queue' || !b.store || b.store.length === 0) continue
    if (b.next === undefined) b.next = 0
    let num = -1
    if (b.mode === 0) { num = b.store.shift()! } // 限速 FIFO(默认)
    else { const i = b.store.indexOf(b.next); if (i >= 0) { num = b.next; b.store.splice(i, 1); b.next++ } } // 排序:等到 next 才放
    if (num >= 0) { released = true; arrive(r + DY[b.dir]!, c + DX[b.dir]!, num, num % 3, r, c) }
  }
  // 2) 再吸收这一拍新到队列的包(存起来、下一拍才有资格放),其余正常流动
  const flowing: Pkt[] = []
  for (const p of pkts) { const pc = grid[p.r]![p.c]; if (pc && pc.kind === 'queue') { (pc.store ??= []).push(p.num) } else flowing.push(p) }
  for (const p of flowing) {
    const es = exits(p.r, p.c, p.shape, p.num)
    if (es.length === 0) { lost++; const pk0 = grid[p.r]![p.c]; if (pk0 && (pk0.kind === 'nat' || pk0.kind === 'acl')) okDrop++; continue }
    //  零件可以「改写包」(目前只有 NAT 这么做,真 NAT 改的就是包头里的地址)
    const pc2 = grid[p.r]![p.c]
    const outNum = pc2 && pc2.kind === 'nat' ? natMap(p.num) : p.num
    for (const d of es) arrive(p.r + DY[d]!, p.c + DX[d]!, outNum, outNum % 3, p.r, p.c)
  }
  // 撞包:一格一拍只容一个包(甲·线速关)。两个包落到同一格 → 都丢 + 红闪
  if (L.collide && next.length > 1) {
    const cnt = new Map<number, number>()
    for (const q of next) { const k = q.r * COLS + q.c; cnt.set(k, (cnt.get(k) || 0) + 1) }
    if ([...cnt.values()].some(v => v > 1)) {
      const keep: Pkt[] = []
      for (const q of next) { if ((cnt.get(q.r * COLS + q.c) || 0) > 1) { lost++; collided = true; collisionFlash.push({ r: q.r, c: q.c, t: 1 }) } else keep.push(q) }
      next.length = 0; for (const q of keep) next.push(q)
    }
  }
  pkts = next
  const moved = hadInput || released // 这一拍有没有任何包在动
  if (!L.sandbox && allEmitted() && pkts.length === 0 && buffersEmpty()) { running = false; done = true; pass = wrong === 0 && lost === okDrop && okDrop === (L.drops ?? 0) && SINKS.every((s, i) => deliveredBy[i] === s.need); if (pass) { const b = best[lvl] || { parts: Infinity, cycles: Infinity }; best[lvl] = { parts: Math.min(b.parts, partCount()), cycles: Math.min(b.cycles, step) }; saveBest(); if (partCount() <= L.par.parts || step <= L.par.cycles) sfx.win(); else sfx.chime() } else sfx.fail() }
  else if (!L.sandbox && allEmitted() && pkts.length === 0 && !moved && !buffersEmpty()) { running = false; done = true; pass = false; stuck = true; sfx.fail() } // 卡死:源发完了、没有任何包在流动,但队列里还压着包放不出来(多半是队列该切「限速」)
  else if (running && (step > 300 || delivered + wrong + lost > 120 || pkts.length > 120)) { running = false; done = true; pass = false; overflowed = delivered + wrong + lost > 120 || pkts.length > 120; sfx.fail() } // 失控保护:接成环无限增殖 —— 快速判失败,别永远转
}

// —— 布局 ——
function geo() { const top = 88, botUI = 96; const gw = W - 80, gh = H - top - botUI; const cs = Math.min(gw / COLS, gh / ROWS); return { cs, ox: (W - cs * COLS) / 2, oy: top } }
function cellAt(px: number, py: number) { const g = geo(); const c = Math.floor((px - g.ox) / g.cs), r = Math.floor((py - g.oy) / g.cs); return (r >= 0 && r < ROWS && c >= 0 && c < COLS) ? { r, c } : null }

// —— 输入 ——
let tool: Kind | 'erase' = 'belt'
let curDir: Dir = 0
const addrBits = () => Math.max(1, ...SOURCES.flatMap(s => s.seq)).toString(2).length // 这关地址有几位(地址路由只给这几位可切)
const modeCount = (k: Kind) => k === 'router' ? ROUTER_MODES.length : k === 'queue' ? QUEUE_MODES.length : k === 'arouter' ? addrBits() : k === 'prefix' || k === 'acl' ? Math.max(1, levelRoutes().length) : k === 'mask' ? addrBits() : 1
addEventListener('keydown', e => {
  if (HUB?.isPaused()) return // 暂停时只有 Esc 有用,它由课堂外壳自己接
  const k = e.key.toLowerCase()
  if (k === 'r') curDir = ((curDir + 1) % 4) as Dir
  if (k === ' ') { e.preventDefault(); const L = LEVELS[lvl]!; if (done && pass && !L.finale && !L.sandbox && lvl < LEVELS.length - 1) loadLevel(lvl + 1); else if (running || done) resetSim(); else run() }
})
function place(r: number, c: number) {
  if (!editable(r, c)) return
  if (tool === 'erase') { grid[r]![c] = null; sfx.blip(); return }
  const cur = grid[r]![c]
  if (cur && cur.kind === tool) cur.dir = ((cur.dir + 1) % 4) as Dir
  else grid[r]![c] = { kind: tool, dir: curDir, mode: 0 }
  sfx.place()
}
function menuBtnGeo() { return { x: W - 108, y: 16, w: 92, h: 30 } }
function musicBtnGeo() { return { x: W - 150, y: 16, w: 34, h: 30 } }
function drawMusicBtn() { const B = musicBtnGeo(); ctx.fillStyle = '#241d16'; ctx.fillRect(B.x, B.y, B.w, B.h); ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 1.5; ctx.strokeRect(B.x, B.y, B.w, B.h); ctx.fillStyle = musicMuted ? '#8a7a5a' : CREAM; ctx.font = '15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(musicMuted ? '🔇' : '🎵', B.x + B.w / 2, B.y + B.h / 2 + 1); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left' }
function retryGeo() { const R = runGeo(); return { x: R.x - 130 - 12, y: R.y, bw: 130, bh: R.bh } }
function menuCards() {
  const n = LEVELS.length, cols = n > 9 ? 4 : 3, gapx = 20, gapy = 16, y0 = 108
  const cw = Math.min(320, (W - 60) / cols - gapx), rows = Math.ceil(n / cols)
  const ch = Math.max(92, Math.min(118, (H - y0 - 26) / rows - gapy))
  const totalW = cols * cw + (cols - 1) * gapx, x0 = (W - totalW) / 2
  return LEVELS.map((_, i) => ({ i, x: x0 + (i % cols) * (cw + gapx), y: y0 + Math.floor(i / cols) * (ch + gapy), cw, ch }))
}
function menuClick(x: number, y: number) { for (const c of menuCards()) if (unlocked(c.i) && x >= c.x && x <= c.x + c.cw && y >= c.y && y <= c.y + c.ch) { loadLevel(c.i); mode = 'play'; sfx.enter(); return } }
/** 画布不再顶到页面最上面(上面是「虾米课堂」外壳条),所有命中判断都要用**画布内坐标**。 */
const at = (e: { clientX: number; clientY: number }) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
cv.addEventListener('pointerdown', e => {
  if (e.button !== 0) return // 只认左键放置/旋转;右键留给 contextmenu 切模式
  if (HUB?.isPaused()) return // 暂停时不吃点击(不然遮罩底下还在摆零件)
  sfx.resume(); ensureBgm()
  const { x: ex, y: ey } = at(e)
  const MB = musicBtnGeo(); if (mode !== 'intro' && ex >= MB.x && ex <= MB.x + MB.w && ey >= MB.y && ey <= MB.y + MB.h) { toggleMusic(); return }
  if (mode === 'intro') {
    //  容差 6 而不是 10:书房那张桌子上挤着两台机器,容差一大两个热点就会叠在一起,
    //  而叠住的表现是「点路由器却进了电脑」—— 不报错,只是点不对。
    const hit = (r: { x: number; y: number; w: number; h: number }) => ex >= r.x - 6 && ex <= r.x + r.w + 6 && ey >= r.y - 6 && ey <= r.y + r.h + 6
    if (hit(introCpu)) { location.href = pageUrl('cpu.html'); return }
    if (hit(introRouter)) mode = 'menu'
    return
  }
  if (mode === 'menu') { menuClick(ex, ey); return }
  const M = menuBtnGeo(); if (ex >= M.x && ex <= M.x + M.w && ey >= M.y && ey <= M.y + M.h) { mode = 'menu'; return }
  if (ey > H - 104) { uiClick(ex, ey); return }
  if ((running || done) && !LEVELS[lvl]!.sandbox) return // 沙盒里运行时也能继续摆
  const cell = cellAt(ex, ey); if (!cell) return
  place(cell.r, cell.c)
})
cv.addEventListener('contextmenu', e => { e.preventDefault(); if (mode !== 'play' || HUB?.isPaused()) return; const q = at(e); const cell = cellAt(q.x, q.y); if (cell) { const p = grid[cell.r]![cell.c]; if (p && (p.kind === 'router' || p.kind === 'queue' || p.kind === 'arouter' || p.kind === 'prefix' || p.kind === 'mask' || p.kind === 'acl')) { p.mode = (p.mode + 1) % modeCount(p.kind); sfx.blip() } } })
function uiClick(x: number, y: number) {
  const T = trayGeo(), items = trayItems()
  if (y >= T.y && y <= T.y + T.ts) { for (let i = 0; i < items.length; i++) { const bx = T.x0 + i * (T.ts + T.gap); if (x >= bx && x <= bx + T.ts) { tool = items[i]!; sfx.blip(); return } } }
  const L = LEVELS[lvl]!, isSandbox = !!L.sandbox, goNext = done && pass && !L.finale && !isSandbox && lvl < LEVELS.length - 1
  if (goNext) { const RT = retryGeo(); if (x >= RT.x && x <= RT.x + RT.bw && y >= RT.y && y <= RT.y + RT.bh) { resetSim(); sfx.blip(); return } }
  const R = runGeo(); if (x >= R.x && x <= R.x + R.bw && y >= R.y && y <= R.y + R.bh) { if (running) { if (isSandbox) { resetSim(); sfx.blip() } return } else if (!done) run(); else if (goNext) { loadLevel(lvl + 1); sfx.enter() } else { resetSim(); sfx.blip() } }
}

// —— 画 ——
function shape(x: number, y: number, r: number, sh: number, col: string) { ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.beginPath(); if (sh === 0) { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * .8); ctx.lineTo(x - r, y + r * .8); ctx.closePath() } else if (sh === 1) ctx.rect(x - r * .85, y - r * .85, r * 1.7, r * 1.7); else ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke() }
// —— 零件美术:物件即美术(手工机械件,暖黄铜/钢/木/青玻璃;Opus Magnum 味)——
//  画法词汇搬到了 game/build/kit.ts,两台机器同源(CPU 那台也用它)——
//  加新画法请加在 kit 里,别在某一台里就地写一份。
const { plate, rivet, housing, channel, chevron, rr, coverImg, wrapText } = makeKit(ctx)
function withDir(x: number, y: number, cs: number, dir: Dir, fn: () => void) { ctx.save(); ctx.translate(x + cs / 2, y + cs / 2); ctx.rotate(dir * Math.PI / 2); ctx.translate(-cs / 2, -cs / 2); fn(); ctx.restore() }
function hub(cs: number) { ctx.fillStyle = '#241d14'; ctx.beginPath(); ctx.arc(cs * .5, cs * .5, cs * .12, 0, 7); ctx.fill(); ctx.strokeStyle = '#e8c98a'; ctx.lineWidth = 2; ctx.stroke() }
function drawBody(kind: Kind, cs: number, mode: number, seen?: Set<number>, nums?: number[]) {
  const flow = running ? (tprev / 220) % 1 : 0
  if (kind === 'belt') {
    plate(cs * .05, cs * .2, cs * .9, cs * .13, 3, STEEL); plate(cs * .05, cs * .67, cs * .9, cs * .13, 3, STEEL)
    ctx.fillStyle = '#29241e'; rr(cs * .08, cs * .33, cs * .84, cs * .34, 4); ctx.fill()
    for (const rx of [cs * .16, cs * .84]) { ctx.fillStyle = '#c49a55'; ctx.beginPath(); ctx.arc(rx, cs * .5, cs * .085, 0, 7); ctx.fill(); ctx.strokeStyle = '#6f5028'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = 'rgba(255,240,210,.4)'; ctx.beginPath(); ctx.arc(rx - cs * .02, cs * .47, cs * .022, 0, 7); ctx.fill() }
    for (let i = 0; i < 3; i++) chevron(cs * (.26 + ((i / 3 + flow) % 1) * .48), cs * .5, cs * .1, 'rgba(127,232,192,.85)', 3)
    return
  }
  if (kind === 'router') { // 可编程路由器:每种形状按当前模式走哪个前向口,通道按形状上色
    housing(cs, GREEN); channel(cs * .14, cs * .5, cs * .5, cs * .5, cs * .07, '#3a2c18') // 入口(左)
    const ends = [[cs * .5, cs * .12], [cs * .88, cs * .5], [cs * .5, cs * .88]] // 局部:左出=上 / 直出=右 / 右出=下
    const m = ROUTER_MODES[mode] ?? ROUTER_MODES[0]!
    for (let sh = 0; sh < 3; sh++) { const d = m.map[sh]!, e = ends[d]!, off = (sh - 1) * cs * .055; const ox = d === 1 ? 0 : off, oy = d === 1 ? off : 0; channel(cs * .5 + ox, cs * .5 + oy, e[0]! + ox, e[1]! + oy, cs * .05, SHAPE_COL[sh]!) }
    hub(cs); return
  }
  if (kind === 'mask') { // 掩码判断:显示 /n,同网段→拐弯(上)、不同→直行(交给网关)
    housing(cs, ['#a8e0c0', '#5fb888', '#2a634a'])
    channel(cs * .14, cs * .5, cs * .5, cs * .5, cs * .07, '#26392f')
    channel(cs * .5, cs * .5, cs * .86, cs * .5, cs * .055, '#8fd8b4')          // 不同网段 → 直行(网关)
    channel(cs * .5, cs * .5, cs * .5, cs * .14, cs * .055, '#e0b04f')          // 同网段 → 拐弯(本地)
    ctx.fillStyle = '#132419'; ctx.beginPath(); ctx.arc(cs * .5, cs * .5, cs * .17, 0, 7); ctx.fill(); ctx.strokeStyle = '#8fd8b4'; ctx.lineWidth = 2; ctx.stroke()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e6fff2'; ctx.font = `bold ${Math.round(cs * .19)}px ui-monospace, monospace`; ctx.fillText('/' + maskLen(mode), cs * .5, cs * .5)
    ctx.font = `bold ${Math.round(cs * .1)}px system-ui`
    ctx.fillStyle = '#e0b04f'; ctx.fillText('同网段', cs * .5, cs * .19)
    ctx.fillStyle = '#8fd8b4'; ctx.fillText('网关', cs * .79, cs * .5)
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; return
  }
  if (kind === 'prefix') { // 前缀匹配器:中间显示这条路由的前缀模式(如 10*),命中→拐弯(上)、未命中→直行
    housing(cs, ['#d8b0e0', '#9a6fb8', '#4a2a63'])
    channel(cs * .14, cs * .5, cs * .5, cs * .5, cs * .07, '#2f2639')
    channel(cs * .5, cs * .5, cs * .86, cs * .5, cs * .055, '#c4a6ff')          // 未命中 → 直行
    channel(cs * .5, cs * .5, cs * .5, cs * .14, cs * .055, '#e0b04f')          // 命中 → 拐弯(上)
    ctx.fillStyle = '#1d1526'; ctx.beginPath(); ctx.arc(cs * .5, cs * .5, cs * .17, 0, 7); ctx.fill(); ctx.strokeStyle = '#c4a6ff'; ctx.lineWidth = 2; ctx.stroke()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const pat = levelRoutes()[mode]?.pat ?? '*'
    ctx.fillStyle = '#efe0ff'; ctx.font = `bold ${Math.round(cs * .17)}px ui-monospace, monospace`; ctx.fillText(pat, cs * .5, cs * .5)
    ctx.font = `bold ${Math.round(cs * .11)}px ui-monospace, monospace`
    ctx.fillStyle = '#e0b04f'; ctx.fillText('中', cs * .5, cs * .2)
    ctx.fillStyle = '#c4a6ff'; ctx.fillText('否', cs * .8, cs * .5)
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; return
  }
  if (kind === 'arouter') { // 地址路由器:看地址第 mode 位,0→直行、1→拐弯(上)
    housing(cs, ['#9ec2e0', '#5f8fb8', '#2a4a63'])
    channel(cs * .14, cs * .5, cs * .5, cs * .5, cs * .07, '#26343f')          // 入口(左)
    channel(cs * .5, cs * .5, cs * .86, cs * .5, cs * .055, '#8fb4ff')         // 位=0 → 直行
    channel(cs * .5, cs * .5, cs * .5, cs * .14, cs * .055, '#e0b04f')         // 位=1 → 拐弯(上)
    ctx.fillStyle = '#12202c'; ctx.beginPath(); ctx.arc(cs * .5, cs * .5, cs * .15, 0, 7); ctx.fill(); ctx.strokeStyle = '#8fb4ff'; ctx.lineWidth = 2; ctx.stroke()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#cfe4ff'; ctx.font = `bold ${Math.round(cs * .19)}px ui-monospace, monospace`; ctx.fillText(String(mode), cs * .5, cs * .47)         // 看二进制第几位(从右数,0=最右)
    ctx.fillStyle = '#8fb4ff'; ctx.font = `${Math.round(cs * .088)}px system-ui`; ctx.fillText('位', cs * .5, cs * .63)
    ctx.font = `bold ${Math.round(cs * .11)}px ui-monospace, monospace`
    ctx.fillStyle = '#8fb4ff'; ctx.fillText('0', cs * .8, cs * .5)                                                                                       // 该位=0 → 直行(右)
    ctx.fillStyle = '#e0b04f'; ctx.fillText('1', cs * .5, cs * .2)                                                                                       // 该位=1 → 拐弯(上)
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'
    return
  }
  if (kind === 'nat') { // NAT:唯一会「改写包」的零件。出方向把私网地址统统换成公网那一个;回程查会话表还原,查不到的当场丢
    housing(cs, ['#9fd8e8', '#4f93ad', '#1e4457'])
    channel(cs * .14, cs * .5, cs * .5, cs * .5, cs * .07, '#1c2f38')
    channel(cs * .5, cs * .5, cs * .86, cs * .5, cs * .06, '#8fe0ff')
    ctx.fillStyle = '#0e2029'; ctx.beginPath(); ctx.arc(cs * .5, cs * .5, cs * .18, 0, 7); ctx.fill(); ctx.strokeStyle = '#8fe0ff'; ctx.lineWidth = 2; ctx.stroke()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e6f8ff'; ctx.font = `bold ${Math.round(cs * .16)}px system-ui`; ctx.fillText('NAT', cs * .5, cs * .5)
    ctx.font = `bold ${Math.round(cs * .11)}px system-ui`; ctx.fillStyle = '#e0b04f'
    ctx.fillText(natOut() ? '出 · 换成公网' : '回 · 查表还原', cs * .5, cs * .2)   // 两个方向做的事不一样,画出来
    ctx.fillStyle = '#8fe0ff'; ctx.font = `bold ${Math.round(cs * .12)}px ui-monospace, monospace`; ctx.fillText('⇄', cs * .5, cs * .8)
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; return
  }
  if (kind === 'acl') { // 访问控制:命中规则→当场拦下(它压根没有出口,包是真的被丢掉);没命中→直行交给下一条
    housing(cs, ['#e6a898', '#b8564a', '#5a1f18'])
    channel(cs * .14, cs * .5, cs * .5, cs * .5, cs * .07, '#3a221e')
    channel(cs * .5, cs * .5, cs * .86, cs * .5, cs * .055, '#ffb9a8')          // 未命中 → 直行(照常出网)
    ctx.strokeStyle = '#ff6a52'; ctx.lineWidth = Math.max(2, cs * .05); ctx.lineCap = 'round' // 命中 → 拦下:上方封一个红叉,提示这条路根本不通
    ctx.beginPath(); ctx.moveTo(cs * .41, cs * .19); ctx.lineTo(cs * .59, cs * .31); ctx.moveTo(cs * .59, cs * .19); ctx.lineTo(cs * .41, cs * .31); ctx.stroke(); ctx.lineCap = 'butt'
    ctx.fillStyle = '#2a100c'; ctx.beginPath(); ctx.arc(cs * .5, cs * .5, cs * .17, 0, 7); ctx.fill(); ctx.strokeStyle = '#ff9e8a'; ctx.lineWidth = 2; ctx.stroke()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffe3da'; ctx.font = `bold ${Math.round(cs * .17)}px ui-monospace, monospace`; ctx.fillText(levelRoutes()[mode]?.pat ?? '*', cs * .5, cs * .5)
    ctx.font = `bold ${Math.round(cs * .11)}px ui-monospace, monospace`
    ctx.fillStyle = '#ffb9a8'; ctx.fillText('否', cs * .8, cs * .5)
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; return
  }
  if (kind === 'copier') { // T 型分叉:进料(左)→ 复制两份从上、下两个垂直口出
    housing(cs, BRASS)
    channel(cs * .14, cs * .5, cs * .5, cs * .5, cs * .07, '#22303a')   // 进料(左)
    channel(cs * .5, cs * .5, cs * .5, cs * .12, cs * .09, '#4a6fb0')   // 复制→上
    channel(cs * .5, cs * .5, cs * .5, cs * .88, cs * .09, '#4a6fb0')   // 复制→下
    ctx.fillStyle = '#26343f'; ctx.beginPath(); ctx.arc(cs * .5, cs * .5, cs * .15, 0, 7); ctx.fill(); ctx.strokeStyle = BLUE; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = '#8fb4ff'; rr(cs * .43, cs * .43, cs * .1, cs * .1, 2); ctx.fill(); ctx.fillStyle = '#5b8def'; rr(cs * .49, cs * .49, cs * .1, cs * .1, 2); ctx.fill(); return
  }
  if (kind === 'cache') {
    housing(cs, VIOLET)
    // 亮几格 = 表里已经记下了几条(键是**地址**,不是槽位号 —— 所以按 size 点亮,不能按 has(i))
    for (let i = 0; i < 3; i++) { const sx = cs * (.3 + i * .2); ctx.fillStyle = '#2a2038'; rr(sx - cs * .06, cs * .23, cs * .12, cs * .15, 2); ctx.fill(); ctx.strokeStyle = '#6a4f92'; ctx.lineWidth = 1; rr(sx - cs * .06, cs * .23, cs * .12, cs * .15, 2); ctx.stroke(); if (seen && i < seen.size) { ctx.fillStyle = '#7fe8c0'; ctx.beginPath(); ctx.arc(sx, cs * .305, cs * .03, 0, 7); ctx.fill() } }
    channel(cs * .14, cs * .62, cs * .5, cs * .62, cs * .08, '#3a2c18'); channel(cs * .5, cs * .62, cs * .86, cs * .62, cs * .08, AMBER); channel(cs * .5, cs * .62, cs * .5, cs * .44, cs * .08, TEAL)
    ctx.fillStyle = '#241d14'; ctx.beginPath(); ctx.arc(cs * .5, cs * .62, cs * .06, 0, 7); ctx.fill(); return
  }
  // queue 缓冲队列:入口→排队腔→闸门→单口放出;排队的号亮片;右上角小徽标示模式(排/限)
  housing(cs, GOLD); channel(cs * .14, cs * .5, cs * .32, cs * .5, cs * .08, '#3a2c18')
  ctx.fillStyle = '#2a2214'; rr(cs * .32, cs * .24, cs * .28, cs * .52, 3); ctx.fill(); ctx.strokeStyle = '#caa85a'; ctx.lineWidth = 1.5; rr(cs * .32, cs * .24, cs * .28, cs * .52, 3); ctx.stroke()
  const q = nums || []; for (let i = 0; i < 3; i++) { ctx.fillStyle = i < q.length ? SHAPE_COL[q[i]! % 3]! : '#3a3020'; rr(cs * .35, cs * (.6 - i * .13), cs * .22, cs * .1, 2); ctx.fill() }
  ctx.fillStyle = '#caa85a'; ctx.fillRect(cs * .6, cs * .42, cs * .03, cs * .16); channel(cs * .63, cs * .5, cs * .86, cs * .5, cs * .08, '#e8c98a')
  ctx.fillStyle = mode === 0 ? '#e0954b' : '#7fe8c0'; rr(cs * .66, cs * .2, cs * .18, cs * .14, 2); ctx.fill(); ctx.fillStyle = '#1a140c'; ctx.font = `bold ${Math.round(cs * .1)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(mode === 0 ? '限' : '排', cs * .75, cs * .27); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'
}
function paintPart(kind: Kind, x: number, y: number, cs: number, dir: Dir, mode: number, seen?: Set<number>, nums?: number[]) {
  withDir(x, y, cs, dir, () => drawBody(kind, cs, mode, seen, nums))
}
function pieceGraphic(p: Piece, x: number, y: number, cs: number) {
  const nums = p.kind === 'queue' ? (p.store || []) : undefined
  paintPart(p.kind, x, y, cs, p.dir, p.mode, p.seen, nums)
}
function partIcon(kind: Kind | 'erase', cx: number, cy: number, s: number) {
  if (kind === 'erase') { ctx.strokeStyle = RED; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - s * .4, cy - s * .4); ctx.lineTo(cx + s * .4, cy + s * .4); ctx.moveTo(cx + s * .4, cy - s * .4); ctx.lineTo(cx - s * .4, cy + s * .4); ctx.stroke(); ctx.lineCap = 'butt'; return }
  const box = s * 2.1; paintPart(kind, cx - box / 2, cy - box / 2, box, curDir, 0)
}
function drawSource(x: number, y: number, cs: number) {
  plate(x + cs * .1, y + cs * .14, cs * .8, cs * .72, cs * .1, STEEL)
  rivet(x + cs * .2, y + cs * .24, cs * .026); rivet(x + cs * .2, y + cs * .76, cs * .026)
  const pulse = 0.55 + 0.45 * Math.sin(tprev / 240) // 发射口:暗腔 + 脉冲青核
  ctx.fillStyle = '#12201c'; ctx.beginPath(); ctx.arc(x + cs * .6, y + cs * .5, cs * .2, 0, 7); ctx.fill()
  ctx.globalAlpha = pulse; ctx.fillStyle = '#7fe8c0'; ctx.beginPath(); ctx.arc(x + cs * .6, y + cs * .5, cs * .12, 0, 7); ctx.fill(); ctx.globalAlpha = 1
  ctx.fillStyle = '#3fa78f'; ctx.beginPath(); ctx.arc(x + cs * .6, y + cs * .5, cs * .05, 0, 7); ctx.fill()
  for (let i = 0; i < 2; i++) { ctx.strokeStyle = `rgba(127,232,192,${.55 - i * .25})`; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; const px = x + cs * (.82 + ((tprev / 520 + i / 2) % 1) * .14); ctx.beginPath(); ctx.moveTo(px, y + cs * .43); ctx.lineTo(px + cs * .05, y + cs * .5); ctx.lineTo(px, y + cs * .57); ctx.stroke(); ctx.lineCap = 'butt' }
  ctx.fillStyle = 'rgba(232,222,202,.92)'; ctx.font = `bold ${Math.round(cs * .17)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('源', x + cs * .34, y + cs * .5); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'
}
function drawSink(x: number, y: number, cs: number, s: Sink, i: number) {
  const got = deliveredBy[i]!, full = got === s.need, over = got > s.need
  plate(x + cs * .1, y + cs * .14, cs * .8, cs * .72, cs * .1, over ? ['#e0a48f', '#c0432c', '#571a12'] : full ? ['#8fe6c8', '#49a791', '#245c4e'] : STEEL)
  ctx.fillStyle = '#12100c'; ctx.beginPath(); ctx.moveTo(x + cs * .1, y + cs * .38); ctx.lineTo(x + cs * .27, y + cs * .5); ctx.lineTo(x + cs * .1, y + cs * .62); ctx.closePath(); ctx.fill() // 进料口
  if (s.addr !== undefined) { ctx.fillStyle = full || over ? '#160a08' : '#8fb4ff'; ctx.font = `bold ${Math.round(cs * .3)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.addr < 0 ? '✳' : String(s.addr), x + cs * .55, y + cs * .38); ctx.font = `${Math.round(cs * .1)}px system-ui`; ctx.fillStyle = full || over ? '#160a08' : '#9a8a6a'; ctx.fillText(s.label ?? '', x + cs * .54, y + cs * .56); ctx.textBaseline = 'alphabetic' } // 网段:目的地址
  else if (s.accept >= 0) shape(x + cs * .55, y + cs * .42, cs * .15, s.accept, SHAPE_COL[s.accept]!)
  else { ctx.fillStyle = full || over ? '#160a08' : AMBER; ctx.font = `bold ${Math.round(cs * .13)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.label ?? '任意', x + cs * .54, y + cs * .4); ctx.textBaseline = 'alphabetic' }
  ctx.fillStyle = full || over ? '#160a08' : (got > 0 ? CREAM : '#9a8a6a'); ctx.font = `bold ${Math.round(cs * .15)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(`${got}/${s.need}`, x + cs * .54, y + cs * .76)
  if (full) { ctx.strokeStyle = '#0d1a16'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x + cs * .17, y + cs * .25); ctx.lineTo(x + cs * .23, y + cs * .31); ctx.lineTo(x + cs * .33, y + cs * .19); ctx.stroke(); ctx.lineCap = 'butt' }
  else if (over) { ctx.strokeStyle = '#2a0f0a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + cs * .18, y + cs * .2); ctx.lineTo(x + cs * .28, y + cs * .3); ctx.moveTo(x + cs * .28, y + cs * .2); ctx.lineTo(x + cs * .18, y + cs * .3); ctx.stroke(); ctx.lineCap = 'butt' } // 溢出:✕
  ctx.textAlign = 'left'
}
const partName = (k: Kind | 'erase') => k === 'belt' ? '传送带' : k === 'router' ? '路由器' : k === 'arouter' ? '地址路由' : k === 'prefix' ? '前缀匹配' : k === 'mask' ? '掩码判断' : k === 'nat' ? 'NAT' : k === 'acl' ? '访问控制' : k === 'copier' ? '复制器' : k === 'cache' ? '缓存盒' : k === 'queue' ? '缓冲队列' : '擦除'
function trayGeo() { const ts = 66, gap = 12, y = H - ts - 16, x0 = 24; return { ts, gap, y, x0 } }
function runGeo() { const bw = 168, bh = 54; return { x: W - bw - 24, y: H - bh - 16, bw, bh } }
function renderIntro() {
  ctx.fillStyle = '#120d07'; ctx.fillRect(0, 0, W, H)
  const cw = Math.min(W * 0.62, 940), ch = cw * (iready(CUT) ? CUT.naturalHeight / CUT.naturalWidth : 0.62)
  const hx = W / 2 - cw / 2, hy = H * 0.56 - ch / 2
  coverImg(CUT, hx, hy, cw, ch)
  const pulse = 0.55 + 0.35 * Math.sin(tprev / 260)
  /** 房子里一台可钻进去的机器:高亮框 + 一行说明。返回可点区域。 */
  const spot = (fx: number, fy: number, fw: number, label: string, img?: HTMLImageElement) => {
    const w = cw * fw, x = hx + cw * fx - w / 2, y = hy + ch * fy - w / 2
    ctx.fillStyle = 'rgba(10,8,5,.5)'; rr(x - 6, y - 6, w + 12, w + 12, 8); ctx.fill()
    if (img) coverImg(img, x, y, w, w)
    ctx.globalAlpha = pulse; ctx.strokeStyle = AMBER; ctx.lineWidth = 3; rr(x - 6, y - 6, w + 12, w + 12, 8); ctx.stroke(); ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(20,16,12,.9)'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'left'
    const tw = ctx.measureText(label).width + 20
    rr(x + w + 8, y + w / 2 - 15, tw, 30, 8); ctx.fill()
    ctx.fillStyle = CREAM; ctx.textBaseline = 'middle'; ctx.fillText(label, x + w + 18, y + w / 2); ctx.textBaseline = 'alphabetic'
    return { x, y, w, h: w }
  }
  //  两台机器都在书房那张桌子上:路由器(叠一张图上去)与电脑(画里本来就有那台显示器)。
  //  位置错开是量过的 —— 两个框挨得太近会互相压住,而这种压住只在某些窗口宽度下才看得出来。
  introRouter = spot(0.155, 0.425, 0.062, '← 点这台路由器,钻进去', ROUTER)
  introCpu = spot(0.205, 0.293, 0.062, '← 这台电脑:CPU 五级流水线')
  const gd = ctx.createLinearGradient(0, 0, 0, 210); gd.addColorStop(0, 'rgba(10,7,4,.92)'); gd.addColorStop(1, 'rgba(10,7,4,0)'); ctx.fillStyle = gd; ctx.fillRect(0, 0, W, 210)
  ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.font = 'bold 36px system-ui'; ctx.fillText('网,断了。', W / 2, H * 0.14)
  ctx.fillStyle = AMBER; ctx.font = '18px system-ui'; ctx.fillText('信号追进了家里这台路由器 —— 点开它,钻进去,把它一处处修好。', W / 2, H * 0.14 + 36)
  ctx.fillStyle = '#c8bfa8'; ctx.font = '14px system-ui'; ctx.fillText('书房那台电脑也能钻 —— 里面是另一台机器:CPU 的五级流水线。', W / 2, H * 0.14 + 62)
}
function renderMenu() {
  coverImg(CORR, 0, 0, W, H, 0.62)
  ctx.fillStyle = CREAM; ctx.font = 'bold 30px system-ui'; ctx.textAlign = 'center'; ctx.fillText('路由器内部 · 待修的子系统', W / 2, 58)
  ctx.fillStyle = AMBER; ctx.font = '14px system-ui'; ctx.fillText('一处处修过去、把信号重新接通;每关都能再搭一次,刷更省的解', W / 2, 88)
  drawMusicBtn()
  for (const c of menuCards()) {
    const L = LEVELS[c.i]!, ul = unlocked(c.i), pd = passed(c.i)
    rr(c.x, c.y, c.cw, c.ch, 12); ctx.fillStyle = ul ? 'rgba(30,38,32,.92)' : 'rgba(20,16,11,.9)'; ctx.fill(); ctx.strokeStyle = pd ? TEAL : ul ? '#8a7550' : '#33291a'; ctx.lineWidth = 2; rr(c.x, c.y, c.cw, c.ch, 12); ctx.stroke()
    /* 标题与右上角的「目标 ≤N件 ≤N拍」在同一行:长名字(第6关·拥塞削平(路由+队列)、
       甲·线速·双源按序汇入…)会直接压到那串数字上。先量出目标文字占多宽,
       标题就只能用剩下的宽度:先缩字号(17→13),仍放不下才截断加省略号。 */
    const parTxt = L.sandbox ? '' : `目标 ≤${L.par.parts}件 ≤${L.par.cycles}拍`
    ctx.font = '11px system-ui'
    const titleMax = c.cw - 32 - (parTxt ? ctx.measureText(parTxt).width + 12 : 0)
    ctx.textAlign = 'left'; ctx.fillStyle = ul ? CREAM : '#6a5a3a'
    let tsize = 17
    ctx.font = `bold ${tsize}px system-ui`
    while (tsize > 13 && ctx.measureText(L.name).width > titleMax) { tsize--; ctx.font = `bold ${tsize}px system-ui` }
    let tname = L.name
    if (ctx.measureText(tname).width > titleMax) {
      while (tname.length > 1 && ctx.measureText(tname + '…').width > titleMax) tname = tname.slice(0, -1)
      tname += '…'
    }
    ctx.fillText(tname, c.x + 16, c.y + 30)
    ctx.fillStyle = ul ? '#c8bfa8' : '#5a4e3a'; ctx.font = '12px system-ui'; wrapText(STORY[c.i]!, c.x + 16, c.y + 52, c.cw - 32, 16, 2)
    if (L.sandbox) { ctx.fillStyle = '#8fdcc0'; ctx.font = 'bold 15px system-ui'; ctx.fillText('🧪 随便搭 · 随时进来玩', c.x + 16, c.y + c.ch - 14) }
    else {
      if (!ul) { ctx.fillStyle = '#6a5a3a'; ctx.font = '13px system-ui'; ctx.fillText('🔒 先通过上一关', c.x + 16, c.y + c.ch - 14) }
      else if (pd) { const b = best[c.i]!, mp = b.parts <= L.par.parts, mc = b.cycles <= L.par.cycles; ctx.fillStyle = TEAL; ctx.font = '13px system-ui'; ctx.fillText(`✓ 已修好 · 最好 ${b.parts}件 ${b.cycles}拍  ${mp ? '🏅' : ''}${mc ? '🏅' : ''}`, c.x + 16, c.y + c.ch - 14) }
      else { ctx.fillStyle = AMBER; ctx.font = 'bold 15px system-ui'; ctx.fillText('▶ 开始修', c.x + 16, c.y + c.ch - 14) }
      ctx.textAlign = 'right'; ctx.fillStyle = '#9a8a6a'; ctx.font = '11px system-ui'; ctx.fillText(`目标 ≤${L.par.parts}件 ≤${L.par.cycles}拍`, c.x + c.cw - 14, c.y + 26); ctx.textAlign = 'left'
    }
  }
}
function frame(now: number) {
  const dt = tprev ? now - tprev : 16; tprev = now
  if (mode === 'intro') { renderIntro(); requestAnimationFrame(frame); return }
  if (mode === 'menu') { renderMenu(); requestAnimationFrame(frame); return }
  if (running && !HUB?.isPaused()) { acc += dt; while (acc >= STEP_MS) { acc -= STEP_MS; simStep(); if (!running) break } }
  const g = geo(), cs = g.cs, L = LEVELS[lvl]!
  const isSandbox = !!L.sandbox, goNext = done && pass && !L.finale && !isSandbox && lvl < LEVELS.length - 1
  coverImg(CORR, 0, 0, W, H, 0.74) // 你在路由器内部
  const pw = cs * COLS + 28, ph = cs * ROWS + 28
  rr(g.ox - 14, g.oy - 14, pw, ph, 14); ctx.fillStyle = 'rgba(24,19,12,.9)'; ctx.fill(); ctx.strokeStyle = '#4a3f2a'; ctx.lineWidth = 2; rr(g.ox - 14, g.oy - 14, pw, ph, 14); ctx.stroke()
  ctx.fillStyle = CREAM; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'left'; ctx.fillText(L.name, 24, 28)
  ctx.fillStyle = '#c8bfa8'; ctx.font = '13px system-ui'; wrapText(STORY[lvl]!, 24, 48, W * 0.62, 16, 1)
  //  提示可能很长(最长前缀匹配那关要讲清「越具体越靠前」),直接 fillText 会顶出右边界被截掉 —— 按可用宽度折行
  ctx.fillStyle = AMBER; ctx.font = '12px system-ui'; wrapText(L.hint, 24, 68, W - 48 - 190, 15, 2)
  // 网格
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = g.ox + c * cs, y = g.oy + r * cs
    ctx.strokeStyle = editable(r, c) ? '#2c2418' : '#1e1810'; ctx.lineWidth = 1; ctx.strokeRect(x, y, cs, cs)
    const p = grid[r]![c]; if (p) pieceGraphic(p, x, y, cs)
  }
  // 源(发射机)
  for (const src of SOURCES) drawSource(g.ox, g.oy + src.r * cs, cs)
  // 汇(收料台,带需求数)
  for (let i = 0; i < SINKS.length; i++) drawSink(g.ox + (COLS - 1) * cs, g.oy + SINKS[i]!.r * cs, cs, SINKS[i]!, i)
  // 包
  const tt = Math.min(1, acc / STEP_MS), showNum = SINKS.some(s => s.ordered) || !!L.showAddr
  const abits = L.showAddr ? Math.max(1, ...SOURCES.flatMap(s => s.seq)).toString(2).length : 0 // 地址位数(用于显二进制)
  for (const p of pkts) { const rr = p.ar + (p.r - p.ar) * tt, cc = p.ac + (p.c - p.ac) * tt, sxp = g.ox + (cc + .5) * cs, syp = g.oy + (rr + .5) * cs; ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(sxp, syp + cs * .18, cs * .17, cs * .06, 0, 0, 7); ctx.fill(); shape(sxp, syp, cs * .2, p.shape, SHAPE_COL[p.shape]!); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(sxp - cs * .06, syp - cs * .07, cs * .04, 0, 7); ctx.fill(); if (showNum) { ctx.fillStyle = '#161009'; ctx.font = `bold ${Math.round(cs * (abits ? .2 : .22))}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(p.num), sxp, syp - (abits ? cs * .05 : -cs * .02)); if (abits) { ctx.font = `bold ${Math.round(cs * .13)}px ui-monospace, monospace`; ctx.fillStyle = '#2a1e10'; ctx.fillText(p.num.toString(2).padStart(abits, '0'), sxp, syp + cs * .1) } ctx.textBaseline = 'alphabetic' } }
  // 撞包红闪
  for (const f of collisionFlash) { const x = g.ox + f.c * cs, y = g.oy + f.r * cs; ctx.fillStyle = `rgba(200,60,44,${0.55 * f.t})`; rr(x + 2, y + 2, cs - 4, cs - 4, 6); ctx.fill(); ctx.strokeStyle = `rgba(255,120,90,${f.t})`; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + cs * .32, y + cs * .32); ctx.lineTo(x + cs * .68, y + cs * .68); ctx.moveTo(x + cs * .68, y + cs * .32); ctx.lineTo(x + cs * .32, y + cs * .68); ctx.stroke(); ctx.lineCap = 'butt'; f.t -= dt / 500 }
  collisionFlash = collisionFlash.filter(f => f.t > 0)
  // 终关通关:庆祝「网,回来了」——真正的收尾时刻(按钮仍画在其上、可点)
  {
    const isWin = !!L.finale && done && pass
    celebrate = Math.max(0, Math.min(1, celebrate + (isWin ? dt / 900 : -dt / 250)))
    if (celebrate > 0.01) {
      const e = celebrate, cx = W / 2, cy = H * 0.40
      ctx.fillStyle = `rgba(20,54,46,${0.55 * e})`; ctx.fillRect(0, 0, W, H) // 暖青绿光罩
      for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(93,193,164,${0.05 * e * k})`; ctx.beginPath(); ctx.arc(cx, cy, (90 + k * 46 + 18 * Math.sin(tprev / 500)) * e, 0, 7); ctx.fill() } // 中心呼吸光晕
      for (let i = 0; i < 44; i++) { // 上升的火花
        const a = i * 2.399, rad = (70 + ((i * 61) % 300)) * (0.4 + 0.6 * e)
        const px = cx + Math.cos(a) * rad, drift = ((tprev / 22 + i * 40) % (H * 0.9))
        const py = (cy + rad * 0.42) - drift * e, tw = 0.35 + 0.65 * Math.abs(Math.sin(tprev / 220 + i))
        ctx.globalAlpha = tw * e; ctx.fillStyle = i % 3 === 0 ? '#ffd27a' : '#8feecb'
        ctx.beginPath(); ctx.arc(px, py, 2.6, 0, 7); ctx.fill()
      }
      ctx.globalAlpha = 1; ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(245,240,224,${e})`; ctx.font = `bold ${Math.round(40 * (0.7 + 0.3 * e))}px system-ui`; ctx.fillText('网,回来了。', cx, H * 0.30)
      ctx.fillStyle = `rgba(224,180,80,${e})`; ctx.font = '17px system-ui'; ctx.fillText('从家里那台机器,到公网的第一跳 —— 整条路都是你亲手搭的。', cx, H * 0.30 + 38)
      ctx.fillStyle = `rgba(200,191,168,${0.9 * e})`; ctx.font = '13px system-ui'; ctx.fillText('判同网段、查路由表、放行与拦截、NAT 改写、出口排队 —— 一台真路由器要做的判断,你全接上了。', cx, H * 0.30 + 64)
      ctx.textAlign = 'left'
    }
  }
  // 每关结算卡:通过 / 失败都有(终关通过用上面的大庆祝、这里跳过)
  {
    const finaleWin = !!L.finale && pass
    resultT = Math.max(0, Math.min(1, resultT + ((done && !finaleWin) ? dt / 280 : -dt / 220)))
    if (done && !finaleWin && resultT > 0.01) {
      const e = resultT, cw = Math.min(460, W * 0.52), ch = 156, cardX = W / 2 - cw / 2, cardY = H * 0.30 - (1 - e) * 22
      ctx.save(); ctx.globalAlpha = e
      rr(cardX, cardY, cw, ch, 16); ctx.fillStyle = pass ? 'rgba(20,52,44,.96)' : 'rgba(52,30,22,.96)'; ctx.fill(); ctx.strokeStyle = pass ? TEAL : AMBER; ctx.lineWidth = 2.5; rr(cardX, cardY, cw, ch, 16); ctx.stroke()
      const seal = cardX + 56, sy = cardY + 58 // 印章
      ctx.fillStyle = pass ? 'rgba(73,167,145,.22)' : 'rgba(200,69,46,.2)'; ctx.beginPath(); ctx.arc(seal, sy, 31, 0, 7); ctx.fill(); ctx.strokeStyle = pass ? TEAL : RED; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(seal, sy, 31, 0, 7); ctx.stroke()
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 4.5
      if (pass) { ctx.strokeStyle = TEAL; ctx.beginPath(); ctx.moveTo(seal - 13, sy + 1); ctx.lineTo(seal - 3, sy + 12); ctx.lineTo(seal + 15, sy - 12); ctx.stroke() }
      else { ctx.strokeStyle = RED; ctx.beginPath(); ctx.moveTo(seal - 11, sy - 11); ctx.lineTo(seal + 11, sy + 11); ctx.moveTo(seal + 11, sy - 11); ctx.lineTo(seal - 11, sy + 11); ctx.stroke() }
      ctx.lineCap = 'butt'
      const tx = cardX + 104
      ctx.textAlign = 'left'; ctx.fillStyle = CREAM; ctx.font = 'bold 23px system-ui'; ctx.fillText(pass ? '修好了!' : '还没通', tx, cardY + 44)
      if (pass) {
        const mp = partCount() <= L.par.parts, mc = step <= L.par.cycles
        ctx.fillStyle = '#c8bfa8'; ctx.font = '14px system-ui'; ctx.fillText(`这个子系统信号通了 · 用了 ${partCount()} 件 ${step} 拍${okDrop ? ` · 按规矩拦下 ${okDrop} 个` : ''}`, tx, cardY + 72)
        ctx.font = '17px system-ui'; ctx.fillStyle = AMBER; ctx.fillText(mp || mc ? `${mp ? '🏅省料 ' : ''}${mc ? '🏅飞快' : ''}` : `再省一点就能拿🏅(目标 ≤${L.par.parts}件 ≤${L.par.cycles}拍)`, tx, cardY + 100)
        ctx.fillStyle = '#8fdcc0'; ctx.font = '13px system-ui'; ctx.fillText(goNext ? '↓ 点「下一关」继续,或「再搭一次」刷更省的解' : '↓ 点「再搭一次」刷更省的解', tx, cardY + 128)
        for (let i = 0; i < 12; i++) { const a = i * 2.399, rad = 36 + (i % 3) * 9, px = seal + Math.cos(a + tprev / 600) * rad, py = sy + Math.sin(a + tprev / 600) * rad; ctx.globalAlpha = e * (0.35 + 0.4 * Math.sin(tprev / 200 + i)); ctx.fillStyle = i % 2 ? '#ffd27a' : '#7fe8c0'; ctx.beginPath(); ctx.arc(px, py, 2, 0, 7); ctx.fill() }
      } else {
        ctx.globalAlpha = e; ctx.fillStyle = '#e8b8a8'; ctx.font = '14px system-ui'; ctx.fillText(collided ? '撞包了:两个包挤进了同一格' : overflowed ? '机器失控:包在无限增殖' : stuck ? '卡住了:有包堵在缓冲队列里出不来' : `送错 ${wrong} 个 · 丢了 ${lost} 个`, tx, cardY + 72)
        ctx.fillStyle = '#d8c0a8'; ctx.font = '13px system-ui'; ctx.fillText(collided ? '一格一拍只容一个包 —— 把两股流分开走、或用队列错开半拍' : overflowed ? '多半是接成了环 —— 复制器的某个出口把包又送回了进料带' : stuck ? (lost > 0 ? '上游有包丢了(撞包?)—— 排序队列在等那个丢掉的号,先别让上游丢包' : '有个「排序」队列在等一个不会来的号 —— 该直通/错峰的队列右键切回「限速」') : (L.drops ?? 0) > 0 && lost !== L.drops ? `这一关本该按规矩拦下 ${L.drops} 个,你丢了 ${lost} 个 —— 该丢的丢、不该丢的一个都别丢` : '顺着箭头看看包走岔到哪了,调一处再来', tx, cardY + 100)
        ctx.fillStyle = '#d8a890'; ctx.font = '13px system-ui'; ctx.fillText('↓ 点「再搭一次」', tx, cardY + 128)
      }
      ctx.globalAlpha = 1; ctx.restore(); ctx.textAlign = 'left'
    }
  }
  // 左下:零件盘
  const T = trayGeo(), items = trayItems()
  ctx.textAlign = 'left'; ctx.font = '12px system-ui'; ctx.fillStyle = AMBER
  const tip = tool === 'router' ? '路由器:左键摆(重复点同格转向)· 右键循环「分法」—— 通道按 △□○ 上色告诉你谁走哪' : tool === 'arouter' ? '地址路由:左键摆 · 右键换「看二进制第几位」(从右数,0=最右那位)—— 那位是 0 走直、是 1 拐弯;几台串成一棵转发树,把每个地址送到它的网段' : tool === 'mask' ? '掩码判断:左键摆 · 右键调掩码长度 /n —— 两边地址按掩码只留高 n 位比一比,一样=同网段拐弯进本地口,不一样=直行交给网关' : tool === 'prefix' ? '前缀匹配:左键摆 · 右键切「路由条目」(101 / 10* / 1** / 默认)—— 命中拐弯进本网段、没命中直行给下一条。越具体的条目要摆在越上游,否则会被泛化条目提前吞掉' : tool === 'acl' ? '访问控制:左键摆 · 右键切「规则条目」—— 命中这条规则的包「当场拦下」(它没有出口,包是真的被丢掉);没命中的直行交给下一条。规则表从上往下第一条匹配即生效,所以「例外放行」必须摆在「通配拦截」的上游' : tool === 'cache' ? '缓存盒(ARP 缓存 / MAC 表):左键摆 —— 没记过这个地址的走直行(去广播问一次),记过的拐弯走直送道;它自己会边跑边记,盒上亮几格就是记下了几条' : tool === 'nat' ? 'NAT:左键摆 —— 唯一会「改写包」的零件。出方向把私网地址统统换成那一个公网地址;回程按会话表还原成原来那台机器,会话表里查不到的当场丢掉' : tool === 'queue' ? '缓冲队列:左键摆 · 右键切模式 —— 默认「限速」每拍放1个(削峰/错峰,直通不卡);「排序」按号重排(要收齐号才放,缺号会等)' : '零件盘 · 选一个,左键摆在格子里(重复点同格转向)'
  ctx.fillText(tip, T.x0, T.y - 8)
  ctx.fillStyle = 'rgba(30,24,16,.6)'; ctx.fillRect(T.x0 - 6, T.y - 4, (T.ts + T.gap) * items.length + 6, T.ts + 8)
  items.forEach((it, i) => { const x = T.x0 + i * (T.ts + T.gap), on = tool === it; ctx.fillStyle = on ? '#3a342a' : '#20190f'; ctx.fillRect(x, T.y, T.ts, T.ts); ctx.strokeStyle = on ? '#ffe6a8' : '#5a4e3a'; ctx.lineWidth = on ? 3 : 1.5; ctx.strokeRect(x, T.y, T.ts, T.ts); partIcon(it, x + T.ts / 2, T.y + T.ts / 2 - 5, T.ts * 0.46); ctx.fillStyle = on ? CREAM : '#9a8a6a'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(partName(it), x + T.ts / 2, T.y + T.ts - 7) })
  // ☰ 关卡 按钮(右上)
  const M = menuBtnGeo(); ctx.fillStyle = '#241d16'; ctx.fillRect(M.x, M.y, M.w, M.h); ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 1.5; ctx.strokeRect(M.x, M.y, M.w, M.h); ctx.fillStyle = CREAM; ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('☰ 关卡', M.x + M.w / 2, M.y + M.h / 2); ctx.textBaseline = 'alphabetic'; drawMusicBtn()
  // 右下:分数 / 目标 / 奖章
  const R = runGeo(); ctx.textAlign = 'right'
  ctx.font = '13px system-ui'; ctx.fillStyle = CREAM; ctx.fillText(`零件 ${partCount()} · 拍 ${step}`, R.x - 16, R.y + 12)
  if (isSandbox) { ctx.font = '12px system-ui'; ctx.fillStyle = '#9a8a6a'; ctx.fillText('自由沙盒 · 无输赢', R.x - 16, R.y + 30) }
  else {
    ctx.font = '12px system-ui'; ctx.fillStyle = '#9a8a6a'; ctx.fillText(`目标 ≤${L.par.parts}件 · ≤${L.par.cycles}拍`, R.x - 16, R.y + 30)
    if (done) { if (pass) { const mp = partCount() <= L.par.parts, mc = step <= L.par.cycles; ctx.fillStyle = TEAL; ctx.font = 'bold 15px system-ui'; ctx.fillText(`✓ 通过 ${mp ? '🏅件' : ''}${mc ? '🏅拍' : ''}`, R.x - 16, R.y + 50) } else { ctx.fillStyle = RED; ctx.font = 'bold 15px system-ui'; ctx.fillText(`✕ 失败 错${wrong} 丢${lost}`, R.x - 16, R.y + 50) } }
  }
  // 运行 / 停 / 下一关 主按钮
  ctx.fillStyle = running ? (isSandbox ? '#3a2e1a' : '#26332a') : goNext ? '#2f5a3f' : done ? '#3a2e1a' : '#2f5a3f'; ctx.fillRect(R.x, R.y, R.bw, R.bh); ctx.strokeStyle = running ? (isSandbox ? AMBER : TEAL) : done && !pass ? AMBER : '#7fe8c0'; ctx.lineWidth = 2.5; ctx.strokeRect(R.x, R.y, R.bw, R.bh)
  ctx.fillStyle = CREAM; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(running ? (isSandbox ? '⏸ 停下' : '运行中…') : goNext ? '▶ 下一关' : done ? '↻ 再搭一次' : '▶ 运行机器', R.x + R.bw / 2, R.y + R.bh / 2); ctx.textBaseline = 'alphabetic'
  // 再搭一次(可进下一关时的次按钮)
  if (goNext) { const RT = retryGeo(); ctx.fillStyle = '#3a2e1a'; ctx.fillRect(RT.x, RT.y, RT.bw, RT.bh); ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.strokeRect(RT.x, RT.y, RT.bw, RT.bh); ctx.fillStyle = CREAM; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('↻ 再搭一次', RT.x + RT.bw / 2, RT.y + RT.bh / 2); ctx.textBaseline = 'alphabetic' }
  // 进关小过场:从黑淡入
  if (enterFade > 0.01) { ctx.fillStyle = `rgba(10,8,5,${enterFade})`; ctx.fillRect(0, 0, W, H); enterFade = Math.max(0, enterFade - dt / 350) }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// dev 钩子
;(window as unknown as { __state: () => object }).__state = () => ({ lvl, running, done, pass, overflowed, stuck, collided, parts: partCount(), cycles: step, delivered, wrong, lost, okDrop, deliveredBy: [...deliveredBy] })
;(window as unknown as { __place: (r: number, c: number, kind: Kind, dir: number, mode?: number) => void }).__place = (r, c, kind, dir, mode = 0) => { if (editable(r, c)) grid[r]![c] = { kind, dir: (dir % 4) as Dir, mode } }
;(window as unknown as { __erase: (r: number, c: number) => void }).__erase = (r, c) => { if (editable(r, c)) grid[r]![c] = null }
;(window as unknown as { __run: () => void }).__run = run
;(window as unknown as { __reset: () => void }).__reset = resetSim
;(window as unknown as { __stepN: (n: number) => void }).__stepN = (n) => { for (let i = 0; i < n && running; i++) simStep() }
;(window as unknown as { __level: (i: number) => void }).__level = (i) => loadLevel(i)
;(window as unknown as { __play: (i: number) => void }).__play = (i) => { loadLevel(i); mode = 'play' }
;(window as unknown as { __menu: () => void }).__menu = () => { mode = 'menu' }
;(window as unknown as { __intro: () => object }).__intro = () => introRouter
;(window as unknown as { __introCpu: () => object }).__introCpu = () => introCpu

// —— 虾米课堂外壳:返回主页 / 暂停 / 关卡进度(本机 + 账号同步)——
HUB = mountHub({
  title: '搭机器 · 真路由器',
  key: 'world',
  //  房子里还有别的机器 —— 电脑那台点图就能进,Cache 在电脑肚子里,只能从这儿走
  links: [
    { label: '电脑 · CPU 流水线 →', href: pageUrl('cpu.html') },
    { label: '电脑 · Cache 内存层级 →', href: pageUrl('cache.html') },
    { label: '大模型 · 推理引擎 →', href: pageUrl('infer.html') },
    { label: '电脑 · 固态硬盘 →', href: pageUrl('ssd.html') },
  ],
  read: () => best,
  write: d => { if (d && typeof d === 'object') best = d as Record<number, Best> },
  reset: () => { best = {} },
  summary: () => {
    const done = LEVELS.filter((_, i) => passed(i)).length
    const lines = [`通过 ${done} / ${LEVELS.length} 关`]
    for (let i = 0; i < LEVELS.length; i++) {
      const b = best[i], L = LEVELS[i]!
      lines.push(b ? `${i}. ${L.name} —— 最好 ${b.parts} 件 ${b.cycles} 拍${b.parts <= L.par.parts ? ' 🏅省料' : ''}${b.cycles <= L.par.cycles ? ' 🏅飞快' : ''}`
        : `${i}. ${L.name} —— ${unlocked(i) ? '还没通' : '未解锁'}`)
    }
    return lines
  },
})
;(window as unknown as { __storyOk: () => boolean }).__storyOk = () => LEVELS.every((_, i) => typeof STORY[i] === 'string' && STORY[i]!.length > 0)
;(window as unknown as { __texts: () => string[] }).__texts = () => LEVELS.flatMap((l, i) => [l.name, l.hint, STORY[i] ?? ''])
