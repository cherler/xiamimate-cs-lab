/**
 * 引导式实验笔记 —— 盖在中列上的一屏，把**这一步**明确组织成
 * 「输入 → 规则 → 结果」三段。
 *
 * ## 它替掉了什么
 *
 * 替掉的是原来的「实验单」（为什么在乎 / 先猜一下 / 动手 / 结论）。
 * 那一版的赌注在**动手之前**：先押一个答案，去试，回来揭晓。
 * 它治的是"不知道要做什么"。
 *
 * 而用户反复指的另一个病是**"字都认识，连起来不知道在说什么"** ——
 * 那不是动力问题，是**一轮推演读不下来**。所以这一屏不再问"你猜哪个"，
 * 改成把当前这一步摊开：这一步的输入是什么、按什么规则判、判出了什么。
 * 三段之间画箭头，因为它们是一条推理，不是三个并列的段落。
 *
 * 代价照实说：**工具感弱了**。它是引导，不是仪表台 ——
 * 所以它是一层可以关掉的覆盖，关掉之后底下的实验台一点没变。
 *
 * ## 数据从哪儿来
 *
 * 三段直接用 `GUIDES[exp].step()` 那一份 —— **跟右栏的推演卡是同一份数据**，
 * 不是另抄一遍。抄一遍的代价不是重复，是它们会各自漂移：
 * 同一步在两个地方说的话不一样，读者只会认为这个软件在乱讲。
 *
 * 「当前状态」那一块直接嵌**舞台本身**，而不是另画一套图。
 * 一来天然对 30 个实验都成立，二来读者从笔记切回实验台时看到的是同一张图。
 */
import type { ReactNode } from 'react'
import type { WhyPart } from '../guide.ts'
import type { Verdict } from '../brief.ts'
import type { Tone } from '../types.ts'
import { rich } from './rich.tsx'

/** 三段的短名 —— 骨架名太长，卡片标题只留一个字的差别 */
const SHORT: Record<string, string> = {
  本步输入: '输入', 判定规则: '规则', 本步结果: '结果', 对应画面: '画面',
}

