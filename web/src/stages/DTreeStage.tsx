/**
 * 舞台：决策树 —— 每步在候选切法里"搜"出不纯度下降最大的一刀，再落刀切纯。
 *
 * 补厚之后这一屏有两块主角：
 * ① 平面上的**留出点**（空心）跟训练点（实心）画在一起 —— 树是照着实心点切的，
 *    而好不好只能问空心点。屏幕上看得见"哪些空心点落错了格子"。
 * ② 底下的**深度曲线**：训练准确率一路涨、留出准确率**先升后降**（噪声档）
 *    或者**升到一个天花板就上不去**（对角档）。三档数据在这条曲线上长得完全不同。
 */
import type { DTreeState } from '@engine/kernels/dtree.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const CA = 'var(--now)', CB = 'var(--miss)'
const LO = -3, HI = 3
const px = (x: number) => (x - LO) / (HI - LO) * 100
const py = (y: number) => 100 - (y - LO) / (HI - LO) * 100
const pct = (v: number) => (v * 100).toFixed(1) + '%'

export function DTreeStage({ state }: StageProps<DTreeState>) {
  const {
    phase, points, holdout, cands, nCands, best, splits, leaves, curGini, depth,
    nodeBox, nodeN, trainAcc, testAcc, overfit, maxLeaves, finalDepth,
    dataKind, impurity, depthCap, sameAsOther, sweep, bestDepth, ceiling, declineAfterPeak,
  } = state
  const searching = phase === 'search'
  const done = phase === 'done'
  const maxGain = Math.max(...cands.map(c => c.gain), 0.001)
  const candLine = (c: { feat: 'x' | 'y'; t: number }) => c.feat === 'x'
    ? { x1: px(c.t), y1: 0, x2: px(c.t), y2: 100 }
    : { x1: 0, y1: py(c.t), x2: 100, y2: py(c.t) }

  return (
    <div className="card">
      <h3>决策树 <span className="hint">搜出不纯度下降最大的一刀，再落刀切纯</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{splits.length}</span><span className="scdl">已落几刀</span></div>
          <div className="scdk"><span className="scdn hot">{curGini}</span><span className="scdl">当前{impurity}不纯度</span></div>
          <div className="scdk"><span className="scdn good" style={{ fontSize: '13px' }}>{best ? `${best.feat}<${best.t}` : '—'}</span><span className="scdl">{best ? `选中·增益 ${best.gain}` : '选中的刀'}</span></div>
          <div className="scdk"><span className="scdn">{leaves.length}/{maxLeaves}</span><span className="scdl">叶子（终深 {finalDepth}）</span></div>
          {/*  ⭐ 补厚的落点：训练准确率单看没有意义，它旁边必须站着留出准确率 */}
          <div className="scdk"><span className="scdn">{pct(trainAcc)}</span><span className="scdl">训练准确率</span></div>
          <div className="scdk">
            <span className={`scdn ${overfit > 0.08 ? 'bad' : 'good'}`}>{pct(testAcc)}</span>
            <span className="scdl">留出准确率（差 {(overfit * 100).toFixed(1)}pp）</span>
          </div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            {leaves.map((lf, k) => (
              <rect key={k} x={px(lf.box[0])} y={py(lf.box[3])} width={px(lf.box[2]) - px(lf.box[0])} height={py(lf.box[1]) - py(lf.box[3])}
                fill={lf.c === 0 ? CA : CB} opacity="0.1" />
            ))}
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 正在处理的那一块 */}
            {nodeBox && !done && (
              <rect x={px(nodeBox[0])} y={py(nodeBox[3])} width={px(nodeBox[2]) - px(nodeBox[0])} height={py(nodeBox[1]) - py(nodeBox[3])}
                className="dtnode" vectorEffect="non-scaling-stroke" />
            )}
            {searching && cands.map((c, k) => {
              const l = candLine(c)
              const isBest = best && c.feat === best.feat && c.t === best.t
              return <line key={`c${k}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className={isBest ? 'dtcand best' : 'dtcand'} vectorEffect="non-scaling-stroke" />
            })}
            {splits.map((sp, k) => (
              <line key={k} x1={px(sp.seg[0])} y1={py(sp.seg[1])} x2={px(sp.seg[2])} y2={py(sp.seg[3])} className="dtcut" vectorEffect="non-scaling-stroke" />
            ))}
            {/*  留出点画成空心小圈：树没见过它们。
                只在建完之后画 —— 建树过程中掺进来会让人以为它们也参与了切刀。 */}
            {done && holdout.slice(0, 120).map((p, k) => (
              <circle key={`h${k}`} cx={px(p.x)} cy={py(p.y)} r="1.1" fill="none"
                stroke={p.c === 0 ? CA : CB} strokeWidth="0.5" opacity="0.55" vectorEffect="non-scaling-stroke" />
            ))}
            {points.map((p, k) => (
              <circle key={k} cx={px(p.x)} cy={py(p.y)} r="1.7" fill={p.c === 0 ? CA : CB} opacity="0.92" />
            ))}
          </svg>
        </div>

        {searching && cands.length > 0 && (
          <div className="dtsearch">
            <div className="dtsearch-t">这一块 {nodeN} 个点，搜候选切法（共 {nCands} 个，按{impurity}下降取最大）：</div>
            {cands.map((c, k) => {
              const isBest = best && c.feat === best.feat && c.t === best.t
              return (
                <div key={k} className={`dtcandrow ${isBest ? 'best' : ''}`}>
                  <span className="dtcr-lbl">{c.feat} &lt; {c.t}</span>
                  <span className="dtcr-bar"><span className="dtcr-fill" style={{ width: `${(c.gain / maxGain) * 100}%` }} /></span>
                  <span className="dtcr-g">增益 {c.gain}</span>
                  <span className="dtcr-mk">{isBest ? '★ 选它' : ''}</span>
                </div>
              )
            })}
          </div>
        )}

        {/*  深度曲线：每个深度各建一棵，只算准确率。
             训练那条一路涨；留出那条才是"学会了没有"的唯一凭据。 */}
        <div className="qsscale">
          <div className="qsrow qshead"><span>深度</span><span>叶子</span><span>训练</span><span>留出</span><span>差</span></div>
          {sweep.map(r => (
            <div className="qsrow" key={r.depth}>
              <span>{r.depth}{depthCap === r.depth ? ' ◀' : ''}</span>
              <span className="dimv">{r.leaves}</span>
              <span className="dimv">{pct(r.train)}</span>
              <span className={r.depth === bestDepth ? 'good' : r.train - r.test > 0.15 ? 'bad' : ''}>{pct(r.test)}</span>
              <span className={r.train - r.test > 0.15 ? 'bad' : 'dimv'}>{((r.train - r.test) * 100).toFixed(1)}</span>
            </div>
          ))}
          <div className="orcap">
            留出最高在<b>深 {bestDepth}</b>（{pct(ceiling)}）
            {declineAfterPeak > 0.02
              ? <>，之后一路掉到 {pct(sweep[sweep.length - 1].test)} —— <b className="bad">越切越差 {(declineAfterPeak * 100).toFixed(1)}pp</b></>
              : ceiling < 0.97
                ? <>，再深也上不去 —— <b>天花板是形状带来的，加深度补不上</b></>
                : <>，之后既不升也不降 —— <b>刀刚好够用</b></>}
          </div>
        </div>

        <div className="orcap">{rich(state.log)}</div>

        {done && (
          <p className="scnote">
            <b>树是照着实心点切的，好不好只能问空心点。</b>实心 = {points.length} 个训练点（切刀只看它们），
            空心 = 留出点（建树时一个都没看过）。当前档「{dataKind}」用「{impurity}」当不纯度、
            {depthCap > 0 ? `深度上限 ${depthCap}` : '不限深度'}：训练 <b>{pct(trainAcc)}</b>、留出 <b>{pct(testAcc)}</b>。
            <br />
            换成另一种不纯度指标，根节点选的那一刀{sameAsOther ? <b>一模一样</b> : <b>会变</b>} ——
            两种指标形状不同（熵的峰更尖），但排候选时结论常常一致。这一条是量出来的，不用背。
            <br />
            深 {finalDepth}、{maxLeaves} 个叶子。每条路径就是一串 if-else，天生<b>可解释</b>；
            多刀轴对齐拼出非线性边界。它是<b>随机森林、GBDT</b> 的积木。
          </p>
        )}
      </div>
    </div>
  )
}
