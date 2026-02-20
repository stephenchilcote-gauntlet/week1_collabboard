import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fc from 'fast-check';
import { renderReactMarkdown } from './reactMarkdownRenderer.jsx';
import { renderProgressiveMarkdown } from '../src/components/progressiveMarkdownRenderer.jsx';

const MATCH_TARGET = 0.6;
const SPEEDUP_TARGET = 5;
const MATCH_SIMILARITY_THRESHOLD = 0.82;
const SPEED_MATCH_THRESHOLD = 0.92;
const SPEED_PASSES = 12;
const SPEED_TRIALS = 3;

const safeTextArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .map((s) => s.replace(/[^a-zA-Z0-9 ]/g, 'a') || 'a');
const inlineCodeArb = safeTextArb.map((s) => `\`${s}\``);
const boldArb = safeTextArb.map((s) => `**${s}**`);
const italicArb = safeTextArb.map((s) => `*${s}*`);
const linkArb = fc.tuple(safeTextArb, fc.webUrl()).map(([text, url]) => `[${text}](${url})`);
const headerArb = fc.tuple(fc.integer({ min: 1, max: 3 }), safeTextArb).map(([level, text]) => `${'#'.repeat(level)} ${text}`);
const ulItemArb = safeTextArb.map((s) => `- ${s}`);
const olItemArb = fc.tuple(fc.integer({ min: 1, max: 99 }), safeTextArb).map(([n, s]) => `${n}. ${s}`);
const codeBlockArb = fc.tuple(
  fc.constantFrom('', 'js', 'python', 'html', 'css', 'json'),
  fc.array(safeTextArb, { minLength: 0, maxLength: 5 }),
).map(([lang, lines]) => `\`\`\`${lang}\n${lines.join('\n')}\n\`\`\``);
const tableCellArb = fc
  .string({ minLength: 1, maxLength: 10 })
  .map((s) => s.replace(/[^a-zA-Z0-9 ]/g, 'b') || 'b');
const tableArb = fc.tuple(fc.integer({ min: 2, max: 5 }), fc.integer({ min: 1, max: 4 }))
  .chain(([cols, rows]) => {
    const row = fc.array(tableCellArb, { minLength: cols, maxLength: cols });
    return fc.tuple(row, fc.array(row, { minLength: rows, maxLength: rows }));
  })
  .map(([header, dataRows]) => {
    const headerLine = `| ${header.join(' | ')} |`;
    const separatorLine = `| ${header.map(() => '---').join(' | ')} |`;
    const data = dataRows.map((r) => `| ${r.join(' | ')} |`);
    return [headerLine, separatorLine, ...data].join('\n');
  });
const blockquoteArb = safeTextArb.map((s) => `> ${s}`);
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
  fc.tuple(safeTextArb, inlineCodeArb, safeTextArb).map(([a, b, c]) => `**${a} ${b} ${c}**`),
  fc.tuple(safeTextArb, inlineCodeArb, safeTextArb).map(([a, b, c]) => `*${a} ${b} ${c}*`),
  fc.tuple(safeTextArb, safeTextArb, safeTextArb).map(([a, b, c]) => `**${a} *${b}* ${c}**`),
  fc.tuple(inlineCodeArb, fc.webUrl()).map(([code, url]) => `[text ${code}](${url})`),
  inlineCodeArb,
  fc.array(inlineCodeArb, { minLength: 2, maxLength: 5 }).map((codes) => codes.join(' ')),
);

const mdDocArb = fc.array(mdFragmentArb, { minLength: 1, maxLength: 15 }).map((frags) => frags.join('\n\n'));
const nestedDocArb = fc.array(fc.oneof(mdFragmentArb, nestedInlineArb), { minLength: 1, maxLength: 10 })
  .map((frags) => frags.join('\n\n'));
const randomArb = fc.string({ minLength: 0, maxLength: 500 });

const toHtml = (node) => renderToStaticMarkup(<>{node}</>);
const normalizeHtml = (html) => html.replace(/\s+/g, ' ').trim();

const diceSimilarity = (a, b) => {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const counts = new Map();
  for (let i = 0; i < a.length - 1; i += 1) {
    const gram = a.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }

  let matches = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const gram = b.slice(i, i + 2);
    const n = counts.get(gram) ?? 0;
    if (n > 0) {
      counts.set(gram, n - 1);
      matches += 1;
    }
  }

  return (2 * matches) / ((a.length - 1) + (b.length - 1));
};

const isLikelyValidHtml = (html) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  const reparsed = host.innerHTML;
  return !/(<\/?(?:undefined|nan)\b)/i.test(reparsed);
};

const makeCorpus = () => {
  const base = [
    ...fc.sample(mdDocArb, { numRuns: 30 }),
    ...fc.sample(nestedDocArb, { numRuns: 15 }),
    ...fc.sample(randomArb, { numRuns: 15 }),
  ];

  const progressive = base.flatMap((doc) => {
    if (doc.length < 8) return [doc];
    const a = Math.max(1, Math.floor(doc.length * 0.2));
    const b = Math.max(1, Math.floor(doc.length * 0.5));
    const c = Math.max(1, Math.floor(doc.length * 0.8));
    return [doc.slice(0, a), doc.slice(0, b), doc.slice(0, c)];
  });

  return [...base, ...progressive];
};

