import React from 'react';

interface MarkdownViewProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'bold_italic' | 'code' | 'link' | 'del';
  value?: string;
  text?: string;
  url?: string;
}

// Tokenizes inline elements: bold, italic, inline code, links, strikethrough
function tokenizeInline(text: string): InlineToken[] {
  // 1. code: `code`
  // 2. link: [text](url)
  // 3. bold+italic: ***text*** or ___text___
  // 4. bold: **text** or __text__
  // 5. italic: *text* or _text_
  // 6. strikethrough: ~~text~~
  const regex = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*\*[^*]+\*\*\*|___[^_]+___)|(\*\*[^*]+\*\*|__[^_]+__)|((?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_))|(~~[^~]+~~)/g;

  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.substring(lastIndex, match.index) });
    }
    const full = match[0];
    if (match[1]) {
      tokens.push({ type: 'code', value: full.slice(1, -1) });
    } else if (match[2]) {
      const linkMatch = full.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      tokens.push({
        type: 'link',
        text: linkMatch ? linkMatch[1] : full,
        url: linkMatch ? linkMatch[2] : '',
      });
    } else if (match[3]) {
      tokens.push({ type: 'bold_italic', value: full.slice(3, -3) });
    } else if (match[4]) {
      tokens.push({ type: 'bold', value: full.slice(2, -2) });
    } else if (match[5]) {
      tokens.push({ type: 'italic', value: full.slice(1, -1) });
    } else if (match[6]) {
      tokens.push({ type: 'del', value: full.slice(2, -2) });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.substring(lastIndex) });
  }

  return tokens;
}

function renderInline(text: string): React.ReactNode {
  const tokens = tokenizeInline(text);
  return tokens.map((token, idx) => {
    switch (token.type) {
      case 'bold':
        return (
          <strong key={idx} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            {token.value}
          </strong>
        );
      case 'italic':
        return (
          <em key={idx} style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>
            {token.value}
          </em>
        );
      case 'bold_italic':
        return (
          <strong key={idx} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            <em>{token.value}</em>
          </strong>
        );
      case 'code':
        return (
          <code
            key={idx}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '1px 5px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '0.88em',
              color: 'var(--color-gold, #f59e0b)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              whiteSpace: 'pre-wrap',
            }}
          >
            {token.value}
          </code>
        );
      case 'link':
        return (
          <a
            key={idx}
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-gold, #f59e0b)', textDecoration: 'underline' }}
          >
            {token.text}
          </a>
        );
      case 'del':
        return <del key={idx}>{token.value}</del>;
      case 'text':
      default:
        return token.value;
    }
  });
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'hr' }
  | { type: 'code'; lang?: string; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'paragraph'; text: string };

