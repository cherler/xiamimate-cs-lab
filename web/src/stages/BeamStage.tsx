/**
 * 舞台：束搜索 —— 每步把 k 条候选各扩一个词、按分数排序，只留前 k 条。
 *
 * 补厚后这一屏的落点在底下那张 **k 扫描表**：它把「找到的概率」和**「输出长度」**并排。
 * 在「长度偏置」那张模型上两条线是**打架**的 —— k 越大分数越高，而输出越短越空洞。
 * 束搜索最有名的毛病就在这儿，长度归一化正是为它打的补丁。
 */
import type { BeamState } from '@engine/kernels/beam.ts'
import type { StageProps } from '../types.ts'

const disp = (seq: string) => seq === '' ? '⟨起⟩' : seq.replace('·', '⟨end⟩')

export function BeamStage({ state }: StageProps<BeamState>) {
  const {
    t, k, beamsIn, cands, kept, best, greedy, showGreedy, act, phase,
    modelName, scoreKind, optimal, topProb, isOptimal, totalSeqs, kSweep, shrinks,
  } = state
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
          <div className="scdk"><span className="scdn">{done ? best.len : '—'}</span><span className="scdl">输出长度（词）</span></div>
          {/*  ⭐ 「找到最优了吗」不能问算法自己 —— 另穷举全部序列算一份真值 */}
          <div className="scdk">
            <span className={`scdn ${done ? (isOptimal ? 'good' : 'bad') : ''}`}>{done ? (isOptimal ? '追平' : '没找到') : '—'}</span>
            <span className="scdl">对比全搜最优（{totalSeqs} 条）</span>
          </div>
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

        {/*  k 扫描：把「找到的概率」和「输出长度」并排 —— 两条线打架的地方就是长度偏置 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead"><span>束宽 k</span><span>选中的序列</span><span>概率</span><span>长度（词）</span><span>＝全搜最优?</span></div>
            {kSweep.map(r => (
              <div className="qsrow" key={r.k}>
                <span>{r.k}{r.k === k ? ' ◀' : ''}{r.k === 1 ? ' 贪心' : ''}</span>
                <span>{disp(r.seq)}</span>
                <span className="dimv">{r.p}</span>
                <span className={shrinks && r.len < kSweep[0].len ? 'bad' : ''}>{r.len}</span>
                <span className={r.optimal ? 'good' : 'dimv'}>{r.optimal ? '是' : '否'}</span>
              </div>
            ))}
            <div className="orcap">
              同一模型、同一打分口径，四个束宽各跑一遍。
              {shrinks
                ? <>　⚠️ <b className="bad">概率那一列在涨，而长度那一列在缩</b> —— 两条线打架。</>
                : <>　长度没有随 k 变短。</>}
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
          ? (
            <p className="scnote">
              这一趟（k={k}、{scoreKind}）选中「{disp(best.seq)}」概率 <b>{best.p}</b>、<b>长 {best.len} 个词</b>；
              贪心（k=1）给出「{disp(greedy.seq)}」{greedy.p}、长 {greedy.len}；
              穷举全部 {totalSeqs} 条序列的最优是「{disp(optimal.seq)}」{optimal.p} ——
              这一趟<b className={isOptimal ? 'good' : 'bad'}>{isOptimal ? '追平了最优' : '没找到最优'}</b>。
              <br />
              {shrinks
                ? <>⚠️ <b>盯底下那张表的「长度」那一列：k 越大，输出越短</b>（{kSweep[0]?.len} → {kSweep[kSweep.length - 1]?.len} 个词）。
                  这不是 bug，是"整句概率最大"这个目标本身的毛病：一句话的概率是各步概率<b>连乘</b>，
                  <b>每多一个词就再乘一个小于 1 的数</b> —— 越短的序列概率天生越高。
                  这张模型上概率最高的是「{disp(topProb.seq)}」（{topProb.p}，长 {topProb.len}），
                  而贪心那条反而更长、更有内容。<b>机器翻译里"beam 调大反而 BLEU 下降"就是这么来的。</b></>
                : <>这一档 k 越大越接近最优，且输出长度<b>没有</b>随 k 变短。
                  {modelName.startsWith('长度偏置')
                    ? <> 因为当前口径是「{scoreKind}」，长度惩罚已经把偏置压住了 —— <b>把口径换回「累积概率（原始）」</b>就看得见那条曲线打架。</>
                    : <> <b>换成「长度偏置」那张模型</b>再看。</>}</>}
              <br />
              <b>k=1 就是贪心、k=∞ 就是全搜索</b> —— 束搜索是这两端之间的一个旋钮。
              而<b>长度惩罚是个有力度的旋钮，不是一个开关</b>：「÷ 长度」能把选择拉回长的那条，
              而 GNMT 的 α=0.6 温和得多（分母 ((5+len)/6)<sup>0.6</sup>：长 1 时 1.00、长 3 时才 1.19），
              在这张模型上还不足以翻盘。
            </p>
          )
          : <p className="scnote" style={{ opacity: .85 }}>束宽 k=2:每步维护 2 条候选序列。把每条各扩一个词、算累积概率(连乘),所有候选排序后<b>只留前 2 条</b>(绿✓)、其余剪掉。这样既不像贪心那样一条道走到黑,也不像全搜索那样爆炸。</p>}
      </div>
    </div>
  )
}
