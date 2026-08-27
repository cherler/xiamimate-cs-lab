/**
 * `**…**` 加粗 —— 全仓库唯一一份实现。
 *
 * 这个约定被四层文本共用：实验单的四段、导览卡正文、悬停提示、以及"试一试"的动作与看点。
 * 之前 `Brief.tsx` 和 `Tip.tsx` 各抄了一份，而 `GuideOverlay` 的卡片正文压根没走 ——
 * 于是同一句话写在讲解卡里星号会原样印出来，写在实验单里就是粗体。
 *
 * **不走 innerHTML**：这些字将来会有一部分来自 AI 起草，即使经过人工审校，
 * 也不该有一条能把标签插进 DOM 的路。
 */
export function rich(s: string) {
  /*  空行 = 分段。实验单 ① 现在是三小段（三段定义），挤成一坨就白写了。
      只认 `\n\n`，单个换行仍当空格 —— 源码里为了排版折的行不该变成段。 */
  const paras = s.split(/\n{2,}/)
  const one = (t: string, key: number) =>
    t.split('**').map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))
      .map((el, i) => <span key={`${key}-${i}`}>{el}</span>)
  if (paras.length === 1) return one(paras[0]!, 0)
  return paras.map((t, i) => <span className="para" key={i}>{one(t, i)}</span>)
}
