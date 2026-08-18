/**
 * 实验单：盖在中列上的四段（为什么在乎 / 先猜一下 / 动手 / 结论）。
 *
 * ## 为什么盖住整个中列
 *
 * 因为**还没动手之前，那一列本来就没意义** —— 一屏花花绿绿的格子、
 * 一排看不懂的页签，不知道在看什么。等押完注、知道要试什么了，再把它让出来。
 *
 * 一开始只盖舞台那一块，实测 276px 的框装 570px 的内容，藏掉一半还多 ——
 * 而"看不见后面还有什么"正是这一层要治的病。盖整列之后 1440×900 上零滚动。
 *
 * ## ④ 为什么要锁
 *
 * 不锁的话，押完注下一秒就看见答案，那就没有"动手"这一段了 ——
 * 而这一层要治的恰恰是"不知道要做什么"。所以先收起来，
 * 用户去试过（关掉实验单、动过东西）再回来，才揭晓。
 */
import type { Brief, Verdict } from '../brief.ts'

type Props = {
  brief: Brief
  /** ② 押的哪个，null = 还没押 */
  guess: number | null
  onGuess: (n: number) => void
  /** ④ 现算的结论；null = 现在算不出来（配置不合法、轨迹为空） */
  verdict: Verdict | null
  /** ④ 解锁了没有 —— 押过注 + 出去动过手 */
  unlocked: boolean
  onStart: () => void
  onClose: () => void
}

export function Brief({ brief, guess, onGuess, verdict, unlocked, onStart, onClose }: Props) {
  const right = verdict && verdict.pick >= 0 && guess !== null && guess === verdict.pick

  return (
    <section className="brief" aria-label="实验单">
      <header className="bfhead">
        <h3>实验单</h3>
        <span className="bfsub">这个实验是什么 · 要做什么 · 为什么做</span>
        <button className="bfx" onClick={onClose} aria-label="收起实验单">✕</button>
      </header>

      <div className="bfbody">
        <section className="bfstep">
          <b className="bfn">① 为什么在乎</b>
          <p>{bold(brief.care)}</p>
        </section>

        <section className="bfstep">
          <b className="bfn">② 先猜一下</b>
          <p className="bfq">{brief.guess.q}</p>
          <div className="bfopts">
            {brief.guess.opts.map((o, i) => (
              <button key={o} className={`bfopt${guess === i ? ' on' : ''}`}
                      aria-pressed={guess === i}
                      onClick={() => onGuess(i)}>{o}</button>
            ))}
          </div>
          {/* 押注本身要给个交代：不押就不往下走，押了也不马上揭晓 */}
          <p className="bfnote">
            {guess === null
              ? '先押一个再往下 —— 押过的人才会在意结果。押错不扣分，这里不计进度。'
              : '押好了。下面三件事做完，回来看结论。'}
          </p>
        </section>

        <section className={`bfstep${guess === null ? ' off' : ''}`}>
          <b className="bfn">③ 动手</b>
          <ol className="bftasks">
            {brief.tasks.map(t => (
              <li key={t.act}>
                <b>{t.act}</b>
                <span>{t.watch}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={`bfstep${unlocked && verdict ? '' : ' off'}`}>
          <b className="bfn">④ 结论</b>
          {unlocked && verdict
            ? (
              <div className="bfverdict">
                {verdict.pick >= 0 && guess !== null && (
                  <p className={`bfjudge ${right ? 'good' : 'bad'}`}>
                    {right ? '你猜对了' : `你猜的是「${brief.guess.opts[guess]}」`}
                  </p>
                )}
                <p>{bold(verdict.say)}</p>
                <p className="bfwhy">{bold(verdict.why)}</p>
                {/*  ⚠️ 走 bold()，别直接写字符串 —— 星号会原样印在屏幕上 */}
                <p className="bfnote">{bold(
                  '这两行里的每个数都是**拿你此刻的配置重跑一遍算出来的** —— 换一串地址再回来，结论会跟着变。',
                )}</p>
              </div>
            )
            : <p className="bfnote">{guess === null ? '先押注。' : '去动手，回来揭晓 —— 结论按你那时候的配置现算。'}</p>}
        </section>
      </div>

      <footer className="bffoot">
        <button className="bfgo" onClick={onStart} disabled={guess === null}>
          {guess === null ? '先押一个' : unlocked ? '回到实验' : '开始动手'}
        </button>
      </footer>
    </section>
  )
}

/** 正文里用 `**…**` 标重点，和讲解卡、悬停提示同一套写法（同样不走 innerHTML） */
function bold(s: string) {
  return s.split('**').map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))
}
