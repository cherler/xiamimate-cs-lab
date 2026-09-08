/**
 * 贝叶斯 + 布隆：两处"屏幕上的数从哪来"的判据
 *
 * 都是用户 2026-09-08 提的：
 *   贝叶斯 —— 「那些概率值，是随手编的吗？我怎么没看到概率出处？」
 *             「'后验变先验'：为什么前一个后验概率，和后一个先验概率值不相等」
 *   布隆   —— 「实验区没有说单词怎么映射到位图的索引位置」
 *
 * 纪律：不写"记忆里的数"，验的是**性质**和**同一个数在几处印得一不一样**。
 */
import { run } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'
import { bayesKernel, type BayesState } from '../src/kernels/bayes.ts'
import { bloomKernel, type BloomState } from '../src/kernels/bloom.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

// ═══ 贝叶斯 ════════════════════════════════════════════
console.log('\n【贝叶斯：后验真的变成了下一次的先验】')

const bayesDoc = (p: Record<string, number>): SimDocument =>
  ({ kind: 'bayes', params: p, entities: [], streams: [] })
const bayesRun = (p: Record<string, number>) =>
  run(bayesKernel.compile(bayesDoc(p)), 200) as BayesState[]

const CFGS = [
  { prior: 1, sens: 90, fpr: 9, tests: 4 },
  { prior: 0.1, sens: 99, fpr: 1, tests: 5 },
  { prior: 10, sens: 80, fpr: 20, tests: 3 },
  { prior: 50, sens: 90, fpr: 5, tests: 2 },
]

// ── 1. 后验(t) 必须**逐位等于**先验(t+1) ────────────────
{
  const wrong: string[] = []
  for (const cfg of CFGS) {
    const runs = bayesRun(cfg).filter(s => s.phase === 'run')
    for (let k = 0; k + 1 < runs.length; k++) {
      if (runs[k].posterior !== runs[k + 1].prior)
        wrong.push(`${JSON.stringify(cfg)} 第 ${k + 1} 步后验 ${runs[k].posterior} ≠ 第 ${k + 2} 步先验 ${runs[k + 1].prior}`)
    }
  }
  wrong.length === 0
    ? ok(`${CFGS.length} 组配置：每一步的后验都原封不动成了下一步的先验（同一个数，不是"约等于"）`)
    : bad(wrong.slice(0, 2).join(' / '))
}

// ── 2. 第一步的先验必须就是参数里那个患病率 ──────────────
{
  const wrong = CFGS.filter(cfg => {
    const first = bayesRun(cfg).find(s => s.phase === 'run')!
    return Math.abs(first.prior - cfg.prior / 100) > 1e-9
  })
  wrong.length === 0
    ? ok('第一步的先验就是「患病率」那个旋钮的值 —— 参数真的进了引擎，不是摆设')
    : bad(`这些配置的起点先验对不上：${wrong.map(c => JSON.stringify(c)).join(' / ')}`)
}

// ── 3. 结论里那串链条必须是现算的 ────────────────────────
/*  原来 done 那一帧的日志写死成「1% → 9% → 50% → 91%」，只有最后一个是算的。
    参数一旦能调，写死的那串立刻变成假话，而屏幕上不会有任何东西提示你。 */
{
  const pct = (x: number) => (x * 100).toFixed(x < 0.1 ? 2 : 1) + '%'
  const wrong: string[] = []
  for (const cfg of CFGS) {
    const t = bayesRun(cfg)
    const runs = t.filter(s => s.phase === 'run')
    const want = [runs[0].prior, ...runs.map(s => s.posterior)].map(pct).join(' → ')
    const log = t.at(-1)!.log
    if (!log.includes(want)) wrong.push(`${JSON.stringify(cfg)}：结论里找不到现算的链「${want}」`)
  }
  wrong.length === 0
    ? ok('结论里那串「1% → 9% → …」是按当前参数现算出来的，四组配置各不相同')
    : bad(wrong.slice(0, 2).join(' / '))
  //  自检：拿一串肯定不对的链去找，必须找不到
  const t0 = bayesRun(CFGS[0])
  t0.at(-1)!.log.includes('1% → 9% → 50% → 91%')
    ? bad('自检没成立：写死的那串老链居然还在结论里')
    : ok('自检：写死的老链「1% → 9% → 50% → 91%」已经不在结论里了 —— 这条判据能红')
}

