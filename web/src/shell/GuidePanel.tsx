/**
 * 「这是什么」卡片 —— 摆在舞台**上面**，因为看不懂的人是先看到舞台才卡住的。
 *
 * ## 三件事，按新手真实的卡壳顺序排
 *
 *   1. 这个实验回答什么问题        ← 不知道要看什么，剩下全白搭
 *   2. 屏幕上每块是什么            ← 知道要看什么了，但不知道去哪儿看
 *   3. 先拧什么、看什么            ← 会看了，但不知道自己该动手做什么
 *
 * 名词单独一栏，点一下就地展开 —— **不做悬浮气泡**：气泡要算位置、会被容器裁掉，
 * 而且在触屏上没有 hover。就地展开笨，但笨得可靠。
 *
 * ## 默认展开，收起之后记住
 *
 * 第一次来的人一定要看见它（那正是这块东西存在的理由）；
 * 看懂了的人不该每次都被它顶掉半屏。收起状态存 localStorage，**全局一份**而不是
 * 每个实验一份 —— 一个人只需要学会一次"这个卡片是干嘛的"。
 */
import { useState } from 'react'
import type { Guide } from '../guide.ts'
import { TERMS, TOUR } from '../guide.ts'

const KEY = 'cslab.guide.collapsed'

const read = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
const write = (v: boolean) => { try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* 隐私模式 */ } }

export function GuidePanel({ guide, title }: { guide: Guide; title: string }) {
  const [collapsed, setCollapsed] = useState(read)
  const [openTerm, setOpenTerm] = useState<string | null>(null)
  const [tour, setTour] = useState(false)

  const toggle = () => { const v = !collapsed; setCollapsed(v); write(v) }

  if (collapsed) {
    return (
      <button className="guide collapsed" onClick={toggle}>
        <span className="gq">{guide.question}</span>
        <span className="gmore">展开讲解</span>
      </button>
    )
  }

  return (
    <section className="guide" aria-label={`${title} 讲解`}>
      <header className="ghead">
        <h3>这是什么</h3>
        <button className="gx" onClick={toggle}>收起</button>
      </header>

      <p className="gq">{guide.question}</p>

      <div className="gcols">
        <div className="gcol">
          <div className="gcap">屏幕上每块是什么</div>
          <ul className="glist">
            {guide.read.map((r, i) => (
              <li key={i}><b>{r.at}</b>{r.is}</li>
            ))}
          </ul>
        </div>
        <div className="gcol">
          <div className="gcap">先拧什么，看什么</div>
          <ol className="glist try">
            {guide.try.map((t, i) => (
              //  data-param 是给冒烟用的：它要拿这个名字去参数面板上核对旋钮真的存在。
              //  **不挂 window 全局**，因为那是只为测试而存在的生产代码；
              //  而这个属性描述的就是这一条导览本身，写在 DOM 上是它该在的地方。
              <li key={i} data-param={t.param} data-preset={t.preset}><b>{t.act}</b>{t.watch}</li>
            ))}
          </ol>
        </div>
      </div>

      {guide.terms.length > 0 && (
        <div className="gterms">
          <div className="gcap">名词</div>
          <div className="gchips">
            {guide.terms.map(id => {
              const t = TERMS.find(x => x.id === id)
              //  找不到就整个不渲染。渲染一个点了没反应的词比没有更糟 ——
              //  而"不许有悬空引用"由 tests/guide-content.test.ts 钉着，这里只是兜底。
              if (!t) return null
              return (
                <button key={id} className={openTerm === id ? 'on' : ''}
                        onClick={() => setOpenTerm(openTerm === id ? null : id)}>
                  {t.term}
                </button>
              )
            })}
          </div>
          {openTerm && (
            <p className="ggloss">{TERMS.find(x => x.id === openTerm)?.gloss}</p>
          )}
        </div>
      )}

      <div className="gtour">
        <button className="gtourbtn" onClick={() => setTour(!tour)}>
          {tour ? '收起' : '页面怎么用'}
        </button>
        {tour && (
          <ul className="glist">
            {TOUR.map((r, i) => <li key={i}><b>{r.at}</b>{r.is}</li>)}
          </ul>
        )}
      </div>
    </section>
  )
}
