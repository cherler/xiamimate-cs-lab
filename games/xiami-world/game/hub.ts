/**
 * 「虾米课堂」游戏外壳 —— 返回主页 / 暂停 / 进度管理 / 跟主站账号同步。
 *
 * ⚠️ **这个文件有两份逐字节相同的拷贝**:`games/algo-cards/hub.ts` 与
 *    `games/xiami-world/game/hub.ts`。两个游戏是 git subtree 收进来的独立仓,
 *    各自要能单独构建,所以不共享文件、也不跨目录 import。
 *    **改一处必须同步另一处**;`games/hub-sync-check.mjs` 会在两份不一致时判红。
 *
 * ## 三条纪律(照抄实验那边 sync.ts 的口径)
 *
 * 1. **不登录、后端不可达、独立跑,一律照常能玩。** 本地那份始终是权威的读写目标,
 *    云端只是主本;任何一次同步失败都不该让人少通一关。
 * 2. **判「有没有主站」用挂载路径,不去探。** 一个必然 404 的 /v1/session 会在
 *    控制台留红字,把「控制台无报错」那条判据废掉(实验那边 platform.ts 同样理由)。
 * 3. **写云端要把别人的东西原样带回去。** 这份 payload 是整个虾米课堂共用的一份
 *    文档(实验的错题记录也在里面),游戏只认领 `@games` 下自己那一格,
 *    其余键读到什么就写回什么 —— 少带一个键,就等于把别人的进度删了。
 */

/** 云端主本里,游戏进度住的那一格。实验的题目键形如 `id#3` / `fact:x`,不会撞。 */
const GAMES_KEY = '@games'
const PROGRESS_URL = '/v1/lab/progress'

/**
 * 「现在是不是并入主站的那个形态」。
 *
 * 两个条件都要:①**不是 dev**。游戏被虾米课堂挂载时,吃的是构建产物(dist),
 * 所以 dev 一定是独立跑 —— 而算法卡牌的 dev base 本来就写死在 /lab/cards/ 下,
 * 光看路径分不出来,会白打一个必然 404 的 /v1/lab/progress,在控制台留红字、
 * 把「控制台无报错」那条判据废掉。②挂载路径在 /lab/ 下。
 */
const env = (import.meta as { env?: { DEV?: boolean } }).env
export const onPlatform = () => !env?.DEV && location.pathname.startsWith('/lab/')
export const homeUrl = () => '/lab/'

export type HubOpts = {
  /** 显示在条上的游戏名。 */
  title: string
  /** 这个游戏在云端 `@games` 下的格子名,也是 localStorage 键。 */
  key: string
  /** 交出当前进度(必须是纯 JSON)。 */
  read: () => unknown
  /** 把进度灌回游戏(本地读出的、或云端拉下来更新的)。 */
  write: (data: unknown) => void
  /** 进度面板上要显示的几行。 */
  summary: () => string[]
  /** 用户点了「清空进度」。 */
  reset: () => void
  /** 游戏自己的按钮(比如「继续上次那一局」),摆在暂停/进度面板里。
   *  放这儿而不是画到画布上:两个游戏的画布布局差得远,而这类操作本来就属于「管进度」。 */
  actions?: () => { label: string; on: () => void }[]
  /** 条上额外的链接(比如「另一台机器」)。 */
  links?: { label: string; href: string }[]
  /** 暂停状态变化时通知游戏(停掉定时器/动画)。 */
  onPause?: (paused: boolean) => void
}
export type Hub = {
  /** 进度变了就叫一声:写本地 + 推云端(推有节流)。 */
  save: () => void
  isPaused: () => boolean
  setPaused: (p: boolean) => void
}

type Cloud = 'standalone' | 'anon' | 'syncing' | 'synced' | 'error'
type Slot = { at: number; data: unknown }

