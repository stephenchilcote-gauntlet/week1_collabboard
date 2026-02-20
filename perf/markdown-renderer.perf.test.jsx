import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fc from 'fast-check';
import { renderLegacyMarkdown } from './legacyProgressiveMarkdownRenderer.jsx';
import { renderReactMarkdown } from './reactMarkdownRenderer.jsx';

const safeTextArb = fc.stringMatching(/^[a-zA-Z0-9 ]{1,20}$/);
const inlineCodeArb = safeTextArb.map(s => `\`${s}\``);
const boldArb = safeTextArb.map(s => `**${s}**`);
const italicArb = safeTextArb.map(s => `*${s}*`);
const linkArb = fc.tuple(safeTextArb, fc.webUrl())
  .map(([text, url]) => `[${text}](${url})`);
const headerArb = fc.tuple(fc.integer({ min: 1, max: 3 }), safeTextArb)
  .map(([level, text]) => `${'#'.repeat(level)} ${text}`);
const ulItemArb = safeTextArb.map(s => `- ${s}`);
const olItemArb = fc.tuple(fc.integer({ min: 1, max: 99 }), safeTextArb)
  .map(([n, s]) => `${n}. ${s}`);
const codeBlockArb = fc.tuple(
  fc.constantFrom('', 'js', 'python', 'html', 'css', 'json'),
  fc.array(safeTextArb, { minLength: 0, maxLength: 5 }),
).map(([lang, lines]) => `\`\`\`${lang}\n${lines.join('\n')}\n\`\`\``);
const tableCellArb = fc.stringMatching(/^[a-zA-Z0-9 ]{1,10}$/);
const tableArb = fc.tuple(
  fc.integer({ min: 2, max: 5 }),
  fc.integer({ min: 1, max: 4 }),
).chain(([cols, rows]) => {
  const cellRow = fc.array(tableCellArb, { minLength: cols, maxLength: cols });
  return fc.tuple(cellRow, fc.array(cellRow, { minLength: rows, maxLength: rows }));
}).map(([header, dataRows]) => {
  const headerLine = `| ${header.join(' | ')} |`;
  const sepLine = `| ${header.map(() => '---').join(' | ')} |`;
  const dataLines = dataRows.map(r => `| ${r.join(' | ')} |`);
  return [headerLine, sepLine, ...dataLines].join('\n');
});
const blockquoteArb = safeTextArb.map(s => `> ${s}`);
const hrArb = fc.constantFrom('---', '***', '___');

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

const nestedInlineArb = fc.oneof(
  fc.tuple(safeTextArb, inlineCodeArb, safeTextArb)
    .map(([a, b, c]) => `**${a} ${b} ${c}**`),
  fc.tuple(safeTextArb, inlineCodeArb, safeTextArb)
    .map(([a, b, c]) => `*${a} ${b} ${c}*`),
  fc.tuple(safeTextArb, safeTextArb, safeTextArb)
    .map(([a, b, c]) => `**${a} *${b}* ${c}**`),
  fc.tuple(inlineCodeArb, fc.webUrl())
    .map(([code, url]) => `[text ${code}](${url})`),
  inlineCodeArb,
  fc.array(inlineCodeArb, { minLength: 2, maxLength: 5 })
    .map(codes => codes.join(' ')),
);

const mdDocArb = fc.array(mdFragmentArb, { minLength: 1, maxLength: 15 })
  .map(frags => frags.join('\n\n'));
const nestedDocArb = fc.array(fc.oneof(mdFragmentArb, nestedInlineArb), { minLength: 1, maxLength: 10 })
  .map(frags => frags.join('\n\n'));
const randomArb = fc.string({ minLength: 0, maxLength: 500 });

const toHtml = (node) => renderToStaticMarkup(<>{node}</>);

const measureRenderer = (name, docs, renderFn, passes = 4) => {
  let crashes = 0;
  let checksum = 0;
  const safeDocs = [];

  for (const doc of docs) {
    try {
      const html = toHtml(renderFn(doc));
      checksum += html.length;
      safeDocs.push(doc);
    } catch {
      crashes += 1;
    }
  }

  const start = performance.now();
  for (let pass = 0; pass < passes; pass += 1) {
    for (const doc of safeDocs) {
      const html = toHtml(renderFn(doc));
      checksum += html.length;
    }
  }
  const elapsedMs = performance.now() - start;

  return {
    name,
    docs: docs.length,
    safeDocs: safeDocs.length,
    crashes,
    elapsedMs,
    avgMsPerDoc: safeDocs.length ? elapsedMs / (safeDocs.length * passes) : Number.NaN,
    checksum,
  };
};

describe('markdown renderer perf comparison', () => {
  it('compares legacy progressive renderer vs react-markdown on property-based corpus', () => {
    const docs = [
      ...fc.sample(mdDocArb, { numRuns: 300 }),
      ...fc.sample(nestedDocArb, { numRuns: 150 }),
      ...fc.sample(randomArb, { numRuns: 150 }),
    ];

    const legacy = measureRenderer('legacy', docs, renderLegacyMarkdown);
    const modern = measureRenderer('react-markdown', docs, renderReactMarkdown);

    const ratio = legacy.avgMsPerDoc / modern.avgMsPerDoc;

    console.table([
      {
        renderer: legacy.name,
        docs: legacy.docs,
        safeDocs: legacy.safeDocs,
        crashes: legacy.crashes,
        totalMs: Number(legacy.elapsedMs.toFixed(2)),
        avgMsPerDoc: Number(legacy.avgMsPerDoc.toFixed(4)),
      },
      {
        renderer: modern.name,
        docs: modern.docs,
        safeDocs: modern.safeDocs,
        crashes: modern.crashes,
        totalMs: Number(modern.elapsedMs.toFixed(2)),
        avgMsPerDoc: Number(modern.avgMsPerDoc.toFixed(4)),
      },
    ]);

    console.log(`\nlegacy/react-markdown avg-doc ratio: ${ratio.toFixed(2)}x`);

    expect(legacy.docs).toBe(modern.docs);
    expect(legacy.checksum).toBeGreaterThan(0);
    expect(modern.checksum).toBeGreaterThan(0);
  });
});
