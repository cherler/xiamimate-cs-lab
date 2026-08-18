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
 * ## 高亮为什么是**虚线描边**，而且会自己撤掉
 *
 * 遮罩（把其余部分压暗）会把上下文一起盖掉 —— 而讲解恰恰要你同时看见
 * "这一块"和"它旁边是什么"。所以只描边。
 *
 * 但第一版描的是**实线 + 蓝色填充**，用户当场指出问题：那正是这套界面里
 * 「被选中」的长相。于是「试一试：换成「同组冲突」预置」把那颗按钮点亮之后，
 * 看起来像"同组冲突 已经被选上了"；而用户去点了「局部性好」，
 * **高亮还钉在同组冲突上** —— 界面在说谎。
 *
 * 两处修：
 *   1. 改成**虚线、不填充** —— 读作"讲解正在说这个"，不是"这个被选中了"；
 *   2. **用户做了别的事，高亮就撤掉**。点到有卡的东西就跟过去，
 *      点到别处就把手指放下 —— 那句"点这个"已经不指着现在的状态了。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Card } from '../guide.ts'
import { TERMS, termCardId } from '../guide.ts'

const CLOSED = 'cslab.guide.closed'
const POS = 'cslab.guide.pos'
const readClosed = () => { try { return localStorage.getItem(CLOSED) === '1' } catch { return false } }
const writeClosed = (v: boolean) => { try { localStorage.setItem(CLOSED, v ? '1' : '0') } catch { /* 隐私模式 */ } }

/** 把一张卡对应到页面上的元素。选择器 / 参数项 / 预置按钮三种。 */
/**  底部坞三格的顺序，以及各自那张卡锚在哪 —— 页签下标 ↔ 卡，两个方向都靠这两张表 */
const DOCK_TABS = ['log', 'prob', 'bounds']
const DOCK_ANCHORS = ['.card.log', '.card.prob', '.bounds']

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

