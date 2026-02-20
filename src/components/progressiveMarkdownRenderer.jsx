import React from 'react';

const styles = {
  h1: { fontWeight: 700, fontSize: 16, margin: '6px 0 2px' },
  h2: { fontWeight: 700, fontSize: 14, margin: '6px 0 2px' },
  h3: { fontWeight: 700, fontSize: 13, margin: '6px 0 2px' },
  p: { margin: '1px 0' },
  listRow: { display: 'flex', gap: 6, margin: '1px 0' },
  listMarker: { flexShrink: 0 },
  pre: {
    background: '#1f2937', color: '#e5e7eb', padding: '8px 12px',
    borderRadius: 6, fontSize: 12, overflowX: 'auto', margin: '4px 0',
    fontFamily: 'ui-monospace, monospace', lineHeight: 1.5,
  },
  inlineCode: {
    background: '#e5e7eb', padding: '1px 5px', borderRadius: 3,
    fontSize: '0.9em', fontFamily: 'ui-monospace, monospace',
  },
  link: { color: 'inherit', textDecoration: 'underline' },
  table: { borderCollapse: 'collapse', margin: '8px 0', fontSize: 12, width: '100%' },
  th: { border: '1px solid #d1d5db', padding: '6px 8px', background: '#f9fafb', fontWeight: 600 },
  td: { border: '1px solid #d1d5db', padding: '6px 8px' },
  hr: { border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' },
  blockquote: { borderLeft: '3px solid #d1d5db', paddingLeft: 10, margin: '4px 0', color: '#6b7280' },
};

const isHr = (line) => /^\s*(?:---|\*\*\*|___)\s*$/.test(line);
const isTableLine = (line) => /^\|(.+)\|$/.test(line);
const isTableSeparator = (line) => /^\|[\s\-\|:]+\|$/.test(line);

const processTextWithInlineCode = (text, keyState) => {
  const source = String(text ?? '');
  const parts = [];
  const codeRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push(source.slice(lastIndex, match.index));
    }
    parts.push(
      <code key={`c${keyState.current++}`} style={styles.inlineCode}>
        {match[1]}
      </code>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < source.length) {
    parts.push(source.slice(lastIndex));
  }

  return parts;
};

const renderInline = (text, keyState) => {
  const source = String(text ?? '');
  const parts = [];
  const formatRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = formatRegex.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...processTextWithInlineCode(source.slice(lastIndex, match.index), keyState));
    }

    if (match[2]) {
      parts.push(
        <strong key={`b${keyState.current++}`}>
          {processTextWithInlineCode(match[2], keyState)}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <em key={`i${keyState.current++}`}>
          {processTextWithInlineCode(match[3], keyState)}
        </em>
      );
    } else if (match[4] && match[5]) {
      parts.push(
        <a
          key={`a${keyState.current++}`}
          href={match[5]}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          {processTextWithInlineCode(match[4], keyState)}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < source.length) {
    parts.push(...processTextWithInlineCode(source.slice(lastIndex), keyState));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
};

const parseTable = (lines, startIdx, keyState) => {
  if (!isTableLine(lines[startIdx]) || !isTableSeparator(lines[startIdx + 1] ?? '')) {
    return null;
  }

  const split = (line) => line.split('|').slice(1, -1).map((cell) => cell.trim());
  const headerRow = split(lines[startIdx]);
  const separatorRow = split(lines[startIdx + 1]);
  if (!headerRow.length || separatorRow.length !== headerRow.length) {
    return null;
  }

  const alignments = separatorRow.map((cell) => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
    if (cell.endsWith(':')) return 'right';
    return 'left';
  });

  const rows = [];
  let i = startIdx + 2;
  while (i < lines.length && isTableLine(lines[i])) {
    rows.push(split(lines[i]));
    i += 1;
  }

  return {
    nextIdx: i,
    element: (
      <table key={`tbl${keyState.current++}`} style={styles.table}>
        <thead>
          <tr>
            {headerRow.map((cell, idx) => (
              <th key={idx} style={{ ...styles.th, textAlign: alignments[idx] || 'left' }}>
                {renderInline(cell, keyState)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {headerRow.map((_, cIdx) => (
                <td key={cIdx} style={{ ...styles.td, textAlign: alignments[cIdx] || 'left' }}>
                  {renderInline(row[cIdx] ?? '', keyState)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
  };
};

export const renderProgressiveMarkdown = (text) => {
  if (!text) return null;

  try {
    const source = String(text);
    const lines = source.split('\n');
    const elements = [];
    const keyState = { current: 0 };

    for (let i = 0; i < lines.length;) {
      const line = lines[i] ?? '';

      if (line.startsWith('```')) {
        const codeLines = [];
        const lang = line.slice(3).trim();
        i += 1;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i += 1;
        }
        if (i < lines.length && lines[i].startsWith('```')) i += 1;
        elements.push(
          <pre key={`pre${keyState.current++}`} style={styles.pre}>
            <code className={lang ? `language-${lang}` : undefined}>{codeLines.join('\n')}</code>
          </pre>
        );
        continue;
      }

      const table = parseTable(lines, i, keyState);
      if (table) {
        elements.push(table.element);
        i = table.nextIdx;
        continue;
      }

      const header = line.match(/^(#{1,3})\s+(.+)/);
      if (header) {
        const level = header[1].length;
        const style = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3;
        elements.push(
          <div key={`h${keyState.current++}`} style={style}>
            {renderInline(header[2], keyState)}
          </div>
        );
        i += 1;
        continue;
      }

      if (isHr(line)) {
        elements.push(<hr key={`hr${keyState.current++}`} style={styles.hr} />);
        i += 1;
        continue;
      }

      const quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        elements.push(
          <div key={`q${keyState.current++}`} style={styles.blockquote}>
            {renderInline(quote[1], keyState)}
          </div>
        );
        i += 1;
        continue;
      }

      const ul = line.match(/^[\s]*[-*]\s+(.+)/);
      if (ul) {
        elements.push(
          <div key={`ul${keyState.current++}`} style={styles.listRow}>
            <span style={styles.listMarker}>•</span>
            <span>{renderInline(ul[1], keyState)}</span>
          </div>
        );
        i += 1;
        continue;
      }

      const ol = line.match(/^[\s]*(\d+)[.)]\s+(.+)/);
      if (ol) {
        elements.push(
          <div key={`ol${keyState.current++}`} style={styles.listRow}>
            <span style={styles.listMarker}>{ol[1]}.</span>
            <span>{renderInline(ol[2], keyState)}</span>
          </div>
        );
        i += 1;
        continue;
      }

      if (!line.trim()) {
        i += 1;
        continue;
      }

      elements.push(
        <div key={`p${keyState.current++}`} style={styles.p}>
          {renderInline(line, keyState)}
        </div>
      );
      i += 1;
    }

    return elements;
  } catch {
    return <div style={styles.p}>{String(text ?? '')}</div>;
  }
};

export default renderProgressiveMarkdown;
