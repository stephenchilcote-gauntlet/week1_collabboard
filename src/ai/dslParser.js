/**
 * Parses a DSL text string into a flat list of operations.
 *
 * Grammar:
 *   line  = apply | patch
 *   apply = NAME TITLE? (';' SLOT)*
 *   patch = '@' XPATH VALUE
 *   SLOT  = VALUE ('|' VALUE)*
 */

export const parseDsl = (text) => {
  const results = [];
  const lines = text.split('\n');

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('@')) {
      results.push(parsePatch(line));
    } else {
      results.push(parseApply(line));
    }
  }

  return results;
};

function parsePatch(line) {
  // '@' PATH ' ' VALUE
  const withoutAt = line.slice(1);
  const spaceIdx = withoutAt.indexOf(' ');
  if (spaceIdx === -1) {
    return { type: 'patch', path: withoutAt, value: '' };
  }
  const path = withoutAt.slice(0, spaceIdx);
  const value = withoutAt.slice(spaceIdx + 1).trim();
  return { type: 'patch', path, value };
}

function parseApply(line) {
  let rest = line;

  // Extract NAME — first whitespace-delimited token before any quote or semicolon
  const nameMatch = rest.match(/^(\S+)/);
  const name = nameMatch[1];
  rest = rest.slice(name.length).trim();

  // Extract optional title in double quotes
  let title = null;
  if (rest.startsWith('"')) {
    const closeQuote = rest.indexOf('"', 1);
    if (closeQuote !== -1) {
      title = rest.slice(1, closeQuote);
      rest = rest.slice(closeQuote + 1).trim();
    }
  }

  // Extract slots after semicolons
  const slots = [];
  if (rest.startsWith(';')) {
    rest = rest.slice(1);
  }
  if (rest) {
    const parts = rest.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const pipeValues = trimmed.split('|').map((v) => v.trim());
      slots.push(pipeValues);
    }
  }

  return { type: 'apply', name, title, slots };
}
