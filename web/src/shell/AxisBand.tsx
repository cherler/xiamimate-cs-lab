/**
 * 轴 —— 第一等公民。
 *
 * 一条带两个通道：颜色编码语义（命中/缺失），柱高编码"量"。
 * 草稿里柱高编码命中/缺失是错的 —— 命中不是量。真正的量是滚动指标（如滚动命中率）。
 */
import { useEffect, useRef, useState } from 'react'
import type { SimDocument } from '@engine/core/document.ts'
import type { AnyExperiment } from '../types.ts'

type Props = {
  exp: AnyExperiment
  trace: never[]
  index: number
  doc: SimDocument
  /** 这份配置整条走完过 —— 再看就是重播，没什么可剧透的了 */
  replay: boolean
  playing: boolean
  /** 一步停多久（毫秒）。巡演按关键步变速，平时 800 */
  stepMs?: number
  onSeek: (i: number) => void
  onTogglePlay: () => void
}

export function AxisBand({ exp, trace, index, doc, replay, playing, stepMs = 800, onSeek, onTogglePlay }: Props) {
  const N = trace.length
  const timer = useRef<number | null>(null)
  /**
   * 走到过的最远那一步。**没走到的步不预告结果。**
   *
   * 引擎是确定性的，改完参数整条轨迹当场就算完了 —— 那是「输出是轨迹不是结果」
   * 要的，拖轴、回放、验证器逐步比对全靠它。但**算完 ≠ 该印出来**：
   * 一进页面就把 12 步的命中/缺失铺满，实验单 ② 那层"先猜一下"当场作废。
   *
   * 记的是**最远**不是当前：看过一眼再藏回去是耍人，而且拖轴时整条带子会闪。
   */
  const [seen, setSeen] = useState(-1)
  //  换配置 = 另一条轨迹，结果全变了，重新藏起来
  useEffect(() => { setSeen(-1) }, [trace])
  useEffect(() => { setSeen(v => Math.max(v, index)) }, [index])
  const strip = useRef<HTMLDivElement>(null)
  const down = useRef<{ x: number; id: number; drag: boolean } | null>(null)
  /** 按带子上的横向位置换算成第几步 */
  const seekAt = (clientX: number) => {
    const el = strip.current
    if (!el || N < 2) return
    const r = el.getBoundingClientRect()
    const f = (clientX - r.left) / Math.max(1, r.width)
    //  带子上现在是 N+1 格（最左那格是第 0 步「还没开始」），所以按 N 等分、再减一
    onSeek(Math.max(-1, Math.min(N - 1, Math.round(f * N) - 1)))
  }

  useEffect(() => {
    if (!playing) return
    /*
     * 走到最后一步就**停**，不回卷。
     *
     * 原来写的是 `index + 1 >= N ? 0 : index + 1` —— 到头了跳回第 0 步接着放，
     * 于是播放永远停不下来。轨迹是一条**有头有尾的推演**，不是循环动画：
     * 放完了就该停在末态让人看结果，而不是把屏幕上的数悄悄清零重来。
     * （想再看一遍，按 ▶ 会从头放 —— 那一步在 App 的 onTogglePlay 里。）
     */
    if (index >= N - 1) { onTogglePlay(); return }
    timer.current = window.setInterval(() => onSeek(index + 1), stepMs)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [playing, index, N, onSeek, onTogglePlay, stepMs])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') onSeek(Math.max(-1, index - 1))
      if (e.key === 'ArrowRight') onSeek(Math.min(N - 1, index + 1))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [index, N, onSeek])

  if (N === 0) return null
  const axis = exp.kernel.compile(exp.defaultDoc).axis

  return (
    /*
     * **走带**：控制键 ─ 刻度带 ─ 步数，一行排完。
     *
     * 原来是三行（说明行 / 刻度 / 按钮行），实测 133px —— 而这一条是
     * 每走一步都要碰的控件，它越厚，舞台越薄。压成一行 60px 出头，
     * 参照的是 Transformer Explainer 的骨架：主区一整块，控制条只有一根。
     * 「柱高＝本步的量」那句说明挪进刻度带的 title —— 悬停可见，不占行。
     */
    <div className="axis">
      <div className="ctl">
        <button className="step" onClick={() => onSeek(Math.max(-1, index - 1))}
                disabled={index <= -1} aria-label="上一步">◀</button>
        <button className="play" onClick={onTogglePlay}>{playing ? '❚❚ 暂停' : '▶ 播放'}</button>
        <button className="step" onClick={() => onSeek(Math.min(N - 1, index + 1))}
                disabled={index === N - 1} aria-label="下一步">▶</button>
      </div>

      {/*
        整条带子可以拖着走 —— 原来另有一根 `<input type=range>` 在下面，
        跟这排格子是**同一个控件的两个化身**。Chanel 那句话：出门前摘掉一件配饰。
        拖动本身没丢：按下不动是点，位移超过 4px 才算拖。
        （这个 4px 门槛不是随手加的 —— 一上来就 setPointerCapture 会把随后的 click 劫走，
          这个 session 里刚在讲解卡的返回按钮上栽过一次。）
      */}
      <div className="ticks" role="group" aria-label={axis.label}
           title={`轴 · ${axis.label} —— 柱高＝本步的量，灰＝还没走到；拖动这条带子也能走`}
           ref={strip}
           onPointerDown={e => { down.current = { x: e.clientX, id: e.pointerId, drag: false } }}
           onPointerMove={e => {
             const d = down.current
             if (!d) return
             if (!d.drag) {
               if (Math.abs(e.clientX - d.x) < 4) return
               d.drag = true
               strip.current?.setPointerCapture(d.id)
             }
             seekAt(e.clientX)
           }}
           onPointerUp={() => { down.current = null }}
           onPointerCancel={() => { down.current = null }}>
        {/*
          最左边这一格是**第 0 步「还没开始」** —— 引擎还没走任何一步，
          舞台上是初始态：空的缓存、原始的数组、lo/hi 的初值。
          它不进轨迹（内核契约里 `initial()` 明写「本身不进轨迹」），
          所以这里是单独一格，不参与 `trace.map`，也没有色调和柱高可画。

          ⚠️ 类名是 `tick0` 而**不是** `tick` —— 多个 smoke 脚本按
          `.tick >> nth=k` 把第 k 格当轨迹第 k 帧用（还有 `querySelectorAll('.tick').length`
          当步数）。让这一格也叫 `.tick`，那些下标会**静默错位一步**：脚本照样绿，
          量的却是另一步。这类「不报错的错值」在这个仓库里栽过好几次了。
        */}
        <button
          className={`tick0 ${index <= -1 ? 'cur' : ''}`}
          onClick={() => onSeek(-1)}
          title="第 0 步 · 还没开始 —— 引擎还没走第 1 步，这是初始状态"
          aria-label="跳到第 0 步（还没开始）"
          aria-current={index <= -1}
        ><span className="no">0</span></button>
        {trace.map((s, i) => {
          const tone = exp.tone(s)
          const walked = replay || i <= seen
          const m = Math.max(0.06, Math.min(1, exp.metric(s, i, doc)))
          /*
           * 两种格子，由实验自己选（`exp.tickChip`，见 types.ts）：
           *
           *   柱状条 —— 每一步有个**连续的量**（TCP 的 cwnd、磁盘移动的磁道数）。
           *   写字格 —— 每一步的量只有两三档（命中/缺失），柱子高低会暗示一个
           *             并不存在的连续量；这时格子里该写的是**这一步的输入**。
           *
           * 后者是用户给的概念图上那一条：`1 / 0x0`、`2 / 0x10`……
           */
          const chip = exp.tickChip ? exp.tickChip(s, i) : null
          return (
            <button
              key={i}
              className={`tick ${walked ? tone.key : 'unseen'} ${i === index ? 'cur' : ''}${chip !== null ? ' chip' : ''}`}
              onClick={() => onSeek(i)}
              title={walked
                ? (exp.tickLabel ? exp.tickLabel(s, i) : `第 ${i + 1} 步 · ${tone.label}`)
                : `第 ${i + 1} 步 · 还没走到`}
              aria-label={`跳到第 ${i + 1} 步`}
              aria-current={i === index}
            >
              {chip !== null
                ? <><span className="no">{i + 1}</span><em className="tx">{chip}</em></>
                : <>{N <= 24 && <span className="no">{i + 1}</span>}
                    <i style={{ height: `${m * 100}%` }} /></>}
            </button>
          )
        })}
      </div>

      {/*  `.head` 这个名字留着：两处判据从它里面读「第 x 步」 */}
      <div className="head">
        <span className="cur">{index < 0 ? `第 0 步 · 还没开始 / 共 ${N} 步` : `第 ${index + 1} 步 / 共 ${N} 步`}</span>
        {/*  一条细进度线（概念图上格子底下就有一条）。
             格子已经说清"走到第几格"，这条线说的是**整条走完了多大一截** ——
             12 格时两者差不多，40 格时格子太密，线才读得出来。 */}
        <i className="prog" aria-hidden><b style={{ width: `${(Math.max(0, index + 1) / N) * 100}%` }} /></i>
      </div>
    </div>
  )
}
