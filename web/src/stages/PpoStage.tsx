/** 舞台：PPO —— L^clip vs r 曲线(1+ε 后变平=无梯度) + 重要性比/替代目标/裁剪/效果 逐块 */
import type { PpoState } from '@engine/kernels/ppo.ts'
import type { StageProps } from '../types.ts'

export function PpoStage({ state }: StageProps<PpoState>) {
  const s = state
  const { moveLabel, move, eps, A, r, rA, clipR, clipA, Lclip, clipped, curve, showRatio, showSurr, showClip, showEff } = s
  const RLO = 0.5, RHI = 1.7, LHI = 1.75
  const PX = (rr: number) => 34 + ((rr - RLO) / (RHI - RLO)) * 268
  const PY = (l: number) => 84 - (l / LHI) * 68
  const path = curve.map((p, k) => `${k === 0 ? 'M' : 'L'}${PX(p.r).toFixed(1)},${PY(p.L).toFixed(1)}`).join(' ')

  return (
    <div className="card">
      <h3>PPO 近端策略优化 <span className="hint">策略梯度 + 裁剪的替代目标：把每次更新限在信任域内（miniduck 用的就是它）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{moveLabel.split('（')[0]}</span><span className="scdl">尝试步幅</span></div>
          <div className="scdk"><span className="scdn">{showRatio ? r : '—'}</span><span className="scdl">重要性比 r</span></div>
          <div className="scdk"><span className={`scdn${showClip ? ' pp-hot' : ''}`}>{showClip ? Lclip : '—'}</span><span className="scdl">裁剪目标 L^clip</span></div>
          <div className="scdk"><span className={`scdn${showEff ? (clipped ? ' pp-bad' : ' pp-good') : ''}`}>{showEff ? (clipped ? '裁剪拦住' : '正常') : '—'}</span><span className="scdl">是否触发裁剪</span></div>
        </div>

        {showSurr && (
          <svg className="pp-svg" viewBox="0 0 320 100" width="100%" height="120">
            {/* 轴 */}
            <line x1="34" y1="84" x2="308" y2="84" className="pp-axis" /><line x1="34" y1="84" x2="34" y2="12" className="pp-axis" />
            <text x="312" y="88" className="pp-axl">r</text><text x="30" y="14" className="pp-axl" textAnchor="end">L</text>
            {/* clip 边界 */}
            {showClip && <>
              <line x1={PX(1 - eps)} y1="14" x2={PX(1 - eps)} y2="84" className="pp-clipb" />
              <line x1={PX(1 + eps)} y1="14" x2={PX(1 + eps)} y2="84" className="pp-clipb" />
              <text x={PX(1 - eps)} y="96" className="pp-clbl">{1 - eps}</text>
              <text x={PX(1 + eps)} y="96" className="pp-clbl">1+ε={1 + eps}</text>
              {/* 变平=无梯度 区域标注 */}
              <text x={PX(1.45)} y={PY(clipA) - 5} className="pp-flat">变平·无梯度</text>
            </>}
            <line x1={PX(1)} y1="14" x2={PX(1)} y2="84" className="pp-r1" />
            <text x={PX(1)} y="96" className="pp-r1lbl">r=1</text>
            {/* L^clip 曲线 */}
            <path d={path} className="pp-curve" fill="none" />
            {/* 当前 r 点 */}
            {showEff && <><circle cx={PX(r)} cy={PY(Lclip)} r="4" className={clipped ? 'pp-ptbad' : 'pp-ptgood'} /><text x={PX(r)} y={PY(Lclip) - 7} className="pp-ptlbl">r={r}</text></>}
          </svg>
        )}

        <div className="pp-flow">
          <div className={`pp-blk${showRatio ? '' : ' pp-off'}`}>
            <span className="pp-n">①</span> 重要性比 r=π_new/π_old {showRatio ? <>=<b>{r}</b>（r=1 没变；这里新策略把该动作概率{move === 'small' ? '提了一点' : '提得很多'}）；优势 A={A}</> : '—'}
          </div>
          <div className={`pp-blk${showSurr ? '' : ' pp-off'}`}>
            <span className="pp-n">②</span> 替代目标 L=r·A {showSurr ? <>={r}·{A}=<b>{rA}</b>；无脑最大化会把 r 推到无穷、策略崩</> : '—'}
          </div>
          <div className={`pp-blk${showClip ? '' : ' pp-off'}`}>
            <span className="pp-n">③</span> 裁剪 L^clip=min(r·A, clip(r,{1 - eps},{1 + eps})·A) {showClip ? <>=min({rA}, {clipA})=<b className="pp-h">{Lclip}</b>（clip 把 r 夹在 [{1 - eps},{1 + eps}]）</> : '—'}
          </div>
          {showEff && (
            <div className={`pp-eff ${clipped ? 'pp-eclip' : 'pp-enorm'}`}>
              <span className="pp-n">④</span> {clipped
                ? <><b>大步触发裁剪</b>：r={r}&gt;1+ε={1 + eps} → L^clip 封在 <b>{Lclip}</b>（不是 r·A={rA}），<b>封顶后梯度=0</b>，优化器得不到"继续推大 r"的动力 → 过大更新被拦在信任域边界。这就是 PPO 防策略崩的机制。</>
                : <><b>小步·正常更新</b>：r={r} 在 [{1 - eps},{1 + eps}] 内、不裁剪，L^clip=r·A={Lclip}，梯度正常、策略照常朝好方向走一点。信任域内 PPO 和普通策略梯度一样。</>}
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>PPO = 策略梯度 + 裁剪的信任域</b>：重要性比 r=π_new/π_old；裁剪目标 min(r·A, clip(r,1−ε,1+ε)·A)——新旧策略差出 ε 就没梯度、把更新限在信任域、防策略崩，比 TRPO 简单得多。稳、超参不敏感、<b>同一批数据可多 epoch 复用</b>；配 actor-critic+GAE 算优势。<b>连</b>：是「策略梯度」的稳定化升级；<b>「miniduck」用 Brax PPO 学走路</b>（连续关节残差、velocity+imitation 奖励）。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
