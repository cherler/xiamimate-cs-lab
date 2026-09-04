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

//  两种题共用一个 store,靠 key 前缀区分:
//    真题 = `${problemId}#${qi}`（keyOf）；AI 学伴事实题 = `fact:${factId}`（factKey）。
export type QKey = string

/** AI 学伴事实题的 key 前缀 —— 和真题的 `problemId#qi` 分属两个命名空间,互不撞。 */
export const FACT_PREFIX = 'fact:'
export const factKey = (factId: string): QKey => `${FACT_PREFIX}${factId}`
export const isFactKey = (k: QKey): boolean => k.startsWith(FACT_PREFIX)

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
  /** 仅 AI 学伴事实题:出处实验 + 最近一次题面。
   *  客户端不持有 factId 全集(在服务端 catalog),所以靠 meta.expId 把某实验的 AI 错题找回来、
   *  靠 label 在错题本里显示题面(题面是现场生成的,存最近一次即可)。 */
  meta?: { expId: string; label: string }
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

/** 记一次作答；返回新的 store（不可变，方便 React 触发重渲染）。
 *  meta 仅 AI 学伴事实题传（出处实验 + 题面），真题不传。 */
export function record(s: Store, k: QKey, correct: boolean, now = Date.now(), meta?: QRecord['meta']): Store {
  const old = s.q[k] ?? { attempts: 0, wrong: 0, streak: 0, lastCorrect: false, lastAt: 0 }
  const next: QRecord = {
    attempts: old.attempts + 1,
    wrong: old.wrong + (correct ? 0 : 1),
    streak: correct ? old.streak + 1 : 0,
    lastCorrect: correct,
    lastAt: now,
    firstCorrectAt: old.firstCorrectAt ?? (correct ? now : undefined),
    meta: meta ?? old.meta,   // 新 meta 覆盖(题面更新);没传就保留旧的
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

// ── AI 学伴事实题:靠 meta.expId 找回某实验答过的事实题（客户端没有 factId 全集，只能这么找） ──
export function aiRecordsOf(s: Store, expId: string): { key: QKey; rec: QRecord }[] {
  return Object.entries(s.q)
    .filter(([k, r]) => isFactKey(k) && r.meta?.expId === expId)
    .map(([key, rec]) => ({ key, rec }))
}

// ── 每实验掌握度：真题 + AI 事实合起来算（这是新的主口径，弱化全站 X/139） ──
export type Mastery = Stat & { attempted: number }

/** 某实验掌握度。trueSlots=该实验真题（可空）；aiTotal=该实验 AI 事实总数（端点给，可为 0）。
 *  total = 真题数 + aiTotal；没答过的 AI 事实算 untouched（计入 total、不计入 mastered）。 */
export function masteryOf(
  s: Store, expId: string,
  trueSlots: { problemId: string; qi: number }[], aiTotal: number,
): Mastery {
  const out: Mastery = { total: trueSlots.length + aiTotal, mastered: 0, shaky: 0, wrong: 0, untouched: 0, attempted: 0 }
  const tally = (st: QStatus) => { out[st]++; if (st !== 'untouched') out.attempted++ }
  for (const x of trueSlots) tally(statusOf(s.q[keyOf(x.problemId, x.qi)]))
  const ai = aiRecordsOf(s, expId)
  for (const { rec } of ai) tally(statusOf(rec))
  //  没答过的 AI 事实（aiTotal 比已记录的多的那部分）补成 untouched
  out.untouched += Math.max(0, aiTotal - ai.length)
  return out
}

// ── 错题本：真题 + AI 事实一起收，按"最该先练"排序 ──
export type ReviewItem =
  | { kind: 'true'; problemId: string; qi: number; rec: QRecord; status: QStatus }
  | { kind: 'ai'; key: QKey; factId: string; expId: string; label: string; rec: QRecord; status: QStatus }

export function reviewAll(
  s: Store,
  trueSlots: { problemId: string; qi: number }[],
  expIds?: Set<string>,   // 传了就只收这些实验的 AI 错题（按职业过滤）
): ReviewItem[] {
  const items: ReviewItem[] = []
  for (const x of trueSlots) {
    const rec = s.q[keyOf(x.problemId, x.qi)]; if (!rec) continue
    const status = statusOf(rec)
    if (status === 'wrong' || status === 'shaky') items.push({ kind: 'true', ...x, rec, status })
  }
  for (const [key, rec] of Object.entries(s.q)) {
    if (!isFactKey(key) || !rec.meta) continue
    if (expIds && !expIds.has(rec.meta.expId)) continue
    const status = statusOf(rec)
    if (status === 'wrong' || status === 'shaky') items.push({ kind: 'ai', key, factId: key.slice(FACT_PREFIX.length), expId: rec.meta.expId, label: rec.meta.label, rec, status })
  }
  return items.sort((a, b) =>
    (a.status === b.status ? 0 : a.status === 'wrong' ? -1 : 1)
    || (b.rec.wrong - a.rec.wrong)
    || (a.rec.lastAt - b.rec.lastAt))
}
