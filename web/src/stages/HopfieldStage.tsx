/**
 * 舞台：注意力 = 联想记忆 —— 残缺 query 反复检索，一步步"回忆"回存储的模式。
 *
 * 2026-09-09 补厚。检索本身上一轮就是真算的，但**三个旋钮一个都没有**，
 * 于是正文里三句话全靠嘴说：「β 大→精确、β 小→软混合」（β 写死 6）、
 * 「落进**吸引域**就被拉回」（翻转位数写死 2）、「容量随维度**指数级**」（只有 4 个模式一个维度）。
 *
 * 这一屏加了三块，全是抽出来的：
 *   ① **β 扫描**：最大权重 0.355 → 1，而且抽样量了每档的吸引域和容量命中率。
 *      ⚠️ 屏幕上这**一个** query 碰巧四档 β 都回得去 —— 单个例子说明不了旋钮有没有用。
 *   ② **吸引域**：翻 f 位、每档重采样 200 次。100/100/63/42/14% —— **边界看得见**。
 *      同时报"回到汉明最近那个"的比例，说清"回不去"是记忆坏了还是 query 真的挪走了。
 *   ③ **容量**：N=8 到 M=64 只剩 29%，而 N=16 全程 100% —— **维度翻一倍，容量翻的不止一倍**。
 */
import type { HopfieldState } from '@engine/kernels/hopfield.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const PLAB = ['P0', 'P1', 'P2', 'P3']

function Bits({ bits, ref }: { bits: number[]; ref?: number[] }) {
  return (
    <div className="hfbits">
      {bits.map((b, k) => {
        const diff = ref && ref[k] !== b
        return <span key={k} className={`hfcell ${b > 0 ? 'pos' : 'neg'} ${diff ? 'diff' : ''}`} />
      })}
    </div>
  )
}

