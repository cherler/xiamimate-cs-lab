/**
 * 第 0 步「还没开始」的那一屏。
 *
 * 起因（用户 2026-09-07）：「虾米课堂的所有实验，第一步是默认已经走完了的吗？」
 * 是的 —— `trace[0]` 是引擎**走完第一步之后**的状态。现在时间轴前面多了一格第 0 步。
 *
 * ## 为什么这一格不直接把舞台画出来
 *
 * 第一版就是那么做的：把内核的 `initial()` 当状态喂给各实验的舞台。结构那部分是对的
 * （空的缓存表、原始的数组），但**占位字段被当成结论画了出来** —— Cache 那一屏当场写着
 * 「当前地址 0x0 · 检查组 0 → 缺失」，红框标在组 0 上，读数栏是「命中率 NaN%」。
 * 那三样都不是事实：`initial()` 里的 `address/outcome` 只是零值占位，一步都还没走。
 *
 * 舞台是照着**轨迹帧**写的（240 个实验都从 `state` 里读「本步」字段），指望它们分辨
 * 「这是占位零值不是结果」要改 240 个文件；而**假结论比没有画面糟得多**。
 * 所以这一格不画舞台，画一张老老实实的起点卡：说清还没开始、把这次要跑的输入摆出来、
 * 给一个走第 1 步的按钮。想看空缓存长什么样，走第 1 步之前的结构本来也写在参数栏里。
 */
import type { SimDocument } from '@engine/core/document.ts'
import type { AnyExperiment } from '../types.ts'
import { GUIDES } from '../guide.ts'
import { rich } from './rich.tsx'

type Props = {
  exp: AnyExperiment
  doc: SimDocument
  /** 轨迹总步数 —— 告诉人「这条推演一共有多长」 */
  total: number
  onStart: () => void
}

export function StartFrame({ exp, doc, total, onStart }: Props) {
  //  参数摘要：只列这个实验此刻**用得上**的旋钮（`when` 判为不适用的不列，
  //  否则会摆出一条自己都是灰的设置，比不列更让人困惑）
  const params = exp.params
    .filter(p => !p.when || p.when.on(doc.params))
    .map(p => {
      const v = doc.params[p.key]
      const unit = p.kind === 'number' && p.unit ? p.unit : ''
      return { k: p.label, v: `${String(v ?? '—')}${unit}` }
    })

  const axis = (() => { try { return exp.kernel.compile(doc).axis.label } catch { return '步' } })()
  /*  驱动序列（访问序列 / 请求序列…）—— 「要跑的是这一串」比任何描述都直观。
      但**序列编辑器在屏上时不列**：它就在这张卡正上方，同一串数摆两遍是噪音，
      而且它按 `radix` 印成 `0x10`、这里照原样印成 `16`，同一个数会长出两个样子。
      所以这一行只留给没有编辑器的实验。 */
  const plain = GUIDES[exp.id]?.plain
  const stream = exp.sequence ? undefined : doc.streams[0]
  const items = stream?.values ?? []

  return (
    /*
     * ⚠️ 三段式：**头和尾固定，只有中间滚**。
     *
     * 第一版是一个 `justify-content:center` 的 flex 列，内容一长就撞上那个经典的坑：
     * **居中 + 溢出会把两端一起挤出可视区** —— 顶上的标题和底下的「走第 1 步」按钮
     * 同时消失，而且滚不回来（溢出方向上的那一半在滚动区之外）。
     * 百科段一进来这张卡就长了两三百字，当场复现。
     * 所以标题和按钮各自钉死，中间那段自己滚。
     */
    <div className="startframe">
      <div className="sfhead">
        <div className="sfmark" aria-hidden>0</div>
        {/*  写了大白话的实验，标题就用它那句钩子（一个问题），比「还没开始」更有抓手。 */}
        <h2>{plain ? plain.hook : '还没开始'}</h2>
      </div>

      <div className="sfscroll">
        {/*  ⚠️ 这里摆的是**「这一屏讲的是什么」**（`what`），不是大白话正文。
             第一版只写了一句「上面的导览里有一段大白话，先读它」—— 用户看了说
             「（这块）也可以把解释说明的原理给加上去」。他说得对：导览是可以关掉的浮层，
             关掉之后这张卡就是唯一还在场的解释，指望它去引用另一个可能已经不在的东西，
             等于什么都没说。
             大白话正文不放这儿是因为它也有两三百字，两段摞起来这张卡就只剩滚动条了。 */}
        {plain?.what
          ? <p className="sfsub sfhow">{rich(plain.what)}</p>
          : <p className="sfsub">引擎还没走第 1 步 —— 屏幕上还没有任何结果。</p>}
        <p className="sfsub sfmeta">
          这条推演一共 <b>{total}</b> 步（轴：{axis}）。{plain && '　完整的大白话在上面的导览里。'}
        </p>

        {items.length > 0 && (
          <div className="sfrow">
            <span className="sfk">{stream?.name ?? '输入序列'}</span>
            <span className="sfv mono">
              {items.slice(0, 12).map(String).join(' · ')}{items.length > 12 ? ` … 共 ${items.length} 项` : ''}
            </span>
          </div>
        )}

        {params.length > 0 && (
          <div className="sfrow">
            <span className="sfk">这次的设置</span>
            <span className="sfv">{params.map(p => `${p.k} ${p.v}`).join(' · ')}</span>
          </div>
        )}
      </div>

      <div className="sffoot">
        <button className="sfgo" onClick={onStart}>▶ 走第 1 步</button>
        <p className="sfhint">也可以直接拖时间轴，或按 → 键</p>
      </div>
    </div>
  )
}
