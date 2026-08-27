/** 舞台：Cache 命中率 —— 因果链 + 地址拆解 + Cache 表 + 本步搬运 / 相联度扫描 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { run } from '@engine/core/kernel.ts'
import { cacheKernel, type CacheState } from '@engine/kernels/cache.ts'
import { makeSweepKernel } from '@engine/kernels/sweep.ts'
import type { SimDocument } from '@engine/core/document.ts'
import type { StageProps } from '../types.ts'

const hex = (n: number) => '0x' + n.toString(16).toUpperCase()
const SHOW_BITS = 16
/**
 * 表里最多摆几行。
 *
 * 概念图上 8 组只列了**前 4 行**：这张表要说明的是"地址落到哪一行、那一行里比什么"，
 * 不是"把 Cache 全部内容抄一遍"。列满 8 行的那版，屏幕上最占地方的是五行空槽。
 * 省掉的组在表下面用一行交代（见 `.cmore`）—— 「屏幕上没有」和「Cache 里没有」是两回事。
 */
const MAX_ROWS = 4

export function CacheStage({ doc, state, trace, tab }: StageProps<CacheState>) {
  if (tab === 'sweep') return <Sweep doc={doc} />
  return <Organization doc={doc} state={state} trace={trace} />
}

/**
 * 表里显示哪几组。
 *
 * 组数不是个小数目：容量 1024B / 块 8B / 直接映射 = **128 组**。
 * 原来的做法是把组横着排成 `auto-fill` 的多栏，栏与栏之间没有表头，
 * 读者得先认出「这一栏是组 8~15」才看得懂——而实测默认配置下
 * 舞台 871×692 里内容只占 287 高，横向铺开换来的是**竖着空掉 400px**。
 *
 * 改成**一张带表头的表 + 一个窗口**：非空组一定在（那才是 Cache 现在装了什么），
 * 当前组一定在（那是这一步在看的），凑不满就补当前组附近的空组。
 * 被省掉的组用一行交代清楚，不假装没有。
 */
function pickRows(sets: CacheState['sets'], cur: number): { rows: number[]; hidden: number; hiddenUsed: number } {
  const n = sets.length
  const all = sets.map((_, i) => i)
  if (n <= MAX_ROWS) return { rows: all, hidden: 0, hiddenUsed: 0 }

  const keep = new Set<number>([cur])
  for (const i of all) if (sets[i].some(e => e)) keep.add(i)
  let rows = [...keep].sort((a, b) => a - b)

  if (rows.length > MAX_ROWS) {
    //  非空组太多：以当前组为中心切一段，保证当前组一定在窗口里
    const pos = rows.indexOf(cur)
    const start = Math.max(0, Math.min(rows.length - MAX_ROWS, pos - (MAX_ROWS >> 1)))
    rows = rows.slice(start, start + MAX_ROWS)
  } else {
    //  还有余位：补当前组左右的空组，让读者看得见"隔壁组是空的"
    for (let d = 1; rows.length < MAX_ROWS && d < n; d++) {
      for (const c of [cur - d, cur + d]) {
        if (c >= 0 && c < n && !rows.includes(c) && rows.length < MAX_ROWS) rows.push(c)
      }
    }
    rows.sort((a, b) => a - b)
  }
  const shown = new Set(rows)
  const hiddenUsed = all.filter(i => !shown.has(i) && sets[i].some(e => e)).length
  return { rows, hidden: n - rows.length, hiddenUsed }
}

