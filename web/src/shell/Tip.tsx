/**
 * 字段级的悬停说明 —— **一行能说完的东西不该占一张讲解卡**。
 *
 * 参照 Transformer Explainer 的分层：它有 `Tooltip`（悬停，一行，比如那个
 * `Q · K^T` 气泡）和 `TextbookTooltip`（点开，把讲解卡翻到那一页）两层。
 * 前者管"这是什么"，后者管"这为什么重要"。本仓照抄这个分工。
 *
 * ## 一个浮层，不是每个字段一个
 *
 * 挂在 document 上听 `mouseover`，从事件目标往上找带 `data-tip` 的元素。
 * 好处是**字段那边只要多一个属性**，不用包一层组件、不用各自持有状态；
 * 30 个舞台里将来想给谁加提示，加个 `data-tip` 就行。
 *
 * ## 为什么不用原生 `title`
 *
 * 免费，但有三条硬伤：延迟约半秒（等它出来的人已经放弃了）、
 * 样式跟不了深浅两套主题、长一点的中文会被系统截断。
 */
import { useEffect, useRef, useState } from 'react'

type Pos = { x: number; y: number; text: string; below: boolean }

export function TipLayer() {
  const [tip, setTip] = useState<Pos | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.('[data-tip]') as HTMLElement | null
      if (!el) { setTip(null); return }
      const text = el.dataset.tip
      if (!text) { setTip(null); return }
      const r = el.getBoundingClientRect()
      //  默认贴在上方；上面装不下就翻到下面 —— 读数栏在右上角，
      //  一律往上会顶出视口，而顶出视口的提示等于没有提示。
      const below = r.top < 90
      setTip({ x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, text, below })
    }
    const out = (e: MouseEvent) => {
      const to = e.relatedTarget as HTMLElement | null
      if (!to?.closest?.('[data-tip]')) setTip(null)
    }
    document.addEventListener('mouseover', over)
    document.addEventListener('mouseout', out)
    //  滚动时直接收掉：跟着算位置要监听滚动+resize，而提示本来就是一瞬间的东西
    document.addEventListener('scroll', () => setTip(null), true)
    return () => {
      document.removeEventListener('mouseover', over)
      document.removeEventListener('mouseout', out)
    }
  }, [])

  if (!tip) return null
  return (
    <div ref={box} className={`tip ${tip.below ? 'below' : ''}`} role="tooltip"
         style={{ left: tip.x, top: tip.y }}>
      {/* 词条里用 `**…**` 标重点（讲解卡的正文也是这么写的）。
          这里按奇偶位切开渲染 —— **不用 dangerouslySetInnerHTML**：
          这些字符串将来可能由别人补充，给它一条注入通道不值当。 */}
      {tip.text.split('**').map((part, i) =>
        i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>)}
    </div>
  )
}
