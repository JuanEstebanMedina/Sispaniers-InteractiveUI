import type { ReactNode } from 'react'

export function Markdown({ body }: { body: string }) {
  return (
    <div className="space-y-1 whitespace-pre-wrap break-words">
      {body.split('\n').map((line, index) => {
        const heading = line.match(/^(#{1,3})\s+(.+)$/)
        const listItem = line.match(/^[-*+]\s+(.+)$/)
        const orderedItem = line.match(/^\d+\.\s+(.+)$/)

        if (heading) return <p key={index} className="font-semibold text-fg"><InlineMarkdown text={heading[2]} /></p>
        if (listItem || orderedItem) return <p key={index}>• <InlineMarkdown text={(listItem ?? orderedItem)![1]} /></p>
        return <p key={index}><InlineMarkdown text={line} /></p>
      })}
    </div>
  )
}

export function InlineMarkdown({ text }: { text: string }) {
  return <>{inlineMarkdown(text)}</>
}

function inlineMarkdown(text: string): ReactNode[] {
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g
  const nodes: ReactNode[] = []
  let cursor = 0

  for (const match of text.matchAll(pattern)) {
    const [full, , label, href, code, bold, alternateBold, italic, alternateItalic] = match
    const index = match.index ?? 0
    if (index > cursor) nodes.push(text.slice(cursor, index))

    const key = `${index}-${full}`
    if (href) nodes.push(<a key={key} href={href} target="_blank" rel="noreferrer" className="text-brand underline">{label}</a>)
    else if (code) nodes.push(<code key={key} className="rounded bg-surface-raised px-1 font-mono">{code}</code>)
    else if (bold || alternateBold) nodes.push(<strong key={key}>{bold ?? alternateBold}</strong>)
    else nodes.push(<em key={key}>{italic ?? alternateItalic}</em>)
    cursor = index + full.length
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}
