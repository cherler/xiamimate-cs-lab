/**
 * 驱动序列编辑器 —— 访问序列 / 引用串 / 请求队列 / 待排序数组。
 *
 * 为什么它比参数面板更重要：
 * 参数只能换算法、换块数，**换不了题面数据**。而学生手里的题目千变万化的正是这串数字。
 *
 * 两条设计纪律：
 *   1. 解析结果必须**回显**。学生输入 `10`，在十六进制下是 16 —— 不回显就会静默算错题。
 *   2. 解析失败时**不改仿真**，明说"仿真仍是上一次有效的序列"。
 *      悄悄用半截数据跑出来的结果，比报错糟得多。
 */
import type { SequenceSpec } from '../types.ts'

/** 分隔符一律宽容：空格、换行、中英文逗号、顿号、分号 */
const SPLIT = /[\s,，、;；]+/

export type ParseResult =
  | { ok: true; values: number[] }
  | { ok: false; message: string }

export function parseSequence(text: string, spec: SequenceSpec): ParseResult {
  const toks = text.trim().split(SPLIT).filter(Boolean)
  if (toks.length === 0) return { ok: false, message: '序列不能为空' }
  if (spec.maxLength && toks.length > spec.maxLength)
    return { ok: false, message: `最多 ${spec.maxLength} 项，当前 ${toks.length} 项` }

  const values: number[] = []
  for (const [i, t] of toks.entries()) {
    const real = spec.value === 'real'
    const raw = spec.radix === 16 ? t.replace(/^0[xX]/, '') : t
    const v = spec.radix === 16 ? parseInt(raw, 16) : Number(raw)
    const shaped = spec.radix === 16
      ? /^[0-9a-fA-F]+$/.test(raw)
      : real
        //  小数、负号、科学计数法都收 —— 浮点实验要能打进 0.1 和 -12.5
        ? /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(raw)
        : /^-?\d+$/.test(raw)
    if (!shaped || !Number.isFinite(v))
      return { ok: false,
        message: `第 ${i + 1} 项「${t}」不是合法的${spec.radix === 16 ? '十六进制数' : real ? '数' : '整数'}` }
    //  只有非负那一档才拦负号；`'real'` 那一档负数是题面的一部分（−12.5）
    if (!real && v < 0) return { ok: false, message: `第 ${i + 1} 项「${t}」不能为负` }
    values.push(v)
  }
  return { ok: true, values }
}

export const formatSequence = (values: (number | string)[], spec: SequenceSpec) =>
  values.map(v => (spec.radix === 16 ? '0x' + Number(v).toString(16).toUpperCase() : String(v))).join(' ')

