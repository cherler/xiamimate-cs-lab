/**
 * 第七台设备 · GPU 的**对抗性审查**(内核级,穷举,不用浏览器)。
 *
 * 这台和固态硬盘、内存条一样**真的会算错**:分块之后忘了打同步栅栏,
 * 一个线程就会读到别的线程还没写完的那块共享内存。所以四条:
 *   ① 有没有哪台配错的 kernel 碰巧也达标? ② 是不是怎么配都能过?
 *   ③ 该算对的算对、该算错的算错 —— 只有「分了块又没打栅栏」才准错
 *   ④ 文案里说的那几件事是不是真的 —— 合并、分块、padding、占用率、发散,每一条都得量得出来
 */
import { ok } from './harness.ts'
import { LEVELS, sweep, runGpu, refC, sameAsRef, transactionsFor, conflictFor, cellOf, masked, N, WARP, BANKS, REGFILE, type Cfg } from '../game/build/gpu-core.ts'

type Need = { tile?: number; pad?: number; bLayout?: Cfg['bLayout']; regs?: number; mapping?: Cfg['mapping']; sync?: boolean }
const REQUIRED: Record<number, Need> = {
  0: { bLayout: 'row' },                                                   // 一个 warp 的 32 条地址要连着
  1: { tile: 16, sync: true },                                             // 搬进共享内存
  2: { sync: true },                                                       // 忘了打招呼就算错
  3: { pad: 1, sync: true },                                               // 每行多留一个字,错开 bank
  4: { regs: 32, sync: true },                                             // 寄存器压低换驻留 warp
  5: { mapping: 'sorted', sync: true },                                    // 让分支和 warp 对齐
  6: { tile: 32, pad: 1, bLayout: 'row', regs: 32, mapping: 'sorted', sync: true },
}
const HIT_CAP: Record<number, number> = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }
const show = (c: Cfg) => `${c.tile ? '块' + c.tile : '不分块'} pad${c.pad} B按${c.bLayout === 'row' ? '行' : '列'} 寄${c.regs} ${c.mapping === 'row' ? '按行铺' : '按分支分组'}${c.sync ? ' +同步' : ''}`

