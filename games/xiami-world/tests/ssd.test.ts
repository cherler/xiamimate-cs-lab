/**
 * 第五台设备 · 固态硬盘的**对抗性审查**(内核级,穷举,不用浏览器)。
 *
 * 这台和前两台不一样:**它真的会读错**(写缓存没落盘就断电)。所以判据多一条轴:
 *   ① 有没有哪台配错的盘碰巧也达标?    —— 穷举,达标却绕开考点的判红
 *   ② 这一关是不是怎么配都能过?        —— 达标配法数有上限
 *   ③ 该读对的必须读对、该读错的必须读错 —— 只有「有写缓存、没掉电保护、而且中途真断了电」
 *      才允许读错;别的任何配法读错都是引擎的 bug
 *   ④ 文案里说的那几件事是不是真的      —— 预留空间的曲线、贪心比轮转省、磨损均衡真能压住擦除次数
 */
import { ok } from './harness.ts'
import { LEVELS, sweep, runSSD, runIdeal, sameAsIdeal, wa, type Cfg, type Part } from '../game/build/ssd-core.ts'

type Need = { capacity?: number; victim?: Cfg['victim']; parts?: Part[]; noParts?: Part[] }
const REQUIRED: Record<number, Need> = {
  0: { parts: ['ftl'] },                                        // 原地改不了 → 非映射层不可
  1: { parts: ['ftl'] },                                        // 垃圾回收与写放大
  2: { parts: ['ftl'], capacity: 48 },                          // 预留空间:容量必须压到客户底线
  3: { parts: ['ftl'], victim: 'greedy', capacity: 56 },        // 回收先挑有效页最少的
  4: { parts: ['ftl', 'wcache', 'plp'] },                       // 写缓存要快,掉电保护要对
  5: { parts: ['ftl', 'wear'] },                                // 磨损均衡
  6: { parts: ['ftl', 'wcache', 'plp', 'wear'], victim: 'greedy', capacity: 56 },
}
const HIT_CAP: Record<number, number> = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 1 }
const show = (c: Cfg) => `容量${c.capacity} ${c.victim === 'greedy' ? '贪心' : '轮转'}`
  + `${c.ftl ? ' +FTL' : ''}${c.wcache ? ' +缓存' : ''}${c.plp ? ' +保护' : ''}${c.wear ? ' +均衡' : ''}`
const meets = (L: typeof LEVELS[number], c: { time: number; maxErase: number; ok: boolean }) =>
  c.ok && c.time <= L.par.time && (L.par.maxErase === undefined || c.maxErase <= L.par.maxErase)

