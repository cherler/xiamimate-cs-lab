/**
 * 底部坞：逐步日志 / 真题 / 边界 三选一。
 *
 * ## 为什么要有它
 *
 * 用户要求「一个实验要一页窗口把内容全放下」。改之前这三块是竖着摞在舞台下面的，
 * 光它们就占 **369px**（日志 186 + 真题 120 + 边界 63），而整页高 1163~1655px、
 * 是视口的 1.4~2.2 屏。
 *
 * 三块的共同点是**都在"看完舞台之后才用"**：日志是回看每一步、真题是练、
 * 边界是提醒这仿真没模拟什么。谁也不需要跟舞台同时盯着。所以合并成一个坞、
 * 同一时刻只露一块 —— 省掉三分之二的高度，而不是把每一块都压扁。
 *
 * ## 高度固定，内部滚
 *
 * 坞的高度是定死的（`--dock-h`），内容多了在里面滚。**不让它把舞台挤没** ——
 * 舞台是这一屏的主角，其余都是配角，配角不许改主角的尺寸。
 */
import { useRef, useState, type ReactNode } from 'react'

export type DockTab = { id: string; label: string; badge?: number }

export function Dock({ tabs, active, onPick, folded, onToggle, children, place = 'side', lead }: {
  tabs: DockTab[]
  active: string
  onPick: (id: string) => void
  folded: boolean
  onToggle: () => void
  children: ReactNode
  /**
   * 摆在哪儿。
   *
   * `side` —— 舞台左边一栏（默认，其余 29 个实验）。
   * `bottom` —— 走带底下一条「实验记录」，收起时只剩一行结论。
   *   用户原话：「把'逐步日志'放进实验记录里」，以及那条 32px 的折叠窄轨「删掉」。
   *   窄轨的问题不在于窄，在于**它是一条什么都不写的竖条** ——
   *   收起来之后既不占内容也不给信息，纯粹是个门把手。
   *   挪到底部之后，收起态那一行本身就是内容（已验证的那句结论）。
   */
  place?: 'side' | 'bottom'
  /** 收起时页签左边显示什么（底部形态用：图标 + 「实验记录」+ 已验证的结论） */
  lead?: ReactNode
}) {
  /**
   * 旁栏宽度可拖。
   *
   * 默认宽度是按容器算的（`clamp(330px,27cqw,460px)`），但"多宽合适"因人因实验而异：
   * 看真题时想宽一点，盯舞台时想窄一点。记在本机 —— 调过一次的人下次进来还是那个宽度。
   *
   * ⚠️ 拖到 0 就找不回来了，所以夹在 [220, 720]：
   * 220 是四个页签排一行的最小宽度，再窄标签就折行；
   * 720 再宽就把舞台挤到没意义了（真要专心看文字，点 ▾ 往左收起更干脆）。
   */
  const [w, setW] = useState<number | null>(() => {
    try { const v = Number(localStorage.getItem('cslab.dockw')); return v >= 220 && v <= 720 ? v : null }
    catch { return null }
  })
  const drag = useRef<{ x0: number; w0: number } | null>(null)

  return (
    <section className={`dock ${place}${folded ? ' folded' : ''}`} aria-label="实验记录"
             style={place === 'side' && !folded && w ? { width: w } : undefined}>
      <header className="dockbar" role="tablist">
        {lead}
        {tabs.map(t => (
          <button
            key={t.id} role="tab" aria-selected={t.id === active && !folded}
            //  页签认自己的 id，不认自己排第几 —— 讲解浮层靠它替用户点开对应那一格
            data-dock-tab={t.id}
            className={t.id === active && !folded ? 'on' : ''}
            onClick={() => { if (folded) onToggle(); onPick(t.id) }}
          >
            {t.label}
            {t.badge ? <b className="dbadge">{t.badge}</b> : null}
          </button>
        ))}
        {/*  收起钮留在右端（原位）。曾把它挪到左端去躲讲解浮层，代价是
             坞的页签顺序一变，浮层里那段"按下标点页签"就整体错位，
             30 个实验 × 三张卡 = 90 处锚点当场落空。
             按 id 找页签那条已经改好了（见 GuideOverlay），但**挪位本身**
             还牵动别的判据，不值当 —— 浮层与它相邻这件事另想办法。 */}
        <button className="dockfold" onClick={onToggle}
                aria-label={folded ? '展开' : '收起'}>
          {place === 'bottom'
            ? (folded ? '查看全部记录 →' : '收起 ▾')
            : (folded ? '▴' : '▾')}
        </button>
      </header>
      {/**
        * **三块都挂在 DOM 上，不是"只渲染当前那块"。** 两个理由：
        *   1. 真题面板有自己的状态（填了一半的答案），卸载再挂回来会丢；
        *   2. 讲解卡的锚点（`.card.log` / `.card.prob` / `.bounds`）得一直找得到 ——
        *      "锚到一个不存在的元素"是这一层最容易出的错，冒烟专门在查它。
        * 非当前的那两块用 `hidden`：查得到、点不着，语义正好。
        */}
      {/*  折叠时不卸载（锚点要一直找得到、真题面板的半截答案不能丢），
           只用类名藏。上面注释里承诺的本来就是"常驻 DOM"，
           原实现 `{!folded && …}` 跟注释是反的 —— 抽屉化时顺手改正。 */}
      <div className={`dockbody${folded ? ' off' : ''}`}>{children}</div>
      {/*  拖把手贴在右沿。`setPointerCapture` 之后鼠标移出元素也还跟手；
           双击复位成"按容器算"的默认宽度 —— 拖坏了要有一条回去的路。 */}
      {/*  拖把手只有侧栏形态有：底部那条是通栏的，宽度没得调 */}
      {place === 'side' && !folded && (
        <div className="dockgrip" role="separator" aria-orientation="vertical"
             aria-label="拖动调整旁栏宽度"
             title="拖动调整宽度 · 双击恢复默认"
             onDoubleClick={() => {
               setW(null)
               try { localStorage.removeItem('cslab.dockw') } catch { /* 隐私模式 */ }
             }}
             onPointerDown={e => {
               const el = e.currentTarget.parentElement as HTMLElement
               drag.current = { x0: e.clientX, w0: el.getBoundingClientRect().width }
               e.currentTarget.setPointerCapture(e.pointerId)
             }}
             onPointerMove={e => {
               const d = drag.current
               if (!d) return
               setW(Math.max(220, Math.min(720, Math.round(d.w0 + (e.clientX - d.x0)))))
             }}
             onPointerUp={() => {
               const cur = w
               drag.current = null
               try { if (cur) localStorage.setItem('cslab.dockw', String(cur)) } catch { /* 隐私模式 */ }
             }} />
      )}
    </section>
  )
}
