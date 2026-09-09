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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { rich } from './rich.tsx'
import type { Card } from '../guide.ts'
import { TERMS, termCardId } from '../guide.ts'

const CLOSED = 'cslab.guide.closed'
const POS = 'cslab.guide.pos'
const readClosed = () => { try { return localStorage.getItem(CLOSED) === '1' } catch { return false } }
const writeClosed = (v: boolean) => { try { localStorage.setItem(CLOSED, v ? '1' : '0') } catch { /* 隐私模式 */ } }

/** 把一张卡对应到页面上的元素。选择器 / 参数项 / 预置按钮三种。 */
/**  底部坞三格的顺序，以及各自那张卡锚在哪 —— 页签下标 ↔ 卡，两个方向都靠这两张表 */
/**
 * 旁栏每一格对应的**锚点**，按格子的 id 索引 —— 不按它排第几。
 *
 * ⚠️ 原来是个数组 `['.card.log', '.card.prob', '.bounds']`，靠下标对齐。
 * 往最前面插了「这一步为什么」那一格之后整排**错位一格**：
 * 点「逐步日志」讲的是真题、点「真题」讲的是边界，一个错都不报。
 * 位置会变，id 不会。
 */
const DOCK_ANCHORS: Record<string, string> = {
  log: '.card.log',
  prob: '.card.prob',
  bounds: '.bounds',
  why: '.stagewrap',
}

