/**
 * 实验单的内容规则。
 *
 * 和 `guide-content.test.ts` 同样的分工：这一套只验**文本自身立不立得住**，
 * 「③ 里说的旋钮页面上真有吗」「④ 的数是不是现算的」要跑起来才知道，
 * 那两条在冒烟第 15 组。
 *
 * 为什么不能在这里 import registry：注册表 import 了 `@engine/*` 和 .tsx 舞台，
 * 仓库根的 tsconfig 是给引擎用的（没有 paths、没有 jsx）。
 * `brief.ts` 因此刻意不认识 `SimDocument` —— 它和 App 在 `unknown` 上握手。
 */
import { BRIEFS, briefFor } from '../web/src/brief.ts'
import type { Goal } from '../web/src/brief.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

const entries = Object.entries(BRIEFS)

/**  跨块共用的假夹具（下面两块都要用）：
 *   一份**万能假状态** —— 把各内核末态里那几个标量凑在一个对象里，每个目标各取所需。 */
/*
 * 计网七个读的字段，同样凑成"全都不达成 / 全都达成"两份。
 *
 * ⚠️ 每一条阈值线都要**真的跨过去**，别从一两个数派生。
 * 上一轮就是派生的，`cycle` 和 `tlbHits` 恰好落在阈值同一侧，
 * 两份状态给出同一个 met，判据于是误报"这个目标是常量"。
 *
 * 对照的真实门槛（都是浏览器里量出来的，见 `brief.ts` 各目标上方的注释）：
 *   tcp       cwnd ≥ 12          arq  时隙 ≤ 20 且传输 ≤ 10
 *   crc       余数全 0            hamming 校验子 > 0
 *   subnet    可用主机 = 62       handshake 两端都 CLOSED
 *   csma      无人放弃且全部成功
 */
const NET_LO = {
  cwnd: 8,                                    //  tcp：够不着 12
  transmissions: 14, sent: { 0: 1, 1: 3, 2: 3, 3: 3, 4: 3, 5: 1 },  //  arq：14 > 10
  remainder: '1110',                          //  crc：不是全 0
  syndrome: 0,                                //  hamming：没查出错
  detail: { 可用主机数: '126' },               //  subnet：不是 62
  client: 'ESTABLISHED', server: 'ESTABLISHED',//  handshake：还没回 CLOSED
  done: [] as string[], aborted: ['A', 'B'], attempts: { A: 3, B: 3 },  //  csma：都放弃了
  //  semaphore：卡死（act 一路上有 deadlock 才算数，所以两份的 act 也要不同）
  act: 'deadlock', blocked: { P1: 'mutex', C1: 'full' } as Record<string, string>,
}
const NET_HI = {
  cwnd: 14,
  transmissions: 9, sent: { 0: 1, 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 },
  remainder: '0000',
  syndrome: 5,
  detail: { 可用主机数: '62' },
  client: 'CLOSED', server: 'CLOSED',
  done: ['A', 'B'], aborted: [] as string[], attempts: { A: 1, B: 1 },
  act: 'work', blocked: {} as Record<string, string>,
}

const fakeDoc = { params: {}, entities: [{ id: 'P1', type: 'process', at: 0, attrs: { burst: 1 } }] }
/** 供两块共用的"全都达成"那一份 */
const HI = [{ i: 9, hits: 8, faults: 1, total: 100, t: 5, completed: ['P1'],
              cycle: 8, tlbHits: 4, ptHits: 2, round: 4,
              ...NET_HI }]

