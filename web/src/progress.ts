/**
 * 学习进度与错题本。
 *
 * 只存在浏览器本地（localStorage），没有账号也没有后端 ——
 * 这一步先把"回来还认得你"做出来，账号是另一件事。
 *
 * 两条设计纪律：
 *
 * 1. **偏离原题配置时不记账。**
 *    答案是从当前轨迹派生的，配置一改题目就变了另一道 ——
 *    把它记成"这道题答对了"是假账。
 *
 * 2. **复习规则要能一句话说清，不装成算法。**
 *    一次做对就算掌握；**错过的题要连续答对两次**才算真掌握。
 *
 *    第一版是"一律要连续答对两次"，结果一次做对、从没错过的题
 *    也会被塞进错题本 —— 那栏就名不副实了。规则和名字必须对得上。
 *
 *    不做 SM-2 那套间隔重复：没有真实的时间跨度数据支撑它，
 *    硬套只会给出一个看着专业、实则拍脑袋的日期。
 */

export type QKey = string          // `${problemId}#${questionIndex}`

export type QRecord = {
  /** 总作答次数（只计未偏离原题的） */
  attempts: number
  /** 答错次数 */
  wrong: number
  /** 连续答对次数 —— 决定何时出师 */
  streak: number
  /** 最近一次是否答对 */
  lastCorrect: boolean
  /** 最近一次作答时间戳 */
  lastAt: number
  /** 第一次答对的时间戳；没答对过则缺省 */
  firstCorrectAt?: number
}

export type Store = { v: 1; q: Record<QKey, QRecord> }

const KEY = 'cslab.progress.v1'
const EMPTY: Store = { v: 1, q: {} }

/** 错过的题要连续答对几次才算重新掌握 */
export const MASTER_STREAK = 2

export function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Store
    //  存储格式变了就当没有 —— 宁可清空，也不要拿着半新半旧的数据算进度
    if (parsed?.v !== 1 || typeof parsed.q !== 'object') return EMPTY
    return parsed
  } catch {
    return EMPTY
  }
}

export function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 隐私模式下写不进，忽略 */ }
}

export function clearAll() {
  try { localStorage.removeItem(KEY) } catch { /* 同上 */ }
}

export const keyOf = (problemId: string, qi: number): QKey => `${problemId}#${qi}`

/** 记一次作答；返回新的 store（不可变，方便 React 触发重渲染） */
export function record(s: Store, k: QKey, correct: boolean, now = Date.now()): Store {
  const old = s.q[k] ?? { attempts: 0, wrong: 0, streak: 0, lastCorrect: false, lastAt: 0 }
  const next: QRecord = {
    attempts: old.attempts + 1,
    wrong: old.wrong + (correct ? 0 : 1),
    streak: correct ? old.streak + 1 : 0,
    lastCorrect: correct,
    lastAt: now,
    firstCorrectAt: old.firstCorrectAt ?? (correct ? now : undefined),
  }
  return { ...s, q: { ...s.q, [k]: next } }
}

/** 一道问题现在处于什么状态 */
export type QStatus = 'untouched' | 'wrong' | 'shaky' | 'mastered'

export function statusOf(r: QRecord | undefined): QStatus {
  if (!r || r.attempts === 0) return 'untouched'
  //  从没错过 + 这次对了 → 直接算掌握，不进错题本
  if (r.wrong === 0 && r.lastCorrect) return 'mastered'
  //  错过的题：要连续答对够次数才算重新掌握
  if (r.streak >= MASTER_STREAK) return 'mastered'
  return r.lastCorrect ? 'shaky' : 'wrong'
}

export const STATUS_LABEL: Record<QStatus, string> = {
  untouched: '还没做',
  wrong: '答错了',
  shaky: '错过之后已答对一次，再对一次就出师',
  mastered: '已掌握',
}

/**
 * 复习队列：需要再练的问题，按"最该先练"排在前面。
 * 排序依据：答错的排在答对一次的前面；同类里错得多的靠前，再同则做得久的靠前。
 */
export function reviewQueue(
  s: Store,
  all: { problemId: string; qi: number }[],
): { problemId: string; qi: number; rec: QRecord; status: QStatus }[] {
  return all
    .map(x => ({ ...x, rec: s.q[keyOf(x.problemId, x.qi)] }))
    .filter((x): x is typeof x & { rec: QRecord } => !!x.rec)
    .map(x => ({ ...x, status: statusOf(x.rec) }))
    .filter(x => x.status === 'wrong' || x.status === 'shaky')
    .sort((a, b) =>
      (a.status === b.status ? 0 : a.status === 'wrong' ? -1 : 1)
      || (b.rec.wrong - a.rec.wrong)
      || (a.rec.lastAt - b.rec.lastAt))
}

/** 一组问题的统计 */
export type Stat = { total: number; mastered: number; shaky: number; wrong: number; untouched: number }

export function statOf(s: Store, all: { problemId: string; qi: number }[]): Stat {
  const out: Stat = { total: all.length, mastered: 0, shaky: 0, wrong: 0, untouched: 0 }
  for (const x of all) out[statusOf(s.q[keyOf(x.problemId, x.qi)])]++
  return out
}
