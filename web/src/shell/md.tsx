/**
 * 轻量 markdown 渲染 —— 全站共用一份(AI 学伴长文、实验控制的 paramsNote 等)。
 * mdInline：行内 **粗** / `码` / *斜*。Md：块级 段落 / #小标题 / 有序·无序列表 + 行内。
 * 不走 innerHTML(一部分文本来自 AI 起草,不给标签插进 DOM 的路)。
 */
import type { ReactNode } from 'react'

export function mdInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|(?<![*\w])\*([^*\n]+)\*(?![*\w]))/g
  let last = 0, m: RegExpExecArray | null, k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[2] != null) nodes.push(<strong key={k++}>{m[2]}</strong>)
    else if (m[3] != null) nodes.push(<code key={k++} className="aic-code">{m[3]}</code>)
    else nodes.push(<em key={k++}>{m[4]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Md({ text, className = 'aic-md' }: { text: string; className?: string }) {
  const lines = (text ?? '').replace(/\r/g, '').split('\n')
  const out: ReactNode[] = []
  let para: string[] = []; let key = 0
  const flush = () => { if (para.length) { const p = para; out.push(<p key={key++}>{p.map((l, j) => <span key={j}>{j > 0 && <br />}{mdInline(l)}</span>)}</p>); para = [] } }
  for (let i = 0; i < lines.length;) {
    const line = lines[i]!
    if (!line.trim()) { flush(); i++; continue }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) { flush(); out.push(<p key={key++} className="aic-md-h">{mdInline(h[2]!)}</p>); i++; continue }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush(); const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*\d+[.)]\s+/, ''))
      out.push(<ol key={key++}>{items.map((t, j) => <li key={j}>{mdInline(t)}</li>)}</ol>); continue
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      flush(); const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*[-*+]\s+/, ''))
      out.push(<ul key={key++}>{items.map((t, j) => <li key={j}>{mdInline(t)}</li>)}</ul>); continue
    }
    para.push(line); i++
  }
  flush()
  return <div className={className}>{out}</div>
}