console.log('\n【实验单 · 四段齐不齐】')
{
  ok(`共 ${entries.length} 个实验有实验单`)

  /*
   * ① 不许短。
   *
   * 这一段要回答"不懂这个会在哪儿吃亏"，一句"介绍 Cache 的原理"是废话 ——
   * 而废话和真话在代码里长得一样，只有长度挡得住占位符。
   * 80 字是拍的，写不满说明还没想清楚该讲什么。
   */
  const thin = entries.filter(([, b]) => b.care.length < 80)
  thin.length === 0 ? ok('① 都写满了 80 字以上') : bad(`① 过短：${thin.map(([k, b]) => `${k}(${b.care.length})`).join(', ')}`)

  const badGuess = entries.filter(([, b]) =>
    b.guess.q.trim().length < 10 || b.guess.opts.length < 2 || b.guess.opts.some(o => !o.trim()))
  badGuess.length === 0
    ? ok('② 都有一句问句和至少两个选项')
    : bad(`② 不完整：${badGuess.map(([k]) => k).join(', ')}`)

  /*
   * ③ 至少两条，且每条都要有"看什么"。
   *
   * 只写"把相联度拧一拧"而不说看哪儿，等于没说 —— 用户会拧完之后
   * 盯着一屏没变化的东西发呆。这一条是整层里最容易写漏的。
   */
  const badTasks = entries.filter(([, b]) =>
    b.tasks.length < 2 || b.tasks.some(t => !t.act.trim() || !t.watch.trim()))
  badTasks.length === 0
    ? ok('③ 每个实验至少两条动作，每条都写了"看什么"')
    : bad(`③ 不完整：${badTasks.map(([k]) => k).join(', ')}`)

  const noVerdict = entries.filter(([, b]) => typeof b.verdict !== 'function')
  noVerdict.length === 0
    ? ok('④ 都是函数 —— 结论现算，没有写死的句子')
    : bad(`④ 不是函数：${noVerdict.map(([k]) => k).join(', ')}`)
}

console.log('\n【④ 结论真的在算】')
{
  /**
   * 拿两份**假轨迹**喂给 Cache 的 verdict：同一份配置，命中率不同，
   * 结论文本必须不一样。
   *
   * 这条挡的是最坏的一种写法：`verdict` 是函数、返回的却是常量句子 ——
   * 类型上完全合法，读起来也像对的，而它一个字都不会跟着数据变。
   */
  const b = briefFor('cache')
  if (!b) { bad('cache 没有实验单'); }
  else {
    const doc = { params: { associativity: 2 } }
    //  runDoc 按传进来的相联度编造不同的命中率：1 路差、8 路好
    const fake = (assoc: number, hits: number) => [{ hits, i: 9, assoc }]
    const mk = (oneHits: number, eightHits: number) => (d: unknown) => {
      const a = Number((d as { params: Record<string, unknown> }).params.associativity)
      return fake(a, a === 1 ? oneHits : eightHits)
    }
    const A = b.verdict({ doc, trace: [{ hits: 5, i: 9 }], runDoc: mk(2, 8) })
    const B = b.verdict({ doc, trace: [{ hits: 5, i: 9 }], runDoc: mk(8, 8) })
    if (!A || !B) bad('④ 在正常输入上返回了 null')
    else {
      //  截头会截到两句相同的开头，看起来像"两个一样的字符串通过了" —— 截差异那一段
      const tail = (s: string) => s.slice(-30)
      A.say !== B.say
        ? ok(`换一组数，④ 结论跟着变（「…${tail(A.say)}」≠「…${tail(B.say)}」）`)
        : bad('④ 是函数但返回常量 —— 换了数结论一个字没变')
      A.pick !== B.pick
        ? ok(`对错判定也跟着变（${A.pick} ≠ ${B.pick}）—— 不是固定押一个答案`)
        : bad(`④ 的 pick 恒定为 ${A.pick}`)
    }
    //  空轨迹要老实返回 null，不能编一个结论出来
    b.verdict({ doc, trace: [], runDoc: mk(2, 8) }) === null
      ? ok('轨迹为空时返回 null —— 算不出来就不说')
      : bad('轨迹为空时也给了结论')
  }
}