function elementOf(card: Card): HTMLElement | null {
  if (card.param) {
    for (const el of document.querySelectorAll<HTMLElement>('.param')) {
      if (el.querySelector('.k')?.textContent?.trim().startsWith(card.param)) return el
    }
    return null
  }
  if (card.preset) {
    /*
     * ⚠️ **按标识找，不按文字。**
     * 原来比的是 `el.textContent === card.preset` —— 2026-08-19 把预置按钮从
     * "一颗药丸"改成"标题 + 一句要点"的卡片，textContent 里多了那句要点，
     * 56 处锚点当场落空，而且一个错都不报。
     * 这跟同一天在坞的页签上栽的那次是同一个病：**用会变的东西当键**。
     * 文字会改、位置会挪，`data-preset` 不会。
     */
    const byId = document.querySelector<HTMLElement>(
      `.seqacts [data-preset="${card.preset}"], .entacts [data-preset="${card.preset}"]`)
    if (byId) return byId
    //  留一条文字兜底：万一哪个按钮还没挂上属性，别静默失效
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
      if (c.preset && node.tagName === 'BUTTON'
        && (node.dataset.preset === c.preset || node.textContent?.trim() === c.preset)) return i
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
  /**
   * 矮屏上**默认折起**（只留标题条 + 翻页）。
   *
   * 一屏装下之后页面上没有空地，这张浮层必然压住点什么 —— 以前压的是底部坞
   * 那条横带（那儿没有可点的东西，所以相安无事）。坞并进实验区之后，
   * 它落到哪儿都是舞台：1280×720 上实测压住三个格子。
   * 与其挑一个"稍微少压一点"的位置，不如**矮屏上先收起来** ——
   * 想看时点一下就展开，而屏幕够高时（>820px）舞台下沿本来就有空带，照旧摊开。
   */
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
  /** 收起态那颗按钮的拖动。多两个字段：起点与"动没动过"，用来跟点击区分 */
  const fabDrag = useRef<{ dx: number; dy: number; x0: number; y0: number; moved: boolean } | null>(null)
  /** 刚刚是拖完松手的那一下 —— 紧跟其后的 click 要放过（见 fab 的 onPointerUp） */
  const justDragged = useRef(false)
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
      if (selfClick.current) return
      //  点卡片自己不算
      if (box.current?.contains(e.target as Node)) return
      /*
       * 点**实验单**也不算。它跟讲解卡一样是"解释层"，不是实验本身 ——
       * 在上面押注、翻看、关掉，都不该改变讲解正指着哪儿。
       * （不写这一条，光是关实验单那一下就会把高亮撤掉：和坞页签同一类的坑。）
       */
      if ((e.target as HTMLElement)?.closest?.('.brief')) return
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
        //  按 id 认，不按下标 —— 收起钮没有 data-dock-tab，自然落空，正合适
        const id = (tab as HTMLElement).dataset.dockTab
        const sel = id ? DOCK_ANCHORS[id] : undefined
        const m = sel ? cards.findIndex(c => c.anchor === sel) : -1
        if (m >= 0) { setI(m); setDropped(false) }
        return
      }
      if ((e.target as HTMLElement)?.closest?.('.nav button')) return
      /*
       * ⚠️ **播放控件是中立区。**
       * 按「下一步」是在推进轨迹 —— 用户想看的是下一步的解释，
       * 结果整条轴锚着「轴上的柱子」那张卡，一按就被弹回去说"轴是什么"。
       * 「这一步为什么是这样」那张卡跟着状态走，正是要在按步进时留在原地看它变。
       *
       * 判据：点「下一步」，卡片 id 不该变（冒烟第 13 组）。
       */
      if ((e.target as HTMLElement)?.closest?.('.ctl')) return
      /*
       * ⚠️ **引导式笔记整层是中立区。**
       *
       * 它盖在中列上，讲解卡说的那些东西全在它底下。点它里面任何地方
       * （尤其是「关闭笔记」）都不是"点了别处"，而是**把底下的东西露出来** ——
       * 走默认分支的话，刚一关掉笔记高亮就被自己撤了，
       * 30 个实验的第 1 页全报「声明了锚点却没落下」。
       * 跟上面播放控件那一条是同一个道理：这一下的语义不是"我要看别的"。
       */
      if ((e.target as HTMLElement)?.closest?.('.gnote')) return
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
    /*  锚点落在旁栏某一格里时，替用户把那一格切出来 —— 否则"讲的东西"是藏着的。
        ⚠️ 这一下是程序点的，不能再被自己的「点哪讲哪」接住（会来回弹）。 */
    const pane = el.closest<HTMLElement>('[data-dock-tab]')
    if (pane?.dataset.dockTab) {
      const t = document.querySelector<HTMLElement>(
        `.dockbar [data-dock-tab="${pane.dataset.dockTab}"]`)
      selfClick.current = true
      t?.click()
      selfClick.current = false
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
      /*
       * `--guide-h`：**只有真的压到实验区时才发布**，舞台照这个数在底部让出一条。
       *
       * ⚠️ 相交要跟 `.stagerow` 比，不能跟 `.stagewrap` 比 —— 后者的高度会被
       * 这条留位本身改掉：让位 → 舞台变矮 → 不再相交 → 撤回让位 → 又相交……
       * 一帧一个来回。`.stagerow` 的高度由 flex 定死，不随留位变，是稳定的参照系。
       */
      const row = document.querySelector('.stagerow')?.getBoundingClientRect()
      const g = el?.getBoundingClientRect()
      const hitStage = !!(on && row && g && g.right > row.left && g.left < row.right
                                       && g.bottom > row.top && g.top < row.bottom)
      /*  让出**实际重叠的那一段**，不是整张卡的高度 —— 卡片下缘往往已经探出实验区，
          按整高让会白割掉几十像素（实测 129px 里有 30 多是白让的，
          代价是 7 个实验的图在 720p 上多缺一截）。 */
      const depth = hitStage ? Math.max(0, Math.ceil(row!.bottom - g!.top) + 8) : 0
      root.style.setProperty('--guide-h', `${depth}px`)
    }
    set()
    const el = box.current
    if (!el) return () => { root.style.setProperty('--guide-w', '0px'); root.style.setProperty('--guide-h', '0px') }
    //  折叠、翻页、换实验都会改高度 —— 盯着元素本身比列依赖靠谱
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => { ro.disconnect(); root.style.setProperty('--guide-w', '0px'); root.style.setProperty('--guide-h', '0px') }
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
  /*
   * ⚠️ **这三个钩子必须待在所有提前 return 上面。**
   * 第一版写在 `const card = cards[idx]` 旁边（渲染前一行），
   * 那里已经在 `if (closedRef) return …` 下面了 —— 讲解收起来的那一次渲染
   * 少跑三个钩子，React 报 "Rendered fewer hooks than expected"，
   * 整个 App 白屏。冒烟是在**收起讲解**那一步炸的，而报错说的是 hooks，
   * 两头对不上，找起来最费劲。
   *
   * 主干 = 没标 `tier: 'ref'` 的那几张（对象 / 单步规则 / 第一项实验）。
   * `trunk` 存的是它们在 `cards` 里的下标 —— 卡片本身仍然是一个数组，
   * 因为"点哪讲哪"要按下标跳，分成两个数组会多一层映射，而那层映射
   * 正是坞页签、预置那几次翻车的形状（拿位置当键）。
   */
  const trunk = useMemo(
    () => cards.map((c, i) => (c.tier === 'ref' ? -1 : i)).filter(i => i >= 0),
    [cards],
  )
  const at = trunk.indexOf(idx)
  const onTrunk = at >= 0
  /*  从参考层回来时落回**刚才那一张**主干卡，不是回第一张 ——
      点开一个术语再回来，被弹回开头会把刚读到的位置丢掉。 */
  const lastTrunk = useRef(0)
  /*  正在由本组件程序化点击页面（替用户切旁栏页签）—— 这期间不认自己的点击 */
  const selfClick = useRef(false)
  useEffect(() => { if (at >= 0) lastTrunk.current = at }, [at])


  if (closedRef) {
    return (
      /*
       * 收起之后那颗「? 讲解」**也要能拖**。
       *
       * 它跟展开态共用同一个 `pos`：从哪儿拖走的，请回来还在哪儿。
       * 而且它本来就压着东西 —— 默认落在右下角，正好盖住走带右端
       * 那行「第 1 步 / 共 12 步」。展开态能拖、收起态不能拖，
       * 等于"挡住你的时候你反而没法挪它"。
       *
       * ⚠️ **4px 门槛**：一上来就 `setPointerCapture` 会把随后的 click 劫走，
       * 这颗按钮的正事恰恰是被点开。位移超过 4px 才算拖，否则仍然是一次点击。
       * （同一个坑在走带那条刻度带上栽过一次，见 AxisBand。）
       */
      <button className="guide-fab" title="打开讲解 · 也可以拖着挪窝"
              style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
              onPointerDown={e => {
                /*  ⚠️ **按下就抓指针**，不能等过了 4px 门槛再抓。
                    这颗按钮只有 81×35：鼠标一动就出了它的范围，
                    而没有捕获的话，后续 pointermove 落到光标底下那个元素上 ——
                    门槛永远等不到第二个 move，拖动一动不动（实测：整段拖拽只收到
                    一个 pointerdown，一个 move 都没有）。
                    卡片那边的拖动没这毛病，纯粹是因为卡片够大。 */
                const el = e.currentTarget as HTMLElement
                const r = el.getBoundingClientRect()
                fabDrag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top,
                                    x0: e.clientX, y0: e.clientY, moved: false }
                el.setPointerCapture(e.pointerId)
              }}
              onPointerMove={e => {
                const d = fabDrag.current
                if (!d) return
                //  门槛只用来分辨"点"和"拖"，不再兼管抓指针
                if (!d.moved && Math.abs(e.clientX - d.x0) < 4 && Math.abs(e.clientY - d.y0) < 4) return
                d.moved = true
                const el = e.currentTarget as HTMLElement
                setPos({ x: Math.max(4, Math.min(innerWidth - el.offsetWidth - 4, e.clientX - d.dx)),
                         y: Math.max(4, Math.min(innerHeight - el.offsetHeight - 4, e.clientY - d.dy)) })
              }}
              onPointerUp={() => {
                /*  抓了指针，随后那一下 click 一定会打到这颗按钮上（哪怕光标早已离开）。
                    所以"刚才是不是在拖"得**留到 click 之后**再清，不能在这里就清掉。 */
                justDragged.current = fabDrag.current?.moved ?? false
                fabDrag.current = null
                if (justDragged.current) {
                  try { if (pos) localStorage.setItem(POS, JSON.stringify(pos)) } catch { /* 隐私模式 */ }
                }
              }}
              onClick={() => {
                //  刚拖完那一下不算点击 —— 否则挪一下窝就顺手把它打开了
                if (justDragged.current) { justDragged.current = false; return }
                writeClosed(false); onReopen()
              }}>
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
           data-anchored={String(!!(card.anchor || card.param || card.preset))}
           /*  把卡片 id 挂出来 —— 判据认它，不认标题。
               标题是**给人读的文案**，随时会重写（这一轮就在重写几百张）；
               拿文案当键，每改一个字就红一次，最后只会把判据改成跟着实现走。
               这是同一个病的第四次：坞的页签按下标、预置按文字、高亮按文字、这里按标题。 */
           data-card={card.id}
           /*  把这张卡**锚在哪儿**也挂出来。判据原来拿 `tourN` 里的 N 当期望值，
               而 N 是 TOUR 数组的下标 —— 数组增删一条，三处判据一起错位、
               应用却一点没坏（「拿位置当键」的第八次）。锚点是这张卡的本质，
               不会因为别人增删而变。 */
           data-anchor={card.anchor ?? ''}
           /*  ⚠️ **"高亮没落下"有两个完全不同的原因，屏幕上长得一模一样。**
               一是选择器不匹配（真 bug，舞台的 class 改了）；二是 `dropped` ——
               用户刚点了别处，高亮被**主动撤掉**，翻一页就回来（设计如此）。
               冒烟报「声明了锚点却没落下」时分不出这两者，查了一整轮才落到
               "上一组留下的点击"上。把它挂出来，判据一眼就能说清是哪一种。 */
           data-dropped={String(dropped)}>
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
        {/*
          翻页栏并进标题行。原来它自成一行（上边框 + 内边距 + 进度条），
          在这张卡上要花掉 40px —— 而整张卡在短屏上只有 110px 的位置
          （高度封在坞那一条带子里，见 stage.css）。省掉这一行，正文从 2.5 行变成 5 行。
          **元素名一个没改**：冒烟有 6 处选择器挂在 `.gfoot .gnav` 上，
          为了排版顺手改掉别人的判据，是把检查改成"跟着实现走"。
          去掉的只有那根进度条 —— 「13 / 27」已经把它说了一遍。
        */}
        {/*
          翻页只走**主干**那三张（对象 → 单步规则 → 第一项实验）。
          参考层的二十几张照样点得到，但不堵在这条路上 —— 见 `guide.ts` 的 `tier`。
          现在停在参考层时，这里不报"第几 / 共几"（那会让人以为主干有 28 张），
          只给一条回主干的路。
        */}
        <footer className="gfoot">
          {/*  ⚠️ `data-nav` 不是装饰：翻页栏在主干和参考层是**两套按钮**，
               「最后一个 .gnav」在主干是「下一条」、在参考层是「回主干」。
               判据按位置找按钮，就会在参考层点了回主干还以为自己翻了页 ——
               这是"拿位置当键"的第五次（坞页签按下标 · 预置按文字 · 高亮按文字 ·
               卡片按标题 · 这里按位置）。名字挂上去，位置怎么变都不影响。 */}
          {onTrunk
            ? <>
                <button className="gnav" data-nav="prev" onClick={() => go(trunk[at - 1]!)}
                        disabled={at <= 0} aria-label="上一条">‹</button>
                <span className="gnum">{at + 1} / {trunk.length}</span>
                <button className="gnav" data-nav="next" onClick={() => go(trunk[at + 1]!)}
                        disabled={at < 0 || at >= trunk.length - 1} aria-label="下一条">›</button>
              </>
            : <>
                <span className="gnum gref">参考</span>
                <button className="gnav gback" data-nav="back"
                        onClick={() => go(trunk[lastTrunk.current] ?? trunk[0]!)}
                        aria-label="回到主干">回主干</button>
              </>}
        </footer>
        <button className="gx" onClick={() => setFolded(f => !f)}
                aria-label={folded ? '展开讲解' : '折叠讲解'}>{folded ? '▴' : '▾'}</button>
        <button className="gx" onClick={() => { writeClosed(true); onRequestClose() }} aria-label="隐藏讲解">✕</button>
      </header>

      {!folded && <p className="gbody">{rich(card.body)}</p>}

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

    </aside>
  )
}
