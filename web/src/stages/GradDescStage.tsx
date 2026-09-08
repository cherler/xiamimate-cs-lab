/**
 * 舞台：梯度下降 —— 碗形损失面的等高线 + 顺负梯度走的轨迹
 *
 * 2026-09-08 跟着内核一起重画。老版本把等高线按 L=x²+5y² 写死，谷的形状一改就画错；
 * 而且屏幕上没有任何东西能回答"这一步走得对不对" —— 结语里的"太大发散、太小太慢"
 * 全靠嘴说。现在多了两样：
 *   · **等高线随 κ 现算** —— 圆碗是圆，峡谷是压扁的细长椭圆，"负梯度不指向谷底"是看出来的；
 *   · **收缩率对照条** —— 实测每步收缩摆在两条理论速率（GD / 动量）旁边，
 *     公式档上两个数会**逐位对上**，这比任何一句"公式是对的"都硬。
 */
import type { GradDescState } from '@engine/kernels/graddesc.ts'
import type { StageProps } from '../types.ts'

const R = 5                     // 坐标范围 [-R, R]
const SC = 100 / (2 * R)        // 世界坐标 → viewBox(100×100)
const cx = (x: number) => 50 + x * SC
const cy = (y: number) => 50 - y * SC   // y 向上
//  轨迹可能跑出取景框（发散），夹一下免得 SVG 坐标爆掉
const cl = (v: number) => Math.max(-40, Math.min(140, v))

