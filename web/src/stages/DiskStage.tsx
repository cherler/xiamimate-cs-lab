/**
 * 舞台：磁盘调度 —— 盘片实物图 + 磁头轨迹 / 请求队列。
 *
 * ## 为什么画一块盘
 *
 * 这一屏原来只有一张折线图。折线图是**教材的读法**（横轴磁道号、自上而下服务次序），
 * 该留；但它回答不了"磁头到底在哪儿、跑了多远"这种**物的问题** ——
 * 而硬盘恰好是 30 个实验里少数**有真实实物**的一个：盘片、主轴、磁头臂、柱面。
 *
 * 画法走**工程图纸 / 专利图**那一路，不是照片写实：
 * 线条 + 剖面线 + 尺寸标注。理由有三个 ——
 *   1. 不需要 3D 美术，SVG 就够（也不用引 three.js）；
 *   2. 同一套语言对**没有实物**的实验（树、图、数组）也成立，30 个能统一；
 *   3. 尺寸标注本身**是信息不是装饰**：那根带箭头的线量的就是"本步移动了多少个磁道"。
 */
import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import type { DiskView } from './disk3d.tsx'
import type { DiskState } from '@engine/kernels/disk.ts'
import type { StageProps } from '../types.ts'

/**
 * 舞台底子：`draft` 工程图纸 / `real` 实物。
 *
 * 为什么值得做成开关，而不是二选一：**它们是两件不同的活**。
 * 图纸负责**读得清**（标注、尺寸、两套主题都成立、印出来也对）；
 * 实物负责**认得出**（一眼知道这是硬盘，也是短视频那 4 秒的抓手）。
 * 同一份数据，两种底子；数据层一行不改。
 *
 * 偏好跨实验共用：选过一次实物，别的有实物的实验也照此。
 */
export type Skin = 'draft' | 'real'
const SKIN_KEY = 'cslab.skin'
export function useSkin(): [Skin, () => void] {
  const [skin, setSkin] = useState<Skin>(() => {
    try { return localStorage.getItem(SKIN_KEY) === 'real' ? 'real' : 'draft' } catch { return 'draft' }
  })
  return [skin, () => setSkin(v => {
    const n: Skin = v === 'draft' ? 'real' : 'draft'
    try { localStorage.setItem(SKIN_KEY, n) } catch { /* 隐私模式 */ }
    return n
  })]
}

export function DiskStage({ doc, trace, index, state, tab }: StageProps<DiskState>) {
  const maxTrack = doc.params.maxTrack as number
  const start = doc.params.headStart as number
  if (tab === 'queue') return <Queue state={state} maxTrack={maxTrack} />
  return <Path trace={trace} index={index} maxTrack={maxTrack} start={start} />
}

/**
 * 盘片俯视图（工程图纸风）。
 *
 * 几何上刻意做了一处**忠于实物**的选择：**磁道 0 在最外圈**，磁道号越大越靠内。
 * 教材的折线图不管这件事，但真实硬盘就是这么编号的 ——
 * 而一旦画成了一块盘，编号方向就成了"图上说得对不对"的问题，不能含糊。
 *
 * 磁头固定在**水平右半径**上，臂从右下方的枢轴伸过来。真实磁头臂是摆动的，
 * 落点确实沿一段圆弧；把落点压在水平半径上是插画惯例 ——
 * 好处是"跨了几个磁道"变成一段**看得见长度**的直线，正是这一屏要量的东西。
 */
