/**
 * 第三台设备 · Cache 的**对抗性审查**(内核级,穷举,不用浏览器)。
 *
 * 前两台的穷举判据都得隔着 playwright 打页面钩子;这台的内核是纯的(game/build/cache-core.ts),
 * 所以整套穷举直接跑在 node 里、进 npm test —— 秒级,而且每次改引擎都会立刻见分晓。
 *
 * 问的还是那三句:
 *   ① **有没有哪台错的机器碰巧也能过?** —— 穷举一关里所有合法配法(两刀 × 路数 × 零件组合),
 *      凡是「达标却绕开了这一关考点」的,一律判红。
 *   ② **这一关是不是怎么配都能过?** —— 达标的配法数有上限,顶破了说明目标定松了。
 *   ③ **cache 到底透不透明?** —— 所有关卡 × 所有配法,结果必须一字不差地等于「不要 cache 直接跑」。
 *      这一条是引擎自检:脏块忘了刷、预取把刚搬回来的块顶掉导致写丢 —— 都栽在这儿。
 *      (写这台机器时就栽过一次:预取会顶掉当前块,那条 store 直接写丢了。)
 */
import { ok } from './harness.ts'
import { LEVELS, sweep, runCache, runFlat, sameAsFlat, allConfigs, type Cfg, type Part } from '../game/build/cache-core.ts'

/** 每一关「非有不可」的那一格:达标的配法里但凡有一种不满足它,这一关就没被钉死。 */
type Need = { ob?: number; waysMin?: number; parts?: Part[] }
const REQUIRED: Record<number, Need> = {
  0: { ob: 6 },                                  // 顺序流:唯一的出路是把块开到最大
  1: { ob: 1 },                                  // 碗底就在 B=2,两头都更差
  2: { waysMin: 2 },                             // 冲突缺失:容量再大也没用,得让一组放得下两块
  3: { waysMin: 2, parts: ['lru'] },             // 2 路 + 踢最久没用的那个
  4: { parts: ['wb'] },                          // 写多读少:非写回不可
  5: { parts: ['pf'] },                          // 强制缺失:只能靠提前搬
  7: {},                                         // (占位,当前只有 7 关)
}
/** 达标配法数的上限 —— 「怎么配都能过」的关等于没考点。 */
const HIT_CAP: Record<number, number> = { 0: 1, 1: 2, 2: 15, 3: 8, 4: 4, 5: 1, 6: 3 }
const show = (c: Cfg) => `B=${1 << c.ob} S=${1 << c.ib} W=${c.ways}${c.lru ? '+LRU' : ''}${c.wb ? '+写回' : ''}${c.pf ? '+预取' : ''}`

