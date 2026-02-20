import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import fc from 'fast-check';
import AiChat from './AiChat.jsx';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Helper: render an assistant message and assert no crash
const renderMarkdownMessage = (text) => {
  const messages = [{ role: 'assistant', text }];
  const { unmount } = render(
    <AiChat onSubmit={vi.fn()} isLoading={false} progress={null} messages={messages} />
  );
  act(() => { fireEvent.click(screen.getByTestId('ai-chat-toggle')); });
  expect(screen.getByTestId('ai-chat-panel')).toBeInTheDocument();
  unmount();
};

// Helper: render streaming text and assert no crash
const renderStreamingMarkdown = (text) => {
  const { unmount } = render(
    <AiChat onSubmit={vi.fn()} isLoading={true} progress={null} streamingText={text} />
  );
  act(() => { fireEvent.click(screen.getByTestId('ai-chat-toggle')); });
  expect(screen.getByTestId('ai-chat-streaming')).toBeInTheDocument();
  unmount();
};

// --- Arbitrary generators for markdown fragments ---

// Safe text without markdown-breaking chars
const safeTextArb = fc.stringMatching(/^[a-zA-Z0-9 ]{1,20}$/);

// Inline code: `code`
const inlineCodeArb = safeTextArb.map(s => `\`${s}\``);

// Bold: **text**
const boldArb = safeTextArb.map(s => `**${s}**`);

// Italic: *text*
const italicArb = safeTextArb.map(s => `*${s}*`);

// Link: [text](url)
const linkArb = fc.tuple(safeTextArb, fc.webUrl())
  .map(([text, url]) => `[${text}](${url})`);

// Header: # text
const headerArb = fc.tuple(
  fc.integer({ min: 1, max: 3 }),
  safeTextArb
).map(([level, text]) => `${'#'.repeat(level)} ${text}`);

// Unordered list item: - text
const ulItemArb = safeTextArb.map(s => `- ${s}`);

// Ordered list item: 1. text
const olItemArb = fc.tuple(
  fc.integer({ min: 1, max: 99 }),
  safeTextArb
).map(([n, s]) => `${n}. ${s}`);

// Fenced code block
const codeBlockArb = fc.tuple(
  fc.constantFrom('', 'js', 'python', 'html', 'css', 'json'),
  fc.array(safeTextArb, { minLength: 0, maxLength: 5 })
).map(([lang, lines]) => `\`\`\`${lang}\n${lines.join('\n')}\n\`\`\``);

// Table
const tableCellArb = fc.stringMatching(/^[a-zA-Z0-9 ]{1,10}$/);
const tableArb = fc.tuple(
  fc.integer({ min: 2, max: 5 }),
  fc.integer({ min: 1, max: 4 })
).chain(([cols, rows]) => {
  const cellRow = fc.array(tableCellArb, { minLength: cols, maxLength: cols });
  return fc.tuple(cellRow, fc.array(cellRow, { minLength: rows, maxLength: rows }));
}).map(([header, dataRows]) => {
  const headerLine = `| ${header.join(' | ')} |`;
  const sepLine = `| ${header.map(() => '---').join(' | ')} |`;
  const dataLines = dataRows.map(r => `| ${r.join(' | ')} |`);
  return [headerLine, sepLine, ...dataLines].join('\n');
});

// Blockquote
const blockquoteArb = safeTextArb.map(s => `> ${s}`);

// HR
const hrArb = fc.constantFrom('---', '***', '___');

// A single markdown fragment
const mdFragmentArb = fc.oneof(
  { weight: 3, arbitrary: safeTextArb },
  { weight: 2, arbitrary: inlineCodeArb },
  { weight: 2, arbitrary: boldArb },
  { weight: 2, arbitrary: italicArb },
  { weight: 1, arbitrary: linkArb },
  { weight: 2, arbitrary: headerArb },
  { weight: 2, arbitrary: ulItemArb },
  { weight: 2, arbitrary: olItemArb },
  { weight: 1, arbitrary: codeBlockArb },
  { weight: 1, arbitrary: tableArb },
  { weight: 1, arbitrary: blockquoteArb },
  { weight: 1, arbitrary: hrArb },
);

// Full markdown document
const mdDocArb = fc.array(mdFragmentArb, { minLength: 1, maxLength: 15 })
  .map(frags => frags.join('\n\n'));

