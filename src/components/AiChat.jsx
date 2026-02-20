import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Lightweight markdown renderer — handles bold, italic, inline code, code blocks, headers, lists, links, tables
const renderMarkdown = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code blocks
    if (line.startsWith('```')) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing ```
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

    // Headers
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

    // Unordered list items
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

    // Ordered list items
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

    // Tables
    const tableMatch = line.match(/^\|(.+)\|$/);
    if (tableMatch) {
      const tableData = [];
      let tableLines = [line];
      i += 1;
      
      // Check if next line is separator (|---|---|)
      if (i < lines.length && lines[i].match(/^\|[\s\-\|:]+\|$/)) {
        tableLines.push(lines[i]);
        i += 1;
        
        // Collect remaining table rows
        while (i < lines.length && lines[i].match(/^\|(.+)\|$/)) {
          tableLines.push(lines[i]);
          i += 1;
        }
      }
      
      // Parse table data
      const headerRow = tableLines[0].split('|').slice(1, -1).map(cell => cell.trim());
      const hasSeparator = tableLines.length > 1 && tableLines[1].match(/^\|[\s\-\|:]+\|$/);
      const dataRows = hasSeparator ? tableLines.slice(2) : tableLines.slice(1);
      
      const parsedDataRows = dataRows.map(row => 
        row.split('|').slice(1, -1).map(cell => cell.trim())
      );
      
      // Determine column alignment from separator row
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
        <table key={elements.length} style={{
          borderCollapse: 'collapse',
          margin: '8px 0',
          fontSize: 12,
          width: '100%',
        }}>
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

    // Empty line = paragraph break
    if (line.trim() === '') {
      elements.push(<div key={elements.length} style={{ height: 6 }} />);
      i += 1;
      continue;
    }

    // Regular paragraph
    elements.push(
      <div key={elements.length} style={{ margin: '1px 0' }}>
        {renderInline(line)}
      </div>
    );
    i += 1;
  }

  return elements;
};

// Inline markdown: bold, italic, inline code, links
const renderInline = (text) => {
  const parts = [];
  // Process formatting first, then handle inline code within formatted segments
  const formatRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = formatRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...processTextWithInlineCode(text.slice(lastIndex, match.index), parts.length));
    }
    
    if (match[2]) {
      // Bold text - process inline code within it
      parts.push(
        <strong key={`b${parts.length}`}>
          {processTextWithInlineCode(match[2], parts.length)}
        </strong>
      );
    } else if (match[3]) {
      // Italic text - process inline code within it
      parts.push(
        <em key={`i${parts.length}`}>
          {processTextWithInlineCode(match[3], parts.length)}
        </em>
      );
    } else if (match[4] && match[5]) {
      // Links - process inline code within link text
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

// Helper function to process inline code within text segments
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

export default function AiChat({ onSubmit, isLoading, progress, onNewConversation, messages = [], conversationList = [], onLoadConversation, activeConversationId, streamingText = '', thinkingText = '', isThinking = false, subAgentThinkingText = '', subAgentOutputText = '', isSubAgentActive = false }) {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isToggleHovered, setIsToggleHovered] = useState(false);
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const [isNewHovered, setIsNewHovered] = useState(false);
  const [isHistoryHovered, setIsHistoryHovered] = useState(false);
  const [isSendHovered, setIsSendHovered] = useState(false);
  const [hoveredConvId, setHoveredConvId] = useState(null);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const thinkingScrollRef = useRef(null);
  const subAgentScrollRef = useRef(null);
  const [throttledThinking, setThrottledThinking] = useState('');
  const [throttledSubAgent, setThrottledSubAgent] = useState('');
  const thinkingTargetRef = useRef('');
  const subAgentTargetRef = useRef('');

  useEffect(() => { thinkingTargetRef.current = thinkingText; }, [thinkingText]);
  useEffect(() => { subAgentTargetRef.current = subAgentThinkingText + subAgentOutputText; }, [subAgentThinkingText, subAgentOutputText]);

  useEffect(() => {
    if (!isThinking) { setThrottledThinking(''); return; }
    const id = setInterval(() => {
      setThrottledThinking(prev => {
        const target = thinkingTargetRef.current;
        if (prev.length >= target.length) return prev;
        const pending = target.length - prev.length;
        const reserve = 50;
        const minChars = 3; // 60 chars/sec floor at 50ms tick
        const chars = Math.max(minChars, Math.round(pending / (reserve / minChars)));
        return target.slice(0, Math.min(target.length, prev.length + chars));
      });
    }, 50);
    return () => clearInterval(id);
  }, [isThinking]);

  useEffect(() => {
    if (!isSubAgentActive) { setThrottledSubAgent(''); return; }
    const id = setInterval(() => {
      setThrottledSubAgent(prev => {
        const target = subAgentTargetRef.current;
        if (prev.length >= target.length) return prev;
        const pending = target.length - prev.length;
        const reserve = 50;
        const minChars = 3;
        const chars = Math.max(minChars, Math.round(pending / (reserve / minChars)));
        return target.slice(0, Math.min(target.length, prev.length + chars));
      });
    }, 50);
    return () => clearInterval(id);
  }, [isSubAgentActive]);

  useEffect(() => {
    const el = thinkingScrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [throttledThinking]);

  useEffect(() => {
    const el = subAgentScrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [throttledSubAgent]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [messages, isLoading, streamingText, isThinking, isSubAgentActive]);

  const handleSubmit = useCallback((event) => {
    if (event) event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSubmit(trimmed);
  }, [input, isLoading, onSubmit]);

  const handleNewConversation = useCallback(() => {
    setShowHistory(false);
    onNewConversation?.();
  }, [onNewConversation]);

  const handleKeyDown = (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const handleTextareaChange = (event) => {
    setInput(event.target.value);
    const el = event.target;
    el.style.height = 'auto';
    const maxHeight = 4 * 20;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
    if (el.scrollHeight > maxHeight) {
      el.style.overflowY = 'auto';
    } else {
      el.style.overflowY = 'hidden';
    }
  };

  const progressText = progress
    ? progress.phase === 'calling'
      ? 'Thinking…'
      : progress.phase === 'rate_limited'
        ? `Rate limited — retrying in ${progress.waitSec}s…`
        : `Running ${progress.tool}…`
    : '';

  const hasInput = input.trim().length > 0;
  

  if (!isOpen) {
    return (
      <button
        data-testid="ai-chat-toggle"
        onClick={() => setIsOpen(true)}
        onMouseEnter={() => setIsToggleHovered(true)}
        onMouseLeave={() => setIsToggleHovered(false)}
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 170,
          background: isToggleHovered ? '#4338ca' : '#4f46e5',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          padding: '10px 20px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
          transition: 'background 0.15s',
        }}
      >
        ✨ AI Assistant
      </button>
    );
  }

  return (
    <div
      data-testid="ai-chat-panel"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 380,
        height: '100vh',
        zIndex: 170,
        background: '#fff',
        borderLeft: '1px solid #e5e7eb',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.3s ease-out',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#4f46e5' }}>✨ AI Assistant</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            data-testid="ai-chat-history"
            onClick={() => setShowHistory((v) => !v)}
            onMouseEnter={() => setIsHistoryHovered(true)}
            onMouseLeave={() => setIsHistoryHovered(false)}
            disabled={isLoading}
            style={{
              border: 'none',
              background: showHistory
                ? '#eef2ff'
                : isHistoryHovered && !isLoading ? '#eef2ff' : 'transparent',
              cursor: isLoading ? 'default' : 'pointer',
              fontSize: 12,
              color: isLoading ? '#a5b4fc' : '#4f46e5',
              borderRadius: 6,
              padding: '4px 10px',
              fontWeight: 600,
              transition: 'background 0.15s',
            }}
          >
            History
          </button>
          <button
            data-testid="ai-chat-new"
            onClick={handleNewConversation}
            onMouseEnter={() => setIsNewHovered(true)}
            onMouseLeave={() => setIsNewHovered(false)}
            disabled={isLoading}
            style={{
              border: 'none',
              background: isNewHovered && !isLoading ? '#eef2ff' : 'transparent',
              cursor: isLoading ? 'default' : 'pointer',
              fontSize: 12,
              color: isLoading ? '#a5b4fc' : '#4f46e5',
              borderRadius: 6,
              padding: '4px 10px',
              fontWeight: 600,
              transition: 'background 0.15s',
            }}
          >
            + New
          </button>
          <button
            data-testid="ai-chat-close"
            onClick={() => setIsOpen(false)}
            onMouseEnter={() => setIsCloseHovered(true)}
            onMouseLeave={() => setIsCloseHovered(false)}
            style={{
              border: 'none',
              background: isCloseHovered ? '#f3f4f6' : 'transparent',
              cursor: 'pointer',
              fontSize: 18,
              color: '#6b7280',
              borderRadius: 6,
              padding: '2px 8px',
              lineHeight: 1,
              transition: 'background 0.15s',
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Conversation history list */}
      {showHistory && (
        <div
          data-testid="ai-chat-history-list"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          {conversationList.length === 0 && (
            <div style={{
              color: '#9ca3af',
              fontSize: 13,
              textAlign: 'center',
              padding: '32px 16px',
            }}>
              No previous conversations
            </div>
          )}
          {conversationList.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isHovered = hoveredConvId === conv.id;
            return (
              <button
                key={conv.id}
                data-testid="ai-chat-history-item"
                onClick={() => {
                  onLoadConversation?.(conv.id);
                  setShowHistory(false);
                }}
                onMouseEnter={() => setHoveredConvId(conv.id)}
                onMouseLeave={() => setHoveredConvId(null)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: isActive ? '#eef2ff' : isHovered ? '#f9fafb' : 'transparent',
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  borderLeft: isActive ? '3px solid #4f46e5' : '3px solid transparent',
                }}
              >
                <div style={{
                  fontSize: 13,
                  color: '#1f2937',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: isActive ? 600 : 400,
                }}>
                  {conv.preview}
                </div>
                <div style={{
                  fontSize: 11,
                  color: '#9ca3af',
                  marginTop: 2,
                }}>
                  {new Date(conv.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {conv.createdByName && ` · ${conv.createdByName}`}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Messages */}
      {!showHistory && <div
        data-testid="ai-chat-messages"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 && !isLoading && (
          <div style={{
            color: '#9ca3af',
            fontSize: 13,
            textAlign: 'center',
            padding: '32px 16px',
            lineHeight: 1.6,
          }}>
            Try: &ldquo;Create a SWOT analysis&rdquo; or &ldquo;Add 3 sticky notes in a row&rdquo;
          </div>
        )}
        {messages.map((msg, index) => (
          msg.role === 'tool' ? (
            <div
              key={index}
              data-testid="ai-chat-tool-call"
              style={{
                alignSelf: 'flex-start',
                fontSize: 11,
                color: msg.ok === false ? '#b91c1c' : '#9ca3af',
                padding: '2px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 10, ...(msg.pending ? { animation: 'thinkingPulse 1.5s infinite ease-in-out' } : {}) }}>
                {msg.ok === false ? '✗' : msg.pending ? '◌' : '⚙'}
              </span>
              {msg.text}
            </div>
          ) : (
            <div
              key={index}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? '#4f46e5' : '#f3f4f6',
                color: msg.role === 'user' ? '#fff' : '#1f2937',
                padding: '10px 16px',
                borderRadius: msg.role === 'user'
                  ? '16px 4px 16px 16px'
                  : '4px 16px 16px 16px',
                fontSize: 13,
                maxWidth: '85%',
                wordBreak: 'break-word',
                lineHeight: 1.5,
              }}
            >
              {msg.role === 'user' ? msg.text : renderMarkdown(msg.text)}
            </div>
          )
        ))}
        {/* Thinking indicator — sliding text window */}
        {isLoading && isThinking && thinkingText && (
          <div
            data-testid="ai-chat-thinking"
            style={{
              alignSelf: 'flex-start',
              width: '85%',
              background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
              borderRadius: '4px 16px 16px 16px',
              padding: '8px 14px',
            }}
          >
            <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', animation: 'thinkingPulse 1.5s infinite ease-in-out' }}>💭</span>
              Thinking…
            </div>
            <div ref={thinkingScrollRef} className="thinking-scroll" style={{
              height: 32,
              overflowX: 'scroll',
              scrollBehavior: 'smooth',
              maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
            }}>
              <div style={{
                whiteSpace: 'nowrap',
                fontSize: 11,
                color: '#818cf8',
                lineHeight: '32px',
                width: 'fit-content',
              }}>
                {throttledThinking.slice(-300)}
              </div>
            </div>
          </div>
        )}
        {/* Sub-agent thinking indicator — board search */}
        {isLoading && isSubAgentActive && (subAgentThinkingText || subAgentOutputText) && (
          <div
            data-testid="ai-chat-subagent-thinking"
            style={{
              alignSelf: 'flex-start',
              width: '85%',
              background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
              borderRadius: '4px 16px 16px 16px',
              padding: '8px 14px',
            }}
          >
            <div style={{ fontSize: 10, color: '#059669', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', animation: 'thinkingPulse 1.5s infinite ease-in-out' }}>🔍</span>
              Searching board…
            </div>
            <div ref={subAgentScrollRef} className="thinking-scroll" style={{
              height: 32,
              overflowX: 'scroll',
              scrollBehavior: 'smooth',
              maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
            }}>
              <div style={{
                whiteSpace: 'nowrap',
                fontSize: 11,
                color: '#34d399',
                lineHeight: '32px',
                width: 'fit-content',
              }}>
                {throttledSubAgent.slice(-300)}
              </div>
            </div>
          </div>
        )}
        {/* Streaming text — progressively rendered */}
        {isLoading && streamingText && (
          <div
            data-testid="ai-chat-streaming"
            style={{
              alignSelf: 'flex-start',
              background: '#f3f4f6',
              color: '#1f2937',
              padding: '10px 16px',
              borderRadius: '4px 16px 16px 16px',
              fontSize: 13,
              maxWidth: '85%',
              wordBreak: 'break-word',
              lineHeight: 1.5,
            }}
          >
            {renderMarkdown(streamingText)}
            <span style={{
              display: 'inline-block',
              width: 2,
              height: 14,
              background: '#4f46e5',
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              animation: 'cursorBlink 1s steps(2) infinite',
            }} />
          </div>
        )}
        {/* Typing dots — shown when loading but no streaming or thinking yet */}
        {isLoading && !streamingText && !isThinking && (
          <div style={{
            alignSelf: 'flex-start',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <div
              data-testid="ai-chat-typing"
              style={{
                background: '#f3f4f6',
                padding: '12px 16px',
                borderRadius: '4px 16px 16px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  data-testid="typing-dot"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#9ca3af',
                    display: 'inline-block',
                    animation: `typingBounce 1.4s infinite ease-in-out ${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
            {progressText && (
              <div style={{
                fontSize: 11,
                color: '#9ca3af',
                paddingLeft: 4,
              }}>
                {progressText}
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} style={{ minHeight: '40vh', flexShrink: 0 }} />
      </div>}

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          padding: '12px 16px',
          borderTop: '1px solid #e5e7eb',
          flexShrink: 0,
        }}
      >
        <textarea
          ref={textareaRef}
          data-testid="ai-chat-input"
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask the AI to create or modify board content…"
          disabled={isLoading}
          rows={1}
          style={{
            flex: 1,
            border: '1px solid #d1d5db',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
            outline: 'none',
            resize: 'none',
            lineHeight: '20px',
            maxHeight: 80,
            overflowY: 'hidden',
            fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
        />
        <button
          data-testid="ai-chat-send"
          type="submit"
          disabled={isLoading || !hasInput}
          onMouseEnter={() => setIsSendHovered(true)}
          onMouseLeave={() => setIsSendHovered(false)}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: isLoading || !hasInput
              ? '#a5b4fc'
              : isSendHovered ? '#4338ca' : '#4f46e5',
            color: '#fff',
            fontSize: 14,
            cursor: isLoading || !hasInput ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s, opacity 0.15s',
            opacity: hasInput ? 1 : 0,
            pointerEvents: hasInput ? 'auto' : 'none',
          }}
        >
          ▲
        </button>
      </form>

      {/* Keyframe animations */}
      <style>{`
        .thinking-scroll { scrollbar-width: none; }
        .thinking-scroll::-webkit-scrollbar { display: none; }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        @keyframes thinkingPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }
        @keyframes cursorBlink {
          0% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
