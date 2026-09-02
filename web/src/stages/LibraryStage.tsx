/** 舞台：软件库/框架介绍(新内容类型) —— 头部基本信息 + 分段(特点/优缺点/覆盖·反向连回实验/落地) */
import type { LibraryState } from '@engine/kernels/library.ts'
import type { StageProps } from '../types.ts'

const SECTIONS: { key: LibraryState['section']; label: string }[] = [
  { key: 'intro', label: '特点介绍' },
  { key: 'proscons', label: '优缺点' },
  { key: 'coverage', label: '内容覆盖' },
  { key: 'projects', label: '落地项目' },
]

export function LibraryStage({ state }: StageProps<LibraryState>) {
  const s = state
  const { section, name, tagline, license, lang, maintainer, latest, seeAlso, whatIs, features, pros, cons, coverage, projects } = s
  const activeIdx = SECTIONS.findIndex(x => x.key === section)

  return (
    <div className="card">
      <h3>软件库 · {name} <span className="hint">{tagline}</span></h3>
      <div className="body">
        <div className="lib-head">
          <span className="lib-name">{name}</span>
          <span className="lib-meta">许可 <b>{license}</b></span>
          <span className="lib-meta">语言 {lang}</span>
          <span className="lib-meta">{maintainer}</span>
        </div>
        <div className="lib-tabs">
          {SECTIONS.map((t, k) => <span key={t.key} className={`lib-tab${t.key === section ? ' on' : ''}${section === 'done' && k <= 3 ? ' done' : k < activeIdx ? ' done' : ''}`}>{t.label}</span>)}
          <span className={`lib-tab${section === 'done' ? ' on' : ''}`}>小结</span>
        </div>

        {section === 'intro' && (
          <div className="lib-sec">
            <p className="lib-what">{whatIs}</p>
            <div className="lib-feat-grid">
              {features.map((f, k) => <div key={k} className="lib-feat"><span className="lib-ft">{f.t}</span><span className="lib-fd">{f.d}</span></div>)}
            </div>
          </div>
        )}

        {section === 'proscons' && (
          <div className="lib-sec lib-pc">
            <div className="lib-pros"><div className="lib-pchead lib-good">强在哪 ✅</div>{pros.map((x, k) => <div key={k} className="lib-pcitem">· {x}</div>)}</div>
            <div className="lib-cons"><div className="lib-pchead lib-bad">坑在哪 / 别用 ⚠️</div>{cons.map((x, k) => <div key={k} className="lib-pcitem">· {x}</div>)}</div>
          </div>
        )}

        {section === 'coverage' && (
          <div className="lib-sec">
            <p className="lib-covnote">它内部用到的算法,正是实验室里焊死过的理论——<b>库是"用法"、实验是"原理"</b>。点回这些实验先把原理弄懂:</p>
            {coverage.map((c, k) => (
              <div key={k} className="lib-cov">
                <div className="lib-covmod">{c.mod}<span className="lib-covd">{c.d}</span></div>
                <div className="lib-covlinks">{c.links.map((l, j) => <span key={j} className="lib-link">↩ {l.label}</span>)}</div>
              </div>
            ))}
          </div>
        )}

        {section === 'projects' && (
          <div className="lib-sec">
            <div className="lib-proj-grid">{projects.map((x, k) => <div key={k} className="lib-proj">{x}</div>)}</div>
            <p className="lib-see">相关：{seeAlso}。</p>
          </div>
        )}

        {section === 'done' && (
          <div className="lib-sec">
            <p className="lib-what"><b>「库层」读法</b>：理论实验教"原理为什么对"、库教"工程上怎么拼起来用";两层对着看,既懂机制又会用工具。</p>
            <div className="lib-covlinks" style={{ marginTop: 8 }}>{coverage.flatMap(c => c.links).map((l, j) => <span key={j} className="lib-link">↩ {l.label}</span>)}</div>
            <p className="lib-see" style={{ marginTop: 10 }}>{seeAlso}。</p>
          </div>
        )}

        <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>
      </div>
    </div>
  )
}
