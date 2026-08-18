/**
 * 把舞台**整体缩到看得全**。
 *
 * 「一屏装下」做到第二层才算数：外壳固定高度、窗口不滚，只是把滚动从窗口
 * 挪到了舞台里 —— 实测 30 个实验里舞台平均藏着 150px、最多 382px，
 * 用户照样得滚才看得见剩下的图。窗口没有滚动条不等于内容在一屏上。
 *
 * 这里只做一件事：量出内容的自然尺寸，整体按比例缩放到装得下。
 *
 * ## 为什么不会自己把自己算晕
 *
 * 用 `transform: scale()`，**变换不参与布局** —— 缩放后 `scrollHeight`
 * 一点不变。所以"量尺寸 → 定倍率"没有回路，不会来回震荡。
 * （改宽度去补白边就有回路了：宽度一变高度跟着变，倍率又得重算。不值当。）
 *
 * ## 为什么有下限
 *
 * 缩到 0.5 以下，图上的字就没法看了 —— 那时候"看得全"是假的，
 * 不如老老实实让它滚。触到下限就退回滚动。
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export function FitBox({ children, min = 0.58 }: { children: ReactNode; min?: number }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [s, setS] = useState(1)
  //  缩放后**视觉上**占多高。transform 不参与布局，不补这一格，
  //  容器仍按原尺寸算滚动条 —— 明明已经看得全了，右边还挂着一根滚动条。
  const [padH, setPadH] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    const fit = () => {
      const o = outer.current, i = inner.current
      if (!o || !i) return
      const cw = i.scrollWidth, ch = i.scrollHeight
      if (!cw || !ch) return
      //  留 1px：整数取整的舍入差会让"刚好装下"被判成"差一点"，然后一直缩
      const k = Math.max(min, Math.min(1, (o.clientWidth - 1) / cw, (o.clientHeight - 1) / ch))
      const v = Number.isFinite(k) && k > 0 ? k : 1
      setS(v); setPadH(Math.ceil(ch * v))
    }
    fit()
    //  换实验、换页签、拖时间轴都会改内容尺寸；改窗口会改容器尺寸。两头都盯着。
    const ro = new ResizeObserver(fit)
    if (outer.current) ro.observe(outer.current)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [children, min])

  return (
    <div className="fit" ref={outer}>
      {/* 占位盒撑出"缩放后"的高度；真正的内容绝对定位在它左上角，
          按自然尺寸排版、只在画的时候缩 —— 量的和缩的因此互不干扰 */}
      <div className="fitpad" style={{ height: padH }}>
        <div className="fitin" ref={inner}
             style={{ transform: s < 1 ? `scale(${s})` : undefined }}
             data-fit={s < 1 ? s.toFixed(2) : undefined}>
          {children}
        </div>
      </div>
    </div>
  )
}
