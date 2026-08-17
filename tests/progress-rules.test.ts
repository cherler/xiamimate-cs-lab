/**
 * 学习进度的规则。
 *
 * 这些是**纯函数**，不该拿浏览器去验 —— 用例写起来绕，还容易把
 * 前后的浏览器用例带崩（第一版就是这么把后面的测试搞挂的）。
 * 浏览器那边只留"存得住、跳得对、偏离时不记账"这类真正需要 UI 的。
 */
import * as P from '../web/src/progress.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

const K = 'p#0'
/** 依次作答，返回末态状态 */
const after = (...seq: boolean[]) => {
  let s: P.Store = { v: 1, q: {} }
  seq.forEach((c, i) => { s = P.record(s, K, c, 1000 + i) })
  return { store: s, rec: s.q[K], status: P.statusOf(s.q[K]) }
}

console.log('\n【状态判定】')

{
  P.statusOf(undefined) === 'untouched'
    ? ok('没做过 → untouched')
    : bad('没做过却不是 untouched')
}

// ── 一次做对就算掌握 —— 从没错过的题不该进错题本 ────────
{
  const r = after(true)
  r.status === 'mastered'
    ? ok('第一次就答对（从没错过）→ 直接算掌握，不进错题本')
    : bad(`一次做对却是 ${r.status}`)
}

// ── 错过之后要连续答对两次 ────────────────────────────
{
  const a = after(false)
  const b = after(false, true)
  const c = after(false, true, true)
  a.status === 'wrong' && b.status === 'shaky' && c.status === 'mastered'
    ? ok(`错 → ${a.status}；错·对 → ${b.status}；错·对·对 → ${c.status}`)
    : bad(`巩固规则不对：${a.status} / ${b.status} / ${c.status}`)
}

// ── 中间再错一次，连对计数必须清零重来 ─────────────────
{
  const r = after(false, true, false, true)
  const r2 = after(false, true, false, true, true)
  r.status === 'shaky' && r2.status === 'mastered' && r.rec.streak === 1
    ? ok('错·对·错·对 → 仍在巩固（连对计数被清零），再对一次才出师')
    : bad(`连对计数没清零：${r.status}（streak=${r.rec.streak}）/ ${r2.status}`)
}

// ── 掌握之后又答错，必须重新回到错题本 ─────────────────
{
  const r = after(true, false)
  r.status === 'wrong' && P.statusOf(after(true).rec) === 'mastered'
    ? ok('已掌握的题后来答错 → 重新回到错题本')
    : bad(`掌握后答错却是 ${r.status}`)
}

console.log('\n【计数与队列】')

// ── attempts / wrong 必须如实累加 ─────────────────────
{
  const r = after(false, true, false, false, true)
  r.rec.attempts === 5 && r.rec.wrong === 3 && r.rec.streak === 1
    ? ok(`作答 5 次错 3 次：attempts=${r.rec.attempts} wrong=${r.rec.wrong} streak=${r.rec.streak}`)
    : bad(`计数不对：${JSON.stringify(r.rec)}`)
}

// ── firstCorrectAt 只记第一次答对的时刻 ────────────────
{
  let s: P.Store = { v: 1, q: {} }
  s = P.record(s, K, false, 100)
  s = P.record(s, K, true, 200)
  s = P.record(s, K, true, 300)
  s.q[K].firstCorrectAt === 200
    ? ok('firstCorrectAt 记的是第一次答对的时刻（200），不被后来的覆盖')
    : bad(`firstCorrectAt=${s.q[K].firstCorrectAt}，应为 200`)
}

// ── 队列排序：错的排在巩固中的前面 ─────────────────────
{
  let s: P.Store = { v: 1, q: {} }
  s = P.record(s, P.keyOf('a', 0), false, 100)          // 错一次
  s = P.record(s, P.keyOf('b', 0), false, 110)          // 错两次
  s = P.record(s, P.keyOf('b', 0), false, 120)
  s = P.record(s, P.keyOf('c', 0), false, 130)          // 错后对一次 → 巩固中
  s = P.record(s, P.keyOf('c', 0), true, 140)
  s = P.record(s, P.keyOf('d', 0), true, 150)           // 一次就对 → 不进队列
  const all = ['a', 'b', 'c', 'd'].map(id => ({ problemId: id, qi: 0 }))
  const q = P.reviewQueue(s, all).map(x => x.problemId)
  q.join(',') === 'b,a,c'
    ? ok(`队列顺序 ${q.join(' → ')}：错得多的最前，巩固中的最后，一次做对的不入列`)
    : bad(`队列顺序不对：${q.join(',')}，应为 b,a,c`)
}

// ── 统计四类互斥且加起来等于总数 ───────────────────────
{
  let s: P.Store = { v: 1, q: {} }
  s = P.record(s, P.keyOf('a', 0), false, 100)
  s = P.record(s, P.keyOf('b', 0), true, 110)
  const all = [
    { problemId: 'a', qi: 0 }, { problemId: 'b', qi: 0 },
    { problemId: 'c', qi: 0 }, { problemId: 'c', qi: 1 },
  ]
  const st = P.statOf(s, all)
  st.total === 4 && st.wrong === 1 && st.mastered === 1 && st.untouched === 2
    && st.mastered + st.shaky + st.wrong + st.untouched === st.total
    ? ok(`统计：总 ${st.total} = 掌握 ${st.mastered} + 巩固 ${st.shaky} + 错 ${st.wrong} + 没做 ${st.untouched}`)
    : bad(`统计不对：${JSON.stringify(st)}`)
}

console.log('\n【自检】')
{
  //  判据得会红：把"一次做对即掌握"那条去掉，第 2 条就该失败
  const r = after(true)
  const naive = r.rec.streak >= P.MASTER_STREAK ? 'mastered' : 'shaky'
  naive !== r.status
    ? ok(`自检：只看 streak 的旧规则会把"一次做对"判成 ${naive}，与现在的 ${r.status} 不同 —— 第 2 条判据有鉴别力`)
    : bad('自检失败：新旧规则在这个用例上结果相同，第 2 条判据说明不了问题')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
