import ReactMarkdown from 'react-markdown';

const markdownComponents = {
  h1: ({ children }) => <div style={{ fontWeight: 700, fontSize: 16, margin: '6px 0 2px' }}>{children}</div>,
  h2: ({ children }) => <div style={{ fontWeight: 700, fontSize: 14, margin: '6px 0 2px' }}>{children}</div>,
  h3: ({ children }) => <div style={{ fontWeight: 700, fontSize: 13, margin: '6px 0 2px' }}>{children}</div>,
  p: ({ children }) => <div style={{ margin: '1px 0' }}>{children}</div>,
  ul: ({ children }) => <div style={{ margin: '1px 0' }}>{children}</div>,
  ol: ({ children }) => <div style={{ margin: '1px 0' }}>{children}</div>,
  li: ({ children }) => (
    <div style={{ display: 'flex', gap: 6, margin: '1px 0' }}>
      <span style={{ flexShrink: 0 }}>•</span>
      <span>{children}</span>
    </div>
  ),
  pre: ({ children }) => (
    <pre style={{
      background: '#1f2937', color: '#e5e7eb', padding: '8px 12px',
      borderRadius: 6, fontSize: 12, overflowX: 'auto', margin: '4px 0',
      fontFamily: 'ui-monospace, monospace', lineHeight: 1.5,
    }}>
      {children}
    </pre>
  ),
  code: ({ children, className, node }) => {
    const isBlock = Boolean(className) ||
      (node?.position && node.position.start.line !== node.position.end.line);
    if (isBlock) return <code className={className}>{children}</code>;
    return (
      <code style={{
        background: '#e5e7eb', padding: '1px 5px', borderRadius: 3,
        fontSize: '0.9em', fontFamily: 'ui-monospace, monospace',
      }}>
        {children}
      </code>
    );
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
       style={{ color: 'inherit', textDecoration: 'underline' }}>
      {children}
    </a>
  ),
  table: ({ children }) => (
    <table style={{ borderCollapse: 'collapse', margin: '8px 0', fontSize: 12, width: '100%' }}>
      {children}
    </table>
  ),
  th: ({ children, style }) => (
    <th style={{
      border: '1px solid #d1d5db', padding: '6px 8px',
      background: '#f9fafb', fontWeight: 600,
      textAlign: style?.textAlign || 'left',
    }}>
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={{
      border: '1px solid #d1d5db', padding: '6px 8px',
      textAlign: style?.textAlign || 'left',
    }}>
      {children}
    </td>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />,
  blockquote: ({ children }) => (
    <div style={{ borderLeft: '3px solid #d1d5db', paddingLeft: 10, margin: '4px 0', color: '#6b7280' }}>
      {children}
    </div>
  ),
};

export const renderReactMarkdown = (text) => {
  if (!text) return null;
  return <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>;
};