console.log('\n【目标 · 达成判定真的在判】')
{
  /**
   * 目标是整层里唯一让**验证器直接面向用户**的地方，所以它最怕的坏法和 ④ 一样：
   * `state` 是函数、`met` 却是常量 —— 那就退化成一句永远亮着（或永远不亮）的标语，
   * 而标语正是这一层要替换掉的东西。
   */
  const withGoal = entries.filter(([, b]) => b.goal)
  ok(`${withGoal.length} / ${entries.length} 个实验有目标`)

  const thin = withGoal.filter(([, b]) => (b.goal!.say.trim().length < 8))
  thin.length === 0 ? ok('目标都写了一句话') : bad(`目标过短：${thin.map(([k]) => k).join(', ')}`)

  /*
   * 判据抽成一个函数，好让自检能拿假数据撞同一段逻辑 ——
   * 写成内联的话，"这条检查会不会红"就只能靠读，读不出来。
   */
  /*
   * 一份**万能假状态**：把各内核末态里那几个标量凑在一个对象里
   * （命中数 / 缺页数 / 累计寻道 / 时刻与完成表），每个目标各取所需。
   *
   * 不这么做的话，夹具就得按 30 种状态形状各写一份 —— 而这一套要验的
   * 不是"状态长什么样"（那是引擎测试的活），只是"换组数它会不会变"。
   * 加新实验时如果它读的字段不在这儿，这条判据会直接红，那正是提醒。
   */
  /*
   * 两份**显式**的假末态：一份"哪个目标都不达成"，一份"哪个目标都达成"。
   *
   * ⚠️ 第一版是从三个数派生出来的（`st(hits, faults, total, t)`），
   * 结果 `cycle` 和 `tlbHits` 恰好落在阈值同一侧 —— 两份状态给出同一个 met，
   * 判据就误报"这个目标是常量"。**夹具要显式跨过每一条阈值线**，
   * 派生省下的那几个字，换来的是一次看不懂的红。
   *
   * 加一个实验、它读了这儿没有的字段，这条判据同样会红 —— 那是提醒，不是故障。
   */
  const loSt = [{ i: 9, hits: 2, faults: 12, total: 600, t: 20, completed: ['P1'],
                  cycle: 40, tlbHits: 0, ptHits: 8, round: 8, ...NET_LO }]
  const hiSt = [{ i: 9, hits: 8, faults: 1, total: 100, t: 5, completed: ['P1'],
                  cycle: 8, tlbHits: 4, ptHits: 2, round: 4, ...NET_HI }]
  const lo = { doc: fakeDoc, trace: loSt, runDoc: () => loSt }
  const hi = { doc: fakeDoc, trace: hiSt, runDoc: () => hiSt }

  /*
   * **有两个目标喂不进上面那份万能夹具。**
   *
   * 它们不看轨迹，看的是"换个配置重跑一遍会怎样"（`runDoc`）或者题面本身
   * （`doc.streams` 里的操作数）—— 而万能夹具的 `runDoc` 是个常量函数、
   * `fakeDoc` 也没有 streams，于是两边算出同一个答案，判据就误报"这是常量"。
   *
   * 所以给这两个单配一份**会对参数作出反应**的上下文。这不是给判据开后门：
   * 判据要问的仍然是"换一组数它会不会变"，只是这两个目标的"一组数"
   * 长在别的地方。
   */
  /** 32 位浮点的位串 —— **算出来的**，不是照着记忆抄的 */
  const f32 = (x: number) => {
    const v = new DataView(new ArrayBuffer(4))
    v.setFloat32(0, x)
    return v.getUint32(0).toString(2).padStart(32, '0')
  }
  const mulTrace = (n: number) => Array.from({ length: n }, () => ({ act: 'add' }))
  /** 乘法：把两种算法各要几次加减编进假的 runDoc 里 */
  const mulCtx = (booth: number, plain: number) => ({
    doc: { params: { algorithm: 'Booth' }, entities: [] },
    trace: mulTrace(booth),
    runDoc: (d: { params: Record<string, unknown> }) =>
      mulTrace(d.params.algorithm === 'Booth' ? booth : plain),
  })
  /** 浮点：题面给的数 + 那个数真实的 32 位编码 */
  const floatCtx = (x: number) => ({
    doc: { params: { format: 'single' }, entities: [], streams: [{ name: 'operands', values: [x] }] },
    trace: [{ bits: f32(x) }],
    runDoc: () => [{ bits: f32(x) }],
  })
  const SPECIAL: Record<string, { lo: unknown; hi: unknown }> = {
    //  5 × 3 两种算法都是 2 次（不达成）；连续的 1 才是 Booth 的主场（达成）
    multiply: { lo: mulCtx(2, 2), hi: mulCtx(1, 4) },
    //  −12.5 二进制有限，存回来分毫不差（不达成）；0.1 存不下（达成）
    float: { lo: floatCtx(-12.5), hi: floatCtx(0.1) },
  }
  /** 换一组数（20% → 80%），达成判定和读数都得跟着变，才算真的在判 */
  const separates = (g: Goal, id?: string) => {
    const sp = id ? SPECIAL[id] : undefined
    const a = g.state((sp?.lo ?? lo) as never), c = g.state((sp?.hi ?? hi) as never)
    return !!a && !!c && a.met !== c.met && a.now !== c.now
  }

  const flat = withGoal.filter(([k, b]) => !separates(b.goal!, k)).map(([k]) => k)
  flat.length === 0
    ? ok('换一组数，目标的达成判定和读数都跟着变 —— 不是常量')
    : bad(`目标没跟着数据走：${flat.join(', ')}`)

  const nulls = withGoal.filter(([, b]) =>
    b.goal!.state({ doc: { params: {} }, trace: [], runDoc: () => [] } as never) !== null)
  nulls.length === 0
    ? ok('轨迹为空时目标返回 null —— 算不出来就不判')
    : bad(`轨迹为空还给了判定：${nulls.map(([k]) => k).join(', ')}`)

  /*
   * 自检：上面那条判据必须真的会红。
   * 拿一个**永远达成**的假目标喂给同一个 `separates` —— 它必须被挡下；
   * 同时真目标必须过得去。只验前半截不够：一个永远返回 false 的判据
   * 也能"挡下"假目标，却把真的一起挡了。
   */
  const fake: Goal = { say: '永远达成', state: () => ({ now: '恒定', met: true }) }
  !separates(fake) && withGoal.every(([k, b]) => separates(b.goal!, k))
    ? ok('自检：常量目标被这条判据挡下、真目标过得去 —— 它能红，也不会误杀')
    : bad(`自检失败：假目标 separates=${separates(fake)}，`
          + `真目标全过=${withGoal.every(([k, b]) => separates(b.goal!, k))}`)
}

