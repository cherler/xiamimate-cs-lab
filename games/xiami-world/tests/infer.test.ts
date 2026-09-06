/**
 * 第四台设备 · 大模型推理引擎的**对抗性审查**(内核级,穷举,不用浏览器)。
 *
 * 照 Cache 那台立下的规矩来:内核是纯的,所以整套穷举直接跑在 node 里、进 npm test。
 *
 * 问的还是那几句:
 *   ① 有没有哪台配错的引擎碰巧也达标? —— 穷举一关里所有合法配法,凡是「达标却绕开考点」的判红。
 *   ② 这一关是不是怎么配都能过? —— 达标配法数有上限。
 *   ③ 输出到底变没变? —— 所有关卡 × 所有配法,吐出来的 token 必须逐字等于「老老实实生成一遍」。
 *      **投机解码尤其吃这一条** —— 真系统的验收标准就是它。
 *
 * 外加这台特有的一条:④ 吞吐和吐字间隔是不是真的在打架(不打架的话,L4 那一关就是假的)。
 */
import { ok } from './harness.ts'
import { LEVELS, sweep, runEngine, runNaive, sameAsNaive, COST, type Cfg, type Part } from '../game/build/infer-core.ts'

/** 每一关「非有不可」的那一格。 */
type Need = { batch?: number; page?: number; spec?: number; parts?: Part[] }
const REQUIRED: Record<number, Need> = {
  0: { parts: ['kvcache'] },                                   // n² 塌成 n,只有这一条路
  1: { parts: ['kvcache', 'cont'] },                           // 静态批的气泡,非连续批不可
  2: { parts: ['kvcache', 'paged', 'cont'] },                  // 显存装不下,非分页不可
  3: { parts: ['kvcache', 'paged', 'cont'], page: 16 },        // 页大小的碗底
  4: { parts: ['kvcache', 'cont'], batch: 4 },                 // 吞吐与吐字间隔之间那一档
  5: { parts: ['kvcache', 'cont', 'speculate'], spec: 2 },     // 草稿长度的甜点
  6: { parts: ['kvcache', 'paged', 'cont', 'speculate'], batch: 4, spec: 2 },
}
/** 达标配法数的上限 —— 「怎么配都能过」的关等于没考点。 */
const HIT_CAP: Record<number, number> = { 0: 1, 1: 2, 2: 1, 3: 2, 4: 1, 5: 1, 6: 1 }
const show = (c: Cfg) => `批${c.batch}${c.paged ? ` 页${c.page}` : ''}${c.speculate ? ` 猜${c.spec}` : ''}`
  + `${c.kvcache ? ' +KV' : ''}${c.paged ? ' +分页' : ''}${c.cont ? ' +连续' : ''}${c.speculate ? ' +投机' : ''}`
/** 一台机器算不算达标:时间要够,卡了吐字间隔的关还得再过那一条。 */
const meets = (L: typeof LEVELS[number], c: { time: number; tpot: number }) =>
  c.time <= L.par.time && (L.par.tpot === undefined || c.tpot <= L.par.tpot)

