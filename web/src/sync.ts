/**
 * 学习进度的云端同步 —— 并入虾米伙伴之后才有的那一半。
 *
 * ## 三条纪律
 *
 * 1. **不登录、后端不可达、单文件产物，一律照常能用。**
 *    本地那份（progress.ts）始终是权威的读写目标；云端只是主本。
 *    任何一次同步失败都不该让用户少做一道题。
 *
 * 2. **合并规则在这里，不在服务端。** 规则要懂记录的语义（哪一次作答更近），
 *    而 `app.lab_progress` 只该存整份 JSON。两处各写一套规则，迟早不一致。
 *
 * 3. **合并不是相加，这一点要说清楚。** 见 mergeRecord 的注释 ——
 *    我们做不到精确合并，那就别把它说成精确的。
 */
import type { QRecord, Store } from './progress.ts'
import { onPlatform } from './platform.ts'

const SESSION_URL = '/v1/session'
const PROGRESS_URL = '/v1/lab/progress'

export type CloudState =
  | { kind: 'unknown' }                                   // 还没问过
  | { kind: 'standalone' }                                // 没有主站（本机 dev / 单文件产物）
  | { kind: 'anon' }                                      // 主站在，但没登录
  | { kind: 'synced'; rev: number; at: number }           // 已同步
  | { kind: 'saving'; rev: number }                       // 正在写
  | { kind: 'error'; message: string; rev: number }       // 写失败，本地仍然是好的

/** 云端主本的当前版本号。0 = 从没写过。 */
let rev = 0
/** 上一次成功推上去的内容，用来判断"要不要推" —— 没变就别写。 */
let pushed = ''

const canonical = (q: Store['q']) =>
  JSON.stringify(Object.keys(q).sort().map(k => [k, q[k]]))

/**
 * 合并两条记录。
 *
 * **次数取较大值，不是相加。** 两台设备的记录有重叠的历史（第一次登录时
 * 双方都带着同一段本地记录），相加会把同一次作答数成两次 ——
 * 那比少数更糟：错题本会显示"错过 6 次"而你只错过 3 次，
 * 而这个数字是用来判断"这道题我是不是真不会"的。
 *
 * 取较大值的代价是**真·分头做题时会少算**：两台设备各答错一次，合并后仍是 1。
 * 这条不精确是明说的（进度面板上写着），不是没想到 ——
 * 要精确就得每次作答带一个唯一 id 存成事件流，那是另一个量级的东西，
 * 而这份数据的用途（该复习哪些题）根本不需要精确的次数。
 *
 * 「最近一次答对没有」这类**状态**字段则整组取自更近的那一次：
 * 逐字段各取各的会造出一个两边都不曾发生过的状态
 * （比如 streak=2 却 lastCorrect=false）。
 */
/**
 * 「更近的那一次」的全序。时间相同时**取更保守的那条**（还没答对 < 连对少 < 连对多）。
 *
 * 时间相同不是假想的：`Date.now()` 在同一毫秒里能返回两次，而合并的两份
 * 记录本来就常常同源。第一版写的是 `b.lastAt > a.lastAt ? b : a` ——
 * 平局时固定取 `a`，于是 `merge(a,b)` 与 `merge(b,a)` 会给出**不同的结果**：
 * 一个说"刚答对、连对 2 次"，另一个说"刚答错"。
 *
 * 那意味着**谁先登录决定了你的错题本长什么样**。而它藏得很深：
 * 我的随机用例跑 40 组一次都没红，因为 lastAt 取值范围有十万，撞不上。
 * 判据没打在真正的根因上，绿灯就什么都不说明 —— 下面的用例现在专门造平局。
 *
 * 平局取保守值的理由：这两份记录都声称是同一时刻的，我们没有依据说哪个真。
 * 那就宁可判成"还要再练一次"，而不是凭空给出一个掌握徽章。
 */
