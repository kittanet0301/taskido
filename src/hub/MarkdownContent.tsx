import type { ReactNode } from 'react'

interface Block {
  type: 'heading' | 'paragraph' | 'code' | 'hr' | 'blockquote' | 'ul' | 'ol' | 'table'
  level?: number
  text?: string
  lang?: string
  code?: string
  items?: string[]
  headers?: string[]
  rows?: string[][]
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:-]+\|[\s|:-]+\|?$/.test(line.trim())
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim() || undefined
      i += 1
      const codeLines: string[] = []
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      if (i < lines.length) i += 1
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') })
      continue
    }

    if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i += 1
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2]
      })
      i += 1
      continue
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join(' ') })
      continue
    }

    if (trimmed.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i += 1
      }
      const dataLines = tableLines.filter((row) => !isTableSeparator(row))
      if (dataLines.length > 0) {
        blocks.push({
          type: 'table',
          headers: parseTableRow(dataLines[0]),
          rows: dataLines.slice(1).map(parseTableRow)
        })
      }
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i += 1
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i += 1
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    const paragraphLines: string[] = []
    while (i < lines.length) {
      const current = lines[i].trim()
      if (!current) break
      if (
        current.startsWith('```') ||
        /^-{3,}$/.test(current) ||
        /^#{1,4}\s+/.test(current) ||
        current.startsWith('>') ||
        current.startsWith('|') ||
        /^[-*]\s+/.test(current) ||
        /^\d+\.\s+/.test(current)
      ) {
        break
      }
      paragraphLines.push(current)
      i += 1
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') })
  }

  return blocks
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-code-${match.index}`} className="markdown-inline-code">
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${match.index}`}>{token.slice(2, -2)}</strong>
      )
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        nodes.push(
          <a
            key={`${keyPrefix}-link-${match.index}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer noopener"
          >
            {linkMatch[1]}
          </a>
        )
      } else {
        nodes.push(token)
      }
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : [text]
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = (`h${block.level ?? 2}` as 'h1' | 'h2' | 'h3' | 'h4')
      return (
        <Tag key={index} className={`markdown-heading markdown-heading--h${block.level ?? 2}`}>
          {renderInline(block.text ?? '', `h-${index}`)}
        </Tag>
      )
    }
    case 'paragraph':
      return (
        <p key={index} className="markdown-paragraph">
          {renderInline(block.text ?? '', `p-${index}`)}
        </p>
      )
    case 'code':
      return (
        <pre key={index} className="markdown-pre">
          {block.lang && <span className="markdown-code-lang">{block.lang}</span>}
          <code>{block.code}</code>
        </pre>
      )
    case 'hr':
      return <hr key={index} className="markdown-hr" />
    case 'blockquote':
      return (
        <blockquote key={index} className="markdown-blockquote">
          {renderInline(block.text ?? '', `q-${index}`)}
        </blockquote>
      )
    case 'ul':
      return (
        <ul key={index} className="markdown-list">
          {block.items?.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `ul-${index}-${itemIndex}`)}</li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol key={index} className="markdown-list markdown-list--ordered">
          {block.items?.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `ol-${index}-${itemIndex}`)}</li>
          ))}
        </ol>
      )
    case 'table':
      return (
        <div key={index} className="markdown-table-wrap">
          <table className="markdown-table">
            <thead>
              <tr>
                {block.headers?.map((header, headerIndex) => (
                  <th key={headerIndex}>{renderInline(header, `th-${index}-${headerIndex}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows?.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{renderInline(cell, `td-${index}-${rowIndex}-${cellIndex}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return null
  }
}

interface Props {
  source: string
  className?: string
}

export function MarkdownContent({ source, className }: Props) {
  const blocks = parseBlocks(source)

  return (
    <article className={['markdown-content', className].filter(Boolean).join(' ')}>
      {blocks.map(renderBlock)}
    </article>
  )
}
