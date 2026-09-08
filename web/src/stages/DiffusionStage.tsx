/**
 * 舞台：扩散模型 —— 前向加噪、反向**真的在采样**
 *
 * 2026-09-08 跟着内核一起重画（见 kernels/diffusion.ts 顶上那段：老版本的反向是**倒放录像**）。
 * 反向变成真采样之后，屏幕上多了两样以前不可能有的东西：
 *   · **x̂₀** —— 去噪器此刻估计的"干净图"。它跟当前这团 x_t 并排摆着，
 *     "一步步磨出来"才有具体所指：左边还是噪声，右边已经能看出形状了。
 *   · **后验权重条** —— "此刻觉得它像 ❤ 62% / ✚ 31% / ▲ 7%"。
 *     这是生成的**决策过程**，也是这一屏最该看的东西：图案不是预先定好的，是这几个数投票投出来的。
 */
import type { DiffusionState } from '@engine/kernels/diffusion.ts'
import type { StageProps } from '../types.ts'

export function DiffusionStage({ state }: StageProps<DiffusionState>) {
  const { n, img, x0hat, weights, names, t, T, dir, sqrtA, sqrtN, landed, landedW, phase } = state
  const done = phase === 'done'
  const fwd = dir === 'forward'
  const gray = (v: number) => `color-mix(in srgb, var(--ink) ${Math.round((1 - Math.max(0, Math.min(1, v))) * 88)}%, #ffffff)`
  const top = weights.indexOf(Math.max(...weights))
  return (
    <div className="card">
      <h3>扩散模型 Diffusion <span className="hint">前向加噪把图变噪声，反向去噪从噪声生成图</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? '生成✓' : fwd ? '前向·加噪' : '反向·去噪'}</span><span className="scdl">方向</span></div>
          <div className="scdk"><span className="scdn">t = {t} / {T}</span><span className="scdl">噪声级</span></div>
          <div className="scdk"><span className="scdn">√ᾱ={sqrtA}</span><span className="scdl">信号保留</span></div>
          <div className="scdk"><span className="scdn">√(1-ᾱ)={sqrtN}</span><span className="scdl">噪声强度</span></div>
          {done && <div className="scdk"><span className="scdn hot">{landed}</span>
            <span className="scdl">磨出来的是（把握 {(landedW * 100).toFixed(0)}%）</span></div>}
        </div>

        <div className="dfwrap">
          {/*  反向时并排摆两张：左=此刻这团 x_t，右=去噪器估计的干净图 x̂₀。
               「一步步磨出来」这句话，只有这两张并排才看得见。 */}
          <div className="dfpair">
            <div className="dfone">
              <div className={`dfgrid ${done ? 'gen' : ''}`} style={{ ['--n' as string]: n }}>
                {img.map((v, k) => <div key={k} className="dfpx" style={{ background: gray(v) }} />)}
              </div>
              <span className="dflab">{fwd ? `x_t（加噪到 t=${t}）` : `x_t（当前，t=${t}）`}</span>
            </div>
            {x0hat && (
              <div className="dfone">
                <div className="dfgrid" style={{ ['--n' as string]: n }}>
                  {x0hat.map((v, k) => <div key={k} className="dfpx" style={{ background: gray(v) }} />)}
                </div>
                <span className="dflab">x̂₀（去噪器猜的干净图）</span>
              </div>
            )}
          </div>

          {/*  后验权重：生成的决策过程。图案不是预先定好的，是这几个数投票投出来的 */}
          {x0hat && (
            <div className="dfvote">
              <span className="dfvt">此刻觉得它像</span>
              {names.map((nm, k) => (
                <span key={nm} className={`dfbar ${k === top ? 'on' : ''}`}>
                  <b>{nm}</b>
                  <i style={{ width: `${Math.max(2, weights[k] * 100)}%` }} />
                  <em>{(weights[k] * 100).toFixed(0)}%</em>
                </span>
              ))}
            </div>
          )}
          <div className="dfscale">
            <span className={`dfend ${fwd || done ? 'on' : ''}`}>原图 ❤</span>
            <span className="dfarrow">{done ? '生成完成' : fwd ? '——— 加噪 ———▶' : '◀——— 去噪 ———'}</span>
            <span className={`dfend ${!fwd && !done ? 'on' : ''}`}>纯噪声</span>
          </div>
          <div className="orcap">
            {done ? `从一团纯噪声出发、走了 ${T} 步，"磨"出了 ${landed} —— 换个噪声种子会磨出另一张`
              : fwd ? `前向第 ${t} 步：x = √ᾱ·原图 + √(1−ᾱ)·噪声 = ${sqrtA}·原图 + ${sqrtN}·噪声${sqrtA < 0.2 ? '（几乎纯噪声）' : ''}`
                : `反向：按后验权重估出 x̂₀ → 反解噪声 ε̂ → 走一步 DDIM 到 t=${t - 1}`}
          </div>
        </div>

        {done
          ? <p className="scnote">从一团纯噪声出发、走了 {T} 步 DDIM，磨出了 <b>{landed}</b>（把握 {(landedW * 100).toFixed(1)}%）。
            扩散 = <b>前向加噪（固定、可手算）+ 反向去噪（学出来的那部分）</b>；把加噪反着走，噪声就成了创作。
            　这一屏的去噪器<b>不是"假装有个网络"</b>：图像只可能是三个图案之一，这个先验下 E[x₀|x_t] 有
            <b>闭式解</b>（后验权重 softmax + 加权平均），每一步都能手算核对 —— 训练充分的网络逼近的就是它。
            　<b>换个噪声种子再跑一次</b>：同样的模型、同样的步数，会磨出另一张图。这才叫生成。
            真实模型在几十~上千步、上亿张图上训练，还能按文字条件生成 —— Stable Diffusion / Sora 的底层就是这套。</p>
          : <p className="scnote" style={{ opacity: .85 }}>格子=一张 8×8 小图（深=亮）。
            <b>前向</b>：每步 x=√ᾱ·原图+√(1−ᾱ)·噪声，√ᾱ 从 1 一路降，图被淹成<b>纯噪声</b> —— 这一半是固定的、能手算。
            <b>反向</b>：起点只有噪声，<b>它并不知道原图是什么</b>；每一步先算"像哪个图案"的后验权重、据此估出干净图 x̂₀、
            反解出噪声再走一步。图案是这几个权重<b>投票投出来的</b>，不是预先定好的。</p>}
      </div>
    </div>
  )
}
