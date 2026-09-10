/**
 * 嵌进 lab 的 guide 页：每个**学科**一条「从地基 → 某职业/造物」的路。
 * 学科是骨架、guide 页是那件职业/造物（CS 就是 408→大模型推理引擎）。
 * 节点可点，直接跳进对应实验；未开放的学科先亮出它们的 guide 主题占位。
 */
import { VISIBLE_DISCIPLINES, anchorOfExp, type Discipline } from '../registry.ts'
import type { AnyExperiment } from '../types.ts'

type Props = {
  discKey: string
  experiments: AnyExperiment[]
  onPick: (id: string) => void
  onSwitch: (key: string) => void
  onClose: () => void
}

export function LabGuide({ discKey, experiments, onPick, onSwitch, onClose }: Props) {
  const disc = VISIBLE_DISCIPLINES.find(d => d.key === discKey) ?? VISIBLE_DISCIPLINES[0]
  const others = VISIBLE_DISCIPLINES.filter(d => d.key !== disc.key)

  // 该学科的子模块 → 实验
  const groups = disc.groups.map(g => ({
    name: g,
    items: experiments.filter(e => e.group === g),
  })).filter(g => g.items.length > 0)

  return (
    <div className="lgover" role="dialog" aria-modal="true" aria-label={`${disc.title} 学科地图`}>
      <div className="lgsheet">
        <button className="lgclose" onClick={onClose} aria-label="关闭地图">✕</button>

        <header className="lghead">
          <div className="lgkicker">{disc.icon} {disc.title} · 学科地图</div>
          <h2 className="lgtitle">
            从 <span className="lgfrom">{disc.guide.from}</span>
            <span className="lgarrow">→</span>
            <span className="lgto">{disc.guide.toIcon} {disc.guide.to}</span>
          </h2>
          <p className="lglede">{disc.sub}。每一层都坐在下一层的地基上——不停留在"是什么"，尽量讲清"为什么"。{disc.guide.url && <a className="lgfull" href={disc.guide.url} target="_blank" rel="noreferrer">看完整原理全景 ↗</a>}</p>
        </header>

        {groups.length > 0 ? (
          //  一条线穿起来：地基 → 各子模块(逐层) → 职业目标。学的路径是一条流程，不是并列的清单。
          <div className="lgbody lgflow">
            <div className="lgnode lgstart">
              <span className="lgdot" aria-hidden />
              <div className="lgnodec"><span className="lgcap">起点 · 地基</span><b className="lgcapv">{disc.guide.from}</b></div>
            </div>
            {groups.map((g, gi) => {
              const anchor = anchorOfExp(g.items[0])
              return (
                <div className="lgnode" key={g.name}>
                  <span className="lgdot" aria-hidden />
                  <section className="lgnodec lggrp">
                    <div className="lggrph">
                      <span className="lggrpn">{String(gi + 1).padStart(2, '0')}</span>
                      <span className="lggrpt">{g.name}</span>
                      {anchor && <span className="lganchor" title={`关联${anchor.kind}`}>{anchor.icon} {anchor.label}</span>}
                      <span className="lggrpc">{g.items.length}</span>
                    </div>
                    <div className="lgchips">
                      {g.items.map(e => (
                        <button className="lgchip" key={e.id} onClick={() => { onPick(e.id); onClose() }}
                          title={e.subtitle}>
                          {e.title}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )
            })}
            <div className="lgnode lgend">
              <span className="lgdot" aria-hidden />
              <div className="lgnodec"><span className="lgcap">终点 · 职业目标</span><b className="lgcapv">{disc.guide.toIcon} {disc.guide.to}</b></div>
            </div>
          </div>
        ) : (
          <div className="lgempty">
            <p>「{disc.title}」学科即将开放。</p>
            <p className="lgemptysub">它的 guide 会是一条「从 <b>{disc.guide.from}</b> 到 <b>{disc.guide.toIcon} {disc.guide.to}</b>」的路。</p>
          </div>
        )}

        {/* 其他学科：各自的 guide 主题（职业/造物）占位 */}
        <footer className="lgothers">
          <div className="lgotherh">其他学科 · 各有一条「地基 → 职业/造物」的路</div>
          <div className="lgotherrow">
            {others.map(d => (
              <button key={d.key} className={`lgothercard ${d.status === 'planned' ? 'soon' : ''}`}
                onClick={() => onSwitch(d.key)} title={d.status === 'planned' ? '即将开放' : `切到 ${d.title}`}>
                <span className="lgotherico">{d.icon}</span>
                <span className="lgothername">{d.title}{d.status === 'planned' && <i>即将</i>}</span>
                <span className="lgotherto">→ {d.guide.toIcon} {d.guide.to}</span>
              </button>
            ))}
          </div>
        </footer>
      </div>
    </div>
  )
}

// 供 App 判断当前学科（默认 cs）
export function defaultDisc(): Discipline { return VISIBLE_DISCIPLINES[0] }
