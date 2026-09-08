/**
 * 舞台：布隆过滤器 —— m 位 bit 数组，插入点亮 k 位，查询看 k 位是否全 1
 *
 * 2026-09-08 补了**最要紧的那一块**。用户：「实验区没有说单词怎么映射到位图的索引位置」。
 * 原来屏幕上只有一句「哈希到 3 个位 [4, 11, 19]」—— 那三个数是这个实验唯一的机关
 * （假阳性就是"两个词恰好撞到同几个位"），却从天上掉下来。
 * 现在把 `word → 揉成一个整数 → mod m → 位号` 一行行摊出来，能对着算。
 */
import type { BloomState } from '@engine/kernels/bloom.ts'
import type { StageProps } from '../types.ts'

export function BloomStage({ state }: StageProps<BloomState>) {
  const { m, k, bits, op, word, idx, hashes, verdict, falsePositive, members, phase } = state
  const touched = new Set(idx)
  return (
    <div className="card">
      <h3>布隆过滤器 <span className="hint">一点点空间，换"绝不漏报、极少误报"</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{m}</span><span className="scdl">bit 位数 m</span></div>
          <div className="scdk"><span className="scdn">{k}</span><span className="scdl">哈希个数 k</span></div>
          <div className="scdk"><span className="scdn">{members.join(' ')}</span><span className="scdl">已插入</span></div>
        </div>

        {/* 单词 → 位号：这一屏的机关就在这三行上 */}
        {hashes.length > 0 && (
          <div className="blmhash">
            <div className="blmhh">
              <b>{word}</b> 怎么变成 {k} 个位号：每个哈希从自己的<b>种子</b>出发，
              把单词一个字符一个字符揉进去（<code>x ← x×31 + 字符码</code>），最后对 m={m} 取余
            </div>
            {hashes.map((h, j) => (
              <div key={j} className="blmhr">
                <span className="blmhk">h{'₁₂₃₄₅'[j] ?? j + 1}</span>
                <span className="blmhs">种子 0x{h.seed.toString(16)}</span>
                <span className="blmha">揉完 = {h.raw.toLocaleString('en-US')}</span>
                <span className="blmhm">mod {m}</span>
                <span className={`blmhp ${op === 'add' ? 'add' : 'probe'}`}>位 {h.pos}</span>
              </div>
            ))}
          </div>
        )}

        {/* bit 数组 */}
        <div className="blmwrap">
          <div className="blmbits">
            {/*  位号印在格子上：上面刚算出「位 20」，得能一眼找到它是哪一格，
                 不然那条推算链到最后一步又断了。 */}
            {bits.map((b, i) => (
              <div key={i} className={`blmbit ${b ? 'on' : ''} ${touched.has(i) ? (op === 'add' ? 'add' : 'probe') : ''}`}>
                <i className="blmno-i">{i}</i>{b ? 1 : 0}
              </div>
            ))}
          </div>
          <div className="orcap">
            {op === 'add' && <span>插入 <b>{word}</b>：点亮 3 个位 [{idx.join(', ')}]</span>}
            {op === 'query' && <span>查询 <b>{word}</b>：看位 [{idx.join(', ')}] → <b className={falsePositive ? 'blmfp' : verdict === '可能在' ? 'blmyes' : 'blmno'}>{verdict}</b>{falsePositive && ' ← 假阳性！'}</span>}
            {op === '' && phase !== 'done' && <span>按「下一步」开始插入</span>}
            {phase === 'done' && <span>查完了：<b>有位是 0→一定不在</b>；<b>全是 1→可能在</b>（可能真在，也可能撞位假阳性）</span>}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote"><b>绝不漏报、可能误报</b>：任何插过的词，它的 k 位都被置过 1，查询必然"可能在"——所以<b>不会漏报</b>；但没插过的词也可能三位恰好都被别人点亮(如 owl 撞了 dog)，造成<b>假阳性</b>。用 {m} 个 bit 换极快判断，假阳性率≈(1−e^(−kn/m))^k，位越多/元素越少越低。缓存前置、爬虫去重、数据库防穿透都靠它。</p>
          : (op === 'query'
            ? <p className="scnote" style={{ opacity: .85 }}>{verdict === '一定不在' ? '有一位是 0——插过就会把它置 1，所以这词一定没插过（绝不漏报）。' : falsePositive ? '三位全是 1，但这词没插过——被别的词撞亮了，这就是假阳性。' : '三位全是 1，确实插过 ✓。'}</p>
            : <p className="scnote" style={{ opacity: .85 }}>插入 = 把 k 个哈希位全置 1。插完再查，就靠"这几位是不是全 1"来判断。</p>)}
      </div>
    </div>
  )
}