function Platter({ trace, index, maxTrack, start, skin = 'draft' }: {
  trace: DiskState[]; index: number; maxTrack: number; start: number; skin?: Skin
}) {
  const real = skin === 'real'
  const s = trace[index]
  const cx = 172, cy = 176, R = 138, rHub = 34
  /** 磁道 → 半径。磁道 0 在最外圈 */
  const rOf = (t: number) => R - (R - rHub - 10) * (Math.max(0, Math.min(maxTrack, t)) / maxTrack)
  const xOf = (t: number) => cx + rOf(t)

  const from = s ? s.from : start
  const head = s ? s.head : start
  const sweep = !!s?.sweep
  /** 已经服务过的磁道（含本步） */
  const done = new Set(trace.slice(0, index + 1).map(x => x.head))
  const pending = s ? s.pending : []
  const arm = { x: cx + R + 52, y: cy + 104 }

  return (
    <svg className="platter" viewBox="0 0 400 360" role="img"
         aria-label={`盘片：磁头在磁道 ${head}，本步从 ${from} 移动 ${s?.moved ?? 0} 个磁道`}>
      <defs>
        {/*  剖面线 —— 工程图纸里"这里是实心材料"的画法。
            主轴和枢轴用它，一眼看出哪些是结构件、哪些是数据区。 */}
        <pattern id="dk-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--faint)" strokeWidth="1" />
        </pattern>
        <marker id="dk-arw" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6"
                orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--now)" />
        </marker>
      </defs>

      {/* 盘面：外沿画双线（盘片是有厚度的实物），内圈一圈参考磁道当纹理 —— 
          只画有请求的那几圈的话，它读起来像个靶子，不像一块盘。 */}
      {!real && <circle cx={cx} cy={cy} r={R + 5} fill="none" stroke="var(--faint)" strokeWidth="1.1" />}
      {!real && <circle cx={cx} cy={cy} r={R} fill="var(--sunk-2)" stroke="var(--faint)" strokeWidth="1.4" />}
      {!real && Array.from({ length: 11 }, (_, k) => (
        <circle key={k} cx={cx} cy={cy} r={rOf((k / 10) * maxTrack)} fill="none"
                stroke="var(--line-soft)" strokeWidth="0.6" />
      ))}
      {!real && <circle cx={cx} cy={cy} r={rHub + 8} fill="none" stroke="var(--line-soft)" strokeWidth="1" />}

      {/* 请求所在的磁道：整圈细线 + 右半径上一枚刻度。
          画成整圈是因为**一个磁道就是一整圈**，不是一个点 —— 这是画盘才说得清的事。 */}
      {[...new Set([...pending, ...done])].map(t => {
        const served = done.has(t)
        return (
          <circle key={t} cx={cx} cy={cy} r={rOf(t)} fill="none"
                  stroke={served ? 'var(--hit)' : 'var(--wan)'}
                  strokeWidth={served ? 1 : 0.9}
                  strokeDasharray={served ? undefined : '3 4'}
                  opacity={served ? 0.5 : 0.7} />
        )
      })}

      {/* 主轴（剖面线） */}
      {!real && <circle cx={cx} cy={cy} r={rHub} fill="url(#dk-hatch)" stroke="var(--faint)" strokeWidth="1.1" />}
      {!real && <circle cx={cx} cy={cy} r={7} fill="var(--panel)" stroke="var(--faint)" strokeWidth="1.1" />}

      {/* 磁头这一步走过的那一段：本步行程 */}
      <line x1={xOf(from)} y1={cy} x2={xOf(head)} y2={cy}
            stroke={sweep ? 'var(--miss)' : 'var(--now)'} strokeWidth="3" strokeLinecap="round" />

      {/* 磁头臂 + 磁头 */}
      <line x1={arm.x} y1={arm.y} x2={xOf(head)} y2={cy}
            stroke="var(--dim)" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
      <circle cx={arm.x} cy={arm.y} r={11} fill="url(#dk-hatch)" stroke="var(--faint)" strokeWidth="1.1" />
      <circle cx={arm.x} cy={arm.y} r={3.4} fill="var(--panel)" stroke="var(--faint)" strokeWidth="1" />
      <rect x={xOf(head) - 6} y={cy - 5} width="12" height="10" rx="1.5"
            fill={sweep ? 'var(--miss)' : 'var(--now)'} stroke="var(--panel)" strokeWidth="1" />

      {/* 径向标尺 + 引出线 —— 都画在**零件外面**。
          标尺定"磁道号在半径上的位置"，引出线把磁头指到标尺上；
          这两样是工程图纸里最有辨识度的两笔，而且都是信息：
          没有标尺就读不出磁头停在哪一档，没有引出线就得靠猜哪个圈是它。 */}
      <g className="dkrule">
        <line x1={xOf(maxTrack)} y1={cy - R - 20} x2={xOf(0)} y2={cy - R - 20}
              stroke="var(--faint)" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const t = Math.round(f * maxTrack)
          return (
            <g key={f}>
              <line x1={xOf(t)} y1={cy - R - 20} x2={xOf(t)} y2={cy - R - 14}
                    stroke="var(--faint)" strokeWidth="1" />
              <text x={xOf(t)} y={cy - R - 25} textAnchor="middle">{t}</text>
            </g>
          )
        })}
      </g>
      <g className="dklead">
        <line x1={xOf(head)} y1={cy - 9} x2={xOf(head)} y2={cy - R - 20}
              stroke={sweep ? 'var(--miss)' : 'var(--now)'} strokeWidth="1"
              strokeDasharray="3 3" />
        <path d={`M ${xOf(head) - 4} ${cy - R - 26} L ${xOf(head) + 4} ${cy - R - 26} L ${xOf(head)} ${cy - R - 19} Z`}
              fill={sweep ? 'var(--miss)' : 'var(--now)'} />
        <text x={xOf(head)} y={cy - R - 31} textAnchor="middle" className="hot">{head}</text>
      </g>

      {/* 尺寸标注：**画在零件外面**（工程图惯例），量的是本步真的跨了几个磁道 */}
      {s && s.moved > 0 && (
        <g className="dkdim">
          <line x1={xOf(from)} y1={cy + 4} x2={xOf(from)} y2={cy + R + 34} stroke="var(--line)" strokeWidth="0.8" />
          <line x1={xOf(head)} y1={cy + 4} x2={xOf(head)} y2={cy + R + 34} stroke="var(--line)" strokeWidth="0.8" />
          <line x1={xOf(from)} y1={cy + R + 26} x2={xOf(head)} y2={cy + R + 26}
                stroke={sweep ? 'var(--miss)' : 'var(--now)'} strokeWidth="1.3"
                markerStart="url(#dk-arw)" markerEnd="url(#dk-arw)" />
          <text x={(xOf(from) + xOf(head)) / 2} y={cy + R + 20} textAnchor="middle">
            {sweep ? `空跑 ${s.moved}` : `${from} → ${head}　${s.moved}`}
          </text>
        </g>
      )}


    </svg>
  )
}