export function GuidedNote({
  title, no, question, parts, plain, tone, verdict, tasks, index, total, where,
  onClose,
}: {
  title: string
  /** 目录里的序号（"01"）—— 笔记本上写的是"实验 01" */
  no: string
  question: string
  parts: WhyPart[]
  /**  第 0 步那一屏的大白话开场。给了就顶掉「本步推演」那三张卡 ——
       第 0 步还没有"本步"，而这里正是先把画面建起来的位置。 */
  plain?: { hook: string; body: string; what?: string; terms?: string; watch: string } | null
  tone: Tone | null
  /** 已经验证过的那句结论；null = 还没算出来 */
  verdict: Verdict | null
  /** 「实验操作」那一栏：这一屏值得动手试的几件事。
   *  `param` / `preset` 会以 data 属性挂出去 —— 冒烟拿它核对
   *  "这条动作点名的旋钮/预置，页面上真有"。写错一个字，这一条就是空指令。 */
  tasks: { act: string; watch: string; param?: string; preset?: string }[]
  index: number
  total: number
  /** 副标题那一行：这一步落在哪儿（"地址 0x210 · 2 路组相联 · 组 1"） */
  where: string
  stage: ReactNode
  chips: ReactNode
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}) {
  return (
    /*  第 0 步（有大白话时）把浮层撑到允许的最大高度。
        平时浮层的高度是被**右栏**「实验操作」撑出来的，左边那列读的内容只能自己滚 ——
        大白话 + 机制段加起来三四百字，一进来就被裁掉小半截，而滚动条不显眼，
        看着就像「解释只有这么点」。撑满之后常见屏幕上一次读得完。 */
    <section className={`gnote${plain ? ' gnote-read' : ''}`} aria-label="引导式实验笔记">
      <header className="gnbar">
        <span className="gnexp">实验 <b>{no}</b> / {title}</span>
        <span className="gnstep">
          第 <b>{index + 1}</b> / {total} 步
          {/*  一排小横杠：走到第几步一眼就数得出来。
               它跟下面那排格子说的是同一件事，但这里只要"进度"这一个维度 */}
          <i className="gndots" aria-hidden>
            {Array.from({ length: total }, (_, i) =>
              <b key={i} className={i <= index ? 'on' : ''} />)}
          </i>
        </span>
        <button className="gnx" onClick={onClose}>关闭导览 ✕</button>
      </header>

      <div className="gnbody">
        <div className="gnmain">
          {/*  大标题问的是**这一步**，不是这一屏。
               「这一步为什么是缺失」比「同一串地址怎么摆」近得多 ——
               读者此刻正卡在这一步上，题目要提到他鼻子底下。 */}
          <h2 className="gnq">{plain ? plain.hook : tone ? `这一步，为什么是「${tone.label}」？` : question}</h2>
          <p className="gnwhere">{where}　·　{question}</p>

          {/*  三段之间的箭头挂在**后一段**前面：段数可增可减，箭头数自动对 */}
          {plain ? (
            /*  第 0 步：先用人话把画面建起来。
                不套 `.gnflow` 那三张编号卡 —— 那是「本步输入→规则→结果」的骨架，
                而这里没有"本步"，硬塞进去会让人以为已经走过一步了。 */
            <div className="gnplain">
              <p className="gnpb">{rich(plain.body)}</p>
              {/*  百科段接在大白话后面 —— 打完比方才轮到「这件事本身是怎么回事」。
                   用户原话：「第 0 步的实验解释，说的内容是不是有点太少了」
                   「是指这件事（实验）的百科内容」。 */}
              {plain.what && (
                <p className="gnph"><b className="gnphk">这一屏讲的是什么</b>{rich(plain.what)}</p>
              )}
              {plain.terms && (
                <p className="gnph"><b className="gnphk">你会看到的这些名词</b>{rich(plain.terms)}</p>
              )}
              <p className="gnpw"><b>这一屏盯着看什么</b>　{rich(plain.watch)}</p>
            </div>
          ) : (
          <ol className="gnflow">
            {parts.map((p, i) => (
              <li className="gncard" key={p.k}>
                <div className="gnhead"><b className="gnn">{i + 1}</b>{SHORT[p.k] ?? p.k}</div>
                <div className="gnv">{rich(p.v)}</div>
              </li>
            ))}
          </ol>
          )}

          {tone && (
            <div className={`gnverdict ${tone.key}`}>
              <i aria-hidden>{tone.key === 'good' ? '✓' : tone.key === 'bad' ? '✕' : '·'}</i>
              {parts.length > 0 ? tone.label : ''}
            </div>
          )}

          {/*  舞台/步进器不再嵌在笔记里 —— 笔记现在与实验台**共存**(在它上方),
              真正的舞台、走带、实验记录都在下面同屏可见,不用关掉笔记才看得到。 */}

          {/*  「本次发现」只在**真的算得出来**的时候才写。
               算不出来时留一句空话（"多试几组看看"）比留空更糟：
               它会让人以为这一屏本来就没有结论。 */}
          {verdict && (
            <div className="gnfind">
              <i className="gnfindi" aria-hidden>▤</i>
              <b>本次发现</b>
              <span className="gnsay">{rich(verdict.say)}</span>
            </div>
          )}
        </div>

        <aside className="gnside">
          <div className="gnsub">实验操作</div>
          <ol className="gnacts">
            {tasks.map((t, i) => (
              <li key={i} data-param={t.param} data-preset={t.preset}>
                <b>{i + 1}</b><span><em>{t.act}</em>{t.watch}</span>
              </li>
            ))}
          </ol>
          <p className="gnhint">关掉导览就回到实验台 —— 底下那台仪器一直在跑，导览只是盖着。</p>
        </aside>
      </div>
    </section>
  )
}
