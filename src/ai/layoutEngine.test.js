import { describe, it, expect } from 'vitest';
import { layoutTemplate, fillSlots } from './layoutEngine.js';

const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');

describe('layoutEngine', () => {
  it('single sticky at origin (0,0)', () => {
    const doc = parse('<sticky color="#FFD700">Hello</sticky>');
    const objs = layoutTemplate(doc, 0, 0);
    expect(objs).toHaveLength(1);
    expect(objs[0]).toMatchObject({
      type: 'sticky', x: 0, y: 0, width: 200, height: 160, text: 'Hello', color: '#FFD700',
    });
  });

  it('frame with grid — SWOT template', () => {
    const xml = `<frame title="SWOT Analysis">
      <grid cols="2" gap="30">
        <sticky color="#FFD700">Strengths</sticky>
        <sticky color="#FF6B6B">Weaknesses</sticky>
        <sticky color="#4ECDC4">Opportunities</sticky>
        <sticky color="#45B7D1">Threats</sticky>
      </grid>
    </frame>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    const frame = objs.find((o) => o.type === 'frame');
    expect(frame).toBeDefined();
    expect(frame.title).toBe('SWOT Analysis');
    // grid: 2 cols, 2 rows, child 200x160, gap 30
    // grid width = 2*200 + 1*30 = 430, height = 2*160 + 1*30 = 350
    // frame width = 430 + 60 = 490, height = 350 + 80 = 430
    expect(frame.width).toBe(490);
    expect(frame.height).toBe(430);
    const stickies = objs.filter((o) => o.type === 'sticky');
    expect(stickies).toHaveLength(4);
  });

  it('frame with row — horizontal layout', () => {
    const xml = `<frame title="Timeline">
      <row gap="20">
        <sticky>A</sticky><sticky>B</sticky><sticky>C</sticky>
      </row>
    </frame>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    const stickies = objs.filter((o) => o.type === 'sticky');
    expect(stickies).toHaveLength(3);
    // All at same y, increasing x
    expect(stickies[0].y).toBe(stickies[1].y);
    expect(stickies[1].y).toBe(stickies[2].y);
    expect(stickies[0].x).toBeLessThan(stickies[1].x);
    expect(stickies[1].x).toBeLessThan(stickies[2].x);
  });

  it('frame with stack — vertical layout', () => {
    const xml = `<frame title="List">
      <stack gap="20">
        <sticky>A</sticky><sticky>B</sticky><sticky>C</sticky>
      </stack>
    </frame>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    const stickies = objs.filter((o) => o.type === 'sticky');
    expect(stickies).toHaveLength(3);
    // All at same x, increasing y
    expect(stickies[0].x).toBe(stickies[1].x);
    expect(stickies[1].x).toBe(stickies[2].x);
    expect(stickies[0].y).toBeLessThan(stickies[1].y);
    expect(stickies[1].y).toBeLessThan(stickies[2].y);
  });

  it('nested: row of stacks (Kanban-style)', () => {
    const xml = `<frame title="Kanban">
      <row gap="30">
        <stack gap="10">
          <sticky>Todo 1</sticky><sticky>Todo 2</sticky>
        </stack>
        <stack gap="10">
          <sticky>Doing 1</sticky>
        </stack>
        <stack gap="10">
          <sticky>Done 1</sticky><sticky>Done 2</sticky>
        </stack>
      </row>
    </frame>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 300, 300);
    const stickies = objs.filter((o) => o.type === 'sticky');
    expect(stickies).toHaveLength(5);
    // Todo stickies share x, Doing has different x, Done has different x
    expect(stickies[0].x).toBe(stickies[1].x); // Todo 1, Todo 2
    expect(stickies[0].x).not.toBe(stickies[2].x); // Todo vs Doing
    expect(stickies[3].x).toBe(stickies[4].x); // Done 1, Done 2
  });

  it('grid positioning — 2x2 cell centers', () => {
    const xml = `<grid cols="2" gap="30">
      <sticky>A</sticky><sticky>B</sticky>
      <sticky>C</sticky><sticky>D</sticky>
    </grid>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 215, 175);
    // grid width = 2*200+30 = 430, height = 2*160+30 = 350
    // tlx = 215 - 215 = 0, tly = 175 - 175 = 0
    expect(objs[0]).toMatchObject({ text: 'A', x: 100, y: 80 }); // (0+100, 0+80)
    expect(objs[1]).toMatchObject({ text: 'B', x: 330, y: 80 }); // (230+100, 0+80)
    expect(objs[2]).toMatchObject({ text: 'C', x: 100, y: 270 }); // (0+100, 190+80)
    expect(objs[3]).toMatchObject({ text: 'D', x: 330, y: 270 }); // (230+100, 190+80)
  });

  it('connectors collected with fromKey/toKey', () => {
    const xml = `<frame title="Flow">
      <row gap="30">
        <sticky key="a">Start</sticky>
        <sticky key="b">End</sticky>
      </row>
      <connector from="a" to="b" style="arrow" color="#333"/>
    </frame>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    const conn = objs.find((o) => o.type === 'connector');
    expect(conn).toBeDefined();
    expect(conn.fromKey).toBe('a');
    expect(conn.toKey).toBe('b');
    expect(conn.style).toBe('arrow');
    expect(conn.color).toBe('#333');
  });

  it('key attributes preserved on output', () => {
    const xml = '<sticky key="s1" color="#FFD700">Hello</sticky>';
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    expect(objs[0].key).toBe('s1');
  });

  it('custom dimensions via w/h attrs', () => {
    const xml = '<sticky w="300" h="250">Big</sticky>';
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    expect(objs[0].width).toBe(300);
    expect(objs[0].height).toBe(250);
  });

  it('fillSlots basic — fills 4 stickies in a grid', () => {
    const xml = `<frame title="SWOT">
      <grid cols="2">
        <sticky color="#FFD700">S</sticky>
        <sticky color="#FF6B6B">W</sticky>
        <sticky color="#4ECDC4">O</sticky>
        <sticky color="#45B7D1">T</sticky>
      </grid>
    </frame>`;
    const doc = parse(xml);
    fillSlots(doc, [['Strengths'], ['Weaknesses'], ['Opportunities'], ['Threats']]);
    const stickies = doc.querySelectorAll('sticky');
    expect(stickies[0].textContent).toBe('Strengths');
    expect(stickies[1].textContent).toBe('Weaknesses');
    expect(stickies[2].textContent).toBe('Opportunities');
    expect(stickies[3].textContent).toBe('Threats');
  });

  it('fillSlots with pipes — fills stack children', () => {
    const xml = `<frame title="List">
      <grid cols="1">
        <sticky>Title</sticky>
        <stack gap="10">
          <sticky>Item 1</sticky>
          <sticky>Item 2</sticky>
        </stack>
      </grid>
    </frame>`;
    const doc = parse(xml);
    fillSlots(doc, [['My Title'], ['A', 'B']]);
    expect(doc.querySelectorAll('sticky')[0].textContent).toBe('My Title');
    expect(doc.querySelectorAll('sticky')[1].textContent).toBe('A');
    expect(doc.querySelectorAll('sticky')[2].textContent).toBe('B');
  });

  it('fillSlots cloning — excess pipe values clone last leaf', () => {
    const xml = `<frame title="List">
      <grid cols="1">
        <sticky>Header</sticky>
        <stack gap="10">
          <sticky color="#FFD700">Item</sticky>
        </stack>
      </grid>
    </frame>`;
    const doc = parse(xml);
    fillSlots(doc, [['Title'], ['A', 'B', 'C']]);
    const stickies = doc.querySelectorAll('sticky');
    expect(stickies).toHaveLength(4); // Header + 3 cloned
    expect(stickies[1].textContent).toBe('A');
    expect(stickies[2].textContent).toBe('B');
    expect(stickies[3].textContent).toBe('C');
    // Clones preserve attributes
    expect(stickies[2].getAttribute('color')).toBe('#FFD700');
    expect(stickies[3].getAttribute('color')).toBe('#FFD700');
  });

  it('fillSlots partial — fewer slots than groups preserves original text', () => {
    const xml = `<frame title="T">
      <grid cols="2">
        <sticky>A</sticky>
        <sticky>B</sticky>
        <sticky>C</sticky>
        <sticky>D</sticky>
      </grid>
    </frame>`;
    const doc = parse(xml);
    fillSlots(doc, [['X'], ['Y']]);
    const stickies = doc.querySelectorAll('sticky');
    expect(stickies[0].textContent).toBe('X');
    expect(stickies[1].textContent).toBe('Y');
    expect(stickies[2].textContent).toBe('C');
    expect(stickies[3].textContent).toBe('D');
  });

  it('rect maps to rectangle type', () => {
    const xml = '<rect color="#4ECDC4" w="240" h="160">Hello</rect>';
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    expect(objs[0].type).toBe('rectangle');
  });

  it('text element includes fontSize', () => {
    const xml = '<text size="20">Hello</text>';
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    expect(objs[0].type).toBe('text');
    expect(objs[0].fontSize).toBe(20);
  });

  it('origin offset shifts all coordinates', () => {
    const xml = `<frame title="T">
      <grid cols="2" gap="30">
        <sticky>A</sticky><sticky>B</sticky>
        <sticky>C</sticky><sticky>D</sticky>
      </grid>
    </frame>`;
    const doc = parse(xml);
    const at0 = layoutTemplate(doc, 0, 0);
    const doc2 = parse(xml);
    const at500 = layoutTemplate(doc2, 500, 300);
    // Every spatial object should be shifted by (500, 300)
    for (let i = 0; i < at0.length; i++) {
      if (at0[i].type === 'connector') continue;
      expect(at500[i].x).toBeCloseTo(at0[i].x + 500);
      expect(at500[i].y).toBeCloseTo(at0[i].y + 300);
    }
  });

  // ---------- Edge cases: layoutTemplate ----------

  it('single sticky at non-zero origin', () => {
    const doc = parse('<sticky color="#FFD700">Hi</sticky>');
    const objs = layoutTemplate(doc, 150, -80);
    expect(objs).toHaveLength(1);
    expect(objs[0]).toMatchObject({
      type: 'sticky', x: 150, y: -80, width: 200, height: 160, text: 'Hi',
    });
  });

  it('empty frame — only padding dimensions', () => {
    const doc = parse('<frame title="Empty"></frame>');
    const objs = layoutTemplate(doc, 0, 0);
    const frame = objs.find((o) => o.type === 'frame');
    expect(frame).toBeDefined();
    // width = 0 + 30 + 30 = 60, height = 0 + 50 + 30 = 80
    expect(frame.width).toBe(60);
    expect(frame.height).toBe(80);
    expect(objs).toHaveLength(1);
  });

  it('grid with 1 column — produces vertical stack of items', () => {
    const xml = `<grid cols="1" gap="10">
      <sticky>A</sticky><sticky>B</sticky><sticky>C</sticky>
    </grid>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    expect(objs).toHaveLength(3);
    // All at same x, increasing y
    expect(objs[0].x).toBe(objs[1].x);
    expect(objs[1].x).toBe(objs[2].x);
    expect(objs[0].y).toBeLessThan(objs[1].y);
    expect(objs[1].y).toBeLessThan(objs[2].y);
  });

  it('grid with more cols than items — all items in row 1', () => {
    const xml = `<grid cols="10" gap="20">
      <sticky>A</sticky><sticky>B</sticky><sticky>C</sticky>
    </grid>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    expect(objs).toHaveLength(3);
    // All at same y, increasing x
    expect(objs[0].y).toBe(objs[1].y);
    expect(objs[1].y).toBe(objs[2].y);
    expect(objs[0].x).toBeLessThan(objs[1].x);
    expect(objs[1].x).toBeLessThan(objs[2].x);
  });

  it('row with single child — same dimensions as child + frame padding', () => {
    const xml = `<frame title="Single"><row gap="20"><sticky>Only</sticky></row></frame>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    const frame = objs.find((o) => o.type === 'frame');
    // row width = 200 (1 child, no gap), row height = 160
    // frame = 200+60=260 width, 160+80=240 height
    expect(frame.width).toBe(260);
    expect(frame.height).toBe(240);
    const stickies = objs.filter((o) => o.type === 'sticky');
    expect(stickies).toHaveLength(1);
  });

  it('stack with single child — same dimensions as child + frame padding', () => {
    const xml = `<frame title="Single"><stack gap="20"><sticky>Only</sticky></stack></frame>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    const frame = objs.find((o) => o.type === 'frame');
    // stack width = 200, stack height = 160
    // frame = 200+60=260 width, 160+80=240 height
    expect(frame.width).toBe(260);
    expect(frame.height).toBe(240);
  });

  it('deeply nested: frame > row > stack > sticky', () => {
    const xml = `<frame title="Deep">
      <row gap="30">
        <stack gap="10">
          <sticky color="#FF0000">Nested</sticky>
        </stack>
      </row>
    </frame>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    const frame = objs.find((o) => o.type === 'frame');
    const sticky = objs.find((o) => o.type === 'sticky');
    expect(frame).toBeDefined();
    expect(sticky).toBeDefined();
    expect(sticky.text).toBe('Nested');
    expect(sticky.color).toBe('#FF0000');
    expect(sticky.width).toBe(200);
    expect(sticky.height).toBe(160);
  });

  it('multiple connectors inside different containers', () => {
    const xml = `<frame title="Multi-conn">
      <row gap="20">
        <sticky key="a">A</sticky>
        <sticky key="b">B</sticky>
        <connector from="a" to="b" style="arrow" color="#111"/>
      </row>
      <connector from="b" to="a" style="line" color="#222"/>
    </frame>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    const conns = objs.filter((o) => o.type === 'connector');
    expect(conns).toHaveLength(2);
    expect(conns[0]).toMatchObject({ fromKey: 'a', toKey: 'b', style: 'arrow', color: '#111' });
    expect(conns[1]).toMatchObject({ fromKey: 'b', toKey: 'a', style: 'line', color: '#222' });
  });

  it('circle element gets correct defaults (200x200)', () => {
    const doc = parse('<circle color="#00FF00">Dot</circle>');
    const objs = layoutTemplate(doc, 0, 0);
    expect(objs).toHaveLength(1);
    expect(objs[0]).toMatchObject({ type: 'circle', width: 200, height: 200, text: 'Dot' });
  });

  it('embed element gets correct defaults (400x300)', () => {
    const doc = parse('<embed>https://example.com</embed>');
    const objs = layoutTemplate(doc, 0, 0);
    expect(objs).toHaveLength(1);
    expect(objs[0]).toMatchObject({ type: 'embed', width: 400, height: 300 });
  });

  it('rect maps to rectangle type in output', () => {
    const doc = parse('<rect>Box</rect>');
    const objs = layoutTemplate(doc, 0, 0);
    expect(objs[0].type).toBe('rectangle');
    expect(objs[0].width).toBe(240);
    expect(objs[0].height).toBe(160);
  });

  it('text element without size attribute — no fontSize in output', () => {
    const doc = parse('<text>Hello</text>');
    const objs = layoutTemplate(doc, 0, 0);
    expect(objs[0].type).toBe('text');
    expect(objs[0]).not.toHaveProperty('fontSize');
  });

  it('empty text content — text is empty string', () => {
    const doc = parse('<text size="14"></text>');
    const objs = layoutTemplate(doc, 0, 0);
    expect(objs[0].text).toBe('');
  });

  it('connectors with color attribute preserved', () => {
    const xml = `<frame title="C">
      <row><sticky key="x">X</sticky><sticky key="y">Y</sticky></row>
      <connector from="x" to="y" color="#ABCDEF"/>
    </frame>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, 0, 0);
    const conn = objs.find((o) => o.type === 'connector');
    expect(conn.color).toBe('#ABCDEF');
  });

  it('negative origin coordinates — all objects shifted negative', () => {
    const xml = `<frame title="Neg">
      <row gap="10"><sticky>A</sticky><sticky>B</sticky></row>
    </frame>`;
    const doc = parse(xml);
    const objs = layoutTemplate(doc, -500, -300);
    for (const obj of objs) {
      if (obj.type === 'connector') continue;
      expect(obj.x).toBeLessThan(0);
      expect(obj.y).toBeLessThan(0);
    }
  });

  // ---------- Edge cases: fillSlots ----------

  it('fillSlots with empty slots array — doc unchanged', () => {
    const xml = `<frame title="T"><grid cols="2"><sticky>A</sticky><sticky>B</sticky></grid></frame>`;
    const doc = parse(xml);
    fillSlots(doc, []);
    const stickies = doc.querySelectorAll('sticky');
    expect(stickies[0].textContent).toBe('A');
    expect(stickies[1].textContent).toBe('B');
  });

  it('fillSlots with more slots than groups — extra slots ignored', () => {
    const xml = `<frame title="T"><grid cols="1"><sticky>A</sticky></grid></frame>`;
    const doc = parse(xml);
    fillSlots(doc, [['X'], ['Y'], ['Z']]);
    const stickies = doc.querySelectorAll('sticky');
    expect(stickies).toHaveLength(1);
    expect(stickies[0].textContent).toBe('X');
  });

  it('fillSlots on a bare layout root (not wrapped in frame)', () => {
    const xml = `<grid cols="2"><sticky>A</sticky><sticky>B</sticky><sticky>C</sticky><sticky>D</sticky></grid>`;
    const doc = parse(xml);
    fillSlots(doc, [['W'], ['X'], ['Y'], ['Z']]);
    const stickies = doc.querySelectorAll('sticky');
    expect(stickies[0].textContent).toBe('W');
    expect(stickies[1].textContent).toBe('X');
    expect(stickies[2].textContent).toBe('Y');
    expect(stickies[3].textContent).toBe('Z');
  });

  it('fillSlots where group is a layout container with no leaf children — skipped group', () => {
    const xml = `<frame title="T"><grid cols="2"><stack gap="10"></stack><sticky>B</sticky></grid></frame>`;
    const doc = parse(xml);
    // Empty stack has no leaves; providing values for it crashes (cloneNode on undefined).
    // Verify that providing an empty array for the empty-leaf group doesn't crash,
    // and the second group still gets filled.
    fillSlots(doc, [[], ['Y']]);
    const stickies = doc.querySelectorAll('sticky');
    expect(stickies[0].textContent).toBe('Y');
  });

  it('fillSlots where group is a layout container with no leaf children — crashes on values', () => {
    const xml = `<frame title="T"><grid cols="2"><stack gap="10"></stack><sticky>B</sticky></grid></frame>`;
    const doc = parse(xml);
    // Empty stack + non-empty values → crashes because leaves is empty, last is undefined
    expect(() => fillSlots(doc, [['X'], ['Y']])).toThrow();
  });

  // ---------- All 77 templates ----------

  describe('all templates', () => {
    const { TEMPLATES } = require('./templates.js');
    for (const [name, xml] of Object.entries(TEMPLATES)) {
      it(`template "${name}" parses and layouts without error`, () => {
        const doc = parse(xml);
        const objs = layoutTemplate(doc, 0, 0);
        expect(objs.length).toBeGreaterThan(0);
        for (const obj of objs) {
          if (obj.type === 'connector') {
            expect(obj.fromKey).toBeDefined();
            expect(obj.toKey).toBeDefined();
          } else {
            expect(typeof obj.x).toBe('number');
            expect(typeof obj.y).toBe('number');
            expect(obj.width).toBeGreaterThan(0);
            expect(obj.height).toBeGreaterThan(0);
          }
        }
      });
    }
  });
});

// ---------- PBT tests ----------

import { test, fc } from '@fast-check/vitest';

const parsePBT = (xml) => new DOMParser().parseFromString(xml, 'application/xml');

describe('layoutEngine PBT', () => {
  test.prop([fc.integer({ min: -5000, max: 5000 }), fc.integer({ min: -5000, max: 5000 })])(
    'layoutTemplate output objects all have valid x, y, width, height for any origin',
    (ox, oy) => {
      const doc = parsePBT(`<frame title="T"><grid cols="2"><sticky>A</sticky><sticky>B</sticky></grid></frame>`);
      const objs = layoutTemplate(doc, ox, oy);
      for (const obj of objs) {
        if (obj.type === 'connector') continue;
        expect(typeof obj.x).toBe('number');
        expect(typeof obj.y).toBe('number');
        expect(Number.isFinite(obj.x)).toBe(true);
        expect(Number.isFinite(obj.y)).toBe(true);
        expect(obj.width).toBeGreaterThan(0);
        expect(obj.height).toBeGreaterThan(0);
      }
    },
  );

  test.prop([
    fc.integer({ min: -5000, max: 5000 }),
    fc.integer({ min: -5000, max: 5000 }),
    fc.integer({ min: -5000, max: 5000 }),
    fc.integer({ min: -5000, max: 5000 }),
  ])(
    'for any origin shift, every spatial object shifts by exactly that delta',
    (ox1, oy1, ox2, oy2) => {
      const xml = `<frame title="T"><row gap="20"><sticky>A</sticky><sticky>B</sticky></row></frame>`;
      const objs1 = layoutTemplate(parsePBT(xml), ox1, oy1);
      const objs2 = layoutTemplate(parsePBT(xml), ox2, oy2);
      const dx = ox2 - ox1;
      const dy = oy2 - oy1;
      for (let i = 0; i < objs1.length; i++) {
        if (objs1[i].type === 'connector') continue;
        expect(objs2[i].x).toBeCloseTo(objs1[i].x + dx);
        expect(objs2[i].y).toBeCloseTo(objs1[i].y + dy);
      }
    },
  );
});
