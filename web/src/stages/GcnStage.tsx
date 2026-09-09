/**
 * 舞台：图卷积 GCN —— 第 1 层逐节点聚合，之后整层推进。
 *
 * 2026-09-09 补厚。老版本只跑一层，读数里那个「1 跳 / 一层的感受野」是**写死的字符串**，
 * 而正文写着「叠 L 层信息传 L 跳，第 L 层概括它 L 跳内的子图」—— 层数从来没动过。
 *
 * 这一屏的三个落点：
 *   ① **"L 跳"用扰动实验验**：把节点 0 的初始特征 +1，看第 L 层有哪些节点跟着变，
 *      再跟另拿 BFS 算的"L 跳以内"逐个对。绿=跟着变了、灰=没变。
 *   ② **过平滑量出来**：一条「离散度 vs 层数」的曲线，从初始一路塌下去。
 *      「叠得越深看得越远」只说了一半。
 *   ③ **塌成了什么形状**：均值聚合塌成全一样，对称归一化塌成正比于 √度数 ——
 *      离散度没到 0，可残余差别**只反映度数**。别拿"没塌到 0"当"没有过平滑"。
 */
import type { GcnState } from '@engine/kernels/gcn.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const W = 340, H = 200
const heat = (v: number | null, max: number) => v === null ? 'var(--panel)'
  : `color-mix(in srgb, #3b82f6 ${Math.round(Math.min(1, Math.abs(v) / (max || 1)) * 74)}%, var(--panel))`

