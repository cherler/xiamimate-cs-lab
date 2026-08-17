/**
 * 轴 —— 第一等公民。
 *
 * 一条带两个通道：颜色编码语义（命中/缺失），柱高编码"量"。
 * 草稿里柱高编码命中/缺失是错的 —— 命中不是量。真正的量是滚动指标（如滚动命中率）。
 */
import { useEffect, useRef } from 'react'
import type { AnyExperiment } from '../types.ts'

type Props = {
  exp: AnyExperiment
  trace: never[]
  index: number
  playing: boolean
  onSeek: (i: number) => void
  onTogglePlay: () => void
}

export function AxisBand({ exp, trace, index, playing, onSeek, onTogglePlay }: Props) {
  const N = trace.length
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) return
    timer.current = window.setInterval(() => {
      onSeek(index + 1 >= N ? 0 : index + 1)
    }, 800)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [playing, index, N, onSeek])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') onSeek(Math.max(0, index - 1))
      if (e.key === 'ArrowRight') onSeek(Math.min(N - 1, index + 1))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [index, N, onSeek])

  if (N === 0) return null
  const axis = exp.kernel.compile(exp.defaultDoc).axis

  return (
    <div className="axis">
      <div className="head">
        <span className="lbl">轴 · {axis.label}</span>
        <span className="metric">柱高＝滚动指标</span>
        <span className="cur">
          第 {index + 1} 步，共 {N} 步
        </span>
      </div>

      <div className="ticks" role="group" aria-label={axis.label}>
        {trace.map((s, i) => {
          const tone = exp.tone(s)
          const m = Math.max(0.06, Math.min(1, exp.metric(s, i)))
          return (
            <button
              key={i}
              className={`tick ${tone.key} ${i === index ? 'cur' : ''}`}
              onClick={() => onSeek(i)}
              title={exp.tickLabel ? exp.tickLabel(s, i) : `第 ${i + 1} 步 · ${tone.label}`}
              aria-label={`跳到第 ${i + 1} 步`}
              aria-current={i === index}
            >
              {N <= 24 && <span className="no">{i + 1}</span>}
              <i style={{ height: `${m * 100}%` }} />
            </button>
          )
        })}
      </div>

      <div className="ctl">
        <button onClick={() => onSeek(Math.max(0, index - 1))} disabled={index === 0}>◀ 上一步</button>
        <button onClick={onTogglePlay}>{playing ? '❚❚ 暂停' : '▶ 播放'}</button>
        <button onClick={() => onSeek(Math.min(N - 1, index + 1))} disabled={index === N - 1}>下一步 ▶</button>
        <input
          type="range" min={0} max={N - 1} value={index}
          aria-label={axis.label}
          onChange={e => onSeek(Number(e.target.value))}
        />
      </div>
    </div>
  )
}
