/**
 * 舞台：残差 = 梯度高速路 —— 梯度倒传穿层，两条链的对照
 *
 * 2026-09-08 跟着内核一起重画，改的是**纵轴**。
 * 老版本用线性轴 [0, 1.3]：梯度一路塌到 1e-50，两条线全贴在底边上，
 * "指数衰减"这四个字在图上**完全看不见**（那正是这个实验唯一要讲的事）。
 * 换成 **log 轴** 之后，指数衰减就是它本来的样子 —— 一条**直线**，斜率就是每层的 log 因子。
 * 于是"残差把连乘衰减变成近似连加穿过"不再是一句话：残差那条几乎是平的，普通那条一头栽下去。
 */
import type { ResidualState } from '@engine/kernels/residual.ts'
import type { StageProps } from '../types.ts'

export function ResidualStage({ state }: StageProps<ResidualState>) {
  const { layer, depth, branch, gradPlain, gradRes, plainFactor, resFactor,
    histPlain, histRes, thPlain, thRes, resHolds, gain, phase } = state
  const started = histPlain.length > 1
  const H = 118, W = 100
  const n = depth + 1

  /*  log 轴：下界取两条链**最终**会到的量级（用理论值定，免得走到一半跳刻度），
      再留一个数量级余量；上界固定在 10（因子偶尔 >1 时不至于顶出去）。 */
  const floorDec = Math.floor(Math.log10(Math.max(1e-60, Math.min(thPlain, thRes)))) - 1
  const TOP = 1, BOT = floorDec                      // 以 10 的幂计
  const px = (k: number) => (k / (n - 1)) * W
  const py = (v: number) => {
    const d = Math.log10(Math.max(10 ** BOT, v))
    return H - (d - BOT) / (TOP - BOT) * H
  }
  const line = (h: number[]) => h.map((v, k) => `${k ? 'L' : 'M'}${px(k).toFixed(1)} ${py(v).toFixed(1)}`).join(' ')
  //  每隔几个数量级画一条参考线，太密就抽稀
  const stepDec = Math.max(1, Math.ceil((TOP - BOT) / 6))
  const decades: number[] = []
  for (let d = TOP; d >= BOT; d -= stepDec) decades.push(d)
  //  小于 0.01 走有效数字：toFixed(4) 会把 2.29e-4 磨成 0.0002，只剩一位有效数字
  const fmt = (v: number) => (v >= 0.01 ? v.toFixed(4) : v.toPrecision(3))
  const fmtG = (v: number) => (v > 1e4 ? v.toExponential(1) : `${v}`)

  return (
    <div className="card">
      <h3>残差 = 梯度高速路 <span className="hint">同一批 f′，差别只有那个 +1</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{depth} 层 · f′≈{branch}</span><span className="scdl">链长 · 支路强度</span></div>
          <div className="scdk"><span className="scdn" style={{ color: 'var(--miss)' }}>{started ? fmt(gradPlain) : '1.0000'}</span><span className="scdl">没残差 梯度</span></div>
          <div className="scdk"><span className={`scdn ${started && gradRes > 0.1 ? 'hot' : ''}`}>{started ? fmt(gradRes) : '1.0000'}</span><span className="scdl">有残差 梯度</span></div>
          {started && <div className="scdk"><span className="scdn">×{plainFactor} vs ×{resFactor}</span>
            <span className="scdl">这一层：|f′| vs |1+f′|</span></div>}
        </div>

        <div className="rswrap">
          <div className="rsbox">
          <svg className="rsplot" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {/*  每条参考线是一个数量级 —— 指数衰减在这张图上是**直线** */}
            {decades.map(d => (
              <line key={d} x1="0" y1={py(10 ** d)} x2={W} y2={py(10 ** d)}
                className={`rsref ${d === 0 ? '' : 'dim'}`} />
            ))}
            {started && <path d={line(histRes)} className="rsline res" vectorEffect="non-scaling-stroke" />}
            {started && <path d={line(histPlain)} className="rsline plain" vectorEffect="non-scaling-stroke" />}
          </svg>
          <div className="rsdec">
            {decades.map(d => (
              <span key={d} className="rsdt" style={{ top: `${py(10 ** d) / H * 100}%` }}>
                {d === 0 ? '1' : `1e${d}`}
              </span>
            ))}
          </div>
          </div>
          <div className="rslabels">
            <span className="rsleg res">■ 有残差（每层 ×|1+f′|）</span>
            <span className="rsleg plain">■ 没残差（每层 ×|f′|）</span>
          </div>
          <div className="orcap">
            {started
              ? `倒传到第 ${layer} 层。纵轴是 log 刻度，每格一个数量级 —— 所以指数衰减在这儿就是一条直线，斜率 = 每层的 log 因子。`
              : '按「下一步」让梯度从输出往输入倒传。纵轴 log 刻度：指数衰减会画成一条直线。'}
          </div>
        </div>

        {phase === 'done'
          ? (resHolds
            ? <p className="scnote">梯度穿过 {depth} 层：<b style={{ color: 'var(--miss)' }}>没残差</b>塌到 <b>{fmt(gradPlain)}</b>，
              <b>有残差</b>还有 <b>{fmt(gradRes)}</b> —— 差 <b>{fmtG(gain)} 倍</b>。
              　两条链用的是<b>同一批 f′</b>，差别只有一个 <b>+1</b>：普通块 y=f(x) 的导数是 f′，
              残差块 y=x+f(x) 的导数是 <b>1+f′</b>。f′ 再小，那条恒等路也把梯度<b>原样递了过去</b>，
              连乘不再塌向 0。ResNet、Transformer 的每个子层都裹残差，几十上百层才训得动，就是为这个。
              　⚠️ 但别把它当万能：把「支路强度」拧到 <b>强 f′≈0.6</b>、层数拧到 50 再看。</p>
            : <p className="scnote"><b>这一次残差也没守住。</b>穿过 {depth} 层之后它只剩 <b>{fmt(gradRes)}</b>
              （没残差是 {fmt(gradPlain)}，残差仍好 {fmtG(gain)} 倍，但两条都塌了）。
              　原因看得见：支路 f′ 的量级到了 <b>{branch}</b>，1+f′ 就在 {(1 + branch).toFixed(1)} 和 {(1 - branch).toFixed(1)} 之间跳，
              <b>log 的均值仍然是负的</b> —— 那个 +1 只有在 f′ 足够小、让 1+f′ 真的贴着 1 的时候，才是一条高速路。
              　所以"加了残差就能随便堆深"是不成立的。ResNet-v2 的预激活、Fixup、LayerScale、
              Transformer 里各种残差缩放，做的都是同一件事：<b>把支路压小</b>。
              把旋钮拧回 <b>弱 f′≈0.1</b>，高速路就回来了。</p>)
          : started && <p className="scnote" style={{ opacity: .85 }}>
            链式法则 = <b>连乘</b>。这一层抽到的支路导数 f′ 决定了两个因子：没残差乘 <b>|f′|={plainFactor}</b>，
            有残差乘 <b>|1+f′|={resFactor}</b> —— 同一个 f′，差的就是那个 +1。
            盯住两条线在 log 轴上的<b>斜率</b>：斜率就是每层的 log 因子，越陡塌得越快。</p>}
      </div>
    </div>
  )
}
