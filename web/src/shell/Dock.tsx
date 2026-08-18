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
import type { ReactNode } from 'react'

export type DockTab = { id: string; label: string; badge?: number }

export function Dock({ tabs, active, onPick, folded, onToggle, children }: {
  tabs: DockTab[]
  active: string
  onPick: (id: string) => void
  folded: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className={`dock${folded ? ' folded' : ''}`} aria-label="日志与真题">
      <header className="dockbar" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id} role="tab" aria-selected={t.id === active && !folded}
            className={t.id === active && !folded ? 'on' : ''}
            onClick={() => { if (folded) onToggle(); onPick(t.id) }}
          >
            {t.label}
            {t.badge ? <b className="dbadge">{t.badge}</b> : null}
          </button>
        ))}
        <button className="dockfold" onClick={onToggle}
                aria-label={folded ? '展开' : '收起'}>{folded ? '▴' : '▾'}</button>
      </header>
      {/**
        * **三块都挂在 DOM 上，不是"只渲染当前那块"。** 两个理由：
        *   1. 真题面板有自己的状态（填了一半的答案），卸载再挂回来会丢；
        *   2. 讲解卡的锚点（`.card.log` / `.card.prob` / `.bounds`）得一直找得到 ——
        *      "锚到一个不存在的元素"是这一层最容易出的错，冒烟专门在查它。
        * 非当前的那两块用 `hidden`：查得到、点不着，语义正好。
        */}
      {!folded && <div className="dockbody">{children}</div>}
    </section>
  )
}
