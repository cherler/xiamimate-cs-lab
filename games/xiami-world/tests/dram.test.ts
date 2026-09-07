/**
 * 第六台设备 · 内存条(DRAM 控制器)的**对抗性审查**(内核级,穷举,不用浏览器)。
 *
 * 和固态硬盘一样,这台**真的会读错**:写攒在缓冲里还没排下去,读绕过去就读到旧值。
 * 所以判据是四条:
 *   ① 有没有哪台配错的控制器碰巧也达标? —— 穷举,达标却绕开考点的判红
 *   ② 这一关是不是怎么配都能过?         —— 达标配法数有上限
 *   ③ 该读对的读对、该读错的读错         —— 只有「有写缓冲、没转发」才准读错
 *   ④ 文案里说的那几件事是不是真的       —— 开页/关页各有各赢的场合、交织真比高位强、
 *      调度窗口越大越好、〈转发〉不要钱(它只改值不改时间)
 */
import { ok } from './harness.ts'
import { LEVELS, sweep, runDram, runInOrder, sameAsInOrder, decode, T, type Cfg, type Part } from '../game/build/dram-core.ts'

type Need = { banksMin?: number; bankBits?: Cfg['bankBits']; window?: number; page?: Cfg['page']; parts?: Part[] }
const REQUIRED: Record<number, Need> = {
  0: { page: 'open' },                                           // 有局部性:开着那一行才有行命中
  1: { page: 'closed' },                                         // 没局部性:关页反而快(同一个旋钮,反过来拨)
  2: { banksMin: 2 },                                            // bank 并行
  3: { bankBits: 'low' },                                        // bank 位切在低位(交织)
  4: { parts: ['sched'], window: 16, page: 'open' },             // 调度器 + 窗口开到最大
  5: { parts: ['wbuf', 'fwd'] },                                 // 写缓冲省掉头,转发保正确
  6: { parts: ['sched', 'wbuf', 'fwd'], banksMin: 4, bankBits: 'low', page: 'open' },
}
const HIT_CAP: Record<number, number> = { 0: 1, 1: 1, 2: 4, 3: 2, 4: 2, 5: 2, 6: 1 }
const show = (c: Cfg) => `${c.banks}bank${c.banks > 1 ? '/' + (c.bankBits === 'low' ? '交织' : '高位') : ''}`
  + `${c.sched ? ' 窗' + c.window : ''} ${c.page === 'open' ? '开页' : '关页'}${c.sched ? ' +调度' : ''}${c.wbuf ? ' +写缓冲' : ''}${c.fwd ? ' +转发' : ''}`

