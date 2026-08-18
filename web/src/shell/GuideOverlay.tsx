/**
 * 悬浮讲解卡 —— 参照 Transformer Explainer 的那块：**浮在页面上，不占版面**，
 * 可以翻页，**点页面上的东西它就跟着跳过去**。
 *
 * ## 为什么从"塞在列里"改成浮层
 *
 * 第一版把讲解做成中列里的一张卡。它有两个毛病，都是位置带来的：
 *
 * 1. **它把舞台顶下去了。** 而讲解要讲的正是舞台 —— 一边看字一边看不到实物，
 *    等于让人拿着说明书去找一台不在眼前的机器。
 * 2. **它是死的。** 用户盯着屏幕上某一块发愣时，没有办法问"这块是什么"。
 *
 * 浮层同时解掉这两条：正文不动，讲到哪儿就把哪儿**高亮**给你看；
 * 反过来，你点页面上任何一块被讲过的东西，卡片直接翻到那一页。
 *
 * ## 锚点是**一处定义、两个方向用**
 *
 * 每张卡带一个 CSS 选择器（或"参数面板里叫 X 的那一项"）。
 *   卡 → 元素：翻到这一页时，给那个元素加上高亮
 *   元素 → 卡：点了那个元素，找出第一张锚到它的卡，翻过去
 * 两个方向共用同一份定义，所以不会出现"点得到但讲不了"或反过来。
 *
 * ## 高亮为什么是描边不是遮罩
 *
 * 遮罩（把其余部分压暗）看着更"专业"，但它会**把上下文一起盖掉** ——
 * 而讲解恰恰要你同时看见"这一块"和"它旁边是什么"。所以只描边 + 轻微提亮。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Card } from '../guide.ts'
import { TERMS, termCardId } from '../guide.ts'

const CLOSED = 'cslab.guide.closed'
const readClosed = () => { try { return localStorage.getItem(CLOSED) === '1' } catch { return false } }
const writeClosed = (v: boolean) => { try { localStorage.setItem(CLOSED, v ? '1' : '0') } catch { /* 隐私模式 */ } }

/** 把一张卡对应到页面上的元素。选择器 / 参数项 / 预置按钮三种。 */
function elementOf(card: Card): HTMLElement | null {
  if (card.param) {
    for (const el of document.querySelectorAll<HTMLElement>('.param')) {
      if (el.querySelector('.k')?.textContent?.trim().startsWith(card.param)) return el
    }
    return null
  }
  if (card.preset) {
    for (const el of document.querySelectorAll<HTMLElement>('.seqacts button, .entacts button')) {
      if (el.textContent?.trim() === card.preset) return el
    }
    return null
  }
  return card.anchor ? document.querySelector<HTMLElement>(card.anchor) : null
}

/** 反过来：点到的这个元素属于哪张卡？从最深处往上找第一个命中的。 */
function cardIndexAt(target: EventTarget | null, cards: Card[]): number {
  let node = target as HTMLElement | null
  while (node && node !== document.body) {
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]!
      if (c.anchor && node.matches(c.anchor)) return i
      if (c.param && node.classList.contains('param')
        && node.querySelector('.k')?.textContent?.trim().startsWith(c.param)) return i
      if (c.preset && node.tagName === 'BUTTON' && node.textContent?.trim() === c.preset) return i
    }
    node = node.parentElement
  }
  return -1
}

export function GuideOverlay({ cards, title, onRequestClose, closedRef }: {
  cards: Card[]
  title: string
  onRequestClose: () => void
  closedRef: boolean
}) {
  const [i, setI] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  /**
   * **必须在渲染里夹一次，不能只靠 effect 归零。**
   *
   * 换实验时 `cards` 立刻换成新的一串，而 `setI(0)` 那个 effect 要等这一帧渲染完
   * 才跑 —— 中间这一帧里 `i` 还是旧值。从 Cache（14 张）翻到最后一页再切去
   * IEEE 754（10 张），`cards[13]` 就是 `undefined`，读它的 `.title` 直接抛，
   * **整棵 React 树被卸载 —— 白屏**。
   *
   * 冒烟第 13 组逮到的就是这个：报出来是"第 3 个实验点不到"，
   * 真相是第 2 个实验把整个页面弄没了。症状与根因隔了一整个实验。
   */
  const idx = Math.min(i, Math.max(0, cards.length - 1))

  //  换实验时回到第一页 —— 停在上一个实验的第 7 页毫无意义
  useEffect(() => { setI(0) }, [title])

  const go = useCallback((n: number) => {
    setI(Math.max(0, Math.min(cards.length - 1, n)))
  }, [cards.length])

  /**
   * 点页面 → 跳到对应的卡。
   *
   * 挂在 document 上用**冒泡**阶段：不能用捕获，否则会抢在按钮自己的
   * onClick 前面跑，而那些按钮本来就有事要做（切参数、装预置）。
   * 讲解是**附加**在交互上的，不该改变交互本身。
   */
  useEffect(() => {
    if (closedRef) return
    const onClick = (e: MouseEvent) => {
      //  点卡片自己不算
      if (box.current?.contains(e.target as Node)) return
      const n = cardIndexAt(e.target, cards)
      if (n >= 0) setI(n)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [cards, closedRef])

  /** 高亮当前这一页锚到的元素 */
  useEffect(() => {
    if (closedRef) return
    const el = elementOf(cards[idx] ?? { id: '', title: '', body: '' })
    if (!el) return
    el.classList.add('guide-lit')
    return () => el.classList.remove('guide-lit')
  }, [idx, cards, closedRef])

  //  ← → 翻页。输入框里不抢键：那儿的左右键是移动光标。
  useEffect(() => {
    if (closedRef) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.key === 'ArrowLeft') go(idx - 1)
      if (e.key === 'ArrowRight') go(idx + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [idx, go, closedRef])

  if (closedRef || cards.length === 0) return null
  const card = cards[idx]!

  return (
    <aside className="guide" ref={box} role="complementary" aria-label={`${title} 讲解`}
           /* 这一页该不该在页面上点亮点什么。名词页不锚东西，其余都该锚。
              冒烟拿它区分"没锚点"和"锚点落空了" —— 这两件事看起来一样（屏幕上都没反应），
              但一个是设计、一个是 bug。让组件自己说，比在测试里拿正则猜可靠得多。 */
           data-anchored={String(!!(card.anchor || card.param || card.preset))}>
      <header className="ghead">
        <h3>{card.title}</h3>
        <button className="gx" onClick={() => { writeClosed(true); onRequestClose() }} aria-label="关闭讲解">✕</button>
      </header>

      <p className="gbody">{card.body}</p>

      {card.see && card.see.length > 0 && (
        <div className="gsee">
          {card.see.map(id => {
            const t = TERMS.find(x => x.id === id)
            if (!t) return null
            const n = cards.findIndex(c => c.id === termCardId(id))
            if (n < 0) return null
            return <button key={id} onClick={() => go(n)}>{t.term}</button>
          })}
        </div>
      )}

      <footer className="gfoot">
        <button className="gnav" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="上一条">‹</button>
        <div className="gbar"><i style={{ width: `${((idx + 1) / cards.length) * 100}%` }} /></div>
        <span className="gnum">{idx + 1} / {cards.length}</span>
        <button className="gnav" onClick={() => go(idx + 1)} disabled={idx === cards.length - 1} aria-label="下一条">›</button>
      </footer>
    </aside>
  )
}