export function SequenceEditor({
  spec, text, onText, onReset, open, onToggle, index, onSeek,
}: {
  spec: SequenceSpec
  /** 输入框里的文本；解析通过时父组件会立刻把它喂给仿真 */
  text: string
  onText: (t: string) => void
  onReset: () => void
  /** 展开着没有；默认收起 —— 它是设置，不是内容 */
  open: boolean
  onToggle: () => void
  /** 走到第几项了（`spec.chips` 那一档才用得上） */
  index?: number
  onSeek?: (i: number) => void
}) {
  const parsed = parseSequence(text, spec)
  const chips = !!spec.chips && parsed.ok

  return (
    <div className={`card seq ${parsed.ok ? '' : 'bad'}${open ? '' : ' shut'}${chips ? ' chipseq' : ''}`}>
      <h3>
        {spec.label}
        {/*
          * ⚠️ 概览行上**只说项数**。
          *
          * 进制怎么写、这串数是什么单位，是**要改它的人**才需要知道的；
          * 不改的人这几句一个字都用不上，而它们正好横在标题和数据之间。
          * 用户原话：「上层不需要『12 项 · 十六进制，0x 前缀可省 ·
          * 按字节编址的主存地址』」。两句都挪进展开后的编辑器里了。
          */}
        <span className="hint">{parsed.ok ? `（共 ${parsed.values.length} 项）` : '解析失败'}</span>
        <button className="fold" onClick={onToggle}
                aria-expanded={open}>{open ? '收起 ▲' : '展开改 ▼'}</button>
      </h3>
      {/*
        收起时**仍然把序列本身印出来**。
        原来只留一行"8 项 · 磁道号，须在 0..最大磁道 之间" —— 题面当场消失了。
        对磁盘调度、页面置换这些实验，**这串数不是设置，是题面**：
        FCFS 完全由顺序决定，看不见顺序就没法想。
        "编辑器是设置不是内容"那条原则我推得太宽了 —— 该藏的是**编辑手段**，不是值。
      */}
      {!open && (chips
        /*
          * **格子**：每一项一格，走到哪一格就亮哪一格，点一下跳到那一步。
          * 一行 `0x0 → 0x10 → …` 的箭头文字这两件事都干不了 ——
          * 它只是把数据念了一遍，而这串数每一项都对应轨迹上的一步。
          */
        ? <div className="seqchips" role="group" aria-label={spec.label}>
            {parsed.values.map((v, i) => (
              <button key={i} type="button"
                      className={i === index ? 'on' : ''}
                      aria-current={i === index}
                      onClick={() => onSeek?.(i)}
                      title={`第 ${i + 1} 项 · 跳到这一步`}>
                {spec.radix === 16 ? '0x' + v.toString(16).toUpperCase() : String(v)}
              </button>
            ))}
          </div>
        : <p className="seqpeek" title={text}>
            {parsed.ok
              ? formatSequence(parsed.values, spec).split(/\s+/).join(' → ')
              : text.trim() || '（空）'}
          </p>
      )}
      <div className="body">
        {/*  进制约定与单位说明住在这儿 —— 谁要改它谁才看得见 */}
        {(spec.radix === 16 || spec.hint) && (
          <p className="seqhow">
            {spec.radix === 16 ? '十六进制，0x 前缀可省' : ''}
            {spec.radix === 16 && spec.hint ? ' · ' : ''}
            {spec.hint ?? ''}
          </p>
        )}
        <textarea
          className="seqin"
          value={text}
          spellCheck={false}
          rows={2}
          aria-label={`${spec.label}，用空格或逗号分隔`}
          onChange={e => onText(e.target.value)}
        />

        {parsed.ok ? (
          /*
           * 回显：学生输入 10，十六进制下是 16 —— 不回显就会静默算错题。
           * 但归一化后跟原文一字不差时就别显示了：输入框自己已经是回显，再来一行纯属噪音。
           */
          formatSequence(parsed.values, spec) !== text.trim() ? (
            <p className="seqecho">
              <span className="k">解析为</span>
              {parsed.values.map((v, i) => (
                <span key={i}>{spec.radix === 16 ? '0x' + v.toString(16).toUpperCase() : v}</span>
              ))}
            </p>
          ) : null
        ) : (
          <p className="seqerr">
            {parsed.message}
            <em>—— 仿真仍是上一次有效的序列</em>
          </p>
        )}

        <div className="seqacts">
          {spec.presets?.length ? (
            <>
              <span className="k">预置</span>
              {/*
                预置从"一颗药丸按钮"改成卡片：**标题 + 一句要点**。
                那句要点（`Preset.note`）本来就有，而且 `presets-claims.test.ts` 逐条验过它 ——
                之前只写在 `title=` 属性里，要悬停才看得见，手机上根本看不见。
                这是白捡的：数据、判据都现成，缺的只是渲染。
              */}
              {spec.presets.map(p => (
                <button key={p.label} className="pcard" data-preset={p.label}
                        onClick={() => onText(formatSequence(p.values, spec))}>
                  <b>{p.label}</b>
                  <span>{p.note}</span>
                </button>
              ))}
            </>
          ) : null}
          {spec.random ? (
            <button className="ghost" onClick={() => onText(formatSequence(spec.random!(), spec))}>随机</button>
          ) : null}
          <button className="ghost" onClick={onReset}>恢复默认</button>
        </div>
      </div>
    </div>
  )
}
