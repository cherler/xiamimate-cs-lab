/** 舞台：秒杀防超卖真仿真 —— 库存/卖出随并发交错真跑；naive 读改写超卖 vs 原子 DECR 精确 */
import type { SeckillState } from '@engine/kernels/seckill.ts'
import type { StageProps } from '../types.ts'

const ST: Record<string, { t: string; cls: string }> = {
  pending: { t: '等待', cls: 'sk-pend' },
  reading: { t: '已读库存', cls: 'sk-read' },
  passed: { t: '判定中', cls: 'sk-read' },
  sold: { t: '✓ 抢到', cls: 'sk-sold' },
  rejected: { t: '✗ 拒绝', cls: 'sk-rej' },
}

export function SeckillStage({ state }: StageProps<SeckillState>) {
  const { phase, mode, stock, sold, initStock, reqs, cur, oversold, focus } = state
  const done = phase === 'done'
  const modeLabel = mode === 'naive' ? 'naive · 读改写(非原子)' : mode === 'atomic' ? '原子 DECR' : '—'

  return (
    <div className="card">
      <h3>秒杀 · 防超卖 <span className="hint">库存 {initStock} 件、3 个请求同抢；红线=绝不超卖</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className={`scdn ${stock < 0 ? 'sk-neg' : ''}`}>{stock}</span><span className="scdl">当前库存</span></div>
          <div className="scdk"><span className={`scdn ${oversold ? 'sk-neg' : ''}`}>{sold} / {initStock}</span><span className="scdl">卖出 / 库存</span></div>
          <div className="scdk"><span className="scdn hot" style={{ fontSize: '12px' }}>{modeLabel}</span><span className="scdl">扣减方式</span></div>
        </div>

        {/* 三个并发请求 */}
        <div className="sk-reqs">
          {reqs.map((r, i) => {
            const s = ST[r.status]!
            return (
              <div key={r.id} className={`sk-req ${s.cls} ${cur === i ? 'on' : ''}`}>
                <span className="sk-rid">{r.id}</span>
                <span className="sk-rlocal">{r.local === null ? '未读库存' : `读到=${r.local}`}</span>
                <span className="sk-rstat">{s.t}</span>
              </div>
            )
          })}
        </div>

        {/* 超卖告警 / 本步 */}
        {oversold && (
          <div className="sk-alert">💥 超卖！只有 {initStock} 件却卖出 {sold} 件，库存 = {stock}。读→判→写不原子，多个请求读到同一旧值各扣一次。</div>
        )}
        {!done && focus && !oversold && (
          <div className="sk-focus">{focus}</div>
        )}

        {done
          ? <p className="scnote">同一批请求、同样 {initStock} 件：<b>naive 读改写</b>不原子 → 卖出 3、库存 -1（<b className="sk-negtx">超卖</b>）；<b>原子 DECR</b> → 卖出恰好 {sold}、库存 0（精确）。防超卖的机制是把"扣库存"<b>原子化</b>（Redis DECR / Lua），不是加 MQ 或限流——那些是削峰、别混。落库再用 DB 乐观锁 <code>WHERE stock&gt;0</code> 兜第二道。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{mode === 'naive' ? '盯住 R3：它在 R2 写回之前就读了库存，读到同一个旧值——两个请求都判"还有货"、都扣，于是超卖。' : mode === 'atomic' ? '原子 DECR 把读-判-写合成一步：第 3 个 DECR 结果 <0 就回滚拒绝，卖出停在库存数。' : '先跑会超卖的 naive 版，再用原子 DECR 修，对比卖出与库存。'}</p>}
      </div>
    </div>
  )
}
