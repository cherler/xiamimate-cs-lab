/** 舞台：卷积 —— 3×3 核在输入图上滑窗，逐格算加权和生成特征图 */
import type { ConvState } from '@engine/kernels/conv.ts'
import type { StageProps } from '../types.ts'

const gray = (v: number) => `color-mix(in srgb, var(--ink) ${Math.round((v / 9) * 78)}%, var(--panel))`
const heat = (v: number, max: number) => {
  const t = Math.max(-1, Math.min(1, v / (max || 1)))
  return t >= 0
    ? `color-mix(in srgb, var(--now) ${Math.round(t * 70)}%, var(--panel))`
    : `color-mix(in srgb, var(--miss) ${Math.round(-t * 70)}%, var(--panel))`
}

export function ConvStage({ state }: StageProps<ConvState>) {
  const { kernelName, img, kernel, out, ci, cj, curVal, phase } = state
  const started = ci >= 0
  const outMax = Math.max(1, ...out.flat().filter((x): x is number => x !== null).map(Math.abs))
  return (
    <div className="card">
      <h3>卷积 CNN <span className="hint">一个小窗口滑过图像，就能"看见"特征</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{kernelName}核</span><span className="scdl">卷积核</span></div>
          <div className="scdk"><span className="scdn">{started ? `(${ci},${cj})` : '—'}</span><span className="scdl">窗口位置</span></div>
          <div className="scdk"><span className="scdn hot">{started ? curVal : '—'}</span><span className="scdl">本格加权和</span></div>
        </div>

        <div className="cvwrap">
          {/* 输入图 + 滑窗 */}
          <div className="cvblock">
            <div className="cvgrid" style={{ gridTemplateColumns: `repeat(${img[0].length}, 1fr)` }}>
              {img.map((row, r) => row.map((v, c) => {
                const inWin = started && r >= ci && r < ci + 3 && c >= cj && c < cj + 3
                return <div key={`${r}-${c}`} className={`cvcell ${inWin ? 'win' : ''}`} style={{ background: gray(v) }}>{v}</div>
              }))}
            </div>
            <span className="cvcap">输入图 (亮=大值)</span>
          </div>

          {/* 核 */}
          <div className="cvblock">
            <div className="cvgrid ker" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {kernel.map((row, r) => row.map((v, c) => (
                <div key={`k${r}-${c}`} className="cvcell ker">{v}</div>
              )))}
            </div>
            <span className="cvcap">{kernelName}核 ⊙</span>
          </div>

          {/* 特征图 */}
          <div className="cvblock">
            <div className="cvgrid" style={{ gridTemplateColumns: `repeat(${out[0].length}, 1fr)` }}>
              {out.map((row, r) => row.map((v, c) => (
                <div key={`o${r}-${c}`} className={`cvcell ${started && r === ci && c === cj ? 'cur' : ''}`}
                  style={{ background: v === null ? 'var(--panel)' : heat(v, outMax) }}>{v === null ? '' : v}</div>
              )))}
            </div>
            <span className="cvcap">特征图 =</span>
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">{kernelName}核滑完 9 处、生成 3×3 特征图。{kernelName === '边缘' ? '边缘核在明暗交界那两列响应最强(±27)、平坦区≈0——它"看见"了竖直边缘。' : kernelName === '模糊' ? '模糊核求邻域平均,把边缘抹平了。' : '锐化核突出中心、压邻域,把边缘提得更亮。'}同一个核<b>共享权重</b>扫全图:参数极少、还平移不变(图上哪都认)。很多层卷积叠起来,浅层看边缘纹理、深层拼物体——这就是 CNN 看图的底。换上面「卷积核」看不同特征。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{started ? '把 3×3 核和窗口内像素逐位相乘再相加,得一个数,填进特征图。核滑一格、算一次。' : '按「下一步」让核在图上一格格滑。'}</p>}
      </div>
    </div>
  )
}