// ═══ 视图一：因果链 + 地址拆解 + Cache 表 + 本步搬运 ═══════
function Organization({ doc, state }: { doc: SimDocument; state: CacheState; trace: CacheState[] }) {
  const blockSize = doc.params.blockSizeBytes as number
  const ways = doc.params.associativity as number
  const cacheSize = doc.params.cacheSizeBytes as number
  const numSets = cacheSize / blockSize / ways
  const offsetBits = Math.log2(blockSize)
  const indexBits = Math.log2(numSets)
  const policy = String(doc.params.replacement ?? 'LRU').toUpperCase()

  const svgRef = useRef<SVGSVGElement>(null)
  const idxRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const tblRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const [, force] = useState(0)

  /*
   * 一条走线：**index 段 → 表里的那一行**。
   *
   * 原来这里画两条（index 选组、tag 比对）。tag 那条现在撤掉了 ——
   * 顶上的因果链已经把「比对 tag 4」画成了链条上单独一环，
   * 同一件事在一屏里说两遍，读者反而要先判断这两个是不是一回事。
   * 留下的这条回答的是**空间关系**（地址的那一段落到表的哪一行），
   * 那是链条上的文字给不了的。
   */
  useLayoutEffect(() => {
    const svg = svgRef.current, a = idxRef.current, bar = barRef.current
    const tbl = tblRef.current, b = rowRef.current
    if (!svg || !a || !bar || !tbl || !b) return
    const box = svg.getBoundingClientRect()
    /*
     * ⚠️ **换算回布局像素。** FitBox 用 `transform: scale()` 缩整块舞台，
     * 于是 `getBoundingClientRect()` 量到的是**缩放后**的屏幕像素，
     * 而 SVG 里写的坐标走的是**缩放前**的布局像素。
     * 不换算，画出来的线就会「离原点越远偏得越多」—— 实测 0.91 倍下
     * 横走线整整高了 9%，正好从位段说明文字上碾过去。
     * 「调参前先确认量对了」：这里的量必须先除以倍率。
     */
    const host = svg.parentElement as HTMLElement
    const k = host && host.clientWidth ? box.width / host.clientWidth : 1
    const px = (v: number) => v / k
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
    const x1 = px(ra.left + ra.width / 2 - box.left)
    const y1 = px(ra.bottom - box.top) - 1
    /*  横走线压在**位段条正下方那道空隙**上：位段盒的下沿到换算链的分隔线之间
        本来就是空的。第一版直接从 index 底部横穿过去，正好从 offset 段的
        说明文字上碾过（截图里"块 16B ⇒ 4 位"被切成两截）——
        走线要走空的地方，这个位置得**量**出来，不能凭感觉给个偏移量。 */
    const yRun = px(bar.getBoundingClientRect().bottom - box.top) + 6
    const x2 = px(rb.left - box.left) - 6
    const y2 = px(rb.top + rb.height / 2 - box.top)
    //  竖向那一跳走**两栏之间的空槽**：拿右栏卡片的左边界算，而不是拿行标签
    //  往左退一个猜出来的偏移量 —— 后者会正好压在卡片的边框上。
    const xGut = px(tbl.getBoundingClientRect().left - box.left) - 7
    svg.innerHTML =
      `<path d="M ${x1} ${y1} V ${yRun} H ${xGut} V ${y2} H ${x2 - 2}" fill="none"
         stroke="var(--f-idx)" stroke-width="1.2" stroke-dasharray="2.5 3" opacity=".9"/>
       <circle cx="${x1}" cy="${y1}" r="2.2" fill="var(--f-idx)"/>
       <path d="M ${x2 - 4.5} ${y2 - 3.2} L ${x2 - 4.5} ${y2 + 3.2} L ${x2 + 1} ${y2} Z" fill="var(--f-idx)"/>`
  })

  useLayoutEffect(() => {
    const on = () => force(n => n + 1)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  /** 当前地址落在第几号内存块 —— 换算链和格子里的地址都用它 */
  const blockNo = Math.floor(state.address / blockSize)
  const bits = state.address.toString(2).padStart(SHOW_BITS, '0').split('')
  const tagBits = bits.slice(0, SHOW_BITS - indexBits - offsetBits)
  const idxBits = bits.slice(SHOW_BITS - indexBits - offsetBits, SHOW_BITS - offsetBits)
  const offBits = bits.slice(SHOW_BITS - offsetBits)

  const hit = state.outcome === 'hit'
  const { rows, hidden, hiddenUsed } = pickRows(state.sets, state.setIndex)
  /*
   * 相联度一高，列就窄到装不下地址区间。
   *
   * 这不是估的：区间印出来是 `0x210~0x21F` 十一个等宽字（9.5px ≈ 6px/字）
   * 加左右内边距，约 **90px** 才放得下；而一列的宽度是
   * （表宽 ≈ 560 − 组号 54 − 状态 86）÷ 路数。4 路时 ≈ 140px 够，
   * 8 路时 ≈ 70px 不够 —— 实测就是这一档把区间挤出格子、撞到隔壁列上。
   * 装不下就**不印**，而不是印一半：截断的十六进制没有任何用处。
   * tag 是这一格非有不可的那个数，区间是锦上添花。
   */
  const showRange = ways <= 4

  return (
    <div className="card cachev">
      {/*
        * ⚠️ 舞台顶上原来还有一条「地址 = Tag + Index + Offset；Index 决定去哪组…」。
        * 撤掉了：概念图上没有它，而它讲的三件事**下面三个盒子各自都写着**
        * （盒子的名字 + 悬停里的定义 + 引下来的值）。
        * 口诀没丢 —— 讲解卡的两张基础卡里逐字都在。
        */}
      {/*
        * **因果链** —— 这一屏的主心骨。
        *
        * 之前一屏上有四块东西（位段、换算、组矩阵、读数），每块都对，
        * 但「这一步到底发生了什么」要读者自己把四块串起来。
        * 链条把那条推理明写出来：地址 → 组号 → 检索范围 → 比对 → 判定。
        * 末端那一环就是结论，所以下面不再重复印一遍判决横幅。
        */}
      <ol className="chain">
        <li className="ck now"><span>当前地址</span><b>{hex(state.address)}</b></li>
        <li className="ck"><span>Index</span><b>{state.setIndex}</b></li>
        <li className="ck"><span>检查组</span><b>{state.setIndex}</b></li>
        {/*  概念图上是四环。「比对 tag」那一环撤掉了 —— 比对的结果
             就写在表里那一格上（`= 4` / `≠ 4`），链条上再挂一环是同一件事说两遍。 */}
        <li className={`ck end ${hit ? 'hit' : 'miss'}`}>{hit ? '命中' : '缺失'}</li>
      </ol>

      <div className="stage cwork">
        <svg ref={svgRef} />

        <section className="csub caddr">
          <div className="csubh">地址拆解<em>（共 {SHOW_BITS} 位）</em></div>
          <div className="bits">
            <div className="bitrow" ref={barRef}>
              {/*  ⚠️ tag 印**十进制**。用户原话：「块-》tag，还是要用 0x0 这种方式表达吗？」
                   —— 对的，tag 不是地址，是"第几批"的编号，写成 0x 前缀反而让人
                   把它当地址读。全屏统一一条规则：**`0x` 只给地址，编号一律十进制**。 */}
              {/*
                * 悬停里三段，**三个盒子的写法完全平行**：干什么 → 多少位 → 这一步算出来是多少。
                *
                * 之前是把「定义；位宽推导。算式」用分号句号串成一坨 ——
                * 三件不同的事挤在一句里，读者得先把它们拆开才能读，
                * 而这三件事恰好就是学生看着位段图会依次问的三个问题。
                * 平行的结构让第二个盒子不用重新学怎么读。
                */}
              <Seg cls="s-tag" k="tag" bits={tagBits} v={String(state.tag)} truncated
                   ask="**认块** —— 同一组里能放好几个不同的内存块；靠 tag 分辨这一路装的是不是你要的那一块。"
                   why={`**${tagBits.length} 位** —— 地址 ${SHOW_BITS} 位，去掉 index ${indexBits} 位、`
                      + `offset ${offsetBits} 位，剩下的全归 tag。`}
                   calc={`第 ${blockNo} 号内存块 ÷ ${numSets} 组 = tag ${state.tag}`} />
              <Seg cls="s-idx" k="index" bits={idxBits} v={String(state.setIndex)} innerRef={idxRef}
                   ask="**定组** —— 算出这个地址该去哪一组，没得挑；其余组这一步不参与比较。"
                   why={`**${indexBits} 位** —— ${numSets} 组要 ${indexBits} 位（2^${indexBits} = ${numSets}）。`}
                   calc={`${hex(state.address)} ÷ ${blockSize}B = 第 ${blockNo} 号内存块；`
                       + `${blockNo} ÷ ${numSets} 余 ${state.setIndex} → 组 ${state.setIndex}`} />
              <Seg cls="s-off" k="offset" bits={offBits} v={String(state.offset)}
                   ask={`**定字节** —— 一块 ${blockSize}B，这一段指出你要的是块里第几个字节。`}
                   why={`**${offsetBits} 位** —— 块 ${blockSize}B 要 ${offsetBits} 位（2^${offsetBits} = ${blockSize}）。`}
                   calc={`${hex(state.address)} ÷ ${blockSize} 余 ${state.offset} → 第 ${state.offset} 个字节`} />
            </div>
          </div>
          {/*
            * ⚠️ **换算链撤掉了**（原来这里有三行：所属内存块 / 映射到的组 / 该块的 tag）。
            *
            * 概念图上这张卡只有"盒子 + 引线 + 值"三层。那三行讲的是同一件事的
            * 除法写法 —— 而位段图已经用**切位**讲了一遍，两种讲法并排摆着，
            * 屏幕上就多出一块只有做题时才用得上的推导。
            * 它没丢：`0x210 ÷ 16 = 第 33 块 → 33 % 8 = 组 1 → 33 ÷ 8 = tag 4`
            * 现在挂在位段盒的悬停里（见下面 `Seg` 的 data-tip）。
            */}
        </section>

        <section className="csub ctbl" ref={tblRef}>
          {/*  相联度为 1 时它的名字是**直接映射**，不叫「1 路组相联」——
               教材和真题都用前者，界面跟着教材走 */}
          <div className="csubh">Cache<em>
            （{ways === 1 ? '直接映射' : `${ways} 路组相联`} · {numSets} 组 · 块 {blockSize}B）
          </em></div>
          {/*
            * 组按**表**排，一行一组，最右边一列是这一步对这一组的判定。
            * 列数由相联度决定，交给一个自定义属性，CSS 里只写一次网格。
            */}
          <div className="sets"
               style={{ ['--cols' as string]: `54px repeat(${ways}, minmax(0,1fr)) 86px` }}>
            <div className="setrow head">
              <div className="setlbl">组号</div>
              {Array.from({ length: ways }, (_, w) => <div key={w} className="cell hd">路 {w}</div>)}
              <div className="setst hd">状态</div>
            </div>
            {rows.map(si => {
              const set = state.sets[si]
              const active = si === state.setIndex
              const vacant = !active && set.every(e => e === null)
              return (
                <div key={si} className={`setrow ${active ? 'active' : ''} ${vacant ? 'vacant' : ''}`}>
                  <div className="setlbl" ref={active ? rowRef : undefined}>组 {si}</div>
                  {set.map((e, wi) => {
                    const touched = active && wi === state.wayUsed
                    const replaced = touched && state.evictedTag !== null
                    /*
                     * 比较标记只画在**被选中的那一组**：Cache 也只比那一组。
                     * 注意 `sets` 是这一步**做完之后**的状态 —— 被选中的那一路无论命中还是
                     * 缺失，里面装的都已经是当前 tag 了。所以不能拿 `e.tag === state.tag`
                     * 当"命中"判据，那样缺失也会显示 `=`。命中与否只认 `outcome`。
                     */
                    const cmp = !active || !e ? null
                      : touched ? (hit ? '=' : '装入')
                      : `≠ ${state.tag}`
                    const cls = [
                      'cell',
                      e ? '' : 'empty',
                      touched ? `touched ${state.outcome}` : '',
                      replaced ? 'replaced' : '',
                    ].filter(Boolean).join(' ')
                    return (
                      <div key={wi} className={cls}>
                        {/*
                          * ⚠️ **tag 要带标签。** 原来格子里就一个光秃秃的 `0x0`，
                          * 用户直接问「大的 0x0 是 tag？小的 0x0~0xF 是内存地址？
                          * 为什么只存 tag，且默认不加 tag 标签？」——
                          * 一个没有名字的数，读的人只能猜。
                          */}
                        <span className="t">
                          {/*  空格子写「无效」，不是一道虚线槽 —— 概念图上就是这个字。
                               有效位这个概念本身是考点，写出来比画一道线诚实。 */}
                          {e
                            ? <><i className="tk">tag</i>{String(e.tag)}</>
                            : <i className="void">无效</i>}
                          {cmp && <b className={`cmp ${cmp === '=' ? 'eq' : cmp === '装入' ? 'nw' : 'ne'}`}>{cmp}</b>}
                        </span>
                        {/*
                          * **装的是哪一块内存** —— 用户原话：
                          * 「已存储的 cache 块可以填写它存的内存地址」。
                          * 反解很直接：块号 = tag × 组数 + 组号，起始地址 = 块号 × 块大小；
                          * 一块覆盖 blockSize 个字节，所以印成一个区间。
                          */}
                        <span className="m">
                          {!e
                            ? <span className="dash">—</span>
                            : showRange
                            ? <span className="mem">
                                {hex((e.tag * numSets + si) * blockSize)}
                                <i>~{hex((e.tag * numSets + si) * blockSize + blockSize - 1)}</i>
                              </span>
                            : ''}
                        </span>
                      </div>
                    )
                  })}
                  <div className="setst">
                    {active
                      ? <b className={hit ? 'hit' : 'miss'}>● {hit ? '命中' : '缺失'}</b>
                      : <span className="dash">—</span>}
                  </div>
                </div>
              )
            })}
          </div>
          {/*  省掉的组要交代清楚 —— 「屏幕上没有」和「Cache 里没有」是两回事 */}
          {hidden > 0 && (
            <p className="cmore">
              另有 <b>{hidden}</b> 组未列出
              {hiddenUsed === 0 ? '（均为空）' : <>（其中 <b>{hiddenUsed}</b> 组已装入内存块）</>}
              {' —— 本步只检查组 '}{state.setIndex}，其余组不参与比较。
            </p>
          )}
      {/*
        * **本步的搬运** —— 缺失到底"做了什么"，用一条流水线画出来，
        * 而不是在别处写一句"淘汰了 tag 0"。三个盒子分别是
        * 从哪儿来 · 进了哪一格 · 谁被挤出去了。
        *
        * ⚠️ 它**嵌在 Cache 卡里**，不是舞台底下一条通栏。概念图上就是这样，
        * 而理由是结构性的：搬运的起点和终点都是这张表里的格子，
        * 摆到卡外面就等于把一件事的因和果分到了两个框里。
        * 顺带还平了两列的高度 —— 地址卡天生比表短一截。
        */}
      <section className="cmove">
        <div className="cmoveh">本步结果<b className={hit ? 'hit' : 'miss'}>{
          //  「淘汰了谁」下面那三个盒子正画着，这一行不再复述
          hit ? `命中，取用组 ${state.setIndex} 路 ${state.wayUsed}`
            : `缺失，装入组 ${state.setIndex} 路 ${state.wayUsed}`
        }</b></div>
        {/*  key={state.i}：每走一步整条流水重挂一次，缺失时的"飞行块"动画就会重播
             （React 复用同一个 DOM 元素时 keyframe 只播一次；换 key 强制重挂才每步重播）。
             `moving` 只在缺失时挂 —— 命中不搬块，自然不该有飞行动画。 */}
        <div className={`cflow ${hit ? '' : 'moving'}`} key={state.i}>
          <div className={`cbox src ${hit ? 'ghost' : ''}`}>
            <span className="l">{hit ? '主存（本步不访问）' : '主存块'}</span>
            <span className="v">tag {state.tag}</span>
          </div>
          <div className="carw"><i>→</i>{hit ? '无需调入' : `调入 ${blockSize}B`}</div>
          <div className={`cbox dst ${hit ? 'ok' : 'on'}`}>
            <span className="l">组 {state.setIndex} · 路 {state.wayUsed}</span>
            <span className="v">tag {state.tag}</span>
          </div>
          {state.evictedTag !== null && <>
            <div className="carw evarw"><i>→</i>{policy} 淘汰</div>
            <div className="cbox gone">
              <span className="l">被挤掉</span>
              <span className="v"><s>tag {state.evictedTag}</s></span>
            </div>
          </>}
        </div>
      </section>
        </section>
      </div>
    </div>
  )
}

/**
 * 一段位域。
 *
 * ## 值为什么在盒子外面
 *
 * 概念图上这一处的做法是：**盒子里只放"这一段是什么"**（名字 / 位串 / 位宽），
 * 算出来的值挂在盒子下面，靠一条同色虚线引下去。
 * 这不是排版偏好 —— 盒内是**地址被切成的那几位**（客观的），
 * 盒外是**由这几位算出来的数**（结论）。两者放进同一个方框，
 * 读者会以为 `TAG 4` 里的 4 也是地址里印着的东西。
 *
 * ## 定义为什么改成悬停
 *
 * 「判断该路装的是否为目标块」这一句原来常驻在盒子里，占两到三行 ——
 * 三段加起来九行，比位串本身还高。定义没有删：讲解卡的两张基础卡
 * 完整讲了内存块/组/路与 tag/index/offset，这里挂 `data-tip` 是就近的一句提醒。
 */
function Seg({ cls, k, bits, v, ask, why, calc, innerRef, truncated }: {
  cls: string; k: string; bits: string[]; v: string
  /** 第一段：**这一段干什么**（认块 / 定组 / 定字节） */
  ask: string
  /** 第二段：**多少位**，以及这个位宽是怎么算出来的 —— 位宽是算出来的，不是背的 */
  why: string
  /** 第三段：**这一步**这个值怎么来的，除法写法（考场上手算用的那一版） */
  calc: string
  innerRef?: React.Ref<HTMLDivElement>; truncated?: boolean
}) {
  return (
    <div className={`seg ${cls}`} ref={innerRef}>
      {/*  盒内三行 = 名字 / 位串 / **位宽**，跟概念图一致。
           位宽推导（`8 组 ⇒ 3 位`）跟定义一起并进悬停：它回答的是"为什么是这么多位"，
           是**追问**，不是这一格必须常驻的信息。屏幕上留下的是那个数本身。 */}
      {/*  空行 = 分段（见 rich.tsx）—— 三件事各占一段，不是串成一句 */}
      <div className="segbox" data-tip={`${ask}\n\n${why}\n\n**这一步**　${calc}`}>
        <div className="segk">{k}</div>
        <div className="bl">
          {truncated && <b className="ell">…</b>}
          {bits.map((b, i) => <b key={i}>{b}</b>)}
        </div>
        <div className="segwhy">{bits.length} 位</div>
      </div>
      {/*  引线：颜色跟着这一段走 —— 三条线三个颜色，眼睛不用数第几个盒子 */}
      <i className="seglead" aria-hidden />
      <div className="cap"><span className="k">{k}</span><span className="eq">=</span><span className="v">{v}</span></div>
    </div>
  )
}

// ═══ 视图二：命中率随相联度扫描（parameter 轴）══════════
function Sweep({ doc }: { doc: SimDocument }) {
  const points = useMemo(() => {
    const ways = [1, 2, 4, 8].filter(w => {
      const sets = (doc.params.cacheSizeBytes as number) / (doc.params.blockSizeBytes as number) / w
      return Number.isInteger(sets) && sets >= 1 && (sets & (sets - 1)) === 0
    })
    const sweep = makeSweepKernel<CacheState>(cacheKernel, () => '')
    const sweepDoc: SimDocument = {
      kind: 'sweep:cache',
      params: { ...doc.params, sweepParam: 'associativity' },
      entities: doc.entities,
      streams: [...doc.streams, { name: 'sweepValues', values: ways }],
    }
    return run(sweep.compile(sweepDoc)).map(s => ({
      way: s.value as number,
      rate: s.final.hits / s.steps,
      hits: s.final.hits,
      steps: s.steps,
    }))
  }, [doc])

  const cur = doc.params.associativity as number
  const max = Math.max(0.0001, ...points.map(p => p.rate))

  return (
    <div className="card">
      <h3>命中率随相联度变化 <span className="hint">同一访问序列，只改相联度</span></h3>
      <div className="body">
        <div className="sweep">
          {points.map(p => (
            <div key={p.way} className={`bar ${p.way === cur ? 'cur' : ''}`}>
              <div className="v">{(p.rate * 100).toFixed(1)}%</div>
              <div className="track"><i style={{ height: `${(p.rate / max) * 100}%` }} /></div>
              <div className="x">{p.way} 路</div>
              <div className="n">{p.hits}/{p.steps}</div>
            </div>
          ))}
        </div>
        <p className="sweepnote">
          相联度提高只会减少<b>冲突缺失</b>，减不掉<b>强制缺失</b>（第一次访问必缺）——
          所以曲线单调不降，但会在某个点之后拉平。
        </p>
      </div>
    </div>
  )
}
