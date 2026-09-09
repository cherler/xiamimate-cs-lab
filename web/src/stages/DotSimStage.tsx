/**
 * 舞台：内积 = 相似度 —— a 固定、b 转角，内积 = |a||b|cosθ 从最大 → 0 → 最负。
 *
 * 2026-09-09 补厚。老版本是 2 维、5 个手挑角度，而正文写着两句从没兑现过的话：
 *   ①「无关方向内积≈0（**高维近正交**）」—— 2 维里这句话根本不成立。
 *   ②「内积同时编码**长度**和**夹角**」—— 长度写死 3 和 2，从来没打过架。
 *
 * 这一屏加了两块：
 *   ⭐ **高维近正交量出来**：各档维度抽 2000 对随机向量，余弦的标准差跟 1/√d 并排。
 *      d=2 时有 66% 的机会 |余弦|>0.5 —— "随机方向几乎正交"在低维是**假的**。
 *   ⭐ **检索排名对照**：原始内积 vs 余弦。**原始内积会系统性偏爱模长大的向量**，
 *      方向最准的 D1 被排到第 5 —— 这就是向量检索里的"长文档偏置"。
 */
import type { DotSimState } from '@engine/kernels/dotsim.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const SC = 14                  // 世界 → 像素
const OX = 60, OY = 60         // 原点在 viewBox 里的位置
const px = (x: number) => OX + x * SC
const py = (y: number) => OY - y * SC