const CSS = `
#xm-hub{position:fixed;top:0;left:0;right:0;height:36px;z-index:50;display:flex;align-items:center;
 gap:10px;padding:0 12px;box-sizing:border-box;background:#11151dee;border-bottom:1px solid #2a3342;
 font:13px/1 "PingFang SC","Noto Sans SC",system-ui,sans-serif;color:#c9d4e2;user-select:none}
#xm-hub b{font-weight:600;color:#e8eef6}
#xm-hub .sp{flex:1}
#xm-hub button,#xm-hub a.btn{font:inherit;color:#c9d4e2;background:#1b2230;border:1px solid #33405480;
 border-radius:6px;padding:5px 10px;cursor:pointer;text-decoration:none;display:inline-block}
#xm-hub button:hover,#xm-hub a.btn:hover{background:#243043;color:#fff}
#xm-hub .st{font-size:12px;color:#7d8da0}
#xm-mask{position:fixed;inset:0;z-index:60;background:#050a12d8;display:flex;align-items:center;
 justify-content:center;font:14px/1.7 "PingFang SC","Noto Sans SC",system-ui,sans-serif;color:#dfe8f2}
#xm-mask .card{background:#0e1622;border:1px solid #2a3547;border-radius:12px;padding:22px 26px;
 min-width:340px;max-width:min(560px,88vw)}
#xm-mask h3{margin:0 0 12px;font-size:18px;color:#fff}
#xm-mask .row{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
#xm-mask button{font:inherit;color:#dfe8f2;background:#1b2230;border:1px solid #33405480;border-radius:7px;
 padding:8px 14px;cursor:pointer}
#xm-mask button.go{background:#1f4d3a;border-color:#2f7a58;color:#dfffee}
#xm-mask button.danger{background:#3a1d1a;border-color:#7a3a30;color:#ffd9d2}
#xm-mask button:hover{filter:brightness(1.2)}
#xm-mask ul{margin:6px 0 0;padding-left:18px;color:#aebfd2}
#xm-mask .note{margin-top:12px;font-size:12px;color:#7d8da0}
`

