/**
 * 舞台：线性注意力 —— 每一档 N 都**真的把两种注意力都算一遍**，再比输出、比尖锐度、比算量。
 *
 * 2026-09-09 补厚。老版本从头到尾只有 2N²d 和 2Nd² 两个式子在换 N，
 * **一次注意力都没算过**，而正文写着「φ 是近似、拿**一点精度**换算量」——
 * **"一点"是多少，从来没量过**。
 *
 * 这一屏的三个落点：
 *   ① **"一点精度"是个数**：输出的相对误差，逐档摆出来（实测 0.47~0.79，不是"一点"）。
 *   ② ⭐ **真正丢的是"尖锐"**：softmax 里的 exp 是个放大器，能把权重几乎全压到一个 token 上；
 *      φ(q)·φ(k) 归一化后平坦得多。两条注意力分布**并排画**，旁边摆最大权重和熵。
 *   ③ **公式先跟实测对账**：2N²d / 2Nd² 拿真数出来的乘加次数核一遍，然后才敢往 N=32768 外推。
 */
import type { LinAttnState } from '@engine/kernels/linattn.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const fmt = (x: number) => x >= 1e9 ? (x / 1e9).toFixed(1) + 'G' : x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'K' : `${Math.round(x)}`

export function LinAttnStage({ state }: StageProps<LinAttnState>) {
  const {
    d, n, row, rows, big, formulaOK, assocErr, assocMacFast, assocMacNaive,
    recErr, stateSize, smW, linW, crossoverN, phiName, taskName, target, phase,
  } = state
  const started = n > 0
  const done = phase === 'done'
  const isRetrieve = taskName.startsWith('一个键')
  const bigLast = big[big.length - 1]

  //  注意力分布并排：横轴是 key 下标，纵轴是权重
  const W = 320, H = 74, pl = 4, pb = 12
  const bw = smW.length ? (W - pl * 2) / smW.length : 0
  const wmax = Math.max(...smW, ...linW, 0.01)

  return (
    <div className="card">
      <h3>线性注意力 <span className="hint">把 O(N²) 压成 O(N)——代价不只是"一点误差"</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? n : '—'}</span><span className="scdl">序列长度 N（d={d}）</span></div>
          {/*  ⭐ "一点精度"是个数 */}
          <div className="scdk">
            <span className={`scdn ${row.err > 0.3 ? 'bad' : ''}`}>{started ? row.err : '—'}</span>
            <span className="scdl">输出的相对误差（"一点精度"）</span>
          </div>
          {/*  ⭐ 真正丢的是"尖锐" */}
          <div className="scdk">
            <span className="scdn hot">{started ? row.smMax : '—'}</span>
            <span className="scdl">softmax 的最大注意力权重</span>
          </div>
          <div className="scdk">
            <span className={`scdn ${started && row.linMax < row.smMax / 3 ? 'bad' : ''}`}>{started ? row.linMax : '—'}</span>
            <span className="scdl">线性的最大权重（尖不尖锐）</span>
          </div>
          {isRetrieve && (
            <div className="scdk">
              <span className={`scdn ${started && row.linHit < row.smHit / 3 ? 'bad' : ''}`}>
                {started ? `${row.smHit} / ${row.linHit}` : '—'}
              </span>
              <span className="scdl">给目标 key #{target} 的权重（softmax / 线性）</span>
            </div>
          )}
          <div className="scdk">
            <span className="scdn">{started ? `${fmt(row.smMac)} / ${fmt(row.linMac)}` : '—'}</span>
            <span className="scdl">乘加次数（真数出来的）</span>
          </div>
        </div>

        {/*  ⭐ 两条注意力分布并排 —— "尖锐"这件事得看得见 */}
        {started && smW.length > 0 && (
          <div className="bncurvewrap">
            <div className="bncurve-t">
              q₀ 那一行的注意力分布：<b className="lasm">softmax</b>（熵 {row.smEnt}）
              vs <b className="lalin">线性</b>（熵 {row.linEnt}）　—— <b>越尖锐熵越小</b>
              {isRetrieve && <>　目标 key 是 <b>#{target}</b></>}
            </div>
            <svg className="bncurve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <line x1={pl} y1={H - pb} x2={W - pl} y2={H - pb} className="bng" vectorEffect="non-scaling-stroke" />
              {smW.map((w, k) => (
                <g key={k}>
                  <rect x={pl + k * bw} y={(H - pb) - (w / wmax) * (H - pb - 4)}
                    width={Math.max(0.8, bw * 0.42)} height={(w / wmax) * (H - pb - 4)}
                    className={`labar sm ${k === target ? 'tgt' : ''}`} />
                  <rect x={pl + k * bw + bw * 0.5} y={(H - pb) - (linW[k] / wmax) * (H - pb - 4)}
                    width={Math.max(0.8, bw * 0.42)} height={(linW[k] / wmax) * (H - pb - 4)}
                    className={`labar lin ${k === target ? 'tgt' : ''}`} />
                </g>
              ))}
              {target >= 0 && (
                <text x={pl + target * bw + bw / 2} y={H - 3} className="bnax" textAnchor="middle">#{target}</text>
              )}
            </svg>
          </div>
        )}

        <div className="orcap">{rich(state.log)}</div>

        {/*  ⭐ 真算过的那几档：误差 + 尖锐度 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>N</span><span>输出相对误差</span><span>最大权重 sm / 线性</span><span>熵 sm / 线性</span>
              <span>{isRetrieve ? '给目标 key 的权重' : '乘加次数 sm / 线性'}</span>
            </div>
            {rows.map(r => (
              <div className={`qsrow ${r.n === n ? 'mcpick' : ''}`} key={r.n}>
                <span>{r.n}{r.n === n ? ' ◀' : ''}</span>
                <span className={r.err > 0.3 ? 'bad' : ''}>{r.err}</span>
                <span><b>{r.smMax}</b><span className="dimv"> / {r.linMax}</span></span>
                <span className="dimv">{r.smEnt} / {r.linEnt}</span>
                <span className={isRetrieve && r.linHit < r.smHit / 3 ? 'bad' : 'dimv'}>
                  {isRetrieve ? `${r.smHit} / ${r.linHit}` : `${fmt(r.smMac)} / ${fmt(r.linMac)}`}
                </span>
              </div>
            ))}
            <div className="orcap">
              ⭐ <b>正文里那句"拿一点精度换算量"，"一点"就是「输出相对误差」这一列</b> ——
              实测 {rows[0].err} ~ {rows[rows.length - 1].err}，<b>这可不叫"一点"</b>。
              <br />
              ⚠️ <b>而误差还不是重点，真正丢掉的是"尖锐"。</b>
              softmax 里的 <b>exp</b> 是个放大器：分数稍微高一点，权重就压倒性地高；
              而 φ(q)·φ(k) 归一化之后<b>平坦得多</b>（熵大了 {(rows[rows.length - 1].linEnt - rows[rows.length - 1].smEnt).toFixed(2)} bit）。
              {isRetrieve && <>
                <br />
                这一档 q₀ 特意对准了第 {target} 个 key：<b>softmax 给它 {rows.find(r => r.n === 64)?.smHit} 的权重，线性只给 {rows.find(r => r.n === 64)?.linHit}</b>（N=64 那一行）——
                <b>softmax 能把注意力几乎全压到那一个 token 上，线性压不上去。</b>
                这就是它在"上下文里精确检索一条信息"上打不过 softmax 的原因，
                也是各种线性注意力变体（加门控、加衰减、混合几层 softmax）反复在补的那个洞。
              </>}
            </div>
          </div>
        )}

        {/*  ⭐ 结合律 + RNN 递推：两句话各验一遍 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead"><span>验的是哪句话</span><span>做法</span><span>输出差多少</span><span>算量 / 显存</span><span></span></div>
            <div className="qsrow">
              <span>"利用结合律"</span>
              <span className="dimv">φ(Q)(φ(K)ᵀV) vs (φ(Q)φ(K)ᵀ)V</span>
              <span className="good">{assocErr}</span>
              <span>{fmt(assocMacFast)} vs {fmt(assocMacNaive)}（差 {(assocMacNaive / assocMacFast).toFixed(0)} 倍）</span>
              <span />
            </div>
            <div className="qsrow">
              <span>"RNN 式递推"</span>
              <span className="dimv">逐 token 更新固定状态</span>
              <span className="good">{recErr}</span>
              <span>状态 d²+d = {stateSize} 个数（<b>跟 N 无关</b>）</span>
              <span />
            </div>
            <div className="orcap">
              两种乘法顺序<b>给的是同一个答案</b>（差 {assocErr}，浮点误差量级），可算量差 {(assocMacNaive / assocMacFast).toFixed(0)} 倍 ——
              <b>这才是"利用结合律"那句话的证据</b>，而不是一句听着有道理的话。
              <br />
              逐 token 递推的结果跟一次性算的<b>一样</b>（差 {recErr}），而状态是<b>固定 {stateSize} 个数</b> ——
              所以解码时每来一个 token 只要 O(1) 更新、显存恒定，<b>告别不断膨胀的 KV 缓存</b>。
            </div>
          </div>
        )}

        {/*  规模外推：公式已核对 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>N（公式外推）</span><span>softmax 算量</span><span>线性算量</span><span>差几倍</span><span>KV 缓存 vs 固定状态</span>
            </div>
            {big.map(b => (
              <div className="qsrow" key={b.n}>
                <span>{b.n}</span>
                <span className="bad">{fmt(b.smFlops)}</span>
                <span className="good">{fmt(b.linFlops)}</span>
                <span>{b.ratio}×</span>
                <span className="dimv">{fmt(b.kvMem)} vs {fmt(b.stateMem)}</span>
              </div>
            ))}
            <div className="orcap">
              ⚠️ 这几档<b>没有真算</b>，用的是公式 2N²d / 2Nd²。
              <b>但那两个式子先拿上面真算过的几档核对过了</b>：
              {formulaOK
                ? <> 乘加次数<b>逐档一模一样 ✓</b> —— <b>这是测量确认过的公式，不是拿公式代替测量。</b></>
                : <> ⚠️ <b>对不上</b> —— 那这张外推表就不能信。</>}
              <br />
              交叉点在 <b>N = d = {crossoverN}</b>：N 短的时候 softmax 反而更省，N 一长线性完胜
              （N={bigLast.n} 时算量差 {bigLast.ratio}×、显存差 {(bigLast.kvMem / bigLast.stateMem).toFixed(0)}×）。
            </div>
          </div>
        )}

        <p className="scnote">
          标准注意力 = softmax(QKᵀ)·V：要先算 <b>N×N</b> 的注意力矩阵，<b>算量 O(N²)</b>；
          自回归生成还要把每个 token 的 K、V 都存下来（<b>KV 缓存 O(N)</b>，随上下文线性增长）。
          <br />
          线性注意力换个核函数 φ（这一档是 <b>{phiName}</b>），把 softmax(QKᵀ)V 近似成 <b>φ(Q)·(φ(K)ᵀ·V)</b> ——
          <b>利用矩阵乘法结合律</b>先算括号里那个 <b>d×d 的状态</b>（它概括了全部历史），再让 φ(Q) 去乘它。
          于是算量 <b>O(N·d²)</b>、显存 <b>O(d²)</b>（跟序列多长无关），解码变成 <b>RNN 式递推</b>。
          <br />
          <b>而这一屏真正要说的是代价。</b>老版本这里只有两个式子在换 N，一次注意力都没算过，
          正文写着"拿<b>一点</b>精度换算量" —— 现在两种注意力都真算了：
          <b>输出的相对误差是 {rows[0].err}~{rows[rows.length - 1].err}，这不叫"一点"</b>。
          <br />
          <b>更要紧的是：丢掉的不是"精度"，是"尖锐"。</b>
          {/*  ⚠️ 这两个数得跟着当前档走。写死成 1.0 / 0.034（检索档的数）的话，
               换到「随机键值」那一档就跟旁边的表打架了（那儿最大权重只有 0.527）。 */}
          softmax 里的 exp 是个放大器，能把权重压到一个 token 上（这几档里最大权重到过 <b>{Math.max(...rows.map(r => r.smMax))}</b>）；
          而 φ(q)·φ(k) 归一化后平坦得多（同一档只有 <b>{rows.find(r => r.smMax === Math.max(...rows.map(x => x.smMax)))?.linMax}</b>）。
          <b>"在上下文里精确检索一条信息"正是线性注意力打不过 softmax 的地方</b> ——
          这也是各种变体（门控、衰减、混合几层 softmax）反复在补的那个洞。
          <br />
          这是长上下文推理引擎绕不开的一条路，<b>但它换来的不只是"一点误差"</b>。
        </p>
      </div>
    </div>
  )
}