export function GradDescStage({ state }: StageProps<GradDescState>) {
  const { step, x, y, loss, gx, gy, lr, lrMax, lrMaxEff, kappa, mom, momTag, tuned,
    rateGd, rateMom, measRate, zig, reach, diverged, path, phase } = state
  const started = step >= 0
  const L0 = 16 + 16 * kappa
  //  等高线按 κ 现算：x²+κy²=c → 半轴 √c（x）、√(c/κ)（y）
  const levels = [1, 0.5, 0.2, 0.05, 0.01].map(f => L0 * f)
  //  ⚠️ "临界"是 lr **正好**等于上限那一档；判据要两头夹，
  //     只写 >0.999 会把发散那一档也算进来（它的因子是 1.2）。
  const critical = !diverged && Math.abs(lr - lrMaxEff) <= 1e-9
  //  ⚠️ 只在收缩率有意义时（κ>1、已走了步、没炸）画对照条
  const showRate = started && step > 0 && kappa > 1 && Number.isFinite(measRate) && measRate > 0

  return (
    <div className="card">
      <h3>梯度下降 <span className="hint">谷越窄，负梯度越不指向谷底</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className={`scdn ${diverged ? '' : 'hot'}`}>
            {!started ? L0.toFixed(0) : !Number.isFinite(loss) ? '∞' : loss > 1e5 ? loss.toExponential(1) : loss.toFixed(3)}</span>
            <span className="scdl">损失 L</span></div>
          <div className="scdk"><span className="scdn">κ = {kappa}</span><span className="scdl">条件数（谷的长宽比）</span></div>
          <div className="scdk"><span className="scdn">{lr} / {mom > 0 ? lrMaxEff : lrMax}</span>
            <span className="scdl">步长 / 稳定上限{mom > 0 ? '（含动量）' : ''}</span></div>
          {/*  横跳本身不是毛病（收敛的路照样横跳），所以这栏不标红 */}
          <div className="scdk"><span className="scdn">{zig}</span><span className="scdl">y 方向横跳次数</span></div>
          {phase === 'done' && <div className="scdk">
            <span className={`scdn ${reach >= 0 ? 'hot' : ''}`}>{reach >= 0 ? `第 ${reach} 步` : '没到'}</span>
            <span className="scdl">降到初始的 1%</span></div>}
        </div>

        {/*  三种"这一步走不动了"的横幅，各说各的原因 —— 不能混成一句 */}
        {diverged && (
          <div className="gdWarn bad">
            💥 <b>发散</b>：步长 {lr} 越过上限 {mom > 0 ? lrMaxEff : lrMax}，陡方向的迭代因子
            |1−2κ·lr| = <b>{Math.abs(1 - 2 * kappa * lr).toFixed(3)} &gt; 1</b> —— 每步不是缩小，是放大。
          </div>
        )}
        {critical && (
          <div className="gdWarn">
            ⚖️ <b>正好卡在临界</b>：步长等于上限，陡方向的因子恰是 −1 —— 每步把 y 翻个号、<b>大小分毫不变</b>。
            再多走几步也没用。
          </div>
        )}
        {tuned && (
          <div className="gdWarn ok">
            🎯 <b>步长已被接管</b>：重球法的最优是一<b>对</b>参数（β*={mom} 与配套步长 {lr}），
            所以"步长"那个旋钮这一档不起作用。只拧 β 而不动步长，常常反而更慢。
          </div>
        )}

        <div className="gdwrap">
          <svg className="gdplot" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <line x1="50" y1="4" x2="50" y2="96" className="gdaxis" />
            <line x1="4" y1="50" x2="96" y2="50" className="gdaxis" />
            {levels.map((c, k) => (
              <ellipse key={k} cx="50" cy="50" rx={Math.sqrt(c) * SC} ry={Math.sqrt(c / kappa) * SC} className="gdlevel" />
            ))}
            {started && path.length > 1 && (
              <polyline points={path.map(p => `${cl(cx(p.x))},${cl(cy(p.y))}`).join(' ')}
                className="gdpath" vectorEffect="non-scaling-stroke" />
            )}
            {started && path.map((p, k) => (
              <circle key={k} cx={cl(cx(p.x))} cy={cl(cy(p.y))} r={k === path.length - 1 ? 2.4 : 1.2}
                className={k === path.length - 1 ? 'gddot now' : 'gddot'} />
            ))}
            <circle cx="50" cy="50" r="1.6" className="gdmin" />
          </svg>

          {/*  收缩率对照条：实测 vs 两条理论。公式档上前两个会逐位对上 */}
          {showRate && (
            <div className="gdrate">
              <span className="gdrt">每步收缩（越小越快）</span>
              {([['实测', measRate, true], ['GD 理论', rateGd, false], ['动量理论', rateMom, false]] as const).map(([nm, v, live]) => (
                <span key={nm} className={`gdrbar ${live ? 'on' : ''}`}>
                  <b>{nm}</b><i style={{ width: `${Math.max(2, Math.min(1, v) * 100)}%` }} /><em>{v.toFixed(3)}</em>
                </span>
              ))}
            </div>
          )}

          <div className="orcap">
            {started
              ? `等高线 = L=x²+${kappa}y² 的等值圈${kappa === 1 ? '（正圆）' : `（长宽比 ${kappa}:1）`}；`
                + `此刻负梯度 −(${gx.toFixed(2)}, ${gy.toFixed(2)})`
                + (kappa > 1 ? ` —— 它指的方向跟"通往谷底"差得越多，路就越绕。` : ` —— 正圆碗上它直指谷底。`)
              : `按「下一步」从 (4,4) 开始下降。等高线越扁，负梯度越不指向谷底。`}
          </div>
        </div>

        {phase === 'done'
          ? (diverged
            ? <p className="scnote"><b>炸了。</b>这个上限 <b>lrMax = 1/κ = {lrMax}</b> 是<b>算出来</b>的，不用试：
              沿陡方向的更新是 y ← (1−2κ·lr)·y，因子绝对值一超过 1 就必然放大。
              　"学习率调大点收敛快"只在界内成立，界外一步都走不得。</p>
            : critical
              ? <p className="scnote"><b>卡在临界。</b>损失从 {L0.toFixed(0)} 只降到 <b>{loss.toFixed(2)}</b>，降的全是平缓那一维；
                陡的那一维在原地翻号，永远不动。
                　这一档最值钱的地方是它<b>不报错也不发散</b> —— 它只是<b>永远到不了</b>。
                "再多训练几步总会好"，遇上这种情况就是句空话。</p>
              : <p className="scnote">
                走完 36 步，损失从 {L0.toFixed(0)} 降到 <b>{loss.toFixed(3)}</b>
                {reach >= 0 ? `，第 ${reach} 步就降到了初始的 1% 以下` : '，始终没降到初始的 1% 以下'}。
                {kappa === 1
                  ? <> 正圆碗上负梯度直指谷底，一步到位（理论收缩率 0）。把谷换成峡谷 κ=50 再看，同样的算法会变成另一副样子。</>
                  : <> 这个谷的条件数 κ=<b>{kappa}</b>，y 方向横跳了 <b>{zig}</b> 次 ——
                    <b>负梯度并不指向谷底</b>，它指的是"当前最陡"的方向，谷越窄两者差得越远。</>}
                {' '}实测每步收缩 <b>{measRate}</b>
                {kappa > 1 && <>，普通梯度下降的理论最好值是 (κ−1)/(κ+1)=<b>{rateGd}</b>，
                  配套调好的动量能到 (√κ−1)/(√κ+1)=<b>{rateMom}</b> —— <b>κ 开了平方根</b>，
                  这是"峡谷难走"唯一说得清的解药。</>}
                {mom > 0 && !tuned && <>　⚠️ 现在动量是 {momTag} 但<b>步长没跟着配</b>：重球法的最优是一对参数，
                  单拧 β 常常更慢（换成圆碗试试）。想看它真正的本事，把动量拨到"最优（连步长一起配）"。</>}
              </p>)
          : started && <p className="scnote" style={{ opacity: .85 }}>
            梯度指向上升最快的方向，取负号朝下降最快走一步，步长就是学习率。
            {kappa > 1 && ' 注意轨迹在中轴两侧来回跳：谷是斜的、负梯度是正的，两者对不齐，就只能横跳着往前蹭。'}
          </p>}
      </div>
    </div>
  )
}
