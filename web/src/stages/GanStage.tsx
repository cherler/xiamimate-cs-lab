/** 舞台：GAN —— 真(蓝)vs 假(红)两簇 + D 的自适应判别边界 + 准确率随对抗轮→50% */
import type { GanState } from '@engine/kernels/gan.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const px = (x: number) => x * 100
const py = (y: number) => 100 - y * 100

export function GanStage({ state }: StageProps<GanState>) {
  const { real, fake, cReal, muG, fooled, acc, accCurve, round, rounds, phase } = state
  const done = phase === 'done'
  const nf = fooled.filter(Boolean).length

  //  D 的判别边界 = 两质心的垂直平分线;两质心重合(均衡)时边界失效、不画。
  const d: [number, number] = [cReal[0] - muG[0], cReal[1] - muG[1]]
  const dl = Math.hypot(d[0], d[1])
  const M: [number, number] = [(cReal[0] + muG[0]) / 2, (cReal[1] + muG[1]) / 2]
  const perp: [number, number] = dl > 0.01 ? [-d[1] / dl, d[0] / dl] : [0, 0]
  const L = 1.3
  const b1: [number, number] = [M[0] + L * perp[0], M[1] + L * perp[1]]
  const b2: [number, number] = [M[0] - L * perp[0], M[1] - L * perp[1]]

  //  准确率曲线画布
  const CW = 300, CH = 84, cpl = 26, cpr = 12, cpt = 8, cpb = 20
  const cpw = CW - cpl - cpr, cph = CH - cpt - cpb
  const cx = (r: number) => cpl + (rounds ? r / rounds : 0) * cpw
  const cy = (a: number) => cpt + cph - ((a - 50) / 50) * cph   // 50%..100%

  return (
    <div className="card">
      <h3>生成对抗网络 GAN <span className="hint">造假的 G 和验假的 D 互相较劲，准确率→50% 即 G 学会生成</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className={`scdn ${done ? 'good' : 'hot'}`}>{acc}%</span><span className="scdl">D 判别准确率{done ? '(=瞎猜)' : ''}</span></div>
          <div className="scdk"><span className="scdn">{nf}/6</span><span className="scdl">假数据骗过 D</span></div>
          <div className="scdk"><span className="scdn">{done ? '均衡' : `第 ${round}/${rounds} 轮`}</span><span className="scdl">对抗训练</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* D 判别边界(垂直平分线) */}
            {dl > 0.01
              ? <line x1={px(b1[0])} y1={py(b1[1])} x2={px(b2[0])} y2={py(b2[1])} className="ganbound" vectorEffect="non-scaling-stroke" />
              : null}
            {/* 真数据 蓝 */}
            {real.map((p, k) => <circle key={`r${k}`} cx={px(p[0])} cy={py(p[1])} r="2.3" className="ganpt real" />)}
            {/* 假数据 红;骗过 D 的加个环 */}
            {fake.map((p, k) => (
              <g key={`f${k}`}>
                {fooled[k] && <circle cx={px(p[0])} cy={py(p[1])} r="3.6" className="ganpt-ring" />}
                <circle cx={px(p[0])} cy={py(p[1])} r="2.3" className="ganpt fake" />
              </g>
            ))}
            {/* 两质心 ✚ */}
            <g className="gancen real"><line x1={px(cReal[0]) - 3} y1={py(cReal[1])} x2={px(cReal[0]) + 3} y2={py(cReal[1])} vectorEffect="non-scaling-stroke" /><line x1={px(cReal[0])} y1={py(cReal[1]) - 3} x2={px(cReal[0])} y2={py(cReal[1]) + 3} vectorEffect="non-scaling-stroke" /></g>
            <g className="gancen fake"><line x1={px(muG[0]) - 3} y1={py(muG[1])} x2={px(muG[0]) + 3} y2={py(muG[1])} vectorEffect="non-scaling-stroke" /><line x1={px(muG[0])} y1={py(muG[1]) - 3} x2={px(muG[0])} y2={py(muG[1]) + 3} vectorEffect="non-scaling-stroke" /></g>
          </svg>
          <div className="ganlegend">
            <span className="gl"><span className="gld" style={{ background: '#3b82f6' }} />真数据</span>
            <span className="gl"><span className="gld" style={{ background: 'var(--miss)' }} />G 造的假(红环=骗过 D)</span>
            <span className="gl"><span className="gld line" />D 判别边界</span>
          </div>
        </div>

        {/* 准确率随对抗轮:往 50% 掉 */}
        <div className="bncurvewrap">
          <div className="bncurve-t">D 准确率随对抗轮：<b>从 100% 往 50% 掉</b>（掉到 50% = G 赢、学会生成）</div>
          <svg className="bncurve" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none">
            {[50, 75, 100].map(a => (
              <g key={a}><line x1={cpl} y1={cy(a)} x2={CW - cpr} y2={cy(a)} className="bng" vectorEffect="non-scaling-stroke" /><text x={cpl - 4} y={cy(a) + 3} className="bnax" textAnchor="end">{a}</text></g>
            ))}
            <line x1={cpl} y1={cy(50)} x2={CW - cpr} y2={cy(50)} className="ganfloor" vectorEffect="non-scaling-stroke" />
            {accCurve.length > 1 && <polyline points={accCurve.map(p => `${cx(p.r)},${cy(p.acc)}`).join(' ')} className="bncurveline" vectorEffect="non-scaling-stroke" />}
            {accCurve.map((p, i) => <circle key={i} cx={cx(p.r)} cy={cy(p.acc)} r={i === accCurve.length - 1 ? 4 : 2.5} className={i === accCurve.length - 1 ? 'bndot cur' : 'bndot'} />)}
          </svg>
        </div>

        <div className="orcap">{rich(state.log)}</div>

        <p className="scnote">
          <b>GAN = 一场对抗博弈</b>:<b>生成器 G</b> 造假想骗过审查、<b>判别器 D</b> 学着分辨真假,轮流最佳响应——
          <b>D</b> 每轮学一条判别边界(这里=两簇质心的垂直平分线)、<b>G</b> 把假簇朝真数据挪去钻过边界。
          D 抓得越准,G 被迫造得越像;G 越像,D 又得学得更精。<b>纳什均衡</b>:G 的假分布=真分布、两质心重合,
          D 的边界再也分不开、准确率掉到 <b>50%</b>(瞎猜)——G 学会了以假乱真。GAN 是早期图像生成里程碑(人脸/风格迁移),和扩散模型同属生成模型。
        </p>
      </div>
    </div>
  )
}