export function DotSimStage({ state }: StageProps<DotSimState>) {
  const {
    angleDeg, ax, ay, bx, by, dot, magA, magB, cosSim, proj, phase,
    dim, scoreName, ortho, orthoNow, docs, topDot, topCos,
  } = state
  const done = phase === 'done'
  const useCos = scoreName.startsWith('余弦')
  const started = angleDeg >= 0
  // 投影点在 a 方向（a 沿 +x），投影长度 = proj
  const projX = proj
  const ppos = ((cosSim + 1) / 2) * 100
  return (
    <div className="card">
      <h3>内积 = 相似度 <span className="hint">注意力凭什么用 Q·K 打分</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? `${angleDeg}°` : '—'}</span><span className="scdl">夹角 θ</span></div>
          <div className="scdk"><span className="scdn hot">{started ? dot.toFixed(2) : '—'}</span><span className="scdl">内积 a·b</span></div>
          <div className="scdk"><span className="scdn">{started ? cosSim.toFixed(2) : '—'}</span><span className="scdl">余弦相似度</span></div>
          {/*  ⭐ 高维近正交：随机方向的余弦有多集中在 0 —— 实测 vs 理论 1/√d */}
          <div className="scdk">
            <span className="scdn hot">{orthoNow.sd}</span>
            <span className="scdl">d={dim} 时随机方向余弦的标准差（理论 1/√d={orthoNow.theory}）</span>
          </div>
          <div className="scdk">
            <span className={`scdn ${orthoNow.bigFrac > 0.1 ? 'bad' : 'good'}`}>{(orthoNow.bigFrac * 100).toFixed(1)}%</span>
            <span className="scdl">随便抓两个方向，|余弦|&gt;0.5 的比例</span>
          </div>
        </div>

        <div className="dswrap">
          <svg className="dsplot" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet">
            {/* 轴 */}
            <line x1="6" y1={OY} x2="114" y2={OY} className="dsaxis" />
            <line x1={OX} y1="6" x2={OX} y2="114" className="dsaxis" />
            {/* 投影：b 尖到 a 的垂线 + a 上的投影段 */}
            {started && (
              <>
                <line x1={px(bx)} y1={py(by)} x2={px(projX)} y2={py(0)} className="dsproj" />
                <line x1={OX} y1={OY} x2={px(projX)} y2={py(0)} className="dsprojseg" />
              </>
            )}
            {/* a 向量 */}
            <line x1={OX} y1={OY} x2={px(ax)} y2={py(ay)} className="dsvec a" markerEnd="url(#ds-a)" />
            {/* b 向量 */}
            {started && <line x1={OX} y1={OY} x2={px(bx)} y2={py(by)} className="dsvec b" markerEnd="url(#ds-b)" />}
            <text x={px(ax) + 2} y={py(ay) + 4} className="dslab a">a</text>
            {started && <text x={px(bx) + (bx < 0 ? -8 : 2)} y={py(by) - 2} className="dslab b">b</text>}
            <defs>
              <marker id="ds-a" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--dim)" /></marker>
              <marker id="ds-b" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--now)" /></marker>
            </defs>
          </svg>

          {/* 余弦相似度尺 */}
          <div className="dsmeter">
            <span className="dsmend">−1<br /><i>反向</i></span>
            <div className="dsmtrack">
              <span className="dsmmid" />
              {started && <span className="dsmmark" style={{ left: `${ppos}%` }}>▲</span>}
            </div>
            <span className="dsmend r">+1<br /><i>同向</i></span>
          </div>
          <div className="orcap">
            {started ? `a·b = |a||b|cosθ = ${magA}×${magB}×${(cosSim).toFixed(2)} = ${dot.toFixed(2)}；也 = |a| × (b 在 a 上的投影 ${proj.toFixed(2)})`
              : '按「下一步」让 b 从与 a 同向转到反向'}
            <br />
            {/*  ⚠️ 这张图在任何维度下都长一样 —— 两个向量只张成一个平面 */}
            <span className="dimv">
              ⚠️ 这张图<b>跟维度无关</b>：两个向量不管在几维空间里，都只张成一个平面，夹角和内积就在那个平面里算。
              <b>维度真正影响的是下面那批随机向量。</b>
            </span>
          </div>
        </div>

        <div className="orcap">{rich(state.log)}</div>

        {/*  ⭐ 高维近正交：抽出来的，不是断言 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>维度 d</span><span>余弦均值</span><span>实测标准差</span><span>理论 1/√d</span><span>|余弦|&gt;0.5 的比例</span>
            </div>
            {ortho.map(x => (
              <div className={`qsrow ${x.d === dim ? 'mcpick' : ''}`} key={x.d}>
                <span>{x.d}{x.d === dim ? ' ◀' : ''}</span>
                <span className="dimv">{x.mean}</span>
                <span className="good">{x.sd}</span>
                <span className="dimv">{x.theory}</span>
                <span className={x.bigFrac > 0.1 ? 'bad' : 'good'}>{(x.bigFrac * 100).toFixed(1)}%</span>
              </div>
            ))}
            <div className="orcap">
              每档抽 <b>{orthoNow.n}</b> 对随机向量量出来的 —— <b>实测标准差跟 1/√d 逐档对得上</b>，
              这不是我算的公式，是抽出来的。
              <br />
              ⚠️ <b>「随机方向几乎正交」在低维是假的</b>：d=2 时随便抓两个方向，
              有 <b>{(ortho[0].bigFrac * 100).toFixed(0)}%</b> 的机会余弦超过 0.5；
              而 d={ortho[ortho.length - 1].d} 时这个比例是 <b>{(ortho[ortho.length - 1].bigFrac * 100).toFixed(1)}%</b>。
              大模型的 embedding 动辄几百上千维，靠的就是这个 —— <b>不相关的东西能稳稳地打出接近 0 的分</b>。
            </div>
          </div>
        )}

        {/*  ⭐ 检索排名对照：原始内积偏爱模长大的 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>文档</span><span>模长</span><span>余弦</span><span>内积 = 模长×余弦</span><span>内积排 / 余弦排</span>
            </div>
            {docs.map(x => (
              <div className={`qsrow ${x.rankDot !== x.rankCos ? 'mcpick' : ''}`} key={x.name}>
                <span>{x.name}</span>
                <span className="dimv">{x.mag}</span>
                <span className={x.rankCos === 1 ? 'good' : 'dimv'}>{x.cos}</span>
                <span className={x.rankDot === 1 ? 'good' : ''}>{x.dot}</span>
                <span className={x.rankDot !== x.rankCos ? 'bad' : 'dimv'}>第 {x.rankDot} / 第 {x.rankCos}</span>
              </div>
            ))}
            <div className="orcap">
              一个 query（单位向量）打 6 个"文档"向量，所以 a·b = 模长 × 余弦。
              <b>按原始内积排第一的是「{topDot}」，按余弦排第一的是「{topCos}」。</b>
              <br />
              ⚠️ <b>原始内积会系统性地偏爱模长大的向量。</b>
              D4 方向差得远（余弦才 0.30），可它够长（模长 4.0），内积就把方向最准的
              D1（余弦 0.95、模长只有 1.0）压到了第 {docs.find(x => x.name.startsWith('D1'))?.rankDot} 名。
              <b>这就是向量检索里的"长文档偏置"</b> —— 也是为什么实践中普遍要<b>先归一化再算内积</b>（那就是余弦）。
              <br />
              当前口径：<b>{scoreName}</b>{useCos ? '　（长度已经除掉了）' : '　（长度还在里面，所以有上面那个偏置）'}。
            </div>
          </div>
        )}

        {done
          ? <p className="scnote">
            内积 <b>a·b = |a||b|cosθ</b>。长度固定时它纯粹量"<b>方向多一致</b>"：同向最大、正交为 0、反向最负。
            这就是<b>注意力用 Q·K 打分</b>的根据 —— query 与 key 越方向一致（相关），内积越大、softmax 权重越高。
            <br />
            <b>而"无关的方向内积≈0"这句话，得高维才成立。</b>上面那张表是抽 {orthoNow.n} 对随机向量量出来的：
            余弦的标准差 ≈ <b>1/√d</b>，维度一高，随机方向之间几乎必然接近垂直。
            <b>在 2 维里这句话是假的</b>（66% 的机会 |余弦| 超过 0.5）—— 老版本这一屏就是 2 维的，
            "高维近正交"从来没发生过。
            <br />
            <b>还有一件事：内积同时编码了长度和夹角，而这在检索里是个坑。</b>
            "内积 = 相似度"要加一个前提：<b>长度得先处理掉</b>。归一化掉长度就是<b>余弦相似度</b> cosθ ∈ [−1,1] ——
            纯方向的相似度。检索、推荐、词向量类比，用的都是它。
          </p>
          : started && <p className="scnote" style={{ opacity: .85 }}>
            看 b 尖投到 a 上的那一段：内积 = |a| × 这个投影。b 越"倒向 a"投影越长、内积越大；
            转到垂直（90°）投影为 0、内积为 0；继续转过去投影变负、内积变负。
            <br />
            <b>盯着读数里那两格</b>：d={dim} 时随机方向余弦的标准差是 {orthoNow.sd}，
            |余弦|&gt;0.5 的只有 {(orthoNow.bigFrac * 100).toFixed(1)}% —— <b>那才是"高维近正交"的意思</b>。
          </p>}
      </div>
    </div>
  )
}
