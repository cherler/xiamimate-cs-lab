/** 舞台：投机解码 —— 草稿提案 accept/reject + 提交序列生长 + 加速比 */
import type { SpecDecState } from '@engine/kernels/specdec.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function SpecDecStage({ state }: StageProps<SpecDecState>) {
  const { committed, proposals, accepts, matchLen, bonus, targetPasses, tokensOut, speedup, phase } = state
  const done = phase === 'done'
  const committedBefore = committed.length - state.gotThisRound
  return (
    <div className="card">
      <h3>投机解码 <span className="hint">草稿一次猜 K 个 · 大模型一次验证多个</span></h3>
      <div className="body">
        {/* 已提交序列 */}
        <div className="sdrow">
          <span className="sdlab">已生成</span>
          <div className="sdseq">
            {committed.map((t, k) => (
              <div key={k} className={`sdtok done ${k >= committedBefore && !done ? 'fresh' : ''}`}>{t}</div>
            ))}
            {done && <span className="sddone">✓ 完成</span>}
          </div>
        </div>

        {/* 本轮草稿验证 */}
        {!done && proposals.length > 0 && (
          <div className="sdverify">
            <span className="sdlab">本轮草稿</span>
            <div className="sdprops">
              {proposals.map((t, j) => {
                const ok = accepts[j]
                const isFirstMiss = j === matchLen && !ok
                return (
                  <div key={j} className={`sdprop ${ok ? 'acc' : isFirstMiss ? 'rej' : 'drop'}`}>
                    <span className="sdpt">{t}</span>
                    <span className="sdpm">{ok ? '✓ 接受' : isFirstMiss ? '✗ 纠正' : '作废'}</span>
                  </div>
                )
              })}
              {state.gotThisRound > matchLen && (
                <div className={`sdprop ${bonus ? 'bonus' : 'fix'}`}>
                  <span className="sdpt">{committed[committed.length - 1]}</span>
                  <span className="sdpm">{bonus ? '白送' : '大模型真值'}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 加速比 */}
        <div className="sdspeed">
          <div className="sdspeedmain">
            <span className="sdspeedn">{speedup.toFixed(2)}×</span>
            <span className="sdspeedl">{tokensOut} 字 / {targetPasses} 次大模型前向</span>
          </div>
          <div className="sdspeedcmp">
            <div className="sdbar"><span className="sdbl">投机</span><div className="sdtrack"><div className="sdfill ok" style={{ width: `${(targetPasses / Math.max(tokensOut, 1)) * 100}%` }}>{targetPasses} 次</div></div></div>
            <div className="sdbar"><span className="sdbl">逐字</span><div className="sdtrack"><div className="sdfill bad" style={{ width: '100%' }}>{tokensOut} 次</div></div></div>
          </div>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
