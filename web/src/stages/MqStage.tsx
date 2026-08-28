/** 舞台：消息队列 —— append-only 分区日志(带 offset)，消费组各自的 offset 游标前进；读不删除→多组独立消费/重放 */
import type { MqState } from '@engine/kernels/mqdesign.ts'
import type { StageProps } from '../types.ts'

const GCOL = ['g1', 'g2']

export function MqStage({ state }: StageProps<MqState>) {
  const { phase, parts, produce, groups, active, poll, focus } = state
  const done = phase === 'done'

  return (
    <div className="card">
      <h3>消息队列 · 分区日志 + offset <span className="hint">追加得 offset，消费者靠自己的 offset 读，读不删除</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? '日志+offset' : phase === 'produce' ? '生产追加' : phase === 'intro' ? '就绪' : `消费组 ${active}`}</span><span className="scdl">当前动作</span></div>
          <div className="scdk"><span className="scdn">{parts.reduce((a, p) => a + p.log.length, 0)}</span><span className="scdl">日志消息数</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '12px' }}>{groups.map(g => `${g.name}:${g.offsets.join('/')}`).join(' ')}</span><span className="scdl">各组 offset(p0/p1)</span></div>
        </div>

        {/* 分区日志 */}
        <div className="mq-parts">
          {parts.map(p => (
            <div key={p.id} className="mq-part">
              <div className="mq-phead">分区 {p.id} <em>append-only</em>
                <span className="mq-poff">
                  {groups.map((g, gi) => <span key={g.name} className={`mq-ptag ${GCOL[gi]}`}>{g.name}▸offset {g.offsets[p.id]}</span>)}
                </span>
              </div>
              <div className="mq-log">
                {p.log.length === 0 ? <span className="kv-empty">空</span>
                  : p.log.map(m => {
                    const isProd = produce?.part === p.id && produce?.offset === m.offset
                    const isPoll = poll?.part === p.id && poll?.offset === m.offset
                    const readByG1 = groups[0]!.offsets[p.id] > m.offset
                    return (
                      <span key={m.offset} className={`mq-cell ${isProd ? 'append' : ''} ${isPoll ? 'poll ' + (active === 'G2' ? 'g2' : 'g1') : ''} ${readByG1 && !isPoll ? 'read' : ''}`}>
                        <i className="mq-off">off {m.offset}</i>
                        <b>{m.val}</b>
                        <em className="mq-key">key {m.key}</em>
                      </span>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* 本步说明 */}
        {produce && (
          <div className="mq-note prod">生产：「{produce.val}」key={produce.key} <code>hash%{state.P}={produce.part}</code> → 分区 {produce.part}、offset {produce.offset}</div>
        )}
        {poll && (
          <div className={`mq-note poll ${active === 'G2' ? 'g2' : 'g1'}`}>{poll.group} 读 分区{poll.part}@offset {poll.offset} →「{poll.val}」，offset 前进到 {poll.offset + 1}（消息不删）</div>
        )}

        {done
          ? <p className="scnote"><b>append-only 分区日志</b>顺序写盘→高吞吐、每条带单调 offset；<b>offset 归消费者</b>（读不删除）→ 不同组独立消费(发布订阅)、offset 回拨即<b>重放</b>；<b>分区</b>按 key 哈希路由→同 key 同分区、<b>分区内有序</b>（全局有序做不到）。不丢靠生产 acks+多副本、消费提交 offset 的时机（先处理后提交=至少一次）。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{phase === 'produce' ? '同 key 哈希到同一分区、追加得单调 offset——顺序保证是"分区内"、不是全局。' : phase === 'group2' ? 'G1 早读过这条了，但消息没删，G2 从 0 照样读到——两组 offset 独立，各消费一遍。' : phase === 'consume' ? 'offset 只是消费者自己的游标，poll 一条 +1；消息留在日志里不删。' : '先生产追加、再看两个组各自的 offset 怎么走。'}</p>}
      </div>
    </div>
  )
}