console.log('\n【`**` 都是成对的】')
{
  /*
   * 四层文本共用 `**…**` 加粗（`shell/rich.tsx` 是唯一那份实现）。
   * 星号个数是奇数 = 有一处没闭合 = 屏幕上会原样印出一个星号 ——
   * 这种错不报警、类型也合法，只有数一遍才看得见。
   *
   * ④ 和目标的文本是**算出来的**，所以要真的调一次才能数 —— 拿上面那份万能假状态喂。
   */
  const ctx = { doc: fakeDoc, trace: HI, runDoc: () => HI }
  const odd: string[] = []
  const check = (id: string, where: string, t: string | undefined) => {
    if (t && (t.split('**').length - 1) % 2 === 1) odd.push(`${id}.${where}`)
  }
  for (const [id, b] of entries) {
    check(id, 'care', b.care)
    check(id, 'guess.q', b.guess.q)
    b.tasks.forEach((t, i) => { check(id, `tasks[${i}].act`, t.act); check(id, `tasks[${i}].watch`, t.watch) })
    check(id, 'goal.say', b.goal?.say)
    const g = b.goal?.state(ctx as never); check(id, 'goal.now', g?.now)
    const v = b.verdict(ctx as never); check(id, 'verdict.say', v?.say); check(id, 'verdict.why', v?.why)
  }
  odd.length === 0
    ? ok(`${entries.length} 个实验的每一处文本，星号都是成对的`)
    : bad(`星号没闭合：${odd.join(', ')}`)

  //  自检：这条判据得真的抓得住
  const broken = '这里有一个**没闭合的强调'
  ;(broken.split('**').length - 1) % 2 === 1
    ? ok('自检：单个星号对确实会被判成没闭合 —— 它能红')
    : bad('自检失败：没闭合的强调没被认出来')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
