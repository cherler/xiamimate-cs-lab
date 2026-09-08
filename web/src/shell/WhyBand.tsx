/**
 * 「这一步为什么是这样」——舞台与轴之间那条带子。
 *
 * ## 为什么是一条带子，不是一张卡
 *
 * 这段文字讲的是**舞台上此刻正在发生的事**，每一句都在说"你该看哪一格"。
 * 放在右下角那张 380px 的浮层里，它离自己指的东西最远，而且装不下：
 * 四段一百多字要五行，浮层只有两行的位置。
 *
 * 贴着舞台放，宽度就有一整列（1440 屏上约 1300px），四段横着摊开各占一格，
 * 两行以内说完，多花的高度只有五十来像素 —— 而舞台的地是上一轮辛苦腾出来的，
 * 这笔账要算清楚才敢花。
 *
 * ## 四段为什么带段名
 *
 * 段名是**跨实验的骨架**：Cache 讲组号和 tag，磁盘讲磁头和方向，
 * 而"本步输入 / 判定规则 / 本步结果 / 对应画面"这四问是同一个。
 * 让骨架露在外面，用户翻到第三个实验时已经知道该往哪儿看。
 */
import type { WhyPart, } from '../guide.ts'
import type { Tone } from '../types.ts'
import { rich } from './rich.tsx'

export function WhyBand({ parts, tone, verdict }: {
  parts: WhyPart[]
  /** 这一步的判定（命中/缺失…）—— 带子末尾那枚记号 */
  tone?: Tone
  /** 结论那一句；不给就退回 tone 的两个字 */
  verdict?: string
}) {
  if (parts.length === 0) return null
  return (
    <section className="whyband" aria-label="这一步为什么是这样">
      {parts.map(p => (
        <div className="wseg" key={p.k}>
          <b className="wk">{p.k}</b>
          <p className="wv">{rich(p.v)}</p>
        </div>
      ))}
      {/*  ⊗ / ✓ 那个圈不是装饰：这是整条带子唯一"只靠颜色说话"的地方，
           只靠颜色说话的东西必须再给一个不依赖颜色的记号。 */}
      {/*  ⚠️ 类名**不能带 `wseg`**：冒烟第 16c 组按 `.wseg` 数「骨架有没有四段」，
           而这枚判定记号不是骨架的一段 —— 挂上 wseg 会被数成多出来的一段、
           而且它的正文不在 `.wv` 里，会被判成"某一段是空的"。 */}
      {tone && (
        <div className="wsegv">
          {/*  ⚠️ 占位格**不能叫 `wk`**：冒烟第 12 组按 `.wk` 的 top 数「几段各占一行」，
               多一个 wk 就多一行，当场判「3 段落在 4 行上」。名字换掉，样式照旧。 */}
          <b className="wkpad" aria-hidden />
          <p className={`wvd ${tone.key}`}>
            <i aria-hidden>{tone.key === 'good' ? '✓' : tone.key === 'bad' ? '✕' : '·'}</i>
            {verdict ?? tone.label}
          </p>
        </div>
      )}
    </section>
  )
}

/**
 * 同一段推演，**竖在右栏里**的样子 —— 用户给的概念图上那张
 * 「本步为什么这样做」：圆序号 ①②③ 一行一句，底下压一条结论横幅。
 *
 * ## 跟 `WhyBand` 是同一份数据，两种排法
 *
 * 不是复制一份文字，是同一个 `parts` 换个版式：横带子摊在舞台下面时四段并排，
 * 竖在 300px 的右栏里时只能一段一行。段名从「大写骨架」降成行内小标签 ——
 * 一行只有 26 个汉字的宽度，段名独占一行太贵。
 *
 * ## 结论横幅为什么只写两个字
 *
 * 概念图上那条红幅写的是「缺失 · 装入组 0」。后半句「装入组 0」正上方
 * 那一行（本步结果）刚说过，舞台上「本步结果」那条搬运图也画着 ——
 * 再抄一遍就是同一件事第五次出现。横幅留下的是它真正的活：
 * **一眼看到底这次成没成**，所以只有 tone 的那两个字，靠颜色和位置说话。
 */
export function WhyRail({ parts, tone, verdict }: {
  parts: WhyPart[]; tone?: Tone
  /** 结论横幅上那一句（"缺失 · 装入组 1 路 0"）；不给就退回 tone 的两个字 */
  verdict?: string
}) {
  if (parts.length === 0) return null
  return (
    <div className="card whyrail">
      <h3>本步为什么这样做</h3>
      {/*  ⚠️ 类名跟 `WhyBand` **共用一套**（wseg / wk / wv）。
           两种排法是同一份内容的两个视图，判据只该认内容不该认排法 ——
           各起一套类名的话，"四段齐不齐""正文有没有被裁掉"这些判据
           就得按组件各写一遍，而漏写的那一份没人发现。 */}
      <ol className="body">
        {parts.map((p, i) => (
          <li className="wseg" key={p.k}>
            <b className="wn">{i + 1}</b>
            <span className="wt"><b className="wk">{p.k}</b><span className="wv">{rich(p.v)}</span></span>
          </li>
        ))}
      </ol>
      {/*  ⊗ / ✓ 那个圈：概念图上横幅左边就有一个。
           它不是装饰 —— 横幅是这一屏唯一"只靠颜色说话"的地方，
           而只靠颜色说话的东西必须再给一个不依赖颜色的记号（色觉障碍读者看不出红绿）。 */}
      {tone && <div className={`wverdict ${tone.key}`}>
        <i aria-hidden>{tone.key === 'good' ? '✓' : tone.key === 'bad' ? '✕' : '·'}</i>
        {verdict ?? tone.label}
      </div>}
    </div>
  )
}
