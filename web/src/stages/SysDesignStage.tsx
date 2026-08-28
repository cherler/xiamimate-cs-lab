/** 舞台：系统设计 · 短链 —— 逐步搭起架构，每步一个设计决策 */
import type { SysDesignState } from '@engine/kernels/_sysdesign.ts'
import type { StageProps } from '../types.ts'

export function SysDesignStage({ state }: StageProps<SysDesignState>) {
  const { stage, focus, detail, metric, components, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>系统设计 · 短链 <span className="hint">需求→估算→核心→扩展→权衡</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{stage || '就绪'}</span><span className="scdl">设计阶段</span></div>
          <div className="scdk"><span className="scdn">{components.length}</span><span className="scdl">已定组件</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '13px' }}>{metric || '—'}</span><span className="scdl">关键数/结论</span></div>
        </div>

        {/* 累积的架构：组件流水线 */}
        <div className="sd-arch">
          <span className="cx-lbl">架构（一步步搭起来）</span>
          <div className="sd-comps">
            {components.length === 0 ? <span className="kv-empty">还没开始</span>
              : components.map((c, i) => (
                  <span key={c.id} className="sd-comp"><b>{c.label}</b><em>{c.role}</em></span>
                ))}
          </div>
        </div>

        {/* 本步决策 */}
        {!done && focus && (
          <div className="sd-decision">
            <div className="sd-focus">{focus}</div>
            <p className="sd-detail">{detail}</p>
          </div>
        )}

        {done
          ? <p className="scnote">一套短链系统搭好了。面试的加分项在<b>权衡</b>：短码用发号器+Base62（不用哈希怕碰撞、不用自增怕被爬）；跳转 301（永久、省服务器但没法统计）vs 302（可统计点击）；读靠缓存、量靠分片。这套<b>「需求→估算→核心→扩展→权衡」</b>的框架，换成设计秒杀/Feed/消息队列也照样用——这才是系统设计面试真正考的东西。</p>
          : <p className="scnote" style={{ opacity: .85 }}>系统设计不是背答案，是走一套框架：先澄清需求边界、再估算规模、再定核心组件、再想扩展、最后讲清权衡。每一步都要说"为什么这么选"。</p>}
      </div>
    </div>
  )
}
