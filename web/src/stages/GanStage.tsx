/** 舞台：GAN —— 真数据(蓝)vs G造的假数据(红)，对抗训练假数据逼近真数据、D准确率→50% */
import type { GanState } from '@engine/kernels/gan.ts'
import type { StageProps } from '../types.ts'

const px = (x: number) => x * 100
const py = (y: number) => 100 - y * 100

export function GanStage({ state }: StageProps<GanState>) {
  const { real, fake, center, rad, round, fakeInside, acc, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>生成对抗网络 GAN <span className="hint">造假的 G 和验假的 D 互相较劲，把假数据逼到和真的难分</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{acc}%</span><span className="scdl">D 判别准确率</span></div>
          <div className="scdk"><span className="scdn">{fakeInside}/6</span><span className="scdl">假数据骗过 D</span></div>
          <div className="scdk"><span className="scdn">{done ? '均衡' : `第 ${round} 轮`}</span><span className="scdl">对抗训练</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* 真数据区(D 认为=真的范围) */}
            <ellipse cx={px(center[0])} cy={py(center[1])} rx={rad * 100} ry={rad * 100} fill="color-mix(in srgb, #3b82f6 8%, transparent)" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="2 1.5" vectorEffect="non-scaling-stroke" />
            {/* 真数据 蓝 */}
            {real.map((p, k) => <circle key={`r${k}`} cx={px(p[0])} cy={py(p[1])} r="2.2" fill="#3b82f6" opacity="0.92" />)}
            {/* 假数据 红 */}
            {fake.map((p, k) => <circle key={`f${k}`} cx={px(p[0])} cy={py(p[1])} r="2.2" fill="var(--miss)" opacity="0.92" />)}
          </svg>
          <div className="ganlegend">
            <span className="gl"><span className="gld" style={{ background: '#3b82f6' }} />真数据</span>
            <span className="gl"><span className="gld" style={{ background: 'var(--miss)' }} />G 造的假数据</span>
            <span className="gl"><span className="gld ring" />D 认作真的区</span>
          </div>
          <div className="orcap">
            {round === 0 && !done ? '按「下一步」开始:G 造的假数据(红)乱撒,D 一眼看穿(准确率高)'
              : done ? `对抗均衡:假数据和真数据难分难解,D 准确率掉到 ${acc}%(瞎猜)——G 学会了生成`
                : `第 ${round} 轮:G 造得更像,${fakeInside} 个假数据混进真数据区骗过 D;D 准确率掉到 ${acc}%`}
          </div>
        </div>

        {done
          ? <p className="scnote">怎么生成逼真数据?GAN 用<b>对抗博弈</b>:<b>生成器 G</b> 从噪声造假、想骗过审查;<b>判别器 D</b> 学着分辨真假。两者对着干——G 要<b>骗过 D</b>、D 要<b>抓住 G</b>。D 抓得越准,G 被迫造得越像;G 越像,D 又得学得更精。这场军备竞赛的<b>纳什均衡</b>是:G 的假数据分布=真数据分布,D 再也分不出、准确率掉到 <b>50%</b>(瞎猜)——G 就学会了以假乱真。GAN 是早期图像生成的里程碑(逼真人脸、风格迁移),和扩散模型同属<b>生成模型</b>——AI 求职热点。</p>
          : <p className="scnote" style={{ opacity: .85 }}>蓝=真数据、红=G 造的假数据、虚线圈=D 认作"真"的区域。<b>对抗</b>:G 想让红点混进蓝点堆里骗过 D,D 想把红点挑出来。随训练,红点逐轮<b>逼近</b>蓝点分布,落进圈里的越多、D 越难分,准确率从 100% 往 50% 掉。掉到 50% 就是 G 赢了=学会生成。</p>}
      </div>
    </div>
  )
}