export function run() {
  console.log('\n— 第六台设备 · 内存条(DRAM)—')

  /* ③ 读对读错:只有「有写缓冲、没转发、而且真撞上了」才准读错 */
  let combos = 0
  const badWrong: string[] = [], badRight: string[] = []
  for (const [i, L] of LEVELS.entries()) for (const c of sweep(L)) {
    combos++
    const mayStale = c.cfg.wbuf && !c.cfg.fwd
    if (!c.ok && !mayStale) badWrong.push(`L${i} ${show(c.cfg)}`)
    if (c.ok && mayStale && c.hazards > 0) badRight.push(`L${i} ${show(c.cfg)} 撞了 ${c.hazards} 次却还读对了`)
  }
  ok(combos >= 150, `穷举了 ${combos} 种「关卡 × 配法」—— 太少的话下面的判据等于空跑`)
  ok(badWrong.length === 0,
    `除了「有写缓冲、没装转发」那几种,别的配法一律读对`
    + (badWrong.length ? ` ⚠️ 不该错却错了 ${badWrong.length} 种:${badWrong.slice(0, 3).join(' / ')}` : ''))
  ok(badRight.length === 0,
    `读到的地址正躺在写缓冲里,没转发就一定读到旧值 —— 撞了却还「读对」说明这一关的对错轴是假的`
    + (badRight.length ? ` ⚠️ ${badRight.slice(0, 2).join(' / ')}` : ''))
  ok(LEVELS.filter(L => sweep(L).some(c => c.hazards > 0)).length >= 2,
    '至少有两关真的撞上了「读要的东西还在写缓冲里」—— 一关都不撞的话,对错轴根本没被考过')

  /* ①② 每一关:达标的存在、数量有上限、绕不开考点 */
  for (const [i, L] of LEVELS.entries()) {
    const all = sweep(L)
    const hit = all.filter(c => c.ok && c.time <= L.par.time)
    ok(hit.length > 0, `L${i}「${L.short}」目标 ${L.par.time} 拍够得着(${all.length} 种配法里 ${hit.length} 种达标)`)
    ok(hit.length <= (HIT_CAP[i] ?? 0), `L${i}:达标的只有 ${hit.length} 种(上限 ${HIT_CAP[i]})—— 多出来说明目标定松了`)
    const need = REQUIRED[i]!
    const cheat = hit.filter(c =>
      (need.banksMin !== undefined && c.cfg.banks < need.banksMin)
      || (need.bankBits !== undefined && c.cfg.bankBits !== need.bankBits)
      || (need.window !== undefined && c.cfg.window !== need.window)
      || (need.page !== undefined && c.cfg.page !== need.page)
      || (need.parts ?? []).some(p => !c.cfg[p]))
    const what = [need.banksMin ? `≥${need.banksMin} bank` : '', need.bankBits === 'low' ? 'bank 位交织' : '',
      need.window ? `窗口 ${need.window}` : '', need.page ? (need.page === 'open' ? '开页' : '关页') : '', ...(need.parts ?? [])].filter(Boolean).join(' + ')
    ok(cheat.length === 0, `L${i}:达标的配法里没有一种能绕开〈${what}〉` + (cheat.length ? ` ⚠️ 例外:${show(cheat[0]!.cfg)}` : ''))
  }

  /* 开局那台(什么都不装、1 bank)必须够不着 */
  for (const [i, L] of LEVELS.entries()) {
    const cfg: Cfg = { banks: L.bankOpts[0]!, bankBits: L.bankBitOpts[0]!, window: L.winOpts[0]!, page: L.pageOpts[0]!, sched: false, wbuf: false, fwd: false }
    const r = runDram(L.reqs, cfg)
    ok(!(sameAsInOrder(L.reqs, r) && r.time <= L.par.time),
      `L${i}:开局那台(什么都不装,${r.time} 拍)够不着 ${L.par.time} —— 不动手过不去`)
  }

  /* ④ 文案里说的那几件事,是不是真的 */
  {
    //  a) 开页和关页各有各赢的场合 —— 这台机器最反直觉的一点,也是 L0/L1 那对关卡的全部内容
    const base = { banks: 2, bankBits: 'low' as const, window: 1, sched: false, wbuf: false, fwd: false }
    const l0 = LEVELS[0]!, l1 = LEVELS[1]!
    const a1 = runDram(l0.reqs, { ...base, banks: 1, page: 'open' }).time
    const a2 = runDram(l0.reqs, { ...base, banks: 1, page: 'closed' }).time
    const b1 = runDram(l1.reqs, { ...base, banks: 1, page: 'open' }).time
    const b2 = runDram(l1.reqs, { ...base, banks: 1, page: 'closed' }).time
    ok(a1 < a2 && b2 < b1,
      `开页/关页真的各有各赢的场合:有局部性那段 开页 ${a1} < 关页 ${a2};没局部性那段 关页 ${b2} < 开页 ${b1}`)
  }
  {
    /*  b) 三种访问各值多少拍,得和文案里说的对得上:
        行命中 = CAS、关页 = ACT+CAS、开页碰上换行 = PRE+ACT+CAS。
        ⚠️ 这条不是凑数的:第一版模型把预充电记在 bank 时间线上,于是开页和关页每次访问
        都是 45 拍、跑出来分毫不差,「关页反而更快」那一关整个不成立。改成「自动预充电和
        数据传输重叠」之后才有 30 vs 45 —— 哪天有人把那行改回去,这条会先红。 */
    const one = (reqs: typeof LEVELS[0]['reqs'], page: Cfg['page']) =>
      runDram(reqs, { banks: 1, bankBits: 'low', window: 1, page, sched: false, wbuf: false, fwd: false }).time
    const hitPair = [{ op: 'r' as const, a: 0 }, { op: 'r' as const, a: 1 }]
    const conflictPair = [{ op: 'r' as const, a: 0 }, { op: 'r' as const, a: 1024 }]
    ok(one(hitPair, 'open') === T.act + 2 * T.cas, `行命中就是一次 CAS:两次同行访问 ${one(hitPair, 'open')} 拍 = ACT + 2×CAS`)
    ok(one(conflictPair, 'open') === T.act + T.cas + T.pre + T.act + T.cas,
      `开页碰上换行要 PRE+ACT+CAS:${one(conflictPair, 'open')} 拍`)
    ok(one(conflictPair, 'closed') === 2 * (T.act + T.cas),
      `关页每次都是 ACT+CAS(预充电藏在数据传输里):${one(conflictPair, 'closed')} 拍`)
  }
  {
    //  c) bank 位取低位(交织)真比取高位强,而且 bank 忙碌真的摊开了
    const L = LEVELS[3]!
    const lo = runDram(L.reqs, { banks: 4, bankBits: 'low', window: 1, page: 'closed', sched: false, wbuf: false, fwd: false })
    const hi = runDram(L.reqs, { banks: 4, bankBits: 'high', window: 1, page: 'closed', sched: false, wbuf: false, fwd: false })
    ok(lo.time < hi.time, `交织 ${lo.time} 拍 < 高位 ${hi.time} 拍`)
    ok(lo.busy.every(b => b > 0) && hi.busy.filter(b => b > 0).length === 1,
      `交织把活摊到了 ${lo.busy.filter(b => b > 0).length} 个 bank 上,取高位则全压在 ${hi.busy.filter(b => b > 0).length} 个 bank 上`)
  }
  {
    //  d) 调度窗口越大越好(这一关的旋钮不能是摆设)
    const L = LEVELS[4]!
    const curve = L.winOpts.map(window => ({
      window, t: runDram(L.reqs, { banks: 1, bankBits: 'low', window, page: 'open', sched: window > 1, wbuf: false, fwd: false }).time,
    }))
    ok(curve.every((x, k) => k === 0 || x.t < curve[k - 1]!.t),
      `往后看得越远行命中越多:${curve.map(x => `窗${x.window}→${x.t}`).join('  ')}`)
  }
  {
    //  e) 〈写回读转发〉只改值不改时间 —— 所以它是「不装就白错」,而不是拿正确性换速度
    const L = LEVELS[5]!
    const base = { banks: 1, bankBits: 'low' as const, window: 4, page: 'open' as const, sched: true, wbuf: true }
    const a = runDram(L.reqs, { ...base, fwd: false }), b = runDram(L.reqs, { ...base, fwd: true })
    ok(a.time === b.time, `转发一分钱不要(${a.time} = ${b.time} 拍)—— 不装它纯粹是白读错,不存在「拿正确换速度」这回事`)
    ok(!sameAsInOrder(L.reqs, a) && sameAsInOrder(L.reqs, b), `不装转发就读到旧值(撞了 ${a.hazards} 次),装上就对了`)
  }
  {
    //  f) 写缓冲真的省下了总线掉头
    const L = LEVELS[5]!
    const base = { banks: 1, bankBits: 'low' as const, window: 1, page: 'open' as const, sched: false, fwd: true }
    const off = runDram(L.reqs, { ...base, wbuf: false }), on = runDram(L.reqs, { ...base, wbuf: true })
    ok(on.turns < off.turns && on.time < off.time,
      `写攒起来批量排:总线掉头从 ${off.turns} 次降到 ${on.turns} 次,时间 ${off.time} → ${on.time}`)
  }

  /* —— 能判红的自检 —— */
  {
    const L = LEVELS[0]!
    const r = runDram(L.reqs, { banks: 1, bankBits: 'low', window: 1, page: 'open', sched: false, wbuf: false, fwd: false })
    const broken = { ...r, reads: [...r.reads] }; broken.reads[2] = broken.reads[2]! + 1
    ok(!sameAsInOrder(L.reqs, broken), '自检:读错一个值,恒等性判据确实会判红')
    ok(runInOrder(L.reqs).length === 16, `自检:参考解释器在 L0 真的读了 ${runInOrder(L.reqs).length} 次`)
  }
  {
    //  地址切分本身要对得上:交织时相邻的行必须落到不同 bank
    const cfg: Cfg = { banks: 4, bankBits: 'low', window: 1, page: 'open', sched: false, wbuf: false, fwd: false }
    const banks = [0, 16, 32, 48].map(a => decode(a, cfg).bank)
    ok(new Set(banks).size === 4, `自检:交织切法下,连着的四行落在四个不同 bank(${banks.join(',')})`)
    const hiCfg: Cfg = { ...cfg, bankBits: 'high' }
    const hiBanks = [0, 16, 32, 48].map(a => decode(a, hiCfg).bank)
    ok(new Set(hiBanks).size === 1, `自检:取高位时这四行全压在同一个 bank(${hiBanks.join(',')})`)
  }
  {
    //  时序常数没被人改平 —— 三个都相等的话,行命中/冲突就没差别了,这台机器整个塌掉
    ok(T.act > 0 && T.cas > 0 && T.pre > 0 && T.turn > T.cas,
      `自检:时序常数还在(ACT ${T.act} / CAS ${T.cas} / PRE ${T.pre} / 掉头 ${T.turn})`)
  }
  {
    const texts = LEVELS.flatMap(l => [l.name, l.short, l.story, l.hint])
    const bad = texts.filter(t => /\*\*[一-龥]/.test(t))
    ok(texts.length >= 24, `读到 ${texts.length} 条关卡文案`)
    ok(bad.length === 0, `文案里没有漏网的 markdown 强调${bad.length ? ':' + bad[0]!.slice(0, 40) : ''}`)
  }
}
