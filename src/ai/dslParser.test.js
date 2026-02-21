import { describe, it, expect } from 'vitest';
import { test as fcTest, fc } from '@fast-check/vitest';
import { parseDsl } from './dslParser.js';

describe('parseDsl', () => {
  it('simple apply with name only', () => {
    const result = parseDsl('swot');
    expect(result).toEqual([
      { type: 'apply', name: 'swot', title: null, slots: [] },
    ]);
  });

  it('apply with title', () => {
    const result = parseDsl('swot "My Title"');
    expect(result).toEqual([
      { type: 'apply', name: 'swot', title: 'My Title', slots: [] },
    ]);
  });

  it('apply with title and slots', () => {
    const result = parseDsl('swot "SWOT: Q1 Review" ; Strong brand ; High costs ; New markets ; Competition');
    expect(result).toEqual([
      {
        type: 'apply',
        name: 'swot',
        title: 'SWOT: Q1 Review',
        slots: [['Strong brand'], ['High costs'], ['New markets'], ['Competition']],
      },
    ]);
  });

  it('apply without title but with slots', () => {
    const result = parseDsl('swot ; A ; B ; C ; D');
    expect(result).toEqual([
      { type: 'apply', name: 'swot', title: null, slots: [['A'], ['B'], ['C'], ['D']] },
    ]);
  });

  it('slots with pipe values', () => {
    const result = parseDsl('user-journey "Journey Map" ; Awareness|See ad|Curious ; Consideration|Read reviews|Hopeful');
    expect(result).toEqual([
      {
        type: 'apply',
        name: 'user-journey',
        title: 'Journey Map',
        slots: [
          ['Awareness', 'See ad', 'Curious'],
          ['Consideration', 'Read reviews', 'Hopeful'],
        ],
      },
    ]);
  });

  it('patch line — text content', () => {
    const result = parseDsl('@grid/sticky[1] Updated text');
    expect(result).toEqual([
      { type: 'patch', path: 'grid/sticky[1]', value: 'Updated text' },
    ]);
  });

  it('patch line — attribute', () => {
    const result = parseDsl('@grid/sticky[2]/@color #FF0000');
    expect(result).toEqual([
      { type: 'patch', path: 'grid/sticky[2]/@color', value: '#FF0000' },
    ]);
  });

  it('patch line — nested attribute', () => {
    const result = parseDsl('@frame/@title Renamed');
    expect(result).toEqual([
      { type: 'patch', path: 'frame/@title', value: 'Renamed' },
    ]);
  });

  it('mixed apply + patches', () => {
    const input = `swot "Q1 Review" ; Strength ; Weakness ; Opportunity ; Threat
@grid/sticky[1]/@color #FF0000`;
    const result = parseDsl(input);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('apply');
    expect(result[0].name).toBe('swot');
    expect(result[0].title).toBe('Q1 Review');
    expect(result[0].slots).toHaveLength(4);
    expect(result[1]).toEqual({ type: 'patch', path: 'grid/sticky[1]/@color', value: '#FF0000' });
  });

  it('empty lines are skipped', () => {
    const input = `

swot "Title"

@grid/sticky[1] Hello

`;
    const result = parseDsl(input);
    expect(result).toHaveLength(2);
  });

  it('whitespace trimming on slots and pipe values', () => {
    const result = parseDsl('tpl ;  A  |  B  ;  C  ');
    expect(result).toEqual([
      {
        type: 'apply',
        name: 'tpl',
        title: null,
        slots: [['A', 'B'], ['C']],
      },
    ]);
  });

  it('multiple apply lines', () => {
    const input = `swot "First"
kanban "Second" ; Todo ; Doing ; Done`;
    const result = parseDsl(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: 'apply', name: 'swot', title: 'First', slots: [] });
    expect(result[1]).toEqual({
      type: 'apply',
      name: 'kanban',
      title: 'Second',
      slots: [['Todo'], ['Doing'], ['Done']],
    });
  });

  it('multiple patch lines', () => {
    const input = `@grid/sticky[1] Updated text
@frame/@title Renamed
@grid/sticky[2]/@color #FF0000`;
    const result = parseDsl(input);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'patch', path: 'grid/sticky[1]', value: 'Updated text' });
    expect(result[1]).toEqual({ type: 'patch', path: 'frame/@title', value: 'Renamed' });
    expect(result[2]).toEqual({ type: 'patch', path: 'grid/sticky[2]/@color', value: '#FF0000' });
  });

  // --- Edge-case tests ---

  it('empty string input → returns empty array', () => {
    expect(parseDsl('')).toEqual([]);
  });

  it('input with only whitespace lines → returns empty array', () => {
    expect(parseDsl('   \n   \n  ')).toEqual([]);
  });

  it('input with only newlines → returns empty array', () => {
    expect(parseDsl('\n\n\n')).toEqual([]);
  });

  it('patch with no value (just @path) → value is empty string', () => {
    expect(parseDsl('@some/path')).toEqual([
      { type: 'patch', path: 'some/path', value: '' },
    ]);
  });

  it('patch with value containing spaces → preserves full value', () => {
    expect(parseDsl('@node/text hello world foo bar')).toEqual([
      { type: 'patch', path: 'node/text', value: 'hello world foo bar' },
    ]);
  });

  it('title with special chars (semicolons, pipes inside quotes)', () => {
    // Semicolons and pipes inside quotes are part of the title, not parsed as delimiters
    const result = parseDsl('tpl "A;B|C"');
    expect(result).toEqual([
      { type: 'apply', name: 'tpl', title: 'A;B|C', slots: [] },
    ]);
  });

  it('missing closing quote on title → title remains null, rest goes to slots', () => {
    // rest starts with `"` but no closing quote → title stays null, rest stays unchanged
    // rest = '"No close ; A ; B' → no leading ';', so rest is split by ';' directly
    const result = parseDsl('tpl "No close ; A ; B');
    expect(result[0].type).toBe('apply');
    expect(result[0].name).toBe('tpl');
    expect(result[0].title).toBeNull();
    // The rest (including the quote) becomes slots split by ';'
    expect(result[0].slots).toEqual([['"No close'], ['A'], ['B']]);
  });

  it('slots with empty segments between semicolons are skipped', () => {
    const result = parseDsl('tpl ; ; A ; ;');
    expect(result).toEqual([
      { type: 'apply', name: 'tpl', title: null, slots: [['A']] },
    ]);
  });

  it('slots with empty pipe segments — empty-ish pipe parts still included', () => {
    const result = parseDsl('tpl ; A| |B');
    expect(result).toEqual([
      { type: 'apply', name: 'tpl', title: null, slots: [['A', '', 'B']] },
    ]);
  });

  it('apply line with trailing semicolons → no extra empty slots', () => {
    const result = parseDsl('tpl ; X ; Y ;;;');
    expect(result).toEqual([
      { type: 'apply', name: 'tpl', title: null, slots: [['X'], ['Y']] },
    ]);
  });

  it('patch line with special chars in path like brackets', () => {
    expect(parseDsl('@items[0]/sub[2]/@color red')).toEqual([
      { type: 'patch', path: 'items[0]/sub[2]/@color', value: 'red' },
    ]);
  });

  it('title that is empty string (e.g. tpl "")', () => {
    const result = parseDsl('tpl ""');
    expect(result).toEqual([
      { type: 'apply', name: 'tpl', title: '', slots: [] },
    ]);
  });

  it('name with hyphens and numbers (e.g. grid-3x3)', () => {
    const result = parseDsl('grid-3x3 "Layout" ; A ; B');
    expect(result).toEqual([
      { type: 'apply', name: 'grid-3x3', title: 'Layout', slots: [['A'], ['B']] },
    ]);
  });

  // --- Property-based tests ---

  describe('PBT', () => {
    fcTest.prop([fc.stringMatching(/^[a-z][a-z0-9-]*$/), fc.string()])
    ('any single word followed by optional content produces 1 apply with correct name', (word, extra) => {
      const input = extra ? `${word} ${extra}` : word;
      // Only use single-line input to guarantee exactly 1 result
      const singleLine = input.split('\n')[0];
      if (!singleLine.trim()) return; // degenerate
      const result = parseDsl(singleLine);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('apply');
      expect(result[0].name).toBe(word);
    });

    fcTest.prop([fc.stringMatching(/^[a-zA-Z0-9/_@[\]-]+$/)])
    ('any patch line starting with @ followed by a path produces type patch', (path) => {
      const input = `@${path}`;
      const result = parseDsl(input);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('patch');
    });

    fcTest.prop([fc.string()])
    ('parseDsl never throws on any string input', (s) => {
      expect(() => parseDsl(s)).not.toThrow();
    });

    fcTest.prop([fc.string()])
    ('number of results equals number of non-empty trimmed lines', (s) => {
      const result = parseDsl(s);
      const nonEmptyLines = s.split('\n').filter((l) => l.trim().length > 0).length;
      expect(result).toHaveLength(nonEmptyLines);
    });
  });
});