export function run() {
  console.log('\n— 第七台设备 · GPU —')

  /* ③ 算对算错:只有「分了块又没打栅栏」才准错 */
  let combos = 0
  const badWrong: string[] = [], badRight: string[] = []
  for (const [i, L] of LEVELS.entries()) for (const c of sweep(L)) {
    combos++
    const mayRace = c.cfg.tile > 0 && !c.cfg.sync
    if (!c.ok && !mayRace) badWrong.push(`L${i} ${show(c.cfg)}`)
    if (c.ok && mayRace) badRight.push(`L${i} ${show(c.cfg)} 分了块没打栅栏却还算对了`)
  }
  ok(combos >= 150, `穷举了 ${combos} 种「关卡 × 配法」—— 太少的话下面的判据等于空跑`)
  ok(badWrong.length === 0, `除了「分了块又没打栅栏」,别的配法一律算对`
    + (badWrong.length ? ` ⚠️ 不该错却错了 ${badWrong.length} 种:${badWrong.slice(0, 3).join(' / ')}` : ''))
  ok(badRight.length === 0, `分了块不打栅栏就一定算错 —— 还能算对说明这一关的对错轴是假的`
    + (badRight.length ? ` ⚠️ ${badRight.slice(0, 2).join(' / ')}` : ''))

  /* ①② 每一关:达标的存在、数量有上限、绕不开考点 */
  for (const [i, L] of LEVELS.entries()) {
    const all = sweep(L)
    const hit = all.filter(c => c.ok && c.time <= L.par.time)
    ok(hit.length > 0, `L${i}「${L.short}」目标 ${L.par.time} 拍够得着(${all.length} 种配法里 ${hit.length} 种达标)`)
    ok(hit.length <= (HIT_CAP[i] ?? 0), `L${i}:达标的只有 ${hit.length} 种(上限 ${HIT_CAP[i]})`)
    const need = REQUIRED[i]!
    const cheat = hit.filter(c => (Object.keys(need) as (keyof Need)[]).some(k => c.cfg[k] !== need[k]))
    ok(cheat.length === 0, `L${i}:达标的配法里没有一种能绕开〈${Object.entries(need).map(([k, v]) => `${k}=${v}`).join(' + ')}〉`
      + (cheat.length ? ` ⚠️ 例外:${show(cheat[0]!.cfg)}` : ''))
  }

  /* 开局那台(每个旋钮的第一档、栅栏没装)必须够不着 */
  for (const [i, L] of LEVELS.entries()) {
    const cfg: Cfg = { tile: L.tileOpts[0]!, pad: L.padOpts[0]!, bLayout: L.layoutOpts[0]!, regs: L.regOpts[0]!, mapping: L.mapOpts[0]!, sync: false }
    const r = runGpu(cfg)
    ok(!(sameAsRef(r) && r.time <= L.par.time),
      `L${i}:开局那台(${r.time} 拍${sameAsRef(r) ? '' : '、而且算错了'})够不着 —— 旋钮的默认值不能就是正解`)
  }

  /* ④ 文案里说的那几件事,是不是真的 */
  const base: Cfg = { tile: 16, pad: 1, bLayout: 'row', regs: 32, mapping: 'row', sync: true }
  {
    //  a) 访存合并:一个 warp 的 32 条地址连着就是一笔,散开就是 32 笔
    ok(transactionsFor(Array.from({ length: WARP }, (_, l) => l)) === 1, '32 条连着的地址合并成 1 笔事务')
    ok(transactionsFor(Array.from({ length: WARP }, (_, l) => l * N)) === WARP, `32 条隔着一整行的地址散成 ${WARP} 笔`)
    const row = runGpu({ ...base, tile: 0, sync: false }), col = runGpu({ ...base, tile: 0, sync: false, bLayout: 'col' })
    ok(col.trans > 10 * row.trans && col.time > row.time,
      `B 按列摆,显存事务从 ${row.trans} 涨到 ${col.trans},时间 ${row.time} → ${col.time}`)
  }
  {
    //  b) 分块真的把显存读降下来了
    const off = runGpu({ ...base, tile: 0, sync: false }), on = runGpu(base)
    ok(on.trans < off.trans / 4 && on.time < off.time,
      `分块之后显存事务从 ${off.trans} 降到 ${on.trans},时间 ${off.time} → ${on.time}`)
  }
  {
    //  c) bank 冲突:行宽正好等于 bank 数时 32 路全撞,多留一个字就全错开
    const stride32 = Array.from({ length: WARP }, (_, l) => l * 32)
    const stride33 = Array.from({ length: WARP }, (_, l) => l * 33)
    ok(conflictFor(stride32) === BANKS, `行宽 32(等于 bank 数)时,一列上的 32 个线程全撞同一个 bank`)
    ok(conflictFor(stride33) === 1, '行宽 33 时,那 32 条地址的 bank 号全错开')
    const p0 = runGpu({ ...base, tile: 32, pad: 0 }), p1 = runGpu({ ...base, tile: 32, pad: 1 })
    ok(p0.worstConflict === BANKS && p1.worstConflict === 1 && p1.time < p0.time,
      `padding 把最严重的冲突从 ${p0.worstConflict} 路降到 ${p1.worstConflict} 路,时间 ${p0.time} → ${p1.time}`)
  }
  {
    //  d) 占用率:驻留的 warp 越多,干等显存的拍数越少 —— 而且档位要真的拉得开
    const curve = [512, 128, 32].map(regs => runGpu({ ...base, regs }))
    ok(curve.every((r, k) => k === 0 || (r.resident > curve[k - 1]!.resident && r.stalled < curve[k - 1]!.stalled && r.time < curve[k - 1]!.time)),
      `寄存器压低 → 驻留 warp 变多 → 干等变少:${curve.map(r => `寄→驻留${r.resident}/等${r.stalled}/共${r.time}`).join('  ')}`)
    ok(curve[curve.length - 1]!.resident >= 8 && curve[0]!.resident <= 2,
      `驻留档位真的拉得开(${curve[0]!.resident} → ${curve[curve.length - 1]!.resident} 个 warp)—— 寄存器堆给小了这一关就没考头`)
  }
  {
    //  e) 分支发散:按行铺时每个 warp 都发散,按分支分组之后一个都不发散,而且真的更快
    const a = runGpu({ ...base, mapping: 'row' }), b = runGpu({ ...base, mapping: 'sorted' })
    ok(a.divergent === (N * N) / WARP && b.divergent === 0,
      `按行铺:${a.divergent} 个 warp 全发散;按分支分组:${b.divergent} 个`)
    ok(b.time < a.time,
      `而且真的更快(${a.time} → ${b.time})—— 掩码那一笔太轻的话,重排格子在合并上亏掉的会盖过省下的,结论就反了`)
    //  分组之后每个 warp 内的判定必须真的一致
    const warps = Array.from({ length: (N * N) / WARP }, (_, w) =>
      Array.from({ length: WARP }, (_, l) => { const c = cellOf(w * WARP + l, 'sorted'); return masked(c.i, c.j) }))
    ok(warps.every(ws => ws.every(x => x === ws[0])), '自检:按分支分组之后,每个 warp 里的 32 个线程判定完全一致')
    //  两种映射都得盖满全部格子,不能漏也不能重
    for (const m of ['row', 'sorted'] as const) {
      const seen = new Set(Array.from({ length: N * N }, (_, t) => { const c = cellOf(t, m); return c.i * N + c.j }))
      ok(seen.size === N * N, `自检:「${m === 'row' ? '按行铺' : '按分支分组'}」把 ${seen.size} 个格子分完了,不漏不重`)
    }
  }

  /* —— 能判红的自检 —— */
  {
    const r = runGpu(base)
    const broken = { ...r, C: [...r.C] }; broken.C[5] = broken.C[5]! + 1
    ok(!sameAsRef(broken), '自检:算错一格,恒等性判据确实会判红')
    ok(refC().length === N * N && refC().some(v => v > 0), `自检:参考解释器真的算出了 ${N * N} 个格子`)
    ok(REGFILE / (32 * WARP) >= 8, '自检:寄存器堆还够大(最小档能驻留 8 个以上 warp)')
  }
  {
    const texts = LEVELS.flatMap(l => [l.name, l.short, l.story, l.hint])
    const bad = texts.filter(t => /\*\*[一-龥]/.test(t))
    ok(texts.length >= 24, `读到 ${texts.length} 条关卡文案`)
    ok(bad.length === 0, `文案里没有漏网的 markdown 强调${bad.length ? ':' + bad[0]!.slice(0, 40) : ''}`)
  }
}
