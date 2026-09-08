/** 舞台：GAN —— 真(蓝)vs 假(红)两簇 + D 的自适应判别边界 + 准确率随对抗轮→50% */
import type { GanState } from '@engine/kernels/gan.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const px = (x: number) => x * 100
const py = (y: number) => 100 - y * 100

export function GanStage({ state }: StageProps<GanState>) {
  const { real, fake, cReal, muG, fooled, acc, accCurve, round, rounds, phase,
    modes, covered, coverage, collapsed, eta, dataTag, muTrail } = state
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
          <div className="scdk"><span className={`scdn ${done && !collapsed ? 'good' : 'hot'}`}>{acc}%</span>
            <span className="scdl">D 判别准确率{done && !collapsed && acc <= 55 ? '（≈瞎猜）' : ''}</span></div>
          {/*  这一栏是补厚的重点：少了它，模式崩溃看起来跟成功差不多 */}
          <div className="scdk"><span className={`scdn ${modes.length > 1 && coverage < modes.length ? '' : 'hot'}`}>
            {coverage} / {modes.length}</span><span className="scdl">盖住几个真模式</span></div>
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
            {/*  各个真模式的中心：两团那档能看出 G 只扑向了其中一个 */}
            {modes.map((m, k) => (
              <circle key={`m${k}`} cx={px(m[0])} cy={py(m[1])} r="7"
                className={`ganmode ${covered[k] ? 'on' : ''}`} vectorEffect="non-scaling-stroke" />
            ))}
            {/*  μ_G 走过的路 —— G 是真的在追，不是排好的动画 */}
            {muTrail.length > 1 && (
              <polyline points={muTrail.map(m => `${px(m[0])},${py(m[1])}`).join(' ')}
                className="gantrail" fill="none" vectorEffect="non-scaling-stroke" />
            )}
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
          <b>GAN = 一场对抗博弈</b>：<b>G</b> 造假想骗过审查、<b>D</b> 学着分辨真假，轮流最佳响应。
          这一屏里 <b>D 和 G 都是算出来的</b>：D 按"离最近的真模式 vs 离假簇"判，G 朝最近的真模式挪 {(eta * 100).toFixed(0)}%。
          {collapsed
            ? <>　⚠️ <b>这一档模式崩溃了</b>：G 只是一个簇，它扑向了离自己近的那一团，
              <b>另一团一个点都没生成</b>（覆盖 {coverage}/{modes.length}）。
              　注意 D 的准确率停在 <b>{acc}%</b> 下不去 —— 这正是崩溃留下的痕迹：
              它还能靠没被覆盖的那一团把假货认出来。
              　<b>但反过来说，光盯准确率是发现不了崩溃的</b>：如果 G 恰好把两团中间占住，
              准确率一样能掉，覆盖却是 0。<b>"D 分不出来"不等于"G 学会了"。</b>
              （真实训练里的 minibatch discrimination、unrolled GAN、多样性正则，盯的都是"覆盖"。）</>
            : <>　<b>纳什均衡</b>：G 的假分布追上真分布，D 再也分不开、准确率 {acc}%。
              {acc < 50 && <>　⚠️ 它<b>低于 50%</b> —— 因为这一屏的 D 是「最近质心」这条<b>固定规则</b>，
                不是理论最优判别器；分布重合之后它还在硬按一条线切，于是真假各错一半。
                理论最优的 D 此时处处输出 0.5、正好 50%。</>}
              {dataTag === '一团' && <>　⚠️ 但真数据只有一团时，<b>"覆盖"这件事根本考不出来</b>。
                把「真数据」换成<b>两团</b>再跑一遍 —— 同样的算法会演出完全不同的结局。</>}</>}
        </p>
      </div>
    </div>
  )
}
