/** 舞台：MemGPT 虚拟内存/分页 —— 左 RAM(水位+槽)、右 磁盘(recall+archival)，换页操作可视 */
import type { MemPState, Slot } from '@engine/kernels/mempaging.ts'
import type { StageProps } from '../types.ts'

const KIND_CN: Record<string, string> = { system: '系统', core: '工作记忆', summary: '递归摘要', msg: '消息' }

function SlotRow({ s }: { s: Slot }) {
  return (
    <div className={`mp-slot ${s.kind} ${s.pagedIn ? 'pagedin' : ''}`}>
      <span className="mp-sk">{KIND_CN[s.kind]}</span>
      <span className="mp-st">{s.text}</span>
      <span className="mp-stok">{s.tok}t{s.pagedIn ? ' ←调回' : ''}</span>
    </div>
  )
}

export function MemPagingStage({ state }: StageProps<MemPState>) {
  const { stage, N, warnAt, ram, ramUsed, recall, archival, op, pressure } = state
  const pct = Math.min(100, (ramUsed / N) * 100)

  return (
    <div className="card">
      <h3>MemGPT 虚拟内存 / 分页 <span className="hint">上下文=RAM、外部=磁盘，函数调用换页（≈给 LLM 做虚拟内存）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className={`scdn ${pressure ? 'hot' : ''}`}>{ramUsed}<em className="cc-u">/{N}</em></span><span className="scdl">RAM 水位</span></div>
          <div className="scdk"><span className={`scdn ${pressure ? 'hot' : ''}`}>{pressure ? '⚠ 压力' : '正常'}</span><span className="scdl">内存状态</span></div>
          <div className="scdk"><span className="scdn">{recall.length}</span><span className="scdl">recall(磁盘)</span></div>
        </div>

        {op && <div className={`mp-op ${stage === 'evict' ? 'out' : stage === 'pagein' ? 'in' : ''}`}>{stage === 'evict' ? '⬇ 换出：' : stage === 'pagein' ? '⬆ 换入：' : '▸ '}{op}</div>}

        <div className="mp-cols">
          {/* RAM */}
          <div className="mp-side">
            <div className="mp-h">主上下文 · RAM（进 prompt）</div>
            <div className="mp-bar">
              <div className={`mp-fill ${pressure ? 'over' : ''}`} style={{ width: `${pct}%` }} />
              <div className="mp-warn" style={{ left: `${(warnAt / N) * 100}%` }} title={`70% 警告线 ${warnAt}`} />
            </div>
            <div className="mp-scale"><span>0</span><span className="mp-warnl" style={{ left: `${(warnAt / N) * 100}%` }}>70% 压力线</span><span>{N}</span></div>
            <div className="mp-slots">{ram.map(s => <SlotRow key={s.id} s={s} />)}</div>
          </div>
          {/* DISK */}
          <div className="mp-side disk">
            <div className="mp-h">外部存储 · 磁盘（不进 prompt）</div>
            <div className="mp-disk-grp">
              <div className="mp-grp-l">recall（被驱逐的消息）</div>
              {recall.length ? recall.map(s => <SlotRow key={s.id} s={s} />) : <div className="mp-empty">空</div>}
            </div>
            <div className="mp-disk-grp">
              <div className="mp-grp-l">archival（可检索文本）</div>
              {archival.map(s => <SlotRow key={s.id} s={s} />)}
            </div>
          </div>
        </div>

        {stage === 'done'
          ? <p className="scnote"><b>agent 记忆 = 给 LLM 做虚拟内存</b>：上下文(RAM，快·贵·小) ↔ 外部存储(磁盘，慢·便宜·大)，函数调用自己换页(core_memory_append/replace 改 RAM、archival_memory_search 读磁盘、conversation_search 搜旧消息)。<b>OS 对照</b>：主上下文=物理内存、70% 警告=内存压力中断、驱逐+递归摘要=页面置换(换出)、检索调回=缺页调入(换入)。和 408 <b>页面置换/缺页</b>是同一算法——只是"页"换成对话消息、置换多了层有损摘要。延伸：摘要有损靠 archival 精确调回、换页太频=抖动(thrashing)。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。</p>}
      </div>
    </div>
  )
}
