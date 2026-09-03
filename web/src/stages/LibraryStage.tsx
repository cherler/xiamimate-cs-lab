/** 舞台：软件库/框架介绍(库层) —— 参考页:四段一屏铺开(特点/优缺点/覆盖·可点回实验/落地),不走"步" */
import type { LibraryState } from '@engine/kernels/library.ts'
import type { StageProps } from '../types.ts'

export function LibraryStage({ state, onNavExp }: StageProps<LibraryState>) {
  const s = state
  const { name, tagline, license, lang, maintainer, latest, seeAlso, whatIs, features, pros, cons, coverage, projects } = s
  const covCount = coverage.reduce((a, c) => a + c.links.length, 0)

  return (
    <div className="card">
      <h3>软件库 · {name} <span className="hint">{tagline}</span></h3>
      <div className="body lib-page">
        <div className="lib-head">
          <span className="lib-name">{name}</span>
          <span className="lib-meta">许可 <b>{license}</b></span>
          <span className="lib-meta">语言 {lang}</span>
          <span className="lib-meta">{maintainer}</span>
          {latest && <span className="lib-meta">{latest}</span>}
        </div>

        {/* ① 特点介绍 */}
        <section className="lib-sec">
          <div className="lib-cap">特点介绍</div>
          <p className="lib-what">{whatIs}</p>
          <div className="lib-feat-grid">
            {features.map((f, k) => <div key={k} className="lib-feat"><span className="lib-ft">{f.t}</span><span className="lib-fd">{f.d}</span></div>)}
          </div>
        </section>

        {/* ② 优缺点 */}
        <section className="lib-sec">
          <div className="lib-cap">优缺点</div>
          <div className="lib-pc">
            <div className="lib-pros"><div className="lib-pchead lib-good">强在哪 ✅</div>{pros.map((x, k) => <div key={k} className="lib-pcitem">· {x}</div>)}</div>
            <div className="lib-cons"><div className="lib-pchead lib-bad">坑在哪 / 别用 ⚠️</div>{cons.map((x, k) => <div key={k} className="lib-pcitem">· {x}</div>)}</div>
          </div>
        </section>

        {/* ③ 内容覆盖 —— 反向连回理论实验(可点跳转,这层的价值所在) */}
        <section className="lib-sec">
          <div className="lib-cap">内容覆盖 <span className="lib-capn">{covCount} 个理论实验</span></div>
          <p className="lib-covnote">它内部用到的算法,正是实验室里焊死过的理论——<b>库是"用法"、实验是"原理"</b>。点链接跳回对应实验,先把原理弄懂:</p>
          {coverage.map((c, k) => (
            <div key={k} className="lib-cov">
              <div className="lib-covmod">{c.mod}<span className="lib-covd">{c.d}</span></div>
              <div className="lib-covlinks">
                {c.links.map((l, j) => (
                  <button key={j} type="button" className="lib-link" onClick={() => onNavExp?.(l.exp)}
                    title={`跳到实验：${l.label}`}>↩ {l.label}</button>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* ④ 落地项目 */}
        <section className="lib-sec">
          <div className="lib-cap">落地项目</div>
          <div className="lib-proj-grid">{projects.map((x, k) => <div key={k} className="lib-proj">{x}</div>)}</div>
          <p className="lib-see">相关：{seeAlso}。</p>
        </section>

        <p className="lib-foot"><b>「库层」读法</b>：理论实验教"原理为什么对"、库教"工程上怎么拼起来用";两层对着看,既懂机制又会用工具。</p>
      </div>
    </div>
  )
}