function fresher(a: QRecord, b: QRecord): QRecord {
  if (a.lastAt !== b.lastAt) return a.lastAt > b.lastAt ? a : b
  //  平局的比较必须是**全序**，把状态字段一个不落地排完。
  //
  //  第二版写成 `rank = lastCorrect ? streak : -1`，两条都"最近答错了"时
  //  rank 都是 -1，于是又回到"取左边" —— 交换律照样破。
  //  正常数据里 lastCorrect=false 一定伴随 streak=0（record 保证），
  //  但云端那份可能是旧版本或被人改过的，**判据不能只对合法数据成立**。
  if (a.lastCorrect !== b.lastCorrect) return a.lastCorrect ? b : a   // 没答对的更保守
  if (a.streak !== b.streak) return a.streak < b.streak ? a : b       // 连对少的更保守
  return a                                                           // 状态字段全等，取谁都一样
}

export function mergeRecord(a: QRecord | undefined, b: QRecord | undefined): QRecord {
  if (!a) return b!
  if (!b) return a
  const newer = fresher(a, b)
  const first = [a.firstCorrectAt, b.firstCorrectAt].filter((x): x is number => typeof x === 'number')
  //  meta(AI 事实题的 expId+题面)要留住 —— 否则同步一次错题本就认不出这条 AI 错题了。
  //  取更新那条的 meta(题面较新);它没有就退而取任一有的(expId 稳定、跨设备一致)。
  const meta = newer.meta ?? a.meta ?? b.meta
  return {
    attempts: Math.max(a.attempts, b.attempts),
    wrong: Math.max(a.wrong, b.wrong),
    streak: newer.streak,
    lastCorrect: newer.lastCorrect,
    lastAt: newer.lastAt,
    ...(first.length ? { firstCorrectAt: Math.min(...first) } : {}),
    ...(meta ? { meta } : {}),
  }
}

export function mergeStores(a: Store, b: Store): Store {
  const q: Store['q'] = {}
  for (const k of new Set([...Object.keys(a.q), ...Object.keys(b.q)])) {
    q[k] = mergeRecord(a.q[k], b.q[k])
  }
  return { v: 1, q }
}

/** 云端回来的 payload 可能是任何东西（旧版本、被人手改过）。挑得出的才要。 */
export function sanitize(payload: unknown): Store {
  const q: Store['q'] = {}
  if (payload && typeof payload === 'object') {
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      const r = v as Partial<QRecord>
      //  形状对不上就整条丢掉 —— 补默认值会造出一条"做过 0 次却答错过"的记录，
      //  它会一直挂在错题本上，而用户根本没做过那道题。
      if (typeof r?.attempts !== 'number' || typeof r?.wrong !== 'number'
        || typeof r?.streak !== 'number' || typeof r?.lastAt !== 'number'
        || typeof r?.lastCorrect !== 'boolean') continue
      //  AI 事实题的 meta(出处实验+题面)要留住 —— 形状不对就只丢 meta、记录本身还留。
      const m = r.meta
      const metaOk = !!m && typeof m === 'object' && typeof m.expId === 'string' && typeof m.label === 'string'
      q[k] = {
        attempts: r.attempts, wrong: r.wrong, streak: r.streak,
        lastCorrect: r.lastCorrect, lastAt: r.lastAt,
        ...(typeof r.firstCorrectAt === 'number' ? { firstCorrectAt: r.firstCorrectAt } : {}),
        ...(metaOk ? { meta: { expId: m!.expId, label: m!.label } } : {}),
      }
    }
  }
  return { v: 1, q }
}

async function loggedIn(): Promise<boolean | null> {
  //  独立形态下压根不打 —— 一个必然 404 的 /v1/session 会在控制台留下红字，
  //  把「控制台无错误」那条判据废掉。判据用挂载路径，理由见 platform.ts。
  if (!onPlatform()) return null
  try {
    const r = await fetch(SESSION_URL, { credentials: 'include' })
    if (!r.ok) return null
    const d = await r.json() as { user?: unknown }
    return !!d.user
  } catch {
    // 打不通就是"没有主站"，不是"没登录" —— 两者给用户看的话不一样：
    // 前者该说「独立模式」，后者该说「登录后可跨设备」。
    return null
  }
}

