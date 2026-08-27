/**
 * 把舞台**整体缩到看得全**。
 *
 * 「一屏装下」做到第二层才算数：外壳固定高度、窗口不滚，只是把滚动从窗口
 * 挪到了舞台里 —— 实测 30 个实验里舞台平均藏着 150px、最多 382px，
 * 用户照样得滚才看得见剩下的图。窗口没有滚动条不等于内容在一屏上。
 *
 * 这里只做一件事：量出内容的自然尺寸，整体按比例缩放到**正好填满容器**。
 *
 * ⚠️ 2026-08-18 改了方向。原来只缩不放（`Math.min(1, …)`），
 * 于是一个自然尺寸 642×176 的舞台，塞在 952×276 的容器里就摆在中间发呆 ——
 * 实测舞台真正画着东西的部分只占全屏 **8.7%**，跟旁边那个输入框一样大、
 * 比底部日志抽屉小一半。**主角不该是屏幕上第三大的东西。**
 * 现在允许放大到 `max` 倍：图定尺寸，容器有多大就占多大。
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

/**
 * 舞台的**设计宽度**跟着容器走。
 *
 * ## 为什么不是定死 950
 *
 * 定死之后，容器再宽也只有一个后果：整张图**等比放大**，
 * 于是字大了，但图的形状没变 —— 一张 950×313 的图放进 1900×380 的框里，
 * 左右各空 410px。用户原话：「红框里画 X 的地方却大片空白，说白了就是布局不对」。
 *
 * 让设计宽度 = 容器宽 ÷ 目标倍率，两件事同时成立：
 *   · 倍率恒等于目标值（字号稳定在 11 × 1.45 ≈ 16px，不随屏幕忽大忽小）；
 *   · 内容按这个宽度**重新排版**，横向就真的铺满了（前提是舞台自己会跟着宽度分栏）。
 *
 * `MIN_W` 是地板：窄屏上不能比原来还窄，否则那些照 950 画的舞台会挤成一团。
 *
 * ## 不会来回震荡
 *
 * 设计宽度只看**容器**，不看内容；内容高度变了不会反过来改设计宽度。
 * 所以「量尺寸 → 定宽度 → 定倍率」是一条直线，没有回路。
 */
const TARGET = 1.45
const MIN_W = 950

export function FitBox({ children, min = 0.58, max = 2.4 }: { children: ReactNode; min?: number; max?: number }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [s, setS] = useState(1)
  const [w, setW] = useState(MIN_W)
  //  同一帧里既要读又要写，用 ref 记住上一次的值，避免多余的 setState
  const wRef = useRef(MIN_W)
  //  缩放后**视觉上**占多高。transform 不参与布局，不补这一格，
  //  容器仍按原尺寸算滚动条 —— 明明已经看得全了，右边还挂着一根滚动条。
  const [padH, setPadH] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    const fit = () => {
      const o = outer.current, i = inner.current
      if (!o || !i) return
      //  先按容器宽定下设计宽度，再量内容 —— 顺序反了就会量到上一次的排版
      const dw = Math.max(MIN_W, Math.round(o.clientWidth / TARGET))
      if (dw !== wRef.current) { wRef.current = dw; setW(dw); i.style.width = `${dw}px` }
      const cw = i.scrollWidth, ch = i.scrollHeight
      if (!cw || !ch) return
      //  留 1px：整数取整的舍入差会让"刚好装下"被判成"差一点"，然后一直缩
      const k = Math.max(min, Math.min(max, (o.clientWidth - 1) / cw, (o.clientHeight - 1) / ch))
      const v = Number.isFinite(k) && k > 0 ? k : 1
      setS(v); setPadH(Math.ceil(ch * v))
    }
    fit()
    //  换实验、换页签、拖时间轴都会改内容尺寸；改窗口会改容器尺寸。两头都盯着。
    const ro = new ResizeObserver(fit)
    if (outer.current) ro.observe(outer.current)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [children, min, max])

  return (
    <div className="fit" ref={outer}>
      {/* 占位盒撑出"缩放后"的高度；真正的内容绝对定位在它左上角，
          按自然尺寸排版、只在画的时候缩 —— 量的和缩的因此互不干扰 */}
      <div className="fitpad" style={{ height: padH }}>
        <div className="fitin" ref={inner}
             /*  居中靠 `left:50%`（在 CSS 里）加上负一半宽度的外边距。
                 宽度是这里算出来的，所以这一半也得在这里算 —— 放到 CSS 里
                 就要再传一个 `--stage-w`，同一个数两处写，迟早对不上。 */
             style={{ width: w, marginLeft: -w / 2,
                      transform: s !== 1 ? `scale(${s})` : undefined }}
             data-fit={s !== 1 ? s.toFixed(2) : undefined}>
          {children}
        </div>
      </div>
    </div>
  )
}
