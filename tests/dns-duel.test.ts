import { DnsDuel } from '../game/cards/dns-duel.ts'
import type { FaultKind } from '../solvers/dns/state.ts'
import { ok } from './harness.ts'

/**
 * 路由器副本 v2 · 多回合对战(和冰箱同构)。测的是只有"真 DnsSim + 真多回合动态"才成立的性质:
 * 探针读真时间线/真缓存且不改物理、每种故障对症才通(sim 判)、脏缓存拖太久被上游重新灌回(反扑)、
 * 断网时钟会输。全绿=这条路真接了引擎、没退化成脚本。
 */
export function run() {
  console.log('— 路由器副本 v2(多回合·故障反扑)—')

  // 开局有真症状(打不开),但只到"家族"、不点名故障;读数没探到之前是空的
  {
    const d = new DnsDuel('poisoned-cache').snapshot()
    ok(!d.won && d.status.includes('打不开') && Object.keys(d.known).length === 0, `开局真症状不点名:${d.status.slice(0, 18)}…`)
  }

  // 顶层症状分两大家族:解析就失败 vs 翻出错地址——靠它先分家族
  {
    const down = new DnsDuel('server-down').snapshot().status
    const pois = new DnsDuel('poisoned-cache').snapshot().status
    ok(down.includes('没翻成地址') && pois.includes('拨过去没人应') && down !== pois, '两大家族的顶层症状可区分(解析失败 vs 翻出错地址)')
  }

  // 探针读真值、不改物理:连探两次读数一样,故障没被"修"掉
  {
    const d = new DnsDuel('poisoned-cache')
    const v1 = d.play('probe-cache').known.cache
    const v2 = d.play('probe-cache').known.cache
    ok(v1 === v2 && v1!.includes('10.0.0.66'), `探针不改物理:两次都读到脏记录 ${v1}`)
    ok(d.snapshot().root === 'poisoned-cache' && !d.won, '探完针,故障还在、也没通')
  }

  // 探针有诊断力:服务器家族里,拨测能分"连不上"(挂了) vs "超时"(慢)
  {
    ok(new DnsDuel('server-down').play('probe-server').known.server!.includes('连不上'), 'probe-server:server-down → 连不上')
    ok(new DnsDuel('server-slow').play('probe-server').known.server!.includes('超时'), 'probe-server:server-slow → 超时')
  }

  // 每种故障:对症处置(真 sim 判)才通
  const RIGHT: Record<Exclude<FaultKind, 'none'>, string> = {
    'server-down': 'switch-dns', 'server-slow': 'raise-timeout',
    'poisoned-cache': 'clear-cache', 'ttl-too-long': 'clear-cache', 'hosts-hijack': 'edit-hosts',
  }
  for (const fault of Object.keys(RIGHT) as (keyof typeof RIGHT)[]) {
    ok(new DnsDuel(fault).play(RIGHT[fault]).won, `[${fault}] 对症「${RIGHT[fault]}」→ sim 判通了`)
  }

  // 错处置 = 白费一回合(故障没清、断网涨)
  {
    const d = new DnsDuel('poisoned-cache'); d.play('edit-hosts')
    const s = d.snapshot()
    ok(!s.won && s.root === 'poisoned-cache' && s.downtime > 0, '出错卡:没通、故障还在、断网涨了')
  }

  // 核心反扑:脏缓存拖太久 → 上游被喂顽固(涌现),且可被"及时清掉"扼杀
  {
    const slow = new DnsDuel('poisoned-cache');['probe-server', 'probe-hosts', 'wait'].forEach(m => slow.play(m))
    slow.play('clear-cache')
    ok(slow.entrenched && !slow.won, '脏缓存拖太久→反扑(上游顽固),这一下光清本地清不掉')
    ok(!slow.play('clear-cache').won, '没换 DNS,再清一次照样被重新灌回')
    slow.play('switch-dns')
    ok(slow.play('clear-cache').won, '先换掉这台 DNS(绕过被污染的上游)再清 → 才通')

    const fast = new DnsDuel('poisoned-cache'); fast.play('clear-cache')
    ok(fast.won && !fast.entrenched, '早早清掉 → 从不进入顽固(反扑可被扼杀)')
  }

  // 时钟真会输:一直不动手,断网积满 → 判输
  {
    const d = new DnsDuel('poisoned-cache')
    for (let i = 0; i < 12 && !d.lost; i++) d.play('wait')
    ok(d.snapshot().lost && d.snapshot().downtime >= 100, '光刷新不修 → 断网积到 100% → 判输')
  }

  // 诊断必须比乱试划算:一次拆错方向远贵于一次探针,连拆错直接输
  {
    const p = new DnsDuel('poisoned-cache'); p.play('probe-cache')
    const w = new DnsDuel('poisoned-cache'); w.play('edit-hosts') // 缓存的毛病却去删 hosts=拆错方向
    ok(w.snapshot().downtime > p.snapshot().downtime * 2 + 8, `一次拆错方向(断网${w.snapshot().downtime}%)远贵于一次探针(${p.snapshot().downtime}%)`)
    const blind = new DnsDuel('poisoned-cache');['edit-hosts', 'raise-timeout', 'switch-dns'].forEach(m => blind.play(m))
    ok(blind.lost || blind.snapshot().downtime >= 80, `连拆错方向 3 次 → 濒死/直接输(断网${blind.snapshot().downtime}%)`)
  }

  // 分层下钻:下探到"权威"跟手里的地址一比,才抓得出"缓存是过期旧值"(深层知识,只有走到真相源才成立)
  {
    const d = new DnsDuel('ttl-too-long')
    const cache = d.play('probe-cache').known.cache!
    ok(cache.includes('超长'), `翻缓存:像样的地址、但 TTL 超长可疑(${cache})`)
    const auth = d.play('probe-authority').known.authority!
    ok(auth.includes('不对'), `下探问权威 → 一比,抓出缓存那条是旧的(${auth})`)
    ok(d.play('clear-cache').won, '清掉过期缓存 → 重新走到权威拿新值 → 通了')
  }
  // server-down:问权威 → "真相有、可你没拿到",说明断在上游(还没走到权威)
  {
    const auth = new DnsDuel('server-down').play('probe-authority').known.authority!
    ok(auth.includes('还没拿到'), `服务器挂了 → 问权威:真相有、可你没走到这儿(${auth})`)
  }
}