export function run() {
  console.log('\n— 第四台设备 · 大模型推理引擎 —')

  /* ③ 输出恒等:所有关卡 × 所有配法 */
  let combos = 0
  const wrong: string[] = []
  for (const [i, L] of LEVELS.entries())
    for (const c of sweep(L)) { combos++; if (!c.ok) wrong.push(`L${i} ${show(c.cfg)}`) }
  //  空跑自检:配法一少(比如 allConfigs 的去重写过头了),下面每条都会「0 例外」地绿过去
  ok(combos >= 900, `穷举了 ${combos} 种「关卡 × 配法」—— 太少的话下面的判据等于空跑`)
  ok(wrong.length === 0,
    `吐出来的 token 逐字等于「老老实实生成一遍」(${combos} 种配法全过)`
    + (wrong.length ? ` ⚠️ 对不上 ${wrong.length} 种,例:${wrong.slice(0, 3).join(' / ')}` : ''))

  /* ①② 每一关:达标的存在、数量有上限、且绕不开考点 */
  for (const [i, L] of LEVELS.entries()) {
    const all = sweep(L)
    const hit = all.filter(c => meets(L, c))
    ok(hit.length > 0, `L${i}「${L.short}」目标 ${L.par.time} 拍${L.par.tpot ? ` + 吐字间隔 ≤ ${L.par.tpot}` : ''} 够得着(${all.length} 种配法里 ${hit.length} 种达标)`)
    ok(hit.length <= (HIT_CAP[i] ?? 0),
      `L${i}:达标的只有 ${hit.length} 种(上限 ${HIT_CAP[i]})—— 多出来说明目标定松了`)
    const need = REQUIRED[i]!
    const cheat = hit.filter(c =>
      (need.batch !== undefined && c.cfg.batch !== need.batch)
      || (need.page !== undefined && c.cfg.page !== need.page)
      || (need.spec !== undefined && c.cfg.spec !== need.spec)
      || (need.parts ?? []).some(p => !c.cfg[p]))
    const what = [need.batch ? `批${need.batch}` : '', need.page ? `页${need.page}` : '', need.spec ? `猜${need.spec}` : '', ...(need.parts ?? [])].filter(Boolean).join(' + ')
    ok(cheat.length === 0,
      `L${i}:达标的配法里没有一种能绕开〈${what}〉` + (cheat.length ? ` ⚠️ 例外 ${cheat.length} 种:${show(cheat[0]!.cfg)}` : ''))
  }

  /* 开局那台(什么都不装、批 1)必须够不着 —— 否则玩家什么都不做也能过 */
  for (const [i, L] of LEVELS.entries()) {
    const bare = runEngine(L.reqs, { batch: 1, page: L.pageOpts[0]!, spec: L.specOpts[0]!, kvcache: false, paged: false, cont: false, speculate: false }, L.vram, L.maxLen)
    ok(!meets(L, bare), `L${i}:开局那台(什么都不装、批 1)要 ${bare.time} 拍,够不着 ${L.par.time} —— 不动手过不去`)
  }

  /* ④ 这台特有:吞吐和吐字间隔真的在打架吗 */
  {
    const L = LEVELS[4]!
    const byBatch = L.batchOpts.map(b => ({
      b, r: runEngine(L.reqs, { batch: b, page: 8, spec: 0, kvcache: true, paged: false, cont: true, speculate: false }, L.vram, L.maxLen),
    }))
    const timeDown = byBatch.every((x, k) => k === 0 || x.r.time < byBatch[k - 1]!.r.time)
    const tpotUp = byBatch.every((x, k) => k === 0 || x.r.tpot > byBatch[k - 1]!.r.tpot)
    ok(timeDown && tpotUp,
      `批越大总时间越短、吐字间隔越长(${byBatch.map(x => `批${x.b}:${x.r.time}/${x.r.tpot}`).join('  ')})—— 两个读数要是同向走,那一关的张力就是假的`)
  }

  /* 那三条「碗底 / 甜点」是不是真的两头都更差 —— 关卡文案里写了,就得是真的 */
  {
    const L = LEVELS[3]!
    const curve = L.pageOpts.map(pg => ({ pg, t: Math.min(...sweep(L).filter(c => c.cfg.paged && c.cfg.page === pg).map(c => c.time)) }))
    const lo = curve[0]!, hi = curve[curve.length - 1]!, bot = curve.reduce((a, b) => b.t < a.t ? b : a)
    ok(bot.pg !== lo.pg && bot.pg !== hi.pg && lo.t > bot.t && hi.t > bot.t,
      `页大小的曲线真有碗底:最优在页 ${bot.pg}(${bot.t}),两头是页 ${lo.pg}(${lo.t})和页 ${hi.pg}(${hi.t})`)
  }
  {
    const L = LEVELS[5]!
    const ks = L.specOpts.filter(k => k > 0)
    const curve = ks.map(k => ({ k, t: Math.min(...sweep(L).filter(c => c.cfg.speculate && c.cfg.spec === k).map(c => c.time)) }))
    const lo = curve[0]!, hi = curve[curve.length - 1]!, bot = curve.reduce((a, b) => b.t < a.t ? b : a)
    ok(bot.k !== lo.k && bot.k !== hi.k && lo.t > bot.t && hi.t > bot.t,
      `草稿长度真有甜点:最优猜 ${bot.k}(${bot.t}),两头是猜 ${lo.k}(${lo.t})和猜 ${hi.k}(${hi.t})`)
  }

  /* 文案里不许有 markdown 强调 —— canvas 是 fillText 画的,`**加粗**` 会被原样画成星号。
     前三台各栽过一次,所以这条判据跟着内核走(文案就在这个文件里),不用等浏览器那份。 */
  {
    const texts = LEVELS.flatMap(l => [l.name, l.short, l.story, l.hint])
    const bad = texts.filter(t => /\*\*[\u4e00-\u9fa5]/.test(t))
    ok(texts.length >= 24, `读到 ${texts.length} 条关卡文案 —— 太少的话下一条等于空跑`)
    ok(bad.length === 0, `文案里没有漏网的 markdown 强调${bad.length ? ':' + bad[0]!.slice(0, 40) : ''}`)
    ok(/\*\*[\u4e00-\u9fa5]/.test('这是**加粗**'), '自检:那条正则确实认得出 markdown 强调')
  }

  /* —— 能判红的自检 —— */
  {
    //  a) 比较函数认不认得出「吐错一个 token」
    const L = LEVELS[0]!
    const r = runEngine(L.reqs, { batch: 1, page: 8, spec: 0, kvcache: true, paged: false, cont: false, speculate: false }, L.vram, L.maxLen)
    const broken = { ...r, gen: r.gen.map(g => [...g]) }
    broken.gen[0]![3] = (broken.gen[0]![3]! + 1) % 16
    ok(!sameAsNaive(L.reqs, broken), '自检:吐错一个 token,恒等性判据确实会判红')
    ok(runNaive(L.reqs)[0]!.length === L.reqs[0]!.out, `自检:参考解释器在 L0 真的生成了 ${L.reqs[0]!.out} 个 token —— 空数组的话「全部相等」就是空话`)
  }
  {
    //  b) 投机解码真的在投机(猜了、也中了),而且中了之后一步能多吐几个 —— 不然那一关的收益是假的
    const L = LEVELS[5]!
    const on = runEngine(L.reqs, { batch: 4, page: 8, spec: 2, kvcache: true, paged: false, cont: true, speculate: true }, L.vram, L.maxLen)
    const off = runEngine(L.reqs, { batch: 4, page: 8, spec: 0, kvcache: true, paged: false, cont: true, speculate: false }, L.vram, L.maxLen)
    ok(on.drafted > 0 && on.accepted > 0, `自检:投机确实猜了 ${on.drafted} 个、中了 ${on.accepted} 个`)
    ok(on.steps < off.steps, `自检:投机把步数从 ${off.steps} 压到 ${on.steps} —— 一步多吐几个,这才是它赚钱的地方`)
    ok(sameAsNaive(L.reqs, on), '自检:投机之后输出仍然逐字不变 —— 这是真系统的验收标准')
  }
  {
    //  c) 没有 KV Cache 的那台真的是 n² —— 序列翻倍,时间要涨到四倍上下
    const short = [{ prompt: [1, 2, 3, 4], out: 20 }], long = [{ prompt: [1, 2, 3, 4], out: 40 }]
    const cfg: Cfg = { batch: 1, page: 8, spec: 0, kvcache: false, paged: false, cont: false, speculate: false }
    const a = runEngine(short, cfg, 4096, 64).time, b = runEngine(long, cfg, 4096, 64).time
    ok(b / a > 2.4, `自检:不装 KV Cache 时,输出翻一倍、时间涨到 ${(b / a).toFixed(2)} 倍(超线性 —— n² 是真的,不是文案)`)
  }
  {
    //  d) 静态批的气泡真的存在:同样的配置,连续批的步数一定更少
    const L = LEVELS[1]!
    const base = { batch: 4, page: 8, spec: 0, kvcache: true, paged: false, speculate: false }
    const st = runEngine(L.reqs, { ...base, cont: false }, L.vram, L.maxLen)
    const co = runEngine(L.reqs, { ...base, cont: true }, L.vram, L.maxLen)
    ok(co.steps < st.steps, `自检:静态批走了 ${st.steps} 步、连续批只要 ${co.steps} 步 —— 差的就是给已经说完的请求空转的那些`)
  }
  {
    //  e) 分页真的省显存:同一关同一批大小,分页的峰值占用必须更低
    const L = LEVELS[2]!
    const base = { batch: 4, page: 16, spec: 0, kvcache: true, cont: true, speculate: false }
    const pg = runEngine(L.reqs, { ...base, paged: true }, L.vram, L.maxLen)
    const no = runEngine(L.reqs, { ...base, paged: false }, L.vram, L.maxLen)
    ok(pg.peak < no.peak, `自检:同样跑 4 个请求,分页峰值占 ${pg.peak}、不分页要 ${no.peak}(按 maxLen ${L.maxLen} 连续预留)`)
  }
  {
    //  f) 成本模型没被人偷偷改平 —— 读权重那笔必须远大于单个请求的注意力开销,
    //     否则批处理在账面上就不值钱了,L1/L4 两关一起塌
    ok(COST.stepFix >= 10 * COST.attn * 20, `自检:读权重(${COST.stepFix})远大于一个请求那点注意力开销 —— 它一小,批处理就不值钱了`)
  }
}
