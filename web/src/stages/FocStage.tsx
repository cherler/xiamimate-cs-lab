/** 舞台：FOC 电流环 —— Clarke→Park→PI→逆变换+SVPWM 竖向流水线，逐块现算；高亮 i_d≈0 不变量与 i_q 力矩旋钮 */
import { type ReactNode } from 'react'
import type { FocState } from '@engine/kernels/foc.ts'
import type { StageProps } from '../types.ts'

function Blk({ n, title, on, badge, badgeTone, children }: { n: string; title: string; on: boolean; badge?: string; badgeTone?: string; children: ReactNode }) {
  return (
    <div className={`fc-blk${on ? '' : ' fc-off'}`}>
      <div className="fc-bh"><span className="fc-bn">{n}</span>{title}{badge && <em className={`fc-badge ${badgeTone ?? ''}`}>{badge}</em>}</div>
      {on ? <div className="fc-brow">{children}</div> : <div className="fc-bwait">—</div>}
    </div>
  )
}
const V = ({ k, v, hot }: { k: string; v: ReactNode; hot?: boolean }) => (
  <span className={`fc-v${hot ? ' fc-hot' : ''}`}><i>{k}</i>{v}</span>
)

export function FocStage({ state }: StageProps<FocState>) {
  const s = state
  const disp = (x: number) => (Object.is(x, -0) ? 0 : x)

  return (
    <div className="card">
      <h3>FOC 磁场定向控制 <span className="hint">把三相交流电流转进 dq 系，像直流电机一样用两个 PI 独立控力矩(i_q)与磁场(i_d)</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{s.cmdLabel.split(' ')[0]}</span><span className="scdl">力矩指令</span></div>
          <div className="scdk"><span className="scdn">{s.thetaDeg}<em className="cc-u">°</em></span><span className="scdl">转子电角 θ_e</span></div>
          <div className="scdk"><span className={`scdn${s.showPark ? ' fc-nd' : ''}`}>{s.showPark ? disp(s.iD) : '—'}</span><span className="scdl">i_d(测得→压到0)</span></div>
          <div className="scdk"><span className={`scdn${s.showInv ? (s.torque > 0 ? ' fc-npos' : s.torque < 0 ? ' fc-nneg' : '') : ''}`}>{s.showInv ? disp(s.torque) : '—'}</span><span className="scdl">转矩 τ=1.5·p·λ_m·i_q</span></div>
        </div>

        <div className="fc-flow">
          <Blk n="①" title="Clarke　abc → αβ" on={s.showClarke}>
            <span className="fc-in"><V k="i_a=" v={s.ia} /><V k="i_b=" v={s.ib} /><V k="i_c=" v={s.ic} /></span>
            <span className="fc-arr">→</span>
            <span className="fc-out"><V k="i_α=" v={s.iAlpha} /><V k="i_β=" v={s.iBeta} /></span>
          </Blk>

          <Blk n="②" title={`Park　αβ → dq（转 θ_e=${s.thetaDeg}°）`} on={s.showPark} badge="交流→直流" badgeTone="fc-key">
            <span className="fc-in"><V k="i_α=" v={s.iAlpha} /><V k="i_β=" v={s.iBeta} /></span>
            <span className="fc-arr">→</span>
            <span className="fc-out"><V k="i_d=" v={disp(s.iD)} hot /><V k="i_q=" v={disp(s.iQ)} hot /></span>
          </Blk>

          <Blk n="③" title="两个 PI　i_d→0、i_q→i_q*" on={s.showPI} badge="i_d*=0 是 MTPA" badgeTone="fc-mtpa">
            <span className="fc-in"><V k="e_d=0−i_d=" v={s.eD} /><V k="e_q=i_q*−i_q=" v={s.eQ} /></span>
            <span className="fc-arr">→</span>
            <span className="fc-out"><V k="U_d=" v={s.uD} /><V k="U_q=" v={s.uQ} /></span>
          </Blk>

          <Blk n="④" title="逆 Park → 逆 Clarke → SVPWM" on={s.showInv} badge="SVPWM +15% 母线利用率" badgeTone="fc-sv">
            <div className="fc-inv">
              <div className="fc-invr"><span className="fc-sub">逆Park</span><V k="U_α=" v={s.uAlpha} /><V k="U_β=" v={s.uBeta} /></div>
              <div className="fc-invr"><span className="fc-sub">逆Clarke</span><V k="U_a=" v={s.uA} /><V k="U_b=" v={s.uB} /><V k="U_c=" v={s.uC} /></div>
              <div className="fc-invr"><span className="fc-sub">SVPWM 中点钳位（共模 {s.svOffset}）</span><V k="U_a=" v={s.uAc} hot /><V k="U_b=" v={s.uBc} hot /><V k="U_c=" v={s.uCc} hot /></div>
            </div>
          </Blk>
        </div>

        {s.showInv && (
          <div className={`fc-torque ${s.torque > 0 ? 'fc-tpos' : s.torque < 0 ? 'fc-tneg' : 'fc-tzero'}`}>
            ⑤ 转矩 τ = 1.5·p·λ_m·i_q = 1.5×{s.poles}×{s.lambdaM}×{disp(s.iQ)} = <b>{disp(s.torque)} N·m</b>（{s.torque > 0 ? '正转' : s.torque < 0 ? '反转' : '零力矩'}）——转矩只跟 i_q 走，i_d 恒被压到 0：<b>i_q 就是力矩旋钮</b>。
          </div>
        )}

        {s.stage === 'done'
          ? <p className="scnote"><b>FOC 为什么是电机控制的标准答案</b>：Clarke(3→2)+Park(转进转子系)把交流相电流变<b>直流</b> → 简单 PI 就能<b>零稳态误差</b>；<b>i_d*=0</b>=最大转矩每安培(表贴永磁/步进只有 i_q 出力)；d/q 解耦两路独立 PI；SVPWM 注共模零序比正弦 PWM 多约 15% 母线利用率；τ=1.5·p·λ_m·i_q。它是<b>级联 PID 最内环</b>(位置→速度→电流)，驱动 FK/IK 求解的关节。比开环微步好在：<b>每拍量转子角、恒 90°矢量→不丢步、每安培都出力</b>。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
