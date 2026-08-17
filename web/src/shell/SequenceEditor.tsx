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
    const raw = spec.radix === 16 ? t.replace(/^0[xX]/, '') : t
    const v = spec.radix === 16 ? parseInt(raw, 16) : Number(raw)
    const shaped = spec.radix === 16
      ? /^[0-9a-fA-F]+$/.test(raw)
      : /^-?\d+$/.test(raw)
    if (!shaped || !Number.isFinite(v))
      return { ok: false, message: `第 ${i + 1} 项「${t}」不是合法的${spec.radix === 16 ? '十六进制数' : '整数'}` }
    if (v < 0) return { ok: false, message: `第 ${i + 1} 项「${t}」不能为负` }
    values.push(v)
  }
  return { ok: true, values }
}

export const formatSequence = (values: (number | string)[], spec: SequenceSpec) =>
  values.map(v => (spec.radix === 16 ? '0x' + Number(v).toString(16).toUpperCase() : String(v))).join(' ')

export function SequenceEditor({
  spec, text, onText, onReset,
}: {
  spec: SequenceSpec
  /** 输入框里的文本；解析通过时父组件会立刻把它喂给仿真 */
  text: string
  onText: (t: string) => void
  onReset: () => void
}) {
  const parsed = parseSequence(text, spec)

  return (
    <div className={`card seq ${parsed.ok ? '' : 'bad'}`}>
      <h3>
        {spec.label}
        <span className="hint">
          {parsed.ok ? `${parsed.values.length} 项` : '解析失败'}
          {spec.radix === 16 ? ' · 十六进制，0x 前缀可省' : ''}
          {spec.hint ? ` · ${spec.hint}` : ''}
        </span>
      </h3>
      <div className="body">
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
              {spec.presets.map(p => (
                <button key={p.label} title={p.note} onClick={() => onText(formatSequence(p.values, spec))}>
                  {p.label}
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