export function GuideOverlay({ cards, title, onRequestClose, onReopen, closedRef }: {
  cards: Card[]
  title: string
  onRequestClose: () => void
  onReopen: () => void
  closedRef: boolean
}) {
  const [i, setI] = useState(0)
  const [folded, setFolded] = useState(false)
  /**
   * 拖动。
   *
   * 改成"一屏装下"之后，页面上再没有空地了 —— 一个 380px 宽的浮层**必然**压住
   * 某块内容（实测挡住了右列读数的下半截和轴的右端，连自动化点击都报
   * "intercepts pointer events"）。
   *
   * 这不是位置没选好，是浮层在满屏布局里的固有代价。三条路：缩小它（治标）、
   * 收进右列变成固定面板（用户要的就是浮层）、**让用户自己挪**。选第三条 ——
   * 挡到什么、想挪到哪，用户比我清楚。位置记在 localStorage 里，不用每次挪。
   */
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try { const v = localStorage.getItem(POS); return v ? JSON.parse(v) : null } catch { return null }
  })
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  /** 用户点了别处 —— 高亮先撤掉，翻页时再回来 */
  const [dropped, setDropped] = useState(false)
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
  useEffect(() => {
    setI(0)
    //  **`dropped` 也要复位。** 它记的是"用户刚才点了别处，先把手指放下"，
    //  换了实验就是另一回事了 —— 不复位的话新实验的第一页不高亮，
    //  看起来跟"锚点落空"一模一样（冒烟就是这么报的）。
    setDropped(false)
  }, [title])

  const go = useCallback((n: number) => {
    setI(Math.max(0, Math.min(cards.length - 1, n)))
    setDropped(false)
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
      /**
       * **点实验目录里的按钮不算。**
       *
       * 那个动作的意思是"去那个实验"，不是"讲讲目录是什么"。而且它会把整串卡换掉 ——
       * 于是"跳到目录那张卡"和"换实验后回到第 1 页"两件事撞在一起，
       * 实测是前者赢（React 会在这次事件里先把 effect 冲掉，document 上的监听后跑），
       * 结果点任何一个实验，讲解都停在「页面 · 左边的目录」上。
       *
       * 讲解是**附加**在交互上的，控件自己的语义优先。目录那张卡仍然点得到 ——
       * 点分组标题那些不带动作的地方就行。
       */
      /**
       * **底部坞的页签＝那一格自己那张卡。**
       *
       * 两件事一起解决。一是给人用的：点「真题」这个页签，讲的就该是真题，
       * 而页签本身不是任何卡的锚点，走默认分支会被当成"点了别处"。
       * 二是给下面那个高亮 effect 用的：它替用户点页签把抽屉拉开，那一下
       * 同样会冒泡到这里、同样被判成"点了别处"，于是刚拉开就把高亮撤了 ——
       * 30 个实验共 90 处锚点"落空"，查到最后是自己撤了自己。
       */
      const tab = (e.target as HTMLElement)?.closest?.('.dockbar button')
      if (tab) {
        const k = [...(tab.parentElement?.querySelectorAll('button') ?? [])].indexOf(tab as HTMLButtonElement)
        const sel = DOCK_ANCHORS[k]          //  第四个是折叠钮，没有对应的卡
        const m = sel ? cards.findIndex(c => c.anchor === sel) : -1
        if (m >= 0) { setI(m); setDropped(false) }
        return
      }
      if ((e.target as HTMLElement)?.closest?.('.nav button')) return
      const n = cardIndexAt(e.target, cards)
      if (n >= 0) { setI(n); setDropped(false) }
      //  点到没有卡的东西：不跳，但把高亮撤掉 ——
      //  否则"点这个"的手指会继续指着一个用户已经绕过去的按钮。
      else setDropped(true)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [cards, closedRef])

  /** 高亮当前这一页锚到的元素 */
  useEffect(() => {
    if (closedRef || dropped) return
    const el = elementOf(cards[idx] ?? { id: '', title: '', body: '' })
    if (!el) return
    /**
     * **讲到藏起来的东西，先把它露出来。**
     *
     * 日志 / 真题 / 边界现在收在底部坞里，同一时刻只露一块。讲解翻到
     * 「页面 · 真题」而真题那一格没打开时，高亮会画在一个 `hidden` 的元素上 ——
     * 屏幕上什么也不会发生，跟"锚点落空"长得一模一样。
     *
     * 这里只做一件事：找到它所属的那一格，替用户点一下页签。
     * 浮层因此不需要知道坞的存在，坞也不需要知道浮层 —— 中间靠
     * `data-dock-tab` 这一个属性。
     */
    const pane = el.closest<HTMLElement>('[data-dock-tab]')
    if (pane?.hidden) {
      const bar = document.querySelector<HTMLElement>('.dockbar')
      const idxOfTab = DOCK_TABS.indexOf(pane.dataset.dockTab ?? '')
      bar?.querySelectorAll<HTMLElement>('button')[idxOfTab]?.click()
      /*
       * 切页签是 React 的状态更新，这个 effect 的依赖一个都没变、不会再跑一遍。
       * 所以**不能 return** —— 那等于"把抽屉拉开了却没指里面哪一格"，
       * 30 个实验里日志/真题/边界三张卡共 90 处全落空过一次，而且不报错。
       */
    }
    el.classList.add('guide-lit')
    return () => el.classList.remove('guide-lit')
  }, [idx, cards, closedRef, dropped])

  /**
   * 给浮层**在版面上留出位置** —— 空的是横向的一条，不是纵向的一块。
   *
   * 这条是被一个真 bug 逼出来的：悬停提示"失灵"，查下去发现鼠标压根没落到读数上 ——
   * 落在了 `.gbody` 上。浮层盖着右下角那一块，读数看得见、点不着、也悬停不着。
   * 一屏装下之后页面上再没有空地，浮层压住东西不是没摆好，是必然。
   *
   * 第一版想在中列/右列底下空出卡片的高度，量完发现**没有余量可空**：
   * 右列内容 577px 装在 507px 的框里，本来就在内部滚。纵向再要 178px，
   * 只会把舞台压到地板以下。
   *
   * 改成停在**底部坞的右端**：坞是一条横的、内容可窄可宽的带子，
   * 让出 400px 只是日志少几个字，而中列右列一格都不用动。
   * 量出卡片实际宽度写进 `--guide-w`，坞照着空。
   *
   * **拖走之后就不留了**（`pos` 不为空）：位置是用户自己挑的，
   * 再替他空一条出来只会白白吃掉版面。
   */
  useEffect(() => {
    const root = document.documentElement
    const set = () => {
      const el = box.current
      const on = !dropped && !pos && el
      root.style.setProperty('--guide-w', on ? `${el.offsetWidth + 24}px` : '0px')
    }
    set()
    const el = box.current
    if (!el) return () => root.style.setProperty('--guide-w', '0px')
    //  折叠、翻页、换实验都会改高度 —— 盯着元素本身比列依赖靠谱
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => { ro.disconnect(); root.style.setProperty('--guide-w', '0px') }
  }, [closedRef, dropped, pos, folded, idx, cards])

  /**
   * 给所有"点得出说明"的元素打个记号，CSS 只在悬停时显出来。
   *
   * 覆盖面做满之后更需要这个：用户不知道自己点哪儿有用，就只会点两下作罢。
   * 悬停时一条虚线，等于告诉他"这儿有话说"。
   *
   * `.stagewrap` 不打记号 —— 它是整块舞台，悬停时描一圈太吵，
   * 而且它本来就是"点舞台里任何地方的兜底"，不需要被发现。
   */
  useEffect(() => {
    if (closedRef) return
    const marked: HTMLElement[] = []
    for (const c of cards) {
      if (c.anchor === '.stagewrap') continue
      const el = elementOf(c)
      if (el && !marked.includes(el)) { el.classList.add('guide-able'); marked.push(el) }
    }
    return () => marked.forEach(el => el.classList.remove('guide-able'))
  }, [cards, closedRef])

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

  /**
   * **关掉之后要在原地留一个开关。**
   *
   * 第一版关掉就没了，重新打开的入口藏在页眉那排 chip 里 —— 而那排东西
   * （「10 步」「30 个实验」「进度 0/139」）看着全是被动标签，没人会去点它。
   * 用户第一句话就是"我把说明卡 x 掉后，怎么找回来？"。
   *
   * 改成在**它消失的那个角**上留一颗小按钮：东西从哪儿没的，就从哪儿找回来，
   * 不需要学。参照站也是这么做的（`Textbook.svelte` 里那颗 floating-btn，
   * 同样钉在 `bottom: 2rem; right: 2rem`）。
   *
   * 组件本身不卸载，所以 `i` 还在 —— 再打开时回到关掉前那一页，不是从头来。
   */
  if (closedRef) {
    return (
      <button className="guide-fab" onClick={() => { writeClosed(false); onReopen() }}
              title="打开讲解">
        <span className="gq-mark">?</span>讲解
      </button>
    )
  }
  if (cards.length === 0) return null
  const card = cards[idx]!

  return (
    <aside className="guide" ref={box} role="complementary" aria-label={`${title} 讲解`}
           style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
           /* 这一页该不该在页面上点亮点什么。名词页不锚东西，其余都该锚。
              冒烟拿它区分"没锚点"和"锚点落空了" —— 这两件事看起来一样（屏幕上都没反应），
              但一个是设计、一个是 bug。让组件自己说，比在测试里拿正则猜可靠得多。 */
           data-anchored={String(!!(card.anchor || card.param || card.preset))}>
      {/* 标题栏就是把手 —— 不另加一根拖动条：那会多占一行，而这块地方本来就紧张 */}
      <header className="ghead" onPointerDown={e => {
        if ((e.target as HTMLElement).closest('button')) return
        const r = box.current!.getBoundingClientRect()
        drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
        onPointerMove={e => {
          if (!drag.current) return
          const w = box.current!.offsetWidth, h = box.current!.offsetHeight
          //  夹在视口里：拖出去就再也抓不回来了
          const x = Math.max(4, Math.min(innerWidth - w - 4, e.clientX - drag.current.dx))
          const y = Math.max(4, Math.min(innerHeight - h - 4, e.clientY - drag.current.dy))
          setPos({ x, y })
        }}
        onPointerUp={() => {
          drag.current = null
          try { if (pos) localStorage.setItem(POS, JSON.stringify(pos)) } catch { /* 隐私模式 */ }
        }}>
        <h3>{card.title}</h3>
        <button className="gx" onClick={() => setFolded(f => !f)}
                aria-label={folded ? '展开讲解' : '折叠讲解'}>{folded ? '▴' : '▾'}</button>
        <button className="gx" onClick={() => { writeClosed(true); onRequestClose() }} aria-label="隐藏讲解">✕</button>
      </header>

      {!folded && <p className="gbody">{card.body}</p>}

      {!folded && card.see && card.see.length > 0 && (
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