/**
 * 磁头轨迹 —— 横轴磁道号，纵轴服务次序向下。
 * 教材上画的折线图就是这个形状；SCAN 系的"碰边再折返"一眼能看出来。
 */
/**
 * 单文件产物里**不打 3D 这一块**。
 *
 * 那份产物的卖点是"点开就玩、能转发"，塞一个 3D 引擎进去是反着来的；
 * 而且 `bundle-single` 要把所有脚本内联进一个 HTML，多一个动态块它直接失败
 * —— 2026-08-19 就是这么把 `npm run web:single` 弄坏一次的。
 *
 * `VITE_NO3D` 是编译期常量，这一支为假时打包器会把整条 `import()` 摇掉，
 * 块根本不会生成。实物档在那份产物里自动退回 CSS 版。
 */
const NO_3D = import.meta.env.VITE_NO3D === '1'
const Disk3D = NO_3D ? null : lazy(() => import('./disk3d.tsx'))

/**
 * 3D 起不来就退回 CSS 那版 —— **不留一块黑**：黑的比糙的更像坏了。
 * 起不来是真实存在的：没有 WebGL、老机器、以及单文件产物（那份产物里根本没打这个块，
 * 它的卖点是"点开就玩"，塞一个 3D 引擎进去是反着来的）。
 */
