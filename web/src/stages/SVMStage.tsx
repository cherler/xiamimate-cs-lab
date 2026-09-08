/**
 * 舞台：SVM —— 一条歪着起步的线，被目标函数推成"最宽的街"
 *
 * 2026-09-08 跟着内核一起重画。老版本的边界被限制成一条**竖线**，
 * 所以画起来只是一根竖杠加两根虚线；而 SVM 的全部难处在于**找那个方向**。
 * 现在方向是解出来的，于是这里要画的东西也变了：
 *   · 边界 w·x+b=0 与两条街沿 w·x+b=±1（任意方向的直线，跟视窗求交点）；
 *   · **支持向量套一圈**：定住这条街的就是它们；
 *   · **站进街里的点**（yᵢf(xᵢ)<1）单独标出来 —— 软间隔"容忍"的正是这些。
 */
import type { SVMState } from '@engine/kernels/svm.ts'
import type { StageProps } from '../types.ts'

const LO = -3.4, HI = 3.4
const px = (x: number) => (x - LO) / (HI - LO) * 100
const py = (y: number) => 100 - (y - LO) / (HI - LO) * 100

/*  直线 w1·x + w2·y + b = c 与视窗矩形的两个交点。
    ⚠️ 不能按 y=kx+b 画：w2 接近 0 时斜率发散。这里逐边求交，稳。 */
function clipLine(w1: number, w2: number, b: number, c: number) {
  const pts: { x: number; y: number }[] = []
  const push = (x: number, y: number) => {
    if (x >= LO - 1e-9 && x <= HI + 1e-9 && y >= LO - 1e-9 && y <= HI + 1e-9) pts.push({ x, y })
  }
  if (Math.abs(w2) > 1e-9) { push(LO, (c - b - w1 * LO) / w2); push(HI, (c - b - w1 * HI) / w2) }
  if (Math.abs(w1) > 1e-9) { push((c - b - w2 * LO) / w1, LO); push((c - b - w2 * HI) / w1, HI) }
  if (pts.length < 2) return null
  //  可能有重复端点，挑相距最远的两个
  let best: [typeof pts[0], typeof pts[0]] = [pts[0], pts[1]], bd = -1
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
    if (d > bd) { bd = d; best = [pts[i], pts[j]] }
  }
  return best
}