export function mountHub(o: HubOpts): Hub {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style)
  const lsKey = `xmhub.${o.key}`
  let paused = false, cloud: Cloud = onPlatform() ? 'syncing' : 'standalone'
  let rev = 0, pushTimer: number | null = null

  // —— 本地:先把存档灌回游戏(云端稍后可能再覆盖一次)——
  const localAt = () => { try { return JSON.parse(localStorage.getItem(lsKey) || 'null')?.at ?? 0 } catch { return 0 } }
  function loadLocal() {
    try { const s = JSON.parse(localStorage.getItem(lsKey) || 'null') as Slot | null; if (s && s.data !== undefined) o.write(s.data) } catch { }
  }
  function saveLocal(): Slot {
    const slot: Slot = { at: Date.now(), data: o.read() }
    try { localStorage.setItem(lsKey, JSON.stringify(slot)) } catch { }
    return slot
  }

  // —— 云端:整份读、只换自己那一格、带 rev 整份写 ——
  async function pull(): Promise<Record<string, unknown> | null> {
    const r = await fetch(PROGRESS_URL, { credentials: 'include' })
    if (r.status === 401) return null
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const d = await r.json() as { payload?: Record<string, unknown>; rev?: number }
    rev = d.rev ?? 0
    return d.payload ?? {}
  }
  /** 把自己那一格塞进整份 payload,别的键原样带回去。 */
  const withSlot = (payload: Record<string, unknown>, slot: Slot) => {
    const games = (payload[GAMES_KEY] && typeof payload[GAMES_KEY] === 'object' ? { ...payload[GAMES_KEY] as object } : {}) as Record<string, Slot>
    games[o.key] = slot
    return { ...payload, [GAMES_KEY]: games }
  }
  async function push(slot: Slot, retry = true): Promise<void> {
    const base = await pull(); if (base === null) { cloud = 'anon'; render(); return }
    const r = await fetch(PROGRESS_URL, {
      method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: withSlot(base, slot), base_rev: rev }),
    })
    if (r.status === 409 && retry) { const d = await r.json().catch(() => ({})) as { detail?: { rev?: number } }; rev = d.detail?.rev ?? rev; return push(slot, false) }
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const d = await r.json() as { rev?: number }; rev = d.rev ?? rev
  }
  function schedulePush() {
    if (!onPlatform() || cloud === 'anon' || cloud === 'standalone') return
    if (pushTimer !== null) clearTimeout(pushTimer)
    //  节流 1.2 秒:一局里进度会连着变好几次,每次都推等于拿服务端当日志。
    pushTimer = setTimeout(() => {
      pushTimer = null; cloud = 'syncing'; render()
      push(saveLocal()).then(() => { cloud = 'synced' }).catch(() => { cloud = 'error' }).then(render)
    }, 1200) as unknown as number
  }
  async function firstSync() {
    if (!onPlatform()) return
    try {
      const payload = await pull()
      if (payload === null) { cloud = 'anon'; render(); return }
      const games = (payload[GAMES_KEY] || {}) as Record<string, Slot | undefined>
      const remote = games[o.key]
      //  谁更近听谁的。做不到逐条合并 —— 游戏进度的形状由各游戏自己定,
      //  外壳不懂它的语义;硬合并会造出一个两边都不曾发生过的存档。这条是明说的,不是没想到。
      if (remote && typeof remote.at === 'number' && remote.at > localAt()) {
        o.write(remote.data); try { localStorage.setItem(lsKey, JSON.stringify(remote)) } catch { }
        cloud = 'synced'
      } else {
        await push(saveLocal()); cloud = 'synced'
      }
    } catch { cloud = 'error' }
    render()
  }

  // —— 界面 ——
  const bar = document.createElement('div'); bar.id = 'xm-hub'; document.body.appendChild(bar)
  let mask: HTMLDivElement | null = null
  const cloudText = () => cloud === 'standalone' ? '独立运行 · 进度只存这台机器'
    : cloud === 'anon' ? '未登录 · 进度只存这台机器'
      : cloud === 'syncing' ? '同步中…' : cloud === 'synced' ? '已同步到你的账号' : '同步失败 · 本地进度没丢'
  function render() {
    bar.innerHTML = ''
    const home = document.createElement(onPlatform() ? 'a' : 'button')
    home.className = 'btn'; home.textContent = '← 虾米课堂'
    if (onPlatform()) (home as HTMLAnchorElement).href = homeUrl()
    else home.onclick = () => alert('现在是独立运行(没挂在 /lab/ 下),没有主站可回。')
    const t = document.createElement('b'); t.textContent = o.title
    const extra = (o.links ?? []).map(l => { const a = document.createElement('a'); a.className = 'btn'; a.href = l.href; a.textContent = l.label; return a })
    const sp = document.createElement('div'); sp.className = 'sp'
    const st = document.createElement('span'); st.className = 'st'; st.textContent = cloudText()
    const prog = document.createElement('button'); prog.textContent = '进度'; prog.onclick = () => openPanel()
    const pz = document.createElement('button'); pz.textContent = paused ? '继续' : '⏸ 暂停(Esc)'; pz.onclick = () => setPaused(!paused)
    bar.append(home, t, ...extra, sp, st, prog, pz)
  }
  function closeMask() { if (mask) { mask.remove(); mask = null } }
  function panel(title: string, lines: string[], buttons: { label: string; cls?: string; on: () => void }[], note?: string) {
    closeMask()
    mask = document.createElement('div'); mask.id = 'xm-mask'
    const card = document.createElement('div'); card.className = 'card'
    const h = document.createElement('h3'); h.textContent = title
    const ul = document.createElement('ul'); for (const l of lines) { const li = document.createElement('li'); li.textContent = l; ul.appendChild(li) }
    const row = document.createElement('div'); row.className = 'row'
    for (const b of buttons) { const el = document.createElement('button'); el.textContent = b.label; if (b.cls) el.className = b.cls; el.onclick = b.on; row.appendChild(el) }
    card.append(h, ul, row)
    if (note) { const n = document.createElement('div'); n.className = 'note'; n.textContent = note; card.appendChild(n) }
    mask.appendChild(card); document.body.appendChild(mask)
  }
  const wrapAction = (a: { label: string; on: () => void }) => ({ label: a.label, on: () => { a.on(); setPaused(false); closeMask() } })
  function openPause() {
    panel('已暂停', o.summary(), [
      { label: '继续', cls: 'go', on: () => setPaused(false) },
      ...(o.actions?.() ?? []).map(wrapAction),
      { label: '进度', on: () => openPanel(true) },
      ...(onPlatform() ? [{ label: '返回虾米课堂', on: () => { location.href = homeUrl() } }] : []),
    ], cloudText())
  }
  function openPanel(fromPause = false) {
    panel('进度', o.summary(), [
      { label: '关闭', cls: 'go', on: () => { if (fromPause || paused) openPause(); else closeMask() } },
      ...(o.actions?.() ?? []).map(wrapAction),
      {
        label: '清空这台机器上的进度', cls: 'danger', on: () => {
          if (!confirm('清空本机进度?云端那份要在虾米课堂的进度页里单独清。')) return
          try { localStorage.removeItem(lsKey) } catch { }
          o.reset(); if (fromPause || paused) openPause(); else closeMask()
        },
      },
    ], cloudText())
  }
  function setPaused(p: boolean) {
    if (p === paused) return
    paused = p; o.onPause?.(p)
    if (p) openPause(); else closeMask()
    render()
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); setPaused(!paused) } })

  loadLocal(); render(); firstSync()
  return { save: () => { saveLocal(); schedulePush() }, isPaused: () => paused, setPaused }
}