describe('progressive markdown goals', () => {
  it('meets crash, html validity, match-rate and speed targets', () => {
    const docs = makeCorpus();
    const candidateResults = [];
    const referenceResults = [];
    const candidateCrashDocs = [];
    const invalidHtmlDocs = [];

    for (let idx = 0; idx < docs.length; idx += 1) {
      const doc = docs[idx];
      if (idx % 40 === 0) {
        console.log(`evaluating doc ${idx + 1}/${docs.length}`);
      }
      const referenceHtml = normalizeHtml(toHtml(renderReactMarkdown(doc)));
      referenceResults.push(referenceHtml);

      const started = performance.now();
      try {
        const candidateHtml = normalizeHtml(toHtml(renderProgressiveMarkdown(doc)));
        const elapsed = performance.now() - started;

        if (!isLikelyValidHtml(candidateHtml)) {
          invalidHtmlDocs.push({ doc, candidateHtml });
        }

        candidateResults.push({ doc, html: candidateHtml, elapsed });
      } catch (error) {
        candidateCrashDocs.push({ doc, error: String(error) });
      }
    }

    if (candidateCrashDocs.length > 0) {
      console.log('\nCrash-causing docs (candidate):');
      for (const entry of candidateCrashDocs.slice(0, 5)) {
        console.log(`---\n${entry.doc}\n[error] ${entry.error}`);
      }
    }

    if (invalidHtmlDocs.length > 0) {
      console.log('\nLikely-invalid HTML docs (candidate):');
      for (const entry of invalidHtmlDocs.slice(0, 5)) {
        console.log(`---\n${entry.doc}\n[html] ${entry.candidateHtml}`);
      }
    }

    const usable = [];
    for (let i = 0; i < candidateResults.length; i += 1) {
      if (!referenceResults[i]) continue;
      usable.push({
        doc: candidateResults[i].doc,
        candidateHtml: candidateResults[i].html,
        referenceHtml: referenceResults[i],
        elapsed: candidateResults[i].elapsed,
      });
    }

    const comparisons = usable.map((entry) => {
      const similarity = diceSimilarity(entry.candidateHtml, entry.referenceHtml);
      return {
        ...entry,
        similarity,
        isMatch: similarity >= MATCH_SIMILARITY_THRESHOLD,
      };
    });

    const mismatches = comparisons
      .filter((c) => !c.isMatch)
      .sort((a, b) => a.similarity - b.similarity);
    const matchRate = comparisons.length ? (comparisons.length - mismatches.length) / comparisons.length : 0;

    if (mismatches.length === 0) {
      console.log('\nNo mismatching docs found.');
    } else {
      console.log('\nMost mismatched docs:');
      for (const entry of mismatches.slice(0, 5)) {
        console.log(`---\n[similarity=${entry.similarity.toFixed(3)}]\n${entry.doc}\n[candidate] ${entry.candidateHtml}\n[reference] ${entry.referenceHtml}`);
      }
    }

    const candidateTotal = comparisons.reduce((sum, c) => sum + c.elapsed, 0);

    // Measure speed on the overlapping-output subset; this avoids penalizing
    // intentional table support that react-markdown (without GFM) treats as plain text.
    const speedDocs = comparisons.filter((entry) => entry.similarity >= SPEED_MATCH_THRESHOLD);

    const speedTrials = [];
    for (let trial = 0; trial < SPEED_TRIALS; trial += 1) {
      let candidateRenderTotal = 0;
      let referenceRenderTotal = 0;

      for (let pass = 0; pass < SPEED_PASSES; pass += 1) {
        for (const entry of speedDocs) {
          const candidateStart = performance.now();
          toHtml(renderProgressiveMarkdown(entry.doc));
          candidateRenderTotal += performance.now() - candidateStart;

          const referenceStart = performance.now();
          toHtml(renderReactMarkdown(entry.doc));
          referenceRenderTotal += performance.now() - referenceStart;
        }
      }

      speedTrials.push({
        candidateRenderTotal,
        referenceRenderTotal,
        speedup: candidateRenderTotal > 0 ? referenceRenderTotal / candidateRenderTotal : 0,
      });
    }

    const bestTrial = speedTrials.reduce((best, trial) =>
      (!best || trial.speedup > best.speedup ? trial : best), null);
    const speedup = bestTrial?.speedup ?? 0;

    if (mismatches.length / Math.max(comparisons.length, 1) <= (1 - MATCH_TARGET)) {
      const slowest = [...comparisons]
        .sort((a, b) => b.elapsed - a.elapsed)
        .slice(0, 5);

      console.log('\nSlowest candidate docs:');
      for (const entry of slowest) {
        console.log(`---\n[elapsed=${entry.elapsed.toFixed(3)}ms similarity=${entry.similarity.toFixed(3)}]\n${entry.doc}`);
      }
    }

    console.table([
      {
        corpus: docs.length,
        candidateCrashes: candidateCrashDocs.length,
        candidateInvalidHtml: invalidHtmlDocs.length,
        comparisons: comparisons.length,
        matchRate: Number((matchRate * 100).toFixed(2)),
        mismatchCount: mismatches.length,
        speedSampleDocs: speedDocs.length,
        speedMatchThreshold: SPEED_MATCH_THRESHOLD,
        candidateTotalMs: Number(candidateTotal.toFixed(2)),
        candidateRenderTotalMs: Number((bestTrial?.candidateRenderTotal ?? 0).toFixed(2)),
        referenceRenderTotalMs: Number((bestTrial?.referenceRenderTotal ?? 0).toFixed(2)),
        speedupX: Number(speedup.toFixed(2)),
        speedTrials: SPEED_TRIALS,
        speedPasses: SPEED_PASSES,
        thresholdSimilarity: MATCH_SIMILARITY_THRESHOLD,
      },
    ]);

    expect(candidateCrashDocs.length).toBe(0);
    expect(invalidHtmlDocs.length).toBe(0);
    expect(matchRate).toBeGreaterThanOrEqual(MATCH_TARGET);
    expect(speedup).toBeGreaterThanOrEqual(SPEEDUP_TARGET);
  });
});