class Fallback3D extends Component<{ children: ReactNode; fallback: ReactNode }, { dead: boolean }> {
  state = { dead: false }
  static getDerivedStateFromError() { return { dead: true } }
  render() { return this.state.dead ? this.props.fallback : this.props.children }
}

/** CSS 材质版 —— 3D 的兜底，也是低端机上唯一跑得动的那版 */
function CssPlatter(p: { trace: DiskState[]; index: number; maxTrack: number; start: number }) {
  return (
    <>
      <i className="dkbody" aria-hidden="true" />
      <i className="dkspin" aria-hidden="true" />
      <i className="dkgloss" aria-hidden="true" />
      <Platter {...p} skin="real" />
    </>
  )
}


function Path({ trace, index, maxTrack, start }: {
  trace: DiskState[]; index: number; maxTrack: number; start: number
}) {
  const [skin, toggleSkin] = useSkin()

  /**
   * 实物档优先上 3D，起不来就退回 CSS 那版。
   *
   * 退回而不是留一块黑：**一块黑的比一块糙的更像坏了**。
   * 起不来的情形是真实存在的 —— 没有 WebGL、老机器、
   * 以及单文件产物（那份产物的卖点是"点开就玩"，不该塞一个 3D 引擎进去）。
   */
  const s = trace[index]
  /**  3D 层只拿这几个数 —— 它看不见 SimDocument、看不见 Trace、看不见内核。
       屏幕上每个数仍然只有一个来源：这条验过的轨迹。 */
  const view: DiskView = useMemo(() => ({
    maxTrack,
    head: s ? s.head : start,
    from: s ? s.from : start,
    sweep: !!s?.sweep,
    moved: s ? s.moved : 0,
    served: [...new Set(trace.slice(0, index + 1).map(x => x.head))],
    pending: s ? [...s.pending] : [],
  }), [trace, index, maxTrack, start, s])


  /**
   * 纵轴一行 = 磁头的一段行程。
   * 折返点也要单独占一行 —— 挤在同一行里的话，"走到 199 再折回 14" 会被压成一条近乎直线，
   * 又变回"数字对、图看不出"。
   */
  const rows = 1 + trace.reduce((n, s) => n + 1 + s.via.length, 0)
  const xOf = (t: number) => (t / maxTrack) * 100
  const yOf = (r: number) => (r / Math.max(1, rows - 1)) * 100

  /**
   * 折点要包含途经的边界。
   * 只画 from → head 的话，SCAN"先走到边界再掉头"那 209 个磁道会被画成一条直线 ——
   * 数字对，但图上完全看不出它绕了远路。
   */
  type Pt = { x: number; y: number; t: number; i: number; via?: boolean }
  const pts: Pt[] = [{ x: xOf(start), y: yOf(0), t: start, i: -1 }]
  let row = 0
  trace.forEach((s, i) => {
    for (const v of s.via) pts.push({ x: xOf(v), y: yOf(++row), t: v, i, via: true })
    pts.push({ x: xOf(s.head), y: yOf(++row), t: s.head, i })
  })

  return (
    <div className="card">
      <h3>盘片与磁头 <span className="hint">磁道 0 在最外圈 · 右侧是教材的折线读法</span>
        <button className="skinsw" onClick={toggleSkin}
                aria-pressed={skin === 'real'}
                data-tip="图纸看得清标注，实物看得出是什么。数据两边一样。">
          {/*  按钮说的是**点了会怎样**，不是当前是什么 ——
               原来印当前状态，用户看着"实物"两个字却是一张图纸，分不清 */}
          {skin === 'draft' ? '看实物 →' : '看图纸 →'}
        </button>
      </h3>
      <div className="body dsplit">
      <div className={`dkstage ${skin}`}>
        {skin === 'real' && (Disk3D
          ? (
            <Fallback3D fallback={<CssPlatter trace={trace} index={index} maxTrack={maxTrack} start={start} />}>
              <div className="dk3d">
                <Suspense fallback={null}><Disk3D view={view} /></Suspense>
              </div>
            </Fallback3D>
          )
          : <CssPlatter trace={trace} index={index} maxTrack={maxTrack} start={start} />)}
        {/*  材质底是 HTML（CSS 的 conic/radial 渐变，SVG 1.1 没有 conic），
             数据层仍是上面那张 SVG —— 底子换皮，数据一行不改。
             对齐靠容器锁死 400:360 的宽高比，跟 viewBox 一致，百分比才对得上。 */}

        {/*  图纸档才画那张平面数据层。3D 是透视的，平面的标尺和尺寸线对不上 ——
             硬贴上去会得到一组"看着像对、其实错位"的标注，那比没有更糟。
             实物档的标注改由 `<Html>` 锚在 3D 点上。 */}
        {skin === 'draft' && (
          <Platter trace={trace} index={index} maxTrack={maxTrack} start={start} skin={skin} />
        )}
      </div>
      <div className="dwrap">
        <div className="dscale">
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <span key={f} style={{ left: `${f * 100}%` }}>{Math.round(f * maxTrack)}</span>
          ))}
        </div>
        <div className="dplot" style={{ height: `${Math.max(120, rows * 26)}px` }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1={f * 100} x2={f * 100} y1={0} y2={100}
                    stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <polyline
              points={pts.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="var(--now)" strokeWidth={1.6}
              strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.5} />
            <polyline
              points={pts.filter(p => p.i <= index).map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="var(--now)" strokeWidth={2.4}
              strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {pts.map((p, k) => (
            <div
              key={k}
              className={`dnode ${p.via ? 'via' : ''} ${p.x > 88 ? 'rt' : ''} ${p.i === index ? 'cur' : ''} ${p.i < 0 ? 'start' : ''} ${p.i > index ? 'future' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              title={p.via
                ? `途经磁道 ${p.t}（没有请求，纯粹空跑）`
                : p.i < 0 ? `起始磁道 ${p.t}` : `第 ${p.i + 1} 个：磁道 ${p.t}`}
            >
              <em>{p.t}</em>
            </div>
          ))}
        </div>
        <div className="dlegend">
          <span>起始磁道 <b>{start}</b></span>
          <span>已服务 <b>{index + 1}</b> / {trace.length}</span>
          <span className="tot">累计寻道 <b>{trace[index]?.total ?? 0}</b></span>
        </div>
      </div>
      </div>
    </div>
  )
}

function Queue({ state, maxTrack }: { state: DiskState; maxTrack: number }) {
  return (
    <div className="card">
      <h3>本步状态 <span className="hint">第 {state.i + 1} 次服务</span></h3>
      <div className="body">
        <div className="dbar">
          <div className="dtrack">
            {state.pending.map(t => (
              <div key={t} className="dreq" style={{ left: `${(t / maxTrack) * 100}%` }} title={`待服务 ${t}`} />
            ))}
            <div className="dhead" style={{ left: `${(state.head / maxTrack) * 100}%` }}>
              <em>{state.head}</em>
            </div>
          </div>
          <div className="dends"><span>0</span><span>{maxTrack}</span></div>
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">磁头位置</span><span className="v">{state.head}</span></div>
          <div className="pr"><span className="k">本步移动</span><span className="v">{state.from} → {state.head}，{state.moved} 个磁道</span></div>
          <div className="pr"><span className="k">累计寻道</span><span className="v">{state.total}</span></div>
          <div className="pr"><span className="k">扫描方向</span>
            <span className="v">{state.dir === 0 ? '不适用' : state.dir > 0 ? '↑ 向大磁道' : '↓ 向小磁道'}</span></div>
          <div className="pr"><span className="k">剩余请求</span>
            <span className="v">{state.pending.length ? state.pending.join(' ') : '全部完成'}</span></div>
        </div>
      </div>
    </div>
  )
}
