/** 舞台：扩散模型 —— 前向一步步加噪把图变噪声，反向网络去噪从噪声生成图 */
import type { DiffusionState } from '@engine/kernels/diffusion.ts'
import type { StageProps } from '../types.ts'

export function DiffusionStage({ state }: StageProps<DiffusionState>) {
  const { n, img, t, dir, sqrtA, sqrtN, phase } = state
  const done = phase === 'done'
  const fwd = dir === 'forward'
  const gray = (v: number) => `color-mix(in srgb, var(--ink) ${Math.round((1 - v) * 88)}%, #ffffff)`
  return (
    <div className="card">
      <h3>扩散模型 Diffusion <span className="hint">前向加噪把图变噪声，反向去噪从噪声生成图</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? '生成✓' : fwd ? '前向·加噪' : '反向·去噪'}</span><span className="scdl">方向</span></div>
          <div className="scdk"><span className="scdn">√ᾱ={sqrtA}</span><span className="scdl">信号保留</span></div>
          <div className="scdk"><span className="scdn">√(1-ᾱ)={sqrtN}</span><span className="scdl">噪声强度</span></div>
        </div>

        <div className="dfwrap">
          <div className={`dfgrid ${done ? 'gen' : ''}`} style={{ ['--n' as string]: n }}>
            {img.map((v, k) => <div key={k} className="dfpx" style={{ background: gray(v) }} />)}
          </div>
          <div className="dfscale">
            <span className={`dfend ${fwd || done ? 'on' : ''}`}>原图 ❤</span>
            <span className="dfarrow">{done ? '生成完成' : fwd ? '——— 加噪 ———▶' : '◀——— 去噪 ———'}</span>
            <span className={`dfend ${!fwd && !done ? 'on' : ''}`}>纯噪声</span>
          </div>
          <div className="orcap">
            {dir === '' ? '按「下一步」开始:先看前向一步步加噪、再看反向去噪生成'
              : done ? '从纯噪声出发、网络一步步去噪,"磨"出了一张图 ❤——这就是生成'
                : fwd ? `前向第 ${t} 步:x = √ᾱ·原图 + √(1−ᾱ)·噪声 = ${sqrtA}·原图 + ${sqrtN}·噪声${t >= n - 5 && sqrtA < 0.2 ? '(几乎纯噪声)' : ''}`
                  : `反向去噪:网络预测并减掉噪声 → 回到噪声级 ${t}(√ᾱ=${sqrtA}),图像浮现`}
          </div>
        </div>

        {done
          ? <p className="scnote">怎么让 AI 画出一张全新的图?扩散模型:<b>先学破坏、再学修复</b>。<b>前向</b>:给真实图一步步掺高斯噪声(x=√ᾱ·x₀+√(1−ᾱ)·ε),几十步变纯噪声——这步<b>固定、不用学</b>。<b>反向</b>:训练一个网络专门<b>预测并去掉每步的噪声</b>;于是从随机噪声出发、一步步去噪,就"生成"出一张新图。加噪简单可算、去噪是网络学的,<b>反着走这条路,噪声就变成了创作</b>。真实模型几十~千步、百万张图训练,还能按文字生成。Stable Diffusion、DALL·E、Sora 的底层——当今图像/视频生成主流。</p>
          : <p className="scnote" style={{ opacity: .85 }}>格子=一张 8×8 小图(深=亮)。<b>前向</b>:每步 x=√ᾱ·原图+√(1−ᾱ)·噪声,√ᾱ 从 1 降(信号变弱)、噪声变强,图渐渐被淹没成<b>纯噪声</b>。<b>反向</b>:训练好的网络一步步<b>去噪</b>,图像从噪声里<b>浮现</b>——这就是生成。前向可手算,反向是网络学的。</p>}
      </div>
    </div>
  )
}