export function HopfieldStage({ state }: StageProps<HopfieldState>) {
  const {
    patterns, querySign, weights, best, matchBits, beta, flip, n, converged, phase,
    truth, truthDist, onehot, right, maxW, betaSweep, basin, basinEdge, cap,
  } = state
  const done = phase === 'done'
  const edgeOf = (r: typeof cap[number]) => {
    const good = r.row.filter(x => x.ok >= 0.9)
    return good.length ? good[good.length - 1].m : 0
  }
  return (
    <div className="card">
      <h3>注意力 = 联想记忆 <span className="hint">温度决定精不精确、残缺到一定程度就回不去</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">β={beta}</span><span className="scdl">softmax 锐度（=1/温度）</span></div>
          {/*  ⭐ β 小的时候权重收敛不到 one-hot —— 输出是几个模式的加权平均 */}
          <div className="scdk">
            <span className={`scdn ${onehot ? 'good' : 'bad'}`}>{maxW}</span>
            <span className="scdl">最大权重（{onehot ? 'one-hot，精确检索' : '分散，软混合'}）</span>
          </div>
          {/*  ⭐ 「回忆对了吗」对着另算的真值判，不问它自己 */}
          <div className="scdk">
            <span className={`scdn ${done ? (right ? 'good' : 'bad') : ''}`}>P{best}</span>
            <span className="scdl">认定的模式（真值 P{truth}，汉明距 {truthDist}）</span>
          </div>
          <div className="scdk">
            <span className="scdn">{matchBits} / {n}</span>
            <span className="scdl">query 和真值模式相同的位数（翻了 {flip} 位出发）</span>
          </div>
          <div className="scdk">
            <span className={`scdn ${basinEdge <= 1 ? 'bad' : ''}`}>翻 {basinEdge} 位</span>
            <span className="scdl">吸引域边界（抽 200 次量的）</span>
          </div>
        </div>
        {/* 存储的记忆 */}
        <div className="hfrow">
          <span className="hflab">存储的记忆（keys · β={beta}）</span>
          <div className="hfmem">
            {patterns.map((p, i) => (
              <div key={i} className={`hfpat ${i === best && !done ? 'win' : ''}`}>
                <span className="hfpn">{PLAB[i]}</span>
                <Bits bits={p} />
                <span className="hfw" style={{ opacity: 0.4 + weights[i] * 0.6 }}>{(weights[i] * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* query */}
        <div className="hfrow">
          <span className="hflab">当前 query（红框=和 P0 不一致的位）</span>
          <div className="hfquery">
            <Bits bits={querySign} ref={patterns[0]} />
            <span className={`hfmatch ${matchBits === 8 ? 'ok' : ''}`}>与 P0 相同 {matchBits}/8</span>
          </div>
        </div>

        {/* 检索权重 */}
        <div className="hfrow">
          <span className="hflab">检索权重 = softmax(β · query·keys)</span>
          <div className="hfweights">
            {weights.map((w, i) => (
              <div className="hfwrow" key={i}>
                <span className="hfwl">{PLAB[i]}</span>
                <span className="hfwtrack"><span className="hfwfill" style={{ width: `${Math.max(1.5, w * 100)}%`, background: i === best ? 'var(--now)' : 'var(--f-tag)' }} /></span>
                <span className="hfwp">{(w * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="orcap">{rich(state.log)}</div>

        {/*  ⭐ ① β 扫描：单个例子说明不了旋钮有没有用，抽样才行 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>β（=1/温度）</span><span>最大权重</span><span>屏幕上这个 query</span>
              <span>抽样：翻 2 位回得去</span><span>抽样：存 16 个认得出</span>
            </div>
            {betaSweep.map(x => (
              <div className={`qsrow ${x.beta === beta ? 'mcpick' : ''}`} key={x.beta}>
                <span>β={x.beta}{x.beta === beta ? ' ◀' : ''}</span>
                <span className={x.maxW > 0.9 ? 'good' : 'bad'}>{x.maxW}</span>
                <span className="dimv">{x.right ? '回得去 ✓' : '回不去 ✗'}</span>
                <span className={x.basin2 >= 0.5 ? '' : 'bad'}>{(x.basin2 * 100).toFixed(0)}%</span>
                <span className={x.cap16 >= 0.5 ? '' : 'bad'}>{(x.cap16 * 100).toFixed(0)}%</span>
              </div>
            ))}
            <div className="orcap">
              ⚠️ <b>别只看"屏幕上这个 query 回不回得去"那一列</b> —— 它碰巧四档 β 都回得去。
              <b>旋钮有没有用得抽样才看得出来</b>：β={betaSweep[0].beta} 时翻 2 位只有
              <b> {(betaSweep[0].basin2 * 100).toFixed(0)}%</b> 回得去、存 16 个模式只认得出
              <b> {(betaSweep[0].cap16 * 100).toFixed(0)}%</b>；β={betaSweep[3].beta} 分别是
              <b> {(betaSweep[3].basin2 * 100).toFixed(0)}%</b> 和 <b>{(betaSweep[3].cap16 * 100).toFixed(0)}%</b>。
              <br />
              <b>β 小 = 软混合</b>：softmax 压不出尖锐的选择，输出是几个模式的加权平均、取符号之后<b>谁也不是</b>；
              <b>β 大 = 精确检索</b>，一步到位。这就是正文里那句"β=1/温度"的落点 ——
              <b>它不是一句设定，是一个能把行为整个改掉的旋钮。</b>
            </div>
          </div>
        )}

        {/*  ⭐ ② 吸引域：边界是抽出来的 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>翻几位</span><span>回到<b>原模式</b>（吸引域）</span><span>回到<b>汉明最近</b>那个</span><span></span><span></span>
            </div>
            {basin.map(x => (
              <div className={`qsrow ${x.flip === flip ? 'mcpick' : ''}`} key={x.flip}>
                <span>翻 {x.flip} 位{x.flip === flip ? ' ◀' : ''}</span>
                <span className={x.ok >= 0.9 ? 'good' : x.ok < 0.5 ? 'bad' : ''}>{(x.ok * 100).toFixed(0)}%</span>
                <span className="dimv">{(x.okNear * 100).toFixed(0)}%</span>
                <span /><span />
              </div>
            ))}
            <div className="orcap">
              每档随机挑位置翻、重采样 200 次。<b>边界在翻 {basinEdge} 位</b>（再多就掉出 90%）——
              "query 只要落进吸引域就被拉回完整模式"这句话，<b>吸引域到底多大是量出来的</b>。
              <br />
              ⚠️ <b>两列口径不一样，得摆在一起看。</b>第一列问"还回得到<b>原来那个</b>吗"（这才是吸引域）；
              第二列问"回到的是不是<b>汉明最近</b>的那个"。翻多了之后第一列塌下去、第二列还很高 ——
              说明<b>它没乱来，是 query 真的已经离开那片地方了</b>。
              <br />
              ⚠️ 这个口径栽过一次：第一版只用第二列当"正确"，曲线是 100/100/83/88/84、<b>根本不下降</b>，
              "吸引域"一点没演出来 —— <b>因为那个"最近"会跟着 query 一起挪</b>。
            </div>
          </div>
        )}

        {/*  ⭐ ③ 容量：两个维度并排，看崩溃点怎么挪 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>存 M 个随机模式</span>{cap[0].row.map(x => <span key={x.m}>M={x.m}</span>)}
            </div>
            {cap.map(c => (
              <div className="qsrow hfcap" key={c.n}>
                <span>N={c.n}</span>
                {c.row.map(x => (
                  <span key={x.m} className={x.ok >= 0.9 ? 'good' : x.ok < 0.5 ? 'bad' : ''}>{(x.ok * 100).toFixed(0)}%</span>
                ))}
              </div>
            ))}
            {/*  ⚠️ 这段话得跟着 edgeOf 走。β=0.5 那档两个维度都只撑到 M=2，
                 照印"维度翻一倍容量翻的不止一倍"就跟旁边的数打架了。 */}
            <div className="orcap">
              存 M 个随机模式、翻 1 位当 query，问"还认得出<b>原来那个</b>吗"（每格抽 120 次）。
              <br />
              {edgeOf(cap[1]) > edgeOf(cap[0])
                ? <><b>N={cap[0].n} 撑到 M={edgeOf(cap[0])} 就掉出 90%，而 N={cap[1].n} 能撑到 M={edgeOf(cap[1])}</b> ——
                  <b>维度翻一倍，容量翻了 {Math.round(edgeOf(cap[1]) / Math.max(1, edgeOf(cap[0])))} 倍</b>。
                  这正是"现代 Hopfield 网络容量随维度指数增长"那条结论，
                  也正对上<b>「高维近正交」</b>那一屏：<b>维度一高，随机模式之间几乎互相垂直，塞得下的就多得多</b>。</>
                : <>⚠️ <b>这一档两个维度都只撑到 M={edgeOf(cap[0])}</b> —— 加维度也救不回来。
                  <b>问题不在维度，在 β={beta}</b>：softmax 压不出尖锐的选择，检索本身就不准，
                  存几个模式都认不出。<b>把 β 调大再看这张表</b> —— 那时候 N={cap[1].n} 能一路撑到 M=64，
                  而 N={cap[0].n} 到 M=64 只剩三成。<b>容量随维度指数增长的前提是检索本身得准。</b></>}
            </div>
          </div>
        )}

        <p className="scnote">
          <b>注意力 = 联想记忆</b>：一次注意力就是一步 Hopfield 检索 ——
          weights = softmax(<b>β</b>·query·keys)，output = Σ weights·patterns，把 output 当新 query 再来一次。
          2020 年证明了注意力的更新规则**就是**连续 Hopfield 网络的检索步。
          <br />
          <b>而这一屏真正要说的是它的三个条件。</b>老版本 β 写死 6、翻转位数写死 2、只存 4 个模式，
          于是"β 大→精确、β 小→软混合""落进吸引域就被拉回""容量随维度指数级"这三句话
          <b>全靠嘴说</b>。现在三个都是抽出来的数：
          <br />
          <b>① 温度决定它是精确检索还是糊成一团</b>（β=0.5 时最大权重才 {betaSweep[0].maxW}）；
          <b>② 残缺到一定程度就回不去了</b>（翻 {basinEdge} 位是边界，翻 {basin[basin.length - 1].flip} 位只剩
          {(basin[basin.length - 1].ok * 100).toFixed(0)}%）；
          <b>③ 能记住多少取决于维度</b>（N={cap[0].n} 撑到 M={edgeOf(cap[0])}，N={cap[1].n} 撑到 M={edgeOf(cap[1])}）。
          <br />
          这是注意力能"从上下文里回忆相关信息"的底，也是"注意力头在做检索"这个说法的数学根据。
        </p>
      </div>
    </div>
  )
}
