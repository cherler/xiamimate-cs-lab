/** 舞台：软件库/框架介绍(库层) —— 参考页:四段编号 + 列表组织,不走"步",舞台内滚动 */
import type { LibraryState } from '@engine/kernels/library.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

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
          <div className="lib-cap"><span className="lib-capno">①</span>特点介绍</div>
          <p className="lib-what">{rich(whatIs)}</p>
          <ol className="lib-feat-grid">
            {features.map((f, k) => (
              <li key={k} className="lib-feat">
                <span className="lib-fk">{k + 1}</span>
                <div className="lib-ftxt"><span className="lib-ft">{f.t}</span><span className="lib-fd">{rich(f.d)}</span></div>
              </li>
            ))}
          </ol>
        </section>

        {/* ② 优缺点 */}
        <section className="lib-sec">
          <div className="lib-cap"><span className="lib-capno">②</span>优缺点</div>
          <div className="lib-pc">
            <div className="lib-pros">
              <div className="lib-pchead lib-good">强在哪 ✅</div>
              <ul className="lib-list">{pros.map((x, k) => <li key={k}>{rich(x)}</li>)}</ul>
            </div>
            <div className="lib-cons">
              <div className="lib-pchead lib-bad">坑在哪 / 别用 ⚠️</div>
              <ul className="lib-list">{cons.map((x, k) => <li key={k}>{rich(x)}</li>)}</ul>
            </div>
          </div>
        </section>

        {/* ③ 内容覆盖 —— 反向连回理论实验(可点跳转) */}
        <section className="lib-sec">
          <div className="lib-cap"><span className="lib-capno">③</span>内容覆盖 <span className="lib-capn">{covCount} 个理论实验</span></div>
          <p className="lib-covnote">它内部用到的算法,正是实验室里焊死过的理论——<b>库是"用法"、实验是"原理"</b>。点链接跳回对应实验,先把原理弄懂:</p>
          <ol className="lib-covlist">
            {coverage.map((c, k) => (
              <li key={k} className="lib-cov">
                <div className="lib-covmod">{c.mod}<span className="lib-covd">{rich(c.d)}</span></div>
                <div className="lib-covlinks">
                  {c.links.map((l, j) => (
                    <button key={j} type="button" className="lib-link" onClick={() => onNavExp?.(l.exp)}
                      title={`跳到实验：${l.label}`}>↩ {l.label}</button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ④ 落地项目 */}
        <section className="lib-sec">
          <div className="lib-cap"><span className="lib-capno">④</span>落地项目</div>
          <ul className="lib-proj-grid">{projects.map((x, k) => <li key={k} className="lib-proj">{rich(x)}</li>)}</ul>
          <p className="lib-see">相关：{seeAlso}。</p>
        </section>

        <p className="lib-foot"><b>「库层」读法</b>：理论实验教"原理为什么对"、库教"工程上怎么拼起来用";两层对着看,既懂机制又会用工具。</p>
      </div>
    </div>
  )
}