/**
 * 拉云端主本。
 * 返回 null 表示"没有云端"（未登录 / 后端不可达），调用方照常用本地那份。
 */
async function pullRaw(): Promise<Store | null> {
  const r = await fetch(PROGRESS_URL, { credentials: 'include' })
  if (r.status === 401) return null
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const d = await r.json() as { payload?: unknown; rev?: number }
  rev = d.rev ?? 0
  return sanitize(d.payload)
}

type PutErr = { code?: string; payload?: unknown; rev?: number }

/**
 * 推一份上去。撞版本号（别的设备写过了）就把服务端那份合并进来再推一次。
 *
 * **只重试一次。** 无限重试在两台设备同时改的时候会打转；而一次重试之后
 * 还撞上说明确实在并发写，那就等下一次改动再推 —— 本地那份没丢，不着急。
 */
async function pushRaw(store: Store, retry = true): Promise<Store> {
  const r = await fetch(PROGRESS_URL, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload: store.q, base_rev: rev }),
  })
  if (r.status === 409 && retry) {
    const d = await r.json().catch(() => ({})) as { detail?: PutErr }
    const server = sanitize(d.detail?.payload)
    rev = d.detail?.rev ?? rev
    const merged = mergeStores(store, server)
    return pushRaw(merged, false)
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const d = await r.json() as { rev?: number }
  rev = d.rev ?? rev
  pushed = canonical(store.q)
  return store
}

/**
 * 首次同步：拉下来、跟本地合并、必要时推回去。
 *
 * 返回合并后的 store（调用方要把它写回本地并重渲染），以及云端状态。
 * **任何一步失败都返回本地那份**，只是状态不同 —— 页面不会因此少任何东西。
 */
export async function firstSync(local: Store): Promise<{ store: Store; state: CloudState }> {
  const signedIn = await loggedIn()
  if (signedIn === null) return { store: local, state: { kind: 'standalone' } }
  if (!signedIn) return { store: local, state: { kind: 'anon' } }
  try {
    const cloud = await pullRaw()
    if (!cloud) return { store: local, state: { kind: 'anon' } }
    const merged = mergeStores(local, cloud)
    pushed = canonical(cloud.q)
    // 合并结果跟云端一模一样就不写 —— 每次开页面都写一次的话，
    // rev 会白白往上涨，别的设备每次都撞 409。
    if (canonical(merged.q) !== pushed) await pushRaw(merged)
    return { store: merged, state: { kind: 'synced', rev, at: Date.now() } }
  } catch (e) {
    return { store: local, state: { kind: 'error', message: String(e), rev } }
  }
}

let timer: ReturnType<typeof setTimeout> | null = null

/**
 * 改动之后推一次（防抖）。答一道题就发一次请求太吵，而攒太久又会丢
 * ——「关掉标签页时还没推上去」。1.5 秒是答题节奏下的折中。
 */
export function schedulePush(store: Store, onState: (s: CloudState) => void) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    if (canonical(store.q) === pushed) return       // 没变，别写
    onState({ kind: 'saving', rev })
    pushRaw(store)
      .then(() => onState({ kind: 'synced', rev, at: Date.now() }))
      .catch(e => onState({ kind: 'error', message: String(e), rev }))
  }, 1500)
}

/** 清空云端那份，返回新的版本号。本地的清空由调用方自己做。 */
export async function clearCloud(): Promise<number> {
  const r = await fetch(PROGRESS_URL, { method: 'DELETE', credentials: 'include' })
  if (!r.ok && r.status !== 401) throw new Error(`HTTP ${r.status}`)
  const d = await r.json().catch(() => ({})) as { rev?: number }
  rev = d.rev ?? rev
  pushed = canonical({})
  return rev
}

/** 测试用：把模块级的那点状态拨回初始值。 */
export function _reset() { rev = 0; pushed = ''; if (timer) clearTimeout(timer) }
