/** 舞台：束搜索 —— 每步把 k 条候选各扩一个词、按累积概率排序，只留前 k 条，末了对照贪心 */
import type { BeamState } from '@engine/kernels/beam.ts'
import type { StageProps } from '../types.ts'

const disp = (seq: string) => seq === '' ? '⟨起⟩' : seq.replace('·', '⟨end⟩')

export function BeamStage({ state }: StageProps<BeamState>) {
  const { t, k, beamsIn, cands, kept, best, greedy, showGreedy, act, phase } = state
  const done = phase === 'done'
  const keptSet = new Set(kept)
  const maxP = cands.length ? cands[0].p : 1
  const winner = best
  const ratio = greedy.p > 0 ? Math.round((winner.p / greedy.p) * 10) / 10 : 0
  return (
    <div className="card">
      <h3>束搜索 Beam Search <span className="hint">每步只留最有希望的前 k 条序列</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">k={k}</span><span className="scdl">束宽</span></div>
          <div className="scdk"><span className="scdn">{done ? '完成' : `第 ${t} 步`}</span><span className="scdl">解码步</span></div>
          <div className="scdk"><span className="scdn">{best.p}</span><span className="scdl">当前最优概率</span></div>
        </div>

        {!done && (
          <div className="bmwrap">
            <div className="bmbeams">
              <span className="bmlbl">本步展开前的 {beamsIn.length} 条：</span>
              {beamsIn.map((bm, i) => <span key={i} className="bmchip in">{disp(bm.seq)} <b>{bm.p}</b></span>)}
            </div>
            <div className="bmlbl">各扩一个词 → {cands.length} 条候选（按累积概率排序，保留前 {k} 条绿色，其余剪掉）：</div>
            <div className="bmcands">
              {cands.map((c, i) => {
                const keep = keptSet.has(c.seq)
                return (
                  <div key={i} className={`bmcand ${keep ? 'keep' : 'prune'}`}>
                    <span className="bmseq">{disp(c.seq)}</span>
                    <span className="bmbar"><span className="bmbarfill" style={{ width: `${(c.p / maxP) * 100}%` }} /></span>
                    <span className="bmp">{c.p}</span>
                    <span className="bmtag">{keep ? '✓留' : '剪'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {done && (
          <div className="bmwrap">
            <div className="bmversus">
              <div className="bmwin">
                <span className="bmvlbl">束搜索(k={k})</span>
                <span className="bmvseq">{disp(winner.seq)}</span>
                <span className="bmvp">{winner.p}</span>
              </div>
              <div className="bmvs">{ratio}× ▶</div>
              <div className="bmlose">
                <span className="bmvlbl">贪心(k=1)</span>
                <span className="bmvseq">{disp(greedy.seq)}</span>
                <span className="bmvp">{greedy.p}</span>
              </div>
            </div>
          </div>
        )}

        <div className="orcap">
          {act === '' ? '按「下一步」开始:每步把候选各扩一个词、按累积概率只留前 k 条'
            : done ? `束搜索 ${disp(winner.seq)}(${winner.p}) 胜过贪心 ${disp(greedy.seq)}(${greedy.p})——同时留 ${k} 条,发现了贪心错过的更优整句`
              : `第 ${t} 步:${beamsIn.length} 条各扩一词→${cands.length} 候选,保留 ${kept.map(disp).join('、')}`}
        </div>

        {done
          ? <p className="scnote">一句话的概率=各步词概率<b>连乘</b>。逐词<b>贪心</b>每步只取当前最高,容易掉坑:第一步贪 A(0.5＞0.4)就被锁进平庸的 {disp(greedy.seq)}({greedy.p})。<b>束搜索</b>维护 <b>k 条</b>候选,每步各扩一词、按累积概率只留前 k 条,于是留住了 B,发现 B→C→⟨end⟩ 概率 <b>{winner.p}</b>、近 {ratio} 倍胜出。<b>k=1 就是贪心、k=∞ 就是全搜索</b>,束搜索取中间。机器翻译、摘要、受限生成的标准解码法(配长度归一化等)。</p>
          : <p className="scnote" style={{ opacity: .85 }}>束宽 k=2:每步维护 2 条候选序列。把每条各扩一个词、算累积概率(连乘),所有候选排序后<b>只留前 2 条</b>(绿✓)、其余剪掉。这样既不像贪心那样一条道走到黑,也不像全搜索那样爆炸。</p>}
      </div>
    </div>
  )
}