// ── 4. 同一个数在"帧里"和"日志里"必须印成同一个样子 ──────
/*  用户看到的不一致就出在这儿：帧里存的是舍入后的值、日志里印的是没舍入的，
    于是 0.502546 一处印 50.3%、一处印 50.2%，看起来就像"后验≠下一次先验"。 */
{
  const pct = (x: number) => (x * 100).toFixed(x < 0.1 ? 2 : 1) + '%'
  const wrong: string[] = []
  for (const cfg of CFGS) {
    for (const s of bayesRun(cfg).filter(x => x.phase === 'run')) {
      if (!s.log.includes(pct(s.prior))) wrong.push(`${JSON.stringify(cfg)} 第 ${s.nTests} 次：日志里的先验跟帧里的 ${pct(s.prior)} 印得不一样`)
      if (!s.log.includes(pct(s.posterior))) wrong.push(`${JSON.stringify(cfg)} 第 ${s.nTests} 次：日志里的后验跟帧里的 ${pct(s.posterior)} 印得不一样`)
    }
  }
  wrong.length === 0
    ? ok('每一步日志里印的先验/后验，跟读数栏读的是同一个数（舍入只做一次）')
    : bad(wrong.slice(0, 3).join(' / '))
}

// ═══ 布隆过滤器 ════════════════════════════════════════
console.log('\n【布隆：位号是算出来的，不是天上掉的】')

const bloomRun = () =>
  run(bloomKernel.compile({ kind: 'bloom', params: {}, entities: [], streams: [] } as SimDocument), 200) as BloomState[]

// ── 1. 屏幕上那几个位号，必须等于推算链自己算出来的 ──────
{
  const t = bloomRun()
  const wrong: string[] = []
  for (const s of t) {
    if (s.idx.length === 0) continue
    if (s.hashes.length !== s.idx.length) { wrong.push(`${s.word}：推算链 ${s.hashes.length} 行，位号 ${s.idx.length} 个`); continue }
    s.hashes.forEach((h, j) => {
      if (h.raw % s.m !== h.pos) wrong.push(`${s.word} h${j + 1}：${h.raw} mod ${s.m} ≠ ${h.pos}`)
      if (h.pos !== s.idx[j]) wrong.push(`${s.word} h${j + 1}：推算得 ${h.pos}，点亮的却是 ${s.idx[j]}`)
    })
  }
  wrong.length === 0
    ? ok('每个词的每个位号都能由「揉出的整数 mod m」现场复算出来，且跟真正点亮/查询的位一致')
    : bad(wrong.slice(0, 3).join(' / '))
}

// ── 2. 假阳性那一步必须真的是"撞位"，不是标错 ────────────
{
  const t = bloomRun()
  const fp = t.find(s => s.falsePositive)
  const wrong: string[] = []
  if (!fp) wrong.push('整条轨迹里没有假阳性 —— 这个实验的主角没出场')
  else {
    if (fp.truth) wrong.push(`${fp.word} 被标成假阳性，但它其实插过`)
    if (!fp.idx.every(i => fp.bits[i] === 1)) wrong.push(`${fp.word} 被标成假阳性，但它的位不是全 1`)
  }
  wrong.length === 0
    ? ok(`假阳性那一步（${fp!.word}）确实是「没插过 + k 位全被别人点亮」`)
    : bad(wrong.join(' / '))
}

console.log(failures === 0 ? '\n本套全部通过' : `\n${failures} 处不对`)
process.exit(failures === 0 ? 0 : 1)