export function run() {
  console.log('\n— 第三台设备 · Cache —')

  /* ③ 先问透明性:所有关卡 × 所有配法,结果都必须等于「不要 cache 直接跑」 */
  let combos = 0, wrong: string[] = []
  for (const [i, L] of LEVELS.entries())
    for (const c of sweep(L)) { combos++; if (!c.ok) wrong.push(`L${i} ${show(c.cfg)}`) }
  //  空跑自检:配法一少(比如 allConfigs 的容量约束写反了),下面每一条都会「0 例外」地绿过去
  ok(combos >= 800, `穷举了 ${combos} 种「关卡 × 配法」—— 太少的话下面的判据等于空跑`)
  ok(wrong.length === 0,
    `cache 是透明的:${combos} 种配法跑出来的 load 值与内存映像,全部等于「不要 cache 直接跑」`
    + (wrong.length ? ` ⚠️ 对不上 ${wrong.length} 种,例:${wrong.slice(0, 3).join(' / ')}` : ''))

  /* ①② 每一关:达标的配法存在、数量有上限、且都绕不开考点 */
  for (const [i, L] of LEVELS.entries()) {
    const all = sweep(L)
    const hit = all.filter(c => c.cycles <= L.par.cycles)
    ok(hit.length > 0, `L${i}「${L.name}」目标 ${L.par.cycles} 拍够得着(${all.length} 种配法里 ${hit.length} 种达标)`)
    ok(hit.length <= (HIT_CAP[i] ?? 0),
      `L${i}:达标的只有 ${hit.length} 种(上限 ${HIT_CAP[i]})—— 多出来说明目标定松了,这一关就没考点了`)
    const need = REQUIRED[i]; if (!need) continue
    const cheat = hit.filter(c =>
      (need.ob !== undefined && c.cfg.ob !== need.ob)
      || (need.waysMin !== undefined && c.cfg.ways < need.waysMin)
      || (need.parts ?? []).some(p => !c.cfg[p]))
    const what = [need.ob !== undefined ? `块=${1 << need.ob}` : '', need.waysMin ? `≥${need.waysMin} 路` : '', ...(need.parts ?? [])].filter(Boolean).join(' + ')
    ok(cheat.length === 0,
      `L${i}:达标的配法里没有一种能绕开〈${what}〉` + (cheat.length ? ` ⚠️ 例外 ${cheat.length} 种:${show(cheat[0]!.cfg)}` : ''))
  }

  /* 每一关都真的比默认配置(一刀不下 = 1 个字的 cache)强 —— 否则玩家什么都不做也能过 */
  for (const [i, L] of LEVELS.entries()) {
    const bare = runCache(L.trace, { ob: 0, ib: 0, ways: L.wayOpts[0]!, lru: false, wb: false, pf: false })
    ok(bare.cycles > L.par.cycles, `L${i}:开局那台(1 个字的 cache)要 ${bare.cycles} 拍,够不着 ${L.par.cycles} —— 不动手过不去`)
  }

  /* 容量约束真的在管事:allConfigs 只能吐出 块×组×路 ≤ 上限 的配法 */
  for (const [i, L] of LEVELS.entries()) {
    const over = allConfigs(L).filter(c => (1 << c.ob) * (1 << c.ib) * c.ways > L.cap)
    ok(over.length === 0, `L${i}:穷举出来的配法没有一种超出芯片面积(容量 ≤ ${L.cap} 字)`)
  }

  /* —— 下面全是**能判红的自检**:判据本身有没有鉴别力 —— */
  {
    //  a) 比较函数认不认得出「读到的值错了」
    const L = LEVELS[0]!, r = runCache(L.trace, { ob: 3, ib: 1, ways: 1, lru: false, wb: false, pf: false })
    const broken = { ...r, loads: [...r.loads] }; broken.loads[5] = broken.loads[5]! + 1
    ok(!sameAsFlat(L.trace, broken), '自检:load 读错一个值,透明性判据确实会判红')
  }
  {
    //  b) 认不认得出「脏块没刷回去」—— 这正是写回机器最容易出的那个错
    const L = LEVELS[4]!, cfg = { ob: 3, ib: 0, ways: 1, lru: false, wb: true, pf: false }
    const r = runCache(L.trace, cfg)
    ok(r.wbacks > 0, `自检:写回机器确实发生过 ${r.wbacks} 次整块写回 —— 一次都没有的话,上面那条透明性判据根本没走到刷脏块那段`)
    const broken = { ...r, mem: new Map(r.mem) }
    const k = [...broken.mem.keys()][0]!; broken.mem.set(k, broken.mem.get(k)! + 1)
    ok(!sameAsFlat(L.trace, broken), '自检:内存里错一个字,透明性判据确实会判红')
  }
  {
    //  c) 参考解释器自己不能是空的 —— 它一旦返回空,「全部相等」就成了空话
    const ref = runFlat(LEVELS[6]!.trace)
    ok(ref.loads.length >= 40 && ref.mem.size >= 3, `自检:参考解释器在终关读了 ${ref.loads.length} 次、写了 ${ref.mem.size} 个字`)
  }
  {
    //  d) LRU 和 FIFO 必须真的不一样(替换那关全靠这个差别撑着)
    const L = LEVELS[3]!, base = { ob: 0, ib: 0, ways: 2, wb: false, pf: false }
    const a = runCache(L.trace, { ...base, lru: true }).cycles, b = runCache(L.trace, { ...base, lru: false }).cycles
    ok(a < b, `自检:同一段访存,LRU ${a} 拍 < 先进先出 ${b} 拍 —— 两种踢法要是跑出一样的数,那一关就是假的`)
  }
  {
    /*  e) 预取有代价:找得到「装了反而更慢」的配法 —— 不然〈预取〉就是白送的,那一关不成立。
        ⚠️ 第一版只在 L5 找,红了。查过之后是**我的文案在骗人**,不是引擎错:
        L5 是纯顺序流,预取捎回来的下一块本来就是马上要用的,而替换逻辑又不许它顶掉刚搬回来的那块
        —— 所以那一关的预取只会「挤不进来」,不会「咬人」。真的污染出现在**终关的混合访存**里
        (预取块把那张反复读的小表挤出去)。判据跟着事实走,两关的 hint 也照事实改了。 */
    const worse: string[] = []
    for (const [i, L] of LEVELS.entries())
      for (const c of allConfigs(L))
        if (c.pf && runCache(L.trace, c).cycles > runCache(L.trace, { ...c, pf: false }).cycles) { worse.push(`L${i} ${show(c)}`); break }
    ok(worse.length > 0, `自检:确实存在「装了预取反而更慢」的配法(${worse.join(' / ')})—— 预取污染是真的,不是我在文案里说说`)
    const l5 = allConfigs(LEVELS[5]!).filter(c => c.pf).every(c =>
      runCache(LEVELS[5]!.trace, c).cycles <= runCache(LEVELS[5]!.trace, { ...c, pf: false }).cycles)
    ok(l5, 'L5 那一关的预取只会「挤不进来」、不会「咬人」—— 它的 hint 是按这个事实写的,变了就得改文案')
  }
}
