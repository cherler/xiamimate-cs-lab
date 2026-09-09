/**
 * 实验引导图 —— 每个实验一张「看懂这一屏」的静态讲解图。
 *
 * ## 为什么要有它
 *
 * 用户原话：「这些格子根本看不懂是个什么东西」。讲解卡、推演、笔记都在**用**
 * tag/index/offset/组/路 这些词，却没有一处**把这套映射画出来**。
 * 这张图专补这一块：地址一分为三 → 三段各干什么 → 怎么落到组和路 → 命中/缺失。
 *
 * ## 为什么是手写代码，不是生图
 *
 * 先用生图（gpt-image-2）探出了这张图的**布局与配色**（那一步它擅长），
 * 但生图出的是位图，位数/tag/箭头这些**精确内容它必然画错、又改不掉**。
 * 所以最终按那个布局**手写复刻**：拿到好看的信息架构 + 保证内容全对 +
 * 用真实主题令牌（深浅色自动适配）+ 能嵌进产品。
 *
 * ## 加新实验的引导图
 *
 * 往 `GUIDE_DIAGRAMS` 里加一项：`{ 实验id: () => <你的图 /> }`。
 * 只有登记过的实验，exphead 上才出现「看懂这一屏」入口。
 *
 * ## 现状：30/30 全部铺完
 *
 * 每张图内容各不相同，但共用一套骨架保证「质感齐」：
 *   `Shell`（头）/ `Sec`（编号小节）/ `BitField`（位段拆解）/ `Flow`（底部串联带），
 *   加卡片(`gd-card`/`gd-lane`)、公式(`gd-formula`)、迷你网格/阶梯/图/树/时序等零件。
 * 按舞台形态归了几个原型：位段拆解（cache/vm/subnet/float…）、时序（pipeline/tcp…）、
 * 图（dijkstra/mst/topo/traverse 共用 `WeightedGraph`）、树（avl/huffman/bplus）。
 * 内容全部现取真实默认配置、手算核对（如 CRC 余数、banker 的 Need、hash 的 mod）。
 */
import { useEffect, type ReactNode } from 'react'

// ── 一组细线图标（跟概念图对齐）──
const Icn = {
  chip: <svg className="gd-i" viewBox="0 0 24 24" fill="none" stroke="var(--f-idx)" strokeWidth="1.7"><rect x="7" y="7" width="10" height="10" rx="1.5" fill="color-mix(in srgb, var(--f-idx) 9%, transparent)"/><path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3"/></svg>,
  bulb: <svg className="gd-i" viewBox="0 0 24 24" fill="none" stroke="var(--now)" strokeWidth="1.7"><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/><circle cx="12" cy="12" r="4"/></svg>,
  tag: <svg className="gd-i" viewBox="0 0 24 24" fill="none" stroke="var(--f-tag)" strokeWidth="1.7"><path d="M20.6 13.4 12 22l-8.6-8.6a4 4 0 0 1 0-5.6L8 3.2a4 4 0 0 1 5.6 0l7 7z"/><circle cx="8.5" cy="8.5" r="1.3" fill="var(--f-tag)"/></svg>,
  pin: <svg className="gd-i" viewBox="0 0 24 24" fill="none" stroke="var(--f-idx)" strokeWidth="1.7"><path d="M12 22s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.4"/></svg>,
  ruler: <svg className="gd-i" viewBox="0 0 24 24" fill="none" stroke="var(--f-off)" strokeWidth="1.7"><rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 8v4M11 8v3M15 8v4M19 8v3"/></svg>,
  doc: <svg className="gd-i" viewBox="0 0 24 24" fill="none" stroke="var(--f-off)" strokeWidth="1.7"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>,
  check: <svg className="gd-i" viewBox="0 0 24 24" fill="none" stroke="var(--hit)" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>,
  cross: <svg className="gd-i" viewBox="0 0 24 24" fill="none" stroke="var(--miss)" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>,
  star: <svg className="gd-i" viewBox="0 0 24 24" fill="none" stroke="var(--now)" strokeWidth="1.7"><path d="m12 2 2.9 6.3 6.9.7-5.1 4.6 1.4 6.7L12 17.8 5.9 20.3l1.4-6.7L2.2 9l6.9-.7z"/></svg>,
  info: <svg className="gd-i" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.7" style={{ marginTop: 1 }}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>,
}

const wayCell = (
  <span className="gd-cell"><span className="gd-tg">Tag</span><span className="gd-blk">数据块 (16B)</span></span>
)

// ─────────────────────────────────────────────────────────────
//  可复用骨架 —— 铺 30 张引导图时共用，保证「质感齐」
//  Cache 那张是手写原型；从第 2 张起走这套 helper。
// ─────────────────────────────────────────────────────────────

/** 外壳：顶部图标 + 标题 + 一句「看懂：…」。 */
function Shell({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children: ReactNode }) {
  return (
    <div className="gd">
      <div className="gd-hdr">
        <div className="gd-chip">{icon}</div>
        <div><h2>{title}</h2><div className="gd-sub">{sub}</div></div>
      </div>
      {children}
    </div>
  )
}

/** 编号小节。n=1|2|3|4 对应蓝/紫/琥珀/绿四种序号底色。 */
function Sec({ n, title, children }: { n: 1 | 2 | 3 | 4; title: ReactNode; children: ReactNode }) {
  return (
    <div className="gd-sec">
      <div className="gd-st"><i className={`gd-sn b${n}`}>{n}</i><b>{title}</b></div>
      {children}
    </div>
  )
}

type Seg = {
  cls: 't' | 'i' | 'o'        // 配色：t 蓝 / i 紫 / o 青
  fr: number                   // 该段占多少位（决定宽度比例）
  hi: number; lo: number       // 位区间 [hi..lo]，画在标尺上
  name: string                 // 段名，如「虚页号」
  w: string                    // 位宽说明，如「高 4 位」
  arrow?: string               // 角色卡上方的箭头，默认 ↓
  role: ReactNode              // 角色卡标题（含图标）
  body: string                 // 角色卡正文
}

/**
 * 位段拆解：标尺 + 彩色段条 + 角色卡，三行对齐。
 * Cache/vm/subnet/float 这些「一个地址/编码切成连续位段」的实验共用。
 * 段宽用内联 gridTemplateColumns 覆盖 Cache 写死的 9fr/3fr/4fr。
 */
function BitField({ cfg, segs }: { cfg: ReactNode; segs: Seg[] }) {
  const cols = segs.map(s => `${s.fr}fr`).join(' ')
  return (
    <div className="gd-s1">
      <div className="gd-cfg">{cfg}</div>
      <div>
        <div className="gd-ruler" style={{ gridTemplateColumns: cols }}>
          {segs.map((s, k) => (
            <div key={k}>{s.hi === s.lo ? <span>{s.hi}</span> : <><span>{s.hi}</span><span>{s.lo}</span></>}</div>
          ))}
        </div>
        <div className="gd-abar" style={{ gridTemplateColumns: cols }}>
          {segs.map((s, k) => (
            <div key={k} className={`gd-aseg ${s.cls}`}><div className="gd-nm">{s.name}</div><div className="gd-w">{s.w}</div></div>
          ))}
        </div>
        <div className="gd-roles" style={{ gridTemplateColumns: cols }}>
          {segs.map((s, k) => (
            <div key={k} className={`gd-role ${s.cls}`}>
              <div className="gd-ar">{s.arrow ?? '↓'}</div>
              <div className="gd-rh">{s.role}</div>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type Pill = { cls: string; text: string }

/** 底部「一句话串起来」流程带 + 「为什么」脚注。 */
function Flow({ pills, why }: { pills: Pill[]; why: ReactNode }) {
  return (
    <div className="gd-flow">
      <div className="gd-frow">
        <span className="gd-lb">{Icn.star}一句话串起来</span>
        {pills.map((p, k) => (
          <span key={k} style={{ display: 'contents' }}>
            {k > 0 && p.cls !== 'ph' && p.cls !== 'pm' && <span className="gd-farr">→</span>}
            {k > 0 && (p.cls === 'ph' || p.cls === 'pm') && pills[k - 1].cls !== 'ph' && <span className="gd-farr">→</span>}
            <span className={`gd-pill ${p.cls}`}>{p.text}</span>
          </span>
        ))}
      </div>
      <div className="gd-why">{Icn.info}<span>{why}</span></div>
    </div>
  )
}

function CacheDiagram() {
  return (
    <div className="gd">
      <div className="gd-hdr">
        <div className="gd-chip">{Icn.chip}</div>
        <div><h2>Cache 工作原理</h2><div className="gd-sub">看懂：一个内存地址，如何被拆开、又如何落到格子里</div></div>
      </div>

      {/* 第一步 */}
      <div className="gd-sec">
        <div className="gd-st"><i className="gd-sn b1">1</i><b>一个内存地址，被切成三段</b></div>
        <div className="gd-s1">
          <div className="gd-cfg">
            <div className="gd-cfgt">{Icn.bulb}以默认配置为例</div>
            Cache <b>256B</b>、块 <b>16B</b>、<b>2 路</b>组相联<br />⇒ 共 <b>8 组</b>（8 行）
          </div>
          <div>
            <div className="gd-ruler"><div><span>15</span></div><div><span>6</span></div><div><span>3</span><span>0</span></div></div>
            <div className="gd-abar">
              <div className="gd-aseg t"><div className="gd-nm">TAG（标记）</div><div className="gd-w">高 9 位</div></div>
              <div className="gd-aseg i"><div className="gd-nm">INDEX（索引）</div><div className="gd-w">中 3 位</div></div>
              <div className="gd-aseg o"><div className="gd-nm">OFFSET（偏移）</div><div className="gd-w">低 4 位</div></div>
            </div>
            <div className="gd-roles">
              <div className="gd-role t"><div className="gd-ar">↓</div><div className="gd-rh">{Icn.tag}认块：这一路装的是不是它</div><p>剩下的高位全归 tag，跟着块一起存进格子，下次拿它比一比</p></div>
              <div className="gd-role i"><div className="gd-ar">↓</div><div className="gd-rh">{Icn.pin}定组：去哪一行</div><p>8 组要 3 位（2³=8），它算出该进哪一行，没得挑</p></div>
              <div className="gd-role o"><div className="gd-ar">↓</div><div className="gd-rh">{Icn.ruler}定字节：块里第几个</div><p>块 16B 要 4 位（2⁴=16），定位块内位置</p></div>
            </div>
          </div>
        </div>
      </div>

      {/* 第二步 */}
      <div className="gd-sec">
        <div className="gd-st"><i className="gd-sn b2">2</i><b>三段如何连到 Cache：Index 选行，Tag 逐格比对</b></div>
        <div className="gd-s2">
          <div className="gd-panel gd-explain">
            <div className="gd-it i"><div className="gd-ic">{Icn.pin}</div><div><b>Index 选中一行（组）</b><p>根据 index 的值（0~7），直接定位到 Cache 的某一行，没得挑。</p></div></div>
            <div className="gd-it t"><div className="gd-ic">{Icn.tag}</div><div><b>Tag 逐格比对</b><p>把这一行里每个格子存的 tag，拿来和地址的 tag 比较。</p></div></div>
            <div className="gd-it o"><div className="gd-ic">{Icn.doc}</div><div><b>Offset 定位字节</b><p>若命中，再用 offset 找到块内的具体那个字节。</p></div></div>
          </div>

          <div className="gd-panel gd-tbl">
            <div className="gd-tblh">Cache <b>（2 路组相联 · 8 组 · 块 16B）</b></div>
            <table>
              <thead><tr><th className="gd-g"></th><th className="gd-wh">路（Way）0</th><th className="gd-wh">路（Way）1</th></tr></thead>
              <tbody>
                <tr><td className="gd-g">组 0</td><td className="gd-w0">{wayCell}</td><td className="gd-w1">{wayCell}</td></tr>
                <tr><td className="gd-g">组 1</td><td className="gd-w0">{wayCell}</td><td className="gd-w1">{wayCell}</td></tr>
                <tr className="on"><td className="gd-g">组 2</td><td className="gd-w0">{wayCell}</td><td className="gd-w1">{wayCell}</td></tr>
                <tr><td className="gd-g">组 3</td><td className="gd-w0"><span className="gd-cell empty">—</span></td><td className="gd-w1"><span className="gd-cell empty">—</span></td></tr>
                <tr><td className="gd-g gd-blank"></td><td colSpan={2} className="gd-ellip">⋮</td></tr>
                <tr><td className="gd-g">组 7</td><td className="gd-w0">{wayCell}</td><td className="gd-w1">{wayCell}</td></tr>
              </tbody>
            </table>
            <svg className="gd-cmparr" viewBox="0 0 460 30" preserveAspectRatio="none" aria-hidden="true">
              <defs><marker id="gdah" markerWidth="7" markerHeight="7" refX="3.2" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="var(--f-tag)"/></marker></defs>
              <path d="M120 1 C120 16, 230 12, 230 27" fill="none" stroke="color-mix(in srgb, var(--f-tag) 45%, transparent)" strokeWidth="1.6" markerEnd="url(#gdah)"/>
              <path d="M340 1 C340 16, 230 12, 230 27" fill="none" stroke="color-mix(in srgb, var(--f-tag) 45%, transparent)" strokeWidth="1.6" markerEnd="url(#gdah)"/>
            </svg>
            <div className="gd-cmp"><b>Tag 比较（两路并行）</b><p>请求的 tag 与该行两个格子里的 tag 同时比较</p></div>
            <svg className="gd-inarr" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10h13M11 6l5 4-5 4" fill="none" stroke="var(--f-idx)" strokeWidth="1.8"/></svg>
          </div>

          <div className="gd-idxcall">
            <svg className="gd-carr" viewBox="0 0 14 20" aria-hidden="true"><path d="M12 10H2M6 5l-4 5 4 5" fill="none" stroke="color-mix(in srgb, var(--f-idx) 45%, transparent)" strokeWidth="1.6"/></svg>
            Index = <b>2</b><br />选中 组 2（这一行）
          </div>

          <div className="gd-out">
            <div className="gd-st gd-st3"><i className="gd-sn b3">3</i><b>得出结论：命中 or 缺失</b></div>
            <div className="gd-ocard hit">
              <div className="gd-oh">{Icn.check}命中（Hit）</div>
              <div className="gd-eqrow"><span className="gd-tg">地址 Tag</span><span className="gd-eq">=</span><span className="gd-tg">格子 Tag</span></div>
              <p>用 Offset 从该格的数据块中取出所需字节，<b>不必访问内存</b>。</p>
            </div>
            <div className="gd-ocard miss">
              <div className="gd-oh">{Icn.cross}缺失（Miss）</div>
              <p>该行所有格子的 Tag 都不等 —— 从内存把对应的块搬进来，替换掉这一行中某一路的格子（如 <b>LRU / FIFO</b>）。</p>
            </div>
          </div>

          <svg className="gd-s2arr" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
            <defs><marker id="gdah2" markerWidth="8" markerHeight="8" refX="4" refY="3.2" orient="auto"><path d="M0 0 L7 3.2 L0 6.4 Z" fill="var(--now)"/></marker></defs>
            <path d="M660 512 C742 512, 782 132, 806 132" fill="none" stroke="var(--now)" strokeWidth="2.2" strokeDasharray="5 4" opacity=".85" markerEnd="url(#gdah2)"/>
            <path d="M660 524 C748 524, 782 322, 806 322" fill="none" stroke="var(--now)" strokeWidth="2.2" strokeDasharray="5 4" opacity=".85" markerEnd="url(#gdah2)"/>
          </svg>
        </div>
      </div>

      {/* 底部流程带 */}
      <div className="gd-flow">
        <div className="gd-frow">
          <span className="gd-lb">{Icn.star}一句话串起来</span>
          <span className="gd-pill p0">内存地址</span><span className="gd-farr">→</span>
          <span className="gd-pill pd">拆成 Tag / Index / Offset</span><span className="gd-farr">→</span>
          <span className="gd-pill pi">Index 选中一行（组）</span><span className="gd-farr">→</span>
          <span className="gd-pill pt">该行用 Tag 逐格比对</span><span className="gd-farr">→</span>
          <span className="gd-pill ph">命中：取数</span><span className="gd-pill pm">缺失：搬块替换</span>
        </div>
        <div className="gd-why">{Icn.info}<span><b>为什么非要有 tag：</b>多个不同的内存块会算到同一组（比如 0x20、0x220 的 index 都是 2），它们挤在同一行的几个格子里 —— 只能靠 tag 分辨这一格装的到底是不是你要的那一块。</span></div>
      </div>
    </div>
  )
}

// ═══════════════ 虚地址转换与 TLB ═══════════════
function VmDiagram() {
  return (
    <Shell icon={Icn.chip} title="虚地址转换原理"
      sub="看懂：一个虚地址，如何查到它真正的物理位置">
      <Sec n={1} title="一个虚地址，被切成两段">
        <BitField
          cfg={<><div className="gd-cfgt">{Icn.bulb}以默认配置为例</div>
            虚地址 <b>16 位</b>、页 <b>4096B</b>（=2¹²）<br />⇒ 虚页号占 <b>高 4 位</b>（共 16 个虚页）</>}
          segs={[
            { cls: 't', fr: 4, hi: 15, lo: 12, name: '虚页号 VPN', w: '高 4 位',
              role: <>{Icn.tag}认页：这是第几个虚页</>,
              body: '高 4 位选中一个虚页号（0~15），拿它去查：这一页对应哪个物理页框' },
            { cls: 'o', fr: 12, hi: 11, lo: 0, name: '页内偏移 Offset', w: '低 12 位',
              role: <>{Icn.ruler}定字节：页内第几个</>,
              body: '页 4096B 要 12 位（2¹²）。偏移在页框里原样保留，不参与翻译' },
          ]} />
      </Sec>

      <Sec n={2} title="虚页号怎么变成页框号：先查 TLB，再查页表">
        <div className="gd-lane">
          <div className="gd-card hit">
            <h4>{Icn.check}① 先查 TLB（4 项）</h4>
            <p>TLB 是页表的<em>硬件高速缓存</em>，存最近用过的「虚页号 → 页框号」。</p>
            <p>命中 → 直接拿到页框号，<em>一次访存都不用等</em>。</p>
          </div>
          <div className="gd-card i">
            <h4>{Icn.doc}② 未命中 → 查页表</h4>
            <p>页表在<em>内存里</em>，一个虚页一项。有效位=1 → 读出页框号（顺便回填 TLB）。</p>
            <p>有效位=0 → 该页不在内存 → <em>缺页</em>，去磁盘调入。</p>
          </div>
          <div className="gd-card o">
            <h4>{Icn.ruler}③ 拼出物理地址</h4>
            <p>页框号定位到物理页框，页内偏移<em>原样接在后面</em>。</p>
            <p>翻译只换「页号」那一段，偏移一个比特都不改。</p>
          </div>
        </div>
      </Sec>

      <Sec n={3} title="得出结论：物理地址">
        <div className="gd-formula">
          物理地址 = <span className="ft">页框号</span> × 页大小 + <span className="fo">页内偏移</span>
          {'  '}=（<span className="ft">页框号</span> &lt;&lt; 12）| <span className="fo">偏移</span>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '虚地址' }, { cls: 'pd', text: '拆成 虚页号 | 页内偏移' },
          { cls: 'pi', text: '虚页号查 TLB' }, { cls: 'ph', text: '命中：直接给页框' },
          { cls: 'pm', text: '未命中：查页表 / 缺页' }, { cls: 'pt', text: '页框号 拼 偏移 = 物理地址' },
        ]}
        why={<><b>为什么要有 TLB：</b>页表本身在内存里，每次访存都先查页表，等于每读一个数据要访存两次。TLB 把最近用过的「虚页号→页框号」放进硬件，命中就省掉那一次多余的访存 —— 这就是它存在的全部意义。</>} />
    </Shell>
  )
}

// ═══════════════ 子网划分与路由匹配 ═══════════════
function SubnetDiagram() {
  return (
    <Shell icon={Icn.chip} title="IP 地址与子网掩码"
      sub="看懂：一个 IP，如何被掩码切成网络号和主机号">
      <Sec n={1} title="一个 IP 地址（32 位），被掩码切成两段">
        <BitField
          cfg={<><div className="gd-cfgt">{Icn.bulb}以前缀 /25 为例</div>
            IP <b>32 位</b>、前缀 <b>/25</b><br />⇒ 掩码 = <b>255.255.255.128</b>（25 个 1 + 7 个 0）</>}
          segs={[
            { cls: 't', fr: 25, hi: 31, lo: 7, name: '网络号 Network', w: '前 25 位',
              role: <>{Icn.tag}认网段：属于哪个子网</>,
              body: '掩码里为 1 的那些位。同一子网的所有主机，这一段完全相同' },
            { cls: 'o', fr: 7, hi: 6, lo: 0, name: '主机号 Host', w: '后 7 位',
              role: <>{Icn.pin}认主机：网段内第几台</>,
              body: '掩码里为 0 的位。2⁷=128 个地址，去掉网络地址与广播地址，可用 126 台' },
          ]} />
      </Sec>

      <Sec n={2} title="按位与（AND）：IP & 掩码 = 网络号">
        <div className="gd-bits3">
          <div className="r"><span className="rl">IP 地址</span><span><span className="net">1100 1000 . 0000 0001 . 0000 0001 . 1</span><span className="host">000 0101</span></span></div>
          <div className="r"><span className="rl">AND 掩码</span><span><span className="net">1111 1111 . 1111 1111 . 1111 1111 . 1</span><span className="host">000 0000</span></span></div>
          <div className="sep" />
          <div className="r"><span className="rl">= 网络号</span><span><span className="net">1100 1000 . 0000 0001 . 0000 0001 . 1</span><span className="host">000 0000</span></span></div>
        </div>
        <div className="gd-note">{Icn.info}<span><b>看这一列就懂：</b>掩码前 25 位是 1，AND 后 IP 那 25 位<b>原样保留</b>（蓝）；主机那 7 位掩码是 0，AND 后<b>全归零</b>（青）。于是同一子网所有主机都塌缩成同一个网络号。</span></div>
      </Sec>

      <Sec n={3} title="得出结论：路由匹配取「最长前缀」">
        <div className="gd-lane">
          <div className="gd-card t">
            <h4>{Icn.doc}逐条比对路由表</h4>
            <p>把算出的网络号，和路由表每一项的「网络号 / 前缀」逐条比。</p>
          </div>
          <div className="gd-card hit">
            <h4>{Icn.check}多条都命中 → 前缀最长者胜</h4>
            <p>/24 和 /26 都匹配时，选 <em>/26</em> —— 前缀越长，网段划得越细、越精确。</p>
          </div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'IP 地址' }, { cls: 'pd', text: '与掩码按位与' },
          { cls: 'pi', text: '得到网络号' }, { cls: 'pt', text: '和路由表逐条比' },
          { cls: 'ph', text: '多条命中取最长前缀' }, { cls: 'pm', text: '定下一跳' },
        ]}
        why={<><b>为什么按位与就能得网络号：</b>掩码本质是「哪几位属于网络」的开关 —— 前缀那几位是 1，AND 后原样留下；主机那几位是 0，AND 后被抹平。抹掉主机号，剩下的就是这台主机所在的网段。</>} />
    </Shell>
  )
}

// ═══════════════ IEEE 754 浮点 ═══════════════
function FloatDiagram() {
  return (
    <Shell icon={Icn.chip} title="IEEE 754 单精度"
      sub="看懂：32 个比特，如何表示一个带小数的数">
      <Sec n={1} title="32 个比特，被切成三段">
        <BitField
          cfg={<><div className="gd-cfgt">{Icn.bulb}单精度 float</div>
            共 <b>32 位</b> = 符号 <b>1</b> + 阶码 <b>8</b> + 尾数 <b>23</b><br />阶码用<b>移码</b>，偏移量 <b>127</b></>}
          segs={[
            { cls: 't', fr: 3, hi: 31, lo: 31, name: 'S 符号', w: '1 位',
              role: <>{Icn.tag}定正负</>,
              body: '0 为正、1 为负。只管符号，不影响大小' },
            { cls: 'i', fr: 8, hi: 30, lo: 23, name: 'E 阶码', w: '8 位',
              role: <>{Icn.pin}定量级：2 的几次方</>,
              body: '存的是「真实指数 + 127」（移码）。1~254 对应实际指数 −126~+127' },
            { cls: 'o', fr: 23, hi: 22, lo: 0, name: 'M 尾数', w: '23 位',
              role: <>{Icn.ruler}定精度：有效数字</>,
              body: '规格化后整数位那个 1 被省略不存，所以实际精度是 24 位' },
          ]} />
      </Sec>

      <Sec n={2} title="三段如何拼成一个数">
        <div className="gd-formula">
          真值 = (−1)<sup><span className="ft">S</span></sup> × 1.<span className="fo">M</span> × 2<sup>（<span className="fi">E</span> − 127）</sup>
        </div>
        <div className="gd-note">{Icn.info}<span>尾数前面那个隐含的 <b>1.</b> 是白送的一位精度 —— 规格化数的整数位必然是 1，不必占比特。</span></div>
      </Sec>

      <Sec n={3} title="举个例子：0 10000000 100…0 = +3.0">
        <div className="gd-lane">
          <div className="gd-card t"><h4>S = 0</h4><p>符号位 0 → <em>正数</em></p></div>
          <div className="gd-card i"><h4>E = 10000000₂ = 128</h4><p>128 − 127 = <em>1</em> → 乘 2¹</p></div>
          {/*  用户 2026-09-08：「对 M 的解释，应该写 1 + 2^-1 = 1.5；不然看不懂 1.5 怎么来的」。
               原来写的是「1.M = 1.5（1.100…=1.5）」—— 把结论重复了一遍，等于没解释：
               二进制小数点后第一位的权是 2⁻¹，这一步不写出来，1.100₂ 到 1.5 之间就是断的。 */}
          <div className="gd-card o"><h4>M = 100…0</h4>
            <p>1.M = 1.100…₂<br />= 1 + 1×2⁻¹ = 1 + 0.5 = <em>1.5</em></p></div>
        </div>
        <div className="gd-formula" style={{ marginTop: 10 }}>
          (−1)<sup>0</sup> × <span className="fo">1.5</span> × 2<sup>1</sup> = <b>+3.0</b>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '32 位' }, { cls: 'pd', text: '切成 符号|阶码|尾数' },
          { cls: 'pt', text: '符号定正负' }, { cls: 'pi', text: '阶码−127 定 2 的幂' },
          { cls: 'ph', text: '1.尾数 定有效数字' }, { cls: 'pm', text: '拼成真值' },
        ]}
        why={<><b>为什么阶码要减 127（移码）：</b>指数有正有负，若直接存补码，比大小要分符号讨论。统一加 127 变成非负的移码后，两个正浮点数<b>直接按无符号整数比大小</b>就能排序 —— 这让浮点比较能用整数电路完成。</>} />
    </Shell>
  )
}

// ═══════════════ 位示图管理空闲块 ═══════════════
function BitmapDiagram() {
  //  盘块号 21 = 字号 2 × 字长 8 + 位号 5
  const rows = [
    { w: 0, bits: [1, 1, 1, 0, 0, 0, 0, 0] },
    { w: 1, bits: [1, 1, 0, 0, 0, 0, 0, 0] },
    { w: 2, bits: [1, 1, 0, 0, 0, 0, 0, 0], hi: 5 },
  ]
  return (
    <Shell icon={Icn.chip} title="位示图与盘块号"
      sub="看懂：一个比特管一个盘块，字号 + 位号如何换算成盘块号">
      <Sec n={1} title="一位对应一个盘块：字号 × 字长 + 位号 = 盘块号">
        <div className="gd-bm">
          <div className="gd-bmg">
            <div className="gd-bmhdr"><span /><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span></div>
            {rows.map(r => (
              <div className="gd-bmrow" key={r.w}>
                <span className="gd-bmrl">字{r.w}</span>
                {r.bits.map((b, i) => (
                  <span key={i} className={`gd-bmc${r.hi === i ? ' hi' : b ? ' one' : ''}`}>{r.hi === i ? '?' : b}</span>
                ))}
              </div>
            ))}
            <div className="gd-bmhdr" style={{ marginTop: 4 }}><span style={{ gridColumn: '1 / -1', textAlign: 'left', color: 'var(--ghost)' }}>⋮ 共 8 个字 · 管 64 个盘块（1=已占，0=空闲）</span></div>
          </div>
          <div>
            <div className="gd-formula" style={{ textAlign: 'left', fontSize: 14 }}>
              高亮那一位：<br />字号 <span className="ft">2</span> × 字长 <span className="fi">8</span> + 位号 <span className="fo">5</span> = 盘块号 <b>21</b>
            </div>
            <div className="gd-note" style={{ marginTop: 8 }}>{Icn.info}<span><b>反过来：</b>字号 = 盘块号 ÷ 字长（取整）= 21 ÷ 8 = 2；位号 = 盘块号 mod 字长 = 21 mod 8 = 5。</span></div>
          </div>
        </div>
      </Sec>

      <Sec n={2} title="分配与回收，只是把位翻个个儿">
        <div className="gd-lane">
          <div className="gd-card t">
            <h4>{Icn.tag}分配：找 0，置 1</h4>
            <p>要 n 个连续块 → 在位示图里扫出 n 个相邻的 <em>0</em>，把它们置 <em>1</em>。</p>
            <p>算出第一块的字号/位号，就知道从哪个盘块开始。</p>
          </div>
          <div className="gd-card o">
            <h4>{Icn.doc}回收：定位，清 0</h4>
            <p>拿盘块号换算出字号/位号，把对应的位清回 <em>0</em>。</p>
            <p>这一位一空，这个盘块下次就能再被分出去。</p>
          </div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '盘块号' }, { cls: 'pd', text: '÷ 字长 → 字号' },
          { cls: 'pi', text: 'mod 字长 → 位号' }, { cls: 'pt', text: '定位到位示图某一位' },
          { cls: 'ph', text: '置 1：占用' }, { cls: 'pm', text: '清 0：空闲' },
        ]}
        why={<><b>为什么用位示图：</b>一个盘块只用一个比特记「空 / 占」，64 个盘块只要 8 字节，整张表能常驻内存。找空闲块就退化成「找一个 0 位」，分配和回收都只是翻转一个比特 —— 又省空间又快。</>} />
    </Shell>
  )
}

// ═══════════════ 文件索引寻址（混合索引）═══════════════
function InodeDiagram() {
  return (
    <Shell icon={Icn.chip} title="文件的混合索引"
      sub="看懂：一个逻辑块号，如何决定查几级索引、访问几次磁盘">
      <Sec n={1} title="逻辑块号落在哪一档，就走哪一级索引">
        <div className="gd-lad">
          <div className="gd-lrow d">
            <span className="lv">直接地址</span>
            <span className="rg">逻辑块号 0 ~ 9（共 10 个）</span>
            <span className="rd"><b>1</b> 次磁盘访问</span>
          </div>
          <div className="gd-lrow">
            <span className="lv">一级间接</span>
            <span className="rg">10 ~ 265（256 个）</span>
            <span className="rd"><b>2</b> 次</span>
          </div>
          <div className="gd-lrow">
            <span className="lv">二级间接</span>
            <span className="rg">266 ~ 65 801（256² 个）</span>
            <span className="rd"><b>3</b> 次</span>
          </div>
          <div className="gd-lrow">
            <span className="lv">三级间接</span>
            <span className="rg">再往后（256³ 个）</span>
            <span className="rd"><b>4</b> 次</span>
          </div>
        </div>
        <div className="gd-note">{Icn.info}<span><b>K = 每块能放的指针数</b> = 块大小 ÷ 指针大小 = 1024 ÷ 4 = <b>256</b>。一级间接块里装 256 个指针，所以它能多管 256 个数据块。</span></div>
      </Sec>

      <Sec n={2} title="访问几次磁盘 = 索引级数 + 1">
        <div className="gd-formula">
          磁盘访问次数 = <span className="fi">要读几级间接块</span> + <span className="fo">1</span>（最后那次读数据块本身）
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '逻辑块号' }, { cls: 'pd', text: '落在哪一档' },
          { cls: 'ph', text: '0~9：直接 → 1 次' }, { cls: 'pi', text: '再大：走间接' },
          { cls: 'pm', text: '每多一级 +1 次访问' },
        ]}
        why={<><b>为什么用混合索引：</b>绝大多数文件都很小，块号落在直接地址里，<b>1 次访问就拿到数据</b>（快）。只有极大的文件才动用间接块，用少量额外访问换来极大的寻址空间 —— 小文件快、大文件也能装，两头都照顾到。</>} />
    </Shell>
  )
}

// ═══════════════ 页面置换 ═══════════════
function PageDiagram() {
  return (
    <Shell icon={Icn.chip} title="页面置换原理"
      sub="看懂：物理块装不下所有页，缺页时到底该换出谁">
      <Sec n={1} title="每访问一页，只有两种结局">
        <div className="gd-lane">
          <div className="gd-card hit">
            <h4>{Icn.check}命中（Hit）</h4>
            <p>要访问的页<em>已经在</em>某个物理块里 → 直接读，不碰磁盘。</p>
          </div>
          <div className="gd-card miss">
            <h4>{Icn.cross}缺页（Page Fault）</h4>
            <p>该页<em>不在任何物理块</em> → 必须从磁盘调入。</p>
            <p>若物理块已满 → 得先<em>换出一页</em>腾地方 —— 换谁，就是各算法的分歧。</p>
          </div>
        </div>
        <div className="gd-note">{Icn.info}<span>本实验：物理块 <b>3</b> 块，引用串 <b>1 2 3 4 1 2 5 …</b>。块没满时缺页只装入不换出；块满后每次缺页都要挑一个牺牲者。</span></div>
      </Sec>

      <Sec n={2} title="块满了换出谁：四种算法的分歧">
        <div className="gd-lane">
          <div className="gd-card t"><h4>FIFO</h4><p>换<em>最早进来</em>的那页。简单，但可能换掉正热的页（Belady 异常）。</p></div>
          <div className="gd-card i"><h4>LRU</h4><p>换<em>最久没被访问</em>的页。贴近实际局部性，效果好、开销大。</p></div>
          <div className="gd-card o"><h4>OPT</h4><p>换<em>未来最晚才用</em>的页。缺页最少的<em>理论下界</em>，需预知未来、不可实现。</p></div>
          <div className="gd-card hit"><h4>CLOCK</h4><p>给每页一个<em>访问位</em>，转一圈给第二次机会 —— 用低成本近似 LRU。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '访问一页' }, { cls: 'pd', text: '在物理块里吗' },
          { cls: 'ph', text: '在：命中' }, { cls: 'pm', text: '不在：缺页调入' },
          { cls: 'pt', text: '块满 → 按算法换出一页' },
        ]}
        why={<><b>为什么缺页率是关键指标：</b>命中读的是内存，缺页要一次慢速磁盘 IO，两者差几个数量级。置换算法的全部目标，就是在有限的物理块里<b>尽量少缺页</b> —— 换出策略的好坏，直接写在缺页率上。</>} />
    </Shell>
  )
}

// ═══════════════ 磁盘调度 ═══════════════
function DiskDiagram() {
  return (
    <Shell icon={Icn.chip} title="磁盘寻道原理"
      sub="看懂：磁头移动的距离怎么算，算法决定先服务谁">
      <Sec n={1} title="一次移动的代价，就是磁道号之差">
        <div className="gd-formula">
          本步寻道距离 = | <span className="ft">目标磁道</span> − <span className="fo">当前磁道</span> |
          {'   '}累计寻道 = 各步距离之和
        </div>
        <div className="gd-note">{Icn.info}<span>本实验：磁头初始在 <b>53</b> 号，磁道范围 0~199，待服务请求 <b>98 183 37 122 14 124 65 67</b>。寻道（磁头移动）比读写慢得多，所以<b>总寻道距离越小越好</b>。</span></div>
      </Sec>

      <Sec n={2} title="下一个先服务谁：五种算法的分歧">
        <div className="gd-lane">
          <div className="gd-card t"><h4>FCFS</h4><p>按请求<em>先来后到</em>。最公平，但磁头可能来回横跳，距离最长。</p></div>
          <div className="gd-card i"><h4>SSTF</h4><p>永远挑<em>离当前最近</em>的。省距离，但远处请求可能被<em>饿死</em>。</p></div>
          <div className="gd-card o"><h4>SCAN（电梯）</h4><p>朝一个方向<em>扫到底再掉头</em>，沿途顺路服务。像电梯。</p></div>
          <div className="gd-card hit"><h4>C-SCAN / LOOK</h4><p>C-SCAN 扫到底<em>直接跳回起点</em>再扫（更均匀）；LOOK 到<em>最远请求</em>就掉头，不跑到边界。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '当前磁头位置' }, { cls: 'pd', text: '按算法挑下一个请求' },
          { cls: 'pi', text: '移动 = |目标−当前|' }, { cls: 'pt', text: '累加进总寻道' },
          { cls: 'ph', text: '请求全服务完' },
        ]}
        why={<><b>为什么不总用 SSTF：</b>每次挑最近的看着最省，但磁头会赖在密集区，让远处请求一直等 —— 这就是<b>饥饿</b>。SCAN 这类电梯算法牺牲一点总距离，换来「谁都不会等太久」的公平。</>} />
    </Shell>
  )
}

// ═══════════════ 散列表 ═══════════════
function HashDiagram() {
  //  home 槽都对得上 key mod 13：14→1、15→2、19→6，正在插入的 89→11（高亮）
  const slots = [null, '14', '15', null, null, null, '19', null, null, null, null, '?', null]
  return (
    <Shell icon={Icn.chip} title="散列表原理"
      sub="看懂：一个键如何映射到槽，冲突了又怎么办">
      <Sec n={1} title="哈希函数：键 → 槽号">
        <div className="gd-formula">
          槽号 = <span className="ft">key</span> mod <span className="fi">表长 m</span>
          {'   '}例：<span className="ft">89</span> mod <span className="fi">13</span> = <b>11</b>
        </div>
        <div className="gd-bmg" style={{ marginTop: 10 }}>
          <div className="gd-bmhdr" style={{ gridTemplateColumns: 'auto repeat(13,26px)' }}>
            <span />{Array.from({ length: 13 }, (_, i) => <span key={i}>{i}</span>)}
          </div>
          <div className="gd-bmrow" style={{ gridTemplateColumns: 'auto repeat(13,26px)' }}>
            <span className="gd-bmrl">槽</span>
            {slots.map((v, i) => (
              <span key={i} className={`gd-bmc${v === '?' ? ' hi' : v ? ' one' : ''}`} style={{ width: 26 }}>{v ?? ''}</span>
            ))}
          </div>
        </div>
        <div className="gd-note">{Icn.info}<span>每个键先算 <b>home 槽 = key mod 13</b>，落进对应格子。表长常取<b>质数</b>，让 key 撒得更均匀。</span></div>
      </Sec>

      <Sec n={2} title="两个键算到同一槽 = 冲突，四种处理方式">
        <div className="gd-lane">
          <div className="gd-card t"><h4>拉链</h4><p>同一槽挂一条<em>链表</em>，冲突的键往后串。表不会「满」。</p></div>
          <div className="gd-card i"><h4>线性探测</h4><p>被占就往后<em>逐格找空位</em>（+1、+2…）。易堆积成块。</p></div>
          <div className="gd-card o"><h4>平方探测</h4><p>按 <em>+1²、+2²…</em> 跳着找，缓解堆积。</p></div>
          <div className="gd-card hit"><h4>再散列</h4><p>用<em>第二个哈希函数</em>算步长，冲突各走各的路。</p></div>
        </div>
      </Sec>

      <Sec n={3} title="用 ASL 衡量快慢">
        <div className="gd-formula">
          ASL（平均查找长度）= <span className="fi">各键探查次数之和</span> ÷ <span className="fo">键数</span>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'key' }, { cls: 'pd', text: 'mod 表长 → home 槽' },
          { cls: 'ph', text: '空：直接放（探查 1 次）' }, { cls: 'pm', text: '被占：按策略另找' },
          { cls: 'pt', text: '探查次数进 ASL' },
        ]}
        why={<><b>为什么关心装填因子 α = n / m：</b>表越满，冲突越频繁、探查链越长，ASL 就飙升。开放定址一般把 α 控制在 <b>0.75</b> 以内 —— 宁可留空，也不让查找退化成一格一格地扫。</>} />
    </Shell>
  )
}

// ═══════════════ 指令流水线 ═══════════════
const PIPE_STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB']
function pipeRow(label: string, start: number, cols = 8, stall = -1) {
  //  start：第几个周期开始取指（从 1 数）。stall：在某周期插一个气泡。
  const cells: ReactNode[] = []
  for (let c = 1; c <= cols; c++) {
    const idx = c - start - (stall >= 0 && c > stall ? 1 : 0)
    if (c === stall) cells.push(<div key={c} className="gd-pipec stall">⃠</div>)
    else if (idx >= 0 && idx < 5) cells.push(<div key={c} className={`gd-pipec ${PIPE_STAGES[idx]}`}>{PIPE_STAGES[idx]}</div>)
    else cells.push(<div key={c} className="gd-pipec e" />)
  }
  return <div className="gd-piperow" key={label}><span className="gd-pipel">{label}</span>{cells}</div>
}
function PipelineDiagram() {
  return (
    <Shell icon={Icn.chip} title="指令流水线原理"
      sub="看懂：一条指令分五段，为什么会「冒险」、又怎么补救">
      <Sec n={1} title="五段流水：理想情况下每个周期出一条">
        <div className="gd-pipe">
          <div className="gd-pipehd"><span /><span>周期1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span></div>
          {pipeRow('I1', 1)}
          {pipeRow('I2', 2)}
          {pipeRow('I3', 3)}
          {pipeRow('I4', 4)}
        </div>
        <div className="gd-note">{Icn.info}<span>IF 取指 · ID 译码 · EX 执行 · MEM 访存 · WB 写回。四条指令<b>错开一个周期</b>并行，第 5 周期起每周期完成一条 —— 这就是流水线提速的来源。</span></div>
      </Sec>

      <Sec n={2} title="数据冒险：下一条要用上一条还没写回的结果">
        <div className="gd-pipe">
          <div className="gd-pipehd"><span /><span>周期1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span></div>
          {pipeRow('I1 写 R1', 1)}
          {pipeRow('I2 读 R1', 2, 8, 4)}
        </div>
        <div className="gd-note">{Icn.info}<span>I1 到<b>第 5 周期</b>才把结果写回 R1，可 I2 在<b>第 4 周期</b>就要读 R1 —— 读到的是旧值。这就是<b>数据冒险</b>，图中斜纹是被迫插入的「气泡」（停顿）。</span></div>
      </Sec>

      <Sec n={3} title="两种补救：前递 与 分支冲刷">
        <div className="gd-lane">
          <div className="gd-card hit">
            <h4>{Icn.check}前递（Forwarding）</h4>
            <p>结果在 EX 段算出来后，<em>不等写回</em>，直接从流水线寄存器抄给下一条用 —— 多数数据冒险<em>不用停顿</em>就能解。</p>
          </div>
          <div className="gd-card miss">
            <h4>{Icn.cross}分支冲刷（Flush）</h4>
            <p>beq / bne 要到 EX 段才知道跳不跳，可后面的指令<em>已经进了管线</em>。判定为跳转 → 把它们<em>作废</em>，白跑几个周期。</p>
          </div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '指令分五段' }, { cls: 'pd', text: '错开一周期并行' },
          { cls: 'pm', text: '后条要用前条结果 → 数据冒险' }, { cls: 'ph', text: '前递：抄结果不停顿' },
          { cls: 'pt', text: '分支跳转 → 冲刷已进管的指令' },
        ]}
        why={<><b>为什么流水线还是划算：</b>冒险和冲刷确实会浪费几个周期，但只要它们不频繁，五段并行带来的吞吐提升远大于这点损失 —— 前递和分支预测就是把「浪费」压到最小的两把工具。</>} />
    </Shell>
  )
}

// ═══════════════ 定点乘除逐步 ═══════════════
function MultiplyDiagram() {
  return (
    <Shell icon={Icn.chip} title="定点乘法原理"
      sub="看懂：乘法为什么是「反复地 加一加、右移一位」">
      <Sec n={1} title="核心动作：看乘数的位 → 决定加不加 → 部分积右移">
        <div className="gd-formula" style={{ textAlign: 'left', fontSize: 13.5 }}>
          循环 n 次（n = 位数）：<br />
          ① 看<span className="ft">乘数最低位</span> → 决定这一轮<span className="fi">加不加被乘数</span><br />
          ② <span className="fo">部分积连同乘数一起右移一位</span>（低位挤出去、腾出高位）
        </div>
        <div className="gd-note">{Icn.info}<span>本实验：Booth 算法、8 位、<b>5 × 3</b>。手算竖式里「错位相加」的错位，在机器里就是这一步一步的<b>右移</b>。</span></div>
      </Sec>

      <Sec n={2} title="三种算法，分歧只在「这一轮看什么、做什么」">
        <div className="gd-lane">
          <div className="gd-card t"><h4>原码一位乘</h4><p>只看乘数<em>当前 1 位</em>：是 1 就加被乘数，是 0 就不加，然后右移。符号单独算。</p></div>
          <div className="gd-card i"><h4>Booth（补码）</h4><p>看<em>相邻两位</em> yᵢyᵢ₋₁：01 加、10 减、00/11 不动。能直接处理<em>带符号数</em>。</p></div>
          <div className="gd-card o"><h4>加减交替（除法）</h4><p>余数够减就<em>减</em>、上商 1；不够减就<em>加回</em>、上商 0，再左移。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '被乘数 · 乘数' }, { cls: 'pd', text: '看乘数的位' },
          { cls: 'ph', text: '该加就加被乘数' }, { cls: 'pt', text: '部分积右移一位' },
          { cls: 'pm', text: '重复 n 轮 → 乘积' },
        ]}
        why={<><b>为什么用移位代替错位相加：</b>手算竖式把每个部分积「往左错一位」再一次性加总；机器里没有无限宽的加法器，于是反过来 —— 让<b>部分积每轮右移一位</b>，用同一个加法器反复累加。空间换成了时间，硬件简单得多。</>} />
    </Shell>
  )
}

// ═══════════════ 进程调度甘特图 ═══════════════
function SchedulerDiagram() {
  return (
    <Shell icon={Icn.chip} title="进程调度的三个时间"
      sub="看懂：甘特图上那些数字（周转 / 等待 / 带权）到底怎么来的">
      <Sec n={1} title="一个进程的一生，画在时间轴上">
        <div className="gd-strip">
          <div className="gd-seg" style={{ flex: 2, background: 'color-mix(in srgb,var(--ghost) 30%,transparent)', color: 'var(--dim)' }}>到达前</div>
          <div className="gd-seg" style={{ flex: 3, background: 'color-mix(in srgb,var(--miss) 30%,transparent)', color: 'var(--miss)' }}>就绪等待</div>
          <div className="gd-seg" style={{ flex: 4, background: 'color-mix(in srgb,var(--f-tag) 55%,transparent)' }}>运行（服务时间）</div>
        </div>
        <div className="gd-scale"><span>↑ 到达时刻</span><span>↑ 开始运行</span><span>↑ 完成时刻</span></div>
        <div className="gd-note">{Icn.info}<span>进程<b>到达</b>后不一定马上能上 CPU —— 得排队<b>等待</b>；轮到它才<b>运行</b>；跑完就<b>完成</b>。三个时间指标全从这条轴上量出来。</span></div>
      </Sec>

      <Sec n={2} title="三个指标，都是这条轴上的减法">
        <div className="gd-formula" style={{ textAlign: 'left', fontSize: 13.5 }}>
          <span className="ft">周转时间</span> = 完成时刻 − 到达时刻<br />
          <span className="fo">等待时间</span> = 周转时间 − 服务时间（运行那段）<br />
          <span className="fi">带权周转</span> = 周转时间 ÷ 服务时间　（越接近 1 越好）
        </div>
      </Sec>

      <Sec n={3} title="抢占 or 不抢占，决定这条轴会不会被切开">
        <div className="gd-lane">
          <div className="gd-card t"><h4>FCFS / SJF（非抢占）</h4><p>一旦上 CPU 就<em>跑到底</em>，运行段是<em>连续</em>的一整块。</p></div>
          <div className="gd-card i"><h4>SRTF / RR（抢占）</h4><p>可被更急的进程或<em>时间片</em>打断，运行段被<em>切成几段</em>，中间夹着别人。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '到达' }, { cls: 'pd', text: '就绪队列里等' },
          { cls: 'pi', text: '被调度上 CPU 运行' }, { cls: 'ph', text: '完成' },
          { cls: 'pt', text: '完成−到达 = 周转' },
        ]}
        why={<><b>为什么用带权周转比：</b>一个跑 100ms 的任务等 10ms，和一个跑 1ms 的任务等 10ms，绝对等待一样，但后者「体感」慢得多。带权周转（周转÷服务）把这种<b>相对代价</b>暴露出来 —— 短任务被拖，数值会很扎眼。</>} />
    </Shell>
  )
}

// ═══════════════ 银行家算法 ═══════════════
function BankerDiagram() {
  //  用本实验默认数据，Need = Max − Allocation（现算，保证对得上）
  const rows = [
    { p: 'P0', max: [7, 5, 3], alloc: [0, 1, 0] },
    { p: 'P1', max: [3, 2, 2], alloc: [2, 0, 0] },
    { p: 'P2', max: [9, 0, 2], alloc: [3, 0, 2] },
  ]
  return (
    <Shell icon={Icn.chip} title="银行家算法原理"
      sub="看懂：Need 怎么算，「安全序列」又是在保证什么">
      <Sec n={1} title="三张表：还需要多少 = 最多要 − 已经拿">
        <table className="gd-mtbl">
          <thead><tr><th rowSpan={2}>进程</th><th colSpan={3}>Max 最多需要</th><th colSpan={3}>Allocation 已分配</th><th colSpan={3}>Need 还需要</th></tr>
            <tr><th>A</th><th>B</th><th>C</th><th>A</th><th>B</th><th>C</th><th>A</th><th>B</th><th>C</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.p}>
                <td className="gd-mtg">{r.p}</td>
                {r.max.map((v, i) => <td key={'m' + i}>{v}</td>)}
                {r.alloc.map((v, i) => <td key={'a' + i}>{v}</td>)}
                {r.max.map((v, i) => <td key={'n' + i} className="need">{v - r.alloc[i]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="gd-note">{Icn.info}<span><b>Need = Max − Allocation</b>，逐列相减。例如 P0：7−0=<b>7</b>、5−1=<b>4</b>、3−0=<b>3</b>。（表只列前 3 个进程示意，其余同理。）</span></div>
      </Sec>

      <Sec n={2} title="批一笔请求前，先在草稿纸上试跑一遍">
        <div className="gd-lane">
          <div className="gd-card t"><h4>① 试探分配</h4><p>假装把资源给它，更新 Available / Allocation / Need（只在<em>草稿</em>上）。</p></div>
          <div className="gd-card i"><h4>② 找安全序列</h4><p>看能否排出一个顺序，让<em>每个进程的 Need 都 ≤ 当前可用</em>，依次跑完、归还资源。</p></div>
          <div className="gd-card hit"><h4>③ 安全才批</h4><p>找得到这样的顺序 → <em>安全</em>，真的分配；找不到 → 撤销，让它<em>等</em>。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '进程请求资源' }, { cls: 'pd', text: '试探性分配（草稿）' },
          { cls: 'pi', text: '跑安全性算法' }, { cls: 'ph', text: '存在安全序列：批准' },
          { cls: 'pm', text: '找不到：撤销、等待' },
        ]}
        why={<><b>「安全序列」在保证什么：</b>它保证<b>至少存在一种</b>推进顺序，能让所有进程都拿到各自还差的资源、跑完、把资源还回来。只要这条后路在，系统就绝不会走进「人人都在等、人人都不释放」的死锁 —— 银行家宁可让你先等，也不批一笔断了后路的贷款。</>} />
    </Shell>
  )
}

// ═══════════════ 动态分区分配 ═══════════════
function PartitionDiagram() {
  return (
    <Shell icon={Icn.chip} title="动态分区分配原理"
      sub="看懂：四种放置策略挑哪个空闲块，外碎片又是怎么来的">
      <Sec n={1} title="内存里散着几个大小不一的空闲块">
        <div className="gd-strip">
          <div className="gd-seg used" style={{ flex: 120 }}>已用 120K</div>
          <div className="gd-seg free" style={{ flex: 100 }}>空闲 100K</div>
          <div className="gd-seg used" style={{ flex: 150 }}>已用 150K</div>
          <div className="gd-seg free" style={{ flex: 60 }}>空闲 60K</div>
          <div className="gd-seg used" style={{ flex: 90 }}>已用 90K</div>
          <div className="gd-seg free" style={{ flex: 120 }}>空闲 120K</div>
        </div>
        <div className="gd-note">{Icn.info}<span>示意：现在来一个作业申请 <b>50K</b>。三个空闲块 100K / 60K / 120K 都装得下 —— <b>挑哪个</b>，就是四种策略的分歧。</span></div>
      </Sec>

      <Sec n={2} title="四种放置策略：怎么挑那个空闲块">
        <div className="gd-lane">
          <div className="gd-card t"><h4>首次适应</h4><p>从头扫，<em>第一个</em>够大的就用（上例选 100K）。快，低地址易积碎片。</p></div>
          <div className="gd-card i"><h4>最佳适应</h4><p>选<em>最小的</em>够用块（选 60K）。省大块，但剩下的碎渣最难再用。</p></div>
          <div className="gd-card o"><h4>最坏适应</h4><p>选<em>最大的</em>块（选 120K）。剩下的部分还够大，能再分。</p></div>
          <div className="gd-card hit"><h4>邻近适应</h4><p>从<em>上次分配的位置</em>接着往下找，不每次从头扫。</p></div>
        </div>
      </Sec>

      <Sec n={3} title="外碎片：够用的总量有，却拼不到一起">
        <div className="gd-strip">
          <div className="gd-seg used" style={{ flex: 3 }}>已用</div>
          <div className="gd-seg frag" style={{ flex: 1 }}>10K</div>
          <div className="gd-seg used" style={{ flex: 3 }}>已用</div>
          <div className="gd-seg frag" style={{ flex: 1 }}>15K</div>
          <div className="gd-seg used" style={{ flex: 3 }}>已用</div>
          <div className="gd-seg frag" style={{ flex: 1 }}>12K</div>
        </div>
        <div className="gd-note">{Icn.info}<span>空闲总量 10+15+12 = <b>37K</b>，可它们被已用块<b>隔开</b>，来个 30K 的作业照样装不下 —— 这就是<b>外碎片</b>。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '作业申请 N KB' }, { cls: 'pd', text: '扫空闲分区表' },
          { cls: 'pi', text: '按策略挑一个够用的块' }, { cls: 'ph', text: '割一块给它' },
          { cls: 'pm', text: '剩余太小 → 外碎片' },
        ]}
        why={<><b>为什么策略会影响碎片：</b>「最佳适应」每次留下最小的边角，久了满地是谁都用不了的碎渣；「最坏适应」专挑大块开刀，剩下的还够大能再分。挑哪个块，本质是在<b>权衡「省大块」和「少留碎渣」</b> —— 没有免费的午餐。</>} />
    </Shell>
  )
}

// ═══════════════ 信号量与生产者消费者 ═══════════════
function SemaphoreDiagram() {
  return (
    <Shell icon={Icn.chip} title="信号量与 P / V 操作"
      sub="看懂：P / V 在做什么，为什么 P 的顺序错了会死锁">
      <Sec n={1} title="信号量就是一个计数器，只能用 P / V 动它">
        <div className="gd-lane">
          <div className="gd-card i"><h4>P(S)：想进 / 想取</h4><p>S <em>减 1</em>。若减完 &lt; 0 → 资源没了，<em>阻塞</em>自己去排队等。</p></div>
          <div className="gd-card hit"><h4>V(S)：用完 / 放回</h4><p>S <em>加 1</em>。若有进程在等 → <em>唤醒</em>其中一个。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>生产者消费者用三个信号量：<b>empty</b>（空槽数，初值=缓冲区大小）、<b>full</b>（满槽数，初值 0）、<b>mutex</b>（互斥锁，初值 1）。</span></div>
      </Sec>

      <Sec n={2} title="正确的配对：资源信号量在外，互斥锁在里">
        <div className="gd-lane">
          <div className="gd-card t"><h4>生产者</h4><p>P(<em>empty</em>) → P(<em>mutex</em>) → 放入 → V(<em>mutex</em>) → V(<em>full</em>)</p></div>
          <div className="gd-card o"><h4>消费者</h4><p>P(<em>full</em>) → P(<em>mutex</em>) → 取出 → V(<em>mutex</em>) → V(<em>empty</em>)</p></div>
        </div>
      </Sec>

      <Sec n={3} title="顺序一颠倒，就会死锁">
        <div className="gd-card miss">
          <h4>{Icn.cross}错序：先 P(mutex) 再 P(empty)</h4>
          <p>缓冲区满时，生产者<em>先抢到 mutex</em>，再 P(empty) 发现没空槽 → <em>抱着锁睡着了</em>。消费者想取数据得先 P(mutex)，可锁在生产者手里 → <em>也卡住</em>。谁都动不了 —— <b>死锁</b>。</p>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '想访问缓冲区' }, { cls: 'pd', text: '先 P 资源信号量(empty/full)' },
          { cls: 'pi', text: '再 P(mutex) 进临界区' }, { cls: 'ph', text: '操作完 V(mutex)' },
          { cls: 'pt', text: '最后 V 对方的资源信号量' },
        ]}
        why={<><b>为什么互斥锁必须在最里层：</b>mutex 只是保护「同一时刻只有一个人动缓冲区」，它不该背负「等资源」的责任。把等资源的 P(empty/full) 放在<b>抢锁之前</b>，就不会出现「占着锁却在等资源」——一旦占锁又睡着，整条链就锁死了。</>} />
    </Shell>
  )
}

// ═══════════════ TCP 拥塞窗口 ═══════════════
function TcpDiagram() {
  return (
    <Shell icon={Icn.chip} title="TCP 拥塞窗口原理"
      sub="看懂：cwnd 为什么先猛涨、再缓爬、一丢包就跳水">
      <Sec n={1} title="拥塞窗口随时间（RTT）的走势">
        <div className="gd-curve">
          <svg viewBox="0 0 420 170" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 轴 */}
            <line x1="34" y1="8" x2="34" y2="148" stroke="var(--line)" strokeWidth="1" />
            <line x1="34" y1="148" x2="410" y2="148" stroke="var(--line)" strokeWidth="1" />
            <text x="6" y="20" fontSize="10" fill="var(--ghost)">cwnd</text>
            <text x="388" y="163" fontSize="10" fill="var(--ghost)">RTT</text>
            {/* ssthresh 虚线 */}
            <line x1="34" y1="46" x2="410" y2="46" stroke="var(--f-off)" strokeWidth="1" strokeDasharray="4 4" opacity=".7" />
            <text x="300" y="42" fontSize="9.5" fill="var(--f-off)">ssthresh 门限</text>
            {/* 慢启动：指数 */}
            <polyline points="34,144 60,138 84,126 106,100 124,46" fill="none" stroke="var(--f-tag)" strokeWidth="2.4" />
            {/* 拥塞避免：线性 */}
            <polyline points="124,46 210,22" fill="none" stroke="var(--f-idx)" strokeWidth="2.4" />
            {/* 丢包跳水 */}
            <polyline points="210,22 210,96" fill="none" stroke="var(--miss)" strokeWidth="2.4" strokeDasharray="3 3" />
            {/* 恢复后线性 */}
            <polyline points="210,96 320,64" fill="none" stroke="var(--f-idx)" strokeWidth="2.4" />
            <circle cx="210" cy="22" r="3.5" fill="var(--miss)" />
            <text x="150" y="112" fontSize="10" fill="var(--f-tag)">慢启动·指数</text>
            <text x="150" y="18" fontSize="10" fill="var(--f-idx)">拥塞避免·线性</text>
            <text x="216" y="60" fontSize="10" fill="var(--miss)">丢包</text>
          </svg>
          <div className="gd-clab">
            <span><i style={{ background: 'var(--f-tag)' }} />慢启动：每个 RTT 翻倍</span>
            <span><i style={{ background: 'var(--f-idx)' }} />拥塞避免：每个 RTT +1</span>
            <span><i style={{ background: 'var(--miss)' }} />丢包：门限砍半</span>
          </div>
        </div>
        <div className="gd-note">{Icn.info}<span>本实验：Reno、初始 cwnd=1、ssthresh=16。<b>cwnd 到达 ssthresh 前指数涨，之后转线性</b>，探到丢包就调整门限、重来。</span></div>
      </Sec>

      <Sec n={2} title="三个阶段：涨法不同">
        <div className="gd-lane">
          <div className="gd-card t"><h4>慢启动</h4><p>cwnd 从 1 起，<em>每个 RTT 翻倍</em>（指数增长）。快速试探带宽，到 ssthresh 就收手。</p></div>
          <div className="gd-card i"><h4>拥塞避免</h4><p>过了 ssthresh，改成<em>每个 RTT 只加 1</em>（线性），小心翼翼逼近极限。</p></div>
          <div className="gd-card hit"><h4>快恢复</h4><p>Reno 收到 3 个重复 ACK：ssthresh 砍半、cwnd 设为新门限，<em>不从 1 重来</em>。</p></div>
        </div>
      </Sec>

      <Sec n={3} title="丢包了怎么退：Tahoe 与 Reno 的分歧">
        <div className="gd-lane">
          <div className="gd-card miss"><h4>{Icn.cross}Tahoe：一律回到 1</h4><p>不管超时还是重复 ACK，ssthresh 砍半、<em>cwnd 直接归 1</em>，重新慢启动。</p></div>
          <div className="gd-card hit"><h4>{Icn.check}Reno：分情况</h4><p>超时 → 回 1；但只是 <em>3 个重复 ACK</em>（网络还通）→ 进快恢复，只砍半不归零。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'cwnd = 1' }, { cls: 'pd', text: '慢启动：每 RTT 翻倍' },
          { cls: 'pi', text: '到 ssthresh → 转线性' }, { cls: 'pm', text: '丢包：门限砍半' },
          { cls: 'pt', text: 'Reno 快恢复 / Tahoe 归 1' },
        ]}
        why={<><b>为什么要先指数再线性：</b>刚开始不知道网络能扛多少，指数增长<b>快速摸高</b>省时间；一旦接近上次出事的门限，就改成线性<b>小步试探</b>，避免一脚踩进拥塞。快涨探边界、慢涨保平稳 —— 两种节奏各司其职。</>} />
    </Shell>
  )
}

// ═══════════════ 滑动窗口 ARQ ═══════════════
function ArqDiagram() {
  //  发送窗口 4，覆盖帧 2~5：0/1 已确认，2/3 已发未确认，4/5 可发，6/7 窗外
  const frames = [
    { n: 0, k: 'ack' }, { n: 1, k: 'ack' }, { n: 2, k: 'sent' }, { n: 3, k: 'sent' },
    { n: 4, k: 'can' }, { n: 5, k: 'can' }, { n: 6, k: 'out' }, { n: 7, k: 'out' },
  ]
  const col = (k: string) => k === 'ack' ? 'var(--hit)' : k === 'sent' ? 'var(--f-tag)' : k === 'can' ? 'var(--f-idx)' : 'var(--ghost)'
  return (
    <Shell icon={Icn.chip} title="滑动窗口 ARQ 原理"
      sub="看懂：发送窗口是什么，三种协议出错后怎么处理">
      <Sec n={1} title="发送窗口：还没确认，最多能连发几帧">
        <div style={{ display: 'flex', gap: 4 }}>
          {frames.map(f => (
            <div key={f.n} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 34, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mono)', fontWeight: 700, color: f.k === 'out' ? 'var(--ghost)' : '#fff',
                background: f.k === 'out' ? 'transparent' : `color-mix(in srgb, ${col(f.k)} 70%, transparent)`,
                border: f.k === 'out' ? '1px dashed var(--line)' : 'none',
              }}>{f.n}</div>
              {f.n >= 2 && f.n <= 5 && <div style={{ fontSize: 10, color: 'var(--f-tag)', marginTop: 3 }}>{f.n === 2 ? '└─ 窗口 (4 帧)' : ''}</div>}
            </div>
          ))}
        </div>
        <div className="gd-clab" style={{ marginTop: 10 }}>
          <span><i style={{ background: 'var(--hit)' }} />已确认（窗口左移越过）</span>
          <span><i style={{ background: 'var(--f-tag)' }} />已发送、等确认</span>
          <span><i style={{ background: 'var(--f-idx)' }} />窗口内可发</span>
          <span><i style={{ background: 'var(--ghost)' }} />窗口外，不能发</span>
        </div>
        <div className="gd-note">{Icn.info}<span>窗口大小 = <b>不必等确认就能连续发</b>的帧数。确认一到，窗口<b>向右滑</b>，露出新的可发帧。窗口越大，链路利用率越高。</span></div>
      </Sec>

      <Sec n={2} title="出错怎么办：三种协议的分歧">
        <div className="gd-lane">
          <div className="gd-card t"><h4>停止等待 SW</h4><p>窗口=1。发一帧、<em>死等</em>它的确认才发下一帧。最简单，也最慢。</p></div>
          <div className="gd-card i"><h4>后退 N 帧 GBN</h4><p>累计确认。一帧出错，它<em>之后已发的全部重传</em> —— 接收方只认按序的。</p></div>
          <div className="gd-card hit"><h4>选择重传 SR</h4><p>接收方<em>缓存</em>失序的正确帧，<em>只重传出错的那一帧</em>。最省，但两端都要缓存。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '发送窗口 = N' }, { cls: 'pd', text: '窗内可连发 N 帧' },
          { cls: 'pi', text: '收到确认 → 窗口右滑' }, { cls: 'pm', text: '出错 / 超时' },
          { cls: 'pt', text: 'GBN 回退重传 / SR 只重传坏帧' },
        ]}
        why={<><b>为什么要滑动窗口：</b>停止等待每发一帧都要空等一个来回，链路大半时间在闲置。窗口允许「<b>边发边等确认</b>」，把往返时延填满 —— 窗口开多大，直接决定了带宽利用率的上限。</>} />
    </Shell>
  )
}

// ═══════════════ CRC 循环冗余校验 ═══════════════
function CrcDiagram() {
  return (
    <Shell icon={Icn.chip} title="CRC 校验原理"
      sub="看懂：冗余位怎么算出来，收端又怎么判断有没有错">
      <Sec n={1} title="核心：补 0 → 模 2 除法 → 余数就是冗余位">
        <div className="gd-bits3">
          <div className="r"><span className="rl">数据 (4 位)</span><span><span className="net">1010</span></span></div>
          <div className="r"><span className="rl">生成多项式</span><span>10011（5 位 → 冗余 <b>r = 4</b> 位）</span></div>
          <div className="sep" />
          <div className="r"><span className="rl">补 r 个 0</span><span><span className="net">1010</span><span className="host"> 0000</span> ← 被除数</span></div>
          <div className="r"><span className="rl">模 2 除法</span><span>÷ 10011（异或，不借位）→ 余数 <span className="host">1101</span></span></div>
          <div className="sep" />
          <div className="r"><span className="rl">发送码字</span><span><span className="net">1010</span><span className="host">1101</span>（数据 + 冗余，共 8 位）</span></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「模 2 除法」就是<b>逐位异或</b>：当前最高位是 1 就和生成多项式 XOR，是 0 就跳过。除到最后剩下的 r 位，就是要补的冗余位。</span></div>
      </Sec>

      <Sec n={2} title="收端怎么判错：再除一次，看余数">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>{Icn.check}余数 = 0 → 认为无错</h4><p>收到的整个码字，再用同一个生成多项式除。除得尽（余 0）→ 传输正确，取前面的数据位。</p></div>
          <div className="gd-card miss"><h4>{Icn.cross}余数 ≠ 0 → 检出错误</h4><p>某些位翻转会让余数非零 → 丢弃 / 请求重传。CRC 只<em>检错</em>不纠错。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '数据' }, { cls: 'pd', text: '后补 r 个 0' },
          { cls: 'pi', text: '模 2 除以生成多项式' }, { cls: 'pt', text: '余数 = 冗余位，拼成码字' },
          { cls: 'ph', text: '收端再除：余 0 无错' }, { cls: 'pm', text: '余数 ≠ 0：有错' },
        ]}
        why={<><b>为什么补 0 再除、余数就能检错：</b>补 0 是给冗余位<b>占好空位</b>；把余数填进这些空位，整个码字就变成能被生成多项式整除的数。传输中一旦有位翻转，这个「整除」关系就大概率被破坏 —— 收端一除除不尽，错误就露馅了。</>} />
    </Shell>
  )
}

// ═══════════════ 海明码 ═══════════════
function HammingDiagram() {
  //  7 位码：位 1/2/4 是校验位，3/5/6/7 是数据位
  const bits = [
    { p: 1, kind: 'p', name: 'P1' }, { p: 2, kind: 'p', name: 'P2' }, { p: 3, kind: 'd', name: 'D1' },
    { p: 4, kind: 'p', name: 'P4' }, { p: 5, kind: 'd', name: 'D2' }, { p: 6, kind: 'd', name: 'D3' }, { p: 7, kind: 'd', name: 'D4' },
  ]
  return (
    <Shell icon={Icn.chip} title="海明码原理"
      sub="看懂：校验位放在哪，为什么能定位到出错的那一位">
      <Sec n={1} title="校验位坐在 2 的幂位置上">
        <div style={{ display: 'flex', gap: 5 }}>
          {bits.map(b => (
            <div key={b.p} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--ghost)', fontFamily: 'var(--mono)' }}>位 {b.p}</div>
              <div style={{
                height: 40, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mono)', fontWeight: 700, marginTop: 3,
                color: b.kind === 'p' ? 'var(--f-idx)' : 'var(--f-tag)',
                background: `color-mix(in srgb, ${b.kind === 'p' ? 'var(--f-idx)' : 'var(--f-tag)'} 14%, transparent)`,
                border: `1.5px solid color-mix(in srgb, ${b.kind === 'p' ? 'var(--f-idx)' : 'var(--f-tag)'} 45%, transparent)`,
              }}>{b.name}</div>
            </div>
          ))}
        </div>
        <div className="gd-note">{Icn.info}<span>位号是 <b>2 的幂（1、2、4、8…）</b>的放<b className="need"> </b><span style={{ color: 'var(--f-idx)', fontWeight: 700 }}>校验位</span>，其余放<span style={{ color: 'var(--f-tag)', fontWeight: 700 }}>数据位</span>。4 个数据位需要 3 个校验位（2³ ≥ 4+3+1）。</span></div>
      </Sec>

      <Sec n={2} title="每个校验位管一组：看位号的二进制">
        <div className="gd-lane">
          <div className="gd-card i"><h4>P1 管第 1 位为 1 的</h4><p>位 <em>1、3、5、7</em>（二进制末位是 1 的）</p></div>
          <div className="gd-card i"><h4>P2 管第 2 位为 1 的</h4><p>位 <em>2、3、6、7</em>（二进制第 2 位是 1 的）</p></div>
          <div className="gd-card i"><h4>P4 管第 3 位为 1 的</h4><p>位 <em>4、5、6、7</em>（二进制第 3 位是 1 的）</p></div>
        </div>
      </Sec>

      <Sec n={3} title="定位出错位：三个校验结果拼成二进制">
        <div className="gd-formula">
          出错位号 = <span className="fo">P4 结果</span> <span className="fi">P2 结果</span> <span className="ft">P1 结果</span>（二进制）
          {'   '}例：<span className="fo">1</span><span className="fi">0</span><span className="ft">1</span> = 第 <b>5</b> 位错
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '数据位' }, { cls: 'pd', text: '校验位插进 2 的幂位置' },
          { cls: 'pi', text: '每位校验管一组' }, { cls: 'pm', text: '收端逐组重算' },
          { cls: 'pt', text: '结果拼二进制 = 出错位号' },
        ]}
        why={<><b>为什么拼起来正好是位号：</b>每个校验位管的正是「位号二进制里那一位为 1」的所有位。哪一位出错，它就会让<b>覆盖到它的每个校验组</b>都失败。把失败的校验位对应的权值（1、2、4）加起来，正好还原出那一位的位号 —— 校验结果直接指出错在第几位。</>} />
    </Shell>
  )
}

// ═══════════════ TCP 连接管理（握手/挥手）═══════════════
function HandshakeDiagram() {
  return (
    <Shell icon={Icn.chip} title="TCP 三次握手"
      sub="看懂：建立连接为什么要三次，少一次会怎样">
      <Sec n={1} title="三个报文段，把连接建起来">
        <div className="gd-lane" style={{ gridAutoFlow: 'row' }}>
          <div className="gd-card t"><h4>① 客户端 → 服务器　SYN</h4><p><em>SYN=1, seq=100</em>。客户端申请连接，进入 <em>SYN_SENT</em>。「我想连，我的初始序号是 100。」</p></div>
          <div className="gd-card o"><h4>② 服务器 → 客户端　SYN + ACK</h4><p><em>SYN=1, ACK=1, seq=300, ack=101</em>。进入 <em>SYN_RCVD</em>。「同意，我的序号是 300，已收到你的 100。」</p></div>
          <div className="gd-card hit"><h4>③ 客户端 → 服务器　ACK</h4><p><em>ACK=1, ack=301</em>。双方进入 <em>ESTABLISHED</em>。「收到你的 300，开始传数据。」</p></div>
        </div>
      </Sec>

      <Sec n={2} title="为什么是三次，不是两次">
        <div className="gd-card miss">
          <h4>{Icn.cross}只握两次的隐患</h4>
          <p>若少了第 ③ 步，服务器发完 SYN+ACK 就认为连接建立。可万一一个<em>早已失效的旧 SYN</em> 绕路后才到达服务器，服务器会误以为客户端要连，<em>白白建立并等待</em>一个根本不存在的连接。</p>
          <p>第三次 ACK 让<em>客户端最终确认</em>：这条连接是我此刻真想要的 —— 两端对「都准备好了」达成一致，旧报文就骗不了人。</p>
        </div>
        <div className="gd-note">{Icn.info}<span>断开要<b>四次挥手</b>（FIN→ACK→FIN→ACK）：因为连接是全双工的，两个方向要<b>各关一次</b>，被动方可能还有数据要发完才关。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '客户端 SYN' }, { cls: 'pd', text: '服务器 SYN+ACK' },
          { cls: 'pi', text: '客户端 ACK' }, { cls: 'ph', text: '双方 ESTABLISHED' },
          { cls: 'pt', text: '（断开另需四次挥手）' },
        ]}
        why={<><b>三次握手的本质：</b>要让通信双方都确认「<b>我发得出、你收得到；你发得出、我收得到</b>」这四件事。第一次证明客户端能发、服务器能收；第二次证明服务器能发、客户端能收；第三次让服务器确认客户端确实收到了它的响应 —— 三次是同步双方初始序号、又能识破旧连接的最小次数。</>} />
    </Shell>
  )
}

// ═══════════════ CSMA/CD 与退避 ═══════════════
function CsmaDiagram() {
  return (
    <Shell icon={Icn.chip} title="CSMA/CD 原理"
      sub="看懂：先听后发、边发边听，冲突了怎么退避">
      <Sec n={1} title="发送前后都在「听」信道">
        <div className="gd-lane">
          <div className="gd-card t"><h4>CS 载波监听：先听后发</h4><p>发之前先<em>侦听信道</em>：忙 → 等；空闲 → 才发。别人正说话时不插嘴。</p></div>
          <div className="gd-card i"><h4>CD 冲突检测：边发边听</h4><p>发的同时继续听。若听到信号被<em>别人叠加破坏</em> → 发生冲突，<em>立即停发</em>，别浪费信道。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>两个站可能<b>同时</b>侦听到空闲、同时开发 —— 信号在线上撞到一起，就是<b>冲突</b>。检测到冲突后，双方都要退避一会儿再试。</span></div>
      </Sec>

      <Sec n={2} title="二进制指数退避：冲突越多，等得越久">
        <div className="gd-formula" style={{ textAlign: 'left', fontSize: 13.5 }}>
          第 <span className="fi">k</span> 次冲突后：从 <span className="ft">0 ~ 2<sup>k</sup> − 1</span> 里随机取一个整数 r，<br />
          等待 <span className="fo">r × 争用期（2τ）</span> 再重发（k 最大取到 10）
        </div>
        <div className="gd-note">{Icn.info}<span>第 1 次冲突：r ∈ {'{0,1}'}；第 2 次：r ∈ {'{0,1,2,3}'}；第 3 次：r ∈ {'{0..7}'}…… <b>取值范围翻倍扩大</b>，两个站再撞上同一个 r 的概率越来越低。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '想发帧' }, { cls: 'pd', text: '先听：忙就等' },
          { cls: 'pi', text: '空闲 → 边发边听' }, { cls: 'pm', text: '听到冲突 → 立即停发' },
          { cls: 'pt', text: '二进制指数退避后重试' },
        ]}
        why={<><b>为什么退避范围要指数扩大：</b>冲突说明此刻抢信道的站太多。若大家都只等固定时间，重发时会<b>再次一起冲上去、再次相撞</b>。让取值范围随冲突次数翻倍，相当于把重试时刻<b>越撒越开</b>，用随机性把扎堆的站错峰开 —— 冲突越频繁，错峰越狠。</>} />
    </Shell>
  )
}

// ── 共用：一张 5 点加权无向图（dijkstra / mst / traverse 用）──
const GNODES: Record<string, [number, number]> = { A: [46, 46], B: [188, 34], C: [116, 122], D: [258, 116], E: [326, 52] }
const GEDGES: [string, string, number][] = [['A', 'B', 6], ['A', 'C', 1], ['C', 'B', 2], ['C', 'D', 4], ['B', 'E', 5], ['D', 'E', 3], ['B', 'D', 2]]
function WeightedGraph({ tree = [], src, showW = true }: { tree?: string[]; src?: string; showW?: boolean }) {
  const key = (a: string, b: string) => [a, b].sort().join('-')
  const inTree = new Set(tree.map(t => t.split('-').sort().join('-')))
  return (
    <div className="gd-graph">
      <svg viewBox="0 0 372 156" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {GEDGES.map(([a, b, w], i) => {
          const [x1, y1] = GNODES[a], [x2, y2] = GNODES[b]
          const on = inTree.has(key(a, b))
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? 'var(--hit)' : 'var(--line)'} strokeWidth={on ? 3 : 1.5} />
              {showW && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 3} textAnchor="middle" fontSize="11" fontWeight="700" fill={on ? 'var(--hit)' : 'var(--dim)'}>{w}</text>}
            </g>
          )
        })}
        {Object.entries(GNODES).map(([n, [x, y]]) => {
          const isSrc = n === src
          const c = isSrc ? 'var(--now)' : 'var(--f-tag)'
          return (
            <g key={n}>
              <circle cx={x} cy={y} r="15" fill={`color-mix(in srgb, ${c} 16%, transparent)`} stroke={c} strokeWidth={isSrc ? 2.4 : 1.6} />
              <text x={x} y={y + 4.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={c}>{n}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ═══════════════ Dijkstra 最短路 ═══════════════
function DijkstraDiagram() {
  return (
    <Shell icon={Icn.chip} title="Dijkstra 最短路原理"
      sub="看懂：「松弛」在做什么，为什么每轮选最小就能确定">
      <Sec n={1} title="从源点出发，逐步算出到每个点的最短距离">
        <WeightedGraph src="A" />
        <div className="gd-note">{Icn.info}<span>本实验源点 <b>A</b>。一开始只知道 dist[A]=0，其余都是 ∞。算法不断用「已知的边」去<b>更新</b>还没确定的距离 —— 这个更新动作就叫<b>松弛</b>。</span></div>
      </Sec>

      <Sec n={2} title="松弛：绕一下会不会更近？">
        <div className="gd-formula">
          若 <span className="ft">dist[u]</span> + <span className="fi">w(u,v)</span> &lt; <span className="fo">dist[v]</span>
          {'  '}→ 就更新 <span className="fo">dist[v]</span> = <span className="ft">dist[u]</span> + <span className="fi">w(u,v)</span>
        </div>
        <div className="gd-note">{Icn.info}<span>意思是：如果「先到 u、再走 u→v 这条边」比目前记的到 v 的距离更短，就采用这条更短的走法。</span></div>
      </Sec>

      <Sec n={3} title="每轮选一个「最小且未确定」的点，敲定它">
        <div className="gd-lane">
          <div className="gd-card i"><h4>① 选</h4><p>在还没确定的点里，挑 dist <em>最小</em>的那个。</p></div>
          <div className="gd-card hit"><h4>② 定</h4><p>它的最短距离<em>就此敲定</em>，不会再变。</p></div>
          <div className="gd-card t"><h4>③ 松弛邻居</h4><p>用它去<em>更新</em>相邻点的 dist，回到 ①。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '源点 dist=0，其余 ∞' }, { cls: 'pd', text: '选未定点中 dist 最小的' },
          { cls: 'pi', text: '敲定它' }, { cls: 'pt', text: '松弛它的邻居' },
          { cls: 'ph', text: '全部敲定 → 最短路径树' },
        ]}
        why={<><b>为什么选最小的就能立刻敲定：</b>在<b>边权非负</b>的前提下，当前 dist 最小的那个未定点，不可能再通过别的点绕出一条更短的路 —— 因为任何绕路都要先经过一个 dist ≥ 它的点，只会更远。所以它此刻的距离就是最终答案，可以放心确定。</>} />
    </Shell>
  )
}

// ═══════════════ 最小生成树 ═══════════════
function MstDiagram() {
  return (
    <Shell icon={Icn.chip} title="最小生成树原理"
      sub="看懂：什么是生成树，Prim 和 Kruskal 怎么一步步长出来">
      <Sec n={1} title="生成树：连通所有点、不成环、总权最小">
        <WeightedGraph tree={['A-C', 'C-B', 'B-D', 'D-E']} />
        <div className="gd-note">{Icn.info}<span>绿色的就是一棵生成树：<b>n 个点用 n−1 条边</b>连通、<b>没有环</b>。在所有这样的树里，边权之和<b>最小</b>的那棵，就是最小生成树（MST）。</span></div>
      </Sec>

      <Sec n={2} title="两种长法，都是贪心">
        <div className="gd-lane">
          <div className="gd-card t"><h4>Prim：从点长</h4><p>从一个起点开始，每次把<em>「连接树与树外、且权最小」的那条边</em>拉进来，树像滚雪球一样长大。</p></div>
          <div className="gd-card i"><h4>Kruskal：从边挑</h4><p>把所有边<em>按权从小到大</em>排，逐条挑：不构成环就要，成环就丢。挑够 n−1 条为止。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'n 个点' }, { cls: 'pd', text: 'Prim：从起点滚雪球' },
          { cls: 'pi', text: 'Kruskal：小边优先、不成环就要' }, { cls: 'pt', text: '共选 n−1 条边' },
          { cls: 'ph', text: '总权最小的生成树' },
        ]}
        why={<><b>为什么贪心挑最小边不会错：</b>切分定理保证 —— 无论你怎么把所有点切成两组，<b>横跨这两组的最小边，一定属于某棵最小生成树</b>。Prim 和 Kruskal 每一步选的都恰好是某个切分的最小跨边，所以一路贪心到底，得到的正是全局最优。</>} />
    </Shell>
  )
}

// ═══════════════ 拓扑排序与关键路径 ═══════════════
function TopoDiagram() {
  //  有向无环图（AOE），带箭头
  const N: Record<string, [number, number]> = { A: [40, 78], B: [140, 36], C: [140, 120], D: [250, 78], E: [340, 78] }
  const E: [string, string, number][] = [['A', 'B', 3], ['A', 'C', 2], ['B', 'D', 4], ['C', 'D', 3], ['D', 'E', 2]]
  return (
    <Shell icon={Icn.chip} title="拓扑排序与关键路径"
      sub="看懂：入度是什么，关键路径为什么决定总工期">
      <Sec n={1} title="有向无环图（AOE 网）：边有方向、活动有先后">
        <div className="gd-graph">
          <svg viewBox="0 0 384 156" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs><marker id="gdda" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="var(--dim)" /></marker></defs>
            {E.map(([a, b, w], i) => {
              const [x1, y1] = N[a], [x2, y2] = N[b]
              const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy)
              const ex = x2 - (dx / len) * 17, ey = y2 - (dy / len) * 17
              return (<g key={i}><line x1={x1} y1={y1} x2={ex} y2={ey} stroke="var(--dim)" strokeWidth="1.6" markerEnd="url(#gdda)" /><text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--f-idx)">{w}</text></g>)
            })}
            {Object.entries(N).map(([n, [x, y]]) => (
              <g key={n}><circle cx={x} cy={y} r="15" fill="color-mix(in srgb, var(--f-tag) 16%, transparent)" stroke="var(--f-tag)" strokeWidth="1.6" /><text x={x} y={y + 4.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--f-tag)">{n}</text></g>
            ))}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span><b>入度</b> = 指向一个点的边数。拓扑排序：反复输出<b>入度为 0</b>（没有前置依赖）的点，再删掉它引出的边 —— 谁的依赖先清零，谁先做。</span></div>
      </Sec>

      <Sec n={2} title="关键路径：正推最早、逆推最晚">
        <div className="gd-lane">
          <div className="gd-card t"><h4>ve 正推（最早）</h4><p>从起点顺着走，每个点取<em>所有入边里最晚到的</em> —— 前置活动都干完，它才能开始。</p></div>
          <div className="gd-card i"><h4>vl 逆推（最晚）</h4><p>从终点倒着走，算出每个点<em>不拖延总工期的最晚开始时刻</em>。</p></div>
          <div className="gd-card hit"><h4>关键活动</h4><p>最早 = 最晚（<em>时差为 0</em>）的活动，一点都不能拖。串起来就是关键路径。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'AOE 网' }, { cls: 'pd', text: '入度为 0 的先输出（拓扑序）' },
          { cls: 'pi', text: 've 正推最早' }, { cls: 'pt', text: 'vl 逆推最晚' },
          { cls: 'ph', text: '时差 0 = 关键路径' },
        ]}
        why={<><b>为什么关键路径决定总工期：</b>它是从起点到终点<b>最长的那条路</b>。上面每个活动都卡在「最早 = 最晚」，没有一丝缓冲 —— 只要关键路径上任何一个活动拖了一天，整个工程的完工就跟着拖一天。想赶工，只能压这条路上的活动。</>} />
    </Shell>
  )
}

// ═══════════════ 图的遍历 ═══════════════
function TraverseDiagram() {
  return (
    <Shell icon={Icn.chip} title="图的遍历原理"
      sub="看懂：DFS 和 BFS 的区别，为什么一个用栈、一个用队列">
      <Sec n={1} title="从一个起点出发，系统地访问到每个点">
        <WeightedGraph src="A" showW={false} />
        <div className="gd-note">{Icn.info}<span>本实验从 <b>A</b> 出发。遍历要保证<b>每个点访问一次、不重复</b>。用什么数据结构装「待访问的点」，决定了走法完全不同。</span></div>
      </Sec>

      <Sec n={2} title="装待访问点的容器，决定了走法">
        <div className="gd-lane">
          <div className="gd-card t"><h4>DFS 用栈：一条道走到黑</h4><p>后进先出。<em>沿一条路径不停深入</em>，走不通了才回退到上一个岔口，换条路。（递归本质也是栈）</p></div>
          <div className="gd-card i"><h4>BFS 用队列：一圈一圈往外</h4><p>先进先出。<em>先访问所有直接邻居，再访问邻居的邻居</em>，像水波一层层扩散。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '起点入容器' }, { cls: 'pd', text: '取一个点、访问、标记' },
          { cls: 'pi', text: '把未访问的邻居放进容器' }, { cls: 'ph', text: '栈 → 越走越深（DFS）' },
          { cls: 'pm', text: '队列 → 逐层铺开（BFS）' },
        ]}
        why={<><b>为什么容器一换、形状就变：</b>栈「后进先出」，最新发现的邻居最先被取出，于是不停往<b>深处</b>钻；队列「先进先出」，先发现的先处理，于是<b>按距起点的层数</b>铺开。同一张图、同一个起点，只因装待办的容器不同，就长出深探和广搜两种截然不同的轨迹。</>} />
    </Shell>
  )
}

// ═══════════════ 排序逐趟 ═══════════════
function SortDiagram() {
  const arr = [49, 38, 65, 97, 76, 13, 27, 49]
  return (
    <Shell icon={Icn.chip} title="排序算法原理"
      sub="看懂：「一趟」到底做了什么，七种算法凭什么分快慢">
      <Sec n={1} title="把这排数，变成从小到大">
        <div className="gd-strrow">
          {arr.map((v, i) => (
            <div key={i} className="gd-ch" style={{ width: 40 }}><b>{v}</b></div>
          ))}
        </div>
        <div className="gd-note">{Icn.info}<span>本实验数组 <b>49 38 65 97 76 13 27 49</b>。所有排序都靠两个动作：<b>比较</b>两个数、<b>移动</b>（交换）位置。比得多不多、移得频不频，就是快慢的分野。</span></div>
      </Sec>

      <Sec n={2} title="四大家族：每一趟怎么让「有序区」变大">
        <div className="gd-lane">
          <div className="gd-card t"><h4>插入类</h4><p>直接插入 / 希尔。把下一个数<em>插进前面已排好的段</em>里的正确位置。</p></div>
          <div className="gd-card i"><h4>交换类</h4><p>冒泡 / 快速。靠<em>相邻或跨区交换</em>，把大的沉底、小的浮起 / 按基准分两半。</p></div>
          <div className="gd-card o"><h4>选择类</h4><p>简单选择 / 堆。每一趟<em>挑出一个最值</em>，放到该去的位置。</p></div>
          <div className="gd-card hit"><h4>归并类</h4><p>归并。<em>先拆到不能再拆，再两两有序合并</em>，分治收工。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '一排乱序' }, { cls: 'pd', text: '每趟：比较 + 移动' },
          { cls: 'pi', text: '有序区扩大一点' }, { cls: 'pt', text: '重复若干趟' },
          { cls: 'ph', text: '全部有序' },
        ]}
        why={<><b>为什么都在数比较和移动次数：</b>排序的代价，说到底就是这两样操作做了多少次。冒泡在近乎有序时移动极少、在逆序时移到崩溃；快速平均极快但遇到坏基准会退化。<b>同一组数据，算法不同，比较/移动次数能差几个数量级</b> —— 这就是「一趟摊开」要让你亲眼看到的东西。</>} />
    </Shell>
  )
}

// ═══════════════ KMP 字符串匹配 ═══════════════
function KmpDiagram() {
  const pat = ['a', 'b', 'a', 'b', 'd']
  const nextv = [0, 0, 1, 2, 0]  //  各位置「最长相等前后缀」长度
  return (
    <Shell icon={Icn.chip} title="KMP 匹配原理"
      sub="看懂：next 数组是什么，为什么主串指针永不回退">
      <Sec n={1} title="朴素匹配的浪费：一失配就把主串指针拉回去重来">
        <div className="gd-strrow" style={{ marginBottom: 6 }}>
          {'ababcab...'.split('').map((c, i) => (
            <div key={i} className={`gd-ch${i < 4 ? ' mt' : i === 4 ? ' x' : ''}`}><b>{c}</b><i>{i}</i></div>
          ))}
        </div>
        <div className="gd-strrow">
          {pat.map((c, i) => (
            <div key={i} className={`gd-ch${i < 4 ? ' mt' : ' x'}`}><b>{c}</b></div>
          ))}
        </div>
        <div className="gd-note">{Icn.info}<span>模式串 <b>ababd</b> 匹配到第 5 个字符 <b>d</b> 时失配（主串是 c）。朴素做法会把主串指针退回去、模式串从头再试 —— 白白重比已经对过的 <b>abab</b>。</span></div>
      </Sec>

      <Sec n={2} title="next 数组：每个位置的「最长相等前后缀」长度">
        <div className="gd-strrow">
          {pat.map((c, i) => (
            <div key={i} className="gd-ch" style={{ width: 48, height: 48 }}><b>{c}</b><i style={{ color: 'var(--f-idx)', fontSize: 12, fontWeight: 700 }}>{nextv[i]}</i></div>
          ))}
        </div>
        <div className="gd-note">{Icn.info}<span>例如到 <b>abab</b>（前 4 个）：它的前缀 <b>ab</b> 和后缀 <b>ab</b> 相等、长度 2，所以 next=2。这个 2 的含义是：<b>前面这 2 个字符，不用再比就知道是对的。</b></span></div>
      </Sec>

      <Sec n={3} title="失配时：主串不动，模式串按 next 往右滑">
        <div className="gd-formula">
          主串指针 i <span className="ft">原地不动</span>　模式串指针 j → <span className="fi">next[j]</span>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '预处理出 next 数组' }, { cls: 'pd', text: '逐字符比对' },
          { cls: 'pi', text: '失配' }, { cls: 'ph', text: '主串 i 不回退' },
          { cls: 'pm', text: '模式串 j 跳到 next[j] 继续' },
        ]}
        why={<><b>为什么主串指针能不回退：</b>失配前已经比对成功的那一段，KMP 早就用 next 数组<b>记住了它的自相似结构</b> —— 前缀等于后缀的部分，滑动后自动对齐，压根不用再比。于是主串每个字符<b>最多被看一次</b>，匹配从朴素的 O(nm) 降到 O(n+m)。</>} />
    </Shell>
  )
}

// ── 树节点小工具 ──
function tnode(x: number, y: number, label: string | number, color = 'var(--f-tag)', r = 16) {
  return (
    <g key={`${x}-${y}-${label}`}>
      <circle cx={x} cy={y} r={r} fill={`color-mix(in srgb, ${color} 16%, transparent)`} stroke={color} strokeWidth="1.7" />
      <text x={x} y={y + 4.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={color}>{label}</text>
    </g>
  )
}

// ═══════════════ AVL 平衡二叉树 ═══════════════
function AvlDiagram() {
  return (
    <Shell icon={Icn.chip} title="AVL 平衡二叉树原理"
      sub="看懂：平衡因子是什么，失衡了怎么靠旋转救回来">
      <Sec n={1} title="平衡因子失控，就得旋转">
        <div className="gd-graph">
          <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 失衡（左左，BF=2）*/}
            <line x1="80" y1="36" x2="50" y2="86" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="50" y1="86" x2="28" y2="130" stroke="var(--line)" strokeWidth="1.6" />
            {tnode(80, 36, 30, 'var(--miss)')}
            {tnode(50, 86, 20)}
            {tnode(28, 130, 10)}
            <text x="98" y="40" fontSize="11" fontWeight="700" fill="var(--miss)">BF=2 ✗</text>
            {/* 箭头 */}
            <text x="185" y="88" fontSize="13" fontWeight="700" fill="var(--now)">右旋 →</text>
            {/* 平衡后 */}
            <line x1="320" y1="46" x2="290" y2="100" stroke="var(--hit)" strokeWidth="1.8" />
            <line x1="320" y1="46" x2="352" y2="100" stroke="var(--hit)" strokeWidth="1.8" />
            {tnode(320, 46, 20, 'var(--hit)')}
            {tnode(290, 100, 10, 'var(--hit)')}
            {tnode(352, 100, 30, 'var(--hit)')}
            <text x="336" y="42" fontSize="11" fontWeight="700" fill="var(--hit)">BF=0 ✓</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span><b>平衡因子 BF = 左子树高 − 右子树高</b>。AVL 要求每个节点 <b>|BF| ≤ 1</b>。上图插入 10 后，节点 30 的 BF 变成 2 —— 失衡，绕节点 20 <b>右旋</b>一下就恢复平衡。</span></div>
      </Sec>

      <Sec n={2} title="四种失衡形状，对应四种旋转">
        <div className="gd-lane">
          <div className="gd-card t"><h4>LL → 右旋</h4><p>新节点插在<em>左孩子的左边</em>。整体向右转一下。</p></div>
          <div className="gd-card i"><h4>RR → 左旋</h4><p>插在<em>右孩子的右边</em>。向左转。</p></div>
          <div className="gd-card o"><h4>LR → 先左后右</h4><p>插在<em>左孩子的右边</em>。先把左子树左旋，再整体右旋。</p></div>
          <div className="gd-card hit"><h4>RL → 先右后左</h4><p>插在<em>右孩子的左边</em>。先右旋，再左旋。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '插入一个键' }, { cls: 'pd', text: '沿途更新平衡因子' },
          { cls: 'pi', text: '|BF| > 1 失衡' }, { cls: 'pt', text: '看形状选旋转' },
          { cls: 'ph', text: '旋转后恢复平衡' },
        ]}
        why={<><b>为什么要死守平衡：</b>二叉搜索树查找快慢取决于<b>树高</b>。若不平衡，插入有序数据会退化成一根「链」，查找从 O(log n) 掉到 O(n)。AVL 用旋转把树高<b>死死压在 log n</b> —— 旋转是局部的、只动几个指针，代价小，却保住了整棵树的查找效率。</>} />
    </Shell>
  )
}

// ═══════════════ 哈夫曼树与编码 ═══════════════
function HuffmanDiagram() {
  return (
    <Shell icon={Icn.chip} title="哈夫曼编码原理"
      sub="看懂：为什么反复合并最小两个，就能得到最短编码">
      <Sec n={1} title="核心：每次取两个最小权值，合并成一棵子树">
        <div className="gd-graph">
          <svg viewBox="0 0 380 165" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 一棵示意哈夫曼树：权 A7 B5 C2 D4 */}
            <line x1="200" y1="24" x2="120" y2="70" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="200" y1="24" x2="280" y2="70" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="280" y1="70" x2="240" y2="120" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="280" y1="70" x2="330" y2="120" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="240" y1="120" x2="205" y2="150" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="240" y1="120" x2="285" y2="150" stroke="var(--line)" strokeWidth="1.6" />
            {/* 边上的 0/1 */}
            <text x="150" y="48" fontSize="11" fill="var(--f-idx)" fontWeight="700">0</text>
            <text x="248" y="48" fontSize="11" fill="var(--f-idx)" fontWeight="700">1</text>
            {tnode(200, 24, 18, 'var(--dim)')}
            {tnode(120, 70, 'A:7', 'var(--f-tag)', 18)}
            {tnode(280, 70, 11, 'var(--dim)')}
            {tnode(240, 120, 6, 'var(--dim)')}
            {tnode(330, 120, 'B:5', 'var(--f-tag)', 18)}
            {tnode(205, 150, 'C:2', 'var(--f-tag)', 17)}
            {tnode(285, 150, 'D:4', 'var(--f-tag)', 17)}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>示意权值 A7 B5 C2 D4：先合并最小的 C2+D4=6，再 5+6=11，最后 7+11=18。<b>权越小的字符，离根越远、编码越长</b>；权大的离根近、编码短。</span></div>
      </Sec>

      <Sec n={2} title="两个关键性质">
        <div className="gd-lane">
          <div className="gd-card t"><h4>WPL 最小</h4><p>带权路径长度 = Σ(<em>权 × 到根的路径长</em>)。哈夫曼树的 WPL 是所有二叉树里<em>最小</em>的。</p></div>
          <div className="gd-card hit"><h4>前缀码</h4><p>字符都在<em>叶子</em>上，所以<em>没有一个编码是另一个的前缀</em> —— 解码时不会有歧义。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '一堆带权字符' }, { cls: 'pd', text: '取两个最小权，合并' },
          { cls: 'pi', text: '新节点权 = 两者之和，放回' }, { cls: 'pt', text: '重复到只剩一棵树' },
          { cls: 'ph', text: '左 0 右 1 → 前缀码' },
        ]}
        why={<><b>为什么贪心合并最小的就最优：</b>出现频率越高的字符，编码就该越短，才能压缩总长。让<b>权最小的两个待在树的最深处</b>，等于把最长的编码分给了最少用的字符 —— 每一步都把「代价大」的压到最底，累积下来整体带权路径长度（WPL）就最小，编码总长也最短。</>} />
    </Shell>
  )
}

// ═══════════════ B+ 树的插入与分裂 ═══════════════
function BplusDiagram() {
  return (
    <Shell icon={Icn.chip} title="B+ 树原理"
      sub="看懂：为什么所有键都在叶子层，叶子还串成一条链">
      <Sec n={1} title="内部节点只当路标，真正的数据全在叶子">
        <div className="gd-graph">
          <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 根（索引） */}
            <rect x="170" y="16" width="60" height="26" rx="4" fill="color-mix(in srgb, var(--f-idx) 16%, transparent)" stroke="var(--f-idx)" strokeWidth="1.6" />
            <text x="200" y="33" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--f-idx)">17</text>
            <line x1="185" y1="42" x2="90" y2="86" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="215" y1="42" x2="300" y2="86" stroke="var(--line)" strokeWidth="1.6" />
            {/* 叶子 */}
            <rect x="40" y="86" width="100" height="28" rx="4" fill="color-mix(in srgb, var(--f-tag) 14%, transparent)" stroke="var(--f-tag)" strokeWidth="1.6" />
            <text x="90" y="104" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--f-tag)">5 · 11</text>
            <rect x="250" y="86" width="100" height="28" rx="4" fill="color-mix(in srgb, var(--f-tag) 14%, transparent)" stroke="var(--f-tag)" strokeWidth="1.6" />
            <text x="300" y="104" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--f-tag)">17 · 23</text>
            {/* 叶子链 */}
            <line x1="140" y1="100" x2="250" y2="100" stroke="var(--hit)" strokeWidth="1.8" strokeDasharray="4 3" markerEnd="url(#gdlk)" />
            <defs><marker id="gdlk" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="var(--hit)" /></marker></defs>
            <text x="195" y="94" textAnchor="middle" fontSize="10" fill="var(--hit)">叶子链</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>阶 m=3（每个节点最多 2 个键）。根里的 <b>17</b> 只是<b>路标</b>：小于 17 往左、≥17 往右。所有真实键都<b>重复出现在叶子层</b>，叶子之间还用<b>指针串成一条有序链</b>。</span></div>
      </Sec>

      <Sec n={2} title="插入撑爆一个节点，就分裂、把中间键上提">
        <div className="gd-lane">
          <div className="gd-card t"><h4>没满 → 直接插</h4><p>叶子还没到 m−1 个键，插进去、保持有序即可。</p></div>
          <div className="gd-card i"><h4>满了 → 分裂</h4><p>裂成两个叶子，把<em>中间的键复制上提</em>到父节点当新路标。</p></div>
          <div className="gd-card hit"><h4>上提也满 → 继续往上裂</h4><p>父节点也可能被撑爆，<em>逐层向上分裂</em>，最坏一路裂到根、树长高一层。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '插入一个键' }, { cls: 'pd', text: '落到某个叶子' },
          { cls: 'ph', text: '没满：直接插' }, { cls: 'pm', text: '满了：分裂、中键上提' },
          { cls: 'pt', text: '必要时逐层向上、树长高' },
        ]}
        why={<><b>为什么数据全塞叶子、还要串成链：</b>B+ 树是给磁盘数据库用的。内部节点不存数据、只存路标，就能<b>塞下更多分支、把树压得很矮</b>，查一个键只需很少几次磁盘 IO。而叶子串成有序链，让<b>范围查询</b>（如「10 到 50 之间」）能顺着链一路扫过去 —— 单点快、范围也快，正是数据库索引要的。</>} />
    </Shell>
  )
}

/**  登记表：只有在这里的实验，exphead 才出现「看懂这一屏」入口。  */
// ═══════════════ 二叉树遍历 ═══════════════
function BtreeDiagram() {
  return (
    <Shell icon={Icn.chip} title="二叉树遍历原理"
      sub="看懂：前中后序只差一件事，中序遍历 BST 为什么有序">
      <Sec n={1} title="三种深度优先次序，只差「根什么时候输出」">
        <div className="gd-graph">
          <svg viewBox="0 0 380 168" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <line x1="190" y1="26" x2="110" y2="80" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="190" y1="26" x2="270" y2="80" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="110" y1="80" x2="60" y2="140" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="110" y1="80" x2="160" y2="140" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="270" y1="80" x2="220" y2="140" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="270" y1="80" x2="320" y2="140" stroke="var(--line)" strokeWidth="1.6" />
            {tnode(190, 26, 50, 'var(--f-tag)')}
            {tnode(110, 80, 30)}
            {tnode(270, 80, 70)}
            {tnode(60, 140, 20)}
            {tnode(160, 140, 40)}
            {tnode(220, 140, 60)}
            {tnode(320, 140, 80)}
          </svg>
        </div>
        <div className="gd-lane" style={{ marginTop: 12 }}>
          <div className="gd-card t"><h4>前序 = 根 → 左 → 右</h4><p>每到一个结点<em>先输出它</em>，再钻左、再钻右。<br />→ <em>50 30 20 40 70 60 80</em></p></div>
          <div className="gd-card i"><h4>中序 = 左 → 根 → 右</h4><p>先把左子树走完，<em>再输出根</em>，最后走右。<br />→ <em>20 30 40 50 60 70 80</em></p></div>
          <div className="gd-card o"><h4>后序 = 左 → 右 → 根</h4><p>左右都走完，<em>最后才输出根</em>。<br />→ <em>20 40 30 60 80 70 50</em></p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>树一动不动，三条序列却完全不同 —— <b>唯一的变量是"根在什么时候被输出"</b>。前序最先、后序最后、中序夹在左右子树中间。</span></div>
      </Sec>

      <Sec n={2} title="中序遍历二叉搜索树，输出一定有序">
        <div className="gd-formula">
          左子树全 <span className="ft">&lt; 根</span> <span className="fi">&lt;</span> 右子树全 <span className="fo">&gt; 根</span>
          {'　'}⇒ 左 → 根 → 右 输出 = <b>从小到大</b>
        </div>
        <div className="gd-note">{Icn.info}<span>BST 的定义就是"左小右大"。中序恰好按"先左、再自己、后右"输出，于是每个结点都排在它该在的位置 —— <b>不管插入顺序多乱，中序结果永远有序</b>。这是最常被考的一条性质。</span></div>
      </Sec>

      <Sec n={3} title="靠什么走：深度优先用栈，层序用队列">
        <div className="gd-lane">
          <div className="gd-card t"><h4>前 / 中 / 后序 → 栈</h4><p>一条路走到底、走不动再<em>回退</em>换一条 —— 这就是栈的「后进先出」。递归本质也是栈。</p></div>
          <div className="gd-card i"><h4>层序 → 队列</h4><p>出队一个就访问它，再把它的左右孩子<em>入队</em> —— 先进先出，一层一层从左到右铺开。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '一棵二叉树' }, { cls: 'pd', text: '选一种次序' },
          { cls: 'pt', text: '前序：先根' }, { cls: 'pi', text: '中序：夹中间' },
          { cls: 'ph', text: '后序：最后根' }, { cls: 'pm', text: '层序：一层层' },
        ]}
        why={<><b>为什么后序常用来"算整棵子树的东西"：</b>后序保证<b>左右子树都处理完了，才轮到根</b> —— 求树高、求结点数、删除整棵树、算表达式树的值，都要先有孩子的结果才能算父亲，正好是后序的次序。前序适合"先复制根再复制子树"这类自顶向下的活。次序的选择，取决于父结点的活儿依不依赖孩子的结果。</>} />
    </Shell>
  )
}

// ═══════════════ 补码定点加减 ═══════════════
function AddSubDiagram() {
  return (
    <Shell icon={Icn.chip} title="补码加减原理"
      sub="看懂：为什么符号位能一起算，溢出到底怎么判">
      <Sec n={1} title="补码把减法变成加法">
        <div className="gd-bits3">
          <div className="r"><span className="rl">A = 45</span><span><span className="net">0010 1101</span></span></div>
          <div className="r"><span className="rl">B = 38</span><span><span className="net">0010 0110</span></span></div>
          <div className="sep" />
          <div className="r"><span className="rl">A − B</span><span>= A +（−B）补，而 (−B)补 = <b>B 按位取反 + 1</b></span></div>
          <div className="r"><span className="rl">(−B)补</span><span>~0010 0110 + 1 = <span className="host">1101 1010</span></span></div>
        </div>
        <div className="gd-note">{Icn.info}<span>有了补码，硬件<b>只需要一个加法器</b>：减法先把 B 变成 −B 的补码，再当加法做。而且<b>符号位可以和数值位一起参与相加</b>，不用像原码那样单独算符号 —— 这是补码最大的好处。</span></div>
      </Sec>

      <Sec n={2} title="从最低位逐列相加，进位往高位传">
        <div className="gd-lane">
          <div className="gd-card t"><h4>{Icn.ruler}逐列相加</h4><p>从<em>最低位</em>开始，每列 = A 位 + B 位 + 上一列的进位。本位取和的最低位，进位送往上一列。</p></div>
          <div className="gd-card i"><h4>{Icn.tag}符号位照常加</h4><p>加到<em>符号位（最高位）</em>时不做特殊处理，它和别的位一样参与运算 —— 结果的符号自动就对了。</p></div>
        </div>
      </Sec>

      <Sec n={3} title="溢出：看符号位那两个进位">
        <div className="gd-formula">
          <span className="ft">进入符号位的进位</span> <span className="fi">⊕</span> <span className="fo">移出符号位的进位</span>
          {'  '}= 1{'  '}→ <b className="bad" style={{ color: 'var(--miss)' }}>溢出</b>
        </div>
        <div className="gd-lane" style={{ marginTop: 10 }}>
          <div className="gd-card hit"><h4>{Icn.check}两进位相等 → 没溢出</h4><p>异或为 0。或者两个加数<em>异号</em>相加，结果一定落在两者之间，绝不溢出。</p></div>
          <div className="gd-card miss"><h4>{Icn.cross}两进位不等 → 溢出</h4><p>等价说法：两个<em>同号</em>数相加却得到<em>异号</em>结果（正+正=负、负+负=正）。此时机器数是错的。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '两个数取补码' }, { cls: 'pd', text: '减法 → 求 (−B)补' },
          { cls: 'pi', text: '从低位逐列相加' }, { cls: 'pt', text: '符号位一起算' },
          { cls: 'ph', text: '双进位异或=0：有效' }, { cls: 'pm', text: '=1：溢出' },
        ]}
        why={<><b>为什么溢出不能只看最高位进位：</b>无符号加法看最高位进位判溢出，但补码是<b>带符号</b>的。最高位既是符号位又参与运算，光看它进不进位会误判 —— 比如两个负数相加常常有最高位进位，却完全正确。真正的信号是符号位<b>"进"和"出"的两个进位不一致</b>：这说明符号位被数值部分的进位"顶翻"了，结果的符号才是错的。</>} />
    </Shell>
  )
}

// ═══════════════ 距离矢量路由 ═══════════════
function RipDiagram() {
  //  一行距离矢量小表
  const row = (label: string, cells: (string | number)[], hi?: number[]) => (
    <div className="gd-bmrow" style={{ gridTemplateColumns: 'auto repeat(4,32px)' }}>
      <span className="gd-bmrl">{label}</span>
      {cells.map((c, i) => (
        <span key={i} className={`gd-bmc${hi?.includes(i) ? ' hi' : ''}`} style={{ width: 32 }}>{c}</span>
      ))}
    </div>
  )
  return (
    <Shell icon={Icn.chip} title="距离矢量路由原理"
      sub="看懂：只跟邻居聊天怎么算出全网最短，无穷计数又是什么">
      <Sec n={1} title="每台路由器只跟直连邻居交换整张距离表">
        <div className="gd-graph">
          <svg viewBox="0 0 380 96" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <line x1="50" y1="48" x2="150" y2="48" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="150" y1="48" x2="250" y2="48" stroke="var(--line)" strokeWidth="1.6" />
            <line x1="250" y1="48" x2="330" y2="48" stroke="var(--line)" strokeWidth="1.6" />
            <text x="100" y="40" textAnchor="middle" fontSize="11" fill="var(--f-idx)" fontWeight="700">1</text>
            <text x="200" y="40" textAnchor="middle" fontSize="11" fill="var(--f-idx)" fontWeight="700">1</text>
            <text x="290" y="40" textAnchor="middle" fontSize="11" fill="var(--f-idx)" fontWeight="700">1</text>
            {tnode(50, 48, 'A', 'var(--f-tag)', 15)}
            {tnode(150, 48, 'B', 'var(--f-tag)', 15)}
            {tnode(250, 48, 'C', 'var(--f-tag)', 15)}
            {tnode(330, 48, 'D', 'var(--f-tag)', 15)}
          </svg>
        </div>
        <div className="gd-formula">
          到 y 的代价 = min<sub>邻居 v</sub>（<span className="ft">到 v 的代价</span> + <span className="fo">v 声称到 y 的代价</span>）
        </div>
        <div className="gd-note">{Icn.info}<span>没有一台路由器知道全网地图。每台只维护"到各点的代价 + 下一跳"，<b>只跟直连邻居交换整张表</b>，一轮一轮把最短路从近到远扩散 —— 这就是<b>分布式的 Bellman-Ford</b>。</span></div>
      </Sec>

      <Sec n={2} title="逐轮收敛：A 到 D 的代价一圈圈算出来">
        <div className="gd-bmg">
          <div className="gd-bmhdr" style={{ gridTemplateColumns: 'auto repeat(4,32px)' }}><span /><span>A</span><span>B</span><span>C</span><span>D</span></div>
          {row('第0轮', [0, 1, '∞', '∞'], [2, 3])}
          {row('第1轮', [0, 1, 2, '∞'], [2])}
          {row('第2轮', [0, 1, 2, 3], [3])}
        </div>
        <div className="gd-note">{Icn.info}<span>这是 <b>A 的距离矢量</b>随轮次的变化：一开始只知道邻居 B，之后从 B 学到 C（1+1=2）、再学到 D（2+1=3）。<b>n 个点最多 n−1 轮</b>就收敛。</span></div>
      </Sec>

      <Sec n={3} title="链路一断，坏消息传得很慢：无穷计数">
        <div className="gd-lane">
          <div className="gd-card miss"><h4>{Icn.cross}代价一格格虚长</h4><p>A—B 断了，A 到不了任何人。可 C 还在广播"到 A 只要 2"，B 信了 → "到 A = 1+2 = 3"，C 又信 B → 4…… <em>每轮 +1 往上爬</em>。</p></div>
          <div className="gd-card t"><h4>{Icn.ruler}封顶到 16</h4><p>为了不让它无限加下去，RIP 规定<em>代价到 16 就当"无穷"</em>（不可达）。这也限制了网络直径不能超过 15 跳。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span><b>水平分割 / 毒性逆转</b>就是治它的：不把"从谁那儿学来的路由"再广播回给谁，坏消息就不会打转。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '只知直连邻居' }, { cls: 'pd', text: '每轮和邻居交换整张表' },
          { cls: 'pi', text: 'min(到邻居 + 邻居到目的地)' }, { cls: 'ph', text: '几轮后收敛' },
          { cls: 'pm', text: '断链 → 无穷计数到 16' },
        ]}
        why={<><b>为什么它比 Dijkstra 简单却容易出乱子：</b>Dijkstra（链路状态）要求每台路由器<b>掌握全网拓扑</b>再各自算最短路，信息全、不打转，但开销大。距离矢量只<b>道听途说</b>——信邻居说的、自己不核实，所以实现极简、扩散却慢，还会被过时消息带偏（无穷计数）。RIP 用"无穷=16"和水平分割打补丁，代价是网络规模被限死在 15 跳内。</>} />
    </Shell>
  )
}

// ═══════════════ 栈与表达式求值 ═══════════════
function ExprDiagram() {
  const tok = (t: string, cls = '') => <span className={`gd-etok ${cls}`}>{t}</span>
  return (
    <Shell icon={Icn.chip} title="栈与表达式求值原理"
      sub="看懂：为什么转成后缀，一个栈就能一遍算出来">
      <Sec n={1} title="中缀难算，后缀好算">
        <div className="gd-lane">
          <div className="gd-card t"><h4>中缀（人写的）</h4><p>运算符在两个操作数<em>中间</em>：3 + 4 × 2。要靠<em>优先级和括号</em>才知道先算谁 —— 机器算起来别扭。</p></div>
          <div className="gd-card hit"><h4>后缀（机器爱的）</h4><p>运算符写在操作数<em>后面</em>：3 4 2 × +。<em>没有括号、不看优先级</em>，运算顺序已写死在排列里。</p></div>
        </div>
      </Sec>

      <Sec n={2} title="① 中缀转后缀：一个运算符栈">
        <div className="gd-formula" style={{ textAlign: 'left', fontSize: 13.5 }}>
          {tok('数字', 'n')} → <b>直接进后缀</b><br />
          {tok('运算符', 'o')} → 把栈里<span className="ft">优先级不低于它的先弹出</span>，再压自己<br />
          {tok('(', 'p')} → 压栈　{tok(')', 'p')} → <span className="fo">一直弹到 ( 为止</span>
        </div>
        <div className="gd-note">{Icn.info}<span>× ÷ 优先级高于 + −。栈的<b>后进先出</b>正好保证：高优先级的运算符后进、却先被弹出去参与运算。</span></div>
      </Sec>

      <Sec n={3} title="② 后缀求值：一个数值栈，一遍扫描">
        <div className="gd-formula" style={{ textAlign: 'left', fontSize: 13.5 }}>
          {tok('数字', 'n')} → <b>压栈</b><br />
          {tok('运算符', 'o')} → <span className="fi">弹出栈顶两个</span>算完，<span className="fo">结果压回</span>
        </div>
        <div className="gd-note">{Icn.info}<span>例：后缀 <b>3 4 2 * + 1 −</b>。读到 * 时弹出 4、2 算 8 压回；读到 + 弹出 3、8 算 11 压回；读到 − 弹出 11、1 算 <b>10</b>。扫完栈里只剩一个数，就是答案。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '中缀 3+4*2-1' }, { cls: 'pd', text: '运算符栈转后缀' },
          { cls: 'pi', text: '得 3 4 2 * + 1 −' }, { cls: 'pt', text: '数值栈求值' },
          { cls: 'ph', text: '一遍扫描 = 10' },
        ]}
        why={<><b>为什么绕一道后缀反而更简单：</b>中缀求值要反复"往回看"——看到 + 不能马上算，得先确认右边有没有 × 抢在前面，还要处理括号，本质上要用两个栈或递归下降。而后缀把"谁先算"这件事<b>在转换时一次性解决</b>，求值阶段就退化成"遇数字压栈、遇运算符弹两个"的机械扫描，一个栈、一趟走完，永不回头。编译器算表达式、很多计算器内部，走的都是这条路。</>} />
    </Shell>
  )
}

// ═══════════════ 前缀缓存 Radix Cache ═══════════════
function RadixDiagram() {
  return (
    <Shell icon={Icn.chip} title="前缀缓存原理"
      sub="看懂：请求共享前缀，KV 怎么复用、省下多少 prefill">
      <Sec n={1} title="推理分两段：prefill 算 KV，decode 吐字">
        <div className="gd-lane">
          <div className="gd-card t"><h4>{Icn.ruler}prefill（预填充）</h4><p>把整段输入 prompt <em>一次性过一遍</em>，算出每个 token 的 K、V 向量。输入越长，这段越贵。</p></div>
          <div className="gd-card i"><h4>{Icn.doc}decode（解码）</h4><p>之后<em>一个一个吐字</em>，每步复用前面所有 token 的 KV。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>每个 token 的 KV 算一次就能反复用。前缀缓存省的是 <b>prefill</b> —— 相同的前缀不必重算 KV。</span></div>
      </Sec>

      <Sec n={2} title="共享前缀挂在一棵前缀树上，跨请求复用">
        <div className="gd-graph">
          <svg viewBox="0 0 380 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <line x1="52" y1="75" x2="120" y2="75" stroke="var(--line)" strokeWidth="1.5" />
            <line x1="152" y1="75" x2="212" y2="75" stroke="var(--line)" strokeWidth="1.5" />
            <line x1="244" y1="60" x2="300" y2="34" stroke="var(--line)" strokeWidth="1.5" />
            <line x1="244" y1="90" x2="300" y2="116" stroke="var(--line)" strokeWidth="1.5" />
            {tnode(36, 75, '系统', 'var(--f-tag)', 16)}
            {tnode(136, 75, '请', 'var(--f-tag)', 16)}
            {tnode(228, 75, '翻译', 'var(--f-tag)', 16)}
            {tnode(322, 34, '英文', 'var(--hit)', 16)}
            {tnode(322, 116, '日文', 'var(--hit)', 16)}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>「系统 请 翻译 英文」和「系统 请 翻译 日文」两个请求，<b>共享前缀「系统 请 翻译」</b>——这三段 KV 只算一次挂在树上，第二个请求走到这里全是<b className="need"> </b><span style={{ color: 'var(--hit)', fontWeight: 700 }}>命中</span>，只有末尾「日文」要新算。分叉点之后才各走各的。</span></div>
      </Sec>

      <Sec n={3} title="省下多少 prefill，就是命中占比">
        <div className="gd-formula">
          省下的 prefill = <span className="fo">命中 token 数</span> ÷ <span className="ft">总 token 数</span>
        </div>
        <div className="gd-note">{Icn.info}<span>缓存装不下时按 <b>LRU 淘汰最久没命中的叶子</b>（从叶子往上，不动还在被复用的前缀）。真实推理里一个长 system prompt 被成千请求共享，省的是巨量重复计算。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '新请求的 token' }, { cls: 'pd', text: '沿前缀树匹配' },
          { cls: 'ph', text: '命中：复用 KV，跳过 prefill' }, { cls: 'pm', text: '未命中：算 KV、延长树' },
          { cls: 'pt', text: '满了 LRU 淘汰叶子' },
        ]}
        why={<><b>为什么这是推理服务的关键优化：</b>一个 AI 应用往往给每个请求都塞同一段长长的 system prompt / few-shot（几百上千 token）。没有前缀缓存，每个请求都要把这段重新 prefill 一遍，算力全浪费在重复的东西上。有了它，这段只算一次、被所有请求复用 —— 请求量越大、共享前缀越长，省下的算力越夸张。这就是 vLLM、SGLang 这些推理引擎都做前缀缓存的原因。</>} />
    </Shell>
  )
}

// ═══════════════ PagedAttention ═══════════════
function PagedDiagram() {
  //  物理块池：A 占 0/2/4，B 占 1/3（非连续）
  const pool = [
    { o: 'A', l: 0 }, { o: 'B', l: 0 }, { o: 'A', l: 1 }, { o: 'B', l: 1 }, { o: 'A', l: 2 }, null, null, null,
  ]
  const hue = (o: string) => (o === 'A' ? 'var(--f-tag)' : 'var(--f-idx)')
  return (
    <Shell icon={Icn.chip} title="PagedAttention 原理"
      sub="看懂：KV 为什么要分页，物理块不连续怎么还对得上">
      <Sec n={1} title="连续存放的老问题：外碎片">
        <div className="gd-strip">
          <div className="gd-seg used" style={{ flex: 3 }}>请求1 KV</div>
          <div className="gd-seg frag" style={{ flex: 1 }}>空 2</div>
          <div className="gd-seg used" style={{ flex: 4 }}>请求2 KV</div>
          <div className="gd-seg frag" style={{ flex: 1 }}>空 1</div>
          <div className="gd-seg used" style={{ flex: 2 }}>请求3</div>
        </div>
        <div className="gd-note">{Icn.info}<span>要求一个请求的 KV <b>连续存放</b>，长度不定的请求就把显存切得七零八落 —— 空闲总量够、却拼不出一整块连续空间。这就是<b>外碎片</b>，和动态分区内存分配一模一样的病。</span></div>
      </Sec>

      <Sec n={2} title="分页解法：切成固定块 + 块表映射（就是 OS 那套）">
        <div className="gd-note" style={{ marginTop: 0, marginBottom: 10 }}>{Icn.chip}<span>物理块池（每块存固定几个 token 的 KV，<b>A 蓝 / B 紫</b>）：</span></div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pool.map((b, i) => (
            <div key={i} style={{
              minWidth: 66, height: 46, borderRadius: 8, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 11,
              border: `1.5px solid ${b ? hue(b.o) : 'var(--line)'}`,
              background: b ? `color-mix(in srgb, ${hue(b.o)} 14%, transparent)` : 'var(--sunk-1)',
              color: b ? hue(b.o) : 'var(--ghost)',
            }}>
              <span style={{ fontSize: 10, color: 'var(--ghost)' }}>块 {i}</span>
              <b>{b ? `${b.o}·逻辑${b.l}` : '空闲'}</b>
            </div>
          ))}
        </div>
        <div className="gd-formula" style={{ textAlign: 'left', fontSize: 13, marginTop: 12 }}>
          请求 A 的<b>块表</b>：逻辑0→<span className="ft">物理0</span>　逻辑1→<span className="ft">物理2</span>　逻辑2→<span className="ft">物理4</span>
        </div>
        <div className="gd-note">{Icn.info}<span>两个请求交错生成，A 就占了物理块 <b>0、2、4（不连续）</b>。<b>块表</b>把逻辑块号映射到物理块号 —— 就是页表。物理块跳着放没关系，块表负责串回逻辑顺序。</span></div>
      </Sec>

      <Sec n={3} title="要空间就从空闲池拿，结束就归还">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>{Icn.check}拿到哪块都行</h4><p>装满当前块 → 从<em>空闲块池</em>取一块新的，不要求连续 —— 从根上没有外碎片。</p></div>
          <div className="gd-card t"><h4>{Icn.ruler}结束按块归还</h4><p>请求完成 → 它的物理块<em>全部还回池子</em>，下一个请求立刻能复用（像进程退出释放页框）。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'KV 切成固定块' }, { cls: 'pd', text: '每请求一张块表（=页表）' },
          { cls: 'pi', text: '要空间从空闲池拿' }, { cls: 'ph', text: '物理块想放哪放哪' },
          { cls: 'pm', text: '结束按块归还复用' },
        ]}
        why={<><b>为什么这一招让显存利用率暴涨：</b>连续分配下，显存"总量够却拼不出整块"的浪费能到几十个百分点。分页把 KV 拆成小块、用块表映射，物理上碎着放也能逻辑上连起来 —— 显存能几乎<b>用满</b>，同样的卡因此能塞下多得多的并发请求。这跟操作系统当年用分页取代连续内存分配，是<b>同一个胜利</b>。cs-lab 里「动态分区的外碎片」「页面置换的物理块」「位示图的空闲管理」讲的就是这套地基。</>} />
    </Shell>
  )
}

// ═══════════════ softmax 与温度 ═══════════════
function SoftmaxDiagram() {
  //  两个小分布：低温尖 / 高温平（示意，非精确）
  const bar = (p: number[], hot: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {p.map((v, k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 44, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)' }}>{['好', '热', '冷', '差'][k]}</span>
          <div style={{ flex: 1, height: 16, background: 'var(--sunk-2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${v * 100}%`, height: '100%', background: hot ? 'var(--f-idx)' : 'var(--f-tag)', borderRadius: 4 }} />
          </div>
          <span style={{ width: 34, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)' }}>{Math.round(v * 100)}%</span>
        </div>
      ))}
    </div>
  )
  return (
    <Shell icon={Icn.chip} title="softmax 与温度"
      sub="看懂：打分怎么变成概率，温度调的到底是什么">
      <Sec n={1} title="softmax：一串打分 → 一个概率分布">
        <div className="gd-formula">
          prob<sub>i</sub> = exp(<span className="ft">logit<sub>i</sub></span>) ÷ <span className="fi">Σ exp(logit)</span>
        </div>
        <div className="gd-note">{Icn.info}<span><b>logit</b> 是模型给每个候选 token 的原始打分，可正可负、加起来不为 1。取 <b>exp</b>（保证非负、把大的拉更大），再<b>除以总和</b>（保证加起来正好是 1）—— 就成了概率。大模型每吐一个字都做这一步。</span></div>
      </Sec>

      <Sec n={2} title="温度：softmax 之前先把 logit 除以 T">
        <div className="gd-formula" style={{ fontSize: 14 }}>
          softmax( <span className="ft">logit</span> ÷ <span className="fo">T</span> )
        </div>
        <div className="gd-lane" style={{ marginTop: 12 }}>
          <div className="gd-card t"><h4>低温 T=0.5 → 尖</h4>{bar([0.79, 0.16, 0.03, 0.02], false)}<p style={{ marginTop: 8 }}>差距被<em>放大</em>，几乎只选最大的那个 —— 接近<em>贪心、确定</em>。</p></div>
          <div className="gd-card i"><h4>高温 T=2 → 平</h4>{bar([0.33, 0.25, 0.22, 0.20], true)}<p style={{ marginTop: 8 }}>差距被<em>压平</em>，各选项都有机会 —— 更<em>随机、有创造性</em>。</p></div>
        </div>
      </Sec>

      <Sec n={3} title="用熵量化「有多随机」">
        <div className="gd-formula">
          熵 = −Σ <span className="ft">p</span> · log₂<span className="ft">p</span>　（bit）　分布越平，熵越大
        </div>
        <div className="gd-note">{Icn.info}<span>熵把"更随机"变成一个数：均匀分布熵最大、集中在一个选项上熵最小。温度调高 → 分布变平 → 熵变大。这就是<b>「温度调的是随机性」</b>的精确说法。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '每个 token 一个 logit' }, { cls: 'pd', text: '先除以温度 T' },
          { cls: 'pi', text: 'exp 各项' }, { cls: 'pt', text: '除以总和 → 概率' },
          { cls: 'ph', text: 'T 小：尖/确定' }, { cls: 'pm', text: 'T 大：平/随机' },
        ]}
        why={<><b>为什么温度是"除法"而不是别的：</b>softmax 只看 logit 之间的<b>差距</b>（因为 exp 后要归一化，整体加常数没影响，但按比例缩放有影响）。除以 T 正好等比缩放所有 logit：T&gt;1 把差距缩小、softmax 出来更均匀；T&lt;1 把差距放大、更尖。这是用一个旋钮连续地在"贪心"和"纯随机"之间滑动 —— top-k / top-p 是在它之上再做截断，那是另一个实验。</>} />
    </Shell>
  )
}

// ═══════════════ 自注意力 ═══════════════
function AttentionDiagram() {
  //  「爱」查询到全句的注意力连线（权重 = 线的浓淡）
  const toks = ['它', '爱', '吃', '鱼']
  const w = [0.12, 0.12, 0.25, 0.51]
  return (
    <Shell icon={Icn.chip} title="自注意力原理"
      sub="看懂：每个词怎么『看』全句，Q/K/V 各是干嘛的">
      <Sec n={1} title="每个 token 带三个向量：Q / K / V">
        <div className="gd-lane">
          <div className="gd-card t"><h4>Q · Query</h4><p>我<em>要找什么</em> —— 拿它去和别人的 K 比。</p></div>
          <div className="gd-card i"><h4>K · Key</h4><p>我<em>能被什么找到</em> —— 别人拿 Q 来匹配我。</p></div>
          <div className="gd-card o"><h4>V · Value</h4><p>我<em>携带的信息</em> —— 被关注时贡献出去。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>真实模型里 Q/K/V 由每个 token 的 embedding 分别乘三个可学习矩阵得到。这一屏假设已经投影好，专讲注意力本身。</span></div>
      </Sec>

      <Sec n={2} title="一个查询关注谁：Q·K → softmax → 权重">
        <div className="gd-graph">
          <svg viewBox="0 0 380 176" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 「爱」在左，连到右边全句，线的浓淡=权重 */}
            {toks.map((_, j) => (
              <line key={j} x1="86" y1="88" x2="270" y2={28 + j * 40}
                stroke="var(--f-tag)" strokeWidth={0.8 + w[j] * 7} opacity={0.16 + w[j] * 0.8} />
            ))}
            {tnode(58, 88, '爱', 'var(--now)', 18)}
            {toks.map((t, j) => (
              <g key={j}>{tnode(298, 28 + j * 40, t, j === 3 ? 'var(--f-tag)' : 'var(--dim)', 15)}
                <text x={330} y={32 + j * 40} fontSize="11" fill="var(--faint)" fontFamily="var(--mono)">{Math.round(w[j] * 100)}%</text>
              </g>
            ))}
            <text x="58" y="118" textAnchor="middle" fontSize="10" fill="var(--faint)">查询</text>
            <text x="298" y="10" textAnchor="middle" fontSize="10" fill="var(--faint)">键 / 值</text>
          </svg>
        </div>
        <div className="gd-formula" style={{ fontSize: 13 }}>
          分数 = <span className="ft">Q · K</span> ÷ √d　→　softmax　→　注意力权重（和为 1）
        </div>
        <div className="gd-note">{Icn.info}<span>点积衡量"有多相关"，除 √d 防 softmax 饱和。「爱」和「鱼」的 Q·K 最大，softmax 后权重 51% —— 线最粗最深。</span></div>
      </Sec>

      <Sec n={3} title="加权求和：把最相关的信息吸进来">
        <div className="gd-formula">
          「爱」的新表示 = Σ <span className="fi">权重</span> × <span className="fo">各 token 的 V</span>
          {'  '}= 51%·V<sub>鱼</sub> + 25%·V<sub>吃</sub> + …
        </div>
        <div className="gd-note">{Icn.info}<span>关注得越多，那个 token 的 V 在结果里占比越大。于是「爱」的新表示里，主要是「鱼」的信息 —— 它<b>根据全句重新理解了自己</b>。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '每个 token 出 Q/K/V' }, { cls: 'pd', text: 'Q·K/√d 算分数' },
          { cls: 'pi', text: 'softmax → 注意力权重' }, { cls: 'pt', text: '按权重加权求和 V' },
          { cls: 'ph', text: '每个词看过全句' },
        ]}
        why={<><b>为什么这一招让 Transformer 取代了 RNN：</b>RNN 要一个字一个字顺着传，离得远的两个词之间信息要走很多步、容易丢。自注意力让<b>任意两个词直接连一条线</b>，权重由相关性决定 —— 长距离依赖一步到位，而且全句可以并行算，不必顺序等待。这就是「Attention is all you need」那篇论文的核心：把顺序处理换成一次性的全局关注。</>} />
    </Shell>
  )
}

// ═══════════════ 参数量与显存 ═══════════════
function LlmSizeDiagram() {
  return (
    <Shell icon={Icn.chip} title="参数量与显存原理"
      sub="看懂：7B 为什么要十几 G，参数堆在哪，KV 缓存吃多少">
      <Sec n={1} title="参数量：逐块加起来">
        <div className="gd-formula" style={{ textAlign: 'left', fontSize: 13 }}>
          <span className="ft">embedding</span> = vocab × d<br />
          每层 <span className="fi">注意力</span> = 4d²（Q/K/V/O 四个投影）<br />
          每层 <span className="fo">FFN</span> = 2 · ffn · d²（升维 + 降维，<b>通常最大</b>）<br />
          <b>总数 = embedding + 层数 ×（注意力 + FFN）</b>
        </div>
        <div className="gd-note">{Icn.info}<span>GPT-2 small（12 层、d=768）这么一算<b>恰好 124M</b>，和公布值分毫不差 —— 参数量不是玄学，是这几个数乘出来的。</span></div>
      </Sec>

      <Sec n={2} title="权重显存 = 参数量 × 每参数字节">
        <div className="gd-lane">
          <div className="gd-card t"><h4>fp16 · 2 字节</h4><p>7B × 2 = <em>≈ 14 GB</em> —— "7B 要十几 G"就是这么来的。</p></div>
          <div className="gd-card i"><h4>fp32 · 4 字节</h4><p>翻倍 → <em>≈ 28 GB</em>。训练常用，推理少用。</p></div>
          <div className="gd-card hit"><h4>int8 · 1 字节</h4><p>减半 → <em>≈ 7 GB</em>。<em>量化省的就是这块</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>参数量一个没变，只是每个参数存得更省。<b>量化推理</b>（W8A8 / W4A16）就是靠压字节数把大模型塞进小显存。</span></div>
      </Sec>

      <Sec n={3} title="第二块显存：KV 缓存，随上下文涨">
        <div className="gd-formula">
          KV 缓存 = 2（K和V）× <span className="ft">层数</span> × <span className="fi">序列长</span> × d × 字节
        </div>
        <div className="gd-note">{Icn.info}<span><b>权重是固定开销</b>（模型多大就多大）；<b>KV 缓存随「序列长度 × 并发数」线性涨</b>。8K 上下文比 512 的 KV 大十几倍 —— 长上下文、高并发烧的主要就是它。前缀缓存、PagedAttention 优化的正是这块。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '结构参数（层/d/vocab）' }, { cls: 'pd', text: '逐块算参数量' },
          { cls: 'pi', text: '× 每参数字节 = 权重显存' }, { cls: 'ph', text: '量化压字节省显存' },
          { cls: 'pm', text: 'KV 随上下文另算' },
        ]}
        why={<><b>为什么推理工程师必须会这道算术：</b>选卡、切批大小、定最大上下文、决定要不要量化 —— 每一个都要先估准显存。权重那块一算就死（参数量×字节），可控的是<b>精度（量化）</b>；KV 那块随并发和上下文涨，可控的是<b>批大小、上下文上限、以及 PagedAttention / 前缀缓存这些省 KV 的机制</b>。这道算术是推理服务容量规划的地基，也是这条路后面每个显存优化实验的共同前提。</>} />
    </Shell>
  )
}

// ═══════════════ 采样解码旋钮台 ═══════════════
function SamplingDiagram() {
  //  一条长尾分布，演示两种截断
  const toks = ['好', '棒', '妙', '行', '嗯', '呃', '唔']
  const pr = [0.48, 0.21, 0.14, 0.06, 0.04, 0.03, 0.04]
  const bar = (keep: (i: number) => boolean, cumMode: boolean) => {
    let acc = 0
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {toks.map((t, i) => {
          acc += pr[i]
          const k = keep(i)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: k ? 1 : 0.34 }}>
              <span style={{ width: 26, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)' }}>{t}</span>
              <div style={{ flex: 1, height: 15, background: 'var(--sunk-2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pr[i] * 180}%`, maxWidth: '100%', height: '100%', background: k ? 'var(--f-tag)' : 'var(--ghost)', borderRadius: 4 }} />
              </div>
              <span style={{ width: 34, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)' }}>{cumMode ? `Σ${Math.round(acc * 100)}` : `${Math.round(pr[i] * 100)}%`}</span>
              {!k && <span style={{ color: 'var(--miss)', fontSize: 11 }}>✕</span>}
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <Shell icon={Icn.chip} title="采样解码原理"
      sub="看懂：top-k / top-p 在砍什么，和温度怎么配">
      <Sec n={1} title="问题：softmax 分布有条长尾">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>softmax 后，一堆低概率 token（长尾）加起来也不少。直接采容易蹦出<b>离谱的词</b>。所以吐字前先把候选缩小，只在靠谱的那几个里随机采。</span></div>
      </Sec>

      <Sec n={2} title="两把截断刀：按个数 vs 按累计概率">
        <div className="gd-lane">
          <div className="gd-card t"><h4>top-k = 3</h4>{bar(i => i < 3, false)}<p style={{ marginTop: 8 }}>只留概率最高的 <em>3 个</em>，按<em>个数</em>截 —— 简单，但不管概率多接近都恰好留 3 个。</p></div>
          <div className="gd-card i"><h4>top-p = 0.8（核采样）</h4>{bar(i => i < 3, true)}<p style={{ marginTop: 8 }}>概率从大到小累加，留累计<em>刚超 0.8</em> 的一撮（48+21+14=83%）。按<em>累计概率</em>截 —— 尖只留一两个、平自动多留。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>砍完<b>重新归一化</b>（除以留下的概率之和），再从这一小撮里随机采一个 token。</span></div>
      </Sec>

      <Sec n={3} title="和温度配合：定「多稳 / 多野」">
        <div className="gd-formula" style={{ fontSize: 13 }}>
          <span className="ft">温度</span> 定分布多平　→　<span className="fi">top-k / top-p</span> 定砍多狠　→　在核里采样
        </div>
        <div className="gd-note">{Icn.info}<span>要<b>严谨</b>（翻译、代码）：低温 + 小 p，几乎只选最稳的；要<b>有创意</b>（写作、头脑风暴）：高温 + 大 p，放更多候选进来。三个旋钮是连续调节的"稳↔野"滑杆。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'softmax（温度）' }, { cls: 'pd', text: '按概率降序' },
          { cls: 'pi', text: 'top-k 留前 k / top-p 留核' }, { cls: 'pt', text: '砍长尾' },
          { cls: 'ph', text: '重归一化后采样' },
        ]}
        why={<><b>为什么 top-p 常比 top-k 好：</b>top-k 是"死数"——分布很尖时它可能把该采的第 2 名连同长尾一起留（k 太大），分布很平时又可能砍掉几个势均力敌的好候选（k 太小）。top-p 跟着<b>分布形状</b>走：模型很确定时核自动收小、只留最稳的；模型犹豫时核自动放大、保住多样性。所以现在多数系统默认用 top-p，或两者叠加取交集。它们都建立在 softmax 之上，是"怎么从概率分布里挑一个字"的最后一道工序。</>} />
    </Shell>
  )
}

// ═══════════════ KV 缓存 ═══════════════
function KvCacheDiagram() {
  const seq = ['深', '度', '学', '习', '真']
  return (
    <Shell icon={Icn.chip} title="KV 缓存原理"
      sub="看懂：为什么逐字生成不会越来越慢">
      <Sec n={1} title="问题：每个新字都要看前面所有字">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>自回归解码"看着前文吐下一个字"。算注意力时要用到<b>前面每个 token 的 K 和 V</b>。最朴素的做法：每吐一个字，就把整段前缀的 K/V <b>从头重算一遍</b> —— 第 j 步算 j+1 次，总量随长度<em>二次</em>增长（~L²/2），一长就卡死。</span></div>
      </Sec>

      <Sec n={2} title="招数：算过的 K/V 存起来，每步只算新的那一个">
        <div className="gd-graph">
          <svg viewBox="0 0 380 96" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {seq.map((t, k) => {
              const isNew = k === seq.length - 1
              return (
                <g key={k}>
                  <rect x={12 + k * 72} y="20" width="56" height="52" rx="7"
                    fill={isNew ? 'color-mix(in srgb,var(--now) 16%,var(--panel))' : 'color-mix(in srgb,var(--hit) 12%,var(--panel))'}
                    stroke={isNew ? 'var(--now)' : 'color-mix(in srgb,var(--hit) 45%,var(--line))'} strokeWidth={isNew ? 2 : 1.2} />
                  <text x={40 + k * 72} y="44" textAnchor="middle" fontSize="19" fill="var(--ink)">{t}</text>
                  <text x={40 + k * 72} y="62" textAnchor="middle" fontSize="10" fontFamily="var(--mono)"
                    fill={isNew ? 'var(--now)' : 'var(--hit)'}>{isNew ? '新算' : 'K/V'}</text>
                </g>
              )
            })}
            <text x="150" y="90" textAnchor="middle" fontSize="10" fill="var(--faint)">缓存里已有 4 对 K/V（读一下就用）</text>
            <text x="328" y="90" textAnchor="middle" fontSize="10" fill="var(--faint)">本步只算 1 个</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>绿框是<b>缓存里已算过</b>的 K/V，直接读；琥珀框是本步<b>新 token</b>，只算它一个。于是每步都是常数，总量从 ~L²/2 降到 <em>L</em>（线性）—— 这就是逐字生成不会越来越慢的原因。</span></div>
      </Sec>

      <Sec n={3} title="代价：缓存吃显存，随序列长度线性涨">
        <div className="gd-formula">
          KV 缓存 = 2（K和V）× <span className="ft">层数</span> × <span className="fi">序列长</span> × d × 字节
        </div>
        <div className="gd-note">{Icn.info}<span>省了计算，换来显存开销：每多生成一个 token 就多存一对 K/V。长上下文、高并发时这块会撑爆显存 —— 后面 <b>GQA</b>（多头共享 KV）、<b>PagedAttention</b>（分页省碎片）、<b>KV 卸载</b>省的都是它。KV 缓存是理解整个推理引擎内存问题的起点。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '预填充：整段 K/V 算一次' }, { cls: 'pd', text: '存进缓存' },
          { cls: 'pi', text: '解码每步只算新 token' }, { cls: 'pt', text: '读缓存拼注意力' },
          { cls: 'pm', text: '缓存 ∝ 序列长，另占显存' },
        ]}
        why={<><b>为什么它是推理引擎的第一课：</b>没有 KV 缓存，长文本生成的计算量是二次的，根本不可用；有了它，计算降到线性，但把压力从"算力"转移到了"显存"。之后一整套推理优化 —— GQA/MQA 减 KV 头、PagedAttention 消碎片、chunked prefill、KV 卸载与量化 —— 全都是在<b>省这块缓存或摊薄它的代价</b>。看懂 KV 缓存，才看得懂后面每一个内存优化实验在解决什么。</>} />
    </Shell>
  )
}

// ═══════════════ MHA / MQA / GQA ═══════════════
function MhaDiagram() {
  //  8 个 query 头 → 不同数量的 KV 头
  const variants: { name: string; kv: number; ratio: string; cls: string; note: ReactNode }[] = [
    { name: 'MHA', kv: 8, ratio: '100%', cls: 't', note: <>每个 query 头<em>独占</em>一个 KV 头 —— 表达力最强，KV 缓存最大。</> },
    { name: 'GQA', kv: 2, ratio: '25%', cls: 'hit', note: <>query 头<em>分组</em>共享（这里 2 组）—— 折中，<em>现在主流</em>。</> },
    { name: 'MQA', kv: 1, ratio: '12%', cls: 'i', note: <>所有 query 头<em>共享 1 个</em> KV 头 —— 最省，但可能掉点。</> },
  ]
  const mapFor = (kv: number) => Array.from({ length: 8 }, (_, q) => Math.min(kv - 1, Math.floor(q / Math.ceil(8 / kv))))
  return (
    <Shell icon={Icn.chip} title="MHA / MQA / GQA 原理"
      sub="看懂：KV 头共享怎么把 KV 缓存省下来">
      <Sec n={1} title="注意力分成多个头并行，每个头看一种关系">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>多头注意力把 Q/K/V 切成多个"头"并行算，每个头关注一种不同的关系（语法、指代、位置……），最后拼起来。<b>KV 缓存要为每个 KV 头各存一份</b> —— 所以 KV 头越多，缓存越大。三种变体差别只在：这些 query 头<b>怎么共享 KV 头</b>。</span></div>
      </Sec>

      <Sec n={2} title="三种共享方式：一对一 / 分组 / 全共享">
        <div className="gd-lane">
          {variants.map(v => {
            const map = mapFor(v.kv)
            return (
              <div key={v.name} className={`gd-card ${v.cls}`}>
                <h4>{v.name} · {v.kv} 个 KV 头</h4>
                <svg viewBox="0 0 160 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ width: '100%', height: 72 }}>
                  {map.map((k, q) => (
                    <line key={q} x1={12 + q * 19} y1="16" x2={80 / v.kv - 40 + (map[q] + 0.5) * (160 / v.kv)} y2="76"
                      stroke="var(--f-tag)" strokeWidth="1" opacity="0.5" />
                  ))}
                  {Array.from({ length: 8 }, (_, q) => (
                    <circle key={q} cx={12 + q * 19} cy="14" r="5" fill="color-mix(in srgb,var(--now) 20%,var(--panel))" stroke="var(--now)" strokeWidth="1" />
                  ))}
                  {Array.from({ length: v.kv }, (_, k) => (
                    <rect key={k} x={(80 / v.kv - 40) + k * (160 / v.kv) - 9} y="72" width="18" height="12" rx="2"
                      fill="color-mix(in srgb,var(--hit) 22%,var(--panel))" stroke="var(--hit)" strokeWidth="1" />
                  ))}
                </svg>
                <p>{v.note} KV 缓存 <em>{v.ratio}</em>。</p>
              </div>
            )
          })}
        </div>
        <div className="gd-note">{Icn.info}<span>上排 8 个圆是 query 头（不变），下排方块是 KV 头。连线表示"谁读谁"。从 MHA 到 GQA 到 MQA，KV 头一路减少 —— <b>KV 缓存正比于 KV 头数</b>，所以缓存从 100% 降到 12%。</span></div>
      </Sec>

      <Sec n={3} title="省的正是那块吃显存的 KV 缓存">
        <div className="gd-formula" style={{ fontSize: 13 }}>
          KV 缓存 ∝ <span className="ft">KV 头数</span>　→　MHA 存 8 份　＞　GQA 存 2 份　＞　MQA 存 1 份
        </div>
        <div className="gd-note">{Icn.info}<span>「参数量与显存」告诉我们 KV 缓存随<b>序列 × 并发</b>线性涨，是长上下文的显存瓶颈。GQA 用一点点表达力换来 KV 缓存<b>成倍缩小</b> —— 所以 LLaMA2、Qwen 等主流大模型几乎都用 GQA。它是把<b>注意力和 KV 显存放在一起权衡</b>的产物。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '注意力分多个 query 头' }, { cls: 'pd', text: 'KV 头怎么共享？' },
          { cls: 'pi', text: 'MHA 一对一 / MQA 全共享 / GQA 分组' }, { cls: 'pt', text: 'KV 缓存 ∝ KV 头数' },
          { cls: 'ph', text: 'GQA 折中，成主流' },
        ]}
        why={<><b>为什么大模型集体转向 GQA：</b>MHA 表达力最强但 KV 缓存最大，长上下文时显存扛不住；MQA 把 KV 砍到一个头、最省显存，但注意力表达力下降容易掉点。GQA 取中间 —— 让几个 query 头共享一个 KV 头，KV 缓存缩小数倍而精度几乎不掉。它直接决定了模型能开多长上下文、能并发多少请求，是"注意力结构"和"推理显存"的交汇点，也是 KV 缓存优化这条线里改动模型本身的那一招。</>} />
    </Shell>
  )
}

// ═══════════════ 连续批处理 ═══════════════
function BatchingDiagram() {
  return (
    <Shell icon={Icn.chip} title="连续批处理原理"
      sub="看懂：GPU 为什么要连续批处理才喂得饱">
      <Sec n={1} title="问题：静态批处理，快的等慢的">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>GPU 一次算一整批请求最划算。但一批里各请求<b>生成长度不一样</b>：短的早早算完，却要<b>空等这一批里最长的那个</b>结束才能整批换下一批。空出来的槽位一直干等 —— GPU 在空转。</span></div>
      </Sec>

      <Sec n={2} title="招数：连续批处理，谁完事立刻换新的进来">
        <div className="gd-lane">
          <div className="gd-card i"><h4>静态批处理</h4>
            <p>整批一起进、一起出。请求 A 第 3 步就完了，槽位却要<em>空等到第 8 步</em>（最长的 D 结束）。利用率 <em>≈ 70%</em>。</p></div>
          <div className="gd-card hit"><h4>连续批处理（in-flight）</h4>
            <p>每个解码步都是一次调度：<em>谁生成完就立刻退出</em>，空出的槽位<em>马上放等待队列里的新请求</em>进来。GPU 几乎不空转，利用率 <em>≈ 92%</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>关键：解码是<b>逐步</b>的，天然可以在<b>每一步的边界</b>上换人。这和操作系统调度器"时间片到就换进程"是同一招 —— 把大颗粒的"整批"拆成细颗粒的"每步"。</span></div>
      </Sec>

      <Sec n={3} title="为什么这对吞吐至关重要">
        <div className="gd-formula" style={{ fontSize: 13 }}>
          <span className="ft">解码是显存带宽瓶颈</span>　→　批里请求越多、越满　→　<span className="fi">同一次读权重摊给更多请求</span>　→　吞吐越高
        </div>
        <div className="gd-note">{Icn.info}<span>解码阶段每步都要把整个模型权重读一遍，是<b>显存带宽</b>瓶颈而非算力瓶颈。批越满，这次读权重就摊薄给越多请求，单位成本越低。连续批处理让批<b>时刻保持满载</b> —— 这是 vLLM 等推理引擎吞吐领先的核心机制之一，常和 PagedAttention 搭配（分页让新请求能随时插进来）。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '请求陆续到达' }, { cls: 'pd', text: '静态：凑满一批一起跑' },
          { cls: 'pi', text: '等最慢的 → 空槽干等' }, { cls: 'pt', text: '连续：每步动态换人' },
          { cls: 'ph', text: '空槽立刻补新请求，喂饱 GPU' },
        ]}
        why={<><b>为什么它是吞吐的命门：</b>大模型服务的成本几乎全在 GPU 时间上，而解码阶段 GPU 很容易因为"批不满"而空转。静态批处理让快请求陪着慢请求一起耗，利用率上不去；连续批处理在每个解码步的边界上动态增删请求，让批时刻满载，同样的卡能多服务几倍的并发。它建立在调度思想之上（和进程调度同源），又依赖 PagedAttention 这类机制让请求能随时进出显存 —— 是把"调度"和"显存管理"两条线拧在一起的产物。</>} />
    </Shell>
  )
}

// ═══════════════ BPE 分词 ═══════════════
function BpeDiagram() {
  return (
    <Shell icon={Icn.chip} title="BPE 分词原理"
      sub="看懂：token 从哪来，中文为什么更费 token">
      <Sec n={1} title="起点：先拆成最小单元">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>模型不认字，只认 token。BPE（字节对编码）先把文本拆成<b>最小单元</b>（字节 / 字符），再靠数据统计一步步<b>合并高频的相邻对</b>，长出一张词表。常见的串会被合成一个 token，生僻的串保持零散。</span></div>
      </Sec>

      <Sec n={2} title="迭代合并：数最高频的相邻对，并成新符号">
        <div className="gd-graph">
          <svg viewBox="0 0 380 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {[['l','o','w','e','s','t'], ['lo','w','e','s','t'], ['low','e','st']].map((row, r) => (
              <g key={r}>
                <text x="8" y={26 + r * 40} fontSize="10" fill="var(--faint)">{r === 0 ? '起' : r === 1 ? '并 l+o' : '并到'}</text>
                {row.map((tok, i) => (
                  <g key={i}>
                    <rect x={52 + i * 52} y={12 + r * 40} width={Math.max(28, tok.length * 13)} height="22" rx="4"
                      fill={tok.length > 1 ? 'color-mix(in srgb,var(--f-tag) 16%,var(--panel))' : 'var(--sunk-2)'}
                      stroke={tok.length > 1 ? 'var(--f-tag)' : 'var(--line)'} strokeWidth="1" />
                    <text x={52 + i * 52 + Math.max(28, tok.length * 13) / 2} y={27 + r * 40} textAnchor="middle" fontSize="12" fontFamily="var(--mono)" fill="var(--ink)">{tok}</text>
                  </g>
                ))}
              </g>
            ))}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>"lowest"从 6 个字符，经过合并 l+o→lo、lo+w→low、s+t→st，压到 <b>3 个 token</b>。数据里越常一起出现的对，越早被并、越省 token。词表就是这么一对一对"长"出来的。</span></div>
      </Sec>

      <Sec n={3} title="中文为什么更费 token">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>英文</h4><p>26 个字母高频复用，"the/ing/tion"这类常见串很早被合并 —— 一个常用词往往<em>1 个 token</em>。</p></div>
          <div className="gd-card i"><h4>中文</h4><p>常用字就几千个、组合分散，多数字对频次不够高、<em>合并少</em>。一个汉字常要 <em>1～3 个 token</em>，同样一句话 token 更多。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>token 数直接等于<b>成本和上下文占用</b>：同样一段意思，中文吃的 token 往往比英文多，API 更贵、也更快撑满上下文窗口。分词器的语料配比，直接决定了一门语言的"推理性价比"。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '文本拆成最小单元' }, { cls: 'pd', text: '数相邻对频次' },
          { cls: 'pi', text: '合并最高频的一对' }, { cls: 'pt', text: '重复到词表满' },
          { cls: 'ph', text: '常见串 = 一个 token' },
        ]}
        why={<><b>为什么分词是推理成本的隐形地基：</b>模型的一切计算、显存、计费都以 token 为单位，而"一段文字等于多少 token"完全由 BPE 词表决定。词表偏向哪种语料，哪种语言就更省 token、更便宜、上下文装得更多。它看似只是预处理的一步，却决定了 KV 缓存要存多少、上下文窗口够不够用、每次调用花多少钱 —— 是这条推理之路最上游、也最容易被忽略的一环。</>} />
    </Shell>
  )
}

// ═══════════════ FlashAttention ═══════════════
function FlashDiagram() {
  return (
    <Shell icon={Icn.chip} title="FlashAttention 原理"
      sub="看懂：为什么分块能加速却不掉一点精度">
      <Sec n={1} title="问题：分数向量在 HBM 里来回搬（访存瓶颈）">
        <div className="gd-graph">
          <svg viewBox="0 0 380 96" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <rect x="12" y="30" width="150" height="40" rx="6" fill="color-mix(in srgb,var(--miss) 8%,var(--panel))" stroke="var(--miss)" strokeWidth="1" />
            <text x="87" y="50" textAnchor="middle" fontSize="12" fill="var(--ink)">HBM · 显存</text>
            <text x="87" y="64" textAnchor="middle" fontSize="9.5" fill="var(--faint)">大而慢</text>
            <rect x="238" y="30" width="130" height="40" rx="6" fill="color-mix(in srgb,var(--hit) 10%,var(--panel))" stroke="var(--hit)" strokeWidth="1" />
            <text x="303" y="50" textAnchor="middle" fontSize="12" fill="var(--ink)">SRAM · 片上</text>
            <text x="303" y="64" textAnchor="middle" fontSize="9.5" fill="var(--faint)">极小极快</text>
            {[0, 1, 2].map(k => (
              <g key={k}>
                <path d={`M168 ${40 + k * 8} h64`} stroke="var(--miss)" strokeWidth="1.4" opacity={0.7 - k * 0.15} markerEnd="url(#flarr)" />
              </g>
            ))}
            <defs><marker id="flarr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--miss)" /></marker></defs>
            <text x="200" y="26" textAnchor="middle" fontSize="9.5" fill="var(--miss)">写 S · 读 softmax · 读 ×V（~3 趟）</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>标准注意力先把整行分数 S = Q·Kᵀ 写进 HBM，再读回做 softmax，再读一遍算 ×V。那条长度 N 的分数向量（长上下文里是 N×N 矩阵）在慢速 HBM 里<b>来回搬好几趟</b> —— 慢在<b>访存</b>，不在算力。</span></div>
      </Sec>

      <Sec n={2} title="招数：分块 + 在线 softmax，滚动累加 m / l / O">
        <div className="gd-formula" style={{ textAlign: 'left', fontSize: 13 }}>
          每来一个新块，先<span className="ft">对齐</span>旧累加，再<span className="fi">加</span>本块：<br />
          <span className="fi">l</span> ← l · exp(m<sub>旧</sub> − m<sub>新</sub>) + Σ exp(sⱼ − m<sub>新</sub>)<br />
          <span className="fo">O</span> ← O · exp(m<sub>旧</sub> − m<sub>新</sub>) + Σ exp(sⱼ − m<sub>新</sub>)·Vⱼ<br />
          最后 <b>输出 = O / l</b>
        </div>
        <div className="gd-note">{Icn.info}<span>K/V 切成小块搬进 SRAM，只维护三个滚动量：<b>m</b>（目前最大分数）、<b>l</b>（exp 之和）、<b>O</b>（加权和）。旧累加按 exp(Δm) 缩放对齐到新最大值，再加本块贡献 —— 完整的分数向量<b>从不需要存下来</b>。</span></div>
      </Sec>

      <Sec n={3} title="为什么不掉精度：softmax 同减常数不变">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>结果完全等价</h4><p>softmax 对所有分数<em>同减一个常数</em>值不变，所以分块累加和一次性 softmax <em>分毫不差</em>（相对误差 ~1e-9，纯浮点噪声）。改块大小，输出一个小数点都不变。</p></div>
          <div className="gd-card i"><h4>省的是访存</h4><p>那条分数向量<em>0 次落 HBM</em>（朴素 ~3N 趟）。这和 CPU 用缓存<em>分块 blocking</em> 优化矩阵乘是同一招 —— 让数据待在快的那层算完。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>关键区别：分块只改变<b>怎么算</b>（能塞进 SRAM、少搬数据），不改变<b>算出什么</b>。所以它能大幅加速<b>而不是</b>近似 —— 这是它成为现代推理引擎标配算子的原因。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'K/V 切成小块' }, { cls: 'pd', text: '一块块搬进 SRAM' },
          { cls: 'pi', text: '在线 softmax 滚动累加（缩放对齐）' }, { cls: 'pt', text: '分数向量不落 HBM' },
          { cls: 'ph', text: '结果与一次性等价，只是更快' },
        ]}
        why={<><b>为什么它是推理引擎的关键算子：</b>Transformer 的注意力在长上下文下是访存密集型 —— 真正的成本是把巨大的 N×N 分数矩阵在 HBM 里反复搬运。FlashAttention 用在线 softmax 把注意力重写成分块流式计算，让中间结果永远待在片上 SRAM，把访存量从 O(N²) 降到接近 O(N)，还顺带省了那块显存。它不改变数学结果，只改变数据在存储层次里怎么流动 —— 和 Cache 分块、循环 tiling 是同一套思想，是"用体系结构知识改写算子"的典范，也是这条推理之路上"计算与访存"这一支的顶点。</>} />
    </Shell>
  )
}

// ═══════════════ 缩放点积 + causal mask ═══════════════
function ScaledMaskDiagram() {
  const toks = ['它', '爱', '吃', '鱼']
  //  下三角热力（示意权重 %）
  const M = [
    [100, 0, 0, 0],
    [18, 82, 0, 0],
    [25, 6, 69, 0],
    [7, 31, 11, 51],
  ]
  return (
    <Shell icon={Icn.chip} title="缩放点积 + 因果掩码原理"
      sub="看懂：√d 防饱和，掩码让每个词只看前文">
      <Sec n={1} title="除 √d：把分数拉回量程，别让 softmax 饱和">
        <div className="gd-formula" style={{ fontSize: 13 }}>
          分数 = <span className="ft">Q · K</span> ÷ <span className="fi">√d</span>　→　softmax
        </div>
        <div className="gd-lane">
          <div className="gd-card i"><h4>不除 √d</h4><p>点积随维度 d 变大 → 分数很大 → softmax <em>饱和</em>：一个≈100%、其余≈0，分布几乎平坦、<em>梯度消失</em>，模型学不动。</p></div>
          <div className="gd-card hit"><h4>除 √d</h4><p>分数按 √d 缩回合适量程 → softmax 软硬适中。<em>d 越大除得越多</em>（本实验 d=1→64，最大权重 95%→59%，肉眼变平）。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>这就是「缩放点积注意力」名字里那个 √d 的来历 —— 它不改变谁关注谁，只把分数调到 softmax 不饱和的地方，让训练时梯度传得回去。</span></div>
      </Sec>

      <Sec n={2} title="因果掩码：把未来位设 −∞ → 矩阵成下三角">
        <div className="gd-graph">
          <svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {toks.map((t, j) => <text key={`c${j}`} x={70 + j * 52} y="18" textAnchor="middle" fontSize="12" fill="var(--dim)">{t}</text>)}
            {toks.map((t, i) => (
              <g key={`r${i}`}>
                <text x="30" y={44 + i * 30} textAnchor="middle" fontSize="12" fill="var(--dim)">{t}</text>
                {toks.map((_, j) => {
                  const masked = j > i
                  const w = M[i][j]
                  return (
                    <g key={j}>
                      <rect x={50 + j * 52} y={30 + i * 30} width="44" height="24" rx="4"
                        fill={masked ? 'var(--sunk-2)' : `color-mix(in srgb,var(--f-tag) ${Math.round(w * 0.85)}%,var(--panel))`}
                        stroke={masked ? 'var(--line-soft)' : 'var(--line-soft)'} strokeWidth="1"
                        strokeDasharray={masked ? '3 2' : undefined} />
                      <text x={72 + j * 52} y={46 + i * 30} textAnchor="middle" fontSize="10.5" fontFamily="var(--mono)"
                        fill={masked ? 'var(--faint)' : w > 55 ? '#fff' : 'var(--ink)'}>{masked ? '·' : w}</text>
                    </g>
                  )
                })}
              </g>
            ))}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>第 i 行里所有 j&gt;i 的位（<span style={{ fontFamily: 'var(--mono)' }}>·</span>）分数被设成 −∞，softmax 后权重恰为 <b>0</b>。于是矩阵成<b>严格下三角</b> —— 每个词只看得见自己和前文，看不见未来。每行剩下的权重仍然和为 1。</span></div>
      </Sec>

      <Sec n={3} title="一处开关，分出 GPT 和 BERT">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>开因果掩码 = <b>单向</b>（GPT 类，能自回归逐字生成）；关掉 = <b>双向</b>（BERT 类，每个词能看全句，适合理解任务但不能直接生成）。同一套注意力，掩码这一层决定了模型是"写手"还是"读者"。这也是训练时的可见范围必须和推理时逐字生成一致的原因。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'Q·K 打分' }, { cls: 'pd', text: '÷ √d 拉回量程' },
          { cls: 'pi', text: '盖因果掩码：未来位 → −∞' }, { cls: 'pt', text: 'softmax（未来位权重 0）' },
          { cls: 'ph', text: '下三角 · 只看前文' },
        ]}
        why={<><b>为什么这两步是 Transformer 跑得起来的前提：</b>没有 √d，深/宽模型的注意力分数会大到让 softmax 饱和，梯度消失、根本训不动；没有因果掩码，模型训练时就能"看到答案"（未来的词），学到的是作弊而非预测，推理时逐字生成立刻崩。这两步都不改变注意力"算谁"，只管分数的<b>量程</b>和<b>可见范围</b> —— 却是让注意力从一个数学公式变成能训练、能生成的真实组件的关键，也是读懂后面 KV 缓存（只存前文的 K/V，正因为看不见未来）的基础。</>} />
    </Shell>
  )
}

// ═══════════════ 投机解码 ═══════════════
function SpecDecDiagram() {
  const truth = ['深', '度', '学', '习']
  const draft = ['深', '度', '猫', '习']
  return (
    <Shell icon={Icn.chip} title="投机解码原理"
      sub="看懂：小模型帮大模型一次多吐几个字，还不掉质量">
      <Sec n={1} title="问题：大模型一次只吐一个字，每字一遍前向">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>大模型解码时，<b>每生成一个 token 都要把整个模型跑一遍前向</b>（贵，且是显存带宽瓶颈）。生成 100 字就要 100 次大模型前向 —— 慢就慢在这个逐字的串行上。</span></div>
      </Sec>

      <Sec n={2} title="招数：草稿猜 K 个，大模型一次并行验证">
        <div className="gd-graph">
          <svg viewBox="0 0 380 132" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="8" y="24" fontSize="10.5" fill="var(--faint)">草稿猜</text>
            <text x="8" y="86" fontSize="10.5" fill="var(--faint)">大模型验</text>
            {draft.map((t, j) => {
              const ok = t === truth[j]
              const firstMiss = j === draft.findIndex((d, i) => d !== truth[i])
              return (
                <g key={j}>
                  <rect x={70 + j * 68} y="10" width="52" height="30" rx="5"
                    fill="color-mix(in srgb,var(--f-tag) 10%,var(--panel))" stroke="var(--f-tag)" strokeWidth="1" />
                  <text x={96 + j * 68} y="30" textAnchor="middle" fontSize="15" fill="var(--ink)">{t}</text>
                  <rect x={70 + j * 68} y="72" width="52" height="30" rx="5"
                    fill={ok ? 'color-mix(in srgb,var(--hit) 14%,var(--panel))' : firstMiss ? 'color-mix(in srgb,var(--now) 16%,var(--panel))' : 'var(--sunk-2)'}
                    stroke={ok ? 'var(--hit)' : firstMiss ? 'var(--now)' : 'var(--line-soft)'} strokeWidth="1"
                    strokeDasharray={!ok && !firstMiss ? '3 2' : undefined} />
                  <text x={96 + j * 68} y="92" textAnchor="middle" fontSize="15"
                    fill={ok ? 'var(--ink)' : firstMiss ? 'var(--now)' : 'var(--faint)'}>{ok ? t : firstMiss ? truth[j] : t}</text>
                  <text x={96 + j * 68} y="58" textAnchor="middle" fontSize="10"
                    fill={ok ? 'var(--hit)' : firstMiss ? 'var(--now)' : 'var(--faint)'}>{ok ? '✓ 接受' : firstMiss ? '✗ 纠正' : '作废'}</text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>草稿模型一口气猜 K 个（上排）。大模型<b>一次前向</b>并行验证这几个位置（下排）：接受猜对的<b>最长前缀</b>（深、度 ✓），第一个错处（猫）用大模型<b>真值「学」纠正</b>，后面作废。全中还白送 1 个。<b>一次前向落地了 3 个字</b>。</span></div>
      </Sec>

      <Sec n={3} title="为什么不掉质量：每个字都由大模型定夺">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>输出完全一致</h4><p>落地的每个 token <em>都是大模型验证/纠正后的真值</em>，草稿只负责提议。所以结果和<em>只用大模型逐字生成一模一样</em>，不是近似。</p></div>
          <div className="gd-card i"><h4>省的是前向次数</h4><p>一次大模型前向能验证多个位置（本就带宽瓶颈，验 1 个和验 K+1 个差不多）。草稿越准接受越多，<em>加速比越高</em>（本例 2.67×）。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>K 越大、草稿越准，一次落地的字越多。这就是 Medusa、EAGLE 等"又快又不掉点"方案的共同内核 —— 用一个便宜的猜测者，把大模型的串行逐字变成"一次验证一批"。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '草稿模型猜 K 个' }, { cls: 'pd', text: '大模型一次前向并行验证' },
          { cls: 'pi', text: '接受最长正确前缀' }, { cls: 'pt', text: '首错处用真值纠正 / 全中白送' },
          { cls: 'ph', text: '一次前向吐多个字，结果不变' },
        ]}
        why={<><b>为什么它是"免费"的加速：</b>大模型逐字解码时 GPU 其实很闲 —— 瓶颈是反复把权重从显存搬进来（带宽），算力没用满。投机解码正好利用这一点：让大模型一次前向多验几个位置几乎不额外花钱，却可能一次落地好几个字。而且因为每个 token 最终都由大模型定夺，输出分布和原模型完全一致（严格版用拒绝采样保证）。它不改模型、不掉质量，纯靠"把闲置算力换成吞吐"，是当下推理加速最实用的一招，和 KV 缓存、连续批处理正交、可叠加。</>} />
    </Shell>
  )
}

// ═══════════════ 权重量化 ═══════════════
function QuantDiagram() {
  //  一条数轴：连续实数 → int4 的 15 个格
  const ticks = Array.from({ length: 15 }, (_, k) => k - 7)  // -7..7
  return (
    <Shell icon={Icn.chip} title="权重量化原理"
      sub="看懂：权重怎么从 4 字节压到 1 字节，误差从哪来">
      <Sec n={1} title="定标：scale = 最大绝对值 ÷ 整数上限">
        <div className="gd-formula" style={{ fontSize: 13 }}>
          <span className="ft">scale</span> = max|w| ÷ (2<sup>bits−1</sup> − 1)　·　<span className="fi">q</span> = round(w ÷ scale)　·　ŵ = q × scale
        </div>
        <div className="gd-note">{Icn.info}<span>先找这组权重里绝对值最大的那个，把它对到整数的顶格（int8 是 ±127、int4 是 ±7）。这样定出步长 scale —— <b>整数每一格代表多大的实数</b>。绝对值最大的权重误差几乎为 0，因为 scale 就是照它定的。</span></div>
      </Sec>

      <Sec n={2} title="量化：把每个权重吸附到最近的整数格">
        <div className="gd-graph">
          <svg viewBox="0 0 380 84" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <line x1="16" y1="44" x2="364" y2="44" stroke="var(--line)" strokeWidth="1.4" />
            {ticks.map((t, k) => {
              const x = 16 + (k / 14) * 348
              return <g key={k}>
                <line x1={x} y1="38" x2={x} y2="50" stroke="var(--line)" strokeWidth="1" />
                {t % 7 === 0 && <text x={x} y="66" textAnchor="middle" fontSize="9" fill="var(--faint)" fontFamily="var(--mono)">{t}</text>}
              </g>
            })}
            {/* 一个真实权重落在两格之间，被吸到最近格 */}
            <circle cx={16 + (7.6 / 14) * 348} cy="44" r="4" fill="var(--miss)" />
            <text x={16 + (7.6 / 14) * 348} y="26" textAnchor="middle" fontSize="9.5" fill="var(--miss)">w/scale=0.6</text>
            <circle cx={16 + (7 / 14) * 348} cy="44" r="5" fill="none" stroke="var(--now)" strokeWidth="2" />
            <path d={`M${16 + (7.6/14)*348} 44 L${16 + (7/14)*348} 44`} stroke="var(--now)" strokeWidth="1.4" markerEnd="url(#qzar)" />
            <defs><marker id="qzar" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--now)"/></marker></defs>
            <text x={16 + (7/14)*348} y="82" textAnchor="middle" fontSize="9" fill="var(--now)">四舍五入→ q=0 · 差值=误差</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>每个权重除以 scale、<b>四舍五入</b>到最近的整数格，只存这个整数。落在两格之间的部分被抹掉 —— 那点差值就是<b>舍入误差</b>。格子越密（位数越多），吸附得越准。</span></div>
      </Sec>

      <Sec n={3} title="位数决定：省多少显存，差多少精度">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>int8 · 1 字节</h4><p>127 格，很密。显存<em>省 75%</em>（4B→1B），误差极小（本例 0.008）。主流权重量化档位。</p></div>
          <div className="gd-card i"><h4>int4 · 0.5 字节</h4><p>只 7 格，很粗。显存<em>再省一半</em>（省 87.5%），但 scale 翻倍、误差明显变大（0.14）。塞进小卡的极限档。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>这就是「7B 用 int8 只要 ~7G」的来历。位越少、整数格越粗、误差越大，但每个权重占的字节越少 —— <b>拿一点精度换成倍的显存和访存带宽</b>，正是 W8A8 / W4A16 量化推理的地基。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '一组 fp32 权重' }, { cls: 'pd', text: 'scale = max|w| ÷ 整数上限' },
          { cls: 'pi', text: 'q = round(w/scale) 存整数' }, { cls: 'pt', text: '反量化 ŵ = q·scale' },
          { cls: 'ph', text: '省显存，差一点点精度' },
        ]}
        why={<><b>为什么量化是把大模型落地的关键一招：</b>大模型跑不动，十有八九是显存装不下、或访存带宽喂不饱 —— 而权重是这两者的大头。量化不改结构、不重训（后训练量化），只把权重用更少的位编码，就能把显存和带宽需求砍掉一半到四分之三，让 7B、70B 模型塞进消费级甚至单卡。代价是可控的舍入误差，靠 per-channel、分组 scale、混合精度等手段还能进一步压小。它和 IEEE754、补码是同一套"数值编码"思想的延续，也是 W8A8/W4A16 量化推理、KV 缓存量化等一系列工程的共同地基。</>} />
    </Shell>
  )
}

// ═══════════════ FFN 与 MoE 路由 ═══════════════
function MoeDiagram() {
  const experts = [0, 1, 2, 3]
  const chosen = [0, 2]        // 本 token 选中的专家
  const gate = { 0: 73, 2: 27 } as Record<number, number>
  return (
    <Shell icon={Icn.chip} title="FFN 与 MoE 路由原理"
      sub="看懂：总参数几百 B，推理为什么只激活几十 B">
      <Sec n={1} title="稠密 FFN：每个 token 都过整个大网络">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>Transformer 每层都有个 FFN，通常是<b>参数量最大</b>的块。稠密模型里每个 token 都要<b>过同一个大 FFN、全部参数都算</b>。想更聪明就得把 FFN 做大 —— 但那样每个 token 的算力也一起涨，越大越慢。</span></div>
      </Sec>

      <Sec n={2} title="MoE：拆成 E 个专家，router 只选 top-k 个来算">
        <div className="gd-graph">
          <svg viewBox="0 0 380 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* token */}
            <circle cx="40" cy="75" r="18" fill="color-mix(in srgb,var(--now) 16%,var(--panel))" stroke="var(--now)" strokeWidth="1.5" />
            <text x="40" y="80" textAnchor="middle" fontSize="15" fill="var(--ink)">猫</text>
            <text x="40" y="108" textAnchor="middle" fontSize="9" fill="var(--faint)">token</text>
            {/* router */}
            <rect x="86" y="60" width="46" height="30" rx="6" fill="var(--sunk-2)" stroke="var(--line)" strokeWidth="1" />
            <text x="109" y="79" textAnchor="middle" fontSize="10.5" fill="var(--dim)">router</text>
            <line x1="58" y1="75" x2="86" y2="75" stroke="var(--line)" strokeWidth="1.2" />
            {/* experts */}
            {experts.map((e, k) => {
              const on = chosen.includes(e)
              const y = 18 + k * 33
              return <g key={e}>
                <line x1="132" y1="75" x2="230" y2={y + 13} stroke={on ? 'var(--hit)' : 'var(--line-soft)'} strokeWidth={on ? 1.6 : 1} strokeDasharray={on ? undefined : '3 2'} opacity={on ? 1 : 0.5} />
                <rect x="230" y={y} width="118" height="26" rx="6"
                  fill={on ? 'color-mix(in srgb,var(--hit) 12%,var(--panel))' : 'var(--panel)'}
                  stroke={on ? 'var(--hit)' : 'var(--line-soft)'} strokeWidth="1" opacity={on ? 1 : 0.55} />
                <text x="244" y={y + 17} fontSize="11.5" fill={on ? 'var(--ink)' : 'var(--faint)'}>专家 {e}</text>
                <text x="338" y={y + 17} textAnchor="end" fontSize="11" fontFamily="var(--mono)"
                  fill={on ? 'var(--hit)' : 'var(--faint)'}>{on ? `门控 ${gate[e]}%` : '跳过'}</text>
              </g>
            })}
          </svg>
        </div>
        <div className="gd-formula" style={{ fontSize: 13 }}>
          门控 = softmax(router 分数)　→　取 <span className="fi">top-k</span>　→　输出 = Σ <span className="ft">门控ᵢ</span>·专家ᵢ(x)
        </div>
        <div className="gd-note">{Icn.info}<span>router 给每个专家打分、softmax 成门控，只选门控最高的 <b>top-k</b> 个专家来算（这里 k=2：专家 0、2），其余<b>整块跳过</b>。输出是选中专家结果按门控加权求和。</span></div>
      </Sec>

      <Sec n={3} title="又大又省：参数随 E 涨，算力只随 k 涨">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>容量变大</h4><p>总参数 ∝ 专家数 E。加专家 = 加知识容量，模型能记更多 —— 却<em>不增加</em>每个 token 的计算量。</p></div>
          <div className="gd-card i"><h4>算力省</h4><p>每个 token 只激活 k 个专家，<em>活跃参数 ∝ k/E</em>。E=8、k=2 就只算 25%。这就是"几百 B 参数、只激活几十 B"。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>代价是<b>负载不均</b>：router 会偏爱某些专家，热门的排长队、冷门的闲置（本实验 4 专家负载 [3,1,3,1]）。真实 MoE 靠负载均衡损失、专家容量上限把 token 摊匀。这是"稀疏激活换容量"的典型工程 —— Mixtral、DeepSeek-V3、Qwen-MoE 都走这条路。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '大 FFN 拆成 E 个专家' }, { cls: 'pd', text: 'router 给 token 打分' },
          { cls: 'pi', text: 'softmax → 选 top-k' }, { cls: 'pt', text: '只算 k 个 · 加权求和' },
          { cls: 'ph', text: '参数随 E 涨，算力随 k 涨' },
        ]}
        why={<><b>为什么 MoE 是把模型做大的高性价比路线：</b>稠密模型想变强只能整体变大，参数和算力同步膨胀，推理越来越贵。MoE 把"容量"和"每 token 算力"解耦 —— 加专家提升容量几乎不加单 token 计算，于是能用几十上百 B 的总参数、却只付几个专家的推理成本。它需要额外解决路由和负载均衡（否则专家忙闲不均、显存和吞吐都吃亏），也和专家并行（EP）、稀疏 kernel 等推理工程紧密相关。理解 MoE，就理解了当下把大模型规模继续往上推、同时压住推理成本的主流手段。</>} />
    </Shell>
  )
}

// ═══════════════ RoPE 旋转位置编码 ═══════════════
function RopeDiagram() {
  const C = 60, R = 46
  const poss = [0, 1, 2, 3]      // 位置 0..3，每位转 45°
  const th = Math.PI / 4
  return (
    <Shell icon={Icn.chip} title="RoPE 旋转位置编码原理"
      sub="看懂：位置怎么变成旋转，为什么只编码相对位置">
      <Sec n={1} title="问题：注意力对词序无感，得补位置信息">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>注意力只看两两之间的相关性，<b>打乱词序结果一样</b> —— 它不知道谁在前谁在后。所以必须额外把"每个词在第几位"喂进去。RoPE 的巧思：不靠"加"一个位置向量，而是<b>旋转</b>。</span></div>
      </Sec>

      <Sec n={2} title="招数：把一对维度当 2D 向量，按位置旋转">
        <div className="gd-graph">
          <svg viewBox="0 0 300 130" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <circle cx={C} cy={65} r={R} fill="none" stroke="var(--line)" strokeWidth="1" />
            <line x1={C - R - 5} y1={65} x2={C + R + 5} y2={65} stroke="var(--line-soft)" strokeWidth="1" />
            <line x1={C} y1={65 - R - 5} x2={C} y2={65 + R + 5} stroke="var(--line-soft)" strokeWidth="1" />
            {poss.map(p => {
              const a = p * th
              const x = C + Math.cos(a) * R, y = 65 - Math.sin(a) * R
              const cur = p === 2
              return <g key={p}>
                <line x1={C} y1={65} x2={x} y2={y} stroke={cur ? 'var(--now)' : 'var(--f-tag)'} strokeWidth={cur ? 2.2 : 1.3} opacity={cur ? 1 : 0.5} />
                <circle cx={x} cy={y} r={cur ? 4 : 2.6} fill={cur ? 'var(--now)' : 'var(--f-tag)'} opacity={cur ? 1 : 0.6} />
                <text x={x + (Math.cos(a) >= 0 ? 6 : -6)} y={y + (Math.sin(a) >= 0 ? -4 : 10)} fontSize="8.5"
                  textAnchor={Math.cos(a) >= 0 ? 'start' : 'end'} fill={cur ? 'var(--now)' : 'var(--faint)'}>p{p}</text>
              </g>
            })}
            {/* 说明 */}
            <text x="130" y="40" fontSize="11" fill="var(--ink)">每前进一个位置，</text>
            <text x="130" y="58" fontSize="11" fill="var(--ink)">向量就多转 θ 度。</text>
            <text x="130" y="82" fontSize="10.5" fill="var(--hit)">模长始终 = 1</text>
            <text x="130" y="98" fontSize="10.5" fill="var(--dim)">（旋转只改方向）</text>
          </svg>
        </div>
        <div className="gd-formula" style={{ fontSize: 13 }}>
          位置 p 的向量 = 原向量 <span className="fi">旋转 p·θ</span>　·　频率 <span className="ft">θᵢ = base<sup>−2i/d</sup></span>（每对维度不同）
        </div>
        <div className="gd-note">{Icn.info}<span>把相邻两维 (x₂ᵢ, x₂ᵢ₊₁) 看成平面向量，位置越靠后转得越多。旋转是<b>正交变换</b>：只改方向、<b>不改模长</b>。真实模型里每对维度用不同频率 —— 快的编精细位置、慢的编粗位置，像秒针和时针。</span></div>
      </Sec>

      <Sec n={3} title="妙处：点积只依赖相对位置 (m−n)">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>只看相对位置</h4><p>位置 m 的 query 和位置 n 的 key 旋转后点积，只依赖<em>夹角差 (m−n)·θ</em> —— 和绝对位置无关。模型天然懂"相隔多远"。</p></div>
          <div className="gd-card i"><h4>能外推长上下文</h4><p>因为只认相对距离，训练时没见过的<em>更长位置也能处理</em>。这是长上下文能力的地基之一。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>对比"加法"位置编码：加一个位置向量会改变原向量的大小、干扰语义，且难外推。RoPE 用旋转保住模长、把位置编进相位差 —— LLaMA、Qwen、DeepSeek 全用它。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '注意力对词序无感' }, { cls: 'pd', text: '每对维度看成 2D 向量' },
          { cls: 'pi', text: '按位置×θ 旋转（保模长）' }, { cls: 'pt', text: '点积只依赖相对角差' },
          { cls: 'ph', text: '懂相对距离 · 能外推长文' },
        ]}
        why={<><b>为什么 RoPE 成了长上下文的地基：</b>Transformer 要靠外挂的位置编码才知道词序，而位置编码怎么设计，直接决定模型能不能处理比训练更长的文本。RoPE 把位置变成旋转角，靠正交变换保住向量模长（不破坏语义幅度），又让注意力分数只依赖两个词的相对距离 —— 这两点让它既稳定又能自然外推。再配合"每对维度不同频率"，它能同时表达从相邻到极远的各种距离。正因如此，几乎所有现代开源大模型都用 RoPE，各种长上下文扩展（位置插值、NTK、YaRN）也都是在它的旋转频率上做文章。</>} />
    </Shell>
  )
}

// ═══════════════ Roofline 性能建模 ═══════════════
function RooflineDiagram() {
  //  小 roofline 示意（log-log）
  const W = 300, H = 150, mL = 34, mR = 10, mT = 10, mB = 26
  const pw = W - mL - mR, ph = H - mT - mB
  const aiMin = 0.5, aiMax = 512, pMin = 1, pMax = 400, ridge = 156, bw = 2, peak = 312
  const lx = (a: number) => mL + (Math.log10(a) - Math.log10(aiMin)) / (Math.log10(aiMax) - Math.log10(aiMin)) * pw
  const ly = (p: number) => mT + ph - (Math.log10(p) - Math.log10(pMin)) / (Math.log10(pMax) - Math.log10(pMin)) * ph
  const pts = [{ b: 1, ai: 1, at: 2 }, { b: 16, ai: 16, at: 32 }, { b: 128, ai: 120, at: 241 }]
  return (
    <Shell icon={Icn.chip} title="Roofline 性能建模原理"
      sub="看懂：为什么解码卡带宽、批处理为什么救得了它">
      <Sec n={1} title="两个上限：算力屋顶 + 带宽斜坡">
        <div className="gd-formula" style={{ fontSize: 13 }}>
          算术强度 <span className="ft">AI = FLOPs ÷ 字节</span>　·　脊点 = 峰值算力 ÷ 带宽　·　可达 = min(峰值, <span className="fi">AI·带宽</span>)
        </div>
        <div className="gd-graph">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {[1, 10, 100].map(t => <text key={t} x={lx(t)} y={H - 8} textAnchor="middle" fontSize="8" fill="var(--faint)" fontFamily="var(--mono)">{t}</text>)}
            {[1, 10, 100].map(t => <text key={t} x={mL - 4} y={ly(t) + 3} textAnchor="end" fontSize="8" fill="var(--faint)" fontFamily="var(--mono)">{t}</text>)}
            <polyline points={`${lx(aiMin)},${ly(aiMin * bw)} ${lx(ridge)},${ly(ridge * bw)}`} fill="none" stroke="var(--miss)" strokeWidth="2" />
            <polyline points={`${lx(ridge)},${ly(peak)} ${lx(aiMax)},${ly(peak)}`} fill="none" stroke="var(--hit)" strokeWidth="2" />
            <line x1={lx(ridge)} y1={mT} x2={lx(ridge)} y2={mT + ph} stroke="var(--now)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={lx(ridge)} y={mT + 8} textAnchor="middle" fontSize="8" fill="var(--now)">脊点 156</text>
            <text x={lx(3)} y={ly(1.4)} fontSize="8" fill="var(--miss)">卡带宽</text>
            <text x={lx(220)} y={ly(360)} fontSize="8" fill="var(--hit)">卡算力</text>
            {pts.map(p => <g key={p.b}><circle cx={lx(p.ai)} cy={ly(p.at)} r="3.4" fill="var(--f-tag)" /><text x={lx(p.ai)} y={ly(p.at) - 6} textAnchor="middle" fontSize="7.5" fill="var(--dim)">b{p.b}</text></g>)}
            <text x={mL + pw / 2} y={H - 0} textAnchor="middle" fontSize="7.5" fill="var(--dim)">算术强度 AI（log）</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>每个 kernel 在图上是一个点，横坐标是它的算术强度。点落在<b>红斜坡</b>下 = 被带宽卡住；爬到<b>绿平顶</b> = 被算力卡住。脊点是两者交界。</span></div>
      </Sec>

      <Sec n={2} title="大模型解码：AI≈1，死死卡在带宽最左边">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>解码是矩阵×向量：把<b>整个权重矩阵从显存读出来、每个权重只用一次</b>，算得少、搬得多，AI≈1。哪怕 GPU 有 312 TFLOP/s，实际只用到 <b>0.6%</b>（批 1）—— 算力大把闲着，就是喂不进数据。这就是"解码慢在搬权重、不在算"。</span></div>
      </Sec>

      <Sec n={3} title="所有优化的共同本质：把 AI 往右推">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>连续批处理</h4><p>把很多请求凑成大 batch，<em>同一份权重摊给更多请求算</em>，AI≈batch。批 128 时利用率升到 <em>77%</em>。</p></div>
          <div className="gd-card i"><h4>KV 缓存 / Flash</h4><p>少搬重复的 K/V、让中间矩阵<em>不落显存</em> —— 都是<em>减少字节、抬高 AI</em>，往算力屋顶靠。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>你之前学的 KV 缓存、连续批处理、FlashAttention，本质上<b>全是在抬高算术强度</b>，把点从带宽斜坡往算力屋顶推。Roofline 就是看懂它们为什么有用的那把尺子。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '算 FLOPs 和搬运字节' }, { cls: 'pd', text: 'AI = FLOPs/字节' },
          { cls: 'pi', text: '和脊点 P/B 比' }, { cls: 'pt', text: 'AI<脊点→卡带宽' },
          { cls: 'ph', text: '抬高 AI 往算力屋顶爬' },
        ]}
        why={<><b>为什么每个推理工程师都要会看 Roofline：</b>优化一个 kernel 前，先得知道它到底卡在算力还是带宽 —— 搞错方向，再多优化也白费。大模型推理的绝大多数环节（尤其解码）是带宽受限的，所以有效的优化几乎都在"减少数据搬运 / 提高数据复用"上做文章，而不是堆算力。Roofline 用一张图把工作负载和硬件上限放在一起，让你一眼看出瓶颈在哪、还有多少余量、某个优化能不能真的提速。它是连接前面所有具体机制（KV 缓存、批处理、FlashAttention、量化）的统一视角，也是推理性能工程的第一性原理。</>} />
    </Shell>
  )
}

// ═══════════════ RMSNorm 归一化 ═══════════════
function RmsNormDiagram() {
  const x = [2, -4, 1, 3]
  const rms = 2.739
  const out = x.map(v => Math.round((v / rms) * 100) / 100)
  return (
    <Shell icon={Icn.chip} title="RMSNorm 归一化原理"
      sub="看懂：每层为什么要归一化，RMSNorm 比 LayerNorm 省在哪">
      <Sec n={1} title="问题：几十层叠起来，数值会越滚越离谱">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>Transformer 是几十上百层叠出来的，每层都会改变数值大小。不管控的话信号越叠越大或越叠越小，梯度爆炸/消失、根本训不动。所以<b>每个子层前都先归一化</b>，把数值拉回统一尺度再往下走。</span></div>
      </Sec>

      <Sec n={2} title="做法：除以均方根 RMS，拉到单位尺度">
        <div className="gd-formula" style={{ fontSize: 13 }}>
          <span className="ft">RMS</span> = √( 各维平方的平均 )　·　<span className="fi">x̂ᵢ = xᵢ / RMS · gᵢ</span>
        </div>
        <div className="gd-graph">
          <svg viewBox="0 0 340 96" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="8" y="26" fontSize="10" fill="var(--faint)">x</text>
            <text x="8" y="76" fontSize="10" fill="var(--faint)">x / RMS</text>
            {x.map((v, k) => (
              <g key={k}>
                <rect x={40 + k * 74} y="12" width="60" height="24" rx="4" fill="var(--sunk-2)" stroke="var(--line)" strokeWidth="1" />
                <text x={70 + k * 74} y="29" textAnchor="middle" fontSize="12" fontFamily="var(--mono)" fill="var(--ink)">{v}</text>
                <line x1={70 + k * 74} y1="38" x2={70 + k * 74} y2="58" stroke="var(--now)" strokeWidth="1.2" markerEnd="url(#rnar)" />
                <rect x={40 + k * 74} y="62" width="60" height="24" rx="4" fill="color-mix(in srgb,var(--hit) 12%,var(--panel))" stroke="var(--hit)" strokeWidth="1" />
                <text x={70 + k * 74} y="79" textAnchor="middle" fontSize="12" fontFamily="var(--mono)" fill="var(--hit)">{out[k]}</text>
              </g>
            ))}
            <defs><marker id="rnar" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--now)" /></marker></defs>
            <text x="315" y="52" fontSize="10" fill="var(--now)">÷ {rms}</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>均方 = (4+16+1+9)/4 = 7.5，RMS = √7.5 ≈ {rms}。每维都除以它，新向量的<b>均方根恰好为 1</b> —— 尺度被拉齐。再乘可学习增益 g（每维一个）微调。</span></div>
      </Sec>

      <Sec n={3} title="比 LayerNorm 省：不减均值、不带偏置">
        <div className="gd-lane">
          <div className="gd-card i"><h4>LayerNorm</h4><p>先<em>减均值</em>、再除标准差，还带<em>缩放 + 偏置</em>两组参数。稳，但多一步、多一组参数。</p></div>
          <div className="gd-card hit"><h4>RMSNorm</h4><p><em>不减均值</em>，只除 RMS，只留一组增益、<em>没有偏置</em>。更省计算和参数，效果几乎一样 —— 主流大模型都换成它。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>RMSNorm 只统一"尺度"、不改"方向"（各维相对大小不变），却是几十上百层能稳定叠起来的幕后功臣。它和 softmax 里"除 √d 防饱和"一样，本质都是<b>管住数值量程</b>。LLaMA、Qwen、DeepSeek 全用它。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '本层输入向量 x' }, { cls: 'pd', text: '算均方 → RMS' },
          { cls: 'pi', text: '每维除以 RMS（拉到单位尺度）' }, { cls: 'pt', text: '乘可学习增益 g' },
          { cls: 'ph', text: '数值稳住，安全进下一层' },
        ]}
        why={<><b>为什么这一小步撑起了整个深网络：</b>没有归一化，深层网络的数值会在前向和反向里指数级放大或缩小，训练直接崩。归一化把每层输入拉回统一量程，让梯度稳定、学习率好调、层数能往上堆。RMSNorm 更进一步：发现"减均值"那步对效果帮助不大却要额外算，干脆去掉，只保留最有用的"除以尺度"，省下计算和参数。这种"砍掉不必要的、保留本质"的工程判断，正是现代大模型架构不断变简变快的缩影 —— 它不起眼，却出现在每一层、每一次前向里。</>} />
    </Shell>
  )
}

// ═══════════════ 完整前向拼装（收口） ═══════════════
function ForwardDiagram() {
  const block = [
    { s: 'RMSNorm', e: 'RMSNorm' },
    { s: '自注意力 Q·Kᵀ/√d→掩码→softmax→·V', e: '缩放点积+掩码 / 自注意力' },
    { s: '残差 +', e: '—' },
    { s: 'RMSNorm', e: 'RMSNorm' },
    { s: 'FFN relu(W₁x)·W₂', e: 'FFN / MoE' },
    { s: '残差 +', e: '—' },
  ]
  return (
    <Shell icon={Icn.chip} title="完整前向拼装原理"
      sub="看懂：学过的零件怎么拼成一次真实推理">
      <Sec n={1} title="一次推理 = 一条固定的链">
        <div className="gd-graph">
          <svg viewBox="0 0 360 88" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {['猫', '吃'].map((t, k) => <g key={k}>
              <rect x={10 + k * 30} y="34" width="26" height="22" rx="4" fill="var(--panel)" stroke="var(--line)" strokeWidth="1" />
              <text x={23 + k * 30} y="49" textAnchor="middle" fontSize="12" fill="var(--ink)">{t}</text>
            </g>)}
            <text x="35" y="72" textAnchor="middle" fontSize="8" fill="var(--faint)">输入</text>
            <line x1="72" y1="45" x2="98" y2="45" stroke="var(--line)" strokeWidth="1.2" markerEnd="url(#fwa)" />
            <rect x="100" y="30" width="150" height="30" rx="6" fill="color-mix(in srgb,var(--f-idx) 8%,var(--panel))" stroke="var(--f-idx)" strokeWidth="1.2" />
            <text x="175" y="43" textAnchor="middle" fontSize="10" fill="var(--ink)">Transformer 块</text>
            <text x="175" y="54" textAnchor="middle" fontSize="8" fill="var(--faint)">× 几十上百层</text>
            <line x1="252" y1="45" x2="278" y2="45" stroke="var(--line)" strokeWidth="1.2" markerEnd="url(#fwa)" />
            <rect x="280" y="30" width="46" height="30" rx="6" fill="color-mix(in srgb,var(--hit) 12%,var(--panel))" stroke="var(--hit)" strokeWidth="1.2" />
            <text x="303" y="43" textAnchor="middle" fontSize="11" fill="var(--ink)">鱼</text>
            <text x="303" y="54" textAnchor="middle" fontSize="7.5" fill="var(--hit)">下一词</text>
            <defs><marker id="fwa" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--line)" /></marker></defs>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>把「猫 吃」喂进去，经过嵌入 → 若干层 Transformer 块 → LM 头 → softmax，模型预测下一个词是「鱼」。每走一步 decode 就是跑一遍这条链、多吐一个字。</span></div>
      </Sec>

      <Sec n={2} title="一层 Transformer 块：你学过的零件按顺序上工">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {block.map((b, k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--faint)', width: 16 }}>{k + 1}</span>
              <span style={{ flex: 1, color: 'var(--ink)' }}>{b.s}</span>
              {b.e !== '—' && <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--f-idx)', whiteSpace: 'nowrap' }}>↳ {b.e}</span>}
            </div>
          ))}
        </div>
        <div className="gd-note">{Icn.info}<span>归一化稳住数值、注意力融入上下文、残差保住信息、FFN 做非线性变换 —— 每一段都是前面一个独立实验。叠很多层之后，末层归一化 → LM 头投影到词表 → <b>softmax + 采样</b>选出下一个 token（采样解码那屏）。</span></div>
      </Sec>

      <Sec n={3} title="所有优化，都在加速这条链、不改结果">
        <div className="gd-lane">
          <div className="gd-card i"><h4>算得对</h4><p>这条链<em>决定输出</em>：给定权重，预测哪个词是确定的。改任何一段的算法都会改结果。</p></div>
          <div className="gd-card hit"><h4>跑得快</h4><p>KV 缓存、FlashAttention、量化、连续批处理、投机解码 —— <em>全在加速这条链</em>，一个都不改它算出的结果。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>这就是把前面二十来个实验拼成一台机器的样子：<b>Transformer 原理那组决定"算什么"，大模型推理那组决定"怎么算得快"</b>。看懂这一屏，孤立的知识点就连成了一条真实的推理流水线。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '词嵌入' }, { cls: 'pd', text: 'RMSNorm→注意力→残差' },
          { cls: 'pi', text: 'RMSNorm→FFN→残差（×N 层）' }, { cls: 'pt', text: '末层 norm→LM 头→logits' },
          { cls: 'ph', text: 'softmax→采样→下一个 token' },
        ]}
        why={<><b>为什么这一屏是整条路的收口：</b>前面每个实验都在讲一个孤立的机制，容易学完就散。把它们按真实顺序串成一次前向，你会看到它们本就是同一条流水线上的工位 —— 缺一段，模型就吐不出下一个字。更重要的是它把两组实验的关系点透了：<b>「Transformer 原理」那组定义了这条链算什么（结果由它决定），「大模型推理」那组则想尽办法让这条链跑得更快</b>（KV 缓存、FlashAttention、量化、批处理、投机解码，全是加速、都不改结果）。这正是"从零到推理引擎工程师"这条路的核心命题：先懂这台机器怎么运转，再懂怎么让它跑得又快又省。</>} />
    </Shell>
  )
}

// ═══════════════ 矩阵乘法 ═══════════════
function MatmulDiagram() {
  const A=[[1,2,3],[4,5,6]], B=[[7,8],[9,10],[11,12]], C=[[58,64],[139,154]]
  return (
    <Shell icon={Icn.chip} title="矩阵乘法原理"
      sub="看懂：一行点一列，为什么它是一切网络的地基">
      <Sec n={1} title="规则：内维 K 对上，一行点一列">
        <div className="gd-formula" style={{ fontSize: 13 }}>
          <span className="ft">A[M×K]</span> · <span className="fi">B[K×N]</span> = C[M×N]　·　C[i][j] = <span className="ft">A 第 i 行</span> · <span className="fi">B 第 j 列</span>
        </div>
        <div className="gd-graph">
          <svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* B 右上 */}
            {B.map((row,k)=>row.map((v,j)=>(
              <g key={`b${k}${j}`}><rect x={180+j*34} y={6+k*26} width="30" height="22" rx="3" fill={j===0?'color-mix(in srgb,var(--f-tag) 22%,var(--panel))':'color-mix(in srgb,var(--f-tag) 8%,var(--panel))'} stroke="var(--f-tag)" strokeWidth={j===0?1.4:0.8}/><text x={195+j*34} y={21+k*26} textAnchor="middle" fontSize="11" fontFamily="var(--mono)" fill="var(--ink)">{v}</text></g>
            )))}
            <text x="212" y="98" textAnchor="middle" fontSize="8" fill="var(--f-tag)">B[3×2]</text>
            {/* A 左下 */}
            {A.map((row,i)=>row.map((v,k)=>(
              <g key={`a${i}${k}`}><rect x={6+k*34} y={100+i*26} width="30" height="22" rx="3" fill={i===0?'color-mix(in srgb,var(--f-idx) 22%,var(--panel))':'color-mix(in srgb,var(--f-idx) 8%,var(--panel))'} stroke="var(--f-idx)" strokeWidth={i===0?1.4:0.8}/><text x={21+k*34} y={115+i*26} textAnchor="middle" fontSize="11" fontFamily="var(--mono)" fill="var(--ink)">{v}</text></g>
            )))}
            <text x="55" y="150" textAnchor="middle" fontSize="8" fill="var(--f-idx)">A[2×3]</text>
            {/* C 右下 */}
            {C.map((row,i)=>row.map((v,j)=>(
              <g key={`c${i}${j}`}><rect x={180+j*34} y={100+i*26} width="30" height="22" rx="3" fill={i===0&&j===0?'color-mix(in srgb,var(--now) 20%,var(--panel))':'var(--sunk-2)'} stroke={i===0&&j===0?'var(--now)':'var(--line-soft)'} strokeWidth={i===0&&j===0?1.6:1}/><text x={195+j*34} y={115+i*26} textAnchor="middle" fontSize="11" fontFamily="var(--mono)" fill={i===0&&j===0?'var(--now)':'var(--ink)'} fontWeight="700">{v}</text></g>
            )))}
            <text x="212" y="150" textAnchor="middle" fontSize="8" fill="var(--now)">C=A·B[2×2]</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>A 的第 0 行（蓝）点 B 的第 0 列（紫）落到 C[0][0]（琥珀）：<b>1×7 + 2×9 + 3×11 = 58</b>。每个输出格都是这样一行点一列。内维 K=3 必须对上，否则不能乘。</span></div>
      </Sec>

      <Sec n={2} title="算多少：2·M·N·K 次浮点">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>每格 K 次乘 + K 次加 = 2K，共 M×N 个格 → <b>2·M·N·K</b> 次浮点运算（这里 2·2·2·3=24）。这个数是估算模型算力、显存带宽（<b>Roofline</b>）的起点 —— 大模型慢不慢，先看它要乘多少、搬多少。</span></div>
      </Sec>

      <Sec n={3} title="为什么是地基：高级机制都在切这个乘法">
        <div className="gd-lane">
          <div className="gd-card i"><h4>FlashAttention</h4><p>把注意力里的大矩阵乘<em>切成小块</em>塞进 SRAM（分块 tiling），少搬数据、不改结果。</p></div>
          <div className="gd-card i"><h4>张量并行</h4><p>把一个大矩阵<em>按行/列切</em>到多张 GPU 分头算、再拼回来。切的还是这个乘法。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>神经网络几乎每步都是矩阵乘：注意力 Q·Kᵀ、FFN 的 W·x、LM 头投影。你学过的高级优化，本质都是<b>换个顺序/切法算同一个乘法</b>。看懂它怎么算、算多少，才看得懂它们在优化什么。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'A[M×K] · B[K×N]' }, { cls: 'pd', text: '内维 K 对上' },
          { cls: 'pi', text: '每格 = 一行点一列' }, { cls: 'pt', text: '共 2·M·N·K 次浮点' },
          { cls: 'ph', text: '注意力/FFN/并行都坐在它上面' },
        ]}
        why={<><b>为什么值得从最朴素的矩阵乘讲起：</b>整个深度学习的算力几乎都花在矩阵乘上，GPU 本质就是矩阵乘加速器。理解"一行点一列"和"2MNK 次浮点"这两件事，你就有了一把尺子：能估任意一层要多少计算、多少访存，能看懂 Roofline 上一个 kernel 卡在哪，也能看懂 FlashAttention 的分块、张量并行的切分到底在动什么——它们从不改变这个乘法的结果，只改变它在存储层次和多卡之间怎么流动。矩阵乘是从参数量、到注意力、到所有推理优化的共同地基，朴实却贯穿始终。</>} />
    </Shell>
  )
}

// ═══════════════ 张量并行 ═══════════════
function TensorParDiagram() {
  const cols=[0,1,2,3]  // W 的 4 列，2 卡各拿 2 列
  const owner=(j: number)=> j<2?0:1
  const GC=['var(--f-idx)','var(--f-tag)']
  const Y=[7,5,4,8]
  return (
    <Shell icon={Icn.chip} title="张量并行原理"
      sub="看懂：矩阵乘怎么切到多卡、为什么结果不变">
      <Sec n={1} title="问题：一个矩阵乘大到单卡放不下">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>大模型某一层的 Y = X·W，W 可能几万×几万，单张 GPU 既<b>装不下</b>也<b>算不快</b>。张量并行的办法：把这个矩阵乘<b>切到多张卡</b>上分头算，再拼回来。它直接坐在「矩阵乘法」上。</span></div>
      </Sec>

      <Sec n={2} title="列并行：W 按列切给各卡，各算一段 Y">
        <div className="gd-graph">
          <svg viewBox="0 0 340 118" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="20" y="20" fontSize="10" fill="var(--faint)">X</text>
            <rect x="10" y="26" width="26" height="60" rx="4" fill="var(--sunk-2)" stroke="var(--line)" strokeWidth="1"/>
            <text x="23" y="60" textAnchor="middle" fontSize="10" fill="var(--dim)">1×K</text>
            <text x="60" y="20" fontSize="10" fill="var(--faint)">W（按列分卡）</text>
            {cols.map(j=>(
              <g key={j}><rect x={60+j*30} y="26" width="26" height="60" rx="4" fill={`color-mix(in srgb, ${GC[owner(j)]} 14%, var(--panel))`} stroke={GC[owner(j)]} strokeWidth="1.4"/>
              <text x={73+j*30} y="60" textAnchor="middle" fontSize="9" fontFamily="var(--mono)" fill={GC[owner(j)]}>c{j}</text></g>
            ))}
            <text x="90" y="102" textAnchor="middle" fontSize="8.5" fill={GC[0]}>GPU0：列 0,1</text>
            <text x="150" y="112" textAnchor="middle" fontSize="8.5" fill={GC[1]}>GPU1：列 2,3</text>
            {/* Y 片 */}
            <text x="215" y="20" fontSize="10" fill="var(--faint)">Y 片 → all-gather</text>
            {Y.map((v,j)=>(
              <g key={j}><rect x={210+j*30} y="26" width="26" height="26" rx="4" fill={`color-mix(in srgb, ${GC[owner(j)]} 14%, var(--panel))`} stroke={GC[owner(j)]} strokeWidth="1.2"/>
              <text x={223+j*30} y="43" textAnchor="middle" fontSize="11" fontFamily="var(--mono)" fill={GC[owner(j)]} fontWeight="700">{v}</text></g>
            ))}
            <text x="270" y="72" textAnchor="middle" fontSize="9" fill="var(--ink)">拼成完整 Y = [7,5,4,8]</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>W 按列切成 G 份，GPU0 拿前一半列、GPU1 拿后一半，各自算出 Y 的对应片（Y_g = X·W_g）。每卡<b>只存 1/G 的 W、只算 1/G 的乘法</b>；最后 <b>all-gather</b> 把各片拼成完整 Y。</span></div>
      </Sec>

      <Sec n={3} title="为什么结果不变：只是把列分开算">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>拼接 == 单卡</h4><p>[7,5] + [4,8] = [7,5,4,8]，和不切时<em>分毫不差</em>。列并行切的是<em>计算的分配</em>，不是结果（和 FlashAttention 分块同理）。</p></div>
          <div className="gd-card i"><h4>省下 1/G</h4><p>每卡显存、算力都降到 <em>1/G</em>，本来单卡扛不住的现在 G 张分摊。代价是一次 <em>all-gather 跨卡通信</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>因为它坐在矩阵乘"一行点一列、按列可分"的性质上，切列不影响每一格怎么算。所以张量并行能把大到单卡放不下的层<b>拆到多卡跑、结果还完全一致</b> —— 这是把大模型放上多卡的基本手段。卡越多通信越频繁，所以通常在一台机器的几张卡间用（卡间带宽高）。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'Y=X·W 单卡放不下' }, { cls: 'pd', text: 'W 按列切成 G 份' },
          { cls: 'pi', text: '每卡算一段 Y（只存/算 1/G）' }, { cls: 'pt', text: 'all-gather 拼回完整 Y' },
          { cls: 'ph', text: '== 单卡结果，代价是跨卡通信' },
        ]}
        why={<><b>为什么张量并行是大模型上多卡的地基手段：</b>当单层的权重或激活大到一张 GPU 放不下，你没别的办法，只能把这一个矩阵乘拆开。张量并行利用矩阵乘"按行/列可分"的性质，把权重切片分到多卡，让每卡只承担一部分显存和计算，再用集合通信把结果合起来——数学上和单卡整算等价，纯粹是把一个大乘法摊到多张卡。它和流水线并行、数据并行一起构成了大模型分布式训练/推理的三大切法，而这一切都建立在"矩阵乘怎么算、怎么切"之上。看懂了矩阵乘这块地基，才看得懂这些并行策略在切什么、为什么不改结果。</>} />
    </Shell>
  )
}

// ═══════════════ 集合通信 All-Reduce ═══════════════
function CollectiveDiagram() {
  //  4 卡排成环
  const G = 4, R = 40, C = 72
  const pos = (g: number) => { const a = -Math.PI/2 + g*2*Math.PI/G; return [C + Math.cos(a)*R, C + Math.sin(a)*R] }
  return (
    <Shell icon={Icn.chip} title="集合通信 All-Reduce 原理"
      sub="看懂：多卡怎么高效地求和、还人人拿到">
      <Sec n={1} title="问题：各卡各算一半，要求和 + 人人都拿到">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>多卡并行（张量并行、或训练求梯度）算完后，常要把各卡的一份<b>求和、并让每张卡都拿到同一结果</b> —— 这叫 all-reduce。朴素做法人人给人人发，<b>G² 条消息</b>，卡多带宽炸。</span></div>
      </Sec>

      <Sec n={2} title="环形 all-reduce：排成环，每步只发一个块">
        <div className="gd-graph">
          <svg viewBox="0 0 300 130" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 环 */}
            {Array.from({length:G},(_, g)=>{
              const [x,y]=pos(g); const [nx,ny]=pos((g+1)%G)
              return <line key={`e${g}`} x1={x} y1={y} x2={nx} y2={ny} stroke="var(--f-idx)" strokeWidth="1.4" opacity="0.6" markerEnd="url(#coar)"/>
            })}
            {Array.from({length:G},(_, g)=>{ const [x,y]=pos(g)
              return <g key={g}><circle cx={x} cy={y} r="13" fill="color-mix(in srgb,var(--now) 14%,var(--panel))" stroke="var(--now)" strokeWidth="1.4"/><text x={x} y={y+4} textAnchor="middle" fontSize="10" fill="var(--ink)">G{g}</text></g>
            })}
            <defs><marker id="coar" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--f-idx)"/></marker></defs>
            <text x="180" y="40" fontSize="11" fill="var(--ink)">① reduce-scatter</text>
            <text x="180" y="56" fontSize="9.5" fill="var(--dim)">发块 + 累加 · G−1 步</text>
            <text x="180" y="80" fontSize="11" fill="var(--ink)">② all-gather</text>
            <text x="180" y="96" fontSize="9.5" fill="var(--dim)">广播已求和块 · G−1 步</text>
          </svg>
        </div>
        <div className="gd-formula" style={{ fontSize: 13 }}>
          共 <span className="ft">2·(G−1)</span> 步　·　每步每卡<span className="fi">只收发一个块</span>　·　带宽与卡数无关
        </div>
        <div className="gd-note">{Icn.info}<span><b>reduce-scatter</b>：每步各卡把一个块发给下一张、对方累加，G−1 步后每卡各「拥有」某块的完整和。<b>all-gather</b>：再把这些块沿环传一圈，G−1 步后人人集齐 = 完整总和。</span></div>
      </Sec>

      <Sec n={3} title="为什么它是分布式的地基">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>带宽最优</h4><p>每步每卡只收发一个块，总通信量和卡数无关。比人人对发的 <em>G² 消息</em>省一个量级，卡越多优势越大。</p></div>
          <div className="gd-card i"><h4>接上张量并行</h4><p>张量并行各卡算完一片、拼结果用的 <em>all-gather</em>，正是环形 all-reduce 的后半段。同一套通信原语。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>all-reduce / all-gather / reduce-scatter 这几个<b>集合通信原语</b>，是大模型分布式训练与推理的通信地基 —— 梯度对齐、张量并行拼结果、专家并行分发，底下都是它们。看懂环形 all-reduce，就看懂了多卡之间「怎么高效地把数据合起来」。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '各卡各持一份' }, { cls: 'pd', text: 'reduce-scatter：发块+累加' },
          { cls: 'pi', text: '每卡各拥有一个完整块' }, { cls: 'pt', text: 'all-gather：沿环广播' },
          { cls: 'ph', text: '人人拿到总和 · 2(G−1) 步' },
        ]}
        why={<><b>为什么集合通信决定多卡能不能扩展：</b>大模型一旦上多卡，卡与卡之间就要不停地把数据合起来（求梯度和、拼张量并行的结果、分发专家）。如果用最朴素的人人对发，通信量随卡数平方增长，几十上百张卡时通信直接压垮计算。环形 all-reduce 把它降到与卡数无关的带宽最优，是分布式训练/推理能扩展到成百上千卡的前提。它和张量并行、流水线并行一起，构成大模型分布式的三根支柱，而这一切又都建立在"把矩阵乘切开、再把结果合起来"之上——这就是为什么这条路要从矩阵乘一路讲到集合通信。</>} />
    </Shell>
  )
}

// ═══════════════ 张量布局 ═══════════════
function LayoutDiagram() {
  const A=[[1,2,3],[4,5,6]]
  const rowMem=[[0,0,1],[0,1,2],[0,2,3],[1,0,4],[1,1,5],[1,2,6]]  // [i,j,v] row-major
  const colMem=[[0,0,1],[1,0,4],[0,1,2],[1,1,5],[0,2,3],[1,2,6]]  // col-major
  const strip=(mem: number[][], byRow: boolean)=> (
    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
      {mem.map(([i,j,v],k)=>(
        <div key={k} style={{minWidth:40,textAlign:'center',fontFamily:'var(--mono)',fontSize:13,fontWeight:700,
          border:'1px solid var(--line-soft)',borderRadius:4,padding:'4px 0',
          background:`color-mix(in srgb, ${byRow?'var(--f-idx)':'var(--f-tag)'} ${12+(byRow?i:j)*22}%, var(--panel))`,color:'var(--ink)'}}>
          {v}<span style={{display:'block',fontSize:7,color:'var(--faint)'}}>[{i},{j}]</span></div>
      ))}
    </div>
  )
  return (
    <Shell icon={Icn.chip} title="张量布局原理"
      sub="看懂：二维矩阵摊进一维内存，排法决定快慢">
      <Sec n={1} title="二维矩阵，一维内存 —— 得选个摊法">
        <div className="gd-formula" style={{ fontSize: 13 }}>
          <span className="ft">row-major</span>：地址 = i·cols+j　·　<span className="fi">col-major</span>：地址 = j·rows+i
        </div>
        <div className="gd-note">{Icn.info}<span>内存是一条直线，二维矩阵摊平只有两种基本排法：<b>行主序</b>（一行连续）或<b>列主序</b>（一列连续）。同一个矩阵、同样的数，内存里的顺序完全不同。</span></div>
      </Sec>

      <Sec n={2} title="同一个矩阵 A[2×3]，两种内存顺序">
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div><div style={{fontSize:11,color:'var(--dim)',marginBottom:4}}>row-major（按行连续，同色=同一行）</div>{strip(rowMem,true)}</div>
          <div><div style={{fontSize:11,color:'var(--dim)',marginBottom:4}}>col-major（按列连续，同色=同一列）</div>{strip(colMem,false)}</div>
        </div>
        <div className="gd-note">{Icn.info}<span>row-major = [1,2,3,4,5,6]（第 0 行 1,2,3 连续），col-major = [1,4,2,5,3,6]（第 0 列 1,4 连续）。值一样，<b>排列顺序不一样</b>。</span></div>
      </Sec>

      <Sec n={3} title="谁连续谁快：访存步长">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>连续 = 快</h4><p>CPU/GPU 一次从内存读一整条 <em>cache 行</em>。顺着连续方向走（步长 1），一次读一片、命中率高。</p></div>
          <div className="gd-card i"><h4>跳着 = 慢</h4><p>row-major 里扫一行步长 1（快）、扫一列步长 cols（跳着、慢）；col-major 反过来。跳着访问每次都要重取。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>所以矩阵乘、转置、reshape <b>都要看布局</b>：同一个乘法，访存顺序对不对布局，速度能差很多倍。这就是「矩阵乘法」地基的另一半，也是 FlashAttention 分块、cache 分块为什么死盯"连续"的原因。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '二维矩阵 [i][j]' }, { cls: 'pd', text: '摊进一维内存' },
          { cls: 'pi', text: 'row-major 行连续 / col-major 列连续' }, { cls: 'pt', text: '连续方向步长 1' },
          { cls: 'ph', text: '顺连续访问 = 快（踩 cache 行）' },
        ]}
        why={<><b>为什么布局是性能的隐形开关：</b>算法写出来是二维的下标 [i][j]，但硬件看到的是一维地址和 cache 行。布局决定了"逻辑上相邻"的元素在物理内存里是不是也相邻 —— 而访存是不是连续，直接决定 cache 命中率，进而决定一个矩阵乘/转置到底跑多快。同一段代码，数据布局对不对，性能能差几倍。这也是为什么高性能库要区分 row/col-major、深度学习框架要处理 contiguous/stride、FlashAttention 要精心安排分块的读写顺序——它们都在让访问尽量连续。矩阵乘讲"算什么"，布局讲"数据怎么摆才不浪费带宽"，两者合起来才是真正的计算地基。</>} />
    </Shell>
  )
}

// ═══════════════ Chunked Prefill ═══════════════
function ChunkPrefillDiagram() {
  const bar=(segs: {c:string;w:number;t:string}[], mark?: number)=> (
    <div style={{position:'relative'}}>
      <div style={{display:'flex',gap:2,height:30,border:'1px solid var(--line-soft)',borderRadius:5,padding:2,background:'var(--sunk-2)'}}>
        {segs.map((sg,k)=><div key={k} style={{flex:sg.w,background:sg.c,borderRadius:3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#fff'}}>{sg.t}</div>)}
      </div>
      {mark!==undefined && <div style={{position:'absolute',top:-4,left:`${mark}%`,fontSize:9,color:'var(--now)'}}>▼ B 首字 t={mark===25?3:9}</div>}
    </div>
  )
  const P='var(--f-idx)', D='var(--hit)'
  return (
    <Shell icon={Icn.chip} title="Chunked Prefill 原理"
      sub="看懂：长 prompt 为什么卡住别人，切块怎么解">
      <Sec n={1} title="问题：一个长 prefill 挡住所有人">
        <div style={{marginBottom:8}}>{bar([{c:P,w:8,t:'A prefill (8)'},{c:D,w:1,t:'D'},{c:D,w:1,t:'D'},{c:D,w:1,t:'D'},{c:D,w:1,t:'D'}], 66.7)}</div>
        <div className="gd-note" style={{marginTop:0}}>{Icn.info}<span>prefill（算整段 KV）耗时长、decode（吐一个字）很短。长 prefill 一整块跑，正在解码的 B <b>只能干等</b>到它全完，首字要等到 <b>t=9</b>。</span></div>
      </Sec>

      <Sec n={2} title="招数：切块，块之间插进别人的 decode">
        <div style={{marginBottom:8}}>{bar([{c:P,w:2,t:'P2'},{c:D,w:1,t:'D'},{c:P,w:2,t:'P2'},{c:D,w:1,t:'D'},{c:P,w:2,t:'P2'},{c:D,w:1,t:'D'},{c:P,w:2,t:'P2'},{c:D,w:1,t:'D'}], 25)}</div>
        <div className="gd-formula" style={{fontSize:13}}>总时间 <span className="ft">不变</span>（都是 12）　·　B 首字 <span className="fi">9 → 3</span></div>
        <div className="gd-note">{Icn.info}<span>把长 prefill 切成大小 2 的块，块与块之间插一个 B 的 decode。B 在 <b>t=3</b> 就吐出首字，而总时间还是 12 —— 只是把同样的活<b>重新排了个序</b>。</span></div>
      </Sec>

      <Sec n={3} title="本质：进程调度的时间片思想">
        <div className="gd-note" style={{marginTop:0}}>{Icn.info}<span>这就是操作系统<b>让长任务不饿死短任务</b>的老办法：把大颗粒拆细、交错着轮流跑。块越小、别人等得越短（延迟越公平），但太碎有调度开销 —— 块大小是权衡。真实系统还常配 PD 分离（prefill/decode 分不同资源）。它坐在你学过的<b>进程调度</b>上。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '长 prompt 的 prefill 很久' }, { cls: 'pd', text: '整块跑 → 别人干等' },
          { cls: 'pi', text: '切成小块' }, { cls: 'pt', text: '块之间插别人的 decode' },
          { cls: 'ph', text: '首字延迟大降，总时间不变' },
        ]}
        why={<><b>为什么 chunked prefill 是延迟公平的关键：</b>线上服务里请求长短悬殊，一个几千 token 的长 prompt 如果霸占 GPU 把 prefill 一口气跑完，其它正在逐字输出的用户就会明显卡顿。chunked prefill 把长 prefill 切碎、和 decode 交错，让每个请求都能"雨露均沾"地拿到时间片，首字延迟和尾延迟都更稳，而吞吐几乎不受影响。它和连续批处理、PD 分离一起，是现代推理引擎把"高吞吐"和"低延迟"两个矛盾目标同时抓住的调度手段，底层思想正是操作系统调度器几十年前就有的时间片轮转。</>} />
    </Shell>
  )
}

// ═══════════════ KV 换出 offload ═══════════════
function KvOffloadDiagram() {
  return (
    <Shell icon={Icn.chip} title="KV 换出 offload 原理"
      sub="看懂：显存装不下 KV 时，怎么换到 CPU 续命">
      <Sec n={1} title="问题：KV 缓存把 GPU 显存撑爆">
        <div className="gd-note" style={{marginTop:0}}>{Icn.info}<span>KV 缓存随<b>序列长 × 并发数</b>线性涨（见「KV 缓存」）。高并发、长上下文时，所有请求的 KV 块<b>一张 GPU 装不下</b>。总不能一满就拒绝服务。</span></div>
      </Sec>

      <Sec n={2} title="招数：换出到 CPU、要用再换回（页面置换）">
        <div className="gd-graph">
          <svg viewBox="0 0 340 96" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <rect x="10" y="14" width="150" height="68" rx="7" fill="color-mix(in srgb,var(--hit) 8%,var(--panel))" stroke="var(--hit)" strokeWidth="1.2"/>
            <text x="85" y="30" textAnchor="middle" fontSize="11" fill="var(--ink)">GPU 显存（快·小）</text>
            {[0,1,2].map(k=><g key={k}><rect x={22+k*44} y="42" width="36" height="28" rx="4" fill="var(--panel)" stroke="var(--hit)" strokeWidth="1"/><text x={40+k*44} y="60" textAnchor="middle" fontSize="12" fontFamily="var(--mono)" fill="var(--ink)">{[3,1,4][k]}</text></g>)}
            <rect x="200" y="14" width="130" height="68" rx="7" fill="color-mix(in srgb,var(--miss) 8%,var(--panel))" stroke="var(--miss)" strokeWidth="1.2"/>
            <text x="265" y="30" textAnchor="middle" fontSize="11" fill="var(--ink)">CPU 内存（慢·大）</text>
            {[0,2].map((v,k)=><g key={k}><rect x={215+k*44} y="42" width="36" height="28" rx="4" fill="var(--panel)" stroke="var(--miss)" strokeWidth="1"/><text x={233+k*44} y="60" textAnchor="middle" fontSize="12" fontFamily="var(--mono)" fill="var(--ink)">{[0,2][k]}</text></g>)}
            <path d="M162 48 h36" stroke="var(--miss)" strokeWidth="1.4" markerEnd="url(#koa1)"/><text x="180" y="42" textAnchor="middle" fontSize="8" fill="var(--miss)">换出</text>
            <path d="M198 66 h-36" stroke="var(--now)" strokeWidth="1.4" markerEnd="url(#koa2)"/><text x="180" y="80" textAnchor="middle" fontSize="8" fill="var(--now)">换入</text>
            <defs><marker id="koa1" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--miss)"/></marker><marker id="koa2" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--now)"/></marker></defs>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>访问某块：在 GPU 上 → 命中；不在且 GPU 满 → 按 <b>LRU</b>（最久没用的先走）把一个块<b>换出到 CPU</b>，再把要的块<b>换入 GPU</b>。这和操作系统「内存不够把页换到磁盘」的<b>页面置换</b>一模一样。</span></div>
      </Sec>

      <Sec n={3} title="权衡：续命 vs PCIe 拷贝">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>显存不够也能服务</h4><p>装不下就把冷块<em>挪到 CPU</em>，能撑更多、更长的请求，不至于一满就拒绝。</p></div>
          <div className="gd-card i"><h4>代价是搬运</h4><p>换出换入走 <em>PCIe 拷贝</em>，比在显存里慢。槽越多来回搬越少（本例 3 槽换出 4 次、4 槽只 2 次）；真实系统还会<em>异步预取</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它是「KV 缓存吃显存」的一个出口，和 PagedAttention（省碎片）、GQA（减 KV 头）、量化（压字节）并列。而底层就是你早学过的<b>页面置换 / 换入换出</b> —— 看懂页面置换，就看懂了 KV offload。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'KV 块比 GPU 槽多' }, { cls: 'pd', text: '访问：在 GPU→命中' },
          { cls: 'pi', text: '满了→LRU 换出到 CPU' }, { cls: 'pt', text: '要用的块换入 GPU' },
          { cls: 'ph', text: '显存续命，代价 PCIe 拷贝' },
        ]}
        why={<><b>为什么 KV offload 让长上下文/高并发成为可能：</b>大模型服务的显存几乎全被权重和 KV 缓存吃掉，而 KV 随上下文和并发涨，很快就超出单卡显存。KV offload 借操作系统的老智慧——把不常用的数据挪到更大更慢的一层，需要时再取回——让 GPU 显存像"工作集"一样只放热的 KV，冷的先去 CPU。这样同样一张卡能服务更长的上下文、更多的并发请求。代价是换入换出的带宽，所以要配合好的置换策略和预取。它和 PagedAttention、GQA、量化一样，都是在和"KV 缓存吃显存"这个核心矛盾搏斗，而它的底子，正是这条路一开始就讲的页面置换。</>} />
    </Shell>
  )
}

function EngineDiagram() {
  return (
    <Shell icon={Icn.chip} title="推理引擎主循环"
      sub="看懂：调度器 + 块池 + prefill/decode 怎么串成连续批处理">
      <Sec n={1} title="问题：请求随时来、算完随时走">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>前面每个实验是<b>单个算子</b>；真实服务里请求<b>不断进来、各自长短不一</b>。KV 显存有限，得有个东西<b>决定谁上、谁等、谁的位子腾出来</b>——那就是引擎的调度主循环。</span></div>
      </Sec>

      <Sec n={2} title="主循环：回收 → 调度 → 执行 → 前进">
        <div className="gd-graph">
          <svg viewBox="0 0 360 98" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {[['①回收', 'var(--miss)'], ['②调度', 'var(--now)'], ['③执行', 'var(--hit)'], ['④前进', 'var(--f-tag)']].map(([t, c], k) => (
              <g key={k}>
                <rect x={8 + k * 88} y="22" width="76" height="34" rx="7" fill={`color-mix(in srgb,${c} 8%,var(--panel))`} stroke={c as string} strokeWidth="1.2" />
                <text x={8 + k * 88 + 38} y="43" textAnchor="middle" fontSize="12" fill="var(--ink)">{t}</text>
                {k < 3 && <path d={`M${8 + k * 88 + 76} 39 h12`} stroke="var(--dim)" strokeWidth="1.4" markerEnd="url(#eng-a)" />}
              </g>
            ))}
            <path d="M338 56 q10 26 -160 26 q-170 0 -160 -26" fill="none" stroke="var(--dim)" strokeWidth="1.3" strokeDasharray="4 3" markerEnd="url(#eng-a)" />
            <text x="180" y="94" textAnchor="middle" fontSize="9" fill="var(--faint)">循环，直到全部完成</text>
            <defs><marker id="eng-a" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--dim)" /></marker></defs>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>每转一圈：①<b>回收</b>生成够了的请求、<b>归还它的 KV 块</b>；②按 FCFS <b>准入</b>等待队列里放得下的（空闲块够才上，遇到第一个放不下就停，队头阻塞）；③新准入的做 <b>prefill</b>（一次吃完 prompt），在跑的做 <b>decode</b>（吐 1 个 token）；④前进。块池<b>守恒</b>：空闲 + 在跑占用 = 总块数，恒成立。</span></div>
      </Sec>

      <Sec n={3} title="连续批处理 vs 静态批">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>连续批处理</h4><p>算完的请求<em>立刻</em>把块和位子让给等待的——批次每步都在变。短请求不被长的拖着空转，吞吐高。</p></div>
          <div className="gd-card i"><h4>静态批</h4><p>要<em>等整批全跑完</em>才换下一批。批里最长的没结束，其它位子就空着——利用率低。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>这台引擎把你学过的<b>进程调度</b>（每步一次调度）、<b>分页 / 块池</b>（KV 按块分配、准入看空闲）、<b>KV 缓存</b>串成一个系统。vLLM / TGI 的核心就是这个循环。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '请求各自长短不一' }, { cls: 'pd', text: '回收完成的→归还块' },
          { cls: 'pi', text: 'FCFS 准入放得下的' }, { cls: 'pt', text: 'prefill 新 / decode 在跑' },
          { cls: 'ph', text: '连续批处理，吞吐高' },
        ]}
        why={<><b>为什么"引擎"比"算子"更进一层：</b>把注意力、KV 缓存、量化这些算子做出来，只是有了零件；真正的推理引擎是让这些零件在一个<b>连续批处理</b>的主循环里协同——请求随时来、算完随时走，KV 显存按块池动态分配、准入靠调度器把关。它一头连着你早学的进程调度和分页，一头连着 vLLM/TGI 这些真实系统。看懂这个循环，就看懂了"大模型是怎么被高效地服务起来的"——而这正是从 408 地基通到大模型推理的最后一段路。</>} />
    </Shell>
  )
}

function ScaleDiagram() {
  const soft = [0.44, 0.27, 0.16, 0.13], hard = [0.98, 0.015, 0.004, 0.001]
  const bars = (ps: number[], x0: number, c: string) => ps.map((p, k) => (
    <rect key={k} x={x0 + k * 16} y={64 - p * 44} width="12" height={p * 44} rx="2" fill={c} />
  ))
  return (
    <Shell icon={Icn.ruler} title="√d 缩放原理"
      sub="看懂：为什么注意力分数要除以 √d_k">
      <Sec n={1} title="根源：Q·K 是 d 个乘积之和，方差随 d 涨">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>Q、K 每一维独立、均值 0、方差 1。点积 Q·K = 把 d 个乘积<b>加起来</b>，每项方差 1、独立 → <b>Var(Q·K) = d</b>（方差可加，就是大数定理那套 i.i.d. 累加）。所以 logit 的标准差 ~ <b>√d</b>。</span></div>
      </Sec>

      <Sec n={2} title="后果：不缩放，softmax 会塌成 one-hot">
        <div className="gd-graph">
          <svg viewBox="0 0 300 84" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="45" y="12" textAnchor="middle" fontSize="10" fill="var(--hit)">d 小 → 软</text>
            {bars(soft, 20, 'var(--hit)')}
            <line x1="16" y1="64" x2="90" y2="64" stroke="var(--line)" />
            <text x="230" y="12" textAnchor="middle" fontSize="10" fill="var(--miss)">d 大 → 一头独大</text>
            {bars(hard, 205, 'var(--miss)')}
            <line x1="201" y1="64" x2="275" y2="64" stroke="var(--line)" />
            <text x="148" y="44" textAnchor="middle" fontSize="16" fill="var(--faint)">→</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>d 一大，最相关那个 key 的分数被放大 √d 倍、把别人甩开，softmax 变成<b>近似 one-hot</b>（熵→0）。此时梯度也几乎为 0——<b>softmax 饱和、梯度消失，训不动</b>。</span></div>
      </Sec>

      <Sec n={3} title="解法：除以 √d_k，把方差拉回 1">
        <div className="gd-lane">
          <div className="gd-card i"><h4>不缩放</h4><p>logit 标准差 <em>√d</em>，d 越大越尖，softmax 塌成 one-hot、梯度消失。</p></div>
          <div className="gd-card hit"><h4>÷√d_k</h4><p>标准差回 <em>1</em>，softmax 恒定"软"、梯度健康——与维度无关。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>这就是《Attention Is All You Need》里 “scale the dot products by 1/√d_k” 的原因。不是玄学，是"d 个 i.i.d. 项相加、方差累加=d"的必然，一条<b>大数定理</b>。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'Q·K = d 项相加' }, { cls: 'pd', text: '方差累加 = d' },
          { cls: 'pi', text: '标准差 √d，d 大就尖' }, { cls: 'pt', text: '不缩放→softmax 饱和' },
          { cls: 'ph', text: '÷√d 拉回方差 1，恢复软' },
        ]}
        why={<><b>为什么这条小小的 1/√d_k 至关重要：</b>它是把统计学的常识用在了注意力的心脏上。点积是许多独立项之和，方差随维度线性增长——这是最基本的方差可加性。若不缩放，高维下 softmax 的输入会大到让它饱和，输出近似 one-hot，此时 softmax 的雅可比几乎为零、梯度消失，网络学不到东西。除以 √d_k 恰好抵消这个增长，让分数的尺度与维度无关，softmax 保持在敏感区间。理解了它，你就明白了：Transformer 里很多"看似随手"的设计，背后都是对方差、尺度、梯度的精确控制——而它们的根，正是你早学过的独立同分布与大数定理。</>} />
    </Shell>
  )
}

function OrthoDiagram() {
  const dots = [-.55, -.3, -.12, .05, .2, .4, .68] // d 小：散
  const dots2 = [-.09, -.04, -.01, .02, .05, .07, .1] // d 大：挤到 0
  return (
    <Shell icon={Icn.ruler} title="高维近正交原理"
      sub="看懂：为什么几百维的嵌入能装十几万概念">
      <Sec n={1} title="问题：高维空间凭什么装得多">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>两个「意思不同」的词，向量应当<b>几乎不相关</b>（点积≈0、夹角≈90°）。可十几万个词、才几百维，怎么可能两两都接近正交、不打架？</span></div>
      </Sec>

      <Sec n={2} title="现象：维度越高，随机方向越贴近 90°">
        <div className="gd-graph">
          <svg viewBox="0 0 320 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="70" y="12" textAnchor="middle" fontSize="10" fill="var(--miss)">d 小：可能同向</text>
            <text x="250" y="12" textAnchor="middle" fontSize="10" fill="var(--hit)">d 大：挤向 0(正交)</text>
            {/* 左：两条数轴上散开的点 */}
            <line x1="16" y1="60" x2="132" y2="60" stroke="var(--line)" />
            <text x="74" y="76" textAnchor="middle" fontSize="8" fill="var(--faint)">-1 ← 余弦 → +1</text>
            {dots.map((c, k) => <circle key={k} cx={74 + c * 56} cy="50" r="3.4" fill="var(--f-tag)" />)}
            {/* 右：挤到 0 */}
            <line x1="188" y1="60" x2="304" y2="60" stroke="var(--line)" />
            <line x1="246" y1="44" x2="246" y2="58" stroke="var(--hit)" strokeWidth="1.5" />
            <text x="246" y="76" textAnchor="middle" fontSize="8" fill="var(--hit)">0 = 正交</text>
            {dots2.map((c, k) => <circle key={k} cx={246 + c * 56} cy="50" r="3.4" fill="var(--hit)" />)}
            <text x="160" y="52" textAnchor="middle" fontSize="15" fill="var(--faint)">→</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>随机单位向量的夹角余弦，均值 0、<b>方差 = 1/d</b>（d 个分量的归一化内积，又是大数定理——分量越多越集中在 0）。所以 d 越大，随机方向越挤向 90°：标准差 ≈ <b>1/√d</b>，d=512 时最大 |余弦| 才 ~0.09。</span></div>
      </Sec>

      <Sec n={3} title="结论：容量来自「高维很空」">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>能塞指数级多概念</h4><p>高维里能找到<em>指数级多</em>的「近正交」方向，一个概念占一个、彼此几乎不干扰——嵌入的容量就来自这里。</p></div>
          <div className="gd-card i"><h4>点积能当相关度</h4><p>正因为无关的方向几乎正交(点积≈0)，注意力用 <em>Q·K</em> 打分才有意义：相关的点积大、无关的接近 0。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它和 <b>√d 缩放</b> 是同一条大数定理的两面：一个说"点积方差随 d 涨"，一个说"随机方向随 d 变正交"。高维的反直觉，恰恰是大模型好用的基础。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '要装十几万概念' }, { cls: 'pd', text: '随机向量余弦方差 1/d' },
          { cls: 'pi', text: 'd 大 → 挤向 0(正交)' }, { cls: 'pt', text: '塞下指数级多近正交方向' },
          { cls: 'ph', text: '嵌入有容量·点积当相关度' },
        ]}
        why={<><b>为什么"高维近正交"是嵌入的地基：</b>低维里向量很容易撞车——二维平面上你放不下几个两两垂直的方向。但维度一高，随机两个方向几乎必然接近垂直，因为它们的相关度(余弦)方差按 1/d 收缩、死死钉在 0 附近。这就意味着高维空间极其空旷，能容纳指数级多互不干扰的方向。大模型把每个词、每个概念安放在这样一个几乎专属的方向上，于是几百维就能编码十几万词汇；而注意力用点积衡量相关，也正因为无关的方向点积天然接近 0。理解了它，你就明白了为什么「加大维度」往往直接换来容量——这是从统计到表示学习的一条硬道理。</>} />
    </Shell>
  )
}

function HopfieldDiagram() {
  return (
    <Shell icon={Icn.star} title="注意力=联想记忆原理"
      sub="看懂：注意力为什么能从上下文里「回忆」出相关信息">
      <Sec n={1} title="视角：注意力是一个按内容检索的记忆">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>把若干模式存成 keys，用 query 去检索。2020 年证明：<b>注意力的更新规则就是连续 Hopfield 网络的检索步</b>。所以注意力不是死记，是<b>按内容寻址的联想记忆</b>——给个残缺/相关的线索，就能取出完整的那条。</span></div>
      </Sec>

      <Sec n={2} title="机制：一步 Hopfield = 一次注意力">
        <div className="gd-graph">
          <svg viewBox="0 0 340 84" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <rect x="8" y="30" width="58" height="26" rx="6" fill="var(--panel)" stroke="var(--miss)" strokeWidth="1.2" />
            <text x="37" y="47" textAnchor="middle" fontSize="10" fill="var(--ink)">残缺 query</text>
            <rect x="96" y="26" width="86" height="34" rx="7" fill="color-mix(in srgb,var(--now) 8%,var(--panel))" stroke="var(--now)" strokeWidth="1.2" />
            <text x="139" y="40" textAnchor="middle" fontSize="9.5" fill="var(--ink)">softmax(β·q·keys)</text>
            <text x="139" y="52" textAnchor="middle" fontSize="8" fill="var(--faint)">对记忆打分</text>
            <rect x="212" y="30" width="64" height="26" rx="6" fill="color-mix(in srgb,var(--hit) 8%,var(--panel))" stroke="var(--hit)" strokeWidth="1.2" />
            <text x="244" y="47" textAnchor="middle" fontSize="9.5" fill="var(--ink)">Σ 权重·记忆</text>
            <rect x="300" y="30" width="34" height="26" rx="6" fill="var(--panel)" stroke="var(--hit)" strokeWidth="1.2" />
            <text x="317" y="47" textAnchor="middle" fontSize="10" fill="var(--hit)">P0</text>
            <path d="M66 43 h28" stroke="var(--dim)" strokeWidth="1.3" markerEnd="url(#hf-a)" />
            <path d="M182 43 h28" stroke="var(--dim)" strokeWidth="1.3" markerEnd="url(#hf-a)" />
            <path d="M276 43 h22" stroke="var(--dim)" strokeWidth="1.3" markerEnd="url(#hf-a)" />
            <path d="M317 56 q0 20 -140 20 q-140 0 -140 -18" fill="none" stroke="var(--dim)" strokeWidth="1.1" strokeDasharray="4 3" markerEnd="url(#hf-a)" />
            <text x="177" y="82" textAnchor="middle" fontSize="8" fill="var(--faint)">当作新 query 再检索，几步收敛</text>
            <defs><marker id="hf-a" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--dim)" /></marker></defs>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>权重 = softmax(<b>β</b>·query·keys) 对每个记忆打分；输出 = Σ 权重·记忆。把输出当新 query 再来一次——β 大时，query 只要落进某个记忆的<b>吸引域</b>，几步就被拉回那条完整的记忆。这一步，<b>就是一次注意力</b>。</span></div>
      </Sec>

      <Sec n={3} title="结论：记忆 + 检索，都在一次注意力里">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>按内容回忆</h4><p>给残缺/相关线索，取出完整信息——这就是注意力能<em>从上下文提取相关内容</em>的本质。</p></div>
          <div className="gd-card i"><h4>容量随维度指数级</h4><p>能存多少条互不干扰的记忆，取决于<em>高维近正交</em>——所以这条和「高维近正交」是一体两面。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>β(=1/温度) 是"检索锐度"：大=精确取一条、小=软混合几条。你在「注意力透视」里调的温度，调的就是它。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '记忆存成 keys' }, { cls: 'pd', text: '残缺 query 来检索' },
          { cls: 'pi', text: 'softmax(β·q·keys) 打分' }, { cls: 'pt', text: 'Σ 权重·记忆 → 新 query' },
          { cls: 'ph', text: '几步拉回完整记忆' },
        ]}
        why={<><b>为什么"注意力=联想记忆"是理解注意力的钥匙：</b>人们常把注意力讲成"加权平均"，但那只说了怎么算、没说为什么有用。联想记忆这个视角一下点破：注意力是在一个存好的记忆库里，按"内容相似"检索——给一条线索(query)，把最相关的信息(values)取出来。它有吸引域，所以能从残缺、带噪的线索里恢复完整信息；它的锐度由温度控制，所以能在"精确取一条"和"软性融合"之间调。更妙的是，它能存多少互不干扰的记忆，正由高维近正交决定。于是"为什么注意力能记住、能提取、能泛化"这些问题，都归到同一个数学对象——现代 Hopfield 网络。这就是不停留在表面、知道"为什么"的样子。</>} />
    </Shell>
  )
}

function ResidualDiagram() {
  // 两条梯度曲线：没残差指数衰减、有残差守在 1
  const plain = Array.from({length:13},(_,k)=>Math.pow(0.8,k))
  const res = [1,1.06,0.95,0.99,1.02,0.97,1.03,0.98,1.01,0.99,1.0,0.97,1.0]
  const W=210,H=52,ox=14
  const X=(k:number)=>ox + k*(W/12), Y=(v:number)=>H-6 - Math.min(1.15,v)/1.15*(H-12)
  const line=(a:number[])=>a.map((v,k)=>`${k?'L':'M'}${X(k).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')
  return (
    <Shell icon={Icn.bulb} title="残差=梯度高速路原理"
      sub="看懂：为什么几十上百层的网络能训得动">
      <Sec n={1} title="病:链式法则是连乘,越乘越小">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>反向传播里,梯度=每层局部导数的<b>连乘</b>。每层导数常小于 1(如 0.8),几十层连乘就指数衰减到≈0——<b>梯度消失</b>,最底层学不动。这是 2015 年前深网难训的核心。</span></div>
      </Sec>

      <Sec n={2} title="药:y=x+f(x),导数变成 1+f′">
        <div className="gd-graph">
          <svg viewBox="0 0 240 60" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <line x1={ox} y1={Y(1)} x2={ox+W} y2={Y(1)} stroke="var(--line)" strokeWidth="0.5" strokeDasharray="2 2" />
            <text x={ox+W+2} y={Y(1)+3} fontSize="7" fill="var(--faint)">1</text>
            <path d={line(res)} fill="none" stroke="var(--hit)" strokeWidth="1.6" />
            <path d={line(plain)} fill="none" stroke="var(--miss)" strokeWidth="1.6" />
            <text x={ox+W-2} y={Y(res[12])-3} textAnchor="end" fontSize="7.5" fill="var(--hit)">有残差 ≈1</text>
            <text x={ox+W-2} y={Y(plain[12])+8} textAnchor="end" fontSize="7.5" fill="var(--miss)">没残差 →0</text>
            <text x={ox} y={H+6} fontSize="7" fill="var(--faint)">输出层</text>
            <text x={ox+W} y={H+6} textAnchor="end" fontSize="7" fill="var(--faint)">输入层(越深)</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>残差连接让每层算 y = x + f(x)。于是这层的导数是 <b>1 + f′(x)</b>——那个 <b>+1 是恒等高速路</b>,梯度即使经过 f′ 很小的一层也能原样穿过。连乘不再塌向 0。</span></div>
      </Sec>

      <Sec n={3} title="果:连乘衰减 → 连加穿过">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>梯度到得了底层</h4><p>有了 +1 的直通路,梯度稳稳传到最深处——<em>几十上百层</em>才训得动。</p></div>
          <div className="gd-card i"><h4>标配组件</h4><p>ResNet、Transformer 的每个子层(注意力/FFN)都裹残差,<em>LayerNorm 也和它配套</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它坐在<b>梯度下降</b>之上:梯度传得下去,下降才有得下。深度革命的第一块拼图。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '梯度=各层导数连乘' }, { cls: 'pd', text: '每层<1 → 指数衰减' },
          { cls: 'pi', text: '梯度消失,深层学不动' }, { cls: 'pt', text: '残差:导数=1+f′' },
          { cls: 'ph', text: '+1 恒等路,梯度原样穿过' },
        ]}
        why={<><b>为什么"残差连接"是深度学习的转折点:</b>它用一个看似微不足道的改动——把 y=f(x) 改成 y=x+f(x)——解决了困扰深网络多年的梯度消失。原理在于链式法则:梯度反向传播是一路连乘,只要每层的导数略小于 1,几十层乘下来就归零,底层收不到任何有效信号。加上一条恒等直连后,每层的导数里凭空多了一个 +1,梯度可以顺着这条"高速路"几乎无损地一路传到最底层。正是这一步,让 ResNet 敢堆到 152 层、让 Transformer 能叠几十上百个子层而不退化。今天几乎每一个深层架构里都能找到它的身影;理解了它,你就抓住了"深度为什么能带来能力"这件事在工程上真正的支点——不是层数本身,而是让梯度活着到达每一层。</>} />
    </Shell>
  )
}

function KNNDiagram() {
  const CA = 'var(--now)', CB = 'var(--miss)'
  // 待判点 ◆ 在中间，周围 A/B 点
  const q = [125, 46]
  const pts = [[70, 30, 0], [95, 55, 0], [60, 60, 0], [155, 30, 1], [150, 62, 1], [110, 70, 1], [140, 44, 1], [100, 34, 0]]
  return (
    <Shell icon={Icn.ruler} title="k-近邻 k-NN 原理"
      sub="看懂：不训练，直接看邻居投票来分类">
      <Sec n={1} title="思路：最懒的分类器——不训练">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>别的算法要训练出参数,k-NN 偏不。判一个新点属于哪类,就<b>现场找最近的 k 个已知点、投票</b>,票多的类别即答案。力气全花在预测时找最近邻。</span></div>
      </Sec>

      <Sec n={2} title="机制：找最近 k 个，多数表决">
        <div className="gd-graph">
          <svg viewBox="0 0 250 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <circle cx={q[0]} cy={q[1]} r="30" fill="none" stroke="var(--dim)" strokeWidth="0.7" strokeDasharray="3 2" opacity=".6" />
            {pts.map((p, k) => {
              const near = Math.hypot(p[0] - q[0], p[1] - q[1]) < 30
              return <g key={k}>
                {near && <line x1={q[0]} y1={q[1]} x2={p[0]} y2={p[1]} stroke={p[2] === 0 ? CA : CB} strokeWidth="0.6" opacity=".7" />}
                <circle cx={p[0]} cy={p[1]} r={near ? 3 : 2.2} fill={p[2] === 0 ? CA : CB} opacity={near ? 1 : 0.5} />
              </g>
            })}
            <rect x={q[0] - 3} y={q[1] - 3} width="6" height="6" transform={`rotate(45 ${q[0]} ${q[1]})`} fill="var(--hit)" stroke="var(--ink)" strokeWidth="0.5" />
            <text x={q[0]} y={q[1] + 44} textAnchor="middle" fontSize="8" fill="var(--faint)">◆ 待判点 · 圈内=最近 k 个邻居</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>圈=覆盖最近 k 个邻居的半径。数一数圈里 A(蓝)、B(红)各几个,<b>多数表决</b>定类。<b>近的邻居权重大</b>——和注意力一脉。</span></div>
      </Sec>

      <Sec n={3} title="灵魂：k 决定敏感还是平滑">
        <div className="gd-lane">
          <div className="gd-card i"><h4>k 小 → 敏感</h4><p>被个别噪声点带偏,<em>决策边界毛糙</em>;边界附近的点判断不稳。</p></div>
          <div className="gd-card hit"><h4>k 大 → 平滑</h4><p>更稳、更抗噪,<em>但可能糊掉细节</em>。同一个点判断会随 k 翻——偏差-方差权衡的直观版。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它是"基于实例"的学习,坐在<b>距离/相似度</b>之上;真实里还要选距离度量、对付维度灾难。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '来一个新点要分类' }, { cls: 'pd', text: '不训练,现场找最近 k 个' },
          { cls: 'pi', text: '邻居投票、多数表决' }, { cls: 'pt', text: '近的权重大' },
          { cls: 'ph', text: 'k 小敏感/k 大平滑,边界会翻' },
        ]}
        why={<><b>为什么"k-NN"是理解机器学习的一个绝佳反例:</b>大多数算法都在"训练"——把数据里的规律压缩进一组参数,预测时只用参数、丢掉数据。k-NN 偏偏反过来:它一个参数都不学,把全部数据留着,预测时才现场按距离找最近的几个邻居来投票。这个"懒"到极致的做法,反而把机器学习最朴素的直觉摆到了明面上:相似的东西大概率是同一类,判断一个未知,就看它周围都是些什么。它也把超参数的作用演示得淋漓尽致——k 就是"看多大范围的邻居",小了容易被噪声牵着走、边界锯齿状,大了更稳但会抹平细节,边界附近的点甚至会随 k 改判,这正是偏差与方差此消彼长的活教材。理解了它,你不仅掌握了一个能用的分类器,更看清了"基于实例 vs 基于参数""相似度即智能""超参数如何影响泛化"这几件贯穿整个机器学习的大事。</>} />
    </Shell>
  )
}

function KMeansDiagram() {
  const cl = ['var(--now)', 'var(--hit)', 'var(--miss)']
  // 三堆点 + 收敛后的重心
  const groups = [
    [[30, 60], [42, 66], [36, 72], [26, 68]],
    [[120, 62], [132, 70], [126, 56], [138, 66]],
    [[80, 24], [90, 30], [74, 30], [86, 20]],
  ]
  const cents = [[33, 66], [129, 63], [82, 26]]
  return (
    <Shell icon={Icn.star} title="k-means 聚类原理"
      sub="看懂：没标签的点，怎么自己分成几堆">
      <Sec n={1} title="任务：无监督——只有点，没有答案">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>和线性回归(有标签)不同,这里一堆点<b>没有标签</b>,只想把它们分成 k 群。这就是无监督聚类,k-means 最经典。</span></div>
      </Sec>

      <Sec n={2} title="办法：分配 ↔ 更新，两步反复跳">
        <div className="gd-graph">
          <svg viewBox="0 0 250 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {groups.map((g, k) => g.map((p, j) => <circle key={k + '-' + j} cx={p[0] * 1.5} cy={p[1]} r="2.4" fill={cl[k]} opacity="0.9" />))}
            {cents.map((c, k) => (
              <g key={k}>
                <line x1={c[0] * 1.5 - 4} y1={c[1] - 4} x2={c[0] * 1.5 + 4} y2={c[1] + 4} stroke={cl[k]} strokeWidth="2" />
                <line x1={c[0] * 1.5 - 4} y1={c[1] + 4} x2={c[0] * 1.5 + 4} y2={c[1] - 4} stroke={cl[k]} strokeWidth="2" />
                <circle cx={c[0] * 1.5} cy={c[1]} r="6" fill="none" stroke={cl[k]} strokeWidth="1" />
              </g>
            ))}
            <text x="10" y="90" fontSize="7.5" fill="var(--faint)">✕ = 重心，点按最近的 ✕ 染色分堆</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span><b>①分配</b>:每个点归给离它最近的重心(✕),按颜色分堆。<b>②更新</b>:每个重心移到"自己那堆点"的平均位置。反复①②,重心一步步 march 到堆中心,簇内平方和(inertia)每轮下降、几步收敛。</span></div>
      </Sec>

      <Sec n={3} title="定位：靠数据自己找结构">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>没有老师</h4><p>全程不用真实标签,只看"谁离谁近"——<em>结构从数据里自己浮现</em>。用户分群、图像分割都靠它。</p></div>
          <div className="gd-card i"><h4>两个软肋</h4><p>结果<em>依赖初始重心</em>、簇数 <em>k 得人定</em>——这是 k-means 常被吐槽的地方。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它靠"按距离找最近"运作,坐在<b>内积/距离=相似度</b>之上;是无监督学习最好入门的一课。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '一堆无标签的点' }, { cls: 'pd', text: '①点归最近重心(分堆)' },
          { cls: 'pi', text: '②重心移到堆均值' }, { cls: 'pt', text: '反复跳,inertia 每步降' },
          { cls: 'ph', text: '重心 march 到堆中心,收敛' },
        ]}
        why={<><b>为什么"k-means"是无监督学习最好的第一课:</b>它回答了一个和监督学习完全不同的问题——当数据没有标准答案时,机器还能学到什么?k-means 给出的答案朴素又深刻:结构可以从"相似性"里自己长出来。它的两步循环像一支简单的舞:先让每个点认领离自己最近的中心,再让每个中心挪到自己聚拢的那群点的正中央;认领会变、中心会动,但每一轮簇内的紧凑度(inertia)都在提高,几步之后一切稳定,几个清晰的簇就浮现出来了。整个过程没有一个标签参与,纯靠距离。理解了它,你就掌握了无监督学习的核心直觉,也看清了它的边界:结果会随初始中心而变、簇数要你先验地定——这正是后来各种改进(k-means++、层次聚类、DBSCAN)想解决的。从用户分群到图像压缩,这套"分配-更新"的思路无处不在。</>} />
    </Shell>
  )
}

function PCADiagram() {
  // 沿对角线点云 + PC1 轴 + 投影
  const pts = [[40, 74], [52, 66], [64, 58], [76, 50], [88, 42], [100, 34], [58, 70], [82, 46], [70, 54], [46, 70]]
  const proj = pts.map(p => { const cx = 70, cy = 54; const t = ((p[0] - cx) * 0.85 + (p[1] - cy) * -0.53); return [cx + t * 0.85, cy + t * -0.53] })
  return (
    <Shell icon={Icn.ruler} title="主成分分析 PCA 原理"
      sub="看懂：找数据「最铺开」的方向，把高维压成低维">
      <Sec n={1} title="观察：相关的维度其实很冗余">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>高维数据里很多维彼此<b>相关</b>、重复,真正有用的方向没那么多。PCA 就是找出这些主方向,把数据压到低维还不丢信息。</span></div>
      </Sec>

      <Sec n={2} title="做法：找方差最大的主轴，投影上去">
        <div className="gd-graph">
          <svg viewBox="0 0 200 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <line x1="20" y1="88" x2="130" y2="20" stroke="var(--now)" strokeWidth="1.8" />
            {pts.map((p, k) => <line key={'pr' + k} x1={p[0]} y1={p[1]} x2={proj[k][0]} y2={proj[k][1]} stroke="var(--miss)" strokeWidth="0.6" strokeDasharray="2 2" opacity=".55" />)}
            {pts.map((p, k) => <circle key={k} cx={p[0]} cy={p[1]} r="2.4" fill="var(--hit)" opacity="0.55" />)}
            {proj.map((p, k) => <circle key={'p' + k} cx={p[0]} cy={p[1]} r="2" fill="var(--now)" />)}
            <text x="112" y="24" fontSize="7.5" fill="var(--now)">PC1 (方差最大)</text>
            <text x="150" y="50" fontSize="8" fill="var(--dim)">保留 96%</text>
            <text x="150" y="62" fontSize="7" fill="var(--faint)">2D → 1D 只丢 4%</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>PC1=<b>方差最大</b>的方向=协方差矩阵最大特征向量。把每个点<b>投影</b>到 PC1(垂线落下),原来的 (x,y) 两个数就压成"轴上位置"一个数,却保住了绝大部分差异。</span></div>
      </Sec>

      <Sec n={3} title="意义：去冗余、抓主轴">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>降维的基础</h4><p>高维数据压到 2D 就能<em>画出来看</em>;也用于压缩、去噪——保住主方向、丢掉噪声方向。</p></div>
          <div className="gd-card i"><h4>和低秩一家</h4><p>特征值大的方向该留、小的可丢,<em>信息集中在少数主方向</em>——正是 LoRA/低秩的思想。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>主成分两两正交(接「高维近正交」);它坐在协方差、特征分解之上,是"抓大放小"这条主线在几何上的样子。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '高维、各维相关冗余' }, { cls: 'pd', text: '找方差最大方向 PC1' },
          { cls: 'pi', text: 'PC1=协方差最大特征向量' }, { cls: 'pt', text: '点投影到主成分' },
          { cls: 'ph', text: '少数维保住大部分方差' },
        ]}
        why={<><b>为什么"PCA"是与高维数据打交道的第一件趁手工具:</b>现实数据往往名义上有很多维,实际有效的自由度却少得多——身高和体重相关、各种传感器读数彼此耦合,信息其实挤在少数几个方向上。PCA 的洞见是用"方差"来量一个方向承载了多少信息:方差最大的方向,就是数据铺得最开、差异最丰富的方向,把它找出来作为第一主成分,再依次找与之正交、方差次大的方向。数学上这些主成分正是协方差矩阵的特征向量,特征值就是对应的方差,于是"该保留哪些方向"变成了"留下特征值大的",干净利落。把数据投影到前几个主成分上,就能在几乎不损失信息的前提下大幅降维——这既让高维数据能压到二维画出来看,也是压缩、去噪、特征提取的基础。理解了它,你不仅多了一件降维利器,更抓住了"信息集中在少数主方向、抓大放小"这条贯穿 PCA、低秩近似、LoRA 的共同思想。</>} />
    </Shell>
  )
}

function SVMDiagram() {
  const CA = 'var(--now)', CB = 'var(--miss)'
  const a = [[45, 30], [45, 62], [28, 46], [22, 24]]
  const b = [[130, 30], [130, 62], [148, 46], [155, 24]]
  const sv = [[45, 30], [45, 62], [130, 30], [130, 62]]
  return (
    <Shell icon={Icn.ruler} title="支持向量机 SVM 原理"
      sub="看懂：分两类不够，要找「最宽的那条街」">
      <Sec n={1} title="问题：能分开的线有无数条，哪条最好？">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>两类线性可分时,分界线有无数条。逻辑回归随便找一条能分开的;SVM 多问一句:哪一条最稳?</span></div>
      </Sec>

      <Sec n={2} title="答案：最大间隔 + 支持向量">
        <div className="gd-graph">
          <svg viewBox="0 0 250 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <rect x="45" y="6" width="85" height="80" fill={CA} opacity="0.07" />
            <line x1="45" y1="6" x2="45" y2="86" stroke="var(--dim)" strokeWidth="0.8" strokeDasharray="3 2" />
            <line x1="130" y1="6" x2="130" y2="86" stroke="var(--dim)" strokeWidth="0.8" strokeDasharray="3 2" />
            <line x1="87.5" y1="6" x2="87.5" y2="86" stroke="var(--now)" strokeWidth="1.8" />
            {a.map((p, k) => <circle key={'a' + k} cx={p[0]} cy={p[1]} r="2.6" fill={CA} />)}
            {b.map((p, k) => <circle key={'b' + k} cx={p[0]} cy={p[1]} r="2.6" fill={CB} />)}
            {sv.map((p, k) => <circle key={'s' + k} cx={p[0]} cy={p[1]} r="4.6" fill="none" stroke="var(--ink)" strokeWidth="0.9" />)}
            <text x="87.5" y="90" textAnchor="middle" fontSize="7" fill="var(--now)">边界(街道正中)</text>
            <text x="165" y="46" fontSize="7" fill="var(--faint)">黑圈=支持向量</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>SVM 让两类之间的"街道"最宽,正中那条线就是边界——离两边都最远,<b>泛化最稳</b>。这条街只由紧贴街边的几个<b>支持向量</b>(黑圈)定住,其余点再远都不影响。</span></div>
      </Sec>

      <Sec n={3} title="威力：只记关键点 + 核函数升维">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>模型极精简</h4><p>只记得<em>支持向量</em>那几个关键点,其余全可丢——小样本、高维一度是王者。</p></div>
          <div className="gd-card i"><h4>核函数破非线性</h4><p>线性不可分时,用<em>核函数把点映到高维</em>,在那儿再找最大间隔——SVM 的另一半威力。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它靠内积几何算间隔,坐在"内积=相似度"、逻辑回归(线性分类)之上;把"能分开"升级成"分得最稳"。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '能分开的线无数条' }, { cls: 'pd', text: 'SVM:要最大间隔' },
          { cls: 'pi', text: '两类间最宽的街,正中为界' }, { cls: 'pt', text: '街只由支持向量定住' },
          { cls: 'ph', text: '离两边最远→泛化最稳' },
        ]}
        why={<><b>为什么"支持向量机"把分类的追求推到了极致:</b>大多数线性分类器满足于找到一条能把两类分开的线,SVM 却坚持要找"最好"的那一条,并把"最好"定义得干净利落——离两边都尽可能远。几何上,这等价于在两类之间开出一条尽量宽的街道,街心线就是决策边界。这个"最大间隔"的偏好背后是深刻的泛化直觉:边界离数据越远,面对没见过的新样本时容错就越大,越不容易判错。更优雅的是,这条最宽的街完全由紧贴街边的少数几个"支持向量"决定,其余样本无论多少、多远都无关紧要,于是模型异常精简、对噪声也稳健。而当数据在原空间里线性不可分时,SVM 用核技巧把它们悄悄映射到更高维,在那里再开出最大间隔的街——这让它能处理相当复杂的非线性边界。理解了 SVM,你就掌握了"间隔即泛化"这一核心思想,以及核方法这把打开高维的钥匙,这两者至今仍深刻影响着机器学习。</>} />
    </Shell>
  )
}

function GBDTDiagram() {
  // 三个阶段的预测阶梯逼近数据
  const data = [[16, 66], [30, 66], [44, 40], [58, 40], [72, 52], [86, 52]]
  const flat = 54
  const step1 = [[10, 62], [50, 62], [50, 44], [92, 44]]
  const step2 = [[10, 66], [38, 66], [38, 42], [66, 42], [66, 52], [92, 52]]
  return (
    <Shell icon={Icn.doc} title="梯度提升树 GBDT 原理"
      sub="看懂：一棵棵小树接力，每棵只补上一棵的「错」">
      <Sec n={1} title="思路：不求一棵完美树，让小树接力补错">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>单棵树易过拟合、拟合不了平滑曲线。GBDT 让<b>一串小树接力</b>:每棵只补前面所有树还没拟合掉的误差(<b>残差</b>)。</span></div>
      </Sec>

      <Sec n={2} title="做法：每轮拟合残差，预测越来越准">
        <div className="gd-graph">
          <svg viewBox="0 0 250 76" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {([['起点:均值', 8], ['+1 棵树', 90], ['+多棵', 172]] as [string, number][]).map(([label, ox], ci) => (
              <g key={ci} transform={`translate(${ox},0)`}>
                <text x="30" y="10" textAnchor="middle" fontSize="7.5" fill="var(--faint)">{label}</text>
                {data.map((p, k) => <circle key={k} cx={p[0] * 0.7} cy={p[1] * 0.7 + 8} r="1.8" fill="var(--hit)" opacity="0.7" />)}
                {ci === 0
                  ? <line x1="6" y1={flat * 0.7 + 8} x2="66" y2={flat * 0.7 + 8} stroke="var(--now)" strokeWidth="1.6" />
                  : <polyline points={(ci === 1 ? step1 : step2).map(p => `${p[0] * 0.7},${p[1] * 0.7 + 8}`).join(' ')} fill="none" stroke="var(--now)" strokeWidth="1.6" />}
              </g>
            ))}
            <text x="70" y="70" fontSize="10" fill="var(--faint)">→</text>
            <text x="152" y="70" fontSize="10" fill="var(--faint)">→</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>先用均值(平线)当预测;每轮算<b>残差</b>(真值−预测),训一棵小树拟合残差、乘学习率加进预测。残差越来越小、预测阶梯越来越贴数据、MSE 一路降。因为拟合的是残差(负梯度),故名<b>梯度提升</b>。</span></div>
      </Sec>

      <Sec n={3} title="意义：弱学习器接力 = 强学习器">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>集成的威力</h4><p>每棵树很弱,串起来却很强——<em>boosting</em>;和随机森林(并行投票的 bagging)并称集成两大路线。</p></div>
          <div className="gd-card i"><h4>表格数据主力</h4><p>它的现代实现 <em>XGBoost、LightGBM</em>,至今是结构化数据竞赛和工业界的常胜军。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它坐在决策树之上(弱学习器就是树桩);"拟合残差=拟合负梯度"又和梯度下降一脉。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '单棵树不够准' }, { cls: 'pd', text: '初始预测=均值' },
          { cls: 'pi', text: '每轮拟合当前残差' }, { cls: 'pt', text: '小树乘学习率加进预测' },
          { cls: 'ph', text: '弱学习器接力=强学习器' },
        ]}
        why={<><b>为什么"梯度提升"是集成学习里最能打的一招:</b>它的哲学和"三个臭皮匠顶个诸葛亮"如出一辙,却把协作方式设计得极其精巧——不是让很多模型各自独立表决,而是让它们排成一队接力,每一棵新树都专门盯着"前面那些树合起来还没做对的部分"去补。用残差来传递"还差多少"这个信号,本质上等于沿着损失的负梯度一步步下降,只不过每一步不是调参数、而是加一棵小树,这就是"梯度提升"名字的由来。这样做的好处是,单棵树可以很浅很弱(不容易过拟合),但一串弱树累加起来,却能逼近相当复杂的函数。配上学习率、子采样、正则化等控制手段,它在结构化/表格数据上的表现常年碾压更花哨的模型,XGBoost、LightGBM 至今是竞赛和工业界的主力。理解了它,你就掌握了 boosting 这条与 bagging(随机森林)并立的集成主线,以及"用加法模型逐步逼近"这个既朴素又强大的建模思想。</>} />
    </Shell>
  )
}

function DTreeDiagram() {
  const CA = 'var(--now)', CB = 'var(--miss)'
  return (
    <Shell icon={Icn.doc} title="决策树原理"
      sub="看懂：靠一刀刀「切平面」把类别分开">
      <Sec n={1} title="思路：连续问「某特征 ≷ 阈值？」">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>不找一条斜线,而是像 20 个问题:每个节点问一个是非题(如 x&lt;0?),把数据一分为二,顺答案往下走到<b>纯净叶子</b>(几乎全同类)。</span></div>
      </Sec>

      <Sec n={2} title="选刀：哪一刀切完最纯就切哪">
        <div className="gd-graph">
          <svg viewBox="0 0 250 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 平面 + 两刀 */}
            <rect x="40" y="8" width="40" height="76" fill={CA} opacity="0.1" />
            <rect x="82" y="8" width="38" height="38" fill={CB} opacity="0.1" />
            <rect x="82" y="48" width="38" height="36" fill={CA} opacity="0.1" />
            <line x1="80" y1="8" x2="80" y2="84" stroke="var(--ink)" strokeWidth="1.4" strokeDasharray="3 2" />
            <line x1="80" y1="46" x2="120" y2="46" stroke="var(--ink)" strokeWidth="1.4" strokeDasharray="3 2" />
            {[[55, 60], [62, 70], [50, 30], [66, 40]].map((p, k) => <circle key={'l' + k} cx={p[0]} cy={p[1]} r="2.4" fill={CA} />)}
            {[[95, 22], [108, 30], [100, 18]].map((p, k) => <circle key={'t' + k} cx={p[0]} cy={p[1]} r="2.4" fill={CB} />)}
            {[[98, 62], [110, 70], [102, 74]].map((p, k) => <circle key={'b' + k} cx={p[0]} cy={p[1]} r="2.4" fill={CA} />)}
            {/* 树 */}
            <g fontSize="7" fill="var(--dim)">
              <rect x="150" y="10" width="44" height="12" rx="2" fill="var(--panel)" stroke="var(--line)" /><text x="172" y="19" textAnchor="middle">x &lt; 0 ?</text>
              <line x1="160" y1="22" x2="150" y2="38" stroke="var(--line)" /><line x1="184" y1="22" x2="200" y2="38" stroke="var(--line)" />
              <rect x="132" y="38" width="34" height="11" rx="2" fill={CA} fillOpacity="0.18" stroke="var(--now)" /><text x="149" y="46" textAnchor="middle" fill="var(--now)">第0类</text>
              <rect x="185" y="38" width="40" height="12" rx="2" fill="var(--panel)" stroke="var(--line)" /><text x="205" y="47" textAnchor="middle">y &lt; 0 ?</text>
              <line x1="195" y1="50" x2="188" y2="64" stroke="var(--line)" /><line x1="215" y1="50" x2="224" y2="64" stroke="var(--line)" />
              <rect x="170" y="64" width="34" height="11" rx="2" fill={CB} fillOpacity="0.18" stroke="var(--miss)" /><text x="187" y="72" textAnchor="middle" fill="var(--miss)">第1类</text>
              <rect x="210" y="64" width="34" height="11" rx="2" fill={CA} fillOpacity="0.18" stroke="var(--now)" /><text x="227" y="72" textAnchor="middle" fill="var(--now)">第0类</text>
            </g>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>怎么选每刀?挑让子集<b>最纯</b>的那刀——基尼不纯度(0=全同类)下降最多(信息增益最大)。切出纯块成叶子,不纯的<b>递归</b>再切。左边是切出来的区块,右边是对应的树。</span></div>
      </Sec>

      <Sec n={3} title="好处：可解释 + 是集成的积木">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>天生可解释</h4><p>从根到叶每条路径就是<em>一串 if-else 规则</em>,能直接读——这是它相对神经网络的大优势。</p></div>
          <div className="gd-card i"><h4>集成的积木</h4><p>多刀轴对齐能拼非线性边界;<em>很多棵树组合=随机森林 / GBDT</em>,最能打的模型之一。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它靠贪心一刀刀选最优,坐在树结构、贪心算法之上;是从"线性分类"跨到"规则/集成"的关键一步。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '一堆混杂的点(不纯)' }, { cls: 'pd', text: '挑增益最大的一刀' },
          { cls: 'pi', text: '某特征≷阈值,一分为二' }, { cls: 'pt', text: '纯块成叶、不纯的递归切' },
          { cls: 'ph', text: '每条路径=一串 if-else' },
        ]}
        why={<><b>为什么"决策树"是机器学习里最好懂、也最有用的一类模型:</b>它把学习变成了一连串你我都会做的是非判断——这个特征大于某个值吗?是就往左,不是就往右,一路问到底,落进一个"基本都是同一类"的角落。它选每一刀的标准也极朴素:哪一刀能把混杂的数据切得更纯,就切哪一刀(用基尼或信息增益来量"纯")。这种做法有两个别的模型很难同时具备的好处:一是彻底可解释,从根到叶的每条路径就是一条能读出来的 if-else 规则,在医疗、风控这种需要讲清"为什么"的场景无可替代;二是它用一堆轴对齐的直刀就能拼出任意弯曲的边界,表达力其实很强。更重要的是,单棵树容易过拟合、不够稳,但把很多棵树用随机化和残差拟合组合起来,就成了随机森林和梯度提升树(GBDT)——至今在表格数据上依然极能打的主力模型。理解了决策树,你就握住了"可解释建模"和"集成学习"这两条大主线的起点。</>} />
    </Shell>
  )
}

function LogRegDiagram() {
  const CA = 'var(--now)', CB = 'var(--miss)'
  const a = [[30, 68], [46, 58], [36, 76], [24, 62], [50, 72]]
  const b = [[150, 30], [166, 42], [140, 26], [172, 20], [156, 48]]
  return (
    <Shell icon={Icn.ruler} title="逻辑回归原理"
      sub="看懂：把「拟合直线」改造成「分两类」">
      <Sec n={1} title="改造：线性打分 → sigmoid 出概率">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>线性回归输出连续值,逻辑回归改两处:①线性打分 z=w·x+b 后过一个 <b>sigmoid</b> 压进 (0,1) 当"概率";②损失用<b>交叉熵</b>。就成了最基础的分类器。</span></div>
      </Sec>

      <Sec n={2} title="学习：把决策边界转到两类之间">
        <div className="gd-graph">
          <svg viewBox="0 0 250 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs><linearGradient id="lrg" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor={CA} stopOpacity="0.16" /><stop offset="50%" stopColor="var(--panel)" stopOpacity="0" /><stop offset="100%" stopColor={CB} stopOpacity="0.16" /></linearGradient></defs>
            <rect x="6" y="6" width="238" height="80" fill="url(#lrg)" rx="4" />
            <line x1="20" y1="86" x2="230" y2="6" stroke="var(--now)" strokeWidth="1.8" />
            {a.map((p, k) => <circle key={'a' + k} cx={p[0]} cy={p[1]} r="2.6" fill={CA} />)}
            {b.map((p, k) => <circle key={'b' + k} cx={p[0]} cy={p[1]} r="2.6" fill={CB} />)}
            <text x="40" y="20" fontSize="7.5" fill={CA}>概率→0</text>
            <text x="190" y="80" fontSize="7.5" fill={CB}>概率→1</text>
            <text x="120" y="52" fontSize="7.5" fill="var(--now)" transform="rotate(-20 120 52)">决策边界 z=0</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>决策边界就是 z=0 那条线:一侧概率＞0.5 判第 1 类、另一侧判第 0 类。梯度下降沿交叉熵下降方向调 w、b,把边界<b>转到能分开两类</b>的位置,两侧按 sigmoid 概率渐变。</span></div>
      </Sec>

      <Sec n={3} title="意义：神经网络最小的那块砖">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>就是一个神经元</h4><p>线性打分 + sigmoid = <em>单个神经元</em>;把很多这样的砖堆起来,就是神经网络。</p></div>
          <div className="gd-card i"><h4>同一套骨架</h4><p>和线性回归一样"定损失→求梯度→更新",只是 <em>MSE 换交叉熵、直线换概率</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它坐在线性回归、softmax(sigmoid 是二类 softmax)、交叉熵之上;是从"回归"跨到"分类"、再跨到"神经网络"的关键一步。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '要分两类,不是拟合值' }, { cls: 'pd', text: '线性打分 z=w·x+b' },
          { cls: 'pi', text: 'sigmoid 压成概率' }, { cls: 'pt', text: '交叉熵当损失' },
          { cls: 'ph', text: '梯度下降转边界,分开两类' },
        ]}
        why={<><b>为什么"逻辑回归"是从回归通往神经网络的桥:</b>它看起来只是线性回归的小改款,却完成了一次关键的观念跃迁——从预测一个连续的数,变成判断属于哪一类。诀窍是两步:先用 sigmoid 把线性打分挤成一个 0 到 1 的概率,再用交叉熵这个"越自信越错就罚得越狠"的损失来训练。于是学习的几何意义变得无比清晰:模型在找一条决策边界,并努力把它转到能把两类分开的位置。更深一层看,逻辑回归其实就是一个带 sigmoid 激活的神经元——这意味着,你把成百上千个这样的单元按层堆叠、再加上非线性,就长成了神经网络。所以掌握逻辑回归,不只是多会一个分类器,而是理解了深度学习最基本的构造单元,以及"打分—激活—损失—梯度"这条贯穿始终的主线。</>} />
    </Shell>
  )
}

function BackpropDiagram() {
  const node = (nx: number, ny: number, label: string, val: string, grad: string | null) => (
    <g>
      <rect x={nx - 14} y={ny - 9} width="28" height="18" rx="3" fill="var(--panel)" stroke="var(--line)" strokeWidth="0.6" />
      <text x={nx} y={ny - 2} textAnchor="middle" fontSize="5.5" fill="var(--dim)">{label}</text>
      <text x={nx} y={ny + 5} textAnchor="middle" fontSize="6" fill="var(--ink)" fontWeight="bold">{val}</text>
      {grad && <text x={nx} y={ny + 17} textAnchor="middle" fontSize="5.5" fill="var(--miss)">{grad}</text>}
    </g>
  )
  return (
    <Shell icon={Icn.chip} title="反向传播原理"
      sub="看懂：链式法则把「误差」逐层回传成每个权重的梯度">
      <Sec n={1} title="难题：上亿权重，梯度怎么高效算出来">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>梯度下降要梯度,但网络有上亿权重。反向传播是训练神经网络的<b>发动机</b>:前向算损失、反向一趟把所有权重的梯度全算出来。</span></div>
      </Sec>

      <Sec n={2} title="做法：链式法则一站站回传">
        <div className="gd-graph">
          <svg viewBox="0 0 250 70" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <g stroke="var(--line)" strokeWidth="0.6">
              <line x1="40" y1="16" x2="82" y2="28" /><line x1="40" y1="40" x2="82" y2="28" />
              <line x1="110" y1="28" x2="148" y2="28" /><line x1="176" y1="28" x2="214" y2="28" />
            </g>
            <path d="M226 56 L20 56" fill="none" stroke="var(--miss)" strokeWidth="0.9" strokeDasharray="2.5 2" markerEnd="url(#bpg-a)" />
            <text x="123" y="53" textAnchor="middle" fontSize="5.5" fill="var(--miss)">梯度回传方向</text>
            <defs><marker id="bpg-a" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 L5 3 L0 6" fill="var(--miss)" /></marker></defs>
            {node(26, 16, 'w', '0.8', '−0.11')}
            {node(26, 40, 'b', '0.2', '−0.11')}
            {node(96, 28, 'z=wx+b', '1.0', '−0.11')}
            {node(162, 28, 'a=σ(z)', '0.73', '−0.54')}
            {node(228, 28, 'L', '0.07', '1')}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>前向:w,x,b→z→a→L 算出损失。反向:从 L 出发,<b>下游梯度 × 本站局部导数 = 上游梯度</b>。过 sigmoid 乘 a(1−a)、过乘法乘"另一个数"……每站只管自己那点局部导数,链一串把梯度送回每个权重(红字)。</span></div>
      </Sec>

      <Sec n={3} title="意义：深度学习的发动机">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>一趟出全部梯度</h4><p>不用对每个权重重算网络——<em>一次反向传播</em>就把所有权重的梯度全给你,代价只和参数量成正比。</p></div>
          <div className="gd-card i"><h4>训得动大模型</h4><p>正因为它这么高效,<em>上亿、上千亿参数</em>才训得起来;梯度能传回去,靠残差高速路。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它把「梯度下降」真正落到大网络上;和「残差=梯度高速路」(让梯度不消失地传回去)是同一条主线。逻辑回归就是这里最小的一个神经元。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '前向:算到损失 L' }, { cls: 'pd', text: '从 L 出发往回传' },
          { cls: 'pi', text: '下游梯度×本站局部导数' }, { cls: 'pt', text: '=上游梯度,一站站链' },
          { cls: 'ph', text: '一趟得到所有权重的梯度' },
        ]}
        why={<><b>为什么"反向传播"是让深度学习成为可能的那一个算法:</b>训练神经网络的整个逻辑,是用梯度下降沿着损失下降的方向调整权重;可网络动辄上亿个权重,要是对每一个权重都单独扰动一下、重跑一遍网络来估计它的梯度,计算量将大到天荒地老。反向传播用一个惊人高效的办法解决了这件事:它只需前向跑一遍算出损失,再反向跑一遍,就能把损失对每一个权重的梯度**全部**算出来,总代价只和参数量成正比。它依赖的其实就是微积分里的链式法则——把一个复杂函数的求导拆成一站接一站的局部求导,每一站只需知道自己那点局部导数,再乘上从下游传来的梯度,就得到该往上游继续传的梯度。于是"误差"像信号一样,从损失出发,沿着计算图一路回流,精确地告诉每个权重"你该往哪个方向、调多少"。理解了它,你就掌握了所有深度学习框架里 .backward() 背后到底发生了什么,也明白了为什么"让梯度顺畅地传回去"(残差连接、归一化、合适的激活)是训练深网络的头等大事。</>} />
    </Shell>
  )
}

function BinSearchDiagram() {
  const arr = [3, 7, 12, 18, 25, 31, 42, 55, 63, 71, 80, 88, 95]
  // 三步区间：全→右半→缩到 63
  const ranges = [[0, 12, 6], [7, 12, 9], [8, 8, 8]]
  return (
    <Shell icon={Icn.ruler} title="二分查找原理"
      sub="看懂：有序 = 每问一次砍掉一半">
      <Sec n={1} title="前提：数组排好序，才能对折">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>无序只能一个个扫(n 次)。但只要<b>排好序</b>,就能每次看正中间、<b>一次比较砍掉一半</b>。</span></div>
      </Sec>

      <Sec n={2} title="做法：看中点，砍掉不可能的那半">
        <div className="gd-graph">
          <svg viewBox="0 0 250 76" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {ranges.map((rg, ri) => (
              <g key={ri} transform={`translate(0,${ri * 24})`}>
                {arr.map((v, k) => {
                  const inR = k >= rg[0] && k <= rg[1], isMid = k === rg[2]
                  return <g key={k}>
                    <rect x={8 + k * 18} y="2" width="16" height="14" rx="2"
                      fill={isMid ? 'color-mix(in srgb,var(--now) 25%,var(--panel))' : 'var(--panel)'}
                      stroke={isMid ? 'var(--now)' : 'var(--line)'} strokeWidth={isMid ? 1 : 0.5} opacity={inR ? 1 : 0.28} />
                    <text x={16 + k * 18} y="12" textAnchor="middle" fontSize="5.5" fill="var(--ink)" opacity={inR ? 1 : 0.3}>{v}</text>
                  </g>
                })}
                <text x="238" y="12" fontSize="6" fill="var(--faint)">{ri === 2 ? '命中 63' : 'mid=' + arr[rg[2]]}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>看中点 arr[mid]:目标比它<b>大</b>就只在<b>右半</b>、比它<b>小</b>就只在<b>左半</b>(灰掉的全排除)。区间 [lo,hi] 反复对折:找 63 → mid=42(去右)→ mid=71(去左)→ mid=63 命中,共 4 步。</span></div>
      </Sec>

      <Sec n={3} title="效率：log₂n，百万个也才 20 步">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>每步减半</h4><p>n→n/2→n/4→…,只需 <em>log₂n</em> 次:13 个 4 步、一百万 20 步、十亿 30 步。</p></div>
          <div className="gd-card i"><h4>排序的价值</h4><p>先花力气排好序,<em>之后无数次查询都享 log 级的快</em>;所以它常和排序配套。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>"对折排除"的思想无处不在:B+树索引、git bisect 定位引入 bug 的提交、猜数字游戏,底子都是它。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '数组已排好序' }, { cls: 'pd', text: '看正中间那个' },
          { cls: 'pi', text: '大→右半、小→左半' }, { cls: 'pt', text: '一次比较砍一半' },
          { cls: 'ph', text: 'log₂n 步命中' },
        ]}
        why={<><b>为什么"二分查找"是每个程序员的必修第一课:</b>它用最小的例子讲清了算法里最重要的一个思想——用结构换效率。数据一旦有序,你就获得了一种"排除"的能力:看一眼正中间,就能笃定目标不可能在另外一半,于是一次比较抵得上扫一大片。搜索空间以指数速度坍缩,n 次变成 log n 次,一百万个数从平均五十万次比较降到二十次,这个差距在大规模数据上就是能用和不能用的区别。它也点破了排序为什么值得:排序是一次性的投入,换来的是之后每一次查询都享受对数级的快。更妙的是,这个"每次砍掉一半可能性"的对折思想会一路延伸——平衡二叉树、B+树数据库索引、git bisect 二分定位出问题的提交、乃至各种"猜答案再逼近"的算法,骨子里都是它。掌握了它,你就有了衡量"一个算法快不快"最基本的直觉:看它每一步能排除掉多少可能性。</>} />
    </Shell>
  )
}

function ConvDiagram() {
  const img = [[0, 0, 9, 9, 9], [0, 0, 9, 9, 9], [0, 0, 9, 9, 9], [0, 0, 9, 9, 9], [0, 0, 9, 9, 9]]
  const g = (v: number) => `color-mix(in srgb, var(--ink) ${Math.round((v / 9) * 78)}%, var(--panel))`
  const out = [[27, 27, 0], [27, 27, 0], [27, 27, 0]]
  return (
    <Shell icon={Icn.chip} title="卷积 CNN 原理"
      sub="看懂：一个小窗口滑过图像，就能「看见」特征">
      <Sec n={1} title="问题：给每个像素配权重会爆炸">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>一张图上万像素,全连接给每个配权重参数会爆炸,而且换个位置的同一物体就不认得了。卷积用<b>小核滑窗 + 权重共享</b>绕开这两难。</span></div>
      </Sec>

      <Sec n={2} title="做法：小核滑窗，处处做点积">
        <div className="gd-graph">
          <svg viewBox="0 0 250 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 输入图 */}
            {img.map((row, r) => row.map((v, c) => <rect key={`${r}-${c}`} x={10 + c * 13} y={14 + r * 13} width="12" height="12" rx="1.5" fill={g(v)} stroke="var(--line)" strokeWidth="0.4" />))}
            <rect x="9" y="13" width="40" height="40" fill="none" stroke="var(--now)" strokeWidth="1.6" />
            <text x="36" y="10" textAnchor="middle" fontSize="7" fill="var(--faint)">输入图 + 滑窗</text>
            <text x="88" y="40" fontSize="9" fill="var(--faint)">⊙ 核</text>
            <text x="88" y="50" fontSize="7" fill="var(--faint)">= 点积</text>
            <text x="128" y="40" fontSize="10" fill="var(--faint)">→</text>
            {/* 特征图 */}
            {out.map((row, r) => row.map((v, c) => <g key={`o${r}-${c}`}><rect x={150 + c * 15} y={18 + r * 15} width="14" height="14" rx="1.5" fill={v > 5 ? 'color-mix(in srgb,var(--now) 55%,var(--panel))' : 'var(--panel)'} stroke="var(--line)" strokeWidth="0.4" /><text x={157 + c * 15} y={28 + r * 15} textAnchor="middle" fontSize="7" fill="var(--ink)">{v}</text></g>))}
            <text x="172" y="74" textAnchor="middle" fontSize="7" fill="var(--faint)">特征图(边缘处亮)</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>3×3 核在图上一格格滑,每处把核和窗口像素<b>逐位相乘再相加</b>=一个数,拼成特征图。同一个核<b>共享权重</b>扫全图——参数少、还<b>平移不变</b>(哪儿有这特征都认得)。边缘核就在明暗交界那两列亮起来。</span></div>
      </Sec>

      <Sec n={3} title="意义：CNN 看图的底">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>浅层看纹理</h4><p>不同核提不同特征:边缘、方向、纹理——<em>第一层卷积就在干这个</em>。</p></div>
          <div className="gd-card i"><h4>深层拼物体</h4><p>很多层叠起来,把边缘纹理<em>组合成眼睛、轮子、物体</em>——分类/检测/分割全靠它。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它本质就是<b>点积/内积</b>在图像上的批量应用,坐在矩阵乘法、内积=相似度之上。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '全连接权重会爆炸' }, { cls: 'pd', text: '改用小核滑窗' },
          { cls: 'pi', text: '每处核⊙像素=点积' }, { cls: 'pt', text: '共享权重、平移不变' },
          { cls: 'ph', text: '浅层边缘→深层物体' },
        ]}
        why={<><b>为什么"卷积"是计算机视觉的地基:</b>它用一个极简的操作解决了给图像建模的两个根本难题。其一是参数量:一张图像素成千上万,若像全连接那样给每个像素单独配权重,参数会大到无法训练;卷积让一个小小的核在整张图上滑动、处处复用同一组权重,参数一下子降到几十个。其二是平移不变性:我们希望"猫在左上角"和"猫在右下角"都能被认出来,权重共享恰好保证了同一个特征无论出现在哪里都用同一个核去检测。每一次卷积就是核与局部像素的一个点积——它在衡量"这块图像有多像这个核所代表的模式"。于是浅层的核自然学会响应边缘、颜色、纹理这些基本元素,越往深层,核把这些基本元素层层组合,拼出眼睛、车轮乃至完整的物体。理解了这个"小窗口滑过图像、处处做点积"的操作,你就握住了从图像分类到目标检测、语义分割这一整片视觉技术的共同底座。</>} />
    </Shell>
  )
}

function LinRegDiagram() {
  // 示意散点 + 拟合线 + 残差
  const pts = [[15, 78], [28, 66], [40, 58], [52, 46], [64, 40], [76, 28], [88, 20], [34, 70], [58, 36], [70, 48]]
  const line = (x: number) => 90 - x * 0.82   // 拟合线
  return (
    <Shell icon={Icn.ruler} title="线性回归原理"
      sub="看懂：机器怎么「拟合」一条线">
      <Sec n={1} title="任务：找一条离所有点最近的直线">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>给一堆散点 (x,y),找 y=wx+b 让它离所有点尽量近。"近"用<b>均方误差 MSE</b>量:每点到直线的<b>竖直距离</b>(残差)平方再平均。</span></div>
      </Sec>

      <Sec n={2} title="办法：梯度下降调 w、b，残差变短">
        <div className="gd-graph">
          <svg viewBox="0 0 250 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <line x1="10" y1="86" x2="240" y2="86" stroke="var(--line)" strokeWidth="0.6" />
            <line x1="14" y1="6" x2="14" y2="88" stroke="var(--line)" strokeWidth="0.6" />
            {/* 残差 */}
            {pts.map((p, k) => <line key={'r' + k} x1={20 + p[0] * 2.1} y1={p[1]} x2={20 + p[0] * 2.1} y2={line(p[0])} stroke="var(--miss)" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />)}
            {/* 拟合线 */}
            <line x1={20 + 8 * 2.1} y1={line(8)} x2={20 + 92 * 2.1} y2={line(92)} stroke="var(--now)" strokeWidth="1.8" />
            {/* 点 */}
            {pts.map((p, k) => <circle key={k} cx={20 + p[0] * 2.1} cy={p[1]} r="2.4" fill="var(--hit)" />)}
            <text x="200" y="20" fontSize="8" fill="var(--now)">y=wx+b</text>
            <text x="120" y="90" fontSize="7.5" fill="var(--miss)">红竖线=残差</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>从随便一条线出发,对 MSE 求梯度、<b>沿负梯度</b>一点点调 w、b:直线转进点云、残差一根根变短、MSE 下降。线性回归有<b>闭式最优解(最小二乘)</b>,梯度下降会收敛到它。</span></div>
      </Sec>

      <Sec n={3} title="意义：所有 ML 训练的骨架">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>定损失→求梯度→更新</h4><p>MSE 是损失,w/b 是参数,梯度指方向——<em>这套骨架换个模型就是逻辑回归、神经网络</em>。</p></div>
          <div className="gd-card i"><h4>收敛到数学最优</h4><p>梯度下降的终点正好是<em>最小二乘闭式解</em>,眼见的"学习"落到可验证的数学上。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它坐在「梯度下降」之上;是机器学习这个学科最朴素、也最该先看的一课。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '一堆散点' }, { cls: 'pd', text: '损失=MSE(残差平方均)' },
          { cls: 'pi', text: '沿负梯度调 w、b' }, { cls: 'pt', text: '直线转进点云、MSE 降' },
          { cls: 'ph', text: '收敛到最小二乘最优线' },
        ]}
        why={<><b>为什么"线性回归"是理解机器学习的第一课:</b>它把"机器学习"这件看似神秘的事,压缩成一个你能一眼看穿的画面——一堆点,一条努力贴上去的线。关键在于它清清楚楚地摆出了学习的三要素:一个衡量好坏的损失(点到线的竖直距离,平方求和),一组可调的参数(斜率 w 和截距 b),以及一个改进的方向(损失对参数的梯度,取负号就是下山的方向)。梯度下降沿着这个方向一步步挪,直线就一点点转到最贴合的位置,残差肉眼可见地缩短。更漂亮的是,线性回归有闭式最优解,梯度下降的终点恰好落在这个数学最优上——于是"学习"不再是黑箱,而是可验证的优化。掌握了这套"定损失、求梯度、沿负梯度更新"的骨架,你再看逻辑回归、支持向量机、神经网络,会发现它们不过是换了更复杂的模型和损失,内核完全一样。</>} />
    </Shell>
  )
}

function PPDiagram() {
  // 4 级 × 时间 的调度示意（M=4）：busy=微批号，-1=气泡
  const G = 4, M = 4, T = M + G - 1
  const cell = (s: number, t: number) => (t - s >= 0 && t - s < M ? t - s : -1)
  const cols = ['var(--now)', 'var(--hit)', 'var(--f-tag)', 'var(--miss)']
  return (
    <Shell icon={Icn.chip} title="流水线并行 PP 原理"
      sub="看懂：按层切到多卡，用微批填掉流水线气泡">
      <Sec n={1} title="切法：把连续几层放一张卡，接成流水线">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>模型放不下一卡,除了切头(TP)、切专家(EP),还能<b>按层切</b>:卡0 算前几层→卡1 中间→…→卡G-1 最后,接成 G 级流水线。</span></div>
      </Sec>

      <Sec n={2} title="气泡：只喂 1 个 batch 时，同刻只 1 卡在忙">
        <div className="gd-graph">
          <svg viewBox="0 0 250 88" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {Array.from({ length: G }, (_, s) => (
              <g key={s}>
                <text x="6" y={22 + s * 16} fontSize="8" fill="var(--dim)">卡{s}</text>
                {Array.from({ length: T }, (_, t) => {
                  const v = cell(s, t)
                  return <rect key={t} x={26 + t * 26} y={14 + s * 16} width="22" height="12" rx="2"
                    fill={v >= 0 ? `color-mix(in srgb, ${cols[v % 4]} 55%, var(--panel))` : 'var(--panel-2)'}
                    stroke={v >= 0 ? cols[v % 4] : 'var(--line)'} strokeWidth="0.7" strokeDasharray={v >= 0 ? '0' : '2 1'} />
                })}
              </g>
            ))}
            <text x="26" y="86" fontSize="7" fill="var(--faint)">时间 →　彩=在算微批　虚线灰=气泡(空等)</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>把 batch 切 <b>M 个微批</b>首尾衔接流进来:稳态时 G 卡<b>同时</b>各算一个微批,气泡只剩开头注入 + 结尾排空,占比 <b>(G−1)/(M+G−1)</b>。微批越多气泡越小(M=4→43%、M=8→27%)。</span></div>
      </Sec>

      <Sec n={3} title="结论：微批填气泡，但有甜点">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>微批越多气泡越小</h4><p>开头注入、结尾排空的占比被摊薄,<em>利用率从 1/G 拉到接近 1</em>。</p></div>
          <div className="gd-card i"><h4>但别切太碎</h4><p>微批太小,单次算量太碎、划不来;<em>M 有个甜点</em>——这就是流水线调度要权衡的。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>和<b>指令流水线</b>同一个"填满流水线"的道理;和张量并行/专家并行是并行策略里不同的切法。GPipe/1F1B 就是干这个的。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '按层切成 G 级流水线' }, { cls: 'pd', text: '1 个 batch→同刻只 1 卡忙' },
          { cls: 'pi', text: '气泡 (G−1)/G' }, { cls: 'pt', text: '切 M 个微批首尾衔接' },
          { cls: 'ph', text: '气泡→(G−1)/(M+G−1),越小越好' },
        ]}
        why={<><b>为什么"流水线并行"是把大模型铺开的一条基本路,也是一道调度题:</b>按层切分最符合直觉——模型本来就是一层叠一层,把连续几层放到一张卡上,首尾接起来就是一条流水线。但天真地喂一个 batch,会暴露流水线的通病:数据要一级级顺序穿过,同一时刻只有一张卡在真正计算,其余都在等前面的结果,利用率掉到 1/G,大量算力空转成"气泡"。解法和真实工厂流水线、CPU 指令流水线如出一辙:把大 batch 拆成许多小微批,让它们像传送带上的零件一样首尾衔接地涌入,于是稳态时每一级都在同时处理不同的微批,气泡被压缩到只剩开头注满和结尾排空那一小段,占比 (G−1)/(M+G−1),微批越多越小。但微批也不能无限切碎,太小会让每次计算的规模不经济,所以存在一个甜点。理解了它,你就把"指令流水线—数据流水线—模型流水线"这条贯穿计算机体系结构的主线打通了,也看清了大模型分布式里 TP/PP/EP 各自在切什么、各自的代价在哪。</>} />
    </Shell>
  )
}

function EPDiagram() {
  return (
    <Shell icon={Icn.chip} title="专家并行 EP 原理"
      sub="看懂：MoE 的巨大专家分到多卡，代价是 all-to-all">
      <Sec n={1} title="背景：MoE 专家又多又大，单卡放不下">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>MoE 把巨大 FFN 换成 E 个专家,每 token 只挑少数几个算(稀疏激活):参数量爆大、算量不涨。但 E 个专家权重加起来<b>极大</b>,一张卡放不下。</span></div>
      </Sec>

      <Sec n={2} title="做法：专家分片 + all-to-all 派发">
        <div className="gd-graph">
          <svg viewBox="0 0 250 82" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="8" y="11" fontSize="8" fill="var(--faint)">token 路由挑专家</text>
            {[0, 1, 2, 3, 4].map(t => <rect key={t} x={8 + t * 16} y="15" width="12" height="10" rx="2" fill={t === 1 ? 'color-mix(in srgb,var(--miss) 18%,var(--panel))' : 'var(--panel)'} stroke="var(--line)" strokeWidth="0.6" />)}
            <text x="8" y="42" fontSize="8" fill="var(--now)">all-to-all 派到专家所在卡</text>
            {[0, 1, 2, 3].map(g => (
              <g key={g}>
                <rect x={8 + g * 58} y="46" width="50" height="24" rx="4" fill={g === 1 ? 'color-mix(in srgb,var(--miss) 10%,var(--panel))' : 'var(--panel)'} stroke={g === 1 ? 'var(--miss)' : 'var(--line)'} strokeWidth="0.8" />
                <text x={33 + g * 58} y="58" textAnchor="middle" fontSize="7.5" fill="var(--dim)">卡{g} · 专家{g * 2},{g * 2 + 1}</text>
                <text x={33 + g * 58} y="67" textAnchor="middle" fontSize="7" fill={g === 1 ? 'var(--miss)' : 'var(--faint)'}>{[2, 3, 1, 2][g]} token{g === 1 ? ' 过载' : ''}</text>
              </g>
            ))}
            <path d="M20 26 L36 46" stroke="var(--dim)" strokeWidth="0.5" opacity="0.5" />
            <path d="M24 26 L94 46" stroke="var(--dim)" strokeWidth="0.5" opacity="0.5" />
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>EP 把 E 个专家分到 G 卡(每卡 E/G 个)——省显存。代价:token 挑中的专家在别的卡,得 <b>all-to-all 派发</b>过去、算完收回;<b>热专家</b>被很多 token 挑中,那卡<b>过载</b>、别的闲。</span></div>
      </Sec>

      <Sec n={3} title="结论：专家用 EP、注意力用 DP">
        <div className="gd-lane">
          <div className="gd-card i"><h4>分片换显存</h4><p>巨大的专家权重摊到多卡,单卡放得下了;代价是 <em>all-to-all 通信</em>。</p></div>
          <div className="gd-card hit"><h4>要负载均衡</h4><p>热专家会让一张卡过载,靠<em>限容量 + 辅助损失</em>把 token 摊匀。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它坐在 MoE(专家路由)和集合通信(all-to-all)之上;和「DP Attention」是一对搭档——<b>DP-attn + EP</b> 是现代 MoE 服务的常用组合。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'MoE:E 个专家、稀疏激活' }, { cls: 'pd', text: '专家加起来太大' },
          { cls: 'pi', text: 'EP 分片到 G 卡' }, { cls: 'pt', text: 'all-to-all 派 token 到专家卡' },
          { cls: 'ph', text: '省显存,代价=通信+负载不均' },
        ]}
        why={<><b>为什么"专家并行 EP"是 MoE 大模型能跑起来的关键:</b>MoE 用稀疏激活把参数量推到万亿级,而每个 token 只碰少数几个专家,算量却不怎么涨——这是大模型规模化的一条重要路线。但天下没有免费的午餐:海量的专家权重根本塞不进一张卡,必须分片。EP 就是把专家摊到多张卡上,于是显存问题解决了,却带来两个新麻烦。一是通信:token 想用的专家常常在别的卡上,得靠 all-to-all 把 token 先派过去、算完再收回来,而 all-to-all 是最重的集合通信之一。二是负载:路由是数据决定的,某些"热"专家会被格外多的 token 选中,承载它的那张卡就过载、别的卡空转,所以必须用容量上限和辅助均衡损失把流量摊匀。理解了这套取舍,你就看懂了为什么现代 MoE 服务要把"注意力用 DP(便宜、零通信)、专家用 EP(分片、all-to-all)"混着搭——本质是同一条原则:看清哪块权重大、哪种通信贵,再把有限的显存和带宽花在最值得的地方。</>} />
    </Shell>
  )
}

function DPAttnDiagram() {
  return (
    <Shell icon={Icn.chip} title="DP Attention 原理"
      sub="看懂：多卡服务时，注意力按请求切、零通信">
      <Sec n={1} title="两种切法：切头 vs 切请求">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>一批请求要摊到 G 张卡上算注意力。<b>TP 切头</b>:每卡分几个头、算全部请求;<b>DP 切请求</b>:每卡拿全部头、只算几个请求。权衡完全不同。</span></div>
      </Sec>

      <Sec n={2} title="TP 每层通信 vs DP 零通信">
        <div className="gd-graph">
          <svg viewBox="0 0 250 84" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="8" y="11" fontSize="8" fill="var(--miss)">TP 切头 → 每层 all-reduce</text>
            {[0, 1, 2, 3].map(g => (
              <g key={g}>
                <rect x={8 + g * 30} y="16" width="26" height="16" rx="3" fill="var(--panel)" stroke="var(--miss)" strokeWidth="0.8" />
                <text x={21 + g * 30} y="27" textAnchor="middle" fontSize="7" fill="var(--dim)">头{g}</text>
              </g>
            ))}
            <path d="M20 34 Q68 44 116 34" fill="none" stroke="var(--miss)" strokeWidth="0.8" markerEnd="url(#dpa)" />
            <text x="68" y="46" textAnchor="middle" fontSize="7" fill="var(--miss)">all-reduce 拼头(每层)</text>
            <text x="8" y="60" fontSize="8" fill="var(--now)">DP 切请求 → 零通信</text>
            {[0, 1, 2, 3].map(g => (
              <g key={g}>
                <rect x={8 + g * 30} y="64" width="26" height="16" rx="3" fill="color-mix(in srgb,var(--now) 12%,var(--panel))" stroke="var(--now)" strokeWidth="0.8" />
                <text x={21 + g * 30} y="75" textAnchor="middle" fontSize="6.5" fill="var(--dim)">全头·请求{g}</text>
              </g>
            ))}
            <text x="150" y="75" fontSize="8" fill="var(--now)">各卡独立算完 ✓</text>
            <defs><marker id="dpa" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 L5 3 L0 6" fill="var(--miss)" /></marker></defs>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span><b>TP</b>:每卡只有一部分头,算完得每层 all-reduce 拼回来——省权重显存(1/G),但每层通信。<b>DP</b>:每卡拿全部头、只管自己的请求,注意力这段<b>零通信</b>——代价是权重整套复制。</span></div>
      </Sec>

      <Sec n={3} title="结论：注意力用 DP、专家用 EP">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>注意力权重小</h4><p>复制得起,所以用 DP <em>避开每层昂贵的 all-reduce</em>——通信是分布式里最贵的一环。</p></div>
          <div className="gd-card i"><h4>专家权重大 → EP</h4><p>MoE 的专家巨大,才真需要切;<em>DP Attention + EP</em> 是现代 MoE 服务(DeepSeek)的常用组合。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它坐在张量并行(切头)和集合通信(all-reduce)之上;要义是"<b>哪块权重大、哪块通信贵</b>",并行策略跟着走,不一刀切。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'G 卡服务一批请求' }, { cls: 'pd', text: 'TP 切头→每层 all-reduce' },
          { cls: 'pi', text: 'DP 切请求→零通信' }, { cls: 'pt', text: '注意力权重小可复制' },
          { cls: 'ph', text: 'DP-attn + EP:通信花刀刃' },
        ]}
        why={<><b>为什么"DP Attention"体现了分布式推理的精髓——通信要花在刀刃上:</b>把一个大模型铺到多张卡上,最贵的往往不是算,而是卡与卡之间的通信。张量并行把注意力的头切开分到各卡,虽然省了权重显存,但每一层都得做一次 all-reduce 把切散的头拼回来,通信开销随层数累积。DP Attention 反其道而行:注意力的权重本来就不大,那就干脆整套复制到每张卡,改成按请求切分——每张卡独立算完自己那批请求,注意力这一段一次通信都不用。省下来的通信预算,留给真正巨大、真正需要切分的 MoE 专家权重(用专家并行 EP)。这一取舍背后是一条通用原则:并行策略不能一刀切,要看每块权重多大、每种切法的通信多贵,再把有限的通信预算花在最值得的地方。理解了它,你就看懂了 DeepSeek 这类 MoE 大模型为什么用"DP 注意力 + EP 专家"的混合并行,以及分布式系统设计里"计算便宜、通信昂贵"这条铁律。</>} />
    </Shell>
  )
}

function FlashDecodeDiagram() {
  return (
    <Shell icon={Icn.chip} title="Flash Decode 原理"
      sub="看懂：解码时切开长 KV 并行，压低时延">
      <Sec n={1} title="痛点：decode 只有 1 个 query，切 query 白搭">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>FlashAttention 在 prefill 按 <b>query</b> 切块并行(几百上千 query 一起算、GPU 吃得饱)。可 decode 每步<b>只有 1 个 query</b>、却要扫一长串 KV——只切 query 就 1 份活、GPU 闲着，时延被长 KV 拖住。</span></div>
      </Sec>

      <Sec n={2} title="办法：改切 KV，C 块并行 + 无损合并">
        <div className="gd-graph">
          <svg viewBox="0 0 250 78" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="8" y="11" fontSize="8" fill="var(--faint)">1 query 对 长 KV：切 4 块并行</text>
            {[0, 1, 2, 3].map(c => (
              <g key={c}>
                <rect x={10 + c * 44} y="18" width="38" height="18" rx="3" fill={`color-mix(in srgb, ${['var(--now)', 'var(--hit)', 'var(--f-tag)', 'var(--miss)'][c]} 20%, var(--panel))`} stroke={['var(--now)', 'var(--hit)', 'var(--f-tag)', 'var(--miss)'][c]} strokeWidth="0.8" />
                <text x={29 + c * 44} y="30" textAnchor="middle" fontSize="7.5" fill="var(--ink)">块{c + 1}</text>
                <path d={`M${29 + c * 44} 36 L125 52`} stroke="var(--dim)" strokeWidth="0.5" opacity="0.5" />
              </g>
            ))}
            <text x="90" y="47" fontSize="7" fill="var(--faint)">各算局部 mᶜ/lᶜ/oᶜ（同时）</text>
            <rect x="95" y="52" width="60" height="16" rx="4" fill="color-mix(in srgb,var(--now) 12%,var(--panel))" stroke="var(--now)" strokeWidth="1" />
            <text x="125" y="63" textAnchor="middle" fontSize="8" fill="var(--ink)">online softmax 合并</text>
            <text x="165" y="63" fontSize="8" fill="var(--hit)">= 精确 ✓</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>把长 KV 切 C 块，<b>并行</b>各算一份局部注意力(mᶜ/lᶜ/oᶜ)，再用 <b>online softmax</b>(拿全局最大 M 重缩放各块 exp)无损合并。时延从顺序 ~N 降到并行 <b>~N/C</b>，结果和一次性 softmax <b>完全相等</b>。</span></div>
      </Sec>

      <Sec n={3} title="结论：prefill 切 query、decode 切 KV">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>解码提速</h4><p>时延 ~N → ~N/C，长上下文生成不再被一条长 KV 拖住——<em>切得越多降得越多</em>。</p></div>
          <div className="gd-card i"><h4>无损，不是近似</h4><p>合并公式和 <em>FlashAttention 同源</em>，只是把并行维从 query 换成了 KV。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它坐在 FlashAttention(online softmax)和 KV 缓存之上;是推理引擎压低生成时延(尤其长上下文)的关键一招。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'decode:1 query 对长 KV' }, { cls: 'pd', text: '切 query 白搭(只 1 份)' },
          { cls: 'pi', text: '改切 KV 成 C 块' }, { cls: 'pt', text: 'C 块并行算局部' },
          { cls: 'ph', text: 'online softmax 无损合并,~N/C' },
        ]}
        why={<><b>为什么"Flash Decode"是长上下文解码的一把关键钥匙:</b>大模型生成是逐 token 的,每生成一个新 token,都要拿这一个新 query 去和前面成千上万个 KV 做注意力。FlashAttention 那套按 query 并行的招在这里失灵了——因为 decode 每步只有一个 query,并行度只有 1,再长的 KV 也只能一个 GPU 慢慢扫,时延随上下文线性恶化。Flash Decode 的洞见是把并行的维度从 query 换到 KV:既然要扫的 KV 很长,那就把它切成若干段,让多个计算单元同时各算一段的局部注意力,最后用 online softmax 这套"带全局最大值重缩放"的合并规则把局部结果无损地拼回全局答案。于是解码时延从 ~N 压到 ~N/C,而且结果和一次性精确 softmax 分毫不差。理解了它,你就看懂了"prefill 和 decode 要用不同的并行切法"这个推理引擎里的核心工程直觉,以及为什么长上下文推理能做到既准又快。</>} />
    </Shell>
  )
}

function EngramDiagram() {
  const rows = [['A B', 'C'], ['B C', 'D'], ['C D', 'A'], ['D A', 'B']]
  return (
    <Shell icon={Icn.tag} title="Engram · n-gram 记忆原理"
      sub="看懂：用一张便宜的查表增强 Transformer">
      <Sec n={1} title="痛点：注意力回头看，又贵又受窗口限制">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>很多「回头看」其实是<b>重复模式的精确复制</b>(某个词组后总跟同一个词)。用整套 O(N²) 注意力去做太浪费,而且相关信息一旦超出窗口就看不到。</span></div>
      </Sec>

      <Sec n={2} title="办法：n-gram 存成表，O(1) 查">
        <div className="gd-graph">
          <svg viewBox="0 0 250 78" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="8" y="11" fontSize="8.5" fill="var(--faint)">前缀 → 下一个 (记忆表)</text>
            {rows.map((r, k) => (
              <g key={k}>
                <rect x="8" y={16 + k * 14} width="150" height="12" rx="2" fill={r[0] === 'B C' ? 'color-mix(in srgb,var(--now) 14%,var(--panel))' : 'var(--panel)'} stroke={r[0] === 'B C' ? 'var(--now)' : 'var(--line)'} strokeWidth="0.7" />
                <text x="14" y={25 + k * 14} fontSize="8.5" fill="var(--dim)" fontFamily="var(--mono)">「{r[0]}」</text>
                <text x="92" y={25 + k * 14} fontSize="8.5" fill="var(--faint)">→</text>
                <text x="104" y={25 + k * 14} fontSize="9" fill="var(--ink)" fontWeight="bold">{r[1]}</text>
                {r[0] === 'B C' && <text x="163" y={25 + k * 14} fontSize="8" fill="var(--now)">← 查「B C」命中</text>}
              </g>
            ))}
            <text x="8" y="76" fontSize="8" fill="var(--now)">O(1) 查表 → 预测 D，没动注意力</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>把出现过的 n-gram 存成哈希表(键=前 n−1 个 token,值=下一个的计数)。推理时用当前 (n−1)-gram <b>O(1) 查表</b>,拿到「历次它后面跟了什么」——常数时间、<b>不受注意力窗口限制</b>。</span></div>
      </Sec>

      <Sec n={3} title="定位：和归纳头一体两面">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>卸载精确复制</h4><p>把「重复模式的复制」从贵的注意力挪到便宜的查表,<em>让注意力去干更难的语义活</em>。</p></div>
          <div className="gd-card i"><h4>vs 归纳头</h4><p>目标一样(回头找「上次它之后」);<em>归纳头=学出来的软注意力(贵)、Engram=显式查表(便宜)</em>,互补。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它坐在哈希(O(1) 查)、BPE(同按 n-gram 统计)之上;是「n-gram 记忆增强 Transformer」、长上下文省算力的一条路。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '重复模式=精确复制' }, { cls: 'pd', text: '存成 n-gram 表' },
          { cls: 'pi', text: '当前前缀 O(1) 查表' }, { cls: 'pt', text: '拿到历次它之后的 token' },
          { cls: 'ph', text: '便宜补全,不受窗口限制' },
        ]}
        why={<><b>为什么「n-gram 记忆」是给注意力减负的聪明一招:</b>注意力之所以贵,是因为它对每个位置都做全局的、可学习的软检索——这在处理语义、消歧时不可替代,但拿它去干「这个词组后面照例跟哪个词」这种纯粹的精确复制,就是杀鸡用牛刀,还白白受制于上下文窗口。Engram 把这类确定性的、可精确匹配的模式抽出来,交给一张朴素的 n-gram 哈希表:键是前缀、值是历次的后继,查一次是常数时间,而且只要那个 n-gram 在历史里出现过——哪怕在几万 token 之前——就能命中。于是模型得到一条便宜、无限回溯的记忆旁路,注意力则腾出算力去处理真正需要理解的部分。它和归纳头恰好互补:一个是学出来的软注意力、表达力强,一个是显式的硬查表、便宜且精确。理解了它,你就看懂了现代推理引擎为什么爱用各种「记忆/缓存/检索」模块去卸载注意力的负担——省下来的每一分算力,在长上下文里都是真金白银。</>} />
    </Shell>
  )
}

function LinAttnDiagram() {
  return (
    <Shell icon={Icn.chip} title="线性注意力原理"
      sub="看懂：把 O(N²) 压成 O(N)、KV 缓存压成常数">
      <Sec n={1} title="病：softmax 注意力 O(N²) + KV 缓存膨胀">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>softmax(QKᵀ)V 要算 N×N 矩阵——<b>算量 O(N²)</b>;自回归还要缓存每个 token 的 K/V——<b>KV 缓存 O(N)</b>、随上下文线性膨胀。上下文一长，算量和显存双双爆。</span></div>
      </Sec>

      <Sec n={2} title="药：结合律重排 → 固定状态">
        <div className="gd-graph">
          <svg viewBox="0 0 250 74" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="62" y="12" textAnchor="middle" fontSize="8.5" fill="var(--miss)">softmax(QKᵀ)·V</text>
            <rect x="20" y="20" width="34" height="34" rx="3" fill="none" stroke="var(--miss)" strokeWidth="1.2"/>
            <text x="37" y="41" textAnchor="middle" fontSize="8" fill="var(--miss)">N×N</text>
            <text x="37" y="66" textAnchor="middle" fontSize="7" fill="var(--faint)">先算它 = O(N²)</text>
            <text x="125" y="38" fontSize="11" fill="var(--faint)">→</text>
            <text x="192" y="12" textAnchor="middle" fontSize="8.5" fill="var(--now)">φ(Q)·(φ(K)ᵀ·V)</text>
            <rect x="168" y="26" width="20" height="20" rx="3" fill="color-mix(in srgb,var(--now) 18%,var(--panel))" stroke="var(--now)" strokeWidth="1.2"/>
            <text x="178" y="39" textAnchor="middle" fontSize="7.5" fill="var(--ink)">d×d</text>
            <text x="192" y="60" textAnchor="middle" fontSize="7" fill="var(--now)">先算括号 = 固定状态</text>
            <text x="221" y="39" fontSize="9" fill="var(--faint)">×φ(Q)</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>换核函数 φ，把 softmax(QKᵀ)V 近似成 φ(Q)·(φ(K)ᵀV)。<b>利用结合律先算括号里的 φ(K)ᵀV</b>——它是一个 <b>d×d 的固定状态</b>，概括了全部历史。于是算量 <b>O(N·d²)</b>、随 N 线性;状态 <b>O(d²)</b> 恒定。</span></div>
      </Sec>

      <Sec n={3} title="果：常数显存 · RNN 式递推解码">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>告别膨胀 KV 缓存</h4><p>状态固定 d×d、和上下文多长无关——<em>解码变 RNN 式递推</em>，每步更新固定状态、O(1)/步、常数显存。</p></div>
          <div className="gd-card i"><h4>交叉点在 N=d</h4><p>N 短时 softmax 反而省(线性有 d² 常数);<em>N 一长线性完胜</em>——N=32768 算量差 512×、显存差 1000×。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>代价:φ 只是 softmax 的近似,拿一点精度换算量与显存。Mamba、RWKV、GLA 这些"线性/状态空间"模型吃超长上下文,底子就是它。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'softmax(QKᵀ)V=O(N²)' }, { cls: 'pd', text: 'KV 缓存随 N 膨胀' },
          { cls: 'pi', text: '换 φ→φ(Q)(φ(K)ᵀV)' }, { cls: 'pt', text: '结合律:先算 d×d 状态' },
          { cls: 'ph', text: 'O(N)+常数显存,RNN 递推' },
        ]}
        why={<><b>为什么"线性注意力"是长上下文推理的一条关键路线:</b>标准注意力的强大来自 softmax 让每个 token 都能直接看到所有其他 token,但也正是这个全连接带来了 O(N²) 的算量和随长度膨胀的 KV 缓存,把上下文长度死死卡住。线性注意力的洞见是:如果放弃精确的 softmax、改用一个可分解的核函数 φ,那么"每个查询看所有键"这件事就能用结合律重新组织——先把所有键值压成一个固定大小的 d×d 状态,再让查询去读它。代价是近似、收益是量级:算量从平方降到线性,显存从随长度增长降到恒定,解码退化成一个 RNN 式的常数内存递推。这正是 Mamba、RWKV、RetNet、GLA 这一整代"线性/状态空间"模型的共同底座,也是推理引擎能把上下文推到几十万、上百万 token 的工程支点之一。理解了它,你就看懂了"注意力的二次瓶颈"到底卡在哪、以及绕过它要付出什么代价。</>} />
    </Shell>
  )
}

function CondNumDiagram() {
  return (
    <Shell icon={Icn.ruler} title="条件数原理"
      sub="看懂：为什么「病态」的问题又慢又难算">
      <Sec n={1} title="定义：最陡方向 vs 最平方向的比">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>条件数 κ = 最大曲率 / 最小曲率。它衡量损失碗有多"不圆":<b>κ=1 是正圆,κ 大是又细又长的椭圆</b>。κ 越大,问题越病态。</span></div>
      </Sec>

      <Sec n={2} title="现象：正圆一步到位,扁椭圆之字形爬">
        <div className="gd-graph">
          <svg viewBox="0 0 250 74" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 正圆 κ=1 */}
            <circle cx="52" cy="38" r="24" fill="none" stroke="color-mix(in srgb,var(--f-tag) 45%,transparent)" strokeWidth="0.8" />
            <circle cx="52" cy="38" r="14" fill="none" stroke="color-mix(in srgb,var(--f-tag) 45%,transparent)" strokeWidth="0.8" />
            <line x1="72" y1="20" x2="52" y2="38" stroke="var(--hit)" strokeWidth="1.6" markerEnd="url(#cn-a)" />
            <circle cx="52" cy="38" r="2" fill="var(--miss)" />
            <text x="52" y="70" textAnchor="middle" fontSize="8.5" fill="var(--hit)">κ=1 · 1 步</text>
            {/* 扁椭圆 κ 大 */}
            <ellipse cx="185" cy="38" rx="48" ry="12" fill="none" stroke="color-mix(in srgb,var(--f-tag) 45%,transparent)" strokeWidth="0.8" />
            <ellipse cx="185" cy="38" rx="30" ry="7.5" fill="none" stroke="color-mix(in srgb,var(--f-tag) 45%,transparent)" strokeWidth="0.8" />
            <polyline points="225,30 175,46 205,34 182,42 195,37 187,40" fill="none" stroke="var(--now)" strokeWidth="1.4" />
            <circle cx="185" cy="38" r="2" fill="var(--miss)" />
            <text x="185" y="70" textAnchor="middle" fontSize="8.5" fill="var(--now)">κ=50 · 116 步(之字形)</text>
            <defs><marker id="cn-a" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 L5 3 L0 6" fill="var(--hit)" /></marker></defs>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>正圆碗:梯度直指圆心,一步到位。扁椭圆:梯度几乎垂直于"通往谷底"的方向,陡方向迈过头、平方向挪不动,只能<b>之字形</b>慢挪。每步误差只缩 <b>(κ−1)/(κ+1)</b>,κ 大→接近 1→几乎不降。</span></div>
      </Sec>

      <Sec n={3} title="对策：把 κ 拉回接近 1">
        <div className="gd-lane">
          <div className="gd-card i"><h4>归一化/预处理</h4><p>把各特征缩放到同量级,<em>让碗变圆</em>——这就是为什么训练前要标准化输入。</p></div>
          <div className="gd-card hit"><h4>Adam 等自适应法</h4><p>给每个方向<em>不同的有效步长</em>,相当于自动补偿条件数,病态方向也走得动。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它是「梯度下降」里 y 方向震荡的深层原因;数值线代里 κ 大还意味着方程组病态、解对噪声极敏感。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'κ=最陡/最平曲率比' }, { cls: 'pd', text: 'κ=1 正圆→一步到位' },
          { cls: 'pi', text: 'κ 大→细长椭圆' }, { cls: 'pt', text: '梯度偏离谷底,之字形' },
          { cls: 'ph', text: '归一化/Adam 拉回 κ→1' },
        ]}
        why={<><b>为什么"条件数"是优化与数值计算的隐形主角:</b>它用一个数,概括了一个问题到底"好不好算"。几何上,条件数就是损失碗的圆扁程度;圆(κ=1)则梯度一步指向谷底,扁(κ 大)则梯度几乎和谷底方向垂直,只能来回横跳、缓慢逼近。梯度下降每步能把误差缩小的比例正是 (κ−1)/(κ+1),κ 一大这个比例就贴近 1,收敛慢得让人绝望。这解释了训练里许多现象:为什么要做特征归一化和批归一化(把碗弄圆)、为什么 Adam 这类自适应方法有效(给每个方向配不同步长、等效于降低条件数)、为什么某些损失面天生难训。它还跨界到数值线代:条件数大的方程组是"病态"的,输入一点噪声,解就天翻地覆。掌握了条件数,你就有了一把判断"这个优化/求解问题好不好搞"的通用尺子。</>} />
    </Shell>
  )
}

function MaxEntDiagram() {
  const uni = [1,1,1,1,1,1]
  const skew = [.05,.09,.13,.18,.25,.35]
  const bars = (v:number[], x0:number, c:string, mx:number) => v.map((p,k)=>
    <rect key={k} x={x0+k*13} y={34-p/mx*26} width="10" height={p/mx*26} fill={c} opacity="0.8" rx="1.5" />)
  return (
    <Shell icon={Icn.bulb} title="最大熵原理"
      sub="看懂：softmax / 玻尔兹曼分布凭什么「天生合理」">
      <Sec n={1} title="原则：约束之内,选最不武断的分布">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>在所有满足你已知约束的分布里,选<b>熵最大</b>的那个——对没被约束的部分不做任何多余假设,最诚实。你只承诺你知道的,其余保持最大的不确定。</span></div>
      </Sec>

      <Sec n={2} title="现象：信息越多,最大熵分布越集中">
        <div className="gd-graph">
          <svg viewBox="0 0 250 52" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="42" y="10" textAnchor="middle" fontSize="8.5" fill="var(--hit)">无约束 → 均匀</text>
            {bars(uni, 12, 'var(--hit)', 1)}
            <text x="42" y="49" textAnchor="middle" fontSize="7.5" fill="var(--faint)">熵到顶 2.585</text>
            <text x="150" y="30" fontSize="12" fill="var(--faint)">→</text>
            <text x="205" y="10" textAnchor="middle" fontSize="8.5" fill="var(--now)">给"均值偏大" → 偏</text>
            {bars(skew, 175, 'var(--now)', .35)}
            <text x="205" y="49" textAnchor="middle" fontSize="7.5" fill="var(--faint)">熵降到 1.375</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>没有额外信息时,最大熵=<b>均匀</b>(不偏袒任何一面)。加一条"期望值偏大"的约束,分布被迫往大数偏、熵下降——但它仍是<b>满足该约束里熵最高</b>、最不武断的那个。</span></div>
      </Sec>

      <Sec n={3} title="结论：softmax 就是最大熵解">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>形式必是指数族</h4><p>给"期望值"约束,最大熵解可证恒为 <em>p∝e^(λ·特征)</em>——给期望能量约束就是 <em>softmax/玻尔兹曼</em>。</p></div>
          <div className="gd-card i"><h4>不是随手一挑</h4><p>softmax、逻辑回归、玻尔兹曼机,都是"约束下最大熵"推出来的<em>唯一答案</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>温度控制的正是熵:高温=更均匀(更大熵)、低温=更尖(更小熵)。它和交叉熵、softmax 是一家。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '已知若干约束' }, { cls: 'pd', text: '选熵最大的分布' },
          { cls: 'pi', text: '=对未知不做多余假设' }, { cls: 'pt', text: '解恒为指数族 e^(λ·特征)' },
          { cls: 'ph', text: '期望能量约束→softmax' },
        ]}
        why={<><b>为什么"最大熵"是从统计到深度学习的一条脊梁:</b>它回答了一个哲学味很浓却极其实用的问题——当你只知道部分信息,该假设一个什么样的概率分布才算"公正"?最大熵原理给出干净的答案:选熵最大的那个,因为它恰好只编码了你确知的约束,对其余一切保持最大的不确定,不夹带任何私货。这个原则的数学结论异常漂亮:任何"给定若干期望值约束"的最大熵分布,形式必然是指数族;而最常见的"给定期望能量"约束,解就是 softmax/玻尔兹曼分布。于是深度学习里 softmax 的普遍存在不再是巧合或习惯,而是"最少假设"这一诚实原则的必然产物;逻辑回归、玻尔兹曼机、乃至物理里的吉布斯分布,都从这同一个原理里长出来。理解了它,你看 softmax、温度、交叉熵时,会从"公式记忆"升级到"知道它们为什么非如此不可"。</>} />
    </Shell>
  )
}

function JLDiagram() {
  // 距离比点，随 K 增大挤向 1
  const k16 = [.72,.85,1.31,1.15,.9,1.22,.78,1.08]
  const k128 = [.95,1.02,1.08,.93,1.0,1.06,.97,1.04]
  const LO=0.6,HI=1.4,W=200,ox=26
  const X=(r:number)=>ox+(r-LO)/(HI-LO)*W
  return (
    <Shell icon={Icn.ruler} title="JL 引理 / 随机投影原理"
      sub="看懂：高维压到低维，为什么还能保住「谁离谁近」">
      <Sec n={1} title="问题：几百维能压到几十维吗">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>嵌入动辄几百上千维,存算都贵。能不能压到几十维、还不破坏"谁离谁近"的几何?JL 引理说:<b>能,一个随机线性投影就行</b>。</span></div>
      </Sec>

      <Sec n={2} title="现象：K 越大,距离比越挤向 1">
        <div className="gd-graph">
          <svg viewBox="0 0 250 74" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <line x1={ox} y1="24" x2={ox+W} y2="24" stroke="var(--line)" strokeWidth="0.6" />
            <line x1={X(1)} y1="18" x2={X(1)} y2="60" stroke="var(--hit)" strokeWidth="1" strokeDasharray="3 2" />
            <text x={X(1)} y="70" textAnchor="middle" fontSize="8" fill="var(--hit)">1.0 完全保距</text>
            <text x={ox-4} y="18" textAnchor="end" fontSize="8" fill="var(--miss)">K=16</text>
            {k16.map((r,i)=><circle key={i} cx={X(r)} cy="18" r="2.6" fill="var(--miss)" opacity="0.7" />)}
            <text x={ox-4} y="40" textAnchor="end" fontSize="8" fill="var(--now)">K=128</text>
            {k128.map((r,i)=><circle key={i} cx={X(r)} cy="40" r="2.6" fill="var(--now)" />)}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>每个点是"一对点的低维距离÷高维距离"。K=16 时散(偏差~31%),K=128 时全挤到 1 附近(偏差~11%)。<b>投影维度越大,距离保得越准</b>,平均比≈1。</span></div>
      </Sec>

      <Sec n={3} title="结论：所需维度与原维度无关">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>k ~ O(log N / ε²)</h4><p>要多少投影维,<em>只跟点数 N 和精度 ε 有关</em>——不管原来 500 维还是 5 万维,都压到同样几十维。</p></div>
          <div className="gd-card i"><h4>随机就够好</h4><p>不用精心设计,一个<em>高斯随机矩阵</em>大概率就保住距离——高维的祝福,不是诅咒。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>随机投影降维、近似最近邻(ANN)、特征哈希都靠它;它和 LoRA/低秩、高维近正交一家——高维很"空"、可压。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'N 个高维点' }, { cls: 'pd', text: '随机投影到 K 维' },
          { cls: 'pi', text: '两两距离保持 (1±ε)' }, { cls: 'pt', text: 'K~O(log N/ε²)' },
          { cls: 'ph', text: '与原维度 D 无关' },
        ]}
        why={<><b>为什么"JL 引理"是高维数据处理的定心丸:</b>它回答了一个让人不敢相信的问题——能不能在几乎不损失几何信息的前提下,把超高维数据狠狠压扁?答案是能,而且方法简单到近乎作弊:乘一个随机矩阵。JL 保证,只要目标维度达到 O(log N/ε²),所有点对之间的距离都被保持在 (1±ε) 倍以内。最震撼的是这个维度<b>和原始维度完全无关</b>,只取决于你有多少个点、想要多准。这把"维度灾难"翻转成了"维度的祝福":高维空间极其空旷,信息其实塞得很松,可以大幅压缩而结构不塌。正因如此,近似最近邻搜索、特征哈希、随机投影降维这些工程手段才敢放心用;它也和低秩近似(LoRA)、高维近正交讲的是同一件事——高维里"少数维度就够表达大部分结构"。理解了它,你对"嵌入维度该开多大""能不能降维加速"这类问题就有了底气。</>} />
    </Shell>
  )
}

function GreedyDiagram() {
  return (
    <Shell icon={Icn.doc} title="贪心算法原理"
      sub="看懂：「每步拿最好」什么时候能=全局最优">
      <Sec n={1} title="策略：每步拿当下最好的,不回头">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>贪心又快又直觉。但它<b>不总对</b>:只有问题具备"贪心选择性质"(局部最优拼成全局最优)时才保证最优,否则可能次优。</span></div>
      </Sec>

      <Sec n={2} title="反例：找零 {1,3,4} 凑 6">
        <div className="gd-graph">
          <svg viewBox="0 0 250 76" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="8" y="14" fontSize="9" fill="var(--miss)">贪心:每步拿最大</text>
            {[4,1,1].map((c,k)=>(<g key={k}><circle cx={26+k*30} cy="34" r="11" fill="color-mix(in srgb,var(--miss) 22%,var(--panel))" stroke="var(--miss)" /><text x={26+k*30} y="38" textAnchor="middle" fontSize="10" fill="var(--ink)">{c}</text></g>))}
            <text x="116" y="38" fontSize="11" fill="var(--miss)">= 3 枚</text>
            <text x="8" y="60" fontSize="9" fill="var(--hit)">最优(DP):</text>
            {[3,3].map((c,k)=>(<g key={k}><circle cx={70+k*30} cy="60" r="11" fill="color-mix(in srgb,var(--now) 22%,var(--panel))" stroke="var(--now)" /><text x={70+k*30} y="64" textAnchor="middle" fontSize="10" fill="var(--ink)">{c}</text></g>))}
            <text x="116" y="64" fontSize="11" fill="var(--hit)">= 2 枚 ✓</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>贪心先拿最大的 4(剩 2),再拿 1、1 → <b>3 枚</b>。可最优是 3+3 = <b>2 枚</b>!"先拿了 4"这个局部最优,把 3+3 那条更省的路堵死了。</span></div>
      </Sec>

      <Sec n={3} title="结论：对不对取决于问题结构">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>贪心对的场合</h4><p>哈夫曼、Dijkstra、最小生成树——这些问题<em>具备贪心选择性质</em>,局部最优拼得成全局最优。</p></div>
          <div className="gd-card i"><h4>贪心错的场合</h4><p>找零这种币制不具备,就得用<em>动态规划</em>枚举子问题,才能保证最优。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>关键判断:<b>贪心对不对,取决于问题结构,不取决于它跑得快</b>。它和「动态规划」正好是一对照。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '每步拿当下最好的' }, { cls: 'pd', text: '不回头' },
          { cls: 'pi', text: '有贪心选择性质→最优' }, { cls: 'pt', text: '没有→可能次优' },
          { cls: 'ph', text: '找零 3枚 vs 最优 2枚' },
        ]}
        why={<><b>为什么"贪心"是每个学算法的人必须建立的一层判断力:</b>贪心策略太诱人了——它简单、快、几乎总能给出一个"看起来不错"的解,于是人们容易默认它就是对的。但它是一把有条件的钥匙:只有当问题具备"贪心选择性质"(每一步的局部最优不会牺牲全局最优)时,它才保证正确。哈夫曼编码、Dijkstra、最小生成树恰好满足,所以它们放心用贪心;而找零这种问题不满足,贪心就会被眼前的最大币带偏、错过真正最省的组合。这个反例的价值,是让你养成一种警觉:遇到贪心解,先问"这个问题凭什么保证局部最优能拼成全局最优?"。答不上来,就得退回动态规划这类会"通盘考虑子问题"的方法。学会区分"贪心能用"和"贪心会错",是从写得出算法到写得对算法的一道分水岭。</>} />
    </Shell>
  )
}

function DotSimDiagram() {
  const OX=44, OY=42, SC=13
  const X=(x:number)=>OX+x*SC, Y=(y:number)=>OY-y*SC
  return (
    <Shell icon={Icn.ruler} title="内积=相似度原理"
      sub="看懂：注意力凭什么用 Q·K 打分">
      <Sec n={1} title="式子：a·b = |a||b|cosθ">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>内积同时编码<b>长度</b>和<b>夹角</b>。长度固定时,它就纯粹量"<b>方向多一致</b>":同向最大、正交为 0、反向最负。</span></div>
      </Sec>

      <Sec n={2} title="几何：内积 = |a| × b 在 a 上的投影">
        <div className="gd-graph">
          <svg viewBox="0 0 250 84" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {[[0,'同向',6,'var(--hit)'],[90,'正交',0,'var(--dim)'],[150,'钝角',-5.2,'var(--miss)']].map(([deg,lab,dot,c],idx)=>{
              const r=(deg as number)*Math.PI/180, bx=2*Math.cos(r), by=2*Math.sin(r)
              const cx=OX+idx*70
              return <g key={idx} transform={`translate(${idx*70},0)`}>
                <line x1={OX} y1={OY} x2={OX} y2={OY} />
                <line x1={OX} y1={OY} x2={OX+3*SC*0.85} y2={OY} stroke="var(--dim)" strokeWidth="1.6" markerEnd="url(#dsg)" />
                <line x1={OX} y1={OY} x2={OX+bx*SC*0.85} y2={OY-by*SC*0.85} stroke="var(--now)" strokeWidth="1.6" markerEnd="url(#dsg2)" />
                <text x={OX+18} y={OY+16} textAnchor="middle" fontSize="8.5" fill={c as string}>{lab as string}</text>
                <text x={OX+18} y={OY+27} textAnchor="middle" fontSize="8" fill="var(--faint)">a·b={dot as number}</text>
              </g>
            })}
            <defs>
              <marker id="dsg" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 L5 3 L0 6" fill="var(--dim)" /></marker>
              <marker id="dsg2" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 L5 3 L0 6" fill="var(--now)" /></marker>
            </defs>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>把 b 投影到 a 上,内积就等于 |a| 乘这个投影长度。b 越倒向 a 投影越长、内积越大;垂直时投影为 0、内积为 0;转过去投影变负、内积变负。归一化就是余弦相似度 ∈[−1,1]。</span></div>
      </Sec>

      <Sec n={3} title="用处：这就是 Q·K 打分">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>相关→分数高</h4><p>query 与 key 方向越一致(语义越相关),<em>内积越大</em>、softmax 后注意力权重越高。</p></div>
          <div className="gd-card i"><h4>无关→≈0</h4><p>无关的方向几乎正交,<em>内积≈0</em>——正接「高维近正交」,所以打分能干净地区分相关与否。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>检索、推荐、词向量类比(king−man+woman≈queen),底层都是这把"内积=相似度"的尺子。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'a·b=|a||b|cosθ' }, { cls: 'pd', text: '长度固定→量方向' },
          { cls: 'pi', text: '同向大/正交0/反向负' }, { cls: 'pt', text: '归一化=余弦相似度' },
          { cls: 'ph', text: 'Q·K 打分=相关度' },
        ]}
        why={<><b>为什么"内积=相似度"是注意力的几何底座:</b>注意力看似神秘,核心动作却极简单——拿 query 和每个 key 做内积当分数。这一步之所以有意义,全靠内积的几何身份:a·b=|a||b|cosθ。它把"两个向量有多像"翻译成一个可微、可批量计算的数——方向越一致分越高,正交时归零,相反时为负。于是模型只要学会把"语义相关"的东西摆成"方向相近"的向量,注意力就能用一个矩阵乘法同时算出每个词对每个词的相关度。这把尺子的威力远不止注意力:词向量的类比、检索系统的召回、推荐的用户-物品匹配,本质都是在高维空间里用内积找"方向相近"。理解了它,你就看懂了为什么表示学习要把"意思"编码成"方向",以及为什么高维近正交(无关的东西点积≈0)是这套打分能干净工作的前提。</>} />
    </Shell>
  )
}

function LowRankDiagram() {
  const sig = [10,5,2,1]
  const keep = 2
  return (
    <Shell icon={Icn.ruler} title="低秩近似 / LoRA 原理"
      sub="看懂：为什么「低秩」能省参数还不太掉精度">
      <Sec n={1} title="事实：矩阵的信息集中在几个大奇异值上">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>任何矩阵能拆成一串"奇异分量"叠加:A = Σ σ_i·u_i·v_iᵀ,奇异值 σ 从大到小。<b>大部分信息压在前几个大 σ 里</b>,后面的又小又可丢。</span></div>
      </Sec>

      <Sec n={2} title="做法：只留前 k 个,重建误差=丢掉的σ">
        <div className="gd-graph">
          <svg viewBox="0 0 250 66" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {sig.map((v,k)=>(
              <g key={k}>
                <rect x={18+k*30} y={54-v*4.6} width="22" height={v*4.6}
                  fill={k<keep?'var(--now)':'var(--f-tag)'} opacity={k<keep?0.85:0.3} rx="2" />
                <text x={29+k*30} y="63" textAnchor="middle" fontSize="8" fill={k<keep?'var(--now)':'var(--faint)'}>σ{k+1}={v}</text>
              </g>
            ))}
            <line x1="14" y1="54" x2="146" y2="54" stroke="var(--line)" strokeWidth="0.6" />
            <rect x="150" y="8" width="1" height="48" fill="var(--line)" />
            <text x="164" y="20" fontSize="9" fill="var(--now)">留前 2 个</text>
            <text x="164" y="33" fontSize="9" fill="var(--hit)">→ 98% 信息</text>
            <text x="164" y="46" fontSize="9" fill="var(--ink)">参数 64 → 32</text>
            <text x="164" y="59" fontSize="8" fill="var(--faint)">误差=√(σ3²+σ4²)</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>留前 k 个分量,就用 <b>2·d·k</b> 个数近似了 d² 个;Eckart–Young 定理保证这是<b>最优</b>的秩-k 近似,误差正好等于丢掉的奇异值 √(Σσ²)。留前 2 个就 98% 像。</span></div>
      </Sec>

      <Sec n={3} title="用处：这就是 LoRA">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>微调只训一小撮</h4><p>不动原权重 W,加个低秩更新 ΔW=B·A(秩 r≪d),<em>只训 2·d·r 参数</em>——省显存省算力。</p></div>
          <div className="gd-card i"><h4>技能包随时换</h4><p>每个任务一套小小的低秩权重,<em>存很多套、即插即换</em>,不用为每个任务复制整个大模型。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>图像压缩、PCA、推荐系统降维,底子也都是低秩;它和量化一样,是"省显存"的一条主线,坐在矩阵乘法之上。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'A=Σσ·u·vᵀ' }, { cls: 'pd', text: '信息集中在大σ' },
          { cls: 'pi', text: '留前 k 个=低秩近似' }, { cls: 'pt', text: '2·d·k 个数近似 d²' },
          { cls: 'ph', text: 'LoRA:低秩更新只训一小撮' },
        ]}
        why={<><b>为什么"低秩"是省参数省算力的一把万能钥匙:</b>它背后是一个朴素但深刻的事实——真实世界的矩阵极少是"满信息"的,大量结构其实压在少数几个主方向(大奇异值)上,剩下的都是细枝末节。奇异值分解把这件事量化到极致:按 σ 从大到小排,留前 k 个就抓住了绝大部分信息,而且这是数学上可证的最优近似。于是"用小近似大"变得既安全又可控:图像压缩、PCA 降维、推荐系统、乃至大模型微调的 LoRA,全是同一招。LoRA 尤其漂亮——它假设"微调带来的权重改变"本身是低秩的,于是不去动那块巨大的原始权重,只训练一个又瘦又小的低秩增量,显存和算力都省下来,还能给不同任务各存一套随时切换。理解了它,你就掌握了在"精度"和"成本"之间做优雅折中的核心工具。</>} />
    </Shell>
  )
}

function EditDistDiagram() {
  // 编辑距离表 horse×ros，突出一格由三邻居推出
  const tbl = [[0,1,2,3],[1,1,2,3],[2,2,1,2],[3,2,2,2],[4,3,3,2],[5,4,4,3]]
  const rowH = ['ε','h','o','r','s','e'], colH = ['ε','r','o','s']
  const cur = [2,2] // 高亮格
  const src = new Set(['1,1','1,2','2,1'])
  const cw = 20, x0 = 40, y0 = 18
  return (
    <Shell icon={Icn.doc} title="动态规划原理"
      sub="看懂：为什么「记住子问题」能把指数搜索压成填表">
      <Sec n={1} title="病:朴素递归重复算同一个子问题">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>"把 a 改成 b 最少几步"直接递归,会把"前 i 个怎么改"这样的子问题<b>重复算指数级多次</b>,慢到不可用。动态规划一句话破局:<b>记住每个子问题的答案,别重算</b>。</span></div>
      </Sec>

      <Sec n={2} title="药:填表,每格只看三个邻居">
        <div className="gd-graph">
          <svg viewBox="0 0 170 140" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {colH.map((c,j)=><text key={'c'+j} x={x0+cw/2+j*cw} y={12} textAnchor="middle" fontSize="9" fill="var(--dim)">{c}</text>)}
            {rowH.map((r,i)=><text key={'r'+i} x={28} y={y0+cw/2+i*cw+3} textAnchor="middle" fontSize="9" fill="var(--dim)">{r}</text>)}
            {tbl.map((row,i)=>row.map((v,j)=>{
              const isCur = i===cur[0]&&j===cur[1], isSrc = src.has(`${i},${j}`)
              return <g key={`${i}-${j}`}>
                <rect x={x0+j*cw} y={y0+i*cw} width={cw} height={cw}
                  fill={isCur?'color-mix(in srgb,var(--now) 30%,var(--panel))':isSrc?'color-mix(in srgb,var(--f-tag) 22%,var(--panel))':'var(--panel)'}
                  stroke={isCur?'var(--now)':isSrc?'color-mix(in srgb,var(--f-tag) 45%,var(--line))':'var(--line)'} />
                <text x={x0+cw/2+j*cw} y={y0+cw/2+i*cw+3.5} textAnchor="middle" fontSize="9.5"
                  fill={isCur?'var(--ink)':'var(--ink)'} fontWeight={isCur?'700':'400'}>{v}</text>
              </g>
            }))}
            <text x={x0+4} y={y0+6*cw+14} fontSize="8" fill="var(--now)">相同→抄左上;不同→1+min(左上/上/左)</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>dp[i][j]=a 前 i 个改成 b 前 j 个的最少步。<b>a[i]==b[j]</b> 就抄左上(不用动);否则 <b>1+min(左上替换, 上删除, 左插入)</b>。每格 O(1),整表 O(n·m),右下角=答案。</span></div>
      </Sec>

      <Sec n={3} title="果:指数 → 多项式">
        <div className="gd-lane">
          <div className="gd-card i"><h4>最优子结构</h4><p>大问题的最优解,由子问题的最优解<em>拼</em>出来——所以能自底向上填。</p></div>
          <div className="gd-card hit"><h4>重叠子问题</h4><p>同一子问题被反复用到,<em>记一次、查无数次</em>,指数级重算就被压成一张表。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>序列比对、最短路(Bellman-Ford)、背包、DNA/语音对齐,底子都是这一套;它和 Dijkstra 一样吃"最优子结构"。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '大问题拆成子问题' }, { cls: 'pd', text: '子问题重叠、会重算' },
          { cls: 'pi', text: '填表记住每个答案' }, { cls: 'pt', text: '每格看三邻居 O(1)' },
          { cls: 'ph', text: 'O(n·m) 得解,指数→多项式' },
        ]}
        why={<><b>为什么"动态规划"是算法里最有杠杆的思想之一:</b>它对付的是"子问题被反复求解"造成的指数级爆炸。很多问题(最短编辑、最短路、背包、最优对齐)都有两个特征:大问题的最优解能由子问题的最优解拼成(最优子结构),而这些子问题又会被上层反复用到(重叠子问题)。动态规划的做法朴素得惊人——把每个子问题只算一次、结果记在表里,后面要用直接查。就这一下,指数级的重复计算被压成了多项式。编辑距离这张表是最好的入门:每一格都是一个子问题的答案,只依赖三个已算好的邻居,自底向上一填到底,右下角就是全局解。掌握了"识别子问题结构、定义状态与转移、按依赖顺序填表"这套路子,你就拿到了解一大类最优化问题的通用钥匙——从生信比对到路由算法都在用它。</>} />
    </Shell>
  )
}

function InductionDiagram() {
  const seq = ['A','B','C','A','B','C','A']
  const match = new Set([1,4]) // 前面是 A 的位置
  return (
    <Shell icon={Icn.star} title="归纳头原理"
      sub="看懂：大模型凭什么能「照着上文续写」">
      <Sec n={1} title="能力：没训过也能补全规律">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>给几个例子就照做(few-shot)、写一半规律序列就接得上——哪怕这句话训练时没见过。这种"看着上文现学现用"叫<b>上下文学习</b>,背后的具体电路就是<b>归纳头</b>。</span></div>
      </Sec>

      <Sec n={2} title="机制：回头找「上次它之后跟了什么」">
        <div className="gd-graph">
          <svg viewBox="0 0 260 70" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {seq.map((t,j)=>(
              <g key={j}>
                <rect x={8+j*34} y="28" width="26" height="26" rx="4"
                  fill={j===6?'color-mix(in srgb,var(--hit) 18%,var(--panel))':match.has(j)?'color-mix(in srgb,var(--now) 20%,var(--panel))':'var(--panel)'}
                  stroke={j===6?'var(--hit)':match.has(j)?'var(--now)':'var(--line)'} strokeWidth={j===6?1.4:1} />
                <text x={21+j*34} y="45" textAnchor="middle" fontSize="12" fill="var(--ink)">{t}</text>
                <text x={21+j*34} y="64" textAnchor="middle" fontSize="7" fill="var(--faint)">{j}</text>
              </g>
            ))}
            {/* 查询(pos6) 指回 pos1 / pos4 */}
            <path d="M223 26 q-70 -22 -195 0" fill="none" stroke="var(--now)" strokeWidth="1" strokeDasharray="3 2" markerEnd="url(#id-a)" />
            <path d="M223 26 q-40 -14 -70 0" fill="none" stroke="var(--now)" strokeWidth="1" strokeDasharray="3 2" markerEnd="url(#id-a)" />
            <text x="228" y="20" fontSize="8" fill="var(--hit)">当前 A</text>
            <defs><marker id="id-a" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 L5 3 L0 6" fill="var(--now)" /></marker></defs>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>当前 token 是 A。归纳头找"<b>前一个 token 是 A</b>"的位置(pos1、pos4),注意力落上去——那两处正好是"上次 A 之后",token 都是 <b>B</b>。把 B 复制出来当预测。</span></div>
      </Sec>

      <Sec n={3} title="结论：注意力能实现「回头查+复制」">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>按内容回头查</h4><p>用当前 token 去匹配"谁的前面是我",<em>定位到上次出现之后</em>——一个真正的查表动作。</p></div>
          <div className="gd-card i"><h4>两个头接力</h4><p>"前一 token 头"贴标签 +"归纳头"按标签匹配,<em>组合出复制能力</em>——多头不是摆设。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它坐在注意力、多头、因果掩码之上;和"注意力=联想记忆"一脉相承——都是"按内容检索"。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '当前 token = A' }, { cls: 'pd', text: '找"前面是 A"的位置' },
          { cls: 'pi', text: '注意力落到上次 A 之后' }, { cls: 'pt', text: '那里是 B' },
          { cls: 'ph', text: '复制 B → 模式补全' },
        ]}
        why={<><b>为什么"归纳头"是理解上下文学习的关键:</b>大模型最神奇的能力之一,是不改一个参数、只靠 prompt 里的几个例子就能现学新任务。这看似黑箱,但机制研究把它落到了一个可解释的电路上:归纳头。它证明了注意力远不止"加权平均"——两个注意力头接力,就能实现"用当前内容回头去查上次它出现在哪、后面跟了什么,再复制过来"这样一个货真价实的算法。正是这种"按内容检索并复制"的能力,让模型能续写有规律的序列、模仿示例的格式、把上文的模式迁移到下文。理解了它,你就看懂了为什么 few-shot 有效、为什么长上下文里模型能"记住并套用"前文的约定,以及为什么说 Transformer 学到的不只是统计相关、而是可组合的小算法。这是机械可解释性(mechanistic interpretability)最漂亮的成果之一。</>} />
    </Shell>
  )
}

function GradDescDiagram() {
  // 等高线 + 之字形下降轨迹（y 方向陡 → 来回震荡）
  const pts = [[4,4],[2.88,-1.6],[2.07,0.64],[1.49,-0.26],[1.08,0.1],[0.77,-0.04]]
  const SC = 7, ox = 60, oy = 40
  const X = (x:number)=>ox + x*SC, Y = (y:number)=>oy - y*SC
  return (
    <Shell icon={Icn.bulb} title="梯度下降原理"
      sub="看懂：模型「训练」到底在干嘛">
      <Sec n={1} title="目标：把损失 L(θ) 降到最低">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>训练=最小化一个衡量"错多重"的损失 L(θ)。梯度 ∇L 指向<b>上升最快</b>的方向,那就朝反方向走:<b>θ ← θ − lr·∇L</b>。反复走,损失一路下降。</span></div>
      </Sec>

      <Sec n={2} title="机制：顺负梯度一步步走到谷底">
        <div className="gd-graph">
          <svg viewBox="0 0 250 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {[64,32,12,3].map((c,k)=>(<ellipse key={k} cx={ox} cy={oy} rx={Math.sqrt(c)*SC} ry={Math.sqrt(c/5)*SC} fill="none" stroke="color-mix(in srgb,var(--f-tag) 45%,transparent)" strokeWidth="0.7" />))}
            <line x1={ox} y1="6" x2={ox} y2="74" stroke="var(--line)" strokeWidth="0.5" />
            <line x1="18" y1={oy} x2="242" y2={oy} stroke="var(--line)" strokeWidth="0.5" />
            <polyline points={pts.map(p=>`${X(p[0])},${Y(p[1])}`).join(' ')} fill="none" stroke="var(--now)" strokeWidth="1.4" />
            {pts.map((p,k)=><circle key={k} cx={X(p[0])} cy={Y(p[1])} r={k===0?2.4:1.6} fill={k===0?'var(--hit)':'var(--now)'} />)}
            <circle cx={ox} cy={oy} r="2" fill="var(--miss)" />
            <text x={X(4)+3} y={Y(4)} fontSize="8" fill="var(--hit)">起点</text>
            <text x={ox+4} y={oy-3} fontSize="8" fill="var(--miss)">谷底</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>椭圆是损失的等高线。每步沿负梯度走一段(步长=学习率)。注意 y 方向更陡,步子容易<b>迈过头</b>、在中轴两侧<b>之字形</b>震荡——这就是学习率与曲率(条件数)的博弈。</span></div>
      </Sec>

      <Sec n={3} title="结论：所有训练都是这一步的重复">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>损失单调下降</h4><p>只要学习率合适,θ←θ−lr·∇L 每步都把损失降一点——<em>训练曲线</em>就是这么来的。</p></div>
          <div className="gd-card i"><h4>步长是门艺术</h4><p>太大发散、太小太慢;病态损失面还会震荡——于是有了<em>动量、Adam、学习率调度</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>损失和梯度从"前向算损失、反向传梯度"来;这一步之后接<b>残差=梯度高速路</b>(让深层也拿得到梯度)。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '损失 L(θ) 衡量错多重' }, { cls: 'pd', text: '梯度 ∇L 指向上升最快' },
          { cls: 'pi', text: '朝负梯度走 θ−lr·∇L' }, { cls: 'pt', text: '损失单调下降' },
          { cls: 'ph', text: '逼近谷底=训练完成' },
        ]}
        why={<><b>为什么"梯度下降"是理解深度学习的第一块基石:</b>再大的模型、再复杂的架构,"学习"这件事的内核就是这一个动作——沿着损失下降最快的方向,把几十亿个参数各挪一小步,重复千百万次。它之所以奏效,是因为梯度这个局部信息恰好告诉你"往哪调能立刻变好";而学习率则决定你敢迈多大步。这个简单规则里藏着深度学习工程的大半门道:损失面越"病态"(某些方向陡、某些方向平),固定步长就越容易震荡或爬得慢,于是有了动量、Adam、学习率预热与衰减,全是为了把这一步走得又快又稳。理解了它,训练日志里那条下降的 loss 曲线、"调学习率"为什么是玄学、以及为什么需要好的初始化和归一化,就都串起来了。</>} />
    </Shell>
  )
}

function BloomDiagram() {
  // 12 位示意：dog 点亮 3 位；owl 查询恰好命中同样 3 位 → 假阳性
  const on = new Set([1, 4, 8])
  return (
    <Shell icon={Icn.tag} title="布隆过滤器原理"
      sub="看懂：一点点空间，换「绝不漏报、极少误报」">
      <Sec n={1} title="结构：m 个 bit + k 个哈希">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>不存元素本身，只留一个 bit 数组。<b>插入</b>=把 k 个哈希位全置 1；<b>查询</b>=看那 k 位是不是都为 1。空间小到只有一排开关。</span></div>
      </Sec>

      <Sec n={2} title="机制：0 就一定不在，全 1 只是可能在">
        <div className="gd-graph">
          <svg viewBox="0 0 300 74" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="8" y="12" fontSize="9" fill="var(--now)">插入 dog → 点亮位 1 / 4 / 8</text>
            {Array.from({ length: 12 }, (_, i) => (
              <g key={i}>
                <rect x={8 + i * 23} y="18" width="19" height="19" rx="3"
                  fill={on.has(i) ? 'color-mix(in srgb,var(--now) 25%,var(--panel))' : 'var(--panel)'}
                  stroke={on.has(i) ? 'var(--now)' : 'var(--line)'} />
                <text x={17 + i * 23} y="31" textAnchor="middle" fontSize="9" fill={on.has(i) ? 'var(--ink)' : 'var(--faint)'}>{on.has(i) ? 1 : 0}</text>
              </g>
            ))}
            <text x="8" y="56" fontSize="9" fill="var(--miss)">查询 owl（没插过）→ 看位 1 / 4 / 8</text>
            <text x="8" y="69" fontSize="9.5" fill="var(--miss)">三位恰好全是 1 → 判「可能在」= 假阳性！</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>插过的元素一定把自己的 k 位都置了 1，所以查询<b>绝不漏报</b>；但没插过的元素也可能被别人撞亮所有位——<b>假阳性</b>。方向是单边的:0 铁证不在，全 1 只是"可能"。</span></div>
      </Sec>

      <Sec n={3} title="结论：用可控错误率换空间与速度">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>绝不漏报</h4><p>"说不在"就一定不在——所以能放心用它<em>先筛掉绝大多数不可能</em>，再去查慢存储。</p></div>
          <div className="gd-card i"><h4>误报率可调</h4><p>假阳性率≈(1−e^(−kn/m))^k：<em>位越多、元素越少</em>就越低。花更多 bit 换更低误报。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它坐在<b>哈希</b>(定位)和<b>位图</b>(一位一格)两条基础之上;缓存前置、爬虫去重、数据库防穿透都靠它。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'm 位 bit + k 哈希' }, { cls: 'pd', text: '插入=点亮 k 位' },
          { cls: 'pi', text: '查询=看 k 位是否全 1' }, { cls: 'pt', text: '有 0 铁定不在' },
          { cls: 'ph', text: '全 1 只是可能(有假阳性)' },
        ]}
        why={<><b>为什么"布隆过滤器"是工程折中的经典范例:</b>它放弃了"精确",换来了近乎荒谬的空间效率——判断十亿级集合的成员关系，可能只要几兆内存。关键在于它把错误做成了<b>单边</b>的:绝不漏报，只可能误报。这种非对称正好契合大量真实场景——先用布隆快速否掉绝大多数"肯定没有"的查询，剩下极少数"可能有"的再去查昂贵的磁盘或网络，整体既快又省。而误报率还能用位数和哈希个数精确调节，让你按预算买精度。理解了它，你就掌握了一种极重要的思维:很多时候不需要完美答案，一个"错得可控、错得有方向"的近似，反而是最优工程解。它也是概率型数据结构(HyperLogLog、Count-Min Sketch)这一大家族的入门。</>} />
    </Shell>
  )
}

function BayesDiagram() {
  // 1000 人示意：10 病(9 真阳) vs 990 健康(89 误报) → 阳性里真病只 9/98
  return (
    <Shell icon={Icn.bulb} title="贝叶斯定理原理"
      sub="看懂：为什么阳性了也不一定是 90%">
      <Sec n={1} title="陷阱：阳性 ≠ 患病率就是灵敏度">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>病率 1%、检测灵敏度 90%、误报 9%。测出阳性，你有多可能真患病？直觉喊"90%"，正确答案是 <b>~9%</b>。差在哪？直觉忘了<b>基础率</b>——没病的人实在太多了。</span></div>
      </Sec>

      <Sec n={2} title="数人头：1000 人里的阳性都来自谁">
        <div className="gd-graph">
          <svg viewBox="0 0 320 78" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 10 病人：9 真阳 */}
            <text x="8" y="12" fontSize="9" fill="var(--hit)">10 个真病人 → 9 阳性(真阳)</text>
            <rect x="8" y="18" width="70" height="14" rx="3" fill="var(--now)" opacity="0.85" />
            <text x="43" y="28" textAnchor="middle" fontSize="9" fill="#fff">真阳 9</text>
            {/* 990 健康：89 误报 */}
            <text x="8" y="50" fontSize="9" fill="var(--miss)">990 个健康人 → 89 阳性(误报)</text>
            <rect x="8" y="56" width="300" height="14" rx="3" fill="color-mix(in srgb,var(--miss) 55%,var(--f-tag))" opacity="0.85" />
            <text x="158" y="66" textAnchor="middle" fontSize="9" fill="#fff">误报 89（健康人基数太大）</text>
            {/* 结论箭头 */}
            <text x="230" y="28" fontSize="9" fill="var(--ink)">阳性共 98 人</text>
            <text x="230" y="40" fontSize="10" fill="var(--hit)" fontWeight="bold">真病只 9/98 ≈ 9%</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>后验 = 真阳 / (真阳 + 误报) = 9 / (9 + 89) ≈ <b>9%</b>。式子就是 <b>后验 ∝ 先验 × 似然</b>：P(病∣阳)=P(阳∣病)·P(病) / P(阳)。基础率 1% 被牢牢算了进去。</span></div>
      </Sec>

      <Sec n={3} title="翻盘：证据能连续更新">
        <div className="gd-lane">
          <div className="gd-card i"><h4>单次别慌</h4><p>一次阳性只把信念从 1% 抬到 <em>9%</em>——稀有 + 有误报，单证据远不够定论。</p></div>
          <div className="gd-card hit"><h4>后验变新先验</h4><p>再测一次阳性，拿上次的 9% 当先验：<em>9%→50%→91%→99%</em>，证据累积逼近确诊。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>"后验变新先验"这一步，就是贝叶斯滤波/在线学习的核心；模型"在上下文里不断修正判断"用的也是同一套。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '先验=基础率 1%' }, { cls: 'pd', text: '证据:一次阳性' },
          { cls: 'pi', text: '后验=真阳/(真阳+误报)' }, { cls: 'pt', text: '单次只 9%' },
          { cls: 'ph', text: '后验变新先验,连续更新' },
        ]}
        why={<><b>为什么"贝叶斯定理"是概率推断的骨架：</b>它回答了智能体最根本的一个问题——来了新证据，我该把信念改成多少？答案是把两样东西相乘:你原本的信念(先验)和证据的说服力(似然)。这个式子最反直觉、也最重要的一点，是它强迫你把"基础率"算进去:再灵敏的检测，撞上足够稀有的目标，单次阳性也可能大多是误报。忽视这一点就是著名的基础率谬误，医疗、司法、垃圾邮件里都栽过。而它另一面又极其强大:后验可以当成下一轮的先验，于是信念能随证据流一步步更新、收敛。朴素贝叶斯分类、卡尔曼滤波、A/B 实验、乃至大模型"读着上下文不断修正下一个词的判断"，本质都是在反复用这一个式子。</>} />
    </Shell>
  )
}

function XentDiagram() {
  // 两个预测：笃定(p高、惊讶低) vs 拿不准(p低、惊讶高)
  return (
    <Shell icon={Icn.tag} title="交叉熵·困惑度原理"
      sub="看懂：训练损失和评测指标到底在量什么">
      <Sec n={1} title="视角：交叉熵 = 模型对「真相」的惊讶度">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>语言模型每步给"下一个词"一个概率分布。真词只有一个，于是这步的交叉熵就等于 <b>−log₂ p(真词)</b>——给真词的概率越高、越不惊讶、损失越低。整句平均，就是<b>训练损失</b>。</span></div>
      </Sec>

      <Sec n={2} title="机制：惊讶度 → 交叉熵 → 困惑度">
        <div className="gd-graph">
          <svg viewBox="0 0 320 96" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 笃定 */}
            <text x="78" y="12" textAnchor="middle" fontSize="9.5" fill="var(--hit)">笃定：真词 95%</text>
            <rect x="16" y="20" width="18" height="30" rx="2" fill="var(--hit)" opacity="0.85" />
            <rect x="38" y="44" width="12" height="6" rx="2" fill="var(--f-tag)" opacity="0.4" />
            <rect x="54" y="45" width="12" height="5" rx="2" fill="var(--f-tag)" opacity="0.4" />
            <rect x="70" y="46" width="12" height="4" rx="2" fill="var(--f-tag)" opacity="0.4" />
            <text x="78" y="66" textAnchor="middle" fontSize="8.5" fill="var(--ink)">惊讶 −log₂0.95 ≈ 0.07 bit</text>
            {/* 拿不准 */}
            <text x="242" y="12" textAnchor="middle" fontSize="9.5" fill="var(--miss)">拿不准：真词 25%</text>
            <rect x="182" y="36" width="18" height="14" rx="2" fill="var(--now)" opacity="0.8" />
            <rect x="204" y="34" width="14" height="16" rx="2" fill="var(--f-tag)" opacity="0.5" />
            <rect x="222" y="32" width="14" height="18" rx="2" fill="var(--f-tag)" opacity="0.5" />
            <rect x="240" y="38" width="14" height="12" rx="2" fill="var(--f-tag)" opacity="0.5" />
            <text x="242" y="66" textAnchor="middle" fontSize="8.5" fill="var(--ink)">惊讶 −log₂0.25 = 2 bit</text>
            {/* 困惑度尺 */}
            <text x="16" y="86" fontSize="8" fill="var(--faint)">困惑度=2^交叉熵：</text>
            <line x1="96" y1="83" x2="304" y2="83" stroke="var(--line)" strokeWidth="4" strokeLinecap="round" />
            <circle cx="120" cy="83" r="3.5" fill="var(--hit)" />
            <text x="120" y="95" textAnchor="middle" fontSize="7.5" fill="var(--hit)">1 笃定</text>
            <text x="304" y="95" textAnchor="end" fontSize="7.5" fill="var(--miss)">V 瞎猜</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>困惑度 = <b>2^交叉熵</b>，是"有效分叉数"：模型平均在多少个等概率词之间犹豫。完美预测=<b>1</b>(毫不犹豫)、瞎猜(均匀 V 选 1)=<b>V</b>。真实模型落在 1 与 V 之间。</span></div>
      </Sec>

      <Sec n={3} title="结论：降损失 = 降困惑度 = 同一件事">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>训练在压惊讶度</h4><p>训练就是让模型给真词更高的概率——<em>惊讶度↓ → 交叉熵↓</em>，这正是梯度下降在优化的目标。</p></div>
          <div className="gd-card i"><h4>困惑度=最常用评测</h4><p>困惑度=2^交叉熵，单调对应，且有直觉("在几个词间犹豫")——所以成了语言模型的标准评测指标。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>概率分布从 <b>softmax</b> 来、采样也用同一套"下一词分布"。交叉熵/困惑度就是给这套分布"打分"的尺子。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '模型给下一词一个分布' }, { cls: 'pd', text: '真词惊讶度 −log₂p' },
          { cls: 'pi', text: '平均=交叉熵(训练损失)' }, { cls: 'pt', text: '困惑度=2^交叉熵' },
          { cls: 'ph', text: '越低=越笃定=越好' },
        ]}
        why={<><b>为什么"交叉熵·困惑度"是理解大模型训练的钥匙：</b>整个语言模型的训练，一句话说就是"让真实出现的词，模型给的概率尽量高"。交叉熵把这件事量化成一个可求导的数——模型对真相有多惊讶——于是梯度下降就有了明确的下山方向。而困惑度只是把交叉熵换算成一个有直觉的数:模型平均在几个词之间犹豫。1 表示每次都笃定押中，词表大小 V 表示完全瞎猜。理解了这把尺子，你就懂了训练日志里那条下降曲线到底在降什么、不同模型的"困惑度 20 vs 8"意味着什么、以及为什么它和 softmax、采样、KL 散度是同一族信息论工具。这是把"损失下降"从口号变成能读懂的量。</>} />
    </Shell>
  )
}

function CltDiagram() {
  // 三张标准化直方图：m=1 平顶 → m=4 过渡 → m=32 钟形（示意高度）
  const flat = [0, 0, .8, .82, .8, .83, .81, .8, 0, 0]
  const mid  = [.05, .2, .45, .72, .85, .84, .7, .43, .19, .05]
  const bell = [.02, .08, .24, .55, .9, .9, .54, .23, .08, .02]
  const gauss = [.03, .1, .28, .58, .88, .88, .58, .28, .1, .03]
  const bars = (vals: number[], x0: number, hit: boolean) => vals.map((v, k) =>
    <rect key={k} x={x0 + k * 7} y={34 - v * 28} width="6" height={v * 28}
      fill={hit ? 'var(--hit)' : 'var(--f-tag)'} opacity={hit ? 0.7 : 0.5} />)
  const curve = (x0: number) => 'M' + gauss.map((v, k) => `${x0 + k * 7 + 3} ${(34 - v * 28).toFixed(1)}`).join(' L')
  return (
    <Shell icon={Icn.bulb} title="中心极限定理原理"
      sub="看懂：为什么高斯分布(钟形)到处都是">
      <Sec n={1} title="问题：凭什么「多个一平均」就变钟形">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>原始分布可以奇形怪状——比如最不像高斯的<b>均匀分布(平顶)</b>。可只要把 m 个独立样本<b>平均</b>，随 m 增大，这个均值的分布竟然越来越接近<b>高斯</b>。这就是高斯到处都是的原因。</span></div>
      </Sec>

      <Sec n={2} title="现象：平顶 → 过渡 → 钟形">
        <div className="gd-graph">
          <svg viewBox="0 0 250 52" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {bars(flat, 4, false)}
            {bars(mid, 90, false)}
            {bars(bell, 176, true)}
            <path d={curve(176)} fill="none" stroke="var(--hit)" strokeWidth="1.3" />
            <text x="35" y="45" textAnchor="middle" fontSize="8" fill="var(--faint)">m=1 平顶</text>
            <text x="121" y="45" textAnchor="middle" fontSize="8" fill="var(--faint)">m=4</text>
            <text x="207" y="45" textAnchor="middle" fontSize="8" fill="var(--hit)">m=32 钟形</text>
            <text x="70" y="20" fontSize="12" fill="var(--faint)">→</text>
            <text x="156" y="20" fontSize="12" fill="var(--faint)">→</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>超额峰度从 −1.2(均匀)一路奔向 <b>0</b>(=高斯)，直方图死死贴住正态曲线(红线)。同时均值的标准差按 <b>σ/√m</b> 缩——形状趋高斯、宽度按 1/√m 收窄。</span></div>
      </Sec>

      <Sec n={3} title="结论：高斯是「相加」的必然归宿">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>默认拿高斯建模</h4><p>测量误差、噪声、<em>权重初始化</em>、误差项——都是"许多小因素相加"，天然高斯，所以高斯成了默认假设。</p></div>
          <div className="gd-card i"><h4>求平均能「高斯化」</h4><p>任意噪声一<em>平均</em>就趋向高斯且方差缩 1/m——这也是为什么多次平均既降噪又可预测。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它和 <b>大数定理</b>是一对：大数定理说均值收敛到期望，CLT 进一步说均值的<b>涨落</b>长成高斯、且按 1/√m 收窄。都是同一套 i.i.d. 累加。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '原始分布奇形怪状' }, { cls: 'pd', text: '取 m 个样本平均' },
          { cls: 'pi', text: 'm 大 → 均值趋高斯' }, { cls: 'pt', text: '峰度→0、std∝1/√m' },
          { cls: 'ph', text: '高斯到处都是' },
        ]}
        why={<><b>为什么"中心极限定理"是概率世界的地基：</b>它解释了一个惊人的普适现象——无论你从什么分布出发，只要把足够多的独立样本平均，结果的分布几乎总是同一个形状:高斯。这不是巧合，而是"相加"这个操作本身的归宿。于是自然界里凡是"许多微小独立因素叠加"的量——身高、测量误差、热噪声——都近似高斯；深度学习里权重初始化、噪声注入、误差建模也就顺理成章地默认用高斯。更实用的一面是:它告诉你"求平均"不仅让估计收敛(大数定理)，还让涨落变得可预测(高斯，且宽度按 1/√m 收窄)，这正是蒙特卡洛、集成、批量统计之所以可靠的数学保证。理解了它，你就懂了为什么高斯是概率论的"默认语言"。</>} />
    </Shell>
  )
}

function LlnDiagram() {
  // 收敛漏斗：估计值(蓝点)在 π 虚线附近抖动，振幅按 1/√n 收窄
  const ns = [1, 2, 3, 4, 5, 6, 7, 8]
  const wig = [0.9, -0.7, 0.55, -0.35, 0.28, -0.16, 0.12, -0.06] // 抖动方向×幅度(∝1/√n)
  const cx = (k: number) => 24 + k * 36
  const cy = (v: number) => 46 - v * 22
  return (
    <Shell icon={Icn.bulb} title="大数定理原理"
      sub="看懂：为什么「多采样就准」，误差凭什么按 1/√n 缩">
      <Sec n={1} title="问题：单次随机说不准，多次平均凭什么准">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>掷一次硬币你说不准，掷一万次正面比例几乎必是 0.5。大数定理说：i.i.d. 样本的<b>均值</b>随样本数 n 增大<b>收敛到期望</b>。但收敛<b>有多快</b>？这才是能不能用的关键。</span></div>
      </Sec>

      <Sec n={2} title="现象：蒙特卡洛估 π，抖动按 1/√n 收窄">
        <div className="gd-graph">
          <svg viewBox="0 0 320 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* π 目标线 */}
            <line x1="16" y1="46" x2="308" y2="46" stroke="var(--hit)" strokeWidth="1.2" strokeDasharray="4 3" />
            <text x="312" y="49" fontSize="9" fill="var(--hit)" textAnchor="end">π</text>
            {/* 1/√n 收敛包络 */}
            <path d={`M24 ${cy(1.0)} ` + ns.map(k => `L${cx(k-1)} ${cy(1.05/Math.sqrt(k))}`).join(' ')} fill="none" stroke="var(--line)" strokeWidth="1" />
            <path d={`M24 ${cy(-1.0)} ` + ns.map(k => `L${cx(k-1)} ${cy(-1.05/Math.sqrt(k))}`).join(' ')} fill="none" stroke="var(--line)" strokeWidth="1" />
            {/* 估计点 + 折线 */}
            <path d={ns.map((k,i) => `${i?'L':'M'}${cx(i)} ${cy(wig[i])}`).join(' ')} fill="none" stroke="var(--f-tag)" strokeWidth="1" opacity="0.5" />
            {ns.map((k,i) => <circle key={i} cx={cx(i)} cy={cy(wig[i])} r="3.2" fill="var(--now)" />)}
            <text x="24" y="88" fontSize="8" fill="var(--faint)">n 小：抖</text>
            <text x="296" y="88" fontSize="8" fill="var(--faint)" textAnchor="end">n 大：贴住 π</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>正方形里随机撒 n 点，落进 1/4 圆的比例 × 4 ≈ π。n 越大，估计越贴 3.14159；而<b>估计误差按 1/√n 缩</b>（标准误 ∝ 1/√n，来自方差可加——n 个独立项相加、std 涨 √n，均值 std 就 ∝ 1/√n）。</span></div>
      </Sec>

      <Sec n={3} title="结论：翻 4 倍才减半，却是随机方法的底">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>|误差|×√n ≈ 常数</h4><p>这就是「误差 ∝ 1/√n」：想把误差<em>减半</em>，得把样本<em>翻 4 倍</em>。收敛不快，但稳。</p></div>
          <div className="gd-card i"><h4>「多次平均就稳」的底</h4><p>采样、蒙特卡洛积分、dropout、MoE 路由——单次随机不可靠，<em>n 个独立样本一平均，方差缩 n 倍</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它和 <b>√d 缩放</b>、<b>高维近正交</b> 是同一套 i.i.d. 累加的不同侧面：那两条讲"方差随 d 涨/随机方向随 d 正交"，这条讲"均值随 n 集中"。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '单次随机不可靠' }, { cls: 'pd', text: 'i.i.d. 样本取均值' },
          { cls: 'pi', text: '均值收敛到期望' }, { cls: 'pt', text: '误差 ∝ 1/√n' },
          { cls: 'ph', text: '多次平均就稳' },
        ]}
        why={<><b>为什么"大数定理"是随机方法的地基：</b>现代 AI 到处是随机——采样生成、dropout、随机初始化、MoE 路由、蒙特卡洛估计。单看一次，结果全是噪声、说明不了任何事。大数定理保证：只要样本独立同分布，把它们一平均，均值就死死收敛到真实期望，而且误差按 1/√n 稳步缩小。这条"1/√n"既是好消息也是坏消息——好在它总会收敛、方向明确；坏在收敛慢，想让误差减半得把算力翻 4 倍，这正是蒙特卡洛方法又通用又"贵"的根。理解了它，你就懂了为什么"多跑几次取平均"是对的、要跑多少次才够、以及为什么方差可加这一条会一路贯穿到 √d 缩放和高维近正交。</>} />
    </Shell>
  )
}

function NQueensDiagram() {
  const sol = [1, 3, 0, 2]   // 解：row r 的皇后在 sol[r] 列
  const N = 4, cell = 20, ox = 60, oy = 4
  return (
    <Shell icon={Icn.star} title="回溯 · N 皇后原理"
      sub="看懂：走不通就退回上一步，换一个再试">
      <Sec n={1} title="问题：N 个皇后互不攻击，硬枚举会爆炸">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>N×N 棋盘放 N 个皇后,任两个不能<b>同行、同列、同对角线</b>。4×4 全摆法有 4⁴=256 种,N 一大就天文数字——不能瞎枚举,要<b>系统化地试错</b>。</span></div>
      </Sec>

      <Sec n={2} title="做法：一行放一个，撞死胡同就撤回换列">
        <div className="gd-graph">
          <svg viewBox="0 0 250 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <g>
              {Array.from({ length: N * N }, (_, i) => {
                const r = Math.floor(i / N), c = i % N, dark = (r + c) % 2 === 1
                return <rect key={i} x={ox + c * cell} y={oy + r * cell} width={cell} height={cell}
                  fill={dark ? 'color-mix(in srgb,var(--ink) 10%,var(--panel))' : 'var(--panel)'} stroke="var(--line)" strokeWidth="0.4" />
              })}
              {sol.map((c, r) => (
                <text key={r} x={ox + c * cell + cell / 2} y={oy + r * cell + cell / 2 + 4.5} textAnchor="middle" fontSize="13" fill="var(--hit)">♛</text>
              ))}
              <rect x={ox} y={oy} width={N * cell} height={N * cell} fill="none" stroke="var(--line)" strokeWidth="1" />
              <text x={ox + N * cell / 2} y={oy + N * cell + 8} textAnchor="middle" fontSize="6" fill="var(--faint)">解 [1,3,0,2]:四后互不攻击</text>
            </g>
            <g transform="translate(158,10)">
              <text x="0" y="6" fontSize="6.5" fill="var(--ink)">① 行内找安全列</text>
              <text x="0" y="24" fontSize="6.5" fill="var(--hit)">② 安全→落子,进下一行</text>
              <text x="0" y="42" fontSize="6.5" fill="var(--miss)">③ 整行没位→撤回</text>
              <text x="0" y="60" fontSize="6.5" fill="var(--ink)">④ 回上一行换下一列</text>
              <text x="0" y="80" fontSize="6" fill="var(--faint)">循环①~④直到摆满</text>
            </g>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>本行从左找<b>不被已放皇后攻击</b>的列(同列或 |Δ行|=|Δ列| 都算攻击)。找到就<b>落子</b>往下走;整行<b>没有安全位</b>=死胡同,就<b>回溯</b>——撤掉上一行的皇后,挪到下一个安全列重试。像走迷宫撞死胡同就退回换岔口。</span></div>
      </Sec>

      <Sec n={3} title="本质：深度优先穷举「选择树」+ 剪枝">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>提前剪枝</h4><p>被攻击的列<em>直接跳过</em>,不往下展开——所以远不用真枚举全部 256 种。</p></div>
          <div className="gd-card i"><h4>对照贪心</h4><p>贪心<em>一条道走到黑不回头</em>;回溯<em>允许悔棋</em>,系统地把选择空间走遍。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>凡是"做一串选择、走不通就退一步换一个"的问题,骨架都是回溯:<b>数独、全排列/组合、正则匹配、编译器类型求解、图着色</b>。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '一行放一个皇后' }, { cls: 'pd', text: '行内找安全列' },
          { cls: 'pi', text: '安全→落子进下一行' }, { cls: 'pt', text: '死胡同→撤回换列' },
          { cls: 'ph', text: '摆满=解出' },
        ]}
        why={<><b>为什么"回溯"是算法思维的一道分水岭:</b>它教会你面对没有公式、只能试的问题时,如何"聪明地试"。朴素的暴力枚举会把所有组合都摆一遍,数量随规模指数爆炸;回溯的高明在于把问题组织成一棵"选择树",深度优先地往下走,而每走一步都用约束检查当前分支还有没有希望——一旦发现走不通(某行所有列都被攻击),立刻撤销这步、退回上一层换下一个候选,整片不可能的子树被"剪枝"掉,根本不去展开。这就是它比暴力枚举快无数倍的原因。更重要的是那个"撤销 / 悔棋"的动作:它和只会一路向前的贪心正好相反,贪心赌每步局部最优、错了也不回头,回溯则系统地保证不重不漏地走遍整个选择空间,因此能找到确切解。掌握了这套"试一个→检查→走不通就退一步"的骨架,数独求解器、排列组合枚举、正则引擎的匹配、编译器的类型推导、图着色与旅行商的精确解,在你眼里就都成了同一个模板的变体。</>} />
    </Shell>
  )
}

function UnionFindDiagram() {
  // 压缩前的链 0←1←2←3←6 与压缩后的星形
  const chain = [0, 1, 2, 3, 6]
  return (
    <Shell icon={Icn.tag} title="并查集 Union-Find 原理"
      sub="看懂：是不是一伙，只看根同不同">
      <Sec n={1} title="要做的事：合并两组、查是不是一组">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>社交圈子、修路连城、账号合并……都要维护一堆元素的<b>分组</b>,支持两件事:把两组<b>合并(union)</b>、查某两个<b>是不是一组(find 比根)</b>。</span></div>
      </Sec>

      <Sec n={2} title="做法：每组一棵树，顺父指针爬到根">
        <div className="gd-lane">
          <div className="gd-card i"><h4>find(x)</h4><p>顺<em>父指针</em>一路爬到<em>根</em>,根就是这组的代表。</p></div>
          <div className="gd-card i"><h4>union(a,b)</h4><p>找到两人的根,把<em>一个根挂到另一个根下</em>,两棵树并成一棵。</p></div>
          <div className="gd-card i"><h4>是不是一伙</h4><p>看 <em>find(a)==find(b)</em> —— 根相同就一伙。就这么简单。</p></div>
        </div>
      </Sec>

      <Sec n={3} title="点睛：路径压缩把长链一次拍平">
        <div className="gd-graph">
          <svg viewBox="0 0 250 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 压缩前：链 */}
            <text x="6" y="10" fontSize="6" fill="var(--faint)">压缩前(链深 4)</text>
            {chain.map((v, k) => (
              <g key={k}>
                <circle cx={18 + k * 26} cy={26} r="7" fill="var(--panel)" stroke={k === chain.length - 1 ? 'var(--hit)' : 'var(--line)'} strokeWidth={k === chain.length - 1 ? 1.4 : 0.7} />
                <text x={18 + k * 26} y={28.5} textAnchor="middle" fontSize="7" fill="var(--ink)">{v}</text>
                {k < chain.length - 1 && <line x1={25 + k * 26} y1={26} x2={37 + k * 26} y2={26} stroke="var(--faint)" strokeWidth="0.7" markerEnd="url(#ufa)" />}
              </g>
            ))}
            <text x={18 + (chain.length - 1) * 26} y={16} textAnchor="middle" fontSize="5" fill="var(--hit)">根</text>
            {/* 压缩后：星形 */}
            <text x="6" y="52" fontSize="6" fill="var(--faint)">压缩后(全深 1)</text>
            <circle cx={122} cy={68} r="7" fill="var(--panel)" stroke="var(--hit)" strokeWidth="1.4" />
            <text x={122} y={70.5} textAnchor="middle" fontSize="7" fill="var(--ink)">6</text>
            {[0, 1, 2, 3].map((v, k) => (
              <g key={k}>
                <circle cx={44 + k * 26} cy={64} r="6" fill="color-mix(in srgb,var(--hit) 12%,var(--panel))" stroke="var(--hit)" strokeWidth="0.7" />
                <text x={44 + k * 26} y={66.5} textAnchor="middle" fontSize="6.5" fill="var(--ink)">{v}</text>
                <line x1={44 + k * 26} y1={58} x2={118} y2={64} stroke="var(--hit)" strokeWidth="0.6" markerEnd="url(#ufa)" />
              </g>
            ))}
            <defs><marker id="ufa" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="var(--faint)" /></marker></defs>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>朴素合并会长出<b>长链</b>,find 爬得慢。路径压缩:find 爬到根后,把沿途每个点<b>直接挂到根下</b>——链一下拍平,下次几乎一步到根。配按秩合并,均摊<b>近乎 O(1)</b>(反阿克曼 α,现实不超过 4)。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '每组一棵树' }, { cls: 'pd', text: 'find:爬到根' },
          { cls: 'pi', text: 'union:挂根' }, { cls: 'pt', text: '根同=一伙' },
          { cls: 'ph', text: '压缩拍平≈O(1)' },
        ]}
        why={<><b>为什么"并查集"是被低估的一块基石:</b>它把"维护动态分组、随时查连通性"这个到处出现的需求,压进了一个小到几十行、快到近乎常数的结构里。秘诀是换了个表示——不去维护"每组有哪些成员"这种会随合并不断搬迁的清单,而是让每个元素只记一个父指针、顺着爬到根,用"根相不相同"回答"是不是一伙"。合并因此退化成一步:把一个根挂到另一个根下面。而它真正封神的是路径压缩:每次查询顺手把沿途节点直接接到根上,树越用越扁,后续查询越来越快——数据结构会因为被使用而自我优化,这个思想本身就很美。掌握它,你会在很多地方一眼看见它的身影:Kruskal 求最小生成树时用它判断"加这条边会不会成环"、判断网络或电路的连通、把同一个人的多个账号归并、图像里标记连通区域、编译器里合并等价的类型变量。它和图的遍历互补——DFS/BFS 能告诉你具体怎么走通,并查集只回答"通不通",但快得多、省得多。</>} />
    </Shell>
  )
}

function HeapDiagram() {
  // 最大堆 [9,7,8,1,3,5,2] 的树
  const arr = [9, 7, 8, 1, 3, 5, 2]
  const W = 220, PAD = 14, LH = 20
  const pos = (i: number) => {
    const d = Math.floor(Math.log2(i + 1)), cnt = 2 ** d, pil = i - (cnt - 1)
    return { x: PAD + ((pil + 0.5) / cnt) * (W - 2 * PAD), y: 10 + d * LH }
  }
  return (
    <Shell icon={Icn.tag} title="二叉堆 / 优先队列原理"
      sub="看懂：父永远≥子，堆顶永远是最大">
      <Sec n={1} title="要做的事：反复取「当前最大/最优」">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>任务调度取最紧急、Dijkstra 取最近、找 Top-K……都要<b>反复取最值</b>。数组每次扫一遍 O(n) 太慢,堆能 <b>O(1) 看、O(log n) 拿走</b>。</span></div>
      </Sec>

      <Sec n={2} title="结构：完全二叉树 + 父≥子 ⇒ 堆顶最大">
        <div className="gd-graph">
          <svg viewBox={`0 0 ${W} 74`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {arr.map((_, i) => i > 0 && (() => { const c = pos(i), p = pos((i - 1) >> 1); return <line key={`e${i}`} x1={p.x} y1={p.y} x2={c.x} y2={c.y} stroke="var(--line)" strokeWidth="0.7" /> })())}
            {arr.map((v, i) => { const { x, y } = pos(i); return (
              <g key={i}>
                <circle cx={x} cy={y} r="8" fill={i === 0 ? 'color-mix(in srgb,var(--now) 22%,var(--panel))' : 'var(--panel)'} stroke={i === 0 ? 'var(--now)' : 'var(--line)'} strokeWidth={i === 0 ? 1.4 : 0.7} />
                <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fontWeight={700} fill="var(--ink)">{v}</text>
              </g>
            ) })}
            <text x={pos(0).x + 12} y={pos(0).y - 4} fontSize="6" fill="var(--now)">堆顶=最大</text>
            <text x="6" y="72" fontSize="5.5" fill="var(--faint)">数组:下标 i 的孩子在 2i+1、2i+2,父在 (i-1)/2</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>堆序只管<b>父≥子</b>(不管左右谁大),但这已足够让<b>根永远是全体最大</b>。完全二叉树能紧凑压进数组,靠下标算孩子/父,<b>不用指针</b>。</span></div>
      </Sec>

      <Sec n={3} title="维护：sift-down 下沉 + 取顶补位">
        <div className="gd-lane">
          <div className="gd-card i"><h4>sift-down</h4><p>节点比孩子小,就和<em>更大的孩子</em>交换、一路沉到位。建堆=倒着对每个节点下沉,O(n)。</p></div>
          <div className="gd-card hit"><h4>取最大</h4><p>堆顶↔末尾(最大<em>排到尾就位</em>)、堆减一、新顶下沉复原。反复做=<em>堆排序</em> O(n log n)。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>优先队列的标配:任务调度、Dijkstra/Prim、哈夫曼每次取两最小、Top-K、合并 K 路有序流,底层几乎都是堆。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '完全二叉树' }, { cls: 'pd', text: '父≥子' },
          { cls: 'pi', text: '堆顶=最大' }, { cls: 'pt', text: 'sift-down 下沉' },
          { cls: 'ph', text: '取顶 O(log n)' },
        ]}
        why={<><b>为什么"堆"是数据结构里性价比最高的一个:</b>它用一条极简单的规则,换来了一个到处都缺的能力——随时高效取最值。规则简单到近乎偷懒:只要求每个父节点不小于它的孩子,完全不管兄弟之间谁大谁小。正是这种"只约束父子、不约束全局"的松弛,让维护成本被压到 O(log n):插入或删除后,只有一条从根到叶的路径可能违规,顺着它下沉或上浮一趟就修好了。而它选择完全二叉树,又让整棵树能无缝铺进一个数组——孩子在 2i+1、2i+2,父亲在 (i-1)/2,连指针和额外内存都省了,缓存还友好。把"取最大"反复执行,就顺带得到了原地、O(n log n) 的堆排序。掌握它,你会在无数系统里认出它的骨架:操作系统的任务调度、Dijkstra 和 Prim 里"取当前最优"、哈夫曼编码反复合并两个最小、事件驱动仿真的时间队列、大数据里维护 Top-K、外部排序合并 K 路有序流——优先队列这个抽象一旦到手,这些问题就都塌缩成同一个模式。</>} />
    </Shell>
  )
}

function QuickSortDiagram() {
  // partition 前后：[5,2,8,1,9,3,7] 以 7 为基准 → 小的左、7归位、大的右
  const before = [5, 2, 8, 1, 9, 3, 7]
  const after = [5, 2, 1, 3, 7, 8, 9]   // 7 落到 #4，左<7、右≥7
  const cell = (v: number, k: number, arr: number[], pivotPos: number) => {
    const isPivot = k === pivotPos
    const isLeft = pivotPos >= 0 && k < pivotPos
    return (
      <g key={k} transform={`translate(${8 + k * 30}, 0)`}>
        <rect x="0" y="0" width="26" height="18" rx="3"
          fill={isPivot ? 'color-mix(in srgb,var(--now) 26%,var(--panel))' : isLeft ? 'color-mix(in srgb,var(--now) 10%,var(--panel))' : 'var(--panel)'}
          stroke={isPivot ? 'var(--now)' : 'var(--line)'} strokeWidth={isPivot ? 1.4 : 0.6} />
        <text x="13" y="12.5" textAnchor="middle" fontSize="9" fontWeight={isPivot ? 800 : 500} fill="var(--ink)">{v}</text>
      </g>
    )
  }
  return (
    <Shell icon={Icn.ruler} title="快速排序原理"
      sub="看懂：选个基准，小的甩左、大的甩右，分而治之">
      <Sec n={1} title="一趟分区：基准落到最终位置">
        <div className="gd-graph">
          <svg viewBox="0 0 224 66" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="8" y="10" fontSize="6" fill="var(--faint)">分区前(基准=末尾 7)</text>
            <g transform="translate(0,14)">{before.map((v, k) => cell(v, k, before, 6))}</g>
            <text x="8" y="46" fontSize="6" fill="var(--faint)">分区后:7 归位,左＜7、右≥7</text>
            <g transform="translate(0,50)">{after.map((v, k) => cell(v, k, after, 4))}</g>
          </svg>
        </div>
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>挑一个<b>基准 pivot</b>,扫一遍把<b>比它小的甩左、不小于的留右</b>。这趟扫完,基准就落到<b>最终该在的位置</b>(左全小、右全不小)——此位<b>永久锁定</b>,再不用动。</span></div>
      </Sec>

      <Sec n={2} title="分而治之：对左右两段各自递归">
        <div className="gd-lane">
          <div className="gd-card i"><h4>切成两半</h4><p>一次分区定死<em>一个</em>基准的位置,同时把区间切成<em>独立的左段、右段</em>。</p></div>
          <div className="gd-card i"><h4>递归到底</h4><p>对两段重复挑基准+分区,<em>段越切越短</em>,到长度 1(天然有序)就停。</p></div>
          <div className="gd-card hit"><h4>平均 O(n log n)</h4><p>约 log n 层、每层扫 n,<em>原地、常数小</em>,实践中最快的通用排序。</p></div>
        </div>
      </Sec>

      <Sec n={3} title="软肋：基准挑得不均就退化">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>若每次都挑到最大/最小(如对近乎有序的数据取末元素),分区切得极不均→退化到 <b>O(n²)</b>。实践用<b>随机基准</b>或<b>三数取中</b>规避。归并(稳定要空间)、堆排序(最坏也 O(n log n))是另两大经典。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '挑一个基准' }, { cls: 'pd', text: '小的甩左、大的留右' },
          { cls: 'pi', text: '基准归位=最终位置' }, { cls: 'pt', text: '切成左右两段' },
          { cls: 'ph', text: '各自递归到 1' },
        ]}
        why={<><b>为什么"快速排序"是分治思想最漂亮的一课:</b>它面对"把 n 个数排好"这个看似要做 n² 次比较的问题,找到了一个杠杆——一趟线性扫描,只做一件事:挑一个基准,把小的拨到一边、大的拨到另一边。这一趟的回报是双重的:基准本身被放进了它最终的位置、从此不用再管;而更关键的是,原来纠缠在一起的 n 个数,被这一刀切成了两组互不相干的子问题。于是同样的手法递归地作用在两半上,每一层把所有区间合起来扫一遍是 O(n),而区间平均每层减半、只需 log n 层,总代价就落到了 O(n log n)。它还几乎不占额外内存、常数因子小、对缓存友好,所以成了工业界默认的通用排序。掌握它,你会看清分治的套路——把大问题划成同类的小问题、分别解决再合起来,也会对它的脆弱有敬畏:一旦基准挑得失衡,划分退化成一长一短,层数从 log n 恶化到 n,优雅的 O(n log n) 就崩成 O(n²)。这种"平均极快、最坏很糟、靠随机化拉回期望"的权衡,本身就是算法设计里反复出现的一课。</>} />
    </Shell>
  )
}

function MergeSortDiagram() {
  // 归并两个有序段 [2,5] 与 [1,8] → [1,2,5,8]
  const L = [2, 5], R = [1, 8], out = [1, 2, 5, 8]
  const cell = (v: number, x: number, y: number, fill: string, stroke: string) => (
    <g transform={`translate(${x},${y})`}>
      <rect width="20" height="16" rx="3" fill={fill} stroke={stroke} strokeWidth="0.8" />
      <text x="10" y="11.5" textAnchor="middle" fontSize="8.5" fontWeight={600} fill="var(--ink)">{v}</text>
    </g>
  )
  return (
    <Shell icon={Icn.ruler} title="归并排序原理"
      sub="看懂：分到不能再分，再两两有序地合并回去">
      <Sec n={1} title="核心：合并两个有序段，只需比队首">
        <div className="gd-graph">
          <svg viewBox="0 0 200 72" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="6" y="10" fontSize="6" fill="#3b82f6">左段(已排)</text>
            {L.map((v, k) => cell(v, 60 + k * 24, 3, 'color-mix(in srgb,#3b82f6 16%,var(--panel))', '#3b82f6'))}
            <text x="6" y="30" fontSize="6" fill="var(--now)">右段(已排)</text>
            {R.map((v, k) => cell(v, 60 + k * 24, 23, 'color-mix(in srgb,var(--now) 16%,var(--panel))', 'var(--now)'))}
            <text x="6" y="58" fontSize="6" fill="var(--hit)">输出:比队首取小的</text>
            {out.map((v, k) => cell(v, 60 + k * 24, 51, 'color-mix(in srgb,var(--hit) 16%,var(--panel))', 'var(--hit)'))}
            <text x="150" y="30" fontSize="5.5" fill="var(--faint)">1&lt;2 取1、2&lt;8 取2…</text>
          </svg>
        </div>
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>两段各自<b>已有序</b> ⇒ 各自<b>队首就是各自最小</b>。比一下、把小的先接进输出,取走谁谁的队首前移——<b>一趟线性</b>就把两段拼成更长的有序段。</span></div>
      </Sec>

      <Sec n={2} title="分而治之：拆到长度 1，再逐层合并">
        <div className="gd-lane">
          <div className="gd-card i"><h4>拆到底</h4><p>不断对半拆,拆到<em>每段只剩 1 个</em>——单个元素<em>天生有序</em>。</p></div>
          <div className="gd-card i"><h4>段宽翻倍</h4><p>两两归并:1→2→4→8…<em>每轮把相邻两段合成更长有序段</em>。</p></div>
          <div className="gd-card hit"><h4>稳稳 O(n log n)</h4><p>log n 轮 × 每轮扫 n。<em>稳定、最坏也 O(n log n)</em>,代价是额外缓冲。</p></div>
        </div>
      </Sec>

      <Sec n={3} title="它擅长的：外部排序、稳定、链表">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>数据大到<b>内存装不下</b>?切成块各自排好,再<b>多路归并</b>——靠的就是"合并有序段只需比队首"。稳定排序、链表排序也用它。和快排(平均最快、原地)、堆排序(原地、最坏也 O(n log n))并称三大经典。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '拆到长度 1' }, { cls: 'pd', text: '两两归并' },
          { cls: 'pi', text: '比队首取小的' }, { cls: 'pt', text: '段宽翻倍' },
          { cls: 'ph', text: '稳定 O(n log n)' },
        ]}
        why={<><b>为什么"归并排序"是理解分治与外部排序的关键一课:</b>它把排序问题拆成一个几乎显然的子操作——合并两个已经有序的序列。这个操作之所以快,是因为它把"有序"这个前提用到了极致:既然两段各自有序,各自的最小值就摆在队首,合并就退化成反复比较两个队首、取走较小的一个,一趟线性扫描而已。有了这块积木,整个算法就是不断把数组对半拆到不能再拆(长度 1 天生有序),再自底向上逐层归并,段长每轮翻倍,log n 轮就排好,而且无论输入多刁钻都稳稳 O(n log n),还天然稳定。它最深远的意义在于点破了外部排序:当数据大到内存装不下,你没法整体快排,但可以把它切成能装下的块、逐块排好写回磁盘,再用多路归并把这些有序块合成最终结果——数据库的排序、大文件排序、MapReduce 的 shuffle 阶段,底层都是这套"分块排好、多路归并"。掌握它,你就同时握住了分治的第二种姿态(先分到底、再合并),和处理超出内存规模数据的通用思路。</>} />
    </Shell>
  )
}

function FastPowDiagram() {
  const a = 3, n = 13, bits = [1, 1, 0, 1]   // 13 = 1101₂
  const nb = bits.length
  return (
    <Shell icon={Icn.ruler} title="快速幂原理"
      sub="看懂：指数拆二进制，反复平方 + 挑位相乘">
      <Sec n={1} title="关键：把指数写成二进制">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>{n} = <b>1101₂</b> = 8+4+1。指数相加=幂相乘,所以 <b>{a}¹³ = {a}⁸·{a}⁴·{a}¹</b>——只用到 {a}¹,{a}²,{a}⁴,{a}⁸ 这几个"2 的幂次"的幂。</span></div>
      </Sec>

      <Sec n={2} title="做法：base 反复平方，是1的位就乘入">
        <div className="gd-graph">
          <svg viewBox="0 0 220 66" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {bits.map((b, j) => {
              const kk = nb - 1 - j, pow = a ** (2 ** kk), x = 10 + j * 52
              return (
                <g key={j} transform={`translate(${x},0)`}>
                  <rect x="0" y="4" width="44" height="40" rx="4"
                    fill={b ? 'color-mix(in srgb,var(--hit) 12%,var(--panel))' : 'var(--panel)'}
                    stroke={b ? 'var(--hit)' : 'var(--line)'} strokeWidth={b ? 1.2 : 0.6} opacity={b ? 1 : 0.55} />
                  <text x="22" y="20" textAnchor="middle" fontSize="15" fontWeight={800} fill={b ? 'var(--hit)' : 'var(--faint)'}>{b}</text>
                  <text x="22" y="31" textAnchor="middle" fontSize="6" fill="var(--faint)">值 {2 ** kk}</text>
                  <text x="22" y="40" textAnchor="middle" fontSize="6.5" fill="var(--ink)">{a}^{2 ** kk}={pow}</text>
                  {b === 1 && <text x="22" y="52" textAnchor="middle" fontSize="5.5" fill="var(--hit)">✓ 乘入</text>}
                </g>
              )
            })}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>base 从 {a} 开始<b>不断平方</b>:{a}→9→81→6561(每个是上一个的平方,只需 log n 次)。扫二进制:<b>是 1 的位</b>就把当前 base <b>乘进结果</b>、0 就跳。{a}·81·6561 = <b>1594323</b>。</span></div>
      </Sec>

      <Sec n={3} title="效率：log n 而非 n">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>{a}¹³ 只 6 步</h4><p>3 次平方 + 3 次乘 = 6,朴素要 <em>乘 13 次</em>。n=10⁹ 也就 ~30 步。</p></div>
          <div className="gd-card i"><h4>它撑起了什么</h4><p><em>模幂</em>(RSA 加解密算 a^n mod m)、<em>矩阵快速幂</em>(O(log n) 求斐波那契等线性递推)。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '指数写成二进制' }, { cls: 'pd', text: 'base 反复平方' },
          { cls: 'pi', text: '是1的位乘入结果' }, { cls: 'pt', text: '是0跳过' },
          { cls: 'ph', text: 'O(log n) 步' },
        ]}
        why={<><b>为什么"快速幂"是把二进制变成算法加速器的经典一课:</b>它面对"算 a 的 n 次方"这个看似必须乘 n 次的问题,发现了一条捷径——把指数拆成二进制。因为指数相加对应幂相乘,任何 n 都能写成若干个 2 的幂之和,于是 a^n 就等于对应的那几个 a^(2^k) 相乘;而这些以 2 为台阶的幂,每一个恰好是前一个的平方,只需 log n 次平方就能全部备齐。算法因此退化成:一边平方、一边照着指数的二进制位挑着乘,总步数从 n 掉到 log n。这个差距在大数上是决定性的:指数有几百位时,n 次乘法是天文数字,而 log n 只有几百次。它最重要的现实意义在密码学——RSA、Diffie-Hellman 都要计算超大数的模幂 a^n mod m,正是快速幂(每步顺带取模)让公钥加密从理论变成了每天在跑的东西。同样的"用二进制拆解来加速"还能推广到矩阵快速幂,把线性递推压到对数时间。它和二分查找是同一枚硬币的两面:每一步都把问题规模砍掉一半,所以都住在 log n 这个优雅的复杂度里。</>} />
    </Shell>
  )
}

function AStarDiagram() {
  // 8×5 迷你网格：墙 col4 row0-2，起点(0,2) 终点(7,2)，示意最短路
  const W = 8, H = 5, cell = 22, ox = 8, oy = 6
  const walls = new Set(['4,0', '4,1', '4,2'])
  const path = new Set(['0,2', '1,2', '2,2', '3,2', '3,3', '4,3', '5,3', '6,3', '7,3', '7,2'])
  const key = (c: number, r: number) => `${c},${r}`
  return (
    <Shell icon={Icn.pin} title="A* 寻路原理"
      sub="看懂：f = 已走 g + 到终点估计 h，优先探最有希望的格">
      <Sec n={1} title="给搜索装方向：f = g + h">
        <div className="gd-lane">
          <div className="gd-card i"><h4>g 已走代价</h4><p>从起点到这里的<em>真实步数</em>——防止为眼前近而走冤枉路。</p></div>
          <div className="gd-card i"><h4>h 乐观估计</h4><p>到终点<em>大概还多远</em>(曼哈顿距离,永不高估)——像指南针拽向终点。</p></div>
          <div className="gd-card hit"><h4>f = g + h</h4><p>总先展开 <em>f 最小</em>的格:兼顾"走了多少"和"还差多少"。</p></div>
        </div>
      </Sec>

      <Sec n={2} title="效果：沿 h 直扑终点，撞墙才绕行">
        <div className="gd-graph">
          <svg viewBox={`0 0 ${ox * 2 + W * cell} ${oy * 2 + H * cell}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => {
              const kk = key(c, r), isWall = walls.has(kk), onPath = path.has(kk)
              const isS = c === 0 && r === 2, isG = c === 7 && r === 2
              return (
                <g key={kk}>
                  <rect x={ox + c * cell} y={oy + r * cell} width={cell - 2} height={cell - 2} rx="2"
                    fill={isWall ? 'color-mix(in srgb,var(--ink) 62%,var(--panel))'
                      : onPath ? 'color-mix(in srgb,var(--hit) 26%,var(--panel))' : 'var(--panel)'}
                    stroke={isS ? 'var(--hit)' : isG ? 'var(--miss)' : 'var(--line)'} strokeWidth={isS || isG ? 1.6 : 0.5} />
                  {isS && <text x={ox + c * cell + cell / 2 - 1} y={oy + r * cell + cell / 2 + 2} textAnchor="middle" fontSize="10" fontWeight={800} fill="var(--hit)">S</text>}
                  {isG && <text x={ox + c * cell + cell / 2 - 1} y={oy + r * cell + cell / 2 + 2} textAnchor="middle" fontSize="10" fontWeight={800} fill="var(--miss)">G</text>}
                  {onPath && !isS && !isG && <circle cx={ox + c * cell + cell / 2 - 1} cy={oy + r * cell + cell / 2} r="2.5" fill="var(--hit)" />}
                </g>
              )
            }))}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>起点 S 在左、终点 G 在右,中间一堵墙留下缺口。A* 先沿 h 一路向右(f=7)直扑终点,撞墙后绕到下方(f=9)从缺口穿过。全程<b>只展开 19 格</b>就找到 <b>9 步最短路</b>(绿点)。</span></div>
      </Sec>

      <Sec n={3} title="保证与谱系：h 不高估就最短，h=0 就是 Dijkstra">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>只要 h <b>不高估</b>真实距离(admissible),A* 找到的<b>必是最短路</b>;h 越接近真实、搜索越集中越快。<b>h=0 时退化成 Dijkstra</b>(只看 g、四面均匀铺)。游戏 NPC 寻路、机器人规划、地图导航都靠它,开放集常用堆取 f 最小。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'g 已走步数' }, { cls: 'pd', text: 'h 到终点估计' },
          { cls: 'pi', text: 'f=g+h 排序' }, { cls: 'pt', text: '先探最有希望的' },
          { cls: 'ph', text: 'h不高估=最短路' },
        ]}
        why={<><b>为什么"A*"是启发式搜索的教科书范例:</b>它把两种看似对立的信息优雅地融进一个分数。Dijkstra 只信"已经走了多少"(g),稳妥但没方向,像水波一样四面铺开;贪心最好优先只信"离终点还有多远"(h),有冲劲但会被墙骗、走出弯路还不保证最短。A* 说:都要——f=g+h,既回头看已付出的真实代价、又向前看还剩多远的乐观估计,于是它总在探那些"看起来最有希望"的格子,把搜索牢牢约束在起点到终点的走廊里。更漂亮的是它的理论保证:只要那个"还剩多远"的估计从不高估真实距离(admissible),A* 找到的第一条到终点的路就一定是最短的——启发信息带来了速度,却没牺牲最优性。这条谱系一头连着 Dijkstra(把 h 调成 0,A* 就退化成它)、一头连着贪心(把 g 忽略),A* 恰在中间取得平衡。掌握它,你就握住了"用一个廉价估计给盲目搜索装方向、同时守住最优保证"的通用套路——游戏 AI、机器人路径规划、地图导航,乃至各种状态空间搜索,底层都是这一招。</>} />
    </Shell>
  )
}

function PerceptronDiagram() {
  // 6 点 + 收敛后的线 w=(-3,2) b=1
  const pts: [number, number, number][] = [[1, 2, 1], [2, 3, 1], [2, 4, 1], [3, 2, -1], [4, 3, -1], [4, 1, -1]]
  const LO = -0.5, HI = 5.5, S = 84, ox = 8, oy = 4
  const px = (x: number) => ox + (x - LO) / (HI - LO) * S
  const py = (y: number) => oy + S - (y - LO) / (HI - LO) * S
  const yb = (x: number) => -(-3 * x + 1) / 2   // w=(-3,2) b=1 → y=(3x-1)/2
  return (
    <Shell icon={Icn.chip} title="感知机 Perceptron 原理"
      sub="看懂：一个神经元靠「错了就纠」学出分界线">
      <Sec n={1} title="神经元：w·x+b 看正负判类别">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>给输入各配<b>权重 w</b>、加<b>偏置 b</b>,算 <b>score=w·x+b</b>,看符号判类别。几何上 score=0 就是一条<b>分界线</b>(高维=超平面),一侧判正、一侧判负。</span></div>
      </Sec>

      <Sec n={2} title="学法：错了就纠，把线朝分错的点转">
        <div className="gd-graph">
          <svg viewBox={`0 0 ${ox * 2 + S} ${oy * 2 + S}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <line x1={px(LO)} y1={py(0)} x2={px(HI)} y2={py(0)} stroke="var(--line)" strokeWidth="0.5" />
            <line x1={px(0)} y1={py(LO)} x2={px(0)} y2={py(HI)} stroke="var(--line)" strokeWidth="0.5" />
            <line x1={px(LO)} y1={py(yb(LO))} x2={px(HI)} y2={py(yb(HI))} stroke="var(--now)" strokeWidth="1.2" />
            {pts.map(([x, y, c], k) => (
              <circle key={k} cx={px(x)} cy={py(y)} r="3" fill={c > 0 ? '#3b82f6' : 'var(--now)'} />
            ))}
            <text x={px(1.3)} y={py(3.6)} fontSize="6" fill="#3b82f6">正类</text>
            <text x={px(3.5)} y={py(1.4)} fontSize="6" fill="var(--now)">负类</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>逐点检查:分对了不动;<b>分错了就纠</b>——把权重朝该点挪 <b>w += y·x、b += y</b>(y=±1 真实类别),直觉上就是把线<b>朝被冤枉的点转一下</b>。5 次纠正后线转到位。</span></div>
      </Sec>

      <Sec n={3} title="保证与极限：可分必收敛，异或需多层">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>收敛定理</h4><p>只要两类<em>线性可分</em>,反复扫、错了就纠,<em>有限步内必学到</em>一条全分对的线。</p></div>
          <div className="gd-card i"><h4>它的极限</h4><p>线性不可分(<em>异或 XOR</em>)一条直线分不开 → 催生多层感知机 + 非线性激活 = 神经网络。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它是<b>逻辑回归</b>(换 sigmoid 出概率)、<b>SVM</b>(改最大间隔)、和深度网络里<b>每个神经元</b>的祖先(激活换成硬阈值 sign)。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'w·x+b 判正负' }, { cls: 'pd', text: '逐点检查' },
          { cls: 'pi', text: '分错就纠 w+=y·x' }, { cls: 'pt', text: '线转向该点' },
          { cls: 'ph', text: '零错误=收敛' },
        ]}
        why={<><b>为什么"感知机"是理解神经网络的第一块砖:</b>它把"学习"这件玄乎的事,还原成了一个小到能手算的机械过程——一个神经元就是给输入加权求和、看正负,而学习就是"错了就把线朝分错的点转一下"。这个规则朴素到近乎天真,却蕴含了监督学习的全部精神:用错误当信号、朝减少错误的方向一步步挪参数。它还带着一个漂亮的理论保证——只要数据线性可分,这套盲目的纠错一定在有限步内收敛,这是机器学习史上最早的"可证明会学会"的结果之一。而它的失败同样意义深远:一条直线画不出异或那样的边界,这个看似致命的局限一度让神经网络研究陷入寒冬,直到人们意识到——把许多这样的神经元分层堆叠、用非线性激活连接,再用反向传播统一地纠错,就能逼近任意复杂的边界。今天的深度网络,本质上就是亿万个感知机的后代。掌握它,你就握住了从"一条线"到"深度学习"这整条线索的起点。</>} />
    </Shell>
  )
}

function PoolingDiagram() {
  const img = [[1, 3, 2, 4], [5, 6, 1, 2], [7, 2, 9, 1], [3, 4, 2, 8]]
  const out = [[6, 4], [7, 9]]
  const gray = (v: number) => `color-mix(in srgb, var(--ink) ${Math.round((v / 9) * 74)}%, var(--panel))`
  return (
    <Shell icon={Icn.chip} title="池化 Pooling 原理"
      sub="看懂：小窗口把特征图缩小，只留每块最强/平均的信号">
      <Sec n={1} title="做法：2×2 窗口不重叠，每块汇总成 1 个">
        <div className="gd-graph">
          <svg viewBox="0 0 200 96" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 输入 4×4 */}
            {img.map((row, r) => row.map((v, c) => (
              <g key={`i${r}-${c}`}>
                <rect x={8 + c * 15} y={8 + r * 15} width="14" height="14" rx="1.5" fill={gray(v)} stroke="var(--line)" strokeWidth="0.4" />
                <text x={15 + c * 15} y={18 + r * 15} textAnchor="middle" fontSize="7" fill={v > 4.5 ? 'var(--panel)' : 'var(--ink)'}>{v}</text>
              </g>
            )))}
            {/* 四个 2×2 窗口的框 */}
            {[[0, 0], [0, 1], [1, 0], [1, 1]].map(([wr, wc], i) => (
              <rect key={`w${i}`} x={8 + wc * 30} y={8 + wr * 30} width="29" height="29" rx="2" fill="none" stroke="var(--now)" strokeWidth="1" strokeDasharray="2 1.5" />
            ))}
            <text x="100" y="42" fontSize="7" fill="var(--now)">max ⟶</text>
            {/* 输出 2×2 */}
            {out.map((row, r) => row.map((v, c) => (
              <g key={`o${r}-${c}`}>
                <rect x={135 + c * 22} y={20 + r * 22} width="20" height="20" rx="2" fill="color-mix(in srgb,var(--hit) 16%,var(--panel))" stroke="var(--hit)" strokeWidth="0.8" />
                <text x={145 + c * 22} y={33 + r * 22} textAnchor="middle" fontSize="10" fontWeight={700} fill="var(--hit)">{v}</text>
              </g>
            )))}
            <text x="8" y="90" fontSize="6" fill="var(--faint)">输入 4×4</text>
            <text x="135" y="90" fontSize="6" fill="var(--faint)">输出 2×2</text>
          </svg>
        </div>
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>2×2 窗口<b>不重叠</b>地盖过特征图,每块 4 个数<b>汇总成 1 个</b>:<b>最大池化</b>取最大(6/4/7/9,留最强响应)、<b>平均池化</b>取平均(留整体强度)。</span></div>
      </Sec>

      <Sec n={2} title="效果：边长减半、面积 1/4（降采样）">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>省 3/4</h4><p>4×4→2×2,后面层要处理的<em>数据少 3/4</em>,计算/参数骤减。</p></div>
          <div className="gd-card i"><h4>更鲁棒</h4><p>目标在窗口里挪一格,<em>最大值常不变</em>→对位置抖动不敏感。</p></div>
          <div className="gd-card i"><h4>感受野变大</h4><p>越高层每个点<em>概括的原图范围越大</em>,越能看全局。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>池化<b>没有可学参数</b>,是固定的汇总。CNN 里紧跟卷积(LeNet/VGG),后来也常被<b>步长卷积</b>替代(让下采样也可学)。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '2×2 窗口' }, { cls: 'pd', text: '不重叠地滑' },
          { cls: 'pi', text: '每块取最大/平均' }, { cls: 'pt', text: '汇总成 1 个' },
          { cls: 'ph', text: '边长减半=降采样' },
        ]}
        why={<><b>为什么"池化"是 CNN 里不起眼却关键的一环:</b>卷积负责看细节、把边缘纹理提取成特征图,但特征图又大又冗余——相邻位置说的几乎是同一件事。池化用一个近乎偷懒的操作解决它:拿小窗口不重叠地扫,每块只留一个代表值(最大或平均),图就缩小了四分之三。这一缩换来三样东西:计算量和后续参数骤减、对物体精确位置的小抖动更鲁棒(挪一格,最大值往往还是它)、以及感受野随层数快速扩大,让高层神经元从"看局部纹理"变成"看整体结构"。它还有个可爱的性质——没有任何可学参数,纯粹是固定规则,却实实在在地塑造了 CNN 逐层"抽象化"的节奏:图越缩越小、通道越来越多、语义越来越高。理解了卷积提特征、池化抓要点这一对搭档,你就看懂了从 LeNet 到 VGG 这一代卷积网络的骨架;而现代网络把池化换成步长卷积、或用全局平均池化收尾,变的是手段,不变的仍是"用小窗口汇总来降采样"这个核心思想。</>} />
    </Shell>
  )
}

function BeamDiagram() {
  // 束搜索 k=2 的树：root → {A .5, B .4} → 留 BC .32 / AB .20 → BC· .288 胜
  return (
    <Shell icon={Icn.tag} title="束搜索 Beam Search 原理"
      sub="看懂：每步只留最有希望的前 k 条序列">
      <Sec n={1} title="问题：整句概率最大，逐词贪心会掉坑">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>一句话概率=各步词概率<b>连乘</b>。<b>贪心</b>每步只取当前最高——但<b>局部最优≠全局最优</b>:第一步贪 A(0.5＞0.4),后面接不出好句。<b>全搜索</b>枚举所有序列又指数爆炸。</span></div>
      </Sec>

      <Sec n={2} title="做法：维护 k 条候选，每步扩展+剪枝">
        <div className="gd-graph">
          <svg viewBox="0 0 220 96" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* root */}
            <circle cx="16" cy="48" r="7" fill="var(--panel)" stroke="var(--line)" strokeWidth="0.8" />
            <text x="16" y="50.5" textAnchor="middle" fontSize="6" fill="var(--faint)">起</text>
            {/* step1 A/B kept, C pruned */}
            {[['A', 20, 0.5, true], ['B', 48, 0.4, true], ['C', 76, 0.1, false]].map(([t, y, p, keep], i) => (
              <g key={i}>
                <line x1="23" y1="48" x2="63" y2={y as number} stroke={keep ? 'var(--hit)' : 'var(--line)'} strokeWidth="0.7" opacity={keep ? 1 : 0.4} />
                <circle cx="70" cy={y as number} r="7" fill={keep ? 'color-mix(in srgb,var(--hit) 12%,var(--panel))' : 'var(--panel)'} stroke={keep ? 'var(--hit)' : 'var(--line)'} strokeWidth="0.8" opacity={keep ? 1 : 0.45} />
                <text x="70" y={(y as number) + 2.5} textAnchor="middle" fontSize="7" fill="var(--ink)" opacity={keep ? 1 : 0.45}>{t as string}</text>
                <text x="70" y={(y as number) - 9} textAnchor="middle" fontSize="5" fill="var(--faint)" opacity={keep ? 1 : 0.45}>{p as number}</text>
              </g>
            ))}
            <text x="70" y="94" textAnchor="middle" fontSize="5" fill="var(--faint)">第1步:留A、B(剪C)</text>
            {/* step2 kept BC .32 AB .20 */}
            {[['BC', 20, 0.32, 'B'], ['AB', 48, 0.2, 'A']].map(([t, y, p], i) => (
              <g key={i}>
                <line x1="77" y1={i === 0 ? 48 : 20} x2="123" y2={y as number} stroke="var(--hit)" strokeWidth="0.7" />
                <circle cx="130" cy={y as number} r="8" fill="color-mix(in srgb,var(--hit) 12%,var(--panel))" stroke="var(--hit)" strokeWidth="0.8" />
                <text x="130" y={(y as number) + 2.5} textAnchor="middle" fontSize="6.5" fill="var(--ink)">{t as string}</text>
                <text x="130" y={(y as number) - 10} textAnchor="middle" fontSize="5" fill="var(--faint)">{p as number}</text>
              </g>
            ))}
            {/* step3 winner BC· .288 */}
            <line x1="138" y1="20" x2="184" y2="30" stroke="var(--hit)" strokeWidth="1" />
            <line x1="138" y1="48" x2="184" y2="60" stroke="var(--line)" strokeWidth="0.6" opacity="0.5" />
            <rect x="184" y="22" width="30" height="16" rx="3" fill="color-mix(in srgb,var(--hit) 18%,var(--panel))" stroke="var(--hit)" strokeWidth="1" />
            <text x="199" y="32.5" textAnchor="middle" fontSize="6.5" fontWeight={700} fill="var(--hit)">BC· .288</text>
            <rect x="184" y="52" width="30" height="16" rx="3" fill="var(--panel)" stroke="var(--line)" strokeWidth="0.6" opacity="0.6" />
            <text x="199" y="62.5" textAnchor="middle" fontSize="6.5" fill="var(--faint)">AB· .10</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>束宽 k=2:每步把 k 条各扩一词、按<b>累积概率排序、只留前 k 条</b>,其余剪掉。<b>k=1 就是贪心、k=∞ 就是全搜索</b>——束搜索取中间。</span></div>
      </Sec>

      <Sec n={3} title="结果：留住 B，找到贪心错过的更优整句">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>束搜索 0.288</h4><p>同时留着 B,发现 <em>B→C→⟨end⟩</em> 高概率通路,走出 BC⟨end⟩。</p></div>
          <div className="gd-card i"><h4>贪心 0.10</h4><p>第一步贪 A 被<em>锁进</em> AB⟨end⟩——近 3 倍地输。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>机器翻译、摘要、受限生成的标配(配<b>长度归一化</b>等);对照<b>随机采样</b>(温度/top-k/top-p,追求多样)——一个求最优、一个求创意。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '维护 k 条候选' }, { cls: 'pd', text: '每条各扩一词' },
          { cls: 'pi', text: '按累积概率排序' }, { cls: 'pt', text: '只留前 k 条' },
          { cls: 'ph', text: '胜过贪心' },
        ]}
        why={<><b>为什么"束搜索"是理解大模型解码的关键一课:</b>它回答了一个容易被忽略的问题——模型给出每步的概率之后,到底怎么把它们拼成一句话?最省事的贪心每步只咬当前最高,却常因小失大:语言里一个当下略逊的词,往往是通向一整句好话的入口,贪心一步踏错就再也回不了头。而穷举所有词序列在指数爆炸面前毫无可行性。束搜索用一个朴素而有效的折中破局:始终只攥住 k 条最有希望的半成品句子,每步让它们各生长一个词,再按到目前为止的累积概率狠心筛掉多余的、只留前 k 条。这样它既保留了贪心的高效(每步工作量恒定),又拿回了一点全局视野(不把鸡蛋放一个篮子),k 这个旋钮则在"更快更贪"和"更慢更优"之间平滑滑动——拧到 1 就是贪心,拧到无穷就是全搜索。它是机器翻译、摘要、语音识别这些"有标准答案"任务的默认解码法;而它与随机采样的分野,正好点破了大模型的双面性:要确定与最优就用束搜索,要多样与创意就用采样。掌握它,你就理解了同一个模型为何能既严谨又天马行空——差别常常只在解码策略这一步。</>} />
    </Shell>
  )
}

function RNNDiagram() {
  const xs = [2, -1, 3, -2], hs = [0.762, 0.109, 0.92, -0.258]
  const hcol = (h: number) => h >= 0 ? `color-mix(in srgb,#3b82f6 ${Math.round(Math.abs(h) * 55)}%,var(--panel))` : `color-mix(in srgb,var(--now) ${Math.round(Math.abs(h) * 55)}%,var(--panel))`
  return (
    <Shell icon={Icn.chip} title="循环神经网络 RNN 原理"
      sub="看懂：一个隐藏状态沿时间流动，把「过去」记在里面">
      <Sec n={1} title="展开成时间链：记忆 h 沿时间传递">
        <div className="gd-graph">
          <svg viewBox="0 0 220 76" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* h0 */}
            <rect x="4" y="20" width="26" height="16" rx="3" fill="var(--panel)" stroke="var(--line)" strokeWidth="0.6" />
            <text x="17" y="30.5" textAnchor="middle" fontSize="7" fill="var(--faint)">0</text>
            <text x="17" y="44" textAnchor="middle" fontSize="5" fill="var(--faint)">h₀</text>
            {xs.map((x, k) => {
              const bx = 34 + k * 46
              return (
                <g key={k}>
                  {/* 横向记忆流箭头 */}
                  <line x1={bx - 4} y1="28" x2={bx} y2="28" stroke="var(--faint)" strokeWidth="0.7" markerEnd="url(#rnna)" />
                  {/* 隐藏 h */}
                  <rect x={bx} y="20" width="30" height="16" rx="3" fill={hcol(hs[k])} stroke="var(--line)" strokeWidth="0.6" />
                  <text x={bx + 15} y="30.5" textAnchor="middle" fontSize="7" fontWeight={600} fill="var(--ink)">{hs[k]}</text>
                  <text x={bx + 15} y="44" textAnchor="middle" fontSize="5" fill="var(--faint)">h{k + 1}</text>
                  {/* 输入 x 往上 */}
                  <line x1={bx + 15} y1="62" x2={bx + 15} y2="38" stroke="var(--faint)" strokeWidth="0.7" markerEnd="url(#rnna)" />
                  <rect x={bx + 4} y="62" width="22" height="12" rx="2" fill="var(--panel-2)" stroke="var(--line)" strokeWidth="0.5" />
                  <text x={bx + 15} y="70.5" textAnchor="middle" fontSize="6" fill="var(--dim)">{x}</text>
                </g>
              )
            })}
            <defs><marker id="rnna" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="var(--faint)" /></marker></defs>
          </svg>
        </div>
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>每步的 h(记忆)同时吃<b>当前输入 x_t</b>(往上的箭头)和<b>上一刻记忆 h_{'{'}t-1{'}'}</b>(横向箭头):<b>h_t = tanh(wx·x_t + wh·h_{'{'}t-1{'}'} + b)</b>。所以 h_t 里藏着到此为止的整段历史。</span></div>
      </Sec>

      <Sec n={2} title="两大关键：权重共享 + 记忆藏历史">
        <div className="gd-lane">
          <div className="gd-card i"><h4>权重共享</h4><p>所有时刻用<em>同一组 wx、wh、b</em>(像 CNN 共享卷积核)→ 能吃<em>任意长</em>序列。</p></div>
          <div className="gd-card hit"><h4>记忆藏历史</h4><p>同样末输入 +2:历史 [2]→h=0.923、[−3]→h=0.269。<em>历史不同,记忆就不同</em>。</p></div>
        </div>
      </Sec>

      <Sec n={3} title="它的软肋与后继：梯度消失 → 门控 → 注意力">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>序列一长,记忆经过很多步 tanh 挤压、早期信息被冲淡=<b>梯度消失</b>,学不到长距离依赖。于是 <b>LSTM/GRU</b> 给记忆装门控、再到 <b>Transformer 注意力</b>让每个位置直接看全序列。但"用一个状态承载上下文"的思想一直都在。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '隐藏状态 h=记忆' }, { cls: 'pd', text: '沿时间传递' },
          { cls: 'pi', text: '吃当前x+上刻h' }, { cls: 'pt', text: '权重所有时刻共享' },
          { cls: 'ph', text: 'h 藏全部历史' },
        ]}
        why={<><b>为什么"RNN"是理解序列建模的起点:</b>它回答了一个之前的网络回避的问题——面对一句可长可短、前后相关的话,网络怎么记住读过的东西?RNN 的答案朴素而深刻:引入一个隐藏状态当"记忆",让它沿时间一步步流动,每读一个新元素,就用同一套权重把当前输入和上一刻记忆揉成新记忆。这一个设计同时解决了两件事:权重共享让它能吞任意长度的序列,而记忆的递归传递让每一步的表示都带着全部历史的印记——同样的当前输入,历史不同,内部状态就不同,这正是"上下文"的数学化身。它也第一次让神经网络有了"时间"的维度。理解了这条,你不仅看懂了语言模型、翻译、语音识别的第一代主力,更握住了一条清晰的进化线索:RNN 因长序列的梯度消失而受限,催生了 LSTM/GRU 用门控精细地读写记忆,最终 Transformer 用注意力让每个位置直接访问全序列、彻底摆脱了逐步递归的瓶颈。但从 RNN 到今天的大模型,"用一个可更新的状态承载上下文"这个核心直觉,始终未变。</>} />
    </Shell>
  )
}

function WordVecDiagram() {
  const words: [string, number, number][] = [['男人', 0, 0], ['女人', 0, 1], ['国王', 1, 0], ['王后', 1, 1]]
  const XLO = -0.4, XHI = 1.5, YLO = -0.4, YHI = 1.4, S = 76, ox = 30, oy = 6
  const px = (x: number) => ox + (x - XLO) / (XHI - XLO) * S
  const py = (y: number) => oy + S - (y - YLO) / (YHI - YLO) * S
  return (
    <Shell icon={Icn.chip} title="词向量 Word2Vec 原理"
      sub="看懂：意思变成位置，语义关系变成可加减的方向">
      <Sec n={1} title="核心：语义关系 = 向量方向">
        <div className="gd-graph">
          <svg viewBox={`0 0 ${ox + S + 20} ${oy * 2 + S}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <line x1={px(XLO)} y1={py(0)} x2={px(XHI)} y2={py(0)} stroke="var(--line)" strokeWidth="0.5" />
            <line x1={px(0)} y1={py(YLO)} x2={px(0)} y2={py(YHI)} stroke="var(--line)" strokeWidth="0.5" />
            {/* 国王-男人 方向（实线）与 女人→王后（虚线，平行） */}
            <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(0)} stroke="var(--now)" strokeWidth="1.2" markerEnd="url(#wva)" />
            <line x1={px(0)} y1={py(1)} x2={px(1)} y2={py(1)} stroke="var(--now)" strokeWidth="1.2" strokeDasharray="2.5 1.5" markerEnd="url(#wva)" />
            <defs><marker id="wva" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--now)" /></marker></defs>
            {words.map(([n, x, y], k) => {
              const isQ = n === '王后'
              return (
                <g key={k}>
                  <circle cx={px(x)} cy={py(y)} r={isQ ? 3 : 2.2} fill={isQ ? 'var(--hit)' : 'var(--ink)'} />
                  <text x={px(x) + 4} y={py(y) - 3} fontSize="6.5" fontWeight={isQ ? 700 : 500} fill={isQ ? 'var(--hit)' : 'var(--ink)'}>{n}</text>
                </g>
              )
            })}
            <text x={px(0.5)} y={py(0) + 8} textAnchor="middle" fontSize="5" fill="var(--now)">王室方向</text>
            <text x={ox + S + 2} y={py(0) + 3} fontSize="5.5" fill="var(--faint)">王室度→</text>
            <text x={px(0) + 2} y={oy + 6} fontSize="5.5" fill="var(--faint)">性别↑</text>
          </svg>
        </div>
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span><b>国王 − 男人 = (1,0)</b> 正是"王室"方向;把它接到"女人"上(虚线,平行四边形),终点 (1,1) 落在 <b>王后</b>——所以<b>国王 − 男人 + 女人 ≈ 王后</b>。</span></div>
      </Sec>

      <Sec n={2} title="怎么学到的：分布假设 + 拉近共现">
        <div className="gd-lane">
          <div className="gd-card i"><h4>分布假设</h4><p>词的意思<em>由上下文决定</em>:猫/狗都挨着"宠物、喂食",所以向量相近。</p></div>
          <div className="gd-card i"><h4>skip-gram / CBOW</h4><p>拿海量文本,不断把<em>共现的词向量相互拉近</em>,相似词自然聚成一团。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>真实词向量是<b>几百维</b>、从语料自动学(这张图为了好画只用 2 维)。<b>实验里那些坐标是真从共现算出来的</b>:数共现 → PPMI → 特征分解。Levy & Goldberg 2014 证明过,<b>skip-gram 本质上就是在隐式分解 PMI 矩阵</b>。</span></div>
      </Sec>

      {/*  2026-09-09 补厚：老版本三节讲完就收，而这个著名例子**有多硬**从来没交代过。
           实测值见 tests/thicken-ml.test.ts，别按记忆填。 */}
      <Sec n={3} title="这个著名例子到底有多硬">
        <div className="gd-lane">
          <div className="gd-card miss"><h4>要先把输入词排除掉</h4><p>a−b+c 这个向量<em>离 a 和 c 本来就很近</em>(才挪了一小步)。不排除的话最近邻常常就是<b>「国王」自己</b>——实测 9 档里有 <b>8 档</b>是这样。所以标准评测都要排除 a、b、c。<em>(Linzen 2016 专门写过。)</em></p></div>
          <div className="gd-card o"><h4>「排第一」≠「分得开」</h4><p>少语料/低维那几档,第一名和第二名的余弦相似度<em>差不多是 0</em>——王后、王子、公主<b>挤成一团</b>,"最近邻是王后"只是排序碰巧。<b>只看排第一会把假成立判成成功。</b></p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>9 档(3 档语料 × 3 档维度)里 <b>8 档</b>最近邻是「王后」,可其中还有 2 档是"分不开"的假成立,真正<b>又对又分得开</b>的只有 <b>6 档</b>;还有 1 档(中语料 2 维)直接选成了「女孩」。<b>别把一个漂亮例子当成普遍规律</b>——换一批关系(反义词、动词时态)成功率掉得厉害。</span></div>
      </Sec>

      <Sec n={4} title="它奠定了什么：大模型的输入层">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>词向量让文字能被<b>数学处理</b>,是 NLP 从符号迈向语义的关键一步。今天所有大模型<b>第一层就是一张词向量表(embedding)</b>,把每个 token 变成向量再送进 Transformer;BERT/GPT 更进一步给出随上下文变化的向量。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '词→稠密向量' }, { cls: 'pd', text: '意思→位置' },
          { cls: 'pi', text: '共现的拉近' }, { cls: 'pt', text: '语义关系→方向' },
          { cls: 'ph', text: '向量能做类比' },
        ]}
        why={<><b>为什么"词向量"是现代 NLP 的奠基一课:</b>它解决了一个根本难题——计算机本来只能把词当成互不相干的符号,看不出任何意义上的远近。Word2Vec 用"一个词的意思由它的上下文决定"这条分布假设,把每个词压进一个连续向量空间,让语义变成了几何:相近的意思落在相近的位置。这一步的意义怎么强调都不为过,因为它第一次让"意思"变得可以计算、可以求距离、可以做加减。而它最惊艳的副产品,是语义关系竟然以向量方向的形式浮现出来——国王之于男人,正如王后之于女人,这组类比在空间里就是两条平行的箭头,于是"国王减男人加女人"真的落在了王后身边。这揭示了一件深刻的事:海量文本里蕴含的语义结构,能被一个简单的目标(拉近共现的词)自动地、无监督地提炼成有几何意义的表示。理解了它,你就看懂了从符号到语义这道分水岭,也看懂了为什么今天每一个大模型的第一层都是一张词向量表——把离散的 token 翻译成连续的向量,是神经网络能对语言动手的前提。从 Word2Vec 的静态向量,到 BERT、GPT 随上下文变化的动态表示,变的是精细程度,不变的是"把词变成可计算的向量"这个起点。</>} />
    </Shell>
  )
}

function LSTMDiagram() {
  const cs = [0.8, 0.8, 0.8, 0.8], roles = ['存', '守', '守', '取']
  const gates = [[0, 1, 0], [1, 0, 0], [1, 0, 0], [1, 0, 1]]   // f,i,o
  return (
    <Shell icon={Icn.chip} title="LSTM 门控原理"
      sub="看懂：给记忆装门，一条几乎不衰减的 cell 传送带扛住长距离依赖">
      <Sec n={1} title="问题：RNN 每步挤压，长序列就忘了">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>普通 RNN 的记忆<b>每步都过 tanh</b>反复挤压,早期信息几步就冲淡=<b>梯度消失</b>,学不到长距离依赖。</span></div>
      </Sec>

      <Sec n={2} title="解法：cell 传送带 + 三个门">
        <div className="gd-graph">
          <svg viewBox="0 0 220 76" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* c0 */}
            <rect x="4" y="8" width="24" height="16" rx="3" fill="var(--panel)" stroke="var(--line)" strokeWidth="0.6" />
            <text x="16" y="18.5" textAnchor="middle" fontSize="7" fill="var(--faint)">0</text>
            {cs.map((v, k) => {
              const bx = 34 + k * 46
              return (
                <g key={k}>
                  <line x1={bx - 6} y1="16" x2={bx} y2="16" stroke="var(--hit)" strokeWidth="1" markerEnd="url(#lsa)" />
                  <rect x={bx} y="8" width="30" height="16" rx="3" fill="color-mix(in srgb,var(--hit) 14%,var(--panel))" stroke="var(--hit)" strokeWidth="0.8" />
                  <text x={bx + 15} y="18.5" textAnchor="middle" fontSize="7.5" fontWeight={700} fill="var(--hit)">{v}</text>
                  <text x={bx + 15} y="33" textAnchor="middle" fontSize="6" fill="var(--faint)">{roles[k]}</text>
                  {/* 三个门 */}
                  {['f', 'i', 'o'].map((g, gi) => (
                    <g key={gi}>
                      <circle cx={bx + 4 + gi * 11} cy="46" r="4" fill={gates[k][gi] ? 'color-mix(in srgb,var(--hit) 30%,var(--panel))' : 'var(--panel-2)'} stroke={gates[k][gi] ? 'var(--hit)' : 'var(--line)'} strokeWidth="0.6" />
                      <text x={bx + 4 + gi * 11} y="48" textAnchor="middle" fontSize="4.5" fill={gates[k][gi] ? 'var(--hit)' : 'var(--faint)'}>{g}</text>
                    </g>
                  ))}
                </g>
              )
            })}
            <text x="4" y="70" fontSize="5.5" fill="var(--faint)">门 f 遗忘 · i 输入 · o 输出（绿=开）</text>
            <defs><marker id="lsa" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="var(--hit)" /></marker></defs>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span><b>c_t = f·c_{'{'}t-1{'}'} + i·c̃</b>(加法为主、近乎线性)。存(开 i 写入)→守(f=1、i=0,记忆<b>原样传下去</b>)→取(开 o 放出)。cell 全程稳在 0.8——<b>RNN 做不到</b>。</span></div>
      </Sec>

      <Sec n={3} title="为什么有效：加法高速路，梯度不衰减">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>f≈1 就守住</h4><p>遗忘门开满、输入门关,旧记忆<em>原封不动</em>传很远,梯度也顺着不衰减。</p></div>
          <div className="gd-card i"><h4>和残差同源</h4><p>加法为主的通路,本质和<em>残差连接给梯度开近路</em>是一家人。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>门是数据算出的 sigmoid(0~1),LSTM 学会"何时记、何时忘、何时说"。<b>GRU</b> 是它的简化;后来 <b>Transformer 注意力</b>让每个位置直接看全序列。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'cell 记忆传送带' }, { cls: 'pd', text: 'c=f·c_prev+i·c̃' },
          { cls: 'pi', text: '遗忘门守/输入门写' }, { cls: 'pt', text: '输出门放' },
          { cls: 'ph', text: '记忆传很远' },
        ]}
        why={<><b>为什么"LSTM"是序列建模史上关键的一跃:</b>它正面回答了普通 RNN 的软肋——记忆每步都被激活函数挤压,长了就忘、梯度也随之消失。LSTM 的答案精巧而深刻:不要让所有信息都挤在那条会被反复压缩的隐藏状态里,而是另开一条细胞状态当"传送带",让它的更新以加法为主、近乎线性。加法是关键,因为一条线性的通路能让信息和梯度原样穿过许多时间步而不衰减——只要遗忘门开着、输入门关着,上一刻的记忆就被整个搬到下一刻。再给这条传送带配上三个由数据自己算出的门,网络就获得了对记忆的精细控制权:该记的时候开输入门写入、无关时关上输入门守住、要用时开输出门读出。于是"长期依赖"这个曾经难倒 RNN 的问题,被"可控的、不衰减的记忆通道"化解了。理解它,你不仅看懂了机器翻译和语音识别在 Transformer 之前的主力引擎,更会捕捉到一条贯穿深度学习的暗线——从 LSTM 的加法记忆通道,到 ResNet 的残差连接,再到 Transformer 里无处不在的残差流,"给梯度和信息开一条不衰减的近路"始终是训练深层网络的命脉。</>} />
    </Shell>
  )
}

function NormDiagram() {
  const mat = [[2, 3, 1], [2, 7, 5], [6, 3, 5], [6, 7, 1]]
  const bnOut = [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]]
  const cellRects = (m: (number | null)[][], ox: number, hl: 'col' | 'row', hi: number, fill: (v: number) => string) =>
    m.flatMap((row, r) => row.map((v, c) => {
      const on = hl === 'col' ? c === hi : r === hi
      return (
        <g key={`${ox}-${r}-${c}`}>
          <rect x={ox + c * 15} y={8 + r * 13} width="13" height="11" rx="1.5" fill={v === null ? 'var(--panel)' : fill(v)} stroke={on ? 'var(--now)' : 'var(--line)'} strokeWidth={on ? 1 : 0.4} />
          {v !== null && <text x={ox + c * 15 + 6.5} y={16 + r * 13} textAnchor="middle" fontSize="6" fill="var(--ink)">{v}</text>}
        </g>
      )
    }))
  return (
    <Shell icon={Icn.chip} title="归一化 BatchNorm / LayerNorm 原理"
      sub="看懂：同一个 (x−μ)/σ，差别只在沿哪条轴">
      <Sec n={1} title="为什么：把激活拉回零均值单位方差">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>深层网络里每层激活分布随训练乱漂,优化变难。归一化做 <b>x̂=(x−μ)/√(σ²+ε)</b> 把它拉回<b>零均值、单位方差</b>,再乘可学 γ、加 β——收敛更快更稳。</span></div>
      </Sec>

      <Sec n={2} title="分水岭：沿样本轴(BatchNorm) vs 沿特征轴(LayerNorm)">
        <div className="gd-graph">
          <svg viewBox="0 0 210 76" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* BatchNorm：高亮一列 */}
            <text x="8" y="6" fontSize="5.5" fill="var(--now)">BatchNorm 沿列(特征跨样本)</text>
            {cellRects(mat, 8, 'col', 0, () => 'color-mix(in srgb,#3b82f6 10%,var(--panel))')}
            <text x="8" y="72" fontSize="5" fill="var(--faint)">行=样本 列=特征</text>
            {/* LayerNorm：高亮一行 */}
            <text x="118" y="6" fontSize="5.5" fill="var(--now)">LayerNorm 沿行(样本跨特征)</text>
            {cellRects(mat, 118, 'row', 0, () => 'color-mix(in srgb,var(--hit) 10%,var(--panel))')}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>把激活看成"<b>样本×特征</b>"的表:<b>BatchNorm</b> 对每个<b>特征</b>、在一批<b>样本</b>上算 μσ(沿列);<b>LayerNorm</b> 对每个<b>样本</b>、在它<b>所有特征</b>上算(沿行)。同一个 (x−μ)/σ,统计的轴一换性质就全变。</span></div>
      </Sec>

      <Sec n={3} title="各自的地盘：依赖 batch 与否">
        <div className="gd-lane">
          <div className="gd-card i"><h4>BatchNorm</h4><p>跨样本统计→<em>依赖 batch</em>:训练/推理不同、小 batch 不稳。CNN 图像常用。</p></div>
          <div className="gd-card hit"><h4>LayerNorm</h4><p>只看样本自己→<em>不依赖 batch</em>、对序列稳。<em>Transformer/RNN 标配</em>(RMSNorm 是其简化)。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '激活分布乱漂' }, { cls: 'pd', text: '(x−μ)/σ 标准化' },
          { cls: 'pi', text: 'BatchNorm 沿样本轴' }, { cls: 'pt', text: 'LayerNorm 沿特征轴' },
          { cls: 'ph', text: '再乘γ加β' },
        ]}
        why={<><b>为什么"归一化"是训练深层网络的隐形功臣:</b>它解决的是一个不显眼却致命的问题——网络越深,每一层看到的输入分布就越随着前面参数的更新而剧烈漂移,优化器像在移动的靶子上打靶,学习率难调、收敛慢、易发散。归一化的思路干净利落:在网络内部反复把激活拉回零均值、单位方差的标准状态,给每一层一个稳定的立足点,再用可学的缩放和偏移把丢掉的自由度还回来。而它最值得玩味的一点,是那条看似技术性的选择——沿哪条轴统计均值方差——竟划出了两大流派的分野。把激活想成一张样本乘特征的表:沿着样本这条轴(每列)统计,就是 BatchNorm,它跨样本借力、在图像 CNN 里表现极好,却因此绑上了 batch,训练推理不一致、小 batch 就抖;沿着特征这条轴(每行)统计,就是 LayerNorm,它只看每个样本自己,天然适配长度不一的序列,于是成了 Transformer 的标准件,连你在别处见过的 RMSNorm 都不过是它省掉减均值的精简版。理解了"沿样本还是沿特征"这一刀,你就一眼看穿了这一整族归一化方法的家谱,也明白了为什么同样一行 (x−μ)/σ,换个方向就换了半部深度学习工程史。</>} />
    </Shell>
  )
}

function RagDiagram() {
  const docs: [string, number, boolean][] = [
    ['猫是肉食动物，主食肉和鱼', 0.9, true],
    ['猫特别爱吃鱼、鸡肉', 0.74, true],
    ['狗需要每天遛弯', 0.34, false],
    ['绿色植物靠光合作用', 0.02, false],
    ['汽车每 5000 公里保养', 0, false],
  ]
  return (
    <Shell icon={Icn.tag} title="RAG 检索增强生成原理"
      sub="看懂：先按相似度检索资料塞进上下文，再据此作答">
      <Sec n={1} title="问题：知识冻结在参数里，会过时、爱编造">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>大模型的知识<b>冻结在训练参数里</b>:会过时、记不住私有资料、遇到不知道的还爱<b>一本正经编造(幻觉)</b>。RAG 给它一场<b>开卷考试</b>。</span></div>
      </Sec>

      <Sec n={2} title="三步：检索 → 增强 → 生成">
        <div className="gd-graph">
          <svg viewBox="0 0 210 96" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="6" y="8" fontSize="5.5" fill="var(--faint)">问题→查询向量,和每篇比相似度,取 top-2(绿)</text>
            {docs.map(([t, sim, hit], k) => (
              <g key={k}>
                <rect x="6" y={12 + k * 15} width="120" height="12" rx="2" fill={hit ? 'color-mix(in srgb,var(--hit) 10%,var(--panel))' : 'var(--panel)'} stroke={hit ? 'var(--hit)' : 'var(--line)'} strokeWidth="0.5" opacity={hit ? 1 : 0.55} />
                <text x="10" y={20.5 + k * 15} fontSize="5.5" fill="var(--ink)" opacity={hit ? 1 : 0.6}>{t}</text>
                <rect x="130" y={14 + k * 15} width={sim * 40} height="8" rx="1.5" fill={hit ? 'var(--hit)' : 'var(--now)'} opacity={hit ? 1 : 0.5} />
                <text x="174" y={20.5 + k * 15} fontSize="5.5" fill="var(--faint)">{sim}</text>
                {hit && <text x="192" y={20.5 + k * 15} fontSize="5" fill="var(--hit)">✓</text>}
              </g>
            ))}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>①<b>检索</b>:问题变向量,和库里每篇比<b>相似度</b>(内积/余弦),取最相关 top-k(=<b>向量最近邻</b>)。②<b>增强</b>:拼进提示词当上下文。③<b>生成</b>:模型据此作答「肉和鱼」。无关的(汽车 0、植物 0.02)落选。</span></div>
      </Sec>

      <Sec n={3} title="好处：有出处、可更新、少幻觉">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>可溯源 + 少幻觉</h4><p>答案<em>有出处</em>(指得出根据哪篇),有资料兜底就<em>不易瞎编</em>。</p></div>
          <div className="gd-card i"><h4>随库更新</h4><p>改文档即可,<em>不用重训</em>几十亿参数;还能接私有/实时数据。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>是问答、客服、文档助手、搜索"AI 概览"的底座。检索质量决定上限,常配切块、重排序(rerank)、查询改写。和微调互补:微调改"模型本身会什么",RAG 给它"外挂一个能查的图书馆"。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '问题变查询向量' }, { cls: 'pd', text: '按相似度检索' },
          { cls: 'pi', text: 'top-k 最相关' }, { cls: 'pt', text: '拼进上下文增强' },
          { cls: 'ph', text: '据此作答有出处' },
        ]}
        why={<><b>为什么"RAG"是大模型落地最重要的一招:</b>它正面回应了大模型最尴尬的三个短板——知识冻结在训练那一刻、进不了你的私有资料、不懂装懂地编造。解法优雅得近乎常识:不让模型闭卷硬背,而是先去一个可随时更新的知识库里,把跟问题最相关的几段资料查出来、摆在它面前,再让它开卷作答。这一"查"字里藏着你早已熟悉的机器学习内核——把问题和资料都编码成向量,按相似度做最近邻检索,正是词向量与 k-NN 的延续;而这一"摆"字,则把大模型的强项(读懂上下文、组织语言)和外部知识的强项(准确、可更新、可溯源)拼到了一起。于是幻觉被有据可查的资料压住,过时的知识靠改文档就能刷新,私有数据无需泄露进训练集也能被用上,而这一切都不必去重新训练一个庞然大物。理解了它,你就看懂了今天几乎每一个企业级问答、客服助手、文档搜索背后的骨架,也明白了为什么"检索"和"生成"这两件看似不搭界的事,合在一起会成为大模型时代最实用的范式——它和微调是互补的两条腿,一条改变模型本身会什么,一条给模型接上一座随时可查的图书馆。</>} />
    </Shell>
  )
}

function SelfConsistDiagram() {
  const chains: [string, number, boolean][] = [
    ['5 + 3×4 = 17', 17, true], ['(5+3)×4 = 32', 32, false],
    ['3×4=12, +5 = 17', 17, true], ['5 + 12 = 17', 17, true], ['5×3 + 4 = 19', 19, false],
  ]
  const tally: [number, number][] = [[17, 3], [32, 1], [19, 1]]
  return (
    <Shell icon={Icn.check} title="思维链自洽 Self-Consistency 原理"
      sub="看懂：采样多条推理链，多数投票">
      <Sec n={1} title="问题：单条推理一步错就全错">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>让大模型"一步步想"(思维链)再取<b>那一条</b>路径的答案——但单链<b>一步错就步步错</b>、没有回头路,中间算错整题就毁了。</span></div>
      </Sec>

      <Sec n={2} title="做法：采样多条链 → 多数投票">
        <div className="gd-graph">
          <svg viewBox="0 0 210 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="6" y="8" fontSize="5.5" fill="var(--faint)">同一题采样 5 条推理链,各得一个答案</text>
            {chains.map(([r, a, ok], k) => (
              <g key={k}>
                <rect x="6" y={12 + k * 12} width="120" height="10" rx="2" fill={ok ? 'color-mix(in srgb,var(--hit) 8%,var(--panel))' : 'color-mix(in srgb,var(--miss) 8%,var(--panel))'} stroke={ok ? 'var(--hit)' : 'var(--miss)'} strokeWidth="0.5" opacity="0.9" />
                <text x="10" y={19 + k * 12} fontSize="5.5" fill="var(--ink)">{r}</text>
                <text x="116" y={19 + k * 12} textAnchor="end" fontSize="5.5" fontWeight={700} fill={ok ? 'var(--hit)' : 'var(--miss)'}>{a}{ok ? '✓' : '✗'}</text>
              </g>
            ))}
            {/* 投票条 */}
            <text x="136" y="8" fontSize="5.5" fill="var(--faint)">多数投票</text>
            {tally.map(([a, v], k) => {
              const win = a === 17
              return (
                <g key={k}>
                  <text x="138" y={20 + k * 15} fontSize="6.5" fontWeight={700} fill={win ? 'var(--hit)' : 'var(--ink)'}>{a}</text>
                  <rect x="150" y={14 + k * 15} width={v * 14} height="8" rx="1.5" fill={win ? 'var(--hit)' : 'var(--now)'} opacity={win ? 1 : 0.5} />
                  <text x={152 + v * 14} y={20.5 + k * 15} fontSize="5" fill="var(--faint)">{v}票</text>
                </g>
              )
            })}
            <text x="138" y="72" fontSize="6" fill="var(--hit)">→ 17 胜出（正解✓）</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>3 条不同算法<b>殊途同归到 17</b>、2 条各自算错(32、19)且彼此不一致 → <b>多数票 17 胜出</b>。贪心若单采到那条错链就答错,自洽用投票<b>救回</b>。</span></div>
      </Sec>

      <Sec n={3} title="为什么有效：多条路径的共识">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>正确一致、错误各异</h4><p>唯一答案的题:<em>对的推法多条都通向同一答案</em>,错的五花八门,少数被淹没。</p></div>
          <div className="gd-card i"><h4>集成思想</h4><p>和随机森林多棵树投票、"三个臭皮匠"同理;采样的<em>随机性成了工具</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>是提升 LLM 数学/常识推理最简单有效的招之一,配<b>思维链 CoT</b>。代价:同题跑 N 遍、更贵——拿算力换准确率。对照<b>束搜索</b>求单一最优,自洽要多条答案的<b>共识</b>。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '同一题' }, { cls: 'pd', text: '采样 N 条推理链' },
          { cls: 'pi', text: '各得一个答案' }, { cls: 'pt', text: '多数投票' },
          { cls: 'ph', text: '共识更可信' },
        ]}
        why={<><b>为什么"自洽"是提升大模型推理性价比最高的一招:</b>它抓住了推理任务一个深刻而反直觉的特性——在有唯一答案的问题上,正确的推理路径虽各不相同,却都殊途同归到同一个答案;而错误的路径则各错各的、彼此散乱。这意味着"多条独立推理的共识"是一个远比"单条推理的自信"更强的正确性信号。于是自洽做了一件几乎不需要改动模型的事:把原本要压低的采样随机性反过来当工具,让模型对同一道题生成多条不同的思路,再数一数哪个答案得票最多。单链推理最怕的一步之差,在这里被多数投票稀释掉了——个别算错的链成了少数派,被众多正确链投下去。这本质上是集成学习的思想在推理上的回声,和随机森林靠众树投票、和"三个臭皮匠顶个诸葛亮"是同一个道理。理解了它,你会重新看待大模型输出的随机性:它不总是需要被消除的噪声,适度的多样性配上共识机制,反而能榨出更可靠的答案。它简单、通用、和思维链天然搭配,唯一的代价是把题目跑 N 遍的算力——一个清晰的"用计算换准确率"的权衡,也正是它与追求单一最优解的束搜索最本质的分野。</>} />
    </Shell>
  )
}

/*  实测值（有缺陷的奖励模型 + 高多样性），别按记忆填 —— 判据在 tests/thicken-ml.test.ts 里量 */
const NS_BON = [1, 2, 4, 8, 16, 32]
const PROXY_BON = [6, 6, 9, 14, 14, 14]
const TRUE_BON = [2, 2, 5, 0, 0, 0]

function BestOfNDiagram() {
  const cands: [string, number, number][] = [
    ['3 + 8 + 5 = 16', 2, 0], ['5 × 3 + 8 = 23', 9, 0], ['8 × 5 = 40', 0, 0], ['3 × 8 = 24', 10, 1], ['3 × 8 − 5 = 19', 5, 0],
  ]
  return (
    <Shell icon={Icn.check} title="Best-of-N 拒绝采样原理"
      sub="看懂：采样 N 个候选，打分器挑最高分的那个">
      <Sec n={1} title="问题：生成一次质量参差">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>大模型生成有随机性,采样一次<b>时好时坏</b>——有时灵光、有时平庸甚至跑偏。Best-of-N 的办法:<b>别只采一次,采 N 个、挑最好的</b>。</span></div>
      </Sec>

      <Sec n={2} title="做法：N 个候选 → 打分器评分 → 取最高">
        <div className="gd-graph">
          <svg viewBox="0 0 210 82" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="6" y="8" fontSize="5.5" fill="var(--faint)">任务:拼算式凑近 24;打分器=10−|24−结果|</text>
            {cands.map(([e, reward, best], k) => (
              <g key={k}>
                <rect x="6" y={12 + k * 13} width="94" height="11" rx="2" fill={best ? 'color-mix(in srgb,var(--hit) 10%,var(--panel))' : 'var(--panel)'} stroke={best ? 'var(--hit)' : 'var(--line)'} strokeWidth="0.5" opacity={best ? 1 : 0.85} />
                <text x="10" y={19.5 + k * 13} fontSize="5.5" fill="var(--ink)">{e}</text>
                <rect x="106" y={14 + k * 13} width={reward * 7} height="8" rx="1.5" fill={best ? 'var(--hit)' : 'var(--now)'} opacity={best ? 1 : 0.5} />
                <text x={109 + reward * 7} y={20.5 + k * 13} fontSize="5.5" fill="var(--faint)">{reward}分</text>
                {best === 1 && <text x="192" y={20.5 + k * 13} fontSize="5.5" fill="var(--hit)">★最高</text>}
              </g>
            ))}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>关键是<b>打分器</b>:训练好的<b>奖励模型</b>(给回答质量打分,RLHF 用)或<b>可算的验证器</b>(验算/跑单测)。采样 N 个、逐个打分、<b>argmax 取最高</b> → 3×8=24 满分胜出。</span></div>
      </Sec>

      {/*  2026-09-09 补厚：reward hacking 原来只是 §3 note 里的一句脚注，
           而它是这一屏真正的落点。单开一节，把两条线画出来。 */}
      <Sec n={3} title="但 argmax 认的是打分器的分，不是真实质量">
        <div className="gd-graph">
          <svg viewBox="0 0 210 90" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="6" y="8" fontSize="5.5" fill="var(--faint)">打分器有个缺陷:偏爱长的、看着像在推理的回答</text>
            {/*  实测曲线：代理分 6→6→9→14→14→14 / 真实质量 2→2→5→0→0→0 */}
            {[0, 7, 14].map(v => (
              <g key={v}>
                <line x1="24" y1={76 - v * 3.6} x2="196" y2={76 - v * 3.6} stroke="var(--line-soft)" strokeWidth="0.4" />
                <text x="21" y={78 - v * 3.6} fontSize="4.5" fill="var(--faint)" textAnchor="end">{v}</text>
              </g>
            ))}
            {NS_BON.map((nn, i) => <text key={nn} x={30 + i * 33} y="86" fontSize="4.5" fill="var(--faint)" textAnchor="middle">N={nn}</text>)}
            <polyline points={PROXY_BON.map((v, i) => `${30 + i * 33},${76 - v * 3.6}`).join(' ')}
              fill="none" stroke="var(--now)" strokeWidth="1.4" />
            <polyline points={TRUE_BON.map((v, i) => `${30 + i * 33},${76 - v * 3.6}`).join(' ')}
              fill="none" stroke="var(--dim)" strokeWidth="1.2" strokeDasharray="3 2" />
            <line x1={30 + 2 * 33} y1="18" x2={30 + 2 * 33} y2="76" stroke="var(--miss)" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.8" />
            <text x={30 + 2 * 33} y="15" fontSize="4.5" fill="var(--miss)" textAnchor="middle">真实质量见顶</text>
            <text x="130" y={76 - 14 * 3.6 - 3} fontSize="5" fill="var(--now)">代理分数（打分器给的）</text>
            <text x="130" y={76 + 6} fontSize="5" fill="var(--dim)">真实质量</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>候选池里有一条<b>又长又像在一步步推理</b>的:「先算 8−5=3，再 3×3=9…」——算出来是 12,<b>真实质量 0</b>,可代理分拿到 <b>14</b>,压过了真正的最优解 3×8（真实 10、太短、代理只有 12）。<b>N 越大，argmax 就越一定会撞上它</b>:代理分一路涨到 14,真实质量从 5 掉到 0。这就是 <b>Goodhart 定律 / reward hacking</b>,RLHF 里叫<b>过优化</b>。</span></div>
      </Sec>

      <Sec n={4} title="和自洽的分工：打分 vs 投票">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>Best-of-N</h4><p>外部<em>打分器选单个最好</em>——适合开放式生成(写作/对话/代码),没"多数答案"可投。</p></div>
          <div className="gd-card i"><h4>自洽</h4><p><em>多数投票</em>——适合有唯一离散答案、正确路径会聚集的推理题。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>是 RLHF 数据合成、推理时增强(test-time scaling)的常用招。软肋有两条:<b>算力线性涨而质量近似只随 log N 涨</b>(边际递减);以及<b>它只和打分器一样好</b>。还有一条常被忽略的前提——取的是"N 个样本里的<b>最大值</b>",<b>样本之间得真的不一样</b>,候选高度重复时 N 加了等于没加。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '采样 N 个候选' }, { cls: 'pd', text: '打分器逐个评分' },
          { cls: 'pi', text: 'argmax 取最高' }, { cls: 'pt', text: '用算力换质量' },
          { cls: 'ph', text: '拿到更好输出' },
        ]}
        why={<><b>为什么"Best-of-N"是推理时提升质量最直接的一招:</b>它承认并利用了大模型生成的随机性——既然一次采样的质量像抽卡,那就多抽几次、留下最好的一张。这个想法朴素,却把"生成"和"评价"这两件事清晰地解耦开了:模型负责多样地产出候选,一个独立的打分器负责挑选。打分器是整件事的灵魂,它可以是学过人类偏好的奖励模型,把主观的"好不好"变成可比较的数;也可以是一个铁面无私的验证器,对数学和代码这类有客观对错的任务直接判分。理解了它,你就看清了它和自洽这对"采样多个再合成"的孪生方法的分野:自洽靠多数投票,只在答案离散、正确者自然抱团时才成立;Best-of-N 靠打分器择优,才能应付写作、对话这类没有唯一答案、只能凭标准挑选的开放任务。它也是当下"用推理时算力换性能"(test-time scaling)潮流的基石之一,以及 RLHF 里合成偏好数据的常规手段。但它的上限被打分器牢牢焊死——打分器有多准,择优就有多真;一旦打分器有可乘之机,模型就会学会取悦分数而非真正做好,这就是 reward hacking,也是这条看似免费的午餐背后真正的账单。</>} />
    </Shell>
  )
}

function ToTDiagram() {
  const thoughts: [string, string, boolean][] = [
    ['4×3=12', '{12,2}', true], ['4×2=8', '{8,3}', true], ['3×2=6', '{6,4}', true],
    ['4+3=7', '{7,2}', false], ['4−3=1', '{1,2}', false],
  ]
  const W = 240, cx = W / 2, n = thoughts.length
  return (
    <Shell icon={Icn.bulb} title="思维树 ToT 原理"
      sub="看懂：推理展开成树，生成多个想法、评估、剪枝、搜索">
      <Sec n={1} title="从「线」到「树」：CoT / 自洽 / ToT">
        <div className="gd-lane">
          <div className="gd-card i"><h4>CoT 一条线</h4><p>一步步想,只走<em>一条</em>路——错一步<em>没回头</em>。</p></div>
          <div className="gd-card i"><h4>自洽 多条独立线</h4><p>采多条链再投票,但每条<em>内部仍是直线</em>、互不干涉。</p></div>
          <div className="gd-card hit"><h4>ToT 一棵树</h4><p>每步<em>多个分支+评估+剪枝+回溯</em>,能探索、试错、规划。</p></div>
        </div>
      </Sec>

      <Sec n={2} title="做法：生成 → 评估 → 剪枝 → 搜索">
        <div className="gd-graph">
          <svg viewBox="0 0 240 128" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <rect x={cx - 24} y="4" width="48" height="16" rx="3" fill="color-mix(in srgb,var(--now) 16%,var(--panel))" stroke="var(--now)" strokeWidth="0.8" />
            <text x={cx} y="15" textAnchor="middle" fontSize="7" fontWeight={700} fill="var(--ink)">{'{4,3,2}'}</text>
            {thoughts.map(([op, st, sure], k) => {
              const bx = (W / (n + 1)) * (k + 1)
              const chosen = k === 0
              return (
                <g key={k} opacity={sure ? 1 : 0.4}>
                  <line x1={cx} y1="20" x2={bx} y2="52" stroke={chosen ? 'var(--hit)' : sure ? 'var(--hit)' : 'var(--miss)'} strokeWidth={chosen ? 1.4 : 0.7} strokeDasharray={sure ? 'none' : '2.5 1.5'} />
                  <text x={(cx + bx) / 2} y={34} textAnchor="middle" fontSize="4" fill="var(--faint)">{op}</text>
                  <rect x={bx - 15} y="52" width="30" height="15" rx="3" fill={sure ? 'color-mix(in srgb,var(--hit) 12%,var(--panel))' : 'var(--panel)'} stroke={sure ? 'var(--hit)' : 'var(--miss)'} strokeWidth={chosen ? 1.4 : 0.7} strokeDasharray={sure ? 'none' : '2.5 1.5'} />
                  <text x={bx} y="62" textAnchor="middle" fontSize="6" fill="var(--ink)">{st}</text>
                  <text x={bx} y="75" textAnchor="middle" fontSize="4.5" fill={sure ? 'var(--hit)' : 'var(--miss)'}>{sure ? '✓有希望' : '✗剪掉'}</text>
                  {chosen && (
                    <g>
                      <line x1={bx} y1="67" x2={bx} y2="92" stroke="var(--hit)" strokeWidth="1.4" />
                      <text x={bx} y="84" textAnchor="middle" fontSize="4.5" fill="var(--hit)">12×2=24</text>
                      <rect x={bx - 16} y="92" width="32" height="15" rx="3" fill="color-mix(in srgb,var(--hit) 22%,var(--panel))" stroke="var(--hit)" strokeWidth="1" />
                      <text x={bx} y="102" textAnchor="middle" fontSize="7" fontWeight={800} fill="var(--hit)">24 ✓</text>
                    </g>
                  )}
                </g>
              )
            })}
            <text x="6" y="124" fontSize="5" fill="var(--faint)">绿=有希望 · 红虚线=死路剪掉 · 沿有希望的搜到解</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>①<b>生成</b>多个想法分支(挑两数运算)②<b>评估</b>每个前景(剩两数能到 24?sure/impossible)③<b>剪枝</b>掉死路④沿有希望的<b>搜索</b>,{'{12,2}'}→12×2=24 解出,走不通可<b>回溯</b>换分支。</span></div>
      </Sec>

      {/*  2026-09-09 补厚：老版本三节讲完就收，而 ToT 的**天花板**从来没画过。
           实测值见 tests/thicken-ml.test.ts，别按记忆填。 */}
      <Sec n={3} title="天花板不在搜索，在评估器">
        <div className="gd-lane">
          <div className="gd-card miss"><h4>剪掉的枝回溯够不着</h4><p>{'{1,5,5}'} 凑 24,唯一的解是 <em>5×5=25 → 25−1=24</em>。评估器那条听着很有道理的规矩「<em>别把数弄得比目标还大</em>」一眼把它判成死路——<em>ToT 咬定"无解"</em>,而且回溯 9 次也够不着它。<b>它没有任何办法知道自己错了。</b></p></div>
          <div className="gd-card o"><h4>"完美评估器"的省是假的</h4><p>{'{2,3,4}'} 上它只展开 <em>24</em> 个节点、看着比不剪枝的 36 省;可评估器<em>内部又走了 117 个</em>,总账 <b>141</b>——<em>比不剪枝贵三倍</em>。<b>能完美判断中间状态有没有希望,等于已经把题解了一遍。</b></p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>所以真实 ToT 只能用<b>便宜但会判错</b>的评估器。而不准的评估器<b>两头不落好</b>:{'{1,5,5}'} 那档总账 57、不剪枝 59,<b>只省 3%</b>,还给了个错答案——<b>付了评估的钱,买到一个错答案</b>。导览里那句「评估中间状态往往比解题本身还难」不是修辞,是上面这两笔账。</span></div>
      </Sec>

      <Sec n={4} title="它是什么：想法层面的树搜索">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>本质是把经典<b>树搜索(BFS/DFS、乃至 A* 那种带评估函数的搜索)</b>搬到"想法"层面:模型当<b>生成器</b>产出分支、评估器当<b>启发函数</b>。擅长需探索/试错/规划的难题(24点、字谜、走迷宫);代价:分支多、评估多,更贵更慢——拿算力换难题成功率。而<b>"无解"比"有解"还贵</b>:有解撞到就停,要断言无解<b>必须把整棵树走完</b>。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '中间状态=树节点' }, { cls: 'pd', text: '生成多个想法分支' },
          { cls: 'pi', text: '评估前景' }, { cls: 'pt', text: '剪掉死路' },
          { cls: 'ph', text: '搜索+回溯到解' },
        ]}
        why={<><b>为什么"思维树"是增强推理这条路上关键的一跃:</b>它点破了此前方法的共同局限——无论是一条到底的思维链,还是多条并排再投票的自洽,推理都还是"线性"的,只能一往无前,不能停下来比较、更不能走错了退回来。可人类解真正的难题从不是这样:我们会在脑中同时想几条路、掂量哪条更有戏、砍掉明显走不通的、只在有前途的方向上深挖,碰壁了就回退换一条。ToT 把这套探索的智慧显式化,方法是把问题的中间状态当成树的节点,让模型在每一步生成多个想法分支,再请一个评估器给每个分支的前景打分,于是"生成候选、评估价值、剪枝、搜索、回溯"这些经典树搜索的动作,第一次被完整地嫁接到了大模型的推理上——模型既是不断产出新想法的生成器,评估器则扮演着搜索里的启发函数。理解了它,你会看清一条漂亮的阶梯:从单线的 CoT,到多线投票的自洽,再到带评估与回溯的 ToT,人类解题时的思维结构被一步步还给了机器。它在需要规划和试错的难题上(24 点、填字、迷宫)明显更强,代价则是成倍的模型调用——这也正是它与 Best-of-N、自洽共享的底色:用推理时的算力,换难题上的成功率,只不过 ToT 把这份算力花在了最接近"思考"本身的结构化搜索上。</>} />
    </Shell>
  )
}

function CollisionDiagram() {
  return (
    <Shell icon={Icn.star} title="弹性碰撞与守恒原理"
      sub="看懂：单个球速度乱变，但总动能、总动量守恒">
      <Sec n={1} title="做法：实时物理引擎，不是逐帧动画">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>这个实验直接<b>实时运行开源物理引擎 Matter.js</b>:一盒小球做<b>弹性碰撞</b>(无摩擦、四壁完美反弹),可拖拽、加球、开关重力——像粒子先生那样可交互,但不必从零手写物理。</span></div>
      </Sec>

      <Sec n={2} title="原理：碰撞转移能量/动量，但总量不变">
        <div className="gd-graph">
          <svg viewBox="0 0 200 66" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* 碰撞前 */}
            <text x="6" y="10" fontSize="6" fill="var(--faint)">碰撞前</text>
            <circle cx="30" cy="30" r="9" fill="#3b82f6" />
            <line x1="39" y1="30" x2="58" y2="30" stroke="var(--faint)" strokeWidth="1" markerEnd="url(#cola)" />
            <circle cx="72" cy="30" r="9" fill="#8A5A00" opacity="0.5" />
            <text x="30" y="52" textAnchor="middle" fontSize="5" fill="var(--faint)">快</text>
            <text x="72" y="52" textAnchor="middle" fontSize="5" fill="var(--faint)">慢</text>
            {/* 碰撞后 */}
            <text x="112" y="10" fontSize="6" fill="var(--faint)">碰撞后</text>
            <circle cx="130" cy="30" r="9" fill="#3b82f6" opacity="0.5" />
            <circle cx="172" cy="30" r="9" fill="#8A5A00" />
            <line x1="181" y1="30" x2="196" y2="30" stroke="var(--faint)" strokeWidth="1" markerEnd="url(#cola)" />
            <text x="130" y="52" textAnchor="middle" fontSize="5" fill="var(--faint)">变慢</text>
            <text x="172" y="52" textAnchor="middle" fontSize="5" fill="var(--faint)">变快</text>
            <text x="100" y="33" textAnchor="middle" fontSize="8" fill="var(--now)">→</text>
            <defs><marker id="cola" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="var(--faint)" /></marker></defs>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>碰撞把速度在两球间<b>重新分配</b>:一个加速、一个减速,单看谁都乱。但<b>所有球的动能加起来、动量(带方向)加起来</b>,这两个<b>总量始终不变</b>——能量守恒、动量守恒。读数实时显示,乱中有恒。</span></div>
      </Sec>

      <Sec n={3} title="它示范了什么：理科该走的可视化路子">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>实时 + 可交互</h4><p>拖球甩它、加球、开重力——<em>看得见摸得着的沙盘</em>,不是静态图。</p></div>
          <div className="gd-card i"><h4>用开源引擎</h4><p>Matter.js 求解真实物理;<em>物理/化学/生物</em>都能这样把规律变成仿真。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '实时物理引擎' }, { cls: 'pd', text: '弹性碰撞' },
          { cls: 'pi', text: '动能/动量转移' }, { cls: 'pt', text: '单球乱变' },
          { cls: 'ph', text: '总量守恒' },
        ]}
        why={<><b>为什么用一盒弹跳的小球做物理学科的第一课:</b>它同时讲清了两件事——一个最深的物理思想,和一条可视化的新路子。物理思想是守恒律:让小球在无摩擦的盒子里自由碰撞,每个球的速度都杂乱无章、被撞来撞去,可只要把所有球的动能与动量分别加总,这两个数就纹丝不动。这正是物理学看世界的方式:在千变万化的表象下,寻找那个"无论怎么折腾都不变"的量,守恒律是整座经典物理大厦的地基。而做法上,它示范了我们该如何呈现物理——不再像算法那样把每一步预先算好、静态图解,而是直接实时运行一个开源物理引擎,让规律在你眼前动起来、还能上手拨弄。这条路子对物理、化学、生物这些天生连续、空间、需要"亲眼看见才信"的学科尤其对味:分子的热运动、场的分布、天体的轨道、细胞的结构,都能借成熟的开源引擎变成可交互的沙盘,而不必从零手写物理。一盒小球,既让你摸到了守恒律,也让你看清了这类学科接下来会长成什么样。</>} />
    </Shell>
  )
}

/*  实测值（原图 + 均值聚合），别按记忆填 —— 判据在 tests/thicken-ml.test.ts 里量。
    [层数, 离散度]，初始离散度是 1。 */
const GCN_SPREAD: [number, number][] = [[1, 0.25], [2, 0.112], [3, 0.082], [5, 0.051], [10, 0.016], [20, 0.004], [50, 0.004]]

function GcnDiagram() {
  const pos = [[0.22, 0.28], [0.22, 0.72], [0.48, 0.5], [0.72, 0.5], [0.92, 0.5]]
  const edges = [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4]]
  const before = [1, 0, 0, 0, 1], after = [0.33, 0.33, 0.25, 0.33, 0.5]
  const W = 150, Hh = 84
  const px = (x: number) => 12 + x * (W - 24), py = (y: number) => 10 + y * (Hh - 20)
  const heat = (v: number) => `color-mix(in srgb,#3b82f6 ${Math.round(v * 74)}%,var(--panel))`
  const graph = (feat: number[], ox: number) => (
    <g transform={`translate(${ox},0)`}>
      {edges.map(([a, b], k) => <line key={k} x1={px(pos[a][0])} y1={py(pos[a][1])} x2={px(pos[b][0])} y2={py(pos[b][1])} stroke="var(--line)" strokeWidth="0.8" />)}
      {pos.map((p, v) => <g key={v}><circle cx={px(p[0])} cy={py(p[1])} r="8" fill={heat(feat[v])} stroke="var(--line)" strokeWidth="0.6" /><text x={px(p[0])} y={py(p[1]) + 2} textAnchor="middle" fontSize="5.5" fontWeight={700} fill={feat[v] > 0.5 ? 'var(--panel)' : 'var(--ink)'}>{feat[v]}</text></g>)}
    </g>
  )
  return (
    <Shell icon={Icn.chip} title="图卷积 GCN 原理"
      sub="看懂：每个节点聚合邻居的特征更新自己，信息沿边传播">
      <Sec n={1} title="问题：图数据没有整齐的行列">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>社交网络、分子、知识图谱是<b>图</b>:节点数不定、每个节点<b>邻居数还不一样</b>——普通卷积/全连接套不上。GCN 把神经网络搬到图上。</span></div>
      </Sec>

      <Sec n={2} title="做法：聚合邻居 → 信息沿边渗一跳">
        <div className="gd-graph">
          <svg viewBox="0 0 320 90" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {graph(before, 0)}
            {graph(after, 165)}
            <text x="75" y="86" textAnchor="middle" fontSize="6" fill="var(--faint)">聚合前(只两点有信息)</text>
            <text x="240" y="86" textAnchor="middle" fontSize="6" fill="var(--faint)">一层后(渗给邻居)</text>
            <text x="157" y="46" textAnchor="middle" fontSize="9" fill="var(--now)">→</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>一层 = 每个节点把<b>自己+所有邻居</b>的特征<b>平均</b>(真实 GCN 再乘可学权重 W、过激活)。节点 0、4 的"1"顺着边分给邻居——相连节点变相似,<b>信息沿边渗了一跳</b>。</span></div>
      </Sec>

      <Sec n={3} title="威力：叠 L 层传 L 跳">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>多跳感受野</h4><p>一层一跳、<em>叠 L 层传 L 跳</em>,第 L 层节点概括它 L 跳内的整个子图。</p></div>
          <div className="gd-card i"><h4>怎么验的</h4><p>把一个节点的初始特征 <em>+1</em>,看第 L 层谁跟着变——变的那些<b>正好</b>是 BFS 算的 L 跳以内。<em>不是一句断言。</em></p></div>
        </div>
      </Sec>

      {/*  2026-09-09 补厚：老版本三节讲完就收，而「叠得越深看得越远」的**另一半**从没画过。
           实测值见 tests/thicken-ml.test.ts，别按记忆填。 */}
      <Sec n={4} title="另一半：看得越远，也糊得越平">
        <div className="gd-graph">
          <svg viewBox="0 0 200 82" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="6" y="8" fontSize="5" fill="var(--faint)">节点特征的离散度（max−min）随层数变化　原图 + 均值聚合</text>
            {[0, 0.5, 1].map(v => (
              <g key={v}>
                <line x1="24" y1={70 - v * 52} x2="192" y2={70 - v * 52} stroke="var(--line-soft)" strokeWidth="0.4" />
                <text x="21" y={72 - v * 52} fontSize="4.5" fill="var(--faint)" textAnchor="end">{v}</text>
              </g>
            ))}
            <polyline points={GCN_SPREAD.map(([, sp], i) => `${30 + i * 27},${70 - sp * 52}`).join(' ')}
              fill="none" stroke="var(--now)" strokeWidth="1.4" />
            {GCN_SPREAD.map(([L, sp], i) => (
              <g key={L}>
                <circle cx={30 + i * 27} cy={70 - sp * 52} r="1.8" fill="var(--now)" />
                <text x={30 + i * 27} y="78" fontSize="4.5" fill="var(--faint)" textAnchor="middle">{L}</text>
              </g>
            ))}
            <text x="150" y="30" fontSize="5" fill="var(--miss)">节点之间的差别</text>
            <text x="150" y="37" fontSize="5" fill="var(--miss)">被一层层抹平</text>
          </svg>
        </div>
        <div className="gd-lane">
          <div className="gd-card miss"><h4>过平滑 over-smoothing</h4><p>聚合的本质是<em>跟邻居取平均</em>:取一次是融合邻域,<b>取很多次就是把整张图抹平</b>。节点分类要的是"不同节点长得不一样",深层 GCN 恰恰把这个抹没了——<b>所以实践中的 GCN 大多只有 2~3 层</b>,不是算不动,是<em>再深就没信息了</em>。</p></div>
          <div className="gd-card o"><h4>别拿"没塌到 0"当"没事"</h4><p>换成<em>对称归一化</em>,50 层还剩 <b>0.12</b> 的离散度、看着没塌;可它塌向的是<em>正比于 √(度数+1)</em> 的形状——换一组初始特征跑深了<b>还是这个形状</b>。<b>残余的差别只反映度数,跟节点原本的信息毫无关系。</b></p></div>
        </div>
        <div className="gd-note">{Icn.info}<span><b>同样的层数,在不同的图上"深"的程度完全不同</b>:链状图上一层只走一跳、5 个点要 4 层才通到头;星形图上任意两点最多 2 跳,<b>一层就糊、5 层离散度只剩 0.031</b>。缓解办法有残差/跳跃连接、PairNorm 之类。<em>节点分类、推荐、分子性质预测</em>都建在这套东西上;和词向量、注意力同属表示学习。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '图:节点+边' }, { cls: 'pd', text: '聚合自己+邻居' },
          { cls: 'pi', text: '如邻域平均' }, { cls: 'pt', text: '信息沿边渗一跳' },
          { cls: 'ph', text: '叠层传更远' },
        ]}
        why={<><b>为什么"图卷积"是把深度学习推向图数据的关键一步:</b>此前的网络都默认输入是规整的——图像是网格、文本是序列,可现实中大量最有价值的数据是图:社交关系、分子结构、知识图谱、交易网络,它们节点数不定、每个节点的邻居数各不相同,没有整齐的行列让卷积去滑动。GCN 的破解之道朴素得近乎显然,却极其有力:让每个节点通过聚合它邻居的信息来更新自己。一层邻域聚合,就把每个节点一跳之内的上下文揉进了它的表示;层层叠加,信息便沿着边一跳跳传开,深层的节点表示概括了它周围越来越大的子图结构。于是"图上的连接关系"这种以往难以喂给神经网络的东西,变成了可学习的特征。它和词向量、注意力其实是同一种精神——表示学习,把离散的对象(词、节点)嵌入连续空间让机器能对它们运算,而注意力本身就可以看作一种在全连接图上带权重的聚合。掌握了"聚合邻居"这一下,你就握住了整个图神经网络家族的钥匙,也看懂了推荐系统、药物发现、社交分析背后共同的那台引擎。</>} />
    </Shell>
  )
}

function PageRankDiagram() {
  const pos = [[0.28, 0.24], [0.76, 0.24], [0.52, 0.82], [0.1, 0.72]]
  const edges = [[0, 1], [0, 2], [1, 2], [2, 0], [3, 0], [3, 2]]
  const rank = [0.381, 0.199, 0.385, 0.038], nm = ['A', 'B', 'C', 'D']
  const W = 150, Hh = 96, px = (x: number) => 16 + x * (W - 32), py = (y: number) => 12 + y * (Hh - 24)
  const maxR = 0.385, rad = (r: number) => 7 + (r / maxR) * 12
  return (
    <Shell icon={Icn.tag} title="PageRank 网页排名原理"
      sub="看懂：重要性顺着链接流动，被重要页面链到的也重要">
      <Sec n={1} title="洞见：链接就是投票，重要页面的票更值钱">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>网页海量、关键词次数易作弊。PageRank:<b>一个页面的重要性 = 有多少、多重要的页面链到它</b>。链接=投票,但<b>重要页面投的票更值钱</b>——重要性会"传染"。</span></div>
      </Sec>

      <Sec n={2} title="做法：幂迭代，重要性顺链接流动到收敛">
        <div className="gd-graph">
          <svg viewBox="0 0 170 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs><marker id="prda" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--faint)" /></marker></defs>
            {edges.map(([a, b], k) => {
              const A = pos[a], B = pos[b], dx = px(B[0]) - px(A[0]), dy = py(B[1]) - py(A[1]), len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len
              return <line key={k} x1={px(A[0]) + ux * rad(rank[a])} y1={py(A[1]) + uy * rad(rank[a])} x2={px(B[0]) - ux * (rad(rank[b]) + 4)} y2={py(B[1]) - uy * (rad(rank[b]) + 4)} stroke="var(--faint)" strokeWidth="0.8" markerEnd="url(#prda)" opacity="0.7" />
            })}
            {pos.map((p, v) => (
              <g key={v}>
                <circle cx={px(p[0])} cy={py(p[1])} r={rad(rank[v])} fill={`color-mix(in srgb,var(--now) ${Math.round(rank[v] / maxR * 55)}%,var(--panel))`} stroke={v === 2 ? 'var(--hit)' : 'var(--now)'} strokeWidth={v === 2 ? 1.4 : 0.7} />
                <text x={px(p[0])} y={py(p[1]) + 1} textAnchor="middle" fontSize="7" fontWeight={800} fill="var(--ink)">{nm[v]}</text>
                <text x={px(p[0])} y={py(p[1]) + rad(rank[v]) + 6} textAnchor="middle" fontSize="5" fill="var(--faint)">{rank[v]}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>每页把 rank <b>平分</b>给它链出的页面(投票),收方求和,再混入随机跳转(阻尼 <b>d=0.85</b> 防死循环)。反复迭代收敛。<b>C 最大</b>(A、B、D 都链它)、D 最小(没人链)。</span></div>
      </Sec>

      <Sec n={3} title="本质：图上随机游走的稳态">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>随机上网者</h4><p>无穷次随机点链接后<em>停在各页的概率</em>=该页 PageRank(随机游走稳态)。</p></div>
          <div className="gd-card i"><h4>用途极广</h4><p>搜索排序、<em>影响力分析、TextRank 提关键词、推荐</em>,都是它。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '链接=加权投票' }, { cls: 'pd', text: '每页平分 rank 给链出页' },
          { cls: 'pi', text: '收方求和+阻尼' }, { cls: 'pt', text: '幂迭代到收敛' },
          { cls: 'ph', text: '重要页面胜出' },
        ]}
        why={<><b>为什么"PageRank"是一个改变了互联网的算法:</b>它优雅地解决了一个循环难题——网页的重要性该由谁说了算?答案是让网页彼此定义:一个页面重不重要,看有多少、多重要的页面链接它,而这些页面的重要性又由链接它们的页面决定。这种"重要性会传染"的循环,靠幂迭代一轮轮地把重要性顺着链接流动、重新分配,最终收敛到一个自洽的稳定分布。它最深的洞见在那个等价解释:一个漫无目的的随机上网者,无穷次点击之后停在每个页面的概率,恰好就是页面的 PageRank——重要性被还原成了图上随机游走的稳态。这一步把"谁重要"这种模糊的判断,变成了一个可计算、抗作弊(你没法靠自我吹嘘刷高,只能靠别人真心链接你)的数学量。理解了它,你会在无数地方看到同一台引擎:社交网络找意见领袖、学术界评估论文影响力、给文本里的词排重要性来提取关键词、乃至推荐系统里传播偏好。它和图遍历是近亲——遍历确定地走遍每个节点,PageRank 则随机地游走、求那个"待得最久"的稳态,用停留概率给整张图的节点排出了座次。</>} />
    </Shell>
  )
}

/*  实测值（值迭代收敛后），别按记忆填 —— 判据在 tests/thicken-ml.test.ts 里量。
    ⚠️ 老版本这里是 `γ^曼哈顿距离` 加一个"朝终点方向"的箭头 —— 那正是内核已经改掉的**假算法**：
    它偷看了终点坐标、还当墙不存在。真值绕墙走，起点是 γ^7=0.478 而不是 γ^5=0.59。 */
const QL_V: (number | null)[] = [0.387, 0.43, null, 0.81, 0.9, 0.43, 0.478, null, 0.9, 1, 0.478, 0.531, null, 0.81, 0.9, 0.531, 0.59, 0.656, 0.729, 0.81]
const QL_POL: (string | null)[] = ['→', '↓', null, '→', '↓', '→', '↓', null, '→', '★', '→', '↓', null, '→', '↑', '→', '→', '→', '→', '↑']

function QLearnDiagram() {
  const W = 5, H = 4, goal = [4, 1]
  const cell = 26, ox = 6, oy = 6
  return (
    <Shell icon={Icn.star} title="强化学习 Q-learning 原理"
      sub="看懂：奖励从终点一圈圈倒推成价值，跟着价值走就是最优策略">
      <Sec n={1} title="难点：奖励是延迟的">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>下棋、走迷宫这类问题<b>没有标准答案</b>,只有一连串决策后的好坏(赢/输、到终点+1)。中间每步都没反馈——怎么知道<b>哪步走对了</b>?这就是强化学习要解的"信用分配"。</span></div>
      </Sec>

      <Sec n={2} title="做法：给每格估价值，Bellman 倒推">
        <div className="gd-graph">
          <svg viewBox={`0 0 ${ox * 2 + W * cell} ${oy * 2 + H * cell}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => {
              const i = c + r * W
              const isGoal = c === goal[0] && r === goal[1]
              const wall = QL_V[i] === null
              const v = QL_V[i] ?? 0
              return (
                <g key={`${c}-${r}`}>
                  <rect x={ox + c * cell} y={oy + r * cell} width={cell - 2} height={cell - 2} rx="2"
                    fill={wall ? 'var(--sunk-2)' : isGoal ? 'color-mix(in srgb,var(--miss) 22%,var(--panel))' : `color-mix(in srgb,var(--hit) ${Math.round(v * 55)}%,var(--panel))`}
                    stroke={wall ? 'var(--line)' : isGoal ? 'var(--miss)' : 'var(--line)'} strokeWidth="0.5" />
                  {wall ? null : isGoal
                    ? <text x={ox + c * cell + cell / 2 - 1} y={oy + r * cell + cell / 2 + 3} textAnchor="middle" fontSize="9" fill="var(--miss)">★</text>
                    : <><text x={ox + c * cell + 3} y={oy + r * cell + 7} fontSize="4.5" fill="var(--faint)">{v}</text>
                      <text x={ox + c * cell + cell / 2 - 1} y={oy + r * cell + cell / 2 + 5} textAnchor="middle" fontSize="8" fill="var(--hit)">{QL_POL[i]}</text></>}
                </g>
              )
            }))}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>给每格估一个<b>价值</b>(从这出发未来总回报)。<b>Bellman</b>:格子价值=即时奖励+γ×下一格价值。终点的 +1 顺规则<b>一圈圈倒推</b>:0.9→0.81→0.729…每远一步 ×γ=0.9。灰色是<b>墙</b>——价值<b>自动绕过去</b>:起点(左下起第二行最左)是 <b>0.478=γ⁷</b>(绕墙的真实步数),<b>而不是</b> γ⁵=0.59(曼哈顿)。这正是"距离公式"给不出、只有真迭代才有的。</span></div>
      </Sec>

      {/*  2026-09-09 补厚：老版本这一节标题是「妙处：靠试错自己学，**不用知道地图**」——
           而上面画的是**值迭代**，它每更新一格都要读四个邻居的价值，那恰恰**就是**要地图。
           这一节改成把两条路的账摆开。 */}
      <Sec n={3} title="同一套 Bellman，两条路，代价单位不一样">
        <div className="gd-lane">
          <div className="gd-card o"><h4>值迭代 · 有模型的规划</h4><p>每格取 max_a[奖励 + γ×<em>邻居价值</em>]。<b>160 次</b>更新就收敛、一格不错——<em>但"邻居价值"这四个字就是"手里有地图"</em>。</p></div>
          <div className="gd-card hit"><h4>Q-learning · 免模型地学</h4><p>更新式里<em>只有 s、a、r、s′</em>:我在哪、做了什么、拿到多少、到了哪。<b>一次都不查地图</b>,撞墙也是撞了才知道——代价是 <b>4826 步</b>真实经验。</p></div>
          <div className="gd-card miss"><h4>而它只学得到走过的地方</h4><p>ε=0(不探索)学错 <em>10/16</em> 格、<em>8 格压根没去过</em>;<b>可跟箭头走照样 7 步、跟最优一样</b>——<em>它只学会了那一条路</em>。「学到最优路径」和「学到最优策略」是两件事。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span><b>"免模型"不是免费的,它的价格就是那几千步经验。</b>而"学错几格"是拿另跑一遍值迭代的结果比出来的——<b>Q-learning 看不到那张图</b>,它自己无从得知。<em>AlphaGo、机器人控制、推荐、大模型 RLHF</em> 都建在这套东西上。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '试错拿奖励' }, { cls: 'pd', text: '给状态估价值' },
          { cls: 'pi', text: 'Bellman 倒推' }, { cls: 'pt', text: '每远一步×γ打折' },
          { cls: 'ph', text: '往价值高处走=策略' },
        ]}
        why={<><b>为什么"强化学习"是 AI 最激动人心的一支:</b>它处理的是一类监督学习碰不到的问题——没有人告诉你每一步的标准答案,你只能在一连串行动之后,收到一个"好还是坏"的最终反馈。下棋只知输赢、走迷宫只有终点给分、开车只在出事时才知错。难点就在这份反馈的延迟:功劳或过错该记在中间哪一步头上?Q-learning 的破解之道优雅得像一束光——不盯着眼前的即时奖励,而是给每个状态估计一个"未来总回报"的价值,再用 Bellman 那条简单的递归(当下价值=即时奖励+打折的未来价值),让终点的那份奖励顺着状态之间的连接一圈圈倒推回来,渗透到每一个早期的决策上。折扣因子 γ 则温柔地表达了"远处的好处要打折"这一朴素直觉。价值一旦铺满,最优策略便不言自明:永远朝价值更高处走。而最令人惊叹的是,这一切都能在完全不知道环境规则的情况下,靠反复试错自己涌现出来。理解了这个走迷宫的小模型,你就握住了从 AlphaGo 到机器人控制、再到今天大模型靠 RLHF 对齐人类偏好的共同内核——用对未来的估计,照亮当下的每一步。</>} />
    </Shell>
  )
}

function RecSysDiagram() {
  const users = [['小明', [1, 0]], ['小红', [0, 1]], ['阿强', [0.8, 0.6]]] as [string, number[]][]
  const movies = [['复仇者', [5, 0]], ['小森林', [0, 5]], ['盗梦', [4, 3]]] as [string, number[]][]
  const dot = (a: number[], b: number[]) => Math.round((a[0] * b[0] + a[1] * b[1]) * 10) / 10
  const known = new Set(['0,0', '0,1', '1,1', '2,0', '2,2'])
  return (
    <Shell icon={Icn.tag} title="推荐系统 · 矩阵分解原理"
      sub="看懂：评分 = 用户隐向量 · 电影隐向量，内积补全「猜你喜欢」">
      <Sec n={1} title="难题：评分表大半是空的">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>每个人只对<b>极少数</b>物品打过分,"用户×物品"评分表大半空着。推荐要猜的正是<b>空缺</b>:你没看过的,会打几分?</span></div>
      </Sec>

      <Sec n={2} title="做法：评分 = 用户隐向量 · 电影隐向量">
        <div className="gd-graph">
          <svg viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {movies.map(([n, v], c) => (
              <g key={c}>
                <text x={64 + c * 42 + 18} y="10" textAnchor="middle" fontSize="6" fill="var(--ink)">{n}</text>
                <text x={64 + c * 42 + 18} y="17" textAnchor="middle" fontSize="4.5" fill="var(--now)">({v.join(',')})</text>
              </g>
            ))}
            {users.map(([un, uv], r) => (
              <g key={r}>
                <text x="4" y={34 + r * 22} fontSize="6" fill="var(--ink)">{un}</text>
                <text x="4" y={40 + r * 22} fontSize="4.5" fill="var(--now)">({uv.join(',')})</text>
                {movies.map(([mn, mv], c) => {
                  const k = `${r},${c}`, isK = known.has(k), val = dot(uv, mv), isPred = r === 0 && c === 2
                  return (
                    <g key={c}>
                      <rect x={64 + c * 42} y={24 + r * 22} width="36" height="16" rx="2"
                        fill={isK ? 'color-mix(in srgb,var(--hit) 12%,var(--panel))' : isPred ? 'color-mix(in srgb,var(--now) 16%,var(--panel))' : 'var(--panel)'}
                        stroke={isPred ? 'var(--now)' : isK ? 'color-mix(in srgb,var(--hit) 35%,var(--line))' : 'var(--line)'} strokeWidth={isPred ? 1.2 : 0.5} />
                      <text x={64 + c * 42 + 18} y={35 + r * 22} textAnchor="middle" fontSize="8" fontWeight={700} fill={isK ? 'var(--hit)' : isPred ? 'var(--now)' : 'var(--faint)'}>{isK || isPred ? val : '?'}</text>
                    </g>
                  )
                })}
              </g>
            ))}
            <text x="100" y="96" textAnchor="middle" fontSize="5" fill="var(--faint)">绿=已知评分 · 琥珀=预测(内积算出) · ?=空缺</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>给用户和电影各学一个<b>隐向量</b>(这里两维:动作/文艺)。<b>评分=两向量内积</b>。已知评分都能对上(小明(1,0)·复仇者(5,0)=5),空缺就用内积预测:小明·盗梦=(1,0)·(4,3)=<b>4</b>。</span></div>
      </Sec>

      <Sec n={3} title="本质：把对象嵌进隐空间">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>表示学习</h4><p>用户/物品都<em>嵌进低维隐空间</em>,"合拍"变成可算的内积——和词向量同一精神。</p></div>
          <div className="gd-card i"><h4>真实系统</h4><p>隐向量<em>几十上百维、从海量评分自动学</em>;Netflix/淘宝/抖音猜你喜欢的底子。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '评分表大半空缺' }, { cls: 'pd', text: '用户/电影各学隐向量' },
          { cls: 'pi', text: '评分=内积' }, { cls: 'pt', text: '已知评分学向量' },
          { cls: 'ph', text: '空缺内积预测' },
        ]}
        why={<><b>为什么"矩阵分解"是推荐系统的经典心脏:</b>它把一个看似无解的问题——一张大半空白的评分表——变成了一个优雅的低维几何问题。它的关键假设是,人的喜好和物的属性并非杂乱无章,而是被少数几个潜在因素支配着:一个人有多爱动作、多爱文艺,一部电影有多硬核、多细腻。把这些潜在因素写成隐向量,评分就还原成两个向量的内积——口味和属性对得上,分自然高。于是那些填过的格子,成了约束,反过来把每个人、每部片的隐向量给"解"了出来;而一旦隐向量到手,任何一个空格都只是一次内积。真实系统里这些维度多达上百、且从海量数据里自己长出来,没有名字却精准地编码了品味的结构。理解了它,你会发现它和词向量、PCA 是同一族思想——都是把离散、稀疏、难以比较的对象,嵌进一个连续的低维空间,让"相似"和"合拍"第一次变得可以计算。从 Netflix Prize 到今天的双塔深度推荐,那句"猜你喜欢"背后,始终站着这个把稀疏矩阵拆成两串隐向量的古老而有力的想法。</>} />
    </Shell>
  )
}

function DiffusionDiagram() {
  const abar = [1, 0.5, 0.15, 0.02]
  return (
    <Shell icon={Icn.chip} title="扩散模型 Diffusion 原理"
      sub="看懂：前向加噪把图变噪声，反向去噪从噪声生成图">
      <Sec n={1} title="思路：先学破坏，再学修复，然后反着来">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>怎么让 AI 画出没见过的图?扩散模型:<b>前向</b>把真图一步步加高斯噪声→纯噪声(固定、不用学);<b>反向</b>训练网络<b>去噪</b>,从随机噪声一步步"磨"出新图。</span></div>
      </Sec>

      <Sec n={2} title="前向加噪：√ᾱ 递减，信号被淹没">
        <div className="gd-graph">
          <svg viewBox="0 0 210 66" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {abar.map((a, t) => {
              const sn = Math.round(Math.sqrt(1 - a) * 100) / 100, sa = Math.round(Math.sqrt(a) * 100) / 100
              const ox = 8 + t * 50
              return (
                <g key={t}>
                  <rect x={ox} y="8" width="34" height="34" rx="3" fill={`color-mix(in srgb, var(--ink) ${Math.round((1 - sa) * 78 + 6)}%, #ffffff)`} stroke="var(--line)" strokeWidth="0.5" />
                  {t === 0 && <text x={ox + 17} y="29" textAnchor="middle" fontSize="14" fill="var(--miss)">♥</text>}
                  <text x={ox + 17} y="50" textAnchor="middle" fontSize="5" fill="var(--faint)">√ᾱ={sa}</text>
                  <text x={ox + 17} y="57" textAnchor="middle" fontSize="4.5" fill="var(--dim)">噪={sn}</text>
                  {t < 3 && <text x={ox + 44} y="27" textAnchor="middle" fontSize="8" fill="var(--now)">→</text>}
                </g>
              )
            })}
            <text x="105" y="64" textAnchor="middle" fontSize="5" fill="var(--faint)">前向:x=√ᾱ·原图+√(1−ᾱ)·噪声　反向:网络去噪(◀)</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>每步 <b>x = √ᾱ·原图 + √(1−ᾱ)·噪声</b>:√ᾱ 从 1 降到 0.14(信号变弱)、噪声变强,几十步图变<b>纯噪声</b>。这步<b>固定可算</b>。</span></div>
      </Sec>

      <Sec n={3} title="反向去噪 = 生成；还能按文字条件">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>从噪声生成</h4><p>网络<em>预测并减掉每步噪声</em>,从随机噪声一步步去噪→浮现一张<em>新图</em>。</p></div>
          <div className="gd-card i"><h4>文生图</h4><p>给"一只猫",去噪每步朝<em>猫</em>修正→按描述生成。Stable Diffusion/Sora 底层。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '真图' }, { cls: 'pd', text: '前向一步步加噪' },
          { cls: 'pi', text: '→纯噪声(固定)' }, { cls: 'pt', text: '网络反向去噪' },
          { cls: 'ph', text: '从噪声生成新图' },
        ]}
        why={<><b>为什么"扩散模型"是这几年生成式 AI 最耀眼的突破:</b>它用一个近乎哲学的思路,解决了"凭空造图"这个曾经难如登天的问题——先教模型破坏,再教它修复,然后让它反着走。破坏这一半简单到不用学:给真图一小步一小步掺高斯噪声,几十步后必然沦为一团纯噪声,每一步保留多少信号、掺多少噪都是死板可算的。真正的魔法在另一半:训练一个网络,专门盯着某一步的带噪图,把里面掺的噪声认出来、减掉,还原出更清晰的一步。这个"去噪一步"学好了,就能反过来用——从一团随机噪声出发,一步步去噪,最后浮现出一张清晰而崭新、训练集里并不存在的图。噪声,沿着加噪的路反着走,就成了创作。而它的可控性更让人惊叹:在去噪的每一步注入文字条件,模型就朝着"一只戴帽子的猫"修正,于是有了文生图、文生视频。理解了这套加噪—去噪—反向生成的框架,你就看懂了 Stable Diffusion、DALL·E、Sora 共同的心脏,也踏上了当今 AI 求职最热的一块跳板——它把你学过的高斯噪声、反向传播、采样生成,熔铸成了一台能"想象"的机器。</>} />
    </Shell>
  )
}

/*  实测值（默认档 c=1.4、20 轮），别按记忆填 —— 判据在 tests/thicken-ml.test.ts 里量。
    ⚠️ 老版本这里是 A=4访/4赢、B/C 各 1访/0赢 —— 那是内核里那张**写死的输赢脚本表**留下的，
    "A 每次都赢"根本不是跑出来的。现在 rollout 照真实胜率抛硬币，数就长这样。 */
const MCTS_N = [['A', 6, 5], ['B', 6, 5], ['C', 4, 2], ['D', 2, 0], ['E', 2, 0]] as [string, number, number][]
const MCTS_SWEEP: [number, number][] = [[10, 0.43], [20, 0.55], [40, 0.728], [80, 0.858], [160, 0.964], [320, 0.99]]

function MctsDiagram() {
  const moves = MCTS_N
  const maxN = 6, bx = (k: number) => 22 + k * 32
  const rad = (nn: number) => 8 + (nn / maxN) * 7
  return (
    <Shell icon={Icn.star} title="蒙特卡洛树搜索 MCTS 原理"
      sub="看懂：随机模拟 + UCB，把思考花在最有希望的走法上">
      <Sec n={1} title="难题：走法爆炸，没法全搜">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>围棋每步几百选择、走到底比宇宙原子还多,穷举/minimax 算不动、又没好评估函数。MCTS 靠<b>随机模拟+统计</b>,把算力花在最有希望的走法上。</span></div>
      </Sec>

      <Sec n={2} title="每轮四步：选择→扩展→模拟→回传">
        <div className="gd-graph">
          <svg viewBox="0 0 170 96" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <circle cx="85" cy="16" r="10" fill="color-mix(in srgb,var(--now) 16%,var(--panel))" stroke="var(--now)" strokeWidth="0.8" />
            <text x="85" y="19" textAnchor="middle" fontSize="6" fill="var(--ink)">根</text>
            {moves.map(([m, nn, ww], k) => {
              const isBest = k === 0
              return (
                <g key={k}>
                  <line x1="85" y1="26" x2={bx(k)} y2={52 - rad(nn)} stroke={isBest ? 'var(--hit)' : 'var(--line)'} strokeWidth={isBest ? 1.4 : 0.7} />
                  <circle cx={bx(k)} cy="52" r={rad(nn)} fill={isBest ? 'color-mix(in srgb,var(--hit) 20%,var(--panel))' : 'color-mix(in srgb,var(--hit) 8%,var(--panel))'} stroke={isBest ? 'var(--hit)' : 'var(--line)'} strokeWidth={isBest ? 1.4 : 0.7} />
                  <text x={bx(k)} y="50" textAnchor="middle" fontSize="7" fontWeight={800} fill="var(--ink)">{m}</text>
                  <text x={bx(k)} y="58" textAnchor="middle" fontSize="4.5" fill="var(--dim)">{nn}访/{ww}赢</text>
                </g>
              )
            })}
            <text x="85" y="80" textAnchor="middle" fontSize="5" fill="var(--faint)">圆越大=访问越多。20 轮后 A/B 各 6 次、D/E 各 2 次 → 选访问最多的</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>①<b>选择</b>按 UCB 挑分支 ②<b>扩展</b>加新节点 ③<b>模拟</b>随机走到底看输赢 ④<b>回传</b>更新沿途 n、胜数。五个走法的<b>真实胜率</b>是 0.75/0.60/0.40/0.30/0.25——<b>算法看不到这几个数</b>,只能靠一次次抛硬币去估。</span></div>
      </Sec>

      <Sec n={3} title="灵魂：UCB 平衡利用与探索">
        <div className="gd-lane">
          <div className="gd-card hit"><h4>UCB = 实测胜率 + c·√(ln N父/n子)</h4><p>前项<em>利用</em>(已经量到的胜率)、后项<em>探索</em>(试得越少这项越大;没试过=∞)。</p></div>
          <div className="gd-card miss"><h4>c=0 就废了</h4><p>探索项恒为 0,开局各试一次之后<em>谁碰巧赢就一直押谁</em>——加到 320 轮也只有 <b>64.4%</b>。<em>不是收敛得慢,是不收敛。</em></p></div>
          <div className="gd-card i"><h4>AlphaGo 引擎</h4><p>用<em>策略网给先验、价值网估胜率</em>替代随机 rollout;和思维树 ToT 一家。</p></div>
        </div>
      </Sec>

      {/*  2026-09-09 补厚：老版本三节讲完就收，而"靠**大量**随机对局的统计说话"
           里的"大量"到底是多少，从来没画出来过。这一节就画它。 */}
      <Sec n={4} title="但「大量」两个字不是修辞">
        <div className="gd-graph">
          <svg viewBox="0 0 200 84" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="6" y="8" fontSize="5" fill="var(--faint)">选对率 vs 模拟预算（每档换种子重跑 500 次；横轴对数）</text>
            {[0, 0.5, 1].map(v => (
              <g key={v}>
                <line x1="24" y1={72 - v * 54} x2="192" y2={72 - v * 54} stroke="var(--line-soft)" strokeWidth="0.4" />
                <text x="21" y={74 - v * 54} fontSize="4.5" fill="var(--faint)" textAnchor="end">{v * 100}%</text>
              </g>
            ))}
            {/*  瞎猜的基线：5 选 1 = 20% */}
            <line x1="24" y1={72 - 0.2 * 54} x2="192" y2={72 - 0.2 * 54} stroke="var(--miss)" strokeWidth="0.6" strokeDasharray="2 2" />
            <text x="192" y={72 - 0.2 * 54 - 2} fontSize="4.5" fill="var(--miss)" textAnchor="end">瞎猜 20%</text>
            <polyline points={MCTS_SWEEP.map(([b, p], i) => `${30 + i * 32},${72 - p * 54}`).join(' ')}
              fill="none" stroke="var(--now)" strokeWidth="1.4" />
            {MCTS_SWEEP.map(([b, p], i) => (
              <g key={b}>
                <circle cx={30 + i * 32} cy={72 - p * 54} r="1.8" fill="var(--now)" />
                <text x={30 + i * 32} y="80" fontSize="4.5" fill="var(--faint)" textAnchor="middle">{b}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>最好的两个走法只差 <b>0.15</b>(0.75 vs 0.60)。<b>单场模拟就是抛一次硬币,它什么都不说明</b>——20 轮下来选对的概率只有 <b>55%</b>,要到 <b>320 轮才 99%</b>。所以读 MCTS 的输出时,<b>先问它跑了多少轮</b>。AlphaGo 用价值网络替代随机 rollout,省掉的正是这几万次抛硬币。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '走法爆炸没法全搜' }, { cls: 'pd', text: '选择:UCB 挑分支' },
          { cls: 'pi', text: '模拟:随机走到底' }, { cls: 'pt', text: '回传:更新胜率' },
          { cls: 'ph', text: '访问集中到最优' },
        ]}
        why={<><b>为什么"MCTS"是让机器下赢围棋的关键一招:</b>它绕开了一个几十年无解的难题——围棋没有好的评估函数,走法又多到穷举绝无可能。MCTS 的答案是不靠人类棋理,而靠随机模拟的统计:与其试图算清每一步的好坏,不如从当前局面出发,一遍遍随机地把棋走到底,用大量对局的胜率来给走法打分。它的精髓凝结在 UCB 那一个式子里——它同时盯着两件事:一个走法眼下的胜率有多高(该多利用),以及它被试得够不够(该多探索),两相权衡,让搜索既不固执于当前最优、也不盲目乱撞,而是把有限的模拟聪明地倾注到最有前途的分支上。反复成千上万轮后,好的走法自然被反复眷顾、访问数一骑绝尘,答案水落石出。它和你见过的思维树是同一种精神——带评估的树搜索,也和强化学习血脉相通——都在用"结果"反推"每一步的价值"。AlphaGo 的伟大,正是在这套骨架上,用神经网络替换了随机模拟与人工先验,让机器第一次在围棋上战胜了人类顶尖高手;而从棋盘到机器人规划,凡是要在浩瀚可能中聪明搜索的地方,都有它的身影。</>} />
    </Shell>
  )
}

function GanDiagram() {
  return (
    <Shell icon={Icn.chip} title="生成对抗网络 GAN 原理"
      sub="看懂：造假的 G 和验假的 D 互相较劲，把假数据逼到和真的难分">
      <Sec n={1} title="两个对手：生成器 G vs 判别器 D">
        <div className="gd-graph">
          <svg viewBox="0 0 200 60" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text x="10" y="30" fontSize="6" fill="var(--faint)">噪声</text>
            <rect x="26" y="18" width="34" height="22" rx="4" fill="color-mix(in srgb,var(--miss) 12%,var(--panel))" stroke="var(--miss)" strokeWidth="0.8" />
            <text x="43" y="27" textAnchor="middle" fontSize="6" fontWeight={700} fill="var(--miss)">G 造假</text>
            <text x="43" y="35" textAnchor="middle" fontSize="4.5" fill="var(--faint)">生成器</text>
            <line x1="60" y1="29" x2="86" y2="29" stroke="var(--faint)" strokeWidth="0.7" markerEnd="url(#gana)" />
            <text x="73" y="26" textAnchor="middle" fontSize="4.5" fill="var(--faint)">假样本</text>
            <text x="73" y="49" textAnchor="middle" fontSize="4.5" fill="#3b82f6">真样本↗</text>
            <line x1="60" y1="45" x2="86" y2="34" stroke="#3b82f6" strokeWidth="0.7" markerEnd="url(#gana)" />
            <rect x="88" y="18" width="34" height="22" rx="4" fill="color-mix(in srgb,#3b82f6 12%,var(--panel))" stroke="#3b82f6" strokeWidth="0.8" />
            <text x="105" y="27" textAnchor="middle" fontSize="6" fontWeight={700} fill="#3b82f6">D 鉴定</text>
            <text x="105" y="35" textAnchor="middle" fontSize="4.5" fill="var(--faint)">判别器</text>
            <line x1="122" y1="29" x2="148" y2="29" stroke="var(--faint)" strokeWidth="0.7" markerEnd="url(#gana)" />
            <text x="172" y="31" textAnchor="middle" fontSize="5.5" fill="var(--ink)">真 or 假?</text>
            <defs><marker id="gana" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="var(--faint)" /></marker></defs>
          </svg>
        </div>
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span><b>G</b> 从噪声造假、想骗过审查;<b>D</b> 看样本判真假。目标<b>完全对立</b>:G 要骗过 D、D 要抓住 G。</span></div>
      </Sec>

      <Sec n={2} title="军备竞赛：你追我赶，一起变强">
        <div className="gd-lane">
          <div className="gd-card i"><h4>D 抓得越准</h4><p>就逼着 <em>G 造得越逼真</em>——不然一眼被识破。</p></div>
          <div className="gd-card i"><h4>G 造得越像</h4><p>又逼着 <em>D 练就更毒的眼力</em>。循环上升。</p></div>
          <div className="gd-card hit"><h4>均衡:D→50%</h4><p>G 的假分布=真分布,D <em>再也分不出、只能瞎猜</em>=G 赢。</p></div>
        </div>
      </Sec>

      <Sec n={3} title="它做到过什么、又被谁接替">
        <div className="gd-note" style={{ marginTop: 0 }}>{Icn.info}<span>GAN 是图像生成的<b>里程碑</b>:逼真假人脸、风格迁移、老照片修复、超分辨率。训练难(易失衡/模式崩溃),图像生成王座后被更稳的<b>扩散模型</b>接替;判别器本质就是个<b>真假二分类器</b>,和扩散同属生成模型。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: 'G 从噪声造假' }, { cls: 'pd', text: 'D 判真假' },
          { cls: 'pi', text: '目标对立:骗过/抓住' }, { cls: 'pt', text: '对抗轮流变强' },
          { cls: 'ph', text: 'D→50%=G 学会生成' },
        ]}
        why={<><b>为什么"GAN"是深度学习里最富想象力的点子之一:</b>它用一个近乎游戏的设定,解决了"如何生成逼真数据"这个难题——不去费力地写下数据该长什么样,而是让两个网络当对手,在对抗中自己逼近答案。一个负责造假、一个负责鉴定,目标针锋相对:造假者只有骗过鉴定者才算成功,鉴定者只有识破造假者才算称职。于是每一方的进步都成了对另一方的施压,你追我赶,水涨船高,直到造出的假数据与真数据的分布再无二致、鉴定者只能掷硬币般地瞎猜——那一刻,生成器便学会了以假乱真。这个"对抗中共同进化"的思想极为深刻,它把一个难以直接定义的目标(什么叫"像真的"),转化成了一个可以互相监督、彼此校准的博弈,还顺带给出了一个优雅的成功判据:当审查者彻底失效,生成就成功了。GAN 曾让世界第一次见到 AI 凭空造出的、以假乱真的人脸,点燃了生成式 AI 的第一波浪潮;尽管它训练起来出了名的娇气、后来在图像生成上被更稳健的扩散模型接棒,但"让模型互相对抗着一起变强"的火种,已经播撒进了 AI 的许多角落。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 正向运动学 FK ═══════════════
//  数字取自内核默认配置 L=[2,2,1]、θ=[30°,60°,-30°],逐步手算核对过:
//  cum=30° → (1.732,1.000);cum=90° → (1.732,3.000);cum=60° → (2.232,3.866)。
function FKDiagram() {
  const jx = [40, 161, 161, 196], jy = [150, 117, 51, 22]
  return (
    <Shell icon={Icn.pin} title="正向运动学 FK 原理"
      sub="看懂：为什么「一个关节一个关节累加」就能算出手爪在哪">
      <Sec n={1} title="一条连杆链：转过的角累加，再沿这个朝向走一根连杆">
        <div className="gd-formula">
          cumθ<sub>i</sub> = θ<sub>1</sub>+…+θ<sub>i</sub>
          {'　'}<span className="fi">(累计朝向)</span>
          {'　　'}(x<sub>i</sub>, y<sub>i</sub>) = (x<sub>i−1</sub>, y<sub>i−1</sub>) + L<sub>i</sub>·(cos cumθ<sub>i</sub>, sin cumθ<sub>i</sub>)
        </div>
        <div className="gd-graph">
          <svg viewBox="0 0 380 168" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {[0, 1, 2].map(k => (
              <line key={k} x1={jx[k]} y1={jy[k]} x2={jx[k + 1]} y2={jy[k + 1]} stroke="var(--f-idx)" strokeWidth="4" strokeLinecap="round" />
            ))}
            <line x1="40" y1="150" x2="120" y2="150" stroke="var(--line)" strokeWidth="1.4" strokeDasharray="4 3" />
            {jx.map((x, k) => (
              <g key={k}>
                <circle cx={x} cy={jy[k]} r={k === 3 ? 7 : 6} fill={k === 3 ? 'var(--now)' : 'var(--panel)'} stroke={k === 3 ? 'var(--now)' : 'var(--f-idx)'} strokeWidth="2" />
                <text x={x + 11} y={jy[k] + 4} fontSize="10" fill="var(--faint)">
                  {k === 0 ? '基座' : k === 3 ? '末端' : `关节${k + 1}`}
                </text>
              </g>
            ))}
            <text x="86" y="140" fontSize="10" fill="var(--f-tag)">θ₁=30°</text>
            <text x="168" y="90" fontSize="10" fill="var(--f-tag)">θ₂=60°</text>
            <text x="200" y="46" fontSize="10" fill="var(--f-tag)">θ₃=−30°</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>关节角是<b>相对上一根连杆</b>量的,不是相对地面 —— 所以要先把它们<b>累加</b>成「相对地面的朝向」,才能沿着它走。这一条是整个 FK 的全部机关。</span></div>
      </Sec>

      <Sec n={2} title="三步就走完:每一步只做「累加朝向 + 走一根连杆」">
        <div className="gd-lane">
          <div className="gd-card t"><h4>① 关节1 · L=2</h4><p>cumθ = 30°<br />(0,0) + 2·(cos30°, sin30°)<br />→ <em>(1.732, 1.000)</em></p></div>
          <div className="gd-card i"><h4>② 关节2 · L=2</h4><p>cumθ = 30+60 = <em>90°</em><br />(1.732,1.000) + 2·(0, 1)<br />→ <em>(1.732, 3.000)</em></p></div>
          <div className="gd-card o"><h4>③ 关节3 · L=1</h4><p>cumθ = 90−30 = <em>60°</em><br />(1.732,3.000) + 1·(0.5, 0.866)<br />→ <em>(2.232, 3.866)</em></p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>第②步 cumθ 正好是 90°,所以 cos=0、sin=1 —— 那一根连杆<b>笔直向上</b>,x 一点没动。这一步最好核:看图上第二根确实是竖着的。末端朝向 = 最后的 cumθ = <b>60°</b>。</span></div>
      </Sec>

      <Sec n={3} title="为什么叫「正」向:反过来那条路难得多">
        <div className="gd-lane">
          <div className="gd-card t"><h4>正向 FK:角 → 位置</h4><p>一路累加,<em>一次算完、唯一解</em>。机械臂、机器狗的腿、底盘转向,都是同一条链。</p></div>
          <div className="gd-card i"><h4>逆向 IK:位置 → 角</h4><p>要<em>反解</em>:可能<em>无解</em>(够不着)、<em>两解</em>(肘朝上/朝下)、甚至<em>无穷解</em>(冗余臂)。所以 IK 单独一关。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '各关节角 θ' }, { cls: 'pd', text: '累加成朝向' },
          { cls: 'pt', text: '沿朝向走 L' }, { cls: 'pi', text: '下一节' }, { cls: 'ph', text: '末端位姿' },
        ]}
        why={<><b>为什么机器人学第一课是它:</b>后面所有东西都建在 FK 上 —— 雅可比是<b>把 FK 对关节角求偏导</b>、IK 是<b>把 FK 反过来解</b>、力控要用 FK 算力臂、规划算出的路径最后也要靠 FK 验证末端真到了那儿。先把「角 → 位置」这条链算清楚,后面才有得谈。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 雅可比矩阵 ═══════════════
//  L1=L2=2、θ=[30°,90°]:J 的四个元与 det 都按 2 连杆平面臂的公式手算核对过,
//  det = L1·L2·sinθ2 = 4·sin90° = 4;θ2→0(伸直)时 det=0,正是奇异。
function JacobianDiagram() {
  return (
    <Shell icon={Icn.ruler} title="雅可比矩阵原理"
      sub="看懂：J 把「关节怎么转」映成「末端怎么动」，det=0 时为什么丢一个自由度">
      <Sec n={1} title="它就是 FK 对每个关节角求偏导，排成一张表">
        <div className="gd-formula">
          [ẋ, ẏ]<sup>T</sup> = <span className="ft">J</span> · [θ̇<sub>1</sub>, θ̇<sub>2</sub>]<sup>T</sup>
          {'　　'}<span className="fi">J = ∂(末端 x, y) / ∂(θ<sub>1</sub>, θ<sub>2</sub>)</span>
        </div>
        <div className="gd-lane">
          <div className="gd-card t"><h4>正着用:算末端速度</h4><p>给一组关节角速度,乘上 J 就得到末端的线速度 —— <em>关节怎么转 → 手爪怎么飘</em>。</p></div>
          <div className="gd-card i"><h4>反着用:速度层 IK</h4><p>想让手爪<em>沿直线走</em>,就拿期望的末端速度乘 <em>J⁻¹</em> 反解关节速度。力控、遥操作都靠这一步。</p></div>
        </div>
      </Sec>

      <Sec n={2} title="这一台的 J:L₁=L₂=2、θ=[30°, 90°]">
        <div className="gd-formula">
          J = [ <span className="ft">−2.732</span>{'　'}<span className="ft">−1.732</span> ; <span className="fo">0.732</span>{'　'}<span className="fo">−1.000</span> ]
          {'　　'}det = (−2.732)(−1.000) − (−1.732)(0.732) = <b>4.000</b>
        </div>
        <div className="gd-note">{Icn.info}<span>det 有个漂亮的闭式:<b>det(J) = L₁·L₂·sin θ₂</b>。代进去 2·2·sin90° = 4,和上面按四个元硬算的一模一样 —— <b>两条路对上了,这张表就是对的</b>。</span></div>
      </Sec>

      <Sec n={3} title="θ₂ → 0:手臂伸直,det 归零,瞬间丢一个自由度">
        <div className="gd-lane">
          <div className="gd-card t"><h4>θ₂ = 90°</h4><p>det = 4·sin90° = <em>4</em><br />J 可逆,末端<em>想往哪动都行</em>。</p></div>
          <div className="gd-card i"><h4>θ₂ = 30°</h4><p>det = 4·sin30° = <em>2</em><br />还能动,但<em>越来越吃力</em>。</p></div>
          <div className="gd-card o"><h4>θ₂ = 0°(伸直)</h4><p>det = 4·sin0° = <em>0</em><br />两列平行 → 末端<em>只能沿一个方向动</em>,J⁻¹ 爆炸。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>直觉版:胳膊<b>伸直了就没法再往外伸</b> —— 那个方向的速度,无论关节怎么转都做不出来。这就是<b>奇异构型</b>;真机器人上表现为关节速度飙到无穷大,所以规划时要绕开它。</span></div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '一个构型 θ' }, { cls: 'pd', text: 'FK 求偏导' },
          { cls: 'pt', text: '得到 J' }, { cls: 'pi', text: '正:关节速→末端速' },
          { cls: 'ph', text: '反:J⁻¹ 解关节速' }, { cls: 'pm', text: 'det=0 → 奇异' },
        ]}
        why={<><b>为什么 det 这么要紧:</b>它不是一个抽象指标,而是<b>「这个姿势还剩多少可动性」</b>。det 越接近 0,同样的末端速度就要越大的关节速度去凑;到 0 那一刻,某个方向<b>根本做不出来</b>。所以机械臂的工作空间边界、遥操作的手感变重、力控突然发飘,追下去往往都是同一件事:det(J) 在往 0 掉。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · PID 控制 ═══════════════
//  目标=10、Kp=0.4、Kd=0.9、dt=0.5,被控对象是质量块(力→加速度,双积分)。
//  纯 P 冲到 11.77 还在涨(震荡);加上 D 之后平稳收敛到 10。数字取自内核默认配置。
function PIDDiagram() {
  return (
    <Shell icon={Icn.bulb} title="PID 控制原理"
      sub="看懂：只有 P 为什么一定震荡，加一个 D 为什么就能停住">
      <Sec n={1} title="每一拍只做一件事:算误差,再用三项合成推力">
        <div className="gd-formula">
          e = <span className="ft">目标 − 实际</span>
          {'　　'}u = <span className="ft">K<sub>p</sub>·e</span> + <span className="fi">K<sub>i</sub>·∑e</span> + <span className="fo">K<sub>d</sub>·Δe/Δt</span>
        </div>
        <div className="gd-lane">
          <div className="gd-card t"><h4>P 比例 · 现在差多少</h4><p>误差越大推得越使劲。<em>但它只看「现在」</em> —— 到达目标那一刻误差为 0,推力也为 0,可<em>速度还在</em>。</p></div>
          <div className="gd-card i"><h4>I 积分 · 一直差着没</h4><p>把误差<em>累计</em>起来。专治恒定扰动(比如重力)压出来的<em>稳态误差</em> —— P 和 D 都拿它没办法。</p></div>
          <div className="gd-card o"><h4>D 微分 · 正冲得多快</h4><p>看误差<em>缩小的速度</em>,提前给一个反向的<em>刹车</em>。它是阻尼,不是动力。</p></div>
        </div>
      </Sec>

      <Sec n={2} title="被控的是个质量块:力 → 加速度 → 速度 → 位置(双积分)">
        <div className="gd-note">{Icn.info}<span>关键就在这个<b>双积分</b>:推力不直接改位置,先变成加速度、再攒成速度、才移动位置。所以<b>推力归零的那一刻,速度是攒下来的、不会归零</b> —— 于是冲过头。这不是参数没调好,是<b>纯 P 控双积分对象必然的结果</b>。</span></div>
        <div className="gd-lane" style={{ marginTop: 12 }}>
          <div className="gd-card t"><h4>纯 P(K<sub>p</sub>=0.4)</h4><p>朝 10 冲 → 到 10 时速度还在 → 冲到 <em>11.77 还在涨</em> → 反向推 → 又冲过头 → <em>来回震荡</em>。</p></div>
          <div className="gd-card o"><h4>P + D(K<sub>d</sub>=0.9)</h4><p>还没到 10、误差正在快速缩小时,D 就<em>提前反向刹车</em> → 速度提前降下来 → <em>平稳停在 10</em>。</p></div>
        </div>
      </Sec>

      <Sec n={3} title="三项各治一种病 —— 缺哪个,就犯哪种毛病">
        <div className="gd-lane">
          <div className="gd-card t"><h4>只有 P</h4><p>能动、但<em>震荡</em>;负载一变还留<em>稳态误差</em>。</p></div>
          <div className="gd-card i"><h4>P + D</h4><p><em>不震荡了</em>,但恒定扰动下仍差一截 —— 这时才需要 I。</p></div>
          <div className="gd-card o"><h4>D 给太大</h4><p>对噪声极敏感,读数一抖就<em>猛刹</em> —— 真机器上表现为关节发抖。</p></div>
        </div>
      </Sec>

      <Flow
        pills={[
          { cls: 'p0', text: '目标' }, { cls: 'pd', text: 'e = 目标−实际' },
          { cls: 'pt', text: 'P:现在差多少' }, { cls: 'pi', text: 'I:一直差着没' },
          { cls: 'ph', text: 'D:冲得多快' }, { cls: 'pm', text: 'u → 力 → 位置' },
        ]}
        why={<><b>为什么机器人上到处是它:</b>关节要停在角度、底盘要停在位置、机械臂要压住一个力 —— 全是「测出误差、算出推力」这一个回路。PID 不需要知道被控对象的模型,<b>只靠误差就能工作</b>,这是它统治工业界几十年的原因;而它的三项各对应一种失败模式,调参本质上就是在问<b>「我现在犯的是哪一种毛病」</b>。</>} />
    </Shell>
  )
}

// ═══════════════ 算法补充 · mini 正则引擎 ═══════════════
//  s="aab" p="c*a*b":c* 吃 0 个 c、a* 吃 2 个 a、b 配 b → dp[3][5]=真。转移与格子可逐格手核。
function RegexDiagram() {
  return (
    <Shell icon={Icn.doc} title="mini 正则引擎原理"
      sub="看懂：`*` 为什么只能用 DP 讲清楚 —— 它有「吃 0 个」和「再多吃一个」两条路">
      <Sec n={1} title="先分清楚:正则的 `*` 和通配符的 `*` 不是一回事">
        <div className="gd-lane">
          <div className="gd-card t"><h4>正则 `x*`</h4><p>零或多个<em>它前面那个字符 x</em>。`a*` 只能配 a、aa、aaa… <em>配不了 b</em>。</p></div>
          <div className="gd-card i"><h4>通配符 `*`</h4><p>任意<em>一段</em>,什么字符都行。两者写法一样、含义完全不同 —— 这是最常见的混淆。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="一张表:dp[i][j] = 「s 的前 i 个字符,配不配得上 p 的前 j 个」">
        <div className="gd-formula">
          p[j−1] 不是 `*`:{'　'}dp[i][j] = <span className="ft">dp[i−1][j−1]</span> 且 s[i−1] 配 p[j−1]{'　'}<span className="fi">(两边各消一个)</span>
        </div>
        <div className="gd-lane">
          <div className="gd-card t"><h4>① x* 吃 0 个</h4><p>把 <em>"x*" 整段跳过</em>:dp[i][j] = <em>dp[i][j−2]</em>。s 一个字符都不消。</p></div>
          <div className="gd-card o"><h4>② x* 再多吃一个</h4><p>s[i−1] 得配得上 x,然后 dp[i][j] = <em>dp[i−1][j]</em> —— <em>消掉 s 一个字符,p 的 "x*" 留着继续吃</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>②那一条最容易写错:<b>j 不动</b>。因为 `x*` 还没用完,下一个字符可能还归它管 —— 「留在原地继续吃」正是 `*` 的全部含义。</span></div>
      </Sec>
      <Sec n={3} title="跑一遍:s = aab,p = c*a*b">
        <div className="gd-lane">
          <div className="gd-card t"><h4>c*</h4><p>s 里根本没有 c → 走①,<em>吃 0 个</em>,整段跳过。</p></div>
          <div className="gd-card i"><h4>a*</h4><p>走②两次,<em>吃掉 aa</em>。</p></div>
          <div className="gd-card o"><h4>b</h4><p>普通字符,和 s 最后的 b 对上 → <em>dp[3][5] = 真</em>。</p></div>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: 's 与 p' }, { cls: 'pd', text: '逐格填表' },
          { cls: 'pt', text: '普通字符:各消一个' }, { cls: 'pi', text: 'x*:吃 0 个' },
          { cls: 'ph', text: 'x*:再多吃一个' }, { cls: 'pm', text: 'dp[n][m] = 答案' },
        ]}
        why={<><b>为什么不用回溯:</b>回溯遇到多个 `*` 会把同一个子问题反复重算,最坏指数级(著名的正则灾难性回溯就是这么来的)。DP 把「s 前 i 个 × p 前 j 个」这 n×m 个子问题<b>各算一次存起来</b>,稳定 O(nm)。代价是 O(nm) 空间 —— 这是一笔明码标价的交易。</>} />
    </Shell>
  )
}

// ═══════════════ 算法补充 · 通配符匹配 ═══════════════
//  s="abcd" p="a*d":a↔a;遇 * 记锚点;d≠b 回溯让 * 吃 b、再吃 c;最后 d↔d → ✓。
function WildcardDiagram() {
  return (
    <Shell icon={Icn.doc} title="通配符匹配原理"
      sub="看懂：`*` 该吃几个字符 —— 用一个「锚点」把试错变成 O(n) 的回溯">
      <Sec n={1} title="难点只有一个:`*` 该吃几个,当场决定不了">
        <div className="gd-formula">
          <span className="ft">?</span> = 任意<b>一个</b>字符{'　　'}<span className="fo">*</span> = 任意<b>一段</b>(可以是空)
        </div>
        <div className="gd-note">{Icn.info}<span>`?` 好办,一对一消掉就行。`*` 麻烦在于:走到它的时候,<b>你并不知道后面该留几个字符给它</b> —— 吃多了后面不够配,吃少了又接不上。</span></div>
      </Sec>
      <Sec n={2} title="办法:先当它吃 0 个,走不通再回来让它多吃一个">
        <div className="gd-lane">
          <div className="gd-card t"><h4>遇到 `*` → 记锚点</h4><p>记下 <em>`*` 在 p 里的位置</em> 和 <em>s 当前的位置</em>,然后<em>当它吃 0 个</em>,继续往后走。</p></div>
          <div className="gd-card o"><h4>走不通 → 回溯</h4><p>回到锚点,让 `*` <em>多吃一个字符</em>(s 的起点后移一位),再往后试。</p></div>
        </div>
      </Sec>
      <Sec n={3} title="跑一遍:s = abcd,p = a*d">
        <div className="gd-lane">
          <div className="gd-card t"><h4>a ↔ a</h4><p>普通字符,对上,两边各进一位。</p></div>
          <div className="gd-card i"><h4>遇 `*`</h4><p>记锚点,先当<em>吃 0 个</em> → 拿 p 的 d 去配 s 的 b。</p></div>
          <div className="gd-card o"><h4>d ≠ b → 回溯两次</h4><p>让 `*` 吃掉 <em>b</em>、再吃掉 <em>c</em>;最后 <em>d ↔ d</em> → 匹配 ✓</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>关键在于<b>只保留最近的一个锚点</b> —— 前面的 `*` 一旦成功往后走了,就不必再回头。这一条让最坏也只是 O(n·m)、空间 <b>O(1)</b>,而朴素递归会指数爆炸。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '双指针扫 s / p' }, { cls: 'pd', text: '?、普通字符:各进一位' },
          { cls: 'pt', text: '遇 *:记锚点、先吃 0 个' }, { cls: 'ph', text: '走不通:回锚点、多吃一个' },
          { cls: 'pm', text: 'p 走完 = 匹配' },
        ]}
        why={<><b>和正则那题的分水岭:</b>通配符的 `*` 吃的是<b>任意一段</b>,所以「多吃一个」永远合法 —— 才能用一个锚点线性回溯。正则的 `x*` 只能吃 <b>x</b>,「能不能多吃」取决于当前字符,一个锚点管不住,只好上 DP。<b>同一个星号,含义差一点,解法就差一个量级。</b></>} />
    </Shell>
  )
}

// ═══════════════ 算法补充 · 快速选择 Quickselect ═══════════════
//  [7,2,9,4,5,1,8] 求第 3 大 → 升序第 n−k = 7−3 = 4 位;3 轮 partition 收敛到 A[4]=7。
function QuickselectDiagram() {
  return (
    <Shell icon={Icn.ruler} title="快速选择 Quickselect 原理"
      sub="看懂：为什么「只递归一侧」就能把 O(n㏒n) 降成 O(n)">
      <Sec n={1} title="借快排的 partition,但每轮只往一边走">
        <div className="gd-formula">
          partition 把 pivot 放到它<b>排序后的最终位置 P</b>
          {'　　'}P == 目标 → <span className="fo">就是它</span>{'　'}P {'>'} 目标 → <span className="ft">只递归左</span>{'　'}P {'<'} 目标 → <span className="fi">只递归右</span>
        </div>
        <div className="gd-note">{Icn.info}<span>partition 结束时,pivot 左边全比它小、右边全比它大 —— 所以 <b>pivot 已经站在最终位置上了</b>,不用再动。这一条是 Quickselect 的全部依据:比较一下位置,就知道答案在哪一侧。</span></div>
      </Sec>
      <Sec n={2} title="第 K 大 = 升序的第 n−K 位(下标从 0 数)">
        <div className="gd-formula">
          A = [7, 2, 9, 4, 5, 1, 8]{'　'}n = 7{'　'}K = 3
          {'　　'}⇒ 目标下标 = <b>7 − 3 = 4</b>{'　'}<span className="fi">(升序里第 5 小 = 第 3 大)</span>
        </div>
        <div className="gd-note">{Icn.info}<span>这一步换算最容易错。升序排好是 [1,2,4,5,<b>7</b>,8,9],下标 4 上正是 <b>7</b> —— 也正是第 3 大(9、8、7)。三轮 partition 之后,A[4] 收敛到 7。</span></div>
      </Sec>
      <Sec n={3} title="为什么是 O(n):丢掉的那一半再也不看了">
        <div className="gd-lane">
          <div className="gd-card t"><h4>快排:两侧都递归</h4><p>T(n) = <em>2·T(n/2) + O(n)</em> = O(n㏒n)。每一层都要把全部数据扫一遍。</p></div>
          <div className="gd-card o"><h4>快选:只递归一侧</h4><p>T(n) = <em>T(n/2) + O(n)</em> = n + n/2 + n/4 + … = <em>O(n)</em>。等比级数收敛到 2n。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「平均」二字要当真:pivot 选得极差时(每次只切掉一个)会退化成 <b>O(n²)</b>。工程上用随机 pivot 或三数取中来躲开;要最坏也 O(n),那是 median-of-medians。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '第 K 大' }, { cls: 'pd', text: '换成下标 n−K' },
          { cls: 'pt', text: 'partition 定住 pivot' }, { cls: 'pi', text: '比一比位置' },
          { cls: 'ph', text: '只递归那一侧' }, { cls: 'pm', text: '位置对上 = 答案' },
        ]}
        why={<><b>什么时候该用它:</b>只要问题是「第 K 大 / 前 K 个」而<b>不要求这 K 个有序</b>,快选就比排序划算。要是还要求有序,或者数据大到内存装不下,那就换小顶堆(Top-K 那一关)—— <b>堆胜在流式、O(n㏒K),快选胜在全量在内存时的 O(n)。</b></>} />
    </Shell>
  )
}

// ═══════════════ 算法补充 · Trie 自动补全 ═══════════════
//  词表 cat/car/card/care/dog,前缀「car」→ 子树 car/card/care → 按热度排 care(4)/car(3)/card(2)。
function TrieDiagram() {
  return (
    <Shell icon={Icn.chip} title="Trie 自动补全原理"
      sub="看懂：搜索框「打几个字母就弹候选」是怎么做到跟词表大小无关的">
      <Sec n={1} title="前缀树:路径拼出前缀,词挂在末尾节点上">
        <div className="gd-graph">
          <svg viewBox="0 0 380 160" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {[[190, 20, 120, 60], [190, 20, 300, 60], [120, 60, 120, 100], [120, 100, 70, 140], [120, 100, 170, 140]].map(([x1, y1, x2, y2], k) =>
              <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line)" strokeWidth="1.6" />)}
            {[[190, 20, '根'], [120, 60, 'c·a'], [300, 60, 'd·o·g'], [120, 100, 'r'], [70, 140, 'd'], [170, 140, 'e']].map(([x, y, t], k) => (
              <g key={k}>
                <circle cx={x as number} cy={y as number} r="16" fill="var(--panel)" stroke={k === 3 ? 'var(--now)' : 'var(--f-idx)'} strokeWidth={k === 3 ? 2.6 : 1.8} />
                <text x={x as number} y={(y as number) + 4} fontSize="10" textAnchor="middle" fill="var(--ink)">{t}</text>
              </g>
            ))}
            <text x="140" y="98" fontSize="9" fill="var(--now)">前缀节点</text>
            <text x="60" y="158" fontSize="9" fill="var(--faint)">card</text>
            <text x="160" y="158" fontSize="9" fill="var(--faint)">care</text>
            <text x="96" y="52" fontSize="9" fill="var(--faint)">cat</text>
          </svg>
        </div>
        <div className="gd-note">{Icn.info}<span>同一个前缀的词<b>共用同一段路径</b> —— cat/car/card/care 都从 c→a 出发。这既省空间,又让「找前缀」变成一次沿树下行。</span></div>
      </Sec>
      <Sec n={2} title="三步补全:走到前缀 → 收集子树 → 按热度取 Top-K">
        <div className="gd-lane">
          <div className="gd-card t"><h4>① 走到前缀节点</h4><p>沿 c→a→r 下行,<em>O(前缀长度)</em> —— 和词表有一万还是一亿个词<em>完全无关</em>。</p></div>
          <div className="gd-card i"><h4>② DFS 收子树</h4><p>从这个节点往下,凡是打了「词尾」标记的都收:<em>car / card / care</em>。</p></div>
          <div className="gd-card o"><h4>③ 按热度排 Top-K</h4><p><em>care(4) / car(3) / card(2)</em> —— 候选顺序由频率定,不是字典序。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「跟词表大小无关」只对第①步成立。第②步的代价取决于<b>这个前缀底下有多少词</b> —— 所以输入越短候选越多、越慢,工程上会在节点上<b>预存该子树的 Top-K</b> 把②③也摊平。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '词表建 Trie' }, { cls: 'pd', text: '用户敲前缀' },
          { cls: 'pt', text: '沿树走到前缀节点' }, { cls: 'pi', text: 'DFS 收全部补全' },
          { cls: 'ph', text: '按热度排序' }, { cls: 'pm', text: 'Top-K 候选' },
        ]}
        why={<><b>为什么不是哈希表:</b>哈希能 O(1) 答「这个词在不在」,但答不了「<b>以 car 开头的都有哪些</b>」—— 哈希把前缀关系彻底打散了。Trie 的价值就在它<b>把前缀关系变成了树的结构本身</b>,所以「共同前缀」这类问题(补全、最长公共前缀、字典序遍历)天然属于它。</>} />
    </Shell>
  )
}

// ═══════════════ 算法补充 · LRU 缓存 ═══════════════
function LRUCacheDiagram() {
  return (
    <Shell icon={Icn.chip} title="LRU 缓存原理"
      sub="看懂：为什么非得是「哈希表 + 双向链表」两个结构一起上">
      <Sec n={1} title="要求苛刻在于:get 和 put 都要 O(1)">
        <div className="gd-lane">
          <div className="gd-card t"><h4>只用哈希表</h4><p>找得快,但<em>不知道谁最久没用</em> —— 要淘汰只能全扫一遍,O(n)。</p></div>
          <div className="gd-card i"><h4>只用链表</h4><p>顺序有了,但<em>找一个 key 要从头走</em>,O(n)。</p></div>
          <div className="gd-card o"><h4>两个一起上</h4><p>哈希表 <em>key → 节点指针</em>(找得快)+ 双向链表 <em>维护使用顺序</em>(摘得快)。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="为什么必须是「双向」链表">
        <div className="gd-note">{Icn.info}<span>哈希表给你的是<b>节点本身</b>,要把它从链表里摘下来,得知道<b>它的前驱</b>。单向链表只能从头找前驱 → O(n),那 O(1) 就破了。<b>双向</b>那根 prev 指针,买的就是这一下 O(1) 摘除。</span></div>
        <div className="gd-formula">
          头 = <span className="fo">最近用过</span>{'　'}←—— 链表 ——→{'　'}尾 = <span className="ft">最久没用</span>{'　　'}淘汰 = <b>摘尾</b>
        </div>
      </Sec>
      <Sec n={3} title="两个操作,各自只做两件事">
        <div className="gd-lane">
          <div className="gd-card t"><h4>get(k)</h4><p>哈希表定位 → 命中就<em>把节点移到头部</em>(它刚被用),返回值;未命中返回 −1。</p></div>
          <div className="gd-card o"><h4>put(k, v)</h4><p>已存在:更新 + 移到头。不存在:插到头;<em>若超容量就摘掉尾部</em>那个最久没用的。</p></div>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '一次访问' }, { cls: 'pd', text: '哈希表定位' },
          { cls: 'pt', text: '命中 → 移到头' }, { cls: 'pi', text: '未命中 → 插到头' },
          { cls: 'ph', text: '超容量 → 摘尾' }, { cls: 'pm', text: '头最新 · 尾最旧' },
        ]}
        why={<><b>它和操作系统的页面置换是同一件事:</b>408 里的 LRU 页面置换、CPU 的 Cache 替换策略、Redis 的 maxmemory-policy,内核都是这一个 —— <b>「最近用过的,大概率还会再用」</b>。区别只在硬件里没法真的维护一条链表(太贵),所以退而用近似 LRU(时钟算法、二次机会)。</>} />
    </Shell>
  )
}

// ═══════════════ 算法补充 · LFU 缓存 ═══════════════
function LFUCacheDiagram() {
  return (
    <Shell icon={Icn.chip} title="LFU 缓存原理"
      sub="看懂：按「用了几次」淘汰，同次数再按「谁最久没用」打破平手">
      <Sec n={1} title="和 LRU 差在看什么">
        <div className="gd-lane">
          <div className="gd-card t"><h4>LRU:只看时间</h4><p>淘汰<em>最久没用的</em>。一次偶然的扫描就能把整个缓存冲掉(缓存污染)。</p></div>
          <div className="gd-card o"><h4>LFU:先看频率</h4><p>淘汰<em>用得最少的</em>;<em>频率相同</em>时再按「最久没用」打平手 —— <em>LFU 内部还嵌着一层 LRU</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>那句「频率相同再看最久没用」不是补丁,是<b>必需的</b>:容量满时同频率的可能有好几个,没有第二把尺子就无从下手。</span></div>
      </Sec>
      <Sec n={2} title="怎么做到 O(1):频率桶 + 每桶一条链表 + 一个 minFreq">
        <div className="gd-formula">
          freq=1 → [链表]{'　'}freq=2 → [链表]{'　'}freq=3 → [链表]{'　　'}<span className="fo">minFreq</span> 指着当前最小的那个桶
        </div>
        <div className="gd-lane">
          <div className="gd-card t"><h4>访问一个 key</h4><p>从 freq 桶摘出来,<em>挂到 freq+1 桶的头部</em>。桶内顺序即 LRU 顺序。</p></div>
          <div className="gd-card o"><h4>要淘汰</h4><p>直接去 <em>minFreq 桶</em>,摘它的<em>尾部</em> —— 频率最低里最久没用的那个,O(1)。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>minFreq 的维护有个巧处:<b>新插入的 key 频率是 1,所以 minFreq 直接置 1</b>;而搬走一个 key 后若它原来的桶空了、且那正是 minFreq,minFreq 就 +1。只有这两种情况会动它。</span></div>
      </Sec>
      <Sec n={3} title="LeetCode 460 那串:capacity = 2">
        <div className="gd-lane">
          <div className="gd-card t"><h4>put(3) 时</h4><p>淘汰的是<em>频率最低</em>的那个 key 2 —— 不看它是不是刚放进来的。</p></div>
          <div className="gd-card o"><h4>put(4) 时</h4><p>两个 key <em>同频</em>,这才轮到第二把尺子:淘汰<em>最久没用</em>的 key 1。</p></div>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '一次访问' }, { cls: 'pd', text: '频率 +1' },
          { cls: 'pt', text: '搬到下一个桶的头' }, { cls: 'pi', text: '维护 minFreq' },
          { cls: 'ph', text: '淘汰:minFreq 桶的尾' }, { cls: 'pm', text: '频率低且最久没用' },
        ]}
        why={<><b>LFU 更好吗?不一定。</b>它记的是「历史上用了多少次」,于是<b>老资格很难被淘汰</b> —— 一个曾经很火、现在没人要的 key 会赖在缓存里(缓存陈旧)。真实系统用的是带<b>衰减</b>的 LFU(Redis 的 LFU 就会随时间降频),或者 W-TinyLFU 这类混合策略。<b>「按频率」和「按时间」各有各的病,这才是这道题真正的考点。</b></>} />
    </Shell>
  )
}

// ═══════════════ 算法补充 · 海量数据 Top-K ═══════════════
function TopKDiagram() {
  return (
    <Shell icon={Icn.star} title="海量数据 Top-K 原理"
      sub="看懂：内存装不下全量计数时，靠哪两个机制把问题变小">
      <Sec n={1} title="机制一:哈希分片 —— 同一个词一定落同一片">
        <div className="gd-formula">
          片号 = <span className="ft">hash(词) % N</span>
          {'　　'}⇒ 同一个词 → 同一个片号 → <b>它的计数绝不会被拆到两片</b>
        </div>
        <div className="gd-note">{Icn.info}<span>这一条是「分而治之」<b>能成立的前提</b>,不是顺带的性质。要是同一个词可能落到两片,每片各数一半,最后求和就得跨片对账 —— 那分片就白分了。<b>哈希是确定的</b>,所以每片可以完全独立统计。</span></div>
      </Sec>
      <Sec n={2} title="机制二:大小为 K 的小顶堆 —— 堆顶就是门槛">
        <div className="gd-lane">
          <div className="gd-card t"><h4>堆顶 = 这 K 个里最小的</h4><p>也就是<em>目前的第 K 大</em>,它就是<em>入选门槛</em>。</p></div>
          <div className="gd-card i"><h4>新词 ≤ 堆顶</h4><p>直接扔 —— 它<em>进不了前 K</em>,O(1) 判掉。</p></div>
          <div className="gd-card o"><h4>新词 {'>'} 堆顶</h4><p><em>淘汰堆顶、换上它</em>,再下沉调整,O(㏒K)。门槛随之抬高。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>反直觉的地方:求<b>最大</b>的 K 个,用的是<b>小</b>顶堆。因为你要频繁问的是「<b>这批里最弱的是谁,该不该被替掉</b>」—— 那个人恰好在小顶堆的堆顶。</span></div>
      </Sec>
      <Sec n={3} title="为什么不全排序">
        <div className="gd-formula">
          全排序 <span className="ft">O(n㏒n)</span>{'　'}·{'　'}小顶堆 <span className="fo">O(n㏒K)</span>
          {'　　'}n = 10 亿、K = 100 时,㏒K ≈ 7 而 ㏒n ≈ 30
        </div>
        <div className="gd-note">{Icn.info}<span>更要紧的是<b>空间</b>:排序要把全部数据握在手里,而堆<b>只占 K 个位置</b>,数据可以流式地过 —— 这才是「海量」二字的真正约束。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '海量原始流' }, { cls: 'pd', text: '哈希分片(同词同片)' },
          { cls: 'pt', text: '每片独立计数' }, { cls: 'pi', text: '喂进大小 K 的小顶堆' },
          { cls: 'ph', text: '≤堆顶就扔 · >堆顶就换' }, { cls: 'pm', text: '堆里 = Top-K' },
        ]}
        why={<><b>这道题为什么是系统设计的入门题:</b>它把两个最常用的招式摆在一起 —— <b>分片</b>(把装不下的问题切成装得下的)和<b>流式 + 有界内存</b>(不留全量,只留一个 K 大小的摘要)。热搜词、高频 IP、热门商品、日志里的 Top 错误,全是同一个模子;再往上就是 Count-Min Sketch 那类<b>连计数都只留近似值</b>的方法。</>} />
    </Shell>
  )
}

// ═══════════════ Agent 工程 · 主循环与终止 ═══════════════
function ReactAgentDiagram() {
  return (
    <Shell icon={Icn.bulb} title="Agent 主循环原理"
      sub="看懂：循环谁都会写，难的是让它「正确地停」">
      <Sec n={1} title="循环本身只有三拍">
        <div className="gd-formula">
          <span className="ft">Thought 想</span> → <span className="fi">Action 调工具</span> → <span className="fo">Observation 看结果</span> → 想 → …
        </div>
        <div className="gd-note">{Icn.info}<span>术语先钉住:一次<b>模型请求 + 它发起的工具</b>叫一个 <b>step</b>;预算通常按 step 或成本算,不按「轮」算。</span></div>
      </Sec>
      <Sec n={2} title="四条终止路径 —— 工程上写错的全在这儿">
        <div className="gd-lane">
          <div className="gd-card t"><h4>① 正常收尾</h4><p>模型<em>不再发工具调用</em>,给出 Final Answer。这是唯一「体面」的出口。</p></div>
          <div className="gd-card i"><h4>② stuck 检测</h4><p>最近几步<em>动作完全一样</em> → 它卡住了 → 中止。不做这一条就是<em>死循环烧钱</em>。</p></div>
          <div className="gd-card o"><h4>③ 撞预算</h4><p>步数/成本到顶 → 停,交<em>当前 best-effort</em>,而不是干脆什么都不给。</p></div>
          <div className="gd-card t"><h4>④ 出错兜底</h4><p>中途异常<em>不硬崩</em>,autosubmit 交一版当前最好结果(SWE-agent 的做法)—— <em>别白跑</em>。</p></div>
        </div>
      </Sec>
      <Sec n={3} title="为什么它是「确定性状态机」而不是模型的事">
        <div className="gd-note">{Icn.info}<span>「调哪个工具」是模型决定的、不确定;<b>「什么时候停」必须由 harness 说了算</b>。把停不停交给模型,就等于把预算交给一个不知道自己在烧钱的东西 —— 这条分界线是整套 Agent 工程的地基。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '任务进来' }, { cls: 'pd', text: '想 → 做 → 看' },
          { cls: 'pt', text: '不再发调用 → 收尾' }, { cls: 'pi', text: '动作重复 → stuck' },
          { cls: 'ph', text: '预算到顶 → 交 best-effort' }, { cls: 'pm', text: '异常 → autosubmit' },
        ]}
        why={<><b>为什么这题面试必问:</b>循环三行就写完,而<b>四条出口每缺一条就对应一种线上事故</b> —— 缺②烧钱、缺③失控、缺④白跑一小时。会写循环不算会,<b>把「怎么停」列全了才算</b>。</>} />
    </Shell>
  )
}

// ═══════════════ Agent 工程 · 工具调用流水线 ═══════════════
function ToolCallDiagram() {
  return (
    <Shell icon={Icn.chip} title="工具调用 Tool Calling 原理"
      sub="看懂：模型只负责「想调谁」，harness 那条四步流水线才是工程">
      <Sec n={1} title="分界线:哪一半是模型的,哪一半是你的">
        <div className="gd-lane">
          <div className="gd-card t"><h4>模型的一半</h4><p>决定<em>调哪个工具、传什么参数</em>。不确定、可能出错、可能瞎编。</p></div>
          <div className="gd-card o"><h4>你的一半</h4><p>解析 → 门禁 → 执行 → 回灌。<em>确定性流水线</em> —— 面试问的、线上炸的,都是这一半。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="四步流水线">
        <div className="gd-lane">
          <div className="gd-card t"><h4>① 解析 parse</h4><p>模型那段文本 → <em>{'{工具名, 参数}'}</em>;不合法 → <em>PARSE_ERROR</em>。编码不止 JSON:Codex 用自由文本 apply_patch、Aider 用文本 diff。</p></div>
          <div className="gd-card i"><h4>② 门禁 guard</h4><p>是已知工具吗(<em>UNKNOWN_TOOL</em>)?权限允许吗(<em>DENY</em>)?这一步挡在执行之前。</p></div>
          <div className="gd-card o"><h4>③ 执行 execute</h4><p>真跑,<em>带超时</em>。</p></div>
          <div className="gd-card t"><h4>④ 回灌 inject</h4><p>结果(或错误)当成一条 tool_result,<em>配对着它的调用</em>喂回模型。</p></div>
        </div>
      </Sec>
      <Sec n={3} title="最要紧的一条八股:出错不要抛异常终止循环">
        <div className="gd-formula">
          工具报错 → <span className="ft">当作一条结果喂回去</span> → 模型看得见 → <span className="fo">它自己重试 / 换招</span>
        </div>
        <div className="gd-note">{Icn.info}<span>把异常向上抛,循环就死了、这一轮白跑;<b>把错误喂回去,模型才有机会自我修复</b>。「配对」也不能省 —— tool_result 必须带上它对应的 call_id,否则模型分不清哪条结果是哪次调用的。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '模型发出调用' }, { cls: 'pd', text: '解析' },
          { cls: 'pt', text: '门禁' }, { cls: 'pi', text: '执行(带超时)' },
          { cls: 'ph', text: '回灌(配对)' }, { cls: 'pm', text: '下一轮' },
        ]}
        why={<><b>为什么把门禁摆在执行之前:</b>这四步的顺序不是随便排的 —— 解析失败就没必要问权限,权限不过就绝不能执行。<b>每一步都是下一步的前提</b>,顺序错一处,就会出现「先删了库再发现没权限」这种事。</>} />
    </Shell>
  )
}

// ═══════════════ Agent 工程 · 提示词组装与前缀缓存 ═══════════════
function PromptBuildDiagram() {
  return (
    <Shell icon={Icn.ruler} title="提示词组装原理"
      sub="看懂：为什么「段的排序」能决定这一轮花 1 倍钱还是 0.1 倍">
      <Sec n={1} title="前缀缓存是「最长相同前缀」匹配,不是「有没有出现过」">
        <div className="gd-formula">
          缓存覆盖 <span className="ft">tools</span> → <span className="fi">system</span> → <span className="fo">messages</span>
          {'　　'}<b>断点及之前任何一处变了 → 缓存全失效,后面全部重算</b>
        </div>
        <div className="gd-note">{Icn.info}<span>「最长相同前缀」这五个字是全部机关:它<b>从头开始比</b>,一撞上不一样的就停。所以靠前的一个字符变了,后面几万 token 命中过的缓存<b>一起作废</b>。</span></div>
      </Sec>
      <Sec n={2} title="于是规则很硬:静态的排前面,动态的排后面">
        <div className="gd-lane">
          <div className="gd-card t"><h4>缓存写</h4><p>1.25× 基础价 —— 第一轮多花一点。</p></div>
          <div className="gd-card o"><h4>缓存读</h4><p><em>0.1×</em> 基础价 —— 命中就是<em>省 90%</em>。</p></div>
          <div className="gd-card i"><h4>断点放哪</h4><p>放在<em>「逐轮都不变的最后一块」</em>之后 —— 让不变的部分尽可能长。</p></div>
        </div>
      </Sec>
      <Sec n={3} title="经典翻车:把每轮都变的东西塞到靠前的块里">
        <div className="gd-note">{Icn.info}<span>时间戳、运行时快照、随机 id —— 只要它进了靠前的块,<b>前缀每轮都不同、缓存永远不命中</b>,每轮全价重算。最坑的是它<b>不报错、功能完全正常</b>,只是账单是别人的十倍。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '各段素材' }, { cls: 'pd', text: '按 tools→system→messages 排' },
          { cls: 'pt', text: '静态在前' }, { cls: 'pi', text: '断点划在不变的末尾' },
          { cls: 'ph', text: '第 1 轮写缓存 1.25×' }, { cls: 'pm', text: '之后读缓存 0.1×' },
        ]}
        why={<><b>它和 KV 缓存、上下文压缩是同一件事的三个面:</b>都建立在「<b>相同前缀的注意力计算可以复用</b>」上。所以上下文压缩也有一条铁律 —— <b>压缩要保住前缀</b>,否则省下的 token 还不够重算缓存的钱。</>} />
    </Shell>
  )
}

// ═══════════════ Agent 工程 · 规划与 Todo ═══════════════
function PlanningDiagram() {
  return (
    <Shell icon={Icn.doc} title="规划 · 计划模式 + Todo 原理"
      sub="看懂：三个机制里，最不显眼的「复述」其实是在操控注意力">
      <Sec n={1} title="计划模式是硬门禁,不是建议 —— 这是真实的产品分叉">
        <div className="gd-lane">
          <div className="gd-card t"><h4>强制(Claude Code)</h4><p>在<em>权限层</em>把「写」堵死:<em>批准计划前只能读</em>,逼你先看后动。bypass 模式才降级成软提示。</p></div>
          <div className="gd-card i"><h4>建议(DeepSeek plan-mode)</h4><p><em>纯建议</em>,工具照样能调 —— 模型「答应了先规划」不等于它做不到别的。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>这条分叉和沙箱/权限那一关是一脉:<b>约束写在提示词里叫建议,写在权限层才叫门禁</b>。</span></div>
      </Sec>
      <Sec n={2} title="Todo 是状态机,不是清单">
        <div className="gd-formula">
          pending → <span className="fo">in_progress</span> → completed
          {'　　'}<b>任何时刻恰好一个 in_progress</b>{'　'}<span className="fi">(逼串行,别并行摊大)</span>
        </div>
        <div className="gd-note">{Icn.info}<span>「恰好一个」是硬约束。允许多个进行中,模型就会同时开五件事、每件做一半 —— 长任务翻车最常见的形态。</span></div>
      </Sec>
      <Sec n={3} title="复述:每轮把整张 todo 重新贴到上下文近端">
        <div className="gd-note">{Icn.info}<span>这一条最容易被当成「记账」而放过。它真正在做的是<b>注意力操控</b>:把全局计划推回模型的<b>近端注意力</b>,对抗长任务里的 <b>lost-in-the-middle 漂移</b>。不是给人看的,是<b>把模型摁在当前这一步上</b>。</span></div>
        <div className="gd-formula">
          现实和计划总会岔开{'　'}→{'　'}<span className="ft">重规划</span>(整表替换){'　'}而不是硬着头皮走完
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '任务进来' }, { cls: 'pd', text: '计划模式:只读探查' },
          { cls: 'pt', text: '批准 → 解锁写' }, { cls: 'pi', text: 'todo 恰一个进行中' },
          { cls: 'ph', text: '每轮复述整表' }, { cls: 'pm', text: '岔开了就重规划' },
        ]}
        why={<><b>为什么复杂任务不能上来就写:</b>模型一旦开始改代码,上下文就被 diff 和报错填满,<b>原始需求会被挤到中间那段最没注意力的位置</b>。先规划、再复述,本质上都是在跟「注意力是有限且不均匀的」这件事作斗争 —— 这才是这三个机制真正的共同点。</>} />
    </Shell>
  )
}

// ═══════════════ Agent 工程 · 上下文压缩 ═══════════════
function CtxCompactDiagram() {
  return (
    <Shell icon={Icn.ruler} title="上下文压缩原理"
      sub="看懂：窗口爆了怎么办 —— 三步操作，一步比一步贵">
      <Sec n={1} title="① 分区:留头、留尾、压中间">
        <div className="gd-formula">
          <span className="ft">留头</span>(系统 + 首任务,钉住) ‖ <span className="fi">压中间</span> ‖ <span className="fo">留最近</span>(原样)
        </div>
        <div className="gd-note">{Icn.info}<span>分界线<b>不许拆开「工具调用 ↔ 结果」这一对</b> —— 拆了模型会看到一个没有结果的调用,或者一条不知道来自哪次调用的结果,比压缩本身更糟。</span></div>
      </Sec>
      <Sec n={2} title="② 先剪超大工具输出 —— 最便宜的一招">
        <div className="gd-note">{Icn.info}<span>一次 <code>cat</code> 大文件、一次全量日志,往往就占了会话的一半。<b>先剪它,够了就停</b>,连模型调用都不用花。<b>顺序本身就是优化</b>:便宜的招先试。</span></div>
      </Sec>
      <Sec n={3} title="③ 还超 → 压中间:总结 vs 省略,一笔明码标价的交易">
        <div className="gd-lane">
          <div className="gd-card t"><h4>总结</h4><p>8 段摘要。<em>有损</em>、<em>要花一次模型调用</em>,但<em>记得住</em>大意。</p></div>
          <div className="gd-card o"><h4>省略</h4><p>一行标记顶掉。<em>免费</em>、但<em>彻底失忆</em> —— 那段发生过什么再也问不出来。</p></div>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '窗口满了' }, { cls: 'pd', text: '分区(不拆调用↔结果)' },
          { cls: 'pt', text: '剪超大工具输出' }, { cls: 'pi', text: '够了就停' },
          { cls: 'ph', text: '还超 → 总结 / 省略' }, { cls: 'pm', text: '接着跑' },
        ]}
        why={<><b>为什么「留头」不能省:</b>系统提示和最初的任务描述一旦被压掉,Agent 就会<b>忘记自己在干什么</b> —— 而它不会告诉你,只会开始做一件相邻但不对的事。留头留尾压中间,对应的正是「<b>身份和目标最重要、最近的细节次之、中间的过程最可弃</b>」这个排序。顺带:压缩要<b>保住前缀</b>,不然前缀缓存全废(见提示词组装那一关)。</>} />
    </Shell>
  )
}

// ═══════════════ Agent 工程 · 沙箱与权限 ═══════════════
function PermGuardDiagram() {
  return (
    <Shell icon={Icn.cross} title="沙箱 / 权限原理"
      sub="看懂：两道互相独立的墙，为什么必须都过才放行">
      <Sec n={1} title="第一道:规则/审批 —— 首次匹配即生效">
        <div className="gd-formula">
          <span className="ft">deny</span> → <span className="fi">ask</span> → <span className="fo">allow</span>
          {'　　'}<b>按这个次序查,第一条匹配上就定案</b>
        </div>
        <div className="gd-note">{Icn.info}<span>次序不是随便排的:<b>危险的先拦下</b>。要是 allow 排在前面,一条宽松规则就能盖住后面所有的 deny —— 和访问控制那一关(路由器 ACL)是同一条道理。</span></div>
      </Sec>
      <Sec n={2} title="第二道:沙箱 —— 物理隔离,fail-closed">
        <div className="gd-lane">
          <div className="gd-card t"><h4>fail-closed</h4><p>判不准就<em>拦</em> —— 宁可拦错,不可放过。安全系统的默认方向和功能系统正好相反。</p></div>
          <div className="gd-card i"><h4>网络默认关</h4><p>不联网,数据就带不出去。</p></div>
          <div className="gd-card o"><h4>写限工作区内</h4><p>就算规则被绕过,能改的也只有这一片。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>两道墙<b>相互独立</b>(Codex 的两个正交轴):规则管「该不该」,沙箱管「能不能」。<b>都过了才真跑</b> —— 任何一道单独出问题,另一道还兜得住。</span></div>
      </Sec>
      <Sec n={3} title="越权时怎么办:升级,而且只升这一次">
        <div className="gd-formula">
          模型带理由申请更宽范围 → <span className="ft">一次人工批准</span> → <b>只这一次</b>
          {'　'}<span className="fi">(不是 allow-always)</span>
        </div>
        <div className="gd-note">{Icn.info}<span>「只这一次」是防<b>权限蔓延</b>:一次为了装个包而开的 allow-always,会永远留在那里,而下次用它的可能是完全不同的操作。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '模型要跑一条命令' }, { cls: 'pd', text: '定性' },
          { cls: 'pt', text: '规则:deny→ask→allow' }, { cls: 'pi', text: '沙箱:fail-closed' },
          { cls: 'ph', text: '两墙都过 → 执行' }, { cls: 'pm', text: '越权 → 一次性升级' },
        ]}
        why={<><b>为什么这套是「确定性决议」:</b>放不放行<b>绝不能由模型说了算</b> —— 模型是被审查的那一方,让它自己判自己,等于没有审查。这条边界和 Agent 主循环里的「谁决定停」是同一句话:<b>凡是关乎钱和安全的判断,都必须留在 harness 里。</b></>} />
    </Shell>
  )
}

// ═══════════════ Agent 工程 · 子 Agent 委派 ═══════════════
function SubagentDiagram() {
  return (
    <Shell icon={Icn.chip} title="子 Agent 委派原理"
      sub="看懂：派活出去的头号理由不是「分工」，是「省父的上下文」">
      <Sec n={1} title="为什么要独立子 agent">
        <div className="gd-formula">
          子在<span className="ft">自己独立的上下文</span>里读一堆文件、试一堆
          {'　'}→{'　'}<span className="fo">只把最终结论回传</span>
          {'　'}⇒ 子干了一大堆活,<b>父的上下文只涨一点点</b>
        </div>
        <div className="gd-note">{Icn.info}<span>大块探索被<b>关在子里</b>,不污染父。这才是子 agent 存在的头号理由 —— 「分工」只是顺带的。</span></div>
      </Sec>
      <Sec n={2} title="新开还是承接:spawn vs fork">
        <div className="gd-lane">
          <div className="gd-card t"><h4>spawn 新开</h4><p>子<em>从空白起</em>。便宜、没有父的历史 —— 也意味着<em>要把背景讲清楚</em>才干得对。</p></div>
          <div className="gd-card o"><h4>fork 承接</h4><p>子<em>承接父的前缀</em>。有上下文、<em>KV 缓存友好</em>,但更贵。</p></div>
        </div>
      </Sec>
      <Sec n={3} title="防 fork 炸弹:两道上限">
        <div className="gd-lane">
          <div className="gd-card t"><h4>深度上限</h4><p>Claude Code <em>maxDepth 3</em>:到顶就把 spawn 工具<em>摘掉</em> —— 不是靠提示词说「别再派了」。</p></div>
          <div className="gd-card i"><h4>并发上限</h4><p><em>≤20</em>。没有这两条,子生子就是<em>指数爆炸</em>。</p></div>
          <div className="gd-card o"><h4>权限不可自扩</h4><p>派出时<em>定死</em>,子自己扩不了 —— 接上「沙箱/权限」那一课。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「到顶就把工具摘掉」比「告诉模型别派了」硬得多 —— <b>能力上没有,就不可能做</b>。这和计划模式在权限层堵死写操作是同一个手法。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '父接到复杂任务' }, { cls: 'pd', text: '派子(spawn / fork)' },
          { cls: 'pt', text: '子在独立上下文里干' }, { cls: 'pi', text: '只回传最终结论' },
          { cls: 'ph', text: '深度/并发上限守着' }, { cls: 'pm', text: '父上下文只涨一点' },
        ]}
        why={<><b>子崩了不连累父</b>,这一条常被忽略但很值钱:子 agent 天然是一道<b>故障隔离边界</b>。所以「派子」同时买到三样 —— 省上下文、限权限、隔离故障;代价是背景要重新讲一遍(spawn)或者贵一点(fork)。</>} />
    </Shell>
  )
}

// ═══════════════ Agent 工程 · 记忆检索打分 ═══════════════
function MemRetrieveDiagram() {
  return (
    <Shell icon={Icn.star} title="记忆检索打分原理"
      sub="看懂：不是「grep 一下」，是三个信号加权排序取 top-k">
      <Sec n={1} title="三个信号,各管一件事">
        <div className="gd-lane">
          <div className="gd-card t"><h4>最近度 recency</h4><p><em>decay<sup>龄</sup></em>,decay = 0.995/小时 —— <em>指数衰减</em>,越久越淡。</p></div>
          <div className="gd-card i"><h4>重要度 importance</h4><p>LLM 给这条记忆打的 <em>1~10 分 / 10</em>。「用户是 VIP」=9 vs「吃了早饭」=1。</p></div>
          <div className="gd-card o"><h4>相关度 relevance</h4><p>记忆向量与<em>查询向量的余弦</em> —— 只有它跟「这次问的是什么」有关。</p></div>
        </div>
        <div className="gd-formula">
          得分 = w<sub>rec</sub>·最近度 + w<sub>rel</sub>·相关度 + w<sub>imp</sub>·重要度{'　'}→{'　'}排序{'　'}→{'　'}<b>只取 top-k 进上下文</b>
        </div>
      </Sec>
      <Sec n={2} title="权重不同,捞回来的东西就不同 —— 论文和代码还不一样">
        <div className="gd-lane">
          <div className="gd-card t"><h4>论文:1 · 1 · 1</h4><p>三者<em>等权</em>。</p></div>
          <div className="gd-card o"><h4>代码:0.5 · 3 · 2</h4><p>[最近 · 相关 · 重要] —— <em>相关度最重</em>,最近度反而最轻。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>这不是笔误,是<b>实践里调出来的</b>:等权时「刚发生的琐事」会把「三天前那条关键偏好」挤下去。<b>换一组权重,排名会整个翻过来</b> —— 所以这三个权重是这套系统真正的调参旋钮。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '查询来了' }, { cls: 'pd', text: '算最近度' },
          { cls: 'pt', text: '算相关度' }, { cls: 'pi', text: '算重要度' },
          { cls: 'ph', text: '加权求和排序' }, { cls: 'pm', text: 'top-k 进上下文' },
        ]}
        why={<><b>为什么不能全捞进去:</b>上下文是有限且有价的,而且塞得越多、<b>有用的那条越容易被淹没</b>(lost-in-the-middle)。检索的本质不是「找到」,是<b>「在有限的位置里,决定谁值得占一个」</b> —— 所以它必然是一个打分排序问题,而不是查询问题。</>} />
    </Shell>
  )
}

// ═══════════════ Agent 工程 · 记忆写入与冲突消解 ═══════════════
function MemWriteDiagram() {
  return (
    <Shell icon={Icn.doc} title="记忆写入 · 冲突消解原理"
      sub="看懂：为什么不能无脑追加 —— 记忆会自相矛盾，越用越脏">
      <Sec n={1} title="两阶段:先抽取,再逐条决定怎么写">
        <div className="gd-formula">
          <span className="ft">抽取</span>:从新对话里抽出若干<b>候选事实</b>
          {'　→　'}<span className="fo">更新</span>:每条候选<b>先检索最相似的旧记忆</b>,再挑一个操作
        </div>
      </Sec>
      <Sec n={2} title="四个操作 —— 关键在于「和旧的比过之后才决定」">
        <div className="gd-lane">
          <div className="gd-card t"><h4>ADD</h4><p>没有相似的 → <em>新建</em>。</p></div>
          <div className="gd-card i"><h4>UPDATE</h4><p><em>补充 / 修正</em>已有那条。</p></div>
          <div className="gd-card o"><h4>DELETE</h4><p>与已有<em>矛盾</em> → <em>删掉旧的</em>。</p></div>
          <div className="gd-card t"><h4>NOOP</h4><p>已经知道了 → <em>不动</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>典型例子:「用户住北京」和「用户搬上海了」。<b>无脑追加会让两条并存</b>,下次检索捞回来哪条全看权重 —— 记忆自相矛盾、越用越脏。DELETE 那一条就是专治它的。</span></div>
      </Sec>
      <Sec n={3} title="⚠️ 论文是四操作,现在 OSS 默认改回了单遍 ADD-only">
        <div className="gd-lane">
          <div className="gd-card t"><h4>四操作(mem0 论文)</h4><p>干净,但<em>每条候选都要一次 LLM 调用</em>去判 —— 慢且贵。</p></div>
          <div className="gd-card o"><h4>单遍 ADD-only(现默认)</h4><p><em>只加不改</em>。简单快,代价是<em>矛盾会积起来</em>。</p></div>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '新对话' }, { cls: 'pd', text: '抽出候选事实' },
          { cls: 'pt', text: '检索最相似的旧记忆' }, { cls: 'pi', text: 'LLM 判操作' },
          { cls: 'ph', text: 'ADD / UPDATE / DELETE / NOOP' }, { cls: 'pm', text: '记忆库更新' },
        ]}
        why={<><b>三课连起来看:</b>检索是「读」、这一课是「写」、反思是「消化」。写是三者里<b>唯一会把记忆库弄坏</b>的一环 —— 读错了只是这次答不好,写错了会一直错下去。所以「先比对再决定」这一步再贵也省不掉,除非你接受它慢慢变脏。</>} />
    </Shell>
  )
}

// ═══════════════ Agent 工程 · MemGPT 虚拟内存 ═══════════════
function MemPagingDiagram() {
  return (
    <Shell icon={Icn.chip} title="MemGPT 虚拟内存原理"
      sub="看懂：把上下文当 RAM、外部存储当磁盘 —— 和 408 的页面置换是同一套">
      <Sec n={1} title="两层存储:进 prompt 的是「内存」,不进的是「磁盘」">
        <div className="gd-lane">
          <div className="gd-card t"><h4>主上下文(RAM,进 prompt)</h4><p>① 系统指令(只读) ② 工作记忆 core(可函数改) ③ <em>FIFO 消息队列</em>(首槽 = 被驱逐消息的递归摘要)</p></div>
          <div className="gd-card o"><h4>外部存储(磁盘,不进 prompt)</h4><p>① <em>recall</em>:全消息库 ② <em>archival</em>:任意文本,可检索</p></div>
        </div>
      </Sec>
      <Sec n={2} title="内存压力:两条水位线">
        <div className="gd-formula">
          队列涨到 <span className="fi">70%</span> → 插一条<b>内存压力警告</b>
          {'　　'}到 <span className="ft">100%</span> → <b>flush</b>:驱逐约 <span className="fo">50%</span> 窗口的老消息到 recall
        </div>
        <div className="gd-note">{Icn.info}<span>驱逐的同时,用「<b>旧摘要 + 被驱逐消息</b>」生成新的<b>递归摘要</b>放回队列首槽 —— 有损,但腾出了 RAM。「递归」二字是说:<b>摘要自己也会被摘进下一份摘要</b>,所以越老的事越模糊,而不是突然消失。</span></div>
      </Sec>
      <Sec n={3} title="缺页:要用到已经被驱逐的旧信息">
        <div className="gd-formula">
          函数调用去 <span className="ft">recall / archival</span> 检索
          {'　→　'}<b>追加到队尾</b>、重新进上下文{'　'}<span className="fi">(page fault)</span>
        </div>
        <div className="gd-note">{Icn.info}<span>和 408 的缺页一模一样:<b>访问到不在「内存」里的东西 → 从「磁盘」调回来 → 继续</b>。区别只在这里的搬运工是模型自己发的函数调用,而不是硬件的 MMU。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '消息不断进队列' }, { cls: 'pd', text: '70% 压力警告' },
          { cls: 'pt', text: '100% flush' }, { cls: 'pi', text: '驱逐 ~50% 到 recall' },
          { cls: 'ph', text: '递归摘要回填首槽' }, { cls: 'pm', text: '要用旧的 → 缺页调回' },
        ]}
        why={<><b>为什么这个类比值钱:</b>它把一个新问题(上下文不够用)接到了一套<b>被研究了五十年的老问题</b>上 —— 于是页面置换、工作集、抖动(thrashing)这些结论全都能借过来。比如:驱逐得太狠会导致频繁缺页,这在 408 里叫抖动,在这里叫「一直在检索却干不了活」。<b>同一个病,同一个名字。</b></>} />
    </Shell>
  )
}

// ═══════════════ Agent 工程 · 反思与巩固 ═══════════════
function ReflectionDiagram() {
  return (
    <Shell icon={Icn.bulb} title="反思 / 巩固原理"
      sub="看懂：光存原始观察不够 —— 得定期把零散的攒成高层的">
      <Sec n={1} title="触发:不是定时,是「重要度攒够了」">
        <div className="gd-formula">
          最近一批观察的<b>重要度之和</b> {'>'} 阈值(论文里约 <span className="ft">150</span>){'　'}→{'　'}反思一次
        </div>
        <div className="gd-note">{Icn.info}<span>按重要度而不是按条数/时间触发,意思是:<b>平淡的一天不值得反思,发生大事的一小时值得</b>。阈值调低=反思勤(贵、但跟得紧),调高=反思懒。</span></div>
      </Sec>
      <Sec n={2} title="反思三步:提问 → 检索 → 综合出洞察(带证据)">
        <div className="gd-lane">
          <div className="gd-card t"><h4>① 提问</h4><p>让 LLM 就最近观察提出几个<em>最值得想的问题</em>。</p></div>
          <div className="gd-card i"><h4>② 检索</h4><p>每个问题各自去<em>检索相关记忆</em>(就是「记忆检索打分」那一课)。</p></div>
          <div className="gd-card o"><h4>③ 综合</h4><p>得出<em>洞察</em>,并<em>引用证据</em> —— 哪几条观察支撑它。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「引用证据」这一条别当成排版要求:它让洞察<b>可追溯、可推翻</b>。没有证据链的洞察和幻觉长得一模一样。</span></div>
      </Sec>
      <Sec n={3} title="洞察本身也是记忆,还能再被反思 —— 于是长成一棵树">
        <div className="gd-formula">
          raw 观察 = <span className="ft">叶子</span>{'　'}→{'　'}洞察 = <span className="fo">往上长的节点</span>(高重要度)
          {'　'}→{'　'}更高层反思{'　'}⇒{'　'}<b>反思树</b>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '观察不断累积' }, { cls: 'pd', text: '重要度攒够' },
          { cls: 'pt', text: '提最值得想的问题' }, { cls: 'pi', text: '各自检索相关记忆' },
          { cls: 'ph', text: '综合出洞察 + 证据' }, { cls: 'pm', text: '洞察入库,可再被反思' },
        ]}
        why={<><b>为什么叫「巩固」而不是「总结」:</b>总结是压缩,目的是省地方;巩固是<b>提炼出原始观察里没有明说的东西</b>——「他连着三次都选了同一家店」这条,任何一条单独的观察里都没有。前者少了信息,后者<b>多了信息</b>。这也是它值得单独花一次模型调用的原因。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 逆运动学 IK ═══════════════
//  L1=L2=2、目标 (2,2):两组解 (0°,90°) 肘下 与 (90°,−90°) 肘上,回代 FK 都落到 (2,2)。
function IKDiagram() {
  return (
    <Shell icon={Icn.pin} title="逆运动学 IK 原理"
      sub="看懂：FK 唯一解，IK 为什么会「两个答案」甚至「没有答案」">
      <Sec n={1} title="先问够不够得到 —— 这一步不做,后面全是幻觉">
        <div className="gd-formula">
          r = √(x² + y²){'　'}必须落在{'　'}<span className="ft">[ |L₁−L₂| , L₁+L₂ ]</span>
          {'　　'}<span className="fi">(太远够不着,太近手臂折不过来)</span>
        </div>
        <div className="gd-note">{Icn.info}<span>L₁=L₂=2 时可达范围是 [0, 4];目标 (2,2) 的 r = 2√2 ≈ <b>2.828</b>,在范围内 ✓。<b>范围外的目标不是「算不准」,是根本没有解</b> —— 代进余弦定理会得到 |cos| {'>'} 1。</span></div>
      </Sec>
      <Sec n={2} title="余弦定理给出肘角,正负两支就是两种姿势">
        <div className="gd-formula">
          cos θ₂ = (x² + y² − L₁² − L₂²) / (2·L₁·L₂)
          {'　　'}θ₂ = <span className="ft">±</span> acos(…){'　'}<span className="fo">← 那个 ± 就是两组解</span>
        </div>
        <div className="gd-lane">
          <div className="gd-card t"><h4>肘朝下</h4><p>θ₂ = <em>+90°</em>,配 θ₁ = <em>0°</em></p></div>
          <div className="gd-card o"><h4>肘朝上</h4><p>θ₂ = <em>−90°</em>,配 θ₁ = <em>90°</em></p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>两组解<b>回代 FK 都落到 (2,2)</b> —— 这就是检验 IK 对不对的唯一办法:<b>拿 FK 验它</b>。肩角 θ₁ = atan2(y,x) − atan2(L₂ sinθ₂, L₁+L₂ cosθ₂),θ₂ 的正负一变,第二项跟着变号。</span></div>
      </Sec>
      <Sec n={3} title="所以 IK 难在哪:不是解方程,是「选哪个解」">
        <div className="gd-lane">
          <div className="gd-card t"><h4>多解</h4><p>肘上/肘下都对。真机器上要看<em>关节限位、避障、和上一时刻的连续性</em>——不能这一帧肘上、下一帧肘下。</p></div>
          <div className="gd-card i"><h4>无解</h4><p>够不到。要么<em>拒绝</em>,要么<em>投影到最近的可达点</em>。</p></div>
          <div className="gd-card o"><h4>奇异</h4><p>伸直/对折时(θ₂=0 或 180°)两解<em>合成一个</em>,而且附近的解<em>极其敏感</em> —— 接上雅可比那一课的 det=0。</p></div>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '末端目标 (x,y)' }, { cls: 'pd', text: '判可达' },
          { cls: 'pt', text: '余弦定理求 θ₂(±)' }, { cls: 'pi', text: '回推 θ₁' },
          { cls: 'ph', text: '两组解' }, { cls: 'pm', text: '按限位/连续性挑一组' },
        ]}
        why={<><b>为什么六轴机械臂就没有这么漂亮的闭式解:</b>二连杆平面臂靠余弦定理三行搞定,而一般的六自由度臂只有满足特定几何条件(比如后三轴交于一点的球腕)才有闭式解,否则得上<b>数值迭代</b>(牛顿法 / 雅可比伪逆)。所以工业臂的机械设计里,「球腕」不是为了好看 —— <b>是为了让 IK 有闭式解</b>。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 位姿与四元数 ═══════════════
function QuatDiagram() {
  return (
    <Shell icon={Icn.ruler} title="位姿与四元数原理"
      sub="看懂：三种写法各有各的病，为什么机器人最后都选了四元数">
      <Sec n={1} title="同一个「朝向」,三种等价写法">
        <div className="gd-lane">
          <div className="gd-card t"><h4>欧拉角</h4><p>roll / pitch / yaw,<em>三个数、最直观</em>,但有<em>万向锁</em>。</p></div>
          <div className="gd-card i"><h4>旋转矩阵</h4><p>3×3、乘向量就转,<em>好算</em>,但 <em>9 个数带 6 条约束</em>,存储和插值都别扭。</p></div>
          <div className="gd-card o"><h4>四元数</h4><p><em>4 个数</em>、紧凑、<em>无奇异</em>、好插值 —— 机器人/图形/IMU 的首选。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="轴-角 → 四元数:那个「一半」是全部机关">
        <div className="gd-formula">
          绕单位轴 (a<sub>x</sub>,a<sub>y</sub>,a<sub>z</sub>) 转 θ{'　'}⇒{'　'}
          q = ( <span className="ft">cos(θ/2)</span>, <span className="fo">sin(θ/2)·轴</span> ){'　　'}且始终 <b>|q| = 1</b>
        </div>
        <div className="gd-note">{Icn.info}<span>绕 z 轴转 <b>90°</b>:q = (cos45°, 0, 0, sin45°) = <b>(0.707, 0, 0, 0.707)</b>;用它转 (1,0,0) 得到 <b>(0,1,0)</b> ✓。再让 q <b>自乘</b>(相当于转 180°),把 (1,0,0) 转到 <b>(−1,0,0)</b> ✓ —— 两步都能手核。</span></div>
      </Sec>
      <Sec n={3} title="万向锁:欧拉角在 pitch = ±90° 时丢一个自由度">
        <div className="gd-note">{Icn.info}<span>pitch 转到 ±90° 时,<b>yaw 和 roll 绕到了同一根轴上</b> —— 于是只有它们的<b>差</b>还起作用,三个自由度塌成两个。这不是数值精度问题,是<b>这套参数化本身的奇点</b>,再高的精度也躲不开。四元数没有这个毛病,代价是四个数不直观、还得记住 <b>q 和 −q 表示同一个旋转</b>。</span></div>
        <div className="gd-formula">
          组合旋转 = <span className="ft">四元数相乘 q₁ ⊗ q₂</span>{'　'}<span className="fi">(不可交换 —— 先转哪个结果不同)</span>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '绕某轴转 θ' }, { cls: 'pd', text: 'q = (cos θ/2, sin θ/2·轴)' },
          { cls: 'pt', text: '展成 3×3 的 R' }, { cls: 'pi', text: 'R·向量 = 转过去' },
          { cls: 'ph', text: 'q₁⊗q₂ = 组合' }, { cls: 'pm', text: '欧拉角:pitch=90° 锁死' },
        ]}
        why={<><b>为什么 IMU 输出的是四元数:</b>姿态解算要<b>不停地把小增量乘上去</b>,矩阵连乘会累积数值误差、慢慢不再正交(要反复重正交化);四元数只要每步归一化一次就行,便宜得多。<b>「好插值」也只有四元数有</b> —— 两个姿态之间的球面线性插值(slerp)是匀速转过去的,欧拉角插值会走出扭曲的怪路径。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 轨迹规划 ═══════════════
function TrajectoryDiagram() {
  return (
    <Shell icon={Icn.doc} title="轨迹规划 · 三次多项式原理"
      sub="看懂：为什么「两点连直线匀速走」在真机器上是不能用的">
      <Sec n={1} title="线性插值的病:速度突跳 = 瞬间无穷大加速度">
        <div className="gd-note">{Icn.info}<span>0°→90°、2 秒走完,线性插值的速度<b>恒为 45°/s</b> —— 听着很好,可它在 t=0 那一刻<b>从 0 突跳到 45</b>,t=2 又<b>突跳回 0</b>。速度的跳变意味着<b>加速度无穷大</b>,电机给不出、机械也受不了:表现为顿挫、抖动、长期伤传动件。</span></div>
      </Sec>
      <Sec n={2} title="办法:用四个边界条件定一条三次曲线">
        <div className="gd-formula">
          θ(t) = a₀ + a₁t + a₂t² + a₃t³
          {'　　'}边界:θ(0)=θ₀、θ(T)=θ_f、<span className="ft">θ̇(0)=0</span>、<span className="ft">θ̇(T)=0</span>
        </div>
        <div className="gd-formula">
          ⇒ a₀ = θ₀{'　'}a₁ = <b>0</b>{'　'}a₂ = <span className="fo">3(θ_f−θ₀)/T²</span>{'　'}a₃ = <span className="fo">−2(θ_f−θ₀)/T³</span>
        </div>
        <div className="gd-note">{Icn.info}<span>四个未知数、四个条件,<b>恰好定死</b> —— 这就是为什么是三次而不是二次或四次。两端速度为 0 那两条,正是「顺滑起步、顺滑停住」的数学写法。</span></div>
      </Sec>
      <Sec n={3} title="于是三条曲线各是什么形状">
        <div className="gd-lane">
          <div className="gd-card t"><h4>位置:S 曲线</h4><p>两端平、中间陡。</p></div>
          <div className="gd-card i"><h4>速度:钟形</h4><p><em>两端为 0</em>、中间最大 —— 没有跳变。</p></div>
          <div className="gd-card o"><h4>加速度:有限</h4><p>随时间<em>线性</em>变化,不再是无穷大。</p></div>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '起点 / 终点 / 时长' }, { cls: 'pd', text: '写 4 个边界条件' },
          { cls: 'pt', text: '解 4 个系数' }, { cls: 'pi', text: '位置 = S 曲线' },
          { cls: 'ph', text: '速度 = 钟形' }, { cls: 'pm', text: '加速度有限' },
        ]}
        why={<><b>为什么工业上还要再往上走一阶:</b>三次多项式的加速度虽然有限,但在 t=0 处<b>加加速度(jerk)仍然是跳变的</b> —— 高速高精场合(如芯片贴装)会看到残余振动。于是有五次多项式(再钉住两端加速度为 0)和 S 型速度规划。<b>每高一阶,就多买一层平滑,代价是同样距离要走更久。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 机械臂运动方程 ═══════════════
function DynEomDiagram() {
  return (
    <Shell icon={Icn.chip} title="机械臂运动方程原理"
      sub="看懂：机械臂不是几个独立电机 —— 三项里每一项都是耦合">
      <Sec n={1} title="一条方程,三项各管一件事">
        <div className="gd-formula">
          <span className="ft">M(q)·q̈</span> + <span className="fi">C(q,q̇)·q̇</span> + <span className="fo">G(q)</span> = τ
        </div>
        <div className="gd-lane">
          <div className="gd-card t"><h4>M(q) 质量矩阵</h4><p><em>随构型变</em>,而且<em>非对角 ≠ 0</em> —— 动关节 1 会甩到关节 2。这就是「耦合」。</p></div>
          <div className="gd-card i"><h4>C(q,q̇)q̇ 科氏 / 离心</h4><p><em>q̇ = 0 时全为 0</em> —— 只在<em>运动时</em>出现,静止时根本不存在。</p></div>
          <div className="gd-card o"><h4>G(q) 重力</h4><p><em>静止举着也要力矩</em> —— 它和速度、加速度都无关。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="两连杆平面臂的具体样子">
        <div className="gd-formula">
          M = [ α+2β cos q₂{'　'}δ+β cos q₂ ; δ+β cos q₂{'　'}δ ]
          {'　　'}<span className="fi">非对角项含 cos q₂ ⇒ 手臂弯着的程度决定耦合有多强</span>
        </div>
        <div className="gd-note">{Icn.info}<span>C 那一项是 [−β sin q₂ (2q̇₁q̇₂ + q̇₂²), β sin q₂ q̇₁²] —— 注意<b>每一项都带 q̇</b>,所以「静止保持」时它整个消失,只剩 G。这一条最好验:让机械臂停住不动,需要的力矩就只有重力项。</span></div>
      </Sec>
      <Sec n={3} title="三种运动状态,分别激活哪几项">
        <div className="gd-lane">
          <div className="gd-card t"><h4>静止保持</h4><p>只有 <em>G</em>。</p></div>
          <div className="gd-card i"><h4>匀速转动</h4><p><em>G + 科氏</em>(q̈=0,但 q̇≠0)。</p></div>
          <div className="gd-card o"><h4>加速起摆</h4><p><em>三项全有</em>。</p></div>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '构型 q、速度 q̇、加速度 q̈' }, { cls: 'pd', text: '算 M(q)' },
          { cls: 'pt', text: '算 C(q,q̇)q̇' }, { cls: 'pi', text: '算 G(q)' },
          { cls: 'ph', text: '合成 τ' }, { cls: 'pm', text: '这就是逆动力学' },
        ]}
        why={<><b>为什么「不是几个独立电机」这句话这么要紧:</b>如果各关节互不影响,每个关节配一个 PID 就完事了。可 M 的非对角项说的是 —— <b>你转关节 1,关节 2 会被甩</b>;关节 2 的 PID 只会把它当成「扰动」去压。转得越快,这个扰动越大,单关节 PID 就越跟不上。<b>这条方程是「计算力矩控制」存在的全部理由。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 递归牛顿-欧拉 RNEA ═══════════════
function RNEADiagram() {
  return (
    <Shell icon={Icn.ruler} title="递归牛顿-欧拉 RNEA 原理"
      sub="看懂：两次扫描 O(n) 算出力矩，而且根本不用把 M/C/G 组出来">
      <Sec n={1} title="外向扫描(基 → 梢):把运动往外传">
        <div className="gd-formula">
          ω<sub>i</sub> = ω<sub>i−1</sub> + q̇<sub>i</sub>{'　'}α<sub>i</sub> = α<sub>i−1</sub> + q̈<sub>i</sub>
          {'　　'}a = a<sub>prev</sub> + α×r − ω²r{'　'}<span className="fi">(逐连杆往外)</span>
        </div>
        <div className="gd-note">{Icn.info}<span><b>重力技巧</b>:给基座一个假加速度 <b>a₀ = −g</b>(向上 g)。于是每根连杆<b>自动感到自重</b>,重力项根本不用单列 —— 这是 RNEA 最漂亮的一招。</span></div>
      </Sec>
      <Sec n={2} title="内向扫描(梢 → 基):把受力往里传">
        <div className="gd-formula">
          牛顿 F<sub>i</sub> = m<sub>i</sub>a<sub>ci</sub>{'　'}欧拉 N<sub>i</sub> = I<sub>i</sub>α<sub>i</sub>
          {'　　'}f<sub>i</sub> = f<sub>i+1</sub> + F<sub>i</sub>{'　'}n<sub>i</sub> = N<sub>i</sub> + n<sub>i+1</sub> + r<sub>ci</sub>×F<sub>i</sub> + l<sub>i</sub>×f<sub>i+1</sub>
        </div>
        <div className="gd-formula">
          最后:<span className="fo">τ<sub>i</sub> = n<sub>i</sub> 投影到关节轴</span>
        </div>
        <div className="gd-note">{Icn.info}<span>方向是反的:<b>运动从基座往外传、力从末端往里传</b>。这正是物理上的因果 —— 你转基座,末端跟着动;末端受力,一路传回基座。</span></div>
      </Sec>
      <Sec n={3} title="它和上一课算的是同一个 τ">
        <div className="gd-formula">
          RNEA 的结果 <b>≡</b> M(q)q̈ + C(q,q̇)q̇ + G(q)
          {'　　'}<span className="fi">但复杂度 O(n)、内存 O(n),不显式组任何矩阵</span>
        </div>
        <div className="gd-note">{Icn.info}<span>显式组 M 是 O(n²)~O(n³) 的活;RNEA 两趟扫描就完事。所以<b>实时前馈力矩、计算力矩控制的主力都是它</b>。两条路算出同一个 τ —— <b>这也是验证实现对不对的标准做法:拿它俩对拍。</b></span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '给定 q, q̇, q̈' }, { cls: 'pd', text: '基座假加速度 a₀=−g' },
          { cls: 'pt', text: '外向:传速度/加速度' }, { cls: 'pi', text: '内向:传力/力矩' },
          { cls: 'ph', text: '投影到关节轴' }, { cls: 'pm', text: 'τ,O(n)' },
        ]}
        why={<><b>为什么控制回路里非它不可:</b>力矩控制常跑在 1kHz,每毫秒都要算一次 τ。O(n) 和 O(n³) 在 7 自由度上差的就是「跑得动」和「跑不动」。而那个基座假加速度的技巧还有个副产品:<b>想做失重仿真,把 a₀ 设成 0 就行</b> —— 不用改任何别的代码。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 正向动力学(仿真) ═══════════════
function FwdDynDiagram() {
  return (
    <Shell icon={Icn.chip} title="正向动力学 · 仿真原理"
      sub="看懂：物理引擎每一步在做的，就是这一个式子加一次积分">
      <Sec n={1} title="它是逆动力学的反问题">
        <div className="gd-lane">
          <div className="gd-card t"><h4>逆动力学</h4><p>给<em>运动</em>求<em>力矩</em> —— 这是<em>控制</em>要的。</p></div>
          <div className="gd-card o"><h4>正向动力学</h4><p>给<em>力矩</em>求<em>运动</em> —— 这是<em>仿真</em>要的。</p></div>
        </div>
        <div className="gd-formula">
          q̈ = <span className="ft">M(q)⁻¹</span> · ( τ − <span className="fi">C(q,q̇)q̇ − G(q)</span> )
        </div>
      </Sec>
      <Sec n={2} title="两个实现上的要点">
        <div className="gd-lane">
          <div className="gd-card t"><h4>偏置 b = Cq̇ + G</h4><p>不用分别算 C 和 G —— <em>令 q̈=0 跑一次 RNEA</em> 就得到它。</p></div>
          <div className="gd-card o"><h4>M 对称正定 ⇒ 一定可逆</h4><p>但<em>实际不真求逆</em>,用 <em>Cholesky 解方程</em> —— 更快也更稳。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「对称正定」不是顺口的形容词:它保证了 M 一定可逆(所以仿真不会在某个构型上崩),也保证 Cholesky 分解一定存在。<b>这是物理给的,不是数值上的运气。</b></span></div>
      </Sec>
      <Sec n={3} title="拿到 q̈ 之后:积分一步,这就是仿真器的循环">
        <div className="gd-formula">
          <span className="ft">半隐式欧拉</span>:{'　'}q̇ ← q̇ + q̈·dt{'　'}然后{'　'}q ← q + <b>q̇</b>·dt
        </div>
        <div className="gd-note">{Icn.info}<span>顺序是关键:<b>先更新速度、再用<u>新</u>速度更新位置</b>。显式欧拉(用旧速度)在振荡系统里会持续<b>注入能量、越算越发散</b>;半隐式欧拉几乎不花额外代价就把这个毛病去掉了 —— 所以几乎所有物理引擎都用它。研究对拍:τ=[10,2] → q̈=[−3.89, 9.16]。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '给定 τ' }, { cls: 'pd', text: 'b = Cq̇+G(一次 RNEA)' },
          { cls: 'pt', text: '组 M' }, { cls: 'pi', text: '解 q̈ = M⁻¹(τ−b)' },
          { cls: 'ph', text: '半隐式欧拉积一步' }, { cls: 'pm', text: '下一帧' },
        ]}
        why={<><b>round-trip 是最好的自检:</b>拿逆动力学(RNEA)算出的 τ 喂回正向动力学,应该<b>精确还原出原来的 q̈</b>。这一条对不上,说明两边的模型参数不一致 —— 而这正是仿真和真机「对不上」时最先要查的地方。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 计算力矩控制 ═══════════════
function ComputedTorqueDiagram() {
  return (
    <Shell icon={Icn.bulb} title="计算力矩控制原理"
      sub="看懂：用模型把非线性抵消掉，剩下一个干净的线性误差方程">
      <Sec n={1} title="先看纯 PID 为什么不够">
        <div className="gd-note">{Icn.info}<span>纯 PID 把重力、科氏、关节耦合<b>统统当成扰动</b>去压。低速时勉强能用;一快起来,这些「扰动」比控制量还大 —— 表现为<b>稳态下垂</b>(重力压不平)和<b>快速运动时跟不上</b>。</span></div>
      </Sec>
      <Sec n={2} title="办法:把 PD 修正过的加速度代进运动方程,当作「我想要的 q̈」">
        <div className="gd-formula">
          内环 v = <span className="ft">q̈_d + K_d·ė + K_p·e</span>
          {'　　'}外环 τ = <span className="fi">M(q)·v</span> + <span className="fo">C(q,q̇)q̇ + G(q)</span>
        </div>
        <div className="gd-note">{Icn.info}<span>代回被控对象 Mq̈ + Cq̇ + G = τ:<b>Cq̇+G 两边抵消、M 两边约掉</b> —— 这就是「反馈线性化」四个字的全部内容。</span></div>
      </Sec>
      <Sec n={3} title="剩下的东西干净得不像话">
        <div className="gd-formula">
          <b>ë + K_d·ė + K_p·e = 0</b>
          {'　　'}<span className="fi">每个关节变成独立的二阶系统,完全解耦</span>
        </div>
        <div className="gd-lane">
          <div className="gd-card t"><h4>可任意配极点</h4><p>K_p = ω<sub>n</sub>²、K_d = 2ζω<sub>n</sub>;临界阻尼取 <em>K_d = 2√K_p</em>。</p></div>
          <div className="gd-card i"><h4>只补重力</h4><p>τ = K_p e + K_d ė + <em>G</em>:消掉重力,<em>但科氏耦合还在</em>。</p></div>
          <div className="gd-card o"><h4>纯 PID</h4><p>啥都不消,<em>稳态下垂</em>。</p></div>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '期望轨迹 q_d' }, { cls: 'pd', text: '误差 e, ė' },
          { cls: 'pt', text: '内环 v = q̈_d+K_d ė+K_p e' }, { cls: 'pi', text: '外环 τ = Mv+Cq̇+G' },
          { cls: 'ph', text: '非线性被抵消' }, { cls: 'pm', text: 'ë+K_d ė+K_p e = 0' },
        ]}
        why={<><b>代价写在标题里:「用模型」。</b>抵消得干不干净,全看你的 M/C/G 有多准 —— 负载变了、关节有摩擦、连杆参数辨识有误差,抵消就不彻底,<b>残留的那部分又变回扰动</b>。所以真机上它常和自适应/鲁棒控制一起用。<b>模型越准,这一招越强;模型不准时,它甚至不如老实的 PID。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 接触动力学 ═══════════════
function ContactLCPDiagram() {
  return (
    <Shell icon={Icn.cross} title="接触动力学 · 摩擦锥原理"
      sub="看懂：物理引擎每一步怎么解接触力 —— 两个不等式定住一切">
      <Sec n={1} title="法向:不能拉、也不能穿">
        <div className="gd-formula">
          0 ≤ <span className="ft">f<sub>n</sub></span> ⊥ <span className="fo">φ(间隙)</span> ≥ 0
          {'　　'}<span className="fi">要么分离(φ{'>'}0 ⇒ f<sub>n</sub>=0),要么接触(φ=0 ⇒ f<sub>n</sub>≥0)</span>
        </div>
        <div className="gd-note">{Icn.info}<span>那个 ⊥ 读作「互补」:<b>两个量至少有一个是 0</b>。它同时表达了「接触面不能把物体拉住」和「物体不能陷进去」—— 一行写完两条物理。静止支撑时 f<sub>n</sub> = m·g。</span></div>
      </Sec>
      <Sec n={2} title="切向:库仑摩擦锥">
        <div className="gd-formula">
          |f<sub>t</sub>| ≤ <span className="ft">μ·f<sub>n</sub></span>
          {'　　'}粘(v<sub>t</sub>=0):f<sub>t</sub> 在<span className="fi">锥内</span>取反作用力{'　'}·{'　'}滑:f<sub>t</sub> = <span className="fo">μf<sub>n</sub></span> 在锥边界、反向阻滑
        </div>
        <div className="gd-note">{Icn.info}<span>「粘 / 滑」不是两套公式,是<b>同一个约束的 KKT 开关</b>:F ≤ μf<sub>n</sub> 就粘住(a=0),超过就滑。μ=0.5、f<sub>n</sub>=9.81 ⇒ 门槛 μf<sub>n</sub> = <b>4.905</b>;F=3 → <b>粘,a=0</b>;F=6 → <b>滑,a=(6−4.905)/1 = 1.095</b>。两个数都能手核。</span></div>
      </Sec>
      <Sec n={3} title="真引擎里:所有接触一起组成一个 LCP / QP">
        <div className="gd-note">{Icn.info}<span>MuJoCo / Bullet 每一步把场景里<b>所有接触点</b>的这些不等式凑成一个大问题一起解 —— 因为它们互相影响(一只脚受力变了,另一只脚的受力跟着变)。工程上常把圆锥<b>线性化成金字塔</b>,把问题从二阶锥规划降成线性互补,快很多、略微失真。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '检测到接触' }, { cls: 'pd', text: '法向互补:不拉不穿' },
          { cls: 'pt', text: '切向:|f_t| ≤ μf_n' }, { cls: 'pi', text: 'F vs μf_n 判粘/滑' },
          { cls: 'ph', text: '所有接触组成 LCP/QP' }, { cls: 'pm', text: '解出接触力 → 积分' },
        ]}
        why={<><b>为什么接触是仿真里最难的一块:</b>前面几课的动力学都是<b>光滑</b>的(可微、可积分),而接触是<b>非光滑、集值</b>的 —— 力在「粘」和「滑」之间会突变,间隙一到 0 支撑力就从 0 跳到 mg。<b>所有「机器人在仿真里走得好、上真机就摔」的故事,一大半出在这里。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 卡尔曼滤波 ═══════════════
function KalmanDiagram() {
  return (
    <Shell icon={Icn.star} title="卡尔曼滤波原理"
      sub="看懂：增益 K 就是一句「这次该信预测还是信观测」">
      <Sec n={1} title="两拍循环:方差涨一次、缩一次">
        <div className="gd-lane">
          <div className="gd-card t"><h4>Predict 预测</h4><p>x′ = x + u(里程计走了 u);<em>P′ = P + Q</em> —— <em>推得越久越不确定,方差涨</em>。</p></div>
          <div className="gd-card o"><h4>Update 校正</h4><p>来一个带噪观测 z(方差 R);x = x′ + K(z − x′);<em>P = (1−K)P′</em> —— <em>观测之后更确定,方差缩</em>。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="全部的机关就在增益 K 那一个分式里">
        <div className="gd-formula">
          K = <span className="ft">P′</span> / ( <span className="ft">P′</span> + <span className="fo">R</span> )
          {'　　'}观测准(R 小) → K 大 → <b>多信观测</b>{'　'}·{'　'}预测准(P′ 小) → K 小 → <b>多信预测</b>
        </div>
        <div className="gd-note">{Icn.info}<span>K 永远落在 0 和 1 之间,它就是<b>两份不确定度的相对大小</b>。所以卡尔曼滤波不是「一个算法」,而是<b>「按各自的方差加权平均」这句话的严格写法</b> —— 而且可以证明,在高斯线性假设下它是<b>最优</b>的。</span></div>
      </Sec>
      <Sec n={3} title="为什么融合出来的比两边单独都准">
        <div className="gd-note">{Icn.info}<span>因为 (1−K)P′ <b>一定小于 P′</b>,也一定小于 R。两个都不太准的信息,只要<b>噪声互相独立</b>,合起来就比任何一个单独的更准 —— 这是概率给的,不是调参调出来的。方差每步 predict 涨、update 缩,最后收敛到一个稳态值。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '上一时刻估计 x,P' }, { cls: 'pd', text: 'Predict:x+u,P+Q' },
          { cls: 'pt', text: '来了观测 z(方差 R)' }, { cls: 'pi', text: 'K = P′/(P′+R)' },
          { cls: 'ph', text: 'x = x′+K(z−x′)' }, { cls: 'pm', text: 'P = (1−K)P′' },
        ]}
        why={<><b>为什么它是状态估计/SLAM 的地基:</b>机器人身上<b>每个传感器都有噪声</b>,里程计会漂、GPS 会跳、IMU 有 bias。「哪个都不能全信」这件事,必须有一套可计算的说法 —— 卡尔曼给的就是这套说法。后面的 EKF/UKF/粒子滤波,改的都只是<b>「非线性怎么办」</b>,这两拍的骨架一直没变。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 扩展卡尔曼滤波 EKF ═══════════════
function EKFDiagram() {
  return (
    <Shell icon={Icn.star} title="扩展卡尔曼滤波 EKF 原理"
      sub="看懂：非线性怎么办 —— 在当前估计点，就地把它拉直">
      <Sec n={1} title="问题:观测模型不是线性的">
        <div className="gd-formula">
          地标在 (L=<span className="ft">10</span>, d=<span className="ft">5</span>),机器人在 x 轴上
          {'　　'}z = h(x) = √( (L−x)² + d² ){'　'}<span className="fi">← 对 x 非线性</span>
        </div>
        <div className="gd-note">{Icn.info}<span>卡尔曼那套公式的前提是<b>线性</b>。h 一非线性,「高斯经过它还是高斯」就不成立了,整套推导塌掉。</span></div>
      </Sec>
      <Sec n={2} title="EKF 的答案:在估计点求一次雅可比,就地线性化">
        <div className="gd-formula">
          H = ∂h/∂x = <span className="fo">−(L − x̂) / h</span>
          {'　　'}<span className="fi">在<b>当前估计点</b> x̂ 上求值</span>
        </div>
        <div className="gd-note">{Icn.info}<span>H 的符号和大小编码的是「<b>往哪个方向动一点,测出来的距离会怎么变</b>」。机器人在地标左边时,往右走距离变小 → H 为负。<b>这一条正是雅可比那一课在感知里的化身</b>。</span></div>
      </Sec>
      <Sec n={3} title="剩下的就是套卡尔曼,只是把「1」换成 H">
        <div className="gd-formula">
          创新 y = z − h(x̂){'　'}S = H²P + R{'　'}K = PH/S{'　'}x ← x̂ + Ky{'　'}P ← (1−KH)P
        </div>
        <div className="gd-note">{Icn.info}<span><b>EKF 会失效</b>,而且失效得不声不响:非线性太强、或者线性化点(x̂)本身就偏得远时,那条切线离真实曲线十万八千里,滤波器会<b>越来越自信地错下去</b>。那时就该换 UKF 或粒子滤波。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '非线性观测 h(x)' }, { cls: 'pd', text: '预测:x+u,P+Q' },
          { cls: 'pt', text: '算 h(x̂)' }, { cls: 'pi', text: '求雅可比 H(在 x̂ 点)' },
          { cls: 'ph', text: '套卡尔曼(用 H)' }, { cls: 'pm', text: '融合' },
        ]}
        why={<><b>EKF 统治了几十年,靠的是便宜:</b>它只比卡尔曼多一次求导,却把整个非线性世界纳了进来 —— 早期的 SLAM、GPS/INS 组合导航全是它。它的代价也很明确:<b>只在估计点附近对,而且它自己不知道自己错了</b>(协方差 P 不会因为线性化误差而变大)。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 无迹卡尔曼滤波 UKF ═══════════════
function UKFDiagram() {
  return (
    <Shell icon={Icn.star} title="无迹卡尔曼滤波 UKF 原理"
      sub="看懂：一句话 —— 近似分布，比近似函数容易">
      <Sec n={1} title="它和 EKF 面对的是同一道题,思路完全相反">
        <div className="gd-lane">
          <div className="gd-card t"><h4>EKF:近似函数</h4><p>把非线性 h <em>拉成一条切线</em>,再让高斯过这条线。</p></div>
          <div className="gd-card o"><h4>UKF:近似分布</h4><p>挑几个点<em>过真正的 h</em>(<em>不求导</em>),再拿结果<em>拟合回一个高斯</em>。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="三步:取点 → 过函数 → 重组">
        <div className="gd-lane">
          <div className="gd-card t"><h4>① 取 sigma 点</h4><p><em>2n+1</em> 个:X₀ = μ、X₁,₂ = μ ± √((n+λ)P) —— <em>围绕均值、按协方差铺开</em>。</p></div>
          <div className="gd-card i"><h4>② 过真非线性</h4><p>每个点各算一次 <em>h(Xᵢ)</em>。没有求导,也没有近似。</p></div>
          <div className="gd-card o"><h4>③ 重组</h4><p>用权重 W<sub>m</sub>/W<sub>c</sub> 拼出 ẑ、S、互协方差 P<sub>xz</sub>,然后 K = P<sub>xz</sub>/S。</p></div>
        </div>
      </Sec>
      <Sec n={3} title="什么时候和 EKF 分道扬镳">
        <div className="gd-lane">
          <div className="gd-card t"><h4>P 小</h4><p>sigma 点<em>靠得近</em>,那一小段曲线本来就近乎直 → <em>UKF ≈ EKF</em>。</p></div>
          <div className="gd-card o"><h4>P 大</h4><p>点<em>铺得开</em>,把曲率也<em>采</em>进来了 → 两者<em>分道</em>,UKF 对高斯<em>到三阶精确</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>所以先验越不确定,UKF 越值钱。代价是<b>每步要算 2n+1 次 h</b> —— 状态维度一高就贵;好处是<b>不用求雅可比</b>,模型难求导或干脆是个黑盒时,它是唯一能用的。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '均值 μ、协方差 P' }, { cls: 'pd', text: '取 2n+1 个 sigma 点' },
          { cls: 'pt', text: '每点过真 h' }, { cls: 'pi', text: '加权重组 ẑ,S,P_xz' },
          { cls: 'ph', text: 'K = P_xz/S' }, { cls: 'pm', text: '融合' },
        ]}
        why={<><b>「近似分布比近似函数容易」这句话值得记一辈子:</b>它不只属于滤波 —— 蒙特卡洛、粒子滤波、乃至神经网络里的采样近似,用的都是同一个思路。<b>与其去啃那个难缠的函数,不如让几个点替你走一遍。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 粒子滤波 ═══════════════
function ParticleFilterDiagram() {
  return (
    <Shell icon={Icn.star} title="粒子滤波 · 蒙特卡洛定位原理"
      sub="看懂：用一堆带权的点表示「我可能在哪」——能表多峰，卡尔曼不能">
      <Sec n={1} title="信念不再是一个高斯,而是一群粒子">
        <div className="gd-note">{Icn.info}<span>卡尔曼家族的信念永远是<b>一个</b>高斯(一个峰)。可机器人在长走廊里,「我可能在 A 处,也可能在完全对称的 B 处」是<b>两个峰</b> —— 高斯表达不了。粒子滤波用<b>一堆带权重的点</b>表示分布,想有几个峰就有几个峰。</span></div>
      </Sec>
      <Sec n={2} title="四步循环">
        <div className="gd-lane">
          <div className="gd-card t"><h4>① 预测</h4><p>每个粒子<em>按运动模型 + 噪声</em>各自动一下 —— 粒子云散开。</p></div>
          <div className="gd-card i"><h4>② 加权</h4><p>w<sub>i</sub> ∝ 观测似然 <em>exp(−(z−x<sub>i</sub>)²/2σ²)</em> —— 越像观测的粒子权重越高。</p></div>
          <div className="gd-card o"><h4>③ 重采样</h4><p><em>高权复制、低权淘汰</em>,权重重置均匀 —— 粒子聚拢到可能的地方。</p></div>
          <div className="gd-card t"><h4>④ 估计</h4><p><em>加权均值</em>。</p></div>
        </div>
      </Sec>
      <Sec n={3} title="重采样是必须的:不做就会「权重退化」">
        <div className="gd-formula">
          有效样本数 N<sub>eff</sub> = <span className="ft">1 / Σw²</span>
          {'　　'}N<sub>eff</sub> 掉下来 = <b>权重集中到少数几个粒子</b> ⇒ 该重采样了
        </div>
        <div className="gd-note">{Icn.info}<span>不重采样的话,几步之后就只有一两个粒子还有权重,其余全在低概率区<b>白白算着</b> —— 名义上 1000 个粒子,实际有效的只剩 2 个。N<sub>eff</sub> 就是用来量这件事的<b>体温计</b>。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '一群粒子 = 信念' }, { cls: 'pd', text: '按运动散开' },
          { cls: 'pt', text: '按观测似然加权' }, { cls: 'pi', text: '看 N_eff' },
          { cls: 'ph', text: '重采样:高权复制' }, { cls: 'pm', text: '加权均值 = 估计' },
        ]}
        why={<><b>它是 EKF 失效时的答案,代价是粒子数:</b>状态维度一高,要铺满空间所需的粒子数<b>指数增长</b>(维度灾难)—— 所以粒子滤波在 2D/3D 定位上很好用,到了高维状态就跑不动了。<b>「用采样换掉解析」这笔交易,在低维时非常划算,高维时非常不划算。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 互补滤波 ═══════════════
function ComplementaryDiagram() {
  return (
    <Shell icon={Icn.ruler} title="互补滤波 · IMU 姿态原理"
      sub="看懂：两个传感器的毛病正好互补 —— 一个短期准，一个长期准">
      <Sec n={1} title="两个都不能单独用">
        <div className="gd-lane">
          <div className="gd-card t"><h4>陀螺仪:短期准、长期漂</h4><p>积分角速度:30 + 20×0.01 = <em>30.2°</em>。很准 —— 但 <em>bias 会逐秒累积</em>,越走越偏,且<em>永不回头</em>。</p></div>
          <div className="gd-card o"><h4>加速度计:不漂、但抖</h4><p>由重力方向算出<em>绝对倾角</em> = <em>32°</em>。有绝对参考、<em>不会漂</em> —— 但噪声大,机器一动就乱跳。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="融合只有一行">
        <div className="gd-formula">
          θ = <span className="ft">α·(θ_prev + ω·dt)</span> + <span className="fo">(1−α)·θ_acc</span>
          {'　　'}<span className="fi">= 高通陀螺(信它短期) + 低通加速度(信它长期)</span>
        </div>
        <div className="gd-note">{Icn.info}<span>「互补」二字是字面意思:<b>两个滤波器的频响加起来正好是 1</b> —— 高频段听陀螺、低频段听加速度,不重不漏。</span></div>
      </Sec>
      <Sec n={3} title="α 是一把明码标价的旋钮">
        <div className="gd-lane">
          <div className="gd-card t"><h4>α 大(≈0.98)</h4><p><em>平滑</em>,但纠漂<em>慢</em>。</p></div>
          <div className="gd-card o"><h4>α 小</h4><p>跟加速度紧、<em>能压漂</em>,但<em>抖</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>它其实是<b>定增益的简化卡尔曼</b>:卡尔曼的 K 每步按方差算,互补滤波把它<b>固定成一个常数 (1−α)</b>。省掉了协方差的全部计算,所以便宜到能跑在最小的单片机上 —— 无人机飞控最早就是这么做姿态的。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '陀螺 ω' }, { cls: 'pd', text: '积分 → 短期准' },
          { cls: 'pt', text: '加速度 → 绝对倾角' }, { cls: 'pi', text: 'α 加权融合' },
          { cls: 'ph', text: '高通陀螺 + 低通加速度' }, { cls: 'pm', text: '不漂也不抖' },
        ]}
        why={<><b>为什么这题面试爱问:</b>它用最少的数学讲清了传感器融合的<b>核心直觉</b> —— <b>不同传感器的误差特性不同,融合的价值就在这个「不同」上</b>。两个都短期准长期漂的传感器,融了也没用。理解了这一条,再看卡尔曼的 K 就只是「把这个常数变成按方差自动算的」。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 模型预测控制 MPC ═══════════════
function MPCDiagram() {
  return (
    <Shell icon={Icn.bulb} title="模型预测控制 MPC 原理"
      sub="看懂：反应式控制器不会「提前刹车」，而 MPC 会">
      <Sec n={1} title="三个词:预测、优化、只走第一步">
        <div className="gd-lane">
          <div className="gd-card t"><h4>预测</h4><p>用<em>系统模型</em>把未来一段(预测时域)<em>推演出来</em>。</p></div>
          <div className="gd-card i"><h4>优化</h4><p>解出<em>一整条控制序列</em>:既要到目标、又要满足约束、还要省劲。</p></div>
          <div className="gd-card o"><h4>只执行第一步</h4><p>下一拍拿<em>新状态重新预测优化</em> —— 滚动时域 receding horizon。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「算了一整条却只走第一步」看着浪费,其实是<b>抗扰动的关键</b>:世界总会和模型不一样,所以每一步都<b>拿真实状态重来一遍</b>,而不是照着老计划走到底。这和 Agent 的「重规划」是同一个道理。</span></div>
      </Sec>
      <Sec n={2} title="一个具体对比:停在 x=10,而那也是一堵墙">
        <div className="gd-lane">
          <div className="gd-card o"><h4>MPC</h4><p>每步算<em>刹车距离</em>(照现在的速度刹停要多远):还够远就加速,预测「再不刹就冲过去了」就<em>提前刹车</em> → <em>稳稳停在 10</em>。</p></div>
          <div className="gd-card t"><h4>反应式(纯比例)</h4><p>只看当前误差,<em>没有预测</em>,到跟前还在冲 → <em>越过目标冲到 ~16</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「刹车距离」就是这里的预测。反应式控制器不是参数没调好 —— 它<b>结构上就不知道未来</b>,再怎么调也没法在还没到误差之前就开始减速。</span></div>
      </Sec>
      <Sec n={3} title="MPC 最值钱的地方:能显式写约束">
        <div className="gd-note">{Icn.info}<span>不越界、不超速、不超力矩 —— 这些在 PID 里只能靠<b>限幅硬砍</b>(砍完就不是原来那个控制律了),在 MPC 里是<b>优化问题的约束条件</b>,求解器会在满足约束的前提下找最优。这是它在自动驾驶、四足步态、化工过程里当主力的根本原因。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '当前状态' }, { cls: 'pd', text: '用模型预测未来一段' },
          { cls: 'pt', text: '带约束优化整条序列' }, { cls: 'pi', text: '只执行第一步' },
          { cls: 'ph', text: '下一拍拿新状态' }, { cls: 'pm', text: '重新预测优化' },
        ]}
        why={<><b>代价也很清楚:每一步都要在线解一个优化问题。</b>所以 MPC 的工程史基本就是「怎么把这个问题解得够快」的历史 —— 从化工(秒级,随便解)到自动驾驶(10ms)再到四足(1ms),靠的是把问题化成 QP、用热启动、甚至提前把解算好存成表(显式 MPC)。<b>它不是更聪明的 PID,它是拿算力换预见性。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 阻抗/力控 ═══════════════
function ImpedanceDiagram() {
  return (
    <Shell icon={Icn.bulb} title="阻抗 / 力控原理"
      sub="看懂：位置控制为什么会「砸」，柔顺控制怎么把力变成你能设的数">
      <Sec n={1} title="纯位置控制的病:它只认位置误差">
        <div className="gd-note">{Icn.info}<span>你命令末端去 x,它就<b>死命把位置误差压到 0</b>。一旦撞上墙或工件,那点消不掉的位置误差会让它输出<b>越来越大的力</b> —— 砸坏工件、伤人、打滑。它不是失控,它是<b>忠实地在执行一个错误的目标</b>。</span></div>
      </Sec>
      <Sec n={2} title="阻抗控制:把末端做成一个虚拟的弹簧 + 阻尼">
        <div className="gd-formula">
          F = <span className="ft">K·(x_目标 − x)</span> − <span className="fo">D·ẋ</span>
          {'　　'}⇒ 接触力 ≈ <b>K × 侵入深度</b>{'　'}<span className="fi">而 K 是你自己设的</span>
        </div>
        <div className="gd-note">{Icn.info}<span>这一句是全部:<b>力不再是「压误差」的副产品,而是一个你能算出来、能设定的量</b>。它「想」去目标,但遇到阻挡就<b>柔顺让步</b>。</span></div>
      </Sec>
      <Sec n={3} title="同一个目标,K 一换,力差 6.6 倍">
        <div className="gd-lane">
          <div className="gd-card t"><h4>刚性位置控制 K=200</h4><p>命令去 x=8,墙在 x=5 → 稳态<em>硬顶出 480 N</em>(砸)。</p></div>
          <div className="gd-card o"><h4>阻抗控制 K=25</h4><p>同样命令 → 动态逼近、轻柔接触,力 settle 到 <em>~73 N</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>K 小 = 软:轻轻贴着走、接触力小而可控;K 大 = 硬:趋近于位置控制。<b>所以「位置控制」其实是阻抗控制在 K→∞ 时的极端情形</b> —— 它们不是两套东西。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '命令末端去 x_目标' }, { cls: 'pd', text: '渲染虚拟弹簧 K + 阻尼 D' },
          { cls: 'pt', text: '未接触:像位置控制一样靠近' }, { cls: 'pi', text: '接触:柔顺让步' },
          { cls: 'ph', text: '力 ≈ K × 侵入深度' }, { cls: 'pm', text: '力可设、可控' },
        ]}
        why={<><b>为什么它是「会用力」的地基:</b>装配、打磨、拧螺丝、和人协作 —— 这些任务的成败标准根本不是「到没到位置」,而是「力对不对」。<b>把位置当目标,力就是失控的副产品;把阻抗当目标,力才成为一个可以设计的量。</b>再往上就是导纳控制、力/位混合控制,分的都是同一件事:哪个方向管位置、哪个方向管力。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · RRT 采样式规划 ═══════════════
function RRTDiagram() {
  return (
    <Shell icon={Icn.pin} title="RRT 运动规划原理"
      sub="看懂：不建地图、不算格子 —— 靠随机采样把一棵树长到终点">
      <Sec n={1} title="四步一个循环,循环到够着终点为止">
        <div className="gd-lane">
          <div className="gd-card t"><h4>① 随机采一个点</h4><p>偶尔<em>直接采终点</em>(goal bias)—— 一点点偏心就能显著加速收敛。</p></div>
          <div className="gd-card i"><h4>② 找树上最近的节点</h4><p>「最近」是这棵树往采样点方向<em>唯一合理的出发点</em>。</p></div>
          <div className="gd-card o"><h4>③ 朝它迈一步</h4><p>只迈固定的 step,不是直接连过去。</p></div>
          <div className="gd-card t"><h4>④ 撞了就丢</h4><p>撞障碍/出界 → 丢弃;否则<em>加进树</em>,连一条边。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="为什么随机采样反而「快速探索」">
        <div className="gd-note">{Icn.info}<span>关键在第②步:采样点落在空旷处的概率大,而空旷处附近的树节点少 —— 于是<b>树总是被拽向还没探索过的方向</b>。这个偏好不是设计出来的,是「最近节点」这条规则的<b>副产品</b>,也正是 RRT 名字里「快速探索」的来历。</span></div>
      </Sec>
      <Sec n={3} title="它给的是「一条能走的路」,不是「最好的路」">
        <div className="gd-note">{Icn.info}<span>RRT <b>概率完备</b>:只要有解,采样够多总能找到;但它<b>不最优</b> —— 找到的路往往绕、抖。要最优得上 RRT*(下一课),要快得上 RRT-Connect,要多次查询同一环境得上 PRM。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '起点建一棵树' }, { cls: 'pd', text: '随机采样(带 goal bias)' },
          { cls: 'pt', text: '找最近节点' }, { cls: 'pi', text: '迈一步' },
          { cls: 'ph', text: '撞了丢 / 没撞加进树' }, { cls: 'pm', text: '够到终点 → 回溯出路径' },
        ]}
        why={<><b>为什么机械臂规划几乎都用采样法:</b>7 自由度机械臂的构型空间是 7 维,要像 A* 那样<b>把空间切成格子根本存不下</b>(维度灾难)。采样法不需要显式表示空间,<b>只需要一个「这个构型撞不撞」的判定函数</b> —— 这一条让它在高维里活了下来。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · RRT* ═══════════════
function RRTStarDiagram() {
  return (
    <Shell icon={Icn.star} title="RRT* 渐近最优原理"
      sub="看懂：只加了「选父」和「重连」两步，树就会越采越优">
      <Sec n={1} title="RRT 的毛病:接最近 ≠ 代价最小">
        <div className="gd-note">{Icn.info}<span>RRT 把新点接到<b>几何上最近</b>的树节点。可那个节点自己可能是绕远路来的 —— <b>接得近,不代表从起点算总代价小</b>。这一条不改,路就永远是歪的。</span></div>
      </Sec>
      <Sec n={2} title="改动一:选父 —— 在邻域里挑代价最小的">
        <div className="gd-formula">
          在半径 r 邻域内,选让 <span className="ft">cost[邻居] + dist</span> <b>最小</b>的那个当父
          {'　　'}<span className="fi">(不是几何最近的)</span>
        </div>
        <div className="gd-note">{Icn.info}<span>本例:同一个新点,RRT 接出来代价 <b>9</b>,RRT* 选父之后是 <b>6</b> —— 一步就差三成。</span></div>
      </Sec>
      <Sec n={3} title="改动二:重连 —— 回头看看邻居们能不能沾光">
        <div className="gd-formula">
          若 cost[x_new] + dist {'<'} cost[邻居]{'　'}⇒{'　'}把邻居<b>改接到 x_new</b>
        </div>
        <div className="gd-note">{Icn.info}<span>本例邻居 B 被重连,代价从 <b>8 降到 7</b>。这一步是 RRT* 的灵魂:<b>树不只往外长,还会回头把自己修得更优</b>。邻域半径按 (log n / n)^(1/d) 收缩,于是采样数 → ∞ 时<b>渐近收敛到最优路</b>。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '采样得 x_new' }, { cls: 'pd', text: '取半径 r 邻域' },
          { cls: 'pt', text: '选父:代价最小' }, { cls: 'pi', text: '加进树' },
          { cls: 'ph', text: '重连:邻居改接更省' }, { cls: 'pm', text: '采样越多越接近最优' },
        ]}
        why={<><b>代价是时间:</b>每个新点都要查邻域、还要重连一圈,单步比 RRT 贵不少。所以工程上常这么用 —— <b>先用 RRT-Connect 秒出一条能走的路(保底),再让 RRT\* 在剩余时间里慢慢优化</b>。这也是「随时可用算法(anytime)」的典型形态:任何时候掐断都有一个答案,给的时间越多答案越好。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · RRT-Connect ═══════════════
function RRTConnectDiagram() {
  return (
    <Shell icon={Icn.pin} title="RRT-Connect 双向扩展原理"
      sub="看懂：为什么 MoveIt / OMPL 把它当机械臂规划的默认算法">
      <Sec n={1} title="两棵树,一棵从起点长、一棵从终点长">
        <div className="gd-note">{Icn.info}<span>单树 RRT 要从起点一路摸到终点。<b>两棵树相向而长,期望搜索量大致减半</b> —— 而且终点那棵树天然把「终点附近能不能进得去」这件事先探明白了。</span></div>
      </Sec>
      <Sec n={2} title="关键在 CONNECT:不是迈一步,是一路走到底">
        <div className="gd-lane">
          <div className="gd-card t"><h4>EXTEND</h4><p>当前树朝采样点<em>迈一步</em>得 q_new(撞了就丢)。</p></div>
          <div className="gd-card o"><h4>CONNECT(贪心)</h4><p>让<em>另一棵树</em>朝 q_new <em>连续迈步</em> —— 直到<em>够到</em>(两树相遇)或<em>撞障碍停下</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「一路走」这一下是提速的关键:空旷区域里一次 CONNECT 能跨过一大段,而 RRT 得一步一步挪。<b>贪心在空旷处占尽便宜,在窄通道处自然停下</b> —— 代价可控。</span></div>
      </Sec>
      <Sec n={3} title="相遇即拼路,没相遇就交换两棵树">
        <div className="gd-formula">
          两树相遇 → 从相遇点<span className="ft">分别沿父指针回溯</span> → 拼成完整路径
          {'　　'}没相遇 → <span className="fo">交换两树</span>,下一轮换另一棵先扩展
        </div>
        <div className="gd-note">{Icn.info}<span>「交换」让两棵树<b>轮流当主动方</b>,避免一棵长疯、另一棵原地不动。实现上就是一次 swap,便宜得不像话,却是平衡两侧探索的全部机制。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '起点树 + 终点树' }, { cls: 'pd', text: '采样' },
          { cls: 'pt', text: 'EXTEND 一棵迈一步' }, { cls: 'pi', text: 'CONNECT 另一棵贪心逼近' },
          { cls: 'ph', text: '相遇 → 拼路径' }, { cls: 'pm', text: '否则交换再来' },
        ]}
        why={<><b>它牺牲了什么:</b>贪心 + 双向让它<b>快</b>,但路径质量比 RRT 还糙(经常是折线加大绕)。所以实际流水线是「<b>RRT-Connect 出路 → 路径平滑/短切 → 再配速度曲线</b>」三段式 —— <b>规划器负责「找得到」,后处理负责「走得好」</b>,分工明确。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · PRM 概率路图 ═══════════════
function PRMDiagram() {
  return (
    <Shell icon={Icn.chip} title="PRM 概率路图原理"
      sub="看懂：建一次图，答多次查询 —— 和 RRT 分工不同的那一半">
      <Sec n={1} title="两个阶段,分得很清楚">
        <div className="gd-lane">
          <div className="gd-card t"><h4>① 建图 learning</h4><p>自由空间随机采 N 个构型当节点,每个连 <em>k 近邻</em>;<em>边要碰撞检测,穿障的丢掉</em>。</p></div>
          <div className="gd-card o"><h4>② 查询 query</h4><p>把起点/终点<em>接入路图</em>,再用 <em>Dijkstra / A*</em> 在图上搜最短路。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>碰撞检测是这里<b>最贵的一步</b>,而它全发生在建图阶段 —— 这就是 PRM 的商业模式:<b>把贵的活一次性做完,之后每次查询都便宜</b>。</span></div>
      </Sec>
      <Sec n={2} title="和 RRT 的分工">
        <div className="gd-lane">
          <div className="gd-card t"><h4>RRT:单查询</h4><p>朝<em>一个</em>目标长树。环境一变就得重来。</p></div>
          <div className="gd-card o"><h4>PRM:多查询</h4><p>路图建好后,<em>反复回答不同起终点</em> —— 适合<em>固定环境、多次规划</em>(产线上的机械臂)。</p></div>
        </div>
      </Sec>
      <Sec n={3} title="死穴:窄通道 —— 采样太稀,路图会断开">
        <div className="gd-note">{Icn.info}<span>窄通道在自由空间里<b>体积极小</b>,随机采样很难采到里面 → 通道两侧的节点连不上 → <b>路图断开、明明有路却找不到</b>。这不是 bug,是采样法共同的软肋。对策是各种有偏采样(桥采样、障碍附近采样),本质都是<b>把采样力气花在窄的地方</b>。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '随机撒 N 个自由构型' }, { cls: 'pd', text: '连 k 近邻' },
          { cls: 'pt', text: '边做碰撞检测,穿障丢弃' }, { cls: 'pi', text: '得到路图' },
          { cls: 'ph', text: '起终点接入' }, { cls: 'pm', text: '图上搜最短路' },
        ]}
        why={<><b>PRM 把运动规划变回了图搜索</b> —— 一旦路图建好,后面用的就是 408 里学的 Dijkstra/A*。这是个很值钱的观察:<b>采样法真正解决的,是「怎么把连续空间变成一张图」</b>;至于在图上怎么走,几十年前就有答案了。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · D* Lite 增量重规划 ═══════════════
function DStarLiteDiagram() {
  return (
    <Shell icon={Icn.ruler} title="D* Lite 增量重规划原理"
      sub="看懂：发现新障碍后，只修那一小块，而不是从头重搜">
      <Sec n={1} title="两个量:g 是「已知的」,rhs 是「一步前瞻的」">
        <div className="gd-formula">
          <span className="ft">g(s)</span> = 已知的从起点到 s 的最优代价
          {'　　'}<span className="fo">rhs(s)</span> = min<sub>邻居</sub>( g(邻居) + 边权 )
        </div>
        <div className="gd-formula">
          <b>局部一致</b> ⇔ g(s) = rhs(s){'　　'}<span className="fi">不一致的格子,才需要重算</span>
        </div>
      </Sec>
      <Sec n={2} title="障碍出现:只有受影响的格子变得不一致">
        <div className="gd-note">{Icn.info}<span>边权一变,<b>只有那几个格子的 g 和 rhs 对不上</b> → 进优先队列 → 只重算<b>这些格子及其下游</b>,其余的 g 值<b>原样复用</b>。这就是「增量」二字的全部内容。</span></div>
      </Sec>
      <Sec n={3} title="数字最有说服力:7×5 栅格,同一次改动">
        <div className="gd-lane">
          <div className="gd-card t"><h4>初次规划</h4><p>直穿第 2 行,代价 <em>6</em>,展开 <em>35 格</em>。</p></div>
          <div className="gd-card o"><h4>(3,2) 变障碍 → 增量修复</h4><p>只有 4 格受影响,<em>只展开 6 格</em>,新路绕第 3 行、代价 <em>8</em>。</p></div>
          <div className="gd-card i"><h4>从头重搜</h4><p>要展开 <em>34 格</em> —— 差 <em>5 倍以上</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span><b>地图越大、改动越局部,这个优势越夸张。</b>反过来说,如果整张地图都变了,增量修复并不比重搜便宜 —— 它赌的是「变化是局部的」这件事。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '初次规划:算全表 g' }, { cls: 'pd', text: '边走边发现新障碍' },
          { cls: 'pt', text: '受影响格 g≠rhs' }, { cls: 'pi', text: '进优先队列' },
          { cls: 'ph', text: '只重算不一致格及下游' }, { cls: 'pm', text: '其余 g 值复用' },
        ]}
        why={<><b>为什么机器人非要增量不可:</b>它是<b>边走边看</b>的 —— 传感器每一帧都可能带来新障碍。如果每帧都从头 A*,大地图上根本跑不到实时。D* Lite 让「重规划」的代价<b>正比于改动的大小,而不是地图的大小</b>,这才配得上「在线」两个字。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 人工势场法 ═══════════════
function PotentialFieldDiagram() {
  return (
    <Shell icon={Icn.bulb} title="人工势场法原理"
      sub="看懂：快到几乎不要钱，但有一个躲不掉的死穴">
      <Sec n={1} title="两股力,顺着合力「下山」">
        <div className="gd-formula">
          引力 F_att = <span className="ft">k_att·(q_goal − q)</span>{'　'}<span className="fi">指向目标、正比距离</span>
        </div>
        <div className="gd-formula">
          斥力 F_rep = <span className="fo">k_rep·(1/ρ − 1/ρ₀)·(1/ρ²)·n̂</span>{'　'}<span className="fi">仅 ρ ≤ ρ₀ 时存在,越近越大</span>
        </div>
        <div className="gd-note">{Icn.info}<span>本例 k_att=1、k_rep=30、影响半径 ρ₀=3。机器人沿合力方向走一步 —— 相当于在一张<b>势能面上做梯度下降</b>。没有搜索、没有树、没有图,<b>每步只是几次算术</b>,所以快得离谱。</span></div>
      </Sec>
      <Sec n={2} title="死穴:局部极小">
        <div className="gd-lane">
          <div className="gd-card o"><h4>障碍偏侧</h4><p>斥力有<em>横向分量</em> → 合力把机器人<em>推向侧面绕过</em> → 到达。</p></div>
          <div className="gd-card t"><h4>障碍正中</h4><p>引力和斥力<em>共线相反</em> → 某处<em>抵消,合力 ≈ 0</em> → <em>卡住,永远到不了</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>这不是参数没调好:<b>只要障碍恰好在机器人和目标的连线上,就一定存在一个合力为零的点</b>。调大 k_att 只是把那个点挪个位置。<b>结构性的问题,调参救不了。</b></span></div>
      </Sec>
      <Sec n={3} title="所以它的位置在哪">
        <div className="gd-note">{Icn.info}<span>势场法适合<b>局部避障</b>(反应式、跟在全局规划器后面兜底),不适合当全局规划器。典型配法:<b>RRT/A* 出全局路径(无局部极小),势场法负责实时躲开突然出现的东西</b>。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '目标产生引力' }, { cls: 'pd', text: '障碍产生斥力(限半径内)' },
          { cls: 'pt', text: '合力 = 引力 + 斥力' }, { cls: 'pi', text: '顺合力走一步' },
          { cls: 'ph', text: '偏侧 → 绕过' }, { cls: 'pm', text: '正中 → 卡局部极小' },
        ]}
        why={<><b>斥力那个式子和阻抗控制是亲戚:</b>「越靠近越推得狠」,本质就是一个<b>虚拟弹簧</b>。区别在于阻抗控制的弹簧作用在<b>真实的接触力</b>上,势场法的弹簧作用在<b>规划出来的速度</b>上 —— 同一个直觉,一个在力层、一个在运动层。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · CHOMP 轨迹优化 ═══════════════
function CHOMPDiagram() {
  return (
    <Shell icon={Icn.doc} title="CHOMP 轨迹优化原理"
      sub="看懂：把「整条轨迹」当成一个变量去优化，而不是一点点搜出来">
      <Sec n={1} title="换了个问法:不是「怎么搜」,是「怎么改」">
        <div className="gd-formula">
          轨迹 ξ = [q₁ … q_n] <b>整条当变量</b>
          {'　　'}代价 U(ξ) = <span className="ft">平滑项</span> + <span className="fo">避障项</span>
          {'　　'}梯度下降 ξ ← ξ − α∇U
        </div>
        <div className="gd-note">{Icn.info}<span>RRT/A* 是<b>搜索</b>:从无到有找一条。CHOMP 是<b>优化</b>:先给一条(通常就是直线),再<b>整条一起改</b>直到不撞且够平滑。起点不同,擅长的场合也不同。</span></div>
      </Sec>
      <Sec n={2} title="两个梯度,各拉一边">
        <div className="gd-lane">
          <div className="gd-card o"><h4>避障梯度</h4><p>影响半径 d₀ 内的路点被<em>往外推</em>,∝ (d₀ − dist) × 远离方向。</p></div>
          <div className="gd-card t"><h4>平滑梯度</h4><p>每个点被<em>拉向邻居中点</em>(Laplacian:2q_i − q_{'{'}i−1{'}'} − q_{'{'}i+1{'}'})—— <em>直线上为 0,弯了才有</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>本例 5 个路点、直线 S(0,0)→G(4,0) 从障碍 (2,0.6) 旁擦过:中点 q₂ 离障碍 0.6 {'<'} d₀=1,被往下推。<b>避障权重大</b> → 推到 (2, −0.8)(绕得开);<b>平滑权重大</b> → 只推到 (2, −0.2)(更直,但擦着障碍走)。<b>这两个权重就是这套方法的全部调参空间。</b></span></div>
      </Sec>
      <Sec n={3} title="死穴和势场法是同一个">
        <div className="gd-note">{Icn.info}<span>梯度下降会掉进<b>局部极小</b> —— 初始那条直线要是从障碍「错误的一侧」穿过去,它只会被推得贴着障碍,而不会翻到另一侧。所以 CHOMP 很吃<b>初始轨迹</b>,工程上常用采样法先给一条粗路,再交给它打磨。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '给一条初始轨迹(直线)' }, { cls: 'pd', text: '算避障梯度' },
          { cls: 'pt', text: '算平滑梯度' }, { cls: 'pi', text: '按权重合成' },
          { cls: 'ph', text: '整条下降一步' }, { cls: 'pm', text: '迭代到平滑且不撞' },
        ]}
        why={<><b>「搜索 → 优化」这一步跨越很值钱:</b>搜索法给的路能走但难看,优化法能把它变得平滑、省力、贴合动力学约束。现代规划流水线基本都是两段:<b>采样法保证找得到(全局性),优化法保证走得好(局部质量)</b> —— 各自补对方的短板。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · Dubins 曲线 ═══════════════
function DubinsDiagram() {
  return (
    <Shell icon={Icn.ruler} title="Dubins 曲线原理"
      sub="看懂：车不能横着走 —— 于是两点之间最短路不再是直线">
      <Sec n={1} title="两条约束,机械臂没有、车有">
        <div className="gd-lane">
          <div className="gd-card t"><h4>非完整约束</h4><p>车/差速底盘<em>不能横着走</em>(nonholonomic)—— 想往旁边挪,只能拐过去。</p></div>
          <div className="gd-card o"><h4>最小转弯半径 R</h4><p>方向盘打死也只能拐这么急。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="Dubins 1957 年证明的结论,漂亮得不像话">
        <div className="gd-formula">
          只前进的车,任意两个<b>位姿</b>之间的最短路
          {'　'}一定是<span className="ft">三段圆弧/直线</span>,且只可能是 <b>6 种词</b>之一
        </div>
        <div className="gd-lane">
          <div className="gd-card t"><h4>CSC(转-直-转)</h4><p><em>LSL / RSR / LSR / RSL</em></p></div>
          <div className="gd-card i"><h4>CCC(转-转-转)</h4><p><em>RLR / LRL</em> —— 近距离才用得上</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>于是「求最短路」被降维成一道<b>选择题</b>:六种词各用闭式几何算一遍长度,<b>取最短的那个</b>。没有搜索、没有迭代。</span></div>
      </Sec>
      <Sec n={3} title="同一个终点位置,朝向一变,最优词就换了">
        <div className="gd-lane">
          <div className="gd-card t"><h4>终点朝上(90°)</h4><p>最优 <em>LSL</em>:左转 0.464 + 直 2.236 + 左转 1.107 = <em>3.807</em></p></div>
          <div className="gd-card o"><h4>终点朝下(−90°)</h4><p>最优 <em>LSR</em>:1.571 + 1 + 3.142 = <em>5.712</em></p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>位置一模一样,<b>只因为要停成不同的朝向,路程差了一半</b>。这就是「位姿」两个字的分量 —— 对车来说,<b>朝向和位置一样是硬目标</b>。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '起点位姿 / 终点位姿 / R' }, { cls: 'pd', text: '画两端的转向圆' },
          { cls: 'pt', text: '四种 CSC 各算长度' }, { cls: 'pi', text: '(近距离再算两种 CCC)' },
          { cls: 'ph', text: '取最短的词' }, { cls: 'pm', text: '三段:转-直-转' },
        ]}
        why={<><b>为什么 RRT 用在车上要换成 Dubins 距离:</b>RRT 里的「最近节点」和「迈一步」,默认用的是欧氏距离和直线。<b>对车来说这两条都是错的</b> —— 正后方 1 米的点,直线距离最近,实际却要倒好几把才到。把度量换成 Dubins 长度,RRT 才长得出车真能走的树。<b>规划器的骨架不变,变的是「距离」的定义。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 梯形速度曲线 ═══════════════
function TrapezoidDiagram() {
  return (
    <Shell icon={Icn.ruler} title="梯形速度曲线原理"
      sub="看懂：路径说「走哪」，轨迹说「什么速度走」——这是两件事">
      <Sec n={1} title="先把这两个词分开">
        <div className="gd-lane">
          <div className="gd-card t"><h4>路径 path</h4><p>只有<em>几何</em>:经过哪些点。RRT/A* 给的是它。</p></div>
          <div className="gd-card o"><h4>轨迹 trajectory</h4><p>路径 + <em>时间</em>:每一刻在哪、速度多少。电机要的是它。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="时间最优的答案就是 bang-bang:全力加、匀速、全力减">
        <div className="gd-formula">
          加速段 t_a = <span className="ft">v_max / a_max</span>{'　'}d_a = <span className="ft">v_max² / (2a_max)</span>{'　'}<span className="fi">(减速段对称)</span>
        </div>
        <div className="gd-note">{Icn.info}<span>为什么「全力」就是最优?因为任何时刻少用一点加速度,都只会让到达时间变长 —— <b>约束是上限,最优解一定顶在上限上</b>。这就是 bang-bang 的来历。</span></div>
      </Sec>
      <Sec n={3} title="判形:够不够长,决定是梯形还是三角">
        <div className="gd-lane">
          <div className="gd-card t"><h4>D ≥ 2d_a → 梯形</h4><p>够长,<em>能达到 v_max</em>。匀速段 d_c = D − 2d_a,总时 <em>T = 2t_a + d_c/v_max</em>。</p></div>
          <div className="gd-card o"><h4>D {'<'} 2d_a → 三角</h4><p>太短,<em>还没加到 v_max 就得减速</em>。峰值 <em>v_peak = √(a_max·D)</em>,总时 <em>T = 2√(D/a_max)</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「三角」这个情形最容易被忘掉:代码里如果只写梯形公式,短距离时算出来的匀速段会是<b>负数</b> —— 不报错,但轨迹是错的。<b>判形那一行 if 是必须的。</b></span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '距离 D、v_max、a_max' }, { cls: 'pd', text: '算 t_a、d_a' },
          { cls: 'pt', text: '判形:D vs 2d_a' }, { cls: 'pi', text: '梯形:加速/匀速/减速' },
          { cls: 'ph', text: '三角:加速/减速' }, { cls: 'pm', text: '总时间 T' },
        ]}
        why={<><b>它和三次多项式那一课是一对:</b>三次多项式保证<b>平滑</b>(两端速度为 0、加速度有限),梯形曲线保证<b>最快</b>(顶着约束跑)。两者不可兼得 —— 梯形的加速度是<b>方波</b>,切换瞬间 jerk 无穷大。所以高速高精场合用 <b>S 曲线</b>:把梯形的棱角磨圆,牺牲一点时间换有限的 jerk。<b>平滑和快,永远在换。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 针孔相机模型 ═══════════════
function PinholeDiagram() {
  return (
    <Shell icon={Icn.ruler} title="针孔相机模型原理"
      sub="看懂：3D 变 2D 只做了一件事 —— 除以深度。剩下的都是修正">
      <Sec n={1} title="第一步:透视归一化 —— 「近大远小」就是这一下除法">
        <div className="gd-formula">
          x_n = <span className="ft">X / Z</span>{'　'}y_n = <span className="ft">Y / Z</span>
          {'　　'}<span className="fi">除以深度 ⇒ 远处的东西显小</span>
        </div>
        <div className="gd-note">{Icn.info}<span>注意这一除<b>把 Z 丢掉了</b>:所有 X/Z 相同的点(一条射线上的所有点)投到<b>同一个像素</b>。<b>单目相机丢深度</b>这件事,就发生在这一行 —— 后面的双目、结构光、TOF,全是为了把它找回来。</span></div>
      </Sec>
      <Sec n={2} title="第二步:内参 K —— 把归一化坐标搬到像素坐标">
        <div className="gd-formula">
          u = <span className="fo">f_x</span>·x_n + <span className="fo">c_x</span>{'　'}v = <span className="fo">f_y</span>·y_n + <span className="fo">c_y</span>
        </div>
        <div className="gd-note">{Icn.info}<span>本例 X=(3,2,5)、f=500、主点 (320,240):x_n = 3/5 = 0.6 → u = 500×0.6 + 320 = <b>620</b>;y_n = 0.4 → v = <b>440</b>。两步都能心算。</span></div>
      </Sec>
      <Sec n={3} title="第三步:径向畸变 —— 镜头不是理想针孔">
        <div className="gd-formula">
          r² = x_n² + y_n²{'　'}x_d = x_n·( 1 + <span className="ft">k₁r²</span> + <span className="ft">k₂r⁴</span> )
          {'　　'}<span className="fi">离中心越远,r 越大,弯得越厉害</span>
        </div>
        <div className="gd-note">{Icn.info}<span>同一个点,k₁=0.2/k₂=0.05 时落到 <b>(655, 464)</b> —— 比无畸变的 (620,440) 偏了三十多个像素。<b>直线被拍弯</b>(桶形/枕形),而且<b>边缘最明显</b>。<b>标定</b>就是拿棋盘格从一堆已知的 3D↔2D 对应里反求 K 和这些 k。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '相机系 3D 点' }, { cls: 'pd', text: '除以深度 Z' },
          { cls: 'pt', text: '归一化坐标' }, { cls: 'pi', text: '内参 K → 像素' },
          { cls: 'ph', text: '径向畸变修正' }, { cls: 'pm', text: '图像上的 (u,v)' },
        ]}
        why={<><b>后面几乎每一课都要用它:</b>ICP 要用它把深度图变成点云,PnP 要用它做重投影,VO 要用它把像素变成归一化坐标,手眼标定要用它算相机运动。<b>相机模型不准,后面全错,而且错得很像「算法不行」</b> —— 所以标定是视觉系统里最不能省的一步。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 双目立体视觉 ═══════════════
function StereoDiagram() {
  return (
    <Shell icon={Icn.ruler} title="双目立体视觉原理"
      sub="看懂：把针孔丢掉的深度找回来 —— 代价是远处越来越不准">
      <Sec n={1} title="视差:同一个点在左右图上差了多少">
        <div className="gd-formula">
          d = x_L − x_R = <span className="ft">f·b / Z</span>
          {'　　'}⇒{'　'}<b>Z = f·b / d</b>{'　'}<span className="fi">(b = 基线,两相机间距)</span>
        </div>
        <div className="gd-note">{Icn.info}<span>越近视差越大 —— 伸出手指,交替闭左右眼,近处的手指跳得厉害、远处的墙几乎不动。<b>你的两只眼睛做的就是这件事。</b></span></div>
      </Sec>
      <Sec n={2} title="致命的一条:深度误差随距离平方增长">
        <div className="gd-formula">
          ΔZ ≈ <span className="fo">Z² / (f·b)</span> · Δd{'　'}∝{'　'}<b>Z²</b>
        </div>
        <div className="gd-note">{Icn.info}<span>视差只要有 1 个像素的误差,近处影响很小,<b>远处就被平方放大</b>。这是双目相机的<b>物理天花板</b>,不是算法能补的:想看得更远更准,只有<b>加大基线 b 或加长焦距 f</b> —— 而这两条都会缩小视野和近处的可测范围。</span></div>
      </Sec>
      <Sec n={3} title="所以选型是在几个约束之间权衡">
        <div className="gd-lane">
          <div className="gd-card t"><h4>基线大</h4><p>远处准 —— 但<em>近处测不了</em>(两图重叠区变小),设备也变大。</p></div>
          <div className="gd-card o"><h4>基线小</h4><p>紧凑、近处好 —— <em>远处深度噪声大</em>。</p></div>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '两个平行相机' }, { cls: 'pd', text: '同一点在左右图上' },
          { cls: 'pt', text: '视差 d = x_L − x_R' }, { cls: 'pi', text: 'Z = f·b/d' },
          { cls: 'ph', text: '得到深度图' }, { cls: 'pm', text: '误差 ∝ Z²' },
        ]}
        why={<><b>为什么室外自动驾驶不敢只靠双目:</b>百米外的车,视差已经小到一两个像素,ΔZ ∝ Z² 意味着深度误差好几米 —— 够不上刹车决策。所以远距离靠激光雷达/毫米波,双目负责中近距离。<b>知道一个传感器的误差怎么随距离长,比知道它「能测多远」有用得多。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 点云预处理 ═══════════════
function PointCloudDiagram() {
  return (
    <Shell icon={Icn.chip} title="点云预处理原理"
      sub="看懂：配准/建图前必做的两步 —— 降密度，和给每个点求法线">
      <Sec n={1} title="① 体素下采样:把空间切格子,每格只留质心">
        <div className="gd-note">{Icn.info}<span>原始点云<b>又密、又不均、还带噪</b>(近处密远处稀)。切成边长 L 的网格、每个占用体素只保留<b>落在里面那些点的质心</b> —— 点数降下来、<b>密度变均匀</b>,而且质心比任一原始点更抗噪。本例 8 个点、L=1 → 降到 <b>5 个体素</b>。</span></div>
      </Sec>
      <Sec n={2} title="② 法线估计:邻域协方差做 PCA,最小特征向量就是法线">
        <div className="gd-formula">
          取 k 近邻 → 算协方差 C → 特征分解
          {'　　'}<span className="ft">最小特征值</span>对应的特征向量 = <b>表面法线</b>
        </div>
        <div className="gd-note">{Icn.info}<span>直觉:在一小片近似平面的点里,<b>沿平面方向的散布大、垂直平面方向的散布最小</b> —— 所以「方差最小的方向」就是法线。本例点 (1.6,1.3) 取 4 近邻,PCA 得法线 ≈ <b>(0.77, −0.64)</b>,确实垂直于那条斜面。</span></div>
      </Sec>
      <Sec n={3} title="特征值的比例还能顺手判「平面 / 边 / 角」">
        <div className="gd-note">{Icn.info}<span>三个特征值差不多 → <b>角</b>(各向散布均匀);一大两小 → <b>边</b>(沿一条线);两大一小 → <b>平面</b>。同一次 PCA <b>白送</b>一个局部形状分类器,特征提取常直接用它。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '原始点云(密/不均/噪)' }, { cls: 'pd', text: '体素下采样取质心' },
          { cls: 'pt', text: '每点找 k 近邻' }, { cls: 'pi', text: '邻域协方差' },
          { cls: 'ph', text: 'PCA 最小特征向量' }, { cls: 'pm', text: '法线(+形状判别)' },
        ]}
        why={<><b>为什么这两步不能省:</b>ICP 的代价直接正比于点数,不下采样就慢得没法用;而<b>点到面</b>的 ICP 误差项要用法线 —— 它比点到点收敛快得多。所以「预处理」不是走过场,<b>它决定了后面配准跑不跑得动、收不收敛</b>。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · ICP 点云配准 ═══════════════
function ICPDiagram() {
  return (
    <Shell icon={Icn.chip} title="ICP 点云配准原理"
      sub="看懂：不知道点的对应关系，就先猜一个 —— 然后靠迭代把它猜对">
      <Sec n={1} title="困难在于:两片点云的点根本不是一一对应的">
        <div className="gd-note">{Icn.info}<span>激光扫两帧,同一块墙上采到的点<b>位置完全不同</b>。要算刚体变换需要点对,可点对本身又依赖变换 —— <b>鸡生蛋</b>。ICP 的办法是:<b>先用「最近点」当对应猜一版,算出变换,搬过去,再猜一版</b>。</span></div>
      </Sec>
      <Sec n={2} title="两步一轮,反复迭代">
        <div className="gd-lane">
          <div className="gd-card t"><h4>① 找对应</h4><p>源点云每个点,在目标里找<em>欧氏最近</em>的点当对应。<em>一开始会猜错几个</em> —— 没关系。</p></div>
          <div className="gd-card o"><h4>② 求变换</h4><p>用这批点对算<em>最佳刚体变换</em>。2D 用 <em>Kabsch</em>:去质心 → 交叉协方差 → 旋转角 → 平移对齐质心。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>妙处在于:<b>就算对应猜错了一部分,算出来的变换也会让两片更接近一点</b>;更接近之后,下一轮的最近点就猜得更准。<b>误差单调下降</b>,于是收敛。</span></div>
      </Sec>
      <Sec n={3} title="代价:它只保证收敛到「局部」最优">
        <div className="gd-note">{Icn.info}<span>初始位姿偏太多,「最近点」会大面积猜错,ICP 会<b>稳稳地收敛到一个错误的对齐上</b> —— 而且误差还在下降,看起来一切正常。所以真实系统总是<b>先用别的手段给一个粗初值</b>(里程计、IMU、特征匹配),再交给 ICP 精修。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '两片点云 + 粗初值' }, { cls: 'pd', text: '找最近点当对应' },
          { cls: 'pt', text: 'Kabsch 求刚体变换' }, { cls: 'pi', text: '把源点云搬过去' },
          { cls: 'ph', text: '误差下降' }, { cls: 'pm', text: '迭代到收敛' },
        ]}
        why={<><b>它是激光 SLAM 前端的主力:</b>相邻两帧点云配准出来的刚体变换,<b>就是机器人这一帧动了多少</b> —— 这就是激光里程计。而它「需要好初值、只保证局部最优」这一条,正是 SLAM 要有回环检测的原因:<b>前端会漂,得有别的东西把它拉回来。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · PnP 位姿估计 ═══════════════
function PnPDiagram() {
  return (
    <Shell icon={Icn.pin} title="PnP · 6D 位姿估计原理"
      sub="看懂：知道物体长什么样、看到它在图上哪 —— 就能反推相机在哪">
      <Sec n={1} title="给什么、求什么">
        <div className="gd-formula">
          已知:n 个 <span className="ft">3D 点</span>(物体系) + 它们的 <span className="fo">2D 像素</span> + 内参 <span className="fi">K</span>
          {'　→　'}求:<b>6 自由度位姿 (R, t)</b>
        </div>
      </Sec>
      <Sec n={2} title="本质是最小化重投影误差">
        <div className="gd-formula">
          min<sub>(R,t)</sub> Σ ‖ <span className="ft">K[R|t]·X</span> − <span className="fo">观测像素</span> ‖²
          {'　　'}<span className="fi">真位姿处误差 = 0,位姿越偏残差越大</span>
        </div>
        <div className="gd-note">{Icn.info}<span>本例 4 个 3D 点、K 的 f=500 主点 (320,320),真位姿 R=I、t=[0,0,5] 投出观测像素 <b>(270,270) (370,270) (370,370) (320,320)</b>。<b>把位姿换错一个,重投影就立刻对不上</b> —— 这也是检验 PnP 结果的唯一办法:<b>投回去看看落在不在原处</b>。</span></div>
      </Sec>
      <Sec n={3} title="解法是一整条谱系:先给个解,再精修">
        <div className="gd-lane">
          <div className="gd-card t"><h4>P3P</h4><p>3 点最小情形,给出 <em>4 组候选</em>,拿第 4 个点<em>消歧</em>。</p></div>
          <div className="gd-card i"><h4>DLT / EPnP</h4><p>≥6 点线性解 / EPnP 是 <em>O(n)</em>(把点表成 4 个控制点)。</p></div>
          <div className="gd-card o"><h4>高斯-牛顿</h4><p>拿上面的解当初值,<em>迭代最小化重投影误差</em>精修。</p></div>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '3D 模型点' }, { cls: 'pd', text: '图上检测到 2D 像素' },
          { cls: 'pt', text: '内参 K' }, { cls: 'pi', text: 'P3P/EPnP 给初解' },
          { cls: 'ph', text: '高斯-牛顿精修' }, { cls: 'pm', text: '(R, t)' },
        ]}
        why={<><b>视觉抓取的最后一环就是它:</b>识别出物体是什么、在图上哪里,还不够 —— 机械臂要的是<b>物体在它自己坐标系里的 6D 位姿</b>。PnP 把「图上的样子」翻译成「空间里的姿态」,再经手眼标定换到机器人基座系,IK 才有目标可解。<b>整条视觉抓取链上,PnP 是从二维回到三维的那一跳。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 视觉里程计 ═══════════════
function VODiagram() {
  return (
    <Shell icon={Icn.pin} title="视觉里程计 · 对极几何原理"
      sub="看懂：单目连续两帧，怎么从匹配点反推相机自己动了多少">
      <Sec n={1} title="本质矩阵 E:把相对运动打包成一个 3×3">
        <div className="gd-formula">
          E = <span className="ft">[t]<sub>×</sub></span> · <span className="fo">R</span>
          {'　　'}<span className="fi">([t]<sub>×</sub> 是平移向量的反对称叉乘矩阵)</span>
        </div>
      </Sec>
      <Sec n={2} title="对极约束:同一个 3D 点在两帧的像点必须满足一条方程">
        <div className="gd-formula">
          <b>x₂ᵀ · E · x₁ = 0</b>
          {'　　'}<span className="fi">这就是 8 点法能从 ≥8 组匹配线性解出 E 的依据</span>
        </div>
        <div className="gd-note">{Icn.info}<span>换个角度看它更直观:l₂ = E·x₁ 是 x₁ 在第二帧里的<b>对极线</b>,x₂ <b>一定落在这条线上</b>。于是找匹配<b>只需沿一条线搜,不用搜全图</b> —— 这是立体匹配能做实时的根本原因。所有对极线交于<b>极点</b>,而极点就是<b>平移方向</b>在图上的像。</span></div>
      </Sec>
      <Sec n={3} title="从 E 分解出 (R, t):四个解,还有一个尺度问题">
        <div className="gd-lane">
          <div className="gd-card t"><h4>4 组候选</h4><p>数学上 E 分解出<em>四组 (R,t)</em>。</p></div>
          <div className="gd-card i"><h4>手性检验</h4><p>只有一组能让<em>三角化出的点在两个相机前方</em> —— 用它挑出唯一解。</p></div>
          <div className="gd-card o"><h4>尺度不确定</h4><p>t 只能定<em>方向</em>、定不了<em>长度</em> —— <em>单目的宿命</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「尺度不确定」的意思是:<b>把整个场景和运动同时放大一倍,拍出来的图一模一样</b>。所以单目 VO 只能给出「相似变换」意义下的轨迹;要真实尺度,得靠<b>双目、IMU、或已知大小的物体</b>。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '连续两帧 + 特征匹配' }, { cls: 'pd', text: '8 点法解 E' },
          { cls: 'pt', text: '对极线约束搜匹配' }, { cls: 'pi', text: '从 E 分解出 4 组 (R,t)' },
          { cls: 'ph', text: '手性检验挑唯一' }, { cls: 'pm', text: '相对运动(尺度未知)' },
        ]}
        why={<><b>它是单目 SLAM 的前端:</b>一帧帧把相对运动串起来就是轨迹。但相对运动会<b>逐帧累积误差</b>,而且尺度还会慢慢漂 —— 所以后端要有回环和优化。<b>VO 负责「快而近似」,SLAM 后端负责「慢而正确」</b>,这个分工在所有 SLAM 系统里都一样。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 手眼标定 ═══════════════
function HandEyeDiagram() {
  return (
    <Shell icon={Icn.ruler} title="手眼标定 AX = XB 原理"
      sub="看懂：相机装在夹爪上，它俩之间那个固定变换怎么量出来">
      <Sec n={1} title="问题:相机看到的东西,怎么翻译成手该去哪">
        <div className="gd-note">{Icn.info}<span>相机固连在夹爪上(eye-in-hand)。相机说「目标在我前方 20cm」,可机械臂只认自己的坐标系 —— 中间差的正是<b>相机相对夹爪的固定变换 X</b>。它装上去就不变了,但<b>没人量得准</b>,只能标定出来。</span></div>
      </Sec>
      <Sec n={2} title="让机器人动几下,就能列出方程">
        <div className="gd-formula">
          <span className="ft">A</span> = 夹爪的相对运动(由关节角 + <b>FK</b> 算)
          {'　'}<span className="fo">B</span> = 相机的相对运动(由观测固定标定板算)
        </div>
        <div className="gd-formula">
          相机固连在夹爪上 ⇒ <b>A · X = X · B</b>
        </div>
      </Sec>
      <Sec n={3} title="解法分两半,而且第一半自带一个自检">
        <div className="gd-lane">
          <div className="gd-card t"><h4>先解旋转</h4><p>R_A R_X = R_X R_B ⟹ <em>θ_A 必须等于 θ_B</em>(自检!),且 R_X 把 <em>B 的转轴转到 A 的转轴</em>。≥2 组不共线运动就定出 R_X。</p></div>
          <div className="gd-card o"><h4>再解平移</h4><p>(R_A − I)·t_X = R_X t_B − t_A —— 一个<em>线性方程</em>,≥2 组凑满秩解出 t_X。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「<b>两个旋转角必须相等</b>」这一条特别值钱:它是<b>数据质量的现场体检</b>。θ_A 和 θ_B 对不上,说明要么 FK 不准、要么标定板识别错了 —— <b>不用等标定结果出来才发现有问题</b>。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '让机器人动几下' }, { cls: 'pd', text: 'A:FK 算夹爪运动' },
          { cls: 'pt', text: 'B:看标定板算相机运动' }, { cls: 'pi', text: '查 θ_A = θ_B' },
          { cls: 'ph', text: '解 R_X(轴对应)' }, { cls: 'pm', text: '解 t_X(线性方程)' },
        ]}
        why={<><b>为什么它必须是「相对运动」而不是绝对位姿:</b>因为标定板在世界里的位置、机器人基座在世界里的位置,<b>这两个未知量在做差时正好消掉了</b>。AX=XB 之所以成立、之所以只剩一个未知数 X,全靠这一次相减。<b>标定问题的漂亮之处,常常就在于「什么东西被消掉了」。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · SLAM 回环校正 ═══════════════
function SLAMDiagram() {
  return (
    <Shell icon={Icn.star} title="SLAM 回环校正原理"
      sub="看懂：漂移躲不掉 —— 但走一圈回到原地时，能把它算出来并摊掉">
      <Sec n={1} title="病根:里程计是「一步接一步」的,误差只会累积">
        <div className="gd-note">{Icn.info}<span>轮子打滑、标定微偏,每一步都带一点<b>系统误差</b>。它不会自己抵消,只会<b>一步步加起来</b> —— 走得越久偏得越多。这不是传感器不够好,<b>是「相对测量」这件事的本性</b>。</span></div>
      </Sec>
      <Sec n={2} title="回环:走一圈回到起点,那个缺口就是累计漂移">
        <div className="gd-formula">
          机器人认出「我回到走过的地方了」(看到相同地标)
          {'　→　'}加一条约束:<b>终点应当 = 起点</b>
        </div>
        <div className="gd-note">{Icn.info}<span>妙就妙在:<b>漂移平时是看不见的</b>(你没有真值可比),而回环给了一次<b>免费的真值</b> —— 我知道这两处是同一个地方,那么估计出来的那个缺口,<b>就是累计误差本身</b>。</span></div>
      </Sec>
      <Sec n={3} title="位姿图优化:把缺口分摊回整条轨迹">
        <div className="gd-note">{Icn.info}<span>不是把终点硬拉到起点了事 —— 那样中间还是歪的。而是把误差<b>按位置比例分摊回每一个位姿</b>(越靠后分摊得越多),于是<b>整条轨迹一起被拉正</b>、环闭合,之前的漂移被大幅抹平。这是 SLAM 精度的关键一跃。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '边走边估计轨迹' }, { cls: 'pd', text: '里程计逐步漂移' },
          { cls: 'pt', text: '轨迹回不到起点' }, { cls: 'pi', text: '回环检测:认出旧地方' },
          { cls: 'ph', text: '测出缺口 = 累计漂移' }, { cls: 'pm', text: '分摊回整条轨迹' },
        ]}
        why={<><b>「同时定位与建图」为什么必须同时:</b>要定位得有地图,要建图得知道自己在哪 —— 又是一个鸡生蛋。SLAM 的答案和 ICP 一样:<b>两边都先猜,再靠约束互相校正</b>。而回环是这些约束里最强的一条,因为它<b>跨越了很长的时间</b>,一下子把长期漂移钉住了。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · GJK 碰撞检测 ═══════════════
function GJKDiagram() {
  return (
    <Shell icon={Icn.cross} title="GJK 碰撞检测原理"
      sub="看懂：两招把「两个形碰不碰」变成「一个形含不含原点」">
      <Sec n={1} title="第一招:Minkowski 差 —— 把两个形合成一个">
        <div className="gd-formula">
          A ⊖ B = { '{' } a − b { '}' }
          {'　　'}<b>两凸形相交 ⟺ 原点落在 A⊖B 里</b>
        </div>
        <div className="gd-note">{Icn.info}<span>为什么?a−b=0 意味着<b>存在一个点同时属于 A 和 B</b> —— 那正是「相交」的定义。一次代换,把两个形之间的关系变成<b>一个形和原点</b>的关系。</span></div>
      </Sec>
      <Sec n={2} title="第二招:支撑函数 —— 不建出 A⊖B,只按需要一个点">
        <div className="gd-formula">
          support(d) = 沿方向 d <b>最远</b>的顶点
          {'　　'}s(d) = support_A(d) − support_B(−d)
        </div>
        <div className="gd-note">{Icn.info}<span>A⊖B 显式建出来可能有 n×m 个点,太贵。GJK <b>懒惰</b>:每轮只朝一个方向要一个最远点,围着原点搭一个<b>单纯形</b>(2D 最多三角形)。<b>要多少建多少。</b></span></div>
      </Sec>
      <Sec n={3} title="每一轮做的判断只有两条">
        <div className="gd-lane">
          <div className="gd-card t"><h4>a·d {'<'} 0 → 不碰</h4><p>朝原点方向<em>最远的点都没越过原点</em> —— 整个 A⊖B 都在原点一侧,立刻停。</p></div>
          <div className="gd-card o"><h4>三角形含原点 → 碰</h4><p>否则把 a 加进单纯形,<em>丢掉离原点远的点</em>、把方向重新指向原点,继续。</p></div>
        </div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '两个凸形' }, { cls: 'pd', text: 'Minkowski 差:含不含原点' },
          { cls: 'pt', text: '朝原点取支撑点 a' }, { cls: 'pi', text: 'a·d<0 → 不碰' },
          { cls: 'ph', text: '单纯形朝原点收' }, { cls: 'pm', text: '含原点 → 碰' },
        ]}
        why={<><b>它为什么快到能进实时循环:</b>规划器每走一步都要问一次「碰没碰」,而 GJK <b>只用到顶点和几次点积</b>,而且<b>大多数情况几轮就能判「不碰」</b>(a·d{'<'}0 提前退出)—— 不碰才是常态。凸的限制也不算限制:凹形拆成若干凸块就行,这就是物理引擎里到处是「凸分解」的原因。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · MDP 与值迭代 ═══════════════
function MDPDiagram() {
  return (
    <Shell icon={Icn.doc} title="MDP + 贝尔曼方程原理"
      sub="看懂：值是怎么「从目标一步步往回传」的">
      <Sec n={1} title="五要素与一个目标">
        <div className="gd-formula">
          MDP = ⟨ S 状态, A 动作, P 转移, R 奖励, <span className="ft">γ 折扣</span> ⟩
          {'　　'}目标:最大化 <b>Σ γ<sup>t</sup>·r<sub>t</sub></b>
        </div>
      </Sec>
      <Sec n={2} title="贝尔曼最优方程:一个状态的值 = 选最好的动作">
        <div className="gd-formula">
          V*(s) = max<sub>a</sub> Σ<sub>s′</sub> P(s′|s,a)·[ <span className="ft">R</span> + <span className="fo">γ·V*(s′)</span> ]
          {'　　'}<span className="fi">= 即时奖励 + 折扣后的未来</span>
        </div>
      </Sec>
      <Sec n={3} title="值迭代:反复做备份,值从目标往回长">
        <div className="gd-lane">
          <div className="gd-card t"><h4>iter 1</h4><p>只有紧挨目标的 <em>C = 1</em>。</p></div>
          <div className="gd-card i"><h4>iter 2</h4><p><em>B = 0.9 × 1 = 0.9</em>。</p></div>
          <div className="gd-card o"><h4>iter 3</h4><p><em>A = 0.9² = 0.81</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>链是 A→B→C→G(到 G 得 +1)。<b>每迭代一轮,「知道怎么去目标」这件事就往回传一格</b> —— 这就是值迭代的全部动作。收敛后每个状态取 argmax 就得到最优策略(全朝 G)。γ=0.9 是远视、γ=0.5 是短视:<b>γ 决定「多看重未来」</b>。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '⟨S,A,P,R,γ⟩' }, { cls: 'pd', text: '贝尔曼备份一个状态' },
          { cls: 'pt', text: '扫一遍所有状态' }, { cls: 'pi', text: '值从目标往回传一格' },
          { cls: 'ph', text: '反复直到收敛' }, { cls: 'pm', text: 'argmax = 最优策略' },
        ]}
        why={<><b>为什么它是强化学习的地基:</b>后面所有算法都在解同一个贝尔曼方程,区别只在<b>「知不知道 P 和 R」和「表存不存得下」</b> —— 知道就用值迭代,不知道就用 Q-learning(下一课),状态太多存不下就用神经网络近似。<b>换的是手段,方程没变过。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · Q-learning ═══════════════
function QLearningDiagram() {
  return (
    <Shell icon={Icn.doc} title="Q-learning 原理"
      sub="看懂：不知道环境模型，怎么只靠经验学出同一个答案">
      <Sec n={1} title="和值迭代的分界:知不知道 P 和 R">
        <div className="gd-lane">
          <div className="gd-card t"><h4>值迭代(有模型)</h4><p>要知道<em>转移 P 和奖励 R</em>,才能求那个期望。</p></div>
          <div className="gd-card o"><h4>Q-learning(免模型)</h4><p>只要一串<em>经验元组 (s, a, r, s′)</em> —— 环境什么样,自己去撞出来。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="TD 更新:用当前的估计去改当前的估计">
        <div className="gd-formula">
          Q(s,a) ← Q(s,a) + α·[ <span className="ft">r + γ·max<sub>a′</sub>Q(s′,a′) − Q(s,a)</span> ]
          {'　　'}<span className="fi">方括号 = TD 误差 δ</span>
        </div>
        <div className="gd-note">{Icn.info}<span>方括号里用 Q 自己去估计未来,这叫<b>自举(bootstrapping)</b> —— 听着像空手套白狼,但它确实收敛。首次更新 C→G:δ = 1 + γ·0 − 0 = <b>1</b>。</span></div>
      </Sec>
      <Sec n={3} title="奖励每回合往回传一步,最后和值迭代同解">
        <div className="gd-formula">
          多回合后 Q 收敛到 <b>[0.81, 0.9, 1]</b>
          {'　　'}<span className="fi">和值迭代的 V* 一模一样 —— 但它<b>没用到模型</b></span>
        </div>
        <div className="gd-note">{Icn.info}<span><b>off-policy</b> 是它的另一个关键词:更新时用 <b>max</b>(贪心)学最优 Q,而<b>行为可以带探索</b>(ε-greedy)。学的和做的可以不是一回事 —— 这让它能从<b>别人的、甚至很旧的经验</b>里学。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '与环境交互' }, { cls: 'pd', text: '拿到 (s,a,r,s′)' },
          { cls: 'pt', text: '算 TD 误差 δ' }, { cls: 'pi', text: 'Q ← Q + αδ' },
          { cls: 'ph', text: '奖励往回传一步' }, { cls: 'pm', text: '收敛到最优 Q' },
        ]}
        why={<><b>α 是一把明码标价的旋钮:</b>大 → 学得快但抖,小 → 稳但慢。而<b>Q 表本身是这条路的天花板</b> —— 状态一多就存不下、也没法泛化(相邻的状态学不到一块去)。用神经网络代替这张表,就是 DQN;直接学策略而不是值,就是下一课的策略梯度。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 策略梯度 REINFORCE ═══════════════
function PolicyGradDiagram() {
  return (
    <Shell icon={Icn.bulb} title="策略梯度 REINFORCE 原理"
      sub="看懂：基线不是「降方差的小技巧」，它决定了更新的方向对不对">
      <Sec n={1} title="换个打法:不学值,直接学策略">
        <div className="gd-formula">
          ∇<sub>θ</sub>J = E[ <span className="ft">∇<sub>θ</sub>log π<sub>θ</sub>(a|s)</span> · <span className="fo">G</span> ]
          {'　　'}<span className="fi">「把导致高回报的动作,概率往上推」</span>
        </div>
        <div className="gd-note">{Icn.info}<span>比起值方法,它<b>天然处理连续动作</b>(关节力矩没法 argmax 遍历);代价是<b>高方差</b> —— 同一个策略跑两次,梯度可能差很远。</span></div>
      </Sec>
      <Sec n={2} title="基线:一个例子就能看出它有多要紧">
        <div className="gd-formula">
          单状态两动作:L 回报 <span className="ft">1</span>、R 回报 <span className="fo">3</span>,基线 b = <b>2</b>
        </div>
        <div className="gd-lane">
          <div className="gd-card t"><h4>不带基线</h4><p>采到较差的 L,权重 = 回报 = <em>1 {'>'} 0</em> → <em>π(L) 反而被推高</em> —— <b>方向就是错的</b>。</p></div>
          <div className="gd-card o"><h4>带基线 A = G − b</h4><p>A = 1 − 2 = <em>−1</em> → <em>π(L) 被压下去</em> —— 对了。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>所以基线不只是「降方差」:只要回报<b>恒为正</b>,不带基线时<b>每一个被采到的动作都会被强化</b>,只是强化的多少不同。<b>是基线让「低于平均」这件事有了负号。</b></span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: 'softmax 策略 π_θ' }, { cls: 'pd', text: '采样动作、拿回报 G' },
          { cls: 'pt', text: '减基线得优势 A' }, { cls: 'pi', text: '∇logπ · A' },
          { cls: 'ph', text: '梯度上升更新 θ' }, { cls: 'pm', text: '好动作概率↑ 差的↓' },
        ]}
        why={<><b>基线通常取什么:</b>取 V(s) —— 于是「优势」A = G − V(s) 的含义变得很干净:<b>「这个动作比这个状态的平均水平好多少」</b>。学策略的同时学一个 V 来当基线,就是 <b>actor-critic</b>;再给更新加个信任域,就是下一课的 PPO。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · PPO ═══════════════
function PPODiagram() {
  return (
    <Shell icon={Icn.bulb} title="PPO 近端策略优化原理"
      sub="看懂：一个 min 和一个 clip，就换来了「别一步迈太大」">
      <Sec n={1} title="痛点:策略梯度的步子难调,一步迈大就崩">
        <div className="gd-formula">
          重要性比 r = <span className="ft">π<sub>θ</sub>(a|s) / π<sub>θ_old</sub>(a|s)</span>
          {'　　'}<span className="fi">r = 1 说明策略没变</span>
        </div>
        <div className="gd-note">{Icn.info}<span>直接最大化替代目标 L = r·A,优化器会<b>把 r 推到无穷</b> —— 策略瞬间崩坏。得有东西拦住它。</span></div>
      </Sec>
      <Sec n={2} title="裁剪目标:超出信任域就「封顶」,梯度归零">
        <div className="gd-formula">
          L<sup>clip</sup> = <b>min</b>( r·A, <span className="fo">clip(r, 1−ε, 1+ε)</span>·A )
          {'　　'}ε = 0.2 ⇒ r 限在 <b>[0.8, 1.2]</b>
        </div>
        <div className="gd-lane">
          <div className="gd-card t"><h4>小步 r = 1.1</h4><p>在 [0.8,1.2] 内 → <em>不裁剪,正常更新</em>。</p></div>
          <div className="gd-card o"><h4>大步 r = 1.5</h4><p>超过 1+ε → <em>裁剪到 1.2</em>、目标封顶 → <em>梯度为 0,拦住</em>。</p></div>
        </div>
      </Sec>
      <Sec n={3} title="为什么是 min 而不是直接 clip">
        <div className="gd-note">{Icn.info}<span>那个 min 保证了<b>裁剪只在「对自己有利的方向」上生效</b>:A{'>'}0 时 r 涨到 1+ε 就封顶(不许过度增概率);A{'<'}0 时 r 跌到 1−ε 就封底。<b>「新旧策略差太多就没有梯度」</b> —— 这就是一条天然的信任域,而且没有二阶项、便宜到能大规模用。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '采一批轨迹' }, { cls: 'pd', text: '算优势 A' },
          { cls: 'pt', text: '重要性比 r' }, { cls: 'pi', text: 'clip 到 [1−ε, 1+ε]' },
          { cls: 'ph', text: 'min 取保守的那个' }, { cls: 'pm', text: '多 epoch 复用这批数据' },
        ]}
        why={<><b>为什么 PPO 成了当今主力:</b>它 on-policy,却因为有裁剪兜底,<b>敢把同一批数据反复训好几个 epoch</b> —— 样本效率一下就上来了。实现只比 REINFORCE 多十几行,却稳得多。机器人学走路(Brax/Isaac)、大模型 RLHF,用的都是它。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 行为克隆 BC ═══════════════
function BCDiagram() {
  return (
    <Shell icon={Icn.doc} title="行为克隆 BC 原理"
      sub="看懂：最简单的模仿学习，和它那个躲不掉的致命伤">
      <Sec n={1} title="做法简单到不像强化学习">
        <div className="gd-formula">
          收集专家示范 (状态 → 动作){'　→　'}当成<span className="ft">监督学习</span>去拟合
        </div>
        <div className="gd-note">{Icn.info}<span>没有奖励、没有探索、没有环境交互 —— 就是一个分类/回归问题。<b>所有 VLA 大模型的训练基石就是它。</b></span></div>
      </Sec>
      <Sec n={2} title="致命伤:分布漂移 / 复合误差">
        <div className="gd-formula">
          小误差 → 漂到<span className="fo">专家没示范过的状态</span> → 没学过、动作更错
          {'　→　'}漂得更远 → <b>雪球滚大</b>
        </div>
        <div className="gd-note">{Icn.info}<span>车道保持这个例子最清楚:专家<b>只在中间示范</b>,所以 BC 在中间和专家一样好。可一旦被扰动推到车道边上 —— 那是训练数据里<b>从来没出现过的状态</b> —— 它就<b>欠修正</b>,于是更偏,于是更陌生。<b>误差不是加起来的,是乘起来的。</b></span></div>
      </Sec>
      <Sec n={3} title="根因:BC 是一步监督,而控制是一条轨迹">
        <div className="gd-note">{Icn.info}<span>监督学习假设<b>训练和测试同分布</b>。可 BC 的策略<b>自己会改变它遇到的状态分布</b> —— 它一动,分布就不是专家那个了。这条假设一破,监督学习的所有保证都失效。<b>解法(DAgger、加噪声示范、Diffusion Policy、RL 微调)全都在对付这一条。</b></span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '专家示范' }, { cls: 'pd', text: '监督学 状态→动作' },
          { cls: 'pt', text: '示范区内:和专家一样' }, { cls: 'pi', text: '被扰动推出示范区' },
          { cls: 'ph', text: '欠修正、误差复合' }, { cls: 'pm', text: '冲出车道' },
        ]}
        why={<><b>为什么它还是所有人的起点:</b>因为它<b>不需要奖励函数、不需要仿真器、不需要试错</b> —— 只要示范数据。在真机上试错既慢又危险,而示范可以人来遥操作采。<b>「先 BC 学个能用的,再想办法治分布漂移」</b>,这是具身学习的默认路线。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · Diffusion Policy ═══════════════
function DiffPolicyDiagram() {
  return (
    <Shell icon={Icn.star} title="Diffusion Policy 原理"
      sub="看懂：BC 的第二个病 —— 把两个都对的答案，平均成一个错答案">
      <Sec n={1} title="病:多峰动作被回归平均掉">
        <div className="gd-formula">
          绕障碍:向左(<span className="ft">−1</span>)对,向右(<span className="fo">+1</span>)也对
          {'　→　'}回归输出<b>一个</b>动作 ⇒ 平均成 <b>0(直行)</b> ⇒ <b>正好撞上</b>
        </div>
        <div className="gd-note">{Icn.info}<span>这<b>不是数据不够</b>,是「回归求均值」的<b>结构问题</b>:两个正确答案的平均,可能是最差的那个答案。数据越多,它平均得越坚定。</span></div>
      </Sec>
      <Sec n={2} title="药:不预测动作,而是建整个动作分布">
        <div className="gd-lane">
          <div className="gd-card t"><h4>从噪声出发</h4><p>随机采一个动作 —— 什么都不是。</p></div>
          <div className="gd-card i"><h4>沿学到的分数去噪</h4><p>一步步<em>把噪声往高概率区拉</em>。</p></div>
          <div className="gd-card o"><h4>落到某一个模态</h4><p>要么<em>向左</em>、要么<em>向右</em> —— <em>而不是它们的平均</em>。</p></div>
        </div>
      </Sec>
      <Sec n={3} title="代价:它是采样,不是一次前向">
        <div className="gd-note">{Icn.info}<span>每出一个动作要<b>去噪好几步</b>,比回归贵得多。所以工程上会减少去噪步数、或用 DDIM 之类的加速采样;而它换来的是<b>能表达「有好几种对法」</b>这件事 —— 在接触丰富、路径多解的操作任务上,这一条常常是成败之别。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '专家示范(多峰)' }, { cls: 'pd', text: '学动作分布的分数' },
          { cls: 'pt', text: '推理:从噪声起' }, { cls: 'pi', text: '逐步去噪' },
          { cls: 'ph', text: '收敛到一个模态' }, { cls: 'pm', text: '左或右,不是 0' },
        ]}
        why={<><b>它和 BC 治的是两个不同的病:</b>BC 的<b>分布漂移</b>是「没见过的状态怎么办」,Diffusion Policy 治的是「见过、但有<b>多个正确答案</b>怎么办」。前者靠 DAgger/RL 微调,后者靠换生成模型。<b>把两个病分清楚,才知道该上哪种药。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · VLA ═══════════════
function VLADiagram() {
  return (
    <Shell icon={Icn.chip} title="VLA 视觉-语言-动作原理"
      sub="看懂：动作被 token 化之后，机器人控制就变成了「预测下一个词」">
      <Sec n={1} title="换的是起点:从零学 vs 站在一个懂世界的模型上">
        <div className="gd-lane">
          <div className="gd-card t"><h4>BC / Diffusion Policy</h4><p>从示范里学「<em>这个具体状态</em> → 动作」。换个物体、换句话就<em>抓瞎</em>。</p></div>
          <div className="gd-card o"><h4>VLA</h4><p>拿在<em>海量网络图文</em>上预训练的 VLM 当骨干 —— 它<em>已经懂</em>「红色」「碗」「叠放」。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="关键一招:动作 token 化(RT-2 的做法)">
        <div className="gd-formula">
          每个动作维度(Δx / Δy / Δz / 夹爪…)按范围<span className="ft">离散成 256 个格子</span>
          {'　→　'}一个 <b>token id</b>
        </div>
        <div className="gd-note">{Icn.info}<span>这一步之后,<b>「输出动作」和「输出下一个词」就是同一件事</b> —— 大模型原封不动的自回归生成能力,直接拿来控制机器人。再把 token 反解回连续的位姿增量,交给控制器执行。</span></div>
      </Sec>
      <Sec n={3} title="换来了什么:泛化到没训过的物体">
        <div className="gd-note">{Icn.info}<span>因为骨干在网络图文上见过「灭火器」长什么样,即使<b>机器人示范数据里从来没有灭火器</b>,它也能听懂「把灭火器递给我」并做出合理动作。<b>这是从示范数据里学不出来的东西</b> —— 泛化来自预训练,不来自机器人数据。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '一张图 + 一句指令' }, { cls: 'pd', text: '预训练 VLM 骨干理解' },
          { cls: 'pt', text: '动作 token 化(256 格)' }, { cls: 'pi', text: '自回归吐动作 token' },
          { cls: 'ph', text: '反 token 化成位姿增量' }, { cls: 'pm', text: '机器人执行' },
        ]}
        why={<><b>代价和争议也一起来了:</b>token 化把连续动作<b>量化</b>了(精度受限于 256 格),自回归生成<b>慢</b>(高频控制吃不消),而且它仍然建立在 BC 之上 —— <b>分布漂移那个病一点没治</b>。所以现在的路线大多是<b>分层</b>:VLA 当「大脑」出粗粒度意图,底下再接一个高频的控制器把它执行好。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · FOC 磁场定向控制 ═══════════════
function FOCDiagram() {
  return (
    <Shell icon={Icn.chip} title="FOC 磁场定向控制原理"
      sub="看懂：换一个「跟着转子转」的坐标系，交流就变成了直流">
      <Sec n={1} title="两次坐标变换,一次比一次关键">
        <div className="gd-formula">
          <span className="ft">Clarke</span> abc→αβ:{'　'}i_α = i_a{'　'}i_β = (1/√3)i_a + (2/√3)i_b
          {'　'}<span className="fi">(三相去掉冗余的一相)</span>
        </div>
        <div className="gd-formula">
          <span className="fo">Park</span> αβ→dq(按转子电角 θ_e 旋转):{'　'}i_d = i_α cosθ + i_β sinθ{'　'}i_q = i_β cosθ − i_α sinθ
        </div>
        <div className="gd-note">{Icn.info}<span>Park 这一下是全部机关:<b>坐标系跟着转子一起转</b>,于是原本随时间正弦变化的相电流,<b>在转子系里变成了直流</b>。交流一变直流,<b>一个普通 PI 就能做到零稳态误差</b> —— 而对着交流量做 PI 是永远追不上的。</span></div>
      </Sec>
      <Sec n={2} title="两个 PI,而且 i_d 的目标恒为 0">
        <div className="gd-formula">
          e_d = <span className="ft">0</span> − i_d{'　'}e_q = i_q* − i_q{'　'}→{'　'}U_d, U_q
        </div>
        <div className="gd-note">{Icn.info}<span><b>i_d* = 0</b> 就是「最大转矩每安培(MTPA)」:表贴永磁/步进电机<b>只有 i_q 产生转矩</b>,i_d 纯粹发热。把它压到 0,<b>每一安培都用在转矩上</b>。转矩 τ = 1.5·p·λ_m·i_q —— 于是控转矩就等于控一个直流量。</span></div>
      </Sec>
      <Sec n={3} title="再变回去:逆 Park → 逆 Clarke → SVPWM">
        <div className="gd-note">{Icn.info}<span>SVPWM 比普通正弦 PWM <b>多约 15% 的母线电压利用率</b>(靠注入共模、中点钳位)—— 同样的电池,能多榨出 15% 的电压。<b>这是白捡的性能,所以工业上几乎没人用正弦 PWM。</b></span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '采三相电流' }, { cls: 'pd', text: 'Clarke → αβ' },
          { cls: 'pt', text: 'Park → dq(交流变直流)' }, { cls: 'pi', text: '两个 PI(i_d→0)' },
          { cls: 'ph', text: '逆变换 + SVPWM' }, { cls: 'pm', text: '转矩 τ = 1.5·p·λ_m·i_q' },
        ]}
        why={<><b>它是整条控制链的最内环:</b>关节 PID 或计算力矩算出「我要 5 N·m」,靠 FOC 把这句话<b>变成三相电压</b>。20kHz 跑一圈。相比开环微步,它<b>闭环量转子角、恒 90° 矢量</b> —— 不丢步,而且每安培都产生转矩。<b>上层控制算得再漂亮,最后都要落到这一环上。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · MoveIt 2(软件库层)═══════════════
function MoveItDiagram() {
  return (
    <Shell icon={Icn.doc} title="MoveIt 2 框架原理"
      sub="看懂：它不发明算法 —— 它把你已经学过的那些拼成一条流水线">
      <Sec n={1} title="它是什么:ROS 2 上机械臂规划的事实标准">
        <div className="gd-formula">
          给<span className="ft">机器人模型 + 目标位姿</span>{'　→　'}算出<span className="fo">无碰撞、可执行的关节轨迹</span>
        </div>
        <div className="gd-note">{Icn.info}<span>中枢是 <b>move_group</b>,串起「场景 → 规划 → 碰撞 → 运动学 → 轨迹」一条流水线。BSD-3-Clause,PickNik 维护。</span></div>
      </Sec>
      <Sec n={2} title="拆开看,每一格都是前面某一课">
        <div className="gd-lane">
          <div className="gd-card t"><h4>OMPL(规划)</h4><p>默认规划器就是 <em>RRT-Connect</em>;还有 RRT / RRT* / PRM。</p></div>
          <div className="gd-card i"><h4>FCL(碰撞)</h4><p><em>GJK 那一类</em>凸形碰撞检测。</p></div>
          <div className="gd-card o"><h4>CHOMP(优化)</h4><p>把采样法给的粗路<em>打磨平滑</em>。</p></div>
          <div className="gd-card t"><h4>时间参数化</h4><p>就是<em>梯形速度曲线</em> —— 给路径配上速度。</p></div>
          <div className="gd-card i"><h4>KDL / IKFast</h4><p><em>逆运动学</em>与雅可比。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>所以这一课不是学新算法,是<b>看清楚前面十来课在真实系统里各自站在哪一格</b>。库讲「用法」,实验讲「原理」,两层对着看。</span></div>
      </Sec>
      <Sec n={3} title="取舍要说明白">
        <div className="gd-lane">
          <div className="gd-card o"><h4>好处</h4><p>生态标准、<em>可插拔</em>、开箱即用。</p></div>
          <div className="gd-card t"><h4>代价</h4><p>学习曲线<em>陡</em>、配置繁、和 <em>ROS 强耦合</em>、偏机械臂(移动导航是 Nav2)。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>落地:Franka Panda、UR 等主流机械臂的标准工具链。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '机器人模型 + 目标' }, { cls: 'pd', text: '场景(障碍/附着物)' },
          { cls: 'pt', text: 'OMPL 规划(RRT-Connect)' }, { cls: 'pi', text: 'FCL 碰撞检测' },
          { cls: 'ph', text: 'CHOMP 平滑 + 时间参数化' }, { cls: 'pm', text: '可执行关节轨迹' },
        ]}
        why={<><b>为什么值得单独看一层「软件库」:</b>面试问「你会 MoveIt 吗」,想听的往往不是 API,而是<b>「你知不知道它底下是什么」</b>。默认规划器为什么是 RRT-Connect(快、双向)、为什么还要接 CHOMP(采样法的路太糙)、时间参数化在解决什么(路径 ≠ 轨迹)—— <b>这些答案全在前面几课里,库只是把它们摆到了一条线上。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 主从遥操作 ═══════════════
function TeleopDiagram() {
  return (
    <Shell icon={Icn.ruler} title="主从遥操作原理"
      sub="看懂：采示范数据的入口 —— 为什么同构双臂可以不用 IK">
      <Sec n={1} title="四步,一步都不能少">
        <div className="gd-formula">
          读 leader 舵机原始码(<span className="ft">0~4095</span>)
          {' → '}<span className="fi">标定成关节角</span>
          {' → '}<span className="fo">max_relative_target 安全钳</span>
          {' → '}写 follower 目标
        </div>
      </Sec>
      <Sec n={2} title="关键一条:同构 ⇒ 关节空间直接复制,不用 IK">
        <div className="gd-note">{Icn.info}<span>SO-101 是<b>一对连杆尺寸完全相同</b>的臂。结构一样,<b>抄关节角就复现同一个末端位姿</b> —— 中间不需要正运动学、更不需要逆运动学。<b>只有两臂结构不同时,才要做重定向/IK</b>。这一条省掉了整条链上最容易出错的一环。</span></div>
      </Sec>
      <Sec n={3} title="安全钳不是可选项">
        <div className="gd-note">{Icn.info}<span><b>max_relative_target</b> 限制每周期目标的<b>最大变化量</b>。人手一抖、通信丢一帧、标定有偏 —— 任何一个都会让目标突跳,而 follower 的伺服会<b>忠实地全速冲过去</b>,砸东西或伤人。<b>钳住相对量,是「让机器听人的」和「让机器安全地听人的」之间的那道差。</b></span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '人拧 leader 臂' }, { cls: 'pd', text: '读原始舵机码' },
          { cls: 'pt', text: '标定 → 关节角' }, { cls: 'pi', text: '相对量安全钳' },
          { cls: 'ph', text: '写 follower 目标' }, { cls: 'pm', text: '伺服 PID 内环执行' },
        ]}
        why={<><b>它是整条模仿学习流水的入口:</b>没有示范数据,BC / ACT / Diffusion Policy 全都无从谈起。而遥操作采到的数据质量<b>直接决定策略上限</b> —— 人操作得抖,策略就学得抖;人只在中间示范,策略就只会走中间(这正是 BC 那一课说的分布漂移)。<b>「数据采集」不是准备工作,它是算法的一部分。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · 数据集归一化 ═══════════════
function NormStatsDiagram() {
  return (
    <Shell icon={Icn.ruler} title="数据集归一化原理"
      sub="看懂：为什么必须用「整套数据集」的统计量，而不是每批现算">
      <Sec n={1} title="病:各个特征的量纲差着好几个数量级">
        <div className="gd-note">{Icn.info}<span>关节角是几弧度、夹爪开合是 0~1、力矩可能是几十 —— 直接喂进网络,<b>大量纲的特征会主导梯度</b>,小的那些几乎学不动。归一化就是把它们<b>拉到同一量级</b>。</span></div>
      </Sec>
      <Sec n={2} title="两种模式,各有各的脾气">
        <div className="gd-lane">
          <div className="gd-card t"><h4>MEAN_STD</h4><p>x′ = (x − μ)/(σ + eps)。<em>ACT 默认</em>;对无界的关节角/力矩自然,<em>对离群较稳</em>。</p></div>
          <div className="gd-card o"><h4>MIN_MAX</h4><p>拉到固定区间。直观,但<em>对离群点极敏感</em> —— 一个异常值就能把其余全压扁。</p></div>
        </div>
      </Sec>
      <Sec n={3} title="关键:统计量在整套数据集上算一次,存进 meta/stats">
        <div className="gd-note">{Icn.info}<span>这和 BatchNorm 那种<b>每批现算</b>完全不同。存成固定值之后,归一化就是一个<b>固定、可逆的仿射变换</b> —— 于是<b>策略输出必须反归一化才能送给机器人</b>。这一步忘了,动作数量级全错,而且<b>不报错,只是机器人乱动</b>。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '整套数据集' }, { cls: 'pd', text: '算 μ/σ 或 min/max' },
          { cls: 'pt', text: '存进 meta/stats' }, { cls: 'pi', text: '训练时归一化' },
          { cls: 'ph', text: '策略输出' }, { cls: 'pm', text: '反归一化 → 机器人' },
        ]}
        why={<><b>为什么必须固定而不是每批算:</b>推理时你只有<b>一个</b>样本,没有「批」可以算统计量。统计量一旦固定并随模型一起发布,<b>训练和部署用的就是同一个变换</b> —— 这条一致性是所有「训练好好的、上真机就废」问题里,最先该排查的一个。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · delta_timestamps 时序窗口 ═══════════════
function DeltaTSDiagram() {
  return (
    <Shell icon={Icn.doc} title="delta_timestamps 时序窗口原理"
      sub="看懂：策略要的不是一帧，是一段 —— 这座桥怎么搭">
      <Sec n={1} title="需求:观测要几帧历史,动作要一整块未来">
        <div className="gd-formula">
          用户按<span className="ft">秒</span>给偏移{'　'}obs: [−0.06, −0.04, −0.02, 0]{'　'}action: 未来 0~0.08
        </div>
        <div className="gd-note">{Icn.info}<span>数据在 parquet 里是<b>扁平的一行行帧</b>,而 ACT 要一整块未来动作、Diffusion 要几帧历史观测。<b>delta_timestamps 就是这座桥。</b></span></div>
      </Sec>
      <Sec n={2} title="三步:秒换帧 → 定位并钳边界 → 打 pad 掩码">
        <div className="gd-formula">
          delta_idx = <span className="ft">round(偏移 × fps)</span>{'　'}<span className="fi">fps=50 ⇒ −0.06s = −3 帧</span>
        </div>
        <div className="gd-formula">
          query = <span className="fo">clamp(当前帧 + delta, ep_start, ep_end−1)</span>{'　'}<span className="fi">越出本 episode 就钳到边界</span>
        </div>
        <div className="gd-note">{Icn.info}<span>「按 episode 钳」这一条最要紧:<b>不能跨到上一段录制里去取帧</b> —— 那是完全不同的一次任务,取来当历史是纯粹的污染。</span></div>
      </Sec>
      <Sec n={3} title="被钳过的帧要标出来,训练时排除">
        <div className="gd-formula">
          is_pad = (当前帧 + delta 落在 [ep_start, ep_end) <b>外</b>)
          {'　→　'}训练时按掩码<b>排除、不污染 loss</b>
        </div>
        <div className="gd-note">{Icn.info}<span>episode 开头取不到历史、结尾取不到未来 —— 那些位置被钳成了边界帧的<b>重复</b>。如果不打掩码,模型会学到「开头要连着做四次同样的事」这种<b>数据处理造出来的假规律</b>。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '按秒给偏移' }, { cls: 'pd', text: 'round(偏移×fps) → 帧' },
          { cls: 'pt', text: '当前帧 + delta' }, { cls: 'pi', text: 'clamp 到 episode 边界' },
          { cls: 'ph', text: '越界的标 is_pad' }, { cls: 'pm', text: '取出时序窗口' },
        ]}
        why={<><b>ACT 的动作块正是它的一个特例:</b>action_delta_indices = range(chunk_size) = [0..K−1]。所以「动作分块」在数据侧<b>不需要任何特殊代码</b> —— 只是一组偏移而已。<b>把「要一段时序」这件事下沉到数据集层,上面各种策略就都能共用同一套取数逻辑。</b></>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · ACT 动作分块与时序集成 ═══════════════
function ACTTEDiagram() {
  return (
    <Shell icon={Icn.star} title="ACT 动作分块 · 时序集成原理"
      sub="看懂：两招治 BC 的复合误差 —— 一招砍机会，一招削抖动">
      <Sec n={1} title="第一招:动作分块 —— 把滚雪球的机会砍到 1/K">
        <div className="gd-formula">
          一次观测<span className="ft">预测未来 K 个动作</span>(LeRobot chunk_size = <b>100</b>)
          {'　⇒　'}有效时域 T → <b>T/K</b>
        </div>
        <div className="gd-note">{Icn.info}<span>BC 的复合误差来自「每步都可能错一点,然后进入没见过的状态」。一次决策管 K 步,<b>决策次数就少了 K 倍</b>,滚雪球的机会自然也少了 K 倍。</span></div>
      </Sec>
      <Sec n={2} title="第二招:时序集成 —— 同一个动作被好几块预测到,加权平均">
        <div className="gd-formula">
          w<sub>i</sub> = <span className="fo">exp(−m·i)</span>{'　'}<span className="fi">i=0 是<b>最旧</b>的那条预测</span>
          {'　　'}a<sub>t</sub> = Σ w<sub>i</sub>·P<sub>i</sub> / Σ w<sub>i</sub>
        </div>
        <div className="gd-note">{Icn.info}<span>每一步都重新预测一整块,于是<b>时刻 t 的动作会被好几块各预测一次</b>,它们互相不完全一致 —— 这就是抖的来源。加权平均把它们抹平。m 默认 <b>0.01</b> → 权重近似均匀、<b>还略偏旧</b>(别过度信最新那条抖的);m 大 → 更信旧的;m{'<'}0 → 更信新的,但会削弱分块的好处。</span></div>
      </Sec>
      <Sec n={3} title="⚠️ 一个八股陷阱:LeRobot 默认不开时序集成">
        <div className="gd-note">{Icn.info}<span>默认走的是<b>队列 / receding-horizon</b>(一块用完再预测下一块),而不是每步重预测 + 集成。<b>「读配置别只读论文」</b> —— 论文里的招式和框架里的默认值经常不是一回事,这一条正是面试里区分「看过」和「用过」的地方。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '一次观测' }, { cls: 'pd', text: '预测未来 K 个动作' },
          { cls: 'pt', text: '每步都重新预测一块' }, { cls: 'pi', text: '同一时刻被多块覆盖' },
          { cls: 'ph', text: 'w_i = exp(−m·i) 加权' }, { cls: 'pm', text: '平滑轨迹' },
        ]}
        why={<><b>分块也有代价:</b>一次管 K 步意味着<b>这 K 步里对环境变化是「聋」的</b> —— 东西被人挪走了它也照做。所以 K 不是越大越好,它是在<b>「少犯复合误差」和「对变化的反应速度」</b>之间取平衡。时序集成某种意义上是在<b>把这个代价买回来一点</b>:每步都重预测,就还能感知到变化。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · miniduck 腿式 RL ═══════════════
function MiniDuckDiagram() {
  return (
    <Shell icon={Icn.bulb} title="Open Duck Mini 步态学习原理"
      sub="看懂：整条线最值钱的一句 ——「模仿奖励」不是「模仿学习」">
      <Sec n={1} title="它走的是另一条路:腿式强化学习,不是模仿学习">
        <div className="gd-lane">
          <div className="gd-card t"><h4>LeRobot 那一套</h4><p>ACT / Diffusion Policy —— <em>从人的示范里学</em>。</p></div>
          <div className="gd-card o"><h4>miniduck</h4><p>MuJoCo Playground 里 <em>Brax PPO</em> 训练(沿用 Berkeley Humanoid 配置),50Hz 策略跑在 <em>Pi Zero 2W</em> 上。</p></div>
        </div>
      </Sec>
      <Sec n={2} title="核心陷阱:「模仿奖励」≠「模仿学习」">
        <div className="gd-note">{Icn.info}<span>它确实有一项<b>模仿奖励</b> —— 鼓励策略贴近一条<b>参考步态</b>。但这只是<b>奖励函数里的一项</b>,策略仍然是<b>强化学习试错学出来的</b>,不是监督拟合专家动作。<b>参考步态在这里的作用是「把探索约束到像走路的那一带」,不是「照抄」。</b>这两件事混淆,是这条线上最常见的误读。</span></div>
      </Sec>
      <Sec n={3} title="怎么让它像在走路:相位 + 参考步态 + 策略残差">
        <div className="gd-lane">
          <div className="gd-card t"><h4>相位</h4><p>给一个<em>周期信号</em>当输入 —— 腿的节奏有了骨架。</p></div>
          <div className="gd-card i"><h4>参考步态</h4><p>提供<em>大致的关节轨迹</em>,策略只需要学<em>残差</em>。</p></div>
          <div className="gd-card o"><h4>PD 执行</h4><p>策略输出<em>目标位置</em>,底下 PD 把它跟住 —— <em>不是直接输出力矩</em>。</p></div>
        </div>
        <div className="gd-note">{Icn.info}<span>「学残差」是腿式 RL 的通用招式:<b>不让策略从零发明走路,只让它修正一个已经差不多的步态</b>。搜索空间小一个量级,训练才收敛得动。</span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '相位信号' }, { cls: 'pd', text: '参考步态给骨架' },
          { cls: 'pt', text: '策略学残差' }, { cls: 'pi', text: 'PD 跟住目标位置' },
          { cls: 'ph', text: '奖励:速度+模仿+姿态+能耗' }, { cls: 'pm', text: 'Brax PPO 训练' },
        ]}
        why={<><b>奖励分解才是腿式 RL 的真手艺:</b>只给速度奖励,它会学出各种奇形怪状的「爬行」;加上模仿项、姿态项、能耗项,才逼出像样的步态。<b>消融实验(带模仿 / 只 velocity / 无策略)最能说明问题</b> —— 少一项,毛病就换一种。这也是为什么腿式 RL 的论文一半篇幅在讲奖励。</>} />
    </Shell>
  )
}

// ═══════════════ 具身智能 · LeRobot × SO-101 实战 ═══════════════
function LeRobotDiagram() {
  return (
    <Shell icon={Icn.star} title="LeRobot × SO-101 实战流水"
      sub="看懂：前面所有课，落到一套能真买真搭的硬件上是什么样">
      <Sec n={1} title="硬件:低成本、可 3D 打印、主从两条臂">
        <div className="gd-formula">
          <span className="ft">SO-101</span>:5 自由度 + 夹爪、6 颗 STS3215 舵机、<span className="fo">leader / follower 两条同构臂</span>
        </div>
        <div className="gd-note">{Icn.info}<span>HuggingFace × TheRobotStudio。配 <b>LeRobot</b>(HF 的机器人学习库)。「能真买真搭」这一条很关键 —— <b>具身智能是少数「不上手就学不会」的方向</b>。</span></div>
      </Sec>
      <Sec n={2} title="四步流水,每一步都对应前面某几课">
        <div className="gd-lane">
          <div className="gd-card t"><h4>① 装配标定</h4><p>舵机码 ↔ 关节角(<em>遥操作那一课</em>)。</p></div>
          <div className="gd-card i"><h4>② 遥操作采数据</h4><p>leader 带 follower 录示范(相机 + 关节)成 <em>LeRobot 数据集</em>。</p></div>
          <div className="gd-card o"><h4>③ 训练策略</h4><p><em>lerobot-train</em>,默认 <em>ACT</em>(也可 Diffusion Policy / π0 等 VLA)。</p></div>
          <div className="gd-card t"><h4>④ 部署自主执行</h4><p><em>lerobot-rollout</em>,follower 臂自主完成任务(如抓起方块)。</p></div>
        </div>
      </Sec>
      <Sec n={3} title="这条流水把整条线串起来了">
        <div className="gd-note">{Icn.info}<span>标定要 <b>FK</b>;抓取目标位姿要 <b>PnP / 手眼</b>;规划要 <b>IK / 轨迹</b>;数据要 <b>归一化 / delta_timestamps</b>;策略是 <b>BC → ACT → Diffusion → VLA</b> 那一条谱系;而它们全都跑在 <b>FOC</b> 驱动的关节上。<b>前面 50 课不是散点,是这一条流水的各个环节。</b></span></div>
      </Sec>
      <Flow
        pills={[
          { cls: 'p0', text: '装配 + 标定' }, { cls: 'pd', text: '遥操作录示范' },
          { cls: 'pt', text: '存成 LeRobot 数据集' }, { cls: 'pi', text: 'lerobot-train(ACT)' },
          { cls: 'ph', text: 'lerobot-rollout' }, { cls: 'pm', text: 'follower 自主抓取' },
        ]}
        why={<><b>为什么这条线要以「实战」收尾:</b>具身智能里,<b>仿真里成立、真机上不成立</b>的事太多了 —— 接触、摩擦、标定误差、时延、数据分布。只有真的采过一批自己操作得歪歪扭扭的数据、看过策略学出来是什么德性,前面那些课里的「分布漂移」「多峰」「量纲」才会从名词变成你亲眼见过的现象。<b>这条流水的价值不在于抓起那个方块,在于它逼你把每一环都真的走一遍。</b></>} />
    </Shell>
  )
}

export const GUIDE_DIAGRAMS: Record<string, () => ReactNode> = {
  //  具身智能职业线(2026-09-06 起补):这条线原来 51 个实验一张引导图都没有。
  fk: FKDiagram,
  jacobian: JacobianDiagram,
  pid: PIDDiagram,
  //  算法轨补充题(2026-09-06 补齐)
  regex: RegexDiagram,
  wildcard: WildcardDiagram,
  quickselect: QuickselectDiagram,
  trie: TrieDiagram,
  lrucache: LRUCacheDiagram,
  lfucache: LFUCacheDiagram,
  topk: TopKDiagram,
  //  大模型轨 · Agent 工程线(2026-09-06 补齐)
  reactagent: ReactAgentDiagram,
  toolcall: ToolCallDiagram,
  promptbuild: PromptBuildDiagram,
  planning: PlanningDiagram,
  ctxcompact: CtxCompactDiagram,
  permguard: PermGuardDiagram,
  subagent: SubagentDiagram,
  memretrieve: MemRetrieveDiagram,
  memwrite: MemWriteDiagram,
  mempaging: MemPagingDiagram,
  reflection: ReflectionDiagram,
  //  具身智能 · 机器人学基础 / 刚体动力学
  ik: IKDiagram,
  quat: QuatDiagram,
  trajectory: TrajectoryDiagram,
  dyneom: DynEomDiagram,
  rnea: RNEADiagram,
  fwddyn: FwdDynDiagram,
  computedtorque: ComputedTorqueDiagram,
  contactlcp: ContactLCPDiagram,
  //  具身智能 · 感知与控制
  kalman: KalmanDiagram,
  ekf: EKFDiagram,
  ukf: UKFDiagram,
  particlefilter: ParticleFilterDiagram,
  complementary: ComplementaryDiagram,
  mpc: MPCDiagram,
  impedance: ImpedanceDiagram,
  //  具身智能 · 运动规划
  rrt: RRTDiagram,
  rrtstar: RRTStarDiagram,
  rrtconnect: RRTConnectDiagram,
  prm: PRMDiagram,
  dstarlite: DStarLiteDiagram,
  potentialfield: PotentialFieldDiagram,
  chomp: CHOMPDiagram,
  dubins: DubinsDiagram,
  trapezoid: TrapezoidDiagram,
  //  具身智能 · 视觉感知
  pinhole: PinholeDiagram,
  stereo: StereoDiagram,
  pointcloud: PointCloudDiagram,
  icp: ICPDiagram,
  pnp: PnPDiagram,
  vo: VODiagram,
  handeye: HandEyeDiagram,
  slam: SLAMDiagram,
  //  具身智能 · 碰撞 / 强化学习 / 具身学习
  gjk: GJKDiagram,
  mdp: MDPDiagram,
  qlearning: QLearningDiagram,
  policygrad: PolicyGradDiagram,
  ppo: PPODiagram,
  bc: BCDiagram,
  diffpolicy: DiffPolicyDiagram,
  vla: VLADiagram,
  //  具身智能 · 项目实战 / 软件库(收官八张)
  foc: FOCDiagram,
  moveit: MoveItDiagram,
  teleop: TeleopDiagram,
  normstats: NormStatsDiagram,
  deltats: DeltaTSDiagram,
  actte: ACTTEDiagram,
  miniduck: MiniDuckDiagram,
  lerobot: LeRobotDiagram,
  binsearch: BinSearchDiagram,
  nqueens: NQueensDiagram,
  unionfind: UnionFindDiagram,
  heap: HeapDiagram,
  quicksort: QuickSortDiagram,
  mergesort: MergeSortDiagram,
  fastpow: FastPowDiagram,
  astar: AStarDiagram,
  perceptron: PerceptronDiagram,
  pooling: PoolingDiagram,
  beam: BeamDiagram,
  rnn: RNNDiagram,
  wordvec: WordVecDiagram,
  lstm: LSTMDiagram,
  norm: NormDiagram,
  rag: RagDiagram,
  selfconsist: SelfConsistDiagram,
  bestofn: BestOfNDiagram,
  tot: ToTDiagram,
  mcts: MctsDiagram,
  collision: CollisionDiagram,
  gcn: GcnDiagram,
  pagerank: PageRankDiagram,
  qlearn: QLearnDiagram,
  recsys: RecSysDiagram,
  diffusion: DiffusionDiagram,
  gan: GanDiagram,
  conv: ConvDiagram,
  backprop: BackpropDiagram,
  linreg: LinRegDiagram,
  logreg: LogRegDiagram,
  dtree: DTreeDiagram,
  gbdt: GBDTDiagram,
  svm: SVMDiagram,
  pca: PCADiagram,
  kmeans: KMeansDiagram,
  knn: KNNDiagram,
  lln: LlnDiagram,
  clt: CltDiagram,
  xent: XentDiagram,
  bayes: BayesDiagram,
  bloom: BloomDiagram,
  graddesc: GradDescDiagram,
  induction: InductionDiagram,
  editdist: EditDistDiagram,
  lowrank: LowRankDiagram,
  dotsim: DotSimDiagram,
  greedy: GreedyDiagram,
  jl: JLDiagram,
  maxent: MaxEntDiagram,
  condnum: CondNumDiagram,
  linattn: LinAttnDiagram,
  engram: EngramDiagram,
  flashdecode: FlashDecodeDiagram,
  dpattn: DPAttnDiagram,
  ep: EPDiagram,
  pp: PPDiagram,
  residual: ResidualDiagram,
  hopfield: HopfieldDiagram,
  ortho: OrthoDiagram,
  scale: ScaleDiagram,
  engine: EngineDiagram,
  chunkprefill: ChunkPrefillDiagram,
  kvoffload: KvOffloadDiagram,
  layout: LayoutDiagram,
  collective: CollectiveDiagram,
  tensorpar: TensorParDiagram,
  matmul: MatmulDiagram,
  forward: ForwardDiagram,
  rmsnorm: RmsNormDiagram,
  roofline: RooflineDiagram,
  rope: RopeDiagram,
  moe: MoeDiagram,
  quant: QuantDiagram,
  specdec: SpecDecDiagram,
  scaledmask: ScaledMaskDiagram,
  flash: FlashDiagram,
  kvcache: KvCacheDiagram,
  mha: MhaDiagram,
  batching: BatchingDiagram,
  bpe: BpeDiagram,
  cache: CacheDiagram,
  radix: RadixDiagram,
  paged: PagedDiagram,
  softmax: SoftmaxDiagram,
  attention: AttentionDiagram,
  llmsize: LlmSizeDiagram,
  sampling: SamplingDiagram,
  expr: ExprDiagram,
  rip: RipDiagram,
  addsub: AddSubDiagram,
  btree: BtreeDiagram,
  sort: SortDiagram,
  dijkstra: DijkstraDiagram,
  kmp: KmpDiagram,
  avl: AvlDiagram,
  huffman: HuffmanDiagram,
  mst: MstDiagram,
  topo: TopoDiagram,
  bplus: BplusDiagram,
  traverse: TraverseDiagram,
  vm: VmDiagram,
  subnet: SubnetDiagram,
  float: FloatDiagram,
  bitmap: BitmapDiagram,
  inode: InodeDiagram,
  page: PageDiagram,
  disk: DiskDiagram,
  hash: HashDiagram,
  pipeline: PipelineDiagram,
  multiply: MultiplyDiagram,
  scheduler: SchedulerDiagram,
  banker: BankerDiagram,
  partition: PartitionDiagram,
  semaphore: SemaphoreDiagram,
  tcp: TcpDiagram,
  arq: ArqDiagram,
  crc: CrcDiagram,
  hamming: HammingDiagram,
  handshake: HandshakeDiagram,
  csma: CsmaDiagram,
}

/** 弹层外壳：盖住视口、可滚、✕/Esc/点背景关闭 */
export function GuideDiagramModal({ expId, onClose }: { expId: string; onClose: () => void }) {
  const Diagram = GUIDE_DIAGRAMS[expId]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!Diagram) return null
  return (
    <div className="gd-scrim" onClick={onClose}>
      <div className="gd-modal" onClick={e => e.stopPropagation()}>
        <button className="gd-x" onClick={onClose} aria-label="关闭">✕</button>
        <Diagram />
      </div>
    </div>
  )
}