export function SVMStage({ state }: StageProps<SVMState>) {
  const { step, phase, points, w1, w2, b, margin, obj, hinge, supportVectors,
    inside, wrong, acc, cTag, kind, svOnlyTilt } = state
  const started = step >= 0
  const svSet = new Set(supportVectors)
  const nw = Math.hypot(w1, w2) || 1e-9
  const marginOf = (p: { x: number; y: number; c: number }) => (p.c ? 1 : -1) * (w1 * p.x + w2 * p.y + b)

  const seg = (c: number) => {
    const l = clipLine(w1, w2, b, c)
    return l ? { x1: px(l[0].x), y1: py(l[0].y), x2: px(l[1].x), y2: py(l[1].y) } : null
  }
  const mid = seg(0), up = seg(1), dn = seg(-1)

  return (
    <div className="card">
      <h3>支持向量机 SVM <span className="hint">最宽的那条街，只由贴着街边的几个点定住</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{started ? (2 * margin).toFixed(2) : '—'}</span><span className="scdl">街宽 2/‖w‖</span></div>
          <div className="scdk"><span className="scdn">{started ? obj : '—'}</span><span className="scdl">目标 J（越小越好）</span></div>
          <div className="scdk"><span className="scdn">{supportVectors.length} / {points.length}</span><span className="scdl">支持向量</span></div>
          <div className="scdk"><span className={`scdn ${wrong ? '' : 'hot'}`}>{wrong}</span><span className="scdl">分错（{cTag}）</span></div>
          {phase === 'done' && <div className="scdk"><span className={`scdn ${svOnlyTilt < 1 ? 'hot' : ''}`}>{svOnlyTilt}°</span>
            <span className="scdl">只留支持向量重解，边界差</span></div>}
        </div>

        <div className="mlwrap">
          <svg className="mlplot svmplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/*  两条街沿 w·x+b=±1，中间那条是决策边界 */}
            {started && up && <line {...up} className="svmedge" vectorEffect="non-scaling-stroke" />}
            {started && dn && <line {...dn} className="svmedge" vectorEffect="non-scaling-stroke" />}
            {started && mid && <line {...mid} className="svmmid" vectorEffect="non-scaling-stroke" />}
            {points.map(p => {
              const m = marginOf(p)
              return (
                <g key={p.idx}>
                  {/*  支持向量套一圈 —— 定住这条街的就是它们 */}
                  {started && svSet.has(p.idx) && (
                    <circle cx={px(p.x)} cy={py(p.y)} r="3.4" className={`svmsv ${m <= 0 ? 'bad' : ''}`} />
                  )}
                  <circle cx={px(p.x)} cy={py(p.y)} r="1.9"
                    fill={p.c ? 'var(--now)' : 'var(--miss)'}
                    opacity={started && m > 1 ? 0.45 : 1} />
                </g>
              )
            })}
          </svg>
          <div className="orcap">
            {started
              ? `实线=决策边界 w·x+b=0，两条虚线=街沿 w·x+b=±1；套圈的是支持向量（${supportVectors.length} 个），`
                + `淡掉的点离街很远、对边界毫无影响`
              : '按「下一步」开始求解。起步方向是故意选歪的，看它怎么被推正'}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">
            收敛：街宽 <b>{(2 * margin).toFixed(2)}</b>，{points.length} 个点里 <b>{supportVectors.length}</b> 个贴着街边或站在街里，
            分错 {wrong} 个（准确率 {(acc * 100).toFixed(0)}%）。
            　<b>只有那 {supportVectors.length} 个点说了算</b>：把其余 {points.length - supportVectors.length} 个点
            <b>全删掉</b>、只拿它们重解一遍，得到的边界跟现在这条只差 <b>{svOnlyTilt}°</b> —— 几乎是同一条线。
            这就是"支持向量"这个名字的来历，也是 SVM 能只记住少数点的原因。
            {kind === '有重叠（线性不可分）' && <>　这份数据<b>本来就分不开</b>，怎么画线都会错几个。
              此刻 C 决定你怎么取舍：现在街宽 {(2 * margin).toFixed(2)}、{inside} 个点站进了街里、错 {wrong} 个。
              <b>没有"正确答案"，只有取舍</b> —— 这正是软间隔交给你的那个旋钮。</>}
            {kind === '有一个离群点' && (wrong === 0
              ? <>　⚠️ 看这条街有多窄：<b>{(2 * margin).toFixed(2)}</b>。同样的数据去掉那个离群点，街宽是 1.60。
                C 这么大，算法不肯放过任何一个点，为了把那<b>一个</b>离群点也分到正确那侧，
                整条街被挤掉了六成、方向也被拽偏 —— <b>一个点绑架了全部 {points.length} 个点</b>。
                把 C 调小再看：软间隔允许"放弃"个别点，街立刻宽回来。</>
              : <>　这份数据里埋了一个<b>离群点</b>。现在的 C 还算软，算法<b>主动放弃</b>了它：
                宁可错这一个，也要保住 {(2 * margin).toFixed(2)} 宽的街。
                把 C 拧到 10 再看 —— 为了把它也分对，街会被挤到不足一半。</>)}
            {kind === '清爽可分' && <>　把「数据形状」换成"有重叠"或"有一个离群点"，再拧 C —— 才看得见软间隔真正在做的取舍。</>}
          </p>
          : started && <p className="scnote" style={{ opacity: .85 }}>
            目标 J = ½λ‖w‖² + 平均 hinge = <b>{obj}</b>（此刻 hinge {hinge}）。
            前一项要街宽（‖w‖ 小），后一项要点都站在街外 —— <b>两个愿望在打架，C 决定谁说了算</b>。
            看那条线怎么从故意选歪的起点被推正、街怎么撑开。</p>}
      </div>
    </div>
  )
}