export function run() {
  console.log('\n— 第五台设备 · 固态硬盘 —')

  /* ③ 读对读错:只有「有缓存 + 没保护 + 真断过电」才准读错 */
  let combos = 0
  const badWrong: string[] = [], badRight: string[] = []
  for (const [i, L] of LEVELS.entries()) {
    const hasPower = L.trace(L.capOpts[0]!).some(t => t.op === 'power')
    for (const c of sweep(L)) {
      combos++
      const mayLose = hasPower && c.cfg.wcache && !c.cfg.plp
      if (!c.ok && !mayLose) badWrong.push(`L${i} ${show(c.cfg)}`)
      if (c.ok && mayLose && c.lost > 0) badRight.push(`L${i} ${show(c.cfg)} 丢了 ${c.lost} 页却还读对了`)
    }
  }
  ok(combos >= 70, `穷举了 ${combos} 种「关卡 × 配法」—— 太少的话下面的判据等于空跑`)
  ok(badWrong.length === 0,
    `除了「有写缓存、没掉电保护、又真断过电」那几种,别的配法一律读对`
    + (badWrong.length ? ` ⚠️ 不该错却错了 ${badWrong.length} 种:${badWrong.slice(0, 3).join(' / ')}` : ''))
  ok(badRight.length === 0,
    `断电真丢了页的盘,后面一定会读到旧值 —— 丢了却还「读对」说明这一关的对错轴是假的`
    + (badRight.length ? ` ⚠️ ${badRight.slice(0, 2).join(' / ')}` : ''))
  //  空跑自检:一关都没有断电事件的话,上面两条就都是空话
  ok(LEVELS.filter(L => L.trace(L.capOpts[0]!).some(t => t.op === 'power')).length >= 2,
    '至少有两关的操作流里真的插了「拔电源」—— 一关都没有的话,对错轴根本没被考过')

  /* ①② 每一关:达标的存在、数量有上限、绕不开考点 */
  for (const [i, L] of LEVELS.entries()) {
    const all = sweep(L)
    const hit = all.filter(c => meets(L, c))
    ok(hit.length > 0, `L${i}「${L.short}」目标 ${L.par.time} 拍${L.par.maxErase ? ` + 最大擦除 ≤ ${L.par.maxErase}` : ''} 够得着(${all.length} 种配法里 ${hit.length} 种达标)`)
    ok(hit.length <= (HIT_CAP[i] ?? 0), `L${i}:达标的只有 ${hit.length} 种(上限 ${HIT_CAP[i]})—— 多出来说明目标定松了`)
    const need = REQUIRED[i]!
    const cheat = hit.filter(c =>
      (need.capacity !== undefined && c.cfg.capacity !== need.capacity)
      || (need.victim !== undefined && c.cfg.victim !== need.victim)
      || (need.parts ?? []).some(p => !c.cfg[p]))
    const what = [need.capacity ? `容量${need.capacity}` : '', need.victim === 'greedy' ? '贪心回收' : '', ...(need.parts ?? [])].filter(Boolean).join(' + ')
    ok(cheat.length === 0, `L${i}:达标的配法里没有一种能绕开〈${what}〉` + (cheat.length ? ` ⚠️ 例外:${show(cheat[0]!.cfg)}` : ''))
  }

  /* 开局那台(什么都不装)必须够不着 */
  for (const [i, L] of LEVELS.entries()) {
    const cfg: Cfg = { capacity: L.capOpts[0]!, victim: L.victimOpts[0]!, ftl: false, wcache: false, plp: false, wear: false }
    const tr = L.trace(cfg.capacity)
    const r = runSSD(tr, cfg, L.nblk, L.ppb)
    ok(!meets(L, { time: r.time, maxErase: r.maxErase, ok: sameAsIdeal(tr, r) }),
      `L${i}:开局那台(什么都不装,${r.time} 拍)够不着 ${L.par.time} —— 不动手过不去`)
  }

  /* ④ 文案里说的那几件事,是不是真的 */
  {
    //  a) 预留空间:声称的容量越大(盘越满),写放大越高。这是这台机器的招牌曲线
    const L = LEVELS[2]!
    const curve = L.capOpts.map(cap => {
      const cfg: Cfg = { capacity: cap, victim: 'greedy', ftl: true, wcache: false, plp: false, wear: false }
      return { cap, wa: wa(runSSD(L.trace(cap), cfg, L.nblk, L.ppb)) }
    })
    const mono = curve.every((x, k) => k === 0 || x.wa > curve[k - 1]!.wa)
    ok(mono, `预留空间的曲线是单调的:${curve.map(x => `容量${x.cap}→WA ${x.wa.toFixed(2)}`).join('  ')}`)
    ok(curve[curve.length - 1]!.wa / curve[0]!.wa > 1.5,
      `两头拉得开(${curve[0]!.wa.toFixed(2)} → ${curve[curve.length - 1]!.wa.toFixed(2)})—— 差得太少的话,这一关就不值得设计`)
  }
  {
    //  b) 贪心真的比轮转省
    const L = LEVELS[3]!, cap = 56
    const mk = (victim: Cfg['victim']) => runSSD(L.trace(cap), { capacity: cap, victim, ftl: true, wcache: false, plp: false, wear: false }, L.nblk, L.ppb)
    const g = mk('greedy'), r = mk('round')
    ok(wa(g) < wa(r) && g.time < r.time, `挑有效页最少的那块真的更省:贪心 WA ${wa(g).toFixed(2)}/${g.time} 拍,轮转 WA ${wa(r).toFixed(2)}/${r.time} 拍`)
  }
  {
    //  c) 磨损均衡真的压得住最大擦除次数
    const L = LEVELS[5]!, cap = L.capOpts[0]!
    const mk = (wear: boolean) => runSSD(L.trace(cap), { capacity: cap, victim: 'greedy', ftl: true, wcache: false, plp: false, wear }, L.nblk, L.ppb)
    const a = mk(false), b = mk(true)
    ok(b.maxErase < a.maxErase, `磨损均衡把最惨那块的擦除次数从 ${a.maxErase} 压到 ${b.maxErase}`)
  }
  {
    //  d) 写放大真的大于 1 —— 这是整台机器的核心数字,它要是恒等于 1,后面四关全塌
    const L = LEVELS[1]!, cap = L.capOpts[0]!
    const r = runSSD(L.trace(cap), { capacity: cap, victim: 'greedy', ftl: true, wcache: false, plp: false, wear: false }, L.nblk, L.ppb)
    ok(wa(r) > 1.3 && r.gcRuns > 10,
      `垃圾回收真的跑起来了(${r.gcRuns} 次),写放大 ${wa(r).toFixed(2)} > 1 —— 等间隔的假随机写会让它恒等于 1,那一关就白设计了`)
  }

  /* —— 能判红的自检 —— */
  {
    const L = LEVELS[0]!, cap = L.capOpts[0]!, tr = L.trace(cap)
    const r = runSSD(tr, { capacity: cap, victim: 'greedy', ftl: true, wcache: false, plp: false, wear: false }, L.nblk, L.ppb)
    const broken = { ...r, reads: [...r.reads] }; broken.reads[0] = broken.reads[0]! + 1
    ok(!sameAsIdeal(tr, broken), '自检:读错一个值,恒等性判据确实会判红')
    ok(runIdeal(tr).length >= 3, `自检:理想盘在 L0 真的读了 ${runIdeal(tr).length} 次 —— 空数组的话「全部相等」就是空话`)
  }
  {
    //  没有 FTL 的那台真的很惨 —— 改一页付一整块的钱
    const L = LEVELS[0]!, cap = L.capOpts[0]!
    const a = runSSD(L.trace(cap), { capacity: cap, victim: 'greedy', ftl: true, wcache: false, plp: false, wear: false }, L.nblk, L.ppb)
    const b = runSSD(L.trace(cap), { capacity: cap, victim: 'greedy', ftl: false, wcache: false, plp: false, wear: false }, L.nblk, L.ppb)
    ok(b.time > 5 * a.time, `自检:不装 FTL 慢 ${(b.time / a.time).toFixed(1)} 倍 —— 「原地改不了」的代价是真的`)
  }
  {
    //  预留空间小到搬不动时,引擎必须炸出来,不许悄悄把写吞掉
    const L = LEVELS[2]!
    let threw = false
    try {
      runSSD(L.trace(78), { capacity: 78, victim: 'greedy', ftl: true, wcache: false, plp: false, wear: false }, L.nblk, L.ppb)
    } catch { threw = true }
    ok(threw, '自检:容量报到贴着物理容量(78/80)时,引擎会炸出来 —— 第一版是悄悄把那次写吞掉,读出来是旧值而「丢了几页」还显示 0')
  }
  {
    //  文案里不许有 markdown 强调(canvas 会原样画出星号)
    const texts = LEVELS.flatMap(l => [l.name, l.short, l.story, l.hint])
    const bad = texts.filter(t => /\*\*[一-龥]/.test(t))
    ok(texts.length >= 24, `读到 ${texts.length} 条关卡文案`)
    ok(bad.length === 0, `文案里没有漏网的 markdown 强调${bad.length ? ':' + bad[0]!.slice(0, 40) : ''}`)
  }
}
