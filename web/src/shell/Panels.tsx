/** 共享面板：逐步日志 · 参数 · 读数 · 违规 · 边界 */
import { useEffect, useRef, useState } from 'react'
import { rich } from './rich.tsx'
import { Md } from './md.tsx'
import type { Violation } from '@engine/core/verify.ts'
import { tipFor } from '../guide.ts'
import type { AnyExperiment, ParamSpec, Readout } from '../types.ts'

// ── 逐步日志：跟轴联动 ─────────────────────────────────
export function StepLog({
  exp, trace, index, replay, onSeek,
}: { exp: AnyExperiment; trace: never[]; index: number; replay: boolean; onSeek: (i: number) => void }) {
  /**
   * 跟轴同一条规矩：**没走到的步不预告结果**。
   * 日志每行写着"命中 / 缺失"，全列出来跟把答案抄在黑板上没区别。
   *
   * 但**走完一整遍之后就全列** —— 那时是重播，结果你已经看过，
   * 再藏起来只会让"点日志跳到那一步"变成只能往回跳。
   */
  /*  初值是 −1 而不是 0：第 0 步「还没开始」时，日志一行都不该列
      （列出第 1 步就等于把还没走的那一步的结果先抄出来了）。 */
  const [seen, setSeen] = useState(-1)
  useEffect(() => { setSeen(-1) }, [trace])
  useEffect(() => { setSeen(v => Math.max(v, index)) }, [index])
  const upto = replay ? trace.length - 1 : seen
  const ref = useRef<HTMLLIElement | null>(null)
  const box = useRef<HTMLDivElement | null>(null)

  /**
   * 让当前步进入可视范围 —— **只滚日志自己那个框，不许动整页。**
   *
   * 原来写的是 `scrollIntoView({ block: 'nearest' })`。`nearest` 听起来很克制，
   * 其实它会把**每一层**可滚动祖先都调整到位，包括视口本身：
   * 日志卡片在首屏之下时，浏览器就把整页往下滚一段。
   *
   * 单看本仓时这只是"开页面自己往下挪了 28px"，没人在意。并入主站之后
   * 挪的量变成 80px（多出来的正好是平台页眉那 52px）—— **打开 /cslab/ 的第一眼，
   * 平台页眉已经被滚出屏幕了**，而它存在的全部意义就是让人一眼看出这是虾米伙伴。
   *
   * 所以改成自己算：只加减 `box.scrollTop`，窗口一次都不碰。
   */
  useEffect(() => {
    const li = ref.current, b = box.current
    if (!li || !b) return
    const l = li.getBoundingClientRect(), r = b.getBoundingClientRect()
    if (l.top < r.top) b.scrollTop += l.top - r.top
    else if (l.bottom > r.bottom) b.scrollTop += l.bottom - r.bottom
  }, [index])

  const model = exp.kernel.compile(exp.defaultDoc)

  return (
    <div className="card log" ref={box}>
      <h3>逐步日志 <span className="hint">
        {upto >= trace.length - 1 ? '点击跳到该步' : `点击跳到该步 · 走到哪列到哪（${upto + 1} / ${trace.length}）`}
      </span></h3>
      <ul>
        {trace.slice(0, upto + 1).map((s, i) => {
          const tone = exp.tone(s)
          return (
            <li
              key={i} ref={i === index ? ref : undefined}
              className={i === index ? 'cur' : ''}
              onClick={() => onSeek(i)}
            >
              <span className="i">{i + 1}</span>
              <span className={`r ${tone.key}`}>{tone.label}</span>
              {/**
                * ⚠️ **必须走 rich()。** 原来是 `{model.describe(s)}` 直出字符串，
                * 而内核的 describe() 里普遍写着 `**…**`：实测 **286 个实验里 261 个、
                * 2426 行日志里 1804 行**含裸星号 —— 也就是几乎整条逐步日志上，
                * 该加粗的地方印的是四个星号加汉字。
                *
                * 不是个别实验写错，是这一处渲染漏了：rich.tsx 的文件头写着
                * 「全仓库唯一一份实现，被四层文本共用」，逐步日志一直不在那四层里。
                * （实测这 2426 行的星号**全部成对**，不会把后半句错染成粗体。）
                */}
              <span className="x">{rich(model.describe(s))}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── 实验控制：改了就重跑 ───────────────────────────────
/**
 * 标题从「参数」改成「实验控制」（用户给的概念图上的叫法）。
 *
 * 不只是换个词：「参数」说的是**这个盒子里装着什么**，
 * 「实验控制」说的是**你能拿它干什么** —— 而这一栏的活恰恰是后者。
 * 用户侧的名字要按人能控制、能认出的东西起，不按系统怎么实现起。
 *
 * 「重置」只在**真的改过**时才出现：没改过还挂着一个按不动的按钮，
 * 是在让人怀疑自己是不是漏改了什么。
 */
export function ParamPanel({
  specs, values, onChange, emptyNote, dirty, onReset,
}: {
  specs: ParamSpec[]
  values: Record<string, number | string | boolean>
  onChange: (key: string, v: number | string) => void
  /** 有些实验的自由度不在标量参数上（如银行家在资源矩阵里）—— 空面板要说明白，不能只留一个空盒子 */
  emptyNote?: string
  /** 参数被改过 —— 改过才给「重置」 */
  dirty?: boolean
  onReset?: () => void
}) {
  if (specs.length === 0) {
    return (
      <div className="card">
        <h3>实验控制</h3>
        <div className="body">{emptyNote
          ? <Md text={emptyNote} className="pnote-md" />
          : <p className="pempty">本实验没有可调参数。</p>}</div>
      </div>
    )
  }
  return (
    <div className="card">
      <h3>实验控制
        {dirty && onReset
          ? <button className="preset" onClick={onReset}>↺ 重置</button>
          : <span className="hint">改了立即重跑</span>}
      </h3>
      <div className="body params">
        {specs.map(sp => {
        //  不生效的旋钮：留在原地、变灰、点不动，并且说清"什么时候才生效"
        const live = !sp.when || sp.when.on(values)
        return (
          <div className={`param${live ? '' : ' na'}`} key={sp.key}>
            {/* 有一行说得清的就挂 data-tip，悬停时给一句；没有的不挂 ——
                把名字重念一遍的提示比没有提示更烦。 */}
            <div className="k" data-tip={tipFor(sp.label) ?? undefined}>
              <span>{sp.label}</span>
              {sp.kind === 'number' && sp.unit && <span className="u">{sp.unit}</span>}
            </div>
            <div className="opts">
              {(sp.options as (number | string)[]).map(o => (
                <button
                  key={String(o)}
                  className={values[sp.key] === o ? 'on' : ''}
                  onClick={() => onChange(sp.key, o)}
                  disabled={!live}
                  aria-pressed={values[sp.key] === o}
                >{sp.optionLabel ? sp.optionLabel(o as never) : o}</button>
              ))}
            </div>
            {!live && <div className="nanote">{sp.when!.note}</div>}
          </div>
        )})}
      </div>
    </div>
  )
}

// ── 读数 ──────────────────────────────────────────────
export function Readouts({ items }: { items: Readout[] }) {
  return (
    <div className="card readouts">
      <h3>读数</h3>
      <div className="body">
        {items.map((r, i) => (
          <div className="pr" key={i}>
            <span className="k" data-tip={tipFor(r.label) ?? undefined}>{r.label}</span>
            <span className={`v ${r.tone ?? ''}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 违规：验证器直接接到 UI 上 ─────────────────────────
export function Violations({ items }: { items: Violation[] }) {
  if (items.length === 0) return null
  return (
    <div className="viol">
      <div className="t">配置不合法 · {items.length} 项</div>
      {items.slice(0, 3).map((v, i) => (
        <p key={i}><code>{v.location}</code> {v.message}
          {v.actual !== undefined && <> —— 实际 <code>{JSON.stringify(v.actual)}</code></>}
        </p>
      ))}
    </div>
  )
}

// ── 边界：内容标准 #2 ──────────────────────────────────
/**
 * 边界：这个仿真**没有**模拟什么。
 *
 * ⚠️ 原来是 `items.join(' · ')` 塞进一个 `<p>` —— 一整段流水账，
 * 而且没走 `rich()`，作者写的 `**强调**` 原样把星号印在屏幕上。
 * 用户的原话：「内容文字整理，层次感、编号、标题、重要性体现」。
 *
 * 现在：编号 + 每条独占一行 + 走 rich()。条目支持 `标题｜正文` 写法
 * （全角竖线），有标题的把标题提出来加重；没写标题的原样渲染 ——
 * 30 个实验的既有文案一个字都不用改。
 */
export function Bounds({ items }: { items: string[] }) {
  return (
    <div className="bounds">
      <div className="t">边界</div>
      <p className="bsub">{rich('下面这些**本仿真没有建模** —— 拿它当全部事实会出错。')}</p>
      <ol className="blist">
        {items.map(raw => {
          const bar = raw.indexOf('｜')
          const head = bar > 0 ? raw.slice(0, bar) : null
          const body = bar > 0 ? raw.slice(bar + 1) : raw
          return (
            <li key={raw}>
              {head && <b className="bndh">{head}</b>}
              <span>{rich(body)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