export function GcnStage({ state }: StageProps<GcnState>) {
  const {
    pos, edges, feat, newFeat, cur, agg, coef, result, layer, layers, spread, spread0,
    graphName, aggName, rows, probeSrc, changed, withinHops, hopsMatch, hopDist,
    depthSweep, deepShape, degShape, shapeGap, limitName, limitShape, infoLost, deepFlat, phase,
  } = state
  const done = phase === 'done'
  const px = (x: number) => 24 + x * (W - 48)
  const py = (y: number) => 20 + y * (H - 40)
  const aggSet = new Set(agg)
  const shown = done ? newFeat : feat.map((f, i) => newFeat[i] ?? f)
  const maxAbs = Math.max(...shown.map(v => Math.abs(v ?? 0)), 0.001)

  //  离散度曲线：横轴对数（1…50）
  const cw = 340, ch = 110, cl = 30, cr = 12, ct = 12, cb = 22
  const lx = (n: number) => cl + (Math.log2(n) / Math.log2(depthSweep[depthSweep.length - 1].layers)) * (cw - cl - cr)
  const ly = (v: number) => ct + (1 - v / (spread0 || 1)) * (ch - ct - cb)

  return (
    <div className="card">
      <h3>图卷积 GCN <span className="hint">每层聚合一次邻居——看得越远，也糊得越平</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk">
            <span className="scdn hot">{cur >= 0 ? `第 ${layer} 层 · 节点 ${cur}` : done ? `${layers} 层完成` : layer > 0 ? `第 ${layer} 层` : graphName}</span>
            <span className="scdl">当前（轴）</span>
          </div>
          <div className="scdk">
            <span className="scdn">{cur >= 0 && !done ? result : '—'}</span>
            <span className="scdl">本节点的新特征</span>
          </div>
          {/*  ⭐ 感受野不再是写死的"1 跳" —— 它跟着层数走，而且是扰动实验验过的 */}
          <div className="scdk">
            <span className="scdn">{layers} 跳</span>
            <span className="scdl">感受野（{hopsMatch ? '扰动实验验过 ✓' : '⚠️ 跟 BFS 对不上'}）</span>
          </div>
          {/*  ⭐ 过平滑：离散度塌下去 */}
          <div className="scdk">
            <span className={`scdn ${spread < spread0 * 0.1 ? 'bad' : ''}`}>{spread}</span>
            <span className="scdl">节点特征离散度（初始 {spread0}）</span>
          </div>
        </div>

        <div className="gcnwrap">
          <svg className="gcntree" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            {edges.map(([a, b], k) => {
              const lit = !done && cur >= 0 && (a === cur || b === cur)
              return <line key={k} x1={px(pos[a].x)} y1={py(pos[a].y)} x2={px(pos[b].x)} y2={py(pos[b].y)}
                stroke={lit ? 'var(--now)' : 'var(--line)'} strokeWidth={lit ? 2.4 : 1.2} />
            })}
            {pos.map((p, v) => {
              const isCur = v === cur && !done
              const inAgg = !done && aggSet.has(v) && v !== cur
              const fv = shown[v]
              //  ⭐ 末帧：绿环 = 扰动节点 0 之后这个节点跟着变了（也就是在感受野内）
              const inField = done && changed[v]
              return (
                <g key={v}>
                  {isCur && <circle cx={px(p.x)} cy={py(p.y)} r="20" fill="none" stroke="var(--now)" strokeWidth="2" />}
                  {inField && <circle cx={px(p.x)} cy={py(p.y)} r="20" fill="none" stroke="var(--hit)" strokeWidth="1.6" strokeDasharray="3 2" />}
                  <circle cx={px(p.x)} cy={py(p.y)} r="15" fill={heat(fv, maxAbs)}
                    stroke={isCur ? 'var(--now)' : inAgg ? 'var(--hit)' : 'var(--line)'} strokeWidth={isCur || inAgg ? 2 : 1} />
                  <text x={px(p.x)} y={py(p.y) - 1} textAnchor="middle" fontSize="7.5" fontWeight={700}
                    fill={Math.abs(fv ?? 0) > maxAbs * 0.5 ? 'var(--panel)' : 'var(--ink)'}>{fv === null ? '' : fv}</text>
                  <text x={px(p.x)} y={py(p.y) + 26} textAnchor="middle" fontSize="7" fill="var(--faint)">
                    节点{v}{done ? `·${hopDist[v] === Infinity ? '∞' : hopDist[v]}跳` : ''}
                  </text>
                </g>
              )
            })}
          </svg>
          {cur >= 0 && !done && (
            <div className="gcncoef">
              聚合系数：{agg.map((u, k) => <span key={u} className="gcnc">{coef[k]}×节点{u}</span>)}
              <span className="dimv">　{aggName.startsWith('对称') ? '（1/√((deg_i+1)(deg_j+1))，各不相同）' : `（都是 1/${agg.length}）`}</span>
            </div>
          )}
          <div className="orcap">{rich(state.log)}</div>
        </div>

        {/*  ⭐ 扰动实验：「第 L 层概括 L 跳内的子图」是验出来的 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>节点</span><span>离节点 {probeSrc} 几跳</span><span>{layers} 跳以内？</span><span>扰动后跟着变了？</span><span></span>
            </div>
            {changed.map((c, k) => (
              <div className={`qsrow ${c !== withinHops[k] ? 'mcpick' : ''}`} key={k}>
                <span>节点 {k}</span>
                <span className="dimv">{hopDist[k] === Infinity ? '不连通' : `${hopDist[k]} 跳`}</span>
                <span className={withinHops[k] ? 'good' : 'dimv'}>{withinHops[k] ? '是' : '否'}</span>
                <span className={c ? 'good' : 'dimv'}>{c ? '变了' : '没变'}</span>
                <span className={c === withinHops[k] ? '' : 'bad'}>{c === withinHops[k] ? '✓' : '✗ 对不上'}</span>
              </div>
            ))}
            <div className="orcap">
              ⭐ 把节点 {probeSrc} 的初始特征 +1，跑完 {layers} 层，看哪些节点的输出跟着变。
              变的那些<b>正好</b>是 {layers} 跳以内的 —— <b>「第 L 层概括它 L 跳内的子图」是这么验出来的，不是一句断言</b>。
              （"L 跳以内"是另拿 <b>BFS</b> 算的，<b>不问 GCN 自己</b>。）
            </div>
          </div>
        )}

        {/*  ⭐ 过平滑：离散度 vs 层数 */}
        {done && (
          <div className="bncurvewrap">
            <div className="bncurve-t">节点特征的<b>离散度</b>（max−min）随<b>层数</b>变化　—— 塌下去的就是"节点之间还剩多少差别"</div>
            <svg className="bncurve" viewBox={`0 0 ${cw} ${ch}`} preserveAspectRatio="none">
              {[0, 0.5, 1].map(v => (
                <g key={v}>
                  <line x1={cl} y1={ly(v * spread0)} x2={cw - cr} y2={ly(v * spread0)} className="bng" vectorEffect="non-scaling-stroke" />
                  <text x={cl - 4} y={ly(v * spread0) + 3} className="bnax" textAnchor="end">{(v * spread0).toFixed(2)}</text>
                </g>
              ))}
              {depthSweep.map(d => <text key={d.layers} x={lx(d.layers)} y={ch - 6} className="bnax" textAnchor="middle">{d.layers}</text>)}
              <polyline points={depthSweep.map(d => `${lx(d.layers)},${ly(d.spread)}`).join(' ')} className="bncurveline" vectorEffect="non-scaling-stroke" />
              {depthSweep.map(d => (
                <g key={d.layers}>
                  <circle cx={lx(d.layers)} cy={ly(d.spread)} r={d.layers === layers ? 4.2 : 2.6} className={d.layers === layers ? 'bndot cur' : 'bndot'} />
                  {d.layers === layers && <text x={lx(d.layers)} y={ly(d.spread) - 8} className="bndotlbl" textAnchor="middle">{d.spread}</text>}
                </g>
              ))}
            </svg>
          </div>
        )}

        {/*  ⭐ 塌成了什么形状 —— 别拿"离散度没到 0"当"没有过平滑" */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>深层（{depthSweep[depthSweep.length - 1].layers} 层）</span>
              <span style={{ textAlign: 'left', gridColumn: 'span 4' }}>归一化之后的形状</span>
            </div>
            <div className="qsrow">
              <span>实际跑出来</span>
              <span style={{ textAlign: 'left', gridColumn: 'span 4' }}>[{deepShape.join(', ')}]</span>
            </div>
            {/*  ⚠️ 这一行必须写**它实际塌向的那个极限**。第一版写死成"正比于 √(度数+1)"，
                 而均值聚合塌向的是"全都一样" —— 于是星形+均值那档印出了"← 几乎重合"，
                 旁边摆着两组差着十万八千里的数。 */}
            <div className="qsrow">
              <span className="dimv">{limitName}</span>
              <span className="dimv" style={{ textAlign: 'left', gridColumn: 'span 4' }}>[{limitShape.join(', ')}]{shapeGap < 0.05 ? '　← 几乎重合' : `　（差 ${shapeGap}）`}</span>
            </div>
            {/*  塌向 √度数 那一档就别再重复印一遍同样的数 */}
            {limitName.startsWith('全都') && (
              <div className="qsrow">
                <span className="dimv">（另一个极限：√(度数+1)）</span>
                <span className="dimv" style={{ textAlign: 'left', gridColumn: 'span 4' }}>[{degShape.join(', ')}]</span>
              </div>
            )}
            <div className="orcap">
              {infoLost
                ? (deepFlat
                  ? <>⚠️ <b>离散度直接塌到了 {depthSweep[depthSweep.length - 1].spread}</b>（初始 {spread0}）——
                    节点之间<b>几乎完全一样</b>。<b>这就是过平滑。</b></>
                  : <>⚠️ <b>别拿"离散度没塌到 0"当"没有过平滑"。</b>这一档深层还剩 {depthSweep[depthSweep.length - 1].spread} 的离散度，
                    可它塌向的是<b>正比于 √(度数+1)</b> 的形状 —— 换一组完全不同的初始特征，跑深了<b>还是这个形状</b>。
                    <b>残余的那点差别只反映度数，跟节点原本携带的信息一点关系都没有。</b>信息一样丢光了，只是丢的方式不同。</>)
                : <>这一档收敛得慢，深层形状跟另一组初始特征还有差别 —— 还没完全丢光。
                  <b>链状图的谱隙小，传得慢也糊得慢</b>；换成星形那张就快得多。</>}
            </div>
          </div>
        )}

        <p className="scnote">
          社交网络、分子、知识图谱都是<b>图</b> —— 节点数不定、邻居数还不一样，普通网络吃不了。
          <b>图卷积 GCN</b> 让每个节点<b>聚合邻居的信息</b>更新自己：一层就是把<b>自己 + 所有邻居</b>的特征加权平均
          （真实 GCN 还要再乘一个可学权重 W、过激活）。叠 L 层，信息传 L 跳。
          <br />
          <b>而"叠得越深看得越远"只说了一半。</b>聚合的本质是<b>跟邻居取平均</b>：
          取一次是"融合邻域信息"，取很多次就是<b>把整张图抹平</b>。
          节点分类要的是"不同节点长得不一样"，而深层 GCN 恰恰把这个抹没了 —— <b>这就是过平滑（over-smoothing）</b>。
          <b>所以实践中的 GCN 大多只有 2~3 层</b>：不是算不动，是<b>再深就没信息了</b>。
          （缓解办法有残差连接、跳跃连接、PairNorm 之类，这一屏没做。）
          <br />
          <b>同样的层数，在不同的图上"深"的程度完全不同</b>：链状图上信息一层只走一跳，5 个点要 4 层才通到头；
          星形图上任意两点最多 2 跳，<b>一层就糊、两层基本平了</b>。
          <br />
          这一屏只做了聚合那一半、没做可学权重 W —— 因为<b>过平滑是聚合本身带来的，跟 W 无关</b>。
          GCN 是<b>节点分类、推荐、分子性质预测</b>的核心，和词向量、注意力同属"表示学习"。
        </p>
      </div>
    </div>
  )
}