// Nested inline combos
const nestedInlineArb = fc.oneof(
  // **bold `code` bold**
  fc.tuple(safeTextArb, inlineCodeArb, safeTextArb)
    .map(([a, b, c]) => `**${a} ${b} ${c}**`),
  // *italic `code` italic*
  fc.tuple(safeTextArb, inlineCodeArb, safeTextArb)
    .map(([a, b, c]) => `*${a} ${b} ${c}*`),
  // **bold *italic* bold**
  fc.tuple(safeTextArb, safeTextArb, safeTextArb)
    .map(([a, b, c]) => `**${a} *${b}* ${c}**`),
  // [link with `code`](url)
  fc.tuple(inlineCodeArb, fc.webUrl())
    .map(([code, url]) => `[text ${code}](${url})`),
  // Just inline code alone (the original crash case!)
  inlineCodeArb,
  // Multiple inline codes in a row
  fc.array(inlineCodeArb, { minLength: 2, maxLength: 5 })
    .map(codes => codes.join(' ')),
);

// Doc mixing regular and nested fragments
const nestedDocArb = fc.array(
  fc.oneof(mdFragmentArb, nestedInlineArb),
  { minLength: 1, maxLength: 10 }
).map(frags => frags.join('\n\n'));

// Markdown chars soup — stress-tests the parser with random combos of special chars
const mdCharsSoupArb = fc.array(
  fc.constantFrom(
    '*', '**', '`', '```', '#', '-', '|', '[', ']', '(', ')',
    '>', '_', '~', '\n', ' ', 'a', 'b', '1', '.', ':', '!',
  ),
  { minLength: 1, maxLength: 100 }
).map(arr => arr.join(''));

