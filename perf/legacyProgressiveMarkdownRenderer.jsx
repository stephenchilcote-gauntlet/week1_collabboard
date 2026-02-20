// Snapshot of the pre-react-markdown renderer from git history (kept intact for perf/regression comparisons).
export const renderLegacyMarkdown = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      elements.push(
        <pre key={elements.length} style={{
          background: '#1f2937', color: '#e5e7eb', padding: '8px 12px',
          borderRadius: 6, fontSize: 12, overflowX: 'auto', margin: '4px 0',
          fontFamily: 'ui-monospace, monospace', lineHeight: 1.5,
        }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const sizes = { 1: 16, 2: 14, 3: 13 };
      elements.push(
        <div key={elements.length} style={{ fontWeight: 700, fontSize: sizes[level], margin: '6px 0 2px' }}>
          {renderInline(headerMatch[2])}
        </div>
      );
      i += 1;
      continue;
    }

    const ulMatch = line.match(/^[\s]*[-*]\s+(.+)/);
    if (ulMatch) {
      elements.push(
        <div key={elements.length} style={{ display: 'flex', gap: 6, margin: '1px 0' }}>
          <span style={{ flexShrink: 0 }}>•</span>
          <span>{renderInline(ulMatch[1])}</span>
        </div>
      );
      i += 1;
      continue;
    }

    const olMatch = line.match(/^[\s]*(\d+)[.)]\s+(.+)/);
    if (olMatch) {
      elements.push(
        <div key={elements.length} style={{ display: 'flex', gap: 6, margin: '1px 0' }}>
          <span style={{ flexShrink: 0 }}>{olMatch[1]}.</span>
          <span>{renderInline(olMatch[2])}</span>
        </div>
      );
      i += 1;
      continue;
    }

    const tableMatch = line.match(/^\|(.+)\|$/);
    if (tableMatch) {
      let tableLines = [line];
      i += 1;

      if (i < lines.length && lines[i].match(/^\|[\s\-\|:]+\|$/)) {
        tableLines.push(lines[i]);
        i += 1;

        while (i < lines.length && lines[i].match(/^\|(.+)\|$/)) {
          tableLines.push(lines[i]);
          i += 1;
        }
      }

      const headerRow = tableLines[0].split('|').slice(1, -1).map(cell => cell.trim());
      const hasSeparator = tableLines.length > 1 && tableLines[1].match(/^\|[\s\-\|:]+\|$/);
      const dataRows = hasSeparator ? tableLines.slice(2) : tableLines.slice(1);

      const parsedDataRows = dataRows.map(row =>
        row.split('|').slice(1, -1).map(cell => cell.trim())
      );

      let alignments = [];
      if (hasSeparator) {
        const separatorCells = tableLines[1].split('|').slice(1, -1);
        alignments = separatorCells.map(cell => {
          if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
          if (cell.endsWith(':')) return 'right';
          return 'left';
        });
      }

      elements.push(
        <table key={elements.length} style={{ borderCollapse: 'collapse', margin: '8px 0', fontSize: 12, width: '100%' }}>
          <thead>
            <tr>
              {headerRow.map((cell, cellIndex) => (
                <th key={cellIndex} style={{
                  border: '1px solid #d1d5db',
                  padding: '6px 8px',
                  background: '#f9fafb',
                  fontWeight: 600,
                  textAlign: alignments[cellIndex] || 'left',
                }}>
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsedDataRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} style={{
                    border: '1px solid #d1d5db',
                    padding: '6px 8px',
                    textAlign: alignments[cellIndex] || 'left',
                  }}>
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    if (line.trim() === '') {
      elements.push(<div key={elements.length} style={{ height: 6 }} />);
      i += 1;
      continue;
    }

    elements.push(
      <div key={elements.length} style={{ margin: '1px 0' }}>
        {renderInline(line)}
      </div>
    );
    i += 1;
  }

  return elements;
};

const renderInline = (text) => {
  const parts = [];
  const formatRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = formatRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...processTextWithInlineCode(text.slice(lastIndex, match.index), parts.length));
    }

    if (match[2]) {
      parts.push(
        <strong key={`b${parts.length}`}>
          {processTextWithInlineCode(match[2], parts.length)}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <em key={`i${parts.length}`}>
          {processTextWithInlineCode(match[3], parts.length)}
        </em>
      );
    } else if (match[4] && match[5]) {
      parts.push(
        <a key={`a${parts.length}`} href={match[5]} target="_blank" rel="noopener noreferrer"
           style={{ color: 'inherit', textDecoration: 'underline' }}>
          {processTextWithInlineCode(match[4], parts.length)}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(...processTextWithInlineCode(text.slice(lastIndex), parts.length));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
};

const processTextWithInlineCode = (text, keyOffset) => {
  const parts = [];
  const codeRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <code key={`c${keyOffset + parts.length}`} style={{
        background: '#e5e7eb', padding: '1px 5px', borderRadius: 3,
        fontSize: '0.9em', fontFamily: 'ui-monospace, monospace',
      }}>
        {match[1]}
      </code>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : parts;
};