function parseBlocks(rawText: string): Block[] {
  if (!rawText) return [];
  const lines = rawText.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced Code Block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing fence
      blocks.push({ type: 'code', lang, text: codeLines.join('\n') });
      continue;
    }

    // Horizontal Rule: ---, ***, ___
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Headings: #, ##, ###, ####, #####, ######
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // Blockquote: > quote
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('>') || (quoteLines.length && lines[i].trim()))) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    // Markdown Table: lines starting and ending with |
    if (line.trim().startsWith('|') && line.trim().endsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const rawHeaders = line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((h) => h.trim());
      i += 2; // skip header and delimiter row
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        rows.push(
          lines[i]
            .trim()
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        );
        i++;
      }
      blocks.push({ type: 'table', headers: rawHeaders, rows });
      continue;
    }

    // Unordered List (*, -, +)
    if (/^\s*[*+-]\s+/.test(line)) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (/^\s*[*+-]\s+/.test(lines[i]) ||
          (items.length > 0 &&
            lines[i].trim() &&
            !lines[i].startsWith('#') &&
            !/^(\s*[-*_]\s*){3,}$/.test(lines[i])))
      ) {
        const itemMatch = lines[i].match(/^\s*[*+-]\s+(.*)$/);
        if (itemMatch) {
          items.push(itemMatch[1]);
        } else {
          // continuation of previous bullet
          items[items.length - 1] += ' ' + lines[i].trim();
        }
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered List (1., 2., etc.)
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (/^\s*\d+\.\s+/.test(lines[i]) ||
          (items.length > 0 &&
            lines[i].trim() &&
            !lines[i].startsWith('#') &&
            !/^(\s*[-*_]\s*){3,}$/.test(lines[i])))
      ) {
        const itemMatch = lines[i].match(/^\s*\d+\.\s+(.*)$/);
        if (itemMatch) {
          items.push(itemMatch[1]);
        } else {
          items[items.length - 1] += ' ' + lines[i].trim();
        }
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Normal Paragraph (collect contiguous text lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].match(/^#{1,6}\s+/) &&
      !/^(\s*[-*_]\s*){3,}$/.test(lines[i]) &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*[*+-]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|'))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      blocks.push({ type: 'paragraph', text: paraLines.join('\n') });
    }
  }

  return blocks;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className, style }) => {
  if (!content) return null;
  const blocks = parseBlocks(content);

  return (
    <div
      className={`markdown-content ${className || ''}`}
      style={{
        lineHeight: 1.6,
        color: 'var(--text-primary)',
        fontSize: '0.86rem',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        minWidth: 0,
        ...style,
      }}
    >
      {blocks.map((b, idx) => {
        switch (b.type) {
          case 'heading': {
            const headingStyles: Record<number, React.CSSProperties> = {
              1: { fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-gold, #f59e0b)', margin: '14px 0 6px 0', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', overflowWrap: 'anywhere', wordBreak: 'break-word' },
              2: { fontSize: '1.12rem', fontWeight: 700, color: 'var(--color-gold, #f59e0b)', margin: '12px 0 5px 0', overflowWrap: 'anywhere', wordBreak: 'break-word' },
              3: { fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-gold, #fbbf24)', margin: '10px 0 4px 0', overflowWrap: 'anywhere', wordBreak: 'break-word' },
              4: { fontSize: '0.94rem', fontWeight: 600, color: 'var(--text-primary)', margin: '8px 0 3px 0', overflowWrap: 'anywhere', wordBreak: 'break-word' },
              5: { fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', margin: '6px 0 2px 0', overflowWrap: 'anywhere', wordBreak: 'break-word' },
              6: { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', margin: '6px 0 2px 0', overflowWrap: 'anywhere', wordBreak: 'break-word' },
            };
            const headingContent = renderInline(b.text);
            const hStyle = headingStyles[b.level] || headingStyles[3];
            if (b.level === 1) return <h1 key={idx} style={hStyle}>{headingContent}</h1>;
            if (b.level === 2) return <h2 key={idx} style={hStyle}>{headingContent}</h2>;
            if (b.level === 3) return <h3 key={idx} style={hStyle}>{headingContent}</h3>;
            if (b.level === 4) return <h4 key={idx} style={hStyle}>{headingContent}</h4>;
            if (b.level === 5) return <h5 key={idx} style={hStyle}>{headingContent}</h5>;
            return <h6 key={idx} style={hStyle}>{headingContent}</h6>;
          }

          case 'hr':
            return (
              <hr
                key={idx}
                style={{
                  border: 0,
                  borderTop: '1px solid var(--border-medium, rgba(255,255,255,0.12))',
                  margin: '12px 0',
                }}
              />
            );

          case 'code':
            return (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-card, #0e121b)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  margin: '8px 0',
                  overflowX: 'auto',
                }}
              >
                {b.lang && (
                  <div
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--text-muted, #94a3b8)',
                      textTransform: 'uppercase',
                      marginBottom: '4px',
                      fontWeight: 600,
                    }}
                  >
                    {b.lang}
                  </div>
                )}
                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.5, color: '#e2e8f0' }}>
                  <code>{b.text}</code>
                </pre>
              </div>
            );

          case 'blockquote':
            return (
              <blockquote
                key={idx}
                style={{
                  borderLeft: '3px solid var(--color-gold, #f59e0b)',
                  paddingLeft: '12px',
                  margin: '8px 0',
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                  background: 'rgba(245, 158, 11, 0.04)',
                  padding: '6px 12px',
                  borderRadius: '0 6px 6px 0',
                }}
              >
                {renderInline(b.text)}
              </blockquote>
            );

          case 'ul':
            return (
              <ul
                key={idx}
                style={{
                  margin: '6px 0 10px 0',
                  paddingLeft: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: 0,
                }}
              >
                {b.items.map((item, itemIdx) => {
                  const taskMatch = item.match(/^\[([ xX])\]\s*(.*)$/);
                  if (taskMatch) {
                    const isChecked = taskMatch[1].toLowerCase() === 'x';
                    const taskText = taskMatch[2];
                    return (
                      <li
                        key={itemIdx}
                        style={{
                          listStyleType: 'none',
                          marginLeft: '-18px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          lineHeight: 1.55,
                          minWidth: 0,
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '18px',
                            height: '18px',
                            marginTop: '2px',
                            flexShrink: 0,
                            borderRadius: '4px',
                            border: isChecked ? '1px solid #10b981' : '1px solid var(--border-medium, rgba(255,255,255,0.25))',
                            background: isChecked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.04)',
                            color: isChecked ? '#10b981' : 'transparent',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                          }}
                        >
                          {isChecked ? '✓' : ''}
                        </span>
                        <span style={{ textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.75 : 1 }}>
                          {renderInline(taskText)}
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={itemIdx} style={{ lineHeight: 1.55, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      {renderInline(item)}
                    </li>
                  );
                })}
              </ul>
            );

          case 'ol':
            return (
              <ol
                key={idx}
                style={{
                  margin: '6px 0 10px 0',
                  paddingLeft: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: 0,
                }}
              >
                {b.items.map((item, itemIdx) => (
                  <li key={itemIdx} style={{ lineHeight: 1.55, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            );

          case 'table':
            return (
              <div
                key={idx}
                style={{
                  overflowX: 'auto',
                  margin: '10px 0',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-medium)' }}>
                      {b.headers.map((h, hIdx) => (
                        <th
                          key={hIdx}
                          style={{
                            padding: '6px 10px',
                            textAlign: 'left',
                            fontWeight: 600,
                            color: 'var(--color-gold)',
                          }}
                        >
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        style={{
                          borderBottom: rIdx < b.rows.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          background: rIdx % 2 === 1 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                        }}
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} style={{ padding: '6px 10px', color: 'var(--text-primary)' }}>
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'paragraph':
          default:
            return (
              <p
                key={idx}
                style={{
                  margin: '0 0 8px 0',
                  lineHeight: 1.6,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                {renderInline(b.text)}
              </p>
            );
        }
      })}
    </div>
  );
};

export default MarkdownView;