describe('Markdown renderer - property-based tests', () => {
  it('never crashes on arbitrary markdown documents (message)', () => {
    fc.assert(
      fc.property(mdDocArb, (md) => {
        expect(() => renderMarkdownMessage(md)).not.toThrow();
      }),
      { numRuns: 200 }
    );
  });

  it('never crashes on arbitrary markdown documents (streaming)', () => {
    fc.assert(
      fc.property(mdDocArb, (md) => {
        expect(() => renderStreamingMarkdown(md)).not.toThrow();
      }),
      { numRuns: 200 }
    );
  });

  it('never crashes on nested inline markdown', () => {
    fc.assert(
      fc.property(nestedDocArb, (md) => {
        expect(() => renderMarkdownMessage(md)).not.toThrow();
      }),
      { numRuns: 200 }
    );
  });

  it('never crashes on completely random strings', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 500 }), (md) => {
        expect(() => renderMarkdownMessage(md)).not.toThrow();
      }),
      { numRuns: 300 }
    );
  });

  it('never crashes on markdown special char soup', () => {
    fc.assert(
      fc.property(mdCharsSoupArb, (md) => {
        expect(() => renderMarkdownMessage(md)).not.toThrow();
      }),
      { numRuns: 300 }
    );
  });

  it('never crashes on partial/truncated markdown (simulating streaming)', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        mdDocArb,
        fc.integer({ min: 1, max: 500 }),
        (md, cutoff) => {
          const partial = md.slice(0, Math.min(cutoff, md.length));
          expect(() => renderStreamingMarkdown(partial)).not.toThrow();
        }
      ),
      { numRuns: 300 }
    );
  });

  it('never crashes on markdown with unclosed delimiters', () => {
    const unclosedArb = fc.constantFrom(
      '**unclosed bold',
      '*unclosed italic',
      '`unclosed code',
      '```\nunclosed code block',
      '[unclosed link](',
      '[unclosed link text',
      '| unclosed | table',
      '| a | b |\n| --- |',
      '> blockquote\n> ',
      '**bold `code** outside`',
      '*italic **bold* inside**',
      '`code **bold` outside**',
      '```\n`nested backtick',
      '# Header with **unclosed bold',
      '- list with `unclosed code',
      '| cell with *unclosed |',
    );
    fc.assert(
      fc.property(unclosedArb, (md) => {
        expect(() => renderMarkdownMessage(md)).not.toThrow();
      }),
      { numRuns: 50 }
    );
  });

  it('never crashes on empty/null/whitespace-only text', () => {
    const emptyishArb = fc.constantFrom(
      '', ' ', '\n', '\n\n\n', '\t', '   \n   \n   ',
    );
    fc.assert(
      fc.property(emptyishArb, (md) => {
        const messages = [{ role: 'assistant', text: md }];
        expect(() => {
          const { unmount } = render(
            <AiChat onSubmit={vi.fn()} isLoading={false} progress={null} messages={messages} />
          );
          act(() => { fireEvent.click(screen.getByTestId('ai-chat-toggle')); });
          unmount();
        }).not.toThrow();
      }),
      { numRuns: 20 }
    );
  });

  it('never crashes on deeply nested markdown structures', () => {
    const deepNestArb = fc.integer({ min: 1, max: 8 }).chain(depth =>
      fc.constantFrom(
        `${'> '.repeat(depth)}deeply nested`,
        `${'  '.repeat(depth)}- nested item`,
        `${'> '.repeat(depth)}## Heading`,
        `${'> '.repeat(depth)}\`code here\``,
        `${'> '.repeat(depth)}**bold here**`,
      )
    );
    const deepDocArb = fc.array(deepNestArb, { minLength: 1, maxLength: 10 })
      .map(lines => lines.join('\n'));
    fc.assert(
      fc.property(deepDocArb, (md) => {
        expect(() => renderMarkdownMessage(md)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });
});

describe('Markdown renderer - specific regression tests', () => {
  it('renders solo inline code without crashing (original bug)', () => {
    expect(() => renderMarkdownMessage('`solo code`')).not.toThrow();
  });

  it('renders inline code inside bold without crashing (original bug)', () => {
    expect(() => renderMarkdownMessage('**bold `code` bold**')).not.toThrow();
  });

  it('renders multiple inline codes in a row', () => {
    expect(() => renderMarkdownMessage('`a` `b` `c`')).not.toThrow();
  });

  it('renders mixed inline formatting', () => {
    expect(() => renderMarkdownMessage('**bold** and *italic* and `code` and [link](http://example.com)')).not.toThrow();
  });

  it('renders table with inline formatting in cells', () => {
    const md = '| **Bold** | `Code` | *Italic* |\n| --- | --- | --- |\n| a | b | c |';
    expect(() => renderMarkdownMessage(md)).not.toThrow();
  });

  it('renders code block with backticks inside', () => {
    expect(() => renderMarkdownMessage('```\nconst x = `template`;\n```')).not.toThrow();
  });

  it('renders overlapping/conflicting markdown delimiters', () => {
    const cases = [
      '**bold *italic** end*',
      '`code **bold` end**',
      '*italic `code* end`',
      '***bold and italic***',
      '**`code in bold`**',
      '> quoted **bold `code`** text',
    ];
    for (const md of cases) {
      expect(() => renderMarkdownMessage(md)).not.toThrow();
    }
  });

  it('renders extremely long single line', () => {
    const longLine = 'word '.repeat(500);
    expect(() => renderMarkdownMessage(longLine)).not.toThrow();
  });

  it('renders many consecutive empty lines', () => {
    expect(() => renderMarkdownMessage('\n'.repeat(100))).not.toThrow();
  });

  it('renders markdown with unicode and emoji', () => {
    expect(() => renderMarkdownMessage('# 🎉 Header\n\n**Bold 中文** and `コード` and *курсив*')).not.toThrow();
  });

  it('renders only backticks', () => {
    for (const md of ['`', '``', '```', '````', '`````']) {
      expect(() => renderMarkdownMessage(md)).not.toThrow();
    }
  });

  it('renders only asterisks', () => {
    for (const md of ['*', '**', '***', '****']) {
      expect(() => renderMarkdownMessage(md)).not.toThrow();
    }
  });

  it('renders only pipes and dashes (broken table)', () => {
    expect(() => renderMarkdownMessage('| | |\n|---|')).not.toThrow();
  });

  it('renders a comprehensive markdown document', () => {
    const md = `# Main Title

## Section 1

This is a paragraph with **bold**, *italic*, and \`inline code\`.

### Subsection

- Item 1 with \`code\`
- Item **bold item**
- Item *italic item*

1. First ordered
2. Second ordered

\`\`\`javascript
const x = 42;
console.log(x);
\`\`\`

| Name | Age | City |
| --- | --- | --- |
| Alice | 30 | NYC |
| Bob | 25 | LA |

> A blockquote with **bold** and \`code\`

---

[Visit here](https://example.com) for more info.

***bold and italic***`;
    expect(() => renderMarkdownMessage(md)).not.toThrow();
  });
});
