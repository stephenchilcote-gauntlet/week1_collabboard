import { describe, it, expect } from 'vitest';
import { test as fcTest, fc } from '@fast-check/vitest';
import { applyPatches } from './xpathPatcher.js';

const makeDoc = (xml) => new DOMParser().parseFromString(xml, 'application/xml');

const SAMPLE_XML = `<board>
  <grid>
    <sticky>First</sticky>
    <sticky>Second</sticky>
    <sticky>Third</sticky>
  </grid>
  <frame title="Original">
    <sticky>Inside frame</sticky>
  </frame>
  <row>
    <stack>
      <sticky>S1-1</sticky>
    </stack>
    <stack>
      <sticky>S2-1</sticky>
      <sticky>S2-2</sticky>
    </stack>
  </row>
</board>`;

describe('applyPatches', () => {
  it('sets text content of first element by tag', () => {
    const doc = makeDoc(SAMPLE_XML);
    applyPatches(doc, [{ path: 'grid/sticky[1]', value: 'Updated' }]);
    const stickies = doc.getElementsByTagName('grid')[0].getElementsByTagName('sticky');
    expect(stickies[0].textContent).toBe('Updated');
  });

  it('sets text content of Nth element', () => {
    const doc = makeDoc(SAMPLE_XML);
    applyPatches(doc, [{ path: 'grid/sticky[3]', value: 'New Third' }]);
    const stickies = doc.getElementsByTagName('grid')[0].getElementsByTagName('sticky');
    expect(stickies[2].textContent).toBe('New Third');
  });

  it('sets an attribute', () => {
    const doc = makeDoc(SAMPLE_XML);
    applyPatches(doc, [{ path: 'frame/@title', value: 'Renamed' }]);
    const frame = doc.getElementsByTagName('frame')[0];
    expect(frame.getAttribute('title')).toBe('Renamed');
  });

  it('sets attribute on nested element', () => {
    const doc = makeDoc(SAMPLE_XML);
    applyPatches(doc, [{ path: 'grid/sticky[2]/@color', value: '#FF0000' }]);
    const sticky = doc.getElementsByTagName('grid')[0].children[1];
    expect(sticky.getAttribute('color')).toBe('#FF0000');
  });

  it('handles deeply nested paths (row/stack[2]/sticky[1])', () => {
    const doc = makeDoc(SAMPLE_XML);
    applyPatches(doc, [{ path: 'row/stack[2]/sticky[1]', value: 'Deep Update' }]);
    const row = doc.getElementsByTagName('row')[0];
    const stacks = Array.from(row.children).filter((c) => c.tagName === 'stack');
    const sticky = Array.from(stacks[1].children).filter((c) => c.tagName === 'sticky')[0];
    expect(sticky.textContent).toBe('Deep Update');
  });

  it('first segment is descendant search', () => {
    const doc = makeDoc(SAMPLE_XML);
    // 'frame' is not a direct child of root in terms of ordering, but getElementsByTagName finds it
    applyPatches(doc, [{ path: 'frame/sticky[1]', value: 'Found via descendant' }]);
    const frame = doc.getElementsByTagName('frame')[0];
    expect(frame.getElementsByTagName('sticky')[0].textContent).toBe('Found via descendant');
  });

  it('subsequent segments are direct children only', () => {
    const doc = makeDoc(SAMPLE_XML);
    // row/sticky[1] should not find stickies inside stack children (not direct children of row)
    applyPatches(doc, [{ path: 'row/sticky[1]', value: 'Should not apply' }]);
    // Verify nothing changed — stickies inside stacks should be untouched
    const row = doc.getElementsByTagName('row')[0];
    const directStickies = Array.from(row.children).filter((c) => c.tagName === 'sticky');
    expect(directStickies).toHaveLength(0);
    // Original content preserved
    const stacks = Array.from(row.children).filter((c) => c.tagName === 'stack');
    expect(stacks[0].getElementsByTagName('sticky')[0].textContent).toBe('S1-1');
  });

  it('silently skips paths that do not resolve', () => {
    const doc = makeDoc(SAMPLE_XML);
    const original = doc.documentElement.outerHTML;
    applyPatches(doc, [
      { path: 'nonexistent/sticky[1]', value: 'Nope' },
      { path: 'grid/sticky[99]', value: 'Nope' },
      { path: 'grid/bogus[1]', value: 'Nope' },
    ]);
    expect(doc.documentElement.outerHTML).toBe(original);
  });

  it('applies multiple patches in sequence', () => {
    const doc = makeDoc(SAMPLE_XML);
    applyPatches(doc, [
      { path: 'grid/sticky[1]', value: 'One' },
      { path: 'grid/sticky[2]', value: 'Two' },
      { path: 'frame/@title', value: 'New Title' },
    ]);
    const grid = doc.getElementsByTagName('grid')[0];
    const stickies = Array.from(grid.children).filter((c) => c.tagName === 'sticky');
    expect(stickies[0].textContent).toBe('One');
    expect(stickies[1].textContent).toBe('Two');
    expect(doc.getElementsByTagName('frame')[0].getAttribute('title')).toBe('New Title');
  });

  it('returns the doc for chaining', () => {
    const doc = makeDoc(SAMPLE_XML);
    const result = applyPatches(doc, []);
    expect(result).toBe(doc);
  });

  // --- Edge-case tests ---

  it('creates a new attribute that does not exist yet', () => {
    const doc = makeDoc(SAMPLE_XML);
    applyPatches(doc, [{ path: 'grid/sticky[1]/@data-new', value: 'fresh' }]);
    const sticky = doc.getElementsByTagName('grid')[0].children[0];
    expect(sticky.getAttribute('data-new')).toBe('fresh');
  });

  it('patches root element text via single-segment path', () => {
    const simple = makeDoc('<sticky>Hello</sticky>');
    applyPatches(simple, [{ path: 'sticky[1]', value: 'Goodbye' }]);
    expect(simple.getElementsByTagName('sticky')[0].textContent).toBe('Goodbye');
  });

  it('patches a deeply nested 3-level path', () => {
    const xml = '<a><b><c><d>deep</d></c></b></a>';
    const doc = makeDoc(xml);
    applyPatches(doc, [{ path: 'b/c[1]/d[1]', value: 'found' }]);
    expect(doc.getElementsByTagName('d')[0].textContent).toBe('found');
  });

  it('index [0] silently skips (1-indexed, so 0 is out of bounds)', () => {
    const doc = makeDoc(SAMPLE_XML);
    const original = doc.documentElement.outerHTML;
    applyPatches(doc, [{ path: 'grid/sticky[0]', value: 'Bad index' }]);
    expect(doc.documentElement.outerHTML).toBe(original);
  });

  it('empty patches array leaves doc unchanged and returns doc', () => {
    const doc = makeDoc(SAMPLE_XML);
    const original = doc.documentElement.outerHTML;
    const result = applyPatches(doc, []);
    expect(result).toBe(doc);
    expect(doc.documentElement.outerHTML).toBe(original);
  });

  it('multiple patches to same element — last one wins for text', () => {
    const doc = makeDoc(SAMPLE_XML);
    applyPatches(doc, [
      { path: 'grid/sticky[1]', value: 'First write' },
      { path: 'grid/sticky[1]', value: 'Second write' },
      { path: 'grid/sticky[1]', value: 'Third write' },
    ]);
    const sticky = doc.getElementsByTagName('grid')[0].children[0];
    expect(sticky.textContent).toBe('Third write');
  });

  it('patches to set empty string value', () => {
    const doc = makeDoc(SAMPLE_XML);
    applyPatches(doc, [{ path: 'grid/sticky[1]', value: '' }]);
    const sticky = doc.getElementsByTagName('grid')[0].children[0];
    expect(sticky.textContent).toBe('');
  });

  it('path where first segment finds nothing — silently skips', () => {
    const doc = makeDoc(SAMPLE_XML);
    const original = doc.documentElement.outerHTML;
    applyPatches(doc, [{ path: 'doesnotexist[1]', value: 'Nope' }]);
    expect(doc.documentElement.outerHTML).toBe(original);
  });

  it('sets attribute on root document element via single-segment path', () => {
    const doc = makeDoc(SAMPLE_XML);
    applyPatches(doc, [{ path: 'board/@data-id', value: '42' }]);
    expect(doc.documentElement.getAttribute('data-id')).toBe('42');
  });

  it('overwrites an existing attribute value', () => {
    const doc = makeDoc(SAMPLE_XML);
    expect(doc.getElementsByTagName('frame')[0].getAttribute('title')).toBe('Original');
    applyPatches(doc, [{ path: 'frame/@title', value: 'Overwritten' }]);
    expect(doc.getElementsByTagName('frame')[0].getAttribute('title')).toBe('Overwritten');
  });

  it('path segment with no bracket defaults to index 1', () => {
    const doc = makeDoc(SAMPLE_XML);
    applyPatches(doc, [{ path: 'grid/sticky', value: 'No bracket' }]);
    const sticky = doc.getElementsByTagName('grid')[0].children[0];
    expect(sticky.textContent).toBe('No bracket');
  });

  it('path with trailing slash — extra empty segment causes silent skip', () => {
    const doc = makeDoc(SAMPLE_XML);
    const original = doc.documentElement.outerHTML;
    applyPatches(doc, [{ path: 'grid/sticky[1]/', value: 'Bad path' }]);
    expect(doc.documentElement.outerHTML).toBe(original);
  });

  // --- Property-based tests ---

  describe('PBT', () => {
    fcTest.prop([
      fc.array(
        fc.record({
          path: fc.string(),
          value: fc.string(),
        }),
      ),
    ])('applyPatches always returns the same doc reference and never throws', (patches) => {
      const doc = makeDoc(SAMPLE_XML);
      const result = applyPatches(doc, patches);
      expect(result).toBe(doc);
    });

    fcTest.prop([fc.string()])('random path strings against a simple doc never throw', (path) => {
      const doc = makeDoc('<root><child>text</child></root>');
      const result = applyPatches(doc, [{ path, value: 'test' }]);
      expect(result).toBe(doc);
    });
  });
});
