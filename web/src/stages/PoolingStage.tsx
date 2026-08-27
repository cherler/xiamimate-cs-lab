/** 舞台：池化 —— 2×2 窗口不重叠扫过 4×4 特征图，每块取最大/平均，图缩成 2×2（降采样） */
import type { PoolState } from '@engine/kernels/pooling.ts'
import type { StageProps } from '../types.ts'

const gray = (v: number) => `color-mix(in srgb, var(--ink) ${Math.round((v / 9) * 74)}%, var(--panel))`

export function PoolingStage({ state }: StageProps<PoolState>) {
  const { img, kindName, out, wr, wc, vals, result, phase } = state
  const done = phase === 'done'
  const started = wr >= 0
  return (
    <div className="card">
      <h3>池化 Pooling <span className="hint">小窗口把特征图缩小，只留每块最强/平均的信号</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{kindName}池化</span><span className="scdl">汇总方式</span></div>
          <div className="scdk"><span className="scdn">4×4→2×2</span><span className="scdl">尺寸(降采样)</span></div>
          <div className="scdk"><span className="scdn">{started && !done ? result : '—'}</span><span className="scdl">本块结果</span></div>
        </div>

        <div className="cvwrap">
          <div>
            <div className="cvcap">输入 4×4</div>
            <div className="cvgrid" style={{ gridTemplateColumns: `repeat(4, 1fr)` }}>
              {img.map((row, r) => row.map((v, c) => {
                const inWin = started && !done && r >= 2 * wr && r < 2 * wr + 2 && c >= 2 * wc && c < 2 * wc + 2
                return <div key={`${r}-${c}`} className={`cvcell ${inWin ? 'win' : ''}`} style={{ background: gray(v) }}>{v}</div>
              }))}
            </div>
          </div>

          <div className="cvarrow">{started ? (kindName === '平均' ? 'avg' : 'max') : '→'}<br />⟶</div>

          <div>
            <div className="cvcap">输出 2×2</div>
            <div className="cvgrid" style={{ gridTemplateColumns: `repeat(2, 1fr)` }}>
              {out.map((row, r) => row.map((v, c) => (
                <div key={`o${r}-${c}`} className={`cvcell pool-out ${started && !done && r === wr && c === wc ? 'cur' : ''}`}>
                  {v === null ? '' : v}
                </div>
              )))}
            </div>
          </div>
        </div>

        <div className="orcap">
          {!started ? '按「下一步」开始:2×2 窗口不重叠地扫，每块汇总成一个数'
            : done ? `${kindName}池化完成:4×4 缩成 2×2 —— 边长减半、面积变 1/4`
              : `窗口盖住 [${vals.join(', ')}] → ${kindName === '平均' ? `平均=(${vals.join('+')})/4=${result}` : `最大=${result}`}，写进输出 (${wr},${wc})`}
        </div>

        {done
          ? <p className="scnote">池化用小窗口在特征图上<b>不重叠地滑</b>,每块汇总成一个数:<b>最大池化</b>留最强响应(对小平移更鲁棒)、<b>平均池化</b>留整体强度。图边长减半、<b>面积变 1/4</b>——降采样让计算量骤减、感受野变大、对位置抖动更稳。它<b>没有可学参数</b>,是 CNN 里紧跟卷积的标准一环(LeNet/VGG),后来也常被步长卷积替代。换上面的参数可切最大/平均池化。</p>
          : <p className="scnote" style={{ opacity: .85 }}>左=输入特征图(4×4),琥珀框=当前 2×2 窗口;右=输出(2×2),绿=刚写入的格。窗口不重叠地扫 4 个位置,每块把 4 个数汇总成 1 个(最大或平均)。改上面的「汇总方式」立即重跑。</p>}
      </div>
    </div>
  )
}
